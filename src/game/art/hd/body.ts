/**
 * THE HD RIG BODY (docs/ART_GUIDE.md "UHD art", rig contracts): one density-generic drawer for the
 * human figure at 2× and 4×. humanoid.ts solves the skeleton (the same solve as the 1× art, with
 * the ground contact unrounded) and hands it here; this module paints every part on one HdCanvas
 * with lit volumes (the style spike's approach: soft cloth and leather `blob`s over limb and panel
 * outlines, folds at elbows and knees, seams, pockets, belts, straps, boots with soles, laces at
 * 4×), places the HD head (`renderHeadHd`), the HD gear (`gunHd`, `handArtHd`, `knifeArtHd`,
 * `propHd`, `heldArtHd`) as fixed-colour images, and renders with outline A, a cool rim light and
 * interior separations.
 *
 * Coordinates are LOGICAL px of the region canvas (floats). `BodyRig.T` maps body space to the
 * CENTRE of the 1× canvas pixel a point rounds to (index + 0.5), unrounded; joints are then
 * quantised to 1 / d px (motion in fine steps at 4×). The 1× pixel footprint of every part is
 * kept (limbs keep the 1× capsule's centring and widths, panels the 1× polygon's pixel cover), so
 * the HD silhouette matches the 1× one and fits the 1× frame rectangle.
 *
 * Depth: every part has a base depth `z` in the 1× layer order (back to front); a nearer part
 * draws a separation (the deepest tone) and ambient occlusion on the part behind it.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { PAL } from '../../../engine/palette';
import { PAL_HD, hdHome, hdRampOf } from '../../../engine/palette-hd';
import type { Accessory, HandShape, HumanStyle, Pose, PropKind, RenderPart } from '../humanoid';
import { isProp } from '../humanoid-gear';
import { HEAD_CENTER, HEAD_H, HEAD_W, NECK, type HeadStyle } from '../humanoid-head';
import { HdCanvas, inPoly, type DrawOpts, type HdMaterial, type Texture } from './canvas';
import { gunHd, handArtHd, heldArtHd, knifeArtHd, propHd } from './gear';
import { renderHeadHd, type HdDensity } from './head';
import { limb, type Pt } from './shape';

type V = [number, number];

/** Body proportions (humanoid.ts BUILDS). */
export interface BodyDims {
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

/** The resolved style (1× ramps; humanoid.ts `resolve`). */
export interface BodyStyle {
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
  dims: BodyDims;
  acc: ReadonlySet<Accessory>;
  s: HumanStyle;
}

export interface BodyGun {
  kind: 'pistol' | 'heavy' | 'rifle';
  /** Degrees: 0 forward, −90 up, 90 down. */
  angle: number;
  /** Body-space grip point. */
  grip: V;
}

/** The solved skeleton in body space (humanoid.ts `solve`). */
export interface BodySkeleton {
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
  gun: BodyGun | null;
  offGun: BodyGun | null;
}

export interface BodyRig {
  d: HdDensity;
  /** Region canvas size, logical px. */
  w: number;
  h: number;
  st: BodyStyle;
  sk: BodySkeleton;
  pose: Pose;
  part: RenderPart;
  /** Whole-figure rotation (deg, clockwise). */
  rot: number;
  /** Body space → the region canvas (logical, the centre of the 1× pixel; unrounded). */
  T: (p: V) => V;
  /**
   * The 1× frame's rectangle on the region canvas (logical px): the result is that rectangle at
   * density d (see `fitFrame`). Without it the whole region canvas is returned.
   */
  frame?: { x: number; y: number; w: number; h: number };
}

/**
 * Counters of the HD frame fit (tools and tests): frames drawn, frames whose drawing reached past
 * the room inside the outline (those px are trimmed, so the outline stays whole), and the most px
 * trimmed from one frame.
 */
export const HD_FIT = { frames: 0, trimmed: 0, maxTrimPx: 0 };

/** Colour of the Helium Head's rim (humanoid.ts HELIUM_RIM). */
const HELIUM_RIM: Color = PAL.pink[1];

const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------ ramps

interface Span {
  ramp: Ramp;
  lo: number;
  hi: number;
}

const spanCache = new Map<Ramp, Span>();

/**
 * The light bands of a style ramp: the HD tones its 1× colours span (a black boot stays black, a
 * dark olive stays dark), widened to at least four diffuse bands; the deepest tone stays free for
 * separations and the top tone for sheen where there is room.
 */
export function spanOf(r: Ramp): Span {
  const hit = spanCache.get(r);
  if (hit) return hit;
  const ramp = hdRampOf(r);
  const n = ramp.length;
  let a = n;
  let b = -1;
  for (const col of r) {
    const h = hdHome(col);
    const i = h && h.ramp === ramp ? h.i : ramp.indexOf(col);
    if (i < 0) continue;
    a = Math.min(a, i);
    b = Math.max(b, i);
  }
  let lo = b < 0 ? 1 : Math.max(1, a - 1);
  let hi = b < 0 ? n - 2 : Math.min(n - 1, b);
  hi = Math.max(hi, Math.min(n - 2, lo + 3));
  lo = Math.min(lo, Math.max(1, hi - 3));
  const s: Span = { ramp, lo, hi: Math.max(lo + 1, hi) };
  spanCache.set(r, s);
  return s;
}

// ------------------------------------------------------------------------------------ geometry

/** Unit direction of an angle measured from straight down, + towards +x. */
function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}

/** Angle (from straight down, + towards +x) of the vector a → b. */
function angleOf(a: Pt, b: Pt): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
}

