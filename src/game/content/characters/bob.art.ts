/**
 * `bob` — BOB, CAPTAIN CLIMATE (docs/design/squad.md §1): tousled brown hair swept up, BLUE eyes,
 * pale skin, faint stubble, tall and slim, a navy T-shirt and a short green superhero cape with a
 * small leaf emblem. No ethnic stereotype in any art.
 * - Knife look: a tiny model airliner, a swoop.
 * - Bored: checks his boarding pass while the cape flutters.
 * - Victory: the flying pose, a fist to the sky, the cape streaming.
 */
import type { ArmPose, HumanStyle, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';
import { at, boardingPass, decorateFrames, pt } from './pieces';

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const BOB_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'swept-up',
  headgear: 'none',
  // The cape.
  accent: 'green',
  top: 'navy',
  topType: 'tee',
  pants: 'slate',
  boots: 'brown',
  gloves: null,
  belt: 'brown',
  build: 'lanky',
  accessories: ['cape'],
  face: ['stubble', 'blue-eyes'],
};

/** The model airliner: lifted, swooped in a dive, a little loop up, back. */
const BOB_KNIFE: readonly Pose[] = [
  { armN: A(-120, 80), held: 'airliner', heldAngle: -40, lean: -4, expr: 'normal' },
  { armN: { to: [7, -8] }, held: 'airliner', heldAngle: 20, lean: 2, expr: 'shout' },
  { armN: A(85, 5), held: 'airliner', heldAngle: 10, lean: 12, expr: 'shout' },
  { armN: A(70, 20), held: 'airliner', heldAngle: -20, lean: 8, expr: 'happy' },
  { armN: A(25, 60), held: 'airliner', heldAngle: -30, lean: 2, expr: 'normal' },
];

const READ: Pose = { ...P.STAND, armN: { to: [6, 2] }, armF: A(-6, 26), head: { tilt: 10 } };

/** Takes out the boarding pass, reads it (the cape flutters), checks again, puts it away. */
const BOB_BORED: readonly Pose[] = [
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'normal', flutter: 0 },
  { ...READ, expr: 'normal', flutter: 1 },
  { ...READ, expr: 'blink', flutter: 2 },
  { ...READ, expr: 'normal', flutter: 3 },
  { ...READ, head: { tilt: 0 }, expr: 'happy', flutter: 0 },
  { ...READ, expr: 'normal', flutter: 1 },
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'happy', flutter: 2 },
];

/** Up, up and away: a fist to the sky, the cape streaming. */
const BOB_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [10, -7], hand: 'fist' }, armF: A(20, 70), lean: -4, expr: 'happy', flutter: 1 },
  { ...P.STAND, armN: { to: [10, -8], hand: 'fist' }, armF: A(20, 70), lean: -6, expr: 'shout', grounded: false, dy: -2, flutter: 3 },
];

export const BOB_ART: PlayerArtOpts = {
  // The cape streams behind him in every torso strip and waves with the breathing frames.
  torso: { flutter: 1 },
  idle: [{ flutter: 1 }, { hunch: 1, flutter: 3 }],
  knife: BOB_KNIFE,
  bored: BOB_BORED,
  victory: BOB_VICTORY,
  durations: {
    bored: [16, 18, 18, 18, 30, 18, 20],
    victory: [20, 20],
  },
  decorate: {
    bored: (frames) =>
      decorateFrames(frames, (f, i) => {
        if (i < 1 || i > 5) return null;
        const [hx, hy] = pt(f, 'hand', [7, -18]);
        return [at(boardingPass(), hx + 1, hy - 2)];
      }),
  },
};
