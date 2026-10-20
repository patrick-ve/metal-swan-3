/**
 * Civilian cars of the ring (`ring-car`, docs/design/ring.md §8): the geometry of the six models,
 * shared by the art (art.ts: one density-generic drawer, the same shapes at 1×, 2× and 4×) and
 * the entity (car.ts: the depth slab, the wheels, the dent spots, the hostage seat of the van).
 *
 * Local coordinates: the anchor (0, 0) is the road under the middle of the car, x forward (the
 * cars always face right: traffic drives right), y up is negative. Continuous coordinates: a
 * logical pixel (x, y) covers [x, x + 1) × [y, y + 1).
 *
 * The camera sees the right-hand side of every car (the passenger side), so there are no plates
 * in view and no maker badge anywhere (spec §0 row 13, §11).
 */
import type { RingCarModel } from '../../../ring/ids';

export type Pt = readonly [number, number];

/** Wheel sizes (strip `ring/car/wheel-<size>`, centre anchor). */
export type WheelSize = 's' | 'm' | 'l';
export const WHEEL_R: Readonly<Record<WheelSize, number>> = { s: 5.5, m: 6.5, l: 7.5 };

export interface CarGeo {
  readonly model: RingCarModel;
  /** Body length (the depth slab's x range is ±len/2) and the top of the body. */
  readonly len: number;
  readonly height: number;
  /** The side profile (continuous polygon, arches not cut). */
  readonly profile: readonly Pt[];
  /** A second body block (the box truck's cab; the camper's alcove is in the profile). */
  readonly cab?: readonly Pt[];
  /** The window band (glass + pillars), inside the profile. */
  readonly band: readonly Pt[];
  /** Pillars across the band: [x0, x1). */
  readonly pillars: ReadonlyArray<readonly [number, number]>;
  /** The belt line (bottom of the glass) and the sill (bottom of the doors). */
  readonly belt: number;
  readonly sill: number;
  /** Door shut lines (x). */
  readonly seams: readonly number[];
  /** Door handles (x, y). */
  readonly handles: readonly Pt[];
  /** Wheel centres (x) and the wheel size. */
  readonly wheels: readonly number[];
  readonly wheel: WheelSize;
  /** Headlight and tail light boxes [x0, y0, x1, y1]. */
  readonly head: readonly [number, number, number, number];
  readonly tail: readonly [number, number, number, number];
  /** The side mirror (x, y) at the A-pillar. */
  readonly mirror: Pt;
  /** Dent decal spots (`ring/car/dent`): state 1 shows the first two, state 2 all (spot, frame). */
  readonly dents: ReadonlyArray<readonly [number, number, number]>;
  /** The glass crack of state 2 (on the band). */
  readonly crack: Pt;
  /** Paint colours (ramp names; `colour` param index → list[index % n]). */
  readonly colours: readonly string[];
}

/** The colour names a `colour` param may give (any index works: index mod the model's list). */
export const CAR_COLOURS = ['red', 'gable', 'steel', 'navy', 'black', 'gold', 'green', 'sky', 'teal', 'orange', 'purple'] as const;

const HATCH: CarGeo = {
  model: 'hatch',
  len: 66,
  height: 24,
  profile: [[-33, -4], [-33.4, -12], [-32.6, -16.5], [-30.6, -20.6], [-27.5, -23.4], [-24, -24], [5, -24], [8, -23], [17, -15.6], [29, -13.4], [32.4, -11.6], [33.4, -8.4], [33, -4], [31, -2.2], [-31, -2.2]],
  band: [[-29.4, -15.8], [-28.4, -19.6], [-25.8, -22.4], [-23.4, -22.8], [4.6, -22.8], [7.2, -21.9], [14.6, -15.8]],
  pillars: [[-23, -19.6], [-3.4, -1.6]],
  belt: -15.6,
  sill: -6.4,
  seams: [-3.2, 15.6],
  handles: [[-6.4, -13.4]],
  wheels: [-21, 21],
  wheel: 's',
  head: [30.6, -13, 33.4, -10.4],
  tail: [-33.4, -17.2, -31.4, -12.2],
  mirror: [13.4, -16.6],
  dents: [[6, -9.5, 0], [-13, -11, 2], [-27, -9, 1], [25, -10, 1], [-8, -8, 0], [18, -8.5, 2]],
  crack: [-12, -19],
  colours: ['red', 'gable', 'steel', 'navy', 'gold', 'green', 'sky'],
};

