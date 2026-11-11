/**
 * The finer pixel (docs/design/ams2.md §1.3): from an approved 1× drawing in palette ids to 2× and 4×.
 *
 * 1. EPX per object (twice for 4×): rounded diagonals, no new colours, outlines stay crisp.
 * 2. Longer ramps: 1 new tone between two tones at 2×, 2 new tones at 4×. A hard band of the new tone
 *    on the shaded side of a tone step inside one ramp. Linework stays as it is.
 * 3. Detail by material, in whole tones, never a gradient or dither: bricks and mortar in patches,
 *    slates, grain, bark, flecks, single leaf stamps, glazing bars (a mark per window), water strokes.
 *
 * Real game sprites never pass through this: they scale by a whole number (`repeatBuffer`).
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { type Mark, S } from './canvas';
import { pyRound } from './canvas-math';
import { COL, gradeColour, hexrgb, K, KM, LIGHTS, type LightName, R } from './palette';
import { rngf } from './rng';

/** The long ramps of one tier: the base ids plus the new tones. */
export interface LongRamps {
  readonly u: 2 | 4;
  /** New tones between two tones of a ramp (1 at 2×, 2 at 4×). */
  readonly mid: number;
  /** Distance between two original tones on the long ramp. */
  readonly step: number;
  /** Colours by id (base ids, then the new tones). */
  readonly cols: readonly string[];
  readonly names: readonly string[];
  readonly ridx: Int16Array;
  readonly pos: Int16Array;
  /** Long-ramp ids: ext[ramp index * max + position]. */
  readonly ext: Int16Array;
  readonly max: number;
  readonly len: Int16Array;
  readonly byName: Readonly<Record<string, readonly number[]>>;
}

function mixHex(a: string, b: string, f: number): string {
  const x = hexrgb(a);
  const y = hexrgb(b);
  // The new tones lean a little warmer on the light side, so the longer ramps stay hue-shifted.
  const m = [x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f, x[2] + (y[2] - x[2]) * f];
  const w = 3 * (1 - f);
  const out = [Math.min(255, Math.trunc(m[0] + w)), Math.trunc(m[1]), Math.max(0, Math.trunc(m[2] - w * 0.7))];
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const longCache = new Map<number, { base: number; lr: LongRamps }>();

/** The long ramps at tier 2 or 4 (rebuilt when a ramp was added). */
export function longRamps(u: 2 | 4): LongRamps {
  const c = longCache.get(u);
  if (c && c.base === COL.length) return c.lr;
  const mid = u >= 4 ? 2 : 1;
  const cols: string[] = COL.map((h) => h ?? '#000000');
  const names = Object.keys(R);
  const byName: Record<string, number[]> = {};
  for (const n of names) {
    const ids = R[n];
    const ext: number[] = [];
    ids.forEach((id, i) => {
      ext.push(id);
      if (i < ids.length - 1) {
        for (let q = 1; q <= mid; q++) {
          cols.push(mixHex(COL[id] as string, COL[ids[i + 1]] as string, q / (mid + 1)));
          ext.push(cols.length - 1);
        }
      }
    });
    byName[n] = ext;
  }
  const ridx = new Int16Array(cols.length).fill(-1);
  const pos = new Int16Array(cols.length);
  const max = Math.max(...names.map((n) => byName[n].length));
  const ext = new Int16Array(names.length * max);
  const len = new Int16Array(names.length);
  names.forEach((n, ri) => {
    len[ri] = byName[n].length;
    byName[n].forEach((id, p) => {
      ridx[id] = ri;
      pos[id] = p;
      ext[ri * max + p] = id;
    });
  });
  const lr: LongRamps = { u, mid, step: mid + 1, cols, names, ridx, pos, ext, max, len, byName };
  longCache.set(u, { base: COL.length, lr });
  return lr;
}

/** One pass of EPX: each pixel becomes 2 × 2 with rounded diagonals and no new colours. `wrap`: the sides meet. */
export function epx(c: Int16Array, w: number, h: number, wrap = false): Int16Array {
  const o = new Int16Array(w * 2 * h * 2);
  const W2 = w * 2;
  for (let y = 0; y < h; y++) {
    const up = y > 0 ? y - 1 : 0;
    const dn = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const v = c[y * w + x];
      const A = c[up * w + x];
      const D = c[dn * w + x];
      const L = c[y * w + (x > 0 ? x - 1 : wrap ? w - 1 : 0)];
      const B = c[y * w + (x < w - 1 ? x + 1 : wrap ? 0 : w - 1)];
      const o0 = y * 2 * W2 + x * 2;
      o[o0] = L === A && L !== D && A !== B ? L : v;
      o[o0 + 1] = A === B && A !== L && B !== D ? A : v;
      o[o0 + W2] = D === L && D !== B && L !== A ? D : v;
      o[o0 + W2 + 1] = B === D && B !== A && D !== L ? B : v;
    }
  }
  return o;
}

