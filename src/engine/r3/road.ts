/**
 * Road meshes: cross-sections extruded along a centre line (docs/design/rally.md §3 "Data", §7.1
 * item 1; docs/api/rally.md "A.T The track"). Pure setup code (TRACK; the 3D view only uploads the
 * result): it allocates freely, never runs per frame, and follows the determinism rules of `r3/`
 * (+ − × ÷ and Math.sqrt / floor / ceil / abs / min / max), so the same input gives the same bytes.
 *
 * - `MeshAcc`: a growable `Mesh3` under construction (positions, TEXEL uvs, vertex colours with
 *   128 = the texture as painted, normals, indices), with `quad`, `fan` and `obox` (an oriented box).
 * - A cross-section is a list of `CrossEdge`s in the plane of the road's horizontal right vector
 *   and the world up axis: `x` = metres to the right of the centre line, `y` = ABSOLUTE world height
 *   (so a verge can meet the flat ground at y = 0 and a wall stays vertical on a ramp). An edge's
 *   front face is on its left when it is walked from (x0, y0) to (x1, y1) in that plane: walk the
 *   ground from left to right (front = up), a wall that faces the road on the right from the bottom
 *   up, a ceiling from right to left (front = down).
 * - `extrude(acc, rows, prof, sRef)`: every edge of every row joined to the same edge of the next row
 *   (the rows share one topology: `prof[i][e]` is edge e at row i). u runs across an edge (u0 → u1
 *   texels), v along it (`(s − sRef) · vScale + vOff` texels; pass a small `sRef` so v stays small
 *   and exact). Subdivision control: `rowsFor(length, maxAlong)` for the rows and `CrossEdge.across`
 *   (metres per piece) across, so near polygons stay small enough for the affine warp to read.
 *   An edge that is degenerate in every row (a wall of height 0) is left out.
 */
import type { Blend3, Mesh3 } from '../view3d';

/** One sample of the centre line: arc length, position, horizontal right vector. */
export interface RoadRow {
  s: number;
  px: number;
  py: number;
  pz: number;
  /** Horizontal unit vector to the right (y = 0). */
  rx: number;
  rz: number;
}

/** One edge of a cross-section (see the file comment for the plane, the facing and the uv). */
export interface CrossEdge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Texel u at (x0, y0) and at (x1, y1). */
  u0: number;
  u1: number;
  /** Texels of v per metre along the road. */
  vScale: number;
  /** Texel v added (a texture's v origin). */
  vOff: number;
  /** Metres across per piece (0 = one piece). */
  across: number;
  /** Vertex colour 0xRRGGBB (0x808080 = the texture as painted). */
  col: number;
}

/** A cross-section edge (a plain object; the profile code fills many of them). */
export function crossEdge(x0: number, y0: number, x1: number, y1: number, u0: number, u1: number, vScale: number, vOff: number, across: number, col: number): CrossEdge {
  return { x0, y0, x1, y1, u0, u1, vScale, vOff, across, col };
}

/** Rows along a stretch: at least one, each at most `maxAlong` metres. */
export function rowsFor(length: number, maxAlong: number): number {
  if (!(maxAlong > 0)) return 1;
  return Math.max(1, Math.ceil(length / maxAlong - 1e-9));
}

export type V3 = readonly [number, number, number];
/** A texture rectangle's corners in texels: u0, v0, u1, v1. */
export type UV4 = readonly [number, number, number, number];
/** The faces of an oriented box (`obox`): ±x, ±y, ±z of its own axes. */
export type OboxFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

/** A `Mesh3` under construction. */
export class MeshAcc {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly rgb: number[] = [];
  readonly nrm: number[] = [];
  readonly idx: number[] = [];
  /** World bounds of every vertex so far (culling). */
  minX = Infinity;
  minY = Infinity;
  minZ = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  maxZ = -Infinity;

  get vertices(): number {
    return this.pos.length / 3;
  }

  get triangles(): number {
    return this.idx.length / 3;
  }

