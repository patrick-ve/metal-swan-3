/**
 * WORLD's batcher (wave B; docs/api/rally.md "B.W"): the static scenery of the A10 — buildings,
 * trees, lamp posts, signs, landmarks — is built once in WORLD space (identity matrices) and cut
 * into square CELLS of the ground (`CELL` m). Each cell holds one mesh per LAYER (a texture page
 * and its draw state: lit façades, lit props, two-sided cut-outs, ground decals, the night's
 * windows and glows) and per level of detail (near / far). A view draws the cells whose box lies
 * within the fog's far end and in the frustum: few draws (batched per page, spec §7.3), no
 * allocation per frame.
 *
 * Setup code allocates freely (plain arrays, then typed arrays per mesh); `fill` allocates nothing.
 * Pure and deterministic (only + − × ÷, Math.sqrt / floor / min / max / abs; spec §12.4).
 */
import { Frustum } from '../../../../engine/r3/cull';
import type { Blend3, Cam3, DrawItem, Mesh3 } from '../../../../engine/view3d';

export type V3 = readonly [number, number, number];
/** A texture rectangle's corners in texels: u0, v0, u1, v1 (u0 v0 at the first corner). */
export type UV4 = readonly [number, number, number, number];
/** A vertex colour (0..255 per channel; 128 = the texture as painted). */
export type Rgb = readonly [number, number, number];

export const WHITE: Rgb = [128, 128, 128];

/** A layer: what one mesh per cell is drawn with. */
export interface LayerDef {
  readonly page: number;
  readonly blend?: Blend3;
  readonly twoSided?: boolean;
  readonly emissive?: boolean;
  /** Depth bias (decals on the ground, faces on a box). */
  readonly bias?: number;
  /** Store the normals (Gouraud light per face); false = baked shading (trees, glows). */
  readonly normals: boolean;
  /** Drawn only when the night's lamps glow (a glow level ≥ 0): the CLUT row of each level (−1: not yet). */
  readonly nightRows?: readonly number[];
  /** Not drawn beyond this distance from the camera (m; the glows' pools). */
  readonly maxDist?: number;
}

/** Which level of detail a primitive belongs to. */
export type Lod = 'both' | 'near' | 'far';

/** Geometry under construction. */
class Geo {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly rgb: number[] = [];
  readonly nrm: number[] = [];
  readonly idx: number[] = [];
  get verts(): number {
    return this.pos.length / 3;
  }
  get tris(): number {
    return this.idx.length / 3;
  }
}

/** A cell under construction. */
class CellAcc {
  x0 = Infinity;
  y0 = Infinity;
  z0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  z1 = -Infinity;
  /** layer → [near, far] geometry. */
  readonly geo = new Map<string, [Geo, Geo, boolean]>();
}

/** A finished cell: its box and its draw items. */
export interface WorldCell {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
  /** The bounding sphere (the frustum test). */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly r: number;
  readonly items: readonly CellItem[];
}

export interface CellItem {
  readonly item: DrawItem;
  readonly layer: LayerDef;
  /** 0 both levels, 1 near only, 2 far only. */
  readonly lod: 0 | 1 | 2;
  readonly tris: number;
}

/** The cells' side (m). */
export const CELL = 160;
/** Within this distance of a cell's box a view draws its near level (m). */
export const WORLD_LOD_NEAR = 150;

/**
 * A local frame on the ground: x to the right, y up, z forward (`yaw` as forward(yaw) = (sin, 0, cos);
 * right = (−cos, 0, sin), the track's convention). `p(lx, ly, lz)` is a world point.
 */
