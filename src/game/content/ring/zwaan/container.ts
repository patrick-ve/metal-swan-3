/**
 * `ring-zwaan-container` — part 1 of the ZWAAN train, the CONTAINER TRAILER (bar name `ZWAAN
 * CONTAINER`; docs/design/ring.md §R.3): the retired test lorry without its cab. A rust-red
 * container with the ZWAAN name and swan mark and a made-up box code on a semitrailer that rides on
 * a converter dolly; its drawbar reaches into the car transporter's towing jaw in front.
 *
 * Part-local x (zwaan/kit.ts): 0 = the rear (the doors), 150 = the front (the drawbar's end). The
 * art is the old lorry's container (boss/geometry.ts old-local coordinates: part-local = old + 92).
 *
 * HP (× difficulty × co-op; the bar is the part's HP): parts in index order
 * - 0 `box` — the container's side over the landing legs (part x 56 … 136): × 1, it takes the pool's
 *   damage; THE BOT AIMS AT PART 0 (`hurtboxes()[0]`);
 * - 1 `doors` — the rear doors with the loader (x 0 … 18; −26 … 18 while they stand open): a weak
 *   point (× 1.5), own HP, passed on; broken: the door is torn off, the loader jumps (bloodless) and
 *   the fight goes to phase 2;
 * - 2 `bogie` — the rear axles (x 18 … 56): a weak point (× 1.25), own HP, passed on; broken: the
 *   tyres blow, the rims drag and spark.
 * Each broken part is +1,000 (Boss rule). A part's damage rate (the base bucket, `ZWAAN.rate`) and
 * the PHASE-1 FLOOR: until the side panel is down the pool holds at the phase-2 line (55 %).
 *
 * - Phase 1 `cargo`: CARGO DUMP (the lorry's): the tell (≥ 18 ticks, the doors on screen: the door
 *   bangs open, the brake lights, the loader hoists a drum), then 2 (HARD 3) drums / crates
 *   (`ring-barrel`) into lanes chosen so that one open lane always stays free; they land behind the
 *   trailer and roll back along their lanes.
 * - Phase 2 `forklift` (the doors broken or the HP ≤ 55 %): the bay of the near side drops onto the
 *   road (a ramp, sparks) and the FORKLIFT (`ring-forklift`) drives out and charges back along a
 *   wagon's lane (its own tell); a new one 240 ticks after one is wrecked (never while adds are
 *   held); cargo dumps go on while the doors live.
 * - Touch: a wagon that drives into it is pushed out (kit `pushWagonsOut`).
 * - The continue staggers it: a running dump ends cleanly (`cutAttack`); the panel drop finishes first.
 * - Beaten (2,000 points): the forklift drives off, the loader jumps; the part's beaten sequence
 *   (part.ts: uncouple, brake, swerve onto the hard shoulder, tip, drop back) with the container
 *   tipping onto its side (`box-tip`) and the drop (a repair or a weapon).
 *
 * Params: `hp`, `hpScale`, `lane`, `rate` (0 = no damage-rate limit; tests), `index`.
 */
