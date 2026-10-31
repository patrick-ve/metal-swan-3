/**
 * Style `arcade` (arcade.ts): the skeleton. A copy of the rig's solve (src/game/art/humanoid.ts
 * `solve`, `weaponRig`, `armChain`, `solveIK`) with the arcade proportions: chunkier limbs, a
 * broad heroic chest, big boots and a bigger gun (so the gun's grips and spans change too).
 *
 * Coordinates are CONTINUOUS logical px relative to the frame's anchor pixel (its top-left
 * corner is (0, 0); x forward, y down). A full / lower figure stands on the ground line y = 0
 * (its outline ends there, the soles end at y = −1); an upper figure has its pelvis at the
 * centre of the anchor pixel (0.5, 0.5). The rig's body space maps to this as p + 0.5.
 */
import type { ArmPose, HandShape, LegPose, Pose, RenderPart } from '../../../art/humanoid';

export type V = [number, number];
export const DEG = Math.PI / 180;

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

/** Chunky and heroic: the rig's heights, wider limbs, a broad chest. */
export const DIMS: Dims = {
  thigh: 6,
  shin: 6,
  ankle: 3,
  thighW: [5.2, 4.4],
  shinW: [4.3, 3.9],
  torsoH: 9,
  waistB: 3,
  waistF: 3,
  chestB: 4,
  chestF: 4.4,
  upper: 6,
  fore: 6,
  armW: [4.4, 4],
  foreW: [4, 3.6],
  shoulder: [-1, 2],
  farDx: 2,
};

/** Gun scale against the rig's guns (bigger, heavier reads). */
export const GUN_SCALE = { pistol: 1.3, heavy: 1.15 } as const;

/** Rig gun grips (continuous: the grip px centre), fore-grips and muzzles (1× art px → continuous). */
export const GUN_RIG = {
  pistol: { grip: [1.5, 3.5] as V, grip2: [3.5, 2.5] as V, muzzle: [8.5, 0.5] as V },
  heavy: { grip: [5.5, 5.5] as V, grip2: [12.5, 5.5] as V, muzzle: [19.5, 3.5] as V },
} as const;

/** The boot (ankle-relative, x forward, y down): a big chunky boot with a thick sole. */
export const BOOT: readonly V[] = [
  [-2.5, -2.7],
  [1.3, -2.7],
  [2.1, -1.6],
  [3.3, -0.9],
  [4.4, -0.2],
  [4.9, 0.8],
  [4.9, 2.6],
  [-2.5, 2.6],
  [-2.7, 0.4],
];

export interface Gun {
  kind: 'pistol' | 'heavy';
  /** Degrees: 0 forward, −90 up, 90 down. */
  angle: number;
  /** Grip point (the near hand's wrist sits here). */
  grip: V;
  /**
   * Held upright, the slide / receiver to the FRONT of the grip (the gun's local y mirrored), so
   * the big face stays clear behind the gun.
   */
  flip?: boolean;
}

export interface Skeleton {
  pelvis: V;
  neck: V;
  /** Torso forward / up unit vectors (lean only; `rot` is applied by the painter). */
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
  gun: Gun | null;
  offGun: Gun | null;
}

const DEFAULT = {
  legN: { hip: 20, knee: 14 } as LegPose,
  legF: { hip: -16, knee: 10 } as LegPose,
  armN: { sh: 8, el: 30, hand: 'fist' } as ArmPose,
  armF: { sh: -6, el: 26, hand: 'fist' } as ArmPose,
};
const CROUCH_N: LegPose = { hip: 104, knee: 118 };
const CROUCH_F: LegPose = { hip: 44, knee: 160 };
const CROUCH_SCALE = 0.55;

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

/**
 * The sturdy stance: a standing figure (grounded, both feet near the stand) plants its feet a
 * little wider apart, so the two legs read with a gap between them.
 */
function stance(n: LegPose, f: LegPose, pose: Pose): [LegPose, LegPose] {
  if (pose.grounded === false || (pose.crouch ?? 0) > 0 || (pose.legScale ?? 1) < 1) return [n, f];
  if (n.hip < -5 || n.hip > 40 || f.hip > 5 || f.hip < -40) return [n, f];
  return [
    { ...n, hip: n.hip + 6, knee: n.knee + 4 },
    { ...f, hip: f.hip - 5, knee: f.knee + 2 },
  ];
}

