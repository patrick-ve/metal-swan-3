/**
 * Art-direction trial `clay` (clay.ts): the painter. Every part of the figure is a soft clay
 * volume on one HdCanvas (src/game/art/hd/canvas.ts): sausage limbs with round ends, a pear torso,
 * mitten hands, round bean boots, a ball-and-egg head (clay.head.ts). The light is a soft matte
 * plasticine with a broad satin sheen on every volume; faint thumb marks wobble the band edges;
 * parts that meet get a dark crevice and a wide contact shade (clay.ts `contactShade`).
 *
 * Coordinates: body space (humanoid.ts: feet centre, x forward, y down) → the working canvas
 * (index px, origin OX / OY) → the region canvas (logical px, a joint at the centre of its px).
 * The same code draws the 1× frame (d 1: PAL ramps) and the 2× / 4× frames (PAL_HD ramps).
 */
import type { Color } from '../../../../engine/color';
import type { Ramp } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { HdCanvas, type DrawOpts, type HdMaterial, type TexSample, type Texture } from '../../../art/hd/canvas';
import { BLACK_ONE_HUE } from '../../../art/hd/light';
import type { HandShape, HumanStyle, Pose, RenderPart } from '../../../art/humanoid';
import { isProp } from '../../../art/humanoid-gear';
import { angleTo, DEG, dirOf, rotateAbout, type GunPlacement, type Skeleton, type V } from './clay.rig';

/** The working canvas of the 1× render (the rig's): size and the feet anchor. */
export const CW = 112;
export const CH = 112;
export const OX = 56;
export const OY = 80;

/** Base depths, back to front, far apart so a nearer layer always covers a farther one. */
export const Z = {
  offGun: -48,
  farArm: -42,
  farHand: -36,
  farLeg: -30,
  farBoot: -25,
  nearLeg: -19,
  nearBoot: -14,
  neck: -4,
  shirt: -2,
  torso: 0,
  lapel: 8,
  tie: 12,
  belt: 16,
  head: 22,
  gun: 30,
  arm: 36,
  knife: 42,
  hand: 46,
  held: 50,
} as const;

// ------------------------------------------------------------------------------------ materials

/** Tuning switches (look trials). */
export const CLAY_OPTS = { dither: 0 };

/** A clay material: its HD ramp, its 1× ramp and the light. */
interface ClayMat extends Omit<HdMaterial, 'ramp'> {
  hd: Ramp;
  px: Ramp;
  /** 1× light band range (default: the whole ramp). */
  lo1?: number;
  hi1?: number;
}

/** Soft matte plasticine: a wide wrap, a low contrast core, a broad satin sheen. */
const CLAY = { wrap: 0.28, amb: 0.06, gain: 1, bounce: 0.3, rim: 0.12, spec: 0.62, shine: 5 } as const;

const VIN_HAIR_1X: Ramp = [PAL.ink[1], PAL.brown[0], PAL.brown[1]];

const MATS = {
  skin: { ...CLAY, hd: PAL_HD.skinA, px: PAL.skinA, lo: 2, hi: 6, spec: 0.55, shine: 6 },
  stubble: { ...CLAY, hd: PAL_HD.brown.slice(0, 7), px: PAL.skinA, lo: 3, hi: 5, spec: 0.3, shine: 6, lo1: 0, hi1: 2 },
  lip: { ...CLAY, hd: PAL_HD.skinA, px: PAL.skinA, lo: 2, hi: 5, spec: 0.4 },
  hair: { ...CLAY, hd: PAL_HD.hairB.slice(0, 5), px: VIN_HAIR_1X, lo: 0, hi: 2, spec: 0.7, shine: 6 },
  brow: { ...CLAY, hd: PAL_HD.hairB, px: VIN_HAIR_1X, lo: 0, hi: 2, spec: 0.5, shine: 8 },
  tweed: { ...CLAY, hd: PAL_HD.wood.slice(0, 7), px: PAL.brown, lo: 2, hi: 5 },
  shirt: { ...CLAY, hd: PAL_HD.cloth, px: PAL.cloth, lo: 1, hi: 5, spec: 0.4 },
  tie: { ...CLAY, hd: PAL_HD.red.slice(0, 7), px: PAL.red, lo: 1, hi: 4, spec: 1, shine: 14, wrap: 0.2 },
  olive: { ...CLAY, hd: PAL_HD.olive, px: PAL.olive, lo: 2, hi: 5 },
  boot: { ...CLAY, hd: BLACK_ONE_HUE.slice(0, 6), px: PAL.black, lo: 1, hi: 3, spec: 0.85, shine: 8, rim: 0.2 },
  sole: { ...CLAY, hd: BLACK_ONE_HUE, px: PAL.black, lo: 0, hi: 2, spec: 0, lo1: 0, hi1: 1 },
  belt: { ...CLAY, hd: BLACK_ONE_HUE, px: PAL.black, lo: 1, hi: 4, spec: 0.7, shine: 10 },
  brass: { ...CLAY, hd: PAL_HD.gold, px: PAL.gold, lo: 2, hi: 5, spec: 1, shine: 12 },
  steel: { ...CLAY, hd: PAL_HD.steel, px: PAL.steel, lo: 1, hi: 5, spec: 0.95, shine: 10, wrap: 0.15 },
  gunDark: { ...CLAY, hd: PAL_HD.steel, px: PAL.steel, lo: 0, hi: 3, spec: 0.8, shine: 10, lo1: 0, hi1: 2 },
  drum: { ...CLAY, hd: PAL_HD.olive, px: PAL.olive, lo: 2, hi: 6, spec: 0.7, shine: 8 },
  paper: { ...CLAY, hd: PAL_HD.plaster, px: PAL.sand, lo: 3, hi: 6, spec: 0.4 },
  paperLine: { ...CLAY, hd: PAL_HD.sky, px: PAL.sky, lo: 1, hi: 3, spec: 0.2 },
  eye: { ...CLAY, hd: PAL_HD.snow, px: PAL.snow, lo: 2, hi: 5, spec: 1, shine: 16, wrap: 0.4 },
  grenade: { ...CLAY, hd: PAL_HD.olive, px: PAL.olive, lo: 1, hi: 5, spec: 0.8, shine: 9 },
  pink: { ...CLAY, hd: PAL_HD.pink, px: PAL.pink, lo: 2, hi: 5 },
} satisfies Record<string, ClayMat>;

