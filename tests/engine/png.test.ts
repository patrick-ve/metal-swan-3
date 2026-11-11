/**
 * The PNG decoder (src/engine/png.ts, docs/api/canal.md §4): 8-bit RGBA, 8-bit RGB and palette images
 * (1, 2, 4 and 8 bits, with tRNS), every row filter, both inflate paths (DecompressionStream and a
 * synchronous one) — pixels exactly as stored (no premultiply, no colour management) — and the baked
 * canal files decode the same both ways.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, decodePngSync, parsePng } from '../../src/engine/png';

const inflate = (d: Uint8Array): Uint8Array => new Uint8Array(inflateSync(d));

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Encode raw rows (bytes per row `stride`) with filter (y % 5) on row y: every filter type is used. */
function encode(w: number, h: number, depth: number, type: number, rows: Uint8Array[], bpp: number, plte?: Uint8Array, trns?: Uint8Array): Uint8Array {
  const stride = rows[0].length;
  const raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const f = y % 5;
    raw[y * (stride + 1)] = f;
    const cur = rows[y];
    const up = y > 0 ? rows[y - 1] : new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = up[i];
      const c = i >= bpp ? up[i - bpp] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      raw[y * (stride + 1) + 1 + i] = (cur[i] - pred) & 255;
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = depth;
  ihdr[9] = type;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (plte) parts.push(chunk('PLTE', plte));
  if (trns) parts.push(chunk('tRNS', trns));
  const z = new Uint8Array(deflateSync(raw));
  // Two IDAT chunks: the decoder joins them.
  const cut = z.length >> 1;
  parts.push(chunk('IDAT', z.subarray(0, cut)), chunk('IDAT', z.subarray(cut)), chunk('IEND', new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const W = 13;
const H = 11;
/** A pseudo-random byte for (x, y, k). */
const rnd = (x: number, y: number, k: number): number => (((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 3) & 255;

describe('png decoder', () => {
  it('8-bit RGBA: every filter, alpha kept as stored (no premultiply), transparent pixels read as 0', async () => {
    const rows: Uint8Array[] = [];
    const want: number[] = [];
    for (let y = 0; y < H; y++) {
      const r = new Uint8Array(W * 4);
      for (let x = 0; x < W; x++) {
        const a = (x + y) % 4 === 0 ? 0 : (x + y) % 4 === 1 ? 255 : rnd(x, y, 9);
        r.set([rnd(x, y, 0), rnd(x, y, 1), rnd(x, y, 2), a], x * 4);
        want.push(a === 0 ? 0 : ((rnd(x, y, 0) << 24) | (rnd(x, y, 1) << 16) | (rnd(x, y, 2) << 8) | a) >>> 0);
      }
      rows.push(r);
    }
    const png = encode(W, H, 8, 6, rows, 4);
    const a = decodePngSync(png, inflate);
    const b = await decodePng(png);
    expect([a.w, a.h]).toEqual([W, H]);
    expect([...a.data]).toEqual(want);
    expect([...b.data]).toEqual(want);
  });

  it('8-bit RGB: opaque, every filter', () => {
    const rows: Uint8Array[] = [];
    const want: number[] = [];
    for (let y = 0; y < H; y++) {
      const r = new Uint8Array(W * 3);
      for (let x = 0; x < W; x++) {
        r.set([rnd(x, y, 3), rnd(x, y, 4), rnd(x, y, 5)], x * 3);
        want.push(((rnd(x, y, 3) << 24) | (rnd(x, y, 4) << 16) | (rnd(x, y, 5) << 8) | 255) >>> 0);
      }
      rows.push(r);
    }
    expect([...decodePngSync(encode(W, H, 8, 2, rows, 3), inflate).data]).toEqual(want);
  });

  for (const depth of [1, 2, 4, 8]) {
    it(`palette at ${depth} bits with tRNS (short: later entries opaque)`, async () => {
      const n = 1 << depth;
      const plte = new Uint8Array(n * 3);
      for (let i = 0; i < n * 3; i++) plte[i] = rnd(i, depth, 7);
      // Entry 0 transparent, entry 1 half transparent; the rest opaque (tRNS shorter than PLTE).
      const trns = n > 2 ? new Uint8Array([0, 128]) : new Uint8Array([0]);
      const per = 8 / depth;
      const rows: Uint8Array[] = [];
      const want: number[] = [];
      for (let y = 0; y < H; y++) {
        const r = new Uint8Array(Math.ceil(W / per));
        for (let x = 0; x < W; x++) {
          const k = rnd(x, y, 11) % n;
          r[Math.floor(x / per)] |= k << (8 - depth * ((x % per) + 1));
          const al = k < trns.length ? trns[k] : 255;
          want.push(al === 0 ? 0 : ((plte[k * 3] << 24) | (plte[k * 3 + 1] << 16) | (plte[k * 3 + 2] << 8) | al) >>> 0);
        }
        rows.push(r);
      }
      const png = encode(W, H, depth, 3, rows, 1, plte, trns);
      expect([...decodePngSync(png, inflate).data]).toEqual(want);
      expect([...(await decodePng(png)).data]).toEqual(want);
    });
  }

  it('refuses what it cannot read (interlaced, 16-bit, not a PNG)', () => {
    const rows = [new Uint8Array(4)];
    const png = encode(1, 1, 8, 6, rows, 4);
    const inter = png.slice();
    inter[8 + 8 + 12] = 1; // IHDR interlace byte
    expect(() => parsePng(inter)).toThrow(/interlaced/);
    const deep = png.slice();
    deep[8 + 8 + 8] = 16; // IHDR bit depth
    expect(() => parsePng(deep)).toThrow(/not supported/);
    expect(() => parsePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/not a PNG/);
  });

  it('the baked canal files decode the same with both inflates, alpha 0 or 255 only', async () => {
    const dir = join(__dirname, '..', '..', 'public', 'art', 'ams');
    const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
    expect(files.length).toBeGreaterThan(0);
    let palette = 0;
    for (const f of files.filter((n) => n.includes('-u1-'))) {
      const bytes = new Uint8Array(readFileSync(join(dir, f)));
      if (parsePng(bytes).colorType === 3) palette++;
      const a = decodePngSync(bytes, inflate);
      const b = await decodePng(bytes);
      expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(true);
      let mid = 0;
      for (const p of a.data) if ((p & 255) !== 0 && (p & 255) !== 255) mid++;
      expect(mid).toBe(0);
    }
    expect(palette).toBeGreaterThan(0);
  });
});
