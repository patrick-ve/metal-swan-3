/**
 * The UHD background-layer kit of mission `ams` (docs/ART_GUIDE.md "UHD art", "Backgrounds"): a
 * FAST painter for whole parallax layers at density d ∈ {2, 4}. A layer is up to 1024 × 216
 * logical px (4096 × 864 art px at 4×), so it cannot afford the G-buffer of HdCanvas; instead:
 *
 * - `BgCanvas` paints PALETTE INDICES (a Uint8Array, 0 = clear) with span fills in art px that
 *   wrap in x (every layer tiles), logical-px rects, scan-line polygons and shaded discs; `finish()`
 *   turns the indices into PAL_HD colours with one table look-up per px. Indices make the canal's
 *   reflections and the haze a table look-up too.
 * - Light and depth are applied to COLOURS, once per layer (`Air`): the section's light (golden
 *   warms the highlights, sunset pinks them and cools the shade) and atmospheric perspective (a
 *   mix toward the haze colour of that light: far layers lighter, cooler, lower contrast), each
 *   result snapped to the nearest PAL_HD colour in Oklab. Painters then only pick indices.
 * - `dq` is the ordered dither (Bayer 8 × 8 on the art grid) used ONLY at band borders of large
 *   gradients (sky, clouds, walls, water); sprites never use it.
 *
 * Same input, same pixels: no randomness except the hashes callers pass.
 */
import type { Color } from '../../../../engine/color';
import { HD_PALETTE, hdHome } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { SceneryDensity } from '../../../art/art-registry';
import { hash2 } from '../../../art/paint';
import { isLight, type Light } from './art';

export type Den = SceneryDensity;
export type Params = Readonly<Record<string, unknown>>;

// ------------------------------------------------------------------------------------ params

export function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** A logical px value; numbers in (0, 1] are fractions of `of` (as the 1× generators read them). */
export function px(p: Params, k: string, d: number, of: number): number {
  const v = num(p, k, d);
  return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * of) : Math.round(v);
}

export function bool(p: Params, k: string, d: boolean): boolean {
  const v = p[k];
  return typeof v === 'boolean' ? v : d;
}

export function lightOf(p: Params): Light {
  return isLight(p.light) ? p.light : 'morning';
}

// ------------------------------------------------------------------------------------ colour

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** Palette index → colour (index 0 = clear). */
const LUT = new Uint32Array(256);
const INDEX = new Map<number, number>();
HD_PALETTE.forEach((c, i) => {
  LUT[i + 1] = c >>> 0;
  INDEX.set(c >>> 0, i + 1);
});