export type MatName = keyof typeof MATS;

// ------------------------------------------------------------------------------------ the painter

export class ClayPainter {
  readonly c: HdCanvas;
  readonly d: number;
  /** 2× / 4× art (fine detail at 4×: `fine`). */
  readonly hd: boolean;
  readonly fine: boolean;
  readonly st: HumanStyle;
  readonly sk: Skeleton;
  readonly pose: Pose;
  readonly part: RenderPart;
  readonly rot: number;
  /** Region origin on the working canvas (index px). */
  readonly org: V;
  readonly P0: V;
  /** Torso frame on the canvas (lean + rot): forward and up. */
  readonly F: V;
  readonly U: V;
  /** Body-aligned frame (rot only): forward and down. */
  readonly BF: V;
  readonly BD: V;
  readonly H: number;
  private readonly mats = new Map<string, number>();

  constructor(st: HumanStyle, sk: Skeleton, pose: Pose, part: RenderPart, d: number, region: readonly [number, number, number, number]) {
    this.st = st;
    this.sk = sk;
    this.pose = pose;
    this.part = part;
    this.d = d;
    this.hd = d >= 2;
    this.fine = d >= 4;
    this.rot = pose.rot ?? 0;
    this.org = [region[0], region[1]];
    this.c = new HdCanvas(region[2], region[3], d);
    this.P0 = this.J(sk.pelvis);
    this.F = this.R(sk.f);
    this.U = this.R(sk.u);
    this.BF = this.R([1, 0]);
    this.BD = this.R([0, 1]);
    this.H = sk.H;
  }

  /** Turn a body-space vector by the figure's rotation. */
  R(v: V): V {
    const c = Math.cos(this.rot * DEG);
    const s = Math.sin(this.rot * DEG);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  }

  /** Body space → working canvas, index px (unrounded; the rig's T). */
  T0(p: V): V {
    const r = rotateAbout(p, this.sk.pelvis, this.rot);
    return [r[0] + (this.pose.dx ?? 0) + OX, r[1] + (this.pose.dy ?? 0) + OY];
  }

  /** Body space → region canvas, logical px (the centre of the px a point rounds to). */
  Tc(p: V): V {
    const t = this.T0(p);
    return [t[0] - this.org[0] + 0.5, t[1] - this.org[1] + 0.5];
  }

  /** Quantise: 1× joints on px centres, HD joints on the 1 / d grid. */
  q(v: number): number {
    return this.d === 1 ? Math.round(v - 0.5) + 0.5 : Math.round(v * this.d) / this.d;
  }

  J(p: V): V {
    const t = this.Tc(p);
    return [this.q(t[0]), this.q(t[1])];
  }

  /** Torso frame point: a forward, b up from the pelvis. */
  TL(a: number, b: number): V {
    return [this.P0[0] + this.F[0] * a + this.U[0] * b, this.P0[1] + this.F[1] * a + this.U[1] * b];
  }

  /** Torso frame coordinates of a canvas point. */
  local(x: number, y: number): V {
    const dx = x - this.P0[0];
    const dy = y - this.P0[1];
    return [dx * this.F[0] + dy * this.F[1], dx * this.U[0] + dy * this.U[1]];
  }

  /** Body-aligned point: dx forward, dy down from the pelvis. */
  BL(dx: number, dy: number): V {
    return [this.P0[0] + this.BF[0] * dx + this.BD[0] * dy, this.P0[1] + this.BF[1] * dx + this.BD[1] * dy];
  }

