import type { Color } from './color';
import { blendAdd, blendOver } from './color';
import type { Frame } from './render';
import type { Placement } from './render-common';
import { placeAnchored } from './render-common';

/**
 * PixelBuffer — the pixel-art toolkit (docs/ARCHITECTURE.md §5.3, docs/api/media.md).
 *
 * Storage: one packed 0xRRGGBBAA Color per pixel, row-major, in a Uint32Array.
 * `w`, `h`, `data`, `get` and `set` are a stable contract.
 *
 * Conventions:
 * - Coordinates are rounded to whole pixels (Math.round). Shapes clip at the buffer edges.
 * - Shape methods PAINT: they write the colour as-is (TRANSPARENT erases). Compositing with
 *   alpha or additive light is done by `blit`, `blendRect` and `blendPixel`.
 * - Every drawing method returns `this`, so calls chain.
 * - `version` changes on every mutation through a method. Renderers use it to refresh cached
 *   canvases; call `touch()` after writing `data` directly.
 */

export type Ramp = readonly Color[];
export type Point = readonly [number, number];
/** Polygon vertices: [[x, y], …] or a flat [x0, y0, x1, y1, …] list. */
export type PolyPoints = readonly Point[] | readonly number[];
export type BlendMode = 'over' | 'add' | 'copy';
/** Exact-match colour map, or a function applied to every non-transparent pixel. */
export type ColorMap = ReadonlyMap<Color, Color> | ((c: Color) => Color);
/** Restricts an effect: only pixels of this colour, any non-transparent pixel, or empty pixels. */
export type PixelFilter = Color | 'opaque' | 'empty';
/** Direction the light comes FROM: a compass name or a step vector with components -1, 0, 1. */
export type LightDir = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br' | Point;

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BlitOpts {
  flipX?: boolean;
  flipY?: boolean;
  /** Recolour source pixels before blending. */
  map?: ColorMap;
  /** Opacity multiplier 0..1 (default 1). */
  alpha?: number;
  /** 'over' (default) alpha-composites, 'add' adds light, 'copy' replaces (incl. transparency). */
  blend?: BlendMode;
  /** Paint every non-transparent source pixel in this colour, keeping its alpha (hit flash). */
  solid?: Color;
  /** Source sub-rectangle (default: whole source). */
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
}

export interface OutlineOpts {
  /** Also outline diagonal neighbours (8-connected, thicker corners). Default false. */
  corners?: boolean;
  /** Recolour the shape's own edge pixels instead of the transparent pixels around it. */
  inside?: boolean;
  /** Which pixels form the shape (default: every non-transparent pixel). */
  only?: Color;
}

export interface BevelOpts {
  /** Direction the light comes from (default 'tl'). */
  light?: LightDir;
  /** Width of the highlight and shadow bands in pixels (default 1). */
  depth?: number;
  /** Ramp index for the interior (default: middle of the ramp, rounded up). */
  base?: number;
  /** Shade only pixels of this colour (default: every non-transparent pixel). */
  only?: Color;
}

export interface DitherOpts {
  /** 'bayer' (default): 17 levels from a 4×4 Bayer matrix. 'checker': a 50 % checkerboard. */
  pattern?: 'bayer' | 'checker';
  only?: PixelFilter;
}

export interface GradientOpts {
  /** Vertical (default, ramp[0] at the top) or horizontal (ramp[0] at the left). */
  vertical?: boolean;
  /** Reverse the ramp direction. */
  reverse?: boolean;
  /**
   * Dithered transitions between bands: false/0 = hard bands, true = 0.25,
   * 0.5 = fully dithered (smooth). Default true.
   */
  dither?: boolean | number;
  only?: PixelFilter;
}

export interface NoiseOpts {
  /** Colours to scatter (picked uniformly). */
  colors: readonly Color[];
  /** Chance per pixel 0..1 (default 0.1). */
  density?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  only?: PixelFilter;
}

/** 4×4 Bayer threshold matrix (values 0..15). */
const BAYER4 = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

const LIGHT_DIRS: Readonly<Record<string, Point>> = {
  tl: [-1, -1],
  t: [0, -1],
  tr: [1, -1],
  l: [-1, 0],
  r: [1, 0],
  bl: [-1, 1],
  b: [0, 1],
  br: [1, 1],
};

/**
 * Small seeded PRNG (mulberry32) returning [0, 1). Handy for `noise()` in art generators;
 * gameplay code uses world.rng instead.
 */
export function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bayer threshold 0..15 at (x, y). Exported for custom effects. */
export function bayer4(x: number, y: number): number {
  return BAYER4[((y & 3) << 2) | (x & 3)];
}

/**
 * Ramp index for a continuous band coordinate u in [0, n): solid bands, with ordered-dither
 * transitions of relative width z (0 = hard bands, 0.5 = fully smooth) around band borders.
 */
export function bandIndex(u: number, n: number, z: number, px: number, py: number): number {
  let band = Math.floor(u);
  if (band >= n) band = n - 1;
  if (band < 0) band = 0;
  const f = u - band;
  if (z > 0) {
    const thr = (bayer4(px, py) + 0.5) / 16;
    if (f > 1 - z && band + 1 < n && (f - (1 - z)) / (2 * z) > thr) return band + 1;
    if (f < z && band > 0 && (z - f) / (2 * z) > thr) return band - 1;
  }
  return band;
}

