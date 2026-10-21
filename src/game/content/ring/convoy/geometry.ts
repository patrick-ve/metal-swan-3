/**
 * The enforcement convoy of the ring (docs/design/ring.md §5.3, §9) — shared numbers and sprite ids
 * of the scan car, the tow truck and the handhaver motorbike. The art (art*.ts) and the logic
 * (scan-car.ts, tow-truck.ts, moto.ts) read the same numbers.
 *
 * Local coordinates of a vehicle drawn FACING RIGHT (its front at +x): the anchor (0, 0) is the
 * road point under its middle; y grows up the screen as negative numbers. Every convoy vehicle drives
 * to the right with the traffic (it never faces left, so its lettering never needs a mirror frame).
 *
 * The scan car and the tow truck reuse the `ams` likeness: the scan car's geometry and drawers
 * (content/bosses/ams-scan/, never edited here) at their own `ring/scan-car/` ids, with a SMALLER
 * roof box drawn here; the ams tow truck at `ring/tow-truck/`.
 */
import type { Rect } from '../../../../engine/math';

export type Pt = readonly [number, number];

/** Entity ids (wave B, ring/ids.ts `RING_ENTITY_B`). */
export const CONVOY_ID = {
  scanCar: 'ring-scan-car',
  towTruck: 'ring-tow-truck',
  moto: 'ring-handhaver-moto',
  /** The fine sticker on a wagon's glass (spawned by a moto's slap). */
  sticker: 'ring-fine-sticker',
} as const;

/** Tags. */
export const CONVOY_TAG = {
  /** Every convoy enemy. */
  convoy: 'ring-convoy',
  /** The SCAN LOCK strips (the bot reads `ScanStrip`). */
  strip: 'ring-scan-strip',
  /** A tow cable while a wagon hangs on it. */
  cable: 'ring-tow-cable',
  /** A sticker on a wagon's glass. */
  sticker: 'ring-sticker',
} as const;

/** The status a sticker gives the hero in its window (his back aims are blocked). */
export const STICKER_STATUS = 'ring-fine-sticker';

// ---------------------------------------------------------------------------------------------
// Sprite ids (hoisted: no template strings in the per-tick draw)
// ---------------------------------------------------------------------------------------------

const SC = 'ring/scan-car';
const TT = 'ring/tow-truck';
const MO = 'ring/handhaver-moto';

/** Sprite prefixes per entity (art-def `defineRingArt`). */
export const CONVOY_PREFIX = { scanCar: `${SC}/`, towTruck: `${TT}/`, moto: `${MO}/` } as const;

export const SCAN_CAR_ID = {
  /** The ams car body by damage state (91 × 31, the ams geometry). */
  body: [`${SC}/body-0`, `${SC}/body-1`, `${SC}/body-2`] as const,
  /** The tinted glass with the handhaver: calm, shout, shock (the cower), airbag, empty. */
  cabin: `${SC}/cabin`,
  /** The silver alloy wheel (4 turn frames, centre anchor). */
  wheel: `${SC}/wheel`,
  /** Lettering, never mirrored: 0 `PARKEERCONTROLE` (front door), 1 `Gemeente Amsterdam` (rear door). */
  text: `${SC}/text`,
  /** The amber hazard lamp glow (centre anchor). */
  blink: `${SC}/blink`,
  /** The SMALLER ring roof box on its rack (car anchor): 0 idle, 1 scanning (red cast, lit lens), 2 the lens flares. */
  box: `${SC}/box`,
} as const;

/** Cabin frames (the ams order). */
export const CABIN = { calm: 0, shout: 1, shock: 2, airbag: 3, empty: 4 } as const;

export const TOW_TRUCK_ID = {
  /** The ams tow truck: clean, damaged (105 × 60). */
  body: `${TT}/body`,
  hook: `${TT}/hook`,
  wheel: `${TT}/wheel`,
  blink: `${TT}/blink`,
} as const;

