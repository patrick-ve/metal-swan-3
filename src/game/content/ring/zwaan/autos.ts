/**
 * `ring-zwaan-autos` — the ZWAAN train's CAR TRANSPORTER (bar name ZWAAN AUTOTRANSPORT; docs/design/
 * ring.md §R.3, part 2 of 5). A `ZwaanPart` (part.ts) on the ring plane: rear end = its anchor,
 * 196 px forward its front (the drawbar); lanes 1–2. Two decks with civilian-style hatches (no
 * badge, no plate; `ZwaanCar`, below).
 *
 * ATTACKS (each after a tell of ≥ 18 ticks on screen; `mode` 'tell-X' → 'X' for the sim's watch):
 * - ROLL-OFF: the rear ramp lowers with a hydraulic hiss (the tell: `ramp` frames 0 → 3, the
 *   brake lights), then the lower deck's rear car ROLLS OFF BACKWARDS down the ramp onto the road
 *   and veers into its lane (the target wagon's lane first; never the last free lane);
 * - SLIDE-DOWN: the upper deck's rear section tilts (the tell: its front rises, the hiss), the car
 *   on it SLIDES DOWN off the rear edge, falls onto the road, bounces once and veers into its lane;
 * - the dropped cars (`ring-zwaan-car`, `ZwaanCar`) are obstacles that drift back: cover like a
 *   civilian car (a neutral SolidBox: they stop both teams' shots in their lane), a wagon that drives
 *   into one pays a cell; at least one open lane stays free of them (`pickLanes`);
 * - after a drop the deck's front car rolls back into the empty slot and a new one comes out from
 *   behind the headboard (`stock` cars per deck).
 *
 * PARTS (pool model; side by side, never overlapping): 0 `deck` (x 14 … 52, × 1; part 0 is what the
 * bot aims at, it never breaks), 1 `ram-r` (the ramp's ram, × 1.5, own HP, passed on), 2 `ram-f`
 * (the deck ram, × 1.5, own HP, passed on), 3 `deck-front` (x 68 … 196, × 1).
 * A broken ram (+1000) snaps and leaks dark oil: the ramp then hangs on the road (it scrapes, the
 * roll-off's tell is the car's hazard lights and a creak), the deck sags to its full tilt (the slide's
 * tell is the strap creaking, the car shaking). Phase 2 (HP ≤ 50 % or both rams broken): shorter
 * pauses and a slide right after each roll-off.
 *
 * BEATEN (2,000 points): uncouple → brake → the decks fold (the ramp drops, the upper deck tips)
 * → it swerves onto the hard shoulder and the cars on it spill onto the shoulder (unhurt, no
 * blast: dust and a crash) → the drop → the wreck drops back.
 *
 * Params: `hp`, `hpScale`, `lane`, `rate` (HP per tick of the base pool; 0 = no limit), `index`,
 * `stock` (cars per deck behind the two slots; default 4).
 */
