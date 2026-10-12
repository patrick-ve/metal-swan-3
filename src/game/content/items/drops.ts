/**
 * Drop values and drop tables (GDD §7.3, Conventions "Hostages / Crates"). Everything that can
 * be in a crate, in a hostage's hands or in an enemy's pocket is written the same way:
 *
 * - a crate letter `M S R F L H T B` (always that weapon; `B` = Bounce Mines, never a table),
 * - a weapon id (`machine-gun` …), `bombs`, `repair`, `1up`,
 * - a food kind (`bread cheese teacake jelly birthday-cake`) or a gem kind (`golden-note gem
 *   medal golden-record`; plain `food` / `gem` = bread / gem),
 * - a drop table: `table-a` … `table-d`, `crate`, `officer`, `truck`, or `auto` (the owner's own
 *   table: a crate rolls `crate`, a hostage its kind's table),
 * - `none` / `nothing` / null, any entity id, `{ id, params }`, or a list (one is picked).
 *
 * Rolls use `world.rng` (gameplay), so runs stay reproducible.
 */
import { Entity } from '../../../engine/entity';
import type { World } from '../../../engine/world';
import { ITEM_RULES } from '../../pickup';
import { getEntityFactory, hasEntity, hasWeapon, listWeapons, toSpawnSpec, type SpawnSpec } from '../../registry';

// ---------------------------------------------------------------------------------------------
// Scores (GDD §7.1, §14.3)
// ---------------------------------------------------------------------------------------------

export const FOOD_SCORE: Readonly<Record<string, number>> = {
  bread: 100,
  cheese: 300,
  teacake: 500,
  jelly: 1000,
  'birthday-cake': 5000,
};

export const GEM_SCORE: Readonly<Record<string, number>> = {
  'golden-note': 100,
  gem: 1000,
  medal: 2000,
  'golden-record': 10000,
};

export const FOOD_KINDS = Object.keys(FOOD_SCORE);
export const GEM_KINDS = Object.keys(GEM_SCORE);

// ---------------------------------------------------------------------------------------------
// Crate letters
// ---------------------------------------------------------------------------------------------

/** Crate letters → weapon ids (ARCHITECTURE §7.1; old ids still work as fallbacks). */
export const LETTER_WEAPONS: Readonly<Record<string, readonly string[]>> = {
  M: ['machine-gun'],
  S: ['shotgun'],
  R: ['rocket-launcher', 'rocket'],
  F: ['flamethrower', 'flame'],
  L: ['laser'],
  H: ['homing', 'homing-missiles'],
  T: ['tuba', 'tuba-blaster'],
  B: ['bounce-mine', 'bouncer'],
};

/** A weapon id for a crate letter: a registered weapon with that letter, else null. */
export function weaponForLetter(letter: string): string | null {
  const L = letter.toUpperCase();
  for (const id of LETTER_WEAPONS[L] ?? []) if (hasWeapon(id)) return id;
  const byLetter = listWeapons((w) => (w.kind ?? 'gun') === 'gun' && w.letter === L);
  return byLetter[0] ?? null;
}

/** The crate letter of a weapon id ('machine-gun' → 'M'), or null. */
export function letterForWeapon(id: string): string | null {
  for (const [letter, ids] of Object.entries(LETTER_WEAPONS)) if (ids.includes(id)) return letter;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Drop tables
// ---------------------------------------------------------------------------------------------

type Weighted<T> = ReadonlyArray<readonly [T, number]>;

/** Pick one entry by weight with the gameplay rng (entries of weight 0 never win). */
export function roll<T>(world: World, table: Weighted<T>): T | null {
  let total = 0;
  for (const [, w] of table) if (w > 0) total += w;
  if (total <= 0) return null;
  let r = world.rng.next() * total;
  for (const [v, w] of table) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return v;
  }
  for (let i = table.length - 1; i >= 0; i--) if (table[i][1] > 0) return table[i][0];
  return null;
}

