/**
 * Portrait kit — large caricature busts (docs/design/squad.md §2.2: the `char/<id>/select`
 * portraits and their small `portrait` twins). A portrait is a set of shape functions in
 * PORTRAIT UNITS (one unit = one 1× pixel of the 64 × 120 select frame); a `Painter` samples them
 * at the centre of every buffer pixel. The same shapes therefore give the 1× frame (density 1),
 * the native 2× frame (density 2, half-unit detail: no upscale) and the 32 × 32 menu portrait (a
 * zoomed-out view of the same face). Strokes never get thinner than one buffer pixel, so a line
 * never breaks up in a small view.
 *
 * The face is a height field (a rounded head plus Gaussian bumps for the brow ridge, the eye
 * sockets, the nose, the cheekbones, the muzzle and the chin), lit by a strong key light from the
 * upper left with cast shadows (the nose and the brows throw shade): the dramatic side light of a
 * late-1990s arcade "soldier select" portrait. Colours come only from palette ramps; tones are
 * banded with an ordered (Bayer) dither at the band borders only.
 *
 * Built from shapes and the palette, never traced (docs/ORIGINALITY.md, the squad exception).
 */
import type { Color } from '../../engine/color';
import { luma } from '../../engine/color';
import { INK, PAL, type Ramp } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import { bayer, hash2, noise2 } from './paint';

export type Pt = readonly [number, number];

// ---------------------------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------------------------

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Gaussian bump: 1 at (cx, cy), falling off with the spreads sx, sy. */
export function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const u = (x - cx) / sx;
  const v = (y - cy) / sy;
  return Math.exp(-(u * u + v * v) / 2);
}

/** (dx/rx)² + (dy/ry)²: < 1 inside the ellipse. */
export function ell(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  return u * u + v * v;
}

/** Distance from (x, y) to the segment a–b and the position along it (0..1). */
export function segDist(x: number, y: number, a: Pt, b: Pt): [number, number] {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : clamp01(((x - a[0]) * vx + (y - a[1]) * vy) / l2);
  const dx = x - (a[0] + vx * t);
  const dy = y - (a[1] + vy * t);
  return [Math.sqrt(dx * dx + dy * dy), t];
}

/** Distance to a polyline and the position along it (0 at the first point, 1 at the last). */
export function lineDist(x: number, y: number, pts: ReadonlyArray<Pt>): [number, number] {
  let best = Infinity;
  let pos = 0;
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [d, t] = segDist(x, y, pts[i], pts[i + 1]);
    if (d < best) {
      best = d;
      pos = (i + t) / n;
    }
  }
  return [best, pos];
}

/** Points along a quadratic Bézier p0 → p2 pulled towards p1. */
export function quad(p0: Pt, p1: Pt, p2: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return out;
}

/** Points along a cubic Bézier. */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

