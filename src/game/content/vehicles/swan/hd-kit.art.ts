/**
 * SWAN-3 UHD art, part 1: the toolkit of the HD Swan drawers (docs/ART_GUIDE.md "UHD art").
 *
 * One density-generic drawer per id makes the 2× and the 4× art: every frame is drawn natively
 * on an `HdCanvas` (lit primitives, PAL_HD ramps, outline A) in the 1× frame's logical
 * rectangle, from the SAME geometry as the 1× rig (`wingParts`, `legParts`, `tailParts`,
 * `hullPoly`, `neckParts`, `headFrame` — the transform, the IK and every named point are the 1×
 * numbers), so size, anchor and points stay the 1× ones (geometry is law).
 *
 * - `SwanCanvas`: the canvas of one frame. Body space (x forward, y down, the 1× rig's pixel-
 *   centre coordinates) maps to canvas logical space by `T` (+ the 1× anchor + ½ px). Parts carry
 *   an owner (`OWN`), for the front overlays and the dry wing plates under water.
 * - Materials (`mat(kind, far)`): white enamel (`snow`), navy trim, gold, steel, the chrome piston
 *   rod, orange, black enamel (the Mute), the dark neck hose. The far side is one band darker.
 * - `fit` trims what reaches past the room inside the outline (the rig's `fitFrame` rule), `water`
 *   repaints the parts under the surface line in the water ramps with a navy outline (look.md
 *   §5.8), `cutFront` cuts the `-front` overlay out of a finished body frame.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { PAL_HD } from '../../../../engine/palette-hd';
import { BLACK_ONE_HUE, HdCanvas, type DrawOpts, type HdMaterial, type RenderOpts, type TexSample } from '../../../art/hd/index';
import type { Pt, V, Xf } from './kit.art';
import { OWN } from './kit.art';

/** UHD density. */
export type D = 2 | 4;

/** Material kinds of the Swan. */
export type Kind = 'enamel' | 'navy' | 'gold' | 'steel' | 'rod' | 'orange' | 'black' | 'hose' | 'grip';

/** Base depth of each layer (look.md §7 draw order); parts inside a layer step by 1–8. */
export const Z = {
  farWing: 0,
  backWing: 100,
  farLeg: 200,
  tail: 300,
  hull: 400,
  pad: 450,
  handle: 470,
  nearLeg: 500,
  nearWing: 600,
  neck: 700,
  collar: 760,
  head: 800,
} as const;

/** Light of each material kind (near side; `far` takes one band off the top). */
const KINDS: Readonly<Record<Kind, HdMaterial>> = {
  // White enamel: the face-on flank on the light tones, a glossy white glint, cool blue shade.
  enamel: { ramp: PAL_HD.snow, lo: 2, hi: 6, spec: 0.5, shine: 34, wrap: 0.04, rim: 0.12, amb: 0.12, gain: 1.3 },
  navy: { ramp: PAL_HD.navy, lo: 1, hi: 4, spec: 0.5, shine: 26, wrap: 0.05, rim: 0.2 },
  gold: { ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 22, wrap: 0.05 },
  steel: { ramp: PAL_HD.steel, lo: 1, hi: 5, spec: 0.9, shine: 26, wrap: 0.04, rim: 0.25 },
  rod: { ramp: PAL_HD.steel, lo: 3, hi: 6, spec: 1, shine: 18, wrap: 0.1 },
  orange: { ramp: PAL_HD.orange, lo: 1, hi: 5, spec: 0.45, shine: 24, wrap: 0.05, rim: 0.15, amb: 0.12, gain: 1.2 },
  black: { ramp: BLACK_ONE_HUE, lo: 1, hi: 5, spec: 0.9, shine: 30, wrap: 0.04, rim: 0.25 },
  hose: { ramp: PAL_HD.steel, lo: 1, hi: 3, spec: 0.5, shine: 20 },
  grip: { ramp: BLACK_ONE_HUE, lo: 1, hi: 4, spec: 0.35, shine: 16, wrap: 0.1 },
};

/** Water ramps (look.md §5.8): the ramp and the index span a material's tones map onto. */
const WATER_OF: ReadonlyArray<readonly [Ramp, Ramp, number, number]> = [
  [PAL_HD.snow, PAL_HD.sky, 1, 5],
  [PAL_HD.steel, PAL_HD.navy, 0, 4],
  [PAL_HD.orange, PAL_HD.teal, 1, 4],
  [PAL_HD.gold, PAL_HD.teal, 1, 5],
  [PAL_HD.navy, PAL_HD.navy, 0, 3],
  [PAL_HD.black, PAL_HD.navy, 0, 2],
  [PAL_HD.ink, PAL_HD.navy, 1, 1],
];

