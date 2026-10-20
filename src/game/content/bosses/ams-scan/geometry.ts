/**
 * The parking scan car (docs/design/ams-extras.md §3) — shared layout and numbers of the car, the
 * tow truck, the wheel clamps and their shots. The art (art.ts, art-hd.ts) and the logic (car.ts,
 * adds.ts) read the same numbers.
 *
 * Local coordinates of a vehicle drawn FACING RIGHT (its front at +x): the anchor (0, 0) is the
 * floor point under its middle; y grows down. Shapes (polygons, circles) are in CONTINUOUS
 * logical coordinates: pixel (x, y) covers [x, x + 1) × [y, y + 1) and is inside a shape when its
 * centre (x + 0.5, y + 0.5) is. A vehicle that faces left (`facing` −1) mirrors its boxes and
 * points (pixel column x → −x). The car strips share the car anchor; the lettering strips are
 * never mirrored (car.ts draws them at the mirrored spot).
 *
 * The car: a compact, tall white electric hatchback in the livery of the city (red slanted bars on
 * the lower front door and the front wing, red stripes across the bonnet, `PARKEERCONTROLE`,
 * `Gemeente Amsterdam` with the three crosses), one band of dark tinted glass with black pillars
 * under a floating white roof, a big thick white scanner box on a black roof rack, silver alloy
 * wheels. 84 px long (the hurtboxes keep 88: a px of slack at each bumper), the body 27 px tall
 * over the road, 39 px with the scanner box.
 */
import type { Rect } from '../../../../engine/math';

export type Pt = readonly [number, number];

export const SCAN_ID = 'ams-scan-car';
export const TRUCK_ID = 'ams-tow-truck';
export const CLAMP_ID = 'ams-wheel-clamp';
export const TICKET_ID = 'ams-scan-ticket';
/** The status a closed clamp gives (registered in adds.ts). */
export const CLAMPED_ID = 'clamped';
/** Sprite prefix of every strip of the fight. */
export const SCAN_ART = 'boss/ams-scan';
/** HUD boss-bar name. */
export const SCAN_NAME = 'SCANAUTO';

/** Sprite ids (hoisted: no template strings in the per-tick draw). */
export const ID = {
  /** `body-<0|1|2>` by the body part's damage state (Boss.partState). */
  body: [`${SCAN_ART}/body-0`, `${SCAN_ART}/body-1`, `${SCAN_ART}/body-2`] as const,
  /** `scanner-<0|1|2>`: 4 frames each (down, lifted 1, lifted 2, lifted and scanning); `scanner-gone` once broken. */
  scanner: [`${SCAN_ART}/scanner-0`, `${SCAN_ART}/scanner-1`, `${SCAN_ART}/scanner-2`] as const,
  scannerGone: `${SCAN_ART}/scanner-gone`,
  /** The tinted glass with what it shows: calm, shout, shocked, airbag, empty. */
  cabin: `${SCAN_ART}/cabin`,
  /** A silver alloy wheel (4 turn frames, centre anchor): the car and the tow truck. */
  wheel: `${SCAN_ART}/wheel`,
  /** An amber hazard / beacon glow (centre anchor). */
  blink: `${SCAN_ART}/blink`,
  /** Death: three roll frames (45°, 90°, 135°) and the car on its roof; 0–3 facing right, 4–7 facing left (never flipped). */
  wreck: `${SCAN_ART}/wreck`,
  reticle: `${SCAN_ART}/reticle`,
  ticket: `${SCAN_ART}/ticket`,
  /** The tow truck: clean, damaged. */
  truck: `${SCAN_ART}/tow`,
  hook: `${SCAN_ART}/hook`,
  /** The wheel clamp: shut (in the air), open, open (the jaws twitch), crouched (hop tell). */
  clamp: `${SCAN_ART}/clamp`,
  /** The clamp locked on a boot (2 frames: still, rattling). */
  clampFoot: `${SCAN_ART}/clamp-foot`,
  /**
   * The lettering, NEVER mirrored (4 frames, each anchored on its block's centre): 0
   * `PARKEERCONTROLE` (front door), 1 `Gemeente Amsterdam` (rear door, set against the crosses on
   * its right), 2 the scanner's `24`, 3 `Gemeente Amsterdam` for the car facing left (set against
   * the mirrored crosses on its left; `SCAN.textFlip`). At 1× a hint of small print; readable at
   * 2× and 4×.
   */
  text: `${SCAN_ART}/text`,
  /** The fleeing driver (the handhaver's strips). */
  driverCrawl: 'enemy/handhaver/cower',
  driverRun: 'enemy/handhaver/walk',
} as const;

