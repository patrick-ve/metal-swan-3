/**
 * The perspective floor's camera (docs/design/floor.md §1.1, §1.3): a real pinhole camera that moves
 * with `camX`, with a vertical image plane, its eye `yw − yh` px above the walk plane and `f` px in
 * front of the walk line. Pure maths, no state (headless-safe).
 *
 * Coordinates:
 * - world `u` (along the street, = world x), `v` (depth: negative behind the walk line, positive in
 *   front), `h` (height over the walk plane, = `yw − world y` on the walk line);
 * - screen `x'`, `y'` (logical px of the 384 × 216 view);
 * - **depth** D (the kits' unit, spec §1.3 "at 14 px"): screen px behind the walk line ON FLAT
 *   GROUND, i.e. a thing at depth D has its base at screen y `yw − D`. D 0 = the walk plane, D < 0 =
 *   in front. `vAtDepth` / `depthAtV` convert; the row scale is `s = 1 − D / (yw − yh)`.
 *
 * A floor row at screen y has the scale s(y) = (y − yh) / (yw − yh) (1 at the walk line) and the
 * depth v(y) = f · (1 − 1/s(y)); back: y(v) = yh + (yw − yh) · f / (f − v). A world point projects to
 * s = f / (f − v), x' = 192 + (u − camX − 192) · s, y' = yh − camY + (yw − yh − h) · s. At v = 0 this
 * is the plain 2D world (x' = u − camX, y' = yw − h − camY): the walk line scrolls with the world.
 */
import { VIEW_H, VIEW_W } from '../render';

/** The walk line of flat ground (screen y of the feet; G of `ams` and `oldenzaal`). */
export const FLOOR_YW = 176;
/** The camera's centre column (the eye's u is camX + FLOOR_CX). */
export const FLOOR_CX = VIEW_W / 2;
/** Rows the mesh reaches below the view (screen shake and a dip may pull the floor up). */
export const FLOOR_FRONT_MARGIN = 12;

/** One section's floor camera (made by `makeFloorCam`; all numbers logical px). */
export interface FloorCam {
  /** The horizon (screen y). */
  readonly yh: number;
  /** The focal length (world px). */
  readonly f: number;
  /** The walk line of flat ground (screen y, default FLOOR_YW). */
  readonly yw: number;
  /** The floor's back edge on flat ground (screen y; e.g. 146 = 30 px behind the feet). */
  readonly back: number;
  /** The lowest screen y the floor reaches on flat ground (VIEW_H + FLOOR_FRONT_MARGIN). */
  readonly front: number;
  /** Depth (world v) of the back edge and of the front row: the mesh's v range. */
  readonly vBack: number;
  readonly vFront: number;
}

export interface FloorCamOpts {
  yh: number;
  f: number;
  /** Screen y of the back edge on flat ground (must lie between yh and yw). */
  back: number;
  yw?: number;
  front?: number;
}

/** A floor camera (throws on numbers that cannot make a floor: the defs are data, checked early). */
export function makeFloorCam(o: FloorCamOpts): FloorCam {
  const yw = o.yw ?? FLOOR_YW;
  const front = o.front ?? VIEW_H + FLOOR_FRONT_MARGIN;
  if (!(o.f > 0)) throw new Error(`floor camera: f must be > 0 (got ${o.f})`);
  if (!(o.yh < o.back && o.back < yw && yw < front)) throw new Error(`floor camera: need yh < back < yw < front (got ${o.yh}, ${o.back}, ${yw}, ${front})`);
  const c = { yh: o.yh, f: o.f, yw, back: o.back, front, vBack: 0, vFront: 0 };
  c.vBack = vOfY(c, o.back);
  c.vFront = vOfY(c, front);
  if (!(c.vFront < c.f)) throw new Error('floor camera: the front row lies behind the eye');
  return c;
}

/** Row scale at screen y (1 at the walk line). */
export function sOfY(c: Pick<FloorCam, 'yh' | 'yw'>, y: number): number {
  return (y - c.yh) / (c.yw - c.yh);
}

/** World depth v of the flat-floor row at screen y. */
export function vOfY(c: Pick<FloorCam, 'yh' | 'yw' | 'f'>, y: number): number {
  return c.f * (1 - (c.yw - c.yh) / (y - c.yh));
}

/** Screen y of the flat-floor row at world depth v. */
export function yOfV(c: Pick<FloorCam, 'yh' | 'yw' | 'f'>, v: number): number {
  return c.yh + ((c.yw - c.yh) * c.f) / (c.f - v);
}

/** Scale (and row speed) of world depth v: f / (f − v). */
export function sOfV(c: Pick<FloorCam, 'f'>, v: number): number {
  return c.f / (c.f - v);
}

/** World px of depth per screen px at flat-floor row y (the row's footprint along v). */
export function dvdy(c: Pick<FloorCam, 'yh' | 'yw' | 'f'>, y: number): number {
  const d = y - c.yh;
  return (c.f * (c.yw - c.yh)) / (d * d);
}

/** World depth v of the kits' depth D (screen px behind the walk line on flat ground). */
export function vAtDepth(c: Pick<FloorCam, 'yh' | 'yw' | 'f'>, depth: number): number {
  return vOfY(c, c.yw - depth);
}

/** The kits' depth D of world depth v. */
export function depthAtV(c: Pick<FloorCam, 'yh' | 'yw' | 'f'>, v: number): number {
  return c.yw - yOfV(c, v);
}

/** Row scale (and speed) of depth D: 1 − D / (yw − yh). */
export function sAtDepth(c: Pick<FloorCam, 'yh' | 'yw'>, depth: number): number {
  return 1 - depth / (c.yw - c.yh);
}

/** Screen x of world (u, v) for the camera camX. */
export function projX(c: Pick<FloorCam, 'f'>, u: number, v: number, camX: number): number {
  return FLOOR_CX + (u - camX - FLOOR_CX) * sOfV(c, v);
}

/** Screen y of world (v, h) for the camera camY (shake moves the whole picture). */
export function projY(c: Pick<FloorCam, 'yh' | 'yw' | 'f'>, v: number, h: number, camY: number): number {
  return c.yh - camY + (c.yw - c.yh - h) * sOfV(c, v);
}

/**
 * The renderer's world x that puts world x at the screen x of depth D (scrolling at s(D)): drawing a
 * sprite there through a renderer whose camera is camX shows it at 192 + (x − camX − 192) · s. Its y
 * moves by −D (`y − depth`). This is the "shift and speed of that depth, no scaling" of decor,
 * `drawDepth` and the light hooks (spec §1.3, §3.7).
 */
export function shiftX(c: Pick<FloorCam, 'yh' | 'yw'>, x: number, depth: number, camX: number): number {
  const s = sAtDepth(c, depth);
  return x * s + (camX + FLOOR_CX) * (1 - s);
}