function addV(a: Pt, b: Pt, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

function lerpV(a: Pt, b: Pt, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Local shape points (x forward, y down) turned clockwise by `deg` and placed at p. */
function place(pts: ReadonlyArray<Pt>, p: Pt, deg: number): V[] {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return pts.map(([x, y]) => [p[0] + x * c - y * s, p[1] + x * s + y * c]);
}

/** The 1× pixel cover of a canvas polygon through 1×-pixel centres (half a px out per axis). */
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

/** Distance of (x, y) from the segment a–b, and the position t (0..1) along it. */
function segT(x: number, y: number, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  return ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
}

/** Offset of the centre of a 1× capsule end of diameter w: even diameters sit on pixel corners. */
function par(w: number): number {
  return Math.max(1, Math.round(w)) % 2 === 0 ? 0.5 : 0;
}

// ------------------------------------------------------------------------------------ the painter

/** Base depths (back to front, the 1× layer order). */
const Z = {
  capeBack: -24,
  pack: -21,
  scarfBack: -18,
  offGun: -16,
  farArm: -14,
  farHand: -11,
  farLeg: -10,
  farBoot: -8.5,
  nearLeg: -6.5,
  nearBoot: -5,
  tails: -3.2,
  satchel: -2.6,
  torso: 0,
  over: 4.6,
  belt: 5.3,
  pouch: 6,
  head: 7.5,
  neckWear: 9,
  gun: 10.5,
  arm: 11.5,
  band: 13.6,
  knife: 13.8,
  hand: 14.4,
  held: 15,
} as const;

class Painter {
  readonly c: HdCanvas;
  readonly d: HdDensity;
  readonly r: BodyRig;
  readonly st: BodyStyle;
  readonly sk: BodySkeleton;
  readonly dims: BodyDims;
  /** Torso frame on the canvas: the pelvis, forward and up unit vectors (lean + rot). */
  readonly P0: V;
  readonly F: V;
  readonly U: V;
  /** Body-aligned frame (rot only): forward and down. */
  readonly BF: V;
  readonly BD: V;
  readonly H: number;
  /** Depth of the neck wear (scarf front, cape clasp, bowtie, epaulettes): in front of a raised arm. */
  neckZ: number = Z.neckWear;
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

  /** Quantise to the art grid (1 / d logical px). */
  q(v: number): number {
    return Math.round(v * this.d) / this.d;
  }

  /** A joint on the canvas, at 1 / d px. */
  J(p: V): V {
    const t = this.r.T(p);
    return [this.q(t[0]), this.q(t[1])];
  }

  /** Torso frame point: a forward, b up from the pelvis. */
  TL(a: number, b: number): V {
    return [this.P0[0] + this.F[0] * a + this.U[0] * b, this.P0[1] + this.F[1] * a + this.U[1] * b];
  }

  /** Torso frame coordinates (a, b) of a canvas point. */
  local(x: number, y: number): V {
    const dx = x - this.P0[0];
    const dy = y - this.P0[1];
    return [dx * this.F[0] + dy * this.F[1], dx * this.U[0] + dy * this.U[1]];
  }

  /** Body-aligned point: dx forward, dy down from the pelvis (no lean). */
  BL(dx: number, dy: number): V {
    return [this.P0[0] + this.BF[0] * dx + this.BD[0] * dy, this.P0[1] + this.BF[1] * dx + this.BD[1] * dy];
  }

  /** Torso polygon from torso-frame points. */
  poly(pts: ReadonlyArray<Pt>): V[] {
    return pts.map(([a, b]) => this.TL(a, b));
  }

  /**
   * The 1× pixel cover of a torso-frame polygon given by its 1× vertices: on the canvas every
   * vertex moves half a px away from the centroid along each canvas axis (a 1× polygon fills the
   * whole pixels its vertices round to, at any lean).
   */
  cover(pts: ReadonlyArray<Pt>): V[] {
    const c = this.poly(pts);
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

  /** A material per (key) for this canvas. */
  mat(key: string, make: () => HdMaterial): number {
    let m = this.mats.get(key);
    if (m === undefined) {
      m = this.c.material(make());
      this.mats.set(key, m);
    }
    return m;
  }

  /** Cloth of a style ramp (far: one band darker at the top). */
  cloth(r: Ramp, far = false, o: Partial<HdMaterial> = {}): number {
    return this.mat(`cloth:${rampId(r)}:${far ? 1 : 0}:${JSON.stringify(o)}`, () => {
      const s = spanOf(r);
      return { ramp: s.ramp, lo: s.lo, hi: Math.max(s.lo + 1, s.hi - (far ? 1 : 0)), wrap: 0.05, rim: 0.05, ...o };
    });
  }

  /** Leather (boots, belts, straps): a sheen. */
  leather(r: Ramp, far = false): number {
    return this.cloth(r, far, { spec: far ? 0.3 : 0.5, shine: 18, wrap: 0 });
  }

  /** Skin: the lit band is the 1× ramp's lightest tone (dark skin stays dark). */
  skin(far = false): number {
    return this.mat(`skin:${far ? 1 : 0}`, () => {
      const s = spanOf(this.st.skin);
      const top = Math.min(s.ramp.length - 2, s.hi);
      return { ramp: s.ramp, lo: Math.max(1, top - 3), hi: top - (far ? 1 : 0), spec: 0.2, shine: 18, wrap: 0.1, rim: 0.05, amb: 0.12 };
    });
  }

  brass(): number {
    return this.mat('brass', () => ({ ramp: PAL_HD.gold, lo: 2, hi: 5, spec: 1, shine: 26 }));
  }

  steel(): number {
    return this.mat('steel', () => ({ ramp: PAL_HD.steel, lo: 2, hi: 5, spec: 0.9, shine: 24 }));
  }

  /** A soft cloth / leather volume. */
  blob(pts: ReadonlyArray<Pt>, r: number, o: DrawOpts & { bulge?: number }): void {
    this.c.blob(pts, r, o);
  }
}

/** A stable short key for a ramp (its colours). */
function rampId(r: Ramp): string {
  let k = '';
  for (const c of r) k += (c >>> 0).toString(36) + '.';
  return k;
}

// ------------------------------------------------------------------------------------ legs and boots

/**
 * A limb segment chain as tapered capsules of one part (cylinder shading along the limb: the lit
 * side towards the key light, the shade and the cool bounce on the far side). `cut` drops the px
 * past the chain's last point (a sleeve cut square at its cuff).
 */
function limbCaps(p: Painter, pts: readonly V[], radii: readonly number[], o: DrawOpts, cut = false): void {
  const c = p.c;
  const part = o.part ?? c.newPart();
  const n = pts.length - 1;
  const a = pts[n - 1];
  const b = pts[n];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const userTex = o.tex ?? null;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const tex: Texture | null =
      cut && last
        ? (sm) => {
            if ((sm.x - b[0]) * ux + (sm.y - b[1]) * uy > 0) sm.cut = true;
            else if (userTex) userTex(sm);
          }
        : userTex;
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radii[i], radii[i + 1], { ...o, part, tex });
  }
}

/**
 * One trouser leg (thigh, knee, shin) as lit capsules on the 1× limb's centre line and widths,
 * the knee fold inside the bend, folds above the boot, a cargo pocket on the near thigh; the
 * pelvis block with the near leg.
 */
function drawLeg(p: Painter, hip: V, knee: V, ankle: V, far: boolean, withPelvis: boolean, z: number): void {
  const D = p.dims;
  const c = p.c;
  const h = addV(p.J(hip), [par(D.thighW[0]), par(D.thighW[0])]);
  const kOff = (par(D.thighW[1]) + par(D.shinW[0])) / 2;
  const k = addV(p.J(knee), [kOff, kOff]);
  const a = addV(p.J(ankle), [par(D.shinW[1]), par(D.shinW[1])]);
  const mat = p.cloth(p.st.pants, far);
  const part = c.newPart();
  const tone = far ? -0.1 : 0;
  const kneeW = Math.max(D.thighW[1], D.shinW[0]) / 2;
  limbCaps(p, [h, k, a], [D.thighW[0] / 2 - 0.1, kneeW - 0.1, D.shinW[1] / 2 - 0.1], { mat, z, part, tone, round: 0.8 });
  const ta = angleOf(h, k);
  const sa = angleOf(k, a);
  let bend = sa - ta;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  if (Math.abs(bend) > 8) {
    // The knee: a crease cluster inside the bend, a lit cap on the outside.
    const sg = Math.sign(bend);
    const kin = addV(k, dirOf((ta + sa) / 2 - 90 * sg), Math.min(1.2, kneeW * 0.55));
    const kout = addV(k, dirOf((ta + sa) / 2 + 90 * sg), kneeW * 0.6);
    const rr = p.d >= 4 ? 0.7 : 0.8;
    c.shade(kin[0] - 2, kin[1] - 2, 4, 4, (x, y) => (Math.hypot(x - kin[0], y - kin[1]) < rr ? -0.4 : 0), part);
    if (Math.abs(bend) > 35) c.shade(kout[0] - 2, kout[1] - 2, 4, 4, (x, y) => (Math.hypot(x - kout[0], y - kout[1]) < 0.7 ? 0.12 : 0), part);
  }
  // Folds where the trouser leg bunches above the boot (4×: two thin creases; 2×: one).
  {
    const u: V = [Math.sin(sa * DEG), Math.cos(sa * DEG)];
    const n: V = [u[1], -u[0]];
    for (const t of p.d >= 4 ? [0.6, 0.8] : [0.72]) {
      const m = lerpV(k, a, t);
      c.shade(m[0] - 3, m[1] - 3, 6, 6, (x, y) => {
        const ax = (x - m[0]) * u[0] + (y - m[1]) * u[1];
        const ac = (x - m[0]) * n[0] + (y - m[1]) * n[1];
        // A short diagonal crease from the shin's back edge.
        return Math.abs(ax - ac * 0.45) < 0.75 / p.d + 0.04 && ac < 0.4 && ac > -D.shinW[1] / 2 + 0.2 ? -0.28 : 0;
      }, part);
    }
  }
  if (!far && (p.st.acc.has('pouches') || p.st.acc.has('toolbelt') || p.st.s.topType === 'vest')) {
    // A cargo pocket with its flap on the thigh.
    const pc = lerpV(h, k, 0.58);
    const deg = -ta;
    const pk = place([[-1.4, -1.3], [1.3, -1.3], [1.4, 1.4], [-1.3, 1.5]], pc, deg);
    c.blob(pk, 0.35, { mat, z: z + 2.4, bulge: 0.15, tone: tone - 0.03 });
    const fl = place([[-1.6, -1.6], [1.5, -1.6], [1.5, -0.5], [-1.6, -0.5]], pc, deg);
    c.blob(fl, 0.3, { mat, z: z + 2.8, bulge: 0.1, tone: tone + 0.04 });
  }
  if (withPelvis) {
    c.blob(coverOf([p.BL(-D.waistB, -2), p.BL(D.waistF, -2), p.BL(D.waistF, 2), p.BL(-D.waistB, 2)]), 1.0, { mat, z: z + 0.3, bulge: 0.3 });
  }
}

/** HD boot in ankle-centre coords (x forward, y down), inside the 1× boot's pixel box [−2.5, 4.5] × [−2.5, 2.5]. */
const BOOT_UPPER: readonly Pt[] = [[-2.5, -2.5], [1.3, -2.5], [2.2, -1.4], [3.3, -0.6], [4.2, 0.1], [4.5, 0.9], [4.5, 1.7], [-2.5, 1.7], [-2.6, 0.2]];
const BOOT_TOE: readonly Pt[] = [[2.3, -0.7], [3.4, -0.2], [4.3, 0.5], [4.5, 1.6], [2.2, 1.6]];
const BOOT_SOLE: readonly Pt[] = [[-2.5, 1.5], [4.5, 1.5], [4.5, 2.1], [4.15, 2.5], [1.0, 2.5], [0.6, 2.2], [-0.6, 2.2], [-0.95, 2.5], [-2.5, 2.5]];
const BOOT_COLLAR: readonly Pt[] = [[-2.5, -2.5], [1.3, -2.5], [1.5, -1.8], [-2.5, -1.8]];

function drawBoot(p: Painter, ankle: V, foot: number, far: boolean, z: number): void {
  const c = p.c;
  const at = p.J(ankle);
  const deg = p.r.rot - foot;
  const tone = far ? -0.15 : 0;
  const leather = p.leather(p.st.boots, far);
  const part = c.newPart();
  c.blob(place(BOOT_UPPER, at, deg), 1.0, { mat: leather, z, part, bulge: 0.3, tone });
  c.blob(place(BOOT_COLLAR, at, deg), 0.4, { mat: leather, z: z + 0.6, bulge: 0.15, tone: tone - 0.06 });
  c.blob(place(BOOT_TOE, at, deg), 0.8, { mat: leather, z: z + 1.0, bulge: 0.35, tone: tone + 0.06 });
  const sole = p.mat(`sole:${rampId(p.st.boots)}`, () => {
    const s = spanOf(p.st.boots);
    return { ramp: s.ramp, lo: 0, hi: Math.max(1, Math.min(2, s.lo)), rimPx: false, wrap: 0 };
  });
  c.blob(place(BOOT_SOLE, at, deg), 0.3, { mat: sole, z: z + 1.2, bulge: 0.05 });
  if (!far) {
    // Laces across the instep: three crossings at 4×, one bright stitch at 2×.
    const lace = spanOf(p.st.boots).ramp;
    const lc = lace[Math.min(lace.length - 1, spanOf(p.st.boots).hi + 1)];
    const n = p.d >= 4 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const q = place([[1.35 + t * 1.5, -1.75 + t * 0.95]], at, deg)[0];
      c.dot(q[0], q[1], lc);
      if (p.d >= 4) c.dot(q[0] + 0.25, q[1] + 0.05, lc);
    }
  }
}

