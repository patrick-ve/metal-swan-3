/**
 * Art-direction trial `painted` (painted.ts): soften the hard light bands of a finished HD image
 * (the rig's gun, hands, knife and props) into painted transitions. Where two neighbouring tones
 * of one ramp meet, short horizontal dabs of each tone cross into the other (a dry-brush border),
 * so the banded metal and skin take the figure's brushwork. Same size, PAL_HD colours only.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { PAL_HD, HD_RAMP_NAMES } from '../../../../engine/palette-hd';
import { hash2 } from '../../../art/paint';

const HOME = new Map<number, { r: number; i: number }>();
HD_RAMP_NAMES.forEach((n, r) => {
  PAL_HD[n].forEach((c, i) => {
    const k = c >>> 0;
    if (!HOME.has(k)) HOME.set(k, { r, i });
  });
});

const cache = new WeakMap<PixelBuffer, PixelBuffer>();

export function soften(src: PixelBuffer, d: number): PixelBuffer {
  const hit = cache.get(src);
  if (hit) return hit;
  const { w, h, data } = src;
  const out = src.clone();
  const o = out.data;
  const R = d >= 4 ? 2 : 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x];
      if ((c & 255) === 0) continue;
      const hc = HOME.get(c >>> 0);
      if (!hc) continue;
      // The nearest neighbouring tone of the same ramp, one step away, within R px.
      let pick: Color = 0;
      for (let k = 1; k <= R && !pick; k++) {
        for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]] as const) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = data[yy * w + xx];
          if ((q & 255) === 0) continue;
          const hq = HOME.get(q >>> 0);
          if (!hq || hq.r !== hc.r || Math.abs(hq.i - hc.i) !== 1) continue;
          if (hash2(Math.floor((x + (y % 2) * 1.5) / (R + 1)), y, 4242 + k) < (k === 1 ? 0.42 : 0.2)) pick = q;
          break;
        }
      }
      if (pick) o[y * w + x] = pick;
    }
  }
  out.touch();
  cache.set(src, out);
  return out;
}

const remapCache = new WeakMap<PixelBuffer, PixelBuffer>();

/**
 * Repaint an image's colours of one HD ramp onto a painted ramp by position (the rig's hands in
 * PAL_HD.skinA → the painted skin: rose shade instead of orange). Same size; cached per source.
 */
export function remap(src: PixelBuffer, from: readonly Color[], to: readonly Color[]): PixelBuffer {
  const hit = remapCache.get(src);
  if (hit) return hit;
  const map = new Map<number, Color>();
  from.forEach((c, i) => map.set(c >>> 0, to[Math.round((i * (to.length - 1)) / (from.length - 1))]));
  const out = src.clone();
  const o = out.data;
  for (let i = 0; i < o.length; i++) {
    if ((o[i] & 255) === 0) continue;
    const m = map.get(o[i] >>> 0);
    if (m !== undefined) o[i] = m;
  }
  out.touch();
  remapCache.set(src, out);
  return out;
}
