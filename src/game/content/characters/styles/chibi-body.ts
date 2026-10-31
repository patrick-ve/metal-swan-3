/**
 * Art-direction trial `chibi` (chibi.ts): the chibi figure — own drawer, own skeleton
 * (chibi-rig.ts), own head (chibi-head.ts). Soft lit volumes on an HdCanvas at every density
 * (1× with PAL paints, 2× / 4× with PAL_HD paints), three gentle bands per part, and a thin warm
 * outline: every outline px takes the LINE tone of the part it wraps (a dark tone of that part's
 * own colour), ½ logical px wide at 2× / 4×, 1 px at 1×.
 *
 * Frame contract (human-sprites.ts `PlayerArtOpts.renderPose`): 'full' / 'lower' anchored at the
 * feet centre with the `hip` point, 'upper' anchored at the pelvis with `muzzle`, `hand`, `head`.
 * The 1× render fixes the frame (its rectangle, one px of room around the drawn px, anchor and
 * points); a 2× / 4× frame is drawn on the same logical canvas and cropped to that rectangle.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD, hdHome } from '../../../../engine/palette-hd';
import { HdCanvas, gunHd, heldArtHd, knifeArtHd, propHd, type TexSample } from '../../../art/hd';
import { HELIUM_RIM, type HumanFrame, type Pose, type RenderPart } from '../../../art/humanoid';
import { grenadeArt, gunArt, giftArt, isProp, knifeArt, propArt, snackArt, type HandShape, type PropKind } from '../../../art/humanoid-gear';
import { chibiHead, HEAD } from './chibi-head';
import { faceInk, paint, toon, type Paint, type PaintName } from './chibi-paint';
import { add, BOOT, CHIBI, OFFSET_K, rotateAbout, solveChibi, type ChibiGun, type ChibiSkeleton, type V } from './chibi-rig';

type D = 1 | 2 | 4;
const DEG = Math.PI / 180;

/** The sole line: the 1× outline px rests on the ground row, the HD outline too (see solveChibi). */
const GROUND = -0.6;

/** Base depths, back to front (the rig's layer order). */
const Z = {
  farArm: -14,
  farHand: -11,
  farLeg: -10,
  farBoot: -8.5,
  nearLeg: -6.5,
  nearBoot: -5,
  torso: 0,
  over: 3,
  head: 7.5,
  gun: 10.5,
  arm: 11.5,
  cuff: 12.5,
  knife: 13.8,
  hand: 14.4,
  held: 15,
} as const;

// ------------------------------------------------------------------------------------ geometry

interface Geometry {
  /** The frame rectangle on the canvas (logical px). */
  rect: [number, number, number, number];
  /** The anchor px on the canvas. */
  ax: number;
  ay: number;
  pts: Record<string, readonly [number, number]>;
}

/** The canvas placement of a pose (independent of the density). */
interface Placement {
  sk: ChibiSkeleton;
  /** Body space → canvas (logical px). */
  T: (p: V) => V;
  rot: number;
  W: number;
  H: number;
  /** The anchor px before any re-grounding. */
  ax: number;
  ay: number;
  headScale: number;
}

