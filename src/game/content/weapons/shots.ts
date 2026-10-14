/**
 * The player weapons' shots that are more than a straight bullet (GDD §5). All pooled.
 *
 * | class | weapon | what it is |
 * |---|---|---|
 * | `ShotgunBlast` | shotgun | an instant cone of damage (72 px, 16 → 40 px tall, 6 ticks, each target once) |
 * | `Rocket` | rocket-launcher | accelerates 2 → 7, steers sideways ≤ 1 px/tick toward the nearest enemy ahead, explodes |
 * | `FlameStream` | flamethrower | a 96 px stream that follows the gun for 24 ticks (runs along the floor when fired down) |
 * | `LaserBeam` | laser | one beam per gun, refreshed by every shot; to the first solid or 384 px; lingers |
 * | `HomingMissile` | homing | locks the nearest enemy within 220 px in front, turns 4°/tick, lives 120 ticks |
 * | `TubaRing` | tuba | a growing sonic ring: hits each enemy once, erases enemy shots, pushes light enemies |
 * | `MineDisc` | bounce-mine | a disc that bounces along the floor, hops narrow gaps and steps, blows up |
 *
 * The weapon definitions (content/weapons/index.ts) spawn them; the entity ids of GDD §15.2
 * (`rocket`, `tuba-ring` …) spawn them for scripts. Streams and beams follow the shooter's gun
 * through `mountOf` (the Player's muzzle point and aim angle, sweep included).
 */
import { Entity, hostile, type Damage, type Team } from '../../../engine/entity';
import { approach, clamp, distToRect, rotateToward, segmentRectT, type Rect } from '../../../engine/math';
import { PAL } from '../../../engine/palette';
import { pushX, sweep } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { hasSprite } from '../../../engine/sprites';
import { makeRayHit, type RayHit } from '../../../engine/terrain';
import type { World } from '../../../engine/world';
import { explosion, FX_EMBER, FX_FLAME, FX_PELLET, FX_SMOKE, FX_SPARK, FX_TRAIL, hitSpark, musicNotes, poof } from '../../fx';
import { Grenade, type GrenadeOpts } from '../../grenade';
import { acquire, release } from '../../pool';
import { eraseEnemyShots, Projectile, type ProjectileOpts, type ShotTracker, type Tracked } from '../../projectile';
import { freeHostages, mountOf, shooterReady, throwStart, type FireContext, type Gun } from '../../weapons';
import { FLAME, HOMING, LASER, MINE, ROCKET, SHOTGUN, TUBA } from './stats';

const SPREAD: readonly string[] = ['spread'];
const SONIC: readonly string[] = ['sonic'];
const HALF_PI = Math.PI / 2;
const rayHit = makeRayHit();
const pt: [number, number] = [0, 0];

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

/** The aim point found by `nearestAhead` (one hurtbox centre of an enemy). */
interface AimPoint {
  e: Entity | null;
  part: number;
  x: number;
  y: number;
}

const aimPt: AimPoint = { e: null, part: -1, x: 0, y: 0 };

/** A living enemy a guided shot may chase ('enemy'-tagged, not a projectile, hostile). */
function chaseable(team: Team, t: Entity): boolean {
  return t.alive && !t.removed && hostile(team, t.team) && !t.hasTag('shot');
}

/**
 * The nearest enemy hurtbox centre in front of (x, y) along (dirX, dirY) within `range`, on
 * screen (16 px margin: guided shots never chase what the player cannot see). Fills `aimPt`.
 */
function nearestAhead(world: World, team: Team, x: number, y: number, dirX: number, dirY: number, range: number): AimPoint | null {
  const list = world.byTag('enemy');
  let best = range * range;
  aimPt.e = null;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!chaseable(team, t)) continue;
    const boxes = t.hurtboxes();
    for (let k = 0; k < boxes.length; k++) {
      const b = boxes[k];
      if (b.w <= 0 || b.h <= 0 || !world.camera.inView(b, 16)) continue;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dirX + dy * dirY <= 2) continue; // behind or beside: never turn around
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        aimPt.e = t;
        aimPt.part = k;
        aimPt.x = cx;
        aimPt.y = cy;
      }
    }
  }
  return aimPt.e ? aimPt : null;
}

/** Solid at a point: terrain or an enabled blocking dynamic solid (crates, hulls, barricades). */
function solidAt(world: World, x: number, y: number): boolean {
  if (world.terrain.isSolid(x, y)) return true;
  const list = world.solids;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.enabled && !b.oneWay && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return true;
  }
  return false;
}

/** Reused spawn options (init copies what it needs). */
const shotOpts: ProjectileOpts = { team: 'player', x: 0, y: 0, vx: 0, vy: 0, damage: 0 };

/** Fill the shared projectile options for a player shot from `ctx` along `angle` at `speed`. */
function fromCtx(ctx: FireContext, angle: number, speed: number, damage: number): ProjectileOpts {
  const o = shotOpts;
  o.team = ctx.team;
  o.x = ctx.x;
  o.y = ctx.y;
  o.vx = Math.cos(angle) * speed;
  o.vy = Math.sin(angle) * speed;
  o.damage = damage;
  o.owner = ctx.owner;
  o.shooter = ctx.shooter;
  o.weapon = ctx.weapon.id;
  o.type = ctx.weapon.id;
  return o;
}

// ---------------------------------------------------------------------------------------------
// Shotgun: an instant cone
// ---------------------------------------------------------------------------------------------

/**
 * Does a convex quad (x0,y0 … x3,y3 in `q`) overlap a rect? Separating-axis test (the rect's
 * two axes, then the quad's four edge normals).
 */
export function quadHitsRect(q: Float64Array, b: Rect): boolean {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 8; i += 2) {
    if (q[i] < minX) minX = q[i];
    if (q[i] > maxX) maxX = q[i];
    if (q[i + 1] < minY) minY = q[i + 1];
    if (q[i + 1] > maxY) maxY = q[i + 1];
  }
  if (maxX <= b.x || minX >= b.x + b.w || maxY <= b.y || minY >= b.y + b.h) return false;
  for (let i = 0; i < 8; i += 2) {
    const j = (i + 2) % 8;
    const nx = -(q[j + 1] - q[i + 1]);
    const ny = q[j] - q[i];
    let qMin = Infinity;
    let qMax = -Infinity;
    for (let k = 0; k < 8; k += 2) {
      const p = q[k] * nx + q[k + 1] * ny;
      if (p < qMin) qMin = p;
      if (p > qMax) qMax = p;
    }
    const r0 = b.x * nx + b.y * ny;
    const r1 = (b.x + b.w) * nx + b.y * ny;
    const r2 = b.x * nx + (b.y + b.h) * ny;
    const r3 = (b.x + b.w) * nx + (b.y + b.h) * ny;
    const rMin = Math.min(r0, r1, r2, r3);
    const rMax = Math.max(r0, r1, r2, r3);
    if (rMax <= qMin || rMin >= qMax) return false;
  }
  return true;
}

