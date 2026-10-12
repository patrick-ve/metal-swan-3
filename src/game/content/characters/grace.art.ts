/**
 * `grace` — Captain Grace Stillmere (GDD §3.1): a slim officer with an ivory beret and a long
 * ivory scarf that always trails behind her, a navy jacket and white gloves.
 * - Run: a long, smooth stride (never hurried).
 * - Knife look: a furled black umbrella, a quick fencing jab.
 * - Bored: checks a pocket watch, nods, polishes a boot with the end of her scarf.
 * - Death: sits down neatly, folds her hands, tips over (dust puff).
 * - Victory: a crisp salute, then a tiny curtsy; the scarf flutters up.
 */
import { PAL } from '../../../engine/palette';
import type { ArmPose, HumanStyle, LegPose, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';
import { at, decorateFrames, dustPuff, pocketWatch, pt, scarfEnd } from './pieces';

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const GRACE_STYLE: HumanStyle = {
  skin: 'skinC',
  hair: 'hairA',
  hairStyle: 'bob',
  // GDD `beret`: drawn as the rig's slouched officer beret with a brass badge, so it never reads
  // as Pip's round helmet at 1×.
  headgear: 'beret-slouch',
  // GDD gear `snow` (ivory), shifted one step lighter: the snow ramp's dark end is the grey of
  // Pip's helmet.
  gear: [PAL.snow[1], PAL.snow[2], PAL.snow[3]],
  accent: 'snow',
  top: 'navy',
  topType: 'jacket',
  shirt: 'snow',
  pants: 'navy',
  // GDD "ink": the black leather ramp (ink boots would melt into the outline).
  boots: 'black',
  gloves: 'snow',
  belt: 'brown',
  build: 'slim',
  accessories: ['scarf'],
  // A white highlight behind the pupil keeps her eye readable on deep skin at 1×.
  face: ['eyeshine'],
};

/** The long, smooth stride: wider thigh swings, softer knees, no bob. */
const GRACE_RUN: readonly Pose[] = P.RUN.map((p) => ({
  ...p,
  legN: p.legN ? L(p.legN.hip * 1.15, p.legN.knee * 0.85, p.legN.foot) : undefined,
  legF: p.legF ? L(p.legF.hip * 1.15, p.legF.knee * 0.85, p.legF.foot) : undefined,
  bob: 0,
}));

/** Fencing jab with the furled umbrella: en garde, lunge, full extension, recover. */
const GRACE_KNIFE: readonly Pose[] = [
  { armN: { to: [4, 1], hand: 'fist' }, held: 'umbrella', heldAngle: -25, lean: -4, expr: 'normal' },
  { armN: { to: [9, 0], hand: 'fist' }, held: 'umbrella', heldAngle: -6, lean: 8, expr: 'shout' },
  { armN: { to: [11, 1], hand: 'fist' }, held: 'umbrella', heldAngle: 0, lean: 14, expr: 'shout' },
  { armN: { to: [8, 2], hand: 'fist' }, held: 'umbrella', heldAngle: 4, lean: 8, expr: 'normal' },
  { armN: { to: [3, 3], hand: 'fist' }, held: 'umbrella', heldAngle: -62, lean: 2, expr: 'normal' },
];

const STOOP: Pose = { legN: L(34, 34), legF: L(-18, 22), lean: 50 };

/** Pocket watch (3 frames), a nod, two boot-polish frames with the scarf end, satisfied. */
const GRACE_BORED: readonly Pose[] = [
  { ...P.STAND, armN: { to: [5, 3] }, armF: A(-6, 26), head: { tilt: 10 }, expr: 'normal', flutter: 1 },
  { ...P.STAND, armN: { to: [6, 1] }, armF: A(-6, 26), head: { tilt: 12 }, expr: 'blink', flutter: 2 },
  { ...P.STAND, armN: { to: [6, 1] }, armF: A(-6, 26), head: { dy: 1, tilt: 14 }, expr: 'normal', flutter: 3 },
  { ...STOOP, armN: { to: [5, 14], hand: 'fist' }, armF: { to: [4, 13], hand: 'fist' }, expr: 'normal', flutter: 1 },
  { ...STOOP, armN: { to: [8, 14], hand: 'fist' }, armF: { to: [6, 14], hand: 'fist' }, expr: 'happy', flutter: 2 },
  { ...P.STAND, armN: A(12, 30), armF: A(-6, 26), expr: 'happy', flutter: 3 },
];

/** Sitting on the floor, legs straight out in front. */
const SIT: Pose = { legN: L(90, 4, 10), legF: L(84, 8, 10) };
const FOLDED: Pose = { ...SIT, armN: { to: [5, 6] }, armF: { to: [4, 6] } };
/** Tipped over, still more or less seated: the knees stay up, the hands stay folded. */
const TIPPED: Pose = { ...FOLDED, legN: L(60, 40, 10), legF: L(54, 44, 10), rot: -90 };

/** Hit, sits down neatly, folds her hands, tips over stiffly, lies still. */
const GRACE_DIE: readonly Pose[] = [
  { ...P.STAND, armN: A(60, 60, 'open'), armF: A(80, 40, 'open'), lean: -10, expr: 'hurt' },
  { ...SIT, armN: A(30, 40, 'open'), armF: A(20, 40, 'open'), lean: -4, expr: 'hurt' },
  { ...FOLDED, expr: 'blink' },
  { ...FOLDED, rot: -40, expr: 'blink' },
  { ...TIPPED, expr: 'blink' },
  { ...TIPPED, expr: 'blink' },
];

const SALUTE_ARM: ArmPose = { to: [5, -11], hand: 'open', bend: 'up' };
const CURTSY: Pose = { legN: L(14, 26), legF: L(-38, 44), armN: A(34, 16, 'open'), armF: A(30, 16, 'open'), bob: 2, lean: 6 };

/** Crisp salute, then a tiny curtsy; the scarf lifts. */
const GRACE_VICTORY: readonly Pose[] = [
  { ...P.STAND, legN: L(6, 2), legF: L(-4, 2), armN: SALUTE_ARM, armF: A(0, 4), expr: 'normal', flutter: 0 },
  { ...P.STAND, legN: L(6, 2), legF: L(-4, 2), armN: SALUTE_ARM, armF: A(0, 4), expr: 'happy', flutter: 1 },
  { ...CURTSY, head: { dy: 1 }, expr: 'blink', flutter: 2 },
  { ...CURTSY, head: { dy: 1 }, expr: 'happy', flutter: 3 },
];

export const GRACE_ART: PlayerArtOpts = {
  // The long scarf always trails; it waves with the breathing frames.
  torso: { flutter: 1 },
  idle: [{ flutter: 1 }, { hunch: 1, flutter: 3 }],
  run: GRACE_RUN,
  knife: GRACE_KNIFE,
  bored: GRACE_BORED,
  die: GRACE_DIE,
  victory: GRACE_VICTORY,
  durations: {
    bored: [24, 44, 18, 12, 12, 36],
    die: [6, 10, 14, 6, 8, 40],
    victory: [24, 24, 18, 30],
  },
  decorate: {
    bored: (frames) =>
      decorateFrames(frames, (f, i) => {
        const [hx, hy] = pt(f, 'hand', [6, -20]);
        if (i <= 2) return [at(pocketWatch(), hx + 1, hy - 1)];
        if (i === 3 || i === 4) return [at(scarfEnd(), hx + 1, hy + 1)];
        return null;
      }),
    die: (frames) => decorateFrames(frames, (f, i) => (i === 4 ? [at(dustPuff(0), pt(f, 'head', [-14, -6])[0] - 8, -3)] : null)),
  },
};
