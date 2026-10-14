/**
 * Helpers for 2× art (docs/ART_GUIDE.md "2x art (mission ams)"): a pen and a part composer that
 * work in LOGICAL body space on a buffer of density 2, and frame transforms that turn a 1× strip
 * recipe (death strips, squash, peel) into the matching 2× strip with the same logical geometry.
 *
 * - `HiPen`: logical coordinates (half steps address single 2× pixels) → 2× buffer pixels. Shapes
 *   (`ellipse`, `circle`, `poly`, `thick`) cover the same area as the 1× call with the same
 *   arguments, with the finer edge of the 2× grid; `px` / `hline` / `vline` paint whole logical
 *   pixels (2 × 2 blocks); `dot` / `fine` paint single 2× pixels.
 * - `HiSketch`: the 2× counterpart of creatures/draw `Sketch` (shaded parts back to front, a ring
 *   of the part behind where a front part overlaps it, an INK silhouette outline). `line` is the
 *   outline and ring width in 2× pixels: 2 = the weight of the 1× art, 1 = a finer line.
 * - `asHi` / `fitHi` / `liftHi` / `squashedHi` / `outlineHi`: frame plumbing (below).
 *
 * Everything stays deterministic and palette-only: no blending, no new colours.
 */
import type { Color } from '../../engine/color';
import { INK } from '../../engine/palette';
import { PixelBuffer, type Ramp } from '../../engine/pixel';
import type { Frame } from '../../engine/render';
import { FLAT, despeckle, shadeLayer, type ShadeOpts } from './paint';

/** Buffer pixels per logical pixel of 2× art. */
export const HI = 2;

/** Logical body space (origin = the anchor, in logical px) → a 2× buffer. */
export class HiPen {
  readonly b: PixelBuffer;
  readonly ox: number;
  readonly oy: number;

  constructor(b: PixelBuffer, ox: number, oy: number) {
    this.b = b;
    this.ox = ox;
    this.oy = oy;
  }

  /** 2× buffer column of the left edge of logical x (x may be a half step). */
  X(x: number): number {
    return Math.round((this.ox + x) * HI);
  }

  /** 2× buffer row of the top edge of logical y. */
  Y(y: number): number {
    return Math.round((this.oy + y) * HI);
  }

  /** Ellipse in the box (x, y, w, h), logical (as PixelBuffer.ellipse at 1×). */
  ellipse(x: number, y: number, w: number, h: number, c: Color): this {
    this.b.ellipse(this.X(x), this.Y(y), w * HI, h * HI, c);
    return this;
  }

  /** Circle centred on logical pixel (cx, cy) with radius r (diameter 2r + 1 logical px). */
  circle(cx: number, cy: number, r: number, c: Color): this {
    const d = (2 * r + 1) * HI;
    this.b.ellipse(this.X(cx - r), this.Y(cy - r), d, d, c);
    return this;
  }

  /** Filled polygon through logical pixel positions [x0, y0, x1, y1, …]. */
  poly(pts: readonly number[], c: Color): this {
    this.b.poly(pts.map((v, i) => (i & 1 ? this.Y(v) : this.X(v)) + 0.5), c);
    return this;
  }

  /** Capsule from logical pixel (x0, y0) to (x1, y1), `w` logical px wide. */
  thick(x0: number, y0: number, x1: number, y1: number, w: number, c: Color): this {
    this.b.thickLine(this.X(x0) + 0.5, this.Y(y0) + 0.5, this.X(x1) + 0.5, this.Y(y1) + 0.5, w * HI, c);
    return this;
  }

  /** One logical pixel (a 2 × 2 block). */
  px(x: number, y: number, c: Color): this {
    this.b.rect(this.X(x), this.Y(y), HI, HI, c);
    return this;
  }

  /** Logical rectangle. */
  rect(x: number, y: number, w: number, h: number, c: Color): this {
    this.b.rect(this.X(x), this.Y(y), w * HI, h * HI, c);
    return this;
  }

