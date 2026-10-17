/**
 * Wall and door textures of the first-person mode (docs/design/fps.md §8.1): 64 × 64, opaque,
 * palette-only, code-generated, original. Every painter wraps x (mod 64), so a texture tiles
 * without a seam on its left / right edges (the engine repeats a texture along a wall run).
 *
 * The historical symbol appears ONLY on the two banner walls (`concrete-banner`,
 * `hangar-banner`), the user-approved scope (spec §0). Nothing else carries it.
 *
 * Never traced from the reference game: our own industrial setting (depot, hangar).
 */
import type { Color } from '../../engine/color';
import { INK, PAL, type Ramp } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import { bayer, hash2, noise2x } from './paint';

export const TEX = 64;
const M = TEX - 1;

// ------------------------------------------------------------------------------------ helpers

export function texBuf(): PixelBuffer {
  return new PixelBuffer(TEX, TEX);
}

/** Set a texel with x wrapped (seamless left / right). */
export function wset(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (y < 0 || y > M) return;
  b.data[(y | 0) * TEX + ((((x | 0) % TEX) + TEX) % TEX)] = c;
}

export function wget(b: PixelBuffer, x: number, y: number): Color {
  return b.data[Math.max(0, Math.min(M, y | 0)) * TEX + ((((x | 0) % TEX) + TEX) % TEX)];
}

/** Filled rect with x wrapped. */
export function wrect(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) wset(b, xx, yy, c);
}

export function whline(b: PixelBuffer, x0: number, x1: number, y: number, c: Color): void {
  for (let x = x0; x <= x1; x++) wset(b, x, y, c);
}

export function wvline(b: PixelBuffer, x: number, y0: number, y1: number, c: Color): void {
  for (let y = y0; y <= y1; y++) wset(b, x, y, c);
}

/** Move a texel `d` steps along a ramp it belongs to (no-op for other colours). */
function stepIn(r: Ramp, c: Color, d: number): Color {
  const i = r.indexOf(c);
  if (i < 0) return c;
  return r[Math.max(0, Math.min(r.length - 1, i + d))];
}

/**
 * Seamless noisy fill: tone = base + amp × (noise − 0.5), dithered into the ramp (ordered dither,
 * so it reads as texture, not as random speckle).
 */
export function noiseFill(b: PixelBuffer, r: Ramp, base: number, amp: number, scale: number, seed: number, x0 = 0, y0 = 0, w = TEX, h = TEX): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const n = noise2x(x, y, scale, TEX, seed) * 0.7 + noise2x(x, y, Math.max(2, scale / 3), TEX, seed + 7) * 0.3;
      const v = base + amp * (n - 0.5);
      wset(b, x, y, r[Math.max(0, Math.min(r.length - 1, band(v, x, y)))]);
    }
  }
}

/** Ramp index for a tone: flat bands with a narrow ordered-dither border (no checkerboard fields). */
export function band(v: number, x: number, y: number): number {
  const i = Math.floor(v);
  const f = v - i;
  if (f < 0.4) return i;
  if (f > 0.6) return i + 1;
  return (f - 0.4) / 0.2 > bayer(x, y) ? i + 1 : i;
}

/** `n` single texels of `c` at hashed spots (deterministic). */
export function speck(b: PixelBuffer, seed: number, n: number, c: Color, x0 = 0, y0 = 0, w = TEX, h = TEX): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(hash2(i, 1, seed) * w);
    const y = y0 + Math.floor(hash2(i, 2, seed) * h);
    wset(b, x, y, c);
  }
}

/** A round rivet head: lit top-left, dark bottom-right. */
export function rivet(b: PixelBuffer, x: number, y: number, r: Ramp = PAL.steel): void {
  wset(b, x, y, r[3]);
  wset(b, x + 1, y, r[2]);
  wset(b, x, y + 1, r[2]);
  wset(b, x + 1, y + 1, r[0]);
}

/** A raised panel edge: light line top / left, dark line bottom / right. */
export function bevel(b: PixelBuffer, x: number, y: number, w: number, h: number, lit: Color, dark: Color): void {
  whline(b, x, x + w - 1, y, lit);
  wvline(b, x, y, y + h - 1, lit);
  whline(b, x, x + w - 1, y + h - 1, dark);
  wvline(b, x + w - 1, y, y + h - 1, dark);
}