import type { Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import type { BossPart } from '../../../boss';
import { dust, hitSpark, smokeTrail, steamPuff } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { defineRingArt } from '../../../ring/art-def';
import { ringOf } from '../../../ring/entity';
import { LANE_GAP, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { type Wagon } from '../../../ring/wagon';
import { ZWAAN, ZWAAN_NAMES, defineZwaanPart } from './api';
import { AUTOS, AUTOS_ART, AUTOS_CARS, AUTOS_ID, AUTOS_SPR, CAR_H, CAR_LEN, CAR_TILTS, CAR_WHEEL_R, CAR_WHEELS, rampY, upDeckY } from './autos-geo';
import { bodySpark, busyLanes, pickLanes, ZwaanObstacle } from './autos-kit';
import { drawZwaanCoupling, drawZwaanDolly, drawZwaanHitch, drawZwaanShadow, drawZwaanWheels, pushWagonsOut, uncoupleFx, ZWAAN_KIT_ART, ZWAAN_PACE, zwaanRate } from './kit';
import { ZwaanPart, zwaanSlab } from './part';

export const ZWAAN_CAR_ID = 'ring-zwaan-car';

/** Tuning (ticks, px, px/tick; HP before difficulty × co-op). */
export const AUTOS_AI = {
  /** The pool (the bar) and the rams' own HP (passed on). */
  /**
   * The pool: a little under the kit's trailer HP (the bot measured its attacks slow it more than the
   * container's: ring sims seeds 1–3, 2026-10-22, at the full HP 37–40 s with the pistol). Fixer
   * (2026-10-22): 0.88 → 0.8 (the pistol 39 s → about 36 s; the special guns stay at the 30 s floor).
   */
  hp: Math.round(ZWAAN_PACE.trailerHp * 0.8),
  ram: 380,
  ramMul: 1.5,
  deckMul: 1,
  /** The damage-rate bucket (HP per tick of the base pool; kit.ts `zwaanRate`: ≥ 30 s with the best gun). */
  rate: zwaanRate(Math.round(ZWAAN_PACE.trailerHp * 0.8)),
  /** Telegraph bases (× difficulty, never below 18). */
  rollTell: 32,
  slideTell: 32,
  /** The ramp's and the deck's motion (ticks for the whole way). */
  rampTicks: 22,
  tiltTicks: 22,
  /** Pauses (× the difficulty's fire interval): after a roll-off, after a slide; phase 2. */
  pause: 70,
  pause2: 40,
  /** A car on the deck rolls back at up to this many px/tick (it starts at 0.5). */
  roll: 2.4,
  /** The deck's front car rolls back into the empty slot over this many ticks. */
  shuffle: 34,
  /** Cars per deck behind the two slots. */
  stock: 4,
  /** Phase 2 at this HP fraction. */
  phase2: 0.5,
  score: ZWAAN.score.trailer,
} as const;

/** Tuning of a dropped car. */
export const CAR_AI = {
  /** Screen speed back along the road (px/tick), the veer into its lane (px/tick). */
  rel: -1.5,
  veer: 1.4,
  /** The fall's gravity and the one bounce. */
  gravity: 0.34,
  bounce: 2,
  /** A spilled car (the beaten trailer) slides onto the hard shoulder at this speed. */
  spill: 1.1,
} as const;

/** One attack of the fight (tests): its tell tick, its strike tick (−1 = cut), the tell ticks on screen, the lane. */
export interface AutosAttackTrace {
  attack: 'roll' | 'slide';
  tell: number;
  fire: number;
  seen: number;
  lane: number;
}

const P_DECK = 0;
const P_RAMR = 1;
const P_RAMF = 2;
const P_FRONT = 3;
const drawOpts: DrawOpts = {};

/** The frame index of the nearest car tilt. */
function tiltFrame(deg: number): number {
  let best = 0;
  for (let i = 1; i < CAR_TILTS.length; i++) if (Math.abs(CAR_TILTS[i] - deg) < Math.abs(CAR_TILTS[best] - deg)) best = i;
  return best;
}

/** Draw a hatch of `colour` tilted `deg` with its anchor at (x, y) (world), the wheels turned by `roll`. */
export function drawCar(r: Renderer, colour: string, x: number, y: number, deg: number, roll: number): void {
  const f = tiltFrame(deg);
  const a = (CAR_TILTS[f] * Math.PI) / 180;
  drawOpts.flipX = false;
  drawOpts.flash = false;
  const wf = Math.floor(roll / 2) & 3;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const wy = -CAR_WHEEL_R - 0.5;
  // The body first, then the hubbed wheels in its arches (fixer, 2026-10-22: drawn under the body,
  // the art's dark wheel wells covered them and the cars rolled on black discs).
  r.sprite(AUTOS_SPR.car(colour), f, Math.round(x), Math.round(y), drawOpts);
  for (const wx of CAR_WHEELS) {
    // Rear down: the turn by −deg (screen y down): (x, y) → (x cos + y sin, −x sin + y cos).
    const rx = wx * cs + wy * sn;
    const ry = -wx * sn + wy * cs;
    r.sprite('ring/car/wheel-s', wf, Math.round(x + rx), Math.round(y + ry), drawOpts);
  }
}

// =============================================================================================
// The dropped car
// =============================================================================================

export type CarMode = 'roll' | 'slide' | 'fall' | 'road' | 'spill';

/**
 * A car off the transporter (see the header): it rolls down the ramp (`roll`) or slides down the
 * tilted deck (`slide`) on its trailer, falls (`fall`, one bounce), then drifts back along the road
 * as an obstacle (`road`), veering into its lane. `spill`: off the beaten trailer onto the hard
 * shoulder (not solid). Params: `colour`, `mode`, `host` (the transporter), `lx` (local x on it),
 * `lane` (its target lane), `lift`.
 */
export class ZwaanCar extends ZwaanObstacle {
  readonly colour: string;
  mode: CarMode;
  /** The transporter it is still on (roll / slide) and its local x there. */
  host: AutosPart | null;
  lx: number;
  /** Its target lane (veers there on the road). */
  lane: number;
  deg = 0;
  vlift = 0;
  bounced = false;
  t = 0;
  private speed = 0.5;
  private wheel = 0;
  private restY = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, CAR_LEN - 2, CAR_H);
    this.colour = typeof p.colour === 'string' && (AUTOS_CARS as readonly string[]).includes(p.colour) ? p.colour : AUTOS_CARS[0];
    const m = p.mode;
    this.mode = m === 'roll' || m === 'slide' || m === 'fall' || m === 'spill' ? m : 'road';
    this.host = p.host instanceof AutosPart ? p.host : null;
    if (!this.host && (this.mode === 'roll' || this.mode === 'slide')) this.mode = 'road';
    this.lx = paramNum(p, 'lx', 0);
    this.lane = Math.max(1, Math.min(4, Math.round(paramNum(p, 'lane', nearestLane(y)))));
    this.lift = paramNum(p, 'lift', 0);
    this.vx = ringOf(world)?.roadSpeed ?? 0;
    this.solid = this.mode === 'road';
    this.restY = SHOULDER_TOP + 3;
    this.addTag(ZWAAN_CAR_ID);
    this.syncBox();
  }

  /** The lane it blocks (for the free-lane rule): its target lane. */
  busyLane(): number {
    return this.mode === 'spill' ? 0 : this.lane;
  }

  override update(): void {
    this.t++;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const h = this.host;
    if ((this.mode === 'roll' || this.mode === 'slide') && (!h || !h.alive || h.beaten)) this.release(h ? 'fall' : 'road');
    switch (this.mode) {
      case 'roll':
        this.rollOn(h as AutosPart);
        break;
      case 'slide':
        this.slideOn(h as AutosPart);
        break;
      case 'fall': {
        this.vx = road + CAR_AI.rel * 1.2;
        this.x += this.vx;
        this.vlift -= CAR_AI.gravity;
        this.lift += this.vlift;
        this.deg = Math.max(0, this.deg - 0.9);
        this.veer(LANE_GAP / 14);
        if (this.lift <= 0) {
          this.lift = 0;
          if (!this.bounced) {
            this.bounced = true;
            this.vlift = CAR_AI.bounce;
            this.world.audio.sfx('ring/zwaan/car-bounce');
            dust(this.world, this.x - 20, this.y, 3);
            dust(this.world, this.x + 20, this.y, 3);
            this.world.camera.shake(2, 6);
          } else this.toRoad();
        }
        break;
      }
      case 'road':
        this.vx = road + CAR_AI.rel;
        this.x += this.vx;
        this.veer(CAR_AI.veer);
        if (this.lift > 0 || this.vlift > 0) {
          this.vlift -= CAR_AI.gravity;
          this.lift = Math.max(0, this.lift + this.vlift);
          if (this.lift === 0) this.vlift = 0;
        }
        break;
      case 'spill': {
        // Off the beaten trailer onto the hard shoulder: it slows to a stop there (world-fixed).
        this.vx = Math.max(0, this.vx * 0.96);
        this.x += this.vx;
        if (this.y < this.restY) this.y = Math.min(this.restY, this.y + CAR_AI.spill);
        this.vlift -= CAR_AI.gravity;
        this.lift = Math.max(0, this.lift + this.vlift);
        if (this.lift === 0) this.vlift = Math.abs(this.vlift) > 1.2 ? -this.vlift * 0.3 : 0;
        this.deg = this.y >= this.restY ? Math.max(0, this.deg - 1) : Math.min(16, this.deg + 0.6);
        break;
      }
    }
    this.wheel += Math.abs(this.vx - (this.mode === 'road' ? road : 0)) + (this.mode === 'roll' ? this.speed : 0);
    this.obstacleTick();
    if (this.x + this.len < this.world.camera.x - 16) this.remove();
  }

  /** On the lowered ramp: rolls back faster and faster; the tilt from its wheels' ground heights. */
  private rollOn(h: AutosPart): void {
    this.speed = Math.min(AUTOS_AI.roll, this.speed + 0.06);
    this.lx -= this.speed;
    const g = (x: number): number => (h.rampDown ? rampY(x) : x >= AUTOS.hinge[0] ? AUTOS.lowY : 0);
    const yr = g(this.lx + CAR_WHEELS[0]);
    const yf = g(this.lx + CAR_WHEELS[1]);
    this.deg = (Math.atan2(yr - yf, CAR_WHEELS[1] - CAR_WHEELS[0]) * 180) / Math.PI;
    this.x = h.x + this.lx;
    this.y = h.y;
    this.vx = h.vx - this.speed;
    this.lift = -(yr + yf) / 2;
    this.solid = this.lift < 5;
    if (this.lx + CAR_WHEELS[1] < AUTOS.rampFoot - 1) this.release('road');
  }

  /** On the tilted upper deck: slides off the rear edge, then falls. */
  private slideOn(h: AutosPart): void {
    this.speed = Math.min(AUTOS_AI.roll + 0.6, this.speed + 0.09);
    this.lx -= this.speed;
    this.deg = Math.max(0, h.tiltDeg);
    this.x = h.x + this.lx;
    this.y = h.y;
    this.vx = h.vx - this.speed;
    this.lift = -upDeckY(Math.max(AUTOS.tiltX[0], this.lx), h.tiltDeg);
    if (this.lx < AUTOS.tiltX[0] + 4) this.release('fall');
  }

  /** Off the trailer: falls or drives on the road. */
  release(mode: 'fall' | 'road'): void {
    this.host = null;
    if (mode === 'fall') {
      this.mode = 'fall';
      this.vlift = 0.4;
      this.solid = false;
    } else this.toRoad();
  }

  private toRoad(): void {
    this.mode = 'road';
    this.solid = true;
    this.deg = 0;
    this.vlift = 0;
  }

  /** Move the plane y toward the target lane. */
  private veer(speed: number): void {
    const ty = laneY(this.lane);
    const dy = ty - this.y;
    this.y += Math.abs(dy) <= speed ? dy : Math.sign(dy) * speed;
  }

  protected override onShot(x: number): void {
    if (this.shots % 3 === 1) this.world.audio.sfx('ring/dent', { vol: 0.6 });
    if (this.shots % 6 === 0) hitSpark(this.world, x, this.y - 10 - this.lift, -1);
  }

  override draw(r: Renderer): void {
    drawCar(r, this.colour, this.x, this.y - this.lift, this.deg, this.wheel);
  }
}

