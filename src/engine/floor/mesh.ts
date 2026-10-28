/**
 * The floor's height field and its mesh (docs/design/floor.md §1.2, §3.3). Pure, built once per
 * section (no per-frame work here).
 *
 * The height field h(u, v), world px:
 * - the WALK PROFILE: on every depth row the height of the physics walk surface at u
 *   (`yw − groundY(u)`, from the terrain's ground segments: the cylinder rule, so a bridge's hump
 *   runs across the whole band); gaps between ground lines become a PIT (a deep cut, `pit`);
 * - REGIONS on top, later ones win: a u range × a v range (lines that may bend: [u, v] points) whose
 *   surface is the walk profile plus `dh` (kerbs, pavements, steps) or an absolute `level` (water
 *   cuts, the pool), drawn with the chunk painter or a tile material (`surface`);
 * - VERTICAL FACES wherever two neighbouring cells differ in height: along a depth line (facing the
 *   camera only: a face that looks away from the eye is never seen and is not built) and at a u
 *   breakpoint (facing +u or −u: the renderer culls the one that looks away from the eye). A face
 *   takes the `face` material of the later region of its two cells (the base: `baseFace`).
 *
 * The mesh is exact, not sampled: between two u breakpoints (profile vertices, region ends, bends,
 * chunk bounds, line crossings, and at most `MESH_MAX_SPAN` apart) every cell is planar, so a
 * perspective-correct raster draws the true surface. Quads are sorted by u for the per-frame cull.
 *
 * WATERTIGHT: no vertex lies inside another quad's edge (no T-junction). Where a region ends, one
 * side of a u breakpoint has lines the other side has not; the weld puts every vertex that lies on a
 * quad's edge at a constant u into that edge (cells, faces along v and faces at u alike) and splits
 * the quad into a strip of triangles between its two constant-u edges. So every edge is shared by
 * exactly the same two vertices, and a GPU's sub-pixel vertex snap cannot open a crack. A quad
 * without such a vertex stays the one quad it was (a mesh without T-junctions is unchanged).
 */
import { CHUNK_U } from './tex-layout';

/** A depth line: a constant world v, or [u, v] points (linear between, constant beyond the ends). */
export type FieldLine = number | readonly (readonly [number, number])[];

/** One region of the height field (engine form; the game's FloorDef features compile to these). */
export interface FieldRegion {
  /** u range [u0, u1) (world px; ±Infinity allowed). */
  readonly u0: number;
  readonly u1: number;
  /** v range [v0, v1) (far line, near line; world v), clipped to the band. */
  readonly v0: FieldLine;
  readonly v1: FieldLine;
  /** Height: the walk profile + `dh` (default 0), or the absolute `level` when given. */
  readonly dh?: number;
  readonly level?: number;
  /** Top material: -1 = the chunk painter, ≥ 0 = a tile material index. */
  readonly surface: number;
  /** Material of the faces this region makes (-1 = the base face). */
  readonly face: number;
}