/** Every Swan colour → its colour under the water line. */
const WATER = ((): Map<Color, Color> => {
  const m = new Map<Color, Color>();
  for (const [from, to, lo, hi] of WATER_OF) {
    from.forEach((c, i) => {
      if (m.has(c >>> 0)) return;
      const t = from.length > 1 ? i / (from.length - 1) : 0;
      m.set(c >>> 0, to[Math.round(lo + (hi - lo) * t)] >>> 0);
    });
  }
  return m;
})();

/** Outline colour under the water line (the 1× `navy[0]`). */
export const WATER_LINE_HD: Color = PAL_HD.navy[1];

/** One art px of the canvas for a texture: body-space position. */
export interface BodySample {
  x: number;
  y: number;
}

/** The HD canvas of one Swan frame. */
export class SwanCanvas {
  readonly c: HdCanvas;
  readonly d: D;
  /** Canvas logical position of body (0, 0) (the 1× anchor + ½ px: body coordinates are pixel centres). */
  readonly ox: number;
  readonly oy: number;
  /** Owner of each part id. */
  private owners: number[] = [0];
  private mats = new Map<string, number>();

  constructor(w: number, h: number, d: D, ox: number, oy: number) {
    this.c = new HdCanvas(w, h, d);
    this.d = d;
    this.ox = ox + 0.5;
    this.oy = oy + 0.5;
  }

  /** Body point → canvas logical point. */
  T(p: Pt): [number, number] {
    return [p[0] + this.ox, p[1] + this.oy];
  }

  /** A texture's sample → body space. */
  body(s: { x: number; y: number }, out: V): V {
    out[0] = s.x - this.ox;
    out[1] = s.y - this.oy;
    return out;
  }

  /** A material of a kind (far: one band darker, a little less shine). */
  mat(kind: Kind, far = false): number {
    const key = `${kind}:${far ? 1 : 0}`;
    let id = this.mats.get(key);
    if (id === undefined) {
      const m = KINDS[kind];
      const hi = m.hi ?? m.ramp.length - 2;
      id = this.c.material(far ? { ...m, hi: Math.max((m.lo ?? 1) + 1, hi - 1), spec: (m.spec ?? 0) * 0.6 } : m);
      this.mats.set(key, id);
    }
    return id;
  }

  /** A new part owned by `owner`. */
  part(owner: number): number {
    const p = this.c.newPart();
    this.owners[p] = owner;
    return p;
  }

  ownerOf(part: number): number {
    return this.owners[part] ?? 0;
  }

  /** Tapered capsule between body points (radii in logical px). */
  capsule(a: Pt, b: Pt, r0: number, r1: number, o: DrawOpts): void {
    const A = this.T(a);
    const B = this.T(b);
    this.c.capsule(A[0], A[1], B[0], B[1], r0, r1, o);
  }

  ellipsoid(p: Pt, rx: number, ry: number, o: DrawOpts): void {
    const P = this.T(p);
    this.c.ellipsoid(P[0], P[1], rx, ry, o);
  }

  /**
   * A soft volume over a body-space polygon grown by `grow` (a 1× polygon through pixel centres
   * covers half a px more on every side): flat middle, the edge rolling away over `r`.
   */
  blob(pts: readonly Pt[], grow: number, r: number, o: DrawOpts & { bulge?: number }): void {
    this.c.blob(growPoly(pts, grow).map((p) => this.T(p)), r, o);
  }

  /**
   * A plane over the canvas box of the body points `box` (+ `pad`): `tex` gets the sample and
   * sets its normal, tone and material, or cuts it.
   */
  area(box: readonly Pt[], pad: number, o: DrawOpts): void {
    const [x0, y0, x1, y1] = bounds(box.map((p) => this.T(p)), pad);
    this.c.plane(x0, y0, x1 - x0, y1 - y0, o);
  }

  /** A height field over the canvas box of `box` (+ `pad`), `hf` in BODY coordinates. */
  field(box: readonly Pt[], pad: number, hf: (x: number, y: number) => number, o: DrawOpts): void {
    const [x0, y0, x1, y1] = bounds(box.map((p) => this.T(p)), pad);
    const ox = this.ox;
    const oy = this.oy;
    this.c.heightField(x0, y0, x1 - x0, y1 - y0, (x, y) => hf(x - ox, y - oy), o);
  }