defineEntity(ZWAAN_CAR_ID, (w, x, y, p) => new ZwaanCar(w, x, y, p), {
  category: 'prop',
  description: 'A car off the ZWAAN car transporter: rolls / slides off, then drifts back along its lane as cover; a wagon that drives into it pays a cell (params colour, mode, host, lx, lane, lift).',
});

// =============================================================================================
// The transporter
// =============================================================================================

type Slot = string | null;

export class AutosPart extends ZwaanPart {
  /** Cars in the slots ([rear, front]) and behind them. */
  readonly low: [Slot, Slot] = [null, null];
  readonly up: [Slot, Slot] = [null, null];
  lowStock: number;
  upStock: number;
  /** The front car rolling back into the rear slot: px left (0 = none) per deck. */
  lowShift = 0;
  upShift = 0;
  /** The ramp: 0 stowed … 3 on the road (and its target); broken: it hangs on the road. */
  ramp = 0;
  rampTarget = 0;
  /** The upper deck's tilt (degrees) and its target. */
  tiltDeg = 0;
  tiltTarget = 0;
  rampBroken = false;
  deckBroken = false;
  /** Hazard blink ticks (the roll-off's tell when the ramp is broken), the strap shake (the slide's). */
  hazardT = 0;
  shakeT = 0;
  mode: 'cruise' | 'tell-roll' | 'roll' | 'tell-slide' | 'slide' = 'cruise';
  readonly trace: AutosAttackTrace[] = [];
  /** Cars dropped so far (tests). */
  dropped2 = 0;
  /** Cars spilled at the end (tests). */
  spilled = 0;
  private carNo = 0;
  private readonly touched = new WeakMap<Wagon, number>();
  private readonly busy = new Set<number>();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: AUTOS_ART, name: ZWAAN_NAMES[AUTOS_ID], hp: AUTOS_AI.hp, score: AUTOS_AI.score, length: AUTOS.length, height: AUTOS.height });
    const k = paramNum(p, 'hpScale', 1);
    const base = Math.max(1, Math.round(paramNum(p, 'hp', AUTOS_AI.hp) * k));
    const scale = this.maxHp / base;
    this.dmgRate = Math.max(0, paramNum(p, 'rate', AUTOS_AI.rate)) * scale;
    const ram = Math.max(1, Math.round(AUTOS_AI.ram * k));
    // The parts never overlap (a straight-across shot takes the first box it meets; ties go to the
    // lowest index): part 0 is a wide deck section (the bot aims at part 0; it never breaks).
    this.addPart('deck', { box: zwaanSlab(AUTOS.ramR[1], AUTOS.ramF[0]), multiplier: AUTOS_AI.deckMul });
    this.addPart('ram-r', { box: zwaanSlab(AUTOS.ramR[0], AUTOS.ramR[1]), hp: ram, shared: true, multiplier: AUTOS_AI.ramMul });
    this.addPart('ram-f', { box: zwaanSlab(AUTOS.ramF[0], AUTOS.ramF[1]), hp: ram, shared: true, multiplier: AUTOS_AI.ramMul });
    this.addPart('deck-front', { box: zwaanSlab(AUTOS.ramF[1], AUTOS.length), multiplier: AUTOS_AI.deckMul });
    this.hitbox = { x: 0, y: -AUTOS.height, w: AUTOS.length, h: AUTOS.height };
    const stock = Math.max(0, Math.round(paramNum(p, 'stock', AUTOS_AI.stock)));
    this.lowStock = stock;
    this.upStock = stock;
    this.low[0] = this.nextCar();
    this.low[1] = this.nextCar();
    this.up[0] = this.nextCar();
    this.up[1] = this.nextCar();
    this.phases = [
      { at: 1, name: 'drops', pattern: (b) => b.phaseDrops(false) },
      { at: AUTOS_AI.phase2, when: (b) => b.rampBroken && b.deckBroken, name: 'frenzy', onEnter: (b) => b.resetAttack(), pattern: (b) => b.phaseDrops(true), resume: (b) => b.phaseDrops(true) },
    ];
  }

  /** The next car's colour (a fixed cycle: no rng). */
  private nextCar(): string {
    return AUTOS_CARS[(this.carNo++ * 2 + this.index) % AUTOS_CARS.length];
  }

  /** The ramp lies on the road (a car may roll down it). */
  get rampDown(): boolean {
    return this.ramp >= 2.99;
  }

  // ------------------------------------------------------------------------------- phases

  *phaseDrops(frenzy: boolean): ScriptGen {
    yield 24;
    for (;;) {
      if (this.low[0]) yield* this.rollOff();
      yield this.recoveryFor(frenzy ? AUTOS_AI.pause2 : AUTOS_AI.pause);
      if (this.up[0]) yield* this.slideDown();
      yield this.recoveryFor(frenzy ? AUTOS_AI.pause2 : AUTOS_AI.pause);
      // Nothing left on the decks: the trailer just pulls (the fight goes on with the shots).
      if (!this.low[0] && !this.up[0]) yield 60;
    }
  }

  private mark(attack: AutosAttackTrace['attack']): AutosAttackTrace {
    const tr: AutosAttackTrace = { attack, tell: this.world.tick, fire: -1, seen: 0, lane: 0 };
    this.trace.push(tr);
    return tr;
  }

  private inView(): boolean {
    return this.world.camera.containsPoint(this.x + 10, this.y - 30, -8);
  }

  private lanesFor(): number[] {
    busyLanes(this.world, [ZWAAN_CAR_ID, 'ring-zwaan-animal', 'ring-cargo'], this.busy);
    return pickLanes(this.world, 1, this.busy, this.x, this.y, (k) => this.world.rng.int(0, k - 1));
  }

  /** ROLL-OFF (see the header). */
  *rollOff(): ScriptGen {
    for (let g = 0; g < 240 && !this.inView(); g++) yield 1;
    const lanes = this.lanesFor();
    if (!this.low[0] || lanes.length === 0 || !this.inView()) return;
    const tr = this.mark('roll');
    tr.lane = lanes[0];
    this.mode = 'tell-roll';
    this.brakeT = 9999;
    if (this.rampBroken) {
      this.hazardT = 9999;
      this.world.audio.sfx('ring/zwaan/creak');
    } else {
      this.rampTarget = 3;
      this.world.audio.sfx('ring/zwaan/hydraulic');
    }
    const T = Math.max(this.telegraphFor(AUTOS_AI.rollTell), AUTOS_AI.rampTicks + 2);
    for (let i = 0; i < T; i++) {
      if (i % 9 === 0 && !this.rampBroken) steamPuff(this.world, this.x + 12, this.y - 12, -0.3, -0.3);
      tr.seen++;
      yield 1;
    }
    for (let g = 0; g < 60 && !this.rampDown; g++) yield 1;
    tr.fire = this.world.tick;
    this.mode = 'roll';
    const colour = this.low[0] as string;
    this.low[0] = null;
    this.world.spawn(ZWAAN_CAR_ID, this.x + AUTOS.lowSlots[0], this.y, { colour, mode: 'roll', host: this, lx: AUTOS.lowSlots[0], lane: lanes[0] });
    this.dropped2++;
    this.world.audio.sfx('ring/zwaan/car-roll');
    yield 44;
    this.hazardT = 0;
    this.brakeT = 0;
    this.mode = 'cruise';
    if (!this.rampBroken) {
      this.rampTarget = 0;
      this.world.audio.sfx('ring/zwaan/hydraulic', { pitch: 1.2, vol: 0.6 });
    }
    this.refill('low');
  }

  /** SLIDE-DOWN (see the header). */
  *slideDown(): ScriptGen {
    for (let g = 0; g < 240 && !this.inView(); g++) yield 1;
    const lanes = this.lanesFor();
    if (!this.up[0] || lanes.length === 0 || !this.inView()) return;
    const tr = this.mark('slide');
    tr.lane = lanes[0];
    this.mode = 'tell-slide';
    this.brakeT = 9999;
    if (this.deckBroken) {
      this.shakeT = 9999;
      this.world.audio.sfx('ring/zwaan/creak', { pitch: 1.3 });
    } else {
      this.tiltTarget = AUTOS.tilts[3];
      this.world.audio.sfx('ring/zwaan/hydraulic', { pitch: 0.9 });
    }
    const T = Math.max(this.telegraphFor(AUTOS_AI.slideTell), AUTOS_AI.tiltTicks + 2);
    for (let i = 0; i < T; i++) {
      if (i % 9 === 0 && !this.deckBroken) steamPuff(this.world, this.x + AUTOS.ramFx, this.y - 24, 0.2, -0.3);
      tr.seen++;
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'slide';
    const colour = this.up[0] as string;
    this.up[0] = null;
    this.shakeT = 0;
    this.world.spawn(ZWAAN_CAR_ID, this.x + AUTOS.upSlots[0], this.y, { colour, mode: 'slide', host: this, lx: AUTOS.upSlots[0], lane: lanes[0], lift: -upDeckY(AUTOS.upSlots[0], this.tiltDeg) });
    this.dropped2++;
    this.world.audio.sfx('ring/zwaan/car-roll', { pitch: 1.15 });
    yield 40;
    this.brakeT = 0;
    this.mode = 'cruise';
    if (!this.deckBroken) {
      this.tiltTarget = 0;
      this.world.audio.sfx('ring/zwaan/hydraulic', { pitch: 1.2, vol: 0.6 });
    }
    for (let g = 0; g < 60 && this.tiltDeg > 0.5 && !this.deckBroken; g++) yield 1;
    this.refill('up');
  }

  /** The deck's front car rolls back into the empty rear slot; a new one comes out at the front. */
  private refill(deck: 'low' | 'up'): void {
    const slots = deck === 'low' ? this.low : this.up;
    if (slots[0] || !slots[1]) return;
    slots[0] = slots[1];
    slots[1] = null;
    const span = (deck === 'low' ? AUTOS.lowSlots[1] - AUTOS.lowSlots[0] : AUTOS.upSlots[1] - AUTOS.upSlots[0]);
    if (deck === 'low') this.lowShift = span;
    else this.upShift = span;
    const left = deck === 'low' ? this.lowStock : this.upStock;
    if (left > 0) {
      slots[1] = this.nextCar();
      if (deck === 'low') this.lowStock--;
      else this.upStock--;
    }
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    super.think();
    const rs = 3 / AUTOS_AI.rampTicks;
    if (this.ramp < this.rampTarget) this.ramp = Math.min(this.rampTarget, this.ramp + rs);
    else if (this.ramp > this.rampTarget) this.ramp = Math.max(this.rampTarget, this.ramp - rs);
    const ts = AUTOS.tilts[3] / AUTOS_AI.tiltTicks;
    if (this.tiltDeg < this.tiltTarget) this.tiltDeg = Math.min(this.tiltTarget, this.tiltDeg + ts);
    else if (this.tiltDeg > this.tiltTarget) this.tiltDeg = Math.max(this.tiltTarget, this.tiltDeg - ts);
    const sh = (AUTOS.lowSlots[1] - AUTOS.lowSlots[0]) / AUTOS_AI.shuffle;
    if (this.lowShift > 0) this.lowShift = Math.max(0, this.lowShift - sh);
    if (this.upShift > 0) this.upShift = Math.max(0, this.upShift - sh);
    if (this.hazardT > 0) this.hazardT--;
    if (this.shakeT > 0) this.shakeT--;
    // The broken ramp drags on the road: sparks.
    if (this.rampBroken && this.t % 5 === 0) hitSpark(this.world, this.x + AUTOS.rampFoot + 3, this.y - 1, -1);
    if (this.rampBroken && this.t % 60 === 0) this.world.audio.sfx('ring/lorry-scrape', { vol: 0.45 });
    if (this.state === 'fight' || this.state === 'intro') pushWagonsOut(this, this.x + (this.ramp > 1.5 ? AUTOS.rampFoot : 0), this.x + this.length, this.touched);
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && (part === P_DECK || part === P_FRONT)) {
      if (this.world.tick % 6 === 0) this.world.audio.sfx('ring/dent', { vol: 0.45 });
      bodySpark(this.world, this.partRect(this.parts[part]), this.y, d.dirX);
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    const w = this.world;
    if (p.index === P_RAMR) {
      this.rampBroken = true;
      this.rampTarget = 3;
      w.audio.sfx('ring/zwaan/ram-snap');
      w.audio.sfx('ring/lorry-slam', { pitch: 1.2, vol: 0.7 });
      for (let i = 0; i < 4; i++) hitSpark(w, this.x - 10 - i * 6, this.y - 2, -1);
    } else if (p.index === P_RAMF) {
      this.deckBroken = true;
      this.tiltTarget = AUTOS.tilts[3];
      w.audio.sfx('ring/zwaan/ram-snap');
    }
    this.checkPhases();
  }

  protected override cutAttack(): boolean {
    this.resetAttack();
    return true;
  }

  /** End a running attack's look (a stagger, a new phase): the ramp up, the deck down, the slots refilled. */
  resetAttack(): void {
    this.mode = 'cruise';
    this.brakeT = 0;
    this.hazardT = 0;
    this.shakeT = 0;
    if (!this.rampBroken) this.rampTarget = 0;
    if (!this.deckBroken) this.tiltTarget = 0;
    this.refill('low');
    this.refill('up');
  }

  // ------------------------------------------------------------------------------- beaten

  protected override *beatenSequence(): ScriptGen {
    const w = this.world;
    const B = ZWAAN.beaten;
    this.mode = 'cruise';
    w.audio.sfx('ring/lorry-screech');
    for (let t = 0; t < B.uncouple; t++) {
      this.beatenMove(0);
      uncoupleFx(w, this.frontX, this.y, t);
      yield 1;
    }
    // The brakes; the decks fold (the ramp drops, the upper deck tips).
    this.beaten = 'brake';
    this.brakeT = 9999;
    this.rampTarget = 3;
    this.tiltTarget = AUTOS.tilts[3];
    w.audio.sfx('ring/zwaan/hydraulic', { pitch: 0.7 });
    for (let t = 0; t < B.brake; t++) {
      this.beatenMove((B.brakeRel * t) / B.brake);
      this.think2();
      if (t % 4 === 0) dust(w, this.x + 30, this.y, 2);
      yield 1;
    }
    // Onto the hard shoulder; the cars spill off the near side onto the shoulder.
    this.beaten = 'swerve';
    const y0 = this.y;
    const y1 = SHOULDER_TOP + 2;
    for (let t = 0; t < B.swerve; t++) {
      const k = (t + 1) / B.swerve;
      this.y = y0 + (y1 - y0) * (k * k * (3 - 2 * k));
      this.beatenMove(B.brakeRel);
      this.think2();
      if (t === Math.floor(B.swerve / 2)) this.spill();
      if (t % 6 === 0) smokeTrail(w, this.x + this.length * 0.5, this.y - 30, false);
      yield 1;
    }
    this.beaten = 'tip';
    w.camera.shake(3, 12);
    w.audio.sfx('ring/lorry-slam');
    dust(w, this.x + 40, this.y, 8);
    dust(w, this.x + 140, this.y, 8);
    this.dropItem();
    for (let t = 0; t < B.tip; t++) {
      this.beatenMove(B.brakeRel);
      yield 1;
    }
    this.beaten = 'wreck';
    for (let t = 0; t < B.maxTicks && this.x + this.length > this.world.camera.x - 8; t++) {
      this.beatenMove(B.dropRel);
      if (t % 12 === 0) smokeTrail(w, this.x + 100, this.y - 40, false);
      yield 1;
    }
  }

  /** The ramp and the deck keep moving during the beaten sequence. */
  private think2(): void {
    const rs = 3 / AUTOS_AI.rampTicks;
    if (this.ramp < this.rampTarget) this.ramp = Math.min(this.rampTarget, this.ramp + rs);
    const ts = AUTOS.tilts[3] / AUTOS_AI.tiltTicks;
    if (this.tiltDeg < this.tiltTarget) this.tiltDeg = Math.min(this.tiltTarget, this.tiltDeg + ts);
  }

  /** The cars on the decks spill onto the hard shoulder (unhurt cars, no driver; not solid). */
  private spill(): void {
    const w = this.world;
    const road = ringOf(w)?.roadSpeed ?? 0;
    const put = (c: Slot, lx: number, lift: number, k: number): void => {
      if (!c) return;
      const e = w.spawn(ZWAAN_CAR_ID, this.x + lx, this.y, { colour: c, mode: 'spill', lane: 4, lift });
      e.vx = road * (0.75 - k * 0.06);
      (e as ZwaanCar).vlift = 1.2;
      this.spilled++;
    };
    put(this.low[0], AUTOS.lowSlots[0], -AUTOS.lowY, 0);
    put(this.low[1], AUTOS.lowSlots[1], -AUTOS.lowY, 1);
    put(this.up[0], AUTOS.upSlots[0], -upDeckY(AUTOS.upSlots[0], this.tiltDeg), 2);
    put(this.up[1], AUTOS.upSlots[1], -AUTOS.upY, 3);
    this.low[0] = this.low[1] = this.up[0] = this.up[1] = null;
    w.audio.sfx('ring/zwaan/car-bounce', { pitch: 0.8 });
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    drawAutos(r, this, this.x, this.y, this.world.tick);
  }
}