/** Even-odd point-in-polygon test. */
export function inPoly(x: number, y: number, pts: ReadonlyArray<Pt>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------------------------
// Light and tones
// ---------------------------------------------------------------------------------------------

/** The key light: from the upper left and in front (unit vector towards the light). */
export const LIGHT: readonly [number, number, number] = (() => {
  const v = [-0.66, -0.5, 0.56];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();

/** Lambert term of a unit normal under the key light (0..1). */
export function lambert(nx: number, ny: number, nz: number): number {
  return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
}

/** Light on an ellipsoid at (x, y) (centre cx, cy; radii rx, ry), 0..1; `amb` lifts the dark side. */
export function ellLight(x: number, y: number, cx: number, cy: number, rx: number, ry: number, amb = 0.1): number {
  const nx = Math.max(-1, Math.min(1, (x - cx) / rx));
  const ny = Math.max(-1, Math.min(1, (y - cy) / ry));
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return amb + (1 - amb) * lambert(nx, ny, nz);
}

/**
 * A ramp colour for a tone t (0 dark .. 1 light) at buffer pixel (X, Y): flat bands, with an
 * ordered dither only near each band border (`band` = the dithered part of a step, 0..1).
 */
export function tone(r: Ramp, t: number, X: number, Y: number, band = 0.4): Color {
  const n = r.length;
  const v = clamp01(t) * (n - 1);
  const i = Math.floor(v);
  const f = v - i;
  const lo = 0.5 - band / 2;
  let k = i;
  if (f >= lo + band) k = i + 1;
  else if (f > lo && (f - lo) / band > bayer(X, Y)) k = i + 1;
  return r[k < 0 ? 0 : k >= n ? n - 1 : k];
}

/** Elongated value noise along `angle` (radians): hair strands, wool, fabric grain. 0..1. */
export function strands(x: number, y: number, angle: number, len: number, wid: number, seed: number): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = x * c + y * s;
  const v = -x * s + y * c;
  return noise2(u / len, v / wid, 1, seed);
}

// ---------------------------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------------------------

/** Fair skin, deep warm shadows (dark → light). */
export const SKIN_FAIR: Ramp = [INK, PAL.brown[0], PAL.rust[1], PAL.rust[2], PAL.brown[3], PAL.skinA[1], PAL.skinA[2], PAL.skinA[3]];
/** Pale skin: cooler shadows, the lightest highlights. */
export const SKIN_PALE: Ramp = [INK, PAL.stone[0], PAL.brown[1], PAL.stone[2], PAL.skinA[1], PAL.skinA[2], PAL.skinA[3]];
/** Light-tan skin. */
export const SKIN_TAN: Ramp = [INK, PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3], PAL.skinB[2], PAL.skinB[3], PAL.skinA[3]];
/** Ruddy skin (outdoor worker): more red in the mid-tones. */
export const SKIN_RUDDY: Ramp = [INK, PAL.brown[0], PAL.rust[1], PAL.rust[2], PAL.skinA[1], PAL.skinA[2], PAL.skinA[3]];

export const HAIR_BROWN: Ramp = [INK, PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]];
export const HAIR_DARK: Ramp = [INK, PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.brown[2]];
export const HAIR_BLACK: Ramp = [INK, PAL.ink[1], PAL.hairA[2], PAL.steel[1], PAL.steel[2]];
export const HAIR_BLOND: Ramp = [PAL.brown[1], PAL.gold[0], PAL.sand[1], PAL.sand[2], PAL.sand[3]];

/** Background of the select portraits: dark night blue fading to black at the bottom. */
export const BACKDROP: Ramp = [INK, PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.purple[0]];

/**
 * The steel / stone grey ramp of the greyed-out select portrait, dark → light (luminance order).
 * Only ink, steel and stone colours.
 */
export const GREY: Ramp = [INK, PAL.ink[1], PAL.steel[0], PAL.stone[0], PAL.steel[1], PAL.stone[1], PAL.steel[2], PAL.stone[2], PAL.steel[3], PAL.stone[3], PAL.steel[4]];

const greyCache = new Map<Color, Color>();
const GREY_LUMA = GREY.map((c) => luma(c));

/**
 * Map a palette colour to the GREY ramp by luminance (slightly dimmed: an unselected soldier
 * sits in the dark). Pure: the same colour always gives the same grey.
 */
export function toGrey(c: Color): Color {
  const hit = greyCache.get(c);
  if (hit !== undefined) return hit;
  const l = luma(c) * 0.8;
  let best = 0;
  for (let i = 1; i < GREY.length; i++) if (Math.abs(GREY_LUMA[i] - l) < Math.abs(GREY_LUMA[best] - l)) best = i;
  greyCache.set(c, GREY[best]);
  return GREY[best];
}

/** A greyed copy of a portrait buffer (PixelBuffer.recolor through the luminance map). */
export function greyed(b: PixelBuffer): PixelBuffer {
  return b.clone().recolor(toGrey);
}

// ---------------------------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------------------------

/** Which part of the portrait a buffer shows: its top-left corner and zoom (1 = 64 × 120). */
export interface View {
  x0: number;
  y0: number;
  scale: number;
}

export const FULL_VIEW: View = { x0: 0, y0: 0, scale: 1 };

/** A per-pixel shader: the colour at portrait position (x, y) / buffer pixel (X, Y), or null to keep the pixel. */
export type Shader = (x: number, y: number, X: number, Y: number) => Color | null | undefined;

export class Painter {
  readonly b: PixelBuffer;
  readonly d: number;
  /** Buffer pixels per portrait unit. */
  readonly k: number;
  /** Portrait units per buffer pixel (the finest detail this view can show). */
  readonly px: number;
  readonly view: View;

