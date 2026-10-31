/**
 * Style `arcade` (arcade.ts): the figure painter. Every part of VINCENT is drawn on ONE HdCanvas
 * from the arcade skeleton (arcade-rig.ts) with cel materials (arcade-pal.ts: three hard bands
 * per material, a deep tone, a glint), then rendered without the canvas outline: the painter
 * adds its own thick outline (one logical px) coloured by the part it wraps, the tweed weave and
 * the crisp painted glints (boots, gun, buckle, hair).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import type { HandShape, Pose, PropKind, RenderPart } from '../../../art/humanoid';
import { isProp } from '../../../art/humanoid-gear';
import { HdCanvas, type DrawOpts, type HdMaterial, type Texture } from '../../../art/hd/canvas';
import { heldArtHd, propHd } from '../../../art/hd/gear';
import { limb } from '../../../art/hd/shape';
import * as C from './arcade-pal';
import type { Cel } from './arcade-pal';
import { drawArcadeHead } from './arcade-head';
import { BOOT, DEG, DIMS, GUN_RIG, GUN_SCALE, angleTo, dirOf, rotateAbout, solve, type Gun, type Skeleton, type V } from './arcade-rig';

/** Base depths (back to front; the rig's layer order). */
const Z = {
  offGun: -16,
  farArm: -14,
  farHand: -11,
  farLeg: -10,
  farBoot: -8.5,
  nearLeg: -6.5,
  nearBoot: -5,
  torso: 0,
  over: 4.6,
  belt: 5.3,
  head: 7.5,
  gun: 10.5,
  arm: 11.5,
  knife: 13.8,
  hand: 14.4,
  held: 15,
} as const;

/** Head scale against the rig's head. */
export const HEAD_SCALE = 1.15;

/** What the painter hands back: the rendered canvas and the frame points (continuous, anchor px). */
export interface Painted {
  buf: PixelBuffer;
  pts: Record<string, V>;
}

interface Region {
  /** Continuous anchor coords of the canvas's top-left (integers). */
  x: number;
  y: number;
  w: number;
  h: number;
}

const q4 = (v: number): number => Math.round(v * 4) / 4;

class Painter {
  readonly c: HdCanvas;
  readonly d: number;
  readonly sk: Skeleton;
  readonly pose: Pose;
  readonly part: RenderPart;
  readonly rot: number;
  readonly off: V;
  readonly reg: Region;
  readonly P0: V;
  readonly F: V;
  readonly U: V;
  readonly H: number;
  readonly lineOf = new Map<number, Color>();
  readonly headParts: number[] = [];
  readonly glints: Array<{ x: number; y: number; w: number; h: number; c: Color; part: number }> = [];
  private readonly mats = new Map<string, number>();
  tweedMats: number[] = [];

  constructor(sk: Skeleton, pose: Pose, part: RenderPart, d: number, reg: Region) {
    this.sk = sk;
    this.pose = pose;
    this.part = part;
    this.d = d;
    this.reg = reg;
    this.rot = pose.rot ?? 0;
    this.off = part === 'upper' ? [0, 0] : [pose.dx ?? 0, pose.dy ?? 0];
    this.c = new HdCanvas(reg.w, reg.h, d);
    this.P0 = this.T(sk.pelvis);
    const r = (v: V): V => {
      const cs = Math.cos(this.rot * DEG);
      const sn = Math.sin(this.rot * DEG);
      return [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs];
    };
    this.F = r(sk.f);
    this.U = r(sk.u);
    this.H = DIMS.torsoH - (pose.hunch ?? 0);
  }

  /** Skeleton point → continuous anchor coords (after rot about the pelvis and the offset). */
  A(p: V): V {
    const r = rotateAbout(p, this.sk.pelvis, this.rot);
    return [r[0] + this.off[0], r[1] + this.off[1]];
  }

  /** Skeleton point → canvas (logical), on the quarter-px grid. */
  T(p: V): V {
    const a = this.A(p);
    return [q4(a[0] - this.reg.x), q4(a[1] - this.reg.y)];
  }

  /** Torso frame: a forward, b up from the pelvis (canvas). */
  TL(a: number, b: number): V {
    return [this.P0[0] + this.F[0] * a + this.U[0] * b, this.P0[1] + this.F[1] * a + this.U[1] * b];
  }

  /** Torso-frame coordinates of a canvas point. */
  local(x: number, y: number): V {
    const dx = x - this.P0[0];
    const dy = y - this.P0[1];
    return [dx * this.F[0] + dy * this.F[1], dx * this.U[0] + dy * this.U[1]];
  }

  poly(pts: ReadonlyArray<V>): V[] {
    return pts.map(([a, b]) => this.TL(a, b));
  }

  /** A cel material (far: the light band dropped, so far limbs read a band darker). */
  mat(cel: Cel, o: Partial<HdMaterial> & { far?: boolean } = {}): number {
    const key = `${cel.ramp.join(',')}|${JSON.stringify(o)}`;
    let m = this.mats.get(key);
    if (m === undefined) {
      const { far, ...rest } = o;
      m = this.c.material({ ramp: [...cel.ramp], lo: 1, hi: far ? 2 : 3, wrap: 0, amb: 0.1, bounce: 0.16, rim: 0, gain: 1.15, ...rest });
      this.mats.set(key, m);
      this.lineOf.set(m, cel.line);
    }
    return m;
  }

  /** A crisp painted glint (fixed colour, kept by the clean-up; only where `part` is drawn). */
  glint(x: number, y: number, w: number, h: number, col: Color, part: number): void {
    this.glints.push({ x, y, w, h, c: col, part });
  }
}

// ------------------------------------------------------------------------------------ helpers

