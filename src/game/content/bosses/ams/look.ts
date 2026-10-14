/**
 * ROBO-HALSEMA — the colour ramps of her art (shared by art.ts and the 2× details in art-hi.ts).
 */
import type { Color } from '../../../../engine/color';
import { PAL, type Ramp } from '../../../../engine/palette';

/** Dark navy trousers (the far leg one shade darker). */
export const PANTS: Ramp = [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.steel[1]];
export const PANTS_FAR: Ramp = [PAL.ink[1], PAL.ink[1], PAL.navy[0], PAL.navy[1]];
/** The cream-white boucle jacket (warm-grey shadows so it reads on a bright sky). */
export const JACKET: Ramp = PAL.cloth;
export const JACKET_FAR: Ramp = [PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.cloth[2]];
/** The crimson blouse. */
export const BLOUSE: Ramp = PAL.red;
/** Dark chocolate hair: near black in the shadows, warm chestnut on the crests. */
export const HAIR: Ramp = [PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.brown[2]];
export const METAL: Ramp = PAL.steel;
export const SILVER: Ramp = [PAL.steel[2], PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
export const FACE: Ramp = PAL.skinA;
export const WOOD: Ramp = PAL.brown;
export const BOOT: Ramp = PAL.black;
/** Enamel shields on the chain of office: red, blue, green, white. */
export const ENAMEL: readonly Color[] = [PAL.red[2], PAL.sky[1], PAL.green[2], PAL.snow[3]];

