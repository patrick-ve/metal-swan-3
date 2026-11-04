/**
 * THE PARKING SCAN CAR (`ams-scan-car`, docs/design/ams-extras.md §3) — the mid-mission boss of
 * mission ams, section c: a small white municipal car (`PARKEERCONTROLE` on the doors) with a
 * roof rack of two camera pods and a scanner bar, hazard lights and a handhaver at the wheel.
 *
 * Spawn it on the floor just outside the locked arena (docs/api/scan-car.md):
 * `ctx.spawn('ams-scan-car', arenaRight + 40, 'ground', { facing: -1 })` — it drives in, brakes
 * at its home spot `SCAN.homeIn` px inside the arena edge it came from, raises the scanner bar
 * (60 ticks, invulnerable; `KENTEKEN GESCAND.`) and fights. Params: `facing` (−1 default: in from
 * the right; 1: from the left), `arenaLeft` / `arenaW` (the locked view; default the camera's left
 * while the intro runs, 384), `hpScale` (tests). It works on a flat test floor too.
 *
 * Parts (required-parts model, GDD §10.0; HP × difficulty × co-op): `scanner` 400 (the roof rack:
 * breaking it stops SCAN LOCK) and `body` 900 (the core). Both required.
 * - Phase 1: SCAN LOCK (a red reticle follows the nearest player 40 ticks, freezes 24 ticks and
 *   blinks, then the printer shoots a fine strip at the frozen spot: step away) and RAM (it revs
 *   24 ticks, then drives across at 3 px/tick; only then its low body hurts — jump over it; it
 *   turns around at the far side), alternating.
 * - Phase 2 (the scanner broken or the body ≤ 50 %, between attacks): TOW CALL (`TAKELWAGEN!`; a
 *   tow truck backs in from the far side, swings its hook, tosses 2 wheel clamps), then SCAN LOCK
 *   (while the scanner lives) and RAM. A RAM never starts while a player is clamped, and stops
 *   short of a tow truck (the car then backs up to its spot).
 * Every attack: telegraph (≥ 18 ticks, `telegraphFor`) → attack → recovery (`recoveryFor`).
 * Adds (the truck) wait while `holdAdds` (the in-world continue, a stagger). The continue's
 * stagger holds the pattern; a car in the middle of a ram finishes the drive first.
 *
 * Death: the airbag pops (`AIRBAG!`), the car flips onto its roof smoking, the driver crawls out
 * and runs; score 10,000; drops `pickup-repair` when a player rides a vehicle, else a weapon (H, R
 * or L). The truck drives off and the clamps fall apart. 'bossDefeated' is emitted at the end
 * (the section script waits on it); nothing here ends the mission or plays the boss banner.
 */
