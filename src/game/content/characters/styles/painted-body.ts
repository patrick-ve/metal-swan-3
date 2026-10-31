/**
 * Art-direction trial `painted` (painted.ts): the 2× / 4× figure. A pruned copy of the rig's HD
 * body (src/game/art/hd/body.ts: the same volumes on the same solved skeleton and 1× footprint:
 * capsule limbs, soft cloth blobs, boots, belt, jacket with lapels and placket, tie, cuffs, the
 * rig's HD gun / hands / held items) whose materials are PAINTED materials (painted-paint.ts):
 * a painted ramp, a brush laid along the part (trouser strokes run down the leg, sleeve strokes
 * down the arm, the tweed's strokes slant across the jacket) with the brush frame on the part so
 * the strokes move with it. The head is the painted head (painted-head.ts). The canvas is then
 * painted by `paintRender` (no outline; a soft dark edge on the shadow side).
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { HandShape, Pose, RenderPart } from '../../../art/humanoid';
import { HdCanvas, type DrawOpts, type Texture } from '../../../art/hd/canvas';
import { gunHd, handArtHd, heldArtHd, knifeArtHd, propHd } from '../../../art/hd/gear';
import { isProp, type PropKind } from '../../../art/humanoid-gear';
import { limb, type Pt } from '../../../art/hd/shape';
import { hash2 } from '../../../art/paint';
import { PAL_HD, hdRampOf } from '../../../../engine/palette-hd';
import { paintRender, type PaintMat } from './painted-paint';
import { RAMPS, rampFor, type PaintRamp } from './painted-ramps';
import { drawPaintedHead } from './painted-head';
import { remap, soften } from './painted-soften';
import { DEG, type Dims, type Resolved, type Skeleton, type V } from './painted-rig';

export type Dens = 2 | 4;

export interface BodyRig {
  d: Dens;
  w: number;
  h: number;
  st: Resolved;
  sk: Skeleton;
  pose: Pose;
  part: RenderPart;
  rot: number;
  T: (p: V) => V;
  frame: { x: number; y: number; w: number; h: number };
}

function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}
function angleOf(a: Pt, b: Pt): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
}
/** Screen angle (0 = +x, 90 = down) of a → b. */
function screenAngle(a: Pt, b: Pt): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) / DEG;
}
function addV(a: Pt, b: Pt, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}
function lerpV(a: Pt, b: Pt, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function place(pts: ReadonlyArray<Pt>, p: Pt, deg: number): V[] {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return pts.map(([x, y]) => [p[0] + x * c - y * s, p[1] + x * s + y * c]);
}
function coverOf(c: ReadonlyArray<Pt>): V[] {
  let mx = 0;
  let my = 0;
  for (const q of c) {
    mx += q[0];
    my += q[1];
  }
  mx /= c.length;
  my /= c.length;
  return c.map(([x, y]) => [x + (x >= mx ? 0.5 : -0.5), y + (y >= my ? 0.5 : -0.5)]);
}
function segT(x: number, y: number, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  return ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
}
function par(w: number): number {
  return Math.max(1, Math.round(w)) % 2 === 0 ? 0.5 : 0;
}

/** Base depths (the rig's 1× layer order). */
const Z = {
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

/** Brush seeds per part (stable between frames). */
const SEED = { legN: 11, legF: 12, shinN: 13, shinF: 14, bootN: 15, bootF: 16, torso: 21, lapel: 22, shirt: 23, tie: 24, belt: 25, armN: 31, foreN: 32, armF: 33, foreF: 34, cuff: 35 } as const;

class Painter {
  readonly c: HdCanvas;
  readonly d: Dens;
  readonly r: BodyRig;
  readonly st: Resolved;
  readonly sk: Skeleton;
  readonly dims: Dims;
  readonly P0: V;
  readonly F: V;
  readonly U: V;
  readonly BF: V;
  readonly BD: V;
  readonly H: number;
  private readonly mats = new Map<string, number>();

  constructor(r: BodyRig) {
    this.r = r;
    this.d = r.d;
    this.st = r.st;
    this.sk = r.sk;
    this.dims = r.st.dims;
    this.c = new HdCanvas(r.w, r.h, r.d);
    this.P0 = this.J(r.sk.pelvis);
    const rot = (v: V): V => {
      const c = Math.cos(r.rot * DEG);
      const s = Math.sin(r.rot * DEG);
      return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
    };
    this.F = rot(r.sk.f);
    this.U = rot(r.sk.u);
    this.BF = rot([1, 0]);
    this.BD = rot([0, 1]);
    this.H = this.dims.torsoH - (r.pose.hunch ?? 0);
  }

  q(v: number): number {
    return Math.round(v * this.d) / this.d;
  }
  J(p: V): V {
    const t = this.r.T(p);
    return [this.q(t[0]), this.q(t[1])];
  }
  TL(a: number, b: number): V {
    return [this.P0[0] + this.F[0] * a + this.U[0] * b, this.P0[1] + this.F[1] * a + this.U[1] * b];
  }
  local(x: number, y: number): V {
    const dx = x - this.P0[0];
    const dy = y - this.P0[1];
    return [dx * this.F[0] + dy * this.F[1], dx * this.U[0] + dy * this.U[1]];
  }
  BL(dx: number, dy: number): V {
    return [this.P0[0] + this.BF[0] * dx + this.BD[0] * dy, this.P0[1] + this.BF[1] * dx + this.BD[1] * dy];
  }
  poly(pts: ReadonlyArray<Pt>): V[] {
    return pts.map(([a, b]) => this.TL(a, b));
  }
  cover(pts: ReadonlyArray<Pt>): V[] {
    return coverOf(this.poly(pts));
  }

  /** A painted material per key (one canvas). */
  pm(key: string, make: () => Omit<PaintMat, 'ramp'>): number {
    let m = this.mats.get(key);
    if (m === undefined) {
      const pm = make();
      m = this.c.material({ ...pm, ramp: pm.pr } as PaintMat);
      this.mats.set(key, m);
    }
    return m;
  }

  /**
   * A painted material of ramp `pr` with a brush: direction `dir` (screen degrees), origin `at`
   * (logical px; the part's frame), seed `bs`; `o` overrides (span, len, wid, jit, soft, gloss …).
   */
  paint(key: string, ramp: PaintRamp, bs: number, dir: number, at: Pt, o: Partial<PaintMat> = {}): number {
    const d = this.d;
    return this.pm(`${key}:${bs}:${dir.toFixed(1)}:${at[0].toFixed(2)},${at[1].toFixed(2)}:${JSON.stringify(o)}`, () => ({
      pr: ramp.pr,
      warm: ramp.warm,
      bs,
      dir,
      bo: [at[0] * d, at[1] * d],
      ...o,
    }));
  }
}

// ------------------------------------------------------------------------------------ legs and boots

function limbCaps(p: Painter, pts: readonly V[], radii: readonly number[], o: DrawOpts, mats?: readonly number[]): void {
  const c = p.c;
  const part = o.part ?? c.newPart();
  for (let i = 0; i < pts.length - 1; i++) {
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radii[i], radii[i + 1], { ...o, mat: mats?.[i] ?? o.mat, part });
  }
}

/** Trouser strokes: a fine vertical weave and the odd darker stroke (cloth that has been lived in). */
function trouserTex(p: Painter, a: V, b: V): Texture {
  const d = p.d;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  return (s) => {
    const along = (s.x - a[0]) * ux + (s.y - a[1]) * uy;
    const across = -(s.x - a[0]) * uy + (s.y - a[1]) * ux;
    if (d >= 4) {
      // A long seam-side crease down the leg (painted as a thin darker stroke).
      const k = Math.floor(across * d);
      const h = hash2(k, Math.floor(along * 1.2), 401);
      if (h < 0.1) s.tone -= 0.06;
      else if (h > 0.93) s.tone += 0.05;
    }
  };
}

function drawLeg(p: Painter, hip: V, knee: V, ankle: V, far: boolean, withPelvis: boolean, z: number): void {
  const D = p.dims;
  const c = p.c;
  const h = addV(p.J(hip), [par(D.thighW[0]), par(D.thighW[0])]);
  const kOff = (par(D.thighW[1]) + par(D.shinW[0])) / 2;
  const k = addV(p.J(knee), [kOff, kOff]);
  const a = addV(p.J(ankle), [par(D.shinW[1]), par(D.shinW[1])]);
  const ramp = rampFor(p.st.pants);
  const span: [number, number] = far ? [0, 0.7] : [0, 0.86];
  const thighM = p.paint('pants', ramp, far ? SEED.legF : SEED.legN, screenAngle(h, k), h, { span, len: 2.2, wid: 0.5, jit: 0.05 });
  const shinM = p.paint('pants', ramp, far ? SEED.shinF : SEED.shinN, screenAngle(k, a), k, { span, len: 2.2, wid: 0.5, jit: 0.05 });
  const part = c.newPart();
  const tone = far ? -0.08 : 0;
  const kneeW = Math.max(D.thighW[1], D.shinW[0]) / 2;
  const tt = trouserTex(p, h, a);
  limbCaps(p, [h, k, a], [D.thighW[0] / 2 - 0.1, kneeW - 0.1, D.shinW[1] / 2 - 0.1], { mat: thighM, z, part, tone, round: 0.8, tex: tt }, [thighM, shinM]);
  const ta = angleOf(h, k);
  const sa = angleOf(k, a);
  let bend = sa - ta;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  if (Math.abs(bend) > 8) {
    const sg = Math.sign(bend);
    const kin = addV(k, dirOf((ta + sa) / 2 - 90 * sg), Math.min(1.2, kneeW * 0.55));
    const kout = addV(k, dirOf((ta + sa) / 2 + 90 * sg), kneeW * 0.6);
    // The knee: a soft dark pool inside the bend, a lit cap outside.
    c.shade(kin[0] - 2, kin[1] - 2, 4, 4, (x, y) => {
      const q = Math.hypot(x - kin[0], y - kin[1]);
      return q < 1.1 ? -0.22 * (1 - q / 1.1) : 0;
    }, part);
    if (Math.abs(bend) > 35) c.shade(kout[0] - 2, kout[1] - 2, 4, 4, (x, y) => (Math.hypot(x - kout[0], y - kout[1]) < 0.9 ? 0.08 : 0), part);
  }
  {
    // Folds where the trouser leg bunches above the boot: soft diagonal value strokes.
    const u: V = [Math.sin(sa * DEG), Math.cos(sa * DEG)];
    const nn: V = [u[1], -u[0]];
    for (const t of p.d >= 4 ? [0.62, 0.8] : [0.72]) {
      const m = lerpV(k, a, t);
      c.shade(m[0] - 3, m[1] - 3, 6, 6, (x, y) => {
        const ax = (x - m[0]) * u[0] + (y - m[1]) * u[1];
        const ac = (x - m[0]) * nn[0] + (y - m[1]) * nn[1];
        const dd = Math.abs(ax - ac * 0.45);
        return dd < 0.45 && ac < 0.4 && ac > -D.shinW[1] / 2 + 0.2 ? -0.14 * (1 - dd / 0.45) : 0;
      }, part);
    }
  }
  if (withPelvis) {
    const pel = p.paint('pants', ramp, SEED.legN + 100, -90, p.P0, { len: 2, wid: 0.5 });
    c.blob(coverOf([p.BL(-D.waistB, -2), p.BL(D.waistF, -2), p.BL(D.waistF, 2), p.BL(-D.waistB, 2)]), 1.0, { mat: pel, z: z + 0.3, bulge: 0.3 });
  }
}

const BOOT_UPPER: readonly Pt[] = [[-2.5, -2.5], [1.3, -2.5], [2.2, -1.4], [3.3, -0.6], [4.2, 0.1], [4.5, 0.9], [4.5, 1.7], [-2.5, 1.7], [-2.6, 0.2]];
const BOOT_TOE: readonly Pt[] = [[2.3, -0.7], [3.4, -0.2], [4.3, 0.5], [4.5, 1.6], [2.2, 1.6]];
const BOOT_SOLE: readonly Pt[] = [[-2.5, 1.5], [4.5, 1.5], [4.5, 2.1], [4.15, 2.5], [1.0, 2.5], [0.6, 2.2], [-0.6, 2.2], [-0.95, 2.5], [-2.5, 2.5]];
const BOOT_COLLAR: readonly Pt[] = [[-2.5, -2.5], [1.3, -2.5], [1.5, -1.8], [-2.5, -1.8]];

function drawBoot(p: Painter, ankle: V, foot: number, far: boolean, z: number): void {
  const c = p.c;
  const at = p.J(ankle);
  const deg = p.r.rot - foot;
  const tone = far ? -0.1 : 0;
  const ramp = rampFor(p.st.boots);
  const leather = p.paint('boot', ramp, far ? SEED.bootF : SEED.bootN, deg, at, { gloss: 0.6, soft: 0.3, span: far ? [0, 0.6] : [0, 0.72], len: 1.4, wid: 0.5, jit: 0.03 });
  const part = c.newPart();
  c.blob(place(BOOT_UPPER, at, deg), 1.0, { mat: leather, z, part, bulge: 0.3, tone });
  c.blob(place(BOOT_COLLAR, at, deg), 0.4, { mat: leather, z: z + 0.6, bulge: 0.15, tone: tone - 0.06 });
  c.blob(place(BOOT_TOE, at, deg), 0.8, { mat: leather, z: z + 1.0, bulge: 0.35, tone: tone + 0.05 });
  const sole = p.paint('sole', ramp, 99, deg, at, { span: [0, 0.3], soft: 0.2, bounce: 0.4 });
  c.blob(place(BOOT_SOLE, at, deg), 0.3, { mat: sole, z: z + 1.2, bulge: 0.05 });
}

// ------------------------------------------------------------------------------------ torso

function torsoV(p: Painter, v: number): V[] {
  const D = p.dims;
  const H = p.H;
  const front = D.chestF;
  return [
    [-D.waistB, -2],
    [D.waistF, -2],
    [D.waistF + 1, 2],
    [front + 1, H - 4],
    [front + 0.3, H - 1.2],
    [front - 0.9, H],
    [front - 1.9, H - v],
    [front - 3, H],
    [-D.chestB + 1, H],
    [-D.chestB - 1, H - 2],
    [-D.chestB, 3],
    [-D.waistB, 0],
  ];
}

/** Painted tweed: warm and dark flecks in the weave, a faint broken herringbone (4×). */
function tweedTex(p: Painter): Texture {
  const d = p.d;
  return (s) => {
    const [a, b] = p.local(s.x, s.y);
    const X = Math.floor(a * d);
    const Y = Math.floor(b * d);
    const h = hash2(X >> 1, Y, 77);
    if (h < 0.08) s.tone -= 0.07;
    else if (h > 0.93) s.tone += 0.07;
    if (d >= 4) {
      // Herringbone: alternate slants in 1-logical-px columns, only every other row shows.
      const col = Math.floor(a);
      const yy = b * 2 + (col % 2 === 0 ? a : -a) * 1.2;
      const ph = ((yy % 2) + 2) % 2;
      if (ph < 0.35 && hash2(X, Y, 78) < 0.55) s.tone -= 0.05;
    }
  };
}

function drawTorso(p: Painter): void {
  const c = p.c;
  const st = p.st;
  const D = p.dims;
  const H = p.H;
  const front = D.chestF;
  const z = Z.torso;
  const part = c.newPart();
  const upDeg = screenAngle(p.P0, p.TL(0, 1));
  // The tweed's strokes slant across the jacket (the painter's hand, turned with the torso).
  const main = p.paint('torso', rampFor(st.top), SEED.torso, upDeg + 28, p.P0, { len: 1.6, wid: 0.5, jit: 0.06, soft: 0.42, span: [0, 0.9] });
  const tt = st.acc.has('tweed') ? tweedTex(p) : null;
  // The shirt in the V.
  const shirt = p.paint('shirt', rampFor(st.shirt), SEED.shirt, upDeg, p.TL(front - 2, H), { span: [0.35, 1], len: 1, jit: 0.03, bend: 1 });
  c.blob(p.poly([[front - 3.8, H + 0.5], [front - 0.4, H + 0.5], [front - 1.9, H - 2.8]]), 0.5, { mat: shirt, z: z - 0.4, bulge: 0.2 });
  const pts = p.cover(torsoV(p, 2.6));
  c.blob(pts, 1.4, {
    mat: main,
    z,
    part,
    bulge: 0.38,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      // The placket: a soft dark seam and a lit edge beside it.
      if (b > -1.5 && b < H - 2.6) {
        const w = 0.55 / p.d + 0.08;
        const da = a - (D.waistF - 0.05);
        if (Math.abs(da) < w) s.tone -= 0.16;
        else if (da > 0 && da < 2.2 * w) s.tone += 0.05;
      }
      // The jacket's hem: a soft fold a px above the belt.
      if (b > 0.1 && b < 0.9) s.tone -= 0.05;
      if (tt) tt(s);
    },
  });
  // Buttons: small lit dabs.
  const bm = p.paint('button', RAMPS.tweed, 5, 0, p.P0, { span: [0.25, 1], gloss: 0.8, soft: 0.2 });
  for (let b = 1; b <= H - 3; b += 2) {
    const q = p.TL(D.waistF - 0.6, b);
    c.ellipsoid(q[0], q[1], p.d >= 4 ? 0.36 : 0.45, p.d >= 4 ? 0.36 : 0.45, { mat: bm, z: z + 3.4, round: 0.8 });
  }
  // Lapels and a breast-pocket flap.
  const lap = p.paint('lapel', rampFor(st.top), SEED.lapel, upDeg + 28, p.P0, { len: 1.2, wid: 0.5, jit: 0.05, span: [0, 0.9] });
  c.blob(p.poly([[front - 3.6, H + 0.5], [front - 2.6, H + 0.5], [front - 1.95, H - 2.5], [front - 2.4, H - 2.9]]), 0.3, { mat: lap, z: z + 2.8, bulge: 0.15, tone: 0.08 });
  c.blob(p.poly([[front - 0.5, H + 0.4], [front + 0.2, H - 0.5], [front - 1.75, H - 2.6], [front - 1.95, H - 2.2]]), 0.3, { mat: lap, z: z + 2.8, bulge: 0.15, tone: 0.02 });
  c.blob(p.poly([[-2.6, 3.6], [-0.4, 3.6], [-0.4, 2.7], [-2.5, 2.7]]), 0.3, { mat: lap, z: z + 2.7, bulge: 0.1, tone: 0.05 });
}

