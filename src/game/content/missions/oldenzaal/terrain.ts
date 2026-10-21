/**
 * Mission `oldenzaal` terrain and the town's layout numbers (docs/design/oldenzaal.md §2; docs/api
 * /oldenzaal.md "Sections"). Owner: TOWN for oz-a and oz-b (the street, the shop rows, the
 * awnings, balconies and bay roofs as one-way platforms, the low brick walls as cover, the corner
 * of De Smulhoek); wave B owns oz-c, oz-d and oz-e (their placeholders stay below). The decor in
 * the section files (art-layout.ts) is placed from the same numbers, so art and collision agree.
 *
 * Exported for the scripts (INTEGRATE) and the builders: `OZ_A_*` / `OZ_B_*` (the arenas, the
 * wave spots, Mevrouw Winkel's roof, Meneer Wu's door `OZ_B_DOOR_X`, the golden record's ledge).
 */
import { terrain, type TerrainDef } from '../../../mission/index';
import { AWNING_WIDTHS, SHOP_FL, SHOP_GF, shopBayTop, shopGeom, SHOPS } from './art-street';
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

/**
 * The fights of oz-a (INTEGRATE): camera arenas one view wide (384 px) where the possessed come
 * in waves, and the spots they come from.
 * - `first`: the first possessed after the drop (a shambler pair from the right, townspeople
 *   fleeing left).
 * - `middle`: the shopping street's main fight (shamblers, a gunner on the bay roof at 1480, free
 *   souls from the drain at 1732).
 * - `end`: the last fight before the corner (a brute, souls from the chimneys), then the exit.
 */
export const OZ_A_ARENAS = {
  first: [640, 1024],
  middle: [1400, 1784],
  end: [2560, 2944],
} as const;

/** Spots for the waves (world px; y = feet): drains (souls rise), alley mouths (hosts step out), roofs. */
export const OZ_A_SPOTS = {
  /** The cast-iron drains in the gutter (terrain-art `ozDrainAt`, style seed 1): souls rise there. */
  drains: drainXs(OZ_A_W, 1),
  /** The alleys between the fronts (hosts and townspeople come out of them; feet on the street). */
  alleys: alleyXs(OZ_A_ROW_X, OZ_A_ROW),
  /** Chimney tops a few roofs up (free souls come out). */
  chimneys: [
    [1040, 60],
    [1890, 62],
    [2720, 60],
  ] as ReadonlyArray<readonly [number, number]>,
};

/** Mevrouw Winkel's roof at the drop (oz-a, spec §6.1): she stands on this ridge, feet at y. */
export const OZ_A_WINKEL_ROOF: readonly [number, number] = winkelRoof();

/** The exit to oz-b: the street's end (feet in the rect). */
export const OZ_A_EXIT = { x: OZ_A_W - 24, y: 0, w: 24, h: 216 } as const;

export function terrainOzA(): TerrainDef {
  const t = terrain(OZ_A_W, 216);
  t.ground().at(0, G).flat(OZ_A_W);
  for (const [x, y, w] of [...OZ_A_AWNINGS, ...OZ_A_BALCONIES, ...OZ_A_BAYS, OZ_A_LEDGE]) t.platform(x, y, w);
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

/**
 * The fights of oz-b (INTEGRATE): `approach` before the corner (a small group, then the scene at
 * `OZ_B_WU_ARENA`), `square` the short fight on the way to Plechelmusplein.
 */
export const OZ_B_ARENAS = {
  approach: [120, 504],
  square: [1300, 1684],
} as const;

export const OZ_B_SPOTS = {
  drains: drainXs(OZ_B_W, 2),
  alleys: [...alleyXs(OZ_B_ROW_AFTER_X, OZ_B_ROW_AFTER)],
};

/** The exit to oz-c (Plechelmusplein). */
export const OZ_B_EXIT = { x: OZ_B_W - 24, y: 0, w: 24, h: 216 } as const;

export function terrainOzB(): TerrainDef {
  const t = terrain(OZ_B_W, 216);
  t.ground().at(0, G).flat(OZ_B_W);
  for (const [x, y, w] of [...OZ_B_AWNINGS, ...OZ_B_BALCONIES, ...OZ_B_BAYS]) t.platform(x, y, w);
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

/** The ridge of the first three-storey front with an eaves roof in oz-a's opening view. */
function winkelRoof(): readonly [number, number] {
  for (const s of OZ_A_SHOPS) {
    const spec = SHOPS[s.frame];
    if (s.x > 40 && spec.floors === 3 && spec.roof === 'eaves') {
      const top = G - shopGeom(spec).h;
      return [s.x + Math.round(spec.w / 2), top + 4];
    }
  }
  return [260, 52];
}

// ------------------------------------------------------------------------------------ wave B (placeholders)

/** Placeholder sizes of wave B's sections (checkpoints ≤ 1,400 px apart). */
export const OZ_C_W = 768;
export const OZ_D_W = 1152;
/** oz-e: a small vertical placeholder (wave B: about 384 × 1,800). */
export const OZ_E_W = 384;
export const OZ_E_H = 648;
/** oz-e floor (feet y) and the climb's ledges: k = 1 … OZ_E_LEDGES, 36 px apart, alternating. */
export const OZ_E_FLOOR = OZ_E_H - 24;
export const OZ_E_LEDGES = 16;
export const ozELedgeY = (k: number): number => OZ_E_FLOOR - 36 * k;

/** A flat street from x 0 to w (one ground line at G). */
function flatStreet(w: number): TerrainDef {
  const t = terrain(w, 216);
  t.ground().at(0, G).flat(w);
  return t.build();
}

export function terrainOzC(): TerrainDef {
  return flatStreet(OZ_C_W);
}

export function terrainOzD(): TerrainDef {
  return flatStreet(OZ_D_W);
}

/**
 * oz-e: a floor, two walls and a zig-zag of one-way ledges (the m3-b1 staircase rule: every goal
 * more than 20 px up, so the bot climbs it): odd k on the left, even k on the right.
 */
export function terrainOzE(): TerrainDef {
  const t = terrain(OZ_E_W, OZ_E_H);
  t.ground().at(0, OZ_E_FLOOR).flat(OZ_E_W);
  t.solid(0, 0, 24, OZ_E_H, 'stone').solid(OZ_E_W - 24, 0, 24, OZ_E_H, 'stone');
  for (let k = 1; k <= OZ_E_LEDGES; k++) t.platform(k % 2 ? 24 : 184, ozELedgeY(k), 176);
  return t.build();
}
