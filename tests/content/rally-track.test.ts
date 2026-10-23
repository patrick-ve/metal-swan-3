/**
 * The compressed A10 (docs/design/rally.md §3, §4, §7; docs/api/rally.md "A.T The track"): the
 * table's layout closes, the length and the curves are in range, the frames are orthonormal, the
 * lanes lie inside the barriers, the flags sit in the right sections, the meshes are valid and
 * deterministic (a pinned hash), the per-view budget holds along the whole lap, the near polygons
 * are small enough for the affine warp, the grid and the finish, the texture page (16-colour banks
 * of PAL_HD), the AI lines, and the registry.
 */
import { describe, expect, it } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { atan2T, TAU } from '../../src/engine/r3/trig';
import type { Cam3, DrawItem, Mesh3 } from '../../src/engine/view3d';
import { loadContent } from '../../src/game/content/index';
import { A10_CROSS, A10_TABLE, buildA10, LOD_NEAR, SECTION_IDS, TF, TRACK_TRI_BUDGET, trackSample, type A10Track } from '../../src/game/content/rally/track/index';
import { layoutTrack, type Bump } from '../../src/game/content/rally/track/layout';
import { A10_FINISH_AT, A10_YAW0, B, S, type SectionSpec } from '../../src/game/content/rally/track/table';
import { trackTex } from '../../src/game/content/rally/track/tex-road';
import { CLUT_4BIT } from '../../src/game/content/rally/tex/kit';
import { rallyTrack } from '../../src/game/rally/registry';
import { loadRallyContent } from '../../src/game/scenes/rally-route';

const track: A10Track = buildA10(A10_TABLE);
const H = A10_CROSS.half;
const sec = (id: string): number => track.sections.findIndex((s) => s.id === id);
const inSec = (s: number, id: string): boolean => {
  const q = track.sections[sec(id)];
  return s >= q.s0 - 1e-6 && s < q.s1 + 1e-6;
};

