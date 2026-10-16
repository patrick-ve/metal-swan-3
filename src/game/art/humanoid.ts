/**
 * Parametric human figure for METAL SWAN 3 (docs/ART_GUIDE.md §3).
 *
 * A figure = HumanStyle (what the person looks like) + Pose (what the body does). The rig
 * solves a small skeleton (pelvis, legs, torso, arms, head, gun), draws each body part as its
 * own shaded layer, stacks the layers back to front with dark internal lines between parts
 * (selective outline) and finishes with a 1-px INK silhouette outline. `renderHuman(…, 2)`
 * draws the same figure as 2× art (density 2: the 1× frame's logical geometry, finer edges and
 * details; docs/ART_GUIDE.md "2x art (mission ams)").
 *
 * Body space: origin at the feet centre on the ground line, x points FORWARD (sprites face
 * right; the game flips them), y points down. Angles are in degrees:
 * - legs: `hip` = thigh angle from straight down (+ forward), `knee` = bend (+ shin swings
 *   back), `foot` = boot angle (+ toe up).
 * - arms: `sh` = upper-arm angle from straight down (+ forward, 180 = straight up), `el` =
 *   elbow bend (+ forearm turns further forward / up), or `to: [x, y]` = hand target relative
 *   to the shoulder (two-bone IK).
 * - `lean` tilts the torso (+ forward); `rot` turns the whole figure clockwise about the
 *   pelvis (falls and deaths).
 *
 * `renderHuman(style, pose, part)` returns a Frame trimmed to its pixels:
 * - part 'full' and 'lower' are anchored at the feet centre, 'upper' at the pelvis;
 * - points: `hip` (full/lower), `muzzle` (when a gun is drawn), `hand` (near hand or the item
 *   it holds), `head` (head centre).
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, PAL } from '../../engine/palette';
import type { Frame } from '../../engine/render';
import { at, Composer, despeckle, FLAT, R, shadeLayer } from './paint';
import type { RampLike, ShadeOpts } from './paint';
import {
  drawHand,
  giftArt,
  grenadeArt,
  gunArt,
  gunArtHi,
  heldArtHi,
  isProp,
  knifeArt,
  knifeArtHi,
  propArt,
  propArtHi,
  snackArt,
} from './humanoid-gear';
import type { HandShape, PropKind, WeaponPose } from './humanoid-gear';
import * as HeadModule from './humanoid-head';
import { HEAD_CENTER, HEAD_H, HEAD_W, NECK, renderHead } from './humanoid-head';
import type { Expression, FaceExtra, HairStyle, Headgear, HeadStyle } from './humanoid-head';

export type { Expression, FaceExtra, HairStyle, Headgear } from './humanoid-head';
export type { HandShape, PropKind, WeaponPose } from './humanoid-gear';

/** `tee` / `polo`: short sleeves over bare forearms (a polo adds a collar and a button placket). */
export type TopType = 'vest' | 'jacket' | 'tank' | 'coat' | 'tunic' | 'sweater' | 'shirt' | 'tee' | 'polo';
/** `stocky`: 2 px shorter legs, broad (short and sturdy); `lanky`: 1 px longer thighs, slim (tall). */
export type Build = 'slim' | 'normal' | 'heavy' | 'stocky' | 'lanky';
export type Accessory =
  | 'pouches'
  | 'armband'
  | 'scarf'
  | 'backpack'
  | 'ammo-belt'
  | 'cross-belt'
  | 'bowtie'
  | 'radio'
  | 'satchel'
  | 'epaulettes'
  /** Two reflective silver bands across a vest (a hi-vis vest). */
  | 'hivis'
  /** Leather tool pouches (belt colour) with a screwdriver poking out (instead of 'pouches'). */
  | 'toolbelt'
  /** Two knitting needles sticking out of the satchel. */
  | 'needles'
  /** A thin tie (accent colour) down the shirt front from the collar. */
  | 'tie'
  /** A short cape (accent colour) from the shoulders, with a small light-green leaf emblem. */
  | 'cape'
  /** Tweed: a fine fleck of light and dark threads over the top. */
  | 'tweed';

/** What a person looks like. Ramps are palette ramps or ramp names ('olive', 'khaki' …). */
export interface HumanStyle {
  skin: RampLike;
  hair: RampLike;
  hairStyle: HairStyle;
  headgear: Headgear;
  /** Helmet / cap / hood colour (default olive). */
  gear?: RampLike;
  /** Plumes, bands, badges, armbands, scarves, buttons (default red). */
  accent?: RampLike;
  top: RampLike;
  topType: TopType;
  /** Shirt under a vest (sleeves) — default sand. */
  shirt?: RampLike;
  pants: RampLike;
  boots: RampLike;
  /** Glove ramp, or null / undefined for bare hands. */
  gloves?: RampLike | null;
  /** Belt colour (default brown). */
  belt?: RampLike;
  build?: Build;
  accessories?: readonly Accessory[];
  face?: readonly FaceExtra[];
}

export interface LegPose {
  hip: number;
  knee: number;
  /** Boot angle (+ toe up). Default 0: sole parallel to the ground. */
  foot?: number;
}

export interface ArmPose {
  /** Upper-arm angle from straight down (+ forward). */
  sh?: number;
  /** Elbow bend (+ forearm turns forward / up). */
  el?: number;
  /** Hand target relative to the shoulder (overrides sh/el; two-bone IK). */
  to?: readonly [number, number];
  /** IK elbow side: 'down' (default: elbow low / back) or 'up'. */
  bend?: 'down' | 'up';
  hand?: HandShape;
}

/** Gun aim: forward, straight up / down, or the 45° diagonals (machine-gun sweep, heavy only). */
export type Aim = 'fwd' | 'up' | 'down' | 'diag-up' | 'diag-down';
/** Held in the near hand. The knife-look props (`PropKind`) are drawn like the knife. */
export type HeldItem = 'none' | 'grenade' | 'knife' | 'snack' | 'gift' | PropKind;

/** What the body does. Every field is optional (defaults: DEFAULT_POSE). */
export interface Pose {
  legN?: LegPose;
  legF?: LegPose;
  /** Extra pelvis drop in px (+ down) after the ground solve (run bob, breathing). */
  bob?: number;
  /** 0..1: blend the legs toward a deep crouch. */
  crouch?: number;
  /** Leg bone length factor (foreshortened folded legs in crouches; default 1). */
  legScale?: number;
  /** false: keep the pelvis at its rest height (airborne); default true: feet on the ground. */
  grounded?: boolean;
  lean?: number;
  /** Shorten the torso by this many px (breathing, hunching). */
  hunch?: number;
  armN?: ArmPose;
  armF?: ArmPose;
  head?: { dx?: number; dy?: number; tilt?: number };
  /**
   * Head size: 2 = Helium Head (GDD §4.13; the head and headgear drawn at 2× with Scale2x, the
   * neck stays where it is). Default 1.
   */
  headScale?: 1 | 2;
  aim?: Aim;
  weapon?: WeaponPose;
  /** Gun and hands move back by this many px (recoil). */
  recoil?: number;
  /** Rifle carried low at the hip instead of shouldered. */
  lowGun?: boolean;
  /** Free gun angle in degrees (overrides `aim` for the gun direction; 0 = forward). */
  gunAngle?: number;
  /** Which hand holds the gun: 'near' (default, aiming) or 'far' (carried low at the hip). */
  gunHand?: 'near' | 'far';
  expr?: Expression;
  held?: HeldItem;
  /** Held knife angle in degrees (0 = forward, −90 = up). Default: along the forearm. */
  heldAngle?: number;
  /** Whole-figure rotation in degrees, clockwise, about the pelvis. */
  rot?: number;
  /** Whole-figure offset after the ground solve. */
  dx?: number;
  dy?: number;
  /** Scarf / coat-tail flutter phase (0..3). */
  flutter?: number;
  /** false: the headgear is off (knocked away, held in a hand). Default true. */
  hat?: boolean;
  /** The headgear slips down over the eyes by this many px. Default 0. */
  hatDy?: number;
  /**
   * A second gun in the far hand while the near hand aims a pistol (akimbo; drawing only: the
   * muzzle point stays the near gun's). Ignored when the gun is carried low (`gunHand: 'far'`).
   */
  offhand?: 'pistol';
}

export type RenderPart = 'full' | 'upper' | 'lower';

export const DEFAULT_POSE = {
  legN: { hip: 20, knee: 14 } as LegPose,
  legF: { hip: -16, knee: 10 } as LegPose,
  armN: { sh: 8, el: 30, hand: 'fist' } as ArmPose,
  armF: { sh: -6, el: 26, hand: 'fist' } as ArmPose,
} as const;

// ------------------------------------------------------------------------------------ build

interface Dims {
  thigh: number;
  shin: number;
  /** Ankle height above the sole. */
  ankle: number;
  thighW: readonly [number, number];
  shinW: readonly [number, number];
  torsoH: number;
  /** Torso half-widths (back, front) at the waist and at the chest. */
  waistB: number;
  waistF: number;
  chestB: number;
  chestF: number;
  upper: number;
  fore: number;
  armW: readonly [number, number];
  foreW: readonly [number, number];
  /** Shoulder joint relative to the neck base: [forward, down]. */
  shoulder: readonly [number, number];
  /** x offset of the far hip / shoulder (depth cue). */
  farDx: number;
}

const BUILDS: Readonly<Record<Build, Dims>> = {
  slim: {
    thigh: 6, shin: 6, ankle: 3, thighW: [5, 4], shinW: [4, 4], torsoH: 9,
    waistB: 3, waistF: 2, chestB: 3, chestF: 3, upper: 6, fore: 6, armW: [3, 3], foreW: [3, 3],
    shoulder: [-1, 2], farDx: 2,
  },
  normal: {
    thigh: 6, shin: 6, ankle: 3, thighW: [6, 5], shinW: [5, 4], torsoH: 9,
    waistB: 3, waistF: 3, chestB: 4, chestF: 4, upper: 6, fore: 6, armW: [4, 4], foreW: [4, 3],
    shoulder: [-1, 2], farDx: 2,
  },
  heavy: {
    thigh: 6, shin: 6, ankle: 3, thighW: [7, 6], shinW: [6, 5], torsoH: 9,
    waistB: 4, waistF: 5, chestB: 5, chestF: 5, upper: 6, fore: 6, armW: [5, 5], foreW: [5, 4],
    shoulder: [-1, 2], farDx: 2,
  },
  stocky: {
    thigh: 5, shin: 5, ankle: 3, thighW: [6, 6], shinW: [6, 5], torsoH: 9,
    waistB: 4, waistF: 4, chestB: 5, chestF: 5, upper: 6, fore: 6, armW: [4, 4], foreW: [4, 4],
    shoulder: [-1, 2], farDx: 2,
  },
  lanky: {
    thigh: 7, shin: 6, ankle: 3, thighW: [5, 4], shinW: [4, 4], torsoH: 9,
    waistB: 3, waistF: 2, chestB: 3, chestF: 3, upper: 6, fore: 6, armW: [3, 3], foreW: [3, 3],
    shoulder: [-1, 2], farDx: 2,
  },
};

