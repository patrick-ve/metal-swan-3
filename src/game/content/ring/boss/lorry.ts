/**
 * `ring-lorry` — THE TEST MID-BOSS of the ring (docs/design/ring.md §6): a container lorry (our
 * own livery: a white cab with an orange band, a rust-red `ZWAAN` container with a made-up box
 * code; no badge, a made-up plate) that proves the boss hook on a moving road. The real bosses
 * replace it later.
 *
 * The westpoort boss slot spawns it just off the right edge in lane 1 (runner.ts `checkBossSlots`,
 * which also locks the plan until it is no longer alive). It drives in (invulnerable: the wagons
 * catch up with it), sounds its air horns, locks the plan under its own key too
 * (`ringOf(world).lockPlan`) and keeps pace with the camera at its home spot (it drifts a little),
 * so it stays on screen while the road scrolls. It keeps to lanes 1–2 (a boss breaks the lane rule).
 *
 * HP (pool model, GDD §10.0; × difficulty × co-op): the bar is the lorry's HP. Parts (index = the
 * order): 0 `cab` (the weak point, × 1.5; own HP = the pool's, it passes the damage on; the bot aims
 * at part 0), 1 `doors` (the rear door with the loader; own HP, passed on), 2 `wheels` (the trailer
 * bogie; own HP, passed on), 3 `box` (the container over its whole length, × 0.5: it takes what the
 * doors and the bogie let through). Breaking the doors or the wheels is +1000 each and changes the
 * fight; the cab breaking ends it.
 * - Phase 1 `cargo`: CARGO DUMP — the tell (≥ 18 ticks, the doors on screen): the rear door swings
 *   open with a bang, the brake lights glow, the loader hoists a drum over his head; then he throws
 *   2 (HARD 3) drums / crates (`ring-barrel`) into lanes chosen so that at least one open lane stays
 *   free of cargo; they land behind the lorry and roll back along their lanes. The door shuts.
 * - Phase 2 `forklift` (the doors broken, or the HP ≤ 55 %): the bay of the near side drops onto the
 *   road (a ramp, sparks) and a forklift (`ring-forklift`, own HP) drives out and charges along a
 *   lane; a new one comes out a while after one is wrecked (never while adds are held). WEAVE: the
 *   indicator blinks (the tell, ≥ 18 ticks, the cab on screen), then the lorry changes lane 1 ↔ 2
 *   (never into a car; a wagon still beside it then is bumped away, 1 cell). With the wheels shot
 *   off it no longer weaves (it drags on its rims). Cargo dumps go on while the doors live.
 * - Touching it: a wagon that drives into it is pushed out (½ cell; the weave: 1 cell).
 * - The in-world continue staggers it (`Boss.stagger`): a running attack ends cleanly
 *   (`cutAttack`: the door shuts, the loader lowers the drum, the indicator stops) and the phase runs
 *   on after it; a lane change or the panel drop in progress finishes first (`canStagger`).
 * - Death (10,000 points): the plan is unlocked at once (the next waves roll in), the forklift
 *   drives off; the brakes lock, the cab swings toward the camera (the jackknife), the container
 *   slides off onto the hard shoulder and tips onto its side, where it drops a repair (a wagon at
 *   ≤ 6 cells) or a weapon (H, R or L). The wreck stays and drifts back; 'bossDefeated' at the end;
 *   nothing here ends the mission.
 *
 * - The damage rate (review B, 2026-10-21): the pool loses at most `LORRY_AI.rate.perTick` HP per
 *   tick (a bucket of `rate.burst`; both × difficulty × co-op), and it holds at the phase-2 line
 *   until the side panel is down. The pistol (1.9 HP per tick at the cab with every shot on it) never
 *   feels it; the shotgun killed it in 9–12 s and phase 2 hardly showed.
 *
 * Params: `hp` (the base HP), `hpScale` (tests: × every part), `lane` (1 | 2; default its
 * spawn y), `rate` (the damage rate in HP per tick of the base pool; 0 = no limit, for tests that
 * break parts in one hit).
 */
