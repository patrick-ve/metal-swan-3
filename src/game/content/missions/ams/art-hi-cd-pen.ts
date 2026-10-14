/**
 * A pen for the 2× decor of mission ams sections c and d (docs/ART_GUIDE.md "2x art (mission
 * ams)"): it takes the coordinates of the 1× recipe (1× buffer pixels = logical pixels) and draws
 * on a 2× buffer, so a 2× generator can follow its 1× twin call by call and keep the same
 * footprint. Whole-pixel calls (`rect`, `hline`, `vline`, `set`) paint 2 × 2 blocks; `line` is a
 * 2-px stroke through the logical pixel centres (the 1× weight); `fine` and `dot` reach single 2×
 * pixels (half steps address the right / lower half of a logical pixel) for the finer details.
 */
import type { Color } from '../../../../engine/color';
import { drawText } from '../../../../engine/font';
import { INK } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame, TextOpts } from '../../../../engine/render';
import { HI, outlineHi } from '../../../art/hi';

export type P = readonly [number, number];

export class Pen2 {
  readonly b: PixelBuffer;
  /** Logical size (the 1× buffer). */
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.b = new PixelBuffer(w * HI, h * HI);
  }

  /** Logical rectangle (x, y, w, h may be half steps). */
  rect(x: number, y: number, w: number, h: number, c: Color): this {
    this.b.rect(Math.round(x * HI), Math.round(y * HI), Math.round(w * HI), Math.round(h * HI), c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Color): this {
    return this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: Color): this {
    return this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
  }

  /** One logical pixel (a 2 × 2 block). */
  set(x: number, y: number, c: Color): this {
    return this.rect(x, y, 1, 1, c);
  }

  /** One 2× pixel at logical (x, y); x + 0.5 / y + 0.5 = the right / lower half. */
  dot(x: number, y: number, c: Color): this {
    this.b.set(Math.round(x * HI), Math.round(y * HI), c);
    return this;
  }

  /** A 1-px (2×) line between logical positions (half steps allowed). */
  fine(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    this.b.line(Math.round(x0 * HI), Math.round(y0 * HI), Math.round(x1 * HI), Math.round(y1 * HI), c);
    return this;
  }

  /** A 1-px (2×) row from logical x0 to x1 (both inclusive, half steps allowed) at 2× row y. */
  fineH(x0: number, x1: number, y: number, c: Color): this {
    this.b.hline(Math.round(x0 * HI), Math.round(x1 * HI), Math.round(y * HI), c);
    return this;
  }

  fineV(x: number, y0: number, y1: number, c: Color): this {
    this.b.vline(Math.round(x * HI), Math.round(y0 * HI), Math.round(y1 * HI), c);
    return this;
  }

  /** The 1× Bresenham line at the 1× weight: a 2-px stroke through the logical pixel centres. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    if (x0 === x1 || y0 === y1) return this.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1, c);
    this.b.capsule(x0 * HI, y0 * HI, x1 * HI, y1 * HI, HI, c);
    return this;
  }

  /** Capsule `w` logical px wide (as PixelBuffer.thickLine at 1×). */
  thick(x0: number, y0: number, x1: number, y1: number, w: number, c: Color): this {
    if (w <= 1) return this.line(x0, y0, x1, y1, c);
    // 1× odd widths are centred on pixel centres: at 2× the centre is the block's corner (x·2 + 1).
    const o = w % 2 === 1 ? 0 : 1;
    this.b.capsule(x0 * HI + o, y0 * HI + o, x1 * HI + o, y1 * HI + o, w * HI, c);
    return this;
  }

  /** Tapered limb (as PixelBuffer.taper at 1×). */
  taper(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: Color): this {
    const o = Math.round(w0) % 2 === 1 ? 0 : 1;
    this.b.taper(x0 * HI + o, y0 * HI + o, x1 * HI + o, y1 * HI + o, w0 * HI, w1 * HI, c);
    return this;
  }

  /** Ellipse in the logical box (x, y, w, h); unfilled = a ring 2 px wide (the 1× weight). */
  ellipse(x: number, y: number, w: number, h: number, c: Color, fill = true): this {
    const X = Math.round(x * HI);
    const Y = Math.round(y * HI);
    this.b.ellipse(X, Y, w * HI, h * HI, c, fill);
    if (!fill && w > 1 && h > 1) this.b.ellipse(X + 1, Y + 1, w * HI - 2, h * HI - 2, c, false);
    return this;
  }

  /** Circle centred on logical pixel (cx, cy), radius r (as PixelBuffer.circle at 1×). */
  circle(cx: number, cy: number, r: number, c: Color, fill = true): this {
    const rr = Math.max(0, Math.round(r));
    return this.ellipse(cx - rr, cy - rr, 2 * rr + 1, 2 * rr + 1, c, fill);
  }

  /** Circle with a 1-px (2×) ring instead of the 2-px one. */
  ring(cx: number, cy: number, r: number, c: Color): this {
    const rr = Math.max(0, Math.round(r));
    this.b.ellipse((cx - rr) * HI, (cy - rr) * HI, (2 * rr + 1) * HI, (2 * rr + 1) * HI, c, false);
    return this;
  }

  /**
   * Filled polygon through logical pixels (inclusive, like PixelBuffer.poly at 1×): each vertex
   * takes the 2× pixel of its logical pixel on the outer side, so the shape covers the same pixels.
   */
  poly(pts: readonly P[], c: Color): this {
    let cx = 0;
    let cy = 0;
    for (const [x, y] of pts) {
      cx += x / pts.length;
      cy += y / pts.length;
    }
    this.b.poly(
      pts.map(([x, y]) => [Math.round(x * HI) + (x >= cx ? 1 : 0), Math.round(y * HI) + (y >= cy ? 1 : 0)] as [number, number]),
      c,
    );
    return this;
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Color): this {
    return this.poly([[x0, y0], [x1, y1], [x2, y2]], c);
  }

  /** 1-px logical rectangle outline (as PixelBuffer.strokeRect at 1×). */
  strokeRect(x: number, y: number, w: number, h: number, c: Color): this {
    this.hline(x, x + w - 1, y, c).hline(x, x + w - 1, y + h - 1, c);
    return this.vline(x, y, y + h - 1, c).vline(x + w - 1, y, y + h - 1, c);
  }

  /** Visit every 2× pixel of the logical box [x0, x1] × [y0, y1] (inclusive) with its logical position (half steps). */
  each(x0: number, y0: number, x1: number, y1: number, fn: (X: number, Y: number, lx: number, ly: number) => void): void {
    const X0 = Math.max(0, x0 * HI);
    const Y0 = Math.max(0, y0 * HI);
    const X1 = Math.min(this.b.w - 1, (x1 + 1) * HI - 1);
    const Y1 = Math.min(this.b.h - 1, (y1 + 1) * HI - 1);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) fn(X, Y, X / HI, Y / HI);
  }

  /** Set 2× pixel (X, Y) (buffer coordinates). */
  put(X: number, Y: number, c: Color): this {
    this.b.set(X, Y, c);
    return this;
  }

  /** The colour of 2× pixel (X, Y). */
  get(X: number, Y: number): Color {
    return this.b.get(X, Y);
  }

  /**
   * Text of the 1× recipe (logical position) drawn with doubled glyphs, so it reads exactly as
   * the 1× lettering; `edge` adds a 1-px shadow down-right of each stroke where it falls on
   * nothing of the letter (an engraved edge the 2× grid can show).
   */
  text(s: string, x: number, y: number, o: TextOpts, edge?: Color): this {
    if (edge === undefined) {
      drawText(this.b, s, x * HI, y * HI, { ...o, scale: HI });
      return this;
    }
    const L = new PixelBuffer(this.b.w, this.b.h);
    drawText(L, s, x * HI, y * HI, { ...o, scale: HI });
    const d = L.data;
    const W = L.w;
    for (let Y = 0; Y < L.h - 1; Y++) {
      for (let X = 0; X < W - 1; X++) {
        const i = Y * W + X;
        if ((d[i] & 255) === 0) continue;
        if ((d[i + W + 1] & 255) === 0) this.b.set(X + 1, Y + 1, edge);
      }
    }
    this.b.blit(L, 0, 0);
    return this;
  }

  /** INK outline of the silhouette at the 1× weight (2 px). */
  outline(c: Color = INK): this {
    outlineHi(this.b, 2, c);
    return this;
  }

  /** The 2× frame anchored like its 1× twin (logical ox, oy). */
  frame(ox: number, oy: number): Frame {
    return { buf: this.b, ox, oy, density: HI };
  }
}

/** Feet anchor of a pen's logical size (as art.ts `feet`). */
export function feet2(p: Pen2): Frame {
  return p.frame(p.w >> 1, p.h);
}