  /** A material by name (+ overrides). */
  mat(name: MatName, o: Partial<ClayMat> = {}): number {
    const key = name + JSON.stringify(o);
    let m = this.mats.get(key);
    if (m === undefined) {
      const M: ClayMat = { ...MATS[name], ...o };
      const { hd, px, lo1, hi1, ...light } = M;
      if (this.hd) m = this.c.material({ ...light, ramp: hd, dither: this.fine && CLAY_OPTS.dither > 0 && (light.spec ?? 0) < 0.9 ? CLAY_OPTS.dither : undefined });
      else {
        // 1×: the PAL ramp, its whole range lit; speculars only on gloss (tie, steel, boots).
        const n = px.length;
        m = this.c.material({ ...light, ramp: px, lo: lo1 ?? 0, hi: hi1 ?? n - 1, spec: (light.spec ?? 0) >= 0.9 ? 0.6 : 0, wrap: (light.wrap ?? 0) * 0.6 });
      }
      this.mats.set(key, m);
    }
    return m;
  }

  /** A fixed colour of a material's ramp (HD index, 1× index). */
  col(name: MatName, iHd: number, i1: number): Color {
    const M = MATS[name];
    const r = this.hd ? M.hd : M.px;
    const i = this.hd ? iHd : i1;
    return r[Math.max(0, Math.min(r.length - 1, i))];
  }

  /** Paint a fixed-colour disc (pupils, catchlights): logical centre and radius. */
  disc(cx: number, cy: number, r: number, col: Color, z = 1e6): void {
    const rr = Math.max(r, 0.5 / this.d);
    this.c.paint(cx - rr - 1, cy - rr - 1, rr * 2 + 2, rr * 2 + 2, (x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr ? col : 0), z);
  }
}

// ------------------------------------------------------------------------------------ helpers

/** A capsule chain of one part (round sausage). */
export function sausage(p: ClayPainter, pts: readonly V[], radii: readonly number[], o: DrawOpts): number {
  const part = o.part ?? p.c.newPart();
  for (let i = 0; i < pts.length - 1; i++) p.c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radii[i], radii[i + 1], { ...o, part });
  return part;
}

/** Points in a local frame (x along `ang` deg from forward, y 90° clockwise of it) placed at `at`. */
export function place(pts: ReadonlyArray<readonly [number, number]>, at: V, ang: number): V[] {
  const c = Math.cos(ang * DEG);
  const s = Math.sin(ang * DEG);
  return pts.map(([x, y]) => [at[0] + x * c - y * s, at[1] + x * s + y * c]);
}

/** A cheap smooth value noise in [−1, 1] (hash lattice, smoothstep blend). */
export function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const h = (a: number, b: number): number => {
    let n = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return ((n >>> 0) / 4294967295) * 2 - 1;
  };
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}

/**
 * Clay surface: faint thumb marks — a slow wobble of the normal (stable in the part's own
 * coordinates `u`, `v`), so the light bands get the soft uneven edges of hand-pressed plasticine.
 * 4× only (at 2× and 1× it would read as noise).
 */
export function thumbed(p: ClayPainter, seed: number, k = 1, scale = 1): Texture | null {
  if (!p.fine) return null;
  return (s: TexSample) => {
    const a = vnoise(s.u * 3.1 * scale + seed, s.v * 2.3 * scale, seed) * 0.16 * k;
    const b = vnoise(s.u * 2.7 * scale, s.v * 3.3 * scale + seed, seed + 7) * 0.16 * k;
    s.nx += a;
    s.ny += b;
  };
}

/** Run several textures in order. */
export function texAll(...t: Array<Texture | null>): Texture | null {
  const list = t.filter((x): x is Texture => x !== null);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return (s) => {
    for (const f of list) {
      f(s);
      if (s.cut) return;
    }
  };
}

/** Distance from (x, y) to the segment a–b and the position along it (0..1). */
export function segDist(x: number, y: number, a: V, b: V): [number, number] {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  let t = ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t), t];
}

/**
 * A carved groove along a polyline (canvas px): px within `w` logical px of the line darken by
 * `depth` and their normal tips across the groove (a tool line in the clay). Only `part` px.
 */
export function groove(p: ClayPainter, pts: readonly V[], w: number, depth: number, part?: number): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  const ww = Math.max(w, 0.55 / p.d);
  p.c.shade(x0 - ww - 0.5, y0 - ww - 0.5, x1 - x0 + 2 * ww + 1, y1 - y0 + 2 * ww + 1, (x, y) => {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(x, y, pts[i], pts[i + 1])[0]);
    if (best >= ww) {
      // The lit lip on the far side of the groove (light from the upper left).
      return best < ww + 0.6 / p.d + 0.15 ? depth * 0.25 : 0;
    }
    return -depth * (1 - (best / ww) * 0.5);
  }, part);
}

// ------------------------------------------------------------------------------------ legs and boots

