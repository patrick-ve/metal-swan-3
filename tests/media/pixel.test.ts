import { describe, expect, it } from 'vitest';
import { blendAdd, blendOver, div255 } from '../../src/engine/color';
import { PixelBuffer, seededRand, traceLine } from '../../src/engine/pixel';
import { charMap, mask } from './util';

const A = 0xff0000ff;
const B = 0x00ff00ff;
const C = 0x0000ffff;
const W = 0xffffffff;
const K = 0x000000ff;

describe('colour compositing', () => {
  it('div255 rounds exactly', () => {
    for (let x = 0; x <= 65025; x += 97) expect(div255(x)).toBe(Math.round(x / 255));
  });
  it('blends over and adds', () => {
    expect(blendOver(K, W, 0.5)).toBe(0x808080ff);
    expect(blendOver(K, 0xffffff00)).toBe(K);
    expect(blendOver(0, 0xff000080)).toBe(0xff000080);
    expect(blendAdd(0x404040ff, 0x808080ff)).toBe(0xc0c0c0ff);
    expect(blendAdd(0xc0c0c0ff, 0x808080ff)).toBe(0xffffffff);
  });
});

describe('basic primitives', () => {
  it('set/get ignore out-of-range pixels', () => {
    const b = new PixelBuffer(3, 2);
    b.set(1, 1, A);
    b.set(-1, 0, A);
    b.set(3, 0, A);
    expect(b.get(1, 1)).toBe(A);
    expect(b.get(5, 5)).toBe(0);
    expect(b.countOpaque()).toBe(1);
  });

  it('rect clips and strokeRect stays inside the box', () => {
    const b = new PixelBuffer(5, 4).rect(-2, -1, 4, 3, A);
    expect(mask(b)).toEqual(['##...', '##...', '.....', '.....']);
    const s = new PixelBuffer(5, 4).strokeRect(0, 0, 5, 4, A);
    expect(mask(s)).toEqual(['#####', '#...#', '#...#', '#####']);
  });

  it('hline / vline are inclusive in any order', () => {
    const b = new PixelBuffer(5, 5).hline(3, 1, 0, A).vline(4, 4, 2, A);
    expect(mask(b)).toEqual(['.###.', '.....', '....#', '....#', '....#']);
  });

  it('line is Bresenham and direction-independent', () => {
    const a = new PixelBuffer(5, 3).line(0, 0, 4, 2, A);
    const b = new PixelBuffer(5, 3).line(4, 2, 0, 0, A);
    expect(mask(a)).toEqual(['#....', '.##..', '...##']);
    expect(mask(b)).toEqual(mask(a));
    const pts: string[] = [];
    traceLine(0, 0, 0, 3, (x, y) => pts.push(`${x},${y}`));
    expect(pts).toEqual(['0,0', '0,1', '0,2', '0,3']);
  });

  it('thickLine gives a clean band with round caps', () => {
    const b = new PixelBuffer(11, 5).thickLine(2, 2, 8, 2, 3, A);
    expect(mask(b)).toEqual(['...........', '..#######..', '.#########.', '..#######..', '...........']);
    // Width 1 is a plain line.
    expect(mask(new PixelBuffer(5, 3).thickLine(0, 0, 4, 2, 1, A))).toEqual(['#....', '.##..', '...##']);
  });

  it('taper stays connected down to 1 px', () => {
    const b = new PixelBuffer(12, 30).taper(5, 2, 7, 27, 6, 1, A);
    for (let y = 2; y <= 27; y++) expect(mask(b, 0, y, 12, 1)[0]).toContain('#');
  });
});

