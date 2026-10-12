/**
 * Shared runtime helpers of the fleet (GDD §8.1): the ground-vehicle base used by the SUNDAE
 * DRIVER and THE BANDWAGON, the cockpit-driver drawing helper, and small queries.
 *
 * `GroundVehicle` adds to the game layer's `Vehicle` (it never edits it, it overrides):
 * - a heavy vehicle's drive: it accelerates and brakes with its own rates and **faces its
 *   direction of travel** (holding the other way brakes first; up locks the facing, so up + back
 *   aims the turret back-up while it reverses);
 * - its own `control()` with the shared combo rules (down + jump = eject, fire + jump = ram,
 *   fire + bomb = special; both presses on the same tick or `TUNING.vehicle.comboWindow` ticks
 *   apart, GDD §4.1) and a per-vehicle aim hook (`updateAim`);
 * - squashing soft enemies (GDD §8.3 / §8.4 "Contact"), the STRIKE! bonus (§14.2), the panic
 *   rule (§8.1, measured from the whole vehicle box), the 60-tick hit flicker (§8.1), deep water
 *   (§8.3), the empty-gag timer, and an eject out of the roof hatch;
 * - the driver's anchor on the ground line under the cab (enemy AI reads a player's y as the feet,
 *   so aimed shots hit the vehicle), while the `mount` pose is drawn in the cab window.
 * The RIDE? bubble comes from the base class (`showRideHint`, 8 px above the hatch).
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { VirtualPad } from '../../../../engine/input';
import { approach, distToRect, overlaps, type Rect } from '../../../../engine/math';
import { jump, pushX } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hudOf, iceAt } from '../../../context';
import { Enemy } from '../../../enemy';
import { awardScore, type EjectMode } from '../../../events';
import type { Player } from '../../../player/player';
import type { SpawnParams } from '../../../registry';
import { TUNING } from '../../../tuning';
import { Vehicle, type VehicleOpts } from '../../../vehicle';
import { waterSurfaceAt } from '../../../water';
import { GROUND } from './numbers';

type ComboButton = 'fire' | 'jump' | 'bomb';
const COMBO_BUTTONS: readonly ComboButton[] = ['fire', 'jump', 'bomb'];

const driverOpts: DrawOpts = {};
const mountIds = new Map<string, string>();

/** The respawn / mount blink shared by every way of drawing a mounted player. */
export function riderHidden(p: Player): boolean {
  return p.invulnTicks > 0 && Math.floor(p.world.tick / TUNING.life.respawnBlinkTicks) % 2 === 1;
}

/**
 * Draw a cockpit driver (van, Bandwagon): the rig `mount` frame 1 (seated, hands forward), feet
 * on (x, y), with the invulnerability blink. Unlike `Player.drawSeated` it never cycles to the
 * climbing frame 0, so the head in the window stays still.
 */
export function drawDriver(r: Renderer, p: Player, x: number, y: number, flipX: boolean): void {
  if (riderHidden(p)) return;
  let id = mountIds.get(p.art);
  if (id === undefined) {
    id = `${p.art}/mount`;
    mountIds.set(p.art, id);
  }
  driverOpts.flipX = flipX;
  r.sprite(id, 1, Math.round(x), Math.round(y), driverOpts);
}

/** A soft enemy (squashable), not a boss part. */
export function isSquashable(e: Entity): boolean {
  return e.alive && e.team === 'enemy' && e.hasTag('soft') && !e.hasTag('boss');
}

/** First hurtbox index of `e` that overlaps any of `boxes`, or −1. */
export function touchingPart(e: Entity, boxes: readonly Rect[]): number {
  const hb = e.hurtboxes();
  for (let k = 0; k < hb.length; k++) for (let i = 0; i < boxes.length; i++) if (overlaps(hb[k], boxes[i])) return k;
  return -1;
}

