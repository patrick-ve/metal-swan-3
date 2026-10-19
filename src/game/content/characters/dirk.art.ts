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
import { tween } from '../../art/tween';

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
const DIRK_BORED_KEYS: readonly Pose[] = [
  { ...WIPE, armN: { to: [9, -6], hand: 'open' }, expr: 'blink' },
  { ...WIPE, armN: { to: [7, -6], hand: 'open' }, expr: 'blink' },
  { ...WIPE, armN: { to: [9, -6], hand: 'open' }, expr: 'normal' },
  { ...P.STAND, armN: { to: [7, -3] }, armF: A(-6, 26), held: 'wrench', heldAngle: -80, head: { tilt: 8 }, expr: 'normal' },
  { ...P.STAND, armN: { to: [7, -3] }, armF: A(-6, 26), held: 'wrench', heldAngle: -100, head: { tilt: 8 }, expr: 'blink' },
  { ...P.STAND, armN: { to: [7, -3] }, armF: A(-6, 26), held: 'wrench', heldAngle: -80, head: { tilt: 10, dy: 1 }, expr: 'happy' },
  { ...P.STAND, armN: A(20, 50), armF: A(-6, 26), held: 'wrench', heldAngle: 60, expr: 'happy' },
];

/** Key durations + in-betweens per pair (each in-between `inb` ticks) → one duration per frame. */
const keyed = (keys: readonly number[], per: readonly number[], inb: number): number[] =>
  keys.flatMap((d, i) => (i < per.length ? [d, ...Array<number>(per[i]).fill(inb)] : [d]));

/** Bored (11 frames): the wipe strokes tweened, an eased reach for the wrench and a turn of it. */
const BORED_PER = [1, 1, 0, 1, 0, 1];
const DIRK_BORED = tween(DIRK_STYLE, DIRK_BORED_KEYS, { perKey: BORED_PER });
const DIRK_BORED_T = keyed([8, 8, 14, 18, 18, 22, 18], BORED_PER, 4);

const PL = (to: readonly [number, number], heldAngle: number, extra: Pose = {}): Pose => ({ ...P.STAND, armN: { to }, armF: A(-6, 26), held: 'plunger', heldAngle, ...extra });

/** Fidget A (13 frames): draws the plunger, twirls it a full turn in front of him, plants it cup-down, leans on it. */
const FIDGET_A_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  PL([5, 2], -60, { expr: 'normal' }),
  PL([8, 1], -150, { expr: 'happy' }),
  PL([9, 0], 120, { expr: 'happy' }),
  PL([8, 1], 30, { expr: 'happy' }),
  PL([9, 0], -60, { lean: 2, expr: 'shout' }),
  PL([9, 4], 90, { lean: 6, bob: 1, expr: 'normal' }),
  PL([8, 2], 90, { lean: 8, armF: { to: [8, 2], hand: 'fist' }, legF: { hip: -14, knee: 4 }, expr: 'happy' }),
  PL([8, 2], 90, { lean: 8, armF: { to: [8, 2], hand: 'fist' }, legF: { hip: -14, knee: 4 }, expr: 'blink' }),
  { ...P.STAND, armN: A(20, 50), armF: A(-6, 26), held: 'plunger', heldAngle: -80, expr: 'happy' },
];
const FIDGET_A_PER = [1, 0, 0, 0, 0, 1, 0, 0, 1];
const DIRK_FIDGET_A = tween(DIRK_STYLE, FIDGET_A_KEYS, { perKey: FIDGET_A_PER, ease: ['inOut', 'linear', 'linear', 'linear', 'linear', 'in', 'outBack', 'inOut', 'inOut'] });
const DIRK_FIDGET_A_T = keyed([8, 6, 4, 4, 4, 5, 6, 30, 12, 12], FIDGET_A_PER, 3);

/** Fidget B (9 frames): shades his eyes and checks the sky, a squint, a shrug. */
const FIDGET_B_KEYS: readonly Pose[] = [
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'normal' },
  { ...P.STAND, armN: A(60, 110, 'open'), armF: A(-6, 26), head: { tilt: -4 }, lean: -1, expr: 'normal' },
  { ...P.STAND, armN: { to: [5, -11], hand: 'open' }, armF: A(-6, 26), head: { tilt: -8 }, lean: -2, expr: 'normal' },
  { ...P.STAND, armN: { to: [5, -11], hand: 'open' }, armF: A(-6, 26), head: { tilt: -10, dx: 1 }, lean: -3, expr: 'blink' },
  { ...P.STAND, armN: A(30, 80, 'open'), armF: A(20, 80, 'open'), hunch: 1, expr: 'normal' },
  { ...P.STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'happy' },
];
const FIDGET_B_PER = [0, 0, 1, 1, 1];
const DIRK_FIDGET_B = tween(DIRK_STYLE, FIDGET_B_KEYS, { perKey: FIDGET_B_PER });
const DIRK_FIDGET_B_T = keyed([8, 5, 20, 24, 14, 8], FIDGET_B_PER, 5);

/** The plunger raised overhead, a shout. */
const DIRK_VICTORY: readonly Pose[] = [
  { ...P.STAND, armN: { to: [10, -6] }, armF: A(20, 70), held: 'plunger', heldAngle: -70, lean: -3, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, -7] }, armF: A(20, 70), held: 'plunger', heldAngle: -80, lean: -4, expr: 'shout', bob: 1 },
];

export const DIRK_ART: PlayerArtOpts = {
  knife: DIRK_KNIFE,
  bored: DIRK_BORED,
  victory: DIRK_VICTORY,
  fidgetA: DIRK_FIDGET_A,
  fidgetB: DIRK_FIDGET_B,
  durations: {
    bored: DIRK_BORED_T,
    'fidget-a': DIRK_FIDGET_A_T,
    'fidget-b': DIRK_FIDGET_B_T,
    victory: [20, 20],
  },
};
