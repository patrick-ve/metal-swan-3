/**
 * Style `gritty` (gritty.ts): the skeleton. A copy of the rig's solve (src/game/art/humanoid.ts
 * `solve` / `weaponRig`) with GRITTY's own proportions: a taller, leaner man of about 6½ heads
 * (legs 22 px to the hip, a 13.5 px torso, a small head), the guns held with weight (the pistol in
 * two hands, the heavy gun low at the hip). The pose tables are the rig's own: angles are used as
 * they are, lengths in rig px (IK targets, offsets, bob, hunch) are scaled to these bones.
 *
 * Body space: origin at the feet centre on the ground line, x forward, y down (logical px,
 * floats). `rot` / `dx` / `dy` are applied by the painter (gritty-paint.ts), as in the rig.
 */
import type { ArmPose, HandShape, LegPose, Pose } from '../../../art/humanoid';
import { gunArt } from '../../../art/humanoid-gear';
import { HEAVY_K } from './gritty-gun';

export type V = [number, number];
const DEG = Math.PI / 180;

/** Bone lengths and radii (logical px). */
export const DIMS = {
  thigh: 9.5,
  shin: 8.5,
  /** Ankle height above the sole's bottom. */
  ankle: 3,
  /** Leg radii: hip, knee, ankle (fatigues: a little loose). */
  legR: [2.35, 1.7, 1.45] as const,
  torsoH: 14,
  /** Torso half depths (side view): back and front at the waist and at the chest. */
  waistB: 2.5,
  waistF: 2.3,
  chestB: 2.9,
  chestF: 3.0,
  upper: 7.6,
  fore: 7.0,
  /** Arm radii: shoulder, elbow, wrist (tweed sleeves). */
  armR: [1.55, 1.3, 1.1] as const,
  /** Shoulder joint from the neck base: [forward, down]. */
  shoulder: [-0.7, 2.4] as const,
  /** Forward offset of the far shoulder / hip (depth cue). */
  farDx: 1.4,
};

/** Rig px → these bones: arm reach, torso, legs, whole-figure offsets, head offsets. */
export const K = {
  arm: (DIMS.upper + DIMS.fore) / 12,
  torso: DIMS.torsoH / 9,
  body: 1.2,
  head: 0.7,
};

/** Rig crouch target legs (humanoid.ts CROUCH_N / CROUCH_F / CROUCH_SCALE). */
const CROUCH_N: LegPose = { hip: 104, knee: 118 };
const CROUCH_F: LegPose = { hip: 44, knee: 160 };
const CROUCH_SCALE = 0.55;
/** Leg spread factor on the rig's hip angles. */
const LEG_SPREAD = 0.8;

const DEFAULT_LEG_N: LegPose = { hip: 20, knee: 14 };
const DEFAULT_LEG_F: LegPose = { hip: -16, knee: 10 };
const DEFAULT_ARM_N: ArmPose = { sh: 8, el: 30, hand: 'fist' };
const DEFAULT_ARM_F: ArmPose = { sh: -6, el: 26, hand: 'fist' };

/**
 * The boot outline about the ankle (x forward, y down): a lean field boot, heel to toe 6.4 px,
 * the sole's bottom at +3 (the ankle height).
 */
export const BOOT: readonly V[] = [
  [-1.55, -2.6],
  [1.15, -2.6],
  [1.5, -1.2],
  [2.9, -0.55],
  [4.25, 0.25],
  [4.85, 1.15],
  [4.9, 2.2],
  [4.7, 3.0],
  [-1.6, 3.0],
  [-1.85, 1.6],
];

/** An arm pose; `raw`: the IK target is in GRITTY px already (the weapon holds). */
type GArm = ArmPose & { raw?: boolean };

export interface GunPl {
  kind: 'pistol' | 'heavy' | 'rifle';
  /** Degrees: 0 forward, −90 up, 90 down. */
  angle: number;
  /** Body-space position of the gun's grip point (the centre of its grip px). */
  grip: V;
}

export interface Skel {
  pelvis: V;
  neck: V;
  /** Torso frame: forward and up unit vectors (after lean). */
  f: V;
  u: V;
  /** Torso height after hunch. */
  H: number;
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
  gun: GunPl | null;
  offGun: GunPl | null;
}

function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}

