/**
 * SWAN-3 frame tables (docs/design/swan-mount/look.md §9–§11) as data: every body strip with its
 * frames, timings and riders, and the neck postures. `art.ts` turns them into sprites.
 *
 * Body frame columns (look.md §10): hull offset dy (dx), tilt (+ = nose down), near / far foot
 * targets with their states, leg mode, wing poses, tail lift, honk breast. Riderless strips
 * carry their neck (self-contained, §7 step 1).
 */
import type { BodyPose, Foot, Wing, WingPose } from './body.art';
import type { NeckSpec } from './head.art';
import type { Pt } from './kit.art';

/** One sprite strip: frames plus its default timing (look.md §9). */
export interface StripDef {
  frames: readonly BodyPose[];
  durations?: readonly number[];
  ticksPerFrame?: number;
  loop?: boolean;
}

// ------------------------------------------------------------------------------------ helpers

const STAND_N: Foot = { x: -3, y: -4, s: 'S' };
const STAND_F: Foot = { x: -7, y: -4, s: 'S' };
/** Legs tucked as `jump` f1 (flap, fold, honk-air). */
const TUCK_N: Foot = { x: -6, y: -14, s: 'F' };
const TUCK_F: Foot = { x: -9, y: -15, s: 'F' };
/** Legs trailing in the glide (and the migration). */
const TRAIL_N: Foot = { x: -14, y: -11, s: 'F' };
const TRAIL_F: Foot = { x: -16, y: -12, s: 'F' };

const w = (p: WingPose, o: Omit<Wing, 'p'> = {}): Wing => ({ p, ...o });
const FOLD = w('FOLD');
const HALF = w('HALF');
const lift = (n: number): Wing => w('LIFT', { lift: n });

/** Rudder fin wag (1 px) for the run and the swim. */
const wag = (i: number): number => (i % 4 < 2 ? 0 : 1);

// ------------------------------------------------------------------------------------ necks

/**
 * Land posture, frame i ↔ aim +45° − 22.5°·i (look.md §11.3). For 0° and the down aims the neck
 * leaves the collar forward, sweeps down and enters the back of the head: the stretched "hiss
 * pose" of a charging goose (a vertical drop into the top of the head reads as an arm). The head
 * sits 4 px further forward than the §11.3 table, so the curve clears the breast and its bow "3":
 * muzzle (44, −24) at 0°, still 24 px above the ground.
 */
export const NECK_LAND: readonly NeckSpec[] = [
  { p1: [8, -1], p2: [10, 15], p3: [13, 23], angle: 45 },
  { p1: [8, -2], p2: [12, 14], p3: [15, 22], angle: 22.5 },
  { p1: [8, -3], p2: [13, 14], p3: [16, 21], angle: 0 },
  { p1: [9, -4], p2: [12, 9], p3: [17, 8], angle: -22.5 },
  { p1: [-3, -9], p2: [2, -14], p3: [11, -5], angle: -45 },
  { p1: [-3, -8], p2: [-1, -16], p3: [6, -14], angle: -67.5 },
  { p1: [1, -8], p2: [-3, -14], p3: [-2, -19], angle: -90 },
  { p1: [2, -12], p2: [2, -28], p3: [-11, -25], angle: -112.5 },
  { p1: [3, -14], p2: [-4, -34], p3: [-20, -25], angle: -135 },
];

/** Water posture: frames 0–1 = frame 2 (no down-aim), 4–8 = the land frames (§11.2). */
export const NECK_WATER: readonly NeckSpec[] = [
  { p1: [3, -7], p2: [11, -6], p3: [14, 4], angle: 0 },
  { p1: [3, -7], p2: [11, -6], p3: [14, 4], angle: 0 },
  { p1: [3, -7], p2: [11, -6], p3: [14, 4], angle: 0 },
  { p1: [0, -8], p2: [9, -11], p3: [13, -6], angle: -22.5 },
  ...NECK_LAND.slice(4),
];

/** Crouch and water duck: 0° only, the neck folded flat. */
export const NECK_CROUCH: NeckSpec = { p1: [5, 0], p2: [8, 3], p3: [10, 3], angle: 0 };
export const NECK_DUCK: NeckSpec = { p1: [5, -1], p2: [9, 1], p3: [12, 1], angle: 0 };

