/**
 * Section a's shopping street at speed 1 (morning; docs/design/ams2.md §3): the near houses, one sprite
 * per house and no house twice, the shop fronts, the awnings and ledges from `A_AWNINGS` and `A_LEDGES`,
 * FABEL FRIET with its counter and sign. Everything stands on `STREET_FOOT`.
 */
import { addMargin, kitTier, S, text, textW, withKitTier } from '../../../art/herokit/canvas';
import { cornice, quoins, wallBlock } from '../../../art/herokit/masonry';
import { K, R, VARIANTS } from '../../../art/herokit/palette';
import { rngf } from '../../../art/herokit/rng';
import { door, type GableKind, house, window_ } from '../../../art/herokit/walls';
import type { DecorDef } from '../../../mission/index';
import { A_AWNINGS, A_FABEL_X, A_LEDGES, type Plat } from '../ams/terrain';
import { anchoredArt, L } from './art-a-canal';
import { catFrames, waverFrames } from './art-c';
import { defineArt, hitProp } from './stage';

/** The line the near houses stand on: their lowest wall row is one row above it. */
export const STREET_FOOT = 162;
/** Ground floor height. */
const GR = 34;

// -------------------------------------------------------------------------------- what lies in a shop

export type Goods = 'kaas' | 'bloemen' | 'koffie' | 'boeken' | 'fietsen' | 'brood' | 'groente' | 'antiek' | 'tulpen';

function paintGoods(s: S, kind: Goods, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rngf(seed);
  const foot = y + h;
  if (kind === 'kaas') {
    for (let q = x + 1; q < x + w - 8; q += 9) {
      const n = r.int(1, 3);
      for (let j = 0; j < n; j++) {
        const cy = foot - 3 - j * 5;
        s.ell(R.yellow[1], q + 4, cy, 4.5, 2.5);
        s.hl(R.yellow[0], q + 2, cy - 2, 5);
        s.hl(R.yellow[2], q + 1, cy + 2, 7);
        s.px(R.dred[1], q + 7, cy);
      }
    }
  } else if (kind === 'bloemen' || kind === 'tulpen') {
    for (let q = x + 1; q < x + w - 3; q += 4) {
      const hh = r.int(5, Math.max(6, h - 2));
      s.vl(R.leaf[2], q + 1, foot - hh, hh - 3);
      s.rect(R.wood[2], q, foot - 3, 3, 3);
      const c = R[r.pick(kind === 'tulpen' ? ['tulip', 'dred', 'yellow'] : ['tulip', 'yellow', 'cloth', 'dred'])];
      s.rect(c[1], q, foot - hh - 1, 3, 2);
      s.px(c[0], q + 2, foot - hh - 1);
    }
  } else if (kind === 'koffie') {
    s.hl(R.wood[2], x, foot - 1, w);
    for (let q = x + 2; q < x + w - 5; q += 8) {
      s.rect(R.white[0], q, foot - 5, 5, 4);
      s.vl(R.white[2], q, foot - 5, 4);
      s.px(R.white[1], q + 5, foot - 4);
      s.hl(R.brickb[2], q, foot - 5, 4);
    }
    s.rect(R.glow[1], x + (w >> 1) - 1, y + 1, 3, 3);
    s.px(R.glow[0], x + (w >> 1) + 1, y + 1);
  } else if (kind === 'boeken') {
    for (let row = 0; row < Math.max(1, Math.floor(h / 8)); row++) {
      const fy = foot - 1 - row * 8;
      s.hl(R.wood[1], x, fy, w);
      for (let q = x + 1; q < x + w - 1; q += 2) {
        const c = R[r.pick(['dred', 'navy', 'dgreen', 'bricko', 'cloth', 'plastp'])];
        const hh = r.int(4, 7);
        s.rect(c[1], q, fy - hh, 2, hh);
        s.px(c[0], q + 1, fy - hh);
      }
    }
  } else if (kind === 'fietsen') {
    for (let q = x + 5; q < x + w - 5; q += 18) {
      for (const cx of [q, q + 10]) {
        s.ell(R.hull[3], cx, foot - 6, 5, 5);
        s.ell(R.glass[2], cx, foot - 6, 3.5, 3.5);
        s.px(R.pole[1], cx, foot - 6);
      }
      s.line(R.dred[1], q, foot - 6, q + 4, foot - 12);
      s.line(R.dred[1], q + 4, foot - 12, q + 10, foot - 6);
      s.hl(R.dred[0], q + 4, foot - 12, 5);
    }
  } else if (kind === 'brood') {
    s.hl(R.wood[1], x, foot - 1, w);
    s.hl(R.wood[1], x, foot - 8, w);
    for (const fy of [foot - 1, foot - 8]) {
      for (let q = x + 1; q < x + w - 6; q += 7) {
        s.ell(R.bricko[1], q + 3, fy - 2, 3, 2);
        s.hl(R.bricko[0], q + 2, fy - 3, 3);
        s.px(R.bricko[2], q + 1, fy - 1);
      }
    }
  } else if (kind === 'groente') {
    s.rect(R.wood[2], x, foot - 4, w, 4);
    s.hl(R.wood[1], x, foot - 4, w);
    for (let q = x + 1; q < x + w - 3; q += 3) {
      const c = R[r.pick(['dred', 'leaf', 'bricko', 'yellow', 'leaf2'])];
      s.rect(c[1], q, foot - 7, 3, 3);
      s.px(c[0], q + 2, foot - 7);
    }
  } else {
    // Old things: a brass lamp, a clock, a small chest.
    s.rect(R.brass[1], x + 3, foot - 10, 2, 10);
    s.ell(R.brass[1], x + 3.5, foot - 12, 3, 2.5);
    s.px(R.brass[0], x + 5, foot - 13);
    s.ell(R.wood[1], x + (w >> 1), foot - 7, 5, 6);
    s.ell(R.white[0], x + (w >> 1), foot - 8, 3, 3);
    s.vl(R.hull[3], x + (w >> 1), foot - 10, 3);
    s.rect(R.wood[2], x + w - 10, foot - 6, 9, 6);
    s.hl(R.wood[0], x + w - 10, foot - 6, 9);
    s.vl(R.brass[1], x + w - 6, foot - 6, 6);
  }
}