  constructor(w: number, h: number, d: number, view: View = FULL_VIEW) {
    this.b = new PixelBuffer(w * d, h * d);
    this.d = d;
    this.view = view;
    this.k = d * view.scale;
    this.px = 1 / this.k;
  }

  /** A stroke width that never drops under one buffer pixel. */
  sw(w: number): number {
    return Math.max(w, this.px * 1.1);
  }

  /** Run a shader over every buffer pixel. */
  paint(fn: Shader): this {
    const { b, k } = this;
    const { x0, y0 } = this.view;
    const d = b.data;
    for (let Y = 0; Y < b.h; Y++) {
      const y = y0 + (Y + 0.5) / k;
      for (let X = 0; X < b.w; X++) {
        const c = fn(x0 + (X + 0.5) / k, y, X, Y);
        if (c !== null && c !== undefined) d[Y * b.w + X] = c >>> 0;
      }
    }
    b.touch();
    return this;
  }

  /** Paint a stroke along a polyline: width w0 at the start → w1 at the end (portrait units). */
  stroke(pts: ReadonlyArray<Pt>, w0: number, w1: number, col: Color | ((t: number, x: number, y: number, X: number, Y: number) => Color | null)): this {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const m = Math.max(w0, w1, this.px * 2);
    return this.paint((x, y, X, Y) => {
      if (x < minX - m || x > maxX + m || y < minY - m || y > maxY + m) return null;
      const [dd, t] = lineDist(x, y, pts);
      if (dd > this.sw(lerp(w0, w1, t)) / 2) return null;
      return typeof col === 'number' ? col : col(t, x, y, X, Y);
    });
  }

  /** Paint one buffer pixel at portrait position (x, y) (catchlights, specks). */
  dot(x: number, y: number, c: Color): this {
    const X = Math.floor((x - this.view.x0) * this.k);
    const Y = Math.floor((y - this.view.y0) * this.k);
    if (this.b.inBounds(X, Y)) this.b.set(X, Y, c);
    return this;
  }
}

/** Vertical backdrop: dark night blue at the top, black at the bottom, a faint glow behind the head. */
export function backdrop(p: Painter, glowX: number, glowY: number, r: Ramp = BACKDROP): void {
  p.paint((x, y, X, Y) => {
    const v = 0.78 - (y / 120) * 0.95 + 0.35 * gauss(x, y, glowX, glowY, 26, 30) - 0.12 * smoothstep(20, 64, Math.abs(x - glowX));
    return tone(r, v, X, Y, 0.7);
  });
}

// ---------------------------------------------------------------------------------------------
// Head
// ---------------------------------------------------------------------------------------------

export interface Bump {
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Height (portrait units; negative = a hollow). */
  a: number;
}

export interface HeadSpec {
  /** Centre line. */
  cx: number;
  /** Top of the skull (under the hair). */
  top: number;
  /** Widest point (cheekbones / temples) and the half width there. */
  cheekY: number;
  rx: number;
  /** Jaw corner and its half width. */
  jawY: number;
  jawW: number;
  /** Bottom of the chin and the half width of its flat. */
  chinY: number;
  chinW: number;
  /** Feature lines. */
  eyeY: number;
  eyeDX: number;
  noseY: number;
  mouthY: number;
  skin: Ramp;
  /** Bump heights (defaults: a normal face). */
  nose?: number;
  noseW?: number;
  brow?: number;
  cheek?: number;
  hollow?: number;
  chin?: number;
  muzzle?: number;
  /** Extra bumps (a smile's raised cheeks, a frown ...). */
  bumps?: readonly Bump[];
  /** Overall light: + brighter (pale skin), − darker. */
  exposure?: number;
}

/**
 * A head: silhouette, height field, light with cast shadows and the skin tones. Every method
 * takes portrait units.
 */
export class Head {
  readonly s: HeadSpec;
  readonly bumps: Bump[];
  /** Extra occluders that throw shade on the face (hair, a cap peak): height at (x, y), or 0. */
  occ: ((x: number, y: number) => number) | null = null;

