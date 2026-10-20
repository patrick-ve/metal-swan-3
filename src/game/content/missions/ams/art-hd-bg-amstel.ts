/**
 * UHD `ams-amstel` (docs/ART_GUIDE.md "UHD art", "UHD backgrounds and terrain"): the far bank of
 * the Amstel seen from the water (section c2 RONDVAART), at 2× and 4× from ONE density-generic
 * generator.
 *
 * Same design as the 1× layer (backgrounds.ts `amsAmstel`: the same hashes put every mansion, its
 * storeys and windows, the dormers, the elms, the lamp posts and the moored boats at the same
 * logical places). Painted, no ink outline (style decision):
 *
 * - the mansions: plastered or brick walls with a lit left corner, a shaded seam to the next one,
 *   stains on the plaster and brick courses at 4×, a white cornice with its shadow on the wall, a
 *   slate roof (courses, the lit ridge) with white dormers; tall sash windows (white frames lit
 *   top-left, sky in the glass with a sheen, the sash bar, glazing bars at 4×, a stone sill), a
 *   few warm with the low sun; a moulded band under every storey;
 * - the elms on the quay (leaf clusters, art-hd-bg-trees.ts) and black lamp posts with a glowing
 *   lantern;
 * - the tall stone quay wall: a lit coping, blocks with recessed joints, iron mooring rings, the
 *   wet dark foot with a moss fringe (4×);
 * - the broad river: the bank mirrored with the 1× wobble, softened (window frames dissolve into
 *   colour), on an HD water ramp per light, darker toward the viewer, broken by ripple dashes and
 *   long glints; the moored sloepen and the long white tour boat with their dark reflections.
 *
 * A mid-distance layer: a little haze (`airOf(light, 0.12)`).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { defineHdBgGenerator, type HdBgGenerator } from '../../../art/art-registry';
import { hash2 } from '../../../art/paint';
import { AMSTEL_BLOCKS, AMSTEL_SEAM, AMSTEL_STOREY, AMSTEL_WALL, WATER } from './backgrounds';
import { airOf, BAYER8, BgCanvas, homeOf, hdPath, lightOf, oklab, pick, px, rampI, tableOf, type Air } from './art-hd-bg-kit';
import { leafMass, trunk } from './art-hd-bg-trees';

/** The home ramp of a 1× colour through the layer's air, and the colour's index on it. */
function homeI(air: Air, c: Color): { r: Uint8Array; m: number } {
  const h = homeOf(c);
  return { r: rampI(air, h.ramp), m: h.i };
}

/** Index ramps of the materials (through the layer's air). */
interface Mats {
  trim: Uint8Array;
  slate: Uint8Array;
  glass: Uint8Array;
  gold: Uint8Array;
  stone: Uint8Array;
  leaf: Uint8Array;
  bark: Uint8Array;
  post: Uint8Array;
  moss: Uint8Array;
}

function mats(air: Air): Mats {
  return {
    trim: rampI(air, PAL_HD.gable),
    slate: rampI(air, PAL_HD.slate),
    glass: rampI(air, PAL_HD.glass),
    gold: rampI(air, PAL_HD.gold),
    stone: rampI(air, PAL_HD.stone),
    leaf: rampI(air, air.light === 'golden' ? [...PAL_HD.green.slice(0, 6), PAL_HD.olive[6], PAL_HD.gold[6]] : PAL_HD.green),
    bark: rampI(air, PAL_HD.brown.slice(0, 7)),
    post: rampI(air, PAL_HD.black),
    moss: rampI(air, PAL_HD.moss),
  };
}

/** Is a 1× wall colour plaster (smooth, stained) rather than brick? */
function plastered(c: Color): boolean {
  return PAL.sand.includes(c) || PAL.snow.includes(c) || PAL.stone.includes(c);
}

