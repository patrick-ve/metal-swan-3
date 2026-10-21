/**
 * Mission `oldenzaal` terrain and the town's layout numbers (docs/design/oldenzaal.md §2; docs/api
 * /oldenzaal.md "Sections"). Owner: TOWN for oz-a and oz-b (the street, the shop rows, the
 * awnings, balconies and bay roofs as one-way platforms, the low brick walls as cover, the corner
 * of De Smulhoek); wave B owns oz-c, oz-d and oz-e (their placeholders stay below). The decor in
 * the section files (art-layout.ts) is placed from the same numbers, so art and collision agree.
 *
 * Exported for the scripts (INTEGRATE) and the builders: `OZ_A_*` / `OZ_B_*` (the arenas, the
 * wave spots, Mevrouw Winkel's roof, Meneer Wu's door `OZ_B_DOOR_X`, the golden record's ledge).
 *
 * Revision 2 (RUIN, R2-7, spec §3.3): the town after the outbreak, laid out for slow tank fights:
 * wider arenas (`OZ_A_ARENAS` / `OZ_B_ARENAS`, about 1.3–1.5 views, room to back off), abandoned
 * cars whose roofs are one-way platforms (`OZ_A_CARS`, cover and height over the dead), the
 * openings the dead come out of (`OZ_A_OPENINGS` / `OZ_B_OPENINGS`: boarded doors and windows,
 * manholes; ruin/index.ts places them), clear paver spots to rise from (`OZ_A_RISE`, `OZ_B_RISE`)
 * and the far end a column marches in from (`OZ_A_MARCH`, `OZ_B_MARCH`).
 */
import { terrain, type TerrainDef } from '../../../mission/index';
import { OZ_CAR_ROOF } from '../../oldenzaal/ruin/art';
import type { RuinOpeningDef } from '../../oldenzaal/ruin/index';
import { AWNING_WIDTHS, SHOP_DOOR_W, SHOP_FL, SHOP_GF, shopBayTop, shopDoorX, SHOPS, shopWindowX } from './art-street';
import { SMULHOEK_DOOR_X, SMULHOEK_W } from './art-smulhoek';

/** The standard ground line (feet y), as in ams. */
export const G = 176;

/** A platform as [x, y, w] (y = the line the feet stand on). */
export type Plat = readonly [number, number, number];
/** A solid block as [x, y, w, h]. */
export type Block = readonly [number, number, number, number];

/** A row of the street: a shop front (its frame index in `SHOPS`) or a gap (an alley) of w px. */
export type RowItem = number | { readonly gap: number };

/** The shop fronts of a row with their left x (world px). */
export function rowShops(x0: number, items: readonly RowItem[]): Array<{ frame: number; x: number }> {
  const out: Array<{ frame: number; x: number }> = [];
  let x = x0;
  for (const it of items) {
    if (typeof it === 'number') {
      out.push({ frame: it, x });
      x += SHOPS[it].w;
    } else x += it.gap;
  }
  return out;
}

/** The right end of a row. */
export function rowEnd(x0: number, items: readonly RowItem[]): number {
  let x = x0;
  for (const it of items) x += typeof it === 'number' ? SHOPS[it].w : it.gap;
  return x;
}

/** The flat roofs of the bay windows in a row (one-way platforms). */
function bayPlats(shops: ReadonlyArray<{ frame: number; x: number }>): Plat[] {
  const out: Plat[] = [];
  for (const s of shops) {
    const b = shopBayTop(SHOPS[s.frame]);
    if (b) out.push([s.x + b.x0, G - b.up - 1, b.w]);
  }
  return out;
}

/** The awning line over a shop window (feet y): just under the shop sign. */
export const AWNING_Y = G - (SHOP_GF - 14);
/** A balcony's slab line (feet y) on the first floor, and the second floor's. */
export const BALCONY_Y = G - SHOP_GF - 2;
export const LEDGE_Y = BALCONY_Y - SHOP_FL;