function lerp(a: V, b: V, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** A local shape (x forward, y down) turned clockwise by `deg`, scaled by `s`, placed at p. */
function place(pts: ReadonlyArray<V>, p: V, deg: number, s = 1): V[] {
  const cs = Math.cos(deg * DEG);
  const sn = Math.sin(deg * DEG);
  return pts.map(([x, y]) => [p[0] + (x * cs - y * sn) * s, p[1] + (x * sn + y * cs) * s]);
}

function rect(x0: number, y0: number, x1: number, y1: number): V[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** Capsule chain of one part. */
function caps(c: HdCanvas, pts: readonly V[], radii: readonly number[], o: DrawOpts): void {
  const part = o.part ?? c.newPart();
  for (let i = 0; i + 1 < pts.length; i++) c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radii[i], radii[i + 1], { ...o, part });
}

/** Signed bend between two segment angles, −180..180. */
function bendOf(a: number, b: number): number {
  let x = b - a;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

// ------------------------------------------------------------------------------------ legs and boots

function drawLeg(p: Painter, hip: V, knee: V, ankle: V, far: boolean, withPelvis: boolean, z: number): void {
  const c = p.c;
  const D = DIMS;
  const h = p.T(hip);
  const k = p.T(knee);
  const a = p.T(ankle);
  const mat = p.mat(C.OLIVE, { far });
  const part = c.newPart();
  const kneeW = Math.max(D.thighW[1], D.shinW[0]) / 2;
  caps(c, [h, k, a], [D.thighW[0] / 2, kneeW, D.shinW[1] / 2], { mat, z, part, round: 0.75 });
  const ta = angleTo(h, k);
  const sa = angleTo(k, a);
  const bend = bendOf(ta, sa);
  if (Math.abs(bend) > 12) {
    // The knee: a hard crease wedge inside the bend.
    const sg = Math.sign(bend);
    const kin: V = [k[0] + dirOf((ta + sa) / 2 - 90 * sg)[0] * kneeW * 0.55, k[1] + dirOf((ta + sa) / 2 - 90 * sg)[1] * kneeW * 0.55];
    c.shade(kin[0] - 2, kin[1] - 2, 4, 4, (x, y) => (Math.hypot(x - kin[0], y - kin[1]) < 0.85 ? -0.5 : 0), part);
  }
  if (!far) {
    // A cargo pocket with its flap on the outer thigh (fatigues).
    const pc = lerp(h, k, 0.56);
    const deg = -ta;
    c.blob(place(rect(-1.1, -0.9, 1.2, 1.3), pc, deg), 0.3, { mat, z: z + 2.2, bulge: 0.1, tone: -0.04 });
    c.blob(place(rect(-1.3, -1.2, 1.35, -0.35), pc, deg), 0.25, { mat, z: z + 2.6, bulge: 0.08, tone: 0.12 });
  }
  if (withPelvis) {
    const B = (dx: number, dy: number): V => [p.P0[0] + dx * Math.cos(p.rot * DEG) - dy * Math.sin(p.rot * DEG), p.P0[1] + dx * Math.sin(p.rot * DEG) + dy * Math.cos(p.rot * DEG)];
    c.blob([B(-D.waistB, -2.2), B(D.waistF + 0.2, -2.2), B(D.waistF + 0.2, 1.6), B(-D.waistB, 1.6)], 0.9, { mat, z: z + 0.3, part, bulge: 0.3 });
  }
}

const TOE: readonly V[] = [
  [2.1, -1.35],
  [3.3, -0.8],
  [4.45, -0.05],
  [4.9, 0.9],
  [4.9, 1.8],
  [1.9, 1.8],
];
const SOLE: readonly V[] = [
  [-2.55, 1.6],
  [4.9, 1.6],
  [4.9, 2.3],
  [4.6, 2.6],
  [1.0, 2.6],
  [0.6, 2.35],
  [-0.6, 2.35],
  [-1.0, 2.6],
  [-2.55, 2.6],
];
const COLLAR: readonly V[] = [
  [-2.7, -2.85],
  [1.5, -2.85],
  [1.7, -2.0],
  [-2.7, -2.0],
];

function drawBoot(p: Painter, ankle: V, foot: number, far: boolean, z: number): void {
  const c = p.c;
  const at = p.T(ankle);
  const deg = p.rot - foot;
  const leather = p.mat(C.LEATHER, { far, spec: far ? 0 : 0.7, shine: 30 });
  const part = c.newPart();
  c.blob(place(BOOT, at, deg), 1.1, { mat: leather, z, part, bulge: 0.3 });
  c.blob(place(COLLAR, at, deg), 0.45, { mat: leather, z: z + 0.6, bulge: 0.15, tone: -0.12 });
  c.blob(place(TOE, at, deg), 0.9, { mat: leather, z: z + 1.0, part, bulge: 0.35, tone: 0.1 });
  const sole = p.mat(C.SOLE);
  c.blob(place(SOLE, at, deg), 0.25, { mat: sole, z: z + 1.2, bulge: 0.05 });
  if (!far) {
    // Laces across the instep, a crisp glint on the toe cap.
    const lace = C.LEATHER.ramp[3];
    const n = p.d >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const qq = place([[1.0 + t * 1.6, -2.1 + t * 1.1]], at, deg)[0];
      p.glint(qq[0] - 0.25, qq[1] - 0.12, 0.75, 0.25, lace, part);
    }
    const g = place([[3.9, -0.2]], at, deg)[0];
    p.glint(g[0] - 0.375, g[1] - 0.375, 0.75, 0.75, C.LEATHER.ramp[4], part);
    const h = place([[-1.9, -1.6]], at, deg)[0];
    p.glint(h[0] - 0.25, h[1] - 0.25, 0.5, 0.5, C.LEATHER.ramp[3], part);
  }
}

// ------------------------------------------------------------------------------------ torso

function drawTorso(p: Painter): void {
  const c = p.c;
  const D = DIMS;
  const H = p.H;
  const front = D.chestF;
  const tweed = p.mat(C.TWEED);
  p.tweedMats.push(tweed);
  const part = c.newPart();
  // Heroic V: broad chest and shoulders, a narrower waist; the V cut at the neck.
  const body: V[] = [
    [-D.waistB, -2.2],
    [D.waistF + 0.2, -2.2],
    [D.waistF + 0.9, 1.5],
    [front + 1.2, H - 4],
    [front + 0.8, H - 1.2],
    [front - 0.7, H + 0.3],
    [front - 1.9, H - 2.9],
    [front - 3.2, H + 0.4],
    [-D.chestB + 0.6, H + 0.6],
    [-D.chestB - 1.4, H - 1.6],
    [-D.chestB - 0.9, 3],
    [-D.waistB - 0.3, 0],
  ];
  // The shirt in the V, with its collar points.
  const shirt = p.mat(C.SHIRT);
  c.blob(p.poly([[front - 3.9, H + 0.6], [front - 0.3, H + 0.6], [front - 1.9, H - 3.2]]), 0.5, { mat: shirt, z: -0.4, bulge: 0.2 });
  c.blob(
    p.poly(body),
    1.5,
    {
      mat: tweed,
      z: Z.torso,
      part,
      bulge: 0.4,
      tex: (s) => {
        const [a, b] = p.local(s.x, s.y);
        // The placket: a dark seam down the front, a lit edge beside it.
        if (b > -2 && b < H - 3) {
          const w = 0.75 / p.d + 0.05;
          if (Math.abs(a - (D.waistF - 0.2)) < w) s.tone -= 0.45;
        }
        // The under-arm shade on the back half.
        if (a < -D.chestB + 0.8 && b < H - 2) s.tone -= 0.12;
      },
    },
  );
  // Lapels: two lit flaps along the V.
  c.blob(p.poly([[front - 3.7, H + 0.5], [front - 2.7, H + 0.5], [front - 1.95, H - 2.7], [front - 2.5, H - 3.1]]), 0.3, { mat: tweed, z: Z.torso + 2.8, bulge: 0.15, tone: 0.2 });
  c.blob(p.poly([[front - 0.6, H + 0.4], [front + 0.3, H - 0.6], [front - 1.75, H - 2.8], [front - 1.95, H - 2.3]]), 0.3, { mat: tweed, z: Z.torso + 2.8, bulge: 0.15, tone: 0.08 });
  // The breast-pocket flap on the back half, the hip pocket flap.
  c.blob(p.poly([[-2.9, 4.0], [-0.4, 4.0], [-0.4, 3.0], [-2.8, 3.0]]), 0.3, { mat: tweed, z: Z.torso + 2.7, bulge: 0.1, tone: 0.15 });
  // Buttons beside the placket.
  const btn = p.mat(C.TWEED, { lo: 3, hi: 3, spec: 0.6 });
  for (const b of [1.2, 3.4]) {
    const qq = p.TL(D.waistF - 0.9, b);
    c.ellipsoid(qq[0], qq[1], 0.42, 0.42, { mat: btn, z: Z.torso + 3.2, round: 0.8 });
  }
}

function drawTie(p: Painter): void {
  const c = p.c;
  const H = p.H;
  const x = DIMS.chestF - 1.9;
  const m = p.mat(C.TIE, { spec: 0.4, shine: 20 });
  const part = c.newPart();
  // The knot, then the thin blade with its pointed tip.
  c.blob(p.poly([[x - 0.65, H + 0.1], [x + 0.65, H + 0.1], [x + 0.5, H - 1.2], [x - 0.5, H - 1.2]]), 0.3, { mat: m, z: Z.over + 0.3, tone: 0.15, part: c.newPart() });
  c.blob(p.poly([[x - 0.42, H - 1.1], [x + 0.42, H - 1.1], [x + 0.75, 1.9], [x, 0.9], [x - 0.7, 1.9]]), 0.3, { mat: m, z: Z.over, part, bulge: 0.1 });
}

function drawBelt(p: Painter): void {
  const c = p.c;
  const D = DIMS;
  const belt = p.mat(C.LEATHER, { spec: 0.5, shine: 26 });
  const part = c.newPart();
  c.blob(p.poly([[-D.waistB - 0.5, 0.6], [D.waistF + 0.7, 0.6], [D.waistF + 0.6, -1.1], [-D.waistB - 0.4, -1.1]]), 0.45, { mat: belt, z: Z.belt, part, bulge: 0.12 });
  // The buckle: a brass frame round a dark prong, a glint.
  const bx = D.waistF - 0.9;
  const brass = p.mat(C.BRASS, { spec: 0.9, shine: 30 });
  const bp = c.newPart();
  c.blob(p.poly([[bx - 0.9, 0.85], [bx + 1.05, 0.85], [bx + 1.05, -1.35], [bx - 0.9, -1.35]]), 0.3, {
    mat: brass,
    z: Z.belt + 0.9,
    part: bp,
    bulge: 0.1,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      if (Math.abs(a - bx - 0.1) < 0.45 && Math.abs(b + 0.25) < 0.55) s.tone -= 0.8;
    },
  });
  const g = p.TL(bx - 0.5, 0.45);
  p.glint(g[0], g[1], 0.5, 0.5, C.BRASS.ramp[4], bp);
}