/** Cabin frames. */
export const CAB = { calm: 0, shout: 1, shock: 2, airbag: 3, empty: 4 } as const;

/** Tag of every entity of the fight (the car, the truck, the clamps): `ctx.waitClear(SCAN_TAG)`. */
export const SCAN_TAG = 'ams-scan';
/** The tow truck (the car calls at most one at a time). */
export const TRUCK_TAG = 'ams-scan-truck';
/** The wheel clamps (at most `SCAN.tow.clampMax` alive). */
export const CLAMP_TAG = 'ams-scan-clamp';

/** The two wheel centres (continuous x) and the axle height (continuous y). */
const WX = [-26.5, 26.5] as const;
const WY = -6.5;

/**
 * The belt line (the lower edge of the window band) at x: it rises gently towards the rear, then
 * kicks up under the rear quarter glass (from the C-pillar to the tailgate).
 */
export function beltY(x: number): number {
  if (x >= -26) return -18.8 - (22.4 - x) * 0.036;
  return -20.54 - (-26 - x) * 0.14;
}

export const SCAN = {
  // ------------------------------------------------------------------------------- the car
  /** The body strip's local box (inclusive pixel columns / rows). */
  canvas: { x0: -45, y0: -30, x1: 45, y1: 0 },
  /** The cabin strip's local box (the window band). */
  cabCanvas: { x0: -43, y0: -28, x1: 22, y1: -17 },
  /** The scanner strips' local box (rack and box, lifted). */
  scanCanvas: { x0: -36, y0: -43, x1: 9, y1: -28 },
  /**
   * The body's side profile (closed polygon, continuous; front at +x): a compact, tall electric
   * hatchback 84 px long — a short sloping bonnet, a long raked windscreen, a high roof that
   * curves down only at the very rear (a small spoiler lip), a near-vertical tailgate, bumpers
   * that wrap round. Point 0 is the rear bumper's face (car.ts reads its x as the rear end).
   */
  profile: [
    [-42, -8], [-41.8, -5.2], [-41.0, -3.0], [-39.6, -2],
    [39.6, -2], [41.0, -3.0], [41.8, -5.2], [42, -9.4], [41.7, -11.8], [41.0, -13.3], [40.0, -14.3],
    [36.0, -15.5], [30.0, -16.9], [25.0, -18.1], [22.4, -18.8],
    [12.0, -23.84], [5.6, -26.94], [3.0, -28.2], [0.6, -29.0], [-3, -29.3],
    [-12, -29.4], [-24, -29.1], [-33, -28.6], [-37.4, -28.1], [-39.4, -27.7], [-40.5, -26.9], [-40.9, -25.6],
    [-41.3, -21.0], [-41.7, -16.0], [-42, -12.0],
  ] as readonly Pt[],
  /**
   * The window band (dark tinted glass and the black pillars), one band from the windscreen
   * pillar to the tailgate: the windscreen edge, the roof edge (the white roof floats over it),
   * the tailgate edge, the belt line (`beltY`: rising to the rear, the kick under the quarter glass).
   */
  band: [
    [22.4, -18.8], [3.2, -28.1], [-6, -28.15], [-20, -28.0], [-32, -27.45], [-37, -26.85], [-39.6, -26.0],
    [-40.75, -24.6], [-41.05, -22.64], [-26, -20.54],
  ] as readonly Pt[],
  /** The windscreen line (the band's front edge, top → base): the windscreen sliver and the A-pillar lie along it. */
  screen: [[3.2, -28.1], [22.4, -18.8]] as readonly Pt[],
  /** Black pillars (continuous x ranges) between the side windows: B, C. */
  pillars: [[-6.6, -4.5], [-27.2, -25.4]] as ReadonlyArray<readonly [number, number]>,
  /** The thin black divider (x range) between the small front quarter glass and the front door glass. */
  quarter: [12.7, 13.6] as const,
  /** The D-pillar: the band behind this x (the tailgate glass seen edge-on) is black. */
  dPillar: -39.5,
  /** Wheel centres (continuous) and radius; the wheel strip's centre px (col = wheelX, row = wheelY). */
  wheelC: WX,
  wheelCY: WY,
  wheelX: [-27, 26] as const,
  wheelY: -7,
  wheelR: 6,
  /** The wheel arch cut (radius about the wheel centre) and its black plastic trim. */
  archR: 7.4,
  trimR: 8.6,
  /** Door shut lines (continuous x): the rear door's rear edge, the B seam, the front door's front edge. */
  seams: [-25.6, -5.5, 17.6] as const,
  /** The black side sill (rows) and the lower bumper trims. */
  sill: [-5, -2] as const,
  /** Where the black lower bumpers start (|x| beyond this, rows below `lowBumper`). */
  bumperX: 39.2,
  lowBumper: -6.6,
  /**
   * Red slanted bars: three on the front door, one stub on the front wing behind the front wheel
   * (the arch trim cuts it); bottom-left x, width, top / bottom y; the top leans forward `lean` px.
   */
  bars: { x: [-4.0, 2.9, 9.8, 18.4] as const, w: 3.7, top: -12.9, bottom: -5.2, lean: 0.8 },
  /** The bonnet's top face (seen a little from above): the profile's bonnet edge and the wing crease under it. */
  hood: [
    [22.4, -18.8], [25.0, -18.1], [30.0, -16.9], [36.0, -15.5], [39.4, -14.5], [37.4, -13.6], [30.0, -14.5], [23.4, -16.1],
  ] as readonly Pt[],
  /** Red slanted stripes across the bonnet face: the rear edge's x on the crease, width, forward lean to the edge. */
  stripes: { x: [24.0, 28.4, 32.8] as const, w: 2.6, lean: 1.4 },
  /** The three crosses (St Andrew's) stacked on the rear door: centres (continuous), half size. */
  crosses: { x: -9.5, y: [-16.5, -12.5, -8.5] as const, r: 1.2 },
  /** The small red city emblem on the rear wing over the rear arch (continuous centre). */
  emblem: [-36.3, -16.4] as Pt,
  /** Door handles (continuous left x, y): front, rear. */
  handles: [[-3.6, -17.6], [-24.4, -18.3]] as readonly Pt[],
  /** The black mirror (continuous centre) at the base of the front quarter glass. */
  mirror: [15.6, -19.4] as Pt,
  /** The parking permit behind the windscreen, seen through the quarter glass (continuous centre). */
  permit: [16.4, -19.9] as Pt,
  /** Lettering (frame of `ID.text`): the block's centre px (col, row), facing right. */
  text: [[6, -15], [-21, -17], [-1, -36]] as readonly Pt[],
  /** The `ID.text` frame of lettering block i on the car facing left (the rear door's block is set the other way). */
  textFlip: [0, 3, 2] as const,
  /** The lettering frames' logical sizes (odd: the anchor is the centre px); frame 3 has frame 1's. */
  textSize: [[31, 3], [19, 7], [5, 3]] as ReadonlyArray<readonly [number, number]>,
  /** Hazard lamps (the amber indicators, front and rear): the `blink` sprite's centre px. */
  lamps: [[40, -13], [-42, -19]] as readonly Pt[],
  /** Tyre smoke (the rear wheel, rev) and the bonnet (damage steam). */
  exhaust: [-27, -2] as Pt,
  bonnet: [30, -18] as Pt,
  /** Speech point (over the scanner box). */
  sayAt: [-8, -46] as Pt,
  /** The ticket printer's slot at the front end of the scanner box (rise 2). */
  printer: [7, -36] as Pt,
  /** The driver's head (1× cabin): the cap's top-left px. */
  driverAt: [-2, -26] as Pt,
  /** Hurtboxes (unflipped). */
  box: {
    /** The roof rack with the (lifted) scanner box. */
    scanner: { x: -26, y: -41, w: 34, h: 12 } as Rect,
    /** The car itself (shots ping on nothing: every part has HP). */
    body: { x: -44, y: -29, w: 88, h: 27 } as Rect,
  },
  /**
   * The ram's contact box (only while it drives across): the leading part of the body, from just
   * behind its middle to the front bumper, low enough to jump over. A hero at the rear bumper is
   * not hit when the car drives off away from him (the box moves away from him).
   */
  ram: { x: -6, y: -24, w: 47, h: 22 } as Rect,

  // ------------------------------------------------------------------------------- the scanner box
  /**
   * Scanner strip frames: 0 down, 1 lifted 1 px, 2 lifted 2 px, 3 lifted and scanning (the camera
   * windows glow faintly red). The big white box (`shell`, continuous, rise 0): a thick lid with
   * rounded corners (its top face seen a little from above) over a lower body whose sides slope in
   * towards the bottom, the ends slanted; it sits on a black mounting bar on two lift struts, and
   * the rack's feet stand on the roof.
   */
  scanner: {
    rise: [0, 1, 2, 2] as const,
    shell: [
      [-21.6, -39.4], [4.2, -39.4], [5.6, -39.0], [6.4, -38.0], [6.5, -37.1], [5.3, -34.4], [4.1, -33.6],
      [-20.2, -33.6], [-21.5, -34.4], [-23.0, -37.1], [-22.9, -38.0], [-22.3, -39.0],
    ] as readonly Pt[],
    /** The lid's top face (seen from above: v above this) and the lid's lower edge (the seam line). */
    lidTop: -38.2,
    shut: -37.1,
    /** Side camera windows (continuous boxes: x0, x1, y0, y1 at rise 0) on the lower body. */
    windows: [[-20.6, -12.8], [-11.6, -4.6]].map(([x0, x1]) => [x0, x1, -36.9, -34.0] as const) as ReadonlyArray<readonly [number, number, number, number]>,
    /** The front camera window on the slanted front end, the rear one on the rear end. */
    front: [[5.5, -36.8], [6.2, -36.8], [5.1, -34.3], [4.4, -34.3]] as readonly Pt[],
    rear: [[-22.2, -36.8], [-21.5, -36.8], [-20.5, -34.3], [-21.2, -34.3]] as readonly Pt[],
    /** The camera lens behind the middle window (continuous centre). */
    lens: [-8.9, -35.5] as Pt,
    /** The grey band with the number (x of its rear edge at the top and at the bottom; width). */
    band: [-1.9, -2.5, 3.6] as const,
    /** The rack: the mounting bar (continuous box x0, x1, y0, y1) and the feet (x ranges) down to the roof. */
    bar: [-19.8, 2.6, -33.6, -32.6] as const,
    feet: [[-19.4, -16.2], [-1.4, 1.8]] as ReadonlyArray<readonly [number, number]>,
    /** The feet stand on the roof: their lower end (continuous y). */
    feetTo: -29.0,
    /** The lift struts (x) between the bar and the box. */
    struts: [-14, -4] as const,
    /** Turn of the askew box (state 2) about its front foot (radians, clockwise on screen; − = the rear end drops). */
    askew: -0.075,
    pivot: [0.2, -33.6] as Pt,
  },

  // ------------------------------------------------------------------------------- numbers
  /** Part HP (NORMAL; the Boss base scales by difficulty and co-op). */
  hp: { scanner: 400, body: 900 },
  score: 10000,
  /** The arena (a camera lock about one view wide) and the car's two home spots in it (its middle this far from the edge). */
  arenaW: 384,
  homeIn: 54,
  intro: { speed: 2.4, brake: 14, rise: 60 },
  /**
   * SCAN LOCK: the reticle tracks (`track`), freezes (`freeze`), the printer fires; the strip flies
   * to `lift` px over the frozen spot and flutters straight down onto it at `dropV` px/tick.
   */
  scan: { track: 40, freeze: 24, follow: 3, speed: 5.5, gap: 8, rec: 50, lift: 40, dropV: 2.4 },
  /** RAM: rev (telegraph), the drive at `speed`, the brake skid and the recovery. */
  ramming: { tele: 24, speed: 3, accel: 0.6, brake: 10, rec: 50 },
  tow: {
    /** The talk before the truck comes, the clamp cap. */
    call: 30,
    clampMax: 3,
  },
  /** Ticks between attacks. */
  gap: 36,
  death: { airbag: 40, blasts: 3, flipVy: -3.4, smoke: 400 },
} as const;

