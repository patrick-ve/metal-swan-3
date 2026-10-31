/**
 * The light pass on a perspective floor (docs/design/floor.md §3.8, §5.1; docs/api/floor.md §9).
 * An OPT-IN on top of the opt-in: the pass uses it only in a section that has a floor
 * (`worldFloor(world)`); every other light section draws exactly as before.
 *
 * With a floor:
 * - the lamp glows move with their lamps: a static lamp stands at a depth (`lampDepth`, the kit's
 *   decor depth of its lamp), so its light is drawn at that depth's shift and speed (`floorShift`);
 *   an entity light follows its entity's `drawDepth`;
 * - a lamp lights the floor: an elliptical POOL on the floor row of its depth (`floorPool`; the
 *   light map's `addEllipse`), flickering with its lamp, never above the floor's back edge;
 * - the near fog becomes a GROUND MIST that lies on the floor: rows of the fog texture, each row
 *   scrolling at its floor row's speed (line scroll, like the floor), thickest at the fronts' feet,
 *   thin over the walk lane, a little thicker again toward the bottom (`mistAlpha`); the far fog
 *   bands rise with the lifted backdrop.
 *
 * A section names its lamps' depths and tunes the pools and the mist with `defineFloorLight` (the
 * section file, next to its `defineSectionLight`). Without one the lamps stay at depth 0, the
 * pools are off and the mist uses the defaults.
 */
import type { StaticLight } from './api';

/** The ground mist's profile over the floor rows (multiples of the fog's density). */
export interface MistConfig {
  /** At the floor's back edge (the fronts' feet). */
  back: number;
  /** At the walk line. */
  walk: number;
  /** At the bottom of the view. */
  front: number;
  /** How far it creeps up the fronts above the back edge (logical px). */
  rise: number;
}

/** Lamp pools on the floor. */
export interface PoolConfig {
  /** Pool radius as a share of the lamp light's radius (world px on the floor). */
  radius: number;
  /** Strength as a share of the lamp's (it cuts the dark). */
  intensity: number;
  /** Share of the lamp's colour added on the floor. */
  glow: number;
}

/** The floor part of a section's light (`defineFloorLight`). */
export interface FloorLightConfig {
  /** The depth (floor DEPTH units) of static lamp `index` of the section light's `lamps`. */
  lampDepth?: (lamp: StaticLight, index: number) => number;
  pool?: PoolConfig;
  mist?: Partial<MistConfig>;
}

export const DEFAULT_MIST: MistConfig = { back: 0.62, walk: 0.16, front: 0.24, rise: 12 };

const configs = new Map<string, FloorLightConfig>();

/** Register (or replace) the floor light of a section id. Returns the config. */
export function defineFloorLight(sectionId: string, cfg: FloorLightConfig): FloorLightConfig {
  configs.set(sectionId, cfg);
  return cfg;
}

/** The floor light of a section id, or undefined (defaults). */
export function floorLightOf(sectionId: string): FloorLightConfig | undefined {
  return configs.get(sectionId);
}

function smooth(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * The mist's alpha share at screen row y (flat floor; before the fog's density): 0 above
 * `back − rise`, rising to `back` at the back edge, falling (quadratically: fast over the
 * pavement) to `walk` at the walk line, then easing to `front` at the bottom (216).
 */
export function mistAlpha(y: number, backY: number, walkY: number, m: MistConfig): number {
  if (y < backY - m.rise) return 0;
  if (y < backY) return m.back * smooth((y - (backY - m.rise)) / Math.max(1, m.rise));
  if (y < walkY) {
    // Thick at the fronts' feet, thinning fast over the pavement (so it reads), thin over the walk lane.
    const t = 1 - (y - backY) / Math.max(1, walkY - backY);
    return m.walk + (m.back - m.walk) * t * t;
  }
  return m.walk + (m.front - m.walk) * smooth((y - walkY) / Math.max(1, 216 - walkY));
}
