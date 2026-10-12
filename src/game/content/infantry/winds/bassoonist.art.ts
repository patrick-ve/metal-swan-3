/**
 * `enemy/bassoonist[-<outfit>][-skin<b|c>]/…` — the Bassoon Bazooka (GDD §9.1): goggles (gear
 * `brown`) on the forehead, padded crimson ear-muffs (the only Legion soldier who protects his
 * ears) and an original "bassoon-launcher": a long wooden tube carried on the shoulder like a
 * bazooka, a brass muzzle ring with a dark bore, a crimson band, and a curly brass crook that
 * loops up behind his head like a pig's tail.
 *
 * Strips: the common set (common.art.ts) + aim (5f: one per aim step −45°, −22.5°, 0°, 22.5°,
 * 45°, kneeling; `muzzle` point) · fire (5f, the same with a muzzle flash and recoil) · reload
 * (4f, a fresh rocket into the back of the tube) · shoot · crouch-shoot · throw · gag-reed (6f:
 * licks the reed, tests it, it squeaks, he frowns at it) · gag (= reed).
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { withPieces, type Piece } from '../../../art/human-fx';
import type { ArmPose, HumanStyle, Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { outfitStyle } from '../art';
import { commonStrips, defineSkinVariant, defineStrips, type Strips, type TypeArt } from './common.art';
import { dress, drawShapes, markArt, stamp, type Body, type Pt, type Shape, type WPose } from './kit';
import { ensureLook, registerLookDefiner, type Outfit, type Skin } from './looks';

/** Parade style: goggles on the forehead, the crimson tunic. */
export const BASSOON_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'goggles',
  gear: 'brown',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'normal',
  accessories: ['cross-belt'],
  face: ['moustache'],
};

/** The look for an outfit: the goggles stay (they are his identity), the rest swaps. */
export function bassoonStyle(outfit: Outfit): HumanStyle {
  return { ...outfitStyle(BASSOON_STYLE, outfit, { keepHat: true }), gear: 'brown' };
}

/** The aim steps of the `aim` / `fire` strips (degrees, + = down), as in BASSOON.angles. */
export const AIM_STEPS: readonly number[] = [-45, -22.5, 0, 22.5, 45];

/** Per-frame instrument state. */
interface Bsn {
  /** Tube angle (degrees, + = down); default: carried at −8°. */
  aim?: number;
  /** Hugged upright to the chest (panic). */
  hug?: boolean;
  /** No launcher (it is on the ground, the hands are busy). */
  none?: boolean;
  /** Muzzle flash (1 = big, 2 = small). */
  flash?: number;
  /** A rocket in the near hand (reload). */
  rocket?: boolean;
  /** The reed at his mouth (gag). */
  reed?: boolean;
  /** A squeak mark over the reed. */
  squeak?: boolean;
}

const DEG = Math.PI / 180;
const WOOD = PAL.brown;
const G = PAL.gold;
/** Tube pivot in body space (on the near shoulder) and its length ahead of / behind it. */
const PIVOT: Pt = [0, -8];
const FRONT = 15;
const BACK = 10;
/** Shoulder in body space (arm targets are relative to it). */
const SHOULDER: Pt = [-1, -7];
const CARRY = -8;

function along(a: number, k: number, n = 0): Pt {
  const c = Math.cos(a * DEG);
  const s = Math.sin(a * DEG);
  return [PIVOT[0] + c * k - s * n, PIVOT[1] + s * k + c * n];
}

/** Arm target (relative to the shoulder) for a grip `k` px along the tube, `n` px below it. */
function grip(a: number, k: number, n: number, hand: ArmPose['hand'] = 'grip'): ArmPose {
  const p = along(a, k, n);
  return { to: [Math.round(p[0] - SHOULDER[0]), Math.round(p[1] - SHOULDER[1])], hand };
}

/** Both hands on the tube at angle `a`. */
function holdAt(a: number): Pose {
  return { armN: grip(a, 6, 2), armF: grip(a, -3, 2) };
}

/** The launcher on the shoulder at angle `a` (body space). */
function launcher(a: number): { back: Shape[]; front: Shape[]; muzzle: Pt } {
  const tail = along(a, -BACK);
  const nose = along(a, FRONT);
  const ring = along(a, FRONT - 2);
  const band = along(a, 3);
  const back: Shape[] = [
    // The curly brass crook: from the back of the tube up into a loop behind the head.
    { kind: 'tube', pts: [along(a, -BACK + 3, -2), along(a, -BACK + 1, -5), along(a, -BACK + 3, -8), along(a, -BACK + 6, -7), along(a, -BACK + 5, -5)], w: 1, ramp: G, color: G[2] },
  ];
  const front: Shape[] = [
    { kind: 'tube', pts: [tail, nose], w: 3, ramp: WOOD },
    // Grain line along the wood.
    { kind: 'tube', pts: [along(a, -BACK + 2, -1), along(a, FRONT - 4, -1)], w: 1, ramp: WOOD, color: WOOD[3], detail: true },
    { kind: 'tube', pts: [band, band], w: 4, ramp: PAL.red, color: PAL.red[2], detail: true },
    { kind: 'tube', pts: [ring, nose], w: 5, ramp: G },
    { kind: 'dots', pts: [along(a, FRONT, 0), along(a, FRONT, 1)], ramp: G, color: PAL.ink[1], detail: true },
    // The brass end cap at the back.
    { kind: 'tube', pts: [tail, along(a, -BACK + 1)], w: 4, ramp: G, color: G[1], detail: true },
  ];
  return { back, front, muzzle: along(a, FRONT + 1) };
}

