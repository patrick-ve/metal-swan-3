/**
 * The track: the compressed A10 (docs/design/rally.md §3, §4; docs/api/rally.md "A.T The track").
 * `buildTrack()` lays out THE TABLE (table.ts) into a closed spline, cuts it into segments of about
 * 20 m with their meshes (geometry.ts) and culling units, and fills the `RallyTrack` contract plus
 * the ADDED fields of `A10Track` (types.ts): sections, segments, the frame sampler, lanes, the AI
 * lines, the grid, the finish and the anchors of wave B (gantries, speed cameras, the
 * average-speed zone, road works, the spitsstrook, tunnels, decks, S-exits, landmarks).
 *
 * Pure and deterministic (the same table gives the same bytes; only + − × ÷, Math.sqrt / floor /
 * round / abs / min / max and the r3 trig tables). Built once per load (registry.ts caches it).
 */
import { CullSet } from '../../../../engine/r3/cull';
import type { MeshAcc, RoadRow } from '../../../../engine/r3/road';
import { Spline3, splineSample } from '../../../../engine/r3/spline';
import type { DrawItem, Mesh3 } from '../../../../engine/view3d';
import type { GridSlot, RallyTrack, TrackBounds } from '../../../rally/api';
import { buildAiLines } from './ai-lines';
import { ALONG, ALONG_FAR, BLOCK_FLAGS, buildSegment, CB, FAR_FIELD, farChunk, flitspaal, gantry, HALF, LANE_WIDTH, LANE_X, LO, NEAR_FIELD, startDecals, type SegInfo, type SegKind } from './geometry';
import { layoutTrack, type Bump } from './layout';
import { A10_FINISH_AT, A10_TABLE, A10_YAW0, type SectionSpec } from './table';
import { trackTex } from './tex-road';
import { SECTION_IDS, TF, trackSample, type A10Track, type TrackBridge, type TrackCamera, type TrackChunk, type TrackExit, type TrackGantry, type TrackLandmark, type TrackRange, type TrackRoadworks, type TrackSample, type TrackSection, type TrackSegment, type TrackTunnel } from './types';

export * from './types';
export { A10_TABLE } from './table';
export { TrackView, TRACK_TRI_BUDGET, LOD_NEAR } from './view';
import { TrackView } from './view';

/** Metres between the spline's control points (design distance). */
const CP_STEP = 10;
/** Target segment length (m). */
export const SEG_LEN = 20;
/** Segments per far-ground chunk. */
const CHUNK_SEGS = 8;
/** The flag / section table's step (m). */
const FLAG_STEP = 5;
/** Block marks run this far before an S-exit's off-ramp (m). */
const EXIT_BLOCK = 200;
/** The par lap's average speed (m/s): the tally's TIME line (about 2:28 a lap). */
const PAR_SPEED = 46;
/** The grid: rows behind the line (m), the stagger of the right column, the two columns. */
const GRID_FIRST = 6;
const GRID_ROW = 8;
const GRID_STAGGER = 4;
const GRID_SIDES = [-3.75, 0.75] as const;

/** Build the A10 (the registered track, rally/registry.ts). */
export function buildTrack(): RallyTrack {
  return buildA10(A10_TABLE);
}

/** Build options (tests, wave B). */
export interface BuildOpts {
  /**
   * The wave-A placeholder props in the segment meshes: the gantries (posts, a beam, signs), the
   * flitspalen and the start decals. Default true; wave B passes false when it dresses them itself.
   */
  readonly props?: boolean;
}

