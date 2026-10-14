import { PixelBuffer } from './pixel';

/**
 * Pixel-art upscalers for the high-resolution backbuffer (docs/ARCHITECTURE.md §3).
 *
 * The renderers filter each sprite frame once with `upscale(buf, mode)` and draw the result
 * into a backbuffer that is k times larger than the logical view. The game logic never sees
 * the upscaled pixels.
 *
 * - 'pixel': no filter, factor 1 (the renderer enlarges with nearest neighbour).
 * - 'smooth': MMPX 2×. Palette-exact: output colours ⊆ input colours, alpha stays 0/255.
 *   Rounds curves and 1:1 / 2:1 diagonals; keeps square corners, 1-px details and dithering.
 * - 'xbr': Hyllian's xBR 4×. Blends colours: smoother curves, new colours and partial alpha
 *   along the edges.
 *
 * Contract (the renderers rely on it):
 * - Output size = input size × `upscaleFactor(mode)`. 0×0 and 1×1 buffers work.
 * - Pure and deterministic; never mutates the input. 'pixel' returns the input itself.
 * - Mirror-symmetric in X and in Y: upscale(flip(b)) equals flip(upscale(b)) pixel for pixel,
 *   so flipped variants can be drawn by transform. Every tie-break below is symmetric.
 * - All transparent pixels count as one colour (alpha 0 → 0x00000000). Outside the buffer is
 *   transparent, except for a buffer without any transparent pixel (a panel, a tile), which
 *   repeats its border, as in the MMPX reference demo.
 *
 * Attribution and licences (both algorithms are re-implemented here from their published,
 * MIT-licensed descriptions and code; no GPL/LGPL code was used):
 *
 * - MMPX: "MMPX Style-Preserving Pixel Art Magnification", Morgan McGuire and Mara Gagiu,
 *   Journal of Computer Graphics Techniques 10(2), 2021. Reference JavaScript implementation
 *   Copyright 2020 Morgan McGuire, MIT licence. The rules below follow that reference.
 * - xBR: algorithm by Hyllian (Sergio Gonçalves). Kernel and blend shapes follow xBRjs,
 *   Copyright 2020 Josep del Rio, MIT licence (https://github.com/joseprio/xBRjs). Changes
 *   here: integer YUV distances with an alpha term, premultiplied blending, a symmetric
 *   tie-break, and a fixed order for overlapping corner writes (for mirror symmetry).
 *
 * MIT licence text (applies to the parts derived from the works above):
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this
 *   software and associated documentation files (the "Software"), to deal in the Software
 *   without restriction, including without limitation the rights to use, copy, modify, merge,
 *   publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 *   to whom the Software is furnished to do so, subject to the following conditions: The above
 *   copyright notice and this permission notice shall be included in all copies or substantial
 *   portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 *   FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 *   HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 *   CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 *   USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export type UpscaleMode = 'pixel' | 'smooth' | 'xbr';

export const UPSCALE_MODES: readonly UpscaleMode[] = ['pixel', 'smooth', 'xbr'];

/** xBR output factor (2 or 4; see `xbr`). */
const XBR_FACTOR = 4;

/** Integer factor that `upscale(buf, mode)` produces (output size = input size × factor). */
export function upscaleFactor(mode: UpscaleMode): number {
  return mode === 'smooth' ? 2 : mode === 'xbr' ? XBR_FACTOR : 1;
}

/**
 * Upscale one buffer (with alpha) by `upscaleFactor(mode)`. Pure and deterministic; never
 * mutates `buf`. 'pixel' returns `buf` itself. Mirror-symmetric: upscaling a flipped buffer
 * equals flipping the upscaled buffer.
 */
export function upscale(buf: PixelBuffer, mode: UpscaleMode): PixelBuffer {
  if (mode === 'smooth') return mmpx(buf);
  if (mode === 'xbr') return xbr(buf, XBR_FACTOR);
  return buf;
}

// ------------------------------------------------------------------ shared input preparation

/** Border width of the padded source copy (MMPX reads up to 3 pixels away, xBR 2). */
const PAD = 3;

/**
 * Padded, normalised copy of `buf`: every transparent pixel becomes 0, and a PAD-wide border
 * is transparent (or repeats the edge when the buffer has no transparent pixel), so the inner
 * loops read neighbours without bounds checks. Row stride is buf.w + 2·PAD.
 */
