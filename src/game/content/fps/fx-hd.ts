/**
 * The UHD 2D details of the first-person billboards (UHD wave): muzzle blooms, glints, blood
 * pools and drops, the reactor, sparks and smoke — painted natively at density d (2 or 4) on the
 * (size·d)² buffers of the HD figures, at the same LOGICAL places and sizes as their 1× versions
 * in billboards.ts, with HD ramps (fire, red, stone), clean tone bands (no dither on sprites), a
 * key-light highlight from the upper left and darker rims. Every position here is in ART px of the
 * HD buffer unless the parameter says "logical". Pure and deterministic (hash2 only).
 */
import type { Color } from '../../../engine/color';
import { HD_PALETTE, PAL_HD } from '../../../engine/palette-hd';
import type { PixelBuffer } from '../../../engine/pixel';
import { hash2 } from '../../art/paint';

const FIRE = PAL_HD.fire;
const RED = PAL_HD.red;
const STONE = PAL_HD.stone;
const SNOW = PAL_HD.snow;
const GOLD = PAL_HD.gold;

function put(b: PixelBuffer, X: number, Y: number, c: Color): void {
  if (X >= 0 && Y >= 0 && X < b.w && Y < b.h) b.data[Y * b.w + X] = c >>> 0;
}

/**
 * A muzzle bloom (the 1× `muzzleFlash` at density d): an 8-point star of radius `R` art px around
 * (cx, cy), white-hot core, then the fire ramp out to a deep orange tip; a faint second star turned
 * 22.5° fills the gaps so the burst reads round at range.
 */
export function flashHd(b: PixelBuffer, cx: number, cy: number, R: number): void {
  const r0 = Math.ceil(R);
  for (let dy = -r0; dy <= r0; dy++) {
    for (let dx = -r0; dx <= r0; dx++) {
      const X = Math.round(cx) + dx;
      const Y = Math.round(cy) + dy;
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue;
      const d = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      const star = 0.5 + 0.5 * Math.abs(Math.cos(th * 4)) ** 3;
      const fill = 0.42 + 0.18 * Math.abs(Math.cos(th * 4 + Math.PI / 4)) ** 2;
      const rr = R * Math.max(star, fill);
      if (d > rr) continue;
      const k = d / rr;
      const c = d <= Math.max(1, R * 0.16) ? FIRE[7] : k < 0.3 ? FIRE[6] : k < 0.48 ? FIRE[5] : k < 0.66 ? FIRE[4] : k < 0.84 ? FIRE[3] : FIRE[2];
      b.data[Y * b.w + X] = c;
    }
  }
}

/** The aimed barrel's glint: a white core (1 logical px) with four tapering rays, gold at the tips. */
export function glintHd(b: PixelBuffer, cx: number, cy: number, d: number): void {
  const core = d * 0.7;
  const len = d * 3.4;
  const R = Math.ceil(len);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const X = Math.round(cx) + dx;
      const Y = Math.round(cy) + dy;
      const ax = Math.abs(dx + 0.5 - (cx - Math.round(cx)));
      const ay = Math.abs(dy + 0.5 - (cy - Math.round(cy)));
      const r = Math.hypot(ax, ay);
      let c: Color = 0;
      if (r <= core) c = SNOW[6];
      else {
        // rays along x and y, width shrinking with the distance
        const along = Math.max(ax, ay);
        const across = Math.min(ax, ay);
        if (along <= len && across <= Math.max(0.5, (d * 0.45) * (1 - along / len))) c = along < len * 0.45 ? SNOW[5] : along < len * 0.75 ? GOLD[6] : GOLD[5];
      }
      if (c) put(b, X, Y, c);
    }
  }
}

/**
 * A blood pool on the floor (the 1× `bloodPool` at density d): the same wobbling ellipse in LOGICAL
 * units (centre `cx`, ground line `gy`, size 0..1), a wet dark centre, a lighter rim, the deepest
 * red at the edge and a key-light sheen on the upper-left inside; it stays under the body.
 */
