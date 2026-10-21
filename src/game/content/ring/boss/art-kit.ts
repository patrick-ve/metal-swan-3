/**
 * Shared drawing helpers of the ring boss's art (art-lorry.ts, art-adds.ts): the density-generic
 * pieces on an `HdCanvas` (PAL at 1×, PAL_HD at 2× / 4× through the stag kit's `mat`), canvases
 * placed in LOCAL coordinates (a `Pen` maps local → canvas), rolled height fields over polygons, a
 * point transform (turns and squashes for the tipping frames), and the strip registration that
 * crops every frame to its 1× box (the same logical rectangle at every density).
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, inPoly, polyDist, type TexSample } from '../../../art/hd';
import type { Dn } from '../../stag/kit.art';
import type { Pt } from './geometry';

export const frac = (v: number): number => v - Math.floor(v);

/** A rolled edge: height over distance e from an edge with roll radius r. */
export function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/** Half width of a fine line (a shut line, a seam) at density d, logical px. */
export function lineW(d: number): number {
  return d === 1 ? 0.5 : d === 2 ? 0.26 : 0.17;
}

/** A deterministic hash of two numbers → 0 … 1 (grime, scatter: art only). */
export function hash2(a: number, b: number): number {
  let h = Math.imul(Math.floor(a) | 0, 374761393) ^ Math.imul(Math.floor(b) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A canvas over the local box (x0, y0, w, h): local coordinates in, canvas coordinates out. */
export class Pen {
  readonly c: HdCanvas;
  readonly x0: number;
  readonly y0: number;
  readonly d: Dn;

  constructor(x0: number, y0: number, w: number, h: number, d: Dn) {
    this.c = new HdCanvas(w, h, d);
    this.x0 = x0;
    this.y0 = y0;
    this.d = d;
  }

  /** A lit field over the local box where `h(x, y)` is a number (NaN = nothing). */
  field(x: number, y: number, w: number, hgt: number, h: (x: number, y: number) => number, o: Parameters<HdCanvas['heightField']>[5], tex?: (t: TexSample, x: number, y: number) => void): void {
    const ox = this.x0;
    const oy = this.y0;
    this.c.heightField(x - ox, y - oy, w, hgt, (cx, cy) => h(cx + ox, cy + oy), tex ? { ...o, tex: (t) => tex(t, t.x + ox, t.y + oy) } : o);
  }

  /** A rolled body over a polygon (edges rolling over `r`), minus `cut(x, y)`. */
  body(poly: readonly Pt[], r: number, o: Parameters<HdCanvas['heightField']>[5], extra?: (x: number, y: number) => number, cut?: (x: number, y: number) => boolean, tex?: (t: TexSample, x: number, y: number) => void): void {
    let xa = Infinity;
    let xb = -Infinity;
    let ya = Infinity;
    let yb = -Infinity;
    for (const [px, py] of poly) {
      xa = Math.min(xa, px);
      xb = Math.max(xb, px);
      ya = Math.min(ya, py);
      yb = Math.max(yb, py);
    }
    this.field(
      xa - 0.5,
      ya - 0.5,
      xb - xa + 1,
      yb - ya + 1,
      (x, y) => {
        if (!inPoly(x, y, poly) || (cut && cut(x, y))) return NaN;
        return roll(polyDist(x, y, poly), r) + (extra ? extra(x, y) : 0);
      },
      o,
      tex,
    );
  }

  box(x: number, y: number, w: number, h: number, o: Parameters<HdCanvas['box']>[4]): void {
    this.c.box(x - this.x0, y - this.y0, w, h, o);
  }

  ellipsoid(cx: number, cy: number, rx: number, ry: number, o: Parameters<HdCanvas['ellipsoid']>[4]): void {
    this.c.ellipsoid(cx - this.x0, cy - this.y0, rx, ry, o);
  }

  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, o: Parameters<HdCanvas['capsule']>[6]): void {
    this.c.capsule(x0 - this.x0, y0 - this.y0, x1 - this.x0, y1 - this.y0, r0, r1, o);
  }

  stroke(pts: readonly Pt[], r0: number, r1: number, o: Parameters<HdCanvas['stroke']>[3]): void {
    this.c.stroke(
      pts.map(([x, y]) => [x - this.x0, y - this.y0] as const),
      r0,
      r1,
      o,
    );
  }

  poly(pts: readonly Pt[], o: Parameters<HdCanvas['poly']>[1]): void {
    this.c.poly(
      pts.map(([x, y]) => [x - this.x0, y - this.y0] as const),
      o,
    );
  }

  blob(pts: readonly Pt[], r: number, o: Parameters<HdCanvas['blob']>[2]): void {
    this.c.blob(
      pts.map(([x, y]) => [x - this.x0, y - this.y0] as const),
      r,
      o,
    );
  }

  /** Fixed colours over the local box (`fn` gets local coordinates; 0 = none). */
  paint(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => number, z = 1e6): void {
    const ox = this.x0;
    const oy = this.y0;
    this.c.paint(x - ox, y - oy, w, h, (cx, cy) => fn(cx + ox, cy + oy), z);
  }

  /** Tone shifts over the local box. */
  shade(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => number, part?: number): void {
    const ox = this.x0;
    const oy = this.y0;
    this.c.shade(x - ox, y - oy, w, h, (cx, cy) => fn(cx + ox, cy + oy), part);
  }

  dot(x: number, y: number, col: number): void {
    this.c.dot(x - this.x0, y - this.y0, col);
  }

  erase(x: number, y: number, w: number, h: number, keep: (x: number, y: number) => boolean): void {
    const ox = this.x0;
    const oy = this.y0;
    this.c.erase(x - ox, y - oy, w, h, (cx, cy) => keep(cx + ox, cy + oy));
  }

  image(buf: PixelBuffer, x: number, y: number, o: { z?: number; part?: number; flipX?: boolean } = {}): void {
    this.c.image(buf, x - this.x0, y - this.y0, o);
  }

  /** The frame of a finished buffer: the anchor is the local origin. */
  frame(buf: PixelBuffer, pts?: Record<string, [number, number]>): Frame {
    return frameOf(buf, -this.x0, -this.y0, this.d, pts);
  }
}

export function frameOf(buf: PixelBuffer, ox: number, oy: number, d: Dn, pts?: Record<string, [number, number]>): Frame {
  const base = d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
  return pts ? { ...base, pts } : base;
}

/** A point transform: turn by `rot` degrees about (px, py), then squash y by `sy` toward py. */
export interface Turn {
  rot: number;
  px: number;
  py: number;
  sy?: number;
}

export function turnPt(t: Turn | null, x: number, y: number): [number, number] {
  if (!t) return [x, y];
  const a = (t.rot * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const u = x - t.px;
  const v = (y - t.py) * (t.sy ?? 1);
  return [t.px + u * cs - v * sn, t.py + u * sn + v * cs];
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

type Gen = (d: Dn) => Frame[];

/** The crop box of a 1× frame (its opaque box grown by 1 px, inside the frame). */
function boxOf(f1: Frame): { x: number; y: number; w: number; h: number } {
  const t = f1.buf.trimBounds();
  if (!t) return { x: 0, y: 0, w: Math.min(1, f1.buf.w), h: Math.min(1, f1.buf.h) };
  const x = Math.max(0, t.x - 1);
  const y = Math.max(0, t.y - 1);
  return { x, y, w: Math.min(f1.buf.w, t.x + t.w + 1) - x, h: Math.min(f1.buf.h, t.y + t.h + 1) - y };
}

function boxed(f: Frame, box: { x: number; y: number; w: number; h: number }, d: Dn): Frame {
  const buf = f.buf.crop(box.x * d, box.y * d, box.w * d, box.h * d);
  const ox = f.ox - box.x;
  const oy = f.oy - box.y;
  const pts = f.pts;
  return d === 1 ? { buf, ox, oy, ...(pts ? { pts } : {}) } : { buf, ox, oy, density: d, ...(pts ? { pts } : {}) };
}

/** A strip at density d, each frame cropped to its 1× box (the same logical rectangle at every density). */
function cropped(gen: Gen, d: Dn): Frame[] {
  const lo = gen(1);
  const fs = d === 1 ? lo : gen(d);
  return fs.map((f, i) => boxed(f, boxOf(lo[i]), d));
}

/** Register a strip: 1× now, 2× / 4× from the same drawer (`hd`), cropped to the 1× boxes. */
export function defStrip(id: string, gen: Gen, o: { ticksPerFrame?: number; loop?: boolean; defer?: boolean } = {}): void {
  defineSprite(id, () => cropped(gen, 1), { ...o, hd: (d) => cropped(gen, d as Dn) });
}
