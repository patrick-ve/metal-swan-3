/**
 * The perspective floor's engine maths (docs/design/floor.md §1, §3.2; src/engine/floor/): the
 * camera's identities, the height field's mesh (exact against the field, faces where heights
 * differ), the rows layout of the chunk textures and the tiles' v-mips.
 */
import { describe, expect, it } from 'vitest';
import {
  depthAtV,
  dvdy,
  FLOOR_CX,
  makeFloorCam,
  projX,
  projY,
  sAtDepth,
  shiftX,
  sOfV,
  sOfY,
  vAtDepth,
  vOfY,
  yOfV,
} from '../../src/engine/floor/cam';
import {
  buildFloorMesh,
  heightAt,
  meshHeightAt,
  QUAD_FACE_UN,
  QUAD_FACE_UP,
  QUAD_FACE_V,
  QUAD_TOP,
  type FieldInput,
} from '../../src/engine/floor/mesh';
import { bakeChunkRows, bakeTile } from '../../src/engine/floor/tex';
import { BAND_TILE_LEVELS, chainLevel, chunkCols, rowOf, rowsOf, sharpWeight, tileLevel } from '../../src/engine/floor/tex-layout';
import { PixelBuffer } from '../../src/engine/pixel';

const cam = makeFloorCam({ yh: 60, f: 210, back: 146 });

describe('floor camera (spec §1.1)', () => {
  it('the walk line is the plain 2D world: s 1, v 0, x′ = u − camX, y′ = yw − h − camY', () => {
    expect(sOfY(cam, 176)).toBe(1);
    expect(vOfY(cam, 176)).toBeCloseTo(0, 12);
    expect(yOfV(cam, 0)).toBeCloseTo(176, 12);
    for (const camX of [0, 13.5, 1234.25]) {
      for (const u of [camX - 50, camX + 7.25, camX + 400]) expect(projX(cam, u, 0, camX)).toBeCloseTo(u - camX, 9);
    }
    expect(projY(cam, 0, 14, 0)).toBeCloseTo(162, 12);
    expect(projY(cam, 0, 0, 3)).toBeCloseTo(173, 12);
  });

  it('v(y) and y(v) invert each other; rows scroll at s(y); depth ↔ v', () => {
    for (let y = 146; y <= 228; y += 3.5) {
      const v = vOfY(cam, y);
      expect(yOfV(cam, v)).toBeCloseTo(y, 9);
      expect(sOfV(cam, v)).toBeCloseTo(sOfY(cam, y), 12);
      // A camera step Δ moves a flat row by s·Δ.
      const u = 1000;
      const d = projX(cam, u, v, 500) - projX(cam, u, v, 501);
      expect(d).toBeCloseTo(sOfY(cam, y), 9);
      // Depth D = screen px behind the walk line on flat ground.
      expect(depthAtV(cam, vAtDepth(cam, 176 - y))).toBeCloseTo(176 - y, 9);
      expect(sAtDepth(cam, 176 - y)).toBeCloseTo(sOfY(cam, y), 12);
    }
    // The back edge 30 px behind: s = 1 − 30/116.
    expect(sAtDepth(cam, 30)).toBeCloseTo(86 / 116, 12);
    expect(cam.vBack).toBeCloseTo(vOfY(cam, 146), 12);
    // dv/dy is the derivative of v(y).
    expect(dvdy(cam, 170)).toBeCloseTo((vOfY(cam, 170.001) - vOfY(cam, 169.999)) / 0.002, 4);
  });

  it('shiftX puts a point at its depth\'s screen x through a renderer camera (decor, drawDepth, lights)', () => {
    for (const depth of [-16.5, 0, 14, 30]) {
      const camX = 777.5;
      const x = 900;
      const s = sAtDepth(cam, depth);
      expect(shiftX(cam, x, depth, camX) - camX).toBeCloseTo(FLOOR_CX + (x - camX - FLOOR_CX) * s, 9);
    }
  });

  it('rejects a camera that cannot make a floor', () => {
    expect(() => makeFloorCam({ yh: 60, f: 210, back: 50 })).toThrow();
    expect(() => makeFloorCam({ yh: 60, f: 0, back: 146 })).toThrow();
  });
});

