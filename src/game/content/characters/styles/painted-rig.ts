/**
 * Art-direction trial `painted` (painted.ts): the skeleton. A copy of the rig's style resolve and
 * pose solve (src/game/art/humanoid.ts `resolve`, `solve`, `weaponRig`, `offhandRig`, the build
 * table), so the painted HD drawer (painted-body.ts) gets the whole solved skeleton (gun
 * placement, hand shapes, foot angles, torso frame) exactly as the rig solves it, and the frame
 * geometry: where the 1× frame lies on the rig's working canvas, so a painted 2× / 4× frame has
 * the 1× frame's logical size, anchor and points (the frame contract, kit.ts).
 */
import type { Ramp } from '../../../../engine/pixel';
import type { Accessory, ArmPose, Build, HumanStyle, LegPose, Pose, RenderPart } from '../../../art/humanoid';
import { DEFAULT_POSE } from '../../../art/humanoid';
import { gunArt, type HandShape } from '../../../art/humanoid-gear';
import { R } from '../../../art/paint';

export type V = [number, number];
export const DEG = Math.PI / 180;

/** The rig's working canvas: the body-space origin (feet centre) on the 1× grid. */
export const OX = 56;
export const OY = 80;

export interface Dims {
  thigh: number;
  shin: number;
  ankle: number;
  thighW: readonly [number, number];
  shinW: readonly [number, number];
  torsoH: number;
  waistB: number;
  waistF: number;
  chestB: number;
  chestF: number;
  upper: number;
  fore: number;
  armW: readonly [number, number];
  foreW: readonly [number, number];
  shoulder: readonly [number, number];
  farDx: number;
}

/** The rig's builds (humanoid.ts BUILDS; the 1× frames come from the rig, so these must match). */
const BUILDS: Readonly<Record<Build, Dims>> = {
  slim: { thigh: 6, shin: 6, ankle: 3, thighW: [5, 4], shinW: [4, 4], torsoH: 9, waistB: 3, waistF: 2, chestB: 3, chestF: 3, upper: 6, fore: 6, armW: [3, 3], foreW: [3, 3], shoulder: [-1, 2], farDx: 2 },
  normal: { thigh: 6, shin: 6, ankle: 3, thighW: [6, 5], shinW: [5, 4], torsoH: 9, waistB: 3, waistF: 3, chestB: 4, chestF: 4, upper: 6, fore: 6, armW: [4, 4], foreW: [4, 3], shoulder: [-1, 2], farDx: 2 },
  heavy: { thigh: 6, shin: 6, ankle: 3, thighW: [7, 6], shinW: [6, 5], torsoH: 9, waistB: 4, waistF: 5, chestB: 5, chestF: 5, upper: 6, fore: 6, armW: [5, 5], foreW: [5, 4], shoulder: [-1, 2], farDx: 2 },
  stocky: { thigh: 5, shin: 5, ankle: 3, thighW: [6, 6], shinW: [6, 5], torsoH: 9, waistB: 4, waistF: 4, chestB: 5, chestF: 5, upper: 6, fore: 6, armW: [4, 4], foreW: [4, 4], shoulder: [-1, 2], farDx: 2 },
  lanky: { thigh: 7, shin: 6, ankle: 3, thighW: [5, 4], shinW: [4, 4], torsoH: 9, waistB: 3, waistF: 2, chestB: 3, chestF: 3, upper: 6, fore: 6, armW: [3, 3], foreW: [3, 3], shoulder: [-1, 2], farDx: 2 },
  brute: { thigh: 8, shin: 7, ankle: 3, thighW: [8, 7], shinW: [7, 6], torsoH: 12, waistB: 5, waistF: 6, chestB: 6, chestF: 7, upper: 7, fore: 7, armW: [6, 6], foreW: [6, 5], shoulder: [-1, 2], farDx: 3 },
};

export function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}

export function add(a: V, b: V, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

export function rotateAbout(p: V, c: V, deg: number): V {
  if (deg === 0) return p;
  const a = deg * DEG;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
}

function solveIK(s: V, t: V, a: number, b: number, bend: 'down' | 'up'): { el: V; wr: V } {
  let dx = t[0] - s[0];
  let dy = t[1] - s[1];
  const d0 = Math.hypot(dx, dy);
  if (d0 < 1e-6) {
    dx = 0;
    dy = 1;
  }
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, d0));
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const e1: V = [s[0] + a * (ux * c - uy * sn), s[1] + a * (ux * sn + uy * c)];
  const e2: V = [s[0] + a * (ux * c + uy * sn), s[1] + a * (-ux * sn + uy * c)];
  const score = (e: V): number => e[1] * 2 - e[0];
  let el = score(e1) >= score(e2) ? e1 : e2;
  if (bend === 'up') el = el === e1 ? e2 : e1;
  return { el, wr: [s[0] + ux * d, s[1] + uy * d] };
}