// ------------------------------------------------------------------------------------ arms and hands

function drawArm(p: Painter, shoulder: V, el: V, wr: V, far: boolean, z: number): void {
  const c = p.c;
  const D = DIMS;
  const s = p.T(shoulder);
  const e = p.T(el);
  const w = p.T(wr);
  const mat = p.mat(C.TWEED, { far });
  p.tweedMats.push(mat);
  const part = c.newPart();
  const elbowW = Math.max(D.armW[1], D.foreW[0]) / 2;
  caps(c, [s, e, w], [D.armW[0] / 2, elbowW, D.foreW[1] / 2], { mat, z, part, round: 0.8 });
  // A rounded shoulder (the heroic deltoid).
  if (!far) c.ellipsoid(s[0], s[1] + 0.2, D.armW[0] / 2 + 0.45, D.armW[0] / 2 + 0.3, { mat, z: z - 0.2, part, round: 0.9 });
  const ua = angleTo(s, e);
  const fa = angleTo(e, w);
  const bend = bendOf(ua, fa);
  if (Math.abs(bend) > 14) {
    const sg = Math.sign(bend);
    const dd = dirOf((ua + fa) / 2 - 90 * sg);
    const fi: V = [e[0] + dd[0] * elbowW * 0.5, e[1] + dd[1] * elbowW * 0.5];
    c.shade(fi[0] - 2, fi[1] - 2, 4, 4, (x, y) => (Math.hypot(x - fi[0], y - fi[1]) < 0.7 ? -0.5 : 0), part);
  }
  // The white shirt cuff peeking out of the sleeve.
  const fl = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
  const c1 = lerp(w, e, Math.min(0.3, 0.9 / fl));
  const c2 = lerp(w, e, -Math.min(0.1, 0.35 / fl));
  const hw = D.foreW[1] / 2 - 0.15;
  c.blob(limb([c1, c2], [hw, hw], 0), 0.3, { mat: p.mat(C.SHIRT, { far }), z: z + 0.6, bulge: 0.1 });
}

