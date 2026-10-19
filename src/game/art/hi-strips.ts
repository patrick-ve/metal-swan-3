/**
 * Dense twins (density 2 or 4) of the generic creature strips for the Amsterdam cast (mission
 * ams; docs/ART_GUIDE.md "UHD art"): the pancake / peel crush strip of creatures/draw
 * `crushStrip`, and a fit that lines a transformed dense buffer up with its (possibly trimmed) 1×
 * frame. The density comes from the dense source frame (2 when it has none: the 2× callers).
 */
import { PixelBuffer } from '../../engine/pixel';
import type { Frame } from '../../engine/render';
import { HI, outlineHi } from './hi';
import { despeckle } from './paint';

/** A dense frame on the 1× frame `base`'s anchor. */
function asDense(buf: PixelBuffer, base: Frame, d: number): Frame {
  return { buf, ox: base.ox, oy: base.oy, density: d };
}

/**
 * Place the opaque part of the dense buffer `buf` (density `d`, default 2) in a dense twin of the
 * 1× frame `lo` so that both opaque boxes share their centre (rounded to whole dense px). For
 * art that went through a transform whose output size depends on the density (rotations) and a
 * 1× frame that may have been trimmed by the registry.
 */
export function fitBounds(buf: PixelBuffer, lo: Frame, d: number = HI): Frame {
  const ld = lo.density ?? 1;
  const out = new PixelBuffer((lo.buf.w / ld) * d, (lo.buf.h / ld) * d);
  const t = buf.trimBounds();
  const l = lo.buf.trimBounds();
  if (!t || !l) return asDense(out, lo, d);
  const s = d / ld;
  const cx = (l.x + l.w / 2) * s;
  const cy = (l.y + l.h / 2) * s;
  out.blit(buf.crop(t.x, t.y, t.w, t.h), Math.round(cx - t.w / 2), Math.round(cy - t.h / 2));
  return asDense(out, lo, d);
}

/**
 * Resize a dense buffer to `w × h` LOGICAL px by whole logical px: each output d × d block copies
 * the d × d source block the 1× `resized` picks for that pixel. So a squash keeps or drops the d
 * rows of a logical row together (never one row of an outline or a seam).
 */
function resizedBlocks(src: PixelBuffer, w: number, h: number, d: number): PixelBuffer {
  const sw = src.w / d;
  const sh = src.h / d;
  const out = new PixelBuffer(w * d, h * d);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / w));
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < d; i++) out.data[(y * d + j) * out.w + x * d + i] = src.data[(sy * d + j) * src.w + sx * d + i];
      }
    }
  }
  return out.touch();
}

/** The squashed dense art of `f1`'s box at the size of the 1× squashed frame `base`, NOT outlined. */
function squashedRaw(f1: Frame, f2: PixelBuffer, base: Frame, d: number): PixelBuffer {
  const out = new PixelBuffer(base.buf.w * d, base.buf.h * d);
  const t = f1.buf.trimBounds();
  if (!t) return out;
  const src = f2.crop(t.x * d, t.y * d, t.w * d, t.h * d);
  out.blit(resizedBlocks(src, base.buf.w - 2, base.buf.h - 2, d), d, d);
  // Inner pixels that became outline colour make speckles (the 1× rule, on dense patches).
  return despeckle(out, undefined, d);
}

/**
 * The dense twin of creatures/draw `crushStrip(f1)`: `f2` is the same pose at density d (the 1×
 * frame's rectangle at d), `lo` the registered 1× strip (the geometry each dense frame must
 * match). The squash works in whole logical px, and every frame gets one clean d-px outline at
 * the end (the peel frames are turned before they are outlined).
 */
export function crushStripHi(f1: Frame, f2: Frame, lo: readonly Frame[]): Frame[] {
  const d = f2.density ?? HI;
  const flatRaw = squashedRaw(f1, f2.buf, lo[1], d);
  const half = asDense(outlineHi(squashedRaw(f1, f2.buf, lo[0], d), d), lo[0], d);
  const flat = asDense(outlineHi(flatRaw.clone(), d), lo[1], d);
  const peel = (angle: number, i: number): Frame => fitBounds(outlineHi(flatRaw.rotated(angle, { align: d }).padded(d), d), lo[i], d);
  return [half, flat, fitBounds(flat.buf, lo[2], d), peel(-0.35, 3), peel(0.3, 4), peel(-0.25, 5), peel(0.2, 6)];
}
