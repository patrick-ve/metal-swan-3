import type { Color } from './color';
import { BLACK, toCss, WHITE } from './color';
import type { BitmapFont, Glyph, GlyphDensity, HdTextPass } from './font';
import { GLYPH_ATLAS_COLS, getFont, glyphAtlas, glyphDensity, hdAtlasCell, hdTextPasses, layoutText, textPasses, textScale } from './font';
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
  lowRes,
  reducedFor,
  reductionSource,
  rowShift,
  parallaxOrigin,
  placePart,
  solidColor,
  spriteFilter,
  toPx,
} from './render-common';
import { artTier, denseReleaseEpoch, getFrame, hiArtOn, isReleasedBuffer, spriteIdOf } from './sprites';
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
/** Texture budget at k ≥ 8 (art tier 4: 4× frames hold 4 times the pixels of 2× frames). */
export const TEXTURE_BUDGET_PX_K8 = 96_000_000;
/** Default time per frame spent uploading textures of dense frames (ms); see `blit`. */
export const UPLOAD_BUDGET_MS = 6;

/** The default texture budget for backbuffer res k: TEXTURE_BUDGET_PX, TEXTURE_BUDGET_PX_K8 at k ≥ 8. */
export function textureBudgetFor(k: number): number {
  return k >= 8 ? TEXTURE_BUDGET_PX_K8 : TEXTURE_BUDGET_PX;
}
/** Default time per frame spent upscaling sprites (ms). */
export const SCALE_BUDGET_MS = 4;