/** One trouser leg: a round olive sausage hip → knee → ankle, a knee crease, a rolled cuff. */
export function drawLeg(p: ClayPainter, hip: V, knee: V, ankle: V, far: boolean, withPelvis: boolean, z: number): void {
  const c = p.c;
  const h = p.J(hip);
  const k = p.J(knee);
  const a = p.J(ankle);
  const tone = far ? -0.14 : 0;
  const part = c.newPart();
  const mat = p.mat('olive');
  const tex = thumbed(p, far ? 11 : 3);
  // Puffy clay: each segment swells in its middle.
  const mt: V = [h[0] * 0.5 + k[0] * 0.5, h[1] * 0.5 + k[1] * 0.5];
  const ms: V = [k[0] * 0.5 + a[0] * 0.5, k[1] * 0.5 + a[1] * 0.5];
  sausage(p, [h, mt, k, ms, a], [2.7, 2.95, 2.45, 2.55, 2.2], { mat, z, part, tone, tex });
  if (withPelvis) {
    // The seat: a soft ball round the pelvis, one surface with the near leg.
    const pc = p.BL(-0.4, -0.2);
    c.ellipsoid(pc[0], pc[1], 3.6, 2.7, { mat, z: z - 0.5, part, tone, tex });
  }
  // The knee crease: a short groove inside the bend.
  const ta = angleTo(hip, knee);
  const sa = angleTo(knee, ankle);
  let bend = sa - ta;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  if (Math.abs(bend) > 20 && p.hd) {
    const sg = Math.sign(bend);
    const mid = (ta + sa) / 2 + p.rot;
    const inn = dirOf(mid - 90 * sg);
    const along = dirOf(mid);
    const kk: V = [k[0] + inn[0] * 1.2, k[1] + inn[1] * 1.2];
    groove(p, [[kk[0] - along[0] * 0.9, kk[1] - along[1] * 0.9], [kk[0] + along[0] * 0.9, kk[1] + along[1] * 0.9]], 0.22, 0.32, part);
  }
  // The rolled cuff over the boot: a fat ring a little above the ankle.
  const u = [a[0] - k[0], a[1] - k[1]];
  const ul = Math.hypot(u[0], u[1]) || 1;
  const c1: V = [a[0] - (u[0] / ul) * 1.6, a[1] - (u[1] / ul) * 1.6];
  const c2: V = [a[0] - (u[0] / ul) * 0.1, a[1] - (u[1] / ul) * 0.1];
  c.capsule(c1[0], c1[1], c2[0], c2[1], 2.45, 2.45, { mat, z: z + 4, tone: tone + 0.04, round: 0.9 });
}

/** A round bean boot: heel ball, a big round toe, the ankle, a darker sole welt. */
export function drawBoot(p: ClayPainter, ankle: V, foot: number, far: boolean, z: number): void {
  const c = p.c;
  const at = p.J(ankle);
  const deg = p.rot - foot;
  const tone = far ? -0.12 : 0;
  const mat = p.mat('boot');
  const part = c.newPart();
  const P = (x: number, y: number): V => place([[x, y]], at, deg)[0];
  const tex = thumbed(p, far ? 21 : 17, 0.8);
  const e = (x: number, y: number, rx: number, ry: number, dz: number, t = 0): void => {
    const q = P(x, y);
    if (Math.abs(rx - ry) < 1e-6 || Math.abs(((deg % 180) + 180) % 180) < 1e-6) c.ellipsoid(q[0], q[1], rx, ry, { mat, z: z + dz, part, tone: tone + t, tex });
    else c.capsule(...capsuleOf(q, rx, ry, deg), { mat, z: z + dz, part, tone: tone + t, tex });
  };
  e(-0.3, -1.2, 1.95, 1.95, 0); // the ankle
  e(-0.6, 0.35, 2.05, 2.05, 0.4); // the heel
  e(2.35, 0.75, 2.25, 1.7, 0.8, 0.04); // the toe
  // The sole welt: a darker flat band along the bottom.
  const s0 = P(-1.7, 1.85);
  const s1 = P(3.7, 1.95);
  c.capsule(s0[0], s0[1], s1[0], s1[1], 0.6, 0.55, { mat: p.mat('sole'), z: z + 3.5, round: 0.6 });
}

/** An ellipse (rx along `deg`, ry across) as a capsule: centre, radii → capsule args. */
function capsuleOf(q: V, rx: number, ry: number, deg: number): [number, number, number, number, number, number] {
  const r = Math.min(rx, ry);
  const half = Math.max(0, Math.max(rx, ry) - r);
  const a = rx >= ry ? deg : deg + 90;
  const ux = Math.cos(a * DEG) * half;
  const uy = Math.sin(a * DEG) * half;
  return [q[0] - ux, q[1] - uy, q[0] + ux, q[1] + uy, r, r];
}

// ------------------------------------------------------------------------------------ torso

/**
 * The tweed jacket: a pear of warm brown clay worn open over a white shirt, rolled lapels along
 * the opening, a breast-pocket flap, a hem; the belt across the waist with a brass buckle.
 */
