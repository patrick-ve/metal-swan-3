/**
 * Weapon system (docs/ARCHITECTURE.md §6): the `WeaponDef` contract, the `FireContext` a weapon
 * fires with, the `Gun` trigger logic shared by players and vehicles, and helpers for weapon
 * definitions (`shootBullet`, `throwGrenade`, `meleeStrike`).
 *
 * Adding a weapon = one `defineWeapon({...})` call in a content module:
 * ```ts
 * defineWeapon({
 *   id: 'shotgun', name: 'SHOTGUN', letter: 'S', ammo: 30, ammoAgain: 10, pose: 'heavy',
 *   cooldown: 28, auto: false, maxShotsOnScreen: 1, sfx: 'weapon/shotgun', voice: 'Shotgun, ready!',
 *   fire(ctx) {
 *     for (let i = -2; i <= 2; i++)
 *       shootBullet(ctx, { speed: 6, damage: 40, sprite: 'weapon/pellet', spread: i * 0.12, life: 16, pierce: Infinity });
 *     muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', follow: ctx.shooter });
 *   },
 * });
 * ```
 * Angles are radians in screen space: 0 = right, +π/2 = down, −π/2 = up.
 *
 * More helpers for weapons that are not plain bullets: `throwStart` (a wall-safe release point),
 * `kickBack` (shotgun recoil), `mountOf` (follow the gun of a beam's shooter), `freeHostages`
 * (non-projectile attacks free hostages too), `weaponSfx` (a sound at the gun's pitch).
 */
import type { DamageKind, Entity, Team } from '../engine/entity';
import { distToRect, overlaps, type Rect } from '../engine/math';
import { pushX, sweep } from '../engine/physics';
import { makeRayHit } from '../engine/terrain';
import type { Circle, World } from '../engine/world';
import { sessionOf } from './context';
import { hitSpark, muzzleFlash, poof } from './fx';
import { Grenade, type GrenadeOpts } from './grenade';
import { Projectile, type ImpactFn, type ProjectileOpts, type ShotTracker, type Tracked } from './projectile';
import { setFallbackWeapon } from './registry';
import { TUNING } from './tuning';

export type WeaponPose = 'pistol' | 'heavy';
/** 'gun' = player main weapons, 'bomb' = the bomb button, 'melee' = the automatic knife. */
export type WeaponKind = 'gun' | 'bomb' | 'melee' | 'vehicle';
export type AimDir = 'forward' | 'up' | 'down';

export interface MeleeBox {
  /** Width in front of the body, height above the feet (crouching uses `crouchH`). */
  w: number;
  h: number;
  crouchH?: number;
  damage: number;
}

export interface WeaponDef {
  id: string;
  /** HUD and pickup name, e.g. 'MACHINE GUN'. */
  name: string;
  /** Crate letter. */
  letter?: string;
  /** Default 'gun'. */
  kind?: WeaponKind;
  /** Ammo per pickup (Infinity = unlimited). */
  ammo: number;
  /** Ammo added when the same weapon is picked up again (default `ammo`). */
  ammoAgain?: number;
  /** Ammo cap (default TUNING.weapons.maxAmmo). */
  maxAmmo?: number;
  /** Ammo used per shot (default 1). */
  ammoPerShot?: number;
  /** Player torso pose: 'pistol' or 'heavy' (selects the torso-<pose>-… sprites). */
  pose: WeaponPose;
  /** Ticks between shots. */
  cooldown: number;
  /** Cooldown while crouching (default `cooldown`). */
  crouchCooldown?: number;
  /** Keeps firing every `cooldown` ticks while fire is held. */
  auto: boolean;
  /** Tap weapons: repeat interval while held (default TUNING.fire.tapHoldRepeat; null = off). */
  holdRepeat?: number | null;
  /** Minimum shots per press (fired every `cooldown` ticks even after release). */
  burst?: number;
  /** While firing, the aim turns through the in-between angles (machine-gun sweep). */
  sweep?: boolean;
  /** Max live projectiles of this gun at once. */
  maxShotsOnScreen?: number;
  /** Shot sound (played by the Gun on every shot). */
  sfx?: string;
  /** Announcer line on pickup. */
  voice?: string;
  /** Announcer line when the same weapon is picked up again (default `MORE <NAME>!`, GDD §5). */
  voiceAgain?: string;
  /** HUD icon sprite (default 'ui/icon-<id>'). */
  icon?: string;
  /** Melee reach (kind 'melee'). */
  melee?: MeleeBox;
  /** Spawn the projectiles / effects of one shot. */
  fire(ctx: FireContext): void;
}

