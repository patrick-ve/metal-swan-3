/**
 * UHD art (d 2 and 4) of `decor/ams/stopera` (1× art in art.ts `stopera`): the boss arena of
 * section d — the curved white marble-and-glass music theatre (left) with its ribbed fly tower,
 * and the red-brick city hall (right) whose big glass doors under the white canopy ROBO-HALSEMA
 * steps out of, the STADHUIS plaque over them and the steps.
 *
 * A direct per-art-px painter (`Facade`: about 1 Mpx at 4×, so no G-buffer), with the light
 * modelled by hand: the theatre front is a drum in plan, lit on the left and turning away into
 * shade on the right; marble ledges with a lit top face, veined slabs, a rounded lower edge and a
 * dark soffit casting shadow on the glass; curtain-wall glass reflecting the sunset (lighter at
 * the top of each storey, glossy pink streaks, a few warm lit panes) between lit steel mullions;
 * brick in running bond with recessed mortar, per-brick tone, soot and damp, white stone bands
 * casting a shadow; recessed windows (reveal shadow, glazing bars, glints, stone sills); the
 * canopy's shadow on the doors; the lobby glowing warm behind the door glass. Outline C (static
 * decor): the deepest tone on the lit side, ink on the shadow side. Same footprint and anchor as
 * the 1× frame (386 × 169, ox 1, oy 169).
 */
import type { Color } from '../../../../engine/color';
import { measure } from '../../../../engine/font';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { hash2 } from '../../../art/paint';
import { band, Facade, textMask } from './art-hd-cd-kit';

const ID = 'decor/ams/stopera';
const W = 386;
const H = 169;
const BASE = 168;
/** Theatre / city hall split, the doors' centre (as at 1×). */
const TX1 = 230;
const DX = 294;

const MARBLE: Ramp = PAL_HD.gable;
const GLASS: Ramp = PAL_HD.purple;
const PINK: Ramp = PAL_HD.pink;
const STEEL: Ramp = PAL_HD.steel;
const BRICK: Ramp = PAL_HD.red;
const STONE: Ramp = PAL_HD.stone;
const NAVY: Ramp = PAL_HD.navy;
const SKY: Ramp = PAL_HD.sky;
const GOLD: Ramp = PAL_HD.gold;
const INK: Color = PAL_HD.ink[0];

/** The theatre's top edge at logical x (the 1× curve, smooth). */
function theatreTop(x: number): number {
  const t = (x - 1) / (TX1 - 2);
  return 30 + (t - 0.45) * (t - 0.45) * 70;
}

/** Light of the curved theatre front at logical x: 1 facing the key light (left) … 0 turned away (right). */
function drumLight(x: number): number {
  const t = (x - 1) / (TX1 - 2);
  const phi = -0.45 + 1.55 * t;
  const k = -0.55 * Math.sin(phi) + 0.6 * Math.cos(phi);
  const l = (k + 0.25) / 1.05;
  return l < 0 ? 0 : l > 1 ? 1 : l;
}

/** Cheap marble vein field (thin wandering lines). */
function vein(x: number, y: number, k: number): number {
  return Math.abs(Math.sin(x * 0.55 + 2.1 * Math.sin(y * 0.8 + x * 0.11 + k * 1.7) + k * 2.3));
}