function drawTie(p: Painter): void {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const x = D.chestF - 1.5;
  const m = p.paint('tie', rampFor(p.st.accent), SEED.tie, screenAngle(p.TL(x, H), p.TL(x, 2)), p.TL(x, H), { span: [0.3, 1], len: 1.4, wid: 0.5, jit: 0.04, gloss: 0.3, bend: 1 });
  c.blob(p.poly([[x - 0.6, H - 0.3], [x + 0.6, H - 0.3], [x + 0.5, H - 1.4], [x - 0.5, H - 1.4]]), 0.25, { mat: m, z: Z.over + 0.3, tone: 0.06 });
  c.blob(p.poly([[x - 0.35, H - 1.3], [x + 0.35, H - 1.3], [x + 0.7, 3.2], [x, 2.0], [x - 0.6, 3.2]]), 0.3, { mat: m, z: Z.over, bulge: 0.1, tone: -0.03 });
}

function drawBelt(p: Painter): void {
  const c = p.c;
  const D = p.dims;
  const belt = p.paint('belt', rampFor(p.st.belt), SEED.belt, screenAngle(p.TL(0, 0), p.TL(1, 0)), p.P0, { gloss: 0.5, soft: 0.3, span: [0, 0.62], len: 2, jit: 0.03 });
  c.blob(p.cover([[-D.waistB, 0], [D.waistF, 0], [D.waistF, -1], [-D.waistB, -1]]), 0.45, { mat: belt, z: Z.belt, bulge: 0.12 });
  const bx = D.waistF - 1.0;
  const brass = p.paint('brass', RAMPS.brass, 6, 0, p.P0, { gloss: 1, soft: 0.25, span: [0.1, 1], jit: 0.02 });
  c.blob(p.poly([[bx - 0.75, 0.6], [bx + 0.95, 0.6], [bx + 0.95, -1.6], [bx - 0.75, -1.6]]), 0.25, {
    mat: brass,
    z: Z.belt + 0.9,
    bulge: 0.1,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      if (Math.abs(a - bx) < 0.45 && Math.abs(b + 0.5) < 0.55) s.tone -= 0.45;
    },
  });
}