describe('round shapes', () => {
  it('small circles have classic pixel shapes', () => {
    expect(mask(new PixelBuffer(1, 1).circle(0, 0, 0, A))).toEqual(['#']);
    expect(mask(new PixelBuffer(3, 3).circle(1, 1, 1, A))).toEqual(['.#.', '###', '.#.']);
    expect(mask(new PixelBuffer(5, 5).circle(2, 2, 2, A))).toEqual(['.###.', '#####', '#####', '#####', '.###.']);
    expect(mask(new PixelBuffer(7, 7).circle(3, 3, 3, A))).toEqual([
      '..###..',
      '.#####.',
      '#######',
      '#######',
      '#######',
      '.#####.',
      '..###..',
    ]);
  });

  it('rings are 1-px, 8-connected boundaries', () => {
    expect(mask(new PixelBuffer(5, 5).circle(2, 2, 2, A, false))).toEqual(['.###.', '#...#', '#...#', '#...#', '.###.']);
    expect(mask(new PixelBuffer(7, 7).circle(3, 3, 3, A, false))).toEqual([
      '..###..',
      '.#...#.',
      '#.....#',
      '#.....#',
      '#.....#',
      '.#...#.',
      '..###..',
    ]);
  });

  it('box ellipses handle even sizes', () => {
    expect(mask(new PixelBuffer(4, 4).ellipse(0, 0, 4, 4, A))).toEqual(['.##.', '####', '####', '.##.']);
    expect(mask(new PixelBuffer(2, 2).ellipse(0, 0, 2, 2, A))).toEqual(['##', '##']);
    expect(mask(new PixelBuffer(8, 4).ellipse(0, 0, 8, 4, A))).toEqual(['..####..', '########', '########', '..####..']);
    expect(mask(new PixelBuffer(8, 4).ellipse(0, 0, 8, 4, A, false))).toEqual([
      '..####..',
      '##....##',
      '##....##',
      '..####..',
    ]);
  });

  it('roundRect corners follow circle(r)', () => {
    expect(mask(new PixelBuffer(6, 4).roundRect(0, 0, 6, 4, 1, A))).toEqual(['.####.', '######', '######', '.####.']);
    expect(mask(new PixelBuffer(6, 4).roundRect(0, 0, 6, 4, 1, A, false))).toEqual([
      '.####.',
      '#....#',
      '#....#',
      '.####.',
    ]);
  });

  it('sphere fills exactly the circle and shades light → dark', () => {
    const ramp = [0x111111ff, 0x555555ff, 0x999999ff, 0xddddddff];
    const b = new PixelBuffer(9, 9).sphere(4, 4, 4, ramp, { dither: false });
    expect(mask(b)).toEqual(mask(new PixelBuffer(9, 9).circle(4, 4, 4, A)));
    // Lit from the top-left: that side is lighter than the bottom-right.
    expect(b.get(2, 2) >>> 24).toBeGreaterThan(b.get(6, 6) >>> 24);
  });
});

