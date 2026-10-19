/** Creature turn-around helpers (plan F5): turnSquash frames and the Turner timing. */
import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import { PAL, inPalette } from '../../src/engine/palette';
import type { Frame } from '../../src/engine/render';
import { Turner } from '../../src/game/content/creatures/common';
import { turnSquash } from '../../src/game/content/creatures/draw';

function body(D = 1): Frame {
  const b = new PixelBuffer(30 * D, 20 * D);
  b.rect(2 * D, 2 * D, 26 * D, 18 * D, PAL.olive[2]);
  return { buf: b, ox: 12, oy: 20, pts: { eye: [10, -14] }, density: D === 1 ? undefined : D };
}

describe('turnSquash', () => {
  it('narrows the frame, keeps the height, the ground line and the anchor column', () => {
    const f = body();
    const [a, b] = turnSquash(f);
    for (const t of [a, b]) {
      expect(t.oy).toBe(f.oy);
      expect(t.buf.h).toBeGreaterThanOrEqual(f.buf.h);
      for (const c of t.buf.data) if (c >>> 24) expect(inPalette(c)).toBe(true);
    }
    expect(a.buf.trimBounds()!.w).toBeLessThan(f.buf.trimBounds()!.w);
    expect(b.buf.trimBounds()!.w).toBeLessThan(a.buf.trimBounds()!.w);
    // The anchor sits at the same fraction of the body width (2/5 here).
    for (const t of [a, b]) {
      const tb = t.buf.trimBounds()!;
      expect(Math.abs((t.ox - tb.x) / tb.w - 12 / 30)).toBeLessThan(0.15);
    }
    expect(a.pts?.eye).toEqual([Math.round(10 * 0.66), -14]);
  });

  it('never draws below the ground line (the outline is clipped at the feet)', () => {
    for (const D of [1, 2]) {
      const f = body(D);
      for (const t of turnSquash(f)) {
        const tb = t.buf.trimBounds()!;
        expect(tb.y + tb.h).toBe(f.oy * D);
      }
    }
  });

  it('keeps the density of 2x frames', () => {
    const [a] = turnSquash(body(2));
    expect(a.density).toBe(2);
    expect(a.buf.w % 2).toBe(0);
  });
});

describe('Turner', () => {
  it('turns only after the target is >= 12 px behind for >= 8 ticks', () => {
    const t = new Turner(1);
    for (let i = 0; i < 7; i++) t.update(-12);
    expect(t.turning).toBe(false);
    t.update(-5); // back in front-ish: the count resets
    for (let i = 0; i < 7; i++) t.update(-20);
    expect(t.turning).toBe(false);
    t.update(-20);
    expect(t.turning).toBe(true);
    expect(t.facing).toBe(1);
  });

  it('plays narrowing then widening frames and flips at the midpoint', () => {
    const t = new Turner(1, 2, 2);
    for (let i = 0; i < 8; i++) t.update(-30);
    const seen: number[] = [];
    let flips = 0;
    while (t.turning) {
      seen.push(t.frame());
      if (t.update(-30)) flips++;
    }
    expect(seen).toEqual([0, 0, 1, 1, 1, 1, 0, 0]);
    expect(flips).toBe(1);
    expect(t.facing).toBe(-1);
    expect(t.frame()).toBe(-1);
  });

  it('jitter in front never turns; snap cancels a turn', () => {
    const t = new Turner(-1);
    for (let i = 0; i < 100; i++) t.update(i % 2 ? -40 : 11);
    expect(t.turning).toBe(false);
    for (let i = 0; i < 8; i++) t.update(40);
    expect(t.turning).toBe(true);
    t.snap(1);
    expect(t.turning).toBe(false);
    expect(t.facing).toBe(1);
  });
});
