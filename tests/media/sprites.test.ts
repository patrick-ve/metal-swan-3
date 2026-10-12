import { afterEach, describe, expect, it, vi } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import {
  Animator,
  clearSpriteCache,
  defineSprite,
  frameCount,
  framePoint,
  getFrame,
  getFrames,
  hasSprite,
  listSprites,
  placeholderFrames,
  preloadSprites,
  spriteErrors,
} from '../../src/engine/sprites';

afterEach(() => vi.restoreAllMocks());

const strip = (n: number, w = 4, h = 6): PixelBuffer[] => Array.from({ length: n }, () => new PixelBuffer(w, h).fill(0xffffffff));

describe('sprite registry', () => {
  it('generates lazily and caches', () => {
    const gen = vi.fn(() => strip(3));
    defineSprite('test/lazy', gen);
    expect(hasSprite('test/lazy')).toBe(true);
    expect(gen).not.toHaveBeenCalled();
    expect(frameCount('test/lazy')).toBe(3);
    getFrames('test/lazy');
    getFrame('test/lazy', 7);
    expect(gen).toHaveBeenCalledTimes(1);
    clearSpriteCache('test/lazy');
    getFrames('test/lazy');
    expect(gen).toHaveBeenCalledTimes(2);
  });

  it('wraps frame indexes, including negative ones', () => {
    defineSprite('test/wrap', () => strip(3).map((b, i) => b.fill(i + 1)));
    expect(getFrame('test/wrap', 4).buf.get(0, 0)).toBe(2);
    expect(getFrame('test/wrap', -1).buf.get(0, 0)).toBe(3);
  });

  it('lists ids by prefix', () => {
    defineSprite('test/list/a', () => strip(1));
    defineSprite('test/list/b', () => strip(1));
    expect(listSprites('test/list/')).toEqual(['test/list/a', 'test/list/b']);
  });

  it('applies anchors and points', () => {
    defineSprite('test/feet', () => strip(1, 5, 8));
    expect(getFrame('test/feet', 0)).toMatchObject({ ox: 2, oy: 8 });
    defineSprite('test/center', () => strip(1, 6, 8), { anchor: 'center' });
    expect(getFrame('test/center', 0)).toMatchObject({ ox: 3, oy: 4 });
    defineSprite('test/custom', () => strip(2), { anchor: [1, 2], pts: [{ muzzle: [3, -1] }, { muzzle: [4, -1] }] });
    expect(getFrame('test/custom', 1)).toMatchObject({ ox: 1, oy: 2, pts: { muzzle: [4, -1] } });
    const out: [number, number] = [0, 0];
    expect(framePoint(getFrame('test/custom', 0), 'muzzle', true, false, out)).toEqual([-3, -1]);
    expect(framePoint(getFrame('test/custom', 0), 'nope')).toBeUndefined();
  });

  it('keeps Frame objects and trims margins without moving the anchor', () => {
    defineSprite('test/frames', () => ({ buf: new PixelBuffer(3, 3), ox: 1, oy: 1, pts: { hand: [1, 0] } }));
    expect(getFrame('test/frames', 0)).toMatchObject({ ox: 1, oy: 1, pts: { hand: [1, 0] } });
    defineSprite(
      'test/trim',
      () => {
        const b = new PixelBuffer(10, 10);
        b.rect(4, 6, 2, 3, 0xffffffff);
        return b;
      },
      { trim: true },
    );
    const f = getFrame('test/trim', 0);
    expect([f.buf.w, f.buf.h]).toEqual([2, 3]);
    // Feet anchor of the 10×10 buffer was (5, 10); in the trimmed frame it is (1, 4).
    expect([f.ox, f.oy]).toEqual([1, 4]);
  });

  it('missing ids and failing generators give a placeholder and warn once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getFrames('test/missing')).toBe(placeholderFrames());
    getFrames('test/missing');
    defineSprite('test/broken', () => {
      throw new Error('boom');
    });
    expect(getFrames('test/broken')).toBe(placeholderFrames());
    getFrames('test/broken');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(spriteErrors()).toContainEqual({ id: 'test/broken', error: 'boom' });
    defineSprite('test/empty', () => []);
    expect(getFrames('test/empty')).toBe(placeholderFrames());
  });

  it('preloads in batches with progress and never rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 5; i++) defineSprite(`pre/s${i}`, () => strip(1));
    defineSprite('pre/zz-bad', () => {
      throw new Error('bad');
    });
    const progress: string[] = [];
    let yields = 0;
    const report = await preloadSprites('pre/', (d, t) => progress.push(`${d}/${t}`), {
      batch: 2,
      yieldFn: async () => {
        yields++;
      },
    });
    expect(report).toEqual({ total: 6, failed: ['pre/zz-bad'] });
    expect(progress).toEqual(['2/6', '4/6', '6/6']);
    expect(yields).toBe(2);
  });
});

describe('Animator', () => {
  defineSprite('anim/three', () => strip(3), { ticksPerFrame: 2 });

  it('loops at ticksPerFrame', () => {
    const a = new Animator().play('anim/three');
    expect([a.index, a.changed, a.length]).toEqual([0, true, 6]);
    const seen: number[] = [];
    for (let t = 0; t < 7; t++) seen.push(a.update().index);
    expect(seen).toEqual([0, 1, 1, 2, 2, 0, 0]);
    expect(a.loops).toBe(1);
  });

  it('stops on the last frame and reports done after its duration', () => {
    const a = new Animator().play('anim/three', { loop: false });
    for (let t = 0; t < 5; t++) a.update();
    expect([a.index, a.done]).toEqual([2, false]);
    a.update();
    expect([a.index, a.done]).toEqual([2, true]);
    a.update();
    expect(a.index).toBe(2);
  });

  it('uses per-frame durations and flags frame changes', () => {
    const a = new Animator().play('anim/three', { durations: [1, 3, 2] });
    const seen: string[] = [];
    for (let t = 0; t < 7; t++) {
      a.update();
      seen.push(`${a.index}${a.changed ? '*' : ''}`);
    }
    expect(seen).toEqual(['1*', '1', '1', '2*', '2', '0*', '1*']);
  });

  it('does not restart the same animation unless asked', () => {
    const a = new Animator().play('anim/three');
    a.update();
    a.update();
    a.play('anim/three');
    expect(a.index).toBe(1);
    a.play('anim/three', { restart: true });
    expect(a.index).toBe(0);
    a.play('anim/three', { frame: 2, restart: true });
    expect(a.index).toBe(2);
  });

  it('plays unknown ids as the placeholder', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a = new Animator().play('anim/missing');
    expect(a.frameCount).toBe(1);
    expect(a.frame).toBe(placeholderFrames()[0]);
  });
});
