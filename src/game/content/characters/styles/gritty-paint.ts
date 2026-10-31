/**
 * Style `gritty` (gritty.ts): the painter. One drawer for the 1×, 2× and 4× frame: every part is a
 * lit volume on an HdCanvas (src/game/art/hd/canvas.ts) with GRITTY's own materials (gritty-pal.ts:
 * PAL_HD tones, snapped to PAL at 1×) and a hard key light from the upper left (no wrap, almost no
 * ambient: deep shadows), cast shadows and ambient occlusion. Then two passes of our own on the
 * G-buffer: a strong cool rim light on the silhouette edges turned away from the key (right and
 * upper right, lit from behind), and a thin dark outline — the material's deepest tone on the lit
 * side, ink on the shadow side, where it sinks into the shade.
 *
 * Detail: tweed herringbone with flecks, leather elbow patches, worn cuffs and hem, a sweat-dark
 * shirt collar, the dull red tie, a belt with a dull buckle in the jacket's opening; fatigues with
 * an outseam, a bellows pocket, dirt on the knees and dust at the hems, bloused into field boots
 * with scuffed toes, laces and a heavy tread.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { hdHome } from '../../../../engine/palette-hd';
import type { HandShape, Pose, RenderPart } from '../../../art/humanoid';
import { HELIUM_RIM } from '../../../art/humanoid';
import { giftArt, grenadeArt, isProp, knifeArt, propArt, snackArt, type PropKind } from '../../../art/humanoid-gear';
import { HdCanvas, type DrawOpts, type HdMaterial, type Texture } from '../../../art/hd/canvas';
import { heldArtHd, knifeArtHd, propHd } from '../../../art/hd/gear';
import type { HdDensity } from '../../../art/hd/head';
import { hash2, noise2 } from '../../../art/paint';
import { HEAVY_K, drawGunG } from './gritty-gun';
import { drawHead, type HeadMats } from './gritty-head';
import { GR, INK0, colAt, rampAt } from './gritty-pal';
import { DIMS, K, rotateAbout, type GunPl, type Skel, type V } from './gritty-rig';

const DEG = Math.PI / 180;

/** Base depths, back to front. */
const Z = {
  farArm: -14,
  farHand: -11.5,
  farLeg: -10,
  farBoot: -8.5,
  nearLeg: -6.5,
  nearBoot: -5,
  neck: -1.5,
  belt: -0.8,
  shirt: -0.4,
  torso: 0,
  tie: 1.2,
  lapel: 2.4,
  pocket: 2.6,
  head: 7.5,
  gun: 10.5,
  arm: 11.5,
  patch: 12.6,
  knife: 13.8,
  hand: 14.4,
  held: 15,
} as const;

export interface PaintJob {
  d: number;
  /** Canvas size, logical px. */
  w: number;
  h: number;
  sk: Skel;
  pose: Pose;
  part: RenderPart;
  /** Body space → canvas (logical, unrounded; rotation and offsets applied). */
  T: (p: V) => V;
  rot: number;
  /** A rectangle (logical canvas px) the drawing must fit in (HD: the 1× frame); trimmed before the passes. */
  frame?: { x: number; y: number; w: number; h: number };
}

export interface PaintOut {
  buf: PixelBuffer;
  /** Canvas points (logical): muzzle (pixel index), hand, head. */
  pts: Record<string, V>;
}

/**
 * The hard key: a negative ambient and a steep gain, so the planes turned away from the light
 * fall straight into the deepest tones (the terminator is hard) and the lit planes climb fast.
 */
const HARD = { amb: -0.22, gain: 1.24 };

/** Light and edge info of a material id (for our passes). */
interface MatInfo {
  /** The outline colour on the lit side (the deepest tone). */
  edge: Color;
  /** Index into GR.rim for this material's rim (−1: no rim). */
  rim: number;
  /** Rim width in art px at 4× (1 or 2). */
  rimW: number;
}

class Painter {
  readonly c: HdCanvas;
  readonly d: number;
  readonly j: PaintJob;
  readonly sk: Skel;
  readonly P0: V;
  readonly F: V;
  readonly U: V;
  readonly BF: V;
  readonly BD: V;
  readonly H: number;
  readonly info = new Map<number, MatInfo>();
  private readonly mats = new Map<string, number>();

  constructor(j: PaintJob) {
    this.j = j;
    this.d = j.d;
    this.sk = j.sk;
    this.c = new HdCanvas(j.w, j.h, j.d);
    this.P0 = this.J(j.sk.pelvis);
    const r = (v: V): V => {
      const c = Math.cos(j.rot * DEG);
      const s = Math.sin(j.rot * DEG);
      return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
    };
    this.F = r(j.sk.f);
    this.U = r(j.sk.u);
    this.BF = r([1, 0]);
    this.BD = r([0, 1]);
    this.H = j.sk.H;
  }

  /** A body point on the canvas (HD: on the 1 / d grid). */
  J(p: V): V {
    const t = this.j.T(p);
    return [Math.round(t[0] * this.d) / this.d, Math.round(t[1] * this.d) / this.d];
  }

  /** Torso frame point: a forward, b up from the pelvis. */
  TL(a: number, b: number): V {
    return [this.P0[0] + this.F[0] * a + this.U[0] * b, this.P0[1] + this.F[1] * a + this.U[1] * b];
  }

  /** Torso-frame coordinates of a canvas point. */
  local(x: number, y: number): V {
    const dx = x - this.P0[0];
    const dy = y - this.P0[1];
    return [dx * this.F[0] + dy * this.F[1], dx * this.U[0] + dy * this.U[1]];
  }

  /** Body-aligned point (no lean): dx forward, dy down from the pelvis. */
  BL(dx: number, dy: number): V {
    return [this.P0[0] + this.BF[0] * dx + this.BD[0] * dy, this.P0[1] + this.BF[1] * dx + this.BD[1] * dy];
  }

  poly(pts: ReadonlyArray<readonly [number, number]>): V[] {
    return pts.map(([a, b]) => this.TL(a, b));
  }

  /**
   * A material: the ramp at this density, hard light (no wrap, low ambient, a little cool bounce),
   * our rim index. `lo` / `hi` are HD ramp indices (1× clamps to its shorter ramp).
   */
  mat(key: string, ramp: Ramp, o: Partial<HdMaterial> & { rim?: number; rimW?: number } = {}): number {
    let id = this.mats.get(key);
    if (id !== undefined) return id;
    const r = rampAt(ramp, this.d);
    const n = r.length;
    const lo = this.d === 1 ? Math.min(1, n - 1) : Math.min(n - 1, o.lo ?? 1);
    const hi = this.d === 1 ? n - 1 : Math.min(n - 1, o.hi ?? n - 2);
    const { rim, rimW, ...rest } = o;
    id = this.c.material({ amb: HARD.amb, gain: HARD.gain, wrap: 0, bounce: 0.12, rim: 0, ...rest, ramp: r, lo, hi: Math.max(lo, hi) });
    this.mats.set(key, id);
    this.info.set(id, { edge: r[0], rim: rim ?? 3, rimW: rimW ?? 2 });
    return id;
  }

