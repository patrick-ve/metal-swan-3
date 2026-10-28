/**
 * The floor of `ams` b MUSEUMPLEIN (docs/design/floor.md §4.4 b, §12.2 b) — AMS-B's folder: the street
 * layout of the section and its FloorDef (`section-b.ts` sets `floor: bFloor(decor)`).
 *
 * | u | stretch |
 * |---|---|
 * | 0–252 | house stretch (facades at 14), the bike lane, two pole rows; a bulb round the lamp at 110 (a sleeping gull); the row's end shows its side |
 * | 250–350 | a bulb round the first crate (300) |
 * | 400–720 | THE PASSAGE (passage.ts): the lane runs through it at the walk line on the street's own kerb lines (it connects at both mouths without a bend), the far walkway along the far wall; a small bulb round the museum crate (470, 420–520); the vault's shade only under the roof (facade → v 0, soft at the mouths); the museum's corner wings and towers are boxes (faces.ts) |
 * | 800 | kerb crossing lane → the square |
 * | 800–1100 | the square by the museum: grey tiles; the tulip stall (900), the hot-dog stand (a box) and the Swan's parking spot stand on it; the elm at 820 in a lawn bed |
 * | 1100–2176 | MUSEUMPLEIN: a gravel path along the walk line between flush lawns with granite edgings; the long pool behind it (1240–1740: stone rim, water); bulbs of the lawn round the tourists at 1420 and 1760; the low lawn chains as the front row; trees and flags on the grass |
 * | 2196 | kerb crossing gravel → lane |
 * | 2176–3072 | the canal road: house stretch (the house row stands at the facade's depth), the lane, two pole rows; bulbs round the crate, the lamp and the herring cart (2212–2404), the lamp at 2620 and the tourist at 2760; the canal in FRONT from 2192 (the near pavement is its quay) |
 *
 * Physics is untouched (spec §0.1): b's ground is flat, the passage's roof is the terrain's solid; this
 * file only says how they look. Street logic (spec §11 R2, §12.1 item 2): nothing stands in the lane or
 * on the gravel path but traffic — what the script keeps in the walk plane (the lamps with gulls, the
 * crates, the stalls, the tourists, the museum crate) stands on a bulb or the square.
 *
 * The canal road is a house stretch, not the open quay of §4.4: the section's decor puts a row of
 * canal houses there (and two window wavers in their windows), so the facades stand at 14 as in the
 * shopping street of a, and the road's canal runs in front of it (`ROAD_CANAL`).
 */