// ------------------------------------------------------------------------------------ geometry

type V = [number, number];
const DEG = Math.PI / 180;

/** Unit vector for an angle measured from straight down, + toward forward (+x). */
function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}

function add(a: V, b: V, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

/** Angle (from straight down, + forward) of the vector from a to b. */
function angleTo(a: V, b: V): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
}

function rotateAbout(p: V, c: V, deg: number): V {
  if (deg === 0) return p;
  const a = deg * DEG;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs];
}

/** Two-bone IK: elbow and (reachable) hand for shoulder s, target t, bone lengths a and b. */
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
  // 'down': the elbow hangs low, or sits back when the arm is raised.
  const score = (e: V): number => e[1] * 2 - e[0];
  let el = score(e1) >= score(e2) ? e1 : e2;
  if (bend === 'up') el = el === e1 ? e2 : e1;
  return { el, wr: [s[0] + ux * d, s[1] + uy * d] };
}

/** Boot outline relative to the ankle (x forward, y down); the sole row is y = +2. */
const BOOT: readonly V[] = [
  [-2, -2],
  [1, -2],
  [2, -1],
  [3, 0],
  [4, 1],
  [4, 2],
  [-2, 2],
];

/** Target of `pose.crouch` (same as poses.ts CROUCH): folded, foreshortened legs. */
const CROUCH_N: LegPose = { hip: 104, knee: 118 };
const CROUCH_F: LegPose = { hip: 44, knee: 160 };
const CROUCH_SCALE = 0.55;

// ------------------------------------------------------------------------------------ style

interface Resolved {
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

function resolve(s: HumanStyle): Resolved {
  const skin = R(s.skin);
  const top = R(s.top);
  const shirt = R(s.shirt ?? 'sand');
  // Jackets, coats, tunics, sweaters and shirts cover the whole arm; vests show short shirt
  // sleeves; tank tops show bare arms.
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
  return {
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
}

// ------------------------------------------------------------------------------------ skeleton

interface Skeleton {
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
  /** The far hand's second pistol (Pose.offhand). */
  offGun: GunPlacement | null;
}

interface GunPlacement {
  kind: 'pistol' | 'heavy' | 'rifle';
  /** Degrees: 0 forward, −90 up, 90 down (quarter turns are exact). */
  angle: number;
  /** Body-space position of the gun's grip pixel. */
  grip: V;
}

function blendLeg(l: LegPose, c: LegPose, t: number): LegPose {
  if (t <= 0) return l;
  const k = Math.min(1, t);
  return { hip: l.hip + (c.hip - l.hip) * k, knee: l.knee + (c.knee - l.knee) * k, foot: (l.foot ?? 0) + ((c.foot ?? 0) - (l.foot ?? 0)) * k };
}

/** Lowest sole y of a boot at `ankle` turned by `foot` degrees. */
function bootBottom(ankle: V, foot: number): number {
  let m = -Infinity;
  for (const p of BOOT) m = Math.max(m, rotateAbout([ankle[0] + p[0], ankle[1] + p[1]], ankle, -foot)[1]);
  return m;
}

function solve(st: Resolved, pose: Pose): Skeleton {
  const d = st.dims;
  const crouch = pose.crouch ?? 0;
  const legN = blendLeg(pose.legN ?? DEFAULT_POSE.legN, CROUCH_N, crouch);
  const legF = blendLeg(pose.legF ?? DEFAULT_POSE.legF, CROUCH_F, crouch);
  const pelvis0: V = [0, -(d.thigh + d.shin + d.ankle)];
  const ls = pose.legScale ?? 1 + (CROUCH_SCALE - 1) * Math.min(1, crouch); // explicit, or blended by crouch
  const leg = (hip: V, l: LegPose): { knee: V; ankle: V } => {
    const knee = add(hip, dirOf(l.hip), d.thigh * ls);
    return { knee, ankle: add(knee, dirOf(l.hip - l.knee), d.shin * ls) };
  };
  const hipF0: V = [pelvis0[0] - d.farDx, pelvis0[1]];
  const ln = leg(pelvis0, legN);
  const lf = leg(hipF0, legF);

  // Ground solve: the lowest sole (or a kneeling knee) rests on the ground, so the outline
  // below it is the last pixel row above y = 0 (the feet-anchor convention).
  let sy = 0;
  if (pose.grounded !== false) {
    const knee = (k: V): number => k[1] + Math.floor(d.thighW[1] / 2);
    const bottom = Math.max(bootBottom(ln.ankle, legN.foot ?? 0), bootBottom(lf.ankle, legF.foot ?? 0), knee(ln.knee), knee(lf.knee));
    sy = -2 - Math.round(bottom);
  }
  const S = (p: V): V => [p[0], p[1] + sy];
  // Bob lowers the pelvis (and everything above it); the feet stay where the solve put them.
  const bob = Math.round(pose.bob ?? 0);
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

  // Weapon pose decides the hand targets unless the pose gives its own arms.
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
  // The gun follows its hand even when the IK could not quite reach the target.
  if (sk.gun && pose.gunHand === 'far' && !pose.armF) sk.gun.grip = [sk.wrF[0], sk.wrF[1]];
  else if (sk.gun && pose.gunHand !== 'far' && !pose.armN) sk.gun.grip = [sk.wrN[0], sk.wrN[1]];
  if (sk.offGun && !pose.armF) sk.offGun.grip = [sk.wrF[0], sk.wrF[1]];
  return sk;
}

/** The far hand's second pistol (Pose.offhand): beside and a little under the aimed one. */
function offhandRig(pose: Pose, sk: Skeleton, gun: GunPlacement | null): { gun: GunPlacement; armF: ArmPose } | null {
  if (pose.offhand !== 'pistol' || !gun || gun.kind !== 'pistol' || pose.gunHand === 'far') return null;
  const F = sk.shF;
  const g = gun.grip;
  const aim = pose.aim ?? 'fwd';
  const at2: V = aim === 'up' ? [g[0] + 2, g[1] + 2] : aim === 'diag-up' ? [g[0] + 1, g[1] + 4] : aim === 'down' ? [g[0] + 5, g[1] - 2] : [g[0] - 2, g[1] + 4];
  const off: GunPlacement = { kind: 'pistol', angle: gun.angle, grip: at2 };
  return { gun: off, armF: { to: [at2[0] - F[0], at2[1] - F[1]], hand: 'grip' } };
}

function armChain(s: V, a: ArmPose, d: Dims): { el: V; wr: V } {
  if (a.to) return solveIK(s, [s[0] + a.to[0], s[1] + a.to[1]], d.upper, d.fore, a.bend ?? 'down');
  const shA = a.sh ?? 5;
  const el = add(s, dirOf(shA), d.upper);
  return { el, wr: add(el, dirOf(shA + (a.el ?? 20)), d.fore) };
}

/** Hand targets and gun placement for a weapon pose. */
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
    // Carried low in the far hand (the near arm throws or stabs).
    const g: V = [P[0] + 2, P[1] - 2];
    return { gun: { kind: w, angle: pose.gunAngle ?? 25, grip: g }, armF: toF(g) };
  }
  if (w === 'pistol') {
    if (aim === 'up') {
      // Held upright in both hands in front of the chin, the barrel up past the brow: the gun
      // and both hands read clearly and the shot leaves in front of the face (never from
      // behind the skull; the hair stays whole).
      const g: V = [P[0] + 9, P[1] - 15 + rc];
      return { gun: { kind: 'pistol', angle: -90, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + 2]) };
    }
    if (aim === 'diag-up') {
      // 45° up (GDD §4.3: up + forward): both hands, the gun tilted up in front of the chest,
      // the barrel clear of the face.
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
      // Held upright in front of the face, the barrel above the head.
      const g: V = [P[0] + 9, P[1] - 10 + rc];
      return { gun: { kind: 'heavy', angle: -90, grip: g }, armN: toN(g), armF: toF([g[0] + 1, g[1] - span + 3]) };
    }
    if (aim === 'down') {
      const g: V = [P[0] + 5, P[1] - 5 - rc];
      return { gun: { kind: 'heavy', angle: 90, grip: g }, armN: toN(g), armF: toF([g[0] - 1, g[1] + span - 2]) };
    }
    if (aim === 'diag-up' || aim === 'diag-down') {
      // The 45° sweep frames: the gun tilted between forward and up / down, the far hand on the
      // fore-grip along the barrel.
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
    // Shouldered: the stock rests at the shoulder.
    const g: V = [S[0] + 3 - rc, S[1] + 2];
    return { gun: { kind: 'rifle', angle: pose.gunAngle ?? 0, grip: g }, armN: toN(g), armF: toF([g[0] + span - 1, g[1] - 1]) };
  }
  return { gun: null };
}

