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
 *
 * FIELD (wave B, additive): `Driver.ext` — a driver's own logic (the rival AI of the rally teams,
 * src/game/rally/ai-rival.ts, installed by the lazy content): `drive` calls `ext.drive` instead of
 * `driveCore` (wave A's driver, unchanged; the sim bot and the finished cars' cruise use it).
 * `laneFreeAt` and `lookAhead` are the helpers the new drivers share.
 */
import { splineSample, type SplineSample } from '../../engine/r3/spline';
import { angleDiff, atan2T, sinT } from '../../engine/r3/trig';
import type { RallyBody, RallyInput, RallyTrack } from './api';
import { dsOf, frontGrip, laneOf, laneSide, lockAt } from './physics';
import { curvAt, envelope, trackInfo } from './track-info';

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
  /** FIELD (wave B, additive): its own logic (`drive` calls it instead of `driveCore`); absent = wave A's driver. */
  ext?: DriverExt | null;
  /** FIELD (wave B, additive): ticks left of backing away from a standing body it is pressed against. */
  backT?: number;
  /**
   * FIELD (wave B, additive): the lane the driver itself chose last tick; when something else (RULES'
   * road works guide, the runner's recovery) changes `lane`, the driver keeps that lane `FORCE_TICKS`
   * (no racing line, no passing) — `forcedT` counts down.
   */
  lastLane?: number;
  forcedT?: number;
  /**
   * Fixer (wave B, additive): the lanes the driver may use now (set each tick by RULES for the AI
   * drivers and by the sim bot): `keepLo`..`keepHi` (lane indices; `track.lanes` = the hard
   * shoulder). The open lanes of the road works ahead; the shoulder only with no red X over it ahead.
   * Undefined = every lane.
   */
  keepLo?: number;
  keepHi?: number;
}

/** Fixer (wave B): clamp a side offset into the lanes a driver may use (`keepLo`..`keepHi`; unchanged when unset). */
export function keepSide(d: Driver, track: RallyTrack, side: number, s: number): number {
  if (d.keepLo === undefined || d.keepHi === undefined) return side;
  const lo = laneSide(track, d.keepLo, s);
  const hi = laneSide(track, d.keepHi, s);
  return side < lo ? lo : side > hi ? hi : side;
}

/**
 * Fixer (wave B): below this speed (m/s) a racing driver keeps the lane it is in (no racing line): a
 * racer released from the shoulder or back on its wheels after a spin crossed every lane at 60 km/h
 * in front of cars at 170.
 */
export const MERGE_SPEED = 18;

/** Fixer (wave B): the lane a slow driver keeps: the one its car is in (the shoulder when it may use it). */
export function holdLane(d: Driver, track: RallyTrack, side: number, s: number): number {
  const sh = track.lanes;
  if (d.keepHi !== undefined && d.keepHi >= sh && side > (laneSide(track, sh - 1, s) + laneSide(track, sh, s)) / 2) return sh;
  return keepLane(d, laneOf(track, side, s));
}

/** Fixer (wave B): clamp a lane index into the lanes a driver may use. */
export function keepLane(d: Driver, lane: number): number {
  if (d.keepLo !== undefined && lane < d.keepLo) return d.keepLo;
  if (d.keepHi !== undefined && lane > d.keepHi) return d.keepHi;
  return lane;
}

/** FIELD: ticks a driver keeps a lane that was set from outside (RULES' road works, a recovery). */
export const FORCE_TICKS = 90;

/** FIELD: note an outside change of `d.lane` (call once at the start of a tick); true while the driver must keep it. */
export function forcedLane(d: Driver): boolean {
  if (d.lastLane !== undefined && d.lane !== d.lastLane) d.forcedT = FORCE_TICKS;
  if ((d.forcedT ?? 0) > 0) {
    d.forcedT = (d.forcedT ?? 1) - 1;
    return true;
  }
  return false;
}

