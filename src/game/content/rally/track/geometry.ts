/**
 * The meshes of the compressed A10 (docs/design/rally.md §3 "Cross-section", §7.1 item 1, §7.3):
 * cross-sections extruded along the spline (r3/road.ts), one sunlit mesh per segment of about 20 m
 * (plus an emissive interior in the tunnel tubes) and flat far-ground chunks out to the fog edge.
 *
 * The cross-section (x = metres right of the centre line; the race drives on the right, clockwise):
 *
 *   far field | verge, slope, ditch | rail | ONCOMING (15 m) | central barrier | OURS (15 m) | rail | verge, slope, ditch | far field
 *   LO − 52 … LO                             LO … −H − CB        −H − CB … −H      −H … H              H … H + 52
 *
 * with H = 7.5 (ours: a 0.75 m strip, three lanes of 3.5 m, a 3.25 m hard shoulder, 0.5 m), CB =
 * 0.6. The outer profile follows the road height h: at grade a verge, a slope and a ditch; raised an
 * embankment down to the ground (y = 0); lowered (a tunnel ramp) a concrete retaining wall up to the
 * ground. The tubes have walls, a ceiling, rows of sodium lamps and a lid (ground or water) above;
 * decks have parapets, piers, water or ground below and caps where the embankment ends.
 *
 * Subdivision (affine warp readability, spec §15 item 5): rows of ≤ 7 m along every segment;
 * pieces of ≤ 3.75 m across our road (one lane each), 7.5 m across the oncoming one. Setup code:
 * it allocates; pure and deterministic.
 */
import { crossEdge, extrude, MeshAcc, rowsFor, type CrossEdge, type RoadRow, type UV4, type V3 } from '../../../../engine/r3/road';
import type { Spline3, SplineSample } from '../../../../engine/r3/spline';
import { splineSample } from '../../../../engine/r3/spline';
import { ROAD_SPAN, ROAD_TPM_X, TPM, type TrackTex } from './tex-road';
import { TF } from './types';

/** Ours: barrier face to barrier face / 2 (m). */
export const HALF = ROAD_SPAN / 2;
/** The central barrier's width (m). */
export const CB = 0.6;
/** The oncoming carriageway's outer edge (m). */
export const LO = -(HALF * 3 + CB);
/** The lane centres (0 = the left lane; 3 = the hard shoulder / spitsstrook). */
export const LANE_X: readonly number[] = [-5.0, -1.5, 2.0, 5.375];
export const LANE_WIDTH = 3.5;
/** The near field ends this far outside each carriageway; the far chunks start there (m). */
export const NEAR_FIELD = 52;
/** The far fields reach this far beyond the near field (m): past the fog's far end. */
export const FAR_FIELD = 400;
/** Max row spacing along (m): near the camera, and the far level of detail (one row per segment). */
export const ALONG = 7;
export const ALONG_FAR = 40;
/** Max piece width across our road (m). */
export const ACROSS = 3.75;
/** Tunnel tube: the ceiling over the road (m), the wall offset outside the barrier faces. */
export const TUBE_H = 5.4;
const TUBE_WALL = 0.6;
/** Water surface (m). */
export const WATER_Y = -0.3;

/** 0xRRGGBB vertex colours (0x808080 = the texture as painted). */
const C = {
  plain: 0x808080,
  oncoming: 0x787878,
  verge: 0x7c7c7c,
  field: 0x747474,
  tubeRoad: 0x6c5a46,
  tubeWall: 0x8c7a62,
  tubeCeil: 0x4c443c,
  tubeOncoming: 0x5a4a3a,
  lamp: 0x808080,
  shade: 0x6a6a6a,
} as const;

export type SegKind = 'open' | 'tube' | 'deck';

/** What the builder knows about a segment. */
export interface SegInfo {
  readonly i: number;
  readonly s0: number;
  readonly s1: number;
  readonly kind: SegKind;
  /** TF bits (any part). */
  readonly flags: number;
  /** Deck: a bridge (water below) or a viaduct (ground below). */
  readonly deck: 'bridge' | 'viaduct' | null;
  /** The first / last segment of a tube or a deck (portals, caps). */
  readonly first: boolean;
  readonly last: boolean;
  /** Block marks on the shoulder line (exits, the spitsstrook). */
  readonly block: boolean;
}

