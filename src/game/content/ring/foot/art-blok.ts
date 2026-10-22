/**
 * The blockade's own art for `rf-b` DE BLOKKADE (docs/design/ring.md §R.6, §R.9; docs/ART_GUIDE.md
 * "UHD art"): ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× / 4×), every frame
 * cropped to its 1× box. Static playfield decor: outline C (never hit, never moving through the
 * play). Our own lettering (art-blok-letters.ts), never mirrored; the parody name EXHAUSTING
 * REBELLION is the user's; OUR mark is a round-bellied hourglass with a smoke puff rising from its
 * top — NEVER inside a circle or a ring (never the real movement's circled hourglass, fonts or
 * colours as a set).
 *
 * | id | frames | what |
 * |---|---|---|
 * | `ring/foot/blok/spandoek` | 3 | the big spandoek between two poles (anchor: the feet line under its middle): the mark, `EXHAUSTING REBELLION` in brush letters, `WIJ ZIJN MOE. NU JULLIE OOK.`; the cloth billows (3 wind frames) |
 * | `ring/foot/blok/banner` | 4 | small cloth banners on two sticks, one per `BANNERS` text (anchor: the feet line under the middle) |
 * | `ring/foot/blok/placard` | 4 | cardboard placards on a stick, one per `BANNERS` text in marker (anchor: the stick's foot) |
 * | `ring/foot/blok/barrel` | 3 | oil drums painted by the activists: sky with a daisy, orange with waves, green with a chain wrapped round (anchor: the feet; a solid of `BARREL` size in the layout) |
 * | `ring/foot/blok/chain` | 1 | a chain hanging between two barrels (anchor: its left end) |
 * | `ring/foot/blok/picnic` | 1 | the lunch table: a checked cloth (blue), the pot of ORANGE tomato soup, a thermos, sandwiches, a camping chair (anchor: the feet line under the middle) |
 * | `ring/foot/blok/crowd` | 2 | a row of activists sitting arm in arm on the far lanes (anchor: the feet line under the middle) |
 */
import type { Frame } from '../../../../engine/render';
import { INK } from '../../../../engine/palette';
import type { TexSample } from '../../../art/hd/canvas';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { defStrip, frac, hash2, Pen } from '../boss/art-kit';
import { mat, type Dn } from '../../stag/kit.art';
import { BOLD, faceHit, faceWidth, SMALL, twoLines } from './art-blok-letters';
import { BANNERS, SPANDOEK } from './lines';

export const BLOK_SPR = {
  spandoek: 'ring/foot/blok/spandoek',
  banner: 'ring/foot/blok/banner',
  placard: 'ring/foot/blok/placard',
  barrel: 'ring/foot/blok/barrel',
  chain: 'ring/foot/blok/chain',
  picnic: 'ring/foot/blok/picnic',
  crowd: 'ring/foot/blok/crowd',
} as const;

/** The barrel's size (a solid in the layout). */
export const BARREL = { w: 14, h: 20 } as const;
/** The chain's span (between two barrels' middles). */
export const CHAIN_W = 24;

/** Outline C (static playfield decor). */
function finishC(p: Pen, ao = 0.2): Frame {
  return p.frame(p.c.render({ outline: 'C', ink: INK, ao, rimLight: p.d === 1 ? 0 : 1 }));
}

/** A hand-painted edge wobble (2× / 4× only). */
const wob = (x: number, y: number, k: number, d: number): number => (d === 1 ? 0 : (hash2(Math.floor(x * 2) + k, Math.floor(y * 2) - k) - 0.5) * 0.5);

// ---------------------------------------------------------------------------------------------
// The spandoek
// ---------------------------------------------------------------------------------------------

export const SPANDOEK_SIZE = { w: 176, h: 52, poles: 76 } as const;