/** The hand, natively drawn and big: local x along the forearm, y across (palm side +). */
function drawHand(p: Painter, el: V, wr: V, shape: HandShape, far: boolean, z: number): void {
  const c = p.c;
  const e = p.T(el);
  const w = p.T(wr);
  const fore = angleTo(e, w);
  const dir = dirOf(fore);
  const perp: V = [-dir[1], dir[0]];
  const L = (x: number, y: number): V => [w[0] + dir[0] * x + perp[0] * y, w[1] + dir[1] * x + perp[1] * y];
  const Ls = (pts: ReadonlyArray<V>): V[] => pts.map(([x, y]) => L(x, y));
  const skin = p.mat(C.SKIN, { far });
  const part = c.newPart();
  const tone = far ? -0.1 : 0;
  const knuckles: Texture | null = p.d >= 4
    ? (s) => {
        // Finger grooves across the front of the fist.
        const vx = s.x - w[0];
        const vy = s.y - w[1];
        const lx = vx * dir[0] + vy * dir[1];
        const ly = vx * perp[0] + vy * perp[1];
        if (lx > 2.9 && (Math.abs(ly + 0.75) < 0.13 || Math.abs(ly - 0.55) < 0.13)) s.tone -= 0.5;
      }
    : null;
  const fist = (): void => {
    c.blob(Ls([[-0.5, -2.0], [2.6, -2.25], [4.1, -1.5], [4.3, 0.6], [3.7, 2.0], [0.2, 2.15], [-0.5, 1.2]]), 1.1, { mat: skin, z, part, bulge: 0.35, tone, tex: knuckles });
  };
  const thumbOver = (): void => {
    c.blob(Ls([[0.7, -2.6], [3.0, -2.3], [3.3, -1.3], [1.0, -1.1]]), 0.45, { mat: skin, z: z + 0.5, bulge: 0.2, tone: tone + 0.05 });
  };
  if (shape === 'fist' || shape === 'grip') {
    fist();
    thumbOver();
  } else if (shape === 'point') {
    fist();
    c.capsule(L(3.2, -1.15)[0], L(3.2, -1.15)[1], L(6.6, -1.15)[0], L(6.6, -1.15)[1], 0.62, 0.55, { mat: skin, z: z + 0.4, tone });
    thumbOver();
  } else if (shape === 'thumb') {
    // Thumbs up: the thumb always points up (with the figure's turn), whatever the forearm does.
    fist();
    const up = dirOf(180 + p.rot);
    const a = L(2.0, 0);
    const a2: V = [a[0] + up[0] * 1.6, a[1] + up[1] * 1.6];
    const b: V = [a[0] + up[0] * 4.4, a[1] + up[1] * 4.4];
    c.capsule(a2[0], a2[1], b[0], b[1], 0.78, 0.7, { mat: skin, z: z + 0.5, tone: tone + 0.05 });
  } else {
    // Open: a palm and four fingers (grooves at 4×), the thumb out to the side.
    c.blob(Ls([[-0.4, -1.9], [5.6, -1.9], [5.9, -0.9], [5.9, 1.0], [5.5, 1.85], [-0.4, 1.9]]), 0.9, {
      mat: skin,
      z,
      part,
      bulge: 0.3,
      tone,
      tex: (s) => {
        const vx = s.x - w[0];
        const vy = s.y - w[1];
        const lx = vx * dir[0] + vy * dir[1];
        const ly = vx * perp[0] + vy * perp[1];
        if (lx > 3.0 && (Math.abs(ly + 0.95) < 0.14 || Math.abs(ly) < 0.14 || Math.abs(ly - 0.95) < 0.14)) s.tone -= 0.55;
        if (lx > 5.6 && Math.abs(ly) > 1.5) s.cut = true;
      },
    });
    const a = L(1.0, -1.6);
    const b = L(2.8, -3.4);
    c.capsule(a[0], a[1], b[0], b[1], 0.7, 0.6, { mat: skin, z: z + 0.4, tone: tone + 0.05 });
  }
}

// ------------------------------------------------------------------------------------ guns

/** Gun-local → canvas: rig template coords (minus the grip) × the arcade scale, turned, at the grip. */
function gunPen(p: Painter, g: Gun): { L: (x: number, y: number) => V; Ls: (pts: ReadonlyArray<V>) => V[]; s: number; deg: number } {
  const rig = GUN_RIG[g.kind];
  const s = GUN_SCALE[g.kind];
  const at = p.T(g.grip);
  const deg = g.angle + p.rot;
  const cs = Math.cos(deg * DEG);
  const sn = Math.sin(deg * DEG);
  const fy = g.flip ? -1 : 1;
  const L = (x: number, y: number): V => {
    const lx = (x - rig.grip[0]) * s;
    const ly = (y - rig.grip[1]) * s * fy;
    return [at[0] + lx * cs - ly * sn, at[1] + lx * sn + ly * cs];
  };
  return { L, Ls: (pts) => pts.map(([x, y]) => L(x, y)), s, deg };
}

/** Muzzle of a gun in continuous anchor coords (for the 'muzzle' point). */
function muzzleOf(p: Painter, g: Gun): V {
  const rig = GUN_RIG[g.kind];
  const s = GUN_SCALE[g.kind];
  const a = p.A(g.grip);
  const deg = g.angle + p.rot;
  const lx = (rig.muzzle[0] - rig.grip[0]) * s;
  const ly = (rig.muzzle[1] - rig.grip[1]) * s * (g.flip ? -1 : 1);
  return [a[0] + lx * Math.cos(deg * DEG) - ly * Math.sin(deg * DEG), a[1] + lx * Math.sin(deg * DEG) + ly * Math.cos(deg * DEG)];
}

