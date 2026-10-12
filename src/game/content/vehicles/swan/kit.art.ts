/**
 * SWAN-3 art kit: the drawing toolkit of the swan rig (docs/design/swan-mount/look.md §5).
 *
 * Body space (look.md §3.1): x forward (sprites face right), y down, origin (0, 0) = the feet
 * anchor (bottom centre of the 28×48 physics body). Every frame is drawn in one fixed scratch
 * canvas (body (0, 0) at canvas (OX, OY)) and cropped at the end.
 *
 * - `Layer`: a canvas-sized scratch buffer with a dirty box. Shapes are drawn flat in body
 *   coordinates, then shaded with a palette ramp (`shade`, light from the upper left).
 * - `Stack`: stacks layers back to front. Where a front part's 1-px ring falls on a part behind
 *   it, the ring becomes that part's darkest shade (an internal line), exactly like `Composer`
 *   in `src/game/art/paint.ts`; it also records which part owns each pixel (the front overlays
 *   are cut out of the finished frame by owner). Every step only touches the part's own box:
 *   the game builds several hundred swan frames at boot.
 * - `Xf`: the frame transform. Hull-attached points turn with the tilt about the `hull` point
 *   (−3, −38) (+ = nose down) and move with the hull offset (dx, dy). Vertices are rotated,
 *   never pixels (look.md §5).
 * - `harvest`: crop the stack and add the outline (INK above the water line, `navy[0]` below it,
 *   look.md §5.8).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { at } from '../../../art/paint';

/** A point in body space. */
export type Pt = readonly [number, number];
export type V = [number, number];

/** Scratch canvas: body (0, 0) sits on canvas pixel (OX, OY). */
export const CW = 128;
export const CH = 128;
export const OX = 64;
export const OY = 112;

const N = CW * CH;

// ------------------------------------------------------------------------------------ layers

/** A canvas-sized scratch buffer with a dirty box (canvas pixels, inclusive). */
export class Layer {
  readonly buf = new PixelBuffer(CW, CH);
  x0 = CW;
  y0 = CH;
  x1 = -1;
  y1 = -1;

  /** Grow the dirty box by a body-space box (inclusive), clamped to the canvas. */
  mark(ax: number, ay: number, bx: number, by: number): void {
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx)) + OX);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by)) + OY);
    const x1 = Math.min(CW - 1, Math.ceil(Math.max(ax, bx)) + OX);
    const y1 = Math.min(CH - 1, Math.ceil(Math.max(ay, by)) + OY);
    if (x0 < this.x0) this.x0 = x0;
    if (y0 < this.y0) this.y0 = y0;
    if (x1 > this.x1) this.x1 = x1;
    if (y1 > this.y1) this.y1 = y1;
  }

  get used(): boolean {
    return this.x1 >= this.x0 && this.y1 >= this.y0;
  }

  /** Erase the dirty box and forget it. */
  clear(): void {
    if (this.used) {
      const d = this.buf.data;
      for (let y = this.y0; y <= this.y1; y++) d.fill(0, y * CW + this.x0, y * CW + this.x1 + 1);
      this.buf.touch();
    }
    this.x0 = CW;
    this.y0 = CH;
    this.x1 = -1;
    this.y1 = -1;
  }

  /** Colour at a body-space pixel (0 outside the canvas). */
  get(x: number, y: number): Color {
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 0;
    return this.buf.data[cy * CW + cx];
  }
}

const pool: Layer[] = [];

/** A clean scratch layer (give it back with `release`). */
export function take(): Layer {
  return pool.pop() ?? new Layer();
}

/** Clear a layer and return it to the pool. */
export function release(L: Layer): void {
  L.clear();
  pool.push(L);
}

// ------------------------------------------------------------------------------------ shapes

/** Filled polygon (body space). */
export function poly(L: Layer, pts: readonly Pt[], c: Color): void {
  if (pts.length === 0) return;
  const flat: number[] = [];
  let ax = Infinity;
  let ay = Infinity;
  let bx = -Infinity;
  let by = -Infinity;
  for (const p of pts) {
    flat.push(p[0] + OX, p[1] + OY);
    ax = Math.min(ax, p[0]);
    ay = Math.min(ay, p[1]);
    bx = Math.max(bx, p[0]);
    by = Math.max(by, p[1]);
  }
  L.mark(ax - 1, ay - 1, bx + 1, by + 1);
  L.buf.poly(flat, c);
}