/** Hugged to the chest, standing upright (panic). */
function hugged(): { back: Shape[]; front: Shape[] } {
  const bot: Pt = [4, 4];
  const top: Pt = [5, -22];
  return {
    back: [{ kind: 'tube', pts: [[5, -21], [3, -24], [5, -26], [7, -24]], w: 1, ramp: G, color: G[2] }],
    front: [
      { kind: 'tube', pts: [bot, top], w: 4, ramp: WOOD },
      { kind: 'tube', pts: [[4, 0], [4, 1]], w: 4, ramp: G, color: G[2], detail: true },
      { kind: 'tube', pts: [[5, -12], [5, -12]], w: 4, ramp: PAL.red, color: PAL.red[2], detail: true },
    ],
  };
}

const FRAME_BODY: Body = { hip: [0, 0], angle: 0 };

/** Crimson padded ear-muffs at the head (frame space: they stay round in every pose). */
function muffs(head: Pt): Piece | null {
  const p = drawShapes(
    [
      { kind: 'disc', pts: [[head[0] - 3, head[1] + 1]], w: 1, ramp: PAL.red, shade: { base: 2 } },
      { kind: 'dots', pts: [[head[0] - 4, head[1]]], ramp: PAL.red, color: PAL.red[3], detail: true },
    ],
    FRAME_BODY,
  );
  return p;
}

/** Dress a rig frame: ear-muffs, the launcher, flash, rocket, reed. */
function bsnDress(f: Frame, b: Body, p: WPose<unknown>): Frame {
  const s = (p.inst ?? {}) as Bsn;
  let out = f;
  if (s.hug) {
    const h = hugged();
    out = dress(out, b, { back: h.back, front: h.front });
  } else if (!s.none) {
    const l = launcher(s.aim ?? CARRY);
    out = dress(out, b, { back: l.back, front: l.front, pts: { muzzle: l.muzzle } });
  }
  const head = out.pts?.head;
  if (head && p.hat !== false) {
    const m = muffs(head);
    if (m) out = withPieces(out, [m]);
  }
  const mz = out.pts?.muzzle;
  if (s.flash && mz) out = stamp(out, flashArt(s.flash), Math.round(mz[0]) - 1, Math.round(mz[1]) - (s.flash === 1 ? 4 : 3));
  const hand = out.pts?.hand;
  if (s.rocket && hand) out = stamp(out, rocketArt(), hand[0] - 5, hand[1] - 4);
  if (s.reed && head) out = stamp(out, reedArt(), head[0] + 3, head[1] + 1);
  if (s.squeak && head) out = stamp(out, markArt('!'), head[0] + 6, head[1] - 12);
  return out;
}

/** Muzzle flash (gold / white burst), size 1 = big. */
function flashArt(size: number): PixelBuffer {
  const big = size === 1;
  const b = new PixelBuffer(big ? 9 : 7, big ? 9 : 7);
  const c = big ? 4 : 3;
  b.circle(c, c, big ? 3 : 2, PAL.gold[3]);
  b.circle(c, c, 1, PAL.snow[3]);
  b.set(c + (big ? 4 : 3), c, PAL.gold[3]);
  b.set(c, 0, PAL.orange[2]);
  b.set(c, b.h - 1, PAL.orange[2]);
  return b.outline(INK);
}

/** A spare rocket in the hand (reload). */
function rocketArt(): PixelBuffer {
  const b = new PixelBuffer(11, 6);
  b.rect(1, 2, 6, 2, WOOD[2]);
  b.hline(1, 6, 2, WOOD[3]);
  b.rect(7, 2, 2, 2, G[2]);
  b.set(9, 2, G[3]);
  b.set(1, 1, PAL.red[2]);
  b.set(1, 4, PAL.red[1]);
  return b.outline(INK);
}

