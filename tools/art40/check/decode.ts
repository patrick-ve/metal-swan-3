/**
 * Decode and encode the baked pixel stream (format v2, tools/art40/README.md "Pixel stream"):
 * pairs of characters over a 91-character alphabet ('#'..'~' without the backslash, value =
 * position): (run length - 1, palette index), row-major over w × h. The check needs palette
 * indices (outline, orphans), so it decodes the stream itself, independently of the engine loader
 * (src/engine/baked.ts); a test proves both give the same indices.
 */

const ALPHABET = (() => {
  let s = '';
  for (let c = 0x23; c <= 0x7e; c++) if (c !== 0x5c) s += String.fromCharCode(c);
  return s;
})();
const VALUE = new Map<string, number>([...ALPHABET].map((ch, i) => [ch, i]));
/** The longest run of one pair and the most palette entries (index 0..90). */
export const MAX_RUN = ALPHABET.length;
export const MAX_PALETTE = ALPHABET.length;

/** Palette indices of a frame (w × h, row-major). Throws when the stream is malformed. */
export function decodeIndices(px: string, w: number, h: number): Uint8Array {
  if (px.length % 2) throw new Error(`odd stream length ${px.length}`);
  const out = new Uint8Array(w * h);
  let p = 0;
  for (let i = 0; i < px.length; i += 2) {
    const r = VALUE.get(px[i]);
    const v = VALUE.get(px[i + 1]);
    if (r === undefined || v === undefined) throw new Error(`character outside the alphabet at ${r === undefined ? i : i + 1}`);
    const run = r + 1;
    if (p + run > out.length) throw new Error(`stream overruns ${w}x${h} at character ${i}`);
    out.fill(v, p, p + run);
    p += run;
  }
  if (p !== out.length) throw new Error(`stream covers ${p} of ${out.length} pixels`);
  return out;
}

/** Encode palette indices (the bake's format; used by tests, the old-frame tools and the review page). */
export function encodeIndices(idx: ArrayLike<number>): string {
  let s = '';
  let i = 0;
  while (i < idx.length) {
    const v = idx[i];
    if (!(Number.isInteger(v) && v >= 0 && v < MAX_PALETTE)) throw new Error(`palette index ${v} outside 0..${MAX_PALETTE - 1}`);
    let run = 1;
    while (i + run < idx.length && idx[i + run] === v && run < MAX_RUN) run++;
    s += ALPHABET[run - 1] + ALPHABET[v];
    i += run;
  }
  return s;
}