function drawGun(p: Painter, g: Gun, z: number): void {
  const c = p.c;
  const { L, Ls, s } = gunPen(p, g);
  const steel = p.mat(C.STEEL, { spec: 0.8, shine: 34 });
  const poly = p.mat(C.POLYMER, { spec: 0.3, shine: 20 });
  const ink = C.STEEL.ramp[0];
  const fine = p.d >= 4;
  // Painted detail in gun-local coords: fn(x, y) in template coords → colour.
  const paintLocal = (x0: number, y0: number, x1: number, y1: number, part: number, fn: (x: number, y: number) => Color): void => {
    const cs = [L(x0, y0), L(x1, y0), L(x0, y1), L(x1, y1)];
    const bx = Math.min(...cs.map((q) => q[0]));
    const by = Math.min(...cs.map((q) => q[1]));
    const ex = Math.max(...cs.map((q) => q[0]));
    const ey = Math.max(...cs.map((q) => q[1]));
    const rig = GUN_RIG[g.kind];
    const deg = g.angle + p.rot;
    const at = p.T(g.grip);
    const co = Math.cos(deg * DEG);
    const si = Math.sin(deg * DEG);
    c.paint(bx, by, ex - bx, ey - by, (cx, cy, X, Y) => {
      const i = Y * c.W + X;
      if (c.mat[i] === 0 || c.part[i] !== part) return 0;
      const dx = cx - at[0];
      const dy = cy - at[1];
      const lx = (dx * co + dy * si) / s + rig.grip[0];
      const ly = ((-dx * si + dy * co) / s) * (g.flip ? -1 : 1) + rig.grip[1];
      if (lx < x0 || lx > x1 || ly < y0 || ly > y1) return 0;
      return fn(lx, ly);
    });
  };
  if (g.kind === 'pistol') {
    c.blob(Ls([[0.75, 1.8], [3.2, 1.8], [3.05, 5.1], [0.85, 5.1]]), 0.45, { mat: poly, z, bulge: 0.12 });
    c.blob(Ls(rect(1, 1.85, 4.9, 2.95)), 0.3, { mat: steel, z: z + 0.5, bulge: 0.1, tone: -0.25 });
    const tg = Ls([[3.05, 2.75], [3.15, 3.5], [4.4, 3.4], [4.6, 2.7]]);
    for (let i = 0; i + 1 < tg.length; i++) c.capsule(tg[i][0], tg[i][1], tg[i + 1][0], tg[i + 1][1], 0.3, 0.3, { mat: steel, z: z + 0.45, tone: -0.3 });
    const slide = c.newPart();
    c.blob(Ls(rect(0.9, -0.05, 8.1, 2.0)), 0.55, { mat: steel, z: z + 1.1, part: slide, bulge: 0.15 });
    paintLocal(0.9, -0.1, 8.2, 2.1, slide, (x, y) => {
      // Rear serrations, the ejection port, the bore.
      if (fine && x > 1.4 && x < 2.9 && y > 0.5 && y < 1.6 && Math.floor((x - 1.4) * 2.5) % 2 === 0) return C.STEEL.ramp[1];
      if (x > 4.3 && x < 5.7 && y > 0.25 && y < 0.8) return ink;
      if (x > 7.55 && y > 0.55 && y < 1.45) return ink;
      return 0;
    });
    // The glint along the slide's top edge.
    const a = L(2.4, 0.3);
    p.glint(a[0] - 0.25, a[1] - 0.25, 0.5, 0.5, C.STEEL.ramp[4], slide);
    const b = L(3.4, 0.3);
    p.glint(b[0] - 0.25, b[1] - 0.25, 0.5, 0.5, C.STEEL.ramp[4], slide);
    return;
  }
  // The heavy gun: skeleton stock, receiver with carry handle, vented shroud, drum, grips.
  const stock = c.newPart();
  c.blob(Ls([[0.4, 1], [2.2, 1], [4.6, 1.8], [4.6, 4.9], [1.6, 4.9], [0.4, 5.9]]), 0.5, { mat: steel, z, part: stock, bulge: 0.1, tone: -0.15 });
  paintLocal(1.2, 2.2, 4.2, 3.9, stock, (x, y) => (y > 2.45 && y < 3.6 && x > 1.45 && x < 3.95 - (3.6 - y) * 0.3 ? ink : 0));
  c.blob(Ls(rect(0, 0.9, 0.8, 6.1)), 0.3, { mat: poly, z: z + 0.3, bulge: 0.1 });
  c.blob(Ls([[4.85, 4.3], [6.55, 4.3], [6.8, 7.1], [5.15, 7.1]]), 0.45, { mat: poly, z: z + 0.3, bulge: 0.1 });
  const rec = c.newPart();
  c.blob(Ls(rect(4, 1.8, 10.5, 4.45)), 0.6, { mat: steel, z: z + 1, part: rec, bulge: 0.15, tone: -0.05 });
  paintLocal(6.3, 2.2, 8.7, 3.0, rec, () => ink);
  const hd = Ls([[4.8, 1.95], [5.3, 0.45], [8.4, 0.45], [9.1, 1.95]]);
  for (let i = 0; i + 1 < hd.length; i++) c.capsule(hd[i][0], hd[i][1], hd[i + 1][0], hd[i + 1][1], 0.5 * s, 0.5 * s, { mat: steel, z: z + 1.3 });
  const shroud = c.newPart();
  const a0 = L(10.3, 3.15);
  const a1 = L(18.0, 3.15);
  c.capsule(a0[0], a0[1], a1[0], a1[1], 1.3 * s, 1.3 * s, { mat: steel, z: z + 1.1, part: shroud, round: 0.85 });
  paintLocal(10.5, 2.3, 18.2, 4.1, shroud, (x, y) => {
    const k = Math.round((x - 11.6) / 2);
    if (k < 0 || k > 3) return 0;
    const vx = 11.6 + k * 2;
    return ((x - vx) / 0.5) ** 2 + ((y - 3.25) / 0.55) ** 2 < 1 ? ink : 0;
  });
  const brake = c.newPart();
  c.blob(Ls(rect(17.8, 2.1, 19.1, 4.15)), 0.3, { mat: steel, z: z + 1.4, part: brake, bulge: 0.1 });
  paintLocal(18.5, 2.75, 19.2, 3.55, brake, () => ink);
  c.blob(Ls(rect(4, 4.0, 18.8, 5.0)), 0.3, { mat: steel, z: z + 0.8, bulge: 0.1, tone: -0.3 });
  const drum = p.mat(C.DRUM, { spec: 0.4, shine: 18 });
  if (!g.flip) {
    // The drum hangs under the receiver (held upright, that side faces the face: left off).
    const dc = L(10.0, 6.3);
    c.ellipsoid(dc[0], dc[1], 1.8 * s, 1.9 * s, { mat: drum, z: z + 1.4 });
    c.ellipsoid(dc[0], dc[1], 0.5 * s, 0.5 * s, { mat: steel, z: z + 2.4 });
  }
  c.blob(Ls(rect(11.8, 4.4, 13.7, 7.1)), 0.45, { mat: poly, z: z + 0.4, bulge: 0.12 });
  // Glints: the shroud's top, the receiver's corner.
  for (const [gx, gy, pt] of [[12.4, 2.2, shroud], [15.0, 2.2, shroud], [5.2, 2.3, rec]] as const) {
    const qq = L(gx, gy);
    p.glint(qq[0] - 0.25, qq[1] - 0.25, 0.5, 0.5, C.STEEL.ramp[4], pt);
  }
}

