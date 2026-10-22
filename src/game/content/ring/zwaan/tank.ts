/**
 * `ring-zwaan-tank` — the ZWAAN train's TANKER (bar name ZWAAN TANKWAGEN, `FRITUURVET` on the tank;
 * docs/design/ring.md §R.3, part 3 of 5). A `ZwaanPart` (part.ts): rear end = its anchor, 156 px
 * forward its front; lanes 1–2.
 *
 * ATTACKS (each after a tell of ≥ 18 ticks on screen; `mode` 'tell-X' → 'X' for the sim's watch):
 * - SLICK: the dump hose swings out and gurgles (the tell: the hose, the brake lights, fat dripping),
 *   then it sprays frying fat across into a lane for `slickTicks`: a `ring-zwaan-slick` lies on the
 *   road there (world-fixed: it drifts back with the road). A wagon on it SLIDES (`Wagon.slip`, the
 *   additive opt-in: the steering lags about 40 ticks after it leaves the slick). No cell cost.
 * - FLAME TRAIL: a hot valve hisses and sparks (the tell: the valve glows; a glistening fat streak
 *   runs back along the target lane, `ring-zwaan-flame` in its `fuse` state), then the streak
 *   catches: the flames run back along the lane from the tanker's rear and burn out. A wagon in the
 *   flames pays a cell (fire). Shooting a valve heats it (`heat`): a hot valve flares after its tell;
 *   in phase 2 (HP ≤ 55 % or a valve broken) a flare comes after every slick.
 * - one lane always stays free (the target wagon's lane first; never the last free lane).
 *
 * PARTS (pool model; side by side, never overlapping): 0 `tank` (x 17 … 70, × 1: part 0 is what the
 * bot aims at, it never breaks), 1–3 `valve-a/b/c` (× 1.5, own HP, passed on; the rear one is the
 * dump valve), 4 `tank-mid`, 5 `tank-front` (× 1). A broken valve (+1000) snaps off
 * and drips; it no longer flares.
 *
 * BEATEN (2,000 points): uncouple → brake → a big bloodless FIREBALL → the tank comes off its
 * saddles and ROLLS onto the hard shoulder (`roll` frames) → the drop → the bare chassis and the
 * tank drop back.
 *
 * Params: `hp`, `hpScale`, `lane`, `rate`, `index`.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import type { BossPart } from '../../../boss';
import { dust, explosion, hitSpark, smokeTrail, steamPuff } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { defineRingArt } from '../../../ring/art-def';
import { ringOf, RingEntity } from '../../../ring/entity';
import { DEPTH_HALF, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { drivenWagons, slabsTouch, wagonSlab } from '../traffic/road-kit';
import { ZWAAN, ZWAAN_NAMES, defineZwaanPart } from './api';
import { bodySpark, busyLanes, pickLanes } from './autos-kit';
import { drawZwaanCoupling, drawZwaanDolly, drawZwaanHitch, drawZwaanShadow, drawZwaanWheels, pushWagonsOut, uncoupleFx, ZWAAN_KIT_ART, ZWAAN_PACE, zwaanRate } from './kit';
import { ZwaanPart, zwaanSlab } from './part';
import { TANK, TANK_ART, TANK_ID, TANK_SPR, TILE } from './tank-geo';

export const SLICK_ID = 'ring-zwaan-slick';
export const FLAME_ID = 'ring-zwaan-flame';

/** Tuning (ticks, px, px/tick; HP before difficulty × co-op). */
export const TANK_AI = {
  /**
   * The pool (the integrator's momentum tuning, kit.ts `ZWAAN_PACE`; was 0.83 × the trailer HP: the
   * weak-point bot took 43–50 s); its rate (kit.ts `zwaanRate`) keeps the best gun at ≥ 30 s.
   */
  hp: ZWAAN_PACE.tankHp,
  valve: 360,
  valveMul: 1.5,
  tankMul: 1,
  rate: zwaanRate(ZWAAN_PACE.tankHp),
  /** Telegraph bases (× difficulty, never below 18). */
  slickTell: 30,
  flameTell: 34,
  /** Spraying ticks (the slick grows as the tanker drives on). */
  slickTicks: 44,
  /** Heat (HP dealt to a valve since its last flare) that makes it flare; the gap between flares. */
  heat: 70,
  flareGap: 200,
  /** Pauses (× the difficulty's fire interval). */
  pause: 80,
  pause2: 50,
  phase2: 0.55,
  score: ZWAAN.score.trailer,
} as const;

