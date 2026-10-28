/**
 * The floor's hooks for other passes (docs/design/floor.md §3.7, §3.8; docs/api/floor.md §7): the
 * floor of a world (the light pass has the world), where a point at a depth lands, a world point
 * projected, the depth of a decor item, and a lamp's pool on the floor. Pure maths over the
 * section's floor; nothing here draws.
 */
import type { Entity } from '../../../engine/entity';
import { FLOOR_CX, sAtDepth, sOfV, vAtDepth } from '../../../engine/floor/cam';
import type { Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import type { DecorDef } from '../types';
import type { SectionFloor } from './section-floor';

const floors = new WeakMap<World, SectionFloor>();

/** The runner binds each section's world to its floor (none: the section has no floor). */
export function bindWorldFloor(world: World, floor: SectionFloor | null): void {
  if (floor) floors.set(world, floor);
  else floors.delete(world);
}

/** The floor of the section this world plays (null: no floor). */
export function worldFloor(world: World): SectionFloor | null {
  return floors.get(world) ?? null;
}

/**
 * RENDER ONLY (docs/design/floor.md §12.1 item 4; docs/api/floor.md §8.2): a moving or breakable
 * entity draws its side and top faces itself, from its render-only hook `drawFloorFaces` — which the
 * floor calls (under every entity: the faces lie behind the walk plane) only on a floor whose
 * `FloorDef.entityFaces` lists its kind (`e.type`); anywhere else (no floor, a kind the floor does not
 * list: every oldenzaal floor in wave B) nothing calls it and this draws nothing, so the entity draws
 * exactly as before. `state` picks the kind's faces (0 whole, 1 broken, an animation frame …), `flip`
 * mirrors them with a sprite drawn flipX, (dx, dy) whole-px offsets of this frame's sprite (a bob, a
 * wobble) from the entity's x and y. The simulation never sees it; nothing is allocated per frame.
 *
 *   override drawFloorFaces(r: Renderer): void {
 *     drawEntityFaces(r, this, this.broken ? 1 : 0, false, this.wobbleDx());
 *   }
 */
export function drawEntityFaces(r: Renderer, e: Entity, state = 0, flip = false, dx = 0, dy = 0): void {
  const floor = floors.get(e.world);
  if (floor) floor.drawEntityFaces(r, e, state, flip, dx, dy);
}

/** A point (reused by the caller). */
export interface FloorPoint {
  x: number;
  y: number;
}

/**
 * Where world point (x, y) drawn at `depth` lands, as RENDERER WORLD coordinates (draw at them
 * through the renderer with its camera camX = `r.camX`): x moves to the depth's speed, y up by the
 * depth and by the floor's lift there (`SectionFloor.liftAt`: a raised pavement). This is how the
 * floor draws decor and `drawDepth` entities, so a lamp's light at its lamp's depth follows the
 * lamp exactly.
 */
export function floorShift(floor: SectionFloor, x: number, y: number, depth: number, camX: number, out: FloorPoint): FloorPoint {
  const s = sAtDepth(floor.cam, depth);
  out.x = x * s + (camX + FLOOR_CX) * (1 - s);
  out.y = y - depth - floor.liftAt(x, depth);
  return out;
}

/** Screen position of world point (u, v, h) (v world depth, h over the walk plane) for the camera (camX, camY). */
export function floorProject(floor: SectionFloor, u: number, v: number, h: number, camX: number, camY: number, out: FloorPoint): FloorPoint {
  const c = floor.cam;
  const s = sOfV(c, v);
  out.x = FLOOR_CX + (u - camX - FLOOR_CX) * s;
  out.y = c.yh - camY + (c.yw - c.yh - h) * s;
  return out;
}

/** The depth the floor draws a decor item at (null: hidden; 0: the walk plane). */
export function decorDepthOf(floor: SectionFloor, item: DecorDef, index: number): number | null {
  const def = floor.def;
  if ((def.hideDecor ?? []).some((p) => item.sprite.startsWith(p))) return null;
  let depth: number | null | undefined = item.depth;
  if (depth === undefined && def.decorDepth) depth = def.decorDepth(item, index);
  if (depth === undefined) depth = item.front ? 0 : (def.defaultDepth ?? 0);
  return depth;
}

/** A pool of light on the floor (renderer world coordinates of its centre, radii in screen px). */
export interface FloorPool {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * The ellipse a lamp at world x lights on the floor at `depth` with radius `radius` (world px): its
 * centre on the floor row of that depth (the floor's height there), flattened by the perspective
 * (rx = radius·s, ry = radius·(yw − yh)·s²/f).
 */
export function floorPool(floor: SectionFloor, x: number, depth: number, radius: number, camX: number, out: FloorPool): FloorPool {
  const c = floor.cam;
  const v = vAtDepth(c, depth);
  const s = sOfV(c, v);
  const h = floor.heightAt(x, v);
  out.x = x * s + (camX + FLOOR_CX) * (1 - s);
  out.y = c.yh + (c.yw - c.yh - (Number.isFinite(h) ? h : 0)) * s;
  out.rx = radius * s;
  out.ry = (radius * (c.yw - c.yh) * s * s) / c.f;
  return out;
}
