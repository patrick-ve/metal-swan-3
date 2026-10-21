/**
 * Small deterministic helpers of the oldenzaal weather (fog, rain): a value noise that tiles in x
 * (period = the layer width) and the colour snap per density (1× → the 64-colour PAL, 2× / 4× →
 * the colour itself when it is a PAL_HD / PAL_HD_OZ colour, else the nearest of HD_FULL_PALETTE).
 * Same input, same output: only hashes of the arguments.
 */
import type { Color } from '../../../../engine/color';
import { nearest as nearestPal } from '../../../../engine/palette';
import { HD_FULL_PALETTE, inHdPalette } from '../../../../engine/palette-hd';
import { hash2 } from '../../../art/paint';

export type Dn = 1 | 2 | 4;

const hdCache = new Map<number, Color>();

/** The nearest HD_FULL_PALETTE colour (plain RGB distance; cached). */
function nearestFull(c: Color): Color {
  const k = (c | 255) >>> 0;
  const hit = hdCache.get(k);
  if (hit !== undefined) return hit;
  const r = (k >>> 24) & 255;
  const g = (k >>> 16) & 255;
  const b = (k >>> 8) & 255;
  let best = HD_FULL_PALETTE[0] >>> 0;
  let bd = Infinity;
  for (const p of HD_FULL_PALETTE) {
    const dr = ((p >>> 24) & 255) - r;
    const dg = ((p >>> 16) & 255) - g;
    const db = ((p >>> 8) & 255) - b;
    const dd = dr * dr * 3 + dg * dg * 4 + db * db * 2;
    if (dd < bd) {
      bd = dd;
      best = p >>> 0;
    }
  }
  hdCache.set(k, best);
  return best;
}

/** The opaque palette colour of density d for `c` (PAL at 1, HD at 2 and 4). */
export function snapColor(c: Color, d: Dn): Color {
  const o = (c | 255) >>> 0;
  if (d === 1) return (nearestPal(o) | 255) >>> 0;
  return inHdPalette(o) ? o : nearestFull(o);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise at (x, y) (logical px, fractional ok) on a lattice of `cw` × `ch` px cells that
 * repeats every `period` px in x (period must be a multiple of cw). Result 0..1.
 */
export function vnoise(x: number, y: number, cw: number, ch: number, period: number, seed: number): number {
  const n = Math.max(1, Math.round(period / cw));
  const gx = x / cw;
  const gy = y / ch;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smooth(gx - ix);
  const fy = smooth(gy - iy);
  const x0 = ((ix % n) + n) % n;
  const x1 = (x0 + 1) % n;
  const a = hash2(x0, iy, seed);
  const b = hash2(x1, iy, seed);
  const c = hash2(x0, iy + 1, seed);
  const d = hash2(x1, iy + 1, seed);
  const top = a + (b - a) * fx;
  const bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
}

/** Three octaves of `vnoise` (cells cw, cw/2, cw/4), tiling in x with `period`. 0..1. */
export function fbm(x: number, y: number, cw: number, ch: number, period: number, seed: number): number {
  let s = 0;
  let amp = 0.55;
  let tot = 0;
  for (let o = 0; o < 3; o++) {
    const k = 1 << o;
    s += vnoise(x, y, cw / k, ch / k, period, seed + o * 101) * amp;
    tot += amp;
    amp *= 0.5;
  }
  return s / tot;
}
