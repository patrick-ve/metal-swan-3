/**
 * Rideable vehicles (docs/ARCHITECTURE.md §6, GDD §4.1, §8.1).
 *
 * - Enter: a player falling onto the seat box (or pressing down while touching it) climbs in.
 *   Not while a status forbids it (Helium Head), and not again before the pilot has landed.
 * - Armour: HP cells (default 3). Small hits (bullets, notes) cost ½ cell, big hits
 *   (explosions, beams, boss attacks, Damage tag 'heavy' / 'boss') 1 cell; crush, pits, lava and
 *   kill zones destroy it at once. 60 invulnerable ticks after every hit. The pilot cannot be hit.
 * - 0 cells: the vehicle stops and flashes for `ejectWindow` ticks (60); the pilot must jump out
 *   (jump or down + jump) or dies with it (EASY: thrown out automatically). Then it explodes.
 *   `pilotDiesWithVehicle` (flyers): losing the last cell costs the pilot a life at once.
 * - Buttons (GDD §4.1): drive, jump = hop, fire = main gun (aims up with the stick), bomb = heavy
 *   shell, **down + jump = eject**, **fire + jump = ram**, **fire + bomb = the special** (`special`
 *   weapon id or override `special()`). A combo needs both presses on the same tick or
 *   `TUNING.vehicle.comboWindow` (1) tick apart; a held button does not count. A combo cancels
 *   nothing that already happened (the first shot or hop stays).
 * - Ram: the pilot pops out (vy −4, 60 invulnerable ticks); the empty vehicle charges at
 *   `ramSpeed` for up to `ramDistance` px and explodes on the first enemy, wall or at the end:
 *   `ramDamage` in `ramRadius` (each target once, no falloff).
 * - A driven vehicle stays inside the view (the view edges are walls, as for players on foot) and
 *   never despawns; if it is removed anyway, the pilot is thrown out first.
 * - An empty vehicle shows the `RIDE?` hint bubble while a player on foot is within 96 px (GDD
 *   §8.1; the tail 8 px above the hatch, `rideBubbleTip()`).
 * - Opt-in helpers: `panicInfantry()` (GDD §8.1: Legion infantry near a moving vehicle may panic),
 *   `offscreenMarker` + `markerTop()` (the HUD's swan marker, GDD §13.7).
 *
 * Open-seat mounts (the Swan, docs/design/swan-mount/look.md §6.6): the `seat` point is the
 * rider's HIP (drawn with `Player.drawRide`), not the driver's feet; such a mount overrides
 * `seatWorld()` per pose and `syncDriver()` (the driver's anchor = its own feet anchor, so enemy
 * AI reads it like a player on foot).
 *
 * A content vehicle sets its numbers in the constructor and draws itself:
 * ```ts
 * class Buggy extends Vehicle {
 *   constructor(w: World, x: number, y: number, p: SpawnParams) {
 *     super(w, x, y, p, { art: 'vehicle/buggy', w: 40, h: 24, seat: { x: -10, y: -30, w: 20, h: 14 },
 *       seatPoint: [-2, -14], mainGun: 'vulcan', cannon: 'cannon', special: 'buggy-horn', speed: 1.8 });
 *   }
 * }
 * defineEntity('buggy', (w, x, y, p) => new Buggy(w, x, y, p), { category: 'vehicle' });
 * ```
 * Override hooks: `control(pad)` (flyers, boats), `physics()`, `special()` / `trySpecial()`,
 * `cellDamage(d)`, `fireMain()` / `fireCannon()`, `seatWorld(out)`, `syncDriver()`, `animate()`,
 * `draw(r)`, `updateRam()`, `rideBubbleTip(out)`. Sprites: `<art>/idle`, `<art>/move` (optional),
 * `<art>/wreck` (optional); frame points 'seat' (driver's feet), 'muzzle' (main gun), 'cannon'.
 * The driver is drawn with `Player.drawSeated` (`char/<id>/mount`).
 */
