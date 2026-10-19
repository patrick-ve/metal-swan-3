/**
 * preloadMissionArt through the art pool (src/game/scenes/gameplay.ts):
 * - tier 2: the whole 2× set in missionArtOrder (heroes, preloadFirst, rest, boss), ids the boot
 *   installed are not built again, then pack 'hi' is saved;
 * - tier 4: the WORKING SET (chosen heroes, preloadFirst, current + next section, boss) at 4×,
 *   never another hero; setDeferDense on; a section change moves the set on and releases the
 *   sections behind within the budget; drawn-but-missing 4× ids are pumped to the pool;
 *   'hd4-<section>' / 'hd4-char-<hero>' packs are saved, and a later visit restores them;
 * - fallback: without Worker the pool builds on the main thread after one warning; at tier 4
 *   it never generates 4× art there (2× stand-ins stay) and does not rebuild in a loop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtPool, browserArtPool, createArtWorkerHandler, inProcessPort, type ArtBuildRequest, type ArtWorkerPort } from '../../src/engine/art-pool';
import { MemoryByteStore } from '../../src/engine/byte-store';
import { PixelBuffer } from '../../src/engine/pixel';
import {
  clearSpriteCache,
  defineHiSprite,
  defineSprite,
  denseBytes,
  denseDeferred,
  getFrames,
  hasFramesAt,
  installFrames,
  setArtTier,
  setDeferDense,
} from '../../src/engine/sprites';
import { ArtCache } from '../../src/game/art-cache';
import type { GameSession } from '../../src/game/session';
import { missionArtSection, preloadMissionArt, pumpDenseQueue, resetMissionArt, type MissionArtDef } from '../../src/game/scenes/gameplay';

/** An 8×8 logical sprite with 2× and 4× frames. */
function sprite(id: string, c: number): void {
  defineSprite(id, () => new PixelBuffer(8, 8).fill(c));
  defineHiSprite(id, () => new PixelBuffer(16, 16).fill(c + 1), 2);
  defineHiSprite(id, () => new PixelBuffer(32, 32).fill(c + 2), 4);
}
const FRAME4 = 32 * 32 * 4;

const IDS = ['char/zhero/idle', 'char/zother/idle', 'zfirst/a', 'zsec-a/x', 'zsec-b/x', 'zsec-c/x', 'zmid/x', 'zboss/x', 'zextra/x'];
IDS.forEach((id, i) => sprite(id, 0x10203000 + i * 16));

const session = { slots: [{ joined: true, character: 'zhero' }, { joined: false, character: 'zother' }] } as unknown as GameSession;
const MISSION = {
  id: 'zm',
  artDensity: 4,
  start: 'a',
  bossSection: 'c',
  preloadFirst: ['zfirst/'],
  preloadLast: ['zboss/'],
  sections: { a: { art: ['zsec-a/'] }, b: { art: ['zsec-b/'] }, c: { art: ['zsec-c/'] } },
} as unknown as MissionArtDef;

/** A real pool on one in-process port that logs each request. */
function loggingPool(log: ArtBuildRequest[]): () => ArtPool {
  return () => {
    const inner = inProcessPort(createArtWorkerHandler(async () => {}));
    const port: ArtWorkerPort = { ...inner, post: (req) => (log.push(req), inner.post(req)) };
    return new ArtPool([port]);
  };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0));
};

afterEach(() => {
  resetMissionArt();
  setArtTier(2);
  setDeferDense(false);
  clearSpriteCache();
});

describe('tier 2', () => {
  it('tier 1 builds nothing, even for a 4× mission', () => {
    const log: ArtBuildRequest[] = [];
    resetMissionArt(loggingPool(log));
    setArtTier(1);
    expect(preloadMissionArt({ preloadArt: true, session }, MISSION, 4, session)).toBe(false);
    expect(log).toHaveLength(0);
  });

  it('builds the 2× set through the pool in mission order (installed ids skipped), then saves pack hi', async () => {
    const log: ArtBuildRequest[] = [];
    resetMissionArt(loggingPool(log));
    setArtTier(2);
    const save = vi.fn(async () => true);
    // The boot restored this one from pack 'hi'.
    installFrames('zmid/x', 2, [{ buf: new PixelBuffer(16, 16), ox: 8, oy: 16, density: 2 }]);
    expect(preloadMissionArt({ preloadArt: true, session, artCache: { save } as unknown as ArtCache }, MISSION, 4, session)).toBe(true);
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith('hi', ['']));
    const ids = log.flatMap((r) => r.ids);
    expect(log.every((r) => r.d === 2)).toBe(true);
    expect(ids[0]).toBe('char/zhero/idle');
    expect(ids[1]).toBe('zfirst/a');
    expect(ids.at(-1)).toBe('zboss/x');
    expect(ids).not.toContain('zmid/x');
    expect(ids).toHaveLength(IDS.length - 1);
    expect(hasFramesAt('zsec-c/x', 2)).toBe(true);
    expect(hasFramesAt('zsec-c/x', 4)).toBe(false);
    expect(denseDeferred()).toBe(false);
  });
});

