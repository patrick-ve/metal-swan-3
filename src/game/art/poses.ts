/**
 * Keyframed pose tables for the humanoid rig (docs/ART_GUIDE.md §4). Each table is a list of
 * partial Poses; `seq(base, frames)` merges every frame over a shared base. Characters reuse
 * these tables with their own style, and may override single fields.
 *
 * Angles (see humanoid.ts): legs `hip` + forward / `knee` + bend / `foot` + toe up; arms `sh`
 * from straight down (+ forward) / `el` + forearm turns up; `lean` + forward; `rot` clockwise.
 */
import type { ArmPose, LegPose, Pose } from './humanoid';

/** Merge frames over a base pose (shallow, per field). */
export function seq(base: Pose, frames: readonly Pose[]): Pose[] {
  return frames.map((f) => ({ ...base, ...f }));
}

/** Swap near and far legs (second half of a symmetric cycle). */
export function swapLegs(p: Pose): Pose {
  return { ...p, legN: p.legF, legF: p.legN };
}

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand?: ArmPose['hand']): ArmPose => (hand ? { sh, el, hand } : { sh, el });

// ------------------------------------------------------------------------------------ legs

/** Standing stance (near leg forward, far leg back, soft knees). */
export const STAND: Pose = { legN: L(20, 14), legF: L(-16, 10) };

/** 8-frame sprint: contact, down, passing, push-off — then the same with the legs swapped. */
const RUN_HALF: readonly Pose[] = [
  { legN: L(48, 16, 16), legF: L(-42, 72, -30) },
  { legN: L(28, 42, 0), legF: L(-26, 104, -40), bob: 1 },
  { legN: L(4, 30, -4), legF: L(34, 122, -12) },
  { legN: L(-30, 20, -30), legF: L(60, 74, 6), bob: -1 },
];
export const RUN: readonly Pose[] = [...RUN_HALF, ...RUN_HALF.map(swapLegs)];

/** 8-frame walk (enemies, hostages). */
const WALK_HALF: readonly Pose[] = [
  { legN: L(28, 8, 8), legF: L(-22, 20, -10) },
  { legN: L(18, 20, 0), legF: L(-10, 46, -16), bob: 1 },
  { legN: L(2, 12, 0), legF: L(12, 50, -6) },
  { legN: L(-14, 8, -6), legF: L(26, 26, 2) },
];
export const WALK: readonly Pose[] = [...WALK_HALF, ...WALK_HALF.map(swapLegs)];

/**
 * Deep crouch: folded, foreshortened legs (legScale) so the hip sits about 6 px above the
 * ground and the whole figure is ~27 px tall with any torso.
 */
export const CROUCH: Pose = { legN: L(104, 118), legF: L(44, 160), legScale: 0.55 };

/**
 * 6-frame crouch-walk: shuffling steps at crouch height. The boots swap places by a few px each
 * frame (so the crouched player never glides) and the body bobs 1 px on the passing frames.
 */
export const CROUCH_WALK: readonly Pose[] = [
  { legN: L(124, 130), legF: L(22, 148), legScale: 0.55 },
  { legN: L(110, 122), legF: L(36, 158), legScale: 0.55 },
  { legN: L(92, 110), legF: L(56, 166), legScale: 0.55, bob: 1 },
  { legN: L(84, 106), legF: L(70, 164), legScale: 0.55 },
  { legN: L(90, 112), legF: L(58, 150), legScale: 0.55 },
  { legN: L(108, 124), legF: L(38, 144), legScale: 0.55, bob: 1 },
];

/** Jump: take-off tuck, full tuck (airborne). */
export const JUMP: readonly Pose[] = [
  { legN: L(62, 92, 10), legF: L(8, 96, -20), grounded: false },
  { legN: L(84, 124, 10), legF: L(40, 128, -10), grounded: false },
];
export const FALL: Pose = { legN: L(24, 34, 0), legF: L(-14, 58, -26), grounded: false };
export const LAND: Pose = { legN: L(56, 80), legF: L(4, 76) };

// ------------------------------------------------------------------------------------ upper body

/** Breathing for idle loops: the shoulders drop by one pixel on the second frame. */
export const BREATH: readonly Pose[] = [{}, { hunch: 1 }];