/** FNV-1a over the bytes of every mesh and page (the determinism pin). */
function hashTrack(t: A10Track): number {
  let h = 0x811c9dc5;
  const mix = (b: number): void => {
    h ^= b & 255;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const bytes = (a: ArrayBufferView): void => {
    const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    for (let i = 0; i < u.length; i++) mix(u[i]);
  };
  for (const m of t.meshes) {
    for (let i = 0; i < m.id.length; i++) mix(m.id.charCodeAt(i));
    bytes(m.pos);
    bytes(m.uv);
    bytes(m.rgb);
    bytes(m.idx);
  }
  for (const p of t.pages) {
    bytes(p.index);
    bytes(p.clut);
  }
  return h;
}

/** A chase camera at arc length s on the racing line (spec §7.6: about 65°, 6 m behind, 2.3 m up). */
function chaseCam(t: A10Track, s: number, fovDeg: number): Cam3 {
  const q = t.sample(s);
  const side = t.racingAt(s);
  return {
    pos: [q.pos[0] + q.right[0] * side - q.fwd[0] * 6.3, q.pos[1] + 2.3, q.pos[2] + q.right[2] * side - q.fwd[2] * 6.3],
    yaw: atan2T(q.fwd[0], q.fwd[2]),
    pitch: -0.12,
    roll: 0,
    fovY: (fovDeg * Math.PI) / 180,
    near: 0.5,
    far: 600,
  };
}

describe('the layout of THE TABLE', () => {
  const bumps = (): Bump[] => [];
  it('closes exactly: the end meets the start within 1 mm, with the start heading (clockwise: −360°)', () => {
    const lay = layoutTrack(A10_TABLE, A10_YAW0, bumps);
    const p = lay.position(lay.length - 1e-9, [0, 0]);
    expect(Math.abs(p[0])).toBeLessThan(1e-3);
    expect(Math.abs(p[1])).toBeLessThan(1e-3);
    const turn = lay.heading(lay.length - 1e-9) - lay.heading(0);
    expect(Math.abs(turn + TAU)).toBeLessThan(1e-6);
    // The closure only nudged the two closure straights (the table is balanced).
    expect(Math.abs(lay.closeDx)).toBeLessThan(60);
    expect(Math.abs(lay.closeDz)).toBeLessThan(60);
  });

  it('the spline is continuous over the start line and its arc length is monotonic', () => {
    const a = track.sample(track.length - 0.05).pos;
    const b = track.sample(0).pos;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.1);
    const S0 = track.spline.tableS;
    for (let i = 1; i < S0.length; i++) expect(S0[i]).toBeGreaterThan(S0[i - 1]);
    expect(track.length).toBeCloseTo(track.spline.length, 9);
  });

  it('about 6.5 km (spec decision 19), a rough likeness: wider than 1.5 km each way, the start heading west', () => {
    expect(track.length).toBeGreaterThan(6000);
    expect(track.length).toBeLessThan(7200);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let s = 0; s < track.length; s += 10) {
      const p = track.sample(s).pos;
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[2]);
      z1 = Math.max(z1, p[2]);
    }
    expect(x1 - x0).toBeGreaterThan(1500);
    expect(z1 - z0).toBeGreaterThan(1500);
    const f = track.sample(track.startS).fwd;
    expect(f[0]).toBeLessThan(-0.95);
    // The sides: West heads north (−z), Noord east (+x), Oost south (+z).
    expect(track.sample((track.sections[sec('ring-west')].s0 + track.sections[sec('ring-west')].s1) / 2).fwd[2]).toBeLessThan(-0.95);
    expect(track.sample(track.sections[sec('noord')].s0 + 700).fwd[0]).toBeGreaterThan(0.95);
    expect(track.sample(track.sections[sec('oost')].s0 + 100).fwd[2]).toBeGreaterThan(0.95);
  });

  it('gentle curves: no radius under 250 m (no hairpins), some bends under 350 m (racing interest)', () => {
    let kMax = 0;
    for (let s = 0; s < track.length; s += 2) kMax = Math.max(kMax, Math.abs(track.curvAt(s)));
    expect(1 / kMax).toBeGreaterThanOrEqual(250);
    expect(1 / kMax).toBeLessThan(350);
    // Clockwise: the right turns win by a full turn.
    let turn = 0;
    for (let s = 0; s < track.length; s += 1) turn += track.curvAt(s + 0.5);
    expect(turn).toBeCloseTo(-TAU, 1);
  });

  it('rejects a table that does not turn a full clockwise loop', () => {
    const bad: SectionSpec[] = A10_TABLE.map((s) => ({ ...s }));
    bad[9] = { ...bad[9], elems: [S(240), B(-10, 800)] };
    expect(() => layoutTrack(bad, A10_YAW0, () => [])).toThrow(/−360/);
  });
});

