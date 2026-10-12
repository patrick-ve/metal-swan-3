/**
 * SWAN-3 art rig, part 3: the body (docs/design/swan-mount/look.md §3–§8, §10, §12).
 *
 * `renderBody(style, pose)` draws one body frame — far wing, far leg, tail, hull with its trim,
 * seat pad, handles, near leg, near wing (and, for self-contained strips, the neck and head) —
 * and, for ridden strips, the matching `-front` overlay: the near wing (front-layer poses) and
 * the near flank of the hull under the seat, which hide the rider's hips (look.md §7).
 *
 * Geometry is in rest coordinates (look.md §3) and goes through the frame transform: tilt about
 * the `hull` point, then the hull offset. Legs are solved with two-bone IK from the hip bearings
 * to the foot targets; the joint bends backward (a bird's ankle, look.md §3.6). Every named
 * point is computed with the same transform, so art and points never drift apart (§8).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { bayer } from '../../../art/paint';
import type { NeckSpec, SwanColour } from './head.art';
import { drawCollar, drawNeck } from './head.art';
import type { Harvest, Layer, Pt, V } from './kit.art';
import {
  OWN,
  OX,
  OY,
  Stack,
  Xf,
  add,
  along,
  disc,
  dot,
  harvest,
  len,
  lerp2,
  line,
  poly,
  recolor,
  rot,
  samplePolyline,
  shade,
  sub,
  take,
  tangentAt,
  taper,
  thick,
  unit,
} from './kit.art';

// ------------------------------------------------------------------------------------ types

/** Paint variant: colour scheme and m3's knitted socks (look.md §12). */
export interface SwanStyle {
  colour: SwanColour;
  socks: boolean;
}

/**
 * Foot state (look.md §5.5): S spread, S15 / S20 spread with the toes up (heel strike, skid),
 * P push (on the toe tips, heel up 25°), H half-folded, F folded (toes down 40°).
 */
export type FootState = 'S' | 'S15' | 'S20' | 'P' | 'H' | 'F';

/** A foot joint target (body space, or hull space with `feetOnHull`) and its state. */
export interface Foot {
  x: number;
  y: number;
  s: FootState;
  /** Shank rod out n px (0..3). */
  piston?: number;
}

/** Leg mode (look.md §3.6): drumstick + shank lengths; T = stowed behind the hull. */
export type LegMode = 'L' | 'M' | 'S' | 'W' | 'T';

/** Wing poses of look.md §5.3. */
export type WingPose = 'FOLD' | 'LIFT' | 'HALF' | 'UP' | 'MID' | 'DOWN' | 'SPREAD' | 'BRAKE' | 'BUSK' | 'BLAST' | 'FLAT' | 'LIMP';

export interface Wing {
  p: WingPose;
  /** LIFT n: the rear half (x < −14) raised n px. */
  lift?: number;
  /** Primary blade tips moved n px up (+) or down (−): breathing, trembling. */
  tips?: number;
}

/** A body frame (one row of the frame tables, look.md §10). */
export interface BodyPose {
  dx?: number;
  dy: number;
  /** Degrees, + = nose down, about the `hull` point. */
  tilt: number;
  /** Extra whole-body turn (tumble, dazed, right). */
  roll?: number;
  near?: Foot;
  far?: Foot;
  /** Foot targets are hull-attached (rolled frames: legs move with the body). */
  feetOnHull?: boolean;
  legs: LegMode;
  wingN: Wing;
  wingF: Wing;
  /** Tail tip lift (px, + = up). */
  tail?: number;
  /** Rudder fin wag (px). */
  fin?: number;
  /** Honk: the breast pushes forward (px). */
  breast?: number;
  /** Swim posture: the surface line is y −16; parts under it use the water colours (§5.8). */
  water?: boolean;
  /** Handle stalks: up (default) or folded flat on the deck (low frames). */
  handles?: 'up' | 'fold';
  /** Ridden strip: build the `-front` overlay. */
  rider?: boolean;
  /** Crouch, waddle, slide: the rider lies flat, his hip 4 px under the deck. */
  low?: boolean;
  /** Self-contained strips: the neck and head drawn into the body frame. */
  neck?: NeckSpec;
  /** The neck's socket point when the body is rolled far (dazed: the neck flops on the ground). */
  neckFrom?: Pt;
  /** Extra named points (body space). */
  pts?: Readonly<Record<string, Pt>>;
  /** Cosmetic marks baked into the frame. */
  marks?: ReadonlyArray<'sparks' | 'sparks2' | 'foam' | 'foam2' | 'steam'>;
  /** Stowed legs (mode T): where the near toe tips peek out (default under the breast). */
  toes?: 'front' | 'back' | 'none';
  /** Rest the lowest pixel on the ground line (rolled frames: tumble, dazed, right). */
  ground?: boolean;
  /** No seat pad and handles (she lies on her back). */
  bare?: boolean;
}

export interface BodyOut {
  body: Frame;
  /** The `-front` overlay (ridden strips only). */
  front: Frame | null;
}

// ------------------------------------------------------------------------------------ constants

/** Leg lengths per mode: drumstick, shank (look.md §3.6). */
const LEGS: Readonly<Record<LegMode, readonly [number, number]>> = {
  L: [15, 17],
  M: [13, 15],
  S: [11, 12],
  W: [9, 10],
  T: [7, 8],
};

const HIP_N: Pt = [-4, -31];
const HIP_F: Pt = [-6, -32];