import type { Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import type { BossPart } from '../../../boss';
import { debris, dust, hitSpark } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { defineRingArt } from '../../../ring/art-def';
import { ringOf } from '../../../ring/entity';
import { LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { RingCargo, RingForklift, type CargoKind } from '../boss/adds';
import { CARGO_ID, CONTAINER_REAR, FORKLIFT_ID, LORRY, SPR } from '../boss/geometry';
import { nearestWagon, tumbleOff } from '../traffic/road-kit';
import { defineZwaanPart, RING_ZWAAN, ZWAAN, ZWAAN_NAMES, zwaanArt } from './api';
import { drawZwaanCoupling, drawZwaanDolly, drawZwaanShadow, drawZwaanWheels, pushWagonsOut, ZWAAN_KIT_ART, ZWAAN_PACE, zwaanRate, zwaanSmoke } from './kit';
import { ZwaanPart, zwaanSlab } from './part';

/** Old-local → part-local x (see the header). */
const OX = -CONTAINER_REAR;

/** Tuning (ticks, px, px/tick; HP before difficulty × co-op). */
export const CONTAINER_AI = {
  /** The part's HP (the bar), the doors' and the bogie's own HP (passed on). */
  /** Fixer (2026-10-22): the pool 2,050 → 1,850 (the pistol took 37–49 s; the special guns stay at the 30 s floor). */
  hp: { pool: Math.round(ZWAAN_PACE.trailerHp * 0.9), doors: 420, bogie: 340 },
  doorsMul: 1.5,
  bogieMul: 1.25,
  length: 150,
  height: 68,
  cargo: {
    /** Telegraph base (by difficulty, never below 18), the gap between dumps (× fire interval). */
    tell: 32,
    every: 130,
    /** Pieces per dump on NORMAL (HARD +1), ticks between them. */
    n: 2,
    gap: 10,
    /** Flight ticks, the extra arc, where it lands (screen px behind the door). */
    flight: 26,
    arc: 14,
    land: 44,
    /** Rolling screen speeds (slowest … fastest), every n-th piece a crate. */
    roll: [-1.7, -2.4] as const,
    crateEvery: 3,
    /** The door stays open after the throw. */
    hold: 30,
  },
  /** The side panel drops over this many ticks (the ramp lands at the end). */
  panelTicks: 40,
  forklift: { cool: 240 },
  /** Phase 2 at this HP fraction (or the doors broken); the pool holds here until the panel is down. */
  phase2: 0.55,
} as const;

/** Part-local x ranges of the parts (index = the order above). */
export const CONTAINER_X = {
  box: [56, 136] as const,
  doors: [0, 18] as const,
  doorsOpen: [-26, 18] as const,
  bogie: [18, 56] as const,
  /** The bogie's wheels (part-local; the old lorry's −78, −62, −46). */
  wheels: [14, 30, 46] as readonly number[],
} as const;

/** One attack of the fight (tests): its tell tick, its strike tick (−1 = cut), the tell ticks on screen. */
export interface ContainerAttackTrace {
  attack: 'cargo';
  tell: number;
  fire: number;
  seen: number;
  lanes?: number[];
}

type LoaderMode = 'stand' | 'lift' | 'throw' | 'gone';

const P_BOX = 0;
const P_DOORS = 1;
const P_BOGIE = 2;
const drawOpts: DrawOpts = {};
/** Items a crushed crate of cargo may hold. */
const CRATE_ITEMS: readonly string[] = ['bombs', 'repair', 'M', 'S', 'food'];
/** Smoke points by damage (part-local). */
const SMOKE: readonly (readonly [number, number])[] = [
  [40, -60],
  [100, -58],
  [70, -30],
];

export class ZwaanContainer extends ZwaanPart {
  /** Door: 0 shut … 1 open (and its target); gone after the doors broke. */
  doorOpen = 0;
  doorTarget = 0;
  doorsGone = false;
  /** The side panel: −1 up, 0 … panelTicks dropping, ≥ panelTicks down (the ramp). */
  panelT = -1;
  loader: LoaderMode = 'stand';
  private loaderT = 0;
  bogieBroken = false;
  /** The forklift out on the road (null: none) and the wait for the next one. */
  forklift: RingForklift | null = null;
  private forkCool = 0;
  /** What it does now (the sim's fairness watch: a `tell-X` → `X` change is an attack after its tell). */
  mode: 'cruise' | 'tell-cargo' | 'cargo' = 'cruise';
  /** Attacks of the fight (tests). */
  readonly trace: ContainerAttackTrace[] = [];
  /** Cargo thrown so far (tests). */
  thrown = 0;
  private readonly touched = new WeakMap<Wagon, number>();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, {
      art: zwaanArt(RING_ZWAAN.container),
      name: ZWAAN_NAMES[RING_ZWAAN.container],
      hp: CONTAINER_AI.hp.pool,
      score: ZWAAN.score.trailer,
      length: CONTAINER_AI.length,
      height: CONTAINER_AI.height,
      rate: zwaanRate(CONTAINER_AI.hp.pool),
    });
    const k = paramNum(p, 'hpScale', 1);
    const hp = (base: number): number => Math.max(1, Math.round(base * k));
    this.addPart('box', { box: zwaanSlab(CONTAINER_X.box[0], CONTAINER_X.box[1]) });
    this.addPart('doors', { box: zwaanSlab(CONTAINER_X.doors[0], CONTAINER_X.doors[1]), hp: hp(CONTAINER_AI.hp.doors), shared: true, multiplier: CONTAINER_AI.doorsMul });
    this.addPart('bogie', { box: zwaanSlab(CONTAINER_X.bogie[0], CONTAINER_X.bogie[1]), hp: hp(CONTAINER_AI.hp.bogie), shared: true, multiplier: CONTAINER_AI.bogieMul });
    // `hitbox` stays the VISUAL box (bubbles, popups, the view checks; addPart grew it to the slabs).
    this.hitbox = { x: 0, y: -CONTAINER_AI.height, w: CONTAINER_AI.length, h: CONTAINER_AI.height };
    this.phases = [
      { at: 1, name: 'cargo', pattern: (b) => b.phaseCargo() },
      { at: CONTAINER_AI.phase2, when: (b) => !b.partAlive('doors'), name: 'forklift', pattern: (b) => b.phaseForklift(), resume: (b) => b.phaseForklift() },
    ];
  }

  // ------------------------------------------------------------------------------- queries

  /** The nearest wagon in play (null: none, e.g. every player is out). */
  target(): Wagon | null {
    return nearestWagon(this.world, this.x, this.y);
  }

  /** The rear door is on screen (a cargo tell needs it). */
  doorsInView(): boolean {
    return this.world.camera.containsPoint(this.x, this.y - 30, -16);
  }

  /** The side panel lies on the road (the forklift may come out). */
  get panelDown(): boolean {
    return this.panelT >= CONTAINER_AI.panelTicks;
  }

  private openLanes(): number {
    return ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
  }

  /** Lanes with cargo still on screen (rolling, or flying into them). */
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

  /** The lanes of a dump of `n` pieces: free lanes only, leaving one open lane free; the target's lane first. */
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

  private mark(): ContainerAttackTrace {
    const tr: ContainerAttackTrace = { attack: 'cargo', tell: this.world.tick, fire: -1, seen: 0 };
    this.trace.push(tr);
    return tr;
  }

  // ------------------------------------------------------------------------------- phases

  /** Phase 1: cargo dumps. */
  *phaseCargo(): ScriptGen {
    yield 24;
    for (;;) {
      yield* this.cargoDump();
      yield this.recoveryFor(CONTAINER_AI.cargo.every);
    }
  }

  /** Phase 2: the panel drops, the forklift, cargo while the doors live. */
  *phaseForklift(): ScriptGen {
    this.endAttackLook();
    yield* this.dropPanel();
    for (;;) {
      if (this.forkliftReady()) yield* this.releaseForklift();
      if (this.partAlive('doors')) {
        yield* this.cargoDump();
        yield this.recoveryFor(90);
      } else yield this.recoveryFor(60);
    }
  }

  /** CARGO DUMP (see the header). */
  *cargoDump(): ScriptGen {
    if (!this.partAlive('doors')) return;
    for (let g = 0; g < 240 && (!this.target() || !this.doorsInView()); g++) yield 1;
    if (!this.target() || !this.doorsInView() || !this.partAlive('doors')) return;
    const tr = this.mark();
    this.mode = 'tell-cargo';
    this.doorTarget = 1;
    this.brakeT = 9999;
    this.setLoader('lift');
    this.world.audio.sfx('ring/lorry-door');
    this.world.audio.sfx('ring/lorry-brake');
    const T = this.telegraphFor(CONTAINER_AI.cargo.tell);
    for (let i = 0; i < T; i++) {
      if (!this.doorsInView() || !this.partAlive('doors')) {
        this.endAttackLook();
        return;
      }
      tr.seen++;
      yield 1;
    }
    const lanes = this.pickCargoLanes(this.volleySize(CONTAINER_AI.cargo.n));
    tr.lanes = lanes;
    tr.fire = this.world.tick;
    this.mode = 'cargo';
    for (let i = 0; i < lanes.length; i++) {
      if (!this.partAlive('doors')) break;
      this.setLoader('throw');
      const kind: CargoKind = (this.thrown + 1) % CONTAINER_AI.cargo.crateEvery === 0 ? 'crate' : 'barrel';
      this.launch(lanes[i], kind);
      yield CONTAINER_AI.cargo.gap;
      if (i + 1 < lanes.length) this.setLoader('lift');
    }
    if (this.loader !== 'gone') this.setLoader('stand');
    this.brakeT = 0;
    this.mode = 'cruise';
    yield CONTAINER_AI.cargo.hold;
    if (!this.doorsGone) {
      this.doorTarget = 0;
      this.world.audio.sfx('ring/lorry-door', { pitch: 0.9 });
    }
  }

  /** One piece of cargo out of the door into `lane`. */
  private launch(lane: number, kind: CargoKind): void {
    const C = CONTAINER_AI.cargo;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const x0 = this.x + LORRY.cargoOut[0] + OX;
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
    const f = this.world.spawn(FORKLIFT_ID, this.x + LORRY.bayX + OX, this.y, { lorry: this });
    this.forklift = f instanceof RingForklift ? f : null;
    this.world.audio.sfx('ring/forklift-whine');
    yield 50;
  }

  // ------------------------------------------------------------------------------- stagger

  protected override canStagger(): boolean {
    return !(this.panelT >= 0 && !this.panelDown);
  }

  protected override cutAttack(): boolean {
    this.endAttackLook();
    return true;
  }

  protected override onStagger(ticks: number): void {
    this.say('!', { at: [10, -72], ticks: Math.min(60, ticks) });
  }

  /** End a running attack's look: the brake lights, the loader's drum, the door. */
  endAttackLook(): void {
    this.mode = 'cruise';
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

  protected override think(): void {
    super.think();
    // The door, the panel, the loader.
    const dt = 1 / 8;
    if (this.doorOpen < this.doorTarget) this.doorOpen = Math.min(this.doorTarget, this.doorOpen + dt);
    else if (this.doorOpen > this.doorTarget) this.doorOpen = Math.max(this.doorTarget, this.doorOpen - dt);
    const doors = this.parts[P_DOORS];
    const dx = this.doorOpen > 0.5 && !this.doorsGone ? CONTAINER_X.doorsOpen : CONTAINER_X.doors;
    doors.box.x = dx[0];
    doors.box.w = dx[1] - dx[0];
    if (this.panelT >= 0 && this.panelT < CONTAINER_AI.panelTicks) {
      this.panelT++;
      if (this.panelT === CONTAINER_AI.panelTicks) this.panelLands();
      else if (this.panelT % 6 === 0) this.world.camera.shake(1, 3);
    }
    this.loaderT++;
    if (this.loader === 'throw' && this.loaderT >= 10) this.loader = 'stand';
    // Wagons that touch it (the open door reaches back).
    const rear = this.x + (this.doorOpen > 0.5 && !this.doorsGone ? CONTAINER_X.doorsOpen[0] : 0);
    if (this.state === 'fight' || this.state === 'intro') pushWagonsOut(this, rear, this.x + this.length, this.touched);
    // The forklift.
    if (this.forklift && !this.forklift.alive) {
      this.forklift = null;
      this.forkCool = CONTAINER_AI.forklift.cool;
    }
    if (this.forkCool > 0 && !this.holdAdds) this.forkCool--;
    // Damage: the dragging rims spark, the panel ramp scrapes, the box smokes.
    if (this.bogieBroken && this.t % 4 === 0) {
      const wx = CONTAINER_X.wheels[(this.t >> 2) % 3];
      hitSpark(this.world, this.x + wx - 4, this.y - 1, -1);
      if (this.t % 48 === 0) this.world.audio.sfx('ring/lorry-scrape', { vol: 0.6 });
    }
    if (this.panelDown && this.t % 9 === 0) hitSpark(this.world, this.x + 32 + ((this.t * 37) % 110), this.y + 9, -1);
    zwaanSmoke(this.world, this.x, this.y, this.damageState, this.t, SMOKE);
  }

  /** The ramp hits the road: a bang, sparks along it. */
  private panelLands(): void {
    const w = this.world;
    w.camera.shake(3, 12);
    w.audio.sfx('ring/lorry-slam');
    for (let i = 0; i < 6; i++) hitSpark(w, this.x + 12 + i * 22, this.y + 8, -1);
    dust(w, this.x + 72, this.y + 8, 8);
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, part = 0): boolean {
    const p = this.parts[part];
    if (this.state === 'fight' && !this.dead && this.invulnTicks <= 0 && p && p.enabled && !p.destroyed && !p.armored && d.amount > 0 && !this.panelDown) {
      // The phase-1 floor: the pool holds at the phase-2 line until the side panel is down.
      const mul = p.multiplier;
      const room = Math.max(0, this.hp - Math.floor(this.maxHp * CONTAINER_AI.phase2));
      if (d.amount * mul > room) d = { ...d, amount: room / mul };
    }
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && part === P_BOX && this.world.tick % 3 === 0) {
      // Shots on the container's side clang off it.
      if (this.world.tick % 6 === 0) this.world.audio.sfx('ring/dent', { vol: 0.5 });
      hitSpark(this.world, this.x + (d.dirX < 0 ? CONTAINER_X.box[1] : CONTAINER_X.box[0]), this.y - 30, -(d.dirX || 1));
    }
    return hit;
  }

  override partSpot(i: number): [number, number] {
    const xs = i === P_DOORS ? CONTAINER_X.doors : i === P_BOGIE ? CONTAINER_X.bogie : CONTAINER_X.box;
    const ys = i === P_DOORS ? -40 : i === P_BOGIE ? -8 : -42;
    const out = super.partSpot(i);
    out[0] = this.x + (xs[0] + xs[1]) / 2;
    out[1] = this.y + ys;
    return out;
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
      tumbleOff(w, this.x + LORRY.door.hinge + OX - 13, this.y - 2, { sprite: SPR.doorFall, vx: road * 0.6, vy: 1.2, lift: 22, vlift: 2.2, bounces: 1, rest: 50, restFrame: 2, tpf: 4, shadowW: 22, z: 33 });
      this.brakeT = 0;
      w.audio.sfx('ring/lorry-door', { pitch: 0.7 });
      this.checkPhases();
    } else if (p.index === P_BOGIE) {
      this.bogieBroken = true;
      w.audio.sfx('ring/lorry-scrape');
      for (const wx of CONTAINER_X.wheels) debris(w, this.x + wx, this.y - 6, 'dirt', 4);
    }
  }

  /** The loader jumps off (bloodless; `always`: even from behind the shut door) and sits dazed on the hard shoulder. */
  private loaderJumps(always = false): void {
    const w = this.world;
    const road = ringOf(w)?.roadSpeed ?? 0;
    if (this.loader !== 'gone' && (always || this.doorOpen > 0.6)) {
      tumbleOff(w, this.x + LORRY.loader[0] + OX, this.y, {
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

  // ------------------------------------------------------------------------------- beaten

  protected override onDeathStart(): void {
    this.endAttackLook();
    this.loaderJumps();
    this.doorTarget = 0;
    if (this.forklift?.alive) this.forklift.setLeave();
    super.onDeathStart();
  }

  protected override beatenMove(rel: number): void {
    super.beatenMove(rel);
    // The door swings shut while it brakes.
    if (this.doorOpen > 0) this.doorOpen = Math.max(0, this.doorOpen - 1 / 8);
  }

  // ------------------------------------------------------------------------------- drawing

  /** The look scratch (no allocation per frame). */
  private readonly look: ContainerLook = { tick: 0, roll: 0 };

  override draw(r: Renderer): void {
    const o = this.look;
    o.tick = this.world.tick;
    o.roll = this.roll;
    o.sh = this.staggerTicks > 0 && Math.floor(this.world.tick / 2) % 2 === 0 ? 1 : 0;
    o.state = this.damageState;
    o.flashDoors = this.parts[P_DOORS].flash > 0 && this.world.tick % 2 === 0;
    o.flashBogie = this.parts[P_BOGIE].flash > 0 && this.world.tick % 2 === 0;
    o.doorOpen = this.doorOpen;
    o.doorState = this.partState(this.parts[P_DOORS]);
    o.doorsGone = this.doorsGone;
    o.panelT = this.panelT;
    o.loader = this.loader;
    o.loaderT = this.loaderT;
    o.t = this.t;
    o.bogieBroken = this.bogieBroken;
    o.brake = this.brakeT > 0;
    o.loose = this.beaten !== null;
    o.tip = this.beaten === 'tip' ? Math.min(2, Math.floor(this.beatT / 8)) : this.beaten === 'wreck' ? 2 : -1;
    drawContainer(r, this.x, this.y, o);
  }
}

/** What `drawContainer` needs (the live part, or the waiting one with the defaults). */
export interface ContainerLook {
  tick: number;
  roll: number;
  sh?: number;
  state?: number;
  flashDoors?: boolean;
  flashBogie?: boolean;
  doorOpen?: number;
  doorState?: number;
  doorsGone?: boolean;
  panelT?: number;
  loader?: LoaderMode;
  loaderT?: number;
  t?: number;
  bogieBroken?: boolean;
  brake?: boolean;
  /** Uncoupled: the drawbar lies on the road. */
  loose?: boolean;
  /** −1 upright; 0 … 2 the tip frames (beaten). */
  tip?: number;
}

/** The container trailer with its REAR at world (x, plane y). */
export function drawContainer(r: Renderer, x0: number, y0: number, o: ContainerLook): void {
  const x = Math.round(x0);
  const y = Math.round(y0);
  const L = CONTAINER_AI.length;
  const tip = o.tip ?? -1;
  if (tip >= 0) {
    // Beaten: the trailer lies on its side (the container's box-tip frames; the chassis under it).
    drawZwaanShadow(r, x + 4, y, L - 20, 0.35);
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(SPR.boxTip, tip, x + OX + (LORRY.container.x0 + LORRY.container.x1) / 2, y, drawOpts);
    return;
  }
  const sh = o.sh ?? 0;
  const X = x + OX + sh;
  const state = o.state ?? 0;
  const panelT = o.panelT ?? -1;
  drawZwaanShadow(r, x, y, L);
  drawOpts.flipX = false;
  drawOpts.flash = false;
  // The dolly's frame under the front, the chassis, the container (or the open hold).
  drawZwaanDolly(r, x + L + sh, y, o.roll, false);
  r.sprite(SPR.trailer, 0, X, y, drawOpts);
  drawOpts.flash = false;
  if (panelT >= 0) r.sprite(SPR.hold, state, X, y, drawOpts);
  else r.sprite(SPR.container(state), 0, X, y, drawOpts);
  // The rear door (behind the loader), then the loader in the doorway (he faces back).
  const open = o.doorOpen ?? 0;
  if (!o.doorsGone) {
    drawOpts.flash = o.flashDoors === true;
    const df = open <= 0.01 ? 0 : open < 0.6 ? 1 : (o.doorState ?? 0) >= 2 ? 3 : 2;
    r.sprite(SPR.doors, df, X, y, drawOpts);
  }
  const loader = o.loader ?? 'stand';
  if (loader !== 'gone' && open > 0.6) {
    drawOpts.flipX = true;
    drawOpts.flash = o.flashDoors === true;
    const lt = o.loaderT ?? 0;
    const lf = loader === 'lift' ? Math.min(2, Math.floor(lt / 8)) : loader === 'throw' ? Math.min(1, Math.floor(lt / 5)) : Math.floor((o.t ?? o.tick) / 30) % 2;
    r.sprite(SPR.loader(loader), lf, X + LORRY.loader[0], y - LORRY.deck, drawOpts);
    drawOpts.flipX = false;
  }
  // The bogie's wheels (or the rims), the dolly's drawbar.
  drawZwaanWheels(r, x + sh, y, CONTAINER_X.wheels, o.roll, { rims: o.bogieBroken, flash: o.flashBogie });
  drawZwaanCoupling(r, x + L + sh, y, o.loose === true);
  drawOpts.flash = false;
  // The dropped side panel lies in front of the wheels (the near side).
  if (panelT >= 0) r.sprite(SPR.panel, panelT < 12 ? 0 : panelT < 26 ? 1 : panelT < CONTAINER_AI.panelTicks ? 2 : 3, X, y, drawOpts);
  // The brake lights (the cargo tell, the beaten brake).
  if (o.brake && o.tick % 30 < 26) r.sprite(SPR.brake, 0, X + LORRY.brakeAt[0], y + LORRY.brakeAt[1], drawOpts);
}

/** The waiting look (no allocation per frame). */
const WAITING: ContainerLook = { tick: 0, roll: 0 };

defineEntity(RING_ZWAAN.container, (w, x, y, p) => new ZwaanContainer(w, x, y, p ?? NO_PARAMS), {
  category: 'boss',
  score: ZWAAN.score.trailer,
  description: 'ZWAAN train part 1, the container trailer (ZWAAN CONTAINER): cargo dumps, then the side panel drops and a forklift charges; weak points the doors and the bogie (params hp, hpScale, lane, rate, index).',
});
defineZwaanPart(RING_ZWAAN.container, {
  length: CONTAINER_AI.length,
  drawWaiting: (r, x, y, tick) => {
    WAITING.tick = tick;
    WAITING.roll = x;
    drawContainer(r, x, y, WAITING);
  },
});
defineRingArt(RING_ZWAAN.container, [`${zwaanArt(RING_ZWAAN.container)}/`, ZWAAN_KIT_ART]);