export class Frame {
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  readonly fx: number;
  readonly fz: number;
  readonly rx: number;
  readonly rz: number;
  constructor(ox: number, oy: number, oz: number, fx: number, fz: number) {
    this.ox = ox;
    this.oy = oy;
    this.oz = oz;
    const n = Math.sqrt(fx * fx + fz * fz) || 1;
    this.fx = fx / n;
    this.fz = fz / n;
    this.rx = -this.fz;
    this.rz = this.fx;
  }
  /** A frame at a point facing `f` (horizontal), or the track's frame (forward, right given). */
  static of(x: number, y: number, z: number, fx: number, fz: number): Frame {
    return new Frame(x, y, z, fx, fz);
  }
  p(lx: number, ly: number, lz: number): V3 {
    return [this.ox + this.rx * lx + this.fx * lz, this.oy + ly, this.oz + this.rz * lx + this.fz * lz];
  }
  /** A direction in world space (no translation). */
  d(lx: number, ly: number, lz: number): V3 {
    return [this.rx * lx + this.fx * lz, ly, this.rz * lx + this.fz * lz];
  }
  /** The same frame turned by `a` (the r3 tables' sin and cos of the angle given as sa, ca). */
  turned(sa: number, ca: number): Frame {
    // forward' = forward·cos + right·sin
    return new Frame(this.ox, this.oy, this.oz, this.fx * ca + this.rx * sa, this.fz * ca + this.rz * sa);
  }
  moved(lx: number, ly: number, lz: number): Frame {
    const q = this.p(lx, ly, lz);
    return new Frame(q[0], q[1], q[2], this.fx, this.fz);
  }
}

/** The faces of a box in a frame. */
export type BoxFace = 'top' | 'bottom' | 'right' | 'left' | 'front' | 'back';
export const SIDES: readonly BoxFace[] = ['right', 'left', 'front', 'back'];
export const SIDES_TOP: readonly BoxFace[] = ['top', 'right', 'left', 'front', 'back'];

/**
 * The batcher. `at(x, z)` picks the cell of an object (by its anchor); the primitives after it go
 * into that cell (the cell's box grows with every vertex).
 */
export class WorldBatch {
  private readonly cells = new Map<string, CellAcc>();
  private cur: CellAcc | null = null;
  readonly prefix: string;
  readonly layers: Readonly<Record<string, LayerDef>>;
  readonly cell: number;

  constructor(prefix: string, layers: Readonly<Record<string, LayerDef>>, cell = CELL) {
    this.prefix = prefix;
    this.layers = layers;
    this.cell = cell;
  }

  /** Put what follows into the cell of world point (x, z). */
  at(x: number, z: number): this {
    const ix = Math.floor(x / this.cell);
    const iz = Math.floor(z / this.cell);
    const key = `${ix}_${iz}`;
    let c = this.cells.get(key);
    if (!c) this.cells.set(key, (c = new CellAcc()));
    this.cur = c;
    return this;
  }

  private geos(layer: string, lod: Lod): Geo[] {
    const c = this.cur;
    if (!c) throw new Error('WorldBatch: at(x, z) first');
    if (!this.layers[layer]) throw new Error(`WorldBatch: no layer ${layer}`);
    let g = c.geo.get(layer);
    if (!g) c.geo.set(layer, (g = [new Geo(), new Geo(), false]));
    if (lod !== 'both') g[2] = true;
    return lod === 'both' ? [g[0], g[1]] : lod === 'near' ? [g[0]] : [g[1]];
  }

  private grow(p: V3): void {
    const c = this.cur!;
    if (p[0] < c.x0) c.x0 = p[0];
    if (p[0] > c.x1) c.x1 = p[0];
    if (p[1] < c.y0) c.y0 = p[1];
    if (p[1] > c.y1) c.y1 = p[1];
    if (p[2] < c.z0) c.z0 = p[2];
    if (p[2] > c.z1) c.z1 = p[2];
  }

  /**
   * A quad a-b-c-d (corners in order) with the texel rectangle `uv` (a → u0 v0, b → u1 v0, c → u1 v1,
   * d → u0 v1), a colour per quad, and `n` the side that faces out (the winding follows it; the
   * normal is stored when the layer keeps normals).
   */
  quad(layer: string, lod: Lod, a: V3, b: V3, c: V3, d: V3, uv: UV4, col: Rgb, n: V3): void {
    const [u0, v0, u1, v1] = uv;
    this.poly(layer, lod, [a, b, c, d], [u0, v0, u1, v0, u1, v1, u0, v1], col, n);
  }

