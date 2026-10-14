/**
 * Procedural explosions: white flash → billowing fireball → rolling dark smoke that frays away.
 *
 * An explosion is a set of seeded round "puffs". Each puff appears, swells, drifts out and up,
 * and cools: hot puffs map to the fire ramp (white core → yellow → orange → red rim), cooled
 * puffs to smoke greys. Every puff is shaded on its own from the top-left, so the overlapping
 * circles read as separate billows. Ordered (Bayer) dither softens band borders and frays the
 * dying smoke. Large sizes are computed at half resolution and doubled (chunky pixels).
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { bayer, hash2 } from '../../art/paint';

interface Puff {
  /** Start offset (units of the radius). */
  x: number;
  y: number;
  /** Final radius (units of the radius). */
  r: number;
  /** Time it appears (0..1 of the timeline). */
  t0: number;
  /** Upward drift. */
  rise: number;
  /** Cooling speed. */
  cool: number;
}

export interface ExplosionSpec {
  /** Overall radius in px. */
  radius: number;
  frames: number;
  seed: number;
  /** Compute at half resolution and double (chunky clusters). */
  chunky?: boolean;
  /** Number of puffs. */
  puffs?: number;
}

const FIRE = PAL.fire; // red1, red2, orange0, orange1, gold2, gold3, white
const SMOKE: readonly Color[] = [PAL.ink[1], PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]];

function makePuffs(n: number, seed: number): Puff[] {
  const out: Puff[] = [{ x: 0, y: 0.05, r: 0.55, t0: 0, rise: 0.25, cool: 1.5 }];
  const turn = hash2(0, 9, seed) * Math.PI * 2;
  for (let i = 1; i < n; i++) {
    // Evenly spread around the centre (with jitter) so the cloud stays round.
    const a = turn + ((i - 1) / (n - 1)) * Math.PI * 2 + (hash2(i, 1, seed) - 0.5) * 0.7;
    const d = 0.3 + hash2(i, 2, seed) * 0.3;
    out.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * 0.75,
      r: 0.3 + hash2(i, 3, seed) * 0.22,
      t0: hash2(i, 5, seed) * 0.18,
      rise: 0.25 + hash2(i, 4, seed) * 0.45 + (Math.sin(a) < 0 ? 0.25 : 0),
      cool: 1.5 + hash2(i, 6, seed) * 0.8 + (Math.sin(a) < 0 ? 0.4 : 0),
    });
  }
  return out;
}

function ease(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return 1 - (1 - k) * (1 - k);
}

/** Live puffs at time t: centre, radius and heat (lower puffs last: they are drawn in front). */
function livePuffs(puffs: readonly Puff[], t: number, R: number, cx: number, cy: number): Array<{ x: number; y: number; r: number; heat: number }> {
  return (
    puffs
      .filter((p) => t >= p.t0)
      .map((p) => {
        const age = t - p.t0;
        const r = p.r * (0.75 + 0.25 * ease(age / 0.3)) * (1 + 0.25 * age) * R;
        const spread = 0.7 + 0.6 * ease(age / 0.5);
        return {
          x: cx + p.x * spread * R,
          y: cy + (p.y * spread - p.rise * age * age * 1.6) * R,
          r,
          heat: 1.15 - age * p.cool,
        };
      })
      // Lower puffs are drawn in front (bigger, hotter base).
      .sort((a, b2) => a.y - b2.y)
  );
}

