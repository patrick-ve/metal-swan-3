/**
 * `dirk` — DIRK, THE PLUMBER (docs/design/squad.md §1): messy spiky brown hair, a THICK BROWN
 * MUSTACHE with light stubble, a round rosy face, a normal-heavy build and a hi-vis yellow work
 * vest over dark fatigues. Never a famous game plumber: no cap, no overalls, no letter.
 * - Knife look: a plunger, a firm push.
 * - Bored: wipes his mustache, then checks a pipe wrench.
 * - Victory: the plunger raised high.
 */
import { PAL } from '../../../engine/palette';
import type { ArmPose, HumanStyle, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const DIRK_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'spiky-messy',
  headgear: 'none',
  // The cheek blush.
  accent: [PAL.pink[1], PAL.pink[2], PAL.pink[2]],
  top: 'gold',
  topType: 'vest',
  // Yellow sleeves too: the hi-vis reads at 1× (the near sleeve covers most of the chest).
  shirt: 'gold',
  pants: [PAL.olive[0], PAL.olive[1], PAL.olive[2]],
  boots: 'black',
  gloves: 'brown',
  belt: 'black',
  build: 'normal',
  accessories: ['hivis'],
  face: ['stubble', 'blush', 'thick-mustache'],
};

/** The plunger: pulled back, a firm push forward (cup first), hold, pull off, recover. */
const DIRK_KNIFE: readonly Pose[] = [
  { armN: { to: [2, 2] }, held: 'plunger', heldAngle: -10, lean: -4, expr: 'normal' },
  { armN: { to: [9, 0] }, held: 'plunger', heldAngle: 0, lean: 8, expr: 'shout' },
  { armN: { to: [11, 1] }, held: 'plunger', heldAngle: 0, lean: 14, expr: 'shout' },
  { armN: { to: [8, 2] }, held: 'plunger', heldAngle: 6, lean: 8, expr: 'normal' },
  { armN: { to: [3, 3] }, held: 'plunger', heldAngle: -60, lean: 2, expr: 'normal' },
];

/** Hand in front of the mouth: a wipe of the mustache. */
const WIPE: Pose = { ...P.STAND, armF: A(-6, 26) };

/** Wipes the mustache (two strokes), takes the wrench, turns it, checks the jaw, nods. */
const DIRK_BORED: readonly Pose[] = [
  { ...WIPE, armN: { to: [9, -6], hand: 'open' }, expr: 'blink' },
  { ...WIPE, armN: { to: [7, -6], hand: 'open' }, expr: 'blink' },
  { ...WIPE, armN: { to: [9, -6], hand: 'open' }, expr: 'normal' },
  { ...P.STAND, armN: { to: [7, -3] }, armF: A(-6, 26), held: 'wrench', heldAngle: -80, head: { tilt: 8 }, expr: 'normal' },
  { ...P.STAND, armN: { to: [7, -3] }, armF: A(-6, 26), held: 'wrench', heldAngle: -100, head: { tilt: 8 }, expr: 'blink' },
  { ...P.STAND, armN: { to: [7, -3] }, armF: A(-6, 26), held: 'wrench', heldAngle: -80, head: { tilt: 10, dy: 1 }, expr: 'happy' },
  { ...P.STAND, armN: A(20, 50), armF: A(-6, 26), held: 'wrench', heldAngle: 60, expr: 'happy' },
];

/** The plunger raised overhead, a shout. */
const DIRK_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [10, -6] }, armF: A(20, 70), held: 'plunger', heldAngle: -70, lean: -3, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, -7] }, armF: A(20, 70), held: 'plunger', heldAngle: -80, lean: -4, expr: 'shout', bob: 1 },
];

export const DIRK_ART: PlayerArtOpts = {
  knife: DIRK_KNIFE,
  bored: DIRK_BORED,
  victory: DIRK_VICTORY,
  durations: {
    bored: [10, 10, 16, 20, 20, 24, 20],
    victory: [20, 20],
  },
};
