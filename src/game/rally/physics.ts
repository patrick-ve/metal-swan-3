/**
 * The car physics (docs/design/rally.md §2, §6, §12.4; docs/api/rally.md "A.D"): an arcade model of
 * a car on a road band, deterministic (a fixed 60 Hz step, float64, only + − × ÷, Math.sqrt / floor
 * / abs / min / max / sign and the r3 trig tables).
 *
 * - **Longitudinal:** full gas pulls with `min(accel, power / v)` (a traction limit, then a power
 *   curve), against the drag `drag·v²` (set so the top speed is `topSpeed`), rolling resistance and
 *   engine braking; the brake (and, at a standstill, reverse up to 8 m/s); the handbrake; the road's
 *   slope (gravity along the heading).
 * - **Steering:** the wheel follows the input at a rate (`PHYS.steerRate`; faster back to the
 *   centre). The lock falls with speed so that full lock asks `lockGrip` × the front grip at any
 *   speed (a stick or a key gets the whole range). The yaw rate follows the kinematic one (speed ·
 *   angle / wheelbase), capped by the front grip: past the cap the car **understeers** (it turns no
 *   tighter and the tyres scrub speed). The front grip falls at high speed and, front-wheel drive,
 *   under full gas: the estates push wide when driven hard.
 * - **Slip:** the world velocity is kept while the heading turns; the tyres pull the sideways part
 *   back at up to the axles' grip. Normal cornering stays below it (no slide); the **handbrake**
 *   cuts the rear grip and lets the yaw rate run past the cap: the tail steps out and the car slides.
 * - **The road:** the arc length and the side offset under the car (the spline's `nearest`), the
 *   height and the pitch from the track sample (no flight), the **barriers** (`track.bounds` or
 *   ±halfWidth, with the body's extent at its angle): a hit removes the speed into the wall, a
 *   little bounce, friction along it, the car turns toward the wall's line; a scrape costs speed.
 * - **Bodies** (`RallyBody`: the race cars, and from wave B traffic and police) collide car to car
 *   (`Collider`: three circles per body, impulses by mass and yaw inertia, no overlap after a tick).
 * - **Slipstream** (`draftStep`): behind a body in the same lane the drag falls a little (top speed
 *   about +5 %).
 * - **Recovery** (`stuckStep`, `recoverBody`): the wrong way, or standing still while trying to
 *   move, for 3 s, or locked (3 s pressed against the car ahead below half the top speed) → back on
 *   the track, straight, standing, in a free lane, with a hold and a blink.
 *
 * Nothing here allocates per tick.
 */
import type { SplineSample } from '../../engine/r3/spline';
import { angleDiff, atan2T, cosT, sinT, wrapAngle } from '../../engine/r3/trig';
import type { CarPhys, CarSpec, Handling, RallyBody, RallyInput, RallyTrack, TrackBounds } from './api';

export const DT = 1 / 60;
/** m/s². */
export const GRAVITY = 9.81;

