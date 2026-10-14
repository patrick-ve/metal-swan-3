/**
 * Mission `ams` 2× decor kit (docs/ART_GUIDE.md "2x art (mission ams)"): `Q`, a canvas with the
 * PixelBuffer drawing calls of the 1× decor recipes in art.ts (same arguments, LOGICAL pixels) that
 * paints them on a density-2 buffer, so a 2× twin keeps the 1× silhouette, footprint and anchor:
 * fills cover the same logical pixels, lines and rings are 2 px wide (the 1× weight), round shapes
 * and slanted lines get the finer edge of the 2× grid. `dot` / `fine` / `each` reach single 2×
 * pixels for the inner detail (mortar joints, glazing bars, leaded glass, leaves, lettering edges).
 * `textHi` draws the small / big bitmap fonts with crisp 2× edges.
 *
 * Palette only, no blending: every call writes whole palette colours.
 */
import type { Color } from '../../../../engine/color';
import { getFont, layoutText } from '../../../../engine/font';
import { INK } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { FontId, Frame } from '../../../../engine/render';
import { outlineHi } from '../../../art/hi';

export type Pt = readonly [number, number];

/** A density-2 canvas addressed in logical pixels (see the file comment). */
export class Q {
  readonly b: PixelBuffer;
  /** Logical size. */
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.b = new PixelBuffer(w * 2, h * 2);
  }

  /** 2× column of the left edge of logical x (half steps allowed). */
  X(x: number): number {
    return Math.round(x * 2);
  }

  Y(y: number): number {
    return Math.round(y * 2);
  }

  /** Colour of logical pixel (x, y) (its top-left 2× pixel). */
  get(x: number, y: number): Color {
    return this.b.get(this.X(x), this.Y(y));
  }

  set(x: number, y: number, c: Color): this {
    this.b.rect(this.X(x), this.Y(y), 2, 2, c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    this.b.rect(this.X(x), this.Y(y), Math.round(w * 2), Math.round(h * 2), c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Color): this {
    return this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: Color): this {
    return this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
  }

  /** A 1-logical-px frame (2 px at 2×). */
  strokeRect(x: number, y: number, w: number, h: number, c: Color): this {
    this.hline(x, x + w - 1, y, c);
    this.hline(x, x + w - 1, y + h - 1, c);
    this.vline(x, y, y + h - 1, c);
    this.vline(x + w - 1, y, y + h - 1, c);
    return this;
  }

  /** A logical line: straight ones as whole pixels, slanted ones as a 2-px stroke through the pixel centres. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    if (y0 === y1) return this.hline(x0, x1, y0, c);
    if (x0 === x1) return this.vline(x0, y0, y1, c);
    this.b.capsule(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), 2, c);
    return this;
  }

  /** One 2× pixel at logical (x, y) (half steps reach the right / lower one). */
  dot(x: number, y: number, c: Color): this {
    this.b.set(this.X(x), this.Y(y), c);
    return this;
  }

  /** A 1-px (2×) line between logical positions (half steps allowed). */
  fine(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    this.b.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
    return this;
  }

  /** A 1-px (2×) row from logical x0 to the end of x1 (whole logical pixels wide) at 2× row Y. */
  fineRow(x0: number, x1: number, y: number, c: Color): this {
    this.b.hline(this.X(x0), this.X(x1 + 1) - 1, this.Y(y), c);
    return this;
  }

  /** A 1-px (2×) column from logical y0 to the end of y1 at 2× column X(x). */
  fineCol(x: number, y0: number, y1: number, c: Color): this {
    this.b.vline(this.X(x), this.Y(y0), this.Y(y1 + 1) - 1, c);
    return this;
  }

  /** Ellipse in the logical box; `fill` false = a 2-px ring (the 1× 1-px ring). */
  ellipse(x: number, y: number, w: number, h: number, c: Color, fill = true): this {
    const X = this.X(x);
    const Y = this.Y(y);
    const W = Math.round(w * 2);
    const H = Math.round(h * 2);
    if (fill) this.b.ellipse(X, Y, W, H, c);
    else ring(this.b, X, Y, W, H, c, (t, a, b2, cc, dd) => t.ellipse(a, b2, cc, dd, 0xffffffff));
    return this;
  }

  /** A 1-px (2×) ring in the logical box (finer than the 1× ring). */
  ellipseFine(x: number, y: number, w: number, h: number, c: Color): this {
    this.b.ellipse(this.X(x), this.Y(y), Math.round(w * 2), Math.round(h * 2), c, false);
    return this;
  }

  /** Circle on logical pixel (cx, cy), radius r (diameter 2r + 1 logical px). */
  circle(cx: number, cy: number, r: number, c: Color, fill = true): this {
    const rr = Math.max(0, Math.round(r));
    return this.ellipse(Math.round(cx) - rr, Math.round(cy) - rr, rr * 2 + 1, rr * 2 + 1, c, fill);
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: Color, fill = true): this {
    const X = this.X(x);
    const Y = this.Y(y);
    const W = Math.round(w * 2);
    const H = Math.round(h * 2);
    if (fill) this.b.roundRect(X, Y, W, H, r * 2, c);
    else ring(this.b, X, Y, W, H, c, (t, a, b2, cc, dd) => t.roundRect(a, b2, cc, dd, Math.max(0, r * 2 - 2), 0xffffffff));
    return this;
  }

  /**
   * Filled polygon through logical pixels (inclusive like PixelBuffer.poly): each vertex takes the
   * 2× pixel of its logical pixel on the outer side (from the centroid), so the shape covers the
   * same logical pixels.
   */
  poly(pts: ReadonlyArray<Pt>, c: Color): this {
    let cx = 0;
    let cy = 0;
    for (const [x, y] of pts) {
      cx += x / pts.length;
      cy += y / pts.length;
    }
    this.b.poly(
      pts.map(([x, y]) => [this.X(x) + (x >= cx ? 1 : 0), this.Y(y) + (y >= cy ? 1 : 0)] as [number, number]),
      c,
    );
    return this;
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Color): this {
    return this.poly([[x0, y0], [x1, y1], [x2, y2]], c);
  }

  /** Capsule `w` logical px wide between logical pixels (as PixelBuffer.thickLine at 1×). */
  thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: Color): this {
    if (Math.round(w) <= 1) return this.line(x0, y0, x1, y1, c);
    const o = w % 2 === 0 ? 1 : 0;
    this.b.capsule(this.X(x0) + o, this.Y(y0) + o, this.X(x1) + o, this.Y(y1) + o, Math.round(w * 2), c);
    return this;
  }

  /** Tapered limb (as PixelBuffer.taper at 1×). */
  taper(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: Color): this {
    const o0 = Math.round(w0) % 2 === 0 ? 1 : 0;
    const o1 = Math.round(w1) % 2 === 0 ? 1 : 0;
    this.b.taper(this.X(x0) + o0, this.Y(y0) + o0, this.X(x1) + o1, this.Y(y1) + o1, Math.max(2, Math.round(w0 * 2)), Math.max(2, Math.round(w1 * 2)), c);
    return this;
  }

  /**
   * Visit every 2× pixel of the logical box [x0..x1] × [y0..y1] (inclusive, clipped), with its
   * logical pixel (lx, ly) and the 2× sub-position (u, v ∈ {0, 1}).
   */
  each(x0: number, y0: number, x1: number, y1: number, fn: (X: number, Y: number, lx: number, ly: number, u: number, v: number) => void): void {
    const X0 = Math.max(0, this.X(x0));
    const Y0 = Math.max(0, this.Y(y0));
    const X1 = Math.min(this.b.w - 1, this.X(x1 + 1) - 1);
    const Y1 = Math.min(this.b.h - 1, this.Y(y1 + 1) - 1);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) fn(X, Y, X >> 1, Y >> 1, X & 1, Y & 1);
  }

  /** INK outline of the silhouette, 2 px (the 1× weight). */
  outline(): this {
    outlineHi(this.b, 2, INK);
    return this;
  }

  /** The frame with a logical anchor. */
  frame(ox: number, oy: number): Frame {
    return { buf: this.b, ox, oy, density: 2 };
  }

  /** Feet anchor (as art.ts `feet`). */
  feet(): Frame {
    return this.frame(this.w >> 1, this.h);
  }
}