export interface BlastOpts {
  team: Team;
  owner?: number;
  x: number;
  y: number;
  /** Aim angle (radians). */
  angle: number;
  shooter?: Entity | null;
  damage?: number;
  weapon?: string;
}

/**
 * The shotgun blast (GDD §5): a damage area 72 px long, 16 px tall at the muzzle and 40 px at
 * the tip, active 6 ticks (the fire tick and the next 5), each target hit once. The cone stops
 * at walls. It draws nothing: the pellets, the flash and the smoke are cosmetic particles.
 */
export class ShotgunBlast extends Entity implements Tracked {
  tracker: ShotTracker | null = null;
  readonly damage: Damage = { amount: SHOTGUN.damage, kind: 'bullet', dirX: 1, tags: SPREAD, weapon: 'shotgun' };
  /** The cone corners (muzzle top, muzzle bottom, tip bottom, tip top). */
  readonly quad = new Float64Array(8);
  /** Cone length after clipping at walls. */
  len: number = SHOTGUN.length;
  t = 0;
  private readonly hitList: Entity[] = [];
  private readonly hostageHit = (box: Rect): boolean => quadHitsRect(this.quad, box);

  constructor(world: World) {
    super(world);
    this.z = 50;
    this.hitbox = { x: -4, y: -4, w: 8, h: 8 };
    this.despawnMargin = Infinity;
  }

  static spawn(world: World, o: BlastOpts): ShotgunBlast {
    const b = acquire(world, ShotgunBlast);
    b.init(o);
    world.add(b);
    b.strike();
    return b;
  }

  init(o: BlastOpts): void {
    this.type = o.weapon ?? 'shotgun';
    this.team = o.team;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.t = 0;
    this.hitList.length = 0;
    this.tracker = null;
    const d = this.damage;
    d.amount = o.damage ?? SHOTGUN.damage;
    d.owner = o.owner;
    d.weapon = o.weapon ?? 'shotgun';
    d.source = o.shooter ?? this;
    const dx = Math.cos(o.angle);
    const dy = Math.sin(o.angle);
    d.dirX = Math.abs(dx) > 0.3 ? Math.sign(dx) : 0;
    this.facing = dx < 0 ? -1 : 1;
    // Clip the cone where its centre line meets a wall.
    const L = SHOTGUN.length;
    const h = sweep(this.world.terrain, o.x, o.y, o.x + dx * L, o.y + dy * L, false, this.world, rayHit);
    this.len = h ? Math.max(4, h.t * L) : L;
    const near = SHOTGUN.nearH / 2;
    const far = near + ((SHOTGUN.farH - SHOTGUN.nearH) / 2) * (this.len / L);
    const nx = -dy;
    const ny = dx;
    const tx = o.x + dx * this.len;
    const ty = o.y + dy * this.len;
    const q = this.quad;
    q[0] = o.x - nx * near;
    q[1] = o.y - ny * near;
    q[2] = o.x + nx * near;
    q[3] = o.y + ny * near;
    q[4] = tx + nx * far;
    q[5] = ty + ny * far;
    q[6] = tx - nx * far;
    q[7] = ty - ny * far;
  }

  override update(): void {
    if (++this.t < SHOTGUN.activeTicks) this.strike();
    else this.remove();
  }

  /** Hit every hostile in the cone that was not hit yet; free hostages in it. */
  strike(): void {
    const world = this.world;
    const list = world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || !hostile(this.team, t.team) || this.hitList.includes(t)) continue;
        const boxes = t.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          if (!quadHitsRect(this.quad, boxes[k])) continue;
          this.hitList.push(t);
          world.damage(t, this.damage, k);
          const b = boxes[k];
          hitSpark(world, b.x + b.w / 2, Math.max(b.y + 3, Math.min(b.y + b.h - 3, this.y)), this.damage.dirX || this.facing);
          break;
        }
      }
    } finally {
      world.releaseSnapshot();
    }
    if (this.team === 'player') freeHostages(world, this.damage.owner ?? -1, this.hostageHit);
  }

  /** The blast reads for 3 ticks: hot streaks fan across the cone and shrink toward its tip. */
  override draw(r: Renderer): void {
    if (this.t > 2) return;
    const q = this.quad;
    // Muzzle centre and the two tip corners; streaks run from 25 % (later: 55 %) to the tip.
    const mx = (q[0] + q[2]) / 2;
    const my = (q[1] + q[3]) / 2;
    const from = 0.25 + this.t * 0.15;
    blastDraw.alpha = 0.9 - this.t * 0.25;
    for (let i = 0; i < 5; i++) {
      const s = i / 4;
      const tx = q[6] + (q[4] - q[6]) * s;
      const ty = q[7] + (q[5] - q[7]) * s;
      const x0 = mx + (tx - mx) * from;
      const y0 = my + (ty - my) * from;
      const x1 = mx + (tx - mx) * (from + 0.3);
      const y1 = my + (ty - my) * (from + 0.3);
      r.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), i === 2 ? PAL.snow[3] : PAL.fire[5], blastDraw);
    }
  }

  override onRemove(): void {
    this.tracker?.untrack(this);
    this.tracker = null;
    this.damage.source = undefined;
    release(this);
  }
}

const blastDraw: DrawOpts = { blend: 'add', alpha: 1 };

