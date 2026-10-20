/**
 * Frame helpers for dense art at any density (docs/ART_GUIDE.md "2x art (mission ams)"): turns
 * and outlines that keep a dense frame on its 1× frame's logical geometry.
 *
 * - `outlineHi`: an INK outline `n` art px wide on the footprint of a 1× outline.
 * - `asHi` / `fitHi`: a 2× buffer as the twin of a 1× frame (same anchor; centred and cropped).
 * - `turnFrame` / `turnHi`: quarter turns and free turns with the anchor in LOGICAL px.
 *
 * The hand-drawn 2× pen and part composer (`HiPen`, `HiSketch`) and the 2× effect twins
 * (`liftHi`, `squashedHi`) were retired in the UHD wave: the HD kit (src/game/art/hd/) draws every
 * dense frame natively. Everything stays deterministic and palette-only.
 */
import type { Color } from '../../engine/color';
import { INK } from '../../engine/palette';
import type { PixelBuffer } from '../../engine/pixel';
import type { Frame } from '../../engine/render';

/** Buffer pixels per logical pixel of 2× art. */
export const HI = 2;

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