  /** Cloth (matte). */
  cloth(key: string, ramp: Ramp, far = false, o: Partial<HdMaterial> & { rim?: number; rimW?: number } = {}): number {
    return this.mat(`${key}:${far ? 1 : 0}`, ramp, { ...o, hi: (o.hi ?? ramp.length - 2) - (far ? 1 : 0) });
  }

  leather(key: string, ramp: Ramp, far = false, hi?: number): number {
    return this.mat(`${key}:${far ? 1 : 0}`, ramp, { spec: far ? 0.3 : 0.55, shine: 18, hi: (hi ?? ramp.length - 2) - (far ? 1 : 0), rim: 1 });
  }

  skin(): number {
    return this.mat('skin', GR.skin, { spec: 0.04, shine: 14, amb: 0.14, gain: 1.2, rim: 2, rimW: 1, lo: 1, hi: 5 });
  }

  stubble(): number {
    return this.mat('stubble', GR.stubble, { amb: 0.14, gain: 1.2, rim: 1, rimW: 1, lo: 1, hi: 5 });
  }

  hair(): number {
    return this.mat('hair', GR.hair, { spec: 0.45, shine: 14, rim: 2, rimW: 1, lo: 1, hi: 4 });
  }
}

// ------------------------------------------------------------------------------------ helpers

function angleOf(a: V, b: V): number {
  return Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
}

function dirOf(a: number): V {
  return [Math.sin(a * DEG), Math.cos(a * DEG)];
}

function addV(a: V, b: V, k = 1): V {
  return [a[0] + b[0] * k, a[1] + b[1] * k];
}

function lerpV(a: V, b: V, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Local shape points (x forward, y down) turned clockwise by `deg` and placed at p. */
function place(pts: ReadonlyArray<readonly [number, number]>, p: V, deg: number): V[] {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return pts.map(([x, y]) => [p[0] + x * c - y * s, p[1] + x * s + y * c]);
}

function segT(x: number, y: number, a: V, b: V): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  return ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
}

function segDist(x: number, y: number, a: V, b: V): number {
  let t = segT(x, y, a, b);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - a[0] - (b[0] - a[0]) * t, y - a[1] - (b[1] - a[1]) * t);
}

/** Capsule chain of one part. */
function chain(p: Painter, pts: readonly V[], radii: readonly number[], o: DrawOpts): number {
  const part = o.part ?? p.c.newPart();
  for (let i = 0; i + 1 < pts.length; i++) p.c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radii[i], radii[i + 1], { ...o, part });
  return part;
}

/** A thin line (texture test): within w of the segment. */
const fineW = (d: number): number => (d >= 4 ? 0.14 : d >= 2 ? 0.26 : 0.5);

// ------------------------------------------------------------------------------------ legs and boots

/**
 * One trouser leg: thigh, knee, shin as capsules (one part), the outseam, the knee crease, dirt on
 * the knee and shin, dust at the hem, the cuff bloused over the boot; the bellows pocket on the
 * near thigh; the seat and the fly with the near leg.
 */
function drawLeg(p: Painter, hip: V, knee: V, ankle: V, far: boolean, withPelvis: boolean, z: number): void {
  const c = p.c;
  const d = p.d;
  const h = p.J(hip);
  const k = p.J(knee);
  const a = p.J(ankle);
  const mat = p.cloth('olive', GR.olive, far, { rim: 1, hi: 6 });
  const dust = p.cloth('dust', GR.dust, far, { rim: 1, hi: 5 });
  const tone = far ? -0.14 : 0;
  const R = DIMS.legR;
  const ta = angleOf(h, k);
  const sa = angleOf(k, a);
  const seed = far ? 31 : 17;
  const tex: Texture = (s) => {
    // The outseam down the side (4× and 2×).
    if (d >= 2 && Math.abs(s.v + 0.15) < (d >= 4 ? 0.07 : 0.12)) s.tone -= 0.22;
    // Dirt: darker patches on the knee and the shin; dust (lighter) low on the leg.
    const tk = segT(s.x, s.y, k, a);
    const n = noise2(s.x * 1.0 + seed, s.y * 1.0, 1.6, seed);
    if (tk > -0.25 && n > 0.62) s.tone -= 0.16 * Math.min(1, (n - 0.62) / 0.12);
    if (tk > 0.5) {
      // Dust low on the leg (the cloth greys).
      const dn = noise2(s.x * 2.0, s.y * 2.0 + seed, 1.2, seed + 5);
      if (dn > 0.62 - (tk - 0.5) * 0.5) s.mat = dust;
    }
    // Twill: a faint diagonal weave at 4×.
    if (d >= 4 && ((Math.floor((s.X + s.Y) / 2) & 3) === 0) && hash2(s.X, s.Y, 9) > 0.55) s.tone -= 0.06;
  };
  const part = chain(p, [h, k, a], [R[0], R[1], R[2]], { mat, z, tone, round: 0.85, tex });
  let bend = sa - ta;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  if (Math.abs(bend) > 8) {
    // The knee: creases inside the bend, the cap pulls tight outside.
    const sg = Math.sign(bend);
    const kin = addV(k, dirOf((ta + sa) / 2 - 90 * sg), R[1] * 0.55);
    c.shade(kin[0] - 2.5, kin[1] - 2.5, 5, 5, (x, y) => {
      const q = Math.hypot(x - kin[0], y - kin[1]);
      return q < 0.75 ? -0.4 : q < 1.2 && d >= 4 ? -0.12 : 0;
    }, part);
  }
  // The cuff bloused over the boot: a fuller band above the ankle with folds.
  {
    const u = dirOf(sa);
    const top = addV(a, u, -1.6);
    const cuffPart = c.newPart();
    c.capsule(top[0], top[1], a[0] - u[0] * 0.2, a[1] - u[1] * 0.2, R[2] + 0.2, R[2] + 0.35, {
      mat,
      z: z + 0.3,
      part: cuffPart,
      tone: tone + 0.02,
      round: 0.8,
      tex: (s) => {
        const t = segT(s.x, s.y, top, a);
        // Folds across the bloused cuff.
        const f = Math.sin(t * (d >= 4 ? 13 : 8) + s.v * 2.2);
        if (f > 0.6) s.tone -= 0.22;
        if (noise2(s.x * 2, s.y * 2, 1, seed + 2) > 0.45) s.mat = dust;
      },
    });
  }
  if (!far) {
    // A bellows cargo pocket on the outer thigh, its flap and a dark press stud.
    const pc = lerpV(h, k, 0.55);
    const deg = -ta;
    const pk = place([[-1.3, -1.45], [1.15, -1.45], [1.25, 1.55], [-1.2, 1.6]], pc, deg);
    c.blob(pk, 0.35, { mat, z: z + 2.4, bulge: 0.2, tone: tone - 0.02, tex: (s) => {
      // The bellows pleat down the middle.
      if (d >= 4 && Math.abs(s.u - 0.5) < 0.04) s.tone -= 0.2;
    } });
    const fl = place([[-1.5, -1.75], [1.4, -1.75], [1.4, -0.7], [-1.5, -0.6]], pc, deg);
    c.blob(fl, 0.3, { mat, z: z + 2.8, bulge: 0.1, tone: tone + 0.05 });
  }
  if (withPelvis) {
    // The seat and the fly: a soft block round the hip joint.
    const W = DIMS.waistB;
    const Wf = DIMS.waistF;
    c.blob([p.BL(-W - 0.2, -2.6), p.BL(Wf + 0.1, -2.6), p.BL(Wf + 0.35, 0.6), p.BL(Wf - 0.4, 2.6), p.BL(-W + 0.2, 2.8), p.BL(-W - 0.5, 0.8)], 1.1, {
      mat,
      z: z + 0.3,
      bulge: 0.3,
      tex: (s) => {
        const [a2] = p.local(s.x, s.y);
        // The fly's seam at the front.
        if (d >= 2 && Math.abs(a2 - (Wf - 0.4)) < fineW(d) * 0.6) s.tone -= 0.2;
      },
    });
  }
}

