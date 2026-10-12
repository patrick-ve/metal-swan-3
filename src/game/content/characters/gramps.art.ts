/**
 * `gramps` — Warrant Officer Ambrose "Gramps" Fenwick (GDD §3.4): bald dome with white side
 * tufts, brass welding goggles on the forehead, a white walrus moustache and bushy brows, a rust
 * boiler suit and a leather tool belt. He leans 1 px forward in idle.
 * - Knife look: a big wrench swing, "CLANG".
 * - Bored: takes a screwdriver to his boot. (The 120 ticks of squeaky steps afterwards are the
 *   status `squeaky-boot`, characters/squeak.ts; not drawn.)
 * - Death: his dentures fly out in an arc and chatter on the ground; he grabs them back as he
 *   falls.
 * - Victory: polishes his bald head with a rag; a sparkle pops; thumbs up.
 */
import type { ArmPose, HumanStyle, LegPose, Pose } from '../../art/humanoid';
import type { PlayerArtOpts } from '../../art/human-sprites';
import * as P from '../../art/poses';
import { at, decorateFrames, dentures, onGround, pt, rag, screwdriver, sparkle } from './pieces';

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });

export const GRAMPS_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'snow',
  // GDD "bald" with white side tufts: the rig's bald dome plus tufts round the ears.
  hairStyle: 'tufts',
  headgear: 'goggles',
  gear: 'gold',
  accent: 'gold',
  top: 'rust',
  topType: 'jacket',
  shirt: 'rust',
  pants: 'rust',
  // GDD "ink": the black leather ramp (ink boots would melt into the outline).
  boots: 'black',
  gloves: 'brown',
  belt: 'brown',
  build: 'normal',
  // GDD "pouches (tool belt)": leather pouches with a screwdriver.
  accessories: ['toolbelt'],
  face: ['walrus', 'bushy-brows'],
};

/** The big wrench: wind-up over the shoulder, swing, CLANG, follow-through, recover. */
const GRAMPS_KNIFE: readonly Pose[] = [
  { armN: A(-140, 60), held: 'wrench', heldAngle: -130, lean: -6, expr: 'shout' },
  { armN: { to: [6, -10] }, held: 'wrench', heldAngle: -60, lean: 2, expr: 'shout' },
  { armN: A(85, 5), held: 'wrench', heldAngle: 5, lean: 12, expr: 'shout' },
  { armN: A(55, 15), held: 'wrench', heldAngle: 45, lean: 8, expr: 'normal' },
  { armN: A(25, 60), held: 'wrench', heldAngle: -70, lean: 3, expr: 'normal' },
];

const STOOP: Pose = { legN: L(36, 40), legF: L(-16, 24), lean: 52 };

/** Bends down to the boot with a screwdriver, a few turns, straightens up, pleased. */
const GRAMPS_BORED: readonly Pose[] = [
  { ...STOOP, armN: { to: [7, 13] }, armF: { to: [5, 12] }, expr: 'normal' },
  { ...STOOP, armN: { to: [8, 14] }, armF: { to: [5, 12] }, expr: 'blink' },
  { ...STOOP, armN: { to: [7, 13] }, armF: { to: [5, 12] }, expr: 'normal' },
  { ...STOOP, armN: { to: [8, 14] }, armF: { to: [5, 12] }, expr: 'blink' },
  { ...P.STAND, armN: A(16, 40), armF: A(-6, 26), lean: 6, expr: 'happy' },
  { ...P.STAND, legN: L(26, 30, 18), legF: L(-16, 10), armN: A(16, 40), armF: A(-6, 26), lean: 6, expr: 'normal' },
];

