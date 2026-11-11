/**
 * Floors: hard clusters, dark joints. Kerbstones are the only ground a post may stand on
 * (`checkPostFoot`, docs/design/ams2.md §0 decision 7).
 */
import { S } from './canvas';
import { range } from './canvas-math';
import { R } from './palette';
import { rngf } from './rng';

/** Paving rows from y0 to y1, row height a at the world's far edge to b at its near edge. */
export function rows(y0: number, y1: number, a: number, b: number, world: readonly [number, number] = [146, 216]): Array<readonly [number, number]> {
  let y = y0;
  const out: Array<readonly [number, number]> = [];
  while (y < y1) {
    const t = (y - world[0]) / (world[1] - world[0]);
    let h = Math.round(a + (b - a) * t);
    // Python's round: half to even on the rare exact half.
    const raw = a + (b - a) * t;
    if (raw - Math.floor(raw) === 0.5) h = Math.floor(raw) % 2 === 0 ? Math.floor(raw) : Math.floor(raw) + 1;
    h = Math.min(h, y1 - y);
    out.push([y, h]);
    y += h;
  }
  return out;
}

/** Loaf-shaped setts, each one a little sprite: a dark joint, a lit top right, a shaded foot. */
export function cobbles(s: S, y0: number, y1: number, seed: number): void {
  const r = rngf(seed);
  const [a, b, c, d] = R.cobble;
  s.use(1, 0);
  s.rect(d, 0, y0, s.w, y1 - y0);
  for (const [y, h] of rows(y0, y1, 4, 7)) {
    const sw = Math.trunc(h * 1.9);
    let x = -r.int(0, sw);
    while (x < s.w) {
      const w = sw + r.int(-1, 3);
      const t = r.random();
      const ba = t < 0.72 ? b : t < 0.9 ? c : a;
      const lo = ba !== c ? c : d;
      const hi = ba !== a ? a : R.pave[0];
      s.rect(ba, x + 1, y, w - 2, h - 1);
      s.hl(lo, x + 1, y + h - 2, w - 2); // the foot
      s.hl(hi, x + 1 + Math.trunc(w * 0.45), y, Math.max(1, w - 2 - Math.trunc(w * 0.45))); // the top catches the sun on the right
      s.px(d, x + 1, y);
      s.px(d, x + 1, y + h - 2);
      s.px(d, x + w - 2, y + h - 2);
      x += w;
    }
  }
}

export function pavers(s: S, y0: number, y1: number, seed: number, a = 3, b = 5, wfac = 3.0, mat = 'pave', bond = 0.5): void {
  const r = rngf(seed);
  const [c0, c1, c2, c3] = R[mat];
  s.use(1, 0);
  s.rect(c2, 0, y0, s.w, y1 - y0);
  rows(y0, y1, a, b).forEach(([y, h], n) => {
    const sw = Math.trunc(h * wfac);
    let x = -Math.trunc((n % 2) * sw * bond) - r.int(0, 2);
    while (x < s.w) {
      const t = r.random();
      const ba = t < 0.84 ? c1 : t < 0.91 ? c0 : c2;
      s.rect(ba, x, y, sw - 1, h - 1);
      if (ba === c1 && r.random() < 0.4) s.hl(c0, x + Math.trunc(sw * 0.45), y, sw - 1 - Math.trunc(sw * 0.45));
      s.vl(c3, x + sw - 1, y, h);
      s.hl(r.random() < 0.5 ? c3 : c2, x, y + h - 1, sw);
      x += sw;
    }
  });
}

/** Kerbstones: a bright top, a dark face, dark joints. The only ground a post may stand on. */
export function kerb(s: S, y: number, h: number, seed = 1): void {
  const [a, b, c, d] = R.kerb;
  const r = rngf(seed);
  const top = Math.max(1, h >> 1);
  s.use(1, 0);
  s.rect(a, 0, y, s.w, top);
  s.rect(c, 0, y + top, s.w, h - top);
  s.hl(d, 0, y + h - 1, s.w);
  let x = 0;
  while (x < s.w) {
    const w = r.int(22, 36);
    s.vl(d, x, y, h);
    s.hl(b, x + 1, y + top - 1, Math.trunc(w * 0.4));
    x += w;
  }
}