  constructor(s: HeadSpec) {
    this.s = s;
    const { cx, eyeY, eyeDX, noseY, mouthY, chinY } = s;
    const nose = s.nose ?? 4;
    const nw = s.noseW ?? 2.2;
    this.bumps = [
      // Brow ridge and the eye sockets under it.
      { x: cx - eyeDX, y: eyeY - 4.5, sx: 4.5, sy: 1.8, a: s.brow ?? 1.6 },
      { x: cx + eyeDX, y: eyeY - 4.5, sx: 4.5, sy: 1.8, a: s.brow ?? 1.6 },
      { x: cx, y: eyeY - 4, sx: 3, sy: 2, a: (s.brow ?? 1.6) * 0.6 },
      { x: cx - eyeDX, y: eyeY + 0.3, sx: 3.6, sy: 2.4, a: -2.4 },
      { x: cx + eyeDX, y: eyeY + 0.3, sx: 3.6, sy: 2.4, a: -2.4 },
      // Nose: bridge, tip and wings.
      { x: cx, y: lerp(eyeY, noseY, 0.35), sx: nw * 0.6, sy: 3, a: nose * 0.45 },
      { x: cx, y: lerp(eyeY, noseY, 0.7), sx: nw * 0.75, sy: 3, a: nose * 0.7 },
      { x: cx, y: noseY - 1.2, sx: nw, sy: 1.8, a: nose },
      { x: cx - nw - 0.6, y: noseY - 0.4, sx: 1.4, sy: 1.2, a: nose * 0.35 },
      { x: cx + nw + 0.6, y: noseY - 0.4, sx: 1.4, sy: 1.2, a: nose * 0.35 },
      // Cheekbones, the hollow under them, the muzzle and the chin.
      { x: cx - eyeDX - 2, y: eyeY + 6, sx: 4.5, sy: 3, a: s.cheek ?? 1.5 },
      { x: cx + eyeDX + 2, y: eyeY + 6, sx: 4.5, sy: 3, a: s.cheek ?? 1.5 },
      { x: cx - eyeDX - 3, y: mouthY + 1, sx: 3.5, sy: 4, a: -(s.hollow ?? 0.6) },
      { x: cx + eyeDX + 3, y: mouthY + 1, sx: 3.5, sy: 4, a: -(s.hollow ?? 0.6) },
      { x: cx, y: mouthY - 0.5, sx: 6.5, sy: 3.5, a: s.muzzle ?? 1.6 },
      { x: cx, y: mouthY + 3.6, sx: 3, sy: 1, a: -0.6 },
      { x: cx, y: chinY - 4, sx: 4.5, sy: 3, a: s.chin ?? 1.6 },
      ...(s.bumps ?? []),
    ];
  }

  /** Half width of the head at y (0 outside it). */
  hw(y: number): number {
    const s = this.s;
    if (y < s.top || y > s.chinY) return 0;
    if (y <= s.cheekY) {
      const u = (s.cheekY - y) / (s.cheekY - s.top);
      return s.rx * Math.sqrt(Math.max(0, 1 - u * u));
    }
    if (y <= s.jawY) return lerp(s.rx, s.jawW, smoothstep(s.cheekY, s.jawY, y) * 0.85 + ((y - s.cheekY) / (s.jawY - s.cheekY)) * 0.15);
    const u = (y - s.jawY) / (s.chinY - s.jawY);
    return s.chinW + (s.jawW - s.chinW) * Math.sqrt(Math.max(0, 1 - u * u));
  }

  inside(x: number, y: number): boolean {
    return Math.abs(x - this.s.cx) < this.hw(y);
  }

