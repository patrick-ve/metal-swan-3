/**
 * 2× art of the decor of mission ams sections a (GRACHTENGORDEL) and b (MUSEUMPLEIN) and the decor
 * they share with c and d (src/game/content/missions/ams/art-hi-ab*.ts): canal houses, FABEL
 * FRIET, its sign, counter and neighbour, street furniture, flags, the bridges, drawbridge,
 * houseboats and canal water of section a, the Rijksmuseum, lawn, pool and hot-dog stand set of
 * section b, the breakables of sections a and b and the small canal boat platform (art-hi-boat.ts). Every listed id has a 2× generator the
 * registry accepts (no 'id@2x' fallback, no pixels cut outside the 1× frame), with the 1× logical
 * geometry, palette colours only and real 2× detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';

/** The a / b (and shared) decor ids with 2× art. */
const IDS = [
  ...['house-morning', 'house-noon'],
  ...['morning', 'noon', 'golden', 'sunset'].flatMap((l) => [`fabel-friet-${l}`, `neighbour-${l}`]),
  'fabel-sign',
  'fabel-counter',
  'lamp',
  'bollard',
  'bike',
  'bike-rack',
  'bench',
  'elm',
  'tulips',
  'flag-ams',
  'flag-nl',
  'smoke',
  'awning-30',
  'awning-56',
  'awning-60',
  'balustrade-36',
  'drawbridge',
  'bridge-rail-160x14',
  'bridge-face-160x14',
  'houseboat-82x18-14-54-0',
  'houseboat-104x18-14-58-2',
  'water-128x36',
  'water-128x36-back',
  'water-128x36-tint',
  'water-24x36',
  'water-24x36-back',
  'water-24x36-tint',
  'rijksmuseum',
  'lawn-128',
  'lawn-56',
  'pool-128',
  'pool-56',
  'hotdog-stand',
  'hotdog-front',
  'flag-red',
  'cabinet',
  'lamp-grey',
  'ams-herring-cart',
  'ams-tulip-stall',
  'ams-bike-rack',
  // The small canal boat platform of sections a and c (art-hi-boat.ts).
  'ams-boat-platform',
].map((id) => `decor/ams/${id}`);

describe('ams decor a / b: 2× art', () => {
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
