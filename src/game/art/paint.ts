/**
 * Shared painting helpers for the procedural art rigs (humanoid, machines, backgrounds,
 * terrain). Pure and deterministic: no Math.random, every "random" value is a hash of
 * integer coordinates and a seed.
 *
 * - `R()` resolves a ramp given as a name or a ramp.
 * - Hash / value-noise helpers (1D periodic for tiling backgrounds, 2D for world textures).
 * - `shadeLayer()` — 3–4 tone shading of one flat part with a top-left light.
 * - `despeckle()` — removes isolated single pixels (clean clusters).
 * - `Composer` — stacks part layers back to front. Where a front part's 1-px ring falls on a
 *   part behind it, the ring is painted as a dark internal line (selective outline), and
 *   `finish()` adds the INK silhouette outline.
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, ramp as rampByName } from '../../engine/palette';

/** A ramp, or a palette ramp name such as 'olive' (aliases such as 'khaki' work). */
export type RampLike = Ramp | string;

/** Resolve a ramp name or pass a ramp through. */
export function R(r: RampLike): Ramp {
  return typeof r === 'string' ? rampByName(r) : r;
}

/** Colour i of a ramp, clamped. */
export function at(r: Ramp, i: number): Color {
  const k = Math.round(i);
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
}

// ------------------------------------------------------------------------------------ hashing

/** 32-bit integer hash of (x, y, seed) → [0, 1). Stable for any integer inputs. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 1D hash → [0, 1). */
export function hash1(x: number, seed = 0): number {
  return hash2(x, 0x5bd1e995, seed);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Smooth 1D value noise in [0, 1] that repeats every `period` units (period > 0, integer
 * lattice). `scale` is the lattice spacing in units. Use it for horizontally tiling layers:
 * pass period = buffer width so the left and right edges match.
 */
export function noise1(x: number, scale: number, period: number, seed: number): number {
  const cells = Math.max(1, Math.round(period / scale));
  const u = (x / period) * cells;
  const i = Math.floor(u);
  const f = u - i;
  const a = hash1(((i % cells) + cells) % cells, seed);
  const b = hash1((((i + 1) % cells) + cells) % cells, seed);
  return a + (b - a) * smooth(f);
}

/** Fractal (octave) sum of noise1, normalised to [0, 1]; still periodic in `period`. */
export function fbm1(x: number, scale: number, period: number, seed: number, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(x, s, period, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    s = Math.max(1, s / 2);
  }
  return sum / norm;
}

/** Smooth 2D value noise in [0, 1] on a lattice of `scale` px (world anchored, not periodic). */
export function noise2(x: number, y: number, scale: number, seed: number): number {
  const u = x / scale;
  const v = y / scale;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fx = smooth(u - i);
  const fy = smooth(v - j);
  const a = hash2(i, j, seed);
  const b = hash2(i + 1, j, seed);
  const c = hash2(i, j + 1, seed);
  const d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 2D noise that repeats every `periodX` px horizontally (seamless tiling layers). */
export function noise2x(x: number, y: number, scale: number, periodX: number, seed: number): number {
  const cells = Math.max(1, Math.round(periodX / scale));
  const u = (x / periodX) * cells;
  const v = y / scale;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fx = smooth(u - i);
  const fy = smooth(v - j);
  const i0 = ((i % cells) + cells) % cells;
  const i1 = (i0 + 1) % cells;
  const a = hash2(i0, j, seed);
  const b = hash2(i1, j, seed);
  const c = hash2(i0, j + 1, seed);
  const d = hash2(i1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 4×4 Bayer threshold in [0, 1) at a pixel (ordered dithering anchored to coordinates). */
export function bayer(x: number, y: number): number {
  const m = BAYER[((y & 3) << 2) | (x & 3)];
  return (m + 0.5) / 16;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither pick: index of a ramp for a continuous value v (ramp positions), at (x, y). */
export function ditherIndex(v: number, x: number, y: number, n: number): number {
  const i = Math.floor(v);
  const f = v - i;
  const k = f > bayer(x, y) ? i + 1 : i;
  return k < 0 ? 0 : k >= n ? n - 1 : k;
}

// ------------------------------------------------------------------------------------ shading

export interface ShadeOpts {
  /** Ramp index of the flat interior (default: 2 for 4+ colour ramps, else the middle). */
  base?: number;
  /** Width of the lit band on the top and left edges (0 = none, default 1). */
  hi?: number;
  /** Width of the shadow band on the bottom and right edges (0 = none, default 1). */
  lo?: number;
  /** Extra light pixel on lit corners (glints on helmets, boots, metal). */
  glint?: boolean;
  /** Shift every tone by this many ramp steps (−1 for far limbs). */
  shift?: number;
}

/**
 * Shade every non-transparent pixel of `layer` with `ramp`, lit from the top-left: pixels on
 * the top/left edge get base+1, pixels on the bottom/right edge get base−1, the rest base.
 * Pixels on both kinds of edge (1-px slivers) stay at base.
 */
export function shadeLayer(layer: PixelBuffer, ramp: Ramp, o: ShadeOpts = {}): PixelBuffer {
  const { w, h, data } = layer;
  const n = ramp.length;
  const base = o.base ?? (n >= 4 ? 2 : Math.floor((n - 1) / 2) + (n > 2 ? 1 : 0));
  const hi = o.hi ?? 1;
  const lo = o.lo ?? 1;
  const shift = o.shift ?? 0;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = (data[i] & 255) !== 0 ? 1 : 0;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === 0) continue;
      let lit = false;
      for (let k = 1; k <= hi && !lit; k++) lit = !inside(x - k, y) || !inside(x, y - k);
      let dark = false;
      for (let k = 1; k <= lo && !dark; k++) dark = !inside(x + k, y) || !inside(x, y + k);
      let idx = base;
      if (lit && !dark) idx = base + 1;
      else if (dark && !lit) idx = base - 1;
      // Glint: a convex top-left corner pixel with solid shape to its right and below.
      if (o.glint && lit && !dark && !inside(x, y - 1) && inside(x + 1, y) && inside(x, y + 1) && inside(x + 1, y + 1)) {
        idx = base + 2;
      }
      data[y * w + x] = at(ramp, idx + shift);
    }
  }
  layer.touch();
  return layer;
}

/**
 * Replace isolated pixels (a colour that no 4-neighbour inside the shape shares, while at
 * least three neighbours agree on another colour) with the neighbours' colour.
 */
export function despeckle(layer: PixelBuffer, keep?: ReadonlySet<Color>): PixelBuffer {
  const { w, h } = layer;
  const src = layer.data.slice();
  const nb: Color[] = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if ((c & 255) === 0 || keep?.has(c)) continue;
      let k = 0;
      if (x > 0 && (src[y * w + x - 1] & 255) !== 0) nb[k++] = src[y * w + x - 1];
      if (x < w - 1 && (src[y * w + x + 1] & 255) !== 0) nb[k++] = src[y * w + x + 1];
      if (y > 0 && (src[(y - 1) * w + x] & 255) !== 0) nb[k++] = src[(y - 1) * w + x];
      if (y < h - 1 && (src[(y + 1) * w + x] & 255) !== 0) nb[k++] = src[(y + 1) * w + x];
      if (k < 3) continue;
      let same = false;
      for (let i = 0; i < k; i++) if (nb[i] === c) same = true;
      if (same) continue;
      // Majority colour among the neighbours.
      for (let i = 0; i < k; i++) {
        let votes = 0;
        for (let j = 0; j < k; j++) if (nb[j] === nb[i]) votes++;
        if (votes >= 3) {
          layer.data[y * w + x] = nb[i];
          break;
        }
      }
    }
  }
  layer.touch();
  return layer;
}

