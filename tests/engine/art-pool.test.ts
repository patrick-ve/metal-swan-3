/**
 * The art pool (src/engine/art-pool.ts, docs/api/media.md "Art pool"):
 * - raw packs keep pixels, anchors, points, density and shared buffers exactly;
 * - DETERMINISM: frames built by the pool (in-process port AND node worker_threads) are
 *   byte-identical to main-thread getFrames, for hero, rider, boss, fx and decor ids at 2×;
 * - ids of one family go to one worker; a broken worker (or none) falls back to the main thread
 *   with one warning, and every build still resolves.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ArtPool,
  buildRawPack,
  createArtWorkerHandler,
  familyOf,
  inProcessPort,
  nodeArtPool,
  packFrames,
  poolSize,
  unpackFrames,
  type ArtBuildReply,
  type ArtBuildRequest,
  type ArtWorkerPort,
} from '../../src/engine/art-pool';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { clearSpriteCache, getFrames, listHiSprites, readyFrames } from '../../src/engine/sprites';
import { isLazyContent, loadContent } from '../../src/game/content/index';

/** A frame list as plain data (pixels as a hex digest of every word, for exact compares). */
function snap(frames: readonly Frame[]): unknown[] {
  return frames.map((f) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < f.buf.data.length; i++) h = Math.imul(h ^ f.buf.data[i], 16777619) >>> 0;
    return { w: f.buf.w, h: f.buf.h, ox: f.ox, oy: f.oy, d: f.density ?? 1, pts: f.pts ?? null, n: f.buf.data.length, hash: h };
  });
}

let sample: string[] = [];
const reference = new Map<string, unknown[]>();

beforeAll(async () => {
  await loadContent((id) => !isLazyContent(id));
  const take = (prefix: string, n: number): string[] => listHiSprites(prefix).slice(0, n);
  sample = [
    ...take('char/recruit/', 4),
    ...take('char/patrick/', 2),
    ...take('enemy/fatbike-youth-pair-1b', 3),
    ...take('enemy/delivery-rider/', 2),
    ...take('boss/ams-mayor/', 3),
    ...take('fx/explosion', 2),
    ...take('decor/ams/house', 2),
    ...take('vehicle/swan/', 2),
  ];
  clearSpriteCache();
  for (const id of sample) reference.set(id, snap(getFrames(id, 2)));
}, 120_000);

describe('raw packs', () => {
  it('round-trips pixels, anchors, points, density and shared buffers', () => {
    const a = new PixelBuffer(3, 2);
    a.data.set([1, 2, 3, 4, 5, 6]);
    const b = new PixelBuffer(1, 1);
    b.data[0] = 0xffeeddcc;
    const frames: Frame[] = [
      { buf: a, ox: 1, oy: 2, density: 2, pts: { gun: [3, -4] } },
      { buf: b, ox: 0, oy: 1 },
      { buf: a, ox: 1, oy: 2, density: 2 },
    ];
    const pack = packFrames(2, [['x/a', frames]]);
    expect(pack.px).toHaveLength(1);
    expect(pack.px[0].byteLength).toBe(7 * 4);
    const [[id, out]] = unpackFrames(pack);
    expect(id).toBe('x/a');
    expect(snap(out)).toEqual(snap(frames));
    expect(out[0].buf).toBe(out[2].buf);
    expect(out[1].density).toBeUndefined();
  });

  it('buildRawPack lists ids without frames of their own and frees the dense copies', () => {
    const id = sample[0];
    clearSpriteCache();
    const pack = buildRawPack([id, 'no/such-id'], 2);
    expect(pack.s.map((s) => s.id)).toEqual([id]);
    expect(pack.failed).toEqual(['no/such-id@2x']);
    expect(readyFrames(id, 2)).toBeNull();
  });
});

describe('determinism: pool frames = main-thread frames (2×)', () => {
  it('in-process port', async () => {
    expect(sample.length).toBeGreaterThanOrEqual(15);
    clearSpriteCache();
    const pool = new ArtPool([inProcessPort(createArtWorkerHandler(async () => {}))]);
    const r = await pool.build(sample, 2);
    expect(r.failed).toEqual([]);
    expect(r.installed).toBe(sample.length);
    for (const id of sample) expect(snap(readyFrames(id, 2) ?? []), id).toEqual(reference.get(id));
  });

  let threads: ArtPool | null = null;
  afterAll(() => threads?.close());

  it('node worker_threads', async () => {
    threads = await nodeArtPool(2, { warn: (m) => expect.fail(m) });
    clearSpriteCache();
    const r = await threads.build(sample, 2);
    expect(r.fallback).toBe(0);
    expect(r.failed).toEqual([]);
    expect(r.installed).toBe(sample.length);
    for (const id of sample) expect(snap(readyFrames(id, 2) ?? []), id).toEqual(reference.get(id));
  }, 120_000);
});