/** Stretched value noise: cx, cy = feature size along x and y. `wrap`: column w − 1 runs on into column 0. */
export function noise(w: number, h: number, cx: number, cy: number, seed: number, wrap = false): Float64Array {
  const r = rngf(seed);
  const gh = Math.trunc(h / cy) + 3;
  const cells = Math.max(1, Math.round(w / cx));
  if (wrap) cx = w / cells;
  const gw = wrap ? cells + 1 : Math.trunc(w / cx) + 3;
  const g = new Float64Array(gh * gw);
  for (let i = 0; i < g.length; i++) g[i] = r.random();
  if (wrap) for (let y = 0; y < gh; y++) g[y * gw + cells] = g[y * gw];
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const ys = y / cy;
    const y0 = Math.trunc(ys);
    const fy = ys - y0;
    for (let x = 0; x < w; x++) {
      const xs = x / cx;
      const x0 = Math.trunc(xs);
      const fx = xs - x0;
      const a = g[y0 * gw + x0];
      const b = g[y0 * gw + x0 + 1];
      const cc = g[(y0 + 1) * gw + x0];
      const d = g[(y0 + 1) * gw + x0 + 1];
      out[y * w + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
    }
  }
  return out;
}

function interband(c: Int16Array, w: number, h: number, lr: LongRamps, gap?: number, to?: number, wrap = false): Int16Array {
  const g = gap ?? lr.step;
  const t = to ?? g - 1;
  const { ridx, pos, ext, max } = lr;
  const out = c.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = c[i];
      const ri = ridx[v];
      if (ri < 0) continue;
      // The light comes from the top and the right.
      let hit = false;
      if (y < h - 1) {
        const nb = c[y > 0 ? i - w : (h - 1) * w + x];
        if (ridx[nb] === ri && pos[v] - pos[nb] === g) hit = true;
      }
      if (!hit && (wrap || x < w - 1)) {
        const nb = c[x < w - 1 ? i + 1 : i + 1 - w];
        if (ridx[nb] === ri && pos[v] - pos[nb] === g) hit = true;
      }
      if (hit) out[i] = ext[ri * max + pos[v] - t];
    }
  }
  return out;
}

/** The ramp indexes of the names, as a lookup by ramp index. */
function rampSet(lr: LongRamps, names: readonly string[]): Uint8Array {
  const t = new Uint8Array(lr.names.length);
  for (const n of names) {
    const i = lr.names.indexOf(n);
    if (i >= 0) t[i] = 1;
  }
  return t;
}

function prefixSet(lr: LongRamps, pre: string): Uint8Array {
  const t = new Uint8Array(lr.names.length);
  lr.names.forEach((n, i) => {
    if (n.startsWith(pre)) t[i] = 1;
  });
  return t;
}