  /** Add a tone to every drawn px of the given owners where `fn(body x, body y)` says so (cast shadows). */
  toneWhere(owners: readonly number[], fn: (x: number, y: number) => number): void {
    const { c } = this;
    const { W, H, d } = c;
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (c.mat[i] === 0 || c.fix[i] !== 0 || !owners.includes(this.owners[c.part[i]] ?? 0)) continue;
        const t = fn((X + 0.5) / d - this.ox, (Y + 0.5) / d - this.oy);
        if (t !== 0) c.tone[i] += t;
      }
    }
  }

  /**
   * A cast shadow straight down: px of `to` with a nearer px of `from` within `dist` logical px
   * above them get `tone` (the near wing on the hull).
   */
  castDown(from: number, to: number, dist: number, tone: number): void {
    const { c } = this;
    const { W, H, d } = c;
    const n = Math.round(dist * d);
    for (let Y = n; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (c.mat[i] === 0 || c.fix[i] !== 0 || (this.owners[c.part[i]] ?? 0) !== to) continue;
        for (let k = 1; k <= n; k++) {
          const j = i - k * W;
          if (c.mat[j] !== 0 && (this.owners[c.part[j]] ?? 0) === from) {
            c.tone[i] += tone;
            break;
          }
        }
      }
    }
  }

  /**
   * Geometry is law: drop what reaches past the room inside the outline (the frame less one
   * logical px on every side), so the outline wraps a clean edge there. Returns the px dropped.
   */
  fit(): number {
    const { c } = this;
    const { W, H, d } = c;
    let n = 0;
    for (let Y = 0; Y < H; Y++) {
      const inY = Y >= d && Y < H - d;
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (c.mat[i] === 0 || (inY && X >= d && X < W - d)) continue;
        c.mat[i] = 0;
        c.fix[i] = 0;
        n++;
      }
    }
    HD_SWAN_FIT.px += n;
    if (n > 0) HD_SWAN_FIT.frames++;
    return n;
  }

  /** Light, quantise and outline (outline A, the cast's thin cool rim). */
  render(o: RenderOpts = {}): PixelBuffer {
    this.fit();
    return this.c.render({ outline: 'A', ao: 0.3, rimLight: 2, ...o });
  }

  /**
   * Repaint everything at or under the surface line (body y) in the water ramps, the outline
   * there in navy (look.md §5.8). The wing plates slap the surface from above and stay dry.
   */
  water(out: PixelBuffer, surface: number): void {
    const { c } = this;
    const { W, H, d } = c;
    const y0 = Math.max(0, Math.ceil((surface - 0.5 + this.oy) * d - 0.5));
    if (y0 >= H) return;
    const dry = (i: number): boolean => {
      const o = this.owners[c.part[i]] ?? 0;
      return o === OWN.nearWing || o === OWN.farWing;
    };
    const px = out.data;
    for (let Y = y0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if ((px[i] & 255) === 0) continue;
        if (c.mat[i] !== 0) {
          if (!dry(i)) px[i] = WATER.get(px[i] >>> 0) ?? px[i];
          continue;
        }
        // An outline px: navy unless a dry or above-water part is within the outline's width.
        let above = false;
        for (let dy = -d; dy <= d && !above; dy++) {
          const yy = Y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -d; dx <= d; dx++) {
            const xx = X + dx;
            if (xx < 0 || xx >= W) continue;
            const j = yy * W + xx;
            if (c.mat[j] !== 0 && (yy < y0 || dry(j))) {
              above = true;
              break;
            }
          }
        }
        if (!above) px[i] = WATER_LINE_HD;
      }
    }
    out.touch();
  }

  /**
   * The `-front` overlay of a finished body frame (look.md §7): the near wing (front-layer
   * poses) and, except in low frames, the hull, pad and handle px of the flank band the rider's
   * hips could reach (rest x −15.5…11.5, y −49.5…−36.5; tested per logical px with the 1× rule and
   * anchor), with the outline px next to them. `rect` = the 1× front frame's box in the body
   * frame (logical). Returns the cropped buffer and the kept px that fell outside it.
   */
  cutFront(out: PixelBuffer, xf: Xf, wingFront: boolean, low: boolean, lo: { ox: number; oy: number }, rect: readonly [number, number, number, number]): { buf: PixelBuffer; cut: number } {
    const { c, d } = this;
    const { W, H } = c;
    const keep = new Uint8Array(W * H);
    const band = new Int8Array(Math.ceil(W / d) * Math.ceil(H / d)).fill(-1);
    const bw = Math.ceil(W / d);
    const inBand = (X: number, Y: number): boolean => {
      const col = Math.floor(X / d);
      const row = Math.floor(Y / d);
      const k = row * bw + col;
      if (band[k] < 0) {
        const r = xf.inv(col - lo.ox, row - lo.oy);
        band[k] = r[0] >= -15.5 && r[0] <= 11.5 && r[1] >= -49.5 && r[1] <= -36.5 ? 1 : 0;
      }
      return band[k] === 1;
    };
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (c.mat[i] === 0 || (out.data[i] & 255) === 0) continue;
        const o = this.owners[c.part[i]] ?? 0;
        if (o === OWN.nearWing) {
          if (wingFront) keep[i] = 1;
          continue;
        }
        if (low) continue;
        if ((o === OWN.hull || o === OWN.pad || o === OWN.handle) && inBand(X, Y)) keep[i] = 1;
      }
    }
    const [rx, ry, rw, rh] = rect;
    const res = new PixelBuffer(rw * d, rh * d);
    const X0 = rx * d;
    const Y0 = ry * d;
    let cut = 0;
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if ((out.data[i] & 255) === 0) continue;
        let take = keep[i] === 1;
        if (!take && c.mat[i] === 0) {
          for (let dy = -d; dy <= d && !take; dy++) {
            const yy = Y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -d; dx <= d; dx++) {
              const xx = X + dx;
              if (xx < 0 || xx >= W || dx * dx + dy * dy > d * d + d * 0.5) continue;
              if (keep[yy * W + xx]) {
                take = true;
                break;
              }
            }
          }
        }
        if (!take) continue;
        const tx = X - X0;
        const ty = Y - Y0;
        if (tx < 0 || ty < 0 || tx >= res.w || ty >= res.h) {
          cut++;
          continue;
        }
        res.data[ty * res.w + tx] = out.data[i];
      }
    }
    res.touch();
    HD_SWAN_FIT.frontCut += cut;
    return { buf: res, cut };
  }
}

