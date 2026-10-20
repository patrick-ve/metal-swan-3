/**
 * HD explosions (2× and 4×, docs/ART_GUIDE.md "UHD art"): the same seeded puffs and timeline as
 * the 1× explosion (fx/explosion.art.ts), each puff a cauliflower VOLUME (a core ball and a ring
 * of lumps, `paintBillows`, written straight into the canvas G-buffer) —
 *
 * - hot puffs: flat fire whose tone comes from the puff's heat, the key light on each lump (a
 *   white-hot cluster upper left) and soft turbulence (`NoiseGrid`), crimson in the crevices
 *   where a nearer billow overlaps it;
 * - cooled puffs: lit warm-grey smoke (soft matte volumes: each lump's normal blended with its
 *   billow's sphere normal, a wide wrap and a cool bounce, ambient occlusion where billows meet),
 *   still glowing red underneath while young (a smooth radial glow round each billow's lower
 *   centre), with ember cells;
 * - the dying smoke darkens (as the 1× puffs do) and erodes from the rim along smooth turbulence
 *   with a finer second octave (ragged, solid wisps; an ordered fray would leave small holes that
 *   the outline fills: mesh balls at 4×).
 *
 * Frame 0 is the white flash: a disc with four long and four short spikes, white → gold → orange.
 * Outline A: deep ember while hot, the smoke's own deep tone once smoke (no ink rocks).
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { livePuffs, makePuffs, type ExplosionSpec } from '../explosion.art';
import { EMBER, FIRE, NoiseGrid, fireMat, hash, hdStrip, lambert, paintBillows, sat, type HdCanvas } from './kit';

/** Dark explosion smoke (warm grey, near-ink deep shade). */
const SMOKE: Ramp = PAL_HD.stone;

/**
 * The white flash: a hot disc of radius r with four long spikes on the axes and four short
 * diagonal ones, centred (cx, cy) in logical px.
 */
export function drawFlash(c: HdCanvas, cx: number, cy: number, r: number, spikeW: number): void {
  const fire = fireMat(c);
  const long = r * 1.6;
  const short = r * 1.18;
  c.plane(cx - long - 1, cy - long - 1, long * 2 + 2, long * 2 + 2, {
    mat: fire,
    tex: (s) => {
      const dx = s.x - cx;
      const dy = s.y - cy;
      const dist = Math.hypot(dx, dy);
      let h = dist < r ? 1 - 0.5 * (dist / r) ** 2 : 0;
      // Axis spikes: a tapered wedge of half-width spikeW at the disc.
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      for (const [a, b] of [[ax, ay], [ay, ax]] as const) {
        if (a > long) continue;
        const w = spikeW * (1 - a / long) + 0.12;
        if (b < w) h = Math.max(h, 0.42 + 0.5 * (1 - a / long) + 0.25 * (1 - b / w));
      }
      // Diagonal spikes.
      const p = Math.abs(dx + dy) * Math.SQRT1_2;
      const q = Math.abs(dx - dy) * Math.SQRT1_2;
      for (const [a, b] of [[p, q], [q, p]] as const) {
        if (a > short) continue;
        const w = spikeW * 0.7 * (1 - a / short) + 0.1;
        if (b < w) h = Math.max(h, 0.3 + 0.45 * (1 - a / short));
      }
      if (h <= 0) {
        s.cut = true;
        return;
      }
      s.tone = Math.min(0.999, h) - 0.5;
    },
  });
}

