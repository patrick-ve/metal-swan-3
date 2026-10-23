/**
 * The rival AI of the rally teams (FIELD, wave B; docs/design/rally.md §2, §6; docs/api/rally.md
 * "B.F"). Installed by the lazy content (content/rally/teams) into every runner: each rival's
 * `Driver.ext` (rally/ai.ts) is a `RivalBrain`, and one system per race updates their catch-up, the
 * virtual traffic, the horns and ACHTERUIT's gag.
 *
 * - **The line:** the track's racing line (TRACK's AI lines, `track.racingAt`) a little ahead, plus
 *   the rival's own bias (the field spreads over the road instead of one train), inside the lanes.
 * - **Traffic and rivals ahead:** the nearest body ahead in its corridor. Slower: pass it in the
 *   lane with the most free road ahead (either side: the rivals obey nothing but physics), or —
 *   behind a race car, a lorry or a coach that is nearly as fast, on a straight — stay in its
 *   slipstream until close, then pull out. No free lane: follow at a time gap (braking for jams).
 * - **Fair to the players:** a rival never brakes for a car behind it (no brake-checks) and never
 *   moves into a lane where a player closes in from up to `CUT_BACK` m behind.
 * - **Speed:** the envelope of the track ahead at its pace (corners at its grip × pace²) with the
 *   top speed × the catch-up × the virtual traffic: up to +3 % behind the leading player, −2 %
 *   ahead of it (by distance, over `CATCH_RANGE` m; off on hard); outside every player's traffic
 *   window the road has no traffic, so the rival pays the lap's virtual traffic (`VIRTUAL_TRAFFIC`).
 *   The difficulty's pace (easy −6 %, normal 0, hard +4 %) is in its driver's `pace` (runner.ts).
 * - **Horns:** a rival that passes a player close honks (`honk { car: the rival, slot: the player }`;
 *   wave C plays the team's horn, `RivalSpec.horn`).
 * - **ACHTERUIT's gag** (`RivalSpec.gag` 'reverse'): once per race, from lap 2, on a straight with
 *   a player behind it, it spins round, drives a stretch BACKWARDS as fast as forwards (its belt
 *   drive: `CarSpecB.reverseTop`), and spins back.
 *
 * Pure and deterministic (§12.4: r3 trig, no rng in the brain; the per-rival bias is fixed by the
 * team). No allocation per tick (one payload object per event).
 */
import { splineSample } from '../../engine/r3/spline';
import { angleDiff, atan2T, cosT, PI, sinT, wrapAngle } from '../../engine/r3/trig';
import type { CarState, RallyBody, RallyInput, RallyTrack } from './api';
import { AI_BRAKE, AI_CORRIDOR, AI_GRIP, driveCore, driveLanes, forcedLane, holdLane, keepLane, keepSide, laneFreeAt, MERGE_SPEED, laneRoom, lookAhead, passLane, pedalsTo, steerTo, type Driver, type DriverExt } from './ai';
import { dsOf, frontGrip, laneSide, lockAt, type CarSpecB } from './physics';
import type { RallyRunner } from './runner';
import { curvAt, envelope, trackInfo } from './track-info';

/** A rally team's car spec (FIELD): the handling plus what the AI, the radio and the horns read. */
export interface RivalSpec extends CarSpecB {
  /** The horn (a synth placeholder id; wave C makes the sound). */
  readonly horn?: string;
  /** The DJ's mention (a line id; wave C writes the text). */
  readonly dj?: string;
  /** The gag: 'reverse' = ACHTERUIT drives a stretch backwards once. */
  readonly gag?: 'reverse';
  /** Its line: the side offset (m) from the racing line it prefers. */
  readonly bias?: number;
}

/** The catch-up (spec §2): up to +3 % top speed behind the leading player, −2 % ahead (off on hard), over this range (m). */
export const CATCH_UP = { back: 0.03, front: 0.02, range: 400 } as const;
/** The pace a rival loses per lap (laps 1, 2, 3) when no player is near (no traffic is simulated there). */
export const VIRTUAL_TRAFFIC: readonly number[] = [0.012, 0.025, 0.045];
/** A rival is in a player's traffic window from this far behind to this far ahead of the player (m; ai-traffic.ts spawns there). */
export const WINDOW_BEHIND = 240;
export const WINDOW_AHEAD = 500;
/** A rival never changes into a lane where a player closes in from up to this far behind (m). */
export const CUT_BACK = 28;
/** Ticks between two lane changes of a rival. */
const LANE_HOLD = 50;
/** The side line's speed toward its target (m per tick): normal, passing. */
const SIDE_RATE = 0.05;
const SIDE_PASS = 0.1;
/** A slower body ahead is passed when it is this much slower than the rival wants (m/s). */
const PASS_DV = 2;
/** The slipstream: stay behind a body this close to the wanted speed (m/s) until this gap (m). */
const DRAFT_DV = 6;
const DRAFT_PULL = 8;
/** Ticks behind a standing body before pulling out round it (as wave A's driver). */
const BLOCK_TICKS = 60;
/** Horns: a pass of a player within this lateral gap (m) between the centres; a cooldown (ticks). */
const HONK_GAP = 2.9;
const HONK_COOL = 600;

