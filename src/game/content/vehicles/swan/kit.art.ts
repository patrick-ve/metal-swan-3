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
 *
 * 2× art (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): `withKitDensity(2, fn)` draws
 * the same rig on a canvas of twice the resolution. Coordinates stay in LOGICAL body space (the
 * transform, the IK and every named point are the 1× numbers); the shapes are drawn with their
 * true outline at half-pixel steps, shading bands, rings and the outline keep the 1× weight
 * (2 px = 1 logical px), and `fine` / `Stack.fine` place single 2× pixels for the details.
 * Logical pixel centre x lies on the 2× canvas line 2 · (x + OX) + 1 (between two 2× pixels).
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

/** Density of the drawing in progress: 1 (the 1× frames) or 2 (2× art). */
let D: 1 | 2 = 1;

/** The kit's current density. */
export function kitDensity(): 1 | 2 {
  return D;
}

/** Run `fn` with the kit drawing at density `d` (layers, stacks and harvests made inside it). */
export function withKitDensity<T>(d: 1 | 2, fn: () => T): T {
  const prev = D;
  D = d;
  try {
    return fn();
  } finally {
    D = prev;
  }
}

/** 2× canvas pixel of the logical position x (integer x → its left / upper half, x + 0.5 → right / lower). */
function hiPx(x: number, o: number): number {
  return Math.round((x + o) * 2);
}

// ------------------------------------------------------------------------------------ layers

/** A canvas-sized scratch buffer with a dirty box (canvas pixels, inclusive). */
export class Layer {
  /** Canvas pixels per logical pixel. */
  readonly d: 1 | 2;
  readonly buf: PixelBuffer;
  x0: number;
  y0: number;
  x1 = -1;
  y1 = -1;

  constructor(d: 1 | 2 = D) {
    this.d = d;
    this.buf = new PixelBuffer(CW * d, CH * d);
    this.x0 = this.buf.w;
    this.y0 = this.buf.h;
  }

  /** Grow the dirty box by a body-space box (inclusive), clamped to the canvas. */
  mark(ax: number, ay: number, bx: number, by: number): void {
    if (this.d === 2) {
      this.markHi(Math.floor((Math.min(ax, bx) + OX) * 2) - 1, Math.floor((Math.min(ay, by) + OY) * 2) - 1, Math.ceil((Math.max(ax, bx) + OX) * 2) + 2, Math.ceil((Math.max(ay, by) + OY) * 2) + 2);
      return;
    }
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx)) + OX);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by)) + OY);
    const x1 = Math.min(CW - 1, Math.ceil(Math.max(ax, bx)) + OX);
    const y1 = Math.min(CH - 1, Math.ceil(Math.max(ay, by)) + OY);
    if (x0 < this.x0) this.x0 = x0;
    if (y0 < this.y0) this.y0 = y0;
    if (x1 > this.x1) this.x1 = x1;
    if (y1 > this.y1) this.y1 = y1;
  }

  /** Grow the dirty box by a canvas box (inclusive), clamped to the canvas. */
  markHi(x0: number, y0: number, x1: number, y1: number): void {
    const { w, h } = this.buf;
    this.x0 = Math.min(this.x0, Math.max(0, x0));
    this.y0 = Math.min(this.y0, Math.max(0, y0));
    this.x1 = Math.max(this.x1, Math.min(w - 1, x1));
    this.y1 = Math.max(this.y1, Math.min(h - 1, y1));
  }

  get used(): boolean {
    return this.x1 >= this.x0 && this.y1 >= this.y0;
  }

  /** Erase the dirty box and forget it. */
  clear(): void {
    const cw = this.buf.w;
    if (this.used) {
      const d = this.buf.data;
      for (let y = this.y0; y <= this.y1; y++) d.fill(0, y * cw + this.x0, y * cw + this.x1 + 1);
      this.buf.touch();
    }
    this.x0 = cw;
    this.y0 = this.buf.h;
    this.x1 = -1;
    this.y1 = -1;
  }

  /** Colour at a body-space pixel (0 outside the canvas); at 2× the 2× pixel `hiPx` names. */
  get(x: number, y: number): Color {
    if (this.d === 2) return this.buf.get(hiPx(x, OX), hiPx(y, OY));
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 0;
    return this.buf.data[cy * CW + cx];
  }
}

