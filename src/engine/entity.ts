/**
 * Entity base class and damage types (docs/ARCHITECTURE.md §5.10).
 *
 * Lifecycle: construct with the world → `world.add(e)` (or `world.spawn(id, …)`) → the world calls
 * `update()` every tick and `draw(r)` every frame → `die()` marks it dead (default: also removes
 * it) → `remove()` takes it out of the world at the end of the tick → `onRemove()`.
 *
 * - `dead`: killed. Not a target any more, but still updated and drawn (death animations).
 * - `removed`: gone; skipped by everything and dropped at the end of the tick.
 * Override `die()` to play a death animation, then call `remove()` when it is over.
 */
import type { Rect } from './math';
import { rectAt } from './math';
import type { Body, SolidBox } from './physics';
import type { Renderer } from './render';
import type { World } from './world';

export type Team = 'player' | 'enemy' | 'neutral';
export type DamageKind = 'bullet' | 'explosion' | 'fire' | 'knife' | 'laser' | 'crush' | 'impact';

export interface Damage {
  amount: number;
  kind: DamageKind;
  /** Direction of the hit: 1 = pushes right, -1 = pushes left, 0 = none. */
  dirX: number;
  /** The entity that did it (the shot, the explosion, the knife wielder…). */
  source?: Entity;
  /** Player index (0/1) to credit, for scores and stats. */
  owner?: number;
  /** Weapon id that caused it ('pistol', 'tuba', 'swan-beak-shell' …), when known. */
  weapon?: string;
  /**
   * Extra facts about the hit that rules can test with `damageHas(d, tag)`. Conventional tags:
   * 'heavy' (a big hit: a full vehicle cell), 'boss' (a boss attack), 'shockwave' (a ground
   * wave), 'sonic' (tuba / HONK rings), 'spread' (shotgun cone), 'hazard' (terrain hazards).
   */
  tags?: readonly string[];
}

/** Does a hit carry this tag (see `Damage.tags`)? */
export function damageHas(d: Damage, tag: string): boolean {
  return d.tags !== undefined && d.tags.includes(tag);
}

/**
 * Can an attacker of team `attacker` hurt a target of team `target`?
 * Players and enemies hurt each other; neutral attackers (hazards) hurt both; neutral targets
 * (hostages) are never hurt by the generic passes. There is no friendly fire.
 * Note: "enemy" means "hurt by the player" — destructible props are on the enemy team.
 */
export function hostile(attacker: Team, target: Team): boolean {
  return target !== 'neutral' && attacker !== target;
}

/**
 * Projectiles: entities tagged 'shot' that implement this are resolved by the world's shot pass
 * against entities tagged 'shootable' of a hostile team (using their `hurtboxes()`), swept from
 * the shot's previous position to its current one so fast shots never skip a target.
 */
export interface ShotLike {
  team: Team;
  damage: Damage;
  /** Extra targets the shot passes through (0 / undefined = stops at the first; Infinity = never). */
  pierce?: number;
  /** Stop at ground / solids / dynamic solids in the shot pass (default true). */
  hitsTerrain?: boolean;
  /** Also stop at one-way platforms when falling onto them (default false). */
  hitsPlatforms?: boolean;
  /**
   * Called at the impact point (`this.x/y` are moved there for a stopping hit): `target` is the
   * entity hit, or null for terrain. The world removes the shot afterwards unless it still has
   * pierce left. Spawn sparks / explosions here.
   */
  onImpact(target: Entity | null, x: number, y: number): void;
  /** Managed by the world: targets a piercing shot already hit (each is hit once). */
  hitList?: Entity[];
}

/** Ticks of white flash after a hit taken through the default onHit. */
export const HIT_FLASH_TICKS = 4;

