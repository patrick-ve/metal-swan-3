/**
 * ROBO-HALSEMA — the drawing canvas of her art at density 1 or 2 (docs/ART_GUIDE.md "2x art
 * (mission ams)"). Every call takes LOCAL logical coordinates (the anchor at 0, 0); the canvas
 * maps them onto its buffer. At density 1 each call is exactly the PixelBuffer call the 1× art
 * always made (the 1× frames stay byte-identical); at density 2 the same shapes are drawn on the
 * 2× grid with the finer edge (a logical pixel is a 2 × 2 block, lines are 2 px wide), so the 2×
 * frame is the same design with the same footprint, anchor and points. Fine 2× details (1-px
 * lines, single 2× pixels) use `dot` / `fine` with half steps.
 */
import type { Color } from '../../../../engine/color';
import { INK, type Ramp } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { outlineHi } from '../../../art/hi';
import { shadeBox } from '../m4/art-kit';

export type Pt = readonly [number, number];

/** [x0, y0, x1, y1) around the pixels of `b` with non-zero alpha, or null when it has none. */
function opaqueRect(b: PixelBuffer): [number, number, number, number] | null {
  const { w, h, data } = b;
  let y0 = 0;
  let y1 = h;
  const rowEmpty = (y: number): boolean => {
    for (let i = y * w, e = i + w; i < e; i++) if ((data[i] & 255) !== 0) return false;
    return true;
  };
  while (y0 < h && rowEmpty(y0)) y0++;
  if (y0 === h) return null;
  while (rowEmpty(y1 - 1)) y1--;
  let x0 = w;
  let x1 = 0;
  for (let y = y0; y < y1; y++) {
    const r = y * w;
    for (let x = 0; x < x0; x++) if ((data[r + x] & 255) !== 0) { x0 = x; break; }
    for (let x = w - 1; x >= x1; x--) if ((data[r + x] & 255) !== 0) { x1 = x + 1; break; }
  }
  return [x0, y0, x1, y1];
}

export class DCanvas {
  readonly b: PixelBuffer;
  readonly x0: number;
  readonly y0: number;
  /** Buffer pixels per logical pixel (1 or 2). */
  readonly d: number;

  constructor(x0: number, y0: number, x1: number, y1: number, d = 1) {
    this.x0 = x0;
    this.y0 = y0;
    this.d = d;
    this.b = new PixelBuffer((x1 - x0 + 1) * d, (y1 - y0 + 1) * d);
  }

  /** Buffer column of the left edge of logical x. */
  X(lx: number): number {
    return Math.round((lx - this.x0) * this.d);
  }

  /** Buffer row of the top edge of logical y. */
  Y(ly: number): number {
    return Math.round((ly - this.y0) * this.d);
  }

  /** Logical x of the centre of buffer column X, on the logical pixel grid (density 1: X + x0). */
  lx(X: number): number {
    return this.x0 + (X + 0.5) / this.d - 0.5;
  }

  ly(Y: number): number {
    return this.y0 + (Y + 0.5) / this.d - 0.5;
  }

  /** A blank layer of the same size (draw a part flat, shade it, then `put` it). */
  layer(): PixelBuffer {
    return new PixelBuffer(this.b.w, this.b.h);
  }

  put(layer: PixelBuffer): this {
    // Only the rect around the layer's opaque pixels (a layer is mostly transparent): the same
    // result as blitting the whole layer, for a fraction of the work.
    const r = opaqueRect(layer);
    if (r) this.b.blit(layer, r[0], r[1], { sx: r[0], sy: r[1], sw: r[2] - r[0], sh: r[3] - r[1] });
    return this;
  }

  /** The colour at logical pixel (x, y) (its top-left buffer pixel). */
  at(x: number, y: number, L: PixelBuffer = this.b): Color {
    return L.get(this.X(x), this.Y(y));
  }

  rect(x: number, y: number, w: number, h: number, c: Color, L: PixelBuffer = this.b): this {
    L.rect(this.X(x), this.Y(y), w * this.d, h * this.d, c);
    return this;
  }

  /** A logical line: 1 px at density 1, a 2-px stroke through the pixel centres at density 2. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color, L: PixelBuffer = this.b): this {
    if (this.d === 1) L.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
    else L.capsule(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.d, c);
    return this;
  }

  /** One logical pixel. */
  set(x: number, y: number, c: Color, L: PixelBuffer = this.b): this {
    if (this.d === 1) L.set(this.X(x), this.Y(y), c);
    else L.rect(this.X(x), this.Y(y), this.d, this.d, c);
    return this;
  }

  /** One buffer pixel at logical (x, y) (half steps reach the right / lower 2× pixel). */
  dot(x: number, y: number, c: Color, L: PixelBuffer = this.b): this {
    L.set(this.X(x), this.Y(y), c);
    return this;
  }

