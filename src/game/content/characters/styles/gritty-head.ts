/**
 * Style `gritty` (gritty.ts): VINCENT's head, sculpted for hard light. A small, hard head (about
 * 7½ px chin to crown) turned three-quarters to the viewer, as height fields on the figure's own
 * HdCanvas, so the key light, the cast shadows and the rim fall on it like on the body; the hard
 * shading (deep eye sockets, the nose's shadow, the jaw's underside) is painted on as tone. Then
 * VINCENT's marks: the short dark crop, the heavy dark stubble (a grey-brown jaw with dark
 * speckles), ONE RAISED EYEBROW (the near one, the forehead creased over it; the far one low and
 * flat), the lopsided smirk (the near corner pulled up).
 *
 * Head-local coordinates: logical px, x forward (the face looks right), y down, origin at the
 * skull's centre; the canvas point is A + R(tilt) · (s · local).
 */
import type { Color } from '../../../../engine/color';
import type { Expression } from '../../../art/humanoid';
import type { HdCanvas, Texture } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { GR, colAt } from './gritty-pal';

type V = [number, number];
const DEG = Math.PI / 180;

/** Head size against the body (1 = 7 px chin to crown). */
const HEAD_K = 1.08;

/** Where the neck enters the head (local): under the skull, behind the jaw. */
export const NECK_IN: V = [-0.25, 2.75];

/** The material ids the head uses (made by the painter for this canvas). */
export interface HeadMats {
  skin: number;
  stubble: number;
  hair: number;
}

export interface HeadOpts {
  /** Canvas position of NECK_IN. */
  neck: V;
  /** Degrees, clockwise. */
  tilt: number;
  /** 1, or 2 for the Helium Head. */
  scale: number;
  expr: Expression;
  d: number;
  /** Base depth. */
  z: number;
  /** Darken the whole face (soot). */
  soot?: boolean;
}

// ------------------------------------------------------------------------------------ shapes

/**
 * The face (local), three-quarters: its right contour is the far side's profile (forehead, brow,
 * nose, lips, chin), then the jawline back to the angle under the ear.
 */
const FACE: readonly V[] = [
  [1.9, -2.35],
  [2.55, -1.5],
  [2.85, -0.62],
  [2.68, -0.22],
  [3.05, 0.45],
  [3.52, 1.06],
  [3.42, 1.36],
  [2.98, 1.46],
  [3.0, 1.8],
  [2.9, 2.1],
  [2.96, 2.36],
  [2.76, 2.6],
  [2.98, 2.98],
  [2.62, 3.36],
  [1.2, 3.38],
  [0.0, 2.95],
  [-0.95, 2.1],
  [-1.1, 0.9],
  [-1.0, -0.6],
  [0.0, -2.3],
];

/** Skull ellipse. */
const SK = { cx: -0.4, cy: -0.8, rx: 2.95, ry: 2.8 };

/** Hairline (local): the crop covers the skull above / behind this polygon's inside. */
const HAIR: readonly V[] = [
  [2.5, -2.4],
  [2.0, -2.02],
  [1.2, -2.0],
  [0.35, -1.7],
  [-0.15, -0.9],
  [-0.35, 0.35],
  [-0.55, 0.75],
  [-0.85, 0.2],
  [-0.95, -0.55],
  [-1.95, -0.6],
  [-2.1, 0.3],
  [-1.95, 1.4],
  [-3.7, 0.8],
  [-3.7, -4.3],
  [3.0, -4.3],
];

/** Stubble zone (local): the jaw, chin, upper lip, under the jaw, the sideburn's foot. */
const BEARD: readonly V[] = [
  [-0.45, 0.8],
  [0.5, 1.3],
  [1.5, 1.4],
  [2.55, 1.5],
  [3.5, 1.5],
  [3.5, 3.75],
  [-1.3, 3.75],
  [-1.15, 1.9],
  [-0.75, 1.25],
];

/** The lips (kept clear of stubble). */
const onLips = (x: number, y: number): boolean => Math.abs(y - 2.07) < 0.17 && x > 1.4;