export interface CanvasRendererOpts {
  /** Backbuffer pixels per logical pixel (integer ≥ 1, default 1). */
  res?: number;
  mode?: UpscaleMode;
  subpixel?: SubpixelMode;
  /** Texture budget in pixels (default `textureBudgetFor(res)`, following setRes). */
  budgetPx?: number;
  scaleBudgetMs?: number;
  /** Upload time per frame for dense frames (default UPLOAD_BUDGET_MS). */
  uploadBudgetMs?: number;
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
  /** The bytes of `img` (RGBA): a big-endian 32-bit write of a Color (0xRRGGBBAA) stores R, G, B, A. */
  bytes: DataView;
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
  /** Time spent uploading textures in the last frame (ms). */
  uploadMs: number;
  /** Dense frames drawn from their 1× reduction because the upload budget ran out (last frame). */
  uploadDeferred: number;
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

/**
 * Scratch ImageData reused by every upload (grown to the largest buffer seen, at most
 * UPLOAD_SCRATCH_MAX_PX; larger buffers get their own) and its bytes as 32-bit words.
 */
let scratchImg: ImageData | null = null;
let scratchWords: Uint32Array | null = null;
/** Largest scratch ImageData kept for reuse (pixels; 4 bytes each). */
const UPLOAD_SCRATCH_MAX_PX = 4_194_304;

/** A word in canvas byte order (R, G, B, A in memory) for a 0xRRGGBBAA pixel. */
function swizzle(p: number): number {
  return LITTLE_ENDIAN ? ((p >>> 24) | ((p >>> 8) & 0xff00) | ((p & 0xff00) << 8) | (p << 24)) >>> 0 : p >>> 0;
}

/**
 * Upload a buffer variant (pixels computed in TS) into a new canvas; `tint` = silhouette colour.
 * One pass of 32-bit word swizzles into a reused ImageData (no per-channel byte writes);
 * transparent pixels become 0.
 */
function upload(buf: PixelBuffer, flipX: boolean, flipY: boolean, tint: Color | null): AnyCanvas {
  const { w, h } = buf;
  const c = makeCanvas(Math.max(1, w), Math.max(1, h));
  if (w === 0 || h === 0) return c;
  const ctx = context(c);
  let img: ImageData;
  let words: Uint32Array;
  let stride: number;
  if (w * h > UPLOAD_SCRATCH_MAX_PX) {
    img = ctx.createImageData(w, h);
    words = new Uint32Array(img.data.buffer, img.data.byteOffset, w * h);
    stride = w;
  } else {
    if (!scratchImg || scratchImg.width < w || scratchImg.height < h) {
      const sw = Math.max(w, scratchImg?.width ?? 0);
      const sh = Math.max(h, scratchImg?.height ?? 0);
      scratchImg = sw * sh > UPLOAD_SCRATCH_MAX_PX ? ctx.createImageData(w, h) : ctx.createImageData(sw, sh);
      scratchWords = new Uint32Array(scratchImg.data.buffer, scratchImg.data.byteOffset, scratchImg.width * scratchImg.height);
    }
    img = scratchImg;
    words = scratchWords as Uint32Array;
    stride = img.width;
  }
  const src = buf.data;
  // Tint: the RGB of `tint`, the alpha of the pixel (as bytes R, G, B, A).
  const rgb = tint === null ? 0 : swizzle((tint & 0xffffff00) >>> 0);
  for (let y = 0; y < h; y++) {
    const row = (flipY ? h - 1 - y : y) * w;
    const o = y * stride;
    for (let x = 0; x < w; x++) {
      const p = src[row + (flipX ? w - 1 - x : x)];
      const a = p & 255;
      words[o + x] = a === 0 ? 0 : tint === null ? swizzle(p) : (rgb | (LITTLE_ENDIAN ? a << 24 : a)) >>> 0;
    }
  }
  ctx.putImageData(img, 0, 0, 0, 0, w, h);
  return c;
}

/**
 * A texture the caller owns (render.ts `RowsTexture`; the canal scenery, docs/api/canal.md): the
 * buffer uploaded once into its own canvas, outside every renderer's cache and budget. The caller
 * may drop the buffer and keeps the texture as long as it draws it.
 */
export function canvasTexture(buf: PixelBuffer): RowsTexture {
  return { w: buf.w, h: buf.h, tex: upload(buf, false, false, null) };
}

/**
 * The canal scenery's shear, as a canvas transform: a sub-pixel bias so the nearest sample of row j
 * (at its centre) lands on floor(shift) as the software renderer's row copy does (a GPU may round
 * its last bits either way; this keeps the tie away from the pixel edge).
 */
const SHEAR_BIAS = 1 / 64;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class CanvasRenderer implements Renderer {
  readonly w: number;
  readonly h: number;
  /** The backbuffer, (w · res) × (h · res). */
  readonly canvas: AnyCanvas;
  /** The context draws go to: the backbuffer's, or (an open layer, `layerBegin`) the layer's. */
  ctx: AnyContext;
  /** The backbuffer's context. */
  private readonly mainCtx: AnyContext;
  camX = 0;
  camY = 0;
  mode: UpscaleMode;
  subpixel: SubpixelMode;
  budgetPx: number;
  scaleBudgetMs: number;
  uploadBudgetMs: number;

  private k = 1;
  /** budgetPx follows the res (`textureBudgetFor`) unless the caller set it. */
  private autoBudget: boolean;
  private uploadMs = 0;
  private uploadDeferred = 0;
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
  private lastStats: TextureStats = { entries: 0, px: 0, budgetPx: 0, scaled: 0, deferred: 0, scaleMs: 0, evicted: 0, streams: 0, streamUploads: 0, uploadMs: 0, uploadDeferred: 0 };
  /** Stream slots: lookup by buffer, plus a list for the idle sweep (no iterator allocations). */
  private readonly streamMap = new Map<PixelBuffer, StreamSlot>();
  private readonly streamList: StreamSlot[] = [];
  private streamUploads = 0;
  /** `denseReleaseEpoch()` at the last sweep of released frames' textures. */
  private releaseSeen = 0;
  /** Glyph atlases by font, glyph density, pass and atlas scale (a number: no string per draw), then colour. */
  private readonly atlases = new Map<number, Map<number, AnyCanvas>>();
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
  // HD text (glyph density 2 / 4, font.ts `glyphDensity`): the pass, its atlas cell and art px size.
  private textD: GlyphDensity = 1;
  private textKind: HdTextPass = 'fill';
  private textCw = 0;
  private textCh = 0;
  /** Atlas px per art px: 1, or the art px size itself when it is uneven (k 3, 5: a 1:1 copy). */
  private textAs = 1;
  private readonly drawHdGlyphAt = (g: Glyph, x: number, y: number): void => {
    const a = this.textAtlas;
    if (!a) return;
    const D = this.textD;
    const f = (this.textScale * this.k) / D;
    const A = this.textAs;
    const ring = this.textKind === 'outline';
    const pad = ring ? 0 : D;
    const sx = Math.round(((g.index % GLYPH_ATLAS_COLS) * this.textCw + pad) * A);
    const sy = Math.round((Math.floor(g.index / GLYPH_ATLAS_COLS) * this.textCh + pad) * A);
    // Whole px: (g.w + 2 − 2·pad / D) cell px of scale·k backbuffer px.
    const dw = Math.round((g.w * D + 2 * (D - pad)) * f);
    const dh = Math.round((this.textFont.height * D + 2 * (D - pad)) * f);
    const back = ring ? D * f : 0;
    const sw = A === 1 ? dw / f : dw;
    const sh = A === 1 ? dh / f : dh;
    this.ctx.drawImage(a, sx, sy, sw, sh, this.textX + x * this.k - back, this.textY + y * this.k - back, dw, dh);
  };
  private readonly hdTextPass = (color: Color, kind: HdTextPass, dx: number, dy: number): void => {
    this.textAtlas = this.atlas(this.textFont, color, this.textD, kind, this.textAs);
    this.textKind = kind;
    layoutText(this.textStr, dx, dy, this.textFont, this.textAlign, this.drawHdGlyphAt, this.textScale);
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
    this.autoBudget = opts.budgetPx === undefined;
    this.budgetPx = opts.budgetPx ?? textureBudgetFor(this.k);
    this.scaleBudgetMs = opts.scaleBudgetMs ?? SCALE_BUDGET_MS;
    this.uploadBudgetMs = opts.uploadBudgetMs ?? UPLOAD_BUDGET_MS;
    this.canvas = canvas ?? makeCanvas(w * this.k, h * this.k);
    this.canvas.width = w * this.k;
    this.canvas.height = h * this.k;
    this.ctx = context(this.canvas);
    this.mainCtx = this.ctx;
  }

  get res(): number {
    return this.k;
  }

  /** Change the backbuffer resolution (re-sizes the canvas; the next begin() redraws it all). */
  setRes(k: number): void {
    const n = Math.max(1, Math.floor(k));
    if (n === this.k) return;
    this.k = n;
    if (this.autoBudget) this.budgetPx = textureBudgetFor(n);
    this.canvas.width = this.w * n;
    this.canvas.height = this.h * n;
    // Resizing resets the context state.
    this.ctx.imageSmoothingEnabled = false;
    this.alpha = 1;
    this.add = false;
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ the layer (render.ts `layerBegin`)

  private layerCanvas: AnyCanvas | null = null;
  private layerCtx: AnyContext | null = null;
  private addCanvas: AnyCanvas | null = null;
  private addCtx: AnyContext | null = null;
  private maskCanvas: AnyCanvas | null = null;
  private maskCtx: AnyContext | null = null;
  private maskImg: ImageData | null = null;
  private maskWords: Uint32Array | null = null;
  /** The mask buffer and its version last uploaded (the front pass reuses the back pass's mask). */
  private maskBuf: PixelBuffer | null = null;
  private maskVersion = -1;
  /** The mask px uploaded last time (x0, y0, x1, y1; empty: x1 ≤ x0). */
  private readonly maskUp = [0, 0, 0, 0];
  private layerOn = false;
  private layerClip = false;
  private addUsed = false;
  /** The open layer's box and the box of its last use (backbuffer px: x, y, w, h). */
  private readonly lbox = [0, 0, 0, 0];
  private readonly lused = [0, 0, 0, 0];

  /** Render.ts `layerBegin`: later draws go to the layer (cleared in `box`; clipped to it), additive ones to its twin. */
  layerBegin(box?: SrcRect): void {
    if (this.layerOn) this.layerEnd();
    this.rowsEnd();
    this.setAlpha(1);
    this.setAdd(false);
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!this.layerCanvas || this.layerCanvas.width !== W || this.layerCanvas.height !== H) {
      this.layerCanvas = makeCanvas(W, H);
      this.layerCtx = context(this.layerCanvas);
      this.addCanvas = makeCanvas(W, H);
      this.addCtx = context(this.addCanvas);
      this.addCtx.globalCompositeOperation = 'lighter';
      this.lused[0] = 0;
      this.lused[1] = 0;
      this.lused[2] = W;
      this.lused[3] = H;
    }
    const k = this.k;
    const b = this.lbox;
    if (box) {
      b[0] = Math.max(0, Math.floor(box.x * k));
      b[1] = Math.max(0, Math.floor(box.y * k));
      b[2] = Math.min(W, Math.ceil((box.x + box.w) * k)) - b[0];
      b[3] = Math.min(H, Math.ceil((box.y + box.h) * k)) - b[1];
    } else {
      b[0] = 0;
      b[1] = 0;
      b[2] = W;
      b[3] = H;
    }
    const lc = this.layerCtx as AnyContext;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    const u = this.lused;
    lc.clearRect(u[0], u[1], u[2], u[3]);
    lc.clearRect(b[0], b[1], b[2], b[3]);
    if (this.addUsed) (this.addCtx as AnyContext).clearRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) u[i] = b[i];
    this.addUsed = false;
    this.layerClip = box !== undefined;
    if (this.layerClip) {
      lc.save();
      lc.beginPath();
      lc.rect(b[0], b[1], b[2], b[3]);
      lc.clip();
    }
    this.layerOn = true;
    this.ctx = lc;
  }