// ------------------------------------------------------------------------------------- a shop front

export interface ShopDef {
  /** The shop's name on its fascia (none under an awning: then it stands on the glass). */
  name: string;
  goods: Goods;
  /** The ramp of the woodwork. */
  col: string;
  /** Rows the awning hides at the top of the ground floor (0: a fascia instead). */
  under?: number;
  /** The door on the left. */
  doorLeft?: boolean;
}

/** A shop front over the width of a house, GR rows high. Hard clusters; the right side catches the light. */
function shopFront(w: number, d: ShopDef, seed: number): S {
  const s = new S(w, GR);
  const [a, b, c, e] = R[d.col];
  const [s0, s1, , s3] = R.stone;
  const [g0, g1, g2, g3] = R.glass;
  const under = d.under ?? 0;
  s.use(1, 1);
  const top = under > 0 ? under : 9;
  // The frame.
  s.rect(b, 0, top - 1, w, GR - top + 1);
  s.vl(c, 0, top - 1, GR - top + 1);
  s.vl(a, w - 1, top - 1, GR - top + 1);
  if (under === 0) {
    // The fascia with the name, gold on the woodwork, a small cornice on it.
    s.rect(b, 0, 0, w, 9);
    s.hl(a, 0, 0, w);
    s.hl(c, 0, 1, w);
    s.hl(e, 0, 8, w);
    s.vl(a, w - 1, 0, 9);
    s.vl(c, 0, 0, 9);
    const nx = (w - textW(d.name)) >> 1;
    text(s, d.name, nx + 1, 3, e);
    text(s, d.name, nx, 2, R.yellow[0]);
  }
  // The door.
  const dw = 11;
  const dx = d.doorLeft ? 3 : w - dw - 3;
  const r = rngf(seed);
  door(s, dx, top, dw, GR - top - 2, d.col, r, 3, 2, 0);
  s.use(4, 1.5);
  // The shop window: glass in one pane or two, the goods behind it.
  const wx0 = d.doorLeft ? dx + dw + 3 : 3;
  const wx1 = d.doorLeft ? w - 3 : dx - 3;
  const wy0 = top + 1;
  const wy1 = GR - 8;
  s.rect(g2, wx0, wy0, wx1 - wx0, wy1 - wy0);
  s.hl(g3, wx0, wy0, wx1 - wx0);
  s.vl(g3, wx0, wy0, wy1 - wy0);
  s.hl(e, wx0, wy0 - 1, wx1 - wx0);
  s.use(5, 1.6);
  // Under an awning the name stands on the glass: the goods stay under it.
  const nameRows = under > 0 ? 9 : 0;
  paintGoods(s, d.goods, wx0 + 1, wy0 + 1 + nameRows, wx1 - wx0 - 2, wy1 - wy0 - 2 - nameRows, seed + 3);
  // One slanted reflection, upper right: over the goods, as on the heroes' visors.
  s.use(6, 1.8);
  const n = Math.min(7, wy1 - wy0 - 2);
  for (let j = 0; j < n; j++) {
    const x = wx1 - 4 - (j >> 1);
    s.px(g0, x, wy0 + 1 + j);
    s.px(g1, x - 1, wy0 + 1 + j);
  }
  // Mullions.
  s.use(7, 1.9);
  const panes = wx1 - wx0 > 30 ? 2 : 1;
  for (let i = 1; i < panes; i++) {
    const q = wx0 + Math.floor(((wx1 - wx0) * i) / panes);
    s.rect(b, q, wy0, 2, wy1 - wy0);
    s.vl(a, q + 1, wy0, wy1 - wy0);
  }
  // The name on the glass, when an awning hides the fascia.
  if (under > 0) {
    s.use(8, 2);
    const nx = wx0 + ((wx1 - wx0 - textW(d.name)) >> 1);
    // Two rows down: the scallops of the awning hang over the top of the glass.
    if (nx >= wx0) text(s, d.name, nx, wy0 + 3, R.yellow[0]);
  }
  // The stall riser with its panels and the stone plinth.
  s.use(9, 2);
  s.rect(b, wx0 - 1, wy1, wx1 - wx0 + 2, 6);
  s.hl(a, wx0 - 1, wy1, wx1 - wx0 + 2);
  for (let q = wx0 + 1; q < wx1 - 6; q += 9) {
    s.rect(c, q, wy1 + 2, 7, 3);
    s.hl(e, q, wy1 + 2, 7);
    s.vl(a, q + 6, wy1 + 2, 3);
  }
  s.use(10, 2.2);
  s.rect(s1, 0, GR - 2, w, 2);
  s.hl(s0, 0, GR - 2, w);
  s.hl(s3, 0, GR - 1, w);
  return s;
}

