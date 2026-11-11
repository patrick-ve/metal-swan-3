/**
 * Big buildings (the museum, the city hall): a wall block with its lit and shaded end, a slate roof,
 * a cornice, corner stones. They are drawn on the caller's canvas, on the caller's part ids.
 */
import type { Pts, S } from './canvas';
import { R } from './palette';
import { rngf } from './rng';
import { brickHints } from './walls';

/** A block of wall with brick hints; the left two columns fall in shade, the right one is lit. Returns its mask. */
export function wallBlock(s: S, x: number, y: number, w: number, h: number, mat: string, part: number, z: number, seed: number): Uint8Array {
  const [hi, ba, sd] = R[mat];
  s.use(part, z);
  s.rect(ba, x, y, w, h);
  const k = new Uint8Array(s.w * s.h);
  for (let j = Math.max(y, 0); j < Math.min(y + h, s.h); j++) {
    for (let i = Math.max(x, 0); i < Math.min(x + w, s.w); i++) if (s.p[j * s.w + i] === part) k[j * s.w + i] = 1;
  }
  brickHints(s, k, mat, seed);
  const left = new Uint8Array(k);
  const right = new Uint8Array(k);
  for (let j = 0; j < s.h; j++) {
    for (let i = 0; i < s.w; i++) {
      if (i >= x + 2) left[j * s.w + i] = 0;
      if (i < x + w - 1) right[j * s.w + i] = 0;
    }
  }
  s.retone(left, [
    [ba, sd],
    [hi, ba],
  ]);
  s.retone(right, [
    [ba, hi],
    [sd, ba],
  ]);
  return k;
}

/** A slate roof over a polygon: slates in rows, lit on the right, a ridge line, the left end in shade. */
export function slateRoof(s: S, pts: Pts, seed: number, part: number, z: number, ridge = true): void {
  const [a, b, c, d] = R.roof;
  const r = rngf(seed);
  s.use(part, z);
  const k = s.poly(b, pts);
  const W = s.w;
  let y0 = Infinity;
  let y1 = -1;
  let x0 = Infinity;
  let x1 = -1;
  for (let i = 0; i < k.length; i++) {
    if (!k[i] || s.p[i] !== part) continue;
    const y = Math.floor(i / W);
    const x = i - y * W;
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  if (y1 < 0) return;
  for (let y = y0 + 2; y < y1; y += 3) {
    let x = x0 + (y % 2) * 3;
    while (x < x1) {
      const L = r.int(3, 7);
      for (let i = 0; i < L; i++) if (x + i < W && k[y * W + x + i]) s.c[y * W + x + i] = d;
      if (x > (x0 + x1) / 2 && y - 1 >= 0) {
        for (let i = 0; i < 2; i++) if (x + L + i + 1 < W && k[(y - 1) * W + x + L + i + 1]) s.c[(y - 1) * W + x + L + i + 1] = a;
      }
      x += L + r.int(2, 5);
    }
  }
  if (ridge) {
    for (let x = x0; x <= x1; x++) {
      for (let y = 0; y < s.h; y++) {
        if (k[y * W + x]) {
          s.c[y * W + x] = x > (x0 + x1) / 2 ? a : c;
          break;
        }
      }
    }
  }
  const shade = new Uint8Array(k);
  const limit = x0 + Math.floor((x1 - x0) / 5);
  for (let j = 0; j < s.h; j++) for (let i = limit; i < W; i++) shade[j * W + i] = 0;
  s.retone(shade, [
    [b, c],
    [a, b],
  ]);
}

/** A white cornice: three rows with dentils. */
export function cornice(s: S, x: number, y: number, w: number, part: number, z: number): void {
  const [t0, t1, t2, t3] = R.white;
  s.use(part, z);
  s.hl(t0, x, y, w);
  s.hl(t1, x, y + 1, w);
  s.hl(t3, x, y + 2, w);
  for (let i = x + 2; i < x + w - 1; i += 5) s.px(t2, i, y + 2);
}

/** Corner stones, long and short by turns, on the left or the right corner of a wall. */
export function quoins(s: S, x: number, y: number, h: number, w: number, part: number, z: number, right = false): void {
  const [t0, t1, , t3] = R.stone;
  s.use(part, z);
  let j = 0;
  for (let q = y; q < y + h; q += 4) {
    const L = j % 2 ? w : w - 2;
    const xx = right ? x + w - L : x;
    s.rect(t1, xx, q, L, 3);
    s.hl(t0, xx, q, L);
    s.hl(t3, xx, q + 3, L);
    if (right) s.vl(t0, xx + L - 1, q, 3);
    j++;
  }
}
