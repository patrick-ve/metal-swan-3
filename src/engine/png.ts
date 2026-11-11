/**
 * A small PNG decoder into `PixelBuffer` (docs/api/canal.md §4): the baked canal scenery of mission
 * `ams` (the only image files the game reads at run time) and the tests' reference frames. Pure
 * TypeScript: the same code runs in the browser's main thread, in a worker and in node.
 *
 * Reads non-interlaced 8-bit RGBA (colour type 6), 8-bit RGB (2) and palette images (3; bit depth
 * 1, 2, 4 or 8, with or without tRNS). Pixels come out exactly as stored: no colour management (gAMA,
 * iCCP, sRGB are ignored), no premultiplied alpha. Anything else throws.
 *
 * Inflating is the one part that differs by platform: `decodePng` uses the standard
 * `DecompressionStream('deflate')` (browsers, workers, node ≥ 18); `decodePngSync` takes a synchronous
 * inflate (node's `zlib.inflateSync`, injected by node tools and tests: src/ never imports node).
 */
import { PixelBuffer } from './pixel';

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

/** The parts of a PNG file before inflating. */
export interface PngParts {
  readonly w: number;
  readonly h: number;
  readonly bitDepth: number;
  readonly colorType: number;
  /** Palette entries as 0xRRGGBBAA (tRNS applied; entries without one are opaque); empty without PLTE. */
  readonly palette: Uint32Array;
  /** The zlib stream (every IDAT chunk's data, in order). */
  readonly data: Uint8Array;
}

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/** Split a PNG file into its header, palette and compressed data (no inflate). Throws on what it cannot read. */
export function parsePng(bytes: Uint8Array): PngParts {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) throw new Error('png: not a PNG file');
  let o = 8;
  let w = 0;
  let h = 0;
  let bitDepth = 0;
  let colorType = -1;
  let pal: Uint32Array = new Uint32Array(0);
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let total = 0;
  while (o + 8 <= bytes.length) {
    const len = u32(bytes, o);
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    const at = o + 8;
    if (at + len > bytes.length) throw new Error('png: truncated chunk ' + type);
    if (type === 'IHDR') {
      w = u32(bytes, at);
      h = u32(bytes, at + 4);
      bitDepth = bytes[at + 8];
      colorType = bytes[at + 9];
      if (bytes[at + 10] !== 0 || bytes[at + 11] !== 0) throw new Error('png: unknown compression or filter method');
      if (bytes[at + 12] !== 0) throw new Error('png: interlaced images are not supported');
    } else if (type === 'PLTE') {
      const n = Math.floor(len / 3);
      pal = new Uint32Array(n);
      for (let i = 0; i < n; i++) pal[i] = ((bytes[at + i * 3] << 24) | (bytes[at + i * 3 + 1] << 16) | (bytes[at + i * 3 + 2] << 8) | 255) >>> 0;
    } else if (type === 'tRNS') {
      trns = bytes.subarray(at, at + len);
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(at, at + len));
      total += len;
    } else if (type === 'IEND') {
      break;
    }
    o = at + len + 4;
  }
  if (w <= 0 || h <= 0) throw new Error('png: no IHDR');
  const ok = (colorType === 6 && bitDepth === 8) || (colorType === 2 && bitDepth === 8) || (colorType === 3 && (bitDepth === 1 || bitDepth === 2 || bitDepth === 4 || bitDepth === 8));
  if (!ok) throw new Error(`png: colour type ${colorType} at ${bitDepth} bits is not supported`);
  if (colorType === 3) {
    if (pal.length === 0) throw new Error('png: palette image without PLTE');
    if (trns) for (let i = 0; i < trns.length && i < pal.length; i++) pal[i] = ((pal[i] & 0xffffff00) | trns[i]) >>> 0;
  }
  const data = new Uint8Array(total);
  let p = 0;
  for (const c of idat) {
    data.set(c, p);
    p += c.length;
  }
  return { w, h, bitDepth, colorType, palette: pal, data };
}

/** Bytes per filter unit and per row (without the filter byte) of an image. */
function layout(p: PngParts): { bpp: number; stride: number } {
  if (p.colorType === 6) return { bpp: 4, stride: p.w * 4 };
  if (p.colorType === 2) return { bpp: 3, stride: p.w * 3 };
  return { bpp: 1, stride: Math.ceil((p.w * p.bitDepth) / 8) };
}

