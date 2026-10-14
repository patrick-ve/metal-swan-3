/**
 * ROBO-HALSEMA — the finer details of her 2× art (docs/ART_GUIDE.md "2x art (mission ams)").
 * art.ts draws every strip on a density-2 `DCanvas` with the same recipe as the 1× art (the same
 * silhouette, anchor and points) and calls these functions where the 2× grid can say more: the
 * face (almond eyes with a round iris and a catchlight, arched brows, the nose planes, form
 * shading, the lips and the closed smile), the earring, curl clumps and the lit sweep waves, the
 * boucle wool and the smooth shawl collar, the chain rosettes and enamel shields, the city arms,
 * rivets and joints. Palette only, light from the top-left, 1-px lines inside the 2-px outline.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { PixelBuffer } from '../../../../engine/pixel';
import { drawText } from '../../../../engine/font';
import { hash2 } from '../../../art/paint';
import type { DCanvas, Pt } from './canvas';
import { BOOT, FACE, HAIR, JACKET, JACKET_FAR, METAL, SILVER, WOOD } from './look';

const JACKET_MID = JACKET[2];

type Strand = readonly [number, number, number, number, number, number, number];

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/**
 * A hand-placed 2× template: each character is one 2× pixel, the top-left at logical (lx, ly);
 * '.' leaves the pixel as it is.
 */
function tpl(c: DCanvas, lx: number, ly: number, rows: readonly string[], pal: Readonly<Record<string, Color>>): void {
  const X0 = c.X(lx);
  const Y0 = c.Y(ly);
  rows.forEach((row, v) => {
    for (let u = 0; u < row.length; u++) {
      const ch = row[u];
      if (ch === '.') continue;
      const col = pal[ch];
      if (col === undefined) throw new Error(`template colour '${ch}'`);
      c.b.set(X0 + u, Y0 + v, col);
    }
  });
}

/** Piecewise-linear y(x) through points sorted by x; NaN outside. */
function pl(pts: ReadonlyArray<Pt>, x: number): number {
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return NaN;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    if (x <= bx) return bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax);
  }
  return pts[pts.length - 1][1];
}

/** Is the buffer pixel opaque? */
function solid(b: PixelBuffer, X: number, Y: number): boolean {
  return (b.get(X, Y) & 255) !== 0;
}

/** The colours of the face template letters. */
const FP: Readonly<Record<string, Color>> = {
  K: INK,
  k: PAL.ink[1],
  g: PAL.stone[3],
  w: PAL.snow[2],
  W: PAL.snow[3],
  B: PAL.brown[1],
  b: PAL.brown[0],
  C: PAL.brown[2],
  P: INK,
  s: FACE[1],
  S: FACE[0],
  f: FACE[2],
  h: FACE[3],
  n: PAL.brown[1],
};

// ---------------------------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------------------------

/** The ear (near side, hair tucked behind it): a lit rim, the inner fold and the bowl. */
export function faceDetail(c: DCanvas): void {
  c.fines(
    [
      [-12.5, -133],
      [-13, -132.5],
      [-13, -128],
    ],
    FACE[3],
  );
  c.fines(
    [
      [-10.5, -131.5],
      [-11.5, -130.5],
      [-11.5, -127.5],
      [-11, -126],
      [-10, -125.5],
    ],
    FACE[1],
  );
  c.rect(-11, -130, 1.5, 2, FACE[1]);
  c.dot(-10.5, -129, FACE[0]);
  c.dot(-10.5, -129.5, FACE[0]);
}

/**
 * Near eye (open), 24 × 12 2× px from logical (−2, lash line − 2): outer corner left with the
 * flick. The upper lid sits high (most of the round iris shows: open, warm eyes) and a lit
 * lower-lid curve lifts under it (the smile in the eyes).
 */
const EYE_NEAR = [
  '.........ssssss.........',
  '......sss......sss......',
  'KKK.....................',
  '..KKKKKKKKKKKKKKKKKKK...',
  '...KKKggbBBBBBBbbwwKK...',
  '....KggbBWWPPPBBbbwws...',
  '.....sgbBBPPPPBBbbws....',
  '......sbCBBPPBBCbws.....',
  '.......sbCCCCCCbss......',
  '........nnnnsshhh.......',
  '.........hhhhhhh........',
  '........................',
];
const EYE_NEAR_UP = [
  '.........ssssss.........',
  '......sss......sss......',
  'KKK.....................',
  '..KKKKKKKKKKKKKKKKKKK...',
  '...KKKgbBWWPPPBBbbwKK...',
  '....KggbBBPPPPBBbbwws...',
  '.....sggbCBBPPBBCbws....',
  '......sggbCCCCCCbws.....',
  '.......ssgggggggwss.....',
  '........nnnnsshhh.......',
  '.........hhhhhhh........',
  '........................',
];
/** Far eye (open), 18 × 11 from logical (14, lash line − 3): inner corner left, outer corner right (foreshortened). */
const EYE_FAR = [
  '...............K..',
  '....sssss.....K...',
  '..kKKKKKKKKKKKK...',
  '...KwbBBBBBbgKK...',
  '...swBWPPPBbgK....',
  '...swBPPPPBbgs....',
  '....sbCBPPCbs.....',
  '.....sbCCCbs......',
  '.....hhhhhs.......',
  '.....ssnnn........',
  '..................',
];
const EYE_FAR_UP = [
  '...............K..',
  '....sssss.....K...',
  '..kKKKKKKKKKKKK...',
  '...KwBWPPPBbgKK...',
  '...swBPPPPBbgK....',
  '...swbCPPCbgs.....',
  '....swbCCCbgs.....',
  '.....sgggggs......',
  '.....hhhhhs.......',
  '.....ssnnn........',
  '..................',
];