import type { Damage } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { awardScore } from '../../../events';
import { debris, dust, explosion, hitSpark, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, RingEntity, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { DEPTH_HALF, LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, nearestWagon, slabsTouch, tumbleOff, wagonSlab } from '../traffic/road-kit';
import { RingCargo, RingForklift, type CargoKind } from './adds';
import { CARGO_ID, FORKLIFT_ID, LORRY, LORRY_ART, LORRY_ID, LORRY_NAME, PART_X, RIM_R, SPR, WHEEL_R, type Pt } from './geometry';

/** Tuning (ticks, px, px/tick; HP before difficulty × co-op). */
export const LORRY_AI = {
  /** The lorry's HP (the bar); the doors' and the bogie's own HP (they pass damage on). */
  hp: { pool: 2000, doors: 360, wheels: 280 },
  /** Damage multipliers: the cab is the weak point, the container is tough. */
  cabMul: 1.5,
  boxMul: 0.5,
  score: 10_000,
  /** Its home on screen (the anchor's screen x), the drift round it and its period. */
  homeX: 236,
  drift: 14,
  driftPeriod: 520,
  /** The drive in (screen px/tick) and the horn pause after it. */
  introRel: -2.2,
  introHorn: 40,
  cargo: {
    /** Telegraph base (scaled by difficulty, never below 18), gap between dumps (× fire interval). */
    tell: 32,
    every: 150,
    /** Pieces per dump on NORMAL (HARD +1) and ticks between them. */
    n: 2,
    gap: 10,
    /** Flight ticks and the extra arc; where it lands (screen px behind the door). */
    flight: 26,
    arc: 14,
    land: 44,
    /** Rolling screen speeds (slowest … fastest) and every n-th piece is a crate. */
    roll: [-1.7, -2.4] as const,
    crateEvery: 3,
    /** The door stays open after the throw. */
    hold: 30,
  },
  weave: { tell: 36, ticks: 44 },
  /** The side panel drops over this many ticks (the ramp lands at the end). */
  panelTicks: 40,
  forklift: { cool: 240 },
  /** The damage rate: at most `perTick` HP per tick from a bucket of `burst` (× difficulty × co-op). */
  rate: { perTick: 2, burst: 150 },
  /** Phase 2 at this cab HP fraction (or the doors broken). */
  phase2: 0.55,
  /** A wagon pushing against it (½ cell), a weave into it (1 cell); one bump per wagon per this many ticks. */
  touchGap: 24,
} as const;

/** One attack of the fight (tests): its tell tick, its strike tick (−1 = cut), the tell ticks on screen. */
export interface LorryAttackTrace {
  attack: 'cargo' | 'weave';
  tell: number;
  fire: number;
  seen: number;
  lanes?: number[];
}

type LoaderMode = 'stand' | 'lift' | 'throw' | 'gone';

const P_CAB = 0;
const P_DOORS = 1;
const P_WHEELS = 2;
const drawOpts: DrawOpts = {};
const fullSlab: Rect = { x: 0, y: 0, w: 0, h: 0 };
const pt: [number, number] = [0, 0];

/** A part box: a depth slab over [x0, x1) of the lorry. */
function slabBox(x: Pt): Rect {
  return { x: x[0], y: -DEPTH_HALF, w: x[1] - x[0], h: DEPTH_HALF * 2 };
}

export class RingLorry extends Boss implements RingDrawable {
  /** The soft road shadow under it (the runner's shadow pass). */
  shadowW = 176;
  /** Its lane (1 | 2) and a lane change (`weaving`: from → to, ticks). */
  lane: number;
  weaving = false;
  private laneFrom = 1;
  private laneTo = 1;
  private laneT = 0;
  /** It arrived (the plan lock is on). */
  arrived = false;
  private locked = false;
  /** Door: 0 shut … 1 open (and its target); gone after the doors broke. */
  doorOpen = 0;
  doorTarget = 0;
  doorsGone = false;
  /** The side panel: −1 up, 0 … panelTicks dropping, ≥ panelTicks down (the ramp). */
  panelT = -1;
  /** Indicator and brake-light ticks left. */
  blinkT = 0;
  brakeT = 0;
  loader: LoaderMode = 'stand';
  private loaderT = 0;
  wheelsBroken = false;
  /** The forklift out on the road (null: none) and the wait for the next one. */
  forklift: RingForklift | null = null;
  private forkCool = 0;
  /** The damage-rate bucket (HP left, refill per tick, size; refill 0 = no limit). */
  private dmgLeft = 0;
  private dmgRate = 0;
  private dmgBurst = 0;
  /**
   * What it does now, for the sim's fairness watch (headless-ring.ts reads `mode`: a `tell-X` →
   * `X` change is an attack after its tell): 'cruise', 'tell-cargo' → 'cargo', 'tell-weave' → 'weave'.
   */
  mode: 'cruise' | 'tell-cargo' | 'cargo' | 'tell-weave' | 'weave' = 'cruise';
  /** Attacks of the fight (tests). */
  readonly trace: LorryAttackTrace[] = [];
  /** Cargo thrown so far (tests). */
  thrown = 0;
  private t = 0;
  private roll = 0;
  private readonly touched = new WeakMap<Wagon, number>();
  // The jackknife.
  private yawF = -1;
  private cabDy = 0;
  boxGone = false;
  /** The crate the container dropped at the end (tests). */
  dropped: string | null = null;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: LORRY_ART, name: LORRY_NAME, hp: LORRY_AI.hp.pool, score: LORRY_AI.score });
    const lane = Math.max(1, Math.min(2, Math.round(paramNum(p, 'lane', Math.min(2, nearestLane(y))))));
    this.lane = this.laneFrom = this.laneTo = lane;
    this.y = laneY(lane);
    this.facing = 1;
    const k = paramNum(p, 'hpScale', 1);
    const hp = (base: number): number => Math.max(1, Math.round(base * k));
    const pool = hp(paramNum(p, 'hp', LORRY_AI.hp.pool));
    this.hp = this.maxHp = this.scaledHp(pool);
    const scale = this.maxHp / pool;
    this.dmgRate = Math.max(0, paramNum(p, 'rate', LORRY_AI.rate.perTick)) * scale;
    this.dmgBurst = this.dmgLeft = LORRY_AI.rate.burst * scale;
    // The pool model (the bar is the lorry's HP): the cab (the weak point) has the pool's HP of its
    // own, the doors and the bogie their own; all pass their damage on. The container behind the
    // doors and over the bogie takes what reaches it when they are gone.
    this.addPart('cab', { box: slabBox(PART_X.cab), hp: pool, shared: true, multiplier: LORRY_AI.cabMul });
    this.addPart('doors', { box: slabBox(PART_X.doors), hp: hp(LORRY_AI.hp.doors), shared: true });
    this.addPart('wheels', { box: slabBox(PART_X.wheels), hp: hp(LORRY_AI.hp.wheels), shared: true });
    this.addPart('box', { box: slabBox(PART_X.box), multiplier: LORRY_AI.boxMul });
    // `hitbox` stays the VISUAL box (bubbles, popups, the view checks; addPart grew it to the slabs).
    this.hitbox = { ...LORRY.box };
    this.removeOnDeath = false;
    this.z = 30;
    this.addTag(LORRY_ID, 'ring-block');
    this.phases = [
      { at: 1, name: 'cargo', pattern: (b) => b.phaseCargo() },
      { at: LORRY_AI.phase2, when: (b) => !b.partAlive('doors'), name: 'forklift', pattern: (b) => b.phaseForklift(), resume: (b) => b.phaseForklift() },
    ];
  }

  // ------------------------------------------------------------------------------- queries

  /** Its anchor's screen x. */
  get screenX(): number {
    return this.x - this.world.camera.x;
  }

  /** The nearest wagon in play (null: none, e.g. every player is out). */
  target(): Wagon | null {
    return nearestWagon(this.world, this.x, this.y);
  }

  /** The rear door is on screen (a cargo tell needs it). */
  doorsInView(): boolean {
    return this.world.camera.containsPoint(this.x + LORRY.rear, this.y - 30, -16);
  }

  /** The cab is on screen (a weave tell needs it). */
  cabInView(): boolean {
    return this.world.camera.containsPoint(this.x + LORRY.blinkAt[0], this.y - 30, -8);
  }

  /** The side panel lies on the road (the forklift may come out). */
  get panelDown(): boolean {
    return this.panelT >= LORRY_AI.panelTicks;
  }

  /** Open lanes here (4; 3 in a tube). */
  private openLanes(): number {
    return ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
  }

  /** Lanes with cargo of this lorry still on screen (rolling, or flying into them). */
  cargoLanes(): Set<number> {
    const out = new Set<number>();
    const cam = this.world.camera;
    const list = this.world.byTag(CARGO_ID);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.alive || !(c instanceof RingCargo)) continue;
      if (c.x < cam.x - 8 || c.x > cam.right + 8) continue;
      out.add(nearestLane(c.ty));
    }
    return out;
  }

  /**
   * The lanes of a dump of `n` pieces: free lanes only (no cargo on screen in them), leaving at
   * least one open lane free (the free lane to dodge into); the target's lane first.
   */
  pickCargoLanes(n: number): number[] {
    const open = this.openLanes();
    const busy = this.cargoLanes();
    const free: number[] = [];
    for (let l = 1; l <= open; l++) if (!busy.has(l)) free.push(l);
    const k = Math.min(n, free.length - 1);
    if (k <= 0) return [];
    const t = this.target();
    const out: number[] = [];
    const tl = t ? nearestLane(t.y, 1, open) : 0;
    if (free.includes(tl)) out.push(tl);
    const rest = free.filter((l) => l !== tl);
    while (out.length < k && rest.length) out.push(rest.splice(this.world.rng.int(0, rest.length - 1), 1)[0]);
    return out;
  }

  /** May it change into lane `to` (no car, forklift or other blocker beside it there)? */
  laneFree(to: number): boolean {
    const y = laneY(to);
    const x0 = this.x + LORRY.rear - 14;
    const x1 = this.x + LORRY.front + 14;
    for (const tag of ['ring-car', 'ring-closure', FORKLIFT_ID] as const) {
      const list = this.world.byTag(tag);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || Math.abs(e.y - y) > 10) continue;
        const ex0 = e.facing < 0 ? e.x - e.hitbox.x - e.hitbox.w : e.x + e.hitbox.x;
        if (ex0 < x1 && ex0 + e.hitbox.w > x0) return false;
      }
    }
    return true;
  }

  private mark(attack: LorryAttackTrace['attack']): LorryAttackTrace {
    const tr: LorryAttackTrace = { attack, tell: this.world.tick, fire: -1, seen: 0 };
    this.trace.push(tr);
    return tr;
  }

  // ------------------------------------------------------------------------------- intro

  override *intro(): ScriptGen {
    for (let g = 0; g < 600 && this.screenX > LORRY_AI.homeX + 0.5; g++) yield 1;
    this.arrive();
    yield LORRY_AI.introHorn;
  }

  /** On its spot: the horns, the plan lock. */
  private arrive(): void {
    if (this.arrived) return;
    this.arrived = true;
    this.world.audio.sfx('ring/lorry-horn');
    const ring = ringOf(this.world);
    if (ring && !this.locked) {
      ring.lockPlan(LORRY_ID);
      this.locked = true;
    }
  }

  private unlock(): void {
    if (!this.locked) return;
    this.locked = false;
    ringOf(this.world)?.unlockPlan(LORRY_ID);
  }

  // ------------------------------------------------------------------------------- phases

  /** Phase 1: cargo dumps. */
  *phaseCargo(): ScriptGen {
    yield 30;
    for (;;) {
      yield* this.cargoDump();
      yield this.recoveryFor(LORRY_AI.cargo.every);
    }
  }

  /** Phase 2: the panel drops, the forklift, the weave, cargo while the doors live. */
  *phaseForklift(): ScriptGen {
    this.endAttackLook();
    yield* this.dropPanel();
    for (;;) {
      if (this.forkliftReady()) yield* this.releaseForklift();
      yield* this.weave();
      yield this.recoveryFor(50);
      if (this.partAlive('doors')) {
        yield* this.cargoDump();
        yield this.recoveryFor(70);
      } else yield this.recoveryFor(90);
    }
  }

  /** CARGO DUMP (see the header). */
  *cargoDump(): ScriptGen {
    if (!this.partAlive('doors')) return;
    for (let g = 0; g < 240 && (!this.target() || !this.doorsInView()); g++) yield 1;
    if (!this.target() || !this.doorsInView() || !this.partAlive('doors')) return;
    const tr = this.mark('cargo');
    this.mode = 'tell-cargo';
    this.doorTarget = 1;
    this.brakeT = 9999;
    this.setLoader('lift');
    this.world.audio.sfx('ring/lorry-door');
    this.world.audio.sfx('ring/lorry-brake');
    const T = this.telegraphFor(LORRY_AI.cargo.tell);
    for (let i = 0; i < T; i++) {
      if (!this.doorsInView() || !this.partAlive('doors')) {
        this.endAttackLook();
        return;
      }
      tr.seen++;
      yield 1;
    }
    const lanes = this.pickCargoLanes(this.volleySize(LORRY_AI.cargo.n));
    tr.lanes = lanes;
    tr.fire = this.world.tick;
    this.mode = 'cargo';
    for (let i = 0; i < lanes.length; i++) {
      if (!this.partAlive('doors')) break;
      this.setLoader('throw');
      const kind: CargoKind = (this.thrown + 1) % LORRY_AI.cargo.crateEvery === 0 ? 'crate' : 'barrel';
      this.launch(lanes[i], kind);
      yield LORRY_AI.cargo.gap;
      if (i + 1 < lanes.length) this.setLoader('lift');
    }
    if (this.loader !== 'gone') this.setLoader('stand');
    this.brakeT = 0;
    this.mode = 'cruise';
    yield LORRY_AI.cargo.hold;
    if (!this.doorsGone) {
      this.doorTarget = 0;
      this.world.audio.sfx('ring/lorry-door', { pitch: 0.9 });
    }
  }

  /** One piece of cargo out of the door into `lane`. */
  private launch(lane: number, kind: CargoKind): void {
    const C = LORRY_AI.cargo;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const x0 = this.x + LORRY.cargoOut[0];
    const rng = this.world.rng;
    const rel = rng.range(C.roll[1], C.roll[0]);
    const drop = kind === 'crate' && rng.chance(0.35) ? rng.pick(CRATE_ITEMS) : undefined;
    this.world.spawn(CARGO_ID, x0, this.y, {
      kind,
      ty: laneY(lane),
      ticks: C.flight,
      lift: LORRY.cargoOut[1],
      vx: road - C.land / C.flight,
      arc: C.arc,
      rel,
      ...(drop ? { drop } : {}),
    });
    this.thrown++;
    this.world.audio.sfx('ring/throw', { pitch: 0.7 });
  }

  /** WEAVE (see the header). */
  *weave(): ScriptGen {
    if (this.wheelsBroken || this.weaving) return;
    const to = this.lane === 1 ? 2 : 1;
    if (to > this.openLanes() || !this.laneFree(to) || !this.target() || !this.cabInView()) return;
    const tr = this.mark('weave');
    this.mode = 'tell-weave';
    this.blinkT = 9999;
    this.world.audio.sfx('ring/lorry-blink');
    const T = this.telegraphFor(LORRY_AI.weave.tell);
    for (let i = 0; i < T; i++) {
      if (!this.laneFree(to) || !this.cabInView()) {
        this.blinkT = 0;
        this.mode = 'cruise';
        return;
      }
      tr.seen++;
      if (i === T - 12) this.world.audio.sfx('ring/lorry-horn', { vol: 0.7, pitch: 1.1 });
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'weave';
    this.laneFrom = this.lane;
    this.laneTo = to;
    this.laneT = 0;
    this.weaving = true;
    for (let g = 0; g < 200 && this.weaving; g++) yield 1;
    this.blinkT = 0;
    this.mode = 'cruise';
  }

  /** The side panel drops (once). */
  *dropPanel(): ScriptGen {
    if (this.panelT >= 0) return;
    this.panelT = 0;
    this.world.audio.sfx('ring/lorry-panel');
    for (let g = 0; g < 200 && !this.panelDown; g++) yield 1;
  }

  /** The next forklift may come out. */
  forkliftReady(): boolean {
    return this.panelDown && !this.holdAdds && (!this.forklift || !this.forklift.alive) && this.forkCool <= 0;
  }

  /** A forklift drives out of the hold (an add: never while adds are held). */
  *releaseForklift(): ScriptGen {
    if (!this.forkliftReady()) return;
    const f = this.world.spawn(FORKLIFT_ID, this.x + LORRY.bayX, this.y, { lorry: this });
    this.forklift = f instanceof RingForklift ? f : null;
    this.world.audio.sfx('ring/forklift-whine');
    yield 50;
  }

  // ------------------------------------------------------------------------------- stagger

  protected override canStagger(): boolean {
    // A lane change and the panel drop finish first (never frozen across two lanes).
    return !this.weaving && !(this.panelT >= 0 && !this.panelDown);
  }

  protected override cutAttack(): boolean {
    this.endAttackLook();
    return true;
  }

  protected override onStagger(ticks: number): void {
    this.say('!', { at: LORRY.sayAt, ticks: Math.min(60, ticks) });
  }

  /** End a running attack's look: indicator, brake lights, the loader's drum, the door. */
  endAttackLook(): void {
    this.mode = 'cruise';
    this.blinkT = 0;
    this.brakeT = 0;
    if (this.loader !== 'gone') this.setLoader('stand');
    if (!this.doorsGone) this.doorTarget = 0;
  }

  private setLoader(m: LoaderMode): void {
    if (this.loader === 'gone') return;
    this.loader = m;
    this.loaderT = 0;
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    super.update();
    if (this.state === 'done') this.updateWreck();
  }

  protected override think(): void {
    this.t++;
    if (this.dmgLeft < this.dmgBurst) this.dmgLeft = Math.min(this.dmgBurst, this.dmgLeft + this.dmgRate);
    const ring = ringOf(this.world);
    const road = ring?.roadSpeed ?? 0;
    const sx = this.screenX;
    let rel: number;
    if (this.state === 'intro') rel = sx > LORRY_AI.homeX ? Math.max(LORRY_AI.introRel, (LORRY_AI.homeX - sx) * 0.08) : 0;
    else {
      const home = LORRY_AI.homeX + Math.sin((this.t / LORRY_AI.driftPeriod) * Math.PI * 2) * LORRY_AI.drift;
      rel = Math.max(-1, Math.min(1, (home - sx) * 0.04));
    }
    if (this.staggerTicks > 0) rel = Math.min(rel, 0) * 0.5;
    this.vx = road + rel;
    this.x += this.vx;
    this.roll += this.vx;
    if (this.state === 'intro' && sx <= LORRY_AI.homeX + 0.5) this.arrive();
    // The lane change: a slow S over `weave.ticks`.
    if (this.weaving) {
      this.laneT++;
      const k = Math.min(1, this.laneT / LORRY_AI.weave.ticks);
      const e = k * k * (3 - 2 * k);
      this.y = laneY(this.laneFrom) + (laneY(this.laneTo) - laneY(this.laneFrom)) * e;
      if (k >= 1) {
        this.weaving = false;
        this.lane = this.laneTo;
        this.y = laneY(this.lane);
      }
    }
    // The door, the panel, the lights, the loader.
    const dt = 1 / 8;
    if (this.doorOpen < this.doorTarget) this.doorOpen = Math.min(this.doorTarget, this.doorOpen + dt);
    else if (this.doorOpen > this.doorTarget) this.doorOpen = Math.max(this.doorTarget, this.doorOpen - dt);
    const doors = this.parts[P_DOORS];
    const dx = this.doorOpen > 0.5 && !this.doorsGone ? PART_X.doorsOpen : PART_X.doors;
    doors.box.x = dx[0];
    doors.box.w = dx[1] - dx[0];
    if (this.panelT >= 0 && this.panelT < LORRY_AI.panelTicks) {
      this.panelT++;
      if (this.panelT === LORRY_AI.panelTicks) this.panelLands();
      else if (this.panelT % 6 === 0) this.world.camera.shake(1, 3);
    }
    if (this.blinkT > 0) {
      this.blinkT--;
      if (this.t % 16 === 0) this.world.audio.sfx('ring/lorry-blink', { vol: 0.5 });
    }
    if (this.brakeT > 0) this.brakeT--;
    this.loaderT++;
    if (this.loader === 'throw' && this.loaderT >= 10) this.loader = 'stand';
    // Wagons that touch it.
    this.touchWagons();
    // The forklift.
    if (this.forklift && !this.forklift.alive) {
      this.forklift = null;
      this.forkCool = LORRY_AI.forklift.cool;
    }
    if (this.forkCool > 0 && !this.holdAdds) this.forkCool--;
    // Damage: the dragging rims spark, the panel ramp scrapes, the cab smokes.
    if (this.wheelsBroken && this.t % 4 === 0) {
      const wx = LORRY.trailerWheels[(this.t >> 2) % 3];
      hitSpark(this.world, this.x + wx - 4, this.y - 1, -1);
      if (this.t % 48 === 0) this.world.audio.sfx('ring/lorry-scrape', { vol: 0.6 });
    }
    if (this.panelDown && this.t % 9 === 0) hitSpark(this.world, this.x - 60 + ((this.t * 37) % 110), this.y + 9, -1);
    const cs = this.cabState;
    if (cs > 0 && this.t % (cs === 2 ? 5 : 11) === 0) smokeTrail(this.world, this.x + LORRY.smoke.cab[0], this.y + LORRY.smoke.cab[1], cs === 2);
  }

  /** The ramp hits the road: a bang, sparks along it. */
  private panelLands(): void {
    const w = this.world;
    w.camera.shake(3, 12);
    w.audio.sfx('ring/lorry-slam');
    for (let i = 0; i < 6; i++) hitSpark(w, this.x - 80 + i * 22, this.y + 8, -1);
    dust(w, this.x - 20, this.y + 8, 8);
  }

  /** A wagon in its slab is pushed out: from behind back, from the side away (½ cell; 1 when it weaved into it). */
  private touchWagons(): void {
    if (this.state !== 'fight' && this.state !== 'intro') return;
    const rear = this.x + (this.doorOpen > 0.5 && !this.doorsGone ? PART_X.doorsOpen[0] : LORRY.rear);
    fullSlab.x = rear;
    fullSlab.w = this.x + LORRY.front - rear;
    fullSlab.y = this.y - DEPTH_HALF;
    fullSlab.h = DEPTH_HALF * 2;
    const list = drivenWagons(this.world);
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!slabsTouch(wagonSlab(w), fullSlab)) continue;
      const nose = w.x + WAGON_W / 2;
      const ready = this.world.tick - (this.touched.get(w) ?? -999) >= LORRY_AI.touchGap;
      if (nose < rear + 16) {
        // From behind: it stays behind the tailgate.
        w.x = rear - WAGON_W / 2 - 1;
        if (w.sideV > -road * 0.2) w.sideV = -0.6;
        if (ready) {
          this.touched.set(w, this.world.tick);
          w.bump({ dx: -1, cost: 0.5, source: this });
        }
        continue;
      }
      // Beside it: out to the lane away from it — always onto the road (integrator, wave B: a
      // wagon beside the lorry in lane 1 went over the median, y 108, and stuck there: the lorry
      // pushed it back every tick).
      let away = w.y >= this.y ? 1 : -1;
      const lane = nearestLane(this.y);
      const open = ringOf(this.world)?.lanesOpenAt(w.x) ?? LANE_COUNT;
      if (away < 0 && lane <= 1) away = 1;
      else if (away > 0 && lane >= open) away = -1;
      w.y = this.y + away * (DEPTH_HALF * 2 + 0.2);
      if (ready) {
        this.touched.set(w, this.world.tick);
        w.bump({ dy: away, cost: this.weaving ? 1 : 0.5, source: this });
      }
    }
  }

  // ------------------------------------------------------------------------------- damage

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override onHit(d: Damage, part = 0): boolean {
    const p = this.parts[part];
    if (this.state === 'fight' && !this.dead && this.invulnTicks <= 0 && p && p.enabled && !p.destroyed && !p.armored && d.amount > 0) {
      // The damage rate and the phase-1 floor (see the header).
      const mul = p.multiplier;
      const want = d.amount * mul;
      const floor = this.panelDown ? 0 : Math.floor(this.maxHp * LORRY_AI.phase2);
      let room = Math.max(0, this.hp - floor);
      if (this.dmgRate > 0) room = Math.min(room, this.dmgLeft);
      if (this.dmgRate > 0) this.dmgLeft = Math.max(0, this.dmgLeft - Math.min(want, room));
      if (want > room) d = { ...d, amount: room / mul };
    }
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && part === 3 && this.world.tick % 3 === 0) {
      // Shots on the container clang off it (it takes half).
      if (this.world.tick % 6 === 0) this.world.audio.sfx('ring/dent', { vol: 0.5 });
      const r = this.partRect(this.parts[3]);
      hitSpark(this.world, Math.max(r.x, Math.min(r.x + r.w, d.dirX < 0 ? r.x + r.w : r.x)), this.y - 30, -(d.dirX || 1));
    }
    return hit;
  }

  /** A part broke: the explosion at its visual spot (the slab lies on the road), the score, the hook. */
  protected override breakPart(p: BossPart, d: Damage): void {
    if (p.destroyed) return;
    p.hp = 0;
    p.destroyed = true;
    const at = this.partSpot(p.index);
    explosion(this.world, at[0], at[1], 'm', { debris: 'metal', silent: true });
    this.world.audio.sfx('boss/part-break');
    awardScore(this.world, d.owner, 1000, at[0], at[1] - 10);
    this.onPartBroken(p);
    // The cab is the heart of it: when it breaks, the lorry is done.
    if (p.index === P_CAB && !this.dead) {
      this.hp = 0;
      this.die(d);
    }
  }

  /** The visual middle of a part (world). */
  partSpot(i: number): [number, number] {
    const xs = i === P_CAB ? PART_X.cab : i === P_DOORS ? PART_X.doors : i === P_WHEELS ? PART_X.wheels : PART_X.box;
    const ys = i === P_CAB ? -38 : i === P_DOORS ? -40 : i === P_WHEELS ? -8 : -42;
    pt[0] = this.x + (xs[0] + xs[1]) / 2;
    pt[1] = this.y + ys;
    return pt;
  }

  protected override onPartBroken(p: BossPart): void {
    const w = this.world;
    const road = ringOf(w)?.roadSpeed ?? 0;
    if (p.index === P_DOORS) {
      // The door is torn off, the loader jumps (bloodless) and sits dazed on the hard shoulder.
      this.loaderJumps(true);
      this.doorsGone = true;
      this.doorTarget = 0;
      this.doorOpen = 0;
      tumbleOff(w, this.x + LORRY.door.hinge - 13, this.y - 2, { sprite: SPR.doorFall, vx: road * 0.6, vy: 1.2, lift: 22, vlift: 2.2, bounces: 1, rest: 50, restFrame: 2, tpf: 4, shadowW: 22, z: 33 });
      this.brakeT = 0;
      w.audio.sfx('ring/lorry-door', { pitch: 0.7 });
      this.checkPhases();
    } else if (p.index === P_WHEELS) {
      this.wheelsBroken = true;
      w.audio.sfx('ring/lorry-scrape');
      for (const wx of LORRY.trailerWheels) debris(w, this.x + wx, this.y - 6, 'dirt', 4);
    }
  }

  /** The loader jumps off (bloodless; `always`: even from behind the shut door) and sits dazed on the hard shoulder. */
  private loaderJumps(always = false): void {
    const w = this.world;
    const road = ringOf(w)?.roadSpeed ?? 0;
    if (this.loader !== 'gone' && (always || this.doorOpen > 0.6)) {
        tumbleOff(w, this.x + LORRY.loader[0], this.y, {
          sprite: SPR.loader('tumble'),
          restSprite: SPR.loader('sit'),
          vx: road * 0.5 - 0.6,
          vy: Math.max(0.6, (SHOULDER_TOP + 5 - this.y) / 30),
          lift: LORRY.deck + 4,
          vlift: 2.6,
          bounces: 1,
          rest: 90,
          tpf: 4,
          shoulder: true,
          shadowW: 14,
          z: 34,
        });
    }
    this.loader = 'gone';
  }

  /** The cab's look: its own state or the lorry's, the worse one. */
  get cabState(): number {
    return Math.max(this.partState(this.parts[P_CAB]), this.damageState);
  }

  override center(): [number, number] {
    pt[0] = this.x - 10;
    pt[1] = this.y - 36;
    return pt;
  }

  /** A random point on the lorry's body (smoke, the death's blasts; cosmetic rng). */
  override randomPoint(): [number, number] {
    const rng = this.world.fxRng;
    const i = rng.int(0, 2);
    const r = i === 0 ? CAB_VIS : i === 1 ? BOX_VIS : BOGIE_VIS;
    const out = rectAt(this.x, this.y, r, false, visScratch);
    pt[0] = out.x + rng.range(0, out.w);
    pt[1] = out.y + rng.range(0, out.h);
    return pt;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    // The plan rolls on at once (the runner's own slot lock ends now too): the next waves come in
    // while the jackknife plays (GDD §1.5: no long stretch without an enemy).
    this.unlock();
    this.endAttackLook();
    this.loaderJumps();
    this.weaving = false;
    this.brakeT = 9999;
    if (this.forklift?.alive) this.forklift.setLeave();
  }

  /** The jackknife (see the header). */
  protected override deathSequence(): ScriptGen | null {
    const self = this;
    return (function* lorryDeath(): ScriptGen {
      const w = self.world;
      w.audio.sfx('ring/lorry-screech');
      w.camera.shake(3, 20);
      // The brakes lock, the cab swings toward the camera; tyre smoke, blasts on the cab.
      for (let t = 0; t < 44; t++) {
        self.deathMove(-0.2 - t * 0.02);
        self.yawF = Math.min(3, Math.floor(t / 10));
        self.cabDy = Math.min(14, t * 0.4);
        if (t % 3 === 0) dust(w, self.x + LORRY.tractorWheels[1], self.y, 2);
        if (t % 8 === 0) {
          const p = self.randomPoint();
          explosion(w, p[0], p[1], t % 16 === 0 ? 'm' : 's', { silent: t % 16 !== 0, shake: 2 });
        }
        yield 1;
      }
      // The container slides off onto the hard shoulder.
      self.boxGone = true;
      w.add(new RingLorryBox(w, self.x + (LORRY.container.x0 + LORRY.container.x1) / 2, self.y, self.vx, self));
      explosion(w, self.x + LORRY.smoke.coupling[0], self.y + LORRY.smoke.coupling[1], 'l', { debris: 'metal' });
      w.audio.sfx('ring/lorry-slam', { pitch: 0.8 });
      for (let t = 0; t < 70; t++) {
        self.deathMove(-1.1 - t * 0.012);
        if (t % 6 === 0) smokeTrail(w, self.x + LORRY.smoke.cab[0], self.y + LORRY.smoke.cab[1] + self.cabDy, true);
        if (t === 30) explosion(w, self.x + 70, self.y - 30 + self.cabDy, 'm', { debris: 'metal' });
        yield 1;
      }
    })();
  }

  /** Move during the death at screen speed `rel` (the road keeps scrolling). */
  private deathMove(rel: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.vx = Math.max(0, road + rel);
    this.x += this.vx;
    this.roll += this.vx;
  }

  protected override onDefeated(): void {
    this.unlock();
  }

  /** The wreck lies on the road (it drifts back with the road) and smokes; gone off the left edge. */
  private updateWreck(): void {
    this.vx = Math.max(0, this.vx * 0.97 - 0.01);
    this.x += this.vx;
    if (this.world.tick % 9 === 0) smokeTrail(this.world, this.x + LORRY.smoke.cab[0], this.y + LORRY.smoke.cab[1] + this.cabDy, true);
    if (this.x + LORRY.front + 40 < this.world.camera.x) this.remove();
  }

  override onRemove(): void {
    this.unlock();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const sh = this.staggerTicks > 0 && Math.floor(this.world.tick / 2) % 2 === 0 ? 1 : 0;
    const y = Math.round(this.y);
    const fl = (i: number): boolean => this.parts[i].flash > 0 && this.world.tick % 2 === 0;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(SPR.trailer, 0, x + sh, y, drawOpts);
    if (!this.boxGone) {
      drawOpts.flash = false;
      if (this.panelT >= 0) r.sprite(SPR.hold, this.damageState, x + sh, y, drawOpts);
      else r.sprite(SPR.container(this.damageState), 0, x + sh, y, drawOpts);
      // The rear door (behind the loader), then the loader in the doorway (he faces back).
      if (!this.doorsGone) {
        drawOpts.flash = fl(P_DOORS);
        const df = this.doorOpen <= 0.01 ? 0 : this.doorOpen < 0.6 ? 1 : this.partState(this.parts[P_DOORS]) >= 2 ? 3 : 2;
        r.sprite(SPR.doors, df, x + sh, y, drawOpts);
      }
      if (this.loader !== 'gone' && this.doorOpen > 0.6) {
        drawOpts.flipX = true;
        drawOpts.flash = fl(P_DOORS);
        const lf = this.loader === 'lift' ? Math.min(2, Math.floor(this.loaderT / 8)) : this.loader === 'throw' ? Math.min(1, Math.floor(this.loaderT / 5)) : Math.floor(this.t / 30) % 2;
        r.sprite(SPR.loader(this.loader), lf, x + sh + LORRY.loader[0], y - LORRY.deck, drawOpts);
        drawOpts.flipX = false;
      }
    }
    // The cab (the jackknife: turning toward the camera).
    drawOpts.flash = fl(P_CAB);
    if (this.yawF >= 0) r.sprite(SPR.cabYaw, this.yawF, x, y + Math.round(this.cabDy), drawOpts);
    else r.sprite(SPR.cab(this.cabState), 0, x + sh, y, drawOpts);
    // Wheels: the tractor's (not in the yaw frames, they have their own), the bogie (or the rims).
    drawOpts.flash = false;
    const f = Math.floor(this.roll / 2.5) & 3;
    const wy = y - Math.round(WHEEL_R + 0.5);
    if (this.yawF < 0) for (const wx of LORRY.tractorWheels) r.sprite('ring/car/wheel-l', f, x + sh + wx, wy, drawOpts);
    drawOpts.flash = fl(P_WHEELS);
    for (const wx of LORRY.trailerWheels) {
      if (this.wheelsBroken) r.sprite(SPR.rim, f, x + sh + wx, y - Math.round(RIM_R + 0.5), drawOpts);
      else r.sprite('ring/car/wheel-l', f, x + sh + wx, wy, drawOpts);
    }
    drawOpts.flash = false;
    // The dropped side panel lies in front of the wheels (the near side).
    if (this.panelT >= 0) {
      const pt2 = this.panelT;
      r.sprite(SPR.panel, pt2 < 12 ? 0 : pt2 < 26 ? 1 : pt2 < LORRY_AI.panelTicks ? 2 : 3, x + (this.boxGone ? 0 : sh), y, drawOpts);
    }
    // The indicator (the weave tell) and the brake lights (the cargo tell, the death).
    if (this.blinkT > 0 && this.yawF < 0) r.sprite(SPR.blink, Math.floor(this.t / 8) % 2, x + sh + LORRY.blinkAt[0], y + LORRY.blinkAt[1], drawOpts);
    if (this.brakeT > 0 && this.world.tick % 30 < 26) r.sprite(SPR.brake, 0, x + sh + LORRY.brakeAt[0], y + LORRY.brakeAt[1], drawOpts);
  }
}