/** Everything a weapon needs to fire one shot. Reused by its Gun (do not keep it). */
export interface FireContext {
  readonly world: World;
  /** Player or vehicle firing. */
  shooter: Entity;
  /** Player slot credited for kills (-1 = nobody). */
  owner: number;
  team: Team;
  weapon: WeaponDef;
  /** Muzzle (or throwing hand / blade) position. */
  x: number;
  y: number;
  /** Aim angle, radians (0 = right, +π/2 = down). */
  angle: number;
  dirX: number;
  dirY: number;
  facing: 1 | -1;
  aim: AimDir;
  /** Shots fired since the trigger went down (0 for the first one). */
  shotIndex: number;
  crouching: boolean;
  airborne: boolean;
  /** Shooter velocity (thrown things inherit it). */
  vx: number;
  vy: number;
  /** The firing gun (projectiles spawned with the helpers are tracked by it). */
  gun: Gun;
}

/** World angle for an elevation relative to the facing (elev: −π/2 up … +π/2 down). */
export function aimAngle(facing: 1 | -1, elev: number): number {
  return facing > 0 ? elev : Math.PI - elev;
}

/** Nearest of forward / up / down for an elevation. */
export function aimDirOf(elev: number): AimDir {
  if (elev < -Math.PI / 4 - 1e-6) return 'up';
  if (elev > Math.PI / 4 + 1e-6) return 'down';
  return 'forward';
}

// ---------------------------------------------------------------------------------------------
// Gun: trigger logic
// ---------------------------------------------------------------------------------------------

export interface FireArgs {
  x: number;
  y: number;
  angle: number;
  facing: 1 | -1;
  aim?: AimDir;
  crouching?: boolean;
  airborne?: boolean;
  vx?: number;
  vy?: number;
}

const gunPitch = { pitch: 1 };

/**
 * One trigger: cooldowns, press buffering, bursts, hold-to-repeat, on-screen limits.
 * Each tick: `press()` on a fire press, `tick(busy)`, then `if (gun.wants(held)) gun.fire(...)`.
 */
export class Gun implements ShotTracker {
  def: WeaponDef;
  readonly world: World;
  /** Ticks until the next shot is allowed. */
  cooldown = 0;
  /** Extra lock (e.g. drawing the pistol after a weapon ran dry). */
  lock = 0;
  /** Buffered press (ticks left). */
  buffer = 0;
  burstLeft = 0;
  shotIndex = 0;
  /** Ticks since the last shot. */
  sinceShot = 1000;
  /** Live projectiles fired by this gun. */
  live = 0;
  /** Pitch of the shot sound (a player status may raise it). */
  pitch = 1;
  readonly ctx: FireContext;

  constructor(world: World, shooter: Entity, def: WeaponDef, team: Team = 'player', owner = -1) {
    this.world = world;
    this.def = def;
    this.ctx = {
      world,
      shooter,
      owner,
      team,
      weapon: def,
      x: 0,
      y: 0,
      angle: 0,
      dirX: 1,
      dirY: 0,
      facing: 1,
      aim: 'forward',
      shotIndex: 0,
      crouching: false,
      airborne: false,
      vx: 0,
      vy: 0,
      gun: this,
    };
  }

  /** Switch weapons (keeps the cooldown so swapping is no way to fire faster). */
  setWeapon(def: WeaponDef): void {
    if (def === this.def) return;
    this.def = def;
    this.ctx.weapon = def;
    this.burstLeft = 0;
  }

  set owner(v: number) {
    this.ctx.owner = v;
  }

  set team(v: Team) {
    this.ctx.team = v;
  }

  /** The fire button went down. */
  press(): void {
    this.buffer = TUNING.fire.bufferTicks;
    this.shotIndex = 0;
  }

  /** Count down; while `busy` (throwing, knifing) a buffered press waits instead of expiring. */
  tick(busy = false): void {
    if (this.cooldown > 0) this.cooldown--;
    if (this.lock > 0) this.lock--;
    if (this.buffer > 0 && !busy) this.buffer--;
    this.sinceShot++;
  }

  /** On-screen limit reached. */
  get limited(): boolean {
    const max = this.def.maxShotsOnScreen;
    return max !== undefined && this.live >= max;
  }