export const PHYS = {
  /** Rolling resistance (m/s²). */
  roll: 0.15,
  /** Engine braking with no gas (m/s²). */
  engineBrake: 0.6,
  /** The brake at full pedal when a spec gives none (m/s²). */
  brake: 11,
  /** Reversing: acceleration (m/s²) and top speed (m/s). */
  reverse: 4,
  reverseTop: 8,
  /** The handbrake's own deceleration (m/s²). */
  handbrake: 5,
  /** Lateral grip of an axle at `grip` 1 (m/s²). */
  grip: 10.5,
  /** The wheel at low speed (rad) and the share of the front grip that full lock asks at speed. */
  maxLock: 0.6,
  lockGrip: 1.3,
  /** How far the wheel moves per tick toward the input (of full lock), and back toward the centre. */
  steerRate: 1 / 12,
  steerReturn: 1 / 6,
  /** Front grip × (1 − k · (v / top)²): understeer at high speed. */
  speedUndersteer: 0.18,
  /** Front-wheel drive: front grip × (1 − k · gas); rear-wheel drive: the rear instead. */
  powerUndersteer: 0.12,
  /** The handbrake: rear grip ×, the yaw target ×, and extra yaw room (m/s² over the front grip). */
  handbrakeRear: 0.3,
  handbrakeYaw: 2,
  handbrakeRoom: 14,
  /** Deceleration of a full understeer (the wheel at twice the grip; m/s²). */
  scrub: 2.2,
  /** Deceleration per m/s of sideways slide (1/s). */
  slideDrag: 0.25,
  /** Barriers: the bounce of the speed into the wall, friction along it per m/s of impact, the scrape (m/s²), the turn toward the wall's line. */
  wallBounce: 0.2,
  wallFriction: 0.35,
  wallScrape: 0.5,
  wallAlign: 0.35,
  /** Ticks off the wall before a touch counts as a new scrape (`phys.scrape` < 0 meanwhile). */
  scrapeGap: 20,
  /** Car–car: restitution, friction share. */
  carBounce: 0.25,
  carFriction: 0.3,
  /**
   * Car–car: a contact slower than this along the normal (m/s) is a push or a rub, not a hit: no
   * bounce and no turn (a resting contact that added yaw every tick locked two cars together).
   */
  restVel: 1,
  /** A hit this hard (m/s of speed change) spins the car for `spinTicks`. */
  spinHit: 7,
  spinTicks: 24,
  /** A car–car bump this hard (m/s) is an event; then a cooldown (ticks). */
  bumpEvent: 1.5,
  bumpCool: 20,
  /** The grid: a jump start only creeps (m/s). */
  creep: 0.8,
  /** Recovery: after this many stuck ticks; the hold (input ignored) and the blink (no contact). */
  recoverTicks: 180,
  recoverHold: 30,
  recoverBlink: 90,
  /** Stuck: slower than this (m/s) while pressing gas or brake, or facing the track at cos < this. */
  stuckSpeed: 1,
  wrongWay: -0.3,
  /**
   * Locked: pressed against the car ahead for this many ticks (`phys.lock`: +1 per contact tick, −1
   * per free one) below `lockSpeed` × its top speed → the recovery (the rear car of the pair).
   */
  lockTicks: 180,
  lockSpeed: 0.5,
  lockMax: 600,
  /** Slipstream: range (m), lane width (m), the drag cut at full draft, the follow rate per tick. */
  draftRange: 30,
  draftWidth: 1.6,
  draftGain: 0.15,
  draftRate: 0.03,
} as const;

/** The default power (W/kg) = accel × this × top speed (the speed share where the power curve takes over). */
export const POWER_KNEE = 0.4;

/** Body defaults (m): an estate-sized car. */
const DEF_LENGTH = 4.7;
const DEF_WIDTH = 1.8;
const DEF_WHEELBASE = 2.7;

const HANDLING = new WeakMap<CarSpec, Handling>();

/** The handling of a spec (cached per spec object): the CarSpec numbers with the defaults filled in. */
export function handlingOf(spec: CarSpec): Handling {
  const had = HANDLING.get(spec);
  if (had) return had;
  const top = Math.max(5, spec.topSpeed);
  const accel = Math.max(0.5, spec.accel);
  const power = spec.power ?? accel * POWER_KNEE * top;
  const drag = Math.max(1e-5, (power / top - PHYS.roll) / (top * top));
  const g = PHYS.grip * spec.grip;
  const length = spec.length ?? DEF_LENGTH;
  const width = spec.width ?? DEF_WIDTH;
  const mass = Math.max(100, spec.mass);
  const h: Handling = {
    mass,
    topSpeed: top,
    accel,
    power,
    drag,
    roll: PHYS.roll,
    brake: spec.brake ?? PHYS.brake,
    handbrake: PHYS.handbrake,
    gripFront: spec.gripFront ?? g,
    gripRear: spec.gripRear ?? g * 1.05,
    fwd: spec.fwd ?? true,
    wheelbase: spec.wheelbase ?? Math.min(DEF_WHEELBASE, length * 0.6),
    halfLen: length / 2,
    halfWid: width / 2,
    inertia: (mass * (length * length + width * width)) / 12,
    yawResp: Math.max(4, Math.min(12, (9 * 1400) / mass)),
    wake: Math.max(1, Math.min(2, (length * width) / (DEF_LENGTH * DEF_WIDTH))),
  };
  HANDLING.set(spec, h);
  return h;
}

