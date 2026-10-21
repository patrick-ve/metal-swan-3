/**
 * The ring scenery kit (docs/design/ring.md §2, §11; docs/ART_GUIDE.md "UHD art"): ONE painter for
 * the 1×, 2× and 4× art of every ring layer and set piece.
 *
 * - `Pen`: a w × h LOGICAL px canvas at density d ∈ {1, 2, 4} ((w·d) × (h·d) art px of packed
 *   colours, 0 = clear). Logical calls (rect, poly, disc, line) round to the art grid; art-px calls
 *   end in `A`. A layer pen may wrap in x (tiling layers such as the sky); a chunk pen clips.
 * - Colours: `tone(ramp, t, d)` picks a tone along an HD ramp (t 0 = deepest … 1 = lightest); at
 *   d 1 the tone snaps to the nearest `PAL` colour (the 64-colour palette), at d 2 and 4 it is a
 *   `PAL_HD` colour. `haze(c, air, d)` mixes toward the summer haze in Oklab (far layers lighter,
 *   cooler, lower contrast) and snaps to the palette of d. So one drawer per id makes its 1× art
 *   (PAL) and its 2× / 4× art (PAL_HD): the same shapes at the same logical places, the dense
 *   versions with more tones and finer detail (`d >= 4` only for hairline detail).
 * - `dq` / `bay`: the ordered dither (Bayer 8 × 8 on the art grid) for big gradients only (sky,
 *   water, glass); never on small shapes.
 * - Lettering: `TINY` — our own 3 × 5 pixel capitals and digits for signs, hectometre boards and
 *   shields (each 1× px is a d × d block at the dense densities, crisp).
 *
 * Same input, same pixels: no randomness except the hashes callers pass.
 */
import type { Color } from '../../../../engine/color';
import { nearest as nearestPal, PAL } from '../../../../engine/palette';
import { PAL_HD, type HdRampName } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { hash2 } from '../../../art/paint';
import { nearestHd, oklab, nearestLab } from '../../missions/ams/art-hd-bg-kit';

export type Dn = 1 | 2 | 4;
export type Params = Readonly<Record<string, unknown>>;
export const h2 = hash2;

// ------------------------------------------------------------------------------------ params

export function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

export function str(p: Params, k: string, d: string): string {
  const v = p[k];
  return typeof v === 'string' ? v : d;
}

export function nums(p: Params, k: string): readonly number[] {
  const v = p[k];
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'number') as number[]) : [];
}

// ------------------------------------------------------------------------------------ colour

const snapCache: [Map<number, Color>, Map<number, Color>] = [new Map(), new Map()];

/** The palette colour of d nearest to `c` (PAL at 1, PAL_HD at 2 and 4). */
export function snap(c: Color, d: Dn): Color {
  const m = snapCache[d === 1 ? 0 : 1];
  const k = c >>> 0;
  let hit = m.get(k);
  if (hit === undefined) {
    hit = d === 1 ? nearestPal(k) >>> 0 : nearestHd(k) >>> 0;
    m.set(k, hit);
  }
  return hit;
}

const rampCache = new Map<string, readonly Color[]>();

/**
 * An HD ramp at density d: the PAL_HD ramp at 2 and 4; at 1 the ramp's tones snapped to PAL (no
 * consecutive repeats), so the 1× art keeps the same material with fewer tones.
 */
export function ramp(name: HdRampName, d: Dn): readonly Color[] {
  const r = PAL_HD[name];
  if (d !== 1) return r;
  const key = name;
  let have = rampCache.get(key);
  if (!have) {
    const out: Color[] = [];
    for (const c of r) {
      const s = nearestPal(c) >>> 0;
      if (out[out.length - 1] !== s) out.push(s);
    }
    have = out;
    rampCache.set(key, have);
  }
  return have;
}

/** Tone t (0 = deepest … 1 = lightest) of an HD ramp at density d. */
export function tone(name: HdRampName, t: number, d: Dn): Color {
  const r = ramp(name, d);
  const k = Math.round(Math.max(0, Math.min(1, t)) * (r.length - 1));
  return r[k] >>> 0;
}

