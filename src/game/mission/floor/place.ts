/**
 * Drawing at sub-pixel positions without boxing (docs/ARCHITECTURE.md §2 Hard Rule 7: no allocation
 * on the frame path; docs/design/floor.md §2.1): `r.frame(f, x, y, o)` with a fractional x or y makes
 * V8 box the double for the call. A `FramePlacer` takes the position in its fields (`x`, `y`, world
 * px; screen px with `o.screen`), rounds it exactly as the renderer would (its 1/res grid with the
 * 'all' sub-pixel policy, else whole px) and passes whole numbers, carrying the sub-pixel part in
 * the anchor of ONE reused frame: the pixels land exactly where the plain call puts them. A draw
 * whose shifted anchor would not be exact in floating point (a mirrored one on a backbuffer res that
 * is not a power of two, a frame with a fractional anchor) takes the plain call.
 */
import { PixelBuffer } from '../../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../../engine/render';

/** The frame `put` draws through: a frame's buffer with the draw's sub-pixel part in its anchor. */
interface PlacedFrame {
  buf: PixelBuffer;
  ox: number;
  oy: number;
  density: number;
  pts: Frame['pts'];
}

export class FramePlacer {
  /** Where the next `put` puts the frame's anchor (fields: no double passes through a call). */
  x = 0.5;
  y = 0.5;
  /** Draws that took the plain call (tests). */
  plain = 0;
  private readonly pf: PlacedFrame = { buf: new PixelBuffer(1, 1), ox: 0.5, oy: 0.5, density: 1, pts: undefined };

  /** Draw frame f with its anchor at (x, y), exactly as `r.frame(f, x, y, o)`. */
  put(r: Renderer, f: Frame, o: DrawOpts): void {
    const x = this.x;
    const y = this.y;
    const k = r.res;
    const flipX = o.flipX === true;
    const flipY = o.flipY === true;
    const ax = f.ox * k;
    const ay = f.oy * k;
    if (((flipX || flipY) && (k & (k - 1)) !== 0) || ax !== Math.floor(ax) || ay !== Math.floor(ay)) {
      this.plain++;
      r.frame(f, x, y, o);
      return;
    }
    const fine = o.screen !== true && r.subpixel === 'all';
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const mx = fine ? Math.round(x * k) - X * k : (Math.round(x) - X) * k;
    const my = fine ? Math.round(y * k) - Y * k : (Math.round(y) - Y) * k;
    const p = this.pf;
    p.buf = f.buf;
    p.density = f.density ?? 1;
    p.pts = f.pts;
    p.ox = (flipX ? ax + mx : ax - mx) / k;
    p.oy = (flipY ? ay + my : ay - my) / k;
    r.frame(p, X, Y, o);
  }
}
