/**
 * Mission oldenzaal — the possessed's shared rules and the API other owners use
 * (docs/api/oldenzaal.md "POSSESSED"). Owner: POSSESSED.
 *
 * - `OZ_HOLY_TAG`: a damage tag. Any hit that carries it (`Damage.tags`) on a host ejects its soul
 *   at once, whatever its HP (the brute too); on a free soul it blasts it. Townspeople are never
 *   hurt (team 'neutral'). WUGHOST's frikandel blast uses it, or `ejectSoulsInArea` below.
 * - `ejectSoul(e, owner?, dirX?)`: eject one soul now (a host: the kill, the soul out, the person
 *   freed; a free soul: it bursts). Returns false for anything else.
 * - `ejectSoulsInArea(world, x, y, r, owner?)`: every host and free soul whose hitbox touches the
 *   circle, at once. Returns how many.
 * - Re-possession bookkeeping (spec §3.4): at most `MAX_REPOSSESS` re-possessions on screen at
 *   once, the souls on their way in (circling, diving) included.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import { distToRect } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import { MAX_REPOSSESS } from './numbers';

/** The damage tag of a holy hit (the frikandel's holy-mayo blast): it ejects a soul at once. */
export const OZ_HOLY_TAG = 'oz-holy';

/** The tag of every host (shambler, gunner, brute) and of every free soul. */
export const OZ_HOST_TAG = 'oz-host';
export const OZ_SOUL_TAG = 'oz-soul';
/** The tag of the townspeople (neutral NPCs). */
export const OZ_TOWN_TAG = 'oz-town';

/** A host or free soul that can be ejected / blasted by a holy hit. */
export interface Ejectable {
  ejectNow(owner: number, dirX: number): void;
}

function isEjectable(e: Entity): e is Entity & Ejectable {
  return typeof (e as Partial<Ejectable>).ejectNow === 'function';
}

/** Eject the soul of host `e` (or blast free soul `e`) now, credited to `owner`. */
export function ejectSoul(e: Entity, owner = -1, dirX = 0): boolean {
  if (!e.alive || !isEjectable(e)) return false;
  e.ejectNow(owner, dirX);
  return true;
}

/** Eject every soul (hosts and free souls) whose hitbox touches the circle (x, y, r). */
export function ejectSoulsInArea(world: World, x: number, y: number, r: number, owner = -1): number {
  let n = 0;
  for (const tag of [OZ_HOST_TAG, OZ_SOUL_TAG]) {
    const list = world.snapshotTag(tag);
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || distToRect(x, y, e.hitRect()) > r) continue;
        if (ejectSoul(e, owner, Math.sign(e.x - x))) n++;
      }
    } finally {
      world.releaseSnapshot();
    }
  }
  return n;
}

/** A holy damage record for scripts / weapons (a fresh object; `tags` carries `OZ_HOLY_TAG`). */
export function holyDamage(owner = -1, dirX = 0, source?: Entity): Damage {
  return { amount: 1, kind: 'explosion', dirX, owner, source, tags: [OZ_HOLY_TAG] };
}

// ---------------------------------------------------------------------------------------------
// Re-possession (spec §3.4)
// ---------------------------------------------------------------------------------------------

const repossessing = new WeakMap<World, Set<Entity>>();

function setOf(world: World): Set<Entity> {
  let s = repossessing.get(world);
  if (!s) repossessing.set(world, (s = new Set()));
  return s;
}

/** Count `e` (a soul on its way in, or a re-possessed host) toward the cap. */
export function markRepossession(world: World, e: Entity): void {
  setOf(world).add(e);
}

/** Stop counting `e`. */
export function clearRepossession(world: World, e: Entity): void {
  repossessing.get(world)?.delete(e);
}

/** Re-possessions on screen now: re-possessed hosts alive on screen and the souls diving in. */
export function repossessionsOnScreen(world: World): number {
  const s = repossessing.get(world);
  if (!s) return 0;
  let n = 0;
  for (const e of s) {
    if (!e.alive) {
      s.delete(e);
      continue;
    }
    if (e.onScreen(0)) n++;
  }
  return n;
}

/** May one more soul start a re-possession now? */
export function canRepossess(world: World): boolean {
  return repossessionsOnScreen(world) < MAX_REPOSSESS;
}