  get ready(): boolean {
    return this.cooldown <= 0 && this.lock <= 0 && !this.limited;
  }

  /**
   * Should a shot fire now? Consumes the buffered press / one burst round.
   * `held` = fire button held this tick.
   */
  wants(held: boolean): boolean {
    if (!this.ready) return false;
    if (this.buffer > 0) {
      this.buffer = 0;
      this.burstLeft = Math.max(0, (this.def.burst ?? 1) - 1);
      return true;
    }
    if (this.burstLeft > 0) {
      this.burstLeft--;
      return true;
    }
    if (!held) return false;
    if (this.def.auto) return true;
    const repeat = this.def.holdRepeat === undefined ? TUNING.fire.tapHoldRepeat : this.def.holdRepeat;
    return repeat !== null && this.sinceShot >= repeat;
  }

  /** A buffered press is waiting (used to decide knife vs. shot before `wants`). */
  get pending(): boolean {
    return this.buffer > 0;
  }

  /** Firing right now or about to (sweep weapons turn their aim while this is true). */
  active(held: boolean): boolean {
    return held || this.burstLeft > 0 || this.buffer > 0;
  }

  /** Fire one shot: fills the context, calls `def.fire`, plays `def.sfx`, starts the cooldown. */
  fire(a: FireArgs): void {
    const c = this.ctx;
    c.weapon = this.def;
    c.x = a.x;
    c.y = a.y;
    c.angle = a.angle;
    c.dirX = Math.cos(a.angle);
    c.dirY = Math.sin(a.angle);
    c.facing = a.facing;
    c.aim = a.aim ?? 'forward';
    c.crouching = a.crouching ?? false;
    c.airborne = a.airborne ?? false;
    c.vx = a.vx ?? 0;
    c.vy = a.vy ?? 0;
    c.shotIndex = this.shotIndex;
    try {
      this.def.fire(c);
    } catch (err) {
      this.world.reportError(`weapon "${this.def.id}".fire`, err);
    }
    if (this.def.sfx) {
      if (this.pitch === 1) this.world.audio.sfx(this.def.sfx);
      else {
        gunPitch.pitch = this.pitch;
        this.world.audio.sfx(this.def.sfx, gunPitch);
      }
    }
    if (this.lastRound()) emptyPuff(this.world, c);
    this.cooldown = c.crouching ? (this.def.crouchCooldown ?? this.def.cooldown) : this.def.cooldown;
    this.shotIndex++;
    this.sinceShot = 0;
  }

  /**
   * Is this shot the last round of a player's pickup weapon? (The player takes the ammo right
   * after the shot and switches back to the pistol; GDD §5: "a comic puff from the empty weapon".)
   */
  private lastRound(): boolean {
    const def = this.def;
    if (def.ammo === Infinity || (def.kind ?? 'gun') !== 'gun' || !this.ctx.shooter.hasTag('player')) return false;
    const slot = sessionOf(this.world).slot(this.ctx.owner);
    return slot !== null && slot.weapon === def.id && slot.ammo !== Infinity && slot.ammo - (def.ammoPerShot ?? 1) <= 0;
  }

  /** Count a projectile (or a stream, a beam …) toward the on-screen limit (the helpers do this). */
  track(p: Tracked): void {
    p.tracker = this;
    this.live++;
  }

  untrack(): void {
    if (this.live > 0) this.live--;
  }

