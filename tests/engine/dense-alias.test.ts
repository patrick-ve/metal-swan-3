/**
 * Dense sprite aliases (src/engine/sprites.ts `defineDenseAlias`, docs/api/media.md):
 * - an alias draws its target's frames at 2× and 4× (the same objects) and its own 1× frames; it
 *   never runs a dense generator of its own; listings and peeks follow the target; a later
 *   generator replaces the alias; chains collapse, an alias of itself is ignored;
 * - geometry is law: an alias whose 1× geometry (frame count, logical size, anchor, points)
 *   differs from its target's draws its lower frames and is listed as 'id@<d>x';
 * - memory: `denseBytes` counts each buffer once; releasing an alias leaves its target; a
 *   deferred alias queues its target; the dense preload builds the target once;
 * - the art pool and the packs build, send, install and save the target only, once.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ArtPool, buildRawPack, createArtWorkerHandler, inProcessPort, type ArtBuildRequest, type ArtWorkerPort } from '../../src/engine/art-pool';
import { MemoryByteStore } from '../../src/engine/byte-store';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { decodeSpritePack } from '../../src/engine/sprite-pack';
import {
  defineDenseAlias,
  defineHdSprite,
  defineHiSprite,
  defineSprite,
  denseBytes,
  denseTarget,
  framesDensityAt,
  generatedSprites,
  getFrames,
  hasFramesAt,
  hasHiSprite,
  installFrames,
  listDenseAliases,
  listHiSprites,
  preloadSprites,
  readyFrames,
  releaseDense,
  setDeferDense,
  spriteErrors,
  takeDenseQueue,
  type FramePoints,
} from '../../src/engine/sprites';
import { ArtCache } from '../../src/game/art-cache';

function noise(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let i = 0; i < b.data.length; i++) b.data[i] = (Math.imul(i + 1, 2654435761) ^ seed) | 255;
  return b.touch();
}

/** A 1× strip of `n` w × h frames (feet anchor unless given) with the points `pts`. */
function strip(id: string, n: number, w: number, h: number, seed: number, o: { ox?: number; pts?: FramePoints } = {}): void {
  defineSprite(id, () => Array.from({ length: n }, (_, i): Frame => ({ buf: noise(w, h, seed + i), ox: o.ox ?? w >> 1, oy: h, ...(o.pts ? { pts: o.pts } : {}) })));
}

/** A target with 1× and HD art (n frames of 4 × 4); counts its dense generator runs per density. */
function target(id: string, n = 2, seed = 1, pts?: FramePoints): Record<number, number> {
  const runs: Record<number, number> = { 2: 0, 4: 0 };
  strip(id, n, 4, 4, seed, { pts });
  defineHdSprite(id, (d) => {
    runs[d]++;
    return Array.from({ length: n }, (_, i): Frame => ({ buf: noise(4 * d, 4 * d, seed * 10 + d + i), ox: 2, oy: 4, ...(pts ? { pts } : {}), density: d }));
  });
  return runs;
}

afterEach(() => {
  setDeferDense(false);
  takeDenseQueue();
});

