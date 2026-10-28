/**
 * The floor of `ams` c1 BRUG (docs/design/floor.md §4.4, §12.2 c1) — AMS-RIVER's folder (with c2).
 *
 * | u | stretch |
 * |---|---|
 * | 0–60 | the west quay: the approach ramp rises in a strip between low quay walls (the walk profile's slope), the quays on both sides at pavement height, poles on the far one |
 * | 60–760 | the white bridge (bridge.ts): its plank deck a raised strip over the Amstel (the far edge a little behind the quay's far kerb, the near edge just in front of the walk line), white railings back and front with their posts' sides, the gallows: each portal at the walk line and a second one on the far edge |
 * | 760–860 | the ramp down to the quay (a face group: plank top, near face) |
 * | 860–1004 | the quay: the lane from the ramp's foot, swerving round a pavement bulb (868–992) where the lamp with the sleeping gull (920), the bomb crate (940) and the pigeons (960) stand; the near pavement's bike rack |
 * | 1004 | kerb crossing lane → cobbles (§4.2) |
 * | 1020–1220 | the Blauwbrug: the hump (16) in cobbles over a canal running in depth (its arch on the deck's near face), a narrow pavement along each parapet, the green iron railings back and front, its crowned lamps on the far parapet's ends, the front railing's end posts with their sides |
 * | 1220–1388 | Waterlooplein: cobbles, the far pavement widening (kerb 17 → 8) into the market's square behind a row of poles, three stalls as boxes at the back, the flag |
 *
 * Physics is untouched (spec §0.1): the bridge deck and its ramp are the terrain's platforms over the
 * river's gap, the Blauwbrug its hill; this file says how they look. Street logic (spec §11 R2, §12.1
 * item 2): the white bridge is a pedestrian deck (the script's sack tourist stands on it at the walk
 * line), so it is a free surface (its planks a tile, bridge.ts `DECK_TOP`); the lane and the cobbles are kept free —
 * what the script keeps in the walk plane on the quay stands on the bulb.
 *
 * The tour boats on the Amstel stay flat (no entity faces): they sail along the bridge in front of its
 * near face, and their bodies would reach under the deck, where a face drawn under every entity would
 * cover the deck (an entity's faces cannot be hidden by the floor in front of them).
 */
