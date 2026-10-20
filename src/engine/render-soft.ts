import type { Color } from './color';
import { BLACK, WHITE } from './color';
import { drawText, drawTextPx, glyphDensity, textScale } from './font';
import type { BlitOpts } from './pixel';
import { PixelBuffer, traceLine } from './pixel';
import type { DrawOpts, Frame, ParallaxOpts, Renderer, TextOpts } from './render';
import { VIEW_H, VIEW_W } from './render';
import type { LineEnds, Part, Placement, SubpixelMode } from './render-common';
import {
  anchorTopLeft,
  cameraPx,
  clipLine,
  DEFAULT_SUBPIXEL,
  firstTile,
  layerCam,
  drawDensity,
  reducedFor,
  parallaxOrigin,
  placePart,
  solidColor,
  spriteFilter,
  toPx,
} from './render-common';
import { artTier, getFrame, hiArtOn, spriteIdOf } from './sprites';
import { upscale, upscaleFactor, type UpscaleMode } from './upscale';

export interface SoftRendererOpts {
  /** Backbuffer pixels per logical pixel (integer ≥ 1, default 1). */
  res?: number;
  /** Sprite filter (default 'pixel'). */
  mode?: UpscaleMode;
  /** Sub-pixel policy at res > 1 (default DEFAULT_SUBPIXEL). */
  subpixel?: SubpixelMode;
}

interface Upscaled {
  version: number;
  mode: UpscaleMode;
  buf: PixelBuffer;
}

/**
 * Pure-TypeScript renderer into a PixelBuffer (node tools, tests, headless screenshots).
 * It implements the full Renderer contract and gives the same pixels as the Canvas 2D renderer
 * (blended pixels may differ by ±1 per channel because of Canvas rounding).
 *
 * With `res` k > 1 the target is (w·k) × (h·k) and every draw follows the placement rules of
 * render-common.ts; registered sprites go through the same `upscale()` as in the browser, with
 * the filter `spriteFilter()` picks (cached per buffer in a WeakMap, no budget), so headless PNGs
 * show the browser look (Canvas may pick the other pixel on nearest-neighbour ties when k is not
 * a multiple of the filter factor).
 * At res 1 (the default) the output is unchanged pixel for pixel.
 */
export class SoftRenderer implements Renderer {
  readonly w: number;
  readonly h: number;
  readonly res: number;
  /** The image being drawn (opaque after begin()), (w·res) × (h·res). */
  readonly target: PixelBuffer;
  camX = 0;
  camY = 0;
  mode: UpscaleMode;
  subpixel: SubpixelMode;

  /** Camera in backbuffer px. */
  private cx = 0;
  private cy = 0;
  /** The unrounded camera passed to setCamera (for background layers with 'parallax' / 'all'). */
  private exactX = 0;
  private exactY = 0;
  private readonly upscaled = new WeakMap<PixelBuffer, Upscaled>();
  // Reused per call: no allocations while drawing.
  private readonly place: Placement = { x: 0, y: 0 };
  private readonly ends: LineEnds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private readonly part: Part = { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0 };
  private readonly bo: BlitOpts = {};
  private lineColor: Color = 0;
  private lineAlpha = 1;
  private lineAdd = false;
  /** Backbuffer shift of the current line (the camera's part below one logical pixel). */
  private lineFx = 0;
  private lineFy = 0;
  private readonly plotLine = (x: number, y: number): void => {
    const k = this.res;
    if (k > 1) {
      this.target.blendRect(x * k - this.lineFx, y * k - this.lineFy, k, k, this.lineColor, this.lineAlpha, this.lineAdd ? 'add' : 'over');
      return;
    }
    if (this.lineAlpha >= 1 && !this.lineAdd && (this.lineColor & 255) === 255) {
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.target.data[y * this.w + x] = this.lineColor;
    } else {
      this.target.blendPixel(x, y, this.lineColor, this.lineAlpha, this.lineAdd ? 'add' : 'over');
    }
  };

  constructor(w = VIEW_W, h = VIEW_H, target?: PixelBuffer, opts: SoftRendererOpts = {}) {
    this.w = w;
    this.h = h;
    this.res = Math.max(1, Math.floor(opts.res ?? 1));
    this.mode = opts.mode ?? 'pixel';
    this.subpixel = opts.subpixel ?? DEFAULT_SUBPIXEL;
    this.target = target ?? new PixelBuffer(w * this.res, h * this.res);
  }