const BOOT: readonly V[] = [[-2, -2], [1, -2], [2, -1], [3, 0], [4, 1], [4, 2], [-2, 2]];
const CROUCH_N: LegPose = { hip: 104, knee: 118 };
const CROUCH_F: LegPose = { hip: 44, knee: 160 };
const CROUCH_SCALE = 0.55;

export interface Resolved {
  skin: Ramp;
  hair: Ramp;
  gear: Ramp;
  accent: Ramp;
  top: Ramp;
  shirt: Ramp;
  pants: Ramp;
  boots: Ramp;
  gloves: Ramp;
  belt: Ramp;
  sleeveUpper: Ramp;
  sleeveFore: Ramp;
  dims: Dims;
  acc: ReadonlySet<Accessory>;
  s: HumanStyle;
}

const resolved = new WeakMap<HumanStyle, Resolved>();

export function resolveStyle(s: HumanStyle): Resolved {
  const hit = resolved.get(s);
  if (hit) return hit;
  const skin = R(s.skin);
  const top = R(s.top);
  const shirt = R(s.shirt ?? 'sand');
  let sleeveUpper = top;
  let sleeveFore = top;
  if (s.topType === 'vest') {
    sleeveUpper = shirt;
    sleeveFore = skin;
  } else if (s.topType === 'tee' || s.topType === 'polo') {
    sleeveFore = skin;
  } else if (s.topType === 'tank') {
    sleeveUpper = skin;
    sleeveFore = skin;
  }
  const r: Resolved = {
    skin,
    hair: R(s.hair),
    gear: R(s.gear ?? 'olive'),
    accent: R(s.accent ?? 'red'),
    top,
    shirt,
    pants: R(s.pants),
    boots: R(s.boots),
    gloves: s.gloves === null || s.gloves === undefined ? skin : R(s.gloves),
    belt: R(s.belt ?? 'brown'),
    sleeveUpper,
    sleeveFore,
    dims: BUILDS[s.build ?? 'normal'],
    acc: new Set(s.accessories ?? []),
    s,
  };
  resolved.set(s, r);
  return r;
}

export interface GunPlacement {
  kind: 'pistol' | 'heavy' | 'rifle';
  angle: number;
  grip: V;
}

export interface Skeleton {
  pelvis: V;
  neck: V;
  f: V;
  u: V;
  hipN: V;
  kneeN: V;
  ankleN: V;
  footN: number;
  hipF: V;
  kneeF: V;
  ankleF: V;
  footF: number;
  shN: V;
  elN: V;
  wrN: V;
  shF: V;
  elF: V;
  wrF: V;
  handN: HandShape;
  handF: HandShape;
  gun: GunPlacement | null;
  offGun: GunPlacement | null;
}

function blendLeg(l: LegPose, c: LegPose, t: number): LegPose {
  if (t <= 0) return l;
  const k = Math.min(1, t);
  return { hip: l.hip + (c.hip - l.hip) * k, knee: l.knee + (c.knee - l.knee) * k, foot: (l.foot ?? 0) + ((c.foot ?? 0) - (l.foot ?? 0)) * k };
}

function bootBottom(ankle: V, foot: number): number {
  let m = -Infinity;
  for (const p of BOOT) m = Math.max(m, rotateAbout([ankle[0] + p[0], ankle[1] + p[1]], ankle, -foot)[1]);
  return m;
}