const pools: Record<1 | 2, Layer[]> = { 1: [], 2: [] };

/** A clean scratch layer at the kit's density (give it back with `release`). */
export function take(): Layer {
  return pools[D].pop() ?? new Layer(D);
}

/** Clear a layer and return it to the pool. */
export function release(L: Layer): void {
  L.clear();
  pools[L.d].push(L);
}

// ------------------------------------------------------------------------------------ shapes

/** Filled polygon (body space). */
export function poly(L: Layer, pts: readonly Pt[], c: Color): void {
  if (pts.length === 0) return;
  if (L.d === 2) {
    polyHi(L, pts, c);
    return;
  }
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
  if (L.d === 2) {
    capsuleHi(L, a, b, w0, w1, c);
    return;
  }
  const r = Math.max(w0, w1) / 2 + 2;
  L.mark(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r);
  L.buf.taper(a[0] + OX, a[1] + OY, b[0] + OX, b[1] + OY, w0, w1, c);
}

/**
 * A feather blade from a (diameter w0) to b (diameter w1). At 1× it is the `taper` capsule; at
 * 2× the same extent as a flat-ended slab with its corners cut by one logical px, the shape a
 * small 1× capsule reads as (a round 2× cap would scallop the wing edge like a cloud).
 */
export function slab(L: Layer, a: Pt, b: Pt, w0: number, w1: number, c: Color): void {
  if (L.d !== 2) {
    taper(L, a, b, w0, w1, c);
    return;
  }
  const t = unit(sub(b, a));
  const n: V = [-t[1], t[0]];
  // Half widths in logical px: the capsule's 2× extent, filled by pixel centre (no tolerance).
  const r0 = Math.max(1, Math.round(w0)) / 2 - 0.2;
  const r1 = Math.max(1, Math.round(w1)) / 2 - 0.2;
  const ch = 1;
  const P = (q: Pt, along: number, across: number): V => [q[0] + t[0] * along + n[0] * across, q[1] + t[1] * along + n[1] * across];
  const pts = [
    P(a, -r0, r0 - ch), P(a, -r0 + ch, r0), P(b, r1 - ch, r1), P(b, r1, r1 - ch),
    P(b, r1, -r1 + ch), P(b, r1 - ch, -r1), P(a, -r0 + ch, -r0), P(a, -r0, -r0 + ch),
  ];
  withHiCover(0, 0, () => poly(L, pts, c));
}

/** Round-capped thick line. */
export function thick(L: Layer, a: Pt, b: Pt, w: number, c: Color): void {
  taper(L, a, b, w, w, c);
}

/** Filled disc of radius r (diameter 2r + 1) on pixel (cx, cy). */
export function disc(L: Layer, cx: number, cy: number, r: number, c: Color): void {
  if (L.d === 2) {
    const rr = Math.max(0, Math.round(r));
    const x = Math.round(cx) - rr;
    const y = Math.round(cy) - rr;
    L.mark(x - 1, y - 1, x + 2 * rr + 2, y + 2 * rr + 2);
    L.buf.ellipse((x + OX) * 2, (y + OY) * 2, (2 * rr + 1) * 2, (2 * rr + 1) * 2, c);
    return;
  }
  L.mark(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1);
  L.buf.circle(cx + OX, cy + OY, r, c);
}

