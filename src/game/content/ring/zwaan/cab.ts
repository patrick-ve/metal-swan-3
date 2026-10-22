/**
 * `ring-zwaan-cab` — part 5 of the ZWAAN train, the CAB `ZWARE JONGEN` (docs/design/ring.md §R.3,
 * R-4): a heavy white cab-over tractor with a high-roof sleeper (our own livery; geometry
 * cab-geo.ts, art cab-art.ts). The last part: its death ends the train (the controller sends
 * 'ringTrainDone': the ring's boss end, the music, the speed bonus).
 *
 * HP (× difficulty × co-op; the bar is the part's HP): parts in index order
 * - 0 `cab` — the cab (part x 64 … 100): the weak point (× 1.5), the pool; THE BOT AIMS AT PART 0;
 * - 1 `sleeper` — the gunner's window (x 38 … 64): own HP (× 1.25), passed on; broken: the window
 *   smashes, the gunner tumbles out onto the hard shoulder (bloodless, dazed) and shoots no more;
 * - 2 `chassis` — the fifth wheel and the drive axles (x 0 … 38): × 1, the pool (a shot from behind
 *   along the lane meets it first).
 * The damage rate (part.ts bucket). 10,000 points; a broken sleeper +1,000.
 *
 * Attacks (every tell ≥ 18 ticks on screen; `trace` for the tests, `mode` for the sim's watch):
 * - WEAVE (`tell-weave` → `weave`): the indicator blinks (36), then the cab changes lane 1 ↔ 2 in a
 *   44-tick S, the AIR HORN on every lane change; never into a car (the lane is checked every tick
 *   of the tell); a wagon still beside it in the new lane is pushed away (1 cell);
 * - BRAKE CHECK (`tell-brake` → `brake`): a wagon behind it in its lane (within 150 px): the brake
 *   lights glow (24), then a hard brake (−2.8 px/tick on screen for 22 ticks, the squeal): a wagon
 *   its rear reaches is rammed (1 cell, shoved back); then it pulls away to its anchor;
 * - THE GUNNER (`tell-gun` → `gun`): the sleeper window slides open, the gunner leans out and aims
 *   (30), then 3 shots (HARD 4) 9 ticks apart along / across the lanes at the nearest wagon (never
 *   forward of straight across); the window shuts again. Not after the sleeper broke.
 * - Phase 2 `rage` (HP ≤ 50 %): `UIT MIJN SPIEGEL!`, the horn; shorter pauses, brake checks first.
 * - The continue staggers it: a running attack ends cleanly (`cutAttack`); a lane change or a hard
 *   brake in progress finishes first (`canStagger`).
 * - Beaten: THE JACKKNIFE — the brakes lock (`MIJN VRACHT...!`), the cab spins toward the camera
 *   (`yaw`) and slides onto the hard shoulder, a blast, the drop (a repair or a weapon), the driver
 *   climbs out and sits dazed on the shoulder (bloodless); the wreck drops back.
 *
 * Params: `hp`, `hpScale`, `lane`, `rate` (0 = no damage-rate limit; tests), `index`.
 */
