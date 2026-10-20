/**
 * Sprites of content area `ring/hazards` (docs/design/ring.md §7, §11; docs/ART_GUIDE.md "UHD
 * art"): ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× and 4×), outline A for
 * what moves or can be hit (cones, the trailer, the truck, the camera post), our own lettering.
 *
 * - `ring/hazard/gantry-truss` (1; anchor = the near post's foot, plane y NEAR_P): the galvanised
 *   lattice beam drawn oblique across the road (geometry.ts `SLANT`) and the near post with its
 *   concrete foot. `ring/hazard/gantry-post` (1; anchor = the far post's own foot on the median).
 * - `ring/hazard/sign` (8, centre anchor): the matrix sign — a black housing in a steel frame, the
 *   face lit as LEDs (a dot grid at 4×): blank, the red X, the white diagonal arrows (to the far
 *   lane ↗, to the near lane ↘: they point where to steer on screen), the red-ringed 50 / 80 / 100,
 *   the white end-of-restrictions circle. `ring/hazard/flasher` (2, centre): an amber corner lamp
 *   off / on.
 * - `ring/hazard/cone` (4, feet anchor): an orange cone with two reflective bands on a black foot;
 *   1–3 knocked over and tumbling.
 * - `ring/hazard/arrow-trailer` (1) and `ring/hazard/arrow-board` (3, centre: dark, the amber arrow
 *   to the far lane, to the near lane) — the arrow trailer at the head of a closure.
 * - `ring/hazard/absorber` (2: beacon left / right lit) — the yellow crash-absorber truck, the
 *   cushion with red-white chevrons at its rear (no logo).
 * - `ring/hazard/speedcam` (3: idle, the red LED lit while a wagon is in the front third, the flash
 *   window lit) on its post; `ring/hazard/flash` (3, centre, no outline): the camera flash.
 * - `ring/hazard/avg-sign` (2: start, end) — the blue average-speed-zone sign on its post (a camera
 *   pictogram, TRAJECT / CONTROLE at 2× and 4×); `ring/hazard/avg-icon` (1): the small screen icon
 *   of the running zone.
 */
import type { Color } from '../../../../engine/color';
import { INK } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { glyphHitC } from '../traffic/lettering';
import { BEAM_H, FAR_P, NEAR_P, SIGN_FACES, SIGN_H, SIGN_W, slantX } from './geometry';

type Pt = [number, number];

function frameOf(buf: Frame['buf'], ox: number, oy: number, d: Dn): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

const frac = (v: number): number => v - Math.floor(v);

// ---------------------------------------------------------------------------------------------
// The gantry
// ---------------------------------------------------------------------------------------------

/** Truss canvas (local to the near post's foot): x −38 … 33, y −174 … 3. */
const TX0 = -38;
const TY0 = -174;

/** A local truss point over plane y p at height h. */
function trussPt(p: number, h: number): Pt {
  return [slantX(p) - TX0, p - NEAR_P - h - TY0];
}

