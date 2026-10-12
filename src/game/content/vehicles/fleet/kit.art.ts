/**
 * Small drawing kit shared by the fleet's art modules (./sundae.art.ts, ./bandwagon.art.ts,
 * ./trumpeter.art.ts, ./shots.art.ts): a body-space sheet on top of the house `Composer`, the
 * fleet's ramps, a 3×5 sign-writer font, and strip helpers. No sprites are registered here.
 *
 * Body space: x forward (sprites face right), y down, (0, 0) = the anchor. A `Sheet` maps body
 * space onto its buffer with a fixed origin, so every part is drawn with the same numbers the
 * logic uses (./numbers.ts).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { Composer, shadeLayer, type ShadeOpts } from '../../../art/paint';

export type Pt = readonly [number, number];

// ------------------------------------------------------------------------------------ ramps

/** Pastel van pink: deep, shadow, base, cream highlight. */
export const PINK: Ramp = [PAL.pink[0], PAL.pink[1], PAL.pink[2], PAL.skinA[3]];
/** Mint trim (stripes, awning). */
export const MINT: Ramp = [PAL.teal[0], PAL.teal[1], PAL.teal[2], PAL.teal[3]];
/** Waffle cone. */
export const WAFFLE: Ramp = PAL.sand;
/** Vanilla scoop. */
export const VANILLA: Ramp = PAL.cloth;
/** Parade red (the Bandwagon). */
export const RED: Ramp = PAL.red;
/** Chrome (bumpers, grille, rims). */
export const CHROME: Ramp = PAL.steel;
/** Brass (bell, cymbals, trim). */
export const BRASS: Ramp = PAL.gold;
/** Window glass. */
export const GLASS: Ramp = PAL.sky;

// ------------------------------------------------------------------------------------ sheet

/**
 * A composer in body space: `ox, oy` is where body (0, 0) lands in the buffer. Draw each part
 * on its own `layer()` with body coordinates through `X` / `Y`, shade it, then `add` it back to
 * front; `finish()` adds the INK silhouette and returns a feet- or pivot-anchored Frame.
 */
export class Sheet {
  readonly comp: Composer;
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;

  constructor(w: number, h: number, ox: number, oy: number) {
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    this.comp = new Composer(w, h);
  }

  X(x: number): number {
    return this.ox + x;
  }

  Y(y: number): number {
    return this.oy + y;
  }

  /** A blank part layer. */
  layer(): PixelBuffer {
    return new PixelBuffer(this.w, this.h);
  }

  /** Body-space polygon on a layer. */
  poly(L: PixelBuffer, pts: readonly Pt[], c: Color): PixelBuffer {
    return L.poly(
      pts.map((p) => [this.ox + p[0], this.oy + p[1]] as [number, number]),
      c,
    );
  }

  /** Body-space rectangle (x, y = top-left) on a layer. */
  rect(L: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): PixelBuffer {
    return L.rect(this.ox + x, this.oy + y, w, h, c);
  }

  /** Shade a layer with a ramp (light from the top-left) and composite it over the sheet. */
  add(L: PixelBuffer, ramp: Ramp, o: ShadeOpts = {}, line?: Color): this {
    shadeLayer(L, ramp, o);
    this.comp.add(L, { ramp, line });
    return this;
  }

  /** Composite a layer as it is (already coloured), with its own internal ring line. */
  put(L: PixelBuffer, line: Color = INK, ring = true): this {
    this.comp.add(L, { line, ring });
    return this;
  }

  /** Paint detail pixels without a ring (seams, rivets, letters). */
  paint(L: PixelBuffer, line: Color = INK): this {
    this.comp.paint(L, line);
    return this;
  }

  get buf(): PixelBuffer {
    return this.comp.buf;
  }

  /** Set one body-space pixel on the finished composite (details after all parts). */
  dot(x: number, y: number, c: Color): void {
    this.comp.buf.set(this.ox + x, this.oy + y, c);
  }

