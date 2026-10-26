/**
 * Geometry helpers for the face groups (docs/design/floor.md §11 R1, docs/api/floor.md §8): the
 * corner orders that make a face show from the right side (clockwise on screen as seen from there)
 * and its tile coordinates (the depth on b: tiles mip along b). The kits build their side walls,
 * roof sides, box ends, caps and tops from these; the engine draws them (section-floor.ts).
 *
 * Corners: [x, y, depth] in the group anchor's sprite px (x right, y up from its base, at the anchor
 * depth's scale), or [x, y, depth, 1] in world px (x right of the anchor, y over the walk plane).
 * Depths: a face's `front` is its nearer depth (the winding is checked from there).
 */
import type { FaceDef, FacePoint } from './types';

/** A side: −1 the left side of a box (it faces −u: seen while the box is right of the centre), +1 the right. */
export type FaceSide = -1 | 1;

type Pt = FacePoint;

/** A corner: in sprite px, or world px (`world`). */
function pt(x: number, y: number, depth: number, world: boolean): Pt {
  return world ? [x, y, depth, 1] : [x, y, depth];
}

/**
 * A vertical side face at x (constant u) from `y0` to `y1` and from depth `front` to `back`, where
 * `front` is the NEARER of the two (a facade receding back: front = the facade; an awning reaching
 * forward from its facade: front = the walk plane). `l` the tile px of that depth span (b, 0 at the
 * front), `a0` the tile's a at the top edge (a lower part of a wall keeps its top). `world`: the
 * corners are world px; 'front': only the front ones (a face that joins a facade to the walk plane).
 */
export function wallFace(x: number, y0: number, y1: number, front: number, back: number, side: FaceSide, tile: string, l: number, a0 = 0, world: boolean | 'front' = false): FaceDef {
  const a1 = a0 + (y1 - y0);
  const wf = world !== false;
  const wb = world === true;
  const ft = pt(x, y1, front, wf);
  const bt = pt(x, y1, back, wb);
  const bb = pt(x, y0, back, wb);
  const fb = pt(x, y0, front, wf);
  return side > 0
    ? { pts: [ft, bt, bb, fb], tex: [[a0, 0], [a0, l], [a1, l], [a1, 0]], tile }
    : { pts: [ft, fb, bb, bt], tex: [[a0, 0], [a1, 0], [a1, l], [a0, l]], tile };
}

/**
 * A sloped face receding in depth: the edge from (ex, ey) (low: an eave at a side) to (rx, ry) (high:
 * the ridge) extruded from `front` to `back`. A pitched roof's side; a hip. Shown while the eye sees
 * its slope (the engine's winding test). a = up the slope, b = depth.
 */
export function slopeFace(ex: number, ey: number, rx: number, ry: number, front: number, back: number, side: FaceSide, tile: string, l: number): FaceDef {
  const ls = Math.hypot(rx - ex, ry - ey);
  const ef = pt(ex, ey, front, false);
  const tf = pt(rx, ry, front, false);
  const tb = pt(rx, ry, back, false);
  const eb = pt(ex, ey, back, false);
  return side > 0
    ? { pts: [ef, tf, tb, eb], tex: [[0, 0], [ls, 0], [ls, l], [0, l]], tile }
    : { pts: [ef, eb, tb, tf], tex: [[0, 0], [0, l], [ls, l], [ls, 0]], tile };
}

/**
 * A face toward the camera at one depth (constant v): x0…x1 × y0…y1. A thick thing's front end (a
 * bridge leaf's edge, a post). a = down from y1, b = along x.
 */
export function capFace(x0: number, x1: number, y0: number, y1: number, depth: number, tile: string, world = false): FaceDef {
  const p = (x: number, y: number): Pt => pt(x, y, depth, world);
  return {
    pts: [p(x0, y1), p(x1, y1), p(x1, y0), p(x0, y0)],
    tex: [
      [0, 0],
      [0, x1 - x0],
      [y1 - y0, x1 - x0],
      [y1 - y0, 0],
    ],
    tile,
  };
}

/**
 * A level top at height y over x0…x1 from depth `far` to `near` (seen from above while it lies below
 * the eye). a = along x, b = depth from the far edge (`l` its tile px).
 */
export function topFace(x0: number, x1: number, y: number, far: number, near: number, tile: string, l: number, world = false): FaceDef {
  const p = (x: number, d: number): Pt => pt(x, y, d, world);
  return {
    pts: [p(x0, far), p(x1, far), p(x1, near), p(x0, near)],
    tex: [
      [0, 0],
      [x1 - x0, 0],
      [x1 - x0, l],
      [0, l],
    ],
    tile,
  };
}

/**
 * A free quad (any four corners, clockwise on screen from the side that shows): a triangle repeats
 * its last corner. For the odd shapes: an awning's cheek, a gable end.
 */
export function quadFace(pts: readonly Pt[], tex: readonly (readonly [number, number])[], tile: string, both = false): FaceDef {
  const p = pts.length === 3 ? [...pts, pts[2]] : pts;
  const t = tex.length === 3 ? [...tex, tex[2]] : tex;
  return { pts: p, tex: t, tile, both };
}