/** Throw (grenade): wind-up, cock overhead, release, follow-through, recover. */
export const THROW: readonly Pose[] = [
  { armN: A(-110, 80, 'fist'), held: 'grenade', lean: -6, expr: 'shout' },
  { armN: A(-160, 50, 'fist'), held: 'grenade', lean: -10, expr: 'shout' },
  { armN: { to: [10, -8], hand: 'open' }, lean: 8, expr: 'shout' },
  { armN: A(80, 10, 'open'), lean: 10 },
  { armN: A(30, 40, 'fist'), lean: 4 },
];

/** Knife slash arc: raise high, slash across, follow-through, recover. */
export const KNIFE: readonly Pose[] = [
  { armN: A(-150, 60, 'fist'), held: 'knife', heldAngle: -110, lean: -4, expr: 'shout' },
  { armN: { to: [9, -9], hand: 'fist' }, held: 'knife', heldAngle: -30, lean: 4, expr: 'shout' },
  { armN: A(90, 0, 'fist'), held: 'knife', heldAngle: 15, lean: 12, expr: 'shout' },
  { armN: A(45, 20, 'fist'), held: 'knife', heldAngle: 70, lean: 8 },
  { armN: A(20, 70, 'fist'), held: 'knife', heldAngle: -60, lean: 2 },
];

// ------------------------------------------------------------------------------------ full body

/** Hit by a bullet: stagger back, fall on the back, bounce, lie still. */
export const DIE: readonly Pose[] = [
  { ...STAND, armN: A(60, 60, 'open'), armF: A(80, 40, 'open'), lean: -14, expr: 'hurt' },
  { legN: L(40, 30), legF: L(-6, 20), armN: A(120, 40, 'open'), armF: A(140, 30, 'open'), lean: -24, rot: -20, expr: 'hurt' },
  { legN: L(60, 40), legF: L(30, 60), armN: A(150, 30, 'open'), armF: A(170, 20, 'open'), rot: -55, grounded: false, dy: -4, expr: 'hurt' },
  { legN: L(50, 20), legF: L(30, 30), armN: A(160, 20, 'open'), armF: A(180, 10, 'open'), rot: -85, expr: 'hurt' },
  { legN: L(70, 50), legF: L(40, 60), armN: A(150, 30, 'open'), armF: A(170, 30, 'open'), rot: -90, dy: -2, expr: 'dazed' },
  { legN: L(30, 20), legF: L(10, 30), armN: A(170, 10, 'open'), armF: A(190, 10, 'open'), rot: -90, expr: 'dazed' },
];

/** Thrown by an explosion: launched, tumbling (two turns), slam down, lie flat. */
export const DIE_BLAST: readonly Pose[] = [
  { legN: L(30, 60), legF: L(-30, 70), armN: A(150, 20, 'open'), armF: A(170, 20, 'open'), rot: -30, grounded: false, expr: 'panic' },
  { legN: L(70, 90), legF: L(10, 100), armN: A(140, 40, 'open'), armF: A(200, 30, 'open'), rot: -120, grounded: false, expr: 'panic' },
  { legN: L(40, 60), legF: L(-20, 60), armN: A(170, 10, 'open'), armF: A(150, 40, 'open'), rot: -210, grounded: false, expr: 'panic' },
  { legN: L(60, 80), legF: L(0, 90), armN: A(120, 30, 'open'), armF: A(180, 20, 'open'), rot: -300, grounded: false, expr: 'dazed' },
  { legN: L(20, 10), legF: L(10, 20), armN: A(170, 10, 'open'), armF: A(190, 10, 'open'), rot: -90, expr: 'dazed' },
];

/** Knifed: dazed stagger, knees buckle, topple forward, lie face down. */
export const DIE_KNIFE: readonly Pose[] = [
  { ...STAND, armN: A(10, 20, 'open'), armF: A(-10, 20, 'open'), lean: -6, head: { dy: 1 }, expr: 'dazed' },
  { legN: L(40, 60), legF: L(-10, 50), armN: A(20, 10, 'open'), armF: A(0, 20, 'open'), lean: 4, expr: 'dazed' },
  { ...CROUCH, armN: A(30, 10, 'open'), armF: A(20, 10, 'open'), lean: 20, expr: 'dazed' },
  { legN: L(20, 40), legF: L(0, 60), armN: A(120, 10, 'open'), armF: A(100, 10, 'open'), rot: 50, expr: 'hurt' },
  { legN: L(0, 10), legF: L(-10, 20), armN: A(170, 0, 'open'), armF: A(160, 0, 'open'), rot: 88, expr: 'blink' },
];

