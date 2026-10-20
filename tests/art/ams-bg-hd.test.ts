/**
 * UHD background layers of mission ams (docs/ART_GUIDE.md "UHD art"; missions/ams/art-hd-sky.ts,
 * art-hd-bg*.ts): every parallax layer of every ams section has ONE density-generic generator for
 * 2× and 4× that builds without a fallback, is exactly d × the logical size, uses PAL_HD only, is
 * deterministic and seamless, keeps the 1× design (footprint), is drawn natively (not a scaled
 * copy), has the tones of a painted background, shows atmospheric perspective (far rows lighter
 * and lower in contrast than near rows) and builds as one art job within the budget. The 1× layers
 * stay byte-identical (tests/art/scenery-hi.test.ts, fixture scenery-1x.json).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { VIEW_H } from '../../src/engine/render';
import { getBgGenerator, hasHiBgGenerator, hiSceneryErrors, makeHiBgLayer } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { oklab } from '../../src/game/content/missions/ams/art-hd-bg-kit';
import { getMission } from '../../src/game/registry';

/** The background generators ams uses; each must have 2× and 4× art. */
const AMS_BG = ['sky-gradient', 'clouds', 'ams-skyline', 'ams-canal-houses', 'ams-elms', 'ams-plein', 'ams-amstel'];
const DENSITIES = [2, 4] as const;

/** Share of logical px whose opacity agrees between a 1× layer and a dense one (any art px of the block). */
function footprint(one: PixelBuffer, hi: PixelBuffer, d: number): number {
  let same = 0;
  for (let y = 0; y < one.h; y++) {
    for (let x = 0; x < one.w; x++) {
      const a = (one.data[y * one.w + x] & 255) !== 0;
      let b = false;
      for (let k = 0; k < d * d && !b; k++) b = (hi.data[(y * d + Math.floor(k / d)) * hi.w + x * d + (k % d)] & 255) !== 0;
      if (a === b) same++;
    }
  }
  return same / (one.w * one.h);
}

/** Opaque d × d blocks that are not one flat colour (native detail, not an enlarged 1× px). */
function detailedBlocks(hi: PixelBuffer, d: number): number {
  let n = 0;
  for (let Y = 0; Y < hi.h; Y += d) {
    for (let X = 0; X < hi.w; X += d) {
      const c = hi.data[Y * hi.w + X];
      let flat = true;
      for (let k = 1; k < d * d && flat; k++) flat = hi.data[(Y + Math.floor(k / d)) * hi.w + X + (k % d)] === c;
      if (!flat) n++;
    }
  }
  return n;
}

/** Mean and standard deviation of Oklab lightness over the opaque px of art rows [Y0, Y1). */
function lightness(b: PixelBuffer, Y0: number, Y1: number): { mean: number; sd: number } {
  const cache = new Map<number, number>();
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = 0; X < b.w; X++) {
      const c = b.data[Y * b.w + X];
      if ((c & 255) === 0) continue;
      let L = cache.get(c);
      if (L === undefined) {
        L = oklab(c)[0];
        cache.set(c, L);
      }
      s += L;
      s2 += L * L;
      n++;
    }
  }
  const mean = s / Math.max(1, n);
  return { mean, sd: Math.sqrt(Math.max(0, s2 / Math.max(1, n) - mean * mean)) };
}