/** Boot polygons about the ankle (x forward, y down), inside BOOT. */
const BOOT_SHAFT: readonly V[] = [[-1.55, -2.6], [1.15, -2.6], [1.45, -1.0], [2.9, -0.5], [4.25, 0.3], [4.8, 1.2], [4.8, 2.3], [-1.55, 2.3], [-1.8, 1.2]];
const BOOT_TOE: readonly V[] = [[2.6, -0.45], [4.25, 0.32], [4.8, 1.2], [4.82, 2.3], [2.5, 2.3]];
const BOOT_HEEL_CUP: readonly V[] = [[-1.8, 0.6], [0.3, 0.6], [0.4, 2.3], [-1.6, 2.3]];
const BOOT_SOLE: readonly V[] = [[-1.65, 2.15], [4.85, 2.15], [4.85, 2.5], [4.6, 3.0], [1.45, 3.0], [1.25, 2.72], [0.25, 2.72], [0.05, 3.0], [-1.65, 3.0]];

function drawBoot(p: Painter, ankle: V, foot: number, far: boolean, z: number): void {
  const c = p.c;
  const d = p.d;
  const at = p.J(ankle);
  const deg = p.j.rot - foot;
  const tone = far ? -0.16 : 0;
  const lea = p.leather('boot', GR.boot, far, 4);
  const part = c.newPart();
  const seed = far ? 5 : 3;
  const loc = (x: number, y: number): V => {
    const r = rotateAbout([x, y], at, -deg);
    return [r[0] - at[0], r[1] - at[1]];
  };
  c.blob(place(BOOT_SHAFT, at, deg), 0.9, { mat: lea, z, part, bulge: 0.3, tone, tex: (s) => {
    const [x, y] = loc(s.x, s.y);
    // Creases where the boot flexes over the instep.
    if (d >= 2 && x > 1.0 && x < 2.6 && y > -0.8 && y < 1.4 && Math.abs(((x * 1.6 + y * 0.9) % 1 + 1) % 1 - 0.5) < (d >= 4 ? 0.07 : 0.12)) s.tone -= 0.25;
    // The worn leather: scuffs lighter, grime darker.
    const n = noise2(x * 2.2 + seed, y * 2.2, 1, seed);
    if (n > 0.78) s.tone += 0.16;
    else if (n < 0.2) s.tone -= 0.08;
  } });
  c.blob(place(BOOT_HEEL_CUP, at, deg), 0.35, { mat: lea, z: z + 0.5, bulge: 0.12, tone: tone - 0.04 });
  c.blob(place(BOOT_TOE, at, deg), 0.75, { mat: lea, z: z + 0.9, bulge: 0.35, tone: tone + 0.05, tex: (s) => {
    const [x, y] = loc(s.x, s.y);
    // Scuffed toe cap: pale scratches (4×), a worn patch (2×).
    if (d >= 4) {
      const sc = Math.abs(((x * 1.9 - y * 1.1) * 1.3) % 1);
      if (sc < 0.1 && hash2(s.X >> 1, s.Y >> 1, seed) > 0.45 && y < 1.6) s.tone += 0.35;
    } else if (Math.hypot(x - 3.9, y - 0.9) < 0.5) s.tone += 0.2;
  } });
  const sole = p.mat('sole', GR.boot, { lo: 0, hi: 2, rim: 0 });
  c.blob(place(BOOT_SOLE, at, deg), 0.25, { mat: sole, z: z + 1.2, bulge: 0.05, tex: (s) => {
    const [x, y] = loc(s.x, s.y);
    // The welt (a lighter stitched line) and the tread lugs.
    if (d >= 2 && y < 2.32 && x > -1.4) s.tone += 0.25;
    if (d >= 4 && y > 2.75 && ((Math.floor(x * 2.5) & 1) === 0)) s.tone -= 0.3;
  } });
  if (!far && d >= 2) {
    // Laces up the front of the shaft.
    const lace = colAt(GR.boot[3], d);
    const n = d >= 4 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const q = place([[0.75 + t * 1.25, -2.2 + t * 1.65]], at, deg)[0];
      c.dot(q[0], q[1], lace);
      if (d >= 4) c.dot(q[0] + 0.25, q[1] - 0.25, lace);
    }
  }
}

// ------------------------------------------------------------------------------------ torso

/**
 * The jacket, shirt and tie. Torso frame (a forward, b up from the pelvis). The tweed jacket is
 * open: its front edge runs from the collar down the lapel to the one button, then cuts away to the
 * hem; the shirt and the tie show in front of it, the belt and buckle under the cutaway.
 */