/** Almond eyes: a round brown iris under a heavy lash line, a catchlight, smiling lower lids. */
export function eyesOpen(c: DCanvas, look: number, narrow: boolean): void {
  const n = narrow ? -135 : -136;
  const up = look < 0;
  tpl(c, -2, n - 2, up ? EYE_NEAR_UP : EYE_NEAR, FP);
  tpl(c, 14, n - 3, up ? EYE_FAR_UP : EYE_FAR, FP);
}

const SHUT_NEAR = [
  '......ssssssssss........',
  '....ss..........ss......',
  '..KK..............KK....',
  '....KKK........KKK......',
  '.......KKKKKKKKK........',
  '.......k.k.k.k..........',
];
const SHUT_FAR = [
  '..................',
  '...sssssss........',
  '..KK........KK....',
  '....KK.....KK.....',
  '......KKKKK.......',
  '.......k.k.k......',
];

export function eyesClosed(c: DCanvas): void {
  tpl(c, -2, -137, SHUT_NEAR, FP);
  tpl(c, 14, -138.5, SHUT_FAR, FP);
}

/** Spiral eyes (dazed): a pale disc with a fine ink spiral. */
export function eyesDizzy(c: DCanvas): void {
  for (const [ex, ey] of [
    [4, -134],
    [17, -135],
  ] as const) {
    c.circle(ex, ey, 2, PAL.snow[2]);
    const cx = ex + 0.5;
    const cy = ey + 0.5;
    let prev: Pt | null = null;
    for (let t = 0; t <= 1; t += 0.04) {
      const a = t * Math.PI * 4.2;
      const r = 0.3 + t * 2.1;
      const p: Pt = [cx + Math.cos(a) * r - 0.25, cy + Math.sin(a) * r - 0.25];
      if (prev) c.fine(prev[0], prev[1], p[0], p[1], INK);
      prev = p;
    }
  }
}

/** The brow as a band between `top` and `bot` (logical y at pixel centres), dark underside. */
function brow(c: DCanvas, top: ReadonlyArray<Pt>, bot: ReadonlyArray<Pt>, shift: (x: number) => number): void {
  const x0 = top[0][0];
  const x1 = top[top.length - 1][0];
  c.each(Math.floor(x0), -150, Math.ceil(x1), -134, (X, Y, lx, ly) => {
    const t = pl(top, lx);
    const u = pl(bot, lx);
    if (Number.isNaN(t) || Number.isNaN(u)) return;
    const s = shift(lx);
    const y = ly - s;
    if (y < t - 0.3 || y > u + 0.3) return;
    c.b.set(X, Y, y > u - 0.2 ? PAL.ink[1] : PAL.brown[0]);
  });
}

/** Brows: strong, dark and arched (the peak on the outer third). `lift` raises them, `drop` lowers the inner heads. */
export function brows(c: DCanvas, lift: number, drop: number): void {
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  brow(
    c,
    [
      [-1.5, -138.6],
      [0, -139.6],
      [1.5, -140.9],
      [3, -141.8],
      [4.5, -142],
      [6, -141.6],
      [8, -141.1],
      [9.5, -140.6],
    ],
    [
      [-1.5, -138.4],
      [0, -139],
      [1.5, -139.9],
      [3, -140.6],
      [5, -140.4],
      [7, -139.9],
      [9.5, -139.4],
    ],
    (x) => -lift + drop * clamp((x - 4) / 4),
  );
  brow(
    c,
    [
      [13.5, -140.4],
      [15, -141.9],
      [16.5, -142.9],
      [18, -142.6],
      [19.5, -141.5],
      [21.5, -140.3],
    ],
    [
      [13.5, -139.6],
      [15, -140.7],
      [16.5, -141.4],
      [18, -141.4],
      [19.5, -140.7],
      [21.5, -140.1],
    ],
    (x) => -lift + drop * clamp((16 - x) / 2),
  );
}

/** The nose bridge line (its lit edge), x at logical y, from the brow heads to the tip. */
const BRIDGE: Pt[] = [
  [-135.5, 13.5],
  [-131.5, 14.5],
  [-128, 15.5],
  [-126, 16],
];

/**
 * Nose: a long straight bridge (a 1-px lit edge) beside a shadow plane on its far flank that
 * widens toward the tip, a round tip with a 2 × 2 highlight, a dark wedge under the tip with the
 * nostril, and the near nostril wing.
 */
export function nose(c: DCanvas): void {
  c.each(12, -136, 19, -124, (X, Y, lx, ly) => {
    const xb = pl(BRIDGE, ly);
    if (Number.isNaN(xb)) return;
    const w = 0.6 + Math.max(0, Math.min(1, (ly + 134) / 6)) * 1.6;
    if (lx > xb && lx <= xb + w && FACE.includes(c.b.get(X, Y))) c.b.set(X, Y, FACE[1]);
  });
  // The lit bridge.
  c.fines(
    [
      [13, -134],
      [14, -130],
      [14.5, -128],
    ],
    FACE[3],
  );
  // The round tip: the highlight, the far rim of the ball.
  c.rect(14.5, -127, 1, 1, FACE[3]);
  c.fines(
    [
      [17, -126],
      [17, -125],
      [16.5, -124],
    ],
    FACE[1],
  );
  // The dark wedge under the tip (it lengthens the nose by one 2× px) and the nostril.
  c.fines(
    [
      [16, -123.5],
      [13.5, -123.5],
    ],
    FACE[1],
  );
  c.fines(
    [
      [15.5, -124],
      [14, -124],
    ],
    FACE[0],
  );
  c.dot(12.5, -124, FACE[0]);
  // The near nostril wing (a curve).
  c.fines(
    [
      [12, -123.5],
      [11, -123.5],
      [10.5, -124],
      [10.5, -125],
      [11, -125.5],
    ],
    FACE[1],
  );
}