/** Gun buffer rotated for its placement, with its grip and muzzle mapped. */
function placedGun(g: GunPlacement): { buf: PixelBuffer; grip: V; muzzle: V } {
  const art = gunArt(g.kind);
  const a = g.angle;
  const q = Math.round(a / 90);
  if (Math.abs(a - q * 90) < 1e-6) {
    const turns = ((q % 4) + 4) % 4;
    let buf = art.buf;
    let grip: V = [art.grip[0], art.grip[1]];
    let muz: V = [art.muzzle[0], art.muzzle[1]];
    for (let i = 0; i < turns; i++) {
      // Clockwise quarter turn: (x, y) → (h − 1 − y, x).
      const h = buf.h;
      grip = [h - 1 - grip[1], grip[0]];
      muz = [h - 1 - muz[1], muz[0]];
      buf = buf.rotated(Math.PI / 2);
    }
    return { buf, grip, muzzle: muz };
  }
  // Free angle: smooth rotation about the buffer centre; points follow the same rotation.
  const buf = art.buf.rotated(a * DEG);
  const c0: V = [art.buf.w / 2, art.buf.h / 2];
  const map = (p: readonly [number, number]): V => {
    const r = rotateAbout([p[0] + 0.5, p[1] + 0.5], c0, a);
    return [r[0] - c0[0] + buf.w / 2 - 0.5, r[1] - c0[1] + buf.h / 2 - 0.5];
  };
  return { buf, grip: map(art.grip), muzzle: map(art.muzzle) };
}


// ------------------------------------------------------------------------------------ drawing

/** Working canvas size and the canvas pixel of the body-space origin (feet centre), 1× grid. */
const CW = 112;
const CH = 112;
const OX = 56;
const OY = 80;

/**
 * Pixel density of a render: 1 = the 1× art, 2 = 2× art (mission ams; docs/ART_GUIDE.md "2x art
 * (mission ams)"). At 2 every part is placed from the SAME 1×-grid joint pixels as at 1× and drawn
 * on the 2× grid (limb and torso edges follow the true shape at half-pixel steps), with bands,
 * rings and the outline 2 px wide (the 1× weight) and the small details as 1-px lines.
 */
export type Density = 1 | 2;

interface Ctx {
  st: Resolved;
  sk: Skeleton;
  pose: Pose;
  /** Body space → canvas, 1× grid (rotation about the pelvis, offset, origin). */
  T: (p: V) => V;
  rot: number;
  /** Buffer px per 1× canvas px. */
  D: Density;
  /** Canvas size on the 1× grid (the whole working canvas, or the region a 2× render needs). */
  W: number;
  H: number;
}

function layer(c: Ctx): PixelBuffer {
  return new PixelBuffer(c.W * c.D, c.H * c.D);
}

function rp(v: V): V {
  return [Math.round(v[0]), Math.round(v[1])];
}

/** Canvas pixel (1× grid) of a body-space point. */
function cp(c: Ctx, p: V): V {
  return rp(c.T(p));
}

/** Shading options for this render's density. */
function sh(c: Ctx, o: ShadeOpts = {}): ShadeOpts {
  return c.D === 1 ? o : { ...o, density: c.D };
}

/**
 * Filled polygon through canvas pixels (1× grid). At 2× each vertex moves to the far corner of
 * its 2 × 2 block on the side away from the centroid, so the shape covers the doubled 1× area.
 */
function fillPoly(c: Ctx, L: PixelBuffer, px: readonly V[], col: Color = FLAT): void {
  if (c.D === 1) {
    L.poly(px, col);
    return;
  }
  let mx = 0;
  let my = 0;
  for (const p of px) {
    mx += p[0];
    my += p[1];
  }
  mx /= px.length;
  my /= px.length;
  L.poly(px.map((p): V => [p[0] * 2 + (p[0] >= mx ? 1 : 0), p[1] * 2 + (p[1] >= my ? 1 : 0)]), col);
}

function poly(L: PixelBuffer, c: Ctx, pts: readonly V[], col: Color = FLAT): void {
  fillPoly(c, L, pts.map((p) => cp(c, p)), col);
}

/** 2× buffer coordinate of a 1×-grid pixel for a capsule end of diameter d (logical px). */
function capEnd(v: number, d: number): number {
  return v * 2 + (d % 2 === 0 ? 1 : 0);
}

/** Tapered limb between canvas pixels a and b (1× grid), diameters w0 → w1 logical px. */
function taper(c: Ctx, L: PixelBuffer, a: V, b: V, w0: number, w1: number, col: Color = FLAT): void {
  if (c.D === 1) {
    L.taper(a[0], a[1], b[0], b[1], w0, w1, col);
    return;
  }
  const d0 = Math.max(1, Math.round(w0));
  const d1 = Math.max(1, Math.round(w1));
  L.taper(capEnd(a[0], d0), capEnd(a[1], d0), capEnd(b[0], d1), capEnd(b[1], d1), d0 * 2, d1 * 2, col);
}

/** Capsule (thick line) between canvas pixels, `w` logical px wide. */
function thick(c: Ctx, L: PixelBuffer, a: V, b: V, w: number, col: Color): void {
  if (c.D === 1) {
    L.thickLine(a[0], a[1], b[0], b[1], w, col);
    return;
  }
  const d = Math.max(1, Math.round(w));
  L.thickLine(capEnd(a[0], d), capEnd(a[1], d), capEnd(b[0], d), capEnd(b[1], d), d * 2, col);
}

/** A 1-logical-px line between canvas pixels (2 px wide at 2×). */
function line(c: Ctx, L: PixelBuffer, a: V, b: V, col: Color): void {
  if (c.D === 1) L.line(a[0], a[1], b[0], b[1], col);
  else L.thickLine(a[0] * 2, a[1] * 2, b[0] * 2, b[1] * 2, 2, col);
}

/** A fine line between canvas pixels: 1 px at either density (2× detail: seams, shafts). */
function fineLine(c: Ctx, L: PixelBuffer, a: V, b: V, col: Color): void {
  if (c.D === 1) L.line(a[0], a[1], b[0], b[1], col);
  else L.line(a[0] * 2, a[1] * 2, b[0] * 2, b[1] * 2, col);
}

/** One logical pixel at canvas pixel (x, y) (a 2 × 2 block at 2×). */
function dot(c: Ctx, L: PixelBuffer, x: number, y: number, col: Color): void {
  if (c.D === 1) L.set(x, y, col);
  else L.rect(x * 2, y * 2, 2, 2, col);
}

/** Point in the torso frame: a forward, b up from the pelvis. */
function tp(sk: Skeleton, a: number, b: number): V {
  return [sk.pelvis[0] + sk.f[0] * a + sk.u[0] * b, sk.pelvis[1] + sk.f[1] * a + sk.u[1] * b];
}

function drawLeg(c: Ctx, hip: V, knee: V, ankle: V, far: boolean, withPelvis: boolean): PixelBuffer {
  const d = c.st.dims;
  const L = layer(c);
  const h = cp(c, hip);
  const k = cp(c, knee);
  const a = cp(c, ankle);
  taper(c, L, h, k, d.thighW[0], d.thighW[1]);
  taper(c, L, k, a, d.shinW[0], d.shinW[1]);
  if (withPelvis) {
    const sk = c.sk;
    poly(L, c, [
      [sk.pelvis[0] - d.waistB, sk.pelvis[1] - 2],
      [sk.pelvis[0] + d.waistF, sk.pelvis[1] - 2],
      [sk.pelvis[0] + d.waistF, sk.pelvis[1] + 2],
      [sk.pelvis[0] - d.waistB, sk.pelvis[1] + 2],
    ]);
  }
  shadeLayer(L, c.st.pants, sh(c, { shift: far ? -1 : 0 }));
  // Knee crease: a dark pixel on the inside of a bent knee (at 2×: a short fold line).
  const bend = angleTo(knee, ankle) - angleTo(hip, knee);
  if (Math.abs(bend) > 35) {
    const mid = (angleTo(hip, knee) + angleTo(knee, ankle)) / 2 + 90;
    const kk = cp(c, add(knee, dirOf(mid), 1));
    const col = at(c.st.pants, far ? 0 : 1);
    if (c.D === 1) {
      if ((L.get(kk[0], kk[1]) & 255) !== 0) L.set(kk[0], kk[1], col);
    } else {
      const p = c.T(add(knee, dirOf(mid), 1));
      const q = c.T(add(knee, dirOf(mid + 180), 0.5));
      const x0 = Math.round(p[0] * 2 + 1);
      const y0 = Math.round(p[1] * 2 + 1);
      const x1 = Math.round(q[0] * 2 + 1);
      const y1 = Math.round(q[1] * 2 + 1);
      const F = new PixelBuffer(L.w, L.h).line(x0, y0, x1, y1, col);
      for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0 && (L.data[i] & 255) !== 0) L.data[i] = F.data[i];
      L.touch();
    }
  }
  return despeckle(L, undefined, c.D);
}

function drawBoot(c: Ctx, ankle: V, foot: number, far: boolean): PixelBuffer {
  const L = layer(c);
  poly(L, c, BOOT.map((p) => rotateAbout([ankle[0] + p[0], ankle[1] + p[1]], ankle, -foot)));
  const b = c.st.boots;
  shadeLayer(L, b, sh(c, { shift: far ? -1 : 0, glint: !far }));
  // Sole: the bottom edge in the boot's darkest colour (2 px at 2×: the 1× weight).
  const { w, h, data } = L;
  const src = c.D === 1 ? data : data.slice();
  for (let y = h - 2; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((src[i] & 255) === 0) continue;
      const below = (src[i + w] & 255) === 0;
      const below2 = c.D === 2 && y + 2 < h && (src[i + 2 * w] & 255) === 0;
      if (below || below2) data[i] = b[0];
    }
  }
  if (c.D === 2 && !far) {
    // Lace detail: a 1-px light line across the instep.
    const t = cp(c, rotateAbout([ankle[0] + 1, ankle[1] - 1], ankle, -foot));
    const p = cp(c, rotateAbout([ankle[0] + 2, ankle[1]], ankle, -foot));
    const F = new PixelBuffer(w, h).line(t[0] * 2 + 1, t[1] * 2, p[0] * 2 + 1, p[1] * 2, at(b, 3));
    for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0 && (data[i] & 255) !== 0 && data[i] !== b[0]) data[i] = F.data[i];
  }
  return L.touch();
}

/** Torso silhouette in the torso frame: broad chest, narrower waist, rounded shoulders. */
function torsoOutline(c: Ctx): V[] {
  const d = c.st.dims;
  const sk = c.sk;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  return [
    tp(sk, -d.waistB, -2),
    tp(sk, d.waistF, -2),
    tp(sk, d.waistF + 1, 2),
    tp(sk, d.chestF + 1, H - 4),
    tp(sk, d.chestF, H - 1),
    tp(sk, d.chestF - 2, H),
    tp(sk, -d.chestB + 1, H),
    tp(sk, -d.chestB - 1, H - 2),
    tp(sk, -d.chestB, 3),
    tp(sk, -d.waistB, 0),
  ];
}

