import { VIEW_H, VIEW_W } from './render';
import { chooseRes, KMAX } from './render-common';

/**
 * Presents the backbuffer on the visible canvas (docs/ARCHITECTURE.md §3):
 * - The visible canvas fills the window; its backing store matches DEVICE pixels
 *   (devicePixelRatio, ResizeObserver device-pixel box when available), so pixels stay crisp.
 * - The game image uses the largest INTEGER scale s that fits (device px per logical px); if
 *   the window is smaller than 1×, it falls back to the best nearest-neighbour fit. The rest is
 *   a black letterbox.
 * - `resFor(factor)` is the backbuffer resolution the renderer should use for that scale and the
 *   sprite filter's upscale factor (`chooseRes`: s itself up to `kmax`, else the largest k ≤ kmax
 *   that the factor divides), so filtered pixels land where a direct nearest-neighbour scale
 *   would put them. The backbuffer may have any size: present() scales it (nearest neighbour,
 *   any ratio).
 * - Optional scanline overlay (only at scale ≥ 2) and a fullscreen helper.
 */

export interface DisplayOpts {
  /** Start with the scanline overlay on (default false). */
  scanlines?: boolean;
  /** Scanline darkness 0..1 (default 0.22). */
  scanlineStrength?: number;
  /** Logical size (default VIEW_W × VIEW_H). */
  width?: number;
  height?: number;
  /** Highest backbuffer resolution (default KMAX). */
  kmax?: number;
}

export interface Display {
  readonly canvas: HTMLCanvasElement;
  /** Current scale factor in device pixels per game pixel (integer unless the window is tiny). */
  readonly scale: number;
  /** Backbuffer resolution for this scale without a sprite filter (`resFor(1)`). */
  readonly res: number;
  /** Backbuffer resolution for this scale when sprites are upscaled by `factor` (1…kmax). */
  resFor(factor: number): number;
  readonly scanlines: boolean;
  /** Draw the backbuffer (e.g. CanvasRenderer.canvas, any res) scaled into the visible canvas. */
  present(src: CanvasImageSource): void;
  /** Re-measure (also runs automatically on resize / DPR changes). */
  resize(): void;
  setScanlines(on: boolean): void;
  isFullscreen(): boolean;
  toggleFullscreen(): Promise<void>;
  /** Client (CSS) coordinates → game pixels, or null outside the game image. */
  toGame(clientX: number, clientY: number): { x: number; y: number } | null;
  destroy(): void;
}

export function createDisplay(canvas: HTMLCanvasElement, opts: DisplayOpts = {}): Display {
  const gw = opts.width ?? VIEW_W;
  const gh = opts.height ?? VIEW_H;
  const strength = opts.scanlineStrength ?? 0.22;
  const kmax = opts.kmax ?? KMAX;
  const maybeCtx = canvas.getContext('2d', { alpha: false });
  if (!maybeCtx) throw new Error('Canvas 2D is not available');
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // Fill the window; the letterbox is drawn inside the canvas.
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.background = '#000';

  let scale = 1;
  let ox = 0;
  let oy = 0;
  let dw = gw;
  let dh = gh;
  let scan = opts.scanlines === true;
  let scanPattern: CanvasPattern | null = null;
  let devW = 0;
  let devH = 0;
  let dirty = true;

  function layout(w: number, h: number): void {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    devW = w;
    devH = h;
    const s = Math.floor(Math.min(w / gw, h / gh));
    scale = s >= 1 ? s : Math.min(w / gw, h / gh);
    dw = Math.round(gw * scale);
    dh = Math.round(gh * scale);
    ox = Math.floor((w - dw) / 2);
    oy = Math.floor((h - dh) / 2);
    scanPattern = null;
    dirty = true;
  }

  /**
   * Device-pixel size: the ResizeObserver device-pixel box is exact (no blur at fractional
   * DPR), but it is only trusted when it agrees with CSS size × devicePixelRatio (emulated
   * DPR in headless browsers reports CSS pixels there).
   */
  function measure(box?: ResizeObserverSize): void {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    const w = r.width * dpr;
    const h = r.height * dpr;
    if (box && Math.abs(box.inlineSize - w) <= 2 && Math.abs(box.blockSize - h) <= 2) layout(box.inlineSize, box.blockSize);
    else layout(w, h);
  }

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => measure(entries[0]?.devicePixelContentBoxSize?.[0]));
    try {
      ro.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
      ro.observe(canvas);
    }
  }
  const onResize = (): void => measure();
  window.addEventListener('resize', onResize);
  measure();

  function scanlineFill(): CanvasPattern | null {
    if (scanPattern || scale < 2) return scanPattern;
    const s = Math.floor(scale);
    const tile = document.createElement('canvas');
    tile.width = 1;
    tile.height = s;
    const t = tile.getContext('2d');
    if (!t) return null;
    // Darken the last device row of every game row (two rows at large scales).
    t.fillStyle = `rgba(0,0,0,${strength})`;
    t.fillRect(0, s - Math.max(1, Math.floor(s / 4)), 1, Math.max(1, Math.floor(s / 4)));
    scanPattern = ctx.createPattern(tile, 'repeat');
    return scanPattern;
  }

  return {
    canvas,
    get scale() {
      return scale;
    },
    get res() {
      return chooseRes(scale, kmax);
    },
    resFor(factor: number): number {
      return chooseRes(scale, kmax, factor);
    },
    get scanlines() {
      return scan;
    },
    present(src: CanvasImageSource): void {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      if (dirty) {
        ctx.fillRect(0, 0, devW, devH);
        dirty = false;
      } else {
        ctx.fillRect(ox, oy, dw, dh); // a translucent backbuffer must not show the old frame
      }
      const sized = src as { width?: unknown; height?: unknown };
      const sw = typeof sized.width === 'number' && sized.width > 0 ? sized.width : gw;
      const sh = typeof sized.height === 'number' && sized.height > 0 ? sized.height : gh;
      ctx.drawImage(src, 0, 0, sw, sh, ox, oy, dw, dh);
      if (scan) {
        const p = scanlineFill();
        if (p) {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.fillStyle = p;
          ctx.fillRect(0, 0, dw, dh);
          ctx.restore();
        }
      }
    },
    resize: measure,
    setScanlines(on: boolean): void {
      scan = on;
    },
    isFullscreen(): boolean {
      return document.fullscreenElement !== null;
    },
    async toggleFullscreen(): Promise<void> {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch (err) {
        console.warn('[display] fullscreen request failed:', err);
      }
    },
    toGame(clientX: number, clientY: number): { x: number; y: number } | null {
      const r = canvas.getBoundingClientRect();
      const kx = devW / Math.max(1, r.width);
      const ky = devH / Math.max(1, r.height);
      const x = ((clientX - r.left) * kx - ox) / scale;
      const y = ((clientY - r.top) * ky - oy) / scale;
      if (x < 0 || y < 0 || x >= gw || y >= gh) return null;
      return { x: Math.floor(x), y: Math.floor(y) };
    },
    destroy(): void {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
    },
  };
}