/** FIELD (wave B): a driver's own logic (the rival AI). It fills and returns `out` like `drive`. */
export interface DriverExt {
  drive(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput;
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
/** FIELD (wave B): a pass is planned this far beyond the look-ahead (m); the side line's speed while passing (m per tick); the lateral speed a lane change clears a body at (m/s). */
const PLAN_EXTRA = 45;
/** Ticks of backing away from a standing body it is pressed against. */
const BACK_TICKS = 40;
const PASS_RATE = 0.1;
const CLEAR_SPEED = 4;

/**
 * FIELD (wave B): does `car` (moving off the line of body `o`, `g` m ahead) reach `o` before its
 * body is clear of it sideways? Then it must still follow it.
 */
export function reachFirst(car: RallyBody, o: RallyBody, g: number, u: number): boolean {
  const lat = Math.abs(o.side - car.side);
  const need = car.phys.h.halfWid + o.phys.h.halfWid + 0.3 - lat;
  if (need <= 0) return false;
  // Nose to tail already: it counts (never push a body along).
  if (g < 1) return true;
  const closing = u - o.speed;
  if (closing <= 0.5) return false;
  return g / closing < need / CLEAR_SPEED;
}

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

/**
 * FIELD (wave B): is the line `side` m right of the centre free beside `car` — no body (but ghosts)
 * within `CORRIDOR` m of it from `back` m (negative = behind) to `look` m ahead of the car?
 */
export function laneFreeAt(car: RallyBody, track: RallyTrack, side: number, bodies: readonly RallyBody[], n: number, back: number, look: number): boolean {
  const L = track.length;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost) continue;
    const ds = dsOf(car.s, o.s, L);
    if (ds < back || ds > look) continue;
    if (Math.abs(o.side - side) < CORRIDOR) return false;
  }
  return true;
}

/**
 * FIELD (wave B): the free road ahead (m) on the line `side`: the gap to the first body (not a ghost)
 * in its corridor up to `range` m ahead (Infinity when none).
 */
export function laneRoom(car: RallyBody, track: RallyTrack, side: number, bodies: readonly RallyBody[], n: number, range: number): number {
  const L = track.length;
  const hl = car.phys.h.halfLen;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost) continue;
    const g = dsOf(car.s, o.s, L) - hl - o.phys.h.halfLen;
    if (g < -1 || g > range || g >= best) continue;
    if (Math.abs(o.side - side) < (o.kind === 'prop' ? car.phys.h.halfWid + o.phys.h.halfWid + 0.25 : CORRIDOR)) best = g;
  }
  return best;
}

/**
 * FIELD (wave B): can `car` move onto the line `side` now — nothing beside it there (from 10 m behind
 * to `ahead` m ahead) and no faster body closing in from behind sooner than `react` s (the mirror)?
 */
export function sideClear(car: RallyBody, track: RallyTrack, side: number, bodies: readonly RallyBody[], n: number, ahead: number, react = 1.2, squeeze = false): boolean {
  const L = track.length;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost) continue;
    // `squeeze` (round a standing body), or a prop (RULES' cones and barriers, placed exactly): only a body the car's own width would touch counts.
    const w = squeeze || o.kind === 'prop' ? car.phys.h.halfWid + o.phys.h.halfWid + 0.25 : CORRIDOR;
    if (Math.abs(o.side - side) >= w) continue;
    const ds = dsOf(car.s, o.s, L);
    if (ds > -10 && ds < ahead) return false;
    if (ds <= -10 && ds > -10 - react * 40) {
      const dv = o.speed - car.speed;
      if (dv > 1 && (-ds - 10) / dv < react) return false;
    }
  }
  return true;
}

/**
 * FIELD (wave B): the lane to pass in — every lane on the way to it clear beside the car (up to just
 * past the body ahead, `gap` m; the mirror checked), with more free road ahead than the current lane
 * (+ 8 m, + 12 m per extra lane crossed); the nearer and then the left one wins a tie. −1: stay.
 * `lanes` the lanes it may use (3; 4 with the hard shoulder).
 */
export function passLane(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, gap: number, look: number, lanes: number, react = 1.2, squeeze = false): number {
  let best = -1;
  let score = gap + 8;
  // The strip beside the car it needs clear to move over (the lanes it crosses too): about 1 s ahead.
  const ahead = Math.min(look, gap + 10);
  // Fixer: only the lanes it may use (no closed works lane, no shoulder under a red X).
  const kLo = d.keepLo ?? 0;
  const kHi = d.keepHi !== undefined && d.keepHi < lanes - 1 ? d.keepHi : lanes - 1;
  for (let dir = -1; dir <= 1; dir += 2) {
    for (let k = d.lane + dir, step = 1; k >= kLo && k <= kHi; k += dir, step++) {
      const side = laneSide(track, k, car.s);
      // The way there must be clear; a blocked lane stops the search in this direction.
      if (!sideClear(car, track, side, bodies, n, ahead, react, squeeze)) break;
      const r = laneRoom(car, track, side, bodies, n, look * 2) - (step - 1) * 12;
      if (r > score) {
        score = r;
        best = k;
      }
    }
  }
  return best;
}