export function bloodPoolHd(b: PixelBuffer, cx: number, gy: number, size: number, seed: number, d: number): void {
  const rx = 6 + size * 16;
  const ry = 1.5 + size * 3;
  const cy = gy - ry * 0.4;
  const Y0 = Math.floor((gy - ry) * d);
  const Y1 = Math.ceil((gy + 2) * d);
  const X0 = Math.floor((cx - rx - 2) * d);
  const X1 = Math.ceil((cx + rx + 2) * d);
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = X0; X < X1; X++) {
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue;
      const x = (X + 0.5) / d;
      const y = (Y + 0.5) / d;
      // the same wobble as 1× (per 2 logical px), blended so the HD rim is smooth
      const xs = x / 2;
      const i0 = Math.floor(xs);
      const f = xs - i0;
      const w0 = hash2(i0, 0, seed);
      const w1 = hash2(i0 + 1, 0, seed);
      const wob = 1 + (w0 + (w1 - w0) * (f * f * (3 - 2 * f)) - 0.5) * 0.35;
      const ex = (x - cx) / (rx * wob);
      const ey = (y - cy) / ry;
      const dd = ex * ex + ey * ey;
      if (dd > 1) continue;
      const i = Y * b.w + X;
      if ((b.data[i] & 255) !== 0 && dd > 0.25) continue;
      let c: Color = dd > 0.82 ? RED[0] : dd > 0.6 ? RED[1] : dd > 0.3 ? RED[2] : RED[3];
      // sheen: a thin crescent on the upper-left inside of the pool
      const sx = ex + 0.28;
      const sy = ey + 0.45;
      const sh = sx * sx * 1.4 + sy * sy;
      if (ex < 0.1 && sh > 0.18 && sh < 0.3 && dd < 0.7) c = sh < 0.24 ? RED[6] : RED[5];
      b.data[i] = c;
    }
  }
}

/** Blood drops flying from a LOGICAL point (the 1× `spray` at density d): round drops with a lit top-left. */
export function sprayHd(b: PixelBuffer, x: number, y: number, n: number, seed: number, d: number): void {
  for (let k = 0; k < n; k++) {
    const a = hash2(k, 1, seed) * Math.PI * 2;
    const dist = 2 + hash2(k, 2, seed) * 7;
    const px = x + Math.cos(a) * dist;
    const py = y + Math.sin(a) * dist * 0.7;
    drop(b, px * d, py * d, d * (k % 3 === 0 ? 0.75 : 0.6), k % 3 === 0 ? 3 : 2);
  }
}

/** One round drop at art px (X, Y), radius r art px, its body tone `t` of the red ramp. */
export function drop(b: PixelBuffer, X: number, Y: number, r: number, t: number): void {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const ox = dx + 0.5 - (X - Math.floor(X));
      const oy = dy + 0.5 - (Y - Math.floor(Y));
      const q = Math.hypot(ox, oy);
      if (q > r) continue;
      const lit = ox + oy < -r * 0.6 && q > r * 0.25;
      put(b, Math.floor(X) + dx, Math.floor(Y) + dy, lit ? RED[t + 3] : q > r * 0.75 ? RED[t - 1] : RED[t]);
    }
  }
}

/** The reactor on the suit's chest (logical centre, the 1× rings at density d): white core, gold, hot reds. */
export function reactorHd(b: PixelBuffer, x: number, y: number, pulse: number, dead: boolean, d: number): void {
  const R = 5.5 + pulse * 1.5;
  const X0 = Math.floor((x - R - 1) * d);
  const X1 = Math.ceil((x + R + 1) * d);
  const Y0 = Math.floor((y - R - 1) * d);
  const Y1 = Math.ceil((y + R + 1) * d);
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = X0; X < X1; X++) {
      const q = Math.hypot((X + 0.5) / d - x, (Y + 0.5) / d - y);
      if (q > R) continue;
      let c: Color;
      if (dead) c = q < 2 ? RED[1] : q < R - 1 ? PAL_HD.ink[1] : q < R - 0.5 ? RED[0] : RED[1];
      else {
        // the rings, with a cool rim on the bottom-right edge of the housing
        c = q < 1.3 ? FIRE[7] : q < 2 ? FIRE[6] : q < 2.7 ? FIRE[5] : q < 3.4 ? RED[6] : q < 4 ? RED[4] : q < 4.6 ? RED[2] : q < R - 0.6 ? RED[3] : RED[1];
        const rx = (X + 0.5) / d - x;
        const ry = (Y + 0.5) / d - y;
        if (q >= R - 0.6 && rx + ry < -R * 0.4) c = RED[5];
      }
      put(b, X, Y, c);
    }
  }
}

