/**
 * TRACK's r3 builders (docs/api/rally.md "A.T The track"): road.ts (the mesh accumulator, the
 * cross-section extrusion with its subdivision control, boxes and fans) and cull.ts (the frustum of
 * a Cam3, the culling set sorted near → far).
 */
import { describe, expect, it } from 'vitest';
import { CullSet, Frustum } from '../../src/engine/r3/cull';
import { crossEdge, extrude, MeshAcc, rowsFor, type RoadRow } from '../../src/engine/r3/road';
import type { Cam3 } from '../../src/engine/view3d';

/** Rows straight along +z (right = −x: forward × up). */
function rowsZ(n: number, step: number): RoadRow[] {
  const rows: RoadRow[] = [];
  for (let i = 0; i <= n; i++) rows.push({ s: i * step, px: 0, py: 0, pz: i * step, rx: -1, rz: 0 });
  return rows;
}

function cam(o: Partial<Cam3> = {}): Cam3 {
  return { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fovY: Math.PI / 3, near: 0.5, far: 500, ...o };
}

describe('road.ts', () => {
  it('rowsFor: at least one row, each at most maxAlong', () => {
    expect(rowsFor(20, 7)).toBe(3);
    expect(rowsFor(21, 7)).toBe(3);
    expect(rowsFor(21.01, 7)).toBe(4);
    expect(rowsFor(3, 7)).toBe(1);
    expect(rowsFor(20, 0)).toBe(1);
  });

  it('extrude: pieces across × rows along, the uv in texels, normals from the edge, front faces up', () => {
    const acc = new MeshAcc();
    const rows = rowsZ(3, 5);
    const edge = crossEdge(-6, 0, 6, 0, 10, 58, 4, 2, 4, 0x808080);
    const tris = extrude(acc, rows, rows.map(() => [edge]), 0);
    expect(tris).toBe(3 * 3 * 2);
    expect(acc.vertices).toBe(4 * 4);
    // Row 1, piece 0: x = −6 → world x = +6 (right = −x); u 10, v = 5 · 4 + 2.
    const i = 4;
    expect(acc.pos[i * 3]).toBe(6);
    expect(acc.pos[i * 3 + 2]).toBe(5);
    expect(acc.uv[i * 2]).toBe(10);
    expect(acc.uv[i * 2 + 1]).toBe(22);
    expect(acc.uv[(i + 3) * 2]).toBe(58);
    for (let k = 0; k < acc.vertices; k++) expect(acc.nrm[k * 3 + 1]).toBe(1);
    const m = acc.toMesh('t', 1, 0);
    for (let t = 0; t < m.idx.length; t += 3) {
      const [a, b, c] = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
      const P = m.pos;
      const ex = P[b * 3] - P[a * 3], ez = P[b * 3 + 2] - P[a * 3 + 2];
      const fx = P[c * 3] - P[a * 3], fz = P[c * 3 + 2] - P[a * 3 + 2];
      // (b − a) × (c − a) · up > 0: counter-clockwise seen from above.
      expect(ez * fx - ex * fz).toBeGreaterThan(0);
    }
    expect(m.idx).toBeInstanceOf(Uint16Array);
    expect(m.blend).toBe('opaque');
    expect(m.emissive).toBeUndefined();
    expect(acc.toMesh('e', 1, 0, { emissive: true, twoSided: true }).emissive).toBe(true);
  });

  it('extrude: a wall walked bottom → top faces left; a degenerate edge (a wall of height 0) is left out', () => {
    const acc = new MeshAcc();
    const rows = rowsZ(1, 10);
    const wall = crossEdge(5, 0, 5, 2, 0, 8, 4, 0, 0, 0x808080);
    const flat = crossEdge(1, 0, 1, 0, 0, 0, 4, 0, 0, 0x808080);
    expect(extrude(acc, rows, rows.map(() => [wall, flat]), 0)).toBe(2);
    // Normal (−dy, dx) in (right, up): −right = +x here (right = −x).
    expect(acc.nrm[0]).toBe(1);
    expect(acc.nrm[1]).toBe(0);
    // A wall growing from height 0 to 2 along the rows still gets front faces along its normal.
    const acc2 = new MeshAcc();
    const grow = [crossEdge(5, 0, 5, 0, 0, 0, 4, 0, 0, 0x808080), crossEdge(5, 0, 5, 2, 0, 8, 4, 0, 0, 0x808080)];
    expect(extrude(acc2, rows, grow.map((e) => [e]), 0)).toBe(2);
    const m = acc2.toMesh('g', 1, 0);
    let good = 0;
    for (let t = 0; t < m.idx.length; t += 3) {
      const [a, b, c] = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
      const P = m.pos;
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
      const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = ey * fz - ez * fy;
      const area = Math.hypot(nx, ez * fx - ex * fz, ex * fy - ey * fx);
      if (area > 1e-9) {
        expect(nx).toBeGreaterThan(0);
        good++;
      }
    }
    expect(good).toBeGreaterThan(0);
  });

  it('obox, quad and fan: faces along their normals; the bounds follow the vertices', () => {
    const acc = new MeshAcc();
    acc.obox([0, 1, 0], [1, 0, 0], [0, 1, 0], [0, 0, 2], () => [0, 0, 4, 4], 0x808080);
    expect(acc.triangles).toBe(10);
    expect(acc.minX).toBe(-1);
    expect(acc.maxZ).toBe(2);
    expect(acc.minY).toBe(0);
    acc.fan([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 1, 1, 0x808080, [0, 1, 0]);
    expect(acc.triangles).toBe(12);
    const m = acc.toMesh('b', 1, 0);
    for (let t = 0; t < m.idx.length; t += 3) {
      const [a, b, c] = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
      const P = m.pos, N = m.nrm!;
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
      const fx = P[c * 3] - P[a * 3], fy = P[c * 3 + 1] - P[a * 3 + 1], fz = P[c * 3 + 2] - P[a * 3 + 2];
      const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
      expect(cx * N[a * 3] + cy * N[a * 3 + 1] + cz * N[a * 3 + 2]).toBeGreaterThan(0);
    }
  });
});

describe('cull.ts', () => {
  it('the frustum of a camera looking along +z (yaw 0)', () => {
    const f = new Frustum().set(cam(), 16 / 9);
    expect(f.sphere(0, 0, 10, 0.1)).toBe(true);
    expect(f.sphere(0, 0, -10, 1)).toBe(false);
    expect(f.sphere(0, 0, -10, 11)).toBe(true);
    expect(f.sphere(0, 0, 600, 1)).toBe(false);
    expect(f.sphere(100, 0, 10, 1)).toBe(false);
    expect(f.sphere(0, 100, 10, 1)).toBe(false);
    // A far plane closer than the camera's own (the fog's end).
    const g = new Frustum().set(cam(), 16 / 9, 100);
    expect(g.sphere(0, 0, 150, 1)).toBe(false);
    // Turned left (yaw + = left): +x is ahead now.
    const h = new Frustum().set(cam({ yaw: Math.PI / 2 }), 16 / 9);
    expect(h.sphere(10, 0, 0, 0.1)).toBe(true);
    expect(h.sphere(0, 0, 10, 0.1)).toBe(false);
    // Points: all outside one plane → false.
    expect(f.points(Float64Array.from([0, 0, -5, 1, 0, -5, 0, 1, -5]), 0, 3)).toBe(false);
    expect(f.points(Float64Array.from([0, 0, -5, 0, 0, 5]), 0, 2)).toBe(true);
  });

  it('a CullSet returns the visible units sorted near → far, within the distance', () => {
    const set = new CullSet(5);
    const zs = [50, 10, -30, 300, 30];
    zs.forEach((z, i) => set.setBox(i, 0, 0, z, [1, 0, 0], [0, 1, 0], [0, 0, 1]));
    const f = new Frustum().set(cam(), 16 / 9);
    const n = set.cull(f, 0, 0, 0, 200);
    expect(Array.from(set.out.slice(0, n))).toEqual([1, 4, 0]);
    expect(set.r[0]).toBeCloseTo(Math.sqrt(3), 9);
    // A box beside the camera but its hull corner reaches into the view.
    const side = new CullSet(1);
    side.setBox(0, 30, 0, 5, [26, 0, 0], [0, 1, 0], [0, 0, 1]);
    expect(side.cull(f, 0, 0, 0, 200)).toBe(1);
  });
});
