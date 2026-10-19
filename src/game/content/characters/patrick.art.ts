/**
 * `patrick` — PATRICK, THE SUPERNERD (docs/design/squad.md §1): black hair, short sides and a
 * slick swept-back top, dark brows, brown eyes, light-tan skin, a thin trimmed mustache and a
 * black polo shirt.
 * - Knife look: a frikandel, a hearty swat.
 * - Bored: eats a frikandel (bite, chew), then glances at a glowing pocket device.
 * - Victory: the frikandel raised like a trophy.
 */
import { PAL } from '../../../engine/palette';
import type { ArmPose, HumanStyle, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';
import { tween } from '../../art/tween';
import { at, decorateFrames, deviceGlow, pocketDevice, pt } from './pieces';

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const PATRICK_STYLE: HumanStyle = {
  skin: 'skinB',
  // Glossy black: a cool steel shine on the swept-back top.
  hair: [PAL.ink[0], PAL.black[2], PAL.steel[1]],
  hairStyle: 'slick-back',
  headgear: 'none',
  accent: 'teal',
  top: 'black',
  topType: 'polo',
  pants: 'stone',
  boots: 'black',
  gloves: null,
  belt: 'brown',
  build: 'normal',
  face: ['thin-mustache'],
};

/** The frikandel swat: back, a wide swing, SPLAT, follow-through, recover. */
const PATRICK_KNIFE: readonly Pose[] = [
  { armN: A(-140, 60), held: 'frikandel', heldAngle: -120, lean: -6, expr: 'shout' },
  { armN: { to: [7, -9] }, held: 'frikandel', heldAngle: -50, lean: 2, expr: 'shout' },
  { armN: A(85, 5), held: 'frikandel', heldAngle: 5, lean: 12, expr: 'shout' },
  { armN: A(60, 15), held: 'frikandel', heldAngle: 30, lean: 8, expr: 'happy' },
  { armN: A(25, 60), held: 'frikandel', heldAngle: -60, lean: 2, expr: 'normal' },
];

const SNACK: Pose = { ...P.STAND, armF: A(-6, 26) };

/** Bites the frikandel, chews (twice), checks the device (it glows on his face), chews on. */
const PATRICK_BORED_KEYS: readonly Pose[] = [
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'normal' },
  { ...SNACK, armN: { to: [8, -5] }, held: 'frikandel', heldAngle: -10, expr: 'shout' },
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'chew' },
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'chew', bob: 1 },
  { ...P.STAND, armN: A(20, 80), held: 'frikandel', heldAngle: -30, armF: { to: [6, 2] }, head: { tilt: 12 }, expr: 'normal' },
  { ...P.STAND, armN: A(20, 80), held: 'frikandel', heldAngle: -30, armF: { to: [6, 2] }, head: { tilt: 12 }, expr: 'blink' },
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'happy' },
];

/** Key durations + in-betweens per pair (each in-between `inb` ticks) → one duration per frame. */
const keyed = (keys: readonly number[], per: readonly number[], inb: number): number[] =>
  keys.flatMap((d, i) => (i < per.length ? [d, ...Array<number>(per[i]).fill(inb)] : [d]));

/** Bored (10 frames): the bite and the reach for the device tweened. */
const BORED_PER = [1, 1, 0, 0, 0, 1];
const PATRICK_BORED = tween(PATRICK_STYLE, PATRICK_BORED_KEYS, { perKey: BORED_PER, hold: 'b' });
const PATRICK_BORED_T = keyed([12, 8, 12, 12, 26, 18, 14], BORED_PER, 4);

const FK = (sh: number, el: number, heldAngle: number, extra: Pose = {}): Pose => ({ ...SNACK, armN: A(sh, el), held: 'frikandel', heldAngle, ...extra });

/** Fidget A (12 frames): pulls a frikandel, sniffs it, a big bite (anticipation: mouth open, head back), chews, happy. */
const FIDGET_A_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  FK(20, 80, -30, { expr: 'normal' }),
  { ...SNACK, armN: { to: [7, -6] }, held: 'frikandel', heldAngle: -20, head: { tilt: 8 }, expr: 'happy' },
  { ...SNACK, armN: { to: [6, -4] }, held: 'frikandel', heldAngle: -15, lean: -3, head: { tilt: -8 }, expr: 'shout' },
  { ...SNACK, armN: { to: [8, -5] }, held: 'frikandel', heldAngle: -10, lean: 2, head: { tilt: 8 }, expr: 'chew' },
  FK(25, 85, -30, { lean: 1, expr: 'chew', bob: 1 }),
  FK(20, 80, -30, { expr: 'chew' }),
  FK(20, 80, -30, { expr: 'happy', head: { tilt: -8 } }),
];
const FIDGET_A_PER = [1, 1, 1, 0, 1, 1, 0];
const PATRICK_FIDGET_A = tween(PATRICK_STYLE, FIDGET_A_KEYS, { perKey: FIDGET_A_PER, hold: 'b' });
const PATRICK_FIDGET_A_T = keyed([8, 10, 14, 10, 4, 12, 14, 20], FIDGET_A_PER, 4);

/** Fidget B (11 frames): glances back over his shoulder, then forward, scratches the back of his head. */
const FIDGET_B_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), head: { dx: -1, tilt: -8 }, lean: -2, expr: 'normal' },
  { ...P.STAND, armN: A(8, 30), armF: A(-10, 30), head: { dx: 1, tilt: 8 }, lean: 1, expr: 'blink' },
  { ...P.STAND, armN: A(8, 30), armF: { to: [-1, -12], hand: 'open' }, head: { tilt: 8 }, expr: 'normal' },
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'happy' },
];
const FIDGET_B_PER = [1, 1, 3, 1];
const PATRICK_FIDGET_B = tween(PATRICK_STYLE, FIDGET_B_KEYS, { perKey: FIDGET_B_PER, ease: ['inOut', 'inOut', 'linear', 'inOut'] });
const PATRICK_FIDGET_B_T = keyed([8, 18, 18, 24, 8], FIDGET_B_PER, 8);

/** The frikandel held up high like a trophy. */
const PATRICK_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [10, -6] }, armF: A(20, 70), held: 'frikandel', heldAngle: -70, lean: -3, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, -7] }, armF: A(20, 70), held: 'frikandel', heldAngle: -80, lean: -4, expr: 'shout', bob: 1 },
];

export const PATRICK_ART: PlayerArtOpts = {
  knife: PATRICK_KNIFE,
  bored: PATRICK_BORED,
  victory: PATRICK_VICTORY,
  fidgetA: PATRICK_FIDGET_A,
  fidgetB: PATRICK_FIDGET_B,
  durations: {
    bored: PATRICK_BORED_T,
    'fidget-a': PATRICK_FIDGET_A_T,
    'fidget-b': PATRICK_FIDGET_B_T,
    victory: [20, 20],
  },
  decorate: {
    bored: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        // The device shows while the far hand holds it up (an IK arm).
        if (poses[i].armF?.to === undefined) return null;
        // The device sits in the far hand, just in front of the chest; its light on the face.
        const k = poses[i].headScale === 2 ? 2 : 1;
        const [hx, hy] = pt(f, 'head', [3, -29]);
        return [at(pocketDevice(), hx + 4, hy + 9), at(deviceGlow(), hx + 3 * k, hy + 2 * k)];
      }),
  },
};
