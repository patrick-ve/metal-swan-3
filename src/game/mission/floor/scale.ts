/**
 * Scaling a frame once (docs/design/floor.md §3.6: prop rows are scaled ONCE per row, never per
 * frame): an area-weighted (box) resample of a frame of any density into a frame of density `d`
 * whose logical size is the source's times `scale`. Colours are averaged with their alpha
 * (premultiplied), so the edge of a scaled prop stays clean. The anchor is scaled and put on the
 * output's pixel grid; points are scaled.
 *
 * A big frame scales in slices (`ScaleJob`: rows `j0 … j1` of the output per call), so the browser
 * spreads it over art jobs of a few ms (spec §2.6: no frame of play scales a prop at once).
 */
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { frameH, frameW } from '../../../engine/render';

/** About this many source texel reads per scaling slice (a few ms). */
export const SCALE_SLICE_READS = 120_000;

/** One frame being scaled: its output and the mapping; `rows` paints a band of output rows. */
export class ScaleJob {
  readonly out: PixelBuffer;
  /** Output rows per slice (about SCALE_SLICE_READS source reads each). */
  readonly sliceRows: number;
  private readonly src: Frame;
  private readonly scale: number;
  private readonly d: number;
  private readonly ax: number;
  private readonly ay: number;
  private readonly k: number;
  private readonly sx0: number;
  private readonly sy0: number;

  constructor(src: Frame, scale: number, d: number) {
    const sd = src.density ?? 1;
    const lw = frameW(src) * scale;
    const lh = frameH(src) * scale;
    // The anchor on the output grid (buffer px), the buffer around it.
    this.ax = Math.round(src.ox * scale * d);
    this.ay = Math.round(src.oy * scale * d);
    // Whole logical px (a dense frame's buffer is a multiple of its density).
    const W = Math.max(1, Math.ceil(lw - 1e-6)) * d;
    const H = Math.max(1, Math.ceil(lh - 1e-6)) * d;
    this.out = new PixelBuffer(W, H);
    this.src = src;
    this.scale = scale;
    this.d = d;
    // Output px i covers source buffer x from (i − ax)/(d·scale)·sd + ox·sd, width k = sd/(d·scale).
    this.k = sd / (d * scale);
    this.sx0 = src.ox * sd - this.ax * this.k;
    this.sy0 = src.oy * sd - this.ay * this.k;
    const reads = W * Math.max(1, Math.ceil(this.k + 1) ** 2);
    this.sliceRows = Math.max(1, Math.floor(SCALE_SLICE_READS / reads));
  }

  /** Paint output rows [j0, j1). */
  rows(j0: number, j1: number): void {
    const out = this.out;
    const W = out.w;
    const sb = this.src.buf;
    const sw = sb.w;
    const sh = sb.h;
    const k = this.k;
    const sx0 = this.sx0;
    const sy0 = this.sy0;
    const end = Math.min(out.h, j1);
    for (let j = j0; j < end; j++) {
      const ya = sy0 + j * k;
      const yb = ya + k;
      const y0 = Math.max(0, Math.floor(ya));
      const y1 = Math.min(sh, Math.ceil(yb));
      for (let i = 0; i < W; i++) {
        const xa = sx0 + i * k;
        const xb = xa + k;
        const x0 = Math.max(0, Math.floor(xa));
        const x1 = Math.min(sw, Math.ceil(xb));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let y = y0; y < y1; y++) {
          const cy = Math.min(yb, y + 1) - Math.max(ya, y);
          if (cy <= 0) continue;
          for (let x = x0; x < x1; x++) {
            const cx = Math.min(xb, x + 1) - Math.max(xa, x);
            if (cx <= 0) continue;
            const c = sb.data[y * sw + x];
            const ca = (c & 255) * cx * cy;
            if (ca === 0) continue;
            r += (c >>> 24) * ca;
            g += ((c >>> 16) & 255) * ca;
            b += ((c >>> 8) & 255) * ca;
            a += ca;
          }
        }
        if (a <= 0) continue;
        const area = k * k;
        const alpha = Math.round(a / area);
        if (alpha < 8) continue;
        out.data[j * W + i] = ((Math.round(r / a) << 24) | (Math.round(g / a) << 16) | (Math.round(b / a) << 8) | Math.min(255, alpha)) >>> 0;
      }
    }
  }

  /** The finished frame (after every row was painted). */
  frame(): Frame {
    this.out.touch();
    let pts: Record<string, [number, number]> | undefined;
    const src = this.src;
    if (src.pts) {
      pts = {};
      for (const [name, [px, py]] of Object.entries(src.pts)) pts[name] = [px * this.scale, py * this.scale];
    }
    return { buf: this.out, ox: this.ax / this.d, oy: this.ay / this.d, density: this.d, ...(pts ? { pts } : {}) };
  }
}

export function scaleFrame(src: Frame, scale: number, d: number): Frame {
  const job = new ScaleJob(src, scale, d);
  job.rows(0, job.out.h);
  return job.frame();
}