  /** A triangle with its own uv (texels) per corner. */
  tri(layer: string, lod: Lod, a: V3, b: V3, c: V3, uv: readonly number[], col: Rgb, n: V3): void {
    this.poly(layer, lod, [a, b, c], uv, col, n);
  }

  /** A convex polygon (a fan from the first corner); uv: u, v per corner. */
  poly(layer: string, lod: Lod, pts: readonly V3[], uv: readonly number[], col: Rgb, n: V3): void {
    const L = this.layers[layer];
    for (const g of this.geos(layer, lod)) {
      const base = g.verts;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        g.pos.push(p[0], p[1], p[2]);
        g.uv.push(uv[i * 2], uv[i * 2 + 1]);
        g.rgb.push(col[0], col[1], col[2]);
        if (L.normals) g.nrm.push(n[0], n[1], n[2]);
      }
      const a = pts[0];
      for (let i = 1; i + 1 < pts.length; i++) {
        const b = pts[i], c = pts[i + 1];
        const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
        const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
        const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
        if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) g.idx.push(base, base + i, base + i + 1);
        else g.idx.push(base, base + i + 1, base + i);
      }
    }
    for (const p of pts) this.grow(p);
  }

  /**
   * A box in frame `fr`: x0..x1 (right), y0..y1 (up), z0..z1 (forward). `uv(face, w, h)` gives each
   * face's texel rectangle for its size in metres (w across, h up / along); `faces` the faces to emit.
   */
  box(layer: string, lod: Lod, fr: Frame, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, uv: (face: BoxFace, w: number, h: number) => UV4, col: Rgb, faces: readonly BoxFace[] = SIDES_TOP): void {
    const P = (x: number, y: number, z: number): V3 => fr.p(x, y, z);
    for (const f of faces) {
      switch (f) {
        case 'top':
          this.quad(layer, lod, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), uv(f, x1 - x0, z1 - z0), col, [0, 1, 0]);
          break;
        case 'bottom':
          this.quad(layer, lod, P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x0, y0, z0), uv(f, x1 - x0, z1 - z0), col, [0, -1, 0]);
          break;
        // The sides: the first corner is at the top (v grows down the face). Façades repeat, so the
        // u direction of a side does not matter; lettering uses `quad` with its own corners.
        case 'back':
          this.quad(layer, lod, P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0), uv(f, x1 - x0, y1 - y0), col, fr.d(0, 0, -1));
          break;
        case 'front':
          this.quad(layer, lod, P(x1, y1, z1), P(x0, y1, z1), P(x0, y0, z1), P(x1, y0, z1), uv(f, x1 - x0, y1 - y0), col, fr.d(0, 0, 1));
          break;
        case 'right':
          this.quad(layer, lod, P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0), uv(f, z1 - z0, y1 - y0), col, fr.d(1, 0, 0));
          break;
        case 'left':
          this.quad(layer, lod, P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), uv(f, z1 - z0, y1 - y0), col, fr.d(-1, 0, 0));
          break;
      }
    }
  }

  /** Triangles so far per layer (tests, the budget notes). */
  triangles(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.cells.values()) for (const [k, [n, f]] of c.geo) out[k] = (out[k] ?? 0) + Math.max(n.tris, f.tris);
    return out;
  }

  /** Build the meshes and the cells (ids `<prefix>/<ix>_<iz>/<layer>[/far]`). */
  build(): { meshes: Mesh3[]; cells: WorldCell[] } {
    const meshes: Mesh3[] = [];
    const cells: WorldCell[] = [];
    const keys = [...this.cells.keys()].sort();
    for (const key of keys) {
      const c = this.cells.get(key)!;
      if (c.x0 > c.x1) continue;
      const items: CellItem[] = [];
      for (const [name, [near, far, split]] of c.geo) {
        const L = this.layers[name];
        const id = `${this.prefix}/${key}/${name}`;
        if (!split) {
          if (near.tris === 0) continue;
          meshes.push(toMesh(id, near, L));
          items.push({ item: { mesh: id, m: null }, layer: L, lod: 0, tris: near.tris });
        } else {
          if (near.tris > 0) {
            meshes.push(toMesh(id, near, L));
            items.push({ item: { mesh: id, m: null }, layer: L, lod: 1, tris: near.tris });
          }
          if (far.tris > 0) {
            meshes.push(toMesh(id + '/far', far, L));
            items.push({ item: { mesh: id + '/far', m: null }, layer: L, lod: 2, tris: far.tris });
          }
        }
      }
      if (items.length === 0) continue;
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, cz = (c.z0 + c.z1) / 2;
      const hx = (c.x1 - c.x0) / 2, hy = (c.y1 - c.y0) / 2, hz = (c.z1 - c.z0) / 2;
      cells.push({ x0: c.x0, z0: c.z0, x1: c.x1, z1: c.z1, y0: c.y0, y1: c.y1, cx, cy, cz, r: Math.sqrt(hx * hx + hy * hy + hz * hz), items });
    }
    return { meshes, cells };
  }
}