function inPoly(x: number, y: number, pts: readonly V[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyDist(x: number, y: number, pts: readonly V[]): number {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0];
    const ay = pts[j][1];
    const vx = pts[i][0] - ax;
    const vy = pts[i][1] - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 === 0 ? 0 : ((x - ax) * vx + (y - ay) * vy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - vx * t;
    const ey = y - ay - vy * t;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}

function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const a = (x - cx) / sx;
  const b = (y - cy) / sy;
  return Math.exp(-(a * a + b * b));
}

/** Distance from (x, y) to the segment a–b. */
function segDist(x: number, y: number, a: V, b: V): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  let t = ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
}

/** Distance to a polyline. */
function lineDist(x: number, y: number, pts: readonly V[]): number {
  let m = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) m = Math.min(m, segDist(x, y, pts[i], pts[i + 1]));
  return m;
}

/** A rounded rim: 0 at the edge, 1 at `r` inside. */
function roll(dist: number, r: number): number {
  const t = dist >= r ? 1 : dist / r;
  return Math.sqrt(1 - (1 - t) * (1 - t));
}

/** Skull height (local) or NaN. */
function skullH(x: number, y: number): number {
  const a = (x - SK.cx) / SK.rx;
  const b = (y - SK.cy) / SK.ry;
  const q = a * a + b * b;
  if (q > 1) return NaN;
  return Math.sqrt(1 - q) * 2.7;
}

/** Skin height field (local): skull ∪ face, sculpted. */
function skinH(x: number, y: number): number {
  const s = skullH(x, y);
  let f = NaN;
  if (inPoly(x, y, FACE)) {
    const dd = polyDist(x, y, FACE);
    f = 0.35 + roll(dd, 1.1) * 2.1;
  }
  let h = s !== s ? f : f !== f ? s : Math.max(s, f);
  if (h !== h) return NaN;
  // Brow ridge, cheekbone and the hollow under it, nose ridge, chin (soft: the hard shading is painted).
  h += 0.3 * gauss(x, y, 1.6, -0.62, 1.1, 0.22);
  h += 0.25 * gauss(x, y, 0.45, 0.45, 0.6, 0.3);
  h -= 0.18 * gauss(x, y, 0.6, 1.55, 0.6, 0.45);
  h += 0.45 * gauss(x, y, 3.0, 0.75, 0.35, 0.6);
  h += 0.2 * gauss(x, y, 2.3, 2.95, 0.5, 0.32);
  return h * 0.7;
}

/**
 * Hard key light painted on the face (tone offsets, local): the deep eye socket under the brow,
 * the nose's shadow on the upper lip, the shade under the lower lip, the jaw's underside and the
 * front planes turned away from the light; the cheekbone catches it.
 */
function faceShade(x: number, y: number): number {
  let t = 0;
  // Deep-set eyes under the brow (near and far).
  t -= 0.5 * gauss(x, y, 1.2, -0.38, 0.62, 0.45);
  t -= 0.4 * gauss(x, y, 2.45, -0.3, 0.34, 0.36);
  // The nose: its near side plane, its shadow on the upper lip.
  if (segDist(x, y, [2.55, 0.05], [2.72, 1.3]) < 0.12) t -= 0.2;
  t -= 0.42 * gauss(x, y, 3.0, 1.62, 0.38, 0.17);
  // The fold from the nose wing to the near mouth corner (a hard face).
  const fold = segDist(x, y, [2.55, 1.38], [1.5, 1.85]);
  if (fold < 0.18) t -= 0.3 * (1 - fold / 0.18);
  // Under the lower lip.
  t -= 0.28 * gauss(x, y, 2.35, 2.5, 0.48, 0.12);
  // The jaw's underside and the chin's: deep shade under the line jaw angle → chin.
  const line = 2.1 + ((x + 0.95) / 3.45) * 1.25;
  if (y > 2.0 && x < 2.9 && y > line) t -= 0.55;
  // The far side of the face turns away from the light.
  if (x > 2.5) t -= 0.16 * Math.min(1, (x - 2.5) / 0.35);
  // The cheekbone catches the light; the temple and the back of the head turn away.
  t += 0.1 * gauss(x, y, 0.45, 0.5, 0.62, 0.28);
  t -= 0.1 * gauss(x, y, 0.0, -1.0, 0.5, 0.5);
  if (x < -1.0) t -= 0.08;
  return t;
}

