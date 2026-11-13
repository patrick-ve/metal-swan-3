/**
 * THE LIT MASK (mission sewers, docs/design/sewers.md §5.1 "Art (L5)", docs/api/canal.md "A lit
 * section"): where the heroes' flashlights show the LIT stack of a canal scene over its ambient one.
 * The light pass sums the heroes' lights into its light map (the cones with their dithered rims and
 * faded ends, `LightMap.addCone`; the spill round the muzzle; the hero glow), then this mask turns
 * that light into opaque / clear px at the canal's draw density d (`LightMap.maskInto`: a cell with
 * light ≥ 1 is opaque, a weaker one an ordered dither of its world px). `CanalView` draws the lit
 * stack's layers into the renderer's layer, keeps them where this mask is opaque (`layerMask`) and
 * draws them over the ambient layers.
 *
 * One reused buffer per density (made on first use), cleared and refilled in the box of the lit
 * cells only; no allocation per frame.
 */
import { PixelBuffer } from '../../../engine/pixel';
import type { SrcRect } from '../../../engine/render';
import type { LightMap } from './lightmap';

export class LitMask {
  /** Mask px per logical px (the canal's draw density). */
  readonly d: number;
  /** (map.w · d) × (map.h · d), alpha 0 / 255; world space with its top-left at (x, y). */
  readonly buf: PixelBuffer;
  x = 0;
  y = 0;
  /** The lit part, logical SCREEN px (the renderer's layer box): empty when nothing is lit. */
  readonly box: SrcRect = { x: 0, y: 0, w: 0, h: 0 };
  /** The mask px that changed this frame (this box and the last one, mask px): the renderer's upload. */
  readonly dirty: SrcRect = { x: 0, y: 0, w: 0, h: 0 };
  /** Cells with any light this frame. */
  cells = 0;
  /** The cell box filled last (x0, y0, x1, y1). */
  private readonly last = new Int32Array(4);

  constructor(w: number, h: number, d: number) {
    this.d = d;
    this.buf = new PixelBuffer(w * d, h * d);
  }

  /**
   * The same mask as last time at camera (camX, camY) (the heroes' lights did not change): only the
   * screen box moves; nothing changed (`dirty` empty, the buffer's version kept). Returns whether any
   * px is lit.
   */
  reuse(camX: number, camY: number): boolean {
    const l = this.last;
    this.box.x = this.x + l[0] - camX;
    this.box.y = this.y + l[1] - camY;
    this.dirty.w = 0;
    this.dirty.h = 0;
    return this.cells > 0;
  }

  /**
   * Refill from `map` (its light so far) in the cell box [x0, x1) × [y0, y1); camX, camY: the
   * renderer's camera (the screen box). Returns whether any px is lit.
   */
  build(map: LightMap, x0: number, y0: number, x1: number, y1: number, camX: number, camY: number): boolean {
    const d = this.d;
    const b = this.buf;
    const W = b.w;
    const l = this.last;
    // Clear what the last frame lit.
    for (let y = l[1] * d, ey = l[3] * d; y < ey; y++) b.data.fill(0, y * W + l[0] * d, y * W + l[2] * d);
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(map.w, x1);
    y1 = Math.min(map.h, y1);
    if (x1 <= x0 || y1 <= y0) {
      x0 = y0 = x1 = y1 = 0;
      this.cells = 0;
    } else this.cells = map.maskInto(b, d, x0, y0, x1, y1);
    // The changed px: the union of the last box and this one (an empty box adds nothing).
    const lastOn = l[2] > l[0] && l[3] > l[1];
    const nowOn = x1 > x0 && y1 > y0;
    const dx0 = lastOn && nowOn ? Math.min(l[0], x0) : lastOn ? l[0] : x0;
    const dy0 = lastOn && nowOn ? Math.min(l[1], y0) : lastOn ? l[1] : y0;
    const dx1 = lastOn && nowOn ? Math.max(l[2], x1) : lastOn ? l[2] : x1;
    const dy1 = lastOn && nowOn ? Math.max(l[3], y1) : lastOn ? l[3] : y1;
    const dt = this.dirty;
    dt.x = dx0 * d;
    dt.y = dy0 * d;
    dt.w = Math.max(0, dx1 - dx0) * d;
    dt.h = Math.max(0, dy1 - dy0) * d;
    l[0] = x0;
    l[1] = y0;
    l[2] = x1;
    l[3] = y1;
    this.x = map.ox;
    this.y = map.oy;
    const bx = this.box;
    bx.x = map.ox + x0 - camX;
    bx.y = map.oy + y0 - camY;
    bx.w = this.cells > 0 ? x1 - x0 : 0;
    bx.h = this.cells > 0 ? y1 - y0 : 0;
    b.touch();
    return this.cells > 0;
  }
}
