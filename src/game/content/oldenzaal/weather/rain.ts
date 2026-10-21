/**
 * The rain layer generator `oz-rain` (docs/design/oldenzaal.md §8, §10.1; ids.ts `OZ_LIGHT.rain`).
 * Owner: LIGHT.
 *
 * A w × h tile of rain streaks that wraps in x AND y (draw it with repeatX and repeatY and move its
 * offset each tick: the mission light pass does, see src/game/mission/light/pass.ts). Each streak
 * is a thin slanted line, faint at its tail and brighter at its head (the bottom). ONE
 * density-generic drawer: at 1× a 1 px line in a PAL colour; at 2× / 4× a 1 art px line (½ or ¼
 * logical px: thin rain at 4K) in PAL_HD_OZ tones, the same streaks at the same logical places.
 * No ink (a background effect).
 *
 * Params: `slant` (x px per y px; default 0.25; positive = falling to the right), `color` (a Color
 * number; default PAL_HD_OZ.night[6]), `count` (streaks per tile; default w·h / 150), `len`
 * (longest streak, px; default 12). Deterministic (seed).
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import { hash2 } from '../../../art/paint';
import { defineBgGenerator } from '../../../art/art-registry';
import { snapColor, type Dn } from './noise';

export const OZ_RAIN_GEN = 'oz-rain';

function num(p: Readonly<Record<string, unknown>>, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** The rain tile at density d ((w·d) × (h·d)). */
export function paintRain(w: number, h: number, params: Readonly<Record<string, unknown>>, seed: number, d: Dn): PixelBuffer {
  const W = w * d;
  const H = h * d;
  const buf = new PixelBuffer(W, H);
  const data = buf.data;
  const slant = num(params, 'slant', 0.25);
  const rgb = (snapColor(num(params, 'color', PAL_HD_OZ.night[6]), d) & 0xffffff00) >>> 0;
  const count = Math.max(1, Math.round(num(params, 'count', (w * h) / 150)));
  const maxLen = Math.max(3, num(params, 'len', 12));
  const levels = d === 1 ? 3 : 8;
  const norm = Math.sqrt(1 + slant * slant);
  for (let i = 0; i < count; i++) {
    const x = hash2(i, 1, seed) * w;
    const y = hash2(i, 2, seed) * h;
    const len = maxLen * (0.45 + 0.55 * hash2(i, 3, seed));
    const bright = 0.45 + 0.4 * hash2(i, 4, seed);
    // Steps of one art px along the streak (its vertical extent is len / norm).
    const steps = Math.max(2, Math.round((len / norm) * d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps; // 0 = tail (top) … 1 = head (bottom)
      const yy = y + (t * len) / norm;
      const xx = x + (t * len * slant) / norm;
      let X = Math.floor(xx * d) % W;
      if (X < 0) X += W;
      let Y = Math.floor(yy * d) % H;
      if (Y < 0) Y += H;
      const a = Math.round(bright * (0.25 + 0.75 * t * t) * levels) / levels;
      if (a <= 0) continue;
      const k = Y * W + X;
      const old = data[k] & 255;
      const na = Math.max(old, Math.round(a * 255));
      data[k] = (rgb | na) >>> 0;
    }
  }
  return buf.touch();
}

export function registerRain(): void {
  defineBgGenerator(OZ_RAIN_GEN, (w, h, params, seed) => paintRain(w, h, params, seed, 1), {
    hd: (w, h, params, seed, d) => paintRain(w, h, params, seed, d),
  });
}
