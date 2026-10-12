/**
 * Content registries (docs/ARCHITECTURE.md §6, §7): entities, weapons, characters, missions.
 *
 * Content modules call the `define*` functions at import time; the game looks everything up by
 * id at use time, so module order never matters. Unknown ids never crash:
 * - entities → the World spawns a magenta placeholder entity (one warning per id),
 * - weapons → the pistol (or a built-in fallback gun),
 * - characters → a default character drawn from `char/<id>/…`,
 * - missions → `undefined` (the mission runner shows a placeholder section).
 *
 * This module only imports types from the game layer, so every other module may import it.
 */
import type { Color } from '../engine/color';
import type { Entity } from '../engine/entity';
import type { EntityFactory, World } from '../engine/world';
import type { MissionDef } from './mission/types';
import type { StatusEffectDef } from './player/status';
import type { WeaponDef } from './weapons';

// One-stop imports for content modules.
export { defineSprite } from '../engine/sprites';
export { defineSfx, defineSong } from '../engine/audio';
export { defineBgGenerator, setTerrainPainter } from './art/art-registry';

const warned = new Set<string>();
function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

// ---------------------------------------------------------------------------------------------
// Spawn parameters
// ---------------------------------------------------------------------------------------------

/** Free-form spawn parameters from level data / scripts (`world.spawn(id, x, y, params)`). */
export type SpawnParams = Readonly<Record<string, unknown>>;

export const NO_PARAMS: SpawnParams = Object.freeze({});