function padSource(buf: PixelBuffer): Uint32Array {
  const { w, h, data } = buf;
  const pw = w + 2 * PAD;
  const out = new Uint32Array(pw * (h + 2 * PAD));
  let opaque = true;
  for (let y = 0; y < h; y++) {
    const row = (y + PAD) * pw + PAD;
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x];
      if ((c & 255) === 0) {
        opaque = false;
      } else {
        out[row + x] = c;
        if ((c & 255) !== 255) opaque = false;
      }
    }
  }
  if (opaque && w > 0 && h > 0) {
    // Clamp to the edge: extend each row sideways, then copy the first/last rows outward.
    for (let y = PAD; y < h + PAD; y++) {
      const row = y * pw;
      const l = out[row + PAD];
      const r = out[row + PAD + w - 1];
      for (let k = 0; k < PAD; k++) {
        out[row + k] = l;
        out[row + PAD + w + k] = r;
      }
    }
    for (let k = 0; k < PAD; k++) {
      out.copyWithin(k * pw, PAD * pw, PAD * pw + pw);
      out.copyWithin((h + PAD + k) * pw, (h + PAD - 1) * pw, (h + PAD) * pw);
    }
  }
  return out;
}

// ------------------------------------------------------------------ MMPX 2×

/**
 * Luminance for MMPX tie-breaks, biased by reverse alpha so that dark curves win on light
 * backgrounds and every curve wins against transparency (as in the reference).
 */
