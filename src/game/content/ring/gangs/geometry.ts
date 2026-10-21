/**
 * Geometry of content area `ring/gangs` (docs/design/ring.md §5.2, §5.4, §8): the parcel van, the
 * caravan and its tow car, shared by the art (art.ts: one density-generic drawer per strip, the
 * same shapes at 1×, 2× and 4×) and the entities (van.ts, caravan.ts: depth slabs, the hold, the
 * hostage seat and door, the crew's hands, the hitch).
 *
 * Local coordinates: the anchor (0, 0) is the road under the middle of the vehicle, x forward (the
 * vehicles face right: traffic drives right), y up is negative. Continuous coordinates: a logical
 * pixel (x, y) covers [x, x + 1) × [y, y + 1). The camera sees the right-hand side, so no plate is
 * in view (side view) and no maker badge anywhere (spec §0 row 13, §11).
 */
export type Pt = readonly [number, number];

/** Sprite prefixes (the tier-4 families of `ring-parcel-van` and `ring-caravan`, ring/art-def.ts). */
export const VAN_ART = 'ring/parcel-van';
export const CARAVAN_ART = 'ring/caravan';

/** Entity ids this area adds (the shared contract: `ring-parcel`; the rest under our own prefix). */
export const GANG_IDS = {
  parcel: 'ring-parcel',
  /** The caravan's tow car after the hitch snaps (it flees; drawn only). */
  towCar: 'ring-caravan-car',
  /** The NIET THUIS card the courier sticks on the wreck (the gloat; drawn only). */
  card: 'ring-parcel-card',
} as const;

// ---------------------------------------------------------------------------------------------
// The parcel van (`ring-parcel-van`): a high-roof delivery van in our own ZOEF! livery
// ---------------------------------------------------------------------------------------------

export const VAN = {
  len: 92,
  height: 42,
  /** The side profile (continuous polygon; arches not cut). Rear at −46, nose at +46. */
  profile: [
    [-46, -4],
    [-46.4, -39.4],
    [-44.6, -42],
    [18.6, -42],
    [23, -40.6],
    [31.4, -26],
    [39.4, -23.2],
    [44.6, -19.8],
    [46.4, -14],
    [46, -4],
    [44, -2.2],
    [-44, -2.2],
  ] as readonly Pt[],
  /** The cab's glass (the door window and the windscreen's edge). */
  band: [
    [15, -25.8],
    [15, -37.4],
    [22.4, -38.8],
    [29.4, -25.8],
  ] as readonly Pt[],
  belt: -25.8,
  sill: -7,
  /** Shut lines: the cab door's rear edge, the sliding door's rear edge. */
  seams: [13.6, -12.4] as readonly number[],
  handles: [
    [11, -22],
    [-14.6, -21.4],
  ] as readonly Pt[],
  wheels: [-30, 30] as readonly number[],
  /** Wheel radius (the `ring/car/wheel-m` strip). */
  wheelR: 6.5,
  head: [42.6, -20.6, 46.4, -16.8] as const,
  /** The tall rear lamp on the rear pillar and the high third brake light over the doors. */
  tail: [-46.4, -27, -44.6, -15] as const,
  third: [-45.4, -41.4, -39.6, -40] as const,
  mirror: [32.2, -25.4] as Pt,
  /** The cargo opening shown when the rear doors stand open (x0, y0, x1, y1). */
  hold: [-44.2, -38.2, -21, -7.2] as const,
  /** The near rear door: its hinge x and its width (it swings out behind the van). */
  hinge: -46.2,
  doorW: 11,
  /** Swing angles (deg) of the `rear` strip's frames (the last one: fully open). */
  swing: [28, 58, 86] as readonly number[],
  /** The crew's hip in the hold (kneeling, facing back) and the frame box of the crew strips. */
  crewHip: [-33, -14] as Pt,
  crewBox: [-45, -39, 25, 33] as const,
  /** Where a parcel leaves the thrower's hands and where the gunner's muzzle is (fallbacks). */
  hand: [-43, -34] as Pt,
  muzzle: [-45, -22] as Pt,
  /** The hostage's seat (feet x, floor lift) and its grille door's x range (the hurt slab). */
  seat: -33,
  seatLift: 7.4,
  door: [-45.5, -20.5] as const,
  /** The cab door the courier steps out of (the gloat). */
  cabDoor: 22,
  /** Dent decal spots (`ring/car/dent`): the first two at a third down, all at two thirds. */
  dents: [
    [-2, -17, 0],
    [-30, -24, 2],
    [-40, -12, 1],
    [24, -14, 1],
    [-18, -32, 0],
    [6, -12, 2],
  ] as ReadonlyArray<readonly [number, number, number]>,
  crack: [22, -31] as Pt,
} as const;

