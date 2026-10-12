import type { Color } from './color';
import { WHITE } from './color';
import type { DrawOpts } from './render';

/**
 * Placement maths shared by the software and Canvas 2D renderers, so both put every pixel in
 * exactly the same place. Pure functions; results go into caller-owned scratch objects
 * (no allocation per draw call).
 *
 * Rules:
 * - World → screen: Math.round(x) − camX, where the camera is already rounded.
 * - Anchored drawing: the anchor pixel (ox, oy) lands on (x, y). flipX mirrors the image around
 *   the anchor pixel's column (left = x − (w − 1 − ox)); flipY likewise for rows.
 * - Parallax layers: screen origin Math.round(offset − cam × factor), tiled by the buffer size.
 */

export interface Placement {
  x: number;
  y: number;
}

/** Screen top-left of a (w × h) image whose anchor (ox, oy) is drawn at (x, y). */
export function placeAnchored(
  out: Placement,
  w: number,
  h: number,
  ox: number,
  oy: number,
  x: number,
  y: number,
  flipX: boolean,
  flipY: boolean,
  camX: number,
  camY: number,
): Placement {
  const ax = Math.round(x) - camX;
  const ay = Math.round(y) - camY;
  out.x = flipX ? ax - (w - 1 - ox) : ax - ox;
  out.y = flipY ? ay - (h - 1 - oy) : ay - oy;
  return out;
}

/** A source part of an image after `placePart` (reused scratch object). */
export interface Part {
  /** Source rectangle inside the (possibly flipped) image variant. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Screen position of that rectangle. */
  dx: number;
  dy: number;
}

/**
 * Where a source sub-rectangle (unflipped buffer coordinates, clipped to the buffer) of an
 * image whose full top-left is at (left, top) lands, and where it sits inside the flipped
 * variant. Returns false when nothing is left after clipping.
 */
export function placePart(
  out: Part,
  w: number,
  h: number,
  src: { x: number; y: number; w: number; h: number },
  left: number,
  top: number,
  flipX: boolean,
  flipY: boolean,
): boolean {
  let x0 = Math.round(src.x);
  let y0 = Math.round(src.y);
  let x1 = x0 + Math.round(src.w);
  let y1 = y0 + Math.round(src.h);
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > w) x1 = w;
  if (y1 > h) y1 = h;
  if (x0 >= x1 || y0 >= y1) return false;
  out.sw = x1 - x0;
  out.sh = y1 - y0;
  out.sx = flipX ? w - x1 : x0;
  out.sy = flipY ? h - y1 : y0;
  out.dx = left + out.sx;
  out.dy = top + out.sy;
  return true;
}

/** First tile position (≤ 0) so that tiles of `size` starting there cover the view from 0. */
export function firstTile(origin: number, size: number): number {
  return origin - Math.ceil(origin / size) * size;
}

/** Screen origin of a parallax layer on one axis. */
export function parallaxOrigin(offset: number, cam: number, factor: number): number {
  return Math.round(offset - cam * factor);
}

/** Endpoints of a line after `clipLine` (reused scratch object). */
export interface LineEnds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LONG_LINE = 2048;
const MARGIN = 64;

/**
 * Screen-space line guard shared by both renderers: lines longer than 2048 px are clipped
 * (Liang–Barsky) to the view plus a 64-px margin, so absurd coordinates cannot stall the
 * Bresenham loop. Shorter lines are left untouched (exact pixels). Returns false when the
 * line misses the view.
 */
export function clipLine(out: LineEnds, x0: number, y0: number, x1: number, y1: number, w: number, h: number): boolean {
  out.x0 = Math.round(x0);
  out.y0 = Math.round(y0);
  out.x1 = Math.round(x1);
  out.y1 = Math.round(y1);
  const dx = out.x1 - out.x0;
  const dy = out.y1 - out.y0;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= LONG_LINE) return true;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, out.x0 + MARGIN],
    [dx, w + MARGIN - out.x0],
    [-dy, out.y0 + MARGIN],
    [dy, h + MARGIN - out.y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  const ax = out.x0;
  const ay = out.y0;
  out.x0 = Math.round(ax + dx * t0);
  out.y0 = Math.round(ay + dy * t0);
  out.x1 = Math.round(ax + dx * t1);
  out.y1 = Math.round(ay + dy * t1);
  return true;
}

/** Colour for solid shapes (rect, line): `tint` or white `flash` replace the RGB, alpha stays. */
export function solidColor(c: Color, o: DrawOpts | undefined): Color {
  const t = o?.tint ?? (o?.flash ? WHITE : undefined);
  return t === undefined ? c >>> 0 : ((t & 0xffffff00) | (c & 255)) >>> 0;
}