const ESTATE: CarGeo = {
  model: 'estate',
  len: 84,
  height: 26,
  profile: [[-42, -4], [-42.4, -13], [-41.4, -18], [-39, -22.6], [-35.5, -25.4], [-32, -26], [10, -26], [13, -25], [23, -16.8], [37.6, -14.4], [41.4, -12.4], [42.4, -8.8], [42, -4], [40, -2.2], [-40, -2.2]],
  band: [[-38.4, -17.4], [-37, -21.6], [-34, -24.4], [-31.4, -24.8], [9.6, -24.8], [12.2, -23.9], [20.6, -17.4]],
  pillars: [[-30.6, -27.8], [-9.4, -7.6], [-31.4, -30.6]],
  belt: -17.2,
  sill: -6.8,
  seams: [-29.6, -8.6, 15.6],
  handles: [[-12, -15], [11, -15]],
  wheels: [-27, 28],
  wheel: 's',
  head: [38.6, -14, 42.4, -11.2],
  tail: [-42.4, -19, -40.2, -13.4],
  mirror: [19.6, -18.2],
  dents: [[2, -10.5, 0], [-20, -11, 2], [-36, -10, 1], [33, -11, 1], [-14, -8.5, 0], [24, -9, 2]],
  crack: [-20, -21],
  colours: ['steel', 'black', 'navy', 'red', 'sky'],
};

const VAN: CarGeo = {
  model: 'van',
  len: 88,
  height: 40,
  profile: [[-44, -4], [-44.4, -37.6], [-42.6, -40], [21, -40], [25.4, -38.4], [32.6, -24.4], [40.4, -20.8], [43.6, -17.6], [44.4, -12], [44, -4], [42, -2.2], [-42, -2.2]],
  band: [[14.4, -24.2], [14.4, -34.4], [24.6, -36.4], [30.8, -24.2]],
  pillars: [[14.4, 15.8]],
  belt: -24.2,
  sill: -6.8,
  seams: [-43.2, 13.8, -9.6, -24.4],
  handles: [[11.4, -21.6], [-11.8, -20]],
  wheels: [-29, 29],
  wheel: 'm',
  head: [41, -19.8, 44.4, -16.4],
  tail: [-44.4, -24, -42.4, -15],
  mirror: [31.6, -24.8],
  dents: [[-2, -17, 0], [-30, -22, 2], [-38, -12, 1], [24, -13, 1], [-18, -30, 0], [8, -12, 2]],
  crack: [22, -30],
  colours: ['gable', 'steel', 'navy'],
};

const TAXI: CarGeo = {
  model: 'taxi',
  len: 80,
  height: 31,
  profile: [[-40, -4], [-40.4, -12.6], [-38.4, -16.6], [-27.6, -18], [-21, -24.4], [-17, -25.4], [7, -25.4], [10, -24.4], [20, -16.6], [35.6, -14.2], [39.6, -12.2], [40.4, -8.6], [40, -4], [38, -2.2], [-38, -2.2]],
  band: [[-23, -17.8], [-19.4, -22.8], [-16.4, -24.2], [6.6, -24.2], [9.2, -23.3], [17.4, -17.2]],
  pillars: [[-19.6, -17.6], [-4.4, -2.6]],
  belt: -17,
  sill: -6.8,
  seams: [-20.6, -3.8, 14.6],
  handles: [[-7, -15], [11, -15]],
  wheels: [-25, 26],
  wheel: 's',
  head: [36.6, -13.8, 40.4, -11],
  tail: [-40.4, -16, -38.4, -12],
  mirror: [16.6, -18],
  dents: [[2, -10.5, 0], [-15, -11, 2], [-33, -10, 1], [30, -10.5, 1], [-9, -8.5, 0], [21, -9, 2]],
  crack: [-9, -21],
  colours: ['black'],
};

