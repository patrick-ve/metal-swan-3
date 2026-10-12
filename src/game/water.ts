/**
 * Water helpers shared by everything that swims or floats (the Swan, rowboats, floating pianos,
 * the duck-float; GDD §8.2, §11). Water is a terrain hazard of kind 'water' (a rect); its top
 * edge is the surface. Players on foot wade in shallow water and drown in deep water
 * (Player.checkHazards); floaters ride the surface with `floatOnWater`.
 * ```ts
 * override update(): void {
 *   moveBody(this, this.world.terrain, this.world);
 *   this.swimming = floatOnWater(this, 10);      // hull rides 10 px deep
 * }
 * ```
 */
import type { Entity } from '../engine/entity';
import type { HazardDef } from '../engine/terrain';
import type { World } from '../engine/world';

/**
 * The 'water' rect at x that holds the point (x, y): its surface is at or above y and y is at most
 * `below` px under its bottom (a fast fall may step past a shallow rect). Null when there is none.
 */
export function waterRectAt(world: World, x: number, y: number, below = 0): HazardDef | null {
  const hz = world.terrain.hazards;
  let best: HazardDef | null = null;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    if (h.kind !== 'water' || x < h.x || x >= h.x + h.w) continue;
    if (y < h.y || y > h.y + h.h + below) continue;
    if (!best || h.y < best.y) best = h;
  }
  return best;
}

/** Is x inside any 'water' rect (at any height: swimming, or on a jetty, pad or island over it)? */
export function overWaterAt(world: World, x: number): boolean {
  const hz = world.terrain.hazards;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    if (h.kind === 'water' && x >= h.x && x < h.x + h.w) return true;
  }
  return false;
}

/**
 * The water surface (top y of a 'water' hazard rect) under x that is at or below `yFrom` minus
 * `above` px, or +Infinity when there is no water there.
 */
export function waterSurfaceAt(e: Pick<Entity, 'world'>, x: number, yFrom = -Infinity, above = 0): number {
  const hz = e.world.terrain.hazards;
  let best = Infinity;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    if (h.kind !== 'water' || x < h.x || x >= h.x + h.w) continue;
    if (h.y >= yFrom - above && h.y < best) best = h.y;
  }
  return best;
}

/**
 * Keep a body afloat: when its feet sink more than `draft` px below the surface of the water
 * under it, it is put back at that depth with no vertical speed and counts as standing (so it
 * can hop off the water). Call after `moveBody`. Returns true while floating.
 */
export function floatOnWater(e: Entity, draft = 6, maxBelow = 64): boolean {
  const surface = waterSurfaceAt(e, e.x, e.y - maxBelow);
  if (!Number.isFinite(surface)) return false;
  const rest = surface + draft;
  if (e.y < rest - 0.5 && e.vy < 0) return false; // hopping out of the water
  if (e.y < rest - 2) return false; // still above it (falling in)
  e.y = rest;
  if (e.vy > 0) e.vy = 0;
  const b = e.body;
  if (b) {
    b.onGround = true;
    b.ticksSinceGrounded = 0;
  }
  return true;
}