/** Tone index k of an HD ramp (clamped), at density d (at 1: the PAL tone nearest that HD tone). */
export function toneI(name: HdRampName, k: number, d: Dn): Color {
  const r = PAL_HD[name];
  const c = r[Math.max(0, Math.min(r.length - 1, Math.round(k)))] >>> 0;
  return d === 1 ? snap(c, 1) : c;
}

const mixCache = new Map<string, Color>();

/** Mix two colours in Oklab (t 0 = a … 1 = b), snapped to the palette of d. */
export function mix(a: Color, b: Color, t: number, d: Dn): Color {
  const key = `${a >>> 0}:${b >>> 0}:${t.toFixed(3)}:${d}`;
  let hit = mixCache.get(key);
  if (hit === undefined) {
    const p = oklab(a >>> 0);
    const q = oklab(b >>> 0);
    const L = p[0] + (q[0] - p[0]) * t;
    const A = p[1] + (q[1] - p[1]) * t;
    const B = p[2] + (q[2] - p[2]) * t;
    const hd = nearestLab(L, A, B) >>> 0;
    hit = d === 1 ? snap(hd, 1) : hd;
    mixCache.set(key, hit);
  }
  return hit;
}

/** The summer haze over the ring (far layers mix toward it). */
export const HAZE: Color = 0xb9cde0ff;

/** A colour seen through `air` (0 = none … 1 = only haze), snapped to the palette of d. */
export function haze(c: Color, air: number, d: Dn): Color {
  return air <= 0 ? snap(c, d) : mix(c, HAZE, air, d);
}

/** A colour `k` HD tones lighter (+) or darker (−) in its own HD ramp, at density d. */
export function shift(c: Color, k: number, d: Dn): Color {
  const hd = nearestHd(c >>> 0);
  for (const name of Object.keys(PAL_HD) as HdRampName[]) {
    const r = PAL_HD[name];
    const i = r.indexOf(hd);
    if (i >= 0) return snap(r[Math.max(0, Math.min(r.length - 1, i + k))] >>> 0, d);
  }
  return snap(hd, d);
}

// ------------------------------------------------------------------------------------ dither

const B8 = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const nm: number[][] = [];
    for (let y = 0; y < n * 2; y++) {
      nm.push([]);
      for (let x = 0; x < n * 2; x++) nm[y].push(m[y % n][x % n] * 4 + (y < n ? (x < n ? 0 : 2) : x < n ? 3 : 1));
    }
    m = nm;
  }
  const o = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) o[y * 8 + x] = (m[y][x] + 0.5) / 64;
  return o;
})();

/** The ordered-dither threshold (0, 1) of an art px. */
export function bay(X: number, Y: number): number {
  return B8[((Y & 7) << 3) | (X & 7)];
}

/** Band of a continuous value v, dithered only within ±z/2 of a band border. */
export function dq(v: number, X: number, Y: number, z: number): number {
  return Math.floor(v + (B8[((Y & 7) << 3) | (X & 7)] - 0.5) * z);
}

// ------------------------------------------------------------------------------------ canvas

export type Shader = (X: number, Y: number) => Color;

/** A w × h logical px canvas at density d (packed colours, 0 = clear). */
export class Pen {
  readonly w: number;
  readonly h: number;
  readonly d: Dn;
  readonly W: number;
  readonly H: number;
  readonly px: Uint32Array;
  /** Wrap in x (a tiling layer) instead of clipping. */
  readonly wrap: boolean;

