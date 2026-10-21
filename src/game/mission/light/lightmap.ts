/**
 * The light map of the mission light pass (docs/design/oldenzaal.md §10.2; docs/api/oldenzaal.md
 * §3): two reused buffers the size of the view (+1 px for a sub-pixel camera), recomputed every
 * drawn frame at 1 logical px per cell:
 *
 * - `dark`: the darkness overlay (normal blend). Every cell is the darkness colour at alpha
 *   `darkness · (1 − min(1, L))`, where L is the summed light of the cell. Lights cut holes.
 * - `glow`: the coloured light (additive blend). Every cell adds the summed colour of the lights
 *   that reach it (`glow` share of each light), so lamps and candles tint and brighten their pool.
 *
 * A light falls off as (1 − d²/r²)² (soft edge, bright core). Nothing here allocates per frame:
 * the arrays are made once; `begin` clears them, `add` accumulates, `resolve` packs the buffers.
 * Pure and deterministic (no randomness): the same lights give the same pixels.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';

export class LightMap {
  readonly w: number;
  readonly h: number;
  /** World px of the map's top-left cell (set by `begin`). */
  ox = 0;
  oy = 0;
  readonly dark: PixelBuffer;
  readonly glow: PixelBuffer;
  /** Summed light per cell (0 = none, ≥ 1 = fully lit). */
  private readonly L: Float32Array;
  /** Summed glow colour per cell (0..1 per channel, may exceed 1; clamped when packed). */
  private readonly R: Float32Array;
  private readonly G: Float32Array;
  private readonly B: Float32Array;
  /** Bounding box of the cells any light touched this frame (glow resolve only scans it). */
  private gx0 = 0;
  private gy0 = 0;
  private gx1 = -1;
  private gy1 = -1;
  /** Lights added this frame (debug / tests). */
  count = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.dark = new PixelBuffer(w, h);
    this.glow = new PixelBuffer(w, h);
    const n = w * h;
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
    this.G = new Float32Array(n);
    this.B = new Float32Array(n);
  }

  /** Start a frame with the map's top-left at world (ox, oy). */
  begin(ox: number, oy: number): void {
    this.ox = ox;
    this.oy = oy;
    this.L.fill(0);
    if (this.gx1 >= this.gx0) {
      // Only the glow box of the last frame holds colour.
      const w = this.w;
      for (let y = this.gy0; y <= this.gy1; y++) {
        const a = y * w + this.gx0;
        const b = y * w + this.gx1 + 1;
        this.R.fill(0, a, b);
        this.G.fill(0, a, b);
        this.B.fill(0, a, b);
      }
    }
    this.gx0 = this.w;
    this.gy0 = this.h;
    this.gx1 = -1;
    this.gy1 = -1;
    this.count = 0;
  }

  /**
   * Add a light at world (x, y), radius r (logical px), strength `intensity` (0..1+) that cuts
   * the darkness, and `glow` (0..1) of its colour `color` added on top. Off-map lights cost
   * nothing.
   */
  add(x: number, y: number, r: number, intensity: number, color: Color, glow: number): void {
    if (r <= 0.5 || intensity <= 0) return;
    const cx = x - this.ox;
    const cy = y - this.oy;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    this.count++;
    const inv = 1 / (r * r);
    const L = this.L;
    const w = this.w;
    const g = glow > 0 ? glow * intensity : 0;
    const cr = (((color >>> 24) & 255) / 255) * g;
    const cg = (((color >>> 16) & 255) / 255) * g;
    const cb = (((color >>> 8) & 255) / 255) * g;
    if (g > 0) {
      if (x0 < this.gx0) this.gx0 = x0;
      if (y0 < this.gy0) this.gy0 = y0;
      if (x1 > this.gx1) this.gx1 = x1;
      if (y1 > this.gy1) this.gy1 = y1;
    }
    const R = this.R;
    const G = this.G;
    const B = this.B;
    const r2 = r * r;
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - cy;
      const dy2 = dy * dy;
      if (dy2 >= r2) continue;
      // Only the cells of this row inside the circle.
      const half = Math.sqrt(r2 - dy2);
      const a = Math.max(x0, Math.ceil(cx - half - 0.5));
      const b = Math.min(x1, Math.floor(cx + half - 0.5));
      const row = py * w;
      if (g > 0) {
        for (let px = a; px <= b; px++) {
          const dx = px + 0.5 - cx;
          const q = 1 - (dx * dx + dy2) * inv;
          if (q <= 0) continue;
          const f = q * q;
          const i = row + px;
          L[i] += f * intensity;
          R[i] += f * cr;
          G[i] += f * cg;
          B[i] += f * cb;
        }
      } else {
        for (let px = a; px <= b; px++) {
          const dx = px + 0.5 - cx;
          const q = 1 - (dx * dx + dy2) * inv;
          if (q > 0) L[row + px] += q * q * intensity;
        }
      }
    }
  }

  /** Summed light of the cell at world (x, y) (tests; 0 off the map). */
  lightAt(x: number, y: number): number {
    const px = Math.floor(x - this.ox);
    const py = Math.floor(y - this.oy);
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return 0;
    return this.L[py * this.w + px];
  }

  /**
   * Pack the buffers: `dark` = `tint` at alpha darkness · (1 − min(1, L)); `glow` = the summed
   * colours (alpha = the brightest channel, colour normalised). Returns whether `glow` holds any
   * light (the caller skips drawing it when false). Both buffers are touched (their version
   * changes) so a renderer refreshes them.
   */
  resolve(tint: Color, darkness: number): boolean {
    const n = this.w * this.h;
    const L = this.L;
    const out = this.dark.data;
    const rgb = (tint & 0xffffff00) >>> 0;
    const a255 = Math.max(0, Math.min(1, darkness)) * 255;
    for (let i = 0; i < n; i++) {
      const l = L[i];
      const a = l >= 1 ? 0 : Math.round(a255 * (1 - l));
      out[i] = (rgb | a) >>> 0;
    }
    this.dark.touch();
    const gd = this.glow.data;
    gd.fill(0);
    let any = false;
    if (this.gx1 >= this.gx0) {
      const w = this.w;
      const R = this.R;
      const G = this.G;
      const B = this.B;
      for (let y = this.gy0; y <= this.gy1; y++) {
        for (let x = this.gx0; x <= this.gx1; x++) {
          const i = y * w + x;
          const r = R[i];
          const g = G[i];
          const b = B[i];
          const m = r > g ? (r > b ? r : b) : g > b ? g : b;
          if (m < 0.004) continue;
          const k = 255 / m;
          const a = m >= 1 ? 255 : Math.round(m * 255);
          gd[i] = ((Math.round(r * k) << 24) | (Math.round(g * k) << 16) | (Math.round(b * k) << 8) | a) >>> 0;
          any = true;
        }
      }
    }
    this.glow.touch();
    return any;
  }
}