/** A plain ground floor: a door and a window on the wall. */
function plainGround(w: number, doorm: string, seed: number, doorLeft: boolean): S {
  const s = new S(w, GR);
  const r = rngf(seed);
  const dw = 11;
  const dx = doorLeft ? Math.max(4, Math.floor(w * 0.16)) : w - dw - Math.max(4, Math.floor(w * 0.16));
  door(s, dx, 9, dw, GR - 11, doorm, r, 3, 2, 2);
  const lo = doorLeft ? dx + dw + 3 : 4;
  const hi = doorLeft ? w - 4 : dx - 3;
  const n = Math.max(1, Math.floor((hi - lo + 3) / 17));
  const gap = (hi - lo - n * 14) / (n + 1);
  for (let i = 0; i < n; i++) window_(s, Math.trunc(lo + gap + i * (14 + gap)), 7, 14, 19, r, 10 + i * 2, { z: 3, kind: (seed + i) % 5 });
  const [s0, , s2] = R.stone;
  s.use(30, 2);
  s.hl(s0, 0, 0, w);
  s.hl(s2, 0, 1, w);
  return s;
}

// ------------------------------------------------------------------------------------- a near house

export interface HouseDef {
  key: string;
  /** World x of the wall's left end. */
  x: number;
  w: number;
  st: number;
  mat: string;
  gable: GableKind;
  seed: number;
  sh?: number;
  gh?: number;
  ww?: number;
  wh?: number;
  side?: number;
  door?: string;
  doorLeft?: boolean;
  shop?: ShopDef;
}

function nearHouse(d: HouseDef): S {
  const mat = kitTier() >= 2 ? VARIANTS[d.mat][d.seed % VARIANTS[d.mat].length] : d.mat;
  const o = house(d.w, d.st, mat, d.gable, d.seed, {
    sh: d.sh ?? 27,
    ww: d.ww ?? 13,
    wh: d.wh ?? 18,
    gr: GR,
    gh: d.gh ?? 28,
    side: d.side ?? 0,
    doorm: d.door ?? 'dgreen',
    plastered: d.mat.startsWith('plast'),
    outline: K,
    ground: 'none',
  });
  const ground = d.shop ? shopFront(d.w, d.shop, d.seed) : plainGround(d.w, d.door ?? 'dgreen', d.seed, d.doorLeft ?? d.seed % 2 === 0);
  o.paste(ground, 1, o.h - 1 - GR);
  return o;
}

/** The sprite of a near house. */
function houseArt(d: HouseDef): string {
  return defineArt(L, `a/house-${d.key}`, () => nearHouse(d), { part: `a-${d.key}` });
}

/** A little figure in a window of the street, at speed 1 with its house. */
export const A_WAVER = defineArt(L, 'a/waver', waverFrames, { anchor: 'tl' });
export const A_CAT = defineArt(L, 'a/cat', catFrames, { anchor: 'tl' });

/**
 * A figure in window `n` of a street house: the window from the house's own marks, so it cannot lie off the
 * facade's grid. The figure's 11 × 14 frame stands on the glass's foot.
 */