/**
 * The classic swan S (idle 40 ticks, the drop-in): out of the collar forward, back, then forward
 * into the head, beak +25° (the §11.3 curve with one more bend; head (21, −69) on land).
 */
export const NECK_RELAX: NeckSpec = { p1: [7, -8], p2: [-6, -14], p3: [5, -24], angle: 25 };

/** HONK: inhale (head pulled back), HONK (beak wide, −20°), hold (look.md §11.4). */
export const NECK_HONK: readonly NeckSpec[] = [
  { p1: [3, -7], p2: [-6, -12], p3: [-4, -16], angle: 10, eye: 'angry' },
  { p1: [3, -8], p2: [7, -15], p3: [10, -16], angle: -20, eye: 'angry', gap: 4 },
  { p1: [3, -8], p2: [8, -15], p3: [11, -16], angle: -20, eye: 'angry', gap: 2 },
];

/** Neck variants of every aim frame (look.md §9). */
export type NeckVariant = '' | 'fire' | 'shell' | 'blink' | 'hurt';

/**
 * A neck frame for a variant: `fire` — head 1 px back along the beak, beak gap 1, eye angry;
 * `shell` — head 1 px forward, beak open 3, eye angry; `blink` — lid shut; `hurt` — squint.
 */
export function neckVariant(spec: NeckSpec, v: NeckVariant): NeckSpec {
  const r = (spec.angle * Math.PI) / 180;
  const u: Pt = [Math.cos(r), Math.sin(r)];
  const move = (k: number): NeckSpec => ({
    ...spec,
    p2: [spec.p2[0] + u[0] * k * 0.5, spec.p2[1] + u[1] * k * 0.5],
    p3: [spec.p3[0] + u[0] * k, spec.p3[1] + u[1] * k],
  });
  switch (v) {
    case 'fire':
      return { ...move(-1), gap: 1, eye: 'angry' };
    case 'shell':
      return { ...move(1), gap: 3, eye: 'angry' };
    case 'blink':
      return { ...spec, eye: 'blink' };
    case 'hurt':
      return { ...spec, eye: 'squint' };
    default:
      return spec;
  }
}

// Baked necks of the self-contained strips (relative to the socket).
const N_TUCK: NeckSpec = { p1: [6, -4], p2: [12, 1], p3: [8, 7], angle: 45, eye: 'half' };
const N_HISS = (gap: number): NeckSpec => ({ p1: [7, 3], p2: [14, 8], p3: [20, 12], angle: 8, gap, eye: 'angry' });
const N_LAND0 = NECK_LAND[2];

// ------------------------------------------------------------------------------------ ridden

const RUN: readonly BodyPose[] = (
  [
    [0, 2, { x: 8, y: -4, s: 'S15' }, { x: -14, y: -9, s: 'F' }, FOLD, 1],
    [2, 3, { x: 2, y: -4, s: 'S' }, { x: -8, y: -13, s: 'F' }, lift(2), 0],
    [1, 2, { x: -4, y: -4, s: 'S' }, { x: 1, y: -14, s: 'H' }, lift(1), -1],
    [-1, 1, { x: -10, y: -5, s: 'P', piston: 2 }, { x: 8, y: -9, s: 'S15' }, FOLD, 0],
    [0, 2, { x: -14, y: -9, s: 'F' }, { x: 8, y: -4, s: 'S15' }, FOLD, 1],
    [2, 3, { x: -8, y: -13, s: 'F' }, { x: 2, y: -4, s: 'S' }, lift(2), 0],
    [1, 2, { x: 1, y: -14, s: 'H' }, { x: -4, y: -4, s: 'S' }, lift(1), -1],
    [-1, 1, { x: 8, y: -9, s: 'S15' }, { x: -10, y: -5, s: 'P', piston: 2 }, FOLD, 0],
  ] as const
).map(([dy, tilt, near, far, wing, tail], i) => ({
  dy,
  tilt,
  near,
  far,
  legs: 'L',
  wingN: wing,
  wingF: wing,
  tail,
  fin: wag(i),
  rider: true,
}));

