/**
 * `ring-jam` — the traffic jam controller (docs/design/ring.md §7.2). Invisible; it rides with the
 * camera while it runs.
 *
 * 1. 'warn': a gantry with 50 on every lane comes in (flashers); the traffic starts to brake
 *    (`jamOf(world).level` rises: civilian cars lose their own speed); the road eases down.
 * 2. 'brake': the jam's tail drives in from the right — `cars` civilian cars (two per open lane,
 *    gaps between them big enough for a wagon) that stop at their stands (`stopAt`, screen x, in
 *    front of the wagons); the road speed is capped to a crawl (`limitSpeed('jam', …)`), then 0.
 * 3. 'hold': everything stands. Lane changes only into gaps (cars block without damage at a
 *    crawl, traffic/car.ts). The waves (param `waves`: wave B's boarders) come one after the other,
 *    each when the one before is gone. It clears after its last wave, or at the timeout `ticks`.
 * 4. 'clear': the cap is lifted, the speed comes back, an end-of-restrictions gantry comes in, the
 *    jam's cars drive off with the flow; then it is gone.
 * The cars' layout comes from the entry itself (`seed`, else its x): the same plan, the same jam.
 *
 * THE PLAN'S JAM (param `length`, GEN's director): the plan already holds the 50 gantry before it
 * and the queue (`ring-car` with `jam: true` and `stopAt`), so the controller spawns neither (unless
 * `cars` is given) and follows the plan's timing: the road crawls at `crawl` px/tick from the jam's
 * start, stands still `hold` ticks once the plan cursor is `holdAt` px into the jam (the waves come
 * during that stand), crawls on and clears `length` px after its start.
 *
 * Params: `ticks` (hold timeout, default `JAM.hold`), `cars` (default 8; 0 with `length`), `waves`
 * (an array of waves; a wave is an array of `{ id, dx?, lane?, from?: 'ahead' | 'behind', params? }`;
 * unknown ids are skipped), `after` (one more wave, spawned when the plan's stand ends: the
 * director's EASY floor for the crawl after it), `seed`; the plan's `length`, `crawl`, `hold`, `holdAt`.
 *
 * THE FINAL JAM (revision R, docs/design/ring.md §R.4; OPT-IN param `final: true`, off by default:
 * every other jam is unchanged): the short route's last chunk. On its first tick a matrix gantry
 * comes in with a red X on every lane and the `FILE` / `BLOKKADE` text panel (gantry param `drip:
 * 'file'`); its tail (`cars`) drives in and stands; the road crawls at `crawl` to the chunk's end,
 * then stands (phase 'hold', the cap 0). It NEVER clears and has no waves (`waves` / `after` are
 * ignored): the alight scene (ring/alight.ts) takes over at the plan's end.
 */
