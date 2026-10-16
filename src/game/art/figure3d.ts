/**
 * figure3d — a tiny 3D joint rig for the first-person billboards (docs/design/fps.md §8.2).
 *
 * A figure is a list of solid primitives in BODY SPACE (texel units; x = the figure's right,
 * y = up, z = forward, the feet on y = 0): tapered capsules (limbs), ellipsoids (heads, bodies)
 * and boxes (boots, plates, guns), each with a palette material. `renderFigure` rasterises them
 * orthographically for one of the 8 billboard yaws (yaw k = the figure faces k × 45° clockwise
 * from "facing the viewer", the engine's convention; the engine mirrors yaws 5–7 from 3–1),
 * with a per-texel depth buffer, a fixed key light from the upper left, ordered-dither banding
 * into the material's ramp, dark seams where parts overlap at different depths and an ink
 * outline. Dots (eyes, buttons, badges) are painted after shading, depth-tested.
 *
 * Pure and deterministic (no Math.random); runs at content-prepare time, never per tick.
 * Palette-only: every texel comes from a material ramp, INK or an explicit palette colour.
 */
import type { Color } from '../../engine/color';
import { INK, type Ramp } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import { bayer } from './paint';

export type V3 = readonly [number, number, number];
/** Row-major 3 × 3 rotation, local → parent. */
export type M3 = readonly number[];

export const IDENT: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface Mat {
  /** Dark → light. */
  ramp: Ramp;
  /** Added to the lit ramp position (+ brighter). */
  bias?: number;
  /** Self-lit: always the top of the ramp, no shading (glow, flash, lamps). */
  glow?: boolean;
  /** Seam / outline colour next to this material (default: the ramp's darkest, or INK). */
  line?: Color;
}

interface CapPart {
  k: 'cap';
  a: V3;
  b: V3;
  ra: number;
  rb: number;
  mat: Mat;
}
interface EllPart {
  k: 'ell';
  c: V3;
  r: V3;
  rot: M3;
  mat: Mat;
}
interface BoxPart {
  k: 'box';
  c: V3;
  h: V3;
  rot: M3;
  mat: Mat;
}
interface CylPart {
  k: 'cyl';
  c: V3;
  /** radius, half height (along local y) */
  h: V3;
  rot: M3;
  mat: Mat;
}
export type Part = CapPart | EllPart | BoxPart | CylPart;

export interface Dot {
  p: V3;
  c: Color;
  /** Square size in texels (default 1). */
  s?: number;
  /** Draw even when hidden by up to this much depth (default 1.5). */
  slack?: number;
}