/** Named rest points (look.md §8.1). */
export const REST = {
  seat: [-4, -48] as Pt,
  neck: [16, -45] as Pt,
  hull: [-3, -38] as Pt,
  smoke: [-20, -50] as Pt,
  perch: [-26, -48] as Pt,
  wake: [-27, -34] as Pt,
} as const;

/** The surface line in water frames (look.md §5.8). */
export const SURFACE = -16;

/**
 * Hull polygon (rest), clockwise from the deck's rear end (look.md §5.1 with a rounder breast
 * and stern; keel row −30, so a parked keel rests on the ground line).
 */
function hullPoly(breast: number): Pt[] {
  const b = breast;
  return [
    [-26, -48],
    [12, -48],
    [15, -47],
    [18, -45],
    [19.6 + b * 0.6, -43],
    [20.6 + b, -40.5],
    [21 + b, -37.5],
    [20.8 + b, -35],
    [20 + b * 0.8, -33],
    [18.5 + b * 0.4, -31.3],
    [16.5, -30.3],
    [14, -30],
    [-14, -30],
    [-17, -30.4],
    [-20, -31.8],
    [-22.6, -34],
    [-24.6, -37],
    [-26, -40],
    [-26.8, -43],
    [-27, -45],
  ];
}

// ------------------------------------------------------------------------------------ wings

interface WingGeo {
  /** Leading edge, shoulder → tip (rest coordinates). */
  lead: readonly Pt[];
  /** Which side the blades hang on (a hint vector). */
  hint: Pt;
  /** 0 = folded (blades along the arm), 1 = fanned. */
  s: number;
  /** Depth of plate + blades (px). */
  c: number;
}

const NEAR_WINGS: Readonly<Record<WingPose, WingGeo>> = {
  FOLD: { lead: [[13, -48], [-6, -48], [-31, -44]], hint: [0, 1], s: 0, c: 10 },
  LIFT: { lead: [[13, -48], [-6, -48], [-31, -44]], hint: [0, 1], s: 0, c: 10 },
  HALF: { lead: [[13, -48], [-8, -49], [-34, -52]], hint: [0.2, 1], s: 0.15, c: 11 },
  UP: { lead: [[12, -48], [3, -66], [-12, -84]], hint: [-1, 0.4], s: 0.55, c: 13 },
  MID: { lead: [[12, -47], [-12, -48], [-40, -46]], hint: [0.15, 1], s: 0.6, c: 13 },
  DOWN: { lead: [[12, -47], [-2, -31], [-20, -14]], hint: [-1, -0.5], s: 0.5, c: 12 },
  SPREAD: { lead: [[12, -47], [-12, -45], [-40, -34]], hint: [0.2, 1], s: 0.8, c: 14 },
  BRAKE: { lead: [[12, -48], [10, -63], [2, -76]], hint: [-1, 0], s: 0.7, c: 13 },
  BUSK: { lead: [[12, -48], [0, -66], [-24, -68]], hint: [-0.2, 1], s: 0.35, c: 12 },
  BLAST: { lead: [[12, -48], [-4, -66], [-30, -74]], hint: [-0.3, 1], s: 1, c: 14 },
  FLAT: { lead: [[13, -40], [2, -40], [-6, -48], [-31, -44]], hint: [0, 1], s: 0, c: 8 },
  LIMP: { lead: [[12, -47], [-4, -38], [-24, -26]], hint: [0.3, 1], s: 0.3, c: 11 },
};

const FAR_WINGS: Readonly<Record<WingPose, WingGeo>> = {
  FOLD: { lead: [[12, -48], [-6, -53], [-18, -53], [-33, -46]], hint: [0, 1], s: 0, c: 10 },
  LIFT: { lead: [[12, -48], [-6, -53], [-18, -53], [-33, -46]], hint: [0, 1], s: 0, c: 10 },
  HALF: { lead: [[12, -48], [-8, -58], [-30, -62]], hint: [0.1, 1], s: 0.15, c: 11 },
  UP: { lead: [[12, -48], [-2, -68], [-20, -86]], hint: [-1, 0.4], s: 0.55, c: 13 },
  MID: { lead: [[12, -48], [-8, -62], [-30, -72]], hint: [-0.3, 1], s: 0.6, c: 13 },
  DOWN: { lead: [[12, -48], [-12, -54], [-36, -56]], hint: [0, 1], s: 0.5, c: 12 },
  SPREAD: { lead: [[12, -48], [-6, -66], [-26, -80]], hint: [-1, 0.5], s: 0.8, c: 14 },
  BRAKE: { lead: [[12, -48], [6, -64], [-6, -78]], hint: [-1, 0], s: 0.7, c: 13 },
  BUSK: { lead: [[12, -48], [-2, -68], [-28, -72]], hint: [-0.2, 1], s: 0.35, c: 12 },
  BLAST: { lead: [[12, -48], [4, -70], [-8, -88]], hint: [-1, 0.3], s: 1, c: 14 },
  FLAT: { lead: [[12, -47], [-6, -50], [-18, -50], [-33, -46]], hint: [0, 1], s: 0, c: 9 },
  LIMP: { lead: [[12, -47], [-12, -48], [-34, -44]], hint: [0, 1], s: 0.2, c: 11 },
};

/** Near-wing poses drawn behind the rider (look.md §5.3 cover rule). */
const BACK_POSES: ReadonlySet<WingPose> = new Set<WingPose>(['UP', 'BRAKE', 'BUSK', 'BLAST']);