/** Ground-vehicle numbers on top of VehicleOpts. */
export interface GroundOpts extends VehicleOpts {
  /** Hurtbox (art size; the physics body `w` × `h` may be narrower). */
  hurt: Rect;
  /** Deceleration when the stick is released or reversed. */
  brake: number;
  /** Squash speed and whether exactly that speed already squashes. */
  squashSpeed: number;
  squashInclusive: boolean;
  /** Half the art width (the view clamp keeps the whole vehicle visible). */
  halfWidth: number;
  /** Where an ejected pilot pops out (body space). */
  hatch: readonly [number, number];
  /** The driver's anchor (his "feet", body space). */
  driverAnchor: readonly [number, number];
}

const boxScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Base of the two wheeled fleet vehicles. Subclasses set the aim (`updateAim`), fire their guns
 * (`fireMain`, `fireCannon` and the special weapon) and draw themselves.
 */
export abstract class GroundVehicle extends Vehicle {
  readonly brake: number;
  readonly squashSpeed: number;
  readonly squashInclusive: boolean;
  readonly halfWidth: number;
  readonly hatch: readonly [number, number];
  readonly driverAnchor: readonly [number, number];
  /** Distance rolled (wheel animation). */
  roll = 0;
  /** Ticks of the white hit flicker left (GDD §8.1: 60 after a hit). */
  hitFlashT = 0;
  /** Empty-gag timers: ticks parked and empty, ticks of the gag left. */
  idleT = 0;
  gagT = 0;
  /** Windup-bots crushed in this run (STRIKE!, GDD §14.2). */
  strikeRun = 0;
  private slowT = 0;
  private readonly panicPhase: number;

  constructor(world: World, x: number, y: number, params: SpawnParams, o: GroundOpts) {
    super(world, x, y, params, o);
    this.hitbox = { ...o.hurt };
    this.brake = o.brake;
    this.squashSpeed = o.squashSpeed;
    this.squashInclusive = o.squashInclusive;
    this.halfWidth = o.halfWidth;
    this.hatch = o.hatch;
    this.driverAnchor = o.driverAnchor;
    // Vehicles never drop through one-way platforms: control() never calls dropThrough, so
    // down + jump stays free for the eject (GDD §8.1).
    this.panicPhase = this.id % GROUND.panicEvery;
    // Parked facing left on request (spawn param `facing: -1` or `'left'`).
    if (params.facing === -1 || params.facing === 'left') this.facing = -1;
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    super.update();
    const driven = this.state === 'driven';
    const speed = Math.abs(this.vx);
    this.roll += this.vx;
    if (this.hitFlashT > 0) this.hitFlashT--;
    if (driven) {
      this.squash(speed);
      this.panicNearby(speed);
    }
    // A run ends once the vehicle has crawled for a while (STRIKE! counts one run).
    if (speed < GROUND.strikeMinSpeed) {
      if (++this.slowT >= GROUND.strikeStopTicks) this.strikeRun = 0;
    } else this.slowT = 0;
    this.updateIdle();
    this.checkWater();
  }