/** Tapered capsule from a (diameter w0) to b (diameter w1). */
export function taper(L: Layer, a: Pt, b: Pt, w0: number, w1: number, c: Color): void {
  const r = Math.max(w0, w1) / 2 + 2;
  L.mark(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r);
  L.buf.taper(a[0] + OX, a[1] + OY, b[0] + OX, b[1] + OY, w0, w1, c);
}

/** Round-capped thick line. */
export function thick(L: Layer, a: Pt, b: Pt, w: number, c: Color): void {
  taper(L, a, b, w, w, c);
}

/** Filled disc of radius r (diameter 2r + 1) on pixel (cx, cy). */
export function disc(L: Layer, cx: number, cy: number, r: number, c: Color): void {
  L.mark(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1);
  L.buf.circle(cx + OX, cy + OY, r, c);
}

/** Filled ellipse inscribed in the box (x, y, w, h). */
export function oval(L: Layer, x: number, y: number, w: number, h: number, c: Color): void {
  L.mark(x - 1, y - 1, x + w + 1, y + h + 1);
  L.buf.ellipse(x + OX, y + OY, w, h, c);
}

/** 1-px line. */
export function line(L: Layer, a: Pt, b: Pt, c: Color): void {
  L.mark(Math.min(a[0], b[0]) - 1, Math.min(a[1], b[1]) - 1, Math.max(a[0], b[0]) + 1, Math.max(a[1], b[1]) + 1);
  L.buf.line(Math.round(a[0]) + OX, Math.round(a[1]) + OY, Math.round(b[0]) + OX, Math.round(b[1]) + OY, c);
}

/** One pixel. */
export function dot(L: Layer, x: number, y: number, c: Color): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  L.mark(rx, ry, rx, ry);
  L.buf.set(rx + OX, ry + OY, c);
}

// ------------------------------------------------------------------------------------ shading

export interface ShadeOpts {
  /** Ramp index of the interior (default 2; 1 for 3-colour ramps). */
  base?: number;
  /** Width of the lit band on the top / left edges (default 1). */
  hi?: number;
  /** Width of the shadow band on the bottom / right edges (default 1). */
  lo?: number;
  /** Extra-light pixel on lit convex corners (metal). */
  glint?: boolean;
  /** Shift every tone (−1 = the far side, one shade darker). */
  shift?: number;
}

let maskScratch = new Uint8Array(0);

/**
 * Shade every pixel of the layer with a ramp, lit from the upper left (the rule of
 * `shadeLayer` in paint.ts, limited to the dirty box): top / left edge pixels get base + 1,
 * bottom / right edge pixels base − 1, 1-px slivers keep the base.
 */
export function shade(L: Layer, ramp: Ramp, o: ShadeOpts = {}): void {
  if (!L.used) return;
  const n = ramp.length;
  const base = o.base ?? (n >= 4 ? 2 : 1);
  const hi = o.hi ?? 1;
  const lo = o.lo ?? 1;
  const shift = o.shift ?? 0;
  // The box plus a 1-px frame of empty pixels so edge tests need no bounds checks.
  const x0 = L.x0 - 1;
  const y0 = L.y0 - 1;
  const w = L.x1 - L.x0 + 3;
  const h = L.y1 - L.y0 + 3;
  if (maskScratch.length < w * h) maskScratch = new Uint8Array(w * h);
  const mask = maskScratch;
  mask.fill(0, 0, w * h);
  const d = L.buf.data;
  for (let y = L.y0; y <= L.y1; y++) {
    for (let x = L.x0; x <= L.x1; x++) if ((d[y * CW + x] & 255) !== 0) mask[(y - y0) * w + (x - x0)] = 1;
  }
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mask[y * w + x] === 0) continue;
      let lit = false;
      for (let k = 1; k <= hi && !lit; k++) lit = !inside(x - k, y) || !inside(x, y - k);
      let dark = false;
      for (let k = 1; k <= lo && !dark; k++) dark = !inside(x + k, y) || !inside(x, y + k);
      let idx = base;
      if (lit && !dark) idx = base + 1;
      else if (dark && !lit) idx = base - 1;
      if (o.glint && lit && !dark && !inside(x, y - 1) && inside(x + 1, y) && inside(x, y + 1) && inside(x + 1, y + 1)) idx = base + 2;
      d[(y + y0) * CW + (x + x0)] = at(ramp, idx + shift);
    }
  }
  L.buf.touch();
}