function drawTorso(p: Painter): void {
  const c = p.c;
  const d = p.d;
  const D = DIMS;
  const H = p.H;
  const fw = fineW(d);
  const tweed = p.cloth('tweed', GR.tweed, false, { rim: 3, hi: 6 });
  const shirt = p.cloth('shirt', GR.shirt, false, { rim: 3, amb: 0.05 });
  const tieM = p.cloth('tie', GR.tie, false, { rim: 2, spec: 0.15, shine: 10, hi: 4 });

  // The shirt front (behind the jacket): collar to the belt.
  const shirtPts = p.poly([[0.2, H + 0.5], [D.chestF + 0.25, H - 2.6], [D.chestF + 0.1, H - 6.0], [D.waistF + 0.35, 2.4], [D.waistF + 0.3, -0.6], [-0.5, -0.6], [-0.5, H]]);
  c.blob(shirtPts, 1.0, { mat: shirt, z: Z.shirt, bulge: 0.3, tex: (s) => {
    const [a, b] = p.local(s.x, s.y);
    // The button placket and a sweat-darkened, grimy collar band.
    if (d >= 2 && Math.abs(a - (D.chestF - 0.55 - (H - b) * 0.04)) < fw * 0.6 && b < H - 1.5) s.tone -= 0.18;
    if (b > H - 1.3) s.tone -= 0.32;
    if (noise2(s.x * 1.5, s.y * 1.5, 1.2, 41) > 0.68) s.tone -= 0.12;
  } });
  // The shirt collar: two points round the neck, sweat-dark.
  c.blob(p.poly([[-0.6, H + 1.0], [1.6, H + 0.7], [2.2, H - 0.7], [1.1, H - 0.2], [-0.4, H - 0.1]]), 0.35, { mat: shirt, z: Z.tie + 0.6, bulge: 0.15, tone: -0.3 });

  // The tie: a narrow knot at the collar, the blade hanging down the shirt front.
  const kx = D.chestF - 0.75;
  c.blob(p.poly([[kx - 0.5, H - 0.25], [kx + 0.45, H - 0.25], [kx + 0.35, H - 1.25], [kx - 0.35, H - 1.25]]), 0.25, { mat: tieM, z: Z.tie + 0.4, tone: 0.06 });
  c.blob(p.poly([[kx - 0.4, H - 1.15], [kx + 0.4, H - 1.15], [D.chestF + 0.45, H - 4.5], [D.waistF + 0.65, 2.3], [D.waistF + 0.05, 1.4], [D.waistF - 0.4, 2.4], [D.chestF - 0.65, H - 4.5]]), 0.3, {
    mat: tieM,
    z: Z.tie,
    bulge: 0.1,
    tex: (s) => {
      // A faint diagonal stripe in the weave (4×).
      if (d >= 4 && Math.abs(((s.x + s.y) * 1.4) % 1) < 0.12) s.tone -= 0.12;
    },
  });

  // The belt: all round the waist, seen in the cutaway; a dull buckle at the front.
  const belt = p.leather('belt', GR.leather);
  c.blob(p.poly([[-D.waistB - 0.3, 0.5], [D.waistF + 0.45, 0.5], [D.waistF + 0.45, -0.75], [-D.waistB - 0.3, -0.75]]), 0.35, { mat: belt, z: Z.belt + 1.4, bulge: 0.1, tex: (s) => {
    const [, b] = p.local(s.x, s.y);
    if (d >= 4 && (Math.abs(b - 0.32) < 0.07 || Math.abs(b + 0.58) < 0.07) && (s.X & 1) === 0) s.tone -= 0.25;
    if (noise2(s.x * 3, s.y * 3, 1, 23) > 0.7) s.tone += 0.15;
  } });
  const brass = p.mat('brass', GR.brass, { spec: 0.6, shine: 18, rim: 2 });
  c.blob(p.poly([[D.waistF - 0.55, 0.65], [D.waistF + 0.6, 0.65], [D.waistF + 0.6, -0.9], [D.waistF - 0.55, -0.9]]), 0.2, { mat: brass, z: Z.belt + 2.0, bulge: 0.08, tex: (s) => {
    const [a, b] = p.local(s.x, s.y);
    if (Math.abs(a - D.waistF) < 0.32 && Math.abs(b + 0.12) < 0.42) s.tone -= 0.6;
  } });

  // The jacket body: back line, shoulders, the open front edge (lapel → button → cutaway).
  const jacket = p.poly([
    [-1.5, H + 0.35],
    [-D.chestB + 0.1, H - 1.0],
    [-D.chestB - 0.3, H - 3.6],
    [-D.chestB - 0.15, 4.5],
    [-D.waistB - 0.05, 1.5],
    [-D.waistB - 0.5, -1.8],
    [-D.waistB - 0.45, -3.1],
    [D.waistF - 0.6, -3.15],
    [D.waistF - 0.1, -2.2],
    [D.waistF + 0.25, 1.4],
    [D.waistF + 0.15, 2.9],
    [D.chestF - 1.0, H - 4.6],
    [0.9, H - 0.3],
    [0.4, H + 0.5],
  ]);
  const seed = 7;
  const herring: Texture = (s) => {
    const [a, b] = p.local(s.x, s.y);
    if (d >= 4) {
      // Herringbone: columns of short slanted threads, the slant flips each column.
      const k = 0.5;
      const colI = Math.floor(a / (k * 1.5));
      const yy = b + (colI % 2 === 0 ? a : -a) * 0.9;
      const ph = (((yy / k) % 1) + 1) % 1;
      if (ph < 0.28) s.tone -= 0.13;
      else if (ph > 0.6 && ph < 0.72) s.tone += 0.07;
      // Flecks: a few light and dark threads.
      const f = hash2(s.X, s.Y, seed);
      if (f > 0.975) s.tone += 0.3;
      else if (f < 0.02) s.tone -= 0.3;
    } else if (d >= 2) {
      const f = hash2(s.X, s.Y, seed);
      if (f > 0.93) s.tone += 0.18;
      else if (f < 0.08) s.tone -= 0.16;
    }
    // Wear: grime in the lower back and round the pockets, rubbed light at the hem.
    const g = noise2(s.x * 1.2, s.y * 1.2, 1.5, seed + 1);
    if (g > 0.7) s.tone -= 0.12;
    if (b < -2.2 && hash2(s.X >> 1, s.Y >> 1, 3) > 0.4) s.tone += 0.12;
  };
  c.blob(jacket, 2.4, {
    mat: tweed,
    z: Z.torso,
    bulge: 0.4,
    tex: (s) => {
      herring(s);
      const [a, b] = p.local(s.x, s.y);
      // The side seam from the armpit and the back seam (2×+).
      if (d >= 2 && Math.abs(a + 0.35 + (H - b) * 0.02) < fw * 0.5 && b < H - 3.2) s.tone -= 0.2;
      // Folds: from under the arm down towards the button, and across the small of the back.
      if (d >= 2) {
        const f1 = segDist(s.x, s.y, p.TL(-1.4, H - 3.4), p.TL(0.9, 2.0));
        const f2 = segDist(s.x, s.y, p.TL(-2.6, 2.6), p.TL(-0.4, 3.6));
        const f3 = segDist(s.x, s.y, p.TL(-0.6, H - 2.2), p.TL(1.6, H - 6.2));
        const w = fw * 0.75;
        if (f1 < w || f2 < w || f3 < w) s.tone -= 0.22;
        else if (f1 < w * 2.6 || f3 < w * 2.4) s.tone += 0.06;
      }
      // The front edge worn light (lapel and cutaway).
      if (d >= 2) {
        const e = Math.min(
          segDist(s.x, s.y, p.TL(0.9, H - 0.3), p.TL(D.chestF - 1.0, H - 4.6)),
          segDist(s.x, s.y, p.TL(D.chestF - 1.0, H - 4.6), p.TL(D.waistF + 0.15, 2.9)),
          segDist(s.x, s.y, p.TL(D.waistF + 0.15, 2.9), p.TL(D.waistF + 0.25, 1.4)),
        );
        if (e < fw * 1.1) s.tone += 0.14;
      }
    },
  });
  // Lapel: a rolled band along the V, the notch at the gorge.
  c.blob(p.poly([[0.25, H + 0.45], [1.0, H - 0.2], [D.chestF - 0.95, H - 4.5], [D.chestF - 1.6, H - 4.1], [D.chestF - 1.4, H - 3.1], [-0.2, H - 0.4]]), 0.35, {
    mat: tweed,
    z: Z.lapel,
    bulge: 0.2,
    tone: 0.06,
    tex: herring,
  });
  // The jacket collar standing at the back of the neck.
  c.blob(p.poly([[-1.75, H + 0.25], [0.45, H + 0.9], [0.65, H - 0.2], [-1.6, H - 0.85]]), 0.35, { mat: tweed, z: Z.lapel - 0.4, bulge: 0.2, tone: 0.02, tex: herring });
  // The button at the waist (dark horn).
  const horn = p.leather('horn', GR.leather);
  const bt = p.TL(D.waistF - 0.05, 2.75);
  c.ellipsoid(bt[0], bt[1], 0.42, 0.42, { mat: horn, z: Z.pocket + 0.8, round: 0.7 });
  // Hip pocket with its flap, a breast-pocket welt.
  c.blob(p.poly([[-1.3, 0.2], [D.waistF - 0.3, 0.2], [D.waistF - 0.25, -1.0], [-1.25, -1.05]]), 0.3, { mat: tweed, z: Z.pocket, bulge: 0.1, tone: 0.05, tex: (s) => {
    herring(s);
    const [, b] = p.local(s.x, s.y);
    if (b < -0.85) s.tone -= 0.3;
  } });
  c.blob(p.poly([[-0.4, H - 4.4], [1.3, H - 4.6], [1.3, H - 5.15], [-0.4, H - 4.95]]), 0.2, { mat: tweed, z: Z.pocket, bulge: 0.05, tone: 0.04, tex: herring });
}