/** Filled ellipse inscribed in the box (x, y, w, h). */
export function oval(L: Layer, x: number, y: number, w: number, h: number, c: Color): void {
  if (L.d === 2) {
    L.mark(x - 1, y - 1, x + w + 1, y + h + 1);
    L.buf.ellipse(hiPx(x, OX), hiPx(y, OY), Math.round(w * 2), Math.round(h * 2), c);
    return;
  }
  L.mark(x - 1, y - 1, x + w + 1, y + h + 1);
  L.buf.ellipse(x + OX, y + OY, w, h, c);
}

/** 1-px line (at 2×: one logical px wide, between the same rounded ends). */
export function line(L: Layer, a: Pt, b: Pt, c: Color): void {
  if (L.d === 2) {
    capsuleHi(L, [Math.round(a[0]), Math.round(a[1])], [Math.round(b[0]), Math.round(b[1])], 1, 1, c);
    return;
  }
  L.mark(Math.min(a[0], b[0]) - 1, Math.min(a[1], b[1]) - 1, Math.max(a[0], b[0]) + 1, Math.max(a[1], b[1]) + 1);
  L.buf.line(Math.round(a[0]) + OX, Math.round(a[1]) + OY, Math.round(b[0]) + OX, Math.round(b[1]) + OY, c);
}

/** One pixel (at 2×: the 2 × 2 block of the logical pixel). */
export function dot(L: Layer, x: number, y: number, c: Color): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  L.mark(rx, ry, rx, ry);
  if (L.d === 2) {
    L.buf.rect((rx + OX) * 2, (ry + OY) * 2, 2, 2, c);
    return;
  }
  L.buf.set(rx + OX, ry + OY, c);
}

/**
 * One canvas pixel at logical (x, y): at 2× a single 2× pixel (integer x → the left half of
 * logical pixel x, x + 0.5 → the right half; the same for y), at 1× the logical pixel.
 */
export function fine(L: Layer, x: number, y: number, c: Color): void {
  if (L.d !== 2) {
    dot(L, x, y, c);
    return;
  }
  const px = hiPx(x, OX);
  const py = hiPx(y, OY);
  L.markHi(px, py, px, py);
  L.buf.set(px, py, c);
}

/**
 * 2× coverage of the shapes: `near` = the tolerance of `polyHi` round the outline (logical px),
 * `inset` = how far `capsuleHi` pulls its radius in (2× px). The defaults match the 1× areas of
 * the body parts; thin parts (the neck and head) draw tighter, see `withHiCover`.
 */
const HI_COVER = { near: 0.8, inset: 0 };

/**
 * Run `fn` with a tighter 2× coverage. A 2× edge on a half pixel puts its 2-px outline half a
 * logical px further out than the 1× outline; on a thin part (the neck rings, the head) that
 * reads as a plumper shape, so those parts pull their 2× edges in a little.
 */
export function withHiCover<T>(near: number, inset: number, fn: () => T): T {
  const prev = { ...HI_COVER };
  HI_COVER.near = near;
  HI_COVER.inset = inset;
  try {
    return fn();
  } finally {
    Object.assign(HI_COVER, prev);
  }
}

/** 2× pixel centre → logical body coordinates (the inverse of the 2 · (x + OX) + 1 mapping). */
export function hiToBody(i: number, o: number): number {
  return (i - 0.5) / 2 - o;
}

/**
 * 2× polygon: the 2× pixels whose centre lies inside the outline through the logical pixel
 * centres, or within 0.8 px of it — the area a 1× `poly` covers (its edge pixels included),
 * drawn with the finer edge of the 2× grid.
 */