describe('tier 4 working set', () => {
  it('builds heroes, preloadFirst, this and the next section, the boss; moves on and releases behind', async () => {
    const log: ArtBuildRequest[] = [];
    resetMissionArt(loggingPool(log), 5 * FRAME4);
    setArtTier(4);
    const cache = new ArtCache(new MemoryByteStore(), 'build-1', () => {});
    const app = { preloadArt: true, session, artCache: cache };
    preloadMissionArt(app, MISSION, 4, session);
    expect(denseDeferred()).toBe(true);
    await vi.waitFor(() => expect(hasFramesAt('zboss/x', 4)).toBe(true));
    const four = log.filter((r) => r.d === 4).flatMap((r) => r.ids);
    expect(four).toEqual(['char/zhero/idle', 'zfirst/a', 'zsec-a/x', 'zsec-b/x', 'zboss/x']);
    expect(hasFramesAt('char/zother/idle', 4)).toBe(false);
    expect(hasFramesAt('zsec-c/x', 4)).toBe(false);
    expect(denseBytes(4)).toBe(5 * FRAME4);

    // A 4× frame drawn without frames: the 2× stand-in now, queued, then pumped to the pool.
    expect(getFrames('zextra/x', 4)[0].density).toBe(2);
    expect(pumpDenseQueue()).toBe(1);
    await vi.waitFor(() => expect(hasFramesAt('zextra/x', 4)).toBe(true));

    // Section b: c joins; over the budget, a's ids (behind) are released first, then the extra.
    missionArtSection('b');
    await vi.waitFor(() => expect(hasFramesAt('zsec-c/x', 4)).toBe(true));
    await settle();
    expect(hasFramesAt('zsec-a/x', 4)).toBe(false);
    expect(hasFramesAt('zextra/x', 4)).toBe(false);
    expect(hasFramesAt('char/zhero/idle', 4)).toBe(true);
    expect(denseBytes(4)).toBeLessThanOrEqual(5 * FRAME4);

    // Packs: the hero and each section's own ids.
    await settle();
    const store = (cache as unknown as { store: MemoryByteStore }).store;
    await vi.waitFor(() => expect([...store.map.keys()].sort()).toEqual(['sprites:hd4-a', 'sprites:hd4-b', 'sprites:hd4-char-zhero', 'sprites:hi']));

    // A later visit restores them at the mission start: the pool is not asked for those ids.
    resetMissionArt();
    clearSpriteCache();
    const log2: ArtBuildRequest[] = [];
    resetMissionArt(loggingPool(log2), 64 * FRAME4);
    setArtTier(4);
    const cache2 = new ArtCache(store, 'build-1', () => {});
    preloadMissionArt({ preloadArt: true, session, artCache: cache2 }, MISSION, 4, session);
    await vi.waitFor(() => expect(cache2.restored.get('hd4-a')).toBe(4));
    await settle();
    expect(cache2.restored.get('hd4-char-zhero')).toBe(1);
    const four2 = log2.filter((r) => r.d === 4).flatMap((r) => r.ids);
    expect(four2).not.toContain('char/zhero/idle');
    expect(four2).not.toContain('zsec-a/x');
  });
});

describe('fallback', () => {
  it('without Worker the pool warns once and builds on the main thread', async () => {
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe('undefined');
    const warns: string[] = [];
    resetMissionArt(() => browserArtPool(undefined, { warn: (m) => warns.push(m), fallbackBudgetMs: 1000 }));
    setArtTier(2);
    preloadMissionArt({ preloadArt: true, session }, MISSION, 4, session);
    await vi.waitFor(() => expect(hasFramesAt('zboss/x', 2)).toBe(true));
    expect(IDS.every((id) => hasFramesAt(id, 2))).toBe(true);
    expect(warns).toHaveLength(1);
  });
  it('tier 4 without Worker: never generates 4× art on the main thread, keeps the 2× stand-ins, no rebuild loop', async () => {
    const warns: string[] = [];
    const builds: number[] = [];
    resetMissionArt(() => {
      const p = browserArtPool(undefined, { warn: (m) => warns.push(m), fallbackBudgetMs: 1000 });
      const build = p.build.bind(p);
      p.build = (ids, d, cb) => (builds.push(d), build(ids, d, cb));
      return p;
    });
    setArtTier(4);
    preloadMissionArt({ preloadArt: true, session }, MISSION, 4, session);
    await vi.waitFor(() => expect(hasFramesAt('zboss/x', 2)).toBe(true));
    await settle();
    expect(IDS.some((id) => hasFramesAt(id, 4))).toBe(false);
    expect(getFrames('zsec-a/x', 4)[0].density).toBe(2);
    // The ids the fallback could not deliver at 4× are not handed to the pool again.
    const n4 = builds.filter((d) => d === 4).length;
    pumpDenseQueue();
    getFrames('zsec-a/x', 4);
    pumpDenseQueue();
    await settle();
    expect(builds.filter((d) => d === 4).length).toBe(n4);
  });
});