const CAMPER: CarGeo = {
  model: 'camper',
  len: 110,
  height: 46,
  profile: [[-55, -5], [-55.4, -43], [-53, -46], [30, -46], [38.6, -44.6], [41.4, -41], [41, -36.6], [36.4, -34], [38.6, -32.4], [45, -22.4], [51.4, -19.6], [54.6, -16], [55.4, -11], [55, -4], [53, -2.2], [-53, -2.2]],
  band: [[31.2, -22.4], [31.2, -30.4], [38.2, -31.2], [43.6, -22.4]],
  pillars: [[31.2, 32.4]],
  belt: -22.4,
  sill: -7.4,
  seams: [30.6, 17.2, 4.6],
  handles: [[28.4, -19.6], [14.8, -21.6]],
  wheels: [-31, 37],
  wheel: 'm',
  head: [52, -18.4, 55.4, -15],
  tail: [-55.4, -22, -53.4, -12],
  mirror: [44.6, -24.4],
  dents: [[-10, -12, 0], [-38, -14, 2], [-50, -26, 1], [44, -12, 1], [20, -13, 0], [-24, -11, 2]],
  crack: [38, -27],
  colours: ['red', 'navy', 'green'],
};

const BOX_TRUCK: CarGeo = {
  model: 'box-truck',
  len: 116,
  height: 50,
  // The cargo box (the profile) and the cab in front of it (cab).
  profile: [[-58, -9], [-58.4, -48], [-56.6, -50], [21.4, -50], [22.6, -48.4], [22.6, -9]],
  cab: [[24, -5], [24, -35.4], [26, -37.4], [44.6, -37.4], [48.6, -35], [54.4, -22], [57.6, -18.6], [58.4, -12], [58, -5], [56, -3], [26, -3]],
  band: [[38.6, -21.4], [38.6, -33.4], [46.6, -33.6], [52.2, -21.4]],
  pillars: [[38.6, 39.8]],
  belt: -21.4,
  sill: -7.6,
  seams: [37.6],
  handles: [[35.2, -18.6]],
  wheels: [-38, 42],
  wheel: 'l',
  head: [55.2, -17.6, 58.4, -14],
  tail: [-58.4, -15, -56.4, -9.4],
  mirror: [54, -26],
  dents: [[-10, -24, 0], [-40, -30, 2], [-52, -18, 1], [8, -16, 1], [-24, -40, 0], [48, -12, 2]],
  crack: [46, -28],
  colours: ['red', 'navy', 'gable'],
};

export const CAR_GEO: Readonly<Record<RingCarModel, CarGeo>> = {
  hatch: HATCH,
  estate: ESTATE,
  van: VAN,
  taxi: TAXI,
  camper: CAMPER,
  'box-truck': BOX_TRUCK,
};

/** The paint colour of a model for a `colour` param (an index, a name, or nothing). */
export function carColour(model: RingCarModel, colour: unknown): string {
  const list = CAR_GEO[model].colours;
  if (typeof colour === 'number' && Number.isFinite(colour)) return list[((Math.floor(colour) % list.length) + list.length) % list.length];
  if (typeof colour === 'string' && list.includes(colour)) return colour;
  if (typeof colour === 'string' && colour === 'white' && list.includes('gable')) return 'gable';
  return list[0];
}

/** Sprite id of a car body. */
export function carSprite(model: RingCarModel, colour: string): string {
  return `ring/car/${model}-${colour}`;
}

/**
 * The hostage van (params `hostage: true`): the rear doors stand open (the near one swung out
 * behind the van), the dark cargo hold shows, and a steel cage door closes the hold's opening.
 * The tied hostage sits on the hold floor (`seat`, lifted `seatLift`); the door's depth slab
 * covers `door` (x0, x1): shots there hit the cage door, not the van's cover.
 */
export const HOSTAGE_VAN = {
  /** The cargo opening in the side (x0, y0, x1, y1). */
  hold: [-43.2, -36.4, -21.6, -6.4] as const,
  /** Where the hostage's feet rest (x) and how high the floor is. */
  seat: -33,
  seatLift: 6.4,
  /** The cage door's x range (its hurt slab) and its look box. */
  door: [-45.5, -21] as const,
} as const;

/** All models (the `model` param). */
export const CAR_MODELS = Object.keys(CAR_GEO) as RingCarModel[];