/** ACHTERUIT's gag: the spin (ticks), the backwards stretch (ticks at most), the straight it needs ahead (m). */
export const GAG = { spin: 30, back: 240, straight: 220, curv: 0.0025, behind: 220, minSpeed: 25 } as const;
export type GagPhase = 'ready' | 'spin' | 'back' | 'spinBack' | 'done';

/** The scratch of a scan (module-level: the sim is single-threaded). */
const LANE_GAP: number[] = [0, 0, 0, 0];

/** One rival's brain (`Driver.ext`): its line, passing, slipstream, the catch-up and the gag. */
export class RivalBrain implements DriverExt {
  /** The car it drives. */
  readonly car: CarState;
  /** Its pace at the start (the difficulty × the team's share). */
  readonly base: number;
  readonly bias: number;
  /** × the top speed (the system sets them every tick). */
  catchUp = 1;
  traffic = 1;
  /** The gag's phase and its tick counter (ACHTERUIT; 'done' for the others). */
  gag: GagPhase;
  gagT = 0;
  /** Ticks to the next possible honk. */
  honkT = 0;
  /** Is it passing (its line is a lane, not the racing line)? */
  passing = false;

  constructor(car: CarState, base: number) {
    this.car = car;
    this.base = base;
    const spec = car.spec as RivalSpec;
    this.bias = spec.bias ?? 0;
    this.gag = spec.gag === 'reverse' ? 'ready' : 'done';
  }

  drive(car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
    // A finished car cruises (wave A's driver, the runner set its pace and lane).
    if (this.car.finished) return driveCore(car, d, track, bodies, n, out);
    if (this.gag === 'spin' || this.gag === 'spinBack') return coast(out);
    if (this.gag === 'back') return this.driveBack(car, d, track, out);
    return rivalDrive(this, car, d, track, bodies, n, out);
  }

  /** Backwards along the track (ACHTERUIT): full reverse, steering by the rear. */
  private driveBack(car: RallyBody, d: Driver, track: RallyTrack, out: RallyInput): RallyInput {
    const u = car.speed; // negative: it moves backwards (its nose points back)
    const ld = 8 + Math.abs(u) * 0.5;
    const t = track.spline.sample(car.s + ld, SAMPLE);
    const tx = t.p[0] + t.r[0] * d.side - car.pos[0];
    const tz = t.p[2] + t.r[2] * d.side - car.pos[2];
    const dist = Math.sqrt(tx * tx + tz * tz);
    // The travel direction is the tail's: steer it like a nose, with the wheel the other way.
    const alpha = angleDiff(wrapAngle(car.yaw + PI), atan2T(tx, tz));
    const kappa = (2 * sinT(alpha)) / Math.max(1, dist);
    const h = car.phys.h;
    let steer = -(kappa * h.wheelbase) / lockAt(h, u);
    steer = steer > 1 ? 1 : steer < -1 ? -1 : steer;
    out.steer = Math.round(steer * 127);
    out.gas = 0;
    out.brake = 127;
    out.handbrake = false;
    out.camera = false;
    out.lookBack = false;
    return out;
  }
}

const SAMPLE = splineSample();

function coast(out: RallyInput): RallyInput {
  out.steer = 0;
  out.gas = 0;
  out.brake = 0;
  out.handbrake = false;
  out.camera = false;
  out.lookBack = false;
  return out;
}

/** Is `o` a body worth a slipstream (a race car, a lorry, a coach)? */
function draftable(o: RallyBody): boolean {
  return o.kind === undefined || o.phys.h.wake > 1.3;
}

/** Is `o` a player's car? */
function isPlayer(o: RallyBody): boolean {
  const s = (o as Partial<CarState>).slot;
  return typeof s === 'number' && s >= 0;
}

/** One tick of a rival: the line, the body ahead, passing or the slipstream, the speed, the wheel. */
export function rivalDrive(b: RivalBrain, car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
  rivalTick(b, car, d, track, bodies, n, out);
  d.lastLane = d.lane;
  return out;
}

