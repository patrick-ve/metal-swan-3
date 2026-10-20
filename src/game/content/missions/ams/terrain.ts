/**
 * Mission `ams` terrain (docs/design/amsterdam.md §6): ground lines, bridges (ground hills), canal
 * water hazards (surface y 180), houseboat decks and cabin roofs, the shopping-street awnings, the
 * Rijksmuseum passage ceiling, the fork of section c (the bridge ramp, the jetty steps and the
 * pontoon), the white Amstel bridge (c1) and the river of the canal cruise (c2). The decor in the section files is
 * placed from the same numbers.
 */
import { terrain, type TerrainDef } from '../../../mission/index';
import { G, WATER_Y } from './art';

export { G, WATER_Y };

/** A houseboat: hull x0…x0+w (deck platform at y 164), the cabin cx…cx+cw (roof platform at y 146). */
export interface Houseboat {
  x0: number;
  w: number;
  cx: number;
  cw: number;
  colour: number;
}
export const DECK_Y = 164;
export const ROOF_Y = 146;

/** A platform as [x, y, w]. */
export type Plat = readonly [number, number, number];

function addBoats(t: ReturnType<typeof terrain>, boats: readonly Houseboat[]): void {
  for (const b of boats) {
    t.platform(b.x0, DECK_Y, b.w);
    t.platform(b.cx, ROOF_Y, b.cw);
  }
}

// ------------------------------------------------------------------------------------ a

export const A_W = 3584;
/** Bridges as [x0, len, height]. */
export const A_BRIDGES: readonly (readonly [number, number, number])[] = [
  [720, 160, 14],
  [2600, 160, 14],
];
/** The side canal under the raised drawbridge. */
export const A_CANAL: readonly [number, number] = [1060, 1340];
export const A_BOATS: readonly Houseboat[] = [
  { x0: 1094, w: 82, cx: 1108, cw: 54, colour: 0 },
  { x0: 1212, w: 104, cx: 1226, cw: 58, colour: 2 },
];
/** Shopping-street awnings and the gable ledges up to the golden record (~x 2334, y 66). */
export const A_AWNINGS: readonly Plat[] = [
  [1980, 132, 56],
  [2110, 128, 60],
  [2230, 126, 56],
];
export const A_LEDGES: readonly Plat[] = [
  [2296, 96, 30],
  [2316, 66, 36],
];
export const A_FABEL_X = 3260;
/** The beer bike's lock on the shopping street (the first hijack), just before bridge 2. */
export const A_BIKE_LOCK: readonly [number, number] = [2120, 2504];
export const A_ARENA: readonly [number, number] = [3200, 3584];

export function terrainA(): TerrainDef {
  const t = terrain(A_W, 216);
  t.ground()
    .at(0, G)
    .flat(720)
    .hill(160, 14)
    .flat(A_CANAL[0] - 880)
    .gap(A_CANAL[1] - A_CANAL[0])
    .flat(2600 - A_CANAL[1])
    .hill(160, 14)
    .flat(A_W - 2760);
  t.hazard('water', A_CANAL[0], WATER_Y, A_CANAL[1] - A_CANAL[0], 216 - WATER_Y);
  addBoats(t, A_BOATS);
  for (const [x, y, w] of [...A_AWNINGS, ...A_LEDGES]) t.platform(x, y, w);
  return t.build();
}

// ------------------------------------------------------------------------------------ b

export const B_W = 3072;
/** The cycle passage through the Rijksmuseum and its solid ceiling (bottom at y 96). */
export const B_PASSAGE: readonly [number, number] = [400, 720];
export const B_CEILING_Y = 96;
export const B_HOTDOG_X = 960;

export function terrainB(): TerrainDef {
  const t = terrain(B_W, 216);
  t.ground().at(0, G).flat(B_W);
  t.solid(B_PASSAGE[0], B_CEILING_Y - 12, B_PASSAGE[1] - B_PASSAGE[0], 12, 'brick');
  return t.build();
}

// ------------------------------------------------------------------------------------ c

/**
 * Section c AMSTEL (docs/design/ams-extras.md §4): the quay street, the canal with six
 * houseboats, the shop quay with the scan car arena at its end, then the fork: the white bridge's
 * ramp UP (exit `brug` → c1) and the jetty steps DOWN to the tour-boat pontoon (exit `rondvaart` → c2).
 */
export const C_W = 2608;
export const C_CANAL: readonly [number, number] = [600, 1400];
export const C_BOATS: readonly Houseboat[] = [
  { x0: 636, w: 80, cx: 650, cw: 52, colour: 1 },
  { x0: 752, w: 92, cx: 770, cw: 56, colour: 3 },
  { x0: 880, w: 84, cx: 892, cw: 60, colour: 0 },
  { x0: 1000, w: 96, cx: 1018, cw: 60, colour: 2 },
  { x0: 1132, w: 80, cx: 1144, cw: 52, colour: 1 },
  { x0: 1248, w: 112, cx: 1262, cw: 72, colour: 3 },
];
/** The scan car arena on the shop quay: the camera lock (one view wide). */
export const C_ARENA: readonly [number, number] = [1984, 2368];
/** The white bridge's ramp (BRUG ↑): a one-way slope from its foot (8 px over the quay) up to the deck. */
export const C_RAMP: readonly [number, number] = [2400, 2460];
export const C_RAMP_FOOT_Y = 168;
/** The white bridge deck over the jetty basin (the same height as c1's deck). */
export const C_DECK_Y = 152;
/** The jetty steps (RONDVAART ↓): two 6-px steps down from the quay to the pontoon. */
export const C_STEPS_X = 2448;
export const C_STEP = 16;
/** The pontoon (a one-way platform) over the jetty basin, and the basin's water line. */
export const C_PONTOON_Y = 188;
export const C_BASIN: readonly [number, number] = [C_STEPS_X + 2 * C_STEP, C_W];
export const C_BASIN_Y = 192;

