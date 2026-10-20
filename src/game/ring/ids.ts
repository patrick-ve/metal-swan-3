/**
 * Shared ids of mission `ring` (docs/design/ring.md, docs/api/ring.md §1). Fixed in the core
 * stage so the parallel builders agree: add more, never rename these.
 */

/** The mission id (NOT registered with `defineMission`, spec §13). */
export const RING_ID = 'ring';

/** Landmarks in their real clockwise order (spec §4). `westpoort` = mid-boss slot, `exit` = end-boss marker. */
export const RING_LANDMARKS = ['oost', 'amstel', 'zuid', 'nieuwe-meer', 'west', 'westpoort', 'coentunnel', 'noord', 'zeeburg', 'exit'] as const;
export type RingLandmarkId = (typeof RING_LANDMARKS)[number];

/** Entity ids of wave A (the mechanism). */
export const RING_ENTITY = {
  /** The player vehicle (a 1990s station wagon; content/ring/wagon). */
  wagon: 'ring-wagon',
  /** Civilian traffic; params `model` (hatch | estate | van | taxi | camper | box-truck), `colour`, `hostage?`. */
  car: 'ring-car',
  gantry: 'ring-gantry',
  closure: 'ring-closure',
  speedcam: 'ring-speedcam',
  avgzone: 'ring-avgzone',
  jam: 'ring-jam',
  crate: 'ring-crate',
  hostage: 'ring-hostage',
  scooter: 'ring-scooter',
} as const;

/** Entity ids of wave B (the plan may name them; spawns of unknown ids are skipped safely). */
export const RING_ENTITY_B = {
  parcelVan: 'ring-parcel-van',
  caravan: 'ring-caravan',
  scanCar: 'ring-scan-car',
  towTruck: 'ring-tow-truck',
  handhaverMoto: 'ring-handhaver-moto',
  roadworks: 'ring-roadworks',
  lorry: 'ring-lorry',
} as const;

/** Civilian car models (`ring-car` param `model`). */
export const RING_CAR_MODELS = ['hatch', 'estate', 'van', 'taxi', 'camper', 'box-truck'] as const;
export type RingCarModel = (typeof RING_CAR_MODELS)[number];

/** Sprite id prefixes (spec §11; 1×, 2× and 4× from one density-generic drawer). */
export const RING_ART = {
  wagon: 'ring/wagon/',
  car: 'ring/car/',
  hazard: 'ring/hazard/',
  item: 'ring/item/',
  scooter: 'ring/scooter/',
  fx: 'fx/ring/',
  /** `decor/ring/<landmark>/…` set pieces. */
  decor: 'decor/ring/',
  /** Background generators are named `ring-*`. */
  bg: 'ring-',
} as const;

/** The set-piece sprite prefix of a landmark. */
export function landmarkDecor(id: RingLandmarkId): string {
  return `${RING_ART.decor}${id}/`;
}