/** Vertical drip stain (rust / water) under a point. */
export function stain(b: PixelBuffer, x: number, y: number, len: number, r: Ramp, seed: number): void {
  for (let k = 0; k < len; k++) {
    const yy = y + k;
    const wob = hash2(k >> 2, 3, seed) < 0.3 ? 1 : 0;
    wset(b, x + wob, yy, stepIn(r, wget(b, x + wob, yy), -1) === wget(b, x + wob, yy) ? r[0] : stepIn(r, wget(b, x + wob, yy), -1));
    if (k < len * 0.6 && hash2(k, 5, seed) < 0.5) wset(b, x + 1 + wob, yy, stepIn(r, wget(b, x + 1 + wob, yy), -1));
  }
}

// ------------------------------------------------------------------------------------ the symbol

/**
 * The historical hooked cross (black, rotated 45°, hooks clockwise) inside a radius `r` around
 * (cx, cy). Sampled per texel from its geometry. Used on banners and flags only (spec §0).
 */
export function hookedCross(b: PixelBuffer, cx: number, cy: number, r: number, c: Color, wrap = true): void {
  const arm = r * 0.78; // half length of the bars
  const t = Math.max(1.2, r * 0.2); // half thickness
  const s = Math.SQRT1_2;
  const inside = (u: number, v: number): boolean => {
    // the cross
    if (Math.abs(u) <= t && Math.abs(v) <= arm) return true;
    if (Math.abs(v) <= t && Math.abs(u) <= arm) return true;
    // hooks (clockwise): top bar → right, right bar → down, bottom bar → left, left bar → up
    if (Math.abs(v + arm) <= t && u >= -t && u <= arm) return true;
    if (Math.abs(u - arm) <= t && v >= -t && v <= arm) return true;
    if (Math.abs(v - arm) <= t && u <= t && u >= -arm) return true;
    if (Math.abs(u + arm) <= t && v <= t && v >= -arm) return true;
    return false;
  };
  const R = Math.ceil(r * 1.5);
  for (let y = Math.floor(cy - R); y <= cy + R; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = (dx + dy) * s;
      const v = (dy - dx) * s;
      if (!inside(u, v)) continue;
      if (wrap) wset(b, x, y, c);
      else b.set(x, y, c);
    }
  }
}

/**
 * A hanging cloth banner: red field, a white disc with the symbol, darker folds, a rod and a
 * hem. (x, y) top-left of the cloth.
 */
export function banner(b: PixelBuffer, x: number, y: number, w: number, h: number, wrap = true): void {
  const put = (xx: number, yy: number, c: Color): void => (wrap ? wset(b, xx, yy, c) : b.set(xx, yy, c));
  // rod + brackets
  for (let xx = x - 3; xx < x + w + 3; xx++) {
    put(xx, y - 2, PAL.steel[1]);
    put(xx, y - 1, PAL.steel[0]);
  }
  put(x - 4, y - 2, PAL.brass[2]);
  put(x + w + 3, y - 2, PAL.brass[2]);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      // vertical folds: a soft cosine across the width
      const f = Math.cos(((xx - x) / w) * Math.PI * 3);
      const k = f > 0.55 ? 2 : f < -0.6 ? 0 : 1;
      const edge = xx === x || xx === x + w - 1;
      put(xx, yy, edge ? PAL.red[0] : PAL.red[k + 0]);
    }
  }
  // lit top band and hem shadow
  for (let xx = x; xx < x + w; xx++) put(xx, y, PAL.red[2]);
  // disc
  const cx = x + w / 2;
  const cy = y + Math.min(h * 0.42, w * 0.62);
  const dr = Math.min(w * 0.38, h * 0.3);
  for (let yy = Math.floor(cy - dr - 1); yy <= cy + dr + 1; yy++) {
    for (let xx = Math.floor(cx - dr - 1); xx <= cx + dr + 1; xx++) {
      const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy);
      if (d <= dr) put(xx, yy, d > dr - 1 ? PAL.cloth[1] : PAL.snow[2]);
    }
  }
  hookedCross(b, cx, cy, dr * 0.82, INK, wrap);
  // swallow-tail hem
  for (let i = 0; i < 4; i++) {
    for (let xx = x + i; xx < x + w - i; xx++) {
      if (Math.abs(xx + 0.5 - cx) < i + 1) continue;
      put(xx, y + h + i, PAL.red[0]);
    }
  }
}

// ------------------------------------------------------------------------------------ materials