/** On fire: hopping with the arms up (used before the soot / crumble frames). */
export const BURN: readonly Pose[] = [
  { legN: L(40, 70), legF: L(-10, 40), armN: A(160, 30, 'open'), armF: A(190, 20, 'open'), grounded: false, dy: -3, expr: 'panic' },
  { legN: L(10, 40), legF: L(30, 80), armN: A(190, 20, 'open'), armF: A(150, 40, 'open'), expr: 'panic' },
];

/** Panic: hands thrown up beside the head, knees knocking, shaking (enemy soldiers). */
export const PANIC_COWER: readonly Pose[] = [
  { legN: L(14, 34), legF: L(-4, 30), armN: { to: [-3, -11], hand: 'open' }, armF: { to: [7, -9], hand: 'open' }, lean: -4, expr: 'panic' },
  { legN: L(2, 44), legF: L(6, 40), armN: { to: [-2, -12], hand: 'open' }, armF: { to: [8, -10], hand: 'open' }, lean: -2, bob: 1, expr: 'panic' },
  { legN: L(14, 34), legF: L(-4, 30), armN: { to: [-4, -11], hand: 'open' }, armF: { to: [7, -10], hand: 'open' }, lean: -5, dy: -1, expr: 'shout' },
  { legN: L(2, 44), legF: L(6, 40), armN: { to: [-3, -12], hand: 'open' }, armF: { to: [8, -9], hand: 'open' }, lean: -3, bob: 1, expr: 'panic' },
];

/** Panic arm-flail: arms windmill overhead while the legs run in place (civilians). */
export const PANIC_FLAIL: readonly Pose[] = [
  { ...RUN[0], armN: A(170, 30, 'open'), armF: A(120, 60, 'open'), expr: 'panic' },
  { ...RUN[2], armN: A(130, 50, 'open'), armF: A(180, 20, 'open'), expr: 'panic' },
  { ...RUN[4], armN: A(180, 20, 'open'), armF: A(130, 50, 'open'), expr: 'panic' },
  { ...RUN[6], armN: A(120, 60, 'open'), armF: A(170, 30, 'open'), expr: 'panic' },
];

/** Victory: fist pump with a little hop. */
export const VICTORY: readonly Pose[] = [
  { ...STAND, armN: A(170, 30, 'fist'), armF: A(20, 70, 'fist'), expr: 'happy' },
  { legN: L(30, 40), legF: L(-6, 40), armN: A(150, 70, 'fist'), armF: A(20, 70, 'fist'), expr: 'shout', bob: 1 },
  { ...STAND, armN: A(175, 10, 'thumb'), armF: A(20, 70, 'fist'), expr: 'happy', grounded: false, dy: -2 },
  { ...STAND, armN: A(170, 30, 'fist'), armF: A(20, 70, 'fist'), expr: 'happy' },
];

/** Drop-in spawn: falling with a gun up, landing crouch, standing up. */
export const SPAWN: readonly Pose[] = [
  { ...FALL, armN: A(150, 20, 'fist'), armF: A(120, 30, 'fist'), dy: -10, expr: 'shout' },
  { ...FALL, armN: A(140, 30, 'fist'), armF: A(110, 40, 'fist'), dy: -4, expr: 'shout' },
  { ...LAND, armN: A(60, 40, 'fist'), armF: A(40, 60, 'fist'), lean: 10 },
  { ...STAND, armN: A(20, 50, 'fist'), armF: A(-6, 30, 'fist'), lean: 2, expr: 'happy' },
];

/** Salute (the continue gag, GDD §13.9): the near hand snaps to the brow, against his will. */
export const SALUTE: readonly Pose[] = [
  { ...STAND, legN: L(8, 6), legF: L(-6, 4), armN: { to: [4, -10], hand: 'open', bend: 'up' }, armF: A(-2, 8, 'fist'), lean: -2, expr: 'panic' },
  { ...STAND, legN: L(6, 2), legF: L(-4, 2), armN: { to: [5, -11], hand: 'open', bend: 'up' }, armF: A(0, 4, 'fist'), lean: -3, expr: 'hurt' },
];

/** Hop into a vehicle hatch: tucked hop, then seated (legs forward). */
export const MOUNT: readonly Pose[] = [
  { ...JUMP[1], armN: A(160, 20, 'fist'), armF: A(140, 30, 'fist'), dy: -6 },
  { legN: L(90, 90), legF: L(80, 100), armN: A(50, 60, 'grip'), armF: A(60, 50, 'grip'), grounded: false, dy: -2 },
];