/** A scripted port: records requests; replies with empty packs, or fails. */
function fakePort(mode: 'ok' | 'fail', log: ArtBuildRequest[]): ArtWorkerPort {
  let reply: (r: ArtBuildReply) => void = () => {};
  let fail: (m: string) => void = () => {};
  return {
    post(req) {
      log.push(req);
      setTimeout(() => {
        if (mode === 'fail') fail('boom');
        else reply({ t: 'done', job: req.job, pack: { d: req.d, s: [], px: [], failed: [] }, ms: 0 });
      }, 0);
    },
    onReply: (cb) => {
      reply = cb;
    },
    onFail: (cb) => {
      fail = cb;
    },
    terminate() {},
  };
}

describe('scheduling and fallback', () => {
  it('families stay on one worker; batches keep the order', async () => {
    const logs: ArtBuildRequest[][] = [[], [], []];
    const pool = new ArtPool(
      logs.map((l) => fakePort('ok', l)),
      { batch: 2 },
    );
    const ids = ['char/bob/a', 'char/bob/b', 'char/bob/c', 'char/pip/a', 'fx/x', 'enemy/r-1a/x', 'char/bob/d'];
    const r = await pool.build(ids, 4);
    expect(r.total).toBe(7);
    const owner = (id: string): number => logs.findIndex((l) => l.some((q) => q.ids.includes(id)));
    expect(new Set(['char/bob/a', 'char/bob/b', 'char/bob/c', 'char/bob/d'].map(owner)).size).toBe(1);
    const bob = logs[owner('char/bob/a')].filter((q) => q.ids[0].startsWith('char/bob/'));
    expect(bob.map((q) => q.ids)).toEqual([
      ['char/bob/a', 'char/bob/b'],
      ['char/bob/c', 'char/bob/d'],
    ]);
    expect(bob.every((q) => q.d === 4)).toBe(true);
    // A later build of the same family goes to the same worker.
    await pool.build(['char/bob/e'], 4);
    expect(owner('char/bob/e')).toBe(owner('char/bob/a'));
  });

  it('families built one at a time on an idle pool spread over the workers', async () => {
    const logs: ArtBuildRequest[][] = [[], [], []];
    const pool = new ArtPool(logs.map((l) => fakePort('ok', l)));
    for (const h of ['ann', 'bob', 'cid']) await pool.build([`char/${h}/idle`], 2);
    const owner = (id: string): number => logs.findIndex((l) => l.some((q) => q.ids.includes(id)));
    expect(new Set(['char/ann/idle', 'char/bob/idle', 'char/cid/idle'].map(owner)).size).toBe(3);
  });

  it('a failing worker hands its ids to the fallback, warns once, and the build resolves', async () => {
    const warns: string[] = [];
    const fell: string[] = [];
    const pool = new ArtPool([fakePort('fail', []), fakePort('fail', [])], {
      warn: (m) => warns.push(m),
      fallback: async (ids) => {
        fell.push(...ids);
      },
    });
    const ids = ['char/a/1', 'char/b/1', 'fx/c', 'fx/d'];
    const r = await pool.build(ids, 2);
    expect(r.fallback).toBe(4);
    expect([...fell].sort()).toEqual([...ids].sort());
    expect(warns).toHaveLength(1);
    expect(pool.workers).toBe(0);
    // Later builds go straight to the fallback.
    expect((await pool.build(['fx/e'], 2)).fallback).toBe(1);
  });

  it('no workers: the default fallback builds on the main thread', async () => {
    clearSpriteCache();
    const ids = sample.slice(0, 3);
    const r = await new ArtPool([], { fallbackBudgetMs: 1000 }).build(ids, 2);
    expect(r.fallback).toBe(3);
    for (const id of ids) expect(snap(readyFrames(id, 2) ?? []), id).toEqual(reference.get(id));
  });

  it('familyOf and poolSize', () => {
    expect(familyOf('char/recruit/run')).toBe('char/recruit');
    expect(familyOf('enemy/fatbike-youth-pair-0a/ride')).toBe('enemy/fatbike-youth-pair-0a');
    expect(familyOf('boss/ams-mayor/stamp')).toBe('boss/ams-mayor');
    expect(familyOf('decor/ams/lamp')).toBe('decor/ams/lamp');
    expect(familyOf('fx/explosion-m')).toBe('fx/explosion-m');
    expect(poolSize(1)).toBe(1);
    expect(poolSize(4)).toBe(3);
    expect(poolSize(16)).toBe(8);
    expect(poolSize(Number.NaN)).toBe(1);
  });
});