/** The mark (local to its box: top-left (mx, my), 22 × 42): 0 none, 1 glass / bars, 2 sand, 3 smoke. */
export function markHit(x: number, y: number, mx: number, my: number): 0 | 1 | 2 | 3 {
  const u = x - mx;
  const v = y - my;
  // The smoke puff rising from the top (three round puffs drifting up and right).
  const puffs: ReadonlyArray<readonly [number, number, number]> = [
    [11, 9.5, 3.2],
    [14.5, 5.5, 3.4],
    [11.5, 1.8, 2.4],
  ];
  for (const [px, py, pr] of puffs) if (Math.hypot(u - px, v - py) < pr) return 3;
  // The bars at the top and the bottom.
  const top = 13;
  const bot = 41;
  if (v >= top && v < top + 2.2 && u >= 3 && u <= 19) return 1;
  if (v > bot - 2.2 && v <= bot && u >= 3 && u <= 19) return 1;
  // Two round bulbs joined at the waist (an outline of 1.6 px), sand in the lower one.
  const cx = 11;
  const c1 = top + 7.4;
  const c2 = bot - 7.4;
  const r = 6.6;
  const d1 = Math.hypot(u - cx, v - c1);
  const d2 = Math.hypot(u - cx, v - c2);
  const waist = Math.abs(v - (c1 + c2) / 2) < 3 && Math.abs(u - cx) < 1.6 + Math.abs(v - (c1 + c2) / 2) * 0.5;
  const inside = d1 < r || d2 < r || waist;
  const inner = d1 < r - 1.6 || d2 < r - 1.6 || (Math.abs(v - (c1 + c2) / 2) < 3 && Math.abs(u - cx) < 0.4 + Math.abs(v - (c1 + c2) / 2) * 0.35);
  if (inside && !inner) return 1;
  if (inner && d2 < r - 1.6 && v > c2 - 1) return 2;
  if (inner && Math.abs(u - cx) < 0.5 && v > (c1 + c2) / 2 - 2) return 2;
  return 0;
}