function lin(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

/** Oklab of a colour (alpha ignored). */
export function oklab(c: Color): [number, number, number] {
  const r = lin((c >>> 24) & 255);
  const g = lin((c >>> 16) & 255);
  const b = lin((c >>> 8) & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const PLAB = HD_PALETTE.map((c) => oklab(c));

/** The PAL_HD colour nearest to an Oklab point (chroma weighted a little up: keep hue families). */
export function nearestLab(L: number, a: number, b: number): Color {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < PLAB.length; i++) {
    const p = PLAB[i];
    const dl = p[0] - L;
    const da = p[1] - a;
    const db = p[2] - b;
    const dd = dl * dl + 1.4 * (da * da + db * db);
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  }
  return HD_PALETTE[best] >>> 0;
}

const nearCache = new Map<number, Color>();

/** The PAL_HD colour nearest to any colour (a PAL_HD colour maps to itself). */
export function nearestHd(c: Color): Color {
  const key = (c | 255) >>> 0;
  if (INDEX.has(key)) return key;
  let hit = nearCache.get(key);
  if (hit === undefined) {
    const [L, a, b] = oklab(key);
    hit = nearestLab(L, a, b);
    nearCache.set(key, hit);
  }
  return hit;
}

/** Palette index of a colour (snapped to PAL_HD). */
export function ix(c: Color): number {
  return INDEX.get((c | 255) >>> 0) ?? (INDEX.get(nearestHd(c)) as number);
}

/** The colour of a palette index. */
export function colourOf(i: number): Color {
  return LUT[i & 255];
}

/** Mix two colours in Oklab and snap to PAL_HD. */
export function mixHd(c1: Color, c2: Color, t: number): Color {
  const a = oklab(c1);
  const b = oklab(c2);
  return nearestLab(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/**
 * A smooth HD tone path through key colours (any palette): `n` Oklab samples along the polyline,
 * snapped to PAL_HD, consecutive repeats dropped. Keys stay on the path (each segment's ends are
 * sampled). Used for the sky, clouds and haze.
 */
export function hdPath(keys: readonly Color[], n: number): Color[] {
  const out: Color[] = [];
  const push = (c: Color): void => {
    if (out[out.length - 1] !== c) out.push(c);
  };
  if (keys.length === 1) return [nearestHd(keys[0])];
  const seg = keys.length - 1;
  const per = Math.max(1, Math.round((n - 1) / seg));
  for (let s = 0; s < seg; s++) {
    for (let k = 0; k < per; k++) push(mixHd(keys[s], keys[s + 1], k / per));
  }
  push(nearestHd(keys[seg]));
  return out;
}

/** The HD ramp holding a colour (its home) and the index there. */
export function homeOf(c: Color): { ramp: readonly Color[]; i: number } {
  const h = hdHome(c) ?? hdHome(nearestHd(c));
  return h ?? { ramp: [nearestHd(c)], i: 0 };
}

/** The HD tone `k` steps lighter (+) or darker (−) than a colour in its home ramp (clamped). */
export function step(c: Color, k: number): Color {
  const h = homeOf(c);
  return h.ramp[Math.max(0, Math.min(h.ramp.length - 1, h.i + k))] >>> 0;
}

// ------------------------------------------------------------------------------------ light and air

/** The haze colour of each light (atmospheric perspective goes toward it). */
const HAZE_AT: Readonly<Record<Light, Color>> = {
  morning: 0xa9c6e2ff,
  noon: 0x9dc3e8ff,
  golden: 0xe3c79cff,
  sunset: 0xc08dc2ff,
};

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A layer's colour transform: the section light, then `air` (0 = full colour, 1 = the haze colour).
 * `t(c)` returns the palette index of the transformed colour; results are cached per transform.
 */
export interface Air {
  (c: Color): number;
  readonly light: Light;
  readonly air: number;
}

const airs = new Map<string, Air>();

export function airOf(light: Light, air: number): Air {
  const key = `${light}:${air.toFixed(3)}`;
  const have = airs.get(key);
  if (have) return have;
  const cache = new Map<number, number>();
  const [hl, ha, hb] = oklab(HAZE_AT[light]);
  const fn = ((c: Color): number => {
    const k = (c | 255) >>> 0;
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    let [L, a, b] = oklab(k);
    const hi = smoothstep(0.62, 0.95, L);
    if (light === 'golden') {
      a += 0.012 + 0.02 * hi;
      b += 0.02 + 0.07 * hi;
    } else if (light === 'sunset') {
      const lo = 1 - smoothstep(0.3, 0.7, L);
      a += 0.03 * hi + 0.025 * lo;
      b += 0.04 * hi - 0.03 * lo;
      L *= 0.97;
    }
    L += (hl - L) * air;
    a += (ha - a) * air;
    b += (hb - b) * air;
    const i = INDEX.get(nearestLab(L, a, b)) as number;
    cache.set(k, i);
    return i;
  }) as Air;
  Object.defineProperty(fn, 'light', { value: light });
  Object.defineProperty(fn, 'air', { value: air });
  airs.set(key, fn);
  return fn;
}

/** A ramp of colours through a transform: palette indices. */
export function rampI(t: (c: Color) => number, r: readonly Color[]): Uint8Array {
  const o = new Uint8Array(r.length);
  for (let i = 0; i < r.length; i++) o[i] = t(r[i]);
  return o;
}

/** Plain palette indices of colours (no transform). */
export function idx(r: readonly Color[]): Uint8Array {
  return rampI(ix, r);
}

/** Pick ramp tone k (clamped). */
export function pick(r: Uint8Array, k: number): number {
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k | 0];
}

// ------------------------------------------------------------------------------------ dither

/** Bayer 8 × 8 thresholds in (0, 1). */
const B8 = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const nm: number[][] = [];
    for (let y = 0; y < n * 2; y++) {
      nm.push([]);
      for (let x = 0; x < n * 2; x++) {
        const base = m[y % n][x % n] * 4;
        nm[y].push(base + (y < n ? (x < n ? 0 : 2) : x < n ? 3 : 1));
      }
    }
    m = nm;
  }
  const o = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) o[y * 8 + x] = (m[y][x] + 0.5) / 64;
  return o;
})();