function drawTorso(c: Ctx): PixelBuffer {
  const st = c.st;
  const d = st.dims;
  const sk = c.sk;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const type = st.s.topType;
  const main = st.top;
  const L = layer(c);
  poly(L, c, torsoOutline(c));
  shadeLayer(L, main, sh(c, { lo: 2 }));
  // Detail helpers in torso coordinates (only on existing torso pixels).
  const put = (a: number, b: number, col: Color): void => {
    const p = cp(c, tp(sk, a, b));
    if (c.D === 1) {
      if ((L.get(p[0], p[1]) & 255) !== 0) L.set(p[0], p[1], col);
      return;
    }
    for (let k = 0; k < 4; k++) {
      const x = p[0] * 2 + (k & 1);
      const y = p[1] * 2 + (k >> 1);
      if ((L.get(x, y) & 255) !== 0) L.set(x, y, col);
    }
  };
  /** 2× only: one fine pixel at torso point (a, b) (half steps reach single 2× pixels). */
  const fine = (a: number, b: number, col: Color): void => {
    if (c.D === 1 || col === 0) return;
    const p = c.T(tp(sk, a, b));
    const x = Math.floor(p[0] * 2 + 1);
    const y = Math.floor(p[1] * 2 + 1);
    if ((L.get(x, y) & 255) !== 0) L.set(x, y, col);
  };
  /** A seam: a dark logical px at 1×, a 1-px line on the left half of the block at 2×. */
  const seam = (a: number, b: number, col: Color): void => {
    if (c.D === 1) return put(a, b, col);
    const p = cp(c, tp(sk, a, b));
    for (const y of [p[1] * 2, p[1] * 2 + 1]) if ((L.get(p[0] * 2, y) & 255) !== 0) L.set(p[0] * 2, y, col);
  };
  const fillTri = (pts: readonly V[], col: Color): void => {
    const T = layer(c);
    poly(T, c, pts.map((q) => tp(sk, q[0], q[1])), col);
    for (let i = 0; i < T.data.length; i++) if ((T.data[i] & 255) !== 0 && (L.data[i] & 255) !== 0) L.data[i] = T.data[i];
    L.touch();
  };
  const front = d.chestF;
  if (type === 'vest') {
    // V-neck shows the shirt; two chest pockets; seam down the front.
    fillTri([[front - 4, H], [front - 1, H], [front - 2, H - 3]], st.shirt[2]);
    put(front - 3, H, st.shirt[3]);
    for (let b = 0; b <= H - 4; b++) seam(d.waistF, b, main[1]);
    for (const [a, b, k] of [[0, 5, 3], [1, 5, 3], [0, 4, 1], [1, 4, 1], [0, 3, 1], [1, 3, 1], [-3, 2, 1], [-2, 2, 1], [-3, 3, 3], [-2, 3, 3]] as const) {
      put(a, b, main[k]);
    }
    // 2×: pocket flap edges and buttons.
    fine(0, 4.5, main[0]);
    fine(1, 4.5, main[0]);
    fine(0.5, 4, at(main, 3));
    fine(-2.5, 2.5, at(main, 3));
  } else if (type === 'jacket' || type === 'shirt') {
    fillTri([[front - 4, H], [front - 1, H], [front - 2, H - 2]], type === 'shirt' ? main[3] : st.shirt[2]);
    put(front - 4, H - 1, main[3]);
    put(front - 1, H - 1, main[3]);
    for (let b = -1; b <= H - 3; b++) seam(d.waistF, b, main[1]);
    // 2×: small buttons beside the placket.
    for (let b = 1; b <= H - 3; b += 2) fine(d.waistF - 0.5, b, at(main, 3));
    if (type === 'jacket') {
      put(-2, 3, main[1]);
      put(-1, 3, main[1]);
      fine(-2, 2.5, at(main, 3));
      fine(-1.5, 2.5, at(main, 3));
    }
  } else if (type === 'tunic') {
    // High collar in the accent colour, a row of brass buttons.
    for (let a = front - 4; a <= front - 1; a++) put(a, H, st.accent[2]);
    put(front - 3, H - 1, st.accent[1]);
    for (let b = 0; b <= H - 2; b += 2) put(d.waistF, b, PAL.gold[2]);
    for (let b = 0; b <= H - 2; b += 2) fine(d.waistF, b, PAL.gold[3]);
  } else if (type === 'sweater') {
    for (let a = -d.waistB - 1; a <= d.waistF + 1; a++) put(a, -1, main[1]);
    for (let a = front - 4; a <= front - 1; a++) put(a, H, main[3]);
    if (c.D === 1) {
      for (let b = 1; b <= H - 2; b += 3) for (let a = -d.chestB; a <= front; a += 2) put(a, b, main[1]);
    } else {
      // Knit: rows of small 'v' stitches (1-px) instead of the 1× dots.
      for (let b = 1; b <= H - 2; b += 2) {
        for (let a = -d.chestB; a <= front; a += 1.5) {
          fine(a, b, main[1]);
          fine(a + 0.5, b + 0.5, main[1]);
          fine(a + 1, b, main[1]);
        }
      }
      // Ribbed hem.
      for (let a = -d.waistB - 1; a <= d.waistF + 1; a += 1) fine(a + 0.5, -1, main[0]);
    }
  } else if (type === 'tank') {
    // Bare shoulders and a scoop neck above the tank top.
    const S2 = layer(c);
    poly(S2, c, [tp(sk, -d.chestB - 1, H - 2), tp(sk, -d.chestB + 1, H), tp(sk, front - 2, H), tp(sk, front, H - 1), tp(sk, front - 1, H - 3), tp(sk, -1, H - 3)]);
    shadeLayer(S2, st.skin, sh(c));
    for (let i = 0; i < S2.data.length; i++) if ((S2.data[i] & 255) !== 0 && (L.data[i] & 255) !== 0) L.data[i] = S2.data[i];
    L.touch();
  } else if (type === 'tee') {
    // A round crew neck: a dark rib under the throat.
    for (let a = front - 4; a <= front - 1; a++) put(a, H, main[1]);
    put(front - 3, H - 1, main[1]);
    fine(front - 2.5, H - 0.5, main[0]);
  } else if (type === 'polo') {
    // A light collar, a short button placket.
    for (let a = front - 4; a <= front - 1; a++) put(a, H, main[3]);
    put(front - 4, H - 1, main[3]);
    put(front - 1, H - 1, main[2]);
    put(front - 2, H - 2, main[0]);
    put(front - 2, H - 3, main[0]);
    fine(front - 2, H - 2.5, at(main, 3));
    fine(front - 2, H - 3.5, at(main, 3));
  } else if (type === 'coat') {
    fillTri([[front - 4, H], [front - 1, H], [front - 2, H - 2]], st.shirt[2]);
    for (let b = -1; b <= H - 3; b++) seam(d.waistF, b, main[1]);
    for (let b = 1; b <= H - 3; b += 3) put(d.waistF - 1, b, PAL.gold[2]);
    for (let b = 1; b <= H - 3; b += 3) fine(d.waistF - 1, b, PAL.gold[3]);
  }
  if (st.acc.has('tweed')) {
    // A fixed fleck pattern: light and dark threads, denser on the 2× grid.
    for (let b = 0; b <= H; b++) {
      for (let a = -d.chestB - 1; a <= front + 1; a++) {
        const k = (a * 5 + b * 3 + 64) % 7;
        if (k === 0) put(a, b, main[1]);
        else if (k === 3 && b % 2 === 0) put(a, b, at(main, 3));
        fine(a + 0.5, b + 0.5, k === 5 ? main[1] : k === 1 ? at(main, 3) : 0);
      }
    }
  }
  if (st.acc.has('hivis')) {
    // Reflective bands: silver stripes round the waist and across the chest.
    for (let a = -d.chestB - 1; a <= front + 1; a++) {
      put(a, 1, PAL.snow[2]);
      put(a, H - 4, PAL.snow[3]);
    }
    // 2×: a bright top edge on each band.
    for (let a = -d.chestB - 1; a <= front + 1; a += 0.5) {
      fine(a, 1.5, PAL.snow[3]);
      fine(a, H - 3.5, PAL.snow[3]);
    }
  }
  return L;
}

/** Coat tails hanging from the waist (flap with `flutter`). */
function drawCoatTails(c: Ctx): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const fl = c.pose.flutter ?? 0;
  const L = layer(c);
  const back = [0, 1, 2, 1][Math.round(fl) & 3];
  poly(L, c, [
    tp(sk, -d.waistB, 0),
    tp(sk, d.waistF, 0),
    tp(sk, d.waistF + 1, -8),
    tp(sk, -d.waistB - 2 - back, -8 + back),
  ]);
  shadeLayer(L, c.st.top, sh(c, { lo: 1 }));
  return L;
}

function drawBelt(c: Ctx): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const L = layer(c);
  poly(L, c, [tp(sk, -d.waistB, 0), tp(sk, d.waistF, 0), tp(sk, d.waistF, -1), tp(sk, -d.waistB, -1)]);
  shadeLayer(L, c.st.belt, sh(c, { hi: 0, lo: 0, base: 1 }));
  const p = cp(c, tp(sk, d.waistF - 1, 0));
  if (c.D === 1) L.set(p[0], p[1], PAL.gold[2]);
  else {
    // A brass buckle: a light frame round a dark prong.
    L.rect(p[0] * 2, p[1] * 2, 2, 2, PAL.gold[2]);
    L.set(p[0] * 2, p[1] * 2, PAL.gold[3]);
    L.set(p[0] * 2 + 1, p[1] * 2 + 1, PAL.gold[1]);
    // Stitching: a 1-px lighter line along the top of the belt.
    const a = c.T(tp(sk, -d.waistB, 0));
    const b = c.T(tp(sk, d.waistF - 2, 0));
    const F = new PixelBuffer(L.w, L.h).line(Math.round(a[0] * 2), Math.round(a[1] * 2), Math.round(b[0] * 2 + 1), Math.round(b[1] * 2), at(c.st.belt, 2));
    for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0 && (L.data[i] & 255) !== 0) L.data[i] = F.data[i];
  }
  return L.touch();
}