/** What the drawing reads (the live part, or a waiting look). */
interface AutosLook {
  readonly low: readonly Slot[];
  readonly up: readonly Slot[];
  readonly lowShift: number;
  readonly upShift: number;
  readonly ramp: number;
  readonly tiltDeg: number;
  readonly rampBroken: boolean;
  readonly deckBroken: boolean;
  readonly damageState: number;
  readonly hazardT: number;
  readonly shakeT: number;
  readonly brakeT: number;
  readonly flashTicks: number;
  readonly staggerTicks: number;
  readonly parts: readonly BossPart[];
  readonly beaten: string | null;
}

const WAITING: AutosLook = {
  low: ['gold', 'sky'],
  up: ['red', 'gable'],
  lowShift: 0,
  upShift: 0,
  ramp: 0,
  tiltDeg: 0,
  rampBroken: false,
  deckBroken: false,
  damageState: 0,
  hazardT: 0,
  shakeT: 0,
  brakeT: 0,
  flashTicks: 0,
  staggerTicks: 0,
  parts: [],
  beaten: null,
};

/** Draw the transporter with its rear at world (x0, y0) (the live part and the waiting decor). */
export function drawAutos(r: Renderer, a: AutosLook, x0: number, y0: number, tick: number): void {
  const sh = a.staggerTicks > 0 && Math.floor(tick / 2) % 2 === 0 ? 1 : 0;
  const x = Math.round(x0) + sh;
  const y = Math.round(y0);
  const fl = (i: number): boolean => (a.parts[i]?.flash ?? 0) > 0 && tick % 2 === 0;
  const s = Math.max(0, Math.min(2, a.damageState));
  const L = AUTOS.length;
  drawZwaanShadow(r, x, y, L);
  drawZwaanDolly(r, x + L, y, x0);
  drawOpts.flipX = false;
  // The big body never flashes white (a white wall reads as a glitch): the hits spark and clang.
  drawOpts.flash = false;
  r.sprite(AUTOS_SPR.frame(s), 0, x, y, drawOpts);
  // The cars on the decks (behind the headboard): the lower deck, then the upper deck.
  const roll = x0;
  const shake = a.shakeT > 0 ? (Math.floor(tick / 3) % 2) - 0.5 : 0;
  const lowY = y + AUTOS.lowY;
  if (a.low[0]) drawCar(r, a.low[0], x + AUTOS.lowSlots[0] + a.lowShift, lowY, 0, roll);
  if (a.low[1]) drawCar(r, a.low[1], x + AUTOS.lowSlots[1] + a.lowShift, lowY, 0, roll);
  // The tilting section and its car.
  drawOpts.flash = fl(P_RAMF);
  const tf = Math.min(3, Math.round(a.tiltDeg / 5));
  r.sprite(a.deckBroken ? AUTOS_SPR.updeckBroken : AUTOS_SPR.updeck, tf, x, y, drawOpts);
  drawOpts.flash = false;
  const ux = AUTOS.upSlots[0] + a.upShift;
  if (a.up[0]) drawCar(r, a.up[0], x + ux + shake, y + Math.round(upDeckY(Math.min(ux, AUTOS.tiltX[1]), a.tiltDeg)), a.tiltDeg, roll);
  if (a.up[1]) drawCar(r, a.up[1], x + AUTOS.upSlots[1] + a.upShift, y + AUTOS.upY, 0, roll);
  // The headboard over the cars' fronts (it does not flash: a white wall reads as a glitch).
  drawOpts.flash = false;
  r.sprite(AUTOS_SPR.head(s), 0, x, y, drawOpts);
  // The ramp (and its ram).
  drawOpts.flash = fl(P_RAMR);
  if (a.rampBroken) r.sprite(AUTOS_SPR.rampBroken, 0, x, y, drawOpts);
  else r.sprite(AUTOS_SPR.ramp, Math.min(3, Math.round(a.ramp)), x, y, drawOpts);
  // Wheels.
  drawOpts.flash = false;
  drawZwaanWheels(r, x, y, AUTOS.wheels, x0);
  drawZwaanCoupling(r, x + L, y, a.beaten !== null);
  drawZwaanHitch(r, x, y);
  // The lamps: the brake (the tells), the hazard blink (a broken ramp's tell).
  if (a.brakeT > 0 && tick % 30 < 26) r.sprite(AUTOS_SPR.lamps, 0, x + AUTOS.lampAt[0], y + AUTOS.lampAt[1], drawOpts);
  if (a.hazardT > 0 && Math.floor(tick / 8) % 2 === 0) r.sprite(AUTOS_SPR.lamps, 1, x + AUTOS.lampAt[0], y + AUTOS.lampAt[1], drawOpts);
}

defineEntity(AUTOS_ID, (w, x, y, p) => new AutosPart(w, x, y, p ?? NO_PARAMS), {
  category: 'boss',
  score: AUTOS_AI.score,
  description: 'ZWAAN AUTOTRANSPORT (the ZWAAN train, part 2): cars roll off the lowered ramp and slide off the tilting upper deck into the lanes (params hp, hpScale, lane, rate, index, stock).',
});
defineZwaanPart(AUTOS_ID, {
  length: AUTOS.length,
  drawWaiting: (r, x, y, tick) => drawAutos(r, WAITING, x, y, tick),
});
defineRingArt(AUTOS_ID, [`${AUTOS_ART}/`, ZWAAN_KIT_ART]);