  /** Forget bursts and buffered presses (death, mounting a vehicle …). */
  reset(): void {
    this.buffer = 0;
    this.burstLeft = 0;
    this.shotIndex = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers for weapon definitions
// ---------------------------------------------------------------------------------------------

export interface BulletOpts {
  speed: number;
  damage: number;
  sprite: string;
  kind?: DamageKind;
  life?: number;
  w?: number;
  h?: number;
  pierce?: number;
  gravity?: number;
  /** Sideways offset from the aim line (px), e.g. alternating ±1.5 for a machine gun. */
  offset?: number;
  /** Extra angle (radians) added to the aim. */
  spread?: number;
  impact?: 'spark' | 'none' | ImpactFn;
  onImpact?: ImpactFn;
  look?: 'angle' | 'anim';
  blend?: 'normal' | 'add';
  hitsPlatforms?: boolean;
  /** Track toward the on-screen limit (default true). */
  track?: boolean;
  /** Damage tags (engine `Damage.tags`, e.g. ['heavy']). The weapon id is added automatically. */
  tags?: readonly string[];
}

/** Reused for every shootBullet call (Projectile.init copies what it needs). */
const bulletOpts: ProjectileOpts = { team: 'player', x: 0, y: 0, vx: 0, vy: 0, damage: 0 };

/** Fire a straight projectile along the context's aim. Returns it. */
export function shootBullet(ctx: FireContext, o: BulletOpts): Projectile {
  const a = ctx.angle + (o.spread ?? 0);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const off = o.offset ?? 0;
  const b = bulletOpts;
  b.team = ctx.team;
  b.x = ctx.x - sa * off;
  b.y = ctx.y + ca * off;
  b.vx = ca * o.speed;
  b.vy = sa * o.speed;
  b.damage = o.damage;
  b.kind = o.kind;
  b.owner = ctx.owner;
  b.shooter = ctx.shooter;
  b.life = o.life ?? 90;
  b.w = o.w;
  b.h = o.h;
  b.pierce = o.pierce;
  b.gravity = o.gravity;
  b.sprite = o.sprite;
  b.impact = o.impact;
  b.onImpact = o.onImpact;
  b.look = o.look;
  b.blend = o.blend;
  b.hitsPlatforms = o.hitsPlatforms;
  b.type = ctx.weapon.id;
  b.weapon = ctx.weapon.id;
  b.tags = o.tags;
  const p = Projectile.spawn(ctx.world, b);
  b.shooter = null;
  b.onImpact = null;
  if (o.track !== false) ctx.gun.track(p);
  return p;
}

export interface ThrowOpts extends Partial<GrenadeOpts> {
  sprite: string;
  /** Direct-hit damage. */
  damage: number;
}

const throwHit = makeRayHit();

/** A wall-safe release point and the horizontal speed after a wall (see `throwStart`). */
export interface ThrowStart {
  x: number;
  y: number;
  vx: number;
}

const startScratch: ThrowStart = { x: 0, y: 0, vx: 0 };

/**
 * Where a thrown or launched object really starts: the hand / muzzle reaches past the body, so
 * an object released right next to a wall starts at the wall (and bounces back off it with half
 * its speed) instead of inside it. Returns a shared object (copy what you need).
 */
export function throwStart(ctx: FireContext, vx: number): ThrowStart {
  const out = startScratch;
  out.x = ctx.x;
  out.y = ctx.y;
  out.vx = vx;
  const s = ctx.shooter;
  const hit = sweep(ctx.world.terrain, s.x, ctx.y, ctx.x, ctx.y, false, ctx.world, throwHit);
  if (hit && hit.t > 0) {
    out.x = hit.x + hit.nx * 2;
    out.y = hit.y + hit.ny * 2;
    if (Math.abs(hit.nx) > 0.5 && vx * hit.nx < 0) out.vx = -vx * 0.5;
  } else if (hit) {
    // The hand height itself is inside terrain (a low ceiling): leave from inside the body.
    out.x = s.x;
    out.y = s.y - 8;
  }
  return out;
}

/**
 * Throw a bouncing explosive in an arc (bombs, GDD §6.1). Forward throws use (TUNING.grenade.vx,
 * vy) and add the thrower's speed; crouched throws are low and flat; aiming up lobs high, aiming
 * down in the air drops it. The direct hit is an 'explosion' hit unless `kind` says otherwise.
 * A throw from right next to a wall starts at the wall (and bounces back off it) instead of
 * inside it.
 */
export function throwGrenade(ctx: FireContext, o: ThrowOpts): Grenade {
  const g = TUNING.grenade;
  let vx: number;
  let vy: number;
  if (ctx.aim === 'up') {
    vx = ctx.facing * g.upVx;
    vy = g.upVy;
  } else if (ctx.aim === 'down' && ctx.airborne) {
    vx = ctx.vx * 0.5;
    vy = g.downVy;
  } else if (ctx.crouching) {
    vx = ctx.facing * g.crouchVx;
    vy = g.crouchVy;
  } else {
    vx = ctx.facing * g.vx;
    vy = g.vy;
  }
  vx += ctx.vx * g.inherit * (Math.sign(ctx.vx) === ctx.facing ? 1 : 0.5);
  const start = throwStart(ctx, o.vx ?? vx);
  const x = start.x;
  const y = start.y;
  vx = start.vx;
  const gr = Grenade.spawn(ctx.world, {
    gravity: g.gravity,
    w: 6,
    h: 6,
    type: ctx.weapon.id,
    kind: 'explosion',
    weapon: ctx.weapon.id,
    ...o,
    team: ctx.team,
    x,
    y,
    vx,
    vy: o.vy ?? vy,
    owner: ctx.owner,
    shooter: ctx.shooter,
  });
  ctx.gun.track(gr);
  return gr;
}

const meleeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** The melee box of an entity facing `facing` with its feet at (x, y) and body width `bodyW`. */
export function meleeBox(x: number, y: number, facing: 1 | -1, bodyW: number, box: MeleeBox, crouching = false, out: Rect = meleeRect): Rect {
  const h = crouching ? (box.crouchH ?? box.h) : box.h;
  const front = x + (facing * bodyW) / 2 - facing * TUNING.knife.overlap;
  out.x = facing > 0 ? front : front - box.w;
  out.y = y - h;
  out.w = box.w;
  out.h = h;
  return out;
}

/**
 * Entities tagged 'soft' whose parts are not all knifeable (bosses with armour) implement this:
 * only parts that answer true trigger and take the knife. Duck-typed.
 */
interface KnifeFilter {
  isKnifeable?(part: number): boolean;
}

/** May the knife hit this part of a soft target? (true unless the target says otherwise) */
function knifeablePart(t: Entity, part: number): boolean {
  const f = (t as Entity & KnifeFilter).isKnifeable;
  return typeof f !== 'function' || f.call(t, part);
}

/** Soft hostile shootables (and hostages) overlapping a rect? (knife trigger test) */
export function meleeTargetIn(world: World, rect: Rect, team: Team): boolean {
  const list = world.byTag('soft');
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t.alive || !t.hasTag('shootable') || t.team === team || t.team === 'neutral') continue;
    const boxes = t.hurtboxes();
    for (let k = 0; k < boxes.length; k++) if (overlaps(rect, boxes[k]) && knifeablePart(t, k)) return true;
  }
  return false;
}