/** One frame of an explosion (centre-anchored). */
function explosionFrame(spec: ExplosionSpec, puffs: readonly Puff[], i: number): Frame {
  const scale = spec.chunky ? 2 : 1;
  const R = spec.radius / scale;
  const size = Math.ceil(R * 2.8) + 4;
  const b = new PixelBuffer(size, size);
  const cx = size / 2;
  const cy = size / 2 + R * 0.15;
  const t = spec.frames > 1 ? i / (spec.frames - 1) : 0;

  if (i === 0) {
    // Opening flash: white-hot disc, yellow ring, four short spikes.
    const r = R * 0.55;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const spike = Math.min(Math.abs(x + 0.5 - cx), Math.abs(y + 0.5 - cy)) < 1 ? r * 0.6 : 0;
        if (d < r * 0.75) b.set(x, y, FIRE[6]);
        else if (d < r + spike) b.set(x, y, bayer(x, y) < 0.6 ? FIRE[5] : FIRE[6]);
      }
    }
    b.outline(FIRE[3]);
    const out = scale > 1 ? b.scaled(scale) : b;
    return { buf: out, ox: out.w >> 1, oy: out.h >> 1 };
  }

  const live = livePuffs(puffs, t, R, cx, cy);

  const fade = Math.max(0, (t - 0.66) / 0.34);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = -1;
      let best = 0;
      for (let k = 0; k < live.length; k++) {
        const p = live[k];
        const q = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) / p.r;
        // Later (lower) puffs win where they overlap → visible billows.
        if (q < 1) {
          hit = k;
          best = q;
        }
      }
      if (hit < 0) continue;
      const p = live[hit];
      const q = best;
      // Fraying smoke: the rims go first.
      if (fade > 0 && 1 - q < fade * 1.25 - bayer(x, y) * 0.45) continue;
      // Light from the top-left inside each puff.
      const lx = (x + 0.5 - p.x) / p.r;
      const ly = (y + 0.5 - p.y) / p.r;
      const light = -(lx + ly) * 0.7 + (1 - q) * 0.6;
      if (p.heat > 0.12) {
        const v = p.heat * 4.2 + light * 1.4 + (1 - q) * 1.2 - q * q * 1.5;
        const k = Math.floor(v + (bayer(x, y) - 0.5) * 0.8);
        b.set(x, y, FIRE[Math.max(0, Math.min(FIRE.length - 1, k))]);
      } else {
        const v = 1.6 + light * 2.2 + p.heat * 2;
        const k = Math.floor(v + (bayer(x, y) - 0.5) * 0.8);
        b.set(x, y, SMOKE[Math.max(0, Math.min(SMOKE.length - 1, k))]);
        // A few embers glowing through young smoke.
        if (p.heat > -0.25 && hash2(x, y, spec.seed + i) > 0.94) b.set(x, y, FIRE[2]);
      }
    }
  }
  b.outline(t < 0.5 ? FIRE[0] : INK);
  const out = scale > 1 ? b.scaled(scale) : b;
  return { buf: out, ox: out.w >> 1, oy: out.h >> 1 };
}

/** All frames of an explosion. */
export function explosionFrames(spec: ExplosionSpec): Frame[] {
  const puffs = makePuffs(spec.puffs ?? 7, spec.seed);
  return Array.from({ length: spec.frames }, (_, i) => explosionFrame(spec, puffs, i));
}

/**
 * One 2× frame of an explosion (docs/ART_GUIDE.md "2x art (mission ams)"): the same puffs,
 * timeline and logical size as `explosionFrame`, sampled on the 2× grid, so the billows get
 * round 2× edges. A chunky (half-resolution) size is drawn at full 2× density too: the same
 * shapes, four times finer than its 1× clusters. Band dither, fraying and embers stay on whole
 * geometry cells (the 1× pattern, no single-2×-px speckle), and the rim keeps the 1× weight
 * (`rimHi`).
 * Each puff only scans its own box, so even xl stays cheap.
 */