function polyHi(L: Layer, pts: readonly Pt[], c: Color): void {
  const n = pts.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let ax = Infinity;
  let ay = Infinity;
  let bx = -Infinity;
  let by = -Infinity;
  for (let i = 0; i < n; i++) {
    xs[i] = (pts[i][0] + OX) * 2 + 1;
    ys[i] = (pts[i][1] + OY) * 2 + 1;
    ax = Math.min(ax, xs[i]);
    ay = Math.min(ay, ys[i]);
    bx = Math.max(bx, xs[i]);
    by = Math.max(by, ys[i]);
  }
  const { w, h, data } = L.buf;
  const x0 = Math.max(0, Math.floor(ax - 1.5));
  const y0 = Math.max(0, Math.floor(ay - 1.5));
  const x1 = Math.min(w - 1, Math.ceil(bx + 1.5));
  const y1 = Math.min(h - 1, Math.ceil(by + 1.5));
  const R2 = HI_COVER.near * HI_COVER.near;
  // Inside: an even-odd scanline per row (the crossings right of a pixel centre are counted,
  // the same test as a per-pixel ray cast, at a fraction of the cost).
  const xing = new Float64Array(n);
  for (let py = y0; py <= y1; py++) {
    const cy = py + 0.5;
    let m = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = ys[i];
      const yj = ys[j];
      if (yi > cy !== yj > cy) xing[m++] = ((xs[j] - xs[i]) * (cy - yi)) / (yj - yi) + xs[i];
    }
    if (m === 0) continue;
    const row = xing.subarray(0, m).sort();
    let k = 0;
    for (let px = x0; px <= x1; px++) {
      const cx = px + 0.5;
      while (k < m && row[k] <= cx) k++;
      if (((m - k) & 1) === 1) data[py * w + px] = c;
    }
  }
  // Near: the pixel centres within `near` of an edge, edge by edge in each edge's box.
  if (R2 > 0) {
    const r = HI_COVER.near;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = xs[i];
      const yi = ys[i];
      const vx = xs[j] - xi;
      const vy = ys[j] - yi;
      const l2 = vx * vx + vy * vy;
      const ex0 = Math.max(x0, Math.floor(Math.min(xi, xs[j]) - r - 0.5));
      const ex1 = Math.min(x1, Math.ceil(Math.max(xi, xs[j]) + r - 0.5));
      const ey0 = Math.max(y0, Math.floor(Math.min(yi, ys[j]) - r - 0.5));
      const ey1 = Math.min(y1, Math.ceil(Math.max(yi, ys[j]) + r - 0.5));
      for (let py = ey0; py <= ey1; py++) {
        const cy = py + 0.5;
        for (let px = ex0; px <= ex1; px++) {
          const cx = px + 0.5;
          let t = l2 > 0 ? ((cx - xi) * vx + (cy - yi) * vy) / l2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = xi + vx * t - cx;
          const qy = yi + vy * t - cy;
          if (qx * qx + qy * qy <= R2) data[py * w + px] = c;
        }
      }
    }
  }
  L.markHi(x0, y0, x1, y1);
  L.buf.touch();
}

/**
 * 2× tapered capsule between logical pixel centres a and b with logical diameters w0, w1: the
 * 2× pixels whose centre lies within the interpolated radius (the inward bias of the 1× discs,
 * r² − r / 4), at the exact (unrounded) positions.
 */
