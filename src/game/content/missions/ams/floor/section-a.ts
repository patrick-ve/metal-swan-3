/**
 * The floor of `ams` a GRACHTENGORDEL (docs/design/floor.md §4.4, the table for a): the street
 * layout of the section and its FloorDef (the section file sets `floor: aFloor(decor)`).
 *
 * | u | stretch |
 * |---|---|
 * | 0–430 | open quay, the bike lane, two pole rows |
 * | 372–720 | the far pavement widens (a bulb, §11 R2) round the first crate (420), the lamp at 470 (a sleeping gull), the elm with the secret bike (620) and the bike rack (690); the lane swerves round it; the parked bikes (548) on the near pavement |
 * | 645 | kerb crossing lane → cobbles (§4.2), in the narrowed street |
 * | 720–880 | bridge 1: klinker deck over the hump between railings, the side canal under it (water 736–864) |
 * | 880–959 | a bulb round the lamp at 920 (a sleeping gull) |
 * | 975 | crossing cobbles → lane |
 * | 1001–1060 | the RAISED DRAWBRIDGE (§11 R2): the stop line, the barrier (1013), the gallows, the leaf on the bank |
 * | 1060–1340 | the side canal: a water cut, quay walls, the houseboats (boxes) with deck and roof tops |
 * | 1340–1904 | the leaf's landing, the barrier (1386), then the fan of the Pleintje (the lamp at 1360 and the bike rack at 1460 stand on the square) |
 * | 1880–1912 | the kerbs bend from the open quay to the house stretch |
 * | 1904–2600 | the shopping street: facades at 14 (sides at the row's ends), cobbles, canopies and slabs; bulbs round the tulip stall and from the herring cart past the crate (2580) to bridge 2 |
 * | 2600–2760 | bridge 2 (water 2632–2728) |
 * | 2782 | crossing cobbles → lane; the arrival: house stretch with the lane, FABEL FRIET's terrace (a bulb) and its counter |
 *
 * Physics is untouched (spec §0.1): the bridges are the terrain's hills (the walk profile), the side
 * canal its gap; this file only says how they look. Street logic (spec §11 R2): nothing stands in the
 * lane or on the cobbled roadway but traffic — what the script puts in the walk plane (lamps with
 * gulls, the secret's elm, stalls, racks, the counter) stands on a bulb or a square.
 */
import { depthAtV, sAtDepth, vAtDepth } from '../../../../../engine/floor/cam';
import { PAL } from '../../../../../engine/palette';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { FloorDef, OverhangDef, TopFaceDef } from '../../../../mission/floor/types';
import type { DecorDef } from '../../../../mission/types';
import { AWNING_SETS, G } from '../art';
import { rampOf } from '../art-hd-ab-kit';
import { A_AWNINGS, A_BOATS, A_CANAL, A_FABEL_X, A_LEDGES, A_W, DECK_Y, ROOF_Y } from '../terrain';
import { amsDecorDepth } from './depth';
import { drawbridgeFloor, type Drawbridge } from './drawbridge';
import {
  BULB_FAR,
  BULB_NEAR_HOUSE,
  BULB_NEAR_QUAY,
  bulb,
  FACADE,
  HOUSE_BACK_ROW,
  HOUSE_FAR,
  HOUSE_FRONT_ROW,
  HOUSE_NEAR,
  laneMidV,
  QUAY_BACK_ROW,
  QUAY_FAR,
  QUAY_FRONT_ROW,
  QUAY_NEAR,
  poleRow,
  rowGaps,
  streetFeatures,
  withBulbs,
  type Bridge,
  type Bulb,
  type StreetLayout,
} from './layout';
import { ensureFrontRail, RAIL_POST_H, RAIL_POST_W } from './props';
import { boatSides, boxSides, depthPx, ensureBandTile, houseSides, railPostSides } from './sides';
import { ensureArchTile, ensureCanopyTile } from './tiles';

/** The `ams` camera (spec §1.1): horizon 60, focal length 210, the floor 30 px behind the feet. */
export const AMS_CAMERA = { yh: 60, f: 210, back: 146 } as const;
/** The floor's back edge as a depth: the house sides reach back to it (spec §11 R1). */
export const AMS_BACK = G - AMS_CAMERA.back;

/** The houseboats in depth (spec §11 R1: the hull ~22 world px wide): the deck top and the hull, the cabin and its roof. */
export const BOAT_HULL = 11;
export const BOAT_CABIN = 8;
export const BOAT_ROOF = 9;

/** The kerbs bend from the open quay to the house stretch here (≥ 32 px, spec §4.4). */
const BEND: readonly [number, number] = [1880, 1912];

export const A_BRIDGE_1: Bridge = { x0: 720, len: 160, h: 14, water: [736, 864], far: QUAY_FAR, near: QUAY_NEAR };
export const A_BRIDGE_2: Bridge = { x0: 2600, len: 160, h: 14, water: [2632, 2728], far: HOUSE_FAR, near: HOUSE_NEAR };

