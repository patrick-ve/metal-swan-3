import type { Color } from './color';
import { BLACK, toCss, WHITE } from './color';
import type { BitmapFont, Glyph } from './font';
import { getFont, glyphAtlas, layoutText, textPasses, textScale } from './font';
import type { PixelBuffer } from './pixel';
import { traceLine } from './pixel';
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
  lowRes,
  parallaxOrigin,
  placePart,
  solidColor,
  spriteFilter,
  toPx,
} from './render-common';
import { getFrame, spriteIdOf } from './sprites';
import { upscale, upscaleFactor, type UpscaleMode } from './upscale';

/**
 * Canvas 2D renderer drawing into a (VIEW_W · res) × (VIEW_H · res) backbuffer canvas (present it
 * with display.browser.ts). Coordinates are logical; every draw is placed in whole backbuffer
 * pixels by the rules of render-common.ts (the context transform stays the identity), so the
 * image matches the software renderer exactly; only alpha / additive blends may differ by ±1 per
 * channel.
 *
 * Textures: every PixelBuffer is uploaded once per variant — normal, flipped X/Y, tint / white
 * "flash" silhouettes, and for registered sprites (sprites.ts) the same variants of the upscaled
 * copy (upscale.ts) — and kept in one LRU cache with a pixel budget (`budgetPx`, counting canvases
 * and upscaled buffers). Variants are computed in TypeScript; Canvas only enlarges them by
 * nearest neighbour (imageSmoothingEnabled off). Upscaling is lazy and limited per frame
 * (`scaleBudgetMs`): a sprite not upscaled yet is drawn from its 1× texture this frame and
 * upscaled at the end of the frame or a later one. A buffer whose `version` changed is
 * re-uploaded.
 *
 * Streams: a plain draw with `DrawOpts.stream` (render.ts) skips that cache. Each such buffer gets
 * one slot (canvas + ImageData + a Uint32 view of its bytes), refilled in place with putImageData
 * when the buffer's `version` changed, outside the pixel budget, dropped after
 * `STREAM_IDLE_FRAMES` frames without use. The stream path allocates nothing per frame.
 */

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Default texture budget: canvases + upscaled buffers, in pixels (4 bytes each). */
export const TEXTURE_BUDGET_PX = 48_000_000;
/** Default time per frame spent upscaling sprites (ms). */
export const SCALE_BUDGET_MS = 4;

export interface CanvasRendererOpts {
  /** Backbuffer pixels per logical pixel (integer ≥ 1, default 1). */
  res?: number;
  mode?: UpscaleMode;
  subpixel?: SubpixelMode;
  budgetPx?: number;
  scaleBudgetMs?: number;
}

/** Variant index: flipX | flipY << 1 | upscaled << 2. */
type Variants = (AnyCanvas | undefined)[];

interface CacheEntry {
  version: number;
  /** Untinted variants. */
  plain: Variants;
  /** Silhouette variants per tint colour (white = hit flash). */
  tinted: Map<number, Variants> | null;
  /** The upscaled copy (filter `upMode`, from `spriteFilter`), or null. */
  up: PixelBuffer | null;
  upMode: UpscaleMode | null;
  /** Pixels held by this entry (canvases + `up`). */
  px: number;
  /** Frame number of the last use (entries used this frame are never evicted). */
  used: number;
}

/** A stream slot is dropped after this many frames without a draw. */
export const STREAM_IDLE_FRAMES = 120;

/** One streamed buffer: its canvas and the ImageData refilled when the buffer changes. */
interface StreamSlot {
  buf: PixelBuffer;
  canvas: AnyCanvas;
  ctx: AnyContext;
  img: ImageData;
  /** The bytes of `img`, viewed as 32-bit words in canvas byte order. */
  words: Uint32Array;
  /** Buffer version last uploaded (-1: never). */
  version: number;
  /** Frame number of the last draw. */
  used: number;
}