// ------------------------------------------------------------------------------------ arms and hands

function drawArm(p: Painter, shoulder: V, el: V, wr: V, far: boolean, z: number): void {
  const c = p.c;
  const st = p.st;
  const D = p.dims;
  const s = addV(p.J(shoulder), [par(D.armW[0]), par(D.armW[0])]);
  const eo = (par(D.armW[1]) + par(D.foreW[0])) / 2;
  const e = addV(p.J(el), [eo, eo]);
  const w = addV(p.J(wr), [par(D.foreW[1]), par(D.foreW[1])]);
  const tone = far ? -0.12 : 0;
  const ua = angleOf(s, e);
  const fa = angleOf(e, w);
  let bend = fa - ua;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  const elbowW = Math.max(D.armW[1], D.foreW[0]) / 2;
  const ramp = rampFor(st.sleeveUpper);
  const span: [number, number] = far ? [0, 0.6] : [0, 0.9];
  const upM = p.paint('sleeve', ramp, far ? SEED.armF : SEED.armN, screenAngle(s, e), s, { span, len: 1.6, wid: 0.5, jit: 0.06, soft: 0.42 });
  const foM = p.paint('sleeve', ramp, far ? SEED.foreF : SEED.foreN, screenAngle(e, w), e, { span, len: 1.6, wid: 0.5, jit: 0.06, soft: 0.42 });
  const part = c.newPart();
  const tt = st.acc.has('tweed') ? tweedTex(p) : undefined;
  limbCaps(p, [s, e, w], [D.armW[0] / 2 - 0.05, elbowW - 0.05, D.foreW[1] / 2], { mat: upM, z, part, tone, round: 0.82, tex: tt }, [upM, foM]);
  if (Math.abs(bend) >= 14) {
    // Inside the elbow: a soft dark pool of folds.
    const sg = Math.sign(bend);
    const fi = addV(e, dirOf((ua + fa) / 2 - 90 * sg), Math.min(1.1, elbowW * 0.55));
    c.shade(fi[0] - 2, fi[1] - 2, 4, 4, (x, y) => {
      const qd = Math.hypot(x - fi[0], y - fi[1]);
      return qd < 0.95 ? -0.24 * (1 - qd / 0.95) : 0;
    }, part);
  }
  if (st.sleeveFore !== st.skin) {
    // The cuff: a band at the sleeve end with a soft groove.
    const fl = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
    const c1 = lerpV(w, e, Math.min(0.4, 1.4 / fl));
    const c2 = lerpV(w, e, -Math.min(0.12, 0.5 / fl));
    const hw = D.foreW[1] / 2 + 0.1;
    c.blob(limb([c1, c2], [hw, hw], 0), 0.4, { mat: foM, z: z + 0.9, bulge: 0.1, tone: tone + 0.04, tex: (sm) => {
      const t = segT(sm.x, sm.y, c1, c2);
      if (Math.abs(t - 0.4) < (p.d >= 4 ? 0.14 : 0.2)) sm.tone -= 0.16;
    } });
  }
}