/** Fire the shotgun from a context: the cone, the pellets and the smoke. */
export function fireShotgun(ctx: FireContext): ShotgunBlast {
  const b = ShotgunBlast.spawn(ctx.world, {
    team: ctx.team,
    owner: ctx.owner,
    x: ctx.x,
    y: ctx.y,
    angle: ctx.angle,
    shooter: ctx.shooter,
    weapon: ctx.weapon.id,
  });
  ctx.gun.track(b);
  // Cosmetic pellets fan out across the cone and fade (6 px/tick); a puff of smoke.
  const p = ctx.world.particles;
  const half = Math.atan2((SHOTGUN.farH - SHOTGUN.nearH) / 2, SHOTGUN.length) + 0.05;
  const n = SHOTGUN.pellets;
  for (let i = 0; i < n; i++) {
    const a = ctx.angle + (i / (n - 1) - 0.5) * 2 * half;
    const off = (i / (n - 1) - 0.5) * (SHOTGUN.nearH - 4);
    const v = SHOTGUN.pelletSpeed * (0.9 + (i % 3) * 0.06);
    p.emit(FX_PELLET, ctx.x - ctx.dirY * off, ctx.y + ctx.dirX * off, Math.cos(a) * v, Math.sin(a) * v);
  }
  p.burst(FX_SMOKE, ctx.x + ctx.dirX * 6, ctx.y + ctx.dirY * 6, 3, 0.3, 0.9, ctx.angle, 0.8);
  ctx.world.camera.shake(1, 4);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Rocket launcher
// ---------------------------------------------------------------------------------------------

/**
 * The rocket (GDD §5): starts at 2 px/tick and accelerates +0.3/tick to 7. It steers only
 * sideways to its launch direction (≤ 1 px/tick) toward the nearest enemy ahead, so it follows
 * a target onto another platform level but can never turn around. Explodes on any hit, on
 * terrain and at the end of its life: 30 to the target hit + 50 to everything within r 16
 * (the target hit takes both). Smoke trail.
 */
export class Rocket extends Projectile {
  /** Launch direction (unit). */
  ux = 1;
  uy = 0;
  speed: number = ROCKET.speed;
  /** Sideways speed (px/tick, toward the right-hand normal of the launch direction). */
  side = 0;
  blast: number = ROCKET.blast;
  radius: number = ROCKET.radius;
  private exploded = false;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init({ ...o, look: 'angle', impact: 'none', kind: 'explosion', w: 6, h: 6, life: o.life ?? ROCKET.life, hitsPlatforms: true, offscreen: 32 });
    const v = Math.hypot(o.vx, o.vy);
    this.ux = v > 0 ? o.vx / v : 1;
    this.uy = v > 0 ? o.vy / v : 0;
    this.speed = v > 0 ? v : ROCKET.speed;
    this.side = 0;
    this.blast = ROCKET.blast;
    this.radius = ROCKET.radius;
    this.exploded = false;
  }

  override update(): void {
    this.speed = Math.min(ROCKET.maxSpeed, this.speed + ROCKET.accel);
    const nx = -this.uy;
    const ny = this.ux;
    let want = 0;
    const aim = nearestAhead(this.world, this.team, this.x, this.y, this.ux, this.uy, 400);
    if (aim) want = clamp(((aim.x - this.x) * nx + (aim.y - this.y) * ny) * ROCKET.steerGain, -ROCKET.steer, ROCKET.steer);
    this.side = approach(this.side, want, ROCKET.steerAccel);
    this.vx = this.ux * this.speed + nx * this.side;
    this.vy = this.uy * this.speed + ny * this.side;
    // Exhaust: a flicker of flame at the tail every tick, a smoke puff every other tick.
    const p = this.world.particles;
    p.emit(FX_FLAME, this.x - this.ux * 7, this.y - this.uy * 7, -this.ux * 0.6, -this.uy * 0.6);
    if ((this.t & 1) === 0) p.emit(FX_TRAIL, this.x - this.ux * 9, this.y - this.uy * 9, -this.ux * 0.2, -this.uy * 0.2 - 0.1);
    super.update();
  }

  override onImpact(_target: Entity | null, x: number, y: number): void {
    this.explodeAt(x, y);
  }

  override expire(): void {
    this.explodeAt(this.x, this.y);
    this.remove();
  }

  private explodeAt(x: number, y: number): void {
    if (this.exploded) return;
    this.exploded = true;
    explosion(this.world, x, y, 'm', {
      damage: this.blast,
      radius: this.radius,
      falloff: 0,
      team: this.team,
      owner: this.damage.owner,
      weapon: this.damage.weapon,
    });
  }
}

/** Fire one rocket from a context (with a back-blast puff behind the launcher). */
export function fireRocket(ctx: FireContext): Rocket {
  const o = fromCtx(ctx, ctx.angle, ROCKET.speed, ROCKET.hit);
  o.sprite = 'weapon/rocket';
  const r = Rocket.spawn(ctx.world, o);
  o.shooter = null;
  ctx.gun.track(r);
  ctx.world.particles.burst(FX_SMOKE, ctx.x - ctx.dirX * 18, ctx.y - ctx.dirY * 18, 3, 0.3, 1, ctx.angle + Math.PI, 0.9);
  return r;
}

// ---------------------------------------------------------------------------------------------
// Homing missiles
// ---------------------------------------------------------------------------------------------

/**
 * A homing missile (GDD §5): locks the nearest enemy hurtbox within 220 px in front, turns
 * 4°/tick toward it, flies straight without a target (it looks for a new one now and then),
 * lives 120 ticks. 30 to the target hit + 10 within r 8; it pops at the end of its life.
 */