describe('poly', () => {
  it('fills squares and triangles exactly (vertices are pixel centres)', () => {
    expect(mask(new PixelBuffer(4, 4).poly([[0, 0], [3, 0], [3, 3], [0, 3]], A))).toEqual(['####', '####', '####', '####']);
    expect(mask(new PixelBuffer(5, 5).poly([0, 0, 4, 0, 0, 4], A))).toEqual(['#####', '####.', '###..', '##...', '#....']);
  });

  it('handles concave shapes', () => {
    const l = new PixelBuffer(5, 5).poly([[0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [0, 4]], A);
    expect(mask(l)).toEqual(['###..', '###..', '#####', '#####', '#####']);
  });

  it('never breaks up thin slivers', () => {
    const b = new PixelBuffer(30, 12).poly([[0, 0], [29, 11], [1, 1]], A);
    for (let x = 0; x < 30; x++) expect(mask(b, x, 0, 1, 12).join('')).toContain('#');
  });
});

describe('blit', () => {
  const src = (): PixelBuffer => {
    const s = new PixelBuffer(3, 2);
    s.set(0, 0, A);
    s.set(1, 0, B);
    s.set(2, 0, C);
    s.set(0, 1, W);
    return s;
  };
  const key = new Map([[A, 'a'], [B, 'b'], [C, 'c'], [W, 'w'], [K, 'k']]);

  it('copies, flips and clips', () => {
    expect(charMap(new PixelBuffer(3, 2).blit(src(), 0, 0), key)).toEqual(['abc', 'w..']);
    expect(charMap(new PixelBuffer(3, 2).blit(src(), 0, 0, { flipX: true }), key)).toEqual(['cba', '..w']);
    expect(charMap(new PixelBuffer(3, 2).blit(src(), 0, 0, { flipY: true }), key)).toEqual(['w..', 'abc']);
    expect(charMap(new PixelBuffer(3, 2).blit(src(), -1, 0), key)).toEqual(['bc.', '...']);
    expect(charMap(new PixelBuffer(3, 2).blit(src(), -1, 0, { flipX: true }), key)).toEqual(['ba.', '.w.']);
  });

  it('supports source rectangles, maps, solid and copy', () => {
    expect(charMap(new PixelBuffer(2, 1).blit(src(), 0, 0, { sx: 1, sw: 2, sh: 1 }), key)).toEqual(['bc']);
    expect(charMap(new PixelBuffer(3, 2).blit(src(), 0, 0, { map: new Map([[A, C]]) }), key)).toEqual(['cbc', 'w..']);
    expect(charMap(new PixelBuffer(3, 2).blit(src(), 0, 0, { solid: W }), key)).toEqual(['www', 'w..']);
    const dst = new PixelBuffer(3, 2).fill(K).blit(src(), 0, 0, { blend: 'copy' });
    expect(charMap(dst, key)).toEqual(['abc', 'w..']);
  });

  it('blitFrame places by anchor and mirrors around it like the renderers', () => {
    const f = { buf: src(), ox: 1, oy: 2 };
    // top = y − oy = 0 (the frame stands on line y = 2)
    expect(charMap(new PixelBuffer(5, 3).blitFrame(f, 2, 2), key)).toEqual(['.abc.', '.w...', '.....']);
    // flipped: left = x − (w − 1 − ox) = 2 − 1 = 1
    expect(charMap(new PixelBuffer(5, 3).blitFrame(f, 2, 2, { flipX: true }), key)).toEqual(['.cba.', '...w.', '.....']);
  });

  it('blends with alpha and additive light', () => {
    const one = new PixelBuffer(1, 1).fill(W);
    expect(new PixelBuffer(1, 1).fill(K).blit(one, 0, 0, { alpha: 0.5 }).get(0, 0)).toBe(0x808080ff);
    const grey = new PixelBuffer(1, 1).fill(0x808080ff);
    expect(new PixelBuffer(1, 1).fill(0x404040ff).blit(grey, 0, 0, { blend: 'add' }).get(0, 0)).toBe(0xc0c0c0ff);
    expect(new PixelBuffer(1, 1).fill(K).blendRect(0, 0, 1, 1, W, 0.25).get(0, 0)).toBe(0x404040ff);
  });
});

describe('effects', () => {
  it('outline draws around the shape (4- or 8-connected) and inside', () => {
    const dot = (): PixelBuffer => new PixelBuffer(5, 5).rect(2, 2, 1, 1, A);
    const key = new Map([[A, '#'], [K, 'o']]);
    expect(charMap(dot().outline(K), key)).toEqual(['.....', '..o..', '.o#o.', '..o..', '.....']);
    expect(charMap(dot().outline(K, { corners: true }), key)).toEqual(['.....', '.ooo.', '.o#o.', '.ooo.', '.....']);
    const block = new PixelBuffer(5, 5).rect(1, 1, 3, 3, A).outline(K, { inside: true });
    expect(charMap(block, key)).toEqual(['.....', '.ooo.', '.o#o.', '.ooo.', '.....']);
  });

  it('outline respects `only` and never covers other art', () => {
    const b = new PixelBuffer(4, 1);
    b.set(1, 0, A);
    b.set(2, 0, B);
    b.outline(K, { only: A });
    expect(b.get(0, 0)).toBe(K);
    expect(b.get(2, 0)).toBe(B);
  });

  it('bevel shades lit and shadow edges', () => {
    const D = 0x202020ff;
    const M = 0x808080ff;
    const L = 0xe0e0e0ff;
    const b = new PixelBuffer(4, 4).rect(0, 0, 4, 4, A).bevel([D, M, L]);
    expect(charMap(b, new Map([[D, 'D'], [M, 'M'], [L, 'L']]))).toEqual(['LLLM', 'LMMD', 'LMMD', 'MDDD']);
  });

  it('dither levels cover the expected share', () => {
    const half = new PixelBuffer(8, 8).dither(0, 0, 8, 8, A, 0.5);
    expect(half.countOpaque()).toBe(32);
    expect(mask(half, 0, 0, 4, 2)).toEqual(['#.#.', '.#.#']);
    expect(new PixelBuffer(4, 4).dither(0, 0, 4, 4, A, 0.25).countOpaque()).toBe(4);
    expect(new PixelBuffer(4, 4).dither(0, 0, 4, 4, A, 1).countOpaque()).toBe(16);
    expect(new PixelBuffer(4, 4).dither(0, 0, 4, 4, A, 0).countOpaque()).toBe(0);
  });

  it('gradient makes equal bands; `only` clips to a shape', () => {
    const g = new PixelBuffer(1, 8).gradient(0, 0, 1, 8, [A, B, C, W], { dither: false });
    expect(charMap(g, new Map([[A, 'a'], [B, 'b'], [C, 'c'], [W, 'w']])).join('')).toBe('aabbccww');
    const shape = new PixelBuffer(3, 1);
    shape.set(1, 0, K);
    shape.gradient(0, 0, 3, 1, [A], { only: K });
    expect(shape.get(0, 0)).toBe(0);
    expect(shape.get(1, 0)).toBe(A);
  });

  it('noise is deterministic for a seed', () => {
    const a = new PixelBuffer(16, 16).noise(seededRand(3), { colors: [A, B], density: 0.3 });
    const b = new PixelBuffer(16, 16).noise(seededRand(3), { colors: [A, B], density: 0.3 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    expect(a.countOpaque()).toBeGreaterThan(40);
    expect(a.countOpaque()).toBeLessThan(120);
  });

  it('replace, recolor, silhouette and mirror', () => {
    const b = new PixelBuffer(3, 1);
    b.set(0, 0, A);
    b.set(1, 0, B);
    expect(b.clone().replace(A, C).get(0, 0)).toBe(C);
    expect(b.clone().recolor((c) => (c === B ? W : c)).get(1, 0)).toBe(W);
    expect(b.clone().silhouette(K).get(1, 0)).toBe(K);
    expect(b.clone().mirror('x').get(2, 0)).toBe(A);
  });
});

describe('buffer utilities', () => {
  it('trimBounds, crop, padded, scaled, flipped', () => {
    const b = new PixelBuffer(8, 8);
    b.set(2, 3, A);
    b.set(5, 4, B);
    expect(b.trimBounds()).toEqual({ x: 2, y: 3, w: 4, h: 2 });
    expect(new PixelBuffer(4, 4).trimBounds()).toBeNull();
    const c = b.crop(2, 3, 4, 2);
    expect([c.w, c.h, c.get(0, 0), c.get(3, 1)]).toEqual([4, 2, A, B]);
    const p = c.padded(1);
    expect([p.w, p.h, p.get(1, 1)]).toEqual([6, 4, A]);
    const s = c.scaled(3);
    expect([s.w, s.h, s.get(2, 2), s.get(3, 0)]).toEqual([12, 6, A, 0]);
    expect(c.flipped().get(0, 1)).toBe(B);
  });

  it('resized, scale2x and rotated', () => {
    const b = new PixelBuffer(2, 2);
    b.set(0, 0, A);
    b.set(1, 1, B);
    const r = b.resized(4, 4);
    expect([r.get(1, 1), r.get(2, 2), r.get(3, 0)]).toEqual([A, B, 0]);
    expect(b.resized(1, 1).get(0, 0)).toBe(B);
    // Scale2x rounds a diagonal staircase: the corner between two diagonal pixels fills in.
    const diag = new PixelBuffer(3, 3);
    diag.set(0, 0, A);
    diag.set(1, 1, A);
    diag.set(2, 2, A);
    const s2 = diag.scale2x();
    expect([s2.w, s2.h]).toEqual([6, 6]);
    expect(s2.countOpaque()).toBeGreaterThan(12);
    // Quarter turns are exact.
    const l = new PixelBuffer(3, 2);
    l.set(0, 0, A);
    l.set(2, 1, B);
    const q1 = l.rotated(Math.PI / 2);
    expect([q1.w, q1.h, q1.get(1, 0), q1.get(0, 2)]).toEqual([2, 3, A, B]);
    const q3 = l.rotated(-Math.PI / 2);
    expect([q3.get(0, 2), q3.get(1, 0)]).toEqual([A, B]);
    expect(Array.from(l.rotated(Math.PI).data)).toEqual(Array.from(l.flipped(true, true).data));
    expect(Array.from(l.rotated(0).data)).toEqual(Array.from(l.data));
    // Free angles: size fits, parity kept, a bar stays one connected piece.
    const bar = new PixelBuffer(12, 4).rect(0, 0, 12, 4, A);
    for (const quality of ['smooth', 'fast'] as const) {
      const rb = bar.rotated(Math.PI / 6, { quality });
      expect((rb.w - bar.w) % 2).toBe(0);
      expect((rb.h - bar.h) % 2).toBe(0);
      expect(rb.countOpaque()).toBeGreaterThan(38);
      expect(rb.countOpaque()).toBeLessThan(58);
    }
  });

  it('round-trips RGBA bytes', () => {
    const b = new PixelBuffer(2, 1);
    b.set(0, 0, 0x11223344);
    b.set(1, 0, 0xaabbccdd);
    const bytes = b.toRGBA();
    expect(Array.from(bytes)).toEqual([0x11, 0x22, 0x33, 0x44, 0xaa, 0xbb, 0xcc, 0xdd]);
    expect(Array.from(PixelBuffer.fromRGBA(2, 1, bytes).data)).toEqual(Array.from(b.data));
  });

  it('bumps version on mutation', () => {
    const b = new PixelBuffer(2, 2);
    const v = b.version;
    b.rect(0, 0, 1, 1, A);
    expect(b.version).toBeGreaterThan(v);
  });
});