export const MOTO_ID = {
  /** Strips of the handhaver on his motorbike (anchor: the road under the middle, facing right). */
  ride: `${MO}/ride`,
  tellBaton: `${MO}/tell-baton`,
  baton: `${MO}/baton`,
  tellSticker: `${MO}/tell-sticker`,
  sticker: `${MO}/sticker`,
  wobble: `${MO}/wobble`,
  gloat: `${MO}/gloat`,
  cower: `${MO}/cower`,
  down: `${MO}/down`,
  tumble: `${MO}/rider-tumble`,
  sit: `${MO}/rider-sit`,
  /** The fine sticker: 0 flat on the glass, 1 curling (in the air). Centre anchor. */
  fine: `${MO}/fine`,
  /** The HUD status icon of the sticker (a small fine card). */
  icon: `${MO}/fine-icon`,
} as const;

// ---------------------------------------------------------------------------------------------
// The ring scan car (`ring-scan-car`)
// ---------------------------------------------------------------------------------------------

/**
 * The ring's roof box: about half the ams box (16 px instead of 29), on a low black rack whose
 * feet stand on the roof. Continuous local coordinates of the car (facing right).
 */
export const SCAN_BOX = {
  /** The strip's local box (inclusive pixel columns / rows). */
  canvas: { x0: -18, y0: -38, x1: 3, y1: -28 },
  /** The box shell (rounded ends; a lid seam at `seam`), the lid's top face above `lidTop`. */
  shell: { x0: -15.4, x1: 1.2, y0: -36.4, y1: -31.4 },
  lidTop: -35.5,
  seam: -34.5,
  /** Smoked camera windows (x0, x1) on the lower body (y range `win`); the lens behind the rear one. */
  windows: [[-13.2, -9.8], [-6.6, -2.4]] as ReadonlyArray<readonly [number, number]>,
  win: [-33.8, -32.4] as const,
  lens: [-4.9, -33.6] as Pt,
  /** The mounting bar (x0, x1, y0, y1) and the feet (x ranges) down to the roof at `feetTo`. */
  bar: [-14.2, 0.2, -31.4, -30.6] as const,
  feet: [[-13.4, -11.6], [-2.2, -0.4]] as ReadonlyArray<readonly [number, number]>,
  feetTo: -29.2,
} as const;

export const SCAN_CAR = {
  /** Visual box (the body and the box) and the depth slab's x range. */
  box: { x: -44, y: -37, w: 88, h: 36 } as Rect,
  /** The lens (the scan beam starts here) and the bubble point. */
  lens: SCAN_BOX.lens,
  /** Body hit flash, hazard lamps (the ams `SCAN.lamps`), steam from the bonnet. */
  lamps: [[40, -13], [-42, -19]] as readonly Pt[],
  bonnet: [30, -18] as Pt,
  /** Front bumper x (the strip reaches a little beyond it). */
  front: 42,
} as const;

/** Tuning of the scan car (NORMAL; ticks, px, px/tick). */
export const SCAN_AI = {
  hp: 300,
  score: 1000,
  /** SCAN LOCK: the tell (scaled by difficulty, never below 18), the gap between scans. */
  tell: 34,
  firstDelay: 50,
  every: 220,
  jitter: 40,
  /** The lock holds at most this long; it ends sooner when no wagon is in the strip for `grace` ticks. */
  lockTicks: 210,
  grace: 18,
  recover: 40,
  /** A locked wagon drifts back on screen this fast and cannot push forward faster than `capSide`. */
  drag: 0.75,
  capSide: 0.15,
  /** The strip: from the view's left edge to this far beyond the car's front bumper. */
  stripFront: 26,
  /** Where it rides: this far ahead of its target on screen (centre to centre), its screen band. */
  ahead: [64, 112] as const,
  minX: 150,
  maxX: 330,
  rel: 1.2,
  laneSpeed: 0.55,
  /** Ticks in play before it drives off ahead (an unshot car never piles up), and its speed then. */
  stay: 960,
  leaveRel: 2.4,
  /** The breakdown: the airbag, the coast to the hard shoulder. */
  airbag: 50,
  coast: 0.04,
} as const;

// ---------------------------------------------------------------------------------------------
// The tow truck (`ring-tow-truck`; the ams truck's numbers: content/bosses/ams-scan/geometry.ts TRUCK)
// ---------------------------------------------------------------------------------------------

