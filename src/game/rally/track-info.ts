/**
 * Per-track tables for the drivers and the cameras (DRIVE; pure, deterministic, built once per
 * track object and cached): the track's yaw and signed curvature every `BIN` metres, and the speed
 * envelope a car may carry into what lies ahead.
 *
 * - `curv[i]`: the signed curvature at bin i (1/m; + = a left turn), from the change of the
 *   tangent's yaw over ±`SPAN` m, smoothed over three bins.
 * - `vc2[i]`: the square of the corner speed at a lateral acceleration of 1 m/s² (= 1 / |curv|,
 *   capped): a car with lateral grip a may carry v² = a · vc2 there.
 * - `envelope(info, s, aLat, aBrake, top)`: the highest speed at s from which the car can still
 *   brake (at aBrake) to every corner speed ahead (at aLat) — a scan of the bins within its braking
 *   distance; one Math.sqrt.
 */
import { splineSample } from '../../engine/r3/spline';
import { angleDiff, atan2T } from '../../engine/r3/trig';
import type { RallyTrack } from './api';

/** Metres per bin. */
export const BIN = 4;
/** Half the span (m) over which the curvature is measured. */
const SPAN = 6;
/** The cap of `vc2` (a straight): (120 m/s)² per m/s². */
const VC2_MAX = 120 * 120;

export interface TrackInfo {
  readonly track: RallyTrack;
  readonly length: number;
  readonly bins: number;
  /** m per bin (length / bins: the bins tile the loop exactly). */
  readonly bin: number;
  /** The track's yaw at each bin (forward(yaw) = the tangent's horizontal direction). */
  readonly yaw: Float64Array;
  readonly curv: Float64Array;
  readonly vc2: Float64Array;
}

const INFO = new WeakMap<RallyTrack, TrackInfo>();

/** The tables of a track (built on first use, then cached). */
export function trackInfo(track: RallyTrack): TrackInfo {
  const had = INFO.get(track);
  if (had) return had;
  const L = track.length;
  const bins = Math.max(8, Math.round(L / BIN));
  const bin = L / bins;
  const yaw = new Float64Array(bins);
  const raw = new Float64Array(bins);
  const curv = new Float64Array(bins);
  const vc2 = new Float64Array(bins);
  const tmp = splineSample();
  const sp = track.spline;
  for (let i = 0; i < bins; i++) {
    const s = i * bin;
    sp.sample(s, tmp);
    yaw[i] = atan2T(tmp.t[0], tmp.t[2]);
    sp.sample(s - SPAN, tmp);
    const y0 = atan2T(tmp.t[0], tmp.t[2]);
    sp.sample(s + SPAN, tmp);
    const y1 = atan2T(tmp.t[0], tmp.t[2]);
    raw[i] = angleDiff(y0, y1) / (2 * SPAN);
  }
  for (let i = 0; i < bins; i++) {
    const k = (raw[(i - 1 + bins) % bins] + raw[i] + raw[(i + 1) % bins]) / 3;
    curv[i] = k;
    const a = Math.abs(k);
    vc2[i] = a > 1 / VC2_MAX ? 1 / a : VC2_MAX;
  }
  const info: TrackInfo = { track, length: L, bins, bin, yaw, curv, vc2 };
  INFO.set(track, info);
  return info;
}

/** The bin at arc length s (wrapped). */
export function binOf(info: TrackInfo, s: number): number {
  const L = info.length;
  const w = s - Math.floor(s / L) * L;
  const i = Math.floor(w / info.bin);
  return i >= info.bins ? 0 : i < 0 ? 0 : i;
}

/** The track's yaw at arc length s (the nearest bin). */
export function yawAt(info: TrackInfo, s: number): number {
  return info.yaw[binOf(info, s)];
}

/** The signed curvature at arc length s (the nearest bin; + = a left turn). */
export function curvAt(info: TrackInfo, s: number): number {
  return info.curv[binOf(info, s)];
}

/**
 * The highest speed (m/s, ≤ top) a car at arc length s may carry: for every bin ahead within its
 * braking distance from `top`, v² ≤ aLat · vc2 + 2 · aBrake · distance.
 */
export function envelope(info: TrackInfo, s: number, aLat: number, aBrake: number, top: number): number {
  const top2 = top * top;
  const reach = top2 / (2 * aBrake) + 2 * info.bin;
  const n = Math.min(info.bins, Math.ceil(reach / info.bin));
  const L = info.length;
  const w = s - Math.floor(s / L) * L;
  const i0 = Math.floor(w / info.bin);
  const off = w - i0 * info.bin;
  let best = top2;
  for (let k = 0; k <= n; k++) {
    const i = (i0 + k) % info.bins;
    const d = k === 0 ? 0 : k * info.bin - off;
    const v2 = aLat * info.vc2[i] + 2 * aBrake * (d > 0 ? d : 0);
    if (v2 < best) best = v2;
  }
  return Math.sqrt(best);
}
