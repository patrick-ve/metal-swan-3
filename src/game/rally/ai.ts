/**
 * The drivers (DRIVE, wave A): the stub rivals of the race, the finished cars' cruise and the sim bot
 * (src/sim/bot-rally.ts) all drive through `drive` — a `RallyInput` like a player's, so they obey
 * the same physics. FIELD (wave B) writes the rival AI of the rally teams (racing line per section,
 * overtakes around traffic, catch-up, difficulty) on top of it.
 *
 * - **Lane keeping:** a driver keeps a lane (`Driver.lane`), or (`Driver.racing`: the sim bot) the
 *   track's racing line when it is not passing; the point it steers to slides toward that side at
 *   3 m/s (no swerves).
 * - **The car ahead:** the nearest body ahead in its corridor within a look distance that grows with
 *   speed: when it is slower, the driver changes to a free lane beside it (the left one first: the
 *   overtaking lane), else it follows at a time gap (a lane gap, no rear-ending).
 * - **A car beside:** a body that overlaps its side (lengthwise and within `TOUCH` m of touching):
 *   when its centre is ahead, the driver backs off below its speed; when it is behind, the driver's
 *   side line moves away from it (within the lanes). Two cars never press on each other for long.
 * - **Speed:** the speed envelope of the track ahead (track-info.ts: the corners within braking
 *   distance, at the car's grip and brakes) at its `pace`, then gas with a feed-forward against the
 *   drag, or the brake.
 * - **Steering:** pure pursuit of a point `7 + 0.5·v` m ahead on its side line, turned into the wheel
 *   through the car's speed-dependent lock (physics.ts `lockAt`).
 *
 * Deterministic: r3 trig only, no rng (a driver's variety comes from its pace and lane). Nothing
 * allocates per tick.
 */
import { splineSample, type SplineSample } from '../../engine/r3/spline';
import { angleDiff, atan2T, sinT } from '../../engine/r3/trig';
import type { RallyBody, RallyInput, RallyTrack } from './api';
import { dsOf, frontGrip, laneOf, laneSide, lockAt } from './physics';
import { envelope, trackInfo } from './track-info';

/** Scratch sample (module-level: the sim is single-threaded). */
const AHEAD: SplineSample = splineSample();

/** A driver's state (one per AI car, and one per bot slot). */
export interface Driver {
  /** The lane it keeps (0 = the leftmost). */
  lane: number;
  /** The side line it steers to now (m, + = right); slides toward the lane's side. */
  side: number;
  /** The share of its car's top speed (and of its grip in corners) it drives at. */
  pace: number;
  /** Ticks until it may change lanes again. */
  laneT: number;
  /** It changes lanes to pass a slower car (off: it only follows). */
  overtake: boolean;
  /** Ticks it has stood behind a standing car (it pulls out after `BLOCK_TICKS`). */
  blockT: number;
  /** Ticks left of pulling out round a standing car (it creeps on while its body is still behind it). */
  pullOut: number;
  /** It follows the track's racing line (`track.racingAt`) when it is not passing (the sim bot); else its lane. */
  racing: boolean;
}

/** Share of the grip a driver uses in corners (× pace²), and of the brakes for the envelope. */
export const AI_GRIP = 0.9;
export const AI_BRAKE = 0.7;
/** Lateral speed of the side line toward the lane (m per tick). */
const SIDE_RATE = 0.05;
/** Half the width of a driver's corridor (m). */
const CORRIDOR = 2.3;
/** Ticks between lane changes. */
const LANE_HOLD = 90;
/** Ticks behind a standing car before a standing driver pulls out (the grid start waits for the row ahead). */
const BLOCK_TICKS = 60;
/** A driver passes a slower car only above this speed (m/s), unless it is blocked. */
const PASS_SPEED = 8;
/** A body beside is "touching" within this lateral gap between the bodies (m). */
const TOUCH = 0.4;
/** Backing off from a car beside: this much below its speed (m/s). */
const BACK_OFF = 1.5;