function placement(pose: Pose, part: RenderPart): Placement {
  const sk = solveChibi(pose, GROUND);
  const rot = pose.rot ?? 0;
  const dx = (pose.dx ?? 0) * OFFSET_K;
  const dy = (pose.dy ?? 0) * OFFSET_K;
  const body = (p: V): V => {
    const r = rotateAbout(p, sk.pelvis, rot);
    return [r[0] + dx, r[1] + dy];
  };
  const headScale = pose.headScale === 2 ? 1.5 : 1;
  // Bounds of everything that may be drawn (body coordinates after the turn).
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (p: V, r: number): void => {
    const q = body(p);
    x0 = Math.min(x0, q[0] - r);
    y0 = Math.min(y0, q[1] - r);
    x1 = Math.max(x1, q[0] + r);
    y1 = Math.max(y1, q[1] + r);
  };
  take(sk.pelvis, 6);
  if (part !== 'upper') for (const p of [sk.kneeN, sk.ankleN, sk.kneeF, sk.ankleF]) take(p, 6);
  if (part !== 'lower') {
    for (const p of [sk.neck, sk.shN, sk.elN, sk.wrN, sk.shF, sk.elF, sk.wrF]) take(p, 5);
    take(headCentre(sk, pose), 11.5 * headScale + 1);
    if (sk.gun) take(sk.gun.grip, 21);
    if (pose.held && pose.held !== 'none') take(sk.wrN, 16);
  }
  const M = 3;
  // The anchor: feet (full / lower) or the pelvis (upper), whole px.
  const ax = Math.ceil(-x0 + M);
  const ay = Math.ceil(-y0 + M);
  const W = Math.ceil(x1 - x0 + 2 * M + 1);
  const H = Math.ceil(y1 - y0 + 2 * M + 1);
  let cx0 = ax + 0.5;
  let cy0 = ay;
  if (part === 'upper') {
    const pel = body(sk.pelvis);
    cx0 = ax + 0.5 - pel[0];
    cy0 = ay + 0.5 - pel[1];
  }
  const T = (p: V): V => {
    const q = body(p);
    return [q[0] + cx0, q[1] + cy0];
  };
  return { sk, T, rot, W: W + 1, H: H + 1, ax, ay, headScale };
}

/** The head centre in body space (before the turn). */
function headCentre(sk: ChibiSkeleton, pose: Pose): V {
  const hx = (pose.head?.dx ?? 0) * 1.2;
  const hy = (pose.head?.dy ?? 0) * 1.5;
  const tilt = pose.head?.tilt ?? 0;
  const neck: V = [sk.neck[0] + hx, sk.neck[1] + hy];
  const s = pose.headScale === 2 ? 1.5 : 1;
  const c: V = [neck[0] + CHIBI.headFwd * s, neck[1] - CHIBI.headUp * s];
  return rotateAbout(c, neck, tilt);
}

const geoCache = new Map<string, Geometry>();
const GEO_MAX = 4000;

/**
 * Render one pose. d 1: the 1× frame (and its geometry, cached); d 2 / 4: the HD frame with the
 * 1× frame's logical size, anchor and points.
 */
export function renderChibi(pose0: Pose, part: RenderPart, d: D): HumanFrame {
  const key = JSON.stringify([part, pose0]);
  const pose = artPose(pose0);
  let g = geoCache.get(key);
  const pl = placement(pose, part);
  if (d === 1 || !g) {
    const one = draw(pl, pose, part, 1, null);
    const tb = one.buf.trimBounds() ?? { x: pl.ax, y: pl.ay, w: 1, h: 1 };
    const rect: [number, number, number, number] = [tb.x - 1, tb.y - 1, tb.w + 2, tb.h + 2];
    let ax = pl.ax;
    let ay = pl.ay;
    // A grounded pose turned by `rot` lies on the floor: rest its lowest px on the ground line.
    if (part !== 'upper' && pose.grounded !== false && pl.rot !== 0) {
      const lowest = tb.y + tb.h - 1;
      const target = pl.ay - 1 + Math.round((pose.dy ?? 0) * OFFSET_K);
      ay = pl.ay - (target - lowest);
    }
    const pts: Record<string, readonly [number, number]> = {};
    for (const [k, p] of Object.entries(one.pts)) pts[k] = [Math.floor(p[0]) - ax, Math.floor(p[1]) - ay];
    g = { rect, ax, ay, pts };
    if (geoCache.size >= GEO_MAX) geoCache.delete(geoCache.keys().next().value as string);
    geoCache.set(key, g);
    if (d === 1) {
      const buf = one.buf.crop(rect[0], rect[1], rect[2], rect[3]);
      return { buf, ox: ax - rect[0], oy: ay - rect[1], pts };
    }
  }
  const hd = draw(pl, pose, part, d, g.rect);
  const [rx, ry, rw, rh] = g.rect;
  const buf = hd.buf.crop(rx * d, ry * d, rw * d, rh * d);
  return { buf, ox: g.ax - rx, oy: g.ay - ry, pts: g.pts, density: d };
}

/**
 * The chibi's acting on top of a pose (drawing only): the big head looks up along a raised gun and
 * down along a lowered one, so the face stays clear of the real-size gun.
 */
