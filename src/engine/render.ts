import type { Color } from './color';
import type { PixelBuffer } from './pixel';

/**
 * Shared rendering contract (docs/ARCHITECTURE.md §5.5), pre-written by the orchestrator.
 * Implementations: render-canvas.browser.ts (Canvas 2D) and render-soft.ts (pure TS, headless).
 * The media-core agent owns this file: extend it freely, but do not rename or remove members —
 * the simulation side codes against them in parallel.
 */

/** Logical view size in pixels (docs/ARCHITECTURE.md §3). */
export const VIEW_W = 384;
export const VIEW_H = 216;

/**
 * One sprite frame. Drawing it at (x, y) puts its anchor (ox, oy) on (x, y).
 * Positions are rounded with Math.round; flipping mirrors around the anchor pixel
 * (see render-common.ts), so a point at +dx moves to −dx.
 */
export interface Frame {
  readonly buf: PixelBuffer;
  readonly ox: number;
  readonly oy: number;
  /** Named attachment points relative to the anchor of the unflipped frame (flip negates x). */
  readonly pts?: Readonly<Record<string, readonly [number, number]>>;
}

/** A rectangle in buffer pixels. */
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
   */
  src?: SrcRect;
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
}

export interface Renderer {
  /** Logical size (384 × 216). */
  readonly w: number;
  readonly h: number;
  /** Current camera offset, already rounded to whole pixels. */
  readonly camX: number;
  readonly camY: number;

  /** Start a frame: clear to `clear` (default opaque black); pass null to keep the old image. */
  begin(clear?: Color | null): void;
  end(): void;
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