import type { FloorDef, PropRowDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { B_HOTDOG_X, B_PASSAGE, B_W, G } from '../../terrain';
import { amsDecorDepth } from '../depth';
import { amsEntityFaces } from '../entities';
import { floorOnly, kitDecor, kitFloor } from '../guard';
import {
  AMS_BACK,
  AMS_CAMERA,
  bulb,
  BULB_NEAR_HOUSE,
  FACADE,
  HOUSE_BACK_ROW,
  HOUSE_FAR,
  HOUSE_FRONT_ROW,
  HOUSE_NEAR,
  poleRow,
  rowGaps,
  streetFeatures,
  vAtAms,
  WATER_LEVEL,
  withBulbs,
  pool,
  type Bulb,
  type FloorArea,
  type StreetLayout,
} from '../layout';
import { lawnChainRow } from '../props';
import { houseSides } from '../sides';
import { riverSurface } from '../tiles';
import { museumSides, standSides } from './faces';
export { B_CABINET_DEPTH } from './faces';
import { MUSEUM_X, passageKerbs, passageMouths, passageRoof, passageShade } from './passage';

/** The switch: b draws its floor (wave B, AMS-B). */
export const B_FLOOR_ON = true;

/** The path over the Museumplein (its kerb lines: granite edgings of flush lawns) and where it bends from and back to the street. */
export const PATH_FAR = 8;
export const PATH_NEAR = -12;
/** The Museumplein's u range (its kerbs bend from and back to the house stretches over its first and last 32 px). */
export const B_PLEIN: readonly [number, number] = [1100, 2176];
const PLEIN = B_PLEIN;
const BEND = 32;
/** The low lawn chains in front of the path (on the near lawn, past its edging). */
export const CHAIN_ROW = -17;
/** The long pool behind the path (spec §12.2 b: a water strip behind the walk line with stone rims). */
export const B_POOL = { u0: 1240, u1: 1740, far: 26, near: 13 } as const;
/**
 * The canal along the canal road: the road's houses stand at the back, so its canal runs in FRONT —
 * the near pavement is the quay (the front poles on its edge, as Amsterdammertjes stand along a
 * canal), its coping, the quay wall and the water to the screen's bottom.
 */
export const ROAD_CANAL = { u0: 2192, far: -27, coping: 1.6 } as const;
/** The crossings: lane → the square after the passage, gravel → lane at the canal road. */
export const CROSS_SQUARE = 800;
export const CROSS_ROAD = 2196;

/**
 * The bulbs (spec §11 R2): the far pavement (or lawn) widens past the walk line round what the script
 * keeps there — the lamp at 110 (a sleeping gull); the crate at 300; the museum crate in the passage
 * (470: 30 px wide, a hidden tourist); the tourists on the lawn (1420, 1760); the crate, the lamp and
 * the herring cart of the canal road; the lamp at 2620; the tourist at 2760.
 */
export const B_BULBS: readonly Bulb[] = [
  bulb(70, 103, 117, 149, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  bulb(250, 282, 318, 350, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  // The museum crate's own bulb in the passage (the lane swerves round it under the vault).
  bulb(420, 452, 488, 520, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  bulb(1378, 1410, 1430, 1462, PATH_FAR, PATH_NEAR, -14),
  bulb(1718, 1750, 1770, 1802, PATH_FAR, PATH_NEAR, -14),
  bulb(2212, 2244, 2372, 2404, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  bulb(2580, 2613, 2627, 2659, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  bulb(2718, 2750, 2770, 2802, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
];

/** The kerb lines without bulbs: the house stretch, the path over the plein, the house stretch. */
const BASE_FAR: readonly (readonly [number, number])[] = [
  [PLEIN[0], HOUSE_FAR],
  [PLEIN[0] + BEND, PATH_FAR],
  [PLEIN[1] - BEND, PATH_FAR],
  [PLEIN[1], HOUSE_FAR],
];
const BASE_NEAR: readonly (readonly [number, number])[] = [
  [PLEIN[0], HOUSE_NEAR],
  [PLEIN[0] + BEND, PATH_NEAR],
  [PLEIN[1] - BEND, PATH_NEAR],
  [PLEIN[1], HOUSE_NEAR],
];
const FAR = withBulbs(BASE_FAR, B_BULBS, 'far');
const NEAR = withBulbs(BASE_NEAR, B_BULBS, 'near');

/** The lawns and beds (spec §12.2 b: gravel paths and grass; the trees on the grass, not on the path). */
const p = pool({ ...B_POOL, surface: riverSurface('noon') });
const AREAS: FloorArea[] = [
  // The elm's bed by the museum's corner (the elm at 820).
  { u0: 794, u1: 848, far: 13, near: 7.4, kind: 'grass', edge: 1 },
  // The lawns either side of the path, flush, their granite edgings along it (the far one bulges round the tourists).
  { u0: PLEIN[0] + 12, u1: PLEIN[1] - 12, far: AMS_BACK + 1, near: FAR, kind: 'grass', edge: 1.3 },
  { u0: PLEIN[0] + 12, u1: PLEIN[1] - 12, far: NEAR, near: -41, kind: 'grass', edge: 1.3 },
  // Gravel paths across the far lawn, back toward the tram (clear of the trees and the flags).
  { u0: 1206, u1: 1226, far: AMS_BACK + 1, near: FAR, kind: 'gravel' },
  { u0: 1880, u1: 1900, far: AMS_BACK + 1, near: FAR, kind: 'gravel' },
  // The pool's granite rim (over the lawn: it wins).
  p.area,
  // The canal road's quay coping (the near pavement's edge at the water).
  { u0: ROAD_CANAL.u0, u1: B_W + 64, far: ROAD_CANAL.far + ROAD_CANAL.coping, near: ROAD_CANAL.far, kind: 'granite' },
];

/** The street layout of b. */
export const B_LAYOUT: StreetLayout = {
  light: 'noon',
  far: FAR,
  near: NEAR,
  bulbs: B_BULBS,
  street: [
    { u0: -1e9, kind: 'lane' },
    { u0: CROSS_SQUARE, kind: 'tiles' },
    { u0: PLEIN[0] + BEND / 2, kind: 'gravel' },
    { u0: CROSS_ROAD, kind: 'lane' },
  ],
  crossings: [
    { u: CROSS_SQUARE, dir: 1 },
    { u: CROSS_ROAD, dir: -1 },
  ],
  quays: [],
  bridges: [],
  canals: [],
  bikes: { every: 220, phase: 60 },
  areas: AREAS,
  // The passage's vault shades the floor under it (passage.ts).
  shades: [passageShade()],
};

/**
 * Where the front rows keep clear (spec §3.6): the script's spawn points, pickups, hostages and props
 * (section-b.ts `script`, `life`, the secrets), the pigeons, the wavers, the vendor, the Swans.
 */
export const B_KEEP_CLEAR: readonly number[] = [
  110, 300, 470, 900, 992, 1025, 1072, 1080, 1128, 1240, 1380, 1420, 1460, 1586, 1602, 1640, 1660, 1760, 2000, 2260, 2300, 2330, 2340, 2520,
  2620, 2700, 2760, 2900,
];

/** The front rows also keep clear of the player start and the exit door (the front-row check reads both). */
const ROW_CLEAR: readonly number[] = [48, 3012, ...B_KEEP_CLEAR];

/** The bike racks (front decor) by the front pole rows. */
const RACKS = [250, 2400, 2860];
const RACK_GAP = 44;

/**
 * The stand's grey lamp on the floor: at the stand's left end (its 2D place, right of the stand, lies
 * behind the cabinet that stands in front at the near side: its pole rose out of the cabinet's top).
 */
export const B_STAND_LAMP_X = B_HOTDOG_X - 24;

/** The depth of a decor item on b's floor: the kit's rule, the museum at the facade's depth. */
export function bDecorDepth(d: DecorDef): number | null | undefined {
  if (d.sprite === 'decor/ams/rijksmuseum') return FACADE;
  // The stand's lamp: moved left of the stand (floor decor, `B_STAND_LAMP_X`).
  if (d.sprite === 'decor/ams/lamp-grey') return null;
  return amsDecorDepth(d);
}

/** The FloorDef of b (`decor`: the section's decor list: the side faces find their fronts there). */
export function bFloorDef(decor: readonly DecorDef[]): FloorDef {
  const L = B_LAYOUT;
  const bends: [number, number][] = [
    [PLEIN[0], PLEIN[0] + BEND],
    [PLEIN[1] - BEND, PLEIN[1]],
  ];
  const rackGaps = RACKS.map((x): [number, number] => [x - RACK_GAP, x + RACK_GAP]);
  const backGaps = rowGaps(L, vAtAms, HOUSE_BACK_ROW, bends);
  const frontGaps = [...rowGaps(L, vAtAms, HOUSE_FRONT_ROW, bends), ...rackGaps];
  const chainGaps = B_KEEP_CLEAR.map((x): [number, number] => [x - 26, x + 26]);
  const rows: PropRowDef[] = [
    // The street's back row stops short of the passage's left pier (its stone cap stands on the far walkway).
    poleRow({ name: 'back poles (street)', prop: 'ams/pole', depth: HOUSE_BACK_ROW, u0: 0, u1: B_PASSAGE[0] - 16, spacing: 40, offset: 30, gaps: backGaps }),
    poleRow({ name: 'back poles (canal road)', prop: 'ams/pole', depth: HOUSE_BACK_ROW, u0: PLEIN[1], u1: B_W, spacing: 40, offset: 22, gaps: backGaps, skip: 0.1 }),
    // No poles in the passage (spec §12.2 b) nor on the square; the street's front row stops at the passage's mouth.
    poleRow({ name: 'front poles (street)', prop: 'ams/pole', depth: HOUSE_FRONT_ROW, u0: 0, u1: B_PASSAGE[0] - BEND, spacing: 38, offset: 30, gaps: frontGaps, clear: ROW_CLEAR }),
    lawnChainRow({ depth: CHAIN_ROW, u0: PLEIN[0] + 24, u1: PLEIN[1] - 24, gaps: chainGaps }),
    poleRow({ name: 'front poles (canal road)', prop: 'ams/pole', depth: HOUSE_FRONT_ROW, u0: PLEIN[1], u1: B_W, spacing: 38, offset: 30, gaps: frontGaps, clear: ROW_CLEAR }),
  ];
  return {
    camera: { ...AMS_CAMERA },
    painter: { id: 'ams/floor', params: { layout: L }, seed: 11 },
    features: [
      ...streetFeatures(L),
      ...passageKerbs(FAR, B_BULBS),
      // The plein lies flush: the path, the lawns and their edgings at one level (the pool's rim rises over it).
      { kind: 'raise', u0: PLEIN[0], u1: PLEIN[1], to: FAR, dh: 0, face: 'ams/kerb-face' },
      { kind: 'raise', u0: PLEIN[0], u1: PLEIN[1], from: NEAR, dh: 0, face: 'ams/kerb-face' },
      ...p.features,
      // The canal in front of the canal road (its quay wall faces the camera; it ends in a wall at the plein).
      { kind: 'cut', u0: ROAD_CANAL.u0, u1: B_W + 64, from: ROAD_CANAL.far, level: WATER_LEVEL, surface: riverSurface('noon'), face: 'ams/quay-wall' },
    ],
    baseFace: 'ams/kerb-face',
    rows,
    faces: [
      ...houseSides(decor, { back: AMS_BACK, light: 'noon', depthOf: bDecorDepth }),
      ...museumSides(),
      ...passageMouths(),
      passageRoof(),
      ...standSides(),
    ],
    // The moving and breakable things show their sides and tops (spec §12.1 item 4): the crates, the
    // tulip stall, the herring cart, the museum crate in the passage (a secret).
    entityFaces: amsEntityFaces(['crate', 'ams-tulip-stall', 'ams-herring-cart', 'ams-secret']),
    decorDepth: bDecorDepth,
    // The old 2D water, lawn strips and pool pieces (the floor paints them now; the pool is in the height
    // field) and the old front bollards (the pole rows replace them).
    hideDecor: ['decor/ams/water-', 'decor/ams/lawn-', 'decor/ams/pool-', 'decor/ams/bollard'],
    shadow: 0.3,
    keepClear: B_KEEP_CLEAR,
  };
}

/** The section's `floor`: the def while the switch is on, else none (fail soft: a kit that throws gives none, logged). */
export function bFloor(decor: readonly DecorDef[]): FloorDef | undefined {
  return B_FLOOR_ON ? kitFloor('ams/b', () => bFloorDef(decor)) : undefined;
}

/** Decor only the floor draws: the stand's lamp left of it (the passage and the stand are face groups and overhangs). */
export function bFloorDecor(): DecorDef[] {
  return B_FLOOR_ON ? kitDecor('ams/b', () => floorOnly([{ sprite: 'decor/ams/lamp-grey', x: B_STAND_LAMP_X, y: G, depth: 0 }])) : [];
}

/** The museum's anchor (passage.ts) and the hot-dog stand's (terrain.ts), for the tests. */
export const B_MUSEUM_X = MUSEUM_X;
export const B_STAND_X = B_HOTDOG_X;
