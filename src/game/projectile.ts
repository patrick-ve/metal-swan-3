/**
 * Projectiles: bullets, shells, rockets, enemy shots (docs/ARCHITECTURE.md §6).
 *
 * A `Projectile` is a pooled `ShotLike` entity: it only moves itself; the World's shot pass
 * sweeps it against hostile 'shootable' hurtboxes and against terrain (engine `sweep`), applies
 * `damage` and calls `onImpact`. Projectiles die after `life` ticks or when they leave the view
 * by more than `offscreen` px.
 *
 * ```ts
 * Projectile.spawn(world, { team: 'enemy', x, y, vx: -3, vy: 0, damage: 10, sprite: 'enemy/rifle-bullet' });
 * ```
 * Subclass for special behaviour (homing, splitting …): keep a `(world)` constructor, override
 * `init` (call super), `update` (call `this.move()` or move yourself) and `onImpact`.
 * `Rocket.spawn(world, opts)` then returns a pooled Rocket.
 *
 * Sprites: with `look: 'angle'` (default) the frame is chosen from the flight direction — a strip
 * of N frames covers 360°, frame 0 points right, frames go clockwise (N = 1: one frame for every
 * direction; 4: right / down / left / up; 16: 22.5° steps). With `look: 'anim'` the frames play
 * in a loop and the sprite is flipped when flying left. Sprites are anchored at their centre.
 */
import { Entity, type Damage, type DamageKind, type ShotLike, type Team } from '../engine/entity';
import { distToRect, overlaps, type Rect } from '../engine/math';
import type { DrawOpts, Renderer } from '../engine/render';
import { frameCount } from '../engine/sprites';
import type { Circle, World } from '../engine/world';
import { awardScore } from './events';
import { hitSpark, impactPuff, poof } from './fx';
import { acquire, release, type PoolCtor } from './pool';

export type ProjectileLook = 'angle' | 'anim';
export type ImpactFn = (p: Projectile, target: Entity | null, x: number, y: number) => void;

/** Counts live projectiles of a shooter (on-screen limits). Guns implement it. */
export interface ShotTracker {
  untrack(p: Tracked): void;
}

/**
 * Anything a gun counts toward its on-screen limit: projectiles, and the weapon entities that
 * are not projectiles (a flame stream, a laser beam, a shotgun cone). Call
 * `tracker?.untrack(this)` once when it stops counting.
 */
export interface Tracked {
  tracker: ShotTracker | null;
}

export interface ProjectileOpts {
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** Damage kind (default 'bullet'). */
  kind?: DamageKind;
  /** Player slot credited for kills (-1 / undefined = nobody). */
  owner?: number;
  /** Who fired it (vehicles, players, enemies); not used by the engine. */
  shooter?: Entity | null;
  /** px/tick². */
  gravity?: number;
  /** Velocity multiplier per tick (1 = none). */
  drag?: number;
  /** Lifetime in ticks (default 90). */
  life?: number;
  /** Extra targets it passes through (Infinity = all). */
  pierce?: number;
  /** Stops at ground / solids (default true). */
  hitsTerrain?: boolean;
  /** Stops on one-way platforms when falling onto them (default false). */
  hitsPlatforms?: boolean;
  /** Hitbox size, centred on the anchor (default 4×4). */
  w?: number;
  h?: number;
  /** Sprite id (centre anchor); '' = invisible. */
  sprite?: string;
  look?: ProjectileLook;
  /** Animation speed for look 'anim' (default 4). */
  ticksPerFrame?: number;
  blend?: 'normal' | 'add';
  /** Removed when this far outside the view (default 24; Infinity = never). */
  offscreen?: number;
  /** Impact effect: 'spark' (default: spark on targets, puff on terrain), 'none', or a function. */
  impact?: 'spark' | 'none' | ImpactFn;
  /** Extra hook after the impact effect (explode, split …). */
  onImpact?: ImpactFn | null;
  /** The other team can shoot it down (with `hp`); with `soft` the knife can hit it too. */
  shootable?: boolean;
  hp?: number;
  soft?: boolean;
  /** Draw order (default 50). */
  z?: number;
  /** Counts toward a shooter's on-screen limit (Gun does this for you). */
  tracker?: ShotTracker | null;
  /** Entity type name (default 'projectile'). */
  type?: string;
  /** Weapon id and damage tags carried by its hits (engine `Damage.weapon` / `Damage.tags`). */
  weapon?: string;
  tags?: readonly string[];
  /**
   * Can be erased by tuba rings, HONK, the respawn POOF and boss intermissions (`eraseEnemyShots`).
   * Default: true for team 'enemy'. Beams, lane blasts and other "walls of damage" pass false.
   */
  erasable?: boolean;
  /** Points for the player who shoots it down (shootable projectiles; GDD §14.1: 50). */
  score?: number;
}