/** Px trimmed by `fit` and front px outside the 1× front rectangle (tests, tools). */
export const HD_SWAN_FIT = { px: 0, frames: 0, frontCut: 0 };

/** Canvas box [x0, y0, x1, y1] of points, padded. */
export function bounds(pts: ReadonlyArray<readonly [number, number]>, pad: number): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/**
 * Grow a polygon by r (mitred, the mitre capped at 2.5 r): the area a 1× polygon through pixel
 * centres covers (its edge pixels included) is the polygon grown by about ½ px.
 */
export function growPoly(pts: readonly Pt[], r: number): V[] {
  const n = pts.length;
  if (n < 3 || r === 0) return pts.map((p) => [p[0], p[1]]);
  let area = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) area += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  // Outward normal of edge (a → b): y down; for a clockwise-on-screen polygon (area > 0) it is (dy, −dx).
  const s = area > 0 ? 1 : -1;
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const e0 = norm(p[0] - a[0], p[1] - a[1]);
    const e1 = norm(b[0] - p[0], b[1] - p[1]);
    const n0: V = [e0[1] * s, -e0[0] * s];
    const n1: V = [e1[1] * s, -e1[0] * s];
    let mx = n0[0] + n1[0];
    let my = n0[1] + n1[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) {
      mx = n0[0];
      my = n0[1];
    } else {
      mx /= ml;
      my /= ml;
    }
    const cos = mx * n0[0] + my * n0[1];
    const k = Math.min(2.5, 1 / Math.max(0.2, cos));
    out.push([p[0] + mx * r * k, p[1] + my * r * k]);
  }
  return out;
}

function norm(x: number, y: number): V {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Write a unit normal into a texture sample from (nx, ny, nz). */
export function setNormal(s: TexSample, nx: number, ny: number, nz: number): void {
  const l = Math.hypot(nx, ny, nz) || 1;
  s.nx = nx / l;
  s.ny = ny / l;
  s.nz = nz / l;
}

/** Distance from p to the segment a–b, and the position t (0..1) along it. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 === 0 ? 0 : ((px - ax) * vx + (py - ay) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

/** A round head (rivet, stud, bolt cap) in a texture: switch the px to `mat` with a dome normal. */
export function stud(s: TexSample, dx: number, dy: number, r: number, mat: number): boolean {
  const q = (dx * dx + dy * dy) / (r * r);
  if (q > 1) return false;
  s.mat = mat;
  setNormal(s, dx / r, dy / r, Math.sqrt(1 - q) + 0.15);
  s.tone = 0;
  return true;
}
