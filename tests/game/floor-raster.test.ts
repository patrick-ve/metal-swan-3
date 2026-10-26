/**
 * The perspective floor's CPU raster and its smoothness proofs (docs/design/floor.md §2.7, §3.3):
 * - the walk-line row shows the texture at u − camX (the feet never slide);
 * - the band is closed (no gaps between triangles below the back edge, nothing above it);
 * - THE PAN TEST: for camera speeds 0.25, 0.5, 1, 2 and 3 px/tick on the debug floor, every floor
 *   row's phase between two frames (cross-correlation, sub-pixel) moves s(y)·Δ within 1/res;
 * - THE STILL TEST: a still camera draws the same band twice (an animated material only at the
 *   same tick);
 * - an animated material moves with the tick;
 * - the raster reuses its band buffer (that the frame path allocates nothing is sampled per floor
 *   section in floor-sections.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { sOfY } from '../../src/engine/floor/cam';
import { PAL } from '../../src/engine/palette';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { defineFloorPainter } from '../../src/game/mission/floor/registry';
import { ensureDebugFloor } from '../../src/game/mission/floor/debug';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FloorDef } from '../../src/game/mission/floor/types';
import type { SectionDef } from '../../src/game/mission/types';

const W = 4000;

function section(hazards: SectionDef['terrain']['hazards'] = []): SectionDef {
  return {
    id: 'floor-test',
    width: W,
    height: 216,
    scroll: 'right',
    background: { sky: PAL.sky[2], layers: [] },
    terrain: { bounds: { x: 0, y: 0, w: W, h: 216 }, ground: [[[0, 176], [W, 176]]], platforms: [], solids: [], hazards },
    terrainStyle: { ground: 'dirt' },
    playerStart: { x: 48, y: 176 },
    *script() {},
  };
}

const CAM = { yh: 60, f: 210, back: 146 };

function floorOf(def: FloorDef, s = section()): SectionFloor {
  return new SectionFloor(s, def, new Terrain(s.terrain), 1, 'floor-raster-test/');
}

/** Draw the band at camera x on a renderer of res k; returns a copy of the band's pixels. */
function band(floor: SectionFloor, r: SoftRenderer, camX: number, tick = 0): Uint32Array {
  r.setCamera(camX, 0);
  floor.drawBand(r, tick, r.res);
  return (floor.raster.band as { data: Uint32Array }).data.slice();
}

function lum(c: number): number {
  return ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
}

/** The sub-pixel shift k (output px) that best maps row A onto row B: B[x] ≈ A[x − k]. */
function rowShift(a: Float64Array, b: Float64Array, maxK: number): number {
  const n = a.length;
  const m = maxK + 2;
  const ssd = (k: number): number => {
    let s = 0;
    for (let x = m + 8; x < n - m - 8; x++) {
      const d = b[x] - a[x - k];
      s += d * d;
    }
    return s;
  };
  let best = 0;
  let bv = Infinity;
  for (let k = -maxK; k <= maxK; k++) {
    const v = ssd(k);
    if (v < bv) {
      bv = v;
      best = k;
    }
  }
  const l = ssd(best - 1);
  const r = ssd(best + 1);
  const den = l - 2 * bv + r;
  return den > 1e-9 ? best + (0.5 * (l - r)) / den : best;
}

