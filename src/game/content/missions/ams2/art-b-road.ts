/**
 * The canal-side road of section b (noon): the row of houses and shops at speed 1 (the window wavers of
 * the shared script need their walls where they are), the canal along the near kerb, a moored sloop.
 */
import { addMargin, S, text, textW } from '../../../art/herokit/canvas';
import { range } from '../../../art/herokit/canvas-math';
import { KM, K, R } from '../../../art/herokit/palette';
import { rngf } from '../../../art/herokit/rng';
import { door, house, type GableKind, window_ } from '../../../art/herokit/walls';
import { waterBand } from '../../../art/herokit/water';
import { kitTier } from '../../../art/herokit/canvas';
import { VARIANTS } from '../../../art/herokit/palette';
import { type Band, B0, B1, B2, defineArt, defineBand, S_NEAR, S_WALK, VH, WATER_TPF } from './stage';

const L = 'noon';
/** The row's left edge in world x (the section's canal road starts at 2200), and its width. */
export const ROAD_X = 2184;
export const ROAD_W = 912;
const FOOT = B0;
/** Window size at this plane. */
const WW = 14;
const WH = 20;

type Goods = 'books' | 'cheese' | 'coffee' | 'flowers' | 'bikes' | 'clocks';
interface HouseSpec {
  x: number;
  w: number;
  st: number;
  sh: number;
  gr: number;
  gh: number;
  mat: string;
  gable: GableKind;
  seed: number;
  /** The ground floor: a door, or a shop. */
  shop?: { label: string; goods: Goods; cloth: string; frame: string; labelX?: number };
  door?: string;
  side?: number;
}

/**
 * The row. Lower storey's window top (world) = 151 − sh − gr. The house at x 112 has a window column at
 * the waver of x 2330 with its top at 81; the one at x 482 at the cat of x 2700 with its top at 73.
 */
const ROW: readonly HouseSpec[] = [
  { x: 0, w: 62, st: 2, sh: 29, gr: 40, gh: 24, mat: 'brickb', gable: 'step', seed: 4004, shop: { label: 'BOEKEN', goods: 'books', cloth: 'dgreen', frame: 'dgreen' }, side: 0 },
  { x: 62, w: 50, st: 3, sh: 26, gr: 36, gh: 22, mat: 'plastw', gable: 'spout', seed: 4015, door: 'navy' },
  { x: 112, w: 66, st: 3, sh: 30, gr: 40, gh: 24, mat: 'brickr', gable: 'neck', seed: 4021, door: 'dgreen' },
  { x: 178, w: 48, st: 2, sh: 30, gr: 38, gh: 26, mat: 'plastc', gable: 'bell', seed: 4037, door: 'dred' },
  { x: 226, w: 76, st: 2, sh: 28, gr: 42, gh: 10, mat: 'brickd', gable: 'flat', seed: 4042, shop: { label: 'KAAS', goods: 'cheese', cloth: 'bricko', frame: 'navy' } },
  { x: 302, w: 44, st: 3, sh: 25, gr: 34, gh: 24, mat: 'plastg', gable: 'step', seed: 4050, door: 'dred' },
  { x: 346, w: 58, st: 2, sh: 32, gr: 40, gh: 28, mat: 'bricko', gable: 'neck', seed: 4065, door: 'navy' },
  { x: 404, w: 78, st: 3, sh: 26, gr: 42, gh: 24, mat: 'brickn', gable: 'bell', seed: 4073, shop: { label: 'KOFFIE', goods: 'coffee', cloth: 'dred', frame: 'bark', labelX: 46 } },
  { x: 482, w: 66, st: 2, sh: 32, gr: 46, gh: 26, mat: 'brickr', gable: 'step', seed: 4083, door: 'dgreen' },
  { x: 548, w: 50, st: 3, sh: 25, gr: 36, gh: 22, mat: 'plastp', gable: 'spout', seed: 4097, door: 'navy' },
  { x: 598, w: 72, st: 2, sh: 30, gr: 42, gh: 26, mat: 'plastw', gable: 'bell', seed: 4109, shop: { label: 'BLOEMEN', goods: 'flowers', cloth: 'tulip', frame: 'iron' } },
  { x: 670, w: 46, st: 3, sh: 27, gr: 36, gh: 10, mat: 'brickb', gable: 'flat', seed: 4114, door: 'dgreen' },
  { x: 716, w: 64, st: 2, sh: 31, gr: 40, gh: 28, mat: 'plastc', gable: 'neck', seed: 4129, shop: { label: 'FIETSEN', goods: 'bikes', cloth: 'blue', frame: 'navy' } },
  { x: 780, w: 56, st: 3, sh: 26, gr: 38, gh: 24, mat: 'brickd', gable: 'step', seed: 4138, door: 'dred' },
  { x: 836, w: 76, st: 2, sh: 29, gr: 42, gh: 24, mat: 'brickr', gable: 'bell', seed: 4142, shop: { label: 'KLOKKEN', goods: 'clocks', cloth: 'navy', frame: 'bark' } },
];