/** The theatre (x < TX1): marble ledges and the glass curtain wall (top, L: the column's curve and light). Returns 0 above the curve. */
function theatre(x: number, y: number, X: number, Y: number, d: number, top: number, L: number): Color {
  if (y < top) return 0;
  const row = y - top;
  const k = Math.floor(row / 26);
  const b = row - k * 26;
  const e = 1 / d;
  if (b < 9) {
    // The marble ledge.
    if (b < 0.75) return L > 0.35 ? MARBLE[6] : MARBLE[5];
    if (b < 6.6) {
      // The slab face: lit by the drum, veined, joints every 11 px (staggered per storey).
      const fx = (x + k * 5) % 11;
      if (fx < e) return MARBLE[2];
      let t = 0.3 + 0.62 * L - (b - 0.75) * 0.025;
      if (fx < 2 * e) t += 0.12;
      if (vein(x * (d >= 4 ? 1 : 0.7), y, k) < (d >= 4 ? 0.05 : 0.035)) t -= 0.13;
      return band(MARBLE, t, X, Y, 2, 6, 0.2);
    }
    if (b < 7.15) return L > 0.5 ? MARBLE[3] : MARBLE[2];
    // The soffit under the ledge, then its shadow line on the glass head.
    return b < 8.3 ? MARBLE[1] : MARBLE[0];
  }
  const g = b - 9;
  // Steel mullions every 12 px (lit left edge, shadow right), the transom bar.
  const fx = x - Math.floor(x / 12) * 12;
  if (fx < 1) {
    if (fx < e) return L > 0.3 ? STEEL[5] : STEEL[4];
    if (fx >= 1 - e) return STEEL[1];
    return L > 0.5 ? STEEL[3] : STEEL[2];
  }
  if (g >= 8 && g < 9) {
    if (g < 8 + e) return STEEL[L > 0.3 ? 5 : 4];
    if (g >= 9 - e) return STEEL[1];
    return STEEL[L > 0.5 ? 3 : 2];
  }
  // The ledge's shadow on the top of the glass.
  if (g < 1.3) return GLASS[0];
  // A few panes lit warm from inside (the lobby at sunset), low panes only.
  const pane = Math.floor(x / 12);
  const lower = g > 9;
  if (lower && L > 0.15 && hash2(pane, k, 77) > 0.9) {
    // The lit foyer behind the glass: warm, brightest under the ceiling, a dark balustrade low down.
    if (g > 15.2 && g < 15.9) return GOLD[1];
    return band(GOLD, 0.82 - (g - 9) * 0.06 - Math.abs(x - pane * 12 - 6.5) * 0.02, X, Y, 2, 6, 0.25);
  }
  // Reflections: the sky lighter at the top of each storey, a glossy diagonal sunset streak.
  const s = (x + row * 2) % 72;
  if (L > 0.22 && s < 5.4) {
    const c = Math.abs(s - 2.7) / 2.7;
    return c < 0.45 ? PINK[5] : c < 0.8 ? PINK[3] : PINK[2];
  }
  const lowP = g > 9 ? g - 9 : g - 1.3;
  let t = 0.25 + 0.55 * L - lowP * 0.035 + (g < 8 ? 0.08 : -0.05);
  // Soft cloud reflection blobs.
  t += (Math.sin(x * 0.07 + k) * Math.sin(row * 0.11 + x * 0.013) - 0.2) * 0.12;
  return band(GLASS, t, X, Y, 1, 5, 0.22);
}

/** The fly tower behind the theatre: ribbed white cladding with standing seams. */
function flyTower(x: number, y: number, X: number, Y: number, d: number): Color {
  if (x < 60 || x >= 150 || y < 10 || y >= 32) return 0;
  const e = 1 / d;
  if (y < 10.75) return MARBLE[6];
  if (y < 11.3) return MARBLE[4];
  if (x < 60 + e) return MARBLE[5];
  if (x >= 150 - e) return MARBLE[1];
  const fx = (x - 64 + 64) % 8;
  if (fx < e) return MARBLE[1];
  if (fx < 0.6) return MARBLE[5];
  if (fx < 1.1) return MARBLE[2];
  // The panel face, slightly darker down towards the theatre roof.
  return band(MARBLE, 0.7 - (y - 11) * 0.02 - fx * 0.012, X, Y, 2, 5, 0.2);
}