export class HomingMissile extends Projectile {
  heading = 0;
  speed: number = HOMING.speed;
  target: Entity | null = null;
  part = 0;
  private exploded = false;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init({ ...o, look: 'angle', impact: 'none', kind: 'explosion', w: 4, h: 4, life: o.life ?? HOMING.life, hitsPlatforms: true, offscreen: 48 });
    this.heading = Math.atan2(o.vy, o.vx);
    this.speed = Math.hypot(o.vx, o.vy) || HOMING.speed;
    this.exploded = false;
    this.target = null;
    this.lock();
  }

  /** Lock the nearest enemy hurtbox within 220 px in front of the current heading. */
  lock(): boolean {
    const a = nearestAhead(this.world, this.team, this.x, this.y, Math.cos(this.heading), Math.sin(this.heading), HOMING.lockRange);
    this.target = a ? a.e : null;
    this.part = a ? a.part : 0;
    return a !== null;
  }

  override update(): void {
    const t = this.target;
    if (t && (!t.alive || t.removed)) this.target = null;
    if (!this.target && this.t % 8 === 4) this.lock();
    if (this.target) {
      const boxes = this.target.hurtboxes();
      const b = boxes[Math.min(this.part, boxes.length - 1)];
      if (b && b.w > 0) {
        const want = Math.atan2(b.y + b.h / 2 - this.y, b.x + b.w / 2 - this.x);
        this.heading = rotateToward(this.heading, want, HOMING.turn);
      }
    }
    this.vx = Math.cos(this.heading) * this.speed;
    this.vy = Math.sin(this.heading) * this.speed;
    const cx = Math.cos(this.heading);
    const cy = Math.sin(this.heading);
    if (this.t % 3 === 0) this.world.particles.emit(FX_TRAIL, this.x - cx * 6, this.y - cy * 6, 0, -0.1);
    if ((this.t & 1) === 0) this.world.particles.emit(FX_SPARK, this.x - cx * 5, this.y - cy * 5, -cx * 0.5, -cy * 0.5);
    super.update();
  }

  override onImpact(_target: Entity | null, x: number, y: number): void {
    this.explodeAt(x, y);
  }

  override expire(): void {
    this.explodeAt(this.x, this.y);
    this.remove();
  }

  override onRemove(): void {
    this.target = null;
    super.onRemove();
  }

  private explodeAt(x: number, y: number): void {
    if (this.exploded) return;
    this.exploded = true;
    explosion(this.world, x, y, 's', {
      damage: HOMING.blast,
      radius: HOMING.radius,
      falloff: 0,
      team: this.team,
      owner: this.damage.owner,
      weapon: this.damage.weapon,
      debris: null,
    });
  }
}

/** Fire one press of homing missiles: 2 missiles, 15° up and 15° down from the aim. */
export function fireHoming(ctx: FireContext): void {
  for (let i = 0; i < HOMING.perPress; i++) {
    const a = ctx.angle + (i === 0 ? -HOMING.spread : HOMING.spread);
    const o = fromCtx(ctx, a, HOMING.speed, HOMING.hit);
    o.sprite = 'weapon/homing';
    const m = HomingMissile.spawn(ctx.world, o);
    ctx.gun.track(m);
  }
  shotOpts.shooter = null;
}

// ---------------------------------------------------------------------------------------------
// Tuba: a growing sonic ring
// ---------------------------------------------------------------------------------------------

const ringDraw: DrawOpts = {};

/**
 * The tuba's sonic ring (GDD §5): grows from 12 to 40 px over 40 ticks, lives 70 ticks, flies
 * at 2.5 px/tick. It hits each enemy once (60, kind `impact`, tag `sonic`), erases every enemy
 * shot tagged `erasable` it touches (bullets, notes, records, eggs, grenades …) and pushes
 * enemies with ≤ 40 HP back 8 px. It pops on walls.
 */
export class TubaRing extends Projectile {
  size: number = TUBA.size0;
  horizontal = true;
  /** Enemy shots this ring erased (tests, scoring hooks). */
  erased = 0;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init({ ...o, look: 'anim', impact: 'none', kind: 'impact', tags: SONIC, pierce: Infinity, life: o.life ?? TUBA.life, offscreen: 48 });
    // Side ring unless it flies (nearly) straight up / down: the 45° diagonal is a side ring
    // too (no float tie at 45°), it travels along its velocity and pushes along its x.
    this.horizontal = Math.abs(o.vx) > Math.abs(o.vy) * 0.5;
    this.erased = 0;
    this.grow();
  }

  /** Size and hitbox for the current age. */
  private grow(): void {
    const k = Math.min(1, this.t / TUBA.growTicks);
    this.size = TUBA.size0 + (TUBA.size1 - TUBA.size0) * k;
    const long = Math.round(this.size);
    const thin = Math.max(6, Math.round(this.size * 0.4));
    const w = this.horizontal ? thin : long;
    const h = this.horizontal ? long : thin;
    this.hitbox.x = -w / 2;
    this.hitbox.y = -h / 2;
    this.hitbox.w = w;
    this.hitbox.h = h;
  }

  override update(): void {
    this.grow();
    super.update();
    if (this.removed) return;
    this.erased += eraseEnemyShots(this.world, this.hitRect());
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    if (!target) {
      // Splat against a wall.
      poof(this.world, x, y);
      return;
    }
    this.push(target);
    if ((this.hitList.length & 1) === 1) musicNotes(this.world, x, y - 6, 1);
  }

  /** Light enemies (≤ 40 HP) are pushed back 8 px along the ring's flight (walls stop them). */
  private push(t: Entity): void {
    if (!t.alive || t.maxHp > TUBA.pushHp || t.hasTag('boss') || t.hasTag('shot') || !this.horizontal) return;
    const dx = Math.sign(this.vx) * TUBA.push;
    if (t.body) pushX(t, dx, this.world.terrain, this.world);
    else if (!solidAt(this.world, t.x + dx, t.y - 4)) t.x += dx;
  }

  override draw(r: Renderer): void {
    const id = this.horizontal ? 'weapon/tuba-ring' : 'weapon/tuba-ring-up';
    const frame = clamp(Math.round((this.size - TUBA.size0) / 4), 0, 7);
    ringDraw.flipX = this.horizontal && this.vx < 0;
    ringDraw.flipY = !this.horizontal && this.vy > 0;
    const left = this.life - this.t;
    ringDraw.alpha = left < 12 ? Math.max(0.2, left / 12) : 1;
    r.sprite(id, frame, this.x, this.y, ringDraw);
  }
}

/** Fire one tuba ring along the aim. */
export function fireTuba(ctx: FireContext): TubaRing {
  const o = fromCtx(ctx, ctx.angle, TUBA.speed, TUBA.damage);
  o.sprite = '';
  const ring = TubaRing.spawn(ctx.world, o);
  o.shooter = null;
  ctx.gun.track(ring);
  return ring;
}

// ---------------------------------------------------------------------------------------------
// Bounce mines
// ---------------------------------------------------------------------------------------------

export interface MineOpts extends GrenadeOpts {
  /** Feet y of the thrower when it stood on a floor (lets the first hop clear a narrow gap). */
  floorY?: number;
}

const virtualFloor = makeRayHit();

/**
 * A bounce mine (GDD §5): a disc that bounces along the ground (vy × −0.6, vx kept), hops gaps up
 * to 32 px (it bounces off the height of its last floor as if the gap were bridged) and steps up
 * to 12 px. Explodes on enemy contact, on the 4th landing or after 150 ticks: 30 to the enemy
 * touched + 40 within r 20 (that enemy takes both).
 */