/**
 * Sparks (the 1× `sparks` at density d): at the same LOGICAL places (a spark lands only on the
 * figure), each a white head with a short gold-to-orange streak flying out from the suit's centre.
 */
export function sparksHd(b: PixelBuffer, n: number, seed: number, d: number, cxL: number, cyL: number): void {
  for (let k = 0; k < n; k++) {
    const x = 18 + Math.floor(hash2(k, 1, seed) * 60) + 0.5;
    const y = 30 + Math.floor(hash2(k, 2, seed) * 45) + 0.5;
    const X = Math.floor(x * d);
    const Y = Math.floor(y * d);
    if (X < 0 || Y < 0 || X >= b.w || Y >= b.h || (b.data[Y * b.w + X] & 255) === 0) continue;
    const ax = x - cxL;
    const ay = y - cyL;
    const l = Math.hypot(ax, ay) || 1;
    streak(b, x * d, y * d, (ax / l) * d, (ay / l) * d, k % 2 === 0 ? 2.6 : 1.6, k % 3);
  }
}

/** A spark streak from art px (X, Y) back along (−ux, −uy) per logical px, `len` logical px long. */
export function streak(b: PixelBuffer, X: number, Y: number, ux: number, uy: number, len: number, kind: number): void {
  const d = Math.hypot(ux, uy);
  const steps = Math.max(2, Math.round(len * d));
  for (let s = steps; s >= 0; s--) {
    const t = s / steps;
    const c = t < 0.2 ? (kind === 0 ? SNOW[6] : FIRE[7]) : t < 0.5 ? FIRE[6] : t < 0.8 ? (kind === 2 ? FIRE[4] : FIRE[5]) : FIRE[3];
    const px = X - (ux / d) * (len * d) * t;
    const py = Y - (uy / d) * (len * d) * t;
    put(b, Math.floor(px), Math.floor(py), c);
    if (t < 0.35 && d >= 4) put(b, Math.floor(px) + 1, Math.floor(py), c);
  }
}

/**
 * A smoke puff (the 1× `smoke` at density d): LOGICAL centre and radius, the same hash-eroded rim
 * (on 1-logical-px cells, so it reads as soft lumps, not grain), a light top-left, shaded bottom-right.
 */
export function smokeHd(b: PixelBuffer, x: number, y: number, r: number, seed: number, d: number): void {
  const X0 = Math.floor((x - r) * d);
  const X1 = Math.ceil((x + r + 1) * d);
  const Y0 = Math.floor((y - r) * d);
  const Y1 = Math.ceil((y + r + 1) * d);
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = X0; X < X1; X++) {
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue;
      const lx = (X + 0.5) / d;
      const ly = (Y + 0.5) / d;
      const q = Math.hypot(lx - x, ly - y) / r + (hash2(Math.floor(lx), Math.floor(ly), seed) - 0.5) * 0.45;
      if (q > 1) continue;
      const lit = (lx - x) * -0.6 + (ly - y) * -0.8;
      const t = lit / r;
      const c = q > 0.82 ? STONE[2] : t > 0.35 ? STONE[5] : t > 0 ? STONE[4] : t > -0.4 ? STONE[3] : STONE[2];
      b.data[Y * b.w + X] = c;
    }
  }
}

const hdNear = new Map<Color, Color>();

/** The nearest HD palette colour (redmean distance; alpha kept). */
export function nearestHd(c: Color): Color {
  const key = (c | 255) >>> 0;
  const hit = hdNear.get(key);
  if (hit !== undefined) return ((hit & 0xffffff00) | (c & 255)) >>> 0;
  const r = c >>> 24;
  const g = (c >>> 16) & 255;
  const bl = (c >>> 8) & 255;
  let best = HD_PALETTE[0];
  let bestD = Infinity;
  for (const p of HD_PALETTE) {
    const pr = p >>> 24;
    const pg = (p >>> 16) & 255;
    const pb = (p >>> 8) & 255;
    const rm = (pr + r) / 2;
    const dd = (2 + rm / 256) * (pr - r) ** 2 + 4 * (pg - g) ** 2 + (2 + (255 - rm) / 256) * (pb - bl) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = p;
    }
  }
  hdNear.set(key, best);
  return ((best & 0xffffff00) | (c & 255)) >>> 0;
}