/** Explosion frames at density d for sprite `id` (1× frames from `spec`; same puffs and timeline). */
export function explosionFramesHd(id: string, spec: ExplosionSpec, d: number): Frame[] {
  const scale = spec.chunky ? 2 : 1;
  const R = spec.radius / scale;
  const size = Math.ceil(R * 2.8) + 4;
  const puffs = makePuffs(spec.puffs ?? 7, spec.seed);
  const cx = size / 2;
  const cy = size / 2 + R * 0.15;
  return hdStrip(id, d, (c, i) => {
    const t = spec.frames > 1 ? i / (spec.frames - 1) : 0;
    if (i === 0) {
      drawFlash(c, cx * scale, cy * scale, R * 0.55 * scale, Math.max(0.7, scale * 0.8));
      return c.render({ outline: 'A', ink: PAL_HD.fire[3], ao: 0, sep: false });
    }
    const fire = fireMat(c);
    // Smoke: a soft matte volume (wide wrap, a cool bounce), so a billow reads as one soft form
    // with lumps on it, not as a pile of hard-banded rocks.
    const smoke = c.material({ ramp: SMOKE, lo: 0, hi: 4, wrap: 0.34, bounce: 0.4, rim: 0.08, amb: 0.12 });
    const live = livePuffs(puffs, t, R, cx, cy);
    const fade = Math.max(0, (t - 0.66) / 0.34);
    const seed = spec.seed * 31 + i;
    // Turbulence cell: about a third of the base radius (logical px), never below 1.5 px.
    const cell = Math.max(1.5, R * scale * 0.32);
    const rise = t * R * scale * 0.6;
    const n = new NoiseGrid(c.w, c.h, cell, spec.seed * 7 + i);
    // Erosion of the dying smoke: the rim recedes along a smooth turbulence (billowy, no small holes).
    const ero = fade > 0 ? new NoiseGrid(c.w, c.h, Math.max(1.6, R * scale * 0.34), spec.seed * 11 + i) : null;
    // A finer octave frays that rim into wisps (smooth cells, so still no pin holes).
    const ero2 = fade > 0 ? new NoiseGrid(c.w, c.h, Math.max(1.5, R * scale * 0.13), spec.seed * 13 + i) : null;
    paintBillows(
      c,
      // Smoke billows share one part (no separation lines between them: one soft mass).
      live.map((p, k) => ({ x: p.x * scale, y: p.y * scale, r: p.r * scale, seed: spec.seed * 7 + k * 13, z: k * 4, part: p.heat > 0.12 ? k + 1 : 255 })),
      fade,
      (s, k, q) => {
        const p = live[k];
        const tn = n.at(s.x, s.y - rise);
        const lam = lambert(s.nx, s.ny, s.nz);
        if (p.heat > 0.12) {
          // Heat, the key light on each lump and a swirl of turbulence; the shadow side cools to crimson.
          s.mat = fire;
          s.tone = sat(p.heat * 0.36 + lam * 0.62 + tn * 0.28 - q * q * 0.12 - 0.1) * 0.999 - 0.5;
          return;
        }
        // Smoke: the lump normal blended with its billow's sphere normal (soft, big forms), darker
        // as it ages; young smoke still glows red underneath: a smooth radial glow round the
        // billow's lower centre (one clean cluster per billow, no slivers between lumps).
        const r = p.r * scale;
        const bx = (s.x - p.x * scale) / r;
        const by = (s.y - p.y * scale) / r;
        const bz = Math.sqrt(Math.max(0, 1 - bx * bx - by * by));
        // Thinning smoke flattens toward the viewer (less contrast, no pebbles).
        const fl = fade * 0.9;
        const mx = (s.nx * 0.55 + bx * 0.45) * (1 - fl);
        const my = (s.ny * 0.55 + by * 0.45) * (1 - fl);
        const mz = (s.nz * 0.55 + bz * 0.45) * (1 - fl) + fl;
        const ml = Math.hypot(mx, my, mz) || 1;
        s.nx = mx / ml;
        s.ny = my / ml;
        s.nz = mz / ml;
        s.mat = smoke;
        // Dying smoke darkens and thins (as the 1× puffs do), never a pale pebble.
        s.tone = Math.max(-0.3, p.heat * 0.22) + tn * 0.36 - 0.04 - fade * 0.3;
        if (p.heat > -0.35) {
          const gl = Math.hypot(bx, (by - 0.78) * 1.35);
          const glow = (p.heat + 0.35) * 1.6 * (1 - gl) + tn * 0.25 - 0.18;
          if (glow > 0) {
            s.mat = fire;
            s.tone = sat(glow * 1.4) * 0.3 - 0.5;
            return;
          }
          if (tn > 0.05 && hash(s.X >> 1, s.Y >> 1, seed) > 0.975) s.fix = FIRE[(s.X >> 1) & 1 ? 3 : 2];
        }
      },
      ero && ero2 ? (q, x, y) => q > 1.08 - fade * 0.86 + ero.at(x, y) * 0.42 + ero2.at(x, y) * fade * 0.3 - fade * 0.15 : undefined,
    );
    // Ambient occlusion only on canvases up to ~100k art px (the 4× xl frames rely on their crevices).
    // Outline A: ember while hot; the smoke takes the smoke's own deep tone (no ink rocks), the
    // darkest one once it thins (never a rim lighter than the dark dying puff).
    const ink = t < 0.5 ? EMBER : fade > 0.4 ? SMOKE[0] : SMOKE[1];
    return c.render({ outline: 'A', ink, ao: c.W * c.H > 100_000 ? 0 : 0.3, sep: true, sepZ: 1, clean: true });
  });
}