function capsuleHi(L: Layer, a: Pt, b: Pt, w0: number, w1: number, c: Color): void {
  const ax = (a[0] + OX) * 2 + 1;
  const ay = (a[1] + OY) * 2 + 1;
  const bx = (b[0] + OX) * 2 + 1;
  const by = (b[1] + OY) * 2 + 1;
  const r0 = Math.max(1, Math.round(w0)) * 1;
  const r1 = Math.max(1, Math.round(w1)) * 1;
  const rm = Math.max(r0, r1);
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const { w, h, data } = L.buf;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - rm - 1));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - rm - 1));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + rm + 1));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + rm + 1));
  for (let py = y0; py <= y1; py++) {
    const cy = py + 0.5;
    for (let px = x0; px <= x1; px++) {
      const cx = px + 0.5;
      let t = len2 > 0 ? ((cx - ax) * vx + (cy - ay) * vy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + vx * t - cx;
      const qy = ay + vy * t - cy;
      const r = r0 + (r1 - r0) * t - HI_COVER.inset;
      if (qx * qx + qy * qy <= r * r - r / 4 + 1e-9) data[py * w + px] = c;
    }
  }
  L.markHi(x0, y0, x1, y1);
  L.buf.touch();
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
  // Band widths are logical: twice as many 2× pixels.
  const hi = (o.hi ?? 1) * L.d;
  const lo = (o.lo ?? 1) * L.d;
  const CW = L.buf.w;
  const shift = o.shift ?? 0;
  // The box plus a frame of empty pixels as wide as the widest band, so the edge tests need no
  // bounds checks.
  const P = Math.max(1, hi, lo);
  const x0 = L.x0 - P;
  const y0 = L.y0 - P;
  const w = L.x1 - L.x0 + 1 + 2 * P;
  const h = L.y1 - L.y0 + 1 + 2 * P;
  if (maskScratch.length < w * h) maskScratch = new Uint8Array(w * h);
  const mask = maskScratch;
  mask.fill(0, 0, w * h);
  const d = L.buf.data;
  for (let y = L.y0; y <= L.y1; y++) {
    for (let x = L.x0; x <= L.x1; x++) if ((d[y * CW + x] & 255) !== 0) mask[(y - y0) * w + (x - x0)] = 1;
  }
  for (let y = P; y < h - P; y++) {
    for (let x = P; x < w - P; x++) {
      const i = y * w + x;
      if (mask[i] === 0) continue;
      let lit = false;
      for (let k = 1; k <= hi && !lit; k++) lit = mask[i - k] === 0 || mask[i - k * w] === 0;
      let dark = false;
      for (let k = 1; k <= lo && !dark; k++) dark = mask[i + k] === 0 || mask[i + k * w] === 0;
      let idx = base;
      if (lit && !dark) idx = base + 1;
      else if (dark && !lit) idx = base - 1;
      if (o.glint && lit && !dark && mask[i - w] === 0 && mask[i + 1] === 1 && mask[i + w] === 1 && mask[i + w + 1] === 1) idx = base + 2;
      d[(y + y0) * CW + (x + x0)] = at(ramp, idx + shift);
    }
  }
  L.buf.touch();
}