export class MineDisc extends Grenade {
  /** Height of the last floor it bounced on (NaN = none yet). */
  floorY = NaN;

  constructor(world: World) {
    super(world);
  }

  override init(o: MineOpts): void {
    super.init({
      w: 8,
      h: 6,
      ticksPerFrame: 3,
      ...o,
      gravity: o.gravity ?? MINE.gravity,
      contacts: MINE.landings,
      bounce: MINE.bounce,
      fuse: o.fuse ?? MINE.fuse,
      blastDamage: o.blastDamage ?? MINE.blast,
      blastRadius: o.blastRadius ?? MINE.radius,
      blastFalloff: 0,
      blastSize: 'm',
      blastHitsTarget: true,
      bounceSfx: 'weapon/mine-bounce',
      type: o.type ?? 'bounce-mine',
    });
    this.floorY = o.floorY ?? NaN;
  }

  override update(): void {
    const fy = this.floorY;
    if (this.vy > 0 && Number.isFinite(fy) && this.y < fy && this.y + this.vy + this.gravity >= fy && this.overNarrowGap(fy)) {
      // Bridge the gap: bounce off the old floor height (it counts as a landing).
      this.y = fy - 0.5;
      virtualFloor.x = this.x;
      virtualFloor.y = fy;
      virtualFloor.nx = 0;
      virtualFloor.ny = -1;
      if (this.onFloor(virtualFloor)) return;
    }
    super.update();
  }

  /** No floor under it at the old height, but floor again within 32 px ahead? */
  private overNarrowGap(fy: number): boolean {
    const t = this.world.terrain;
    if (Number.isFinite(t.surfaceY(this.x, fy - MINE.step, fy + 6))) return false;
    const dir = Math.sign(this.vx);
    if (dir === 0) return false;
    for (let d = 2; d <= MINE.gap; d += 2) {
      if (Number.isFinite(t.surfaceY(this.x + dir * d, fy - MINE.step, fy + 6))) return true;
    }
    return false;
  }

  protected override onFloor(h: RayHit): boolean {
    this.floorY = h.y;
    return super.onFloor(h);
  }

  /** A step up to 12 px above the floor: hop onto it and keep going; a higher wall bounces it back. */
  protected override onWall(h: RayHit): void {
    const dir = Math.sign(this.vx);
    if (dir !== 0) {
      const ref = Number.isFinite(this.floorY) ? this.floorY : this.y;
      const ax = this.x + dir * 3;
      const top = this.world.terrain.surfaceY(ax, ref - MINE.step - 0.5, this.y + 0.5);
      if (Number.isFinite(top) && top < this.y && !solidAt(this.world, ax, top - 3)) {
        this.x = ax;
        this.y = top - 1;
        this.vy = Math.min(this.vy, -1.2);
        return;
      }
    }
    super.onWall(h);
  }
}

/**
 * Throw one bounce mine: low (vx 3, vy −2), lobbed when aiming up (1, −4), dropped when aiming
 * down in the air (vy +1, half the thrower's vx — ours: the GDD gives only vy).
 */
export function fireMine(ctx: FireContext): MineDisc {
  let vx: number;
  let vy: number;
  if (ctx.aim === 'up') {
    vx = ctx.facing * MINE.upVx;
    vy = MINE.upVy;
  } else if (ctx.aim === 'down' && ctx.airborne) {
    vx = ctx.vx * 0.5;
    vy = MINE.downVy;
  } else {
    vx = ctx.facing * MINE.vx;
    vy = MINE.vy;
  }
  const start = throwStart(ctx, vx);
  const o = mineOpts;
  o.team = ctx.team;
  o.x = start.x;
  o.y = start.y;
  o.vx = start.vx;
  o.vy = vy;
  o.damage = MINE.hit;
  o.kind = 'explosion';
  o.owner = ctx.owner;
  o.shooter = ctx.shooter;
  o.weapon = ctx.weapon.id;
  o.type = ctx.weapon.id;
  o.sprite = 'weapon/mine-disc';
  o.floorY = ctx.airborne ? NaN : ctx.shooter.y;
  const m = MineDisc.spawn(ctx.world, o);
  o.shooter = null;
  ctx.gun.track(m);
  return m;
}

const mineOpts: MineOpts = { team: 'player', x: 0, y: 0, vx: 0, vy: 0, damage: 0 };

// ---------------------------------------------------------------------------------------------
// Flamethrower: a stream that follows the gun
// ---------------------------------------------------------------------------------------------

/** Points along a stream (6 px apart): 96 px + the floor run fit easily. */
const MAX_POINTS = 48;
const STEP = 6;

export interface StreamOpts {
  team: Team;
  owner?: number;
  x: number;
  y: number;
  angle: number;
  facing: 1 | -1;
  shooter?: Entity | null;
  weapon?: string;
}

const flameDraw: DrawOpts = {};
const glowDraw: DrawOpts = { blend: 'add', alpha: 0.7 };

/**
 * The flamethrower's stream (GDD §5): 96 px long, it rises slightly and curls down at the tip,
 * active 24 ticks per press (the flame shoots out at 16 px/tick and dies down over 8 more
 * ticks without damage). It follows the gun. Fired down from the air within 32 px of the
 * ground it runs 128 px along the floor. Walls stop it. Every 2 ticks it burns each target it
 * touches for 10 (kind `fire`), at most 12 times per target per press.
 */
export class FlameStream extends Entity implements Tracked {
  tracker: ShotTracker | null = null;
  readonly damage: Damage = { amount: FLAME.damage, kind: 'fire', dirX: 1, weapon: 'flamethrower' };
  shooter: Entity | null = null;
  angle = 0;
  /** Origin offset from the shooter (used when the shooter is not a GunMount). */
  ox = 0;
  oy = 0;
  t = 0;
  /** Current length of the flame (it shoots out). */
  reach = 0;
  /** Running along the floor (fired down near the ground). */
  floor = false;
  /** The stream ended against a wall (a flame splash there). */
  wall = false;
  n = 0;
  readonly px = new Float32Array(MAX_POINTS);
  readonly py = new Float32Array(MAX_POINTS);
  /** Hit radius of each point. */
  readonly pr = new Float32Array(MAX_POINTS);
  /** Distance of each point from the nozzle along the stream. */
  readonly ps = new Float32Array(MAX_POINTS);
  private readonly hitE: Entity[] = [];
  private readonly hitN: number[] = [];
  private readonly hostageHit = (box: Rect): boolean => this.touches(box);

