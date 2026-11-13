/**
 * Mission `rally`, level 3 (since the oat wave, docs/design/oat.md (deleted; git show eb3316a) §1): BINNEN DE RING, a 3D race on the A10 (docs/design/rally.md;
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
 * scrape, bump, recover; the rest come in wave B). The payload types: runner.ts
 * `RallyRunnerEvents` (wave A) and api.ts `RallyEventsB` (wave B; docs/api/rally.md "B.4").
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
  // Wave B (PREP, additive; docs/api/rally.md "B.4").
  'redx',
  'released',
  'spitsstrookOpen',
  'bestLap',
  'honk',
  'crash',
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
  /** Wave B (PREP, additive): the matrix-sign faces (WORLD's emissive page; PREP's stub). */
  signs: 301,
  /** Wave B: the glows and lights of the night (WORLD). */
  lights: 302,
  /** Wave B: the road works' props, the police display (RULES' `WORKS_PAGE`, 128²). */
  works: 303,
  /** Wave B: the sky's clouds (WORLD's `WORLD_PAGES.sky`). */
  sky: 310,
} as const;

/**
 * Wave B (PREP, additive; docs/api/rally.md "B.3"): what a body on the road is. The race cars are
 * 'player' (a slot ≥ 0) and 'rival'; FIELD adds 'traffic', RULES 'police' and 'prop' (the road
 * works' trucks and barriers: standing bodies).
 */
export const BODY_KINDS = ['player', 'rival', 'traffic', 'police', 'prop'] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

/**
 * Wave B (PREP, additive): the lamp bits of `RallyBody.lights` (the scene and WORLD's night lights
 * draw them; the owner of the body sets them every tick it changes).
 */
export const BODY_LIGHT = {
  /** Headlights (at night: two glows and a pool on the road). */
  head: 1,
  /** Tail lights (at night). */
  tail: 2,
  /** Brake lights. */
  brake: 4,
  /** The indicators (blinking is the drawer's: on in the first half of every 40 ticks). */
  left: 8,
  right: 16,
  /** Both indicators (a stopped traffic car after a hit, a pulled-over racer). */
  hazard: 32,
  /** The police's blue lights (and the STOP POLITIE display). */
  blue: 64,
} as const;