/** Tuning of the slick and the flame trail. */
export const SLICK_AI = {
  /** A wagon on the slick slides this long (the steering lags) after it leaves it. */
  slip: 40,
  /** The streak's and the flames' length on the road (px) and their run (px/tick, screen). */
  flameLen: 210,
  flameRun: 5,
  /** The flames burn this long at full length, then die back. */
  burn: 50,
  die: 24,
  /** One cell for a wagon in the flames (the wagon's own hit invulnerability spaces it). */
  cost: 1,
} as const;

export interface TankAttackTrace {
  attack: 'slick' | 'flame';
  tell: number;
  fire: number;
  seen: number;
  lane: number;
  valve?: number;
}

/** Part indexes: the valves are 1–3 (`valve i` = part i + 1); 0, 4, 5 are the tank. */
const P_VALVE = 1;
const drawOpts: DrawOpts = {};
const NO_BOXES: readonly Rect[] = [];

// =============================================================================================
// The slick
// =============================================================================================

/**
 * Frying fat on the road (world-fixed): from `x0` to `x1` in its lane; it grows at the front while
 * its tanker sprays (`host`), then lies there and drifts back with the road. A driven wagon whose
 * slab touches it slips (`Wagon.slip`). Not solid, not shootable.
 */
export class ZwaanSlick extends RingEntity {
  x0: number;
  x1: number;
  host: TankPart | null;
  /** Wagons that slid on it (tests). */
  slid = 0;
  private readonly slab: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly wagonsSlid = new WeakSet<Wagon>();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, laneY(nearestLane(y)));
    this.x0 = this.x1 = x;
    this.host = p.host instanceof TankPart ? p.host : null;
    this.team = 'neutral';
    this.z = 2;
    this.vx = 0;
    this.despawnMargin = 400;
    this.hitbox = { x: 0, y: -6, w: 1, h: 12 };
    this.addTag(SLICK_ID);
  }

  busyLane(): number {
    return nearestLane(this.y);
  }

  /** The sprayer adds fat up to world x `x`. */
  grow(x: number): void {
    this.x1 = Math.max(this.x1, x);
    this.x = (this.x0 + this.x1) / 2;
    this.hitbox.x = this.x0 - this.x;
    this.hitbox.w = Math.max(1, this.x1 - this.x0);
  }

  override hurtboxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    const s = this.slab;
    s.x = this.x0;
    s.w = Math.max(1, this.x1 - this.x0);
    s.y = this.y - DEPTH_HALF + 2;
    s.h = DEPTH_HALF * 2 - 4;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!slabsTouch(wagonSlab(w), s)) continue;
      w.slip(SLICK_AI.slip);
      if (!this.wagonsSlid.has(w)) {
        this.wagonsSlid.add(w);
        this.slid++;
        this.world.audio.sfx('ring/zwaan/fat-skid');
      }
    }
    if (this.x1 < this.world.camera.x - 16) this.remove();
  }

  override draw(r: Renderer): void {
    const y = Math.round(this.y);
    const n = Math.max(1, Math.ceil((this.x1 - this.x0) / TILE));
    drawOpts.flipX = false;
    drawOpts.flash = false;
    const cam = this.world.camera;
    for (let i = 0; i < n; i++) {
      const tx = this.x0 + i * TILE;
      if (tx > cam.right + 4 || tx + TILE < cam.x - 4) continue;
      const f = i === 0 ? 0 : i === n - 1 ? 4 : 1 + ((Math.floor(this.x0) + i * 7) % 3);
      r.sprite(TANK_SPR.slick, f, Math.round(tx), y, drawOpts);
    }
  }
}

defineEntity(SLICK_ID, (w, x, y, p) => new ZwaanSlick(w, x, y, p), {
  category: 'hazard',
  description: 'Frying fat from the ZWAAN tanker on the road: a wagon on it slides (the steering lags about 40 ticks); no cost (params host).',
});

// =============================================================================================
// The flame trail
// =============================================================================================

export type FlameState = 'fuse' | 'run' | 'burn' | 'die';

