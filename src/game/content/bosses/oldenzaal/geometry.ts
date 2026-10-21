/**
 * St. Plechelmus, the statue mini-boss of mission oldenzaal (docs/design/oldenzaal.md §5, §6;
 * revision 2: R2-6, R2-8): every number of the fight and of its art in one place (pure data).
 *
 * Coordinates are logical px. The boss's anchor is its home spot ON THE FLOOR (the plinth's foot
 * centre while it sits, its feet while it walks). The art is frontal (a seated bishop looking at
 * the square), so nothing is mirrored: `facing` stays 1 and every box below is screen-oriented.
 *
 * Body frames: the seated strip is anchored at the plinth's top (where the feet rest), the
 * standing strip at the feet. The tables give each frame's points (the crozier hand, the raised
 * hand, the eyes) so the logic never needs the art (headless runs).
 */
import type { Rect } from '../../../../engine/math';

/** The plinth (the foot, three courses of blocks, the top slab) and the throne on it. */
export const PLINTH = {
  /** Height from the floor to its top (where the saint's feet rest). */
  h: 46,
  /** Width of the base slab. */
  w: 60,
  /** The sprite (plinth + throne): size and anchor (floor centre). */
  frameW: 64,
  frameH: 82,
  /** Blocks the thrown stone can leave missing (frames 0 … 3 of the plinth sprite). */
  maxMissing: 3,
} as const;

/** Seated body frames (anchor = the plinth's top centre). */
export const SIT_FRAME = { w: 80, h: 82, ox: 40, oy: 80 } as const;
/** Standing body frames (anchor = between the feet). */
export const STAND_FRAME = { w: 68, h: 100, ox: 34, oy: 98 } as const;

export type V2 = readonly [number, number];

/** A body pose of the art (and its points for the logic). */
export interface BodyPose {
  readonly name: string;
  readonly seated: boolean;
  /** The crozier hand (the saint's left = the viewer's right). */
  readonly hand: V2;
  /** The raised hand (the saint's right = the viewer's left). */
  readonly raise: V2;
  /** Shoulders' shift (lean) in x, and a dip in y (crouch). */
  readonly lean: number;
  readonly dip: number;
  /** Feet / hem (standing): the left and right foot x, and which one is lifted (px). */
  readonly feet?: readonly [number, number, number, number];
  /** What the raised hand holds. */
  readonly holds: 'relic' | 'block' | 'none';
  /** The crozier's angle index (CROZIER_ANGLES) in this pose. */
  readonly crozier: number;
}

/**
 * The crozier's angles (degrees from straight up, clockwise positive): its strip has one frame
 * per entry, anchored at the grip. The rest pose (index 2) leans 34° to the right like the
 * photo's diagonal.
 */
export const CROZIER_ANGLES: readonly number[] = [-90, -60, -34, -10, 10, 34, 60, 90, 120, 150, 180, -135];
/** Index of an angle in CROZIER_ANGLES. */
export const CZ = { left: 0, lowLeft: 1, leanLeft: 2, upLeft: 3, upRight: 4, rest: 5, back: 6, right: 7, downRight: 8, down: 9, foot: 10, sweepLow: 11 } as const;
/** The crozier: length foot → top of the curl, the grip's distance from the foot. */
export const CROZIER = { len: 78, grip: 44, curlR: 6 } as const;

/** Seated poses (strip `sit`, frame = index). */
export const SIT_POSES: readonly BodyPose[] = [
  { name: 'rest', seated: true, hand: [11, -33], raise: [-19, -47], lean: 0, dip: 0, holds: 'relic', crozier: CZ.rest },
  { name: 'sweep-back', seated: true, hand: [17, -45], raise: [-18, -38], lean: 3, dip: 0, holds: 'relic', crozier: CZ.back },
  { name: 'sweep-mid', seated: true, hand: [6, -30], raise: [-18, -38], lean: -2, dip: 1, holds: 'relic', crozier: CZ.down },
  { name: 'sweep-low', seated: true, hand: [-12, -22], raise: [-20, -36], lean: -5, dip: 2, holds: 'relic', crozier: CZ.sweepLow },
  { name: 'reach', seated: true, hand: [11, -33], raise: [-24, -16], lean: -4, dip: 3, holds: 'none', crozier: CZ.rest },
  { name: 'lift', seated: true, hand: [11, -33], raise: [-14, -66], lean: 1, dip: -1, holds: 'block', crozier: CZ.rest },
  { name: 'throw', seated: true, hand: [11, -33], raise: [-30, -46], lean: -5, dip: 1, holds: 'none', crozier: CZ.rest },
];
export const SIT = { rest: 0, sweepBack: 1, sweepMid: 2, sweepLow: 3, reach: 4, lift: 5, throw: 6 } as const;