  /** Row of logical pixels x0..x1 (inclusive). */
  hline(x0: number, x1: number, y: number, c: Color): this {
    return this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
  }

  /** Column of logical pixels y0..y1 (inclusive). */
  vline(x: number, y0: number, y1: number, c: Color): this {
    return this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
  }

  /** One 2× pixel at logical (x, y); use half steps (x + 0.5) for the right / lower half. */
  dot(x: number, y: number, c: Color): this {
    this.b.set(this.X(x), this.Y(y), c);
    return this;
  }

  /** A 1-px (2×) Bresenham line between logical positions (half steps allowed). */
  fine(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    this.b.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
    return this;
  }
}

/** Options of a shaded 2× part; `hi` / `lo` band widths are in LOGICAL px (default 1). */
export type HiShadeOpts = ShadeOpts & { ring?: boolean; line?: Color; clean?: boolean };

/**
 * Back-to-front part compositor for 2× art in logical body space (the 2× `Sketch`).
 * ```ts
 * const s = new HiSketch(44, 40, 22, 20, 2);          // logical size + anchor, outline width
 * s.add(PAL.snow, (p) => p.ellipse(-9, -5, 18, 10, FLAT), { base: 3 });
 * s.detail((p) => p.dot(7.5, -7, INK));               // one 2× pixel
 * const f = s.frame();                                // { buf 88×80, ox 22, oy 20, density 2 }
 * ```
 */
export class HiSketch {
  readonly buf: PixelBuffer;
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  /** Outline and ring width in 2× px (2 = the 1× weight, 1 = fine). */
  readonly line: 1 | 2;
  private readonly lineOf: Uint32Array;

  constructor(w: number, h: number, ox: number, oy: number, line: 1 | 2 = 2) {
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    this.line = line;
    this.buf = new PixelBuffer(w * HI, h * HI);
    this.lineOf = new Uint32Array(this.buf.w * this.buf.h);
  }

  private layer(paint: (p: HiPen) => void): PixelBuffer {
    const l = new PixelBuffer(this.buf.w, this.buf.h);
    paint(new HiPen(l, this.ox, this.oy));
    return l;
  }

  /** A shaded part: painted with FLAT, lit from the top-left with `ramp`. */
  add(ramp: Ramp, paint: (p: HiPen) => void, o: HiShadeOpts = {}): this {
    const l = this.layer(paint);
    shadeLayer(l, ramp, { ...o, hi: (o.hi ?? 1) * HI, lo: (o.lo ?? 1) * HI });
    if (o.clean !== false) despeckle(l);
    this.composite(l, o.line ?? ramp[0], o.ring !== false);
    return this;
  }

  /** A flat part in one colour, still ringed against the parts behind. */
  flat(color: Color, paint: (p: HiPen) => void, line: Color = INK, ring = true): this {
    const l = this.layer(paint);
    l.replace(FLAT, color);
    this.composite(l, line, ring);
    return this;
  }

  /** Details painted as they are (palette pixels, no ring). */
  detail(paint: (p: HiPen) => void): this {
    const l = this.layer(paint);
    const src = l.data;
    const dst = this.buf.data;
    for (let i = 0; i < src.length; i++) {
      if ((src[i] & 255) === 0) continue;
      dst[i] = src[i];
      this.lineOf[i] = INK;
    }
    this.buf.touch();
    return this;
  }

  /** Read access to the composite so far (details that depend on what is drawn). */
  pen(): HiPen {
    return new HiPen(this.buf, this.ox, this.oy);
  }

  private composite(l: PixelBuffer, line: Color, ring: boolean): void {
    const src = l.data;
    const dst = this.buf.data;
    if (ring) {
      const near = grow(l, this.line);
      for (let i = 0; i < src.length; i++) {
        if ((src[i] & 255) !== 0 || (dst[i] & 255) === 0 || near[i] === 0) continue;
        // The line is the darkest shade of the part behind (a cast-shadow edge).
        dst[i] = this.lineOf[i] || INK;
      }
    }
    for (let i = 0; i < src.length; i++) {
      if ((src[i] & 255) === 0) continue;
      dst[i] = src[i];
      this.lineOf[i] = line;
    }
    this.buf.touch();
  }