/**
 * Form shading on the face plate (light from the top left): a shadow under the far cheekbone and
 * along the far jaw (a longer face, high cheekbones), a lit near cheekbone, and the small mole on
 * her near cheek.
 */
export function faceForm(c: DCanvas): void {
  // Under the far cheekbone: the far rim widens into a soft hollow.
  c.each(16, -131, 23, -114, (X, Y, lx, ly) => {
    if (!FACE.includes(c.b.get(X, Y)) || c.b.get(X, Y) !== FACE[2]) return;
    const edge = pl(
      [
        [-131, 22.5],
        [-127, 20],
        [-123, 19.5],
        [-119, 20],
        [-114, 19],
      ],
      ly,
    );
    if (!Number.isNaN(edge) && lx >= edge) c.b.set(X, Y, FACE[1]);
  });
  // The far jaw: a 1-px shade line inside the jaw edge down to the chin.
  c.fines(
    [
      [19.5, -116],
      [17.5, -112],
      [15, -108.5],
      [12.5, -107],
    ],
    FACE[1],
  );
  // The near cheekbone highlight (2 × 2 and a tail) and a soft shade under it.
  c.rect(-1.5, -131, 1, 1, FACE[3]);
  c.dot(0, -131, FACE[3]);
  // The mole on the near cheek.
  c.dot(0.5, -127, PAL.brown[1]);
}

const LIP_DARK = PAL.red[0];
const LIP_D = PAL.red[1];
const LIP = PAL.red[2];
const LIP_HI = PAL.red[3];

/** Mouth: kind 0 the closed confident smile, 1 flat, 2 shout, 3 wobbly. */
export function mouth(c: DCanvas, kind: number): void {
  if (kind === 2) {
    // A firm open "GESLOTEN!": an even mouth, the upper teeth, the lower lip.
    c.ellipse(9, -121, 11, 5, INK);
    c.line(10, -121, 18, -121, LIP_D);
    c.fine(9, -120, 19.5, -120, LIP_D);
    c.rect(11, -119.5, 7, 1, PAL.snow[2]);
    for (const x of [13, 15.5]) c.dot(x, -119, PAL.stone[3]);
    c.fine(11.5, -118, 16.5, -118, PAL.red[0]);
    c.line(10, -116, 18, -116, LIP_D);
    c.line(10, -115, 18, -115, LIP);
    c.line(11, -114, 17, -114, LIP);
    c.dot(12.5, -115, LIP_HI);
    c.dot(13, -115, LIP_HI);
    c.fine(7, -120.5, 7, -118.5, FACE[1]);
    return;
  }
  if (kind === 1 || kind === 3) {
    for (let x = 8; x <= 19; x++) {
      const w = (kind === 3 ? (x % 4 < 2 ? 0 : 1) : 0) - (x >= 16 ? 1 : 0);
      c.set(x, -118 + w, LIP_D);
      if (x >= 9 && x <= 18) c.set(x, -117 + w, LIP);
    }
    return;
  }
  // The closed smile, foreshortened (the far half shorter): a thin upper lip with a soft bow, a
  // full lower lip, both corners lifted (the near one higher), a dark seam that dips in the middle.
  const seam: Pt[] = [
    [8, -120],
    [9.5, -118.7],
    [12, -117.8],
    [14.5, -117.8],
    [16.5, -118.4],
    [18.5, -119.5],
  ];
  const top: Pt[] = [
    [8, -120],
    [10, -119.3],
    [12.2, -119.6],
    [13.2, -119.1],
    [14.4, -119.6],
    [16.5, -119.3],
    [18.5, -119.6],
  ];
  const bot: Pt[] = [
    [8.5, -119.6],
    [10, -117.5],
    [12.5, -116.3],
    [15, -116.4],
    [17.2, -117.6],
    [18.3, -119],
  ];
  c.each(7, -122, 20, -114, (X, Y, lx, ly) => {
    const s = pl(seam, lx);
    if (Number.isNaN(s)) return;
    const t = pl(top, lx);
    const b = pl(bot, lx);
    if (Math.abs(ly - s) <= 0.26) c.b.set(X, Y, LIP_DARK);
    else if (ly < s && ly >= t - 0.3) c.b.set(X, Y, LIP_D);
    else if (ly > s && !Number.isNaN(b) && ly <= b + 0.3) c.b.set(X, Y, ly > b - 0.2 ? LIP_D : LIP);
  });
  // The lit curve of the lower lip.
  c.fine(12, -117, 13.5, -117, LIP_HI);
  // The lifted near corner with a smile crease beyond it and a lit dimple; the far corner tucked.
  c.fines(
    [
      [7.5, -120.5],
      [7, -121.5],
      [6.5, -122],
    ],
    FACE[1],
  );
  c.dot(7, -120, FACE[3]);
  c.dot(19, -120, FACE[1]);
  // A soft smile line from the nose wing.
  c.fines(
    [
      [10, -122.5],
      [9, -122],
    ],
    FACE[1],
  );
  // The chin: a crease under the lower lip.
  c.fine(12, -112.5, 15, -112.5, FACE[1]);
}

/** The round gold disc earring: ridged rings round a centre hole, on a short gold bar. */
export function earring(c: DCanvas): void {
  c.rect(-11, -122, 2, 5, PAL.gold[1]);
  c.fine(-10, -122, -10, -118, PAL.gold[0]);
  c.fine(-10.5, -122, -10.5, -118, PAL.gold[0]);
  c.dot(-11, -122, PAL.gold[3]);
  c.dot(-11, -121.5, PAL.gold[2]);
  const x = -11;
  const y = -114;
  c.circle(x, y, 3, PAL.gold[1]);
  c.each(x - 3, y - 3, x + 3, y + 3, (X, Y, lx, ly) => {
    const dx = lx - x;
    const dy = ly - y;
    const d = Math.hypot(dx, dy);
    if (!solid(c.b, X, Y) || d > 3.6) return;
    const lit = dx + dy < -0.5;
    const ring = Math.floor(d * 2) % 2 === 0;
    let col: Color = ring ? PAL.gold[2] : PAL.gold[1];
    if (lit && ring) col = PAL.gold[3];
    if (!lit && dx + dy > 1.5) col = ring ? PAL.gold[1] : PAL.gold[0];
    if (d < 1.1) col = PAL.gold[0];
    if (d < 0.6) col = INK;
    c.b.set(X, Y, col);
  });
}

