/**
 * Mission `oldenzaal` backgrounds of the street (docs/design/oldenzaal.md §10.1, §10.3). Owner: TOWN
 * → RUIN (oz-a, oz-b). The other sections have their own: oz-c `BG_OZ_C_SQUARE` (art-square.ts),
 * oz-d / oz-e in their section files (church art), oz-f `BG_OZ_TOWER` (tower/art.ts).
 *
 * The layers (art-sky.ts, art-basilica.ts; every one with 1×, 2× and 4× art from one drawer):
 * - `oz-sky` (screen-fixed), `oz-far` (the hazy far town), `oz-tower` (the basilica's tower, once,
 *   never tiled: `repeatX: false`), `oz-roofs` (the dark backlit roofs over the street). The near
 *   shop fronts are decor sprites (art-street.ts), the fog and the darkness are LIGHT's pass.
 * - oz-a: dusk, a low red sun behind the roofs, the tower far off above the roofs.
 * - oz-b: late dusk, the sun gone, the tower nearer and bigger (the square is close).
 *
 * Revision 2 (RUIN, R2-7): oz-a and oz-b after the outbreak: colder and grimmer: nearly every far
 * window dark (`lit`), columns of smoke from fires left burning in the far town (`smoke`), broken
 * roofs over the street (`ruin`). The basilica's tower stays above the roofs (the params are
 * opt-in; oz-c's square draws the same generators without them).
 *
 * Widths: the screen-fixed sky is one screen wide, the far layers 768 / 640 px (tier-4 budget:
 * every 4× layer costs width × 216 × 64 bytes; tests/content/oldenzaal-dense-budget.test.ts).
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef } from '../../../mission/index';
import './art';

/** The tower layer's buffer width (the tower at its scale fits with room for its rim). */
const TOWER_LAYER_W = 72;

/** oz-a: dusk, a low red sun behind the roofs, the tower far off. */
export const BG_OZ_A: BackgroundDef = {
  sky: PAL.purple[0],
  layers: [
    { gen: 'oz-sky', params: { light: 'dusk', sunX: 0.74, sunY: 0.3, sunR: 11 }, width: 384, factorX: 0 },
    { gen: 'oz-far', params: { light: 'dusk', y: 0.52, air: 0.55, lit: 0.15, smoke: 3, lean: 0.4 }, width: 768, factorX: 0.08 },
    { gen: 'oz-tower', params: { light: 'dusk', x: 16, base: 160, s: 3.6, air: 0.4 }, width: TOWER_LAYER_W, factorX: 0.1, offsetX: 210, repeatX: false },
    { gen: 'oz-roofs', params: { light: 'dusk', y: 0.62, air: 0.36, lit: 0.12, ruin: 0.35 }, width: 640, factorX: 0.3 },
  ],
};

/** oz-b: late dusk, darker; the tower nearer and bigger above the roofs. */
export const BG_OZ_B: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'oz-sky', params: { light: 'late', sunX: 0.8 }, width: 384, factorX: 0 },
    { gen: 'oz-far', params: { light: 'late', y: 0.54, air: 0.5, lit: 0.1, smoke: 2, lean: 0.5 }, width: 768, factorX: 0.08 },
    { gen: 'oz-tower', params: { light: 'late', x: 12, base: 182, s: 4.4, air: 0.28 }, width: TOWER_LAYER_W, factorX: 0.16, offsetX: 330, repeatX: false },
    { gen: 'oz-roofs', params: { light: 'late', y: 0.62, air: 0.3, lit: 0.1, ruin: 0.4 }, width: 640, factorX: 0.3 },
  ],
};