/** Bayer 8 × 8 thresholds, row-major (index ((Y & 7) << 3) | (X & 7)), for hot loops. */
export const BAYER8: Float32Array = B8;

/** The ordered-dither threshold of an art px. */
export function bay(X: number, Y: number): number {
  return B8[((Y & 7) << 3) | (X & 7)];
}

/**
 * Ordered-dither quantise: the band of a continuous tone value v (band k covers [k, k + 1)), the
 * dither only within ±z/2 of a band border (z = 0: hard bands; 1: a full dither between bands).
 */
export function dq(v: number, X: number, Y: number, z: number): number {
  return Math.floor(v + (B8[((Y & 7) << 3) | (X & 7)] - 0.5) * z);
}

// ------------------------------------------------------------------------------------ hashes

/** A hash in [0, 1) of integer cells (alias of paint.ts hash2). */
export const h2 = hash2;

// ------------------------------------------------------------------------------------ canvas

/** A shader for discs: art px (X, Y) and the disc's local (u, v) ∈ [−1, 1]² → index (0 = skip). */
export type DiscShader = (X: number, Y: number, u: number, v: number) => number;

/**
 * A w × h LOGICAL px layer at density d: (w·d) × (h·d) palette indices that wrap in x. Art-px
 * calls end in `A`; the others take logical px (floats; edges rounded to the art grid).
 */
export class BgCanvas {
  readonly w: number;
  readonly h: number;
  readonly d: Den;
  readonly W: number;
  readonly H: number;
  readonly px: Uint8Array;

