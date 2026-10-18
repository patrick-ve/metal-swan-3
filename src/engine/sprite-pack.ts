import { PixelBuffer } from './pixel';
import type { Frame } from './render';

/**
 * Sprite packs (docs/ARCHITECTURE.md §5.4 "Sprite cache"): the generated frames of many sprite
 * ids as one gzip-compressed byte array, so a later visit installs them (`installFrames`) instead
 * of running the generators again. Pure: no DOM, no storage (the store is `ByteStore`); it only
 * needs the standard `CompressionStream` / `DecompressionStream` (browsers and Node).
 *
 * Layout before compression:
 * - 'MS3S' (4 bytes), format version (u32), byte-order mark (u32 0x01020304 as written), length
 *   of the metadata (u32);
 * - the metadata as UTF-8 JSON (`PackMeta`), zero-padded to a multiple of 4 bytes;
 * - the pixels of every buffer in `PackMeta.b` order, w × h packed Colors each (machine byte
 *   order; a pack from a machine with the other byte order is rejected).
 * Frames that share a buffer keep sharing it after decoding. Decoded buffers are views into one
 * ArrayBuffer (no copy per buffer).
 */

const MAGIC = 0x5333534d; // 'MS3S' read as a little-endian u32
const BOM = 0x01020304;
/** Bump when the layout changes: older packs are then rejected (a cache miss). */
export const SPRITE_PACK_VERSION = 1;
const HEADER_BYTES = 16;
/** The encoder hands the compressor chunks of this many bytes, and yields after each one. */
const CHUNK_BYTES = 1 << 18;

type Pts = NonNullable<Frame['pts']>;
/** One frame: [buffer index, ox, oy, density, points or 0]. */
type PackFrame = [number, number, number, number, Pts | 0];

interface PackMeta {
  /** Who made the pack (the cache compares it with the running build). */
  tag: string;
  /** Density of the frames (1, or 2 for 2× art): `installFrames(id, d, …)`. */
  d: number;
  /** [id, frames] per sprite. */
  s: Array<[string, PackFrame[]]>;
  /** [w, h] per buffer. */
  b: Array<[number, number]>;
}

export interface SpritePack {
  tag: string;
  density: number;
  sprites: Array<[string, Frame[]]>;
}

/** Bytes of all buffers, without the header (to estimate a pack before encoding it). */
function pixelBytes(bufs: readonly PixelBuffer[]): number {
  let n = 0;
  for (const b of bufs) n += b.data.byteLength;
  return n;
}

/**
 * Encode sprites as one gzip pack. `tag` identifies the build that made it; `density` is the
 * density of the frames (1 or 2). Feeds the compressor in 256 KB chunks and calls `yieldFn`
 * (default: a 0 ms timeout) after each one, so a large pack never blocks the main thread for long.
 */
export async function encodeSpritePack(
  tag: string,
  density: number,
  sprites: Iterable<readonly [string, readonly Frame[]]>,
  yieldFn: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<Uint8Array> {
  const index = new Map<PixelBuffer, number>();
  const bufs: PixelBuffer[] = [];
  const meta: PackMeta = { tag, d: density, s: [], b: [] };
  for (const [id, frames] of sprites) {
    const out: PackFrame[] = [];
    for (const f of frames) {
      let bi = index.get(f.buf);
      if (bi === undefined) {
        bi = bufs.length;
        index.set(f.buf, bi);
        bufs.push(f.buf);
        meta.b.push([f.buf.w, f.buf.h]);
      }
      out.push([bi, f.ox, f.oy, f.density ?? 1, f.pts ?? 0]);
    }
    meta.s.push([id, out]);
  }
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const pad = (4 - (json.length % 4)) % 4;
  const head = new Uint8Array(HEADER_BYTES + json.length + pad);
  const hv = new DataView(head.buffer);
  hv.setUint32(0, MAGIC, true);
  hv.setUint32(4, SPRITE_PACK_VERSION, true);
  new Uint32Array(head.buffer, 8, 1)[0] = BOM;
  hv.setUint32(12, json.length, true);
  head.set(json, HEADER_BYTES);

  const cs = new CompressionStream('gzip');
  const result = new Response(cs.readable).arrayBuffer();
  const writer = cs.writable.getWriter();
  await writer.write(head);
  let chunk = new Uint8Array(Math.min(CHUNK_BYTES, Math.max(4, pixelBytes(bufs))));
  let used = 0;
  const flush = async (): Promise<void> => {
    if (used === 0) return;
    await writer.write(chunk.subarray(0, used));
    chunk = new Uint8Array(chunk.length);
    used = 0;
    await yieldFn();
  };
  for (const b of bufs) {
    const bytes = new Uint8Array(b.data.buffer, b.data.byteOffset, b.data.byteLength);
    for (let at = 0; at < bytes.length; ) {
      const n = Math.min(bytes.length - at, chunk.length - used);
      chunk.set(bytes.subarray(at, at + n), used);
      used += n;
      at += n;
      if (used === chunk.length) await flush();
    }
  }
  await flush();
  await writer.close();
  return new Uint8Array(await result);
}

/**
 * Decode a pack made by `encodeSpritePack`. Throws on anything unexpected (not gzip, another
 * format version or byte order, sizes that do not add up): the caller treats that as a miss.
 */
export async function decodeSpritePack(gz: Uint8Array): Promise<SpritePack> {
  const stream = new Blob([gz as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw = await new Response(stream).arrayBuffer();
  if (raw.byteLength < HEADER_BYTES) throw new Error('sprite pack: too short');
  const hv = new DataView(raw);
  if (hv.getUint32(0, true) !== MAGIC) throw new Error('sprite pack: not a sprite pack');
  const version = hv.getUint32(4, true);
  if (version !== SPRITE_PACK_VERSION) throw new Error(`sprite pack: format ${version}, expected ${SPRITE_PACK_VERSION}`);
  if (new Uint32Array(raw, 8, 1)[0] !== BOM) throw new Error('sprite pack: other byte order');
  const jsonLen = hv.getUint32(12, true);
  if (HEADER_BYTES + jsonLen > raw.byteLength) throw new Error('sprite pack: metadata cut off');
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, HEADER_BYTES, jsonLen))) as PackMeta;
  if (typeof meta.tag !== 'string' || !Array.isArray(meta.s) || !Array.isArray(meta.b)) throw new Error('sprite pack: bad metadata');
  let at = HEADER_BYTES + jsonLen + ((4 - (jsonLen % 4)) % 4);
  const bufs: PixelBuffer[] = [];
  for (const [w, h] of meta.b) {
    const n = w * h;
    if (!(n >= 0) || at + n * 4 > raw.byteLength) throw new Error('sprite pack: pixels cut off');
    bufs.push(new PixelBuffer(w, h, new Uint32Array(raw, at, n)));
    at += n * 4;
  }
  if (at !== raw.byteLength) throw new Error('sprite pack: extra bytes');
  const sprites: Array<[string, Frame[]]> = meta.s.map(([id, frames]) => [
    id,
    frames.map(([bi, ox, oy, d, pts]) => {
      const buf = bufs[bi];
      if (!buf) throw new Error(`sprite pack: "${id}" names buffer ${bi}`);
      const f: { buf: PixelBuffer; ox: number; oy: number; pts?: Pts; density?: number } = { buf, ox, oy };
      if (pts) f.pts = pts;
      if (d !== 1) f.density = d;
      return f;
    }),
  ]);
  return { tag: meta.tag, density: meta.d, sprites };
}
