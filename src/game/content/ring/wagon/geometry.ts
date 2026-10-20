/**
 * The ring wagon (docs/design/ring.md §3) — shared numbers and sprite ids of the two squad wagons
 * (the art in art.ts / art-hd.ts and the logic in src/game/ring/wagon.ts read the same numbers).
 *
 * Local coordinates of the wagon drawn FACING RIGHT (its front at +x, the passenger side towards
 * the camera): the anchor (0, 0) is the road point under its middle; y grows down. Shapes are in
 * CONTINUOUS logical coordinates: pixel (x, y) covers [x, x + 1) × [y, y + 1) and is inside a
 * shape when its centre (x + 0.5, y + 0.5) is.
 *
 * The car: the boxy 1990s Swedish estate (a likeness, no maker badge): a flat upright nose, a long
 * flat roof with rails, a low straight window line with a large glass area and thin black
 * pillars, a nearly upright tailgate, the tall tail lights up the whole rear pillar, dark grey
 * bumpers and a dark rubbing strip. 93 px long, 28 px tall over the road (the roof gear adds
 * about 6), wheelbase 52, wheels r 6.6.
 *
 * The two liveries (the squad's two real rally estates, spec §3; likeness only):
 * - 'green' (P2 "safari"): bottle green with dark green / black camouflage, silver five-spoke
 *   alloys, a silver roof rack with two round spot lamps at the front and a spare tyre lying flat
 *   at the rear (and a red jerrycan); right side `ARTISANAL` over `GRAPE` (yellow) with a pink
 *   grape bunch, left side `MAJOR` over `COCKTAILS` (pink) with a cocktail glass.
 * - 'white' (1P and P1 "rozzers"): white with the orange / yellow / orange waist band, `619` on the
 *   front wing, `ROZZERS` on a dark-blue box on the front door (both sides), silver wheel covers,
 *   black roof rails and a black tubular push bar with two round black spot lamps.
 */

export type Pt = readonly [number, number];

/** The two wagons (the order of their sprite registration). */
export const LIVERIES = ['green', 'white'] as const;
export type Livery = (typeof LIVERIES)[number];

/**
 * The livery of a player slot (spec §3, the user's decision of 2026-10-20): 1P and P1 drive the
 * WHITE wagon, P2 the GREEN one (a P2 who joins mid-level drives in with the green wagon).
 */
export function liveryOf(slot: number): Livery {
  return slot === 1 ? 'green' : 'white';
}

/** Sprite prefix of the wagon (always resident on the ring: art-def.ts `RING_PRELOAD_FIRST`). */
export const WAGON_ART = 'ring/wagon';

/**
 * Body poses (the frames of every `body-<s>` strip and of `cabin` 0–4):
 * level (cruise), up (accelerate: the nose rises), down (brake: the nose dips), far / near (a lane
 * change toward the far / near lanes: the car yaws a little and shows a sliver of its rear / front).
 */
export const POSES = ['level', 'up', 'down', 'far', 'near'] as const;
export type BodyPose = (typeof POSES)[number];
export const POSE: Readonly<Record<BodyPose, number>> = { level: 0, up: 1, down: 2, far: 3, near: 4 };
/** The cabin strip's frame for the car facing left (the boarding scene). */
export const CABIN_LEFT = 5;

/** Damage states of the body (dents → broken glass → smoke → fire: smoke and fire are fx on state 3). */
export const BODY_STATES = [0, 1, 2, 3] as const;
export type BodyState = (typeof BODY_STATES)[number];

/** Spin frames: 8 yaw steps of 45° (0 = the right side, facing right; 2 = the nose at the camera; 4 = the left side). */
export const SPIN_FRAMES = 8;
/** The spin strips exist for the clean body (the boarding turn) and the wreck. */
export const SPIN_STATES = [0, 3] as const;

const ids = (l: Livery) => ({
  body: [0, 1, 2, 3].map((s) => `${WAGON_ART}/${l}/body-${s}`) as readonly string[],
  /** The left side, never mirrored (the lettering reads): frames 0 clean, 1 wrecked. */
  left: `${WAGON_ART}/${l}/left`,
  spin: { 0: `${WAGON_ART}/${l}/spin-0`, 3: `${WAGON_ART}/${l}/spin-3` } as Readonly<Record<0 | 3, string>>,
  wheel: `${WAGON_ART}/wheel-${l === 'green' ? 'alloy' : 'cover'}`,
});