/** An awning over a shop front (the widest that fits, centred). */
export function awningOver(s: { frame: number; x: number }): Plat {
  const spec = SHOPS[s.frame];
  let w: number = AWNING_WIDTHS[0];
  for (const aw of AWNING_WIDTHS) if (aw <= spec.w - 8) w = aw;
  return [s.x + Math.round((spec.w - w) / 2), AWNING_Y, w];
}

/** A balcony over a shop front at line y (40 or 32 wide, centred). */
export function balconyOver(s: { frame: number; x: number }, y: number, max = 40): Plat {
  const spec = SHOPS[s.frame];
  const w = max >= 40 && spec.w >= 52 ? 40 : 32;
  return [s.x + Math.round((spec.w - w) / 2), y, w];
}

// ------------------------------------------------------------------------------------ oz-a

/** oz-a: the drop over the roofs and the main shopping street (~1:45). */
export const OZ_A_W = 3072;

/**
 * The street of oz-a, left to right (frame indices of `SHOPS`, gaps are alleys): low fronts at
 * the start (the drop passes their roofs), then the shopping street.
 */
export const OZ_A_ROW: readonly RowItem[] = [
  4, 1, 0, 6, 12, 2, { gap: 28 }, 3, 7, 13, 5, 9, 14, 8, 10, { gap: 36 }, 11, 15, 0, 16, 2, 6, 17, 3, { gap: 24 },
  13, 5, 1, 9, 8, 12, 4, 10, 7, { gap: 30 }, 14, 15, 0, 3, 16, 6, 11, 17, 5, 2, 9, 1, 13, 8, 7,
  { gap: 28 }, 12, 4, 16, 0, 15, 11, 3, 13, 10, 1,
];
export const OZ_A_ROW_X = -12;
export const OZ_A_SHOPS = rowShops(OZ_A_ROW_X, OZ_A_ROW);

/** The shops of oz-a (indices into `OZ_A_SHOPS`) with an awning, and those with a balcony over it. */
export const OZ_A_AWNING_AT: readonly number[] = [3, 9, 17, 22, 32, 40];
export const OZ_A_BALCONY_AT: readonly number[] = [17, 32];
/** Awnings (platforms) over shop windows: [x, y, w] — the decor hangs under each line. */
export const OZ_A_AWNINGS: readonly Plat[] = OZ_A_AWNING_AT.map((k) => awningOver(OZ_A_SHOPS[k]));
/** First-floor balconies (platforms): [x, y, w]. */
export const OZ_A_BALCONIES: readonly Plat[] = OZ_A_BALCONY_AT.map((k) => balconyOver(OZ_A_SHOPS[k], BALCONY_Y));
/** The bay windows' flat roofs (platforms). */
export const OZ_A_BAYS: readonly Plat[] = bayPlats(OZ_A_SHOPS);

/**
 * The golden record's ledge (INTEGRATE places `pickup-gem` kind `golden-record` at
 * `OZ_A_RECORD`): a second-floor balcony over the balcony of shop 32, reached awning → balcony
 * → ledge (28 px steps).
 */
export const OZ_A_LEDGE: Plat = balconyOver(OZ_A_SHOPS[32], LEDGE_Y, 32);
export const OZ_A_RECORD: readonly [number, number] = [OZ_A_LEDGE[0] + 16, LEDGE_Y - 10];

/** Low brick walls (solid cover, 16 px): [x, y, w, h]; flowers on top (decor). */
export const OZ_A_WALLS: readonly Block[] = [
  [860, G - 16, 32, 16],
  [1760, G - 16, 40, 16],
  [2470, G - 16, 32, 16],
];

/** Checkpoints (≤ 1,400 px apart). */
export const OZ_A_CHECKPOINTS: readonly number[] = [1024, 2048];

// ---- revision 2: the abandoned street (RUIN)

