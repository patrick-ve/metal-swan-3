import type { Color } from './color';
import { BLACK, toCss, WHITE } from './color';
import type { BitmapFont, Glyph } from './font';
import { getFont, glyphAtlas, layoutText, textPasses, textScale } from './font';
import type { PixelBuffer } from './pixel';
import { traceLine } from './pixel';
import type { DrawOpts, Frame, ParallaxOpts, Renderer, TextOpts } from './render';
import { VIEW_H, VIEW_W } from './render';
import type { LineEnds, Part, Placement } from './render-common';
import { clipLine, firstTile, parallaxOrigin, placeAnchored, placePart, solidColor } from './render-common';
import { getFrame } from './sprites';

/**
 * Canvas 2D renderer drawing into a VIEW_W × VIEW_H backbuffer canvas (present it with
 * display.browser.ts). Every PixelBuffer is uploaded once per variant — normal, flipped X/Y and
 * white "flash" silhouettes — and cached in a WeakMap keyed by the buffer. The variants are
 * computed in TypeScript, so pixels match the software renderer exactly; only alpha / additive
 * blends may differ by ±1 per channel. A buffer whose `version` changed is re-uploaded.
 */

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface CacheEntry {
  version: number;
  /** Untinted variants, index flipX | flipY << 1. */
  plain: (AnyCanvas | undefined)[];
  /** Silhouette variants per tint colour (white = hit flash). */
  tinted: Map<number, (AnyCanvas | undefined)[]> | null;
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

export class CanvasRenderer implements Renderer {
  readonly w: number;
  readonly h: number;
  /** The backbuffer. */
  readonly canvas: AnyCanvas;
  readonly ctx: AnyContext;
  camX = 0;
  camY = 0;

  private readonly cache = new WeakMap<PixelBuffer, CacheEntry>();
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
    const s = this.textScale;
    if (this.textAtlas) this.ctx.drawImage(this.textAtlas, g.index * (f.maxW + 1), 0, g.w, f.height, x, y, g.w * s, f.height * s);
  };
  private textAlign: 'left' | 'center' | 'right' = 'left';
  private textX = 0;
  private textY = 0;
  private textStr = '';
  private readonly textPass = (color: Color, dx: number, dy: number): void => {
    this.textAtlas = this.atlas(this.textFont, color);
    layoutText(this.textStr, this.textX + dx, this.textY + dy, this.textFont, this.textAlign, this.drawGlyphAt, this.textScale);
  };
  // Line pixels are merged into horizontal or vertical runs, one fillRect each.
  private runX = 0;
  private runY = 0;
  private runW = 0;
  private runH = 0;
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
      this.ctx.fillRect(this.runX, this.runY, this.runW, this.runH);
    }
    this.runX = x;
    this.runY = y;
    this.runW = 1;
    this.runH = 1;
  };

  constructor(w = VIEW_W, h = VIEW_H, canvas?: AnyCanvas) {
    this.w = w;
    this.h = h;
    this.canvas = canvas ?? makeCanvas(w, h);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = context(this.canvas);
  }

  begin(clear: Color | null = BLACK): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.setAlpha(1);
    this.setAdd(false);
    if (clear === null) return;
    if ((clear & 255) !== 255) ctx.clearRect(0, 0, this.w, this.h);
    if ((clear & 255) !== 0) {
      ctx.fillStyle = this.cssOf(clear);
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  end(): void {
    this.setAlpha(1);
    this.setAdd(false);
  }

  setCamera(x: number, y: number): void {
    this.camX = Math.round(x);
    this.camY = Math.round(y);
  }

  sprite(id: string, frameIndex: number, x: number, y: number, o?: DrawOpts): void {
    this.frame(getFrame(id, frameIndex), x, y, o);
  }

  frame(f: Frame, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const flipX = o?.flipX === true;
    const flipY = o?.flipY === true;
    const p = placeAnchored(this.place, f.buf.w, f.buf.h, f.ox, f.oy, x, y, flipX, flipY, screen ? 0 : this.camX, screen ? 0 : this.camY);
    this.blit(f.buf, p.x, p.y, flipX, flipY, o);
  }

  image(buf: PixelBuffer, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    this.blit(buf, Math.round(x) - (screen ? 0 : this.camX), Math.round(y) - (screen ? 0 : this.camY), o?.flipX === true, o?.flipY === true, o);
  }

  rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const left = Math.round(x) - (screen ? 0 : this.camX);
    const top = Math.round(y) - (screen ? 0 : this.camY);
    const rw = Math.round(w);
    const rh = Math.round(h);
    if (rw <= 0 || rh <= 0 || (c & 255) === 0) return;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(o?.blend === 'add');
    if (this.alpha <= 0) return;
    this.ctx.fillStyle = this.cssOf(solidColor(c, o));
    this.ctx.fillRect(left, top, rw, rh);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const cx = screen ? 0 : this.camX;
    const cy = screen ? 0 : this.camY;
    if ((c & 255) === 0) return;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(o?.blend === 'add');
    if (this.alpha <= 0) return;
    this.ctx.fillStyle = this.cssOf(solidColor(c, o));
    const e = this.ends;
    if (!clipLine(e, Math.round(x0) - cx, Math.round(y0) - cy, Math.round(x1) - cx, Math.round(y1) - cy, this.w, this.h)) return;
    this.runW = 0;
    traceLine(e.x0, e.y0, e.x1, e.y1, this.plotLine);
    if (this.runW > 0) this.ctx.fillRect(this.runX, this.runY, this.runW, this.runH);
    this.runW = 0;
  }

  text(s: string, x: number, y: number, o?: TextOpts): void {
    const screen = o?.screen !== false;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(false);
    if (this.alpha <= 0 || s.length === 0) return;
    this.textFont = getFont(o?.font);
    this.textScale = textScale(o);
    this.textAlign = o?.align ?? 'left';
    this.textX = Math.round(x) - (screen ? 0 : this.camX);
    this.textY = Math.round(y) - (screen ? 0 : this.camY);
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
    const sx = parallaxOrigin(offsetX, this.camX, factorX);
    const sy = parallaxOrigin(offsetY, this.camY, factorY);
    const repeatX = o?.repeatX !== false;
    const repeatY = o?.repeatY === true;
    const x0 = repeatX ? firstTile(sx, buf.w) : sx;
    const y0 = repeatY ? firstTile(sy, buf.h) : sy;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(false);
    if (this.alpha <= 0) return;
    const img = this.variant(buf, false, false, null);
    for (let ty = y0; ty < this.h; ty += buf.h) {
      for (let tx = x0; tx < this.w; tx += buf.w) {
        if (tx + buf.w > 0 && ty + buf.h > 0) this.ctx.drawImage(img, tx, ty);
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
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  /** Drop the cached canvases of one buffer (they are rebuilt on next use). */
  forget(buf: PixelBuffer): void {
    this.cache.delete(buf);
  }

  // ------------------------------------------------------------------ internals

  private blit(buf: PixelBuffer, left: number, top: number, flipX: boolean, flipY: boolean, o?: DrawOpts): void {
    if (left >= this.w || top >= this.h || left + buf.w <= 0 || top + buf.h <= 0) return;
    this.setAlpha(o?.alpha ?? 1);
    this.setAdd(o?.blend === 'add');
    if (this.alpha <= 0) return;
    const tint = o?.tint ?? (o?.flash ? WHITE : null);
    const img = this.variant(buf, flipX, flipY, tint);
    if (o?.src) {
      const p = this.part;
      if (placePart(p, buf.w, buf.h, o.src, left, top, flipX, flipY)) {
        this.ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.sw, p.sh);
      }
      return;
    }
    this.ctx.drawImage(img, left, top);
  }

  private variant(buf: PixelBuffer, flipX: boolean, flipY: boolean, tint: Color | null): AnyCanvas {
    let e = this.cache.get(buf);
    if (!e || e.version !== buf.version) {
      e = { version: buf.version, plain: [], tinted: null };
      this.cache.set(buf, e);
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
    const k = (flipX ? 1 : 0) | (flipY ? 2 : 0);
    let c = list[k];
    if (!c) {
      c = upload(buf, flipX, flipY, tint);
      list[k] = c;
    }
    return c;
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
