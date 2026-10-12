/**
 * `pip` — Private Pip Okafor (GDD §3.3): the rookie. A low steel helmet over black curls, a
 * reflective gold vest over sky-blue sleeves, a backpack, an armband and white high-tops.
 * - Knife look: a frying pan, "BONK".
 * - Bored: blows a bubble-gum bubble that grows until it pops over his face; peels it off.
 * - Death: spins like a top for 12 ticks; the helmet bounces off and drops back on.
 * - Victory: jumps and punches the air twice; the helmet falls over his eyes.
 * Not drawn: the helmet slipping over the eyes on the `legs-land` frame (the head is part of the
 * torso strip, which does not know about landings).
 */
import type { ArmPose, HumanStyle, LegPose, Pose } from '../../art/humanoid';
import type { FrameList, PlayerArtOpts } from '../../art/human-sprites';
import { PAL } from '../../../engine/palette';
import * as P from '../../art/poses';
import { at, bubble, decorateFrames, gumSplat, helmet, mirrored, pt } from './pieces';

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const PIP_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: 'hairA',
  hairStyle: 'curly',
  headgear: 'helmet',
  // The light end of the steel ramp: a dark helmet over black curls would read as hair.
  gear: [PAL.steel[2], PAL.steel[3], PAL.steel[4]],
  accent: 'red',
  top: 'gold',
  topType: 'vest',
  shirt: 'sky',
  pants: 'sand',
  boots: 'snow',
  gloves: null,
  belt: 'brown',
  build: 'slim',
  accessories: ['backpack', 'armband', 'hivis'],
};

/** The frying pan: wind-up overhead, swing, BONK, follow-through, recover. */
const PIP_KNIFE: readonly Pose[] = [
  { armN: A(-150, 50), held: 'pan', heldAngle: -120, lean: -6, expr: 'shout' },
  { armN: { to: [7, -10] }, held: 'pan', heldAngle: -70, lean: 2, expr: 'shout' },
  { armN: A(80, 10), held: 'pan', heldAngle: 10, lean: 12, expr: 'shout' },
  { armN: A(50, 20), held: 'pan', heldAngle: 50, lean: 8, expr: 'happy' },
  { armN: A(20, 70), held: 'pan', heldAngle: -50, lean: 2, expr: 'happy' },
];

const GUM: Pose = { ...P.STAND, armN: A(10, 30), armF: A(-6, 26) };

/** Chew, chew, a bubble grows (3 sizes), POP over the face, peel it off, grin. */
const PIP_BORED: readonly Pose[] = [
  { ...GUM, expr: 'chew' },
  { ...GUM, expr: 'chew', bob: 1 },
  { ...GUM, expr: 'normal' },
  { ...GUM, expr: 'normal' },
  { ...GUM, head: { tilt: -10 }, expr: 'panic' },
  { ...GUM, armN: A(30, 60, 'open'), armF: A(20, 50, 'open'), expr: 'blink' },
  { ...GUM, armN: { to: [6, -9], hand: 'open' }, expr: 'blink' },
  { ...GUM, expr: 'happy' },
];

/** Arms flung out while he spins. */
const SPIN: Pose = { legN: L(12, 14), legF: L(-6, 12), armN: A(92, 0, 'open'), armF: A(88, 0, 'open'), expr: 'dazed' };

/** Hit, spins like a top (12 ticks: 4 frames, every other one mirrored), the helmet pops off, falls back on. */
const PIP_DIE: readonly Pose[] = [
  { ...P.STAND, armN: A(60, 60, 'open'), armF: A(80, 40, 'open'), lean: -10, expr: 'hurt' },
  SPIN,
  SPIN,
  { ...SPIN, hat: false },
  { ...SPIN, hat: false },
  { legN: L(40, 30), legF: L(-6, 20), armN: A(120, 40, 'open'), armF: A(140, 30, 'open'), lean: -24, rot: -30, hat: false, expr: 'hurt' },
  { legN: L(30, 20), legF: L(10, 30), armN: A(170, 10, 'open'), armF: A(190, 10, 'open'), rot: -90, hatDy: 3, expr: 'dazed' },
];

/** Jump and punch the air, land, again — and the helmet slides over his eyes. */
const PIP_VICTORY: readonly Pose[] = [
  { ...P.JUMP[0], armN: A(146, 14), armF: A(30, 70), dy: -6, expr: 'shout' },
  { ...P.LAND, armN: A(70, 70), armF: A(20, 70), expr: 'happy' },
  { ...P.JUMP[0], armN: A(150, 8), armF: A(30, 70), dy: -6, expr: 'shout' },
  { ...P.STAND, armN: A(30, 60), armF: A(20, 70), hatDy: 3, expr: 'happy' },
];

/** The gum bubble (or its splat) at the mouth: the head point plus a forward offset. */
function gum(frames: FrameList, poses: readonly Pose[]): FrameList {
  return decorateFrames(frames, (f, i) => {
    const k = poses[i].headScale === 2 ? 2 : 1;
    const [hx, hy] = pt(f, 'head', [3, -29]);
    if (i === 2) return [at(bubble(0), hx + 5 * k, hy + 3 * k)];
    if (i === 3) return [at(bubble(1), hx + 6 * k, hy + 3 * k)];
    if (i === 4) return [at(bubble(2), hx + 7 * k, hy + 2 * k)];
    if (i === 5) return [at(gumSplat(), hx + 2 * k, hy + 1 * k)];
    if (i === 6) return [at(gumSplat(), hx + 4 * k, hy + 2 * k)];
    return null;
  });
}

export const PIP_ART: PlayerArtOpts = {
  knife: PIP_KNIFE,
  bored: PIP_BORED,
  die: PIP_DIE,
  victory: PIP_VICTORY,
  durations: {
    bored: [14, 14, 16, 16, 24, 22, 18, 30],
    die: [6, 3, 3, 3, 3, 8, 40],
    victory: [10, 8, 10, 40],
  },
  decorate: {
    bored: gum,
    die: (frames) =>
      decorateFrames(frames, (f, i) => {
        const [hx, hy] = pt(f, 'head', [2, -29]);
        if (i === 3) return [at(helmet(), hx, hy - 12)];
        if (i === 4) return [at(helmet(), hx, hy - 17)];
        if (i === 5) return [at(helmet(), hx + 2, hy - 8)];
        return null;
      }).map((f, i) => (i === 2 || i === 4 ? mirrored(f) : f)),
  },
};