  /** Height of the face surface (0 outside). */
  h(x: number, y: number): number {
    const s = this.s;
    const w = this.hw(y);
    if (w <= 0) return 0;
    const u = (x - s.cx) / w;
    if (u * u >= 1) return 0;
    const mid = (s.top + s.chinY) / 2;
    const half = (s.chinY - s.top) / 2;
    const v = (y - mid) / (half * 1.08);
    let h = s.rx * 0.95 * Math.sqrt(1 - u * u) * Math.sqrt(Math.max(0.02, 1 - v * v));
    for (const b of this.bumps) {
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx * dx > 16 * b.sx * b.sx || dy * dy > 16 * b.sy * b.sy) continue;
      h += b.a * gauss(x, y, b.x, b.y, b.sx, b.sy);
    }
    return h;
  }

  /** Key light at (x, y), 0..1, with self-shadowing and cast shadows of the occluders. */
  light(x: number, y: number): number {
    const e = 0.35;
    const hx = (this.h(x + e, y) - this.h(x - e, y)) / (2 * e);
    const hy = (this.h(x, y + e) - this.h(x, y - e)) / (2 * e);
    const l = Math.hypot(hx, hy, 1);
    let I = lambert(-hx / l, -hy / l, 1 / l);
    // Cast shadow: march towards the light; anything higher than the ray blocks it.
    const h0 = this.h(x, y);
    const lxy = Math.hypot(LIGHT[0], LIGHT[1]);
    const dx = LIGHT[0] / lxy;
    const dy = LIGHT[1] / lxy;
    const rise = LIGHT[2] / lxy;
    let shade = 1;
    for (let t = 0.7; t < 9; t += 0.7) {
      const sx = x + dx * t;
      const sy = y + dy * t;
      const hh = Math.max(this.h(sx, sy), this.occ ? this.occ(sx, sy) : 0);
      const over = hh - (h0 + t * rise);
      if (over > 0.25) {
        shade = Math.min(shade, 1 - smoothstep(0.25, 1.2, over) * 0.75);
        if (shade <= 0.25) break;
      }
    }
    I *= shade;
    // A little fill from the front so the dark side keeps its form.
    return clamp01(0.06 + I * 0.98 + (this.s.exposure ?? 0));
  }

  /** The skin colour at (x, y): `shift` moves the tone (− darker: creases, + lighter). */
  skin(x: number, y: number, X: number, Y: number, shift = 0): Color {
    return tone(this.s.skin, this.light(x, y) * 1.05 + shift, X, Y, 0.45);
  }

  /** Paint the face (the inside of the silhouette) with `extra` tone shifts (blush, creases). */
  paintFace(p: Painter, extra?: (x: number, y: number) => number): void {
    p.paint((x, y, X, Y) => (this.inside(x, y) ? this.skin(x, y, X, Y, extra ? extra(x, y) : 0) : null));
  }
}

// ---------------------------------------------------------------------------------------------
// Ears and neck
// ---------------------------------------------------------------------------------------------

/** Both ears, half hidden behind the head edge: lit rim, inner fold, deep bowl. */
export function ears(p: Painter, hd: Head, y0: number, y1: number, w = 5): void {
  const s = hd.s;
  for (const side of [-1, 1]) {
    const cy = (y0 + y1) / 2;
    const ry = (y1 - y0) / 2;
    const ex = s.cx + side * (hd.hw(cy) + w * 0.25);
    p.paint((x, y, X, Y) => {
      if (ell(x, y, ex, cy, w / 2 + 0.5, ry) >= 1 || hd.inside(x, y)) return null;
      let t = ellLight(x, y, ex - side * 1.5, cy, w, ry, 0.05) * (side < 0 ? 1 : 0.55);
      // The bowl: a darker inner oval towards the head.
      if (ell(x, y, ex - side * 0.4, cy + 0.5, w * 0.24, ry * 0.55) < 1) t -= 0.35;
      return tone(s.skin, t, X, Y);
    });
  }
}

/** The neck: a column under the jaw, in the shade of the chin, its right side darker. */
export function neck(p: Painter, hd: Head, w: number, y1: number): void {
  const s = hd.s;
  p.paint((x, y, X, Y) => {
    if (y < s.jawY - 2 || y > y1 || Math.abs(x - s.cx) > w + (y - s.jawY) * 0.08 || hd.inside(x, y)) return null;
    const u = (x - s.cx) / w;
    let t = 0.42 - u * 0.3 - 0.45 * smoothstep(s.chinY + 8, s.chinY - 1, y);
    // The Adam's apple catches a little light.
    t += 0.1 * gauss(x, y, s.cx - 1, s.chinY + 6, 1.5, 2);
    return tone(s.skin, t * 0.85, X, Y);
  });
}

// ---------------------------------------------------------------------------------------------
// Eyes, brows, nose, mouth
// ---------------------------------------------------------------------------------------------

export type EyeKind = 'open' | 'squint' | 'happy';

export interface EyeSpec {
  x: number;
  y: number;
  /** Width (corner to corner) and the opening height. */
  w: number;
  open: number;
  kind: EyeKind;
  /** −1 on the viewer's left (the lit side), +1 on the right. */
  side: -1 | 1;
  iris: Ramp;
  /** Iris shift (look direction), portrait units. */
  look?: number;
  /** Outer corner up (+) or down (−). */
  tilt?: number;
  /** Crow's feet at the outer corner. */
  crow?: number;
  /** Lid line colour. */
  lid?: Color;
}