/** Recolour every pixel of a layer through a function (inside the dirty box). */
export function recolor(L: Layer, fn: (c: Color, x: number, y: number) => Color): void {
  if (!L.used) return;
  const d = L.buf.data;
  const cw = L.buf.w;
  const hi = L.d === 2;
  for (let y = L.y0; y <= L.y1; y++) {
    for (let x = L.x0; x <= L.x1; x++) {
      const i = y * cw + x;
      // At 2× the callback gets the logical position of the 2× pixel's centre.
      if ((d[i] & 255) !== 0) d[i] = hi ? fn(d[i], hiToBody(x, OX), hiToBody(y, OY)) : fn(d[i], x - OX, y - OY);
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
  /** Canvas pixels per logical pixel (the kit's density when the stack was made). */
  readonly d: 1 | 2;
  readonly buf: PixelBuffer;
  readonly own: Uint8Array;
  private readonly lineOf: Uint32Array;
  x0: number;
  y0: number;
  x1 = -1;
  y1 = -1;

  constructor(d: 1 | 2 = D) {
    this.d = d;
    this.buf = new PixelBuffer(CW * d, CH * d);
    this.own = new Uint8Array(N * d * d);
    this.lineOf = new Uint32Array(N * d * d);
    this.x0 = this.buf.w;
    this.y0 = this.buf.h;
  }

  get used(): boolean {
    return this.x1 >= this.x0;
  }

  /** Empty the stack. */
  reset(): void {
    const cw = this.buf.w;
    if (this.used) {
      const d = this.buf.data;
      for (let y = this.y0; y <= this.y1; y++) {
        const a = y * cw + this.x0;
        const b = y * cw + this.x1 + 1;
        d.fill(0, a, b);
        this.own.fill(0, a, b);
        this.lineOf.fill(0, a, b);
      }
      this.buf.touch();
    }
    this.x0 = cw;
    this.y0 = this.buf.h;
    this.x1 = -1;
    this.y1 = -1;
  }

  /**
   * Composite a part layer over the stack. `line` = this part's internal-line colour (used when
   * a later part's ring falls on it); `ring` false = no line around this part.
   */
  add(L: Layer, owner: number, line: Color, ring = true): void {
    if (!L.used) return;
    if (this.d === 2) {
      this.addHi(L, owner, line, ring);
      return;
    }
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

  /** `add` at 2×: the ring is 2 px wide (the 1× weight), with the corners of a doubled 1-px ring. */
  private addHi(L: Layer, owner: number, line: Color, ring: boolean): void {
    const src = L.buf.data;
    const dst = this.buf.data;
    const cw = this.buf.w;
    const ch = this.buf.h;
    if (ring) {
      const x0 = Math.max(0, L.x0 - 2);
      const y0 = Math.max(0, L.y0 - 2);
      const x1 = Math.min(cw - 1, L.x1 + 2);
      const y1 = Math.min(ch - 1, L.y1 + 2);
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      // Two 4-connected growth steps of the part's mask inside the box: one grown mask, the
      // second step tested in place.
      const m = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = (y + y0) * cw + x + x0;
          if ((src[i] & 255) === 0) continue;
          const k = y * bw + x;
          m[k] = 1;
          if (x > 0) m[k - 1] = 1;
          if (x < bw - 1) m[k + 1] = 1;
          if (y > 0) m[k - bw] = 1;
          if (y < bh - 1) m[k + bw] = 1;
        }
      }
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = (y + y0) * cw + x + x0;
          if ((src[i] & 255) !== 0 || (dst[i] & 255) === 0) continue;
          const k = y * bw + x;
          if (!m[k] && !(x > 0 && m[k - 1]) && !(x < bw - 1 && m[k + 1]) && !(y > 0 && m[k - bw]) && !(y < bh - 1 && m[k + bw])) continue;
          // The line is the darkest shade of the part behind (a cast-shadow edge).
          dst[i] = this.lineOf[i] || INK;
        }
      }
    }
    for (let y = L.y0; y <= L.y1; y++) {
      for (let x = L.x0; x <= L.x1; x++) {
        const i = y * cw + x;
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

  /** Colour at a body-space pixel (0 = empty or outside); at 2× the 2× pixel `fine` would paint. */
  get(x: number, y: number): Color {
    if (this.d === 2) return this.buf.get(hiPx(x, OX), hiPx(y, OY));
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 0;
    return this.buf.data[cy * CW + cx];
  }

  /** Owner at a body-space pixel. */
  ownerAt(x: number, y: number): number {
    if (this.d === 2) {
      const hx = hiPx(x, OX);
      const hy = hiPx(y, OY);
      return hx < 0 || hy < 0 || hx >= this.buf.w || hy >= this.buf.h ? 0 : this.own[hy * this.buf.w + hx];
    }
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
    if (this.d === 2) {
      // The logical pixel's 2 × 2 block, each 2× pixel tested on its own.
      const rx = Math.round(x);
      const ry = Math.round(y);
      for (const [hx, hy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]] as const) this.fine(rx + hx, ry + hy, c, owner);
      return;
    }
    const cx = Math.round(x) + OX;
    const cy = Math.round(y) + OY;
    if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return;
    const i = cy * CW + cx;
    if ((this.buf.data[i] & 255) === 0) return;
    if (owner !== undefined && this.own[i] !== owner) return;
    this.buf.data[i] = c;
    this.buf.touch();
  }

  /**
   * One detail pixel at the canvas's finest step: at 2× a single 2× pixel (integer x → the left
   * half of logical pixel x, x + 0.5 → the right half; y alike), at 1× the same as `detail`.
   */
  fine(x: number, y: number, c: Color, owner?: number): void {
    if (this.d !== 2) {
      this.detail(x, y, c, owner);
      return;
    }
    const hx = hiPx(x, OX);
    const hy = hiPx(y, OY);
    if (hx < 0 || hy < 0 || hx >= this.buf.w || hy >= this.buf.h) return;
    const i = hy * this.buf.w + hx;
    if ((this.buf.data[i] & 255) === 0) return;
    if (owner !== undefined && this.own[i] !== owner) return;
    this.buf.data[i] = c;
    this.buf.touch();
  }

  /** Paint a canvas pixel (column, row) of an existing part (as `detail`, in canvas pixels). */
  setPx(cx: number, cy: number, c: Color, owner?: number): void {
    if (cx < 0 || cy < 0 || cx >= this.buf.w || cy >= this.buf.h) return;
    const i = cy * this.buf.w + cx;
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
  /** Body (0, 0) inside `buf` (logical px: at 2× the buffer pixel is (2 · ox, 2 · oy)). */
  ox: number;
  oy: number;
  /** Owner of each pixel of `buf` (0 = outline or empty). */
  own: Uint8Array;
  /** Buffer pixels per logical pixel. */
  d?: 1 | 2;
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
 * Opaque pixels by side of the water line: 1 = above it (or a dry wing plate), 2 = under it
 * (rows at or below buffer row `wy`), 0 = empty.
 */
function solidSides(d: Uint32Array, own: Uint8Array, w: number, h: number, wy: number): Uint8Array {
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((d[i] & 255) === 0) continue;
      solid[i] = y >= wy && own[i] !== OWN.nearWing && own[i] !== OWN.farWing ? 2 : 1;
    }
  }
  return solid;
}

/** The sides (bit 1 above, bit 2 under water) of the parts 4-next to pixel (x, y). */
function touching(solid: Uint8Array, w: number, h: number, x: number, y: number): number {
  const i = y * w + x;
  return (x > 0 ? solid[i - 1] : 0) | (x < w - 1 ? solid[i + 1] : 0) | (y > 0 ? solid[i - w] : 0) | (y < h - 1 ? solid[i + w] : 0);
}

/**
 * Crop the stack (+ a 1-px margin) and outline it: INK around the parts above the water line,
 * `navy[0]` around the parts under it (each outlined on its own, look.md §5.8).
 */
export function harvest(st: Stack, o: HarvestOpts = {}): Harvest {
  if (st.d === 2) return harvestHi(st, o);
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
  const solid = solidSides(d, own, w, h, wy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const side = touching(solid, w, h, x, y);
      if (side & 1) d[i] = INK;
      else if (side & 2) d[i] = WATER_LINE;
    }
  }
  buf.touch();
  return { buf, ox, oy, own };
}