/** Recolour every pixel of a layer through a function (inside the dirty box). */
export function recolor(L: Layer, fn: (c: Color, x: number, y: number) => Color): void {
  if (!L.used) return;
  const d = L.buf.data;
  for (let y = L.y0; y <= L.y1; y++) {
    for (let x = L.x0; x <= L.x1; x++) {
      const i = y * CW + x;
      if ((d[i] & 255) !== 0) d[i] = fn(d[i], x - OX, y - OY);
    }
  }
  L.buf.touch();
}

// ------------------------------------------------------------------------------------ stack

/** Part owners: the front overlays and the scuffs are cut out of a finished frame by owner. */
export const OWN = {
  none: 0,
  farWing: 1,
  farLeg: 2,
  tail: 3,
  hull: 4,
  pad: 5,
  handle: 6,
  nearLeg: 7,
  nearWing: 8,
  neck: 9,
  head: 10,
  fx: 11,
} as const;

/** Back-to-front part stack with internal lines and per-pixel owners. */
export class Stack {
  readonly buf = new PixelBuffer(CW, CH);
  readonly own = new Uint8Array(N);
  private readonly lineOf = new Uint32Array(N);
  x0 = CW;
  y0 = CH;
  x1 = -1;
  y1 = -1;

  get used(): boolean {
    return this.x1 >= this.x0;
  }

  /** Empty the stack. */
  reset(): void {
    if (this.used) {
      const d = this.buf.data;
      for (let y = this.y0; y <= this.y1; y++) {
        const a = y * CW + this.x0;
        const b = y * CW + this.x1 + 1;
        d.fill(0, a, b);
        this.own.fill(0, a, b);
        this.lineOf.fill(0, a, b);
      }
      this.buf.touch();
    }
    this.x0 = CW;
    this.y0 = CH;
    this.x1 = -1;
    this.y1 = -1;
  }

  /**
   * Composite a part layer over the stack. `line` = this part's internal-line colour (used when
   * a later part's ring falls on it); `ring` false = no line around this part.
   */
  add(L: Layer, owner: number, line: Color, ring = true): void {
    if (!L.used) return;
    const src = L.buf.data;
    const dst = this.buf.data;
    if (ring) {
      const x0 = Math.max(0, L.x0 - 1);
      const y0 = Math.max(0, L.y0 - 1);
      const x1 = Math.min(CW - 1, L.x1 + 1);
      const y1 = Math.min(CH - 1, L.y1 + 1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * CW + x;
          if ((src[i] & 255) !== 0 || (dst[i] & 255) === 0) continue;
          const near =
            (x > 0 && (src[i - 1] & 255) !== 0) ||
            (x < CW - 1 && (src[i + 1] & 255) !== 0) ||
            (y > 0 && (src[i - CW] & 255) !== 0) ||
            (y < CH - 1 && (src[i + CW] & 255) !== 0);
          // The line is the darkest shade of the part behind (a cast-shadow edge).
          if (near) dst[i] = this.lineOf[i] || INK;
        }
      }
    }
    for (let y = L.y0; y <= L.y1; y++) {
      for (let x = L.x0; x <= L.x1; x++) {
        const i = y * CW + x;
        const c = src[i];
        if ((c & 255) === 0) continue;
        dst[i] = c;
        this.lineOf[i] = line;
        this.own[i] = owner;
      }
    }
    if (L.x0 < this.x0) this.x0 = L.x0;
    if (L.y0 < this.y0) this.y0 = L.y0;
    if (L.x1 > this.x1) this.x1 = L.x1;
    if (L.y1 > this.y1) this.y1 = L.y1;
    this.buf.touch();
  }

  /** Add a layer, then release it to the pool. */
  put(L: Layer, owner: number, line: Color, ring = true): void {
    this.add(L, owner, line, ring);
    release(L);
  }

  /** Colour at a body-space pixel (0 = empty or outside). */
  get(x: number, y: number): Color {
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 0;
    return this.buf.data[cy * CW + cx];
  }

  /** Owner at a body-space pixel. */
  ownerAt(x: number, y: number): number {
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 0;
    return this.own[cy * CW + cx];
  }

  /**
   * Paint a detail pixel (rivet, seam, stencil) onto an existing part: only where the stack is
   * already opaque and, when `owner` is given, owned by that part. No ring.
   */
  detail(x: number, y: number, c: Color, owner?: number): void {
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return;
    const i = cy * CW + cx;
    if ((this.buf.data[i] & 255) === 0) return;
    if (owner !== undefined && this.own[i] !== owner) return;
    this.buf.data[i] = c;
    this.buf.touch();
  }
}