const drawOpts: DrawOpts = {};

export class Projectile extends Entity implements ShotLike, Tracked {
  readonly damage: Damage = { amount: 10, kind: 'bullet', dirX: 1 };
  pierce = 0;
  hitsTerrain = true;
  hitsPlatforms = false;
  hitList: Entity[] = [];
  gravity = 0;
  drag = 1;
  /** Ticks left before it expires. */
  life = 90;
  offscreen = 24;
  sprite = '';
  look: ProjectileLook = 'angle';
  ticksPerFrame = 4;
  blend: 'normal' | 'add' = 'normal';
  impact: 'spark' | 'none' | ImpactFn = 'spark';
  impactHook: ImpactFn | null = null;
  tracker: ShotTracker | null = null;
  shooter: Entity | null = null;
  /** Points for shooting it down (0 = none). */
  score = 0;
  /** Ticks since spawn. */
  t = 0;

  constructor(world: World) {
    super(world);
    this.z = 50;
    this.despawnMargin = Infinity; // handled by `offscreen`
  }

  /** Spawn a pooled projectile of this class (`Projectile.spawn`, `MyRocket.spawn` …). */
  static spawn<T extends Projectile>(this: PoolCtor<T>, world: World, o: ProjectileOpts): T {
    const p = acquire(world, this);
    p.init(o);
    return world.add(p);
  }

  /** Set every field from the options (called for new and recycled objects). */
  init(o: ProjectileOpts): void {
    this.type = o.type ?? 'projectile';
    this.team = o.team;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.vx = o.vx;
    this.vy = o.vy;
    this.facing = o.vx < 0 ? -1 : 1;
    const d = this.damage;
    d.amount = o.damage;
    d.kind = o.kind ?? 'bullet';
    d.dirX = Math.sign(o.vx) || 0;
    d.owner = o.owner;
    d.source = this;
    d.weapon = o.weapon;
    d.tags = o.tags;
    this.gravity = o.gravity ?? 0;
    this.drag = o.drag ?? 1;
    this.life = o.life ?? 90;
    this.pierce = o.pierce ?? 0;
    this.hitList.length = 0;
    this.hitsTerrain = o.hitsTerrain ?? true;
    this.hitsPlatforms = o.hitsPlatforms ?? false;
    const w = o.w ?? 4;
    const h = o.h ?? 4;
    this.hitbox.x = -w / 2;
    this.hitbox.y = -h / 2;
    this.hitbox.w = w;
    this.hitbox.h = h;
    this.sprite = o.sprite ?? '';
    this.look = o.look ?? 'angle';
    this.ticksPerFrame = Math.max(1, o.ticksPerFrame ?? 4);
    this.blend = o.blend ?? 'normal';
    this.offscreen = o.offscreen ?? 24;
    this.impact = o.impact ?? 'spark';
    this.impactHook = o.onImpact ?? null;
    this.z = o.z ?? 50;
    this.hp = this.maxHp = o.hp ?? 1;
    this.tracker = o.tracker ?? null;
    this.shooter = o.shooter ?? null;
    this.score = o.score ?? 0;
    this.t = 0;
    this.addTag('shot');
    if (o.shootable) this.addTag('shootable');
    else this.removeTag('shootable');
    if (o.soft) this.addTag('soft');
    else this.removeTag('soft');
    if (o.erasable ?? o.team === 'enemy') this.addTag('erasable');
    else this.removeTag('erasable');
  }