/** A fresh physics state for a body of handling `h` (standing still). */
export function newPhys(h: Handling): CarPhys {
  return {
    h,
    slip: 0,
    yawRate: 0,
    pitch: 0,
    roll: 0,
    lat: 0,
    scrape: 0,
    scrapeSide: 0,
    bumpT: 1000,
    stuck: 0,
    blink: 0,
    hold: 0,
    spin: 0,
    draft: 0,
    ghost: false,
    rev: 0,
    gear: 1,
    lock: 0,
    scrapes: 0,
    bumps: 0,
    recoveries: 0,
    vmax: 0,
    grade: 0,
  };
}

/** The wheel's full lock at speed u (rad): `maxLock`, or less so that full lock asks `lockGrip` × the front grip. */
export function lockAt(h: Handling, u: number): number {
  const a = Math.abs(u);
  const lim = (PHYS.lockGrip * h.gripFront * h.wheelbase) / Math.max(1, a * a);
  return lim < PHYS.maxLock ? lim : PHYS.maxLock;
}

/** The front grip at speed u under gas (m/s²): less at high speed, and with front-wheel drive under power. */
export function frontGrip(h: Handling, u: number, gas: number): number {
  const q = u / h.topSpeed;
  let g = h.gripFront * (1 - PHYS.speedUndersteer * Math.min(1.5, q * q));
  if (h.fwd) g *= 1 - PHYS.powerUndersteer * gas;
  return g;
}

/** The barrier faces at arc length s (`track.bounds`, else ±halfWidth). */
export function trackBounds(track: RallyTrack, s: number, out: TrackBounds): TrackBounds {
  if (track.bounds) return track.bounds(s, out);
  out.left = -track.halfWidth;
  out.right = track.halfWidth;
  return out;
}

/** The side offset of lane i at s (`track.laneSide`, else `track.laneOffset`, else `lanes` lanes centred on the centre line). */
export function laneSide(track: RallyTrack, i: number, s: number): number {
  if (track.laneSide) return track.laneSide(i, s);
  if (track.laneOffset) return track.laneOffset(i);
  return (i - (track.lanes - 1) / 2) * track.laneWidth;
}