/** Window grid of the city hall (as at 1×): columns from x 238 every 18 px, rows y 30, 60, 90. */
const WIN_X0 = TX1 + 8;
const WIN_COLS = Math.ceil((W - 2 - 8 - WIN_X0) / 18);
const WIN_ROWS = Math.ceil((BASE - 60 - 30) / 30);

/** A recessed city-hall window (12 × 16) with its sill, or 0. */
function hallWindow(x: number, y: number, X: number, Y: number, d: number): Color {
  const e = 1 / d;
  const ci = Math.floor((x + 0.5 - WIN_X0) / 18);
  const ri = Math.floor((y - 30) / 30);
  if (ci < 0 || ci >= WIN_COLS || ri < 0 || ri >= WIN_ROWS) return 0;
  {
    const w = { x: WIN_X0 + ci * 18, y: 30 + ri * 30 };
    if (x < w.x - 0.5 || x >= w.x + 12.5 || y < w.y || y >= w.y + 17.6) return 0;
    const u = x - w.x;
    const v = y - w.y;
    // The stone sill and its shadow on the brick.
    if (v >= 16) {
      if (v < 16 + e) return STONE[6];
      if (v < 16.9) return STONE[4];
      return 0;
    }
    if (u < 0 || u >= 12) return 0;
    // The steel frame: lit top / left edges.
    if (u < 0.75 || u >= 11.25 || v < 0.75 || v >= 15.25) {
      if (u < e || v < e) return STEEL[5];
      if (u >= 12 - e || v >= 16 - e) return STEEL[1];
      return STEEL[3];
    }
    // Glazing bars.
    if (Math.abs(u - 6) < 0.25 + e * 0.5 || Math.abs(v - 8) < 0.25 + e * 0.5) {
      return Math.abs(u - 6) < 0.25 + e * 0.5 ? (u < 6 ? STEEL[4] : STEEL[2]) : v < 8 ? STEEL[4] : STEEL[2];
    }
    // The reveal's shadow inside the frame (top and left), then the glass.
    if (v < 2 || u < 1.6) return NAVY[1];
    const sheen = (u + v * 0.7) % 9;
    if (sheen < 1.2 && v < 8) return SKY[3];
    if (u < 2.4 && v < 3) return SKY[6];
    return band(NAVY, 0.75 - v * 0.035 + (v < 8 ? 0.1 : 0), X, Y, 1, 4, 0.2);
  }
  return 0;
}