/** A finished segment: its meshes' builders. */
export interface SegMeshes {
  readonly outer: MeshAcc;
  readonly inner: MeshAcc | null;
}

/**
 * The outer profile at height h (m from the road edge outward, y absolute): P0 … P6 — the verge, the
 * slope (an embankment when raised), a ditch with water in it (the polder's sloot: a bank, the water,
 * a bank), the textured field. Lowered (a tunnel ramp) it blends into a kerb and a retaining wall up
 * to the ground.
 */
function outerProfile(h: number): { d: number[]; y: number[]; w: number } {
  const w = h < 0 ? Math.min(1, -h / 1.5) : 0;
  const hp = h > 0 ? h : 0;
  const g2 = 3.0 + 2 * hp + 0.6;
  const gd = [0, 3.0, g2, g2 + 0.6, g2 + 1.8, g2 + 2.4, g2 + 12.4];
  const gy = [h, h - 0.15, -0.3, -0.75, -0.75, 0, 0];
  const cd = [0, 0.7, 1.0, 1.4, 1.8, 2.2, 12.4];
  const cy = [h, h, 0, 0, 0, 0, 0];
  const d: number[] = [];
  const y: number[] = [];
  for (let k = 0; k < 7; k++) {
    d.push(gd[k] + (cd[k] - gd[k]) * w);
    y.push(gy[k] + (cy[k] - gy[k]) * w);
  }
  return { d, y, w };
}

/** u of the road strip at x (m right of the centre line). */
function roadU(tex: TrackTex, block: boolean, x: number): number {
  return (block ? tex.roadBlock.x : tex.road.x) + (x + HALF) * ROAD_TPM_X;
}

/** Edges of one side's outer profile (right: from the edge at `base` outward; left: mirrored, walked inward). */
function outerEdges(tex: TrackTex, out: CrossEdge[], h: number, base: number, sign: 1 | -1, wall: boolean): void {
  const p = outerProfile(h);
  const X = (k: number): number => base + sign * p.d[k];
  const gx = tex.grass.x, cx = tex.concrete.x, ex = tex.earth.x, wx = tex.water.x;
  const len = (k: number): number => {
    const dx = p.d[k + 1] - p.d[k], dy = p.y[k + 1] - p.y[k];
    return Math.sqrt(dx * dx + dy * dy);
  };
  // Each edge from inner point k to outer point k + 1, texel u along its length.
  const spec: { u0: number; u1: number; col: number }[] = [
    wall ? { u0: cx, u1: cx + Math.min(8, len(0) * TPM), col: C.plain } : { u0: gx, u1: gx + Math.min(31, len(0) * TPM), col: C.verge },
    wall ? { u0: cx, u1: cx + Math.min(32, len(1) * TPM), col: C.plain } : { u0: gx, u1: gx + Math.min(31, len(1) * TPM), col: C.verge },
    { u0: ex, u1: ex + Math.min(8, len(2) * TPM), col: C.plain },
    { u0: wx, u1: wx + Math.min(8, len(3) * TPM), col: C.plain },
    { u0: ex, u1: ex + Math.min(8, len(4) * TPM), col: C.plain },
    { u0: gx, u1: gx + 31, col: C.field },
  ];
  // P5 → P6 is the textured near field; P6 → NEAR_FIELD the flat colour of the far fields.
  const edges: CrossEdge[] = [];
  for (let k = 0; k < 6; k++) {
    const s = spec[k];
    edges.push(crossEdge(X(k), p.y[k], X(k + 1), p.y[k + 1], s.u0, s.u1, TPM, 0, 0, s.col));
  }
  const [fu, fv] = tex.swatch('far');
  edges.push(crossEdge(X(6), 0, base + sign * NEAR_FIELD, 0, fu, fu, 0, fv, 0, C.plain));
  if (sign === 1) out.push(...edges);
  else {
    // Mirrored: walk from the far left inward (front faces up / toward the road).
    for (let k = edges.length - 1; k >= 0; k--) {
      const e = edges[k];
      out.push(crossEdge(e.x1, e.y1, e.x0, e.y0, e.u1, e.u0, e.vScale, e.vOff, e.across, e.col));
    }
  }
}