function toMesh(id: string, g: Geo, L: LayerDef): Mesh3 {
  const n = g.verts;
  return {
    id,
    pos: Float32Array.from(g.pos),
    uv: Float32Array.from(g.uv),
    rgb: Uint8Array.from(g.rgb),
    ...(L.normals ? { nrm: Float32Array.from(g.nrm) } : {}),
    idx: n > 65535 ? Uint32Array.from(g.idx) : Uint16Array.from(g.idx),
    page: L.page,
    clutRow: 0,
    blend: L.blend ?? 'opaque',
    ...(L.twoSided ? { twoSided: true } : {}),
    ...(L.emissive ? { emissive: true } : {}),
    ...(L.bias ? { bias: L.bias } : {}),
  };
}

/** The distance from a point to a cell's box on the ground (m; 0 inside). */
export function cellDist(c: WorldCell, x: number, z: number): number {
  const dx = x < c.x0 ? c.x0 - x : x > c.x1 ? x - c.x1 : 0;
  const dz = z < c.z0 ? c.z0 - z : z > c.z1 ? z - c.z1 : 0;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Per-view culling of a set of cells: within `far` of the camera (the box), in the frustum (the
 * sphere); the near level within `WORLD_LOD_NEAR`; the night layers only at a glow `level` ≥ 0
 * (their CLUT row is set to the level's). Writes the items into `out` from `k`; returns the new
 * count. No allocation.
 */
export class CellCuller {
  private readonly fr = new Frustum();
  /** Triangles and draws of the last fill (tests, the budget). */
  tris = 0;
  draws = 0;

  fill(cells: readonly WorldCell[], cam: Readonly<Cam3>, aspect: number, far: number, level: number, out: DrawItem[], k: number, lodNear = WORLD_LOD_NEAR): number {
    this.fr.set(cam, aspect, far);
    const x = cam.pos[0];
    const z = cam.pos[2];
    let tris = 0;
    const k0 = k;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const d = cellDist(c, x, z);
      if (d > far) continue;
      if (!this.fr.sphere(c.cx, c.cy, c.cz, c.r)) continue;
      const near = d < lodNear;
      const items = c.items;
      for (let j = 0; j < items.length; j++) {
        const ci = items[j];
        if (ci.lod === 1 && !near) continue;
        if (ci.lod === 2 && near) continue;
        const L = ci.layer;
        const rows = L.nightRows;
        if (rows) {
          if (level < 0) continue;
          const row = rows[level < rows.length ? level : rows.length - 1];
          if (row < 0) continue;
          ci.item.clutRow = row;
        }
        if (L.maxDist !== undefined && d > L.maxDist) continue;
        out[k++] = ci.item;
        tris += ci.tris;
      }
    }
    this.tris = tris;
    this.draws = k - k0;
    return k;
  }
}