  constructor(w: number, h: number, d: Dn, wrap = false) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.W = w * d;
    this.H = h * d;
    this.px = new Uint32Array(this.W * this.H);
    this.wrap = wrap;
  }

  /** Art px [X0, X1) of row Y. */
  span(X0: number, X1: number, Y: number, c: Color): void {
    if (Y < 0 || Y >= this.H || X1 <= X0) return;
    const W = this.W;
    const row = Y * W;
    if (!this.wrap) {
      const a = X0 < 0 ? 0 : X0;
      const b = X1 > W ? W : X1;
      if (b > a) this.px.fill(c >>> 0, row + a, row + b);
      return;
    }
    const n = X1 - X0;
    if (n >= W) {
      this.px.fill(c >>> 0, row, row + W);
      return;
    }
    let s = X0 % W;
    if (s < 0) s += W;
    const e = s + n;
    if (e <= W) this.px.fill(c >>> 0, row + s, row + e);
    else {
      this.px.fill(c >>> 0, row + s, row + W);
      this.px.fill(c >>> 0, row, row + e - W);
    }
  }

  rectA(X: number, Y: number, w: number, h: number, c: Color): void {
    for (let y = Y; y < Y + h; y++) this.span(X, X + w, y, c);
  }

  /** A logical rect (edges rounded to art px; at least one art px when w, h > 0). */
  rect(x: number, y: number, w: number, h: number, c: Color): void {
    if (w <= 0 || h <= 0) return;
    const d = this.d;
    const X0 = Math.round(x * d);
    let X1 = Math.round((x + w) * d);
    const Y0 = Math.round(y * d);
    let Y1 = Math.round((y + h) * d);
    if (X1 <= X0) X1 = X0 + 1;
    if (Y1 <= Y0) Y1 = Y0 + 1;
    for (let Y = Y0; Y < Y1; Y++) this.span(X0, X1, Y, c);
  }

  /** A logical rect painted per art px by a shader (0 = leave). */
  fill(x: number, y: number, w: number, h: number, sh: Shader): void {
    const d = this.d;
    const X0 = Math.round(x * d);
    const X1 = Math.round((x + w) * d);
    const Y0 = Math.max(0, Math.round(y * d));
    const Y1 = Math.min(this.H, Math.round((y + h) * d));
    for (let Y = Y0; Y < Y1; Y++) {
      for (let X = X0; X < X1; X++) {
        const c = sh(X, Y);
        if (c !== 0) this.dot(X, Y, c);
      }
    }
  }

  /** Re-shade the opaque art px of a logical rect: `sh(X, Y, old)` (0 = keep). */
  tint(x: number, y: number, w: number, h: number, sh: (X: number, Y: number, old: Color) => Color): void {
    const d = this.d;
    const X0 = Math.round(x * d);
    const X1 = Math.round((x + w) * d);
    const Y0 = Math.max(0, Math.round(y * d));
    const Y1 = Math.min(this.H, Math.round((y + h) * d));
    for (let Y = Y0; Y < Y1; Y++) {
      for (let X = X0; X < X1; X++) {
        const i = this.idx(X, Y);
        if (i < 0) continue;
        const old = this.px[i];
        if (old === 0) continue;
        const c = sh(X, Y, old);
        if (c !== 0) this.px[i] = c >>> 0;
      }
    }
  }

  private idx(X: number, Y: number): number {
    if (Y < 0 || Y >= this.H) return -1;
    if (this.wrap) {
      let x = X % this.W;
      if (x < 0) x += this.W;
      return Y * this.W + x;
    }
    if (X < 0 || X >= this.W) return -1;
    return Y * this.W + X;
  }

  dot(X: number, Y: number, c: Color): void {
    const i = this.idx(X, Y);
    if (i >= 0) this.px[i] = c >>> 0;
  }

  at(X: number, Y: number): Color {
    const i = this.idx(X, Y);
    return i >= 0 ? this.px[i] : 0;
  }

  /** A filled polygon (logical px) sampled at art px centres: a colour or a shader. */
  poly(pts: ReadonlyArray<readonly [number, number]>, fill: Color | Shader): void {
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
            const c = fill(X, Y);
            if (c !== 0) this.dot(X, Y, c);
          }
        }
      }
    }
  }

  /** An ellipse (logical centre and radii) shaded per art px: `sh(X, Y, u, v)` with u, v ∈ [−1, 1]. */
  disc(cx: number, cy: number, rx: number, ry: number, sh: Color | ((X: number, Y: number, u: number, v: number) => Color)): void {
    const d = this.d;
    const Y0 = Math.max(0, Math.floor((cy - ry) * d));
    const Y1 = Math.min(this.H - 1, Math.ceil((cy + ry) * d));
    const X0 = Math.floor((cx - rx) * d);
    const X1 = Math.ceil((cx + rx) * d);
    for (let Y = Y0; Y <= Y1; Y++) {
      const v = ((Y + 0.5) / d - cy) / ry;
      if (v * v > 1) continue;
      for (let X = X0; X <= X1; X++) {
        const u = ((X + 0.5) / d - cx) / rx;
        if (u * u + v * v > 1) continue;
        const c = typeof sh === 'number' ? sh : sh(X, Y, u, v);
        if (c !== 0) this.dot(X, Y, c);
      }
    }
  }

  /** A line between logical points, `wA` art px thick (square pen). */
  line(x0: number, y0: number, x1: number, y1: number, c: Color, wA = 1): void {
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
      if (wA <= 1) this.dot(X0, Y0, c);
      else this.rectA(X0, Y0, wA, wA, c);
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

  /** One art px wide at d ≥ 2, one logical px at d 1 (hairlines that vanish at 1×: `minD` 2). */
  get hair(): number {
    return 1 / this.d;
  }

  /** The finished buffer ((w·d) × (h·d)). */
  finish(): PixelBuffer {
    return new PixelBuffer(this.W, this.H, this.px).touch();
  }

  /** The finished buffer as a frame with a logical anchor (density d). */
  frame(ox: number, oy: number): Frame {
    const buf = this.finish();
    return this.d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: this.d };
  }
}

