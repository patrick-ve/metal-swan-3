/**
 * HD terrain and canal water of mission ams (UHD art, docs/ART_GUIDE.md "UHD art";
 * src/game/content/missions/ams/art-hd-terrain.ts, art-hd-terrain-water.ts):
 *
 * - Every terrain material an ams section uses has an HD version; every terrain chunk of every ams
 *   section paints at 2× and 4× with exactly the 1× opaque footprint (the 1× classification:
 *   geometry and collision art cannot change), PAL_HD colours only, deterministically, and rects
 *   split along x or y give the pixels of one rect over both (no seams between chunks).
 * - A 4× chunk is one budgeted art job: median over the ams chunks ≤ 24 ms here (the budget is
 *   16 ms on an idle machine; tests run in parallel, so the test allows half again).
 * - Every `decor/ams/water-…` id has HD frames at 2 and 4 with the 1× frame count, size × d,
 *   anchor and no points; PAL_HD only; the back is opaque; the tint's top rows are clear (what
 *   floats on the water — reflections — is not tinted) and below them opaque; the surface keeps
 *   an opaque waterline row.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { getTerrainPainter, hasHiTerrain, hiSceneryErrors, makeHiTerrain, terrainDensityFor } from '../../src/game/art/art-registry';
import { hasHdTerrainMaterial } from '../../src/game/art/terrain-art';
import { loadContent } from '../../src/game/content/index';
import { amsWaterWidths } from '../../src/game/content/missions/ams/art-hd-terrain-water';
import { C_BASIN_Y } from '../../src/game/content/missions/ams/terrain';
import type { SectionDef } from '../../src/game/mission/types';
import { CHUNK } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';

const DENSITIES = [2, 4] as const;

function sections(): [string, SectionDef][] {
  return Object.entries(getMission('ams')?.sections ?? {});
}

function sampler(def: SectionDef): (x: number, y: number) => 0 | 1 | 2 | 3 {
  const t = new Terrain(def.terrain);
  return (x, y) => t.cellAt(x, y);
}

/** Opaque px that are not an opaque PAL_HD colour. */
function offHd(b: PixelBuffer): number {
  let n = 0;
  for (const c of b.data) if ((c & 255) !== 0 && !((c & 255) === 255 && inHdPalette(c))) n++;
  return n;
}

/** The first art px whose opacity differs from its 1× pixel, or null. */
function footprintDiff(one: PixelBuffer, hi: PixelBuffer, d: number): string | null {
  for (let y = 0; y < one.h; y++) {
    for (let x = 0; x < one.w; x++) {
      const o = (one.data[y * one.w + x] & 255) !== 0;
      for (let sy = 0; sy < d; sy++) {
        for (let sx = 0; sx < d; sx++) {
          if (((hi.data[(y * d + sy) * hi.w + x * d + sx] & 255) !== 0) !== o) return `${x},${y}`;
        }
      }
    }
  }
  return null;
}

beforeAll(async () => {
  await loadContent();
});

