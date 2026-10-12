/**
 * Entity pools: reuse short-lived entities (projectiles, fx) instead of allocating new ones.
 *
 * Pools are per world and per class. A pooled class has a `(world)` constructor and an init
 * method that sets every field it uses; it calls `release(this)` from `onRemove()`.
 * ```ts
 * class Spark extends Entity {
 *   constructor(world: World) { super(world); }
 *   static spawn(world: World, x: number, y: number): Spark {
 *     const s = acquire(world, Spark); s.x = x; s.y = y; …; return world.add(s);
 *   }
 *   override onRemove(): void { release(this); }
 * }
 * ```
 * Never keep a reference to a pooled entity after it was removed: the object comes back as a
 * different projectile later.
 */
import type { Entity } from '../engine/entity';
import type { World } from '../engine/world';

export type PoolCtor<T extends Entity> = new (world: World) => T;

/** Keep at most this many idle objects per class and world. */
const MAX_IDLE = 256;

const pools = new WeakMap<World, Map<PoolCtor<Entity>, Entity[]>>();
/** Entities sitting in a pool right now (guards against double release). */
const idle = new WeakSet<Entity>();

function poolFor(world: World, ctor: PoolCtor<Entity>): Entity[] {
  let byCtor = pools.get(world);
  if (!byCtor) {
    byCtor = new Map();
    pools.set(world, byCtor);
  }
  let list = byCtor.get(ctor);
  if (!list) {
    list = [];
    byCtor.set(ctor, list);
  }
  return list;
}

/**
 * A ready-to-init instance of `ctor` for `world`: a recycled one (with the engine's life-cycle
 * fields reset) or a new one. Add it with `world.add()` after initialising it.
 */
export function acquire<T extends Entity>(world: World, ctor: PoolCtor<T>): T {
  const list = poolFor(world, ctor as PoolCtor<Entity>);
  const e = list.pop() as T | undefined;
  if (!e) return new ctor(world);
  idle.delete(e);
  revive(e);
  return e;
}

/** Return a removed entity to its pool (call from `onRemove`). Ignored if it is still alive. */
export function release(e: Entity): void {
  if (!e.removed || e.inWorld || idle.has(e)) return;
  const list = poolFor(e.world, e.constructor as PoolCtor<Entity>);
  if (list.length >= MAX_IDLE) return;
  idle.add(e);
  list.push(e);
}

/** Reset the engine-managed fields of a recycled entity. */
function revive(e: Entity): void {
  e.dead = false;
  e.removed = false;
  e.seen = false;
  e.age = 0;
  e.invulnTicks = 0;
  e.flashTicks = 0;
  e.vx = 0;
  e.vy = 0;
  e.contactDamage = null;
}