import type { Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import type { BossPart } from '../../../boss';
import { dust, explosion, muzzleFlash, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { defineRingArt } from '../../../ring/art-def';
import { ringOf } from '../../../ring/entity';
import { LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, nearestWagon, tumbleOff } from '../traffic/road-kit';
import { defineZwaanPart, RING_ZWAAN, ZWAAN, ZWAAN_NAMES, zwaanArt } from './api';
import { bodySpark } from './autos-kit';
import { CAB, CAB_SPR, CAB_X } from './cab-geo';
import { drawZwaanHitch, drawZwaanShadow, drawZwaanWheels, laneFreeBeside, pushWagonsOut, ZWAAN_KIT_ART, ZWAAN_PACE, ZWAAN_SFX, zwaanRate, zwaanShot, zwaanSmoke, type PushOpts } from './kit';
import { ZwaanPart, zwaanSlab } from './part';

/** Tuning (ticks, px, px/tick; HP before difficulty × co-op). */
export const CAB_AI = {
  hp: { pool: ZWAAN_PACE.cabHp, sleeper: 420 },
  cabMul: 1.5,
  sleeperMul: 1.25,
  chassisMul: 1,
  weave: { tell: 36, ticks: 44 },
  brake: { tell: 24, ticks: 22, rel: -2.8, reach: 150 },
  gun: { tell: 30, shots: 3, gap: 9, speed: 4, open: 12, aimMax: 0.55 },
  /** Phase 2 at this HP fraction. */
  phase2: 0.5,
  /** The gun's height above the road (its shots are drawn this high). */
  shotLift: 49,
} as const;

/** Bubbles (Dutch, ≤ 24 characters per line). */
export const CAB_LINES = {
  rage: 'UIT MIJN SPIEGEL!',
  beaten: 'MIJN VRACHT...!',
} as const;

/** One attack of the fight (tests): its tell tick, its strike tick (−1 = cut), the tell ticks on screen. */
export interface CabAttackTrace {
  attack: 'weave' | 'brake' | 'gun';
  tell: number;
  fire: number;
  seen: number;
}

export type CabMode = 'cruise' | 'tell-weave' | 'weave' | 'tell-brake' | 'brake' | 'tell-gun' | 'gun';
type GunnerLook = 'none' | 'aim' | 'fire';

const P_CAB = 0;
const P_SLEEPER = 1;
const P_CHASSIS = 2;
const drawOpts: DrawOpts = {};
const GUNNER_SHOT = 'ring-zwaan-gunner-shot';

export class ZwaanCab extends ZwaanPart {
  /** Its shots are drawn at the gun's height (the runner reads `shotLift`). */
  shotLift: number = CAB_AI.shotLift;
  mode: CabMode = 'cruise';
  readonly trace: CabAttackTrace[] = [];
  /** A lane change (from → to, ticks). */
  weaving = false;
  private laneFrom = 1;
  private laneTo = 1;
  private laneT = 0;
  /** Indicator ticks left; the hard brake's ticks left. */
  blinkT = 0;
  hardBrake = 0;
  /** The sleeper window: −1 shut, 0 … `gun.open` opening, then open; the gunner's look and its tick. */
  windowT = -1;
  gunner: GunnerLook = 'none';
  private gunnerT = 0;
  sleeperBroken = false;
  /** Shots fired (tests), lane changes (tests). */
  shots = 0;
  laneChanges = 0;
  /** The jackknife: the yaw frame (−1 none) and the slide toward the camera (px). */
  yawF = -1;
  private cabDy = 0;
  /** The driver climbed out (tests). */
  driverOut = false;
  private readonly touched = new WeakMap<Wagon, number>();
  private readonly push: PushOpts = { cost: 0.5, rearCost: 0.5 };
  private readonly mz: [number, number] = [0, 0];

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, {
      art: zwaanArt(RING_ZWAAN.cab),
      name: ZWAAN_NAMES[RING_ZWAAN.cab],
      hp: CAB_AI.hp.pool,
      score: ZWAAN.score.cab,
      length: CAB.length,
      height: CAB.height,
      rate: zwaanRate(CAB_AI.hp.pool),
    });
    const k = paramNum(p, 'hpScale', 1);
    this.laneFrom = this.laneTo = this.lane;
    this.addPart('cab', { box: zwaanSlab(CAB_X.cab[0], CAB_X.cab[1]), multiplier: CAB_AI.cabMul });
    this.addPart('sleeper', { box: zwaanSlab(CAB_X.sleeper[0], CAB_X.sleeper[1]), hp: Math.max(1, Math.round(CAB_AI.hp.sleeper * k)), shared: true, multiplier: CAB_AI.sleeperMul });
    this.addPart('chassis', { box: zwaanSlab(CAB_X.chassis[0], CAB_X.chassis[1]), multiplier: CAB_AI.chassisMul });
    this.hitbox = { x: 0, y: -CAB.height, w: CAB.length, h: CAB.height };
    this.phases = [
      { at: 1, name: 'cab', pattern: (b) => b.phaseCab() },
      {
        at: CAB_AI.phase2,
        name: 'rage',
        onEnter: (b) => {
          b.say(CAB_LINES.rage, { at: CAB.sayAt, ticks: 90 });
          b.world.audio.sfx(ZWAAN_SFX.horn);
        },
        pattern: (b) => b.phaseRage(),
      },
    ];
  }

  // ------------------------------------------------------------------------------- queries

  /** The nearest wagon in play (null: none). */
  target(): Wagon | null {
    return nearestWagon(this.world, this.x + CAB.length / 2, this.y);
  }

  /** The cab's front corner is on screen (a weave tell needs it). */
  cabInView(): boolean {
    return this.world.camera.containsPoint(this.x + CAB.blinkAt[0], this.y - 30, -8);
  }

  /** The rear lamps are on screen (a brake tell needs them). */
  rearInView(): boolean {
    return this.world.camera.containsPoint(this.x + 2, this.y - 16, -12);
  }

  /** The sleeper window is on screen (the gunner's tell needs it). */
  windowInView(): boolean {
    return this.world.camera.containsPoint(this.x + CAB.gunnerAt[0], this.y + CAB.gunnerAt[1], -10);
  }

  private openLanes(): number {
    return ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
  }

  /** May it change into lane `to` (no car, closure, forklift or other blocker beside it there)? */
  laneFree(to: number): boolean {
    return to >= 1 && to <= Math.min(2, this.openLanes()) && laneFreeBeside(this.world, this, to, this.x - 14, this.x + CAB.length + 14);
  }

  /** A wagon right behind it in its lane (the brake check's prey), or null. */
  wagonBehind(): Wagon | null {
    const list = drivenWagons(this.world);
    let best: Wagon | null = null;
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (Math.abs(w.y - this.y) > 9) continue;
      const gap = this.x - (w.x + WAGON_W / 2);
      if (gap < -4 || gap > CAB_AI.brake.reach) continue;
      if (gap < bestD) {
        bestD = gap;
        best = w;
      }
    }
    return best;
  }

  private mark(attack: CabAttackTrace['attack']): CabAttackTrace {
    const tr: CabAttackTrace = { attack, tell: this.world.tick, fire: -1, seen: 0 };
    this.trace.push(tr);
    return tr;
  }

  // ------------------------------------------------------------------------------- phases

  *phaseCab(): ScriptGen {
    yield 30;
    for (;;) {
      yield* this.weave();
      yield this.recoveryFor(40);
      yield* this.gun();
      yield this.recoveryFor(45);
      yield* this.brakeCheck();
      yield this.recoveryFor(50);
    }
  }

  *phaseRage(): ScriptGen {
    yield 20;
    for (;;) {
      yield* this.brakeCheck();
      yield this.recoveryFor(25);
      yield* this.weave();
      yield this.recoveryFor(25);
      yield* this.gun();
      yield this.recoveryFor(30);
    }
  }

  /**
   * WEAVE (see the header). It weaves toward the target's lane when the target is in a train lane
   * (to block it), else across; `force` skips the wait for a target (tests).
   */
  *weave(): ScriptGen {
    if (this.weaving) return;
    const to = this.lane === 1 ? 2 : 1;
    if (!this.laneFree(to) || !this.target() || !this.cabInView()) return;
    const tr = this.mark('weave');
    this.mode = 'tell-weave';
    this.blinkT = 9999;
    this.world.audio.sfx('ring/lorry-blink');
    const T = this.telegraphFor(CAB_AI.weave.tell);
    for (let i = 0; i < T; i++) {
      if (!this.laneFree(to) || !this.cabInView()) {
        this.blinkT = 0;
        this.mode = 'cruise';
        return;
      }
      tr.seen++;
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'weave';
    this.laneFrom = this.lane;
    this.laneTo = to;
    this.laneT = 0;
    this.weaving = true;
    this.laneChanges++;
    // The air horn on every lane change.
    this.world.audio.sfx(ZWAAN_SFX.horn);
    for (let g = 0; g < 200 && this.weaving; g++) yield 1;
    this.blinkT = 0;
    this.mode = 'cruise';
  }

  /** BRAKE CHECK (see the header). */
  *brakeCheck(): ScriptGen {
    let prey = this.wagonBehind();
    if (!prey) {
      // The prey in the other train lane behind it: weave in front of it first.
      const t = this.target();
      if (t && t.x < this.x && nearestLane(t.y) !== this.lane && nearestLane(t.y) <= 2) yield* this.weave();
      prey = this.wagonBehind();
    }
    if (!prey || !this.rearInView()) return;
    const tr = this.mark('brake');
    this.mode = 'tell-brake';
    this.brakeT = 9999;
    this.world.audio.sfx('ring/lorry-brake');
    const T = this.telegraphFor(CAB_AI.brake.tell);
    for (let i = 0; i < T; i++) {
      if (!this.rearInView()) {
        this.brakeT = 0;
        this.mode = 'cruise';
        return;
      }
      tr.seen++;
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'brake';
    this.hardBrake = CAB_AI.brake.ticks;
    this.world.audio.sfx(ZWAAN_SFX.squeal);
    this.world.camera.shake(1, 6);
    for (let g = 0; g < 60 && this.hardBrake > 0; g++) yield 1;
    this.brakeT = 0;
    this.mode = 'cruise';
  }

  /** THE GUNNER (see the header). */
  *gun(): ScriptGen {
    if (this.sleeperBroken) return;
    for (let g = 0; g < 120 && (!this.target() || !this.windowInView()); g++) yield 1;
    if (!this.target() || !this.windowInView() || this.sleeperBroken) return;
    const tr = this.mark('gun');
    this.mode = 'tell-gun';
    this.windowT = 0;
    this.setGunner('aim');
    this.world.audio.sfx(ZWAAN_SFX.window);
    const T = this.telegraphFor(CAB_AI.gun.tell);
    for (let i = 0; i < T; i++) {
      if (!this.windowInView() || this.sleeperBroken) {
        this.endAttackLook();
        return;
      }
      tr.seen++;
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'gun';
    const n = this.volleySize(CAB_AI.gun.shots);
    for (let i = 0; i < n && !this.sleeperBroken; i++) {
      this.fireOnce();
      yield CAB_AI.gun.gap;
    }
    yield 20;
    this.endAttackLook();
  }

  /** One shot from the window at the nearest wagon, never forward of straight across. */
  private fireOnce(): void {
    const t = this.target();
    const mx = this.x + CAB.gunnerAt[0] - 15;
    const my = this.y;
    let a = Math.PI;
    if (t) {
      const raw = Math.atan2(t.y - my, t.x - mx);
      // Into [π/2 … π + aimMax] (down across the lanes … back and a little up) or its mirror.
      const back = Math.atan2(Math.sin(raw - Math.PI), Math.cos(raw - Math.PI));
      a = Math.PI + Math.max(-Math.PI / 2, Math.min(CAB_AI.gun.aimMax, back));
      if (back < -Math.PI / 2) a = Math.PI / 2;
    }
    zwaanShot(this, mx, my, a, CAB_AI.gun.speed, GUNNER_SHOT);
    this.mz[0] = mx;
    this.mz[1] = my - CAB_AI.shotLift;
    muzzleFlash(this.world, this.mz[0], this.mz[1], a, { kind: 'pistol' });
    this.world.audio.sfx(ZWAAN_SFX.gunner);
    this.setGunner('fire');
    this.shots++;
  }

  private setGunner(g: GunnerLook): void {
    this.gunner = g;
    this.gunnerT = 0;
  }

  // ------------------------------------------------------------------------------- stagger

  protected override canStagger(): boolean {
    return !this.weaving && this.hardBrake <= 0;
  }

  protected override cutAttack(): boolean {
    this.endAttackLook();
    return true;
  }

  protected override onStagger(ticks: number): void {
    this.say('!', { at: CAB.sayAt, ticks: Math.min(60, ticks) });
  }

  /** End a running attack's look: the indicator, the brake lights, the gunner ducks, the window shuts. */
  endAttackLook(): void {
    this.mode = 'cruise';
    this.blinkT = 0;
    this.brakeT = 0;
    this.setGunner('none');
    if (!this.sleeperBroken) this.windowT = -1;
  }

  // ------------------------------------------------------------------------------- tick

  /** The pace: the base's pull to the anchor, the hard brake on top. */
  override keepPace(): void {
    if (this.hardBrake > 0) {
      this.hardBrake--;
      const road = ringOf(this.world)?.roadSpeed ?? 0;
      this.vx = Math.max(0, road + CAB_AI.brake.rel);
      this.x += this.vx;
      this.roll += this.vx;
      if (this.hardBrake % 3 === 0) dust(this.world, this.x + CAB.rearWheels[0], this.y, 2);
      return;
    }
    super.keepPace();
  }

  protected override think(): void {
    super.think();
    if (this.weaving) {
      this.laneT++;
      const k = Math.min(1, this.laneT / CAB_AI.weave.ticks);
      const e = k * k * (3 - 2 * k);
      this.y = laneY(this.laneFrom) + (laneY(this.laneTo) - laneY(this.laneFrom)) * e;
      if (k >= 1) {
        this.weaving = false;
        this.lane = this.laneTo;
        this.y = laneY(this.lane);
      }
    }
    if (this.blinkT > 0) {
      this.blinkT--;
      if (this.t % 16 === 0) this.world.audio.sfx('ring/lorry-blink', { vol: 0.5 });
    }
    if (this.windowT >= 0 && this.windowT < CAB_AI.gun.open) this.windowT++;
    this.gunnerT++;
    if (this.gunner === 'fire' && this.gunnerT >= 8) this.gunner = 'aim';
    if (this.state === 'fight' || this.state === 'intro') {
      this.push.cost = this.weaving ? 1 : 0.5;
      this.push.rearCost = this.hardBrake > 0 ? 1 : 0.5;
      pushWagonsOut(this, this.x, this.x + CAB.length, this.touched, this.push);
    }
    zwaanSmoke(this.world, this.x, this.y, this.cabState, this.t, CAB.smoke);
  }

  // ------------------------------------------------------------------------------- damage

  /** The cab's look: its own state or the part's, the worse one. */
  get cabState(): number {
    return Math.max(this.partState(this.parts[P_CAB]), this.damageState);
  }

  override partSpot(i: number): [number, number] {
    const xs = i === P_SLEEPER ? CAB_X.sleeper : i === P_CHASSIS ? CAB_X.chassis : CAB_X.cab;
    const out = super.partSpot(i);
    out[0] = this.x + (xs[0] + xs[1]) / 2;
    out[1] = this.y + (i === P_CHASSIS ? -14 : i === P_SLEEPER ? -50 : -40);
    return out;
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.index !== P_SLEEPER) return;
    // The window smashes, the gunner tumbles out onto the hard shoulder (bloodless, dazed).
    const w = this.world;
    const road = ringOf(w)?.roadSpeed ?? 0;
    this.sleeperBroken = true;
    this.windowT = CAB_AI.gun.open;
    this.setGunner('none');
    if (this.mode === 'tell-gun' || this.mode === 'gun') this.mode = 'cruise';
    tumbleOff(w, this.x + CAB.gunnerAt[0], this.y, {
      sprite: CAB_SPR.gunner('tumble'),
      restSprite: CAB_SPR.gunner('sit'),
      vx: road * 0.5 - 0.6,
      vy: Math.max(0.6, (SHOULDER_TOP + 5 - this.y) / 34),
      lift: -CAB.gunnerAt[1] - 6,
      vlift: 2.2,
      bounces: 1,
      rest: 120,
      tpf: 4,
      shoulder: true,
      shadowW: 14,
      z: 34,
    });
    w.audio.sfx('ring/crash', { vol: 0.6 });
  }

  // ------------------------------------------------------------------------------- beaten

  protected override onDeathStart(): void {
    this.endAttackLook();
    this.weaving = false;
    this.hardBrake = 0;
    this.brakeT = 9999;
    super.onDeathStart();
  }

  /** THE JACKKNIFE (see the header). */
  protected override *beatenSequence(): ScriptGen {
    const w = this.world;
    // The brakes lock; the bubble.
    this.beaten = 'brake';
    this.beatT = 0;
    w.audio.sfx('ring/lorry-screech');
    w.audio.sfx(ZWAAN_SFX.squeal);
    w.camera.shake(3, 20);
    this.say(CAB_LINES.beaten, { at: CAB.sayAt, ticks: 100 });
    for (let t = 0; t < 22; t++, this.beatT++) {
      this.beatenMove(-0.4 - t * 0.03);
      if (t % 3 === 0) dust(w, this.x + CAB.rearWheels[1], this.y, 2);
      yield 1;
    }
    // The cab spins toward the camera and slides onto the hard shoulder.
    this.beaten = 'swerve';
    this.beatT = 0;
    const y0 = this.y;
    const y1 = SHOULDER_TOP + 2;
    for (let t = 0; t < 44; t++, this.beatT++) {
      const k = (t + 1) / 44;
      this.y = y0 + (y1 - y0) * (k * k * (3 - 2 * k));
      this.yawF = Math.min(3, Math.floor(t / 11));
      this.cabDy = Math.min(6, t * 0.15);
      this.beatenMove(-1.1 - t * 0.02);
      if (t % 3 === 0) dust(w, this.x + CAB.frontWheel, this.y, 2);
      if (t % 8 === 0) {
        const p = this.randomPoint();
        explosion(w, p[0], p[1], t % 16 === 0 ? 'm' : 's', { silent: t % 16 !== 0, shake: 2 });
      }
      yield 1;
    }
    // It lands on the shoulder: a blast, the drop, the driver climbs out dazed.
    this.beaten = 'tip';
    this.beatT = 0;
    explosion(w, this.x + 60, this.y - 34, 'l', { debris: 'metal' });
    w.camera.shake(4, 16);
    w.audio.sfx(ZWAAN_SFX.tip);
    w.audio.sfx('ring/lorry-slam');
    this.dropItem();
    for (let t = 0; t < 30; t++, this.beatT++) {
      this.beatenMove(-1.6);
      if (t === 18) this.driverClimbsOut();
      if (t % 6 === 0) smokeTrail(w, this.x + 70, this.y - 40, true);
      yield 1;
    }
    // The wreck drops back off the left edge.
    this.beaten = 'wreck';
    this.beatT = 0;
    for (let t = 0; t < ZWAAN.beaten.maxTicks && this.x + 150 > w.camera.x - 8; t++, this.beatT++) {
      this.beatenMove(ZWAAN.beaten.dropRel);
      if (t % 9 === 0) smokeTrail(w, this.x + 70, this.y - 40, true);
      yield 1;
    }
  }

  /** The driver climbs out of the wreck and sits dazed on the hard shoulder (bloodless). */
  private driverClimbsOut(): void {
    if (this.driverOut) return;
    this.driverOut = true;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    tumbleOff(this.world, this.x + 96, this.y + 2, {
      sprite: CAB_SPR.driver('tumble'),
      restSprite: CAB_SPR.driver('sit'),
      vx: road * 0.55,
      vy: 0.2,
      lift: 14,
      vlift: 1.6,
      bounces: 0,
      rest: 150,
      tpf: 5,
      once: true,
      shoulder: true,
      shadowW: 14,
      z: 37,
    });
  }

  // ------------------------------------------------------------------------------- drawing

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && (part === P_CAB || part === P_CHASSIS)) {
      if (this.world.tick % 6 === 0) this.world.audio.sfx('ring/dent', { vol: 0.45 });
      bodySpark(this.world, this.partRect(this.parts[part]), this.y, d.dirX);
    }
    return hit;
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawZwaanShadow(r, x, y, CAB.length);
    drawOpts.flipX = false;
    if (this.yawF >= 0) {
      drawOpts.flash = false;
      r.sprite(CAB_SPR.yaw, this.yawF, x, y + Math.round(this.cabDy), drawOpts);
      return;
    }
    const sh = this.staggerTicks > 0 && Math.floor(this.world.tick / 2) % 2 === 0 ? 1 : 0;
    const o = this.look;
    o.tick = this.world.tick;
    o.roll = this.roll;
    o.state = this.cabState;
    // The train's one rule (integrator, wave A): the big body never flashes white (the hits spark
    // and dent, onHit); only the weak point (the sleeper window) flashes.
    o.flash = false;
    o.windowF = this.sleeperBroken ? 2 : this.windowT < 0 ? -1 : this.windowT < CAB_AI.gun.open / 2 ? 0 : 1;
    o.flashWindow = this.partFlash(P_SLEEPER);
    o.gunner = this.gunner;
    o.gunnerF = this.gunner === 'aim' ? Math.min(2, Math.floor(this.gunnerT / 8)) : this.gunner === 'fire' ? Math.min(1, Math.floor(this.gunnerT / 4)) : 0;
    o.blink = this.blinkT > 0 && Math.floor(this.t / 8) % 2 === 1;
    o.brake = this.brakeT > 0 && (this.beaten !== null ? this.world.tick % 20 < 14 : true);
    drawCab(r, x + sh, y, o);
  }

  private partFlash(i: number): boolean {
    return this.parts[i].flash > 0 && this.world.tick % 2 === 0;
  }

  /** The look scratch (no allocation per frame). */
  private readonly look: CabLook = { tick: 0, roll: 0 };
}