/** Clean hairline panel seams on the face plate (fine steel lines). */
export function crack(c: DCanvas, pts: ReadonlyArray<Pt>): void {
  const on = (x: number, y: number): boolean => FACE.includes(c.at(x, y));
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (!on(x, y)) continue;
    const [nx, ny] = pts[i + 1] ?? [x, y + 1];
    c.fine(x + 0.5, y, (x + nx) / 2 + 0.5, (y + ny) / 2 + 0.5, PAL.steel[1]);
  }
  const [lx, ly] = pts[0];
  if (on(lx - 1, ly)) c.dot(lx, ly, FACE[3]);
}

// ---------------------------------------------------------------------------------------------
// Hair, skull, hatch
// ---------------------------------------------------------------------------------------------

/**
 * Curl clumps on the 2× grid: along each 1× strand a row of round C-shaped clumps (about 10 2×
 * px wide), each with a lit crescent at the top left (chestnut high on the crown), a mid body and
 * a 1-px dark under-curl at the bottom right. Drawn from the bottom up, so each upper clump lies
 * over the one below and its dark under-curl separates them: big bouncy curls, not straight lines.
 */
export function strands(c: DCanvas, L: PixelBuffer, dy: number, list: ReadonlyArray<Strand>): void {
  const clumps: Array<[number, number, number, number, number, number]> = [];
  list.forEach((s, si) => {
    const [x0, y0, x1, y1, a, k, ph] = s;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const n = Math.max(2, Math.round(len / 7));
    const at = (t: number): Pt => {
      const w = Math.sin(t * Math.PI * k + ph) * a * Math.min(1, t * 3);
      return [x0 + (x1 - x0) * t + nx * w, y0 + dy + (y1 - y0) * t + ny * w];
    };
    for (let i = 0; i <= n; i++) {
      const t = (i + 0.5 * (si % 2)) / (n + 0.5);
      const [x, y] = at(t);
      // The clump lies along the wave (its tangent), so the curls follow the big S-waves.
      const [qx, qy] = at(Math.min(1, t + 0.02));
      const [px, py] = at(Math.max(0, t - 0.02));
      const ang = Math.atan2(qy - py, qx - px);
      clumps.push([x, y, 3.6 + hash2(si, i, 71) * 1.2, 2.4 + hash2(si, i, 72) * 0.5, ang, si * 31 + i]);
    }
  });
  clumps.sort((p, q) => q[1] - p[1]);
  for (const [cx, cy, ra, rb, ang] of clumps) clump(c, L, cx, cy, ra, rb, ang);
}

/** One curl clump: an ellipse (radii ra along `ang`, rb across) on the hair pixels of L. */
function clump(c: DCanvas, L: PixelBuffer, cx: number, cy: number, ra: number, rb: number, ang: number): void {
  const high = cy < -128;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const r = Math.max(ra, rb);
  c.each(Math.floor(cx - r - 1), Math.floor(cy - r - 1), Math.ceil(cx + r + 1), Math.ceil(cy + r + 1), (X, Y, lx, ly) => {
    if (!solid(L, X, Y)) return;
    const u = lx - cx;
    const v = ly - cy;
    const p = (u * ca + v * sa) / ra;
    const q = (-u * sa + v * ca) / rb;
    const d = Math.hypot(p, q);
    if (d > 1) return;
    // The light side: the top-left of the clump.
    const s = (u + v) / (Math.max(Math.hypot(u, v), 0.01) * 1.414);
    let col: Color = HAIR[1];
    if (d > 0.86 && s > 0.3) col = HAIR[0];
    else if (s < -0.3 && d > 0.45) col = high && s < -0.7 && d > 0.72 ? HAIR[3] : HAIR[2];
    L.set(X, Y, col);
  });
}

const HAIR_SET = new Set<number>([...HAIR, PAL.brown[3]]);

/**
 * The sweep over the forehead on the 2× grid: three big lit waves from the part down to the near
 * temple (a chestnut band with a bright top edge and a 1-px dark groove under it), fine strand
 * lines between them, and a soft curved hairline (it rounds the straight 1× edge onto the brow).
 */