/** An abandoned car (decor `decor/oz-ruin/car` frame, left x); its roof is a one-way platform. */
export interface OzCar {
  readonly x: number;
  readonly frame: number;
}

/** The car roofs of a list as platforms. */
export function carRoofs(cars: readonly OzCar[]): Plat[] {
  return cars.map((c) => {
    const r = OZ_CAR_ROOF[c.frame];
    return [c.x + r.x0, G - r.up, r.w] as const;
  });
}

/** A boarded window of the shop at index k of a row (its glass rect). */
function winOf(shops: ReadonlyArray<{ frame: number; x: number }>, k: number): RuinOpeningDef {
  const s = shops[k];
  const w = shopWindowX(SHOPS[s.frame]);
  return { kind: 'window', x: s.x + w.x, y: G, w: w.w };
}

/** The boarded door of the shop at index k of a row. */
function doorOf(shops: ReadonlyArray<{ frame: number; x: number }>, k: number): RuinOpeningDef {
  const s = shops[k];
  return { kind: 'door', x: s.x + shopDoorX(SHOPS[s.frame]), y: G, w: SHOP_DOOR_W };
}

function manhole(x: number): RuinOpeningDef {
  return { kind: 'manhole', x, y: G };
}

/** oz-a's cars: a hatchback (door open) in the first fight, the burned-out car in the middle one, an estate on the way to the end. */
export const OZ_A_CARS: readonly OzCar[] = [
  { x: 760, frame: 0 },
  { x: 1622, frame: 2 },
  { x: 2150, frame: 1 },
];
export const OZ_A_CAR_ROOFS: readonly Plat[] = carRoofs(OZ_A_CARS);

/**
 * The openings of oz-a (ruin/index.ts `placeRuin`; in this order, left to right). Every one is in
 * view of its fight and clear of the walls, the cars and the other decor in front of it.
 * - before the first fight: 0 manhole 300, 1 window x 453 (MUZIEK: the first burst the squad sees)
 * - first fight [600, 1100]: 2 window 669 (IJZERWAREN), 3 door 896 (BAKKERIJ), 4 manhole 1000
 * - middle fight [1380, 1960]: 5 window 1481 (IJZERWAREN), 6 window 1593 (KAPPER), 7 manhole 1720,
 *   8 door 1858 (BAKKERIJ), 9 manhole 1920
 * - on the way: 10 window 2082 (KOFFIE), 11 manhole 2310
 * - end fight [2440, 3040]: 12 manhole 2580, 13 window 2651 (KAPPER), 14 door 2742 (BAKKERIJ),
 *   15 window 2842 (KOFFIE)
 */
export const OZ_A_OPENINGS: readonly RuinOpeningDef[] = [
  manhole(300),
  winOf(OZ_A_SHOPS, 8),
  winOf(OZ_A_SHOPS, 12),
  doorOf(OZ_A_SHOPS, 16),
  manhole(1000),
  winOf(OZ_A_SHOPS, 26),
  winOf(OZ_A_SHOPS, 28),
  manhole(1720),
  doorOf(OZ_A_SHOPS, 33),
  manhole(1920),
  winOf(OZ_A_SHOPS, 37),
  manhole(2310),
  manhole(2580),
  winOf(OZ_A_SHOPS, 47),
  doorOf(OZ_A_SHOPS, 49),
  winOf(OZ_A_SHOPS, 51),
];

/** Clear paver spots of oz-a where the dead rise from the ground (feet on G; ≥ 24 px from every opening, car and wall). */
export const OZ_A_RISE: readonly number[] = [560, 735, 960, 1440, 1560, 1830, 2000, 2390, 2700, 2960];

/** The far end of oz-a: a column marches in from the right, out of the fog (`marchColumn` from 'right'). */
export const OZ_A_MARCH = { from: 'right', x: 3060 } as const;