/** Water frames: the surface line is y −16 (look.md §10.7). */
const SWIM: readonly BodyPose[] = (
  [
    [18, { x: 6, y: -4, s: 'S' }, { x: -12, y: -5, s: 'F' }, 0],
    [19, { x: -3, y: -3, s: 'S' }, { x: -6, y: -7, s: 'F' }, 1],
    [18, { x: -12, y: -5, s: 'F' }, { x: 6, y: -4, s: 'S' }, 0],
    [17, { x: -6, y: -7, s: 'F' }, { x: -3, y: -3, s: 'S' }, -1],
  ] as const
).map(([dy, near, far, tail], i) => ({
  dy,
  tilt: 0,
  near,
  far,
  legs: 'W',
  wingN: FOLD,
  wingF: FOLD,
  tail,
  fin: wag(i * 2),
  water: true,
  marks: [i % 2 === 0 ? 'foam' : 'foam2'],
  rider: true,
}));

/** HONK frames (look.md §10.8): dy, tilt, wings, tail, breast. */
const HONK_ROWS: ReadonlyArray<readonly [number, number, WingPose, number, number]> = [
  [1, 0, 'HALF', 1, 0],
  [2, 0, 'BUSK', 2, 1],
  [0, -4, 'BUSK', 2, 2],
  [-2, -6, 'BLAST', 3, 2],
  [-1, -3, 'HALF', 1, 1],
];

function honk(kind: 'land' | 'air' | 'swim'): BodyPose[] {
  return HONK_ROWS.map(([dy, tilt, wing, tail, breast], i) => {
    const swim = kind === 'swim';
    const base: BodyPose = {
      dy: dy + (swim ? 18 : 0),
      tilt,
      legs: swim ? 'W' : 'L',
      near: kind === 'land' ? { x: 5, y: -4, s: 'S' } : swim ? { x: 6, y: -4, s: 'S' } : TUCK_N,
      far: kind === 'land' ? { x: -9, y: -4, s: 'S' } : swim ? { x: -12, y: -5, s: 'F' } : TUCK_F,
      wingN: w(wing),
      wingF: w(wing),
      tail,
      breast,
      rider: true,
    };
    if (swim) {
      base.water = true;
      base.marks = [i % 2 === 0 ? 'foam' : 'foam2'];
    }
    return base;
  });
}

const LOW = { legs: 'T', wingN: w('FLAT'), wingF: w('FLAT'), handles: 'fold', low: true, rider: true } as const;

