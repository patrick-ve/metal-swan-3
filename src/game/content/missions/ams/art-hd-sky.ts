/**
 * UHD sky (docs/ART_GUIDE.md "UHD art"): density-generic 2× / 4× versions of the shared
 * `sky-gradient` and `clouds` generators (art/bg.ts). Only a dense section view (mission ams) or a
 * caller of `makeHiBgLayer(…, d)` draws them; other missions keep their 1× skies.
 *
 * - `sky-gradient`: the listed key colours (top → bottom) become a smooth HD tone path (Oklab steps
 *   between the keys, snapped to PAL_HD, about three tones per 1× band); each key sits at the
 *   centre of its 1× band, and the ordered dither runs on the art grid only near the borders
 *   between tones (a soft gradient, no noise). The sun is a disc with a near-white core and a
 *   gold rim half a logical px wide inside dithered glow rings; the moon has craters with a lit
 *   rim; stars are fine art px with thin rays.
 * - `clouds`: the 1× clouds (same hashes: the same clouds and puffs at the same logical places)
 *   painted as lit volumes: each puff a sphere (key light from the upper left), the front-most
 *   puff shades a px, the body darkens toward the flat base, a lit crest on the upper-left edges,
 *   the cool flat underside of the 1× clouds, a soft paint noise; 6–7 tones from the layer's
 *   ramp param (extended one tone darker and lighter in its HD ramps), dithered only at tone
 *   borders. No outline (style decision for skies).
 *
 * Contract (art-registry.ts defineHdBgGenerator): the same logical (w, h, params, seed) as the 1×
 * generator, a (d·w) × (d·h) buffer of PAL_HD colours, seamless (every shape wraps at d·w).
 */
import type { Color } from '../../../../engine/color';
import { lerpColor } from '../../../../engine/color';
import { nearest, PAL, ramp as rampByName } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import { defineHdBgGenerator, type HdBgGenerator } from '../../../art/art-registry';
import { hash2, noise2 } from '../../../art/paint';
import { BgCanvas, bool, dq, homeOf, idx, ix, mixHd, nearestHd, num, oklab, px, step, type Params } from './art-hd-bg-kit';

function rampParam(p: Params, k: string, d: Ramp): Ramp {
  const v = p[k];
  if (typeof v === 'string') return rampByName(v);
  if (Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'number')) return v as Ramp;
  return d;
}

/** The sky's key colours (top → bottom), read like the 1× generator. */
function skyKeys(p: Params): Color[] {
  const listed = p.colors;
  if (Array.isArray(listed) && listed.length > 0) {
    const c = listed.filter((v): v is number => typeof v === 'number');
    if (c.length > 0) return c;
  }
  if (typeof p.top === 'number' && typeof p.bottom === 'number') {
    const n = Math.max(2, num(p, 'bands', 5));
    const out: Color[] = [];
    for (let i = 0; i < n; i++) {
      const c = nearest(lerpColor(p.top, p.bottom, i / (n - 1)));
      if (out[out.length - 1] !== c) out.push(c);
    }
    return out;
  }
  const r = rampParam(p, 'ramp', PAL.sky);
  return bool(p, 'reverse', false) ? [...r].reverse() : [...r];
}

/**
 * The HD tone path through the keys (top → bottom): from each key the path walks the key's own HD
 * ramp toward the next key's lightness (so a blue sky brightens through its blue tones instead of
 * through greys), then takes the next key. The zenith gets one deeper tone of the first key's
 * ramp above the first key. Returns the tones and the path position of every key.
 */
function skyPath(keys: readonly Color[]): { tones: Color[]; at: number[] } {
  const tones: Color[] = [];
  const at: number[] = [];
  const push = (c: Color): void => {
    if (tones[tones.length - 1] !== c) tones.push(c);
  };
  // The zenith tone: one step deeper than a light first key (a dark first key is deep enough).
  const l0 = oklab(keys[0])[0];
  if (l0 > 0.6) push(step(keys[0], keys.length > 1 && oklab(keys[1])[0] < l0 ? 1 : -1));
  for (let k = 0; k < keys.length; k++) {
    const a = nearestHd(keys[k]);
    push(a);
    at.push(tones.length - 1);
    if (k + 1 >= keys.length) break;
    const b = nearestHd(keys[k + 1]);
    const la = oklab(a)[0];
    const lb = oklab(b)[0];
    const home = homeOf(a);
    const dir = lb > la ? 1 : -1;
    for (let i = home.i + dir; i >= 0 && i < home.ramp.length; i += dir) {
      const c = home.ramp[i] >>> 0;
      const l = oklab(c)[0];
      if (dir > 0 ? l >= lb - 0.015 : l <= lb + 0.015) break;
      push(c);
    }
  }
  return { tones, at };
}