export function streetWindow(key: string, n: number, sprite: string, ticks: number, frame = 0): DecorDef {
  const d = [...STREET, ...ARRIVAL].find((h) => h.key === key);
  if (!d) throw new Error(`no street house ${key}`);
  const o = withKitTier(1, () => nearHouse(d));
  const m = o.marks.filter((k) => k[0] === 'win')[n];
  if (!m || m[0] !== 'win') throw new Error(`${key}: no window ${n}`);
  return hitProp(sprite, d.x - 1 + m[1] + ((m[3] - 11) >> 1), STREET_FOOT + 1 - o.h + m[2] + m[4] - 15, { animate: ticks, frame });
}

/** The decor of a row: every house at its world x, on the street's foot. */
export function houseRowDecor(row: readonly HouseDef[]): DecorDef[] {
  return row.map((d) => hitProp(houseArt(d), d.x - 1, STREET_FOOT + 1));
}

const mk = (key: string, x: number, w: number, st: number, mat: string, gable: GableKind, seed: number, o: Partial<HouseDef> = {}): HouseDef => ({ key, x, w, st, mat, gable, seed, ...o });

/**
 * The shopping street (1904 … 2596). The numbers that matter: the awning houses cover `A_AWNINGS`; the
 * house at 2288 carries `A_LEDGES` (its storeys 31 high, so that the ledge and the balcony lie between
 * its windows); the wavers of the shared script lean out at (2016, 104) and (2380, 92), the hoist hangs
 * at x 2500.
 */
export const STREET: readonly HouseDef[] = [
  mk('kaas', 1904, 68, 3, 'bricko', 'step', 301, { shop: { name: 'KAAS', goods: 'kaas', col: 'navy', doorLeft: false } }),
  mk('bloemen', 1972, 72, 3, 'plastw', 'neck', 302, { shop: { name: 'BLOEMEN', goods: 'bloemen', col: 'dgreen', under: 15, doorLeft: true } }),
  mk('flat', 2044, 60, 3, 'brickd', 'flat', 303, { door: 'dred', doorLeft: true, ww: 15, wh: 16 }),
  mk('koffie', 2104, 72, 3, 'plastc', 'bell', 304, { shop: { name: 'KOFFIE', goods: 'koffie', col: 'dred', under: 11, doorLeft: false }, ww: 11, wh: 20 }),
  mk('groen', 2176, 52, 2, 'plastg', 'neck', 305, { door: 'navy', gh: 32, ww: 15, wh: 21 }),
  mk('boeken', 2228, 60, 3, 'brickb', 'step', 306, { shop: { name: 'BOEKEN', goods: 'boeken', col: 'navy', under: 9, doorLeft: true }, wh: 16 }),
  mk('ledges', 2288, 72, 3, 'plastp', 'flat', 307, { sh: 31, ww: 15, shop: { name: 'FIETSEN', goods: 'fietsen', col: 'wood', doorLeft: false } }),
  mk('cat', 2360, 52, 3, 'brickr', 'neck', 311, { sh: 31, door: 'dgreen', gh: 24 }),
  mk('spout', 2412, 60, 3, 'plastc', 'spout', 309, { door: 'dred', doorLeft: true, gh: 26, ww: 11, wh: 20 }),
  mk('hoist', 2472, 56, 2, 'brickb', 'neck', 313, { door: 'navy', gh: 34, ww: 15, wh: 20 }),
  mk('bakker', 2528, 60, 3, 'brickr', 'bell', 317, { side: 8, shop: { name: 'BAKKER', goods: 'brood', col: 'wood', doorLeft: true } }),
];

/** Bridge 2 to FABEL FRIET (2764 … 3260). The waver leans out at (3110, 106). */
export const ARRIVAL: readonly HouseDef[] = [
  mk('arr-a', 2764, 66, 3, 'plastw', 'flat', 322, { door: 'navy', ww: 15, wh: 16 }),
  mk('arr-b', 2830, 52, 3, 'plastg', 'bell', 323, { door: 'dred', doorLeft: true, ww: 11 }),
  mk('arr-c', 2882, 72, 2, 'brickb', 'flat', 324, { sh: 30, ww: 15, wh: 20, shop: { name: 'GROENTE', goods: 'groente', col: 'dgreen', doorLeft: true } }),
  mk('arr-d', 2954, 58, 3, 'brickr', 'step', 325, { door: 'dgreen' }),
  mk('arr-e', 3012, 50, 3, 'brickd', 'neck', 326, { door: 'plastc', gh: 30, ww: 15, wh: 16 }),
  mk('arr-f', 3062, 62, 3, 'brickn', 'spout', 327, { door: 'dred', doorLeft: true }),
  mk('arr-g', 3124, 68, 3, 'plastc', 'bell', 328, { shop: { name: 'TULPEN', goods: 'tulpen', col: 'dred', doorLeft: false }, ww: 11, wh: 20 }),
  mk('arr-h', 3192, 68, 3, 'brickd', 'step', 329, { door: 'navy', doorLeft: true, gh: 32, ww: 15 }),
];