function angleOfBody(a: V, b: V): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
}

function drawHand(p: Painter, el: V, wr: V, shape: HandShape, far: boolean, z: number): void {
  const fore = angleOfBody(el, wr) + p.r.rot;
  const q = Math.round((90 - fore) / 90);
  const hand = handArtHd(shape, p.st.gloves, q, false, p.d, far);
  const w = p.J(wr);
  const skin = p.st.gloves === p.st.skin && hdRampOf(p.st.skin) === PAL_HD.skinA;
  const buf = skin ? remap(soften(hand.buf, p.d), PAL_HD.skinA, RAMPS.skin.pr) : soften(hand.buf, p.d);
  p.c.image(buf, w[0] - hand.wrist[0] - 0.5, w[1] - hand.wrist[1] - 0.5, { z });
}

// ------------------------------------------------------------------------------------ gear

interface Placed {
  buf: PixelBuffer;
  grip: V;
  muzzle: V;
}

const placedCache = new Map<string, Placed>();
const PLACED_MAX = 96;

function turned(key: string, buf: PixelBuffer, w1: number, h1: number, grip: Pt, tip: Pt, deg: number, d: number): Placed {
  const k = `${key}|${d}|${deg.toFixed(3)}`;
  const hit = placedCache.get(k);
  if (hit) return hit;
  const g: V = [grip[0] + 0.5, grip[1] + 0.5];
  const m: V = [tip[0] + 0.5, tip[1] + 0.5];
  const qn = Math.round(deg / 90);
  let out: Placed;
  if (Math.abs(deg - qn * 90) < 1e-6) {
    const turns = ((qn % 4) + 4) % 4;
    let b = buf;
    let gg = g;
    let mm = m;
    let hh = h1;
    let ww = w1;
    for (let i = 0; i < turns; i++) {
      gg = [hh - gg[1], gg[0]];
      mm = [hh - mm[1], mm[0]];
      b = b.rotated(Math.PI / 2);
      const t = ww;
      ww = hh;
      hh = t;
    }
    out = { buf: b, grip: gg, muzzle: mm };
  } else {
    const b = buf.rotated(deg * DEG, { align: d });
    const c0: V = [w1 / 2, h1 / 2];
    const c1: V = [b.w / d / 2, b.h / d / 2];
    const cs = Math.cos(deg * DEG);
    const sn = Math.sin(deg * DEG);
    const map = (pt: V): V => {
      const x = pt[0] - c0[0];
      const y = pt[1] - c0[1];
      return [c1[0] + x * cs - y * sn, c1[1] + x * sn + y * cs];
    };
    out = { buf: b, grip: map(g), muzzle: map(m) };
  }
  if (placedCache.size >= PLACED_MAX) placedCache.delete(placedCache.keys().next().value as string);
  placedCache.set(k, out);
  return out;
}

