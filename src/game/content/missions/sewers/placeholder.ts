/**
 * Mission `sewers`, wave P0: the PLACEHOLDER scenery of the six grey sections (docs/design/sewers.md
 * §1, Phase 4 "in grey"). Plain and clearly temporary: a stock night sky over dark city blocks for
 * the street (a, b), a near-black vault for the sewer (c, d, e), a pale dawn for the end. The
 * canal bake (Phase 6) replaces every one of them; nobody polishes these.
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef, TerrainStyleDef } from '../../../mission/index';

/** The street: cobbles (a, b, end). */
export const GREY_STREET: TerrainStyleDef = { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick' };

/** The sewer walkway (c, d, e). */
export const GREY_SEWER: TerrainStyleDef = { ground: 'concrete', edge: 'moss', platform: 'metal', solid: 'brick' };

/** Night: a navy sky over dark blocks with a few lit windows (a, b). */
export const GREY_NIGHT: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.purple[0]] }, factorX: 0 },
    { gen: 'city', params: { y: 0.22, height: 0.6, lit: 0.3 }, factorX: 0.3 },
  ],
};

/** The sewer vault: near black, no layers (c, d, e). */
export const GREY_VAULT: BackgroundDef = { sky: PAL.ink[0], layers: [] };

/** Dawn after the rain: a pale sky over grey blocks (end). */
export const GREY_DAWN: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[2], PAL.sky[3], PAL.pink[1], PAL.pink[2]] }, factorX: 0 },
    { gen: 'city', params: { y: 0.24, height: 0.56, ramp: [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[0]], lit: 0, night: false }, factorX: 0.3 },
  ],
};