/** What lies in a shop window: small hard clusters, each kind its own. */
function goods(s: S, kind: Goods, x: number, y: number, w: number, h: number): void {
  const r = rngf(x * 13 + y);
  if (kind === 'books') {
    let q = x;
    const cols = ['dred', 'navy', 'bricko', 'dgreen', 'white', 'plastp'];
    for (const row of [y + 2, y + h - 9]) {
      q = x;
      while (q < x + w - 2) {
        const c = R[r.pick(cols)];
        const bw = r.int(2, 4);
        const bh = r.int(5, 8);
        s.rect(c[1], q, row + 8 - bh, bw, bh);
        s.vl(c[0], q + bw - 1, row + 8 - bh, bh);
        q += bw;
      }
      s.hl(R.wood[3], x, row + 8, w);
    }
  } else if (kind === 'cheese') {
    for (const [dx, wy, c] of [
      [2, h - 6, 'yellow'],
      [12, h - 6, 'bricko'],
      [22, h - 6, 'yellow'],
      [7, h - 11, 'yellow'],
      [17, h - 11, 'yellow'],
      [12, h - 16, 'bricko'],
    ] as const) {
      if (dx + 9 > w) continue;
      s.ell(R[c][1], x + dx + 4, y + wy, 5, 3);
      s.hl(R[c][0], x + dx + 2, y + wy - 2, 5);
      s.hl(R[c][2], x + dx + 1, y + wy + 2, 7);
    }
  } else if (kind === 'coffee') {
    for (const dx of range(1, w - 8, 10)) {
      s.rect(R.brickb[1], x + dx, y + h - 11, 8, 10);
      s.hl(R.brickb[0], x + dx + 1, y + h - 12, 6);
      s.vl(R.brickb[2], x + dx, y + h - 11, 10);
      s.rect(R.white[0], x + dx + 2, y + h - 8, 4, 3);
    }
    s.ell(R.white[0], x + (w >> 1), y + 5, 4, 3);
    s.vl(R.white[1], x + (w >> 1) + 5, y + 3, 3);
    s.hl(R.brickb[2], x + (w >> 1) - 2, y + 3, 5);
  } else if (kind === 'flowers') {
    for (const dx of range(0, w - 4, 5)) {
      const c = R[['tulip', 'yellow', 'dred', 'plastp', 'white'][r.int(0, 5)]];
      const yy = y + h - r.int(10, 15);
      s.rect(R.leaf[2], x + dx, yy + 4, 4, h - (yy + 4 - y));
      s.px(c[0], x + dx + 1, yy);
      s.px(c[1], x + dx + 2, yy + 1);
      s.px(c[1], x + dx, yy + 2);
      s.px(c[2] ?? c[1], x + dx + 3, yy + 3);
    }
  } else if (kind === 'bikes') {
    for (const dx of range(2, w - 18, 20)) {
      s.ell(R.hull[3], x + dx + 3, y + h - 5, 4, 4);
      s.ell(R.glass[2], x + dx + 3, y + h - 5, 2, 2);
      s.ell(R.hull[3], x + dx + 14, y + h - 5, 4, 4);
      s.ell(R.glass[2], x + dx + 14, y + h - 5, 2, 2);
      s.line(R.dred[1], x + dx + 3, y + h - 5, x + dx + 8, y + h - 12);
      s.line(R.dred[1], x + dx + 8, y + h - 12, x + dx + 14, y + h - 5);
      s.hl(R.dred[0], x + dx + 8, y + h - 12, 5);
    }
  } else {
    for (const dx of range(2, w - 8, 13)) {
      const cy = y + 6 + (dx % 2) * 6;
      s.ell(R.wood[2], x + dx + 4, cy, 5, 5);
      s.ell(R.white[0], x + dx + 4, cy, 3, 3);
      s.vl(K, x + dx + 4, cy - 2, 2);
      s.px(K, x + dx + 5, cy);
      s.vl(R.wood[3], x + dx + 4, cy + 5, h - (cy + 5 - y) - 1);
    }
    s.hl(R.wood[3], x, y + h - 1, w);
  }
}

