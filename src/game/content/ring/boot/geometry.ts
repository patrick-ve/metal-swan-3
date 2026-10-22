/**
 * The pink boat's geometry (docs/design/ring.md §R.7): every number the boat's logic and its art
 * share, in LOGICAL px relative to the boat's anchor = the road under the trailer's middle on the
 * heroes' feet line (`RF_GROUND`). The boat faces LEFT (the bow toward the heroes) and is drawn so
 * natively: never mirrored (its name on the hull reads). `Boss.facing` stays 1, the boxes are as
 * drawn.
 *
 * The design (our own; never the real protest boat's look or name): a chunky Dutch flat-bottomed
 * sailing boat with a bluff round bow, a leeboard on its side, a small deckhouse aft, the mainsail
 * furled on its boom, painted PINK by hand (flowers, waves, a big water drop at the bow, the name
 * `DE LAATSTE DRUPPEL`), on a twin-axle boat trailer standing in the middle of the A10.
 *
 * Pure data: no imports.
 */

export type Pt = readonly [number, number];

/** The trailer's road line: its wheels stand in the near lane (layout-rf-a.ts `CAR_Y` − RF_GROUND). */
export const BOAT_G = -5;

/** The hull's side profile (local; bow at the left). */
export const HULL: readonly Pt[] = [
  [-98, -60],
  [-92, -57.5],
  [-70, -54],
  [-40, -51.6],
  [-10, -50.6],
  [20, -51],
  [50, -52.4],
  [76, -54.6],
  [90, -57],
  [91, -40],
  [88, -24],
  [80, -17],
  [-62, -17],
  [-80, -20],
  [-91, -28],
  [-97, -40],
  [-99.4, -52],
];

/** The sheer (the deck edge) at x: the top of the hull's side (linear between the profile points). */
export function sheerY(x: number): number {
  const top = HULL.slice(0, 9);
  if (x <= top[0][0]) return top[0][1];
  for (let i = 1; i < top.length; i++) {
    const [x0, y0] = top[i - 1];
    const [x1, y1] = top[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return top[top.length - 1][1];
}

/** The deck's height in the middle (the crew's feet behind the bulwark). */
export const DECK_Y = -51;

/** The trailer: the wheels (x of each axle, radius), the beam, the drawbar's tip, the jockey wheel. */
export const TRAILER = {
  axles: [-4, 18] as readonly number[],
  wheelR: 6.5,
  beamY: -15,
  x0: -96,
  x1: 76,
  drawbarTip: -118,
  jockeyX: -108,
} as const;

/** The mast (x, foot, top) and the gooseneck (the boom's pivot). */
export const MAST = { x: -18, foot: -51, top: -152 } as const;
export const GOOSENECK: Pt = [-16, -60];
/** The boom at rest (aft, over the deckhouse): its end, relative to the gooseneck. */
export const BOOM_REST: Pt = [92, -2];

/**
 * The boom's swing frames (phase 2: it swings out over the bow at chest height): the end point
 * relative to the gooseneck per frame (0 rest, 1 creak / the tell, 2 across, 3 forward, 4 out,
 * 5 out low). Frames 4 and 5 are the hazard (`boomBox`).
 */
export const BOOM_ENDS: readonly Pt[] = [
  [92, -2],
  [94, -6],
  [34, 2],
  [-50, 16],
  [-100, 28],
  [-112, 32],
];

/** The deckhouse aft (x0, x1, its roof). */
export const CABIN = { x0: 34, x1: 82, roof: -68 } as const;

/** Where the crew stands (hip points; the figures are drawn from the hip up behind the bulwark). */
export const LEADER_HIP: Pt = [-50, -61];
export const DRUM_A_HIP: Pt = [4, -57];
export const DRUM_B_HIP: Pt = [24, -58];

/** The loudspeakers: the bow one on a pole, the aft one on the deckhouse roof (box = the horn). */
export const SPEAKER_L = { pole: [-80, -54] as Pt, box: { x: -88, y: -88, w: 16, h: 12 } } as const;
export const SPEAKER_R = { pole: [62, CABIN.roof] as Pt, box: { x: 54, y: -96, w: 16, h: 12 } } as const;

/** The hit boxes (Boss parts; local, as drawn). The hull's box takes in the trailer: a shot at it hits the boat. */
export const BOAT_BOX = {
  hull: { x: -94, y: -52, w: 184, h: 44 },
  speakerL: SPEAKER_L.box,
  speakerR: SPEAKER_R.box,
} as const;

/** The hazard box of the boom at swing frame f (local; null when it is not out). Chest height of a standing hero. */
export function boomBox(f: number): { x: number; y: number; w: number; h: number } | null {
  if (f < 4) return null;
  const [ex, ey] = BOOM_ENDS[f];
  const x = GOOSENECK[0] + ex;
  const y = GOOSENECK[1] + ey;
  // The outer 40 px of the boom (the furled sail's thick end), 9 px tall.
  return { x: x - 4, y: y - 5, w: 44, h: 9 };
}

/** Where a wave's lopers come down the boarding ladder (the bow's foot) and the body wall. */
export const LADDER_X = -102;
export const WALL_X = TRAILER.drawbarTip + 4;

/** The ground shock's start (the bow's foot) and the paint balloons' start (a drummer's hand). */
export const SHOCK_X = -100;
export const BALLOON_FROM: Pt = [20, -86];
/** The leader's megaphone mouth (bubbles and the ring fx). */
export const MEGAPHONE: Pt = [-64, -80];
/** The leader's bubble point. */
export const LEADER_SAY: Pt = [-50, -96];

/** The masthead (the streamer's root) and the bunting's ends (bow, stern). */
export const MASTHEAD: Pt = [MAST.x, MAST.top + 2];
export const BUNTING_BOW: Pt = [-97, -61];
export const BUNTING_STERN: Pt = [89, -58];