function drawGun(p: Painter, kind: 'pistol' | 'heavy' | 'rifle', angle: number, grip: V, z: number): void {
  const d = p.d;
  const art = gunHd(kind, d);
  const pl = turned(`pgun:${kind}`, soften(art.buf, d), art.buf.w / d, art.buf.h / d, art.grip, art.muzzle, angle + p.r.rot, d);
  const at = p.J(grip);
  p.c.image(pl.buf, at[0] - pl.grip[0], at[1] - pl.grip[1], { z });
}

function drawHeld(p: Painter, el: V, wr: V, item: Pose['held'], zKnife: number, zHeld: number): void {
  if (!item || item === 'none') return;
  const d = p.d;
  const fore = angleOfBody(el, wr);
  const w = p.r.T(wr);
  const wi: V = [w[0] - 0.5, w[1] - 0.5];
  if (item === 'grenade' || item === 'snack' || item === 'gift') {
    const buf = soften(heldArtHd(item, d), d);
    const dir = dirOf(fore + p.r.rot);
    const cx = wi[0] + dir[0] * 2;
    const cy = wi[1] + dir[1] * 2 - 1;
    p.c.image(buf, p.q(cx - buf.w / d / 2), p.q(cy - buf.h / d / 2), { z: zHeld });
    return;
  }
  if (isProp(item)) {
    const art = propHd(item as PropKind, d);
    const ang = (p.r.pose.heldAngle ?? fore - 90) + p.r.rot;
    const pl = turned(`pprop:${item}`, soften(art.buf, d), art.buf.w / d, art.buf.h / d, art.grip, art.tip, ang, d);
    p.c.image(pl.buf, p.q(w[0] - pl.grip[0]), p.q(w[1] - pl.grip[1]), { z: zKnife });
    return;
  }
  const kb = soften(knifeArtHd(d), d);
  const ang = p.r.pose.heldAngle ?? fore - 90;
  const pl = turned('pknife', kb, kb.w / d, kb.h / d, [1, 1], [7, 1], ang, d);
  const dir: V = [Math.cos(ang * DEG), Math.sin(ang * DEG)];
  const cx = wi[0] + dir[0] * 3;
  const cy = wi[1] + dir[1] * 3;
  p.c.image(pl.buf, p.q(cx - pl.buf.w / d / 2), p.q(cy - pl.buf.h / d / 2), { z: zKnife });
}

