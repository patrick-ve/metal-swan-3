import type { Color } from './color';
import { BLACK, blendAdd, blendOver, WHITE } from './color';
import { drawText, drawTextPx, glyphDensity, textScale } from './font';
import type { BlitOpts } from './pixel';
import { PixelBuffer, traceLine } from './pixel';
import type { DrawOpts, Frame, ParallaxOpts, Renderer, RowsDraw, RowsTexture, SrcRect, TextOpts } from './render';
import { SURFACE_ROAD, SURFACE_SKY, VIEW_H, VIEW_W } from './render';
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
  rowShift,
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
  /**
   * The image being drawn (opaque after begin()), (w·res) × (h·res). While a layer is open
   * (`layerBegin` … `layerEnd`) the draws go to the layer instead: read it after `end()`.
   */
  target: PixelBuffer;
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
    const t = this.dst(this.lineAdd);
    if (k > 1) {
      t.blendRect(x * k - this.lineFx, y * k - this.lineFy, k, k, this.lineColor, this.lineAlpha, this.lineAdd ? 'add' : 'over');
      return;
    }
    if (this.lineAlpha >= 1 && !this.lineAdd && (this.lineColor & 255) === 255) {
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) t.data[y * this.w + x] = this.lineColor;
    } else {
      t.blendPixel(x, y, this.lineColor, this.lineAlpha, this.lineAdd ? 'add' : 'over');
    }
  };

  // THE LAYER (render.ts `layerBegin`): the backbuffer, the layer and its additive twin (made on
  // first use, the backbuffer's size), the open layer's box and the box the layer was last used in
  // (backbuffer px: x0, y0, x1, y1), and whether its additive twin was drawn into.
  private readonly main: PixelBuffer;
  private layerBuf: PixelBuffer | null = null;
  private addBuf: PixelBuffer | null = null;
  private layerOn = false;
  private addUsed = false;
  private readonly box = new Int32Array(4);
  private readonly used = new Int32Array(4);
  /** Clip the canal rows to the box (a layer opened with one). */
  private clipRows = false;

  constructor(w = VIEW_W, h = VIEW_H, target?: PixelBuffer, opts: SoftRendererOpts = {}) {
    this.w = w;
    this.h = h;
    this.res = Math.max(1, Math.floor(opts.res ?? 1));
    this.mode = opts.mode ?? 'pixel';
    this.subpixel = opts.subpixel ?? DEFAULT_SUBPIXEL;
    this.target = target ?? new PixelBuffer(w * this.res, h * this.res);
    this.main = this.target;
  }

  begin(clear: Color | null = BLACK): void {
    // An open layer is dropped (not drawn).
    this.target = this.main;
    this.layerOn = false;
    this.clipRows = false;
    if (clear !== null) this.target.fill(clear);
  }

  /** The buffer a draw goes to: the target, or (an additive draw while a layer is open) the additive layer. */
  private dst(add: boolean): PixelBuffer {
    if (!add || !this.layerOn) return this.target;
    this.addUsed = true;
    return this.addBuf as PixelBuffer;
  }

  /** Render.ts `layerBegin`: later draws go to the layer (cleared in its last box and in `box`). */
  layerBegin(box?: SrcRect): void {
    if (this.layerOn) this.layerEnd();
    const m = this.main;
    const k = this.res;
    if (!this.layerBuf || this.layerBuf.w !== m.w || this.layerBuf.h !== m.h) {
      this.layerBuf = new PixelBuffer(m.w, m.h);
      this.addBuf = new PixelBuffer(m.w, m.h);
      this.used.set([0, 0, m.w, m.h]);
    }
    const b = this.box;
    if (box) {
      b[0] = Math.max(0, Math.floor(box.x * k));
      b[1] = Math.max(0, Math.floor(box.y * k));
      b[2] = Math.min(m.w, Math.ceil((box.x + box.w) * k));
      b[3] = Math.min(m.h, Math.ceil((box.y + box.h) * k));
    } else b.set([0, 0, m.w, m.h]);
    const u = this.used;
    const L = this.layerBuf.data;
    const A = (this.addBuf as PixelBuffer).data;
    // Clear what the last use may have left (its box) and this box; the additive layer whole.
    for (const r of [u, b]) for (let y = r[1]; y < r[3]; y++) L.fill(0, y * m.w + r[0], y * m.w + r[2]);
    if (this.addUsed) A.fill(0);
    u.set(b);
    this.addUsed = false;
    this.clipRows = box !== undefined;
    this.layerOn = true;
    this.target = this.layerBuf;
  }

  /** Render.ts `layerMask`: the layer keeps its pixels only where the mask (density d, world space at x, y) is opaque. */
  layerMask(mask: PixelBuffer, d: number, x: number, y: number): void {
    if (!this.layerOn) return;
    const k = this.res;
    const fine = this.subpixel === 'all';
    const left = toPx(x, k, fine) - this.cx;
    const top = toPx(y, k, fine) - this.cy;
    const L = this.target.data;
    const W = this.target.w;
    const M = mask.data;
    const b = this.box;
    for (let Y = b[1]; Y < b[3]; Y++) {
      const my = Math.floor(((Y - top) * d) / k);
      const row = Y * W;
      if (my < 0 || my >= mask.h) {
        L.fill(0, row + b[0], row + b[2]);
        continue;
      }
      const mrow = my * mask.w;
      for (let X = b[0]; X < b[2]; X++) {
        if (L[row + X] === 0) continue;
        const mx = Math.floor(((X - left) * d) / k);
        if (mx < 0 || mx >= mask.w || (M[mrow + mx] & 255) === 0) L[row + X] = 0;
      }
    }
  }

  /** Render.ts `layerShade`: `buf` (density 1, world space at x, y) over the layer's own pixels only. */
  layerShade(buf: PixelBuffer, x: number, y: number): void {
    if (!this.layerOn) return;
    const k = this.res;
    const fine = this.subpixel === 'all';
    const left = toPx(x, k, fine) - this.cx;
    const top = toPx(y, k, fine) - this.cy;
    const L = this.target.data;
    const W = this.target.w;
    const S = buf.data;
    const b = this.box;
    for (let Y = b[1]; Y < b[3]; Y++) {
      const sy = Math.floor((Y - top) / k);
      if (sy < 0 || sy >= buf.h) continue;
      const row = Y * W;
      const srow = sy * buf.w;
      for (let X = b[0]; X < b[2]; X++) {
        const p = L[row + X];
        const pa = p & 255;
        if (pa === 0) continue;
        const sx = Math.floor((X - left) / k);
        if (sx < 0 || sx >= buf.w) continue;
        const c = S[srow + sx];
        if ((c & 255) === 0) continue;
        // Source-atop: the colour blends as over an opaque pixel, the layer's alpha stays.
        L[row + X] = ((blendOver((p | 255) >>> 0, c) & 0xffffff00) | pa) >>> 0;
      }
    }
  }

  /** Render.ts `layerEnd`: the layer over the backbuffer in its box, then the additive layer added. */
  layerEnd(): void {
    if (!this.layerOn) return;
    this.layerOn = false;
    this.clipRows = false;
    this.target = this.main;
    const T = this.main.data;
    const W = this.main.w;
    const L = (this.layerBuf as PixelBuffer).data;
    const A = (this.addBuf as PixelBuffer).data;
    const b = this.box;
    const add = this.addUsed;
    for (let Y = b[1]; Y < b[3]; Y++) {
      const row = Y * W;
      for (let i = row + b[0], e = row + b[2]; i < e; i++) {
        const p = L[i];
        if (p !== 0) T[i] = blendOver(T[i], p);
      }
    }
    // The additive layer is not clipped: all of it.
    if (add) {
      for (let i = 0, e = A.length; i < e; i++) {
        const p = A[i];
        if (p !== 0) T[i] = blendAdd(T[i], p);
      }
    }
    this.main.version++;
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
    this.dst(o?.blend === 'add').blendRect(left, top, Math.round(w) * k, Math.round(h) * k, solidColor(c, o), o?.alpha ?? 1, o?.blend === 'add' ? 'add' : 'over');
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

  /**
   * The canal scenery (render.ts `rows`): row by row, the reference picture. Destination row Y shows
   * image row t (k / d backbuffer rows per image row; uneven ratios sample as `blitScaled`), moved by
   * `rowShift`; every pixel with alpha > 0 is written opaque (the kit's compose), the rest is left.
   * Buffers only (a `RowsTexture` is a canvas renderer's).
   */
  rows(img: PixelBuffer | RowsTexture, d: number, x: number, y: number, o: RowsDraw): void {
    if (!(img instanceof PixelBuffer) || img.w === 0 || img.h === 0) return;
    const k = this.res;
    const t = this.target;
    const W = img.w;
    const H = img.h;
    const left = Math.round(x * k);
    const top = Math.round(y * k);
    const dh = Math.floor((H * k) / d);
    const dw = Math.floor((W * k) / d);
    const clip = this.clipRows;
    const b = this.box;
    const y0 = Math.max(clip ? b[1] : 0, top);
    const y1 = Math.min(clip ? b[3] : t.h, top + dh);
    const src = img.data;
    const dst = t.data;
    const TW = t.w;
    const cx0 = clip ? b[0] : 0;
    const cx1 = clip ? b[2] : TW;
    const whole = k % d === 0;
    const m = k / d;
    let last = -1;
    let xl = 0;
    for (let Y = y0; Y < y1; Y++) {
      const r = whole ? Math.floor((Y - top) / m) : Math.min(H - 1, Math.ceil(((2 * (Y - top) + 1) * d) / (2 * k)) - 1);
      if (r !== last) {
        last = r;
        xl = left - rowShift(o, r, k);
      }
      const x0 = Math.max(cx0, xl);
      const x1 = Math.min(cx1, xl + dw);
      const srow = r * W;
      const drow = Y * TW;
      if (m === 1) {
        for (let X = x0; X < x1; X++) {
          const p = src[srow + X - xl];
          if ((p & 255) !== 0) dst[drow + X] = (p | 255) >>> 0;
        }
      } else if (whole) {
        for (let X = x0; X < x1; X++) {
          const p = src[srow + Math.floor((X - xl) / m)];
          if ((p & 255) !== 0) dst[drow + X] = (p | 255) >>> 0;
        }
      } else {
        for (let X = x0; X < x1; X++) {
          const p = src[srow + Math.min(W - 1, Math.ceil(((2 * (X - xl) + 1) * d) / (2 * k)) - 1)];
          if ((p & 255) !== 0) dst[drow + X] = (p | 255) >>> 0;
        }
      }
    }
    t.version++;
  }

  /**
   * The 3D view (render.ts `surface`): node has no WebGL, so this always draws the flat
   * placeholder over the logical rectangle (sky above the middle, road grey below), screen space.
   */
  surface(_src: unknown, x: number, y: number, w: number, h: number): void {
    const k = this.res;
    const top = Math.floor(h / 2);
    this.target.blendRect(x * k, y * k, w * k, top * k, SURFACE_SKY, 1, 'over');
    this.target.blendRect(x * k, (y + top) * k, w * k, (h - top) * k, SURFACE_ROAD, 1, 'over');
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
      this.dst(bo.blend === 'add').blitScaled(img, p.dx, p.dy, k, f, bo);
      return;
    }
    this.dst(bo.blend === 'add').blitScaled(img, left, top, k, f, bo);
  }

  private upscaledOf(buf: PixelBuffer, mode: UpscaleMode): PixelBuffer {
    const e = this.upscaled.get(buf);
    if (e && e.version === buf.version && e.mode === mode) return e.buf;
    const up = upscale(buf, mode);
    this.upscaled.set(buf, { version: buf.version, mode, buf: up });
    return up;
  }
}