/**
 * The fights of oz-a (INTEGRATE): camera arenas (revision 2: wider than a view, 500–600 px, so
 * the squad can back off from the slow dead; `lockCamera(a[0], a[1])`), and the spots they come
 * from.
 * - `first`: the first fight after the drop (the shops burst, a rifleman walks in).
 * - `middle`: the shopping street's main fight (a column marches in out of the fog, the MG zombie).
 * - `end`: the last fight before the corner (the big column, the drains open), then the exit.
 */
export const OZ_A_ARENAS = {
  first: [600, 1100],
  middle: [1380, 1960],
  end: [2440, 3040],
} as const;

/** Spots of the street (world px; y = feet): the gutter drains, the alley mouths. */
export const OZ_A_SPOTS = {
  /** The cast-iron drains in the gutter (terrain-art `ozDrainAt`, style seed 1). */
  drains: drainXs(OZ_A_W, 1),
  /** The alleys between the fronts (feet on the street). */
  alleys: alleyXs(OZ_A_ROW_X, OZ_A_ROW),
};

/** The exit to oz-b: the street's end (feet in the rect). */
export const OZ_A_EXIT = { x: OZ_A_W - 24, y: 0, w: 24, h: 216 } as const;

export function terrainOzA(): TerrainDef {
  const t = terrain(OZ_A_W, 216);
  t.ground().at(0, G).flat(OZ_A_W);
  for (const [x, y, w] of [...OZ_A_AWNINGS, ...OZ_A_BALCONIES, ...OZ_A_BAYS, OZ_A_LEDGE, ...OZ_A_CAR_ROOFS]) t.platform(x, y, w);
  for (const [x, y, w, h] of OZ_A_WALLS) t.solid(x, y, w, h);
  return t.build();
}

// ------------------------------------------------------------------------------------ oz-b

/** oz-b: the corner with De Smulhoek, the basilica's tower above the roofs (~1:00). */
export const OZ_B_W = 1792;
/** De Smulhoek's left foot (world x). */
export const OZ_B_SMULHOEK_X = 600;
/** Meneer Wu's spot: De Smulhoek's open door (world x; he stands on the street line G). */
export const OZ_B_DOOR_X = OZ_B_SMULHOEK_X + SMULHOEK_DOOR_X;
/** The Wu scene's camera lock (one view wide, the door near its middle). */
export const OZ_B_WU_ARENA: readonly [number, number] = [OZ_B_DOOR_X - 192, OZ_B_DOOR_X + 192];
/** Where the players stop for the scene (left of the door, facing it). */
export const OZ_B_TALK_X = OZ_B_DOOR_X - 56;

/** The street before De Smulhoek and after it (toward the square). */
export const OZ_B_ROW_BEFORE: readonly RowItem[] = [5, 16, 9, 13, 1, 8, 0, 12, 14, 4, 6, { gap: 18 }];
export const OZ_B_ROW_BEFORE_X = -10;
export const OZ_B_ROW_AFTER: readonly RowItem[] = [{ gap: 34 }, 14, 6, 17, 3, 11, { gap: 40 }, 15, 7, 2, 10, 4, 0, 16, 9, 5, { gap: 30 }, 13, 17, 1, 15, 12];
export const OZ_B_ROW_AFTER_X = OZ_B_SMULHOEK_X + SMULHOEK_W;
export const OZ_B_SHOPS = [...rowShops(OZ_B_ROW_BEFORE_X, OZ_B_ROW_BEFORE), ...rowShops(OZ_B_ROW_AFTER_X, OZ_B_ROW_AFTER)];