/** The city hall wing (x ≥ TX1): brick, white bands, windows, canopy, doors, plaque, steps. */
function hall(x: number, y: number, X: number, Y: number, d: number, plaque: { x0: number; x1: number }, mask: Uint8Array): Color {
  if (y < 22) return 0;
  const e = 1 / d;
  // Steps.
  if (x >= DX - 52 && x < DX + 52 && y >= BASE - 3) {
    const s = y - (BASE - 3);
    if (s < e) return STONE[6];
    if (s < 1.9) return band(STONE, 0.75 - s * 0.15, X, Y, 3, 6);
    if (s < 2 + e) return STONE[6];
    if (s < 2.5) return STONE[5];
    return band(STONE, 0.5 - (s - 2.5) * 0.2, X, Y, 2, 5);
  }
  // The canopy over the doors: a lit top face, its front, the steel underside.
  if (x >= DX - 46 && x < DX + 46 && y >= BASE - 106 && y < BASE - 101) {
    const s = y - (BASE - 106);
    if (x < DX - 46 + e) return MARBLE[6];
    if (s < 0.75) return MARBLE[6];
    if (s < 3.6) return band(MARBLE, 0.85 - s * 0.08, X, Y, 3, 6, 0.2);
    if (s < 4) return MARBLE[2];
    return s < 4 + e ? STEEL[4] : STEEL[2];
  }
  // The plaque over the doors.
  if (x >= plaque.x0 && x < plaque.x1 && y >= BASE - 120 && y < BASE - 108) {
    const u = x - plaque.x0;
    const v = y - (BASE - 120);
    const pw = plaque.x1 - plaque.x0;
    if (u < 1 || v < 1 || u >= pw - 1 || v >= 11) {
      if (u < e || v < e) return STEEL[6];
      if (u >= pw - e || v >= 12 - e) return STEEL[1];
      return STEEL[4];
    }
    const lx = Math.floor(x);
    const ly = Math.floor(y);
    const at = (ax: number, ay: number): boolean => mask[ay * W + ax] === 1;
    if (at(lx, ly)) {
      const sy = Y - ly * d;
      if (d >= 4 && sy === 0 && !at(lx, ly - 1)) return PAL_HD.snow[6];
      if (d >= 4 && (sy === d - 1 && !at(lx, ly + 1))) return MARBLE[4];
      return MARBLE[6];
    }
    // Drop shadow of the letters on the dark plate; bolts in the corners.
    const sx = X - lx * d;
    const sy = Y - ly * d;
    if ((sx === 0 && at(lx - 1, ly)) || (sy === 0 && at(lx, ly - 1))) return INK;
    if ((Math.abs(u - 2.2) < 0.45 || Math.abs(u - (pw - 2.2)) < 0.45) && Math.abs(v - 6) < 0.45) return STEEL[5];
    return v < 1.6 ? NAVY[0] : PAL_HD.ink[1];
  }
  // The doors: a steel frame, glass reflecting the sky above, the warm lobby behind the doors.
  if (x >= DX - 40 && x < DX + 40 && y >= BASE - 100) {
    const u = x - (DX - 40);
    const v = y - (BASE - 100);
    const shadow = y < BASE - 96.5 ? 0.3 : 0;
    if (u < 2 || u >= 78 || v < 2) {
      if (u < e || v < e) return STEEL[5];
      if (u >= 80 - e) return STEEL[1];
      return band(STEEL, 0.6 - shadow, X, Y, 2, 4);
    }
    const m = (u - 0) % 20;
    if (m < 1 || Math.abs(x - DX - 0.5) < 0.5) {
      const f = m < 1 ? m : x - DX;
      if (f < e) return STEEL[5];
      if (f >= 1 - e) return STEEL[1];
      return STEEL[3];
    }
    if (y >= BASE - 70 && y < BASE - 69) return y < BASE - 70 + e ? STEEL[5] : STEEL[2];
    if (y < BASE - 70) {
      // Upper lights: the sky reflected, darker under the canopy, sheen streaks.
      const st = (u * 2 - v) % 24;
      if (st > 0 && st < 1.4) return SKY[5];
      if (st >= 1.4 && st < 2) return SKY[4];
      return band(SKY, 0.62 - shadow * 1.5 - (v - 2) * 0.012, X, Y, 0, 4, 0.22);
    }
    // Push bars and brass pulls.
    if (Math.abs(y - (BASE - 45.5)) < 0.45 && ((x > DX - 14 && x < DX - 1.5) || (x > DX + 2.5 && x < DX + 15))) return y < BASE - 45.5 ? STEEL[6] : STEEL[3];
    if ((Math.abs(x - (DX - 2.6)) < 0.4 || Math.abs(x - (DX + 3.6)) < 0.4) && y > BASE - 52 && y < BASE - 47) return x % 1 < 0.5 ? GOLD[6] : GOLD[3];
    // The lobby: dark blue, pendant lamps, warm light pooling on the floor, a reflection streak.
    for (const lx of [DX - 27, DX - 7, DX + 13, DX + 31]) {
      const ly = BASE - 60;
      if (Math.abs(x - lx) < 0.3 && y < ly && y > BASE - 69) return NAVY[0];
      const r = Math.hypot(x - lx, (y - ly) * 1.3);
      if (r < 1.3) return r < 0.6 ? GOLD[7] : GOLD[5];
      if (r < 3.2) return band(NAVY, 0.9, X, Y, 1, 4, 0.3);
    }
    const floor = y - (BASE - 14);
    if (floor > 0) return band(GOLD, floor / 14 * 0.7 - Math.abs(x - DX) * 0.008, X, Y, 1, 4, 0.3);
    const st = (u * 2 - v) % 30;
    if (st > 0 && st < 1) return NAVY[3];
    return band(NAVY, 0.55 - (v - 30) * 0.004, X, Y, 1, 3, 0.2);
  }
  // A window, or the brick and the white bands.
  const w = hallWindow(x, y, X, Y, d);
  if (w !== 0) return w;
  const sb = (y - 22) % 30;
  if (sb < 4) {
    if (sb < 0.75) return MARBLE[6];
    if (sb < 3.4) return band(MARBLE, 0.82 - sb * 0.06 + (hash2(Math.floor(x / 9), Math.floor((y - 22) / 30), 5) - 0.5) * 0.1, X, Y, 3, 6, 0.2);
    return MARBLE[2];
  }
  // Brick in running bond (3 × 1.5 px), aligned to the street.
  const uu = (BASE + 1 - y) / 1.5;
  const row = Math.floor(uu);
  const fu = uu - row;
  const xx = x + (row & 1 ? 1.5 : 0);
  const col = Math.floor(xx / 3);
  const fx = xx - col * 3;
  const j = e * 1.01;
  const near = x < TX1 + 1.6 ? (TX1 + 1.6 - x) * 0.25 : 0;
  // Shadow cast by the white band above and by the window sills.
  const castBand = sb < 5 ? 0.3 : 0;
  if (fu * 1.5 < j || fx < j) return near > 0.2 ? BRICK[0] : BRICK[1];
  const h = hash2(col, row, 41);
  let t = 0.48 + (h - 0.5) * 0.3 - near - castBand;
  if (fu * 1.5 > 1.5 - j) t += 0.18;
  else if (fu * 1.5 < 2 * j) t -= 0.12;
  // Soot and damp: soft blotches by brick, damp up from the street.
  if (hash2(Math.floor(col / 3), Math.floor(row / 4), 43) > 0.8) t -= 0.12;
  if (y > BASE - 7) t -= (y - BASE + 7) * 0.025;
  return band(BRICK, t, X, Y, 1, 5, 0);
}