/** Number parameter (falls back when missing or not a finite number). */
export function paramNum(p: SpawnParams | undefined, key: string, fallback: number): number {
  const v = p?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function paramStr(p: SpawnParams | undefined, key: string, fallback: string): string {
  const v = p?.[key];
  return typeof v === 'string' ? v : fallback;
}

export function paramBool(p: SpawnParams | undefined, key: string, fallback: boolean): boolean {
  const v = p?.[key];
  return typeof v === 'boolean' ? v : v === 1 ? true : v === 0 ? false : fallback;
}

/** Facing from `facing`: 1 / -1 / 'right' / 'left'. */
export function paramFacing(p: SpawnParams | undefined, fallback: 1 | -1 = -1): 1 | -1 {
  const v = p?.facing;
  if (v === 1 || v === 'right') return 1;
  if (v === -1 || v === 'left') return -1;
  return fallback;
}

/** An entity id plus its spawn params, as used by drops and hostage items. */
export interface SpawnSpec {
  id: string;
  params?: SpawnParams;
}

/**
 * Read a spawn spec: `'pickup-bombs'`, `{ id, params }`, or a list of those (one is picked with
 * the world's gameplay rng). Returns null when missing or malformed.
 */
export function paramSpawn(p: SpawnParams | undefined, key: string, world?: World): SpawnSpec | null {
  return toSpawnSpec(p?.[key], world);
}

export function toSpawnSpec(v: unknown, world?: World): SpawnSpec | null {
  if (typeof v === 'string' && v) return { id: v };
  if (Array.isArray(v) && v.length) {
    const pick = world ? world.rng.pick(v as unknown[]) : v[0];
    return toSpawnSpec(pick, world);
  }
  if (v && typeof v === 'object') {
    const o = v as { id?: unknown; params?: unknown };
    if (typeof o.id === 'string' && o.id) {
      const params = o.params && typeof o.params === 'object' ? (o.params as SpawnParams) : undefined;
      return params ? { id: o.id, params } : { id: o.id };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------------------------

export type EntityCategory =
  | 'enemy'
  | 'boss'
  | 'vehicle'
  | 'item'
  | 'hostage'
  | 'prop'
  | 'hazard'
  | 'projectile'
  | 'fx'
  | 'npc'
  | 'other';

/** Builds an entity. `params` is never undefined (an empty frozen object instead). */
export type EntityMaker = (world: World, x: number, y: number, params: SpawnParams) => Entity;

export interface EntityMeta {
  category: EntityCategory;
  /** Points for destroying it (Enemy / Boss use this when they have no own `score`). */
  score?: number;
  description?: string;
}

interface EntityEntry {
  readonly id: string;
  readonly make: EntityMaker;
  readonly meta: EntityMeta;
}

const entities = new Map<string, EntityEntry>();

/**
 * Register a spawnable entity.
 * ```ts
 * defineEntity('rifleman', (w, x, y, p) => new Rifleman(w, x, y, p), { category: 'enemy', score: 100 });
 * ```
 * Common params handled for every entity: `facing` (1 / -1 / 'left' / 'right'), `tag` / `tags`
 * (string or list, e.g. a wave tag for `waitClear`), `z`.
 */
export function defineEntity(id: string, make: EntityMaker, meta: EntityMeta): void {
  if (!id || typeof make !== 'function') {
    warnOnce(`entity-bad:${id}`, `[registry] defineEntity("${id}") ignored: needs an id and a factory`);
    return;
  }
  entities.set(id, { id, make, meta: { ...meta } });
}

export function hasEntity(id: string): boolean {
  return entities.has(id);
}

export function getEntityFactory(id: string): EntityMaker | undefined {
  return entities.get(id)?.make;
}

export function getEntityMeta(id: string): EntityMeta | undefined {
  return entities.get(id)?.meta;
}

/** Registered entity ids (sorted), optionally of one category. */
export function listEntities(category?: EntityCategory): string[] {
  const out: string[] = [];
  for (const e of entities.values()) if (!category || e.meta.category === category) out.push(e.id);
  return out.sort();
}

function applyCommonParams(e: Entity, p: SpawnParams): void {
  if (p === NO_PARAMS) return;
  if ('facing' in p) e.facing = paramFacing(p, e.facing);
  const tags = p.tags ?? p.tag;
  if (typeof tags === 'string') e.addTag(tags);
  else if (Array.isArray(tags)) for (const t of tags) if (typeof t === 'string') e.addTag(t);
  if (typeof p.z === 'number') e.z = p.z;
}

/**
 * The World spawn factory backed by this registry: `new World({ factory: gameEntityFactory })`.
 * Unknown ids return null, so the World spawns its placeholder entity.
 */
export const gameEntityFactory: EntityFactory = (id, world, x, y, params) => {
  const entry = entities.get(id);
  if (!entry) return null;
  const p = params ?? NO_PARAMS;
  const e = entry.make(world, x, y, p);
  if (!e.type) e.type = id;
  applyCommonParams(e, p);
  return e;
};

// ---------------------------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------------------------

const weapons = new Map<string, WeaponDef>();

/** Does nothing; used only when no weapon at all is registered. */
const INERT_WEAPON: WeaponDef = {
  id: 'none',
  name: '',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: 10,
  auto: false,
  fire: () => {},
};
let fallbackWeapon: WeaponDef = INERT_WEAPON;

/** Register a weapon (player weapons, bombs, the knife, vehicle guns, enemy-only guns …). */
export function defineWeapon(def: WeaponDef): WeaponDef {
  if (!def || !def.id || typeof def.fire !== 'function') {
    warnOnce(`weapon-bad:${def?.id}`, `[registry] defineWeapon("${def?.id}") ignored: needs an id and fire()`);
    return def;
  }
  weapons.set(def.id, def);
  return def;
}

/** @internal weapons.ts sets a built-in gun used when even the pistol is missing. */
export function setFallbackWeapon(def: WeaponDef): void {
  fallbackWeapon = def;
}

export function hasWeapon(id: string): boolean {
  return weapons.has(id);
}

/** The weapon, or (with one warning) the pistol / built-in fallback for unknown ids. */
export function getWeapon(id: string): WeaponDef {
  const w = weapons.get(id);
  if (w) return w;
  warnOnce(`weapon:${id}`, `[registry] unknown weapon "${id}" — using the pistol`);
  return weapons.get('pistol') ?? fallbackWeapon;
}

/** Registered weapon ids (sorted), optionally filtered. */
export function listWeapons(filter?: (w: WeaponDef) => boolean): string[] {
  const out: string[] = [];
  for (const w of weapons.values()) if (!filter || filter(w)) out.push(w.id);
  return out.sort();
}

// ---------------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------------

/** Per-character tweaks; every field is optional (1 / defaults = the TUNING values). */
export interface CharacterStats {
  /** Run, crawl and air speed multiplier. */
  speed?: number;
  /** Jump velocity multiplier (1.1 = higher jumps). */
  jump?: number;
  /** Bombs at the start of each life (default TUNING.grenade.perLife). */
  bombs?: number;
  /** Bomb weapon id (default 'grenade'). */
  bomb?: string;
  /** Weapon at the start of each life (default 'pistol'). */
  weapon?: string;
  /** Melee weapon id (default 'knife'). */
  melee?: string;
  /** Multiplier for the ammo of picked-up weapons. */
  ammo?: number;
}

export interface CharacterDef {
  id: string;
  /** Display name (menus, HUD): the short name, e.g. 'GRACE'. */
  name: string;
  /** Sprite prefix, e.g. 'char/recruit' → 'char/recruit/legs-run' (docs/ARCHITECTURE.md §6.1). */
  art: string;
  /** Rank / role line for the select screen. */
  title?: string;
  description?: string;
  stats?: CharacterStats;
  /** HUD accent colour. */
  color?: Color;
  /** Announcer line when picked. */
  voice?: string;
  /** Select-screen texts (GDD §13.5): full name with rank, role, quote and its stage direction. */
  fullName?: string;
  role?: string;
  quote?: string;
  quoteSub?: string;
  /** Radio callsign and the character's line in the ending. */
  callsign?: string;
  endingLine?: string;
}

const characters = new Map<string, CharacterDef>();

export function defineCharacter(def: CharacterDef): CharacterDef {
  if (!def || !def.id) {
    warnOnce('char-bad', '[registry] defineCharacter ignored: needs an id');
    return def;
  }
  characters.set(def.id, def);
  return def;
}

export function hasCharacter(id: string): boolean {
  return characters.has(id);
}

/** The character, else 'recruit', else a default drawn from `char/<id>/…`. */
export function getCharacter(id: string): CharacterDef {
  const c = characters.get(id);
  if (c) return c;
  warnOnce(`char:${id}`, `[registry] unknown character "${id}"`);
  return characters.get('recruit') ?? { id, name: id.toUpperCase(), art: `char/${id}` };
}

export function listCharacters(): string[] {
  return [...characters.keys()].sort();
}

// ---------------------------------------------------------------------------------------------
// Status effects (shared definitions by id: items, vehicles and the HUD use the same one)
// ---------------------------------------------------------------------------------------------

const statuses = new Map<string, StatusEffectDef>();

/** Register a status effect (e.g. 'helium-head') so every module uses one definition. */
export function defineStatus(def: StatusEffectDef): StatusEffectDef {
  if (!def || !def.id) {
    warnOnce('status-bad', '[registry] defineStatus ignored: needs an id');
    return def;
  }
  statuses.set(def.id, def);
  return def;
}

export function hasStatus(id: string): boolean {
  return statuses.has(id);
}

/** The status effect, or undefined (one warning) for unknown ids. */
export function getStatus(id: string): StatusEffectDef | undefined {
  const d = statuses.get(id);
  if (!d) warnOnce(`status:${id}`, `[registry] unknown status effect "${id}"`);
  return d;
}

export function listStatuses(): string[] {
  return [...statuses.keys()].sort();
}

// ---------------------------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------------------------

const missions = new Map<string, MissionDef>();

export function defineMission(def: MissionDef): MissionDef {
  if (!def || !def.id || !def.sections) {
    warnOnce(`mission-bad:${def?.id}`, `[registry] defineMission("${def?.id}") ignored: needs an id and sections`);
    return def;
  }
  if (!def.sections[def.start]) {
    warnOnce(`mission-start:${def.id}`, `[registry] mission "${def.id}": start section "${def.start}" is missing`);
  }
  missions.set(def.id, def);
  return def;
}

export function hasMission(id: string): boolean {
  return missions.has(id);
}

export function getMission(id: string): MissionDef | undefined {
  return missions.get(id);
}

/** Registered mission ids in natural order (m0, m1, … m10). */
export function listMissions(): string[] {
  return [...missions.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