// ------------------------------------------------------------------------------------ head

function drawHead(p: Painter, z: number): { face: number; hair: number } {
  const pose = p.r.pose;
  const hx = pose.head?.dx ?? 0;
  const hy = pose.head?.dy ?? 0;
  const neck = p.J([p.sk.neck[0] + hx, p.sk.neck[1] + hy + 1]);
  const tilt = (pose.head?.tilt ?? 0) + p.r.rot;
  return drawPaintedHead(
    { c: p.c, d: p.d, mat: (key, ramp, bs, dir, at, o) => p.paint(key, ramp, bs, dir, at, o) },
    p.st,
    { neck, tilt, k: pose.headScale === 2 ? 2 : 1, z, expr: pose.expr ?? 'normal' },
  );
}

// ------------------------------------------------------------------------------------ the figure

/** Draw and paint the figure: (frame.w · d) × (frame.h · d), the 1× frame's rectangle. */
export function drawPaintedBody(r: BodyRig): PixelBuffer {
  const p = new Painter(r);
  const st = r.st;
  const sk = r.sk;
  const pose = r.pose;
  const upper = r.part !== 'lower';
  const lower = r.part !== 'upper';
  let head: { face: number; hair: number } | null = null;
  if (upper) {
    if (sk.offGun) drawGun(p, sk.offGun.kind, sk.offGun.angle, sk.offGun.grip, -16);
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
    if (st.acc.has('tie')) drawTie(p);
    drawBelt(p);
    const nk = sk.neck;
    const inFace = (q: V): boolean => q[0] >= nk[0] && q[0] <= nk[0] + 6 && q[1] >= nk[1] - 9 && q[1] <= nk[1] - 1;
    const mid: V = [(sk.elN[0] + sk.wrN[0]) / 2, (sk.elN[1] + sk.wrN[1]) / 2];
    const raised = inFace(sk.wrN) || inFace(mid);
    head = drawHead(p, raised ? Z.held + 2 : Z.head);
    if (sk.gun) drawGun(p, sk.gun.kind, sk.gun.angle, sk.gun.grip, Z.gun);
    drawArm(p, sk.shN, sk.elN, sk.wrN, false, Z.arm);
    drawHeld(p, sk.elN, sk.wrN, pose.held ?? 'none', Z.knife, Z.held);
    drawHand(p, sk.elN, sk.wrN, sk.handN, false, Z.hand);
  }
  const d = r.d;
  const f = r.frame;
  const clip: [number, number, number, number] = [Math.round(f.x * d), Math.round(f.y * d), Math.round(f.w * d), Math.round(f.h * d)];
  // The Helium Head keeps its pink rim (the status cue), painted as a dabbed glow.
  const rim = head && pose.headScale === 2 ? { parts: [head.face, head.hair], colors: [PAL_HD.pink[3], PAL_HD.pink[3], PAL_HD.pink[4]] } : undefined;
  const out = paintRender(p.c, { clip, grow: 0.9, rim });
  return out.crop(clip[0], clip[1], clip[2], clip[3]);
}