/** The Stopera at density d (one frame: the 1× footprint, ox 1, oy 169). */
export function stoperaHd(d: number): Frame[] {
  const f = new Facade(W, H, d);
  const tw = measure('STADHUIS');
  const plaque = { x0: DX - (tw >> 1) - 4, x1: DX - (tw >> 1) + tw + 4 };
  const mask = textMask(W, H, 'STADHUIS', DX, BASE - 117, { align: 'center' });
  // The drum's curve and light per art column.
  const tops = new Float64Array(f.W);
  const lights = new Float64Array(f.W);
  for (let X = 0; X < f.W; X++) {
    tops[X] = theatreTop((X + 0.5) / d);
    lights[X] = drumLight((X + 0.5) / d);
  }
  for (let Y = 0; Y < f.H; Y++) {
    const y = (Y + 0.5) / d;
    for (let X = 0; X < f.W; X++) {
      const x = (X + 0.5) / d;
      let c: Color = 0;
      let deep: Color = MARBLE[0];
      if (x >= 1 && x < TX1) {
        c = theatre(x, y, X, Y, d, tops[X], lights[X]);
        if (c === 0) c = flyTower(x, y, X, Y, d);
      } else if (x >= TX1 && x < W - 1) {
        c = hall(x, y, X, Y, d, plaque, mask);
        deep = BRICK[0];
      }
      if (c !== 0) f.set(X, Y, c, deep);
    }
  }
  f.outlineC(INK);
  return [{ buf: f.buf, ox: 1, oy: H, density: d }];
}

export const STOPERA_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = [[ID, stoperaHd]];