/** Ridden strips: each has a `-front` overlay (look.md §9, column R). */
export const RIDDEN: Readonly<Record<string, StripDef>> = {
  idle: {
    frames: [
      { dy: 0, tilt: 0, near: STAND_N, far: STAND_F, legs: 'L', wingN: FOLD, wingF: FOLD, tail: 0, rider: true },
      { dy: 1, tilt: 0, near: STAND_N, far: STAND_F, legs: 'L', wingN: lift(1), wingF: lift(1), tail: 0, rider: true },
    ],
    ticksPerFrame: 24,
  },
  // One frame per 6 px travelled (the swan's odometer picks the frame); 3 ticks at 2 px/tick.
  run: { frames: RUN, ticksPerFrame: 3 },
  move: { frames: RUN, ticksPerFrame: 3 },
  squat: {
    frames: [
      { dy: 3, tilt: 2, near: { x: 1, y: -4, s: 'S' }, far: { x: -5, y: -4, s: 'S' }, legs: 'L', wingN: HALF, wingF: HALF, tail: 1, rider: true },
      { dy: 6, tilt: 3, near: { x: 1, y: -4, s: 'S' }, far: { x: -5, y: -4, s: 'S' }, legs: 'L', wingN: HALF, wingF: HALF, tail: 2, rider: true },
    ],
    durations: [2, 2],
    loop: false,
  },
  jump: {
    frames: [
      { dy: -2, tilt: -4, near: { x: -10, y: -2, s: 'P', piston: 3 }, far: { x: -13, y: -1, s: 'P', piston: 3 }, legs: 'L', wingN: HALF, wingF: HALF, tail: 2, rider: true },
      { dy: 0, tilt: -2, near: TUCK_N, far: TUCK_F, legs: 'L', wingN: HALF, wingF: HALF, tail: 1, rider: true },
    ],
    durations: [4, 60],
    loop: false,
  },
  fall: {
    frames: [
      { dy: 0, tilt: -2, near: { x: 4, y: -4, s: 'S' }, far: { x: -1, y: -5, s: 'S' }, legs: 'L', wingN: HALF, wingF: HALF, tail: 0, rider: true },
      { dy: 0, tilt: -2, near: { x: 5, y: -4, s: 'H' }, far: { x: 0, y: -5, s: 'S' }, legs: 'L', wingN: w('HALF', { tips: 1 }), wingF: w('HALF', { tips: 1 }), tail: -1, rider: true },
    ],
    ticksPerFrame: 6,
  },
  stomp: {
    frames: [{ dy: 3, tilt: 3, near: { x: 2, y: -4, s: 'S' }, far: { x: -4, y: -4, s: 'S' }, legs: 'L', wingN: HALF, wingF: HALF, tail: 2, rider: true }],
    ticksPerFrame: 4,
    loop: false,
  },
  land: {
    frames: [
      { dy: 6, tilt: 4, near: { x: 2, y: -4, s: 'S' }, far: { x: -3, y: -4, s: 'S' }, legs: 'L', wingN: lift(2), wingF: lift(2), tail: 2, rider: true },
      { dy: 2, tilt: 1, near: { x: 1, y: -4, s: 'S' }, far: { x: -4, y: -4, s: 'S' }, legs: 'L', wingN: lift(1), wingF: lift(1), tail: 0, rider: true },
    ],
    durations: [2, 2],
    loop: false,
  },
  flap: {
    frames: [
      { dy: 0, tilt: 0, near: TUCK_N, far: TUCK_F, legs: 'L', wingN: w('UP'), wingF: w('UP'), tail: 2, rider: true },
      { dy: -1, tilt: 2, near: TUCK_N, far: TUCK_F, legs: 'L', wingN: w('DOWN'), wingF: w('MID'), tail: 1, rider: true },
    ],
    durations: [3, 3],
    loop: false,
  },
  glide: {
    frames: [
      { dy: 0, tilt: 3, near: TRAIL_N, far: TRAIL_F, legs: 'L', wingN: w('SPREAD'), wingF: w('SPREAD'), tail: -1, rider: true },
      { dy: 0, tilt: 3, near: TRAIL_N, far: TRAIL_F, legs: 'L', wingN: w('SPREAD', { tips: 1 }), wingF: w('SPREAD', { tips: 1 }), tail: -1, rider: true },
    ],
    ticksPerFrame: 8,
  },
  'glide-tired': {
    frames: [
      { dy: 0, tilt: 3, near: TRAIL_N, far: TRAIL_F, legs: 'L', wingN: w('SPREAD', { tips: 1 }), wingF: w('SPREAD', { tips: 1 }), tail: -1, rider: true },
      { dy: 0, tilt: 3, near: TRAIL_N, far: TRAIL_F, legs: 'L', wingN: w('SPREAD', { tips: -1 }), wingF: w('SPREAD', { tips: -1 }), tail: -1, rider: true },
    ],
    ticksPerFrame: 2,
  },
  fold: {
    frames: [{ dy: 0, tilt: -2, near: TUCK_N, far: TUCK_F, legs: 'L', wingN: HALF, wingF: HALF, tail: 0, rider: true }],
    ticksPerFrame: 2,
    loop: false,
  },
  skid: {
    frames: [
      { dy: 2, tilt: -8, near: { x: 12, y: -4, s: 'S20' }, far: { x: 8, y: -4, s: 'S20' }, legs: 'L', wingN: w('BRAKE'), wingF: w('BRAKE'), tail: 3, rider: true },
      { dy: 3, tilt: -10, near: { x: 13, y: -4, s: 'S20' }, far: { x: 9, y: -4, s: 'S20' }, legs: 'L', wingN: w('BRAKE'), wingF: w('BRAKE'), tail: 3, rider: true },
    ],
    durations: [3, 60],
    loop: false,
  },
  crouch: {
    frames: [
      { ...LOW, dy: 28, tilt: 0, tail: 0 },
      { ...LOW, dy: 29, tilt: 0, tail: 0, wingN: w('FLAT', { lift: 1 }), wingF: w('FLAT', { lift: 1 }) },
    ],
    ticksPerFrame: 24,
  },
  // One frame per 3 px (her own 18 px cycle); 4 ticks at 0.8 px/tick.
  waddle: {
    frames: (
      [
        [28, -3, 'front', 1],
        [27, 0, 'front', 0],
        [28, 3, 'back', -1],
        [28, 3, 'back', -1],
        [27, 0, 'back', 0],
        [28, -3, 'front', 1],
      ] as const
    ).map(([dy, tilt, toes, tail]) => ({ ...LOW, dy, tilt, toes, tail })),
    ticksPerFrame: 4,
  },
  slide: {
    frames: [
      { ...LOW, dy: 28, tilt: 2, tail: -1, toes: 'none', marks: ['sparks'] },
      { ...LOW, dy: 28, tilt: 2, tail: -1, toes: 'none', marks: ['sparks2'] },
    ],
    ticksPerFrame: 3,
  },
  settle: {
    frames: [
      { dy: 6, tilt: 0, near: { x: 0, y: -4, s: 'S' }, far: { x: -5, y: -4, s: 'S' }, legs: 'M', wingN: HALF, wingF: HALF, tail: 1, water: true, marks: ['foam'], rider: true },
      { dy: 12, tilt: 0, near: { x: 2, y: -4, s: 'S' }, far: { x: -7, y: -4, s: 'S' }, legs: 'S', wingN: lift(1), wingF: lift(1), tail: 0, water: true, marks: ['foam2'], rider: true },
    ],
    durations: [2, 2],
    loop: false,
  },
  // 6 ticks per frame while she moves, 16 when still (the swan sets the speed).
  swim: { frames: SWIM, ticksPerFrame: 6 },
  'water-duck': {
    frames: [
      { dy: 26, tilt: 0, legs: 'T', wingN: HALF, wingF: HALF, tail: 1, water: true, marks: ['foam'], rider: true },
      { dy: 26, tilt: 0, legs: 'T', wingN: HALF, wingF: HALF, tail: 0, water: true, marks: ['foam2'], rider: true },
    ],
    ticksPerFrame: 24,
  },
  'paddle-up': {
    frames: [
      { dy: 15, tilt: -10, near: { x: 6, y: -5, s: 'S' }, far: { x: -10, y: -6, s: 'F' }, legs: 'W', wingN: w('UP'), wingF: w('UP'), tail: 2, water: true, marks: ['foam'], rider: true },
      { dy: 10, tilt: -8, near: { x: 6, y: -16, s: 'S' }, far: { x: -8, y: -9, s: 'H' }, legs: 'S', wingN: w('DOWN'), wingF: w('MID'), tail: 1, water: true, marks: ['foam2'], rider: true },
      { dy: 5, tilt: -6, near: { x: -8, y: -12, s: 'H' }, far: { x: 7, y: -16, s: 'S' }, legs: 'M', wingN: w('UP'), wingF: w('UP'), tail: 1, water: true, marks: ['foam'], rider: true },
      { dy: 0, tilt: -4, near: { x: -6, y: -16, s: 'P' }, far: { x: -12, y: -20, s: 'F' }, legs: 'L', wingN: w('DOWN'), wingF: w('MID'), tail: 0, water: true, marks: ['foam2'], rider: true },
    ],
    durations: [2, 2, 2, 2],
    loop: false,
  },
  honk: { frames: honk('land'), durations: [4, 3, 3, 4, 6], loop: false },
  'honk-air': { frames: honk('air'), durations: [4, 3, 3, 4, 6], loop: false },
  'honk-swim': { frames: honk('swim'), durations: [4, 3, 3, 4, 6], loop: false },
  rise: {
    frames: [
      { dy: 20, tilt: 0, legs: 'T', wingN: FOLD, wingF: FOLD, tail: 0, rider: true, neck: { p1: [6, -3], p2: [12, 0], p3: [10, 3], angle: 20, eye: 'wide' } },
      { dy: 10, tilt: 0, near: STAND_N, far: STAND_F, legs: 'M', wingN: FOLD, wingF: FOLD, tail: 1, rider: true, neck: { p1: [4, -8], p2: [7, -16], p3: [-1, -16], angle: 172, eye: 'happy' } },
      { dy: 2, tilt: 0, near: STAND_N, far: STAND_F, legs: 'L', wingN: FOLD, wingF: FOLD, tail: 0, rider: true, neck: N_LAND0 },
    ],
    durations: [4, 4, 4],
    loop: false,
  },
  wreck: {
    frames: [
      { dy: 6, tilt: 6, near: { x: 8, y: -4, s: 'S' }, far: { x: -12, y: -4, s: 'S' }, legs: 'L', wingN: w('LIMP'), wingF: w('LIMP'), tail: -1, rider: true, neck: { p1: [6, 0], p2: [12, 9], p3: [13, 17], angle: 55, eye: 'dizzy' } },
      { dy: 7, tilt: 6, near: { x: 8, y: -4, s: 'S' }, far: { x: -12, y: -4, s: 'S' }, legs: 'L', wingN: w('LIMP', { tips: -1 }), wingF: w('LIMP', { tips: -1 }), tail: -2, rider: true, neck: { p1: [6, 1], p2: [12, 10], p3: [13, 18], angle: 60, eye: 'dizzy' } },
    ],
    ticksPerFrame: 6,
  },
};