function explosionFrameHi(spec: ExplosionSpec, puffs: readonly Puff[], i: number): Frame {
  const scale = spec.chunky ? 2 : 1;
  const R = spec.radius / scale;
  const size = Math.ceil(R * 2.8) + 4;
  // 2× px per unit of the puff geometry (a 1× px, or a chunky cluster of 2 × 2 1× px).
  const f = scale * 2;
  const n = size * f;
  const b = new PixelBuffer(n, n);
  const cx = size / 2;
  const cy = size / 2 + R * 0.15;
  const t = spec.frames > 1 ? i / (spec.frames - 1) : 0;
  const d = b.data;
  // Cell of the puff geometry (a logical px, or a chunky cluster) of a 2× px: dither and embers
  // use whole cells, so the pattern matches the 1× frame's and never speckles.
  const lp = (v: number): number => Math.floor(v / f);

  if (i === 0) {
    const r = R * 0.55;
    for (let y = 0; y < n; y++) {
      const gy = (y + 0.5) / f;
      for (let x = 0; x < n; x++) {
        const gx = (x + 0.5) / f;
        const dd = Math.hypot(gx - cx, gy - cy);
        const spike = Math.min(Math.abs(gx - cx), Math.abs(gy - cy)) < 1 ? r * 0.6 : 0;
        if (dd < r * 0.75) d[y * n + x] = FIRE[6];
        else if (dd < r + spike) d[y * n + x] = bayer(lp(x), lp(y)) < 0.6 ? FIRE[5] : FIRE[6];
      }
    }
    b.touch();
    rimHi(b, f, FIRE[3]);
    return { buf: b, ox: (n / 2) >> 1, oy: (n / 2) >> 1, density: 2 };
  }

  const live = livePuffs(puffs, t, R, cx, cy);
  // Winning puff per 2× px (later = lower puffs win where they overlap) and its distance ratio.
  const hit = new Int8Array(n * n).fill(-1);
  const qs = new Float32Array(n * n);
  // Box of all puffs: the later passes only scan it.
  let bx0 = n;
  let by0 = n;
  let bx1 = -1;
  let by1 = -1;
  for (let k = 0; k < live.length; k++) {
    const p = live[k];
    const x0 = Math.max(0, Math.floor((p.x - p.r) * f));
    const x1 = Math.min(n - 1, Math.ceil((p.x + p.r) * f));
    const y0 = Math.max(0, Math.floor((p.y - p.r) * f));
    const y1 = Math.min(n - 1, Math.ceil((p.y + p.r) * f));
    bx0 = Math.min(bx0, x0);
    by0 = Math.min(by0, y0);
    bx1 = Math.max(bx1, x1);
    by1 = Math.max(by1, y1);
    const r2 = p.r * p.r;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5) / f - p.y;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5) / f - p.x;
        const q2 = dx * dx + dy * dy;
        if (q2 >= r2) continue;
        hit[y * n + x] = k;
        qs[y * n + x] = Math.sqrt(q2) / p.r;
      }
    }
  }

  const fade = Math.max(0, (t - 0.66) / 0.34);
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const j = y * n + x;
      const k = hit[j];
      if (k < 0) continue;
      const p = live[k];
      const q = qs[j];
      const bd = bayer(lp(x), lp(y));
      if (fade > 0 && 1 - q < fade * 1.25 - bd * 0.45) continue;
      const lx = ((x + 0.5) / f - p.x) / p.r;
      const ly = ((y + 0.5) / f - p.y) / p.r;
      const light = -(lx + ly) * 0.7 + (1 - q) * 0.6;
      if (p.heat > 0.12) {
        const v = p.heat * 4.2 + light * 1.4 + (1 - q) * 1.2 - q * q * 1.5;
        const c = Math.floor(v + (bd - 0.5) * 0.8);
        d[j] = FIRE[Math.max(0, Math.min(FIRE.length - 1, c))];
      } else {
        const v = 1.6 + light * 2.2 + p.heat * 2;
        const c = Math.floor(v + (bd - 0.5) * 0.8);
        d[j] = SMOKE[Math.max(0, Math.min(SMOKE.length - 1, c))];
        if (p.heat > -0.25 && hash2(lp(x), lp(y), spec.seed + i) > 0.94) d[j] = FIRE[2];
      }
    }
  }
  b.touch();
  const rim = t < 0.5 ? FIRE[0] : INK;
  // Specks only appear once the cloud frays.
  const specks = fade > 0 ? liftSpecks(b, f) : [];
  rimHi(b, f, rim);
  if (specks.length) dropSpecks(b, f, specks, rim);
  return { buf: b, ox: (n / 2) >> 1, oy: (n / 2) >> 1, density: 2 };
}