function blendLeg(l: LegPose, c: LegPose, t: number): LegPose {
  if (t <= 0) return l;
  const k = Math.min(1, t);
  return { hip: l.hip + (c.hip - l.hip) * k, knee: l.knee + (c.knee - l.knee) * k, foot: (l.foot ?? 0) + ((c.foot ?? 0) - (l.foot ?? 0)) * k };
}

/** Lowest point of the boot at `ankle` turned by `foot` degrees (toe up = +). */
function bootBottom(ankle: V, foot: number): number {
  let m = -Infinity;
  for (const p of BOOT) m = Math.max(m, rotateAbout([ankle[0] + p[0], ankle[1] + p[1]], ankle, -foot)[1]);
  return m;
}

function armChain(s: V, a: ArmPose, d: Dims): { el: V; wr: V } {
  if (a.to) return solveIK(s, [s[0] + a.to[0], s[1] + a.to[1]], d.upper, d.fore, a.bend ?? 'down');
  const shA = a.sh ?? 5;
  const el = add(s, dirOf(shA), d.upper);
  return { el, wr: add(el, dirOf(shA + (a.el ?? 20)), d.fore) };
}

/** The gun's fore-grip span (grip → grip2 along the barrel), arcade size. */
export function gunSpan(kind: 'pistol' | 'heavy'): number {
  const g = GUN_RIG[kind];
  return (g.grip2[0] - g.grip[0]) * GUN_SCALE[kind];
}

/** Hand targets and the gun for a weapon pose (the rig's weaponRig, the arcade gun sizes). */
function weaponRig(pose: Pose, sk: Skeleton): { gun: Gun | null; armN?: ArmPose; armF?: ArmPose } {
  const w = pose.weapon ?? 'none';
  const aim = pose.aim ?? 'fwd';
  const rc = pose.recoil ?? 0;
  const P = sk.pelvis;
  const S = sk.shN;
  const F = sk.shF;
  const toN = (g: V): ArmPose => ({ to: [g[0] - S[0], g[1] - S[1]], hand: 'grip' });
  const toF = (g: V, bend: 'down' | 'up' = 'down'): ArmPose => ({ to: [g[0] - F[0], g[1] - F[1]], hand: 'grip', bend });
  if (w !== 'pistol' && w !== 'heavy') {
    if (w === 'none') return { gun: null };
  }
  const kind: 'pistol' | 'heavy' = w === 'pistol' ? 'pistol' : 'heavy';
  if (pose.gunHand === 'far') {
    const g: V = [P[0] + 2, P[1] - 2];
    return { gun: { kind, angle: pose.gunAngle ?? 25, grip: g }, armF: toF(g) };
  }
  if (kind === 'pistol') {
    if (aim === 'up') {
      const g: V = [P[0] + 9, P[1] - 15 + rc];
      return { gun: { kind, angle: -90, grip: g, flip: true }, armN: toN(g), armF: toF([g[0] - 1, g[1] + 2]) };
    }
    if (aim === 'diag-up') {
      const k = Math.SQRT1_2;
      const g: V = [S[0] + 10 - rc * k, S[1] + rc * k];
      return { gun: { kind, angle: -45, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + 2]) };
    }
    if (aim === 'down') {
      const g: V = [S[0] + 2, S[1] + 10 - rc];
      return { gun: { kind, angle: 90, grip: g }, armN: toN(g), armF: { sh: -20, el: 60, hand: 'fist' } };
    }
    const g: V = [S[0] + 9 - rc, S[1] + 3];
    return { gun: { kind, angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: { sh: 20, el: 100, hand: 'fist' } };
  }
  const span = gunSpan('heavy');
  if (aim === 'up') {
    const g: V = [P[0] + 9, P[1] - 10 + rc];
    return { gun: { kind, angle: -90, grip: g, flip: true }, armN: toN(g), armF: toF([g[0] + 1, g[1] - span + 3]) };
  }
  if (aim === 'down') {
    const g: V = [P[0] + 5, P[1] - 5 - rc];
    return { gun: { kind, angle: 90, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + span - 2]) };
  }
  if (aim === 'diag-up' || aim === 'diag-down') {
    const up = aim === 'diag-up';
    const k = Math.SQRT1_2;
    const g: V = up ? [P[0] + 6 - rc * k, P[1] - 8 + rc * k] : [P[0] + 4 - rc * k, P[1] - 4 - rc * k];
    const fore: V = [g[0] + (span - 1) * k, g[1] + (up ? -1 : 1) * (span - 1) * k];
    return { gun: { kind, angle: up ? -45 : 45, grip: g }, armN: toN(g), armF: toF(fore) };
  }
  const g: V = [P[0] + 3 - rc, P[1] - 4];
  return { gun: { kind, angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: toF([g[0] + span, g[1]]) };
}