/** The ear (local): an oval behind the jaw, the bowl in its middle. */
const EAR = { cx: -1.4, cy: 0.35, rx: 0.55, ry: 0.88 };
function earH(x: number, y: number): number {
  const a = (x - EAR.cx) / EAR.rx;
  const b = (y - EAR.cy) / EAR.ry;
  const q = a * a + b * b;
  if (q > 1) return NaN;
  const bowl = gauss(x, y, EAR.cx + 0.08, EAR.cy + 0.12, 0.28, 0.42);
  return (2.75 + Math.sqrt(1 - q) * 0.55 - bowl * 0.5) * 0.7;
}

/** Hair (local): the crop over the skull above the hairline, a little thicker than the skull. */
function hairH(x: number, y: number): number {
  if (inPoly(x, y, HAIR) === false) return NaN;
  const a = (x - SK.cx) / (SK.rx + 0.16);
  const b = (y - (SK.cy - 0.1)) / (SK.ry + 0.22);
  const q = a * a + b * b;
  if (q > 1) return NaN;
  // A short crop: tousled a little on top, a fringe lifted at the front, a ragged outer edge.
  const ang = Math.atan2(y - SK.cy, x - SK.cx);
  if (q > 0.94 - 0.04 * Math.sin(ang * 11) - 0.03 * Math.sin(ang * 23 + 1)) return NaN;
  const tuft = 0.15 * Math.sin(x * 4.1 + y * 1.7) * Math.max(0, -y - 1.5) / 2;
  const fringe = 0.25 * gauss(x, y, 1.5, -2.2, 0.9, 0.5);
  return (Math.sqrt(Math.max(0, 1 - q)) * 3.0 + 0.25 + tuft + fringe) * 0.7;
}

// ------------------------------------------------------------------------------------ expressions

type Eye = 'squint' | 'open' | 'wide' | 'closed' | 'shut' | 'half';
type Mouth = 'smirk' | 'open' | 'yawn' | 'grit' | 'grin' | 'flat' | 'slack';
type Brow = 'raised' | 'down' | 'up';

function faceOf(e: Expression): { eye: Eye; mouth: Mouth; brow: Brow } {
  switch (e) {
    case 'blink':
      return { eye: 'closed', mouth: 'smirk', brow: 'raised' };
    case 'shout':
      return { eye: 'open', mouth: 'open', brow: 'down' };
    case 'panic':
      return { eye: 'wide', mouth: 'open', brow: 'up' };
    case 'hurt':
      return { eye: 'shut', mouth: 'grit', brow: 'down' };
    case 'happy':
      return { eye: 'closed', mouth: 'grin', brow: 'raised' };
    case 'smile':
      return { eye: 'squint', mouth: 'grin', brow: 'raised' };
    case 'yawn':
      return { eye: 'shut', mouth: 'yawn', brow: 'up' };
    case 'chew':
      return { eye: 'squint', mouth: 'flat', brow: 'raised' };
    case 'dazed':
      return { eye: 'half', mouth: 'slack', brow: 'up' };
    default:
      return { eye: 'squint', mouth: 'smirk', brow: 'raised' };
  }
}

// ------------------------------------------------------------------------------------ draw

/**
 * Draw the head (and the neck from `neckBase`, canvas) on the canvas. Returns the part ids of
 * the head (for the Helium rim) and the canvas centre of the head (the `head` point).
 */