function rivalTick(b: RivalBrain, car: RallyBody, d: Driver, track: RallyTrack, bodies: readonly RallyBody[], n: number, out: RallyInput): RallyInput {
  // A lane set from outside (RULES' road works guide, a recovery) is kept a while: no line, no passing.
  const forced = forcedLane(d);
  if (forced) b.passing = true;
  const h = car.phys.h;
  const u = car.speed;
  const L = track.length;
  const lanes = driveLanes(track);
  const look = lookAhead(u);
  const plan = look * 1.6 + 10;
  let gap = Infinity;
  let gapV = 0;
  let gapBody: RallyBody | null = null;
  let besideV = Infinity;
  let away = 0;
  // FIELD: a body alongside on the left / right (the side line never moves into it).
  let sideL = false;
  let sideR = false;
  for (let k = 0; k < lanes; k++) LANE_GAP[k] = Infinity;
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
      const dside = o.side - car.side;
      const lat = dside < 0 ? -dside : dside;
      const need = h.halfWid + o.phys.h.halfWid;
      if (lat < need + 0.4) {
        // Touching, or a body that (nearly) stands: move off it, never stop beside it.
        if (lat < need + 0.15 || o.speed < 3) away = dside > 0 ? -1 : 1;
        else if (ds > 0) {
          if (o.speed < besideV) besideV = o.speed;
        } else away = dside > 0 ? -1 : 1;
      }
      continue;
    }
    if (g < -1 || g > plan) continue;
    // The free road ahead in each lane.
    for (let k = 0; k < lanes; k++) {
      if (Math.abs(o.side - laneSide(track, k, car.s)) < AI_CORRIDOR && g < LANE_GAP[k]) LANE_GAP[k] = g;
    }
    if (g > look || g >= gap) continue;
    if (Math.abs(o.side - d.side) >= AI_CORRIDOR && Math.abs(o.side - car.side) >= AI_CORRIDOR) continue;
    gap = g;
    gapV = o.speed;
    gapBody = o;
  }
  if (d.laneT > 0) d.laneT--;
  const info = trackInfo(track);
  const aLat = frontGrip(h, u, 0.5) * AI_GRIP * b.base * b.base;
  const top = h.topSpeed * b.base * b.catchUp * b.traffic;
  let target = envelope(info, car.s, aLat, h.brake * AI_BRAKE, top);
  if (gap < look && gapV < 0.5 && u < 2) d.blockT++;
  else d.blockT = 0;
  if (d.pullOut > 0) d.pullOut--;
  const blocked = d.blockT > BLOCK_TICKS;
  const slower = gap < look && (gapV < target - PASS_DV || blocked);
  // The slipstream: behind a race car (or a lorry, a coach) nearly as fast, on a straight: stay in it until close.
  const straight = Math.abs(curvAt(info, car.s + 40)) < 0.002;
  const drafting = slower && !blocked && gapBody !== null && draftable(gapBody) && gapV > target - DRAFT_DV && gap > DRAFT_PULL && straight;
  if (slower && !drafting && d.laneT === 0 && !forced) {
    // The lane beside with the most free road (the mirror checked longer: fair to a player closing in).
    let k = passLane(car, d, track, bodies, n, gap, look, lanes, 1.8);
    if (k < 0 && blocked) k = passLane(car, d, track, bodies, n, gap, look, lanes, 1.8, true);
    if (k >= 0) {
      d.lane = k;
      d.laneT = LANE_HOLD;
      b.passing = true;
      if (blocked) d.pullOut = LANE_HOLD;
    }
  }
  // Back to the racing line once the lane ahead is clear (and the hold is over; the shoulder only to pass).
  if (!forced && b.passing && d.laneT === 0 && (LANE_GAP[d.lane] > look || d.lane >= track.lanes)) {
    const rl = track.racingAt ? nearestLane(track, track.racingAt(car.s + 10) + b.bias, car.s) : d.lane;
    if (rl === d.lane || laneRoom(car, track, laneSide(track, rl, car.s), bodies, n, look) >= look) b.passing = false;
  }
  let want: number;
  if (!b.passing && track.racingAt && u < MERGE_SPEED) {
    // Fixer: slow (released from the shoulder, back on its wheels): it keeps its lane until up to speed.
    d.lane = holdLane(d, track, car.side, car.s);
    want = laneSide(track, d.lane, car.s);
  } else if (!b.passing && track.racingAt) {
    want = track.racingAt(car.s + 10) + b.bias;
    const lo = laneSide(track, 0, car.s);
    const hi = laneSide(track, track.lanes - 1, car.s);
    want = want < lo ? lo : want > hi ? hi : want;
    // Fixer: within the open lanes (never along a closed works lane's taper).
    want = keepSide(d, track, want, car.s);
    // Never drift onto a line a player closes in on (no cutting off).
    if (Math.abs(want - d.side) > 0.8 && playerClosing(car, track, want, bodies, n) && !laneFreeAt(car, track, want, bodies, n, -CUT_BACK, 4)) want = d.side;
    d.lane = nearestLane(track, want, car.s);
  } else {
    d.lane = keepLane(d, d.lane);
    want = laneSide(track, d.lane, car.s);
  }
  const rate = b.passing && Math.abs(curvAt(info, car.s + 20)) < 0.003 ? SIDE_PASS : SIDE_RATE;
  if (away !== 0) {
    const lo = laneSide(track, 0, car.s);
    const hi = laneSide(track, lanes - 1, car.s);
    const ns = d.side + away * rate;
    d.side = ns < lo ? (d.side < lo ? d.side : lo) : ns > hi ? (d.side > hi ? d.side : hi) : ns;
  } else {
    const dd = want - d.side;
    // Never into a body alongside (it waits until it is clear).
    if (!((dd < 0 && sideL && d.side <= car.side + 0.3) || (dd > 0 && sideR && d.side >= car.side - 0.3))) d.side += dd > rate ? rate : dd < -rate ? -rate : dd;
  }
  if (besideV < Infinity && besideV - 1.5 < target) target = besideV - 1.5 > 0 ? besideV - 1.5 : 0;
  if (gap < look) {
    // Follow at a time gap (the slipstream closer: 0.25 s instead of 0.35 s).
    const tg = drafting ? 0.25 : 0.35;
    let follow = gapV + (gap - (4 + tg * Math.max(0, u))) * 0.6;
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

/** The lane nearest a side offset. */
function nearestLane(track: RallyTrack, side: number, s: number): number {
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < track.lanes; k++) {
    const dd = Math.abs(laneSide(track, k, s) - side);
    if (dd < bd) {
      bd = dd;
      best = k;
    }
  }
  return best;
}