function concrete(b: PixelBuffer): void {
  const r: Ramp = [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]];
  noiseFill(b, r, 1.5, 0.9, 14, 101);
  // form-board lines (shuttering): faint horizontals every 8 rows, a panel joint every 32 px
  for (let y = 7; y < TEX; y += 8) for (let x = 0; x < TEX; x++) if (hash2(x >> 3, y, 3) < 0.75) wset(b, x, y, stepIn(r, wget(b, x, y), -1));
  for (let y = 0; y < TEX; y++) {
    wset(b, 0, y, PAL.stone[0]);
    wset(b, 1, y, PAL.stone[2]);
    wset(b, 32, y, PAL.stone[0]);
    wset(b, 33, y, PAL.stone[2]);
  }
  // the shuttering joints at v 20 and v 44: never at v 28–36, the eye-line rows that every wall
  // in view shares at eyeZ 0.5 (one dark line across the screen read as a render seam)
  for (const jy of [20, 44]) {
    for (let x = 0; x < TEX; x++) {
      wset(b, x, jy, PAL.stone[0]);
      wset(b, x, jy + 1, PAL.stone[2]);
    }
  }
  // tie-rod holes
  for (const [x, y] of [[8, 10], [24, 10], [40, 10], [56, 10], [8, 54], [24, 54], [40, 54], [56, 54]] as const) {
    wset(b, x, y, INK);
    wset(b, x + 1, y, PAL.stone[0]);
    wset(b, x, y + 1, PAL.stone[0]);
  }
  // water stains under the joints
  stain(b, 20, 46, 12, r, 5);
  stain(b, 50, 22, 12, r, 9);
  // dirty skirting
  for (let y = 58; y < TEX; y++) for (let x = 0; x < TEX; x++) if (hash2(x, y, 4) < (y - 56) / 9) wset(b, x, y, stepIn(r, wget(b, x, y), -1));
}

function brick(b: PixelBuffer): void {
  const mortar = PAL.stone[1];
  b.fill(mortar);
  for (let row = 0; row < 8; row++) {
    const off = row & 1 ? 8 : 0;
    for (let col = 0; col < 4; col++) {
      const x0 = col * 16 + off;
      const y0 = row * 8;
      const tone = hash2(col, row, 41);
      const base = tone < 0.15 ? PAL.rust[1] : tone < 0.3 ? PAL.red[0] : PAL.red[1];
      const lit = tone < 0.15 ? PAL.orange[0] : PAL.red[2];
      const dark = PAL.red[0] === base ? INK : PAL.red[0];
      for (let x = 1; x < 16; x++) {
        for (let y = 1; y < 8; y++) {
          let c = base;
          if (y === 1) c = lit;
          else if (y === 7 || x === 15) c = dark;
          else if (hash2(x0 + x, y0 + y, 42) < 0.025) c = dark;
          else if (y === 2 && hash2(x0 + x, y0 + y, 43) < 0.3) c = lit;
          wset(b, x0 + x, y0 + y, c);
        }
      }
    }
  }
  // soot near the floor, a few chipped corners
  for (let y = 52; y < TEX; y++) for (let x = 0; x < TEX; x++) if ((y - 50) / 14 > bayer(x, y)) wset(b, x, y, stepIn(PAL.red, wget(b, x, y), -1));
}

function crates(b: PixelBuffer): void {
  const wood: Ramp = [PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]];
  b.fill(PAL.brown[0]);
  const box = (x: number, y: number, w: number, h: number, seed: number): void => {
    for (let yy = y + 1; yy < y + h - 1; yy++) {
      for (let xx = x + 1; xx < x + w - 1; xx++) {
        const plank = Math.floor((yy - y) / 6);
        const g = hash2(xx >> 1, plank, seed) < 0.12 ? 1 : 2;
        wset(b, xx, yy, (yy - y) % 6 === 0 ? wood[1] : wood[g + (hash2(plank, 9, seed) < 0.3 ? 1 : 0)]);
      }
    }
    bevel(b, x + 1, y + 1, w - 2, h - 2, wood[3], wood[0]);
    // frame boards
    wrect(b, x + 1, y + 1, w - 2, 3, wood[1]);
    wrect(b, x + 1, y + h - 4, w - 2, 3, wood[1]);
    wrect(b, x + 1, y + 1, 3, h - 2, wood[1]);
    wrect(b, x + w - 4, y + 1, 3, h - 2, wood[1]);
    whline(b, x + 1, x + w - 2, y + 1, wood[2]);
    // stencil bars (no text)
    wrect(b, x + (w >> 1) - 7, y + (h >> 1) - 3, 14, 2, PAL.sand[2]);
    wrect(b, x + (w >> 1) - 5, y + (h >> 1) + 1, 10, 2, PAL.sand[2]);
    // nails
    for (const [nx, ny] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) wset(b, nx, ny, PAL.steel[2]);
  };
  box(0, 0, 32, 30, 1);
  box(32, 0, 32, 30, 2);
  box(-12, 30, 40, 34, 3);
  box(28, 30, 24, 34, 4);
}

