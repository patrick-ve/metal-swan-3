/**
 * The floor of `ams` c AMSTEL (docs/design/floor.md §4.4, §12.2 c; §11 R1 side faces, R2 street logic):
 * the street layout of the section and its FloorDef (the section file sets `floor: cFloor(decor)`).
 *
 * | u | stretch |
 * |---|---|
 * | 0–470 | open quay, the bike lane, two pole rows; a bulb (196–304) round the first crate (250) by the tulips |
 * | 470 | kerb crossing lane → the quay head's square (§4.2): the lane ends where the riders give way |
 * | 470–600 | the quay head: a small cobbled square at the canal's edge — the lamp a gull sleeps on (520) and the rusty bike of the secret (534) stand on it |
 * | 600–1400 | the canal: water over the whole band, quay walls at both banks; six houseboats as boxes (hull and cabin ends, deck and roof tops); the two rowing boats draw their own faces; the kerbs bend to the house stretch under the water (980–1020) |
 * | 1400–2368 | the shop quay: house stretch, cobbles, the facades at 14 with their row ends' sides; a terrace bulb (1404–1772) under the crate (1460), the herring cart (1520), the tourist's chair (1640) and the market stall (1700); a bulb (1930–2044) under the crate (1980) and the lamp a gull sleeps on (2000) at the scan-car arena's start (the car fights on the cobbles) |
 * | 2368–2448 | the fork's square at the bridge's foot (the repair crate 2384, the route signs on the far pavement) |
 * | 2400–2608 | the fork (fork.ts): the ramp up to the white bridge (its deck back to its far railing), the jetty steps across the band down to the basin, the pontoon a box on the water, the tour boat moored at its far side |
 *
 * Physics is untouched (spec §0.1): the canal and the basin are the terrain's gaps, the steps its
 * profile, the ramp, the deck and the pontoon its platforms; this file only says how they look.
 * Street logic (spec §11 R2): nothing stands in the lane or on the cobbled roadway but traffic — what
 * the script keeps in the walk plane stands on a bulb or a square; the lane ends at a crossing.
 */