/** Weapon weights by crate letter: table A (also the `crate` table) and table B (GDD §7.3). */
export const WEAPONS_A: Weighted<string> = [['M', 28], ['S', 14], ['R', 14], ['F', 12], ['L', 10], ['H', 10], ['T', 6], ['B', 6]];
export const WEAPONS_B: Weighted<string> = [['M', 20], ['S', 15], ['R', 15], ['F', 15], ['L', 10], ['H', 10], ['T', 8], ['B', 7]];

/** Food weights of table A — also used for the `crate` table's food (the GDD names none). */
const FOOD_A: Weighted<string> = [['bread', 40], ['cheese', 30], ['teacake', 20], ['jelly', 10]];

const food = (kind: string): SpawnSpec => ({ id: 'pickup-food', params: { kind } });
const gem = (kind: string): SpawnSpec => ({ id: 'pickup-gem', params: { kind } });
const BOMBS: SpawnSpec = { id: 'pickup-bombs' };

/** A weapon pickup rolled from letter weights (only weapons that exist are rolled). */
function rollWeapon(world: World, weights: Weighted<string>): SpawnSpec {
  const table: Array<readonly [string, number]> = [];
  for (const [letter, w] of weights) {
    const id = weaponForLetter(letter);
    if (id) table.push([id, w]);
  }
  return { id: 'pickup-weapon', params: { weapon: roll(world, table) ?? 'machine-gun' } };
}

/** Named drop tables (GDD §7.3). Each roll returns zero or more spawn specs. */
export const DROP_TABLES: Readonly<Record<string, (world: World) => SpawnSpec[]>> = {
  /** `crate` without `contains`: bombs 35 · weapon 25 (table-A weights) · food 25 · 3 golden notes 15. */
  crate: (w) => {
    const pick = roll(w, [['bombs', 35], ['weapon', 25], ['food', 25], ['notes', 15]] as const);
    if (pick === 'weapon') return [rollWeapon(w, WEAPONS_A)];
    if (pick === 'food') return [food(roll(w, FOOD_A) ?? 'bread')];
    if (pick === 'notes') return [gem('golden-note'), gem('golden-note'), gem('golden-note')];
    return [BOMBS];
  },
  /** `critic`: weapon 40 · bombs 25 · food 20 · gem 15. */
  'table-a': (w) => {
    const pick = roll(w, [['weapon', 40], ['bombs', 25], ['food', 20], ['gem', 15]] as const);
    if (pick === 'weapon') return [rollWeapon(w, WEAPONS_A)];
    if (pick === 'food') return [food(roll(w, FOOD_A) ?? 'bread')];
    if (pick === 'gem') return [gem(roll(w, [['gem', 70], ['medal', 30]] as const) ?? 'gem')];
    return [BOMBS];
  },
  /** `roadie`: always a weapon. */
  'table-b': (w) => [rollWeapon(w, WEAPONS_B)],
  /** `tea-lady`: food 60 (teacake 50, jelly 35, birthday-cake 15) · bombs 40. */
  'table-c': (w) =>
    roll(w, [['food', 60], ['bombs', 40]] as const) === 'food'
      ? [food(roll(w, [['teacake', 50], ['jelly', 35], ['birthday-cake', 15]] as const) ?? 'teacake')]
      : [BOMBS],
  /** `tourist`: gem 70 (gem 60, medal 40) · food 30 (cheese 50, teacake 50). */
  'table-d': (w) =>
    roll(w, [['gem', 70], ['food', 30]] as const) === 'gem'
      ? [gem(roll(w, [['gem', 60], ['medal', 40]] as const) ?? 'gem')]
      : [food(roll(w, [['cheese', 50], ['teacake', 50]] as const) ?? 'cheese')],
  /** `baton-major` on death: a medal. */
  officer: () => [gem('medal')],
  /** `band-truck` on death: bombs 50 · nothing 50. */
  truck: (w) => (roll(w, [['bombs', 50], ['nothing', 50]] as const) === 'bombs' ? [BOMBS] : []),
};

/** The drop table of each hostage kind (GDD §7.2); the composer always gives an extra life. */
export const KIND_TABLES: Readonly<Record<string, string>> = {
  critic: 'table-a',
  roadie: 'table-b',
  'tea-lady': 'table-c',
  tourist: 'table-d',
};