/**
 * Undo the row filters of the inflated data in place and write the pixels: rows `y0` ≤ y < `y1`
 * (a decode can run in slices; every row needs the one before it, so slices go in order).
 */
export function unfilterRows(p: PngParts, raw: Uint8Array, out: PixelBuffer, y0: number, y1: number): void {
  const { bpp, stride } = layout(p);
  const need = (stride + 1) * p.h;
  if (raw.length < need) throw new Error('png: image data too short');
  const px = out.data;
  const w = p.w;
  for (let y = y0; y < y1; y++) {
    const r = y * (stride + 1);
    const f = raw[r];
    const s = r + 1;
    const u = s - stride - 1; // the row above (its first byte)
    const up = y > 0;
    switch (f) {
      case 0:
        break;
      case 1:
        for (let i = bpp; i < stride; i++) raw[s + i] = (raw[s + i] + raw[s + i - bpp]) & 255;
        break;
      case 2:
        if (up) for (let i = 0; i < stride; i++) raw[s + i] = (raw[s + i] + raw[u + i]) & 255;
        break;
      case 3:
        for (let i = 0; i < stride; i++) {
          const a = i >= bpp ? raw[s + i - bpp] : 0;
          const b = up ? raw[u + i] : 0;
          raw[s + i] = (raw[s + i] + ((a + b) >> 1)) & 255;
        }
        break;
      case 4:
        for (let i = 0; i < stride; i++) {
          const a = i >= bpp ? raw[s + i - bpp] : 0;
          const b = up ? raw[u + i] : 0;
          const c = up && i >= bpp ? raw[u + i - bpp] : 0;
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          raw[s + i] = (raw[s + i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
        }
        break;
      default:
        throw new Error('png: bad filter type ' + f);
    }
    const o = y * w;
    if (p.colorType === 6) {
      for (let x = 0, i = s; x < w; x++, i += 4) {
        const a = raw[i + 3];
        px[o + x] = a === 0 ? 0 : ((raw[i] << 24) | (raw[i + 1] << 16) | (raw[i + 2] << 8) | a) >>> 0;
      }
    } else if (p.colorType === 2) {
      for (let x = 0, i = s; x < w; x++, i += 3) px[o + x] = ((raw[i] << 24) | (raw[i + 1] << 16) | (raw[i + 2] << 8) | 255) >>> 0;
    } else {
      const pal = p.palette;
      const n = pal.length;
      const d = p.bitDepth;
      if (d === 8) {
        for (let x = 0; x < w; x++) {
          const k = raw[s + x];
          const c = k < n ? pal[k] : 0;
          px[o + x] = (c & 255) === 0 ? 0 : c;
        }
      } else {
        const per = 8 / d;
        const mask = (1 << d) - 1;
        for (let x = 0; x < w; x++) {
          const k = (raw[s + Math.floor(x / per)] >> (8 - d * ((x % per) + 1))) & mask;
          const c = k < n ? pal[k] : 0;
          px[o + x] = (c & 255) === 0 ? 0 : c;
        }
      }
    }
  }
}

/** Inflate a zlib stream with the standard DecompressionStream (browsers, workers, node ≥ 18). */
export async function inflateStream(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decode a PNG file (async inflate; the row filters run at once). */
export async function decodePng(bytes: Uint8Array, inflate: (data: Uint8Array) => Promise<Uint8Array> = inflateStream): Promise<PixelBuffer> {
  const p = parsePng(bytes);
  const raw = await inflate(p.data);
  const out = new PixelBuffer(p.w, p.h);
  unfilterRows(p, raw, out, 0, p.h);
  return out.touch();
}

/** Decode a PNG file with a synchronous inflate (node: `zlib.inflateSync`). */
export function decodePngSync(bytes: Uint8Array, inflateSync: (data: Uint8Array) => Uint8Array): PixelBuffer {
  const p = parsePng(bytes);
  const raw = inflateSync(p.data);
  const out = new PixelBuffer(p.w, p.h);
  unfilterRows(p, raw, out, 0, p.h);
  return out.touch();
}