  /** Heavy-vehicle drive, combos, aim and guns (replaces the base control). */
  protected override control(pad: VirtualPad): void {
    const tick = this.world.tick;
    const ax = pad.axisX();
    const ice = this.iceFriction && this.body?.onGround && iceAt(this.world, this.x);
    const braking = ax === 0 || ax * this.vx < 0;
    let rate = braking ? this.brake : this.accel;
    if (ice) rate = Math.min(rate, braking ? TUNING.player.iceDecel : TUNING.player.iceAccel);
    this.vx = approach(this.vx, ax * this.speed, rate);
    this.updateFacing(ax, pad.held('up'));

    for (let i = 0; i < COMBO_BUTTONS.length; i++) if (pad.pressed(COMBO_BUTTONS[i])) this.pressedAt[COMBO_BUTTONS[i]] = tick;
    if (pad.pressed('jump') && pad.held('down')) {
      this.eject('exit');
      return;
    }
    const [ramA, ramB] = TUNING.vehicle.ramButtons;
    if (this.combo(ramA, ramB)) {
      this.pressedAt[ramA] = this.pressedAt[ramB] = -1000;
      this.eject('ram');
      return;
    }
    const [spA, spB] = TUNING.vehicle.specialButtons;
    let comboUsed = false;
    if (this.combo(spA, spB)) {
      this.pressedAt[spA] = this.pressedAt[spB] = -1000;
      this.trySpecial();
      comboUsed = true;
    }
    if (!comboUsed) {
      if (pad.pressed('jump') && this.jumpVelocity < 0 && this.body?.onGround) jump(this, this.jumpVelocity);
      if (pad.pressed('bomb')) this.cannonGun.press();
      if (pad.pressed('fire')) this.mainGun.press();
    }

    this.updateAim(pad);

    this.mainGun.tick();
    this.cannonGun.tick();
    this.specialGun?.tick();
    if (this.mainGun.wants(pad.held('fire'))) this.fireMain();
    if (this.cannonGun.pending) {
      if (this.shells <= 0) {
        this.cannonGun.buffer = 0;
        this.world.audio.sfx('weapon/empty');
      } else if (this.cannonGun.wants(false)) {
        this.fireCannon();
        this.shells--;
      }
    }
  }

  /** The turret / bell (called every driven tick after the combos). */
  protected abstract updateAim(pad: VirtualPad): void;

  /** Hook: the vehicle turned around (a turret keeps its world direction). */
  protected onTurn(): void {}

  /**
   * The vehicle faces its direction of travel; standing still, it turns to the stick at once.
   * Up locks the facing (as on the Swan, GDD §8.2; chosen for the van and the truck, GDD silent):
   * up + back aims the turret back-up while the vehicle reverses without turning.
   */
  protected updateFacing(ax: number, locked = false): void {
    if (locked) return;
    let f = this.facing;
    if (Math.abs(this.vx) > 0.05) f = this.vx > 0 ? 1 : -1;
    else if (ax !== 0) f = ax > 0 ? 1 : -1;
    if (f !== this.facing) {
      this.facing = f;
      this.onTurn();
    }
  }

  /** The driver's anchor sits on the ground line under the cab (see the header). */
  protected override syncDriver(): void {
    const p = this.driver;
    if (!p) return;
    p.x = p.prevX = this.x + this.driverAnchor[0] * this.facing;
    p.y = p.prevY = this.y + this.driverAnchor[1];
    p.facing = this.facing;
    p.vx = this.vx;
    p.vy = this.vy;
  }

  /** The whole vehicle (not only its narrower body) stays inside the view. */
  protected override keepInView(): void {
    const dx = this.world.camera.clampX(this.x, this.halfWidth) - this.x;
    if (dx === 0) return;
    if (this.body) pushX(this, dx, this.world.terrain, this.world);
    else this.x += dx;
    if (dx * this.vx < 0) this.vx = 0;
  }

  /** Eject out of the roof hatch (the base would use the drawing seat inside the cab). */
  override eject(mode: EjectMode = 'exit'): void {
    const p = this.driver;
    super.eject(mode);
    if (!p || p.vehicle === this) return;
    p.x = p.prevX = this.x + this.hatch[0] * this.facing;
    p.y = p.prevY = this.y + this.hatch[1];
    this.strikeRun = 0;
  }

  override mount(p: Player): void {
    super.mount(p);
    this.strikeRun = 0;
    this.idleT = 0;
    this.gagT = 0;
  }

  /** A hit that cost a cell starts the 60-tick flicker (GDD §8.1). */
  override onHit(d: Damage): boolean {
    const before = this.cells;
    const absorbed = super.onHit(d);
    if (this.cells < before) this.hitFlashT = GROUND.hitFlashTicks;
    return absorbed;
  }

  // ------------------------------------------------------------------------------- contact

