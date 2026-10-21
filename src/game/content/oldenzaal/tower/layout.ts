/**
 * Mission oldenzaal — the tower's layout (oz-f, docs/design/oldenzaal.md §8, §9; revision 2).
 * Owner: TOWER. Pure numbers (world px): the section, the art, the entities and the tests share them.
 *
 * Inside the square tower, bottom → top (y grows down; the floor is `TOWER.floor`):
 *
 * | y | zone | what |
 * |---|---|---|
 * | 1,776 … 1,330 | the foot | the tower door from the crypt stair, the first steep wooden stairs, lanterns |
 * | 1,330 … 900 | the clock works | the iron gear train in its oak frame, the pendulum, the rods to the dials |
 * | 900 … 430 | the shaft | heavy beams, crossed braces, the bell ropes |
 * | 430 … 120 | the bell chamber | the oak bell frame, louvred openings, two swinging bells |
 * | 120 … 0 | the roof | the parapet, the small spire with its clock and the big bell in its open lantern |
 *
 * The climb: 45 landings 36 px apart (`ledgeY(k)`), odd k on the left (24–200), even k on the
 * right (184–360): they overlap at x 184–200 so a hero (and the bot: goals more than 20 px up) can
 * always jump to the next one. The roof is a one-way floor at `TOWER.roofY` (= ledgeY(46)).
 */

export const TOWER = {
  w: 384,
  h: 1800,
  /** The stone floor at the foot (feet y). */
  floor: 1776,
  /** The side walls (solid, 24 px). */
  wall: 24,
  /** Landings k = 1 … `ledges`. */
  ledges: 45,
  /** Landing spacing (px). */
  step: 36,
  /** A landing's width; left ones start at `wall`, right ones end at `w - wall`. */
  ledgeW: 176,
  /** The roof floor (one-way; = ledgeY(46)). */
  roofY: 120,
  /** The parapet on both sides of the roof (solid, from this y down). */
  parapetY: 104,
  /** Zone bounds (y): the clock works, the shaft, the bell chamber. */
  clockTop: 900,
  clockBottom: 1330,
  chamberTop: 120,
  chamberBottom: 430,
} as const;

/** Feet y of landing k (k = 0 is the floor). */
export const ledgeY = (k: number): number => TOWER.floor - TOWER.step * k;
/** Left x of landing k (odd: the left side, even: the right side). */
export const ledgeX = (k: number): number => (k % 2 ? TOWER.wall : TOWER.w - TOWER.wall - TOWER.ledgeW);

/**
 * The horde tide (spec §8): it starts when the view's top passes `startCamY` (about a third of the
 * way up), rises `speed` px per tick, never lags more than `lag` px below the view's bottom, holds
 * `grace` ticks at a checkpoint, sinks out of the view and holds after a death, and stops for good
 * at `stopY` (one landing below the top landing: the bells' last toll).
 */
export const TIDE = {
  startCamY: 1110,
  speed: 0.4,
  lag: -6,
  /** Ticks it waits at a checkpoint. */
  grace: 120,
  /** After a hero's death: it sinks to the view's bottom + `sinkTo` at `sinkSpeed` and holds `deathHold` ticks. */
  deathHold: 200,
  sinkTo: 16,
  sinkSpeed: 2,
  /** The deadly line sits this far under the drawn heads (the reaching arms above it are cosmetic). */
  reach: 18,
  /** The last toll: it stops here (the top of its deadly part), just under landing 44. */
  stopY: 198,
} as const;

/** One bell of the chamber or the lantern (world px of the pivot). */
export interface BellSpot {
  readonly size: 'small' | 'big';
  readonly x: number;
  readonly y: number;
  /** The swing schedule: rest ticks (first rest, then the cycle). */
  readonly rest: number;
  readonly phase: number;
  /** Swings in the chamber ('auto') or only when the script tolls it ('script'). */
  readonly mode: 'auto' | 'script';
}

/**
 * The bells: two small ones over the outer ends of landings 41 (left) and 42 (right), off the climb
 * column (x 184–200) so a hero who keeps climbing is never in their arc; the big bell hangs in the
 * spire's open lantern above the roof and tolls only at the end (its last toll stops the tide).
 */
export const BELLS: readonly BellSpot[] = [
  { size: 'small', x: 62, y: ledgeY(41) - 58, rest: 150, phase: 0, mode: 'auto' },
  { size: 'small', x: 322, y: ledgeY(42) - 58, rest: 190, phase: 70, mode: 'auto' },
  { size: 'big', x: 192, y: 30, rest: 0, phase: 0, mode: 'script' },
];

/** The jet Swan's hover point (feet anchor, world px) beside the roof, and where she comes from. */
export const SWAN_JET = {
  hoverX: 300,
  hoverY: TOWER.roofY - 6,
  fromX: 470,
  fromY: 18,
  /** She leaves up and to the right, into the clouds. */
  leaveVx: 5.2,
  leaveVy: -1.9,
} as const;