/** Build a track from a table (tests pass variants). */
export function buildA10(table: readonly SectionSpec[], o: BuildOpts = {}): A10Track {
  const props = o.props ?? true;
  if (table.length !== SECTION_IDS.length || table.some((s, i) => s.id !== SECTION_IDS[i])) throw new Error('buildA10: the table needs the ten sections in order');
  const tex = trackTex();

  // 1. The layout (design distance d), the elevation bumps, the control points, the spline.
  const lay = layoutTrack(table, A10_YAW0, (secD) => {
    const bumps: Bump[] = [];
    table.forEach((sec, i) => {
      if (sec.tunnel) bumps.push({ a: secD[i] + sec.tunnel.from, b: secD[i] + sec.tunnel.to, ramp: sec.tunnel.ramp, h: -sec.tunnel.depth });
      for (const dk of sec.decks ?? []) bumps.push({ a: secD[i] + dk.from, b: secD[i] + dk.to, ramp: dk.ramp, h: dk.height });
    });
    return bumps;
  });
  const nCp = Math.round(lay.length / CP_STEP);
  const dStep = lay.length / nCp;
  const pts: number[] = [];
  const xz = [0, 0];
  for (let k = 0; k < nCp; k++) {
    const d = k * dStep;
    lay.position(d, xz);
    pts.push(xz[0], lay.height(d), xz[1]);
  }
  const SUB = 4;
  const spline = new Spline3(pts, { sub: SUB });
  const L = spline.length;
  // d ↔ s through the control points (control point k sits at tableS[k · SUB]).
  const sCp = new Float64Array(nCp + 1);
  for (let k = 0; k <= nCp; k++) sCp[k] = k === nCp ? L : spline.tableS[k * SUB];
  const sOfD = (d: number): number => {
    const w = d - Math.floor(d / lay.length) * lay.length;
    const f = w / dStep;
    const k = Math.min(nCp - 1, Math.floor(f));
    return sCp[k] + (sCp[k + 1] - sCp[k]) * (f - k);
  };
  const dOfS = (s: number): number => {
    const w = spline.wrap(s);
    let lo = 0, hi = nCp - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (sCp[mid] <= w) lo = mid;
      else hi = mid - 1;
    }
    const ds = sCp[lo + 1] - sCp[lo];
    return (lo + (ds > 0 ? (w - sCp[lo]) / ds : 0)) * dStep;
  };
  const secS = (i: number, off: number): number => spline.wrap(sOfD(lay.sectionD[i] + off));

  // 2. Segments (uniform, about SEG_LEN) and the ranges snapped to their boundaries.
  const nSeg = Math.max(8, Math.round(L / SEG_LEN));
  const segLen = L / nSeg;
  const snapI = (s: number): number => Math.round(s / segLen) % nSeg;
  const sections: TrackSection[] = table.map((sec, i) => ({ id: sec.id, name: sec.name, s0: secS(i, 0), s1: i + 1 < table.length ? secS(i + 1, 0) : L }));
  const tunnels: TrackTunnel[] = [];
  const bridges: TrackBridge[] = [];
  const tubeSegs: [number, number, string][] = [];
  const deckSegs: [number, number, 'bridge' | 'viaduct'][] = [];
  const waterR: TrackRange[] = [];
  const rangeOf = (i: number, a: number, b: number): TrackRange => ({ s0: secS(i, a), s1: secS(i, b) });
  const avgZones: { s0: number; s1: number; limit: number }[] = [];
  const roadworks: TrackRoadworks[] = [];
  const spits: TrackRange[] = [];
  const noise: TrackRange[] = [];
  const exits: TrackExit[] = [];
  const landmarks: TrackLandmark[] = [];
  const gantries: TrackGantry[] = [];
  const cameras: TrackCamera[] = [];
  table.forEach((sec, i) => {
    if (sec.tunnel) {
      const t = sec.tunnel;
      const a = snapI(secS(i, t.from)), b = snapI(secS(i, t.to));
      tubeSegs.push([a, b, t.name]);
      tunnels.push({ name: t.name, s0: a * segLen, s1: b * segLen, ramp0: secS(i, t.from - t.ramp), ramp1: secS(i, t.to + t.ramp) });
      if (t.water) waterR.push(rangeOf(i, t.water[0], t.water[1]));
    }
    for (const dk of sec.decks ?? []) {
      const a = snapI(secS(i, dk.from)), b = snapI(secS(i, dk.to));
      deckSegs.push([a, b, dk.kind]);
      bridges.push({ name: dk.name, kind: dk.kind, s0: a * segLen, s1: b * segLen });
    }
    if (sec.avg) avgZones.push({ ...rangeOf(i, sec.avg.from, sec.avg.to), limit: sec.avg.limit });
    for (const rw of sec.roadworks ?? []) roadworks.push({ ...rangeOf(i, rw.from, rw.to), closed: [...rw.closed], limit: rw.limit, section: i });
    for (const [a, b] of sec.spits ?? []) spits.push(rangeOf(i, a, b));
    for (const [a, b] of sec.noise ?? []) noise.push(rangeOf(i, a, b));
    for (const ex of sec.exits ?? []) exits.push({ code: ex.code, name: ex.name, s: secS(i, ex.at), section: i });
    for (const lm of sec.landmarks ?? []) landmarks.push({ id: lm.id, s: secS(i, lm.at), side: lm.side, section: i });
    for (const g of sec.gantries ?? []) gantries.push({ s: secS(i, g.at), kind: g.kind, section: i });
    for (const c of sec.cameras ?? []) cameras.push({ s: secS(i, c.at), side: HALF + 2.2, limit: c.limit, section: i });
  });
  if (avgZones.length !== 1) throw new Error('buildA10: the table needs one average-speed zone');
  const startS = secS(0, A10_FINISH_AT);

  /** s within [r.s0, r.s1) (a range may wrap over the start line). */
  const inRange = (s: number, r: TrackRange): boolean => (r.s0 <= r.s1 ? s >= r.s0 && s < r.s1 : s >= r.s0 || s < r.s1);
  const inSegs = (i: number, a: number, b: number): boolean => (a <= b ? i >= a && i < b : i >= a || i < b);
  const exitR: TrackRange[] = exits.map((e) => ({ s0: spline.wrap(e.s - EXIT_BLOCK), s1: e.s }));
  const tmp = splineSample();

  // 3. The flag and section tables (every FLAG_STEP metres).
  const nFlag = Math.ceil(L / FLAG_STEP);
  const flagTab = new Uint16Array(nFlag);
  const secTab = new Uint8Array(nFlag);
  const segKind = (i: number): { kind: SegKind; deck: 'bridge' | 'viaduct' | null; first: boolean; last: boolean } => {
    for (const [a, b] of tubeSegs) if (inSegs(i, a, b)) return { kind: 'tube', deck: null, first: i === a, last: (i + 1) % nSeg === b };
    for (const [a, b, k] of deckSegs) if (inSegs(i, a, b)) return { kind: 'deck', deck: k, first: i === a, last: (i + 1) % nSeg === b };
    return { kind: 'open', deck: null, first: false, last: false };
  };
  const flagsAtS = (s: number, seg = -1): number => {
    const w = spline.wrap(s);
    const si = seg >= 0 ? seg : Math.min(nSeg - 1, Math.floor(w / segLen));
    const k = segKind(si);
    let f = 0;
    spline.sample(w, tmp);
    const h = tmp.p[1];
    if (k.kind === 'tube') f |= TF.tunnel;
    else if (h < -0.3) f |= TF.cutting;
    if (k.kind === 'deck') f |= k.deck === 'bridge' ? TF.bridge : TF.viaduct;
    else if (h > 0.3) f |= TF.raised;
    for (const r of noise) if (inRange(w, r)) f |= TF.noise;
    for (const r of avgZones) if (inRange(w, r)) f |= TF.avgZone;
    for (const r of spits) if (inRange(w, r)) f |= TF.spits;
    for (const r of roadworks) if (inRange(w, r)) f |= TF.roadworks;
    for (const r of exitR) if (inRange(w, r)) f |= TF.exit;
    for (const r of waterR) if (inRange(w, r)) f |= TF.water;
    return f;
  };
  for (let k = 0; k < nFlag; k++) {
    const s = k * FLAG_STEP;
    flagTab[k] = flagsAtS(s);
    let sec = 0;
    for (let i = 0; i < sections.length; i++) if (s >= sections[i].s0) sec = i;
    secTab[k] = sec;
  }

  // 4. The grid (pole on the left, two wide, staggered) and the AI lines.
  const grid: GridSlot[] = [];
  for (let i = 0; i < 8; i++) grid.push({ s: spline.wrap(startS - GRID_FIRST - GRID_ROW * Math.floor(i / 2) - GRID_STAGGER * (i % 2)), side: GRID_SIDES[i % 2] });
  const ai = buildAiLines(spline, (s) => lay.curvature(dOfS(s)), LANE_X);

  // 5. The meshes: one sunlit mesh per segment (+ a tunnel interior), the far chunks.
  const meshes: Mesh3[] = [];
  const segments: TrackSegment[] = [];
  const page = tex.page.id;
  const segAccs: MeshAcc[][] = [];
  const segOf = (s: number): number => Math.min(nSeg - 1, Math.floor(spline.wrap(s) / segLen));
  const rowAt = (s: number): RoadRow => {
    spline.sample(s, tmp);
    return { s, px: tmp.p[0], py: tmp.p[1], pz: tmp.p[2], rx: tmp.r[0], rz: tmp.r[2] };
  };
  for (let i = 0; i < nSeg; i++) {
    const s0 = i * segLen, s1 = (i + 1) * segLen;
    let flags = 0;
    for (let s = s0; s < s1; s += FLAG_STEP) flags |= flagsAtS(s, i);
    flags |= flagsAtS(s1 - 0.01, i);
    const k = segKind(i);
    const info: SegInfo = { i, s0, s1, kind: k.kind, flags, deck: k.deck, first: k.first, last: k.last, block: (flags & BLOCK_FLAGS) !== 0 };
    const id = `track/seg/${String(i).padStart(3, '0')}`;
    const lod = (along: number, suffix: string): { outer: string; inner: string | null; tris: number; accs: MeshAcc[] } => {
      const sm = buildSegment(tex, spline, info, along);
      if (props) {
        for (const g of gantries) if (segOf(g.s) === i && !(flags & TF.tunnel)) gantry(tex, sm.outer, rowAt(g.s), g.kind);
        for (const c of cameras) if (segOf(c.s) === i) flitspaal(tex, sm.outer, rowAt(c.s), c.side);
        if (segOf(startS) === i) startDecals(tex, sm.outer, spline, startS, grid);
      }
      meshes.push(sm.outer.toMesh(id + suffix, page, 0));
      let inner: string | null = null;
      if (sm.inner) {
        inner = `${id}/in${suffix}`;
        meshes.push(sm.inner.toMesh(inner, page, 0, { emissive: true }));
      }
      return { outer: id + suffix, inner, tris: sm.outer.triangles + (sm.inner?.triangles ?? 0), accs: sm.inner ? [sm.outer, sm.inner] : [sm.outer] };
    };
    const near = lod(ALONG, '');
    const far = lod(ALONG_FAR, '/far');
    segAccs.push(near.accs);
    const m = rowAt((s0 + s1) / 2);
    segments.push({
      i,
      s0,
      s1,
      flags,
      section: secTab[Math.min(nFlag - 1, Math.floor((s0 + s1) / 2 / FLAG_STEP))],
      mesh: near.outer,
      inner: near.inner,
      tris: near.tris,
      meshFar: far.outer,
      innerFar: far.inner,
      trisFar: far.tris,
      mid: [m.px, m.py, m.pz],
    });
  }
  // The far fields: chunks of CHUNK_SEGS segments, widths clamped inside tight bends.
  const chunks: TrackChunk[] = [];
  const chunkAccs: MeshAcc[] = [];
  const nChunk = Math.ceil(nSeg / CHUNK_SEGS);
  for (let c = 0; c < nChunk; c++) {
    const a = c * CHUNK_SEGS, b = Math.min(nSeg, a + CHUNK_SEGS);
    const rows: RoadRow[] = [];
    const wl: number[] = [];
    const wr: number[] = [];
    for (let i = a; i <= b; i++) {
      const s = i * segLen;
      rows.push(rowAt(s));
      const k = ai.curvAt(s);
      const inside = (sgn: number): number => (k * sgn > 1e-6 ? 0.8 / Math.abs(k) : Infinity);
      wl.push(Math.max(20, Math.min(FAR_FIELD, inside(1) - (-LO + NEAR_FIELD))));
      wr.push(Math.max(20, Math.min(FAR_FIELD, inside(-1) - (HALF + NEAR_FIELD))));
    }
    const acc = farChunk(tex, rows, wl, wr);
    const id = `track/far/${String(c).padStart(2, '0')}`;
    meshes.push(acc.toMesh(id, page, 0));
    chunks.push({ s0: a * segLen, s1: b * segLen, mesh: id, tris: acc.triangles });
    chunkAccs.push(acc);
  }

  // 6. Culling units: an oriented box per segment and per chunk (the frame at its middle).
  const cull = new CullSet(nSeg + nChunk);
  const boxOf = (u: number, accs: readonly MeshAcc[], sMid: number): void => {
    spline.sample(sMid, tmp);
    const fx = tmp.r[2], fz = -tmp.r[0];
    const rx = tmp.r[0], rz = tmp.r[2];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const acc of accs) {
      const P = acc.pos;
      for (let j = 0; j < P.length; j += 3) {
        const dx = P[j] - tmp.p[0], dz = P[j + 2] - tmp.p[2];
        const a = dx * fx + dz * fz, bb = dx * rx + dz * rz;
        if (a < a0) a0 = a;
        if (a > a1) a1 = a;
        if (bb < b0) b0 = bb;
        if (bb > b1) b1 = bb;
        if (P[j + 1] < y0) y0 = P[j + 1];
        if (P[j + 1] > y1) y1 = P[j + 1];
      }
    }
    const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2, ha = (a1 - a0) / 2 + 0.01, hb = (b1 - b0) / 2 + 0.01, hy = (y1 - y0) / 2 + 0.01;
    cull.setBox(u, tmp.p[0] + fx * ca + rx * cb, (y0 + y1) / 2, tmp.p[2] + fz * ca + rz * cb, [fx * ha, 0, fz * ha], [rx * hb, 0, rz * hb], [0, hy, 0]);
  };
  for (let i = 0; i < nSeg; i++) boxOf(i, segAccs[i], (i + 0.5) * segLen);
  for (let c = 0; c < nChunk; c++) boxOf(nSeg + c, [chunkAccs[c]], (chunks[c].s0 + chunks[c].s1) / 2);

  let trisTotal = 0;
  for (const m of meshes) trisTotal += m.idx.length / 3;
  // The static draw list of a view without culling: the near level of detail, the tunnel
  // interiors and the far chunks (one complete set; the far level's meshes are only drawn through
  // `createView`). Every mesh gets its item (the culler hands out the same objects).
  const allItems: DrawItem[] = meshes.map((m) => ({ mesh: m.id, m: null }));
  const items = allItems.filter((it) => !it.mesh.endsWith('/far'));
  const av = avgZones[0];
  const sSample = splineSample();

  const track: A10Track = {
    id: 'a10',
    spline,
    length: L,
    halfWidth: HALF,
    lanes: 3,
    laneWidth: LANE_WIDTH,
    startS,
    grid,
    parLapTicks: Math.round((L / PAR_SPEED) * 60),
    meshes,
    pages: [tex.page],
    items,
    bounds(_s: number, out: TrackBounds): TrackBounds {
      out.left = -HALF;
      out.right = HALF;
      return out;
    },
    laneSide(i: number): number {
      return LANE_X[i < 0 ? 0 : i >= LANE_X.length ? LANE_X.length - 1 : i];
    },
    sections,
    segments,
    chunks,
    cull,
    sample(s: number, out: TrackSample = trackSample()): TrackSample {
      const w = spline.wrap(s);
      spline.sample(w, sSample);
      const t = sSample.t, r = sSample.r;
      out.pos[0] = sSample.p[0];
      out.pos[1] = sSample.p[1];
      out.pos[2] = sSample.p[2];
      out.fwd[0] = t[0];
      out.fwd[1] = t[1];
      out.fwd[2] = t[2];
      out.right[0] = r[0];
      out.right[1] = 0;
      out.right[2] = r[2];
      // up = right × fwd.
      out.up[0] = r[1] * t[2] - r[2] * t[1];
      out.up[1] = r[2] * t[0] - r[0] * t[2];
      out.up[2] = r[0] * t[1] - r[1] * t[0];
      out.width = 2 * HALF;
      out.lanes = 3;
      const k = Math.min(nFlag - 1, Math.floor(w / FLAG_STEP));
      out.flags = flagTab[k];
      out.section = secTab[k];
      out.curv = ai.curvAt(w);
      return out;
    },
    laneOffset(lane: number): number {
      return LANE_X[lane < 0 ? 0 : lane >= LANE_X.length ? LANE_X.length - 1 : lane];
    },
    flagsAt(s: number): number {
      return flagTab[Math.min(nFlag - 1, Math.floor(spline.wrap(s) / FLAG_STEP))];
    },
    sectionAt(s: number): number {
      return secTab[Math.min(nFlag - 1, Math.floor(spline.wrap(s) / FLAG_STEP))];
    },
    aiLines: ai.lines,
    racingAt: ai.racingAt,
    curvAt: ai.curvAt,
    finish: { s: startS, section: 0 },
    gantries,
    cameras,
    avgZone: { s0: av.s0, s1: av.s1, limit: av.limit },
    roadworks,
    spits,
    tunnels,
    bridges,
    exits,
    landmarks,
    createView(): TrackView {
      return new TrackView(track, allItems);
    },
    closure: lay.gap,
    trisTotal,
  };
  return track;
}

/** The shared constants of the cross-section (tests, wave B). */
export const A10_CROSS = { half: HALF, centralBarrier: CB, oncomingEdge: LO, lanes: LANE_X, laneWidth: LANE_WIDTH, nearField: NEAR_FIELD } as const;