function artPose(p: Pose): Pose {
  if (!p.weapon || p.weapon === 'none' || p.gunHand === 'far' || p.armN) return p;
  const aim = p.aim ?? 'fwd';
  const look = aim === 'up' ? -20 : aim === 'diag-up' ? -9 : aim === 'down' ? 10 : aim === 'diag-down' ? 6 : 0;
  const back = aim === 'up' ? -0.8 : 0;
  if (look === 0) return p;
  return { ...p, head: { ...p.head, tilt: (p.head?.tilt ?? 0) + look, dx: (p.head?.dx ?? 0) + back } };
}

// ------------------------------------------------------------------------------------ the painter

interface Ctx {
  c: HdCanvas;
  d: D;
  pl: Placement;
  sk: ChibiSkeleton;
  pose: Pose;
  /** Torso frame on the canvas: pelvis, forward and up (lean + turn). */
  P0: V;
  F: V;
  U: V;
  H: number;
  mats: Map<string, number>;
  /** Fixed-colour parts (head, gun, held) → their line tone lookup is by colour. */
  headPart: number;
}

function J(k: Ctx, p: V): V {
  return k.pl.T(p);
}

function TL(k: Ctx, a: number, b: number): V {
  return [k.P0[0] + k.F[0] * a + k.U[0] * b, k.P0[1] + k.F[1] * a + k.U[1] * b];
}

function mat(k: Ctx, name: PaintName, o: Record<string, number | boolean> = {}): number {
  const key = name + JSON.stringify(o);
  let m = k.mats.get(key);
  if (m === undefined) {
    m = toon(k.c, paint(name, k.d), o);
    k.mats.set(key, m);
  }
  return m;
}

/** A rotated ellipsoid (heightField): centre, radii, turn (deg, clockwise). */
function rotEll(c: HdCanvas, cx: number, cy: number, rx: number, ry: number, ang: number, o: { mat: number; part?: number; z?: number; tone?: number; tex?: ((s: TexSample) => void) | null; round?: number }): void {
  const cs = Math.cos(ang * DEG);
  const sn = Math.sin(ang * DEG);
  const m = Math.max(rx, ry);
  const rz = Math.min(rx, ry) * (o.round ?? 1);
  c.heightField(cx - m, cy - m, 2 * m, 2 * m, (x, y) => {
    const lx = (x - cx) * cs + (y - cy) * sn;
    const ly = -(x - cx) * sn + (y - cy) * cs;
    const q = (lx / rx) ** 2 + (ly / ry) ** 2;
    return q > 1 ? NaN : rz * Math.sqrt(1 - q);
  }, { mat: o.mat, part: o.part, z: o.z, tone: o.tone, tex: o.tex ?? null });
}

interface Drawn {
  buf: PixelBuffer;
  /** Canvas points (logical). */
  pts: Record<string, V>;
}