function drawArm(c: Ctx, shoulder: V, el: V, wr: V, far: boolean): PixelBuffer {
  const st = c.st;
  const d = st.dims;
  const L = layer(c);
  const s = cp(c, shoulder);
  const e = cp(c, el);
  const w = cp(c, wr);
  const shift = far ? -1 : 0;
  if (st.sleeveUpper === st.sleeveFore) {
    taper(c, L, s, e, d.armW[0], d.armW[1]);
    taper(c, L, e, w, d.foreW[0], d.foreW[1]);
    shadeLayer(L, st.sleeveUpper, sh(c, { shift }));
    if (c.D === 2) cuffLine(L, e, w, d.foreW[1], at(st.sleeveUpper, 1 + shift));
    return despeckle(L, undefined, c.D);
  }
  // Short sleeve: a bare arm, then a sleeve over the top half of the upper arm.
  const F = layer(c);
  taper(c, F, s, e, d.armW[0], d.armW[1]);
  taper(c, F, e, w, d.foreW[0], d.foreW[1]);
  shadeLayer(F, st.sleeveFore, sh(c, { shift }));
  const U = layer(c);
  const m = cp(c, add(shoulder, [el[0] - shoulder[0], el[1] - shoulder[1]], 0.5));
  taper(c, U, s, m, d.armW[0] + 1, d.armW[0] + 1);
  shadeLayer(U, st.sleeveUpper, sh(c, { shift }));
  if (c.D === 2) cuffLine(U, s, m, d.armW[0] + 1, at(st.sleeveUpper, 1 + shift));
  L.blit(F, 0, 0).blit(U, 0, 0);
  return despeckle(L, undefined, c.D);
}

/** 2×: a 1-px cuff fold across the end b of the segment a→b (sleeve hem). */
function cuffLine(L: PixelBuffer, a: V, b: V, width: number, col: Color): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  // 1.2 logical px back from the end, across the limb.
  const cx = (b[0] + 0.5 - ux * 1.2) * 2;
  const cy = (b[1] + 0.5 - uy * 1.2) * 2;
  const r = width;
  const F = new PixelBuffer(L.w, L.h).line(Math.round(cx - uy * r), Math.round(cy + ux * r), Math.round(cx + uy * r), Math.round(cy - ux * r), col);
  for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0 && (L.data[i] & 255) !== 0) L.data[i] = F.data[i];
  L.touch();
}

/** Armband: two pixels of accent colour across the upper arm. */
function drawArmband(c: Ctx, shoulder: V, el: V): PixelBuffer {
  const L = layer(c);
  const m1 = cp(c, add(shoulder, [el[0] - shoulder[0], el[1] - shoulder[1]], 0.45));
  const m2 = cp(c, add(shoulder, [el[0] - shoulder[0], el[1] - shoulder[1]], 0.6));
  thick(c, L, m1, m2, 3, c.st.accent[2]);
  if (c.D === 2) {
    // A light stripe along the band.
    const F = new PixelBuffer(L.w, L.h).line(m1[0] * 2 + 1, m1[1] * 2 + 1, m2[0] * 2 + 1, m2[1] * 2 + 1, at(c.st.accent, 3));
    for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0 && (L.data[i] & 255) !== 0) L.data[i] = F.data[i];
    L.touch();
  }
  return L;
}

/** Hand layer: the hand shape at the wrist, turned along the forearm. */
function drawHandLayer(c: Ctx, el: V, wr: V, shape: HandShape, far: boolean): PixelBuffer {
  const L = layer(c);
  const fore = angleTo(el, wr) + c.rot;
  // Templates point forward (angle 90). Clockwise quarter turns: (90 − angle) / 90.
  const q = Math.round((90 - fore) / 90);
  const w = cp(c, wr);
  const r = c.st.gloves;
  drawHand(L, shape, w[0], w[1], far ? [r[0], r[0], r[1], r[2]] : r, q, false, c.D);
  return L;
}

/** The head's look for the head module. */
function headStyleOf(c: Ctx): HeadStyle {
  const st = c.st;
  return {
    skin: st.skin,
    hair: st.hair,
    hairStyle: st.s.hairStyle,
    headgear: st.s.headgear,
    gear: st.gear,
    accent: st.accent,
    extras: st.s.face ?? [],
    hat: c.pose.hat,
    hatDy: c.pose.hatDy,
  };
}

/** A 2× head drawer: the head on the 2× grid, `HEAD_W·2 × HEAD_H·2`, NECK / HEAD_CENTER at 2× them. */
export type HeadHiDrawer = (s: HeadStyle, expr: Expression, opts?: { glint?: boolean }) => PixelBuffer;

/**
 * THE 2× HEAD HOOK. The 2× head buffer (density 2) for a style and an expression: exactly twice
 * the 1× head buffer (`HEAD_W × HEAD_H` → 36 × 38), the same logical layout, so the logical
 * pixels NECK and HEAD_CENTER are the 2 × 2 blocks at (2·NECK, 2·HEAD_CENTER). When
 * humanoid-head.ts exports `renderHeadHi(s: HeadStyle, expr: Expression): PixelBuffer`, that is
 * used; until then the 1× head is copied at 2× (nearest). Returns null for the fallback, so the
 * rig can tilt and enlarge the 1× head exactly as at 1× before doubling it.
 */
export function headLayerHi(s: HeadStyle, expr: Expression, opts?: { glint?: boolean }): PixelBuffer | null {
  const hi = (HeadModule as unknown as { renderHeadHi?: HeadHiDrawer }).renderHeadHi;
  if (typeof hi !== 'function') return null;
  const b = hi(s, expr, opts);
  if (b.w !== HEAD_W * 2 || b.h !== HEAD_H * 2) throw new Error(`renderHeadHi: ${b.w}×${b.h}, expected ${HEAD_W * 2}×${HEAD_H * 2}`);
  return b;
}

function drawHead(c: Ctx): { buf: PixelBuffer; center: V } {
  const pose = c.pose;
  const hs = headStyleOf(c);
  const expr = pose.expr ?? 'normal';
  const head = renderHead(hs, expr);
  const L = layer(c);
  const hx = pose.head?.dx ?? 0;
  const hy = pose.head?.dy ?? 0;
  const neck = c.T([c.sk.neck[0] + hx, c.sk.neck[1] + hy + 1]);
  const tilt = (pose.head?.tilt ?? 0) + c.rot;
  let buf = head;
  let nx = NECK[0];
  let ny = NECK[1];
  let cx = HEAD_CENTER[0];
  let cy = HEAD_CENTER[1];
  const tilted = Math.abs(tilt) >= 8;
  if (tilted) {
    buf = head.rotated(tilt * DEG);
    const c0: V = [head.w / 2, head.h / 2];
    const mapP = (p: readonly [number, number]): V => {
      const r = rotateAbout([p[0] + 0.5, p[1] + 0.5], c0, tilt);
      return [r[0] - c0[0] + buf.w / 2 - 0.5, r[1] - c0[1] + buf.h / 2 - 0.5];
    };
    [nx, ny] = mapP(NECK);
    [cx, cy] = mapP(HEAD_CENTER);
  }
  if (pose.headScale === 2) {
    // Scale2x keeps the palette and rounds the stair-steps; the neck point scales with it.
    buf = buf.scale2x();
    nx *= 2;
    ny *= 2;
    cx *= 2;
    cy *= 2;
  }
  const ox = Math.round(neck[0] - nx);
  const oy = Math.round(neck[1] - ny);
  if (c.D === 1) L.blit(buf, ox, oy);
  else {
    // A tilted head drops the 1-px eye highlight (it would drift off the pupil when rotated).
    const hi = headLayerHi(hs, expr, tilted ? { glint: false } : undefined);
    if (!hi) L.blit(buf.scaled(2), ox * 2, oy * 2);
    else {
      // The 2× head, tilted and enlarged on the 2× grid about the same logical centre as the 1×.
      let hb = tilted ? hi.rotated(tilt * DEG, { align: 2 }) : hi;
      if (pose.headScale === 2) hb = hb.scale2x();
      L.blit(hb, ox * 2 + buf.w - hb.w / 2, oy * 2 + buf.h - hb.h / 2);
    }
  }
  return { buf: L, center: [ox + cx, oy + cy] };
}

/**
 * Place a 2× copy `hi` of a 1× part `lo` whose top-left went to (ox, oy) on the 1× canvas: both
 * share the centre (rotations about the centre with `align: 2` keep it on the same logical point).
 */
function blitHi(L: PixelBuffer, hi: PixelBuffer, lo: PixelBuffer, ox: number, oy: number): void {
  L.blit(hi, ox * 2 + lo.w - hi.w / 2, oy * 2 + lo.h - hi.h / 2);
}

function drawGun(c: Ctx, g: GunPlacement): { buf: PixelBuffer; muzzle: V } {
  const placed = placedGun({ ...g, angle: g.angle + c.rot });
  const L = layer(c);
  const at0 = c.T(g.grip);
  const ox = Math.round(at0[0] - placed.grip[0]);
  const oy = Math.round(at0[1] - placed.grip[1]);
  if (c.D === 1) L.blit(placed.buf, ox, oy);
  else blitHi(L, turnedHi(gunArtHi(g.kind), g.angle + c.rot), placed.buf, ox, oy);
  return { buf: L, muzzle: [ox + placed.muzzle[0], oy + placed.muzzle[1]] };
}

/** A 2× part turned like its 1× twin: exact quarter turns, else a rotation on the logical grid. */
function turnedHi(b: PixelBuffer, deg: number): PixelBuffer {
  return b.rotated(deg * DEG, { align: 2 });
}