export function lane(s: S, y0: number, y1: number, seed: number): void {
  const [a, b, c, d] = R.lane;
  const r = rngf(seed);
  s.use(1, 0);
  s.rect(b, 0, y0, s.w, y1 - y0);
  s.hl(d, 0, y0, s.w);
  s.hl(c, 0, y0 + 1, s.w);
  const n = Math.trunc((s.w * (y1 - y0)) / 60);
  for (let q = 0; q < n; q++) {
    const x = r.int(0, s.w);
    const y = r.int(y0 + 2, y1);
    const L = r.int(2, 7);
    const t = r.random();
    s.hl(t < 0.38 ? a : c, x, y, L);
    if (t >= 0.38 && y + 1 < y1) s.hl(c, x + 1, y + 1, Math.max(1, L - 2));
  }
  const my = ((y0 + y1) >> 1) - 1;
  const [p0, p1, p2] = R.paint;
  for (const x of range(0, s.w, 32)) {
    s.rect(p0, x, my, 16, 2);
    s.hl(p2, x, my + 2, 16);
    s.vl(p1, x, my, 2);
  }
}

export function gravel(s: S, y0: number, y1: number, seed: number): void {
  const [a, b, c, d] = R.gravel;
  const r = rngf(seed);
  s.use(1, 0);
  s.rect(b, 0, y0, s.w, y1 - y0);
  const n = Math.trunc((s.w * (y1 - y0)) / 9);
  for (let q = 0; q < n; q++) {
    const x = r.int(0, s.w);
    const y = r.int(y0, y1);
    const L = r.int(2, 5);
    const t = r.random();
    s.hl(t < 0.36 ? a : c, x, y, L);
    if (t > 0.86 && y + 1 < y1) s.hl(d, x, y + 1, Math.max(1, L - 1));
  }
}

export function grass(s: S, y0: number, y1: number, seed: number): void {
  const [a, b, c, d] = R.grass;
  const r = rngf(seed);
  s.use(1, 0);
  s.rect(b, 0, y0, s.w, y1 - y0);
  const n = Math.trunc((s.w * (y1 - y0)) / 10);
  for (let k = 0; k < n; k++) {
    const x = r.int(0, s.w);
    const y = r.int(y0, y1 - 1);
    const t = r.random();
    const q = t < 0.3 ? a : t < 0.85 ? c : d;
    s.vl(q, x, y, r.int(2, 4));
    s.px(q, x + 1, y + 1);
  }
}

/** An iron cover in the road with three crosses, seen from a low angle. */
export function manhole(s: S, x: number, y: number, w = 20): void {
  const [a, b, c, d] = R.iron;
  s.use(30, 0.5);
  const hh = 3;
  s.ell(R.kerb[1], x, y, w / 2 + 1, hh + 1);
  s.ell(c, x, y, w / 2, hh);
  s.hl(d, x - (w >> 1) + 3, y + hh - 1, w - 6);
  s.hl(b, x - (w >> 1) + 4, y - hh + 1, w - 8);
  for (const q of [-5, 0, 5]) {
    s.px(a, x + q - 1, y - 1);
    s.px(a, x + q + 1, y - 1);
    s.px(a, x + q, y);
    s.px(a, x + q - 1, y + 1);
    s.px(a, x + q + 1, y + 1);
  }
}

export function drain(s: S, x: number, y: number): void {
  s.use(31, 0.5);
  s.rect(R.hull[3], x, y, 9, 2);
  for (let q = x + 1; q < x + 9; q += 2) s.vl(R.pole[2], q, y, 2);
}

/** Fallen leaves and petals, little hard clusters that stay inside one floor band. */
export function leaves(s: S, y0: number, y1: number, seed: number, n: number): void {
  const r = rngf(seed);
  s.use(32, 0.4);
  for (let q = 0; q < n; q++) {
    const x = r.int(0, s.w);
    const y = r.int(y0, y1 - 1);
    const c = R[r.pick(['bricko', 'leaf', 'yellow', 'bricko'])];
    s.hl(c[1], x, y, 2);
    s.px(c[0], x + 1, y);
    s.px(c.length > 2 ? c[2] : c[1], x, y + 1);
  }
}

/** A post stands on a kerbstone and on nothing else. */
export class PostOnWrongGround extends Error {
  constructor(where: string) {
    super(`${where}: the ground is not a kerbstone`);
    this.name = 'PostOnWrongGround';
  }
}

/**
 * The post rule: both foot columns of a post (x + 1, x + spriteW − 2 on `floor`, row `foot`) must be
 * kerbstone ids. Columns outside the canvas are not checked: the band tile ends there.
 */
export function checkPostFoot(floor: S, x: number, spriteW: number, foot: number, where: string): void {
  const ok = R.kerb;
  for (const fx of [x + 1, x + spriteW - 2]) {
    if (fx < 0 || fx >= floor.w) continue;
    if (foot < 0 || foot >= floor.h || !ok.includes(floor.c[foot * floor.w + fx])) throw new PostOnWrongGround(`${where} x=${x} y=${foot}`);
  }
}
