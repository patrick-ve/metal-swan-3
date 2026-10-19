import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import {
  clearSpriteCache,
  defineHiSprite,
  defineSprite,
  generatedSprites,
  isDeferredSprite,
  preloadOrder,
  preloadSprites,
} from '../../src/engine/sprites';

const one = () => new PixelBuffer(2, 2);
const hi = () => new PixelBuffer(4, 4);
defineSprite('tdefer/a', one, { hi });
defineSprite('tdefer/b-fidget', one, { defer: true, hi });
defineSprite('tdefer/c', one);
defineHiSprite('tdefer/c', hi);
defineSprite('tdefer/z-boss', one, { hi });

describe('SpriteOpts.defer', () => {
  it('marks the sprite', () => {
    expect(isDeferredSprite('tdefer/b-fidget')).toBe(true);
    expect(isDeferredSprite('tdefer/a')).toBe(false);
    expect(isDeferredSprite('nope/none')).toBe(false);
  });

  it('the boot preload (skipDeferred) leaves deferred sprites out', async () => {
    clearSpriteCache();
    const r = await preloadSprites('tdefer/', undefined, { skipDeferred: true, yieldFn: async () => {} });
    expect(r.total).toBe(3);
    expect(generatedSprites(1, 'tdefer/')).toEqual(['tdefer/a', 'tdefer/c', 'tdefer/z-boss']);
  });

  it('other preloads make deferred sprites after the `last` ids (the 2× preload too)', async () => {
    expect(preloadOrder(['tdefer/z-boss', 'tdefer/b-fidget', 'tdefer/c', 'tdefer/a'], ['tdefer/c'], ['tdefer/z'])).toEqual([
      'tdefer/c',
      'tdefer/a',
      'tdefer/z-boss',
      'tdefer/b-fidget',
    ]);
    clearSpriteCache();
    const seen: number[] = [];
    const r = await preloadSprites('tdefer/', (d) => seen.push(d), { density: 2, batch: 1, yieldFn: async () => {} });
    expect(r.total).toBe(4);
    expect(generatedSprites(2, 'tdefer/')).toHaveLength(4);
  });
});