  constructor(world: World) {
    super(world);
    this.z = 52;
    this.hitbox = { x: -8, y: -8, w: 16, h: 16 };
    this.despawnMargin = Infinity;
  }

  static spawn(world: World, o: StreamOpts): FlameStream {
    const f = acquire(world, FlameStream);
    f.init(o);
    return world.add(f);
  }

  init(o: StreamOpts): void {
    this.type = o.weapon ?? 'flamethrower';
    this.team = o.team;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.angle = o.angle;
    this.facing = o.facing;
    this.shooter = o.shooter ?? null;
    this.ox = this.shooter ? o.x - this.shooter.x : 0;
    this.oy = this.shooter ? o.y - this.shooter.y : 0;
    this.t = 0;
    this.reach = FLAME.growSpeed;
    this.floor = false;
    this.wall = false;
    this.n = 0;
    this.hitE.length = 0;
    this.hitN.length = 0;
    this.tracker = null;
    const d = this.damage;
    d.owner = o.owner;
    d.weapon = o.weapon ?? 'flamethrower';
    d.source = this;
    this.build();
  }

  /** Burning (dealing damage) right now? */
  get active(): boolean {
    return this.t < FLAME.activeTicks;
  }

  override update(): void {
    this.t++;
    const s = this.shooter;
    const holding = s === null || shooterReady(s);
    if (!holding && this.t < FLAME.activeTicks) this.t = FLAME.activeTicks; // dropped: die down now
    if (this.t >= FLAME.activeTicks && this.tracker) {
      this.tracker.untrack(this);
      this.tracker = null;
    }
    if (this.t >= FLAME.activeTicks + FLAME.fadeTicks) {
      this.remove();
      return;
    }
    if (holding) this.follow();
    this.reach += FLAME.growSpeed;
    this.build();
    if (this.active && this.t % FLAME.every === 1) this.burn();
    this.sparkle();
  }

  /** Follow the gun: the shooter's muzzle and aim (a Player), or its first offset. */
  private follow(): void {
    const s = this.shooter;
    if (!s) return;
    const m = mountOf(s);
    if (m) {
      m.muzzleWorld(pt);
      this.x = pt[0];
      this.y = pt[1];
      this.angle = m.aimAngle;
      this.facing = s.facing;
    } else {
      this.x = s.x + this.ox;
      this.y = s.y + this.oy;
    }
  }

  /** Lay the points of the stream from the nozzle; stop at walls. */
  private build(): void {
    const w = this.world;
    const ca = Math.cos(this.angle);
    const sa = Math.sin(this.angle);
    this.n = 0;
    this.wall = false;
    this.floor = false;
    // Fired down near the ground: down to the floor, then along it.
    if (sa > 0.9) {
      const fy = w.terrain.surfaceY(this.x, this.y, this.y + FLAME.floorReach);
      if (Number.isFinite(fy)) {
        this.floor = true;
        this.buildFloor(fy);
        return;
      }
    }
    const L = FLAME.length;
    const reach = Math.min(L, this.reach);
    const vertical = Math.abs(sa) > Math.abs(ca);
    // The curve (in px, sideways): horizontal streams rise ~4 px and curl 3 px down at the tip;
    // vertical ones lean 3 px toward the facing.
    const lx = vertical ? this.facing : 0;
    const ly = vertical ? 0 : -1;
    for (let s = 0; s <= reach + 0.01 && this.n < MAX_POINTS; s += STEP) {
      const u = s / L;
      const lat = vertical ? 3 * u * u : 12 * u - 15 * u * u * u;
      const x = this.x + ca * s + lx * lat;
      const y = this.y + sa * s + ly * lat;
      if (s > 0 && solidAt(w, x, y)) {
        this.wall = true;
        break;
      }
      // Hit radius grows along the stream, but the tip never burns past 96 px (+2).
      this.push(x, y, s, Math.min(3 + 6 * u, L + 2 - s));
    }
  }

  /** Down to the floor at `fy`, then up to 128 px along it in the facing direction. */
  private buildFloor(fy: number): void {
    const w = this.world;
    const t = w.terrain;
    let s = 0;
    let y = this.y;
    // The drop to the floor.
    for (; y < fy - 5 && this.n < MAX_POINTS && s <= this.reach; y += STEP, s += STEP) this.push(this.x, y, s, 4);
    // The run along the floor (follows slopes and steps of a few px; stops at walls and pits).
    let x = this.x;
    let floorY = fy;
    for (let d = 0; d <= FLAME.floorRun && this.n < MAX_POINTS && s <= this.reach; d += STEP, s += STEP) {
      x = this.x + this.facing * d;
      const f = t.surfaceY(x, floorY - 8, floorY + 8);
      if (!Number.isFinite(f)) break;
      if (solidAt(w, x, f - 5)) {
        this.wall = true;
        break;
      }
      floorY = f;
      this.push(x, f - 5, s, 5 + 3 * (d / FLAME.floorRun));
    }
  }

  private push(x: number, y: number, s: number, r: number): void {
    const i = this.n++;
    this.px[i] = x;
    this.py[i] = y;
    this.ps[i] = s;
    this.pr[i] = r;
  }

  /** Does any flame point touch the rect? */
  touches(b: Rect): boolean {
    for (let i = 0; i < this.n; i++) if (distToRect(this.px[i], this.py[i], b) <= this.pr[i]) return true;
    return false;
  }