// ------------------------------------------------------------------------------------ torso

/** The torso polygon in torso-frame coords (the 1× outline: humanoid.ts `torsoOutline`). */
function torsoPts(p: Painter): V[] {
  const D = p.dims;
  const H = p.H;
  return [
    [-D.waistB, -2],
    [D.waistF, -2],
    [D.waistF + 1, 2],
    [D.chestF + 1, H - 4],
    [D.chestF + 0.3, H - 1.2],
    [D.chestF - 1.8, H],
    [-D.chestB + 1, H],
    [-D.chestB - 1, H - 2],
    [-D.chestB, 3],
    [-D.waistB, 0],
  ];
}

/** The torso outline with a V cut at the neck (from the front: depth `v` px). */
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

function drawTorso(p: Painter): void {
  const c = p.c;
  const st = p.st;
  const D = p.dims;
  const H = p.H;
  const type = st.s.topType;
  const front = D.chestF;
  const main = p.cloth(st.top);
  const tweed = st.acc.has('tweed');
  const torso = p.cover(torsoPts(p));
  const part = c.newPart();
  const z = Z.torso;
  const tex: Texture[] = [];
  if (tweed) {
    // Tweed: a herringbone of short light and dark threads (4×), a fine check at 2×.
    tex.push((s) => {
      const [a, b] = p.local(s.x, s.y);
      const k = p.d >= 4 ? 0.5 : 1;
      const col = Math.floor(a / (k * 2));
      const yy = b + (col % 2 === 0 ? a : -a) * 0.5;
      const ph = ((yy / k) % 2 + 2) % 2;
      if (ph < 0.5) s.tone -= 0.18;
      else if (ph > 1.4 && ph < 1.75) s.tone += 0.12;
    });
  }
  const shirtR = st.shirt;
  if (type === 'vest') {
    // The shirt under the vest (V-neck, armholes), the vest panel over it.
    c.blob(torso, 1.4, { mat: p.cloth(shirtR, false, { amb: 0.2 }), z: z - 0.4, part: c.newPart(), bulge: 0.3 });
    const vest = p.cover(torsoV(p, 3.4));
    c.blob(vest, 1.5, {
      mat: main,
      z,
      part,
      bulge: 0.4,
      tex: (s) => {
        const [a, b] = p.local(s.x, s.y);
        // Quilted rows on the back panel (4×), the zip down the front.
        if (p.d >= 4 && a < -0.8 && Math.abs((((b + 20) / 2.2) % 1) - 0.5) < 0.08) s.tone -= 0.2;
        if (b < H - 3.5 && Math.abs(a - (D.waistF - 0.1)) < 0.75 / p.d + 0.03) s.tone -= 0.36;
        else if (b < H - 3.5 && a > D.waistF - 0.1 && a - (D.waistF - 0.1) < 1.5 / p.d + 0.03) s.tone += 0.1;
        for (const t of tex) t(s);
      },
    });
    // Webbing strap from the shoulder to the belt, a D-ring at chest height (4×).
    c.blob(p.poly([[-2.3, H + 0.3], [-1.2, H + 0.3], [-0.7, -0.5], [-1.8, -0.5]]), 0.35, { mat: p.cloth(st.top, false, { lo: Math.max(0, spanOf(st.top).lo - 1) }), z: z + 3.1, bulge: 0.1, tone: -0.08 });
    if (p.d >= 4) {
      const ring = p.TL(-1.5, H * 0.55);
      c.ellipsoid(ring[0], ring[1], 0.55, 0.55, { mat: p.steel(), z: z + 3.8, round: 0.7, tex: (s) => { if (Math.hypot(s.u, s.v) < 0.45) s.cut = true; } });
    }
    // Chest pocket with its flap and a press stud; a lower pocket at the back.
    c.blob(p.poly([[-0.2, 5.6], [1.9, 5.6], [1.9, 2.6], [-0.1, 2.6]]), 0.4, { mat: main, z: z + 3.2, bulge: 0.2, tone: 0.02 });
    c.blob(p.poly([[-0.4, 6.0], [2.1, 6.0], [2.0, 4.8], [0.85, 4.4], [-0.3, 4.8]]), 0.35, { mat: main, z: z + 3.6, bulge: 0.15, tone: 0.07 });
    if (p.d >= 4) {
      const stud = p.TL(0.85, 4.9);
      c.ellipsoid(stud[0], stud[1], 0.35, 0.35, { mat: p.brass(), z: z + 4.1 });
    }
    c.blob(p.poly([[-3.6, 3.6], [-1.6, 3.6], [-1.6, 1.6], [-3.5, 1.6]]), 0.35, { mat: main, z: z + 3.0, bulge: 0.18, tone: -0.02 });
    c.blob(p.poly([[-3.8, 3.9], [-1.4, 3.9], [-1.4, 3.0], [-3.7, 3.0]]), 0.3, { mat: main, z: z + 3.3, bulge: 0.1, tone: 0.05 });
  } else {
    // One panel: the top's own V / collar / placket details are textures and small volumes.
    const vNeck = type === 'jacket' || type === 'coat' || type === 'shirt';
    const pts = vNeck ? p.cover(torsoV(p, 2.6)) : torso;
    if (vNeck) {
      // The shirt (or the shirt's own light collar) in the V.
      const inner = type === 'shirt' ? p.cloth(st.top, false, { lo: Math.min(spanOf(st.top).hi, spanOf(st.top).lo + 2) }) : p.cloth(shirtR, false, { amb: 0.2 });
      c.blob(p.poly([[front - 3.8, H + 0.5], [front - 0.4, H + 0.5], [front - 1.9, H - 2.8]]), 0.5, { mat: inner, z: z - 0.4, bulge: 0.2 });
    }
    const placket = type === 'jacket' || type === 'shirt' || type === 'coat';
    c.blob(pts, 1.4, {
      mat: main,
      z,
      part,
      bulge: 0.38,
      tex: (s) => {
        const [a, b] = p.local(s.x, s.y);
        if (placket && b > -1.5 && b < H - 2.6) {
          const w = 0.75 / p.d + 0.03;
          if (Math.abs(a - (D.waistF - 0.05)) < w) s.tone -= 0.36;
          else if (a > D.waistF - 0.05 && a - (D.waistF - 0.05) < 2 * w) s.tone += 0.08;
        }
        if (type === 'sweater') {
          // Knit: rows of small v stitches (4×), ribbed bands (2×); the ribbed hem.
          if (b < -0.6) {
            if (Math.abs(((a * (p.d >= 4 ? 2 : 1)) % 1 + 1) % 1 - 0.5) < 0.22) s.tone -= 0.16;
          } else if (p.d >= 4) {
            const row = Math.floor((b + 10) / 1.25);
            const ph = (((a + (row % 2) * 0.6) / 1.2) % 1 + 1) % 1;
            const yy = (((b + 10) / 1.25) % 1 + 1) % 1;
            if (Math.abs(ph - 0.5) < 0.12 + yy * 0.18 && Math.abs(ph - 0.5) > yy * 0.18 - 0.02) s.tone -= 0.24;
            else if (yy < 0.2 && Math.abs(ph - 0.5) > 0.32) s.tone += 0.08;
          } else if ((((b + 10) / 1.5) % 1 + 1) % 1 < 0.32) s.tone -= 0.2;
        }
        for (const t of tex) t(s);
      },
    });
    if (placket && p.d >= 2) {
      // Buttons beside the placket (brass on a coat, the top's light tone elsewhere).
      const bm = type === 'coat' ? p.brass() : p.cloth(st.top, false, { lo: spanOf(st.top).hi, hi: Math.min(spanOf(st.top).ramp.length - 1, spanOf(st.top).hi + 1), spec: 0.6 });
      const step = type === 'coat' ? 3 : 2;
      for (let b = 1; b <= H - 3; b += step) {
        const q = p.TL(D.waistF - (type === 'coat' ? 1 : 0.6), b);
        c.ellipsoid(q[0], q[1], p.d >= 4 ? 0.36 : 0.45, p.d >= 4 ? 0.36 : 0.45, { mat: bm, z: z + 3.4, round: 0.8 });
      }
    }
    if (type === 'jacket' || type === 'coat') {
      // Lapels along the V and a breast-pocket flap at the back side.
      c.blob(p.poly([[front - 3.6, H + 0.5], [front - 2.6, H + 0.5], [front - 1.95, H - 2.5], [front - 2.4, H - 2.9]]), 0.3, { mat: main, z: z + 2.8, bulge: 0.15, tone: 0.1 });
      c.blob(p.poly([[front - 0.5, H + 0.4], [front + 0.2, H - 0.5], [front - 1.75, H - 2.6], [front - 1.95, H - 2.2]]), 0.3, { mat: main, z: z + 2.8, bulge: 0.15, tone: 0.03 });
      c.blob(p.poly([[-2.6, 3.6], [-0.4, 3.6], [-0.4, 2.7], [-2.5, 2.7]]), 0.3, { mat: main, z: z + 2.7, bulge: 0.1, tone: 0.06 });
    } else if (type === 'tunic') {
      // A high collar in the accent colour, a row of brass buttons.
      c.blob(p.poly([[front - 4.2, H + 0.5], [front - 0.4, H + 0.5], [front - 0.6, H - 1.1], [front - 4.0, H - 0.9]]), 0.4, { mat: p.cloth(st.accent), z: z + 2.8, bulge: 0.2 });
      for (let b = 0; b <= H - 2; b += 2) {
        const q = p.TL(D.waistF + 0.2, b + 0.5);
        c.ellipsoid(q[0], q[1], 0.42, 0.42, { mat: p.brass(), z: z + 3.4, round: 0.8 });
      }
    } else if (type === 'sweater') {
      // A crew collar.
      c.blob(p.poly([[front - 4.2, H + 0.5], [front - 0.6, H + 0.5], [front - 0.8, H - 0.6], [front - 4.0, H - 0.5]]), 0.35, { mat: main, z: z + 2.6, bulge: 0.15, tone: 0.12 });
    } else if (type === 'tank') {
      // Bare shoulders and a scoop neck above the tank top.
      const skin = p.skin();
      c.blob(p.poly([[-D.chestB - 1.5, H - 1.6], [-D.chestB + 1.2, H + 0.5], [front - 1.6, H + 0.5], [front + 0.7, H - 0.6], [front - 0.4, H - 3.4], [-1.2, H - 3.2]]), 0.9, { mat: skin, z: z + 1.7, bulge: 0.25 });
      // The shoulder strap of the top.
      c.blob(p.poly([[-1.6, H + 0.5], [-0.3, H + 0.5], [-0.2, H - 3.3], [-1.4, H - 3.3]]), 0.3, { mat: main, z: z + 2.4, bulge: 0.1 });
    } else if (type === 'tee') {
      // A round crew neck: a dark rib under the throat.
      c.blob(p.poly([[front - 4.1, H + 0.5], [front - 0.5, H + 0.5], [front - 0.9, H - 0.5], [front - 2.4, H - 1.1], [front - 3.9, H - 0.5]]), 0.3, { mat: main, z: z + 2.6, bulge: 0.1, tone: -0.25 });
    } else if (type === 'polo') {
      // A light collar with two points, a short button placket.
      const light = p.cloth(st.top, false, { lo: Math.min(spanOf(st.top).hi, spanOf(st.top).lo + 2) });
      c.blob(p.poly([[front - 4.2, H + 0.5], [front - 0.4, H + 0.5], [front - 0.6, H - 0.8], [front - 1.6, H - 1.6], [front - 2.6, H - 0.7], [front - 4.0, H - 1.2]]), 0.35, { mat: light, z: z + 2.8, bulge: 0.2 });
      c.blob(p.poly([[front - 2.3, H - 1.4], [front - 1.4, H - 1.4], [front - 1.4, H - 3.9], [front - 2.3, H - 3.9]]), 0.25, { mat: main, z: z + 2.4, bulge: 0.05, tone: -0.3 });
      for (const b of [H - 2.1, H - 3.2]) {
        const q = p.TL(front - 1.85, b);
        c.dot(q[0], q[1], spanOf(st.top).ramp[Math.min(spanOf(st.top).ramp.length - 1, spanOf(st.top).hi + 1)]);
      }
    }
  }
  if (st.acc.has('hivis')) {
    // Reflective bands round the waist and across the chest: a bright silver strip.
    const band = p.mat('hivis', () => ({ ramp: PAL_HD.snow, lo: 2, hi: 5, spec: 0.8, shine: 14 }));
    for (const [b0, b1] of [[0.6, 1.9], [H - 4.4, H - 3.1]] as const) {
      c.blob(p.poly([[-D.chestB - 1.6, b1], [front + 1.6, b1], [front + 1.6, b0], [-D.chestB - 1.6, b0]]), 0.35, { mat: band, z: z + 2.5, bulge: 0.1, tex: (s) => {
        if (!inPoly(s.x, s.y, torso)) s.cut = true;
      } });
    }
  }
}