/** What `drawCab` needs (the live part, or the waiting one with the defaults). */
export interface CabLook {
  tick: number;
  roll: number;
  state?: number;
  flash?: boolean;
  /** −1 shut; 0 half open, 1 open, 2 smashed. */
  windowF?: number;
  flashWindow?: boolean;
  gunner?: GunnerLook;
  gunnerF?: number;
  blink?: boolean;
  brake?: boolean;
}

/** The cab with its REAR at world (x, plane y). */
export function drawCab(r: Renderer, x0: number, y0: number, o: CabLook): void {
  const x = Math.round(x0);
  const y = Math.round(y0);
  drawOpts.flipX = false;
  drawOpts.flash = o.flash === true;
  r.sprite(CAB_SPR.body(o.state ?? 0), 0, x, y, drawOpts);
  const wf = o.windowF ?? -1;
  if (wf >= 0) {
    drawOpts.flash = o.flashWindow === true;
    r.sprite(CAB_SPR.window, wf, x, y, drawOpts);
  }
  const g = o.gunner ?? 'none';
  if (g !== 'none' && wf >= 0 && wf < 2) {
    // He leans out of the window and faces back (the strip faces right: flipped).
    drawOpts.flipX = true;
    drawOpts.flash = o.flashWindow === true;
    r.sprite(CAB_SPR.gunner(g), o.gunnerF ?? 0, x + CAB.gunnerAt[0], y + CAB.gunnerAt[1], drawOpts);
    drawOpts.flipX = false;
  }
  drawOpts.flash = false;
  drawZwaanWheels(r, x, y, CAB.rearWheels, o.roll, { flash: o.flash });
  drawZwaanWheels(r, x, y, [CAB.frontWheel], o.roll, { flash: o.flash });
  drawZwaanHitch(r, x, y);
  if (o.blink) r.sprite(CAB_SPR.blink, 1, x + CAB.blinkAt[0], y + CAB.blinkAt[1], drawOpts);
  if (o.brake) r.sprite(CAB_SPR.brake, 0, x + CAB.brakeAt[0], y + CAB.brakeAt[1], drawOpts);
}

/** The waiting look (no allocation per frame). */
const WAITING: CabLook = { tick: 0, roll: 0 };

defineEntity(RING_ZWAAN.cab, (w, x, y, p) => new ZwaanCab(w, x, y, p ?? NO_PARAMS), {
  category: 'boss',
  score: ZWAAN.score.cab,
  description: 'ZWAAN train part 5, the cab ZWARE JONGEN: weaves to block lanes, brake checks, the gunner in the sleeper window; the jackknife (params hp, hpScale, lane, rate, index).',
});
defineZwaanPart(RING_ZWAAN.cab, {
  length: CAB.length,
  drawWaiting: (r, x, y, tick) => {
    drawZwaanShadow(r, x, y, CAB.length);
    WAITING.tick = tick;
    WAITING.roll = x;
    drawCab(r, x, y, WAITING);
  },
});
defineRingArt(RING_ZWAAN.cab, [`${zwaanArt(RING_ZWAAN.cab)}/`, ZWAAN_KIT_ART]);