/** Primary blade tips: navy bands (the Mute: steel). */
const TIP_IVORY = new Map<Color, Color>([
  [PAL.snow[3], PAL.navy[2]],
  [PAL.snow[2], PAL.navy[1]],
  [PAL.snow[1], PAL.navy[0]],
  [PAL.snow[0], PAL.navy[0]],
]);
const TIP_MUTE = new Map<Color, Color>([
  [PAL.snow[3], PAL.steel[3]],
  [PAL.snow[2], PAL.steel[2]],
  [PAL.snow[1], PAL.steel[1]],
  [PAL.snow[0], PAL.steel[1]],
]);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** A gold rivet (light dot, dark pixel below right) on an existing part. */
function rivet(st: Stack, p: Pt, owner?: number): void {
  st.detail(p[0], p[1], PAL.gold[3], owner);
  st.detail(p[0] + 1, p[1] + 1, PAL.gold[0], owner);
}

/**
 * One wing: four primary blades (navy tips), three secondary blades and the arm plate with
 * three gold rivets (look.md §5.3). Blades are separate parts, so their edges become steel
 * lines on the blade behind. Far wing: one shade darker.
 */
export function drawWing(st: Stack, xf: Xf, w: Wing, far: boolean, style: SwanStyle): void {
  const g = (far ? FAR_WINGS : NEAR_WINGS)[w.p];
  const lift = w.lift ?? 0;
  const lead: Pt[] = g.lead.map(([x, y]) => [x, y - lift * clamp01((-14 - x) / 10)] as const);
  const sm = samplePolyline(lead, 1);
  const Lw = sm.total;
  const nAt = (d: number): V => {
    const t = tangentAt(sm, d);
    const n: V = [t[1], -t[0]];
    return n[0] * g.hint[0] + n[1] * g.hint[1] >= 0 ? n : [-n[0], -n[1]];
  };
  // Rotating a blade by +sign degrees turns it toward the trailing side.
  const tm = tangentAt(sm, Lw * 0.5);
  const nm = nAt(Lw * 0.5);
  const r90 = rot(tm, 90);
  const sign = r90[0] * nm[0] + r90[1] * nm[1] > 0 ? 1 : -1;
  const shift = far ? -1 : 0;
  const tipMap = style.colour === 'mute' ? TIP_MUTE : TIP_IVORY;
  const owner = far ? OWN.farWing : OWN.nearWing;
  const T = along(sm, Lw);
  const up = w.tips ?? 0;
  // Primaries: the inner ones first, the leading one last (on top). Broad round-ended
  // plates that overlap like shingles, so their edges read as steel lines.
  for (let k = 3; k >= 0; k--) {
    const du = Lw * (0.38 + 0.05 * k);
    const root = add(along(sm, du), nAt(du), 2.5 + 1.6 * k);
    const back = Math.min(Lw * 0.3, 3 * k);
    const fold = add(along(sm, Lw - back), nAt(Lw - back), 2 + 1.8 * k);
    const fan = add(root, rot(sub(T, root), sign * k * 12), 1 - 0.06 * k);
    const tip = lerp2(fold, fan, g.s);
    tip[1] -= up * (1 - k * 0.15);
    const a = xf.pt(root);
    const b = xf.pt(tip);
    const L = take();
    taper(L, a, b, 6, 5, PAL.snow[2]);
    shade(L, PAL.snow, { shift });
    const ax = unit(sub(b, a));
    const bl = len(sub(b, a));
    recolor(L, (c, x, y) => (bl - ((x - a[0]) * ax[0] + (y - a[1]) * ax[1]) <= 2.5 ? (tipMap.get(c) ?? c) : c));
    st.put(L, owner, PAL.snow[0]);
  }
  // Secondaries: from the arm toward the trailing side; their round ends scallop the edge.
  for (let j = 2; j >= 0; j--) {
    const du = Lw * (0.08 + 0.13 * j);
    const tt = tangentAt(sm, du);
    const nn = nAt(du);
    const root = add(along(sm, du), nn, 3);
    const dir = unit(lerp2(rot(tt, sign * 14), rot(nn, -sign * 24), g.s));
    const tip = add(root, dir, g.c * (0.7 + 0.25 * g.s));
    const L = take();
    taper(L, xf.pt(root), xf.pt(tip), 7, 6, PAL.snow[2]);
    shade(L, PAL.snow, { shift });
    st.put(L, owner, PAL.snow[0]);
  }
  // The arm plate over the blade roots, with three gold rivets along its top edge.
  const end = Lw * 0.5;
  const steps = 10;
  const plate: V[] = [];
  for (let i = 0; i <= steps; i++) plate.push(xf.pt(along(sm, (end * i) / steps)));
  for (let i = steps; i >= 0; i--) {
    const d = (end * i) / steps;
    // Round front (the wrist knuckle), slimmer toward the hand.
    const depth = (i === 0 ? 5 : 8 - (2.5 * i) / steps) * Math.min(1, g.c / 10);
    plate.push(xf.pt(add(along(sm, d), nAt(d), depth)));
  }
  const L = take();
  poly(L, plate, PAL.snow[2]);
  shade(L, PAL.snow, { shift, glint: !far });
  st.put(L, owner, PAL.snow[0]);
  for (const f of [0.14, 0.3, 0.46]) {
    const d = end * f * 2;
    rivet(st, xf.pt(add(along(sm, d), nAt(d), 2)), owner);
  }
}

// ------------------------------------------------------------------------------------ legs

