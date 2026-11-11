/**
 * 2× art of the Amsterdam cast (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): the riders,
 * (the handhaver and the BOETE ticket are baked 40 px sets now: tests/art/art40-gates.test.ts), the tourist hostage with the chair and sack binds, and the
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
  // the fatbike youths (look 0, looks 1-3, the pairs): baked 40 px sets, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/fatbike-youth.test.ts, fatbike-youth-looks.test.ts)
  // the delivery rider (skins a, b, c): a baked 40 px set, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/delivery-rider.test.ts)
  // the handhaver and the BOETE ticket: baked 40 px sets, 1x at every tier (docs/design/ams40.md rule 7; tests/art/art40-gates.test.ts)
  // the Fabel Friet baker: a baked 40 px set, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/ams-baker.test.ts)
  // the hot-dog vendor: a baked 40 px set, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/ams-hotdog-vendor.test.ts)
  // the Fabel Friet crew: baked 40 px sets, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/ams-staff.test.ts)
  'npc/ams/ams-cyclist-bg/',
];

/** Single ids with 2× art (the counter). The tied tourist, the camera flash and the binds are baked 40 px
 * sets, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/hostage-tourist.test.ts, bind.test.ts). */
const IDS = [
  'npc/ams/counter',
  // the window waver: a baked 40 px set, 1x at every tier (docs/design/ams40.md rule 7; tests/art40/ams-window-waver.test.ts)
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
    expect(ids.length).toBeGreaterThanOrEqual(5); // the background cyclists and the counter: every rider is a baked 40 px set (wave 4)
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