/** Coat tails hanging from the waist (flap with `flutter`). */
function drawCoatTails(p: Painter): void {
  const D = p.dims;
  const fl = p.r.pose.flutter ?? 0;
  const back = [0, 1, 2, 1][Math.round(fl) & 3];
  const pts = p.cover([[-D.waistB, 0], [D.waistF, 0], [D.waistF + 1, -8], [-D.waistB - 2 - back, -8 + back]]);
  p.c.blob(pts, 1.0, { mat: p.cloth(p.st.top, true), z: Z.tails, bulge: 0.3, tex: (s) => {
    const [a] = p.local(s.x, s.y);
    // The vent and a fold down the tail.
    if (Math.abs(a - (D.waistF - 1.5)) < 0.75 / p.d + 0.03) s.tone -= 0.3;
  } });
}

function drawBelt(p: Painter): void {
  const c = p.c;
  const D = p.dims;
  const belt = p.leather(p.st.belt);
  c.blob(p.cover([[-D.waistB, 0], [D.waistF, 0], [D.waistF, -1], [-D.waistB, -1]]), 0.45, {
    mat: belt,
    z: Z.belt,
    bulge: 0.12,
    tex: p.d >= 4
      ? (s) => {
          const [a, b] = p.local(s.x, s.y);
          // Stitching along both edges, a belt loop at the back.
          if (Math.abs(b - 0.15) < 0.12 || Math.abs(b + 1.15) < 0.12) {
            if ((Math.floor(a * 4) & 1) === 0) s.tone -= 0.22;
          }
          if (Math.abs(a + D.waistB - 1.2) < 0.3) s.tone += 0.12;
        }
      : null,
  });
  // The buckle: a brass frame round a dark prong.
  const bx = D.waistF - 1.0;
  c.blob(p.poly([[bx - 0.75, 0.6], [bx + 0.95, 0.6], [bx + 0.95, -1.6], [bx - 0.75, -1.6]]), 0.25, {
    mat: p.brass(),
    z: Z.belt + 0.9,
    bulge: 0.1,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      if (Math.abs(a - bx) < 0.45 && Math.abs(b + 0.5) < 0.55) s.tone -= p.d >= 4 ? 0.55 : 0.4;
    },
  });
}