  /** Burn every hostile the stream touches (10, at most 12 hits per target per press). */
  private burn(): void {
    const w = this.world;
    const list = w.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || !hostile(this.team, t.team)) continue;
        let idx = this.hitE.indexOf(t);
        if (idx >= 0 && this.hitN[idx] >= FLAME.maxHits) continue;
        const boxes = t.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          if (!this.touches(boxes[k])) continue;
          if (idx < 0) {
            idx = this.hitE.length;
            this.hitE.push(t);
            this.hitN.push(0);
          }
          this.hitN[idx]++;
          this.damage.dirX = Math.sign(t.x - this.x) || this.facing;
          w.damage(t, this.damage, k);
          const b = boxes[k];
          w.particles.burst(FX_EMBER, b.x + b.w / 2, b.y + b.h / 2, 2, 0.3, 1.2, -HALF_PI, 1.8);
          break;
        }
      }
    } finally {
      w.releaseSnapshot();
    }
    if (this.team === 'player') freeHostages(w, this.damage.owner ?? -1, this.hostageHit);
  }

  /** Embers and smoke at the tip; a flame splash against a wall. */
  private sparkle(): void {
    if (this.n === 0) return;
    const i = this.n - 1;
    const p = this.world.particles;
    if (this.t % 2 === 0) p.emit(FX_EMBER, this.px[i], this.py[i], Math.cos(this.angle) * 0.4, -0.5);
    if (this.t % 4 === 1) p.emit(FX_SMOKE, this.px[i], this.py[i] - 3, 0, -0.3);
    if (this.wall && this.active) p.burst(FX_FLAME, this.px[i], this.py[i], 1, 0.4, 1.4, this.angle + Math.PI, 2.2);
  }

  override draw(r: Renderer): void {
    if (this.n === 0) return;
    const id = 'weapon/flame';
    const art = hasSprite(id);
    // Dying down: the flame leaves the nozzle first.
    const gone = this.active ? -1 : (this.t - FLAME.activeTicks + 1) * 14;
    const L = this.floor ? FLAME.length + FLAME.floorReach : FLAME.length;
    // Tip first, so the hot core near the nozzle is drawn on top.
    for (let i = this.n - 1; i >= 0; i--) {
      const s = this.ps[i];
      if (s < gone) continue;
      const u = Math.min(1, s / L);
      const k = Math.min(5, Math.floor(u * 6) + (this.active ? 0 : 1));
      const flicker = (this.t + i) & 1;
      const x = Math.round(this.px[i] + (((this.t + i * 3) % 3) - 1) * (u > 0.5 ? 1 : 0));
      const y = Math.round(this.py[i] - (((this.t >> 1) + i) % 2));
      if (art) {
        flameDraw.flipX = this.facing < 0;
        r.sprite(id, Math.min(11, k * 2 + flicker), x, y, flameDraw);
      } else {
        const rr = Math.max(1, Math.round(this.pr[i] * 0.8));
        r.rect(x - rr, y - rr, rr * 2, rr * 2, k < 2 ? PAL.fire[5] : PAL.fire[3]);
      }
    }
    if (this.active && this.ps[0] >= gone && hasSprite('weapon/flame-glow')) {
      r.sprite('weapon/flame-glow', this.t & 1, Math.round(this.px[0]), Math.round(this.py[0]), glowDraw);
    }
  }

  override onRemove(): void {
    this.tracker?.untrack(this);
    this.tracker = null;
    this.shooter = null;
    this.damage.source = undefined;
    this.hitE.length = 0;
    release(this);
  }
}

/** Fire the flamethrower: one stream per press (it follows the gun for 24 ticks). */
export function fireFlame(ctx: FireContext): FlameStream {
  const f = FlameStream.spawn(ctx.world, {
    team: ctx.team,
    owner: ctx.owner,
    x: ctx.x,
    y: ctx.y,
    angle: ctx.angle,
    facing: ctx.facing,
    shooter: ctx.shooter,
    weapon: ctx.weapon.id,
  });
  ctx.gun.track(f);
  return f;
}

// ---------------------------------------------------------------------------------------------
// Laser: one beam per gun
// ---------------------------------------------------------------------------------------------

/** Live beam of each gun (a hold refreshes it instead of spawning a new one). */
const beams = new WeakMap<object, LaserBeam>();
const loopKeys = ['laser-0', 'laser-1', 'laser-x'];
const beamDraw: DrawOpts = { blend: 'add', alpha: 1 };
const beamSolid: DrawOpts = { alpha: 1 };

export interface BeamOpts {
  team: Team;
  owner?: number;
  x: number;
  y: number;
  angle: number;
  shooter?: Entity | null;
  /** The gun that keeps it on (each shot refreshes the beam). */
  gun?: Gun | null;
  weapon?: string;
  /** Sound pitch (Helium Head). */
  pitch?: number;
}

/**
 * The laser (GDD §5): a continuous beam from the gun to the first solid or 384 px that pierces
 * every target, 8 damage per 2 ticks to each. Every shot of the gun (one per 4 ticks = 1 ammo)
 * keeps it on for 4 ticks: a tap (3 shots) is a 12-tick pulse; after a held trigger is released
 * it lingers 6 more ticks. It follows the gun, the aim sweep included. Loops `weapon/laser`.
 */
export class LaserBeam extends Entity {
  readonly damage: Damage = { amount: LASER.damage, kind: 'laser', dirX: 1, weapon: 'laser' };
  shooter: Entity | null = null;
  gun: Gun | null = null;
  angle = 0;
  ox = 0;
  oy = 0;
  /** End of the beam. */
  x1 = 0;
  y1 = 0;
  /** It ends on a wall or a target (an impact sparkle there). */
  blocked = false;
  /** Ticks left of the current shot, and of the linger after it. */
  onTicks = 0;
  lingerLeft = 0;
  /** Shots that kept it on so far. */
  shots = 0;
  t = 0;
  private loopKey = '';
  private readonly sfxOpts = { pitch: 1 };
  private readonly hostageHit = (b: Rect): boolean => segmentRectT(this.x, this.y, this.x1, this.y1, b) >= 0;

  constructor(world: World) {
    super(world);
    this.z = 51;
    this.hitbox = { x: -4, y: -4, w: 8, h: 8 };
    this.despawnMargin = Infinity;
  }

  /** The live beam of a gun, if any. */
  static of(gun: object): LaserBeam | null {
    const b = beams.get(gun);
    return b && !b.removed ? b : null;
  }

  static spawn(world: World, o: BeamOpts): LaserBeam {
    const b = acquire(world, LaserBeam);
    b.init(o);
    return world.add(b);
  }

