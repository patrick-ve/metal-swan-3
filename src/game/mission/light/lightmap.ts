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
 * A light falls off as (1 − d²/r²)² (soft edge, bright core); `addEllipse` is the same over an
 * ellipse (a lamp's pool on the perspective floor, docs/design/floor.md §3.8). Nothing here allocates per frame:
 * the arrays are made once; `begin` clears them, `add` accumulates, `resolve` packs the buffers.
 * Pure and deterministic (no randomness): the same lights give the same pixels.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';

/** The 4 × 4 ordered dither (Bayer) of the lit mask: a px is lit where its light · 16 − ½ exceeds its entry. */
const BAYER4 = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

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

  /**
   * Add an ELLIPTICAL light (a lamp's pool on the perspective floor, docs/design/floor.md §3.8):
   * centre world (x, y), radii rx, ry, the falloff (1 − q)² of q = (dx/rx)² + (dy/ry)². Cells above
   * world y `yMin` get none, fading in over 3 px below it (the pool stays on the floor).
   */
  addEllipse(x: number, y: number, rx: number, ry: number, intensity: number, color: Color, glow: number, yMin = -Infinity): void {
    if (rx <= 0.5 || ry <= 0.5 || intensity <= 0) return;
    const cx = x - this.ox;
    const cy = y - this.oy;
    const top = yMin - this.oy;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry), Math.floor(top));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    if (x1 < x0 || y1 < y0) return;
    this.count++;
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
    const L = this.L;
    const R = this.R;
    const G = this.G;
    const B = this.B;
    const w = this.w;
    const irx = 1 / rx;
    const iry = 1 / ry;
    for (let py = y0; py <= y1; py++) {
      const yc = py + 0.5;
      const ey = (yc - cy) * iry;
      const ey2 = ey * ey;
      if (ey2 >= 1) continue;
      const fade = yc - top >= 3 ? 1 : Math.max(0, (yc - top) / 3);
      if (fade <= 0) continue;
      const half = Math.sqrt(1 - ey2) * rx;
      const a = Math.max(x0, Math.ceil(cx - half - 0.5));
      const b = Math.min(x1, Math.floor(cx + half - 0.5));
      const row = py * w;
      for (let px = a; px <= b; px++) {
        const ex = (px + 0.5 - cx) * irx;
        const q = 1 - (ex * ex + ey2);
        if (q <= 0) continue;
        const f = q * q * fade;
        const i = row + px;
        L[i] += f * intensity;
        if (g > 0) {
          R[i] += f * cr;
          G[i] += f * cg;
          B[i] += f * cb;
        }
      }
    }
  }

  /**
   * Add a CONE of light (a flashlight; docs/design/sewers.md §5.1): apex at world (x, y), axis
   * `angle` (radians, y down), radius `len`, half-angle `half` (< 90°). Inside the cone the light is
   * `intensity`; the rim has two dithered bands of `band` radians each (the outer one lights 1 cell
   * in 4, the inner one 1 in 2, on a world-anchored pattern, so it does not crawl with the camera);
   * the last `fade` share of the length fades out smoothly. `glow` of `color` is added on top. Each
   * row is scanned only between the cone's two edges (no per-cell trigonometry).
   */
  addCone(x: number, y: number, angle: number, len: number, half: number, intensity: number, color: Color, glow: number, band = 0, fade = 0): void {
    if (len <= 0.5 || intensity <= 0 || half <= 0) return;
    const cx = x - this.ox;
    const cy = y - this.oy;
    const x0 = Math.max(0, Math.floor(cx - len));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + len));
    const y0 = Math.max(0, Math.floor(cy - len));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + len));
    if (x1 < x0 || y1 < y0) return;
    this.count++;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    // Inward normals of the two edges: n1·d ≥ 0 and n2·d ≥ 0 inside.
    const n1x = Math.sin(angle + half);
    const n1y = -Math.cos(angle + half);
    const n2x = -Math.sin(angle - half);
    const n2y = Math.cos(angle - half);
    const tOut = Math.tan(half);
    const tMid = band > 0 ? Math.tan(Math.max(0, half - band)) : tOut;
    const tIn = band > 0 ? Math.tan(Math.max(0, half - 2 * band)) : tOut;
    const len2 = len * len;
    const fadeFrom = fade > 0 ? 1 - fade : 1;
    const invFade = fade > 0 ? 1 / fade : 0;
    const invLen = 1 / len;
    // Cells nearer than the fade's start (squared) skip the square root.
    const fade2 = fadeFrom * fadeFrom * len2;
    const g = glow > 0 ? glow * intensity : 0;
    const cr = (((color >>> 24) & 255) / 255) * g;
    const cg = (((color >>> 16) & 255) / 255) * g;
    const cb = (((color >>> 8) & 255) / 255) * g;
    const L = this.L;
    const R = this.R;
    const G = this.G;
    const B = this.B;
    const w = this.w;
    const ox = this.ox;
    const oy = this.oy;
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - cy;
      const dy2 = dy * dy;
      if (dy2 > len2) continue;
      // The disk's span of this row, then each edge's half-plane.
      const r = Math.sqrt(len2 - dy2);
      let lo = -r;
      let hi = r;
      if (n1x > 1e-9) lo = Math.max(lo, (-n1y * dy) / n1x);
      else if (n1x < -1e-9) hi = Math.min(hi, (-n1y * dy) / n1x);
      else if (n1y * dy < 0) continue;
      if (n2x > 1e-9) lo = Math.max(lo, (-n2y * dy) / n2x);
      else if (n2x < -1e-9) hi = Math.min(hi, (-n2y * dy) / n2x);
      else if (n2y * dy < 0) continue;
      const a = Math.max(x0, Math.ceil(cx + lo - 0.5));
      const b = Math.min(x1, Math.floor(cx + hi - 0.5));
      if (b < a) continue;
      const row = py * w;
      const wy = py + oy;
      for (let px = a; px <= b; px++) {
        const dx = px + 0.5 - cx;
        const along = dx * ca + dy * sa;
        if (along <= 0) continue;
        const perp = Math.abs(dy * ca - dx * sa);
        let f = 1;
        if (perp > along * tIn) {
          // The rim: the inner band lights every other cell, the outer band one cell in four.
          const wx = px + ox;
          if (perp > along * tMid) {
            if (perp > along * tOut || ((wx | wy) & 1) !== 0) continue;
          } else if (((wx + wy) & 1) !== 0) continue;
        }
        const d2 = dx * dx + dy2;
        if (invFade > 0 && d2 > fade2) {
          const k = (1 - Math.sqrt(d2) * invLen) * invFade;
          if (k <= 0) continue;
          f = k * k * (3 - 2 * k);
        }
        const i = row + px;
        L[i] += f * intensity;
        if (g > 0) {
          R[i] += f * cr;
          G[i] += f * cg;
          B[i] += f * cb;
        }
      }
      if (g > 0) {
        if (a < this.gx0) this.gx0 = a;
        if (b > this.gx1) this.gx1 = b;
        if (py < this.gy0) this.gy0 = py;
        if (py > this.gy1) this.gy1 = py;
      }
    }
  }

  /**
   * SEWERS (docs/api/canal.md "A lit section"): the LIT MASK of the light summed so far, at density
   * d (mask px per cell; `out` is (w·d) × (h·d)), in the cell box [x0, x1) × [y0, y1) only: a mask
   * px is opaque white where its cell's light L ≥ 1, or where L passes the 4 × 4 ordered dither of
   * its world px (world-anchored: the pattern does not crawl with the camera), else left as it is
   * (the caller clears). Returns the number of cells with any light.
   */
  maskInto(out: PixelBuffer, d: number, x0: number, y0: number, x1: number, y1: number): number {
    const L = this.L;
    const w = this.w;
    const ow = out.w;
    const o = out.data;
    // Opaque white as a small integer (stored as 0xffffffff): a double takes the slow store path.
    // Each px of a cell is written by that cell only, branch-free (the dither is a coin toss per px).
    let lit = 0;
    const cx0 = Math.max(0, x0);
    const cx1 = Math.min(w, x1);
    const ox = this.ox;
    for (let cy = Math.max(0, y0), ey = Math.min(this.h, y1); cy < ey; cy++) {
      const row = cy * w;
      const wy = (this.oy + cy) * d;
      const top = cy * d * ow;
      if (d === 2) {
        // The common case (the lit layers' tier): four px a cell, no loops.
        const b0 = (wy & 3) << 2;
        const b1 = ((wy + 1) & 3) << 2;
        for (let cx = cx0; cx < cx1; cx++) {
          const l = L[row + cx];
          if (l <= 0) continue;
          lit++;
          const r0 = top + cx * 2;
          const r1 = r0 + ow;
          const t = l >= 1 ? 16 : l * 16 - 0.5;
          const wx = (ox + cx) * 2;
          const i0 = wx & 3;
          const i1 = (wx + 1) & 3;
          o[r0] = 0 - +(BAYER4[b0 | i0] < t);
          o[r0 + 1] = 0 - +(BAYER4[b0 | i1] < t);
          o[r1] = 0 - +(BAYER4[b1 | i0] < t);
          o[r1 + 1] = 0 - +(BAYER4[b1 | i1] < t);
        }
        continue;
      }
      for (let cx = cx0; cx < cx1; cx++) {
        const l = L[row + cx];
        if (l <= 0) continue;
        lit++;
        const t = l >= 1 ? 16 : l * 16 - 0.5;
        const wx = (ox + cx) * d;
        const X = top + cx * d;
        for (let sy = 0; sy < d; sy++) {
          const r = X + sy * ow;
          const b = ((wy + sy) & 3) << 2;
          for (let sx = 0; sx < d; sx++) o[r + sx] = 0 - +(BAYER4[b | ((wx + sx) & 3)] < t);
        }
      }
    }
    return lit;
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
    // An unlit cell (most of them) is the full darkness: the same value as the formula gives at L = 0.
    const none = (rgb | Math.round(a255)) >>> 0;
    for (let i = 0; i < n; i++) {
      const l = L[i];
      if (l === 0) {
        out[i] = none;
        continue;
      }
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