/** Two belt pouches, front and back, with flaps and press studs. */
function drawPouches(p: Painter, ramp: Ramp, screwdriver: boolean): void {
  const c = p.c;
  const D = p.dims;
  const m = ramp === p.st.belt ? p.leather(ramp) : p.cloth(ramp);
  for (const a0 of [D.waistF - 2.5, -D.waistB - 1.5]) {
    c.blob(p.cover([[a0 + 0.5, 1], [a0 + 2.5, 1], [a0 + 2.4, -2], [a0 + 0.6, -2]]), 0.5, { mat: m, z: Z.pouch, bulge: 0.25, tone: -0.02 });
    c.blob(p.poly([[a0, 1.5], [a0 + 3, 1.5], [a0 + 2.95, 0.1], [a0 + 0.05, 0.1]]), 0.3, { mat: m, z: Z.pouch + 0.5, bulge: 0.1, tone: 0.06 });
    if (p.d >= 4) {
      const q = p.TL(a0 + 1.5, 0.35);
      c.ellipsoid(q[0], q[1], 0.32, 0.32, { mat: p.brass(), z: Z.pouch + 0.9 });
    }
  }
  if (screwdriver) {
    // A red-handled screwdriver poking out of the front pouch.
    const red = p.mat('red-handle', () => ({ ramp: PAL_HD.red, lo: 3, hi: 6, spec: 0.7, shine: 20 }));
    const h0 = p.TL(D.waistF - 1.0, 1.4);
    const h1 = p.TL(D.waistF - 1.0, 3.4);
    c.capsule(h0[0], h0[1], h1[0], h1[1], 0.55, 0.5, { mat: red, z: Z.pouch - 0.2 });
    const tip = p.TL(D.waistF - 1.0, 3.9);
    c.capsule(h1[0], h1[1], tip[0], tip[1], 0.2, 0.15, { mat: p.steel(), z: Z.pouch - 0.3 });
  }
}

// ------------------------------------------------------------------------------------ arms and hands

/**
 * An arm as lit capsules on the 1× arm's centre line: a full sleeve (shoulder → elbow → wrist,
 * a cuff at the wrist), or a bare arm with a short sleeve over the upper arm, cut square and
 * finished with a rolled cuff; the fold inside the elbow and the crease from the armpit.
 */
function drawArm(p: Painter, shoulder: V, el: V, wr: V, far: boolean, z: number): void {
  const c = p.c;
  const st = p.st;
  const D = p.dims;
  const s = addV(p.J(shoulder), [par(D.armW[0]), par(D.armW[0])]);
  const eo = (par(D.armW[1]) + par(D.foreW[0])) / 2;
  const e = addV(p.J(el), [eo, eo]);
  const w = addV(p.J(wr), [par(D.foreW[1]), par(D.foreW[1])]);
  const tone = far ? -0.16 : 0;
  const full = st.sleeveUpper === st.sleeveFore;
  const ua = angleOf(s, e);
  const fa = angleOf(e, w);
  let bend = fa - ua;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  const elbowW = Math.max(D.armW[1], D.foreW[0]) / 2;
  const sleeveMat = st.sleeveUpper === st.skin ? p.skin(far) : p.cloth(st.sleeveUpper, far, { amb: 0.12 });
  const fold = (part: number, at: V, w0: number): void => {
    if (Math.abs(bend) < 14) return;
    // Inside the elbow: a deep crease and a lit ridge beside it.
    const sg = Math.sign(bend);
    const fi = addV(at, dirOf((ua + fa) / 2 - 90 * sg), Math.min(1.1, w0 * 0.55));
    const rr = p.d >= 4 ? 0.55 : 0.7;
    c.shade(fi[0] - 2, fi[1] - 2, 4, 4, (x, y) => {
      const qd = Math.hypot(x - fi[0], y - fi[1]);
      return qd < rr ? -0.45 : qd < rr + 0.45 && p.d >= 4 ? 0.12 : 0;
    }, part);
  };
  const crease = (part: number, from: V, to: V, half: number): void => {
    if (p.d < 4) return;
    // A crease from the armpit across the upper sleeve.
    const m = lerpV(from, to, 0.42);
    const u = dirOf(ua);
    c.shade(m[0] - 2.5, m[1] - 2.5, 5, 5, (x, y) => {
      const ax = (x - m[0]) * u[0] + (y - m[1]) * u[1];
      const ac = (x - m[0]) * u[1] - (y - m[1]) * u[0];
      return Math.abs(ax - ac * 0.5) < 0.13 && Math.abs(ac) < half - 0.45 ? -0.28 : 0;
    }, part);
  };
  if (full) {
    const part = c.newPart();
    limbCaps(p, [s, e, w], [D.armW[0] / 2 - 0.05, elbowW - 0.05, D.foreW[1] / 2], { mat: sleeveMat, z, part, tone, round: 0.82 });
    fold(part, e, elbowW);
    crease(part, s, e, D.armW[0] / 2);
    if (st.sleeveFore !== st.skin) {
      // The cuff: a band across the sleeve end with a groove.
      const fl = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
      const c1 = lerpV(w, e, Math.min(0.4, 1.4 / fl));
      const c2 = lerpV(w, e, -Math.min(0.12, 0.5 / fl));
      const hw = D.foreW[1] / 2 + 0.1;
      c.blob(limb([c1, c2], [hw, hw], 0), 0.4, { mat: sleeveMat, z: z + 0.9, bulge: 0.1, tone: tone + 0.06, tex: (sm) => {
        const t = segT(sm.x, sm.y, c1, c2);
        if (Math.abs(t - 0.4) < (p.d >= 4 ? 0.12 : 0.18)) sm.tone -= 0.32;
      } });
    }
    return;
  }
  // The bare arm shoulder → elbow → wrist.
  const armPart = c.newPart();
  const skin = st.sleeveFore === st.skin ? p.skin(far) : p.cloth(st.sleeveFore, far);
  limbCaps(p, [s, e, w], [D.armW[0] / 2 - 0.2, elbowW - 0.25, D.foreW[1] / 2 - 0.1], { mat: skin, z: z - 0.4, part: armPart, tone, round: 0.85 });
  fold(armPart, e, elbowW);
  if (st.sleeveUpper === st.skin) return;
  // The short sleeve: a short tube from the shoulder to a little past the middle of the upper arm
  // (the 1× sleeve covers its top half), cut square, a rolled cuff. Slim caps and a flatter
  // roundness keep it a sleeve: a fat, fully round capsule here read as an egg on the chest.
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
  const tEnd = Math.min(0.64, (len * 0.5 + 0.7) / len);
  const m = lerpV(s, e, tEnd);
  const sw = (D.armW[0] + 1) / 2;
  const sp = c.newPart();
  limbCaps(p, [s, m], [sw - 0.3, sw - 0.4], { mat: sleeveMat, z, part: sp, tone, round: 0.55 }, true);
  crease(sp, s, m, sw);
  if (st.s.topType === 'tee' || st.s.topType === 'polo') {
    // A hemmed sleeve: a narrow band at the opening, its stitch line a tone darker.
    const h1 = lerpV(s, e, tEnd - 0.7 / len);
    const h2 = lerpV(s, e, tEnd + 0.05 / len);
    c.blob(limb([h1, h2], [sw - 0.3, sw - 0.4], 0), 0.3, {
      mat: sleeveMat,
      z: z + 0.9,
      bulge: 0.08,
      tone: tone - 0.04,
      tex: (sm) => {
        if (Math.abs(segT(sm.x, sm.y, h1, h2) - 0.3) < (p.d >= 4 ? 0.12 : 0.2)) sm.tone -= 0.3;
      },
    });
    return;
  }
  const c1 = lerpV(s, e, tEnd - 1.0 / len);
  const c2 = lerpV(s, e, tEnd + 0.1 / len);
  c.blob(limb([c1, c2], [sw - 0.3, sw - 0.35], 0), 0.35, {
    mat: sleeveMat,
    z: z + 0.9,
    bulge: 0.05,
    tone: tone + 0.06,
    tex: (sm) => {
      const t = segT(sm.x, sm.y, c1, c2);
      if (Math.abs(t - 0.45) < (p.d >= 4 ? 0.11 : 0.16)) sm.tone -= 0.38;
    },
  });
}