/** Standing poses (strip `stand`, frame = index). feet: [left x, right x, left lift, right lift]. */
export const STAND_POSES: readonly BodyPose[] = [
  { name: 'stand', seated: false, hand: [13, -50], raise: [-17, -58], lean: 0, dip: 0, feet: [-6, 6, 0, 0], holds: 'relic', crozier: CZ.rest },
  { name: 'walk-1', seated: false, hand: [13, -49], raise: [-17, -57], lean: -2, dip: -1, feet: [-8, 6, 3, 0], holds: 'relic', crozier: CZ.upRight },
  { name: 'walk-2', seated: false, hand: [13, -50], raise: [-17, -58], lean: 0, dip: 1, feet: [-7, 7, 0, 0], holds: 'relic', crozier: CZ.rest },
  { name: 'walk-3', seated: false, hand: [13, -49], raise: [-17, -57], lean: 2, dip: -1, feet: [-6, 8, 0, 3], holds: 'relic', crozier: CZ.rest },
  { name: 'walk-4', seated: false, hand: [13, -50], raise: [-17, -58], lean: 0, dip: 1, feet: [-7, 7, 0, 0], holds: 'relic', crozier: CZ.upRight },
  { name: 'slam-up', seated: false, hand: [4, -80], raise: [-6, -80], lean: 0, dip: -2, feet: [-8, 8, 0, 0], holds: 'none', crozier: CZ.upLeft },
  { name: 'slam-down', seated: false, hand: [-6, -34], raise: [-12, -36], lean: -3, dip: 8, feet: [-10, 9, 0, 0], holds: 'none', crozier: CZ.foot },
  { name: 'hook-back', seated: false, hand: [22, -36], raise: [-17, -54], lean: 4, dip: 3, feet: [-7, 9, 0, 0], holds: 'relic', crozier: CZ.right },
  { name: 'hook-out', seated: false, hand: [-22, -31], raise: [-16, -52], lean: -5, dip: 6, feet: [-10, 7, 0, 0], holds: 'relic', crozier: CZ.left },
  { name: 'rise', seated: false, hand: [12, -40], raise: [-18, -48], lean: -2, dip: 12, feet: [-6, 6, 0, 0], holds: 'relic', crozier: CZ.rest },
];
export const STAND = { stand: 0, walk: [1, 2, 3, 4], slamUp: 5, slamDown: 6, hookBack: 7, hookOut: 8, rise: 9 } as const;

/** The eyes (centre between them) relative to a pose's anchor: seated / standing, plus the pose's lean / dip. */
export const EYES_SIT: V2 = [0, -58];
export const EYES_STAND: V2 = [0, -76];

/** Part boxes (relative to the boss anchor on the FLOOR). */
export const BOX = {
  sit: {
    body: { x: -19, y: -PLINTH.h - 50, w: 38, h: 50 } as Rect,
    head: { x: -7, y: -PLINTH.h - 68, w: 14, h: 18 } as Rect,
  },
  stand: {
    body: { x: -17, y: -66, w: 34, h: 64 } as Rect,
    head: { x: -7, y: -86, w: 14, h: 20 } as Rect,
  },
  /** The crozier head's box (around the curl), centred on the curl. */
  crozierHead: 16,
} as const;

/** The fight (NORMAL values; HP × difficulty × co-op; ticks). Tuned with the bot: see the report. */
export const STATUE = {
  name: 'ST. PLECHELMUS',
  /** Mini-boss points (spec §5.2). */
  score: 5000,
  hp: 3000,
  /** The crozier's own HP (phase 2; shared: the damage counts for the bar too). */
  crozierHp: 260,
  /** The head: the weak point in phase 2 (phase 1: plain). */
  headMul: [1, 1.3] as const,
  /** Phase 2 starts at this HP fraction. */
  phase2At: 0.55,
  /** Contact damage (phase 2 body) and every attack's damage. */
  damage: 10,
  /** The wake: the stone cracks over this many ticks, then the bar fills. */
  wake: { crack: 48, fill: 60, hold: 24 },
  /** Phase 1: the crozier sweep (tell = glow + swing back). */
  sweep: { tele: 30, swing: 10, rec: 40, waveSpeed: 3.0, waveW: 18, waveH: 11, hitW: 70, hitH: 12, hitTicks: 8 },
  /** Phase 1: the thrown stone (tell = the reach for the block + the lift). */
  throw: { reach: 14, tele: 34, rec: 34, vy: -4.2, gravity: 0.17, hp: 24, bits: 3, bitVx: [0.9, 2.2] as const, bitVy: -2.6, bitGravity: 0.22, bitBounces: 2 },
  /** Phase 2: the step down off the plinth (invulnerable; the line). */
  step: { rise: 40, hop: 26, land: 30 },
  /** Phase 2: walking between attacks. */
  walk: { speed: 0.45, max: 100, near: 70, stride: 14 },
  /** Phase 2: the ground slam (tell = the crozier raised, glowing). */
  slam: { tele: 32, rec: 46, waveSpeed: 2.6, waveW: 16, waveH: 12, hitW: 52, hitH: 14, hitTicks: 8 },
  /** Phase 2: the crozier hook (tell = drawn back, glowing). */
  hook: { tele: 30, speed: 6, reach: 168, pull: 1.7, hold: 110, breakDmg: 36, hitBack: 2.6, rec: 40, laneH: 8 },
  /** The death: the ghost torn out, the cracks close, back onto the plinth. */
  end: { tear: 60, close: 60, walk: 0.8, sit: 40, thanks: 120 },
  /** The arena keeps the walking statue this far inside the locked view. */
  margin: 30,
} as const;

/** The crozier's curl centre relative to its grip for angle index i (the curl sits at the top). */
export function crozierTip(i: number, out: [number, number] = [0, 0]): [number, number] {
  const a = (CROZIER_ANGLES[i] * Math.PI) / 180;
  const up = CROZIER.len - CROZIER.grip - CROZIER.curlR;
  out[0] = Math.sin(a) * up;
  out[1] = -Math.cos(a) * up;
  return out;
}
