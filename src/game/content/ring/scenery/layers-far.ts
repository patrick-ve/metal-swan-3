/**
 * The far layers of the ring (docs/design/ring.md §2, §4, §11): `ring-sky` (one 512 × 104 tile,
 * parallax 0.04), `ring-far` (the hazy skyline, 0.2, chunks of 256 × 80 from screen y 20) and
 * `ring-city` (the district, 0.35, chunks of 256 × 92 from screen y 8). ONE density-generic
 * drawer each (kit.ts `Pen`): d 1 is the 1× art in PAL, d 2 and 4 the dense art in PAL_HD with the
 * same shapes at the same logical places. Painted backgrounds: no ink outline; far layers mix
 * toward the haze (atmospheric perspective). Params: `kind` (the district look), `x0` (the chunk's
 * layer x: textures hash GLOBAL x so chunks of one look join), `rs` (the run seed).
 *
 * Kinds — far: city, towers, woods, port, polder, water. City: flats, slabs, zuidas, river, lake,
 * port, polder, water.
 */
import type { Color } from '../../../../engine/color';
import type { PixelBuffer } from '../../../../engine/pixel';
import { defineBgGenerator } from '../../../art/art-registry';
import { noise1 } from '../../../art/paint';
import { bay, dq, h2, haze, num, Pen, str, tone, toneI, type Dn, type Params } from './kit';
import type { HdRampName } from '../../../../engine/palette-hd';

/** A big period for non-tiling noise (chunks are not tiles; they join by global x). */
const BIG = 1 << 22;

export type Gen = (w: number, h: number, p: Params, seed: number, d: Dn) => PixelBuffer;

/** Register a density-generic generator: the 1× generator is the drawer at d 1. */
export function defineRingGen(id: string, gen: Gen): void {
  defineBgGenerator(id, (w, h, p, s) => gen(w, h, p, s, 1), { hd: (w, h, p, s, d) => gen(w, h, p, s, d) });
}

// =============================================================================================
// Shared painting helpers
// =============================================================================================

/** Three tones of a material seen through `air`: shade, mid, lit (HD indices k − 1, k, k + 1). */
export function tones3(r: HdRampName, k: number, air: number, d: Dn): [Color, Color, Color] {
  return [haze(toneI(r, k - 1, d), air, d), haze(toneI(r, k, d), air, d), haze(toneI(r, k + 1, d), air, d)];
}

export interface FacadeOpts {
  x: number;
  top: number;
  w: number;
  bottom: number;
  ramp: HdRampName;
  k: number;
  air: number;
  /** Storey height and window spacing (logical px); 0 = no windows. */
  storey: number;
  col: number;
  winW: number;
  winH: number;
  /** Balcony bands (one per storey). */
  balcony?: boolean;
  /** Glass ramp tone of the windows. */
  glass?: number;
  seed: number;
}

/** A face-on building: lit left strip, shaded right strip, a lit parapet, windows (and balconies). */
export function facade(p: Pen, o: FacadeOpts): void {
  const d = p.d;
  const [sh, mid, lit] = tones3(o.ramp, o.k, o.air, d);
  const w = o.w;
  const hgt = o.bottom - o.top;
  p.rect(o.x, o.top, w, hgt, mid);
  if (d >= 4 && (o.ramp === 'brick' || o.ramp === 'brickDark')) {
    // Brick courses: a darker hairline every ¾ px, staggered head joints.
    const course = haze(toneI(o.ramp, o.k - 1, d), o.air, d);
    for (let y = o.top + 1.5, row = 0; y < o.bottom; y += 0.75, row++) {
      p.rect(o.x, y, w, 0.25, course);
      for (let x = o.x + (row % 2) * 1.25; x < o.x + w; x += 2.5) p.rect(x, y - 0.5, 0.25, 0.5, course);
    }
  }
  const s = d === 1 ? 1 : 0.75;
  p.rect(o.x, o.top, s, hgt, lit);
  p.rect(o.x + w - s, o.top, s, hgt, sh);
  // Parapet: a lit coping and its shadow.
  p.rect(o.x, o.top, w, d === 1 ? 1 : 0.5, haze(toneI(o.ramp, o.k + 2, d), o.air, d));
  if (d > 1) p.rect(o.x + s, o.top + 0.5, w - 2 * s, 0.5, sh);
  if (o.storey <= 0) return;
  const gk = o.glass ?? 2;
  const g0 = haze(toneI('glass', gk, d), o.air, d);
  const g1 = haze(toneI('glass', gk + 2, d), o.air, d);
  const sill = haze(toneI(o.ramp, o.k + 2, d), o.air, d);
  const curtain = haze(toneI('plaster', 4, d), o.air, d);
  const bal = haze(toneI('gable', 4, d), o.air, d);
  const balSh = haze(toneI(o.ramp, o.k - 2, d), o.air, d);
  let row = 0;
  for (let y = o.top + 2; y + o.winH <= o.bottom - 1; y += o.storey, row++) {
    let col = 0;
    for (let x = o.x + 2; x + o.winW <= o.x + w - 1.5; x += o.col, col++) {
      const hh = h2(row, col, o.seed);
      p.rect(x, y, o.winW, o.winH, hh < 0.12 ? curtain : g0);
      if (d > 1) {
        // A sky reflection in the upper left of the pane, a lit sill at 4×.
        p.rect(x, y, o.winW * 0.5, o.winH * 0.4, hh < 0.12 ? curtain : g1);
        if (d >= 4) p.rect(x - 0.25, y + o.winH, o.winW + 0.5, 0.25, sill);
      }
    }
    if (o.balcony) {
      p.rect(o.x + s, y + o.winH, w - 2 * s, d === 1 ? 1 : 0.75, bal);
      if (d > 1) p.rect(o.x + s, y + o.winH + 0.75, w - 2 * s, 0.25, balSh);
    }
  }
}

