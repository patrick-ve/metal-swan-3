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
import { tween } from '../../art/tween';
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

/** Takes out the roll, unrolls it, reads, nods twice, rolls it up, pleased (keys). */
const VINCENT_BORED_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(30, 70), armF: A(-6, 26), held: 'plan', heldAngle: -70, expr: 'normal' },
  { ...READ, expr: 'normal' },
  { ...READ, expr: 'blink' },
  { ...READ, head: { tilt: 14, dy: 1 }, expr: 'normal' },
  { ...READ, head: { tilt: 8 }, expr: 'normal' },
  { ...READ, head: { tilt: 14, dy: 1 }, expr: 'happy' },
  { ...P.STAND, armN: A(30, 70), armF: A(-6, 26), held: 'plan', heldAngle: -70, expr: 'happy' },
];

/** Key durations + in-betweens per pair (each in-between `inb` ticks) → one duration per frame. */
const keyed = (keys: readonly number[], per: readonly number[], inb: number): number[] =>
  keys.flatMap((d, i) => (i < per.length ? [d, ...Array<number>(per[i]).fill(inb)] : [d]));

/** Bored (12 frames): the keys with eased in-betweens on the unroll, the nods and the roll-up. */
const BORED_PER = [2, 0, 1, 1, 1, 1];
const VINCENT_BORED = tween(VINCENT_STYLE, VINCENT_BORED_KEYS, { perKey: BORED_PER });
const VINCENT_BORED_T = keyed([14, 14, 30, 8, 8, 8, 24], BORED_PER, 4);

/** Fidget A (13 frames): pulls the plan from the jacket, unfolds it, studies it, traces a line, folds it away. */
const FIDGET_A_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  { ...P.STAND, armN: A(30, 70), armF: A(-6, 26), held: 'plan', heldAngle: -70, lean: 1, expr: 'normal' },
  { ...READ, armF: { to: [4, 3], hand: 'fist' }, head: { tilt: 8 }, expr: 'normal' },
  { ...READ, head: { tilt: 14, dy: 1 }, hunch: 1, expr: 'blink' },
  { ...READ, armF: { to: [6, 1], hand: 'point' }, head: { tilt: 14, dy: 1 }, hunch: 1, expr: 'normal' },
  { ...READ, armF: { to: [5, 4], hand: 'point' }, head: { tilt: 10 }, expr: 'happy' },
  { ...P.STAND, armN: A(30, 70), armF: A(-6, 26), held: 'plan', heldAngle: -70, expr: 'happy' },
];
const FIDGET_A_PER = [1, 1, 1, 1, 1, 1];
const VINCENT_FIDGET_A = tween(VINCENT_STYLE, FIDGET_A_KEYS, { perKey: FIDGET_A_PER, ease: ['inOut', 'outBack', 'inOut', 'inOut', 'inOut', 'inOut'] });
const VINCENT_FIDGET_A_T = keyed([10, 10, 16, 24, 14, 16, 12], FIDGET_A_PER, 4);

/** Fidget B (10 frames): straightens the tie, a smug look over the shoulder, back. */
const FIDGET_B_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  { ...P.STAND, armN: { to: [4, -6], hand: 'fist' }, armF: { to: [5, -4], hand: 'open' }, head: { tilt: 8 }, expr: 'normal' },
  { ...P.STAND, armN: { to: [4, -8], hand: 'fist' }, armF: { to: [5, -4], hand: 'open' }, head: { tilt: -8 }, lean: -2, expr: 'blink' },
  { ...P.STAND, armN: A(20, 50), armF: A(-6, 26), head: { dx: -1, tilt: -8 }, lean: -3, expr: 'happy' },
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'happy' },
];
const FIDGET_B_PER = [1, 1, 2, 1];
const VINCENT_FIDGET_B = tween(VINCENT_STYLE, FIDGET_B_KEYS, { perKey: FIDGET_B_PER });
const VINCENT_FIDGET_B_T = keyed([8, 14, 18, 30, 10], FIDGET_B_PER, 6);

/** The open plan shows on every frame after the first without the rolled prop (bored, fidget A). */
const planOpen = (p: Pose, i: number): boolean => i > 0 && p.held === undefined;

/** Taps the roll in his palm, then the smug thumbs-up. */
const VINCENT_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, 2] }, armF: { to: [6, 4], hand: 'open' }, held: 'plan', heldAngle: 20, expr: 'normal' },
  { ...P.STAND, armN: { to: [6, 4] }, armF: { to: [6, 4], hand: 'open' }, held: 'plan', heldAngle: 40, expr: 'normal' },
  { ...P.STAND, armN: { sh: 96, el: 70, hand: 'thumb' }, armF: A(-6, 26), lean: -3, expr: 'normal' },
  { ...P.STAND, armN: { sh: 100, el: 70, hand: 'thumb' }, armF: A(-6, 26), lean: -4, expr: 'blink' },
];

/** The open plan sheet at the near hand on every frame where both hands hold it. */
function withPlan(frames: Parameters<typeof decorateFrames>[0], poses: readonly Pose[]) {
  return decorateFrames(frames, (f, i) => {
    if (!planOpen(poses[i], i)) return null;
    const [hx, hy] = pt(f, 'hand', [7, -18]);
    return [at(planSheet(), hx - 1, hy - 2)];
  });
}

export const VINCENT_ART: PlayerArtOpts = {
  knife: VINCENT_KNIFE,
  bored: VINCENT_BORED,
  victory: VINCENT_VICTORY,
  fidgetA: VINCENT_FIDGET_A,
  fidgetB: VINCENT_FIDGET_B,
  durations: {
    bored: VINCENT_BORED_T,
    'fidget-a': VINCENT_FIDGET_A_T,
    'fidget-b': VINCENT_FIDGET_B_T,
    victory: [10, 10, 30, 30],
  },
  decorate: {
    bored: (frames, poses) => withPlan(frames, poses),
    'fidget-a': (frames, poses) => withPlan(frames, poses),
  },
};