  /** Squash soft enemies the vehicle drives into fast enough (no damage to the vehicle). */
  protected squash(speed: number): void {
    // ε: speeds built from 0.08 steps carry float dust (20 × 0.08 = 1.6000000000000003).
    const eps = 1e-6;
    if (this.squashInclusive ? speed < this.squashSpeed - eps : speed <= this.squashSpeed + eps) return;
    const boxes = this.hurtboxes();
    const list = this.world.snapshotTag('soft');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!isSquashable(e)) continue;
        const part = touchingPart(e, boxes);
        if (part < 0) continue;
        const d: Damage = { amount: GROUND.squashDamage, kind: 'crush', dirX: this.facing, owner: this.lastDriver, source: this, weapon: this.type };
        this.world.damage(e, d, part);
        if (e.dead && e.type === 'windup-bot') this.countStrike(e);
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  /** STRIKE! (GDD §14.2): the sixth windup-bot crushed in one run. */
  private countStrike(e: Entity): void {
    if (++this.strikeRun !== GROUND.strikeCount) return;
    awardScore(this.world, this.lastDriver, GROUND.strikeScore, e.x, e.y - 48);
    hudOf(this.world).callout(`STRIKE! +${GROUND.strikeScore.toLocaleString('en-US')}`);
  }

  /**
   * GDD §8.1: Legion infantry within 64 px of a moving vehicle panic (30 %, once per 60 ticks).
   * Measured from the whole 80–96 px vehicle box (the base `panicInfantry` measures from the
   * anchor, which suits a 28 px swan).
   */
  private panicNearby(speed: number): void {
    if (speed < GROUND.panicMinSpeed || this.world.tick % GROUND.panicEvery !== this.panicPhase) return;
    const box = this.hitRect(boxScratch);
    const list = this.world.snapshotTag('legion');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!(e instanceof Enemy) || !e.alive || !e.soft || e.reacting) continue;
        if (distToRect(e.x, e.y + e.hitbox.y * 0.5, box) > GROUND.panicRange) continue;
        if (this.world.rng.chance(GROUND.panicChance)) e.react('panic', GROUND.panicTicks, this);
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  // ------------------------------------------------------------------------------- parked

  /** Parked, empty and intact: count toward the empty gag. */
  private updateIdle(): void {
    if (this.state !== 'idle' || this.dead) {
      this.idleT = 0;
      this.gagT = 0;
      return;
    }
    this.idleT++;
    if (this.gagT > 0) this.gagT--;
    else if (this.idleT >= GROUND.gagDelay && (this.idleT - GROUND.gagDelay) % GROUND.gagEvery === 0) {
      this.gagT = GROUND.gagTicks;
      this.onGag();
    }
  }

  /** Hook: the empty gag starts (play a sound, puff a note …). */
  protected onGag(): void {}

  /** GDD §8.3: a wheeled vehicle cannot swim; deep water destroys it. */
  private checkWater(): void {
    if (this.state !== 'driven' && this.state !== 'idle') return;
    const surface = waterSurfaceAt(this, this.x, this.y - 64);
    if (!Number.isFinite(surface) || this.y < surface + GROUND.sinkDepth) return;
    if (this.state === 'driven') this.destroy('forced');
    else this.explode();
  }

  // ------------------------------------------------------------------------------- drawing

  /** White flash: the brief hit flash, the 60-tick after-hit flicker, the doomed alarm. */
  protected flashOn(): boolean {
    const t = this.world.tick;
    if (this.state === 'doomed') return t % 2 === 0;
    if (this.flashTicks > 0) return t % 2 === 0;
    return this.hitFlashT > 0 && this.hitFlashT % 6 < 2;
  }

  /** The last cell blinks red (GDD §8.1), drawn over the vehicle's own sprites. */
  protected redTint(): boolean {
    return this.state === 'driven' && this.cells <= 1 && this.world.tick % 20 < 6;
  }

  /** Is the special ready (for the HUD's ready dot, GDD §13.7)? */
  get specialReady(): boolean {
    const g = this.specialGun;
    return g !== null && g.ready && this.shells >= this.specialCost;
  }
}