/**
 * Takes the tiny bits (at most 2 geometry cells, 4-connected; the last embers and fraying
 * crumbs) out of a 2× explosion frame and returns them as whole cells with their main colour.
 * `dropSpecks` puts them back as 1× specks: whole cells with a plus-shaped rim of whole cells,
 * the 1× silhouette, instead of the round 2× rim that turns a speck into a ring.
 */
function liftSpecks(b: PixelBuffer, f: number): Array<[number, number, Color]> {
  const { w, data } = b;
  const n = w / f;
  const occ = new Uint8Array(n * n);
  for (let y = 0; y < w; y++) {
    const row = ((y / f) | 0) * n;
    for (let x = 0; x < w; x++) if (data[y * w + x] & 255) occ[row + ((x / f) | 0)] = 1;
  }
  const seen = new Uint8Array(n * n);
  const out: Array<[number, number, Color]> = [];
  for (let k0 = 0; k0 < occ.length; k0++) {
    if (!occ[k0] || seen[k0]) continue;
    const comp = [k0];
    seen[k0] = 1;
    for (let j = 0; j < comp.length && comp.length <= 2; j++) {
      const k = comp[j];
      const x = k % n;
      for (const q of [x > 0 ? k - 1 : -1, x < n - 1 ? k + 1 : -1, k - n, k + n]) {
        if (q >= 0 && q < occ.length && occ[q] && !seen[q]) {
          seen[q] = 1;
          comp.push(q);
        }
      }
    }
    if (comp.length > 2) continue;
    for (const k of comp) {
      const cx = (k % n) * f;
      const cy = Math.floor(k / n) * f;
      const votes = new Map<Color, number>();
      for (let y = cy; y < cy + f; y++) {
        for (let x = cx; x < cx + f; x++) {
          const c = data[y * w + x];
          if (c & 255) votes.set(c, (votes.get(c) ?? 0) + 1);
          data[y * w + x] = 0;
        }
      }
      let best: Color = 0;
      let most = 0;
      for (const [c, v] of votes) if (v > most) [best, most] = [c, v];
      out.push([k % n, Math.floor(k / n), best]);
    }
  }
  b.touch();
  return out;
}

/** Puts the specks of `liftSpecks` back: whole cells, then a rim of whole cells on their 4 sides. */
function dropSpecks(b: PixelBuffer, f: number, specks: ReadonlyArray<[number, number, Color]>, rim: Color): void {
  const n = b.w / f;
  for (const [x, y, c] of specks) b.rect(x * f, y * f, f, f, c);
  for (const [x, y] of specks) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const X = x + dx;
      const Y = y + dy;
      if (X < 0 || Y < 0 || X >= n || Y >= n || (b.get(X * f, Y * f) & 255) !== 0) continue;
      b.rect(X * f, Y * f, f, f, rim);
    }
  }
}

/**
 * The rim of a 2× explosion frame (in place), with the 1× weight and pattern: every empty cell of
 * the geometry (`f` × `f` 2× px) next to a cell with art is filled, as the 1× outline fills whole
 * 1× px (whole clusters for a chunky size), and a 2-px line hugs the round 2× edges inside the
 * cells. Diagonal holes of the fraying dither stay open, as at 1×.
 */