describe('the frame, the lanes and the flags', () => {
  it('orthonormal frames everywhere; right is horizontal; up points up', () => {
    const q = trackSample();
    for (let s = 0; s < track.length; s += 7) {
      track.sample(s, q);
      const d = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      expect(d(q.fwd, q.fwd)).toBeCloseTo(1, 9);
      expect(d(q.right, q.right)).toBeCloseTo(1, 9);
      expect(d(q.up, q.up)).toBeCloseTo(1, 9);
      expect(Math.abs(d(q.fwd, q.right))).toBeLessThan(1e-9);
      expect(Math.abs(d(q.fwd, q.up))).toBeLessThan(1e-9);
      expect(Math.abs(d(q.right, q.up))).toBeLessThan(1e-9);
      expect(q.right[1]).toBe(0);
      expect(q.up[1]).toBeGreaterThan(0.99);
      expect(q.width).toBe(2 * H);
      expect(q.lanes).toBe(3);
    }
  });

  it('the lanes (and the shoulder) lie inside the barriers and do not overlap', () => {
    const b = { left: 0, right: 0 };
    track.bounds!(123, b);
    expect(b.left).toBe(-H);
    expect(b.right).toBe(H);
    const w = track.laneWidth;
    for (let i = 0; i <= 3; i++) {
      const x = track.laneOffset(i);
      expect(x - w / 2).toBeGreaterThanOrEqual(-H);
      expect(x + (i === 3 ? 3.25 : w) / 2).toBeLessThanOrEqual(H);
      if (i > 0) expect(x - track.laneOffset(i - 1)).toBeGreaterThanOrEqual((w + (i === 3 ? 3.25 : w)) / 2 - 1e-9);
      expect(track.laneSide!(i, 500)).toBe(x);
    }
  });

  it('ten sections in order, contiguous, covering the lap', () => {
    expect(track.sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
    expect(track.sections[0].s0).toBeCloseTo(0, 6);
    for (let i = 1; i < track.sections.length; i++) expect(track.sections[i].s0).toBeCloseTo(track.sections[i - 1].s1, 6);
    expect(track.sections[9].s1).toBeCloseTo(track.length, 6);
    for (const s of track.sections) expect(s.s1 - s.s0).toBeGreaterThan(200);
    for (let s = 0; s < track.length; s += 50) expect(track.sections[track.sectionAt(s)].id).toBe(track.sections.find((q) => s >= q.s0 && s < q.s1)!.id);
  });

  it('two tunnels in their sections: the tube 8 m down with ramps, sodium lamps, no gantries inside', () => {
    expect(track.tunnels.map((t) => t.name)).toEqual(['COENTUNNEL', 'ZEEBURGERTUNNEL']);
    const ids = ['coentunnel', 'zeeburgertunnel'];
    track.tunnels.forEach((t, i) => {
      expect(inSec(t.s0, ids[i]) && inSec(t.s1, ids[i])).toBe(true);
      expect(t.s1 - t.s0).toBeGreaterThan(200);
      const mid = (t.s0 + t.s1) / 2;
      expect(track.sample(mid).pos[1]).toBeCloseTo(-8, 3);
      expect(track.flagsAt(mid) & TF.tunnel).toBeTruthy();
      expect(track.flagsAt(mid) & TF.water).toBeTruthy();
      expect(track.flagsAt(t.ramp0 + 30) & TF.cutting).toBeTruthy();
      expect(track.flagsAt(t.ramp0 - 30) & (TF.cutting | TF.tunnel)).toBe(0);
      for (const g of track.gantries) expect(g.s > t.s0 && g.s < t.s1).toBe(false);
      for (const c of track.cameras) expect(c.s > t.ramp0 && c.s < t.ramp1).toBe(false);
    });
    // The tube segments have an emissive interior (their own lamps).
    const tube = track.segments.filter((s) => s.flags & TF.tunnel);
    expect(tube.length).toBeGreaterThan(20);
    for (const s of tube) expect(s.inner).not.toBeNull();
    const inner = track.meshes.find((m) => m.id === tube[3].inner)!;
    expect(inner.emissive).toBe(true);
  });

  it('decks: three bridges over water (Schinkel, a canal in Noord, the Amstel) and two viaducts, about 6 m up', () => {
    const where = (n: string): string => track.sections[track.sectionAt(track.bridges.find((b) => b.name === n)!.s0)].id;
    expect(track.bridges.filter((b) => b.kind === 'bridge').map((b) => b.name)).toEqual(['SCHINKELBRUG', 'KANAALBRUG', 'AMSTELBRUG']);
    expect(where('SCHINKELBRUG')).toBe('nieuwe-meer');
    expect(where('KANAALBRUG')).toBe('noord');
    expect(where('AMSTELBRUG')).toBe('amstel');
    expect(track.bridges.filter((b) => b.kind === 'viaduct')).toHaveLength(2);
    for (const b of track.bridges) {
      const mid = (b.s0 + b.s1) / 2;
      expect(track.sample(mid).pos[1]).toBeGreaterThan(5.5);
      expect(track.flagsAt(mid) & (b.kind === 'bridge' ? TF.bridge : TF.viaduct)).toBeTruthy();
    }
  });

  it('gantries about every 400 m (the start gantry at the finish line), about 3 speed cameras, one average-speed zone in RING WEST', () => {
    const gs = track.gantries.map((g) => g.s).sort((a, b) => a - b);
    expect(gs.length).toBeGreaterThanOrEqual(14);
    expect(gs.length).toBeLessThanOrEqual(20);
    expect(track.length / gs.length).toBeGreaterThan(330);
    expect(track.length / gs.length).toBeLessThan(480);
    for (let i = 0; i < gs.length; i++) {
      const gap = (i + 1 < gs.length ? gs[i + 1] : gs[0] + track.length) - gs[i];
      // Tunnels have none: the longest gap spans a tube.
      expect(gap).toBeLessThan(950);
    }
    const start = track.gantries.find((g) => g.kind === 'start')!;
    expect(start.s).toBeCloseTo(track.startS, 6);
    expect(track.gantries.filter((g) => g.kind === 'avg-start' || g.kind === 'avg-end')).toHaveLength(2);
    expect(track.cameras.length).toBeGreaterThanOrEqual(2);
    expect(track.cameras.length).toBeLessThanOrEqual(4);
    for (const c of track.cameras) expect(c.side).toBeGreaterThan(H);
    expect(inSec(track.avgZone.s0, 'ring-west') && inSec(track.avgZone.s1, 'ring-west')).toBe(true);
    expect(track.avgZone.s1 - track.avgZone.s0).toBeGreaterThan(350);
    expect(track.flagsAt((track.avgZone.s0 + track.avgZone.s1) / 2) & TF.avgZone).toBeTruthy();
  });

  it('lap events: 2–3 road-works zones (lap 2), spitsstrook stretches (lap 3), S-exits with the ring names, landmark anchors', () => {
    expect(track.roadworks.length).toBeGreaterThanOrEqual(2);
    expect(track.roadworks.length).toBeLessThanOrEqual(3);
    for (const r of track.roadworks) {
      expect(r.s1).toBeGreaterThan(r.s0);
      expect(r.closed.length).toBeGreaterThan(0);
      for (const l of r.closed) expect(l >= 0 && l <= 3).toBe(true);
      expect(track.flagsAt((r.s0 + r.s1) / 2) & TF.roadworks).toBeTruthy();
      expect(track.flagsAt((r.s0 + r.s1) / 2) & TF.tunnel).toBe(0);
    }
    expect(track.spits.length).toBeGreaterThanOrEqual(2);
    for (const r of track.spits) expect(track.flagsAt((r.s0 + r.s1) / 2) & TF.spits).toBeTruthy();
    const codes = track.exits.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('S113');
    expect(track.exits.find((e) => e.code === 'S113')!.name).toBe('WATERGRAAFSMEER');
    expect(track.sections[track.exits.find((e) => e.code === 'S102')!.section].id).toBe('sloterdijk');
    for (const e of track.exits) expect(track.flagsAt(e.s - 20) & TF.exit).toBeTruthy();
    for (const id of SECTION_IDS) expect(track.landmarks.some((l) => track.sections[l.section].id === id)).toBe(true);
    // Landmark ids are generic (no company names): lower-case words and dashes.
    for (const l of track.landmarks) expect(l.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('the start grid: 8 slots two wide behind the line in the lanes, pole first; the finish at the Zuidas', () => {
    expect(track.startS).toBeCloseTo(track.sections[0].s0 + A10_FINISH_AT, 0);
    expect(track.finish.s).toBe(track.startS);
    expect(track.sections[track.finish.section].id).toBe('zuidas');
    expect(track.grid).toHaveLength(8);
    const sides = new Set(track.grid.map((g) => g.side));
    expect(sides.size).toBe(2);
    track.grid.forEach((g, i) => {
      expect(g.s).toBeLessThan(track.startS);
      expect(g.s).toBeGreaterThan(track.startS - 45);
      expect(Math.abs(g.side) + 1).toBeLessThan(H);
      expect(g.side).toBeGreaterThan(track.laneOffset(0) - 1.75);
      expect(g.side).toBeLessThan(track.laneOffset(2) + 1.75);
      if (i > 0) expect(g.s).toBeLessThan(track.grid[i - 1].s);
    });
    expect(track.parLapTicks).toBeGreaterThan(120 * 60);
    expect(track.parLapTicks).toBeLessThan(160 * 60);
  });
});

describe('the meshes', () => {
  it('valid meshes on one 256² page: indices, uv inside the page across, colour, normals; ids unique', () => {
    const page = track.pages[0];
    expect(track.pages).toHaveLength(1);
    expect(page.w).toBe(256);
    expect(page.h).toBe(256);
    const ids = new Set<string>();
    for (const m of track.meshes) {
      expect(ids.has(m.id), m.id).toBe(false);
      ids.add(m.id);
      const n = m.pos.length / 3;
      expect(m.uv.length).toBe(n * 2);
      expect(m.rgb.length).toBe(n * 3);
      expect(m.nrm!.length).toBe(n * 3);
      expect(m.idx.length % 3).toBe(0);
      expect(m.page).toBe(page.id);
      expect(m.clutRow).toBe(0);
      for (let i = 0; i < m.idx.length; i++) expect(m.idx[i]).toBeLessThan(n);
      for (let i = 0; i < n; i++) {
        expect(m.uv[i * 2]).toBeGreaterThanOrEqual(0);
        expect(m.uv[i * 2]).toBeLessThanOrEqual(256);
        expect(Number.isFinite(m.pos[i * 3]) && Number.isFinite(m.pos[i * 3 + 1]) && Number.isFinite(m.pos[i * 3 + 2])).toBe(true);
      }
      expect(m.id.startsWith('track/')).toBe(true);
    }
    // Every mesh has a draw item for the culler; the static list holds one complete level of detail.
    expect(track.items.every((it) => it.m === null && ids.has(it.mesh))).toBe(true);
    expect(track.items.some((it) => it.mesh.endsWith('/far') && it.mesh.startsWith('track/seg/'))).toBe(false);
    expect(track.segments.length).toBeGreaterThan(300);
    for (const s of track.segments) {
      expect(s.s1 - s.s0).toBeGreaterThan(18);
      expect(s.s1 - s.s0).toBeLessThan(22);
      expect(ids.has(s.mesh) && ids.has(s.meshFar)).toBe(true);
      expect(s.trisFar).toBeLessThan(s.tris);
    }
  });

  it('the front faces face their normals (counter-clockwise from the normal side)', () => {
    let checked = 0;
    for (const m of track.meshes.slice(0, 60)) {
      for (let t = 0; t < m.idx.length; t += 3) {
        const [a, b, c] = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
        const P = m.pos, N = m.nrm!;
        const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
        const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
        const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
        const area = Math.hypot(cx, cy, cz);
        if (area < 1e-3) continue;
        expect((cx * N[a * 3] + cy * N[a * 3 + 1] + cz * N[a * 3 + 2]) / area).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it('the placeholder props can be left out (wave B dresses the gantries itself)', () => {
    const bare = buildA10(A10_TABLE, { props: false });
    expect(bare.trisTotal).toBeLessThan(track.trisTotal);
    expect(bare.gantries).toHaveLength(track.gantries.length);
    expect(bare.length).toBe(track.length);
  });

  it('deterministic: two builds give the same bytes (the pinned hash)', () => {
    const again = buildA10(A10_TABLE);
    expect(hashTrack(again)).toBe(hashTrack(track));
    expect(hashTrack(track)).toMatchInlineSnapshot(`2477415180`);
  });

  it('the subdivision near the road: road polygons ≤ 3.75 m across and ≤ 7 m along (the affine warp reads)', () => {
    let tris = 0;
    let maxEdge = 0;
    const q = trackSample();
    for (const seg of track.segments.slice(0, 120)) {
      const m = track.meshes.find((x) => x.id === seg.mesh)!;
      const P = m.pos;
      for (let t = 0; t < m.idx.length; t += 3) {
        // Triangles on the driven road: every vertex at the road's height, inside the barriers.
        let onRoad = true;
        for (let k = 0; k < 3; k++) {
          const v = m.idx[t + k];
          const s = track.spline.nearest(P[v * 3], P[v * 3 + 2], (seg.s0 + seg.s1) / 2, 30);
          track.sample(s, q);
          const lat = (P[v * 3] - q.pos[0]) * q.right[0] + (P[v * 3 + 2] - q.pos[2]) * q.right[2];
          if (Math.abs(lat) > H + 0.01 || Math.abs(P[v * 3 + 1] - q.pos[1]) > 0.01 || m.nrm![v * 3 + 1] < 0.99) onRoad = false;
        }
        if (!onRoad) continue;
        tris++;
        for (let k = 0; k < 3; k++) {
          const a = m.idx[t + k], b = m.idx[t + ((k + 1) % 3)];
          maxEdge = Math.max(maxEdge, Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 2] - P[b * 3 + 2]));
        }
      }
    }
    expect(tris).toBeGreaterThan(120 * 20);
    // The diagonal of a 3.75 m × 7 m quad (plus a little curve).
    expect(maxEdge).toBeLessThan(Math.hypot(3.75, 7) + 0.1);
  });

  it('the per-view budget along the whole lap: ≤ 4,000 track triangles and ≤ 60 draws (1P and 2P views)', () => {
    const view = track.createView();
    const out: DrawItem[] = [];
    let worst = 0;
    let worstDraws = 0;
    for (const [fov, aspect] of [
      [65, 384 / 216],
      [38, 384 / 108],
    ]) {
      for (let s = 0; s < track.length; s += 10) {
        const n = view.fill(chaseCam(track, s, fov), aspect, 420, out);
        expect(n).toBe(out.length);
        worst = Math.max(worst, view.tris);
        worstDraws = Math.max(worstDraws, view.draws);
      }
    }
    expect(worst).toBeLessThanOrEqual(TRACK_TRI_BUDGET);
    expect(worst).toBeGreaterThan(800);
    expect(worstDraws).toBeLessThanOrEqual(60);
    expect(LOD_NEAR).toBeGreaterThan(80);
  });

  it('culling: the road ahead is drawn nearest first, the road behind the camera is not', () => {
    const view = track.createView();
    const out: DrawItem[] = [];
    const s = 3000;
    view.fill(chaseCam(track, s, 65), 384 / 216, 420, out);
    const segOf = (id: string): number => Number(/track\/seg\/(\d+)/.exec(id)?.[1] ?? -1);
    const segs = out.map((it) => segOf(it.mesh)).filter((i) => i >= 0);
    const here = Math.floor(s / (track.length / track.segments.length));
    expect(segs).toContain(here + 2);
    expect(segs).toContain(here + 15);
    expect(segs).not.toContain(here - 6);
    expect(segs[0]).toBeGreaterThanOrEqual(here - 1);
    expect(segs[0]).toBeLessThanOrEqual(here + 1);
    // The same array again: no growth, the same result.
    const first = out.slice();
    view.fill(chaseCam(track, s, 65), 384 / 216, 420, out);
    expect(out).toEqual(first);
  });
});

describe('the texture page (spec §7.4)', () => {
  it('every strip uses one 16-colour bank of CLUT row 0; every colour is PAL_HD (or a cut-out)', () => {
    const tex = trackTex();
    const page = tex.page;
    expect(page.clut.length).toBe(256);
    for (let i = 0; i < 160; i++) {
      const c = page.clut[i];
      if (c !== 0) expect(inHdPalette(c), `entry ${i}`).toBe(true);
    }
    const strips = [tex.road, tex.roadBlock, tex.concrete, tex.grass, tex.tiles, tex.rail, tex.lamp, tex.earth, tex.water, tex.noise];
    for (const r of strips) {
      const banks = new Set<number>();
      const colours = new Set<number>();
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          const i = page.index[(r.y + y) * page.w + r.x + x];
          banks.add(Math.floor(i / CLUT_4BIT));
          colours.add(i);
        }
      }
      expect(banks.size, `strip at ${r.x}`).toBe(1);
      expect(colours.size).toBeLessThanOrEqual(16);
      expect(r.h).toBe(256);
    }
    // The cut-outs: the guard rail and the lamps have transparent texels.
    const clear = (r: { x: number; w: number }): boolean => {
      for (let y = 0; y < 256; y++) for (let x = 0; x < r.w; x++) if (page.clut[page.index[y * 256 + r.x + x]] === 0) return true;
      return false;
    };
    expect(clear(tex.rail)).toBe(true);
    expect(clear(tex.lamp)).toBe(true);
    expect(clear(tex.road)).toBe(false);
  });

  it('the road strips: white lane lines (dashed 4 m on 12 m off), block marks on the shoulder line', () => {
    const tex = trackTex();
    const page = tex.page;
    const col = (x: number, y: number): number => page.clut[page.index[y * 256 + x]];
    const white = (c: number): boolean => ((c >>> 24) & 255) > 150 && ((c >>> 16) & 255) > 150;
    let on = 0;
    for (let v = 0; v < 256; v++) if (white(col(tex.road.x + 13, v))) on++;
    expect(on).toBeGreaterThan(48);
    expect(on).toBeLessThan(80);
    let edge = 0;
    for (let v = 0; v < 256; v++) if (white(col(tex.road.x + 2, v))) edge++;
    expect(edge).toBeGreaterThan(200);
    let block = 0;
    for (let v = 0; v < 256; v++) if (white(col(tex.roadBlock.x + 36, v))) block++;
    expect(block).toBeGreaterThan(48);
    expect(block).toBeLessThan(80);
  });
});

describe('the AI lines and the registry', () => {
  it('the racing line stays on the lanes and goes to the inside of a bend', () => {
    const ai = track.aiLines;
    expect(ai.count).toBe(Math.ceil(track.length / ai.step));
    const lo = track.laneOffset(0) - 0.5, hi = track.laneOffset(2) + 0.5;
    for (let i = 0; i < ai.count; i++) {
      expect(ai.racing[i]).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(ai.racing[i]).toBeLessThanOrEqual(hi + 1e-9);
    }
    // The tightest right-hander: the line is right of the lanes' middle.
    let kMin = 0, sMin = 0;
    for (let s = 0; s < track.length; s += 5) {
      const k = track.curvAt(s);
      if (k < kMin) (kMin = k), (sMin = s);
    }
    expect(track.racingAt(sMin)).toBeGreaterThan((track.laneOffset(0) + track.laneOffset(2)) / 2 + 1);
    expect(ai.lanes).toEqual(A10_CROSS.lanes);
  });

  it('the registered track is the A10 (lazy content)', async () => {
    await loadContent();
    await loadRallyContent();
    const t = rallyTrack() as A10Track;
    expect(t.id).toBe('a10');
    expect(t.length).toBeCloseTo(track.length, 6);
    expect(typeof t.createView).toBe('function');
  });

  it('every mesh is reachable from a segment or a chunk (nothing uploaded in vain)', () => {
    const used = new Set<string>();
    for (const s of track.segments) for (const id of [s.mesh, s.inner, s.meshFar, s.innerFar]) if (id) used.add(id);
    for (const c of track.chunks) used.add(c.mesh);
    const unused = track.meshes.filter((m: Mesh3) => !used.has(m.id)).map((m) => m.id);
    expect(unused).toEqual([]);
  });
});