export function sweepWaves(c: DCanvas, dy: number): void {
  const curve = (x0: number, y0: number, x1: number, y1: number, bend: number) => (t: number): Pt => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend];
  const paint = (f: (t: number) => Pt, off: number, col: Color, t0 = 0, t1 = 1): void => {
    for (let i = 0; i <= 120; i++) {
      const t = t0 + ((t1 - t0) * i) / 120;
      const [x, y] = f(t);
      const X = c.X(x);
      const Y = c.Y(y + dy) + off;
      if (HAIR_SET.has(c.b.get(X, Y))) c.b.set(X, Y, col);
    }
  };
  // The soft hairline: a shallow arc below the straight 1× edge, filled with hair over the brow.
  for (let x = -8.5; x <= 2.5; x += 0.5) {
    const t = (x + 9) / 12;
    const edge = -136 + (-150 + 136) * t;
    const arc = edge + Math.sin(t * Math.PI) * 1.6;
    for (let y = edge; y <= arc; y += 0.5) if (FACE.includes(c.at(x, y + dy))) c.dot(x, y + dy, y > arc - 0.6 ? HAIR[0] : HAIR[1]);
  }
  const waves = [curve(15, -157, -11, -139, 4), curve(11, -159.5, -12, -144, 4), curve(6, -161.5, -13, -149, 3)];
  for (const [k, w] of waves.entries()) {
    paint(w, 2, HAIR[0], 0.05, 0.95);
    paint(w, 1, HAIR[2], 0, 1);
    paint(w, 0, HAIR[2], 0, 1);
    paint(w, -1, k === 0 ? HAIR[2] : HAIR[3], 0.12, 0.8);
  }
  // Fine strands between the waves.
  paint(curve(16, -155.5, -8, -140.5, 3), 0, HAIR[0], 0.1, 0.9);
  paint(curve(9, -158.5, -12.5, -146, 3.5), 0, HAIR[1], 0, 1);
  // The side part: a dark 1-px parting line and a lit edge beside it.
  c.fines(
    [
      [15, -160 + dy],
      [17.5, -157 + dy],
      [19, -154.5 + dy],
    ],
    PAL.ink[1],
  );
  c.fines(
    [
      [14.5, -159.5 + dy],
      [17, -156 + dy],
    ],
    HAIR[3],
  );
}

/** The letters peeking from the open hatch: fine flap lines on the envelope. */
export function letters(c: DCanvas, dy: number): void {
  c.rect(-12, -168 + dy, 8, 6, PAL.snow[3]);
  c.fine(-12, -168 + dy, -8, -165 + dy, PAL.stone[2]);
  c.fine(-4.5, -168 + dy, -8, -165 + dy, PAL.stone[2]);
  c.fine(-11.5, -162.5 + dy, -4.5, -162.5 + dy, PAL.stone[2]);
  c.fine(-2.5, -168.5 + dy, 2.5, -168.5 + dy, PAL.stone[2]);
  c.fine(-2.5, -167 + dy, 0, -167 + dy, PAL.stone[2]);
}

/** The steel skull cap: a bright specular sweep, panel seams and rivet heads (it must read as metal, not grey hair). */
export function skullFront(c: DCanvas, seam: (x: number) => number): void {
  c.fines(
    [
      [-12, -155],
      [-9, -159.5],
      [-3, -162],
      [3, -162.5],
    ],
    METAL[4],
  );
  c.fines(
    [
      [-11, -154],
      [-8, -158.5],
    ],
    METAL[3],
  );
  // A seam across the cap (two plates) with a lit upper lip.
  for (let x = -11; x <= 19; x += 0.5) {
    const y = -160 + ((x - 4) * (x - 4)) / 70;
    if (y < seam(Math.round(x)) - 1.5) {
      c.dot(x, y, METAL[0]);
      c.dot(x, y - 0.5, METAL[3]);
    }
  }
}

export function skullBack(c: DCanvas): void {
  // The strip of the back plate beside the face: a lit edge, a seam, two rivets.
  c.fines(
    [
      [-16, -146],
      [-16.5, -140],
      [-16, -133],
    ],
    METAL[4],
  );
  c.fines(
    [
      [-12.5, -150],
      [-13, -140],
      [-12.5, -130],
    ],
    METAL[1],
  );
  for (const y of [-145, -133]) rivet(c, -15, y, METAL);
}

/** A coil spring `h` logical px tall on the 2× grid (silver, the front turns lit). */
export function spring(c: DCanvas, h: number): void {
  const base = c.Y(-1) + 1;
  for (let j = 0; j < 2 * h; j++) {
    const y = j / 2;
    const a = (y / Math.max(4, h)) * Math.PI * 5;
    // The 1× row's position (the same footprint); the shading follows the finer rows.
    const x = Math.round(Math.sin((Math.floor(y) / Math.max(4, h)) * Math.PI * 5) * 5);
    const front = Math.cos(a) > 0;
    const X = c.X(x - 1);
    c.b.rect(X, base - j, 6, 1, front ? SILVER[3] : SILVER[1]);
    if (front) c.b.set(X + 1, base - j, SILVER[4]);
    else c.b.set(X + 5, base - j, SILVER[0]);
  }
}

// ---------------------------------------------------------------------------------------------
// Metal, cloth, wood
// ---------------------------------------------------------------------------------------------

/** A domed rivet: a lit cap, a mid tone and a dark lower-right rim. */
export function rivet(c: DCanvas, x: number, y: number, ramp: Ramp): void {
  const top = ramp[ramp.length - 1];
  c.dot(x, y, top);
  c.dot(x + 0.5, y, ramp[3] ?? top);
  c.dot(x, y + 0.5, ramp[3] ?? top);
  c.dot(x + 0.5, y + 0.5, ramp[2]);
  c.dot(x + 1, y + 0.5, ramp[0]);
  c.dot(x + 0.5, y + 1, ramp[0]);
  c.dot(x + 1, y + 1, ramp[0]);
}

/** The glint and the pivot of a steel ball joint. */
export function jointGlint(c: DCanvas, x: number, y: number, r: number): void {
  c.dot(x - 1, y - 1, METAL[4]);
  c.dot(x - 0.5, y - 1, METAL[4]);
  c.dot(x - 1, y - 0.5, METAL[4]);
  if (r >= 3) {
    c.dot(x - 1.5, y - 0.5, METAL[3]);
    c.dot(x - 0.5, y - 1.5, METAL[3]);
    c.dot(x + 0.5, y + 0.5, METAL[1]);
    c.dot(x + 1, y + 0.5, METAL[1]);
  }
}

/**
 * The far sleeve at rest (2×): a shade band down its back, fold lines bunched at the elbow and a
 * lit cuff ring at the wrist, so it reads as a jacket sleeve over a robot joint.
 */