function rimHi(b: PixelBuffer, f: number, c: Color): void {
  const { w, h, data } = b;
  const n = w / f;
  const occ = new Uint8Array(n * n);
  // 1 = art, 2 = first ring (4-neighbours); then the second ring = the 8-neighbours of both.
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / f) * n;
    for (let x = 0; x < w; x++) {
      if ((data[y * w + x] & 255) === 0) continue;
      m[y * w + x] = 1;
      occ[row + Math.floor(x / f)] = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (m[i] === 0 && ((x > 0 && m[i - 1] === 1) || (x < w - 1 && m[i + 1] === 1) || (y > 0 && m[i - w] === 1) || (y < h - 1 && m[i + w] === 1))) m[i] = 2;
    }
  }
  // 8-neighbour dilation of rings 1–2, separable: across the row, then down the column.
  const across = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      across[i] = m[i] !== 0 || (x > 0 && m[i - 1] !== 0) || (x < w - 1 && m[i + 1] !== 0) ? 1 : 0;
    }
  }
  const col = c >>> 0;
  for (let y = 0; y < h; y++) {
    const cy = Math.floor(y / f);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (m[i] === 1) continue;
      if (m[i] === 2 || across[i] || (y > 0 && across[i - w]) || (y < h - 1 && across[i + w])) {
        data[i] = col;
        continue;
      }
      const cx = Math.floor(x / f);
      const k = cy * n + cx;
      if (!occ[k] && ((cx > 0 && occ[k - 1]) || (cx < n - 1 && occ[k + 1]) || (cy > 0 && occ[k - n]) || (cy < n - 1 && occ[k + n]))) data[i] = col;
    }
  }
  b.touch();
}

/** The 2× frames of an explosion (same spec as `explosionFrames`). */
export function explosionFramesHi(spec: ExplosionSpec): Frame[] {
  const puffs = makePuffs(spec.puffs ?? 7, spec.seed);
  return Array.from({ length: spec.frames }, (_, i) => explosionFrameHi(spec, puffs, i));
}

/**
 * A small cloud puff (smoke, soot, dust): three lumps that swell, rise a little and fray.
 * `ramp` is dark → light.
 */
export function cloudFrames(radius: number, frames: number, ramp: readonly Color[], outline: Color, seed = 1): Frame[] {
  const out: Frame[] = [];
  const size = radius * 2 + 8;
  const lumps = [0, 1, 2].map((k) => ({
    x: [-0.35, 0.35, 0.05][k] + (hash2(k, 1, seed) - 0.5) * 0.2,
    y: [0.1, 0.15, -0.3][k] + (hash2(k, 2, seed) - 0.5) * 0.2,
    r: [0.65, 0.6, 0.62][k],
  }));
  for (let i = 0; i < frames; i++) {
    const t = frames > 1 ? i / (frames - 1) : 0;
    const b = new PixelBuffer(size, size);
    const R = radius * (0.5 + 0.5 * ease(t * 1.8));
    const cy = size / 2 + 1 - t * 3;
    const fade = Math.max(0, (t - 0.45) / 0.55);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let hit = -1;
        let q = 0;
        for (let k = 0; k < lumps.length; k++) {
          const L = lumps[k];
          const d = Math.hypot(x + 0.5 - (size / 2 + L.x * R), y + 0.5 - (cy + L.y * R)) / (L.r * R);
          if (d < 1) {
            hit = k;
            q = d;
          }
        }
        if (hit < 0) continue;
        if (fade > 0 && 1 - q < fade * 1.2 - bayer(x, y) * 0.4) continue;
        const L = lumps[hit];
        const lx = (x + 0.5 - (size / 2 + L.x * R)) / (L.r * R);
        const ly = (y + 0.5 - (cy + L.y * R)) / (L.r * R);
        const v = (ramp.length - 1) * 0.55 + (-(lx + ly) * 0.7 + (1 - q) * 0.4) * 1.6;
        const k = Math.floor(v + (bayer(x, y) - 0.5) * 0.7);
        b.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, k))]);
      }
    }
    out.push({ buf: b.outline(outline), ox: size >> 1, oy: size >> 1 });
  }
  return out;
}