/** Two-bone IK: the joint between hip h and foot f, bent backward (look.md §3.6). */
export function ik(h: Pt, f: Pt, l1: number, l2: number): { joint: V; foot: V } {
  const dx = f[0] - h[0];
  const dy = f[1] - h[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const dc = Math.min(l1 + l2 - 0.001, Math.max(Math.abs(l1 - l2) + 0.001, d));
  const a = Math.acos((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc));
  const base = Math.atan2(dy, dx);
  const joint: V = [h[0] + Math.cos(base + a) * l1, h[1] + Math.sin(base + a) * l1];
  // An unreachable target: the foot stops at full reach along the hip → target line.
  const foot: V = d === dc ? [f[0], f[1]] : [h[0] + (dx / d) * dc, h[1] + (dy / d) * dc];
  return { joint, foot };
}

/** Paddle outlines in foot space (heel joint at (0, 0), toes +x, sole row y 2). */
const PADDLE_SPREAD: readonly Pt[] = [[-2, 1], [0, 0], [4, -1], [7, -1], [8, 0], [8, 2], [-2, 2]];
const PADDLE_HALF: readonly Pt[] = [[-2, 0], [4, 0], [6, 1], [5, 2], [-2, 2]];
const PADDLE_FOLD: readonly Pt[] = [[-1, -1], [3, 0], [4, 1], [3, 2], [-1, 1]];
const MITTEN: readonly Pt[] = [[-2, 0], [-1, -1], [6, -1], [7, 0], [7, 1], [6, 2], [-1, 2], [-2, 1]];
const MITTEN_FOLD: readonly Pt[] = [[-1, 0], [0, -1], [5, -1], [6, 0], [6, 1], [5, 2], [0, 2], [-1, 1]];

/** Rotation of the paddle (degrees, + = toes down) per foot state. */
const FOOT_ANGLE: Readonly<Record<FootState, number>> = { S: 0, S15: -15, S20: -20, P: 25, H: 18, F: 40 };

/** Lowest sole pixel of a paddle below its joint (foot space y, after the state's turn). */
function paddleBottom(s: FootState, style: SwanStyle): number {
  const shape = paddleShape(s, style);
  let low = -Infinity;
  for (const p of shape) low = Math.max(low, rot(p, FOOT_ANGLE[s])[1]);
  return Math.round(low);
}

/** The outline of a paddle (or a sock foot) in a foot state. */
function paddleShape(s: FootState, style: SwanStyle): readonly Pt[] {
  if (style.socks) return s === 'F' || s === 'H' ? MITTEN_FOLD : MITTEN;
  return s === 'F' ? PADDLE_FOLD : s === 'H' ? PADDLE_HALF : PADDLE_SPREAD;
}

function drawPaddle(st: Stack, F: Pt, s: FootState, extra: number, far: boolean, style: SwanStyle): void {
  const ang = FOOT_ANGLE[s] + extra;
  const shape = paddleShape(s, style);
  const map = (p: Pt): V => add(F, rot(p, ang));
  const shift = far ? -1 : 0;
  const L = take();
  if (style.socks) {
    poly(L, shape.map(map), PAL.red[2]);
    shade(L, PAL.red, { shift });
    // Cream stripe across the mitten and the red pompom at the heel.
    recolor(L, (c, x, y) => {
      const q = rot([x - F[0], y - F[1]], -ang);
      return Math.round(q[0]) === 3 || Math.round(q[0]) === 4 ? (c === PAL.red[3] ? PAL.cloth[3] : c === PAL.red[1] ? PAL.cloth[1] : PAL.cloth[2]) : c;
    });
    st.put(L, far ? OWN.farLeg : OWN.nearLeg, PAL.red[0]);
    const pom = map([-2, 0]);
    const P = take();
    disc(P, Math.round(pom[0]), Math.round(pom[1]), 1, PAL.red[3]);
    st.put(P, far ? OWN.farLeg : OWN.nearLeg, PAL.red[1]);
    return;
  }
  poly(L, shape.map(map), PAL.orange[2]);
  shade(L, PAL.orange, { shift });
  if (shape === PADDLE_SPREAD) {
    // Toe ridges fanning from the heel, claw pixels at the toe tips.
    for (const [a, b] of [[[1, 1], [6, -1]], [[1, 1], [7, 1]]] as const) {
      const p0 = map(a);
      const p1 = map(b);
      const n = Math.max(1, Math.round(len(sub(p1, p0))));
      for (let i = 1; i <= n; i++) {
        const q = lerp2(p0, p1, i / n);
        if (L.get(q[0], q[1]) !== 0) dot(L, q[0], q[1], PAL.orange[0]);
      }
    }
  }
  st.put(L, far ? OWN.farLeg : OWN.nearLeg, PAL.orange[0]);
  if (shape === PADDLE_SPREAD) {
    for (const c of [[8, -1], [9, 1]] as const) {
      const q = map(c);
      const C = take();
      dot(C, q[0], q[1], far ? PAL.steel[0] : PAL.steel[1]);
      st.put(C, far ? OWN.farLeg : OWN.nearLeg, PAL.steel[0], false);
    }
  }
}

/** Knitted sock tube from the joint to the foot: red and cream 2-px stripes, cream cuff. */
function drawSock(st: Stack, J: Pt, F: Pt, far: boolean): void {
  const L = take();
  thick(L, J, F, 4, PAL.red[2]);
  const ax = unit(sub(F, J));
  const shift = far ? -1 : 0;
  recolor(L, (_c, x, y) => {
    const t = (x - J[0]) * ax[0] + (y - J[1]) * ax[1];
    const band = Math.floor((t + 1) / 2);
    if (t < 2.5) return far ? PAL.cloth[1] : PAL.cloth[3];
    return band % 2 === 0 ? (far ? PAL.red[1] : PAL.red[2]) : far ? PAL.cloth[1] : PAL.cloth[2];
  });
  // Light from the upper left: darken the right / lower edge pixels a little.
  shade(L, PAL.red, { shift, hi: 0 });
  recolor(L, (c, x, y) => {
    const t = (x - J[0]) * ax[0] + (y - J[1]) * ax[1];
    const band = Math.floor((t + 1) / 2);
    const cream = t < 2.5 || band % 2 === 1;
    if (!cream) return c;
    return c === PAL.red[1] || c === PAL.red[0] ? PAL.cloth[1] : far ? PAL.cloth[1] : PAL.cloth[2];
  });
  st.put(L, far ? OWN.farLeg : OWN.nearLeg, PAL.red[0]);
}

interface LegOut {
  /** Sole centre (foot joint + (3, 3)). */
  sole: [number, number];
}

/** One leg: drumstick, shank (sleeve + piston rod, or a sock), paddle, joint bolt, hip disc. */
function drawLeg(st: Stack, xf: Xf, pose: BodyPose, far: boolean, style: SwanStyle): LegOut {
  const foot = (far ? pose.far : pose.near) ?? { x: far ? -7 : -3, y: -4, s: 'S' as FootState };
  const H = xf.pt(far ? HIP_F : HIP_N);
  const target: V = pose.feetOnHull ? xf.p(foot.x, foot.y) : [foot.x, foot.y];
  if (!pose.feetOnHull) {
    // A paddle near the ground never sinks into it: raise the joint until the lowest sole
    // pixel sits on the row above the ground line (push-off frames stand on their toe tips).
    const low = paddleBottom(foot.s, style) + target[1];
    if (low > -2 && target[1] > -9) target[1] -= low + 2;
  }
  const [l1, l2base] = LEGS[pose.legs];
  const l2 = l2base + (foot.piston ?? 0);
  const { joint: J, foot: F } = ik(H, target, l1, l2);
  const shift = far ? -1 : 0;
  const owner = far ? OWN.farLeg : OWN.nearLeg;
  // Drumstick.
  let L = take();
  taper(L, H, J, 5, 4, PAL.steel[2]);
  shade(L, PAL.steel, { shift, glint: !far });
  st.put(L, owner, PAL.steel[0]);
  // Shank.
  if (style.socks) {
    drawSock(st, J, F, far);
  } else {
    const m = lerp2(J, F, Math.max(0.35, 0.62 - (foot.piston ?? 0) * 0.06));
    L = take();
    thick(L, J, m, 4, PAL.steel[2]);
    shade(L, PAL.steel, { shift });
    st.put(L, owner, PAL.steel[0]);
    L = take();
    thick(L, m, F, 2, PAL.steel[4]);
    shade(L, PAL.steel, { base: 4, hi: 0, shift });
    st.put(L, owner, PAL.steel[1]);
  }
  // Paddle (rolled frames turn it with the body).
  drawPaddle(st, F, foot.s, pose.feetOnHull ? xf.deg : 0, far, style);
  // Joint bolt: steel with a gold cap.
  L = take();
  disc(L, Math.round(J[0]), Math.round(J[1]), 2, PAL.steel[2]);
  shade(L, PAL.steel, { shift, glint: true });
  st.put(L, owner, PAL.steel[0]);
  st.detail(Math.round(J[0]), Math.round(J[1]), far ? PAL.gold[1] : PAL.gold[2], owner);
  if (!far) {
    // Hip bearing: steel disc r 3 with a gold bolt.
    L = take();
    disc(L, Math.round(H[0]), Math.round(H[1]), 3, PAL.steel[2]);
    shade(L, PAL.steel, { glint: true });
    st.put(L, owner, PAL.steel[0]);
    st.detail(Math.round(H[0]), Math.round(H[1]), PAL.gold[2], owner);
    st.detail(Math.round(H[0]) + 1, Math.round(H[1]), PAL.gold[1], owner);
  }
  return { sole: [Math.round(F[0] + 3) + 0, Math.round(F[1] + 3) + 0] };
}

/**
 * Stowed legs (mode T): only the near paddle's toe tips (4 × 2 px) peek out, under the breast
 * (or under the stern while she waddles); drawn behind the hull.
 */
function drawToes(st: Stack, xf: Xf, style: SwanStyle, where: 'front' | 'back' | 'none'): [number, number] {
  const x0 = where === 'back' ? -21 : 15;
  if (where !== 'none') {
    const L = take();
    const q = xf.all([[x0, -31], [x0 + 4, -31], [x0 + 4, -30], [x0, -30]]);
    poly(L, q, style.socks ? PAL.red[2] : PAL.orange[2]);
    shade(L, style.socks ? PAL.red : PAL.orange, {});
    st.put(L, OWN.nearLeg, style.socks ? PAL.red[0] : PAL.orange[0]);
  }
  const s = xf.p(x0 + 2, -29);
  return [Math.round(s[0]) + 0, Math.round(s[1]) + 0];
}

// ------------------------------------------------------------------------------------ hull

/** Paint a flat layer onto the stack only where `owner` already is (trim, stencils). */
function stamp(st: Stack, L: Layer, owner: number): void {
  if (L.used) {
    const d = L.buf.data;
    for (let y = L.y0; y <= L.y1; y++) {
      for (let x = L.x0; x <= L.x1; x++) {
        const c = d[y * L.buf.w + x];
        if ((c & 255) !== 0) st.detail(x - OX, y - OY, c, owner);
      }
    }
  }
  L.clear();
}

/** The "3" stencil (3 × 5). */
const THREE = ['###', '..#', '.##', '..#', '###'];

function drawHull(st: Stack, xf: Xf, pose: BodyPose): void {
  const L = take();
  poly(L, xf.all(hullPoly(pose.breast ?? 0)), PAL.snow[2]);
  shade(L, PAL.snow, {});
  // Volume: the lower hull (from the waterline down) is in shade, with an ordered-dither
  // border; the lowest row is the darkest tone, so she has weight even over snow.
  const inside = (x: number, y: number): boolean => L.get(x, y) !== 0;
  const tone: Array<[number, number, Color]> = [];
  for (let y = L.y0 - OY; y <= L.y1 - OY; y++) {
    for (let x = L.x0 - OX; x <= L.x1 - OX; x++) {
      if (!inside(x, y)) continue;
      const r = xf.inv(x, y);
      if (!inside(x, y + 1)) tone.push([x, y, PAL.snow[0]]);
      else if (r[1] > -35.5 || (r[1] > -37.5 && bayer(x + OX, y + OY) < (r[1] + 37.5) / 2)) {
        if (L.get(x, y) !== PAL.snow[3]) tone.push([x, y, PAL.snow[1]]);
      }
    }
  }
  for (const [x, y, c] of tone) dot(L, x, y, c);
  st.put(L, OWN.hull, PAL.snow[0]);
  // Navy waterline stripe (rows −34..−33), clipped to the hull.
  const S = take();
  poly(S, xf.all([[-26, -34], [24, -34], [24, -33], [-26, -33]]), PAL.navy[1]);
  recolor(S, (_c, x, y) => {
    const r = xf.inv(x, y);
    return r[1] < -33.5 ? PAL.navy[1] : r[0] > 17 ? PAL.navy[1] : PAL.navy[0];
  });
  stamp(st, S, OWN.hull);
  // Panel seams.
  const seams: Array<readonly [Pt, Pt]> = [
    [[15, -44], [15, -35]],
    [[-14, -47], [-14, -35]],
  ];
  for (const [a, b] of seams) {
    const A = xf.pt(a);
    const B = xf.pt(b);
    const n = Math.round(len(sub(B, A)));
    for (let i = 0; i <= n; i++) {
      const q = lerp2(A, B, i / Math.max(1, n));
      st.detail(q[0], q[1], PAL.snow[0], OWN.hull);
    }
  }
  // Gold rivets on the keel line.
  for (let x = -20; x <= 10; x += 5) rivet(st, xf.ip(x, -32), OWN.hull);
  // Bow number "3" (navy stencil) and the two flush jet vents (never tubes).
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if (THREE[r][c] !== '#') continue;
      const q = xf.ip(16 + c, -39 + r);
      st.detail(q[0], q[1], PAL.navy[1], OWN.hull);
    }
  }
  for (const vx of [7, 11]) {
    // Flush round vents (a hint of the TRUMPETER's jets): a 3 × 3 navy porthole, lit rim at the
    // top left, a dark core.
    const q = xf.ip(vx, -37);
    for (let yy = -1; yy <= 1; yy++) {
      for (let xx = -1; xx <= 1; xx++) {
        const c = xx === 0 && yy === 0 ? INK : xx + yy < 0 ? PAL.navy[2] : xx + yy === 0 ? PAL.navy[1] : PAL.navy[0];
        st.detail(q[0] + xx, q[1] + yy, c, OWN.hull);
      }
    }
  }
  // Smoke vent: a 3 × 1 steel grille on the rump deck.
  const V0 = take();
  const g = xf.all([[-21, -49], [-19, -49]]);
  line(V0, g[0], g[1], PAL.steel[2]);
  dot(V0, g[0][0], g[0][1], PAL.steel[3]);
  st.put(V0, OWN.hull, PAL.steel[0]);
}