// ------------------------------------------------------------------------------------ held items

/** The held item; returns its 'hand' point (continuous anchor coords) or null. */
function drawHeld(p: Painter, el: V, wr: V, item: Pose['held']): V | null {
  if (!item || item === 'none') return null;
  const c = p.c;
  const e = p.T(el);
  const w = p.T(wr);
  const foreBody = angleTo(el, wr);
  const toAnchor = (q: V): V => [q[0] + p.reg.x, q[1] + p.reg.y];
  const zk = Z.knife;
  const zh = Z.held;
  if (item === 'grenade') {
    const dir = dirOf(angleTo(e, w));
    const cx = w[0] + dir[0] * 2.2;
    const cy = w[1] + dir[1] * 2.2 - 1;
    const m = p.mat(C.DRUM, { spec: 0.5, shine: 20 });
    const part = c.newPart();
    c.ellipsoid(cx, cy, 1.7, 1.9, { mat: m, z: zh, part });
    const steel = p.mat(C.STEEL, { spec: 0.8, shine: 30 });
    c.capsule(cx - 0.6, cy - 1.9, cx + 0.9, cy - 2.2, 0.45, 0.4, { mat: steel, z: zh + 0.5 });
    c.capsule(cx + 0.8, cy - 2.1, cx + 1.4, cy - 0.4, 0.3, 0.3, { mat: steel, z: zh + 0.4 });
    p.glint(cx - 0.9, cy - 1.0, 0.5, 0.5, C.DRUM.ramp[4], part);
    return toAnchor([cx, cy]);
  }
  const ang = (p.pose.heldAngle ?? foreBody - 90) + p.rot;
  const dv: V = [Math.cos(ang * DEG), Math.sin(ang * DEG)];
  const nv: V = [-dv[1], dv[0]];
  const L = (x: number, y: number): V => [w[0] + dv[0] * x + nv[0] * y, w[1] + dv[1] * x + nv[1] * y];
  if (item === 'plan') {
    // The rolled battle plan: a fat paper roll, a blue line spiralling round it, the end-on roll.
    const paper = p.mat(C.PAPER, { spec: 0.2, shine: 12 });
    const ink = p.mat(C.PLAN_INK);
    const part = c.newPart();
    const a = L(-2.4, 0);
    const b = L(7.4, 0);
    c.capsule(a[0], a[1], b[0], b[1], 1.55, 1.55, {
      mat: paper,
      z: zk,
      part,
      round: 0.9,
      tex: (s) => {
        const vx = s.x - w[0];
        const vy = s.y - w[1];
        const lx = vx * dv[0] + vy * dv[1];
        const ly = vx * nv[0] + vy * nv[1];
        const t = lx * 0.62 + ly * 0.8;
        if (lx > 1.5 && lx < 6.6 && Math.abs(((t % 2.4) + 2.4) % 2.4 - 1.2) < 0.28) s.mat = ink;
      },
    });
    const cap = L(7.4, 0);
    c.ellipsoid(cap[0], cap[1], 1.05, 1.05, {
      mat: paper,
      z: zk + 0.6,
      round: 0.4,
      tex: (s) => {
        const r = Math.hypot(s.x - cap[0], s.y - cap[1]);
        if (Math.abs(r - 0.55) < 0.14) s.tone -= 0.6;
      },
    });
    return toAnchor(L(7, 0));
  }
  if (item === 'knife') {
    const handle = p.mat(C.POLYMER);
    const blade = p.mat(C.BLADE, { spec: 0.9, shine: 30 });
    const h0 = L(-0.4, 0);
    const h1 = L(2.4, 0);
    c.capsule(h0[0], h0[1], h1[0], h1[1], 0.7, 0.65, { mat: handle, z: zk });
    const b1 = L(7.6, 0);
    const bp = c.newPart();
    c.blob([L(2.3, -0.75), L(5.6, -0.7), b1, L(5.8, 0.55), L(2.3, 0.6)], 0.3, { mat: blade, z: zk + 0.2, part: bp, bulge: 0.1 });
    const gq = L(4.0, -0.4);
    p.glint(gq[0] - 0.25, gq[1] - 0.25, 0.5, 0.5, C.BLADE.ramp[4], bp);
    return toAnchor(L(7, 0));
  }
  // Other props and treats: the rig's HD art (d 2 / 4), turned like the rig.
  const d = p.d >= 4 ? 4 : 2;
  if (isProp(item)) {
    const art = propHd(item as PropKind, d);
    const b = art.buf.rotated(ang * DEG, { align: d });
    const c0: V = [art.buf.w / d / 2, art.buf.h / d / 2];
    const c1: V = [b.w / d / 2, b.h / d / 2];
    const map = (pt: readonly [number, number]): V => {
      const x = pt[0] + 0.5 - c0[0];
      const y = pt[1] + 0.5 - c0[1];
      return [c1[0] + x * Math.cos(ang * DEG) - y * Math.sin(ang * DEG), c1[1] + x * Math.sin(ang * DEG) + y * Math.cos(ang * DEG)];
    };
    const g = map(art.grip);
    const t = map(art.tip);
    c.image(b, q4(w[0] - g[0]), q4(w[1] - g[1]), { z: zk });
    return toAnchor([q4(w[0] - g[0]) + t[0], q4(w[1] - g[1]) + t[1]]);
  }
  const buf = heldArtHd(item as 'snack' | 'gift', d);
  const dir = dirOf(angleTo(e, w));
  const cx = w[0] + dir[0] * 2;
  const cy = w[1] + dir[1] * 2 - 1;
  c.image(buf, q4(cx - buf.w / d / 2), q4(cy - buf.h / d / 2), { z: zh });
  return toAnchor([cx, cy]);
}