// ------------------------------------------------------------------------------------ painted volumes

/**
 * A lit box face-on (static decor, painted): the front in tone `mid`, a lit left strip and top
 * edge, a shaded right strip and a darker bottom edge, on ramp `r` (art px strips at d ≥ 2).
 */
export function litBox(p: Pen, x: number, y: number, w: number, h: number, r: HdRampName, mid: number, o: { air?: number; edgeC?: boolean } = {}): void {
  const d = p.d;
  const air = o.air ?? 0;
  const c = (k: number): Color => haze(toneI(r, k, d), air, d);
  p.rect(x, y, w, h, c(mid));
  const s = d === 1 ? 1 : Math.max(1 / d, Math.min(1, w / 8));
  p.rect(x, y, s, h, c(mid + 1));
  p.rect(x, y, w, d === 1 ? 1 : 1 / d, c(mid + 2));
  p.rect(x + w - s, y, s, h, c(mid - 1));
  if (o.edgeC && d > 1) {
    // Outline C: the deepest tone on the lit side, ink on the shadow side, ½ logical px.
    p.rect(x + w - 0.5, y, 0.5, h, PAL_HD.ink[1]);
    p.rect(x, y + h - 0.5, w, 0.5, PAL_HD.ink[1]);
  }
}

// ------------------------------------------------------------------------------------ lettering