function drawTail(st: Stack, xf: Xf, pose: BodyPose): void {
  const lift = pose.tail ?? 0;
  const wag = pose.fin ?? 0;
  // Three short blades rising back and up from the stern (look.md §5.4): broad roots that
  // continue the hull's curve, the top blade last (on top).
  const blades: ReadonlyArray<readonly [Pt, Pt, number]> = [
    [[-25, -40], [-34, -49 - lift * 0.45], 6],
    [[-24, -43], [-35, -52 - lift * 0.7], 6],
    [[-23, -46], [-34, -55 - lift], 5],
  ];
  blades.forEach(([r, t, w], i) => {
    const L = take();
    taper(L, xf.pt(r), xf.pt(t), w, 3, PAL.snow[2]);
    shade(L, PAL.snow, { shift: i === 0 ? -1 : 0 });
    st.put(L, OWN.tail, PAL.snow[0]);
  });
  // A small navy rudder fin capping the top blade, swept back (tip at (−36, −58)).
  const fin: Pt[] = [
    [-32 + wag, -55 - lift],
    [-34 + wag, -58 - lift],
    [-36 + wag, -58 - lift],
    [-36 + wag, -55 - lift],
    [-34 + wag, -53 - lift],
  ];
  const F = take();
  poly(F, xf.all(fin), PAL.navy[1]);
  shade(F, PAL.navy, { base: 1 });
  st.put(F, OWN.tail, PAL.navy[0]);
}