/** A sash window: the 1× frame (5 × S−4 at x, y), glass, the sash bar, the sill. */
function sash(c: BgCanvas, M: Mats, x: number, y: number, S: number, lit: boolean): void {
  const d = c.d;
  const { trim, glass, gold } = M;
  const h = S - 4;
  c.rect(x, y, 5, h, trim[4]);
  c.rect(x, y, 5, 0.25, trim[6]);
  c.rect(x, y, 0.25, h, trim[5]);
  c.rect(x + 4.75, y, 0.25, h, trim[2]);
  // The glass: 3 × S−6 inside the frame (the 1× pane), sky reflected lighter at the top, a sheen.
  const X0 = Math.round((x + 1) * d);
  const X1 = Math.round((x + 4) * d);
  const Y0 = Math.round((y + 1) * d);
  const Y1 = Math.round((y + h - 1) * d);
  const W = c.W;
  const pxs = c.px;
  for (let Y = Y0; Y < Y1; Y++) {
    const t = (Y - Y0) / Math.max(1, Y1 - Y0);
    const row = Y * W;
    for (let X = X0; X < X1; X++) {
      const xx = ((X % W) + W) % W;
      let k: number;
      if (lit) k = t < 0.45 ? 6 : 5;
      else {
        k = Math.floor(3.6 - t * 2.4 + (BAYER8[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.6);
        // The diagonal sheen; the reveal's shadow down the left.
        if ((X - X0 + (Y - Y0)) % (3 * d) < Math.max(1, d >> 1) && t > 0.2) k = 4;
        if (X - X0 < Math.max(1, d >> 2) || Y - Y0 < Math.max(1, d >> 2)) k = 0;
      }
      pxs[row + xx] = lit ? gold[k] : glass[k < 0 ? 0 : k > 5 ? 5 : k];
    }
  }
  // The sash bar (the 1× bar row) and, at 4×, the glazing bars.
  const bar = y + 1 + ((S - 6) >> 1);
  c.rect(x + 1, bar, 3, 0.5, trim[4]);
  c.rect(x + 1, bar, 3, 0.25, trim[5]);
  if (d === 4) c.rect(x + 2.375, y + 1, 0.25, h - 2, trim[3]);
  // The stone sill (in the 1× frame's lowest row).
  c.rect(x - 0.25, y + h - 0.75, 5.5, 0.75, M.stone[5]);
  c.rect(x - 0.25, y + h - 0.75, 5.5, 0.25, M.stone[6]);
}

/** One mansion (1× block at x0, width bw) on the quay line. */
function mansion(c: BgCanvas, M: Mats, air: Air, x0: number, bw: number, i: number, block: (typeof AMSTEL_BLOCKS)[number], quay: number, seed: number): void {
  const d = c.d;
  const S = AMSTEL_STOREY;
  const top = quay - block.floors * S - 8;
  const wall = homeI(air, block.wall[0]);
  const wr = wall.r;
  const m = Math.max(2, Math.min(wr.length - 3, wall.m));
  const plaster = plastered(block.wall[0]);
  // The wall: plaster with soft stains (per 2 logical px, ordered dither) or brick courses.
  const X0 = Math.round(x0 * d);
  const X1 = Math.round((x0 + bw) * d);
  const W = c.W;
  const pxs = c.px;
  for (let Y = top * d; Y < quay * d; Y++) {
    const y = Math.floor(Y / d);
    const row = Y * W;
    const brow = (Y & 7) << 3;
    for (let X = X0; X < X1; X++) {
      const x = Math.floor(X / d);
      let v = m + 0.5;
      if (plaster) {
        // Soft stains (3 × 2 logical px patches), damp rising from the quay.
        v += (hash2(Math.floor(x / 3), y >> 1, seed + i * 7) - 0.5) * 0.55;
        v -= Math.max(0, (Y / d - (quay - 6)) / 6) * 0.9;
      } else {
        // Brick: one course per logical px (the bed joint an art row at 4×), per-brick tones.
        const bx = Math.floor((x + (y & 1)) / 2);
        if (d === 4 && (Y & 3) === 3) v -= 0.9;
        else v += (hash2(bx, y, seed + i) - 0.5) * 0.7;
      }
      const k = Math.floor(v + (BAYER8[brow | (X & 7)] - 0.5) * 0.5);
      pxs[row + (((X % W) + W) % W)] = wr[k < 0 ? 0 : k > wr.length - 1 ? wr.length - 1 : k];
    }
  }
  // The lit left corner, the seam to the next mansion.
  c.rect(x0, top, 0.5, quay - top, pick(wr, m + 2));
  c.rect(x0 + bw - 0.5, top, 0.5, quay - top, pick(wr, m - 2));
  // The cornice (2 rows: the 1× top − 1 and top) and its shadow on the wall.
  c.rect(x0, top - 1, bw, 1, M.trim[5]);
  c.rect(x0, top - 1, bw, 0.25, M.trim[6]);
  c.rect(x0, top, bw, 1, M.trim[3]);
  c.rect(x0, top + 0.75, bw, 0.25, M.trim[1]);
  c.rect(x0, top + 1, bw, 0.5, pick(wr, m - 1));
  if (d === 4) for (let x = x0 + 1; x < x0 + bw - 1; x += 2) c.rect(x, top, 0.5, 0.5, M.trim[2]);
  // The slate roof (the 1× rows top − 2 … top − 8, inset one more px per row): courses, the ridge.
  const sl = M.slate;
  c.poly(
    [
      [x0 + 1, top - 1],
      [x0 + bw - 1, top - 1],
      [x0 + bw - 8, top - 8],
      [x0 + 8, top - 8],
    ],
    (X, Y) => {
      const yy = (Y + 0.5) / d;
      const course = Math.floor((top - 1 - yy) * 1.5);
      const f = (top - 1 - yy) * 1.5 - course;
      let k = 3 + (yy < top - 6 ? 1 : 0);
      if (f < 1 / d) k = 2;
      else if (d === 4 && (Math.floor(X / 3) + course * 2) % 5 === 0 && f > 0.5) k = 2;
      return sl[k];
    },
  );
  c.rect(x0 + 8, top - 8, bw - 16, 0.5, sl[6]);
  // Dormers: a white frame and cheeks, dark glass with a glint, a lead cap.
  const nd = block.dormers;
  for (let k = 0; k < nd; k++) {
    const dx = x0 + Math.round(((k + 0.5) * bw) / nd) - 2;
    c.rect(dx, top - 6, 5, 4, M.trim[4]);
    c.rect(dx, top - 6, 5, 0.25, M.trim[6]);
    c.rect(dx, top - 6, 0.25, 4, M.trim[5]);
    c.rect(dx + 1, top - 5, 3, 3, M.glass[1]);
    c.rect(dx + 1, top - 5, 3, 0.5, M.glass[0]);
    c.rect(dx + 1.5, top - 4.25, 0.5, 0.5, M.glass[5]);
    c.rect(dx - 0.25, top - 6.5, 5.5, 0.5, sl[1]);
  }
  // Window rows (the 1× places): sash windows, a few warm with the low sun; a band under each storey.
  const cols = Math.max(2, Math.floor((bw - 6) / 9));
  for (let f = 0; f < block.floors; f++) {
    const wy = top + 3 + f * S;
    for (let k = 0; k < cols; k++) {
      const wx = x0 + 4 + Math.round((k * (bw - 8)) / cols);
      sash(c, M, wx, wy, S, hash2(k, f + i * 7, seed) < 0.18);
    }
    // The moulded band (the 1× shade row): a shaded strip with a lit lip.
    c.rect(x0 + 1, wy + S - 3, bw - 2, 1, pick(wr, m - 1));
    c.rect(x0 + 1, wy + S - 3, bw - 2, 0.25, pick(wr, m + 1));
  }
}

/** A lamp post on the quay (the 1× post at lx, lantern 3 × 3 over it). */
function lamp(c: BgCanvas, M: Mats, lx: number, quay: number): void {
  const p = M.post;
  c.rect(lx, quay - 18, 1, 18, p[2]);
  c.rect(lx, quay - 18, 0.25, 18, p[5]);
  c.rect(lx + 0.75, quay - 18, 0.25, 18, p[0]);
  c.rect(lx - 0.25, quay - 3, 1.5, 3, p[3]);
  c.rect(lx - 1, quay - 21, 3, 3, M.gold[6]);
  c.rect(lx - 1, quay - 19.5, 3, 1.5, M.gold[5]);
  c.rect(lx - 0.75, quay - 20.75, 0.75, 0.75, M.gold[7]);
  c.rect(lx - 1, quay - 21, 3, 0.5, p[2]);
  c.rect(lx + 0.375, quay - 21, 0.25, 3, p[1]);
}

const amsAmstelHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const light = lightOf(p);
  const air = airOf(light, 0.12);
  const M = mats(air);
  const quay = px(p, 'y', 0.667, h);
  // The mansions, wall to wall along the quay (the 1× chain: it starts AMSTEL_SEAM px left of
  // the tile and wraps; the last one fills the tile).
  const end = w - AMSTEL_SEAM;
  let x0 = -AMSTEL_SEAM;
  const first = Math.floor(hash2(0, 1, seed) * AMSTEL_BLOCKS.length);
  for (let i = 0; x0 < end; i++) {
    const block = AMSTEL_BLOCKS[(i + first) % AMSTEL_BLOCKS.length];
    const bw = end - (x0 + block.w) < 60 ? end - x0 : block.w;
    mansion(c, M, air, x0, bw, i, block, quay, seed);
    x0 += bw;
  }
  // Elms on the quay (the 1× trunk and six leaf masses), a lamp post between them.
  const nt = Math.max(1, Math.round(w / 96));
  for (let k = 0; k < nt; k++) {
    const cx = Math.round((k + 0.5) * (w / nt) + (hash2(k, 7, seed) - 0.5) * 24);
    const r = 15 + Math.floor(hash2(k, 8, seed) * 6);
    const ts = seed + k * 3;
    const cy = quay - r - 12;
    trunk(c, cx - 1, cy, quay, 3, M.bark, ts);
    const crown = { x: cx, y: cy, r };
    for (let m = 0; m < 6; m++) {
      const bx = cx + Math.round((hash2(m, 1, ts) - 0.5) * r * 1.4);
      const by = cy + Math.round((hash2(m, 2, ts) - 0.6) * r * 0.8);
      const br = Math.round(r * (0.42 + hash2(m, 3, ts) * 0.22));
      leafMass(c, bx + 0.5, by + 0.5, br + 0.5, M.leaf, ts * 31 + m * 13, crown, (hash2(m, 4, ts) - 0.5) * 0.5);
    }
    lamp(c, M, Math.round(cx + w / nt / 2), quay);
  }
  // The tall stone quay wall: the lit coping, two block courses with recessed joints, mooring
  // rings, the wet dark foot (a moss fringe at 4×).
  const st = M.stone;
  c.rect(0, quay, w, 1, st[6]);
  c.rect(0, quay, w, 0.25, st[7]);
  c.rect(0, quay + 0.75, w, 0.25, st[3]);
  c.rect(0, quay + 1, w, 2, st[4]);
  c.rect(0, quay + 3, w, AMSTEL_WALL - 4, st[3]);
  c.rect(0, quay + 2.75, w, 0.5, st[1]);
  c.rect(0, quay + 1, w, 0.25, st[5]);
  for (let x = 0; x < w; x += 12) {
    c.rect(x, quay + 1, 0.5, 2, st[1]);
    c.rect(x + 6, quay + 3, 0.5, AMSTEL_WALL - 4, st[1]);
  }
  c.rect(0, quay + AMSTEL_WALL - 1, w, 1, M.post[1]);
  for (let x = 20; x < w; x += 48) {
    c.rect(x - 0.5, quay + 1.5, 1.5, 1.5, M.post[2]);
    c.rect(x - 0.25, quay + 1.75, 1, 1, st[3]);
    c.rect(x - 0.5, quay + 1.5, 1.5, 0.25, M.gold[5]);
  }
  if (d === 4) {
    for (let X = 0; X < c.W; X++) {
      const hv = hash2(X >> 2, 5, seed);
      if (hv < 0.4) c.rectA(X, (quay + AMSTEL_WALL - 1) * d - 1 - (hv < 0.15 ? 1 : 0), 1, 1 + (hv < 0.15 ? 1 : 0), M.moss[hv < 0.2 ? 3 : 2]);
    }
  }
  // The river: the bank mirrored (the 1×: source row quay − 1 − ⌊1.6·depth⌋, a wobble of
  // 2·sin(depth·2π/9) px), softened over about 3 logical px, on the HD water ramp of the light,
  // darker toward the viewer; runs shifted a logical px here and there.
  const wi = rampI(air, hdPath(WATER[light], 9));
  const nW = wi.length;
  // Index → reflected lightness 0 … 250: the river reflects darker than the bank (the 1× maps
  // the wall lightness to the lower half of its water ramp); the sky → a light water tone.
  const lq = tableOf((col) => Math.round(Math.min(0.62, Math.max(0, (oklab(col)[0] - 0.25) / 0.75)) * 250));
  lq[0] = Math.round(((nW - 2.5) / (nW - 1)) * 250);
  // Depth steps: one HD tone darker per 5 logical px (the 1×: one of its 5 tones per 10 px).
  const lut = new Uint8Array(8 * 256);
  for (let dk = 0; dk < 8; dk++) {
    for (let q = 0; q < 256; q++) {
      const k = Math.min(nW - 2, Math.floor((q / 250) * (nW - 1)));
      lut[(dk << 8) | q] = wi[Math.max(0, k - dk)];
    }
  }
  const top = quay + AMSTEL_WALL;
  const W = c.W;
  const pxs = c.px;
  const pre = new Float64Array(W + 1);
  const box = Math.round(1.5 * d);
  const inv = 1 / (2 * (2 * box + 1));
  const half = Math.max(1, d >> 1);
  for (let Y = top * d; Y < c.H; Y++) {
    const dd = (Y + 0.5) / d - top;
    const dl = Math.floor(dd);
    const wob = Math.round(Math.sin((dl * 2 * Math.PI) / 9) * 2) * d;
    const sY = Math.max(0, quay * d - 1 - Math.floor((Y - top * d) * 1.6));
    const row = Y * W;
    const dark = dd / 5;
    const kc = Math.min(7, Math.floor(dark));
    const ra = sY * W;
    const rb = Math.max(0, sY - 1) * W;
    for (let X = 0; X < W; X++) pre[X + 1] = pre[X] + lq[pxs[ra + X]] + lq[pxs[rb + X]];
    const key = Math.floor(Y / half);
    let X = 0;
    let seg = 0;
    while (X < W) {
      const hv = hash2(seg, key, seed + 17);
      const end = Math.min(W, X + Math.round((5 + hv * 12) * d));
      const off = wob + (hash2(seg, key, seed + 19) < 0.35 ? (hv < 0.5 ? -d : d) : 0) + W;
      const k = Math.floor(dark + (hash2(seg, key, seed + 23) - 0.5) * 0.7);
      const ko = (k < kc - 1 ? kc - 1 : k < 0 ? 0 : k > 7 ? 7 : k) << 8;
      const tint = Math.round((hash2(seg, key, seed + 29) - 0.5) * 14) + 0.5;
      let a = (X + off - box) % W;
      let b = (X + off + box + 1) % W;
      for (; X < end; X++) {
        const sum = a < b ? pre[b] - pre[a] : pre[W] - pre[a] + pre[b];
        let q = (sum * inv + tint) | 0;
        if (q < 0) q = 0;
        else if (q > 255) q = 255;
        pxs[row + X] = lut[ko | q];
        if (++a === W) a = 0;
        if (++b === W) b = 0;
      }
      seg++;
    }
    // The quay wall's shadow on the water right under it.
    if (dd < 1) c.span(0, W, Y, wi[0]);
  }
  // Ripple dashes (the 1×: every 5th row), lighter and darker breaks; long low-sun glints.
  const glint = M.trim[6];
  for (let Y = top * d + d; Y < c.H; Y += half) {
    const dd = Y / d - top;
    const rowSeed = Y * 7 + seed;
    let X = Math.floor(hash2(Y, 1, seed) * 6 * d);
    while (X < W) {
      const len = Math.round((2 + hash2(X, rowSeed, 2) * 7) * d * (dd < 10 ? 0.6 : 1));
      const kind = hash2(X, rowSeed, 3);
      if (kind < 0.12) c.span(X, X + len, Y, wi[nW - 2]);
      else if (kind < 0.24) c.span(X, X + len, Y, wi[1]);
      else if (kind < 0.25) c.span(X, X + len, Y, glint);
      X += len + Math.round((3 + hash2(X, rowSeed, 4) * 12) * d);
    }
  }
  // Moored boats along the far quay (the 1× places): sloepen, and every third a long white tour
  // boat with its glass cabin; each with a waterline and a dark reflection.
  const nb = Math.max(1, Math.round(w / 220));
  for (let k = 0; k < nb; k++) {
    const bx = Math.round((k + 0.25) * (w / nb) + hash2(k, 9, seed) * 40);
    if (k % 3 === 1) {
      const white = M.trim;
      c.rect(bx, top - 4, 54, 4, white[4]);
      c.rect(bx, top - 4, 54, 0.5, white[6]);
      c.rect(bx, top - 1, 54, 0.25, white[2]);
      c.rect(bx + 6, top - 7, 40, 3, M.glass[3]);
      c.rect(bx + 6, top - 7, 40, 0.5, M.glass[5]);
      for (let x = bx + 6; x < bx + 46; x += 5) c.rect(x, top - 7, 0.25, 3, white[5]);
      c.rect(bx + 40, top - 6.5, 5, 2.5, M.glass[1]);
      const navy = homeI(air, PAL.navy[1]);
      c.rect(bx, top, 54, 2, navy.r[navy.m]);
      c.rect(bx, top, 54, 0.5, navy.r[navy.m + 1]);
      c.rect(bx + 1, top + 2, 52, 1, wi[0]);
      continue;
    }
    const len = 18 + Math.floor(hash2(k, 10, seed) * 10);
    const hull = homeI(air, [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.brown[2]][k % 4]);
    const hm = Math.max(1, Math.min(hull.r.length - 2, hull.m));
    c.rect(bx, top, len, 3, hull.r[hm]);
    c.rect(bx, top + 1.5, len, 1.5, hull.r[hm - 1]);
    c.rect(bx, top, len, 1, M.trim[5]);
    c.rect(bx, top, len, 0.25, M.trim[6]);
    c.rect(bx + 1, top + 3, len - 2, 1, wi[0]);
    c.rect(bx + 4, top - 0.75, 3, 0.75, rampI(air, PAL_HD.red)[5]);
  }
  return c.finish();
};

defineHdBgGenerator('ams-amstel', amsAmstelHd);