/** Armband: a band of accent across the upper arm with a light stripe. */
function drawArmband(p: Painter, shoulder: V, el: V, z: number): void {
  const s = p.J(shoulder);
  const e = p.J(el);
  const a = lerpV(s, e, 0.4);
  const b = lerpV(s, e, 0.66);
  const w = (p.dims.armW[0] + 1) / 2 + 0.1;
  p.c.blob(limb([addV(a, [0.5, 0.5]), addV(b, [0.5, 0.5])], [w, w], 0), 0.4, { mat: p.cloth(p.st.accent), z, bulge: 0.15, tex: (sm) => {
    const t = segT(sm.x, sm.y, a, b);
    if (Math.abs(t - 0.4) < 0.12) sm.tone += 0.2;
  } });
}

/** The HD hand at the wrist, turned along the forearm (as the 1× quarter turns). */
function drawHand(p: Painter, el: V, wr: V, shape: HandShape, far: boolean, z: number): void {
  const fore = angleOfBody(el, wr) + p.r.rot;
  const q = Math.round((90 - fore) / 90);
  const hand = handArtHd(shape, p.st.gloves, q, false, p.d, far);
  const w = p.J(wr);
  p.c.image(hand.buf, w[0] - hand.wrist[0] - 0.5, w[1] - hand.wrist[1] - 0.5, { z });
}

/** Body-space angle a → b (the 1× `angleTo`). */
function angleOfBody(a: V, b: V): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
}

// ------------------------------------------------------------------------------------ gear

interface Placed {
  buf: PixelBuffer;
  /** Logical points in the placed buffer (continuous). */
  grip: V;
  muzzle: V;
}

const placedCache = new Map<string, Placed>();
const PLACED_MAX = 96;

/** An HD item turned like its 1× twin: exact quarter turns, else a rotation on the logical grid. */
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

function drawGun(p: Painter, g: BodyGun, z: number): void {
  const d = p.d;
  const art = gunHd(g.kind, d);
  const pl = turned(`gun:${g.kind}`, art.buf, art.buf.w / d, art.buf.h / d, art.grip, art.muzzle, g.angle + p.r.rot, d);
  const at = p.J(g.grip);
  p.c.image(pl.buf, at[0] - pl.grip[0], at[1] - pl.grip[1], { z });
}

/** The held item (knife, a knife-look prop, grenade / snack / gift). Mirrors the 1× placement. */
function drawHeld(p: Painter, el: V, wr: V, item: Pose['held'], zKnife: number, zHeld: number): void {
  if (!item || item === 'none') return;
  const d = p.d;
  const fore = angleOfBody(el, wr);
  const w = p.r.T(wr);
  // Items placed by their centre: the 1× centre is in pixel-index coords (the canvas T − 0.5).
  const wi: V = [w[0] - 0.5, w[1] - 0.5];
  if (item === 'grenade' || item === 'snack' || item === 'gift') {
    const buf = heldArtHd(item, d);
    const dir = dirOf(fore + p.r.rot);
    // 1×: the item's centre 2 px along the forearm and 1 px up from the wrist.
    const cx = wi[0] + dir[0] * 2;
    const cy = wi[1] + dir[1] * 2 - 1;
    p.c.image(buf, p.q(cx - buf.w / d / 2), p.q(cy - buf.h / d / 2), { z: zHeld });
    return;
  }
  if (isProp(item)) {
    const art = propHd(item as PropKind, d);
    const ang = (p.r.pose.heldAngle ?? fore - 90) + p.r.rot;
    const pl = turned(`prop:${item}`, art.buf, art.buf.w / d, art.buf.h / d, art.grip, art.tip, ang, d);
    p.c.image(pl.buf, p.q(w[0] - pl.grip[0]), p.q(w[1] - pl.grip[1]), { z: zKnife });
    return;
  }
  // Knife: the handle in the fist, the blade along heldAngle (0 = forward).
  const kb = knifeArtHd(d);
  const ang = p.r.pose.heldAngle ?? fore - 90;
  const pl = turned('knife', kb, kb.w / d, kb.h / d, [1, 1], [7, 1], ang, d);
  const dir: V = [Math.cos(ang * DEG), Math.sin(ang * DEG)];
  const cx = wi[0] + dir[0] * 3;
  const cy = wi[1] + dir[1] * 3;
  p.c.image(pl.buf, p.q(cx - pl.buf.w / d / 2), p.q(cy - pl.buf.h / d / 2), { z: zKnife });
}

// ------------------------------------------------------------------------------------ head

function headStyleOf(p: Painter): HeadStyle {
  const st = p.st;
  return {
    skin: st.skin,
    hair: st.hair,
    hairStyle: st.s.hairStyle,
    headgear: st.s.headgear,
    gear: st.gear,
    accent: st.accent,
    extras: st.s.face ?? [],
    hat: p.r.pose.hat,
    hatDy: p.r.pose.hatDy,
  };
}

/** The HD head on the neck (tilted, or twice as large for the Helium Head); returns its part id. */
function drawHead(p: Painter, z: number): number {
  const pose = p.r.pose;
  const d = p.d;
  const big = pose.headScale === 2;
  const hx = pose.head?.dx ?? 0;
  const hy = pose.head?.dy ?? 0;
  const neck = p.J([p.sk.neck[0] + hx, p.sk.neck[1] + hy + 1]);
  const tilt = (pose.head?.tilt ?? 0) + p.r.rot;
  const tilted = Math.abs(tilt) >= 8;
  const k = big ? 2 : 1;
  let buf = renderHeadHd(headStyleOf(p), pose.expr ?? 'normal', (big ? 2 * d : d) as HdDensity | 8, tilted ? { glint: false } : undefined);
  const lw = HEAD_W * k;
  const lh = HEAD_H * k;
  // The neck px centre (the 1× big head puts its neck at the scaled index 2 · NECK).
  let nk: V = [NECK[0] * k + 0.5, NECK[1] * k + 0.5];
  if (tilted) {
    const b = buf.rotated(tilt * DEG, { align: d });
    const c0: V = [lw / 2, lh / 2];
    const c1: V = [b.w / d / 2, b.h / d / 2];
    const cs = Math.cos(tilt * DEG);
    const sn = Math.sin(tilt * DEG);
    const x = nk[0] - c0[0];
    const y = nk[1] - c0[1];
    nk = [c1[0] + x * cs - y * sn, c1[1] + x * sn + y * cs];
    buf = b;
  }
  void HEAD_CENTER;
  const part = p.c.newPart();
  p.c.image(buf, p.q(neck[0] - nk[0]), p.q(neck[1] - nk[1]), { z, part });
  return part;
}

// ------------------------------------------------------------------------------------ accessories

function drawBackpack(p: Painter, radio: boolean): void {
  const c = p.c;
  const D = p.dims;
  const m = p.cloth(p.st.gear);
  const B = -D.chestB;
  c.blob(p.cover([[B - 3, 1], [B + 1, 1], [B + 1, 8], [B - 3, 7]]), 1.0, { mat: m, z: Z.pack, bulge: 0.35 });
  // The flap and a strap buckle.
  c.blob(p.poly([[B - 3.6, 8.6], [B + 1.4, 8.6], [B + 1.4, 5.4], [B - 3.5, 5.0]]), 0.4, { mat: m, z: Z.pack + 0.7, bulge: 0.15, tone: 0.05 });
  const bk = p.TL(B - 1.2, 4.6);
  c.ellipsoid(bk[0], bk[1], 0.4, 0.4, { mat: p.brass(), z: Z.pack + 1.2, round: 0.7 });
  if (radio) {
    const a = p.TL(B - 1.6, 8.5);
    const b = p.TL(B - 3.6, 17.5);
    c.capsule(a[0], a[1], b[0], b[1], 0.3, 0.22, { mat: p.steel(), z: Z.pack - 0.5 });
    c.ellipsoid(b[0], b[1], 0.55, 0.55, { mat: p.cloth(p.st.accent), z: Z.pack - 0.4 });
  }
}

