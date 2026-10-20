/**
 * Procedural explosions: white flash → billowing fireball → rolling dark smoke that frays away.
 *
 * An explosion is a set of seeded round "puffs". Each puff appears, swells, drifts out and up,
 * and cools: hot puffs map to the fire ramp (white core → yellow → orange → red rim), cooled
 * puffs to smoke greys. Every puff is shaded on its own from the top-left, so the overlapping
 * circles read as separate billows. Ordered (Bayer) dither softens band borders and frays the
 * dying smoke. Large sizes are computed at half resolution and doubled (chunky pixels).
 * The HD twins (2× and 4×, the same puffs and timeline) are drawn by fx/hd/explosion.ts.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { bayer, hash2 } from '../../art/paint';

export interface Puff {
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

export function makePuffs(n: number, seed: number): Puff[] {
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

export function ease(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return 1 - (1 - k) * (1 - k);
}

/** Live puffs at time t: centre, radius and heat (lower puffs last: they are drawn in front). */
export function livePuffs(puffs: readonly Puff[], t: number, R: number, cx: number, cy: number): Array<{ x: number; y: number; r: number; heat: number }> {
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