// ------------------------------------------------------------------------------------ sky-gradient

const skyGradientHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const keys = skyKeys(p);
  const { tones, at } = skyPath(keys);
  const ti = idx(tones);
  const n = keys.length;
  const z1 = Math.max(0, Math.min(0.5, num(p, 'dither', 0.3)));
  const z = z1 === 0 ? 0 : Math.min(0.9, 0.25 + z1 * 1.2);
  const y0 = px(p, 'y0', 0, h);
  const y1 = px(p, 'y1', h, h);
  const span = Math.max(1, y1 - y0);
  const { W, H } = c;
  const pxs = c.px;
  /** The continuous path tone at a logical y. */
  const toneAt = (y: number): number => {
    const q = Math.max(-1, Math.min(n - 1, ((y - y0) / span) * n - 0.5));
    // Above the first key's band centre the sky deepens toward the zenith tone (path tone 0).
    if (q < 0 || n === 1) return at[0] * (1 + Math.max(-1, Math.min(0, q)));
    const s = Math.min(n - 2, Math.floor(q));
    const f = q - s;
    return at[s] + (at[s + 1] - at[s]) * f;
  };
  for (let Y = 0; Y < H; Y++) {
    const v = toneAt((Y + 0.5) / d) + 0.5;
    const fr = v - Math.floor(v);
    const row = Y * W;
    if (z === 0 || (fr > z / 2 && fr < 1 - z / 2)) {
      const k = Math.floor(v);
      pxs.fill(ti[k < 0 ? 0 : k >= ti.length ? ti.length - 1 : k], row, row + W);
      continue;
    }
    for (let X = 0; X < W; X++) {
      const k = dq(v, X, Y, z);
      pxs[row + X] = ti[k < 0 ? 0 : k >= ti.length ? ti.length - 1 : k];
    }
  }
  // Stars: a fine art px each (dim), or a small block with thin rays (bright).
  const stars = num(p, 'stars', 0);
  const dim = ix(PAL_HD.snow[4]);
  const bright = ix(PAL_HD.snow[6]);
  const ray = ix(PAL_HD.snow[3]);
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(hash2(i, 1, seed) * w);
    const y = Math.floor(hash2(i, 2, seed) ** 1.6 * h * 0.7);
    const X = x * d + (d >> 1);
    const Y = y * d + (d >> 1);
    if (hash2(i, 3, seed) <= 0.8) {
      c.dot(X, Y, dim);
      continue;
    }
    const s = d >> 1;
    c.rectA(X - (s >> 1), Y - (s >> 1), s, s, bright);
    if (hash2(i, 4, seed) > 0.5) {
      for (let k = 1; k <= d; k++) {
        const col = k > d / 2 ? ray : dim;
        c.dot(X + k, Y, col);
        c.dot(X - k, Y, col);
        c.dot(X, Y + k, col);
        c.dot(X, Y - k, col);
      }
    }
  }
  // The sun (or the moon): glow rings, a disc with a lit core and a rim.
  const sun = p.sun as { x?: number; y?: number; r?: number } | undefined;
  if (sun && typeof sun === 'object') {
    const sx = (sun.x ?? 0.7) <= 1 ? (sun.x ?? 0.7) * w : (sun.x ?? 0);
    const sy = (sun.y ?? 0.3) <= 1 ? (sun.y ?? 0.3) * h : (sun.y ?? 0);
    const sr = sun.r ?? 10;
    const moon = bool(p, 'moon', false);
    const local = tones[Math.max(0, Math.min(tones.length - 1, Math.round(toneAt(sy))))];
    // Glow: the next lighter tones of the local sky's own ramp (a bright halo, never grey).
    const glow = idx([local, step(local, 1), step(local, 2), step(local, 3)]);
    const disc = moon
      ? idx([PAL_HD.snow[3], PAL_HD.snow[4], PAL_HD.snow[5], PAL_HD.snow[6]])
      : idx([PAL_HD.gold[5], PAL_HD.gold[6], PAL_HD.gold[6], PAL_HD.gold[7]]);
    const rim = 0.5 / sr;
    const R = sr * 2.3;
    c.disc(sx, sy, R, R, (X, Y, u, v) => {
      const dd = Math.hypot(u, v) * (R / sr);
      if (dd >= 1) {
        // Glow: rings that fade out (dithered at their borders); ring 0 keeps the sky.
        const g = ((2.3 - dd) / 1.3) * (glow.length - 0.6);
        if (g <= 0) return 0;
        const k = dq(g, X, Y, 0.7);
        return k <= 0 ? 0 : glow[k >= glow.length ? glow.length - 1 : k];
      }
      if (dd > 1 - rim) return disc[0];
      // The core: a near-white centre a little up-left, warmer toward the rim.
      const cu = u * (R / sr) + 0.25;
      const cv = v * (R / sr) + 0.25;
      const t = 1 - Math.min(1, Math.hypot(cu, cv));
      return disc[Math.min(3, 1 + Math.max(0, dq(t * 3, X, Y, 0.5)))];
    });
    if (moon) {
      // Craters: a dark pit with a lit lower-right rim.
      const pit = ix(PAL_HD.snow[2]);
      const lit = ix(PAL_HD.snow[6]);
      for (const [fx, fy, fr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.35, -0.35, 0.1]] as const) {
        const cx = sx + sr * fx;
        const cy = sy + sr * fy;
        const r = Math.max(0.6, sr * fr);
        c.disc(cx, cy, r, r, (_X, _Y, u, v) => (u + v > 0.9 ? lit : pit));
      }
    }
  }
  return c.finish();
};

