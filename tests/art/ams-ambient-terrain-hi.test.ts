/**
 * 2× ambient life and 2× terrain of mission ams (docs/ART_GUIDE.md "2x art (mission ams)", "2x
 * backgrounds and terrain"):
 *
 * - Every `npc/ams/…` id has a 2× generator the registry accepts (no 'id@2x' fallback, no pixels
 *   cut outside the 1× frame), with the 1× logical geometry, palette colours only and real 2×
 *   detail. The ambient ids (pigeons, ducks, tour boat, window cat) are listed explicitly.
 * - Every terrain material an ams section uses has a 2× version; every terrain chunk of every ams
 *   section paints at 2× with exactly the 1× opaque footprint, palette colours only, and two
 *   neighbouring rects join without a seam (the same pixels as one rect over both).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import type { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { getTerrainPainter, makeHiTerrain } from '../../src/game/art/art-registry';
import { hasHiTerrainMaterial } from '../../src/game/art/terrain-art';
import { loadContent } from '../../src/game/content/index';
import { CHUNK } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';

const AMBIENT = ['npc/ams/ams-pigeons', 'npc/ams/ams-ducks', 'npc/ams/ams-tour-boat', 'npc/ams/ams-window-waver/cat'];

function paletteSet(): Set<number> {
  const s = new Set<number>([INK >>> 0]);
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) s.add((c as number) >>> 0);
  return s;
}

function offPalette(b: PixelBuffer, pal: Set<number>): number {
  let n = 0;
  for (const c of b.data) if ((c & 255) !== 0 && !pal.has(c >>> 0)) n++;
  return n;
}

describe('mission ams: 2× ambient life', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every npc/ams id has 2× art with the 1× geometry, palette only, real detail', async () => {
    await loadContent();
    const pal = paletteSet();
    const ids = listSprites('npc/ams/');
    for (const id of AMBIENT) expect(ids, id).toContain(id);
    for (const id of ids) {
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      let detailed = false;
      for (let i = 0; i < lo.length; i++) {
        const f = hi[i];
        expect(f.density, `${id}[${i}]`).toBe(2);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]`).toEqual([lo[i].buf.w * 2, lo[i].buf.h * 2, lo[i].ox, lo[i].oy]);
        expect(f.pts ?? {}, `${id}[${i}]`).toEqual(lo[i].pts ?? {});
        expect(offPalette(f.buf, pal), `${id}[${i}] palette`).toBe(0);
        const doubled = lo[i].buf.scaled(2).data;
        if (!f.buf.data.every((c, k) => c === doubled[k])) detailed = true;
      }
      expect(detailed, `${id} has 2× detail`).toBe(true);
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('npc/ams/') && e.id.endsWith('@2x'))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && m.includes('npc/ams/'));
    expect(cut).toEqual([]);
  }, 60_000);
});

describe('mission ams: 2× terrain', () => {
  it('every material of every ams section has a 2× version', async () => {
    await loadContent();
    const ams = getMission('ams');
    for (const [sid, def] of Object.entries(ams?.sections ?? {})) {
      const st = def.terrainStyle;
      expect(st, sid).toBeDefined();
      if (!st) continue;
      expect(hasHiTerrainMaterial('ground', st.ground), `${sid} ground ${st.ground}`).toBe(true);
      if (st.edge) expect(hasHiTerrainMaterial('edge', st.edge), `${sid} edge ${st.edge}`).toBe(true);
      expect(hasHiTerrainMaterial('platform', st.platform ?? 'wood'), `${sid} platform`).toBe(true);
      expect(hasHiTerrainMaterial('solid', st.solid ?? 'metal'), `${sid} solid`).toBe(true);
    }
  });

  it('every ams chunk at 2×: the exact 1× footprint, palette only, seamless joins', async () => {
    await loadContent();
    const pal = paletteSet();
    const ams = getMission('ams');
    let chunks = 0;
    for (const [sid, def] of Object.entries(ams?.sections ?? {})) {
      const style = def.terrainStyle;
      if (!style) continue;
      const t = new Terrain(def.terrain);
      const sample = (x: number, y: number) => t.cellAt(x, y);
      for (let cy = 0; cy * CHUNK < def.height; cy++) {
        for (let cx = 0; cx * CHUNK < def.width; cx++) {
          const one = getTerrainPainter()(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
          if (one.countOpaque() === 0) continue;
          const hi = makeHiTerrain(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
          expect(hi, `ams/${sid} chunk ${cx},${cy}`).not.toBeNull();
          if (!hi) continue;
          chunks++;
          for (let y = 0; y < CHUNK; y++) {
            for (let x = 0; x < CHUNK; x++) {
              const o = (one.data[y * CHUNK + x] & 255) !== 0;
              for (let s = 0; s < 4; s++) {
                const c = hi.data[(y * 2 + (s >> 1)) * hi.w + x * 2 + (s & 1)];
                if (((c & 255) !== 0) !== o) throw new Error(`ams/${sid} ${cx * CHUNK + x},${cy * CHUNK + y}: 2× opacity differs from 1×`);
              }
            }
          }
          expect(offPalette(hi, pal), `ams/${sid} chunk ${cx},${cy} palette`).toBe(0);
        }
      }
      // Seams: two 40-px rects side by side give the pixels of one 80-px rect over both, at the
      // street, a platform and (b) the brick ceiling.
      for (const [x, y] of [[100, 150], [1090, 140], [1990, 120], [400, 80], [2020, 140]]) {
        const whole = makeHiTerrain(sample, style, x, y, 80, 60);
        const left = makeHiTerrain(sample, style, x, y, 40, 60);
        const right = makeHiTerrain(sample, style, x + 40, y, 40, 60);
        if (!whole) continue;
        expect(left && right, `ams/${sid} seam at ${x},${y}`).toBeTruthy();
        if (!left || !right) continue;
        for (let yy = 0; yy < whole.h; yy++) {
          for (let xx = 0; xx < whole.w; xx++) {
            const part = xx < 80 ? left.data[yy * 80 + xx] : right.data[yy * 80 + xx - 80];
            if (part !== whole.data[yy * whole.w + xx]) throw new Error(`ams/${sid} seam at ${x},${y}: pixel ${xx},${yy} differs`);
          }
        }
      }
    }
    expect(chunks).toBeGreaterThan(40);
  }, 120_000);
});