export function sleeveFar(c: DCanvas): void {
  const sleeve = (x: number, y: number): boolean => JACKET_FAR.includes(c.at(x, y));
  const shade = (pts: ReadonlyArray<Pt>, col: Color): void => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n;
        const y = ay + ((by - ay) * k) / n;
        if (sleeve(x, y)) c.dot(x, y, col);
      }
    }
  };
  // The shade band on the back of the sleeve (upper arm and forearm).
  for (const o of [0, 0.5]) {
    shade(
      [
        [-29.5 - o, -96],
        [-35 - o, -80],
      ],
      JACKET_FAR[1],
    );
    shade(
      [
        [-34.5 - o, -73],
        [-33 - o, -55],
      ],
      JACKET_FAR[1],
    );
  }
  // Folds bunched at the inside of the elbow.
  shade(
    [
      [-29, -83],
      [-31, -81],
      [-28.5, -80],
    ],
    JACKET_FAR[0],
  );
  shade(
    [
      [-28.5, -74],
      [-30.5, -72.5],
    ],
    JACKET_FAR[0],
  );
  // The cuff: a lit ring with a dark edge under it.
  shade(
    [
      [-33.5, -54],
      [-30, -53],
      [-26.5, -54],
    ],
    JACKET_FAR[3],
  );
  shade(
    [
      [-33.5, -53],
      [-30, -52],
      [-26.5, -53],
    ],
    JACKET_FAR[0],
  );
}

/** A steel mitten hand: the glint, the thumb seam. */
export function mitten(c: DCanvas, x: number, y: number, r: number): void {
  c.dot(x - r / 2, y - r / 2, METAL[4]);
  c.dot(x - r / 2 + 0.5, y - r / 2, METAL[4]);
  c.dot(x - r / 2, y - r / 2 + 0.5, METAL[3]);
  c.fines(
    [
      [x - r + 1.5, y + 0.5],
      [x - 0.5, y + 1],
      [x + 1, y + r - 1.5],
    ],
    METAL[1],
  );
}

/** The shoe: a lit edge along the top and the toe. */
export function shoe(c: DCanvas, ax: number, ay: number): void {
  c.fine(ax - 4, ay - 1.5, ax + 8, ay - 1.5, BOOT[BOOT.length - 1]);
  c.dot(ax + 9.5, ay - 1, BOOT[BOOT.length - 1]);
}

/**
 * Boucle on the 2× grid: sparse small loops on a staggered 6 × 4 grid, each a lit pixel over a
 * one-step-darker pixel (a third pixel on some), so the wool reads plush, not dirty. The lit tone
 * stays clean (the big front panels read white), the darkest tone only in the folds; none next to
 * the silhouette edge or on the `skip` layer's pixels (the smooth shawl collar).
 */
export function boucle(c: DCanvas, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, seed: number, skip?: PixelBuffer): void {
  const b = c.b;
  const top = ramp.length - 1;
  const idx = (X: number, Y: number): number => ramp.indexOf(b.get(X, Y));
  const inside = (X: number, Y: number): boolean => {
    for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) if (!solid(b, X + dx, Y + dy)) return false;
    return true;
  };
  const X0 = c.X(x0);
  const Y0 = c.Y(y0);
  const X1 = c.X(x1 + 1) - 1;
  const Y1 = c.Y(y1 + 1) - 1;
  for (let gy = Y0; gy <= Y1; gy += 4) {
    const row = Math.floor((gy - Y0) / 4);
    for (let gx = X0 + (row % 2) * 3; gx <= X1; gx += 6) {
      const h = hash2(gx, gy, seed);
      if (h < 0.45) continue;
      const X = gx + (hash2(gx, gy, seed + 1) < 0.5 ? 0 : 1);
      const Y = gy;
      const i = idx(X, Y);
      if (i <= 0 || i >= top) continue;
      if (idx(X + 1, Y) !== i || idx(X, Y + 1) !== i || idx(X + 1, Y + 1) !== i) continue;
      if (!inside(X, Y) || !inside(X + 1, Y + 1)) continue;
      if (skip && (solid(skip, X, Y) || solid(skip, X + 1, Y + 1))) continue;
      // A small loop: the lit top, its shade under it (and beside it on some).
      b.set(X, Y, ramp[i + 1]);
      b.set(X, Y + 1, ramp[i - 1]);
      if (h > 0.8) b.set(X + 1, Y + 1, ramp[i - 1]);
    }
  }
}

/** Scuffs (dents, cracks, scorch) at the 1× positions, drawn with 2× pixels. */
export function scuff(c: DCanvas, x0: number, y0: number, w: number, h: number, state: number, seed: number, light: Color = PAL.steel[3]): void {
  if (state <= 0) return;
  const b = c.b;
  const n = Math.round((w * h) / (state === 1 ? 220 : 90));
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(hash2(i, 1, seed) * w);
    const y = y0 + Math.floor(hash2(i, 2, seed) * h);
    const X = c.X(x);
    const Y = c.Y(y);
    if (!solid(b, X, Y)) continue;
    const k = hash2(i, 3, seed);
    if (k < 0.45) {
      // A dent: a dark pit with a lit upper-left rim.
      b.set(X, Y, INK);
      b.set(X + 1, Y, INK);
      b.set(X, Y + 1, INK);
      if (solid(b, X - 1, Y - 1)) b.set(X - 1, Y - 1, light);
      if (solid(b, X, Y - 1)) b.set(X, Y - 1, light);
    } else if (k < 0.8 || state === 1) {
      // A fine crack.
      const dx = hash2(i, 4, seed) < 0.5 ? 1 : -1;
      for (let s = 0; s < 2 * (3 + state); s++) {
        const px = X + s * dx;
        const py = Y + (s >> 1);
        if (solid(b, px, py)) b.set(px, py, INK);
      }
    } else {
      // A scorch smudge (a fine checker).
      for (let yy = -5; yy <= 5; yy++) {
        for (let xx = -6; xx <= 6; xx++) {
          if (Math.abs(xx) / 2 + Math.abs(yy) / 2 > 3) continue;
          if (((X + xx + Y + yy) & 1) === 0 && solid(b, X + xx, Y + yy)) b.set(X + xx, Y + yy, PAL.ink[1]);
        }
      }
    }
  }
}