function woodPanel(b: PixelBuffer): void {
  const r: Ramp = [PAL.brown[0], PAL.brown[1], PAL.brown[2]];
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const board = x >> 4;
      const grain = noise2x(x * 3, y * 0.35 + board * 40, 6, TEX * 3, 61 + board);
      const v = 0.6 + grain * 1.2 + (hash2(board, 0, 62) - 0.5) * 0.5;
      wset(b, x, y, r[Math.max(0, Math.min(2, band(v, x, y)))]);
    }
  }
  for (let x = 0; x < TEX; x += 16) {
    wvline(b, x, 0, M, INK);
    wvline(b, x + 1, 0, M, PAL.brown[2]);
  }
  // rail and skirting
  wrect(b, 0, 20, TEX, 3, PAL.brown[1]);
  whline(b, 0, M, 20, PAL.brown[3]);
  whline(b, 0, M, 22, PAL.brown[0]);
  wrect(b, 0, 56, TEX, 8, PAL.brown[0]);
  whline(b, 0, M, 56, PAL.brown[2]);
  whline(b, 0, M, 57, PAL.brown[1]);
  // knots
  for (const [x, y] of [[9, 40], [41, 10], [27, 47], [57, 32]] as const) {
    wset(b, x, y, PAL.brown[0]);
    wset(b, x + 1, y, INK);
    wset(b, x, y + 1, PAL.brown[0]);
  }
}

/** Steel plate rows: the plate joints sit at v 20 and v 44, clear of the eye-line rows 28–36. */
const PLATE_ROWS: readonly (readonly [number, number])[] = [
  [0, 20],
  [20, 24],
  [44, 20],
];

function steelPlate(b: PixelBuffer): void {
  const r: Ramp = PAL.steel;
  noiseFill(b, [r[1], r[1], r[2]], 0.9, 0.9, 16, 71);
  for (const [y, h] of PLATE_ROWS) {
    for (let px = 0; px < 2; px++) {
      const x = px * 32;
      bevel(b, x, y, 32, h, r[3], r[0]);
      bevel(b, x + 1, y + 1, 30, h - 2, r[2], r[1]);
      for (let k = 4; k < h - 2; k += 6) {
        rivet(b, x + 3, y + k - 1);
        rivet(b, x + 27, y + k - 1);
      }
    }
  }
  stain(b, 14, 45, 14, [PAL.rust[0], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 72);
  speck(b, 73, 18, PAL.rust[0], 0, 0, TEX, TEX);
}

function vent(b: PixelBuffer, x: number, y: number, w: number, h: number): void {
  wrect(b, x - 1, y - 1, w + 2, h + 2, PAL.steel[3]);
  wrect(b, x, y, w, h, INK);
  for (let yy = y + 1; yy < y + h - 1; yy += 3) {
    whline(b, x + 1, x + w - 2, yy, PAL.steel[2]);
    whline(b, x + 1, x + w - 2, yy + 1, PAL.steel[0]);
  }
  bevel(b, x - 1, y - 1, w + 2, h + 2, PAL.steel[4], PAL.steel[0]);
  rivet(b, x, y);
  rivet(b, x + w - 2, y);
  rivet(b, x, y + h - 2);
  rivet(b, x + w - 2, y + h - 2);
}

function corrugated(b: PixelBuffer): void {
  // ribs every 8 px: lit flank, crest, shadow flank
  const prof = [1, 2, 3, 3, 2, 1, 0, 0];
  const r: Ramp = [PAL.slate[0], PAL.slate[1], PAL.slate[2], PAL.slate[3]];
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) wset(b, x, y, r[prof[x & 7]]);
  // the sheet overlap (at v 46: clear of the eye-line rows 28–36) and fixing screws
  whline(b, 0, M, 46, INK);
  whline(b, 0, M, 47, PAL.slate[3]);
  for (let x = 2; x < TEX; x += 8) {
    wset(b, x, 3, PAL.steel[4]);
    wset(b, x, 44, PAL.steel[4]);
    wset(b, x, 50, PAL.steel[4]);
    wset(b, x, 60, PAL.steel[4]);
  }
  // rust runs from the screws
  for (let i = 0; i < 6; i++) {
    const x = 2 + 8 * Math.floor(hash2(i, 0, 81) * 8);
    const y0 = hash2(i, 1, 81) < 0.5 ? 4 : 51;
    const len = 6 + Math.floor(hash2(i, 2, 81) * 14);
    for (let k = 0; k < len; k++) wset(b, x, y0 + k, k < len / 2 ? PAL.rust[1] : PAL.rust[0]);
  }
}