// ------------------------------------------------------------------------------------ transform

/** The `hull` point: tilt pivot, scuffs anchor, HONK ring centre (look.md §8.1). */
export const PIVOT: Pt = [-3, -38];

/** Frame transform: rotate about the hull point by `deg` (+ = nose down), then offset. */
export class Xf {
  readonly c: number;
  readonly s: number;
  readonly dx: number;
  readonly dy: number;
  readonly deg: number;

  constructor(deg = 0, dx = 0, dy = 0) {
    const r = (deg * Math.PI) / 180;
    this.c = Math.cos(r);
    this.s = Math.sin(r);
    this.dx = dx;
    this.dy = dy;
    this.deg = deg;
  }

  /** Rest (hull-attached) point → body space. */
  p(x: number, y: number): V {
    const rx = x - PIVOT[0];
    const ry = y - PIVOT[1];
    return [PIVOT[0] + rx * this.c - ry * this.s + this.dx, PIVOT[1] + rx * this.s + ry * this.c + this.dy];
  }

  /** Same as `p` for a point tuple. */
  pt(q: Pt): V {
    return this.p(q[0], q[1]);
  }

  /** Every point of a list. */
  all(qs: readonly Pt[]): V[] {
    return qs.map((q) => this.p(q[0], q[1]));
  }

  /** Rotate a direction (no offset). */
  dir(x: number, y: number): V {
    return [x * this.c - y * this.s, x * this.s + y * this.c];
  }

  /** Body point → rest (hull) coordinates (the inverse of `p`). */
  inv(x: number, y: number): V {
    const rx = x - this.dx - PIVOT[0];
    const ry = y - this.dy - PIVOT[1];
    return [PIVOT[0] + rx * this.c + ry * this.s, PIVOT[1] - rx * this.s + ry * this.c];
  }

  /** Rounded body point (for named points). */
  ip(x: number, y: number): [number, number] {
    const q = this.p(x, y);
    return [Math.round(q[0]) + 0, Math.round(q[1]) + 0];
  }
}

// ------------------------------------------------------------------------------------ geometry

export function add(a: Pt, b: Pt, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

export function sub(a: Pt, b: Pt): V {
  return [a[0] - b[0], a[1] - b[1]];
}

export function len(a: Pt): number {
  return Math.hypot(a[0], a[1]);
}

export function unit(a: Pt): V {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
}

export function lerp2(a: Pt, b: Pt, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Rotate a vector by `deg` degrees (y down: + turns clockwise on screen). */
export function rot(a: Pt, deg: number): V {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
}

/** Point on a cubic Bézier. */
export function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): V {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Sample a polyline every ~`step` px: points and the arc length at each. */
export function samplePolyline(pts: readonly Pt[], step = 1): { p: V[]; s: number[]; total: number } {
  const p: V[] = [[pts[0][0], pts[0][1]]];
  const s: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++) {
      p.push(lerp2(a, b, k / n));
      s.push(total + (l * k) / n);
    }
    total += l;
  }
  return { p, s, total };
}

/** Point at arc length `d` along a sampled polyline. */
export function along(sm: { p: V[]; s: number[] }, d: number): V {
  const { p, s } = sm;
  if (d <= 0) return [p[0][0], p[0][1]];
  for (let i = 1; i < s.length; i++) {
    if (s[i] >= d) {
      const t = (d - s[i - 1]) / (s[i] - s[i - 1] || 1);
      return lerp2(p[i - 1], p[i], t);
    }
  }
  const q = p[p.length - 1];
  return [q[0], q[1]];
}

/** Unit tangent at arc length `d`. */
export function tangentAt(sm: { p: V[]; s: number[] }, d: number): V {
  const a = along(sm, Math.max(0, d - 1.5));
  const b = along(sm, d + 1.5);
  return unit(sub(b, a));
}

// ------------------------------------------------------------------------------------ harvest

export interface Harvest {
  buf: PixelBuffer;
  /** Body (0, 0) inside `buf`. */
  ox: number;
  oy: number;
  /** Owner of each pixel of `buf` (0 = outline or empty). */
  own: Uint8Array;
}