// ------------------------------------------------------------------------------------ rider (Swan)

/**
 * Rider strips for an open-seat mount (docs/design/swan-mount/look.md §6.4): rendered as part
 * 'upper' (hip anchor) with `weapon: 'none'`. Arm `to` targets are relative to each shoulder and
 * put the hands on the Swan's handle grips, which sit at hip + (9, −5) near and (10, −5) far
 * (ride-duck: folded handles at (12, −3) / (13, −3)). The rig body sizes share the torso (9 px)
 * and shoulder offsets for every build, so the same targets fit slim, normal and heavy riders.
 */
const grip = (x: number, y: number): ArmPose => ({ to: [x, y], hand: 'grip' });

/** Calm seat (idle, swim, fall): upright, breathing 1 px. */
export const RIDE_SIT: readonly Pose[] = [
  { lean: 4, hunch: 0, armN: grip(9.5, 2.1), armF: grip(8.5, 1.9), expr: 'normal' },
  { lean: 4, hunch: 1, armN: grip(9.6, 1.1), armF: grip(8.6, 0.9), expr: 'normal' },
];
/** Leaning into the run (frame 1 on the Swan's run f1 and f5). */
export const RIDE_LEAN: readonly Pose[] = [
  { lean: 16, hunch: 0, armN: grip(8.0, 2.0), armF: grip(7.1, 1.5), head: { dx: 1 }, flutter: 1 },
  { lean: 18, hunch: 1, armN: grip(8.1, 1.0), armF: grip(7.2, 0.4), head: { dx: 1 }, flutter: 3 },
];
/** Looking up along a raised neck (aims −67.5° / −90°), thrown back in a skid. */
export const RIDE_UP: readonly Pose[] = [{ lean: -10, armN: grip(11.2, 1.7), armF: grip(10.2, 2.1), head: { tilt: -12 } }];
/** Ducking under the neck arched over him (aims −112.5° / −135°, water duck). */
export const RIDE_HUNCH: readonly Pose[] = [
  { lean: 40, hunch: 3, armN: grip(7.2, -1.3), armF: grip(6.7, -2.6), head: { dy: 4, tilt: -20 }, expr: 'panic' },
];
/** Holding on tight (squat, take-off, flap, tired glide, paddle-up). */
export const RIDE_HOLD: readonly Pose[] = [
  { lean: 10, hunch: 2, armN: grip(9.1, 0.1), armF: grip(8.1, -0.2), expr: 'shout' },
  { lean: 12, hunch: 2, armN: grip(8.9, 0.1), armF: grip(8.0, -0.3), head: { dy: 1 }, expr: 'panic' },
];
/** Bracing for an impact (landing, stomp, hit). */
export const RIDE_BRACE: readonly Pose[] = [{ lean: 8, hunch: 2, armN: grip(9.3, 0.1), armF: grip(8.3, -0.2), expr: 'hurt' }];
/** Lying flat on her back (crouch, waddle, belly slide), head forward over her shoulder. */
export const RIDE_DUCK: readonly Pose[] = [
  { lean: 80, hunch: 3, armN: grip(8.2, -1.3), armF: grip(8.9, -3.3), head: { dy: 6, tilt: 30 }, expr: 'shout' },
];
/** Covering both ears during her HONK. */
export const RIDE_EARS: readonly Pose[] = [
  { lean: 2, hunch: 1, armN: { to: [-1, -8], hand: 'open' }, armF: { to: [-1, -9], hand: 'open' }, expr: 'blink' },
  { lean: 2, hunch: 1, armN: { to: [-1, -8], hand: 'open' }, armF: { to: [-1, -9], hand: 'open' }, expr: 'panic' },
];
/** Mission complete / boss down while riding: the near fist pumps, the far hand keeps its grip. */
export const RIDE_CHEER: readonly Pose[] = [
  { lean: 0, hunch: 0, armN: A(170, 20, 'fist'), armF: grip(9, 2), expr: 'happy' },
  { lean: 0, hunch: 0, armN: A(155, 50, 'fist'), armF: grip(9, 2), expr: 'shout' },
];

/** The nine rider poses (`char/<id>/ride-<pose>`), in look.md §6.4 order. */
export const RIDE_POSES = ['sit', 'lean', 'up', 'hunch', 'hold', 'brace', 'duck', 'ears', 'cheer'] as const;
export type RidePoseName = (typeof RIDE_POSES)[number];