function freight(b: PixelBuffer): void {
  // weathered vertical planks, a heavy rail on top, a strap with bolts
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const plank = Math.floor(x / 8);
      const g = noise2x(x, y * 0.25, 4, TEX, 90 + plank);
      const k = g > 0.62 ? 3 : g > 0.35 ? 2 : 1;
      const tone = hash2(plank, 0, 91) < 0.3 ? 0 : 1;
      wset(b, x, y, [PAL.brown[0], PAL.brown[1], PAL.rust[0], PAL.brown[2], PAL.stone[1]][Math.min(4, k + tone)]);
    }
  }
  for (let x = 0; x < TEX; x += 8) {
    wvline(b, x, 0, M, INK);
    wvline(b, x + 1, 0, M, PAL.brown[0]);
  }
  // sliding-door rail
  wrect(b, 0, 2, TEX, 5, PAL.steel[1]);
  whline(b, 0, M, 2, PAL.steel[3]);
  whline(b, 0, M, 6, PAL.steel[0]);
  for (let x = 4; x < TEX; x += 16) rivet(b, x, 4);
  // iron straps
  for (const y of [24, 48]) {
    wrect(b, 0, y, TEX, 3, PAL.steel[0]);
    whline(b, 0, M, y, PAL.steel[2]);
    for (let x = 3; x < TEX; x += 8) wset(b, x, y + 1, PAL.steel[3]);
  }
  // chalk-white faded stripe (no text)
  for (let x = 0; x < TEX; x++) if (hash2(x, 0, 92) < 0.7) wset(b, x, 38, PAL.stone[2]);
}

function tile(b: PixelBuffer): void {
  b.fill(PAL.stone[2]); // grout
  for (let ty = 0; ty < 8; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      const x = tx * 8;
      const y = ty * 8;
      const dirty = hash2(tx, ty, 101);
      const face = dirty < 0.06 ? PAL.stone[3] : PAL.snow[1];
      for (let yy = 1; yy < 8; yy++) for (let xx = 1; xx < 8; xx++) wset(b, x + xx, y + yy, face);
      whline(b, x + 1, x + 7, y + 1, PAL.snow[2]);
      wset(b, x + 7, y + 7, PAL.snow[0]);
      whline(b, x + 2, x + 7, y + 7, PAL.snow[0]);
      if (dirty > 0.94) {
        // a cracked tile
        for (let k = 0; k < 5; k++) wset(b, x + 2 + k, y + 2 + ((k * 3) >> 1) % 5, PAL.stone[1]);
      }
    }
  }
  // the lower half is a darker dado band
  for (let y = 40; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const c = wget(b, x, y);
    wset(b, x, y, c === PAL.snow[1] ? PAL.snow[0] : c === PAL.snow[2] ? PAL.snow[1] : c === PAL.snow[0] ? PAL.stone[3] : c);
  }
  whline(b, 0, M, 40, PAL.sky[0]);
  stain(b, 44, 41, 16, [PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[0]], 102);
}

function cellar(b: PixelBuffer): void {
  // rough stones in irregular courses, dark mortar
  b.fill(PAL.ink[1]);
  const rows = [0, 11, 22, 34, 45, 56, 64];
  for (let ri = 0; ri < rows.length - 1; ri++) {
    const y0 = rows[ri];
    const y1 = rows[ri + 1];
    let x = Math.floor(hash2(ri, 0, 111) * 12);
    const start = x;
    while (x < start + TEX) {
      const w = 10 + Math.floor(hash2(x, ri, 112) * 12);
      const tone = hash2(x, ri, 113);
      const r: Ramp = tone < 0.4 ? [PAL.stone[0], PAL.stone[1], PAL.stone[2]] : tone < 0.75 ? [PAL.brown[0], PAL.stone[0], PAL.stone[1]] : [PAL.steel[0], PAL.stone[1], PAL.stone[2]];
      const cx = x + w / 2;
      const cy = (y0 + y1) / 2;
      for (let yy = y0 + 1; yy < y1; yy++) {
        for (let xx = x + 1; xx < x + w; xx++) {
          const ex = (xx + 0.5 - cx) / (w / 2);
          const ey = (yy + 0.5 - cy) / ((y1 - y0) / 2);
          const d = ex * ex * ex * ex + ey * ey * ey * ey;
          if (d > 0.9) continue;
          const lit = -ex * 0.5 - ey * 0.8 + (hash2(xx, yy, 114) - 0.5) * 0.6;
          wset(b, xx, yy, r[lit > 0.35 ? 2 : lit < -0.35 ? 0 : 1]);
        }
      }
      x += w;
    }
  }
  // damp patch
  for (let y = 46; y < TEX; y++) for (let x = 10; x < 34; x++) if (hash2(x, y, 115) < 0.4) wset(b, x, y, stepIn([PAL.olive[0], PAL.stone[0], PAL.stone[1], PAL.stone[2]], wget(b, x, y), -1));
}

