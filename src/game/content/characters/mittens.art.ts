/**
 * `mittens` — Sergeant Torvald "Mittens" Magnusson (GDD §3.2): the gentle giant. Cream bobble hat
 * with red stripes, ginger beard, red knitted sweater and mittens, a knitting bag with two
 * needles sticking out. He almost never speaks: no shouting faces.
 * - Knife look: a two-needle knitting poke ("tik-tik").
 * - Bored: knits three rows; the yarn ball rolls away; he shuffles after it and back.
 * - Death: falls backwards stiff like a tree (big dust puff); the bobble hat pops off and bounces
 *   twice.
 * - Victory: holds up a freshly knitted tiny swan and beams.
 */
import type { ArmPose, HumanStyle, LegPose, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';
import { at, bobbleHat, decorateFrames, dustPuff, knittedSwan, knitting, onGround, pt, yarnBall } from './pieces';

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const MITTENS_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'rust',
  hairStyle: 'short',
  headgear: 'bobble',
  gear: 'snow',
  accent: 'red',
  top: 'red',
  topType: 'sweater',
  pants: 'stone',
  boots: 'brown',
  gloves: 'red',
  belt: 'brown',
  build: 'heavy',
  accessories: ['satchel', 'needles'],
  face: ['beard'],
};

/** Two quick pokes with the knitting needles: tik, tik. */
const MITTENS_KNIFE: readonly Pose[] = [
  { armN: { to: [5, 1] }, held: 'needles', heldAngle: -12, expr: 'normal' },
  { armN: { to: [10, 0] }, held: 'needles', heldAngle: 0, lean: 6, expr: 'normal' },
  { armN: { to: [7, 1] }, held: 'needles', heldAngle: -4, lean: 4, expr: 'blink' },
  { armN: { to: [11, 0] }, held: 'needles', heldAngle: 0, lean: 8, expr: 'normal' },
  { armN: { to: [5, 2] }, held: 'needles', heldAngle: -30, lean: 2, expr: 'normal' },
];

/** Knitting in front of the chest: needles up in the near hand, the far hand at the work. */
const KNIT_A: Pose = { ...P.STAND, armN: { to: [6, 2] }, armF: { to: [5, 3] }, held: 'needles', heldAngle: -64, head: { tilt: 10 }, expr: 'normal' };
const KNIT_B: Pose = { ...KNIT_A, armN: { to: [6, 3] }, armF: { to: [4, 2] }, heldAngle: -44, expr: 'blink' };

/** Three rows of knitting, the yarn rolls off, he shuffles after it, picks it up, shuffles back. */
const MITTENS_BORED: readonly Pose[] = [
  KNIT_A,
  KNIT_B,
  KNIT_A,
  KNIT_B,
  KNIT_A,
  KNIT_B,
  { ...KNIT_A, head: { tilt: 14, dx: 1 }, expr: 'panic' },
  { ...P.WALK[0], armN: { to: [6, 2] }, armF: A(10, 30), held: 'needles', heldAngle: -64, dx: 3, expr: 'normal' },
  { ...P.WALK[2], armN: { to: [6, 2] }, armF: A(10, 30), held: 'needles', heldAngle: -64, dx: 6, expr: 'normal' },
  { legN: L(40, 50), legF: L(-16, 40), armN: { to: [6, 2] }, armF: { to: [6, 13] }, held: 'needles', heldAngle: -64, lean: 44, dx: 9, expr: 'blink' },
  { ...P.WALK[4], armN: { to: [6, 2] }, armF: { to: [5, 3] }, held: 'needles', heldAngle: -64, dx: 6, expr: 'happy' },
  { ...P.WALK[6], armN: { to: [6, 2] }, armF: { to: [5, 3] }, held: 'needles', heldAngle: -64, dx: 3, expr: 'happy' },
];

/** Stiff as a tree: straight legs, arms at the sides. */
const STIFF: Pose = { legN: L(4, 0), legF: L(-4, 0), armN: A(6, 4, 'open'), armF: A(-4, 4, 'open') };

/** Hit, tips backwards stiffly, slams flat (dust); the hat pops off and bounces twice. */
const MITTENS_DIE: readonly Pose[] = [
  { ...STIFF, expr: 'hurt' },
  { ...STIFF, rot: -20, expr: 'hurt' },
  { ...STIFF, rot: -55, expr: 'hurt' },
  { ...STIFF, rot: -90, hat: false, expr: 'dazed' },
  { ...STIFF, rot: -90, hat: false, expr: 'dazed' },
  { ...STIFF, rot: -90, hat: false, expr: 'dazed' },
  { ...STIFF, rot: -90, hat: false, expr: 'dazed' },
];

/** The tiny knitted swan held up out in front (the arm clears his beaming face); a little lift. */
const MITTENS_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [9, -7] }, armF: A(10, 30), expr: 'happy' },
  { ...P.STAND, armN: { to: [9, -9] }, armF: A(14, 30), expr: 'happy', bob: 1 },
];

/** Where the yarn ball lies in each bored frame (x on the ground), or 'hand' while he holds it. */
const YARN: ReadonlyArray<number | 'hand'> = [7, 7, 7, 7, 7, 7, 11, 15, 18, 'hand', 'hand', 'hand'];

export const MITTENS_ART: PlayerArtOpts = {
  knife: MITTENS_KNIFE,
  bored: MITTENS_BORED,
  die: MITTENS_DIE,
  victory: MITTENS_VICTORY,
  durations: {
    bored: [10, 10, 10, 10, 10, 10, 18, 8, 8, 14, 8, 8],
    die: [8, 6, 5, 8, 8, 6, 30],
    victory: [24, 24],
  },
  decorate: {
    bored: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        const [hx, hy] = pt(f, 'hand', [6, -20]);
        const out = [];
        // The knitting hangs under the needle tips while he works.
        if (i <= 6) out.push(at(knitting(), hx + 1, hy + 3));
        const y = YARN[i] ?? 7;
        if (y !== 'hand') out.push(onGround(yarnBall(), y, 0));
        // Picked up at his feet, then carried back against his chest.
        else if (i === 9) out.push(onGround(yarnBall(), 17, 0));
        else out.push(at(yarnBall(), (poses[i].dx ?? 0) + 5, -16));
        return out;
      }),
    die: (frames) =>
      decorateFrames(frames, (f, i) => {
        const [hx] = pt(f, 'head', [-20, -6]);
        if (i === 3) return [at(dustPuff(1), hx - 2, -4), at(bobbleHat(), hx - 6, -26)];
        if (i === 4) return [at(dustPuff(0), hx - 6, -3), onGround(bobbleHat(), hx - 10, 0)];
        if (i === 5) return [at(bobbleHat(), hx - 13, -10)];
        if (i === 6) return [onGround(bobbleHat(), hx - 15, 0)];
        return null;
      }),
    victory: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        const [hx, hy] = pt(f, 'hand', [2, -40]);
        // A Helium Head covers the raised hand: he holds the swan out in front of his big face.
        if (poses[i].headScale === 2) {
          const [ex, ey] = pt(f, 'head', [2, -36]);
          return [at(knittedSwan(), ex + 13, ey + 4)];
        }
        return [at(knittedSwan(), hx + 1, hy - 5)];
      }),
  },
};