/** The far hand's second pistol (Pose.offhand), as the rig. */
function offhandRig(pose: Pose, sk: Skeleton, gun: Gun | null): { gun: Gun; armF: ArmPose } | null {
  if (pose.offhand !== 'pistol' || !gun || gun.kind !== 'pistol' || pose.gunHand === 'far') return null;
  const F = sk.shF;
  const g = gun.grip;
  const aim = pose.aim ?? 'fwd';
  const at2: V = aim === 'up' ? [g[0] + 2, g[1] + 2] : aim === 'diag-up' ? [g[0] + 1, g[1] + 4] : aim === 'down' ? [g[0] + 5, g[1] - 2] : [g[0] - 2, g[1] + 4];
  return { gun: { kind: 'pistol', angle: gun.angle, grip: at2 }, armF: { to: [at2[0] - F[0], at2[1] - F[1]], hand: 'grip' } };
}

/**
 * Solve the skeleton in continuous anchor coordinates (see the file comment), BEFORE `rot`, `dx`
 * and `dy` (the painter applies them about the pelvis, as the rig does).
 */
export function solve(pose: Pose, part: RenderPart, d: Dims = DIMS): Skeleton {
  const crouch = pose.crouch ?? 0;
  const [sn, sf] = stance(pose.legN ?? DEFAULT.legN, pose.legF ?? DEFAULT.legF, pose);
  const legN = blendLeg(sn, CROUCH_N, crouch);
  const legF = blendLeg(sf, CROUCH_F, crouch);
  // Body space (the rig's): origin at the feet centre; + 0.5 → continuous.
  const pelvis0: V = [0.5, 0.5 - (d.thigh + d.shin + d.ankle)];
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
    const knee = (k: V): number => k[1] + d.thighW[1] / 2;
    const bottom = Math.max(bootBottom(ln.ankle, legN.foot ?? 0), bootBottom(lf.ankle, legF.foot ?? 0), knee(ln.knee), knee(lf.knee));
    sy = -1 - bottom;
  }
  // Airborne (grounded: false): the rig's rest height (sy 0), so jumps sit where the rig's do.
  const bob = pose.bob ?? 0;
  const S = (p: V): V => [p[0], p[1] + sy];
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
  const armN = pose.armN ?? wr.armN ?? DEFAULT.armN;
  const armF = pose.armF ?? off?.armF ?? wr.armF ?? DEFAULT.armF;
  let n = armChain(sk.shN, armN, d);
  // A thumbs-up in front of the (big) face moves forward of the nose, so the face still reads.
  if ((armN.hand ?? 'fist') === 'thumb') {
    const nk = sk.neck;
    const front = nk[0] + 8.8;
    if (n.wr[0] < front && n.wr[1] < nk[1] && n.wr[1] > nk[1] - 14) {
      n = solveIK(sk.shN, [front, n.wr[1] + 1], d.upper, d.fore, 'down');
    }
  }
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
  if (part === 'upper') {
    // The torso frame hangs on its pelvis: the pelvis sits at the anchor pixel's centre.
    const dx = 0.5 - pelvis[0];
    const dy = 0.5 - pelvis[1];
    shiftSkeleton(sk, dx, dy);
  }
  return sk;
}

function shiftSkeleton(sk: Skeleton, dx: number, dy: number): void {
  const m = (p: V): V => [p[0] + dx, p[1] + dy];
  sk.pelvis = m(sk.pelvis);
  sk.neck = m(sk.neck);
  sk.hipN = m(sk.hipN);
  sk.kneeN = m(sk.kneeN);
  sk.ankleN = m(sk.ankleN);
  sk.hipF = m(sk.hipF);
  sk.kneeF = m(sk.kneeF);
  sk.ankleF = m(sk.ankleF);
  sk.shN = m(sk.shN);
  sk.elN = m(sk.elN);
  sk.wrN = m(sk.wrN);
  sk.shF = m(sk.shF);
  sk.elF = m(sk.elF);
  sk.wrF = m(sk.wrF);
  if (sk.gun) sk.gun.grip = m(sk.gun.grip);
  if (sk.offGun) sk.offGun.grip = m(sk.offGun.grip);
}