const LANES_OF = new WeakMap<RallyTrack, number>();

/**
 * FIELD (wave B): the lanes a racing driver may use to pass: the track's lanes, plus the hard
 * shoulder when the track has one inside its barriers (the A10: lane 3 at +5.375 m).
 */
export function driveLanes(track: RallyTrack): number {
  let n = LANES_OF.get(track);
  if (n !== undefined) return n;
  const sh = laneSide(track, track.lanes, 0);
  const last = laneSide(track, track.lanes - 1, 0);
  n = sh > last + 2.5 && sh < track.halfWidth - 1.5 ? track.lanes + 1 : track.lanes;
  LANES_OF.set(track, n);
  return n;
}

/** The look-ahead of a driver at speed u (m): wave A's `12 + 1.1·u`. */
export function lookAhead(u: number): number {
  return 12 + Math.max(0, u) * 1.1;
}

/** Half the width of a driver's corridor (m; wave A's). */
export const AI_CORRIDOR = CORRIDOR;

/**
 * One tick of a driver: lane keeping, the car ahead, the speed envelope at its pace, the pedals and
 * the wheel. Fills and returns `out`. `bodies` (the first `n`) are everything on the road. A driver
 * with its own logic (`d.ext`, FIELD) runs that instead.
 */
export function drive(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
  if (d.ext) return d.ext.drive(car, d, track, bodies, n, out);
  return driveCore(car, d, track, bodies, n, out);
}

/** Wave A's driver (the body of `drive`): the sim bot, the stub rivals and the finished cars' cruise. */
export function driveCore(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
  driveCoreTick(car, d, track, bodies, n, out);
  d.lastLane = d.lane;
  return out;
}