export function drawHead(c: HdCanvas, m: HeadMats, o: HeadOpts, neckBase: V, neckZ: number): { parts: number[]; center: V } {
  const d = o.d;
  const s = o.scale * HEAD_K;
  const cs = Math.cos(o.tilt * DEG);
  const sn = Math.sin(o.tilt * DEG);
  // A = neck − R · (s · NECK_IN)
  const A: V = [o.neck[0] - (cs * NECK_IN[0] - sn * NECK_IN[1]) * s, o.neck[1] - (sn * NECK_IN[0] + cs * NECK_IN[1]) * s];
  const toC = (x: number, y: number): V => [A[0] + (cs * x - sn * y) * s, A[1] + (sn * x + cs * y) * s];
  const toL = (X: number, Y: number): V => {
    const x = (X - A[0]) / s;
    const y = (Y - A[1]) / s;
    return [cs * x + sn * y, -sn * x + cs * y];
  };
  const R = 4.6 * s;
  const bx = A[0] - R;
  const by = A[1] - R;
  const field = (f: (x: number, y: number) => number) => (X: number, Y: number): number => {
    const [x, y] = toL(X, Y);
    const h = f(x, y);
    return h !== h ? NaN : h * s;
  };
  const face = faceOf(o.expr);

  // The neck: a column from the collar into the head, in the jaw's shadow, stubbled at the top.
  const neckPart = c.newPart();
  const nIn = toC(NECK_IN[0] + 0.25, NECK_IN[1] - 0.4);
  c.capsule(neckBase[0], neckBase[1] + 0.4, nIn[0], nIn[1], 1.2 * Math.min(s, 1.3), 1.1 * Math.min(s, 1.3), {
    mat: m.skin,
    z: neckZ,
    part: neckPart,
    round: 0.8,
    tone: -0.12,
    tex: (sm) => {
      const [, ly] = toL(sm.x, sm.y);
      if (ly < 3.05) sm.mat = m.stubble;
    },
  });

  const skinPart = c.newPart();
  const beardTex: Texture = (sm) => {
    const [x, y] = toL(sm.x, sm.y);
    sm.tone += faceShade(x, y);
    if (inPoly(x, y, BEARD)) {
      // The lips stay skin.
      // At 1× only the jaw's edge (a stubble mask would swallow the 7 px face).
      if (!onLips(x, y) && (d > 1 || y > 2.35)) {
        // A ragged top edge to the stubble.
        const edgeD = polyDist(x, y, BEARD);
        if (edgeD > 0.1 || hash2(sm.X, sm.Y, 7) > 0.5) sm.mat = m.stubble;
      }
    }
    if (o.soot) sm.tone -= 0.25;
  };
  c.heightField(bx, by, 2 * R, 2 * R, field(skinH), { mat: m.skin, z: o.z, part: skinPart, tex: beardTex });
  const earPart = c.newPart();
  c.heightField(bx, by, 2 * R, 2 * R, field(earH), { mat: m.skin, z: o.z + 0.6, part: earPart, tone: -0.04, tex: (sm) => {
    const [x, y] = toL(sm.x, sm.y);
    // The helix rim lit, the canal dark.
    if (gauss(x, y, EAR.cx + 0.1, EAR.cy + 0.15, 0.16, 0.22) > 0.5) sm.tone -= 0.35;
  } });
  const hairPart = c.newPart();
  c.heightField(bx, by, 2 * R, 2 * R, field(hairH), {
    mat: m.hair,
    z: o.z + 0.6,
    part: hairPart,
    tex: (sm) => {
      const [x, y] = toL(sm.x, sm.y);
      // Short strands combed back and down: fine dark grooves at 4×, a lit tip here and there.
      const k = d >= 4 ? 5.6 : 3.2;
      const v = Math.sin((x * 0.6 + y * 1.0) * k + Math.sin(x * 2.3 + y) * 1.4);
      if (v > 0.6) sm.tone -= 0.32;
      else if (v < -0.8 && d >= 4) sm.tone += 0.22;
      // The hair thins to skin at the temple and nape edge.
      if (inPoly(x, y, HAIR) && polyDist(x, y, HAIR) < 0.18 && hash2(sm.X, sm.Y, 3) > 0.5) sm.tone -= 0.2;
    },
  });

  paintFace(c, o, face, toC, toL, A, s, [skinPart, earPart, hairPart]);
  const center = toC(0.0, -0.6);
  return { parts: [skinPart, earPart, hairPart], center };
}

