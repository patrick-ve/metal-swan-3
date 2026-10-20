/**
 * The continue reaction strips of the Amsterdam locals (the in-world continue: the enemies on
 * screen laugh at the empty spot, then cower when a hero drops back in): `enemy/<set>/laugh` and
 * `enemy/<set>/cower` for every rider set, every handhaver set and the gull. Each has 2 frames at
 * 1×, loops at its timing, is deferred (rare art), and its 2× / 4× frames are real dense art
 * (density 2 / 4, never a fallback) with the 1× geometry (count, logical size, anchor, points),
 * PAL_HD only, two different frames, and no generator warning.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, isDeferredSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import '../../src/game/content/locals/art';
import { duplicateFrames } from '../art/motion';

const TIMING: Record<'laugh' | 'cower', { rider: number; officer: number; gull: number }> = {
  laugh: { rider: 8, officer: 8, gull: 6 },
  cower: { rider: 3, officer: 3, gull: 3 },
};

let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
let riders: string[] = [];
let officers: string[] = [];

beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const sets = (suffix: string, ...prefixes: string[]): string[] =>
    listSprites('enemy/')
      .filter((id) => id.endsWith(suffix) && prefixes.some((p) => id.startsWith(`enemy/${p}`)))
      .map((id) => id.slice(0, -suffix.length));
  riders = sets('/ride', 'fatbike-youth', 'delivery-rider');
  officers = sets('/walk', 'handhaver');
});
afterAll(() => warn.mockRestore());

describe('continue reaction strips (laugh, cower)', () => {
  it('cover every rider set (27), every handhaver set (3) and the gull', () => {
    expect(riders.length).toBe(27);
    expect(officers.length).toBe(3);
  });

  it('exist with 2 frames at 1×, loop at their timing and are deferred', () => {
    const all: Array<[string, 'rider' | 'officer' | 'gull']> = [...riders.map((s) => [s, 'rider'] as [string, 'rider']), ...officers.map((s) => [s, 'officer'] as [string, 'officer']), ['enemy/seagull', 'gull']];
    for (const [set, kind] of all) {
      for (const name of ['laugh', 'cower'] as const) {
        const id = `${set}/${name}`;
        expect(getFrames(id, 1).length, id).toBe(2);
        expect(spriteAnim(id), id).toEqual({ ticksPerFrame: TIMING[name][kind], durations: undefined, loop: true });
        expect(isDeferredSprite(id), id).toBe(true);
      }
    }
  });

  it('keep the 1× geometry at 2× and 4×, as real dense art in PAL_HD, with two different frames', () => {
    const ids = [...riders, ...officers, 'enemy/seagull'].flatMap((s) => [`${s}/laugh`, `${s}/cower`]);
    expect(ids.length).toBe(62);
    for (const id of ids) {
      expect(hasHiSprite(id, 2) && hasHiSprite(id, 4), id).toBe(true);
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id}@${d}`).toBe(lo.length);
        hd.forEach((f, i) => {
          expect(f.density, `${id}@${d}[${i}]`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}@${d}[${i}]`).toEqual(lo[i].pts ?? {});
          for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) expect.fail(`${id}@${d}[${i}]: colour ${c.toString(16)} not in PAL_HD`);
        });
      }
      for (const d of [1, 4]) expect(duplicateFrames(id, d), `${id}@${d}`).toEqual([]);
    }
    const mine = (e: string): boolean => ids.some((id) => e === id || e === `${id}@2x` || e === `${id}@4x`);
    expect(spriteErrors().filter((e) => mine(e.id))).toEqual([]);
    const noisy = warn.mock.calls.map((c) => String(c[0])).filter((m) => ids.some((id) => m.includes(`"${id}"`)));
    expect(noisy).toEqual([]);
  }, 240_000);
});
