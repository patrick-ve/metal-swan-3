/**
 * 2× versions of the shared `sky-gradient` and `clouds` background generators (art/bg.ts) for
 * mission `ams` (docs/ART_GUIDE.md "2x backgrounds and terrain (mission ams)"). Only a section
 * view of density 2 draws 2× layers, so the other missions keep their 1× skies.
 *
 * Both are the 1× generators evaluated at the 2× pixel centres: the bands, the sun and every puff
 * sit at the same logical places, and the ordered dither runs on the 2× grid, so the band
 * transitions and the cloud shading get twice as fine (still crisp, palette only, no blending).
 * The sun gets a smooth rim one logical px wide and a fine halo; clouds keep the
 * flat shaded underside and get a 1-px lit crest on the upper-left edge of each puff.
 *
 * Contract (art-registry.ts defineHiBgGenerator): the same logical (w, h, params, seed) as the 1×
 * generator, a (2·w) × (2·h) buffer, palette only and seamless (every shape wraps at 2·w).
 */
import type { Color } from '../../../../engine/color';
import { lerpColor } from '../../../../engine/color';
import { nearest, PAL, ramp as rampByName } from '../../../../engine/palette';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { defineHiBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, hash2 } from '../../../art/paint';

type Params = Readonly<Record<string, unknown>>;

// The param readers of art/bg.ts (same defaults, so a 2× layer reads its params like the 1× one).

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function px(p: Params, k: string, d: number, of: number): number {
  const v = num(p, k, d);
  return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * of) : Math.round(v);
}

function bool(p: Params, k: string, d: boolean): boolean {
  const v = p[k];
  return typeof v === 'boolean' ? v : d;
}

function rampParam(p: Params, k: string, d: Ramp): Ramp {
  const v = p[k];
  if (typeof v === 'string') return rampByName(v);
  if (Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'number')) return v as Ramp;
  return d;
}

/** Set a 2× pixel, wrapping x into the tile. */
function setW(b: PixelBuffer, X: number, Y: number, c: Color): void {
  if (Y < 0 || Y >= b.h) return;
  const w = b.w;
  b.data[Y * w + (((Math.round(X) % w) + w) % w)] = c >>> 0;
}

function getW(b: PixelBuffer, X: number, Y: number): Color {
  if (Y < 0 || Y >= b.h) return 0;
  const w = b.w;
  return b.data[Y * w + (((Math.round(X) % w) + w) % w)];
}

/** The ramp colour for a continuous index with ordered dither at a 2× pixel. */
function dz(r: Ramp, v: number, X: number, Y: number, spread = 1): Color {
  const k = Math.floor(v + (bayer(X, Y) - 0.5) * spread);
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
}

// ------------------------------------------------------------------------------------ sky-gradient