// ------------------------------------------------------------------------------------ clouds

/** Scratch per-cloud buffers (grown when needed). */
let zbuf = new Float32Array(0);
let vbuf = new Float32Array(0);

const L_X = -0.55;
const L_Y = -0.6;
const L_Z = 0.58;

const cloudsHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const r = rampParam(p, 'ramp', PAL.snow);
  // 6–7 tones: one darker than the ramp's first key, the keys, one lighter than its last.
  const keys = [step(r[0], -1), ...r.map((k) => nearestHd(k)), step(r[r.length - 1], 1)];
  const tones: Color[] = [];
  for (let k = 0; k < keys.length; k++) {
    if (tones[tones.length - 1] !== keys[k]) tones.push(keys[k]);
    if (k + 1 < keys.length && k > 0 && k + 1 < keys.length - 1) {
      const m = mixHd(keys[k], keys[k + 1], 0.5);
      if (m !== keys[k] && m !== keys[k + 1]) tones.push(m);
    }
  }
  const ti = idx(tones);
  const top = ti.length - 1;
  const yc = px(p, 'y', 0.25, h);
  const spread = num(p, 'spread', 18);
  const count = Math.max(1, Math.round(num(p, 'count', 5)));
  const size = num(p, 'size', 9);
  const { W } = c;
  for (let i = 0; i < count; i++) {
    const cx = ((i + hash2(i, 1, seed) * 0.6) / count) * w;
    const cy = yc + (hash2(i, 2, seed) - 0.5) * spread * 2;
    const len = size * (2.2 + hash2(i, 3, seed) * 2.5);
    const puffs = 3 + Math.floor(hash2(i, 4, seed) * 4);
    const base = Math.round(cy + size * 0.5);
    // The 1× puffs, each with 2–4 smaller billows on its upper rim (a cumulus edge, not balls).
    const P: Array<[number, number, number, number]> = [];
    let maxR = 0;
    for (let k = 0; k < puffs; k++) {
      const t = puffs === 1 ? 0.5 : k / (puffs - 1);
      const pr = size * (0.6 + Math.sin(t * Math.PI) * 0.7) * (0.8 + hash2(i, k + 10, seed) * 0.4);
      const pxc = cx - len / 2 + t * len;
      const pyc = base - pr * 0.75;
      P.push([pxc, pyc, pr, 1]);
      if (pr > maxR) maxR = pr;
      const nb = 2 + Math.floor(hash2(i, k + 40, seed) * 3);
      for (let b = 0; b < nb; b++) {
        const ang = Math.PI * (1.12 + (0.76 * (b + 0.3 + hash2(i, k * 7 + b, seed + 3) * 0.4)) / nb);
        const br = pr * (0.34 + hash2(i, k * 7 + b, seed + 4) * 0.16);
        P.push([pxc + Math.cos(ang) * pr * 0.66, pyc + Math.sin(ang) * pr * 0.66, br, 0]);
      }
    }
    // A low flat slab along the base joins the puffs (no balls hanging at the ends); drawn first,
    // the puffs bulge out of it.
    P.unshift([cx, base - size * 0.3, 0, -1]);
    // The cloud's art-px box: the 1× rows floor(pyc − pr) … base.
    let ly0 = Infinity;
    for (const q of P) if (q[3] >= 0) ly0 = Math.min(ly0, Math.floor(q[1] - q[2]));
    const X0 = Math.floor((cx - len / 2 - maxR - 1) * d);
    const X1 = Math.ceil((cx + len / 2 + maxR + 1) * d);
    const Y0 = Math.max(0, ly0 * d);
    const Y1 = Math.min(c.H, (base + 1) * d);
    const bw = X1 - X0;
    const bh = Y1 - Y0;
    if (bw <= 0 || bh <= 0) continue;
    if (zbuf.length < bw * bh) {
      zbuf = new Float32Array(bw * bh * 2);
      vbuf = new Float32Array(bw * bh * 2);
    }
    zbuf.fill(-1, 0, bw * bh);
    // Every puff: a sphere; the front-most surface (largest height) lights the px.
    for (const [pxc, pyc, pr0, main] of P) {
      // The slab: an ellipse len / 2 + ⅓ size wide, 0.55 size high (its height field is squashed).
      const slab = main < 0;
      const pr = slab ? len / 2 + size * 0.35 : pr0;
      const sy = slab ? 0.55 * size / pr : 1;
      const ya = Math.max(Y0, Math.floor((pyc - pr * sy) * d));
      const yb = Math.min(Y1 - 1, Math.ceil((pyc + pr * sy) * d));
      const xa = Math.max(X0, Math.floor((pxc - pr) * d));
      const xb = Math.min(X1 - 1, Math.ceil((pxc + pr) * d));
      const crest = 1 - 0.9 / pr;
      for (let Y = ya; Y <= yb; Y++) {
        const y = (Y + 0.5) / d;
        const ny = (y - pyc) / (pr * sy);
        if (ny * ny > 1) continue;
        const o = (Y - Y0) * bw;
        for (let X = xa; X <= xb; X++) {
          const nx = ((X + 0.5) / d - pxc) / pr;
          const r2 = nx * nx + ny * ny;
          if (r2 > 1) continue;
          const nz = Math.sqrt(1 - r2);
          const zz = slab ? nz * size * 0.4 : nz * pr;
          const k = o + X - X0;
          if (zz <= zbuf[k]) continue;
          zbuf[k] = zz;
          // Soft wrapped light: a cloud is a volume, not a glossy ball.
          const lit = Math.max(0, (nx * L_X + ny * L_Y + nz * L_Z + 0.3) / 1.3);
          // Lighter with height above the base (the body darkens toward its flat base).
          const up = Math.min(1, Math.max(0, (base - y) / (size * 1.3)));
          let v = 0.16 + lit * 0.5 + up * 0.36;
          // A soft crease under a billow where it sits on the body (its lower-right rim).
          if (main === 0 && r2 > crest * crest * 0.7 && nx + ny > 0.5) v -= 0.18;
          vbuf[k] = v;
        }
      }
    }
    // Quantise: a soft paint noise, the cool flat underside (the 1× two shaded rows), dither at borders.
    const under = (base - 1) * d;
    const rim = d >> 1;
    for (let Y = Y0; Y < Y1; Y++) {
      const o = (Y - Y0) * bw;
      const row = Y * W;
      for (let X = X0; X < X1; X++) {
        const k = o + X - X0;
        if (zbuf[k] < 0) continue;
        let v = vbuf[k];
        if (Y >= under) v = Math.min(v, 0.2);
        else {
          v += (noise2(X / d, Y / d, 2.5, seed + i) - 0.5) * 0.14;
          // The crest: a lit rim half a logical px wide on the cloud's upper-left silhouette.
          const xo = X - X0 - rim;
          const yo = Y - Y0 - rim;
          if (xo < 0 || yo < 0 || zbuf[yo * bw + xo] < 0) v = Math.max(v, 0.97);
        }
        const t = dq(v * top + 0.5, X, Y, 0.55);
        let x = X % W;
        if (x < 0) x += W;
        c.px[row + x] = ti[t < 0 ? 0 : t > top ? top : t];
      }
    }
  }
  return c.finish();
};

defineHdBgGenerator('sky-gradient', skyGradientHd);
defineHdBgGenerator('clouds', cloudsHd);