function mmpxLuma(c: number): number {
  return (((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255) + 1) * (256 - (c & 255));
}

/**
 * MMPX 2× (McGuire & Gagiu 2021). Each source pixel E becomes four output pixels J K / L M
 * chosen from its neighbourhood (letters as in the paper):
 *
 *        P
 *      A B C
 *    Q D E F R
 *      G H I
 *        S
 *
 * Output colours are always input colours, so the palette and binary alpha survive.
 */
export function mmpx(buf: PixelBuffer): PixelBuffer {
  const { w, h } = buf;
  const out = new PixelBuffer(w * 2, h * 2);
  if (w === 0 || h === 0) return out;
  const s = padSource(buf);
  const sw = w + 2 * PAD;
  const o = out.data;
  const ow = w * 2;
  for (let y = 0; y < h; y++) {
    let i = (y + PAD) * sw + PAD;
    let oi = 2 * y * ow;
    for (let x = 0; x < w; x++, i++, oi += 2) {
      const E = s[i];
      const A = s[i - sw - 1];
      const B = s[i - sw];
      const C = s[i - sw + 1];
      const D = s[i - 1];
      const F = s[i + 1];
      const G = s[i + sw - 1];
      const H = s[i + sw];
      const I = s[i + sw + 1];
      let J = E;
      let K = E;
      let L = E;
      let M = E;
      if (((A ^ E) | (B ^ E) | (C ^ E) | (D ^ E) | (F ^ E) | (G ^ E) | (H ^ E) | (I ^ E)) !== 0) {
        const P = s[i - 2 * sw];
        const S = s[i + 2 * sw];
        const Q = s[i - 2];
        const R = s[i + 2];
        const Bl = mmpxLuma(B);
        const Dl = mmpxLuma(D);
        const El = mmpxLuma(E);
        const Fl = mmpxLuma(F);
        const Hl = mmpxLuma(H);

        // 1:1 slopes: round corners and fill diagonals, keep sharp right angles.
        if (D === B && D !== H && D !== F && (El >= Dl || E === A) && (E === A || E === C || E === G) && (El < Dl || A !== D || E !== P || E !== Q)) J = D;
        if (B === F && B !== D && B !== H && (El >= Bl || E === C) && (E === A || E === C || E === I) && (El < Bl || C !== B || E !== P || E !== R)) K = B;
        if (H === D && H !== F && H !== B && (El >= Hl || E === G) && (E === A || E === G || E === I) && (El < Hl || G !== H || E !== S || E !== Q)) L = H;
        if (F === H && F !== B && F !== D && (El >= Fl || E === I) && (E === C || E === G || E === I) && (El < Fl || I !== H || E !== R || E !== S)) M = F;

        // Intersections: reconnect line crossings, but not at the edge of a checkerboard.
        if (E !== F && E === C && E === I && E === D && E === Q && F === B && F === H && F !== s[i + 3]) K = M = F;
        if (E !== D && E === A && E === G && E === F && E === R && D === B && D === H && D !== s[i - 3]) J = L = D;
        if (E !== H && E === G && E === I && E === B && E === P && H === D && H === F && H !== s[i + 3 * sw]) L = M = H;
        if (E !== B && E === A && E === C && E === H && E === S && B === D && B === F && B !== s[i - 3 * sw]) J = K = B;

        // Remove the squared-off tips of bright triangles on dark backgrounds.
        if (Bl < El && E === G && E === H && E === I && E === S && E !== A && E !== D && E !== C && E !== F) J = K = B;
        if (Hl < El && E === A && E === B && E === C && E === P && E !== D && E !== G && E !== I && E !== F) L = M = H;
        if (Fl < El && E === A && E === D && E === G && E === Q && E !== B && E !== C && E !== I && E !== H) K = M = F;
        if (Dl < El && E === C && E === F && E === I && E === R && E !== B && E !== A && E !== G && E !== H) J = L = D;

        // 2:1 and 1:2 slopes of one colour (these extend colours chosen above).
        if (H !== B) {
          if (H !== A && H !== E && H !== C) {
            if (H === G && H === F && H === R && H !== D && H !== s[i - sw + 2]) L = M;
            if (H === I && H === D && H === Q && H !== F && H !== s[i - sw - 2]) M = L;
          }
          if (B !== I && B !== G && B !== E) {
            if (B === A && B === F && B === R && B !== D && B !== s[i + sw + 2]) J = K;
            if (B === C && B === D && B === Q && B !== F && B !== s[i + sw - 2]) K = J;
          }
        }
        if (F !== D) {
          if (D !== I && D !== E && D !== C) {
            if (D === A && D === H && D === S && D !== B && D !== s[i + 2 * sw + 1]) J = L;
            if (D === G && D === B && D === P && D !== H && D !== s[i - 2 * sw + 1]) L = J;
          }
          if (F !== E && F !== A && F !== G) {
            if (F === C && F === H && F === S && F !== B && F !== s[i + 2 * sw - 1]) K = M;
            if (F === I && F === B && F === P && F !== H && F !== s[i - 2 * sw - 1]) M = K;
          }
        }
      }
      o[oi] = J;
      o[oi + 1] = K;
      o[oi + ow] = L;
      o[oi + ow + 1] = M;
    }
  }
  return out;
}

// ------------------------------------------------------------------ xBR 2× / 4×

// Corner kinds, decided per corner of each source pixel.
const K_NONE = 0;
const K_WEAK = 1; // e <= i: light blend of the corner pixel only
const K_DIA = 2; // 45° edge
const K_LEFT = 3; // shallow edge (2:1)
const K_UP = 4; // steep edge (1:2)
const K_LEFTUP = 5; // both
const KINDS = 6;

/**
 * Blend writes of one kind for the bottom-right corner, in block coordinates of an n×n block:
 * [col, row, weight (of 256; 256 = replace)], applied in this order. The other corners use
 * the same writes rotated (see `buildXbrTables`).
 */
const XBR_OPS: Record<2 | 4, number[][][]> = {
  2: [
    [],
    [[1, 1, 64]],
    [[1, 1, 128]],
    [[1, 1, 192], [0, 1, 64]],
    [[1, 1, 192], [1, 0, 64]],
    [[1, 1, 192], [0, 1, 64], [1, 1, 192], [1, 0, 64]],
  ],
  4: [
    [],
    [[3, 3, 128]],
    [[3, 3, 256], [2, 3, 128], [3, 2, 128]],
    [[3, 3, 256], [2, 3, 256], [3, 2, 192], [1, 3, 192], [0, 3, 64], [2, 2, 64]],
    [[3, 3, 256], [3, 2, 256], [2, 3, 192], [3, 1, 192], [3, 0, 64], [2, 2, 64]],
    [
      [3, 3, 256], [2, 3, 256], [3, 2, 192], [1, 3, 192], [0, 3, 64], [2, 2, 64],
      [3, 3, 256], [3, 2, 256], [2, 3, 192], [3, 1, 192], [3, 0, 64], [2, 2, 64],
    ],
  ],
};

/**
 * Per-factor write tables. For corner c (0 = bottom-right, then rotated a quarter turn each:
 * top-right, top-left, bottom-left), kind k and pass p, the writes are
 * cells[start..end) / weights[start..end) with start = offs[((c·KINDS)+k)·3+p].
 *
 * Several corners write into the same output cell, and blends do not commute. Writes are
 * therefore applied in three passes: a corner's own quadrant first, then the quadrant above or
 * below it, then the quadrant beside it. Within one pass no two corners touch the same cell,
 * and mirroring maps each pass onto itself, so the result is mirror-symmetric.
 */
interface XbrTables {
  offs: Int32Array;
  cells: Int32Array;
  weights: Int32Array;
}

const xbrTables = new Map<number, XbrTables>();

function buildXbrTables(n: 2 | 4): XbrTables {
  const offs = new Int32Array(4 * KINDS * 3 + 1);
  const cells: number[] = [];
  const weights: number[] = [];
  const half = n / 2;
  const cornerRight = [true, true, false, false];
  const cornerBottom = [true, false, false, true];
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k < KINDS; k++) {
      for (let p = 0; p < 3; p++) {
        offs[(c * KINDS + k) * 3 + p] = cells.length;
        for (const [col0, row0, wgt] of XBR_OPS[n][k]) {
          // Rotate (col, row) c quarter turns about the block centre: (dx, dy) → (dy, −dx).
          let col = col0;
          let row = row0;
          for (let r = 0; r < c; r++) {
            const nc = row;
            row = n - 1 - col;
            col = nc;
          }
          // Pass in block terms: the corner's own quadrant, the one above/below it, the one beside it.
          const sameX = col >= half === cornerRight[c];
          const sameY = row >= half === cornerBottom[c];
          const pass = sameX && sameY ? 0 : sameX ? 1 : 2;
          if (pass !== p) continue;
          cells.push(row * n + col);
          weights.push(wgt);
        }
      }
    }
  }
  offs[4 * KINDS * 3] = cells.length;
  return { offs, cells: Int32Array.from(cells), weights: Int32Array.from(weights) };
}

