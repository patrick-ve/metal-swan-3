/**
 * Layout numbers of the three m5 final-boss stages (GDD §10.5, §11.5 m5-c). Boxes are local to the
 * boss anchor and never mirrored (the three bosses never flip).
 *
 * - `grand-organ`: anchor = the top-left corner of the 300×200 front face. Home: face left edge at
 *   view x 200, face top at view y 8 (drifts ±24 px at 0.3 px/tick).
 * - `organ-console` and `maestro`: ROOM coordinates of the 384×216 m5-c screen (floor y 176). The
 *   console's anchor is the room's top-left corner; it spawns at the console foot (room 232, 176).
 *   The maestro's anchor is the centre of its podium; it spawns at the room's floor centre (192, 176).
 */
import type { Rect } from '../../../../engine/math';

export type Box = Readonly<Rect>;

// ---------------------------------------------------------------------------------------------
// Stage 1 — the Grand Organ
// ---------------------------------------------------------------------------------------------

export const ORGAN = {
  w: 300,
  h: 200,
  /** Home of the face's top-left corner in view coordinates. */
  homeVX: 200,
  homeVY: 8,
  drift: 24,
  driftSpeed: 0.3,
  /** The body sprite reaches above the face (spires, rotors). */
  spireTop: -30,
  parts: {
    'pipes-top': { x: 24, y: 30, w: 60, h: 50 },
    'pipes-mid': { x: 6, y: 86, w: 60, h: 50 },
    'pipes-low': { x: 24, y: 144, w: 60, h: 50 },
    speaker: { x: 90, y: 80, w: 64, h: 48 },
    bellows: { x: 100, y: 136, w: 80, h: 60 },
    /** The casework right of every part (contact, armoured): shots fired at the parts never meet it first. */
    hull: { x: 182, y: 0, w: 118, h: 200 },
  } as Record<string, Box>,
  /** Pipe mouths (chord spray origins) per cluster, local. */
  mouths: {
    'pipes-top': [24 + 6, 30 + 34],
    'pipes-mid': [6 + 4, 86 + 34],
    'pipes-low': [24 + 6, 144 + 34],
  } as Record<string, readonly [number, number]>,
  /** Centre of the speaker bell (the anthem beam's source). */
  bell: [100, 104] as const,
  /** The kazoo-drone hatch on the left edge. */
  hatch: [4, 140] as const,
  /** Rotor hubs (masts on the left and right spires). */
  rotors: [
    [46, -20],
    [254, -20],
  ] as const,
  hp: { pipes: 1000, bellows: 1500, speaker: 1200 },
  score: 30000,
} as const;

export const PIPE_NAMES = ['pipes-top', 'pipes-mid', 'pipes-low'] as const;

// ---------------------------------------------------------------------------------------------
// Stage 2 — the Console (room coordinates)
// ---------------------------------------------------------------------------------------------

export const ROOM = { w: 384, h: 216, floor: 176 } as const;

export const CONSOLE = {
  /** Spawn point = the console's foot (room x). */
  spawnX: 232,
  parts: {
    'pipe-bank-left': { x: 0, y: 40, w: 40, h: 136 },
    'pipe-bank-right': { x: 344, y: 40, w: 40, h: 136 },
    console: { x: 296, y: 44, w: 40, h: 40 },
  } as Record<string, Box>,
  /** One-way keyboard tiers (left, top, width) — the mission's `m5-console-tier`s. */
  tiers: [
    { x: 120, y: 148, w: 180 },
    { x: 150, y: 116, w: 150 },
    { x: 180, y: 84, w: 120 },
  ],
  /** Cabinet sprite (behind the tiers): room x 120–344, y 40–176. */
  cabinet: { x: 120, y: 40, w: 224, h: 136 },
  /** Fanfaroni's bench: he sits at x 304–340, feet y 84. */
  seat: [324, 84] as const,
  screen: { x: 72, y: 30, w: 240, h: 32 },
  /** Staff line y per lane: 0 floor, 1 tier 1, 2 tier 2, 3 tier 3. */
  laneY: [58, 50, 42, 34] as const,
  nowX: 76,
  /** Lane blast bands (y0, y1) per lane. */
  bands: [
    [150, 176],
    [120, 146],
    [88, 114],
    [56, 82],
  ] as const,
  /** The pedalboard under the console (floor). */
  pedals: { x: 262, y: 166, w: 76, h: 10 },
  /** The big stop knob that is pulled (B). */
  knob: [292, 100] as const,
  /** Wreck blocks of stage 3 (centres). */
  wrecks: [72, 192, 312] as const,
  hp: { bank: 1500, console: 3000 },
  score: 40000,
} as const;

export const BANK_NAMES = ['pipe-bank-left', 'pipe-bank-right'] as const;

/**
 * THE SCORE (GDD §10.5): one symbol per beat; `F` floor, `1`–`3` tiers, `-` rest, two letters =
 * both lanes. Lanes as numbers: 0 floor, 1–3 tiers; an empty list is a rest.
 */
export const PHRASES: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>> = [
  // Phrase 1: F - 1 - F - 2 -
  [[0], [], [1], [], [0], [], [2], []],
  // Phrase 2: F 1 - 2 F - 3 -
  [[0], [1], [], [2], [0], [], [3], []],
  // Phrase 3: F1 - 23 - F2 - 13 -
  [[0, 1], [], [2, 3], [], [0, 2], [], [1, 3], []],
  // Phrase 4 (fugue): F 1 2 3 F 1 2 3
  [[0], [1], [2], [3], [0], [1], [2], [3]],
];
/** Phrase order per phase (indices into PHRASES). */
export const PHRASE_LOOP = [
  [0, 1, 0, 2],
  [1, 2, 3, 2],
] as const;
export const BEAT = 32;
/** Notes appear this far right of the NOW bar. */
export const NOTE_LEAD = 128;

// ---------------------------------------------------------------------------------------------
// Stage 3 — the Maestro (anchor = podium centre)
// ---------------------------------------------------------------------------------------------

export const MAESTRO = {
  parts: {
    'speaker-left': { x: -32, y: -12, w: 8, h: 24 },
    'speaker-right': { x: 24, y: -12, w: 8, h: 24 },
    podium: { x: -22, y: -14, w: 44, h: 26 },
  } as Record<string, Box>,
  /** Fanfaroni's feet on the podium (local). */
  feet: [0, -14] as const,
  /** Figure-eight of the podium centre (his hat top stays in view): one loop in `loop` ticks. */
  eight: { cx: 192, cy: 92, ax: 116, ay: 34, loop: 360 },
  /** Where he screams from (podium centre; GDD (192, 50) is his head: the hat stays in view). */
  screamAt: [192, 66] as const,
  /** Mouth height over the podium centre. */
  mouthDY: -36,
  sinkY: 140,
  /** Floor glow behind the outer wreck blocks (BRAVISSIMO! telegraph). */
  safe: [
    [44, 60],
    [324, 340],
  ] as const,
  hp: { speaker: 600, podium: 2400 },
  dBelow: 1200,
  dEvery: 600,
  score: 100000,
} as const;

export const SPEAKER_NAMES = ['speaker-left', 'speaker-right'] as const;