/**
 * The container sliding off the jackknifed lorry onto the hard shoulder (drawn only, not hit): it
 * falls from the deck while it slides toward the camera, tips onto its side (`box-tip`), lands
 * with a blast and drops the lorry's item (a repair for a wagon at ≤ 6 cells, else a weapon).
 */
export class RingLorryBox extends RingEntity implements RingDrawable {
  override lift: number = LORRY.deck;
  override shadowW = 0;
  private t = 0;
  private landed = false;
  private readonly y0: number;
  /** The plane y it is drawn at while it slides (its sort y stays the lorry's lane until it lands: the wagons it crosses stay in front). */
  private drawY: number;
  private readonly lorry: RingLorry;

  constructor(world: World, x: number, y: number, vx: number, lorry: RingLorry) {
    super(world, x, y);
    this.vx = vx;
    this.y0 = y;
    this.drawY = y;
    this.shadowW = 0;
    this.lorry = lorry;
    this.z = 36;
    this.team = 'neutral';
    this.hitbox = { x: -68, y: -64, w: 136, h: 64 };
    this.despawnMargin = 96;
  }

  override update(): void {
    this.t++;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const T = 40;
    if (!this.landed) {
      const k = Math.min(1, this.t / T);
      this.drawY = this.y0 + (SHOULDER_TOP + 2 - this.y0) * k * k;
      this.lift = LORRY.deck * (1 - k);
      this.vx = Math.max(0, this.vx - road * 0.02);
      this.x += this.vx;
      if (this.t % 4 === 0) hitSpark(this.world, this.x - 60 + ((this.t * 29) % 120), this.drawY, -1);
      if (k >= 1) this.land();
      return;
    }
    this.vx = Math.max(0, this.vx * 0.9);
    this.x += this.vx;
    if (this.t % 10 === 0) smokeTrail(this.world, this.x - 50, this.y - 30, true);
    if (this.x + 80 < this.world.camera.x) this.remove();
  }