  init(o: BeamOpts): void {
    this.type = o.weapon ?? 'laser';
    this.team = o.team;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.angle = o.angle;
    this.shooter = o.shooter ?? null;
    this.gun = o.gun ?? null;
    this.ox = this.shooter ? o.x - this.shooter.x : 0;
    this.oy = this.shooter ? o.y - this.shooter.y : 0;
    this.facing = Math.cos(o.angle) < 0 ? -1 : 1;
    this.onTicks = 0;
    this.lingerLeft = 0;
    this.shots = 0;
    this.t = 0;
    this.sfxOpts.pitch = o.pitch ?? 1;
    const d = this.damage;
    d.owner = o.owner;
    d.weapon = o.weapon ?? 'laser';
    d.source = this;
    const owner = o.owner ?? -1;
    this.loopKey = owner === 0 || owner === 1 ? loopKeys[owner] : loopKeys[2];
    if (this.gun) beams.set(this.gun, this);
    this.refresh();
    this.trace();
    this.world.audio.sfxLoop?.(this.loopKey, 'weapon/laser', this.sfxOpts);
  }

  /** One more shot keeps it on 4 ticks; a held trigger (more than a tap's 3 shots) lingers. */
  refresh(): void {
    this.onTicks = LASER.cooldown;
    this.shots++;
    this.lingerLeft = this.shots > LASER.burst ? LASER.linger : 0;
  }

  /** On (full beam) or lingering (fading)? */
  get lingering(): boolean {
    return this.onTicks <= 0;
  }

  override update(): void {
    const s = this.shooter;
    if (s && !shooterReady(s)) {
      this.remove();
      return;
    }
    if (this.onTicks > 0) this.onTicks--;
    else if (this.lingerLeft > 0) this.lingerLeft--;
    else {
      this.remove();
      return;
    }
    this.t++;
    if (s) {
      const m = mountOf(s);
      if (m) {
        m.muzzleWorld(pt);
        this.x = pt[0];
        this.y = pt[1];
        this.angle = m.aimAngle;
      } else {
        this.x = s.x + this.ox;
        this.y = s.y + this.oy;
      }
      this.facing = Math.cos(this.angle) < -1e-6 ? -1 : 1;
    }
    this.trace();
    if (this.t % LASER.every === 0) this.zap();
  }

  /** Find the end of the beam: the first solid (terrain or a dynamic solid) or 384 px. */
  trace(): void {
    const dx = Math.cos(this.angle);
    const dy = Math.sin(this.angle);
    const R = LASER.range;
    const h = sweep(this.world.terrain, this.x, this.y, this.x + dx * R, this.y + dy * R, false, this.world, rayHit);
    this.blocked = h !== null;
    this.x1 = h ? h.x : this.x + dx * R;
    this.y1 = h ? h.y : this.y + dy * R;
  }

  /** 8 damage to every hostile the beam crosses (each target once, at its nearest part). */
  private zap(): void {
    const w = this.world;
    const list = w.snapshotTag('shootable');
    this.damage.dirX = this.facing;
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || !hostile(this.team, t.team)) continue;
        const boxes = t.hurtboxes();
        let best = Infinity;
        let part = -1;
        for (let k = 0; k < boxes.length; k++) {
          const tt = segmentRectT(this.x, this.y, this.x1, this.y1, boxes[k]);
          if (tt >= 0 && tt < best) {
            best = tt;
            part = k;
          }
        }
        if (part < 0) continue;
        w.damage(t, this.damage, part);
        const hx = this.x + (this.x1 - this.x) * best;
        const hy = this.y + (this.y1 - this.y) * best;
        w.particles.burst(FX_SPARK, hx, hy, 2, 0.6, 1.8, this.angle + Math.PI, 2);
      }
    } finally {
      w.releaseSnapshot();
    }
    if (this.blocked) w.particles.burst(FX_SPARK, this.x1, this.y1, 2, 0.6, 2, this.angle + Math.PI, 2.4);
    if (this.team === 'player') freeHostages(w, this.damage.owner ?? -1, this.hostageHit);
  }

  override draw(r: Renderer): void {
    const x0 = Math.round(this.x);
    const y0 = Math.round(this.y);
    const x1 = Math.round(this.x1);
    const y1 = Math.round(this.y1);
    const flat = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
    // Offsets across the beam: rows for flat beams, columns for steep ones (no gaps on diagonals).
    const ax = flat ? 0 : 1;
    const ay = flat ? 1 : 0;
    const fade = this.lingering ? this.lingerLeft / (LASER.linger + 1) : 1;
    const pulse = (this.t >> 1) & 1;
    if (!this.lingering) {
      // Outer glow (2 px each side, pulsing), then the cyan body.
      beamDraw.alpha = 0.45 + pulse * 0.15;
      r.line(x0 - ax * 2, y0 - ay * 2, x1 - ax * 2, y1 - ay * 2, PAL.teal[2], beamDraw);
      r.line(x0 + ax * 2, y0 + ay * 2, x1 + ax * 2, y1 + ay * 2, PAL.teal[2], beamDraw);
      beamSolid.alpha = 1;
      r.line(x0 - ax, y0 - ay, x1 - ax, y1 - ay, PAL.teal[3], beamSolid);
      r.line(x0 + ax, y0 + ay, x1 + ax, y1 + ay, PAL.teal[3], beamSolid);
    } else {
      beamSolid.alpha = fade;
      r.line(x0 - ax, y0 - ay, x1 - ax, y1 - ay, PAL.teal[3], beamSolid);
    }
    beamSolid.alpha = fade;
    r.line(x0, y0, x1, y1, PAL.snow[3], beamSolid);
    if (hasSprite('weapon/laser-flare')) r.sprite('weapon/laser-flare', pulse, x0, y0, beamDraw);
    if (this.blocked && hasSprite('weapon/laser-hit')) r.sprite('weapon/laser-hit', this.t % 3, x1, y1, beamDraw);
  }

  override onRemove(): void {
    this.world.audio.stopSfx?.(this.loopKey);
    if (this.gun && beams.get(this.gun) === this) beams.delete(this.gun);
    this.gun = null;
    this.shooter = null;
    this.damage.source = undefined;
    release(this);
  }
}

/** Fire the laser: refresh this gun's beam, or switch a new one on. */
export function fireLaser(ctx: FireContext): LaserBeam {
  const live = LaserBeam.of(ctx.gun);
  if (live) {
    live.refresh();
    return live;
  }
  return LaserBeam.spawn(ctx.world, {
    team: ctx.team,
    owner: ctx.owner,
    x: ctx.x,
    y: ctx.y,
    angle: ctx.angle,
    shooter: ctx.shooter,
    gun: ctx.gun,
    weapon: ctx.weapon.id,
    pitch: ctx.gun.pitch,
  });
}
