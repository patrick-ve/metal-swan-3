/**
 * The screen layout of the ring (docs/design/ring.md §2; docs/api/ring.md §3).
 *
 * From top to bottom: HUD 0–50 over the sky; skyline 40–100; the median and the oncoming
 * traffic 96–112 (scenery only); 4 lanes as depth bands (lane 1 far … lane 4 near) with their
 * FEET LINES at y 124 / 145 / 167 / 190; the hard shoulder 200–208; the near crash barrier
 * 206–216 (a front layer). Lanes are numbered 1 … 4 everywhere (as in the spec).
 *
 * Hits need overlap in x AND in depth: ring entities hurt and get hurt through DEPTH SLABS of
 * ±`DEPTH_HALF` px around their plane y (entity.ts), so a car in lane 2 never stops a shot in
 * lane 3 where their sprites overlap on screen. Lanes are ≥ 21 px apart, so slabs of
 * neighbouring lanes never touch.
 *
 * Aims (spec §3, steer lock): 8 plane angles. Forward 0; the diagonals ±20° (one lane per about
 * 60 px of travel); up / down straight across the lanes; three backward aims.
 */
import type { Rect } from '../../engine/math';

/** Number of lanes on an open stretch. */
export const LANE_COUNT = 4;
/** Feet line (plane y) of lane 1 … 4 at index 0 … 3. */
export const LANE_Y: readonly number[] = Object.freeze([124, 145, 167, 190]);
/** Far edge of lane 1 (the median's road edge). */
export const ROAD_TOP = 113;
/** Borders between the lane bands (1|2, 2|3, 3|4). */
export const LANE_SPLIT: readonly number[] = Object.freeze([134, 156, 178]);
/** Near edge of lane 4 = the top of the hard shoulder. */
export const ROAD_BOTTOM = 200;
/** The hard shoulder (vluchtstrook). */
export const SHOULDER_TOP = 200;
export const SHOULDER_BOTTOM = 208;
/** The near crash barrier (front layer, parallax 1.25). */
export const BARRIER_TOP = 206;
/** The flat ground of particles and the terrain line: the bottom of the road band. */
export const GROUND_Y = SHOULDER_BOTTOM;
/** Median strip with the oncoming carriageway behind it (scenery). */
export const MEDIAN_TOP = 96;
export const MEDIAN_BOTTOM = 112;
/** Half-height of a depth slab (px): hits need |Δy| < 2·DEPTH_HALF between plane lines. */
export const DEPTH_HALF = 8;
/** Distance between lane feet lines (average, px). */
export const LANE_GAP = (LANE_Y[3] - LANE_Y[0]) / 3;
/** Plane angle of the diagonal aims (spec §3: about ±20°). */
export const DIAG_ANGLE = (20 * Math.PI) / 180;

/** Plane y of lane `lane` (1 … 4; clamped). */
export function laneY(lane: number): number {
  const i = Math.max(1, Math.min(LANE_COUNT, Math.round(lane))) - 1;
  return LANE_Y[i];
}

/** The lane (1 … `last`) whose feet line is nearest to plane y `y`. */
export function nearestLane(y: number, first = 1, last = LANE_COUNT): number {
  let best = first;
  let bd = Infinity;
  for (let l = first; l <= last; l++) {
    const d = Math.abs(y - LANE_Y[l - 1]);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

/** The lane band (1 … 4) that holds plane y `y`, or 0 outside the road (median, shoulder). */
export function laneAt(y: number): number {
  if (y < ROAD_TOP || y >= ROAD_BOTTOM) return 0;
  for (let i = 0; i < LANE_SPLIT.length; i++) if (y < LANE_SPLIT[i]) return i + 1;
  return LANE_COUNT;
}

/** The last open lane when `open` lanes are open (3 = lane 4 closed: tunnels). */
export function lastLane(open: number): number {
  return open >= LANE_COUNT ? LANE_COUNT : Math.max(1, open);
}

/** Clamp a lane into the open lanes. */
export function clampLane(lane: number, open = LANE_COUNT): number {
  return Math.max(1, Math.min(lastLane(open), Math.round(lane)));
}

/** Is plane y inside the road band (lanes and shoulder), grown by `margin`? */
export function inRoadBand(y: number, margin = 0): boolean {
  return y >= ROAD_TOP - margin && y <= GROUND_Y + margin;
}

/**
 * The depth slab of a thing at plane y `y` covering world x `x0` … `x0 + w`: a box ±`half` px
 * around its feet line. Fills `out`.
 */
export function laneSlab(x0: number, w: number, y: number, out: Rect, half = DEPTH_HALF): Rect {
  out.x = x0;
  out.y = y - half;
  out.w = w;
  out.h = half * 2;
  return out;
}

// ---------------------------------------------------------------------------------------------
// The 8 aims of the steer lock (spec §3)
// ---------------------------------------------------------------------------------------------

/**
 * → same lane forward; ↗ forward into the far lanes; ↑ straight across into the far lanes;
 * ↘ / ↓ into the near lanes; ← ↖ ↙ backwards. 'far' = up on screen (lane 1 side).
 */
export type Aim8 = 'forward' | 'forward-far' | 'far' | 'back-far' | 'back' | 'back-near' | 'near' | 'forward-near';
export const AIMS: readonly Aim8[] = ['forward', 'forward-far', 'far', 'back-far', 'back', 'back-near', 'near', 'forward-near'];

const AIM_ANGLE: Readonly<Record<Aim8, number>> = {
  forward: 0,
  'forward-far': -DIAG_ANGLE,
  far: -Math.PI / 2,
  'back-far': -Math.PI + DIAG_ANGLE,
  back: Math.PI,
  'back-near': Math.PI - DIAG_ANGLE,
  near: Math.PI / 2,
  'forward-near': DIAG_ANGLE,
};

/** Plane angle of an aim (radians, 0 = forward/right, +π/2 = toward the near lanes). */
export function planeAngle(aim: Aim8): number {
  return AIM_ANGLE[aim];
}

/**
 * The aim of a D-pad direction (`ax` −1/0/1 = back/none/forward, `ay` −1/0/1 = far/none/near),
 * or null for no direction.
 */
export function aimOf(ax: number, ay: number): Aim8 | null {
  if (ax > 0) return ay < 0 ? 'forward-far' : ay > 0 ? 'forward-near' : 'forward';
  if (ax < 0) return ay < 0 ? 'back-far' : ay > 0 ? 'back-near' : 'back';
  if (ay < 0) return 'far';
  if (ay > 0) return 'near';
  return null;
}

/** Does the aim point backwards (the shot leaves the back of the window)? */
export function aimsBack(aim: Aim8): boolean {
  return aim === 'back' || aim === 'back-far' || aim === 'back-near';
}
