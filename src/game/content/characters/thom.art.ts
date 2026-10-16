/**
 * `thom` — THOM, LITTLE NAPOLEON (docs/design/squad.md §1): a navy baseball cap worn BACKWARDS,
 * very short light-blond hair, a HUGE toothy grin and squinting happy eyes; short and sturdy; an
 * olive-green T-shirt. A second pistol in the off hand on every pistol torso strip (drawing only:
 * firing is unchanged; the muzzle point is the aimed gun's).
 * - Knife look: a pistol-whip with the spare pistol.
 * - Bored: the hand-in-jacket Napoleon pose, chin up, chest out.
 * - Victory: both pistols up, akimbo.
 */
import { PAL } from '../../../engine/palette';
import type { ArmPose, HumanStyle, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const THOM_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: [PAL.gold[1], PAL.gold[2], PAL.gold[3]],
  hairStyle: 'buzz',
  headgear: 'cap-back',
  gear: 'navy',
  accent: 'gold',
  top: 'olive',
  topType: 'tee',
  pants: 'sand',
  boots: 'brown',
  gloves: null,
  belt: 'black',
  build: 'stocky',
  face: ['grin', 'beam'],
};

/** Pistol-whip: the spare pistol by the barrel, a wind-up, a clonk, the follow-through. */
const THOM_KNIFE: readonly Pose[] = [
  { armN: A(-140, 60), held: 'pistol-butt', heldAngle: -120, lean: -6, expr: 'shout' },
  { armN: { to: [7, -9] }, held: 'pistol-butt', heldAngle: -60, lean: 2, expr: 'shout' },
  { armN: A(85, 5), held: 'pistol-butt', heldAngle: 0, lean: 12, expr: 'shout' },
  { armN: A(55, 15), held: 'pistol-butt', heldAngle: 40, lean: 8, expr: 'happy' },
  { armN: A(25, 60), held: 'pistol-butt', heldAngle: -60, lean: 2, expr: 'happy' },
];

/** The near hand flat on the chest (in the jacket that is not there), the far hand behind. */
const NAPOLEON: Pose = { ...P.STAND, legN: { hip: 14, knee: 6 }, legF: { hip: -10, knee: 4 }, armN: { to: [4, 4], hand: 'open' }, armF: { to: [-4, 6], hand: 'fist' } };

/** Steps into the pose, chin up, chest out, holds it (a blink), relaxes. */
const THOM_BORED: readonly Pose[] = [
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'normal' },
  { ...NAPOLEON, expr: 'normal' },
  { ...NAPOLEON, lean: -6, head: { tilt: -10 }, expr: 'happy' },
  { ...NAPOLEON, lean: -7, head: { tilt: -10 }, expr: 'blink' },
  { ...NAPOLEON, lean: -6, head: { tilt: -10 }, expr: 'happy' },
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'happy' },
];

/** Both pistols up: akimbo, a hop. */
const THOM_VICTORY: readonly Pose[] = [
  { ...P.STAND, weapon: 'pistol', aim: 'up', offhand: 'pistol', expr: 'happy' },
  { ...P.STAND, weapon: 'pistol', aim: 'up', offhand: 'pistol', recoil: 1, grounded: false, dy: -2, expr: 'shout' },
];

export const THOM_ART: PlayerArtOpts = {
  // The second pistol: drawn on every pistol torso strip (the rig ignores it on the heavy gun and
  // when the gun is carried low for a throw or the knife).
  torso: { offhand: 'pistol' },
  knife: THOM_KNIFE,
  bored: THOM_BORED,
  victory: THOM_VICTORY,
  durations: {
    bored: [12, 16, 40, 8, 30, 20],
    victory: [16, 16],
  },
};