function sandbags(b: PixelBuffer): void {
  b.fill(PAL.sand[0]);
  const r: Ramp = [PAL.sand[0], PAL.sand[1], PAL.sand[2], PAL.sand[3]];
  for (let row = 0; row < 6; row++) {
    const h = 11;
    const y0 = row * 11 - 2;
    const off = row & 1 ? 10 : 0;
    for (let col = 0; col < 4; col++) {
      const x0 = col * 16 + off;
      const cx = x0 + 8;
      const cy = y0 + h / 2;
      for (let yy = y0; yy < y0 + h; yy++) {
        for (let xx = x0; xx < x0 + 16; xx++) {
          const ex = (xx + 0.5 - cx) / 8.2;
          const ey = (yy + 0.5 - cy) / 5.6;
          const d = ex * ex + ey * ey;
          if (d > 1) continue;
          const nz = Math.sqrt(1 - d);
          const lit = nz * 0.6 - ey * 0.6 - ex * 0.15 + (hash2(xx, yy, 120 + row) - 0.5) * 0.25;
          const k = lit > 0.62 ? 3 : lit > 0.3 ? 2 : lit > 0 ? 1 : 0;
          wset(b, xx, yy, r[k]);
        }
      }
      // tie and seam
      wset(b, x0 + 1, Math.round(cy), PAL.brown[1]);
      wset(b, x0 + 2, Math.round(cy), PAL.brown[1]);
      for (let xx = x0 + 4; xx < x0 + 13; xx += 2) wset(b, xx, Math.round(cy) - 3, PAL.sand[1]);
    }
  }
}

function pipes(b: PixelBuffer): void {
  steelPlate(b);
  const pipe = (y: number, rad: number, r: Ramp): void => {
    for (let k = -rad; k <= rad; k++) {
      const t = k / rad;
      const idx = t < -0.5 ? 3 : t < 0 ? 2 : t < 0.6 ? 1 : 0;
      whline(b, 0, M, y + k, r[idx]);
    }
    // flanges
    for (const fx of [10, 42]) {
      wrect(b, fx, y - rad - 1, 3, rad * 2 + 3, r[1]);
      wvline(b, fx, y - rad - 1, y + rad + 1, r[3]);
      wset(b, fx + 1, y - rad, PAL.steel[4]);
      wset(b, fx + 1, y + rad, PAL.steel[0]);
    }
  };
  pipe(14, 4, [PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]]);
  pipe(23, 2, [PAL.brown[0], PAL.rust[0], PAL.rust[1], PAL.orange[0]]); // clear of the eye-line rows 28–36
  pipe(48, 5, [PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3]]);
  // valve wheel on the green pipe
  const cx = 26;
  const cy = 48;
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    wset(b, Math.round(cx + Math.cos(t) * 7), Math.round(cy + Math.sin(t) * 7), PAL.red[a < 32 ? 2 : 1]);
  }
  for (let k = -6; k <= 6; k++) {
    wset(b, cx + k, cy, PAL.red[1]);
    wset(b, cx, cy + k, PAL.red[1]);
  }
  wrect(b, cx - 1, cy - 1, 3, 3, PAL.steel[3]);
  // drip
  stain(b, 33, 53, 9, [PAL.olive[0], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 131);
}

function elevator(b: PixelBuffer): void {
  // brushed-steel lift panels: fine horizontal brushing, two tall panels, a seam
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const brush = hash2(y, x >> 4, 141);
      wset(b, x, y, brush < 0.08 ? PAL.steel[2] : brush > 0.9 ? PAL.steel[4] : PAL.steel[3]);
    }
  }
  for (const x of [2, 33]) {
    bevel(b, x, 3, 29, 58, PAL.snow[1], PAL.steel[1]);
    bevel(b, x + 3, 6, 23, 52, PAL.steel[1], PAL.snow[0]);
  }
  wvline(b, 0, 0, M, PAL.steel[0]);
  wvline(b, 32, 0, M, PAL.steel[0]);
  whline(b, 0, M, 0, PAL.steel[1]);
  whline(b, 0, M, M, PAL.steel[0]);
  // little floor-indicator lamps along the top
  for (let x = 6; x < TEX; x += 8) wset(b, x, 1, x === 22 ? PAL.orange[1] : PAL.steel[1]);
}