/** Our 3 × 5 pixel capitals (M, N, W, Q 5 wide); rows top → bottom, '#' = ink (the comma has a 6th row: its tail). */
const TINY_SRC: Readonly<Record<string, readonly string[]>> = {
  A: ['###', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###.', '#.#.', '#.#.', '#.#.', '####'],
  R: ['###', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#', '##', '.#', '.#', '.#'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  // A real comma (the Dutch decimal comma of the hectometre boards: `12,3`): a stroke with a tail
  // that hangs one row below the line, so it never reads as a point.
  ',': ['..', '..', '..', '.#', '.#', '#.'],
  '.': ['.', '.', '.', '.', '#'],
  '-': ['..', '..', '##', '..', '..'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['#', '#', '.', '.', '.'],
  ' ': ['..', '..', '..', '..', '..'],
};

interface Glyph {
  readonly w: number;
  readonly rows: readonly string[];
}

const TINY = new Map<string, Glyph>(Object.entries(TINY_SRC).map(([k, rows]) => [k, { w: rows[0].length, rows }]));

/** Width (logical px) of `s` in the tiny lettering (1 px between glyphs). */
export function tinyWidth(s: string): number {
  let w = 0;
  for (const ch of s.toUpperCase()) w += (TINY.get(ch)?.w ?? 3) + 1;
  return Math.max(0, w - 1);
}

/**
 * Draw `s` in the tiny lettering with its top-left at logical (x, y), `scale` logical px per
 * glyph px. At d ≥ 2 each glyph px is a crisp block; with `lit` its top art row takes that colour
 * at d 4 (a little relief on painted letters).
 */
export function tinyText(p: Pen, s: string, x: number, y: number, c: Color, o: { scale?: number; lit?: Color } = {}): number {
  const k = o.scale ?? 1;
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = TINY.get(ch) ?? TINY.get(' ') as Glyph;
    for (let r = 0; r < g.rows.length; r++) {
      const row = g.rows[r];
      for (let i = 0; i < g.w; i++) {
        if (row[i] !== '#') continue;
        p.rect(cx + i * k, y + r * k, k, k, c);
        if (o.lit && p.d >= 4 && (r === 0 || g.rows[r - 1][i] !== '#')) p.rect(cx + i * k, y + r * k, k, 1 / p.d, o.lit);
      }
    }
    cx += (g.w + 1) * k;
  }
  return cx - x - k;
}

// ------------------------------------------------------------------------------------ misc

/** A deterministic 32-bit mix of integers (chunk seeds: mix(seed, layer, i)). */
export function mixSeed(a: number, b: number, c = 0): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** PAL ramp of 1× art helpers (re-export for drawers that want the classic tones). */
export { PAL, PAL_HD };

// ------------------------------------------------------------------------------------ outlines

/**
 * Outline A (things that move or can be hit): ink round the silhouette, 1 logical px wide (d art
 * px), only on clear px. The drawing must leave 1 logical px of room at the frame's border.
 */
export function outlineA(p: Pen, ink: Color = PAL_HD.ink[0]): void {
  const c = p.d === 1 ? snap(ink, 1) : ink >>> 0;
  const W = p.W;
  const H = p.H;
  let src = Uint8Array.from(p.px, (v) => (v !== 0 ? 1 : 0));
  // Dilate d times (a chebyshev disc of radius d art px, rounded corners from the 4-steps).
  const add = new Uint8Array(W * H);
  for (let r = 0; r < p.d; r++) {
    const next = src.slice();
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (src[i]) continue;
        if ((X > 0 && src[i - 1]) || (X < W - 1 && src[i + 1]) || (Y > 0 && src[i - W]) || (Y < H - 1 && src[i + W]) || (r > 0 && ((X > 0 && Y > 0 && src[i - W - 1]) || (X < W - 1 && Y < H - 1 && src[i + W + 1]) || (X > 0 && Y < H - 1 && src[i + W - 1]) || (X < W - 1 && Y > 0 && src[i - W + 1])))) {
          next[i] = 1;
          add[i] = 1;
        }
      }
    }
    src = next;
  }
  for (let i = 0; i < add.length; i++) if (add[i]) p.px[i] = c;
}

/**
 * Outline C (static decor, ART_GUIDE "UHD art"): ½ logical px on clear px round the silhouette —
 * ink on the shadow side (right / below the shape), the shape's own colour two tones deeper on
 * the lit side (left / above). At d 1 a 1 px ink line on the shadow side only.
 */
export function outlineC(p: Pen): void {
  const W = p.W;
  const H = p.H;
  const r = Math.max(1, p.d >> 1);
  const ink = p.d === 1 ? snap(PAL_HD.ink[1], 1) : PAL_HD.ink[1] >>> 0;
  const src = p.px.slice();
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (src[i] !== 0) continue;
      let shadow = false;
      let lit: Color = 0;
      for (let k = 1; k <= r && !shadow; k++) {
        if ((X - k >= 0 && src[i - k] !== 0) || (Y - k >= 0 && src[i - k * W] !== 0)) shadow = true;
      }
      if (shadow) {
        p.px[i] = ink;
        continue;
      }
      if (p.d === 1) continue;
      for (let k = 1; k <= r && !lit; k++) {
        if (X + k < W && src[i + k] !== 0) lit = src[i + k];
        else if (Y + k < H && src[i + k * W] !== 0) lit = src[i + k * W];
      }
      if (lit) p.px[i] = shift(lit, -3, p.d);
    }
  }
}
