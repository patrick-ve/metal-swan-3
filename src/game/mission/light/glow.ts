/**
 * THE SMOOTH GLOW of the light pass (docs/design/oat.md §8.9 "smoothed glow at 2× / 4×", §8.13
 * "Night: round glows"; docs/api/oat.md "LIGHT-WATER"). Owner: LIGHT-WATER. An OPT-IN of a section's
 * light (`SectionLight.glow: 'smooth'`), used at res ≥ 2 only (1× stays the light map, per pixel).
 *
 * The darkness keeps the classic 1× light map (lights cut it; a soft alpha ramp, so its 1× cells do
 * not show), but the COLOURED glow of every lamp, pool, entity light, flash and streak dash is drawn
 * as a dense additive frame at the art density (a round (1 − d²/r²)² disc or ellipse of the light's
 * colour), so a glow is round at 2× and 4× instead of 4 × 4 blocks — and costs one frame draw per
 * light instead of a dense per-cell map (spec §8.12: the light pass ≤ 0.2 ms).
 *
 * The frames are cached per colour, radius (½ px buckets) and density, made on first use; a frame's
 * draws are queued in preallocated arrays (`circle`, `ellipse`) and drawn by `flush` after the
 * darkness. Nothing allocates per frame once the frames exist.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import type { DrawOpts, Frame, Renderer, SrcRect } from '../../../engine/render';
import { FramePlacer } from '../floor/place';

/** At most this many glows per frame (the rest are dropped: fail soft). */
export const GLOW_CAP = 512;

/** The dense glow frames of one pass and this frame's queue. */
export class GlowFrames {
  private readonly cache = new Map<Color, Map<number, Frame>>();
  private n = 0;
  private readonly qx = new Float64Array(GLOW_CAP);
  private readonly qy = new Float64Array(GLOW_CAP);
  private readonly qa = new Float64Array(GLOW_CAP);
  /** Rows of the frame's top to leave out (a pool kept below the floor's back edge), logical px. */
  private readonly qcut = new Float64Array(GLOW_CAP);
  private readonly qf: (Frame | null)[] = new Array<Frame | null>(GLOW_CAP).fill(null);
  private readonly src: SrcRect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly opts: DrawOpts = { blend: 'add', alpha: 1 };
  private readonly cutOpts: DrawOpts = { blend: 'add', alpha: 1, src: this.src };
  private readonly placer = new FramePlacer();
  /** Glows drawn by the last `flush` (tests / debug). */
  drawn = 0;

  /** Start a frame's queue. */
  begin(): void {
    this.n = 0;
  }

  /** Queue a round glow at world (x, y), radius r (logical px), colour `color` at strength `alpha` (0..1+). */
  circle(x: number, y: number, r: number, color: Color, alpha: number, d: number): void {
    this.ellipse(x, y, r, r, color, alpha, d);
  }

  /**
   * Queue an elliptical glow (a pool on the floor, a streak dash) at world (x, y), radii rx, ry; rows
   * above world y `yMin` are left out (the pool stays on the floor).
   */
  ellipse(x: number, y: number, rx: number, ry: number, color: Color, alpha: number, d: number, yMin = -Infinity): void {
    if (alpha <= 0.004 || rx <= 0.5 || ry <= 0.5 || this.n >= GLOW_CAP) return;
    const f = this.frame(rx, ry, color, d);
    const top = y - f.oy;
    const cut = yMin > top ? yMin - top : 0;
    if (cut >= f.buf.h / (f.density ?? 1)) return;
    const i = this.n++;
    this.qx[i] = x;
    this.qy[i] = y;
    this.qa[i] = alpha;
    this.qcut[i] = cut;
    this.qf[i] = f;
  }

  /** Glows queued this frame. */
  get queued(): number {
    return this.n;
  }

  /** Draw the queue additively (world space through `r`'s camera). */
  flush(r: Renderer): void {
    this.drawn = 0;
    const pl = this.placer;
    for (let i = 0; i < this.n; i++) {
      const f = this.qf[i] as Frame;
      const cut = this.qcut[i];
      pl.x = this.qx[i];
      pl.y = this.qy[i];
      if (cut > 0) {
        const fd = f.density ?? 1;
        const src = this.src;
        src.x = 0;
        src.y = Math.ceil(cut);
        src.w = f.buf.w / fd;
        src.h = f.buf.h / fd - src.y;
        this.cutOpts.alpha = Math.min(1, this.qa[i]);
        pl.put(r, f, this.cutOpts);
      } else {
        this.opts.alpha = Math.min(1, this.qa[i]);
        pl.put(r, f, this.opts);
      }
      this.drawn++;
    }
    this.n = 0;
  }

  /** The cached frame of a glow (made once): the colour at alpha (1 − q)², q = (dx/rx)² + (dy/ry)². */
  private frame(rx: number, ry: number, color: Color, d: number): Frame {
    const hx = Math.max(1, Math.round(rx * 2));
    const hy = Math.max(1, Math.round(ry * 2));
    const key = (hx * 4096 + hy) * 8 + d;
    let byColor = this.cache.get(color);
    if (!byColor) {
      byColor = new Map();
      this.cache.set(color, byColor);
    }
    const have = byColor.get(key);
    if (have) return have;
    const RX = hx / 2;
    const RY = hy / 2;
    const wl = Math.ceil(RX) * 2;
    const hl = Math.ceil(RY) * 2;
    const W = wl * d;
    const H = hl * d;
    const b = new PixelBuffer(W, H);
    const rgb = (color & 0xffffff00) >>> 0;
    for (let Y = 0; Y < H; Y++) {
      const dy = ((Y + 0.5) / d - hl / 2) / RY;
      for (let X = 0; X < W; X++) {
        const dx = ((X + 0.5) / d - wl / 2) / RX;
        const q = 1 - (dx * dx + dy * dy);
        if (q <= 0) continue;
        const a = Math.round(q * q * 255);
        if (a > 0) b.data[Y * W + X] = (rgb | a) >>> 0;
      }
    }
    b.touch();
    const f: Frame = { buf: b, ox: wl / 2, oy: hl / 2, density: d };
    byColor.set(key, f);
    return f;
  }

  /** Bytes of the cached frames (accounting / tests). */
  get bytes(): number {
    let n = 0;
    for (const m of this.cache.values()) for (const f of m.values()) n += f.buf.data.byteLength;
    return n;
  }
}