// ------------------------------------------------------------------------------------ riderless

/** Parked: keel on the ground, legs stowed, toe tips peeking, head tucked (look.md §10.10). */
const PARK = { dy: 28, tilt: 0, legs: 'T', wingN: FOLD, wingF: FOLD, tail: 0 } as const;
/** `bubble`: the RIDE? bubble's tail tip, 8 px above the pad (parked frames). */
const BUBBLE: Pt = [-4, -29];
const EGG: Pt = [-30, 0];

const DIVE_WINGS: readonly WingPose[] = ['HALF', 'MID', 'DOWN', 'MID', 'HALF', 'MID', 'DOWN', 'MID'];

/** Riderless strips: the neck is drawn into the body frame (look.md §9). */
export const RIDERLESS: Readonly<Record<string, StripDef>> = {
  'sit-down': {
    frames: [
      { dy: 6, tilt: 0, near: STAND_N, far: STAND_F, legs: 'L', wingN: FOLD, wingF: FOLD, tail: 0, neck: { p1: [7, -3], p2: [12, 6], p3: [12, 12], angle: 30 } },
      { dy: 16, tilt: 0, near: STAND_N, far: STAND_F, legs: 'M', wingN: FOLD, wingF: FOLD, tail: 0, neck: { p1: [6, -3], p2: [12, 4], p3: [10, 9], angle: 50, eye: 'half' } },
      { ...PARK, neck: { ...N_TUCK, eye: 'blink' }, pts: { bubble: BUBBLE } },
    ],
    durations: [6, 6, 8],
    loop: false,
  },
  empty: {
    frames: [
      { ...PARK, neck: N_TUCK, pts: { bubble: BUBBLE } },
      { ...PARK, dy: 29, wingN: lift(1), wingF: lift(1), neck: N_TUCK, pts: { bubble: BUBBLE } },
    ],
    ticksPerFrame: 30,
  },
  // Picked by code from the nearest player within 96 px (behind / ahead, level / above).
  'empty-look': {
    frames: (['back-low', 'front-low', 'back-high', 'front-high', 'blink'] as const).map((eye) => ({
      ...PARK,
      neck: { p1: [6, -4], p2: [12, 0], p3: [9, 4], angle: 40, eye },
      pts: { bubble: BUBBLE },
    })),
    ticksPerFrame: 30,
  },
  'empty-lay': {
    frames: [
      { ...PARK, neck: { p1: [4, -6], p2: [10, -12], p3: [7, -12], angle: 10, eye: 'wide' }, pts: { bubble: BUBBLE } },
      { ...PARK, neck: { p1: [4, -7], p2: [6, -14], p3: [1, -14], angle: 168, eye: 'front-low' }, pts: { bubble: BUBBLE } },
      { ...PARK, neck: { p1: [4, -6], p2: [10, -12], p3: [9, -12], angle: 0, eye: 'front-low' }, pts: { bubble: BUBBLE } },
      { ...PARK, dy: 26, tilt: 3, neck: { p1: [5, -4], p2: [10, -8], p3: [7, -9], angle: 15, eye: 'squint' }, pts: { bubble: [-4, -27] } },
      { ...PARK, dy: 26, tilt: -3, tail: 2, neck: { p1: [5, -4], p2: [10, -8], p3: [7, -9], angle: 15, eye: 'squint' }, pts: { bubble: [-4, -27] } },
      { ...PARK, dy: 27, neck: { p1: [4, -6], p2: [10, -12], p3: [7, -12], angle: 5, eye: 'wide' }, pts: { bubble: [-4, -28], egg: EGG } },
      { ...PARK, neck: { p1: [4, -7], p2: [5, -13], p3: [-1, -12], angle: 160, eye: 'wide' }, pts: { bubble: BUBBLE, egg: EGG } },
      { ...PARK, breast: 1, neck: { p1: [4, -7], p2: [10, -14], p3: [8, -14], angle: -8, eye: 'happy' }, pts: { bubble: BUBBLE, egg: EGG } },
    ],
    durations: [20, 10, 10, 6, 6, 8, 20, 30],
    loop: false,
  },
  hiss: {
    frames: [
      { dy: 0, tilt: 1, near: STAND_N, far: STAND_F, legs: 'L', wingN: w('BUSK'), wingF: w('BUSK'), tail: 3, neck: N_HISS(2) },
      { dy: 1, tilt: 2, near: STAND_N, far: STAND_F, legs: 'L', wingN: w('BUSK'), wingF: w('BUSK'), tail: 3, fin: 1, neck: { ...N_HISS(3), p3: [21, 12] } },
    ],
    durations: [3, 3],
    loop: false,
  },
  // The run legs with a 32 px step (contact at +12): one frame per 8 px.
  dive: {
    frames: RUN.map((r, i) => ({
      ...r,
      tilt: 6,
      rider: false,
      near: r.near ? { ...r.near, x: Math.round((r.near.x * 4) / 3) } : undefined,
      far: r.far ? { ...r.far, x: Math.round((r.far.x * 4) / 3) } : undefined,
      wingN: w(DIVE_WINGS[i]),
      wingF: w(DIVE_WINGS[i]),
      tail: 2,
      neck: N_HISS(i === 1 || i === 5 ? 3 : 1),
    })),
    ticksPerFrame: 2,
  },
  bash: {
    frames: [
      { dy: 4, tilt: 10, near: { x: 10, y: -4, s: 'S20' }, far: { x: 5, y: -4, s: 'S20' }, legs: 'L', wingN: w('BLAST'), wingF: w('BLAST'), tail: 3, neck: { p1: [8, 4], p2: [15, 10], p3: [22, 14], angle: 10, gap: 2, eye: 'squint' } },
    ],
    ticksPerFrame: 6,
    loop: false,
  },
  // She flips backward over her tail (rolled about the hull point).
  tumble: {
    frames: [
      { dy: 0, tilt: 0, roll: -90, near: { x: -6, y: -20, s: 'F' }, far: { x: -9, y: -21, s: 'F' }, feetOnHull: true, legs: 'L', wingN: HALF, wingF: HALF, tail: 2, neck: { p1: [-2, -8], p2: [6, -14], p3: [12, -10], angle: -50, eye: 'wide', gap: 2 } },
      { dy: 0, tilt: 0, roll: -180, near: { x: -6, y: -20, s: 'F' }, far: { x: -9, y: -21, s: 'F' }, feetOnHull: true, legs: 'L', wingN: HALF, wingF: HALF, tail: 2, bare: true, neck: { p1: [-6, 2], p2: [-12, -4], p3: [-14, -10], angle: -150, eye: 'dizzy' } },
    ],
    durations: [4, 4],
    loop: false,
  },
  // On her back, deck on the ground, paddling the air; the neck flops on the ground.
  dazed: {
    frames: [0, 1, 2, 3].map((i) => {
      const a = i % 2 === 0;
      // Hull-space targets: on her back they point up, the paddles kicking in turn.
      const near: Foot = a ? { x: 6, y: -9, s: 'S' } : { x: -11, y: -8, s: 'F' };
      const far: Foot = a ? { x: -13, y: -6, s: 'F' } : { x: 4, y: -11, s: 'S' };
      return {
        dy: 0,
        tilt: 0,
        roll: 180,
        near,
        far,
        feetOnHull: true,
        legs: 'L',
        // Wings flush on the flanks: a clean upside-down hull.
        wingN: FOLD,
        wingF: FOLD,
        tail: 0,
        bare: true,
        ground: true,
        neck: { p1: [-4, 3], p2: [-10, 3], p3: [-14, i < 2 ? -1 : 0], angle: 150, eye: 'dizzy', flop: true },
      } satisfies BodyPose;
    }),
    ticksPerFrame: 8,
  },
  right: {
    frames: [
      { dy: 0, tilt: 0, roll: -240, near: { x: -6, y: -16, s: 'F' }, far: { x: -9, y: -17, s: 'F' }, feetOnHull: true, legs: 'L', wingN: FOLD, wingF: FOLD, tail: 0, bare: true, ground: true, neck: { p1: [6, 2], p2: [10, 8], p3: [6, 12], angle: 100, eye: 'dizzy' } },
      { dy: 0, tilt: 0, roll: -300, near: { x: -6, y: -16, s: 'F' }, far: { x: -9, y: -17, s: 'F' }, feetOnHull: true, legs: 'L', wingN: FOLD, wingF: FOLD, tail: 0, ground: true, neck: { p1: [6, 0], p2: [12, 4], p3: [12, 9], angle: 60, eye: 'wide' } },
      { ...PARK, neck: { p1: [5, -5], p2: [10, -10], p3: [9, -14], angle: 0, eye: 'normal' }, pts: { bubble: BUBBLE } },
    ],
    durations: [4, 4, 4],
    loop: false,
  },
  shake: {
    frames: [
      { dx: -2, dy: 0, tilt: -2, near: STAND_N, far: STAND_F, legs: 'L', wingN: lift(2), wingF: lift(2), tail: 2, neck: { p1: [4, -8], p2: [5, -16], p3: [10, -16], angle: -15, eye: 'squint' } },
      { dx: 2, dy: 0, tilt: 2, near: STAND_N, far: STAND_F, legs: 'L', wingN: lift(1), wingF: lift(1), tail: -1, fin: 1, neck: { p1: [6, -8], p2: [11, -14], p3: [6, -17], angle: 15, eye: 'blink' } },
    ],
    durations: [4, 4],
    loop: false,
  },
  migrate: { frames: migrate(), ticksPerFrame: 4 },
  'migrate-soot': { frames: migrate(), ticksPerFrame: 4 },
};

/** Flying off up and forward, honking: wings UP, MID, DOWN, MID; neck at −22.5°. */
function migrate(): BodyPose[] {
  const wings: readonly WingPose[] = ['UP', 'MID', 'DOWN', 'MID'];
  return wings.map((p, i) => ({
    dy: i === 2 ? 1 : 0,
    tilt: -8,
    near: TRAIL_N,
    far: TRAIL_F,
    legs: 'L',
    wingN: w(p),
    wingF: w(p === 'DOWN' ? 'MID' : p),
    tail: 1,
    neck: { p1: [6, -3], p2: [12, -6], p3: [17, -8], angle: -22.5, gap: i % 2 === 0 ? 3 : 0 },
  }));
}

/** Every body strip id (ridden first). */
export const BODY_STRIPS: readonly string[] = [...Object.keys(RIDDEN), ...Object.keys(RIDERLESS)];