function draw(pl: Placement, pose: Pose, part: RenderPart, d: D, rect: readonly [number, number, number, number] | null): Drawn {
  const c = new HdCanvas(pl.W, pl.H, d);
  const sk = pl.sk;
  const rotV = (v: V): V => {
    const cs = Math.cos(pl.rot * DEG);
    const sn = Math.sin(pl.rot * DEG);
    return [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs];
  };
  const k: Ctx = { c, d, pl, sk, pose, P0: pl.T(sk.pelvis), F: rotV(sk.f), U: rotV(sk.u), H: CHIBI.torsoH - (pose.hunch ?? 0) * 0.8, mats: new Map(), headPart: -1 };
  const upper = part !== 'lower';
  const lower = part !== 'upper';
  const pts: Record<string, V> = {};

  if (upper) {
    drawArm(k, sk.shF, sk.elF, sk.wrF, true, Z.farArm);
    drawHand(k, sk.elF, sk.wrF, sk.handF, true, Z.farHand);
  }
  if (lower) {
    drawLeg(k, sk.hipF, sk.kneeF, sk.ankleF, true, Z.farLeg);
    drawBoot(k, sk.ankleF, sk.footF, true, Z.farBoot);
    drawLeg(k, sk.hipN, sk.kneeN, sk.ankleN, false, Z.nearLeg);
    drawBoot(k, sk.ankleN, sk.footN, false, Z.nearBoot);
  }
  if (upper) {
    drawTorso(k);
    // The short near arm stays in front of the big head (a raised fist sits by the cheek), unless
    // its hand would cover the eyes: then it goes behind the head.
    const hc = headCentre(sk, pose);
    const overFace = (p: V): boolean => {
      const u = (p[0] - hc[0]) / (HEAD.rx * pl.headScale);
      const v = (p[1] - hc[1]) / (HEAD.ry * pl.headScale);
      // The eyes; or (a falling, tumbling figure) anywhere on the face side of the head.
      if (u > -0.05 && u < 0.95 && v > -0.42 && v < 0.38) return true;
      return Math.abs(pl.rot) > 30 && u > -0.15 && u * u + v * v < 1;
    };
    const behind = overFace(sk.wrN);
    const hz = behind ? Z.held + 2 : Z.head;
    const head = drawHead(k, hc, hz);
    pts.head = head;
    if (sk.gun) pts.muzzle = drawGun(k, sk.gun, Z.gun);
    drawArm(k, sk.shN, sk.elN, sk.wrN, false, Z.arm);
    const held = drawHeld(k, sk.elN, sk.wrN, pose.held ?? 'none');
    drawHand(k, sk.elN, sk.wrN, sk.handN, false, Z.hand);
    pts.hand = held ?? J(k, sk.wrN);
  }
  if (rect) fit(c, rect, d === 1 ? 1 : 0.5);
  const buf = c.render({ outline: 'none', ao: 0.28, sepZ: 0.5, clean: true, rimLight: 0 });
  fixedSeparations(c, buf, d);
  warmOutline(c, buf, d, pose.headScale === 2 ? k.headPart : -1);
  if (part !== 'upper') {
    const p = pl.T(sk.pelvis);
    pts.hip = p;
  }
  return { buf, pts };
}

/** Drop what reaches past the frame rectangle less the outline's width (the outline stays whole). */
function fit(c: HdCanvas, rect: readonly [number, number, number, number], ow: number): void {
  const [x, y, w, h] = rect;
  c.erase(0, 0, c.w, c.h, (px, py) => px < x + ow || py < y + ow || px > x + w - ow || py > y + h - ow);
}

// ------------------------------------------------------------------------------------ parts

function drawLeg(k: Ctx, hip: V, knee: V, ankle: V, far: boolean, z: number): void {
  const c = k.c;
  const m = mat(k, 'pants');
  const part = c.newPart();
  const h = J(k, hip);
  const kn = J(k, knee);
  const an = J(k, ankle);
  const tone = far ? -0.18 : 0;
  c.capsule(h[0], h[1], kn[0], kn[1], 2.0, 1.85, { mat: m, part, z, tone, round: 0.8 });
  c.capsule(kn[0], kn[1], an[0], an[1], 1.85, 1.7, { mat: m, part, z, tone, round: 0.8 });
  if (!far) {
    // The seat of the trousers under the jacket.
    const seat = add(h, [-0.7 * k.F[0] + 0.5 * -k.U[0], -0.7 * k.F[1] + 0.5 * -k.U[1]]);
    c.ellipsoid(seat[0], seat[1], 3.2, 2.2, { mat: m, part, z: z - 0.2, round: 0.7 });
  }
}

function drawBoot(k: Ctx, ankle: V, foot: number, far: boolean, z: number): void {
  const c = k.c;
  const a = J(k, ankle);
  const ang = -foot + k.pl.rot;
  const cs = Math.cos(ang * DEG);
  const sn = Math.sin(ang * DEG);
  const cx = a[0] + BOOT.cx * cs - BOOT.cy * sn;
  const cy = a[1] + BOOT.cx * sn + BOOT.cy * cs;
  const boot = mat(k, 'boots', { spec: 0.45, shine: 18 });
  const sole = mat(k, 'sole');
  const part = c.newPart();
  rotEll(c, cx, cy, BOOT.rx, BOOT.ry, ang, {
    mat: boot,
    part,
    z,
    round: 0.85,
    tone: far ? -0.15 : 0,
    tex: (s) => {
      // The sole: the lowest band of the boot in the sole tone.
      const ly = -(s.x - cx) * sn + (s.y - cy) * cs;
      if (ly > BOOT.ry - 0.75) {
        s.mat = sole;
        s.nx = 0;
        s.ny = 0.2;
        s.nz = 1;
      }
    },
  });
}

