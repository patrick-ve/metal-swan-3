/**
 * Shared helpers of the mission props (GDD §9.5): scoring (SET PIECE!), crushing, riders of
 * dynamic solids, live terrain hazards and small cosmetic effects. Gameplay only (no art).
 *
 * Props are plain Entities, never `Enemy`: they are not tagged 'enemy', so they never hold a
 * wave (`ctx.waitClear()`) and never count as kills. Destructible ones sit on team 'enemy'
 * (player shots, blasts and — when tagged 'soft' — the knife hit them) and carry the tag 'prop'.
 */
import type { Damage, Entity } from '../../../engine/entity';
import { overlaps, type Rect } from '../../../engine/math';
import type { SolidBox } from '../../../engine/physics';
import { hasSprite } from '../../../engine/sprites';
import type { HazardDef } from '../../../engine/terrain';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { awardScore } from '../../events';
import { FxEntity, type FxOpts } from '../../fx';
import { isPlayer, type Player } from '../../player/player';

/** GDD §14.2: an enemy killed by a set piece (the willow, the avalanche, a rolling statue head). */
export const SET_PIECE_SCORE = 200;

/** Damage big enough to kill anything that can die (set pieces crush, they do not chip). */
export const CRUSH_AMOUNT = 1e9;

/**
 * Pay SET PIECE! for `n` enemies to a player slot, with one callout for the batch
 * (`SET PIECE! +200`, `SET PIECE! +600` …). Unknown slots (nobody to credit) pay nothing.
 */
export function setPiece(world: World, slot: number | undefined, n: number, x: number, y: number): void {
  if (n <= 0 || (slot !== 0 && slot !== 1)) return;
  awardScore(world, slot, SET_PIECE_SCORE * n, x, y);
  hudOf(world).callout(`SET PIECE! +${SET_PIECE_SCORE * n}`);
}

/** The slot of the alive player nearest to (x, y), or undefined when nobody is alive. */
export function nearestSlot(world: World, x: number, y: number): number | undefined {
  const p = world.nearestPlayer(x, y);
  return isPlayer(p) ? p.index : undefined;
}

/** A player on foot who can be pushed, lifted or gassed (not dead, not dropping in, not riding). */
export function isFootPlayer(e: Entity | null | undefined): e is Player {
  return isPlayer(e) && e.state === 'play' && e.alive;
}

/** Crush damage from a set piece (a new object: the hit is rare and the target may keep it). */
export function crushHit(source: Entity, owner: number | undefined, dirX: number): Damage {
  return { amount: CRUSH_AMOUNT, kind: 'crush', dirX, source, owner };
}

/**
 * Collect into `out` every entity whose body stands on `box` (grounded on that very dynamic
 * solid). Returns `out` (cleared first; no allocation).
 */
export function ridersOf(world: World, box: SolidBox, out: Entity[]): Entity[] {
  out.length = 0;
  const list = world.entities;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const b = e.body;
    if (!b || e.removed || !b.onGround || b.supportSolid !== box) continue;
    out.push(e);
  }
  return out;
}

/** Is any player standing on the box? */
export function playerOn(world: World, box: SolidBox): Player | null {
  const list = world.players;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!isFootPlayer(p)) continue;
    const b = p.body;
    if (b.onGround && b.supportSolid === box) return p;
  }
  return null;
}

/** World rect of a solid box (a reused rect unless `out` is given). */
export function boxRect(box: SolidBox, out: Rect): Rect {
  out.x = box.x;
  out.y = box.y;
  out.w = box.w;
  out.h = box.h;
  return out;
}

/** Does the entity's hitbox overlap the rect? */
export function touches(e: Entity, r: Rect, scratch: Rect): boolean {
  return overlaps(e.hitRect(scratch), r);
}

// ---------------------------------------------------------------------------------------------
// Live terrain hazards
// ---------------------------------------------------------------------------------------------

/**
 * Add a hazard rect that a prop moves every tick (the avalanche's kill zone, the meltwater).
 * Thin wrapper over `Terrain.addHazard`: every reader (`hazardAt`, `hazardsAt`, `hazards.length`,
 * `waterSurfaceAt`) scans the live array each call, so a rect added here is seen at once by
 * players (death through invulnerability), vehicles (destroyed), respawn spot searches (they avoid
 * it) and the bot.
 */
export function addHazard(world: World, h: HazardDef): void {
  world.terrain.addHazard(h);
}

/** Remove a hazard added with `addHazard` (no-op when it is not there). */
export function removeHazard(world: World, h: HazardDef): void {
  world.terrain.removeHazard(h);
}

// ---------------------------------------------------------------------------------------------
// Cosmetic helpers
// ---------------------------------------------------------------------------------------------

/** The first registered sprite of a list (the last one is the fallback). */
export function firstSprite(...ids: string[]): string {
  for (const id of ids) if (hasSprite(id)) return id;
  return ids[ids.length - 1];
}

const hatOpts: FxOpts = { sprite: '', x: 0, y: 0 };

/**
 * A hat pops out (a soldier swallowed by the avalanche): the soldier's own tumbling hat strip
 * (`<art>/hat`) when there is one, else `fx/flying-shako`, else the props' own spinning shako.
 * Cosmetic randomness only (fxRng).
 */
export function popHat(world: World, x: number, y: number, own = ''): void {
  const o = hatOpts;
  o.sprite = own && hasSprite(own) ? own : firstSprite('fx/flying-shako', 'prop/avalanche/hat');
  o.x = x;
  o.y = y;
  o.vx = world.fxRng.range(0.6, 1.6);
  o.vy = world.fxRng.range(-3.6, -2.6);
  o.gravity = 0.14;
  o.loop = true;
  o.life = 70;
  o.z = 66;
  FxEntity.spawn(world, o);
}

/** Play a sound only while the point is near the view (props far away stay quiet). */
export function sfxNear(world: World, x: number, y: number, id: string, vol = 1, pitch = 1): void {
  const cam = world.camera;
  if (x < cam.left - 48 || x > cam.right + 48 || y < cam.top - 64 || y > cam.bottom + 64) return;
  world.audio.sfx(id, { vol, pitch });
}
