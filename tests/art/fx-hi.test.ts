/**
 * 2× art of the fx that mission ams shows (docs/ART_GUIDE.md "2x art (mission ams)"): explosions,
 * bullet impacts and hits, dust, the canal splash, debris, the poof, confetti and music notes (the
 * muzzle flashes: tests/art/weapons-hi.test.ts). Every listed id has a 2× generator the registry
 * accepts (no 'id@2x' fallback, no pixels cut outside the 1× frame), with the 1× logical geometry,
 * palette colours only and real 2× detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';

/** The fx ids with 2× art. */
const IDS = [
  'fx/explosion-s',
  'fx/explosion-m',
  'fx/explosion-l',
  'fx/explosion-xl',
  'fx/impact',
  'fx/hit',
  'fx/hit-spark',
  'fx/dust',
  'fx/splash',
  'fx/debris-dirt',
  'fx/debris-metal',
  'fx/debris-plant',
  'fx/debris-wood',
  'fx/poof',
  'fx/confetti',
  'fx/confetti-bit',
  'fx/music-note',
];

describe('fx: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every listed fx id has a 2× generator that the registry accepts, with the 1× geometry', async () => {
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
