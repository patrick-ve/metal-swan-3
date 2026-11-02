/**
 * The backgrounds of mission `oat` (docs/design/oat.md §8.1 items 1–2, §8.7 a 1–3, §8.7 d 1–2;
 * STREET-A, wave A): oat-a's late-September morning and the night of the oat-d proof strip. The
 * generators are art/layers.ts (one drawer per id for 1×, 2× and 4×).
 *
 * Far → near: the screen-fixed sky (NOT lifted: the FloorDefs list `oat-a-sky` / `oat-d-sky` in
 * `skyLayers`), the far roofscape, the roofscape behind our street, then the landmark tower (it
 * stands nearer than the roofs: the Westertoren on the Prinsengracht at the start of oat-a, the Oude
 * Kerk a street away from the Achterburgwal), drawn once (`repeatX: false`). Every non-sky layer is
 * lifted by the floor (16 px) and keeps factorX < 0.862 (the façade plane's speed). Our own façade
 * row is the strips (GRAMMAR), the canal vistas and far banks are decor (art/vistas.ts).
 *
 * Tier-4 memory: each 4× layer costs width × 216 × 64 bytes: the skies 384 (5.3 MB), the roofs 768
 * (10.6 MB each), the towers 80 / 96 (1.1 / 1.3 MB): oat-a 27.6 MB, oat-d 17.2 MB.
 */
import { PAL_HD, PAL_HD_OAT } from '../../../../engine/palette-hd';
import type { BackgroundDef } from '../../../mission/index';
import './art/index';

/** oat-a DE 9 STRAATJES, 09:30: morning blue, broken cumulus lit from the left, the Westertoren. */
export const BG_OAT_A: BackgroundDef = {
  sky: PAL_HD.sky[2],
  layers: [
    { gen: 'oat-a-sky', width: 384, factorX: 0 },
    { gen: 'oat-a-roofs', params: { air: 0.55, y0: 60, y1: 80, lotMin: 10, lotMax: 18, gables: 0.4 }, width: 768, factorX: 0.1 },
    { gen: 'oat-a-roofs', params: { air: 0.4, y0: 72, y1: 100, lotMin: 13, lotMax: 24 }, width: 768, factorX: 0.22, offsetX: -40 },
    // The Westertoren above the Prinsengracht (camera x 0–400: the tower's centre at screen x 158 → 118, in the gap between the quay elms' crowns).
    { gen: 'oat-a-tower', params: { s: 1.25, top: 20 }, width: 80, factorX: 0.1, offsetX: 118, repeatX: false },
  ],
};

/** oat-d DE WALLEN BY NIGHT, 22:30: deep navy, clouds lit from below by the city, the Oude Kerk. */
export const BG_OAT_D: BackgroundDef = {
  sky: PAL_HD_OAT.nightSky[0],
  layers: [
    { gen: 'oat-d-sky', width: 384, factorX: 0 },
    { gen: 'oat-d-roofs', params: { air: 0.15, y0: 60, y1: 100, lit: 0.3 }, width: 768, factorX: 0.22 },
    // The Oude Kerk tower, floodlit (camera x 300–1,000: its centre at screen x 230 → 146).
    { gen: 'oat-d-tower', params: { s: 1.6, top: 22 }, width: 96, factorX: 0.12, offsetX: 218, repeatX: false },
  ],
};