function drawHeld(c: Ctx, el: V, wr: V, item: HeldItem): { buf: PixelBuffer; at: V } | null {
  if (item === 'none') return null;
  const L = layer(c);
  const fore = angleTo(el, wr);
  const w = c.T(wr);
  if (item === 'grenade' || item === 'snack' || item === 'gift') {
    const g = item === 'grenade' ? grenadeArt() : item === 'snack' ? snackArt() : giftArt();
    const dir = dirOf(fore + c.rot);
    const cx = w[0] + dir[0] * 2;
    const cy = w[1] + dir[1] * 2 - 1;
    const ox = Math.round(cx - g.w / 2);
    const oy = Math.round(cy - g.h / 2);
    if (c.D === 1) L.blit(g, ox, oy);
    else L.blit(heldArtHi(item), ox * 2, oy * 2);
    return { buf: L, at: [cx, cy] };
  }
  if (isProp(item)) {
    // A knife-look prop: its grip pixel in the fist, turned to heldAngle (+ the figure's turn).
    const art = propArt(item);
    const ang = (c.pose.heldAngle ?? fore - 90) + c.rot;
    const buf = art.buf.rotated(ang * DEG);
    const c0: V = [art.buf.w / 2, art.buf.h / 2];
    const mapP = (p: readonly [number, number]): V => {
      const r = rotateAbout([p[0] + 0.5, p[1] + 0.5], c0, ang);
      return [r[0] - c0[0] + buf.w / 2 - 0.5, r[1] - c0[1] + buf.h / 2 - 0.5];
    };
    const g = mapP(art.grip);
    const t = mapP(art.tip);
    const ox = Math.round(w[0] - g[0]);
    const oy = Math.round(w[1] - g[1]);
    if (c.D === 1) L.blit(buf, ox, oy);
    else blitHi(L, turnedHi(propArtHi(item), ang), buf, ox, oy);
    return { buf: L, at: [ox + t[0], oy + t[1]] };
  }
  // Knife: the handle sits in the fist, the blade points along heldAngle (0 = forward).
  const k = knifeArt();
  const ang = c.pose.heldAngle ?? fore - 90;
  const kb = k.rotated(ang * DEG);
  const dir: V = [Math.cos(ang * DEG), Math.sin(ang * DEG)];
  const cx = w[0] + dir[0] * 3;
  const cy = w[1] + dir[1] * 3;
  const ox = Math.round(cx - kb.w / 2);
  const oy = Math.round(cy - kb.h / 2);
  if (c.D === 1) L.blit(kb, ox, oy);
  else blitHi(L, turnedHi(knifeArtHi(), ang), kb, ox, oy);
  return { buf: L, at: [w[0] + dir[0] * 7, w[1] + dir[1] * 7] };
}

function drawBackpack(c: Ctx, radio: boolean): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const L = layer(c);
  poly(L, c, [tp(sk, -d.chestB - 3, 1), tp(sk, -d.chestB + 1, 1), tp(sk, -d.chestB + 1, 8), tp(sk, -d.chestB - 3, 7)]);
  shadeLayer(L, c.st.gear, sh(c, { lo: 1 }));
  if (c.D === 2) {
    // A flap seam and a strap buckle.
    fineLine(c, L, cp(c, tp(sk, -d.chestB - 3, 5)), cp(c, tp(sk, -d.chestB + 1, 5)), at(c.st.gear, 0));
    const b = cp(c, tp(sk, -d.chestB - 1, 4));
    L.set(b[0] * 2 + 1, b[1] * 2 + 1, PAL.gold[2]);
  }
  if (radio) {
    const a = cp(c, tp(sk, -d.chestB - 2, 8));
    const b = cp(c, tp(sk, -d.chestB - 4, 17));
    line(c, L, a, b, PAL.steel[1]);
    dot(c, L, b[0], b[1], c.st.accent[2]);
  }
  return L;
}

function drawScarf(c: Ctx): { back: PixelBuffer; front: PixelBuffer } {
  const sk = c.sk;
  const d = c.st.dims;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const fl = c.pose.flutter;
  const back = layer(c);
  if (fl === undefined) {
    // At rest the tail hangs down the back.
    poly(back, c, [tp(sk, -1, H), tp(sk, -d.chestB - 1, H - 1), tp(sk, -d.chestB - 2, H - 8), tp(sk, -d.chestB, H - 9), tp(sk, -d.chestB + 1, H - 2)]);
  } else {
    // Running: the tail streams out behind and waves.
    const wave = [0, 1, 0, -1][Math.round(fl) & 3];
    poly(back, c, [
      tp(sk, -1, H - 1),
      tp(sk, -2, H),
      tp(sk, -d.chestB - 5, H - 2 + wave),
      tp(sk, -d.chestB - 9, H - 4 - wave),
      tp(sk, -d.chestB - 8, H - 6 - wave),
      tp(sk, -d.chestB - 4, H - 4),
    ]);
  }
  shadeLayer(back, c.st.accent, sh(c, { shift: -1 }));
  if (c.D === 2 && fl !== undefined) {
    const wave = [0, 1, 0, -1][Math.round(fl) & 3];
    fineLine(c, back, cp(c, tp(sk, -3, H - 1)), cp(c, tp(sk, -d.chestB - 7, H - 4 - wave)), at(c.st.accent, 0));
  }
  const front = layer(c);
  poly(front, c, [tp(sk, -2, H + 1), tp(sk, d.chestF - 1, H + 1), tp(sk, d.chestF - 1, H - 1), tp(sk, -2, H - 1)]);
  shadeLayer(front, c.st.accent, sh(c));
  if (c.D === 2) {
    // The wrap: a fold line across the scarf.
    fineLine(c, front, cp(c, tp(sk, 0, H + 1)), cp(c, tp(sk, 1, H - 1)), at(c.st.accent, 1));
  }
  return { back, front };
}

/** Two belt pouches, front and back; at 2× with flaps and press studs. */
function pouchPair(c: Ctx, ramp: Ramp): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const L = layer(c);
  poly(L, c, [tp(sk, d.waistF - 2, 1), tp(sk, d.waistF, 1), tp(sk, d.waistF, -2), tp(sk, d.waistF - 2, -2)]);
  poly(L, c, [tp(sk, -d.waistB - 1, 1), tp(sk, -d.waistB + 1, 1), tp(sk, -d.waistB + 1, -2), tp(sk, -d.waistB - 1, -2)]);
  shadeLayer(L, ramp, sh(c, { lo: 1 }));
  if (c.D === 2) {
    for (const a of [d.waistF - 2, -d.waistB - 1]) {
      const p = cp(c, tp(sk, a, 0));
      const q = cp(c, tp(sk, a + 2, 0));
      for (let x = p[0] * 2; x <= q[0] * 2 + 1; x++) if ((L.get(x, p[1] * 2 + 1) & 255) !== 0) L.set(x, p[1] * 2 + 1, ramp[0]);
      const s = cp(c, tp(sk, a + 1, 0));
      if ((L.get(s[0] * 2, s[1] * 2 + 2) & 255) !== 0) L.set(s[0] * 2, s[1] * 2 + 2, at(ramp, 3));
    }
    L.touch();
  }
  return L;
}

function drawPouches(c: Ctx): PixelBuffer {
  return pouchPair(c, c.st.gear);
}

/** Leather tool pouches (belt colour) with a red-handled screwdriver in the front one. */
function drawToolbelt(c: Ctx): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const L = pouchPair(c, c.st.belt);
  const h1 = cp(c, tp(sk, d.waistF - 1, 2));
  const h2 = cp(c, tp(sk, d.waistF - 1, 3));
  dot(c, L, h1[0], h1[1], PAL.red[2]);
  dot(c, L, h2[0], h2[1], PAL.red[3]);
  if (c.D === 2) L.set(h2[0] * 2, h2[1] * 2, PAL.snow[3]);
  return L;
}

/** Two knitting needles poking up and back out of the satchel, red bead knobs. */
function drawSatchelNeedles(c: Ctx): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const L = layer(c);
  const pairs: ReadonlyArray<[V, V]> = [
    [tp(sk, -d.waistB - 2, 0), tp(sk, -d.waistB - 5, 5)],
    [tp(sk, -d.waistB, 0), tp(sk, -d.waistB - 2, 6)],
  ];
  for (const [a, b] of pairs) {
    const p = cp(c, a);
    const q = cp(c, b);
    line(c, L, p, q, PAL.steel[3]);
    dot(c, L, q[0], q[1], PAL.red[2]);
    if (c.D === 2) {
      // A bright 1-px glint down the needle and on the bead.
      L.line(p[0] * 2, p[1] * 2, q[0] * 2, q[1] * 2, PAL.steel[4]);
      L.rect(q[0] * 2, q[1] * 2, 2, 2, PAL.red[2]);
      L.set(q[0] * 2, q[1] * 2, PAL.red[3]);
    }
  }
  return L;
}

function drawBandolier(c: Ctx, color: Ramp, dots: boolean): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const L = layer(c);
  const a = cp(c, tp(sk, -d.chestB + 1, H - 1));
  const b = cp(c, tp(sk, d.waistF - 1, 1));
  thick(c, L, a, b, 2, color[1]);
  if (dots) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = Math.round(a[0] + (b[0] - a[0]) * t);
      const y = Math.round(a[1] + (b[1] - a[1]) * t);
      if (c.D === 1) L.set(x, y, PAL.gold[2]);
      else {
        // A brass cartridge with a lit tip.
        L.rect(x * 2, y * 2, 2, 2, PAL.gold[2]);
        L.set(x * 2, y * 2, PAL.gold[3]);
      }
    }
  }
  return L;
}

function drawBowtie(c: Ctx): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const L = layer(c);
  const p = cp(c, tp(sk, d.chestF - 2, H - 1));
  const a = c.st.accent;
  dot(c, L, p[0] - 1, p[1], a[1]);
  dot(c, L, p[0], p[1], a[2]);
  dot(c, L, p[0] + 1, p[1], a[1]);
  dot(c, L, p[0] - 1, p[1] - 1, a[1]);
  dot(c, L, p[0] + 1, p[1] + 1, a[1]);
  if (c.D === 2) {
    // The knot gets a highlight; each wing a fold.
    L.set(p[0] * 2, p[1] * 2, at(a, 3));
    L.set(p[0] * 2 - 1, p[1] * 2 + 1, a[0]);
    L.set(p[0] * 2 + 2, p[1] * 2, a[0]);
  }
  return L;
}