/** Is this platform little-endian (ImageData words read as 0xAABBGGRR)? */
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** Texture numbers for the debug overlay and the perf tool. */
export interface TextureStats {
  entries: number;
  /** Pixels held (canvases + upscaled buffers). */
  px: number;
  budgetPx: number;
  /** Upscales done / sprites drawn from 1× because the budget ran out, in the last frame. */
  scaled: number;
  deferred: number;
  /** Time spent upscaling in the last frame (ms). */
  scaleMs: number;
  /** Entries evicted so far. */
  evicted: number;
  /** Live stream slots (`DrawOpts.stream`; not counted in `entries` / `px`). */
  streams: number;
  /** Stream uploads (putImageData after a version change) so far. */
  streamUploads: number;
}

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function context(c: AnyCanvas): AnyContext {
  const ctx = c.getContext('2d') as AnyContext | null;
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Upload a buffer variant (pixels computed in TS) into a new canvas; `tint` = silhouette colour. */
function upload(buf: PixelBuffer, flipX: boolean, flipY: boolean, tint: Color | null): AnyCanvas {
  const c = makeCanvas(buf.w, buf.h);
  const ctx = context(c);
  const img = ctx.createImageData(buf.w, buf.h);
  const out = img.data;
  const src = buf.data;
  const { w, h } = buf;
  for (let y = 0; y < h; y++) {
    const sy = flipY ? h - 1 - y : y;
    for (let x = 0; x < w; x++) {
      const p = src[sy * w + (flipX ? w - 1 - x : x)];
      const o = (y * w + x) * 4;
      const a = p & 255;
      if (a === 0) continue; // ImageData starts transparent
      if (tint !== null) {
        out[o] = tint >>> 24;
        out[o + 1] = (tint >>> 16) & 255;
        out[o + 2] = (tint >>> 8) & 255;
      } else {
        out[o] = p >>> 24;
        out[o + 1] = (p >>> 16) & 255;
        out[o + 2] = (p >>> 8) & 255;
      }
      out[o + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class CanvasRenderer implements Renderer {
  readonly w: number;
  readonly h: number;
  /** The backbuffer, (w · res) × (h · res). */
  readonly canvas: AnyCanvas;
  readonly ctx: AnyContext;
  camX = 0;
  camY = 0;
  mode: UpscaleMode;
  subpixel: SubpixelMode;
  budgetPx: number;
  scaleBudgetMs: number;

  private k = 1;
  /** Camera in backbuffer px. */
  private cx = 0;
  private cy = 0;
  /** The unrounded camera passed to setCamera (for background layers with 'parallax' / 'all'). */
  private exactX = 0;
  private exactY = 0;
  /** LRU order: oldest first (Map insertion order). */
  private readonly cache = new Map<PixelBuffer, CacheEntry>();
  private cachePx = 0;
  private frameNo = 0;
  private scaleMs = 0;
  private scaledCount = 0;
  private deferredCount = 0;
  private evicted = 0;
  private readonly pending: PixelBuffer[] = [];
  /** Did the last variant() call return an upscaled texture? */
  private variantUp = false;
  private lastStats: TextureStats = { entries: 0, px: 0, budgetPx: 0, scaled: 0, deferred: 0, scaleMs: 0, evicted: 0, streams: 0, streamUploads: 0 };
  /** Stream slots: lookup by buffer, plus a list for the idle sweep (no iterator allocations). */
  private readonly streamMap = new Map<PixelBuffer, StreamSlot>();
  private readonly streamList: StreamSlot[] = [];
  private streamUploads = 0;
  private readonly atlases = new Map<string, Map<number, AnyCanvas>>();
  private readonly css = new Map<number, string>();
  private readonly place: Placement = { x: 0, y: 0 };
  private readonly ends: LineEnds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private readonly part: Part = { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0 };
  private alpha = 1;
  private add = false;
  // Per-call text state, read by the glyph visitor (avoids closures per call).
  private textFont: BitmapFont = getFont('small');
  private textAtlas: AnyCanvas | null = null;
  private textScale = 1;
  private readonly drawGlyphAt = (g: Glyph, x: number, y: number): void => {
    const f = this.textFont;
    const s = this.textScale * this.k;
    if (this.textAtlas) {
      this.ctx.drawImage(this.textAtlas, g.index * (f.maxW + 1), 0, g.w, f.height, this.textX + x * this.k, this.textY + y * this.k, g.w * s, f.height * s);
    }
  };
  private textAlign: 'left' | 'center' | 'right' = 'left';
  /** Text origin in backbuffer px. */
  private textX = 0;
  private textY = 0;
  private textStr = '';
  private readonly textPass = (color: Color, dx: number, dy: number): void => {
    this.textAtlas = this.atlas(this.textFont, color);
    layoutText(this.textStr, dx, dy, this.textFont, this.textAlign, this.drawGlyphAt, this.textScale);
  };
  // Line pixels (logical) are merged into horizontal or vertical runs, one fillRect each.
  private runX = 0;
  private runY = 0;
  private runW = 0;
  private runH = 0;
  /** Backbuffer shift of the current line (the camera's part below one logical pixel). */
  private lineFx = 0;
  private lineFy = 0;
  private readonly plotLine = (x: number, y: number): void => {
    if (this.runW > 0) {
      if (this.runH === 1 && y === this.runY && x === this.runX + this.runW) {
        this.runW++;
        return;
      }
      if (this.runW === 1 && x === this.runX && y === this.runY + this.runH) {
        this.runH++;
        return;
      }
      this.flushRun();
    }
    this.runX = x;
    this.runY = y;
    this.runW = 1;
    this.runH = 1;
  };

  constructor(w = VIEW_W, h = VIEW_H, canvas?: AnyCanvas, opts: CanvasRendererOpts = {}) {
    this.w = w;
    this.h = h;
    this.k = Math.max(1, Math.floor(opts.res ?? 1));
    this.mode = opts.mode ?? 'pixel';
    this.subpixel = opts.subpixel ?? DEFAULT_SUBPIXEL;
    this.budgetPx = opts.budgetPx ?? TEXTURE_BUDGET_PX;
    this.scaleBudgetMs = opts.scaleBudgetMs ?? SCALE_BUDGET_MS;
    this.canvas = canvas ?? makeCanvas(w * this.k, h * this.k);
    this.canvas.width = w * this.k;
    this.canvas.height = h * this.k;
    this.ctx = context(this.canvas);
  }

  get res(): number {
    return this.k;
  }

  /** Change the backbuffer resolution (re-sizes the canvas; the next begin() redraws it all). */
  setRes(k: number): void {
    const n = Math.max(1, Math.floor(k));
    if (n === this.k) return;
    this.k = n;
    this.canvas.width = this.w * n;
    this.canvas.height = this.h * n;
    // Resizing resets the context state.
    this.ctx.imageSmoothingEnabled = false;
    this.alpha = 1;
    this.add = false;
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }

  setMode(mode: UpscaleMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.clearUpscaled();
  }

  setSubpixel(s: SubpixelMode): void {
    this.subpixel = s;
  }

  /** Texture cache numbers (last finished frame). */
  textureStats(): TextureStats {
    return this.lastStats;
  }

  begin(clear: Color | null = BLACK): void {
    const ctx = this.ctx;
    this.frameNo++;
    this.scaleMs = 0;
    this.scaledCount = 0;
    this.deferredCount = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.setAlpha(1);
    this.setAdd(false);
    if (clear === null) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if ((clear & 255) !== 255) ctx.clearRect(0, 0, W, H);
    if ((clear & 255) !== 0) {
      ctx.fillStyle = this.cssOf(clear);
      ctx.fillRect(0, 0, W, H);
    }
  }

  end(): void {
    this.setAlpha(1);
    this.setAdd(false);
    // Spend what is left of the scaling budget on sprites that were drawn from 1×.
    for (let i = 0; i < this.pending.length && this.scaleMs < this.scaleBudgetMs; i++) {
      const buf = this.pending[i];
      const e = this.cache.get(buf);
      const m = spriteFilter(spriteIdOf(buf), this.mode, this.k);
      if (e && m !== 'pixel' && !this.upToDate(e, m)) this.makeUp(buf, e, m);
    }
    this.pending.length = 0;
    this.evict();
    this.sweepStreams();
    this.lastStats = {
      entries: this.cache.size,
      px: this.cachePx,
      budgetPx: this.budgetPx,
      scaled: this.scaledCount,
      deferred: this.deferredCount,
      scaleMs: this.scaleMs,
      evicted: this.evicted,
      streams: this.streamList.length,
      streamUploads: this.streamUploads,
    };
  }

  setCamera(x: number, y: number): void {
    const k = this.k;
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
    const flipX = o?.flipX === true;
    const flipY = o?.flipY === true;
    const k = this.k;
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
      flipX,
      flipY,
      k,
    );
    this.blit(f.buf, p.x, p.y, flipX, flipY, o, true, d);
  }

  image(buf: PixelBuffer, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.k;
    const fine = !screen && this.subpixel === 'all';
    const left = toPx(x, k, fine) - (screen ? 0 : this.cx);
    const top = toPx(y, k, fine) - (screen ? 0 : this.cy);
    this.blit(buf, left, top, o?.flipX === true, o?.flipY === true, o, false);
  }

  rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.k;
    const fine = !screen && this.subpixel === 'all';
    const left = toPx(x, k, fine) - (screen ? 0 : this.cx);
    const top = toPx(y, k, fine) - (screen ? 0 : this.cy);
    const rw = Math.round(w);
    const rh = Math.round(h);
    if (rw <= 0 || rh <= 0 || (c & 255) === 0) return;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(o?.blend === 'add');
    if (this.alpha <= 0) return;
    this.ctx.fillStyle = this.cssOf(solidColor(c, o));
    this.ctx.fillRect(left, top, rw * k, rh * k);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const k = this.k;
    if ((c & 255) === 0) return;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(o?.blend === 'add');
    if (this.alpha <= 0) return;
    this.ctx.fillStyle = this.cssOf(solidColor(c, o));
    // Whole logical pixels relative to the camera's whole-pixel part; the rest shifts the blocks.
    const ix = screen ? 0 : Math.floor(this.cx / k);
    const iy = screen ? 0 : Math.floor(this.cy / k);
    this.lineFx = screen ? 0 : this.cx - ix * k;
    this.lineFy = screen ? 0 : this.cy - iy * k;
    const e = this.ends;
    if (!clipLine(e, Math.round(x0) - ix, Math.round(y0) - iy, Math.round(x1) - ix, Math.round(y1) - iy, this.w, this.h)) return;
    this.runW = 0;
    traceLine(e.x0, e.y0, e.x1, e.y1, this.plotLine);
    if (this.runW > 0) this.flushRun();
    this.runW = 0;
  }

  text(s: string, x: number, y: number, o?: TextOpts): void {
    const screen = o?.screen !== false;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(false);
    if (this.alpha <= 0 || s.length === 0) return;
    const k = this.k;
    const fine = !screen && this.subpixel === 'all';
    this.textFont = getFont(o?.font);
    this.textScale = textScale(o);
    this.textAlign = o?.align ?? 'left';
    this.textX = toPx(x, k, fine) - (screen ? 0 : this.cx);
    this.textY = toPx(y, k, fine) - (screen ? 0 : this.cy);
    this.textStr = s;
    textPasses(o, this.textPass);
    this.textStr = '';
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
    const k = this.k;
    const fine = this.subpixel !== 'off';
    const sx = parallaxOrigin(offsetX, layerCam(this.camX, this.exactX, factorX, k, this.subpixel), factorX, k, fine);
    const sy = parallaxOrigin(offsetY, layerCam(this.camY, this.exactY, factorY, k, this.subpixel), factorY, k, fine);
    // A 2× layer tiles by its logical size; below res d it is drawn as its 1× reduction.
    const d = Math.max(1, Math.floor(o?.density ?? 1));
    const src = d > k ? lowRes(buf, d) : buf;
    const f = d > k ? 1 : d;
    const tw = (src.w / f) * k;
    const th = (src.h / f) * k;
    const repeatX = o?.repeatX !== false;
    const repeatY = o?.repeatY === true;
    const x0 = repeatX ? firstTile(sx, tw) : sx;
    const y0 = repeatY ? firstTile(sy, th) : sy;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(false);
    if (this.alpha <= 0) return;
    const img = this.variant(src, false, false, null, 'pixel');
    const W = this.canvas.width;
    const H = this.canvas.height;
    for (let ty = y0; ty < H; ty += th) {
      for (let tx = x0; tx < W; tx += tw) {
        if (tx + tw > 0 && ty + th > 0) {
          if (k === 1) this.ctx.drawImage(img, tx, ty);
          else this.ctx.drawImage(img, tx, ty, tw, th);
        }
        if (!repeatX) break;
      }
      if (!repeatY) break;
    }
  }

  fade(c: Color, alpha: number): void {
    if (alpha <= 0 || (c & 255) === 0) return;
    this.setAlpha(alpha);
    this.setAdd(false);
    this.ctx.fillStyle = this.cssOf(c);
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Drop the cached canvases and the stream slot of one buffer (they are rebuilt on next use). */
  forget(buf: PixelBuffer): void {
    const s = this.streamMap.get(buf);
    if (s) this.dropStream(this.streamList.indexOf(s));
    const e = this.cache.get(buf);
    if (!e) return;
    this.cachePx -= e.px;
    this.cache.delete(buf);
  }

  /** Drop every upscaled copy (a mode change); 1× textures stay. */
  clearUpscaled(): void {
    for (const e of this.cache.values()) this.dropUp(e);
  }

  // ------------------------------------------------------------------ internals

  private flushRun(): void {
    const k = this.k;
    this.ctx.fillRect(this.runX * k - this.lineFx, this.runY * k - this.lineFy, this.runW * k, this.runH * k);
  }

  /**
   * Draw a buffer (top-left at backbuffer px left/top) or its `src` part. `sprite`: a frame,
   * which may go through the upscaler. `d`: the frame's density (buffer px per logical px; 2× art
   * is never filtered, and drawn as `lowRes` below res d).
   */
  private blit(buf: PixelBuffer, left: number, top: number, flipX: boolean, flipY: boolean, o: DrawOpts | undefined, sprite: boolean, d = 1): void {
    const k = this.k;
    const lw = d === 1 ? buf.w : buf.w / d;
    const lh = d === 1 ? buf.h : buf.h / d;
    if (left >= this.canvas.width || top >= this.canvas.height || left + lw * k <= 0 || top + lh * k <= 0) return;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(o?.blend === 'add');
    if (this.alpha <= 0) return;
    const tint = o?.tint ?? (o?.flash ? WHITE : null);
    const m: UpscaleMode = sprite && d === 1 && k > 1 && this.mode !== 'pixel' ? spriteFilter(spriteIdOf(buf), this.mode, k) : 'pixel';
    // Streamed buffer (plain draw only): its slot, refilled in place, never the texture cache.
    if (o?.stream === true && tint === null && !flipX && !flipY && !o.src && m === 'pixel' && d <= k) {
      const c = this.streamCanvas(buf);
      if (k === 1 && d === 1) this.ctx.drawImage(c, left, top);
      else this.ctx.drawImage(c, left, top, lw * k, lh * k);
      return;
    }
    // The texture source and its px per logical px: the buffer, or the 1× reduction of a 2×
    // buffer below res d.
    const src = d > k ? lowRes(buf, d) : buf;
    const sd = d > k ? 1 : d;
    let f = sd * upscaleFactor(m);
    const img = this.variant(src, flipX, flipY, tint, m);
    // The upscaled copy may not be ready (scaling budget): then this is the 1× texture.
    if (!this.variantUp) f = sd;
    if (o?.src) {
      const p = this.part;
      if (placePart(p, lw, lh, o.src, left, top, flipX, flipY, k)) {
        this.ctx.drawImage(img, p.sx * f, p.sy * f, p.sw * f, p.sh * f, p.dx, p.dy, p.sw * k, p.sh * k);
      }
      return;
    }
    if (k === 1 && f === 1) this.ctx.drawImage(img, left, top);
    else this.ctx.drawImage(img, left, top, lw * k, lh * k);
  }

  /** Cache entry of a buffer, moved to the young end of the LRU once per frame. */
  private entry(buf: PixelBuffer): CacheEntry {
    let e = this.cache.get(buf);
    if (!e) {
      e = { version: buf.version, plain: [], tinted: null, up: null, upMode: null, px: 0, used: this.frameNo };
      this.cache.set(buf, e);
      return e;
    }
    if (e.used !== this.frameNo) {
      e.used = this.frameNo;
      this.cache.delete(buf);
      this.cache.set(buf, e);
    }
    if (e.version !== buf.version) {
      this.cachePx -= e.px;
      e.version = buf.version;
      e.plain = [];
      e.tinted = null;
      e.up = null;
      e.upMode = null;
      e.px = 0;
    }
    return e;
  }

  private upToDate(e: CacheEntry, m: UpscaleMode): boolean {
    return e.up !== null && e.upMode === m;
  }

  /** Upscale now with filter `m` (counts against the frame's scaling budget). */
  private makeUp(buf: PixelBuffer, e: CacheEntry, m: UpscaleMode): void {
    this.dropUp(e);
    const t0 = now();
    const up = upscale(buf, m);
    this.scaleMs += now() - t0;
    this.scaledCount++;
    e.up = up;
    e.upMode = m;
    this.grow(e, up.w * up.h);
  }

  /** Forget the upscaled copy and its canvases. */
  private dropUp(e: CacheEntry): void {
    if (e.up) this.grow(e, -e.up.w * e.up.h);
    e.up = null;
    e.upMode = null;
    for (let i = 4; i < 8; i++) this.dropCanvas(e, e.plain, i);
    if (e.tinted) for (const list of e.tinted.values()) for (let i = 4; i < 8; i++) this.dropCanvas(e, list, i);
  }

  private dropCanvas(e: CacheEntry, list: Variants, i: number): void {
    const c = list[i];
    if (!c) return;
    this.grow(e, -c.width * c.height);
    list[i] = undefined;
  }

  private grow(e: CacheEntry, px: number): void {
    e.px += px;
    this.cachePx += px;
  }

  /** Texture of a buffer variant; `m` = the filter wanted ('pixel' = the 1× texture). */
  private variant(buf: PixelBuffer, flipX: boolean, flipY: boolean, tint: Color | null, m: UpscaleMode): AnyCanvas {
    const e = this.entry(buf);
    let up = false;
    if (m !== 'pixel') {
      if (!this.upToDate(e, m)) {
        if (this.scaleMs < this.scaleBudgetMs) this.makeUp(buf, e, m);
        else {
          this.deferredCount++;
          this.pending.push(buf);
        }
      }
      up = this.upToDate(e, m);
    }
    let list = e.plain;
    if (tint !== null) {
      e.tinted ??= new Map();
      const key = tint >>> 0;
      let t = e.tinted.get(key);
      if (!t) {
        t = [];
        e.tinted.set(key, t);
      }
      list = t;
    }
    this.variantUp = up;
    const i = (flipX ? 1 : 0) | (flipY ? 2 : 0) | (up ? 4 : 0);
    let c = list[i];
    if (!c) {
      c = upload(up && e.up ? e.up : buf, flipX, flipY, tint);
      list[i] = c;
      this.grow(e, c.width * c.height);
    }
    return c;
  }

  /** The stream slot canvas of a buffer, refilled if the buffer changed since the last upload. */
  private streamCanvas(buf: PixelBuffer): AnyCanvas {
    let s = this.streamMap.get(buf);
    if (!s) {
      const canvas = makeCanvas(buf.w, buf.h);
      const ctx = context(canvas);
      const img = ctx.createImageData(buf.w, buf.h);
      const words = new Uint32Array(img.data.buffer, img.data.byteOffset, buf.w * buf.h);
      s = { buf, canvas, ctx, img, words, version: -1, used: this.frameNo };
      this.streamMap.set(buf, s);
      this.streamList.push(s);
    }
    s.used = this.frameNo;
    if (s.version !== buf.version) {
      s.version = buf.version;
      const src = buf.data;
      const out = s.words;
      const n = out.length;
      if (LITTLE_ENDIAN) {
        // 0xRRGGBBAA → bytes R, G, B, A = the word 0xAABBGGRR. Transparent pixels become 0, as
        // in upload().
        for (let i = 0; i < n; i++) {
          const p = src[i];
          out[i] = (p & 255) === 0 ? 0 : (p >>> 24) | ((p >>> 8) & 0xff00) | ((p & 0xff00) << 8) | (p << 24);
        }
      } else {
        for (let i = 0; i < n; i++) {
          const p = src[i];
          out[i] = (p & 255) === 0 ? 0 : p;
        }
      }
      s.ctx.putImageData(s.img, 0, 0);
      this.streamUploads++;
    }
    return s.canvas;
  }

  /** Drop the stream slots not drawn for STREAM_IDLE_FRAMES frames. */
  private sweepStreams(): void {
    const list = this.streamList;
    for (let i = list.length - 1; i >= 0; i--) {
      if (this.frameNo - list[i].used > STREAM_IDLE_FRAMES) this.dropStream(i);
    }
  }

  /** Remove stream slot `i` (swap with the last one). */
  private dropStream(i: number): void {
    const list = this.streamList;
    if (i < 0 || i >= list.length) return;
    const s = list[i];
    this.streamMap.delete(s.buf);
    list[i] = list[list.length - 1];
    list.pop();
  }

  /** Drop the least recently used entries until the cache fits its budget (never this frame's). */
  private evict(): void {
    if (this.cachePx <= this.budgetPx) return;
    for (const [buf, e] of this.cache) {
      if (this.cachePx <= this.budgetPx) break;
      if (e.used === this.frameNo) break; // the rest is younger
      this.cachePx -= e.px;
      this.cache.delete(buf);
      this.evicted++;
    }
  }

  private atlas(font: BitmapFont, color: Color): AnyCanvas {
    let byColor = this.atlases.get(font.id);
    if (!byColor) {
      byColor = new Map();
      this.atlases.set(font.id, byColor);
    }
    let a = byColor.get(color);
    if (!a) {
      a = upload(glyphAtlas(font, color), false, false, null);
      byColor.set(color, a);
    }
    return a;
  }

  private cssOf(c: Color): string {
    let s = this.css.get(c);
    if (s === undefined) {
      s = toCss(c);
      if (this.css.size > 512) this.css.clear();
      this.css.set(c, s);
    }
    return s;
  }

  private setAlpha(a: number): void {
    const v = a <= 0 ? 0 : a >= 1 ? 1 : a;
    if (v !== this.alpha) {
      this.alpha = v;
      this.ctx.globalAlpha = v;
    }
  }

  private setAdd(on: boolean): void {
    if (on !== this.add) {
      this.add = on;
      this.ctx.globalCompositeOperation = on ? 'lighter' : 'source-over';
    }
  }
}
