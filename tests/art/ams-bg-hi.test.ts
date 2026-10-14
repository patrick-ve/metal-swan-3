/**
 * 2× background layers of mission ams (docs/ART_GUIDE.md "2x backgrounds and terrain (mission
 * ams)"): every parallax layer of every ams section has a 2× version (missions/ams/art-hi-bg.ts,
 * backgrounds-hi.ts, art-hi-sky.ts) that builds without a 1× fallback, is exactly twice the
 * logical size, palette only, deterministic and seamless, keeps the 1× footprint (same design)
 * and has real 2× detail. The 1× layers stay byte-identical (tests/art/scenery-hi.test.ts).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import type { PixelBuffer } from '../../src/engine/pixel';
import { VIEW_H } from '../../src/engine/render';
import { getBgGenerator, hasHiBgGenerator, hiSceneryErrors, makeHiBgLayer } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { getMission } from '../../src/game/registry';

/** The background generators ams uses; each must have 2× art. */
const AMS_HI_BG = ['sky-gradient', 'clouds', 'ams-skyline', 'ams-canal-houses', 'ams-elms', 'ams-plein'];

function paletteSet(): Set<number> {
  const s = new Set<number>([INK >>> 0]);
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) s.add((c as number) >>> 0);
  return s;
}

/** Share of logical pixels whose opacity agrees between a 1× layer and a 2× one (any sub-pixel). */
function footprint(one: PixelBuffer, hi: PixelBuffer): number {
  let same = 0;
  for (let y = 0; y < one.h; y++) {
    for (let x = 0; x < one.w; x++) {
      const a = (one.data[y * one.w + x] & 255) !== 0;
      let b = false;
      for (let k = 0; k < 4 && !b; k++) b = (hi.data[(y * 2 + (k >> 1)) * hi.w + x * 2 + (k & 1)] & 255) !== 0;
      if (a === b) same++;
    }
  }
  return same / (one.w * one.h);
}

describe('ams 2× background layers', () => {
  beforeAll(async () => {
    await loadContent();
  });

  it('every ams layer generator has a 2× version', () => {
    const ams = getMission('ams');
    const used = new Set<string>();
    for (const def of Object.values(ams?.sections ?? {})) for (const l of def.background?.layers ?? []) used.add(l.gen);
    expect([...used].sort()).toEqual([...AMS_HI_BG].sort());
    for (const id of AMS_HI_BG) expect(hasHiBgGenerator(id), id).toBe(true);
  });

  it('2× layers: twice the size, the 1× footprint, palette only, deterministic, seamless, finer', { timeout: 60_000 }, () => {
    const pal = paletteSet();
    const ams = getMission('ams');
    for (const [sid, def] of Object.entries(ams?.sections ?? {})) {
      const layers = def.background?.layers ?? [];
      layers.forEach((l, i) => {
        const tag = `ams/${sid} L${i} ${l.gen}`;
        const w = Math.floor(l.width ?? 512);
        const h = Math.floor(l.height ?? VIEW_H);
        const seed = 4242 + i * 7919;
        const one = getBgGenerator(l.gen)(w, h, l.params ?? {}, seed);
        const hi = makeHiBgLayer(l.gen, w, h, l.params ?? {}, seed);
        expect(hi, tag).not.toBeNull();
        if (!hi) return;
        expect([hi.w, hi.h], tag).toEqual([w * 2, h * 2]);
        const again = makeHiBgLayer(l.gen, w, h, l.params ?? {}, seed) as PixelBuffer;
        expect(Buffer.from(again.data.buffer).equals(Buffer.from(hi.data.buffer)), `${tag} deterministic`).toBe(true);
        const bad = new Set<string>();
        for (const c of hi.data) if ((c & 255) !== 0 && !pal.has(c >>> 0)) bad.add((c >>> 0).toString(16));
        expect([...bad], `${tag} palette`).toEqual([]);
        expect(footprint(one, hi), `${tag} footprint`).toBeGreaterThan(0.98);
        // Real 2× detail: some 2 × 2 blocks are not flat.
        const flat = hi.downsampled(2).scaled(2);
        let diff = 0;
        for (let k = 0; k < hi.data.length; k++) if (hi.data[k] !== flat.data[k]) diff++;
        expect(diff, `${tag} has 2× detail`).toBeGreaterThan(500);
        // Seamless: the wrap seam differs no more than the busiest column pair inside.
        const col = (x: number, x2: number): number => {
          let n = 0;
          for (let y = 0; y < hi.h; y++) if (hi.data[y * hi.w + x] !== hi.data[y * hi.w + x2]) n++;
          return n;
        };
        let worst = 0;
        for (let x = 0; x + 1 < hi.w; x++) worst = Math.max(worst, col(x, x + 1));
        expect(col(hi.w - 1, 0), `${tag} seam`).toBeLessThanOrEqual(worst);
      });
    }
    expect(hiSceneryErrors()).toEqual([]);
  });
});