/**
 * `harvest` at 2×: the crop starts on an even canvas pixel (so the body origin is a whole logical
 * pixel) and the outline is 2 px wide, the second ring with its corners (the shape of a doubled
 * 1-px outline), INK or `navy[0]` like the first ring next to it.
 */
function harvestHi(st: Stack, o: HarvestOpts): Harvest {
  const cw = st.buf.w;
  const ch = st.buf.h;
  let x0 = st.x0 - 2;
  let y0 = st.y0 - 2;
  let x1 = st.x1 + 2;
  let y1 = st.y1 + 2;
  if (o.extra) {
    x0 = Math.min(x0, (o.extra[0] + OX) * 2);
    y0 = Math.min(y0, (o.extra[1] + OY) * 2);
    x1 = Math.max(x1, (o.extra[2] + OX) * 2 + 1);
    y1 = Math.max(y1, (o.extra[3] + OY) * 2 + 1);
  }
  x0 = Math.max(0, x0 & ~1);
  y0 = Math.max(0, y0 & ~1);
  x1 = Math.min(cw - 1, x1 | 1);
  y1 = Math.min(ch - 1, y1 | 1);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const buf = new PixelBuffer(w, h);
  const own = new Uint8Array(w * h);
  const src = st.buf.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y + y0) * cw + (x + x0);
      buf.data[y * w + x] = src[i];
      own[y * w + x] = st.own[i];
    }
  }
  const ox = OX - x0 / 2;
  const oy = OY - y0 / 2;
  const surf = o.surface ?? null;
  const wy = surf === null ? h : (surf + oy) * 2;
  const d = buf.data;
  const dry = (i: number): boolean => own[i] === OWN.nearWing || own[i] === OWN.farWing;
  if (surf !== null) {
    for (let y = Math.max(0, wy); y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if ((d[i] & 255) !== 0 && !dry(i)) d[i] = waterColour(d[i]);
      }
    }
  }
  // First ring: 4-neighbours of the parts.
  const solid = solidSides(d, own, w, h, wy);
  const ring = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const side = touching(solid, w, h, x, y);
      if (side & 1) {
        d[i] = INK;
        ring[i] = 1;
      } else if (side & 2) {
        d[i] = WATER_LINE;
        ring[i] = 2;
      }
    }
  }
  // Second ring: 8-neighbours of the parts and the first ring (a part pixel counts as its side).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i] || ring[i]) continue;
      let side = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if ((dx === 0 && dy === 0) || xx < 0 || xx >= w) continue;
          const k = yy * w + xx;
          side |= ring[k] || solid[k];
        }
      }
      if (side & 1) d[i] = INK;
      else if (side & 2) d[i] = WATER_LINE;
    }
  }
  buf.touch();
  return { buf, ox, oy, own, d: 2 };
}