/** A thin tie from the collar down the shirt front: knot in the light accent, blade in the dark. */
function drawTie(c: Ctx): PixelBuffer {
  const d = c.st.dims;
  const sk = c.sk;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const L = layer(c);
  const a = c.st.accent;
  const top = cp(c, tp(sk, d.chestF - 2, H - 1));
  const bot = cp(c, tp(sk, d.chestF - 2, 2));
  line(c, L, top, bot, a[1]);
  dot(c, L, top[0], top[1], at(a, 2));
  if (c.D === 2) {
    // The blade widens to a point; the knot gets a fold.
    L.set(bot[0] * 2 - 1, bot[1] * 2, a[1]);
    L.set(bot[0] * 2, bot[1] * 2 + 2, a[0]);
    L.set(top[0] * 2 + 1, top[1] * 2 + 1, a[0]);
    fineLine(c, L, [top[0], top[1] + 1], [bot[0], bot[1]], a[0]);
    L.line(top[0] * 2 + 1, top[1] * 2 + 2, bot[0] * 2 + 1, bot[1] * 2, a[1]);
  }
  return L;
}

/** The leaf emblem colours (light green leaf, a dark vein). */
const LEAF = [PAL.green[1], PAL.green[4]] as const;

/** A short cape behind the back: hangs to the waist at rest, streams out and waves with `flutter`. */
function drawCape(c: Ctx): { back: PixelBuffer; clasp: PixelBuffer } {
  const sk = c.sk;
  const d = c.st.dims;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const fl = c.pose.flutter;
  const back = layer(c);
  const B = -d.chestB;
  let leaf: V;
  let fold: [V, V];
  if (fl === undefined) {
    // At rest it hangs straight down the back to the belt, a notched hem.
    poly(back, c, [tp(sk, 1, H + 1), tp(sk, B - 1, H), tp(sk, B - 2, 0), tp(sk, B - 1, -1), tp(sk, B, 1), tp(sk, B + 1, 0), tp(sk, B + 1, H - 3)]);
    leaf = tp(sk, B - 1, H - 4);
    fold = [tp(sk, B, H - 1), tp(sk, B - 1, 1)];
  } else {
    // Streaming back like a flag from the shoulders: a wedge with a notched, waving hem.
    const wave = [0, 1, 0, -1][Math.round(fl) & 3];
    poly(back, c, [
      tp(sk, 1, H + 1),
      tp(sk, B - 2, H + 1),
      tp(sk, B - 9, H - 1 + wave),
      tp(sk, B - 9, H - 3 + wave),
      tp(sk, B - 6, H - 4),
      tp(sk, B - 7, 1 - wave),
      tp(sk, B - 3, 2),
      tp(sk, B + 1, 2),
      tp(sk, B + 1, H - 3),
    ]);
    leaf = tp(sk, B - 4, H - 2);
    fold = [tp(sk, B - 1, H - 1), tp(sk, B - 6, 3)];
  }
  shadeLayer(back, c.st.accent, sh(c, { shift: -1 }));
  // A fold down the cloth (only on cape pixels).
  {
    const F = layer(c);
    if (c.D === 1) line(c, F, cp(c, fold[0]), cp(c, fold[1]), at(c.st.accent, 0));
    else fineLine(c, F, cp(c, fold[0]), cp(c, fold[1]), at(c.st.accent, 0));
    for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0 && (back.data[i] & 255) !== 0) back.data[i] = F.data[i];
    back.touch();
  }
  const p = cp(c, leaf);
  const has = (x: number, y: number): boolean => c.D === 1 ? (back.get(x, y) & 255) !== 0 : (back.get(x * 2, y * 2) & 255) !== 0;
  if (has(p[0], p[1]) && has(p[0] + 1, p[1] - 1)) {
    dot(c, back, p[0], p[1], LEAF[1]);
    dot(c, back, p[0] + 1, p[1] - 1, LEAF[1]);
    if (c.D === 2) {
      // A pointed leaf with a dark midrib.
      back.set(p[0] * 2 + 1, p[1] * 2 + 1, LEAF[0]);
      back.set(p[0] * 2 + 2, p[1] * 2, LEAF[0]);
      back.set(p[0] * 2 - 1, p[1] * 2 + 1, LEAF[1]);
      back.set(p[0] * 2 + 3, p[1] * 2 - 2, LEAF[1]);
      back.touch();
    }
  }
  // The cloth over the near shoulder and the clasp: a small gold stud at the collar.
  const clasp = layer(c);
  poly(clasp, c, [tp(sk, B, H + 1), tp(sk, 1, H + 1), tp(sk, 1, H), tp(sk, B + 1, H - 1)]);
  shadeLayer(clasp, c.st.accent, sh(c));
  const q = cp(c, tp(sk, 0, H));
  dot(c, clasp, q[0], q[1], PAL.gold[2]);
  if (c.D === 2) clasp.set(q[0] * 2, q[1] * 2, PAL.gold[3]);
  return { back, clasp };
}

function drawEpaulette(c: Ctx, shoulder: V): PixelBuffer {
  const L = layer(c);
  const p = cp(c, shoulder);
  if (c.D === 1) {
    L.hline(p[0] - 2, p[0] + 2, p[1] - 1, PAL.gold[2]);
    L.hline(p[0] - 1, p[0] + 1, p[1] - 2, PAL.gold[3]);
    return L;
  }
  L.rect((p[0] - 2) * 2, (p[1] - 1) * 2, 10, 2, PAL.gold[2]);
  L.rect((p[0] - 1) * 2, (p[1] - 2) * 2, 6, 2, PAL.gold[3]);
  // Fringe: 1-px threads along the lower edge.
  for (let x = (p[0] - 2) * 2; x < (p[0] + 3) * 2; x += 2) L.set(x, p[1] * 2 - 1, PAL.gold[1]);
  return L;
}

function drawSatchel(c: Ctx): { strap: PixelBuffer; bag: PixelBuffer } {
  const d = c.st.dims;
  const sk = c.sk;
  const H = d.torsoH - (c.pose.hunch ?? 0);
  const strap = layer(c);
  const a = cp(c, tp(sk, d.chestF - 2, H - 1));
  const b = cp(c, tp(sk, -d.waistB, 0));
  line(c, strap, a, b, c.st.belt[1]);
  if (c.D === 2) strap.line(a[0] * 2, a[1] * 2, b[0] * 2, b[1] * 2, at(c.st.belt, 2));
  const bag = layer(c);
  poly(bag, c, [tp(sk, -d.waistB - 3, 1), tp(sk, -d.waistB + 1, 1), tp(sk, -d.waistB + 1, -4), tp(sk, -d.waistB - 3, -4)]);
  shadeLayer(bag, c.st.belt, sh(c));
  if (c.D === 2) {
    // The flap edge and its brass clasp.
    fineLine(c, bag, cp(c, tp(sk, -d.waistB - 3, -1)), cp(c, tp(sk, -d.waistB + 1, -1)), c.st.belt[0]);
    const k = cp(c, tp(sk, -d.waistB - 1, -1));
    bag.rect(k[0] * 2, k[1] * 2, 2, 2, PAL.gold[2]);
    bag.set(k[0] * 2, k[1] * 2, PAL.gold[3]);
  }
  return { strap, bag };
}

// ------------------------------------------------------------------------------------ render

export interface HumanFrame extends Frame {
  readonly pts: Readonly<Record<string, readonly [number, number]>>;
}

/** An untrimmed render: the canvas, the anchor and the points (1× canvas px). */
interface Canvas {
  buf: PixelBuffer;
  anchor: V;
  pts: Record<string, [number, number]>;
}

/**
 * Render a figure. `part` 'full' draws everything (anchored at the feet), 'lower' the legs and
 * pelvis (feet anchor, `hip` point), 'upper' the torso, arms, head and gun (pelvis anchor).
 * `density` 2 draws the same figure on the 2× grid: a density-2 frame with exactly the logical
 * geometry (size, anchor, points) of the 1× frame (docs/ART_GUIDE.md "2x art (mission ams)").
 */
export function renderHuman(style: HumanStyle, pose: Pose = {}, part: RenderPart = 'full', density: Density = 1): HumanFrame {
  const key = JSON.stringify([part, pose]);
  let g = geometryCache.get(style)?.get(key);
  if (density === 1 || !g) {
    const lo = renderCanvas(style, pose, part, 1);
    const f1 = trimFrame(lo.buf, lo.anchor, lo.pts);
    g = { x: lo.anchor[0] - f1.ox, y: lo.anchor[1] - f1.oy, w: f1.buf.w, h: f1.buf.h, ox: f1.ox, oy: f1.oy, pts: f1.pts };
    let m = geometryCache.get(style);
    if (!m) geometryCache.set(style, (m = new Map()));
    m.set(key, g);
    if (density === 1) return f1;
  }
  // The 2× canvas covers the 1× frame's rectangle plus a margin (the finer 2× edges may reach a
  // little past it); the result is that rectangle doubled, so the logical geometry is the 1× one.
  const M = 2;
  const hi = renderCanvas(style, pose, part, 2, [g.x - M, g.y - M, g.w + 2 * M, g.h + 2 * M]);
  const buf = hi.buf.crop(M * 2, M * 2, g.w * 2, g.h * 2);
  return { buf, ox: g.ox, oy: g.oy, pts: g.pts, density: 2 };
}

/** Where a 1× render lies on the working canvas, and its frame geometry. */
interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  pts: Readonly<Record<string, readonly [number, number]>>;
}

/**
 * Geometry of every 1× render by style and (part, pose): a 2× render of a figure already drawn at
 * 1× (the 1× sprites are generated at boot) then skips drawing it again.
 */
const geometryCache = new WeakMap<HumanStyle, Map<string, Geometry>>();

/**
 * Draw the figure on a canvas: the whole working canvas, or only `region` [x, y, w, h] of it
 * (1× grid; the 2× render). Joint pixels are always found on the 1× grid, so both densities
 * place every part identically.
 */
