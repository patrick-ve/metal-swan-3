/**
 * ROBO-HALSEMA — the shared shape data of her art (local coordinates, the anchor (0, 0) is the
 * floor point between her feet; logical pixel (x, y) covers [x, x + 1) × [y, y + 1)). The 1×
 * drawer (art.ts) and the HD drawer (art-hd.ts) read the same poses and outlines, so every
 * density draws the same figure. Pure data: no drawing, no imports of the art modules.
 */
import type { Pt } from './canvas';

/** A leg: hip, knee and ankle pixels. */
export type LegJoints = readonly [Pt, Pt, Pt];

/** Walk cycle phase (of 6) of the in-between leg frames 5–8 (phase 0 = frame 1, phase 3 = frame 2). */
export const WALK_K = [1, 2, 4, 5] as const;
/** The 6-frame walk loop as `legs` frame indices (docs/ART_GUIDE.md "Motion"). */
export const MAYOR_WALK = [1, 5, 6, 2, 7, 8] as const;
/** Frames of the `legs` strip. */
export const LEG_FRAMES = 11;

/**
 * The far and the near leg of `legs` frame f: 0 stand, 1 / 2 step, 3 squat, 4 sit, 5–8 walk
 * in-betweens, 9 half squat, 10 push-off.
 */
export function legJoints(f: number): readonly [LegJoints, LegJoints] {
  if (f === 4) {
    // Sitting on the floor: both legs stretched out in front.
    return [
      [[-6, -16], [14, -12], [34, -8]],
      [[2, -14], [22, -10], [42, -6]],
    ];
  }
  if (f >= 5 && f <= 8) {
    // One walk in-between: the stride eases on a cosine, the swinging foot lifts at the passing point.
    const ph = (WALK_K[f - 5] / 6) * Math.PI * 2;
    const stepA = Math.round(6 * Math.cos(ph));
    const sn = Math.sin(ph);
    const liftN = sn > 0 ? Math.round(4 * sn) : 0;
    const liftF = sn < 0 ? Math.round(-4 * sn) : 0;
    const hipY = -40 - (Math.abs(sn) > 0.5 ? 1 : 0);
    return [
      [[-10, hipY], [-12 - stepA + liftF, -22 - liftF], [-14 - stepA, -6 - liftF]],
      [[8, hipY], [12 + stepA + liftN, -22 - liftN], [12 + stepA, -6 - liftN]],
    ];
  }
  if (f === 10) {
    // Push-off for the stomp hop: hips up, both legs straight, toes down.
    return [
      [[-10, -43], [-11, -24], [-11, -6]],
      [[8, -43], [10, -24], [10, -6]],
    ];
  }
  const squat = f === 3 ? 6 : f === 9 ? 3 : 0;
  const hipY = -40 + squat;
  const stepA = f === 1 ? 6 : f === 2 ? -6 : 0;
  return [
    [[-10, hipY], [-12 - stepA - squat, -22 + squat / 2], [-14 - stepA, -6]],
    [[8, hipY], [12 + stepA + squat, -22 + squat / 2], [12 + stepA, -6]],
  ];
}

/** The jacket: sloped shoulders from the neck, a soft waist, a slightly flared hip-length hem. */
export const JACKET_POLY: ReadonlyArray<Pt> = [
  [-11, -108],
  [13, -108],
  [28, -99],
  [29, -91],
  [25, -74],
  [27, -58],
  [28, -51],
  [26, -49],
  [3, -48],
  [-27, -49],
  [-29, -51],
  [-29, -58],
  [-26, -74],
  [-30, -91],
  [-29, -99],
];

/** The wide rolled shawl collar: the near lapel (it catches the light) and the far one. */
export const LAPEL_NEAR: ReadonlyArray<Pt> = [
  [-21, -109],
  [-8, -107],
  [-5, -96],
  [-2, -78],
  [0, -64],
  [-6, -66],
  [-14, -73],
  [-21, -85],
  [-24, -98],
];
export const LAPEL_FAR: ReadonlyArray<Pt> = [
  [21, -109],
  [12, -107],
  [9, -96],
  [6, -78],
  [5, -64],
  [9, -67],
  [15, -75],
  [20, -87],
  [23, -99],
];

/**
 * Stamp arm poses (elbow, hand = the knob, block bottom): 0 low (idle), 1 raised (telegraph),
 * 2 impact (slam), 3 anticipation (a dip and pull back before the lift), 4 smear (mid swing),
 * 5 recoil (the block bounces off the floor). 0–2 keep their old indices and shapes.
 */