  /** Render.ts `layerMask`: keep the layer's pixels where the mask (density d, world space at x, y) is opaque. */
  layerMask(mask: PixelBuffer, d: number, x: number, y: number, dirty?: SrcRect): void {
    if (!this.layerOn || mask.w === 0 || mask.h === 0) return;
    this.rowsEnd();
    if (!this.maskCanvas || this.maskCanvas.width !== mask.w || this.maskCanvas.height !== mask.h) {
      this.maskCanvas = makeCanvas(mask.w, mask.h);
      this.maskCtx = context(this.maskCanvas);
      this.maskImg = this.maskCtx.createImageData(mask.w, mask.h);
      this.maskWords = new Uint32Array(this.maskImg.data.buffer, this.maskImg.data.byteOffset, mask.w * mask.h);
      this.maskVersion = -1;
      dirty = undefined;
    }
    // Upload the changed part only (binary: opaque white or nothing, the same word on any machine):
    // `dirty` and the part uploaded last time (the mask may have changed on frames without an upload).
    const u = this.maskUp;
    const dt = dirty === undefined || this.maskBuf !== mask ? null : dirty;
    const x0 = dt ? Math.max(0, Math.min(u[0], Math.floor(dt.x))) : 0;
    const y0 = dt ? Math.max(0, Math.min(u[1], Math.floor(dt.y))) : 0;
    const x1 = dt ? Math.min(mask.w, Math.max(u[2], Math.ceil(dt.x + dt.w))) : mask.w;
    const y1 = dt ? Math.min(mask.h, Math.max(u[3], Math.ceil(dt.y + dt.h))) : mask.h;
    const fresh = this.maskBuf !== mask || this.maskVersion !== mask.version;
    if (fresh && dirty && dirty.w > 0 && dirty.h > 0) {
      u[0] = Math.floor(dirty.x);
      u[1] = Math.floor(dirty.y);
      u[2] = Math.ceil(dirty.x + dirty.w);
      u[3] = Math.ceil(dirty.y + dirty.h);
    } else if (fresh) {
      u[0] = mask.w;
      u[1] = mask.h;
      u[2] = 0;
      u[3] = 0;
    }
    this.maskBuf = mask;
    this.maskVersion = mask.version;
    if (fresh && x1 > x0 && y1 > y0) {
      const src = mask.data;
      const out = this.maskWords as Uint32Array;
      const mw = mask.w;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * mw;
        for (let xx = x0; xx < x1; xx++) out[row + xx] = (src[row + xx] & 255) === 0 ? 0 : 0xffffffff;
      }
      (this.maskCtx as AnyContext).putImageData(this.maskImg as ImageData, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }
    const k = this.k;
    const fine = this.subpixel === 'all';
    const left = toPx(x, k, fine) - this.cx;
    const top = toPx(y, k, fine) - this.cy;
    const lc = this.layerCtx as AnyContext;
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(this.maskCanvas, left, top, (mask.w * k) / d, (mask.h * k) / d);
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = this.ctx === lc ? this.alpha : 1;
  }