/** Frames and timing (ticks per frame, all loop) of every rider strip. */
export const RIDE: Readonly<Record<RidePoseName, { readonly frames: readonly Pose[]; readonly ticks: number }>> = {
  sit: { frames: RIDE_SIT, ticks: 20 },
  lean: { frames: RIDE_LEAN, ticks: 6 },
  up: { frames: RIDE_UP, ticks: 30 },
  hunch: { frames: RIDE_HUNCH, ticks: 30 },
  hold: { frames: RIDE_HOLD, ticks: 4 },
  brace: { frames: RIDE_BRACE, ticks: 30 },
  duck: { frames: RIDE_DUCK, ticks: 30 },
  ears: { frames: RIDE_EARS, ticks: 6 },
  cheer: { frames: RIDE_CHEER, ticks: 8 },
};

/** Handle grips relative to the rider's hip (look.md §6.1): standing handles and folded (duck). */
export const RIDE_GRIPS = {
  near: [9, -5] as const,
  far: [10, -5] as const,
  nearFolded: [12, -3] as const,
  farFolded: [13, -3] as const,
};

// ------------------------------------------------------------------------------------ moves (anim wave p1)

/**
 * Somersault keys (`char/<id>/flip`, 14 frames × 2 ticks; human-sprites `flipPoses` tweens
 * them): open take-off, tuck, one full turn about the pelvis (rot 0 → 360), open for the fall.
 */
export const FLIP_KEYS: readonly Pose[] = [
  { legN: L(84, 118, 10), legF: L(48, 124, -10), armN: A(64, 96, 'fist'), armF: A(56, 102, 'fist'), lean: 8, grounded: false, rot: 0 },
  { legN: L(118, 146, 10), legF: L(104, 150, 0), armN: A(50, 110, 'fist'), armF: A(44, 114, 'fist'), lean: 16, hunch: 1, grounded: false, rot: 72 },
  { legN: L(124, 152, 10), legF: L(110, 154, 0), armN: A(46, 114, 'fist'), armF: A(40, 118, 'fist'), lean: 18, hunch: 1, grounded: false, rot: 190 },
  { legN: L(118, 146, 10), legF: L(104, 150, 0), armN: A(50, 110, 'fist'), armF: A(44, 114, 'fist'), lean: 16, hunch: 1, grounded: false, rot: 310 },
  { legN: L(84, 110, 4), legF: L(46, 118, -12), armN: A(70, 80, 'open'), armF: A(58, 88, 'open'), lean: 8, grounded: false, rot: 360 },
];

/**
 * Hop onto the Swan's seat (`char/<id>/mount-hop`, 5 frames [3, 3, 3, 3, 4]): crouch, spring,
 * tuck rise, swing a leg over the seat, settle seated (the logic carries the figure toward the
 * seat point; the frames only add the small local arc).
 */
export const MOUNT_HOP: readonly Pose[] = [
  { legN: L(70, 100), legF: L(30, 104), armN: A(-10, 40, 'fist'), armF: A(-20, 34, 'fist'), lean: 14, hunch: 1 },
  { legN: L(14, 14, -10), legF: L(-18, 24, -20), armN: A(70, 40, 'fist'), armF: A(60, 44, 'fist'), lean: 4, grounded: false, dy: -3 },
  { legN: L(70, 104, 10), legF: L(30, 112, -10), armN: A(80, 50, 'fist'), armF: A(72, 54, 'fist'), lean: 8, grounded: false, dy: -6 },
  { legN: L(100, 70), legF: L(20, 100), armN: A(60, 60, 'grip'), armF: A(64, 54, 'grip'), lean: 6, grounded: false, dy: -4 },
  { legN: L(90, 90), legF: L(80, 100), armN: A(50, 60, 'grip'), armF: A(60, 50, 'grip'), grounded: false, dy: -2 },
];

/** Legs hanging under the canopy (`legs-dangle`, loop): three keys, toes down, a slow sway. */
export const DANGLE_KEYS: readonly Pose[] = [
  { legN: L(22, 32, -24), legF: L(-10, 38, -30), grounded: false },
  { legN: L(4, 16, -30), legF: L(10, 46, -22), grounded: false },
  { legN: L(-14, 26, -26), legF: L(24, 34, -20), grounded: false },
];

/**
 * Drowning (`die-drown`, 12 frames): `dy` is the depth of the feet below the water surface (the
 * strip's anchor line; human-sprites crops every frame there). Splash drop, bob up with the
 * arms high, wave twice, sink, the last hand,
 * (the near arm swings up and BACK in the raised frames so it never covers the face at 2×), then only bubbles (frames 10–11 draw no figure).
 */