export const ARM_POSES: ReadonlyArray<readonly [Pt, Pt, number]> = [
  [[32, -76], [55, -60], -12],
  [[40, -122], [46, -148], -106],
  [[42, -72], [57, -40], 0],
  [[28, -72], [50, -54], -6],
  [[44, -100], [58, -96], -54],
  [[40, -80], [56, -50], -8],
];
/** Poses per facing in the `stamp-arm-*` strips (frames 0–5 face right, 6–11 pre-mirrored). */
export const ARM_FRAMES = ARM_POSES.length;
/** Shoulders of the stamp arm and the far arm. */
export const STAMP_SHOULDER: Pt = [24, -97];
export const FAR_SHOULDER: Pt = [-24, -97];

/**
 * The far arm frames 1 / 2: the loop high / low at phase 0; 3–7 high and 8–12 low at phases 1–5
 * (the whirl): elbow, hand, the loop centre and radii, and the phase p (0–5).
 */
export function farArmPose(f: number): { high: boolean; p: number; elbow: Pt; hand: Pt; loop: Pt; rx: number; ry: number } {
  const high = f === 1 || (f >= 3 && f <= 7);
  const p = f <= 2 ? 0 : high ? f - 2 : f - 7;
  const ph = (p / 6) * Math.PI * 2;
  // The hand circles a little as it swings the loop; the loop centre lags behind it.
  const hdx = Math.round(2 * Math.sin(ph));
  const hdy = Math.round(-2 * Math.cos(ph)) + 2;
  // High: the forearm passes under the chin, so the face stays clear.
  const elbow: Pt = high ? [-2, -95] : [-10, -74];
  const hand: Pt = high ? [26 + hdx, -118 + hdy] : [12 + hdx, -48 + hdy];
  // (Both offsets are 0 at phase 0, so frames 1 / 2 keep their old shape.)
  const lx = (high ? 46 : 30) + Math.round(3 * (Math.sin(ph - 1) + Math.sin(1)));
  const ly = (high ? -142 : -26) + Math.round(2 * (Math.cos(1) - Math.cos(ph - 1)));
  return { high, p, elbow, hand, loop: [lx, ly], rx: high ? 18 : 22, ry: high ? 12 : 14 };
}

/**
 * The two runs of the chain of office: from behind the neck down along the lapel rolls (bowed a
 * little outward) to the medallion rim at about 10 and 2 o'clock. The medallion is drawn after
 * them and forms the bottom of the U: it is the pendant.
 */
export const CHAIN_RUNS: ReadonlyArray<(t: number) => readonly [number, number]> = [
  (t) => [-18 + 4 * t - 2 * Math.sin(Math.PI * t), -107 + 23 * t],
  (t) => [19 - 9 * t + 1.5 * Math.sin(Math.PI * t), -105 + 21 * t],
];
/** Where the chain is cut on `chain-gone` (run parameter). */
export const CHAIN_CUT: readonly [number, number] = [0.3, 0.68];
/** The enamel shields on each run (run parameter). */
export const CHAIN_SHIELDS: readonly number[] = [0.4, 0.75];

/**
 * The hair silhouette: overlapping round locks (a curly cloud). Big mass at the back and the
 * near side, flaring wide at the shoulders; a full fall behind the far cheek (it frames the
 * face); a high crown.
 */
export const HAIR_LOCKS: ReadonlyArray<readonly [number, number, number]> = [
  // crown
  [-4, -152, 12],
  [8, -153, 11],
  [-18, -149, 12],
  [17, -149, 8],
  // back and near side (behind the ear), flaring at the bottom
  [-28, -140, 11],
  [-31, -127, 11],
  [-30, -114, 10],
  [-27, -104, 7],
  [-20, -108, 6],
  [-17, -124, 10],
  // small fillers: no see-through gaps beside the face
  [-16, -136, 3],
  [-11, -135, 2],
  [-8, -116, 3],
  [-18, -112, 3],
  // far side fall behind the cheek, flaring out at the jaw and the shoulder
  [24, -140, 6],
  [26, -129, 6],
  [26, -118, 6],
  [28, -108, 5],
  [27, -113, 2],
  [21, -109, 3],
  [26, -140, 6],
  [29, -130, 7],
  [31, -119, 7],
  [32, -109, 7],
  [35, -101, 5],
];

/**
 * The loose wave ends at the shoulders: a flare under the back mass (and the far fall) whose
 * bottom edge splits into tapered tips that point down and out. Each entry is a polygon; `TIPS`
 * lists the tip points (a lit pixel on the upper outer side, a dark one on the underside).
 */
