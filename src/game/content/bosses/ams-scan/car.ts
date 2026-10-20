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
import { getFrames, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { debris, dust, explosion, smokeTrail } from '../../../fx';
import { isPlayer, type Player } from '../../../player/player';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { AmsTowTruck, AmsWheelClamp, BOSS_HIT, floorNear, isClamped, ScanReticle, ScanTicket } from './adds';
import { CAB, CLAMP_TAG, ID, SCAN, SCAN_ART, SCAN_ID, SCAN_NAME, SCAN_TAG, TRUCK_ID, TRUCK_TAG, WRECK } from './geometry';

const P_SCANNER = 0;
const P_BODY = 1;
const drawOpts: DrawOpts = {};
const ramRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const pt: [number, number] = [0, 0];

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
  /** Scanner strip frame: 0 down, 1 half, 2 up, 3 scanning. */
  scanFrame = 0;
  /** Cabin frame (CAB). */
  cabin: number = CAB.calm;
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
  /** −1 upright; wreck strip frame 0–2 rolling, 3 on its roof. */
  wreckFrame = -1;
  /** Height over the floor while it flips (px up). */
  lift = 0;
  private liftV = 0;
  private driverOn = false;
  private driverX = 0;
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
    this.scanFrame = 0;
    this.cabin = CAB.calm;
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
    this.world.audio.sfx('swan/skid', { pitch: 0.8, vol: 0.6 });
    dust(this.world, this.x + this.facing * 20, this.y, 3);
    yield 14;
    // The scanner bar rises (invulnerable), the pods flash: the plate is scanned.
    this.world.audio.sfx('ams/scan-up');
    for (let i = 0; i < I.rise; i++) {
      this.trackArena();
      this.scanFrame = i < 16 ? 0 : i < 32 ? 1 : i < 44 ? 2 : i < 54 ? 3 : 2;
      if (i === 44) {
        this.world.audio.sfx('ams/scan-beep', { pitch: 0.8 });
        this.say('KENTEKEN GESCAND.', { at: SCAN.sayAt, ticks: 100 });
      }
      yield;
    }
    this.scanFrame = 2;
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
      this.scanFrame = 3;
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
        yield;
      }
      ret.locked = true;
      ret.t = 0;
      this.world.audio.sfx('ams/scan-beep');
      const freeze = this.telegraphFor(S.freeze);
      for (let i = 0; i < freeze; i++) {
        if (!this.partAlive('scanner')) return;
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
        if (tr.fire < 0) tr.fire = this.world.tick;
        if (k < n - 1) yield S.gap;
      }
      // The reticle stays on the spot (blinking out) until the strip lands.
      ret.fade = Math.max(12, land);
      this.reticle = null;
      this.scanFrame = 2;
      yield this.recoveryFor(S.rec);
    } finally {
      if (this.reticle) this.dropReticle();
      if (this.partAlive('scanner')) this.scanFrame = 2;
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
      this.cabin = CAB.shout;
      this.world.audio.sfx('ams/rev');
      const tele = this.telegraphFor(R.tele);
      for (let i = 0; i < tele; i++) {
        this.rockY = Math.floor(i / 2) % 2;
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
        this.cabin = CAB.calm;
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
        v = Math.min(R.speed, v + R.accel, Math.max(0.6, Math.sqrt(2 * 0.45 * left)));
        this.drive(dir * Math.min(v, left));
        if (v < R.speed - 0.1 && left < 14 && guard % 2 === 0) dust(this.world, this.x - dir * 20, this.y, 1);
        else if (guard % 6 === 0) dust(this.world, this.x - dir * 22, this.y, 1);
        yield;
      }
      this.ramming = false;
      this.speed = 0;
      this.world.audio.sfx('swan/skid', { pitch: 0.75, vol: 0.7 });
      dust(this.world, this.x + dir * 22, this.y, 3);
      if (blocked) {
        // It backs up to its spot (reversing beeps).
        yield 12;
        this.reversing = true;
        const home = this.homeX(this.side);
        for (let guard = 0; guard < 400; guard++) {
          const left = home - this.x;
          if (Math.abs(left) < 0.5) break;
          if (guard % 40 === 0) this.world.audio.sfx('ams/reverse-beep');
          this.drive(Math.sign(left) * Math.min(1.5, Math.abs(left)));
          yield;
        }
        this.reversing = false;
      } else {
        // It turns around at the far side.
        yield 6;
        this.facing = this.facing < 0 ? 1 : -1;
        this.side = this.side < 0 ? 1 : -1;
        dust(this.world, this.x, this.y, 4);
      }
      this.cabin = CAB.calm;
      yield this.recoveryFor(R.rec);
    } finally {
      this.revving = false;
      this.ramming = false;
      this.reversing = false;
      this.rockY = 0;
      this.speed = 0;
      this.cabin = CAB.calm;
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
      this.cabin = CAB.shout;
      this.say('TAKELWAGEN!', { at: SCAN.sayAt, ticks: 90 });
      yield SCAN.tow.call;
      if (this.holdAdds) return;
      const from = -this.side;
      const x = from < 0 ? this.arenaLeft - 100 : this.arenaLeft + this.arenaW + 100;
      this.world.spawn(TRUCK_ID, x, this.y, { from: from < 0 ? 'left' : 'right', arenaLeft: this.arenaLeft, arenaW: this.arenaW });
      tr.fire = this.world.tick;
      yield 20;
    } finally {
      this.cabin = CAB.calm;
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.revving = false;
    this.ramming = false;
    this.reversing = false;
    this.rockY = 0;
    this.dropReticle();
    this.cabin = CAB.airbag;
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
        self.wreckFrame = Math.min(2, Math.floor(k * 4));
        if (self.lift <= 0 && t > 4) break;
        yield;
      }
      self.lift = 0;
      self.wreckFrame = 3;
      const c = self.center();
      explosion(w, c[0], self.y - 14, 'm', { debris: 'metal', shake: 3 });
      debris(w, self.x, self.y - 10, 'metal', 10);
      dust(w, self.x - 24, self.y, 4);
      dust(w, self.x + 24, self.y, 4);
      yield 30;
      // The driver crawls out and runs off (away from the nearest player).
      const t = self.world.nearestPlayer(self.x, self.y);
      self.driverDir = t && t.x > self.x ? -1 : 1;
      self.driverX = self.x + self.driverDir * 8;
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

  override draw(r: Renderer): void {
    const dead = this.state === 'dying' || this.state === 'done';
    const flip = this.facing < 0;
    drawOpts.flipX = flip;
    drawOpts.flash = false;
    if (this.wreckFrame >= 0) {
      r.sprite(ID.wreck, this.wreckFrame, Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
      this.drawDriver(r);
      return;
    }
    const x = Math.round(this.x) + this.shakeX;
    const y = Math.round(this.y);
    const yb = y - this.rockY;
    const body = this.parts[P_BODY];
    const scanner = this.parts[P_SCANNER];
    const cab = this.staggerTicks > 0 && !dead ? CAB.shock : this.cabin;
    r.sprite(ID.cabin, cab, x, yb, drawOpts);
    drawOpts.flash = !dead && body.flash >= 3;
    r.sprite(ID.body[this.partState(body)], 0, x, yb, drawOpts);
    // The lettering on the doors (`PARKEERCONTROLE`, `Gemeente Amsterdam`): never mirrored, it
    // reads left to right on either side (art.ts `wreckComposite` puts it at the same spots).
    drawOpts.flipX = false;
    for (let i = 0; i < 2; i++) {
      const [tx, ty] = SCAN.text[i];
      r.sprite(ID.text, i, x + (flip ? -tx : tx), yb + ty, drawOpts);
    }
    drawOpts.flipX = flip;
    drawOpts.flash = false;
    const f = ((Math.floor(this.wheelDist / 1.9) % 4) + 4) % 4;
    for (let i = 0; i < SCAN.wheelX.length; i++) {
      const wx = SCAN.wheelX[i];
      r.sprite(ID.wheel, f, x + (flip ? -wx : wx), y + SCAN.wheelY, drawOpts);
    }
    if (scanner.destroyed) r.sprite(ID.scannerGone, 0, x, yb, drawOpts);
    else {
      drawOpts.flash = !dead && scanner.flash >= 3;
      const state = this.partState(scanner);
      r.sprite(ID.scanner[state], this.scanFrame, x, yb, drawOpts);
      // The box's number `24` (frames 1–3 lift the box 1–2 px; askew at state 2: no number).
      if (state < 2) {
        const [tx, ty] = SCAN.text[2];
        drawOpts.flipX = false;
        r.sprite(ID.text, 2, x + (flip ? -tx : tx), yb + ty - Math.min(this.scanFrame, 2), drawOpts);
        drawOpts.flipX = flip;
      }
      drawOpts.flash = false;
    }
    // Hazard lights: slow blink; fast while staggered or revving.
    const fast = this.staggerTicks > 0 || this.revving;
    if (this.hazard && Math.floor(this.world.tick / (fast ? 4 : 16)) % 2 === 0) {
      for (let i = 0; i < SCAN.lamps.length; i++) {
        const [lx, ly] = SCAN.lamps[i];
        r.sprite(ID.blink, 0, x + (flip ? -lx : lx), yb + ly, drawOpts);
      }
    }
    this.drawDriver(r);
  }

  private drawDriver(r: Renderer): void {
    if (!this.driverOn || this.driverFrames === 0) return;
    drawOpts.flipX = this.driverDir < 0;
    drawOpts.flash = false;
    r.sprite(ID.driverRun, Math.floor(this.world.tick / 3) % this.driverFrames, Math.round(this.driverX), Math.round(this.driverY), drawOpts);
  }

  /** The wreck's rotation centre sits WRECK.mid px above its anchor (art.ts). */
  static readonly WRECK_MID = WRECK.mid;
}

defineEntity(SCAN_ID, (w, x, y, p) => new AmsScanCar(w, x, y, p), {
  category: 'boss',
  score: SCAN.score,
  description: 'ams mid-boss (section c): the parking scan car (scanner 400, body 900); SCAN LOCK, RAM, TOW CALL (tow truck + wheel clamps). Params facing, arenaLeft, arenaW, hpScale.',
});