// ------------------------------------------------------------------------------------ the figure

/** The canvas region (continuous anchor coords, integers) that holds the whole figure. */
export function regionOf(pose: Pose, part: RenderPart): Region {
  const sk = solve(pose, part);
  const rot = pose.rot ?? 0;
  const off: V = part === 'upper' ? [0, 0] : [pose.dx ?? 0, pose.dy ?? 0];
  const A = (p: V): V => {
    const r = rotateAbout(p, sk.pelvis, rot);
    return [r[0] + off[0], r[1] + off[1]];
  };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (p: V, r: number): void => {
    const a = A(p);
    x0 = Math.min(x0, a[0] - r);
    y0 = Math.min(y0, a[1] - r);
    x1 = Math.max(x1, a[0] + r);
    y1 = Math.max(y1, a[1] + r);
  };
  take(sk.pelvis, 8);
  if (part !== 'upper') for (const p of [sk.kneeN, sk.ankleN, sk.kneeF, sk.ankleF]) take(p, 9);
  if (part !== 'lower') {
    for (const p of [sk.neck, sk.shN, sk.elN, sk.wrN, sk.shF, sk.elF, sk.wrF]) take(p, 8);
    const k = (pose.headScale === 2 ? 2 : 1) * HEAD_SCALE;
    take([sk.neck[0] + (pose.head?.dx ?? 0), sk.neck[1] + (pose.head?.dy ?? 0)], 15 * k + 2);
    for (const g of [sk.gun, sk.offGun]) if (g) take(g.grip, g.kind === 'heavy' ? 21 * GUN_SCALE.heavy : 11 * GUN_SCALE.pistol);
    if (pose.held && pose.held !== 'none') take(sk.wrN, 14);
  }
  const x = Math.floor(x0) - 2;
  const y = Math.floor(y0) - 2;
  return { x, y, w: Math.ceil(x1) + 2 - x, h: Math.ceil(y1) + 2 - y };
}

/**
 * Paint a pose at density d on the canvas region `reg`. `fit`: the frame box (art px at d) taken
 * from the 4× drawing, for a 2× or 1× render: the drawing is trimmed to the room inside the
 * outline first (as the rig's fitFrame), so the outline wraps a clean edge.
 */
export function paintPose(pose: Pose, part: RenderPart, d: number, reg: Region, fit?: { x: number; y: number; w: number; h: number }): Painted {
  const sk = solve(pose, part);
  const p = new Painter(sk, pose, part, d, reg);
  const c = p.c;
  const upper = part !== 'lower';
  const lower = part !== 'upper';
  const pts: Record<string, V> = {};
  if (upper) {
    if (sk.offGun) drawGun(p, sk.offGun, Z.offGun);
    drawArm(p, sk.shF, sk.elF, sk.wrF, true, Z.farArm);
    drawHand(p, sk.elF, sk.wrF, sk.handF, true, Z.farHand);
  }
  if (lower) {
    drawLeg(p, sk.hipF, sk.kneeF, sk.ankleF, true, false, Z.farLeg);
    drawBoot(p, sk.ankleF, sk.footF, true, Z.farBoot);
    drawLeg(p, sk.hipN, sk.kneeN, sk.ankleN, false, true, Z.nearLeg);
    drawBoot(p, sk.ankleN, sk.footN, false, Z.nearBoot);
  }
  if (upper) {
    drawTorso(p);
    drawTie(p);
    drawBelt(p);
    // A near arm across the face goes behind the head (the rig's rule).
    const nk = sk.neck;
    const inFace = (qq: V): boolean => qq[0] >= nk[0] && qq[0] <= nk[0] + 6 && qq[1] >= nk[1] - 9 && qq[1] <= nk[1] - 1;
    const mid: V = [(sk.elN[0] + sk.wrN[0]) / 2, (sk.elN[1] + sk.wrN[1]) / 2];
    const raised = inFace(sk.wrN) || inFace(mid);
    const hz = raised ? Z.held + 2 : Z.head;
    const big = pose.headScale === 2;
    const hx = pose.head?.dx ?? 0;
    const hy = pose.head?.dy ?? 0;
    const neck = p.T([sk.neck[0] + hx, sk.neck[1] + hy + 1]);
    const tilt = (pose.head?.tilt ?? 0) + p.rot;
    drawArcadeHead({
      c,
      m: {
        skin: p.mat(C.SKIN),
        hair: p.mat(C.HAIR, { spec: 0 }),
        stubble: p.mat(C.STUBBLE),
        brow: p.mat(C.HAIR),
      },
      xf: { at: neck, s: HEAD_SCALE * (big ? 2 : 1), deg: tilt },
      expr: pose.expr ?? 'normal',
      z: hz,
      parts: p.headParts,
      glint: Math.abs(tilt) < 30,
    });
    // The head point: the head centre (head space (1, −6.5)).
    {
      const s = HEAD_SCALE * (big ? 2 : 1);
      const cs = Math.cos(tilt * DEG);
      const sn = Math.sin(tilt * DEG);
      const lx = 1 * s;
      const ly = -6.5 * s;
      const hc: V = [neck[0] + lx * cs - ly * sn, neck[1] + lx * sn + ly * cs];
      pts.head = [hc[0] + reg.x, hc[1] + reg.y];
    }
    if (sk.gun) {
      // Carried low in the far hand (knife, throw): behind the body, as the far hand is.
      drawGun(p, sk.gun, pose.gunHand === 'far' ? Z.farHand + 0.5 : Z.gun);
      pts.muzzle = muzzleOf(p, sk.gun);
    }
    // Aiming up: the near arm passes behind the big head; the gun and the fists stay in front.
    const up = !!sk.gun && pose.aim === 'up' && pose.gunHand !== 'far';
    drawArm(p, sk.shN, sk.elN, sk.wrN, false, up && !raised ? Z.head - 4 : Z.arm);
    // Raised: a gesturing hand (thumbs-up, salute, pointing) stays in front of the big head so it
    // reads; a fist (tucks, guards) and a held prop go behind it with the arm, as the rig does.
    const gesture = sk.handN === 'thumb' || sk.handN === 'open' || sk.handN === 'point';
    const held = drawHeld(p, sk.elN, sk.wrN, pose.held ?? 'none');
    drawHand(p, sk.elN, sk.wrN, sk.handN, false, raised && gesture ? hz + 6 : Z.hand);
    pts.hand = held ?? p.A(sk.wrN);
  }
  if (lower) pts.hip = p.A(sk.pelvis);
  // Glints (only where their part shows).
  for (const g of p.glints) {
    c.paint(g.x, g.y, g.w, g.h, (_x, _y, X, Y) => {
      const i = Y * c.W + X;
      return c.mat[i] !== 0 && c.part[i] === g.part ? g.c : 0;
    });
  }
  if (fit) trimTo(c, fit);
  const buf = c.render({ outline: 'none', ao: 0.12, sepW: d >= 4 ? 2 : 1, sepZ: 0.5, rimLight: 0 });
  tweed(p, buf);
  outline(p, buf, upper && pose.headScale === 2);
  return { buf, pts };
}