function drawScarf(p: Painter): { front: () => void } {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const fl = p.r.pose.flutter;
  const acc = p.st.accent;
  const m = p.cloth(acc, true);
  if (fl === undefined) {
    c.blob(p.cover([[-1, H], [-D.chestB - 1, H - 1], [-D.chestB - 2, H - 8], [-D.chestB, H - 9], [-D.chestB + 1, H - 2]]), 0.8, { mat: m, z: Z.scarfBack, bulge: 0.3 });
  } else {
    const wave = [0, 1, 0, -1][Math.round(fl) & 3];
    const pts = p.cover([[-1, H - 1], [-2, H], [-D.chestB - 5, H - 2 + wave], [-D.chestB - 9, H - 4 - wave], [-D.chestB - 8, H - 6 - wave], [-D.chestB - 4, H - 4]]);
    const a = p.TL(-3, H - 1);
    const b = p.TL(-D.chestB - 7, H - 4 - wave);
    c.blob(pts, 0.8, { mat: m, z: Z.scarfBack, bulge: 0.3, tex: (s) => {
      // A fold along the tail.
      const t = segT(s.x, s.y, a, b);
      const px = a[0] + (b[0] - a[0]) * t;
      const py = a[1] + (b[1] - a[1]) * t;
      if (t > 0 && t < 1 && Math.hypot(s.x - px, s.y - py) < 0.75 / p.d + 0.05) s.tone -= 0.3;
    } });
  }
  return {
    front: () => {
      const f = p.cloth(acc);
      const pts = p.cover([[-2, H + 1], [D.chestF - 1, H + 1], [D.chestF - 1, H - 1], [-2, H - 1]]);
      const a = p.TL(0.5, H + 1.5);
      const b = p.TL(1.5, H - 1.5);
      c.blob(pts, 0.9, { mat: f, z: p.neckZ, bulge: 0.3, tex: (s) => {
        // The wrap: a fold across the scarf.
        const t = segT(s.x, s.y, a, b);
        const px = a[0] + (b[0] - a[0]) * t;
        const py = a[1] + (b[1] - a[1]) * t;
        if (Math.hypot(s.x - px, s.y - py) < 0.75 / p.d + 0.08) s.tone -= 0.32;
      } });
    },
  };
}

/** The short cape: back cloth (with the leaf emblem) and the clasp over the near shoulder. */
function drawCape(p: Painter): { clasp: () => void } {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const fl = p.r.pose.flutter;
  const acc = p.st.accent;
  const B = -D.chestB;
  let pts: V[];
  let leaf: V;
  let fold: [V, V];
  if (fl === undefined) {
    pts = p.cover([[1, H + 1], [B - 1, H], [B - 2, 0], [B - 1, -1], [B, 1], [B + 1, 0], [B + 1, H - 3]]);
    leaf = p.TL(B - 0.6, H - 4);
    fold = [p.TL(B, H - 1), p.TL(B - 1, 1)];
  } else {
    const wave = [0, 1, 0, -1][Math.round(fl) & 3];
    pts = p.cover([[1, H + 1], [B - 2, H + 1], [B - 9, H - 1 + wave], [B - 9, H - 3 + wave], [B - 6, H - 4], [B - 7, 1 - wave], [B - 3, 2], [B + 1, 2], [B + 1, H - 3]]);
    leaf = p.TL(B - 3.6, H - 2);
    fold = [p.TL(B - 1, H - 1), p.TL(B - 6, 3)];
  }
  const part = c.newPart();
  c.blob(pts, 0.9, { mat: p.cloth(acc, true), z: Z.capeBack, part, bulge: 0.3, tex: (s) => {
    const t = segT(s.x, s.y, fold[0], fold[1]);
    const px = fold[0][0] + (fold[1][0] - fold[0][0]) * t;
    const py = fold[0][1] + (fold[1][1] - fold[0][1]) * t;
    if (t > 0 && t < 1 && Math.hypot(s.x - px, s.y - py) < 0.75 / p.d + 0.05) s.tone -= 0.32;
  } });
  // The leaf emblem: a pointed light-green leaf with a dark midrib.
  const green = p.mat('leaf', () => ({ ramp: PAL_HD.green, lo: 4, hi: 6, flat: false, wrap: 0.2 }));
  const L = place([[-0.9, 0.5], [-0.1, -0.2], [0.9, -0.9], [0.4, 0.2], [-0.4, 0.8]], leaf, 0);
  c.blob(L, 0.3, { mat: green, z: Z.capeBack + 0.6, bulge: 0.1, tex: (s) => {
    const t = segT(s.x, s.y, [leaf[0] - 0.8, leaf[1] + 0.6], [leaf[0] + 0.8, leaf[1] - 0.8]);
    const px = leaf[0] - 0.8 + 1.6 * t;
    const py = leaf[1] + 0.6 - 1.4 * t;
    if (Math.hypot(s.x - px, s.y - py) < 0.6 / p.d + 0.02) s.tone -= 0.5;
  } });
  return {
    clasp: () => {
      c.blob(p.poly([[B - 0.5, H + 1.5], [1.5, H + 1.5], [1.5, H - 0.5], [B + 1, H - 1.5]]), 0.5, { mat: p.cloth(acc), z: p.neckZ, bulge: 0.2 });
      const q = p.TL(0.5, H + 0.5);
      c.ellipsoid(q[0], q[1], 0.55, 0.55, { mat: p.brass(), z: p.neckZ + 0.8 });
    },
  };
}

function drawSatchel(p: Painter): { strap: () => void } {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const m = p.leather(p.st.belt);
  if (p.st.acc.has('needles')) {
    // Two knitting needles poking up and back out of the satchel, red bead knobs.
    for (const [a, b] of [
      [[-D.waistB - 2, 0], [-D.waistB - 5, 5]],
      [[-D.waistB, 0], [-D.waistB - 2, 6]],
    ] as const) {
      const p0 = p.TL(a[0] + 0.5, a[1] - 0.5);
      const p1 = p.TL(b[0] + 0.5, b[1] - 0.5);
      c.capsule(p0[0], p0[1], p1[0], p1[1], 0.28, 0.24, { mat: p.steel(), z: Z.satchel - 0.8 });
      c.ellipsoid(p1[0], p1[1], 0.6, 0.6, { mat: p.mat('bead', () => ({ ramp: PAL_HD.red, lo: 3, hi: 6, spec: 0.8, shine: 20 })), z: Z.satchel - 0.6 });
    }
  }
  c.blob(p.cover([[-D.waistB - 3, 1], [-D.waistB + 1, 1], [-D.waistB + 1, -4], [-D.waistB - 3, -4]]), 0.9, { mat: m, z: Z.satchel, bulge: 0.3 });
  c.blob(p.poly([[-D.waistB - 3.6, 1.6], [-D.waistB + 1.6, 1.6], [-D.waistB + 1.5, -1.2], [-D.waistB - 3.5, -1.2]]), 0.4, { mat: m, z: Z.satchel + 0.6, bulge: 0.12, tone: 0.05 });
  const k = p.TL(-D.waistB - 1, -1.0);
  c.ellipsoid(k[0], k[1], 0.5, 0.45, { mat: p.brass(), z: Z.satchel + 1.0 });
  return {
    strap: () => {
      const a = p.TL(D.chestF - 1.5, H - 0.5);
      const b = p.TL(-D.waistB + 0.5, 0.5);
      c.capsule(a[0], a[1], b[0], b[1], 0.55, 0.55, { mat: m, z: Z.over, tone: -0.05 });
    },
  };
}

