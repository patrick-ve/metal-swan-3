/**
 * Low-poly car building blocks (docs/design/rally.md §6, §7.3): a LOFT of cross-sections along the
 * car (the body), wheels, boxes, a flat prism (a spare tyre lying down), the blob shadow and the
 * lamp quads. Faces are flat-shaded (one normal per face, the era's look; the texture carries the
 * detail) and textured through a `CarSheet`'s planar mappings (tex/car-sheet.ts), so the painters and
 * the meshes agree to the texel.
 *
 * A `Station` is one cross-section at z: the side panel runs from the sill or the wheel arch (yb, half
 * width wb) up to the shoulder (ym, wm), the upper side (the glass, or the bonnet's shoulder) up to
 * the top (yt, wt); the top joins the two sides. Stations run from the nose (+z) to the tail.
 *
 * Setup code: allocates freely. Deterministic: + − × ÷, Math.sqrt and the r3 trig tables only.
 */
import { cosT, sinT, TAU } from '../../../../engine/r3/trig';
import { S, type Slot } from '../tex/car-palette';
import type { CarSheet } from '../tex/car-sheet';
import type { MeshBuilder, P3 as MP3, UV4 } from '../mesh';
import type { P3 } from './types';

/** The vertex colour that shows the texture as painted. */
export const GREY: MP3 = [128, 128, 128];

export interface Station {
  readonly z: number;
  readonly yb: number;
  readonly ym: number;
  readonly yt: number;
  readonly wb: number;
  readonly wm: number;
  readonly wt: number;
}

type UV = readonly [number, number];

/**
 * A planar polygon (corners in order, any winding) whose front faces along `hint` (the outward side):
 * one flat normal, fan triangles. Degenerate polygons are skipped.
 */
export function face(mb: MeshBuilder, pts: readonly P3[], uv: readonly UV[], hint: P3, col: MP3 = GREY): void {
  const n = pts.length;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-7) return;
  let flip = false;
  if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
    flip = true;
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const nn: MP3 = [nx / len, ny / len, nz / len];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = flip ? n - 1 - i : i;
    idx.push(mb.vertex(pts[k], uv[k][0], uv[k][1], col, nn));
  }
  // Fan triangles; a corner shared by two points (a quad that narrows to a triangle) gives none.
  const p0 = pts[flip ? n - 1 : 0];
  for (let i = 1; i < n - 1; i++) {
    const a = pts[flip ? n - 1 - i : i];
    const b = pts[flip ? n - 2 - i : i + 1];
    const ex = a[0] - p0[0], ey = a[1] - p0[1], ez = a[2] - p0[2];
    const fx = b[0] - p0[0], fy = b[1] - p0[1], fz = b[2] - p0[2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    if (cx * cx + cy * cy + cz * cz > 1e-12) mb.tri(idx[0], idx[i], idx[i + 1]);
  }
}

/** Is the quad's area above zero (two edges of length > 1 mm in different directions)? */
function solidQuad(p: readonly P3[]): boolean {
  const ax = p[2][0] - p[0][0], ay = p[2][1] - p[0][1], az = p[2][2] - p[0][2];
  const bx = p[3][0] - p[1][0], by = p[3][1] - p[1][1], bz = p[3][2] - p[1][2];
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
  return cx * cx + cy * cy + cz * cz > 1e-8;
}

/** The arc length along the top line at each station (from the nose). */
export function topArc(st: readonly Station[]): number[] {
  const s = [0];
  for (let i = 1; i < st.length; i++) {
    const dz = st[i - 1].z - st[i].z;
    const dy = st[i - 1].yt - st[i].yt;
    s.push(s[i - 1] + Math.sqrt(dz * dz + dy * dy));
  }
  return s;
}

/** z at arc length `s` along the top line (for the top painter). */
export function zAtArc(st: readonly Station[], arc: readonly number[], s: number): number {
  if (s <= 0) return st[0].z;
  for (let i = 1; i < st.length; i++) {
    if (s <= arc[i]) {
      const t = (s - arc[i - 1]) / Math.max(1e-6, arc[i] - arc[i - 1]);
      return st[i - 1].z + (st[i].z - st[i - 1].z) * t;
    }
  }
  return st[st.length - 1].z;
}

/** Arc length along the top line at z (the inverse of `zAtArc`). */
export function arcAtZ(st: readonly Station[], arc: readonly number[], z: number): number {
  if (z >= st[0].z) return 0;
  for (let i = 1; i < st.length; i++) {
    if (z >= st[i].z) {
      const t = (st[i - 1].z - z) / Math.max(1e-6, st[i - 1].z - st[i].z);
      return arc[i - 1] + (arc[i] - arc[i - 1]) * t;
    }
  }
  return arc[arc.length - 1];
}