  /** Render.ts `layerShade`: `buf` (density 1, world space at x, y) over the layer's own pixels only (source-atop). */
  layerShade(buf: PixelBuffer, x: number, y: number): void {
    if (!this.layerOn || buf.w === 0 || buf.h === 0) return;
    this.rowsEnd();
    const k = this.k;
    const fine = this.subpixel === 'all';
    const left = toPx(x, k, fine) - this.cx;
    const top = toPx(y, k, fine) - this.cy;
    const c = this.streamCanvas(buf);
    const lc = this.layerCtx as AnyContext;
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-atop';
    lc.drawImage(c, left, top, buf.w * k, buf.h * k);
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = this.ctx === lc ? this.alpha : 1;
  }

  /** Render.ts `layerEnd`: the layer over the backbuffer in its box, then the additive twin added. */
  layerEnd(): void {
    if (!this.layerOn) return;
    this.rowsEnd();
    const lc = this.layerCtx as AnyContext;
    if (this.layerClip) lc.restore();
    this.layerOn = false;
    this.layerClip = false;
    this.ctx = this.mainCtx;
    const m = this.mainCtx;
    m.globalAlpha = 1;
    m.globalCompositeOperation = 'source-over';
    this.alpha = 1;
    this.add = false;
    const b = this.lbox;
    if (b[2] > 0 && b[3] > 0) m.drawImage(this.layerCanvas as AnyCanvas, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]);
    if (this.addUsed) {
      m.globalCompositeOperation = 'lighter';
      m.drawImage(this.addCanvas as AnyCanvas, 0, 0);
      m.globalCompositeOperation = 'source-over';
    }
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
    // An open layer is dropped (not drawn).
    if (this.layerOn) {
      if (this.layerClip) (this.layerCtx as AnyContext).restore();
      this.layerOn = false;
      this.layerClip = false;
      this.ctx = this.mainCtx;
      this.ctx.globalAlpha = this.alpha;
      this.ctx.globalCompositeOperation = this.add ? 'lighter' : 'source-over';
    }
    const ctx = this.ctx;
    this.frameNo++;
    this.scaleMs = 0;
    this.scaledCount = 0;
    this.deferredCount = 0;
    this.uploadMs = 0;
    this.uploadDeferred = 0;
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
    this.rowsEnd();
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
    if (this.releaseSeen !== denseReleaseEpoch()) this.sweepReleased();
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
      uploadMs: this.uploadMs,
      uploadDeferred: this.uploadDeferred,
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
    // Glyph density 1: the bitmap atlas as k × k blocks; 2 / 4: the HD glyphs (font.ts).
    const D = glyphDensity(k, hiArtOn() ? artTier() : 1, this.textScale);
    if (D === 1) textPasses(o, this.textPass);
    else {
      this.textD = D;
      const cell = hdAtlasCell(this.textFont, D);
      this.textCw = cell.cw;
      this.textCh = cell.ch;
      // Uneven art px (scale·k / D not whole): an atlas drawn at that size (font.ts `glyphEdge`),
      // copied 1:1, so Canvas places every art px as the software renderer does.
      const f = (this.textScale * k) / D;
      this.textAs = Number.isInteger(f) ? 1 : f;
      hdTextPasses(o, this.hdTextPass);
    }
    this.textStr = '';
    this.textAtlas = null;
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
    // A dense layer tiles by its logical size; below res d it is drawn reduced (4 → 2 → 1).
    const d = Math.max(1, Math.floor(o?.density ?? 1));
    const src = reducedFor(buf, d, k);
    const f = drawDensity(d, k);
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