export function drawTorso(p: ClayPainter): void {
  const c = p.c;
  const H = p.H;
  const tweed = p.mat('tweed');
  const part = c.newPart();
  const a0 = p.TL(-0.35, -0.4);
  const a1 = p.TL(0.35, H - 3.1);
  // The opening: a V of shirt from the collar, narrowing to the belt (torso coords).
  const edgeL = (b: number): number => 1.3 + (-0.9 - 1.3) * Math.pow(Math.max(0, (b + 0.4) / (H + 2.4)), 1.6);
  const edgeR = (b: number): number => 2.5 + (4.1 - 2.5) * Math.pow(Math.max(0, (b + 0.4) / (H + 2.4)), 1.6);
  const inOpening = (a: number, b: number): boolean => b >= -0.4 && a > edgeL(b) && a < edgeR(b);
  const thumb = thumbed(p, 5, 1, 0.8);
  c.capsule(a0[0], a0[1], a1[0], a1[1], 3.35, 3.85, {
    mat: tweed,
    z: Z.torso,
    part,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      // The hem.
      if (b < -2.4) {
        s.cut = true;
        return;
      }
      if (inOpening(a, b)) {
        s.cut = true;
        return;
      }
      // The hem rolls in a little.
      if (b < -1.9) s.tone -= 0.1;
      if (thumb) thumb(s);
      if (p.fine) {
        // A faint fabric impression: short diagonal tool marks in alternate rows (tweed, sculpted).
        const row = Math.floor((b + 20) / 1.5);
        const ph = (((a + (row & 1) * 0.75 + (row & 1 ? b : -b) * 0.5) / 1.5) % 1 + 1) % 1;
        if (ph < 0.12) s.tone -= 0.07;
        // A thumbprint pressed into the back panel: faint whorl ridges.
        const tx = (a + 2.0) / 1.15;
        const ty = (b - 4.6) / 1.5;
        const r = Math.hypot(tx, ty);
        if (r < 1) {
          const ring = Math.sin((r * 1.5 + Math.atan2(ty, tx) * 0.04) * Math.PI * 2 * 2.2);
          s.tone += ring * 0.07 * (1 - r);
          s.nx += ring * 0.08 * (1 - r);
        }
      }
    },
  });
  // The shirt in the opening (behind the jacket): white cloth.
  const sh0 = p.TL(1.5, -0.6);
  const sh1 = p.TL(1.6, H - 0.4);
  c.capsule(sh0[0], sh0[1], sh1[0], sh1[1], 2.6, 2.4, {
    mat: p.mat('shirt'),
    z: Z.shirt,
    round: 0.7,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      if (!inOpening(a, b) || b > H + 0.9) s.cut = true;
    },
  });
  // Lapels lying along both edges of the V: the near one broad, the far one a sliver.
  {
    const near: V[] = [];
    const back: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const b = H + 0.9 - (i / 6) * (H - 3.2);
      const w = 0.35 + 1.15 * Math.pow(1 - i / 6, 0.7);
      near.push(p.TL(edgeL(b) + 0.1, b));
      back.push(p.TL(edgeL(b) - w, b - (i === 0 ? 0 : 0.35)));
    }
    c.blob([...near, ...back.reverse()], 0.55, { mat: tweed, z: Z.lapel, bulge: 0.25, tone: 0.07, tex: thumbed(p, 9) });
    const far: V[] = [];
    const out: V[] = [];
    for (let i = 0; i <= 5; i++) {
      const b = H + 0.7 - (i / 5) * (H - 3.6);
      far.push(p.TL(edgeR(b) - 0.1, b));
      out.push(p.TL(edgeR(b) + 0.35 + 0.4 * (1 - i / 5), b));
    }
    c.blob([...far, ...out.reverse()], 0.35, { mat: tweed, z: Z.lapel, bulge: 0.15, tone: -0.02 });
  }
  // The shirt collar: two small white points either side of the knot.
  const col = p.mat('shirt');
  c.blob([p.TL(-0.2, H + 1.1), p.TL(1.4, H + 0.5), p.TL(0.9, H - 1.0), p.TL(-0.2, H - 0.2)], 0.45, { mat: col, z: Z.lapel + 2, bulge: 0.2 });
  c.blob([p.TL(1.9, H + 0.5), p.TL(3.5, H + 1.0), p.TL(3.3, H - 0.3), p.TL(2.3, H - 1.0)], 0.45, { mat: col, z: Z.lapel + 2, bulge: 0.2, tone: -0.05 });
  // The tie: a glossy red ribbon — a round knot and a long blade to the belt.
  const tie = p.mat('tie');
  const kn = p.TL(1.75, H - 0.55);
  c.ellipsoid(kn[0], kn[1], 0.95, 0.8, { mat: tie, z: Z.tie + 1 });
  const blade = [p.TL(1.2, H - 1.1), p.TL(2.3, H - 1.1), p.TL(2.75, 1.0), p.TL(1.85, 0.0), p.TL(0.95, 1.0)];
  c.blob(blade, 0.55, { mat: tie, z: Z.tie, bulge: 0.35 });
  // The breast-pocket flap on the near panel.
  c.blob([p.TL(-2.9, 4.1), p.TL(-0.6, 4.1), p.TL(-0.7, 3.0), p.TL(-2.8, 2.9)], 0.45, { mat: tweed, z: Z.lapel - 1, bulge: 0.2, tone: 0.05 });
  // A lower pocket flap.
  c.blob([p.TL(-3.0, 0.9), p.TL(-0.3, 0.9), p.TL(-0.4, -0.1), p.TL(-2.9, -0.2)], 0.4, { mat: tweed, z: Z.lapel - 1, bulge: 0.2, tone: 0.03 });
  // The belt across the waist and its brass buckle.
  const b0 = p.TL(-3.7, -0.75);
  const b1 = p.TL(3.3, -0.75);
  c.capsule(b0[0], b0[1], b1[0], b1[1], 0.75, 0.75, { mat: p.mat('belt'), z: Z.belt, round: 0.8, tex: (s) => {
    const [a] = p.local(s.x, s.y);
    // The belt wraps round the pear: its ends turn away.
    const k = (a + 0.2) / 3.6;
    s.nx += p.F[0] * k * 0.8;
    s.ny += p.F[1] * k * 0.8;
  } });
  const bk = p.TL(1.6, -0.75);
  c.blob(place([[-0.75, -0.85], [0.75, -0.85], [0.75, 0.85], [-0.75, 0.85]], bk, angleOfV(p.F)), 0.35, {
    mat: p.mat('brass'),
    z: Z.belt + 2,
    bulge: 0.15,
    tex: (s) => {
      const [a, b] = p.local(s.x, s.y);
      if (Math.abs(a - 1.6) < 0.32 && Math.abs(b + 0.75) < 0.42) s.tone -= 0.6;
    },
  });
}