export const HAIR_FLARES: ReadonlyArray<ReadonlyArray<Pt>> = [
  [
    [-36, -128],
    [-40, -121],
    [-43, -112],
    [-44, -106],
    [-45, -100],
    [-41, -105],
    [-40, -95],
    [-36, -101],
    [-32, -93],
    [-28, -100],
    [-24, -96],
    [-21, -102],
    [-20, -108],
    [-26, -118],
  ],
  [
    [30, -110],
    [36, -108],
    [39, -104],
    [38, -100],
    [37, -97],
    [34, -102],
    [31, -95],
    [29, -100],
    [27, -104],
  ],
];
export const TIPS: ReadonlyArray<readonly [number, number, number]> = [
  // x, y, the side that faces out (−1 left, +1 right)
  [-45, -100, -1],
  [-40, -95, -1],
  [-32, -93, -1],
  [-24, -96, -1],
  [37, -97, 1],
  [31, -95, 1],
];

/** A wavy strand: from (x0, y0) to (x1, y1), amplitude, half-waves, phase. */
export type Strand = readonly [number, number, number, number, number, number, number];

/** Wavy strands (from, to, amplitude, half-waves, phase): the loose big S-waves of the hair. */
export const STRANDS: ReadonlyArray<Strand> = [
  // back mass: from the crown out and down to the shoulder ends
  [-8, -162, -40, -106, 5, 2.5, 0],
  [-14, -158, -29, -97, 5.5, 2, 1.4],
  [-22, -154, -45, -116, 5, 2, 0.6],
  [-3, -158, -15, -101, 5, 2.5, 2.2],
  [-28, -150, -36, -98, 6, 2.5, 2.8],
  [-9, -150, -22, -100, 5, 2, 0.9],
  // far side fall
  [16, -161, 29, -104, 3, 2.5, 0.3],
  [23, -152, 25, -112, 2, 2, 1.8],
  [24, -150, 34, -100, 3, 2.5, 1],
];

/** Wavy line points along a strand (one per logical px of its length). */
export function strandPts(s: Strand): Array<[number, number]> {
  const [x0, y0, x1, y1, a, k, ph] = s;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const pts: Array<[number, number]> = [];
  const n = Math.ceil(len);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI * k + ph) * a * Math.min(1, t * 3);
    pts.push([x0 + (x1 - x0) * t + nx * w, y0 + (y1 - y0) * t + ny * w]);
  }
  return pts;
}

/** The sweep over the forehead and the far temple lock (outlines for the hair front). */
export const SWEEP: ReadonlyArray<Pt> = [
  [16, -158],
  [21, -152],
  [16, -151],
  [9, -150],
  [3, -150],
  [-2, -147],
  [-6, -144],
  [-9, -136],
  [-14, -134],
  [-14, -150],
  [-6, -160],
  [6, -162],
];
export const TEMPLE: ReadonlyArray<Pt> = [
  [20, -154],
  [25, -150],
  [25, -138],
  [23, -134],
  [22, -145],
];

/**
 * The face plate outline (3/4 view facing right): a long oval with a cheekbone bulge on the far
 * side, a jaw angle beside the earring and a strong chin forward under the mouth.
 */
export const FACE_POLY: ReadonlyArray<Pt> = [
  [-8, -151],
  [4, -155],
  [15, -154],
  [20, -150],
  [22, -143],
  [23, -136],
  [23, -130],
  [22, -124],
  [21, -119],
  [19, -113],
  [16, -108],
  [13, -105],
  [8, -105],
  [3, -108],
  [-3, -111],
  [-7, -112],
  [-9, -116],
  [-9, -126],
  [-9, -138],
  [-9, -146],
];

/** Brow columns [x, top y, rows]: thick at the inner head, a high arch, a thin tail. */
export const BROW_NEAR: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -139, 1],
  [0, -140, 1],
  [1, -141, 2],
  [2, -142, 2],
  [3, -142, 2],
  [4, -142, 2],
  [5, -141, 2],
  [6, -141, 2],
  [7, -141, 2],
  [8, -141, 2],
  [9, -140, 1],
];
export const BROW_FAR: ReadonlyArray<readonly [number, number, number]> = [
  [14, -141, 1],
  [15, -142, 1],
  [16, -143, 2],
  [17, -143, 2],
  [18, -142, 2],
  [19, -141, 1],
  [20, -141, 1],
  [21, -140, 1],
];

/** The hatch seam in the crown (closed lid), logical y at logical x −14..0. */
export function hatchSeam(x: number): number {
  return -161 + Math.round(((x + 7) * (x + 7)) / 24);
}

/** The wig flies off at death: its anchor (the launch point in mayor.ts) and the turn steps. */
export const WIG_ANCHOR: Pt = [-6, -128];
/** Wig flight frames: the wig turned in 8 steps of 45° about its middle. */
export const WIG_STEPS = 8;

/** Spring frame heights (`spring` strip, bottom anchor). */
export const SPRING_H: readonly number[] = [6, 14, 22, 30];
/** Floor shadow widths (`shadow` strip). */
export const SHADOW_W: readonly number[] = [56, 52];