/**
 * The shawl collar at 2×: each lapel rolls over onto the jacket, so a bright crest runs just
 * inside its outer edge (above the dark under-roll), and a soft shade line runs along its inner
 * edge by the blouse (on the 1× lapel shapes of art.ts).
 */
export function shawl(c: DCanvas): void {
  // Near lapel: the outer roll (from the shoulder down to the closure) and its lit crest.
  const crestN: Pt[] = [
    [-21, -105],
    [-21.5, -98],
    [-18.5, -86],
    [-12, -75],
    [-5, -68.5],
  ];
  c.fines(crestN, PAL.snow[3]);
  c.fines(
    crestN.map(([x, y]) => [x + 0.5, y] as Pt),
    PAL.snow[3],
  );
  // The near lapel's inner half turns toward the blouse: one shade step, then a fine edge line.
  c.fines(
    [
      [-9.5, -106],
      [-6.5, -96],
      [-3.5, -79],
      [-1.5, -66.5],
    ],
    JACKET_MID,
  );
  // Far lapel: a lit crest inside the outer roll.
  c.fines(
    [
      [19, -104],
      [19.5, -99],
      [16.5, -88],
      [12, -77],
      [8, -70],
    ],
    PAL.snow[3],
  );
}

/** Fine details on the body: covered buttons, the neck rings, blouse folds. */
export function bodyDetail(c: DCanvas): void {
  // The covered button (round) and a second one lower on the blouse.
  for (const [x, y] of [
    [1, -93],
    [2.5, -71],
  ] as const) {
    c.rect(x, y, 1.5, 1.5, PAL.red[1]);
    c.dot(x, y, PAL.red[3]);
    c.dot(x + 1, y + 1, PAL.red[0]);
  }
  // Blouse folds: fine dark lines down the open front.
  c.fine(3.5, -86, 2.5, -76, PAL.red[1]);
  // Neck: a fine lit edge on each ring.
  c.fine(-3, -110.5, 3, -110.5, METAL[3]);
  c.fine(-3, -107.5, 3, -107.5, METAL[3]);
}

/** Wood grain on the stamp block, a lit knob, the rubber pad texture. */
export function stampDetail(c: DCanvas, cx: number, top: number, bottom: number): void {
  for (const y of [top + 2.5, top + 17]) {
    for (let x = cx - 26; x <= cx + 26; x += 0.5) {
      const w = Math.sin((x - cx) / 5 + y) * 0.5;
      if (hash2(Math.round(x * 2), Math.round(y * 2), 9) < 0.25) continue;
      c.dot(x, Math.round((y + w) * 2) / 2, WOOD[1]);
    }
  }
  c.fine(cx - 2, top - 19, cx - 3.5, top - 17.5, WOOD[3]);
  c.dot(cx - 2.5, top - 18.5, PAL.cloth[3]);
  c.fine(cx - 2, top - 11, cx - 2, top - 1, WOOD[3]);
  for (let x = cx - 26; x <= cx + 26; x += 2) c.dot(x, bottom - 1.5, PAL.red[0]);
}

/** Text at density d: the 1× font with each pixel a d × d block (the label stays legible). */
export function label(buf: PixelBuffer, text: string, x: number, y: number, d: number, color: Color): void {
  drawText(buf, text, x * d, y * d, { color, scale: d });
}

/** A 4-point sparkle on the 2× grid: a bright centre, thin long arms. */
export function sparkle(c: DCanvas, x: number, y: number, col: Color): void {
  c.set(x, y, col);
  c.fine(x - 1.5, y + 0.5, x + 2, y + 0.5, PAL.snow[1]);
  c.fine(x + 0.5, y - 1.5, x + 0.5, y + 2, PAL.snow[1]);
  c.dot(x, y, PAL.snow[3]);
}

// ---------------------------------------------------------------------------------------------
// Chain of office, medallion, lash
// ---------------------------------------------------------------------------------------------

/**
 * The chain band on the 2× grid: the same 5-px footprint, but a thin steel edge round a light
 * silver band of openwork links: every 6 steps a silver rosette (a ring lit at the top left with
 * a dark centre), between them a small enamel bead (red, blue, green in turn), and a fine steel
 * bar where two links meet. No dark windows, so it reads as lace silver, not a film strip.
 */
