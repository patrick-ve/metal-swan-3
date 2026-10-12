/**
 * Small pixel helpers shared by the m5 boss art: brass organ pipes, walnut panels with gold trim,
 * damage wear by state and glints. Pure and deterministic (hash-based "randomness").
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { damage } from '../../../art/machines';
import { hash2 } from '../../../art/paint';

export function frameOf(buf: PixelBuffer, ox: number, oy: number, pts?: Record<string, readonly [number, number]>): Frame {
  return { buf, ox, oy, pts };
}

/**
 * A vertical organ pipe: cylinder from `top` to `bottom` (the foot cone takes the last 6 px), lit
 * from the left, a rim at the top and a mouth (dark slit with a bright arched lip) above the foot.
 */
export function brassPipe(b: PixelBuffer, x: number, top: number, w: number, bottom: number, ramp: Ramp = PAL.gold, mouth = true): void {
  const footH = Math.min(6, Math.max(2, (bottom - top) >> 3));
  const bodyB = bottom - footH;
  for (let i = 0; i < w; i++) {
    const u = w <= 1 ? 0.5 : i / (w - 1);
    const c = u < 0.18 ? ramp[3] : u < 0.45 ? ramp[2] : u < 0.8 ? ramp[1] : ramp[0];
    b.vline(x + i, top, bodyB, c);
  }
  // Rim and a ring band.
  b.hline(x - 1, x + w, top, ramp[3]);
  b.hline(x - 1, x + w, top + 1, ramp[1]);
  // Foot cone.
  for (let k = 0; k < footH; k++) {
    const half = Math.max(1, Math.round((w / 2) * (1 - k / footH)));
    const cx = x + Math.floor(w / 2);
    b.hline(cx - half, cx + half - 1, bodyB + 1 + k, k === 0 ? ramp[2] : ramp[1]);
    b.set(cx - half, bodyB + 1 + k, ramp[3]);
  }
  if (mouth && w >= 4) {
    const my = bodyB - Math.max(4, Math.round((bodyB - top) * 0.22));
    b.rect(x + 1, my, w - 2, 2, INK);
    b.hline(x + 1, x + w - 2, my - 1, ramp[3]);
    b.set(x + (w >> 1), my - 2, ramp[3]);
    b.hline(x + 1, x + w - 2, my + 2, ramp[0]);
  }
}

/** A walnut panel with grain, a gold border and an inner moulding. */
export function walnutPanel(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: number, dark = false): void {
  const base = dark ? PAL.brown[0] : PAL.brown[1];
  b.rect(x, y, w, h, base);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const g = Math.sin((xx + hash2(0, yy >> 2, seed) * 30) * 0.35 + yy * 0.08);
      if (g > 0.86) b.set(x + xx, y + yy, dark ? PAL.ink[1] : PAL.brown[0]);
      else if (g < -0.93 && !dark) b.set(x + xx, y + yy, PAL.brown[2]);
    }
  }
  b.strokeRect(x, y, w, h, dark ? PAL.gold[0] : PAL.gold[1]);
  b.hline(x + 1, x + w - 2, y + 1, dark ? PAL.gold[1] : PAL.gold[2]);
  if (w > 10 && h > 10) b.strokeRect(x + 3, y + 3, w - 6, h - 6, dark ? PAL.brown[1] : PAL.brown[0]);
}

/** Damage wear on a finished (outlined) buffer: state 1 dents and holes, 2 heavy scorch. */
export function wear(src: PixelBuffer, state: number, seed: number): PixelBuffer {
  if (state <= 0) return src;
  const b = damage(src, state === 1 ? 0.35 : 0.9, seed);
  if (state < 2) return b;
  // Extra cracks.
  const n = Math.max(2, Math.round((b.w * b.h) / 260));
  for (let i = 0; i < n; i++) {
    let x = Math.floor(hash2(i, 7, seed) * b.w);
    let y = Math.floor(hash2(i, 8, seed) * b.h);
    for (let s = 0; s < 6; s++) {
      if ((b.get(x, y) & 255) !== 0) b.set(x, y, INK);
      x += hash2(i, s, seed + 3) < 0.5 ? 1 : -1;
      y += 1;
    }
  }
  return b;
}

/** A 4-point glint. */
export function glint(b: PixelBuffer, x: number, y: number, c: Color = PAL.snow[3]): void {
  b.set(x, y, c);
  b.set(x - 1, y, PAL.snow[1]);
  b.set(x + 1, y, PAL.snow[1]);
  b.set(x, y - 1, PAL.snow[1]);
  b.set(x, y + 1, PAL.snow[1]);
}

/** Gold ball finial with a spike. */
export function finial(b: PixelBuffer, x: number, y: number): void {
  b.vline(x, y - 6, y - 3, PAL.gold[2]);
  b.circle(x, y, 2, PAL.gold[2]);
  b.set(x - 1, y - 1, PAL.gold[3]);
}
