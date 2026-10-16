import type { Color } from './color';
import type { PixelBuffer } from './pixel';
import type { SubpixelMode } from './render-common';
import type { UpscaleMode } from './upscale';

/**
 * Shared rendering contract (docs/ARCHITECTURE.md §5.5), pre-written by the orchestrator.
 * Implementations: render-canvas.browser.ts (Canvas 2D) and render-soft.ts (pure TS, headless).
 * The media-core agent owns this file: extend it freely, but do not rename or remove members —
 * the simulation side codes against them in parallel.
 */

/** Logical view size in pixels (docs/ARCHITECTURE.md §3). */
export const VIEW_W = 384;
export const VIEW_H = 216;

export type { SubpixelMode, UpscaleMode };

/**
 * One sprite frame. Drawing it at (x, y) puts its anchor (ox, oy) on (x, y).
 * Positions are rounded with Math.round (to 1/res with sub-pixel 'all'); flipping mirrors around
 * the anchor pixel (see render-common.ts), so a point at +dx moves to −dx. Anchors and points are
 * always in logical (1×) pixels, whatever the backbuffer resolution and the frame's density.
 *
 * `density` d (default 1) is the number of buffer pixels per logical pixel: a 2× ("hi") frame has
 * d = 2 and a buffer of (2·w) × (2·h) pixels for a logical w × h frame. Its logical size is
 * `frameW(f)` × `frameH(f)`; read those (never `buf.w` / `buf.h`) outside art code. Drawing covers
 * the same logical rectangle at any density (docs/ARCHITECTURE.md §3).
 */
export interface Frame {
  readonly buf: PixelBuffer;
  readonly ox: number;
  readonly oy: number;
  /** Named attachment points relative to the anchor of the unflipped frame (flip negates x). */
  readonly pts?: Readonly<Record<string, readonly [number, number]>>;
  /** Buffer pixels per logical pixel (integer ≥ 1, default 1; 2 for 2× art). */
  readonly density?: number;
}

/** Buffer pixels per logical pixel of a frame (1 unless it is 2× art). */
export function frameDensity(f: Frame): number {
  return f.density ?? 1;
}

/** Logical width of a frame (its buffer width at density 1). */
export function frameW(f: Frame): number {
  return f.density === undefined || f.density === 1 ? f.buf.w : f.buf.w / f.density;
}

/** Logical height of a frame (its buffer height at density 1). */
export function frameH(f: Frame): number {
  return f.density === undefined || f.density === 1 ? f.buf.h : f.buf.h / f.density;
}

/** A rectangle in buffer pixels (for a frame of density d > 1: in logical pixels, see `DrawOpts.src`). */
export interface SrcRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DrawOpts {
  flipX?: boolean;
  flipY?: boolean;
  /** Draw as a solid white silhouette (hit flash). */
  flash?: boolean;
  /**
   * Draw as a solid silhouette of this colour (keeps each pixel's alpha); overrides `flash`.
   * For a coloured flash, draw the sprite, then again with `tint` and `alpha` 0.3–0.6.
   */
  tint?: Color;
  /** 0..1, default 1. */
  alpha?: number;
  /** Screen space: ignore the camera (HUD, overlays). */
  screen?: boolean;
  blend?: 'normal' | 'add';
  /**
   * Draw only this part of the image (in unflipped buffer pixels). The part lands exactly where
   * it would be in the whole drawing — use it for slices (heat haze), partial reveals, bars.
   * For a frame of density d > 1 the rectangle is in LOGICAL pixels of the frame (0..frameW,
   * 0..frameH), so the same slice code works for 1× and 2× art; buffer pixels and logical pixels
   * are the same thing at density 1, so older callers stay correct.
   */
  src?: SrcRect;
  /**
   * Contents change most frames (the first-person view, a full-screen effect buffer): never
   * cached as a texture. The canvas renderer keeps one streaming slot per buffer (one canvas and
   * one ImageData, refilled in place when the buffer's `version` changes), outside the texture
   * budget, dropped after 120 frames without use. It applies to plain `image()` / `frame()` draws
   * (no `tint`, `flash`, `flipX`, `flipY` or `src`, no sprite filter, density ≤ res); any other
   * draw ignores the flag and uses the texture cache. Pixels are identical either way; the
   * software renderer ignores the flag.
   */
  stream?: boolean;
}

