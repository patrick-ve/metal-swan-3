/**
 * 2× art of the Amsterdam cast (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): the riders,
 * the handhaver and the BOETE ticket, the tourist hostage with the chair and sack binds, and the
 * friendly NPCs. Every listed id has a 2× generator the registry accepts (no 'id@2x' fallback, no
 * pixels cut outside the 1× frame), with the 1× logical geometry and real 2× detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { fitBounds } from '../../src/game/art/hi-strips';
import { loadContent } from '../../src/game/content/index';

/** Id prefixes whose every sprite must have 2× art. */
const PREFIXES = [
  'enemy/fatbike-youth',
  'enemy/delivery-rider',
  'enemy/handhaver',
  'enemy/boete-ticket/',
  'npc/ams/ams-baker/',
  'npc/ams/ams-hotdog-vendor/',
  'npc/ams/ams-staff/',
  'npc/ams/ams-cyclist-bg/',
];

/** Single ids with 2× art (the tourist's chair / sack flow and its binds, the counter, the window waver). */
const IDS = [
  'item/hostage/tourist/tied',
  'item/hostage/tourist/sack',
  'item/hostage/tourist/freed',
  'item/hostage/tourist/walk',
  'item/hostage/tourist/gag',
  'item/hostage/tourist/give',
  'item/hostage/tourist/bow',
  'item/hostage/tourist/run',
  'item/hostage/flash',
  'item/bind/chair-break',
  'item/bind/sack-off',
  'item/bind/rope-bit',
  'npc/ams/counter',
  'npc/ams/ams-window-waver/person',
];

describe('Amsterdam cast: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every cast id has a 2× generator that the registry accepts, with the 1× geometry', async () => {
    await loadContent();
    const ids = [...listSprites().filter((id) => PREFIXES.some((p) => id.startsWith(p))), ...IDS];
    expect(ids.length).toBeGreaterThan(450);
    for (const id of IDS) expect(listSprites().includes(id), id).toBe(true);
    let detailed = 0;
    for (const id of ids) {
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      for (let i = 0; i < lo.length; i++) {
        const f = hi[i];
        expect(f.density, `${id}[${i}]`).toBe(2);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]`).toEqual([lo[i].buf.w * 2, lo[i].buf.h * 2, lo[i].ox, lo[i].oy]);
        expect(f.pts ?? {}, `${id}[${i}]`).toEqual(lo[i].pts ?? {});
      }
      // Real 2× art, not the 1× frame doubled.
      if (hi.some((f, i) => {
        const doubled = lo[i].buf.scaled(2).data;
        return !f.buf.data.every((c, k) => c === doubled[k]);
      })) detailed++;
    }
    expect(detailed).toBe(ids.length);
    expect(spriteErrors().filter((e) => e.id.endsWith('@2x') && ids.some((id) => e.id === `${id}@2x`))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 180_000);

  it('fitBounds centres a transformed 2× buffer on the opaque box of its (trimmed) 1× frame', () => {
    const lo = new PixelBuffer(6, 4).rect(1, 1, 3, 2, 0xffffffff);
    const hi = new PixelBuffer(20, 20).rect(5, 7, 6, 4, 0xff0000ff);
    const f = fitBounds(hi, { buf: lo, ox: 3, oy: 4 });
    expect([f.buf.w, f.buf.h, f.ox, f.oy, f.density]).toEqual([12, 8, 3, 4, 2]);
    expect(f.buf.trimBounds()).toEqual({ x: 2, y: 2, w: 6, h: 4 });
  });
});