/** The jacket: a soft little bell over the pelvis, the shirt V, the thin tie, the lapels. */
function drawTorso(k: Ctx): void {
  const c = k.c;
  const H = k.H;
  const tweed = mat(k, 'tweed');
  const part = c.newPart();
  const P = (a: number, b: number): V => TL(k, a, b);
  const body: V[] = [
    P(-3.9, -1.7),
    P(4.1, -1.7),
    P(4.2, 1.5),
    P(3.9, H - 2.0),
    P(3.2, H - 0.3),
    P(1.8, H + 0.6),
    P(-1.8, H + 0.6),
    P(-3.3, H - 0.4),
    P(-3.7, H - 2.4),
    P(-4.0, 1.0),
  ];
  const fleck = (s: TexSample): void => {
    // Tweed: a soft fleck of light and dark threads (HD), a hint of a herringbone.
    if (k.d === 1) return;
    const r = hash(s.X, s.Y, 11);
    if (r < 0.1) s.tone += 0.22;
    else if (r > 0.9) s.tone -= 0.22;
    if (k.d >= 4 && ((s.X + (s.Y >> 1)) % 6 === 0)) s.tone -= 0.06;
  };
  c.blob(body, 1.7, { mat: tweed, part, z: Z.torso, bulge: 0.35, tex: fleck });
  // The hem: a darker band and the jacket's front edge.
  c.shade(0, 0, c.w, c.h, (x, y) => {
    const [a, b] = local(k, x, y);
    if (b < -1.0) return -0.12;
    if (Math.abs(a - 2.5 - (b - 2.5) * -0.15) < 0.18 && b < 3.2 && b > -1.6) return -0.25;
    return 0;
  }, part);
  // The shirt V and the tie.
  const shirt = mat(k, 'shirt', { amb: 0.4 });
  const tie = mat(k, 'tie', { amb: 0.35, spec: 0.3, shine: 14 });
  const sp = c.newPart();
  const vTop = H + 0.3;
  c.poly([P(0.7, vTop), P(3.6, vTop), P(2.55, 2.8)], { mat: shirt, part: sp, z: Z.over });
  const tp = c.newPart();
  c.blob([P(1.95, H - 0.2), P(2.95, H - 0.2), P(2.7, H - 1.15), P(2.2, H - 1.15)], 0.3, { mat: tie, part: tp, z: Z.over + 0.6, bulge: 0.15 });
  c.blob([P(2.25, H - 1.05), P(2.65, H - 1.05), P(2.95, 3.0), P(2.55, 2.1), P(2.15, 3.0)], 0.3, { mat: tie, part: tp, z: Z.over + 0.5, bulge: 0.1 });
  // Lapels: the jacket's turned-back edges along the V.
  const lp = c.newPart();
  c.blob([P(0.4, vTop + 0.2), P(1.25, vTop + 0.2), P(2.5, 2.6), P(2.0, 2.3)], 0.35, { mat: tweed, part: lp, z: Z.over + 0.8, tone: 0.12, bulge: 0.1, tex: fleck });
  c.blob([P(3.4, vTop + 0.2), P(4.0, vTop - 0.3), P(2.8, 2.4), P(2.5, 2.6)], 0.35, { mat: tweed, part: lp, z: Z.over + 0.8, tone: -0.02, bulge: 0.1, tex: fleck });
  // A pocket flap at the hip (HD).
  if (k.d > 1) {
    const pp = c.newPart();
    c.blob([P(0.6, 0.9), P(3.3, 0.9), P(3.2, 0.3), P(0.7, 0.3)], 0.2, { mat: tweed, part: pp, z: Z.over + 0.2, tone: -0.06, bulge: 0.05, tex: fleck });
  }
}

/** Torso-frame coordinates (a forward, b up from the pelvis) of a canvas point. */
function local(k: Ctx, x: number, y: number): V {
  const dx = x - k.P0[0];
  const dy = y - k.P0[1];
  return [dx * k.F[0] + dy * k.F[1], dx * k.U[0] + dy * k.U[1]];
}