  private land(): void {
    this.landed = true;
    this.y = this.drawY;
    this.shadowW = 120;
    const w = this.world;
    explosion(w, this.x, this.y - 16, 'm', { debris: 'metal' });
    dust(w, this.x - 30, this.y, 8);
    dust(w, this.x + 30, this.y, 8);
    w.camera.shake(3, 14);
    w.audio.sfx('ring/lorry-slam');
    // The drop: a repair for a wagon in need, else a weapon.
    let low = false;
    for (const wg of drivenWagons(w)) if (wg.cells <= 6) low = true;
    const item = low ? 'repair' : w.rng.pick(DEATH_WEAPONS);
    this.lorry.dropped = item;
    w.spawn(RING_ENTITY.crate, this.x + 40, laneY(4), { contains: item, dropped: true, vx: (ringOf(w)?.roadSpeed ?? 0) * 0.4, lift: 20, vlift: 2.6 });
  }

  override draw(r: Renderer): void {
    const f = this.landed ? 2 : this.t < 16 ? 0 : this.t < 30 ? 1 : 2;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(SPR.boxTip, f, Math.round(this.x), Math.round((this.landed ? this.y : this.drawY) - this.lift), drawOpts);
  }
}

const NO_BOXES: readonly Rect[] = [];
/** Items a crushed crate of cargo may hold, and the death's weapons (H, R, L). */
const CRATE_ITEMS: readonly string[] = ['bombs', 'repair', 'M', 'S', 'food'];
const DEATH_WEAPONS: readonly string[] = ['H', 'R', 'L'];
/** Visual rectangles (local) for smoke and blasts. */
const CAB_VIS: Rect = { x: 50, y: -60, w: 40, h: 46 };
const BOX_VIS: Rect = { x: -88, y: -62, w: 128, h: 40 };
const BOGIE_VIS: Rect = { x: -84, y: -16, w: 46, h: 12 };
const visScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };

defineEntity(LORRY_ID, (w, x, y, p) => new RingLorry(w, x, y, p), {
  category: 'boss',
  score: LORRY_AI.score,
  description: 'The ring test mid-boss: a container lorry (cab, doors, wheels); cargo dumps, then the side panel drops, a forklift charges and it weaves (params hp, hpScale, lane).',
});