/** The rig's solve (humanoid.ts `solve`): d1 1 = the 1× solve, 2 / 4 = the unrounded HD ground contact. */
export function solveSkeleton(st: Resolved, pose: Pose, d1 = 1): Skeleton {
  const d = st.dims;
  const crouch = pose.crouch ?? 0;
  const legN = blendLeg(pose.legN ?? DEFAULT_POSE.legN, CROUCH_N, crouch);
  const legF = blendLeg(pose.legF ?? DEFAULT_POSE.legF, CROUCH_F, crouch);
  const pelvis0: V = [0, -(d.thigh + d.shin + d.ankle)];
  const ls = pose.legScale ?? 1 + (CROUCH_SCALE - 1) * Math.min(1, crouch);
  const leg = (hip: V, l: LegPose): { knee: V; ankle: V } => {
    const knee = add(hip, dirOf(l.hip), d.thigh * ls);
    return { knee, ankle: add(knee, dirOf(l.hip - l.knee), d.shin * ls) };
  };
  const hipF0: V = [pelvis0[0] - d.farDx, pelvis0[1]];
  const ln = leg(pelvis0, legN);
  const lf = leg(hipF0, legF);
  let sy = 0;
  if (pose.grounded !== false) {
    const knee = (k: V): number => k[1] + Math.floor(d.thighW[1] / 2);
    const bottom = Math.max(bootBottom(ln.ankle, legN.foot ?? 0), bootBottom(lf.ankle, legF.foot ?? 0), knee(ln.knee), knee(lf.knee));
    sy = d1 === 1 ? -2 - Math.round(bottom) : -2 - bottom;
  }
  const S = (p: V): V => [p[0], p[1] + sy];
  const bob = d1 === 1 ? Math.round(pose.bob ?? 0) : Math.round((pose.bob ?? 0) * d1) / d1;
  const B = (p: V): V => [p[0], p[1] + sy + bob];
  const pelvis = B(pelvis0);
  const lean = pose.lean ?? 0;
  const u: V = [Math.sin(lean * DEG), -Math.cos(lean * DEG)];
  const f: V = [Math.cos(lean * DEG), Math.sin(lean * DEG)];
  const neck = add(pelvis, u, d.torsoH - (pose.hunch ?? 0));
  const shoulderAt = (dx: number): V => add(add(neck, f, d.shoulder[0] + dx), u, -d.shoulder[1]);
  const sk: Skeleton = {
    pelvis,
    neck,
    f,
    u,
    hipN: pelvis,
    kneeN: S(ln.knee),
    ankleN: S(ln.ankle),
    footN: legN.foot ?? 0,
    hipF: B(hipF0),
    kneeF: S(lf.knee),
    ankleF: S(lf.ankle),
    footF: legF.foot ?? 0,
    shN: shoulderAt(0),
    elN: [0, 0],
    wrN: [0, 0],
    shF: shoulderAt(d.farDx),
    elF: [0, 0],
    wrF: [0, 0],
    handN: 'fist',
    handF: 'fist',
    gun: null,
    offGun: null,
  };
  const wr = weaponRig(pose, sk);
  sk.gun = wr.gun;
  const off = offhandRig(pose, sk, wr.gun);
  sk.offGun = off?.gun ?? null;
  const armN = pose.armN ?? wr.armN ?? DEFAULT_POSE.armN;
  const armF = pose.armF ?? off?.armF ?? wr.armF ?? DEFAULT_POSE.armF;
  const n = armChain(sk.shN, armN, d);
  const fa = armChain(sk.shF, armF, d);
  sk.elN = n.el;
  sk.wrN = n.wr;
  sk.elF = fa.el;
  sk.wrF = fa.wr;
  sk.handN = armN.hand ?? 'fist';
  sk.handF = armF.hand ?? 'fist';
  if (sk.gun && pose.gunHand === 'far' && !pose.armF) sk.gun.grip = [sk.wrF[0], sk.wrF[1]];
  else if (sk.gun && pose.gunHand !== 'far' && !pose.armN) sk.gun.grip = [sk.wrN[0], sk.wrN[1]];
  if (sk.offGun && !pose.armF) sk.offGun.grip = [sk.wrF[0], sk.wrF[1]];
  return sk;
}

function offhandRig(pose: Pose, sk: Skeleton, gun: GunPlacement | null): { gun: GunPlacement; armF: ArmPose } | null {
  if (pose.offhand !== 'pistol' || !gun || gun.kind !== 'pistol' || pose.gunHand === 'far') return null;
  const F = sk.shF;
  const g = gun.grip;
  const aim = pose.aim ?? 'fwd';
  const at2: V = aim === 'up' ? [g[0] + 2, g[1] + 2] : aim === 'diag-up' ? [g[0] + 1, g[1] + 4] : aim === 'down' ? [g[0] + 5, g[1] - 2] : [g[0] - 2, g[1] + 4];
  return { gun: { kind: 'pistol', angle: gun.angle, grip: at2 }, armF: { to: [at2[0] - F[0], at2[1] - F[1]], hand: 'grip' } };
}

function armChain(s: V, a: ArmPose, d: Dims): { el: V; wr: V } {
  if (a.to) return solveIK(s, [s[0] + a.to[0], s[1] + a.to[1]], d.upper, d.fore, a.bend ?? 'down');
  const shA = a.sh ?? 5;
  const el = add(s, dirOf(shA), d.upper);
  return { el, wr: add(el, dirOf(shA + (a.el ?? 20)), d.fore) };
}