import { Entity, damageHas, type Damage } from '../engine/entity';
import type { Button, VirtualPad } from '../engine/input';
import { approach, distToRect, overlaps, rectAt, type Rect } from '../engine/math';
import { Body, jump, moveBody, pushX } from '../engine/physics';
import type { DrawOpts, Renderer } from '../engine/render';
import { Animator, framePoint, getFrame, hasSprite } from '../engine/sprites';
import type { HazardDef } from '../engine/terrain';
import type { World } from '../engine/world';
import { difficultyOf, hudOf, iceAt } from './context';
import type { EjectMode } from './events';
import { explosion, smokeTrail } from './fx';
import type { Mountable, Player } from './player/player';
import { NO_PARAMS, getWeapon, hasWeapon, paramNum, type SpawnParams } from './registry';
import type { VehicleCarry } from './session';
import { TUNING } from './tuning';
import { BUILTIN_GRENADE, Gun, aimAngle, aimDirOf, type AimDir, type FireArgs, type WeaponDef } from './weapons';

export interface VehicleOpts {
  /** Sprite prefix ('vehicle/buggy'). */
  art: string;
  /** Short HUD name ('SWAN-3', 'SUNDAE'; default: the entity id in capitals). */
  name?: string;
  /** Body / hitbox size (default 36×28). */
  w?: number;
  h?: number;
  /** Mount zone relative to the anchor (unflipped). */
  seat: Rect;
  /** Driver's feet relative to the anchor when the frame has no 'seat' point. */
  seatPoint?: readonly [number, number];
  /** Main gun / cannon muzzles when the frame has no 'muzzle' / 'cannon' point. */
  gunPoint?: readonly [number, number];
  cannonPoint?: readonly [number, number];
  /** HP cells (default TUNING.vehicle.cells). */
  cells?: number;
  /** Weapon ids (defaults 'vulcan' and 'cannon'). */
  mainGun?: string;
  cannon?: string;
  shells?: number;
  /** Weapon fired by fire + bomb (HONK, JINGLE …); or override `special()`. */
  special?: string;
  /** Shells a special costs (default 0; HONK 3). */
  specialCost?: number;
  speed?: number;
  accel?: number;
  /** Jump velocity (0 = cannot jump). */
  jump?: number;
  /** Ram charge speed (px/tick), run length (px), and its blast (default TUNING.vehicle). */
  ramSpeed?: number;
  ramDistance?: number;
  ramDamage?: number;
  ramRadius?: number;
  /** Blast when the wreck explodes (default 200 in r 40). */
  wreckDamage?: number;
  wreckRadius?: number;
  /** Ticks at 0 cells before the wreck explodes (the pilot's chance to jump out; default 60). */
  ejectWindow?: number;
  /** Flyers: losing the last cell costs the pilot a life at once (no eject window). */
  pilotDiesWithVehicle?: boolean;
  /** Slides on ice ranges like a player (default true). */
  iceFriction?: boolean;
  /** Score bonus when the boss dies while riding. */
  bonus?: number;
}

/** 'doomed' = 0 cells with the pilot still inside (the eject window). */
export type VehicleState = 'idle' | 'driven' | 'doomed' | 'ram' | 'wreck';

/** The combo buttons a vehicle tracks. */
type ComboButton = 'fire' | 'jump' | 'bomb';

const HALF_PI = Math.PI / 2;
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { tint: 0xff3020ff, alpha: 0.45 };
/** Reused trigger arguments (Gun.fire copies them into its context). */
const args: FireArgs = { x: 0, y: 0, angle: 0, facing: 1 };
const pt: [number, number] = [0, 0];
const seatRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const footRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const hazRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const hazards: HazardDef[] = [];
const tipPt: [number, number] = [0, 0];

/** GDD §8.1: the RIDE? bubble shows while a player on foot is this close (px). */
const RIDE_BUBBLE_RANGE = 96;
/** The bubble is refreshed this often (ticks) and lives a little longer than that. */
const RIDE_BUBBLE_EVERY = 30;
/** GDD §8.1 panic: Legion infantry this close to a moving player vehicle (px) … */
const PANIC_RANGE = 64;
/** … may panic with this chance, checked once per `PANIC_EVERY` ticks per soldier, for `PANIC_TICKS`. */
const PANIC_CHANCE = 0.3;
const PANIC_EVERY = 60;
const PANIC_TICKS = 40;

/** Enemies that answer the reaction protocol (enemy.ts), duck-typed to keep this file free of it. */
interface Reacting {
  react(kind: 'panic', ticks: number, source: Entity | null): boolean;
}