/**
 * The lofted body: both sides (lower and upper panels), the top and the two end caps.
 * `ends` = false leaves the caps out (a body part that continues in other geometry).
 */
export function loft(mb: MeshBuilder, sh: CarSheet, st: readonly Station[], ends = true): void {
  const arc = topArc(st);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i];
    const b = st[i + 1];
    for (const side of ['L', 'R'] as const) {
      const g = side === 'L' ? 1 : -1;
      const su = (p: P3): UV => [sh.sideU(side, p[2]), sh.sideV(side, p[1])];
      const lower: P3[] = [
        [g * a.wb, a.yb, a.z],
        [g * b.wb, b.yb, b.z],
        [g * b.wm, b.ym, b.z],
        [g * a.wm, a.ym, a.z],
      ];
      if (solidQuad(lower)) face(mb, lower, lower.map(su), [g, 0, 0]);
      const upper: P3[] = [
        [g * a.wm, a.ym, a.z],
        [g * b.wm, b.ym, b.z],
        [g * b.wt, b.yt, b.z],
        [g * a.wt, a.yt, a.z],
      ];
      if (solidQuad(upper)) face(mb, upper, upper.map(su), [g, 0, 0]);
    }
    const top: P3[] = [
      [a.wt, a.yt, a.z],
      [-a.wt, a.yt, a.z],
      [-b.wt, b.yt, b.z],
      [b.wt, b.yt, b.z],
    ];
    const tv: UV[] = [
      [sh.topU(a.wt), sh.topV(arc[i])],
      [sh.topU(-a.wt), sh.topV(arc[i])],
      [sh.topU(-b.wt), sh.topV(arc[i + 1])],
      [sh.topU(b.wt), sh.topV(arc[i + 1])],
    ];
    if (solidQuad(top)) face(mb, top, tv, [0, 1, 0]);
  }
  if (!ends) return;
  for (const end of ['front', 'back'] as const) {
    const s = end === 'front' ? st[0] : st[st.length - 1];
    const hint: P3 = [0, 0, end === 'front' ? 1 : -1];
    const cu = (p: P3): UV => [sh.capU(end, p[0]), sh.capV(end, p[1])];
    const low: P3[] = [
      [s.wb, s.yb, s.z],
      [s.wm, s.ym, s.z],
      [-s.wm, s.ym, s.z],
      [-s.wb, s.yb, s.z],
    ];
    if (solidQuad(low)) face(mb, low, low.map(cu), hint);
    const up: P3[] = [
      [s.wm, s.ym, s.z],
      [s.wt, s.yt, s.z],
      [-s.wt, s.yt, s.z],
      [-s.wm, s.ym, s.z],
    ];
    if (solidQuad(up)) face(mb, up, up.map(cu), hint);
  }
}

/** A box with one flat colour (no bottom unless asked). */
export function box(mb: MeshBuilder, sh: CarSheet, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, slot: Slot, bottom = false): void {
  const uv = sh.solid(slot);
  mb.box(x0, y0, z0, x1, y1, z1, () => uv, GREY, !bottom);
}

/** A box with a face texture on one end (the rest one colour): lamps, displays. */
export function boxFaced(mb: MeshBuilder, sh: CarSheet, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, slot: Slot, faces: Partial<Record<'front' | 'back' | 'left' | 'right' | 'top', UV4>>): void {
  const uv = sh.solid(slot);
  mb.box(x0, y0, z0, x1, y1, z1, (f) => faces[f as 'front'] ?? uv, GREY, true);
}

/** A flat quad facing `hint` with a texture rectangle (u0 v0 u1 v1 from corner a to c). */
export function decal(mb: MeshBuilder, a: P3, b: P3, c: P3, d: P3, uv: UV4, hint: P3, col: MP3 = GREY): void {
  face(mb, [a, b, c, d], [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], hint, col);
}

/**
 * A wheel: `n` tread quads and the outer rim face (the wheel texture). Local space: the axle along
 * x, the centre at `at` (the origin for the spinning meshes). `left`: the rim faces +x.
 */
export function wheel(mb: MeshBuilder, sh: CarSheet, r: number, w: number, left: boolean, n = 8, at: P3 = [0, 0, 0]): void {
  const g = left ? 1 : -1;
  const xo = at[0] + g * w * 0.5;
  const xi = at[0] - g * w * 0.5;
  const t = sh.tread;
  const rim = sh.wheel;
  const cx = rim.x + rim.w / 2;
  const cy = rim.y + rim.h / 2;
  const R = rim.w / 2;
  const ring: P3[] = [];
  const ruv: UV[] = [];
  for (let k = 0; k < n; k++) {
    const th = (k + 0.5) * (TAU / n);
    const c = cosT(th);
    const s = sinT(th);
    ring.push([xo, at[1] + r * s, at[2] + r * c]);
    // Seen from outside the rim: the left wheel's right-hand side is −z, the right wheel's +z.
    ruv.push([cx - g * c * R, cy - s * R]);
  }
  for (let k = 0; k < n; k++) {
    const p = ring[k];
    const q = ring[(k + 1) % n];
    const mid: P3 = [0, (p[1] + q[1]) * 0.5 - at[1], (p[2] + q[2]) * 0.5 - at[2]];
    face(
      mb,
      [
        [xo, p[1], p[2]],
        [xo, q[1], q[2]],
        [xi, q[1], q[2]],
        [xi, p[1], p[2]],
      ],
      [
        [t.x, t.y],
        [t.x, t.y + t.h],
        [t.x + t.w, t.y + t.h],
        [t.x + t.w, t.y],
      ],
      mid,
    );
  }
  face(mb, ring, ruv, [g, 0, 0]);
}