  override update(): void {
    this.move();
    if (++this.t >= this.life) {
      this.expire();
      return;
    }
    if (this.offscreen !== Infinity && !this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** Apply gravity / drag and velocity (no terrain checks: the world's shot pass does those). */
  protected move(): void {
    this.vy += this.gravity;
    if (this.drag !== 1) {
      this.vx *= this.drag;
      this.vy *= this.drag;
    }
    this.x += this.vx;
    this.y += this.vy;
    if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
  }

  /** The lifetime ran out. Default: vanish. Explosive shots override this to blow up. */
  expire(): void {
    this.remove();
  }

  /** Called by the world's shot pass at the impact point. */
  onImpact(target: Entity | null, x: number, y: number): void {
    const fx = this.impact;
    if (fx === 'spark') {
      if (target) hitSpark(this.world, x, y, this.damage.dirX || this.facing);
      else impactPuff(this.world, x, y, -Math.sign(this.vx) * 0.7, -0.7);
    } else if (typeof fx === 'function') fx(this, target, x, y);
    this.impactHook?.(this, target, x, y);
  }

  /** Shot down by the other team (shootable projectiles): points to the shooter, then expire. */
  override die(d?: Damage): void {
    if (this.dead) return;
    this.dead = true;
    if (this.score > 0 && d) awardScore(this.world, d.owner, this.score, this.x, this.y - 6);
    this.expire();
    this.remove();
  }

  /** Erased by a tuba ring, HONK, the respawn POOF … (no score, no explosion): a puff. */
  erase(): void {
    if (this.removed) return;
    this.dead = true;
    poof(this.world, this.x, this.y);
    this.remove();
  }

  /** Current flight angle (radians, 0 = right, +π/2 = down). */
  get angle(): number {
    return Math.atan2(this.vy, this.vx);
  }

  override draw(r: Renderer): void {
    if (!this.sprite) return;
    let frame = 0;
    drawOpts.flipX = false;
    drawOpts.blend = this.blend;
    if (this.look === 'angle') {
      const n = frameCount(this.sprite);
      if (n > 1) {
        const turns = this.angle / (Math.PI * 2);
        frame = ((Math.round(turns * n) % n) + n) % n;
      } else drawOpts.flipX = this.vx < 0;
    } else {
      frame = Math.floor(this.t / this.ticksPerFrame);
      drawOpts.flipX = this.vx < 0;
    }
    r.sprite(this.sprite, frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }

  override onRemove(): void {
    this.tracker?.untrack(this);
    this.tracker = null;
    this.shooter = null;
    this.impactHook = null;
    this.damage.source = undefined;
    release(this);
  }
}

// ---------------------------------------------------------------------------------------------
// Erasing enemy shots (tuba rings, HONK, the respawn POOF, boss intermissions)
// ---------------------------------------------------------------------------------------------

export interface EraseOpts {
  /** Only shots of this team (default 'enemy'). */
  team?: Team;
}

/**
 * Erase every live projectile tagged 'erasable' (default: enemy shots; beams and lane blasts opt
 * out with `erasable: false`) whose hitbox touches the circle or rect, with a puff each.
 * Returns how many were erased. Entities that are not Projectiles but carry the tag are removed.
 */
export function eraseEnemyShots(world: World, shape: Circle | Rect, o: EraseOpts = {}): number {
  const team = o.team ?? 'enemy';
  const list = world.snapshotTag('erasable');
  let n = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== team) continue;
      const box = e.hitRect();
      const hit = 'r' in shape ? distToRect(shape.x, shape.y, box) <= shape.r : overlaps(shape, box);
      if (!hit) continue;
      if (e instanceof Projectile) e.erase();
      else {
        e.dead = true;
        poof(world, e.x, e.y);
        e.remove();
      }
      n++;
    }
  } finally {
    world.releaseSnapshot();
  }
  return n;
}
