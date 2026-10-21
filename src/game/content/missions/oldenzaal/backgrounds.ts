/**
 * Mission `oldenzaal` backgrounds (docs/design/oldenzaal.md §10.1, §10.3). Owner: TOWN (oz-a, oz-b,
 * and the night sky / basilica layers registered for oz-c); wave B owns oz-d and oz-e.
 *
 * The layers (art-sky.ts, art-basilica.ts; every one with 1×, 2× and 4× art from one drawer):
 * - `oz-sky` (screen-fixed), `oz-far` (the hazy far town), `oz-tower` (the basilica's tower, once,
 *   never tiled: `repeatX: false`), `oz-roofs` (the dark backlit roofs over the street). The near
 *   shop fronts are decor sprites (art-street.ts), the fog and the darkness are LIGHT's pass.
 * - oz-a: dusk, a low red sun behind the roofs, the tower far off above the roofs.
 * - oz-b: late dusk, the sun gone, the tower nearer and bigger (the square is close).
 * - oz-c (wave B's stage, registered now): night, a full moon, and the basilica's long side
 *   (`oz-basilica`, the near version) as the backdrop of Plechelmusplein.
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
    { gen: 'oz-far', params: { light: 'dusk', y: 0.52, air: 0.55 }, width: 768, factorX: 0.08 },
    { gen: 'oz-tower', params: { light: 'dusk', x: 16, base: 160, s: 3.6, air: 0.4 }, width: TOWER_LAYER_W, factorX: 0.1, offsetX: 210, repeatX: false },
    { gen: 'oz-roofs', params: { light: 'dusk', y: 0.62, air: 0.36 }, width: 640, factorX: 0.3 },
  ],
};

/** oz-b: late dusk, darker; the tower nearer and bigger above the roofs. */
export const BG_OZ_B: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'oz-sky', params: { light: 'late', sunX: 0.8 }, width: 384, factorX: 0 },
    { gen: 'oz-far', params: { light: 'late', y: 0.54, air: 0.5 }, width: 768, factorX: 0.08 },
    { gen: 'oz-tower', params: { light: 'late', x: 12, base: 182, s: 4.4, air: 0.28 }, width: TOWER_LAYER_W, factorX: 0.16, offsetX: 330, repeatX: false },
    { gen: 'oz-roofs', params: { light: 'late', y: 0.62, air: 0.3 }, width: 640, factorX: 0.3 },
  ],
};

/** oz-c: night, a full moon over Plechelmusplein, the basilica's long side (wave B tunes it). */
export const BG_OZ_C: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'oz-sky', params: { light: 'night', moonX: 0.2, moonY: 0.16 }, width: 384, factorX: 0 },
    { gen: 'oz-far', params: { light: 'night', y: 0.6, air: 0.45 }, width: 768, factorX: 0.08 },
    { gen: 'oz-basilica', params: { light: 'night', x: 30, base: 176, s: 4.2 }, width: 320, factorX: 0.5, offsetX: 60, repeatX: false },
  ],
};

/** oz-d: the dark nave (wave B: NAVE). */
export const BG_OZ_D: BackgroundDef = {
  sky: PAL.ink[1],
  layers: [{ gen: 'sky-gradient', params: { colors: [PAL.ink[0], PAL.ink[1], PAL.navy[0], PAL.steel[0]] }, factorX: 0 }],
};

/** oz-e: the storm inside the tower (wave B: TOWER). */
export const BG_OZ_E: BackgroundDef = {
  sky: PAL.ink[1],
  layers: [{ gen: 'sky-gradient', params: { colors: [PAL.ink[0], PAL.navy[0], PAL.steel[0], PAL.navy[0]] }, factorX: 0 }],
};