/** A flat prism lying on y (an n-gon; a spare tyre): the tread round it, the rim face on top. */
export function flatWheel(mb: MeshBuilder, sh: CarSheet, x: number, y0: number, z: number, r: number, h: number, n = 8): void {
  const t = sh.tread;
  const rim = sh.wheel;
  const cx = rim.x + rim.w / 2;
  const cy = rim.y + rim.h / 2;
  const R = rim.w / 2;
  const top: P3[] = [];
  const tuv: UV[] = [];
  for (let k = 0; k < n; k++) {
    const th = (k + 0.5) * (TAU / n);
    const c = cosT(th);
    const s = sinT(th);
    top.push([x + r * c, y0 + h, z + r * s]);
    tuv.push([cx - c * R, cy - s * R]);
  }
  for (let k = 0; k < n; k++) {
    const p = top[k];
    const q = top[(k + 1) % n];
    face(
      mb,
      [
        [p[0], y0 + h, p[2]],
        [q[0], y0 + h, q[2]],
        [q[0], y0, q[2]],
        [p[0], y0, p[2]],
      ],
      [
        [t.x, t.y],
        [t.x, t.y + t.h],
        [t.x + t.w, t.y + t.h],
        [t.x + t.w, t.y],
      ],
      [(p[0] + q[0]) * 0.5 - x, 0, (p[2] + q[2]) * 0.5 - z],
    );
  }
  face(mb, top, tuv, [0, 1, 0]);
}

/**
 * The blob shadow (blend 'sub'): an inner rectangle at full strength fading to nothing at an outer
 * one (vertex colours; 10 triangles), just above the road. `strength` is the vertex colour inside.
 */
export function blobShadow(mb: MeshBuilder, sh: CarSheet, hw: number, hl: number, edge: number, strength = 92, y = 0.04): void {
  const uv = sh.solid(S.PLASTIC);
  const on: MP3 = [strength, strength, strength];
  const off: MP3 = [0, 0, 0];
  const up: MP3 = [0, 1, 0];
  const inner: P3[] = [
    [hw, y, hl],
    [-hw, y, hl],
    [-hw, y, -hl],
    [hw, y, -hl],
  ];
  const outer: P3[] = [
    [hw + edge, y, hl + edge],
    [-hw - edge, y, hl + edge],
    [-hw - edge, y, -hl - edge],
    [hw + edge, y, -hl - edge],
  ];
  const vi = inner.map((p) => mb.vertex(p, uv[0], uv[1], on, up));
  const vo = outer.map((p) => mb.vertex(p, uv[0], uv[1], off, up));
  // Counter-clockwise seen from above (the front faces up).
  mb.tri(vi[0], vi[2], vi[1]);
  mb.tri(vi[0], vi[3], vi[2]);
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4;
    mb.tri(vo[k], vi[k1], vo[k1]);
    mb.tri(vo[k], vi[k], vi[k1]);
  }
}

/** A lamp quad (an emissive glow) on a face: centre `c`, half sizes along the face's two axes. */
export function lampQuad(mb: MeshBuilder, sh: CarSheet, c: P3, normal: P3, hu: number, hv: number, slot: Slot): void {
  const uv = sh.solid(slot);
  const [x, y, z] = c;
  let pts: P3[];
  if (normal[2] !== 0) {
    pts = [
      [x - hu, y - hv, z],
      [x + hu, y - hv, z],
      [x + hu, y + hv, z],
      [x - hu, y + hv, z],
    ];
  } else if (normal[0] !== 0) {
    pts = [
      [x, y - hv, z - hu],
      [x, y - hv, z + hu],
      [x, y + hv, z + hu],
      [x, y + hv, z - hu],
    ];
  } else {
    pts = [
      [x - hu, y, z - hv],
      [x + hu, y, z - hv],
      [x + hu, y, z + hv],
      [x - hu, y, z + hv],
    ];
  }
  face(mb, pts, [[uv[0], uv[1]], [uv[0], uv[1]], [uv[0], uv[1]], [uv[0], uv[1]]], normal);
}