function leverBox(b: PixelBuffer, on: boolean): void {
  elevator(b);
  const x = 18;
  const y = 14;
  wrect(b, x, y, 28, 34, PAL.steel[1]);
  bevel(b, x, y, 28, 34, PAL.steel[3], INK);
  wrect(b, x + 3, y + 3, 22, 28, PAL.steel[0]);
  // the slot and the lever
  wrect(b, x + 12, y + 6, 4, 22, INK);
  const ly = on ? y + 6 : y + 22;
  wrect(b, x + 7, ly, 14, 4, PAL.red[on ? 1 : 2]);
  whline(b, x + 7, x + 20, ly, PAL.red[3]);
  wrect(b, x + 13, on ? ly + 4 : y + 12, 2, on ? 10 : 10, PAL.steel[3]);
  // lamps: red (off) and green (on)
  wrect(b, x + 4, y + 30 - 26, 3, 3, on ? PAL.red[0] : PAL.red[3]);
  wrect(b, x + 21, y + 4, 3, 3, on ? PAL.green[3] : PAL.green[0]);
  wset(b, x + 5, y + 5, on ? PAL.red[0] : PAL.snow[3]);
  wset(b, x + 22, y + 5, on ? PAL.snow[3] : PAL.green[0]);
  // hazard stripes under the box
  for (let xx = x; xx < x + 28; xx++) for (let yy = y + 36; yy < y + 40; yy++) wset(b, xx, yy, ((xx + yy) >> 2) & 1 ? INK : PAL.gold[2]);
}

function doorSlab(b: PixelBuffer, plate: 'gold' | 'silver' | null): void {
  // a steel sliding door: a frame, two inset panels, a horizontal grip bar
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) wset(b, x, y, hash2(x >> 2, y, 151) < 0.15 ? PAL.slate[1] : PAL.slate[2]);
  bevel(b, 0, 0, TEX, TEX, PAL.slate[3], PAL.slate[0]);
  bevel(b, 1, 1, TEX - 2, TEX - 2, PAL.slate[3], PAL.slate[0]);
  for (const y of [5, 36]) {
    wrect(b, 6, y, 52, 23, PAL.slate[1]);
    bevel(b, 6, y, 52, 23, PAL.slate[0], PAL.slate[3]);
    for (let k = 0; k < 4; k++) whline(b, 9, 54, y + 4 + k * 5, PAL.slate[0]);
  }
  wrect(b, 2, 30, 60, 4, PAL.steel[1]);
  whline(b, 2, 61, 30, PAL.steel[3]);
  whline(b, 2, 61, 33, INK);
  for (let x = 4; x < TEX; x += 9) rivet(b, x, 31);
  if (plate) {
    const r = plate === 'gold' ? PAL.gold : [PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]];
    // a lock plate with a keyhole, centred on the bar
    wrect(b, 24, 22, 16, 20, r[1]);
    bevel(b, 24, 22, 16, 20, r[3], r[0]);
    wrect(b, 30, 27, 4, 4, INK);
    wrect(b, 31, 31, 2, 6, INK);
    wset(b, 26, 24, r[3]);
    wset(b, 37, 39, r[0]);
  }
}

function liftDoor(b: PixelBuffer): void {
  // brushed steel twin leaves with a centre gap and hazard edge
  elevator(b);
  wvline(b, 31, 0, M, INK);
  wvline(b, 32, 0, M, PAL.steel[1]);
  for (let y = 0; y < TEX; y++) {
    for (const x of [0, 1, 62, 63]) wset(b, x, y, ((x + y) >> 2) & 1 ? INK : PAL.gold[2]);
  }
  wrect(b, 26, 28, 3, 8, PAL.steel[1]);
  wrect(b, 35, 28, 3, 8, PAL.steel[1]);
}

function doorEdge(b: PixelBuffer): void {
  // the jamb: a steel channel with a guide groove and hazard stripes
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const band = x < 8 || x >= 56;
      wset(b, x, y, band ? (((x + y) >> 3) & 1 ? INK : PAL.gold[1]) : PAL.steel[1]);
    }
  }
  wrect(b, 26, 0, 12, TEX, PAL.steel[0]);
  wvline(b, 26, 0, M, PAL.steel[3]);
  wvline(b, 37, 0, M, INK);
  for (let y = 4; y < TEX; y += 12) {
    rivet(b, 14, y);
    rivet(b, 47, y);
  }
}

// ------------------------------------------------------------------------------------ the list

type Painter = (b: PixelBuffer) => void;