/** Entities that a melee strike frees (hostages): duck-typed. */
interface MeleeListener {
  onMelee?(owner: number): void;
}

/**
 * Hit every soft hostile shootable in `rect` once with `damage` ('knife' by default); hostages
 * in the box are freed. Returns the number of entities hit.
 */
export function meleeStrike(ctx: FireContext, rect: Rect, damage: number, kind: DamageKind = 'knife'): number {
  const world = ctx.world;
  // A copy: a hit may change tags (a broken drum stops being 'soft').
  const list = world.snapshotTag('soft');
  let hits = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t.alive || !t.hasTag('shootable') || t.team === ctx.team || t.team === 'neutral') continue;
      const boxes = t.hurtboxes();
      for (let k = 0; k < boxes.length; k++) {
        if (!overlaps(rect, boxes[k]) || !knifeablePart(t, k)) continue;
        world.damage(t, { amount: damage, kind, dirX: ctx.facing, source: ctx.shooter, owner: ctx.owner, weapon: ctx.weapon.id }, k);
        const b = boxes[k];
        hitSpark(world, b.x + b.w / 2, Math.max(b.y + 4, rect.y + rect.h / 2), ctx.facing);
        hits++;
        break;
      }
    }
  } finally {
    world.releaseSnapshot();
  }
  if (ctx.team === 'player') {
    const hostages = world.byTag('hostage');
    for (let i = 0; i < hostages.length; i++) {
      const h = hostages[i] as Entity & MeleeListener;
      if (h.alive && h.onMelee && overlaps(rect, h.hitRect())) h.onMelee(ctx.owner);
    }
  }
  return hits;
}

/** The melee box of the entity firing a melee weapon (uses its body width and the def's box). */
export function meleeBoxFor(ctx: FireContext, box: MeleeBox): Rect {
  const s = ctx.shooter;
  return meleeBox(s.x, s.y, ctx.facing, s.body?.w ?? 14, box, ctx.crouching);
}

// ---------------------------------------------------------------------------------------------
// Helpers for streams, beams and cones (weapons that are not plain projectiles)
// ---------------------------------------------------------------------------------------------

/**
 * A shooter whose gun can be followed while a stream or beam lasts (the Player: its current
 * muzzle point and aim angle, including the in-between angles of an aim sweep). Duck-typed.
 */
export interface GunMount {
  muzzleWorld(out: [number, number]): [number, number];
  readonly aimAngle: number;
  /** 'play' while the shooter controls its gun (players); anything else ends a stream. */
  readonly state?: string;
}