  begin(clear: Color | null = BLACK): void {
    if (clear !== null) this.target.fill(clear);
  }

  end(): void {
    this.target.touch();
  }

  setMode(mode: UpscaleMode): void {
    this.mode = mode;
  }

  setSubpixel(s: SubpixelMode): void {
    this.subpixel = s;
  }

  setCamera(x: number, y: number): void {
    const k = this.res;
    this.exactX = x;
    this.exactY = y;
    this.cx = cameraPx(x, k, this.subpixel);
    this.cy = cameraPx(y, k, this.subpixel);
    this.camX = this.cx / k;
    this.camY = this.cy / k;
  }

  sprite(id: string, frameIndex: number, x: number, y: number, o?: DrawOpts): void {
    this.frame(getFrame(id, frameIndex), x, y, o);
  }

  frame(f: Frame, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.res;
    const fine = !screen && this.subpixel === 'all';
    const d = f.density ?? 1;
    const p = anchorTopLeft(
      this.place,
      f.buf.w / d,
      f.buf.h / d,
      f.ox,
      f.oy,
      toPx(x, k, fine) - (screen ? 0 : this.cx),
      toPx(y, k, fine) - (screen ? 0 : this.cy),
      o?.flipX === true,
      o?.flipY === true,
      k,
    );
    this.draw(f.buf, p.x, p.y, o, true, d);
  }

  image(buf: PixelBuffer, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.res;
    const fine = !screen && this.subpixel === 'all';
    this.draw(buf, toPx(x, k, fine) - (screen ? 0 : this.cx), toPx(y, k, fine) - (screen ? 0 : this.cy), o, false);
  }

  rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.res;
    const fine = !screen && this.subpixel === 'all';
    const left = toPx(x, k, fine) - (screen ? 0 : this.cx);
    const top = toPx(y, k, fine) - (screen ? 0 : this.cy);
    this.target.blendRect(left, top, Math.round(w) * k, Math.round(h) * k, solidColor(c, o), o?.alpha ?? 1, o?.blend === 'add' ? 'add' : 'over');
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.res;
    // Whole logical pixels relative to the camera's whole-pixel part; the rest shifts the blocks.
    const ix = screen ? 0 : Math.floor(this.cx / k);
    const iy = screen ? 0 : Math.floor(this.cy / k);
    this.lineFx = screen ? 0 : this.cx - ix * k;
    this.lineFy = screen ? 0 : this.cy - iy * k;
    this.lineColor = solidColor(c, o);
    this.lineAlpha = o?.alpha ?? 1;
    this.lineAdd = o?.blend === 'add';
    if (this.lineAlpha <= 0 || (c & 255) === 0) return;
    const e = this.ends;
    if (!clipLine(e, Math.round(x0) - ix, Math.round(y0) - iy, Math.round(x1) - ix, Math.round(y1) - iy, this.w, this.h)) return;
    traceLine(e.x0, e.y0, e.x1, e.y1, this.plotLine);
    this.target.touch();
  }

  text(s: string, x: number, y: number, o?: TextOpts): void {
    const screen = o?.screen !== false;
    const k = this.res;
    if (k === 1) {
      drawText(this.target, s, Math.round(x) - (screen ? 0 : this.camX), Math.round(y) - (screen ? 0 : this.camY), o);
      return;
    }
    // Lay out in logical pixels from (0, 0), then place every glyph as k × k blocks (glyph
    // density 1), or draw the HD glyphs of the art tier the backbuffer shows (font.ts).
    const fine = !screen && this.subpixel === 'all';
    const bx = toPx(x, k, fine) - (screen ? 0 : this.cx);
    const by = toPx(y, k, fine) - (screen ? 0 : this.cy);
    drawTextPx(this.target, s, bx, by, o, k, glyphDensity(k, hiArtOn() ? artTier() : 1, textScale(o)));
  }

  parallax(
    buf: PixelBuffer,
    factorX: number,
    factorY: number,
    offsetX: number,
    offsetY: number,
    o?: ParallaxOpts,
  ): void {
    if (buf.w === 0 || buf.h === 0) return;
    const k = this.res;
    const fine = this.subpixel !== 'off';
    const sx = parallaxOrigin(offsetX, layerCam(this.camX, this.exactX, factorX, k, this.subpixel), factorX, k, fine);
    const sy = parallaxOrigin(offsetY, layerCam(this.camY, this.exactY, factorY, k, this.subpixel), factorY, k, fine);
    // A dense layer tiles by its logical size; below res d it is drawn reduced (4 → 2 → 1).
    const d = Math.max(1, Math.floor(o?.density ?? 1));
    const img = reducedFor(buf, d, k);
    const f = drawDensity(d, k);
    const tw = (img.w / f) * k;
    const th = (img.h / f) * k;
    const repeatX = o?.repeatX !== false;
    const repeatY = o?.repeatY === true;
    const x0 = repeatX ? firstTile(sx, tw) : sx;
    const y0 = repeatY ? firstTile(sy, th) : sy;
    const bo = this.bo;
    bo.flipX = false;
    bo.flipY = false;
    bo.alpha = o?.alpha ?? 1;
    bo.blend = 'over';
    bo.solid = undefined;
    bo.sx = undefined;
    bo.sy = undefined;
    bo.sw = undefined;
    bo.sh = undefined;
    const W = this.target.w;
    const H = this.target.h;
    for (let ty = y0; ty < H; ty += th) {
      for (let tx = x0; tx < W; tx += tw) {
        this.target.blitScaled(img, tx, ty, k, f, bo);
        if (!repeatX) break;
      }
      if (!repeatY) break;
    }
  }

  fade(c: Color, alpha: number): void {
    this.target.blendRect(0, 0, this.target.w, this.target.h, c, alpha, 'over');
  }

  /**
   * Blit a whole image (top-left at backbuffer px left/top) or the `src` part of it, k backbuffer
   * px per logical px. `sprite`: a frame, which may go through the upscaler. `d`: the frame's
   * density (buffer px per logical px; 2× art is never filtered, and drawn as `lowRes` below
   * res d).
   */
  private draw(buf: PixelBuffer, left: number, top: number, o: DrawOpts | undefined, sprite: boolean, d = 1): void {
    const bo = this.bo;
    const k = this.res;
    const flipX = o?.flipX === true;
    const flipY = o?.flipY === true;
    bo.flipX = flipX;
    bo.flipY = flipY;
    bo.alpha = o?.alpha ?? 1;
    bo.blend = o?.blend === 'add' ? 'add' : 'over';
    bo.solid = o?.tint ?? (o?.flash ? WHITE : undefined);
    bo.sx = undefined;
    bo.sy = undefined;
    bo.sw = undefined;
    bo.sh = undefined;
    // Logical size of the image.
    const lw = d === 1 ? buf.w : buf.w / d;
    const lh = d === 1 ? buf.h : buf.h / d;
    // The image actually drawn and its px per logical px f: the 1× buffer, its upscaled copy, a
    // 2× buffer, or the 1× reduction of a 2× buffer below res d.
    let img = buf;
    let f = d;
    if (d > k) {
      img = reducedFor(buf, d, k);
      f = drawDensity(d, k);
    } else if (d === 1 && sprite && k > 1 && this.mode !== 'pixel') {
      const m = spriteFilter(spriteIdOf(buf), this.mode, k);
      if (m !== 'pixel') {
        img = this.upscaledOf(buf, m);
        f = upscaleFactor(m);
      }
    }
    if (o?.src) {
      const p = this.part;
      if (!placePart(p, lw, lh, o.src, left, top, flipX, flipY, k)) return;
      // blit() mirrors its source rectangle in place, so pass the unflipped rectangle.
      bo.sx = (flipX ? lw - p.sx - p.sw : p.sx) * f;
      bo.sy = (flipY ? lh - p.sy - p.sh : p.sy) * f;
      bo.sw = p.sw * f;
      bo.sh = p.sh * f;
      this.target.blitScaled(img, p.dx, p.dy, k, f, bo);
      return;
    }
    this.target.blitScaled(img, left, top, k, f, bo);
  }

  private upscaledOf(buf: PixelBuffer, mode: UpscaleMode): PixelBuffer {
    const e = this.upscaled.get(buf);
    if (e && e.version === buf.version && e.mode === mode) return e.buf;
    const up = upscale(buf, mode);
    this.upscaled.set(buf, { version: buf.version, mode, buf: up });
    return up;
  }
}