  /** Finish: the INK silhouette outline (`line` px wide) → a density-2 frame. */
  frame(): Frame {
    outlineHi(this.buf, this.line);
    return { buf: this.buf, ox: this.ox, oy: this.oy, density: HI };
  }
}

/**
 * Mask of the pixels within `n` 4-connected steps of the opaque pixels of `b` (opaque included).
 * Two steps give a 2-px band whose corners are cut once (the shape of a doubled 1-px ring).
 */
function grow(b: PixelBuffer, n: number): Uint8Array {
  const { w, h, data } = b;
  let m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = (data[i] & 255) !== 0 ? 1 : 0;
  for (let k = 0; k < n; k++) {
    const next = m.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (m[i]) continue;
        if ((x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w])) next[i] = 1;
      }
    }
    m = next;
  }
  return m;
}

/**
 * INK outline `n` 2× px wide around the silhouette (in place), on the same footprint as a 1×
 * outline: with n = 1 the shape first grows by one 2× pixel (each new pixel takes a neighbour's
 * colour), so a fine outline shows more of the art instead of a smaller sprite. With n = 2 the
 * second ring also takes the diagonal corners (the square corners of a doubled 1× outline).
 */
export function outlineHi(b: PixelBuffer, n: number, c: Color = INK): PixelBuffer {
  if (n <= 1) bleed(b);
  b.outline(c);
  for (let k = 1; k < n; k++) b.outline(c, { corners: true });
  return b;
}

/** Grow the opaque pixels by one (4-connected); a new pixel copies its left, upper, right or lower neighbour. */
function bleed(b: PixelBuffer): void {
  const { w, h } = b;
  const src = b.data.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((src[i] & 255) !== 0) continue;
      // The first opaque neighbour in the order left, up, right, down.
      let c = x > 0 ? src[i - 1] : 0;
      if ((c & 255) === 0) c = y > 0 ? src[i - w] : 0;
      if ((c & 255) === 0) c = x < w - 1 ? src[i + 1] : 0;
      if ((c & 255) === 0) c = y < h - 1 ? src[i + w] : 0;
      if ((c & 255) !== 0) b.data[i] = c;
    }
  }
  b.touch();
}

/** A 2× buffer as the density-2 twin of the 1× frame `base` (same anchor; points come from it). */
export function asHi(buf: PixelBuffer, base: Frame): Frame {
  return { buf, ox: base.ox, oy: base.oy, density: HI };
}

/**
 * Centre `buf` in a buffer of exactly 2 × the 1× frame's size (crop or pad evenly). For 2× art
 * transformed by a centre-based operation (rotation): the result lines up with the 1× frame.
 */
export function fitHi(buf: PixelBuffer, base: Frame): Frame {
  const w = base.buf.w * HI;
  const h = base.buf.h * HI;
  const out = buf.w === w && buf.h === h ? buf : buf.crop((buf.w - w) >> 1, (buf.h - h) >> 1, w, h);
  return asHi(out, base);
}

/**
 * The 2× twin of a 1× effect frame `out1` that was made from the 1× source `src1` placed at
 * (dx, dy) in it (flames, crumbling, …): wherever `out1` still shows the source pixel, the
 * matching 2 × 2 block of the 2× source `src2` is copied (2× detail); every pixel the effect
 * added or changed is painted as a whole logical pixel of its colour.
 */
