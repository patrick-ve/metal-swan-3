import type { Color } from '../../src/engine/color';
import type { PixelBuffer } from '../../src/engine/pixel';

/** Rows of '#' (non-transparent) and '.' (transparent) for readable pixel assertions. */
export function mask(buf: PixelBuffer, x = 0, y = 0, w = buf.w, h = buf.h): string[] {
  const rows: string[] = [];
  for (let yy = y; yy < y + h; yy++) {
    let s = '';
    for (let xx = x; xx < x + w; xx++) s += (buf.get(xx, yy) & 255) !== 0 ? '#' : '.';
    rows.push(s);
  }
  return rows;
}

/** Rows of characters chosen by a colour → char key ('.' for transparent, '?' for others). */
export function charMap(buf: PixelBuffer, key: ReadonlyMap<Color, string>): string[] {
  const rows: string[] = [];
  for (let y = 0; y < buf.h; y++) {
    let s = '';
    for (let x = 0; x < buf.w; x++) {
      const c = buf.get(x, y);
      s += (c & 255) === 0 ? '.' : (key.get(c) ?? '?');
    }
    rows.push(s);
  }
  return rows;
}