/** A ground segment of the walk profile (world x, world y). */
export interface FieldSegment {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface FieldInput {
  /** Ground segments (the terrain's ground polylines, any order; vertical segments are ignored). */
  readonly segments: readonly FieldSegment[];
  /** The walk line of flat ground (h = yw − world y). */
  readonly yw: number;
  /** u range of the mesh (the section ± a margin: the back rows see wider than the screen). */
  readonly uMin: number;
  readonly uMax: number;
  /** v range of the mesh (the camera's vBack … vFront). */
  readonly vBack: number;
  readonly vFront: number;
  readonly regions: readonly FieldRegion[];
  /** Face material between two base cells (a step in the profile) and default face (-1 = none: no face). */
  readonly baseFace: number;
  /** The pit under a gap of the profile: its level, top material and wall material. */
  readonly pit: { readonly level: number; readonly surface: number; readonly face: number };
}

/** Quad kinds (`FloorMesh.quadKind`). */
export const QUAD_TOP = 0;
/** A face along a depth line, facing the camera (+v). */
export const QUAD_FACE_V = 1;
/** A face at a u breakpoint facing +u (seen while the eye's u > its u) / facing −u. */
export const QUAD_FACE_UP = 2;
export const QUAD_FACE_UN = 3;

/** Largest u span of one quad (the grid; also keeps the GPU's interpolation short). */
export const MESH_MAX_SPAN = 64;

/** Least u gap between a line crossing and another breakpoint (world px; no sliver quads). */
export const MESH_MIN_GAP = 0.5;

/** Serial of mesh builds (the GPU's upload key). */
let meshSerial = 0;

/**
 * The floor mesh: quads of 4 vertices (two triangles 0-1-2 and 0-2-3), world coordinates and world
 * texture coordinates. Tops: (ta, tb) = (u, v). Faces: ta = along the face (u for a +v face, v for a
 * u face), tb = px below the face's top edge (0 at the top). Edge 0 → 3 and edge 1 → 2 each lie at
 * one u (a top: far → near at its u0 and u1). A welded triangle is a quad with one corner repeated
 * (1 = 2 or 3 = 0: one triangle has no area and draws nothing), so 0 → 1 stays the far edge and
 * 3 → 2 the near edge of what it covers.
 */
export interface FloorMesh {
  /** Unique per build (a GPU uploads a mesh once per id). */
  readonly id: number;
  readonly vertexCount: number;
  readonly quadCount: number;
  /** Vertex positions: world u, v, h. */
  readonly pu: Float32Array;
  readonly pv: Float32Array;
  readonly ph: Float32Array;
  /** Vertex texture coordinates (world px, see above). */
  readonly ta: Float32Array;
  readonly tb: Float32Array;
  /** 4 vertex indices per quad. */
  readonly quads: Uint32Array;
  /** Quad material: -1 = the chunk painter (tops only), ≥ 0 = a tile material index. */
  readonly quadMat: Int16Array;
  /** QUAD_TOP, QUAD_FACE_V, QUAD_FACE_UP or QUAD_FACE_UN. */
  readonly quadKind: Uint8Array;
  /** The texture chunk of a chunk-painted top quad (floor(u / CHUNK_U)), else -1. */
  readonly quadChunk: Int32Array;
  /** u extent of each quad; quads are sorted by `quadU0` (non-decreasing). */
  readonly quadU0: Float32Array;
  readonly quadU1: Float32Array;
  /** Height range of the whole mesh (the band's top follows hMax). */
  readonly hMin: number;
  readonly hMax: number;
  readonly uMin: number;
  readonly uMax: number;
  readonly vBack: number;
  readonly vFront: number;
}

// ------------------------------------------------------------------------------- field queries

/** Value of a depth line at u. */
export function lineAt(l: FieldLine, u: number): number {
  if (typeof l === 'number') return l;
  const n = l.length;
  if (n === 0) return 0;
  if (u <= l[0][0]) return l[0][1];
  if (u >= l[n - 1][0]) return l[n - 1][1];
  for (let i = 1; i < n; i++) {
    const [x1, y1] = l[i];
    if (u <= x1) {
      const [x0, y0] = l[i - 1];
      return x1 === x0 ? y1 : y0 + ((u - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  return l[n - 1][1];
}

/** The topmost ground segment over u (null = a gap). Half-open [x0, x1), like Terrain.groundY. */
export function segmentAt(segs: readonly FieldSegment[], u: number): FieldSegment | null {
  let best: FieldSegment | null = null;
  let by = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (u < s.x0 || u >= s.x1) continue;
    const y = s.y0 + ((u - s.x0) * (s.y1 - s.y0)) / (s.x1 - s.x0);
    if (y < by) {
      by = y;
      best = s;
    }
  }
  return best;
}

function segY(s: FieldSegment, u: number): number {
  return s.y0 + ((u - s.x0) * (s.y1 - s.y0)) / (s.x1 - s.x0);
}

/**
 * The cell rule at (u, v): the index of the winning region, -1 = the walk profile, -2 = the pit
 * under a gap of the profile. Over a gap only a region with an absolute `level` (a cut, a deck at a
 * level) applies: a `dh` region has no profile to stand on there.
 */
export function regionIndexAt(f: FieldInput, u: number, v: number): number {
  const rs = f.regions;
  const gap = segmentAt(f.segments, u) === null;
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i];
    if (u < r.u0 || u >= r.u1) continue;
    if (gap && r.level === undefined) continue;
    if (v < lineAt(r.v0, u) || v >= lineAt(r.v1, u)) continue;
    return i;
  }
  return gap ? -2 : -1;
}

/** The walk profile's height at u (the edge value beyond the ground; NaN over a gap). */
export function profileAt(f: FieldInput, u: number): number {
  const s = segmentAt(f.segments, u);
  return s ? f.yw - segY(s, u) : NaN;
}

/** h(u, v) of the height field (exact: the same rule the mesh is built from). */
export function heightAt(f: FieldInput, u: number, v: number): number {
  const k = regionIndexAt(f, u, v);
  if (k === -2) return f.pit.level;
  const base = k >= 0 && f.regions[k].level !== undefined ? 0 : profileAt(f, u);
  if (k < 0) return base;
  const r = f.regions[k];
  return r.level !== undefined ? r.level : base + (r.dh ?? 0);
}

// ------------------------------------------------------------------------------- mesh build

interface Cell {
  /** Line values at ua and ub (far and near). */
  fa: number;
  fb: number;
  na: number;
  nb: number;
  /** Heights at ua and ub. */
  ha: number;
  hb: number;
  /** Region index (-1 base, -2 pit). */
  k: number;
}

/** Floats per proto-quad vertex: u, v, h, ta, tb. */
const PV = 5;

/**
 * The quads before the weld (`proto`), then the mesh's arrays (`weld`): every proto-quad keeps its
 * place in the order (u-sorted), and one without a T vertex is emitted exactly as it was built.
 */
class MeshBuilder {
  pu: number[] = [];
  pv: number[] = [];
  ph: number[] = [];
  ta: number[] = [];
  tb: number[] = [];
  quads: number[] = [];
  mat: number[] = [];
  kind: number[] = [];
  chunk: number[] = [];
  u0: number[] = [];
  u1: number[] = [];
  hMin = Infinity;
  hMax = -Infinity;
  /** Proto-quads: 4 × PV floats each, and their quad data. */
  private readonly pp: number[] = [];
  private readonly pq: number[] = [];

  vert(u: number, v: number, h: number, a: number, b: number): number {
    this.pu.push(u);
    this.pv.push(v);
    this.ph.push(h);
    this.ta.push(a);
    this.tb.push(b);
    if (h < this.hMin) this.hMin = h;
    if (h > this.hMax) this.hMax = h;
    return this.pu.length - 1;
  }

  quad(i0: number, i1: number, i2: number, i3: number, mat: number, kind: number, chunk: number, u0: number, u1: number): void {
    this.quads.push(i0, i1, i2, i3);
    this.mat.push(mat);
    this.kind.push(kind);
    this.chunk.push(chunk);
    this.u0.push(u0);
    this.u1.push(u1);
  }

  /** A proto-vertex (u, v, h, ta, tb); four of them, then `proto`. */
  pvert(u: number, v: number, h: number, a: number, b: number): void {
    this.pp.push(u, v, h, a, b);
  }

  /** Close the proto-quad of the last four `pvert`s (0 → 3 and 1 → 2 at one u each). */
  proto(mat: number, kind: number, chunk: number, u0: number, u1: number): void {
    this.pq.push(mat, kind, chunk, u0, u1);
  }

  /** Emit every proto-quad, split at the vertices that lie inside its two constant-u edges. */
  weld(): void {
    const pp = this.pp;
    const n = this.pq.length / 5;
    // The nodes of every u line: the (v, h) of each proto-vertex there.
    const nodes = new Map<number, number[]>();
    for (let i = 0; i < pp.length; i += PV) {
      const u = pp[i];
      let l = nodes.get(u);
      if (!l) nodes.set(u, (l = []));
      l.push(pp[i + 1], pp[i + 2]);
    }
    const left: number[] = [];
    const right: number[] = [];
    for (let q = 0; q < n; q++) {
      const o = q * 4 * PV;
      const pq = q * 5;
      chainOf(pp, o, o + 3 * PV, nodes, left);
      chainOf(pp, o + PV, o + 2 * PV, nodes, right);
      if (left.length === 2 * CH && right.length === 2 * CH) {
        // No T vertex: the quad as it was built.
        const i0 = this.vert(pp[o], pp[o + 1], pp[o + 2], pp[o + 3], pp[o + 4]);
        const i1 = this.vert(pp[o + 5], pp[o + 6], pp[o + 7], pp[o + 8], pp[o + 9]);
        const i2 = this.vert(pp[o + 10], pp[o + 11], pp[o + 12], pp[o + 13], pp[o + 14]);
        const i3 = this.vert(pp[o + 15], pp[o + 16], pp[o + 17], pp[o + 18], pp[o + 19]);
        this.quad(i0, i1, i2, i3, this.pq[pq], this.pq[pq + 1], this.pq[pq + 2], this.pq[pq + 3], this.pq[pq + 4]);
        continue;
      }
      this.strip(left, right, this.pq[pq], this.pq[pq + 1], this.pq[pq + 2], this.pq[pq + 3], this.pq[pq + 4]);
    }
  }

  /**
   * The strip between two chains (each from the quad's far / top end to its near / bottom end, with
   * their parameters 0 … 1): quads where both chains step together, else triangles (a quad with one
   * corner repeated), as a ladder that always steps the chain whose next point comes first.
   */
  private strip(L: readonly number[], R: readonly number[], mat: number, kind: number, chunk: number, u0: number, u1: number): void {
    const nl = L.length / CH - 1;
    const nr = R.length / CH - 1;
    let i = 0;
    let j = 0;
    while (i < nl || j < nr) {
      const tl = i < nl ? L[(i + 1) * CH + 5] : Infinity;
      const tr = j < nr ? R[(j + 1) * CH + 5] : Infinity;
      const a = this.cvert(L, i);
      const b = this.cvert(R, j);
      if (Math.abs(tl - tr) < 1e-9) {
        // Both chains step: a quad (far-left, far-right, near-right, near-left).
        const c = this.cvert(R, j + 1);
        const d = this.cvert(L, i + 1);
        this.quad(a, b, c, d, mat, kind, chunk, u0, u1);
        i++;
        j++;
      } else if (tl < tr) {
        // The left chain steps: triangle (L i, R j, L i+1) as (a, b, b, d).
        const d = this.cvert(L, i + 1);
        this.quad(a, b, b, d, mat, kind, chunk, u0, u1);
        i++;
      } else {
        // The right chain steps: triangle (L i, R j, R j+1) as (a, b, c, a).
        const c = this.cvert(R, j + 1);
        this.quad(a, b, c, a, mat, kind, chunk, u0, u1);
        j++;
      }
    }
  }

  /** Vertex of chain point k (CH floats: u, v, h, ta, tb, t). */
  private cvert(c: readonly number[], k: number): number {
    const o = k * CH;
    return this.vert(c[o], c[o + 1], c[o + 2], c[o + 3], c[o + 4]);
  }
}

/** Floats per chain point: u, v, h, ta, tb and its parameter t along the edge (0 … 1). */
const CH = 6;

/**
 * The chain of the proto-edge from vertex a to vertex b (offsets into `pp`, both at one u): a, every
 * node of that u line strictly inside the segment (in order), b. A node's position is copied as it
 * is (so it equals its own quad's vertex bit for bit); its texture coordinates are the edge's at it.
 */
function chainOf(pp: readonly number[], a: number, b: number, nodes: ReadonlyMap<number, readonly number[]>, out: number[]): void {
  out.length = 0;
  const u = pp[a];
  const va = pp[a + 1];
  const ha = pp[a + 2];
  const dv = pp[b + 1] - va;
  const dh = pp[b + 2] - ha;
  out.push(u, va, ha, pp[a + 3], pp[a + 4], 0);
  const len2 = dv * dv + dh * dh;
  const l = u === pp[b] && len2 > 1e-12 ? nodes.get(u) : undefined;
  if (l) {
    const len = Math.sqrt(len2);
    for (let k = 0; k < l.length; k += 2) {
      const nv = l[k];
      const nh = l[k + 1];
      const ev = nv - va;
      const eh = nh - ha;
      // On the segment's line (distance < 1e-6 px) and strictly between its ends.
      if (Math.abs(ev * dh - eh * dv) > 1e-6 * len) continue;
      const t = (ev * dv + eh * dh) / len2;
      if (t * len < 1e-6 || (1 - t) * len < 1e-6) continue;
      // Once per position (many quads share a node).
      let dup = false;
      for (let m = CH; m < out.length; m += CH) {
        if (Math.abs(out[m + 1] - nv) < 1e-6 && Math.abs(out[m + 2] - nh) < 1e-6) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      out.push(u, nv, nh, pp[a + 3] + (pp[b + 3] - pp[a + 3]) * t, pp[a + 4] + (pp[b + 4] - pp[a + 4]) * t, t);
    }
  }
  out.push(pp[b], pp[b + 1], pp[b + 2], pp[b + 3], pp[b + 4], 1);
  if (out.length > 2 * CH) sortChain(out);
}

/** Sort the inner points of a chain by t (insertion sort: a handful of points). */
function sortChain(c: number[]): void {
  const n = c.length / CH;
  for (let i = 2; i < n - 1; i++) {
    for (let j = i; j > 1 && c[j * CH + 5] < c[(j - 1) * CH + 5]; j--) {
      for (let k = 0; k < CH; k++) {
        const t = c[j * CH + k];
        c[j * CH + k] = c[(j - 1) * CH + k];
        c[(j - 1) * CH + k] = t;
      }
    }
  }
}

function lineBreaks(l: FieldLine, out: number[]): void {
  if (typeof l === 'number') return;
  for (const [u] of l) out.push(u);
}

/** The region whose face a step between cells of regions a and b shows: a pit's walls are the pit's, else the later region's. */
function faceOwner(a: number, b: number): number {
  return a === -2 || b === -2 ? -2 : Math.max(a, b);
}

/** Region index → its material for faces. */
function faceMat(f: FieldInput, k: number): number {
  if (k === -2) return f.pit.face;
  if (k < 0) return f.baseFace;
  const m = f.regions[k].face;
  return m >= 0 ? m : f.baseFace;
}

function surfaceMat(f: FieldInput, k: number): number {
  if (k === -2) return f.pit.surface;
  if (k < 0) return -1;
  return f.regions[k].surface;
}

/** Build the mesh of a height field (once per section). */
export function buildFloorMesh(f: FieldInput): FloorMesh {
  const { uMin, uMax, vBack, vFront } = f;
  // 1. u breakpoints.
  const br: number[] = [uMin, uMax];
  for (const s of f.segments) br.push(s.x0, s.x1);
  for (const r of f.regions) {
    br.push(r.u0, r.u1);
    lineBreaks(r.v0, br);
    lineBreaks(r.v1, br);
  }
  // (+ 0: no −0 breakpoint.)
  for (let u = Math.ceil(uMin / CHUNK_U) * CHUNK_U + 0; u < uMax; u += CHUNK_U) br.push(u);
  let us = sortedBreaks(br, uMin, uMax);
  // Line crossings inside an interval become breakpoints too (cells must stay planar quads).
  const lines: FieldLine[] = [];
  for (const r of f.regions) lines.push(r.v0, r.v1);
  const extra: number[] = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const a = us[i];
    const b = us[i + 1];
    for (let p = 0; p < lines.length; p++) {
      if (typeof lines[p] === 'number') continue;
      for (let q = 0; q < lines.length; q++) {
        if (q === p) continue;
        const da = lineAt(lines[p], a) - lineAt(lines[q], a);
        const db = lineAt(lines[p], b) - lineAt(lines[q], b);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) extra.push(a + ((b - a) * da) / (da - db));
      }
    }
  }
  // A crossing within MESH_MIN_GAP of another breakpoint is left out (the cells clamp the two lines
  // at that end, `cellsOf`): a sliver quad a fraction of a pixel wide folds under a GPU's vertex snap.
  if (extra.length) {
    const keep: number[] = [];
    for (const u of extra.sort((a, b) => a - b)) {
      if (keep.length && u - keep[keep.length - 1] < MESH_MIN_GAP) continue;
      if (nearBreak(us, u) < MESH_MIN_GAP) continue;
      keep.push(u);
    }
    if (keep.length) us = sortedBreaks([...us, ...keep], uMin, uMax);
  }
  // The grid: no quad wider than MESH_MAX_SPAN.
  const grid: number[] = [us[0]];
  for (let i = 1; i < us.length; i++) {
    const a = grid[grid.length - 1];
    const b = us[i];
    const n = Math.ceil((b - a) / MESH_MAX_SPAN - 1e-9);
    for (let k = 1; k < n; k++) grid.push(a + ((b - a) * k) / n);
    grid.push(b);
  }

  const m = new MeshBuilder();
  let prev: Cell[] | null = null;
  let prevB = NaN;
  for (let i = 0; i + 1 < grid.length; i++) {
    const ua = grid[i];
    const ub = grid[i + 1];
    if (ub - ua < 1e-6) continue;
    const cells = cellsOf(f, ua, ub);
    const chunk = Math.floor(((ua + ub) / 2) / CHUNK_U);
    // Faces at u = ua between the previous interval's cells and these.
    if (prev && Math.abs(prevB - ua) < 1e-6) uFaces(f, m, prev, cells, ua);
    for (let c = 0; c < cells.length; c++) {
      const cl = cells[c];
      const mat = surfaceMat(f, cl.k);
      m.pvert(ua, cl.fa, cl.ha, ua, cl.fa);
      m.pvert(ub, cl.fb, cl.hb, ub, cl.fb);
      m.pvert(ub, cl.nb, cl.hb, ub, cl.nb);
      m.pvert(ua, cl.na, cl.ha, ua, cl.na);
      m.proto(mat, QUAD_TOP, mat < 0 ? chunk : -1, ua, ub);
      // The face along the near line of this cell, when the cell in front of it is lower.
      if (c + 1 < cells.length) {
        const nx = cells[c + 1];
        const ta = cl.ha - nx.ha;
        const tb = cl.hb - nx.hb;
        if (ta > 1e-6 || tb > 1e-6) {
          const fm = faceMat(f, faceOwner(cl.k, nx.k));
          if (fm >= 0) {
            // Top edge = this cell's near edge; bottom edge = the lower cell's far edge (clamped).
            const hta = cl.ha;
            const htb = cl.hb;
            const hba = Math.min(nx.ha, hta);
            const hbb = Math.min(nx.hb, htb);
            m.pvert(ua, cl.na, hta, ua, 0);
            m.pvert(ub, cl.nb, htb, ub, 0);
            m.pvert(ub, cl.nb, hbb, ub, htb - hbb);
            m.pvert(ua, cl.na, hba, ua, hta - hba);
            m.proto(fm, QUAD_FACE_V, -1, ua, ub);
          }
        }
      }
    }
    prev = cells;
    prevB = ub;
  }
  m.weld();

  const fa = (a: number[]): Float32Array => Float32Array.from(a);
  return {
    id: ++meshSerial,
    vertexCount: m.pu.length,
    quadCount: m.mat.length,
    pu: fa(m.pu),
    pv: fa(m.pv),
    ph: fa(m.ph),
    ta: fa(m.ta),
    tb: fa(m.tb),
    quads: Uint32Array.from(m.quads),
    quadMat: Int16Array.from(m.mat),
    quadKind: Uint8Array.from(m.kind),
    quadChunk: Int32Array.from(m.chunk),
    quadU0: fa(m.u0),
    quadU1: fa(m.u1),
    hMin: Number.isFinite(m.hMin) ? m.hMin : 0,
    hMax: Number.isFinite(m.hMax) ? m.hMax : 0,
    uMin,
    uMax,
    vBack,
    vFront,
  };
}

/** Distance from u to the nearest value of the sorted list `us`. */
function nearBreak(us: readonly number[], u: number): number {
  let lo = 0;
  let hi = us.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (us[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  let d = Infinity;
  if (lo < us.length) d = us[lo] - u;
  if (lo > 0) d = Math.min(d, u - us[lo - 1]);
  return d;
}

function sortedBreaks(br: number[], lo: number, hi: number): number[] {
  const s = br.filter((u) => Number.isFinite(u) && u >= lo && u <= hi).sort((a, b) => a - b);
  const out: number[] = [];
  for (const u of s) if (out.length === 0 || u - out[out.length - 1] > 1e-6) out.push(u);
  return out;
}

/** The cells of the interval [ua, ub], far to near, with their heights at both ends. */
function cellsOf(f: FieldInput, ua: number, ub: number): Cell[] {
  const um = (ua + ub) / 2;
  // Every line that matters here (band edges + region lines of regions that cover this interval).
  const ls: FieldLine[] = [f.vBack, f.vFront];
  for (const r of f.regions) {
    if (r.u1 <= ua || r.u0 >= ub) continue;
    ls.push(r.v0, r.v1);
  }
  const vals = ls
    .map((l) => ({ l, a: lineAt(l, ua), b: lineAt(l, ub), m: lineAt(l, um) }))
    .filter((x) => x.m >= f.vBack - 1e-9 && x.m <= f.vFront + 1e-9)
    .sort((p, q) => p.m - q.m);
  const uniq: typeof vals = [];
  for (const x of vals) if (uniq.length === 0 || x.m - uniq[uniq.length - 1].m > 1e-6) uniq.push(x);
  // Two lines that cross close to an end of the interval (their crossing left out: MESH_MIN_GAP)
  // keep their order at both ends: a line never lies in front of the next one there.
  for (let i = 1; i < uniq.length; i++) {
    const p = uniq[i - 1];
    const x = uniq[i];
    if (x.a < p.a || x.b < p.b) uniq[i] = { l: x.l, a: Math.max(x.a, p.a), b: Math.max(x.b, p.b), m: x.m };
  }
  const seg = segmentAt(f.segments, um);
  const cells: Cell[] = [];
  for (let i = 0; i + 1 < uniq.length; i++) {
    const far = uniq[i];
    const near = uniq[i + 1];
    const fa = Math.max(f.vBack, Math.min(f.vFront, far.a));
    const fb = Math.max(f.vBack, Math.min(f.vFront, far.b));
    const na = Math.max(f.vBack, Math.min(f.vFront, near.a));
    const nb = Math.max(f.vBack, Math.min(f.vFront, near.b));
    const k = regionIndexAt(f, um, (far.m + near.m) / 2);
    let ha: number;
    let hb: number;
    if (k === -2) {
      ha = hb = f.pit.level;
    } else if (k >= 0 && f.regions[k].level !== undefined) {
      ha = hb = f.regions[k].level as number;
    } else {
      // The walk profile (the segment over the middle covers the whole interval: its ends are breakpoints).
      const ba = seg ? f.yw - segY(seg, ua) : f.pit.level;
      const bb = seg ? f.yw - segY(seg, ub) : f.pit.level;
      const dh = k >= 0 ? (f.regions[k].dh ?? 0) : 0;
      ha = ba + dh;
      hb = bb + dh;
    }
    cells.push({ fa, fb, na, nb, ha, hb, k });
  }
  return cells;
}

/** Faces at the breakpoint u between the cells left (their ub end) and right (their ua end). */
function uFaces(f: FieldInput, m: MeshBuilder, left: readonly Cell[], right: readonly Cell[], u: number): void {
  // Split [vBack, vFront] by the cell lines of both sides; compare the heights in each piece.
  const cuts: number[] = [];
  for (const c of left) cuts.push(c.fb, c.nb);
  for (const c of right) cuts.push(c.fa, c.na);
  const vs = sortedBreaks(cuts, f.vBack, f.vFront);
  for (let i = 0; i + 1 < vs.length; i++) {
    const va = vs[i];
    const vb = vs[i + 1];
    const vm = (va + vb) / 2;
    const l = left.find((c) => vm >= c.fb && vm < c.nb);
    const r = right.find((c) => vm >= c.fa && vm < c.na);
    if (!l || !r) continue;
    const hl = l.hb;
    const hr = r.ha;
    if (Math.abs(hl - hr) < 1e-6) continue;
    const top = Math.max(hl, hr);
    const bot = Math.min(hl, hr);
    const fm = faceMat(f, faceOwner(l.k, r.k));
    if (fm < 0) continue;
    // The higher side's wall looks toward the lower side.
    const kind = hl > hr ? QUAD_FACE_UP : QUAD_FACE_UN;
    m.pvert(u, va, top, va, 0);
    m.pvert(u, vb, top, vb, 0);
    m.pvert(u, vb, bot, vb, top - bot);
    m.pvert(u, va, bot, va, top - bot);
    m.proto(fm, kind, -1, u, u);
  }
}

/** Index of the first quad whose u1 ≥ u (quads are sorted by u0; u1 ≥ u0 and also non-decreasing). */
export function firstQuadAt(mesh: FloorMesh, u: number): number {
  const a = mesh.quadU1;
  let lo = 0;
  let hi = mesh.quadCount;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The DRAWN height at (u, v): the top quad of the mesh that covers the point, interpolated (the
 * walk-line test samples this against the terrain). NaN where no top quad covers it.
 */
export function meshHeightAt(mesh: FloorMesh, u: number, v: number): number {
  const q0 = firstQuadAt(mesh, u);
  let h = NaN;
  for (let q = q0; q < mesh.quadCount && mesh.quadU0[q] <= u; q++) {
    if (mesh.quadKind[q] !== QUAD_TOP) continue;
    const ua = mesh.quadU0[q];
    const ub = mesh.quadU1[q];
    if (u < ua || u > ub || ub <= ua) continue;
    const t = (u - ua) / (ub - ua);
    const b = q * 4;
    const i0 = mesh.quads[b];
    const i1 = mesh.quads[b + 1];
    const i2 = mesh.quads[b + 2];
    const i3 = mesh.quads[b + 3];
    const far = mesh.pv[i0] + (mesh.pv[i1] - mesh.pv[i0]) * t;
    const near = mesh.pv[i3] + (mesh.pv[i2] - mesh.pv[i3]) * t;
    if (v < far || v >= near) continue;
    h = mesh.ph[i0] + (mesh.ph[i1] - mesh.ph[i0]) * t;
  }
  return h;
}

/**
 * The T-junctions of a mesh (a test's check, not for the frame path): every vertex that lies strictly
 * inside an edge of a quad (on the edge's line within `tol` world px, at least `tol` from its ends)
 * without being a corner of that quad. A welded mesh has none. At most `max` are listed.
 */
export function meshTJunctions(mesh: FloorMesh, max = 16, tol = 1e-4): Array<{ u: number; v: number; h: number; quad: number }> {
  const out: Array<{ u: number; v: number; h: number; quad: number }> = [];
  const n = mesh.vertexCount;
  const { pu, pv, ph } = mesh;
  // Vertices sorted by u (one per position), for the range of an edge.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => pu[a] - pu[b] || pv[a] - pv[b] || ph[a] - ph[b]);
  const vs: number[] = [];
  for (const i of order) {
    const k = vs.length ? vs[vs.length - 1] : -1;
    if (k >= 0 && pu[k] === pu[i] && pv[k] === pv[i] && ph[k] === ph[i]) continue;
    vs.push(i);
  }
  const lowerU = (u: number): number => {
    let lo = 0;
    let hi = vs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pu[vs[mid]] < u) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  for (let q = 0; q < mesh.quadCount && out.length < max; q++) {
    for (let c = 0; c < 4 && out.length < max; c++) {
      const a = mesh.quads[q * 4 + c];
      const b = mesh.quads[q * 4 + ((c + 1) & 3)];
      const du = pu[b] - pu[a];
      const dv = pv[b] - pv[a];
      const dh = ph[b] - ph[a];
      const len2 = du * du + dv * dv + dh * dh;
      if (len2 < tol * tol) continue;
      const len = Math.sqrt(len2);
      const uLo = Math.min(pu[a], pu[b]) - tol;
      const uHi = Math.max(pu[a], pu[b]) + tol;
      for (let k = lowerU(uLo); k < vs.length && pu[vs[k]] <= uHi; k++) {
        const i = vs[k];
        const eu = pu[i] - pu[a];
        const ev = pv[i] - pv[a];
        const eh = ph[i] - ph[a];
        const t = (eu * du + ev * dv + eh * dh) / len2;
        if (t * len < tol || (1 - t) * len < tol) continue;
        // Distance from the edge's line.
        const xu = eu - du * t;
        const xv = ev - dv * t;
        const xh = eh - dh * t;
        if (xu * xu + xv * xv + xh * xh > tol * tol) continue;
        // A corner of this quad (a welded triangle repeats one) is not a T.
        let own = false;
        for (let m = 0; m < 4; m++) {
          const j = mesh.quads[q * 4 + m];
          if (pu[j] === pu[i] && pv[j] === pv[i] && ph[j] === ph[i]) own = true;
        }
        if (own) continue;
        out.push({ u: pu[i], v: pv[i], h: ph[i], quad: q });
        if (out.length >= max) break;
      }
    }
  }
  return out;
}