export function trussFrame(d: Dn): Frame {
  const c = new HdCanvas(71, 177, d);
  const steel = mat(c, 'steel', { spec: 0.9, shine: 30, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.3 });
  const steelDk = mat(c, 'steel', { spec: 0.6, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const concrete = mat(c, 'stone', { spec: 0.1, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  // The box girder seen a little from above: the front face (a top and a bottom chord with a
  // lattice web between them) and the top face (a grating walkway back to the far top chord).
  const ht = BEAM_H + 6;
  const hb = BEAM_H - 6;
  const back = 3.2;
  const [ax, ay] = trussPt(FAR_P, ht);
  const [bx, by] = trussPt(NEAR_P, ht);
  const [cx, cy] = trussPt(FAR_P, hb);
  const [dx, dy] = trussPt(NEAR_P, hb);
  const grate = mat(c, 'steel', { spec: 0.4, shine: 18, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  c.poly([[ax, ay], [bx, by], [bx + back, by - back], [ax + back, ay - back]], {
    mat: grate,
    z: 1,
    round: 0,
    tex: (t) => {
      // Grating bars across the walkway.
      const u = (t.x - bx) * 0.6 + (t.y - by) * 0.8;
      if (frac(u / 1.6) < 0.4) t.tone -= 0.4;
    },
  });
  c.capsule(ax + back, ay - back, bx + back, by - back, 0.9, 0.9, { mat: steelDk, z: 1.2 });
  c.capsule(ax, ay, bx, by, 1.4, 1.4, { mat: steel, z: 3 });
  c.capsule(cx, cy, dx, dy, 1.4, 1.4, { mat: steel, z: 3 });
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const p0 = FAR_P + ((NEAR_P - FAR_P) * i) / n;
    const p1 = FAR_P + ((NEAR_P - FAR_P) * (i + 0.5)) / n;
    const [x0, y0] = trussPt(p0, ht);
    const [x1, y1] = trussPt(p0, hb);
    c.capsule(x0, y0, x1, y1, 0.75, 0.75, { mat: steel, z: 2.4 });
    if (i < n) {
      const [x2, y2] = trussPt(p1, ht);
      const [x3, y3] = trussPt(FAR_P + ((NEAR_P - FAR_P) * (i + 1)) / n, hb);
      c.capsule(x1, y1, x2, y2, 0.6, 0.6, { mat: steelDk, z: 2.2 });
      c.capsule(x2, y2, x3, y3, 0.6, 0.6, { mat: steelDk, z: 2.2 });
    }
  }
  // The near post: an I-beam column on a concrete foot, its cap plate under the beam.
  const [px] = trussPt(NEAR_P, 0);
  const foot = 0 - TY0;
  c.box(px - 2.4, by + 1, 4.8, foot - by - 3, {
    mat: steel,
    z: 4,
    r: 0.3,
    tex: (t) => {
      const u = t.x - (px - 2.4);
      if (u > 1.4 && u < 3.4) t.tone -= 0.35;
    },
  });
  c.box(px - 3.2, by - 1.2, 6.4, 2.6, { mat: steel, z: 4.4, r: 0.4, bevel: 0.5 });
  c.box(px - 3.6, foot - 3.6, 7.2, 3.6, { mat: concrete, z: 4.2, r: 0.6, bevel: 0.7 });
  // Bolts on the foot plate (4×).
  if (d === 4) for (const bx2 of [-2.4, 1.6]) c.dot(px + bx2, foot - 3, top('steel', d, 1));
  const buf = finishA(c, 0.3);
  return frameOf(buf, -TX0, -TY0, d);
}

/** The far post (on the median), anchored at its own foot. */
export function farPostFrame(d: Dn): Frame {
  const c = new HdCanvas(12, 76, d);
  const steel = mat(c, 'steel', { spec: 0.8, shine: 28, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.2 });
  const concrete = mat(c, 'stone', { spec: 0.1, lo1: 1, hi1: 2, lo: 2, hi: 5 });
  // Local: the foot at (6, 73); the post rises BEAM_H + 4.
  const fx = 6;
  const fy = 73;
  c.box(fx - 2.2, fy - BEAM_H - 6.5, 4.4, BEAM_H + 4, { mat: steel, z: 2, r: 0.3 });
  c.box(fx - 3.2, fy - 3, 6.4, 3, { mat: concrete, z: 2.2, r: 0.5, bevel: 0.6 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, fx, fy, d);
}

/** Is (x, y) on the face of `face`, relative to the face centre (u, v)? Returns the LED colour or 0. */
function faceAt(face: string, u: number, v: number, d: number): Color {
  const red = top('red', d, 1);
  const white = top('snow', d, 0);
  if (face === 'x') {
    const w = 1.1;
    if (Math.abs(u) < 5.2 && Math.abs(v) < 5.2 && (Math.abs(u - v) < w || Math.abs(u + v) < w)) return red;
    return 0;
  }
  if (face === 'arrow-far' || face === 'arrow-near') {
    // A diagonal arrow pointing up-right (far) or down-right (near), head at its tip.
    const s = face === 'arrow-far' ? -1 : 1;
    const q = u;
    const r = v * s;
    // Shaft along u = r from (−4, −4) to (3, 3).
    const along = (q + r) / Math.SQRT2;
    const across = (q - r) / Math.SQRT2;
    if (along > -5.6 && along < 3.2 && Math.abs(across) < 0.95) return white;
    // The head: two strokes back from the tip (4.5, 4.5) along the axes.
    if (q > -0.2 && q < 4.6 && r > 3.4 && r < 4.9 && q < r + 0.6) return white;
    if (r > -0.2 && r < 4.6 && q > 3.4 && q < 4.9 && r < q + 0.6) return white;
    return 0;
  }
  if (face === '50' || face === '80' || face === '100') {
    const rr = Math.hypot(u, v);
    if (rr > 5.6 && rr < 7.0) return red;
    const s = d === 1 ? 1 : face === '100' ? 0.72 : 0.85;
    const gap = face === '100' && d === 1 ? 0.34 : 1;
    if (rr < 5.4 && glyphHitC(face === '100' && d === 1 ? '100' : face, 0, 0, s, gap, u + (d === 1 ? 0.5 : 0), v + (d === 1 ? 0.5 : 0))) return white;
    return 0;
  }
  if (face === 'end') {
    const rr = Math.hypot(u, v);
    if (rr > 5.6 && rr < 6.7) return white;
    // The diagonal band of strokes.
    const along = (u - v) / Math.SQRT2;
    const across = (u + v) / Math.SQRT2;
    if (rr < 5.6 && Math.abs(across) < 2.6 && frac((along + 6) / 2.2) < 0.45) return white;
    return 0;
  }
  return 0;
}

/** The matrix sign showing `face`, centre anchor. */
export function signFrame(face: string, d: Dn): Frame {
  const n = SIGN_W + 2;
  const m = SIGN_H + 2;
  const c = new HdCanvas(n, m, d);
  const housing = mat(c, 'black', { spec: 0.6, shine: 30, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const frame = mat(c, 'steel', { spec: 1, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const cx = n / 2;
  const cy = m / 2;
  c.box(1, 1, SIGN_W, SIGN_H, { mat: frame, z: 1, r: 0.8, bevel: 0.7 });
  c.box(2.2, 2.2, SIGN_W - 2.4, SIGN_H - 2.4, { mat: housing, z: 8, round: 0.2 });
  const dim = bot('black', d, d === 1 ? 1 : 2);
  c.paint(2.2, 2.2, SIGN_W - 2.4, SIGN_H - 2.4, (x, y, X, Y) => {
    const col = faceAt(face, x - cx, y - cy, d);
    // At 4× the face is a grid of LEDs (a dark gap every other art px both ways), the dark LEDs
    // faintly visible.
    if (d === 4 && X % 2 === 1 && Y % 2 === 1) return 0;
    if (col) return col;
    return d === 4 && (X + Y) % 2 === 0 ? dim : 0;
  }, 9);
  const buf = finishA(c, 0.2);
  return frameOf(buf, Math.floor(cx), Math.floor(cy), d);
}

/** An amber corner flasher, off (0) or on (1), centre anchor. */
export function flasherFrame(on: number, d: Dn): Frame {
  const c = new HdCanvas(5, 5, d);
  const lamp = mat(c, on ? 'gold' : 'orange', { spec: 1, shine: 50, lo1: on ? 2 : 0, hi1: on ? 3 : 0, lo: on ? 5 : 0, hi: on ? 7 : 1, flat: on === 1 });
  c.ellipsoid(2.5, 2.5, 1.5, 1.5, { mat: lamp, z: 1 });
  if (on && d > 1) c.dot(2.2, 2.2, top('snow', d));
  const buf = finishA(c, 0);
  return frameOf(buf, 2, 2, d);
}

// ---------------------------------------------------------------------------------------------
// Cones, the arrow trailer, the absorber truck
// ---------------------------------------------------------------------------------------------

/** A traffic cone (feet anchor); f 1–3 tumbling (45°, 90°, 135°). */
export function coneFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(15, 15, d);
  const orange = mat(c, 'orange', { spec: 0.5, shine: 22, lo1: 0, hi1: 1, lo: 1, hi: 5 });
  const white = mat(c, 'snow', { spec: 1.1, shine: 50, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const foot = mat(c, 'black', { spec: 0.3, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const a = (f * 45 * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  // Pivot: the cone's middle (7.5, 8.5) standing, its foot on row 13.
  const mx = 7.5;
  const my = f === 0 ? 8.5 : 7.5;
  const P = (u: number, v: number): Pt => [mx + u * cs - v * sn, my + u * sn + v * cs];
  c.poly([P(-3.2, 3.2), P(3.2, 3.2), P(0.8, -5.2), P(-0.8, -5.2)], {
    mat: orange,
    z: 1,
    tex: (t) => {
      const v = (t.x - mx) * -sn + (t.y - my) * cs;
      if ((v > -2.8 && v < -1.5) || (v > 0.2 && v < 1.6)) t.mat = white;
    },
  });
  c.poly([P(-4.2, 3.2), P(4.2, 3.2), P(4.2, 4.6), P(-4.2, 4.6)], { mat: foot, z: 1.4 });
  const buf = finishA(c, 0.25);
  return frameOf(buf, 7, 13, d);
}

/** The arrow trailer (feet anchor at its middle): one axle, a mast, the board's frame. */
export function trailerFrame(d: Dn): Frame {
  const c = new HdCanvas(30, 38, d);
  const yellow = mat(c, 'gold', { spec: 0.6, shine: 30, lo1: 0, hi1: 2, lo: 2, hi: 6 });
  const steel = mat(c, 'steel', { spec: 0.8, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const tyre = mat(c, 'black', { spec: 0.3, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const board = mat(c, 'black', { spec: 0.5, shine: 28, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const ax = 15;
  const ay = 35;
  // The chassis box, a tow bar forward, the wheel, a jockey leg.
  c.box(ax - 9, ay - 8, 17, 4, {
    mat: yellow,
    z: 2,
    r: 0.6,
    bevel: 0.6,
    tex: (t) => {
      // Red-white chevrons on the rear face of the box (the closure's warning).
      const u = t.x - (ax - 9);
      if (u < 4 && frac((t.x + t.y) / 2.2) < 0.5) t.mat = steel;
    },
  });
  c.capsule(ax + 8, ay - 6, ax + 13, ay - 5, 0.6, 0.6, { mat: steel, z: 1.8 });
  c.ellipsoid(ax, ay - 3.2, 3.2, 3.2, { mat: tyre, z: 2.6 });
  c.ellipsoid(ax, ay - 3.2, 1.3, 1.3, { mat: steel, z: 2.8 });
  c.capsule(ax + 12, ay - 5, ax + 12, ay - 0.6, 0.5, 0.5, { mat: steel, z: 1.6 });
  // The mast and the board's frame (the face is `ring/hazard/arrow-board`).
  c.box(ax - 1, ay - 22, 2, 14, { mat: steel, z: 1.5, r: 0.3 });
  c.box(ax - 12, ay - 34, 24, 14, { mat: board, z: 2, r: 0.8, bevel: 0.6 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, ax, ay, d);
}

/** The arrow board's face: 0 dark, 1 arrow to the far lane, 2 to the near lane (centre anchor). */
export function boardFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(22, 12, d);
  const amber = top('gold', d, d === 1 ? 0 : 1);
  const dim = bot('orange', d, 0);
  c.paint(0.6, 0.6, 20.8, 10.8, (x, y, X, Y) => {
    if (d === 4 && (X % 2 === 1 || Y % 2 === 1)) return 0;
    const u = x - 11;
    const v = (y - 6) * (f === 2 ? -1 : 1);
    // A wide arrow: a shaft pointing right and up (to the far lane) with its head.
    const on = f !== 0 && ((Math.abs(v + u * 0.32) < 1.2 && u > -8 && u < 4.5) || (u >= 2.6 && u < 8.4 && Math.abs(v + 2.4 * 0.6 + (u - 2.6) * 0.08) < 4.8 - (u - 2.6) * 0.82));
    if (on) return amber;
    return d === 1 ? 0 : dim;
  });
  const buf = c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false });
  return frameOf(buf, 11, 6, d);
}

/** A rolled edge: height over distance e from an edge with roll radius r. */
function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/**
 * The crash-absorber truck (feet anchor at its middle); `beacon` = which beacon is lit: a yellow
 * cab with the driver behind the glass, a flat body with a red-white chevron band, the cushion at
 * the rear with big red-white chevrons, the amber beacon bar (no logo).
 */
export function absorberFrame(beacon: number, d: Dn): Frame {
  const c = new HdCanvas(86, 46, d);
  const ax = 43;
  const ay = 43;
  const yellow = mat(c, 'gold', { spec: 0.9, shine: 40, lo1: 0, hi1: 2, lo: 3, hi: 6, rim: 0.3, bounce: 0.3 });
  const red = mat(c, 'red', { spec: 0.5, shine: 30, lo1: 1, hi1: 2, lo: 3, hi: 6 });
  const white = mat(c, 'snow', { spec: 0.6, shine: 30, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const glass = mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 });
  const black = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const plastic = mat(c, 'slate', { spec: 0.25, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const steel = mat(c, 'steel', { spec: 1.1, shine: 46, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.3 });
  const tyre = mat(c, 'black', { spec: 0.35, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const lampOn = mat(c, 'gold', { flat: true, lo1: 3, hi1: 3, lo: 6, hi: 7 });
  const lampOff = mat(c, 'orange', { spec: 0.6, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const head = mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const X = (x: number): number => x + ax;
  const Y = (y: number): number => y + ay;
  const field = (x0: number, y0: number, w: number, h: number, hf: (x: number, y: number) => number, o: { mat: number; z: number; tex?: (t: { x: number; y: number; tone: number; mat: number }) => void }): void => {
    c.heightField(X(x0), Y(y0), w, h, (cx, cy) => hf(cx - ax, cy - ay), {
      mat: o.mat,
      z: o.z,
      tex: o.tex
        ? (t) => {
            const lx = t.x;
            const ly = t.y;
            t.x = lx - ax;
            t.y = ly - ay;
            o.tex?.(t);
            t.x = lx;
            t.y = ly;
          }
        : null,
    });
  };
  const wheels = [-17, 28];
  const wr = 5.5;
  const nearWheel = (x: number, y: number): number => Math.min(...wheels.map((wx) => Math.hypot(x - wx - 0.5, y + wr)));
  // The cab: a rolled volume; the door seam; the glass with the driver; the mirror; the grille.
  const cab: Array<[number, number]> = [[12, -5], [12, -34], [14.4, -36], [30, -36], [33, -34], [38.6, -22.4], [41.4, -20.4], [42.2, -12], [42, -5], [40, -3.4], [13, -3.4]];
  const win: Array<[number, number]> = [[24, -21.8], [24, -32.4], [31.2, -32.4], [36.4, -21.8]];
  field(11, -37, 32, 34, (x, y) => {
    if (!inPoly(x, y, cab) || inPoly(x, y, win) || nearWheel(x, y) < wr + 1.1) return NaN;
    let h = roll(Math.min(polyDist(x, y, cab), nearWheel(x, y) - wr - 1.1 + 0.4), 2.2);
    if (y > -8) h -= (y + 8) * 0.4;
    return h;
  }, {
    mat: yellow,
    z: 2,
    tex: (t) => {
      if (Math.abs(t.x - 22.6) < (d === 1 ? 0.5 : 0.22) && t.y > -33 && t.y < -6) t.tone -= 0.7;
      if (t.y > -15 && t.y < -12.6 && t.x > 13 && t.x < 41) t.mat = frac((t.x - t.y) / 3.2) < 0.5 ? red : white;
    },
  });
  field(23.5, -33, 13.5, 12, (x, y) => (inPoly(x, y, win) ? (y + 33) * 0.12 : NaN), {
    mat: glass,
    z: 2.1,
    tex: (t) => {
      const hx = t.x - 28.4;
      const hy = t.y + 26.6;
      if (hx * hx / 4.4 + hy * hy / 6.2 < 1 || (t.y > -24 && Math.abs(hx + 0.6) < 3.6)) t.tone -= 0.6;
      if (frac((t.x + (t.y + 21) * 0.7) / 10) < 0.12) t.tone += 0.9;
    },
  });
  c.box(X(23.6), Y(-33), 1.2, 11.4, { mat: black, z: 3.4, r: 0.3 });
  c.ellipsoid(X(39.4), Y(-24.4), 1.6, 1.2, { mat: black, z: 5 });
  c.capsule(X(38.2), Y(-23.6), X(36.6), Y(-22.6), 0.4, 0.4, { mat: black, z: 4.8 });
  c.box(X(39.6), Y(-18.6), 3, 2.6, { mat: head, z: 4.2, r: 0.5, bevel: 0.4 });
  c.box(X(37.6), Y(-10.6), 5, 6.2, { mat: plastic, z: 4, r: 0.5 });
  c.box(X(29.6), Y(-19.6), 2.2, 0.9, { mat: black, z: 4, r: 0.2 });
  // The flat body behind the cab: rolled edges, a red-white chevron band.
  const bed: Array<[number, number]> = [[-27, -5.6], [-27, -20], [11, -20], [11, -5.6]];
  field(-27.5, -20.5, 39, 15.5, (x, y) => (inPoly(x, y, bed) && nearWheel(x, y) >= wr + 1.1 ? roll(Math.min(polyDist(x, y, bed), nearWheel(x, y) - wr - 0.7), 1.6) : NaN), {
    mat: yellow,
    z: 2,
    tex: (t) => {
      if (t.y > -15.2 && t.y < -10.6) t.mat = frac((t.x - t.y) / 3.2) < 0.5 ? red : white;
    },
  });
  // The cushion at the rear: big chevrons in a black frame.
  const cush: Array<[number, number]> = [[-41.6, -8], [-41.6, -27], [-27, -27], [-27, -8]];
  field(-42, -27.5, 15.5, 20, (x, y) => (inPoly(x, y, cush) ? roll(polyDist(x, y, cush), 1.4) + 0.6 : NaN), {
    mat: white,
    z: 2.4,
    tex: (t) => {
      const u = t.x + 34.3;
      const v = t.y + 17.5;
      if (frac((Math.abs(v) * 0.9 + u) / 5) < 0.5) t.mat = red;
    },
  });
  c.box(X(-42.2), Y(-28), 1.6, 21, { mat: black, z: 4, r: 0.3 });
  c.box(X(-27.6), Y(-28), 1.4, 21, { mat: black, z: 4, r: 0.3 });
  // The chassis, the wheels (tyre, steel rim, hub), the beacon bar on the cab roof.
  c.box(X(-30), Y(-7.2), 72, 2.8, { mat: black, z: 1.4, r: 0.3 });
  for (const wx of wheels) {
    const cx = X(wx + 0.5);
    const cy = Y(-wr);
    c.ellipsoid(cx, cy, wr, wr, { mat: tyre, z: 6, round: 0.45 });
    c.ellipsoid(cx, cy, wr * 0.58, wr * 0.58, {
      mat: steel,
      z: 6 + wr + 1,
      round: 0.5,
      tex: (t) => {
        const a = Math.atan2(t.y - cy, t.x - cx);
        const r = Math.hypot(t.x - cx, t.y - cy);
        if (r > wr * 0.25 && r < wr * 0.48 && frac((a / (Math.PI * 2)) * 6) < 0.45) t.tone -= 0.8;
      },
    });
  }
  c.box(X(15), Y(-38.6), 16, 2.4, { mat: black, z: 3, r: 0.5 });
  c.ellipsoid(X(17.4), Y(-39.2), 2, 1.7, { mat: beacon === 0 ? lampOn : lampOff, z: 4 });
  c.ellipsoid(X(28.6), Y(-39.2), 2, 1.7, { mat: beacon === 1 ? lampOn : lampOff, z: 4 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, ax, ay, d);
}

// ---------------------------------------------------------------------------------------------
// Speed camera and the average-speed zone
// ---------------------------------------------------------------------------------------------

/** The speed camera on its post (feet anchor): 0 idle, 1 the red LED lit, 2 the flash window lit. */
export function speedcamFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(18, 50, d);
  const ax = 9;
  const ay = 47;
  const grey = mat(c, 'stone', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const steel = mat(c, 'steel', { spec: 0.8, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const glass = mat(c, 'slate', { spec: 1.3, shine: 70, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const flashOn = mat(c, 'snow', { flat: true, lo1: 3, hi1: 3, lo: 6, hi: 6 });
  const flashOff = mat(c, 'slate', { spec: 1, lo1: 1, hi1: 2, lo: 2, hi: 4 });
  // The post and its foot.
  c.cylinder(ax - 1.4, ay - 34, 2.8, 34, { mat: steel, z: 1 });
  c.box(ax - 3, ay - 1.6, 6, 1.6, { mat: steel, z: 1.2, r: 0.3 });
  // The camera box (seen from its side, the lens toward the traffic behind: left).
  c.box(ax - 6, ay - 44, 12, 11, { mat: grey, z: 2, r: 1, bevel: 0.9 });
  c.ellipsoid(ax - 5, ay - 39, 2.4, 2.4, { mat: glass, z: 2.6 });
  c.box(ax - 2, ay - 43, 6, 2.6, { mat: f === 2 ? flashOn : flashOff, z: 2.4, r: 0.5 });
  const led = f >= 1 ? top('red', d, d === 1 ? 0 : 1) : bot('red', d, 1);
  c.paint(ax + 3, ay - 37.5, 2, 2, (x, y) => (Math.hypot(x - (ax + 4), y - (ay - 36.5)) < 0.75 ? led : 0), 5);
  const buf = finishA(c, 0.3);
  return frameOf(buf, ax, ay, d);
}

/** The camera flash (centre anchor, no outline): a white burst that shrinks. */
export function flashFrame(f: number, d: Dn): Frame {
  const n = 29;
  const k = 14;
  const c = new HdCanvas(n, n, d);
  const core = top('snow', d);
  const ray = top('gold', d, d === 1 ? 0 : 1);
  const outer = top('snow', d, d === 1 ? 1 : 2);
  const R = [12, 9, 5][f];
  c.paint(0, 0, n, n, (x, y) => {
    const dx = x - (k + 0.5);
    const dy = y - (k + 0.5);
    const r = Math.hypot(dx, dy);
    if (r < R * 0.35) return core;
    if (r < R * 0.5) return outer;
    const a = Math.atan2(dy, dx);
    const spoke = Math.abs(Math.sin(a * 4));
    if (r < R && spoke < 0.12 + (R - r) / R * 0.1) return ray;
    return 0;
  });
  const buf = c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false });
  return frameOf(buf, k, k, d);
}

/** The average-speed zone sign on its post (feet anchor): 0 start, 1 end (a red bar across). */
export function avgSignFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(30, 44, d);
  const ax = 15;
  const ay = 41;
  const blue = mat(c, 'sky', { spec: 0.5, shine: 30, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const steel = mat(c, 'steel', { spec: 0.8, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  c.cylinder(ax - 1, ay - 24, 2, 24, { mat: steel, z: 1 });
  c.box(ax - 13, ay - 40, 26, 17, { mat: blue, z: 2, r: 1.2, bevel: 0.6 });
  const white = top('snow', d, d === 1 ? 0 : 1);
  const red = top('red', d, d === 1 ? 1 : 2);
  const x0 = ax - 13;
  const y0 = ay - 40;
  c.paint(x0, y0, 26, 17, (x, y) => {
    const u = x - x0;
    const v = y - y0;
    // White border.
    if (u < 1.4 || u > 24.6 || v < 1.4 || v > 15.6) return u > 0.6 && u < 25.4 && v > 0.6 && v < 16.4 ? white : 0;
    if (f === 1 && Math.abs(u - (26 - v * 1.4)) < 1.3) return red;
    // A camera pictogram on the left.
    if (u > 3 && u < 9.6 && v > 5.4 && v < 10.6) return Math.hypot(u - 6.3, v - 8) < 1.4 ? 0 : white;
    if (u > 4.6 && u < 7 && v > 4.2 && v <= 5.4) return white;
    // The text: TRAJECT / CONTROLE (dense) or two print lines (1×).
    if (d === 1) return (v === 5.5 || v === 9.5) && u > 11 && u < 23 && Math.floor(u) % 3 !== 2 ? white : 0;
    if (glyphHitC('TRAJECT', 17.2 + x0 - x0, 6.2, 0.42, 0.9, u, v)) return white;
    if (glyphHitC('CONTROLE', 17.2, 10.8, 0.36, 0.9, u, v)) return white;
    return 0;
  });
  const buf = finishA(c, 0.25);
  return frameOf(buf, ax, ay, d);
}

/** The small zone icon (centre anchor): a blue tile with the camera pictogram. */
export function avgIconFrame(d: Dn): Frame {
  const c = new HdCanvas(15, 13, d);
  const blue = mat(c, 'sky', { spec: 0.5, shine: 30, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  c.box(1, 1, 13, 11, { mat: blue, z: 1, r: 1.4, bevel: 0.6 });
  const white = top('snow', d, d === 1 ? 0 : 1);
  c.paint(1, 1, 13, 11, (x, y) => {
    if (x > 3.4 && x < 11.6 && y > 4.6 && y < 9.6) return Math.hypot(x - 7.5, y - 7.1) < 1.6 ? 0 : white;
    if (x > 5 && x < 8 && y > 3.4 && y <= 4.6) return white;
    return 0;
  });
  const buf = finishA(c, 0.2);
  return frameOf(buf, 7, 6, d);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const F = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const def = (id: string, gen: (d: Dn) => Frame[], o: { ticksPerFrame?: number; defer?: boolean } = {}): void =>
  defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d as Dn) });

def('ring/hazard/gantry-truss', (d) => [trussFrame(d)]);
def('ring/hazard/gantry-post', (d) => [farPostFrame(d)]);
def('ring/hazard/sign', (d) => SIGN_FACES.map((face) => signFrame(face, d)));
def('ring/hazard/flasher', (d) => [0, 1].map((on) => flasherFrame(on, d)));
def('ring/hazard/cone', (d) => F(4).map((f) => coneFrame(f, d)), { ticksPerFrame: 4 });
def('ring/hazard/arrow-trailer', (d) => [trailerFrame(d)]);
def('ring/hazard/arrow-board', (d) => F(3).map((f) => boardFrame(f, d)));
def('ring/hazard/absorber', (d) => [0, 1].map((b) => absorberFrame(b, d)), { ticksPerFrame: 12 });
def('ring/hazard/speedcam', (d) => F(3).map((f) => speedcamFrame(f, d)));
def('ring/hazard/flash', (d) => F(3).map((f) => flashFrame(f, d)), { ticksPerFrame: 3 });
def('ring/hazard/avg-sign', (d) => [0, 1].map((f) => avgSignFrame(f, d)));
def('ring/hazard/avg-icon', (d) => [avgIconFrame(d)]);
