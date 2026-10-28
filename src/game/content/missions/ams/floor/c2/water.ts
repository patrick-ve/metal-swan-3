/**
 * The water of `ams` c2 RONDVAART (docs/design/floor.md §12.2 c2, §2.2):
 *
 * - The river with its FAR FADE: the floor's river meets the far bank layer (`ams-amstel`, lifted: its
 *   own dark water under the quay, darkest at its foot) at the band's back edge. Its far rows fade into
 *   that water's tone (the gable navy with a little warm stone; the crests thin out to the layer's gold
 *   streaks), so the two read as one river with distance, not two surfaces meeting in a straight line.
 *   The fade is baked in texture space: the tiles are `TILE_H` px deep, more than the band's whole range
 *   of v over the water (−84 … +49), so b = v mod `TILE_H` never wraps inside it; and c2's river drifts
 *   along u only (dv 0: a v drift would carry the fade off its depth), its ripple and glint the kit's
 *   (`riverRipple`, `riverGlint`), so the water moves as before.
 * - The SHADE under the low bridges: the same ripple, darker and bluer, no glint (the water the deck
 *   shades), drifting with the river: seen under the deck's near span and through its arch (bridges.ts).
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { FloorSurface } from '../../../../../mission/floor/types';
import { depthAtAms } from '../layout';
import { dt, mix, smoothstep } from '../mat';
import { CANAL, RIVER_SKY, riverGlint, riverRipple, TEAL } from '../tiles';

/** The tiles' depth in v (a multiple of the ripple's 32 and the glint's 16) and where b turns from v ≥ 0 to v < 0. */
const TILE_H = 160;
const SPLIT = 60;
/** The fade's depths: none in front of `FADE0`, the far bank's tone at the band's back edge over the water (32.9). */
const FADE0 = 19;
const FADE1 = 33;
/** The far bank layer's water at its foot (the gable navy, a little of the warm stone). */
const FAR = mix(PAL_HD.gable[0], PAL_HD.stone[1], 0.3);
/** The river's drift along u (the kit's), the glint's against it, its mix. */
const DU = 0.045;
const GLINT_DU = -0.035;
const GLINT_ALPHA = 0.34;

/** The fade at tile b (0 … 1): b = v mod TILE_H, the back edge's rows at 1. */
function fadeAt(b: number): number {
  const v = b < SPLIT ? b : b - TILE_H;
  return smoothstep(FADE0, FADE1, depthAtAms(v));
}

/** c2's river (golden light) with its far fade: a cut's `surface`. */
export function c2RiverSurface(): FloorSurface {
  const base = 'ams/c2/river';
  const glint = 'ams/c2/river-glint';
  if (!hasFloorTile(base)) {
    const L = RIVER_SKY.golden;
    defineFloorTile(base, {
      w: 96,
      h: TILE_H,
      paint: (a, b, d) => {
        const X = Math.floor(a * d);
        const Y = Math.floor(b * d);
        const w = fadeAt(b);
        const r = riverRipple(a, b);
        // The crests: fewer and thinner toward the far bank (its gold streaks).
        if (r > 0.66 + 0.16 * w) return dt(L.sky, L.t + (r - 0.66) * 3, X, Y);
        const c = dt(TEAL, 1.85 + L.body + r * 0.85, X, Y);
        return w > 0 ? mix(c, FAR, w) : c;
      },
    });
    defineFloorTile(glint, {
      w: 64,
      h: TILE_H,
      paint: (a, b, d) => {
        const X = Math.floor(a * d);
        const Y = Math.floor(b * d);
        const w = fadeAt(b);
        const g = riverGlint(a, b);
        if (g > 0.8 + 0.12 * w) return dt(L.sky, L.t + 1, X, Y);
        const c = g < -0.62 ? dt(CANAL, 1.5, X, Y) : dt(TEAL, 2.2 + L.body + g * 0.5, X, Y);
        return w > 0 ? mix(c, FAR, w) : c;
      },
    });
  }
  return { tile: base, du: DU, dv: 0, over: { tile: glint, du: GLINT_DU, alpha: GLINT_ALPHA } };
}

/** The deep shade of the water under a bridge (the slate's blue in it). */
const SHADE = PAL_HD.slate[1];

/** The water under a low bridge's deck (a cut's `surface` over its footprint): the ripple, shaded; it drifts with the river. */
export function c2ShadeSurface(): FloorSurface {
  const id = 'ams/c2/river-shade';
  if (!hasFloorTile(id)) {
    defineFloorTile(id, {
      w: 96,
      h: 32,
      paint: (a, b, d) => {
        const X = Math.floor(a * d);
        const Y = Math.floor(b * d);
        const r = riverRipple(a, b);
        // A crest catches a little of the light beyond the bridge.
        if (r > 0.7) return mix(dt(TEAL, 2.3 + (r - 0.7) * 2, X, Y), SHADE, 0.25);
        return mix(dt(TEAL, 1.45 + r * 0.6, X, Y), SHADE, 0.3);
      },
    });
  }
  return { tile: id, du: DU, dv: 0 };
}
