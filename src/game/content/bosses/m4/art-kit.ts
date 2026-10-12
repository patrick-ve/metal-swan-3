/**
 * Small drawing helpers shared by the m4 boss art: a canvas in a sprite's LOCAL coordinates
 * (anchor at local 0, 0), light-from-the-top-left shading of a filled layer, and sparkle /
 * damage marks. Pure and deterministic (hash-based "randomness").
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { hash2 } from '../../../art/paint';

/** A buffer addressed in local coordinates: local (x0, y0) is the buffer's top-left pixel. */
export class Canvas {
  readonly b: PixelBuffer;
  readonly x0: number;
  readonly y0: number;

  constructor(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.b = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  }

  X(lx: number): number {
    return Math.round(lx - this.x0);
  }

  Y(ly: number): number {
    return Math.round(ly - this.y0);
  }

  /** A blank layer of the same size (draw a part flat, shade it, then `put` it). */
  layer(): PixelBuffer {
    return new PixelBuffer(this.b.w, this.b.h);
  }

  put(layer: PixelBuffer): this {
    this.b.blit(layer, 0, 0);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    this.b.rect(this.X(x), this.Y(y), w, h, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    this.b.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
    return this;
  }

  set(x: number, y: number, c: Color): this {
    this.b.set(this.X(x), this.Y(y), c);
    return this;
  }

  /** The finished frame: optional INK outline, anchor at local (0, 0). */
  frame(outline = true, pts?: Record<string, readonly [number, number]>): Frame {
    if (outline) this.b.outline(INK);
    return { buf: this.b, ox: this.X(0), oy: this.Y(0), pts };
  }
}

/** Shade the opaque pixels of `b` inside the box by position (light from the top-left). */
export function shadeBox(b: PixelBuffer, x0: number, y0: number, w: number, h: number, ramp: Ramp, round = true): void {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const n = ramp.length;
  for (let y = Math.max(0, y0); y < Math.min(b.h, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(b.w, x0 + w); x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const u = (x - cx) / (w / 2);
      const v = (y - cy) / (h / 2);
      const l = round ? -u * 0.45 - v * 0.8 : -v;
      const i = l > 0.55 ? n - 1 : l > -0.1 ? n - 2 : l > -0.6 ? Math.max(1, n - 3) : 0;
      b.set(x, y, ramp[Math.max(0, Math.min(n - 1, i))]);
    }
  }
}

/** Ink cracks, dents and scorch smudges (state 1 light, 2 heavy) on the opaque pixels of a box. */
export function scuff(b: PixelBuffer, x0: number, y0: number, w: number, h: number, state: number, seed: number, light: Color = PAL.steel[3]): void {
  if (state <= 0) return;
  const n = Math.round((w * h) / (state === 1 ? 220 : 90));
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(hash2(i, 1, seed) * w);
    const y = y0 + Math.floor(hash2(i, 2, seed) * h);
    if ((b.get(x, y) & 255) === 0) continue;
    const k = hash2(i, 3, seed);
    if (k < 0.45) {
      b.set(x, y, INK);
      if ((b.get(x - 1, y - 1) & 255) !== 0) b.set(x - 1, y - 1, light);
    } else if (k < 0.8 || state === 1) {
      // A short crack.
      const dx = hash2(i, 4, seed) < 0.5 ? 1 : -1;
      for (let s = 0; s < 3 + state; s++) {
        const px = x + s * dx;
        const py = y + (s >> 1);
        if ((b.get(px, py) & 255) !== 0) b.set(px, py, INK);
      }
    } else {
      // A scorch smudge.
      for (let yy = -2; yy <= 2; yy++) {
        for (let xx = -3; xx <= 3; xx++) {
          if (Math.abs(xx) + Math.abs(yy) > 3) continue;
          if (((x + xx + y + yy) & 1) === 0 && (b.get(x + xx, y + yy) & 255) !== 0) b.set(x + xx, y + yy, PAL.ink[1]);
        }
      }
    }
  }
}

/** A 4-point sparkle (glint) centred on (x, y). */
export function sparkle(b: PixelBuffer, x: number, y: number, c: Color = PAL.snow[3]): void {
  b.set(x, y, c);
  b.set(x - 1, y, PAL.snow[1]);
  b.set(x + 1, y, PAL.snow[1]);
  b.set(x, y - 1, PAL.snow[1]);
  b.set(x, y + 1, PAL.snow[1]);
}