export class Vehicle extends Entity implements Mountable {
  art: string;
  readonly anim = new Animator();
  state: VehicleState = 'idle';
  driver: Player | null = null;
  /** Slot of the last driver (credited for ram / wreck kills). */
  lastDriver = -1;
  /** HP cells (halves allowed). */
  cells: number;
  maxCells: number;
  shells: number;
  maxShells: number = TUNING.vehicle.maxShells;
  speed: number;
  accel: number;
  jumpVelocity: number;
  /** Turret elevation relative to the facing (−π/2 = straight up). */
  aimElev = 0;
  /** Can turn around (some mechs cannot). */
  canTurn = true;
  bonus: number;
  /** HUD name (VehicleOpts.name). */
  hudName: string;
  readonly seat: Rect;
  readonly seatPoint: readonly [number, number];
  readonly gunPoint: readonly [number, number];
  readonly cannonPoint: readonly [number, number];
  readonly mainGun: Gun;
  readonly cannonGun: Gun;
  /** The special's weapon (null = `special()` is overridden or there is none). */
  readonly specialGun: Gun | null;
  readonly specialCost: number;
  readonly ramSpeed: number;
  readonly ramDistance: number;
  readonly ramDamage: number;
  readonly ramRadius: number;
  readonly wreckDamage: number;
  readonly wreckRadius: number;
  readonly ejectWindow: number;
  readonly pilotDiesWithVehicle: boolean;
  readonly iceFriction: boolean;
  readonly params: SpawnParams;
  /**
   * The HUD draws a marker at the top edge while this vehicle is ridden and `markerTop()` is above
   * the view (GDD §13.7: the Swan marker). Off by default.
   */
  offscreenMarker = false;
  protected ramT = 0;
  protected ramStartX = 0;
  protected wreckT = 0;
  protected doomT = 0;
  /** Tick of the last press of each combo button (GDD §4.1: same tick or `comboWindow` ticks apart). */
  protected readonly pressedAt: Record<ComboButton, number> = { fire: -1000, jump: -1000, bomb: -1000 };
  /** Despawn margin while parked (driven vehicles never despawn). */
  private readonly parkedMargin = 320;
  private readonly ids = new Map<string, string>();

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS, o: VehicleOpts) {
    super(world, x, y);
    const V = TUNING.vehicle;
    this.params = params;
    this.art = o.art;
    this.team = 'player';
    this.z = 35;
    this.despawnMargin = this.parkedMargin;
    const w = o.w ?? 36;
    const h = o.h ?? 28;
    this.body = new Body({ w, h });
    this.hitbox = { x: -w / 2, y: -h, w, h };
    this.maxCells = this.cells = paramNum(params, 'cells', o.cells ?? V.cells);
    this.shells = paramNum(params, 'shells', o.shells ?? V.shells);
    this.speed = o.speed ?? 1.6;
    this.accel = o.accel ?? 0.12;
    this.jumpVelocity = o.jump ?? -3.2;
    this.bonus = o.bonus ?? TUNING.score.vehicleBossBonus;
    this.hudName = o.name ?? '';
    this.seat = { ...o.seat };
    this.seatPoint = o.seatPoint ?? [o.seat.x + o.seat.w / 2, o.seat.y + o.seat.h];
    this.gunPoint = o.gunPoint ?? [w / 2, -h + 6];
    this.cannonPoint = o.cannonPoint ?? [w / 2, -h / 2];
    this.mainGun = new Gun(world, this, this.weaponOr(o.mainGun ?? 'vulcan', 'machine-gun'), 'player');
    this.cannonGun = new Gun(world, this, this.weaponOr(o.cannon ?? 'cannon', 'grenade'), 'player');
    this.specialGun = o.special && hasWeapon(o.special) ? new Gun(world, this, getWeapon(o.special), 'player') : null;
    this.specialCost = o.specialCost ?? 0;
    this.ramSpeed = o.ramSpeed ?? V.ramSpeed;
    this.ramDistance = o.ramDistance ?? V.ramDistance;
    this.ramDamage = o.ramDamage ?? V.ramDamage;
    this.ramRadius = o.ramRadius ?? V.ramRadius;
    this.wreckDamage = o.wreckDamage ?? V.wreckDamage;
    this.wreckRadius = o.wreckRadius ?? V.wreckRadius;
    this.ejectWindow = o.ejectWindow ?? V.ejectWindow;
    this.pilotDiesWithVehicle = o.pilotDiesWithVehicle ?? false;
    this.iceFriction = o.iceFriction ?? true;
    this.addTag('vehicle');
    if (hasSprite(this.spriteId('idle'))) this.anim.play(this.spriteId('idle'));
  }

  private weaponOr(id: string, fallback: string): WeaponDef {
    if (hasWeapon(id)) return getWeapon(id);
    if (hasWeapon(fallback)) return getWeapon(fallback);
    return fallback === 'grenade' ? BUILTIN_GRENADE : getWeapon(id);
  }

  spriteId(name: string): string {
    let id = this.ids.get(name);
    if (id === undefined) {
      id = `${this.art}/${name}`;
      this.ids.set(name, id);
    }
    return id;
  }

  // ------------------------------------------------------------------------------- mounting

  /** Seat box in world space (reused rect). */
  seatRect(): Rect {
    return rectAt(this.x, this.y, this.seat, this.facing < 0, seatRect);
  }

  canMount(p: Player): boolean {
    if (this.state !== 'idle' || !this.alive || p.state !== 'play' || p.status.noMount) return false;
    const seat = this.seatRect();
    // Falling onto the seat (feet inside the box) …
    footRect.x = p.x - 4;
    footRect.y = p.y - 4;
    footRect.w = 8;
    footRect.h = 5;
    if (p.vy > 0 && overlaps(footRect, seat)) return true;
    // … or touching it while pressing down.
    return p.pad.held('down') && overlaps(p.hitRect(), seat);
  }

  mount(p: Player): void {
    if (this.driver) return;
    this.driver = p;
    this.lastDriver = p.index;
    this.state = 'driven';
    this.despawnMargin = Infinity;
    this.mainGun.owner = p.index;
    this.cannonGun.owner = p.index;
    if (this.specialGun) this.specialGun.owner = p.index;
    this.mainGun.reset();
    this.cannonGun.reset();
    this.aimElev = 0;
    this.facing = p.facing;
    this.pressedAt.fire = this.pressedAt.jump = this.pressedAt.bomb = -1000;
    hudOf(this.world).clearBubble(this);
    p.enterVehicle(this);
    this.addTag('shootable');
    this.invulnTicks = Math.max(this.invulnTicks, TUNING.vehicle.mountInvulnTicks);
    this.syncDriver();
    this.world.audio.sfx('vehicle/mount');
    this.world.events.emit('vehicleMounted', { vehicle: this, player: p, slot: p.index });
  }

  /** Throw the driver out. 'ram' also sends the empty vehicle charging forward. */
  eject(mode: EjectMode = 'exit'): void {
    const p = this.driver;
    if (!p) return;
    const V = TUNING.vehicle;
    this.driver = null;
    this.despawnMargin = this.parkedMargin;
    this.removeTag('shootable');
    const sp = this.seatWorld(pt);
    const invuln = mode === 'ram' ? V.ramEjectInvulnTicks : mode === 'destroyed' || mode === 'forced' ? V.destroyedEjectInvulnTicks : V.ejectInvulnTicks;
    const vy = mode === 'ram' ? V.ramEjectVy : mode === 'forced' ? V.crushEjectVy : V.ejectVy;
    p.leaveVehicle({ x: sp[0], y: sp[1] - 2, vx: mode === 'ram' ? -this.facing * 0.8 : 0, vy, invuln });
    this.world.audio.sfx('vehicle/eject');
    this.world.events.emit('vehicleEjected', { vehicle: this, player: p, slot: p.index, mode });
    if (mode === 'ram') {
      this.state = 'ram';
      this.ramT = 0;
      this.ramStartX = this.x;
      this.world.audio.sfx('vehicle/ram');
    } else if (this.state === 'driven') this.state = 'idle';
  }

  /**
   * World position of the seat point: the frame's 'seat' point, else `seatPoint`. Cockpit
   * vehicles: the driver's feet; open-seat mounts: the rider's hip (they override it per pose).
   */
  protected seatWorld(out: [number, number]): [number, number] {
    const s = this.seatPoint;
    return this.point('seat', s[0], s[1], out);
  }

  /**
   * Keep the driver on the seat (called every tick while driven). Open-seat mounts override it:
   * their driver's anchor is the mount's own feet anchor (look.md §6.6).
   */
  protected syncDriver(): void {
    const p = this.driver;
    if (!p) return;
    const sp = this.seatWorld(pt);
    p.x = p.prevX = sp[0];
    p.y = p.prevY = sp[1];
    p.facing = this.facing;
    p.vx = this.vx;
    p.vy = this.vy;
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    switch (this.state) {
      case 'idle':
        this.vx = approach(this.vx, 0, this.accel * 2);
        this.physics();
        this.showRideHint();
        break;
      case 'driven':
        if (!this.driver || this.driver.state !== 'mounted') {
          this.driver = null;
          this.despawnMargin = this.parkedMargin;
          this.removeTag('shootable');
          this.state = 'idle';
          break;
        }
        this.control(this.driver.pad);
        if (this.state === 'driven') {
          this.physics();
          this.keepInView();
          if (this.checkHazards()) break;
          this.syncDriver();
          this.lowCellWarning();
        }
        break;
      case 'doomed':
        this.updateDoomed();
        break;
      case 'ram':
        this.updateRam();
        break;
      case 'wreck':
        this.updateWreck();
        break;
    }
    this.animate();
    this.anim.update();
  }

  protected physics(): void {
    moveBody(this, this.world.terrain, this.world);
  }

  /**
   * Where the tail of the `RIDE?` bubble points (world space): 8 px above the hatch (the top of the
   * seat zone) by default. Mounts with a drawn hatch point override it.
   */
  protected rideBubbleTip(out: [number, number]): [number, number] {
    const s = this.seatRect();
    out[0] = s.x + s.w / 2;
    out[1] = s.y - 8;
    return out;
  }

  /**
   * GDD §8.1: an empty vehicle shows the `RIDE?` hint bubble (always shown, even with SPEECH
   * BUBBLES OFF) while a player on foot is within 96 px. The vehicle is the speaker; a bubble it
   * already has (its own, or one a subclass keeps up itself) is left alone.
   */
  protected showRideHint(): void {
    if (this.state !== 'idle' || !this.alive) return;
    if ((this.world.tick + this.id) % RIDE_BUBBLE_EVERY !== 0) return;
    const players = this.world.players;
    let near = false;
    for (let i = 0; i < players.length && !near; i++) {
      const p = players[i] as Player;
      if (!p.alive || p.state !== 'play') continue;
      near = Math.abs(p.x - this.x) <= RIDE_BUBBLE_RANGE && Math.abs(p.y - this.y) <= RIDE_BUBBLE_RANGE;
    }
    if (!near) return;
    const hud = hudOf(this.world);
    for (let i = 0; i < hud.bubbles.length; i++) if (hud.bubbles[i].target === this && hud.bubbles[i].ticks > 2) return;
    // The HUD hangs the tail at (x, y + hitbox.y − dy): pick dy so the tail tip lands on rideBubbleTip.
    const tip = this.rideBubbleTip(tipPt);
    hud.bubble(this, 'RIDE?', { kind: 'hint', ticks: RIDE_BUBBLE_EVERY + 2, dy: this.y + this.hitbox.y - tip[1] });
  }

  /**
   * GDD §8.1 (opt-in; the Swan calls it every tick while ridden): Legion infantry within 64 px of a
   * moving player vehicle panic (30 % chance, checked once per 60 ticks per soldier, `world.rng`).
   */
  protected panicInfantry(): void {
    if (Math.abs(this.vx) < 0.1) return;
    const list = this.world.byTag('legion');
    if (list.length === 0) return;
    const t = this.world.tick;
    const cy = this.y + this.hitbox.y / 2;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== 'enemy' || (t + e.id) % PANIC_EVERY !== 0) continue;
      if (distToRect(this.x, cy, e.hitRect()) > PANIC_RANGE) continue;
      const r = e as Entity & Partial<Reacting>;
      if (typeof r.react === 'function' && this.world.rng.chance(PANIC_CHANCE)) r.react('panic', PANIC_TICKS, this);
    }
  }

  /** World y of the highest drawn point (vehicle and rider): the HUD's off-screen marker. */
  markerTop(): number {
    return this.y + this.hitbox.y;
  }

  /** At ≤ 1 cell a driven vehicle smokes and `vehicle/warning` beeps every 60 ticks (GDD §8.1). */
  protected lowCellWarning(): void {
    if (this.cells > 1) return;
    const t = this.world.tick;
    if (t % 6 === 0) smokeTrail(this.world, this.x - this.facing * 8, this.y + this.hitbox.y + 4, true);
    if (t % 60 === 0) this.world.audio.sfx('vehicle/warning');
  }

  /**
   * Terrain hazards destroy a driven vehicle at once (GDD §8.1): sinking into a `pit`, touching
   * `lava` or a `kill` zone. The pilot is thrown up (vy −6, invulnerable) instead of dying with
   * it. Water is left to the content vehicle (boats float, see water.ts). Returns true when the
   * vehicle was destroyed.
   */
  protected checkHazards(): boolean {
    const t = this.world.terrain;
    if (t.hazards.length === 0) return false;
    hazards.length = 0;
    t.hazardsAt(this.hitRect(hazRect), hazards);
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      if ((h.kind === 'pit' && this.y > h.y + 4) || h.kind === 'lava' || h.kind === 'kill') {
        this.destroy('forced');
        return true;
      }
    }
    return false;
  }

  /**
   * A driven vehicle stays inside the view: the edges are walls (pushX follows slopes and stops
   * at terrain), so it can never be left behind by the camera or despawn under its pilot.
   */
  protected keepInView(): void {
    const half = (this.body?.w ?? this.hitbox.w) / 2;
    const dx = this.world.camera.clampX(this.x, half) - this.x;
    if (dx === 0) return;
    if (this.body) pushX(this, dx, this.world.terrain, this.world);
    else this.x += dx;
    if (dx * this.vx < 0) this.vx = 0;
  }

  /** Did `b` go down within the combo window of `a` (one of them this tick)? */
  protected combo(a: ComboButton, b: ComboButton): boolean {
    const t = this.world.tick;
    const w = TUNING.vehicle.comboWindow;
    const ta = this.pressedAt[a];
    const tb = this.pressedAt[b];
    return (ta === t && t - tb <= w) || (tb === t && t - ta <= w);
  }

  /** Driver input: drive, hop, aim, fire, shells, eject / ram / special. Override for flyers, boats … */
  protected control(pad: VirtualPad): void {
    const tick = this.world.tick;
    const ax = pad.axisX();
    if (ax !== 0 && this.canTurn) this.facing = ax;
    const ice = this.iceFriction && this.body?.onGround && iceAt(this.world, this.x);
    const braking = ax === 0 || ax * this.vx < 0;
    this.vx = approach(this.vx, ax * this.speed, ice ? Math.min(this.accel, braking ? TUNING.player.iceDecel : TUNING.player.iceAccel) : this.accel);

    for (const b of COMBO_BUTTONS) if (pad.pressed(b)) this.pressedAt[b] = tick;
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

    // Turret: turns smoothly between forward and up.
    const target = pad.held('up') ? -HALF_PI : 0;
    this.aimElev = approach(this.aimElev, target, TUNING.vehicle.turretSpeed);

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

  /** fire + bomb: pay the shells and run the special (a sad click when it cannot). */
  protected trySpecial(): void {
    if (this.shells < this.specialCost || !this.special()) {
      this.world.audio.sfx('weapon/empty');
      return;
    }
    this.shells -= this.specialCost;
  }

  /**
   * The vehicle special (fire + bomb). Default: fire the `special` weapon when it is ready.
   * Override for HONK / JINGLE / CYMBAL WALL style effects; return false when it did nothing.
   */
  protected special(): boolean {
    const g = this.specialGun;
    if (!g || !g.ready) return false;
    g.press();
    if (!g.wants(false)) return false;
    const m = this.point('muzzle', this.gunPoint[0], this.gunPoint[1], pt);
    g.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, this.aimElev), aimDirOf(this.aimElev)));
    return true;
  }

  /** Fire the main gun along the turret angle. */
  protected fireMain(): void {
    const g = this.gunPoint;
    const m = this.point('muzzle', g[0], g[1], pt);
    this.mainGun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, this.aimElev), aimDirOf(this.aimElev)));
  }

  /** Fire the cannon straight ahead. */
  protected fireCannon(): void {
    const c = this.cannonPoint;
    const m = this.point('cannon', c[0], c[1], pt);
    this.cannonGun.fire(this.fireArgs(m[0], m[1], this.facing > 0 ? 0 : Math.PI, 'forward'));
  }

  /** Fill the shared trigger arguments. */
  protected fireArgs(x: number, y: number, angle: number, aim: AimDir): FireArgs {
    args.x = x;
    args.y = y;
    args.angle = angle;
    args.facing = this.facing;
    args.aim = aim;
    args.crouching = false;
    args.airborne = !this.body?.onGround;
    args.vx = this.vx;
    args.vy = this.vy;
    return args;
  }

  /** Charging after a ram eject: explodes on the first enemy, a wall, or at the end of the run. */
  protected updateRam(): void {
    this.vx = approach(this.vx, this.facing * this.ramSpeed, TUNING.vehicle.ramAccel);
    const c = moveBody(this, this.world.terrain, this.world);
    if (++this.ramT % 3 === 0) smokeTrail(this.world, this.x - this.facing * 12, this.y - 8, true);
    const box = this.hitRect();
    const list = this.world.byTag('shootable');
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t.alive || t.team !== 'enemy') continue;
      const boxes = t.hurtboxes();
      for (let k = 0; k < boxes.length; k++) {
        if (overlaps(box, boxes[k])) {
          this.explode(this.ramDamage, this.ramRadius);
          return;
        }
      }
    }
    const ran = Math.abs(this.x - this.ramStartX);
    if (c.hitWall || ran >= this.ramDistance || this.ramT >= TUNING.vehicle.ramTicks || !this.onScreen(64)) {
      this.explode(this.ramDamage, this.ramRadius);
    }
  }

  /**
   * 0 cells (GDD §8.1): the vehicle stops and flashes with the alarm for `ejectWindow` ticks.
   * The pilot may jump out (jump, or down + jump) until then; at the end it explodes — with a
   * pilot still inside he goes down with it (EASY: he is thrown out instead).
   */
  protected updateDoomed(): void {
    this.vx = approach(this.vx, 0, 0.1);
    this.physics();
    this.keepInView();
    if (this.driver) this.syncDriver();
    if (this.doomT % 20 === 0) this.world.audio.sfx('vehicle/alarm');
    if (this.doomT % 4 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-10, 10), this.y + this.hitbox.y + 4, true);
    if (this.driver?.pad.pressed('jump')) this.eject('destroyed');
    if (++this.doomT < this.ejectWindow) return;
    const p = this.driver;
    if (p) {
      if (difficultyOf(this.world).vehicleAutoEject) this.eject('destroyed');
      else {
        this.eject('forced');
        p.invulnTicks = 0;
        p.kill('explosion', { amount: 1e6, kind: 'explosion', dirX: this.facing });
      }
    }
    this.explode(this.wreckDamage, this.wreckRadius);
  }

  protected updateWreck(): void {
    this.vx = approach(this.vx, 0, 0.1);
    this.physics();
    if (this.wreckT % 4 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-10, 10), this.y + this.hitbox.y + 4, true);
    if (--this.wreckT <= 0) this.explode(this.wreckDamage, this.wreckRadius);
  }

  /** Blow up: a big explosion that hurts enemies (each once, no falloff), then gone. */
  explode(damage = this.wreckDamage, radius = this.wreckRadius): void {
    if (this.removed) return;
    if (this.driver) this.eject('forced');
    const cy = this.y + this.hitbox.y / 2;
    explosion(this.world, this.x, cy, 'l', { damage, radius, falloff: 0, team: 'player', owner: this.lastDriver, debris: 'metal' });
    this.dead = true;
    this.remove();
  }

  // ------------------------------------------------------------------------------- damage

  /**
   * Cells a hit costs (GDD §8.1): crush / hazards = all, big hits 1, small hits ½. Override for
   * special armour (the Swan ignores ground shockwaves while swimming …).
   */
  protected cellDamage(d: Damage): number {
    if (d.kind === 'crush' || damageHas(d, 'hazard')) return this.cells;
    if (damageHas(d, 'heavy') || damageHas(d, 'boss')) return 1;
    if (d.kind === 'explosion' || d.kind === 'laser' || d.kind === 'impact' || d.kind === 'fire') return 1;
    return 0.5;
  }

  /** Enemy hits cost cells, with invulnerability in between. */
  override onHit(d: Damage): boolean {
    if (this.state !== 'driven' || this.dead) return false;
    const lethal = d.kind === 'crush' || damageHas(d, 'hazard');
    if (this.invulnTicks > 0 && !lethal) return true;
    const cost = this.cellDamage(d);
    if (cost <= 0) return true;
    this.cells = Math.max(0, this.cells - cost);
    this.invulnTicks = TUNING.vehicle.hitInvulnTicks;
    this.flashTicks = 6;
    this.world.audio.sfx('vehicle/hit');
    if (this.cells <= 0) {
      if (lethal) this.destroy('forced');
      else this.cellsGone();
    } else if (this.cells <= 1 && this.driver) hudOf(this.world).message(this.driver.index, 'DANGER!', 90, 0xff5040ff);
    return true;
  }

  /** The last cell is gone (not by a crush): flyers take the pilot with them, others start the eject window. */
  protected cellsGone(): void {
    const p = this.driver;
    if (this.pilotDiesWithVehicle && p) {
      this.eject('forced');
      p.invulnTicks = 0;
      p.kill('explosion', { amount: 1e6, kind: 'explosion', dirX: this.facing });
      this.world.events.emit('vehicleDestroyed', { vehicle: this });
      this.explode(this.wreckDamage, this.wreckRadius);
      return;
    }
    this.state = 'doomed';
    this.doomT = 0;
    this.removeTag('shootable');
    if (p) hudOf(this.world).message(p.index, 'JUMP OUT!', this.ejectWindow, 0xff5040ff);
    this.world.events.emit('vehicleDestroyed', { vehicle: this });
  }

  /**
   * Destroyed at once (crush, pit, lava, kill zone, or a script): the pilot is thrown out and the
   * wreck explodes `wreckTicks` later.
   */
  destroy(mode: EjectMode = 'destroyed'): void {
    if (this.state === 'wreck') return;
    this.cells = 0;
    const wasDoomed = this.state === 'doomed';
    this.eject(mode);
    this.state = 'wreck';
    this.wreckT = TUNING.vehicle.wreckTicks;
    this.dead = true;
    this.removeTag('shootable');
    if (hasSprite(this.spriteId('wreck'))) this.anim.play(this.spriteId('wreck'));
    if (!wasDoomed) this.world.events.emit('vehicleDestroyed', { vehicle: this });
  }

  /** Seconds-to-boom style info for the HUD: ticks left in the eject window (0 when not doomed). */
  get doomLeft(): number {
    return this.state === 'doomed' ? Math.max(0, this.ejectWindow - this.doomT) : 0;
  }

  /** Repair HP cells (gas cans). */
  repair(cells = 1): void {
    this.cells = Math.min(this.maxCells, this.cells + cells);
  }

  addShells(n: number): void {
    this.shells = Math.min(this.maxShells, this.shells + n);
  }

  override onCrushed(): void {
    if (this.state === 'driven') this.world.damage(this, { amount: 1e6, kind: 'crush', dirX: 0 });
  }

  /** Fell out of the world: the driver goes with it. */
  override onOutOfWorld(): void {
    const p = this.driver;
    if (p) {
      this.eject('forced');
      p.kill('pit');
    }
    this.remove();
  }

  /** Safety net: never take a pilot out of the world with the vehicle. */
  override onRemove(): void {
    if (this.driver) this.eject('forced');
  }

  /** What the next section needs to rebuild this vehicle (MissionRunner carry-over). */
  toCarry(): VehicleCarry {
    return { id: this.type, cells: this.cells, shells: this.shells };
  }

  applyCarry(c: VehicleCarry): void {
    this.cells = Math.max(0.5, Math.min(this.maxCells, c.cells));
    this.shells = c.shells;
  }

  // ------------------------------------------------------------------------------- drawing

  /** World position of a frame point (mirrored), or the fallback offset. */
  point(name: string, fx: number, fy: number, out: [number, number]): [number, number] {
    const p = this.anim.id ? framePoint(getFrame(this.anim.id, this.anim.index), name, this.facing < 0, false, out) : undefined;
    if (p) {
      out[0] = this.x + p[0];
      out[1] = this.y + p[1];
    } else {
      out[0] = this.x + fx * this.facing;
      out[1] = this.y + fy;
    }
    return out;
  }

  /** Pick the body animation (override for turrets, legs …). */
  protected animate(): void {
    if (this.state === 'wreck') return;
    const moving = Math.abs(this.vx) > 0.1 && hasSprite(this.spriteId('move'));
    const id = this.spriteId(moving ? 'move' : 'idle');
    if (hasSprite(id)) this.anim.play(id);
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = (this.flashTicks > 0 || this.state === 'doomed') && this.world.tick % 2 === 0;
    if (this.anim.id) r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
    else r.sprite(this.spriteId('idle'), 0, x, y, drawOpts);
    if (this.driver) {
      const sp = this.seatWorld(pt);
      this.driver.drawSeated(r, sp[0], sp[1], this.facing < 0);
    }
    // Last armour cell: flash red.
    if (this.state === 'driven' && this.cells <= 1 && this.world.tick % 20 < 6 && this.anim.id) {
      tintOpts.flipX = this.facing < 0;
      r.sprite(this.anim.id, this.anim.index, x, y, tintOpts);
    }
  }
}

const COMBO_BUTTONS: readonly ComboButton[] = ['fire', 'jump', 'bomb'];

/** Narrow a Button to the combo buttons (for content that builds its own control()). */
export function isComboButton(b: Button): b is ComboButton {
  return b === 'fire' || b === 'jump' || b === 'bomb';
}
