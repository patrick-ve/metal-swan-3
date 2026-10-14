/**
 * 2× art of the player shots, flashes and casings (mission ams, docs/ART_GUIDE.md "2x art (mission
 * ams)"): every listed id has a 2× generator the registry accepts (no 'id@2x' fallback, no pixels
 * cut outside the 1× frame), with the 1× logical geometry and real 2× detail. Also the
 * density-aware turn helpers in art/hi.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { turnFrame, turnHi } from '../../src/game/art/hi';
import { loadContent } from '../../src/game/content/index';

const FLASH_FAMILIES = ['', '-heavy', '-pistol', '-machine-gun', '-shotgun', '-rocket-launcher', '-flamethrower', '-laser', '-homing', '-tuba', '-bounce-mine'];

/** Ids with 2× art: bullets (16 directions), rockets, rings, flames, grenades, casings and every muzzle flash. */
const IDS = [
  'weapon/bullet',
  'weapon/bullet-pistol',
  'weapon/mg-bullet',
  'weapon/bullet-mg',
  'weapon/vulcan-bullet',
  'weapon/shell',
  'weapon/pellet',
  'weapon/enemy-bullet',
  'enemy/bullet',
  'weapon/enemy-grenade',
  'enemy/grenade',
  'weapon/casing',
  'weapon/smoke-trail',
  'weapon/muzzle-pistol',
  'weapon/muzzle-heavy',
  'weapon/rocket',
  'weapon/homing',
  'weapon/homing-missile',
  'weapon/tuba-ring',
  'weapon/tuba-ring-up',
  'weapon/mine-disc',
  'weapon/grenade',
  'weapon/flame',
  'weapon/flame-glow',
  'weapon/laser-flare',
  'weapon/laser-hit',
  ...FLASH_FAMILIES.flatMap((f) => ['', '-up', '-diag'].map((d) => `fx/muzzle${f}${d}`)),
];

describe('weapons: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every shot / flash id has a 2× generator that the registry accepts, with the 1× geometry', async () => {
    await loadContent();
    expect(IDS.length).toBe(59);
    for (const id of IDS) {
      expect(listSprites().includes(id), id).toBe(true);
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      let doubled = true;
      for (let i = 0; i < lo.length; i++) {
        const f = hi[i];
        expect(f.density, `${id}[${i}]`).toBe(2);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]`).toEqual([lo[i].buf.w * 2, lo[i].buf.h * 2, lo[i].ox, lo[i].oy]);
        expect(f.pts ?? {}, `${id}[${i}]`).toEqual(lo[i].pts ?? {});
        const d = lo[i].buf.scaled(2).data;
        if (!f.buf.data.every((c, k) => c === d[k])) doubled = false;
      }
      // Real 2× art, not the 1× frames doubled.
      expect(doubled, id).toBe(false);
    }
    expect(spriteErrors().filter((e) => IDS.some((id) => e.id === `${id}@2x`))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && IDS.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 120_000);

  it('turnFrame turns the anchor in logical px, the same at 1× and 2×', () => {
    const lo = { buf: new PixelBuffer(6, 4).rect(1, 2, 1, 1, 0xffffffff), ox: 1, oy: 2 };
    const hi = { buf: new PixelBuffer(12, 8).rect(2, 4, 2, 2, 0xffffffff), ox: 1, oy: 2, density: 2 };
    for (const q of [-1, 1, 2]) {
      const a = turnFrame(lo, q);
      const b = turnFrame(hi, q);
      expect([b.ox, b.oy, b.buf.w, b.buf.h]).toEqual([a.ox, a.oy, a.buf.w * 2, a.buf.h * 2]);
      // The marked pixel sits on the anchor after the turn.
      expect(a.buf.get(a.ox, a.oy)).toBe(0xffffffff);
      expect(b.buf.get(b.ox * 2 + 1, b.oy * 2 + 1)).toBe(0xffffffff);
    }
    // A counter-clockwise quarter turn matches the 1× recipe (ox = oy, oy = w − 1 − ox).
    expect([turnFrame(lo, -1).ox, turnFrame(lo, -1).oy]).toEqual([2, 4]);
  });

  it('turnHi centres the turned 2× source on the 1× frame (anchor and size of the 1× frame)', () => {
    const src1 = new PixelBuffer(9, 5).rect(2, 2, 5, 1, 0xffffffff);
    const base = { buf: src1.rotated(Math.PI / 4).outline(0x000000ff), ox: 3, oy: 4 };
    const src2 = new PixelBuffer(18, 10).rect(4, 4, 10, 2, 0xffffffff);
    const f = turnHi(src2, Math.PI / 4, base, { outline: 0x000000ff });
    expect([f.buf.w, f.buf.h, f.ox, f.oy, f.density]).toEqual([base.buf.w * 2, base.buf.h * 2, 3, 4, 2]);
    expect(f.buf.countOpaque()).toBeGreaterThan(0);
  });
});
