/**
 * The continue reaction strips of the Amsterdam locals (the in-world continue: the enemies on
 * screen gloat at the spot — their own business there, docs/design/ams-extras.md §1 — then cower
 * when a hero drops back in): `enemy/<set>/gloat` and `enemy/<set>/cower` for every rider set,
 * every handhaver set and the gull. Each has its frames at 1× and its timing, is deferred (rare
 * art), and is baked 40 px art (docs/design/ams40.md): 1× at every tier, no dense art, no two
 * frames alike, no sprite error. No `laugh` strip is left.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getFrames, hasHiSprite, isDeferredSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import '../../src/game/content/locals/art';
import { duplicateFrames } from '../art/motion';

type Kind = 'youth' | 'phone' | 'officer' | 'gull';
/** Frames and animation of each gloat strip; the cower: 2 frames, 3 ticks each, looping. */
const GLOAT: Record<Kind, { frames: number; anim: { ticksPerFrame: number; durations: readonly number[] | undefined; loop: boolean } }> = {
  // the fatbike youths (every look, solo and pair): baked 40 px sets (docs/design/ams40.md wave 4): 6 frames, the same 36-tick rock
  youth: { frames: 6, anim: { ticksPerFrame: 6, durations: [6, 6, 6, 6, 6, 6], loop: true } },
  // the delivery rider: a baked 40 px set (docs/design/ams40.md wave 4): stopped, the phone, 28 ticks
  phone: { frames: 6, anim: { ticksPerFrame: 6, durations: [6, 4, 4, 6, 4, 4], loop: true } },
  // the handhaver: a baked 40 px set (docs/design/ams40.md wave 1): 6 frame roles, the same 98 ticks
  officer: { frames: 6, anim: { ticksPerFrame: 6, durations: [8, 8, 6, 6, 12, 58], loop: false } },
  // the herring gull: a baked 40 px set (docs/design/ams40.md wave 4): eye, rear back, strike, PECK, fry,
  // gulp, smug; the same 44-tick loop, the peck on GLOAT_PECK (tick 16, as before)
  gull: { frames: 7, anim: { ticksPerFrame: 6, durations: [10, 4, 2, 8, 8, 6, 6], loop: true } },
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

describe('continue reaction strips (gloat, cower)', () => {
  it('cover every rider set (27), every handhaver set (3) and the gull', () => {
    expect(riders.length).toBe(27);
    expect(officers.length).toBe(3);
  });

  it('exist at 1× with their frames and timing, and are deferred; no laugh strip is left', () => {
    const kindOf = (set: string): Kind => (set.includes('fatbike-youth') ? 'youth' : set.includes('delivery') ? 'phone' : set.includes('handhaver') ? 'officer' : 'gull');
    for (const set of [...riders, ...officers, 'enemy/seagull']) {
      const g = GLOAT[kindOf(set)];
      expect(getFrames(`${set}/gloat`, 1).length, `${set}/gloat`).toBe(g.frames);
      const anim = spriteAnim(`${set}/gloat`);
      expect(anim.loop, `${set}/gloat`).toBe(g.anim.loop);
      if (g.anim.durations) expect(anim.durations, `${set}/gloat`).toEqual(g.anim.durations);
      else expect(anim.ticksPerFrame, `${set}/gloat`).toBe(g.anim.ticksPerFrame);
      if (kindOf(set) !== 'gull') {
        // baked: 4 trembling frames, 3 ticks each, looping
        expect(getFrames(`${set}/cower`, 1).length, `${set}/cower`).toBe(4);
        expect(spriteAnim(`${set}/cower`).durations, `${set}/cower`).toEqual([3, 3, 3, 3]);
        expect(spriteAnim(`${set}/cower`).loop, `${set}/cower`).toBe(true);
      } else {
        // baked: 6 frantic frames, 3 ticks each, looping
        expect(getFrames(`${set}/cower`, 1).length, `${set}/cower`).toBe(6);
        expect(spriteAnim(`${set}/cower`).durations, `${set}/cower`).toEqual([3, 3, 3, 3, 3, 3]);
        expect(spriteAnim(`${set}/cower`).loop, `${set}/cower`).toBe(true);
      }
      for (const name of ['gloat', 'cower']) expect(isDeferredSprite(`${set}/${name}`), `${set}/${name}`).toBe(true);
    }
    expect(listSprites('').filter((id) => id.endsWith('/laugh'))).toEqual([]);
  });

  it('are 1× baked art at every tier (plan rule 7): no dense art, two different frames, no sprite error', () => {
    const ids = [...officers, ...riders, 'enemy/seagull'].flatMap((s) => [`${s}/gloat`, `${s}/cower`]);
    expect(ids.length).toBe(62);
    for (const id of ids) {
      expect(hasHiSprite(id, 2) || hasHiSprite(id, 4), id).toBe(false);
      expect(getFrames(id, 4), id).toBe(getFrames(id, 1));
      expect(duplicateFrames(id, 1), id).toEqual([]);
    }
    expect(spriteErrors().filter((e) => ids.some((id) => e.id === id || e.id.startsWith(`${id}@`)))).toEqual([]);
  });
});