import type { Damage } from '../../../../engine/entity';
import type { Entity } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import { PAL } from '../../../../engine/palette';
import { getFrames, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { drawEntityFaces } from '../../../mission/floor/hooks';
import { debris, dust, explosion, smokeTrail } from '../../../fx';
import { isPlayer, type Player } from '../../../player/player';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { AmsTowTruck, AmsWheelClamp, BOSS_HIT, floorNear, isClamped, ScanReticle, ScanTicket } from './adds';
import {
  BLINK_BRAKE,
  BLINK_HAZARD,
  BLINK_REVERSE,
  BODY_DIVE,
  BODY_LEVEL,
  BODY_SQUAT,
  BODY_TILT_MILLI,
  CAB_AIRBAG,
  CAB_AIRBAG_POP,
  CAB_BACK,
  CAB_CALM,
  CAB_GOTCHA,
  CAB_SHOCK,
  CAB_SHOUT,
  CAB_SHOUT_B,
  SCAN_DOWN,
  SCAN_FIRE,
  SCAN_LIFT1,
  SCAN_LIFT2,
  SCAN_LOCK,
  SCAN_ON,
  SCAN_RECOIL,
  SCAN_SWEEP_N,
  WRECK_FACING,
  WRECK_IMPACT,
  WRECK_REST,
  WRECK_ROLLS,
} from '../../art40/ams-scan.gen';
import { SET as OFFICER } from '../../art40/handhaver.gen';
import { HANDHAVER } from '../../locals/handhaver';
import { CLAMP_TAG, ID, SCAN, SCAN_ART, SCAN_ID, SCAN_NAME, SCAN_TAG, TRUCK_ID, TRUCK_TAG, WRECK } from './geometry';

const P_SCANNER = 0;
const P_BODY = 1;
const drawOpts: DrawOpts = {};
const ramRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const pt: [number, number] = [0, 0];

// Art-only numbers of the baked car (tools/art40/chars/ams-scan; local px, facing right).
/** The tail light's glow centre (brake and reversing lamps; `blink` frames). */
const TAIL_GLOW = [-42, -20] as const;
/** The reference columns the overlays shear with: the scanner box's middle, the officer. */
const SCAN_REF_X = -8;
const CAB_REF_X = 1;
/** The front camera window of the lifted box (the scan beam starts here). */
const CAMERA = [6, -38] as const;
/** Ticks of the print kick (SCAN_FIRE) and its recoil (SCAN_RECOIL). */
const PRINT_KICK = 3;
const PRINT_TICKS = 8;
/** Ticks per frame of the scan sweep and of the lock's lens pulse. */
const SWEEP_TPF = 3;
const LOCK_TPF = 4;
/** The beam colours: tracking (dim, dashed), locked (hot). */
const BEAM_TRACK = PAL.red[1];
const BEAM_LOCK = PAL.red[3];

/**
 * The fleeing officer's run: his walk strip's stride (px a cycle at his own walk speed) spread over
 * its frames by their ticks, so the frame follows the distance he covers (no foot slide at any speed).
 */
const DRIVER_WALK = OFFICER.strips.walk.durations;
const DRIVER_CYCLE = DRIVER_WALK.reduce((a, b) => a + b, 0);
/** Frame of the walk strip after `dist` px (his walk speed `HANDHAVER.walk` px/tick). */
export function driverFrame(dist: number): number {
  let t = (dist / HANDHAVER.walk) % DRIVER_CYCLE;
  for (let i = 0; i < DRIVER_WALK.length; i++) {
    if (t < DRIVER_WALK[i]) return i;
    t -= DRIVER_WALK[i];
  }
  return 0;
}

/** Rows a body column (unflipped local x) moves in a pose: the bake's shear (BODY_TILT_MILLI). */
export function bodyShift(x: number, pose: number): number {
  const sgn = pose === BODY_SQUAT ? 1 : pose === BODY_DIVE ? -1 : 0;
  if (sgn === 0) return 0;
  return Math.floor((-(x + 0.5) * BODY_TILT_MILLI * sgn) / 1000 + 0.5);
}

/** One attack of the fight: when its telegraph began and when it struck (ticks; −1 = not yet). */
export interface ScanAttackTrace {
  attack: 'scan' | 'ram' | 'tow';
  tell: number;
  fire: number;
}

export class AmsScanCar extends Boss {
  /** The locked arena: its left x and width; the car's home side (+1 right, −1 left). */
  arenaLeft = 0;
  arenaW: number = SCAN.arenaW;
  side: 1 | -1;
  private readonly arenaFixed: boolean;

  // Look state (read by draw; set by the scripts).
  /** Scanner strip frame (SCAN_*: down, lifted, the sweep, the lock). */
  scanFrame = SCAN_DOWN;
  /** Cabin frame (CAB_*). */
  cabin: number = CAB_CALM;
  /** Body pose (BODY_LEVEL / BODY_SQUAT / BODY_DIVE): set by the drive; `poseSeq` plays a settle. */
  pose: number = BODY_LEVEL;
  private poseSeq: Array<[number, number]> = [];
  private poseHold = 0;
  /** Ticks left of the printer's kick (SCAN_FIRE, then SCAN_RECOIL). */
  printT = 0;
  /** The tail lamp: 0 off, BLINK_BRAKE + 1, BLINK_REVERSE + 1. */
  private tailLamp = 0;
  /** Distance the wheels rolled (px; the turn frame) and the body's rev rock (px up). */
  wheelDist = 0;
  rockY = 0;
  hazard = true;
  private shakeX = 0;

  // Attack state.
  busy = false;
  revving = false;
  ramming = false;
  /** The car backs up to its spot (a tow truck blocked the ram). */
  reversing = false;
  speed = 0;
  reticle: ScanReticle | null = null;
  /** Every attack in order (tests and the fairness check). */
  readonly trace: ScanAttackTrace[] = [];

  // Death.
  /** −1 upright; wreck strip frame: 0 … WRECK_ROLLS − 1 rolling, WRECK_IMPACT, WRECK_REST on its roof. */
  wreckFrame = -1;
  /** Height over the floor while it flips (px up). */
  lift = 0;
  private liftV = 0;
  private driverOn = false;
  private driverX = 0;
  private driverX0 = 0;
  private driverY = 0;
  private driverDir: 1 | -1 = 1;
  private driverFrames = 0;
  /** The drop spawned at the end of the death (tests). */
  dropped: Entity | null = null;
  private lastPing = 0;
  private readonly contactList: Rect[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: SCAN_ART, name: SCAN_NAME, hp: SCAN.hp.scanner + SCAN.hp.body, score: SCAN.score });
    this.facing = paramFacing(p, -1);
    this.side = this.facing < 0 ? 1 : -1;
    this.arenaFixed = p.arenaLeft !== undefined;
    this.arenaLeft = paramNum(p, 'arenaLeft', Math.round(world.camera.left));
    this.arenaW = paramNum(p, 'arenaW', SCAN.arenaW);
    this.addPart('scanner', { box: { ...SCAN.box.scanner }, hp: this.partHp(SCAN.hp.scanner), required: true });
    this.addPart('body', { box: { ...SCAN.box.body }, hp: this.partHp(SCAN.hp.body), required: true });
    this.contactDamage = { amount: 10, kind: 'impact', dirX: this.facing, tags: BOSS_HIT };
    this.removeOnDeath = false;
    this.z = 30;
    this.addTag(SCAN_TAG);
    this.y = floorNear(world, x, y);
    this.phases = [
      { at: 1, name: 'scan', pattern: (b) => b.phaseOne() },
      { when: (b) => b.towReady(), name: 'tow', pattern: (b) => b.phaseTwo() },
    ];
  }

  /** Part HP with the test spawn param `hpScale` (default 1). */
  private partHp(base: number): number {
    return Math.max(1, Math.round(base * paramNum(this.params, 'hpScale', 1)));
  }

  /** The body part's HP fraction. */
  get bodyFrac(): number {
    const b = this.parts[P_BODY];
    return b.maxHp > 0 ? Math.max(0, b.hp) / b.maxHp : 0;
  }

  /** Phase 2 may start: the scanner is broken or the body is at half, and no attack runs. */
  towReady(): boolean {
    return !this.busy && (!this.partAlive('scanner') || this.bodyFrac <= 0.5);
  }

  /** The home spot x on a side. */
  homeX(side: number): number {
    return side > 0 ? this.arenaLeft + this.arenaW - SCAN.homeIn : this.arenaLeft + SCAN.homeIn;
  }

  /** Follow the camera into its lock while the intro runs (unless `arenaLeft` was given). */
  private trackArena(): void {
    if (this.arenaFixed) return;
    const cam = this.world.camera;
    if (this.state === 'intro' || (cam.locked && this.state === 'fight' && !this.busy)) this.arenaLeft = Math.round(cam.left);
  }

  // ------------------------------------------------------------------------------- targets

  /** The nearest player in play (on foot or riding); `free`: skip clamped players. */
  target(free = false): Player | null {
    const ps = this.world.players;
    let best: Player | null = null;
    let bd = Infinity;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!isPlayer(p) || (p.state !== 'play' && p.state !== 'mounted')) continue;
      if (free && isClamped(p)) continue;
      const d = Math.abs(p.x - this.x);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** The centre of a player's body (or of the vehicle he rides). */
  aimPoint(p: Player, out: [number, number]): [number, number] {
    const e: Entity = p.state === 'mounted' && p.vehicle ? p.vehicle : p;
    const r = e.hitRect();
    out[0] = r.x + r.w / 2;
    out[1] = r.y + r.h / 2;
    return out;
  }

  /** Is any player clamped? */
  anyClamped(): boolean {
    const ps = this.world.players;
    for (let i = 0; i < ps.length; i++) if (isClamped(ps[i])) return true;
    return false;
  }

  /**
   * Where a drive in `dir` must stop short of the nearest clamped player ahead (the ram box clear
   * of his body), or NaN when no clamped player is ahead.
   */
  private clampedStop(dir: number): number {
    const ps = this.world.players;
    const reach = SCAN.ram.x + SCAN.ram.w + 12;
    let best = NaN;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!isClamped(p) || (p.x - this.x) * dir <= 0) continue;
      const stop = p.x - dir * reach;
      if (Number.isNaN(best) || (stop - best) * dir < 0) best = stop;
    }
    return best;
  }

  /** The tow truck at work in the arena, if any. */
  truck(): AmsTowTruck | null {
    const list = this.world.byTag(TRUCK_TAG);
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t instanceof AmsTowTruck && t.alive && !t.broken && t.state !== 'leave') return t;
    }
    return null;
  }

  private mark(attack: ScanAttackTrace['attack']): ScanAttackTrace {
    const tr: ScanAttackTrace = { attack, tell: this.world.tick, fire: -1 };
    this.trace.push(tr);
    return tr;
  }

  // ------------------------------------------------------------------------------- intro

  override *intro(): ScriptGen {
    this.trackArena();
    const I = SCAN.intro;
    this.scanFrame = SCAN_DOWN;
    this.cabin = CAB_CALM;
    // It drives in and brakes at its spot.
    for (let guard = 0; guard < 600; guard++) {
      this.trackArena();
      const home = this.homeX(this.side);
      const left = home - this.x;
      if (Math.abs(left) < 0.5) break;
      const v = Math.min(I.speed, Math.max(0.5, Math.abs(left) / (I.brake * 0.5)));
      this.drive(Math.sign(left) * Math.min(v, Math.abs(left)));
      if (Math.abs(left) < I.brake && guard % 3 === 0) dust(this.world, this.x - this.facing * 20, this.y, 1);
      yield;
    }
    this.speed = 0;
    this.settle();
    this.world.audio.sfx('swan/skid', { pitch: 0.8, vol: 0.6 });
    dust(this.world, this.x + this.facing * 20, this.y, 3);
    yield 14;
    // The scanner bar rises (invulnerable), the pods flash: the plate is scanned.
    this.world.audio.sfx('ams/scan-up');
    for (let i = 0; i < I.rise; i++) {
      this.trackArena();
      this.scanFrame = i < 16 ? SCAN_DOWN : i < 32 ? SCAN_LIFT1 : i < 44 ? SCAN_LIFT2 : i < 54 ? SCAN_ON + (Math.floor((i - 44) / SWEEP_TPF) % SCAN_SWEEP_N) : SCAN_LIFT2;
      if (i === 44) {
        this.world.audio.sfx('ams/scan-beep', { pitch: 0.8 });
        this.say('KENTEKEN GESCAND.', { at: SCAN.sayAt, ticks: 100 });
      }
      yield;
    }
    this.scanFrame = SCAN_LIFT2;
  }

  /** The brake's settle: the nose dives, rebounds, levels (look only). */
  private settle(): void {
    this.poseSeq = [[BODY_DIVE, 5], [BODY_SQUAT, 3]];
    this.poseHold = 0;
  }

  /** Advance the pose settle (look only). */
  private tickPose(): void {
    if (this.poseHold > 0 && --this.poseHold > 0) return;
    const next = this.poseSeq.shift();
    if (next) {
      this.pose = next[0];
      this.poseHold = next[1];
    } else if (this.poseHold <= 0 && !this.revving && !this.ramming && !this.reversing) this.pose = BODY_LEVEL;
  }

  // ------------------------------------------------------------------------------- tick

  /** Move by dx (the floor follows; the wheels turn). */
  private drive(dx: number): void {
    this.x += dx;
    this.speed = Math.abs(dx);
    // Forward (the front leads) turns the wheels forward.
    this.wheelDist += dx * this.facing;
    this.y = floorNear(this.world, this.x, this.y, 12, 24);
  }

  protected override think(): void {
    this.trackArena();
    // Phase 2 starts between attacks (never from inside the pattern script).
    if (this.phase === 0 && this.state === 'fight' && this.towReady()) this.checkPhases();
    if (this.staggerTicks > 0) this.shakeX = Math.floor(this.world.tick / 2) % 2 === 0 ? 1 : 0;
    else this.shakeX = 0;
    if (this.revving) this.wheelDist += 1.4;
    if (this.printT > 0) this.printT--;
    this.tickPose();
    // Damage smoke from the bonnet.
    if (this.partState(this.parts[P_BODY]) === 2 && this.world.tick % 7 === 0) {
      smokeTrail(this.world, this.x + (this.facing < 0 ? -SCAN.bonnet[0] : SCAN.bonnet[0]), this.y + SCAN.bonnet[1], true);
    }
  }

  protected override canStagger(): boolean {
    // A car in the middle of a drive finishes it first (never frozen with a hot body).
    return !this.ramming && !this.reversing;
  }

  protected override onStagger(ticks: number): void {
    this.say('!', { at: SCAN.sayAt, ticks: Math.min(60, ticks) });
  }

  override contactBoxes(): readonly Rect[] {
    const out = this.contactList;
    out.length = 0;
    if (!this.ramming || this.state !== 'fight') return out;
    out.push(rectAt(this.x, this.y, SCAN.ram, this.facing < 0, ramRect));
    return out;
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && d.kind === 'bullet' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: part === P_SCANNER ? 1.5 : 1.1 });
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.index !== P_SCANNER) return;
    // The rack snaps: sparks, glass and a dead beep; SCAN LOCK stops.
    const r = this.partRect(p);
    debris(this.world, this.x + (this.facing < 0 ? 10 : -10), this.y - 38, 'glass', 8);
    this.world.audio.sfx('ams/scan-beep', { pitch: 0.5, vol: 0.6 });
    void r;
    this.dropReticle();
  }

  protected override onDamageState(state: 1 | 2): void {
    super.onDamageState(state);
    if (state === 2) debris(this.world, this.x, this.y - 20, 'glass', 6);
  }

  // ------------------------------------------------------------------------------- patterns

  /** Phase 1: SCAN LOCK and RAM, alternating. */
  *phaseOne(): ScriptGen {
    for (let k = 0; ; k++) {
      if (k % 2 === 0 && this.partAlive('scanner')) yield* this.scanLock();
      else yield* this.ram();
      yield this.recoveryFor(SCAN.gap);
    }
  }

  /** Phase 2: TOW CALL (when no truck works), SCAN LOCK (while the scanner lives), RAM. */
  *phaseTwo(): ScriptGen {
    for (;;) {
      yield* this.towCall();
      yield this.recoveryFor(SCAN.gap);
      if (this.partAlive('scanner')) {
        yield* this.scanLock();
        yield this.recoveryFor(SCAN.gap);
      }
      yield* this.ram();
      yield this.recoveryFor(SCAN.gap);
    }
  }

  private dropReticle(): void {
    if (this.reticle) this.reticle.remove();
    this.reticle = null;
  }

  /**
   * SCAN LOCK: the pods glow red, a reticle follows the nearest (unclamped) player for 40 ticks,
   * freezes for 24 ticks and blinks; then the printer shoots the fine strip at the frozen spot
   * (HARD: one more strip). Broken scanner: it stops at once.
   */
  *scanLock(): ScriptGen {
    const S = SCAN.scan;
    let p = this.target(true);
    if (!p || !this.partAlive('scanner')) {
      yield 20;
      return;
    }
    this.busy = true;
    try {
      const tr = this.mark('scan');
      this.scanFrame = SCAN_ON;
      this.cabin = CAB_GOTCHA;
      this.world.audio.sfx('ams/scan-beep', { pitch: 0.6, vol: 0.7 });
      this.aimPoint(p, pt);
      const ret = new ScanReticle(this.world, pt[0], pt[1]);
      this.world.add(ret);
      this.reticle = ret;
      const track = this.telegraphFor(S.track);
      for (let i = 0; i < track; i++) {
        if (!this.partAlive('scanner')) return;
        const q: Player = this.target(true) ?? p;
        p = q;
        this.aimPoint(q, pt);
        ret.follow(pt[0], pt[1], S.follow);
        this.scanFrame = SCAN_ON + (Math.floor(i / SWEEP_TPF) % SCAN_SWEEP_N);
        yield;
      }
      ret.locked = true;
      ret.t = 0;
      this.world.audio.sfx('ams/scan-beep');
      const freeze = this.telegraphFor(S.freeze);
      for (let i = 0; i < freeze; i++) {
        if (!this.partAlive('scanner')) return;
        this.scanFrame = SCAN_LOCK + (Math.floor(i / LOCK_TPF) % 2);
        yield;
      }
      const n = this.volleySize(1);
      let land = 0;
      for (let k = 0; k < n; k++) {
        if (!this.partAlive('scanner')) return;
        const px = this.x + (this.facing < 0 ? -SCAN.printer[0] : SCAN.printer[0]);
        const py = this.y + SCAN.printer[1] - this.rockY;
        const tk = ScanTicket.fire(this.world, px, py, ret.x, ret.y, this);
        // About when it lands on the spot: the flight over, then the drop.
        land = Math.ceil(Math.abs(ret.x - px) / Math.max(1, Math.abs(tk.vx))) + 24;
        this.world.audio.sfx('ams/ticket-print');
        this.printT = PRINT_TICKS;
        if (tr.fire < 0) tr.fire = this.world.tick;
        if (k < n - 1) yield S.gap;
      }
      // The reticle stays on the spot (blinking out) until the strip lands.
      ret.fade = Math.max(12, land);
      this.reticle = null;
      this.scanFrame = SCAN_LIFT2;
      this.cabin = CAB_CALM;
      yield this.recoveryFor(S.rec);
    } finally {
      if (this.reticle) this.dropReticle();
      if (this.partAlive('scanner')) this.scanFrame = SCAN_LIFT2;
      this.cabin = CAB_CALM;
      this.busy = false;
    }
  }

  /**
   * RAM: it revs (telegraph 24: the wheels spin, smoke, `ams/rev`), then drives across at 3 px/tick
   * to its other spot (its low body hurts only now: jump it) and turns around. A tow truck in the
   * way: it stops short of the hook and backs up to its spot. Never into a clamped player: it waits
   * before the rev, keeps revving while a clamp closed during the rev holds (up to 60 ticks, then no
   * drive), and brakes short of a player clamped in its path during the drive.
   */
  *ram(): ScriptGen {
    const R = SCAN.ramming;
    for (let w = 0; w < 150 && this.anyClamped(); w++) yield;
    this.busy = true;
    try {
      const tr = this.mark('ram');
      this.revving = true;
      this.cabin = CAB_SHOUT;
      this.world.audio.sfx('ams/rev');
      const tele = this.telegraphFor(R.tele);
      for (let i = 0; i < tele; i++) {
        this.rockY = Math.floor(i / 2) % 2;
        // The rev: the rear squats onto its wheels (from the 4th tick), the body shudders.
        this.pose = i < 3 ? BODY_LEVEL : BODY_SQUAT;
        if (i % 4 === 0) smokeTrail(this.world, this.x + (this.facing < 0 ? -SCAN.exhaust[0] : SCAN.exhaust[0]), this.y + SCAN.exhaust[1], i % 8 === 0);
        yield;
      }
      // A clamp that closed during the rev: keep revving until the hero is free (a clamped hero
      // cannot jump); still clamped after the wait: no drive.
      for (let w = 0; w < 60 && this.anyClamped(); w++) {
        this.rockY = Math.floor(w / 2) % 2;
        yield;
      }
      this.revving = false;
      this.rockY = 0;
      if (this.anyClamped()) {
        this.pose = BODY_LEVEL;
        this.cabin = CAB_CALM;
        yield this.recoveryFor(R.rec);
        return;
      }
      const start = this.x;
      const dir = this.facing;
      let end = this.homeX(-this.side);
      let blocked = false;
      const truck = this.truck();
      if (truck) {
        const stop = truck.tipX() - dir * (-SCAN.profile[0][0] + 40);
        if ((stop - start) * dir < (end - start) * dir) {
          end = stop;
          blocked = true;
        }
      }
      this.ramming = true;
      tr.fire = this.world.tick;
      this.speed = 0;
      let v = 0;
      for (let guard = 0; guard < 400; guard++) {
        // A hero clamped in its path (a clamp that closed during the drive): brake short of him.
        const stopAt = this.clampedStop(dir);
        if (!Number.isNaN(stopAt) && (stopAt - end) * dir < 0) {
          end = (stopAt - this.x) * dir > 0 ? stopAt : this.x;
          blocked = true;
        }
        const left = (end - this.x) * dir;
        if (left <= 0.01) break;
        // Accelerate to 3 px/tick; brake hard over the last few px (the skid).
        const was = v;
        v = Math.min(R.speed, v + R.accel, Math.max(0.6, Math.sqrt(2 * 0.45 * left)));
        // The launch keeps the nose up while it gathers speed; braking dives it, the brake lights glow.
        this.pose = v < was - 0.01 ? BODY_DIVE : v < R.speed - 0.01 ? BODY_SQUAT : BODY_LEVEL;
        this.tailLamp = v < was - 0.01 ? BLINK_BRAKE + 1 : 0;
        this.drive(dir * Math.min(v, left));
        if (v < R.speed - 0.1 && left < 14 && guard % 2 === 0) dust(this.world, this.x - dir * 20, this.y, 1);
        else if (guard % 6 === 0) dust(this.world, this.x - dir * 22, this.y, 1);
        yield;
      }
      this.ramming = false;
      this.speed = 0;
      this.tailLamp = 0;
      this.settle();
      this.world.audio.sfx('swan/skid', { pitch: 0.75, vol: 0.7 });
      dust(this.world, this.x + dir * 22, this.y, 3);
      if (blocked) {
        // It backs up to its spot (reversing beeps).
        yield 12;
        this.reversing = true;
        this.cabin = CAB_BACK;
        this.tailLamp = BLINK_REVERSE + 1;
        this.poseSeq = [[BODY_DIVE, 4]];
        this.poseHold = 0;
        const home = this.homeX(this.side);
        for (let guard = 0; guard < 400; guard++) {
          const left = home - this.x;
          if (Math.abs(left) < 0.5) break;
          if (guard % 40 === 0) this.world.audio.sfx('ams/reverse-beep');
          this.drive(Math.sign(left) * Math.min(1.5, Math.abs(left)));
          yield;
        }
        this.reversing = false;
        this.tailLamp = 0;
        this.poseSeq = [[BODY_SQUAT, 4]];
        this.poseHold = 0;
      } else {
        // It turns around at the far side.
        yield 6;
        this.facing = this.facing < 0 ? 1 : -1;
        this.side = this.side < 0 ? 1 : -1;
        dust(this.world, this.x, this.y, 4);
      }
      this.cabin = CAB_CALM;
      yield this.recoveryFor(R.rec);
    } finally {
      this.revving = false;
      this.ramming = false;
      this.reversing = false;
      this.rockY = 0;
      this.speed = 0;
      this.tailLamp = 0;
      this.cabin = CAB_CALM;
      this.busy = false;
    }
  }

  /** TOW CALL: `TAKELWAGEN!`, then a tow truck backs in from the far side (one at a time). */
  *towCall(): ScriptGen {
    if (this.holdAdds || this.truck() || this.world.countAlive(TRUCK_TAG) > 0) {
      yield 1;
      return;
    }
    this.busy = true;
    try {
      const tr = this.mark('tow');
      this.cabin = CAB_SHOUT;
      this.say('TAKELWAGEN!', { at: SCAN.sayAt, ticks: 90 });
      yield SCAN.tow.call;
      if (this.holdAdds) return;
      const from = -this.side;
      const x = from < 0 ? this.arenaLeft - 100 : this.arenaLeft + this.arenaW + 100;
      this.world.spawn(TRUCK_ID, x, this.y, { from: from < 0 ? 'left' : 'right', arenaLeft: this.arenaLeft, arenaW: this.arenaW });
      tr.fire = this.world.tick;
      yield 20;
    } finally {
      this.cabin = CAB_CALM;
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.revving = false;
    this.ramming = false;
    this.reversing = false;
    this.rockY = 0;
    this.tailLamp = 0;
    this.pose = BODY_LEVEL;
    this.poseSeq = [];
    this.dropReticle();
    this.cabin = CAB_AIRBAG;
    this.hazard = true;
    // The helpers go: the truck drives off, the clamps fall apart.
    for (const t of [...this.world.byTag(TRUCK_TAG)]) if (t instanceof AmsTowTruck) t.leave();
    for (const c of [...this.world.byTag(CLAMP_TAG)]) if (c instanceof AmsWheelClamp) c.fallApart();
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    const w = this.world;
    const D = SCAN.death;
    return (function* scanCarDeath(): ScriptGen {
      // The airbag pops.
      w.audio.sfx('ams/airbag');
      self.say('AIRBAG!', { at: SCAN.sayAt, ticks: 80 });
      debris(w, self.x, self.y - 22, 'glass', 6);
      yield D.airbag;
      for (let k = 0; k < D.blasts; k++) {
        const c = self.randomPoint();
        explosion(w, c[0], c[1], 's', { silent: k % 2 === 1 });
        yield 10;
      }
      // It hops and flips onto its roof.
      self.hazard = false;
      self.liftV = D.flipVy;
      self.lift = 0;
      const air = Math.round((-2 * D.flipVy) / 0.2);
      for (let t = 0; t < 200; t++) {
        self.liftV += 0.2;
        self.lift -= self.liftV;
        const k = Math.min(1, t / air);
        self.wreckFrame = Math.min(WRECK_ROLLS - 1, Math.floor(k * WRECK_ROLLS));
        if (self.lift <= 0 && t > 4) break;
        yield;
      }
      self.lift = 0;
      self.wreckFrame = WRECK_IMPACT;
      const c = self.center();
      explosion(w, c[0], self.y - 14, 'm', { debris: 'metal', shake: 3 });
      debris(w, self.x, self.y - 10, 'metal', 10);
      dust(w, self.x - 24, self.y, 4);
      dust(w, self.x + 24, self.y, 4);
      // The roof caves in on the impact, then springs back a little (the same 30 ticks as before).
      yield 6;
      self.wreckFrame = WRECK_REST;
      yield 24;
      // The driver crawls out and runs off (away from the nearest player).
      const t = self.world.nearestPlayer(self.x, self.y);
      self.driverDir = t && t.x > self.x ? -1 : 1;
      self.driverX = self.x + self.driverDir * 8;
      self.driverX0 = self.driverX;
      self.driverY = self.y;
      self.driverOn = hasSprite(ID.driverRun);
      self.driverFrames = self.driverOn ? getFrames(ID.driverRun).length : 0;
      w.audio.sfx('enemy/panic');
      yield 24;
      self.drop();
      yield 30;
    })();
  }

  /** The drop: `pickup-repair` when a player rides a vehicle, else a weapon (H, R or L). */
  private drop(): void {
    const w = this.world;
    let riding = false;
    for (const p of w.players) if (isPlayer(p) && p.state === 'mounted') riding = true;
    // On the arena side of the wreck.
    const toward = this.x > this.arenaLeft + this.arenaW / 2 ? -1 : 1;
    const x = this.x + toward * 30;
    const y = this.y - 14;
    this.dropped = riding ? w.spawn('pickup-repair', x, y, { dropped: true }) : w.spawn('pickup-weapon', x, y, { weapon: this.pick(['H', 'R', 'L']), dropped: true });
  }

  override update(): void {
    super.update();
    if (this.state !== 'dying' && this.state !== 'done') return;
    const w = this.world;
    // The wreck smokes for a while.
    if (this.deathT < SCAN.death.smoke && w.tick % 9 === 0) smokeTrail(w, this.x + w.fxRng.range(-20, 20), this.y - 18 - this.lift, true);
    if (this.driverOn) {
      this.driverX += this.driverDir * 1.8;
      this.driverY = floorNear(w, this.driverX, this.driverY, 12, 24);
      if (!w.camera.containsPoint(this.driverX, this.driverY - 10, 40)) this.driverOn = false;
    }
  }

  // ------------------------------------------------------------------------------- drawing

  /**
   * RENDER ONLY (docs/design/floor.md §12.1 item 4): on a perspective floor that lists this kind (`ams`
   * c), the car's box — its roof, windscreen and bonnet tops and the end toward the screen's centre
   * (ams/floor/entities.ts `scanCarFaces`) — on the body's own grid (its shake and rev rock); the wreck
   * draws none. Without such a floor nothing is drawn.
   */
  override drawFloorFaces(r: Renderer): void {
    const dx = Math.round(this.x) + this.shakeX - this.x;
    const dy = Math.round(this.y) - this.rockY - this.y;
    drawEntityFaces(r, this, this.wreckFrame >= 0 ? 1 : 0, this.facing < 0, dx, dy);
  }

  override draw(r: Renderer): void {
    const dead = this.state === 'dying' || this.state === 'done';
    const flip = this.facing < 0;
    drawOpts.flipX = flip;
    drawOpts.flash = false;
    if (this.wreckFrame >= 0) {
      // The wreck has frames for each facing (WRECK_FACING apart): never flipped, so its print
      // marks are set the same way as on the live car.
      drawOpts.flipX = false;
      r.sprite(ID.wreck, this.wreckFrame + (flip ? WRECK_FACING : 0), Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
      this.drawDriver(r);
      return;
    }
    const x = Math.round(this.x) + this.shakeX;
    const y = Math.round(this.y);
    const yb = y - this.rockY;
    const pose = this.pose;
    const mx = (lx: number): number => x + (flip ? -lx : lx);
    const body = this.parts[P_BODY];
    const scanner = this.parts[P_SCANNER];
    // The scanner first: its rack feet tuck behind the roof (no gap when the body pitches).
    const sy = yb + bodyShift(SCAN_REF_X, pose);
    if (scanner.destroyed) r.sprite(ID.scannerGone, 0, x, sy, drawOpts);
    else {
      drawOpts.flash = !dead && scanner.flash >= 3;
      const state = this.partState(scanner);
      const f = this.printT > PRINT_TICKS - PRINT_KICK ? SCAN_FIRE : this.printT > 0 ? SCAN_RECOIL : this.scanFrame;
      r.sprite(ID.scanner[state], f, x, sy, drawOpts);
      drawOpts.flash = false;
    }
    drawOpts.flash = !dead && body.flash >= 3;
    r.sprite(ID.body[this.partState(body)], pose, x, yb, drawOpts);
    // The officer behind the glass: shock while staggered, the airbag pops, the shout shakes a fist.
    let cab = this.staggerTicks > 0 && !dead ? CAB_SHOCK : this.cabin;
    if (cab === CAB_AIRBAG && this.deathT < 4) cab = CAB_AIRBAG_POP;
    else if (cab === CAB_SHOUT && Math.floor(this.world.tick / 6) % 2 === 1) cab = CAB_SHOUT_B;
    // (it carries the front door's glass: it flashes with the body)
    r.sprite(ID.cabin, cab, x, yb + bodyShift(CAB_REF_X, pose), drawOpts);
    drawOpts.flash = false;
    // The print marks on the doors: never mirrored (they read the same way on either side); the
    // rear door's block has a frame for each facing, set against the (mirrored) crosses.
    drawOpts.flipX = false;
    for (let i = 0; i < 2; i++) {
      const [tx, ty] = SCAN.text[i];
      r.sprite(ID.text, flip ? SCAN.textFlip[i] : i, mx(tx), yb + ty + bodyShift(tx, pose), drawOpts);
    }
    // The box's number (lifted 1-2 px; askew at state 2: no number).
    if (!scanner.destroyed && this.partState(scanner) < 2) {
      const [tx, ty] = SCAN.text[2];
      const lift = Math.min(this.scanFrame, SCAN_LIFT2);
      r.sprite(ID.text, 2, mx(tx), sy + ty - lift, drawOpts);
    }
    drawOpts.flipX = flip;
    const f = ((Math.floor(this.wheelDist / 1.9) % 4) + 4) % 4;
    for (let i = 0; i < SCAN.wheelX.length; i++) {
      const wx = SCAN.wheelX[i];
      r.sprite(ID.wheel, f, mx(wx), y + SCAN.wheelY, drawOpts);
    }
    // Hazard lights: slow blink; fast while staggered or revving. Brake and reversing lamps.
    const fast = this.staggerTicks > 0 || this.revving;
    if (this.hazard && Math.floor(this.world.tick / (fast ? 4 : 16)) % 2 === 0) {
      for (let i = 0; i < SCAN.lamps.length; i++) {
        const [lx, ly] = SCAN.lamps[i];
        r.sprite(ID.blink, BLINK_HAZARD, mx(lx), yb + ly + bodyShift(lx, pose), drawOpts);
      }
    }
    if (this.tailLamp > 0 && !dead) {
      r.sprite(ID.blink, this.tailLamp - 1, mx(TAIL_GLOW[0]), yb + TAIL_GLOW[1] + bodyShift(TAIL_GLOW[0], pose), drawOpts);
    }
    this.drawBeam(r, x, sy, flip);
    this.drawDriver(r);
  }

  /** SCAN LOCK's beam: the front camera to the reticle (dashed and dim while it tracks, hot once locked). */
  private drawBeam(r: Renderer, x: number, sy: number, flip: boolean): void {
    const ret = this.reticle;
    if (!ret || !ret.alive || ret.fade >= 0 || this.scanFrame < SCAN_ON) return;
    if (ret.locked && Math.floor(ret.t / 3) % 2 === 1) return;
    const x0 = x + (flip ? -CAMERA[0] : CAMERA[0]);
    const y0 = sy + CAMERA[1];
    const x1 = Math.round(ret.x);
    const y1 = Math.round(ret.y);
    if (ret.locked) {
      r.line(x0, y0, x1, y1, BEAM_LOCK);
      return;
    }
    // Tracking: a dashed line whose dashes run toward the target.
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
    const ph = this.world.tick % 2;
    for (let k = ph; k < n; k += 2) {
      const a = k / n;
      const b = (k + 1) / n;
      r.line(Math.round(x0 + (x1 - x0) * a), Math.round(y0 + (y1 - y0) * a), Math.round(x0 + (x1 - x0) * b), Math.round(y0 + (y1 - y0) * b), BEAM_TRACK);
    }
  }

  private drawDriver(r: Renderer): void {
    if (!this.driverOn || this.driverFrames === 0) return;
    drawOpts.flipX = this.driverDir < 0;
    drawOpts.flash = false;
    // The frame follows the distance he ran: his walk strip's stride at his own walk speed.
    const f = driverFrame(Math.abs(this.driverX - this.driverX0)) % this.driverFrames;
    r.sprite(ID.driverRun, f, Math.round(this.driverX), Math.round(this.driverY), drawOpts);
  }

  /** The wreck's rotation centre sits WRECK.mid px above its anchor (art.ts). */
  static readonly WRECK_MID = WRECK.mid;
}

defineEntity(SCAN_ID, (w, x, y, p) => new AmsScanCar(w, x, y, p), {
  category: 'boss',
  score: SCAN.score,
  description: 'ams mid-boss (section c): the parking scan car (scanner 400, body 900); SCAN LOCK, RAM, TOW CALL (tow truck + wheel clamps). Params facing, arenaLeft, arenaW, hpScale.',
});
