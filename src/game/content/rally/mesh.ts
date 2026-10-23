/**
 * A small mesh builder for the rally content — PREP's helper for the wave-A stubs (the stub oval,
 * the box cars). TRACK and CARS may use it or write their own builders (in `src/engine/r3/` or
 * their folders). Setup code: it allocates freely; the result is a `Mesh3` (engine/view3d.ts).
 *
 * `quad(a, b, c, d, …)` takes the corners in order around the face and fixes the winding so the
 * face's front (counter-clockwise, the GL default) points along `n` (the face normal).
 */
import type { Blend3, Mesh3 } from '../../../engine/view3d';

export type P3 = readonly [number, number, number];
/** A texture rectangle's corners in texels: u0, v0, u1, v1. */
export type UV4 = readonly [number, number, number, number];

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly uv: number[] = [];
  private readonly rgb: number[] = [];
  private readonly nrm: number[] = [];
  private readonly idx: number[] = [];

  /** Vertices so far. */
  get vertices(): number {
    return this.pos.length / 3;
  }

  /** Triangles so far. */
  get triangles(): number {
    return this.idx.length / 3;
  }

  /** Add a vertex: position, texel uv, colour (128 = the texture as painted), normal. Returns its index. */
  vertex(p: P3, u: number, v: number, c: P3, n: P3): number {
    this.pos.push(p[0], p[1], p[2]);
    this.uv.push(u, v);
    this.rgb.push(c[0], c[1], c[2]);
    this.nrm.push(n[0], n[1], n[2]);
    return this.pos.length / 3 - 1;
  }

  /** A triangle of three vertex indices (counter-clockwise = front). */
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /**
   * A quad a-b-c-d (corners in order around it) with the texture rectangle `uv` (a → u0 v0,
   * b → u1 v0, c → u1 v1, d → u0 v1), the colour `c` and the normal `n` (the front side).
   */
  quad(a: P3, b: P3, c: P3, d: P3, uv: UV4, col: P3, n: P3): void {
    const [u0, v0, u1, v1] = uv;
    const ia = this.vertex(a, u0, v0, col, n);
    const ib = this.vertex(b, u1, v0, col, n);
    const ic = this.vertex(c, u1, v1, col, n);
    const id = this.vertex(d, u0, v1, col, n);
    // The winding: (b − a) × (c − a) must point along n.
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) {
      this.tri(ia, ib, ic);
      this.tri(ia, ic, id);
    } else {
      this.tri(ia, ic, ib);
      this.tri(ia, id, ic);
    }
  }

  /**
   * An axis-aligned box (x0..x1, y0..y1, z0..z1) with outward faces; `uv(face)` gives each face's
   * texture rectangle (faces: 'top', 'bottom', 'left' (+x), 'right' (−x), 'front' (+z), 'back' (−z)).
   * `skipBottom` leaves the bottom out.
   */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, uv: (face: BoxFace) => UV4, col: P3, skipBottom = true): void {
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], uv('top'), col, [0, 1, 0]);
    if (!skipBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], uv('bottom'), col, [0, -1, 0]);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], uv('left'), col, [1, 0, 0]);
    this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], uv('right'), col, [-1, 0, 0]);
    this.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], uv('front'), col, [0, 0, 1]);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], uv('back'), col, [0, 0, -1]);
  }

  build(id: string, page: number, clutRow: number, o: { blend?: Blend3; twoSided?: boolean; emissive?: boolean } = {}): Mesh3 {
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
      twoSided: o.twoSided,
      emissive: o.emissive,
    };
  }
}

export type BoxFace = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