// Scratch storage reused across calls (no per-pixel allocations).
const framePlace: Placement = { x: 0, y: 0 };
let spanScratch = new Int32Array(512);
let polyScratch = new Float64Array(64);

function ensureSpans(rows: number): Int32Array {
  if (spanScratch.length < rows * 2) spanScratch = new Int32Array(rows * 2 + 64);
  return spanScratch;
}

/**
 * Row spans of the ellipse inscribed in a w×h box, relative to the box's top-left.
 * Writes [left, right] (inclusive) per row into `out`; an empty row has left > right.
 *
 * A pixel is inside when its centre satisfies (dx/a)² + (dy/b)² <= 1 − (a+b)/(8ab), with
 * a = w/2, b = h/2. The small inward bias gives the classic pixel-art shapes: diameter 3 is a
 * plus sign, 4 is `.##.`/`####`, 7 is `..###..`/`.#####.`/`#######`, and so on.
 */
function ellipseSpans(w: number, h: number, out: Int32Array): void {
  const a = w / 2;
  const b = h / 2;
  const t = 1 - (a + b) / (8 * a * b);
  for (let j = 0; j < h; j++) {
    const dy = (j + 0.5 - b) / b;
    const k = t - dy * dy;
    if (k < 0) {
      out[j * 2] = 1;
      out[j * 2 + 1] = 0;
      continue;
    }
    const hw = a * Math.sqrt(k) + 1e-9;
    out[j * 2] = Math.ceil(a - 0.5 - hw);
    out[j * 2 + 1] = Math.floor(a - 0.5 + hw);
  }
}

/**
 * Bresenham line from (x0, y0) to (x1, y1), both ends inclusive. The pixels do not depend on
 * the direction (endpoints are normalised), so line(a, b) === line(b, a).
 */
export function traceLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plot: (x: number, y: number) => void,
): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  if (x0 > x1 || (x0 === x1 && y0 > y1)) {
    let t = x0;
    x0 = x1;
    x1 = t;
    t = y0;
    y0 = y1;
    y1 = t;
  }
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function lightVector(light: LightDir | undefined): Point {
  if (light === undefined) return LIGHT_DIRS.tl;
  if (typeof light === 'string') return LIGHT_DIRS[light] ?? LIGHT_DIRS.tl;
  return [Math.sign(light[0]), Math.sign(light[1])];
}

function mapColor(map: ColorMap, c: Color): Color {
  return typeof map === 'function' ? map(c) >>> 0 : (map.get(c) ?? c);
}

export class PixelBuffer {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
  /** Bumped by every mutating method (see the file comment). */
  version = 0;

  constructor(w: number, h: number) {
    this.w = Math.max(0, w | 0);
    this.h = Math.max(0, h | 0);
    this.data = new Uint32Array(this.w * this.h);
  }

  /** Copy of raw packed pixels (0xRRGGBBAA, row-major). */
  static from(w: number, h: number, pixels: ArrayLike<number>): PixelBuffer {
    const b = new PixelBuffer(w, h);
    const n = Math.min(b.data.length, pixels.length);
    for (let i = 0; i < n; i++) b.data[i] = pixels[i] >>> 0;
    return b;
  }

  /** From RGBA bytes (ImageData / PNG order). */
  static fromRGBA(w: number, h: number, bytes: ArrayLike<number>): PixelBuffer {
    const b = new PixelBuffer(w, h);
    for (let i = 0, p = 0; i < b.data.length; i++, p += 4) {
      b.data[i] =
        (((bytes[p] & 255) << 24) |
          ((bytes[p + 1] & 255) << 16) |
          ((bytes[p + 2] & 255) << 8) |
          (bytes[p + 3] & 255)) >>>
        0;
    }
    return b;
  }