/**
 * Place a 2× buffer whose body origin is the logical pixel (sx, sy) into the 2× twin of a 1×
 * frame rectangle w × h (logical) whose body origin is (bx, by). Returns the buffer and the
 * number of opaque pixels that fell outside it (cut). With `reline`, where art is cut at the
 * rectangle's edge the two pixels inside the edge become outline (INK, or `navy[0]` when the
 * cut pixel was the under-water outline), so a 2× shape a hair larger than the 1× one keeps
 * its 2-px outline. `'outline'`: only where an outline pixel is cut (front overlays, whose cut
 * edges inside the hull have no outline).
 */
export function placeHi(src: PixelBuffer, sx: number, sy: number, w: number, h: number, bx: number, by: number, reline: boolean | 'outline' = false): { buf: PixelBuffer; cut: number } {
  const out = new PixelBuffer(w * 2, h * 2);
  const dx = (bx - sx) * 2;
  const dy = (by - sy) * 2;
  let cut = 0;
  const edge: number[] = [];
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.data[y * src.w + x];
      if ((c & 255) === 0) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= out.w || ty >= out.h) {
        cut++;
        if (reline === true || (reline === 'outline' && (c === INK || c === WATER_LINE))) edge.push(tx, ty, c);
        continue;
      }
      out.data[ty * out.w + tx] = c;
    }
  }
  for (let k = 0; k < edge.length; k += 3) {
    const tx = edge[k];
    const ty = edge[k + 1];
    const line = edge[k + 2] === WATER_LINE ? WATER_LINE : INK;
    const cx = Math.min(out.w - 1, Math.max(0, tx));
    const cy = Math.min(out.h - 1, Math.max(0, ty));
    // One step further inside along each axis that was clamped.
    const ix = tx < 0 ? 1 : tx >= out.w ? -1 : 0;
    const iy = ty < 0 ? 1 : ty >= out.h ? -1 : 0;
    for (const [x, y] of [[cx, cy], [cx + ix, cy + iy]]) {
      const i = y * out.w + x;
      if ((out.data[i] & 255) !== 0) out.data[i] = line;
    }
  }
  out.touch();
  return { buf: out, cut };
}