// ------------------------------------------------------------------------------------ arms and hands

/**
 * A tweed sleeve: shoulder → elbow → wrist capsules, the sleeve head over the shoulder, a leather
 * elbow patch, the fold inside the elbow, a worn cuff with a sliver of the shirt cuff.
 */
function drawArm(p: Painter, shoulder: V, el: V, wr: V, far: boolean, z: number): void {
  const c = p.c;
  const d = p.d;
  const s = p.J(shoulder);
  const e = p.J(el);
  const w = p.J(wr);
  const tone = far ? -0.2 : 0;
  const tweed = p.cloth('tweed', GR.tweed, far, { rim: 3, hi: 6 });
  const R = DIMS.armR;
  const ua = angleOf(s, e);
  const fa = angleOf(e, w);
  // The sleeve ends short of the wrist (the shirt cuff, then the hand).
  const cuffEnd = lerpV(w, e, Math.min(0.2, 0.75 / (Math.hypot(w[0] - e[0], w[1] - e[1]) || 1)));
  const part = c.newPart();
  const seed = far ? 13 : 19;
  const tex: Texture = (sm) => {
    if (d >= 4) {
      const f = hash2(sm.X, sm.Y, seed);
      if (f > 0.975) sm.tone += 0.28;
      else if (f < 0.03) sm.tone -= 0.28;
      if ((((sm.X + (sm.Y >> 1)) >> 1) & 1) === 0 && hash2(sm.X, sm.Y, seed + 1) > 0.6) sm.tone -= 0.07;
    } else if (d >= 2) {
      const f = hash2(sm.X, sm.Y, seed);
      if (f > 0.93) sm.tone += 0.16;
      else if (f < 0.07) sm.tone -= 0.14;
    }
  };
  chain(p, [s, e, cuffEnd], [R[0], R[1], R[2]], { mat: tweed, z, part, tone, round: 0.85, tex });
  // The sleeve head over the shoulder.
  c.ellipsoid(s[0], s[1], R[0] + 0.12, R[0] + 0.12, { mat: tweed, z, part, tone, round: 0.85, tex });
  let bend = fa - ua;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  if (Math.abs(bend) > 14) {
    const sg = Math.sign(bend);
    const fi = addV(e, dirOf((ua + fa) / 2 - 90 * sg), R[1] * 0.55);
    c.shade(fi[0] - 2, fi[1] - 2, 4, 4, (x, y) => (Math.hypot(x - fi[0], y - fi[1]) < 0.6 ? -0.45 : 0), part);
    // The leather elbow patch on the outside of the bend.
    const po = addV(e, dirOf((ua + fa) / 2 + 90 * sg), R[1] * 0.25);
    const deg = -(ua + fa) / 2 + 90;
    const patch = p.leather('patch', GR.leather, far);
    c.blob(place([[-0.95, -0.6], [0.95, -0.6], [1.0, 0.6], [-0.95, 0.65]], po, deg), 0.4, { mat: patch, z: z + 0.6, bulge: 0.2, tone, tex: (sm) => {
      if (d >= 4 && (sm.u < 0.08 || sm.u > 0.92 || sm.v < 0.1 || sm.v > 0.9) && ((sm.X + sm.Y) & 1) === 0) sm.tone -= 0.3;
    } });
  }
  // The worn cuff and the shirt cuff.
  const shirt = p.cloth('shirt', GR.shirt, far, { rim: 3 });
  const sc0 = cuffEnd;
  const sc1 = lerpV(w, e, -0.05);
  c.capsule(sc0[0], sc0[1], sc1[0], sc1[1], R[2] - 0.15, R[2] - 0.25, { mat: shirt, z: z - 0.3, tone: tone - 0.12 });
  if (d >= 2) {
    const c1 = lerpV(cuffEnd, e, 0.12);
    c.shade(Math.min(c1[0], cuffEnd[0]) - 2, Math.min(c1[1], cuffEnd[1]) - 2, 4 + Math.abs(c1[0] - cuffEnd[0]), 4 + Math.abs(c1[1] - cuffEnd[1]), (x, y) => (segDist(x, y, c1, cuffEnd) < 0.22 ? 0.16 : 0), part);
  }
}

/**
 * A realistic hand at the wrist, turned along the forearm: palm and knuckles, the thumb; a fist or
 * a grip wraps round (its middle on the wrist target), 'open' / 'point' / 'thumb' reach out.
 */
