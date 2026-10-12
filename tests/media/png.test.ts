import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, encodePNG, PNG_SIGNATURE } from '../../tools/lib/png';

function u32(b: Uint8Array, o: number): number {
  return new DataView(b.buffer, b.byteOffset).getUint32(o);
}

/** Undo PNG scanline filters (bpp 4). */
function unfilter(raw: Uint8Array, w: number, h: number): Uint8Array {
  const stride = w * 4;
  const out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 4 ? out[y * stride + i - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= 4 && y > 0 ? out[(y - 1) * stride + i - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][f];
      out[y * stride + i] = (x + pred) & 255;
    }
  }
  return out;
}

describe('PNG encoder', () => {
  it('computes standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes signature, IHDR, IDAT and IEND that decode back to the pixels', () => {
    const w = 3;
    const h = 2;
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    const png = encodePNG(w, h, rgba);
    expect(Array.from(png.slice(0, 8))).toEqual(Array.from(PNG_SIGNATURE));
    // IHDR
    expect(u32(png, 8)).toBe(13);
    expect(new TextDecoder().decode(png.slice(12, 16))).toBe('IHDR');
    expect([u32(png, 16), u32(png, 20), png[24], png[25], png[26], png[27], png[28]]).toEqual([w, h, 8, 6, 0, 0, 0]);
    expect(u32(png, 29)).toBe(crc32(png, 12, 29));
    // IDAT
    const idatLen = u32(png, 33);
    expect(new TextDecoder().decode(png.slice(37, 41))).toBe('IDAT');
    const raw = new Uint8Array(inflateSync(png.slice(41, 41 + idatLen)));
    expect(raw.length).toBe(h * (1 + w * 4));
    expect(Array.from(unfilter(raw, w, h))).toEqual(Array.from(rgba));
    expect(u32(png, 41 + idatLen)).toBe(crc32(png, 37, 41 + idatLen));
    // IEND
    expect(new TextDecoder().decode(png.slice(png.length - 8, png.length - 4))).toBe('IEND');
  });

  it('rejects bad input', () => {
    expect(() => encodePNG(0, 1, new Uint8Array(0))).toThrow();
    expect(() => encodePNG(2, 2, new Uint8Array(4))).toThrow();
  });
});
