/**
 * Mission `rally`, level 2: BINNEN DE RING, a 3D race on the A10 (docs/design/rally.md;
 * docs/api/rally.md). Ids and constants shared by the sim, the scenes, the content and the tools.
 *
 * `rally` is NOT a registered MissionDef (spec §12.3: the sorted ids would pull it into
 * `nextMission` and the high-score lists); the flow knows its id (`RALLY_ID`), like the ring's.
 */

export const RALLY_ID = 'rally';

/** Three laps (spec §0 item 8). */
export const RALLY_LAPS = 3;

/** Ticks per second (the fixed 60 Hz step). */
export const RALLY_HZ = 60;

/** The two cameras (spec §7.6; `?cam=`). */
export type RallyCam = 'chase' | 'bumper';
export const RALLY_CAMS: readonly RallyCam[] = ['chase', 'bumper'];

/** The car models (content/rally/models registers them; wave A: stubs). */
export const RALLY_MODEL = {
  /** 1P and P1 (spec §0 item 4). */
  white: 'estate-white',
  /** P2. */
  green: 'estate-green',
  rival: 'rival',
  traffic: 'traffic',
  police: 'police',
} as const;

/**
 * The runner's events (spec §12.3; wave A emits start, lap, place, finish, complete and DRIVE's
 * scrape, bump, recover; the rest come in wave B).
 */
export const RALLY_EVENTS = [
  'start',
  'lap',
  'place',
  'finish',
  'complete',
  'scrape',
  'bump',
  'recover',
  'flash',
  'fine',
  'pulledOver',
  'overtake',
  'nearMiss',
  'tunnelIn',
  'tunnelOut',
  'roadworksAhead',
  'policeActive',
  'jam',
] as const;
export type RallyEventName = (typeof RALLY_EVENTS)[number];

/**
 * The session record of the level 2 a run passed (`{ mission, seed }`): the floor-1 tally shows
 * `RING SEED n` from it (fps-tally.ts; docs/design/rally.md §12.3).
 */
export const LEVEL2_SEED_KEY = 'route/level2-seed';

/** What `LEVEL2_SEED_KEY` holds. */
export interface Level2Seed {
  readonly mission: string;
  readonly seed: number;
}

/**
 * Texture page id ranges (docs/api/rally.md): one id space per upload set, so the content parts
 * never collide. The track 1–99, the cars 100–199, the scenery and landmarks 200–299 (wave B),
 * the sky, lights and effects 300–399.
 */
export const PAGE_IDS = {
  track: 1,
  cars: 100,
  scenery: 200,
  fx: 300,
} as const;