function hash(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

function drawArm(k: Ctx, sh: V, el: V, wr: V, far: boolean, z: number): void {
  const c = k.c;
  const tweed = mat(k, 'tweed');
  const part = c.newPart();
  const s = J(k, sh);
  const e = J(k, el);
  const w = J(k, wr);
  const tone = far ? -0.2 : 0;
  c.capsule(s[0], s[1], e[0], e[1], 1.55, 1.42, { mat: tweed, part, z, tone, round: 0.8 });
  c.capsule(e[0], e[1], w[0], w[1], 1.42, 1.32, { mat: tweed, part, z, tone, round: 0.8 });
  // The white shirt cuff at the wrist.
  const len = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
  const u: V = [(w[0] - e[0]) / len, (w[1] - e[1]) / len];
  const shirt = mat(k, 'shirt', { amb: 0.35 });
  const cp = c.newPart();
  const a = add(w, u, -0.25);
  const b = add(w, u, 0.35);
  c.capsule(a[0], a[1], b[0], b[1], 1.18, 1.12, { mat: shirt, part: cp, z: z + 0.6, tone, round: 0.8 });
}

/** Little round hands (mittens) at the wrist. */
function drawHand(k: Ctx, el: V, wr: V, shape: HandShape, far: boolean, z: number): void {
  const c = k.c;
  const skin = mat(k, 'skin', { amb: 0.38, wrap: 0.35, gain: 0.8 });
  const e = J(k, el);
  const w = J(k, wr);
  const len = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
  const u: V = [(w[0] - e[0]) / len, (w[1] - e[1]) / len];
  const ang = Math.atan2(u[1], u[0]) / DEG;
  const part = c.newPart();
  const tone = far ? -0.2 : 0;
  const cen = add(w, u, 1.05);
  if (shape === 'open') {
    rotEll(c, cen[0] + u[0] * 0.3, cen[1] + u[1] * 0.3, 1.95, 1.3, ang, { mat: skin, part, z, tone, round: 0.8 });
    return;
  }
  c.ellipsoid(cen[0], cen[1], 1.55, 1.5, { mat: skin, part, z, tone, round: 0.85 });
  if (shape === 'thumb') {
    // Thumb up: a small bump on top.
    c.capsule(cen[0] - 0.1, cen[1] - 0.6, cen[0] - 0.2, cen[1] - 2.3, 0.62, 0.55, { mat: skin, part, z: z + 0.4, tone, round: 0.8 });
  } else if (shape === 'point') {
    const t = add(cen, u, 2.2);
    c.capsule(cen[0], cen[1], t[0], t[1], 0.6, 0.5, { mat: skin, part, z: z + 0.4, tone, round: 0.8 });
  }
}

function drawHead(k: Ctx, hcBody: V, z: number): V {
  const pose = k.pose;
  const hs = chibiHead(pose.expr ?? 'normal', k.d, k.pl.headScale);
  const tilt = (pose.head?.tilt ?? 0) + k.pl.rot;
  const d = k.d;
  let buf = hs.buf;
  if (Math.abs(tilt) >= 3) buf = buf.rotated(tilt * DEG, { align: d });
  const cen = J(k, hcBody);
  const part = k.c.newPart();
  k.headPart = part;
  // Snap the head to the art grid: the same px in every frame.
  const x = Math.round((cen[0] - buf.w / d / 2) * d) / d;
  const y = Math.round((cen[1] - buf.h / d / 2) * d) / d;
  k.c.image(buf, x, y, { z, part });
  return cen;
}

// ------------------------------------------------------------------------------------ gear

interface Placed {
  buf: PixelBuffer;
  grip: V;
  tip: V;
}

const placedCache = new Map<string, Placed>();

/** An item buffer at density d turned by `deg` (the rig's `turned`): logical grip and tip. */
function turned(key: string, buf: PixelBuffer, d: number, grip: readonly [number, number], tip: readonly [number, number], deg: number): Placed {
  const ck = `${key}|${d}|${deg.toFixed(2)}`;
  const hit = placedCache.get(ck);
  if (hit) return hit;
  const w1 = buf.w / d;
  const h1 = buf.h / d;
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
    out = { buf: b, grip: gg, tip: mm };
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
    out = { buf: b, grip: map(g), tip: map(m) };
  }
  if (placedCache.size > 200) placedCache.delete(placedCache.keys().next().value as string);
  placedCache.set(ck, out);
  return out;
}