import { Entity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import { defineEntity, hasEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf } from '../../../ring/entity';
import { RING_ENTITY, type RingCarModel } from '../../../ring/ids';
import { laneY, nearestLane } from '../../../ring/lanes';
import { WAGON_W } from '../../../ring/wagon';
import { RingCar } from '../traffic/car';
import { CAR_GEO } from '../traffic/geometry';
import { drivenWagons, jamOf, ringRng } from '../traffic/road-kit';

export type JamPhase = 'warn' | 'brake' | 'crawl' | 'hold' | 'clear' | 'done';

/** Tuning (ticks, px/tick). */
export const JAM = {
  warnTicks: 80,
  /** The crawl while the tail drives in, and the longest wait for it. */
  crawl: 1.1,
  brakeMax: 200,
  /** Hold timeout (no waves) and the shortest hold after the last wave. */
  hold: 480,
  minHold: 120,
  /** Level change per tick (braking / clearing). */
  rise: 0.02,
  fall: 0.015,
  /** The tail's stands: screen x of the first car per lane (min), the spread. */
  standX: 236,
  spread: 70,
  /** A wave member off screen this many ticks in a row no longer holds the stand (fix 2026-10-21). */
  offscreenHold: 60,
} as const;

/** One spawn of a jam wave. */
export interface JamWaveEntry {
  id: string;
  dx?: number;
  lane?: number;
  from?: 'ahead' | 'behind';
  params?: Record<string, unknown>;
}

export class RingJam extends Entity {
  phase: JamPhase = 'warn';
  t = 0;
  readonly holdTicks: number;
  readonly carCount: number;
  readonly waves: JamWaveEntry[][];
  /** The wave spawned when the plan's stand ends (param `after`; empty = none). */
  readonly after: JamWaveEntry[];
  readonly seed: number;
  /** The cars of the jam's tail and the wave entities alive. */
  readonly cars: Entity[] = [];
  private waveLive: Entity[] = [];
  private waveIdx = 0;
  /** Ticks in a row with every live wave member off screen. */
  private offT = 0;
  /** The plan's jam: its length, crawl, stand (ticks) and where it stands (px into it); NaN = none. */
  readonly planLength: number;
  readonly crawl: number;
  readonly planHold: number;
  readonly holdAt: number;
  /** Plan distance where it began (the plan's jam). */
  private start = NaN;
  private held = false;
  /** Revision R: the short route's final jam (never clears, no waves; see the header). */
  readonly final: boolean;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 0;
    this.hitbox = { x: -4, y: -4, w: 8, h: 8 };
    this.despawnMargin = Infinity;
    this.planLength = paramNum(p, 'length', NaN);
    this.crawl = Math.max(0.2, paramNum(p, 'crawl', JAM.crawl));
    this.planHold = Math.max(0, paramNum(p, 'hold', 0));
    this.holdAt = Math.max(0, paramNum(p, 'holdAt', 0));
    this.holdTicks = Math.max(60, paramNum(p, 'ticks', JAM.hold));
    const planned = !Number.isNaN(this.planLength);
    this.carCount = Math.max(0, Math.min(12, Math.round(paramNum(p, 'cars', planned ? 0 : 8))));
    this.waves = Array.isArray(p.waves) ? (p.waves as unknown[]).filter(Array.isArray).map((w) => (w as JamWaveEntry[]).filter((e) => e && typeof e.id === 'string')) : [];
    this.after = Array.isArray(p.after) ? (p.after as JamWaveEntry[]).filter((e) => e && typeof e.id === 'string') : [];
    this.seed = paramNum(p, 'seed', Math.round(x));
    this.final = p.final === true;
    if (this.final) {
      // No waves in the final jam (spec §R.4).
      this.waves.length = 0;
      this.after.length = 0;
    }
    this.addTag(RING_ENTITY.jam);
  }

  /** The jam's speed cap now (null = none). */
  private cap(v: number | null): void {
    ringOf(this.world)?.limitSpeed('jam', v);
  }

  override update(): void {
    const jam = jamOf(this.world);
    if (jam.owner && jam.owner !== this && jam.owner.alive) {
      // One jam at a time (the plan never overlaps them): this one is dropped.
      this.remove();
      return;
    }
    jam.owner = this;
    const cam = this.world.camera;
    this.x = cam.x + cam.w / 2;
    this.t++;
    const ring = ringOf(this.world);
    const road = ring?.roadSpeed ?? 0;
    if (this.final) {
      this.finalJam(jam, ring?.planDist ?? 0);
      return;
    }
    if (!Number.isNaN(this.planLength)) {
      this.planned(jam, ring?.planDist ?? 0);
      return;
    }
    switch (this.phase) {
      case 'warn':
        if (this.t === 1) this.world.spawn(RING_ENTITY.gantry, cam.right + 48, laneY(2), { jam: true });
        jam.level = Math.min(0.4, jam.level + JAM.rise);
        this.cap(2.2);
        if (this.t >= JAM.warnTicks) {
          this.spawnTail();
          this.set('brake');
        }
        break;
      case 'brake': {
        jam.level = Math.min(0.85, jam.level + JAM.rise);
        let parked = true;
        for (let i = 0; i < this.cars.length; i++) {
          const c = this.cars[i];
          if (c.alive && c instanceof RingCar && !c.parked) parked = false;
        }
        this.cap(parked || this.t > JAM.brakeMax ? 0 : JAM.crawl);
        if ((parked || this.t > JAM.brakeMax) && road < 0.05) this.set('hold');
        break;
      }
      case 'hold':
        jam.level = Math.min(1, jam.level + JAM.rise);
        this.cap(0);
        this.runWaves();
        if (this.t >= this.holdTicks || (this.waves.length > 0 && this.wavesDone() && this.t >= JAM.minHold)) this.clear();
        break;
      case 'clear':
        this.cap(null);
        jam.level = Math.max(0, jam.level - JAM.fall);
        if (jam.level <= 0) {
          this.set('done');
          jam.owner = null;
          this.remove();
        }
        break;
      default:
        break;
    }
  }

  /** The plan's jam (see the header): crawl, the stand at `holdAt`, crawl, clear at `length`. */
  private planned(jam: { level: number; owner: Entity | null }, d: number): void {
    if (Number.isNaN(this.start)) {
      this.start = d;
      this.set('crawl');
      if (this.carCount > 0) this.spawnTail();
    }
    const into = d - this.start;
    switch (this.phase) {
      case 'crawl':
        jam.level = Math.min(0.85, jam.level + JAM.rise);
        this.cap(this.crawl);
        if (!this.held && this.planHold > 0 && into >= this.holdAt) {
          this.held = true;
          this.set('hold');
        } else if (into >= this.planLength) this.clear();
        break;
      case 'hold':
        jam.level = Math.min(1, jam.level + JAM.rise);
        this.cap(0);
        this.runWaves();
        // The stand lasts the plan's ticks (and as long as a wave is alive, up to the timeout).
        if ((this.t >= this.planHold && this.wavesDone()) || this.t >= Math.max(this.planHold, this.holdTicks) * 2) {
          this.set('crawl');
          this.spawnWave(this.after);
        }
        break;
      case 'clear':
        this.cap(null);
        jam.level = Math.max(0, jam.level - JAM.fall);
        if (jam.level <= 0) {
          this.set('done');
          jam.owner = null;
          this.remove();
        }
        break;
      default:
        break;
    }
  }

  /**
   * The final jam (revision R): the FILE / BLOKKADE gantry and the tail on the first tick, the
   * crawl to the chunk's end (or `JAM.brakeMax` ticks without a plan), then the stand for good.
   */
  private finalJam(jam: { level: number; owner: Entity | null }, d: number): void {
    if (Number.isNaN(this.start)) {
      this.start = d;
      this.set('crawl');
      const cam = this.world.camera;
      this.world.spawn(RING_ENTITY.gantry, cam.right + 48, laneY(2), { signs: ['x', 'x', 'x', 'x'], drip: 'file' });
      if (this.carCount > 0) this.spawnTail();
    }
    const into = d - this.start;
    if (this.phase === 'crawl') {
      jam.level = Math.min(0.85, jam.level + JAM.rise);
      this.cap(this.crawl);
      const end = Number.isNaN(this.planLength) ? into >= JAM.brakeMax * this.crawl : into >= this.planLength;
      if (end) this.set('hold');
    } else {
      // The standing queue: it never clears.
      this.phase = 'hold';
      jam.level = Math.min(1, jam.level + JAM.rise);
      this.cap(0);
    }
  }

  private set(p: JamPhase): void {
    this.phase = p;
    this.t = 0;
  }

  /** End the hold now: the cap goes, the end-of-restrictions gantry comes in (never the final jam). */
  clear(): void {
    if (this.final || this.phase === 'clear' || this.phase === 'done') return;
    this.set('clear');
    this.cap(null);
    const cam = this.world.camera;
    this.world.spawn(RING_ENTITY.gantry, cam.right + 64, laneY(2), { limit: 'end' });
    this.world.audio.sfx('ring/horns');
  }

  /** The jam's tail: two cars per open lane, standing in front of the wagons with gaps. */
  private spawnTail(): void {
    const rng = ringRng(this.seed, 'ring/jam');
    const cam = this.world.camera;
    const open = ringOf(this.world)?.lanesOpenAt(cam.right) ?? 4;
    const wagons = drivenWagons(this.world);
    const perLane = Math.max(1, Math.ceil(this.carCount / open));
    let made = 0;
    for (let lane = 1; lane <= open && made < this.carCount; lane++) {
      // The first stand clears every wagon in this lane by a car's gap.
      let x = JAM.standX + rng.int(0, JAM.spread);
      for (const w of wagons) if (nearestLane(w.y) === lane) x = Math.max(x, w.x - cam.x + WAGON_W / 2 + 34);
      for (let k = 0; k < perLane && made < this.carCount; k++) {
        const model: RingCarModel = lane >= 3 && rng.chance(0.3) ? rng.pick(['van', 'camper', 'box-truck'] as const) : rng.pick(['hatch', 'estate', 'taxi', 'hatch', 'van'] as const);
        const half = CAR_GEO[model].len / 2;
        const stand = x + half;
        if (stand - half > cam.w + 120) break;
        const car = this.world.spawn(RING_ENTITY.car, cam.right + 40 + half + k * 150 + rng.int(0, 40), laneY(lane), {
          model,
          colour: rng.int(0, 10),
          stopAt: stand,
        });
        this.cars.push(car);
        made++;
        // The next car stands behind the gap a wagon fits in.
        x = stand + half + WAGON_W + 20 + rng.int(0, 40);
      }
    }
    this.world.audio.sfx('ring/horns');
  }

  /**
   * The waves are over: every wave spawned and none of its members still holds the stand. A member
   * that has been off screen for `JAM.offscreenHold` ticks in a row (stuck behind a wagon, or gone
   * ahead) no longer holds it (GDD 1.5: no stand without an enemy on screen).
   */
  private wavesDone(): boolean {
    return this.waveIdx >= this.waves.length && !this.waveHolds();
  }

  /** A live wave member that holds the stand (see `wavesDone`); counts the off-screen ticks. */
  private waveHolds(): boolean {
    let alive = false;
    let seen = false;
    for (let i = 0; i < this.waveLive.length; i++) {
      const e = this.waveLive[i];
      if (!e.alive) continue;
      alive = true;
      if (this.world.onScreen(e, 0)) seen = true;
    }
    this.offT = !alive || seen ? 0 : this.offT + 1;
    return alive && this.offT < JAM.offscreenHold;
  }

  /** Spawn the next wave when the last one is gone (unknown ids are skipped). */
  private runWaves(): void {
    if (this.waveIdx >= this.waves.length) return;
    if (this.waveHolds()) return;
    const wave = this.waves[this.waveIdx++];
    this.waveLive = this.spawnWave(wave);
    this.offT = 0;
  }

  /** Spawn the members of a wave (from behind the left edge or ahead of the right one). */
  private spawnWave(wave: readonly JamWaveEntry[]): Entity[] {
    const out: Entity[] = [];
    const cam = this.world.camera;
    for (const s of wave) {
      if (!hasEntity(s.id)) continue;
      const x = s.from === 'behind' ? cam.x - 32 - (s.dx ?? 0) : cam.right + 32 + (s.dx ?? 0);
      out.push(this.world.spawn(s.id, x, laneY(s.lane ?? 3), s.params ?? NO_PARAMS));
    }
    return out;
  }

  override onRemove(): void {
    const jam = jamOf(this.world);
    if (jam.owner === this) {
      jam.owner = null;
      jam.level = 0;
      this.cap(null);
    }
  }

  override draw(): void {}
}

defineEntity(RING_ENTITY.jam, (w, x, y, p) => new RingJam(w, x, y, p), {
  category: 'hazard',
  description: 'The traffic jam controller: 50 on the matrix, the traffic brakes, the road stops, waves, then it clears (params ticks, cars, waves, seed; final: the short route\'s last jam, never clears).',
});