/**
 * A flat field from xa to xb at height y, textured in pieces of at most one strip width (u restarts
 * every piece: no stretched texels), or one flat-colour edge when `flat` is a swatch texel.
 */
function fieldEdges(out: CrossEdge[], xa: number, xb: number, y: number, u0: number, width: number, tpm: number, col: number): void {
  const n = Math.max(1, Math.ceil((Math.abs(xb - xa) * tpm) / width - 1e-9));
  for (let k = 0; k < n; k++) {
    const a = xa + ((xb - xa) * k) / n, b = xa + ((xb - xa) * (k + 1)) / n;
    out.push(crossEdge(a, y, b, y, u0, u0 + Math.abs(b - a) * tpm, TPM, 0, 0, col));
  }
}

/** The guard rail at x (front toward the road: `facing` −1 = it faces −x, +1 = +x), both faces. */
function railEdges(tex: TrackTex, out: CrossEdge[], h: number, x: number, facing: 1 | -1): void {
  const r0 = tex.rail.x, r1 = tex.rail.x + 16;
  const top = h + 0.8;
  if (facing === -1) {
    out.push(crossEdge(x, h, x, top, r0, r1, TPM, 0, 0, C.plain));
    out.push(crossEdge(x, top, x, h, r1, r0, TPM, 0, 0, C.shade));
  } else {
    out.push(crossEdge(x, top, x, h, r1, r0, TPM, 0, 0, C.plain));
    out.push(crossEdge(x, h, x, top, r0, r1, TPM, 0, 0, C.shade));
  }
}

/** A noise barrier at x from y0 up 4 m (both faces). */
function noiseEdges(tex: TrackTex, out: CrossEdge[], y0: number, x: number, facing: 1 | -1): void {
  const n0 = tex.noise.x, n1 = tex.noise.x + 16;
  const top = y0 + 4.0;
  if (facing === -1) {
    out.push(crossEdge(x, y0, x, top, n0, n1, TPM, 0, 0, C.plain));
    out.push(crossEdge(x, top, x, y0, n1, n0, TPM, 0, 0, C.shade));
  } else {
    out.push(crossEdge(x, top, x, y0, n1, n0, TPM, 0, 0, C.plain));
    out.push(crossEdge(x, y0, x, top, n0, n1, TPM, 0, 0, C.shade));
  }
}

/** Both carriageways and the central barrier (`bh` its height). */
function roadEdges(tex: TrackTex, out: CrossEdge[], h: number, block: boolean, bh: number, colOurs: number, colOncoming: number): void {
  const cx = tex.concrete.x;
  // The oncoming carriageway (mirrored: its own left lane runs beside the barrier).
  out.push(crossEdge(LO, h, -HALF - CB, h, roadU(tex, false, HALF), roadU(tex, false, -HALF), TPM, 0, 7.5, colOncoming));
  // The central barrier: up the back, over the top, down the front.
  const top = h + bh;
  const ub = Math.min(32, bh * TPM);
  out.push(crossEdge(-HALF - CB, h, -HALF - CB, top, cx, cx + ub, TPM, 0, 0, C.shade));
  if (bh < 2) out.push(crossEdge(-HALF - CB, top, -HALF, top, cx + ub, cx + ub + CB * TPM, TPM, 0, 0, C.plain));
  out.push(crossEdge(-HALF, top, -HALF, h, cx + ub, cx, TPM, 0, 0, C.plain));
  // Ours.
  out.push(crossEdge(-HALF, h, HALF, h, roadU(tex, block, -HALF), roadU(tex, block, HALF), TPM, 0, ACROSS, colOurs));
}