/** Brown, blue and dark irises (dark → light). */
export const IRIS_BROWN: Ramp = [INK, PAL.brown[0], PAL.brown[1], PAL.brown[2]];
export const IRIS_BLUE: Ramp = [INK, PAL.steel[0], PAL.sky[0], PAL.sky[1], PAL.sky[2]];
export const IRIS_DARK: Ramp = [INK, PAL.ink[1], PAL.brown[0], PAL.brown[1]];

/** One eye: almond lids, sclera, iris with pupil and catchlight, crease, lashes; or a happy arc. */
export function eye(p: Painter, hd: Head, e: EyeSpec): void {
  const { x: ex, y: ey, w, side } = e;
  const lid = e.lid ?? INK;
  const half = w / 2;
  const tilt = e.tilt ?? 0;
  // Positions along the eye: u = −1 inner … +1 outer (outer is `side`).
  const uOf = (x: number): number => ((x - ex) / half) * side;
  const base = (u: number): number => ey - tilt * u * 0.5;
  if (e.kind === 'happy') {
    // A closed, upturned arc (∩) with a plump lower lid under it.
    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12;
      pts.push([ex + u * half * side, base(u) - e.open * (1 - u * u)]);
    }
    p.stroke(pts, 1.5, 1.1, lid);
    // The lower lid: a lit bulge.
    const low = pts.map(([x, y]) => [x, y + e.open * 0.9 + 1.6] as Pt);
    p.stroke(low.slice(2, 11), 0.8, 0.8, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, 0.1));
    p.stroke(low.slice(3, 10).map(([x, y]) => [x, y + 0.9] as Pt), 0.7, 0.7, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -0.22));
  } else {
    const open = e.open;
    const up = (u: number): number => base(u) - open * Math.pow(Math.max(0, 1 - u * u), 0.7) * (e.kind === 'squint' ? 0.75 : 1) - (u < 0 ? 0.25 * open * (1 + u) : 0);
    const lo = (u: number): number => base(u) + open * (e.kind === 'squint' ? 0.25 : 0.42) * Math.max(0, 1 - u * u);
    const look = e.look ?? 0;
    const icx = ex + look;
    const icy = ey - open * 0.3;
    const ir = open * 0.85 + 0.6;
    p.paint((x, y, X, Y) => {
      const u = uOf(x);
      if (u < -1 || u > 1 || y < up(u) || y > lo(u)) return null;
      const di = Math.hypot(x - icx, y - icy);
      if (di < ir) {
        if (di < ir * 0.45) return INK;
        // Darker under the lid, lighter at the bottom and on the lit side.
        const t = 0.35 + ((y - icy) / ir) * 0.35 - side * 0.1;
        return tone(e.iris, t, X, Y);
      }
      // Sclera: shaded by the lid and the light side.
      const t = 0.75 - (side > 0 ? 0.25 : 0) - smoothstep(up(u) + p.px * 1.5, up(u), y) * 0.4 - Math.abs(u) * 0.2;
      return tone([PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[1]], t, X, Y);
    });
    // Catchlight up-left of the pupil.
    p.dot(icx - ir * 0.35, icy - ir * 0.4, PAL.snow[3]);
    // Upper lid line: heavy, thickest at the outer corner, with a short flick.
    const top: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const u = -1.05 + (2.15 * i) / 14;
      top.push([ex + u * half * side, up(Math.max(-1, Math.min(1, u))) - 0.2]);
    }
    p.stroke(top, 0.9, 1.5, lid);
    // Lower lid: a soft shadow line.
    const bot: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = -0.85 + (1.8 * i) / 10;
      bot.push([ex + u * half * side, lo(u) + 0.35]);
    }
    p.stroke(bot, 0.6, 0.8, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -0.3));
    // Lid crease above.
    const cre: Pt[] = top.slice(2, 13).map(([x, y]) => [x, y - (e.kind === 'squint' ? 1.1 : 1.7)] as Pt);
    p.stroke(cre, 0.6, 0.7, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -0.28));
  }
  // Crow's feet: short creases fanning from the outer corner.
  const crow = e.crow ?? 0;
  for (let i = 0; i < crow; i++) {
    const a = -0.5 + i * 0.5;
    const ox = ex + side * (half + 0.8);
    const oy = base(1) + 0.3;
    p.stroke(
      [
        [ox, oy + a * 0.6],
        [ox + side * 2.4, oy + a * 1.8],
      ],
      0.5,
      0.4,
      (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -0.3),
    );
  }
}

