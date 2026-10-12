/**
 * Machines sub-area "armor": shared geometry. The art (./*.art.ts) and the logic (./*.ts) both
 * read these numbers, so a muzzle, a hatch or a hurtbox can never drift away from its drawing.
 *
 * Every offset is relative to the entity anchor in the UNFLIPPED pose (facing right), in px,
 * y grows down. Anchors: feet centre (tank, mortar, speaker, barricade, battery bottom centre),
 * or the mount point (metronome: the ceiling for a hanging turret, the floor for `floor: true`).
 */

/** A rect relative to an anchor. */
export interface RelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** `oompah-tank` (GDD §9.2): 72×44, hull 64×28 + turret 24×14, a 20 px tuba bell for a cannon. */
export const TANK = {
  /** Whole drawing (for on-screen checks and despawning). */
  bounds: { x: -32, y: -44, w: 72, h: 44 } as RelRect,
  hull: { x: -32, y: -28, w: 64, h: 28 } as RelRect,
  turret: { x: -14, y: -42, w: 24, h: 14 } as RelRect,
  /** The hull top players stand on (a one-way dynamic solid), symmetric so a turn never shifts it. */
  deck: { x: -26, y: -28, w: 52, h: 4 } as RelRect,
  /** Centre of the bell's mouth: the bell shell leaves here. */
  muzzle: [36, -33] as const,
  /** The turret hatch the crewman pops out of. */
  hatch: [-4, -42] as const,
  /** The smoking wreck: a solid block (cover and a step). */
  wreck: { x: -28, y: -20, w: 56, h: 20 } as RelRect,
  /** Physics body (feet anchor). */
  bodyW: 60,
  bodyH: 28,
} as const;

/** `metronome-turret` (GDD §9.2): 32×48, a wooden pyramid whose pendulum is the gun. */
export const METRONOME = {
  /** Pivot of the pendulum below the ceiling mount (a floor turret mirrors every y). */
  pivotY: 8,
  /** Pivot → centre of the brass bob at the rod's tip. */
  rod: 38,
  /** Bullets leave just past the bob. */
  muzzle: 41,
  /** Pivot → sliding weight: normal tempo, and after the accelerando (it slides down). */
  weight: 21,
  weightFast: 30,
  /** Frames of the pendulum strips: −50° … +50° in 5° steps. */
  maxAngle: 50,
  angleStep: 5,
  /** The pyramid body (hanging); a floor turret uses y → −y − h. */
  box: { x: -14, y: 2, w: 28, h: 32 } as RelRect,
  bounds: { x: -16, y: 0, w: 32, h: 48 } as RelRect,
} as const;

/** Number of pendulum frames (−50° … +50° in 5° steps = 21). */
export const METRONOME_FRAMES = (METRONOME.maxAngle * 2) / METRONOME.angleStep + 1;

/** Frame index of a pendulum angle (degrees, + = toward +x). */
export function metronomeFrame(deg: number): number {
  const i = Math.round((deg + METRONOME.maxAngle) / METRONOME.angleStep);
  return i < 0 ? 0 : i >= METRONOME_FRAMES ? METRONOME_FRAMES - 1 : i;
}

/** `gramophone-mortar` (GDD §9.2): 40×40, a wooden box with a brass flower horn. */
export const MORTAR = {
  bounds: { x: -18, y: -40, w: 40, h: 40 } as RelRect,
  hurt: { x: -17, y: -36, w: 34, h: 36 } as RelRect,
  /** Horn pivot (on the box top) and pivot → mouth centre. */
  pivot: [-2, -17] as const,
  hornLen: 16,
  /** Horn elevations of the `horn` strip frames (degrees above the horizon). */
  angles: [45, 55, 65, 75, 85] as const,
} as const;

/** Horn mouth (record launch point) for a horn frame, unflipped. */
export function mortarMuzzle(frame: number, out: [number, number]): [number, number] {
  const a = (MORTAR.angles[Math.max(0, Math.min(MORTAR.angles.length - 1, frame))] * Math.PI) / 180;
  out[0] = MORTAR.pivot[0] + Math.cos(a) * MORTAR.hornLen;
  out[1] = MORTAR.pivot[1] - Math.sin(a) * MORTAR.hornLen;
  return out;
}

/** `pipe-battery` (GDD §9.2): 64×64, a wind chest with 5 brass organ pipes. */
export const PIPES = {
  bounds: { x: -32, y: -64, w: 64, h: 64 } as RelRect,
  /** The wind chest under the pipes (armoured: shots ping off it). */
  chest: { x: -32, y: -18, w: 64, h: 18 } as RelRect,
  pipeW: 10,
  /** Left edge of each pipe. */
  pipeX: [-31, -18, -5, 8, 21] as const,
  /** Height of each pipe above the chest (all different: five notes). */
  pipeH: [34, 42, 46, 38, 30] as const,
  /** Chord order (GDD: "the pipes light up in chord order"): lowest note up, an arpeggio. */
  order: [2, 1, 3, 0, 4] as const,
} as const;

/** Hurtbox of pipe i (unflipped). */
export function pipeRect(i: number): RelRect {
  const h = PIPES.pipeH[i];
  return { x: PIPES.pipeX[i], y: PIPES.chest.y - h, w: PIPES.pipeW, h };
}

/** `anthem-speaker` (GDD §9.2): 24×40, a lamp post with a crimson loudspeaker horn. */
export const SPEAKER = {
  bounds: { x: -10, y: -42, w: 24, h: 42 } as RelRect,
  hurt: { x: -8, y: -40, w: 20, h: 40 } as RelRect,
  /** Centre of the horn's mouth (notes and the ♪ bubble come from here). */
  horn: [10, -36] as const,
} as const;

/** `drum-barricade` (GDD §9.5): a 32×64 wall of drums, solid. */
export const BARRICADE = {
  box: { x: -16, y: -64, w: 32, h: 64 } as RelRect,
} as const;
