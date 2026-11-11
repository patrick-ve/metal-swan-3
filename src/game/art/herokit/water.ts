/** Water: flat hard shapes, reflections in blocks of 2 or 3 tones, no alpha. */
import { S } from './canvas';
import { R } from './palette';
import { rngf } from './rng';

/** What stands on the bank, for its reflection: RGBA rows (alpha 0 = nothing). */
export interface BankImage {
  readonly w: number;
  readonly h: number;
  /** Packed 0xRRGGBBAA. */
  readonly data: Uint32Array;
}

/** How many crest dashes sit still: one in this many moves a little in a later frame. */
const DASH_MOVES = 5;
/** One in this many pairs of rows wobbles its reflection in a later frame. */
const ROW_WOBBLES = 7;

/**
 * The water from row y0 to y1 on a canvas of W × y1. `src` is the bank above; it reflects in blocks
 * of 2 or 3 tones. The band tiles: a stroke that passes W runs on from x 0. Frame 0 is the picture;
 * a later frame moves a few crest dashes and wobbles the reflection in a few rows, so most of the
 * water stays as it is from frame to frame.
 */
export function waterBand(W: number, y0: number, y1: number, src: BankImage | null, seed: number, frame = 0): S {
  const [w0, w1, w2, w3, w4] = R.water;
  const [, , a2, a3] = R.waterw;
  const s = new S(W, y1);
  s.wrap = true;
  const H = y1 - y0;
  s.rect(w2, 0, y0, W, H);
  const r = rngf(seed);
  const jit = new Int32Array(32);
  for (let i = 0; i < 32; i++) jit[i] = r.int(-2, 3);
  const wob = new Uint8Array(32 * 3);
  for (let i = 0; i < wob.length; i++) wob[i] = r.int(0, ROW_WOBBLES);
  for (let j = 0; j < H; j++) {
    const y = y0 + j;
    const d = j / Math.max(H, 1);
    const sy = Math.trunc(y0 - 1 - j * 1.25);
    let shift = 0;
    let useRow = false;
    if (src !== null && sy >= 0 && d < 0.92) {
      const amp = 1 + Math.trunc(d * 5);
      const pair = Math.floor(j / 2) % 32;
      shift = jit[pair] * amp;
      if (frame % 3 !== 0 && wob[pair + (frame % 3) * 32 - 32] === 0) shift += (jit[(pair + frame) % 32] >= 0 ? 1 : -1) * amp;
      useRow = true;
    }
    const rx = rngf(seed + j * 97);
    // Each row starts its strokes elsewhere, so no column is a break in every row.
    const start = rx.int(0, 16);
    const stop = start + W;
    let x = start;
    while (x < stop) {
      const L = Math.min(rx.int(4, 11 + Math.trunc(d * 20)), stop - x);
      let c = d > 0.12 ? w2 : w3;
      if (useRow && src) {
        const at = x + (L >> 1);
        const q = src.data[sy * src.w + (((at - shift) % src.w) + src.w) % src.w];
        const qa = q & 255;
        const qr = q >>> 24;
        const qg = (q >>> 16) & 255;
        const qb = (q >>> 8) & 255;
        const lum = (0.3 * qr + 0.59 * qg + 0.11 * qb) / 255;
        const warm = qr - qb > 28;
        if (qa === 0) c = w2;
        else if (warm) c = d < 0.5 ? (lum > 0.5 ? a2 : a3) : lum > 0.5 ? a3 : w3;
        else c = lum > 0.72 ? w1 : lum > 0.42 ? w2 : w3;
      }
      for (let i = 0; i < L; i++) {
        const at = y * W + (x + i) % W;
        s.c[at] = c;
        s.z[at] = 0;
        s.p[at] = 1;
      }
      x += L;
    }
  }
  // Crests and troughs: dashes that stay, and a few that move on in a later frame.
  const r2 = rngf(seed + 1000);
  const cnt = Math.trunc((W * H) / 130);
  for (let q = 0; q < cnt; q++) {
    const y = Math.trunc(y0 + r2.random() ** 0.8 * H);
    const d = (y - y0) / Math.max(H, 1);
    let x = r2.int(0, W);
    const L = r2.int(2, 6 + Math.trunc(d * 12));
    const t = r2.random();
    const f = frame % 3;
    if (f !== 0 && q % DASH_MOVES === f - 1) x += q % 2 === 0 ? 2 : -2;
    const c = t < 0.16 ? w0 : t < 0.55 ? w1 : w3;
    for (let i = 0; i < L; i++) s.c[y * W + (((x + i) % W) + W) % W] = c;
    if (c === w0 && L >= 3 && y + 1 < y1) {
      for (let i = 1; i < L - 1; i++) s.c[(y + 1) * W + (((x + i) % W) + W) % W] = w1;
    }
  }
  // The shadow of the bank.
  for (let i = 0; i < W; i++) {
    s.c[y0 * W + i] = w4;
    if (s.c[(y0 + 1) * W + i] === w2) s.c[(y0 + 1) * W + i] = w3;
  }
  return s;
}