const flips = new Map<string, PixelBuffer>();

/** A gun buffer mirrored top to bottom (cached). */
function flipCache(key: string, buf: PixelBuffer): PixelBuffer {
  let f = flips.get(key);
  if (!f) flips.set(key, (f = buf.flipped(false, true)));
  return f;
}

/** The real-size gun at the near hand; returns the canvas muzzle (the first px past the barrel). */
function drawGun(k: Ctx, g: ChibiGun, z: number): V {
  const d = k.d;
  const lo = gunArt(g.kind);
  let buf = d === 1 ? lo.buf : gunHd(g.kind, d).buf;
  let grip: readonly [number, number] = lo.grip;
  let muzzle: readonly [number, number] = lo.muzzle;
  // Raised steeply, the gun turns its grip towards the face (mirrored before the turn): the
  // real-size gun then reaches forward, away from the big head.
  const flip = g.angle < -60;
  if (flip) {
    const h1 = lo.buf.h;
    buf = flipCache(`${g.kind}:${d}`, buf);
    grip = [grip[0], h1 - 1 - grip[1]];
    muzzle = [muzzle[0], h1 - 1 - muzzle[1]];
  }
  const pl = turned(`gun:${g.kind}${flip ? ':f' : ''}`, buf, d, grip, muzzle, g.angle + k.pl.rot);
  const at = J(k, g.grip);
  const x = Math.round((at[0] - pl.grip[0]) * d) / d;
  const y = Math.round((at[1] - pl.grip[1]) * d) / d;
  k.c.image(pl.buf, x, y, { z });
  return [x + pl.tip[0], y + pl.tip[1]];
}

/** The held item (the battle plan, a knife, a grenade …); returns the canvas `hand` point. */
function drawHeld(k: Ctx, el: V, wr: V, item: NonNullable<Pose['held']>): V | null {
  if (item === 'none') return null;
  const d = k.d;
  const e = J(k, el);
  const w = J(k, wr);
  const fore = Math.atan2(w[0] - e[0], w[1] - e[1]) / DEG;
  const rot = k.pl.rot;
  const len = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
  const u: V = [(w[0] - e[0]) / len, (w[1] - e[1]) / len];
  const fist = add(w, u, 1.05);
  if (item === 'grenade' || item === 'snack' || item === 'gift') {
    const lo = item === 'grenade' ? grenadeArt() : item === 'snack' ? snackArt() : giftArt();
    const buf = d === 1 ? lo : heldArtHd(item, d);
    const cx = fist[0] + u[0] * 1.2;
    const cy = fist[1] + u[1] * 1.2 - 1;
    const x = Math.round((cx - lo.w / 2) * d) / d;
    const y = Math.round((cy - lo.h / 2) * d) / d;
    k.c.image(buf, x, y, { z: Z.held });
    return [cx, cy];
  }
  if (isProp(item)) {
    const lo = propArt(item as PropKind);
    const buf = d === 1 ? lo.buf : propHd(item as PropKind, d).buf;
    const ang = (k.pose.heldAngle ?? fore - 90) + rot;
    const pl = turned(`prop:${item}`, buf, d, lo.grip, lo.tip, ang);
    const x = Math.round((fist[0] - pl.grip[0]) * d) / d;
    const y = Math.round((fist[1] - pl.grip[1]) * d) / d;
    k.c.image(pl.buf, x, y, { z: Z.knife });
    return [x + pl.tip[0], y + pl.tip[1]];
  }
  // Knife: the handle in the fist, the blade along heldAngle.
  const lo = knifeArt();
  const buf = d === 1 ? lo : knifeArtHd(d);
  const ang = k.pose.heldAngle ?? fore - 90;
  const pl = turned('knife', buf, d, [1, 1], [7, 1], ang);
  const x = Math.round((fist[0] - pl.grip[0]) * d) / d;
  const y = Math.round((fist[1] - pl.grip[1]) * d) / d;
  k.c.image(pl.buf, x, y, { z: Z.knife });
  return [x + pl.tip[0], y + pl.tip[1]];
}

