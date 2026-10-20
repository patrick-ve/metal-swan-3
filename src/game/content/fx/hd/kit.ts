/**
 * The UHD fx kit (docs/ART_GUIDE.md "UHD art"): shared helpers of the HD fx, shots and items.
 *
 * Every HD id is drawn natively on an `HdCanvas` of its 1× frame's LOGICAL size at density d
 * (2 or 4), with the 1× frame's anchor and points (`hdStrip`), in PAL_HD only. Emissive things
 * (fire, flashes, tracers, sparks, laser light) use FLAT materials whose tone a texture sets from a
 * heat value (`fireMat`, `glowMat`, the `Glow` shapes of shapes.ts), so a flash is a smooth hot
 * shape with 6–7 hard tones; billowing volumes are cauliflower lumps (`billow`, and
 * `paintBillows` straight into the G-buffer for big explosions); gas (smoke, dust,
 * steam) is a lit volume that frays at the rim through an ordered pattern on 2 × 2 art-px cells
 * (`frayCut`: soft at 4×, whole logical px at 2×, never a single-art-px checker); solid props
 * (rockets, grenades, pickups, crates) use the kit's lit primitives and outline A.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import { HdCanvas, KEY, type TexSample } from '../../../art/hd/index';

export { HdCanvas };

/** Fire ramp of the flat fire material: crimson → white-hot (index 0 is the crevice tone). */
export const FIRE: Ramp = PAL_HD.fire.slice(1);
/** The deepest ember: rims of hot shapes. */
export const EMBER: Color = PAL_HD.fire[0];
export const INK: Color = PAL_HD.ink[0];

/** An HD frame with exactly the 1× frame's geometry (anchor and points in logical px). */
export function hdFrame(buf: PixelBuffer, f1: Frame, d: number): Frame {
  return f1.pts ? { buf, ox: f1.ox, oy: f1.oy, pts: f1.pts, density: d } : { buf, ox: f1.ox, oy: f1.oy, density: d };
}

/**
 * One HD frame per 1× frame of `id`: `draw` paints frame i on a canvas of the 1× frame's logical
 * size at density d (logical px; pixel (x, y) of the 1× frame covers [x, x + 1) × [y, y + 1)).
 */
export function hdStrip(id: string, d: number, draw: (c: HdCanvas, i: number, f1: Frame) => PixelBuffer): Frame[] {
  return getFrames(id, 1).map((f1, i) => hdFrame(draw(new HdCanvas(f1.buf.w, f1.buf.h, d), i, f1), f1, d));
}

// ------------------------------------------------------------------------------------ materials

/** Flat fire: the tone (0..1) picks crimson … white-hot; index 0 (deep crimson) stays for crevices. */
export function fireMat(c: HdCanvas, ramp: Ramp = FIRE): number {
  return c.material({ ramp, flat: true, lo: 1, hi: ramp.length - 1 });
}

/** A flat emissive material over any ramp (laser light, glows): tone 0..1 → lo..hi. */
export function glowMat(c: HdCanvas, ramp: Ramp, lo = 1, hi = ramp.length - 1): number {
  return c.material({ ramp, flat: true, lo, hi });
}

/** Lit smoke / dust / steam: a soft matte volume (no specular, a little wrap). */
export function gasMat(c: HdCanvas, ramp: Ramp, lo = 1, hi = ramp.length - 2): number {
  return c.material({ ramp, lo, hi, wrap: 0.18, bounce: 0.3, rim: 0.15, amb: 0.08 });
}

/** Polished metal (steel, brass): strong specular. */
export function metalMat(c: HdCanvas, ramp: Ramp = PAL_HD.steel, spec = 1, lo?: number, hi?: number): number {
  return c.material({ ramp, spec, shine: 30, rim: 0.4, gain: 1.1, bounce: 0.3, lo, hi });
}

/** Painted or lacquered surfaces: a satin sheen. */
export function paintMat(c: HdCanvas, ramp: Ramp, spec = 0.45, lo?: number, hi?: number): number {
  return c.material({ ramp, spec, shine: 18, gain: 1.05, wrap: 0.05, lo, hi });
}

// ------------------------------------------------------------------------------------ fields

/** Key light term of a unit normal (0 = facing away … 1 = facing the light). */
export function lambert(nx: number, ny: number, nz: number): number {
  const l = nx * KEY[0] + ny * KEY[1] + nz * KEY[2];
  return l < 0 ? 0 : l;
}

