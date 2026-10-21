/**
 * Mission oldenzaal — the kit's art: the light sprites (prefix 'fx/oz/light/'). Owner: LIGHT.
 * Manifest id 'oldenzaal/kit/art'.
 *
 * Glows drawn ADDITIVELY (`blend: 'add'`): banded tones of one ramp, dark at the rim (adds
 * little) to light at the core, like the ring's light sprites. ONE density-generic drawer per id
 * (the ring kit's `Pen`): at 1× the tones snap to the 64-colour PAL, at 2× / 4× they are the
 * PAL_HD_OZ / PAL_HD tones with a finer dithered band edge; same logical size and anchor (the
 * centre) at every density. No ink (light, never hit or picked up).
 *
 * - `fx/oz/light/glow`      32 × 32: the ghost glow (cold green) — `drawGhost`'s `glow` option for
 *   the souls and Mevrouw Winkel.
 * - `fx/oz/light/glow-warm` 32 × 32: a lamp / candle / window halo (amber).
 * - `fx/oz/light/glow-s`    12 × 12: a small pale glow (eyes, sparks); `tint` it any colour.
 */
import type { Color } from '../../../../engine/color';
import { nearest as nearestPal } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { dq, Pen, type Dn } from '../../ring/scenery/kit';

/** Every sprite id of this module (tests). */
export const OZ_LIGHT_SPRITES: string[] = [];

function sprite(id: string, w: number, h: number, ox: number, oy: number, draw: (p: Pen) => void): void {
  const frames = (d: Dn): Frame[] => {
    const p = new Pen(w, h, d);
    draw(p);
    return [p.frame(ox, oy)];
  };
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), ticksPerFrame: 8 });
  OZ_LIGHT_SPRITES.push(id);
}

/** Tone k of a ramp at density d (1×: the nearest PAL colour). */
function tone(r: readonly Color[], k: number, d: Dn): Color {
  const c = r[Math.max(0, Math.min(r.length - 1, Math.round(k)))] >>> 0;
  return d === 1 ? (nearestPal(c) | 255) >>> 0 : c;
}

/** A round glow of tones k0 (rim) … k1 (core) of ramp `r`, radius rad, centred at (cx, cy). */
function glow(p: Pen, cx: number, cy: number, rad: number, r: readonly Color[], k0: number, k1: number, core = 1): void {
  const d = p.d;
  const n = k1 - k0 + 1;
  p.disc(cx, cy, rad, rad, (X, Y, u, v) => {
    const q = Math.max(0, 1 - Math.sqrt(u * u + v * v));
    const t = Math.pow(q, 1.5) * core * n;
    // 1×: hard bands (pixel art); 2× / 4×: the band edges dithered on a 2 art px grid.
    const i = d === 1 ? Math.floor(t) : dq(t, X >> 1, Y >> 1, 0.8);
    if (i <= 0) return 0;
    return tone(r, k0 + Math.min(n - 1, i - 1), d);
  });
}

export const OZ_GLOW = 'fx/oz/light/glow';
export const OZ_GLOW_WARM = 'fx/oz/light/glow-warm';
export const OZ_GLOW_S = 'fx/oz/light/glow-s';

sprite(OZ_GLOW, 32, 32, 16, 16, (p) => glow(p, 16, 16, 16, PAL_HD_OZ.ghost, 0, 4, 1.05));
sprite(OZ_GLOW_WARM, 32, 32, 16, 16, (p) => glow(p, 16, 16, 16, PAL_HD_OZ.candle, 0, 5, 1.05));
sprite(OZ_GLOW_S, 12, 12, 6, 6, (p) => glow(p, 6, 6, 6, PAL_HD.snow, 0, 5, 1.2));