/** A round lit tree canopy (green ramp; leafy speckle at d ≥ 2) on a short trunk. */
export function tree(p: Pen, cx: number, foot: number, r: number, air: number, seed: number, trunk = true): void {
  const d = p.d;
  const leaf: Color[] = [];
  for (let k = 1; k <= 6; k++) leaf.push(haze(toneI('green', k, d), air, d));
  if (trunk) p.rect(cx - 0.5, foot - r * 0.6, 1, r * 0.6, haze(toneI('brown', 2, d), air, d));
  const cy = foot - r * 0.55 - r * 0.8;
  const lumps = 3 + Math.floor(h2(cx * 7, foot, seed) * 3);
  for (let k = 0; k < lumps; k++) {
    const a = (k / lumps) * Math.PI * 2 + h2(k, seed, 3) * 0.8;
    const lx = cx + Math.cos(a) * r * 0.45;
    const ly = cy + Math.sin(a) * r * 0.32;
    const lr = r * (0.55 + h2(k, seed, 9) * 0.2);
    p.disc(lx, ly, lr, lr * 0.85, (X, Y, u, v) => {
      let t = 0.52 - 0.32 * u - 0.42 * v + (ly - cy) * -0.02;
      if (d > 1) t += (h2(X >> 1, Y >> 1, seed) - 0.5) * 0.28;
      const i = Math.max(0, Math.min(5, Math.floor(t * 5.2)));
      return leaf[i];
    });
  }
}

// =============================================================================================
// ring-sky — a summer day over the ring (512 × 104 tile)
// =============================================================================================

const sky: Gen = (w, h, _p, seed, d) => {
  const pen = new Pen(w, h, d, true);
  // Gradient: HD sky tone 3 at the top → tone 6 (pale) at the horizon; dithered band borders.
  for (let Y = 0; Y < pen.H; Y++) {
    const t = (Y + 0.5) / pen.H;
    const v = 2.9 + 3.4 * Math.pow(t, 1.5);
    if (d === 1) pen.span(0, pen.W, Y, toneI('sky', Math.floor(v), 1));
    else {
      for (let X = 0; X < pen.W; X++) pen.dot(X, Y, toneI('sky', Math.min(7, dq(v, X, Y, 0.45)), d));
    }
  }
  // A thin haze band near the horizon.
  pen.rect(0, h - 10, w, 10, tone('sky', 0.95, d));
  if (d > 1) for (let X = 0; X < pen.W; X++) for (let Y = (h - 16) * d; Y < (h - 10) * d; Y++) if (bay(X, Y) < ((Y / d - (h - 16)) / 6) * 0.9) pen.dot(X, Y, tone('sky', 0.95, d));
  // Cumulus clouds: lumps with lit tops, a flat shaded base; lower clouds paler (further away).
  const shadeC = [toneI('snow', 2, d), toneI('snow', 3, d), toneI('snow', 4, d), toneI('snow', 5, d), toneI('snow', 6, d)];
  const n = 7 + Math.floor(h2(1, 2, seed) * 3);
  for (let c = 0; c < n; c++) {
    const cx = (c + h2(c, 1, seed) * 0.8) * (w / n);
    const cy = 14 + h2(c, 2, seed) * 48;
    const s = 6 + h2(c, 3, seed) * 16 * (1 - cy / 140);
    const m = 4 + Math.floor(h2(c, 4, seed) * 4);
    const lumps: Array<[number, number, number]> = [];
    for (let k = 0; k < m; k++) {
      const lx = cx + (k / (m - 1) - 0.5) * s * 3 + (h2(c, k + 10, seed) - 0.5) * s * 0.6;
      const lr = s * (0.5 + h2(c, k + 20, seed) * 0.45) * (1 - Math.abs(k / (m - 1) - 0.5) * 0.7);
      lumps.push([lx, cy - lr * 0.35, lr]);
    }
    const base = cy + s * 0.3;
    const far = Math.min(1, cy / 70);
    const X0 = Math.floor((cx - s * 2.2) * d);
    const X1 = Math.ceil((cx + s * 2.2) * d);
    const Y0 = Math.max(0, Math.floor((cy - s * 1.4) * d));
    const Y1 = Math.min(pen.H, Math.ceil(base * d));
    for (let Y = Y0; Y < Y1; Y++) {
      const y = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const x = (X + 0.5) / d;
        let best = -1;
        let nu = 0;
        let nv = 0;
        for (const [lx, ly, lr] of lumps) {
          const u = (x - lx) / lr;
          const v = (y - ly) / (lr * 0.8);
          const q = 1 - (u * u + v * v);
          if (q > best) {
            best = q;
            nu = u;
            nv = v;
          }
        }
        if (best <= 0) continue;
        // Light from the upper left; the base in shade; far clouds lower contrast.
        let t = 0.62 - 0.28 * nu - 0.45 * nv - Math.max(0, (y - (base - s * 0.35)) / (s * 0.35)) * 0.35;
        t = 0.55 + (t - 0.55) * (1 - far * 0.45);
        const i = d === 1 ? Math.max(0, Math.min(4, Math.round(t * 4))) : Math.max(0, Math.min(4, dq(t * 4.6, X, Y, 0.5)));
        pen.dot(X, Y, shadeC[i]);
      }
    }
  }
  return pen.finish();
};