/**
 * Premultiplied blend of `dst` toward `src` by w/256. Transparent pixels carry no colour, so
 * edges fade out in the sprite's own colour (no dark halo).
 */
function blendToward(dst: number, src: number, w: number): number {
  if (w >= 256) return src;
  if (dst === src) return dst;
  const iw = 256 - w;
  const da = dst & 255;
  const sa = src & 255;
  const wd = da * iw;
  const ws = sa * w;
  const a = (wd + ws + 128) >> 8;
  if (a === 0) return 0;
  const t = wd + ws;
  const r = Math.round((((dst >>> 24) & 255) * wd + ((src >>> 24) & 255) * ws) / t);
  const g = Math.round((((dst >>> 16) & 255) * wd + ((src >>> 16) & 255) * ws) / t);
  const b = Math.round((((dst >>> 8) & 255) * wd + ((src >>> 8) & 255) * ws) / t);
  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/**
 * xBR (Hyllian) at 2× or 4×. Detects edges by weighted YUV distances over a 5×5
 * neighbourhood, then blends each corner of the output block toward the colour across the
 * edge. Transparent pixels are one distinct colour, far from every opaque colour.
 */
export function xbr(buf: PixelBuffer, n: 2 | 4): PixelBuffer {
  const { w, h } = buf;
  const out = new PixelBuffer(w * n, h * n);
  if (w === 0 || h === 0) return out;
  let tables = xbrTables.get(n);
  if (!tables) {
    tables = buildXbrTables(n);
    xbrTables.set(n, tables);
  }
  const { offs, cells, weights } = tables;
  const s = padSource(buf);
  const sw = w + 2 * PAD;
  const len = s.length;

  // Integer YUV + alpha per padded pixel (integer sums are exact, so ties stay symmetric).
  const Y = new Int32Array(len);
  const U = new Int32Array(len);
  const V = new Int32Array(len);
  const AL = new Int32Array(len);
  let last = 0;
  let ly = 0;
  let lu = 0;
  let lv = 0;
  for (let i = 0; i < len; i++) {
    const c = s[i];
    const a = c & 255;
    if (a === 0) continue;
    if (c !== last) {
      const r = (c >>> 24) & 255;
      const g = (c >>> 16) & 255;
      const b = (c >>> 8) & 255;
      ly = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      lu = Math.round(-0.168736 * r - 0.331264 * g + 0.5 * b);
      lv = Math.round(0.5 * r - 0.418688 * g - 0.081312 * b);
      last = c;
    }
    Y[i] = ly;
    U[i] = lu;
    V[i] = lv;
    AL[i] = a;
  }

  // Almost every comparison in the kernel is between diagonal neighbours. Precompute, per
  // pixel p, the distance and the "same colour" flag to p + (1, −1) (slot 0) and to
  // p + (1, 1) (slot 1).
  const dd = new Int32Array(2 * len);
  const sm = new Uint8Array(2 * len);
  for (let i = sw; i < len - sw - 1; i++) {
    const j0 = i - sw + 1;
    const j1 = i + sw + 1;
    if (s[i] === s[j0]) sm[2 * i] = 1;
    else {
      dd[2 * i] = dist(Y, U, V, AL, i, j0);
      sm[2 * i] = similar(Y, U, V, AL, i, j0) ? 1 : 0;
    }
    if (s[i] === s[j1]) sm[2 * i + 1] = 1;
    else {
      dd[2 * i + 1] = dist(Y, U, V, AL, i, j1);
      sm[2 * i + 1] = similar(Y, U, V, AL, i, j1) ? 1 : 0;
    }
  }

  // Neighbour offsets per corner: the bottom-right set rotated by (dx, dy) → (dy, −dx).
  // nb order: I H F G C D B F4 I4 H5 I5 (names as in the bottom-right kernel).
  // pr: the diagonal pairs E-C, E-G, I-H5, I-F4, H-F, H-D, H-I5, F-I4, F-B, E-I as
  // indices into dd/sm relative to 2·E.
  const base = [
    [1, 1], [0, 1], [1, 0], [-1, 1], [1, -1], [-1, 0], [0, -1], [2, 0], [2, 1], [0, 2], [1, 2],
  ];
  const pairs = [
    [0, 0, 1, -1], [0, 0, -1, 1], [1, 1, 0, 2], [1, 1, 2, 0], [0, 1, 1, 0],
    [0, 1, -1, 0], [0, 1, 1, 2], [1, 0, 2, 1], [1, 0, 0, -1], [0, 0, 1, 1],
  ];
  const rot = (dx: number, dy: number, c: number): [number, number] => {
    for (let r = 0; r < c; r++) {
      const t = dx;
      dx = dy;
      dy = -t;
    }
    return [dx, dy];
  };
  const nb = new Int32Array(4 * 11);
  const pr = new Int32Array(4 * 10);
  for (let c = 0; c < 4; c++) {
    for (let j = 0; j < 11; j++) {
      const [dx, dy] = rot(base[j][0], base[j][1], c);
      nb[c * 11 + j] = dy * sw + dx;
    }
    for (let j = 0; j < 10; j++) {
      let [ax, ay] = rot(pairs[j][0], pairs[j][1], c);
      let [bx, by] = rot(pairs[j][2], pairs[j][3], c);
      if (bx < ax) [ax, ay, bx, by] = [bx, by, ax, ay];
      pr[c * 10 + j] = 2 * (ay * sw + ax) + (by > ay ? 1 : 0);
    }
  }

  const o = out.data;
  const ow = w * n;
  const nn = n * n;
  const blk = new Uint32Array(nn);
  const kind = new Int32Array(4);
  const pxs = new Uint32Array(4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = (y + PAD) * sw + x + PAD;
      const E = s[e];
      const ob = y * n * ow + x * n;
      // A corner only fires when E differs from both pixels beside it (right/below for the
      // bottom-right corner, and so on), so most pixels skip the kernel entirely.
      const R = E === s[e + 1];
      const L = E === s[e - 1];
      const T = E === s[e - sw];
      const B = E === s[e + sw];
      let any = false;
      if ((R || B) && (R || T) && (L || T) && (L || B)) {
        for (let r = 0; r < n; r++) {
          const row = ob + r * ow;
          for (let col = 0; col < n; col++) o[row + col] = E;
        }
        continue;
      }
      for (let c = 0; c < 4; c++) {
        kind[c] = K_NONE;
        const q = c * 11;
        const h0 = e + nb[q + 1];
        const f0 = e + nb[q + 2];
        const H = s[h0];
        const F = s[f0];
        if (E === H || E === F) continue;
        const t2 = 2 * e;
        const r0 = c * 10;
        const de =
          dd[t2 + pr[r0]] + dd[t2 + pr[r0 + 1]] + dd[t2 + pr[r0 + 2]] + dd[t2 + pr[r0 + 3]] + 4 * dd[t2 + pr[r0 + 4]];
        const di =
          dd[t2 + pr[r0 + 5]] + dd[t2 + pr[r0 + 6]] + dd[t2 + pr[r0 + 7]] + dd[t2 + pr[r0 + 8]] + 4 * dd[t2 + pr[r0 + 9]];
        if (de > di) continue;
        // Colour across the edge: the closer of F and H; on a tie the darker, then the lower
        // packed value (symmetric, unlike the reference's "prefer F").
        const dEF = dist(Y, U, V, AL, e, f0);
        const dEH = dist(Y, U, V, AL, e, h0);
        const px =
          dEF < dEH ? F : dEH < dEF ? H : Y[f0] < Y[h0] ? F : Y[h0] < Y[f0] ? H : F < H ? F : H;
        pxs[c] = px;
        any = true;
        if (de === di) {
          kind[c] = K_WEAK;
          continue;
        }
        // F-B, H-D, E-I, F-I4, H-I5, E-G, E-C.
        const restrict =
          (sm[t2 + pr[r0 + 8]] === 0 && sm[t2 + pr[r0 + 5]] === 0) ||
          (sm[t2 + pr[r0 + 9]] === 1 && sm[t2 + pr[r0 + 7]] === 0 && sm[t2 + pr[r0 + 6]] === 0) ||
          sm[t2 + pr[r0 + 1]] === 1 ||
          sm[t2 + pr[r0]] === 1;
        if (!restrict) {
          kind[c] = K_WEAK;
          continue;
        }
        const g0 = e + nb[q + 3];
        const c0 = e + nb[q + 4];
        const G = s[g0];
        const C = s[c0];
        const ke = G === F ? 0 : dist(Y, U, V, AL, f0, g0);
        const ki = C === H ? 0 : dist(Y, U, V, AL, h0, c0);
        const left = 2 * ke <= ki && E !== G && s[e + nb[q + 5]] !== G;
        const up = ke >= 2 * ki && E !== C && s[e + nb[q + 6]] !== C;
        kind[c] = left ? (up ? K_LEFTUP : K_LEFT) : up ? K_UP : K_DIA;
      }
      if (!any) {
        for (let r = 0; r < n; r++) {
          const row = ob + r * ow;
          for (let col = 0; col < n; col++) o[row + col] = E;
        }
        continue;
      }
      blk.fill(E);
      for (let p = 0; p < 3; p++) {
        for (let c = 0; c < 4; c++) {
          const k = kind[c];
          if (k === K_NONE) continue;
          const t = (c * KINDS + k) * 3 + p;
          const end = offs[t + 1];
          const px = pxs[c];
          for (let j = offs[t]; j < end; j++) {
            const cell = cells[j];
            blk[cell] = blendToward(blk[cell], px, weights[j]);
          }
        }
      }
      for (let r = 0; r < n; r++) {
        const row = ob + r * ow;
        for (let col = 0; col < n; col++) o[row + col] = blk[r * n + col];
      }
    }
  }
  return out;
}

/** xBR colour distance (HQx weights 48/7/6 on Y/U/V, plus an alpha term); 0 only if equal. */
function dist(Y: Int32Array, U: Int32Array, V: Int32Array, AL: Int32Array, a: number, b: number): number {
  return (
    48 * Math.abs(Y[a] - Y[b]) +
    7 * Math.abs(U[a] - U[b]) +
    6 * Math.abs(V[a] - V[b]) +
    64 * Math.abs(AL[a] - AL[b])
  );
}

/** xBR "same colour" test: equal alpha and YUV within the HQx thresholds. */
function similar(Y: Int32Array, U: Int32Array, V: Int32Array, AL: Int32Array, a: number, b: number): boolean {
  return (
    AL[a] === AL[b] &&
    Math.abs(Y[a] - Y[b]) <= 48 &&
    Math.abs(U[a] - U[b]) <= 7 &&
    Math.abs(V[a] - V[b]) <= 6
  );
}