function angleOfV(v: V): number {
  return Math.atan2(v[1], v[0]) / DEG;
}

// ------------------------------------------------------------------------------------ arms and hands

/** A tweed sleeve sausage with a round shoulder, an elbow crease, a white shirt cuff. */
export function drawArm(p: ClayPainter, shoulder: V, el: V, wr: V, far: boolean, z: number): void {
  const c = p.c;
  const s = p.J(shoulder);
  const e = p.J(el);
  const w = p.J(wr);
  const tone = far ? -0.16 : 0;
  const mat = p.mat('tweed');
  const part = c.newPart();
  const mu: V = [s[0] * 0.5 + e[0] * 0.5, s[1] * 0.5 + e[1] * 0.5];
  const mf: V = [e[0] * 0.5 + w[0] * 0.5, e[1] * 0.5 + w[1] * 0.5];
  sausage(p, [s, mu, e, mf, w], [2.0, 2.2, 1.85, 1.95, 1.7], { mat, z, part, tone, tex: thumbed(p, far ? 31 : 37) });
  c.ellipsoid(s[0], s[1], 2.15, 2.15, { mat, z: z - 0.3, part, tone });
  const ua = angleTo(shoulder, el);
  const fa = angleTo(el, wr);
  let bend = fa - ua;
  while (bend > 180) bend -= 360;
  while (bend < -180) bend += 360;
  if (Math.abs(bend) > 25 && p.hd) {
    const sg = Math.sign(bend);
    const mid = (ua + fa) / 2 + p.rot;
    const inn = dirOf(mid - 90 * sg);
    const along = dirOf(mid);
    const kk: V = [e[0] + inn[0] * 0.9, e[1] + inn[1] * 0.9];
    groove(p, [[kk[0] - along[0] * 0.8, kk[1] - along[1] * 0.8], [kk[0] + along[0] * 0.8, kk[1] + along[1] * 0.8]], 0.2, 0.3, part);
  }
  // The shirt cuff: a white ring at the wrist.
  const fl = Math.hypot(w[0] - e[0], w[1] - e[1]) || 1;
  const ux = (w[0] - e[0]) / fl;
  const uy = (w[1] - e[1]) / fl;
  const c1: V = [w[0] - ux * 0.7, w[1] - uy * 0.7];
  const c2: V = [w[0] + ux * 0.2, w[1] + uy * 0.2];
  c.capsule(c1[0], c1[1], c2[0], c2[1], 1.6, 1.6, { mat: p.mat('shirt'), z: z + 1.5, tone, round: 0.8 });
}

/**
 * A mitten hand of soft skin clay at the wrist, along the forearm: a ball fist with a thumb nub,
 * a flat paddle (open), a pointing sausage finger (point), a thumb up (thumb).
 */
export function drawHand(p: ClayPainter, el: V, wr: V, shape: HandShape, far: boolean, z: number): void {
  const c = p.c;
  const w = p.J(wr);
  const fore = angleTo(el, wr) + p.rot;
  const dir = dirOf(fore);
  // The hand frame: x along the forearm, y across (the "up" side is the thumb side).
  const up: V = [dir[1], -dir[0]];
  const flip = up[1] > 0.2 ? -1 : 1; // keep the thumb on the upper side
  const U: V = [up[0] * flip, up[1] * flip];
  const at = (x: number, y: number): V => [w[0] + dir[0] * x + U[0] * y, w[1] + dir[1] * x + U[1] * y];
  const tone = far ? -0.14 : 0;
  const mat = p.mat('skin');
  const part = c.newPart();
  const tex = thumbed(p, far ? 41 : 43, 0.7);
  if (shape === 'open') {
    const a = at(0.6, 0);
    const b = at(2.4, -0.2);
    c.capsule(a[0], a[1], b[0], b[1], 1.65, 1.45, { mat, z, part, tone, tex, round: 0.85 });
    const t0 = at(0.9, 1.2);
    const t1 = at(1.9, 2.3);
    c.capsule(t0[0], t0[1], t1[0], t1[1], 0.7, 0.6, { mat, z: z + 0.6, part: c.newPart(), tone: tone + 0.03 });
    return;
  }
  const ball = at(0.9, 0);
  c.ellipsoid(ball[0], ball[1], 1.95, 1.95, { mat, z, part, tone, tex });
  if (shape === 'point') {
    const f0 = at(1.6, 0.3);
    const f1 = at(3.9, 0.3);
    c.capsule(f0[0], f0[1], f1[0], f1[1], 0.72, 0.62, { mat, z: z + 0.8, part: c.newPart(), tone: tone + 0.03 });
    return;
  }
  if (shape === 'thumb') {
    // Thumbs up: the thumb points up the screen.
    const upS = p.R([0, -1]);
    const t0: V = [ball[0] + upS[0] * 1.2 - dir[0] * 0.2, ball[1] + upS[1] * 1.2 - dir[1] * 0.2];
    const t1: V = [ball[0] + upS[0] * 3.3, ball[1] + upS[1] * 3.3];
    c.capsule(t0[0], t0[1], t1[0], t1[1], 0.85, 0.72, { mat, z: z + 0.8, part: c.newPart(), tone: tone + 0.04 });
    return;
  }
  // Fist / grip: a thumb nub over the top.
  const n = at(1.2, 1.35);
  c.ellipsoid(n[0], n[1], 0.85, 0.8, { mat, z: z + 0.9, part: c.newPart(), tone: tone + 0.05 });
}