/** Ordered 4 × 4 threshold of the 2 × 2 art-px cell holding art px (X, Y): 0..1. */
export function cellBayer(X: number, Y: number): number {
  const x = (X >> 1) & 3;
  const y = (Y >> 1) & 3;
  return (BAYER[(y << 2) | x] + 0.5) / 16;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Deterministic hash of an integer cell → [0, 1). */
export function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The fraying rim of a gas puff: true (cut this px) where the rim `1 − q` (q = 0 at the centre,
 * 1 at the edge) is thinner than `fade`, broken up by the 2 × 2-cell ordered pattern.
 */
export function frayCut(q: number, fade: number, X: number, Y: number, soft = 0.45): boolean {
  return fade > 0 && 1 - q < fade * 1.25 - cellBayer(X, Y) * soft;
}

/** Smooth value noise in [0, 1) on a lattice of `cell` logical px (bilinear, smoothstep). */
export function noise(x: number, y: number, cell: number, seed = 0): number {
  const fx = x / cell;
  const fy = y / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  let tx = fx - ix;
  let ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const e = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty;
}

/** Two octaves of `noise` (cell and cell / 2), centred on 0: about −0.5 … 0.5. */
export function turb(x: number, y: number, cell: number, seed = 0): number {
  return noise(x, y, cell, seed) * 0.65 + noise(x, y, cell / 2, seed + 7) * 0.35 - 0.5;
}

/**
 * A cauliflower billow (smoke, fire, foam): a core ball and a ring of smaller lumps of one part,
 * so the surface is the union of convex lumps (each lit as a sphere, creases where they meet) and
 * the silhouette bulges. `tex(s, q)` gets q = distance from the billow centre / r (0..~1).
 * The lumps depend only on the seed and the logical size: the same at 2× and 4×.
 */
export function billow(
  c: HdCanvas,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  o: { mat: number; part?: number; z?: number; tone?: number; lumps?: number; tex?: (s: TexSample, q: number) => void },
): void {
  const part = o.part ?? c.newPart();
  const z = o.z ?? 0;
  const tex = o.tex;
  const t = tex
    ? (s: TexSample): void => {
        tex(s, Math.hypot(s.x - cx, s.y - cy) / r);
      }
    : null;
  const opts = { mat: o.mat, part, z, tone: o.tone ?? 0, tex: t };
  c.ellipsoid(cx, cy, r * 0.74, r * 0.74, opts);
  const m = o.lumps ?? Math.max(3, Math.min(8, Math.round(r / 1.6)));
  const turn = hash(seed, 1, 77) * Math.PI * 2;
  for (let j = 0; j < m; j++) {
    const a = turn + (j / m) * Math.PI * 2 + (hash(seed, j, 3) - 0.5) * 0.8;
    const dist = r * (0.4 + hash(seed, j, 5) * 0.14);
    const rr = r * (0.44 + hash(seed, j, 9) * 0.14);
    c.ellipsoid(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist * 0.92, rr, rr, opts);
  }
}

/**
 * `turb` sampled once per logical px corner over a w × h canvas (plus a border), read back with
 * bilinear filtering: the same soft turbulence for a fraction of the cost per art px.
 */
export class NoiseGrid {
  private readonly gw: number;
  private readonly gh: number;
  private readonly g: Float32Array;

  constructor(w: number, h: number, cell: number, seed: number) {
    this.gw = Math.ceil(w) + 4;
    this.gh = Math.ceil(h) + 4;
    this.g = new Float32Array(this.gw * this.gh);
    for (let y = 0; y < this.gh; y++) for (let x = 0; x < this.gw; x++) this.g[y * this.gw + x] = turb(x - 2, y - 2, cell, seed);
  }

  /** Turbulence at logical (x, y) (clamped to the grid). */
  at(x: number, y: number): number {
    let fx = x + 2;
    let fy = y + 2;
    fx = fx < 0 ? 0 : fx > this.gw - 1.001 ? this.gw - 1.001 : fx;
    fy = fy < 0 ? 0 : fy > this.gh - 1.001 ? this.gh - 1.001 : fy;
    const ix = fx | 0;
    const iy = fy | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const i = iy * this.gw + ix;
    const g = this.g;
    return (g[i] * (1 - tx) + g[i + 1] * tx) * (1 - ty) + (g[i + this.gw] * (1 - tx) + g[i + this.gw + 1] * tx) * ty;
  }
}

/** A billow of `paintBillows`. */
export interface Billow {
  x: number;
  y: number;
  r: number;
  seed: number;
  /** Base depth (larger = nearer) and part id. */
  z: number;
  part: number;
}

/** The lumps of a billow (as `billow`): [x, y, r] triples. */
function lumpsOf(b: Billow): number[] {
  const out = [b.x, b.y, b.r * 0.74];
  const m = Math.max(3, Math.min(8, Math.round(b.r / 1.6)));
  const turn = hash(b.seed, 1, 77) * Math.PI * 2;
  for (let j = 0; j < m; j++) {
    const a = turn + (j / m) * Math.PI * 2 + (hash(b.seed, j, 3) - 0.5) * 0.8;
    const dist = b.r * (0.4 + hash(b.seed, j, 5) * 0.14);
    out.push(b.x + Math.cos(a) * dist, b.y + Math.sin(a) * dist * 0.92, b.r * (0.44 + hash(b.seed, j, 9) * 0.14));
  }
  return out;
}

/**
 * Many cauliflower billows straight into the canvas G-buffer (the fast path of `billow` for big
 * explosions): pass 1 finds the nearest lump per art px (depth test against what is already
 * drawn; px frayed away by `fade` are skipped, so the billow behind shows through), pass 2 calls
 * `shade(s, k, q)` once per visible px to set its material, tone or fixed colour (s.mat must be
 * set; q = distance from billow k's centre / its r; it may also change the normal s.nx/ny/nz). `erode(q, x, y)` (optional) replaces the
 * ordered `frayCut` while `fade` > 0: true cuts the px at logical (x, y) — an outlined volume
 * (outline A) needs an erosion without small holes, or the outline fills every hole with ink.
 */
export function paintBillows(
  c: HdCanvas,
  billows: readonly Billow[],
  fade: number,
  shade: (s: TexSample, k: number, q: number) => void,
  erode?: (q: number, x: number, y: number) => boolean,
): void {
  const { W, H, d } = c;
  const owner = new Int16Array(W * H).fill(-1);
  const qs = new Float32Array(W * H);
  billows.forEach((b, k) => {
    const L = lumpsOf(b);
    const X0 = Math.max(0, Math.floor((b.x - b.r * 1.15) * d));
    const X1 = Math.min(W, Math.ceil((b.x + b.r * 1.15) * d));
    const Y0 = Math.max(0, Math.floor((b.y - b.r * 1.15) * d));
    const Y1 = Math.min(H, Math.ceil((b.y + b.r * 1.15) * d));
    for (let Y = Y0; Y < Y1; Y++) {
      const y = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const x = (X + 0.5) / d;
        const q = Math.hypot(x - b.x, y - b.y) / b.r;
        if (fade > 0 && (erode ? erode(q, x, y) : frayCut(q < 1 ? q : 1, fade, X, Y))) continue;
        let bh = -1;
        let bj = 0;
        for (let j = 0; j < L.length; j += 3) {
          const dx = x - L[j];
          const dy = y - L[j + 1];
          const rr = L[j + 2];
          const dd = rr * rr - dx * dx - dy * dy;
          if (dd > 0) {
            const h = Math.sqrt(dd);
            if (h > bh) {
              bh = h;
              bj = j;
            }
          }
        }
        if (bh < 0) continue;
        const depth = b.z + bh;
        const i = Y * W + X;
        if (c.mat[i] !== 0 && c.zb[i] > depth) continue;
        const rr = L[bj + 2];
        c.mat[i] = 1;
        c.part[i] = b.part;
        c.zb[i] = depth;
        c.pz[i] = b.z;
        c.nx[i] = (x - L[bj]) / rr;
        c.ny[i] = (y - L[bj + 1]) / rr;
        c.nz[i] = bh / rr;
        c.fix[i] = 0;
        owner[i] = k;
        qs[i] = q;
      }
    }
  });
  const s: TexSample = { x: 0, y: 0, X: 0, Y: 0, d, u: 0, v: 0, nx: 0, ny: 0, nz: 1, tone: 0, mat: 0, fix: 0, dz: 0, cut: false };
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      const k = owner[i];
      if (k < 0) continue;
      s.x = (X + 0.5) / d;
      s.y = (Y + 0.5) / d;
      s.X = X;
      s.Y = Y;
      s.nx = c.nx[i];
      s.ny = c.ny[i];
      s.nz = c.nz[i];
      s.tone = 0;
      s.mat = 0;
      s.fix = 0;
      shade(s, k, qs[i]);
      c.mat[i] = s.mat;
      c.tone[i] = s.tone;
      c.fix[i] = s.fix;
      // `shade` may soften the normal (e.g. smoke blends the lump normal with its billow's).
      c.nx[i] = s.nx;
      c.ny[i] = s.ny;
      c.nz[i] = s.nz;
    }
  }
}

/** Clamp to 0..1. */
export function sat(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