function driveCoreTick(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
  const forced = forcedLane(d);
  const h = car.phys.h;
  const u = car.speed;
  const L = track.length;
  const look = 12 + Math.max(0, u) * 1.1;
  // FIELD (wave B, traffic): a slower body further ahead on the line already starts a pass.
  const plan = look + PLAN_EXTRA;
  let gap = Infinity;
  let gapV = 0;
  let pgap = Infinity;
  let pgapV = 0;
  let besideV = Infinity;
  let away = 0;
  // FIELD: a body alongside on the left / right (the side line never moves into it).
  let sideL = false;
  let sideR = false;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost) continue;
    const ds = dsOf(car.s, o.s, L);
    const reach = h.halfLen + o.phys.h.halfLen;
    const g = ds - reach;
    if (g < 2 && ds > -reach - 2) {
      const dl = o.side - car.side;
      if ((dl < 0 ? -dl : dl) < h.halfWid + o.phys.h.halfWid + 1.2) {
        if (dl < 0) sideL = true;
        else sideR = true;
      }
    }
    if (g < -1 && ds > -reach) {
      // Beside (overlapping lengthwise): touching or about to?
      const dside = o.side - car.side;
      const lat = dside < 0 ? -dside : dside;
      const need = h.halfWid + o.phys.h.halfWid;
      if (lat < need + TOUCH) {
        // FIELD (wave B, traffic): touching, or a body that (nearly) stands: move off it, never stop beside it.
        if (lat < need + 0.15 || o.speed < 3) away = dside > 0 ? -1 : 1;
        else if (ds > 0) {
          if (o.speed < besideV) besideV = o.speed;
        } else away = dside > 0 ? -1 : 1;
      }
      continue;
    }
    if (g < -1 || g > plan) continue;
    // In the corridor of the line it steers to, or of where its body is now (a lane change). FIELD: a
    // prop (RULES' cones and barriers) only where the car's own width would touch it.
    const cw = o.kind === 'prop' ? h.halfWid + o.phys.h.halfWid + 0.25 : CORRIDOR;
    const inLine = Math.abs(o.side - d.side) < cw;
    if (!inLine && Math.abs(o.side - car.side) >= cw) continue;
    if (g < pgap) {
      pgap = g;
      pgapV = o.speed;
    }
    if (g > look || g >= gap) continue;
    // FIELD: only the body moves past it (a lane change): it counts when the car reaches it before it is clear of it.
    if (!inLine && !reachFirst(car, o, g, u)) continue;
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
  // FIELD (wave B): pressed against a standing body (a crashed car across the lanes): back away first.
  if ((d.backT ?? 0) > 0 || (blocked && gap < 1.2 && d.overtake)) {
    if (!((d.backT ?? 0) > 0)) {
      d.backT = BACK_TICKS;
      // The lane to get round it (squeezing past is fine): backing away turns the nose toward it.
      const k = passLane(car, d, track, bodies, n, gap, look, driveLanes(track), 1.2, true);
      if (k >= 0) {
        d.lane = k;
        d.side = laneSide(track, k, car.s);
      }
    }
    d.backT = (d.backT ?? 1) - 1;
    if (d.backT === 0) {
      d.blockT = BLOCK_TICKS + 1;
      d.pullOut = LANE_HOLD;
      d.laneT = LANE_HOLD;
    }
    out.gas = 0;
    out.brake = car.speed > 0.5 ? 127 : 90;
    // In reverse the wheel turns the nose the other way: a left lock swings the nose right.
    const dd = d.side - car.side;
    out.steer = dd > 0.5 ? 110 : dd < -0.5 ? -110 : 0;
    out.handbrake = false;
    out.camera = false;
    out.lookBack = false;
    return out;
  }
  // Pass a car ahead that is slower than the speed this driver wants (or a standing one it waits behind).
  if (!forced && d.overtake && pgap < plan && d.laneT === 0 && ((u > PASS_SPEED && pgapV < target - 2) || blocked)) {
    // FIELD (wave B, traffic): the lane with the most free road (the way clear beside, the mirror checked).
    let k = passLane(car, d, track, bodies, n, pgap, look, driveLanes(track));
    // Blocked by a standing body (a crashed car across the lanes): squeeze past it.
    if (k < 0 && blocked) k = passLane(car, d, track, bodies, n, pgap, look, driveLanes(track), 1.2, true);
    if (k >= 0) {
      d.lane = k;
      d.laneT = LANE_HOLD;
      if (blocked) d.pullOut = LANE_HOLD;
    }
  }
  let want: number;
  const slow = u < MERGE_SPEED;
  if (slow && !forced && d.racing && track.racingAt && d.laneT === 0 && d.blockT === 0) {
    // Fixer: slow, it keeps its lane until it is up to speed.
    d.lane = holdLane(d, track, car.side, car.s);
    want = laneSide(track, d.lane, car.s);
  } else if (!forced && d.racing && track.racingAt && d.laneT === 0 && d.blockT === 0) {
    // The racing line a little ahead; its lane counts for passing (FIELD: unless a body blocks it).
    want = keepSide(d, track, track.racingAt(car.s + 10), car.s);
    const ln = laneOf(track, want, car.s);
    if (ln === d.lane || laneRoom(car, track, laneSide(track, ln, car.s), bodies, n, look) >= look) d.lane = ln;
    else want = laneSide(track, d.lane, car.s);
  } else {
    d.lane = keepLane(d, d.lane);
    want = laneSide(track, d.lane, car.s);
  }
  if (away !== 0) {
    // A car presses on our side from behind: the side line moves away from it (within the lanes).
    const lo = laneSide(track, 0, car.s);
    const hi = laneSide(track, (d.overtake ? driveLanes(track) : track.lanes) - 1, car.s);
    const ns = d.side + away * SIDE_RATE;
    d.side = ns < lo ? (d.side < lo ? d.side : lo) : ns > hi ? (d.side > hi ? d.side : hi) : ns;
  } else {
    // FIELD: a pass moves over a little quicker (on a straight: in a bend the grip is for the bend).
    const rate = d.laneT > 0 && d.overtake && Math.abs(curvAt(trackInfo(track), car.s + 20)) < 0.003 ? PASS_RATE : SIDE_RATE;
    const dd = want - d.side;
    // FIELD: never into a body alongside (it waits until it is clear).
    if (!((dd < 0 && sideL && d.side <= car.side + 0.3) || (dd > 0 && sideR && d.side >= car.side - 0.3))) d.side += dd > rate ? rate : dd < -rate ? -rate : dd;
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