/** The pixels on these ramps: a list of indexes, or null when there are none. */
function pixelsOf(c: Int16Array, lr: LongRamps, set: Uint8Array): Int32Array | null {
  const { ridx } = lr;
  let n = 0;
  for (let i = 0; i < c.length; i++) {
    const r = ridx[c[i]];
    if (r >= 0 && set[r]) n++;
  }
  if (n === 0) return null;
  const out = new Int32Array(n);
  n = 0;
  for (let i = 0; i < c.length; i++) {
    const r = ridx[c[i]];
    if (r >= 0 && set[r]) out[n++] = i;
  }
  return out;
}

/** The detail by material (hi.py `detail`). `seed` picks the pattern; whole tones only. */
function detail(c: Int16Array, w: number, h: number, seed: number, marks: readonly Mark[], lr: LongRamps, wrap = false): void {
  const U = lr.u;
  const TONE = lr.mid;
  const { ridx, pos, ext, max, len, step: STEP, mid: MID } = lr;
  const r = rngf(seed);
  const move = (i: number, d: number): void => {
    const v = c[i];
    const ri = ridx[v];
    let q = pos[v] + d * TONE;
    if (q < 0) q = 0;
    const top = len[ri] - 1;
    if (q > top) q = top;
    c[i] = ext[ri * max + q];
  };

  // ---- bricks: courses and single bricks, in patches so the wall stays calm between them
  let m = pixelsOf(c, lr, prefixSet(lr, 'brick'));
  if (m) {
    const ch = Math.max(3, pyRound(1.5 * U));
    const bl = Math.max(6, pyRound(4 * U));
    const J = new Float64Array(65536);
    for (let i = 0; i < 65536; i++) J[i] = r.random();
    const patch = noise(w, h, 9 * U, 7 * U, seed + 1);
    for (let n = 0; n < m.length; n++) {
      const i = m[n];
      const y = Math.floor(i / w);
      const x = i - y * w;
      const row = Math.floor(y / ch);
      const off = (row % 2) * Math.floor(bl / 2);
      const col = Math.floor((x + off) / bl);
      const j = J[(row % 256) * 256 + (col % 256)];
      let d = j < 0.13 ? 1 : j > 0.9 ? -1 : 0;
      const joint = y % ch === ch - 1 || (x + off) % bl === 0;
      const inPatch = patch[i] > 0.4;
      d = joint && inPatch ? 2 : d * (U >= 2 ? 1 : 0);
      if (joint && !inPatch && j > 0.7) d = 1;
      move(i, d);
    }
  }
  // ---- plaster: a few trowel marks
  m = pixelsOf(c, lr, prefixSet(lr, 'plast'));
  if (m) {
    const n1 = noise(w, h, 5 * U, 2 * U, seed + 2);
    const f = noise(w, h, U, U, seed + 3);
    for (let n = 0; n < m.length; n++) if (n1[m[n]] > 0.74) move(m[n], 1);
    for (let n = 0; n < m.length; n++) if (n1[m[n]] < 0.22) move(m[n], -1);
    for (let n = 0; n < m.length; n++) if (f[m[n]] > 0.86 && n1[m[n]] > 0.5) move(m[n], 1);
  }
  // ---- stone, kerbs, paving: flecks and small chips
  const flecks: ReadonlyArray<readonly [readonly string[], number, number, number]> = [
    [['stone', 'kerb'], 0.7, 0.78, 0.22],
    [['pave'], 0.8, 0.8, 0.2],
    [['cobble'], 0.7, 0.76, 0.24],
    [['gravel'], 0.6, 0.7, 0.3],
    [['white', 'marble'], 1.6, 0.9, 0.1],
    [['hull'], 0.9, 0.8, 0.2],
  ];
  for (const [names, cell, hi, lo] of flecks) {
    m = pixelsOf(c, lr, rampSet(lr, names));
    if (m) {
      const size = Math.max(1.5, cell * U);
      const f = noise(w, h, size, size, seed + 5 + names[0].length);
      for (let n = 0; n < m.length; n++) if (f[m[n]] > hi) move(m[n], 1);
      for (let n = 0; n < m.length; n++) if (f[m[n]] < lo) move(m[n], -1);
    }
  }
  // ---- slates: rows of single slates
  m = pixelsOf(c, lr, rampSet(lr, ['roof']));
  if (m) {
    const ch = Math.max(3, pyRound(1.6 * U));
    const bl = Math.max(5, pyRound(3 * U));
    const J = new Float64Array(65536);
    for (let i = 0; i < 65536; i++) J[i] = r.random();
    for (let n = 0; n < m.length; n++) {
      const i = m[n];
      const y = Math.floor(i / w);
      const x = i - y * w;
      const row = Math.floor(y / ch);
      const off = (row % 2) * Math.floor(bl / 2);
      const col = Math.floor((x + off) / bl);
      const j = J[(row % 256) * 256 + (col % 256)];
      let d = j < 0.2 ? 1 : j > 0.84 ? -1 : 0;
      if (y % ch === ch - 1) d = 2;
      if ((x + off) % bl === 0) d = Math.max(d, 1);
      move(i, d);
    }
  }
  // ---- wood and bark: long grain
  const grain = (names: readonly string[], cx: number, cy: number, s: number, hi: number, lo: number, tiles = false): void => {
    const mm = pixelsOf(c, lr, rampSet(lr, names));
    if (!mm) return;
    const nn = noise(w, h, cx, cy, s, tiles);
    for (let n = 0; n < mm.length; n++) if (nn[mm[n]] > hi) move(mm[n], 1);
    for (let n = 0; n < mm.length; n++) if (nn[mm[n]] < lo) move(mm[n], -1);
  };
  grain(['wood'], 9 * U, Math.max(1.2, 0.55 * U), seed + 8, 0.68, 0.28);
  grain(['bark'], Math.max(1.2, 0.55 * U), 6 * U, seed + 9, 0.62, 0.32);
  // ---- leaves: single leaf shapes, a lit top and a shaded foot, in three directions
  m = pixelsOf(c, lr, rampSet(lr, ['leaf', 'leaf2', 'moss']));
  if (m) {
    const ll = Math.max(2, pyRound(0.62 * U));
    const lh = Math.max(1, pyRound(0.36 * U));
    const stamps: Array<Array<readonly [number, number, number]>> = [];
    for (let ang = 0; ang < 3; ang++) {
      const pts: Array<readonly [number, number, number]> = [];
      for (let dy = -lh; dy <= lh; dy++) {
        for (let dx = -ll; dx <= ll; dx++) {
          let u = dx / ll;
          let v = dy / lh;
          if (ang === 1) {
            u = (dx + dy) / ll;
            v = (dy - dx * 0.4) / lh;
          }
          if (ang === 2) {
            u = (dx - dy) / ll;
            v = (dy + dx * 0.4) / lh;
          }
          if (u * u + v * v <= 1) pts.push([dy, dx, (v > 0.15 ? 1 : 0) - (v < -0.35 ? 1 : 0)]);
        }
      }
      stamps.push(pts);
    }
    const mask = new Uint8Array(c.length);
    for (let n = 0; n < m.length; n++) mask[m[n]] = 1;
    const n = Math.trunc(m.length / (ll * lh * 2.4));
    const P = new Int16Array(c.length);
    const RI = new Int16Array(c.length);
    for (let i = 0; i < c.length; i++) {
      P[i] = pos[c[i]];
      RI[i] = ridx[c[i]];
    }
    const pick = new Int32Array(n);
    for (let i = 0; i < n; i++) pick[i] = r.int(0, m.length);
    const lp = new Int32Array(n);
    for (let i = 0; i < n; i++) lp[i] = P[m[pick[i]]] + r.int(-1, 2) * TONE;
    const gr = new Uint8Array(n);
    for (let i = 0; i < n; i++) gr[i] = r.int(0, 3);
    for (let g = 0; g < 3; g++) {
      for (const [dy, dx, dt] of stamps[g]) {
        for (let i = 0; i < n; i++) {
          if (gr[i] !== g) continue;
          const at = m[pick[i]];
          const ly = Math.floor(at / w);
          const lx = at - ly * w;
          const Y = Math.max(0, Math.min(h - 1, ly + dy));
          const X = Math.max(0, Math.min(w - 1, lx + dx));
          if (!mask[Y * w + X]) continue;
          const rr = RI[at];
          const q = Math.max(0, Math.min(len[rr] - 1, lp[i] + dt * TONE));
          c[Y * w + X] = ext[rr * max + q];
        }
      }
    }
  }
  // ---- grass, lane, water, clouds, cloth
  grain(['grass'], Math.max(1.2, 0.5 * U), 1.6 * U, seed + 12, 0.64, 0.34);
  grain(['lane'], Math.max(1.3, 0.6 * U), Math.max(1.3, 0.5 * U), seed + 13, 0.76, 0.24);
  grain(['water', 'waterw'], 7 * U, Math.max(1.2, 0.4 * U), seed + 14, 0.66, 0.3, wrap);
  const lighten = (set: Uint8Array, cx: number, cy: number, s: number, hi: number): void => {
    const mm = pixelsOf(c, lr, set);
    if (!mm) return;
    const nn = noise(w, h, cx, cy, s);
    for (let n = 0; n < mm.length; n++) if (nn[mm[n]] > hi) move(mm[n], 1);
  };
  lighten(prefixSet(lr, 'cloud'), 2.2 * U, 1.4 * U, seed + 15, 0.72);
  lighten(rampSet(lr, ['cloth']), Math.max(1.2, 0.55 * U), 5 * U, seed + 16, 0.66);
  lighten(rampSet(lr, ['far']), 2 * U, U, seed + 17, 0.72);
  // ---- windows: small panes, a profile in the frame
  const wh = lr.byName.white;
  const gl = lr.byName.glass;
  const riG = lr.names.indexOf('glass');
  const riW = lr.names.indexOf('white');
  for (const mk of marks) {
    if (mk[0] !== 'win') continue;
    const [, x, y, ww, hh] = mk;
    const x0 = Math.trunc(x * U);
    const y0 = Math.trunc(y * U);
    const x1 = Math.trunc((x + ww) * U);
    const y1 = Math.trunc((y + hh) * U);
    const x0c = Math.max(x0, 0);
    const y0c = Math.max(y0, 0);
    const x1c = Math.min(x1, w);
    const y1c = Math.min(y1, h);
    if (x1c <= x0c || y1c <= y0c) continue;
    const sw = x1c - x0c;
    const sh = y1c - y0c;
    const at = (j: number, i: number): number => (y0c + j) * w + x0c + i;
    const g = new Uint8Array(sw * sh);
    let any = false;
    for (let j = 0; j < sh; j++) {
      for (let i = 0; i < sw; i++) {
        if (ridx[c[at(j, i)]] === riG) {
          g[j * sw + i] = 1;
          any = true;
        }
      }
    }
    if (!any) continue;
    // Glazing bars at the finer pixel.
    const cols = ww >= 12 ? 4 : 3;
    const rows = hh >= 18 ? 6 : 4;
    for (let i = 1; i < cols; i++) {
      const q = x0 + Math.floor(((x1 - x0) * i) / cols) - x0c;
      if (q >= 0 && q < sw) for (let j = 0; j < sh; j++) if (g[j * sw + q]) c[at(j, q)] = wh[STEP];
    }
    for (let j = 1; j < rows; j++) {
      const q = y0 + Math.floor(((y1 - y0) * j) / rows) - y0c;
      if (q >= 0 && q < sh) for (let i = 0; i < sw; i++) if (g[q * sw + i]) c[at(q, i)] = wh[STEP];
    }
    // The sky gets lighter towards the top of the glass in two hard steps.
    for (let j = 0; j < sh && j < sh * 0.35; j++) {
      for (let i = 0; i < sw; i++) {
        const v = c[at(j, i)];
        if (ridx[v] === riG && pos[v] === 2 * STEP) c[at(j, i)] = gl[2 * STEP - MID];
      }
    }
    // The inner line of the frame.
    if (U >= 2 && x1 - x0 >= 8 && y1 - y0 >= 8) {
      const fr = Math.max(1, U);
      for (let j = 0; j < sh; j++) {
        for (let i = 0; i < sw; i++) {
          const ins = (j >= fr && j < fr + 1 && i >= fr && i < sw - fr) || (j >= fr && j < sh - fr && i >= fr && i < fr + 1);
          if (ins && ridx[c[at(j, i)]] === riW) c[at(j, i)] = wh[2 * STEP];
        }
      }
    }
  }
}

