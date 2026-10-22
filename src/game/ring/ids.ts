/**
 * Shared ids of mission `ring` (docs/design/ring.md, docs/api/ring.md §1). Fixed in the core
 * stage so the parallel builders agree: add more, never rename these.
 */

/** The mission id (NOT registered with `defineMission`, spec §13). */
export const RING_ID = 'ring';

/** Landmarks in their real clockwise order (spec §4). `westpoort` = mid-boss slot, `exit` = end-boss marker. */
export const RING_LANDMARKS = ['oost', 'amstel', 'zuid', 'nieuwe-meer', 'west', 'westpoort', 'coentunnel', 'noord', 'zeeburg', 'exit'] as const;
export type RingLandmarkId = (typeof RING_LANDMARKS)[number];

/**
 * Revision R (docs/design/ring.md §R.2): the routes a plan can take. `short` (the level, the
 * default): the boarding at S113, `oost` → `amstel` → `zuid`, the ZWAAN truck at the Zuidas, the
 * final jam. `full`: the old compressed loop over all ten landmarks (tests and sims only).
 */
export type RingRoute = 'short' | 'full';
export const RING_ROUTES: Readonly<Record<RingRoute, readonly RingLandmarkId[]>> = {
  short: ['oost', 'amstel', 'zuid'],
  full: RING_LANDMARKS,
};
/** The default route of `planRing` (and of `?mission=ring`). */
export const RING_DEFAULT_ROUTE: RingRoute = 'short';

/**
 * The full route's mid-boss slot (`westpoort`). Revision R retired the test lorry: the slot spawns
 * the ZWAAN train's controller (spec §R.1; TRAIN-1, 2026-10-22; was 'ring-lorry').
 */
export const RING_FULL_ROUTE_BOSS: string = 'ring-zwaan';

/**
 * The ZWAAN truck (docs/design/ring.md §R.3; contract: content/ring/zwaan/api.ts): the invisible
 * controller (the boss slot's id) and its five parts in the fixed order rear → front (R-16).
 */
export const RING_ZWAAN = {
  controller: 'ring-zwaan',
  container: 'ring-zwaan-container',
  autos: 'ring-zwaan-autos',
  tank: 'ring-zwaan-tank',
  vee: 'ring-zwaan-vee',
  cab: 'ring-zwaan-cab',
} as const;
/** The tag every ZWAAN part carries (the runner and the cues tell a part's 'bossDefeated' from a boss's). */
export const RING_ZWAAN_PART_TAG = 'ring-zwaan-part';
/** The fixed order of the parts (rear → front; spec R-16): the controller's default `params.order`. */
export const RING_ZWAAN_ORDER: readonly string[] = [RING_ZWAAN.container, RING_ZWAAN.autos, RING_ZWAAN.tank, RING_ZWAAN.vee, RING_ZWAAN.cab];

/** `?section=` names of revision R that are not landmarks: the truck (a run-in) and the foot sections. */
export const RING_SECTION_ZWAAN = 'zwaan';
export const RING_FOOT_SECTIONS = ['rf-a', 'rf-b'] as const;
export type RingFootSection = (typeof RING_FOOT_SECTIONS)[number];

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
  /** The full route's mid-boss slot: since revision R the ZWAAN train's controller (was 'ring-lorry'). */
  lorry: 'ring-zwaan',
} as const;

/**
 * The parts and adds of wave B (spawned by the wave-B entities or the jam controller, never by
 * the plan's cursor; the jam's `waves` name the boarders).
 */
export const RING_ENTITY_B_PARTS = {
  /** A parcel thrown out of a parcel van (content/ring/gangs/parcel.ts). */
  parcel: 'ring-parcel',
  /** A jam boarder (an ams handhaver or a stag partier; content/ring/crew/boarder.ts). */
  boarder: 'ring-boarder',
  /** The lorry's forklift add and its drums / crates (content/ring/boss/adds.ts). */
  forklift: 'ring-forklift',
  barrel: 'ring-barrel',
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