/** The cross-section of an open segment at road height h. */
function openSection(tex: TrackTex, h: number, seg: SegInfo, wall: boolean): CrossEdge[] {
  const out: CrossEdge[] = [];
  outerEdges(tex, out, h, LO, -1, wall);
  railEdges(tex, out, h, LO - 0.15, 1);
  roadEdges(tex, out, h, seg.block, 0.9, C.plain, C.oncoming);
  railEdges(tex, out, h, HALF + 0.15, -1);
  outerEdges(tex, out, h, HALF, 1, wall);
  if (seg.flags & TF.noise) {
    noiseEdges(tex, out, h, LO - 0.5, 1);
    noiseEdges(tex, out, h, HALF + 0.5, -1);
  }
  return out;
}

/** The parapet on a deck edge at `x` (the road side faces `facing`). */
function parapetEdges(tex: TrackTex, out: CrossEdge[], h: number, x: number, facing: 1 | -1): void {
  const cx = tex.concrete.x;
  const top = h + 1.0;
  const bot = h - 1.2;
  if (facing === -1) {
    // Right edge: up the inner face, over the top, down the outer face (the deck's fascia).
    out.push(crossEdge(x, h, x, top, cx, cx + 4, TPM, 0, 0, C.plain));
    out.push(crossEdge(x, top, x + 0.7, top, cx + 4, cx + 6.8, TPM, 0, 0, C.plain));
    out.push(crossEdge(x + 0.7, top, x + 0.7, bot, cx + 8.8, cx, TPM, 0, 0, C.shade));
  } else {
    out.push(crossEdge(x - 0.7, bot, x - 0.7, top, cx, cx + 8.8, TPM, 0, 0, C.shade));
    out.push(crossEdge(x - 0.7, top, x, top, cx + 6.8, cx + 4, TPM, 0, 0, C.plain));
    out.push(crossEdge(x, top, x, h, cx + 4, cx, TPM, 0, 0, C.plain));
  }
}

/** The cross-section of a deck segment at road height h. */
function deckSection(tex: TrackTex, h: number, seg: SegInfo): CrossEdge[] {
  const out: CrossEdge[] = [];
  const water = seg.deck === 'bridge';
  const wy = water ? WATER_Y : 0;
  // Below: water (a bridge) or ground (a viaduct), in five strips across.
  // Below: water (a bridge) or ground (a viaduct): textured near the deck, flat beyond.
  const u0 = water ? tex.water.x : tex.grass.x;
  const uw = water ? 8 : 31;
  const tpm = water ? 1 : 3;
  const [fu, fv] = tex.swatch(water ? 'water' : 'far');
  out.push(crossEdge(LO - NEAR_FIELD, wy, LO - 26, wy, fu, fu, 0, fv, 0, C.plain));
  fieldEdges(out, LO - 26, LO - 0.8, wy, u0, uw, tpm, C.field);
  fieldEdges(out, LO - 0.8, HALF + 0.8, wy, u0, uw, tpm, C.shade);
  fieldEdges(out, HALF + 0.8, HALF + 26, wy, u0, uw, tpm, C.field);
  out.push(crossEdge(HALF + 26, wy, HALF + NEAR_FIELD, wy, fu, fu, 0, fv, 0, C.plain));
  parapetEdges(tex, out, h, LO - 0.1, 1);
  roadEdges(tex, out, h, seg.block, 0.9, C.plain, C.oncoming);
  parapetEdges(tex, out, h, HALF + 0.1, -1);
  if (seg.flags & TF.noise) {
    noiseEdges(tex, out, h + 1.0, LO - 0.45, 1);
    noiseEdges(tex, out, h + 1.0, HALF + 0.45, -1);
  }
  return out;
}