/** A driver that starts on `side` (its lane: the nearest one) at `pace`. */
export function newDriver(track: RallyTrack, s: number, side: number, pace: number, overtake = true, racing = false): Driver {
  return { lane: laneOf(track, side, s), side, pace, laneT: 0, overtake, blockT: 0, pullOut: 0, racing };
}

/** The speed (m/s) a car of top speed `top` and grip 1 can carry at arc length s (PREP's helper; the envelope ahead). */
export function cornerSpeed(track: RallyTrack, s: number, top: number): number {
  const g = 10.5 * AI_GRIP;
  return envelope(trackInfo(track), s, g, 11 * AI_BRAKE, top);
}

/** Steer toward the point `7 + 0.5·v` m ahead on the line `side` m right of the centre (pure pursuit). */
export function steerTo(car: RallyBody, track: RallyTrack, side: number): number {
  const u = car.speed;
  const h = car.phys.h;
  const ld = 7 + Math.abs(u) * 0.5;
  const t = track.spline.sample(car.s + ld, AHEAD);
  const tx = t.p[0] + t.r[0] * side - car.pos[0];
  const tz = t.p[2] + t.r[2] * side - car.pos[2];
  const d = Math.sqrt(tx * tx + tz * tz);
  const alpha = angleDiff(car.yaw, atan2T(tx, tz));
  const kappa = (2 * sinT(alpha)) / Math.max(1, d);
  const steer = (kappa * h.wheelbase) / lockAt(h, u);
  return steer > 1 ? 1 : steer < -1 ? -1 : steer;
}

/** Gas and brake toward the speed `target` (a feed-forward against the drag, then proportional). */
export function pedalsTo(car: RallyBody, target: number, out: RallyInput): void {
  const h = car.phys.h;
  const u = car.speed;
  const err = target - u;
  if (err < -1 || target < 0.5) {
    // Slow down (never into reverse: the brake reverses a standing car).
    out.gas = 0;
    out.brake = u > 1 ? Math.min(127, Math.round(Math.max(1, -err) * 32)) : 0;
    return;
  }
  const au = Math.max(1, Math.abs(u));
  const hold = (h.drag * u * u + h.roll) / Math.min(h.accel, h.power / au);
  const g = hold + err * 0.5;
  out.gas = g <= 0 ? 0 : g >= 1 ? 127 : Math.round(g * 127);
  out.brake = 0;
}

/** Is lane `lane` free beside `car` (no body from 10 m behind to `look` m ahead)? */
function laneFree(car: RallyBody, track: RallyTrack, lane: number, bodies: readonly RallyBody[], n: number, look: number): boolean {
  if (lane < 0 || lane >= track.lanes) return false;
  const side = laneSide(track, lane, car.s);
  const L = track.length;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost) continue;
    const ds = dsOf(car.s, o.s, L);
    if (ds < -10 || ds > look) continue;
    if (Math.abs(o.side - side) < CORRIDOR) return false;
  }
  return true;
}

/**
 * One tick of a driver: lane keeping, the car ahead, the speed envelope at its pace, the pedals and
 * the wheel. Fills and returns `out`. `bodies` (the first `n`) are everything on the road.
 */