export function spandoekFrame(f: number, d: Dn): Frame {
  const { w: W, h: H, poles } = SPANDOEK_SIZE;
  const p = new Pen(-W / 2 - 6, -poles - 4, W + 12, poles + 5, d);
  const c = p.c;
  const cloth = mat(c, 'cloth', { spec: 0.05, shine: 12, lo1: 1, hi1: 3, lo: 2, hi: 6, wrap: 0.35, dither: 0.3 });
  const paint = mat(c, 'black', { spec: 0.3, shine: 20, lo1: 0, hi1: 1, lo: 0, hi: 3 });
  const navy = mat(c, 'navy', { spec: 0.2, shine: 18, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const sand = mat(c, 'gold', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const smoke = mat(c, 'stone', { spec: 0, lo1: 1, hi1: 3, lo: 2, hi: 6, wrap: 0.4 });
  const wood = mat(c, 'wood', { spec: 0.4, shine: 26, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const rope = mat(c, 'sand', { spec: 0.1, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const x0 = -W / 2;
  const y0 = -poles + 2;
  // The poles (stuck in sandbags at the foot).
  for (const px of [x0 - 2, x0 + W + 2]) {
    p.capsule(px, 0, px, -poles - 2, 1.3, 1.1, { mat: wood, z: 1, tex: (t) => void (t.tone += (hash2(Math.floor(t.u * 40), Math.floor(t.v * 3 * d)) - 0.5) * 0.2) });
    p.ellipsoid(px, -2, 5, 2.6, { mat: rope, z: 1.4 });
  }
  // The cloth: sagging a little along the top and the bottom, billowing (frame f), folds.
  const sagT = (x: number): number => Math.sin(((x - x0) / W) * Math.PI) * 2.2;
  const sagB = (x: number): number => Math.sin(((x - x0) / W) * Math.PI) * (2.6 + f * 0.6) + Math.sin((x - x0) * 0.21 + f * 1.7) * 0.6;
  const fold = (x: number): number => Math.sin((x - x0) * 0.12 + f * 2.1) * 0.8 + Math.sin((x - x0) * 0.043 - f) * 0.6;
  // The layout on the cloth: the mark at the left, the title in two lines, the sub line under it.
  const mx = x0 + 7;
  const my = y0 + 3;
  const tw1 = faceWidth(BOLD, 'EXHAUSTING', 2, 1);
  const tx = x0 + 36 + (W - 36 - 6 - tw1) / 2;
  const t1y = y0 + 6;
  const t2y = t1y + 17;
  const subW = faceWidth(SMALL, SPANDOEK.sub, 1, 1);
  const subX = x0 + 36 + (W - 36 - 6 - subW) / 2;
  const subY = y0 + 41;
  const [l1, l2] = ['EXHAUSTING', 'REBELLION'];
  if (`${l1} ${l2}` !== SPANDOEK.title) throw new Error('spandoek: the title changed (lines.ts SPANDOEK.title)');
  const l2x = tx + (tw1 - faceWidth(BOLD, l2, 2, 1)) / 2;
  p.field(x0, y0 - 1, W, H + 6, (x, y) => {
    if (y < y0 + sagT(x) || y > y0 + H + sagB(x)) return NaN;
    return 2 + fold(x);
  }, { mat: cloth, z: 2 }, (t: TexSample, x, y) => {
    // The weave (2× / 4×), the hem along the edges, a few creases.
    if (d > 1 && hash2(Math.floor(x * d), Math.floor(y * d)) > 0.9) t.tone -= 0.08;
    if (y < y0 + sagT(x) + 1.1 || y > y0 + H + sagB(x) - 1.1) t.tone -= 0.2;
    const r = wob(x, y, 3, d);
    const yy = y - sagT(x) * 0.6;
    // The mark.
    const m = markHit(x + r * 0.6, yy, mx, my);
    if (m === 1) return void (t.mat = paint);
    if (m === 2) return void (t.mat = sand);
    if (m === 3) {
      t.mat = smoke;
      return;
    }
    // The title (brush letters: a ragged edge, a drip under some strokes).
    if (faceHit(BOLD, l1, tx, t1y, 2, 1, x + r, yy) || faceHit(BOLD, l2, l2x, t2y, 2, 1, x + r, yy)) return void (t.mat = paint);
    const drip = (lx: number, ly: number, text: string): boolean => {
      if (yy < ly + 14 || yy > ly + 14 + 3 + (Math.floor(x) % 3)) return false;
      if (hash2(Math.floor(x / 2), 77) < 0.93) return false;
      return Math.abs(frac(x / 2) - 0.5) < 0.3 && faceHit(BOLD, text, lx, ly, 2, 1, x, ly + 13);
    };
    if (drip(tx, t1y, l1) || drip(l2x, t2y, l2)) return void (t.mat = paint);
    if (faceHit(SMALL, SPANDOEK.sub, subX, subY, 1, 1, x + r * 0.5, yy)) return void (t.mat = navy);
  });
  // The ropes tying the corners to the poles.
  for (const [ax, bx] of [[x0 - 2, x0 + 1], [x0 + W + 2, x0 + W - 1]]) {
    p.capsule(ax, y0 + 1, bx, y0 + 2, 0.4, 0.4, { mat: rope, z: 2.6 });
    p.capsule(ax, y0 + H + 1, bx, y0 + H + 2, 0.4, 0.4, { mat: rope, z: 2.6 });
  }
  return finishC(p, 0.15);
}

// ---------------------------------------------------------------------------------------------
// Small banners and placards
// ---------------------------------------------------------------------------------------------

const BANNER_LOOK: ReadonlyArray<readonly [string, string]> = [
  ['cloth', 'black'],
  ['gold', 'black'],
  ['sky', 'snow'],
  ['pink', 'snow'],
];

export function bannerFrame(i: number, d: Dn): Frame {
  const text = BANNERS[i % BANNERS.length];
  const tw = faceWidth(SMALL, text, 1, 1);
  const W = tw + 10;
  const H = 11;
  const stick = 24;
  const p = new Pen(-W / 2 - 3, -stick - 3, W + 6, stick + 4, d);
  const c = p.c;
  const [bg, fg] = BANNER_LOOK[i % BANNER_LOOK.length];
  const cloth = mat(c, bg, { spec: 0.05, lo1: 1, hi1: 2, lo: 2, hi: 6, wrap: 0.35 });
  const ink = mat(c, fg, { spec: 0.2, lo1: fg === 'snow' ? 2 : 0, hi1: fg === 'snow' ? 3 : 1, lo: fg === 'snow' ? 4 : 0, hi: fg === 'snow' ? 6 : 3 });
  const wood = mat(c, 'wood', { spec: 0.3, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const x0 = -W / 2;
  const y0 = -stick;
  for (const px of [x0, x0 + W]) p.capsule(px, 0, px, -stick - 1, 0.7, 0.6, { mat: wood, z: 1 });
  p.field(x0, y0 - 1, W, H + 3, (x, y) => {
    const sag = Math.sin(((x - x0) / W) * Math.PI) * 1.4;
    if (y < y0 + sag * 0.4 || y > y0 + H + sag) return NaN;
    return 1.5 + Math.sin((x - x0) * 0.3 + i) * 0.4;
  }, { mat: cloth, z: 2 }, (t, x, y) => {
    const sag = Math.sin(((x - x0) / W) * Math.PI) * 0.6;
    if (faceHit(SMALL, text, x0 + 5, y0 + 3 + sag, 1, 1, x + wob(x, y, i, d) * 0.5, y)) t.mat = ink;
  });
  return finishC(p, 0.15);
}

export function placardFrame(i: number, d: Dn): Frame {
  const [a, b] = twoLines(BANNERS[i % BANNERS.length]);
  const tw = Math.max(faceWidth(SMALL, a, 1, 1), faceWidth(SMALL, b, 1, 1));
  const W = tw + 6;
  const H = b ? 15 : 9;
  const stick = 14;
  const p = new Pen(-W / 2 - 2, -stick - H - 2, W + 4, stick + H + 3, d);
  const c = p.c;
  const card = mat(c, 'sand', { spec: 0.05, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.3 });
  const marker = mat(c, 'black', { spec: 0.1, lo1: 0, hi1: 1, lo: 0, hi: 2 });
  const wood = mat(c, 'wood', { spec: 0.3, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const x0 = -W / 2;
  const y0 = -stick - H;
  p.capsule(0, 0, 0, y0 + H - 2, 0.7, 0.6, { mat: wood, z: 1 });
  p.box(x0, y0, W, H, {
    mat: card,
    z: 2,
    r: 0.4,
    round: 0.25,
    tex: (t) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      // Corrugation (fine), a torn corner, the marker letters.
      if (d > 1 && frac(x / 1.2) < 0.15) t.tone -= 0.06;
      if (x > x0 + W - 2.5 && y < y0 + 2.5 - (x - (x0 + W - 2.5))) t.cut = true;
      const r = wob(x, y, i + 9, d) * 0.6;
      if (faceHit(SMALL, a, -faceWidth(SMALL, a, 1, 1) / 2, y0 + 2, 1, 1, x + r, y) || (b && faceHit(SMALL, b, -faceWidth(SMALL, b, 1, 1) / 2, y0 + 8, 1, 1, x + r, y))) t.mat = marker;
    },
  });
  return finishC(p, 0.15);
}

// ---------------------------------------------------------------------------------------------
// Barrels and chains
// ---------------------------------------------------------------------------------------------

const BARREL_COL = ['sky', 'orange', 'green'] as const;

export function barrelFrame(v: number, d: Dn): Frame {
  const { w: W, h: H } = BARREL;
  const p = new Pen(-W / 2 - 1, -H - 1, W + 2, H + 2, d);
  const c = p.c;
  const paint = mat(c, BARREL_COL[v], { spec: 0.7, shine: 36, lo1: 0, hi1: 2, lo: 1, hi: 5, rim: 0.3 });
  const steel = mat(c, 'steel', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const white = mat(c, 'snow', { spec: 0.4, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const gold = mat(c, 'gold', { spec: 0.4, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const rust = mat(c, 'brown', { spec: 0.2, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  p.c.cylinder(-W / 2 - p.x0, -H - p.y0, W, H, {
    mat: paint,
    z: 1,
    axis: 'v',
    tex: (t: TexSample) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      // The rolling hoops, a rust streak, the activists' painting.
      if (Math.abs(y + H * 0.33) < 0.7 || Math.abs(y + H * 0.67) < 0.7) t.mat = steel;
      else if (Math.abs(x - 3.5) < 0.5 && y > -H * 0.6 && hash2(Math.floor(y * d), 5) > 0.3) t.mat = rust;
      else if (v === 0) {
        const r = Math.hypot(x + 0.5, y + H * 0.5);
        if (r < 1.1) t.mat = gold;
        else if (r < 2.9 && Math.abs(Math.cos(Math.atan2(y + H * 0.5, x + 0.5) * 3)) > 0.35) t.mat = white;
      } else if (v === 1) {
        if (Math.abs(y + H * 0.5 - Math.sin(x * 1.3) * 0.9) < 0.6) t.mat = white;
      }
    },
  });
  p.ellipsoid(0, -H + 0.3, W / 2, 1.3, { mat: steel, z: 1.4, round: 0.4 });
  if (v === 2) {
    // A chain wrapped round the drum, its padlock.
    const links = mat(c, 'steel', { spec: 1.2, shine: 60, lo1: 0, hi1: 3, lo: 1, hi: 6 });
    for (let i = 0; i < 6; i++) {
      const x = -W / 2 + 1.2 + i * 2.3;
      p.ellipsoid(x, -H * 0.48 + (i % 2) * 0.4, 1.3, 0.9, { mat: links, z: 2.2, round: 0.6 });
    }
    p.box(1, -H * 0.48, 3, 3.2, { mat: gold, z: 2.6, r: 0.5 });
  }
  return finishC(p, 0.2);
}

export function chainFrame(d: Dn): Frame {
  const p = new Pen(-1, -14, CHAIN_W + 2, 10, d);
  const links = mat(p.c, 'steel', { spec: 1.2, shine: 60, lo1: 0, hi1: 3, lo: 1, hi: 6 });
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = u * CHAIN_W;
    const y = -11 + Math.sin(u * Math.PI) * 5;
    p.ellipsoid(x, y, i % 2 ? 1.3 : 0.7, i % 2 ? 0.8 : 1.1, { mat: links, z: 1 + (i % 2) * 0.3, round: 0.6 });
  }
  return finishC(p, 0.1);
}

// ---------------------------------------------------------------------------------------------
// The lunch table
// ---------------------------------------------------------------------------------------------

export function picnicFrame(d: Dn): Frame {
  const p = new Pen(-30, -24, 60, 25, d);
  const c = p.c;
  const steel = mat(c, 'steel', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const check = mat(c, 'sky', { spec: 0.1, lo1: 1, hi1: 2, lo: 2, hi: 5, wrap: 0.3 });
  const white = mat(c, 'snow', { spec: 0.1, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.3 });
  const pot = mat(c, 'steel', { spec: 1.1, shine: 56, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const soup = mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 1, hi1: 2, lo: 3, hi: 5 });
  const thermos = mat(c, 'teal', { spec: 1, shine: 50, lo1: 0, hi1: 2, lo: 2, hi: 5 });
  const bread = mat(c, 'sand', { spec: 0.1, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.3 });
  const green = mat(c, 'green', { spec: 0.2, lo1: 1, hi1: 2, lo: 3, hi: 5 });
  const canvas = mat(c, 'olive', { spec: 0.1, lo1: 0, hi1: 2, lo: 2, hi: 5, wrap: 0.3 });
  // The folding table: legs crossed, the checked cloth hanging over the edge.
  p.capsule(-16, 0, -6, -11, 0.5, 0.5, { mat: steel, z: 1 });
  p.capsule(-6, 0, -16, -11, 0.5, 0.5, { mat: steel, z: 1 });
  p.capsule(4, 0, 14, -11, 0.5, 0.5, { mat: steel, z: 1 });
  p.capsule(14, 0, 4, -11, 0.5, 0.5, { mat: steel, z: 1 });
  p.box(-20, -12, 38, 5, {
    mat: check,
    z: 2,
    r: 0.6,
    round: 0.3,
    tex: (t) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      if ((Math.floor((x + 20) / 2.4) + Math.floor((y + 12) / 2.4)) % 2 === 0) t.mat = white;
      // The hanging edge: a wavy hem.
      if (y > -8.4 + Math.sin(x * 1.2) * 0.5) t.cut = true;
    },
  });
  // The soup pot (the soup is ORANGE: tomato), a ladle; the thermos; a stack of sandwiches.
  p.box(-15, -19, 11, 7, { mat: pot, z: 3, r: 1, round: 0.6 });
  p.ellipsoid(-9.5, -19, 5.4, 1.2, { mat: soup, z: 3.6, round: 0.3 });
  p.capsule(-7, -18.6, -3, -23, 0.45, 0.45, { mat: pot, z: 3.8 });
  p.box(2, -21, 4, 9, { mat: thermos, z: 3, r: 1, round: 0.7 });
  p.box(1.6, -22.4, 4.8, 2, { mat: white, z: 3.2, r: 0.6 });
  for (let i = 0; i < 3; i++) {
    p.poly([[8 + i * 0.4, -12.2 - i * 2], [15 + i * 0.4, -12.2 - i * 2], [14.4, -14 - i * 2], [8.6, -14 - i * 2]], { mat: bread, z: 3 + i * 0.1, round: 0.4 });
    p.box(8.2, -12.8 - i * 2, 7, 0.6, { mat: green, z: 3.05 + i * 0.1 });
  }
  // The camping chair beside the table.
  p.capsule(20, 0, 27, -9, 0.45, 0.45, { mat: steel, z: 1 });
  p.capsule(27, 0, 20, -9, 0.45, 0.45, { mat: steel, z: 1 });
  p.box(19.5, -10, 8.5, 2.4, { mat: canvas, z: 2, r: 0.6 });
  p.box(25.6, -18, 2.4, 9, { mat: canvas, z: 1.8, r: 0.6 });
  return finishC(p, 0.2);
}

// ---------------------------------------------------------------------------------------------
// The sitting crowd (the far lanes)
// ---------------------------------------------------------------------------------------------

const CROWD_LOOKS: readonly HumanStyle[] = [
  { skin: 'skinA', hair: 'hairC', hairStyle: 'ponytail', headgear: 'none', top: 'green', topType: 'sweater', pants: 'navy', boots: 'brown', gloves: null, build: 'slim' },
  { skin: 'skinC', hair: 'hairA', hairStyle: 'short', headgear: 'bobble', gear: 'orange', top: 'navy', topType: 'jacket', pants: 'olive', boots: 'black', gloves: null, build: 'normal', face: ['beard'] },
  { skin: 'skinB', hair: 'hairB', hairStyle: 'bob', headgear: 'none', top: 'pink', topType: 'coat', pants: 'navy', boots: 'brown', gloves: null, build: 'slim', face: ['glasses'] },
  { skin: 'skinA', hair: 'snow', hairStyle: 'tufts', headgear: 'cap', gear: 'sky', top: 'sand', topType: 'sweater', pants: 'brown', boots: 'brown', gloves: null, build: 'heavy', face: ['moustache'] },
  { skin: 'skinB', hair: 'hairA', hairStyle: 'curly', headgear: 'none', top: 'gold', topType: 'tee', shirt: 'snow', pants: 'navy', boots: 'black', gloves: null, build: 'stocky' },
  { skin: 'skinC', hair: 'hairB', hairStyle: 'long', headgear: 'rainhat', gear: 'teal', top: 'purple', topType: 'jacket', pants: 'olive', boots: 'brown', gloves: null, build: 'lanky' },
];

/** Sitting cross-legged on the asphalt: a fist up (chanting), hands on the knees or clapping (k). */
const SIT = (k: number): Pose => ({
  legN: { hip: 88, knee: 120 },
  legF: { hip: 80, knee: 128 },
  bob: 0,
  lean: 2 + (k % 2) * 4,
  armN: k === 0 ? { sh: 165, el: 12, hand: 'fist' } : k === 1 ? { sh: 30, el: 70, hand: 'open' } : { sh: 50, el: 100, hand: 'open' },
  armF: k === 2 ? { sh: 46, el: 104, hand: 'open' } : { sh: 20, el: 60, hand: 'open' },
  expr: k === 0 ? 'shout' : k === 1 ? 'happy' : 'smile',
  head: { tilt: k === 1 ? 4 : -3 },
});

export const CROWD_W = 72;

export function crowdFrame(v: number, d: Dn): Frame {
  const p = new Pen(-CROWD_W / 2 - 6, -30, CROWD_W + 12, 31, d);
  const pieces: Piece[] = [];
  for (let i = 0; i < 6; i++) {
    const look = CROWD_LOOKS[(i + v * 3) % CROWD_LOOKS.length];
    const f = renderHuman(look, { weapon: 'none', ...SIT((i * 2 + v) % 3) }, 'full', d as Density);
    const x = -CROWD_W / 2 + 6 + i * 12 + (v ? 3 : 0);
    const pc: Piece = { buf: f.buf, x: Math.round(x - f.ox), y: Math.round(-f.oy), behind: i % 2 === 1 };
    if (d !== 1) pc.density = d;
    pieces.push(pc);
  }
  const base = p.frame(p.c.render({ outline: 'none' }));
  return withPieces(base, pieces);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

defStrip(BLOK_SPR.spandoek, (d) => [0, 1, 2].map((f) => spandoekFrame(f, d)), { ticksPerFrame: 20 });
defStrip(BLOK_SPR.banner, (d) => BANNERS.map((_, i) => bannerFrame(i, d)));
defStrip(BLOK_SPR.placard, (d) => BANNERS.map((_, i) => placardFrame(i, d)));
defStrip(BLOK_SPR.barrel, (d) => [0, 1, 2].map((v) => barrelFrame(v, d)));
defStrip(BLOK_SPR.chain, (d) => [chainFrame(d)]);
defStrip(BLOK_SPR.picnic, (d) => [picnicFrame(d)]);
defStrip(BLOK_SPR.crowd, (d) => [crowdFrame(0, d), crowdFrame(1, d)]);