/** The tube's interior at road height h (emissive: its own lamps light it). */
function tubeInner(tex: TrackTex, h: number, seg: SegInfo): CrossEdge[] {
  const out: CrossEdge[] = [];
  const tx = tex.tiles.x, cx = tex.concrete.x, lx = tex.lamp.x;
  const ceil = h + TUBE_H;
  const wl = LO - TUBE_WALL, wr = HALF + TUBE_WALL;
  // The oncoming tube: its outer wall (facing +x), its kerb.
  out.push(crossEdge(wl, ceil, wl, h, tx + 32, tx, TPM, 0, 0, C.tubeWall));
  out.push(crossEdge(wl, h, LO, h, cx, cx + 2.4, TPM, 0, 0, C.tubeRoad));
  // Both roads and the dividing wall (the central barrier up to the ceiling).
  out.push(crossEdge(LO, h, -HALF - CB, h, roadU(tex, false, HALF), roadU(tex, false, -HALF), TPM, 0, 7.5, C.tubeOncoming));
  out.push(crossEdge(-HALF - CB, h, -HALF - CB, ceil, tx, tx + 32, TPM, 0, 0, C.tubeWall));
  out.push(crossEdge(-HALF, ceil, -HALF, h, tx + 32, tx, TPM, 0, 0, C.tubeWall));
  out.push(crossEdge(-HALF, h, HALF, h, roadU(tex, seg.block, -HALF), roadU(tex, seg.block, HALF), TPM, 0, ACROSS, C.tubeRoad));
  // Our kerb, our outer wall (facing −x), the ceiling over both tubes (facing down).
  out.push(crossEdge(HALF, h, wr, h, cx, cx + 2.4, TPM, 0, 0, C.tubeRoad));
  out.push(crossEdge(wr, h, wr, ceil, tx, tx + 32, TPM, 0, 0, C.tubeWall));
  out.push(crossEdge(wr, ceil, wl, ceil, cx + 4, cx + 28, TPM, 0, 8, C.tubeCeil));
  // The lamp rows high on both walls of our tube (just in front of the tiles).
  out.push(crossEdge(wr - 0.05, h + 4.5, wr - 0.05, h + 4.9, lx, lx + 8, TPM, 0, 0, C.lamp));
  out.push(crossEdge(-HALF + 0.05, h + 4.9, -HALF + 0.05, h + 4.5, lx + 8, lx, TPM, 0, 0, C.lamp));
  return out;
}

/** The ground (or water) over a tube and beside it. */
function tubeOuter(tex: TrackTex, seg: SegInfo): CrossEdge[] {
  const out: CrossEdge[] = [];
  const water = (seg.flags & TF.water) !== 0;
  const y = water ? WATER_Y : 0;
  const u0 = water ? tex.water.x : tex.grass.x;
  const uw = water ? 8 : 31;
  const tpm = water ? 1 : 3;
  const [fu, fv] = tex.swatch(water ? 'water' : 'far');
  const wl = LO - TUBE_WALL - 0.3, wr = HALF + TUBE_WALL + 0.3;
  out.push(crossEdge(LO - NEAR_FIELD, y, wl - 10, y, fu, fu, 0, fv, 0, C.plain));
  fieldEdges(out, wl - 10, wr + 10, y, u0, uw, tpm, C.field);
  out.push(crossEdge(wr + 10, y, HALF + NEAR_FIELD, y, fu, fu, 0, fv, 0, C.plain));
  return out;
}

/** v texels of a segment start (kept small: the page wraps every 256 texels = 64 m). */
function vBase(s0: number): number {
  return s0 - Math.floor(s0 / 64) * 64;
}

/** The rows of a segment (≤ ALONG metres apart). */
export function segmentRows(spline: Spline3, s0: number, s1: number, along = ALONG, tmp: SplineSample = splineSample()): RoadRow[] {
  const n = rowsFor(s1 - s0, along);
  const rows: RoadRow[] = [];
  for (let j = 0; j <= n; j++) {
    const s = s0 + ((s1 - s0) * j) / n;
    spline.sample(s, tmp);
    rows.push({ s, px: tmp.p[0], py: tmp.p[1], pz: tmp.p[2], rx: tmp.r[0], rz: tmp.r[2] });
  }
  return rows;
}

/** A point at lateral x, height y in a row's frame. */
function at(row: RoadRow, x: number, y: number): V3 {
  return [row.px + row.rx * x, y, row.pz + row.rz * x];
}

/** The horizontal forward of a row (r turned: forward = (rz, 0, −rx)). */
function fwdOf(row: RoadRow): V3 {
  return [row.rz, 0, -row.rx];
}