/** Does a player close in on the line `side` from behind (within `CUT_BACK` m, faster)? */
function playerClosing(car: RallyBody, track: RallyTrack, side: number, bodies: readonly RallyBody[], n: number): boolean {
  const L = track.length;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === car || o.phys.ghost || !isPlayer(o)) continue;
    const ds = dsOf(car.s, o.s, L);
    if (ds > 0 || ds < -CUT_BACK) continue;
    if (Math.abs(o.side - side) < AI_CORRIDOR + 0.4 && o.speed > car.speed - 1) return true;
  }
  return false;
}

/** The leading player's distance (−Infinity: no player racing). */
function leadPlayer(r: RallyRunner): number {
  let best = -Infinity;
  for (const c of r.cars) if (c.slot >= 0 && !c.finished && c.dist > best) best = c.dist;
  return best;
}

/** Is a rival at `dist` inside some player's traffic window? */
function inWindow(r: RallyRunner, dist: number): boolean {
  for (const c of r.cars) {
    if (c.slot < 0) continue;
    const ds = dist - c.dist;
    if (ds > -WINDOW_BEHIND && ds < WINDOW_AHEAD) return true;
  }
  return false;
}

/** The catch-up factor of a rival `ds` m ahead of the leading player (spec §2; 1 on hard). */
export function catchUpFactor(ds: number, hard: boolean): number {
  if (hard || ds === Infinity || ds === -Infinity) return 1;
  if (ds < 0) {
    const k = -ds / CATCH_UP.range;
    return 1 + CATCH_UP.back * (k > 1 ? 1 : k);
  }
  const k = ds / CATCH_UP.range;
  return 1 - CATCH_UP.front * (k > 1 ? 1 : k);
}

/**
 * Install the rival AI into a runner (FIELD's system 'rivals'): a brain per rival (`Driver.ext`)
 * and one system for the catch-up, the virtual traffic, the horns and the gag. Copes with any track.
 */