export function chainBand(c: DCanvas, pts: ReadonlyArray<Pt>, phase: number): void {
  const b = c.b;
  for (const [x, y] of pts) c.rect(x - 2, y - 2, 5, 5, PAL.steel[1]);
  for (const [x, y] of pts) b.rect(c.X(x - 2) + 1, c.Y(y - 2) + 1, 8, 8, SILVER[1]);
  for (const [x, y] of pts) c.rect(x - 1, y - 1, 3, 3, SILVER[3]);
  const beads = [PAL.red[2], PAL.sky[1], PAL.green[2]];
  pts.forEach(([x, y], k) => {
    const m = (k + phase * 3) % 6;
    const X = c.X(x) + 1;
    const Y = c.Y(y) + 1;
    const p = pts[Math.max(0, k - 1)];
    const q = pts[Math.min(pts.length - 1, k + 1)];
    let tx = q[0] - p[0];
    let ty = q[1] - p[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    if (m === 0) {
      // The rosette: a 3 × 3 ring, lit top-left, shaded bottom-right, a dark centre.
      for (let v = -1; v <= 1; v++) {
        for (let u = -1; u <= 1; u++) {
          const col = u === 0 && v === 0 ? PAL.steel[0] : u + v < 0 ? SILVER[4] : u + v > 0 ? SILVER[1] : SILVER[2];
          b.set(X + u, Y + v, col);
        }
      }
      b.set(X - 2, Y - 2, SILVER[4]);
    } else if (m === 3) {
      // An enamel bead with a lit pixel.
      const col = beads[Math.floor((k + phase * 3) / 6) % 3];
      b.rect(X - 1, Y - 1, 2, 2, col);
      b.set(X - 1, Y - 1, PAL.snow[3]);
    } else if (m === 5 || m === 2) {
      // A fine bar across the band where the links meet.
      const nx = -ty;
      const ny = tx;
      b.line(Math.round(X - 0.5 + nx * 2), Math.round(Y - 0.5 + ny * 2), Math.round(X - 0.5 - nx * 2), Math.round(Y - 0.5 - ny * 2), SILVER[1]);
    }
  });
}

/** An enamel shield on the chain: a silver heater shield (pointed base) with an enamel field. */
export function chainShield(c: DCanvas, x: number, y: number, col: Color): void {
  const b = c.b;
  const B = c.X(x);
  const C = c.Y(y);
  b.poly(
    [
      [B - 4, C - 4],
      [B + 5, C - 4],
      [B + 5, C + 2],
      [B + 1, C + 7],
      [B, C + 7],
      [B - 4, C + 2],
    ],
    SILVER[2],
  );
  b.poly(
    [
      [B - 3, C - 3],
      [B + 4, C - 3],
      [B + 4, C + 2],
      [B + 1, C + 5],
      [B, C + 5],
      [B - 3, C + 2],
    ],
    col,
  );
  b.line(B - 4, C - 4, B + 4, C - 4, SILVER[4]);
  b.line(B - 4, C - 3, B - 4, C + 2, SILVER[3]);
  b.set(B - 2, C - 2, col === PAL.snow[3] ? PAL.snow[2] : PAL.snow[3]);
  b.set(B - 1, C - 2, col === PAL.snow[3] ? PAL.snow[2] : PAL.snow[3]);
}

/** The city arms at 2×: three crisp white saltires on the black pale, a fine shield edge. */
export function arms(c: DCanvas, cx: number, cy: number): void {
  for (const dy of [-5, 0, 5]) {
    const B = c.X(cx);
    const C = c.Y(cy + dy);
    c.b.rect(B - 2, C - 2, 6, 6, INK);
    c.b.line(B - 2, C - 2, B + 3, C + 3, PAL.snow[3]);
    c.b.line(B - 1, C - 2, B + 3, C + 2, PAL.snow[3]);
    c.b.line(B + 3, C - 2, B - 2, C + 3, PAL.snow[3]);
    c.b.line(B + 2, C - 2, B - 2, C + 2, PAL.snow[3]);
  }
  // A lit edge on the red field, the crown points.
  c.fine(cx - 8, cy - 8.5, cx - 3, cy - 8.5, PAL.red[3]);
  for (const dx of [-4, 0, 4]) c.dot(dx + cx + 0.5, cy - 13.5, PAL.gold[3]);
}

/** The open core at 2×: a fine bright ring and a hot centre. */
export function core(c: DCanvas, cx: number, cy: number, glow: boolean): void {
  c.each(cx - 9, cy - 9, cx + 9, cy + 9, (X, Y, lx, ly) => {
    const d = Math.hypot(lx - cx, ly - cy);
    if (d > 8.6 && d < 9.1) c.b.set(X, Y, PAL.steel[1]);
    if (d > 4.6 && d < 5.1) c.b.set(X, Y, glow ? PAL.gold[2] : PAL.teal[2]);
  });
  c.dot(cx - 1, cy - 1, PAL.snow[3]);
  c.dot(cx - 3, cy - 3.5, PAL.snow[3]);
  c.dot(cx - 3.5, cy - 3, PAL.snow[2]);
}

/** The medallion rim at 2×: a lit arc at the top left and fine beads round the rim. */
export function rimDetail(c: DCanvas, cx: number, cy: number, r: number): void {
  for (let a = 3.6; a <= 4.6; a += 0.03) c.dot(cx + 0.25 + Math.cos(a) * (r - 0.6), cy + 0.25 + Math.sin(a) * (r - 0.6), PAL.snow[3]);
  for (let k = 0; k < 20; k++) {
    if (k % 2 === 0) continue;
    const a = (k / 20) * Math.PI * 2;
    c.dot(cx + 0.25 + Math.cos(a) * (r - 1.2), cy + 0.25 + Math.sin(a) * (r - 1.2), PAL.steel[1]);
  }
}

/** The lash tip: a big red enamel shield in a silver rim with a white saltire. */
export function lashTip(c: DCanvas): void {
  const b = c.b;
  const B = c.X(156);
  const C = c.Y(-4);
  b.poly(
    [
      [B, C],
      [B + 15, C],
      [B + 15, C + 10],
      [B + 8, C + 15],
      [B + 7, C + 15],
      [B, C + 10],
    ],
    SILVER[3],
  );
  b.poly(
    [
      [B + 2, C + 2],
      [B + 13, C + 2],
      [B + 13, C + 9],
      [B + 8, C + 13],
      [B + 7, C + 13],
      [B + 2, C + 9],
    ],
    PAL.red[2],
  );
  b.line(B + 6, C + 2, B + 6, C + 12, INK);
  b.line(B + 9, C + 2, B + 9, C + 12, INK);
  b.rect(B + 7, C + 2, 2, 11, INK);
  b.line(B + 6, C + 5, B + 9, C + 8, PAL.snow[3]);
  b.line(B + 9, C + 5, B + 6, C + 8, PAL.snow[3]);
  b.line(B, C, B + 14, C, PAL.snow[3]);
  b.set(B + 3, C + 3, PAL.red[3]);
}