/**
 * The pavement bulbs (spec §11 R2) round what the script keeps in the walk plane. The first runs from
 * the first weapon crate (420, 24 px wide) past the lamp at 470, the tourist's chair (572), the gull
 * with the fries (600), the elm (620) and the bike rack (690) to bridge 1, its near kerb bending back
 * to the bridge's edge.
 */
export const A_BULBS: readonly Bulb[] = [
  {
    u0: 372,
    u3: 720,
    // Over the bridge (720–880) its own features win: the far line returns to the quay's there.
    far: [
      [372, QUAY_FAR],
      [404, BULB_FAR],
      [720, BULB_FAR],
    ],
    near: [
      [372, QUAY_NEAR],
      [404, BULB_NEAR_QUAY],
      [688, BULB_NEAR_QUAY],
      [720, QUAY_NEAR],
    ],
  },
  // The lamp at 920 (a sleeping gull) on the cobbles after bridge 1.
  bulb(880, 913, 927, 959, QUAY_FAR, QUAY_NEAR),
  // The shopping street's tulip stall (2160): a kiosk on the widened pavement.
  bulb(2098, 2130, 2190, 2222, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
  // The herring cart (2470) and the crate before bridge 2 (2580): the pavement stays wide up to the
  // bridge (its near kerb bends back to the deck's edge; under the deck the far line returns).
  {
    u0: 2408,
    u3: 2600,
    far: [
      [2408, HOUSE_FAR],
      [2440, BULB_FAR],
      [2600, BULB_FAR],
      [2640, HOUSE_FAR],
    ],
    near: [
      [2408, HOUSE_NEAR],
      [2440, BULB_NEAR_HOUSE],
      [2568, BULB_NEAR_HOUSE],
      [2600, HOUSE_NEAR],
    ],
  },
  // FABEL FRIET's terrace: its counter (3330) and the baker stand on the pavement.
  bulb(3273, 3305, 3355, 3387, HOUSE_FAR, HOUSE_NEAR, BULB_NEAR_HOUSE),
];

/** The depth unit's camera (the walk line at G). */
const CAM = { yh: AMS_CAMERA.yh, yw: G, f: AMS_CAMERA.f };

/**
 * The raised drawbridge at the side canal's near bank (spec §11 R2; floor/drawbridge.ts): the leaf over
 * the lane's far half, its near edge on the lane's centre line (7 world px behind the walk line).
 */
export const A_DRAWBRIDGE: Drawbridge = {
  hinge: A_CANAL[0],
  thick: 15,
  len: 140,
  far: QUAY_FAR + 1.5,
  near: depthAtV(CAM, laneMidV(vAtDepth(CAM, QUAY_FAR), vAtDepth(CAM, QUAY_NEAR), CAM.f, CAM.yw - CAM.yh)),
  laneFar: QUAY_FAR,
  barriers: [1013, 1386],
  postFar: QUAY_FAR + 1,
  postNear: QUAY_NEAR - 1.2,
};

/** The pole rows stop at the drawbridge's barriers (spec §11 R2). */
const DRAWBRIDGE_GAPS: readonly (readonly [number, number])[] = [
  [988, 1070],
  [1330, 1400],
];

const BASE_FAR: readonly (readonly [number, number])[] = [
  [BEND[0], QUAY_FAR],
  [BEND[1], HOUSE_FAR],
];
const BASE_NEAR: readonly (readonly [number, number])[] = [
  [BEND[0], QUAY_NEAR],
  [BEND[1], HOUSE_NEAR],
];

export const A_LAYOUT: StreetLayout = {
  light: 'morning',
  far: withBulbs(BASE_FAR, A_BULBS, 'far'),
  near: withBulbs(BASE_NEAR, A_BULBS, 'near'),
  bulbs: A_BULBS,
  street: [
    { u0: -1e9, kind: 'lane' },
    { u0: 645, kind: 'cobbles' },
    { u0: 720, kind: 'deck' },
    { u0: 880, kind: 'cobbles' },
    { u0: 975, kind: 'lane' },
    { u0: A_CANAL[1], kind: 'fan' },
    { u0: 1904, kind: 'cobbles' },
    { u0: 2600, kind: 'deck' },
    { u0: 2760, kind: 'cobbles' },
    { u0: 2782, kind: 'lane' },
  ],
  crossings: [
    { u: 645, dir: 1 },
    { u: 975, dir: -1 },
    { u: 2782, dir: -1 },
  ],
  stops: [{ u: 1001, half: 'near' }],
  landings: [A_CANAL[1]],
  hingePits: [{ u0: A_DRAWBRIDGE.hinge - A_DRAWBRIDGE.thick, u1: A_DRAWBRIDGE.hinge, far: A_DRAWBRIDGE.near }],
  quays: [
    [-1e9, 1904],
    [2760, 2803],
  ],
  bridges: [A_BRIDGE_1, A_BRIDGE_2],
  canals: [A_CANAL],
  bikes: { every: 220, phase: 60 },
};

/**
 * Where the front rows keep clear (spec §3.6): the script's spawn points, pickups, hostages and
 * props (section-a.ts `script`, `life`, the secrets), the pigeons, the window wavers, the baker.
 */
export const A_KEEP_CLEAR: readonly number[] = [
  340, 420, 470, 572, 600, 646, 690, 860, 920, 1078, 1090, 1146, 1250, 1256, 1360, 1460, 1500, 1690, 1968, 2016, 2160, 2246, 2262, 2318,
  2334, 2380, 2470, 2500, 2580, 2730, 2940, 3000, 3080, 3110, 3330, 3400,
];

/** The front rows also keep clear of the player start and the exit door (the front-row check reads both). */
const ROW_CLEAR: readonly number[] = [48, A_W - 12, ...A_KEEP_CLEAR];

/** The hoist crate secret's hook (secrets.ts `AMS_SECRETS.a`) and the beam's height in its gable's art. */
const HOIST: readonly [number, number] = [2500, 76];
const HOIST_BEAM_Y = 71;

/** The bike racks by the front rows (front decor, section-a.ts) and FABEL FRIET's door (the baker). */
const RACKS = [548, 1620, 2860];
const RACK_GAP = 44;
const FABEL_DOOR: readonly [number, number] = [A_FABEL_X + 30, A_FABEL_X + 110];

/** The awning sprites' colour sets as HD ramps (art-hd-ab-street.ts `AWNING_HD`). */
function awningRamps(i: number): [readonly number[], readonly number[]] {
  const [a, b] = AWNING_SETS[i % AWNING_SETS.length];
  return [rampOf(a, PAL_HD.green), b === PAL.snow[3] ? PAL_HD.snow : rampOf(b, PAL_HD.gold)];
}

/** The x of the facade decor whose front spans u (the canopy's back edge then stays on that facade). */
function facadeAt(decor: readonly DecorDef[], u: number): number | undefined {
  for (const d of decor) {
    if (amsDecorDepth(d) !== FACADE || !d.sprite.startsWith('decor/ams/house-')) continue;
    if (Math.abs(d.x - u) < 30) return d.x;
  }
  return undefined;
}

/** The front railing of a bridge as front decor at its deck's near edge (pre-scaled for that depth). */
export function frontRailDecor(b: Bridge): DecorDef {
  const s = sAtDepth({ yh: AMS_CAMERA.yh, yw: G }, b.near);
  return { sprite: ensureFrontRail(b, s), x: b.x0, y: G, front: true, depth: b.near };
}

/** The floor of section a (the section's decor list: the canopies find their facades there). */
export function aFloor(decor: readonly DecorDef[]): FloorDef {
  const L = A_LAYOUT;
  const vAt = (depth: number): number => vAtDepth(CAM, depth);
  for (const b of L.bridges) ensureArchTile(b);
  const quayGaps = [...rowGaps(L, vAt, QUAY_BACK_ROW, [BEND]), ...DRAWBRIDGE_GAPS];
  const quayFrontGaps = [...rowGaps(L, vAt, QUAY_FRONT_ROW, [BEND]), ...DRAWBRIDGE_GAPS, ...RACKS.map((x): [number, number] => [x - RACK_GAP, x + RACK_GAP])];
  const houseGaps = [...rowGaps(L, vAt, HOUSE_BACK_ROW, [BEND]), FABEL_DOOR];
  const houseFrontGaps = [...rowGaps(L, vAt, HOUSE_FRONT_ROW, [BEND]), ...RACKS.map((x): [number, number] => [x - RACK_GAP, x + RACK_GAP])];
  const [lowX, lowY, lowW] = A_LEDGES[0];
  const [upX, upY, upW] = A_LEDGES[1];
  const overhangs: OverhangDef[] = [
    ...A_AWNINGS.map(([x0, y, w], i): OverhangDef => ({
      kind: 'awning',
      x0,
      x1: x0 + w,
      y,
      depth: FACADE,
      tile: ensureCanopyTile(x0, awningRamps(i)),
      anchorX: facadeAt(decor, x0 + w / 2),
    })),
    // The lower gable ledge carries an awning (frame 3), the upper one the balustrade on a stone slab.
    {
      kind: 'awning',
      x0: lowX,
      x1: lowX + lowW,
      y: lowY,
      depth: FACADE,
      tile: ensureCanopyTile(lowX, awningRamps(3)),
      anchorX: facadeAt(decor, lowX + lowW / 2),
    },
    { kind: 'slab', x0: upX, x1: upX + upW, y: upY, depth: FACADE, tile: 'ams/ledge', anchorX: facadeAt(decor, upX + upW / 2) },
    // The hoist beam of the gable whose hook holds the secret crate (secrets.ts, a: x 2500, y 76; the
    // beam in the house art at y 71): the crate is shot at v = 0, so the beam reaches out of the
    // facade to its hook in the walk plane (a 2-px slab: no platform under it, none needed).
    { kind: 'slab', x0: HOIST[0] - 1, x1: HOIST[0] + 1, y: HOIST[1], depth: FACADE, rise: HOIST[1] - HOIST_BEAM_Y, tile: 'ams/beam', anchorX: facadeAt(decor, HOIST[0]) },
  ];
  const tops: TopFaceDef[] = [
    ...A_BOATS.flatMap((b): TopFaceDef[] => [
      { x0: b.x0 + 1, x1: b.x0 + b.w - 1, y: DECK_Y, depth: BOAT_HULL, tile: 'ams/boat-deck' },
      { x0: b.cx - 2, x1: b.cx + b.cw + 2, y: ROOF_Y, depth: BOAT_ROOF, tile: 'ams/boat-roof' },
    ]),
    // FABEL FRIET's counter (front decor in the walk plane, 30 × 18 at the door).
    { x0: A_FABEL_X + 55, x1: A_FABEL_X + 85, y: G - 17, depth: 5, tile: 'ams/counter-top' },
  ];
  // The side faces (spec §11 R1): the house sides at the row ends, the alleys and the steps in height;
  // the houseboats' ends; FABEL FRIET's counter (front decor: 30 × 17 in the walk plane, its top 5 deep).
  const counterL = Math.max(4, Math.ceil(depthPx(0, 5) / 4) * 4);
  const counterTile = (side: -1 | 1): string =>
    ensureBandTile({ key: 'counter', h: 17, l: counterL, side, joint: 0, bands: [[0, PAL_HD.plaster, 5.4], [2, PAL_HD.plaster, 4.2], [15, PAL_HD.wood, 2]] });
  const bridge = drawbridgeFloor(A_DRAWBRIDGE);
  const faces = [
    ...houseSides(decor, { back: AMS_BACK, light: 'morning', depthOf: amsDecorDepth }),
    ...bridge.faces,
    // The hull's art reaches 25 px under the deck (art.ts `houseboatSprite`).
    ...boatSides(A_BOATS, { deckY: DECK_Y, roofY: ROOF_Y, bottom: G - DECK_Y - 25, hull: BOAT_HULL, cabin: BOAT_CABIN }),
    ...[A_BRIDGE_1, A_BRIDGE_2].map((b) => railPostSides(b.x0, b.len, b.near, RAIL_POST_W, RAIL_POST_H)),
    boxSides('fabel counter', A_FABEL_X + 70, -14.5, 14.5, 0, 17, 0, 5, [counterTile(-1), counterTile(1)], counterL, true),
  ];
  return {
    camera: { ...AMS_CAMERA },
    painter: { id: 'ams/floor', params: { layout: L }, seed: 7 },
    features: streetFeatures(L),
    baseFace: 'ams/kerb-face',
    rows: [
      { name: 'bridge 1 back railing', sprite: 'decor/ams/bridge-rail-160x14', depth: A_BRIDGE_1.far, at: [A_BRIDGE_1.x0] },
      { name: 'bridge 2 back railing', sprite: 'decor/ams/bridge-rail-160x14', depth: A_BRIDGE_2.far, at: [A_BRIDGE_2.x0] },
      ...bridge.rows,
      poleRow({ name: 'back poles (quay)', prop: 'ams/pole', depth: QUAY_BACK_ROW, u0: 0, u1: BEND[0], spacing: 34, offset: 10, gaps: quayGaps, skip: 0.08 }),
      poleRow({ name: 'back poles (houses)', prop: 'ams/pole', depth: HOUSE_BACK_ROW, u0: BEND[1], u1: A_W, spacing: 40, offset: 22, gaps: houseGaps, skip: 0.1 }),
      poleRow({ name: 'front poles (quay)', prop: 'ams/pole', depth: QUAY_FRONT_ROW, u0: 0, u1: BEND[0], spacing: 38, offset: 22, gaps: quayFrontGaps, clear: ROW_CLEAR }),
      poleRow({ name: 'front poles (houses)', prop: 'ams/pole', depth: HOUSE_FRONT_ROW, u0: BEND[1], u1: A_W, spacing: 38, offset: 30, gaps: houseFrontGaps, clear: ROW_CLEAR }),
    ],
    overhangs,
    tops,
    faces,
    decorDepth: amsDecorDepth,
    hideDecor: ['decor/ams/water-'],
    shadow: 0.3,
    keepClear: A_KEEP_CLEAR,
  };
}