/** Behind the neighbour of FABEL FRIET, up to the section's end. */
export const AFTER: readonly HouseDef[] = [
  mk('aft-a', 3422, 56, 3, 'bricko', 'neck', 332, { door: 'navy' }),
  mk('aft-b', 3478, 54, 3, 'plastw', 'bell', 333, { door: 'dgreen', doorLeft: true, ww: 11, wh: 20 }),
  mk('aft-c', 3532, 62, 3, 'brickr', 'step', 334, { door: 'dred', ww: 15 }),
];

/** The blind side wall where a row of houses starts on its left. */
export const ROW_END_LEFT = defineArt(
  L,
  'a/row-end',
  () => {
    const s = new S(16, 118);
    const [a, b, c, d] = R.brickd;
    s.use(1, 1);
    s.rect(b, 0, 8, 16, 110);
    s.vl(c, 0, 8, 110);
    s.vl(c, 1, 8, 110);
    s.vl(a, 15, 8, 110);
    for (let y = 12; y < 110; y += 7) {
      for (let x = 2 + ((y >> 3) & 1) * 3; x < 14; x += 7) s.hl(c, x, y, 4);
      if (y % 3 === 0) s.hl(d, 6, y + 3, 5);
    }
    s.use(2, 2);
    s.poly(R.roof[1], [
      [0, 8],
      [15, 0],
      [15, 8],
    ]);
    s.use(3, 3);
    s.rect(R.stone[1], 0, 114, 16, 4);
    s.hl(R.stone[0], 0, 114, 16);
    s.hl(R.stone[3], 0, 117, 16);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-row-end' },
);

// --------------------------------------------------------------------------------- awnings and ledges

const AWN_H = 9;

function awningCanvas(w: number, c1: string, c2: string): S {
  const s = new S(w, AWN_H + 6);
  const [a, b, d] = R[c1];
  const [e, f, g] = R[c2];
  s.use(1, 2);
  // The cloth: stripes, lit at the top and on the right.
  for (let i = 0; i < w; i++) {
    const odd = Math.floor(i / 6) % 2 === 1;
    const lit = i > w * 0.55;
    const hi = odd ? e : a;
    const mid = odd ? f : b;
    const lo = odd ? g : d;
    s.vl(lit ? hi : mid, i, 0, AWN_H);
    s.px(hi, i, 0);
    s.px(hi, i, 1);
    s.px(lit ? mid : lo, i, AWN_H - 1);
  }
  // The hem: scallops, one per stripe.
  s.use(2, 3);
  for (let i = 0; i < w; i += 6) {
    const odd = Math.floor(i / 6) % 2 === 1;
    const lo = odd ? g : d;
    const mid = odd ? f : b;
    s.rect(mid, i, AWN_H, Math.min(6, w - i), 2);
    s.hl(lo, i + 1, AWN_H + 2, Math.min(4, w - i - 1));
  }
  // Iron arms against the wall.
  s.use(3, 1);
  s.line(R.hull[2], 2, AWN_H, 0, AWN_H + 5);
  s.line(R.hull[2], w - 3, AWN_H, w - 1, AWN_H + 5);
  const o = addMargin(s);
  o.finish(K);
  return o;
}

const AWN_COLOURS: ReadonlyArray<readonly [string, string]> = [
  ['dgreen', 'white'],
  ['dred', 'white'],
  ['navy', 'white'],
];

/** The awnings of the shops: their top row on the platform line of `A_AWNINGS`. */
export const AWNINGS: readonly DecorDef[] = A_AWNINGS.map(([x, y, w]: Plat, i) => {
  const [c1, c2] = AWN_COLOURS[i % AWN_COLOURS.length];
  return hitProp(defineArt(L, `a/awning-${x}`, () => awningCanvas(w, c1, c2), { anchor: 'tl', part: `a-awn-${x}` }), x - 1, y);
});

/** The small awning on the first gable ledge (A_LEDGES[0]). */
export const LEDGE_AWNING: DecorDef = hitProp(
  defineArt(L, 'a/ledge-awning', () => awningCanvas(A_LEDGES[0][2], 'bricko', 'yellow'), { anchor: 'tl', part: 'a-ledge-awn' }),
  A_LEDGES[0][0] - 1,
  A_LEDGES[0][1],
);

/** The balcony of the golden record (A_LEDGES[1]): a stone slab on the platform line, balusters behind the figure. */
const BALCONY = defineArt(
  L,
  'a/balcony',
  () => {
    const [, y, w] = A_LEDGES[1];
    void y;
    const s = new S(w, 24);
    const [s0, s1, s2, s3] = R.stone;
    // The top rail and the balusters.
    s.use(1, 1);
    for (let q = 2; q < w - 2; q += 5) {
      s.rect(s1, q, 3, 3, 10);
      s.vl(s0, q + 2, 3, 10);
      s.vl(s2, q, 3, 10);
      s.px(s3, q + 1, 7);
    }
    s.use(2, 2);
    s.rect(s1, 0, 0, w, 3);
    s.hl(s0, 0, 0, w);
    s.hl(s3, 0, 2, w);
    s.vl(s0, w - 1, 0, 3);
    // The slab, its top row on the platform.
    s.use(3, 3);
    s.rect(s1, 0, 13, w, 4);
    s.hl(s0, 0, 13, w);
    s.hl(s2, 0, 15, w);
    s.hl(s3, 0, 16, w);
    s.vl(s0, w - 1, 13, 3);
    // The brackets.
    s.use(4, 2.5);
    for (const q of [3, w - 9]) {
      s.rect(s1, q, 17, 6, 3);
      s.rect(s2, q + 1, 20, 4, 2);
      s.px(s3, q + 2, 22);
      s.vl(s0, q + 5, 17, 3);
    }
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { anchor: 'tl', part: 'a-balcony' },
);
export const BALCONY_DECOR: DecorDef = hitProp(BALCONY, A_LEDGES[1][0] - 1, A_LEDGES[1][1] - 14);

/** The hoist beam on the gable at 2500 (the shared script's crate hangs from it at y 76). */
const BEAM = defineArt(
  L,
  'a/hoist-beam',
  () => {
    const s = new S(14, 8);
    const [a, b, c, d] = R.bark;
    s.use(1, 1);
    s.rect(b, 0, 0, 14, 4);
    s.hl(a, 0, 0, 14);
    s.vl(a, 13, 0, 4);
    s.vl(c, 0, 0, 4);
    s.hl(d, 0, 3, 14);
    s.use(2, 2);
    s.rect(R.pole[2], 6, 4, 2, 2);
    s.px(R.pole[0], 7, 4);
    s.rect(R.pole[3], 6, 6, 2, 2);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { anchor: 'tl', part: 'a-beam' },
);
export const BEAM_DECOR: DecorDef = hitProp(BEAM, 2493, 67);

// ----------------------------------------------------------------------------------------- FABEL FRIET

/** The width of the FABEL FRIET front and of its neighbour (the same numbers as `ams`). */
const FABEL_W = 96;
const NEIGHBOUR_W = 66;

const HATCH_X = 50;
const HATCH_W = 40;

const FABEL = defineArt(
  L,
  'a/fabel-friet',
  () => {
    const W = FABEL_W;
    const H = 140;
    const s = new S(W, H);
    const r = rngf(3260);
    const shop = 44;
    const wallH = H - shop;
    wallBlock(s, 0, 0, W, wallH, 'brickr', 1, 1, 3261);
    // A roof line and a cornice with a lit top; the corner stones.
    cornice(s, 0, 0, W, 2, 2);
    quoins(s, 0, 3, wallH - 3, 6, 3, 1.5);
    quoins(s, W - 6, 3, wallH - 3, 6, 4, 1.5, true);
    // Two storeys of tall windows.
    for (let j = 0; j < 2; j++) {
      const wy = 10 + j * 42;
      for (let i = 0; i < 3; i++) {
        const wx = 11 + i * 28;
        s.use(10 + i + j * 4, 2.4);
        s.hl(R.stone[0], wx - 2, wy - 3, 19);
        s.hl(R.stone[2], wx - 2, wy - 2, 19);
        window_(s, wx, wy, 15, 26, r, 20 + i * 2 + j * 7, { z: 3, kind: (i + j) % 4 });
      }
    }
    // The name on the wall between the storeys is the hanging sign's job. The shop front: cream wood.
    const top = wallH;
    const [c0, c1, c2, c3] = R.plastc;
    s.use(40, 2);
    s.rect(c1, 0, top, W, shop);
    s.vl(c2, 0, top, shop);
    s.vl(c0, W - 1, top, shop);
    s.hl(c0, 0, top, W);
    s.hl(c3, 0, top + 8, W);
    s.hl(c2, 0, top + 1, W);
    // The fascia: gold letters on navy.
    s.use(41, 2.5);
    s.rect(R.navy[2], 4, top + 2, 44, 6);
    s.hl(R.navy[3], 4, top + 7, 44);
    text(s, 'FABEL', 16, top + 2, R.brass[0]);
    // The window with FRIET.
    const wy = top + 10;
    s.use(42, 2.5);
    s.rect(R.navy[3], 4, wy, 44, 22);
    s.rect(R.navy[2], 5, wy + 1, 42, 20);
    text(s, 'FRIET', 17, wy + 3, R.brass[2]);
    text(s, 'FRIET', 16, wy + 2, R.yellow[0]);
    // A heap of fries in cones in the window.
    s.use(43, 2.7);
    for (let q = 9; q < 44; q += 8) {
      s.poly(R.white[1], [
        [q, wy + 12],
        [q + 6, wy + 12],
        [q + 3, wy + 20],
      ]);
      s.vl(R.dred[1], q + 3, wy + 13, 5);
      for (let n = 0; n < 5; n++) s.vl(R.yellow[n % 2], q + n + 1, wy + 9 + (n % 2), 3);
    }
    s.hl(R.glass[0], 40, wy + 2, 5);
    s.hl(R.glass[1], 39, wy + 3, 5);
    // The hatch the baker stands in: dark inside, a warm lamp, shelves.
    s.use(44, 2.2);
    s.rect(R.hull[3], HATCH_X, top + 3, HATCH_W, shop - 3);
    s.rect(R.brickd[3], HATCH_X + 2, top + 5, HATCH_W - 4, shop - 5);
    s.hl(R.wood[3], HATCH_X, top + 3, HATCH_W);
    s.use(45, 2.4);
    for (const q of [top + 10, top + 19]) {
      s.hl(R.wood[1], HATCH_X + 2, q, HATCH_W - 4);
      s.hl(R.wood[3], HATCH_X + 2, q + 1, HATCH_W - 4);
      for (let x = HATCH_X + 4; x < HATCH_X + HATCH_W - 5; x += 5) {
        const c = R[['dred', 'yellow', 'cloth', 'bricko'][(x + q) % 4]];
        s.rect(c[1], x, q - 4, 3, 4);
        s.px(c[0], x + 2, q - 4);
      }
    }
    s.use(46, 2.6);
    s.rect(R.glow[1], HATCH_X + 18, top + 22, 5, 3);
    s.hl(R.glow[0], HATCH_X + 19, top + 22, 3);
    s.vl(R.hull[1], HATCH_X + 20, top + 12, 10);
    s.use(47, 2.5);
    s.rect(c1, HATCH_X - 2, top + 2, 2, shop - 2);
    s.vl(c2, HATCH_X - 2, top + 2, shop - 2);
    s.rect(c1, HATCH_X + HATCH_W, top + 2, 2, shop - 2);
    s.vl(c0, HATCH_X + HATCH_W + 1, top + 2, shop - 2);
    // The panels under the window.
    s.use(48, 2.5);
    for (let q = 5; q < 44; q += 14) {
      s.rect(c2, q, top + 33, 12, 8);
      s.hl(c3, q, top + 33, 12);
      s.vl(c0, q + 11, top + 33, 8);
    }
    s.use(49, 2.7);
    s.rect(R.stone[1], 0, H - 2, W, 2);
    s.hl(R.stone[0], 0, H - 2, W);
    s.hl(R.stone[3], 0, H - 1, W);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-fabel' },
);

const NEIGHBOUR = defineArt(
  L,
  'a/neighbour',
  () => {
    const W = NEIGHBOUR_W;
    const H = 122;
    const s = new S(W, H);
    const r = rngf(3356);
    const shop = 42;
    const wallH = H - shop;
    wallBlock(s, 0, 0, W, wallH, 'brickb', 1, 1, 3357);
    cornice(s, 0, 0, W, 2, 2);
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) window_(s, 10 + i * 31, 8 + j * 35, 15, 24, r, 10 + i * 2 + j * 5, { z: 3, kind: (i * 2 + j) % 4 });
    }
    const top = wallH;
    const [w0, w1, w2, w3] = R.bricko;
    s.use(40, 2);
    s.rect(w1, 0, top, W, shop);
    s.hl(w0, 0, top, W);
    s.hl(w3, 0, top + 8, W);
    s.vl(w2, 0, top, shop);
    s.vl(w0, W - 1, top, shop);
    text(s, 'ANTIEK', (W - textW('ANTIEK')) >> 1, top + 2, R.hull[3]);
    // Leaded glass: small panes in lead lines.
    const g = R.glass;
    s.use(41, 2.5);
    s.rect(g[2], 4, top + 11, 38, 22);
    paintGoods(s, 'antiek', 6, top + 13, 34, 18, 3357);
    s.use(42, 2.6);
    for (let q = 4; q < 42; q += 6) s.vl(R.hull[2], q, top + 11, 22);
    for (let q = top + 11; q < top + 33; q += 6) s.hl(R.hull[2], 4, q, 38);
    for (let j = 0; j < 8; j++) s.px(g[0], 36 - (j >> 1), top + 12 + j);
    door(s, 47, top + 11, 13, shop - 13, 'brickb', r, 43, 2.5, 0);
    s.use(44, 2.7);
    s.rect(w2, 4, top + 33, 38, 7);
    s.hl(w3, 4, top + 33, 38);
    s.rect(R.stone[1], 0, H - 2, W, 2);
    s.hl(R.stone[0], 0, H - 2, W);
    s.hl(R.stone[3], 0, H - 1, W);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-neighbour' },
);

export const FABEL_DECOR: readonly DecorDef[] = [hitProp(FABEL, A_FABEL_X - 1, STREET_FOOT + 1), hitProp(NEIGHBOUR, A_FABEL_X + FABEL_W - 1, STREET_FOOT + 1)];

/** The oval sign on its iron bracket, 4 frames of a slow swing: x at the wall, y at the bracket (as `ams`: 3346, 87). */
export const FABEL_SIGN = defineArt(
  L,
  'a/fabel-sign',
  () =>
    [0, 1, 2, 1].map((sw) => {
      const s = new S(44, 38);
      // The bracket: a curl of iron from the wall.
      s.use(1, 1);
      const [i0, i1] = R.hull;
      s.rect(i1, 2, 1, 38, 2);
      s.hl(i0, 2, 1, 38);
      s.line(i1, 4, 3, 12, 8);
      s.ell(i1, 7, 7, 3, 3);
      s.ell(R.brickr[1], 7, 7, 1.4, 1.4);
      s.vl(i1, 2, 1, 10);
      // The sign: it swings by a pixel or two, in hard frames.
      const cx = 22 + sw - 1;
      s.use(2, 2);
      s.vl(i1, cx - 8, 3, 4);
      s.vl(i1, cx + 8, 3, 4);
      s.ell(R.brass[1], cx, 20, 17, 14);
      s.ell(R.hull[3], cx, 20, 15, 12);
      s.ell(R.navy[3], cx, 20, 14, 11);
      s.use(3, 3);
      text(s, 'FABEL', cx - 9, 13, R.brass[0]);
      text(s, 'FRIET', cx - 9, 21, R.yellow[0]);
      s.hl(R.brass[1], cx - 7, 19, 15);
      s.hl(R.brass[0], cx + 6, 8, 5);
      s.px(R.brass[0], cx + 14, 13);
      s.px(R.brass[0], cx + 15, 14);
      s.px(R.brass[2], cx - 15, 26);
      const o = addMargin(s);
      o.finish(K);
      return o;
    }),
  { anchor: 'tl', ticksPerFrame: 24, part: 'a-fabel-sign' },
);

/** The counter in front of the baker: 32 × 20, bottom centre (as `ams`: x 3330 on the ground line). */
export const FABEL_COUNTER = anchoredArt(
  'a/fabel-counter',
  () => {
    const s = new S(32, 20);
    const [c0, c1, c2, c3] = R.plastc;
    s.use(1, 1);
    s.rect(c1, 0, 5, 32, 15);
    s.vl(c2, 0, 5, 15);
    s.vl(c2, 1, 5, 15);
    s.vl(c0, 31, 5, 15);
    s.hl(c3, 0, 19, 32);
    s.use(2, 1.5);
    s.rect(R.navy[2], 3, 8, 26, 9);
    s.hl(R.navy[3], 3, 8, 26);
    s.vl(R.navy[1], 28, 8, 9);
    s.use(3, 2);
    text(s, 'FRIET', 6, 10, R.yellow[0]);
    // The top: wood, a tray of cones, a bottle.
    s.use(4, 3);
    s.rect(R.wood[1], 0, 3, 32, 3);
    s.hl(R.wood[0], 0, 3, 32);
    s.hl(R.wood[3], 0, 5, 32);
    s.use(5, 3.5);
    for (const q of [4, 10]) {
      s.rect(R.white[0], q, 0, 4, 3);
      s.hl(R.yellow[0], q, 0, 4);
      s.vl(R.dred[1], q + 1, 1, 2);
    }
    s.rect(R.dred[1], 24, 0, 2, 3);
    s.px(R.dred[0], 25, 0);
    s.rect(R.yellow[1], 27, 0, 2, 3);
    s.px(R.yellow[0], 28, 0);
    const o = addMargin(s);
    o.finish(K);
    return [o];
  },
  17,
  22,
);