// ------------------------------------------------------------------------------------ gear

/**
 * A clay toy gun on its grip, turned to the placement's angle. Local frame: the 1× gun art's grip
 * px centre at the origin, x along the barrel, y down (so the muzzle is where the game's is).
 */
export function drawGun(p: ClayPainter, g: GunPlacement, z: number): void {
  const c = p.c;
  const at = p.J(g.grip);
  const ang = g.angle + p.rot;
  const P = (x: number, y: number): V => place([[x, y]], at, ang)[0];
  const steel = p.mat('steel');
  const dark = p.mat('gunDark');
  if (g.kind === 'pistol') {
    // The slide: a fat round bar; the grip: a slanted round block; the muzzle hole.
    const part = c.newPart();
    const s0 = P(-0.4, -2.45);
    const s1 = P(5.95, -2.45);
    c.capsule(s0[0], s0[1], s1[0], s1[1], 1.08, 1.08, { mat: steel, z: z + 1, part, round: 0.9 });
    const g0 = P(0.55, -1.7);
    const g1 = P(-0.05, 0.95);
    c.capsule(g0[0], g0[1], g1[0], g1[1], 1.0, 0.95, { mat: dark, z, round: 0.9 });
    // The trigger guard.
    const tg = P(1.9, -0.75);
    c.ellipsoid(tg[0], tg[1], 0.75, 0.6, { mat: dark, z: z - 0.5, tex: (s) => {
      if (Math.hypot(s.u, s.v) < 0.45) s.cut = true;
    } });
    if (p.hd) {
      const m = P(6.6, -2.45);
      p.disc(m[0], m[1], 0.42, p.col('gunDark', 0, 0), z + 3);
      // A sight bump on top.
      const sb = P(5.2, -3.45);
      c.ellipsoid(sb[0], sb[1], 0.4, 0.4, { mat: steel, z: z + 0.5 });
    }
    return;
  }
  if (g.kind === 'heavy') {
    // The stock, the receiver block, the carry handle, the olive drum, the shroud and the grips.
    const part = c.newPart();
    const st0 = P(-5.0, -2.2);
    const st1 = P(-2.4, -2.5);
    c.capsule(st0[0], st0[1], st1[0], st1[1], 1.75, 1.55, { mat: dark, z: z - 0.3, round: 0.85 });
    const r0 = P(-1.4, -2.6);
    const r1 = P(4.0, -2.6);
    c.capsule(r0[0], r0[1], r1[0], r1[1], 1.95, 1.95, { mat: steel, z: z + 0.6, part, round: 0.85 });
    const sh0 = P(4.4, -2.1);
    const sh1 = P(13.0, -2.1);
    c.capsule(sh0[0], sh0[1], sh1[0], sh1[1], 1.3, 1.3, {
      mat: steel,
      z: z + 0.2,
      round: 0.9,
      tex: p.hd
        ? (s) => {
            // Vent dimples along the shroud.
            const t = s.u * 8.6;
            const k = t - Math.round(t / 1.9) * 1.9;
            if (s.u > 0.12 && s.u < 0.9 && Math.hypot(k, s.v * 1.3) < 0.55) {
              s.tone -= 0.45;
              s.nz *= 0.6;
            }
          }
        : null,
    });
    const mz = P(13.4, -2.1);
    c.ellipsoid(mz[0], mz[1], 0.75, 1.35, { mat: dark, z: z + 1.5 });
    const h0 = P(-0.2, -4.9);
    const h1 = P(3.2, -4.9);
    c.capsule(h0[0], h0[1], h1[0], h1[1], 0.6, 0.6, { mat: dark, z: z + 0.2 });
    const dr = P(3.0, 0.9);
    c.ellipsoid(dr[0], dr[1], 1.85, 1.85, { mat: p.mat('drum'), z: z + 1.0 });
    const g0 = P(0.5, -1.0);
    const g1 = P(0.1, 1.2);
    c.capsule(g0[0], g0[1], g1[0], g1[1], 0.95, 0.9, { mat: dark, z: z + 0.4 });
    const f0 = P(7.5, -1.0);
    const f1 = P(7.4, 1.0);
    c.capsule(f0[0], f0[1], f1[0], f1[1], 0.85, 0.8, { mat: dark, z: z + 0.4 });
    if (p.hd) {
      const m = P(13.7, -2.1);
      p.disc(m[0], m[1], 0.5, p.col('gunDark', 0, 0), z + 4);
    }
    return;
  }
  // The rifle (not a hero gun): a long round bar.
  const r0 = P(-8, -1.5);
  const r1 = P(10.5, -1.8);
  c.capsule(r0[0], r0[1], r1[0], r1[1], 1.2, 0.8, { mat: steel, z });
}