/** The lane nearest to a side offset at s. */
export function laneOf(track: RallyTrack, side: number, s: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < track.lanes; i++) {
    const d = Math.abs(laneSide(track, i, s) - side);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

const BOUNDS: TrackBounds = { left: 0, right: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * One 60 Hz step of a body (the frozen entry point; `stepCar` is the same function): the wheel, the
 * speed, the yaw and the slide, the move, the road under it (arc length, side, height, pitch), the
 * barriers and the progress (`dist`). `cap` limits the speed (m/s; the grid's creep). `tmp` is a
 * scratch sample (it ends as the track sample under the body).
 */
export function stepBody(b: RallyBody, inp: Readonly<RallyInput>, track: RallyTrack, tmp: SplineSample, cap = Infinity): void {
  const ph = b.phys;
  const h = ph.h;
  if (ph.hold > 0) {
    // The recovery hold: the car stands where it was put.
    ph.hold--;
    b.speed = 0;
    ph.slip = 0;
    ph.yawRate = 0;
    b.steer = 0;
    ph.lat = 0;
    ph.rev = 0;
    return;
  }
  const gas = clamp(inp.gas, 0, 127) / 127;
  const brake = clamp(inp.brake, 0, 127) / 127;
  const hb = inp.handbrake;
  const want = clamp(inp.steer, -127, 127) / 127;
  // The wheel.
  const back = Math.abs(want) < Math.abs(b.steer) || want * b.steer < 0;
  const rate = back ? PHYS.steerReturn : PHYS.steerRate;
  const dw = want - b.steer;
  b.steer += dw > rate ? rate : dw < -rate ? -rate : dw;

  let fx = sinT(b.yaw);
  let fz = cosT(b.yaw);
  let u = b.speed;
  let v = ph.slip;

  // Longitudinal: drive, brake and reverse, then the resistances (they never flip the direction).
  const au = Math.abs(u);
  let a = 0;
  let reversing = false;
  if (gas > 0) {
    if (u >= -0.5) a += gas * Math.min(h.accel, h.power / Math.max(au, 1));
    else a += gas * h.brake;
  }
  if (brake > 0) {
    if (u > 0.5) a -= brake * h.brake;
    else if (gas === 0) {
      reversing = true;
      a -= brake * PHYS.reverse;
    }
  }
  a -= GRAVITY * ph.grade;
  // The front grip and the yaw target (needed for the scrub of an understeer).
  const gf0 = frontGrip(h, u, gas);
  let gr = h.fwd ? h.gripRear : h.gripRear * (1 - PHYS.powerUndersteer * gas);
  let gf = gf0;
  if (hb) gr *= PHYS.handbrakeRear;
  if (ph.spin > 0) {
    gf *= 0.4;
    gr *= 0.4;
  }
  const delta = b.steer * lockAt(h, u);
  let rKin = (u * delta) / h.wheelbase;
  let rLim = gf / Math.max(au, 1);
  if (hb) {
    rKin *= PHYS.handbrakeYaw;
    rLim = (gf + PHYS.handbrakeRoom) / Math.max(au, 1);
  }
  const aKin = Math.abs(rKin);
  const rT = rKin > rLim ? rLim : rKin < -rLim ? -rLim : rKin;
  let res = h.drag * u * u * (1 - PHYS.draftGain * ph.draft) + h.roll + PHYS.slideDrag * Math.abs(v);
  if (gas === 0 && u > 0) res += PHYS.engineBrake;
  if (hb) res += h.handbrake;
  if (aKin > rLim && rLim > 0) res += PHYS.scrub * Math.min(1, (aKin - rLim) / rLim) * Math.min(1, au / 10);
  u += a * DT;
  if (u > 0) u = Math.max(0, u - res * DT);
  else if (u < 0) u = Math.min(0, u + res * DT);
  if (reversing && u < -PHYS.reverseTop) u = Math.min(b.speed, -PHYS.reverseTop);
  if (u > cap) u = cap;
  else if (u < -cap) u = -cap;

  // The world velocity before the heading turns.
  let vx = u * fx - v * fz;
  let vz = u * fz + v * fx;

  // The yaw rate follows the target (a spin after a hard hit dies out slowly).
  let r = ph.yawRate;
  if (ph.spin > 0) {
    ph.spin--;
    r *= 0.96;
  } else {
    r += (rT - r) * Math.min(1, h.yawResp * DT);
  }
  if (au < 0.2 && Math.abs(v) < 0.2) r *= 0.5;
  b.yaw = wrapAngle(b.yaw + r * DT);
  fx = sinT(b.yaw);
  fz = cosT(b.yaw);
  // The same velocity in the turned frame; the tyres pull the sideways part back.
  u = vx * fx + vz * fz;
  v = vx * -fz + vz * fx;
  const kill = ((gf + gr) / 2) * DT;
  if (v > kill) v -= kill;
  else if (v < -kill) v += kill;
  else v = 0;
  ph.yawRate = r;
  ph.lat = u * r;

  // Move.
  vx = u * fx - v * fz;
  vz = u * fz + v * fx;
  const pos = b.pos;
  pos[0] += vx * DT;
  pos[2] += vz * DT;

  // The road under the body.
  const sp = track.spline;
  const prevS = b.s;
  const s = sp.nearest(pos[0], pos[2], prevS, 30);
  sp.sample(s, tmp);
  const t = tmp.t;
  const rr = tmp.r;
  const th = Math.sqrt(t[0] * t[0] + t[2] * t[2]) || 1;
  const tx = t[0] / th;
  const tz = t[2] / th;
  let side = (pos[0] - tmp.p[0]) * rr[0] + (pos[2] - tmp.p[2]) * rr[2];
  const bd = trackBounds(track, s, BOUNDS);
  let cosRel = fx * tx + fz * tz;
  const sinRel = fx * tz - fz * tx;
  const ext = h.halfLen * Math.abs(sinRel) + h.halfWid * Math.abs(cosRel);
  let contact = 0;
  let pen = 0;
  if (side + ext > bd.right) {
    contact = 1;
    pen = side + ext - bd.right;
  } else if (side - ext < bd.left) {
    contact = -1;
    pen = side - ext - bd.left;
  }
  if (contact !== 0) {
    pos[0] -= pen * rr[0];
    pos[2] -= pen * rr[2];
    side -= pen;
    const vn = (vx * rr[0] + vz * rr[2]) * contact;
    if (vn > 0) {
      const dn = vn * (1 + PHYS.wallBounce) * contact;
      vx -= dn * rr[0];
      vz -= dn * rr[2];
      const vt = vx * tx + vz * tz;
      const loss = Math.min(Math.abs(vt), PHYS.wallFriction * vn) * (vt < 0 ? -1 : 1);
      vx -= loss * tx;
      vz -= loss * tz;
      // The car turns toward the wall's line (the direction closer to its heading).
      const wallYaw = atan2T(cosRel >= 0 ? tx : -tx, cosRel >= 0 ? tz : -tz);
      b.yaw = wrapAngle(b.yaw + angleDiff(b.yaw, wallYaw) * PHYS.wallAlign * Math.min(1, vn / 6));
      ph.yawRate *= 0.5;
      fx = sinT(b.yaw);
      fz = cosT(b.yaw);
      cosRel = fx * tx + fz * tz;
    }
    // The scrape: speed lost along the wall.
    const vl = Math.sqrt(vx * vx + vz * vz);
    if (vl > 0) {
      const k = Math.max(0, vl - PHYS.wallScrape * DT) / vl;
      vx *= k;
      vz *= k;
    }
    // A new scrape (counted, its event) only after `scrapeGap` ticks off the wall: rattling along it is one.
    if (ph.scrape < 0) ph.scrape = 2;
    else if (ph.scrape === 0) {
      ph.scrapes++;
      ph.scrape = 1;
    } else ph.scrape++;
    ph.scrapeSide = contact;
  } else {
    if (ph.scrape > 0) ph.scrape = -PHYS.scrapeGap;
    else if (ph.scrape < 0) ph.scrape++;
    ph.scrapeSide = 0;
  }
  b.speed = vx * fx + vz * fz;
  ph.slip = vx * -fz + vz * fx;

  // Height and pitch from the road (no flight), the lean in corners.
  pos[1] = tmp.p[1];
  ph.grade = t[1] * cosRel;
  ph.pitch = atan2T(t[1] * cosRel, th);
  const lean = clamp(ph.lat * 0.006, -0.07, 0.07);
  ph.roll += (lean - ph.roll) * 0.15;

  // Progress along the track.
  const L = track.length;
  let d = s - prevS;
  if (d > L / 2) d -= L;
  else if (d < -L / 2) d += L;
  b.dist += d;
  b.s = s;
  b.side = side;

  // Cosmetic: revs and the gear (wave C's engine).
  const sp2 = Math.abs(b.speed);
  if (sp2 > ph.vmax) ph.vmax = sp2;
  gearOf(ph, b.speed, gas);
}

/** The PREP name of `stepBody` (the frozen entry point). */
export const stepCar = stepBody;

/** Gear bands (m/s): 1st to 5th. */
const GEARS: readonly number[] = [0, 13, 24, 35, 47, 1e9];

function gearOf(ph: CarPhys, u: number, gas: number): void {
  if (u < -0.3) {
    ph.gear = -1;
    ph.rev = Math.min(1, 0.3 + (-u / PHYS.reverseTop) * 0.6);
    return;
  }
  let g = 1;
  while (g < 5 && u >= GEARS[g]) g++;
  ph.gear = g;
  const lo = GEARS[g - 1];
  const hi = g === 5 ? ph.h.topSpeed : GEARS[g];
  const f = clamp((u - lo) / Math.max(1, hi - lo), 0, 1);
  ph.rev = 0.25 + 0.65 * f + (gas > 0 ? 0.1 : 0);
}

/**
 * Stuck bookkeeping of one race tick: counts the ticks a body faces the wrong way, or stands still
 * while its driver presses gas or brake. Returns true when the recovery is due (the caller places
 * the body with `recoverBody`): 3 s stuck, or locked (`phys.lock`: 3 s pressed against the car ahead
 * at less than half its top speed). Uses `tmp` = the track sample under the body (after `stepBody`).
 */
export function stuckStep(b: RallyBody, inp: Readonly<RallyInput>, tmp: SplineSample): boolean {
  const ph = b.phys;
  if (ph.hold > 0) return false;
  if (ph.lock >= PHYS.lockTicks && Math.abs(b.speed) < PHYS.lockSpeed * ph.h.topSpeed) return true;
  const t = tmp.t;
  const th = Math.sqrt(t[0] * t[0] + t[2] * t[2]) || 1;
  const cosRel = (sinT(b.yaw) * t[0] + cosT(b.yaw) * t[2]) / th;
  const wrongWay = cosRel < PHYS.wrongWay;
  const trying = inp.gas > 0 || inp.brake > 0;
  if (wrongWay || (trying && Math.abs(b.speed) < PHYS.stuckSpeed)) ph.stuck++;
  else ph.stuck = 0;
  return ph.stuck >= PHYS.recoverTicks;
}

/**
 * Put a body back on the track at its arc length (its progress stays), `side` m right of the
 * centre, facing along the road, standing; the hold and the blink start (no car–car contact).
 */
export function recoverBody(b: RallyBody, track: RallyTrack, side: number, tmp: SplineSample): void {
  const ph = b.phys;
  track.spline.sample(b.s, tmp);
  b.pos[0] = tmp.p[0] + tmp.r[0] * side;
  b.pos[1] = tmp.p[1];
  b.pos[2] = tmp.p[2] + tmp.r[2] * side;
  b.yaw = atan2T(tmp.t[0], tmp.t[2]);
  b.side = side;
  b.speed = 0;
  b.steer = 0;
  ph.slip = 0;
  ph.yawRate = 0;
  ph.spin = 0;
  ph.stuck = 0;
  ph.scrape = 0;
  ph.scrapeSide = 0;
  ph.lock = 0;
  ph.hold = PHYS.recoverHold;
  ph.blink = PHYS.recoverBlink;
  ph.recoveries++;
}

/** Wrapped arc-length difference b − a in (−L/2, L/2]. */
export function dsOf(a: number, b: number, L: number): number {
  let d = b - a;
  if (d > L / 2) d -= L;
  else if (d <= -L / 2) d += L;
  return d;
}

/**
 * Slipstream of one body for one tick: the nearest body ahead within `draftRange` m in the same
 * lane (|Δside| < `draftWidth`) gives a draft that grows the closer it is (× its wake); the state
 * follows at `draftRate` per tick.
 */
export function draftStep(b: RallyBody, bodies: readonly RallyBody[], n: number, L: number): void {
  const ph = b.phys;
  let target = 0;
  if (b.speed > 10) {
    for (let i = 0; i < n; i++) {
      const o = bodies[i];
      if (o === b || o.phys.ghost) continue;
      const ds = dsOf(b.s, o.s, L);
      const gap = ds - ph.h.halfLen - o.phys.h.halfLen;
      if (gap <= 0 || gap > PHYS.draftRange) continue;
      if (Math.abs(o.side - b.side) > PHYS.draftWidth) continue;
      const k = (1 - gap / PHYS.draftRange) * o.phys.h.wake;
      if (k > target) target = k;
    }
  }
  if (target > 1) target = 1;
  ph.draft += (target - ph.draft) * PHYS.draftRate;
}

/** The world velocity of a body (out[0] = x, out[1] = z). */
function velOf(b: RallyBody, out: number[]): void {
  const fx = sinT(b.yaw);
  const fz = cosT(b.yaw);
  out[0] = b.speed * fx - b.phys.slip * fz;
  out[1] = b.speed * fz + b.phys.slip * fx;
}

/** Write a world velocity back as speed and slip. */
function setVel(b: RallyBody, vx: number, vz: number): void {
  const fx = sinT(b.yaw);
  const fz = cosT(b.yaw);
  b.speed = vx * fx + vz * fz;
  b.phys.slip = vx * -fz + vz * fx;
}

/**
 * Car–car contact (spec §2 "Collisions"): each body is three circles along its length (radius =
 * half its width); the deepest overlap of a pair is pushed apart by inverse mass, and an impulse
 * (restitution `carBounce`, friction `carFriction`) changes both velocities and yaw rates. A slow
 * contact (closing below `restVel`: a push or a rub) only cancels the closing speed: no bounce, no
 * turn. The rear body of a touching pair counts its `phys.lock` up (the locked recovery). Ghosts
 * (`phys.ghost`, `phys.blink`) are skipped. The bumps of this pass are in `hitA` / `hitB` / `hitDv`
 * (`hits` long; the event cooldown applied); the arrays are reused.
 */
export class Collider {
  readonly hitA: (RallyBody | null)[] = new Array<RallyBody | null>(32).fill(null);
  readonly hitB: (RallyBody | null)[] = new Array<RallyBody | null>(32).fill(null);
  readonly hitDv: number[] = new Array<number>(32).fill(0);
  hits = 0;
  private readonly va = [0, 0];
  private readonly vb = [0, 0];

  /** One pass over the first `n` bodies. */
  collide(bodies: readonly RallyBody[], n: number, L: number): void {
    this.hits = 0;
    for (let i = 0; i < n; i++) {
      const ph = bodies[i].phys;
      if (ph.lock > 0) ph.lock--;
    }
    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a.phys.ghost || a.phys.blink > 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b.phys.ghost || b.phys.blink > 0) continue;
        const reach = a.phys.h.halfLen + b.phys.h.halfLen + 0.5;
        const ds = dsOf(a.s, b.s, L);
        if (Math.abs(ds) > reach) continue;
        if (Math.abs(a.side - b.side) > reach) continue;
        if (this.pair(a, b)) {
          // The rear body of the pair presses on: its lock counts up (net +1 per contact tick).
          const rear = ds >= 0 ? a.phys : b.phys;
          rear.lock = rear.lock + 2 > PHYS.lockMax ? PHYS.lockMax : rear.lock + 2;
        }
      }
    }
  }

  /** One pair: true when the bodies overlapped (they are pushed apart). */
  private pair(a: RallyBody, b: RallyBody): boolean {
    const ha = a.phys.h;
    const hb = b.phys.h;
    const afx = sinT(a.yaw), afz = cosT(a.yaw);
    const bfx = sinT(b.yaw), bfz = cosT(b.yaw);
    const ka = Math.max(0, ha.halfLen - ha.halfWid);
    const kb = Math.max(0, hb.halfLen - hb.halfWid);
    const rad = ha.halfWid + hb.halfWid;
    // The deepest overlapping pair of circles.
    let best = 0;
    let ax = 0, az = 0, nx = 0, nz = 0, dist = 0;
    for (let p = -1; p <= 1; p++) {
      const cax = a.pos[0] + afx * ka * p;
      const caz = a.pos[2] + afz * ka * p;
      for (let q = -1; q <= 1; q++) {
        const cbx = b.pos[0] + bfx * kb * q;
        const cbz = b.pos[2] + bfz * kb * q;
        const dx = cbx - cax;
        const dz = cbz - caz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        const d = Math.sqrt(d2);
        const o = rad - d;
        if (o > best) {
          best = o;
          ax = cax;
          az = caz;
          dist = d;
          if (d > 1e-6) {
            nx = dx / d;
            nz = dz / d;
          } else {
            // Exactly on top of each other: apart sideways (a's right).
            nx = -afz;
            nz = afx;
          }
        }
      }
    }
    if (best <= 0) return false;
    void dist;
    const ima = 1 / ha.mass;
    const imb = 1 / hb.mass;
    const share = ima + imb;
    // Apart (no overlap after the tick).
    const pa = (best * ima) / share;
    const pb = (best * imb) / share;
    a.pos[0] -= nx * pa;
    a.pos[2] -= nz * pa;
    b.pos[0] += nx * pb;
    b.pos[2] += nz * pb;
    // The contact point and the impulse.
    const cx = ax + nx * ha.halfWid;
    const cz = az + nz * ha.halfWid;
    const rax = cx - a.pos[0], raz = cz - a.pos[2];
    const rbx = cx - b.pos[0], rbz = cz - b.pos[2];
    const va = this.va;
    const vb = this.vb;
    velOf(a, va);
    velOf(b, vb);
    const wa = a.phys.yawRate;
    const wb = b.phys.yawRate;
    // Point velocity: v + ω·(r.z, −r.x).
    const pax = va[0] + wa * raz, paz = va[1] - wa * rax;
    const pbx = vb[0] + wb * rbz, pbz = vb[1] - wb * rbx;
    const rvx = pbx - pax, rvz = pbz - paz;
    const vrel = rvx * nx + rvz * nz;
    if (vrel >= 0) return true;
    // A slow contact (a push, a rub) only cancels the closing speed: no bounce, no turn.
    const hit = vrel < -PHYS.restVel;
    const ca = hit ? nx * raz - nz * rax : 0;
    const cb = hit ? nx * rbz - nz * rbx : 0;
    const denom = share + (ca * ca) / ha.inertia + (cb * cb) / hb.inertia;
    const j = (-(hit ? 1 + PHYS.carBounce : 1) * vrel) / denom;
    // Friction along the contact (side swipes drag).
    const tnx = -nz, tnz = nx;
    const vt = rvx * tnx + rvz * tnz;
    let jt = -vt / share;
    const jmax = PHYS.carFriction * j;
    if (jt > jmax) jt = jmax;
    else if (jt < -jmax) jt = -jmax;
    const ix = j * nx + jt * tnx;
    const iz = j * nz + jt * tnz;
    setVel(a, va[0] - ix * ima, va[1] - iz * ima);
    setVel(b, vb[0] + ix * imb, vb[1] + iz * imb);
    const dwa = hit ? -(ix * raz - iz * rax) / ha.inertia : 0;
    const dwb = hit ? (ix * rbz - iz * rbx) / hb.inertia : 0;
    a.phys.yawRate = wa + dwa;
    b.phys.yawRate = wb + dwb;
    const dva = j * ima;
    const dvb = j * imb;
    if (dva > PHYS.spinHit && Math.abs(dwa) > 0.5) a.phys.spin = PHYS.spinTicks;
    if (dvb > PHYS.spinHit && Math.abs(dwb) > 0.5) b.phys.spin = PHYS.spinTicks;
    const dv = dva > dvb ? dva : dvb;
    if (dv >= PHYS.bumpEvent && a.phys.bumpT >= PHYS.bumpCool && b.phys.bumpT >= PHYS.bumpCool) {
      a.phys.bumpT = 0;
      b.phys.bumpT = 0;
      a.phys.bumps++;
      b.phys.bumps++;
      if (this.hits < this.hitA.length) {
        this.hitA[this.hits] = a;
        this.hitB[this.hits] = b;
        this.hitDv[this.hits] = dv;
        this.hits++;
      }
    }
    return true;
  }
}

/** The yaw of a horizontal direction (dx, dz): forward(yaw) = (sin yaw, 0, cos yaw). */
export function yawOf(dx: number, dz: number): number {
  return atan2T(dx, dz);
}