/** Palette ids of a finished 1× drawing at tier u (EPX, long ramps, detail). */
export function renderIds(o: S, seed: number, u: 1 | 2 | 4): { c: Int16Array; w: number; h: number } {
  if (u === 1) return { c: o.c, w: o.w, h: o.h };
  const lr = longRamps(u);
  // Letters and arrows stay out: EPX closes such small shapes. They come back as whole blocks at the end.
  const stamps: Array<readonly [at: number, col: number]> = [];
  let c: Int16Array = o.c;
  for (let q = o.marks.length - 1; q >= 0; q--) {
    const m = o.marks[q];
    if (m[0] !== 'stamp') continue;
    const x = o.wrap ? ((m[1] % o.w) + o.w) % o.w : m[1];
    if (x < 0 || x >= o.w || m[2] < 0 || m[2] >= o.h) continue;
    const at = m[2] * o.w + x;
    if (c === o.c) c = o.c.slice();
    // Something drawn later over this pixel wins: then the stamp is gone.
    if (c[at] !== m[3]) continue;
    c[at] = m[4];
    stamps.push([at, m[3]]);
  }
  let w = o.w;
  let h = o.h;
  for (let n = u === 4 ? 2 : 1; n > 0; n--) {
    c = epx(c, w, h, o.wrap);
    w *= 2;
    h *= 2;
  }
  c = interband(c, w, h, lr, undefined, undefined, o.wrap);
  if (lr.mid === 2) c = interband(c, w, h, lr, 2, 1, o.wrap);
  detail(c, w, h, seed, o.marks, lr, o.wrap);
  if (lr.mid === 2) {
    // More tones inside big shapes: small clusters one long-ramp tone away.
    const nn = noise(w, h, 2.2 * u, 1.2 * u, seed + 40);
    const big = rampSet(lr, ['stone', 'pave', 'cobble', 'gravel', 'grass', 'bark', 'wood', 'roof', 'lane', 'kerb', 'hull']);
    lr.names.forEach((n, i) => {
      if (n.startsWith('brick') || n.startsWith('plast')) big[i] = 1;
    });
    const { ridx, pos, ext, max, len } = lr;
    for (let i = 0; i < c.length; i++) {
      const v = c[i];
      const ri = ridx[v];
      if (ri < 0 || !big[ri]) continue;
      if (nn[i] > 0.62) c[i] = ext[ri * max + Math.min(pos[v] + 1, len[ri] - 1)];
    }
    for (let i = 0; i < c.length; i++) {
      const v = c[i];
      const ri = ridx[v];
      if (ri < 0 || !big[ri]) continue;
      if (nn[i] < 0.36) c[i] = ext[ri * max + Math.max(pos[v] - 1, 0)];
    }
  }
  for (let q = stamps.length - 1; q >= 0; q--) {
    const [at, col] = stamps[q];
    const y0 = Math.floor(at / o.w) * u;
    const x0 = (at % o.w) * u;
    for (let j = 0; j < u; j++) c.fill(col, (y0 + j) * w + x0, (y0 + j) * w + x0 + u);
  }
  return { c, w, h };
}

