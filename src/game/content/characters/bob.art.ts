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
import { tween } from '../../art/tween';
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
const BOB_BORED_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'normal', flutter: 0 },
  { ...READ, expr: 'normal', flutter: 1 },
  { ...READ, expr: 'blink', flutter: 2 },
  { ...READ, expr: 'normal', flutter: 3 },
  { ...READ, head: { tilt: 0 }, expr: 'happy', flutter: 0 },
  { ...READ, expr: 'normal', flutter: 1 },
  { ...P.STAND, armN: A(20, 60), armF: A(-6, 26), expr: 'happy', flutter: 2 },
];

/** Key durations + in-betweens per pair (each in-between `inb` ticks) → one duration per frame. */
const keyed = (keys: readonly number[], per: readonly number[], inb: number): number[] =>
  keys.flatMap((d, i) => (i < per.length ? [d, ...Array<number>(per[i]).fill(inb)] : [d]));

/** Bored (10 frames): an eased reach for the pass and back, the head turn tweened. */
const BORED_PER = [1, 0, 0, 1, 0, 1];
const BOB_BORED = tween(BOB_STYLE, BOB_BORED_KEYS, { perKey: BORED_PER });
const BOB_BORED_T = keyed([12, 16, 18, 16, 26, 16, 16], BORED_PER, 4);

const FLY = (to: readonly [number, number], heldAngle: number, extra: Pose = {}): Pose => ({ ...P.STAND, armN: { to }, armF: A(-6, 26), held: 'airliner', heldAngle, expr: 'happy', ...extra });

/** Fidget A (13 frames): takes off the toy airliner, flies it up in a climb, banks round over his head, lands it. */
const FIDGET_A_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal', flutter: 0 },
  FLY([7, 2], 0, { expr: 'normal', flutter: 1 }),
  FLY([10, -4], -25, { lean: -1, flutter: 2 }),
  FLY([8, -11], -40, { lean: -3, head: { tilt: -8 }, expr: 'shout', flutter: 3 }),
  FLY([1, -14], 180, { lean: -4, head: { tilt: -10 }, expr: 'shout', flutter: 0 }),
  FLY([-3, -9], 150, { lean: -2, head: { tilt: -8 }, flutter: 1 }),
  FLY([4, -2], 20, { lean: 1, bob: 1, flutter: 2 }),
  FLY([7, 2], 0, { expr: 'blink', flutter: 3 }),
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'happy', flutter: 0 },
];
const FIDGET_A_PER = [1, 1, 0, 1, 1, 1, 0, 0];
const BOB_FIDGET_A = tween(BOB_STYLE, FIDGET_A_KEYS, { perKey: FIDGET_A_PER, hold: 'b' });
const BOB_FIDGET_A_T = keyed([8, 10, 6, 6, 6, 6, 6, 18, 10], FIDGET_A_PER, 5);

/** Fidget B (9 frames): looks up at the sky, hands on hips, the cape lifting in the wind. */
const FIDGET_B_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal', flutter: 0 },
  { ...P.STAND, armN: { to: [-2, 4], hand: 'fist' }, armF: { to: [-3, 4], hand: 'fist' }, lean: -2, expr: 'normal', flutter: 1 },
  { ...P.STAND, armN: { to: [-2, 4], hand: 'fist' }, armF: { to: [-3, 4], hand: 'fist' }, lean: -4, head: { tilt: -10 }, expr: 'happy', flutter: 3 },
  { ...P.STAND, armN: { to: [-2, 4], hand: 'fist' }, armF: { to: [-3, 4], hand: 'fist' }, lean: -3, head: { tilt: -8 }, expr: 'blink', flutter: 2 },
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'happy', flutter: 0 },
];
const FIDGET_B_PER = [1, 1, 1, 1];
const BOB_FIDGET_B = tween(BOB_STYLE, FIDGET_B_KEYS, { perKey: FIDGET_B_PER });
const BOB_FIDGET_B_T = keyed([8, 12, 30, 14, 8], FIDGET_B_PER, 4);

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
  fidgetA: BOB_FIDGET_A,
  fidgetB: BOB_FIDGET_B,
  durations: {
    bored: BOB_BORED_T,
    'fidget-a': BOB_FIDGET_A_T,
    'fidget-b': BOB_FIDGET_B_T,
    victory: [20, 20],
  },
  decorate: {
    bored: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        // The pass shows while the near hand holds it up (an IK arm; the in-betweens are FK).
        if (i === 0 || poses[i].armN?.to === undefined) return null;
        const [hx, hy] = pt(f, 'hand', [7, -18]);
        return [at(boardingPass(), hx + 1, hy - 2)];
      }),
  },
};
