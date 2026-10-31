/**
 * Art-direction trial `chibi` (chibi.ts): the chibi skeleton. A copy of the rig's solve
 * (src/game/art/humanoid.ts `solve`, `armChain`, `solveIK`, `weaponRig`) with super-deformed
 * proportions: short stubby legs and arms, a small body, and the gun grips moved to where the
 * short arms can hold a real-size gun. Every Pose field the player contract uses is honoured
 * (legs, crouch, legScale, grounded, bob, lean, hunch, arms (FK and IK), head offsets, aims,
 * recoil, gunHand, rot, dx, dy).
 *
 * Body space: origin at the feet centre on the ground line, x forward, y down (logical px).
 */
import type { ArmPose, LegPose, Pose } from '../../../art/humanoid';
import type { HandShape } from '../../../art/humanoid-gear';

export type V = [number, number];
const DEG = Math.PI / 180;

/** The chibi body (logical px). The head is drawn by chibi-head.ts on top of the neck. */
export const CHIBI = {
  thigh: 3.7,
  shin: 3.4,
  /** Ankle height over the boot's sole line (the boot hangs below it: chibi-body.ts BOOT). */
  ankle: 1.6,
  /** Sole bottom below the ankle (BOOT: centre 1.25 + radius 2.05). */
  sole: 3.3,
  torsoH: 8.4,
  /** Shoulder joint from the neck base: forward, down. */
  shoulder: [-0.5, 1.7] as const,
  farDx: 1.6,
  upper: 3.3,
  fore: 3.1,
  /** Head centre from the neck base: forward, up. */
  headUp: 8.3,
  headFwd: 0.7,
} as const;

/** The rig's slim leg length (thigh + shin + ankle): pose offsets were keyed for it. */
const RIG_LEG = 15;
/** Scale of the poses' whole-figure offsets (dx, dy) to the chibi's short legs. */
export const OFFSET_K = (CHIBI.thigh + CHIBI.shin + CHIBI.ankle + 1.5) / RIG_LEG;
/** Arm IK targets were keyed for the rig's 12 px arm: scaled to the chibi arm. */
const ARM_K = (CHIBI.upper + CHIBI.fore) / 12;

const CROUCH_N: LegPose = { hip: 104, knee: 118 };
const CROUCH_F: LegPose = { hip: 44, knee: 160 };
const CROUCH_SCALE = 0.62;

const DEFAULT = {
  legN: { hip: 20, knee: 14 } as LegPose,
  legF: { hip: -16, knee: 10 } as LegPose,
  armN: { sh: 8, el: 30, hand: 'fist' } as ArmPose,
  armF: { sh: -6, el: 26, hand: 'fist' } as ArmPose,
};

export interface ChibiGun {
  kind: 'pistol' | 'heavy' | 'rifle';
  /** Degrees: 0 forward, −90 up, 90 down. */
  angle: number;
  /** Body-space grip point (the near hand). */
  grip: V;
}

export interface ChibiSkeleton {
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
  gun: ChibiGun | null;
}

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