function drawPad(st: Stack, xf: Xf): void {
  const L = take();
  poly(L, xf.all([[-11, -50], [1, -50], [1, -49], [-11, -49]]), PAL.navy[1]);
  shade(L, PAL.navy, { base: 1 });
  st.put(L, OWN.pad, PAL.navy[0]);
  // Quilting dots and three gold rivets on the front rim.
  for (const x of [-9, -5, -1]) {
    const q = xf.ip(x, -50);
    st.detail(q[0], q[1], PAL.navy[2], OWN.pad);
  }
  for (const x of [-8, -4, 0]) {
    const q = xf.ip(x, -49);
    st.detail(q[0], q[1], PAL.gold[2], OWN.pad);
  }
}

function drawHandles(st: Stack, xf: Xf, folded: boolean): void {
  for (const far of [true, false]) {
    const sx = far ? 6 : 4;
    const shift = far ? -1 : 0;
    const S = take();
    if (folded) {
      line(S, xf.pt([sx, -48]), xf.pt([sx + 2, -48]), far ? PAL.gold[1] : PAL.gold[2]);
    } else {
      line(S, xf.pt([sx, -48]), xf.pt([sx, -51]), far ? PAL.gold[1] : PAL.gold[2]);
    }
    st.put(S, OWN.handle, PAL.gold[0]);
    const G = take();
    const gp: Pt[] = folded
      ? [[sx + 3, -48], [sx + 4, -48], [sx + 4, -47], [sx + 3, -47]]
      : [[sx, -54], [sx + 1, -54], [sx + 1, -52], [sx, -52]];
    poly(G, xf.all(gp), PAL.black[2]);
    shade(G, PAL.black, { shift });
    st.put(G, OWN.handle, PAL.ink[0]);
  }
}