  /** A 1-buffer-px Bresenham line between logical positions (half steps allowed). */
  fine(x0: number, y0: number, x1: number, y1: number, c: Color, L: PixelBuffer = this.b): this {
    L.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
    return this;
  }

  /** A fine polyline through logical positions. */
  fines(pts: ReadonlyArray<Pt>, c: Color, L: PixelBuffer = this.b): this {
    for (let i = 0; i + 1 < pts.length; i++) this.fine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, L);
    return this;
  }

  /** Circle centred on logical pixel (x, y), radius r (diameter 2r + 1 logical px). */
  circle(x: number, y: number, r: number, c: Color, L: PixelBuffer = this.b): this {
    if (this.d === 1) L.circle(this.X(x), this.Y(y), r, c);
    else {
      const rr = Math.max(0, Math.round(r));
      const s = (2 * rr + 1) * this.d;
      L.ellipse(this.X(x - rr), this.Y(y - rr), s, s, c);
    }
    return this;
  }

  /** Ellipse in the logical box (x, y, w, h). */
  ellipse(x: number, y: number, w: number, h: number, c: Color, L: PixelBuffer = this.b): this {
    L.ellipse(this.X(x), this.Y(y), w * this.d, h * this.d, c);
    return this;
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: Color, L: PixelBuffer = this.b): this {
    L.roundRect(this.X(x), this.Y(y), w * this.d, h * this.d, r * this.d, c);
    return this;
  }

  /**
   * Filled polygon through logical pixels (inclusive, like PixelBuffer.poly at density 1). At
   * density 2 each vertex takes the 2× pixel of its logical pixel on the outer side (from the
   * centroid), so the shape covers the same logical pixels.
   */
  poly(pts: ReadonlyArray<Pt>, c: Color, L: PixelBuffer = this.b): this {
    if (this.d === 1) {
      L.poly(
        pts.map(([x, y]) => [this.X(x), this.Y(y)] as [number, number]),
        c,
      );
      return this;
    }
    let cx = 0;
    let cy = 0;
    for (const [x, y] of pts) {
      cx += x / pts.length;
      cy += y / pts.length;
    }
    L.poly(
      pts.map(([x, y]) => [this.X(x) + (x >= cx ? this.d - 1 : 0), this.Y(y) + (y >= cy ? this.d - 1 : 0)] as [number, number]),
      c,
    );
    return this;
  }

  /** Capsule `w` logical px wide between logical pixels (as PixelBuffer.capsule at density 1). */
  capsule(x0: number, y0: number, x1: number, y1: number, w: number, c: Color, L: PixelBuffer = this.b): this {
    if (this.d === 1) L.capsule(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), w, c);
    else {
      // Odd widths are centred on the logical pixel centre, even ones on its lower-right corner.
      const o = w % 2 === 0 ? this.d - 1 : this.d / 2 - 1;
      L.capsule(this.X(x0) + o, this.Y(y0) + o, this.X(x1) + o, this.Y(y1) + o, w * this.d, c);
    }
    return this;
  }

  /** shadeBox over a logical box. */
  shade(L: PixelBuffer, x: number, y: number, w: number, h: number, ramp: Ramp, round = true): this {
    shadeBox(L, this.X(x), this.Y(y), w * this.d, h * this.d, ramp, round);
    return this;
  }

  /** Visit every buffer pixel of the logical box [x0..x1] × [y0..y1] (inclusive) with its logical position. */
  each(x0: number, y0: number, x1: number, y1: number, fn: (X: number, Y: number, lx: number, ly: number) => void): void {
    const X0 = Math.max(0, this.X(x0));
    const Y0 = Math.max(0, this.Y(y0));
    const X1 = Math.min(this.b.w - 1, this.X(x1 + 1) - 1);
    const Y1 = Math.min(this.b.h - 1, this.Y(y1 + 1) - 1);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) fn(X, Y, this.lx(X), this.ly(Y));
  }

  /** INK outline of the silhouette: 1 px at density 1, 2 px (the same weight) at density 2. */
  outline(): this {
    if (this.d === 1) {
      this.b.outline(INK);
      return this;
    }
    // The outline only reaches 2 px past the silhouette: outline that rect, not the whole canvas.
    const r = opaqueRect(this.b);
    if (!r) return this;
    const x0 = Math.max(0, r[0] - 2);
    const y0 = Math.max(0, r[1] - 2);
    const x1 = Math.min(this.b.w, r[2] + 2);
    const y1 = Math.min(this.b.h, r[3] + 2);
    const part = outlineHi(this.b.crop(x0, y0, x1 - x0, y1 - y0), 2);
    this.b.blit(part, x0, y0, { blend: 'copy' });
    return this;
  }

  /** The finished frame: optional outline, anchor at local (0, 0). */
  frame(outline = true): Frame {
    if (outline) this.outline();
    return this.d === 1 ? { buf: this.b, ox: this.X(0), oy: this.Y(0) } : { buf: this.b, ox: -this.x0, oy: -this.y0, density: this.d };
  }
}