  /** The scratch strip of the sheared `rows` draws at res ≠ d (one strip row per image row of the screen; grown when needed). */
  private shearStrip: AnyCanvas | null = null;
  private shearCtx: AnyContext | null = null;
  /** The strip's pending rows [stripR0, stripR1) (image rows of the screen) and their k / d (0: nothing pending). */
  private stripR0 = 0;
  private stripR1 = 0;
  private stripM = 0;

  /**
   * The canal scenery (render.ts `rows`). One speed: one `drawImage` at whole backbuffer px. A
   * shear at res = d: ONE `drawImage` under a transform with an x shear (image row j's centre moves
   * by the shift of row j). A shear at res ≠ d: ONE sheared `drawImage` into a scratch strip (one
   * strip row per image row, k / d backbuffer px per image px across); the strip is drawn k / d rows
   * tall at `rowsEnd` (one draw per layer), so every image row stays one rigid row as in the
   * software renderer.
   */
  rows(img: PixelBuffer | RowsTexture, d: number, x: number, y: number, o: RowsDraw): void {
    const W = img.w;
    const H = img.h;
    if (W === 0 || H === 0) return;
    const k = this.k;
    const m = k / d;
    const left = Math.round(x * k);
    const top = Math.round(y * k);
    const cw = this.canvas.width;
    const a0 = left - rowShift(o, 0, k);
    const a1 = left - rowShift(o, H - 1, k);
    if ((a0 >= cw && a1 >= cw) || (a0 + W * m <= 0 && a1 + W * m <= 0)) return;
    const src: CanvasImageSource = (img instanceof PixelBuffer ? this.variant(img, false, false, null, 'pixel') : img.tex) as CanvasImageSource;
    if (o.s0 === o.s1 || m === 1) this.rowsEnd();
    this.setAlpha(1);
    this.setAdd(false);
    const ctx = this.ctx;
    if (o.s0 === o.s1) {
      ctx.drawImage(src, a0, top, W * m, H * m);
      return;
    }
    // Row j's shift is A + B·j (before the floor): A at the image's first row.
    const n = Math.max(o.rows - 1, 1);
    const B = (o.cam * k * (o.s1 - o.s0)) / n;
    const A = (o.cam * (o.s0 + ((o.s1 - o.s0) * o.j0) / n) + o.add) * k;
    // Device x = m·u − B·v + E: at row centre v = j + ½ the sample u lands on (X − left + A + B·j − wrap + bias) / m.
    const E = B / 2 + 0.5 + left - A + o.wrap - SHEAR_BIAS;
    if (m === 1) {
      ctx.setTransform(1, 0, -B, 1, E, top);
      ctx.drawImage(src, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    if (this.stripM !== 0 && this.stripM !== m) this.rowsEnd();
    const r0 = Math.round(top / m);
    const sh = Math.ceil(this.canvas.height / m) + 1;
    if (!this.shearStrip || this.shearStrip.width < cw || this.shearStrip.height < sh) {
      this.shearStrip = makeCanvas(Math.max(cw, this.shearStrip?.width ?? 0), Math.max(sh, this.shearStrip?.height ?? 0));
      this.shearCtx = context(this.shearStrip);
    }
    const sc = this.shearCtx as AnyContext;
    sc.setTransform(m, 0, -B, 1, E, r0);
    sc.drawImage(src, 0, 0);
    sc.setTransform(1, 0, 0, 1, 0, 0);
    if (this.stripM === 0) {
      this.stripM = m;
      this.stripR0 = r0;
      this.stripR1 = r0 + H;
    } else {
      this.stripR0 = Math.min(this.stripR0, r0);
      this.stripR1 = Math.max(this.stripR1, r0 + H);
    }
  }

  /** The end of a canal layer (render.ts `rowsEnd`): the strip's pending rows go to the backbuffer, k / d rows each. */
  rowsEnd(): void {
    const m = this.stripM;
    if (m === 0 || !this.shearStrip) return;
    this.stripM = 0;
    const cw = this.canvas.width;
    const r0 = Math.max(0, this.stripR0);
    const r1 = Math.min(this.shearStrip.height, this.stripR1);
    if (r1 <= r0) return;
    this.setAlpha(1);
    this.setAdd(false);
    this.ctx.drawImage(this.shearStrip, 0, r0, cw, r1 - r0, 0, r0 * m, cw, (r1 - r0) * m);
    (this.shearCtx as AnyContext).clearRect(0, r0, cw, r1 - r0);
  }

  fade(c: Color, alpha: number): void {
    if (alpha <= 0 || (c & 255) === 0) return;
    this.setAlpha(alpha);
    this.setAdd(false);
    this.ctx.fillStyle = this.cssOf(c);
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * The 3D view's image (render.ts `surface`; docs/design/rally.md §12.2): one `drawImage` of the GL
   * canvas over the logical rectangle, nearest-neighbour (smoothing is off), no camera. Null: the
   * flat placeholder (sky over road).
   */
  surface(src: unknown, x: number, y: number, w: number, h: number): void {
    const k = this.k;
    this.setAlpha(1);
    this.setAdd(false);
    if (!src) {
      const top = Math.floor(h / 2);
      this.ctx.fillStyle = this.cssOf(SURFACE_SKY);
      this.ctx.fillRect(x * k, y * k, w * k, top * k);
      this.ctx.fillStyle = this.cssOf(SURFACE_ROAD);
      this.ctx.fillRect(x * k, (y + top) * k, w * k, (h - top) * k);
      return;
    }
    this.ctx.drawImage(src as CanvasImageSource, x * k, y * k, w * k, h * k);
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
    // The texture source and its px per logical px: the buffer, or its reduction below res d
    // (a 4× frame at k 2 or 3 → its 2× image, at k 1 → 1×).
    let src = reducedFor(buf, d, k);
    let sd = drawDensity(d, k);
    // Upload budget: a dense frame whose texture is not uploaded yet, once this frame's upload
    // time is spent, draws its 1× reduction this frame (d² fewer pixels); the full texture is
    // uploaded on a later frame.
    if (sd > 1 && this.uploadMs >= this.uploadBudgetMs && !this.hasTexture(src, flipX, flipY, tint)) {
      src = lowRes(buf, d);
      sd = 1;
      this.uploadDeferred++;
    }
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

  /** Is the plain (unfiltered) texture of this buffer variant uploaded and current? */
  private hasTexture(buf: PixelBuffer, flipX: boolean, flipY: boolean, tint: Color | null): boolean {
    const e = this.cache.get(buf);
    if (!e || e.version !== buf.version) return false;
    const list = tint === null ? e.plain : e.tinted?.get(tint >>> 0);
    return list?.[(flipX ? 1 : 0) | (flipY ? 2 : 0)] !== undefined;
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
      const t0 = now();
      c = upload(up && e.up ? e.up : buf, flipX, flipY, tint);
      this.uploadMs += now() - t0;
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
      const bytes = new DataView(img.data.buffer, img.data.byteOffset, buf.w * buf.h * 4);
      s = { buf, canvas, ctx, img, bytes, version: -1, used: this.frameNo };
      this.streamMap.set(buf, s);
      this.streamList.push(s);
    }
    s.used = this.frameNo;
    if (s.version !== buf.version) {
      s.version = buf.version;
      const src = buf.data;
      const out = s.bytes;
      const n = src.length;
      // 0xRRGGBBAA written big-endian = the bytes R, G, B, A on any machine (about twice as fast
      // as a word swizzle per pixel: the FPS view streams 270k px per frame at density 2).
      // Transparent pixels become 0, as in upload().
      for (let i = 0; i < n; i++) {
        const p = src[i];
        out.setUint32(i << 2, (p & 255) === 0 ? 0 : p, false);
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

  /**
   * Dense frames were released (sprites.ts `releaseDense`: the tier-4 working set moved on, or
   * stopped): drop the textures of their buffers (and of their reductions) now, so the cache does
   * not keep the released pixels alive until the LRU reaches them.
   */
  private sweepReleased(): void {
    this.releaseSeen = denseReleaseEpoch();
    for (const [buf, e] of this.cache) {
      if (e.used === this.frameNo || !isReleasedBuffer(reductionSource(buf))) continue;
      this.cachePx -= e.px;
      this.cache.delete(buf);
    }
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

  /** The glyph atlas of a font in one colour: the bitmap one (density 1) or an HD pass's at atlas scale `as` (font.ts `glyphAtlas`). */
  private atlas(font: BitmapFont, color: Color, d: GlyphDensity = 1, kind: HdTextPass = 'fill', as = 1): AnyCanvas {
    const key = (((font.id === 'big' ? 1 : 0) * 8 + d) * 4 + (kind === 'fill' ? 0 : kind === 'flat' ? 1 : 2)) * 256 + Math.round(as * 8);
    let byColor = this.atlases.get(key);
    if (!byColor) {
      byColor = new Map();
      this.atlases.set(key, byColor);
    }
    let a = byColor.get(color);
    if (!a) {
      a = upload(glyphAtlas(font, color, d, kind, as), false, false, null);
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
    if (this.layerOn) {
      // An open layer: additive draws go to its twin (its composite stays 'lighter'), the rest to the layer.
      const want = (on ? this.addCtx : this.layerCtx) as AnyContext;
      if (on) this.addUsed = true;
      this.add = on;
      if (this.ctx !== want) {
        this.ctx = want;
        want.globalAlpha = this.alpha;
      }
      return;
    }
    if (on !== this.add) {
      this.add = on;
      this.ctx.globalCompositeOperation = on ? 'lighter' : 'source-over';
    }
  }
}