export const DROWN: readonly Pose[] = [
  { legN: L(30, 40, -10), legF: L(-10, 50, -20), armN: A(150, 30, 'open'), armF: A(130, 40, 'open'), expr: 'panic', grounded: false, dy: 12 },
  { legN: L(40, 60, -10), legF: L(0, 70, -20), armN: A(165, 20, 'open'), armF: A(150, 24, 'open'), expr: 'panic', grounded: false, dy: 19 },
  { legN: L(20, 40, -20), legF: L(-6, 60, -20), armN: A(205, 24, 'open'), armF: A(160, 14, 'open'), expr: 'shout', grounded: false, dy: 14 },
  { legN: L(30, 50, -20), legF: L(-16, 50, -20), armN: A(160, 40, 'open'), armF: A(124, 40, 'open'), expr: 'panic', grounded: false, dy: 14 },
  { legN: L(10, 40, -20), legF: L(4, 60, -20), armN: A(126, 44, 'open'), armF: A(168, 30, 'open'), expr: 'shout', grounded: false, dy: 15 },
  { legN: L(30, 50, -20), legF: L(-16, 50, -20), armN: A(204, 30, 'open'), armF: A(126, 38, 'open'), expr: 'panic', grounded: false, dy: 16 },
  { legN: L(10, 40, -20), legF: L(4, 60, -20), armN: A(128, 40, 'open'), armF: A(166, 30, 'open'), expr: 'shout', grounded: false, dy: 17 },
  { legN: L(20, 30, -20), legF: L(0, 40, -20), armN: A(200, 16, 'open'), armF: A(164, 16, 'open'), expr: 'hurt', grounded: false, dy: 21 },
  { legN: L(20, 30, -20), legF: L(0, 40, -20), armN: A(196, 10, 'open'), armF: A(170, 10, 'open'), expr: 'hurt', grounded: false, dy: 25 },
  { legN: L(20, 30, -20), legF: L(0, 40, -20), armN: A(192, 6, 'open'), armF: A(162, 14, 'open'), expr: 'hurt', grounded: false, dy: 28 },
  { legN: L(20, 30, -20), legF: L(0, 40, -20), armN: A(180, 4, 'open'), armF: A(158, 16, 'open'), expr: 'hurt', grounded: false, dy: 31 },
  { legN: L(20, 30, -20), legF: L(0, 40, -20), armN: A(180, 4, 'open'), armF: A(156, 18, 'open'), expr: 'hurt', grounded: false, dy: 33 },
];

/** Ticks per `die-drown` frame (60 in all: the player's death timer). */
export const DROWN_TIMING: readonly number[] = [3, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 7];

// ------------------------------------------------------------------------------------ moves (anim wave p2)

/**
 * Legs idle weight shift (`legs-idle`, 4 frames × 16 ticks, loop): the weight rocks onto the near
 * leg (far heel lifts), back to centre, then onto the far leg. The lowest boot never leaves the
 * ground, so the hip point stays the same in every frame.
 */
export const IDLE_SHIFT: readonly Pose[] = [
  STAND,
  { legN: L(20, 14), legF: L(-10, 22, -8) },
  { legN: L(18, 12), legF: L(-14, 16, -4) },
  { legN: L(16, 8), legF: L(-20, 14) },
];

/**
 * Torso idle breathing (4 frames × 12 ticks, hand-keyed): a two-step "grey code" of the shoulder
 * drop (hunch) and a 1 px head nod, so every frame differs from its neighbours (and 3 → 0 too).
 */
export const BREATH4: readonly Pose[] = [{}, { hunch: 1 }, { hunch: 1, head: { dy: 1 } }, { head: { dy: 1 } }];

/** Jump (4 frames): push-off with the toes down, take-off, rising, full tuck. */
export const JUMP4: readonly Pose[] = [
  { legN: L(26, 30, -24), legF: L(-18, 40, -34), grounded: false },
  JUMP[0],
  { legN: L(74, 108, 10), legF: L(24, 112, -14), grounded: false },
  JUMP[1],
];
/** Fall loop (2 frames): the legs paddle a little. */
export const FALL2: readonly Pose[] = [FALL, { legN: L(30, 44, 0), legF: L(-8, 48, -22), grounded: false }];
/** Land (3 frames [2, 3, 4]): impact squash, the normal landing bend, rise toward the stance. */
export const LAND3: readonly Pose[] = [{ legN: L(70, 104), legF: L(14, 100) }, LAND, { legN: L(36, 44), legF: L(-6, 40) }];