// ------------------------------------------------------------------------------------ marks

/** Water fx above the surface: foam at the hull, a bow wave, two wake dashes (look.md §5.8). */
function waterMarks(h: Harvest, alt: boolean): void {
  const { buf, oy } = h;
  const row = SURFACE - 1 + oy;
  if (row < 0 || row >= buf.h) return;
  // Hull span on the surface row.
  let x0 = -1;
  let x1 = -1;
  for (let x = 0; x < buf.w; x++) {
    if ((buf.get(x, row + 1) & 255) !== 0) {
      if (x0 < 0) x0 = x;
      x1 = x;
    }
  }
  if (x0 < 0) return;
  const foam = PAL.snow[3];
  const spray = PAL.sky[3];
  const put = (x: number, y: number, c: Color): void => {
    if (x >= 0 && y >= 0 && x < buf.w && y < buf.h && (buf.get(x, y) & 255) === 0) buf.set(x, y, c);
  };
  // Foam line outside the hull.
  for (let k = 1; k <= 2; k++) {
    put(x0 - k, row, k === 1 ? foam : spray);
    put(x1 + k, row, k === 1 ? foam : spray);
  }
  // Bow wave at the breast (two shapes).
  put(x1 + 3, row, foam);
  put(x1 + 1, row - 1, alt ? spray : foam);
  put(x1 + 2, row - 1, alt ? foam : spray);
  if (alt) put(x1 + 3, row - 2, spray);
  else put(x1 + 4, row, spray);
  // Two wake dashes behind the stern (they swap places).
  const dash = (x: number, l: number): void => {
    for (let i = 0; i < l; i++) put(x - i, row, i === 0 ? foam : spray);
  };
  dash(x0 - (alt ? 5 : 4), 3);
  dash(x0 - (alt ? 10 : 11), 2);
}

/** Sparks under the keel (belly slide), two alternating shapes. */
function sparkMarks(h: Harvest, alt: boolean): void {
  const { buf, ox, oy } = h;
  const y = oy - 1;
  const pts: ReadonlyArray<readonly [number, number, Color]> = alt
    ? [[-16, 0, PAL.gold[3]], [-19, -1, PAL.fire[5]], [-22, -2, PAL.gold[2]], [-12, -1, PAL.fire[6]]]
    : [[-14, -1, PAL.gold[3]], [-18, 0, PAL.fire[6]], [-21, -1, PAL.fire[5]], [-24, -3, PAL.gold[2]]];
  for (const [dx, dy, c] of pts) {
    const x = ox + dx;
    const yy = y + dy;
    if (x >= 0 && yy >= 0 && x < buf.w && yy < buf.h && (buf.get(x, yy) & 255) === 0) buf.set(x, yy, c);
  }
}

// ------------------------------------------------------------------------------------ render

/** The near wing casts a 2-px shadow on the hull right under it (one tone darker). */
function castShadow(st: Stack): void {
  const w = st.buf.w;
  const d = st.buf.data;
  for (let y = st.y1; y >= Math.max(2, st.y0); y--) {
    for (let x = st.x0; x <= st.x1; x++) {
      const i = y * w + x;
      if (st.own[i] !== OWN.hull) continue;
      if (st.own[i - w] !== OWN.nearWing && st.own[i - 2 * w] !== OWN.nearWing) continue;
      const c = d[i];
      d[i] = c === PAL.snow[3] ? PAL.snow[2] : c === PAL.snow[2] ? PAL.snow[1] : c === PAL.snow[1] ? PAL.snow[0] : c;
    }
  }
  st.buf.touch();
}

const stack = new Stack();

/**
 * Render one body frame (and its front overlay for ridden strips). Points (look.md §8.1):
 * `seat`, `neck`, `hull`, `smoke`, `perch`, `wake`, `footN`, `footF`, `muzzle` / `cannon` (the
 * 0° beak-tip fallback for the base class), plus `head` for frames with the neck drawn in and
 * any extra points of the pose.
 */
