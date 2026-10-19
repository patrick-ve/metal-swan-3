import { describe, expect, it } from 'vitest';
import { strideRate, easeOutBack } from '../../src/engine/math';
import { PixelBuffer } from '../../src/engine/pixel';
import { Animator, defineSprite } from '../../src/engine/sprites';

const strip = (n: number) => () => Array.from({ length: n }, () => new PixelBuffer(2, 2));
defineSprite('test/rate/loop', strip(4), { durations: [3, 2, 4, 1] });
defineSprite('test/rate/once', strip(3), { ticksPerFrame: 2, loop: false });

/** Reference: the integer Animator of before (one tick per update). */
function reference(durs: number[], loop: boolean, ticks: number): Array<[number, boolean, boolean]> {
  const out: Array<[number, boolean, boolean]> = [];
  let index = 0, tick = 0, done = false;
  for (let t = 0; t < ticks; t++) {
    let changed = false;
    if (!done) {
      tick++;
      if (tick >= durs[index]) {
        tick = 0;
        if (index + 1 < durs.length) { index++; changed = true; }
        else if (loop) { index = 0; changed = true; }
        else done = true;
      }
    }
    out.push([index, changed, done]);
  }
  return out;
}

describe('Animator.update(rate)', () => {
  it('rate 1 (default) matches the integer animator exactly', () => {
    for (const [id, durs, loop] of [['test/rate/loop', [3, 2, 4, 1], true], ['test/rate/once', [2, 2, 2], false]] as const) {
      const a = new Animator().play(id);
      const want = reference([...durs], loop, 40);
      for (const w of want) {
        a.update();
        expect([a.index, a.changed, a.done]).toEqual(w);
        expect(Number.isInteger(a.tick)).toBe(true);
      }
      const b = new Animator().play(id);
      for (const w of want) {
        b.update(1);
        expect([b.index, b.changed, b.done]).toEqual(w);
      }
    }
  });

  it('a float rate carries the remainder: 0.5 halves the speed, 1.5 speeds it up', () => {
    const a = new Animator().play('test/rate/loop');
    let ticks = 0;
    while (a.loops < 10) { a.update(0.5); ticks++; }
    expect(ticks).toBe(10 * 10 * 2); // strip length 10 ticks
    const b = new Animator().play('test/rate/loop');
    ticks = 0;
    while (b.loops < 30) { b.update(1.5); ticks++; }
    // Faster than rate 1 (300 updates); the 1-tick frame still takes a whole update (one frame
    // per update at most), so a little slower than the ideal 200.
    expect(ticks).toBeGreaterThanOrEqual(200);
    expect(ticks).toBeLessThanOrEqual(215);
  });

  it('advances at most one frame per update, even at a high rate', () => {
    const a = new Animator().play('test/rate/loop');
    let prev = a.index;
    for (let t = 0; t < 50; t++) {
      a.update(7);
      expect((prev + 1) % 4).toBe(a.index);
      prev = a.index;
    }
  });

  it('a non-looping strip still ends with done', () => {
    const a = new Animator().play('test/rate/once');
    for (let t = 0; t < 20; t++) a.update(0.75);
    expect(a.done).toBe(true);
    expect(a.index).toBe(2);
  });
});

describe('strideRate', () => {
  it('is |speed| / nominal clamped to [min, max]', () => {
    expect(strideRate(1, 1)).toBe(1);
    expect(strideRate(-0.75, 1.5)).toBe(0.5);
    expect(strideRate(0.9, 1)).toBeCloseTo(0.9);
    expect(strideRate(0, 1)).toBe(0.5);
    expect(strideRate(5, 1)).toBe(1.6);
    expect(strideRate(0.2, 1, 0.1, 2)).toBeCloseTo(0.2);
    expect(strideRate(1, 0)).toBe(0.5);
  });
});

describe('easeOutBack', () => {
  it('starts at 0, ends at 1 and overshoots in between', () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => easeOutBack(t)))).toBeGreaterThan(1);
  });
});
