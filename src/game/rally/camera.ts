/**
 * The race cameras (docs/design/rally.md §7.6; docs/api/rally.md "A.D"). Cosmetic: they read the
 * race, never change it. Pure and deterministic (r3 trig), stepped with the race at 60 Hz.
 *
 * - **Chase** (the default): behind and above the car on a soft spring around the car — the
 *   camera's position is rigid to the car (no lag, no jitter at 200 km/h); its HEADING follows the
 *   car's on a critically damped spring (`CAM.yawOmega`; most of its steady lag in a bend is fed
 *   forward, `yawLead`), turned a little toward the direction of travel (a slide shows) and into the
 *   corner ahead (`lookAhead`, from the track's yaw further on).
 *   The height and the road's pitch are smoothed; the distance and the field of view grow a little
 *   with speed. Vertical field of view about 65° (1P), `FOV_SPLIT` in a 384 × 108 split view (the
 *   same horizontal view; the camera `splitDist` further back and `splitPitch` more down there).
 * - **Bumper:** on the front bumper, low, rigid to the car (its pitch and half its lean).
 * - **Look back** (held): the chase camera moves in front of the car and looks back; the bumper
 *   camera looks out of the rear bumper.
 * - **The results orbit:** after the player's finish the camera circles the car (`CAM.orbit*`),
 *   starting from where the chase camera was.
 *
 * Each player view has a `CamRig` (the runner keeps one per slot, steps it every tick with
 * `stepRig` and binds it to the player's car); `rallyCam(kind, car, out, split)` places a `Cam3`
 * from the car's rig (the frozen entry point; a car without a rig gets the plain rigid camera).
 */
import { angleDiff, atan2T, cosT, PI, sinT, wrapAngle } from '../../engine/r3/trig';
import type { SplineSample } from '../../engine/r3/spline';
import type { Cam3 } from '../../engine/view3d';
import type { RallyBody, RallyTrack } from './api';
import type { RallyCam } from './ids';
import { bodyShape, dsOf, DT } from './physics';
import { yawAt, type TrackInfo } from './track-info';

const DEG = Math.PI / 180;
/** The vertical field of view: 1P about 65° (spec §7.6); a 384 × 108 split view a narrower one. */
export const FOV_FULL = 65 * DEG;
export const FOV_SPLIT = 38 * DEG;

/** The camera tuning (m, rad, per tick unless said). */
export const CAM = {
  /** Chase: distance behind the car at rest and the extra at top speed; height; the downward tilt. */
  dist: 6.3,
  distFast: 1.3,
  height: 2.3,
  heightFast: 0.25,
  pitch: -0.12,
  /** The heading spring (rad/s; critically damped) and the most the heading may lag (rad). */
  yawOmega: 6.5,
  yawLagMax: 0.45,
  /** Share of the slip angle the heading follows (a slide shows the car's side). */
  slipShare: 0.5,
  /** Look-ahead: share of the track's turn `20 + 0.6·v` m ahead, and its cap (rad). */
  lookAhead: 0.25,
  lookAheadMax: 0.12,
  /** Share of the spring's steady lag in a turn that is cancelled (the yaw rate fed forward): the rest shows the car's flank. */
  yawLead: 0.75,
  /** The road's pitch: share the chase camera takes; smoothing of the height and the pitch. */
  roadPitch: 0.6,
  ySmooth: 0.25,
  pitchSmooth: 0.1,
  /** The field of view grows by this (rad) at top speed (squared). */
  fovFast: 5 * DEG,
  /** Bumper: from the nose (m) and the height. */
  bumperIn: 0.2,
  bumperHeight: 0.85,
  /** The results orbit: radius, height, the speed (rad per tick), the point looked at (height). */
  orbitRadius: 8.5,
  orbitHeight: 2.6,
  orbitRate: 0.011,
  orbitLook: 0.8,
  /** The top speed the speed effects are measured against (m/s). */
  vRef: 61,
  /**
   * A split view (384 × 108, `FOV_SPLIT`): the chase camera a little further back and tilted a
   * little more down, so the whole car (its rear bumper and its shadow) stays inside the view.
   */
  splitDist: 0.6,
  splitPitch: -0.08,
} as const;

export function newCam(): Cam3 {
  return { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fovY: FOV_FULL, near: 0.5, far: 600 };
}

/** One player view's camera state (cosmetic; stepped every race tick). */
export interface CamRig {
  /** The chase camera's heading and its spring rate (rad/s). */
  yaw: number;
  yawVel: number;
  /** The smoothed road height under the car and the road's pitch. */
  y: number;
  pitch: number;
  /** The smoothed chase distance and the extra field of view. */
  dist: number;
  fovAdd: number;
  /** Look back held this tick. */
  back: boolean;
  /** The results orbit is on, and its angle (from the car to the camera). */
  orbit: boolean;
  orbitA: number;
  /** Set on the first step (the rig starts behind the car). */
  ready: boolean;
}

