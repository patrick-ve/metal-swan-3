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
const PATRICK_BORED: readonly Pose[] = [
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'normal' },
  { ...SNACK, armN: { to: [8, -5] }, held: 'frikandel', heldAngle: -10, expr: 'shout' },
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'chew' },
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'chew', bob: 1 },
  { ...P.STAND, armN: A(20, 80), held: 'frikandel', heldAngle: -30, armF: { to: [6, 2] }, head: { tilt: 12 }, expr: 'normal' },
  { ...P.STAND, armN: A(20, 80), held: 'frikandel', heldAngle: -30, armF: { to: [6, 2] }, head: { tilt: 12 }, expr: 'blink' },
  { ...SNACK, armN: A(20, 80), held: 'frikandel', heldAngle: -30, expr: 'happy' },
];

/** The frikandel held up high like a trophy. */
const PATRICK_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [10, -6] }, armF: A(20, 70), held: 'frikandel', heldAngle: -70, lean: -3, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, -7] }, armF: A(20, 70), held: 'frikandel', heldAngle: -80, lean: -4, expr: 'shout', bob: 1 },
];

export const PATRICK_ART: PlayerArtOpts = {
  knife: PATRICK_KNIFE,
  bored: PATRICK_BORED,
  victory: PATRICK_VICTORY,
  durations: {
    bored: [16, 10, 14, 14, 30, 20, 16],
    victory: [20, 20],
  },
  decorate: {
    bored: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        if (i < 4 || i > 5) return null;
        // The device sits in the far hand, just in front of the chest; its light on the face.
        const k = poses[i].headScale === 2 ? 2 : 1;
        const [hx, hy] = pt(f, 'head', [3, -29]);
        return [at(pocketDevice(), hx + 4, hy + 9), at(deviceGlow(), hx + 3 * k, hy + 2 * k)];
      }),
  },
};