/** Throw follow-through added AFTER the release frame (index 2 stays the release). */
export const THROW6: readonly Pose[] = [
  THROW[0],
  THROW[1],
  THROW[2],
  { armN: A(40, 30, 'open'), lean: 10, expr: 'shout' },
  THROW[3],
  THROW[4],
];
/** Ticks per throw frame: the release keeps its tick (5 + 4), the total stays 23. */
export const THROW6_TIMING: readonly number[] = [5, 4, 3, 3, 3, 5];

/** Ticks per knife frame (anticipation + the 5-frame table): 14 in all. */
export const KNIFE6_TIMING: readonly number[] = [2, 2, 2, 3, 3, 2];

/**
 * Knife variant B (6 frames, `knife-b`): a low backhand. Chamber the blade at the hip, cock it
 * back, sweep forward and up, full reach, recoil, recover. `held` comes from the hero's knife.
 */
export const KNIFE_B: readonly Pose[] = [
  { armN: A(-20, 60, 'fist'), heldAngle: 150, lean: -6, hunch: 1, expr: 'shout' },
  { armN: A(-50, 70, 'fist'), heldAngle: 170, lean: -8, hunch: 1, expr: 'shout' },
  { armN: A(40, 50, 'fist'), heldAngle: 30, lean: 6, expr: 'shout' },
  { armN: { to: [10, -2], hand: 'fist' }, heldAngle: -10, lean: 12, expr: 'shout' },
  { armN: A(70, 30, 'fist'), heldAngle: 10, lean: 8 },
  { armN: A(20, 60, 'fist'), heldAngle: -40, lean: 2 },
];

/** Crouched torso (4 frames × 12 ticks): a forward lean with the idle breathing. */
export const CROUCH_TORSO: readonly Pose[] = BREATH4.map((p) => ({ ...p, lean: 4 }));

/**
 * Death by a hit (player default, 12 frames): DIE's six keys with eased in-betweens (the bounce
 * stays: impact, up, down) and a last, hand-keyed settle (the arm flops, the eyes close).
 */
/** The player death's bounce key (replaces DIE[4] in `diePoses`): a real rebound, knees and arms up. */
export const DIE12_BOUNCE: Pose = { legN: L(85, 75), legF: L(55, 85), armN: A(130, 50, 'open'), armF: A(150, 45, 'open'), rot: -84, grounded: false, dy: -5, expr: 'dazed' };
export const DIE12_SETTLE: Pose = { ...DIE[5], armN: A(176, 24, 'open'), expr: 'blink' };
export const DIE12_TIMING: readonly number[] = [3, 3, 3, 3, 3, 3, 3, 3, 4, 5, 6, 35];

/**
 * Thrown by a blast (player default, 10 frames): DIE_BLAST's limbs on a three-quarter backward
 * tumble (−20 → −270, the figure ends face down), so each displayed tick turns a few px.
 */
export const DIE_BLAST_KEYS: readonly Pose[] = [
  { ...DIE_BLAST[0], rot: -20 },
  { ...DIE_BLAST[1], armF: A(180, 30, 'open'), rot: -80 },
  { ...DIE_BLAST[2], armF: A(165, 35, 'open'), rot: -145 },
  { ...DIE_BLAST[3], armF: A(175, 25, 'open'), rot: -210 },
  { ...DIE_BLAST[4], rot: -270 },
];
export const DIE_BLAST10_TIMING: readonly number[] = [3, 4, 4, 4, 4, 4, 4, 4, 5, 14];

/** Victory (player default, 8 frames loop): three keys of the fist pump and hop, eased. */
export const VICTORY_KEYS: readonly Pose[] = [VICTORY[0], VICTORY[1], VICTORY[2]];
export const SPAWN6_TIMING: readonly number[] = [4, 4, 4, 3, 3, 6];

/**
 * Time-out (`timeout-yawn` 8 once, `timeout-sleep` 4 loop): a huge yawn and stretch, the arms
 * drop, the knees give, he sits down on the floor, the head nods; then he sleeps sitting, the
 * shoulders rising and falling.
 */
