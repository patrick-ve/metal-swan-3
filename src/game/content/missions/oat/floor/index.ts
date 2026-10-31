/**
 * The oat floor kit (docs/design/oat.md §8.7 item 6, §8.10; docs/api/oat.md "Floor"). Owner:
 * STREET-A (oat-a and the oat-d proof strip in wave A; the other sections' owners add theirs).
 * One-line contract: it registers the floor painters (`oat-…` ids, mission/floor/) whose chunks
 * paint the materials wet and dry from the section's wetness field, the wear decals in world space
 * and the water cuts, and each section's `FloorDef` (camera, features, rows) for its SectionDef.
 * The water tiles and the baked reflection strips are LIGHT-WATER's (missions/oat/light/).
 *
 * WAVE A STUB (CORE): the wetness contract only; the oat sections have no floor yet.
 */

/**
 * The wetness of the floor at world (u, v) of a section, 0 (dry) … 1 (puddle) (spec §8.10: a wet in
 * shade after the night's rain, b dry, c / c1 damp edges, d all wet, e wet road). Pure: the painters
 * call it per art px at paint time.
 */
export type WetnessFn = (u: number, v: number) => number;

const fields = new Map<string, WetnessFn>();

/** Register (or replace) the wetness field of a section id. */
export function defineWetness(sectionId: string, fn: WetnessFn): WetnessFn {
  fields.set(sectionId, fn);
  return fn;
}

/** The wetness field of a section (dry everywhere when none is registered). */
export function wetnessOf(sectionId: string): WetnessFn {
  return fields.get(sectionId) ?? dry;
}

function dry(): number {
  return 0;
}
