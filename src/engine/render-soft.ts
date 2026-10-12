import type { Color } from './color';
import { BLACK, WHITE } from './color';
import { drawText } from './font';
import type { BlitOpts } from './pixel';
import { PixelBuffer, traceLine } from './pixel';
import type { DrawOpts, Frame, ParallaxOpts, Renderer, TextOpts } from './render';
import { VIEW_H, VIEW_W } from './render';
import type { LineEnds, Part, Placement } from './render-common';
import { clipLine, firstTile, parallaxOrigin, placeAnchored, placePart, solidColor } from './render-common';
import { getFrame } from './sprites';

/**
 * Pure-TypeScript renderer into a PixelBuffer (node tools, tests, headless screenshots).
 * It implements the full Renderer contract and gives the same pixels as the Canvas 2D renderer
 * (blended pixels may differ by ±1 per channel because of Canvas rounding).
 */
export class SoftRenderer implements Renderer {
  readonly w: number;
  readonly h: number;
  /** The image being drawn (opaque after begin()). */
  readonly target: PixelBuffer;
  camX = 0;
  camY = 0;

  // Reused per call: no allocations while drawing.
  private readonly place: Placement = { x: 0, y: 0 };
  private readonly ends: LineEnds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private readonly part: Part = { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0 };
  private readonly bo: BlitOpts = {};
  private lineColor: Color = 0;
  private lineAlpha = 1;
  private lineAdd = false;
  private readonly plotLine = (x: number, y: number): void => {
    if (this.lineAlpha >= 1 && !this.lineAdd && (this.lineColor & 255) === 255) {
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.target.data[y * this.w + x] = this.lineColor;
    } else {
      this.target.blendPixel(x, y, this.lineColor, this.lineAlpha, this.lineAdd ? 'add' : 'over');
    }
  };

  constructor(w = VIEW_W, h = VIEW_H, target?: PixelBuffer) {
    this.w = w;
    this.h = h;
    this.target = target ?? new PixelBuffer(w, h);
  }

  begin(clear: Color | null = BLACK): void {
    if (clear !== null) this.target.fill(clear);
  }

  end(): void {
    this.target.touch();
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
    const p = placeAnchored(
      this.place,
      f.buf.w,
      f.buf.h,
      f.ox,
      f.oy,
      x,
      y,
      o?.flipX === true,
      o?.flipY === true,
      screen ? 0 : this.camX,
      screen ? 0 : this.camY,
    );
    this.draw(f.buf, p.x, p.y, o);
  }

  image(buf: PixelBuffer, x: number, y: number, o?: DrawOpts): void {
    const screen = o?.screen === true;
    this.draw(buf, Math.round(x) - (screen ? 0 : this.camX), Math.round(y) - (screen ? 0 : this.camY), o);
  }

  rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const left = Math.round(x) - (screen ? 0 : this.camX);
    const top = Math.round(y) - (screen ? 0 : this.camY);
    this.target.blendRect(left, top, Math.round(w), Math.round(h), solidColor(c, o), o?.alpha ?? 1, o?.blend === 'add' ? 'add' : 'over');
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, o?: DrawOpts): void {
    const screen = o?.screen === true;
    const cx = screen ? 0 : this.camX;
    const cy = screen ? 0 : this.camY;
    this.lineColor = solidColor(c, o);
    this.lineAlpha = o?.alpha ?? 1;
    this.lineAdd = o?.blend === 'add';
    if (this.lineAlpha <= 0 || (c & 255) === 0) return;
    const e = this.ends;
    if (!clipLine(e, Math.round(x0) - cx, Math.round(y0) - cy, Math.round(x1) - cx, Math.round(y1) - cy, this.w, this.h)) return;
    traceLine(e.x0, e.y0, e.x1, e.y1, this.plotLine);
    this.target.touch();
  }

  text(s: string, x: number, y: number, o?: TextOpts): void {
    const screen = o?.screen !== false;
    drawText(this.target, s, Math.round(x) - (screen ? 0 : this.camX), Math.round(y) - (screen ? 0 : this.camY), o);
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
    for (let ty = y0; ty < this.h; ty += buf.h) {
      for (let tx = x0; tx < this.w; tx += buf.w) {
        this.target.blit(buf, tx, ty, bo);
        if (!repeatX) break;
      }
      if (!repeatY) break;
    }
  }

  fade(c: Color, alpha: number): void {
    this.target.blendRect(0, 0, this.w, this.h, c, alpha, 'over');
  }

  /** Blit a whole image (top-left at left/top) or the `src` part of it. */
  private draw(buf: PixelBuffer, left: number, top: number, o: DrawOpts | undefined): void {
    const bo = this.bo;
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
    if (o?.src) {
      const p = this.part;
      if (!placePart(p, buf.w, buf.h, o.src, left, top, flipX, flipY)) return;
      // blit() mirrors its source rectangle in place, so pass the unflipped rectangle.
      bo.sx = flipX ? buf.w - p.sx - p.sw : p.sx;
      bo.sy = flipY ? buf.h - p.sy - p.sh : p.sy;
      bo.sw = p.sw;
      bo.sh = p.sh;
      this.target.blit(buf, p.dx, p.dy, bo);
      return;
    }
    this.target.blit(buf, left, top, bo);
  }
}
