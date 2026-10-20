/**
 * The continue reaction strips of the Amsterdam locals (the in-world continue: the enemies on
 * screen gloat at the spot — their own business there, docs/design/ams-extras.md §1 — then cower
 * when a hero drops back in): `enemy/<set>/gloat` and `enemy/<set>/cower` for every rider set,
 * every handhaver set and the gull. Each has its frames at 1× and its timing, is deferred (rare
 * art), and its 2× / 4× frames are real dense art (density 2 / 4, never a fallback) with the 1×
 * geometry (count, logical size, anchor, points), PAL_HD only, no two frames alike, and no
 * generator warning. No `laugh` strip is left.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, isDeferredSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import '../../src/game/content/locals/art';
import { duplicateFrames } from '../art/motion';

type Kind = 'wheelie' | 'phone' | 'officer' | 'gull';
/** Frames and animation of each gloat strip; the cower: 2 frames, 3 ticks each, looping. */
const GLOAT: Record<Kind, { frames: number; anim: { ticksPerFrame: number; durations: readonly number[] | undefined; loop: boolean } }> = {
  wheelie: { frames: 4, anim: { ticksPerFrame: 9, durations: undefined, loop: true } },
  phone: { frames: 2, anim: { ticksPerFrame: 14, durations: undefined, loop: true } },
  officer: { frames: 5, anim: { ticksPerFrame: 6, durations: [8, 8, 10, 12, 60], loop: false } },
  gull: { frames: 4, anim: { ticksPerFrame: 6, durations: [16, 6, 12, 10], loop: true } },
};
const COWER = { ticksPerFrame: 3, durations: undefined, loop: true };

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

describe('continue reaction strips (gloat, cower)', () => {
  it('cover every rider set (27), every handhaver set (3) and the gull', () => {
    expect(riders.length).toBe(27);
    expect(officers.length).toBe(3);
  });

  it('exist at 1× with their frames and timing, and are deferred; no laugh strip is left', () => {
    const kindOf = (set: string): Kind => (set.includes('delivery') ? 'phone' : set.includes('handhaver') ? 'officer' : set.includes('seagull') ? 'gull' : 'wheelie');
    for (const set of [...riders, ...officers, 'enemy/seagull']) {
      const g = GLOAT[kindOf(set)];
      expect(getFrames(`${set}/gloat`, 1).length, `${set}/gloat`).toBe(g.frames);
      const anim = spriteAnim(`${set}/gloat`);
      expect(anim.loop, `${set}/gloat`).toBe(g.anim.loop);
      if (g.anim.durations) expect(anim.durations, `${set}/gloat`).toEqual(g.anim.durations);
      else expect(anim.ticksPerFrame, `${set}/gloat`).toBe(g.anim.ticksPerFrame);
      expect(getFrames(`${set}/cower`, 1).length, `${set}/cower`).toBe(2);
      expect(spriteAnim(`${set}/cower`), `${set}/cower`).toEqual(COWER);
      for (const name of ['gloat', 'cower']) expect(isDeferredSprite(`${set}/${name}`), `${set}/${name}`).toBe(true);
    }
    expect(listSprites('').filter((id) => id.endsWith('/laugh'))).toEqual([]);
  });

  it('keep the 1× geometry at 2× and 4×, as real dense art in PAL_HD, with two different frames', () => {
    const ids = [...riders, ...officers, 'enemy/seagull'].flatMap((s) => [`${s}/gloat`, `${s}/cower`]);
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