/** The shooter as a GunMount, or null (vehicles and scripted spawns keep their first aim). */
export function mountOf(e: Entity | null | undefined): GunMount | null {
  if (!e) return null;
  const m = e as Entity & Partial<GunMount>;
  return typeof m.muzzleWorld === 'function' && typeof m.aimAngle === 'number' ? (m as Entity & GunMount) : null;
}

/** Is the shooter still holding the gun (alive, in the world, a player in 'play')? */
export function shooterReady(e: Entity | null | undefined): boolean {
  if (!e || !e.alive || e.removed) return false;
  const st = (e as Entity & Partial<GunMount>).state;
  return st === undefined || st === 'play';
}

/**
 * Recoil: push the shooter `dx` px sideways like a step (follows slopes, stops at walls).
 * Bodiless shooters (and players in vehicles) are not moved.
 */
export function kickBack(shooter: Entity, dx: number): void {
  if (!shooter.body || dx === 0 || !shooterReady(shooter)) return;
  pushX(shooter, dx, shooter.world.terrain, shooter.world);
}

/** Entities freed by any player attack (hostages): duck-typed like `blast` / `meleeStrike`. */
interface FreeListener {
  onBlast?(x: number, y: number, r: number, owner: number): void;
}

/**
 * A player attack that is not a projectile or an explosion (a flame stream, a beam, a shotgun
 * cone) frees the hostages it touches. `hit(box)` says whether the attack covers a hostage box.
 */
export function freeHostages(world: World, owner: number, hit: (box: Rect) => boolean): void {
  const list = world.byTag('hostage');
  for (let i = 0; i < list.length; i++) {
    const h = list[i] as Entity & FreeListener;
    if (!h.alive || !h.onBlast) continue;
    const box = h.hitRect();
    if (hit(box)) h.onBlast(box.x + box.w / 2, box.y + box.h / 2, 0, owner);
  }
}

/** Does a circle touch a rect? (shared test for streams). */
export function circleHits(c: Circle, box: Rect): boolean {
  return distToRect(c.x, c.y, box) <= c.r;
}

const sfxPitch = { pitch: 1 };

/** Play a weapon sound at the firing gun's pitch (Helium Head raises it). */
export function weaponSfx(ctx: FireContext, id: string): void {
  const p = ctx.gun.pitch;
  if (p === 1) ctx.world.audio.sfx(id);
  else {
    sfxPitch.pitch = p;
    ctx.world.audio.sfx(id, sfxPitch);
  }
}

/** The last round left the gun: a comic puff of smoke from the empty muzzle (GDD §5). */
function emptyPuff(world: World, ctx: FireContext): void {
  poof(world, ctx.x + ctx.dirX * 4, ctx.y + ctx.dirY * 4);
}

// ---------------------------------------------------------------------------------------------
// Built-in fallbacks (used only while the content weapons are not registered)
// ---------------------------------------------------------------------------------------------

const K = TUNING.knife;

/** The automatic knife (content registers the real 'knife'; this keeps melee working without it). */
export const BUILTIN_KNIFE: WeaponDef = {
  id: 'knife',
  name: 'KNIFE',
  kind: 'melee',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: K.cooldown,
  auto: false,
  melee: { w: K.w, h: K.h, crouchH: K.crouchH, damage: K.damage },
  fire(ctx) {
    meleeStrike(ctx, meleeBoxFor(ctx, this.melee as MeleeBox), K.damage);
  },
};

/** The standard grenade (fallback for the bomb button). */
export const BUILTIN_GRENADE: WeaponDef = {
  id: 'grenade',
  name: 'GRENADE',
  kind: 'bomb',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: TUNING.grenade.cooldown,
  auto: false,
  holdRepeat: null,
  maxShotsOnScreen: TUNING.grenade.inAir,
  fire(ctx) {
    const g = TUNING.grenade;
    throwGrenade(ctx, { sprite: 'weapon/grenade', damage: g.direct, blastDamage: g.splash, blastRadius: g.radius, blastFalloff: g.falloff });
  },
};

const FALLBACK_GUN: WeaponDef = {
  id: 'pistol',
  name: 'PISTOL',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: TUNING.weapons.pistol.cooldown,
  auto: false,
  fire(ctx) {
    const p = TUNING.weapons.pistol;
    shootBullet(ctx, { speed: p.speed, damage: p.damage, sprite: 'weapon/bullet', life: p.life });
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { follow: ctx.shooter });
  },
};
setFallbackWeapon(FALLBACK_GUN);
