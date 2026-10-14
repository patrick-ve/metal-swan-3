/**
 * 2× background layers of mission `ams` (docs/ART_GUIDE.md "2x backgrounds and terrain (mission
 * ams)"): `ams-canal-houses`, `ams-elms` and `ams-plein`. Each is its 1× generator
 * (backgrounds.ts) drawn on the 2× grid: the same hashes and loops in logical px put every house,
 * tree, boat, tourist and the tram at the same logical place, so a layer reads exactly as at 1×;
 * the finer grid adds the detail:
 *
 * - canal houses: the 2× house painter (`paintHouseHi`: brick courses, glazing bars, smooth
 *   gables), leafy quay trees, a quay edge with 1-px stone joints, a canal whose reflections
 *   wobble and ripple on 1-px lines, moored sloepen with a lit gunwale and a waterline;
 * - elms: bark furrows, branches that taper to 1-px twigs, canopies of staggered leaf clumps
 *   (a lit top-left pixel each), glazed lanterns and the 2× bikes (`drawBikeHi`);
 * - Museumplein: the Rijksmuseum with 1-px mortar courses, round-arched windows with mullions,
 *   slate courses, smooth spires with a lit edge, leafy plane trees, a mown lawn with blades, the
 *   pool with fine ripples, tourists with hair and two legs, the tram with framed windows,
 *   passengers and a pantograph.
 *
 * Far rows (`haze`) are remapped onto the haze ramp like at 1×, so their extra detail stays soft.
 * Outlines stay 2 px (one logical px), as in all 2× art. Contract (art-registry.ts
 * defineHiBgGenerator): the same logical (w, h, params, seed) as the 1× generator, a
 * (2·w) × (2·h) buffer, palette only and seamless (every shape wraps at 2·w).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineHiBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, hash2, noise1 } from '../../../art/paint';
import { applyLight, isLight, type HouseSpec, type Light } from './art';
import { Q } from './art-hi-ab-kit';
import { paintHouseHi } from './art-hi-ab-houses';
import { drawBikeHi } from './art-hi-ab-street';
import { fillHoles, openSilhouette, rimInside } from './art-hi-canopy';
import { GABLES, HAZE, lum, remap, WALLS_CYCLE, WATER } from './backgrounds';

type Params = Readonly<Record<string, unknown>>;

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** A logical px value; numbers in (0, 1] are fractions of `of` (as in backgrounds.ts). */
function px(p: Params, k: string, d: number, of: number): number {
  const v = num(p, k, d);
  return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * of) : Math.round(v);
}

function bool(p: Params, k: string, d: boolean): boolean {
  const v = p[k];
  return typeof v === 'boolean' ? v : d;
}

function lightOf(p: Params): Light {
  return isLight(p.light) ? p.light : 'morning';
}

/**
 * A density-2 layer canvas that wraps in x: `dot` / `rectH` / `get` take 2× px, `set` / `rect`
 * take logical px (half steps allowed) and cover the same logical pixels as the 1× calls.
 */
class W2 {
  readonly b: PixelBuffer;
  readonly W: number;
  readonly H: number;

  constructor(w: number, h: number) {
    this.b = new PixelBuffer(w * 2, h * 2);
    this.W = w * 2;
    this.H = h * 2;
  }

  dot(X: number, Y: number, c: Color): void {
    if (Y < 0 || Y >= this.H) return;
    const W = this.W;
    this.b.data[Y * W + (((Math.round(X) % W) + W) % W)] = c >>> 0;
  }

  get(X: number, Y: number): Color {
    if (Y < 0 || Y >= this.H) return 0;
    const W = this.W;
    return this.b.data[Y * W + (((Math.round(X) % W) + W) % W)];
  }

  rectH(X: number, Y: number, w: number, h: number, c: Color): void {
    for (let yy = Y; yy < Y + h; yy++) for (let xx = X; xx < X + w; xx++) this.dot(xx, yy, c);
  }

  set(x: number, y: number, c: Color): void {
    this.rectH(Math.round(x * 2), Math.round(y * 2), 2, 2, c);
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    this.rectH(Math.round(x * 2), Math.round(y * 2), Math.round(w * 2), Math.round(h * 2), c);
  }

  /** Copy the opaque pixels of a 2× buffer to 2× position (X, Y), wrapping in x. */
  blit(src: PixelBuffer, X: number, Y: number): void {
    const W = this.W;
    const d = this.b.data;
    const x0 = ((X % W) + W) % W;
    const inside = x0 + src.w <= W;
    for (let y = 0; y < src.h; y++) {
      const ty = Y + y;
      if (ty < 0 || ty >= this.H) continue;
      const row = ty * W;
      const srow = y * src.w;
      for (let x = 0; x < src.w; x++) {
        const c = src.data[srow + x];
        if ((c & 255) === 0) continue;
        d[row + (inside ? x0 + x : (x0 + x) % W)] = c;
      }
    }
  }
}

/** The leaf clump of a 2× pixel (see `leaf`). */
interface Leaf {
  /** The clump's hash in [0, 1). */
  h: number;
  /** +1 on the clump's lit top-left pixel, −1 on its shaded bottom-right one, else 0. */
  rel: number;
  /** The clump's centre (2× px). */
  X: number;
  Y: number;
}

const LEAF: Leaf = { h: 0, rel: 0, X: 0, Y: 0 };

/**
 * Leaf clumps: 3 × 3 2× px, every other row of clumps shifted by 2 px, so a canopy reads as
 * small leaves instead of logical squares. Shade a canopy per clump (from its centre), then add
 * `rel`: each clump gets a lit top-left and a shaded bottom-right pixel. Returns a shared object.
 */