import type { FloorDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { bridgeRailSprite } from '../../art';
import { C_AMSTEL, C_BLAUWBRUG, C1_W, G } from '../../terrain';
import { amsDecorDepth, QUAY_PAVEMENT } from '../depth';
import { amsEntityFaces } from '../entities';
import { floorOnly, kitDecor, kitFloor } from '../guard';
import {
  AMS_CAMERA,
  archTileId,
  BULB_FAR,
  BULB_FRONT_DECOR,
  BULB_NEAR_QUAY,
  KERB_H,
  QUAY_BACK_ROW,
  QUAY_FAR,
  QUAY_FRONT_ROW,
  QUAY_NEAR,
  poleRow,
  rowGaps,
  streetFeatures,
  vAtAms,
  WATER_LEVEL,
  withBulbs,
  type Bridge,
  type Bulb,
  type StreetLayout,
} from '../layout';
import { RAIL_POST_H, RAIL_POST_W } from '../props';
import { frontRailDecor } from '../section-a';
import { railPostSides } from '../sides';
import { ensureArchTile, riverSurface } from '../tiles';
import { C1_DECK_FAR, C1_DECK_H, C1_DECK_NEAR, C1_RAMP, DECK_FACE, DECK_TOP, ensureBridgeTiles, ensureWhiteRail, railPostFaces, rampFaces } from './bridge';
import { stallFaces } from './market';

export { C1_DECK_FAR, C1_DECK_H, C1_DECK_NEAR, C1_RAMP, ensureWhiteRail, WHITE_RAIL_H } from './bridge';
export { stallFaces } from './market';

/** The switch: c1 draws its floor (wave B, AMS-RIVER). */
export const C1_FLOOR_ON = true;

const [BB_X, BB_LEN, BB_H] = C_BLAUWBRUG;

/**
 * The Blauwbrug: a hump over a canal running in depth (its arch on the deck's near face). Its deck is a
 * little wider than the quay's street: the cobbled roadway between the kerb lines, a narrow pavement on
 * each side along the parapets (the railings stand there, off the roadway).
 */
export const C1_BLAUWBRUG: Bridge = { x0: BB_X, len: BB_LEN, h: BB_H, water: [BB_X + 24, BB_X + BB_LEN - 24], far: QUAY_FAR + 2.5, near: QUAY_NEAR - 3.7 };

/** The kerb crossing lane → cobbles before the Blauwbrug. */
export const C1_CROSSING = 1004;
/** Waterlooplein's far kerb (the market's square behind it) and where it bends there from the quay's. */
export const C1_MARKET_FAR = 8;
const MARKET_BEND: readonly [number, number] = [BB_X + BB_LEN, BB_X + BB_LEN + 32];
/** The market stalls at the back: [x, frame, depth] (the section's own stall at 1290 and two more; the first behind the quay's kerb). */
export const C1_STALLS: readonly (readonly [number, number, number])[] = [
  [1232, 1, 20],
  [1290, 0, 15],
  [1352, 2, 15],
];
export const C1_STALL_DEPTH = 15;

/**
 * The pavement bulb on the quay (spec §11 R2): the lamp with the sleeping gull (920), the bomb crate
 * (940, 24 px wide) and the pigeons (960) stand on the widened far pavement; the lane swerves in front
 * of it (its near kerb gives way); from the ramp's foot the near kerb bends out from the deck's line.
 */
export const C1_BULB: Bulb = {
  u0: 868,
  u3: 992,
  far: [
    [868, QUAY_FAR],
    [900, BULB_FAR],
    [960, BULB_FAR],
    [992, QUAY_FAR],
  ],
  near: [
    [868, C1_DECK_NEAR],
    [900, BULB_NEAR_QUAY],
    [960, BULB_NEAR_QUAY],
    [992, QUAY_NEAR],
  ],
};

/** The street layout of c1. */
export const C1_LAYOUT: StreetLayout = {
  light: 'golden',
  far: withBulbs(
    [
      [MARKET_BEND[0], QUAY_FAR],
      [MARKET_BEND[1], C1_MARKET_FAR],
    ],
    [C1_BULB],
    'far',
  ),
  // The near kerb: the deck's near edge up to the ramp's foot (the approach and the bridge), then the quay's.
  near: withBulbs(
    [
      [C_AMSTEL[1], C1_DECK_NEAR],
      [C_AMSTEL[1] + 32, QUAY_NEAR],
    ],
    [C1_BULB],
    'near',
  ),
  bulbs: [C1_BULB],
  street: [
    { u0: -1e9, kind: 'klinkers' },
    // The white bridge's deck (a pedestrian deck: free; painted in planks by the area below).
    { u0: C_AMSTEL[0], kind: 'tiles' },
    { u0: C_AMSTEL[1], kind: 'lane' },
    { u0: C1_CROSSING, kind: 'cobbles' },
  ],
  crossings: [{ u: C1_CROSSING, dir: 1 }],
  quays: [[-1e9, MARKET_BEND[0]]],
  bridges: [],
  canals: [],
  bikes: { every: 220, phase: 60 },
  areas: [{ u0: C_AMSTEL[0], u1: C_AMSTEL[1], far: C1_DECK_FAR + 0.5, near: C1_DECK_NEAR - 0.5, kind: 'planks' }],
};

/** Where the front rows keep clear (the script's spots on the quay: the perched gull's lamp, the crate, the pigeons, the last gulls). */
export const C1_KEEP_CLEAR: readonly number[] = [920, 940, 960, 1210];

/** The bike rack on the near pavement along the bulb (front decor) and the front row's gap round it. */
const RACK_X = 912;
const RACK_GAP = 44;

/** The back railing's depth (on the deck, just inside its far edge). */
const RAIL_DEPTH = C1_DECK_FAR - 0.4;
/** The white bridge's railing pieces (u of each piece's left end): 128-px spans, then the span with the ramp. */
const RAIL_SPANS = [60, 188, 316, 444, 572];
const RAIL_RAMP_AT = 700;
const RAIL_SPAN = ensureWhiteRailIds();

function ensureWhiteRailIds(): { flat: string; ramp: string } {
  return { flat: ensureWhiteRail(128), ramp: ensureWhiteRail(160, 100, C1_DECK_H - 4) };
}

/** The gallows' portals (the section's white-portal decor). */
const PORTALS = [300, 520];

/** Where c1's decor stands in depth on the floor (spec §1.3; `DecorDef.depth` wins). */
export function c1DecorDepth(d: DecorDef): number | null | undefined {
  const s = d.sprite;
  // The 2D bridge span, the Blauwbrug's lamps and front face, the crown's flag and the front bollards: replaced.
  if (s === 'decor/ams/white-bridge' || s === 'decor/ams/blauwbrug-lamp' || s === 'decor/ams/bollard') return null;
  if (s === 'decor/ams/flag-ams' && d.y !== G) return null;
  if (s === 'decor/ams/market-stall') return C1_STALL_DEPTH;
  if (s === 'decor/ams/flag-nl') return 27;
  return amsDecorDepth(d);
}

/** The FloorDef of c1 (`decor`: the section's decor list). */
export function c1FloorDef(decor: readonly DecorDef[]): FloorDef {
  void decor;
  const L = C1_LAYOUT;
  const BB = C1_BLAUWBRUG;
  ensureBridgeTiles();
  ensureArchTile(BB);
  const amstel = riverSurface('golden');
  const [w0, w1] = BB.water;
  const bbGap: [number, number] = [BB.x0 - 12, BB.x0 + BB.len + 12];
  const backGaps = [...rowGaps(L, vAtAms, QUAY_BACK_ROW, []), bbGap, [C_AMSTEL[1] - 12, C_AMSTEL[1] + 24] as [number, number]];
  const frontGaps = [...rowGaps(L, vAtAms, QUAY_FRONT_ROW, []), bbGap, [RACK_X - RACK_GAP, RACK_X + RACK_GAP] as [number, number]];
  return {
    camera: { ...AMS_CAMERA },
    painter: { id: 'ams/floor', params: { layout: L }, seed: 17 },
    features: [
      ...streetFeatures(L),
      // The west quay beside the approach ramp, at pavement height (the ramp rises between them).
      { kind: 'cut', u1: C_AMSTEL[0], to: C1_DECK_FAR, level: KERB_H, face: 'ams/quay-wall' },
      { kind: 'cut', u1: C_AMSTEL[0], from: C1_DECK_NEAR, level: KERB_H, face: 'ams/quay-wall' },
      // The Amstel over the whole band, the white bridge's deck over it (a level over the gap).
      { kind: 'cut', u0: C_AMSTEL[0], u1: C_AMSTEL[1], level: WATER_LEVEL, surface: amstel, face: 'ams/quay-wall' },
      { kind: 'cut', u0: C_AMSTEL[0], u1: C1_RAMP[0], from: C1_DECK_FAR, to: C1_DECK_NEAR, level: C1_DECK_H, surface: DECK_TOP, face: DECK_FACE },
      // The Blauwbrug (streetFeatures' bridge, with the cobbled street on its deck): the abutment quays,
      // the canal under it in depth, the deck on the hump with the arch on its near face.
      { kind: 'cut', u0: BB.x0, u1: BB.x0 + BB.len, to: BB.far, level: KERB_H, face: 'ams/quay-wall' },
      { kind: 'cut', u0: BB.x0, u1: BB.x0 + BB.len, from: BB.near, level: KERB_H, face: 'ams/quay-wall' },
      { kind: 'cut', u0: w0, u1: w1, to: BB.far, level: WATER_LEVEL, surface: amstel, face: 'ams/quay-wall' },
      { kind: 'cut', u0: w0, u1: w1, from: BB.near, level: WATER_LEVEL, surface: amstel, face: 'ams/quay-wall' },
      { kind: 'deck', u0: BB.x0, u1: BB.x0 + BB.len, from: BB.far, to: BB.near, face: archTileId(BB) },
    ],
    baseFace: 'ams/kerb-face',
    rows: [
      // The white bridge: the far railing (the row scales it) and the far portals of the gallows.
      { name: 'white bridge back railing', sprite: RAIL_SPAN.flat, depth: RAIL_DEPTH, at: RAIL_SPANS },
      { name: 'white bridge back railing (ramp)', sprite: RAIL_SPAN.ramp, depth: RAIL_DEPTH, at: [RAIL_RAMP_AT] },
      { name: 'gallows (far portals)', sprite: 'decor/ams/white-portal', depth: RAIL_DEPTH, at: PORTALS },
      // The Blauwbrug: its crowned lamps on the far parapet's ends, the far railing on the hump.
      { name: 'Blauwbrug lamps', sprite: 'decor/ams/blauwbrug-lamp', depth: BB.far + 1.6, at: [BB.x0 + 6, BB.x0 + BB.len - 6] },
      { name: 'Blauwbrug back railing', sprite: bridgeRailSprite(BB.len, BB.h), depth: BB.far, at: [BB.x0] },
      poleRow({ name: 'back poles (west quay)', prop: 'ams/pole', depth: QUAY_BACK_ROW, u0: 0, u1: C_AMSTEL[0] - 8, spacing: 22, offset: 4 }),
      poleRow({ name: 'back poles', prop: 'ams/pole', depth: QUAY_BACK_ROW, u0: C_AMSTEL[1], u1: MARKET_BEND[0], spacing: 34, offset: 10, gaps: backGaps }),
      // The market's kerb: posts keep the traffic off the square (the stalls stand behind them).
      poleRow({ name: 'market kerb poles', prop: 'ams/pole', depth: C1_MARKET_FAR + 1, u0: MARKET_BEND[1] + 6, u1: C1_W, spacing: 30, offset: 0 }),
      poleRow({ name: 'front poles', prop: 'ams/pole', depth: QUAY_FRONT_ROW, u0: C_AMSTEL[1], u1: C1_W, spacing: 38, offset: 26, gaps: frontGaps, clear: [C1_W - 16, ...C1_KEEP_CLEAR] }),
    ],
    faces: [
      rampFaces(),
      // The white railings' posts with their sides and caps, back (the row's) and front (the decor's).
      ...RAIL_SPANS.flatMap((x) => [railPostFaces(x, 128, 0, 0, RAIL_DEPTH, false), railPostFaces(x, 128, 0, 0, 0, true)]),
      railPostFaces(RAIL_RAMP_AT, 160, 100, C1_DECK_H - 4, RAIL_DEPTH, false),
      railPostFaces(RAIL_RAMP_AT, 160, 100, C1_DECK_H - 4, 0, true),
      railPostSides(BB.x0, BB.len, BB.near, RAIL_POST_W, RAIL_POST_H),
      ...C1_STALLS.map(([x, f, d]) => stallFaces(x, d, f)),
    ],
    // The bomb crate on the bulb shows its lid and sides (spec §12.1 item 4).
    entityFaces: amsEntityFaces(['crate']),
    decorDepth: c1DecorDepth,
    hideDecor: ['decor/ams/water-'],
    shadow: 0.3,
    keepClear: C1_KEEP_CLEAR,
  };
}

/** The section's `floor`: the def while the switch is on, else none (fail soft: a kit that throws gives none, logged). */
export function c1Floor(decor: readonly DecorDef[]): FloorDef | undefined {
  return C1_FLOOR_ON ? kitFloor('ams/c1', () => c1FloorDef(decor)) : undefined;
}

/**
 * Decor only the floor draws: the white bridge's front railing (legs only), the Blauwbrug's front railing,
 * the market's two more stalls, the quays' furniture on their far pavements, the bike rack; the sprites
 * only rows draw, hidden (so the section's art list makes their dense art).
 */
export function c1FloorDecor(): DecorDef[] {
  return C1_FLOOR_ON
    ? kitDecor('ams/c1', () =>
        floorOnly([
          ...RAIL_SPANS.map((x): DecorDef => ({ sprite: RAIL_SPAN.flat, x, y: G - C1_DECK_H, front: true, depth: 0 })),
          { sprite: RAIL_SPAN.ramp, x: RAIL_RAMP_AT, y: G - C1_DECK_H, front: true, depth: 0 },
          frontRailDecor(C1_BLAUWBRUG),
          { sprite: bridgeRailSprite(C1_BLAUWBRUG.len, C1_BLAUWBRUG.h), x: C1_BLAUWBRUG.x0, y: G, depth: null },
          // The market's other stalls (the section's own stands at 1290).
          { sprite: 'decor/ams/market-stall', frame: 1, x: C1_STALLS[0][0], y: G, depth: C1_STALLS[0][2] },
          { sprite: 'decor/ams/market-stall', frame: 2, x: C1_STALLS[2][0], y: G, depth: C1_STALLS[2][2] },
          // The city's flag by the crossing (the 2D one stood on the Blauwbrug's crown).
          { sprite: 'decor/ams/flag-ams', x: 996, y: G, animate: true, depth: 26 },
          // The quays' furniture.
          { sprite: 'decor/ams/lamp', x: 18, y: G, depth: 21 },
          { sprite: 'decor/ams/bench', x: -36, y: G, depth: 25 },
          { sprite: 'decor/ams/elm', x: 880, y: G, depth: 27 },
          { sprite: 'decor/ams/bench', x: 940, y: G, depth: 25 },
          { sprite: 'decor/ams/tulips', x: 972, y: G, animate: true, depth: QUAY_PAVEMENT },
          // A parked bike on the market's square at a kerb post (not behind the Blauwbrug: its canal runs there).
          { sprite: 'decor/ams/bike', frame: 1, x: 1262, y: G, depth: C1_MARKET_FAR + 3 },
          { sprite: 'decor/ams/bike-rack', x: RACK_X, y: G, front: true, depth: BULB_FRONT_DECOR },
        ]),
      )
    : [];
}