function weaponRig(pose: Pose, sk: Skeleton): { gun: GunPlacement | null; armN?: ArmPose; armF?: ArmPose } {
  const w = pose.weapon ?? 'none';
  const aim = pose.aim ?? 'fwd';
  const rc = pose.recoil ?? 0;
  const P = sk.pelvis;
  const S = sk.shN;
  const F = sk.shF;
  const toN = (g: V): ArmPose => ({ to: [g[0] - S[0], g[1] - S[1]], hand: 'grip' });
  const toF = (g: V, bend: 'down' | 'up' = 'down'): ArmPose => ({ to: [g[0] - F[0], g[1] - F[1]], hand: 'grip', bend });
  if (w !== 'none' && pose.gunHand === 'far') {
    const g: V = [P[0] + 2, P[1] - 2];
    return { gun: { kind: w, angle: pose.gunAngle ?? 25, grip: g }, armF: toF(g) };
  }
  if (w === 'pistol') {
    if (aim === 'up') {
      const g: V = [P[0] + 9, P[1] - 15 + rc];
      return { gun: { kind: 'pistol', angle: -90, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + 2]) };
    }
    if (aim === 'diag-up') {
      const k = Math.SQRT1_2;
      const g: V = [S[0] + 10 - Math.round(rc * k), S[1] + Math.round(rc * k)];
      return { gun: { kind: 'pistol', angle: -45, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + 2]) };
    }
    if (aim === 'down') {
      const g: V = [S[0] + 2, S[1] + 10 - rc];
      return { gun: { kind: 'pistol', angle: 90, grip: g }, armN: toN(g), armF: { sh: -20, el: 60, hand: 'fist' } };
    }
    const g: V = [S[0] + 9 - rc, S[1] + 3];
    return { gun: { kind: 'pistol', angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: { sh: 20, el: 100, hand: 'fist' } };
  }
  if (w === 'heavy') {
    const art = gunArt('heavy');
    const span = art.grip2[0] - art.grip[0];
    if (aim === 'up') {
      const g: V = [P[0] + 9, P[1] - 10 + rc];
      return { gun: { kind: 'heavy', angle: -90, grip: g }, armN: toN(g), armF: toF([g[0] + 1, g[1] - span + 3]) };
    }
    if (aim === 'down') {
      const g: V = [P[0] + 5, P[1] - 5 - rc];
      return { gun: { kind: 'heavy', angle: 90, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + span - 2]) };
    }
    if (aim === 'diag-up' || aim === 'diag-down') {
      const up = aim === 'diag-up';
      const ang = up ? -45 : 45;
      const k = Math.SQRT1_2;
      const g: V = up ? [P[0] + 6 - rc * k, P[1] - 8 + rc * k] : [P[0] + 4 - rc * k, P[1] - 4 - rc * k];
      const fore: V = [g[0] + (span - 1) * k, g[1] + (up ? -1 : 1) * (span - 1) * k];
      return { gun: { kind: 'heavy', angle: ang, grip: g }, armN: toN(g), armF: toF(fore) };
    }
    const g: V = [P[0] + 3 - rc, P[1] - 4];
    return { gun: { kind: 'heavy', angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: toF([g[0] + span, g[1]]) };
  }
  if (w === 'rifle') {
    const art = gunArt('rifle');
    const span = art.grip2[0] - art.grip[0];
    if (aim === 'up') {
      const g: V = [S[0] + 3, S[1] - 1 + rc];
      return { gun: { kind: 'rifle', angle: -90, grip: g }, armN: toN(g), armF: toF([g[0] + 1, g[1] - span]) };
    }
    if (pose.lowGun) {
      const g: V = [P[0] + 2 - rc, P[1] - 3];
      return { gun: { kind: 'rifle', angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: toF([g[0] + span - 1, g[1] - 1]) };
    }
    const g: V = [S[0] + 3 - rc, S[1] + 2];
    return { gun: { kind: 'rifle', angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: toF([g[0] + span - 1, g[1] - 1]) };
  }
  return { gun: null };
}

/** Where a 1× frame lies: its top-left on the rig's full working canvas (1× px) and its size. */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The 1× frame's rectangle on the rig's working canvas, from the 1× frame itself (its size,
 * anchor and `hip` point) and the 1× solve: the anchor is the pelvis pixel ('upper') or the
 * pelvis pixel less the `hip` point ('full' / 'lower', which also covers the re-grounded lying
 * poses). This is the rectangle the rig's own HD render covers (humanoid.ts `renderHuman`).
 */
export function frameRect(st: Resolved, pose: Pose, part: RenderPart, f1: { buf: { w: number; h: number }; ox: number; oy: number; pts?: Readonly<Record<string, readonly [number, number]>> }): FrameRect {
  const sk = solveSkeleton(st, pose, 1);
  const pel: V = [Math.round(sk.pelvis[0] + (pose.dx ?? 0) + OX), Math.round(sk.pelvis[1] + (pose.dy ?? 0) + OY)];
  const hip = part === 'upper' ? [0, 0] : (f1.pts?.hip ?? [0, 0]);
  const ax = pel[0] - hip[0];
  const ay = pel[1] - hip[1];
  return { x: ax - f1.ox, y: ay - f1.oy, w: f1.buf.w, h: f1.buf.h };
}