  /** A vertex: position, texel uv, colour 0xRRGGBB, normal. Returns its index. */
  vertex(x: number, y: number, z: number, u: number, v: number, col: number, nx: number, ny: number, nz: number): number {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    this.rgb.push((col >> 16) & 255, (col >> 8) & 255, col & 255);
    this.nrm.push(nx, ny, nz);
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (z < this.minZ) this.minZ = z;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
    if (z > this.maxZ) this.maxZ = z;
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /** Two triangles over vertices a-b-c-d (in order around the quad) whose front faces along n. */
  quadIdx(a: number, b: number, c: number, d: number, nx: number, ny: number, nz: number): void {
    // The quad's vector area (c − a) × (d − b): it points along the front of a-b-c-d even when one
    // side has length 0 (a wall that starts at height 0).
    const P = this.pos;
    const ex = P[c * 3] - P[a * 3], ey = P[c * 3 + 1] - P[a * 3 + 1], ez = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = P[d * 3] - P[b * 3], fy = P[d * 3 + 1] - P[b * 3 + 1], fz = P[d * 3 + 2] - P[b * 3 + 2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    if (cx * nx + cy * ny + cz * nz >= 0) {
      this.tri(a, b, c);
      this.tri(a, c, d);
    } else {
      this.tri(a, c, b);
      this.tri(a, d, c);
    }
  }

  /** A quad a-b-c-d with the texel rectangle uv (a → u0 v0, b → u1 v0, c → u1 v1, d → u0 v1), front along n. */
  quad(a: V3, b: V3, c: V3, d: V3, uv: UV4, col: number, n: V3): void {
    const [u0, v0, u1, v1] = uv;
    const ia = this.vertex(a[0], a[1], a[2], u0, v0, col, n[0], n[1], n[2]);
    const ib = this.vertex(b[0], b[1], b[2], u1, v0, col, n[0], n[1], n[2]);
    const ic = this.vertex(c[0], c[1], c[2], u1, v1, col, n[0], n[1], n[2]);
    const id = this.vertex(d[0], d[1], d[2], u0, v1, col, n[0], n[1], n[2]);
    this.quadIdx(ia, ib, ic, id, n[0], n[1], n[2]);
  }

  /** A convex polygon (a fan from the first point), one texel (u, v) for every corner, front along n. */
  fan(pts: readonly V3[], u: number, v: number, col: number, n: V3): void {
    if (pts.length < 3) return;
    const first = this.vertices;
    for (const p of pts) this.vertex(p[0], p[1], p[2], u, v, col, n[0], n[1], n[2]);
    for (let k = 1; k + 1 < pts.length; k++) {
      const a = first, b = first + k, c = first + k + 1;
      const P = this.pos;
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
      const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
      const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
      if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) this.tri(a, b, c);
      else this.tri(a, c, b);
    }
  }

  /**
   * An oriented box: centre c, half-axis vectors ax, ay, az (any lengths; ay usually world up).
   * `uvOf(face)` gives each face's texel rectangle; `faces` lists the faces to draw (default all
   * but the bottom 'ny').
   */
  obox(c: V3, ax: V3, ay: V3, az: V3, uvOf: (face: OboxFace) => UV4, col: number, faces: readonly OboxFace[] = OBOX_NO_BOTTOM): void {
    const corner = (sx: number, sy: number, sz: number): V3 => [
      c[0] + ax[0] * sx + ay[0] * sy + az[0] * sz,
      c[1] + ax[1] * sx + ay[1] * sy + az[1] * sz,
      c[2] + ax[2] * sx + ay[2] * sy + az[2] * sz,
    ];
    const unit = (v: V3, s: number): V3 => {
      const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
      return [(v[0] * s) / l, (v[1] * s) / l, (v[2] * s) / l];
    };
    for (const f of faces) {
      const uv = uvOf(f);
      if (f === 'px') this.quad(corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1), uv, col, unit(ax, 1));
      else if (f === 'nx') this.quad(corner(-1, -1, 1), corner(-1, -1, -1), corner(-1, 1, -1), corner(-1, 1, 1), uv, col, unit(ax, -1));
      else if (f === 'pz') this.quad(corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1), uv, col, unit(az, 1));
      else if (f === 'nz') this.quad(corner(1, -1, -1), corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1), uv, col, unit(az, -1));
      else if (f === 'py') this.quad(corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1), uv, col, unit(ay, 1));
      else this.quad(corner(-1, -1, 1), corner(1, -1, 1), corner(1, -1, -1), corner(-1, -1, -1), uv, col, unit(ay, -1));
    }
  }

  /** The finished mesh (Uint16 indices up to 65,535 vertices). */
  toMesh(id: string, page: number, clutRow: number, o: { blend?: Blend3; twoSided?: boolean; emissive?: boolean } = {}): Mesh3 {
    const n = this.vertices;
    return {
      id,
      pos: Float32Array.from(this.pos),
      uv: Float32Array.from(this.uv),
      rgb: Uint8Array.from(this.rgb),
      nrm: Float32Array.from(this.nrm),
      idx: n > 65535 ? Uint32Array.from(this.idx) : Uint16Array.from(this.idx),
      page,
      clutRow,
      blend: o.blend ?? 'opaque',
      ...(o.twoSided ? { twoSided: true } : {}),
      ...(o.emissive ? { emissive: true } : {}),
    };
  }
}