/** Sprite ids (hoisted: no template strings in the per-tick draw). */
export const ID = {
  green: ids('green'),
  white: ids('white'),
  /** The interior and the wheel wells behind the body's glass and arch holes: poses 0–4, 5 = facing left. */
  cabin: `${WAGON_ART}/cabin`,
  /** Fire on the bonnet (the last damage state; 4 frames, bottom-centre anchor). */
  flame: `${WAGON_ART}/flame`,
  /** The lobbed grenade's blast ring on the road (4 frames, centre anchor). */
  ring: `${WAGON_ART}/blast-ring`,
} as const;

// ---------------------------------------------------------------------------------------------
// The body
// ---------------------------------------------------------------------------------------------

export const CAR = {
  /** Half length (body, without the push bar) and half width (for the turned views). */
  halfL: 46.4,
  /** Body width (logical px, 1.76 m) and the roof width (the glass leans in). */
  width: 34,
  roofWidth: 29,
  /** Side profile (the arches not cut), clockwise from the rear bumper's foot. */
  profile: [
    [-45.6, -3.2],
    [-46.3, -4.4],
    [-46.4, -10.8],
    [-46.0, -11.4],
    [-45.4, -23.5],
    [-45.0, -26.4],
    [-44.0, -27.5],
    [10.6, -27.7],
    [12.2, -27.1],
    [20.6, -18.0],
    [22.5, -17.8],
    [44.6, -16.6],
    [45.8, -16.0],
    [46.0, -11.4],
    [46.6, -10.8],
    [46.7, -4.6],
    [45.8, -3.2],
  ] as readonly Pt[],
  /** Wheel centres (x), their centre y, the tyre and rim radii, the arch cut radius. */
  wheelX: [-24.6, 27.4] as readonly number[],
  wheelY: -6.6,
  tyreR: 6.6,
  rimR: 4.1,
  archR: 7.6,
  /** The glass band (DLO): the belt line, the roof's inner edge, the A-pillar's rear edge. */
  band: [
    [19.0, -17.3],
    [11.4, -25.8],
    [10.2, -26.5],
    [-42.4, -26.5],
    [-42.4, -17.3],
  ] as readonly Pt[],
  beltY: -17.3,
  glassTop: -26.5,
  /** The windscreen line (its foot and top) for the A-pillar. */
  screen: [
    [20.6, -18.0],
    [12.2, -27.1],
  ] as readonly Pt[],
  /** Black pillars: B (between the doors) and C (the rear door's frame); the rear quarter ends at the D-pillar. */
  pillarB: [-0.3, 1.5] as readonly number[],
  pillarC: [-22.2, -20.6] as readonly number[],
  dPillar: -42.4,
  /** Door shut lines: the front door's front edge, B, the rear door's rear edge (to the arch). */
  seams: [19.5, 0.6, -21.4] as readonly number[],
  seamTop: -17.3,
  seamBottom: [-3.6, -3.6, -13.4] as readonly number[],
  /** The rubbing strip and the bumpers' top / bottom, the bumpers' side pieces. */
  strip: [-11.2, -10.0] as readonly number[],
  bumperTop: -11.2,
  bumperFront: 38.8,
  bumperRear: -36.8,
  /** The corner light (amber indicator, then the headlight's glass at the corner). */
  corner: { x0: 43.6, x1: 45.4, x2: 46.1, y0: -15.6, y1: -12.2 },
  /** The tall tail light up the rear pillar (x0 the tailgate side … x1), with its lower bands. */
  tail: { x0: -46.2, x1: -43.4, y0: -26.4, y1: -11.4, reverse: -15.4, amber: -13.4 },
  /** The black mirror on the front door's top corner. */
  mirror: { x0: 16.0, x1: 19.6, y0: -20.6, y1: -17.8 },
  /** Door handles (front, rear): x0, x1, y. */
  handles: [
    [6.2, 8.6, -16.0],
    [-16.4, -14.0, -16.0],
  ] as readonly (readonly [number, number, number])[],
  /** The fuel flap (right side only). */
  fuel: [-35.5, -15.2, 1.0] as readonly number[],
  /** Roof rails: the tube and the two feet. */
  rail: { x0: -41.0, x1: 8.0, y0: -29.0, y1: -28.0, feet: [[6.6, 8.6], [-41.0, -39.0]] as readonly (readonly [number, number])[] },
} as const;