/** Hit (dentures out), staggers after them, they chatter, he grabs them as he falls flat. */
const GRAMPS_DIE: readonly Pose[] = [
  { ...P.STAND, armN: A(60, 60, 'open'), armF: A(80, 40, 'open'), lean: -12, expr: 'shout' },
  { legN: L(30, 30), legF: L(-10, 20), armN: A(70, 40, 'open'), armF: A(60, 40, 'open'), lean: -4, expr: 'hurt' },
  { legN: L(40, 44), legF: L(-6, 30), armN: { to: [10, 9], hand: 'open' }, armF: A(40, 30, 'open'), lean: 26, expr: 'hurt' },
  { legN: L(40, 44), legF: L(-6, 30), armN: { to: [11, 10], hand: 'open' }, armF: A(40, 30, 'open'), lean: 30, expr: 'hurt' },
  { legN: L(40, 44), legF: L(-6, 30), armN: { to: [11, 11], hand: 'open' }, armF: A(40, 30, 'open'), lean: 32, expr: 'dazed' },
  { legN: L(20, 40), legF: L(0, 60), armN: A(110, 10, 'fist'), armF: A(100, 10, 'open'), rot: 50, expr: 'dazed' },
  { legN: L(0, 10), legF: L(-10, 20), armN: A(170, 0, 'fist'), armF: A(160, 0, 'open'), rot: 88, expr: 'blink' },
];

/** Polishes the dome with a rag (2 frames), a sparkle pops, thumbs up. */
const GRAMPS_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [3, -12], hand: 'fist' }, armF: A(-4, 20), expr: 'blink' },
  { ...P.STAND, armN: { to: [1, -13], hand: 'fist' }, armF: A(-4, 20), expr: 'blink' },
  { ...P.STAND, armN: A(14, 40), armF: A(-4, 20), expr: 'happy' },
  { ...P.STAND, armN: { sh: 96, el: 70, hand: 'thumb' }, armF: A(-4, 20), expr: 'happy' },
];

export const GRAMPS_ART: PlayerArtOpts = {
  // GDD §3.4: a 1 px forward lean in idle.
  idle: [{ lean: 6 }, { lean: 6, hunch: 1 }],
  knife: GRAMPS_KNIFE,
  bored: GRAMPS_BORED,
  die: GRAMPS_DIE,
  victory: GRAMPS_VICTORY,
  durations: {
    bored: [24, 10, 10, 10, 30, 24],
    die: [6, 6, 7, 6, 7, 8, 30],
    victory: [10, 10, 14, 40],
  },
  decorate: {
    bored: (frames) =>
      decorateFrames(frames, (f, i) => {
        if (i > 3) return null;
        const [hx, hy] = pt(f, 'hand', [8, -8]);
        return [at(screwdriver(), hx + 1, hy + 1)];
      }),
    die: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        const k = poses[i].headScale === 2 ? 2 : 1;
        const [hx, hy] = pt(f, 'head', [3, -29]);
        const [nx, ny] = pt(f, 'hand', [10, -10]);
        if (i === 0) return [at(dentures(true), hx + 6 * k, hy + 3 * k)];
        if (i === 1) return [at(dentures(false), hx + 13, hy - 6)];
        if (i === 2) return [onGround(dentures(true), 17, 0)];
        if (i === 3) return [onGround(dentures(false), 17, 0)];
        if (i === 4) return [onGround(dentures(true), 17, 0)];
        if (i === 5) return [at(dentures(false), nx, ny)];
        return [at(dentures(false), nx, ny)];
      }),
    victory: (frames, poses) =>
      decorateFrames(frames, (f, i) => {
        // A Helium Head doubles the dome: the rag and the sparkle move up onto its top.
        const k = poses[i].headScale === 2 ? 2 : 1;
        const [hx, hy] = pt(f, 'head', [3, -29]);
        const [nx, ny] = pt(f, 'hand', [3, -38]);
        if (i <= 1) return [at(rag(), k === 2 ? hx - 1 + i * 2 : nx, k === 2 ? hy - 11 : ny - 1)];
        if (i === 2) return [at(sparkle(true), hx - k, hy - 7 * k)];
        return [at(sparkle(false), hx - 2 * k, hy - 6 * k)];
      }),
  },
};