describe('mission ams: HD terrain', () => {
  it('every material of every ams section has an HD version; every style has terrain at 2× and 4×', () => {
    for (const [sid, def] of sections()) {
      const st = def.terrainStyle;
      expect(st, sid).toBeDefined();
      if (!st) continue;
      expect(hasHdTerrainMaterial('ground', st.ground), `${sid} ground ${st.ground}`).toBe(true);
      if (st.edge) expect(hasHdTerrainMaterial('edge', st.edge), `${sid} edge ${st.edge}`).toBe(true);
      expect(hasHdTerrainMaterial('platform', st.platform ?? 'wood'), `${sid} platform`).toBe(true);
      expect(hasHdTerrainMaterial('solid', st.solid ?? 'metal'), `${sid} solid`).toBe(true);
      for (const d of DENSITIES) {
        expect(hasHiTerrain(st, d), `${sid} at ${d}×`).toBe(true);
        expect(terrainDensityFor(st, d), `${sid} at ${d}×`).toBe(d);
      }
    }
  });

  it('every ams chunk at 2× and 4×: the exact 1× footprint, PAL_HD only, deterministic, real detail', () => {
    let chunks = 0;
    for (const [sid, def] of sections()) {
      const style = def.terrainStyle;
      if (!style) continue;
      const sample = sampler(def);
      // The detail check: per row, the first chunk from x 256 on with real ground in it (at least
      // 2048 opaque px: a quay end; a river section's chunk can be a thin bridge deck only). The
      // detail it needs grows with its ground (a full street chunk: about 20,480 px → 3000 × d).
      const detailRows = new Set<number>();
      for (let cy = 0; cy * CHUNK < def.height; cy++) {
        for (let cx = 0; cx * CHUNK < def.width; cx++) {
          const one = getTerrainPainter()(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
          if (one.countOpaque() === 0) continue;
          const detail = cx >= 1 && !detailRows.has(cy) && one.countOpaque() >= 2048;
          if (detail) detailRows.add(cy);
          for (const d of DENSITIES) {
            const hi = makeHiTerrain(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK, d);
            expect(hi, `ams/${sid} chunk ${cx},${cy} at ${d}×`).not.toBeNull();
            if (!hi) continue;
            chunks++;
            expect([hi.w, hi.h]).toEqual([CHUNK * d, CHUNK * d]);
            expect(footprintDiff(one, hi, d), `ams/${sid} chunk ${cx},${cy} at ${d}×: opacity differs from 1× at`).toBeNull();
            expect(offHd(hi), `ams/${sid} chunk ${cx},${cy} at ${d}× palette`).toBe(0);
            if (detail) {
              const again = makeHiTerrain(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK, d) as PixelBuffer;
              expect(again.data.every((c, i) => c === hi.data[i]), `ams/${sid} ${d}× deterministic`).toBe(true);
              // Real detail: many d × d blocks are not flat.
              const flat = hi.downsampled(d).scaled(d);
              let diff = 0;
              for (let i = 0; i < hi.data.length; i++) if (hi.data[i] !== flat.data[i]) diff++;
              expect(diff, `ams/${sid} has ${d}× detail`).toBeGreaterThan(Math.min(3000, 0.146 * one.countOpaque()) * d);
            }
          }
        }
      }
      expect(detailRows.size, `ams/${sid}: a chunk with ground gets the detail check`).toBeGreaterThan(0);
    }
    expect(chunks).toBeGreaterThan(80);
    expect(hiSceneryErrors()).toEqual([]);
  }, 180_000);

  it('seamless at 2× and 4×: rects split along x or y give the pixels of one rect', () => {
    for (const [sid, def] of sections()) {
      const style = def.terrainStyle;
      if (!style) continue;
      const sample = sampler(def);
      // The street, a platform, the canal edges, the slope to the white bridge (c), the ceiling (b).
      for (const [x, y] of [[100, 150], [1040, 140], [1330, 150], [1990, 120], [400, 70], [2020, 140], [2780, 150]]) {
        for (const d of DENSITIES) {
          const whole = makeHiTerrain(sample, style, x, y, 80, 66, d);
          if (!whole) continue;
          const parts: [number, number, number, number][] = [
            [0, 0, 40, 66],
            [40, 0, 40, 66],
            [0, 0, 80, 31],
            [0, 31, 80, 35],
          ];
          for (const [px, py, pw, ph] of parts) {
            // A part with no HD px is null: then that part of the whole is empty.
            const part = makeHiTerrain(sample, style, x + px, y + py, pw, ph, d);
            for (let yy = 0; yy < ph * d; yy++) {
              for (let xx = 0; xx < pw * d; xx++) {
                const want = whole.data[(py * d + yy) * whole.w + px * d + xx];
                const got = part ? part.data[yy * part.w + xx] : 0;
                if (got !== want) throw new Error(`ams/${sid} ${d}× seam: rect ${x + px},${y + py} px ${xx},${yy} differs`);
              }
            }
          }
        }
      }
    }
  }, 120_000);

  it('a 4× chunk is one art job inside the budget', () => {
    const mins: number[] = [];
    for (const [, def] of sections()) {
      const style = def.terrainStyle;
      if (!style) continue;
      const sample = sampler(def);
      for (let cx = 0; cx * CHUNK < def.width; cx++) {
        let best = Infinity;
        for (let rep = 0; rep < 3; rep++) {
          const t0 = performance.now();
          makeHiTerrain(sample, style, cx * CHUNK, 0, CHUNK, CHUNK, 4);
          best = Math.min(best, performance.now() - t0);
        }
        mins.push(best);
      }
    }
    mins.sort((a, b) => a - b);
    const median = mins[mins.length >> 1];
    console.log(`4× terrain chunk: median ${median.toFixed(1)} ms, max ${mins[mins.length - 1].toFixed(1)} ms over ${mins.length} chunks`);
    // The budget is for the dev machine; the shared CI runner is several times slower.
    expect(median).toBeLessThanOrEqual(process.env.CI ? 96 : 24);
  }, 120_000);
});

describe('mission ams: HD canal water', () => {
  it('every water id has HD art at 2× and 4× with the 1× geometry, PAL_HD only', () => {
    const ids = listSprites('decor/ams/water-');
    // The canal pieces (36 px deep) and the pieces of section c's jetty basin (its own water line).
    const basin = [128].map((w) => `decor/ams/water-${w}x${216 - C_BASIN_Y}`);
    const want = [...amsWaterWidths().map((w) => `decor/ams/water-${w}x36`), ...basin].flatMap((id) => [id, `${id}-back`, `${id}-tint`]);
    expect([...ids].sort()).toEqual([...want].sort());
    for (const id of ids) {
      const lo = getFrames(id, 1);
      for (const d of DENSITIES) {
        expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x frames`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = hi[i];
          expect(f.density, `${id}[${i}]@${d}x`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]@${d}x`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}[${i}]@${d}x`).toEqual(lo[i].pts ?? {});
          expect(offHd(f.buf), `${id}[${i}]@${d}x palette`).toBe(0);
        }
        const b = hi[0].buf;
        const opaqueRow = (y: number): number => {
          let n = 0;
          for (let x = 0; x < b.w; x++) if ((b.data[y * b.w + x] & 255) !== 0) n++;
          return n / b.w;
        };
        if (id.endsWith('-back')) expect(b.countOpaque(), `${id}@${d}x opaque`).toBe(b.w * b.h);
        else if (id.endsWith('-tint')) {
          // Clear over the reflections at the top, opaque from the fourth row down.
          for (let y = 0; y < 2 * d; y++) expect(opaqueRow(y), `${id}@${d}x row ${y}`).toBe(0);
          for (let y = 4 * d; y < b.h; y++) expect(opaqueRow(y), `${id}@${d}x row ${y}`).toBe(1);
        } else {
          for (const f of hi) for (let y = 0; y < 2 * d; y++) expect((f.buf.data[y * f.buf.w] & 255) !== 0, `${id}@${d}x waterline row ${y}`).toBe(true);
        }
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('decor/ams/water-'))).toEqual([]);
  });

  it('the pieces of a canal join: a narrower piece is the start of the 128 px piece (patterns repeat every 128 px)', () => {
    for (const d of DENSITIES) {
      for (const w of amsWaterWidths()) {
        if (w === 128) continue;
        for (const suffix of ['', '-back', '-tint']) {
          const narrow = getFrames(`decor/ams/water-${w}x36${suffix}`, d);
          const wide = getFrames(`decor/ams/water-128x36${suffix}`, d);
          for (let f = 0; f < narrow.length; f++) {
            const a = narrow[f].buf;
            const b = wide[f].buf;
            for (let y = 0; y < a.h; y++) {
              for (let x = 0; x < a.w; x++) {
                if (a.data[y * a.w + x] !== b.data[y * b.w + x]) throw new Error(`water-${w}x36${suffix}[${f}]@${d}x differs from the 128 px piece at ${x},${y}`);
              }
            }
          }
        }
      }
    }
  });

  it('the surface moves like the 1× one: the frames differ, the crest period is 16 px', () => {
    const id = `decor/ams/water-${amsWaterWidths()[amsWaterWidths().length - 1]}x36`;
    for (const d of DENSITIES) {
      const fr = getFrames(id, d);
      const a = fr[0].buf;
      const b = fr[1].buf;
      expect(a.data.some((c, i) => c !== b.data[i]), `${id}@${d}x frames differ`).toBe(true);
      // Frame 1 is frame 0 moved 3 logical px to the left (the 1× crests move 3 px per frame).
      let same = 0;
      let n = 0;
      for (let y = 0; y < 2 * d; y++) {
        for (let x = 3 * d; x < a.w; x++) {
          n++;
          if (b.data[y * b.w + x - 3 * d] === a.data[y * a.w + x]) same++;
        }
      }
      expect(same / n, `${id}@${d}x waterline moves 3 px`).toBeGreaterThan(0.95);
    }
  });
});