/** Eyes, brows, forehead creases, nostril, mouth, stubble speckle: fixed colours (unlit), only on the head's own px. */
function paintFace(
  c: HdCanvas,
  o: HeadOpts,
  face: { eye: Eye; mouth: Mouth; brow: Brow },
  toC: (x: number, y: number) => V,
  toL: (X: number, Y: number) => V,
  A: V,
  s: number,
  parts: readonly number[],
): void {
  const d = o.d;
  const col = (cc: Color): Color => colAt(cc, d);
  const dark = col(GR.hair[0]);
  const brow = col(GR.hair[3]);
  const lid = col(GR.skin[0]);
  const crease = col(GR.skin[1]);
  const white = col(GR.eyeWhite[1]);
  const whiteSh = col(GR.eyeWhite[0]);
  const iris = col(GR.hair[3]);
  const lipCol = col(GR.skin[0]);
  const lipLit = col(GR.skin[4]);
  const teeth = col(GR.shirt[3]);
  const mouthIn = col(GR.hair[0]);
  const stub = col(GR.hair[1]);
  const stub2 = col(GR.stubble[1]);
  const R = 4.6 * s;
  const bx = A[0] - R;
  const by = A[1] - R;
  const own = new Set(parts);
  /** Paint only over the head (a nearer arm or gun keeps its px); `edge` may also start new px. */
  const mine = (AX: number, AY: number, edge = false): boolean => {
    if (AX < 0 || AY < 0 || AX >= c.W || AY >= c.H) return false;
    const i = AY * c.W + AX;
    return c.mat[i] === 0 ? edge : own.has(c.part[i]);
  };

  if (d === 1) {
    // 1×: a few deliberate px (the eyes, the raised brow, the mouth) on the 7 px head.
    const px = (x: number, y: number, cc: Color): void => {
      const p = toC(x, y);
      if (mine(Math.floor(p[0]), Math.floor(p[1]))) c.dot(p[0], p[1], cc);
    };
    const shut = face.eye === 'closed' || face.eye === 'shut';
    px(1.25, -0.1, shut ? lid : dark);
    px(2.45, -0.1, shut ? lid : dark);
    px(1.15, face.brow === 'raised' ? -1.05 : -0.65, dark);
    if (face.mouth === 'open' || face.mouth === 'yawn' || face.mouth === 'slack') px(2.45, 2.25, mouthIn);
    else px(2.1, 2.05, lipCol);
    return;
  }

  const fine = d >= 4;
  const lw = (fine ? 0.13 : 0.26) / s; // a line's half width (about one art px), local

  // Brows: the near one high and arched (raised), the far one low and flat.
  const nearBrow: V[] =
    face.brow === 'raised'
      ? [[0.55, -0.66], [0.88, -1.12], [1.32, -1.3], [1.86, -1.0]]
      : face.brow === 'up'
        ? [[0.55, -0.8], [1.15, -1.05], [1.85, -0.92]]
        : [[0.55, -0.62], [1.2, -0.5], [1.9, -0.32]];
  const farBrow: V[] =
    face.brow === 'up' ? [[2.2, -0.82], [2.78, -0.8]] : face.brow === 'down' ? [[2.2, -0.36], [2.78, -0.24]] : [[2.18, -0.5], [2.8, -0.42]];
  const browW = (fine ? 0.16 : 0.26) / Math.sqrt(s);
  // Forehead creases over the raised brow (4×).
  const creases: V[][] = face.brow === 'raised' && fine ? [[[0.8, -1.68], [1.3, -1.82], [1.75, -1.7]]] : [];

  // The eyes: the near one an almond in its deep socket, the far one short (turned away).
  const eyes = [
    { x: 1.22, y: -0.12, len: 0.46, far: false },
    { x: 2.46, y: -0.1, len: 0.22, far: true },
  ];
  const eyeOpen = face.eye === 'wide' ? 0.28 : face.eye === 'open' ? 0.22 : face.eye === 'squint' ? 0.16 : face.eye === 'half' ? 0.1 : 0;

  // Mouth (three-quarters: the near corner at x ≈ 1.45, the far one at the profile).
  let mouth: V[] = [];
  let open: { cx: number; cy: number; rx: number; ry: number } | null = null;
  switch (face.mouth) {
    case 'smirk':
      // Lopsided: the near corner pulled up into the cheek, the far side flat.
      mouth = [[1.42, 1.72], [1.75, 1.98], [2.35, 2.08], [2.95, 2.06]];
      break;
    case 'grin':
      mouth = [[1.38, 1.66], [1.75, 1.94], [2.4, 2.03], [2.95, 1.98]];
      break;
    case 'flat':
      mouth = [[1.65, 2.05], [2.95, 2.08]];
      break;
    case 'grit':
      mouth = [[1.65, 2.08], [2.95, 2.08]];
      open = { cx: 2.32, cy: 2.1, rx: 0.62, ry: 0.13 };
      break;
    case 'open':
      open = { cx: 2.42, cy: 2.25, rx: 0.5, ry: 0.38 };
      break;
    case 'yawn':
      open = { cx: 2.38, cy: 2.4, rx: 0.52, ry: 0.56 };
      break;
    case 'slack':
      open = { cx: 2.5, cy: 2.22, rx: 0.36, ry: 0.2 };
      break;
  }

  c.paint(bx, by, 2 * R, 2 * R, (X, Y, AX, AY) => {
    const [x, y] = toL(X, Y);
    if (x < 0.2 || x > 3.7 || y < -2.2 || y > 3.4) return 0;
    if (!mine(AX, AY)) return 0;
    // Brows: a dark lower edge, the hair's tone above.
    const nb = lineDist(x, y, nearBrow);
    if (nb < browW) return y < lerpY(nearBrow, x) - browW * 0.25 ? brow : dark;
    if (lineDist(x, y, farBrow) < browW * 0.85) return dark;
    for (const cr of creases) if (lineDist(x, y, cr) < lw * 0.9) return crease;
    // Eyes.
    for (const e of eyes) {
      const dx = (x - e.x) / e.len;
      if (Math.abs(dx) >= 1) continue;
      const half = eyeOpen * (e.far ? 0.85 : 1) * Math.sqrt(1 - dx * dx);
      const lidY = e.y - half;
      if (eyeOpen === 0) {
        if (Math.abs(y - (e.y + 0.05 * (1 - dx * dx))) < lw * (face.eye === 'shut' ? 1.7 : 1.15)) return dark;
        continue;
      }
      // The heavy upper lid, thicker at the outer corner.
      if (y <= lidY + lw * 0.2 && y > lidY - lw * (dx < 0 ? 1.6 : 1.1)) return dark;
      if (y > lidY && y < e.y + half) {
        // The iris looks ahead; a catchlight on the near eye at 4×.
        const ix = e.x + e.len * (e.far ? 0.2 : 0.3);
        if (Math.abs(x - ix) < (e.far ? 0.12 : 0.17)) {
          if (fine && !e.far && Math.abs(x - (ix - 0.06)) < 0.07 && y < lidY + 0.1) return white;
          return iris;
        }
        return x < e.x - e.len * 0.2 ? whiteSh : e.far ? whiteSh : white;
      }
      if (!e.far && Math.abs(y - (e.y + half + lw * 0.6)) < lw * 0.7 && dx > -0.7) return lid;
    }
    // The nostril.
    if (Math.hypot((x - 3.04) / 0.16, (y - 1.32) / 0.1) < 1) return lid;
    // Mouth.
    if (open) {
      const q = Math.hypot((x - open.cx) / open.rx, (y - open.cy) / open.ry);
      if (q < 1) {
        if (face.mouth === 'grit') return Math.abs(y - open.cy) < 0.05 ? lid : teeth;
        if (y < open.cy - open.ry * 0.5 && face.mouth !== 'slack') return teeth;
        return mouthIn;
      }
      if (q < 1.3 && y > open.cy) return lipLit;
    }
    if (mouth.length > 1) {
      const md = lineDist(x, y, mouth);
      if (md < lw * 1.1) return lipCol;
    }
    // The smirk's crease at the raised corner.
    if ((face.mouth === 'smirk' || face.mouth === 'grin') && segDist(x, y, [1.36, 1.58], [1.28, 1.9]) < lw * 0.8) return crease;
    // Heavy stubble: sparse dark speckles on the jaw, chin and upper lip (4×: more; 2×: few).
    if (inPoly(x, y, BEARD) && x < 3.25 && !onLips(x, y)) {
      const k = hash2(AX, AY, 11);
      const deep = y > 2.4 || x < 0.5 ? 0.14 : 0.09;
      if (k < (fine ? deep : deep * 0.5)) return k < 0.05 ? stub : stub2;
    }
    return 0;
  }, o.z + 3);
}

/** y of a polyline at x (for which side of a brow a px is). */
function lerpY(pts: readonly V[], x: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a[0] && x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}