const skyGradientHi: BgGenerator = (w, h, p, seed) => {
  let colors: Color[];
  const listed = p.colors;
  if (Array.isArray(listed) && listed.length > 0) {
    colors = listed.filter((c): c is number => typeof c === 'number');
  } else if (typeof p.top === 'number' && typeof p.bottom === 'number') {
    const n = Math.max(2, num(p, 'bands', 5));
    colors = [];
    for (let i = 0; i < n; i++) {
      const c = nearest(lerpColor(p.top, p.bottom, i / (n - 1)));
      if (colors[colors.length - 1] !== c) colors.push(c);
    }
  } else {
    const r = rampParam(p, 'ramp', PAL.sky);
    colors = bool(p, 'reverse', false) ? [...r].reverse() : [...r];
  }
  const W = w * 2;
  const H = h * 2;
  const b = new PixelBuffer(W, H);
  const n = colors.length;
  const z = Math.max(0, Math.min(0.5, num(p, 'dither', 0.3)));
  const y0 = px(p, 'y0', 0, h);
  const y1 = px(p, 'y1', h, h);
  for (let Y = 0; Y < H; Y++) {
    // The band position at the 2× row centre (the 1× generator samples logical row centres).
    const u = Math.max(0, Math.min(n - 1e-6, (((Y + 0.5) / 2 - y0) / Math.max(1, y1 - y0)) * n));
    const band = Math.floor(u);
    const f = u - band;
    for (let X = 0; X < W; X++) {
      let k = band;
      const thr = bayer(X, Y);
      if (z > 0) {
        if (f > 1 - z && band + 1 < n && (f - (1 - z)) / (2 * z) > thr) k = band + 1;
        else if (f < z && band > 0 && (z - f) / (2 * z) > thr) k = band - 1;
      }
      b.data[Y * W + X] = colors[k] >>> 0;
    }
  }
  const stars = num(p, 'stars', 0);
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(hash2(i, 1, seed) * w);
    const y = Math.floor(hash2(i, 2, seed) ** 1.6 * h * 0.7);
    const bright = hash2(i, 3, seed) > 0.8;
    if (!bright) {
      // A dim star is one fine 2× pixel.
      setW(b, x * 2, y * 2, PAL.snow[1]);
      continue;
    }
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) setW(b, x * 2 + dx, y * 2 + dy, PAL.snow[3]);
    if (hash2(i, 4, seed) > 0.5) {
      // A twinkle: thin 1-px rays, two 2× px long.
      for (const [dx, dy] of [[2, 0], [3, 0], [-1, 0], [-2, 0], [0, 2], [0, 3], [0, -1], [0, -2]] as const) {
        setW(b, x * 2 + dx, y * 2 + dy, Math.abs(dx) + Math.abs(dy) > 2 ? PAL.sky[2] : PAL.sky[3]);
      }
    }
  }
  const sun = p.sun as { x?: number; y?: number; r?: number } | undefined;
  if (sun && typeof sun === 'object') {
    const sx = (sun.x ?? 0.7) <= 1 ? (sun.x ?? 0.7) * w : (sun.x ?? 0);
    const sy = (sun.y ?? 0.3) <= 1 ? (sun.y ?? 0.3) * h : (sun.y ?? 0);
    const sr = sun.r ?? 10;
    const moon = bool(p, 'moon', false);
    const core = moon ? PAL.snow[2] : PAL.gold[3];
    const rim = moon ? PAL.snow[0] : PAL.gold[2];
    for (let Y = Math.floor((sy - sr * 2.2) * 2); Y <= (sy + sr * 2.2) * 2; Y++) {
      for (let X = Math.floor((sx - sr * 2.2) * 2); X <= (sx + sr * 2.2) * 2; X++) {
        const lx = (X + 0.5) / 2 - sx;
        const ly = (Y + 0.5) / 2 - sy;
        const d = Math.hypot(lx, ly) / sr;
        // Rim: one logical px wide (2 × 2 px), as an outline at 2×.
        if (d < 1 - 1 / sr) setW(b, X, Y, core);
        else if (d < 1) setW(b, X, Y, rim);
        else if (d < 1.9 && bayer(X, Y) < (1.9 - d) * 0.35) setW(b, X, Y, moon ? PAL.snow[0] : PAL.gold[3]);
      }
    }
    if (moon) {
      // Craters: a dark pit with a lit lower-right rim.
      for (const [fx, fy] of [[-0.3, -0.2], [0.25, 0.3]] as const) {
        const X = Math.round((sx + sr * fx) * 2);
        const Y = Math.round((sy + sr * fy) * 2);
        setW(b, X, Y, PAL.snow[0]);
        setW(b, X + 1, Y, PAL.snow[0]);
        setW(b, X, Y + 1, PAL.snow[0]);
        setW(b, X + 1, Y + 1, PAL.snow[3]);
      }
    }
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ clouds

const cloudsHi: BgGenerator = (w, h, p, seed) => {
  const W = w * 2;
  const b = new PixelBuffer(W, h * 2);
  const r = rampParam(p, 'ramp', PAL.snow);
  const top = r.length - 1;
  const yc = px(p, 'y', 0.25, h);
  const spread = num(p, 'spread', 18);
  const count = Math.max(1, Math.round(num(p, 'count', 5)));
  const size = num(p, 'size', 9);
  /** Ramp index of a colour (−1 for empty). */
  const idx = (c: Color): number => ((c & 255) === 0 ? -1 : r.indexOf(c));
  for (let i = 0; i < count; i++) {
    const cx = ((i + hash2(i, 1, seed) * 0.6) / count) * w;
    const cy = yc + (hash2(i, 2, seed) - 0.5) * spread * 2;
    const len = size * (2.2 + hash2(i, 3, seed) * 2.5);
    const puffs = 3 + Math.floor(hash2(i, 4, seed) * 4);
    const base = Math.round(cy + size * 0.5);
    for (let k = 0; k < puffs; k++) {
      const t = puffs === 1 ? 0.5 : k / (puffs - 1);
      const pxc = cx - len / 2 + t * len;
      const pr = size * (0.6 + Math.sin(t * Math.PI) * 0.7) * (0.8 + hash2(i, k + 10, seed) * 0.4);
      const pyc = base - pr * 0.75;
      for (let Y = Math.floor(pyc - pr) * 2; Y <= base * 2 + 1; Y++) {
        if (Y < 0 || Y >= h * 2) continue;
        const ly = ((Y + 0.5) / 2 - pyc) / pr;
        for (let X = Math.floor(pxc - pr) * 2; X <= (pxc + pr) * 2 + 1; X++) {
          const lx = ((X + 0.5) / 2 - pxc) / pr;
          const d = Math.hypot(lx, ly);
          if (d > 1) continue;
          let v = top * 0.65 - (lx + ly) * 0.9;
          // The puff's crest: a 1-px lit rim on its upper-left edge.
          if (d > 1 - 0.5 / pr && lx + ly < -0.5) v = top + 0.5;
          // The flat underside: the 1× shaded band (two logical rows).
          if (Y >= (base - 1) * 2) v = 0.4;
          const c = dz(r, v, X, Y, 0.8);
          // Keep the lighter colour where puffs overlap (soft unions).
          const old = getW(b, X, Y);
          if ((old & 255) === 0 || r.indexOf(c) > idx(old)) setW(b, X, Y, c);
        }
      }
    }
  }
  return b.touch();
};

defineHiBgGenerator('sky-gradient', skyGradientHi);
defineHiBgGenerator('clouds', cloudsHi);