const OBOX_NO_BOTTOM: readonly OboxFace[] = ['px', 'nx', 'py', 'pz', 'nz'];

/**
 * Extrude a cross-section along rows: `prof[i]` holds the edges at `rows[i]` (the same count and
 * order in every row). Each edge becomes a strip of quads (`across` pieces wide, one per row gap);
 * its vertices are its own (hard edges between faces), its normal is the edge's normal in the
 * (right, up) plane. Returns the triangles added.
 */
export function extrude(acc: MeshAcc, rows: readonly RoadRow[], prof: readonly (readonly CrossEdge[])[], sRef: number): number {
  const before = acc.triangles;
  const nRows = rows.length;
  if (nRows < 2 || prof.length !== nRows) return 0;
  const nEdges = prof[0].length;
  for (let e = 0; e < nEdges; e++) {
    // Degenerate in every row (a wall of height 0, a verge of width 0): left out. Pieces: by the
    // longest row.
    let maxLen = 0;
    for (let i = 0; i < nRows; i++) {
      const q = prof[i][e];
      const dx = q.x1 - q.x0, dy = q.y1 - q.y0;
      const l = Math.sqrt(dx * dx + dy * dy);
      if (l > maxLen) maxLen = l;
    }
    if (maxLen < 1e-3) continue;
    const e0 = prof[0][e];
    const div = e0.across > 0 ? Math.max(1, Math.ceil(maxLen / e0.across - 1e-9)) : 1;
    const base = acc.vertices;
    let nlx = 0, nly = 0;
    for (let i = 0; i < nRows; i++) {
      const row = rows[i];
      const q = prof[i][e];
      const dx = q.x1 - q.x0, dy = q.y1 - q.y0;
      const l = Math.sqrt(dx * dx + dy * dy);
      // The normal: the edge direction turned +90° in the (right, up) plane; a degenerate row
      // keeps the last good one.
      if (l > 1e-6) {
        nlx = -dy / l;
        nly = dx / l;
      } else if (i === 0) {
        nlx = 0;
        nly = 1;
      }
      const nx = row.rx * nlx, nz = row.rz * nlx;
      const v = (row.s - sRef) * q.vScale + q.vOff;
      for (let k = 0; k <= div; k++) {
        const f = k / div;
        const x = q.x0 + (q.x1 - q.x0) * f;
        const y = q.y0 + (q.y1 - q.y0) * f;
        acc.vertex(row.px + row.rx * x, y, row.pz + row.rz * x, q.u0 + (q.u1 - q.u0) * f, v, q.col, nx, nly, nz);
      }
    }
    const per = div + 1;
    for (let i = 0; i + 1 < nRows; i++) {
      const row = rows[i];
      const q = prof[i][e];
      const dx = q.x1 - q.x0, dy = q.y1 - q.y0;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = row.rx * (-dy / l), ny = dx / l, nz = row.rz * (-dy / l);
      for (let k = 0; k < div; k++) {
        const a = base + i * per + k;
        const b = a + 1;
        const d = base + (i + 1) * per + k;
        const c = d + 1;
        acc.quadIdx(a, b, c, d, nx, ny, nz);
      }
    }
  }
  return acc.triangles - before;
}