function leaf(X: number, Y: number, seed: number): Leaf {
  const cy = Math.floor(Y / 3);
  const off = (cy & 1) * 2;
  const cx = Math.floor((X + off) / 3);
  const lx = X + off - cx * 3;
  const ly = Y - cy * 3;
  LEAF.h = hash2(cx, cy, seed);
  LEAF.rel = lx === 0 && ly === 0 ? 1 : lx === 2 && ly === 2 ? -1 : 0;
  LEAF.X = cx * 3 + 1 - off;
  LEAF.Y = cy * 3 + 1;
  return LEAF;
}

/** Per light, the colour swaps of art.ts `applyLight` (read once from it, so they always agree). */
const LIGHT_MAPS = new Map<Light, Map<number, number>>();

function lightMap(light: Light): Map<number, number> {
  let m = LIGHT_MAPS.get(light);
  if (m) return m;
  const cols: number[] = [];
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) cols.push((c as number) >>> 0);
  const probe = new PixelBuffer(cols.length, 1);
  probe.data.set(cols);
  applyLight(probe, light);
  m = new Map<number, number>();
  for (let i = 0; i < cols.length; i++) if (probe.data[i] !== cols[i]) m.set(cols[i], probe.data[i]);
  LIGHT_MAPS.set(light, m);
  return m;
}

/**
 * `applyLight` for a big 2× layer: the same swaps, but transparent pixels are skipped and runs of
 * one colour are looked up once (a 2× layer is mostly sky and long runs).
 */
function lightHi(b: PixelBuffer, light: Light): void {
  const m = lightMap(light);
  if (m.size === 0) return;
  const d = b.data;
  let last = -1;
  let to = 0;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if ((c & 255) === 0) continue;
    if (c !== last) {
      last = c;
      to = m.get(c) ?? c;
    }
    d[i] = to;
  }
  b.touch();
}

// ------------------------------------------------------------------------------------ ams-canal-houses

/** backgrounds.ts `smallTree` on the 2× grid: a trunk with a lit edge and a leafy round crown. */
function smallTreeHi(c: W2, cx: number, foot: number, r: number, seed: number, light: Light): void {
  c.rect(cx, foot - r - 6, 2, r + 6, PAL.brown[1]);
  c.rectH(cx * 2, (foot - r - 6) * 2, 1, (r + 6) * 2, PAL.brown[2]);
  const lit = light === 'golden' ? PAL.gold[2] : light === 'sunset' ? PAL.green[2] : PAL.green[3];
  const ccx = cx + 0.5;
  const ccy = foot - r - 8 + 0.5;
  for (let Y = Math.floor((ccy - r - 1) * 2); Y <= (ccy + r + 1) * 2; Y++) {
    const ly = (Y + 0.5) / 2 - ccy;
    for (let X = Math.floor((ccx - r - 3) * 2); X <= (ccx + r + 3) * 2; X++) {
      const lx = (X + 0.5) / 2 - ccx;
      const d = Math.sqrt((lx * lx) / 1.4 + ly * ly);
      if (d > r + 0.25) continue;
      const lf = leaf(X, Y, seed);
      if (d > r - 1.5 && lf.h < 0.4) continue;
      const v = -((lf.X + 0.5) / 2 - ccx) - ((lf.Y + 0.5) / 2 - ccy) + (lf.h - 0.5) * 3 + lf.rel * 1.2;
      c.dot(X, Y, v > r * 0.6 ? lit : v > -r * 0.3 ? PAL.green[2] : PAL.green[1]);
    }
  }
}