/**
 * Turn a drop value (a crate's `contains`, a hostage's `drop`) into spawn specs. `auto`,
 * `random`, `true` and a missing value roll `fallbackTable`.
 */
export function contentsSpecs(v: unknown, world: World, fallbackTable = 'crate'): SpawnSpec[] {
  if (v === null || v === false || v === 'none' || v === 'nothing') return [];
  if (v === undefined || v === true || v === 'auto' || v === 'random') return DROP_TABLES[fallbackTable]?.(world) ?? [];
  if (Array.isArray(v)) return v.length ? contentsSpecs(world.rng.pick(v as unknown[]), world, fallbackTable) : [];
  if (typeof v === 'object') {
    const s = toSpawnSpec(v, world);
    return s ? [s] : [];
  }
  if (typeof v !== 'string' || !v) return [];
  if (DROP_TABLES[v]) return DROP_TABLES[v](world);
  if (v === 'bombs') return [BOMBS];
  if (v === 'repair') return [{ id: hasEntity('pickup-repair') ? 'pickup-repair' : 'pickup-bombs' }];
  if (v === '1up') return [{ id: hasEntity('pickup-1up') ? 'pickup-1up' : 'pickup-gem' }];
  if (v === 'food') return [food('bread')];
  if (v === 'gem') return [gem('gem')];
  if (v in FOOD_SCORE) return [food(v)];
  if (v in GEM_SCORE) return [gem(v)];
  if (/^[A-Z]$/.test(v)) return [{ id: 'pickup-weapon', params: { weapon: weaponForLetter(v) ?? 'machine-gun' } }];
  if (hasWeapon(v)) return [{ id: 'pickup-weapon', params: { weapon: v } }];
  return [{ id: v }];
}

/**
 * Spawn drop specs at (x, y) as dropped items with the GDD pop (vy −2.0); several items fan
 * out 10 px apart. Returns the spawned entities.
 */
export function spawnDrops(world: World, specs: readonly SpawnSpec[], x: number, y: number): Entity[] {
  const out: Entity[] = [];
  specs.forEach((s, i) => {
    const off = specs.length > 1 ? (i - (specs.length - 1) / 2) * 10 : 0;
    const e = world.spawn(s.id, x + off, y, { dropped: true, ...s.params });
    e.vx = off * 0.06;
    e.vy = ITEM_RULES.popVy;
    out.push(e);
  });
  return out;
}

/** Roll a drop value and spawn the result (enemies: `dropItems(world, 'officer', x, y)`). */
export function dropItems(world: World, value: unknown, x: number, y: number, fallbackTable = 'crate'): Entity[] {
  return spawnDrops(world, contentsSpecs(value, world, fallbackTable), x, y);
}

// ---------------------------------------------------------------------------------------------
// The `loot` entity: a drop value usable wherever an entity id is expected
// ---------------------------------------------------------------------------------------------

/** Nothing dropped: an invisible entity that leaves at once. */
class NoDrop extends Entity {
  override update(): void {
    this.remove();
  }
  override draw(): void {}
}

/**
 * Factory of the `loot` entity (param `contains` or `table`: any drop value). It returns the
 * first rolled item itself — so an enemy's `drop: { id: 'loot', params: { contains: 'officer' } }`
 * pops a real pickup — and spawns any others next to it.
 */
export function makeLoot(world: World, x: number, y: number, p: Readonly<Record<string, unknown>>): Entity {
  const value = p.contains ?? p.table ?? p.drop ?? 'auto';
  const specs = contentsSpecs(value, world, 'crate');
  const first = specs[0];
  const make = first ? getEntityFactory(first.id) : undefined;
  if (!first || !make) return new NoDrop(world, x, y);
  const passOn: Record<string, unknown> = {};
  if (p.dropped !== undefined) passOn.dropped = p.dropped;
  const e = make(world, x, y, { ...passOn, ...first.params });
  e.type = first.id;
  if (specs.length > 1) {
    const rest = spawnDrops(world, specs.slice(1), x + 6, y);
    for (const r of rest) r.vx += 0.5;
  }
  return e;
}