  /** The silhouette outline, as a Frame anchored at body (0, 0). */
  finish(pts?: Record<string, readonly [number, number]>, outline = true): Frame {
    const buf = outline ? this.comp.finish(INK) : this.comp.buf;
    return { buf, ox: this.ox, oy: this.oy, pts: pts ? { ...pts } : undefined };
  }
}

// ------------------------------------------------------------------------------------ text

/** A 3×5 sign-writer font for painted names (only the glyphs the fleet uses). */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  "'": ['#', '#', '.', '.', '.'],
  ' ': ['.', '.', '.', '.', '.'],
};

/** Width of `text` in the 3×5 font (1 px between glyphs). */
export function microWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (GLYPHS[ch]?.[0].length ?? 3) + 1;
  return Math.max(0, w - 1);
}

/** Write `text` with its top-left at buffer (x, y). */
export function microText(b: PixelBuffer, text: string, x: number, y: number, c: Color): void {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) {
      cx += 4;
      continue;
    }
    for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) if (g[r][k] === '#') b.set(cx + k, y + r, c);
    cx += g[0].length + 1;
  }
}

// ------------------------------------------------------------------------------------ strips

/** Centre-anchored frame. */
export function center(buf: PixelBuffer): Frame {
  return { buf, ox: buf.w >> 1, oy: buf.h >> 1 };
}

/** Number of directions in a projectile direction strip (22.5° steps, frame 0 right, clockwise). */
export const DIRECTIONS = 16;

/** A direction strip: `draw(angle)` returns an un-outlined buffer centred on its middle pixel. */
export function directionStrip(draw: (a: number) => PixelBuffer): Frame[] {
  return Array.from({ length: DIRECTIONS }, (_, i) => center(draw((i / DIRECTIONS) * Math.PI * 2).outline(INK)));
}

/** Rotate a body-space point by `deg` (+ = clockwise on screen, since y points down). */
export function rot(p: Pt, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Translate a frame's anchor and points by (dx, dy) in body space (same pixels). */
export function shiftFrame(f: Frame, dx: number, dy: number): Frame {
  const pts: Record<string, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(f.pts ?? {})) pts[k] = [p[0] + dx, p[1] + dy];
  return { buf: f.buf, ox: f.ox - dx, oy: f.oy - dy, pts };
}

// ------------------------------------------------------------------------------------ composites

/** One part of a composite: a frame drawn with its anchor at body (x, y). */
export type Placed = readonly [Frame, number, number];

/**
 * Stack finished part frames (back to front) into one frame anchored at body (0, 0): the
 * whole-vehicle strips (`idle`, `move`) the base class and the sheets show.
 */
export function stackFrames(w: number, h: number, ox: number, oy: number, parts: readonly Placed[]): Frame {
  const buf = new PixelBuffer(w, h);
  for (const [f, x, y] of parts) buf.blitFrame(f, ox + x, oy + y);
  return { buf, ox, oy };
}

/** Make a body-space rectangle of a finished frame transparent (a window the driver shows through). */
export function cutHole(f: Frame, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) f.buf.set(f.ox + xx, f.oy + yy, 0);
}

/** Recolour the opaque, non-ink pixels of a buffer (`fn` gets the colour and buffer x, y). */
export function tintPixels(b: PixelBuffer, fn: (c: Color, x: number, y: number) => Color): PixelBuffer {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if ((c & 255) === 0 || c === INK) continue;
      b.set(x, y, fn(c, x, y));
    }
  }
  return b;
}

/** A small round blob (scoop, crumb, puff) shaded with a ramp, unoutlined. */
export function blob(b: PixelBuffer, cx: number, cy: number, r: number, ramp: Ramp, o: ShadeOpts = {}): void {
  const L = new PixelBuffer(b.w, b.h);
  L.circle(Math.round(cx), Math.round(cy), r, ramp[0]);
  shadeLayer(L, ramp, o);
  b.blit(L, 0, 0);
}

/** Pure white (the top of the snow ramp). */
export const WHITE: Color = PAL.snow[3];