function renderCanvas(style: HumanStyle, pose: Pose, part: RenderPart, D: Density, region: readonly [number, number, number, number] = [0, 0, CW, CH]): Canvas {
  const st = resolve(style);
  const sk = solve(st, pose);
  const rot = pose.rot ?? 0;
  const dx = pose.dx ?? 0;
  const dy = pose.dy ?? 0;
  const pivot = sk.pelvis;
  const T = (p: V): V => {
    const r = rotateAbout(p, pivot, rot);
    return [r[0] + dx + OX - region[0], r[1] + dy + OY - region[1]];
  };
  const c: Ctx = { st, sk, pose, T, rot, D, W: region[2], H: region[3] };
  const comp = new Composer(c.W * D, c.H * D, D);
  const upper = part !== 'lower';
  const lower = part !== 'upper';
  const acc = st.acc;
  const pts: Record<string, [number, number]> = {};

  // Back to front.
  let cape: { back: PixelBuffer; clasp: PixelBuffer } | null = null;
  if (upper && acc.has('cape')) {
    cape = drawCape(c);
    comp.add(cape.back, { ramp: st.accent });
  }
  if (upper && (acc.has('backpack') || acc.has('radio'))) comp.add(drawBackpack(c, acc.has('radio')), { ramp: st.gear });
  let scarf: { back: PixelBuffer; front: PixelBuffer } | null = null;
  if (upper && acc.has('scarf')) {
    scarf = drawScarf(c);
    comp.add(scarf.back, { ramp: st.accent });
  }
  if (upper) {
    if (sk.offGun) comp.add(drawGun(c, sk.offGun).buf, { ramp: PAL.steel });
    comp.add(drawArm(c, sk.shF, sk.elF, sk.wrF, true), { ramp: st.sleeveUpper });
    comp.add(drawHandLayer(c, sk.elF, sk.wrF, sk.handF, true), { ramp: st.gloves });
  }
  if (lower) {
    comp.add(drawLeg(c, sk.hipF, sk.kneeF, sk.ankleF, true, false), { ramp: st.pants });
    comp.add(drawBoot(c, sk.ankleF, sk.footF, true), { ramp: st.boots });
    comp.add(drawLeg(c, sk.hipN, sk.kneeN, sk.ankleN, false, true), { ramp: st.pants });
    comp.add(drawBoot(c, sk.ankleN, sk.footN, false), { ramp: st.boots });
  }
  let head: { buf: PixelBuffer; center: V } | null = null;
  if (upper) {
    if (style.topType === 'coat') comp.add(drawCoatTails(c), { ramp: st.top });
    if (acc.has('satchel')) {
      const s = drawSatchel(c);
      if (acc.has('needles')) comp.add(drawSatchelNeedles(c), { ramp: PAL.steel });
      comp.add(s.bag, { ramp: st.belt });
      comp.add(drawTorso(c), { ramp: st.top });
      comp.paint(s.strap, st.belt[0]);
    } else {
      comp.add(drawTorso(c), { ramp: st.top });
    }
    if (acc.has('ammo-belt')) comp.paint(drawBandolier(c, PAL.brown, true), PAL.brown[0]);
    if (acc.has('cross-belt')) comp.paint(drawBandolier(c, PAL.snow, false), PAL.snow[0]);
    if (acc.has('tie')) comp.paint(drawTie(c), st.accent[0]);
    comp.add(drawBelt(c), { ramp: st.belt });
    if (acc.has('pouches')) comp.add(drawPouches(c), { ramp: st.gear });
    if (acc.has('toolbelt')) comp.add(drawToolbelt(c), { ramp: st.belt });
    head = drawHead(c);
    // A near arm whose hand or forearm would cross the face goes behind the head, so faces
    // stay readable. Arms raised above the head stay in front (they only cross the hair).
    const nk = sk.neck;
    const inFace = (p: V): boolean => p[0] >= nk[0] && p[0] <= nk[0] + 6 && p[1] >= nk[1] - 9 && p[1] <= nk[1] - 1;
    const mid: V = [(sk.elN[0] + sk.wrN[0]) / 2, (sk.elN[1] + sk.wrN[1]) / 2];
    const raised = inFace(sk.wrN) || inFace(mid);
    const held = drawHeld(c, sk.elN, sk.wrN, pose.held ?? 'none');
    const nearArm = (): void => {
      if (sk.gun) {
        const g = drawGun(c, sk.gun);
        comp.add(g.buf, { ramp: PAL.steel });
        pts.muzzle = [g.muzzle[0], g.muzzle[1]];
      }
      comp.add(drawArm(c, sk.shN, sk.elN, sk.wrN, false), { ramp: st.sleeveUpper });
      if (acc.has('armband')) comp.paint(drawArmband(c, sk.shN, sk.elN), st.accent[0]);
      const prop = pose.held !== undefined && isProp(pose.held) ? pose.held : null;
      if (held && pose.held === 'knife') comp.add(held.buf, { ramp: PAL.steel });
      else if (held && prop) comp.add(held.buf, { ramp: propArt(prop).ramp });
      comp.add(drawHandLayer(c, sk.elN, sk.wrN, sk.handN, false), { ramp: st.gloves });
      if (held && pose.held !== 'knife' && !prop) comp.add(held.buf, { ramp: PAL.olive });
    };
    const headAndNeck = (): void => {
      comp.add((head as { buf: PixelBuffer }).buf, { ramp: st.skin });
      if (scarf) comp.add(scarf.front, { ramp: st.accent });
      if (cape) comp.add(cape.clasp, { ramp: st.accent });
      if (acc.has('bowtie')) comp.paint(drawBowtie(c), st.accent[0]);
      if (acc.has('epaulettes')) comp.paint(drawEpaulette(c, sk.shN), PAL.gold[0]);
    };
    if (raised) {
      nearArm();
      headAndNeck();
    } else {
      headAndNeck();
      nearArm();
    }
    const hand = held ? held.at : c.T(sk.wrN);
    pts.hand = [hand[0], hand[1]];
    pts.head = [head.center[0], head.center[1]];
  }
  // Helium Head (GDD §4.13): the big head gets a pink rim (the outline's weight) instead of ink.
  const before = upper && pose.headScale === 2 && head ? opaqueMask(comp.buf) : null;
  const buf = comp.finish(INK);
  if (before && head) pinkRim(buf, before, head.buf, D);

  // Anchor: feet centre (full / lower) or the pelvis (upper).
  const pel = cp(c, sk.pelvis);
  let anchor: V = part === 'upper' ? pel : [OX, OY];
  // A grounded pose turned by `rot` (falling, lying) was solved upright, so after the turn about
  // the pelvis it no longer touches the ground: rest its lowest pixel on the ground line again
  // (then `dy` as asked), so corpses lie ON the floor instead of floating above it. (At 2× the
  // 1× render decides: renderHuman takes the anchor from it.)
  if (part !== 'upper' && pose.grounded !== false && rot !== 0 && D === 1) {
    const b = buf.trimBounds();
    if (b) {
      const lowest = b.y + b.h - 1;
      const target = OY - 1 + dy;
      anchor = [OX, OY - (target - lowest)];
    }
  }
  if (part !== 'upper') pts.hip = [pel[0], pel[1]];
  return { buf, anchor, pts };
}

/** Colour of the Helium Head's rim. */
export const HELIUM_RIM = PAL.pink[1];

function opaqueMask(b: PixelBuffer): Uint8Array {
  const m = new Uint8Array(b.w * b.h);
  for (let i = 0; i < m.length; i++) m[i] = (b.data[i] & 255) !== 0 ? 1 : 0;
  return m;
}

/**
 * Recolour the outline pixels (opaque now, empty `before`) that touch the head layer; at 2× also
 * the outline pixels behind those (the rim keeps the outline's 2-px weight).
 */
function pinkRim(buf: PixelBuffer, before: Uint8Array, head: PixelBuffer, D: Density): void {
  const { w, h, data } = buf;
  const hd = head.data;
  const isHead = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && (hd[y * w + x] & 255) !== 0;
  const rim = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (before[i] || (data[i] & 255) === 0) continue;
      if (isHead(x - 1, y) || isHead(x + 1, y) || isHead(x, y - 1) || isHead(x, y + 1)) {
        data[i] = HELIUM_RIM;
        rim[i] = 1;
      }
    }
  }
  if (D === 2) {
    const isRim = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && rim[y * w + x] === 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (before[i] || rim[i] || (data[i] & 255) === 0 || (hd[i] & 255) !== 0) continue;
        if (isRim(x - 1, y) || isRim(x + 1, y) || isRim(x, y - 1) || isRim(x, y + 1) || isRim(x - 1, y - 1) || isRim(x + 1, y - 1) || isRim(x - 1, y + 1) || isRim(x + 1, y + 1)) {
          data[i] = HELIUM_RIM;
        }
      }
    }
  }
  buf.touch();
}

/** Crop to the opaque pixels; anchor and points become relative to the anchor. */
function trimFrame(buf: PixelBuffer, anchor: V, pts: Record<string, [number, number]>): HumanFrame {
  const b = buf.trimBounds() ?? { x: anchor[0], y: anchor[1], w: 1, h: 1 };
  const out = buf.crop(b.x, b.y, b.w, b.h);
  const rel: Record<string, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(pts)) rel[k] = [Math.round(p[0] - anchor[0]), Math.round(p[1] - anchor[1])];
  return { buf: out, ox: anchor[0] - b.x, oy: anchor[1] - b.y, pts: rel };
}

/**
 * Stack a legs frame and a torso frame the way the game draws them (torso anchor on the legs'
 * hip point). For previews, portraits and tests. Both frames must have the same density (the
 * result has it too).
 */
export function stackFrames(legs: Frame, torso: Frame): Frame {
  const d = legs.density ?? 1;
  const hip = legs.pts?.hip ?? [0, 0];
  const lw = legs.buf.w / d;
  const lh = legs.buf.h / d;
  const tw = torso.buf.w / d;
  const th = torso.buf.h / d;
  const left = Math.min(-legs.ox, hip[0] - torso.ox);
  const top = Math.min(-legs.oy, hip[1] - torso.oy);
  const right = Math.max(lw - legs.ox, hip[0] - torso.ox + tw);
  const bottom = Math.max(lh - legs.oy, hip[1] - torso.oy + th);
  const out = new PixelBuffer((right - left) * d, (bottom - top) * d);
  out.blit(legs.buf, (-legs.ox - left) * d, (-legs.oy - top) * d);
  out.blit(torso.buf, (hip[0] - torso.ox - left) * d, (hip[1] - torso.oy - top) * d);
  const pts: Record<string, readonly [number, number]> = { hip: [hip[0], hip[1]] };
  for (const [k, p] of Object.entries(torso.pts ?? {})) pts[k] = [p[0] + hip[0], p[1] + hip[1]];
  const f: Frame = { buf: out, ox: -left, oy: -top, pts };
  return d === 1 ? f : { ...f, density: d };
}