export function terrainC(): TerrainDef {
  const t = terrain(C_W, 216);
  t.ground()
    .at(0, G)
    .flat(C_CANAL[0])
    .gap(C_CANAL[1] - C_CANAL[0])
    .flat(C_STEPS_X - C_CANAL[1])
    .step(6)
    .flat(C_STEP)
    .step(C_PONTOON_Y - G - 6)
    .flat(C_STEP);
  t.hazard('water', C_CANAL[0], WATER_Y, C_CANAL[1] - C_CANAL[0], 216 - WATER_Y);
  t.hazard('water', C_BASIN[0], C_BASIN_Y, C_BASIN[1] - C_BASIN[0], 216 - C_BASIN_Y);
  addBoats(t, C_BOATS);
  t.platforms().at(C_RAMP[0], C_RAMP_FOOT_Y).slope(C_RAMP[1] - C_RAMP[0], C_DECK_Y - C_RAMP_FOOT_Y).flat(C_W - C_RAMP[1]);
  t.platform(C_BASIN[0], C_PONTOON_Y, C_BASIN[1] - C_BASIN[0]);
  return t.build();
}

// ------------------------------------------------------------------------------------ c1

/**
 * Section c1 BRUG: the white wooden Amstel bridge and the Blauwbrug to Waterlooplein (the old
 * section c from x 1940, re-based to 0: old x − 1940).
 */
export const C1_W = 1388;
/** The Amstel under the white bridge (also the water piece widths of art-hd-terrain-water.ts). */
export const C_AMSTEL: readonly [number, number] = [60, 860];
/** The white wooden bridge deck over the Amstel (then its ramp down to the quay at 860, y 172). */
export const C_BRIDGE_Y = 152;
export const C_BRIDGE_END = 760;
export const C_BLAUWBRUG: readonly [number, number, number] = [1020, 200, 16];

export function terrainC1(): TerrainDef {
  const t = terrain(C1_W, 216);
  t.ground().at(0, G).slope(C_AMSTEL[0], C_BRIDGE_Y - G);
  t.ground()
    .at(C_AMSTEL[1], 172)
    .slope(40, G - 172)
    .flat(C_BLAUWBRUG[0] - C_AMSTEL[1] - 40)
    .hill(C_BLAUWBRUG[1], C_BLAUWBRUG[2])
    .flat(C1_W - C_BLAUWBRUG[0] - C_BLAUWBRUG[1]);
  t.hazard('water', C_AMSTEL[0], WATER_Y, C_AMSTEL[1] - C_AMSTEL[0], 216 - WATER_Y);
  t.platforms().at(C_AMSTEL[0], C_BRIDGE_Y).flat(C_BRIDGE_END - C_AMSTEL[0]).slope(C_AMSTEL[1] - C_BRIDGE_END, 172 - C_BRIDGE_Y);
  return t.build();
}

// ------------------------------------------------------------------------------------ c2

/**
 * Section c2 RONDVAART: the canal cruise on the Amstel. The boarding quay (0–60), the river
 * (deep water 60–2492: the cruise boat, the low bridges, the Magere Brug) and the Waterlooplein
 * jetty (2492–2632). Every bridge and the boat are entities (cruise.ts): the terrain is the two
 * quays and the water.
 */
export const C2_W = 2632;
export const C2_RIVER: readonly [number, number] = [60, 2492];
/**
 * The houseboat moored at the far quay (its tourist is the c2 hostage): drawn higher up the
 * screen (farther away), deck y 134 and cabin roof y 116 are one-way platforms. The 96-px boat
 * with the 60-px cabin in colour 2 (the same art as C_BOATS[3]).
 */
export const C2_FAR_ROOF_Y = 116;
export const C2_HOUSEBOAT: Houseboat = { x0: 1110, w: 96, cx: 1128, cw: 60, colour: 2 };

export function terrainC2(): TerrainDef {
  const t = terrain(C2_W, 216);
  t.ground().at(0, G).flat(C2_RIVER[0]).gap(C2_RIVER[1] - C2_RIVER[0]).flat(C2_W - C2_RIVER[1]);
  t.hazard('water', C2_RIVER[0], WATER_Y, C2_RIVER[1] - C2_RIVER[0], 216 - WATER_Y);
  const b = C2_HOUSEBOAT;
  t.platform(b.x0, C2_FAR_ROOF_Y + DECK_Y - ROOF_Y, b.w);
  t.platform(b.cx, C2_FAR_ROOF_Y, b.cw);
  return t.build();
}

// ------------------------------------------------------------------------------------ d

export const D_W = 1280;
export const D_ARENA: readonly [number, number] = [896, 1280];

export function terrainD(): TerrainDef {
  const t = terrain(D_W, 216);
  t.ground().at(0, G).flat(D_W);
  return t.build();
}
