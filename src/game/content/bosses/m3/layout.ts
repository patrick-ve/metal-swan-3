/**
 * THE WINDBAG — geometry shared by the art and the boss (GDD §10.3).
 *
 * Every point is relative to the boss anchor = the centre of the tartan bag. The airship faces
 * LEFT (the chanter and the gondola's bow point at the players; the drones and the propeller
 * stick out at the back, to the right) and never flips.
 */

const DEG = Math.PI / 180;

/** The bag: an ellipse (rest shape) and the hurtbox inside it. */
export const BAG = {
  rx: 86,
  ry: 40,
  /** Sprite canvas (the swell frame is larger than the rest shape). */
  canvasW: 200,
  canvasH: 104,
  box: { x: -80, y: -36, w: 160, h: 72 },
  /** Where the leak opens in phase 3 (upper back of the bag). */
  leak: [52, -26] as const,
} as const;

/** The drone pipe sprite: root length hidden in the bag, pipe, cap. */
export const DRONE = {
  /** Visible length from the base point to the tip. */
  len: 58,
  /** Root hidden inside the bag. */
  root: 10,
  thick: 8,
  /** Length of the stump left when a drone breaks. */
  stump: 16,
  /** Sprite canvas (square, the base at its centre). */
  canvas: 150,
} as const;

export interface DroneGeom {
  readonly name: 'drone-1' | 'drone-2' | 'drone-3';
  /** Base on the bag's rear shoulder. */
  readonly bx: number;
  readonly by: number;
  /** Angle above the horizontal (degrees; the pipe points up and back). */
  readonly deg: number;
  /** Tip (the muzzle of its Drone Bolts). */
  readonly tx: number;
  readonly ty: number;
  /** Hurtbox: the outer part of the pipe (the inner part is behind the bag). */
  readonly box: { x: number; y: number; w: number; h: number };
}

function drone(name: DroneGeom['name'], t: number, deg: number): DroneGeom {
  const bx = Math.round(BAG.rx * Math.cos(t * DEG));
  const by = Math.round(-BAG.ry * Math.sin(t * DEG));
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  const tx = Math.round(bx + DRONE.len * c);
  const ty = Math.round(by - DRONE.len * s);
  // The outer 55 % of the pipe, padded by half its thickness.
  const ax = bx + 26 * c;
  const ay = by - 26 * s;
  const x0 = Math.floor(Math.min(ax, tx) - 4);
  const x1 = Math.ceil(Math.max(ax, tx) + 4);
  const y0 = Math.floor(Math.min(ay, ty) - 4);
  const y1 = Math.ceil(Math.max(ay, ty) + 4);
  return { name, bx, by, deg, tx, ty, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

/** Three drones fanned over the rear shoulder: drone-1 is the steepest and the highest. */
export const DRONES: readonly DroneGeom[] = [drone('drone-1', 36, 38), drone('drone-2', 25, 27), drone('drone-3', 14, 16)];

/** The chanter (main gun) hanging under the front of the bag. */
export const CHANTER = {
  /** Top centre (inside the bag) and length to the bell. */
  x: -58,
  y: 26,
  len: 50,
  w: 10,
  box: { x: -64, y: 36, w: 13, h: 40 },
  /** Bell (muzzle of the Reel). */
  muzzle: [-58, 76] as const,
  /** Finger holes (y below the chanter top), lit in order by the Reel telegraph. */
  holes: [12, 17, 22, 27, 32, 37] as readonly number[],
  /** Sprite canvas and anchor (top centre). */
  canvasW: 20,
  canvasH: 54,
} as const;

/** The wooden gondola under the bag, with Puffington and the mine hatch. */
export const GONDOLA = {
  /** Rope pivot under the bag (the pendulum hangs from here). */
  pivot: [24, 38] as const,
  /** Rest rope length: pivot → the gondola's top centre. */
  rope: 12,
  w: 64,
  h: 24,
  /** Rope attachment points on the bag (two ropes per side are drawn to the gondola corners). */
  ropeL: [-2, 39] as const,
  ropeR: [48, 33] as const,
  /** Mine hatch in the floor (x relative to the gondola's top centre). */
  hatchX: 10,
  /** Puffington stands here (x relative to the gondola's top centre; his torso sprite stands on y + 10). */
  pilotX: -10,
  /** Propeller hub behind the gondola (relative to its top centre). */
  prop: [38, 12] as const,
  canvasW: 70,
  canvasH: 30,
} as const;

/**
 * Positions in VIEW coordinates (the boss arena is the locked 384×216 view). The y values assume
 * the deck at view y 176 (GDD §11.3 `m3-c`); the boss shifts them by the real floor height.
 */
export const GROUND_VY = 176;

export const HOME = {
  /** Phase 1 drifts between these anchor x (the drone tips stay inside the view). */
  p1: { x0: 158, x1: 232, y: 68, period: 720 },
  /** Phase 2: lower ("the airship sinks"); the bag box spans view y 44–116, the chanter bell 156. */
  p2: { x: 246, y: 80 },
  /** Phase 3: up again, ready to dash (the chanter bell at y 132: standing players are safe). */
  p3: { x: 236, y: 56 },
  /**
   * Pendulum Gondola: the anchor flies from x0 to x1 at height y while the gondola swings on a
   * `rope`-px rope from +deg (pulled back) through 0 (lowest, mid-arena: its bottom 24 px above
   * the deck) to −deg, in `ticks`.
   */
  swing: { x0: 260, x1: 104, y: 40, rope: 50, deg: 52, ticks: 90 },
  /** Intro: rises from below the summit edge to the phase 1 home. */
  introFromY: 300,
} as const;

/** Speed of the airship between attacks (px/tick). */
export const CRUISE = 1.6;

/** GDD §10.3 numbers (NORMAL ticks; the boss applies the difficulty). */
export const WINDBAG = {
  score: 50000,
  hp: { drone: 800, chanter: 1500, bag: 2500 },
  /** Phase 3 starts when the bag has less than this much HP left (of 2,500). */
  hotAirBelow: 1000,
  intro: 150,
  intermission: 60,
  gust: { tele: 60, push: 0.6, ticks: 90, rec: 30 },
  bolts: { tele: 40, n: 3, speed: 1.5, turnDeg: 2, life: 180, hp: 10, gap: 14, rec: 30 },
  mines: { tele: 20, n: 4, fall: 0.42, r: 12, rec: 30 },
  reel: { tele: 30, every: 4, sweep: 60, flight: 44, rec: 40 },
  pendulum: { tele: 40, rec: 40 },
  dash: { tele: 30, windup: 12, speed: 4, after: 40, rec: 50 },
  death: 300,
} as const;
