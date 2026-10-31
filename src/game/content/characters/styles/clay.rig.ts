/**
 * Art-direction trial `clay` (clay.ts): the skeleton. A copy of the rig's solve
 * (src/game/art/humanoid.ts `resolve`, `solve`, `weaponRig`, `offhandRig`, `armChain`, `solveIK`,
 * `placedGun`) so the clay figure stands, aims and fires from exactly the joints, hip and muzzle
 * of the game's VINCENT; only the volumes drawn on it change (clay.body.ts, clay.head.ts).
 *
 * Body space: origin at the feet centre on the ground line, x forward, y down (as the rig).
 */

import type { ArmPose, Build, HandShape, HumanStyle, LegPose, Pose } from '../../../art/humanoid';
import { gunArt } from '../../../art/humanoid-gear';

export type V = [number, number];
export const DEG = Math.PI / 180;

/** Bone lengths of the rig (humanoid.ts BUILDS): the clay volumes hang on these. */
export interface Bones {
  thigh: number;
  shin: number;
  ankle: number;
  torsoH: number;
  upper: number;
  fore: number;
  shoulder: readonly [number, number];
  farDx: number;
  /** The rig's thigh width at the knee (a kneeling knee's ground contact). */
  kneeW: number;
}

const BONES: Readonly<Record<Build, Bones>> = {
  slim: { thigh: 6, shin: 6, ankle: 3, torsoH: 9, upper: 6, fore: 6, shoulder: [-1, 2], farDx: 2, kneeW: 4 },
  normal: { thigh: 6, shin: 6, ankle: 3, torsoH: 9, upper: 6, fore: 6, shoulder: [-1, 2], farDx: 2, kneeW: 5 },
  heavy: { thigh: 6, shin: 6, ankle: 3, torsoH: 9, upper: 6, fore: 6, shoulder: [-1, 2], farDx: 2, kneeW: 6 },
  stocky: { thigh: 5, shin: 5, ankle: 3, torsoH: 9, upper: 6, fore: 6, shoulder: [-1, 2], farDx: 2, kneeW: 6 },
  lanky: { thigh: 7, shin: 6, ankle: 3, torsoH: 9, upper: 6, fore: 6, shoulder: [-1, 2], farDx: 2, kneeW: 4 },
  brute: { thigh: 8, shin: 7, ankle: 3, torsoH: 12, upper: 7, fore: 7, shoulder: [-1, 2], farDx: 3, kneeW: 7 },
};

export function bonesOf(s: HumanStyle): Bones {
  return BONES[s.build ?? 'normal'];
}

export const DEFAULT_LEG_N: LegPose = { hip: 20, knee: 14 };
export const DEFAULT_LEG_F: LegPose = { hip: -16, knee: 10 };
const DEFAULT_ARM_N: ArmPose = { sh: 8, el: 30, hand: 'fist' };
const DEFAULT_ARM_F: ArmPose = { sh: -6, el: 26, hand: 'fist' };
const CROUCH_N: LegPose = { hip: 104, knee: 118 };
const CROUCH_F: LegPose = { hip: 44, knee: 160 };
const CROUCH_SCALE = 0.55;

/** The rig's boot outline relative to the ankle (its ground contact). */
const BOOT: readonly V[] = [[-2, -2], [1, -2], [2, -1], [3, 0], [4, 1], [4, 2], [-2, 2]];

export interface GunPlacement {
  kind: 'pistol' | 'heavy' | 'rifle';
  /** Degrees: 0 forward, −90 up, 90 down. */
  angle: number;
  /** Body-space grip point. */
  grip: V;
}

export interface Skeleton {
  pelvis: V;
  neck: V;
  /** Torso frame: forward and up unit vectors (after lean). */
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
  /** Torso height after hunch. */
  H: number;
}

export function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}

export function add(a: V, b: V, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

export function angleTo(a: V, b: V): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
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

function armChain(s: V, a: ArmPose, b: Bones): { el: V; wr: V } {
  if (a.to) return solveIK(s, [s[0] + a.to[0], s[1] + a.to[1]], b.upper, b.fore, a.bend ?? 'down');
  const shA = a.sh ?? 5;
  const el = add(s, dirOf(shA), b.upper);
  return { el, wr: add(el, dirOf(shA + (a.el ?? 20)), b.fore) };
}

/**
 * The rig's solve. `d1` 1: the ground contact and the bob in whole px; 2 / 4: the lowest sole
 * exactly on the ground line (the HD frames).
 */
export function solve(style: HumanStyle, pose: Pose, d1 = 1): Skeleton {
  const d = bonesOf(style);
  const crouch = pose.crouch ?? 0;
  const legN = blendLeg(pose.legN ?? DEFAULT_LEG_N, CROUCH_N, crouch);
  const legF = blendLeg(pose.legF ?? DEFAULT_LEG_F, CROUCH_F, crouch);
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
    const knee = (k: V): number => k[1] + Math.floor(d.kneeW / 2);
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
  const H = d.torsoH - (pose.hunch ?? 0);
  const neck = add(pelvis, u, H);
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
    H,
  };
  const wr = weaponRig(pose, sk);
  sk.gun = wr.gun;
  const off = offhandRig(pose, sk, wr.gun);
  sk.offGun = off?.gun ?? null;
  const armN = pose.armN ?? wr.armN ?? DEFAULT_ARM_N;
  const armF = pose.armF ?? off?.armF ?? wr.armF ?? DEFAULT_ARM_F;
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
  const off: GunPlacement = { kind: 'pistol', angle: gun.angle, grip: at2 };
  return { gun: off, armF: { to: [at2[0] - F[0], at2[1] - F[1]], hand: 'grip' } };
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

/** The 1× gun's grip and muzzle px after its turn (humanoid.ts `placedGun`): the muzzle point. */
export function placedGunPts(g: GunPlacement, rot: number): { grip: V; muzzle: V } {
  const art = gunArt(g.kind);
  const a = g.angle + rot;
  const q = Math.round(a / 90);
  if (Math.abs(a - q * 90) < 1e-6) {
    const turns = ((q % 4) + 4) % 4;
    let w = art.buf.w;
    let h = art.buf.h;
    let grip: V = [art.grip[0], art.grip[1]];
    let muz: V = [art.muzzle[0], art.muzzle[1]];
    for (let i = 0; i < turns; i++) {
      grip = [h - 1 - grip[1], grip[0]];
      muz = [h - 1 - muz[1], muz[0]];
      const t = w;
      w = h;
      h = t;
    }
    return { grip, muzzle: muz };
  }
  // The size of `art.buf.rotated(a)` (PixelBuffer.rotated), without rotating the pixels.
  const { w, h } = art.buf;
  const cs = Math.cos(a * DEG);
  const sn = Math.sin(a * DEG);
  let bw = Math.ceil(Math.abs(w * cs) + Math.abs(h * sn) - 1e-9);
  let bh = Math.ceil(Math.abs(w * sn) + Math.abs(h * cs) - 1e-9);
  while ((bw - w) % 2 !== 0) bw++;
  while ((bh - h) % 2 !== 0) bh++;
  const c0: V = [w / 2, h / 2];
  const map = (p: readonly [number, number]): V => {
    const r = rotateAbout([p[0] + 0.5, p[1] + 0.5], c0, a);
    return [r[0] - c0[0] + bw / 2 - 0.5, r[1] - c0[1] + bh / 2 - 0.5];
  };
  return { grip: map(art.grip), muzzle: map(art.muzzle) };
}