// =============================================================================================
// ring-far — the hazy skyline (chunks of 256 × 80, screen y 20 … 100)
// =============================================================================================

const FAR_TOP = 20;
const FAR_AIR = 0.58;

const far: Gen = (w, h, p, seed, d) => {
  const pen = new Pen(w, h, d);
  const kind = str(p, 'kind', 'city');
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  const base = 92 - FAR_TOP;
  const air = FAR_AIR;
  const ground = haze(toneI('olive', 3, d), air + 0.05, d);
  const groundLit = haze(toneI('olive', 5, d), air + 0.08, d);
  if (kind === 'water') {
    farWater(pen, base, air, x0, rs);
    return pen.finish();
  }
  if (kind === 'woods') farWoods(pen, base, air, x0, rs);
  else if (kind === 'polder') farPolder(pen, base, air, x0, rs, seed);
  else if (kind === 'port') farPort(pen, base, air, seed);
  else farCity(pen, base, air, seed, kind === 'towers');
  pen.rect(0, base, w, h - base, ground);
  pen.rect(0, base, w, d === 1 ? 1 : 0.5, groundLit);
  return pen.finish();
};

function farCity(pen: Pen, base: number, air: number, seed: number, towers: boolean): void {
  const d = pen.d;
  const mats: Array<[HdRampName, number]> = towers
    ? [
        ['glass', 3],
        ['steel', 4],
        ['gable', 3],
        ['glass', 4],
        ['stone', 4],
      ]
    : [
        ['stone', 4],
        ['steel', 4],
        ['brickDark', 4],
        ['plaster', 3],
        ['gable', 3],
      ];
  let x = 1 + h2(0, 1, seed) * 5;
  for (let k = 0; x < pen.w - 6; k++) {
    let bw = 7 + Math.floor(h2(k, 1, seed) * (towers ? 12 : 18));
    if (x + bw > pen.w - 1) bw = Math.floor(pen.w - 1 - x);
    if (bw < 4) break;
    const tall = h2(k, 2, seed);
    let bh = towers ? 14 + tall * 34 : 5 + tall * 18;
    if (!towers && tall > 0.9) bh = 26 + h2(k, 3, seed) * 18;
    const [rmp, kk] = mats[Math.floor(h2(k, 4, seed) * mats.length)];
    const fill = haze(toneI(rmp, kk, d), air, d);
    const lit = haze(toneI(rmp, kk + 1, d), air + 0.04, d);
    const shade = haze(toneI(rmp, kk - 1, d), air, d);
    const top = base - bh;
    pen.rect(x, top, bw, bh + 1, fill);
    pen.rect(x, top, d === 1 ? 1 : 0.5, bh, lit);
    if (bw > 5) pen.rect(x + bw - (d === 1 ? 1 : 0.5), top, d === 1 ? 1 : 0.5, bh, shade);
    if (towers && h2(k, 5, seed) < 0.35) {
      // A slanted or stepped crown.
      pen.poly(
        [
          [x, top],
          [x + bw, top - 4],
          [x + bw, top],
        ],
        fill,
      );
    }
    if (d > 1) {
      // Faint floor lines (window bands).
      const band = haze(toneI(rmp, kk - 1, d), air + 0.05, d);
      for (let y = top + 2; y < base - 1; y += towers ? 2 : 3) pen.rect(x + 1, y, bw - 2, 1 / d, band);
    }
    if (tall > 0.8) pen.rect(x + bw * 0.5, top - 4, pen.hair, 4, shade);
    x += bw + (h2(k, 6, seed) < 0.35 ? 0 : 1 + Math.floor(h2(k, 7, seed) * 5));
  }
}

