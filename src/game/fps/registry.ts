/**
 * First-person floor and episode registry (docs/api/fps.md §3). Content modules call the
 * `define*` functions at import time (the lazy `fps*` manifest entries); the game looks floors
 * up by id or number. Unknown ids never crash: `getFpsFloor` returns undefined and warns once.
 */
import type { FpsEpisodeDef, FpsFloorDef } from './types';

const floors = new Map<string, FpsFloorDef>();
const episodes = new Map<string, FpsEpisodeDef>();
const warned = new Set<string>();

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

/** Register (or replace) a floor. */
export function defineFpsFloor(def: FpsFloorDef): FpsFloorDef {
  floors.set(def.id, def);
  return def;
}

/** A floor by id ('fps-0'); unknown → undefined + one warning. */
export function getFpsFloor(id: string): FpsFloorDef | undefined {
  const f = floors.get(id);
  if (!f) warnOnce(`floor:${id}`, `[fps] unknown floor "${id}"`);
  return f;
}

export function hasFpsFloor(id: string): boolean {
  return floors.has(id);
}

/** The floor with `number` (id 'fps-<n>'), or undefined (no warning). */
export function fpsFloorByNumber(n: number): FpsFloorDef | undefined {
  return floors.get(fpsFloorId(n));
}

/** The id of floor number n ('fps-<n>'). */
export function fpsFloorId(n: number): string {
  return `fps-${n}`;
}

/** Registered floor ids (sorted). */
export function listFpsFloors(): string[] {
  return [...floors.keys()].sort();
}

export function defineFpsEpisode(def: FpsEpisodeDef): FpsEpisodeDef {
  episodes.set(def.id, def);
  return def;
}

export function getFpsEpisode(id: string): FpsEpisodeDef | undefined {
  const e = episodes.get(id);
  if (!e) warnOnce(`episode:${id}`, `[fps] unknown episode "${id}"`);
  return e;
}
