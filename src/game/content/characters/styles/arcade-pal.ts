/**
 * Style `arcade` (arcade.ts): the cel ramps. Every ramp is five PAL_HD tones, dark → light:
 *   [0] the deep tone (separations, crevices, the deepest shade),
 *   [1] shade, [2] mid, [3] light — the three hard cel bands of the material,
 *   [4] the glint (speculars and the painted 1-px highlights).
 * The bands are hue-shifted on purpose: the shade and the deep tone lean cool (purple / blue /
 * teal), the light and the glint lean warm (yellow / cream). `line` is the colour of the thick
 * outline round the material (a dark tone of its own hue; ink only for the black and metal parts).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';

export interface Cel {
  readonly ramp: readonly Color[];
  readonly line: Color;
}

const H = PAL_HD;
const cel = (ramp: Color[], line: Color): Cel => ({ ramp, line });

/** Fair skin: peach light, salmon shade, a dusky rose deep tone. */
export const SKIN = cel([H.brickDark[5], H.skinA[4], H.skinA[5], H.skinA[6], H.skinA[7]], H.skinA[0]);
/** The stubble band: a cool grey-violet over the jaw and the lip. */
export const STUBBLE = cel([H.hairA[3], H.hairA[4], H.hairA[5], H.stone[3], H.stone[3]], H.skinA[0]);
/** Dark-brown hair: a purple-brown shade, a warm chestnut light and glint. */
export const HAIR = cel([H.brickDark[0], H.brickDark[1], H.hairB[2], H.hairB[3], H.brown[7]], H.hairB[0]);
/** The tweed jacket: maroon-purple shade, tan light, a cream-gold top. */
export const TWEED = cel([H.brickDark[2], H.brickDark[3], H.brown[3], H.wood[5], H.wood[6]], H.brown[1]);
/** The shirt in the jacket's V: cool blue-grey shade, white light. */
export const SHIRT = cel([H.snow[0], H.snow[2], H.snow[4], H.snow[5], H.snow[6]], H.snow[0]);
/** The thin dark-red tie. */
export const TIE = cel([H.red[0], H.red[1], H.red[3], H.red[5], H.red[6]], H.red[0]);
/** Olive fatigues: a cool green-teal shade, a yellow-olive light. */
export const OLIVE = cel([H.olive[1], H.canal[3], H.olive[4], H.olive[5], H.olive[6]], H.olive[1]);
/** Black leather boots and belt: purple-black shade, a steel-blue sheen, a white glint. */
export const LEATHER = cel([H.ink[0], H.ink[1], H.black[2], H.black[4], H.steel[6]], H.ink[0]);
/** The soles: one dark band. */
export const SOLE = cel([H.ink[0], H.ink[0], H.ink[1], H.black[2], H.black[2]], H.ink[0]);
/** Gun steel: deep blue shade, a bright cool light, a warm white glint. */
export const STEEL = cel([H.steel[0], H.steel[1], H.steel[2], H.steel[4], H.steel[7]], H.ink[0]);
/** Black polymer (grips). */
export const POLYMER = cel([H.ink[0], H.ink[1], H.steel[1], H.steel[2], H.steel[4]], H.ink[0]);
/** Brass: buckle, studs. */
export const BRASS = cel([H.gold[1], H.gold[2], H.gold[4], H.gold[5], H.gold[7]], H.gold[0]);
/** The heavy gun's olive drum. */
export const DRUM = cel([H.olive[0], H.olive[2], H.olive[4], H.olive[6], H.olive[7]], H.ink[0]);
/** Paper (the rolled battle plan). */
export const PAPER = cel([H.sand[2], H.sand[4], H.sand[5], H.sand[6], H.sand[7]], H.sand[0]);
/** The plan's blue ink line. */
export const PLAN_INK = cel([H.sky[0], H.sky[0], H.sky[1], H.sky[2], H.sky[3]], H.navy[2]);
/** The knife blade. */
export const BLADE = cel([H.steel[2], H.steel[3], H.steel[5], H.steel[6], H.steel[7]], H.ink[0]);

/** Fixed face colours. */
export const FACE = {
  eye: H.ink[1],
  white: H.snow[6],
  glint: H.snow[6],
  mouth: H.skinA[0],
  mouthIn: H.red[2],
  teeth: H.snow[5],
  tongue: H.red[5],
  blush: H.skinA[3],
} as const;

/** The Helium Head's rim (humanoid.ts HELIUM_RIM, PAL.pink[1], a PAL_HD tone too). */
export const HELIUM_RIM: Color = H.pink[3];