// ------------------------------------------------------------------------------------ vector math

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len3 = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function mulMV(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
export function mulMM(a: M3, b: M3): M3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return r;
}
export function transpose(m: M3): M3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
/** Rotation about x (pitch: + tips the top forward, toward +z). */
export function rotX(a: number): M3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
/** Rotation about y (turn: + turns +z toward +x). */
export function rotY(a: number): M3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
/** Rotation about z (roll: + tips +x up). */
export function rotZ(a: number): M3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
/** A basis whose local z points along `dir` (local y as close to `up` as possible). */
export function lookAlong(dir: V3, up: V3 = [0, 1, 0]): M3 {
  const z = norm3(dir);
  let x = cross(up, z);
  if (len3(x) < 1e-6) x = cross([1, 0, 0], z);
  x = norm3(x);
  const y = cross(z, x);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/**
 * Two-bone IK: the elbow / knee between `root` and `end` for bone lengths l1, l2, bent toward
 * `pole` (a direction).
 */
export function ik(root: V3, end: V3, l1: number, l2: number, pole: V3): V3 {
  const d0 = sub(end, root);
  let d = len3(d0);
  const dir = norm3(d0);
  d = Math.min(d, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = norm3(sub(pole, mul(dir, dot3(pole, dir))));
  return add(add(root, mul(dir, a)), mul(p, h));
}

// ------------------------------------------------------------------------------------ the figure

export class Figure {
  readonly parts: Part[] = [];
  readonly dots: Dot[] = [];
  /** Optional 2D overlays after shading (in buffer pixels); receive the projector. */
  readonly overlays: ((b: PixelBuffer, proj: Projector) => void)[] = [];

  cap(a: V3, b: V3, ra: number, rb: number, mat: Mat): this {
    this.parts.push({ k: 'cap', a, b, ra, rb, mat });
    return this;
  }
  ball(c: V3, r: number, mat: Mat): this {
    return this.cap(c, c, r, r, mat);
  }
  ell(c: V3, r: V3, mat: Mat, rot: M3 = IDENT): this {
    this.parts.push({ k: 'ell', c, r, rot, mat });
    return this;
  }
  box(c: V3, h: V3, mat: Mat, rot: M3 = IDENT): this {
    this.parts.push({ k: 'box', c, h, rot, mat });
    return this;
  }
  /** A flat-capped cylinder along local y: radius r, half height hh. */
  cyl(c: V3, r: number, hh: number, mat: Mat, rot: M3 = IDENT): this {
    this.parts.push({ k: 'cyl', c, h: [r, hh, r], rot, mat });
    return this;
  }
  dot(p: V3, c: Color, s = 1, slack = 1.5): this {
    this.dots.push({ p, c, s, slack });
    return this;
  }
  overlay(f: (b: PixelBuffer, proj: Projector) => void): this {
    this.overlays.push(f);
    return this;
  }
}

export interface RenderOpts {
  /** Buffer size (square). */
  size: number;
  /** Billboard yaw 0..7 or any angle in radians via `angle`. */
  yaw?: number;
  /** Turn in radians (overrides yaw). */
  angle?: number;
  /** Whole-body transform applied in body space before the turn (falls, tilts). */
  pose?: M3;
  /** Pivot of `pose` in body space (default the origin, between the feet). */
  pivot?: V3;
  /** Body-space offset after the pose (e.g. drop to the floor). */
  offset?: V3;
  /** Texels per body unit (default 1). */
  scale?: number;
  /** Screen x of the body origin (default size / 2). */
  cx?: number;
  /** Screen y of the ground (default size − 1). */
  ground?: number;
  /** Ink outline around the silhouette (default true). */
  outline?: boolean;
}

/** Maps body space to buffer pixels (x right, y down) and view depth (+ toward the viewer). */
export interface Projector {
  /** [screen x, screen y, depth] of a body-space point. */
  p(v: V3): [number, number, number];
  /** View-space rotation (body → view) for normals and directions. */
  rot: M3;
}

/** Light direction in view space (x right, y up, z toward the viewer): upper left, front. */
const LIGHT: V3 = norm3([-0.55, 0.7, 0.55]);

/**
 * Render a figure to a size × size buffer.
 */
export function renderFigure(fig: Figure, o: RenderOpts): PixelBuffer {
  const N = o.size;
  const scale = o.scale ?? 1;
  const cx = o.cx ?? N / 2;
  const gy = o.ground ?? N - 1;
  const th = o.angle ?? ((o.yaw ?? 0) * Math.PI) / 4;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // body (x right, y up, z forward) → view (x screen right, y up, z toward viewer):
  // the figure's right = (−c, 0, −s), forward = (−s, 0, c)
  const turn: M3 = [-c, 0, -s, 0, 1, 0, -s, 0, c];
  const pose = o.pose ?? IDENT;
  const pivot = o.pivot ?? [0, 0, 0];
  const off = o.offset ?? [0, 0, 0];
  const rot = mulMM(turn, pose);
  const toView = (v: V3): V3 => {
    const local = add(add(mulMV(pose, sub(v, pivot)), pivot), off);
    const w = mulMV(turn, local);
    return [w[0] * scale, w[1] * scale, w[2] * scale];
  };
  const proj: Projector = {
    p: (v) => {
      const w = toView(v);
      return [cx + w[0], gy - w[1], w[2]];
    },
    rot,
  };

  const z = new Float64Array(N * N).fill(-Infinity);
  const nx = new Float32Array(N * N);
  const ny = new Float32Array(N * N);
  const nz = new Float32Array(N * N);
  const pid = new Int16Array(N * N).fill(-1);

  const write = (i: number, depth: number, n: V3, id: number): void => {
    if (depth <= z[i]) return;
    z[i] = depth;
    nx[i] = n[0];
    ny[i] = n[1];
    nz[i] = n[2];
    pid[i] = id;
  };

  fig.parts.forEach((part, id) => {
    if (part.k === 'cap') {
      const A = toView(part.a);
      const B = toView(part.b);
      const ra = part.ra * scale;
      const rb = part.rb * scale;
      const rmax = Math.max(ra, rb);
      const x0 = Math.max(0, Math.floor(cx + Math.min(A[0], B[0]) - rmax - 1));
      const x1 = Math.min(N - 1, Math.ceil(cx + Math.max(A[0], B[0]) + rmax + 1));
      const y0 = Math.max(0, Math.floor(gy - Math.max(A[1], B[1]) - rmax - 1));
      const y1 = Math.min(N - 1, Math.ceil(gy - Math.min(A[1], B[1]) + rmax + 1));
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const dz = B[2] - A[2];
      const L2 = dx * dx + dy * dy + dz * dz;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const vx = px + 0.5 - cx;
          const vy = gy - (py + 0.5);
          // closest point on the 3D segment to the view ray (x = vx, y = vy, z free):
          // minimise over t the 2D distance (x, y) — depth follows the segment.
          let t = 0;
          const L2xy = dx * dx + dy * dy;
          if (L2xy > 1e-9) t = Math.max(0, Math.min(1, ((vx - A[0]) * dx + (vy - A[1]) * dy) / L2xy));
          else if (L2 > 1e-9) t = 0;
          const qx = A[0] + dx * t;
          const qy = A[1] + dy * t;
          const qz = A[2] + dz * t;
          const r = ra + (rb - ra) * t;
          const ex = vx - qx;
          const ey = vy - qy;
          const d2 = ex * ex + ey * ey;
          if (d2 > r * r) continue;
          const h = Math.sqrt(r * r - d2);
          write(py * N + px, qz + h, [ex / r, ey / r, h / r], id);
        }
      }
    } else {
      const C = toView(part.c);
      const R = mulMM(rot, part.rot); // local → view
      const Rt = transpose(R);
      const ext = part.k === 'ell' ? part.r : part.h;
      const ex = ext[0] * scale;
      const ey = ext[1] * scale;
      const ez = ext[2] * scale;
      const rad = part.k === 'ell' ? Math.max(ex, ey, ez) : Math.hypot(ex, ey, ez);
      const x0 = Math.max(0, Math.floor(cx + C[0] - rad - 1));
      const x1 = Math.min(N - 1, Math.ceil(cx + C[0] + rad + 1));
      const y0 = Math.max(0, Math.floor(gy - C[1] - rad - 1));
      const y1 = Math.min(N - 1, Math.ceil(gy - C[1] + rad + 1));
      // ray direction (0, 0, 1) in local space
      const D = mulMV(Rt, [0, 0, 1]);
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const vx = px + 0.5 - cx;
          const vy = gy - (py + 0.5);
          const O = mulMV(Rt, [vx - C[0], vy - C[1], -C[2]]); // ray origin at view z = 0, local
          if (part.k === 'cyl') {
            const r = ex;
            const hh = ey;
            const qa = D[0] * D[0] + D[2] * D[2];
            let t0 = -Infinity;
            let t1 = Infinity;
            if (qa < 1e-9) {
              if (O[0] * O[0] + O[2] * O[2] > r * r) continue;
            } else {
              const qb = 2 * (O[0] * D[0] + O[2] * D[2]);
              const qc = O[0] * O[0] + O[2] * O[2] - r * r;
              const disc = qb * qb - 4 * qa * qc;
              if (disc < 0) continue;
              const sq = Math.sqrt(disc);
              t0 = (-qb - sq) / (2 * qa);
              t1 = (-qb + sq) / (2 * qa);
            }
            let s0 = -Infinity;
            let s1 = Infinity;
            if (Math.abs(D[1]) < 1e-9) {
              if (O[1] < -hh || O[1] > hh) continue;
            } else {
              s0 = (-hh - O[1]) / D[1];
              s1 = (hh - O[1]) / D[1];
              if (s0 > s1) {
                const tt = s0;
                s0 = s1;
                s1 = tt;
              }
            }
            const lo = Math.max(t0, s0);
            const hi = Math.min(t1, s1);
            if (lo > hi) continue;
            let nl: V3;
            if (s1 <= t1) nl = [0, D[1] > 0 ? 1 : -1, 0];
            else {
              const lx = O[0] + D[0] * hi;
              const lz = O[2] + D[2] * hi;
              nl = [lx / r, 0, lz / r];
            }
            write(py * N + px, hi, norm3(mulMV(R, nl)), id);
          } else if (part.k === 'ell') {
            const ox = O[0] / ex;
            const oy = O[1] / ey;
            const oz = O[2] / ez;
            const dxl = D[0] / ex;
            const dyl = D[1] / ey;
            const dzl = D[2] / ez;
            const qa = dxl * dxl + dyl * dyl + dzl * dzl;
            const qb = 2 * (ox * dxl + oy * dyl + oz * dzl);
            const qc = ox * ox + oy * oy + oz * oz - 1;
            const disc = qb * qb - 4 * qa * qc;
            if (disc < 0) continue;
            const t = (-qb + Math.sqrt(disc)) / (2 * qa); // the far root along +z = nearest the viewer
            const lx = O[0] + D[0] * t;
            const ly = O[1] + D[1] * t;
            const lz = O[2] + D[2] * t;
            const n = norm3(mulMV(R, [lx / (ex * ex), ly / (ey * ey), lz / (ez * ez)]));
            write(py * N + px, t, n, id);
          } else {
            let tmin = -Infinity;
            let tmax = Infinity;
            let axis = 0;
            let sign = 1;
            let miss = false;
            for (let k = 0; k < 3 && !miss; k++) {
              const h = k === 0 ? ex : k === 1 ? ey : ez;
              if (Math.abs(D[k]) < 1e-9) {
                if (O[k] < -h || O[k] > h) miss = true;
                continue;
              }
              let t0 = (-h - O[k]) / D[k];
              let t1 = (h - O[k]) / D[k];
              if (t0 > t1) {
                const tt = t0;
                t0 = t1;
                t1 = tt;
              }
              // the exit face (largest t) faces the viewer
              if (t1 < tmax) {
                tmax = t1;
                axis = k;
                sign = D[k] > 0 ? 1 : -1;
              }
              if (t0 > tmin) tmin = t0;
            }
            if (miss || tmin > tmax) continue;
            const nl: V3 = axis === 0 ? [sign, 0, 0] : axis === 1 ? [0, sign, 0] : [0, 0, sign];
            write(py * N + px, tmax, mulMV(R, nl), id);
          }
        }
      }
    }
  });

  // shade
  const out = new PixelBuffer(N, N);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const i = py * N + px;
      const id = pid[i];
      if (id < 0) continue;
      const m = fig.parts[id].mat;
      const r = m.ramp;
      if (m.glow) {
        out.data[i] = r[r.length - 1];
        continue;
      }
      const lam = nx[i] * LIGHT[0] + ny[i] * LIGHT[1] + nz[i] * LIGHT[2];
      const lum = 0.22 + 0.78 * Math.max(0, lam) + (m.bias ?? 0) / Math.max(1, r.length - 1);
      const v = lum * (r.length - 1) + 0.15;
      const k0 = Math.floor(v);
      // flat bands with a narrow dithered border (large smooth areas stay clean)
      const fr = v - k0;
      const k = fr < 0.38 ? k0 : fr > 0.62 ? k0 + 1 : (fr - 0.38) / 0.24 > bayer(px, py) ? k0 + 1 : k0;
      out.data[i] = r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
    }
  }
  // seams: a part boundary with a depth step darkens the farther texel
  const seam = new Uint8Array(N * N);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const i = py * N + px;
      const id = pid[i];
      if (id < 0) continue;
      for (const [ox, oy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        const qx = px + ox;
        const qy = py + oy;
        if (qx < 0 || qy < 0 || qx >= N || qy >= N) continue;
        const j = qy * N + qx;
        const jd = pid[j];
        if (jd < 0 || jd === id) continue;
        if (fig.parts[jd].mat === fig.parts[id].mat && Math.abs(z[j] - z[i]) < 3 * scale) continue;
        if (z[j] > z[i] + 1.2 * scale) seam[i] = 1;
      }
    }
  }
  for (let i = 0; i < N * N; i++) {
    if (!seam[i]) continue;
    const m = fig.parts[pid[i]].mat;
    if (m.glow) continue;
    out.data[i] = m.line ?? (m.ramp[0] === INK ? INK : m.ramp[0]);
  }
  // dots
  for (const d of fig.dots) {
    const [sx, sy, sz] = proj.p(d.p);
    const s = d.s ?? 1;
    const x0 = Math.round(sx - s / 2);
    const y0 = Math.round(sy - s / 2);
    for (let yy = y0; yy < y0 + s; yy++) {
      for (let xx = x0; xx < x0 + s; xx++) {
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const i = yy * N + xx;
        if (pid[i] < 0 || z[i] > sz + (d.slack ?? 1.5) * scale) continue;
        out.data[i] = d.c;
      }
    }
  }
  for (const f of fig.overlays) f(out, proj);
  // outline
  if (o.outline !== false) {
    const src = out.data.slice();
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const i = py * N + px;
        if ((src[i] & 255) !== 0) continue;
        if (
          (px > 0 && (src[i - 1] & 255) !== 0) ||
          (px < N - 1 && (src[i + 1] & 255) !== 0) ||
          (py > 0 && (src[i - N] & 255) !== 0) ||
          (py < N - 1 && (src[i + N] & 255) !== 0)
        ) {
          out.data[i] = INK;
        }
      }
    }
  }
  return out.touch();
}