const amsCanalHousesHi: BgGenerator = (w, h, p, seed) => {
  const c = new W2(w, h);
  const b = c.b;
  const W = c.W;
  const light = lightOf(p);
  const quay = px(p, 'y', 0.7, h);
  const S = Math.max(8, Math.round(num(p, 's', 12)));
  const haze = num(p, 'haze', 0);
  const water = bool(p, 'water', true);
  // Houses along the quay (the 1× loop and hashes; each house painted on the 2× grid).
  let x0 = 0;
  let i = 0;
  const minW = Math.round(S * 2.1);
  while (x0 < w) {
    let hw = minW + 2 * Math.floor(hash2(i, 1, seed) * S * 0.75);
    if (w - (x0 + hw) < minW) hw = w - x0;
    const spec: HouseSpec = {
      w: hw,
      floors: 2 + Math.floor(hash2(i, 2, seed) * 3),
      gable: GABLES[Math.floor(hash2(i, 3, seed) * GABLES.length)],
      wall: WALLS_CYCLE[Math.floor(hash2(i, 4, seed) * WALLS_CYCLE.length)],
      lean: Math.floor(hash2(i, 5, seed) * 3) - 1,
      seed: seed + i * 13,
      s: S,
      flowers: hash2(i, 6, seed) < 0.5,
    };
    const f = paintHouseHi(spec, true);
    c.blit(f.buf, (x0 + (hw >> 1) - f.ox) * 2, (quay - f.oy) * 2);
    x0 += hw;
    i++;
  }
  // Quay trees in front of the houses.
  const nt = Math.max(1, Math.round(w / 88));
  for (let k = 0; k < nt; k++) {
    const cx = Math.round((k + 0.5) * (w / nt) + (hash2(k, 7, seed) - 0.5) * 20);
    smallTreeHi(c, cx, quay, Math.round(S * 0.9), seed + k, light);
  }
  lightHi(b, light);
  if (haze > 0) remap(b, HAZE[light], 0, 0, W, Math.min(c.H, (quay + 1) * 2));
  // The quay edge: a lit coping, kerb stones with 1-px joints, the dark wall top.
  const Q0 = quay * 2;
  for (let X = 0; X < W; X++) {
    c.dot(X, Q0, PAL.snow[1]);
    c.dot(X, Q0 + 1, PAL.stone[3]);
    const joint = X % 14 === 0;
    c.dot(X, Q0 + 2, joint ? PAL.stone[1] : PAL.stone[2]);
    c.dot(X, Q0 + 3, joint ? PAL.stone[1] : PAL.stone[2]);
    c.dot(X, Q0 + 4, (X & 15) <= 1 ? PAL.ink[1] : PAL.stone[1]);
    c.dot(X, Q0 + 5, (X & 15) <= 1 ? PAL.ink[1] : (X & 15) === 2 ? PAL.stone[2] : PAL.stone[0]);
    c.dot(X, Q0 + 6, PAL.ink[1]);
    c.dot(X, Q0 + 7, PAL.ink[1]);
  }
  if (haze > 0) remap(b, HAZE[light], 0, Q0, W, Math.min(8, c.H - Q0));
  if (!water) return b.touch();
  // The canal: the reflections of the quay row (2:1 squashed as at 1×), wobbling on the 2× grid,
  // darker with depth, with 1-px ripple lines and single sparkles.
  const wr = WATER[light];
  const top = quay + 4;
  const T0 = top * 2;
  for (let Y = T0; Y < c.H; Y++) {
    const D = Y - T0;
    const d = D >> 1;
    // The 1× wobble per logical row (whole logical px: finer steps would shear the reflections).
    const wob = Math.round(Math.sin((d * 2 * Math.PI) / 7) * 1.5) * 2;
    const sY = Q0 - 1 - D * 2;
    // Ripples: the 1× ripple rows split into two 1-px rows of shorter, staggered dashes.
    const rippleRow = D % 8 === 2 || D % 8 === 3;
    for (let X = 0; X < W; X++) {
      let src: Color = 0;
      if (sY >= 0) src = b.data[sY * W + ((((X + wob) % W) + W) % W)];
      let k: number;
      if ((src & 255) === 0) k = wr.length - 2;
      else k = Math.min(wr.length - 2, Math.floor(lum(src) * (wr.length - 1)));
      k -= Math.floor(d / 12);
      if (bayer(X, Y) < 0.25 && d % 3 === 0) k += 1;
      const ripple = (rippleRow && noise1(X / 2 + d * 31 + (D & 1) * 3, 6, w, seed + d * 2 + (D & 1)) > 0.68) || hash2(X, Y, seed + 3) > 0.9985;
      if (ripple) k = wr.length - 1;
      b.data[Y * W + X] = wr[Math.max(0, Math.min(wr.length - 1, k))] >>> 0;
    }
  }
  // Moored boats (sloepen) along the quay: a lit gunwale, the hull with a waterline, a cushion.
  const nb = Math.max(1, Math.round(w / 200));
  for (let k = 0; k < nb; k++) {
    const bx = Math.round((k + 0.3) * (w / nb) + hash2(k, 9, seed) * 40);
    const len = 18 + Math.floor(hash2(k, 10, seed) * 10);
    const ramp = [PAL.green, PAL.navy, PAL.red, PAL.brown][k % 4];
    const col = [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.brown[2]][k % 4];
    c.rect(bx, top + 1, len, 3, col);
    c.rectH(bx * 2, (top + 3) * 2 + 1, len * 2, 1, ramp[0]);
    c.rectH(bx * 2 + 2, (top + 2) * 2, len * 2 - 4, 1, ramp[0]);
    c.rectH(bx * 2, (top + 1) * 2, len * 2, 1, PAL.snow[3]);
    c.rectH(bx * 2, (top + 1) * 2 + 1, len * 2, 1, PAL.snow[1]);
    // The bow rises: its tip is one 2× px higher.
    c.dot((bx + len) * 2 - 1, (top + 1) * 2 - 1, PAL.snow[2]);
    c.rect(bx + 1, top + 4, len - 2, 1, PAL.ink[1]);
    c.rect(bx + 4, top, 3, 1, PAL.red[2]);
    c.rectH((bx + 4) * 2, top * 2, 6, 1, PAL.red[3]);
    c.dot((bx + 7) * 2 - 1, top * 2 + 1, PAL.red[1]);
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ ams-elms

const amsElmsHi: BgGenerator = (w, h, p, seed) => {
  const c = new W2(w, h);
  const b = c.b;
  const light = lightOf(p);
  const mid = px(p, 'y', 0.3, h);
  const spacing = Math.max(64, num(p, 'spacing', 112));
  const n = Math.max(1, Math.round(w / spacing));
  const step = w / n;
  const leafRamp = [PAL.green[0], PAL.green[1], PAL.green[2], PAL.green[3], PAL.green[4]];
  for (let k = 0; k < n; k++) {
    const cx = Math.round(k * step + step / 2 + (hash2(k, 1, seed) - 0.5) * step * 0.3);
    const r = 22 + Math.floor(hash2(k, 2, seed) * 10);
    const cy = mid + Math.floor(hash2(k, 3, seed) * 10) - 5;
    // Trunk: the 1× columns (lit left, dark right) with bark furrows on the 2× grid.
    for (let y = cy; y < h; y++) {
      const tw = y > cy + 40 ? 5 : 4;
      for (let x = 0; x < tw; x++) c.set(cx - 2 + x, y, x === 0 ? PAL.brown[2] : x === tw - 1 ? PAL.brown[0] : PAL.brown[1]);
      for (const v of [0, 1]) {
        const Y = y * 2 + v;
        for (let X = (cx - 1) * 2; X < (cx - 3 + tw) * 2; X++) {
          if ((X * 5 + ((Y / 7) | 0) * 3) % 9 === 0) c.dot(X, Y, PAL.brown[0]);
        }
        if (hash2(cx, Y >> 2, seed + 9) < 0.35) c.dot((cx - 2) * 2 + 1, Y, PAL.brown[3]);
      }
    }
    // Two branches: 2 px thick near the trunk, tapering to 1-px twigs with a fork.
    for (let T = 0; T < 44; T++) {
      const thick = T < 24;
      const XL = (cx - 2) * 2 - T;
      const YL = (cy + 14) * 2 - Math.round(T * 0.7);
      const XR = (cx + 2) * 2 + T + 1;
      const YR = (cy + 12) * 2 - Math.round(T * 0.8);
      c.dot(XL, YL, PAL.brown[1]);
      c.dot(XR, YR, PAL.brown[1]);
      if (thick) {
        c.dot(XL, YL + 1, PAL.brown[0]);
        c.dot(XR, YR + 1, PAL.brown[0]);
      }
    }
    // The forks: 1-px twigs rising steeply from the outer part of each branch.
    for (let sy = 0; sy < 20; sy++) {
      const lift = Math.round(sy * 0.45);
      c.dot((cx - 2) * 2 - 26 - lift, (cy + 14) * 2 - Math.round(26 * 0.7) - sy, PAL.brown[1]);
      c.dot((cx + 2) * 2 + 27 + lift, (cy + 12) * 2 - Math.round(26 * 0.8) - sy, PAL.brown[1]);
    }
    // Canopy clusters, lit from the top left, with ragged leafy holes and a 2-px dark rim. They
    // are painted on their own buffer first: the small holes of the ragged edge are closed and
    // loose clumps dropped, then the silhouette gets one closed 2-px dark rim.
    // The clusters reach at most 1.45 r left and right, 1.24 r up and 1.06 r down.
    const X0 = (cx - Math.ceil(r * 1.5) - 2) * 2;
    const Y0 = (cy - Math.ceil(r * 1.3) - 2) * 2;
    const cv = new PixelBuffer((Math.ceil(r * 3) + 6) * 2, (Math.ceil(r * 2.4) + 6) * 2);
    const put = (X: number, Y: number, col: Color): void => {
      const tx = X - X0;
      const ty = Y - Y0;
      if (tx >= 0 && ty >= 0 && tx < cv.w && ty < cv.h) cv.data[ty * cv.w + tx] = col >>> 0;
    };
    for (let cl = 0; cl < 7; cl++) {
      const bx = cx + Math.round((hash2(k, 10 + cl, seed) - 0.5) * r * 1.5);
      const by = cy + Math.round((hash2(k, 20 + cl, seed) - 0.6) * r * 0.9);
      const br = Math.round(r * (0.45 + hash2(k, 30 + cl, seed) * 0.25));
      const ccx = bx + 0.5;
      const ccy = by + 0.5;
      for (let Y = (by - br) * 2; Y <= (by + br) * 2 + 1; Y++) {
        const ly = (Y + 0.5) / 2 - ccy;
        for (let X = (bx - br) * 2; X <= (bx + br) * 2 + 1; X++) {
          const lx = (X + 0.5) / 2 - ccx;
          const d = Math.sqrt(lx * lx + ly * ly);
          if (d > br + 0.25) continue;
          const lf = leaf(X, Y, seed + 5);
          if (d > br - 3 && lf.h < 0.5) continue;
          const v = (-((lf.X + 0.5) / 2 - ccx) - ((lf.Y + 0.5) / 2 - ccy)) / br + (lf.h - 0.5) * 0.5 + lf.rel * 0.25;
          const li = v > 0.9 ? 4 : v > 0.2 ? 3 : v > -0.5 ? 2 : 1;
          // A cluster's edge is a dark arc where it overlaps leaves already painted; on the
          // outside it is leaves (the silhouette rim comes after).
          if (d > br - 1) {
            const tx = X - X0;
            const ty = Y - Y0;
            const under = tx >= 0 && ty >= 0 && tx < cv.w && ty < cv.h ? cv.data[ty * cv.w + tx] & 255 : 0;
            put(X, Y, under !== 0 ? PAL.green[0] : leafRamp[li]);
            continue;
          }
          put(X, Y, leafRamp[li]);
        }
      }
    }
    fillHoles(cv, PAL.green[1], 64);
    openSilhouette(cv, 2);
    rimInside(cv, PAL.green[0], 2);
    c.blit(cv, X0, Y0);
    // A lamp post between the trees: a slim post with a fine highlight, a glazed lantern, a cap.
    const lx = Math.round(cx + step / 2);
    c.rect(lx, h - 70, 2, 70, PAL.ink[1]);
    c.rectH(lx * 2, (h - 70) * 2, 1, 140, PAL.black[2]);
    c.rect(lx - 1, h - 6, 4, 6, PAL.ink[1]);
    c.rectH((lx - 1) * 2, (h - 6) * 2, 1, 12, PAL.black[2]);
    c.rect(lx - 2, h - 76, 6, 6, PAL.gold[3]);
    c.rectH((lx - 2) * 2, (h - 76) * 2, 1, 12, PAL.ink[1]);
    c.rectH((lx + 4) * 2 - 1, (h - 76) * 2, 1, 12, PAL.ink[1]);
    c.rectH((lx + 1) * 2, (h - 76) * 2, 1, 12, PAL.ink[1]);
    c.rectH((lx - 2) * 2, (h - 71) * 2 + 1, 12, 1, PAL.ink[1]);
    c.dot((lx - 1) * 2, (h - 75) * 2, PAL.snow[3]);
    c.dot((lx - 1) * 2, (h - 75) * 2 + 1, PAL.snow[3]);
    c.rect(lx - 3, h - 77, 8, 1, PAL.ink[1]);
    c.rectH((lx + 1) * 2 - 1, (h - 77) * 2 - 2, 2, 2, PAL.ink[1]);
    if (bool(p, 'bikes', true)) {
      const q = new Q(24, 17);
      drawBikeHi(q, 1, 16, [PAL.ink[1], PAL.red[1], PAL.sky[0], PAL.green[1]][k % 4], k % 2 === 0);
      q.outline();
      c.blit(q.b, (cx + 3) * 2, (h - 17 - 40) * 2);
    }
  }
  lightHi(b, light);
  return b.touch();
};

// ------------------------------------------------------------------------------------ ams-plein

const amsPleinHi: BgGenerator = (w, h, p, seed) => {
  const c = new W2(w, h);
  const b = c.b;
  const light = lightOf(p);
  const lawn = px(p, 'y', 0.72, h);
  const mx0 = Math.round(w * 0.12);
  const mw = Math.round(w * 0.76);
  const top = lawn - 50;
  const brick = PAL.rust[1];
  const course = PAL.rust[0];
  const stone = PAL.sand[3];
  const glass = PAL.navy[1];
  /** A steep slate roof: 2× rows shrink inward, slate courses, a lit left slope. */
  const slate = (x0: number, x1: number, y0: number, h2: number): void => {
    for (let R = 0; R < h2 * 2; R++) {
      const inset = Math.round(R * 0.6);
      const Y = y0 * 2 - 1 - R;
      const midX = x0 + x1;
      for (let X = x0 * 2 + inset; X < x1 * 2 - inset; X++) {
        let col = X < midX ? PAL.steel[2] : PAL.steel[1];
        if (R % 6 === 1) col = PAL.steel[0];
        else if (R % 6 === 4 && (X + (((R / 6) | 0) & 1) * 3) % 6 === 0) col = PAL.steel[0];
        if (X === x0 * 2 + inset && X < midX) col = PAL.steel[3];
        c.dot(X, Y, col);
      }
    }
  };
  /** A round-arched window 3 logical px wide: a stone arch, a keystone and 1-px glazing bars. */
  const archWindow = (x: number, wy: number, hgt: number, keystone: boolean): void => {
    c.rect(x, wy + 1, 3, hgt, glass);
    const X0 = x * 2;
    const Y0 = wy * 2;
    // A round arch: the glass narrows over two 2× rows under a 1-px stone rim and a keystone.
    c.rectH(X0 + 2, Y0 - 2, 2, 1, stone);
    if (keystone) c.rectH(X0 + 1, Y0 - 1, 4, 1, stone);
    else c.rectH(X0 + 2, Y0 - 1, 2, 1, stone);
    c.rectH(X0, Y0, 2, 1, stone);
    c.rectH(X0 + 2, Y0, 2, 1, glass);
    c.rectH(X0 + 4, Y0, 2, 1, stone);
    c.dot(X0, Y0 + 1, stone);
    c.rectH(X0 + 1, Y0 + 1, 4, 1, glass);
    c.dot(X0 + 5, Y0 + 1, stone);
    // Glazing bars (1 px, catching a little light) and a glint on the upper pane.
    c.rectH(X0 + 3, Y0 + 2, 1, hgt * 2, PAL.sky[0]);
    c.rectH(X0 + 1, Y0 + 2 + Math.round(hgt * 0.7), 4, 1, PAL.sky[0]);
    c.dot(X0 + 1, Y0 + 3, PAL.sky[1]);
    c.dot(X0 + 1, Y0 + 4, PAL.sky[0]);
  };
  const facade = (x0: number, x1: number, t: number): void => {
    c.rect(x0, t, x1 - x0, lawn - t, brick);
    // Mortar: a 1-px course line every 3 logical rows and staggered head joints.
    for (let y = t + 2; y < lawn; y += 3) {
      c.rectH(x0 * 2, y * 2 + 1, (x1 - x0) * 2, 1, course);
      const off = ((y / 3) | 0) & 1 ? 4 : 0;
      for (let X = x0 * 2 + off; X < x1 * 2; X += 8) c.dot(X, y * 2 - 1, course);
    }
    // Cream bands (a lit top, a shadow under), string courses, the plinth with block joints.
    c.rect(x0, t, x1 - x0, 2, stone);
    c.rectH(x0 * 2, t * 2 + 3, (x1 - x0) * 2, 1, PAL.sand[2]);
    c.rect(x0, t + 17, x1 - x0, 2, stone);
    c.rectH(x0 * 2, (t + 17) * 2 + 3, (x1 - x0) * 2, 1, PAL.sand[2]);
    c.rect(x0, t + 33, x1 - x0, 1, stone);
    c.rectH(x0 * 2, (t + 33) * 2 + 1, (x1 - x0) * 2, 1, PAL.sand[2]);
    c.rect(x0, lawn - 5, x1 - x0, 5, PAL.sand[2]);
    c.rect(x0, lawn - 5, x1 - x0, 1, stone);
    for (let Y = (lawn - 4) * 2; Y < lawn * 2; Y++) {
      const row = (Y - (lawn - 4) * 2) >> 2;
      if (((Y - (lawn - 4) * 2) & 3) === 3) c.rectH(x0 * 2, Y, (x1 - x0) * 2, 1, PAL.sand[1]);
      else for (let X = x0 * 2 + (row & 1) * 5; X < x1 * 2; X += 10) c.dot(X, Y, PAL.sand[1]);
    }
    // Two rows of tall arched windows and the low plinth windows.
    for (let x = x0 + 3; x + 3 < x1 - 2; x += 6) {
      for (const wy of [t + 5, t + 21]) {
        archWindow(x, wy, 10, true);
        c.set(x + 1, wy + 5, PAL.sky[1]);
        c.dot((x + 1) * 2 + 1, (wy + 5) * 2 + 1, glass);
      }
      c.rect(x, t + 36, 3, 6, glass);
      c.set(x + 1, t + 35, stone);
      c.rectH(x * 2 + 3, (t + 36) * 2, 1, 12, PAL.sky[0]);
    }
  };
  // The long wings.
  facade(mx0, mx0 + mw, top);
  slate(mx0, mx0 + mw, top, 9);
  for (let x = mx0 + 10; x < mx0 + mw - 10; x += 18) {
    // Dormers: a stone frame with a little pointed hood and a glazed sash.
    c.rect(x, top - 6, 4, 5, stone);
    c.rectH(x * 2 + 2, (top - 6) * 2 - 1, 4, 1, stone);
    c.rect(x + 1, top - 5, 2, 3, glass);
    c.rectH((x + 1) * 2, (top - 4) * 2, 4, 1, PAL.sand[2]);
    c.dot((x + 1) * 2, (top - 5) * 2, PAL.sky[1]);
    c.rectH(x * 2 + 7, (top - 6) * 2, 1, 10, PAL.sand[2]);
  }
  // End pavilions (a little higher, lighter brick, own roofs).
  for (const px0 of [mx0 - 6, mx0 + mw - 34]) {
    facade(px0, px0 + 40, top - 8);
    c.rect(px0, top - 8, 2, lawn - top + 8, PAL.rust[2]);
    c.rectH(px0 * 2 + 3, (top - 8) * 2, 1, (lawn - top + 8) * 2, PAL.rust[3]);
    slate(px0, px0 + 40, top - 8, 14);
  }
  // The centre: the passage arcade and the two towers.
  const cx = mx0 + Math.round(mw / 2);
  facade(cx - 46, cx + 46, top - 10);
  slate(cx - 46, cx + 46, top - 10, 10);
  for (let k = -2; k <= 1; k++) {
    const ax = cx + k * 18 + 3;
    c.rect(ax - 1, lawn - 18, 14, 13, stone);
    // A round arch: the opening's top is a half ellipse on the 2× grid, with a 1-px inner rim.
    const ox = ax * 2 + 12;
    const spring = (lawn - 12) * 2;
    for (let Y = (lawn - 17) * 2; Y < (lawn - 5) * 2; Y++) {
      for (let X = ax * 2; X < ax * 2 + 24; X++) {
        const ex = (X + 0.5 - ox) / 12;
        const ey = (Y + 0.5 - spring) / 10;
        if (Y >= spring || ex * ex + ey * ey <= 1) c.dot(X, Y, PAL.ink[1]);
        else if (ex * ex + ey * ey <= 1.35 && Y >= (lawn - 18) * 2 + 1) c.dot(X, Y, PAL.sand[2]);
      }
    }
    // The keystone.
    c.rectH(ox - 1, (lawn - 18) * 2, 2, 3, PAL.sand[2]);
  }
  for (const tx of [cx - 40, cx + 18]) {
    const tw = 22;
    const tt = top - 44;
    c.rect(tx, tt, tw, top - 10 - tt, brick);
    for (let y = tt + 2; y < top - 10; y += 3) {
      c.rectH(tx * 2, y * 2 + 1, tw * 2, 1, course);
      const off = ((y / 3) | 0) & 1 ? 4 : 0;
      for (let X = tx * 2 + off; X < (tx + tw) * 2; X += 8) c.dot(X, y * 2 - 1, course);
    }
    c.rect(tx, tt, 2, top - 10 - tt, PAL.orange[0]); // the lit left edge
    c.rectH(tx * 2, tt * 2, 1, (top - 10 - tt) * 2, PAL.orange[1]);
    for (const [yy, hh] of [[tt, 2], [tt + 14, 2], [tt + 26, 1]] as const) {
      c.rect(tx, yy, tw, hh, stone);
      c.rectH(tx * 2, (yy + hh) * 2 - 1, tw * 2, 1, PAL.sand[2]);
    }
    for (const wx of [tx + 5, tx + 13]) {
      c.rect(wx, tt + 4, 4, 9, glass);
      c.set(wx + 1, tt + 3, stone);
      c.set(wx + 2, tt + 3, stone);
      c.rectH(wx * 2 + 1, tt * 2 + 7, 6, 1, glass);
      c.rectH(wx * 2 + 3, tt * 2 + 8, 2, 18, PAL.sky[0]);
      c.rectH(wx * 2, (tt + 8) * 2, 8, 1, PAL.sky[0]);
      c.dot(wx * 2 + 1, (tt + 4) * 2 + 1, PAL.sky[1]);
      c.rect(wx, tt + 18, 4, 7, glass);
      c.rectH(wx * 2 + 3, (tt + 18) * 2, 2, 14, PAL.sky[0]);
    }
    // The clock-lantern stage: open arches between slim stone columns.
    c.rect(tx + 3, tt - 6, tw - 6, 6, PAL.sand[2]);
    c.rectH((tx + 3) * 2, (tt - 6) * 2, (tw - 6) * 2, 1, stone);
    for (let x = tx + 5; x < tx + tw - 5; x += 3) {
      c.rect(x, tt - 5, 1, 4, PAL.ink[1]);
      c.dot(x * 2 - 1, (tt - 5) * 2, PAL.ink[1]);
      c.dot(x * 2 + 2, (tt - 5) * 2, PAL.ink[1]);
      c.rectH(x * 2 - 1, (tt - 5) * 2 - 1, 4, 1, PAL.sand[1]);
    }
    // The tall slate spire: a smooth taper with a lit left edge and slate bands, a gold tip.
    const sx = (tx + 11) * 2;
    for (let Y = 0; Y < 60; Y++) {
      const half = Math.max(1, Math.round((tw - 6) * (Y / 59)));
      const yy = (tt - 36) * 2 + Y;
      for (let X = -half; X < half; X++) {
        let col = X < 0 ? PAL.steel[2] : PAL.steel[0];
        if (X === -half) col = PAL.steel[3];
        else if (Y % 8 === 7 && X < 0) col = PAL.steel[1];
        c.dot(sx + X, yy, col);
      }
    }
    c.rect(tx + 10, tt - 41, 2, 5, PAL.gold[2]);
    c.rectH((tx + 10) * 2, (tt - 41) * 2, 1, 10, PAL.gold[3]);
    c.rectH((tx + 10) * 2 - 1, (tt - 39) * 2, 6, 2, PAL.gold[2]);
    c.dot((tx + 10) * 2 - 1, (tt - 39) * 2, PAL.gold[3]);
    c.set(tx + 10, tt - 42, PAL.gold[3]);
    c.set(tx + 11, tt - 42, PAL.gold[3]);
    c.dot((tx + 11) * 2 + 1, (tt - 42) * 2 + 1, PAL.gold[1]);
  }
  // Plane trees in a row in front of the museum: a lit trunk and a leafy crown.
  for (let k = 0; k < Math.round(w / 48); k++) {
    const tcx = Math.round(k * 48 + 24 + (hash2(k, 1, seed) - 0.5) * 12);
    const r = 9 + Math.floor(hash2(k, 2, seed) * 5);
    c.rect(tcx, lawn - 14, 2, 14, PAL.brown[1]);
    c.rectH(tcx * 2, (lawn - 14) * 2, 1, 28, PAL.brown[2]);
    c.rectH(tcx * 2 + 3, (lawn - 14) * 2, 1, 28, PAL.brown[0]);
    const ccx = tcx + 0.5;
    const ccy = lawn - 14 - r + 4 + 0.5;
    for (let Y = Math.floor((ccy - r) * 2) - 1; Y <= (ccy + r) * 2 + 1; Y++) {
      const ly = (Y + 0.5) / 2 - ccy;
      for (let X = Math.floor((ccx - r) * 2) - 1; X <= (ccx + r) * 2 + 1; X++) {
        const lx = (X + 0.5) / 2 - ccx;
        if (lx * lx + ly * ly > (r + 0.25) * (r + 0.25)) continue;
        const lf = leaf(X, Y, seed + k);
        if (lx * lx + ly * ly > (r - 1) * (r - 1) && lf.h < 0.35) continue;
        const v = -((lf.X + 0.5) / 2 - ccx) - ((lf.Y + 0.5) / 2 - ccy) + (lf.h - 0.5) * 4 + lf.rel * 1.5;
        c.dot(X, Y, v > r * 0.5 ? PAL.green[4] : v > -r * 0.4 ? PAL.green[3] : PAL.green[2]);
      }
    }
  }
  // The lawn with mowing stripes and fine blades, the long pool and tourists.
  for (let Y = lawn * 2; Y < c.H; Y++) {
    for (let X = 0; X < c.W; X++) {
      const stripe = Math.floor(X / 48) % 2 === 0;
      let col = Y < lawn * 2 + 2 ? PAL.green[4] : stripe ? PAL.green[3] : PAL.green[2];
      // Blades: a ragged lit edge, then sparse 1 × 2 px blades a tone darker.
      if (Y === lawn * 2 + 1 && hash2(X, Y, seed + 4) < 0.3) col = stripe ? PAL.green[3] : PAL.green[2];
      else if (Y >= lawn * 2 + 2 && hash2(X, Y >> 1, seed + 4) < 0.03) col = stripe ? PAL.green[2] : PAL.green[1];
      c.dot(X, Y, col);
    }
  }
  const py = lawn + 8;
  const pw = Math.round(w * 0.8);
  const pl = Math.round(w * 0.1);
  c.rect(pl, py, pw, 6, PAL.stone[3]);
  c.rectH(pl * 2, py * 2, pw * 2, 1, PAL.snow[1]);
  c.rect(pl + 2, py + 1, pw - 4, 4, PAL.sky[1]);
  c.rectH((pl + 2) * 2, (py + 1) * 2, (pw - 4) * 2, 1, PAL.stone[2]);
  for (let X = (pl + 2) * 2; X < (pl + pw - 2) * 2; X++) {
    // Fine ripples: short 1-px dashes in two rows.
    if (noise1(X, 7, c.W, seed + 11) > 0.62) c.dot(X, (py + 2) * 2 + 1, PAL.sky[2]);
    if (noise1(X + 40, 7, c.W, seed + 12) > 0.66) c.dot(X, (py + 4) * 2, PAL.sky[2]);
  }
  for (let x = pl + 2; x < pl + pw - 2; x++) {
    if (hash2(x, 1, seed) > 0.8) {
      c.dot(x * 2, (py + 2) * 2, PAL.snow[3]);
      c.dot(x * 2 + 1, (py + 2) * 2 + 1, PAL.snow[3]);
      c.dot(x * 2 + 1, (py + 2) * 2, PAL.snow[2]);
    }
  }
  const coats = [PAL.red[2], PAL.gold[2], PAL.sky[1], PAL.pink[2], PAL.snow[3], PAL.green[1], PAL.orange[1]];
  const skins = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2]];
  const hair = [PAL.hairA[1], PAL.hairB[1], PAL.hairC[2], PAL.hairB[2]];
  for (let x = 2; x < w; x += 5) {
    if (hash2(x, 3, seed) < 0.55) continue;
    const y = lawn + 2 + Math.floor(hash2(x, 4, seed) * 4);
    const coat = coats[Math.floor(hash2(x, 5, seed) * coats.length)];
    // Head with hair on top, a coat with arms, two legs (a 1-px gap between them).
    c.set(x, y, skins[Math.floor(hash2(x, 6, seed) * 3)]);
    c.rectH(x * 2, y * 2, 2, 1, hair[Math.floor(hash2(x, 8, seed) * hair.length)]);
    c.rect(x, y + 1, 2, 3, coat);
    c.rectH(x * 2 + 3, (y + 1) * 2 + 2, 1, 3, PAL.ink[1]);
    c.dot(x * 2, (y + 4) * 2, PAL.navy[1]);
    c.dot(x * 2, (y + 4) * 2 + 1, PAL.navy[1]);
    c.dot(x * 2 + 2, (y + 4) * 2, PAL.navy[1]);
    c.dot(x * 2 + 2, (y + 4) * 2 + 1, PAL.navy[1]);
    if (hash2(x, 7, seed) < 0.2) {
      // A camera flash.
      c.set(x + 2, y, PAL.snow[3]);
      c.dot((x + 2) * 2 + 1, y * 2 + 1, PAL.ink[1]);
    }
  }
  // A white-blue tram on its track.
  const tx0 = Math.round(w * 0.62);
  const ty = lawn - 13;
  c.rect(0, ty + 14, w, 1, PAL.steel[1]);
  c.rectH(0, (ty + 14) * 2, c.W, 1, PAL.steel[3]);
  c.rect(tx0, ty, 90, 14, PAL.snow[3]);
  c.rectH(tx0 * 2, (ty + 12) * 2, 180, 4, PAL.snow[1]);
  c.rect(tx0, ty + 9, 90, 3, PAL.sky[0]);
  c.rectH(tx0 * 2, (ty + 9) * 2, 180, 1, PAL.sky[1]);
  c.rect(tx0, ty - 1, 90, 1, PAL.steel[3]);
  c.rectH(tx0 * 2, (ty - 1) * 2 + 1, 180, 1, PAL.steel[2]);
  // Rounded cab corners.
  c.dot(tx0 * 2, (ty - 1) * 2, 0);
  c.dot((tx0 + 90) * 2 - 1, (ty - 1) * 2, 0);
  for (let x = tx0 + 4; x < tx0 + 86; x += 9) {
    c.rect(x, ty + 2, 6, 5, PAL.navy[1]);
    c.rectH(x * 2, (ty + 2) * 2, 12, 1, PAL.steel[2]);
    c.rectH(x * 2 + 6, (ty + 2) * 2, 1, 10, PAL.steel[2]);
    c.dot(x * 2 + 1, (ty + 2) * 2 + 1, PAL.sky[1]);
    c.dot(x * 2 + 2, (ty + 2) * 2 + 1, PAL.sky[0]);
    if (hash2(x, 12, seed) < 0.6) {
      // A passenger's head and shoulders.
      const hx = x * 2 + 2 + Math.floor(hash2(x, 13, seed) * 7);
      const sk = skins[Math.floor(hash2(x, 14, seed) * 3)];
      c.rectH(hx, (ty + 2) * 2 + 4, 2, 2, sk);
      c.rectH(hx, (ty + 2) * 2 + 3, 2, 1, hair[Math.floor(hash2(x, 15, seed) * hair.length)]);
      c.rectH(hx - 1, (ty + 2) * 2 + 6, 4, 4, coats[Math.floor(hash2(x, 16, seed) * coats.length)]);
    }
  }
  for (let x = tx0 + 28; x < tx0 + 90; x += 30) {
    c.rect(x, ty, 1, 14, PAL.steel[2]);
    c.rectH(x * 2 + 1, ty * 2, 1, 28, PAL.steel[1]);
  }
  // The pantograph: a fine diamond on the roof, the bow touching the wire.
  const pX = (tx0 + 30) * 2;
  const pY = (ty - 1) * 2;
  for (let i = 0; i < 12; i++) {
    const dx = i < 6 ? i : 12 - i;
    c.dot(pX - dx, pY - i, PAL.ink[1]);
    c.dot(pX + 1 + dx, pY - i, PAL.ink[1]);
  }
  c.rectH(pX, pY - 14, 2, 2, PAL.ink[1]);
  c.rect(tx0 + 24, ty - 8, 13, 1, PAL.ink[1]);
  c.rectH((tx0 + 24) * 2, (ty - 8) * 2, 26, 1, PAL.steel[1]);
  c.rectH(0, (ty - 9) * 2 + 1, c.W, 1, PAL.ink[1]); // overhead wire (1 px)
  lightHi(b, light);
  return b.touch();
};

defineHiBgGenerator('ams-canal-houses', amsCanalHousesHi);
defineHiBgGenerator('ams-elms', amsElmsHi);
defineHiBgGenerator('ams-plein', amsPleinHi);
