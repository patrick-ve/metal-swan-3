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
 * the lower doors, red stripes on the bonnet, `PARKEERCONTROLE`, `Gemeente Amsterdam` with the
 * three crosses), one band of dark tinted glass with black pillars, a big white scanner box on a
 * black roof rack, silver alloy wheels. 88 px long, the body 28 px tall, 38 px with the scanner.
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
  /** Death: three roll frames (45°, 90°, 135°) and the car on its roof. */
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
   * The lettering, NEVER mirrored (3 frames, each anchored on its block's centre): 0
   * `PARKEERCONTROLE` (front door), 1 `Gemeente Amsterdam` (rear door), 2 the scanner's `24`.
   * At 1× a hint of small print; readable at 2× and 4×.
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

/** The belt line (the lower edge of the window band) at x: it rises towards the rear. */
export function beltY(x: number): number {
  return -18.9 - (20.8 - x) * 0.04;
}

export const SCAN = {
  // ------------------------------------------------------------------------------- the car
  /** The body strip's local box (inclusive pixel columns / rows). */
  canvas: { x0: -45, y0: -30, x1: 45, y1: 0 },
  /** The cabin strip's local box (the window band). */
  cabCanvas: { x0: -43, y0: -28, x1: 22, y1: -17 },
  /** The scanner strips' local box (rack and box, lifted). */
  scanCanvas: { x0: -36, y0: -43, x1: 9, y1: -28 },
  /** The body's side profile (closed polygon, continuous; front at +x). */
  profile: [
    [-42, -2], [-43.4, -3.2], [-44, -6], [-43.8, -10], [-43.3, -19.8], [-42.6, -23], [-40.8, -25.9],
    [-38.2, -27.5], [-32, -28.1], [-12, -28.4], [2, -28.3], [6.4, -27.6], [9, -26.2], [21.6, -19.4],
    [24.4, -18.9], [34.5, -17.3], [39.6, -15.8], [42.4, -13.6], [43.6, -10.6], [44, -6], [43.4, -3.2],
    [42, -2],
  ] as readonly Pt[],
  /** The window band (dark tinted glass and the black pillars): the windscreen edge, the roof edge, the belt line. */
  band: [
    [20.8, -18.9], [8.0, -25.7], [6.0, -26.5], [-36.4, -26.5], [-39.0, -25.6], [-40.8, -23.6], [-41.6, -21.4],
  ] as readonly Pt[],
  /** The windscreen line (the band's front edge): the windscreen sliver and the A-pillar lie along it. */
  screen: [[6.0, -26.5], [20.8, -18.9]] as readonly Pt[],
  /** Black pillars (continuous x ranges) between the side windows: B, C. */
  pillars: [[-7.5, -5.5], [-26.5, -25]] as ReadonlyArray<readonly [number, number]>,
  /** Wheel centres (continuous) and radius; the wheel strip's centre px (col = wheelX, row = wheelY). */
  wheelC: WX,
  wheelCY: WY,
  wheelX: [-27, 26] as const,
  wheelY: -7,
  wheelR: 6,
  /** The wheel arch cut (radius about the wheel centre) and its black plastic trim (1 px). */
  archR: 8.2,
  trimR: 9.2,
  /** Door shut lines (continuous x): the rear door's rear edge, the B seam, the front door's front edge. */
  seams: [-25.5, -6.5, 16.5] as const,
  /** The black side sill (rows) and the lower bumper trims. */
  sill: [-5, -2] as const,
  /** Red slanted bars on the lower doors: bottom-left x, width, top / bottom y; the top leans forward `lean` px. */
  bars: { x: [-3, 3.5, 10, 17.4] as const, w: 3, top: -13, bottom: -5, lean: 1 },
  /** Red slanted stripes on the bonnet: [bottom x, top x] of each stripe's rear edge; width. */
  stripes: { x: [[25.5, 28], [30.5, 33], [35.2, 37.4]] as ReadonlyArray<readonly [number, number]>, w: 2.6, top: -19, bottom: -15.2 },
  /** The three crosses (St Andrew's) stacked on the rear door: centres (continuous), half size. */
  crosses: { x: -9.3, y: [-18.4, -14.6, -10.8] as const, r: 1.35 },
  /** The small red city emblem near the rear wheel arch (continuous centre). */
  emblem: [-37.5, -16] as Pt,
  /** Door handles (continuous left x, y): front, rear. */
  handles: [[-3.5, -18.4], [-25, -19.4]] as readonly Pt[],
  /** The mirror (continuous centre) at the foot of the A-pillar. */
  mirror: [16.6, -19.6] as Pt,
  /** The parking permit behind the windscreen (continuous centre). */
  permit: [17.6, -19.9] as Pt,
  /** Lettering (frame of `ID.text`): the block's centre px (col, row), facing right. */
  text: [[5, -15], [-20, -16], [-3, -36]] as readonly Pt[],
  /** The lettering frames' logical sizes (odd: the anchor is the centre px). */
  textSize: [[31, 3], [19, 7], [5, 3]] as ReadonlyArray<readonly [number, number]>,
  /** Hazard lamps (the amber indicators, front and rear): the `blink` sprite's centre px. */
  lamps: [[41, -14], [-43, -17]] as readonly Pt[],
  /** Tyre smoke (the rear wheel, rev) and the bonnet (damage steam). */
  exhaust: [-27, -2] as Pt,
  bonnet: [30, -19] as Pt,
  /** Speech point (over the scanner box). */
  sayAt: [-8, -46] as Pt,
  /** The ticket printer's slot at the front end of the scanner box (rise 2). */
  printer: [7, -36] as Pt,
  /** The driver's head (1× cabin): the cap's top-left px. */
  driverAt: [2, -26] as Pt,
  /** Hurtboxes (unflipped). */
  box: {
    /** The roof rack with the (lifted) scanner box. */
    scanner: { x: -34, y: -41, w: 42, h: 12 } as Rect,
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
   * windows glow). The box (`shell`, continuous, rise 0) sits on two struts on the rack bar; the
   * rack's feet stand on the roof.
   */
  scanner: {
    rise: [0, 1, 2, 2] as const,
    shell: [
      [-31, -38], [4, -38], [6.2, -37.1], [7.4, -35.4], [7.2, -33.4], [5.8, -32], [-31.6, -32], [-33, -33.2],
      [-33.5, -35.4], [-32.7, -37.3],
    ] as readonly Pt[],
    /** Side camera windows (continuous boxes: x0, x1, y0, y1 at rise 0) and the front one on the slanted end. */
    windows: [[-29.5, -21.5, -36.6, -34], [-20.5, -12, -36.6, -34]] as ReadonlyArray<readonly [number, number, number, number]>,
    front: [[4.8, -37.4], [6.8, -36.2], [7.2, -34.2], [5.8, -34.2]] as readonly Pt[],
    /** The slanted seam behind the front end (top x, bottom x) and the shut line row. */
    seam: [2.6, 3.6] as const,
    shut: -33,
    /** The rack: the bar (continuous box) and the feet (x ranges) down to the roof. */
    bar: [-31, 3, -32, -30] as const,
    feet: [[-28, -26], [-1.5, 0.5]] as ReadonlyArray<readonly [number, number]>,
    /** The lift struts (x) between the bar and the box. */
    struts: [-24, -6] as const,
    /** Turn of the askew box (state 2) about its rear foot (radians, front up). */
    askew: -0.07,
    pivot: [-27, -31] as Pt,
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