/** A profile with a hump (as ams a's bridges), a step and a gap, a kerb strip, a cut and a deck. */
function field(): FieldInput {
  return {
    segments: [
      { x0: -200, y0: 176, x1: 100, y1: 176 },
      { x0: 100, y0: 176, x1: 140, y1: 162 },
      { x0: 140, y0: 162, x1: 180, y1: 176 },
      { x0: 180, y0: 176, x1: 300, y1: 176 },
      // a step up of 8 at 300
      { x0: 300, y0: 168, x1: 400, y1: 168 },
      // a gap 400–460
      { x0: 460, y0: 176, x1: 900, y1: 176 },
    ],
    yw: 176,
    uMin: -100,
    uMax: 800,
    vBack: cam.vBack,
    vFront: cam.vFront,
    regions: [
      // the far pavement: +1.5 behind v −40, bending to −30 between u 200 and 240
      { u0: -Infinity, u1: Infinity, v0: cam.vBack, v1: [[200, -40], [240, -30]], dh: 1.5, surface: -1, face: 0 },
      // a water cut 600–700 at level −4, a deck over it around v 0
      { u0: 600, u1: 700, v0: cam.vBack, v1: cam.vFront, level: -4, surface: 1, face: 2 },
      { u0: 600, u1: 700, v0: -8, v1: 8, dh: 0, surface: -1, face: 3 },
    ],
    baseFace: 4,
    pit: { level: -48, surface: 5, face: 6 },
  };
}

describe('floor height field and mesh (spec §1.2)', () => {
  const f = field();
  const mesh = buildFloorMesh(f);

  it('the drawn height equals the field everywhere (cells are exact planes)', () => {
    let n = 0;
    for (let u = -99.5; u < 799; u += 3.7) {
      for (let v = cam.vBack + 0.25; v < cam.vFront; v += 2.9) {
        const want = heightAt(f, u, v);
        const got = meshHeightAt(mesh, u, v);
        expect(Math.abs(got - want), `u ${u} v ${v}`).toBeLessThan(1e-3);
        n++;
      }
    }
    expect(n).toBeGreaterThan(5000);
  });

  it('the cylinder rule: the hump runs across the band; the gap is a pit; the deck is on the walk profile', () => {
    expect(heightAt(f, 140 - 1e-9, -60)).toBeCloseTo(14 - 1e-9 * 0.35 + 1.5, 3);
    expect(heightAt(f, 120, 30)).toBeCloseTo(7, 6);
    expect(heightAt(f, 430, 0)).toBe(-48);
    expect(heightAt(f, 650, 20)).toBe(-4);
    expect(heightAt(f, 650, 0)).toBe(0);
    expect(heightAt(f, 650, -60)).toBe(-4);
  });

  it('builds faces where heights differ: kerb (+v), deck side (+v), step and quay walls (±u); none facing away from the eye along v', () => {
    const kinds = new Map<number, Set<number>>();
    for (let q = 0; q < mesh.quadCount; q++) {
      const k = mesh.quadKind[q];
      if (k === QUAD_TOP) continue;
      if (!kinds.has(k)) kinds.set(k, new Set());
      kinds.get(k)?.add(mesh.quadMat[q]);
    }
    // +v faces: the kerb (0) and the deck side (3); the cut's far wall faces away: none of material 2 along v.
    expect([...(kinds.get(QUAD_FACE_V) ?? [])].sort()).toEqual([0, 3]);
    // u faces: the step (base face 4), the pit walls (6), the quay walls (2).
    const uf = new Set([...(kinds.get(QUAD_FACE_UP) ?? []), ...(kinds.get(QUAD_FACE_UN) ?? [])]);
    for (const m of [2, 4, 6]) expect(uf.has(m)).toBe(true);
    // Quads are sorted by u (the per-frame cull).
    for (let q = 1; q < mesh.quadCount; q++) {
      expect(mesh.quadU0[q]).toBeGreaterThanOrEqual(mesh.quadU0[q - 1]);
      expect(mesh.quadU1[q]).toBeGreaterThanOrEqual(mesh.quadU1[q - 1]);
    }
    // No top quad crosses a chunk edge (one texture per quad).
    for (let q = 0; q < mesh.quadCount; q++) {
      if (mesh.quadChunk[q] < 0) continue;
      expect(Math.floor(mesh.quadU0[q] / 256)).toBe(mesh.quadChunk[q]);
      expect(Math.ceil(mesh.quadU1[q] / 256) - 1).toBe(mesh.quadChunk[q]);
    }
  });
});

