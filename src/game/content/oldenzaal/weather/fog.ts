/**
 * The fog layer generator `oz-fog` (docs/design/oldenzaal.md §10.1, §10.2; ids.ts `OZ_LIGHT.fog`).
 * Owner: LIGHT.
 *
 * A w × h band of drifting ground fog that tiles in x: soft at its top edge (`ramp` px), thick
 * below, broken into slow wisps by a tiling value noise. ONE density-generic drawer: at 1× the
 * colour snaps to the 64-colour PAL and the alpha to 6 steps (pixel-art bands); at 2× / 4× the
 * colour is the PAL_HD / PAL_HD_OZ colour and the alpha has 24 steps sampled at the art px (the
 * same wisps at the same logical places, smoother). Backgrounds carry no ink.
 *
 * Used two ways:
 * - by the mission light pass (src/game/mission/light/pass.ts) for a section's `fog` config (far
 *   bands behind the terrain, a near band over the feet);
 * - as a plain background layer in a section (`{ gen: 'oz-fog', factorX: 0.3, driftX: -0.1,
 *   offsetY: 120, height: 96, alpha: 0.6 }`; `front: true` for a foreground band).
 *
 * Params: `color` (a Color number; default PAL_HD_OZ.night[4]), `ramp` (px of the soft top;
 * default 0.45·h), `base` (0..1 thickness under the wisps; default 0.55), `cell` (wisp length px;
 * default 128; keep the width a multiple of it for a seamless tile). Deterministic (seed).
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineBgGenerator } from '../../../art/art-registry';
import { fbm, snapColor, type Dn } from './noise';

export const OZ_FOG_GEN = 'oz-fog';

function num(p: Readonly<Record<string, unknown>>, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** The fog band at density d ((w·d) × (h·d)). */
export function paintFog(w: number, h: number, params: Readonly<Record<string, unknown>>, seed: number, d: Dn): PixelBuffer {
  const W = w * d;
  const H = h * d;
  const buf = new PixelBuffer(W, H);
  const rgb = (snapColor(num(params, 'color', PAL_HD_OZ.night[4]), d) & 0xffffff00) >>> 0;
  const ramp = Math.max(1, num(params, 'ramp', h * 0.45));
  const base = num(params, 'base', 0.55);
  const cell = Math.max(8, num(params, 'cell', 128));
  const levels = d === 1 ? 6 : 24;
  const data = buf.data;
  for (let Y = 0; Y < H; Y++) {
    const y = (Y + 0.5) / d;
    const t = Math.min(1, y / ramp);
    const prof = t * t * (3 - 2 * t);
    if (prof <= 0) continue;
    for (let X = 0; X < W; X++) {
      const x = (X + 0.5) / d;
      const n = fbm(x, y, cell, cell * 0.19, w, seed);
      let a = prof * (base + (n - 0.42) * 1.5);
      if (a <= 0) continue;
      if (a > 1) a = 1;
      const q = Math.round(a * levels) / levels;
      if (q <= 0) continue;
      data[Y * W + X] = (rgb | Math.round(q * 255)) >>> 0;
    }
  }
  return buf.touch();
}

export function registerFog(): void {
  defineBgGenerator(OZ_FOG_GEN, (w, h, params, seed) => paintFog(w, h, params, seed, 1), {
    hd: (w, h, params, seed, d) => paintFog(w, h, params, seed, d),
  });
}