// ---------------------------------------------------------------------------------------------
// The caravan (`ring-caravan`) and its tow car
// ---------------------------------------------------------------------------------------------

export const CARAVAN = {
  len: 72,
  height: 39,
  /** The body (rear at −36, the rounded front at +36): a 1970s touring caravan. */
  profile: [
    [-36, -9],
    [-36.4, -33.6],
    [-35, -37.4],
    [-31.4, -39],
    [22, -39],
    [28.6, -37.8],
    [33, -34],
    [35.6, -28],
    [36.4, -20],
    [36, -12],
    [34.6, -9],
    [32, -7.6],
    [-34, -7.6],
  ] as readonly Pt[],
  /** One axle (the `ring/car/wheel-m` strip) under a wheel skirt. */
  wheel: -2,
  wheelR: 6.5,
  /** Windows: the rear side window, the door window, the wrap-round front window. */
  windows: [
    [-30.6, -32.4, -14.4, -22.4],
    [4.6, -31.4, 11.6, -23.4],
    [24.2, -33, 34.6, -22.6],
  ] as ReadonlyArray<readonly [number, number, number, number]>,
  /** The entry door (the camera side, as on real caravans) and its window. */
  doorX: [2, 14.4] as const,
  doorY: [-35, -9.4] as const,
  /** The stripes: a wide brown skirt band (the lettering in cream on it) and a thin orange line over it. */
  stripe: [-16.6, -10.4] as const,
  stripe2: [-18.2, -17.2] as const,
  /** The roof hatch (the gunner stands in it, facing back) and its lid hinged at the rear. */
  hatch: [-20, -8] as const,
  roof: -39,
  gunHip: [-14, -37.4] as Pt,
  /** Box of the gunner's strips (cropped at the roof line: the body hides his legs). */
  gunBox: [-34, -66, 34, 28] as const,
  /** The gunner's muzzle fallback (facing back) and the gun's height over the road. */
  muzzle: [-28, -50] as Pt,
  /** The drawbar: from the front to the coupling head (the hitch on the tow car's ball). */
  hitch: [50, -10] as Pt,
  /** The hostage: feet x and floor lift in the doorway; the grille's x range (the hurt slab). */
  seat: 8.2,
  seatLift: 9.4,
  door: [1, 15.4] as const,
  /** Tow car: the model, its middle relative to the caravan's middle. */
  carDx: 84,
  dents: [
    [-24, -14, 0],
    [20, -26, 2],
    [-6, -30, 1],
    [28, -14, 1],
    [-32, -24, 0],
    [16, -14, 2],
  ] as ReadonlyArray<readonly [number, number, number]>,
  crack: [-22, -28] as Pt,
} as const;

/** Tow car models and paint colours (existing `ring/car/<model>-<colour>` sprites, unchanged). */
export const TOW_CARS: ReadonlyArray<readonly [model: 'hatch' | 'estate', colour: string]> = [
  ['estate', 'steel'],
  ['hatch', 'red'],
  ['estate', 'navy'],
  ['hatch', 'gold'],
  ['estate', 'black'],
  ['hatch', 'green'],
];
/** Half lengths of those car models (traffic/geometry.ts) and their wheel x (wheel `s`). */
export const TOW_CAR_HALF: Readonly<Record<'hatch' | 'estate', number>> = { hatch: 33, estate: 42 };
export const TOW_CAR_WHEELS: Readonly<Record<'hatch' | 'estate', readonly number[]>> = { hatch: [-21, 21], estate: [-27, 28] };

// ---------------------------------------------------------------------------------------------
// The parcel and the card
// ---------------------------------------------------------------------------------------------

/** A parcel: a cardboard box (the frame box is centred on the box, the anchor at its bottom). */
export const PARCEL = {
  w: 11,
  h: 8,
  /** Frame canvas (square, the anchor at the middle of its bottom row). */
  frame: 15,
} as const;

/** The NIET THUIS card (the anchor in its middle). */
export const CARD = { w: 23, h: 15 } as const;