const tableCache = new Map<string, Uint32Array>();

/** Colour by palette id at tier u in a light (the sky, its clouds, the sun and the outlines are not graded). */
export function lightTable(light: LightName, u: 1 | 2 | 4): Uint32Array {
  const key = `${light}/${u}/${COL.length}`;
  const had = tableCache.get(key);
  if (had) return had;
  const L = LIGHTS[light];
  const cols: readonly string[] = u === 1 ? COL.map((h) => h ?? '#000000') : longRamps(u).cols;
  const t = new Uint32Array(cols.length);
  const pack = (c: readonly [number, number, number]): number => ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0;
  for (let i = 1; i < cols.length; i++) {
    const c = hexrgb(cols[i]);
    t[i] = pack(i === K || i === KM ? c : gradeColour(c, L));
  }
  for (const nm of [L.sky, L.cloud, 'sun']) for (const i of R[nm]) t[i] = pack(hexrgb(COL[i] as string));
  tableCache.set(key, t);
  return t;
}

/** Palette ids to a PixelBuffer (id 0 stays transparent). */
export function idsToBuffer(c: Int16Array, w: number, h: number, table: Uint32Array): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const d = b.data;
  for (let i = 0; i < c.length; i++) if (c[i] > 0) d[i] = table[c[i]] as Color;
  return b;
}