describe('floor CPU raster', () => {
  ensureDebugFloor();
  // A painter with a single-texel mark every 32 px of u: the walk-line test reads its position.
  defineFloorPainter('test/marks', () => (u) => (((Math.floor(u) % 32) + 32) % 32 === 0 ? 0xffffffff : 0x202020ff));

  it('the rows at the walk line show world u where the projection puts it (x ≈ u − camX: the feet never slide)', () => {
    const floor = floorOf({ camera: CAM, painter: { id: 'test/marks' } });
    for (const k of [1, 2, 4]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      for (const cam of [100, 137.5, 1000.25]) {
        const px = band(floor, r, cam);
        // The renderer's camera (snapped to 1/res): the one camera of the picture.
        const camX = r.camX;
        const bw = 384 * k;
        // The output row just below the walk line (centre y 176 + ½/k, scale s(y) ≈ 1).
        const j = (176 - floor.bandTop) * k;
        const y = 176 + 0.5 / k;
        const s = sOfY(CAM_FULL, y);
        const row = px.subarray(j * bw, (j + 1) * bw);
        for (let u = Math.ceil((camX + 8) / 32) * 32; u < camX + 370; u += 32) {
          // The mark is the texel [u, u + 1): its centre u + ½ projects to x′; the brightness centroid is there.
          const want = (192 + (u + 0.5 - camX - 192) * s) * k;
          let sum = 0;
          let sx = 0;
          for (let x = Math.floor(want) - 3 * k; x <= Math.floor(want) + 3 * k; x++) {
            const v = Math.max(0, (row[x] >>> 24) - 0x20);
            sum += v;
            sx += v * (x + 0.5);
          }
          expect(Math.abs(sx / sum - want) / k, `res ${k} cam ${camX} u ${u}`).toBeLessThan(0.25);
          // At the walk line itself that is u − camX within a hundredth of a px.
          expect(Math.abs((192 + (u - camX - 192) * sOfY(CAM_FULL, 176)) - (u - camX))).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('closes the band: every pixel from the back edge down is drawn, nothing above it', () => {
    const floor = floorOf(debugDef());
    for (const k of [1, 2]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      for (const camX of [200, 333.25, 1999.5]) {
        const px = band(floor, r, camX);
        const bw = 384 * k;
        const rows = px.length / bw;
        for (let j = 0; j < rows; j++) {
          const y = floor.bandTop + (j + 0.5) / k;
          let n = 0;
          for (let x = 0; x < bw; x++) if ((px[j * bw + x] & 255) !== 0) n++;
          if (y < CAM.back - 2) expect(n, `row y ${y}`).toBe(0);
          else if (y > CAM.back + 2) expect(n, `res ${k} cam ${camX} row y ${y}`).toBe(bw);
        }
      }
    }
  });

  it('THE PAN TEST: every floor row moves s(y)·Δ within 1/res at 0.25, 0.5, 1, 2 and 3 px/tick', () => {
    const floor = floorOf(debugDef());
    for (const k of [1, 2]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      const bw = 384 * k;
      let worst = 0;
      let rowsChecked = 0;
      for (const speed of [0.25, 0.5, 1, 2, 3]) {
        let cam = 1000;
        r.setCamera(cam, 0);
        let prevCam = r.camX;
        let prev = band(floor, r, cam);
        for (let t = 1; t <= 6; t++) {
          cam += speed;
          const cur = band(floor, r, cam);
          const delta = r.camX - prevCam;
          const rows = cur.length / bw;
          for (let j = 0; j < rows; j++) {
            const y = floor.bandTop + (j + 0.5) / k;
            // Rows of the flat floor away from the kerb faces (depth 20 and −16.5) and the back edge.
            if (y < CAM.back + 1.5 || Math.abs(y - 156) < 3 || Math.abs(y - 192.5) < 3 || y > 214) continue;
            const a = new Float64Array(bw);
            const b = new Float64Array(bw);
            for (let x = 0; x < bw; x++) {
              a[x] = lum(prev[j * bw + x]);
              b[x] = lum(cur[j * bw + x]);
            }
            // Rows without detail (the red v = 0 line) have no phase to measure.
            let mean = 0;
            for (let x = 0; x < bw; x++) mean += a[x];
            mean /= bw;
            let vr = 0;
            for (let x = 0; x < bw; x++) vr += (a[x] - mean) * (a[x] - mean);
            if (vr / bw < 20) continue;
            const want = -sOfY(CAM_FULL, y) * delta * k;
            const got = rowShift(a, b, Math.ceil(Math.abs(want)) + 3);
            const err = Math.abs(got - want) / k;
            worst = Math.max(worst, err);
            rowsChecked++;
            expect(err, `res ${k} speed ${speed} y ${y.toFixed(2)}: ${got.toFixed(3)} vs ${want.toFixed(3)} px`).toBeLessThanOrEqual(1 / k);
          }
          prev = cur;
          prevCam = r.camX;
        }
      }
      expect(rowsChecked).toBeGreaterThan(100);
      // The measured phase is far inside the limit (the report quotes it).
      expect(worst).toBeLessThan(0.5 / k);
    }
  });

  it('THE STILL TEST: a still camera draws identical frames', () => {
    const floor = floorOf(debugDef());
    expect(floor.animated).toBe(false);
    for (const k of [1, 2]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      const a = band(floor, r, 517.5, 10);
      const b = band(floor, r, 517.5, 11);
      expect(Buffer.from(b.buffer).equals(Buffer.from(a.buffer))).toBe(true);
    }
  });

  it('an animated material (water) moves with the tick, and is still at the same tick', () => {
    const s = section([{ kind: 'water', x: 1000, y: 180, w: 400, h: 36 }]);
    const def = debugDef(true);
    const floor = floorOf(def, s);
    expect(floor.animated).toBe(true);
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
    const a = band(floor, r, 900, 10);
    const b = band(floor, r, 900, 10);
    const c = band(floor, r, 900, 40);
    expect(Buffer.from(b.buffer).equals(Buffer.from(a.buffer))).toBe(true);
    expect(Buffer.from(c.buffer).equals(Buffer.from(a.buffer))).toBe(false);
  });

  it('reuses its band buffer frame after frame (the heap sampling of every pass: floor-sections.test.ts)', () => {
    const floor = floorOf(debugDef());
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
    r.setCamera(300, 0);
    floor.drawBand(r, 0, 2);
    const buf = floor.raster.band;
    for (let i = 0; i < 20; i++) {
      r.setCamera(300 + i * 1.5, 0);
      floor.drawBand(r, i, 2);
    }
    expect(floor.raster.band).toBe(buf);
  });
});

const CAM_FULL = { yh: CAM.yh, yw: 176, f: CAM.f };

/** The debug floor of the test section (the kerbs and rows of debugFloorDef, optional water cut). */
function debugDef(water = false): FloorDef {
  const def: FloorDef = {
    camera: CAM,
    painter: { id: 'floor/debug' },
    features: [
      { kind: 'kerb', to: 20, dh: 1.5, face: 'floor/debug-face' },
      { kind: 'kerb', from: -16.5, dh: 1.5, face: 'floor/debug-face' },
    ],
  };
  if (water)
    def.features = [
      ...(def.features ?? []),
      { kind: 'cut', u0: 1000, u1: 1400, level: -4, surface: { tile: 'floor/debug-water', du: 0.12, over: { tile: 'floor/debug-water2', du: -0.08, alpha: 0.4 } }, face: 'floor/debug-quay' },
    ];
  return def;
}