  constructor(w: number, h: number, d: Den) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.W = w * d;
    this.H = h * d;
    this.px = new Uint8Array(this.W * this.H);
  }

  /** Wrap an art x into the tile. */
  wx(X: number): number {
    const W = this.W;
    const x = X % W;
    return x < 0 ? x + W : x;
  }

  /** Fill art px [X0, X1) of row Y with index i (wraps in x). */
  span(X0: number, X1: number, Y: number, i: number): void {
    if (Y < 0 || Y >= this.H || X1 <= X0) return;
    const W = this.W;
    const row = Y * W;
    const n = X1 - X0;
    if (n >= W) {
      this.px.fill(i, row, row + W);
      return;
    }
    let s = X0 % W;
    if (s < 0) s += W;
    const e = s + n;
    if (e <= W) this.px.fill(i, row + s, row + e);
    else {
      this.px.fill(i, row + s, row + W);
      this.px.fill(i, row, row + e - W);
    }
  }

  /** An art-px rect. */
  rectA(X: number, Y: number, w: number, h: number, i: number): void {
    for (let y = Y; y < Y + h; y++) this.span(X, X + w, y, i);
  }

  /** A logical-px rect (edges rounded to art px). */
  rect(x: number, y: number, w: number, h: number, i: number): void {
    const d = this.d;
    const X0 = Math.round(x * d);
    const X1 = Math.round((x + w) * d);
    const Y1 = Math.round((y + h) * d);
    for (let Y = Math.round(y * d); Y < Y1; Y++) this.span(X0, X1, Y, i);
  }

  /** One art px (wraps in x). */
  dot(X: number, Y: number, i: number): void {
    if (Y < 0 || Y >= this.H) return;
    this.px[Y * this.W + this.wx(X)] = i;
  }

  /** The index at an art px (0 outside in y). */
  at(X: number, Y: number): number {
    if (Y < 0 || Y >= this.H) return 0;
    return this.px[Y * this.W + this.wx(X)];
  }

  /**
   * A filled polygon (logical px), sampled at art px centres. `fill` is an index or a shader
   * (X, Y) → index (0 = leave the px).
   */
  poly(pts: ReadonlyArray<readonly [number, number]>, fill: number | ((X: number, Y: number) => number)): void {
    const d = this.d;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    const xs: number[] = [];
    const n = pts.length;
    for (let Y = Math.max(0, Math.floor(y0 * d)); Y <= Math.min(this.H - 1, Math.ceil(y1 * d)); Y++) {
      const yc = (Y + 0.5) / d;
      xs.length = 0;
      for (let k = 0; k < n; k++) {
        const a = pts[k];
        const b = pts[(k + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const X0 = Math.ceil(xs[k] * d - 0.5);
        const X1 = Math.floor(xs[k + 1] * d - 0.5) + 1;
        if (typeof fill === 'number') this.span(X0, X1, Y, fill);
        else {
          for (let X = X0; X < X1; X++) {
            const i = fill(X, Y);
            if (i !== 0) this.dot(X, Y, i);
          }
        }
      }
    }
  }

  /** A disc / ellipse (logical centre and radii) with a shader per art px inside it. */
  disc(cx: number, cy: number, rx: number, ry: number, shade: DiscShader): void {
    const d = this.d;
    const Y0 = Math.max(0, Math.floor((cy - ry) * d));
    const Y1 = Math.min(this.H - 1, Math.ceil((cy + ry) * d));
    const X0 = Math.floor((cx - rx) * d);
    const X1 = Math.ceil((cx + rx) * d);
    const W = this.W;
    const p = this.px;
    for (let Y = Y0; Y <= Y1; Y++) {
      const v = ((Y + 0.5) / d - cy) / ry;
      const v2 = v * v;
      if (v2 > 1) continue;
      const row = Y * W;
      for (let X = X0; X <= X1; X++) {
        const u = ((X + 0.5) / d - cx) / rx;
        if (u * u + v2 > 1) continue;
        const i = shade(X, Y, u, v);
        if (i !== 0) {
          let x = X % W;
          if (x < 0) x += W;
          p[row + x] = i;
        }
      }
    }
  }

  /** A line of art px (Bresenham) between logical points, `wA` art px thick (square pen). */
  line(x0: number, y0: number, x1: number, y1: number, i: number, wA = 1): void {
    const d = this.d;
    let X0 = Math.round(x0 * d);
    let Y0 = Math.round(y0 * d);
    const X1 = Math.round(x1 * d);
    const Y1 = Math.round(y1 * d);
    const dx = Math.abs(X1 - X0);
    const dy = -Math.abs(Y1 - Y0);
    const sx = X0 < X1 ? 1 : -1;
    const sy = Y0 < Y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (wA <= 1) this.dot(X0, Y0, i);
      else this.rectA(X0, Y0, wA, wA, i);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        X0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        Y0 += sy;
      }
    }
  }

  /** Map every opaque px in art rows [Y0, Y1) through an index table (haze, tint). */
  remapRows(Y0: number, Y1: number, table: Uint8Array): void {
    const p = this.px;
    const a = Math.max(0, Y0) * this.W;
    const b = Math.min(this.H, Y1) * this.W;
    for (let k = a; k < b; k++) {
      const v = p[k];
      if (v !== 0) p[k] = table[v];
    }
  }

  /** The finished layer: PAL_HD colours, (w·d) × (h·d). */
  finish(): PixelBuffer {
    const out = new PixelBuffer(this.W, this.H);
    const o = out.data;
    const p = this.px;
    if (LITTLE_ENDIAN && (p.length & 3) === 0 && (p.byteOffset & 3) === 0) {
      // Four indices per read; clear runs are skipped four px at a time.
      const p32 = new Uint32Array(p.buffer, p.byteOffset, p.length >> 2);
      for (let q = 0; q < p32.length; q++) {
        const v = p32[q];
        if (v === 0) continue;
        const k = q << 2;
        o[k] = LUT[v & 255];
        o[k + 1] = LUT[(v >>> 8) & 255];
        o[k + 2] = LUT[(v >>> 16) & 255];
        o[k + 3] = LUT[v >>> 24];
      }
      return out.touch();
    }
    for (let k = 0; k < p.length; k++) {
      const v = p[k];
      if (v !== 0) o[k] = LUT[v];
    }
    return out.touch();
  }
}

/** An index table (256) mapping every palette index through a colour transform. */
export function tableOf(t: (c: Color) => number): Uint8Array {
  const o = new Uint8Array(256);
  for (let i = 1; i <= HD_PALETTE.length; i++) o[i] = t(LUT[i]);
  return o;
}