export abstract class Entity {
  /** Unique per world, increasing in construction order. */
  readonly id: number;
  /** Spawn id (e.g. 'rifleman'); set by `world.spawn` when empty. */
  type = '';
  readonly world: World;
  /** Anchor position (usually the feet centre). */
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Position at the start of the current tick (set by the world before `update`). */
  prevX: number;
  prevY: number;
  /** Damage box relative to the anchor (mirrored when facing left). */
  hitbox: Rect = { x: -8, y: -16, w: 16, h: 16 };
  team: Team = 'neutral';
  /** Use addTag/removeTag after the entity is in the world so the tag index stays right. */
  readonly tags = new Set<string>();
  hp = 1;
  maxHp = 1;
  facing: 1 | -1 = 1;
  /** Draw order: decor 10, items 20, enemies 30, vehicles 35, players 40, shots 50, fx 60, front decor 80. */
  z = 30;
  /** Ticks since the first update. */
  age = 0;
  dead = false;
  removed = false;
  /** While > 0 the default onHit ignores hits (counted down by the world). */
  invulnTicks = 0;
  /** While > 0 draw with the white flash (counted down by the world). */
  flashTicks = 0;
  /**
   * Removed when farther than this outside the view — but only after it has been inside that
   * area once (`seen`). Infinity = never despawn (players, bosses, scripted actors).
   */
  despawnMargin = 160;
  seen = false;
  /** Damage dealt every tick to hostile shootables that overlap `hitbox` (null = none). */
  contactDamage: Damage | null = null;
  /** Physics body (see physics.ts); null for entities that move themselves. */
  body: Body | null = null;
  /** @internal true once the world has indexed this entity. */
  inWorld = false;

  private readonly hurtCache: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly contactCache: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly hitCache: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(world: World, x = 0, y = 0) {
    this.world = world;
    this.id = world.nextEntityId();
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
  }

  /** Not dead and not removed. */
  get alive(): boolean {
    return !this.dead && !this.removed;
  }

  /** Called once per tick. */
  update(): void {}

  /** Called once per frame. Draw through the renderer only. */
  draw(_r: Renderer): void {}

  /** World-space hitbox (mirrored when facing left). Reuses one rect unless `out` is given. */
  hitRect(out?: Rect): Rect {
    return rectAt(this.x, this.y, this.hitbox, this.facing < 0, out ?? this.hitCache);
  }

  /**
   * World-space boxes where this entity can be hurt. Default: the hitbox. Multi-part bosses
   * return several; the index is passed to `onHit` as `part`. Return a reused array.
   */
  hurtboxes(): readonly Rect[] {
    rectAt(this.x, this.y, this.hitbox, this.facing < 0, this.hurtCache[0]);
    return this.hurtCache;
  }

  /**
   * World-space boxes that deal `contactDamage` (the world's contact pass). Default: the hitbox.
   * Bosses return only their parts flagged `contact`; return an empty array for none.
   */
  contactBoxes(): readonly Rect[] {
    rectAt(this.x, this.y, this.hitbox, this.facing < 0, this.contactCache[0]);
    return this.contactCache;
  }

  /**
   * A hit landed (from `world.damage`, the shot pass, contact damage or `damageArea`).
   * Return true if the hit was absorbed (the shot stops), false to let it pass through.
   * Default: ignore while invulnerable (except 'crush', which kills through invulnerability),
   * else lose hp, flash, and die at 0 hp.
   */
  onHit(d: Damage, _part = 0): boolean {
    if (this.dead || this.removed) return false;
    if (this.invulnTicks > 0 && d.kind !== 'crush') return false;
    this.hp -= d.amount;
    this.flashTicks = HIT_FLASH_TICKS;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(d);
    }
    return true;
  }

  /** Kill the entity. Default: mark dead and remove at the end of the tick. */
  die(_d?: Damage): void {
    this.dead = true;
    this.remove();
  }

  /** Take the entity out of the world at the end of this tick. */
  remove(): void {
    this.removed = true;
  }

  /** Called once after the entity left the world. */
  onRemove(): void {}

  /** Called every tick while the anchor is below `terrain.killY`. Default: remove. */
  onOutOfWorld(): void {
    this.remove();
  }

  /** A dynamic solid squeezed this entity against terrain. Default: lethal crush damage. */
  onCrushed(by: SolidBox): void {
    this.world.damage(this, { amount: 1e9, kind: 'crush', dirX: 0, source: by.owner instanceof Entity ? by.owner : undefined });
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  addTag(...tags: string[]): this {
    for (const t of tags) {
      if (this.tags.has(t)) continue;
      this.tags.add(t);
      if (this.inWorld) this.world.indexTag(this, t);
    }
    return this;
  }

  removeTag(tag: string): this {
    if (!this.tags.delete(tag)) return this;
    if (this.inWorld) this.world.unindexTag(this, tag);
    return this;
  }

  /** Is the hitbox within `margin` px of the camera view? */
  onScreen(margin = 0): boolean {
    return this.world.onScreen(this, margin);
  }
}