/**
 * The flame trail (see the header): it keeps pace with the road (a screen-fixed span behind the
 * tanker's rear, `ax` = the screen x of its front end). `fuse`: a glistening streak grows back along
 * the lane (the tell); `run`: the flames run back over it; `burn`; `die`: they shrink back to the
 * front. A driven wagon in the burning part pays a cell (fire). Params: `ax` (screen x of the front),
 * `len`, `fuse` (ticks of the streak).
 */
export class ZwaanFlame extends RingEntity {
  state: FlameState = 'fuse';
  t = 0;
  /** Screen x of the front end; the streak's and the flames' reach back from it (px). */
  ax: number;
  readonly len: number;
  readonly fuse: number;
  streak = 0;
  fire = 0;
  /** Its back end burns down to here (die). */
  front = 0;
  /** Wagons it burned (tests). */
  burned = 0;
  private readonly slab: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, laneY(nearestLane(y)));
    this.ax = paramNum(p, 'ax', x - world.camera.x);
    this.len = paramNum(p, 'len', SLICK_AI.flameLen);
    this.fuse = Math.max(18, Math.round(paramNum(p, 'fuse', 30)));
    this.team = 'enemy';
    this.z = 3;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -1, y: -16, w: 2, h: 16 };
    this.addTag(FLAME_ID);
  }

  busyLane(): number {
    return nearestLane(this.y);
  }

  /** Burning now (the attack is live). */
  get burning(): boolean {
    return this.state !== 'fuse' && this.fire - this.front > 1;
  }

  override hurtboxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    this.t++;
    const cam = this.world.camera;
    this.vx = ringOf(this.world)?.roadSpeed ?? 0;
    this.x = cam.x + this.ax - this.len / 2;
    switch (this.state) {
      case 'fuse':
        this.streak = Math.min(this.len, (this.len * this.t) / Math.max(1, this.fuse - 4));
        if (this.t % 6 === 0) this.world.audio.sfx('ring/zwaan/fat-hiss', { vol: 0.5 });
        if (this.t >= this.fuse) {
          this.state = 'run';
          this.t = 0;
          this.world.audio.sfx('ring/zwaan/flame-whoosh');
        }
        break;
      case 'run':
        this.fire = Math.min(this.len, this.fire + SLICK_AI.flameRun);
        if (this.fire >= this.len) {
          this.state = 'burn';
          this.t = 0;
        }
        break;
      case 'burn':
        if (this.t >= SLICK_AI.burn) {
          this.state = 'die';
          this.t = 0;
        }
        break;
      case 'die':
        this.front = Math.min(this.fire, this.front + this.len / SLICK_AI.die);
        if (this.front >= this.fire) {
          this.remove();
          return;
        }
        break;
    }
    if (this.burning) this.scorch();
    if (this.state !== 'fuse' && this.t % 7 === 0) smokeTrail(this.world, cam.x + this.ax - this.front - this.world.fxRng.range(0, Math.max(1, this.fire - this.front)), this.y - 18, true);
  }

  /** A wagon in the burning part pays a cell. */
  private scorch(): void {
    const s = this.slab;
    const cam = this.world.camera;
    s.x = cam.x + this.ax - this.fire;
    s.w = this.fire - this.front;
    s.y = this.y - DEPTH_HALF + 2;
    s.h = DEPTH_HALF * 2 - 4;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.invulnTicks > 0 || !slabsTouch(wagonSlab(w), s)) continue;
      this.world.damage(w, { amount: SLICK_AI.cost, kind: 'fire', dirX: -1, source: this, tags: ['fire'] });
      this.burned++;
    }
  }

  override draw(r: Renderer): void {
    const cam = this.world.camera;
    const y = Math.round(this.y);
    const fx = cam.x + this.ax;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    if (this.state === 'fuse' || this.fire < this.len) {
      // The streak (what is not burning yet).
      for (let d = this.fire; d < this.streak; d += TILE) r.sprite(TANK_SPR.streak, Math.floor(this.world.tick / 6) % 2, Math.round(fx - d - TILE), y, drawOpts);
    }
    for (let d = this.front; d < this.fire; d += TILE) {
      const f = (Math.floor(this.world.tick / 4) + Math.floor(d / TILE)) % 4;
      r.sprite(TANK_SPR.flame, f, Math.round(fx - d - TILE), y + 1, drawOpts);
    }
  }
}