export function drive(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
  const h = car.phys.h;
  const u = car.speed;
  const L = track.length;
  const look = 12 + Math.max(0, u) * 1.1;
  let gap = Infinity;
  let gapV = 0;
  let besideV = Infinity;
  let away = 0;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost) continue;
    const ds = dsOf(car.s, o.s, L);
    const reach = h.halfLen + o.phys.h.halfLen;
    const g = ds - reach;
    if (g < -1 && ds > -reach) {
      // Beside (overlapping lengthwise): touching or about to?
      const dside = o.side - car.side;
      if ((dside < 0 ? -dside : dside) < h.halfWid + o.phys.h.halfWid + TOUCH) {
        if (ds > 0) {
          if (o.speed < besideV) besideV = o.speed;
        } else away = dside > 0 ? -1 : 1;
      }
      continue;
    }
    if (g < -1 || g > look || g >= gap) continue;
    // In the corridor of the line it steers to, or of where its body is now (a lane change).
    if (Math.abs(o.side - d.side) >= CORRIDOR && Math.abs(o.side - car.side) >= CORRIDOR) continue;
    gap = g;
    gapV = o.speed;
  }
  if (d.laneT > 0) d.laneT--;
  const aLat = frontGrip(h, u, 0.5) * AI_GRIP * d.pace * d.pace;
  let target = envelope(trackInfo(track), car.s, aLat, h.brake * AI_BRAKE, h.topSpeed * d.pace);
  if (gap < look && gapV < 0.5 && u < 2) d.blockT++;
  else d.blockT = 0;
  if (d.pullOut > 0) d.pullOut--;
  const blocked = d.blockT > BLOCK_TICKS;
  // Pass a car ahead that is slower than the speed this driver wants (or a standing one it waits behind).
  if (d.overtake && gap < look && d.laneT === 0 && ((u > PASS_SPEED && gapV < target - 2) || blocked)) {
    const from = d.lane;
    if (laneFree(car, track, d.lane - 1, bodies, n, look)) d.lane--;
    else if (laneFree(car, track, d.lane + 1, bodies, n, look)) d.lane++;
    if (d.lane !== from) {
      d.laneT = LANE_HOLD;
      if (blocked) d.pullOut = LANE_HOLD;
    }
  }
  let want: number;
  if (d.racing && track.racingAt && d.laneT === 0 && d.blockT === 0) {
    // The racing line a little ahead; its lane counts for passing.
    want = track.racingAt(car.s + 10);
    d.lane = laneOf(track, want, car.s);
  } else want = laneSide(track, d.lane, car.s);
  if (away !== 0) {
    // A car presses on our side from behind: the side line moves away from it (within the lanes).
    const lo = laneSide(track, 0, car.s);
    const hi = laneSide(track, track.lanes - 1, car.s);
    const ns = d.side + away * SIDE_RATE;
    d.side = ns < lo ? (d.side < lo ? d.side : lo) : ns > hi ? (d.side > hi ? d.side : hi) : ns;
  } else {
    const dd = want - d.side;
    d.side += dd > SIDE_RATE ? SIDE_RATE : dd < -SIDE_RATE ? -SIDE_RATE : dd;
  }
  // A car overlaps our side ahead of our centre: back off below its speed (no pressing on).
  if (besideV < Infinity && besideV - BACK_OFF < target) target = besideV - BACK_OFF > 0 ? besideV - BACK_OFF : 0;
  if (gap < look) {
    let follow = gapV + (gap - (4 + 0.35 * Math.max(0, u))) * 0.6;
    // Pulling out round a slow car: creep on while the body is still behind it.
    if (d.pullOut > 0 && gap > 1.5) follow = Math.max(follow, Math.min(5, gap));
    if (follow < target) target = follow > 0 ? follow : 0;
  }
  pedalsTo(car, target, out);
  out.steer = Math.round(steerTo(car, track, d.side) * 127);
  out.handbrake = false;
  out.camera = false;
  out.lookBack = false;
  return out;
}

/**
 * PREP's helper (kept): follow the line `side` m right of the centre at up to `pace` of the car's
 * top speed (the envelope ahead), with no other cars in mind.
 */
export function followLine(car: RallyBody, track: RallyTrack, side: number, pace: number, out: RallyInput): RallyInput {
  const h = car.phys.h;
  const aLat = frontGrip(h, car.speed, 0.5) * AI_GRIP * pace * pace;
  pedalsTo(car, envelope(trackInfo(track), car.s, aLat, h.brake * AI_BRAKE, h.topSpeed * pace), out);
  out.steer = Math.round(steerTo(car, track, side) * 127);
  out.handbrake = false;
  out.camera = false;
  out.lookBack = false;
  return out;
}