/** Under-water colours (look.md §4): steel → navy, orange → teal, ivory → sky, lines → navy. */
const WATER = new Map<Color, Color>([
  [PAL.snow[3], PAL.sky[2]],
  [PAL.snow[2], PAL.sky[2]],
  [PAL.snow[1], PAL.sky[1]],
  [PAL.steel[4], PAL.sky[1]],
  [PAL.steel[3], PAL.sky[0]],
  [PAL.steel[2], PAL.navy[1]],
  [PAL.steel[1], PAL.navy[0]],
  [PAL.steel[0], PAL.navy[0]],
  [PAL.orange[3], PAL.teal[2]],
  [PAL.orange[2], PAL.teal[2]],
  [PAL.orange[1], PAL.teal[1]],
  [PAL.orange[0], PAL.teal[0]],
  [PAL.gold[3], PAL.teal[2]],
  [PAL.gold[1], PAL.teal[1]],
  [PAL.gold[0], PAL.teal[0]],
  [PAL.red[3], PAL.teal[2]],
  [PAL.red[2], PAL.teal[1]],
  [PAL.red[1], PAL.teal[0]],
  [PAL.cloth[3], PAL.sky[2]],
  [PAL.cloth[1], PAL.sky[1]],
  [PAL.cloth[0], PAL.sky[0]],
  [PAL.ink[0], PAL.navy[0]],
  [PAL.ink[1], PAL.navy[0]],
  [PAL.navy[0], PAL.navy[0]],
  [PAL.navy[1], PAL.navy[1]],
]);

/** Under-water colour of a palette colour. */
export function waterColour(c: Color): Color {
  return WATER.get(c) ?? PAL.navy[1];
}

/** Under-water outline colour (look.md §5.8). */
export const WATER_LINE: Color = PAL.navy[0];

export interface HarvestOpts {
  /** Water surface line (body y): pixels at y ≥ surface are under water (look.md §5.8). */
  surface?: number | null;
  /** Extra body-space box to keep inside the crop (fx drawn after the outline). */
  extra?: readonly [number, number, number, number];
}

/**
 * Crop the stack (+ a 1-px margin) and outline it: INK around the parts above the water line,
 * `navy[0]` around the parts under it (each outlined on its own, look.md §5.8).
 */
export function harvest(st: Stack, o: HarvestOpts = {}): Harvest {
  let x0 = st.x0 - 1;
  let y0 = st.y0 - 1;
  let x1 = st.x1 + 1;
  let y1 = st.y1 + 1;
  if (o.extra) {
    x0 = Math.min(x0, o.extra[0] + OX);
    y0 = Math.min(y0, o.extra[1] + OY);
    x1 = Math.max(x1, o.extra[2] + OX);
    y1 = Math.max(y1, o.extra[3] + OY);
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(CW - 1, x1);
  y1 = Math.min(CH - 1, y1);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const buf = new PixelBuffer(w, h);
  const own = new Uint8Array(w * h);
  const src = st.buf.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y + y0) * CW + (x + x0);
      buf.data[y * w + x] = src[i];
      own[y * w + x] = st.own[i];
    }
  }
  const ox = OX - x0;
  const oy = OY - y0;
  const surf = o.surface ?? null;
  // Rows at or below `wy` (buffer y) are under water.
  const wy = surf === null ? h : surf + oy;
  const d = buf.data;
  // Wing plates slap the surface from above (paddle-up beats): they keep their colours.
  const dry = (i: number): boolean => own[i] === OWN.nearWing || own[i] === OWN.farWing;
  if (surf !== null) {
    for (let y = Math.max(0, wy); y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if ((d[i] & 255) !== 0 && !dry(i)) d[i] = waterColour(d[i]);
      }
    }
  }
  // One outline pass over the merged parts: INK where it touches a part above the line.
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = (d[i] & 255) !== 0 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      let above = false;
      let below = false;
      const test = (xx: number, yy: number): void => {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || !solid[yy * w + xx]) return;
        if (yy >= wy && !dry(yy * w + xx)) below = true;
        else above = true;
      };
      test(x - 1, y);
      test(x + 1, y);
      test(x, y - 1);
      test(x, y + 1);
      if (above) d[i] = INK;
      else if (below) d[i] = WATER_LINE;
    }
  }
  buf.touch();
  return { buf, ox, oy, own };
}