describe('dense aliases', () => {
  it("draw the target's frames at 2× and 4× (the same objects), their own at 1×", () => {
    const runs = target('al/t', 2, 1, { gun: [1, -2] });
    strip('al/a', 2, 4, 4, 77, { pts: { gun: [1, -2] } });
    let own = 0;
    defineHdSprite('al/a', () => {
      own++;
      return [noise(16, 16, 5), noise(16, 16, 6)];
    });
    defineDenseAlias('al/a', 'al/t');
    for (const d of [2, 4]) {
      expect(getFrames('al/a', d), `d ${d}`).toBe(getFrames('al/t', d));
      expect(getFrames('al/a', d)[0].density).toBe(d);
    }
    expect(own).toBe(0);
    expect(runs).toEqual({ 2: 1, 4: 1 });
    // 1× is never aliased: the alias keeps its own pixels.
    expect(getFrames('al/a', 1)).not.toBe(getFrames('al/t', 1));
    expect(getFrames('al/a', 1)[0].buf.data).toEqual(noise(4, 4, 77).data);
    // Listings and peeks follow the target.
    expect([denseTarget('al/a', 4), denseTarget('al/a', 2), denseTarget('al/a', 1), denseTarget('al/t', 4)]).toEqual(['al/t', 'al/t', 'al/a', 'al/t']);
    expect(hasHiSprite('al/a', 4) && hasHiSprite('al/a', 2)).toBe(true);
    expect(listHiSprites('al/', 4)).toEqual(['al/a', 'al/t']);
    expect(listDenseAliases(4)).toContainEqual(['al/a', 'al/t']);
    expect(hasFramesAt('al/a', 4)).toBe(true);
    expect(framesDensityAt('al/a', 4)).toBe(4);
    // A later generator replaces the alias (at its density only).
    defineHiSprite('al/a', () => [noise(16, 16, 8), noise(16, 16, 9)], 4);
    expect(denseTarget('al/a', 4)).toBe('al/a');
    expect(getFrames('al/a', 4)).not.toBe(getFrames('al/t', 4));
    expect(denseTarget('al/a', 2)).toBe('al/t');
  });

  it('chains resolve in either order; an alias of itself (also through a chain) is ignored', () => {
    defineDenseAlias('ch/a', 'ch/b');
    defineDenseAlias('ch/b', 'ch/c');
    defineDenseAlias('ch/x', 'ch/a');
    expect(['ch/a', 'ch/b', 'ch/x'].map((id) => denseTarget(id))).toEqual(['ch/c', 'ch/c', 'ch/c']);
    expect(listDenseAliases(4).filter(([id]) => id.startsWith('ch/'))).toEqual([['ch/a', 'ch/c'], ['ch/b', 'ch/c'], ['ch/x', 'ch/c']]);
    defineDenseAlias('ch/c', 'ch/a');
    defineDenseAlias('ch/s', 'ch/s');
    expect([denseTarget('ch/c'), denseTarget('ch/s')]).toEqual(['ch/c', 'ch/s']);
    // A middle id that gets its own 4× generator ends the chain there (the last definition wins).
    defineHiSprite('ch/b', () => new PixelBuffer(8, 8), 4);
    expect(['ch/a', 'ch/x'].map((id) => denseTarget(id, 4))).toEqual(['ch/b', 'ch/b']);
    expect(denseTarget('ch/a', 2)).toBe('ch/c');
  });

  it('geometry is law: an alias that does not fit its target draws its lower frames, listed as id@<d>x', () => {
    const runs = target('geo/t', 2, 3, { gun: [1, -2] });
    const cases: ReadonlyArray<readonly [string, () => void, RegExp]> = [
      ['geo/count', () => strip('geo/count', 1, 4, 4, 1, { pts: { gun: [1, -2] } }), /1 frames, the target has 2/],
      ['geo/size', () => strip('geo/size', 2, 5, 4, 1, { pts: { gun: [1, -2] } }), /frame 0 is 5×4, the target's 4×4/],
      ['geo/anchor', () => strip('geo/anchor', 2, 4, 4, 1, { ox: 1, pts: { gun: [1, -2] } }), /anchor \(1, 4\), the target's \(2, 4\)/],
      ['geo/points', () => strip('geo/points', 2, 4, 4, 1, { pts: { gun: [1, -3] } }), /points differ/],
    ];
    for (const [id, make, why] of cases) {
      make();
      defineDenseAlias(id, 'geo/t');
      const f = getFrames(id, 4);
      expect(f, id).not.toBe(getFrames('geo/t', 4));
      expect(f[0].density ?? 1, id).toBe(1);
      expect(f, id).toBe(getFrames(id, 1));
      const err = spriteErrors().find((e) => e.id === `${id}@4x`);
      expect(err?.error, id).toMatch(why);
      expect(err?.error, id).toMatch(/alias of "geo\/t"/);
      expect(denseTarget(id, 4), id).toBe(id);
    }
    // The fitting target itself is fine (built once at 4×, for the check above).
    expect(spriteErrors().some((e) => e.id.startsWith('geo/t'))).toBe(false);
    expect(runs[4]).toBe(1);
  });

  it('denseBytes counts each buffer once; releasing an alias leaves its target; a deferred alias queues its target', () => {
    target('mem/t', 2, 4);
    strip('mem/a', 2, 4, 4, 9);
    defineDenseAlias('mem/a', 'mem/t');
    // A strip whose two frames share one buffer.
    defineSprite('mem/s', () => {
      const b = noise(4, 4, 2);
      return [b, b];
    });
    defineHdSprite('mem/s', (d) => {
      const b = noise(4 * d, 4 * d, 3);
      return [b, b];
    });
    const FRAME = 16 * 16 * 4;
    const base = denseBytes(4);
    getFrames('mem/a', 4);
    expect(denseBytes(4) - base).toBe(2 * FRAME);
    getFrames('mem/t', 4);
    expect(denseBytes(4) - base).toBe(2 * FRAME);
    getFrames('mem/s', 4);
    expect(denseBytes(4) - base).toBe(3 * FRAME);
    expect(releaseDense(['mem/a'], 4)).toBe(0);
    expect(hasFramesAt('mem/t', 4)).toBe(true);
    expect(releaseDense(['mem/s'], 4)).toBe(FRAME);
    expect(releaseDense(['mem/t'], 4)).toBe(2 * FRAME);
    expect(hasFramesAt('mem/a', 4)).toBe(false);
    expect(denseBytes(4)).toBe(base);
    // Tier 4 in the browser: the drawn alias shows the 2× frames and queues its TARGET.
    setDeferDense(true);
    takeDenseQueue();
    expect(getFrames('mem/a', 4)[0].density).toBe(2);
    expect(takeDenseQueue()).toEqual(['mem/t']);
  });

  it('the dense preload builds the target once, never an own generator of the alias', async () => {
    const runs = target('pre/t', 2, 5);
    strip('pre/a', 2, 4, 4, 9);
    let own = 0;
    defineHdSprite('pre/a', () => {
      own++;
      return [noise(16, 16, 1), noise(16, 16, 2)];
    });
    defineDenseAlias('pre/a', 'pre/t');
    strip('pre/b', 2, 4, 4, 10);
    defineDenseAlias('pre/b', 'pre/t');
    // Only the aliases are asked for: their target is built at 4× (once, nothing at 2×).
    const r = await preloadSprites(['pre/a', 'pre/b'], undefined, { density: 4, yieldFn: () => Promise.resolve() });
    expect(r.failed).toEqual([]);
    expect(runs).toEqual({ 2: 0, 4: 1 });
    expect(own).toBe(0);
    expect(getFrames('pre/b', 4)).toBe(getFrames('pre/t', 4));
  });
});

/** A real pool on one in-process port that logs each request. */
function loggingPool(log: ArtBuildRequest[]): ArtPool {
  const inner = inProcessPort(createArtWorkerHandler(async () => {}));
  const port: ArtWorkerPort = { ...inner, post: (req) => (log.push(req), inner.post(req)) };
  return new ArtPool([port]);
}

describe('dense aliases in the art pool and the packs', () => {
  it('buildRawPack packs the target once, never the alias', () => {
    const runs = target('pk/t', 2, 6);
    for (const id of ['pk/a', 'pk/b']) {
      strip(id, 2, 4, 4, 11);
      defineDenseAlias(id, 'pk/t');
    }
    const pack = buildRawPack(['pk/a', 'pk/t', 'pk/b'], 4);
    expect(pack.s.map((s) => s.id)).toEqual(['pk/t']);
    expect(pack.failed).toEqual([]);
    expect(runs[4]).toBe(1);
  });

  it('the pool sends and installs the target only; the alias then draws it; packs save the target only', async () => {
    target('pl/t', 2, 7);
    for (const id of ['pl/a', 'pl/b']) {
      strip(id, 2, 4, 4, 12);
      defineDenseAlias(id, 'pl/t');
    }
    const log: ArtBuildRequest[] = [];
    const pool = loggingPool(log);
    const r = await pool.build(['pl/a', 'pl/b'], 4);
    expect(log.flatMap((q) => q.ids)).toEqual(['pl/t']);
    expect([r.total, r.installed, r.failed.length]).toEqual([1, 1, 0]);
    expect(hasFramesAt('pl/a', 4)).toBe(true);
    expect(getFrames('pl/a', 4)).toBe(readyFrames('pl/t', 4));
    // An alias takes no frames and has none of its own: generatedSprites / readyFrames skip it.
    expect(installFrames('pl/a', 4, getFrames('pl/t', 4))).toBe(false);
    expect(readyFrames('pl/a', 4)).toBeNull();
    expect(generatedSprites(4, 'pl/')).toEqual(['pl/t']);
    const store = new MemoryByteStore();
    const cache = new ArtCache(store, 'build-1', () => {});
    expect(await cache.save('hd4-al', ['pl/'])).toBe(true);
    const saved = await decodeSpritePack(store.map.get('sprites:hd4-al') as Uint8Array);
    expect(saved.sprites.map(([id]) => id)).toEqual(['pl/t']);
    pool.close();
  });
});