function farWoods(pen: Pen, base: number, air: number, x0: number, rs: number): void {
  const d = pen.d;
  const c0 = haze(toneI('green', 2, d), air, d);
  const c1 = haze(toneI('green', 3, d), air + 0.03, d);
  const c2 = haze(toneI('green', 4, d), air + 0.06, d);
  for (let X = 0; X < pen.W; X++) {
    const gx = x0 + (X + 0.5) / d;
    const top = base - 6 - noise1(gx, 22, BIG, rs) * 7 - noise1(gx, 5, BIG, rs + 3) * 3;
    const T = Math.round(top * d);
    for (let Y = T; Y < pen.H; Y++) {
      const dy = (Y - T) / d;
      const c = dy < 0.75 ? c2 : dy < 2.5 && noise1(gx, 3, BIG, rs + 9) > 0.5 ? c1 : c0;
      pen.dot(X, Y, c);
    }
  }
}

function farPolder(pen: Pen, base: number, air: number, x0: number, rs: number, seed: number): void {
  const d = pen.d;
  const row = haze(toneI('green', 2, d), air, d);
  const roof = haze(toneI('brick', 2, d), air, d);
  const wall = haze(toneI('gable', 4, d), air, d);
  const mill = haze(toneI('snow', 5, d), air, d);
  // Tree rows and farms along the horizon.
  for (let X = 0; X < pen.W; X++) {
    const gx = x0 + (X + 0.5) / d;
    const n = noise1(gx, 14, BIG, rs + 11);
    if (n < 0.45) continue;
    const hgt = (n - 0.45) * 9 + noise1(gx, 3, BIG, rs + 5) * 1.5;
    for (let Y = Math.round((base - hgt) * d); Y < base * d; Y++) pen.dot(X, Y, row);
  }
  for (let k = 0; k < 2; k++) {
    if (h2(k, 1, seed) < 0.4) continue;
    const fx = 20 + h2(k, 2, seed) * (pen.w - 40);
    pen.rect(fx, base - 3, 7, 3, wall);
    pen.poly(
      [
        [fx - 1, base - 3],
        [fx + 3.5, base - 6],
        [fx + 8, base - 3],
      ],
      roof,
    );
  }
  // Wind turbines far away: a white mast, a nacelle and three blades (static).
  for (let k = 0; k < 3; k++) {
    if (h2(k, 9, seed) < 0.45) continue;
    const tx = 12 + h2(k, 10, seed) * (pen.w - 24);
    const th = 22 + h2(k, 11, seed) * 10;
    turbine(pen, tx, base, th, mill, h2(k, 12, seed) * 2);
  }
}

/** A thin wind turbine (far): mast, nacelle, three blades at angle `a` (rad). */
export function turbine(pen: Pen, x: number, base: number, hgt: number, c: Color, a: number): void {
  const d = pen.d;
  const top = base - hgt;
  pen.rect(x - 0.5, top, 1, hgt, c);
  pen.rect(x - 1, top - 1, 2.5, 1.5, c);
  const len = hgt * 0.45;
  for (let k = 0; k < 3; k++) {
    const t = a + (k * Math.PI * 2) / 3;
    pen.line(x, top, x + Math.cos(t) * len, top + Math.sin(t) * len, c, d === 1 ? 1 : Math.max(1, d >> 1));
  }
}

function farPort(pen: Pen, base: number, air: number, seed: number): void {
  const d = pen.d;
  const steel = haze(toneI('steel', 4, d), air, d);
  const tank = haze(toneI('gable', 4, d), air, d);
  const tankLit = haze(toneI('gable', 6, d), air, d);
  const tankSh = haze(toneI('gable', 3, d), air, d);
  const hall = haze(toneI('steel', 3, d), air, d);
  const red = haze(toneI('red', 4, d), air, d);
  let x = 2;
  for (let k = 0; x < pen.w - 8; k++) {
    const kind = h2(k, 1, seed);
    if (kind < 0.35) {
      // Tanks.
      const tw = 10 + h2(k, 2, seed) * 8;
      const th = 6 + h2(k, 3, seed) * 6;
      if (x + tw > pen.w - 1) break;
      pen.rect(x, base - th, tw, th, tank);
      pen.rect(x, base - th, tw * 0.3, th, tankLit);
      pen.rect(x + tw * 0.8, base - th, tw * 0.2, th, tankSh);
      pen.disc(x + tw / 2, base - th, tw / 2, 1.5, tank);
      x += tw + 2;
    } else if (kind < 0.7) {
      // A long hall.
      const hw = 24 + h2(k, 4, seed) * 30;
      const hh = 5 + h2(k, 5, seed) * 4;
      if (x + hw > pen.w - 1) break;
      pen.rect(x, base - hh, hw, hh, hall);
      pen.rect(x, base - hh, hw, d === 1 ? 1 : 0.5, steel);
      x += hw + 1;
    } else {
      // A crane silhouette: legs, the boom.
      const cw = 14;
      if (x + cw + 10 > pen.w - 1) break;
      const ch = 26 + h2(k, 6, seed) * 10;
      pen.rect(x, base - ch * 0.7, 1, ch * 0.7, steel);
      pen.rect(x + cw, base - ch * 0.7, 1, ch * 0.7, steel);
      pen.rect(x, base - ch * 0.7, cw + 1, 1, steel);
      pen.line(x - 6, base - ch * 0.72, x + cw + 10, base - ch * 0.72, steel);
      pen.line(x + cw * 0.5, base - ch, x - 6, base - ch * 0.72, steel);
      pen.line(x + cw * 0.5, base - ch, x + cw + 10, base - ch * 0.72, steel);
      x += cw + 14;
    }
  }
  // One chimney with red and white bands.
  if (h2(9, 9, seed) < 0.5) {
    const cx = 30 + h2(9, 10, seed) * (pen.w - 60);
    for (let y = 0; y < 30; y += 3) pen.rect(cx, base - 30 + y, 2.5, 3, (y / 3) % 2 === 0 ? red : tank);
  }
}