export const OZ_B_AWNING_AT: readonly number[] = [3, 10, 15];
export const OZ_B_AWNINGS: readonly Plat[] = OZ_B_AWNING_AT.map((k) => awningOver(OZ_B_SHOPS[k]));
export const OZ_B_BALCONIES: readonly Plat[] = [balconyOver(OZ_B_SHOPS[10], BALCONY_Y)];
export const OZ_B_BAYS: readonly Plat[] = bayPlats(OZ_B_SHOPS);
export const OZ_B_WALLS: readonly Block[] = [
  [380, G - 16, 32, 16],
  [1260, G - 16, 40, 16],
];
export const OZ_B_CHECKPOINTS: readonly number[] = [896];

/** oz-b's cars: an estate on the approach, a hatchback before the square. */
export const OZ_B_CARS: readonly OzCar[] = [
  { x: 212, frame: 1 },
  { x: 1070, frame: 0 },
];
export const OZ_B_CAR_ROOFS: readonly Plat[] = carRoofs(OZ_B_CARS);

/**
 * The fights of oz-b (INTEGRATE): `approach` before the corner (a small group, then the scene at
 * `OZ_B_WU_ARENA`), `square` the fight on the way to Plechelmusplein (revision 2: wider).
 */
export const OZ_B_ARENAS = {
  approach: [80, 520],
  square: [1200, 1768],
} as const;

export const OZ_B_SPOTS = {
  drains: drainXs(OZ_B_W, 2),
  alleys: [...alleyXs(OZ_B_ROW_AFTER_X, OZ_B_ROW_AFTER)],
};

/**
 * The openings of oz-b (none in Meneer Wu's lock [470, 854]: De Smulhoek's corner stays calm):
 * - approach [80, 520]: 0 window 179 (MUZIEK), 1 door 322 (BAKKERIJ), 2 manhole 290
 * - square [1200, 1768]: 3 window 1331 (BAKKERIJ), 4 door 1415 (HOEDEN), 5 manhole 1520,
 *   6 window 1589 (MUZIEK), 7 manhole 1700
 */
export const OZ_B_OPENINGS: readonly RuinOpeningDef[] = [
  winOf(OZ_B_SHOPS, 3),
  doorOf(OZ_B_SHOPS, 6),
  manhole(290),
  winOf(OZ_B_SHOPS, 21),
  doorOf(OZ_B_SHOPS, 22),
  manhole(1520),
  winOf(OZ_B_SHOPS, 25),
  manhole(1700),
];

/** Clear paver spots of oz-b to rise from. */
export const OZ_B_RISE: readonly number[] = [130, 940, 1230, 1460, 1650];

/** The far end of oz-b (toward Plechelmusplein): a column marches in from the right. */
export const OZ_B_MARCH = { from: 'right', x: 1790 } as const;

/** The exit to oz-c (Plechelmusplein). */
export const OZ_B_EXIT = { x: OZ_B_W - 24, y: 0, w: 24, h: 216 } as const;

export function terrainOzB(): TerrainDef {
  const t = terrain(OZ_B_W, 216);
  t.ground().at(0, G).flat(OZ_B_W);
  for (const [x, y, w] of [...OZ_B_AWNINGS, ...OZ_B_BALCONIES, ...OZ_B_BAYS, ...OZ_B_CAR_ROOFS]) t.platform(x, y, w);
  for (const [x, y, w, h] of OZ_B_WALLS) t.solid(x, y, w, h);
  return t.build();
}

// ------------------------------------------------------------------------------------ helpers

/** World x of the drains of a section (terrain-art `ozDrainAt`: every 384 px from 196 + 37·seed). */
function drainXs(w: number, seed: number): number[] {
  const out: number[] = [];
  for (let x = 196 + 37 * seed; x < w; x += 384) out.push(x + 4);
  return out;
}

/** The middle x of every alley (gap) of a row. */
function alleyXs(x0: number, items: readonly RowItem[]): number[] {
  const out: number[] = [];
  let x = x0;
  for (const it of items) {
    if (typeof it === 'number') x += SHOPS[it].w;
    else {
      out.push(Math.round(x + it.gap / 2));
      x += it.gap;
    }
  }
  return out;
}