  get(x: number, y: number): Color {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  set(x: number, y: number, c: Color): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c >>> 0;
    this.version++;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Marks the buffer as changed after direct writes to `data`. */
  touch(): this {
    this.version++;
    return this;
  }

  // ---------------------------------------------------------------- whole buffer

  clear(): this {
    return this.fill(0);
  }

  fill(c: Color): this {
    this.data.fill(c >>> 0);
    this.version++;
    return this;
  }

  clone(): PixelBuffer {
    const b = new PixelBuffer(this.w, this.h);
    b.data.set(this.data);
    return b;
  }

  /** New buffer with the given region; parts outside this buffer are transparent. */
  crop(x: number, y: number, w: number, h: number): PixelBuffer {
    const out = new PixelBuffer(Math.round(w), Math.round(h));
    out.blit(this, -Math.round(x), -Math.round(y), { blend: 'copy' });
    return out;
  }

  /** New buffer with transparent margins: padded(n) or padded(left, top, right, bottom). */
  padded(left: number, top = left, right = left, bottom = top): PixelBuffer {
    const out = new PixelBuffer(this.w + left + right, this.h + top + bottom);
    out.blit(this, left, top, { blend: 'copy' });
    return out;
  }

  /** Nearest-neighbour integer upscale. */
  scaled(n: number): PixelBuffer {
    const s = Math.max(1, Math.floor(n));
    const out = new PixelBuffer(this.w * s, this.h * s);
    const src = this.data;
    const dst = out.data;
    const ow = out.w;
    for (let y = 0; y < this.h; y++) {
      const row = y * s * ow;
      for (let x = 0; x < this.w; x++) {
        const c = src[y * this.w + x];
        const o = row + x * s;
        for (let k = 0; k < s; k++) dst[o + k] = c;
      }
      for (let k = 1; k < s; k++) dst.copyWithin(row + k * ow, row, row + ow);
    }
    return out;
  }

  /** Nearest-neighbour resize to any size (thumbnails, icons, shrunken parade sprites). */
  resized(w: number, h: number): PixelBuffer {
    const out = new PixelBuffer(Math.round(w), Math.round(h));
    if (this.w === 0 || this.h === 0) return out;
    for (let y = 0; y < out.h; y++) {
      const sy = Math.min(this.h - 1, Math.floor(((y + 0.5) * this.h) / out.h));
      for (let x = 0; x < out.w; x++) {
        const sx = Math.min(this.w - 1, Math.floor(((x + 0.5) * this.w) / out.w));
        out.data[y * out.w + x] = this.data[sy * this.w + sx];
      }
    }
    return out;
  }

  /** Scale2x / EPX: doubles the size and rounds off diagonal stair-steps without new colours. */
  scale2x(): PixelBuffer {
    const { w, h, data } = this;
    const out = new PixelBuffer(w * 2, h * 2);
    const o = out.data;
    const ow = w * 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = data[y * w + x];
        const a = y > 0 ? data[(y - 1) * w + x] : p; // up
        const b = x < w - 1 ? data[y * w + x + 1] : p; // right
        const c = x > 0 ? data[y * w + x - 1] : p; // left
        const d = y < h - 1 ? data[(y + 1) * w + x] : p; // down
        const i = y * 2 * ow + x * 2;
        if (c === a && c !== d && a !== b) o[i] = a;
        else o[i] = p;
        if (a === b && a !== c && b !== d) o[i + 1] = b;
        else o[i + 1] = p;
        if (d === c && d !== b && c !== a) o[i + ow] = c;
        else o[i + ow] = p;
        if (b === d && b !== a && d !== c) o[i + ow + 1] = d;
        else o[i + ow + 1] = p;
      }
    }
    return out;
  }

  /**
   * Rotated copy (radians, clockwise on screen) about the buffer centre, in a buffer just big
   * enough for the result (same parity as the source, so centres stay aligned). 'smooth'
   * (default) samples a Scale2x×3 upscale (RotSprite-style) for clean pixel-art edges; 'fast'
   * is plain nearest-neighbour. Multiples of 90° are exact. Pre-render rotations at generation
   * time (e.g. 16 directions for a rocket); the renderers never rotate.
   */
  rotated(angle: number, o?: { quality?: 'smooth' | 'fast' }): PixelBuffer {
    const { w, h } = this;
    const quarter = Math.round(angle / (Math.PI / 2));
    if (Math.abs(angle - (quarter * Math.PI) / 2) < 1e-9) return this.rotatedQuarter(((quarter % 4) + 4) % 4);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let ow = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin) - 1e-9);
    let oh = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos) - 1e-9);
    if ((ow - w) % 2 !== 0) ow++;
    if ((oh - h) % 2 !== 0) oh++;
    const out = new PixelBuffer(ow, oh);
    const smooth = o?.quality !== 'fast';
    const k = smooth ? 8 : 1;
    const src = smooth ? this.scale2x().scale2x().scale2x() : this;
    const sw = src.w;
    const sh = src.h;
    for (let y = 0; y < oh; y++) {
      const dy = y + 0.5 - oh / 2;
      for (let x = 0; x < ow; x++) {
        const dx = x + 0.5 - ow / 2;
        // Inverse rotation maps the output pixel centre back into the source.
        const sx = Math.floor((dx * cos + dy * sin + w / 2) * k);
        const sy = Math.floor((-dx * sin + dy * cos + h / 2) * k);
        if (sx >= 0 && sy >= 0 && sx < sw && sy < sh) out.data[y * ow + x] = src.data[sy * sw + sx];
      }
    }
    return out;
  }

  /** Exact rotation by q quarter turns clockwise. */
  private rotatedQuarter(q: number): PixelBuffer {
    if (q === 0) return this.clone();
    if (q === 2) return this.flipped(true, true);
    const { w, h, data } = this;
    const out = new PixelBuffer(h, w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Clockwise: (x, y) → (h − 1 − y, x); counter-clockwise: (x, y) → (y, w − 1 − x).
        const i = q === 1 ? x * h + (h - 1 - y) : (w - 1 - x) * h + y;
        out.data[i] = data[y * w + x];
      }
    }
    return out;
  }

  /** Mirrored copy. */
  flipped(flipX = true, flipY = false): PixelBuffer {
    const out = new PixelBuffer(this.w, this.h);
    out.blit(this, 0, 0, { flipX, flipY, blend: 'copy' });
    return out;
  }

  /** Bounding box of all non-transparent pixels, or null when the buffer is empty. */
  trimBounds(): PixelRect | null {
    const { w, h, data } = this;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if ((data[row + x] & 255) === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        maxY = y;
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /** Number of non-transparent pixels. */
  countOpaque(): number {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if ((this.data[i] & 255) !== 0) n++;
    return n;
  }

  /** RGBA bytes (ImageData / PNG order). Pass `out` to reuse an array. */
  toRGBA(out?: Uint8ClampedArray): Uint8ClampedArray {
    const n = this.data.length;
    const bytes = out && out.length >= n * 4 ? out : new Uint8ClampedArray(n * 4);
    const d = this.data;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const c = d[i];
      bytes[p] = c >>> 24;
      bytes[p + 1] = (c >>> 16) & 255;
      bytes[p + 2] = (c >>> 8) & 255;
      bytes[p + 3] = c & 255;
    }
    return bytes;
  }

  // ---------------------------------------------------------------- basic shapes

  /** Filled rectangle. */
  rect(x: number, y: number, w: number, h: number, c: Color): this {
    x = Math.round(x);
    y = Math.round(y);
    let x1 = x + Math.round(w);
    let y1 = y + Math.round(h);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x1 > this.w) x1 = this.w;
    if (y1 > this.h) y1 = this.h;
    if (x >= x1 || y >= y1) return this;
    const col = c >>> 0;
    for (let yy = y; yy < y1; yy++) this.data.fill(col, yy * this.w + x, yy * this.w + x1);
    this.version++;
    return this;
  }

  /** 1-px rectangle outline inside the box (x, y, w, h). */
  strokeRect(x: number, y: number, w: number, h: number, c: Color): this {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0) return this;
    this.hline(x, x + w - 1, y, c);
    this.hline(x, x + w - 1, y + h - 1, c);
    this.vline(x, y, y + h - 1, c);
    this.vline(x + w - 1, y, y + h - 1, c);
    return this;
  }

  /** Horizontal line, both ends inclusive. */
  hline(x0: number, x1: number, y: number, c: Color): this {
    x0 = Math.round(x0);
    x1 = Math.round(x1);
    y = Math.round(y);
    if (x0 > x1) {
      const t = x0;
      x0 = x1;
      x1 = t;
    }
    if (y < 0 || y >= this.h) return this;
    if (x0 < 0) x0 = 0;
    if (x1 >= this.w) x1 = this.w - 1;
    if (x0 > x1) return this;
    this.data.fill(c >>> 0, y * this.w + x0, y * this.w + x1 + 1);
    this.version++;
    return this;
  }

  /** Vertical line, both ends inclusive. */
  vline(x: number, y0: number, y1: number, c: Color): this {
    x = Math.round(x);
    y0 = Math.round(y0);
    y1 = Math.round(y1);
    if (y0 > y1) {
      const t = y0;
      y0 = y1;
      y1 = t;
    }
    if (x < 0 || x >= this.w) return this;
    if (y0 < 0) y0 = 0;
    if (y1 >= this.h) y1 = this.h - 1;
    const col = c >>> 0;
    for (let y = y0; y <= y1; y++) this.data[y * this.w + x] = col;
    this.version++;
    return this;
  }

  /** Bresenham line, both ends inclusive, direction-independent. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    const col = c >>> 0;
    const { w, h, data } = this;
    traceLine(x0, y0, x1, y1, (x, y) => {
      if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = col;
    });
    this.version++;
    return this;
  }

  /** Open (or closed) polyline through the points. */
  polyline(points: PolyPoints, c: Color, closed = false): this {
    const n = pointCount(points);
    for (let i = 0; i + 1 < n; i++) {
      this.line(px(points, i), py(points, i), px(points, i + 1), py(points, i + 1), c);
    }
    if (closed && n > 2) this.line(px(points, n - 1), py(points, n - 1), px(points, 0), py(points, 0), c);
    return this;
  }

  /**
   * Thick line with round caps (a capsule). Width 1 is a plain Bresenham line. The ends match
   * circle()/ellipse() discs of the same diameter; even widths sit half a pixel right/down.
   */
  thickLine(x0: number, y0: number, x1: number, y1: number, width: number, c: Color): this {
    const d = Math.round(width);
    if (d <= 1) return this.line(x0, y0, x1, y1, c);
    return this.capsuleShape(x0, y0, x1, y1, d, d, c);
  }

  /** Capsule = thick line with round caps (alias of thickLine, reads better in art code). */
  capsule(x0: number, y0: number, x1: number, y1: number, width: number, c: Color): this {
    return this.thickLine(x0, y0, x1, y1, width, c);
  }

  /** Tapered limb: diameter goes from w0 at (x0, y0) to w1 at (x1, y1); always connected. */
  taper(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: Color): this {
    const d0 = Math.max(1, Math.round(w0));
    const d1 = Math.max(1, Math.round(w1));
    this.capsuleShape(x0, y0, x1, y1, d0, d1, c);
    // A 1-px spine keeps thin ends from breaking up.
    return Math.min(d0, d1) <= 2 ? this.line(x0, y0, x1, y1, c) : this;
  }

  /**
   * Analytic capsule: pixels whose centre lies within the (linearly interpolated) radius of the
   * segment, with the same inward bias as discs (dist² <= r² − r/4), so caps equal circles.
   */
  private capsuleShape(x0: number, y0: number, x1: number, y1: number, d0: number, d1: number, c: Color): this {
    // Odd diameters are centred on pixel centres, even ones on pixel corners (like discs).
    const o0 = d0 % 2 === 0 ? 1 : 0.5;
    const o1 = d1 % 2 === 0 ? 1 : 0.5;
    const ax = Math.round(x0) + o0;
    const ay = Math.round(y0) + o0;
    const bx = Math.round(x1) + o1;
    const by = Math.round(y1) + o1;
    const r0 = d0 / 2;
    const r1 = d1 / 2;
    const rm = Math.max(r0, r1);
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - rm));
    const maxX = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + rm));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - rm));
    const maxY = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + rm));
    const col = c >>> 0;
    const d = this.data;
    for (let py = minY; py <= maxY; py++) {
      const cy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        let t = len2 > 0 ? ((cx - ax) * vx + (cy - ay) * vy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - cx;
        const qy = ay + vy * t - cy;
        const r = r0 + (r1 - r0) * t;
        if (qx * qx + qy * qy <= r * r - r / 4 + 1e-9) d[py * this.w + px] = col;
      }
    }
    this.version++;
    return this;
  }

  // ---------------------------------------------------------------- round shapes

  /** Ellipse inscribed in the box (x, y, w, h); outline = 1-px 8-connected ring. */
  ellipse(x: number, y: number, w: number, h: number, c: Color, fill = true): this {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0) return this;
    const spans = ensureSpans(h);
    ellipseSpans(w, h, spans);
    for (let j = 0; j < h * 2; j++) spans[j] += x;
    return fill ? this.fillSpans(y, h, spans, c) : this.strokeSpans(y, h, spans, c);
  }

  /** Circle of radius r centred on pixel (cx, cy): diameter 2r + 1. */
  circle(cx: number, cy: number, r: number, c: Color, fill = true): this {
    const rr = Math.max(0, Math.round(r));
    return this.ellipse(Math.round(cx) - rr, Math.round(cy) - rr, rr * 2 + 1, rr * 2 + 1, c, fill);
  }

  /**
   * Shaded ball (same outline as circle(cx, cy, r)) lit from `light`: the ramp is spread over
   * the lit hemisphere in bands, with dithered transitions unless `dither` is false.
   */
  sphere(
    cx: number,
    cy: number,
    r: number,
    ramp: Ramp,
    o?: { light?: LightDir; dither?: boolean | number; ambient?: number },
  ): this {
    const n = ramp.length;
    if (n === 0) return this;
    const rr = Math.max(0, Math.round(r));
    const size = rr * 2 + 1;
    const x0 = Math.round(cx) - rr;
    const y0 = Math.round(cy) - rr;
    const spans = ensureSpans(size);
    ellipseSpans(size, size, spans);
    const [lx, ly] = lightVector(o?.light);
    const ll = Math.hypot(lx, ly, 1.2);
    const Lx = lx / ll;
    const Ly = ly / ll;
    const Lz = 1.2 / ll;
    const ambient = o?.ambient ?? 0.15;
    const z = o?.dither === undefined || o.dither === true ? 0.25 : o.dither === false ? 0 : o.dither;
    const R = rr + 0.5;
    for (let j = 0; j < size; j++) {
      const l = spans[j * 2];
      const rgt = spans[j * 2 + 1];
      const ny = (j + 0.5 - R) / R;
      for (let i = l; i <= rgt; i++) {
        const nx = (i + 0.5 - R) / R;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lit = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
        const u = (ambient + (1 - ambient) * lit) * n;
        this.set(x0 + i, y0 + j, ramp[bandIndex(u, n, z, x0 + i, y0 + j)]);
      }
    }
    return this;
  }

  /** Rectangle with corners rounded like a circle of radius r. */
  roundRect(x: number, y: number, w: number, h: number, r: number, c: Color, fill = true): this {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0) return this;
    const rr = Math.max(0, Math.min(Math.round(r), (Math.min(w, h) - 1) >> 1));
    const d = rr * 2 + 1;
    const corner = new Int32Array(d * 2);
    ellipseSpans(d, d, corner);
    const spans = ensureSpans(h);
    for (let j = 0; j < h; j++) {
      const k = j < rr ? j : j >= h - rr ? h - 1 - j : -1;
      const inset = k >= 0 ? corner[k * 2] : 0;
      spans[j * 2] = x + inset;
      spans[j * 2 + 1] = x + w - 1 - inset;
    }
    return fill ? this.fillSpans(y, h, spans, c) : this.strokeSpans(y, h, spans, c);
  }

  private fillSpans(y: number, rows: number, spans: Int32Array, c: Color): this {
    for (let j = 0; j < rows; j++) {
      const l = spans[j * 2];
      const r = spans[j * 2 + 1];
      if (l <= r) this.hline(l, r, y + j, c);
    }
    return this;
  }

  /** Boundary of a span shape: pixels with at least one 4-neighbour outside the shape. */
  private strokeSpans(y: number, rows: number, spans: Int32Array, c: Color): this {
    for (let j = 0; j < rows; j++) {
      const l = spans[j * 2];
      const r = spans[j * 2 + 1];
      if (l > r) continue;
      // Interior columns must be inside the rows above and below too.
      let il = l + 1;
      let ir = r - 1;
      if (j === 0 || j === rows - 1) {
        il = 1;
        ir = 0;
      } else {
        const ul = spans[(j - 1) * 2];
        const ur = spans[(j - 1) * 2 + 1];
        const dl = spans[(j + 1) * 2];
        const dr = spans[(j + 1) * 2 + 1];
        if (ul > ur || dl > dr) {
          il = 1;
          ir = 0;
        } else {
          il = Math.max(il, ul, dl);
          ir = Math.min(ir, ur, dr);
        }
      }
      if (il > ir) {
        this.hline(l, r, y + j, c);
      } else {
        this.hline(l, il - 1, y + j, c);
        this.hline(ir + 1, r, y + j, c);
      }
    }
    return this;
  }

  // ---------------------------------------------------------------- polygons

  /**
   * Filled polygon (even-odd rule, concave OK). Vertices are pixel centres and are rounded to
   * integers, so results are exact: interior rows are filled between the edge crossings
   * (inclusive) and the edges themselves are drawn with Bresenham lines — every vertex pixel is
   * painted and thin slivers never break up.
   */
  poly(points: PolyPoints, c: Color): this {
    const n = pointCount(points);
    if (n === 0) return this;
    if (n < 3) return this.polyline(points, c, false);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = Math.round(py(points, i));
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (polyScratch.length < n + 2) polyScratch = new Float64Array(n * 2 + 8);
    const xs = polyScratch;
    const y0 = Math.max(minY, 0);
    const y1 = Math.min(maxY, this.h - 1);
    for (let y = y0; y <= y1; y++) {
      let count = 0;
      for (let i = 0; i < n; i++) {
        const j = i + 1 === n ? 0 : i + 1;
        const ay = Math.round(py(points, i));
        const by = Math.round(py(points, j));
        if (ay === by) continue;
        const lo = Math.min(ay, by);
        const hi = Math.max(ay, by);
        if (y < lo || y >= hi) continue; // half-open: shared vertices count once
        const ax = Math.round(px(points, i));
        const bx = Math.round(px(points, j));
        xs[count++] = ax + ((y - ay) * (bx - ax)) / (by - ay);
      }
      // Insertion sort: crossing lists are tiny.
      for (let i = 1; i < count; i++) {
        const v = xs[i];
        let k = i - 1;
        while (k >= 0 && xs[k] > v) {
          xs[k + 1] = xs[k];
          k--;
        }
        xs[k + 1] = v;
      }
      for (let i = 0; i + 1 < count; i += 2) {
        const l = Math.ceil(xs[i] - 1e-9);
        const r = Math.floor(xs[i + 1] + 1e-9);
        if (l <= r) this.hline(l, r, y, c);
      }
    }
    return this.polyline(points, c, true);
  }

  /** Filled triangle. */
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Color): this {
    return this.poly([x0, y0, x1, y1, x2, y2], c);
  }

  // ---------------------------------------------------------------- compositing

  /**
   * Draw `src` with its top-left at (dx, dy). Transparent source pixels are skipped (except in
   * 'copy' mode). Flips mirror the source rectangle in place.
   */
  blit(src: PixelBuffer, dx: number, dy: number, o?: BlitOpts): this {
    dx = Math.round(dx);
    dy = Math.round(dy);
    const flipX = o?.flipX === true;
    const flipY = o?.flipY === true;
    const map = o?.map;
    const solid = o?.solid;
    const blend = o?.blend ?? 'over';
    const alpha = o?.alpha === undefined ? 1 : Math.max(0, Math.min(1, o.alpha));
    if (alpha <= 0 && blend !== 'copy') return this;
    let sx = Math.round(o?.sx ?? 0);
    let sy = Math.round(o?.sy ?? 0);
    let sw = Math.round(o?.sw ?? src.w - sx);
    let sh = Math.round(o?.sh ?? src.h - sy);
    // Clip the source rectangle to the source buffer.
    if (sx < 0) {
      sw += sx;
      if (!flipX) dx -= sx;
      sx = 0;
    }
    if (sy < 0) {
      sh += sy;
      if (!flipY) dy -= sy;
      sy = 0;
    }
    if (sx + sw > src.w) {
      if (flipX) dx += sx + sw - src.w;
      sw = src.w - sx;
    }
    if (sy + sh > src.h) {
      if (flipY) dy += sy + sh - src.h;
      sh = src.h - sy;
    }
    if (sw <= 0 || sh <= 0) return this;
    // Clip the destination.
    const x0 = Math.max(0, dx);
    const y0 = Math.max(0, dy);
    const x1 = Math.min(this.w, dx + sw);
    const y1 = Math.min(this.h, dy + sh);
    if (x0 >= x1 || y0 >= y1) return this;

    const sd = src.data;
    const dd = this.data;
    const srcW = src.w;
    const fast = !map && solid === undefined && alpha === 1 && blend === 'over';
    for (let y = y0; y < y1; y++) {
      const ry = y - dy;
      const srow = (sy + (flipY ? sh - 1 - ry : ry)) * srcW + sx;
      const drow = y * this.w;
      for (let x = x0; x < x1; x++) {
        const rx = x - dx;
        let s = sd[srow + (flipX ? sw - 1 - rx : rx)];
        const di = drow + x;
        if (fast) {
          const a = s & 255;
          if (a === 255) dd[di] = s;
          else if (a !== 0) dd[di] = blendOver(dd[di], s);
          continue;
        }
        if ((s & 255) === 0) {
          if (blend === 'copy') dd[di] = 0;
          continue;
        }
        if (map) s = mapColor(map, s);
        if (solid !== undefined) s = ((solid & 0xffffff00) | (s & 255)) >>> 0;
        if (blend === 'over') dd[di] = blendOver(dd[di], s, alpha);
        else if (blend === 'add') dd[di] = blendAdd(dd[di], s, alpha);
        else dd[di] = alpha === 1 ? s : ((s & 0xffffff00) | Math.round((s & 255) * alpha)) >>> 0;
      }
    }
    this.version++;
    return this;
  }

  /**
   * Draw a sprite Frame with its anchor at (x, y); flips mirror around the anchor pixel exactly
   * like the renderers do. Use it to compose sprites from parts (legs + torso, hull + turret).
   */
  blitFrame(f: Frame, x: number, y: number, o?: BlitOpts): this {
    const p = placeAnchored(framePlace, f.buf.w, f.buf.h, f.ox, f.oy, x, y, o?.flipX === true, o?.flipY === true, 0, 0);
    return this.blit(f.buf, p.x, p.y, o);
  }

  /** Composite a colour over a rectangle ('over' or 'add'), e.g. translucent overlays. */
  blendRect(x: number, y: number, w: number, h: number, c: Color, alpha = 1, mode: 'over' | 'add' = 'over'): this {
    x = Math.round(x);
    y = Math.round(y);
    let x1 = x + Math.round(w);
    let y1 = y + Math.round(h);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x1 > this.w) x1 = this.w;
    if (y1 > this.h) y1 = this.h;
    if (x >= x1 || y >= y1 || alpha <= 0 || (c & 255) === 0) return this;
    if (mode === 'over' && alpha >= 1 && (c & 255) === 255) return this.rect(x, y, x1 - x, y1 - y, c);
    const d = this.data;
    for (let yy = y; yy < y1; yy++) {
      const row = yy * this.w;
      for (let xx = x; xx < x1; xx++) {
        d[row + xx] = mode === 'add' ? blendAdd(d[row + xx], c, alpha) : blendOver(d[row + xx], c, alpha);
      }
    }
    this.version++;
    return this;
  }

  /** Composite one pixel. */
  blendPixel(x: number, y: number, c: Color, alpha = 1, mode: 'over' | 'add' = 'over'): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = y * this.w + x;
    this.data[i] = mode === 'add' ? blendAdd(this.data[i], c, alpha) : blendOver(this.data[i], c, alpha);
    this.version++;
    return this;
  }

  // ---------------------------------------------------------------- colour operations

  /** Replace every pixel equal to `from` with `to`. */
  replace(from: Color, to: Color): this {
    const f = from >>> 0;
    const t = to >>> 0;
    const d = this.data;
    for (let i = 0; i < d.length; i++) if (d[i] === f) d[i] = t;
    this.version++;
    return this;
  }

  /** Recolour non-transparent pixels through a map (palette swaps, team colours). */
  recolor(map: ColorMap): this {
    const d = this.data;
    for (let i = 0; i < d.length; i++) {
      if ((d[i] & 255) !== 0) d[i] = mapColor(map, d[i]);
    }
    this.version++;
    return this;
  }

  /** Paint every non-transparent pixel with `c` (alpha of `c` is used). Shadows, masks. */
  silhouette(c: Color): this {
    const col = c >>> 0;
    const d = this.data;
    for (let i = 0; i < d.length; i++) if ((d[i] & 255) !== 0) d[i] = col;
    this.version++;
    return this;
  }

  /** Copy the left half mirrored onto the right half ('x'), or the top half onto the bottom ('y'). */
  mirror(axis: 'x' | 'y' = 'x'): this {
    const { w, h, data } = this;
    if (axis === 'x') {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w >> 1; x++) data[y * w + (w - 1 - x)] = data[y * w + x];
      }
    } else {
      for (let y = 0; y < h >> 1; y++) data.copyWithin((h - 1 - y) * w, y * w, y * w + w);
    }
    this.version++;
    return this;
  }

  // ---------------------------------------------------------------- pixel-art effects

  /**
   * 1-px outline in colour `c` around the shape (every non-transparent pixel, or `only`).
   * Outer mode (default) paints transparent pixels next to the shape; `inside` recolours the
   * shape's own edge pixels instead.
   *
   * Margin rule: the outer outline is drawn INSIDE this buffer, so leave a 1-px transparent
   * margin around art you will outline (or call `padded(1)` first). Shape pixels touching the
   * buffer edge get no outline beyond that edge. Edges count as "outside" for `inside` mode.
   */
  outline(c: Color, o?: OutlineOpts): this {
    const { w, h, data } = this;
    const corners = o?.corners === true;
    const only = o?.only === undefined ? undefined : o.only >>> 0;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = only === undefined ? ((data[i] & 255) !== 0 ? 1 : 0) : data[i] === only ? 1 : 0;
    }
    const inShape = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    const col = c >>> 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (o?.inside) {
          if (mask[i] !== 1) continue;
          let edge = !inShape(x - 1, y) || !inShape(x + 1, y) || !inShape(x, y - 1) || !inShape(x, y + 1);
          if (!edge && corners) {
            edge =
              !inShape(x - 1, y - 1) || !inShape(x + 1, y - 1) || !inShape(x - 1, y + 1) || !inShape(x + 1, y + 1);
          }
          if (edge) data[i] = col;
        } else {
          if (mask[i] === 1 || (data[i] & 255) !== 0) continue;
          let near = inShape(x - 1, y) || inShape(x + 1, y) || inShape(x, y - 1) || inShape(x, y + 1);
          if (!near && corners) {
            near = inShape(x - 1, y - 1) || inShape(x + 1, y - 1) || inShape(x - 1, y + 1) || inShape(x + 1, y + 1);
          }
          if (near) data[i] = col;
        }
      }
    }
    this.version++;
    return this;
  }

  /**
   * Auto-shading with a dark→light ramp. Every shape pixel gets ramp[base]; pixels within
   * `depth` steps of the edge that faces the light get lighter shades, pixels near the opposite
   * edge get darker ones (closer to the edge = stronger). Ties (1-px slivers) keep the base.
   */
  bevel(ramp: Ramp, o?: BevelOpts): this {
    const n = ramp.length;
    if (n === 0) return this;
    const { w, h, data } = this;
    const [lx, ly] = lightVector(o?.light);
    const depth = Math.max(1, Math.round(o?.depth ?? 1));
    const base = Math.max(0, Math.min(n - 1, Math.round(o?.base ?? Math.ceil((n - 1) / 2))));
    const only = o?.only === undefined ? undefined : o.only >>> 0;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = only === undefined ? ((data[i] & 255) !== 0 ? 1 : 0) : data[i] === only ? 1 : 0;
    }
    // Steps from (x, y) along (sx, sy) until leaving the shape, capped at depth + 1.
    const reach = (x: number, y: number, sx: number, sy: number): number => {
      for (let k = 1; k <= depth; k++) {
        const xx = x + sx * k;
        const yy = y + sy * k;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || mask[yy * w + xx] === 0) return k;
      }
      return depth + 1;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mask[i] === 0) continue;
        let idx = base;
        if (lx !== 0 || ly !== 0) {
          const dl = reach(x, y, lx, ly);
          const ds = reach(x, y, -lx, -ly);
          if (dl <= depth && dl < ds) idx = base + (depth - dl + 1);
          else if (ds <= depth && ds < dl) idx = base - (depth - ds + 1);
        }
        data[i] = ramp[idx < 0 ? 0 : idx >= n ? n - 1 : idx] >>> 0;
      }
    }
    this.version++;
    return this;
  }

  /**
   * Ordered dither of colour `c` over a rectangle. `level` 0..1 is the coverage (0 = nothing,
   * 0.5 = checkerboard, 1 = solid). The pattern is anchored to buffer coordinates, so
   * neighbouring dithered areas line up.
   */
  dither(x: number, y: number, w: number, h: number, c: Color, level = 0.5, o?: DitherOpts): this {
    const lvl = Math.max(0, Math.min(1, level));
    if (lvl <= 0) return this;
    const checker = o?.pattern === 'checker';
    const cut = Math.round(lvl * 16);
    const col = c >>> 0;
    this.eachPixel(x, y, w, h, o?.only, (i, px, py) => {
      const on = lvl >= 1 || (checker ? ((px + py) & 1) === 0 : bayer4(px, py) < cut);
      if (on) this.data[i] = col;
    });
    return this;
  }

  /** Banded ramp gradient over a rectangle with optional dithered transitions between bands. */
  gradient(x: number, y: number, w: number, h: number, ramp: Ramp, o?: GradientOpts): this {
    const n = ramp.length;
    if (n === 0) return this;
    const vertical = o?.vertical !== false;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const len = Math.max(1, vertical ? Math.round(h) : Math.round(w));
    const z = o?.dither === undefined || o.dither === true ? 0.25 : o.dither === false ? 0 : Math.max(0, Math.min(0.5, o.dither));
    const pick = (i: number): Color => ramp[o?.reverse ? n - 1 - i : i] >>> 0;
    this.eachPixel(x, y, w, h, o?.only, (i, px, py) => {
      const t = vertical ? py - ry : px - rx;
      this.data[i] = pick(bandIndex(((t + 0.5) * n) / len, n, z, px, py));
    });
    return this;
  }

  /** Scatter random pixels. `rand` returns [0, 1) — pass a seeded generator for stable art. */
  noise(rand: () => number, o: NoiseOpts): this {
    const colors = o.colors;
    if (colors.length === 0) return this;
    const density = o.density ?? 0.1;
    this.eachPixel(o.x ?? 0, o.y ?? 0, o.w ?? this.w, o.h ?? this.h, o.only, (i) => {
      if (rand() < density) this.data[i] = colors[Math.floor(rand() * colors.length) % colors.length] >>> 0;
    });
    return this;
  }

  /** Visit pixels of a clipped rectangle that pass the filter. */
  private eachPixel(
    x: number,
    y: number,
    w: number,
    h: number,
    only: PixelFilter | undefined,
    fn: (i: number, x: number, y: number) => void,
  ): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x) + Math.round(w));
    const y1 = Math.min(this.h, Math.round(y) + Math.round(h));
    const d = this.data;
    const exact = typeof only === 'number' ? only >>> 0 : 0;
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = yy * this.w + xx;
        if (only !== undefined) {
          const a = d[i] & 255;
          if (only === 'opaque' ? a === 0 : only === 'empty' ? a !== 0 : d[i] !== exact) continue;
        }
        fn(i, xx, yy);
      }
    }
    this.version++;
  }
}

function pointCount(p: PolyPoints): number {
  return typeof p[0] === 'number' ? p.length >> 1 : p.length;
}

function px(p: PolyPoints, i: number): number {
  return typeof p[0] === 'number' ? (p as readonly number[])[i * 2] : (p as readonly Point[])[i][0];
}

function py(p: PolyPoints, i: number): number {
  return typeof p[0] === 'number' ? (p as readonly number[])[i * 2 + 1] : (p as readonly Point[])[i][1];
}