/** A brow: a tapered stroke (inner → outer) shaded with a hair ramp, strands, lit on top. */
export function brow(p: Painter, pts: ReadonlyArray<Pt>, w0: number, w1: number, r: Ramp, lit = 0.5, seed = 7): void {
  p.stroke(pts, w0, w1, (t, x, y, X, Y) => {
    const n = strands(x, y, 0.2, 2.5, 0.6, seed);
    return tone(r, lit * (1 - t * 0.3) + (n - 0.5) * 0.6, X, Y, 0.3);
  });
}

/** Nostrils and the tip's highlight. */
export function nostrils(p: Painter, hd: Head, w = 2.2): void {
  const { cx, noseY } = hd.s;
  for (const side of [-1, 1]) {
    const nx = cx + side * (w * 0.75);
    p.paint((x, y, X, Y) => (ell(x, y, nx, noseY + 0.2, 1.05, 0.6) < 1 ? hd.skin(x, y, X, Y, -0.55) : null));
  }
  p.paint((x, y, X, Y) => (ell(x, y, cx - 0.9, noseY - 2.1, 0.9, 0.7) < 1 ? hd.skin(x, y, X, Y, 0.18) : null));
}

/** A line mouth (closed): a curve through the corners and the middle, upper lip shade, lower lip light. */
export function mouthLine(p: Painter, hd: Head, l: Pt, m: Pt, r: Pt, opts: { w?: number; lip?: number; col?: Color } = {}): void {
  const pts = quad(l, [2 * m[0] - (l[0] + r[0]) / 2, 2 * m[1] - (l[1] + r[1]) / 2], r, 14);
  const lip = opts.lip ?? 1.2;
  // Lower lip: a lit pad under the line.
  p.paint((x, y, X, Y) => {
    const [d, t] = lineDist(x, y - lip * 0.9, pts);
    if (d > lip * 0.7 * Math.sin(Math.PI * Math.min(1, Math.max(0, t * 1.15 - 0.075)))) return null;
    return hd.skin(x, y, X, Y, 0.06 - (t > 0.5 ? 0.1 : 0));
  });
  // Shadow under the lower lip.
  p.stroke(
    pts.slice(4, 11).map(([x, y]) => [x, y + lip * 1.9] as Pt),
    0.6,
    0.6,
    (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -0.25),
  );
  // Upper lip: a darker band over the line.
  p.paint((x, y, X, Y) => {
    const [d, t] = lineDist(x, y + lip * 0.55, pts);
    if (d > lip * 0.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))) return null;
    return hd.skin(x, y, X, Y, -0.16);
  });
  p.stroke(pts, opts.w ?? 0.9, opts.w ?? 0.9, opts.col ?? PAL.brown[0]);
}

/** Stubble: a beard-shadow over the jaw, chin and upper lip (density 0..1), mixed into the skin. */
export function stubble(p: Painter, hd: Head, density: number, r: Ramp, region: (x: number, y: number) => number, seed = 3): void {
  p.paint((x, y, X, Y) => {
    if (!hd.inside(x, y)) return null;
    const a = region(x, y) * density;
    if (a <= 0.02) return null;
    // Fine grain (a hash per buffer pixel), denser where the beard grows thick.
    // A zoomed-out view (menu portrait) gets a solid beard shadow: grain there is only noise.
    const g = p.k < 1 ? bayer(X, Y) : hash2(X, Y, seed) * 0.8 + noise2(x, y, 0.9, seed + 1) * 0.2;
    if (g > a * 0.8) return null;
    return tone(r, hd.light(x, y) * 0.95 - 0.04, X, Y, 0.3);
  });
}