function drawBandolier(p: Painter, ramp: Ramp, dots: boolean): void {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const a = p.TL(-D.chestB + 1.5, H - 0.5);
  const b = p.TL(D.waistF - 0.5, 1.5);
  const m = ramp === PAL.snow ? p.mat('crossbelt', () => ({ ramp: PAL_HD.cloth, lo: 2, hi: 5, wrap: 0.1 })) : p.leather(ramp);
  c.capsule(a[0], a[1], b[0], b[1], 1.0, 1.0, { mat: m, z: Z.over, round: 0.6 });
  if (dots) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const q = lerpV(a, b, t);
      // A brass cartridge across the belt with a lit tip.
      c.capsule(q[0] - 0.35, q[1] - 0.55, q[0] + 0.35, q[1] + 0.55, 0.42, 0.42, { mat: p.brass(), z: Z.over + 0.6 });
    }
  }
}

function drawTie(p: Painter): void {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const m = p.cloth(p.st.accent);
  const x = D.chestF - 1.5;
  c.blob(p.poly([[x - 0.6, H - 0.3], [x + 0.6, H - 0.3], [x + 0.5, H - 1.4], [x - 0.5, H - 1.4]]), 0.25, { mat: m, z: Z.over + 0.3, tone: 0.1 });
  c.blob(p.poly([[x - 0.35, H - 1.3], [x + 0.35, H - 1.3], [x + 0.7, 3.2], [x, 2.0], [x - 0.6, 3.2]]), 0.3, { mat: m, z: Z.over, bulge: 0.1, tone: -0.05 });
}

function drawBowtie(p: Painter): void {
  const c = p.c;
  const D = p.dims;
  const H = p.H;
  const m = p.cloth(p.st.accent);
  const x = D.chestF - 1.5;
  const y = H - 0.5;
  c.blob(p.poly([[x - 1.6, y + 0.9], [x, y + 0.2], [x + 1.6, y + 0.9], [x + 1.6, y - 1.0], [x, y - 0.3], [x - 1.6, y - 1.0]]), 0.4, { mat: m, z: p.neckZ + 0.5, bulge: 0.2 });
  const k = p.TL(x, y);
  c.ellipsoid(k[0], k[1], 0.5, 0.55, { mat: m, z: p.neckZ + 1.0, tone: 0.1 });
}

function drawEpaulette(p: Painter, shoulder: V): void {
  const c = p.c;
  const s = p.J(shoulder);
  const g = p.brass();
  const pts = place([[-2.5, -0.5], [2.5, -0.5], [2.5, -1.6], [1.5, -2.5], [-1.5, -2.5], [-2.5, -1.6]], s, p.r.rot);
  c.blob(pts, 0.4, { mat: g, z: p.neckZ + 0.6, bulge: 0.15, tex: (sm) => {
    // Fringe: threads along the lower edge.
    if (sm.y > s[1] - 0.95 && (Math.floor(sm.x * p.d) & 1) === 0) sm.tone -= 0.35;
  } });
}

// ------------------------------------------------------------------------------------ the figure

/**
 * Draw the figure (the 1× layer order and rules: a near arm across the face goes behind the head,
 * the satchel strap over the torso …) and render it: (w·d) × (h·d), outline A (d px of ink), a
 * cool rim light, separations and AO between parts; the Helium Head's outline turns pink.
 */
export function drawBodyHd(r: BodyRig): PixelBuffer {
  const p = new Painter(r);
  const st = r.st;
  const sk = r.sk;
  const pose = r.pose;
  const acc = st.acc;
  const upper = r.part !== 'lower';
  const lower = r.part !== 'upper';
  let headPart = -1;

  let cape: { clasp: () => void } | null = null;
  let scarf: { front: () => void } | null = null;
  if (upper) {
    if (acc.has('cape')) cape = drawCape(p);
    if (acc.has('backpack') || acc.has('radio')) drawBackpack(p, acc.has('radio'));
    if (acc.has('scarf')) scarf = drawScarf(p);
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
    if (st.s.topType === 'coat') drawCoatTails(p);
    let satchel: { strap: () => void } | null = null;
    if (acc.has('satchel')) satchel = drawSatchel(p);
    drawTorso(p);
    if (satchel) satchel.strap();
    if (acc.has('ammo-belt')) drawBandolier(p, PAL.brown, true);
    if (acc.has('cross-belt')) drawBandolier(p, PAL.snow, false);
    if (acc.has('tie')) drawTie(p);
    drawBelt(p);
    if (acc.has('pouches')) drawPouches(p, st.gear, false);
    if (acc.has('toolbelt')) drawPouches(p, st.belt, true);
    // A near arm whose hand or forearm would cross the face goes behind the head (1× rule).
    const nk = sk.neck;
    const inFace = (q: V): boolean => q[0] >= nk[0] && q[0] <= nk[0] + 6 && q[1] >= nk[1] - 9 && q[1] <= nk[1] - 1;
    const mid: V = [(sk.elN[0] + sk.wrN[0]) / 2, (sk.elN[1] + sk.wrN[1]) / 2];
    const raised = inFace(sk.wrN) || inFace(mid);
    // Raised: the head and its neck wear in front of the whole near arm.
    const hz = raised ? Z.held + 2 : Z.head;
    p.neckZ = raised ? Z.held + 3.5 : Z.neckWear;
    headPart = drawHead(p, hz);
    if (scarf) scarf.front();
    if (cape) cape.clasp();
    if (acc.has('bowtie')) drawBowtie(p);
    if (acc.has('epaulettes')) drawEpaulette(p, sk.shN);
    if (sk.gun) drawGun(p, sk.gun, Z.gun);
    drawArm(p, sk.shN, sk.elN, sk.wrN, false, Z.arm);
    if (acc.has('armband')) drawArmband(p, sk.shN, sk.elN, Z.band);
    const held = pose.held ?? 'none';
    drawHeld(p, sk.elN, sk.wrN, held, Z.knife, Z.held);
    drawHand(p, sk.elN, sk.wrN, sk.handN, false, Z.hand);
  }
  const crop = r.frame ? fitFrame(p.c, r.frame) : null;
  const out = p.c.render({ outline: 'A', ao: 0.3, rimLight: 2 });
  if (upper && pose.headScale === 2 && headPart >= 0) pinkRim(p.c, out, headPart);
  return crop ? out.crop(crop[0], crop[1], crop[2], crop[3]) : out;
}

/**
 * Fit the drawing into the 1× frame's rectangle (geometry is law: the HD frame has exactly the 1×
 * frame's logical size and anchor). The HD joints sit up to half a logical px from the 1× ones (so
 * the figure moves in 1 / d steps), and the 1× rectangle is the tight box of the 1× pixels: what
 * reaches past the room inside the outline (the rectangle less d px, the outline's width, on every
 * side) is trimmed before the render, so the outline wraps a clean edge there instead of being cut
 * by the frame. The crop is never moved: that would undo the sub-pixel motion. Returns the crop
 * [x, y, w, h] in art px.
 */
function fitFrame(c: HdCanvas, f: { x: number; y: number; w: number; h: number }): [number, number, number, number] {
  const { W, H, d } = c;
  HD_FIT.frames++;
  const cx = Math.round(f.x * d);
  const cy = Math.round(f.y * d);
  const cw = Math.round(f.w * d);
  const ch = Math.round(f.h * d);
  const ax = cx + d;
  const ay = cy + d;
  const bx = cx + cw - d;
  const by = cy + ch - d;
  let n = 0;
  for (let Y = 0; Y < H; Y++) {
    const inY = Y >= ay && Y < by;
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (c.mat[i] === 0 || (inY && X >= ax && X < bx)) continue;
      c.mat[i] = 0;
      c.fix[i] = 0;
      n++;
    }
  }
  if (n > 0) {
    HD_FIT.trimmed++;
    HD_FIT.maxTrimPx = Math.max(HD_FIT.maxTrimPx, n);
  }
  return [cx, cy, cw, ch];
}

/** The Helium Head's rim: the outline px within the outline's width of the head turn pink. */
function pinkRim(c: HdCanvas, out: PixelBuffer, headPart: number): void {
  const { W, H, d } = c;
  const isHead = new Uint8Array(W * H);
  for (let i = 0; i < isHead.length; i++) if (c.mat[i] !== 0 && c.part[i] === headPart) isHead[i] = 1;
  const r = d;
  const pink = HELIUM_RIM >>> 0;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (c.mat[i] !== 0 || (out.data[i] & 255) === 0) continue;
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy++) {
        const yy = Y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = X + dx;
          if (xx < 0 || xx >= W || dx * dx + dy * dy > r * r + r * 0.5) continue;
          if (isHead[yy * W + xx]) {
            hit = true;
            break;
          }
        }
      }
      if (hit) out.data[i] = pink;
    }
  }
  out.touch();
}