// ------------------------------------------------------------------------------------ composer

export interface AddOpts {
  /**
   * Colour of this part's internal line where a LATER (front) part's ring falls on it.
   * Default: the darkest colour of `ramp` when given, else ink.
   */
  line?: Color;
  /** Ramp of the part (used for the default line colour). */
  ramp?: Ramp;
  /** Draw this part's ring onto the parts behind it (default true). */
  ring?: boolean;
  /** 8-connected ring (thicker corners) instead of the 4-connected default. */
  ringCorners?: boolean;
}

/**
 * Back-to-front part compositor with selective internal lines.
 *
 * ```ts
 * const c = new Composer(64, 64);
 * c.add(farArm, { ramp: skin });       // behind
 * c.add(torso, { ramp: olive });       // ring over the far arm → dark skin line
 * c.add(nearArm, { ramp: skin });      // ring over the torso → dark olive line
 * const buf = c.finish();              // + INK silhouette outline
 * ```
 */
export class Composer {
  readonly buf: PixelBuffer;
  readonly w: number;
  readonly h: number;
  /** Line colour of the part that owns each pixel (0 = empty). */
  private readonly lineOf: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new PixelBuffer(w, h);
    this.lineOf = new Uint32Array(w * h);
  }

  /** Composite a part layer (same size as the composer) over everything added so far. */
  add(layer: PixelBuffer, o: AddOpts = {}): this {
    const { w, h } = this;
    const src = layer.data;
    const dst = this.buf.data;
    const line = o.line ?? (o.ramp ? o.ramp[0] : INK);
    if (o.ring !== false) {
      const corners = o.ringCorners === true;
      const opaque = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < w && y < h && (src[y * w + x] & 255) !== 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if ((src[i] & 255) !== 0 || (dst[i] & 255) === 0) continue;
          let near = opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1);
          if (!near && corners) {
            near = opaque(x - 1, y - 1) || opaque(x + 1, y - 1) || opaque(x - 1, y + 1) || opaque(x + 1, y + 1);
          }
          // The line is the darkest shade of the part behind (a cast-shadow edge).
          if (near) dst[i] = this.lineOf[i] || INK;
        }
      }
    }
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if ((c & 255) === 0) continue;
      dst[i] = c;
      this.lineOf[i] = line;
    }
    this.buf.touch();
    return this;
  }

  /** Paint pixels directly (details that need no ring), recording their line colour. */
  paint(layer: PixelBuffer, line: Color = INK): this {
    const src = layer.data;
    const dst = this.buf.data;
    for (let i = 0; i < src.length; i++) {
      if ((src[i] & 255) === 0) continue;
      dst[i] = src[i];
      this.lineOf[i] = line;
    }
    this.buf.touch();
    return this;
  }

  /** Add the INK silhouette outline (4-connected) and return the buffer. */
  finish(outline: Color = INK): PixelBuffer {
    return this.buf.outline(outline);
  }
}

/** A blank layer the size of a composer. */
export function layerOf(c: Composer): PixelBuffer {
  return new PixelBuffer(c.w, c.h);
}

/** Flat placeholder colour used to draw part shapes before shading (never shown). */
export const FLAT: Color = 0xff00ffff;