/** A shop front: fascia with a name, a striped awning, the shop window, a door. */
function shopFront(w: number, gr: number, spec: NonNullable<HouseSpec['shop']>, seed: number): S {
  const s = new S(w, gr + 4);
  const f = R[spec.frame];
  const cl = R[spec.cloth];
  const fascia = 9;
  s.use(1, 1);
  s.rect(f[2], 0, 0, w, gr);
  s.hl(f[0], 0, 0, w);
  s.hl(f[1], 0, 1, w);
  s.hl(f[3], 0, fascia, w);
  s.vl(f[1], w - 1, 0, gr);
  s.vl(f[3], 0, 0, gr);
  // The name.
  s.use(2, 2);
  text(s, spec.label, spec.labelX ?? (w - textW(spec.label)) >> 1, 3, R.xw[0]);
  // The window and the door.
  const dw = 13;
  const dx = seed % 2 ? 4 : w - dw - 4;
  const wx = seed % 2 ? dx + dw + 3 : 4;
  const ww = w - dw - 11;
  const wy = fascia + 8;
  const wh = gr - wy - 6;
  s.use(3, 2);
  s.rect(R.glass[3], wx, wy, ww, wh);
  s.use(4, 3);
  goods(s, spec.goods, wx + 1, wy + 1, ww - 2, wh - 1);
  s.use(5, 3.5);
  s.hl(R.glass[1], wx, wy, ww);
  s.line(R.glass[0], wx + ww - 7, wy + 1, wx + ww - 11, wy + 6);
  s.line(R.glass[0], wx + ww - 5, wy + 1, wx + ww - 8, wy + 5);
  s.use(6, 4);
  s.rect(f[0], wx - 1, wy + wh, ww + 2, 2);
  s.hl(f[3], wx - 1, wy + wh + 1, ww + 2);
  s.vl(f[0], wx + ww, wy, wh);
  s.vl(f[2], wx - 1, wy, wh);
  s.use(7, 3);
  s.rect(f[1], dx, fascia + 6, dw, gr - fascia - 6);
  s.vl(f[0], dx + dw - 1, fascia + 6, gr - fascia - 6);
  s.vl(f[3], dx, fascia + 6, gr - fascia - 6);
  s.rect(R.glass[2], dx + 3, fascia + 9, dw - 6, 11);
  s.hl(R.glass[1], dx + 3, fascia + 9, dw - 6);
  s.px(R.brass[0], dx + dw - 3, fascia + 15 + 6);
  s.use(8, 2);
  s.rect(R.stone[1], dx - 2, gr - 2, dw + 4, 3);
  s.hl(R.stone[0], dx - 2, gr - 2, dw + 4);
  s.hl(R.stone[3], dx - 2, gr, dw + 4);
  // The awning.
  s.use(9, 5);
  const ay = fascia + 1;
  for (let i = 0; i < w; i += 8) {
    const c = (i >> 3) % 2 ? R.cloth : cl;
    s.rect(c[1] ?? c[0], i, ay, 8, 5);
    s.hl(c[0], i, ay, 8);
    s.vl(c[0], i + 7, ay, 5);
    s.rect(c[1] ?? c[0], i + 1, ay + 5, 6, 1);
    s.hl(c[2] ?? c[1], i + 1, ay + 6, 6);
  }
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** A door with a stoop and a window beside it; lower half of a house, drawn over the bare wall. */
function homeFront(w: number, gr: number, mat: string, seed: number): S {
  const s = new S(w, gr);
  const r = rngf(seed);
  const dh = Math.min(gr - 8, 28);
  const dw = 13;
  const dx = seed % 2 ? 5 : w - dw - 6;
  door(s, dx, gr - dh - 3, dw, dh, mat, r, 1, 3, 3);
  // A fanlight over the door.
  s.use(2, 3.2);
  s.rect(R.glass[2], dx, gr - dh - 3, dw, 4);
  s.hl(R.glass[1], dx, gr - dh - 3, dw);
  s.vl(R.white[1], dx + (dw >> 1), gr - dh - 3, 4);
  s.hl(R.white[1], dx, gr - dh + 1, dw);
  // Stone steps.
  s.use(3, 4);
  s.rect(R.stone[1], dx - 2, gr - 3, dw + 4, 3);
  s.hl(R.stone[0], dx - 2, gr - 3, dw + 4);
  s.hl(R.stone[3], dx - 2, gr - 1, dw + 4);
  const wx = seed % 2 ? dx + dw + 5 : dx - 5 - WW;
  if (wx >= 3 && wx + WW <= w - 3) window_(s, wx, gr - 28, WW, 20, r, 4, { z: 3 });
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

function paintRoad(): S {
  const s = new S(ROAD_W, VH);
  for (const h of ROW) {
    const mat = kitTier() >= 2 ? VARIANTS[h.mat][h.seed % VARIANTS[h.mat].length] : h.mat;
    const o = house(h.w, h.st, mat, h.gable, h.seed, {
      sh: h.sh,
      ww: WW,
      wh: WH,
      gr: h.gr,
      gh: h.gh,
      side: h.side ?? 0,
      plastered: h.mat.startsWith('plast'),
      ground: 'none',
    });
    s.paste(o, h.x - 1, FOOT - o.h + 1);
    if (h.shop) {
      const f = shopFront(h.w - 2, h.gr, h.shop, h.seed);
      s.paste(f, h.x, FOOT - h.gr - 1);
    } else {
      const f = homeFront(h.w - 2, h.gr, h.door ?? 'dgreen', h.seed);
      s.paste(f, h.x, FOOT - h.gr);
    }
  }
  return s;
}

export const ROAD: Band = defineBand({ light: L, name: 'b/road-row', speed: S_WALK, rows: [0, FOOT + 1], width: ROAD_W, paint: paintRoad });

// ---------------------------------------------------------------------------------- the canal

const CANAL_W = 512;
const CANAL_Y = B2 + 5;

/** The canal along the near kerb, a tile. */
export const NEAR_CANAL: Band = defineBand({
  light: L,
  name: 'b/near-canal',
  speed: S_NEAR,
  rows: [CANAL_Y, VH],
  width: CANAL_W,
  anim: 3,
  tpf: WATER_TPF.near,
  paint: () => [0, 1, 2].map((f) => waterBand(CANAL_W, CANAL_Y, VH, null, 183, f)),
});

/** Where the near pavement ends and the canal starts: the end of the quay wall. */
export const QUAY_END = defineArt(L, 'b/quay-end', () => {
  const s = new S(14, VH - CANAL_Y);
  const [a, b, c, d] = R.stone;
  s.use(1, 1);
  s.rect(b, 0, 0, 14, s.h);
  s.vl(a, 13, 0, s.h);
  s.vl(c, 12, 0, s.h);
  for (const y of range(4, s.h, 6)) {
    s.hl(d, 0, y, 13);
    s.hl(a, 0, y + 1, 12);
  }
  return s;
});

/** A sloop moored at the quay, seen from above the kerb. */
export const SLOOP = defineArt(
  L,
  'b/sloop',
  () => {
    const s = new S(78, 26);
    s.use(1, 1);
    const b = R.navy;
    s.poly(b[1], [
      [0, 6],
      [76, 6],
      [70, 26],
      [6, 26],
    ]);
    s.hl(b[0], 0, 6, 77);
    s.hl(R.white[0], 2, 8, 72);
    s.hl(b[2], 4, 12, 68);
    s.use(2, 2);
    const w = R.wood;
    s.rect(w[1], 8, 2, 60, 4);
    s.hl(w[0], 8, 2, 60);
    s.hl(w[3], 8, 5, 60);
    for (const q of range(12, 66, 11)) s.vl(w[2], q, 2, 4);
    s.use(3, 3);
    s.rect(R.dred[1], 26, 0, 18, 3);
    s.hl(R.dred[0], 26, 0, 18);
    s.use(4, 3);
    s.rect(R.cloth[0], 50, 0, 8, 2);
    const o = addMargin(s);
    o.finish();
    return o;
  },
  { anchor: 'tl', bob: [0, 1, 0, 0] },
);

/** The stones across the road where the plein's gravel ends and the road's cobbles start. */
export const ROAD_SEAM = defineArt(L, 'b/road-seam', () => {
  const H = B2 - B1;
  const s = new S(9, H);
  const [a, b, c, d] = R.kerb;
  s.use(1, 1);
  s.rect(b, 0, 0, 9, H);
  s.vl(a, 7, 0, H);
  s.vl(c, 1, 0, H);
  s.vl(d, 0, 0, H);
  s.vl(d, 8, 0, H);
  for (const y of range(3, H, 6)) s.hl(d, 0, y, 9);
  for (const y of range(4, H, 6)) s.hl(a, 2, y, 5);
  return s;
});