function farWater(pen: Pen, base: number, air: number, x0: number, rs: number): void {
  const d = pen.d;
  const shore = haze(toneI('stone', 4, d), air, d);
  const shoreLit = haze(toneI('gable', 4, d), air, d);
  const water: Color[] = [haze(toneI('sky', 4, d), air, d), haze(toneI('sky', 5, d), air, d), haze(toneI('sky', 6, d), air, d)];
  for (let X = 0; X < pen.W; X++) {
    const gx = x0 + (X + 0.5) / d;
    const hgt = noise1(gx, 30, BIG, rs + 21) > 0.4 ? 2 + noise1(gx, 6, BIG, rs + 22) * 8 : 0.8;
    const T = Math.round((base - 3 - hgt) * d);
    for (let Y = T; Y < (base - 3) * d; Y++) pen.dot(X, Y, Y - T < d ? shoreLit : shore);
  }
  for (let Y = (base - 3) * d; Y < pen.H; Y++) {
    for (let X = 0; X < pen.W; X++) {
      const streak = h2(Math.floor((x0 * d + X) / (6 * d)), Y, rs) > 0.86 ? 1 : 0;
      pen.dot(X, Y, water[Math.min(2, 1 + streak - (Y > (base + 2) * d ? 1 : 0))]);
    }
  }
}

// =============================================================================================
// ring-city — the district (chunks of 256 × 92, screen y 8 … 100)
// =============================================================================================

const CITY_TOP = 8;
const CITY_AIR = 0.24;

const city: Gen = (w, h, p, seed, d) => {
  const pen = new Pen(w, h, d);
  const kind = str(p, 'kind', 'flats');
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  const base = 96 - CITY_TOP;
  switch (kind) {
    case 'zuidas':
      cityZuidas(pen, base, seed);
      break;
    case 'river':
      cityShore(pen, base, x0, rs, seed, 'river');
      break;
    case 'lake':
      cityShore(pen, base, x0, rs, seed, 'lake');
      break;
    case 'water':
      cityShore(pen, base, x0, rs, seed, 'ij');
      break;
    case 'port':
      cityPort(pen, base, seed);
      break;
    case 'polder':
      cityPolder(pen, base, x0, rs, seed);
      break;
    case 'slabs':
      cityFlats(pen, base, seed, true);
      break;
    default:
      cityFlats(pen, base, seed, false);
  }
  return pen.finish();
};

/** Housing blocks: brick and light slabs with balconies, a few high-rises, trees in front. */
function cityFlats(pen: Pen, base: number, seed: number, slabs: boolean): void {
  const air = CITY_AIR;
  const mats: Array<[HdRampName, number]> = [
    ['brick', 3],
    ['brickDark', 4],
    ['plaster', 4],
    ['gable', 4],
    ['stone', 4],
    ['sand', 4],
  ];
  let x = 2 + h2(0, 9, seed) * 8;
  const trees: Array<[number, number]> = [];
  for (let k = 0; x < pen.w - 12; k++) {
    const tower = h2(k, 1, seed) < (slabs ? 0.16 : 0.22);
    let bw = tower ? 22 + h2(k, 2, seed) * 12 : slabs ? 70 + h2(k, 2, seed) * 50 : 38 + h2(k, 2, seed) * 46;
    if (x + bw > pen.w - 2) bw = Math.floor(pen.w - 2 - x);
    if (bw < 16) break;
    const bh = tower ? 46 + h2(k, 3, seed) * 24 : slabs ? 24 + h2(k, 3, seed) * 14 : 18 + h2(k, 3, seed) * 18;
    const [r, kk] = mats[Math.floor(h2(k, 4, seed) * mats.length)];
    facade(pen, {
      x,
      top: base - bh,
      w: bw,
      bottom: base + 4,
      ramp: r,
      k: kk,
      air,
      storey: 4,
      col: tower ? 4 : 5,
      winW: 2,
      winH: 2,
      balcony: !tower && h2(k, 5, seed) < 0.55,
      seed: seed + k,
    });
    // Roof boxes and an antenna.
    const sh = haze(toneI(r, kk - 2, pen.d), air, pen.d);
    if (h2(k, 6, seed) < 0.6) pen.rect(x + bw * (0.2 + h2(k, 7, seed) * 0.5), base - bh - 2, 4, 2, sh);
    if (tower && h2(k, 8, seed) < 0.7) pen.rect(x + bw * 0.7, base - bh - 6, pen.d === 1 ? 1 : 0.5, 6, sh);
    trees.push([x - 3, bw]);
    x += bw + 6 + h2(k, 9, seed) * 12;
  }
  // Trees in front of the blocks (the verge hides their feet).
  for (let k = 0; k < 9; k++) {
    if (h2(k, 20, seed) < 0.25) continue;
    const tx = 6 + (k + h2(k, 21, seed)) * ((pen.w - 12) / 9);
    tree(pen, tx, base + 4, 5 + h2(k, 22, seed) * 4, air + 0.04, seed + k);
  }
}