defineEntity(FLAME_ID, (w, x, y, p) => new ZwaanFlame(w, x, y, p), {
  category: 'hazard',
  description: 'The ZWAAN tanker\'s flame trail: a fat streak (the tell), then flames run back along the lane; 1 cell to a wagon in them (params ax, len, fuse).',
});

// =============================================================================================
// The tanker
// =============================================================================================

export class TankPart extends ZwaanPart {
  /** Heat per valve (HP dealt since its last flare) and its state: 0 shut, 1 hot (a tell), 2 broken. */
  readonly heat: number[] = [0, 0, 0];
  readonly valveLook: number[] = [0, 0, 0];
  /** The hose: 0 stowed, 1 out (the tell), 2 spraying; the slick being laid. */
  hose = 0;
  slick: ZwaanSlick | null = null;
  sprayLane = 0;
  mode: 'cruise' | 'tell-slick' | 'slick' | 'tell-flame' | 'flame' = 'cruise';
  readonly trace: TankAttackTrace[] = [];
  /** The tank rolled off (the beaten sequence): its plane-y offset, the roll frame (−1 = on). */
  rollF = -1;
  rollDy = 0;
  private lastFlare = -9999;
  private readonly touched = new WeakMap<Wagon, number>();
  private readonly busy = new Set<number>();
  private spraySeq = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: TANK_ART, name: ZWAAN_NAMES[TANK_ID], hp: TANK_AI.hp, score: TANK_AI.score, length: TANK.length, height: TANK.height });
    const k = paramNum(p, 'hpScale', 1);
    const base = Math.max(1, Math.round(paramNum(p, 'hp', TANK_AI.hp) * k));
    this.dmgRate = Math.max(0, paramNum(p, 'rate', TANK_AI.rate)) * (this.maxHp / base);
    const vh = Math.max(1, Math.round(TANK_AI.valve * k));
    // Side by side, never overlapping (ties go to the lowest index): part 0 is a wide tank section
    // (the bot aims at part 0; it never breaks), 1–3 the valves, 4–5 the rest of the tank.
    const V = TANK.valves;
    const hv = TANK.valveHalf;
    this.addPart('tank', { box: zwaanSlab(V[0] + hv, V[1] - hv), multiplier: TANK_AI.tankMul });
    const names = ['valve-a', 'valve-b', 'valve-c'];
    V.forEach((vx, i) => this.addPart(names[i], { box: zwaanSlab(i === 0 ? -2 : vx - hv, vx + hv), hp: vh, shared: true, multiplier: TANK_AI.valveMul }));
    this.addPart('tank-mid', { box: zwaanSlab(V[1] + hv, V[2] - hv), multiplier: TANK_AI.tankMul });
    this.addPart('tank-front', { box: zwaanSlab(V[2] + hv, TANK.length), multiplier: TANK_AI.tankMul });
    this.hitbox = { x: 0, y: -TANK.height, w: TANK.length, h: TANK.height };
    this.phases = [
      { at: 1, name: 'slick', pattern: (b) => b.phaseFat(false) },
      { at: TANK_AI.phase2, when: (b) => b.brokenCount() > 0, name: 'fire', onEnter: (b) => b.resetAttack(), pattern: (b) => b.phaseFat(true), resume: (b) => b.phaseFat(true) },
    ];
  }

  /** The hottest flare-ready valve (−1: none). */
  hotValve(force: boolean): number {
    let best = -1;
    for (let i = 0; i < 3; i++) {
      if (this.parts[i + P_VALVE].destroyed) continue;
      if (best < 0 || this.heat[i] > this.heat[best]) best = i;
    }
    if (best < 0) return -1;
    if (force) return best;
    return this.heat[best] >= TANK_AI.heat * (this.maxHp / TANK_AI.hp) && this.world.tick - this.lastFlare >= TANK_AI.flareGap ? best : -1;
  }

  // ------------------------------------------------------------------------------- phases

  *phaseFat(fire: boolean): ScriptGen {
    yield 24;
    for (;;) {
      const hot = this.hotValve(false);
      if (hot >= 0) yield* this.flare(hot);
      else yield* this.spray();
      yield this.recoveryFor(fire ? TANK_AI.pause2 : TANK_AI.pause);
      if (fire) {
        const v = this.hotValve(true);
        if (v >= 0) {
          yield* this.flare(v);
          yield this.recoveryFor(TANK_AI.pause2);
        }
      }
    }
  }

  private mark(attack: TankAttackTrace['attack'], lane: number): TankAttackTrace {
    const tr: TankAttackTrace = { attack, tell: this.world.tick, fire: -1, seen: 0, lane };
    this.trace.push(tr);
    return tr;
  }

  private inView(): boolean {
    return this.world.camera.containsPoint(this.x + 10, this.y - 20, -8);
  }

  private lanesFor(): number[] {
    busyLanes(this.world, [SLICK_ID, FLAME_ID, 'ring-zwaan-car', 'ring-zwaan-animal', 'ring-cargo'], this.busy);
    return pickLanes(this.world, 1, this.busy, this.x, this.y, (k) => this.world.rng.int(0, k - 1));
  }

  /** SLICK (see the header). */
  *spray(): ScriptGen {
    for (let g = 0; g < 240 && !this.inView(); g++) yield 1;
    const lanes = this.lanesFor();
    if (lanes.length === 0 || !this.inView()) {
      yield 30;
      return;
    }
    const tr = this.mark('slick', lanes[0]);
    this.mode = 'tell-slick';
    this.hose = 1;
    this.brakeT = 9999;
    this.world.audio.sfx('ring/zwaan/valve');
    const T = this.telegraphFor(TANK_AI.slickTell);
    for (let i = 0; i < T; i++) {
      tr.seen++;
      if (i % 10 === 0) this.world.audio.sfx('ring/zwaan/fat-hiss', { vol: 0.35, pitch: 0.8 });
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'slick';
    this.hose = 2;
    this.sprayLane = lanes[0];
    this.spraySeq = 0;
    const sx = this.x + TANK.nozzle[0] - 8;
    const s = this.world.spawn(SLICK_ID, sx, laneY(lanes[0]), { host: this });
    this.slick = s instanceof ZwaanSlick ? s : null;
    this.world.audio.sfx('ring/zwaan/fat-spray');
    for (let i = 0; i < TANK_AI.slickTicks; i++) {
      this.slick?.grow(this.x + TANK.nozzle[0] - 4);
      this.spraySeq++;
      yield 1;
    }
    this.endSpray();
  }

  private endSpray(): void {
    this.slick = null;
    this.hose = 0;
    this.sprayLane = 0;
    this.brakeT = 0;
    this.mode = 'cruise';
  }

  /** FLAME TRAIL from valve `v` (see the header). */
  *flare(v: number): ScriptGen {
    for (let g = 0; g < 240 && !this.inView(); g++) yield 1;
    const lanes = this.lanesFor();
    if (lanes.length === 0 || !this.inView() || this.parts[v + P_VALVE].destroyed) {
      this.heat[v] = 0;
      yield 30;
      return;
    }
    const tr = this.mark('flame', lanes[0]);
    tr.valve = v;
    this.mode = 'tell-flame';
    this.valveLook[v] = 1;
    this.heat[v] = 0;
    this.lastFlare = this.world.tick;
    this.world.audio.sfx('ring/zwaan/valve', { pitch: 1.3 });
    const T = this.telegraphFor(TANK_AI.flameTell);
    const cam = this.world.camera;
    const ax = this.x - cam.x - 2;
    this.world.spawn(FLAME_ID, this.x, laneY(lanes[0]), { ax, fuse: T });
    for (let i = 0; i < T; i++) {
      tr.seen++;
      if (i % 4 === 0) hitSpark(this.world, this.x + TANK.valves[v], this.y + TANK.valveY, i % 8 === 0 ? -1 : 1);
      if (i % 9 === 0) steamPuff(this.world, this.x + TANK.valves[v], this.y + TANK.valveY + 2, -0.3, -0.4);
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'flame';
    yield 30;
    if (this.valveLook[v] === 1) this.valveLook[v] = 0;
    this.mode = 'cruise';
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    super.think();
    // The spray: gobs of fat arc from the nozzle into the lane.
    if (this.hose === 2 && this.spraySeq % 3 === 0 && this.sprayLane > 0) dust(this.world, this.x + TANK.nozzle[0] - 10, laneY(this.sprayLane), 1);
    if (this.state === 'fight' || this.state === 'intro') pushWagonsOut(this, this.x, this.x + this.length, this.touched);
  }

  override onHit(d: Damage, part = 0): boolean {
    const before = this.hp;
    const hit = super.onHit(d, part);
    const v = part - P_VALVE;
    if (hit && this.state === 'fight' && v >= 0 && v < 3 && !this.parts[part].destroyed) this.heat[v] += Math.max(0, before - this.hp);
    if (hit && this.state === 'fight' && (v < 0 || v >= 3)) {
      if (this.world.tick % 6 === 0) this.world.audio.sfx('ring/dent', { vol: 0.45, pitch: 1.2 });
      bodySpark(this.world, this.partRect(this.parts[part]), this.y, d.dirX);
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    const v = p.index - P_VALVE;
    if (v >= 0 && v < 3) {
      this.valveLook[v] = 2;
      this.heat[v] = 0;
      this.world.audio.sfx('ring/zwaan/valve', { pitch: 0.7 });
      steamPuff(this.world, this.x + TANK.valves[v], this.y + TANK.valveY, 0, -0.5);
    }
    this.checkPhases();
  }

  protected override cutAttack(): boolean {
    this.resetAttack();
    return true;
  }

  /** End a running attack's look (a stagger, a new phase): the hose in, the valves calm. */
  resetAttack(): void {
    this.endSpray();
    for (let i = 0; i < 3; i++) if (this.valveLook[i] === 1) this.valveLook[i] = 0;
  }

  // ------------------------------------------------------------------------------- beaten

  protected override *beatenSequence(): ScriptGen {
    const w = this.world;
    const B = ZWAAN.beaten;
    this.resetAttack();
    w.audio.sfx('ring/lorry-screech');
    for (let t = 0; t < B.uncouple; t++) {
      this.beatenMove(0);
      uncoupleFx(w, this.frontX, this.y, t);
      yield 1;
    }
    this.beaten = 'brake';
    this.brakeT = 9999;
    for (let t = 0; t < B.brake; t++) {
      this.beatenMove((B.brakeRel * t) / B.brake);
      if (t % 4 === 0) dust(w, this.x + 30, this.y, 2);
      if (t % 5 === 0) explosion(w, this.x + 20 + ((t * 37) % 110), this.y - 30, 's', { silent: true });
      yield 1;
    }
    // The fireball (bloodless: fire and smoke), then the tank rolls onto the hard shoulder.
    this.beaten = 'tip';
    const cx = this.x + this.length / 2;
    explosion(w, cx, this.y - 36, 'l', { debris: 'metal' });
    explosion(w, cx - 40, this.y - 30, 'm', { silent: true });
    explosion(w, cx + 40, this.y - 40, 'm', { silent: true });
    w.audio.sfx('ring/zwaan/fireball');
    w.camera.shake(5, 22);
    this.dropItem();
    const y0 = this.y;
    const yS = SHOULDER_TOP + 3;
    const T = 44;
    for (let t = 0; t < T; t++) {
      const k = (t + 1) / T;
      this.rollF = Math.min(3, Math.floor(k * 4));
      this.rollDy = (yS - y0) * (k * k * (3 - 2 * k));
      this.beatenMove(B.brakeRel);
      if (t % 5 === 0) smokeTrail(w, this.x + this.length / 2, this.y + this.rollDy - 30, true);
      if (t === T - 1) {
        dust(w, cx - 50, yS, 8);
        dust(w, cx + 50, yS, 8);
        w.audio.sfx('ring/lorry-slam', { pitch: 0.8 });
        w.camera.shake(3, 10);
      }
      yield 1;
    }
    this.beaten = 'wreck';
    for (let t = 0; t < B.maxTicks && this.x + this.length > this.world.camera.x - 8; t++) {
      this.beatenMove(B.dropRel);
      if (t % 8 === 0) smokeTrail(w, this.x + this.length * 0.5, this.y + this.rollDy - 30, true);
      yield 1;
    }
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    drawTank(r, this, this.x, this.y, this.world.tick);
  }
}

interface TankLook {
  readonly valveLook: readonly number[];
  readonly hose: number;
  readonly sprayLane: number;
  readonly rollF: number;
  readonly rollDy: number;
  readonly damageState: number;
  readonly brakeT: number;
  readonly flashTicks: number;
  readonly staggerTicks: number;
  readonly parts: readonly BossPart[];
  readonly beaten: string | null;
}

const WAITING: TankLook = { valveLook: [0, 0, 0], hose: 0, sprayLane: 0, rollF: -1, rollDy: 0, damageState: 0, brakeT: 0, flashTicks: 0, staggerTicks: 0, parts: [], beaten: null };

/** Draw the tanker with its rear at world (x0, y0) (the live part and the waiting decor). */
export function drawTank(r: Renderer, a: TankLook, x0: number, y0: number, tick: number): void {
  const sh = a.staggerTicks > 0 && Math.floor(tick / 2) % 2 === 0 ? 1 : 0;
  const x = Math.round(x0) + sh;
  const y = Math.round(y0);
  const fl = (i: number): boolean => (a.parts[i]?.flash ?? 0) > 0 && tick % 2 === 0;
  const L = TANK.length;
  drawOpts.flipX = false;
  if (a.rollF >= 0) {
    // The wreck: the bare chassis, the tank rolling onto the shoulder (drawn by the y order: after).
    drawZwaanShadow(r, x, y, L, 0.3);
    drawZwaanDolly(r, x + L, y, 0);
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(TANK_SPR.chassis, 0, x, y, drawOpts);
    drawZwaanWheels(r, x, y, TANK.wheels, 0);
    drawZwaanCoupling(r, x + L, y, true);
    drawOpts.flipX = false;
    r.sprite(TANK_SPR.roll, a.rollF, x + Math.round((TANK.barrel.x0 + TANK.barrel.x1) / 2), y + Math.round(a.rollDy), drawOpts);
    return;
  }
  drawZwaanShadow(r, x, y, L);
  drawZwaanDolly(r, x + L, y, x0);
  drawOpts.flipX = false;
  // The big body never flashes white (it reads as a glitch): the hits spark and clang.
  drawOpts.flash = false;
  r.sprite(TANK_SPR.body(Math.max(0, Math.min(2, a.damageState))), 0, x, y, drawOpts);
  for (let i = 0; i < 3; i++) {
    drawOpts.flash = fl(i + P_VALVE);
    const f = a.valveLook[i] ?? 0;
    r.sprite(TANK_SPR.valve, f === 1 && Math.floor(tick / 4) % 2 === 1 ? 0 : f, x + TANK.valves[i], y + TANK.valveY, drawOpts);
  }
  drawOpts.flash = fl(P_VALVE);
  r.sprite(TANK_SPR.hose, a.hose, x, y, drawOpts);
  drawOpts.flash = false;
  drawZwaanWheels(r, x, y, TANK.wheels, x0);
  drawZwaanCoupling(r, x + L, y, a.beaten !== null);
  drawZwaanHitch(r, x, y);
  drawOpts.flipX = false;
  drawOpts.flash = false;
  // The jet: gobs of fat on an arc from the nozzle across into the spray lane.
  if (a.hose === 2 && a.sprayLane > 0) {
    const nx = x + TANK.nozzle[0] - 8;
    const ny = y + TANK.nozzle[1];
    const ty = laneY(a.sprayLane);
    for (let i = 0; i < 6; i++) {
      const k = ((i + (tick % 6) / 6) / 6) % 1;
      const px = nx - k * 14;
      const py = ny + (ty - ny) * k - Math.sin(k * Math.PI) * 10;
      r.sprite(TANK_SPR.blob, (i + tick) % 3, Math.round(px), Math.round(py), drawOpts);
    }
  }
  if (a.brakeT > 0 && tick % 30 < 26) r.sprite(TANK_SPR.lamps, 0, x + TANK.lampAt[0], y + TANK.lampAt[1], drawOpts);
}

defineEntity(TANK_ID, (w, x, y, p) => new TankPart(w, x, y, p ?? NO_PARAMS), {
  category: 'boss',
  score: TANK_AI.score,
  description: 'ZWAAN TANKWAGEN (the ZWAAN train, part 3; FRITUURVET): frying-fat slicks (the wagon slides) and flame trails from hot valves (params hp, hpScale, lane, rate, index).',
});
defineZwaanPart(TANK_ID, {
  length: TANK.length,
  drawWaiting: (r, x, y, tick) => drawTank(r, WAITING, x, y, tick),
});
defineRingArt(TANK_ID, [`${TANK_ART}/`, ZWAAN_KIT_ART]);