import { vAtDepth } from '../../../../../../engine/floor/cam';
import type { FloorDef, TopFaceDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { G } from '../../art';
import { C_ARENA, C_BASIN, C_BOATS, C_CANAL, C_STEPS_X, C_W, DECK_Y, ROOF_Y } from '../../terrain';
import { amsDecorDepth } from '../depth';
import { amsEntityFaces } from '../entities';
import { floorOnly, kitDecor, kitFloor } from '../guard';
import {
  AMS_BACK,
  AMS_CAMERA,
  BULB_NEAR_HOUSE,
  bulb,
  HOUSE_BACK_ROW,
  HOUSE_FAR,
  HOUSE_FRONT_ROW,
  HOUSE_NEAR,
  QUAY_BACK_ROW,
  QUAY_FAR,
  QUAY_FRONT_ROW,
  QUAY_NEAR,
  poleRow,
  rowGaps,
  streetFeatures,
  withBulbs,
  type Bulb,
  type StreetLayout,
} from '../layout';
import { BOAT_CABIN, BOAT_HULL, BOAT_ROOF } from '../section-a';
import { boatSides, houseSides } from '../sides';
import { forkFaces, forkFeatures } from './fork';

export { C_DECK_DEPTH, C_STAIR_FAR, C_TOUR_DEPTH, C_TOUR_X, PONTOON_DEEP, TOUR_BEAM } from './fork';

/** The switch: c draws its floor (wave B). */
export const C_FLOOR_ON = true;

/** The kerb crossing where the quay street's lane ends at the quay head's square (spec §4.2). */
export const C_CROSSING = 470;
/** The fork's square from the arena's end to the jetty steps. */
export const C_FORK_SQUARE = C_ARENA[1];
/** The kerbs bend from the open quay to the house stretch here, under the canal's water (≥ 32 px, spec §4.4). */
export const C_BEND: readonly [number, number] = [980, 1020];

/**
 * The pavement bulbs (spec §11 R2) round what the script keeps in the walk plane: the first crate on
 * the quay street (250); the shop quay's terrace — the crate (1460), the herring cart (1520), the
 * tourist's chair (1640), the market stall (1700); the crate (1980) and the lamp a gull sleeps on (2000).
 */
export const C_BULBS: readonly Bulb[] = [
  bulb(196, 228, 272, 304, QUAY_FAR, QUAY_NEAR),
  bulb(1404, 1436, 1740, 1772, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  bulb(1930, 1962, 2012, 2044, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
];

const BASE_FAR: readonly (readonly [number, number])[] = [
  [C_BEND[0], QUAY_FAR],
  [C_BEND[1], HOUSE_FAR],
];
const BASE_NEAR: readonly (readonly [number, number])[] = [
  [C_BEND[0], QUAY_NEAR],
  [C_BEND[1], HOUSE_NEAR],
];

/** The street layout of c. */
export const C_LAYOUT: StreetLayout = {
  light: 'golden',
  far: withBulbs(BASE_FAR, C_BULBS, 'far'),
  near: withBulbs(BASE_NEAR, C_BULBS, 'near'),
  bulbs: C_BULBS,
  street: [
    { u0: -1e9, kind: 'lane' },
    { u0: C_CROSSING, kind: 'fan' },
    { u0: C_CANAL[1], kind: 'cobbles' },
    { u0: C_FORK_SQUARE, kind: 'fan' },
  ],
  crossings: [{ u: C_CROSSING, dir: 1 }],
  quays: [[-1e9, C_BEND[0]]],
  bridges: [],
  // The canal, and the jetty basin (its coping along the quay's edge; the basin's own water level: fork.ts).
  canals: [C_CANAL, [C_BASIN[0], C_W + 200]],
  bikes: { every: 220, phase: 60 },
};

/**
 * Where the front rows keep clear (spec §3.6): the script's spawn points, pickups, hostages and props
 * (section-c.ts `script`, `life`, the secret), the pigeons, the window wavers, the ducks.
 */
export const C_KEEP_CLEAR: readonly number[] = [
  250, 300, 470, 520, 534, 640, 820, 1030, 1040, 1080, 1150, 1290, 1300, 1460, 1520, 1560, 1640, 1700, 1830, 1860, 1980, 2000, 2090, 2140,
  2384, 2408, 2540,
];

/** The front rows also keep clear of the player start (the front-row check reads it and the exits). */
const ROW_CLEAR: readonly number[] = [48, ...C_KEEP_CLEAR];

/** The bike racks by the front rows (front decor, section-c.ts). */
export const C_RACKS: readonly number[] = [1540, 1820, 2200];
const RACK_GAP = 44;

/** The basin's ducks: on the water in front of the pontoon (DEPTH < 0: nearer than the walk plane). */
export const C_DUCK_DEPTH = -8;

/** The FloorDef of c (`decor`: the section's decor list: the side faces find their fronts there). */
export function cFloorDef(decor: readonly DecorDef[]): FloorDef {
  const L = C_LAYOUT;
  const cam = { yh: AMS_CAMERA.yh, yw: G, f: AMS_CAMERA.f };
  const vAt = (depth: number): number => vAtDepth(cam, depth);
  const racks = C_RACKS.map((x): [number, number] => [x - RACK_GAP, x + RACK_GAP]);
  const houses: [number, number] = [C_CANAL[1], C_STEPS_X - 8];
  const tops: TopFaceDef[] = C_BOATS.flatMap((b): TopFaceDef[] => [
    { x0: b.x0 + 1, x1: b.x0 + b.w - 1, y: DECK_Y, depth: BOAT_HULL, tile: 'ams/boat-deck' },
    { x0: b.cx - 2, x1: b.cx + b.cw + 2, y: ROOF_Y, depth: BOAT_ROOF, tile: 'ams/boat-roof' },
  ]);
  return {
    camera: { ...AMS_CAMERA },
    painter: { id: 'ams/floor', params: { layout: L }, seed: 13 },
    features: [...streetFeatures(L), ...forkFeatures(HOUSE_NEAR)],
    baseFace: 'ams/kerb-face',
    rows: [
      poleRow({ name: 'back poles (quay)', prop: 'ams/pole', depth: QUAY_BACK_ROW, u0: 0, u1: C_CANAL[0], spacing: 34, offset: 10, gaps: rowGaps(L, vAt, QUAY_BACK_ROW, []), skip: 0.08 }),
      poleRow({ name: 'back poles (houses)', prop: 'ams/pole', depth: HOUSE_BACK_ROW, u0: houses[0], u1: houses[1], spacing: 40, offset: 22, gaps: rowGaps(L, vAt, HOUSE_BACK_ROW, []), skip: 0.1 }),
      poleRow({ name: 'front poles (quay)', prop: 'ams/pole', depth: QUAY_FRONT_ROW, u0: 0, u1: C_CANAL[0], spacing: 38, offset: 22, gaps: rowGaps(L, vAt, QUAY_FRONT_ROW, []), clear: ROW_CLEAR }),
      poleRow({ name: 'front poles (houses)', prop: 'ams/pole', depth: HOUSE_FRONT_ROW, u0: houses[0], u1: houses[1], spacing: 38, offset: 30, gaps: [...rowGaps(L, vAt, HOUSE_FRONT_ROW, []), ...racks], clear: ROW_CLEAR }),
    ],
    tops,
    // The side faces (spec §11 R1): the shop quay's row ends, the houseboats' ends, the fork's boxes.
    faces: [
      ...houseSides(decor, { back: AMS_BACK, light: 'golden', depthOf: amsDecorDepth }),
      // The hull's art reaches 25 px under the deck (art.ts `houseboatSprite`).
      ...boatSides(C_BOATS, { deckY: DECK_Y, roofY: ROOF_Y, bottom: G - DECK_Y - 25, hull: BOAT_HULL, cabin: BOAT_CABIN }),
      ...forkFaces(),
    ],
    // The moving and breakable things show their sides and tops (spec §12.1 item 4): the crates, the
    // herring cart, the market stall, the two rowing boats on the canal, the scan car.
    entityFaces: amsEntityFaces(['crate', 'ams-herring-cart', 'ams-market-stall', 'ams-boat-platform', 'ams-scan-car']),
    // The basin's ducks paddle in front of the pontoon (cosmetic: no hitbox, no damage — spec §3.7), not under its deck.
    entityDepth: { 'ams-ducks': () => C_DUCK_DEPTH },
    decorDepth: amsDecorDepth,
    // The old water pieces and the old front bollards (the pole rows replace them).
    hideDecor: ['decor/ams/water-', 'decor/ams/bollard'],
    shadow: 0.3,
    keepClear: C_KEEP_CLEAR,
  };
}

/** The section's `floor`: the def while the switch is on, else none (fail soft: a kit that throws gives none, logged). */
export function cFloor(decor: readonly DecorDef[]): FloorDef | undefined {
  return C_FLOOR_ON ? kitFloor('ams/c', () => cFloorDef(decor)) : undefined;
}

/** Decor only the floor draws: none in c (every piece of c's art stands at its depth in the section's list). */
export function cFloorDecor(): DecorDef[] {
  return C_FLOOR_ON ? kitDecor('ams/c', () => floorOnly([])) : [];
}