/** Trim the G-buffer to the room inside the outline of a frame box (art px). */
function trimTo(c: HdCanvas, f: { x: number; y: number; w: number; h: number }): void {
  const { W, H, d } = c;
  const ax = f.x + d;
  const ay = f.y + d;
  const bx = f.x + f.w - d;
  const by = f.y + f.h - d;
  for (let Y = 0; Y < H; Y++) {
    const inY = Y >= ay && Y < by;
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (c.mat[i] === 0 || (inY && X >= ax && X < bx)) continue;
      c.mat[i] = 0;
      c.fix[i] = 0;
    }
  }
}

/**
 * The tweed weave: a herringbone of short broken threads, one band darker, over every tweed px
 * (4×: two art px threads; 2×: a sparse fleck). Anchored to the pelvis, so it moves with him.
 */
function tweed(p: Painter, buf: PixelBuffer): void {
  const c = p.c;
  const set = new Uint8Array(256);
  for (const m of p.tweedMats) set[m] = 1;
  const ramp = C.TWEED.ramp;
  const down = new Map<Color, Color>();
  const up = new Map<Color, Color>();
  for (let i = 1; i < ramp.length; i++) down.set(ramp[i], ramp[i - 1]);
  for (let i = 0; i + 2 < ramp.length; i++) up.set(ramp[i], ramp[i + 1]);
  const ox = Math.round(p.P0[0] * c.d);
  const oy = Math.round(p.P0[1] * c.d);
  const { W, H } = c;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (set[c.mat[i]] === 0 || c.fix[i] !== 0) continue;
      const x = X - ox + 4096;
      const y = Y - oy + 4096;
      let dark = false;
      let light = false;
      if (c.d >= 4) {
        // Columns 3 art px wide; the threads slant one way in even columns, the other in odd ones.
        const col = Math.floor(x / 3);
        const yy = col % 2 === 0 ? y + (x % 3) : y - (x % 3);
        const ph = ((yy % 6) + 6) % 6;
        dark = ph === 0 && (Math.floor(yy / 6) + col) % 2 === 0;
        light = ph === 3 && (Math.floor(yy / 6) + col) % 3 === 0;
      } else {
        dark = (x * 3 + y * 5) % 11 === 0 || (x * 3 + y * 5) % 11 === 1;
      }
      const cur = buf.data[i];
      if (dark) buf.data[i] = down.get(cur) ?? cur;
      else if (light) buf.data[i] = up.get(cur) ?? cur;
    }
  }
  buf.touch();
}

/** Disc offsets of radius r, nearest first. */
const rings = new Map<number, Int8Array>();
function ring(r: number): Int8Array {
  let o = rings.get(r);
  if (o) return o;
  const list: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const qq = dx * dx + dy * dy;
      if (qq === 0 || qq > r * r + (r > 1 ? r * 0.5 : 0)) continue;
      list.push([dx, dy, qq]);
    }
  }
  list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  o = Int8Array.from(list.flatMap(([dx, dy]) => [dx, dy]));
  rings.set(r, o);
  return o;
}

/**
 * The thick outline: one logical px (d art px) round the silhouette, in the line colour of the
 * nearest part (dark brown round the tweed, deep olive round the trousers, a deep red-brown round
 * the skin, ink round the boots and the gun). The Helium Head's outline turns pink.
 */
function outline(p: Painter, buf: PixelBuffer, helium: boolean): void {
  const c = p.c;
  const { W, H, d } = c;
  const offs = ring(d);
  const ink = C.LEATHER.line;
  const headSet = new Set(p.headParts);
  const lines = new Uint32Array(256);
  for (const [m, col] of p.lineOf) lines[m] = col;
  const px = buf.data;
  const mat = c.mat;
  // Summed-area table of drawn px: an empty px with nothing drawn within d skips the ring scan.
  const W1 = W + 1;
  const sat = new Int32Array(W1 * (H + 1));
  for (let Y = 0; Y < H; Y++) {
    let row = 0;
    for (let X = 0; X < W; X++) {
      if (mat[Y * W + X] !== 0) row++;
      sat[(Y + 1) * W1 + X + 1] = sat[Y * W1 + X + 1] + row;
    }
  }
  for (let Y = 0; Y < H; Y++) {
    const y0 = Y - d < 0 ? 0 : Y - d;
    const y1 = Y + d + 1 > H ? H : Y + d + 1;
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (mat[i] !== 0) continue;
      const x0 = X - d < 0 ? 0 : X - d;
      const x1 = X + d + 1 > W ? W : X + d + 1;
      if (sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0] === 0) continue;
      for (let k = 0; k < offs.length; k += 2) {
        const XX = X + offs[k];
        const YY = Y + offs[k + 1];
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
        const j = YY * W + XX;
        const m = mat[j];
        if (m === 0) continue;
        if (helium && headSet.has(c.part[j])) px[i] = C.HELIUM_RIM;
        else px[i] = lines[m] || ink;
        break;
      }
    }
  }
  buf.touch();
}