/** The usual stubble region: under a line from the sideburns past the nose wings, the lips left out. */
export function beardRegion(hd: Head, o: { top?: number; lipGap?: number; mouthW?: number } = {}): (x: number, y: number) => number {
  const s = hd.s;
  const top = o.top ?? 0;
  const mw = o.mouthW ?? 6;
  return (x, y) => {
    const ax = Math.abs(x - s.cx);
    // The upper edge: high at the sideburns, dipping round the cheeks, over the upper lip.
    const edge = ax > s.rx - 3 ? s.eyeY + 2 : lerp(s.noseY + 1.2, s.eyeY + 7.5, smoothstep(4, s.rx - 4, ax)) + (ax > 4 && ax < s.rx - 3 ? 2.5 * gauss(ax, 0, 11, 0, 4, 1) : 0);
    let a = smoothstep(edge + top - 1.5, edge + top + 2.5, y);
    // Leave the lips clear.
    if (Math.abs(y - s.mouthY - 0.6) < (o.lipGap ?? 1.4) && ax < mw) a *= 0.15;
    // Thinner on the cheeks, thick on the chin and jaw.
    a *= 0.7 + 0.3 * smoothstep(s.mouthY - 2, s.chinY - 4, y);
    return a;
  };
}

// ---------------------------------------------------------------------------------------------
// Hair and cloth
// ---------------------------------------------------------------------------------------------

export interface HairOpts {
  /** Volume centre and radii (for the light). */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Strand direction (radians) at (x, y). */
  dir: (x: number, y: number) => number;
  seed?: number;
  /** Strand contrast (0..1). */
  streak?: number;
  /** Strand length and width. */
  len?: number;
  wid?: number;
  amb?: number;
  /** Tone offset. */
  lift?: number;
}

/** Shade a hair mass inside `mask`: a lit volume, strand streaks along `dir`. */
export function hair(p: Painter, mask: (x: number, y: number) => boolean, r: Ramp, o: HairOpts): void {
  const seed = o.seed ?? 11;
  const streak = o.streak ?? 0.7;
  p.paint((x, y, X, Y) => {
    if (!mask(x, y)) return null;
    const v = ellLight(x, y, o.cx, o.cy, o.rx, o.ry, o.amb ?? 0.05);
    const n = strands(x, y, o.dir(x, y), o.len ?? 5, o.wid ?? 0.9, seed);
    return tone(r, v * 1.1 - 0.1 + (n - 0.5) * streak + (o.lift ?? 0), X, Y, 0.3);
  });
}

/** Cloth over the shoulders: a broad lit volume with soft folds. */
export function cloth(p: Painter, mask: (x: number, y: number) => boolean, r: Ramp, cx: number, cy: number, rx: number, ry: number, o: { lift?: number; grain?: (x: number, y: number) => number } = {}): void {
  p.paint((x, y, X, Y) => {
    if (!mask(x, y)) return null;
    const v = ellLight(x, y, cx, cy, rx, ry, 0.08);
    return tone(r, v + (o.lift ?? 0) + (o.grain ? o.grain(x, y) : 0) - smoothstep(96, 120, y) * 0.35, X, Y, 0.4);
  });
}

/** Shoulders: a rounded trapezoid from the neck base to the frame bottom. */
export function shoulderMask(cx: number, top: number, w: number, bottom = 121): (x: number, y: number) => boolean {
  return (x, y) => {
    if (y < top || y > bottom) return false;
    const ax = Math.abs(x - cx);
    // The trapezius slopes from the neck to the shoulder, which rounds off at the side.
    const k = Math.max(0, ax - w * 0.25);
    const shoulder = top + 0.012 * k * k + (ax > w * 0.85 ? (ax - w * 0.85) * 0.9 : 0);
    return ax < w && y > shoulder;
  };
}

/** Fade the bottom of the frame to black (the bio overlay sits there): an ordered dither. y0, y1 in frame units. */
export function fadeBottom(p: Painter, y0: number, y1: number): void {
  p.paint((_x, _y, X, Y) => {
    const a = smoothstep(y0, y1, (Y + 0.5) / p.d);
    if (a <= 0) return null;
    return a > bayer(X, Y) ? INK : null;
  });
}

/** A 1-unit INK frame round the portrait (2 buffer px at density 2). */
export function frameBorder(p: Painter): void {
  const t = p.d;
  const { b } = p;
  b.rect(0, 0, b.w, t, INK).rect(0, b.h - t, b.w, t, INK).rect(0, 0, t, b.h, INK).rect(b.w - t, 0, t, b.h, INK);
}