export function renderBody(style: SwanStyle, pose: BodyPose): BodyOut {
  const st = stack;
  st.reset();
  const xf = new Xf(pose.tilt + (pose.roll ?? 0), pose.dx ?? 0, pose.dy);
  const nearBack = BACK_POSES.has(pose.wingN.p);
  // Back to front (look.md §7).
  drawWing(st, xf, pose.wingF, true, style);
  if (nearBack) drawWing(st, xf, pose.wingN, false, style);
  let soleF: [number, number];
  let soleN: [number, number];
  if (pose.legs === 'T') {
    soleN = drawToes(st, xf, style, pose.toes ?? 'front');
    soleF = [soleN[0] - 4, soleN[1]];
  } else {
    soleF = drawLeg(st, xf, pose, true, style).sole;
    soleN = [0, 0];
  }
  drawTail(st, xf, pose);
  drawHull(st, xf, pose);
  if (!pose.bare) {
    drawPad(st, xf);
    drawHandles(st, xf, pose.handles === 'fold');
  }
  if (pose.legs !== 'T') soleN = drawLeg(st, xf, pose, false, style).sole;
  if (!nearBack) {
    drawWing(st, xf, pose.wingN, false, style);
    castShadow(st);
  }
  const socket = pose.neckFrom ? ([pose.neckFrom[0], pose.neckFrom[1]] as V) : xf.pt(REST.neck);
  let head: V | null = null;
  if (pose.neck) {
    head = drawNeck(st, socket, pose.neck, style.colour).head;
  } else if (pose.rider) {
    // The collar the separate neck sprite sits in.
    drawCollar(st, socket, unit(xf.dir(0.92, -0.39)));
  }
  const surface = pose.water ? SURFACE : null;
  const marks = pose.marks ?? [];
  const h = harvest(st, { surface, extra: marks.length > 0 ? [-48, -24, 34, 4] : undefined });
  if (marks.includes('foam') || marks.includes('foam2')) waterMarks(h, marks.includes('foam2'));
  if (marks.includes('sparks') || marks.includes('sparks2')) sparkMarks(h, marks.includes('sparks2'));
  // Rolled frames rest their lowest pixel on the ground line; no frame ever sinks below it (a
  // tilted keel corner, a tucked beak): move the art, keep the anchor. Points move with it.
  let lift = 0;
  const b = h.buf.trimBounds();
  if (b) {
    const low = b.y + b.h - 1 - h.oy;
    if (pose.ground || low > -1) lift = -1 - low;
    h.oy -= lift;
  }
  // Named points.
  const P = (q: Pt): [number, number] => {
    const r = xf.p(q[0], q[1]);
    return [Math.round(r[0]) + 0, Math.round(r[1] + lift) + 0];
  };
  const pts: Record<string, readonly [number, number]> = {
    seat: pose.low ? P([-4, -44]) : P(REST.seat),
    neck: [Math.round(socket[0]) + 0, Math.round(socket[1] + lift) + 0],
    hull: P(REST.hull),
    smoke: P(REST.smoke),
    perch: P(REST.perch),
    wake: P(REST.wake),
    footN: [soleN[0], soleN[1] + lift],
    footF: [soleF[0], soleF[1] + lift],
  };
  // 0° beak tip for the posture (the base class reads it before the swan's own aim).
  const m0 = pose.water ? [26, 4] : pose.low ? [22, 3] : [28, 21];
  pts.muzzle = [pts.neck[0] + m0[0], pts.neck[1] + m0[1]];
  pts.cannon = pts.muzzle;
  if (head) pts.head = [Math.round(head[0]) + 0, Math.round(head[1] + lift) + 0];
  for (const [k, q] of Object.entries(pose.pts ?? {})) pts[k] = [q[0], q[1]];
  const body: Frame = { buf: h.buf, ox: h.ox, oy: h.oy, pts };
  const front = pose.rider ? cutFront(h, xf, pose, !nearBack, pts) : null;
  st.reset();
  return { body, front };
}

/**
 * The `-front` overlay: the near wing (front-layer poses) and, except in low frames, the near
 * flank under the seat (rest x −15…11, from the pad's near rim down), cut out of the finished
 * frame with their outline pixels. It is drawn over the rider and hides his hips (look.md §7).
 */
function cutFront(h: Harvest, xf: Xf, pose: BodyPose, wingFront: boolean, pts: Record<string, readonly [number, number]>): Frame {
  const { buf, ox, oy, own } = h;
  const w = buf.w;
  const hh = buf.h;
  const keep = new Uint8Array(w * hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = own[i];
      if (o === 0 || (buf.data[i] & 255) === 0) continue;
      if (o === OWN.nearWing && wingFront) {
        keep[i] = 1;
        continue;
      }
      if (pose.low) continue;
      // The flank band the rider's hips could reach (hip + 0..10 px), never the legs: the
      // overlay is shared by the sock variants.
      if (o === OWN.hull || o === OWN.pad || o === OWN.handle) {
        const r = xf.inv(x - ox, y - oy);
        if (r[0] >= -15.5 && r[0] <= 11.5 && r[1] >= -49.5 && r[1] <= -36.5) keep[i] = 1;
      }
    }
  }
  // Outline pixels around the kept parts.
  const out = new PixelBuffer(w, hh);
  let x0 = w;
  let y0 = hh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let take = keep[i] === 1;
      if (!take && own[i] === 0 && (buf.data[i] & 255) !== 0) {
        take = (x > 0 && keep[i - 1] === 1) || (x < w - 1 && keep[i + 1] === 1) || (y > 0 && keep[i - w] === 1) || (y < hh - 1 && keep[i + w] === 1);
      }
      if (!take) continue;
      out.data[i] = buf.data[i];
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  out.touch();
  if (x1 < 0) return { buf: new PixelBuffer(1, 1), ox: 0, oy: 0, pts };
  return { buf: out.crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1), ox: ox - x0, oy: oy - y0, pts };
}
