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
import { tween } from '../../art/tween';

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
const THOM_BORED_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'normal' },
  { ...NAPOLEON, expr: 'normal' },
  { ...NAPOLEON, lean: -6, head: { tilt: -10 }, expr: 'happy' },
  { ...NAPOLEON, lean: -7, head: { tilt: -10 }, expr: 'blink' },
  { ...NAPOLEON, lean: -6, head: { tilt: -10 }, expr: 'happy' },
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'happy' },
];

/** Key durations + in-betweens per pair (each in-between `inb` ticks) → one duration per frame. */
const keyed = (keys: readonly number[], per: readonly number[], inb: number): number[] =>
  keys.flatMap((d, i) => (i < per.length ? [d, ...Array<number>(per[i]).fill(inb)] : [d]));

/** Bored (11 frames): eased steps into and out of the Napoleon pose, the chin lift tweened. */
const BORED_PER = [2, 1, 0, 0, 2];
const THOM_BORED = tween(THOM_STYLE, THOM_BORED_KEYS, { perKey: BORED_PER });
const THOM_BORED_T = keyed([10, 12, 36, 8, 26, 14], BORED_PER, 4);

/** The spare pistol twirled on the trigger finger at the hip (held by the barrel: 'pistol-butt'). */
const SPIN = (heldAngle: number, extra: Pose = {}): Pose => ({ ...P.STAND, armN: A(40, 40, 'point'), armF: A(-6, 26), held: 'pistol-butt', heldAngle, expr: 'happy', ...extra });

/** Fidget A (13 frames): draws the spare pistol, two fast twirls, a flick up, catches it, tucks it away. */
const FIDGET_A_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(10, 30), expr: 'normal' },
  SPIN(-90, { armN: A(30, 50, 'point'), expr: 'normal' }),
  SPIN(0),
  SPIN(90),
  SPIN(180),
  SPIN(270),
  SPIN(360, { armN: A(45, 45, 'point') }),
  SPIN(450, { armN: A(55, 70, 'point'), lean: -2, expr: 'blink' }),
  SPIN(540, { armN: A(60, 95, 'point'), lean: -3, head: { tilt: -8 }, expr: 'happy' }),
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), held: 'pistol-butt', heldAngle: 600, lean: -1, expr: 'happy' },
  { ...P.STAND, armN: A(10, 30), expr: 'happy' },
];
const FIDGET_A_PER = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0];
const THOM_FIDGET_A = tween(THOM_STYLE, FIDGET_A_KEYS, { perKey: FIDGET_A_PER });
const THOM_FIDGET_A_T = keyed([8, 6, 3, 3, 3, 3, 4, 6, 18, 10, 8], FIDGET_A_PER, 4);

/** Fidget B (9 frames): interlaces his fingers, pushes them forward (a knuckle crack), stretches up, shakes out. */
const FIDGET_B_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  { ...P.STAND, armN: { to: [6, 2], hand: 'fist' }, armF: { to: [6, 2], hand: 'fist' }, expr: 'normal' },
  { ...P.STAND, armN: { to: [11, 0], hand: 'fist' }, armF: { to: [11, 0], hand: 'fist' }, lean: 3, expr: 'blink' },
  { ...P.STAND, armN: { to: [2, -12], hand: 'open' }, armF: { to: [3, -12], hand: 'open' }, lean: -4, bob: -1, expr: 'happy' },
  { ...P.STAND, armN: A(14, 20, 'open'), armF: A(-12, 20, 'open'), bob: 1, expr: 'happy' },
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
];
const FIDGET_B_PER = [1, 0, 1, 1, 0];
const THOM_FIDGET_B = tween(THOM_STYLE, FIDGET_B_KEYS, { perKey: FIDGET_B_PER });
const THOM_FIDGET_B_T = keyed([8, 10, 16, 24, 8, 8], FIDGET_B_PER, 7);

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
  fidgetA: THOM_FIDGET_A,
  fidgetB: THOM_FIDGET_B,
  durations: {
    bored: THOM_BORED_T,
    'fidget-a': THOM_FIDGET_A_T,
    'fidget-b': THOM_FIDGET_B_T,
    victory: [16, 16],
  },
};