/** Zuidas: glass towers of different heights and crowns over low podiums. */
function cityZuidas(pen: Pen, base: number, seed: number): void {
  const d = pen.d;
  const air = CITY_AIR;
  let x = 2 + h2(1, 1, seed) * 6;
  for (let k = 0; x < pen.w - 10; k++) {
    let bw = 20 + h2(k, 1, seed) * 22;
    if (x + bw > pen.w - 2) bw = Math.floor(pen.w - 2 - x);
    if (bw < 12) break;
    const bh = 38 + h2(k, 2, seed) * 42;
    const top = base - bh;
    const style = h2(k, 3, seed);
    if (style < 0.6) {
      // Curtain wall: sky reflection above, deep glass below, mullions and floor lines.
      const gl = [toneI('glass', 1, d), toneI('glass', 2, d), toneI('glass', 3, d), toneI('glass', 4, d), toneI('sky', 5, d), toneI('sky', 6, d)].map((c) => haze(c, air, d));
      const mull = haze(toneI('glass', 1, d), air, d);
      const frame = haze(toneI('gable', 5, d), air, d);
      pen.fill(x, top, bw, bh + 6, (X, Y) => {
        const y = (Y + 0.5) / d - top;
        const xx = (X + 0.5) / d - x;
        // Reflection: lighter toward the top and in a diagonal sheen.
        let v = 1.4 + (1 - y / bh) * 2.6 + (((xx + y * 0.6) % 22) < 5 ? 1.2 : 0);
        if (xx < 1) v += 1;
        if (xx > bw - 1.2) v -= 1.2;
        const i = d === 1 ? Math.round(v) : dq(v, X, Y, 0.7);
        if (d > 1 && (xx % 3 < 1 / d || y % 3 < 1 / d)) return mull;
        return gl[Math.max(0, Math.min(5, i))];
      });
      pen.rect(x, top, bw, d === 1 ? 1 : 0.5, frame);
    } else {
      // Stone grid facade with deep windows.
      facade(pen, { x, top, w: bw, bottom: base + 6, ramp: style < 0.8 ? 'gable' : 'stone', k: 4, air, storey: 3, col: 3, winW: 2, winH: 2, glass: 2, seed: seed + k });
    }
    if (h2(k, 4, seed) < 0.4) {
      // A slanted crown.
      const crown = haze(toneI('glass', 4, d), air, d);
      pen.poly(
        [
          [x, top],
          [x + bw, top - 6],
          [x + bw, top],
        ],
        crown,
      );
    }
    // A podium.
    const pw = bw + 8 + h2(k, 5, seed) * 10;
    facade(pen, { x: x - 3, top: base - 8 - h2(k, 6, seed) * 4, w: Math.min(pw, pen.w - x + 1), bottom: base + 6, ramp: 'stone', k: 3, air, storey: 0, col: 0, winW: 0, winH: 0, seed });
    x += bw + 4 + h2(k, 7, seed) * 10;
  }
}