/** The reed: a tiny sand-coloured blade. */
function reedArt(): PixelBuffer {
  const b = new PixelBuffer(6, 4);
  b.hline(1, 4, 1, PAL.sand[3]);
  b.hline(1, 3, 2, PAL.sand[2]);
  return b.outline(INK);
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

const HOLD: Pose = holdAt(CARRY);
const FAR: Pose = { armF: HOLD.armF };
const HUG: Pose = { armN: { to: [6, 2], hand: 'open' }, armF: { to: [5, 4], hand: 'open' }, inst: { hug: true } } as WPose<Bsn>;

export const BASSOON_ART: TypeArt = { dress: bsnDress, hold: HOLD, hug: HUG, farHold: FAR, walkTicks: 6 };

/** One knee on the ground, the other foot planted (the aim and reload pose). */
const KNEEL: Pose = { legN: { hip: 84, knee: 86 }, legF: { hip: -2, knee: 104 }, legScale: 0.8 };
const STAND: Pose = { ...P.STAND, ...HOLD };

function aimPose(a: number, extra: WPose<Bsn> = {}): WPose<Bsn> {
  return { ...KNEEL, ...holdAt(a), head: { tilt: Math.round(a * 0.4) }, expr: 'normal', ...extra, inst: { aim: a, ...extra.inst } };
}

function bassoonStrips(): Strips {
  const aims = AIM_STEPS.map((a) => aimPose(a));
  const fires = AIM_STEPS.map((a) => aimPose(a, { lean: -4, expr: 'shout', inst: { aim: a, flash: 1 } }));
  const reload: WPose<Bsn>[] = [
    aimPose(0, { armN: grip(0, -6, 3, 'grip'), inst: { aim: 0, rocket: true } }),
    aimPose(0, { armN: grip(0, -10, 2, 'grip'), inst: { aim: 0, rocket: true }, expr: 'blink' }),
    aimPose(0, { armN: grip(0, -9, 1, 'open'), inst: { aim: 0 } }),
    aimPose(0, { armN: grip(0, 4, 2), inst: { aim: 0 }, expr: 'happy' }),
  ];
  const lick: Pose = { ...P.STAND, ...FAR, armN: { to: [7, -7], hand: 'grip' } };
  return {
    aim: { poses: aims, opts: { ticksPerFrame: 60 } },
    fire: { poses: fires, opts: { ticksPerFrame: 60 } },
    reload: { poses: reload, opts: { ticksPerFrame: 10 } },
    shoot: { poses: [aimPose(0, { ...P.STAND, ...holdAt(0), inst: { aim: 0, flash: 1 }, expr: 'shout' }), aimPose(0, { ...P.STAND, ...holdAt(0), lean: -3, inst: { aim: 0, flash: 2 } })], opts: { durations: [4, 8], loop: false } },
    'crouch-shoot': { poses: [aimPose(0, { inst: { aim: 0, flash: 1 }, expr: 'shout' }), aimPose(0, { lean: -3, inst: { aim: 0, flash: 2 } })], opts: { durations: [4, 8], loop: false } },
    throw: {
      poses: P.seq({ ...P.STAND, ...FAR }, P.THROW.map((p) => ({ ...p, held: 'none' as const }))),
      opts: { durations: [8, 6, 4, 6, 8], loop: false },
    },
    'gag-reed': {
      poses: [
        { ...lick, inst: { reed: true }, expr: 'normal' } as WPose<Bsn>,
        { ...lick, inst: { reed: true }, expr: 'chew', head: { tilt: 6 } } as WPose<Bsn>,
        { ...lick, inst: { reed: true }, expr: 'blink', head: { tilt: 6 } } as WPose<Bsn>,
        { ...lick, inst: { reed: true, squeak: true }, expr: 'shout', head: { tilt: -6 }, dy: -1, grounded: false } as WPose<Bsn>,
        { ...P.STAND, ...FAR, armN: { to: [9, -9], hand: 'grip' }, inst: { reed: false }, expr: 'dazed', head: { tilt: 10 } } as WPose<Bsn>,
        { ...STAND, expr: 'blink' } as WPose<Bsn>,
      ],
      // Reed-in-hand frames: the reed sits at his near hand, held up to the mouth.
      post: (fs) => fs.map((f, i) => (i === 4 && f.pts?.hand ? stamp(f, reedArt(), f.pts.hand[0] - 1, f.pts.hand[1] - 4) : f)),
      opts: { durations: [20, 12, 12, 14, 30, 24] },
    },
  };
}

/** From frame `from` on, the strip's poses carry no launcher. */
function dropFrom(t: Strips, name: string, from: number): void {
  const s = t[name];
  if (!s?.poses) return;
  t[name] = { ...s, poses: s.poses.map((p, i) => (i >= from ? { ...p, inst: { none: true } } : p)) };
}

let table: Strips | null = null;

/** Every bassoonist strip (common set + his own); built once, rendered per look. */
export function bassoonTable(): Strips {
  if (!table) {
    table = { ...commonStrips(BASSOON_ART), ...bassoonStrips() };
    table.gag = table['gag-reed'];
    // Lying on the ground he has let go of the launcher (it would stick up out of the corpse).
    dropFrom(table, 'die', 3);
    dropFrom(table, 'die-knife', 3);
    dropFrom(table, 'die-blast', 3);
  }
  return table;
}

/** Register one look (`enemy/bassoonist…`). */
export function defineBassoonLook(prefix: string, outfit: Outfit, skin: Skin): void {
  if (skin !== 'a') {
    const base = ensureLook('bassoonist', outfit, 'a');
    if (base) return defineSkinVariant(prefix, base, bassoonTable(), skin);
  }
  defineStrips(prefix, bassoonStyle(outfit), BASSOON_ART, bassoonTable());
}

registerLookDefiner('bassoonist', defineBassoonLook);