function drawHand(p: Painter, el: V, wr: V, shape: HandShape, far: boolean, z: number): void {
  const c = p.c;
  const d = p.d;
  const e = p.J(el);
  const w = p.J(wr);
  const fa = angleOf(e, w);
  const u = dirOf(fa);
  // The side "up" of the forearm (the thumb side): the normal turned towards −y in body space.
  let n: V = [u[1], -u[0]];
  if (n[1] > 0.15 || (Math.abs(n[1]) <= 0.15 && n[0] < 0)) n = [-n[0], -n[1]];
  const skin = p.skin();
  const tone = far ? -0.22 : 0;
  const part = c.newPart();
  const knuckle: Texture = (s) => {
    if (d >= 4 && Math.abs(segT(s.x, s.y, w, addV(w, u, 1.4)) - 0.62) < 0.08) s.tone -= 0.22;
  };
  if (shape === 'fist' || shape === 'grip') {
    const k0 = addV(w, u, -0.25);
    const k1 = addV(w, u, 0.75);
    c.capsule(k0[0], k0[1], k1[0], k1[1], 0.78, 0.82, { mat: skin, z, part, tone, round: 0.8, tex: knuckle });
    const th = addV(addV(w, n, 0.62), u, 0.2);
    c.capsule(th[0], th[1], th[0] + u[0] * 0.75, th[1] + u[1] * 0.75, 0.3, 0.26, { mat: skin, z: z + 0.5, tone: tone + 0.05, round: 0.8 });
  } else if (shape === 'open') {
    const k1 = addV(w, u, 0.9);
    c.capsule(w[0], w[1], k1[0], k1[1], 0.72, 0.65, { mat: skin, z, part, tone, round: 0.7 });
    const tip = addV(k1, u, 1.25);
    c.capsule(k1[0], k1[1], tip[0], tip[1], 0.55, 0.42, { mat: skin, z, part, tone, round: 0.7, tex: (s) => {
      if (d >= 4 && Math.abs(s.v) > 0.15 && Math.abs(s.v) < 0.3) s.tone -= 0.25;
    } });
    const th0 = addV(w, n, 0.55);
    const th1 = addV(addV(th0, n, 0.6), u, 0.8);
    c.capsule(th0[0], th0[1], th1[0], th1[1], 0.3, 0.24, { mat: skin, z: z + 0.4, tone, round: 0.8 });
  } else if (shape === 'point') {
    const k1 = addV(w, u, 0.75);
    c.capsule(w[0], w[1], k1[0], k1[1], 0.78, 0.78, { mat: skin, z, part, tone, round: 0.8, tex: knuckle });
    const f0 = addV(k1, n, 0.35);
    const f1 = addV(f0, u, 1.6);
    c.capsule(f0[0], f0[1], f1[0], f1[1], 0.3, 0.25, { mat: skin, z: z + 0.3, tone, round: 0.8 });
  } else {
    // Thumb up: a fist, the thumb standing up (body space up).
    const k0 = addV(w, u, -0.2);
    const k1 = addV(w, u, 0.75);
    c.capsule(k0[0], k0[1], k1[0], k1[1], 0.8, 0.82, { mat: skin, z, part, tone, round: 0.8, tex: knuckle });
    const up = p.BL(0, -1);
    const upv: V = [up[0] - p.P0[0], up[1] - p.P0[1]];
    const t0 = addV(addV(w, u, 0.3), upv, 0.5);
    const t1 = addV(t0, upv, 1.25);
    c.capsule(t0[0], t0[1], t1[0], t1[1], 0.34, 0.3, { mat: skin, z: z + 0.5, tone: tone + 0.05, round: 0.8 });
  }
}

/**
 * A hand closed round a gun's grip, turned with the gun (`deg`, canvas, clockwise; `k` the gun's
 * scale): the palm wraps the grip, the fingers curl round its front (creases at 4× and 2×), the
 * thumb lies along the frame above.
 */
function drawGripHand(p: Painter, at: V, deg: number, k: number, far: boolean, z: number): void {
  const c = p.c;
  const d = p.d;
  const cs = Math.cos(deg * DEG);
  const sn = Math.sin(deg * DEG);
  const toC = (x: number, y: number): V => [at[0] + (x * cs - y * sn) * k, at[1] + (x * sn + y * cs) * k];
  const toL = (X: number, Y: number): V => {
    const x = (X - at[0]) / k;
    const y = (Y - at[1]) / k;
    return [x * cs + y * sn, -x * sn + y * cs];
  };
  const skin = p.skin();
  const tone = far ? -0.24 : 0;
  const pts: Array<[number, number]> = [[-1.1, -1.3], [0.45, -1.3], [0.78, -0.55], [0.72, 0.85], [0.3, 1.05], [-0.95, 0.95], [-1.2, -0.2]];
  c.blob(pts.map(([x, y]) => toC(x, y)), 0.5, {
    mat: skin,
    z,
    bulge: 0.2,
    tone,
    tex: d >= 2 ? (s) => {
      const [x, y] = toL(s.x, s.y);
      // The curled fingers: creases across the front of the fist.
      if (x > 0.05) for (const fy of [-0.62, -0.08, 0.45]) if (Math.abs(y - fy) < (d >= 4 ? 0.09 : 0.14)) s.tone -= 0.32;
      // The knuckle ridge.
      if (d >= 4 && Math.abs(x - 0.0) < 0.08 && y > -0.9) s.tone -= 0.18;
    } : null,
  });
  const t0 = toC(-0.85, -1.15);
  const t1 = toC(0.6, -1.42);
  c.capsule(t0[0], t0[1], t1[0], t1[1], 0.34 * k, 0.27 * k, { mat: skin, z: z + 0.4, tone: tone + 0.06, round: 0.8 });
}

// ------------------------------------------------------------------------------------ gear

interface Placed {
  buf: PixelBuffer;
  grip: V;
  muzzle: V;
}

const placedCache = new Map<string, Placed>();

/** An item buffer turned like the rig does (exact quarter turns, else a smooth turn); points in logical px (centres). */
function turned(key: string, buf: PixelBuffer, d: number, grip: readonly [number, number], tip: readonly [number, number], deg: number): Placed {
  const k = `${key}|${d}|${deg.toFixed(3)}`;
  const hit = placedCache.get(k);
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
    out = { buf: b, grip: gg, muzzle: mm };
  } else {
    const b = d > 1 ? buf.rotated(deg * DEG, { align: d }) : buf.rotated(deg * DEG);
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
  if (placedCache.size > 160) placedCache.delete(placedCache.keys().next().value as string);
  placedCache.set(k, out);
  return out;
}