describe('floor textures (spec §3.2, tex-layout.ts)', () => {
  it('a chunk row is the screen row of flat ground: row j ↔ y = back + (j + ½)/d', () => {
    for (const d of [1, 2, 4]) {
      expect(rowsOf(cam, d)).toBe(Math.ceil((cam.front - cam.back) * d));
      for (let j = 0; j < rowsOf(cam, d); j += 7) expect(rowOf(cam, d, vOfY(cam, cam.back + (j + 0.5) / d))).toBeCloseTo(j, 6);
    }
  });

  it('bakes a chunk as the box filter of the painter over each row\'s v range, with aprons', () => {
    const d = 2;
    const buf = new PixelBuffer(chunkCols(d), rowsOf(cam, d));
    // A painter linear in v: every texel is the mean over its row's v range (the middle of it).
    bakeChunkRows(cam, 3, d, (_u, v) => ((Math.round(v + 150) & 255) << 24 | 255) >>> 0, buf);
    for (let j = 0; j < buf.h; j += 5) {
      const va = vOfY(cam, cam.back + j / d);
      const vb = vOfY(cam, cam.back + (j + 1) / d);
      expect(Math.abs((buf.data[j * buf.w + 9] >>> 24) - ((va + vb) / 2 + 150)), `row ${j}`).toBeLessThanOrEqual(1);
    }
    // Column 0 is the apron: u = 3·256 − ½/d.
    const us: number[] = [];
    bakeChunkRows(cam, 3, d, (u) => {
      us.push(u);
      return 0x000000ff;
    }, new PixelBuffer(chunkCols(d), 1), 0, 2);
    const cols = [...new Set(us)];
    expect(cols[0]).toBeCloseTo(768 - 0.25, 9);
    expect(cols[1]).toBeCloseTo(768 + 0.25, 9);
  });

  it('tiles: level 0 at texel centres, v-mips halve the rows only, down to the one-row mean', () => {
    const lv = bakeTile({ w: 8, h: 8, paint: (_a, b) => (Math.floor(b) % 2 === 0 ? 0xffffffff : 0x000000ff) }, 2);
    expect(lv.map((l) => [l.w, l.h])).toEqual([
      [16, 16],
      [16, 8],
      [16, 4],
      [16, 2],
      [16, 1],
    ]);
    // Rows of 2 white + 2 black texels at d 2 → level 1 alternates, level 2 is grey (the band's
    // levels are unchanged: BAND_TILE_LEVELS), and so is the one-row mean at the end of the chain.
    expect(BAND_TILE_LEVELS).toBe(3);
    expect(lv[1].data[0] >>> 24).toBe(255);
    expect(lv[1].data[16] >>> 24).toBe(0);
    expect(lv[2].data[0] >>> 24).toBe(128);
    expect(lv[4].data[0] >>> 24).toBe(128);
    // An odd level: its last row takes the three rows above it (every row counts once).
    const odd = bakeTile({ w: 1, h: 12, paint: (_a, b) => (b < 4 ? 0xffffffff : 0x000000ff) }, 1);
    expect(odd.map((l) => l.h)).toEqual([12, 6, 3, 1]);
    expect(odd[odd.length - 1].data[0] >>> 24).toBe(Math.round((4 * 255) / 12));
  });

  it('the quads pick their level from the whole chain: round(log2(footprint)), to the last level', () => {
    expect(chainLevel(1, 6)).toBe(0);
    expect(chainLevel(2, 6)).toBe(1);
    expect(chainLevel(4, 6)).toBe(2);
    expect(chainLevel(40, 6)).toBe(5);
    expect(chainLevel(1e6, 6)).toBe(6);
  });

  it('sharp bilinear and the tile level', () => {
    expect(sharpWeight(0.3, 1)).toBeCloseTo(0.3, 12);
    expect(sharpWeight(0.3, 4)).toBe(0);
    expect(sharpWeight(0.55, 4)).toBeCloseTo(0.7, 12);
    expect(tileLevel(1)).toBe(0);
    expect(tileLevel(2)).toBe(1);
    expect(tileLevel(4)).toBe(2);
  });
});