/** Local x of a point for a facing (pixel columns mirror about the anchor column). */
export function mirrorX(x: number, facing: number): number {
  return facing < 0 ? -x : x;
}

// -------------------------------------------------------------------------------------------
// The tow truck (`ams-tow-truck`)
// -------------------------------------------------------------------------------------------

export const TRUCK = {
  /** Local box of the truck strip (inclusive). */
  canvas: { x0: -56, y0: -58, x1: 48, y1: 1 },
  /** Cab (behind the bonnet) and bonnet boxes; the bed deck; the crane base. */
  cab: { x: 16, y: -34, w: 21, h: 30 } as Rect,
  bonnet: { x: 36, y: -21, w: 11, h: 17 } as Rect,
  deck: { x: -48, y: -17, w: 65, h: 7 } as Rect,
  chassis: { x: -44, y: -10, w: 86, h: 5 } as Rect,
  window: [[24, -31], [33, -31], [35, -22], [24, -22]] as readonly Pt[],
  beacon: { x: 20, y: -37, w: 11, h: 3 } as Rect,
  craneBase: { x: -32, y: -25, w: 14, h: 8 } as Rect,
  boomFrom: [-25, -25] as Pt,
  /** The boom tip: the hook's cable hangs from here. */
  tip: [-52, -50] as Pt,
  wheelX: [-32, -18, 30] as const,
  wheelY: -7,
  /** Hurtbox (cab, bonnet and bed). */
  box: { x: -48, y: -34, w: 95, h: 33 } as Rect,
  hp: 300,
  score: 1000,
  /** Backing in (px/tick), the stop: the crane tip this far inside the view; driving off. */
  reverse: 1,
  stopIn: 120,
  leave: 1.6,
  /** Ticks at work before it leaves; the reversing beep every `beepEvery` ticks. */
  stay: 600,
  beepEvery: 40,
  /** The hook: cable length when lowered, lowering ticks, swing amplitude (rad) and period. */
  hook: { len: 18, lower: 30, amp: 0.6, grow: 40, period: 72 },
  /** Clamps dropped off the bed at these work ticks. */
  drops: [26, 64] as const,
  dropAt: [-8, -18] as Pt,
} as const;