/** A 2-px ring: the shape minus the same shape 2 px in. */
function ring(b: PixelBuffer, X: number, Y: number, W: number, H: number, c: Color, shape: (t: PixelBuffer, x: number, y: number, w: number, h: number) => void): void {
  if (W <= 0 || H <= 0) return;
  const t = new PixelBuffer(W, H);
  shape(t, 0, 0, W, H);
  const inner = new PixelBuffer(W, H);
  if (W > 4 && H > 4) shape(inner, 2, 2, W - 4, H - 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if ((t.data[k] & 255) !== 0 && (inner.data[k] & 255) === 0) b.set(X + x, Y + y, c);
    }
  }
}

// =============================================================================================
// Lettering
// =============================================================================================

export interface HiTextOpts {
  font?: FontId;
  color: Color;
  align?: 'left' | 'center' | 'right';
  /** An edge colour around the letters (the 1× 8-neighbour outline, 2 px at 2×). */
  outline?: Color;
  /** Round the outer corners of the strokes (the 2× edge); default true. */
  round?: boolean;
}

/** The glyph mask of `text` doubled with the EPX rule (crisp 2× diagonals and round bowls). */
function textMask(text: string, x: number, y: number, o: HiTextOpts, W: number, H: number): Uint8Array {
  const font = getFont(o.font);
  const lo = new Uint8Array(W * H / 4 + 1);
  const lw = W >> 1;
  const lh = H >> 1;
  layoutText(text, x, y, font, o.align ?? 'left', (g, gx, gy) => {
    for (let r = 0; r < g.rows.length; r++) {
      const m = g.rows[r];
      if (m === 0) continue;
      for (let c = 0; c < g.w; c++) {
        if (((m >>> (g.w - 1 - c)) & 1) === 0) continue;
        const px = gx + c;
        const py = gy + r;
        if (px >= 0 && py >= 0 && px < lw && py < lh) lo[py * lw + px] = 1;
      }
    }
  });
  const at = (px: number, py: number): number => (px >= 0 && py >= 0 && px < lw && py < lh ? lo[py * lw + px] : 0);
  const hi = new Uint8Array(W * H);
  const round = o.round !== false;
  for (let py = 0; py < lh; py++) {
    for (let px = 0; px < lw; px++) {
      const P = at(px, py);
      const A = at(px, py - 1);
      const B = at(px + 1, py);
      const C = at(px - 1, py);
      const D = at(px, py + 1);
      let p1 = P;
      let p2 = P;
      let p3 = P;
      let p4 = P;
      // EPX: a corner sub-pixel takes the two neighbours it touches when they agree (and differ from the others).
      if (C === A && C !== D && A !== B && (round || C === 1)) p1 = A;
      if (A === B && A !== C && B !== D && (round || A === 1)) p2 = B;
      if (D === C && D !== B && C !== A && (round || D === 1)) p3 = C;
      if (B === D && B !== A && D !== C && (round || B === 1)) p4 = D;
      const k = py * 2 * W + px * 2;
      hi[k] = p1;
      hi[k + 1] = p2;
      hi[k + W] = p3;
      hi[k + W + 1] = p4;
    }
  }
  return hi;
}

/** Draw text at logical (x, y) with crisp 2× edges (layout as drawText at 1×). */
export function textHi(q: Q, text: string, x: number, y: number, o: HiTextOpts): void {
  const W = q.b.w;
  const H = q.b.h;
  const m = textMask(text, x, y, o, W, H);
  if (o.outline !== undefined) {
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        if (m[Y * W + X]) continue;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = X + dx;
            const yy = Y + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && m[yy * W + xx]) {
              near = true;
              break;
            }
          }
        }
        if (near) q.b.set(X, Y, o.outline);
      }
    }
  }
  for (let k = 0; k < m.length; k++) if (m[k]) q.b.data[k] = o.color >>> 0;
  q.b.touch();
}