/** Place the gun (drawn on the canvas, gritty-gun.ts); returns its muzzle (canvas, logical centre). */
function drawGun(p: Painter, g: GunPl, z: number): V {
  const m = {
    metal: p.mat('gunmetal', GR.gunmetal, { spec: 0.9, shine: 22, lo: 1, hi: 4, rim: 1, rimW: 1 }),
    dark: p.mat('gundark', GR.gunmetal, { spec: 0.5, shine: 16, lo: 1, hi: 3, rim: 1, rimW: 1 }),
    polymer: p.mat('polymer', GR.polymer, { spec: 0.2, shine: 10, lo: 1, hi: 4, rim: 0, rimW: 1 }),
    drab: p.mat('drab', GR.drab, { spec: 0.15, shine: 10, lo: 1, hi: 5, rim: 1, rimW: 1 }),
  };
  return drawGunG(p.c, m, { kind: g.kind, at: p.J(g.grip), angle: g.angle + p.j.rot, z, d: p.d });
}

/** The held item; returns the `hand` point (the item's tip or centre), canvas logical. */
function drawHeld(p: Painter, el: V, wr: V, item: Pose['held'], zKnife: number, zHeld: number): V | null {
  if (!item || item === 'none') return null;
  const d = p.d;
  // Canvas angle of the forearm (from straight down, + forward); items follow it unless the pose
  // gives `heldAngle` (0 forward, −90 up), which turns with the figure.
  const fore = angleOf(p.j.T(el), p.j.T(wr));
  const w = p.j.T(wr);
  const itemAng = p.j.pose.heldAngle !== undefined ? p.j.pose.heldAngle + p.j.rot : 90 - fore;
  if (item === 'grenade' || item === 'snack' || item === 'gift') {
    const buf = d === 1 ? (item === 'grenade' ? grenadeArt() : item === 'snack' ? snackArt() : giftArt()) : heldArtHd(item, d as HdDensity);
    const dir = dirOf(fore);
    const cx = w[0] + dir[0] * 2;
    const cy = w[1] + dir[1] * 2 - 1;
    p.c.image(buf, Math.round((cx - buf.w / d / 2) * d) / d, Math.round((cy - buf.h / d / 2) * d) / d, { z: zHeld });
    return [cx, cy];
  }
  if (isProp(item)) {
    const art = d === 1 ? propArt(item as PropKind) : propHd(item as PropKind, d as HdDensity);
    const pl = turned(`prop:${item}`, art.buf, d, art.grip, art.tip, itemAng);
    const x = Math.round((w[0] - pl.grip[0]) * d) / d;
    const y = Math.round((w[1] - pl.grip[1]) * d) / d;
    p.c.image(pl.buf, x, y, { z: zKnife });
    return [x + pl.muzzle[0], y + pl.muzzle[1]];
  }
  const kb = d === 1 ? knifeArt() : knifeArtHd(d as HdDensity);
  const ang = itemAng;
  const pl = turned('knife', kb, d, [1, 1], [7, 1], ang);
  const dir: V = [Math.cos(ang * DEG), Math.sin(ang * DEG)];
  const cx = w[0] + dir[0] * 2.6;
  const cy = w[1] + dir[1] * 2.6;
  p.c.image(pl.buf, Math.round((cx - pl.buf.w / d / 2) * d) / d, Math.round((cy - pl.buf.h / d / 2) * d) / d, { z: zKnife });
  return [w[0] + dir[0] * 6.5, w[1] + dir[1] * 6.5];
}

// ------------------------------------------------------------------------------------ passes

/** Rim light from behind, from the right and above: its direction in the picture plane (x right, y down). */
const RIM_DIR: readonly [number, number] = [0.87, -0.5];

/**
 * The rim: px on the silhouette's right / upper-right edge (an empty px within `rw` art px to the
 * right, upper right or above) whose normal faces the rim light take a cool tone, brighter on the
 * outer px. Fixed-colour items (the gun) get a rim on their top-right edge from their own tone.
 */
function rimPass(p: Painter, out: PixelBuffer): void {
  const c = p.c;
  const { W, H, d } = c;
  if (d === 1) return;
  // The rim comes from above: full on the head and shoulders, fading down the legs.
  let top = H;
  let bottom = 0;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) if (c.mat[Y * W + X] !== 0) {
    top = Math.min(top, Y);
    bottom = Math.max(bottom, Y);
    break;
  }
  const span = Math.max(1, bottom - top);
  const upright = Math.abs(p.j.rot) < 30;
  const rw = d >= 4 ? 2 : 1;
  const rim = rampAt(GR.rim, d);
  const { mat, fix, nx, ny } = c;
  const data = out.data;
  const empty = (X: number, Y: number): boolean => X < 0 || Y < 0 || X >= W || Y >= H || mat[Y * W + X] === 0;
  const thr = 0.42;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (mat[i] === 0) continue;
      // The nearest open px to the right, upper right or above (the rim side of the silhouette).
      let k = 0;
      let ox = 0;
      let oy = 0;
      for (let q = 1; q <= rw && k === 0; q++) {
        if (empty(X + q, Y)) [k, ox, oy] = [q, 1, 0];
        else if (empty(X + q, Y - q)) [k, ox, oy] = [q, 0.7, -0.7];
        else if (empty(X, Y - q)) [k, ox, oy] = [q, 0, -1];
      }
      if (k === 0) continue;
      if (fix[i] !== 0) continue;
      const info = p.info.get(mat[i]);
      if (!info || info.rim < 0) continue;
      // Facing in the picture plane: the surface normal's direction, or the open side when flat.
      let fx = nx[i];
      let fy = ny[i];
      const fl = Math.hypot(fx, fy);
      if (fl < 0.25) {
        fx = ox;
        fy = oy;
      } else {
        fx /= fl;
        fy /= fl;
      }
      const fade = upright ? 1 - 0.85 * Math.max(0, (Y - top) / span - 0.4) / 0.6 : 0.85;
      const s = (fx * RIM_DIR[0] + fy * RIM_DIR[1]) * fade;
      if (s < thr) continue;
      if (k > 1 && (info.rimW < 2 || s < 0.75)) continue;
      let lvl = info.rim + (s > 0.85 ? 1 : 0) - (s < 0.6 ? 1 : 0) - (k > 1 ? 1 : 0);
      if (d === 1) lvl = Math.min(lvl, 1);
      data[i] = rim[Math.max(0, Math.min(rim.length - 1, lvl))];
    }
  }
}

/**
 * The outline: an empty px next to the figure takes ink on the shadow side (the figure lies to
 * its upper left: it sinks into the shade) and the deepest tone of the material on the lit side
 * (a thin dark line, never black); the lit side is thinner at 4×. The Helium Head's outline is pink.
 */