export function newRig(): CamRig {
  return { yaw: 0, yawVel: 0, y: 0, pitch: 0, dist: CAM.dist, fovAdd: 0, back: false, orbit: false, orbitA: 0, ready: false };
}

const RIGS = new WeakMap<RallyBody, CamRig>();

/** Bind a rig to a car (`rallyCam` then reads it); null unbinds. */
export function bindRig(car: RallyBody, rig: CamRig | null): void {
  if (rig) RIGS.set(car, rig);
  else RIGS.delete(car);
}

/** The rig bound to a car (null: none). */
export function rigOf(car: RallyBody): CamRig | null {
  return RIGS.get(car) ?? null;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** One 60 Hz step of a rig behind `car` (`info`: the track's tables for the look-ahead; null = none). */
export function stepRig(rig: CamRig, car: RallyBody, info: TrackInfo | null, lookBack: boolean, orbit: boolean): void {
  const ph = car.phys;
  const u = car.speed;
  if (!rig.ready) {
    rig.ready = true;
    rig.yaw = car.yaw;
    rig.yawVel = 0;
    rig.y = car.pos[1];
    rig.pitch = ph.pitch;
    rig.dist = CAM.dist;
    rig.fovAdd = 0;
  }
  let target = car.yaw;
  // Feed the yaw rate forward: in a long bend the camera does not hang outside the turn.
  target += ph.yawRate * (2 / CAM.yawOmega) * CAM.yawLead;
  if (u > 3) {
    target += atan2T(-ph.slip, u) * CAM.slipShare;
    if (info) {
      const here = yawAt(info, car.s);
      // Only when the car runs with the track (not after a spin).
      if (cosT(angleDiff(car.yaw, here)) > 0.5) {
        const la = angleDiff(here, yawAt(info, car.s + 20 + 0.6 * u)) * CAM.lookAhead;
        target += clamp(la, -CAM.lookAheadMax, CAM.lookAheadMax);
      }
    }
  }
  const w = CAM.yawOmega;
  const e = angleDiff(rig.yaw, target);
  rig.yawVel += (w * w * e - 2 * w * rig.yawVel) * DT;
  rig.yaw = wrapAngle(rig.yaw + rig.yawVel * DT);
  const lag = angleDiff(rig.yaw, target);
  if (lag > CAM.yawLagMax) rig.yaw = wrapAngle(target - CAM.yawLagMax);
  else if (lag < -CAM.yawLagMax) rig.yaw = wrapAngle(target + CAM.yawLagMax);
  rig.y += (car.pos[1] - rig.y) * CAM.ySmooth;
  rig.pitch += (ph.pitch - rig.pitch) * CAM.pitchSmooth;
  const q = clamp(Math.abs(u) / CAM.vRef, 0, 1.2);
  rig.dist += (CAM.dist + CAM.distFast * q - rig.dist) * 0.05;
  rig.fovAdd += (CAM.fovFast * q * q - rig.fovAdd) * 0.05;
  rig.back = lookBack;
  if (orbit) {
    if (!rig.orbit) rig.orbitA = rig.yaw + PI;
    rig.orbitA = wrapAngle(rig.orbitA + CAM.orbitRate);
  }
  rig.orbit = orbit;
}

/**
 * Place `out` for `car` (the frozen entry point): chase or bumper, from the car's rig (`rig`, else
 * the one bound to the car, else the rigid camera); `split` = a 384 × 108 view.
 */
export function rallyCam(kind: RallyCam, car: RallyBody, out: Cam3, split: boolean, rig: CamRig | null = rigOf(car)): Cam3 {
  const p = car.pos;
  const ph = car.phys;
  const fov = split ? FOV_SPLIT : FOV_FULL;
  out.near = 0.5;
  out.far = 600;
  out.roll = 0;
  if (rig && rig.orbit) {
    const a = rig.orbitA;
    out.pos[0] = p[0] + sinT(a) * CAM.orbitRadius;
    out.pos[1] = rig.y + CAM.orbitHeight;
    out.pos[2] = p[2] + cosT(a) * CAM.orbitRadius;
    out.yaw = wrapAngle(a + PI);
    out.pitch = -atan2T(CAM.orbitHeight - CAM.orbitLook, CAM.orbitRadius);
    out.fovY = fov;
    return out;
  }
  const back = rig?.back ?? false;
  if (kind === 'bumper') {
    const yaw = back ? wrapAngle(car.yaw + PI) : car.yaw;
    const fx = sinT(car.yaw);
    const fz = cosT(car.yaw);
    // The model's own mount (CARS' anchors through the physics, wave B) when it has one.
    const sh = bodyShape(ph.h);
    const k = back ? -(ph.h.halfLen - CAM.bumperIn) : sh ? sh.cam[2] : ph.h.halfLen - CAM.bumperIn;
    const hy = sh && !back ? sh.cam[1] : CAM.bumperHeight;
    out.pos[0] = p[0] + fx * k;
    out.pos[1] = p[1] + hy + ph.pitch * k;
    out.pos[2] = p[2] + fz * k;
    out.yaw = yaw;
    out.pitch = (back ? -ph.pitch : ph.pitch) - 0.02;
    out.roll = (back ? -ph.roll : ph.roll) * 0.5;
    out.fovY = fov + (rig ? rig.fovAdd * (fov / FOV_FULL) : 0);
    return out;
  }
  const y = rig ? rig.y : p[1];
  const yaw = rig ? rig.yaw : car.yaw;
  const dist = (rig ? rig.dist : CAM.dist) + (split ? CAM.splitDist : 0);
  const q = clamp(Math.abs(car.speed) / CAM.vRef, 0, 1.2);
  const height = CAM.height + CAM.heightFast * q;
  const pitch = (rig ? rig.pitch * CAM.roadPitch : 0) + (split ? CAM.splitPitch : 0);
  if (back) {
    // In front of the car, looking back at it and the road behind.
    const fx = sinT(car.yaw);
    const fz = cosT(car.yaw);
    out.pos[0] = p[0] + fx * dist;
    out.pos[1] = y + height;
    out.pos[2] = p[2] + fz * dist;
    out.yaw = wrapAngle(car.yaw + PI);
    out.pitch = CAM.pitch - pitch;
  } else {
    const fx = sinT(yaw);
    const fz = cosT(yaw);
    out.pos[0] = p[0] - fx * dist;
    out.pos[1] = y + height;
    out.pos[2] = p[2] - fz * dist;
    out.yaw = yaw;
    out.pitch = CAM.pitch + pitch;
  }
  out.fovY = fov + (rig ? rig.fovAdd * (fov / FOV_FULL) : 0);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The race intro (wave B, spec §1): the camera flies over the grid, then settles into the chase view
// ---------------------------------------------------------------------------------------------

/** The fly-over's length (ticks, 4 s) and the shape of its path (m). Cosmetic. */
export const INTRO = {
  ticks: 240,
  /** It starts this far ahead of the grid's front, this high, looking back down at the field. */
  ahead: 70,
  height: 26,
  /** It swings this far out to the right of the grid at the middle of its path. */
  swing: 15,
  /** The last share of the path blends into the chase camera. */
  blend: 0.25,
} as const;

function smooth(x: number): number {
  const u = x < 0 ? 0 : x > 1 ? 1 : x;
  return u * u * (3 - 2 * u);
}

/**
 * The intro camera at tick `t` (0..`INTRO.ticks`) for the view of `car`: from high over the start
 * gantry (looking back at the grid) round the right side of the field and down into `end` (the
 * view's chase camera, which it equals at the end). `cars`: the grid (its front, back and middle).
 * Pure; trig from the r3 tables.
 */
export function introCam(t: number, track: RallyTrack, cars: readonly RallyBody[], car: RallyBody, end: Cam3, out: Cam3, tmp: SplineSample): Cam3 {
  const L = track.length;
  const u = t <= 0 ? 0 : t >= INTRO.ticks ? 1 : t / INTRO.ticks;
  const e = smooth(u);
  // The grid: its front, back and middle (along and across the road), relative to this car.
  let lo = 0;
  let hi = 0;
  let side = 0;
  for (const c of cars) {
    const d = dsOf(car.s, c.s, L);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
    side += c.side;
  }
  side = cars.length > 0 ? side / cars.length : car.side;
  const chase = -CAM.dist;
  const along = hi + INTRO.ahead + (chase - hi - INTRO.ahead) * e;
  const arc = sinT(PI * e);
  const lat = side + INTRO.swing * arc;
  const sp = track.spline.sample(track.spline.wrap(car.s + along), tmp);
  const px = sp.p[0] + sp.r[0] * lat;
  const py = sp.p[1] + INTRO.height + (CAM.height - INTRO.height) * e + 4 * arc;
  const pz = sp.p[2] + sp.r[2] * lat;
  // The point looked at: the middle of the grid, then ahead of the car.
  const mid = (lo + hi) / 2;
  const ls = track.spline.sample(track.spline.wrap(car.s + mid + (12 - mid) * e * e), tmp);
  const lx = ls.p[0] + ls.r[0] * (side + (car.side - side) * e);
  const ly = ls.p[1] + 1;
  const lz = ls.p[2] + ls.r[2] * (side + (car.side - side) * e);
  const dx = lx - px;
  const dy = ly - py;
  const dz = lz - pz;
  const yaw = atan2T(dx, dz);
  const pitch = atan2T(dy, Math.sqrt(dx * dx + dz * dz));
  // The last stretch blends into the chase camera (no jump when the countdown starts).
  const w = smooth((u - (1 - INTRO.blend)) / INTRO.blend);
  out.pos[0] = px + (end.pos[0] - px) * w;
  out.pos[1] = py + (end.pos[1] - py) * w;
  out.pos[2] = pz + (end.pos[2] - pz) * w;
  out.yaw = wrapAngle(yaw + angleDiff(yaw, end.yaw) * w);
  out.pitch = pitch + (end.pitch - pitch) * w;
  out.roll = end.roll * w;
  out.fovY = end.fovY;
  out.near = end.near;
  out.far = end.far;
  return out;
}
