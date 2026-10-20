/**
 * preloadMissionArt through the art pool (src/game/scenes/gameplay.ts):
 * - tier 2: the whole 2× set in missionArtOrder (heroes, preloadFirst, rest, boss), ids the boot
 *   installed are not built again, then pack 'hi' is saved;
 * - tier 4: the WORKING SET (chosen heroes, preloadFirst, current + next section, boss) at 4×,
 *   never another hero; setDeferDense on; a section change moves the set on and releases the
 *   sections behind within the budget; drawn-but-missing 4× ids are pumped to the pool;
 *   'hd4-<section>' / 'hd4-char-<hero>' packs are saved, and a later visit restores them; the
 *   P2-only Mute Swan art joins only with two players, boss/ only in the boss section; a 4×
 *   alias stands for its target (once); two players leave the rare strips at 2× (set and pump);
 * - fallback: without Worker the pool builds on the main thread after one warning; at tier 4
 *   it never generates 4× art there (2× stand-ins stay) and does not rebuild in a loop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtPool, browserArtPool, createArtWorkerHandler, inProcessPort, type ArtBuildRequest, type ArtWorkerPort } from '../../src/engine/art-pool';
import { MemoryByteStore } from '../../src/engine/byte-store';
import { PixelBuffer } from '../../src/engine/pixel';
import {
  clearSpriteCache,
  defineDenseAlias,
  defineHiSprite,
  defineSprite,
  denseBytes,
  denseDeferred,
  getFrames,
  hasFramesAt,
  installFrames,
  setArtTier,
  setDeferDense,
  takeDenseQueue,
} from '../../src/engine/sprites';
import { ArtCache } from '../../src/game/art-cache';
import type { GameSession } from '../../src/game/session';
import { denseWorkingSet, missionArtSection, preloadMissionArt, pumpDenseQueue, resetMissionArt, type MissionArtDef } from '../../src/game/scenes/gameplay';

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

describe('tier 4 working set size', () => {
  it('takes the P2-only Mute Swan art only with two players, and boss/ only in the boss section', () => {
    for (const id of ['vehicle/swan/zt', 'vehicle/swan-mute/zt', 'boss/zt/x']) sprite(id, 0x20304000);
    const m = { ...MISSION, preloadFirst: ['vehicle/swan'], preloadLast: ['boss/', 'zboss/'] } as unknown as MissionArtDef;
    const one = denseWorkingSet(m, ['char/zhero/'], 'a', 'b', 1);
    expect(one).toContain('vehicle/swan/zt');
    expect(one).not.toContain('vehicle/swan-mute/zt');
    expect(one).not.toContain('boss/zt/x');
    expect(one).toContain('zboss/x');
    expect(denseWorkingSet(m, ['char/zhero/'], 'a', 'b', 2)).toContain('vehicle/swan-mute/zt');
    expect(denseWorkingSet(m, ['char/zhero/'], 'b', 'c', 1)).not.toContain('boss/zt/x');
    expect(denseWorkingSet(m, ['char/zhero/'], 'c', undefined, 1)).toContain('boss/zt/x');
  });

  it("holds a 4× alias's target, once, at the alias's place", () => {
    sprite('zalias-t/x', 0x30405000);
    for (const id of ['zalias-a/x', 'zalias-b/x']) {
      defineSprite(id, () => new PixelBuffer(8, 8).fill(0x30405100));
      defineDenseAlias(id, 'zalias-t/x');
    }
    const m = { ...MISSION, preloadFirst: ['zalias-a/', 'zfirst/'], sections: { a: { art: ['zalias-b/', 'zalias-t/', 'zsec-a/'] }, b: { art: [] } } } as unknown as MissionArtDef;
    const set = denseWorkingSet(m, ['char/zhero/'], 'a', 'b', 1);
    expect(set.slice(0, 3)).toEqual(['char/zhero/idle', 'zalias-t/x', 'zfirst/a']);
    expect(set.filter((id) => id.startsWith('zalias'))).toEqual(['zalias-t/x']);
  });

  it('two players leave the rare strips (deferred, photo pose, Swan migration) at 2×, never a hero strip', async () => {
    sprite('enemy/zr/photo-pose', 0x40506000);
    sprite('vehicle/swan/migrate', 0x40506100);
    sprite('enemy/zr/ride', 0x40506200);
    for (const id of ['enemy/zr/die-seat', 'char/zhero/fidget']) {
      defineSprite(id, () => new PixelBuffer(8, 8).fill(0x40506300), { defer: true });
      defineHiSprite(id, () => new PixelBuffer(16, 16).fill(0x40506301), 2);
      defineHiSprite(id, () => new PixelBuffer(32, 32).fill(0x40506302), 4);
    }
    const rare = ['enemy/zr/photo-pose', 'vehicle/swan/migrate', 'enemy/zr/die-seat'];
    const m = { ...MISSION, preloadFirst: ['enemy/zr/', 'vehicle/swan'] } as unknown as MissionArtDef;
    const one = denseWorkingSet(m, ['char/zhero/'], 'a', 'b', 1);
    expect(rare.every((id) => one.includes(id))).toBe(true);
    const two = denseWorkingSet(m, ['char/zhero/'], 'a', 'b', 2);
    expect(rare.filter((id) => two.includes(id))).toEqual([]);
    expect(two).toContain('enemy/zr/ride');
    expect(two).toContain('char/zhero/fidget');
    // Drawn with two players: the 2× frame, and the pump does not hand it to the pool.
    const log: ArtBuildRequest[] = [];
    resetMissionArt(loggingPool(log));
    setArtTier(4);
    const both = { slots: [{ joined: true, character: 'zhero' }, { joined: true, character: 'zother' }] } as unknown as GameSession;
    preloadMissionArt({ preloadArt: true, session: both }, m, 4, both);
    await settle();
    takeDenseQueue();
    expect(getFrames('enemy/zr/photo-pose', 4)[0].density).toBe(2);
    expect(getFrames('enemy/zr/ride', 4)[0].density).toBe(4);
    getFrames('zextra/x', 4);
    expect(pumpDenseQueue()).toBe(1);
    await settle();
    expect(log.filter((r) => r.d === 4).flatMap((r) => r.ids)).not.toContain('enemy/zr/photo-pose');
    expect(hasFramesAt('enemy/zr/photo-pose', 4)).toBe(false);
  });
});
