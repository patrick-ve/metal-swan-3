/**
 * Sprite packs and the sprite cache (docs/ARCHITECTURE.md §5.4 "Sprite cache"):
 * - a pack keeps pixels, anchors, points, density and shared buffers exactly;
 * - a broken pack, another format version or a cut-off pack is rejected;
 * - installed frames stop the generator from running (getFrames, preloadSprites);
 * - ArtCache: save → restore gives the same frames without generating; another build or a
 *   broken value is a miss and is deleted; a restored pack is not written again.
 */
import { describe, expect, it } from 'vitest';
import { MemoryByteStore } from '../../src/engine/byte-store';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { decodeSpritePack, encodeSpritePack, SPRITE_PACK_VERSION } from '../../src/engine/sprite-pack';
import {
  clearSpriteCache,
  defineHiSprite,
  defineSprite,
  generatedSprites,
  getFrames,
  installFrames,
  preloadSprites,
  readyFrames,
} from '../../src/engine/sprites';
import { ArtCache } from '../../src/game/art-cache';

const noYield = (): Promise<void> => Promise.resolve();

function noise(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let i = 0; i < b.data.length; i++) b.data[i] = (Math.imul(i + 1, 2654435761) ^ seed) >>> 0;
  return b;
}

async function gunzip(gz: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([gz as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function gzip(raw: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([raw as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

describe('sprite packs', () => {
  it('keep pixels, anchors, points, density and shared buffers', async () => {
    const shared = noise(5, 3, 7);
    const hi = noise(8, 6, 9);
    const sprites: Array<[string, Frame[]]> = [
      ['a/one', [{ buf: shared, ox: 2, oy: 3, pts: { muzzle: [4, -2], hand: [0, 1] } }, { buf: noise(1, 1, 1), ox: 0, oy: 0 }]],
      ['a/two', [{ buf: shared, ox: -1, oy: 5 }]],
      ['a/hi', [{ buf: hi, ox: 2, oy: 3, density: 2 }]],
      ['a/empty', []],
    ];
    const pack = await decodeSpritePack(await encodeSpritePack('build-1', 1, sprites, noYield));
    expect(pack.tag).toBe('build-1');
    expect(pack.density).toBe(1);
    expect(pack.sprites.map(([id]) => id)).toEqual(['a/one', 'a/two', 'a/hi', 'a/empty']);
    const [[, one], [, two], [, his], [, empty]] = pack.sprites;
    expect(one[0]).toMatchObject({ ox: 2, oy: 3, pts: { muzzle: [4, -2], hand: [0, 1] } });
    expect(one[0].density).toBeUndefined();
    expect([...one[0].buf.data]).toEqual([...shared.data]);
    expect([...one[1].buf.data]).toEqual([...noise(1, 1, 1).data]);
    // One buffer in, one buffer out: both ids draw the same decoded buffer.
    expect(two[0].buf).toBe(one[0].buf);
    expect(two[0]).toMatchObject({ ox: -1, oy: 5 });
    expect(two[0].pts).toBeUndefined();
    expect(his[0]).toMatchObject({ ox: 2, oy: 3, density: 2 });
    expect([his[0].buf.w, his[0].buf.h]).toEqual([8, 6]);
    expect([...his[0].buf.data]).toEqual([...hi.data]);
    expect(empty).toEqual([]);
  });

  it('encode buffers larger than one chunk (yielding between chunks)', async () => {
    const big = noise(700, 300, 3); // 840 KB: four chunks
    let yields = 0;
    const gz = await encodeSpritePack('b', 1, [['big', [{ buf: big, ox: 0, oy: 0 }]]], () => {
      yields++;
      return Promise.resolve();
    });
    expect(yields).toBeGreaterThanOrEqual(4);
    const [[, [f]]] = (await decodeSpritePack(gz)).sprites;
    expect(f.buf.data).toEqual(big.data);
  });

  it('reject what they cannot read', async () => {
    const good = await encodeSpritePack('b', 1, [['x', [{ buf: noise(3, 3, 1), ox: 0, oy: 0 }]]], noYield);
    await expect(decodeSpritePack(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
    const raw = await gunzip(good);
    const otherVersion = raw.slice();
    new DataView(otherVersion.buffer).setUint32(4, SPRITE_PACK_VERSION + 1, true);
    await expect(decodeSpritePack(await gzip(otherVersion))).rejects.toThrow(/format/);
    await expect(decodeSpritePack(await gzip(raw.slice(0, raw.length - 4)))).rejects.toThrow(/cut off/);
    const longer = new Uint8Array(raw.length + 4);
    longer.set(raw);
    await expect(decodeSpritePack(await gzip(longer))).rejects.toThrow(/extra/);
    const notPack = raw.slice();
    notPack[0] = 0;
    await expect(decodeSpritePack(await gzip(notPack))).rejects.toThrow(/not a sprite pack/);
  });
});

describe('installed frames', () => {
  it('stop the generator from running, and only an id without frames takes them', async () => {
    let runs = 0;
    defineSprite('cache-test/a', () => {
      runs++;
      return noise(4, 4, 1);
    });
    const frames: Frame[] = [{ buf: noise(4, 4, 2), ox: 2, oy: 4 }];
    expect(readyFrames('cache-test/a')).toBeNull();
    expect(installFrames('cache-test/a', 1, frames)).toBe(true);
    expect(getFrames('cache-test/a', 1)).toBe(frames);
    await preloadSprites('cache-test/', undefined, { yieldFn: noYield });
    expect(runs).toBe(0);
    expect(installFrames('cache-test/a', 1, [{ buf: noise(4, 4, 3), ox: 0, oy: 0 }])).toBe(false);
    expect(installFrames('cache-test/unknown', 1, frames)).toBe(false);
    expect(generatedSprites(1, 'cache-test/')).toEqual(['cache-test/a']);
    expect(readyFrames('cache-test/a')).toBe(frames);
  });

  it('install 2× frames only for ids with a 2× generator', () => {
    defineSprite('cache-test/h', () => noise(2, 2, 1));
    defineHiSprite('cache-test/h', () => [{ buf: noise(4, 4, 1), ox: 1, oy: 2, density: 2 }]);
    const hi: Frame[] = [{ buf: noise(4, 4, 5), ox: 1, oy: 2, density: 2 }];
    expect(installFrames('cache-test/a', 2, hi)).toBe(false);
    expect(installFrames('cache-test/h', 2, hi)).toBe(true);
    expect(getFrames('cache-test/h', 2)).toBe(hi);
    expect(generatedSprites(2, 'cache-test/')).toEqual(['cache-test/h']);
  });
});

describe('ArtCache', () => {
  let runs = 0;
  for (const id of ['art-test/a', 'art-test/b']) {
    defineSprite(id, () => {
      runs++;
      return [noise(6, 4, id.length), noise(6, 4, runs + 10)];
    }, { pts: { gun: [3, -1] } });
  }

  it('save → restore gives the same frames without running the generators', async () => {
    const store = new MemoryByteStore();
    const before = getFrames('art-test/a', 1).map((f) => [...f.buf.data]);
    getFrames('art-test/b', 1);
    expect(await new ArtCache(store, 'b1').save('boot', ['art-test/'])).toBe(true);
    expect(store.map.has('sprites:boot')).toBe(true);
    clearSpriteCache('art-test/a');
    clearSpriteCache('art-test/b');
    const n = runs;
    const cache = new ArtCache(store, 'b1');
    expect(await cache.restore('boot')).toBe(2);
    expect(getFrames('art-test/a', 1).map((f) => [...f.buf.data])).toEqual(before);
    expect(getFrames('art-test/a', 1)[0].pts).toEqual({ gun: [3, -1] });
    expect(runs).toBe(n);
    // The pack holds these ids already: nothing is written again.
    expect(await cache.save('boot', ['art-test/'])).toBe(false);
  });

  it('treat a pack of another build or a broken value as a miss, and delete it', async () => {
    const store = new MemoryByteStore();
    getFrames('art-test/a', 1);
    await new ArtCache(store, 'old').save('boot', ['art-test/']);
    clearSpriteCache('art-test/a');
    expect(await new ArtCache(store, 'new').restore('boot')).toBe(0);
    expect(store.map.has('sprites:boot')).toBe(false);
    expect(readyFrames('art-test/a')).toBeNull();

    await store.put('sprites:boot', new Uint8Array([31, 139, 8, 0, 1, 2, 3]));
    const warns: string[] = [];
    expect(await new ArtCache(store, 'new', (m) => warns.push(m)).restore('boot')).toBe(0);
    expect(warns).toHaveLength(1);
    expect(store.map.has('sprites:boot')).toBe(false);
    expect(await new ArtCache(store, 'new').restore('hi')).toBe(0);
  });

  it('write saves of one pack one after the other, the last one with every id', async () => {
    const store = new MemoryByteStore();
    clearSpriteCache('art-test/a');
    clearSpriteCache('art-test/b');
    getFrames('art-test/a', 1);
    const cache = new ArtCache(store, 'b2');
    const first = cache.save('fps', ['art-test/']);
    getFrames('art-test/b', 1);
    const second = cache.save('fps', ['art-test/']);
    // The first write starts after this code (so it already sees b); the second then has nothing new.
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    clearSpriteCache('art-test/a');
    clearSpriteCache('art-test/b');
    expect(await new ArtCache(store, 'b2').restore('fps')).toBe(2);
  });
});