/**
 * Build the meshes of one segment: rows of ≤ `along` metres (ALONG near the camera; the far level
 * of detail takes one row per segment — the same edges and pieces across, so the two levels meet
 * without cracks at a segment boundary).
 */
export function buildSegment(tex: TrackTex, spline: Spline3, seg: SegInfo, along = ALONG): SegMeshes {
  const rows = segmentRows(spline, seg.s0, seg.s1, along);
  const outer = new MeshAcc();
  let inner: MeshAcc | null = null;
  // v counts from the segment's own start (mod 64 m) so the strips stay continuous and small.
  const sRef = seg.s0 - vBase(seg.s0);
  if (seg.kind === 'open') {
    let minH = Infinity;
    for (const r of rows) minH = Math.min(minH, r.py);
    const wall = minH < -0.75;
    extrude(outer, rows, rows.map((r) => openSection(tex, r.py, seg, wall)), sRef);
  } else if (seg.kind === 'deck') {
    extrude(outer, rows, rows.map((r) => deckSection(tex, r.py, seg)), sRef);
    // Piers every other segment: three pillars and a cap under the deck.
    if (seg.i % 2 === 0 || seg.first) piers(tex, outer, segmentRows(spline, (seg.s0 + seg.s1) / 2, (seg.s0 + seg.s1) / 2 + 1, 2)[0], seg.deck === 'bridge' ? WATER_Y : 0);
    if (seg.first) cap(tex, outer, rows[0], 1);
    if (seg.last) cap(tex, outer, rows[rows.length - 1], -1);
  } else {
    inner = new MeshAcc();
    extrude(inner, rows, rows.map((r) => tubeInner(tex, r.py, seg)), sRef);
    extrude(outer, rows, rows.map(() => tubeOuter(tex, seg)), sRef);
    if (seg.first) portal(tex, outer, rows[0], -1);
    if (seg.last) portal(tex, outer, rows[rows.length - 1], 1);
  }
  return { outer, inner };
}

/** Pillars and a cap beam under a deck at this row. */
function piers(tex: TrackTex, acc: MeshAcc, row: RoadRow, ground: number): void {
  const h = row.py;
  const f = fwdOf(row);
  const r: V3 = [row.rx, 0, row.rz];
  const top = h - 1.2;
  if (top - ground < 0.5) return;
  const cx = tex.concrete.x;
  const uv: UV4 = [cx + 2, 0, cx + 30, 32];
  const col = 0x707070;
  for (const x of [LO + 2.5, -HALF - CB / 2, HALF - 2.5]) {
    const c = at(row, x, (top + ground) / 2);
    acc.obox(c, [r[0] * 0.6, 0, r[2] * 0.6], [0, (top - ground) / 2, 0], [f[0] * 0.6, 0, f[2] * 0.6], () => uv, col, ['px', 'nx', 'pz', 'nz']);
  }
  const mid = (LO + HALF) / 2;
  const hw = (HALF - LO) / 2 - 0.5;
  acc.obox(at(row, mid, top - 0.4), [r[0] * hw, 0, r[2] * hw], [0, 0.4, 0], [f[0] * 0.8, 0, f[2] * 0.8], () => uv, col, ['px', 'nx', 'pz', 'nz', 'ny']);
}

/** The end of an embankment at a deck's first (dir +1: faces +t) or last row (dir −1: faces −t). */
function cap(tex: TrackTex, acc: MeshAcc, row: RoadRow, dir: 1 | -1): void {
  const h = row.py;
  const p = outerProfile(h);
  const f = fwdOf(row);
  const n: V3 = [f[0] * dir, 0, f[2] * dir];
  const [u, v] = tex.swatch('grey');
  const pts: V3[] = [
    at(row, LO - p.d[2], p.y[2]),
    at(row, LO - p.d[1], p.y[1]),
    at(row, LO, h),
    at(row, HALF, h),
    at(row, HALF + p.d[1], p.y[1]),
    at(row, HALF + p.d[2], p.y[2]),
  ];
  acc.fan(pts, u, v, 0x707070, n);
}