export function installRivals(runner: RallyRunner): RivalBrain[] {
  const brains: RivalBrain[] = [];
  for (let i = 0; i < runner.cars.length; i++) {
    const c = runner.cars[i];
    if (c.slot >= 0) continue;
    const d = runner.drivers[i];
    const brain = new RivalBrain(c, d.pace);
    d.ext = brain;
    d.overtake = true;
    brains.push(brain);
  }
  const hard = runner.difficulty === 'hard';
  const honk = { car: '', slot: -1 };
  const prevDs: number[][] = brains.map(() => [Infinity, Infinity]);
  runner.addSystem({
    step(r) {
      if (r.phase === 'grid') return;
      const lead = leadPlayer(r);
      const L = r.track.length;
      for (let k = 0; k < brains.length; k++) {
        const b = brains[k];
        const c = b.car;
        if (c.finished || r.cars.indexOf(c) < 0) continue;
        b.catchUp = catchUpFactor(lead === -Infinity ? Infinity : c.dist - lead, hard);
        const lap = c.lap < 1 ? 1 : c.lap > 3 ? 3 : c.lap;
        b.traffic = inWindow(r, c.dist) ? 1 : 1 - VIRTUAL_TRAFFIC[lap - 1];
        if (b.honkT > 0) b.honkT--;
        // The horn: a close pass of a player.
        for (const p of r.cars) {
          if (p.slot < 0 || p.finished) continue;
          const ps = p.slot === 1 ? 1 : 0;
          const ds = c.dist - p.dist;
          const was = prevDs[k][ps];
          prevDs[k][ps] = ds;
          if (was <= 0 && ds > 0 && b.honkT === 0 && Math.abs(c.side - p.side) < HONK_GAP && c.speed > p.speed) {
            b.honkT = HONK_COOL;
            honk.car = c.id;
            honk.slot = p.slot;
            r.events.emit('honk', honk);
          }
        }
        if (b.gag !== 'done') stepGag(r, b, L);
      }
    },
  });
  return brains;
}

/** ACHTERUIT's gag, one tick (after the cars moved): the trigger, the spins (kinematic), the backwards stretch. */
function stepGag(r: RallyRunner, b: RivalBrain, L: number): void {
  const c = b.car;
  const ph = c.phys;
  const info = trackInfo(r.track);
  if (b.gag === 'ready') {
    if (c.lap < 2 || c.speed < GAG.minSpeed || ph.spin > 0 || ph.blink > 0) return;
    // A player behind it (it is a show) — or, on lap 3, anyone's welcome.
    let seen = c.lap >= 3;
    for (const p of r.cars) {
      if (p.slot < 0 || p.finished) continue;
      const ds = c.dist - p.dist;
      if (ds > 15 && ds < GAG.behind) seen = true;
    }
    if (!seen) return;
    // A straight ahead, and nothing close ahead.
    for (let x = 0; x <= GAG.straight; x += info.bin) if (Math.abs(curvAt(info, c.s + x)) > GAG.curv) return;
    for (const o of r.bodies) {
      if (o === c || o.phys.ghost) continue;
      const ds = dsOf(c.s, o.s, L);
      if (ds > -12 && ds < 70 && Math.abs(o.side - c.side) < 3) return;
    }
    b.gag = 'spin';
    b.gagT = 0;
  }
  if (b.gag === 'spin' || b.gag === 'spinBack') {
    // Turn the body round its centre over `GAG.spin` ticks, keeping its world velocity (a slide).
    spinBy(c, PI / GAG.spin);
    ph.stuck = 0;
    b.gagT++;
    if (b.gagT >= GAG.spin) {
      b.gag = b.gag === 'spin' ? 'back' : 'done';
      b.gagT = 0;
      ph.yawRate = 0;
    }
    return;
  }
  if (b.gag === 'back') {
    // The stuck check counts "the wrong way": it is the gag, not a crash.
    ph.stuck = 0;
    b.gagT++;
    let stop = b.gagT >= GAG.back || ph.spin > 0;
    if (!stop) {
      // A bend or a body close ahead (in its direction of travel) ends it.
      if (Math.abs(curvAt(info, c.s + 60)) > GAG.curv * 2) stop = true;
      for (const o of r.bodies) {
        if (o === c || o.phys.ghost) continue;
        const ds = dsOf(c.s, o.s, L);
        if (ds > 0 && ds < 45 && Math.abs(o.side - c.side) < 2.6) stop = true;
      }
    }
    if (stop) {
      b.gag = 'spinBack';
      b.gagT = 0;
    }
  }
}

/** Turn a body by `da` (rad, + = left) keeping its world velocity (speed and slip re-expressed). */
function spinBy(c: RallyBody, da: number): void {
  const ph = c.phys;
  const fx = sinT(c.yaw);
  const fz = cosT(c.yaw);
  const vx = c.speed * fx - ph.slip * fz;
  const vz = c.speed * fz + ph.slip * fx;
  c.yaw = wrapAngle(c.yaw + da);
  const gx = sinT(c.yaw);
  const gz = cosT(c.yaw);
  c.speed = vx * gx + vz * gz;
  ph.slip = vx * -gz + vz * gx;
  // The physics adds no turn of its own meanwhile.
  ph.yawRate = 0;
}
