/**
 * 2× art of the items mission ams shows (docs/ART_GUIDE.md "2x art (mission ams)"): the weapon
 * medallions (every letter and alias: the crate and tourist tables can roll any of them), the
 * bombs crate, the food and treasure pickups, and the supply crate. Every listed id has a 2×
 * generator the registry accepts (no 'id@2x' fallback, no pixels cut outside the 1× frame), with
 * the 1× logical geometry and real 2× detail, and the 2× art is palette-only and opaque.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAL, INK } from '../../src/engine/palette';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';

/** Id prefixes whose every sprite must have 2× art. */
const PREFIXES = ['item/pickup-weapon/', 'item/pickup-food', 'item/pickup-gem'];

/** Single ids with 2× art. */
const IDS = [
  'item/pickup-bombs',
  'item/pickup-m',
  'item/pickup-s',
  'item/pickup-f',
  'item/pickup-h',
  'item/pickup-machine-gun',
  'item/pickup-shotgun',
  'item/pickup-flamethrower',
  'item/pickup-homing',
  'item/crate',
  'item/crate-hit',
  'item/crate-break',
];

/** Every palette colour (and INK). */
function paletteSet(): Set<number> {
  const s = new Set<number>([INK >>> 0]);
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) s.add((c as number) >>> 0);
  return s;
}

describe('ams items: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every item id has a 2× generator that the registry accepts, with the 1× geometry', async () => {
    await loadContent();
    const ids = [...new Set([...listSprites().filter((id) => PREFIXES.some((p) => id.startsWith(p))), ...IDS])];
    expect(ids.length).toBeGreaterThan(25);
    for (const id of IDS) expect(listSprites().includes(id), id).toBe(true);
    const pal = paletteSet();
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
        const doubled = lo[i].buf.scaled(2).data;
        if (!f.buf.data.every((c, k) => c === doubled[k])) detailed = true;
        const off = [...f.buf.data].filter((c) => (c & 255) !== 0 && !pal.has(c >>> 0));
        expect(off.length, `${id}[${i}] colours outside the palette`).toBe(0);
      }
      // Real 2× art, not the 1× frame doubled.
      expect(detailed, id).toBe(true);
    }
    expect(spriteErrors().filter((e) => ids.some((id) => e.id === `${id}@2x`))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 60_000);
});