export const TOW = {
  /** Visual box (cab, bed and boom) and the depth slab's x range (the ams `TRUCK.box`). */
  box: { x: -48, y: -52, w: 95, h: 51 } as Rect,
  /** The boom tip (the hook's cable hangs from here) and the bed's rear end. */
  tip: [-52, -50] as Pt,
  rear: -48,
  front: 47,
  wheelX: [-32, -18, 30] as const,
  wheelY: -7,
  /** The amber beacon bar (blink spots on it). */
  beacon: [[22, -36], [28, -36]] as readonly Pt[],
  /** The indicator (the merge tell): the rear lamp on the bed. */
  indicator: [-47, -12] as Pt,
} as const;

export const TOW_AI = {
  hp: 400,
  score: 1000,
  /** Overtaking (screen px/tick), lane changes (px/tick), the merge's indicator tell (ticks). */
  enterRel: 2.2,
  laneSpeed: 0.5,
  signal: 24,
  /** Its rear this far ahead of the target's front before it merges in; then it closes to `holdGap`. */
  passGap: 36,
  holdGap: 20,
  /** The hook: the tell (the hook swings out), the cast (ticks), its reach behind the bed. */
  tell: 30,
  cast: 8,
  reach: 46,
  firstDelay: 30,
  every: 200,
  jitter: 30,
  recover: 40,
  /** Towing: the gap between the bed and the wagon's nose; the truck brakes this much (screen px/tick). */
  towGap: 14,
  drag: -0.7,
  /** Pinned at the left edge: the winch hauls (1 cell) every `haul` ticks; it lets go after `maxTow`. */
  haul: 60,
  maxTow: 360,
  /** The cable's HP (player shots along the lane hit it first; a blast snaps it). */
  cableHp: 30,
  stay: 960,
  leaveRel: 2.4,
  /** The hook on the cable: rest length, the swing (rad) during the tell. */
  hookRest: 8,
  hookOut: 20,
  swing: 0.9,
} as const;

// ---------------------------------------------------------------------------------------------
// The handhaver motorbike (`ring-handhaver-moto`)
// ---------------------------------------------------------------------------------------------

/** The bike (local, facing right). */
export const MOTO = {
  len: 44,
  wheelR: 5.6,
  rear: [-15.5, -5.6] as Pt,
  front: [16.5, -5.6] as Pt,
  /** The rider's hip on the seat; the handlebar grips. */
  hip: [-3, -20.5] as Pt,
  bar: [9.5, -27] as Pt,
  /** Visual box (bike and rider). */
  box: { x: -22, y: -48, w: 44, h: 48 } as Rect,
} as const;

/** Tuning of the motorbike (NORMAL). */
export const MOTO_AI = {
  hp: 30,
  score: 300,
  /** Tells (scaled by difficulty, never below 18), the strike frames, the recovery. */
  tellBaton: 26,
  tellSticker: 30,
  strike: 8,
  recover: 20,
  firstDelay: 24,
  every: 150,
  jitter: 30,
  /** Riding (screen px/tick), entering from behind, lane changes. */
  rel: 1.6,
  enterRel: 1.9,
  laneSpeed: 0.8,
  /** It rides at the hero's window: this far from the window's x it may strike. */
  reach: 22,
  /** After a strike it drops back (ticks, screen px/tick). */
  peel: 36,
  peelRel: -1,
  /** Ticks in play before it speeds off ahead; at most `crowd` motos ride at the windows at once. */
  stay: 480,
  leaveRel: 3,
  crowd: 3,
  /** The rider's hand height (bubble and shot lift). */
  handLift: 34,
} as const;

/** The fine sticker on the glass. */
export const STICKER = {
  /** Its centre on the wagon (local, facing right): the rear quarter glass behind the hero. */
  at: [-31, -22] as Pt,
  /** Ticks it sticks at most (a swerve shakes it off sooner; the HUD bar shows the rest). */
  ticks: 720,
  /** Logical size of the sticker strip (odd: centre anchor). */
  w: 13,
  h: 9,
} as const;