function outlinePass(p: Painter, out: PixelBuffer, headParts: ReadonlySet<number> | null): void {
  const c = p.c;
  const { W, H, d } = c;
  const { mat, fix, part } = c;
  const data = out.data;
  const rShadow = d >= 4 ? 2 : 1;
  const rLit = 1;
  const ink = INK0;
  const pink = HELIUM_RIM >>> 0;
  const src = new Uint8Array(W * H);
  for (let i = 0; i < src.length; i++) src[i] = mat[i] !== 0 ? 1 : 0;
  const ring: Array<[number, number]> = [];
  for (let dy = -rShadow; dy <= rShadow; dy++) for (let dx = -rShadow; dx <= rShadow; dx++) {
    const q = dx * dx + dy * dy;
    if (q === 0 || q > rShadow * rShadow + (rShadow > 1 ? 0.5 : 0)) continue;
    ring.push([dx, dy]);
  }
  ring.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (src[i]) continue;
      for (const [dx, dy] of ring) {
        const XX = X + dx;
        const YY = Y + dy;
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
        const j = YY * W + XX;
        if (!src[j]) continue;
        // The nearest figure px decides: below / right of this px → the lit (upper-left) side.
        const litSide = dx + dy > 0;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (litSide && dist > rLit) break;
        if (headParts && headParts.has(part[j])) data[i] = pink;
        else if (!litSide) data[i] = ink;
        else if (fix[j] !== 0) {
          const h = hdHome(fix[j]);
          data[i] = d === 1 ? ink : h ? h.ramp[0] : ink;
        } else data[i] = p.info.get(mat[j])?.edge ?? ink;
        break;
      }
    }
  }
  out.touch();
}

/** Trim drawn px outside the frame rectangle (inset by the outline width) so the outline stays whole. */
function fitFrame(c: HdCanvas, f: { x: number; y: number; w: number; h: number }, inset: number): [number, number, number, number] {
  const { W, H, d } = c;
  const cx = Math.round(f.x * d);
  const cy = Math.round(f.y * d);
  const cw = Math.round(f.w * d);
  const ch = Math.round(f.h * d);
  const ax = cx + inset;
  const ay = cy + inset;
  const bx = cx + cw - inset;
  const by = cy + ch - inset;
  for (let Y = 0; Y < H; Y++) {
    const inY = Y >= ay && Y < by;
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (c.mat[i] === 0 || (inY && X >= ax && X < bx)) continue;
      c.mat[i] = 0;
      c.fix[i] = 0;
    }
  }
  return [cx, cy, cw, ch];
}

// ------------------------------------------------------------------------------------ the figure

/**
 * Paint the figure: back to front (the far arm, the legs, the jacket, the head, the gun, the near
 * arm), the rig's rule that a near arm across the face goes behind the head; then light, rim and
 * outline. Returns the buffer (cropped to `frame` when given) and the canvas points.
 */
export function paintFigure(j: PaintJob): PaintOut {
  const p = new Painter(j);
  const c = p.c;
  const sk = j.sk;
  const pose = j.pose;
  const upper = j.part !== 'lower';
  const lower = j.part !== 'upper';
  const pts: Record<string, V> = {};
  let headParts: Set<number> | null = null;

  if (upper) {
    if (sk.offGun) drawGun(p, sk.offGun, Z.farArm - 2);
    drawArm(p, sk.shF, sk.elF, sk.wrF, true, Z.farArm);
    // The support hand on a two-handed gun closes round it (the grip or the heavy gun's fore-grip).
    const support = sk.gun && pose.gunHand !== 'far' && !pose.armF && sk.handF === 'grip';
    if (support && sk.gun) drawGripHand(p, p.J(sk.wrF), sk.gun.angle + j.rot, sk.gun.kind === 'pistol' ? 0.9 : HEAVY_K * 0.9, true, Z.farHand);
    else drawHand(p, sk.elF, sk.wrF, sk.handF, true, Z.farHand);
  }
  if (lower) {
    drawLeg(p, sk.hipF, sk.kneeF, sk.ankleF, true, false, Z.farLeg);
    drawBoot(p, sk.ankleF, sk.footF, true, Z.farBoot);
    drawLeg(p, sk.hipN, sk.kneeN, sk.ankleN, false, true, Z.nearLeg);
    drawBoot(p, sk.ankleN, sk.footN, false, Z.nearBoot);
  }
  if (upper) {
    drawTorso(p);
    const nk = sk.neck;
    const inFace = (q: V): boolean => {
      // In the torso frame: in front of the neck, from the chin up to the brow.
      const dx = (q[0] - nk[0]) * sk.f[0] + (q[1] - nk[1]) * sk.f[1];
      const up = (q[0] - nk[0]) * sk.u[0] + (q[1] - nk[1]) * sk.u[1];
      return dx >= 0.5 && dx <= 4.3 && up >= 0.8 && up <= 7;
    };
    const mid: V = [(sk.elN[0] + sk.wrN[0]) / 2, (sk.elN[1] + sk.wrN[1]) / 2];
    const raised = inFace(sk.wrN) || inFace(mid);
    const hz = raised ? Z.held + 2 : Z.head;
    const hx = (pose.head?.dx ?? 0) * K.head;
    const hy = (pose.head?.dy ?? 0) * K.head;
    const neckTop = p.J([nk[0] + sk.u[0] * 1.6 + hx, nk[1] + sk.u[1] * 1.6 + hy]);
    const neckBase = p.J([nk[0] - sk.u[0] * 0.6, nk[1] - sk.u[1] * 0.6]);
    const hm: HeadMats = { skin: p.skin(), stubble: p.stubble(), hair: p.hair() };
    const scale = pose.headScale === 2 ? 2 : 1;
    const head = drawHead(c, hm, { neck: neckTop, tilt: (pose.head?.tilt ?? 0) + j.rot, scale, expr: pose.expr ?? 'normal', d: j.d, z: hz, soot: pose.expr === 'soot' }, neckBase, Z.neck);
    if (scale === 2) headParts = new Set(head.parts);
    pts.head = head.center;
    if (sk.gun) pts.muzzle = drawGun(p, sk.gun, Z.gun);
    drawArm(p, sk.shN, sk.elN, sk.wrN, false, Z.arm);
    const held = drawHeld(p, sk.elN, sk.wrN, pose.held ?? 'none', Z.knife, Z.held);
    const gunHand = sk.gun && pose.gunHand !== 'far' && !pose.armN && sk.handN === 'grip';
    if (gunHand && sk.gun) drawGripHand(p, p.J(sk.gun.grip), sk.gun.angle + j.rot, sk.gun.kind === 'pistol' ? 1 : HEAVY_K, false, Z.hand);
    else drawHand(p, sk.elN, sk.wrN, sk.handN, false, Z.hand);
    pts.hand = held ?? j.T(sk.wrN);
  }
  const crop = j.frame ? fitFrame(c, j.frame, j.d >= 4 ? 2 : 1) : null;
  const out = c.render({ outline: 'none', ao: 0.32, shadow: 0.34, shadowMax: 2.6, rimLight: 0, sepW: 1 });
  rimPass(p, out);
  outlinePass(p, out, headParts);
  return { buf: crop ? out.crop(crop[0], crop[1], crop[2], crop[3]) : out, pts };
}