/** Water with a far shore: the Amstel (trees and villas), the Nieuwe Meer (woods), the IJ (IJburg blocks). */
function cityShore(pen: Pen, base: number, x0: number, rs: number, seed: number, kind: 'river' | 'lake' | 'ij'): void {
  const d = pen.d;
  const air = CITY_AIR;
  // The waterline sits above the verge's bank (screen y 82 / 86) so the water shows over it.
  const waterY = kind === 'ij' ? base - 10 : base - 14;
  if (kind === 'ij') {
    // IJburg: modern blocks in colours across the water.
    const mats: Array<[HdRampName, number]> = [
      ['brick', 4],
      ['gable', 4],
      ['orange', 3],
      ['stone', 3],
      ['sand', 5],
    ];
    let x = 3;
    for (let k = 0; x < pen.w - 10; k++) {
      let bw = 18 + h2(k, 1, seed) * 26;
      if (x + bw > pen.w - 2) bw = Math.floor(pen.w - 2 - x);
      if (bw < 10) break;
      const bh = 10 + h2(k, 2, seed) * 16;
      const [r, kk] = mats[Math.floor(h2(k, 3, seed) * mats.length)];
      facade(pen, { x, top: waterY - bh, w: bw, bottom: waterY, ramp: r, k: kk, air: air + 0.12, storey: 3, col: 4, winW: 2, winH: 1.5, seed: seed + k });
      x += bw + 2 + h2(k, 4, seed) * 6;
    }
  } else {
    // A green bank: the treeline, villas or boathouses between the trees.
    const bank = haze(toneI('green', 3, d), air, d);
    const bankLit = haze(toneI('green', 5, d), air, d);
    pen.rect(0, waterY - 3, pen.w, 3, bank);
    pen.rect(0, waterY - 3, pen.w, d === 1 ? 1 : 0.5, bankLit);
    if (kind === 'river') {
      for (let k = 0; k < 4; k++) {
        if (h2(k, 30, seed) < 0.4) continue;
        const vx = 10 + (k + h2(k, 31, seed) * 0.5) * (pen.w / 4);
        facade(pen, { x: vx, top: waterY - 14, w: 14, bottom: waterY - 2, ramp: h2(k, 32, seed) < 0.5 ? 'brick' : 'plaster', k: 4, air, storey: 4, col: 4, winW: 2, winH: 2, seed: seed + k });
        pen.poly(
          [
            [vx - 1, waterY - 14],
            [vx + 7, waterY - 20],
            [vx + 15, waterY - 14],
          ],
          haze(toneI('brickDark', 3, d), air, d),
        );
      }
    }
    const n = kind === 'lake' ? 16 : 10;
    for (let k = 0; k < n; k++) {
      const tx = (k + h2(k, 40, seed)) * (pen.w / n);
      const r = kind === 'lake' ? 5 + h2(k, 41, seed) * 5 : 4 + h2(k, 41, seed) * 5;
      tree(pen, tx, waterY - 1, r, air + (kind === 'lake' ? 0.06 : 0.02), seed + 100 + k, kind !== 'lake');
    }
  }
  // The water: sky reflections, the shore's dark reflection below it, glinting ripples.
  const deep = kind === 'ij' ? 'sky' : 'canal';
  const wt: Color[] = [
    haze(toneI(deep, 2, d), air, d),
    haze(toneI(deep, 3, d), air, d),
    haze(toneI(deep, 4, d), air, d),
    haze(toneI('sky', 5, d), air, d),
    haze(toneI('sky', 6, d), air, d),
  ];
  for (let Y = waterY * d; Y < pen.H; Y++) {
    const y = (Y + 0.5) / d - waterY;
    for (let X = 0; X < pen.W; X++) {
      const gx = x0 + (X + 0.5) / d;
      let v = 1.6 + y * 0.12;
      if (y < 3) v -= 1;
      const rip = noise1(gx * 0.7 + y * 3, 9, BIG, rs + Math.floor(y)) ;
      if (rip > 0.72) v += 1.4;
      const i = d === 1 ? Math.round(v) : dq(v, X, Y, 0.6);
      pen.dot(X, Y, wt[Math.max(0, Math.min(4, i))]);
    }
  }
}

/** The port: container stacks, corrugated halls, tanks. */
function cityPort(pen: Pen, base: number, seed: number): void {
  const d = pen.d;
  const air = CITY_AIR;
  const boxes: HdRampName[] = ['red', 'navy', 'green', 'orange', 'steel', 'gable', 'teal', 'brown'];
  let x = 2;
  for (let k = 0; x < pen.w - 10; k++) {
    const kind = h2(k, 1, seed);
    if (kind < 0.55) {
      // A container stack: columns of boxes 12 × 5, two to four high.
      const cols = 2 + Math.floor(h2(k, 2, seed) * 4);
      for (let c = 0; c < cols && x + 12 < pen.w - 2; c++) {
        const high = 1 + Math.floor(h2(k * 7 + c, 3, seed) * 4);
        for (let r = 0; r < high; r++) {
          const ramp = boxes[Math.floor(h2(k * 13 + c, r, seed) * boxes.length)];
          const kk = ramp === 'navy' ? 4 : ramp === 'gable' ? 4 : 3;
          const [sh, mid, lit] = [haze(toneI(ramp, kk - 1, d), air, d), haze(toneI(ramp, kk, d), air, d), haze(toneI(ramp, kk + 1, d), air, d)];
          const by = base - 5 * (r + 1);
          pen.rect(x, by, 12, 5, mid);
          pen.rect(x, by, 12, d === 1 ? 1 : 0.5, lit);
          pen.rect(x + 11.5, by, 0.5, 5, sh);
          if (d > 1) for (let rx = x + 1; rx < x + 11.5; rx += 1) pen.rect(rx, by + 0.75, 1 / d, 3.5, sh);
          if (d === 1) pen.rect(x + 11, by, 1, 5, sh);
        }
        x += 12.5;
      }
      x += 4;
    } else if (kind < 0.85) {
      // A corrugated hall with a door.
      let hw = 40 + h2(k, 4, seed) * 40;
      if (x + hw > pen.w - 2) hw = pen.w - 2 - x;
      if (hw < 20) break;
      const hh = 14 + h2(k, 5, seed) * 10;
      const ramp: HdRampName = h2(k, 6, seed) < 0.5 ? 'steel' : 'teal';
      const [sh, mid, lit] = [haze(toneI(ramp, 3, d), air, d), haze(toneI(ramp, 4, d), air, d), haze(toneI(ramp, 5, d), air, d)];
      pen.rect(x, base - hh, hw, hh + 4, mid);
      if (d > 1) for (let rx = x + 0.5; rx < x + hw; rx += 1.5) pen.rect(rx, base - hh + 1, 0.5, hh + 3, sh);
      pen.rect(x, base - hh, hw, 1, lit);
      pen.rect(x + hw * 0.4, base - hh * 0.55, hw * 0.2, hh * 0.55 + 4, haze(toneI('steel', 2, d), air, d));
      x += hw + 3;
    } else {
      // Tanks.
      const tw = 16 + h2(k, 7, seed) * 8;
      if (x + tw > pen.w - 2) break;
      const th = 12 + h2(k, 8, seed) * 8;
      const c = [haze(toneI('gable', 3, d), air, d), haze(toneI('gable', 4, d), air, d), haze(toneI('gable', 6, d), air, d)];
      pen.fill(x, base - th, tw, th + 4, (X) => {
        const u = ((X + 0.5) / d - x) / tw;
        return c[u < 0.3 ? 2 : u < 0.75 ? 1 : 0];
      });
      pen.disc(x + tw / 2, base - th, tw / 2, 2, c[1]);
      x += tw + 3;
    }
  }
}