/**
 * The held item. Returns the `hand` point on the working canvas (index px, as the rig's: a
 * prop's tip, the centre of a grenade / snack / gift, a knife's point), or null.
 */
export function drawHeld(p: ClayPainter, el: V, wr: V, item: Pose['held'], zKnife: number, zHeld: number): V | null {
  if (!item || item === 'none') return null;
  const c = p.c;
  const fore = angleTo(el, wr);
  const w0 = p.T0(wr);
  const w = p.Tc(wr);
  if (item === 'grenade' || item === 'snack' || item === 'gift') {
    const dir = dirOf(fore + p.rot);
    const cx = w0[0] + dir[0] * 2;
    const cy = w0[1] + dir[1] * 2 - 1;
    const C: V = [p.q(cx - p.org[0] + 0.5), p.q(cy - p.org[1] + 0.5)];
    if (item === 'grenade') {
      c.ellipsoid(C[0], C[1], 1.55, 1.75, { mat: p.mat('grenade'), z: zHeld });
      c.capsule(C[0] - 0.2, C[1] - 1.9, C[0] + 0.9, C[1] - 1.2, 0.45, 0.35, { mat: p.mat('steel'), z: zHeld + 1 });
      if (p.hd) groove(p, [[C[0] - 1.4, C[1] + 0.1], [C[0] + 1.4, C[1] + 0.1]], 0.16, 0.3);
    } else if (item === 'snack') {
      c.capsule(C[0] - 2.2, C[1], C[0] + 2.2, C[1], 1.2, 1.2, { mat: p.mat('paper'), z: zHeld });
    } else {
      c.ellipsoid(C[0], C[1], 2, 2, { mat: p.mat('tie'), z: zHeld });
    }
    return [cx, cy];
  }
  const ang = (p.pose.heldAngle ?? fore - 90) + p.rot;
  const dir: V = [Math.cos(ang * DEG), Math.sin(ang * DEG)];
  const W: V = [p.q(w[0]), p.q(w[1])];
  if (isProp(item)) {
    // The rolled battle plan (Vincent's), and a plain clay roll for any other prop.
    const a: V = [W[0] - dir[0] * 2.2, W[1] - dir[1] * 2.2];
    const b: V = [W[0] + dir[0] * 7.0, W[1] + dir[1] * 7.0];
    const plan = item === 'plan';
    c.capsule(a[0], a[1], b[0], b[1], 1.45, 1.45, {
      mat: p.mat(plan ? 'paper' : 'steel'),
      z: zKnife,
      round: 0.95,
      tex: plan && p.hd
        ? (s) => {
            // The blue line spiralling round the roll.
            const t = s.u * 9.2 + s.v * 1.1;
            if (Math.abs(t - Math.round(t / 2.6) * 2.6) < 0.22 && s.u > 0.18 && s.u < 0.92) {
              s.mat = p.mat('paperLine');
            }
          }
        : null,
    });
    if (plan) {
      // The end-on spiral at the tip.
      const e: V = [W[0] + dir[0] * 7.0, W[1] + dir[1] * 7.0];
      c.ellipsoid(e[0], e[1], 1.3, 1.3, { mat: p.mat('paper'), z: zKnife + 1.6, tone: 0.1, round: 0.5, tex: p.hd ? (s) => {
        const r = Math.hypot(s.u, s.v);
        const th = Math.atan2(s.v, s.u);
        const ph = r * 3.2 - th / (2 * Math.PI);
        if (Math.abs(ph - Math.round(ph)) < 0.16) s.tone -= 0.45;
      } : null });
    }
    // The hand point: the tip (a little past the roll's end).
    const tip: V = [w0[0] + dir[0] * 7.5, w0[1] + dir[1] * 7.5];
    return tip;
  }
  // A knife: a short round steel blade.
  const k0: V = [W[0] + dir[0] * 1.2, W[1] + dir[1] * 1.2];
  const k1: V = [W[0] + dir[0] * 6.5, W[1] + dir[1] * 6.5];
  c.capsule(k0[0], k0[1], k1[0], k1[1], 0.8, 0.3, { mat: p.mat('steel'), z: zKnife });
  return [w0[0] + dir[0] * 7, w0[1] + dir[1] * 7];
}