/** A tunnel portal at a tube's first (dir −1: its face looks back down the road) or last row (+1). */
function portal(tex: TrackTex, acc: MeshAcc, row: RoadRow, dir: 1 | -1): void {
  const h = row.py;
  const f = fwdOf(row);
  const r: V3 = [row.rx, 0, row.rz];
  const y0 = h + TUBE_H - 0.4;
  const y1 = 0.8;
  if (y1 - y0 < 0.2) return;
  const mid = (LO + HALF) / 2;
  const hw = (HALF - LO) / 2 + TUBE_WALL + 0.8;
  const c = at(row, mid, (y0 + y1) / 2);
  const off = 0.7 * dir;
  const cc: V3 = [c[0] + f[0] * off, c[1], c[2] + f[2] * off];
  const cx = tex.concrete.x;
  const face: UV4 = [cx + 2, 0, cx + 30, (y1 - y0) * TPM];
  acc.obox(cc, [r[0] * hw, 0, r[2] * hw], [0, (y1 - y0) / 2, 0], [f[0] * 0.7, 0, f[2] * 0.7], () => face, 0x7a7a7a, ['px', 'nx', 'py', 'pz', 'nz', 'ny']);
}

/**
 * The far fields start this far under the near field's flat edge, a little lower: the near rows
 * (every 7 m) meet the chunk's rows (every 20 m) in T-junctions, and with the vertex snap of the
 * era such a seam opens hairline cracks — the overlap keeps the sky out of them.
 */
const FAR_OVERLAP = 8;
const FAR_Y = -0.04;

/** A far-ground chunk: flat fields (one texel) beyond the near fields on both sides, one row per segment. */
export function farChunk(tex: TrackTex, rows: readonly RoadRow[], widthL: readonly number[], widthR: readonly number[]): MeshAcc {
  const acc = new MeshAcc();
  const [u, v] = tex.swatch('far');
  const prof = rows.map((_, i) => [
    crossEdge(LO - NEAR_FIELD - widthL[i], FAR_Y, LO - NEAR_FIELD + FAR_OVERLAP, FAR_Y, u, u, 0, v, 0, C.plain),
    crossEdge(HALF + NEAR_FIELD - FAR_OVERLAP, FAR_Y, HALF + NEAR_FIELD + widthR[i], FAR_Y, u, u, 0, v, 0, C.plain),
  ]);
  extrude(acc, rows, prof, 0);
  return acc;
}

// ---------------------------------------------------------------------------------------------
// Props (wave A placeholders: wave B dresses them): gantries, speed cameras, the start line.
// ---------------------------------------------------------------------------------------------

/** A placeholder gantry over our carriageway at this row. */
export function gantry(tex: TrackTex, acc: MeshAcc, row: RoadRow, kind: string): void {
  const h = row.py;
  const f = fwdOf(row);
  const r: V3 = [row.rx, 0, row.rz];
  const st = tex.steel;
  const steelUV: UV4 = [st.x + 1, 4, st.x + 7, 120];
  const col = 0x808080;
  const postH = 7.4;
  // Posts: on the central barrier and on the outer verge.
  for (const x of [-HALF - CB / 2, HALF + 1.4]) {
    acc.obox(at(row, x, h + postH / 2), [r[0] * 0.22, 0, r[2] * 0.22], [0, postH / 2, 0], [f[0] * 0.22, 0, f[2] * 0.22], () => steelUV, col);
  }
  // The beam (a truss box) across.
  const x0 = -HALF - CB / 2 - 0.4, x1 = HALF + 1.8;
  acc.obox(at(row, (x0 + x1) / 2, h + 6.9), [r[0] * ((x1 - x0) / 2), 0, r[2] * ((x1 - x0) / 2)], [0, 0.5, 0], [f[0] * 0.45, 0, f[2] * 0.45], () => steelUV, col, ['px', 'nx', 'py', 'ny', 'pz', 'nz']);
  // Signs: a matrix sign over every lane (dark), or a blue direction sign over the right lanes.
  const sign = (name: 'sign' | 'blue'): UV4 => {
    const [u, v] = tex.swatch(name);
    return [u - 2, v - 2, u + 2, v + 2];
  };
  if (kind === 'exit') {
    acc.obox(at(row, 3.5, h + 5.2), [r[0] * 3.2, 0, r[2] * 3.2], [0, 1.2, 0], [f[0] * 0.15, 0, f[2] * 0.15], () => sign('blue'), col, ['px', 'nx', 'py', 'ny', 'pz', 'nz']);
  } else {
    const lanes = kind === 'start' ? LANE_X.slice(0, 3) : LANE_X;
    for (const x of lanes) {
      acc.obox(at(row, x, h + 5.55), [r[0] * 0.8, 0, r[2] * 0.8], [0, 0.85, 0], [f[0] * 0.2, 0, f[2] * 0.2], () => sign('sign'), col, ['px', 'nx', 'ny', 'pz', 'nz']);
    }
  }
}