export const TIMEOUT_YAWN: readonly Pose[] = [
  { ...STAND, armN: A(10, 30), armF: A(-6, 26), expr: 'blink' },
  { ...STAND, armN: { to: [-2, -11], hand: 'fist' }, armF: { to: [4, -12], hand: 'fist' }, lean: -6, expr: 'yawn' },
  { ...STAND, armN: { to: [-3, -12], hand: 'fist' }, armF: { to: [3, -13], hand: 'fist' }, lean: -9, expr: 'yawn', bob: -1 },
  { ...STAND, armN: A(36, 34, 'open'), armF: A(24, 34, 'open'), lean: -2, expr: 'blink' },
  { legN: L(40, 50), legF: L(4, 44), armN: A(20, 20, 'open'), armF: A(10, 20, 'open'), lean: 8, expr: 'blink' },
  { legN: L(70, 80), legF: L(40, 90), armN: A(30, 20, 'open'), armF: A(20, 20, 'open'), lean: 12, expr: 'blink' },
  { legN: L(86, 30), legF: L(80, 40), armN: A(20, 30, 'open'), armF: A(14, 30, 'open'), lean: 10, head: { dy: 1 }, expr: 'blink' },
  { legN: L(86, 20), legF: L(80, 30), armN: A(30, 40, 'open'), armF: A(20, 40, 'open'), lean: 16, head: { dy: 2, tilt: 8 }, expr: 'blink' },
];
export const TIMEOUT_YAWN_TIMING: readonly number[] = [8, 8, 16, 6, 5, 5, 6, 10];
const SIT: Pose = { legN: L(86, 20), legF: L(80, 30), armN: A(30, 40, 'open'), armF: A(20, 40, 'open'), expr: 'blink' };
export const TIMEOUT_SLEEP: readonly Pose[] = [
  { ...SIT, lean: 16, head: { dy: 2, tilt: 8 } },
  { ...SIT, lean: 16, hunch: 1, head: { dy: 2, tilt: 8 } },
  { ...SIT, lean: 18, hunch: 1, head: { dy: 3, tilt: 8 } },
  { ...SIT, lean: 18, head: { dy: 3, tilt: 8 } },
];

// Default idle fidgets (anim wave p2, row 14) for heroes without their own table: keys only,
// `human-sprites.ts` tweens them with the hero's style. Both stay close to the stand.
/** Fidget A keys: a neck stretch to each side, a shoulder roll, then a pleased settle. */
export const FIDGET_A_KEYS: readonly Pose[] = [
  { ...STAND, armN: A(8, 30), armF: A(-6, 26) },
  { ...STAND, armN: A(8, 30), armF: A(-6, 26), head: { tilt: -22 }, lean: -4, expr: 'blink' },
  { ...STAND, armN: A(8, 30), armF: A(-6, 26), head: { tilt: 22 }, lean: 4, expr: 'blink' },
  { ...STAND, armN: A(16, 44), armF: A(-14, 40), hunch: 2, bob: -1 },
  { ...STAND, armN: A(8, 30), armF: A(-6, 26), expr: 'happy' },
];
/** In-betweens per key pair of fidget A (10 frames). */
export const FIDGET_A_PER: readonly number[] = [1, 2, 1, 1];
/** Ticks per fidget A frame: keys hold, in-betweens 4 ticks. */
export const FIDGET_A_TIMING: readonly number[] = [10, 4, 16, 4, 4, 14, 4, 12, 4, 18];

/** Fidget B keys: looks down, brushes dust off his chest (in and out), shakes out the arm. */
export const FIDGET_B_KEYS: readonly Pose[] = [
  { ...STAND, armN: A(8, 30), armF: A(-6, 26) },
  { ...STAND, armN: { to: [3, 5], hand: 'open' }, armF: A(-6, 26), head: { tilt: 8 } },
  { ...STAND, armN: { to: [6, 7], hand: 'open' }, armF: A(-6, 26), head: { tilt: 8 }, expr: 'blink' },
  { ...STAND, armN: { to: [3, 5], hand: 'open' }, armF: A(-6, 26), head: { tilt: 8 } },
  { ...STAND, armN: A(14, 40, 'open'), armF: A(-6, 26), expr: 'happy' },
  { ...STAND, armN: A(8, 30), armF: A(-6, 26) },
];
/** In-betweens per key pair of fidget B (10 frames). */
export const FIDGET_B_PER: readonly number[] = [1, 1, 0, 1, 1];
/** Ticks per fidget B frame. */
export const FIDGET_B_TIMING: readonly number[] = [10, 4, 8, 4, 8, 10, 4, 10, 4, 16];