/** The green wagon's roof gear (silver rack on the rails, spot lamps, the spare tyre, a jerrycan). */
export const RACK = {
  /** The load bar along the rack and the clamps down to the rails. */
  bar: { x0: -38.0, x1: 4.6, y0: -31.0, y1: -30.2 },
  clamps: [2.0, -16.0, -34.0] as readonly number[],
  /** The two round spot lamps at the front (near, far): centre and radius. */
  lamps: [
    [6.6, -33.0, 2.4],
    [3.6, -33.5, 2.3],
  ] as readonly (readonly [number, number, number])[],
  /** The spare tyre lying flat (x0, x1, y0, y1) and the red jerrycan. */
  tyre: [-38.0, -24.6, -33.6, -31.0] as readonly number[],
  can: [-23.4, -20.0, -34.4, -31.0] as readonly number[],
} as const;

/** The white wagon's push bar on the nose and its two black spot lamps (side view: the near one). */
export const BAR = {
  /** The upright tube (x0, x1) from the foot to the top bend. */
  x0: 46.9,
  x1: 48.3,
  y0: -17.0,
  y1: -3.6,
  /** The near lamp on the bar's cross tube: centre and radius. */
  lamp: [48.4, -13.8, 2.4] as readonly number[],
} as const;

/** The white wagon's waist band (orange / yellow / orange) and its lettering boxes. */
export const BAND = {
  x0: -43.4,
  x1: 43.6,
  /** Top of the band, the yellow stripe's top and bottom, the band's bottom. */
  y: [-16.6, -14.8, -13.7, -12.6] as readonly number[],
  /** `ROZZERS` on a dark-blue box on the front door (x0, x1, y0, y1). */
  box: [5.0, 18.6, -17.0, -12.2] as readonly number[],
  /** `619` on the band at the rear of the front wing (x0, x1, y0, y1). */
  num: [20.4, 26.8, -16.9, -12.9] as readonly number[],
} as const;

/** The green wagon's lettering blocks (x0, x1, y0, y1) on the right and left sides. */
export const LETTERS = {
  /** Right side (facing right): ARTISANAL above the rubbing strip, GRAPE below, the grape bunch. */
  artisanal: [-21.6, 13.4, -17.0, -12.0] as readonly number[],
  grape: [-7.2, 11.8, -9.0, -4.0] as readonly number[],
  grapeIcon: [15.0, 18.6, -17.0, -11.6] as readonly number[],
  /**
   * Left side, in the LEFT-side frame's own screen coordinates (the car faces left: x grows toward
   * its rear): MAJOR (big) on the front door, the cocktail glass after it, COCKTAILS below.
   */
  major: [-17.6, 3.4, -17.1, -11.4] as readonly number[],
  glass: [4.4, 7.8, -17.4, -11.2] as readonly number[],
  cocktails: [-19.0, 16.0, -9.0, -4.0] as readonly number[],
} as const;

/** Body frame canvas (local, inclusive), shared by both liveries and every pose. */
export const BODY_CANVAS = { x0: -50, y0: -37, x1: 51, y1: -2 } as const;
/** Cabin frame canvas (the interior and the wheel wells). */
export const CABIN_CANVAS = { x0: -47, y0: -28, x1: 47, y1: -1 } as const;
/** Spin frame canvas (the wheels included). */
export const SPIN_CANVAS = { x0: -51, y0: -37, x1: 51, y1: 0 } as const;
/** Wheel frame half size (centre anchor). */
export const WHEEL_HALF = 7;

// ---------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------

/**
 * The playing hero sits in the near REAR door window: his hip on the sill at (WINDOW_X, belt),
 * his torso above the roof line (he hangs out of the window and aims 8 ways). The driver sits
 * behind the front door glass (the far side when facing right; the near side when facing left).
 */
export const SEAT = {
  /** The hero's hip (the torso strips are anchored at the hip). */
  heroX: -13,
  heroY: -17,
  /**
   * The driver's hip (the ride strips are anchored at the hip): his face, from the eyes to the chin,
   * and his shoulders fill the front glass (fix 2026-10-21: at −7 the glass showed only his hair
   * and one eye).
   */
  driverX: 9,
  driverY: -10,
  /** The driver's glass (clip rect: x0, x1, y0, y1) — only what the front door glass shows. */
  driverClip: [1.6, 18.6, -26.5, -17.3] as readonly number[],
  /** The steering wheel's rim (centre, radii) and the gloved hands on it. */
  wheel: [14.2, -18.2, 1.1, 2.6] as readonly number[],
} as const;

/** Shot lift of a torso muzzle: the muzzle's height above the road (hip at the sill). */
export function muzzleLift(muzzleY: number): number {
  return -(SEAT.heroY + muzzleY);
}