/** The hook sprite: the anchor is the cable's end; the hot box below it. */
export const HOOK = {
  canvas: { x0: -4, y0: -1, x1: 4, y1: 11 },
  box: { x: -4, y: 2, w: 8, h: 8 } as Rect,
} as const;

// -------------------------------------------------------------------------------------------
// The wheel clamp (`ams-wheel-clamp`) and the status `clamped`
// -------------------------------------------------------------------------------------------

export const CLAMP = {
  canvas: { x0: -7, y0: -10, x1: 7, y1: 0 },
  /** Shootable box (taller than the art: a crouched shot reaches it). */
  box: { x: -8, y: -18, w: 16, h: 18 } as Rect,
  /** The open jaws: a player's feet stepping in here are clamped. */
  jaws: { x: -6, y: -6, w: 12, h: 6 } as Rect,
  /** Hits to break (an explosion or the knife breaks it at once). */
  hits: 2,
  score: 200,
  /** Armed wait on the ground, the hop's tell, the hop. */
  wait: 40,
  tell: 22,
  hopVy: -2.6,
  hopVx: 1.3,
  gravity: 0.16,
  /** Ticks the clamp lives (then it falls apart). */
  life: 1200,
  /** The status: ticks; a freed player cannot be clamped again for `grace` ticks. */
  ticks: 45,
  grace: 40,
} as const;

/** The clamp on a hero's boot (drawn by the status). */
export const CLAMP_FOOT = { canvas: { x0: -6, y0: -8, x1: 6, y1: 0 } } as const;

/** Small strips (centre anchors): the reticle, the ticket strip, the amber lamp glow. */
export const RETICLE_R = 9;
export const TICKET = { w: 15, h: 7, hit: { w: 10, h: 5 } } as const;
export const BLINK_R = 2;

/** The wreck strip (death): three roll frames and the car on its roof; a square canvas round the car's middle (`mid` px above the anchor). */
export const WRECK = { size: 100, mid: -14 } as const;