/** A finished drawing as a buffer at tier u in a light. */
export function renderBuffer(o: S, light: LightName, u: 1 | 2 | 4, seed: number): PixelBuffer {
  const r = renderIds(o, seed, u);
  return idsToBuffer(r.c, r.w, r.h, lightTable(light, u));
}

/**
 * The frames of one animated drawing at tier u. The detail step picks its pattern from what it finds, so
 * a small change in the 1× drawing would repaint the whole texture of a frame. Here a later frame shows
 * the first frame's pixels, except where its own 1× drawing differs (plus a pixel around that): a frame
 * changes what the drawing changes, and nothing else.
 */
export function renderFrames(list: readonly S[], light: LightName, u: 1 | 2 | 4, seed: number): PixelBuffer[] {
  const table = lightTable(light, u);
  if (u === 1 || list.length < 2) return list.map((o) => renderBuffer(o, light, u, seed));
  const first = list[0];
  const base = renderIds(first, seed, u);
  return list.map((o, k) => {
    if (k === 0) return idsToBuffer(base.c, base.w, base.h, table);
    const r = renderIds(o, seed, u);
    if (o.w !== first.w || o.h !== first.h) return idsToBuffer(r.c, r.w, r.h, table);
    const out = base.c.slice();
    for (let y = 0; y < o.h; y++) {
      for (let x = 0; x < o.w; x++) {
        let differs = false;
        for (let dy = Math.max(0, y - 1); dy <= Math.min(o.h - 1, y + 1) && !differs; dy++) {
          for (let dx = Math.max(0, x - 1); dx <= Math.min(o.w - 1, x + 1); dx++) {
            if (o.c[dy * o.w + dx] !== first.c[dy * o.w + dx]) {
              differs = true;
              break;
            }
          }
        }
        if (!differs) continue;
        for (let j = 0; j < u; j++) {
          const at = (y * u + j) * r.w + x * u;
          out.set(r.c.subarray(at, at + u), at);
        }
      }
    }
    return idsToBuffer(out, r.w, r.h, table);
  });
}

/** A real game sprite stays as it is: whole-number scale, nearest neighbour. */
export function repeatBuffer(buf: PixelBuffer, u: number): PixelBuffer {
  return u > 1 ? buf.scaled(u) : buf;
}

/** The reference's per-scene seed part. */
export function hashSeed(part: string): number {
  let n = 0;
  for (let i = 0; i < part.length; i++) n += part.charCodeAt(i) * 31;
  return n;
}
