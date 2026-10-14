/**
 * The fast paths of the pixel operations that art generation leans on give exactly the result of
 * the plain per-pixel rules: the unflipped 'over' blit (a tight loop of its own) and `outline`
 * (a padded mask instead of bounds checks), on random sparse buffers with clipping.
 */
import { describe, expect, it } from 'vitest';
import { blendOver } from '../../src/engine/color';
import { PixelBuffer } from '../../src/engine/pixel';
import { hash2 } from '../../src/game/art/paint';

/** A sparse random buffer: transparent, opaque and (a few) half-transparent pixels. */
function noisy(w: number, h: number, seed: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = hash2(x, y, seed);
      if (r < 0.6) continue;
      const rgb = (Math.floor(hash2(x, y, seed + 1) * 0xffffff) << 8) >>> 0;
      b.data[y * w + x] = (rgb | (r > 0.95 ? 128 : 255)) >>> 0;
    }
  }
  return b.touch();
}

function blitRef(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const X = x + dx;
      const Y = y + dy;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      const s = src.data[y * src.w + x];
      if ((s & 255) === 0) continue;
      dst.data[Y * dst.w + X] = blendOver(dst.data[Y * dst.w + X], s);
    }
  }
}

function outlineRef(b: PixelBuffer, c: number, corners: boolean, inside: boolean, only?: number): void {
  const { w, h } = b;
  const m = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && (only === undefined ? (src[y * w + x] & 255) !== 0 : src[y * w + x] === only);
  const src = b.data.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n4 = [m(x - 1, y), m(x + 1, y), m(x, y - 1), m(x, y + 1)];
      const n8 = [m(x - 1, y - 1), m(x + 1, y - 1), m(x - 1, y + 1), m(x + 1, y + 1)];
      if (inside) {
        if (!m(x, y)) continue;
        if (n4.some((v) => !v) || (corners && n8.some((v) => !v))) b.data[y * w + x] = c;
      } else {
        if (m(x, y) || (src[y * w + x] & 255) !== 0) continue;
        if (n4.some((v) => v) || (corners && n8.some((v) => v))) b.data[y * w + x] = c;
      }
    }
  }
}

describe('pixel fast paths', () => {
  it("the unflipped 'over' blit equals the per-pixel rule, clipped on every side", () => {
    for (const [dx, dy] of [[0, 0], [-7, 3], [5, -4], [20, 11], [-30, -30], [3, 2]]) {
      const src = noisy(23, 17, 3);
      const a = noisy(31, 21, 9);
      const b = a.clone();
      a.blit(src, dx, dy);
      blitRef(b, src, dx, dy);
      expect(Array.from(a.data)).toEqual(Array.from(b.data));
      // A source rect (sx, sy, sw, sh) is the same as blitting its crop.
      const c = noisy(31, 21, 9);
      const d = c.clone();
      c.blit(src, dx + 4, dy + 2, { sx: 4, sy: 2, sw: 12, sh: 9 });
      blitRef(d, src.crop(4, 2, 12, 9), dx + 4, dy + 2);
      expect(Array.from(c.data)).toEqual(Array.from(d.data));
    }
  });

  it('outline equals the per-pixel rule (corners, inside, only)', () => {
    for (const [corners, inside] of [[false, false], [true, false], [false, true], [true, true]]) {
      for (const seed of [1, 2]) {
        const a = noisy(19, 13, seed);
        const b = a.clone();
        a.outline(0x000000ff, { corners, inside });
        outlineRef(b, 0x000000ff, corners, inside);
        expect(Array.from(a.data)).toEqual(Array.from(b.data));
      }
    }
    const a = new PixelBuffer(9, 7).rect(1, 1, 4, 3, 0xff0000ff).rect(4, 3, 3, 3, 0x00ff00ff);
    const b = a.clone();
    a.outline(0x000000ff, { only: 0xff0000ff });
    outlineRef(b, 0x000000ff, false, false, 0xff0000ff);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