/** §8.1: id → painter. Spec letters in the comments. */
export const WALL_PAINTERS: Readonly<Record<string, Painter>> = {
  'fps/wall/concrete': concrete, // A
  'fps/wall/concrete-banner': (b) => {
    // B
    concrete(b);
    banner(b, 20, 6, 24, 46);
  },
  'fps/wall/brick': brick, // C
  'fps/wall/brick-notice': (b) => {
    // D: a cork board with pinned sheets of unreadable scribble
    brick(b);
    wrect(b, 12, 12, 40, 30, PAL.brown[2]);
    bevel(b, 11, 11, 42, 32, PAL.brown[3], PAL.brown[0]);
    speck(b, 161, 40, PAL.brown[1], 13, 13, 38, 28);
    const sheet = (x: number, y: number, w: number, h: number, c: Color, seed: number): void => {
      wrect(b, x, y, w, h, c);
      wvline(b, x + w, y + 1, y + h, PAL.brown[0]);
      whline(b, x + 1, x + w, y + h, PAL.brown[0]);
      for (let ly = y + 3; ly < y + h - 1; ly += 2) {
        const len = 2 + Math.floor(hash2(ly, x, seed) * (w - 5));
        for (let lx = x + 2; lx < x + 2 + len; lx++) if (hash2(lx, ly, seed + 1) < 0.75) wset(b, lx, ly, PAL.stone[1]);
      }
      wset(b, x + (w >> 1), y + 1, PAL.red[2]);
    };
    sheet(15, 15, 12, 16, PAL.snow[1], 162);
    sheet(30, 14, 10, 12, PAL.sand[3], 163);
    sheet(42, 17, 8, 10, PAL.snow[0], 164);
    sheet(28, 29, 16, 10, PAL.snow[1], 165);
  },
  'fps/wall/crates': crates, // E
  'fps/wall/wood': woodPanel, // F
  'fps/wall/wood-map': (b) => {
    // G: a pinned map of invented coastlines and pins
    woodPanel(b);
    const x0 = 10;
    const y0 = 26;
    const w = 44;
    const h = 28;
    wrect(b, x0 - 1, y0 - 1, w + 2, h + 2, PAL.brown[0]);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const land = noise2x(x * 1.3, y * 1.3, 9, TEX * 1.3, 171) > 0.52;
        wset(b, x, y, land ? PAL.sand[2] : PAL.sky[1]);
      }
    }
    // coastlines
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const c = wget(b, x, y);
        if (c === PAL.sand[2] && (wget(b, x + 1, y) === PAL.sky[1] || wget(b, x, y + 1) === PAL.sky[1] || wget(b, x - 1, y) === PAL.sky[1] || wget(b, x, y - 1) === PAL.sky[1])) wset(b, x, y, PAL.sand[0]);
      }
    }
    for (let x = x0; x < x0 + w; x += 11) wvline(b, x, y0, y0 + h - 1, PAL.sky[2]);
    for (let y = y0; y < y0 + h; y += 9) whline(b, x0, x0 + w - 1, y, PAL.sky[2]);
    for (const [px, py, c] of [[x0 + 12, y0 + 9, PAL.red[2]], [x0 + 30, y0 + 15, PAL.red[2]], [x0 + 22, y0 + 21, PAL.sky[0]], [x0 + 36, y0 + 6, PAL.red[2]]] as const) {
      wset(b, px, py, c);
      wset(b, px, py + 1, INK);
    }
    // a dashed route between pins
    for (let k = 0; k < 18; k += 2) wset(b, x0 + 12 + k, y0 + 10 + Math.round(k / 3), PAL.red[1]);
  },
  'fps/wall/steel': steelPlate, // H
  'fps/wall/steel-vent': (b) => {
    // I
    steelPlate(b);
    vent(b, 14, 18, 36, 26);
  },
  'fps/wall/hangar': corrugated, // J
  'fps/wall/hangar-banner': (b) => {
    // K: a tall banner over the ribbed sheet
    corrugated(b);
    banner(b, 18, 4, 28, 54);
  },
  'fps/wall/freight': freight, // L
  'fps/wall/tile': tile, // M
  'fps/wall/cellar': cellar, // N
  'fps/wall/sandbags': sandbags, // O
  'fps/wall/steel-pipes': pipes, // P
  'fps/wall/elevator': elevator, // Y
  'fps/wall/switch': (b) => leverBox(b, false), // X off
  'fps/wall/switch-on': (b) => leverBox(b, true), // X on
  'fps/door/plain': (b) => doorSlab(b, null),
  'fps/door/gold': (b) => doorSlab(b, 'gold'),
  'fps/door/silver': (b) => doorSlab(b, 'silver'),
  'fps/door/lift': liftDoor,
  'fps/door/edge': doorEdge,
};

/** Paint a §8.1 texture into a fresh 64 × 64 buffer. */
export function paintWall(id: string): PixelBuffer {
  const p = WALL_PAINTERS[id];
  if (!p) throw new Error(`unknown wall texture ${id}`);
  const b = texBuf();
  b.fill(PAL.stone[1]);
  p(b);
  return b.touch();
}