export type FontId = 'small' | 'big';

export interface TextOpts {
  font?: FontId;
  color?: Color;
  align?: 'left' | 'center' | 'right';
  /** Text is screen-space by default; pass false for world-space text. */
  screen?: boolean;
  shadow?: Color;
  outline?: Color;
  alpha?: number;
  /** Integer scale (default 1): like drawing at 1× and enlarging, outline and shadow included. */
  scale?: number;
}

export interface ParallaxOpts {
  /** Tile the layer horizontally (default true). */
  repeatX?: boolean;
  repeatY?: boolean;
  alpha?: number;
  /**
   * Buffer pixels per logical pixel of the layer (integer ≥ 1, default 1). A 2× layer (density 2,
   * buffer (2·w) × (2·h)) covers and tiles by the same logical w × h as its 1× version, so offsets,
   * factors and drift stay in logical pixels; below res d the renderers draw `lowRes(buf, d)`.
   */
  density?: number;
}

/**
 * Every renderer draws the logical 384 × 216 view (all coordinates below are logical pixels) into
 * a backbuffer `res` times larger (docs/ARCHITECTURE.md §3). At res 1 this is the classic
 * pixel-exact image. At res k:
 * - rects, lines, text, backgrounds (`parallax`, `image`) are enlarged as crisp k × k blocks;
 * - registered sprites are filtered once by the pixel-art upscaler of `mode` (upscale.ts) and
 *   drawn over exactly their logical footprint (anchors and flips stay exact in logical pixels);
 *   2× frames (`Frame.density` 2) are never filtered and cover the same logical footprint;
 * - the camera, world draws and background layers may sit between logical pixels (multiples of
 *   1/k), see `subpixel` (default 'all').
 * Game logic never sees any of this: it draws with the same logical coordinates at every res.
 */
export interface Renderer {
  /** Logical size (384 × 216), whatever `res` is. */
  readonly w: number;
  readonly h: number;
  /** Backbuffer pixels per logical pixel (integer ≥ 1; 1 for the headless tools and tests). */
  readonly res: number;
  /** Sprite filter ('pixel' = none). Falls back to 'pixel' while res < upscaleFactor(mode). */
  readonly mode: UpscaleMode;
  /** Sub-pixel placement policy at res > 1 (render-common.ts). */
  readonly subpixel: SubpixelMode;
  /**
   * Current camera offset (logical px), already snapped: to whole pixels, or to multiples of
   * 1/res with sub-pixel 'camera' / 'all' at res > 1.
   */
  readonly camX: number;
  readonly camY: number;

  /** Change the sprite filter (upscaled sprites are rebuilt lazily). */
  setMode(mode: UpscaleMode): void;
  setSubpixel(s: SubpixelMode): void;

  /** Start a frame: clear to `clear` (default opaque black); pass null to keep the old image. */
  begin(clear?: Color | null): void;
  end(): void;
  /** Set the camera (top-left of the view, world px). Pass it unrounded (Camera.viewX / viewY): the renderer snaps it. */
  setCamera(x: number, y: number): void;

  /** Draw frame `frameIndex` (wrapped) of a registered sprite strip; missing id → placeholder. */
  sprite(id: string, frameIndex: number, x: number, y: number, o?: DrawOpts): void;
  frame(f: Frame, x: number, y: number, o?: DrawOpts): void;
  /** Draw a whole buffer with its top-left at (x, y). Implementations cache per buffer. */
  image(buf: PixelBuffer, x: number, y: number, o?: DrawOpts): void;
  rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void;
  line(x0: number, y0: number, x1: number, y1: number, c: Color, o?: DrawOpts): void;
  text(s: string, x: number, y: number, o?: TextOpts): void;
  /**
   * Background layer: drawn at screen position
   * (offsetX - camX * factorX, offsetY - camY * factorY), tiled horizontally by default.
   */
  parallax(
    buf: PixelBuffer,
    factorX: number,
    factorY: number,
    offsetX: number,
    offsetY: number,
    o?: ParallaxOpts,
  ): void;
  /** Full-screen colour overlay (fades, flashes). */
  fade(c: Color, alpha: number): void;
}
