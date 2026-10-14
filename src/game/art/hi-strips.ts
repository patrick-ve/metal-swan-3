/**
 * 2× twins of the generic creature strips for the Amsterdam cast (mission ams; docs/ART_GUIDE.md
 * "2x art (mission ams)"): the pancake / peel crush strip of creatures/draw `crushStrip`, and a
 * fit that lines a transformed 2× buffer up with its (possibly trimmed) 1× frame.
 */
import { PixelBuffer } from '../../engine/pixel';
import type { Frame } from '../../engine/render';
import { HI, asHi, outlineHi } from './hi';
import { despeckle } from './paint';

/**
 * Place the opaque part of the 2× buffer `buf` in a 2× twin of the 1× frame `lo` so that both
 * opaque boxes share their centre (rounded to whole 2× px). For art that went through a
 * transform whose output size depends on the density (rotations) and a 1× frame that may have
 * been trimmed by the registry.
 */
export function fitBounds(buf: PixelBuffer, lo: Frame): Frame {
  const d = lo.density ?? 1;
  const out = new PixelBuffer((lo.buf.w / d) * HI, (lo.buf.h / d) * HI);
  const t = buf.trimBounds();
  const l = lo.buf.trimBounds();
  if (!t || !l) return asHi(out, lo);
  const s = HI / d;
  const cx = (l.x + l.w / 2) * s;
  const cy = (l.y + l.h / 2) * s;
  out.blit(buf.crop(t.x, t.y, t.w, t.h), Math.round(cx - t.w / 2), Math.round(cy - t.h / 2));
  return asHi(out, lo);
}

/**
 * Resize a 2× buffer to `w × h` LOGICAL px by whole logical px: each output 2 × 2 block copies
 * the 2 × 2 source block the 1× `resized` picks for that pixel. So a squash keeps or drops the
 * 2 hi rows of a logical row together (never one hi row of an outline or a seam).
 */
function resizedBlocks(src: PixelBuffer, w: number, h: number): PixelBuffer {
  const sw = src.w / HI;
  const sh = src.h / HI;
  const out = new PixelBuffer(w * HI, h * HI);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / w));
      for (let j = 0; j < HI; j++) {
        for (let i = 0; i < HI; i++) out.data[(y * HI + j) * out.w + x * HI + i] = src.data[(sy * HI + j) * src.w + sx * HI + i];
      }
    }
  }
  return out.touch();
}

/** The squashed 2× art of `f1`'s box at the size of the 1× squashed frame `base`, NOT outlined. */
function squashedRaw(f1: Frame, f2: PixelBuffer, base: Frame): PixelBuffer {
  const out = new PixelBuffer(base.buf.w * HI, base.buf.h * HI);
  const t = f1.buf.trimBounds();
  if (!t) return out;
  const src = f2.crop(t.x * HI, t.y * HI, t.w * HI, t.h * HI);
  out.blit(resizedBlocks(src, base.buf.w - 2, base.buf.h - 2), HI, HI);
  // Inner pixels that became outline colour make speckles (the 1× rule, on 2× patches).
  return despeckle(out, undefined, HI);
}

/**
 * The 2× twin of creatures/draw `crushStrip(f1)`: `f2` is the same pose at 2× (the 1× frame's
 * rectangle doubled), `lo` the registered 1× strip (the geometry each 2× frame must match). The
 * squash works in whole logical px, and every frame gets one clean 2-px outline at the end (the
 * peel frames are turned before they are outlined).
 */
export function crushStripHi(f1: Frame, f2: Frame, lo: readonly Frame[]): Frame[] {
  const flatRaw = squashedRaw(f1, f2.buf, lo[1]);
  const half = asHi(outlineHi(squashedRaw(f1, f2.buf, lo[0]), HI), lo[0]);
  const flat = asHi(outlineHi(flatRaw.clone(), HI), lo[1]);
  const peel = (angle: number, i: number): Frame =>
    fitBounds(outlineHi(flatRaw.rotated(angle, { align: HI }).padded(HI), HI), lo[i]);
  return [half, flat, fitBounds(flat.buf, lo[2]), peel(-0.35, 3), peel(0.3, 4), peel(-0.25, 5), peel(0.2, 6)];
}