/** Two-bone IK (the rig's): elbow and the reachable hand for shoulder s and target t. */
function solveIK(s: V, t: V, a: number, b: number, bend: 'down' | 'up'): { el: V; wr: V } {
  let dx = t[0] - s[0];
  let dy = t[1] - s[1];
  if (Math.hypot(dx, dy) < 1e-6) {
    dx = 0;
    dy = 1;
  }
  const d0 = Math.hypot(t[0] - s[0], t[1] - s[1]);
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

function armChain(s: V, a: ArmPose, scaleTo: boolean): { el: V; wr: V } {
  if (a.to) {
    const k = scaleTo ? ARM_K : 1;
    return solveIK(s, [s[0] + a.to[0] * k, s[1] + a.to[1] * k], CHIBI.upper, CHIBI.fore, a.bend ?? 'down');
  }
  const shA = a.sh ?? 5;
  const el = add(s, dirOf(shA), CHIBI.upper);
  return { el, wr: add(el, dirOf(shA + (a.el ?? 20)), CHIBI.fore) };
}

function blendLeg(l: LegPose, c: LegPose, t: number): LegPose {
  if (t <= 0) return l;
  const k = Math.min(1, t);
  return { hip: l.hip + (c.hip - l.hip) * k, knee: l.knee + (c.knee - l.knee) * k, foot: (l.foot ?? 0) + ((c.foot ?? 0) - (l.foot ?? 0)) * k };
}

/** The boot's lowest point below `ankle` turned by `foot` (chibi-body.ts BOOT: an ellipse). */
export const BOOT = { cx: 1.15, cy: 1.25, rx: 3.05, ry: 2.05 } as const;

function bootBottom(ankle: V, foot: number): number {
  // Lowest point of the ellipse turned by −foot about the ankle.
  const a = -foot * DEG;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const cy = ankle[1] + BOOT.cx * sn + BOOT.cy * cs;
  return cy + Math.hypot(BOOT.rx * sn, BOOT.ry * cs);
}

/**
 * Solve the chibi skeleton. `ground`: the y of the sole line (−outline width, so the outline
 * rests on the ground line). The 1× and the HD solve are the same (unrounded): the frame
 * geometry comes from the 1× render (chibi-body.ts).
 */
export function solveChibi(pose: Pose, ground: number): ChibiSkeleton {
  const crouch = pose.crouch ?? 0;
  const legN = blendLeg(pose.legN ?? DEFAULT.legN, CROUCH_N, crouch);
  const legF = blendLeg(pose.legF ?? DEFAULT.legF, CROUCH_F, crouch);
  // The rig's crouch shortens the legs to 0.55; the chibi's are short already.
  const rigLs = pose.legScale ?? 1 + (0.55 - 1) * Math.min(1, crouch);
  const ls = 1 - ((1 - rigLs) / (1 - 0.55)) * (1 - CROUCH_SCALE);
  const pelvis0: V = [0, -(CHIBI.thigh + CHIBI.shin + CHIBI.ankle) - 1.5];
  const leg = (hip: V, l: LegPose): { knee: V; ankle: V } => {
    const knee = add(hip, dirOf(l.hip), CHIBI.thigh * ls);
    return { knee, ankle: add(knee, dirOf(l.hip - l.knee), CHIBI.shin * ls) };
  };
  const hipF0: V = [pelvis0[0] - CHIBI.farDx, pelvis0[1]];
  const ln = leg(pelvis0, legN);
  const lf = leg(hipF0, legF);

  let sy = 0;
  if (pose.grounded !== false) {
    const knee = (k: V): number => k[1] + 1.9;
    const bottom = Math.max(bootBottom(ln.ankle, legN.foot ?? 0), bootBottom(lf.ankle, legF.foot ?? 0), knee(ln.knee), knee(lf.knee));
    sy = ground - bottom;
  }
  const S = (p: V): V => [p[0], p[1] + sy];
  const bob = pose.bob ?? 0;
  const B = (p: V): V => [p[0], p[1] + sy + bob];
  const pelvis = B(pelvis0);

  const lean = pose.lean ?? 0;
  const u: V = [Math.sin(lean * DEG), -Math.cos(lean * DEG)];
  const f: V = [Math.cos(lean * DEG), Math.sin(lean * DEG)];
  const neck = add(pelvis, u, CHIBI.torsoH - (pose.hunch ?? 0) * 0.8);
  const shoulderAt = (dx: number): V => add(add(neck, f, CHIBI.shoulder[0] + dx), u, -CHIBI.shoulder[1]);

  const sk: ChibiSkeleton = {
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
    shF: shoulderAt(CHIBI.farDx),
    elF: [0, 0],
    wrF: [0, 0],
    handN: 'fist',
    handF: 'fist',
    gun: null,
  };

  const wr = weaponRig(pose, sk);
  sk.gun = wr.gun;
  let armN = pose.armN ?? wr.armN ?? DEFAULT.armN;
  // A thumbs-up held high would sit on the big face: the short arm shows it under the chin.
  if (armN.hand === 'thumb' && !armN.to) armN = { ...armN, sh: Math.min(armN.sh ?? 5, 72), el: Math.min(armN.el ?? 20, 42) };
  const armF = pose.armF ?? wr.armF ?? DEFAULT.armF;
  const n = armChain(sk.shN, armN, !!pose.armN);
  const fa = armChain(sk.shF, armF, !!pose.armF);
  sk.elN = n.el;
  sk.wrN = n.wr;
  sk.elF = fa.el;
  sk.wrF = fa.wr;
  sk.handN = armN.hand ?? 'fist';
  sk.handF = armF.hand ?? 'fist';
  // The gun follows its hand when the short arm could not reach the target.
  if (sk.gun && pose.gunHand === 'far' && !pose.armF) sk.gun.grip = [sk.wrF[0], sk.wrF[1]];
  else if (sk.gun && pose.gunHand !== 'far' && !pose.armN) sk.gun.grip = [sk.wrN[0], sk.wrN[1]];
  // The support hand: on the gun where the short arm reaches it.
  if (sk.gun && wr.support && !pose.armF) {
    const g = sk.gun;
    const dir: V = [Math.cos(g.angle * DEG), Math.sin(g.angle * DEG)];
    const side: V = [-dir[1], dir[0]];
    let best: V = add(g.grip, dir, 1.2);
    for (let t = wr.support; t >= 1.2; t -= 0.25) {
      const p = add(add(g.grip, dir, t), side, 0.2);
      if (Math.hypot(p[0] - sk.shF[0], p[1] - sk.shF[1]) <= CHIBI.upper + CHIBI.fore - 0.05) {
        best = p;
        break;
      }
    }
    const s = solveIK(sk.shF, best, CHIBI.upper, CHIBI.fore, wr.supportBend ?? 'down');
    sk.elF = s.el;
    sk.wrF = s.wr;
    sk.handF = 'grip';
  }
  return sk;
}

interface WeaponRig {
  gun: ChibiGun | null;
  armN?: ArmPose;
  armF?: ArmPose;
  /** The support hand rests on the gun at most this far along it from the grip. */
  support?: number;
  supportBend?: 'down' | 'up';
}

/** Hand targets and gun placement for a weapon pose (chibi reach). */
function weaponRig(pose: Pose, sk: ChibiSkeleton): WeaponRig {
  const w = pose.weapon ?? 'none';
  const aim = pose.aim ?? 'fwd';
  const rc = pose.recoil ?? 0;
  const P = sk.pelvis;
  const S = sk.shN;
  const F = sk.shF;
  const toN = (g: V): ArmPose => ({ to: [g[0] - S[0], g[1] - S[1]], hand: 'grip' });
  const toF = (g: V): ArmPose => ({ to: [g[0] - F[0], g[1] - F[1]], hand: 'grip' });
  const k = Math.SQRT1_2;
  if (w !== 'none' && pose.gunHand === 'far') {
    const g: V = [P[0] + 1.5, P[1] - 1.5];
    return { gun: { kind: w, angle: pose.gunAngle ?? 25, grip: g }, armF: toF(g) };
  }
  if (w === 'pistol') {
    if (aim === 'up') {
      // Both hands up in front of the chin, the barrel up past the cheek.
      const g: V = [S[0] + 5.2, S[1] - 3.6 + rc];
      return { gun: { kind: 'pistol', angle: -90, grip: g }, armN: toN(g), support: 1.4, supportBend: 'down' };
    }
    if (aim === 'diag-up') {
      const g: V = [S[0] + 5.6 - rc * k, S[1] - 1.6 + rc * k];
      return { gun: { kind: 'pistol', angle: -45, grip: g }, armN: toN(g), support: 1.4 };
    }
    if (aim === 'down') {
      const g: V = [S[0] + 2.6, S[1] + 5.6 - rc];
      return { gun: { kind: 'pistol', angle: 90, grip: g }, armN: toN(g), armF: { sh: -20, el: 60, hand: 'fist' } };
    }
    if (aim === 'diag-down') {
      const g: V = [S[0] + 4.8 - rc * k, S[1] + 3.6 - rc * k];
      return { gun: { kind: 'pistol', angle: pose.gunAngle ?? 45, grip: g }, armN: toN(g), armF: { sh: 10, el: 80, hand: 'fist' } };
    }
    const g: V = [S[0] + 5.9 - rc, S[1] + 1.8];
    return { gun: { kind: 'pistol', angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), support: 1.6 };
  }
  if (w === 'heavy' || w === 'rifle') {
    const kind = w;
    if (aim === 'up') {
      const g: V = [P[0] + 5.6, P[1] - 7.2 + rc];
      return { gun: { kind, angle: -90, grip: g }, armN: toN(g), support: 6 };
    }
    if (aim === 'down') {
      const g: V = [P[0] + 4.6, P[1] - 4.4 - rc];
      return { gun: { kind, angle: 90, grip: g }, armN: toN(g), support: 6 };
    }
    if (aim === 'diag-up' || aim === 'diag-down') {
      const up = aim === 'diag-up';
      const g: V = up ? [P[0] + 5.0 - rc * k, P[1] - 6.6 + rc * k] : [P[0] + 4.4 - rc * k, P[1] - 4.6 - rc * k];
      return { gun: { kind, angle: up ? -45 : 45, grip: g }, armN: toN(g), support: 6 };
    }
    const g: V = [P[0] + 4.4 - rc, P[1] - 4.6];
    return { gun: { kind, angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), support: 6 };
  }
  return { gun: null };
}
