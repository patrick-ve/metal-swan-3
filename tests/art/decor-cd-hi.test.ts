/**
 * 2× art of the decor of mission ams sections c (AMSTEL) and d (STOPERA) and of the Amsterdam
 * breakables (src/game/content/missions/ams/art-hi-cd*.ts): the Stopera, the flea-market stalls,
 * the white Amstel bridge and its portal, the Blauwbrug lamp and arch face, and the herring cart,
 * tulip stall, market stall and bike rack (intact and broken). Every listed id has a 2× generator
 * the registry accepts (no 'id@2x' fallback, no pixels cut outside the 1× frame), with the 1×
 * logical geometry, palette colours only and real 2× detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';

/** The c / d decor and breakable ids with 2× art. */
const IDS = [
  'decor/ams/stopera',
  'decor/ams/market-stall',
  'decor/ams/white-bridge',
  'decor/ams/white-portal',
  'decor/ams/blauwbrug-lamp',
  'decor/ams/bridge-face-200x16',
  'decor/ams/ams-herring-cart',
  'decor/ams/ams-tulip-stall',
  'decor/ams/ams-market-stall',
  'decor/ams/ams-bike-rack',
];

describe('ams decor c / d and breakables: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every listed decor id has a 2× generator that the registry accepts, with the 1× geometry', async () => {
    await loadContent();
    for (const id of IDS) {
      expect(listSprites().includes(id), id).toBe(true);
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      for (let i = 0; i < lo.length; i++) {
        const f = hi[i];
        expect(f.density, `${id}[${i}]`).toBe(2);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]`).toEqual([lo[i].buf.w * 2, lo[i].buf.h * 2, lo[i].ox, lo[i].oy]);
        expect(f.pts ?? {}, `${id}[${i}]`).toEqual(lo[i].pts ?? {});
        // Crisp and palette-only: every pixel transparent or an opaque palette colour.
        const bad = [...f.buf.data].find((c) => (c & 255) !== 0 && ((c & 255) !== 255 || !inPalette(c)));
        expect(bad, `${id}[${i}]`).toBeUndefined();
      }
      // Real 2× art, not the 1× frames doubled.
      const detailed = hi.some((f, i) => {
        const doubled = lo[i].buf.scaled(2).data;
        return !f.buf.data.every((c, k) => c === doubled[k]);
      });
      expect(detailed, id).toBe(true);
    }
    expect(spriteErrors().filter((e) => IDS.some((id) => e.id === `${id}@2x`))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && IDS.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 120_000);
});