/** The polders north of the ring: fields with ditches, a farm, poplar rows, cows. */
function cityPolder(pen: Pen, base: number, x0: number, rs: number, seed: number): void {
  const d = pen.d;
  const air = CITY_AIR + 0.05;
  const field = [haze(toneI('green', 4, d), air, d), haze(toneI('green', 5, d), air, d), haze(toneI('olive', 5, d), air, d)];
  const ditch = haze(toneI('sky', 5, d), air, d);
  const ground = base - 12;
  // Poplar rows on the horizon.
  for (let k = 0; k < 18; k++) {
    if (h2(k, 50, seed) < 0.35) continue;
    const px = (k + h2(k, 51, seed) * 0.6) * (pen.w / 18);
    const ph = 10 + h2(k, 52, seed) * 8;
    pen.disc(px, ground - ph / 2, 1.8, ph / 2, (_X, _Y, u) => haze(toneI('green', u < -0.2 ? 4 : u < 0.4 ? 3 : 2, d), air + 0.06, d));
  }
  // A farm: a big barn roof and a white house.
  if (h2(3, 3, seed) < 0.7) {
    const fx = 30 + h2(3, 4, seed) * (pen.w - 90);
    const brick = haze(toneI('brick', 3, d), air, d);
    pen.rect(fx, ground - 7, 26, 7, brick);
    pen.poly(
      [
        [fx - 2, ground - 7],
        [fx + 13, ground - 17],
        [fx + 28, ground - 7],
      ],
      haze(toneI('ink', 1, d), air + 0.1, d),
    );
    pen.poly(
      [
        [fx - 2, ground - 7],
        [fx + 13, ground - 17],
        [fx + 13, ground - 7],
      ],
      haze(toneI('steel', 2, d), air + 0.1, d),
    );
    facade(pen, { x: fx + 30, top: ground - 9, w: 12, bottom: ground, ramp: 'gable', k: 4, air, storey: 4, col: 4, winW: 2, winH: 2, seed });
    pen.poly(
      [
        [fx + 29, ground - 9],
        [fx + 36, ground - 14],
        [fx + 43, ground - 9],
      ],
      haze(toneI('brickDark', 3, d), air, d),
    );
  }
  // Fields in strips with ditches (the polder grid seen from the road).
  for (let Y = ground * d; Y < pen.H; Y++) {
    const y = (Y + 0.5) / d - ground;
    const strip = Math.floor(y / 4);
    for (let X = 0; X < pen.W; X++) {
      const gx = x0 + (X + 0.5) / d;
      if (y % 4 < (d === 1 ? 1 : 0.5) && strip > 0) {
        pen.dot(X, Y, ditch);
        continue;
      }
      const v = (h2(strip, Math.floor(gx / 60), rs) * 3) | 0;
      pen.dot(X, Y, field[v]);
    }
  }
  // Cows.
  const black = haze(toneI('ink', 1, d), air, d);
  const white = haze(toneI('snow', 6, d), air, d);
  for (let k = 0; k < 6; k++) {
    if (h2(k, 60, seed) < 0.5) continue;
    const cx = 8 + h2(k, 61, seed) * (pen.w - 16);
    const cy = ground + 2 + h2(k, 62, seed) * 6;
    pen.rect(cx, cy, 3, 1.5, white);
    pen.rect(cx + 1, cy, 1, 1, black);
    pen.rect(cx, cy + 1.5, 0.5, 1, black);
    pen.rect(cx + 2.5, cy + 1.5, 0.5, 1, black);
  }
}

defineRingGen('ring-sky', sky);
defineRingGen('ring-far', far);
defineRingGen('ring-city', city);

/** Unused helper kept for the tones of a ramp (tests read it). */
export const FAR_KINDS = ['city', 'towers', 'woods', 'port', 'polder', 'water'] as const;
export const CITY_KINDS = ['flats', 'slabs', 'zuidas', 'river', 'lake', 'port', 'polder', 'water'] as const;