describe('ams UHD background layers', () => {
  beforeAll(async () => {
    await loadContent();
  });

  it('every ams layer generator has a 2× and a 4× version', () => {
    const ams = getMission('ams');
    const used = new Set<string>();
    for (const def of Object.values(ams?.sections ?? {})) for (const l of def.background?.layers ?? []) used.add(l.gen);
    expect([...used].sort()).toEqual([...AMS_BG].sort());
    for (const id of AMS_BG) for (const d of DENSITIES) expect(hasHiBgGenerator(id, d), `${id}@${d}x`).toBe(true);
  });

  it('dense layers: d × the size, PAL_HD only, deterministic, seamless, the 1× footprint, native detail', { timeout: 120_000 }, () => {
    const ams = getMission('ams');
    for (const [sid, def] of Object.entries(ams?.sections ?? {})) {
      const layers = def.background?.layers ?? [];
      layers.forEach((l, i) => {
        const w = Math.floor(l.width ?? 512);
        const h = Math.floor(l.height ?? VIEW_H);
        const seed = 4242 + i * 7919;
        const one = getBgGenerator(l.gen)(w, h, l.params ?? {}, seed);
        for (const d of DENSITIES) {
          const tag = `ams/${sid} L${i} ${l.gen}@${d}x`;
          const hi = makeHiBgLayer(l.gen, w, h, l.params ?? {}, seed, d);
          expect(hi, tag).not.toBeNull();
          if (!hi) continue;
          expect([hi.w, hi.h], tag).toEqual([w * d, h * d]);
          const again = makeHiBgLayer(l.gen, w, h, l.params ?? {}, seed, d) as PixelBuffer;
          expect(Buffer.from(again.data.buffer).equals(Buffer.from(hi.data.buffer)), `${tag} deterministic`).toBe(true);
          const bad = new Set<string>();
          for (const c of new Set(hi.data)) if ((c & 255) !== 0 && !inHdPalette(c)) bad.add((c >>> 0).toString(16));
          expect([...bad], `${tag} PAL_HD`).toEqual([]);
          expect(footprint(one, hi, d), `${tag} footprint`).toBeGreaterThan(0.98);
          // Native detail: sky gradients dither on the art grid; everything else has many detailed blocks.
          expect(detailedBlocks(hi, d), `${tag} native detail`).toBeGreaterThan(l.gen === 'clouds' ? 400 : 1500);
          // Seamless: the wrap seam differs no more than the busiest column pair inside.
          const col = (x: number, x2: number): number => {
            let n = 0;
            for (let y = 0; y < hi.h; y++) if (hi.data[y * hi.w + x] !== hi.data[y * hi.w + x2]) n++;
            return n;
          };
          let worst = 0;
          for (let x = 0; x + 1 < hi.w; x++) worst = Math.max(worst, col(x, x + 1));
          expect(col(hi.w - 1, 0), `${tag} seam`).toBeLessThanOrEqual(worst);
        }
      });
    }
    expect(hiSceneryErrors()).toEqual([]);
  });

  it('painted tones: a sky of 6+ tones with solid bands between dithered borders; rich façade rows', () => {
    const a = getMission('ams')?.sections.a.background;
    expect(a).toBeDefined();
    if (!a) return;
    for (const d of DENSITIES) {
      const sky = a.layers[0];
      const buf = makeHiBgLayer(sky.gen, 512, VIEW_H, sky.params ?? {}, 1, d) as PixelBuffer;
      expect(new Set(buf.data).size, `sky tones @${d}x`).toBeGreaterThanOrEqual(6);
      // Dither only near band borders: most rows are one solid tone.
      let solid = 0;
      for (let Y = 0; Y < buf.h; Y++) {
        const c = buf.data[Y * buf.w];
        let same = true;
        for (let X = 1; X < buf.w && same; X++) same = buf.data[Y * buf.w + X] === c;
        if (same) solid++;
      }
      expect(solid / buf.h, `solid sky rows @${d}x`).toBeGreaterThan(0.3);
      const near = a.layers[4];
      const nb = makeHiBgLayer(near.gen, near.width ?? 512, VIEW_H, near.params ?? {}, 1, d) as PixelBuffer;
      expect(new Set(nb.data).size, `near canal houses colours @${d}x`).toBeGreaterThanOrEqual(45);
    }
  });

  it('atmospheric perspective: the far house row is lighter and lower in contrast than the near row', () => {
    for (const sid of ['a', 'c', 'd']) {
      const bg = getMission('ams')?.sections[sid].background;
      if (!bg) continue;
      const far = bg.layers[3];
      const near = bg.layers[4];
      expect(far.params?.haze, `${sid} far row`).toBe(1);
      for (const d of DENSITIES) {
        const fb = makeHiBgLayer(far.gen, far.width ?? 512, VIEW_H, far.params ?? {}, 7, d) as PixelBuffer;
        const nb = makeHiBgLayer(near.gen, near.width ?? 512, VIEW_H, near.params ?? {}, 7, d) as PixelBuffer;
        // The façades only: rows above each layer's quay line.
        const fq = Math.round((far.params?.y as number) * VIEW_H) * d;
        const nq = Math.round((near.params?.y as number) * VIEW_H) * d;
        const f = lightness(fb, 0, fq);
        const n = lightness(nb, 0, nq);
        expect(f.mean, `${sid}@${d}x far lighter`).toBeGreaterThan(n.mean + 0.05);
        expect(f.sd, `${sid}@${d}x far lower contrast`).toBeLessThan(n.sd * 0.8);
      }
    }
  });

  it('each 4× layer builds as one art job within the budget (16 ms on the dev machine; a loose guard here)', () => {
    const ams = getMission('ams');
    let worst = 0;
    let worstTag = '';
    for (const [sid, def] of Object.entries(ams?.sections ?? {})) {
      (def.background?.layers ?? []).forEach((l, i) => {
        const w = Math.floor(l.width ?? 512);
        const ms: number[] = [];
        for (let k = 0; k < 3; k++) {
          const t0 = performance.now();
          makeHiBgLayer(l.gen, w, VIEW_H, l.params ?? {}, 11 + k, 4);
          ms.push(performance.now() - t0);
        }
        const best = Math.min(...ms);
        if (best > worst) {
          worst = best;
          worstTag = `ams/${sid} L${i} ${l.gen}`;
        }
      });
    }
    // Test workers share the CPU: allow 4× the budget before calling it a regression (16× on the
    // shared CI runner, which is several times slower than the dev machine).
    expect(worst, worstTag).toBeLessThan(process.env.CI ? 256 : 64);
  });
});