// ------------------------------------------------------------------------------------ lines

/** The line tone of a fixed-colour px (head, gun, held items): its paint's line, else a dark tone of its HD ramp. */
const lineCache = new Map<number, Map<Color, Color>>();

function lineOfFixed(col: Color, d: number): Color {
  let m = lineCache.get(d);
  if (!m) {
    m = new Map();
    const names: PaintName[] = ['stubble', 'tweed', 'tie', 'shirt', 'pants', 'boots', 'sole', 'belt', 'hair', 'skin'];
    for (const n of names) {
      const p: Paint = paint(n, d);
      for (const b of p.bands) m.set(b >>> 0, p.line);
      if (p.sheen !== undefined) m.set(p.sheen >>> 0, p.line);
    }
    const ink = faceInk(d);
    for (const v of Object.values(ink)) if (!m.has((v as Color) >>> 0)) m.set((v as Color) >>> 0, paint('skin', d).line);
    lineCache.set(d, m);
  }
  const hit = m.get(col >>> 0);
  if (hit !== undefined) return hit;
  if (d === 1) return INK;
  const home = hdHome(col);
  if (!home) return PAL_HD.ink[0];
  // Metal and dark items: ink; light items: a deep tone of their own ramp.
  return home.i <= 2 || home.ramp === PAL_HD.steel ? PAL_HD.ink[0] : home.ramp[Math.max(0, Math.min(1, home.i - 3))];
}

/**
 * Separations on fixed-colour parts (the head, guns, held items): their px next to a NEARER part
 * take their own line tone (the canvas only separates lit parts).
 */
function fixedSeparations(c: HdCanvas, out: PixelBuffer, d: number): void {
  const { W, H, mat, part, pz, fix } = c;
  const data = out.data;
  const marks: number[] = [];
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (mat[i] === 0 || fix[i] === 0) continue;
      const p = part[i];
      const z0 = pz[i] + 0.5;
      let hit = false;
      for (const [dx, dy] of N4) {
        const XX = X + dx;
        const YY = Y + dy;
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
        const j = YY * W + XX;
        if (mat[j] !== 0 && part[j] !== p && pz[j] > z0) {
          hit = true;
          break;
        }
      }
      if (hit) marks.push(i);
    }
  }
  for (const i of marks) data[i] = lineOfFixed(fix[i], d) >>> 0;
  void PAL;
  out.touch();
}

const N4: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const ringCache = new Map<number, Array<[number, number]>>();

function ring(r: number): Array<[number, number]> {
  let o = ringCache.get(r);
  if (o) return o;
  const list: Array<[number, number, number]> = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const q = dx * dx + dy * dy;
      if (q === 0 || q > r * r + (r > 1 ? r * 0.5 : 0)) continue;
      list.push([dx, dy, q]);
    }
  }
  list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  o = list.map(([dx, dy]) => [dx, dy]);
  ringCache.set(r, o);
  return o;
}

/**
 * The thin warm outline: every empty px within ½ logical px (1 px at 1×) of the figure takes the
 * line tone of the nearest drawn px's part. The Helium Head's outline turns pink.
 */
function warmOutline(c: HdCanvas, out: PixelBuffer, d: number, headPart: number): void {
  const { W, H, mat, fix, part } = c;
  const data = out.data;
  const r = d === 1 ? 1 : d / 2;
  const offs = ring(r);
  const pink = d === 1 ? HELIUM_RIM : (PAL_HD.pink[3] as Color);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (mat[i] !== 0) continue;
      for (const [dx, dy] of offs) {
        const XX = X + dx;
        const YY = Y + dy;
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
        const j = YY * W + XX;
        if (mat[j] === 0) continue;
        if (headPart >= 0 && part[j] === headPart) data[i] = pink >>> 0;
        else data[i] = (fix[j] !== 0 ? lineOfFixed(fix[j], d) : c.getMaterial(mat[j]).ramp[0]) >>> 0;
        break;
      }
    }
  }
  out.touch();
}
