/**
 * `vincent` — VINCENT, THE CONSULTANT (docs/design/squad.md §1): short dark-brown hair, heavy dark
 * stubble, ONE RAISED EYEBROW and a lopsided smirk; slim; a brown tweed jacket with a thin
 * dark-red tie over his fatigues. A kind caricature built from shapes (never traced).
 * - Knife look: a rolled-up battle plan, a smug bonk.
 * - Bored: unrolls the battle plan, studies it, nods, rolls it up again.
 * - Victory: taps the rolled plan in his palm, then a smug thumbs-up.
 */
import { PAL } from '../../../engine/palette';
import type { ArmPose, HumanStyle, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';
import { at, decorateFrames, planSheet, pt } from './pieces';

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const VINCENT_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: [PAL.ink[1], PAL.brown[0], PAL.brown[1]],
  hairStyle: 'short-crop',
  headgear: 'none',
  accent: 'red',
  top: 'brown',
  topType: 'jacket',
  shirt: 'snow',
  pants: 'olive',
  boots: 'black',
  gloves: null,
  belt: 'black',
  build: 'slim',
  accessories: ['tie', 'tweed'],
  face: ['heavy-stubble', 'raised-brow', 'smirk'],
};

/** The battle-plan bonk: raise the roll, bring it down on a head, a little bounce, recover. */
const VINCENT_KNIFE: readonly Pose[] = [
  { armN: A(-130, 70), held: 'plan', heldAngle: -110, lean: -4, expr: 'normal' },
  { armN: { to: [7, -9] }, held: 'plan', heldAngle: -50, lean: 2, expr: 'shout' },
  { armN: A(85, 5), held: 'plan', heldAngle: 10, lean: 12, expr: 'shout' },
  { armN: A(70, 20), held: 'plan', heldAngle: 30, lean: 9, expr: 'normal' },
  { armN: A(25, 60), held: 'plan', heldAngle: -60, lean: 2, expr: 'normal' },
];

/** Both hands hold the open plan in front of the chest. */
const READ: Pose = { ...P.STAND, armN: { to: [7, 4], hand: 'fist' }, armF: { to: [6, 4], hand: 'fist' }, head: { tilt: 10 } };

/** Takes out the roll, unrolls it, reads, nods twice, rolls it up, pleased. */
const VINCENT_BORED: readonly Pose[] = [
  { ...P.STAND, armN: A(30, 70), armF: A(-6, 26), held: 'plan', heldAngle: -70, expr: 'normal' },
  { ...READ, expr: 'normal' },
  { ...READ, expr: 'blink' },
  { ...READ, head: { tilt: 14, dy: 1 }, expr: 'normal' },
  { ...READ, head: { tilt: 8 }, expr: 'normal' },
  { ...READ, head: { tilt: 14, dy: 1 }, expr: 'happy' },
  { ...P.STAND, armN: A(30, 70), armF: A(-6, 26), held: 'plan', heldAngle: -70, expr: 'happy' },
];

/** Taps the roll in his palm, then the smug thumbs-up. */
const VINCENT_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, 2] }, armF: { to: [6, 4], hand: 'open' }, held: 'plan', heldAngle: 20, expr: 'normal' },
  { ...P.STAND, armN: { to: [6, 4] }, armF: { to: [6, 4], hand: 'open' }, held: 'plan', heldAngle: 40, expr: 'normal' },
  { ...P.STAND, armN: { sh: 96, el: 70, hand: 'thumb' }, armF: A(-6, 26), lean: -3, expr: 'normal' },
  { ...P.STAND, armN: { sh: 100, el: 70, hand: 'thumb' }, armF: A(-6, 26), lean: -4, expr: 'blink' },
];

export const VINCENT_ART: PlayerArtOpts = {
  knife: VINCENT_KNIFE,
  bored: VINCENT_BORED,
  victory: VINCENT_VICTORY,
  durations: {
    bored: [20, 14, 30, 10, 10, 10, 30],
    victory: [10, 10, 30, 30],
  },
  decorate: {
    bored: (frames) =>
      decorateFrames(frames, (f, i) => {
        if (i < 1 || i > 5) return null;
        const [hx, hy] = pt(f, 'hand', [7, -18]);
        return [at(planSheet(), hx - 1, hy - 2)];
      }),
  },
};