/** A placeholder speed camera (flitspaal): a pole and a grey box facing the traffic. */
export function flitspaal(tex: TrackTex, acc: MeshAcc, row: RoadRow, side: number): void {
  const h = Math.max(0, row.py);
  const f = fwdOf(row);
  const r: V3 = [row.rx, 0, row.rz];
  const st = tex.steel;
  const steelUV: UV4 = [st.x + 1, 4, st.x + 7, 40];
  const [gu, gv] = tex.swatch('grey');
  const grey: UV4 = [gu - 2, gv - 2, gu + 2, gv + 2];
  const base = row.py > 0.3 ? row.py - 0.15 : 0;
  acc.obox(at(row, side, base + 1.4), [r[0] * 0.08, 0, r[2] * 0.08], [0, 1.4, 0], [f[0] * 0.08, 0, f[2] * 0.08], () => steelUV, 0x808080);
  acc.obox(at(row, side, Math.max(h, base) + 3.0), [r[0] * 0.3, 0, r[2] * 0.3], [0, 0.45, 0], [f[0] * 0.35, 0, f[2] * 0.35], () => grey, 0x8c8c8c, ['px', 'nx', 'py', 'ny', 'pz', 'nz']);
}

/**
 * The start / finish line (a chequer of white squares across the lanes) and the grid boxes (a
 * white bar across the front of each slot): decals 2 cm above the road.
 */
export function startDecals(tex: TrackTex, acc: MeshAcc, spline: Spline3, startS: number, grid: readonly { s: number; side: number }[]): void {
  const [u, v] = tex.swatch('white');
  const tmp = splineSample();
  const quadAt = (s0: number, s1: number, x0: number, x1: number): void => {
    spline.sample(s0, tmp);
    const a: RoadRow = { s: s0, px: tmp.p[0], py: tmp.p[1], pz: tmp.p[2], rx: tmp.r[0], rz: tmp.r[2] };
    spline.sample(s1, tmp);
    const b: RoadRow = { s: s1, px: tmp.p[0], py: tmp.p[1], pz: tmp.p[2], rx: tmp.r[0], rz: tmp.r[2] };
    acc.quad(at(a, x0, a.py + 0.02), at(a, x1, a.py + 0.02), at(b, x1, b.py + 0.02), at(b, x0, b.py + 0.02), [u, v, u, v], 0x808080, [0, 1, 0]);
  };
  const x0 = -6.75, x1 = 3.75;
  const n = 12;
  const w = (x1 - x0) / n;
  // Two rows of squares, white on alternate ones (the asphalt shows between them).
  for (let k = 0; k < n; k++) {
    if (k % 2 === 0) quadAt(startS - 0.875, startS - 0.4375, x0 + k * w, x0 + (k + 1) * w);
    else quadAt(startS - 0.4375, startS, x0 + k * w, x0 + (k + 1) * w);
  }
  for (const g of grid) quadAt(g.s - 0.3, g.s, g.side - 1.1, g.side + 1.1);
}

/** TF bits that need a block-marked shoulder line. */
export const BLOCK_FLAGS = TF.exit | TF.spits;