export function liftHi(out1: Frame, src1: PixelBuffer, src2: PixelBuffer, dx: number, dy: number): Frame {
  const o = out1.buf;
  const out = new PixelBuffer(o.w * HI, o.h * HI);
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      const c = o.get(x, y);
      if ((c & 255) === 0) continue;
      const sx = x - dx;
      const sy = y - dy;
      if (src1.get(sx, sy) === c && sx >= 0 && sy >= 0 && sx < src1.w && sy < src1.h) {
        for (let k = 0; k < HI * HI; k++) {
          const hx = sx * HI + (k & 1);
          const hy = sy * HI + (k >> 1);
          const hc = src2.get(hx, hy);
          out.set(x * HI + (k & 1), y * HI + (k >> 1), (hc & 255) !== 0 ? hc : c);
        }
      } else out.rect(x * HI, y * HI, HI, HI, c);
    }
  }
  return asHi(out, out1);
}

/**
 * The 2× twin of creatures/draw `squashed(f1, scaleY, widen)`: the same trimmed box squashed to
 * the same logical size, re-outlined `line` px wide. `base` is the 1× squashed frame.
 */
export function squashedHi(f1: Frame, f2: PixelBuffer, base: Frame, line: number): Frame {
  const t = f1.buf.trimBounds();
  if (!t) return asHi(new PixelBuffer(base.buf.w * HI, base.buf.h * HI), base);
  const src = f2.crop(t.x * HI, t.y * HI, t.w * HI, t.h * HI);
  const w = base.buf.w - 2;
  const h = base.buf.h - 2;
  const flat = src.resized(w * HI, h * HI);
  const out = new PixelBuffer((w + 2) * HI, (h + 2) * HI);
  out.blit(flat, HI, HI);
  despeckle(out);
  outlineHi(out, line);
  return asHi(out, base);
}

/**
 * Density-aware quarter turn of a frame (1× or 2×): `q` quarter turns clockwise (−1 = a quarter
 * counter-clockwise), exact. The anchor turns with the art in LOGICAL px, so the same call gives
 * matching 1× and 2× frames (shared 1× helpers such as weapons/shots.art `ringStrip` compute the
 * anchor from buffer px, which is wrong on a 2× buffer). Points are not turned (frames without
 * points: shots, flashes).
 */
export function turnFrame(f: Frame, q: number): Frame {
  const d = f.density ?? 1;
  const w = f.buf.w / d;
  const h = f.buf.h / d;
  const t = ((Math.round(q) % 4) + 4) % 4;
  const buf = f.buf.rotated((t * Math.PI) / 2);
  // Logical pixel (x, y) → clockwise (h − 1 − y, x), half (w − 1 − x, h − 1 − y), ccw (y, w − 1 − x).
  const [ox, oy] =
    t === 0 ? [f.ox, f.oy] : t === 1 ? [h - 1 - f.oy, f.ox] : t === 2 ? [w - 1 - f.ox, h - 1 - f.oy] : [f.oy, w - 1 - f.ox];
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

/** Options of `turnHi`. */
export interface TurnHiOpts {
  /** Outline colour drawn after the turn (null / absent = none). */
  outline?: Color | null;
  /** Outline width in 2× px (default 2 = the 1× weight). */
  line?: number;
}

/**
 * The 2× twin of a 1× frame `base` that was made by turning a 1× source about its buffer centre
 * by `angle` (radians, clockwise on screen; e.g. a 16-direction strip or a 45° muzzle flash).
 * `src` is the 2× source (twice the 1× source, centred the same way). It turns about its centre
 * on whole logical pixels (`rotated(angle, { align: 2 })`; quarter turns exact), gets the outline
 * (`outline`, `line` px) and is centred on `base`'s rectangle: anchor and points are `base`'s.
 * Use it instead of a 1× turn helper on 2× art.
 */
export function turnHi(src: PixelBuffer, angle: number, base: Frame, o: TurnHiOpts = {}): Frame {
  let b = src.rotated(angle, { align: HI });
  if (o.outline !== undefined && o.outline !== null) {
    const n = o.line ?? HI;
    b = outlineHi(b.padded(HI * Math.ceil(n / HI)), n, o.outline);
  }
  return fitHi(b, base);
}