function add(a: V, b: V, k = 1): V {
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

/** Two-bone IK (humanoid.ts solveIK). */
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

/** Lowest point of the boot at `ankle` turned by `foot` degrees (toe up +). */
export function bootBottom(ankle: V, foot: number): number {
  let m = -Infinity;
  for (const p of BOOT) m = Math.max(m, rotateAbout([ankle[0] + p[0], ankle[1] + p[1]], ankle, -foot)[1]);
  return m;
}

/**
 * A rig IK target (rig px from the shoulder) in these bones: below the shoulder it scales with the
 * arm; above it the rig's big head is much higher than GRITTY's small one, so a hand to the brow,
 * the chin or the tie stays at the face (y compressed, x a little).
 */
function mapTo(t: readonly [number, number]): V {
  const y = t[1] < 0 ? t[1] * 0.72 : t[1] * K.arm;
  const x = t[0] * K.arm * (t[1] < -3 ? 0.82 : 1);
  return [x, y];
}

function armChain(s: V, a: GArm): { el: V; wr: V } {
  if (a.to) {
    const m = a.raw ? [a.to[0], a.to[1]] : mapTo(a.to);
    return solveIK(s, [s[0] + m[0], s[1] + m[1]], DIMS.upper, DIMS.fore, a.bend ?? 'down');
  }
  const shA = a.sh ?? 5;
  const el = add(s, dirOf(shA), DIMS.upper);
  return { el, wr: add(el, dirOf(shA + (a.el ?? 20)), DIMS.fore) };
}

/**
 * Solve the skeleton. `sole`: where the lowest sole's bottom rests (y, e.g. −1 at 1× so the 1 px
 * outline sits on the ground line; −0.5 at 2× / 4×).
 */
export function solve(pose: Pose, sole: number): Skel {
  const D = DIMS;
  const crouch = pose.crouch ?? 0;
  // A tall man's stance: the rig's leg spread a little narrower (the long legs would straddle).
  const narrow = (l: LegPose): LegPose => {
    const a = Math.abs(l.hip);
    const k = a <= 40 ? LEG_SPREAD : a >= 75 ? 1 : LEG_SPREAD + ((1 - LEG_SPREAD) * (a - 40)) / 35;
    return { ...l, hip: l.hip * k };
  };
  const legN = blendLeg(narrow(pose.legN ?? DEFAULT_LEG_N), CROUCH_N, crouch);
  const legF = blendLeg(narrow(pose.legF ?? DEFAULT_LEG_F), CROUCH_F, crouch);
  const pelvis0: V = [0, -(D.thigh + D.shin + D.ankle)];
  const ls = pose.legScale ?? 1 + (CROUCH_SCALE - 1) * Math.min(1, crouch);
  const leg = (hip: V, l: LegPose): { knee: V; ankle: V } => {
    const knee = add(hip, dirOf(l.hip), D.thigh * ls);
    return { knee, ankle: add(knee, dirOf(l.hip - l.knee), D.shin * ls) };
  };
  const hipF0: V = [pelvis0[0] - D.farDx, pelvis0[1]];
  const ln = leg(pelvis0, legN);
  const lf = leg(hipF0, legF);

  let sy = sole;
  if (pose.grounded !== false) {
    const knee = (k: V): number => k[1] + D.legR[1];
    const bottom = Math.max(bootBottom(ln.ankle, legN.foot ?? 0), bootBottom(lf.ankle, legF.foot ?? 0), knee(ln.knee), knee(lf.knee));
    sy = sole - bottom;
  }
  const S = (p: V): V => [p[0], p[1] + sy];
  const bob = (pose.bob ?? 0) * 1.3;
  const B = (p: V): V => [p[0], p[1] + sy + bob];
  const pelvis = B(pelvis0);

  let lean = pose.lean ?? 0;
  // The heavy gun's weight: the shoulders sit back over the hips.
  if (pose.weapon === 'heavy' && pose.gunHand !== 'far') lean -= 3;
  const u: V = [Math.sin(lean * DEG), -Math.cos(lean * DEG)];
  const f: V = [Math.cos(lean * DEG), Math.sin(lean * DEG)];
  const H = D.torsoH - (pose.hunch ?? 0) * K.torso;
  const neck = add(pelvis, u, H);
  const shoulderAt = (dx: number): V => add(add(neck, f, D.shoulder[0] + dx), u, -D.shoulder[1]);

  const sk: Skel = {
    pelvis,
    neck,
    f,
    u,
    H,
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
    shF: shoulderAt(D.farDx),
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
  const armN = pose.armN ?? wr.armN ?? DEFAULT_ARM_N;
  const armF = pose.armF ?? off?.armF ?? wr.armF ?? DEFAULT_ARM_F;
  const n = armChain(sk.shN, armN);
  const fa = armChain(sk.shF, armF);
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

function offhandRig(pose: Pose, sk: Skel, gun: GunPl | null): { gun: GunPl; armF: GArm } | null {
  if (pose.offhand !== 'pistol' || !gun || gun.kind !== 'pistol' || pose.gunHand === 'far') return null;
  const F = sk.shF;
  const g = gun.grip;
  const aim = pose.aim ?? 'fwd';
  const at2: V = aim === 'up' ? [g[0] + 2.5, g[1] + 2.5] : aim === 'diag-up' ? [g[0] + 1.2, g[1] + 5] : aim === 'down' ? [g[0] + 6, g[1] - 2.5] : [g[0] - 2.5, g[1] + 5];
  return { gun: { kind: 'pistol', angle: gun.angle, grip: at2 }, armF: ik(F, at2) };
}

/** An IK arm pose to a body-space target (GRITTY px, used as it is). */
function ik(sh: V, g: V, hand: HandShape = 'grip', bend: 'down' | 'up' = 'down'): GArm {
  return { to: [g[0] - sh[0], g[1] - sh[1]], hand, bend, raw: true };
}

/** Hand targets and the gun placement for a weapon pose: pistol in two hands, heavy low at the hip. */
function weaponRig(pose: Pose, sk: Skel): { gun: GunPl | null; armN?: GArm; armF?: GArm } {
  const w = pose.weapon ?? 'none';
  const aim = pose.aim ?? 'fwd';
  const rc = pose.recoil ?? 0;
  const P = sk.pelvis;
  const S = sk.shN;
  const F = sk.shF;
  const N = sk.neck;
  const k = Math.SQRT1_2;
  if (w !== 'none' && pose.gunHand === 'far') {
    // Carried low in the far hand (the near arm throws or stabs).
    const g: V = [P[0] + 2.5, P[1] - 2.5];
    return { gun: { kind: w, angle: pose.gunAngle ?? 25, grip: g }, armF: ik(F, g) };
  }
  if (w === 'pistol') {
    if (aim === 'up') {
      // Both hands, the gun upright in front of the face and clear of it, the barrel above the brow.
      const g: V = [N[0] + 7.0, N[1] - 2.0 + rc];
      return { gun: { kind: 'pistol', angle: -90, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] - 0.6, g[1] + 1.4], 'grip') };
    }
    if (aim === 'diag-up') {
      const g: V = [S[0] + 9.6 - rc * k, S[1] - 4.4 + rc * k];
      return { gun: { kind: 'pistol', angle: -45, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] - 0.9, g[1] + 1.2]) };
    }
    if (aim === 'down') {
      const g: V = [S[0] + 2.4, S[1] + 12.6 - rc];
      return { gun: { kind: 'pistol', angle: 90, grip: g }, armN: ik(S, g), armF: { sh: -18, el: 62, hand: 'fist' } };
    }
    // Forward: arms out, the support hand cupped under the grip (a two-handed stance).
    const ang = pose.gunAngle ?? 0;
    const g: V = ang > 20 ? [S[0] + 10.5 - rc, S[1] + 3.8] : [S[0] + 12.4 - rc, S[1] + 1.4];
    return { gun: { kind: 'pistol', angle: ang, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] - 0.55, g[1] + 0.95]) };
  }
  if (w === 'heavy') {
    // GRITTY's own heavy gun (gritty-gun.ts): the fore-grip 7 px ahead, scaled with the gun.
    const span = 7 * HEAVY_K;
    if (aim === 'up') {
      const g: V = [P[0] + 7.4, P[1] - 14.5 + rc];
      return { gun: { kind: 'heavy', angle: -90, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] + 0.4, g[1] - span + 2]) };
    }
    if (aim === 'down') {
      const g: V = [P[0] + 6.2, P[1] - 6.5 - rc];
      return { gun: { kind: 'heavy', angle: 90, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] - 0.6, g[1] + span - 2]) };
    }
    if (aim === 'diag-up' || aim === 'diag-down') {
      const up = aim === 'diag-up';
      const g: V = up ? [P[0] + 6.4 - rc * k, P[1] - 10.5 + rc * k] : [P[0] + 5.2 - rc * k, P[1] - 6.2 - rc * k];
      const fore: V = [g[0] + (span - 1) * k, g[1] + (up ? -1 : 1) * (span - 1) * k];
      return { gun: { kind: 'heavy', angle: up ? -45 : 45, grip: g }, armN: ik(S, g), armF: ik(F, fore) };
    }
    // Low at the hip, the weight on the forearm: the far hand on the fore-grip.
    const g: V = [P[0] + 4.6 - rc, P[1] - 6.2];
    return { gun: { kind: 'heavy', angle: pose.gunAngle ?? 0, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] + span, g[1]]) };
  }
  if (w === 'rifle') {
    const art = gunArt('rifle');
    const span = art.grip2[0] - art.grip[0];
    if (aim === 'up') {
      const g: V = [S[0] + 3.6, S[1] - 1.2 + rc];
      return { gun: { kind: 'rifle', angle: -90, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] + 1, g[1] - span]) };
    }
    if (pose.lowGun) {
      const g: V = [P[0] + 2.5 - rc, P[1] - 4];
      return { gun: { kind: 'rifle', angle: pose.gunAngle ?? 0, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] + span - 1, g[1] - 1]) };
    }
    const g: V = [S[0] + 4 - rc, S[1] + 2.4];
    return { gun: { kind: 'rifle', angle: pose.gunAngle ?? 0, grip: g }, armN: ik(S, g), armF: ik(F, [g[0] + span - 1, g[1] - 1]) };
  }
  return { gun: null };
}
