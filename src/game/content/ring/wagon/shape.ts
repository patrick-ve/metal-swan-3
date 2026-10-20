/**
 * The ring wagon's shapes and liveries as SAMPLES in continuous local coordinates (geometry.ts):
 * `sampleGrid(look, d)` evaluates the whole car once per art px (d = 1 for the 1× art, 2 / 4 for
 * the HD art), so every density draws the same car and every frame keeps its 1× geometry.
 *
 * The car is a side profile extruded across its width (the glass leans in toward the roof), seen
 * by a level camera from its right side. A VIEW turns it about the vertical axis (`yaw`: + turns
 * the nose toward the camera, π shows the left side facing left) or pitches it about a wheel
 * (`pitch`: + dips the nose). Per row the cross-section is a rectangle, so a turned car shows one
 * side face and one end face (the front or the tailgate) — enough for the lane-change lean, the
 * handbrake turn and the wreck spin. Roof gear, mirrors, the push bar and (in the spin frames) the
 * wheels are small 3D primitives projected the same way.
 *
 * A sample says WHAT is at an art px (`mat`), its tone offset, a bevel height (the HD art lights it),
 * the face normal, its depth and its part (separations and ambient occlusion between parts).
 */
import { inPoly, polyDist } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { BAND, BAR, CAR, LETTERS, RACK, SEAT, type BodyPose, type BodyState, type Livery, type Pt } from './geometry';
import { textCells, textField, type TextOpts } from './font';

// ---------------------------------------------------------------------------------------------
// Materials and parts
// ---------------------------------------------------------------------------------------------

/** What a sample is made of (the 1× colours and the HD materials key on it). */
export const M = {
  NONE: 0,
  PAINT: 1,
  CAMO_D: 2,
  CAMO_B: 3,
  LET_Y: 4,
  LET_P: 5,
  BAND_O: 6,
  BAND_Y: 7,
  NAVY: 8,
  LET_W: 9,
  PLASTIC: 10,
  BLACK: 11,
  GLASS: 12,
  /** The glass of a body frame: a hole (the cabin strip and the driver show through). */
  HOLE: 13,
  CHROME: 14,
  STEEL: 15,
  RED: 16,
  AMBER: 17,
  CLEAR: 18,
  PLATE: 19,
  WELL: 20,
  TYRE: 21,
  RIM: 22,
  CAN: 23,
  PINK: 24,
  LEAF: 25,
  DRINK: 26,
  LIME: 27,
  ICE: 28,
  /** Glass glints and cracks over the holes (fixed px). */
  GLINT: 29,
  CRACK: 30,
  GRILLE: 31,
  SOOT: 32,
  STRAP: 33,
  /** The interior seen through the glass (cabin strip). */
  CABIN: 34,
  SEAT: 35,
  FAR: 36,
  GLOVE: 37,
  PLATE_TEXT: 38,
} as const;

/** Part groups (the HD art draws one field per part: separations and AO where they meet). */
export const PART = {
  BODY: 1,
  TRIM: 2,
  PILLAR: 3,
  LIGHT: 4,
  MIRROR: 5,
  RAIL: 6,
  RACK: 7,
  LAMP_N: 8,
  LAMP_F: 9,
  TYRE: 10,
  CAN: 11,
  BAR: 12,
  BARLAMP: 13,
  WHEEL: 14,
  GLASS: 18,
  WELL: 19,
  CABIN: 20,
} as const;

export interface Sample {
  mat: number;
  /** Tone offset in ramp steps (1× art) — the HD art scales it. */
  tone: number;
  /** Bevel height (logical px) for the HD light. */
  h: number;
  /** World normal of the face (X right, Z toward the camera). */
  nx: number;
  nz: number;
  /** Depth toward the camera (larger = nearer). */
  depth: number;
  part: number;
  /** Fixed px (lettering at 1×, glints, cracks): the 1× art takes its colour as is. */
  fixed: boolean;
}

function blank(): Sample {
  return { mat: M.NONE, tone: 0, h: 0, nx: 0, nz: 1, depth: -1e9, part: 0, fixed: false };
}

// ---------------------------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------------------------

export interface View {
  /** Yaw (rad): 0 the right side facing right; + the nose turns toward the camera; π the left side. */
  readonly yaw: number;
  /** Pitch (rad, + dips the nose) about `pivot` (local). Only views with yaw 0 pitch. */
  readonly pitch: number;
  readonly pivot: Pt;
}

const DEG = Math.PI / 180;

/** The views of the body poses (geometry.ts POSES). */
export const POSE_VIEW: Readonly<Record<BodyPose, View>> = {
  level: { yaw: 0, pitch: 0, pivot: [0, 0] },
  up: { yaw: 0, pitch: -1.3 * DEG, pivot: [CAR.wheelX[0], CAR.wheelY] },
  down: { yaw: 0, pitch: 1.3 * DEG, pivot: [CAR.wheelX[1], CAR.wheelY] },
  far: { yaw: -8 * DEG, pitch: 0, pivot: [0, 0] },
  near: { yaw: 8 * DEG, pitch: 0, pivot: [0, 0] },
};

/** The left side, facing left (the boarding scene, the wreck). */
export const LEFT_VIEW: View = { yaw: Math.PI, pitch: 0, pivot: [0, 0] };

/** Spin frame k (0 … 7): k · 45°. */
export function spinView(k: number): View {
  return { yaw: k * 45 * DEG, pitch: 0, pivot: [0, 0] };
}

/** Screen position of a local point (x, y) at lateral z (+ the near / right side) in a view. */
export function project(v: View, x: number, y: number, z: number, out: [number, number]): [number, number] {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  let X = x * c - z * s;
  let Y = y;
  if (v.pitch !== 0) {
    const [px, py] = v.pivot;
    const cp = Math.cos(v.pitch);
    const sp = Math.sin(v.pitch);
    const dx = X - px;
    const dy = Y - py;
    X = px + dx * cp - dy * sp;
    Y = py + dx * sp + dy * cp;
  }
  out[0] = X;
  out[1] = Y;
  return out;
}

/** The side point (x, y) of the near side in a view (for the people, the window and the fx). */
export function sidePoint(v: View, x: number, y: number, out: [number, number]): [number, number] {
  const z = Math.cos(v.yaw) >= 0 ? halfWidth(y) : -halfWidth(y);
  return project(v, x, y, z, out);
}

// ---------------------------------------------------------------------------------------------
// The body's geometry
// ---------------------------------------------------------------------------------------------

const P = CAR.profile;

/** Half the width at height y: 17 below the belt, leaning in to 14.5 at the roof. */
export function halfWidth(y: number): number {
  if (y >= CAR.beltY) return CAR.width / 2;
  const t = Math.min(1, (CAR.beltY - y) / (CAR.beltY + 27.7));
  return (CAR.width + (CAR.roofWidth - CAR.width) * t) / 2;
}

/** Inside the side profile (the arches not cut). */
export function inProfile(x: number, y: number): boolean {
  return inPoly(x, y, P);
}

/** Front-most and rear-most x of the profile at height y (NaN outside its height). */
function extent(y: number, front: boolean): number {
  let best = NaN;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > y !== yj > y) {
      const x = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (Number.isNaN(best) || (front ? x > best : x < best)) best = x;
    }
  }
  return best;
}

export function frontX(y: number): number {
  return extent(y, true);
}

export function rearX(y: number): number {
  return extent(y, false);
}

/** Distance to the nearer wheel centre. */
export function wheelDist(x: number, y: number): number {
  let best = Infinity;
  for (const wx of CAR.wheelX) best = Math.min(best, Math.hypot(x - wx, y - CAR.wheelY));
  return best;
}

export type BandPart = 'glass' | 'pillar' | 'seal' | null;

/** What the window band shows at (x, y): side glass, a black pillar (B, C), the rubber seal (HD), or nothing. */
export function bandPart(x: number, y: number, seal = 0): BandPart {
  if (!inPoly(x, y, CAR.band)) return null;
  if (x >= CAR.pillarB[0] && x < CAR.pillarB[1]) return 'pillar';
  if (x >= CAR.pillarC[0] && x < CAR.pillarC[1]) return 'pillar';
  if (seal > 0 && polyDist(x, y, CAR.band) < seal) return 'seal';
  return 'glass';
}

/** Which side window holds x: 0 the front door, 1 the rear door (open: the hero), 2 the rear quarter. */
export function windowOf(x: number): 0 | 1 | 2 {
  if (x >= CAR.pillarB[1]) return 0;
  if (x >= CAR.pillarC[1]) return 1;
  return 2;
}

/** A rolled edge: height over distance e from an edge with roll radius r. */
export function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/** Smooth value noise in [0, 1). */
function vnoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const e = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
}

/** The camouflage of the green wagon at a face point: 0 paint, 1 dark green, 2 black. */
export function camoAt(u: number, y: number, seed: number): 0 | 1 | 2 {
  const v = 0.62 * vnoise(u / 8.5 + 3.1, y / 4.2 + 1.7, seed) + 0.38 * vnoise(u / 4.4, y / 2.6, seed + 7);
  if (v > 0.66) return 2;
  if (v > 0.53) return 1;
  return 0;
}

/** Dent spots of a damage state (local side coordinates, the same at every density). */
export function dents(state: number): ReadonlyArray<Pt> {
  if (state === 0) return [];
  const one: Pt[] = [[-31.5, -14.5], [11.5, -13.5], [34.5, -13.0]];
  if (state === 1) return one;
  const two: Pt[] = [...one, [-7.5, -6.5], [-38.5, -8.0], [24.5, -15.5]];
  return state === 2 ? two : [...two, [-15.5, -14.0], [40.0, -14.6], [3.5, -7.0]];
}

/** Soot over the bonnet and the front (state 3): 0 … 1. */
export function sootAt(x: number, y: number): number {
  return Math.max(0, 1 - Math.hypot((x - 37) / 10.5, (y + 15.5) / 5.5));
}

/** A crack line in a glass pane (state ≥ 2): the front door glass and the rear quarter glass. */
export function crackAt(x: number, y: number, state: number, k = 0.28): boolean {
  if (state < 2) return false;
  const centres: Pt[] = state >= 3 ? [[12.5, -21.5], [-33.0, -20.5]] : [[-33.0, -20.5]];
  for (const [cx, cy] of centres) {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r > 6.5) continue;
    // Five radial cracks and one ring.
    const a = Math.atan2(dy, dx);
    for (let i = 0; i < 5; i++) {
      const ai = i * 1.31 + 0.4;
      let da = Math.abs(a - ai) % (Math.PI * 2);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da * r < k && r < 6.5 - i * 0.6) return true;
    }
    if (Math.abs(r - 2.2) < k * 0.6) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Lettering and icons (never mirrored: laid out in each side's screen coordinates)
// ---------------------------------------------------------------------------------------------

interface Lettering {
  /** 1×: the set of cells (key `x,y`). */
  readonly cells: ReadonlySet<string>;
  /** HD: distance to the strokes minus the radius (≤ 0 inside). */
  readonly field: (x: number, y: number) => number;
  readonly mat: number;
}

function lettering(text: string, box: readonly number[], mat: number, o: TextOpts): Lettering {
  return {
    cells: new Set(textCells(text, box, o).map(([x, y]) => `${x},${y}`)),
    field: textField(text, box, o),
    mat,
  };
}

/** The green wagon's lettering per side (`u` = the side's screen x). */
const GREEN_RIGHT: readonly Lettering[] = [
  lettering('ARTISANAL', LETTERS.artisanal, M.LET_Y, { weight: 0.44, align: 0.5 }),
  lettering('GRAPE', LETTERS.grape, M.LET_Y, { weight: 0.44, align: 0.5 }),
];
const GREEN_LEFT: readonly Lettering[] = [
  lettering('MAJOR', LETTERS.major, M.LET_P, { size: 'big', weight: 0.3, align: 0.5 }),
  lettering('COCKTAILS', LETTERS.cocktails, M.LET_P, { weight: 0.32, align: 0.5 }),
];

/** The white wagon's `ROZZERS` (scaled into its box) and `619` (HD only; 1× hints). */
const ROZZERS_HD = textField('ROZZERS', [BAND.box[0] + 0.9, BAND.box[1] - 0.9, BAND.box[2] + 1.3, BAND.box[3] - 1.2], { weight: 0.5, align: 0.5, scale: 0.43 });
const N619_HD = textField('619', [BAND.num[0], BAND.num[1], BAND.num[2], BAND.num[3]], { weight: 0.48, align: 0.5, scale: 0.55, scaleY: 0.8 });
const ROZZERS_HD_LEFT = textField('ROZZERS', [-BAND.box[1] + 0.9, -BAND.box[0] - 0.9, BAND.box[2] + 1.3, BAND.box[3] - 1.2], { weight: 0.5, align: 0.5, scale: 0.43 });
const N619_HD_LEFT = textField('619', [-BAND.num[1], -BAND.num[0], BAND.num[2], BAND.num[3]], { weight: 0.48, align: 0.5, scale: 0.55, scaleY: 0.8 });
/** The small script line on the white wagon's rear door (4× only: a hint of handwriting). */
const SCRIPT = { x0: -19.6, x1: -3.0, y: -11.9 } as const;

/** The pink grape bunch (right side): grape centres and the leaf. */
const GRAPES: readonly Pt[] = [
  [15.9, -15.6],
  [17.1, -15.6],
  [18.2, -15.4],
  [16.4, -14.4],
  [17.6, -14.3],
  [16.9, -13.2],
  [16.6, -12.2],
];

function grapeIcon(x: number, y: number, d: number): number {
  if (d === 1) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    // 1×: a leaf on top, then a bunch tapering down.
    if (cy === -17 && cx === 16) return M.LEAF;
    if (cy === -16 && cx >= 15 && cx <= 17) return M.PINK;
    if (cy === -15 && cx >= 15 && cx <= 18) return M.PINK;
    if (cy === -14 && cx >= 16 && cx <= 17) return M.PINK;
    if (cy === -13 && cx === 16) return M.PINK;
    return 0;
  }
  // HD: the stem and the leaf, then round grapes.
  if (Math.hypot((x - 17.5) / 1.1, (y + 16.9) / 0.55) < 1) return M.LEAF;
  if (Math.abs(x - 16.7) < 0.2 && y > -17.2 && y < -16.2) return M.LEAF;
  for (const [gx, gy] of GRAPES) if (Math.hypot(x - gx, y - gy) < 0.62) return M.PINK;
  return 0;
}

/** The cocktail glass (left side, in the left frame's screen x): lime, straw, drink, stem, foot. */
function cocktailIcon(u: number, y: number, d: number): number {
  const [x0, , y0] = LETTERS.glass;
  const lx = u - x0;
  const ly = y - y0;
  if (d === 1) {
    const cx = Math.floor(lx);
    const cy = Math.floor(ly);
    if (cy === 0) return cx === 0 ? M.LIME : cx === 2 ? M.STRAP : 0;
    if (cy === 1 || cy === 2) return cx >= 0 && cx <= 2 ? M.DRINK : 0;
    if (cy === 3) return cx === 1 ? M.DRINK : 0;
    if (cy === 4) return cx === 1 ? M.ICE : 0;
    if (cy === 5) return cx >= 0 && cx <= 2 ? M.ICE : 0;
    return 0;
  }
  // HD (box 3.4 × 6.2): the lime slice, the straw, the hurricane glass with its drink, the foot.
  if (Math.hypot(lx - 0.8, ly - 1.0) < 0.85) return Math.hypot(lx - 0.8, ly - 1.0) < 0.55 ? M.LIME : M.LEAF;
  if (Math.abs(lx - 2.6 + (ly - 0.4) * 0.25) < 0.14 && ly > 0 && ly < 2.4) return M.STRAP;
  const bowl = ly > 1.6 && ly < 4.4 && Math.abs(lx - 1.7) < 1.05 - Math.max(0, ly - 3.2) * 0.55;
  if (bowl) return ly > 1.9 ? M.DRINK : M.ICE;
  if (Math.abs(lx - 1.7) < 0.16 && ly >= 4.4 && ly < 5.6) return M.ICE;
  if (Math.abs(lx - 1.7) < 0.9 && ly >= 5.5 && ly < 5.95) return M.ICE;
  return 0;
}

// ---------------------------------------------------------------------------------------------
// The faces
// ---------------------------------------------------------------------------------------------

/** The look of one frame. */
export interface Look {
  readonly livery: Livery;
  readonly state: BodyState;
  readonly view: View;
  /** Glass: 'hole' (body frames: the cabin shows through), 'opaque' (spin frames). */
  readonly glass: 'hole' | 'opaque';
  /** Draw the wheels in the frame (spin frames). */
  readonly wheels: boolean;
  /** Only the cabin (the interior through the glass and the wheel wells). */
  readonly cabin?: boolean;
}

/** Distance from (x, y) to the nearest door shut line (side face). */
function seamDist(x: number, y: number): number {
  let e = 9;
  if (y > CAR.seamTop + 0.2) {
    for (let i = 0; i < CAR.seams.length; i++) if (y < CAR.seamBottom[i]) e = Math.min(e, Math.abs(x - CAR.seams[i]));
  }
  // The bonnet's shut line under its edge along the wing.
  if (x > 22.4 && x < 44.4) {
    const top = -17.8 + ((x - 22.5) * 1.2) / 22.1;
    e = Math.min(e, Math.abs(y - (top + 0.7)));
  }
  return e;
}

/** The side face at side coordinates (x, y): fills `o`; false = not on the body. */
function sideSurf(look: Look, left: boolean, x: number, y: number, d: number, o: Sample): boolean {
  if (!inProfile(x, y)) return false;
  const L = look.livery;
  const st = look.state;
  o.tone = 0;
  o.fixed = false;
  const wd = wheelDist(x, y);
  if (wd < CAR.archR) {
    o.mat = M.WELL;
    o.part = PART.WELL;
    o.h = -1.5;
    return true;
  }
  const edge = Math.min(polyDist(x, y, P), wd - CAR.archR);
  const bp = bandPart(x, y, d > 1 ? 0.3 : 0);
  if (bp !== null) {
    if (bp === 'glass') {
      o.part = PART.GLASS;
      o.h = 0;
      const w = windowOf(x);
      if (look.cabin) {
        o.mat = M.HOLE;
        return true;
      }
      if (look.glass === 'opaque') {
        o.mat = M.GLASS;
        o.tone = y < CAR.glassTop + 1.2 ? 1 : y > CAR.beltY - 1.5 ? -1 : 0;
        const u = x + (y - CAR.beltY) * 0.6;
        if ((u + 40) % 21 < 1.1) o.tone = 2;
        return true;
      }
      o.mat = M.HOLE;
      // Glints on the closed panes (the rear door window is open: the hero sits in it), cracks.
      if (w !== 1) {
        const g = x - (w === 0 ? 9.5 : -33.5) + (y - CAR.beltY) * 0.55;
        if (crackAt(x, y, st, d === 1 ? 0.5 : 0.22)) {
          o.mat = M.CRACK;
          o.fixed = true;
        } else if (g >= 0 && g < (d === 1 ? 1 : 0.8)) {
          o.mat = M.GLINT;
          o.fixed = true;
        } else if (g >= 1.8 && g < 2.3 && d > 1) {
          o.mat = M.GLINT;
          o.tone = -1;
          o.fixed = true;
        }
      }
      return true;
    }
    o.mat = M.BLACK;
    o.part = PART.PILLAR;
    o.h = bp === 'seal' ? 0.15 : 0.35 + roll(polyDist(x, y, CAR.band), 0.6) * 0.4;
    return true;
  }
  if (look.cabin) return false;
  // The tall tail light up the rear pillar.
  const T = CAR.tail;
  if (x < T.x1 && y > T.y0 && y < T.y1) {
    o.part = PART.LIGHT;
    o.mat = y > T.amber ? M.AMBER : y > T.reverse ? M.CLEAR : M.RED;
    o.h = roll(Math.min(T.x1 - x, y - T.y0, T.y1 - y) + 0.3, 0.9);
    if (d > 1 && o.mat === M.RED && Math.abs(((y - T.y0) % 1.6) - 0.8) < 0.12) o.tone = -1;
    return true;
  }
  // The corner light: the amber indicator, then the headlight's glass round the corner.
  const C = CAR.corner;
  if (x > C.x0 && y > C.y0 && y < C.y1) {
    o.part = PART.LIGHT;
    o.mat = x < C.x1 ? M.AMBER : M.CLEAR;
    o.h = roll(Math.min(y - C.y0, C.y1 - y, x - C.x0) + 0.2, 0.7);
    return true;
  }
  // Bumpers (side pieces) and the rubbing strip.
  const strip = y >= CAR.strip[0] && y < CAR.strip[1];
  if ((y >= CAR.bumperTop && (x > CAR.bumperFront || x < CAR.bumperRear)) || strip) {
    o.part = PART.TRIM;
    o.mat = M.PLASTIC;
    const top = strip ? y - CAR.strip[0] : y - CAR.bumperTop;
    o.h = 0.4 + roll(Math.min(top, edge, strip ? CAR.strip[1] - y : 9) + 0.15, 0.6) * 0.8;
    if (st === 3 && x > 43 && y > -6) o.h -= 0.6;
    return true;
  }
  // The painted body.
  o.part = PART.BODY;
  o.mat = M.PAINT;
  let h = roll(edge, 2.2);
  // The panel folds in under the glass, the shoulder under the windows, the waist below it.
  const sb = y - CAR.beltY;
  if (x > CAR.dPillar && x < 19.5 && sb > 0) h += 0.7 * Math.exp(-(((sb - 1.2) / 0.8) ** 2)) - 0.25 * Math.exp(-(((sb - 3.2) / 1.3) ** 2));
  // The lower doors tuck under, the nose and the tailgate turn away.
  if (y > -7.5) h -= (y + 7.5) * 0.4;
  if (x > 44.2) h -= (x - 44.2) * 0.5;
  if (x < -45) h -= (-45 - x) * 0.6;
  // The bonnet edge along the wing rolls up into the bonnet.
  if (x > 22 && y < -15) h += 0.3;
  for (const [dx, dy] of dents(st)) {
    const q = ((x - dx) ** 2 + (y - dy) ** 2) / 1.5;
    if (q < 5) h -= 0.9 * Math.exp(-q);
  }
  if (st === 3) h += 1.2 * Math.exp(-(((x - 32) / 3) ** 2)) * Math.exp(-(((y + 16.6) / 0.9) ** 2));
  o.h = h;
  // Shut lines, the handles, the fuel flap.
  const se = seamDist(x, y);
  if (se < (d === 1 ? 0.5 : 0.2)) o.tone = -1;
  for (const [h0, h1, hy] of CAR.handles) if (x >= h0 && x < h1 && y >= hy - (d === 1 ? 0.5 : 0.35) && y < hy + (d === 1 ? 0.5 : 0.35)) o.tone = -1;
  if (!left && Math.abs(Math.hypot(x - CAR.fuel[0], y - CAR.fuel[1]) - CAR.fuel[2]) < (d === 1 ? 0 : 0.14)) o.tone = -1;
  // The livery.
  const u = left ? -x : x;
  if (L === 'green') greenSide(left, u, x, y, d, o, Math.abs(Math.cos(look.view.yaw)) < 0.9);
  else whiteSide(left, u, x, y, d, o);
  // Soot (state 3) over the front.
  if (st === 3) {
    const q = sootAt(x, y) * (0.75 + 0.5 * hash2(Math.floor(x * 1.5), Math.floor(y * 1.5), 7));
    if (q > 0.55) o.tone -= 2;
    else if (q > 0.25) o.tone -= 1;
  }
  return true;
}

function inCells(set: ReadonlySet<string>, x: number, y: number): boolean {
  return set.has(`${Math.floor(x)},${Math.floor(y)}`);
}

function greenSide(left: boolean, u: number, x: number, y: number, d: number, o: Sample, turned: boolean): void {
  const camo = camoAt(x, y, left ? 23 : 11);
  if (camo === 2) o.mat = M.CAMO_B;
  else if (camo === 1) o.mat = M.CAMO_D;
  // 1×: a side turned well away squashes the capitals into noise: a plain stripe hint instead.
  if (turned && d === 1) {
    for (const t of left ? GREEN_LEFT : GREEN_RIGHT) if (t.field(u, y) <= -0.05 && Math.floor(y) % 2 === 0) o.mat = t.mat;
    return;
  }
  const list = left ? GREEN_LEFT : GREEN_RIGHT;
  for (const t of list) {
    if (d === 1 ? inCells(t.cells, u, y) : t.field(u, y) <= 0) {
      o.mat = t.mat;
      o.tone = 0;
      o.h += 0.05;
      return;
    }
  }
  const icon = left ? cocktailIcon(u, y, d) : grapeIcon(u, y, d);
  if (icon) {
    o.mat = icon;
    o.tone = 0;
  }
}

function whiteSide(left: boolean, u: number, x: number, y: number, d: number, o: Sample): void {
  const B = BAND;
  // The navy box with ROZZERS on the front door.
  const bx0 = left ? -B.box[1] : B.box[0];
  const bx1 = left ? -B.box[0] : B.box[1];
  if (u >= bx0 && u < bx1 && y >= B.box[2] && y < B.box[3]) {
    o.mat = M.NAVY;
    o.tone = 0;
    if (d === 1) {
      // 1×: a hint of the white capitals.
      if (Math.floor(y) === -15 && (Math.floor(u) - Math.floor(bx0)) % 2 === 1 && u > bx0 + 1 && u < bx1 - 1) o.mat = M.LET_W;
    } else if ((left ? ROZZERS_HD_LEFT : ROZZERS_HD)(u, y) <= 0) o.mat = M.LET_W;
    return;
  }
  if (u < Math.min(B.x0, -B.x1) || u > Math.max(B.x1, -B.x0)) return;
  const inBand = x >= B.x0 && x < B.x1 && y >= B.y[0] && y < B.y[3];
  // 619 on the band at the rear of the front wing.
  const nx0 = left ? -B.num[1] : B.num[0];
  const nx1 = left ? -B.num[0] : B.num[1];
  if (u >= nx0 && u < nx1 && y >= B.num[2] && y < B.num[3]) {
    if (d === 1) {
      const cx = Math.floor(u) - Math.floor(nx0);
      const cy = Math.floor(y);
      if ((cy === -16 || cy === -14) && cx % 2 === 0) {
        o.mat = M.LET_W;
        return;
      }
    } else if ((left ? N619_HD_LEFT : N619_HD)(u, y) <= 0) {
      o.mat = M.LET_W;
      return;
    }
  }
  if (inBand) {
    o.mat = y >= B.y[1] && y < B.y[2] ? M.BAND_Y : M.BAND_O;
    return;
  }
  // 4×: the script line on the rear door; the St George cross under the number.
  if (d >= 4 && !left && u > SCRIPT.x0 && u < SCRIPT.x1 && Math.abs(y - SCRIPT.y - Math.sin(u * 3.1) * 0.12) < 0.13 && Math.sin(u * 5.3) > -0.4) o.mat = M.NAVY;
  if (d >= 4) {
    const cxs = left ? -21.6 : 21.6;
    if (Math.abs(u - cxs) < 0.9 && y > -12.3 && y < -11.3) o.mat = Math.abs(u - cxs) < 0.17 || Math.abs(y + 11.8) < 0.17 ? M.RED : M.LET_W;
  }
}

/** The front face at (u, y): u from the viewer's left (the car's right) to right. */
function frontSurf(look: Look, u: number, y: number, x: number, d: number, o: Sample): boolean {
  const W2 = halfWidth(y);
  if (Math.abs(u) > W2) return false;
  const e = W2 - Math.abs(u);
  o.tone = 0;
  o.fixed = false;
  o.part = PART.BODY;
  o.h = roll(e, 1.4);
  if (y > CAR.bumperTop) {
    o.part = PART.TRIM;
    o.mat = M.PLASTIC;
    if (Math.abs(u) < 5.6 && y > -9.4 && y < -7.0) {
      o.mat = M.PLATE;
      if (d > 1 && Math.abs(u) < 5.0 && y > -9.0 && y < -7.4 && plateGlyph(u + 5, y + 9.0, look.livery === 'green' ? 'MS-SQ-03' : 'MS-RZ-19')) o.mat = M.PLATE_TEXT;
    }
    return true;
  }
  if (y > -16.0) {
    // The nose: headlights, the grille between them, the corner indicators.
    const a = Math.abs(u);
    if (a > 15.6) o.mat = M.AMBER;
    else if (a > 7.2 && y > -15.6 && y < -11.8) o.mat = M.CLEAR;
    else if (a <= 7.0 && y > -15.6 && y < -11.6) {
      o.mat = M.GRILLE;
      if (a > 6.3 || y < -15.0 || y > -12.2) o.mat = M.CHROME;
      else if (d > 1 && Math.abs(((u + 7) % 1.15) - 0.57) < 0.18) o.tone = 1;
    } else o.mat = M.PAINT;
    o.part = o.mat === M.PAINT ? PART.BODY : PART.LIGHT;
    if (o.mat === M.PAINT && look.livery === 'green' && camoAt(u * 1.6, y, 31) === 2) o.mat = M.CAMO_B;
    return true;
  }
  if (y > -17.9 && x > 21.5) {
    // The bonnet seen from the front (green: the tiger stripes).
    o.mat = M.PAINT;
    if (look.livery === 'green') {
      const c = camoAt(u * 1.3, x * 0.25, 41);
      if (c === 2) o.mat = M.CAMO_B;
      else if (c === 1) o.mat = M.CAMO_D;
    }
    o.tone = 1;
    return true;
  }
  if (y > -27.1) {
    // The windscreen between the A-pillars.
    if (e > 1.5) {
      o.part = PART.GLASS;
      o.mat = M.GLASS;
      o.tone = y < -25.5 ? 1 : 0;
      if (Math.abs(u + 5 - (y + 22) * 0.6) < 0.7) o.tone = 2;
      return true;
    }
    o.mat = M.PAINT;
    return true;
  }
  o.mat = M.PAINT;
  o.tone = 1;
  return true;
}

/** The rear face at (u, y): u from the viewer's left (the car's left) to right. */
function rearSurf(look: Look, u: number, y: number, d: number, o: Sample): boolean {
  const W2 = halfWidth(y);
  if (Math.abs(u) > W2) return false;
  const e = W2 - Math.abs(u);
  o.tone = 0;
  o.fixed = false;
  o.part = PART.BODY;
  o.h = roll(e, 1.4);
  if (y > CAR.bumperTop) {
    o.part = PART.TRIM;
    o.mat = M.PLASTIC;
    return true;
  }
  const a = Math.abs(u);
  if (a > 13.0 && y > CAR.tail.y0 && y < CAR.tail.y1) {
    o.part = PART.LIGHT;
    o.mat = y > CAR.tail.amber ? M.AMBER : y > CAR.tail.reverse ? M.CLEAR : M.RED;
    return true;
  }
  if (a < 12.4 && y > -26.0 && y < -18.6) {
    o.part = PART.GLASS;
    o.mat = M.GLASS;
    o.tone = y < -24.6 ? 1 : 0;
    return true;
  }
  if (a < 5.6 && y > -15.0 && y < -12.4) {
    o.mat = M.PLATE;
    if (d > 1 && Math.abs(u) < 5.0 && y > -14.6 && y < -12.8 && plateGlyph(u + 5, y + 14.6, look.livery === 'green' ? 'MS-SQ-03' : 'MS-RZ-19')) o.mat = M.PLATE_TEXT;
    return true;
  }
  o.mat = M.PAINT;
  if (look.livery === 'white' && y >= BAND.y[0] && y < BAND.y[3]) o.mat = y >= BAND.y[1] && y < BAND.y[2] ? M.BAND_Y : M.BAND_O;
  else if (look.livery === 'green') {
    const c = camoAt(u * 1.4, y, 53);
    if (c === 2) o.mat = M.CAMO_B;
    else if (c === 1) o.mat = M.CAMO_D;
  }
  return true;
}

/** The made-up plate's characters (10 × 1.8 logical px): a tiny HD-only print. */
function plateGlyph(px: number, py: number, text: string): boolean {
  const cw = 10 / text.length;
  const i = Math.floor(px / cw);
  if (i < 0 || i >= text.length || text[i] === '-') return false;
  const fx = (px - i * cw) / cw;
  const fy = py / 1.6;
  // A blocky mark per character (cell 3 × 5): enough for a plate seen from far.
  const col = Math.floor(fx * 4) - 0.5;
  const row = Math.floor(fy * 5);
  return col >= 0 && col < 3 && row >= 0 && row < 5 && ((text.charCodeAt(i) * 7 + row * 3 + col * 5) % 5 !== 0 || row === 0);
}

// ---------------------------------------------------------------------------------------------
// The cabin (the interior through the glass, the wheel wells)
// ---------------------------------------------------------------------------------------------

/** The interior at a side point (x, y) seen through the glass. */
function cabinSurf(x: number, y: number, left: boolean, d: number, o: Sample): void {
  o.part = PART.CABIN;
  o.h = 0;
  o.tone = 0;
  o.fixed = false;
  // The far side's glass along the top of each window (sky and road through two panes).
  const top = y - CAR.glassTop;
  o.mat = M.CABIN;
  if (top < 2.2 && x > CAR.dPillar + 0.6) {
    o.mat = M.FAR;
    o.tone = top < 1.1 ? 1 : 0;
  }
  // Headrests: the front seats (behind the driver), the rear bench.
  const front = left ? 2.5 : -1.5;
  for (const hx of [front, -27.5, -35.0]) {
    if (Math.hypot((x - hx) / 1.7, (y + 22.6) / 1.5) < 1) {
      o.mat = M.SEAT;
      o.tone = y < -23.2 ? 1 : 0;
    }
  }
  // The seat backs' tops under the headrests.
  if (y > -20.4 && ((x > -4.5 && x < 3.5) || (x > -38 && x < -24))) o.mat = M.SEAT;
  // The steering wheel rim and the gloved hands (facing right: the driver's front window).
  const [wx, wy, rx, ry] = SEAT.wheel;
  const sx = left ? -wx : wx;
  const q = Math.hypot((x - sx) / rx, (y - wy) / ry);
  if (q < 1 && q > (d === 1 ? 0.01 : 0.5) && y < CAR.beltY) o.mat = M.BLACK;
  for (const gy of [-19.6, -17.9]) if (Math.hypot((x - sx - (left ? 0.3 : -0.3)) / 0.8, (y - gy) / 0.7) < 1 && y < CAR.beltY) o.mat = M.GLOVE;
}

// ---------------------------------------------------------------------------------------------
// Extras (projected primitives)
// ---------------------------------------------------------------------------------------------

/** A box along the car (x0…x1, y0…y1, at lateral z0…z1): fills `o` when (X, Y) hits it. */
function hitBox(c: number, s: number, X: number, Y: number, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, o: Sample): boolean {
  if (Y < y0 || Y >= y1) return false;
  const v0 = x0 * c - z0 * s;
  const v1 = x0 * c - z1 * s;
  const v2 = x1 * c - z0 * s;
  const v3 = x1 * c - z1 * s;
  let a = Math.min(v0, v1, v2, v3);
  let b = Math.max(v0, v1, v2, v3);
  if (b - a < 0.8) {
    const m = (a + b) / 2;
    a = m - 0.4;
    b = m + 0.4;
  }
  if (X < a || X >= b) return false;
  const xm = (x0 + x1) / 2;
  const zm = (z0 + z1) / 2;
  o.depth = xm * s + zm * c + 0.3;
  const ey = Math.min(Y - y0, y1 - Y);
  const ex = Math.min(X - a, b - X);
  o.h = roll(Math.min(ey, ex) + 0.1, Math.min(0.6, (y1 - y0) / 2));
  o.nx = 0;
  o.nz = 1;
  o.tone = 0;
  o.fixed = false;
  return true;
}

/**
 * A round lamp: a short cylinder along the car (back xb … front xf, centre y yc, lateral z,
 * radius r), turned `turn` rad toward the camera so its glass reads in the side views.
 */
function hitLamp(v: View, X: number, Y: number, xb: number, xf: number, yc: number, z: number, r: number, turn: number, housing: number, rim: number, o: Sample): boolean {
  const a = v.yaw + turn;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cy = Math.cos(v.yaw);
  const sy = Math.sin(v.yaw);
  // The lamp's centre follows the car; its own facing is turned.
  const xm = (xb + xf) / 2;
  const Xm = xm * cy - z * sy;
  const half = ((xf - xb) / 2) * c;
  const Xf = Xm + half;
  const Xb = Xm - half;
  const ew = Math.abs(r * s);
  const dy = (Y - yc) / r;
  if (Math.abs(dy) >= 1) return false;
  const span = Math.sqrt(1 - dy * dy);
  const inFront = ew > 0.05 && Math.abs(X - Xf) < ew * span;
  const inBack = ew > 0.05 && Math.abs(X - Xb) < ew * span;
  const inBand = X >= Math.min(Xb, Xf) && X <= Math.max(Xb, Xf);
  if (!inFront && !inBack && !inBand) return false;
  o.depth = xm * sy + z * cy + 1;
  o.nx = 0;
  o.nz = 1;
  o.tone = 0;
  o.fixed = false;
  if (inFront && s > 0) {
    // The lamp's face: a chrome (or black) rim, the glass with its grille at HD.
    const q = Math.hypot((X - Xf) / ew, dy);
    o.mat = q > 0.74 ? rim : M.CLEAR;
    o.h = q > 0.74 ? 0.5 : 0.8 * Math.sqrt(Math.max(0, 1 - q * q));
    if (o.mat === M.CLEAR && (Math.abs(((Y - yc + 4) % 0.9) - 0.45) < 0.1 || Math.abs(((X - Xf + 4) % 0.9) - 0.45) < 0.08)) o.mat = M.GRILLE;
    o.nx = c * 0.6;
    o.nz = 0.8;
    return true;
  }
  o.mat = housing;
  // The housing is a bowl: round across its height.
  o.h = Math.sqrt(Math.max(0, 1 - dy * dy)) * r * 0.5;
  // The rim band at the front end of the housing.
  if (Math.abs(X - Xf) < 0.45 && rim !== housing) o.mat = rim;
  return true;
}

/** A wheel (spin frames): a cylinder across the car at (wx, wy), lateral centre z, radius R. */
function hitWheel(v: View, X: number, Y: number, wx: number, z: number, o: Sample): boolean {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const R = CAR.tyreR;
  const dy = (Y - CAR.wheelY) / R;
  if (Math.abs(dy) >= 1) return false;
  const span = Math.sqrt(1 - dy * dy);
  const zo = z > 0 ? z + 1.8 : z - 1.8;
  const zi = z > 0 ? z - 1.8 : z + 1.8;
  const Xo = wx * c - zo * s;
  const Xi = wx * c - zi * s;
  const ew = Math.max(0.6, R * Math.abs(c));
  const inOuter = Math.abs(X - Xo) < ew * span;
  const inInner = Math.abs(X - Xi) < ew * span;
  const inBand = X >= Math.min(Xo, Xi) && X <= Math.max(Xo, Xi);
  if (!inOuter && !inInner && !inBand) return false;
  o.depth = wx * s + z * c;
  o.part = PART.WHEEL;
  o.nx = 0;
  o.nz = 1;
  o.tone = 0;
  o.fixed = false;
  o.mat = M.TYRE;
  o.h = span * 1.2;
  const outerFaces = (z > 0 ? c : -c) > 0.2;
  if (inOuter && outerFaces) {
    const q = Math.hypot((X - Xo) / ew, dy);
    if (q < CAR.rimR / R) {
      o.mat = M.RIM;
      o.h = 1.4 - q;
    }
  }
  return true;
}

const SIDES = [1, -1] as const;
const RAIL_Z = [13, -13] as const;
const RACK_Z = [11, -11] as const;
const BAR_Z = [9, -9] as const;
const BAR_LAMP_Z = [4.5, -4.5] as const;
let takeO: Sample = blank();
let takeT: Sample = blank();

/** The nearest extra wins: copy the trial sample `takeT` into `takeO` when it is nearer. */
function takeInto(part: number, mat: number): void {
  const o = takeO;
  const t = takeT;
  if (t.depth > o.depth) {
    Object.assign(o, t);
    o.part = part;
    if (t.mat === M.NONE || (part !== PART.LAMP_N && part !== PART.LAMP_F && part !== PART.BARLAMP && part !== PART.WHEEL)) o.mat = mat;
  }
}

/** Test every extra at (X, Y) (after the pitch is undone); the nearest wins into `o`. */
function extras(look: Look, X: number, Y: number, o: Sample, t: Sample): void {
  const v = look.view;
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const green = look.livery === 'green';
  if (look.cabin) return;
  // Everything extra sits above the belt (the roof gear, the mirrors) or at the ends (the bar,
  // the wheels): a px in the middle of the body skips the lot.
  if (Y > -17.8 && Math.abs(X) < 40 && !look.wheels) return;
  const take = takeInto;
  takeO = o;
  takeT = t;
  // Mirrors (the near one in front of the body).
  const Mi = CAR.mirror;
  const W2 = CAR.width / 2;
  if (Y >= Mi.y0 && Y < Mi.y1) for (const side of SIDES) {
    const z0 = side > 0 ? W2 - 0.5 : -W2 - 2.2;
    const z1 = side > 0 ? W2 + 2.2 : -W2 + 0.5;
    if (hitBox(c, s, X, Y, Mi.x0, Mi.x1, Mi.y0, Mi.y1, z0, z1, t)) {
      t.depth += 2;
      take(PART.MIRROR, M.BLACK);
    }
  }
  // Roof rails (silver on the green wagon, black on the white).
  const R = CAR.rail;
  const railMat = green ? M.STEEL : M.BLACK;
  const roof = Y < -27.4;
  if (roof) for (const z of RAIL_Z) {
    if (hitBox(c, s, X, Y, R.x0, R.x1, R.y0, R.y1, z - 0.5, z + 0.5, t)) take(PART.RAIL, railMat);
    for (const [f0, f1] of R.feet) if (hitBox(c, s, X, Y, f0, f1, R.y1, -27.5, z - 0.5, z + 0.5, t)) take(PART.RAIL, railMat);
  }
  if (green && roof) {
    const K = RACK;
    for (const z of RACK_Z) {
      if (hitBox(c, s, X, Y, K.bar.x0, K.bar.x1, K.bar.y0, K.bar.y1, z - 0.4, z + 0.4, t)) take(PART.RACK, M.STEEL);
      for (const cx of K.clamps) if (hitBox(c, s, X, Y, cx - 0.6, cx + 0.6, K.bar.y1, R.y0, z - 0.6, z + 0.6, t)) take(PART.RACK, M.STEEL);
    }
    for (const cx of K.clamps) if (hitBox(c, s, X, Y, cx - 0.4, cx + 0.4, K.bar.y0, K.bar.y1, -11, 11, t)) take(PART.RACK, M.STEEL);
    // The spare tyre lying flat: a disc seen edge-on is as wide as it is round from any side.
    const [tx0, tx1, ty0, ty1] = K.tyre;
    const tcx = (tx0 + tx1) / 2;
    const tr = (tx1 - tx0) / 2;
    const Xt = tcx * c;
    if (Y >= ty0 && Y < ty1 && Math.abs(X - Xt) < tr) {
      t.depth = tcx * s + 1.5;
      t.h = roll(Math.min(Y - ty0, ty1 - Y) + 0.2, 1.2) + roll(tr - Math.abs(X - Xt), 1.5) * 0.4;
      t.nx = 0;
      t.nz = 1;
      t.tone = 0;
      t.fixed = false;
      t.mat = Math.abs(X - Xt) < 0.45 ? M.STRAP : M.TYRE;
      if (t.mat === M.TYRE && Math.abs(((X - Xt + 20) % 1.1) - 0.55) < 0.14 && Y > ty0 + 0.5 && Y < ty1 - 0.5) t.tone = -1;
      take(PART.TYRE, t.mat);
    }
    const [cx0, cx1, cy0, cy1] = K.can;
    if (hitBox(c, s, X, Y, cx0, cx1, cy0, cy1, -1.6, 1.6, t)) {
      // The handle's gap at the top.
      const notch = Y < cy0 + 1.0 && Math.abs(X - ((cx0 + cx1) / 2) * c) < 0.6;
      if (!notch) take(PART.CAN, M.CAN);
    }
    // The spot lamps on the rack's front (near first).
    const lamps = K.lamps;
    for (let i = 0; i < lamps.length; i++) {
      const [lx, ly, lr] = lamps[i];
      const z = i === 0 ? 6 : -6;
      if (hitLamp(v, X, Y, lx - 2.0, lx + 0.4, ly, z, lr, 0.42, M.BLACK, M.CHROME, t)) take(i === 0 ? PART.LAMP_N : PART.LAMP_F, t.mat);
      // The bracket down to the load bar.
      if (hitBox(c, s, X, Y, lx - 1.3, lx - 0.5, ly + lr - 0.2, K.bar.y0, z - 0.4, z + 0.4, t)) take(PART.RACK, M.STEEL);
    }
  } else if (!green && Y >= BAR.y0 - 0.4 && Y < BAR.y1) {
    // The black push bar: two uprights, the top and the lower cross tubes, and its two lamps.
    const B = BAR;
    for (const z of BAR_Z) if (hitBox(c, s, X, Y, B.x0, B.x1, B.y0, B.y1, z - 0.7, z + 0.7, t)) take(PART.BAR, M.BLACK);
    if (hitBox(c, s, X, Y, B.x0, B.x1, B.y0 - 0.4, B.y0 + 1.0, -9, 9, t)) take(PART.BAR, M.BLACK);
    if (hitBox(c, s, X, Y, B.x0, B.x1, -6.4, -5.0, -9, 9, t)) take(PART.BAR, M.BLACK);
    const [lx, ly, lr] = B.lamp;
    for (const z of BAR_LAMP_Z) if (hitLamp(v, X, Y, lx - 1.8, lx + 0.6, ly, z, lr, 0.42, M.BLACK, M.BLACK, t)) take(PART.BARLAMP, t.mat);
  }
  if (look.wheels && Y > CAR.wheelY - CAR.tyreR) {
    const zw = W2 - 3;
    for (const wx of CAR.wheelX) for (let k = 0; k < 2; k++) if (hitWheel(v, X, Y, wx, k === 0 ? zw : -zw, t)) take(PART.WHEEL, t.mat);
  }
}

// ---------------------------------------------------------------------------------------------
// One sample
// ---------------------------------------------------------------------------------------------

const tmp = blank();

/** The body faces at screen (X, Y) (pitch undone): the nearest face into `o`; false = none. */
function bodyAt(look: Look, X: number, Y: number, d: number, o: Sample): boolean {
  const v = look.view;
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const W2 = halfWidth(Y);
  let hit = false;
  if (c > 0.02) {
    const x = (X + W2 * s) / c;
    if (sideSurf(look, false, x, Y, d, tmp)) {
      Object.assign(o, tmp);
      o.depth = x * s + W2 * c;
      o.nx = -s;
      o.nz = c;
      hit = true;
    }
  } else if (c < -0.02) {
    const x = (X - W2 * s) / c;
    if (sideSurf(look, true, x, Y, d, tmp)) {
      Object.assign(o, tmp);
      o.depth = x * s - W2 * c;
      o.nx = s;
      o.nz = -c;
      hit = true;
    }
  }
  if (look.cabin) return hit;
  if (s > 0.02) {
    const xf = frontX(Y);
    if (!Number.isNaN(xf)) {
      const z = (xf * c - X) / s;
      if (Math.abs(z) <= W2 && frontSurf(look, -z, Y, xf, d, tmp)) {
        const depth = xf * s + z * c;
        if (!hit || depth > o.depth) {
          Object.assign(o, tmp);
          o.depth = depth;
          o.nx = c;
          o.nz = s;
          hit = true;
        }
      }
    }
  } else if (s < -0.02) {
    const xr = rearX(Y);
    if (!Number.isNaN(xr)) {
      const z = (xr * c - X) / s;
      if (Math.abs(z) <= W2 && rearSurf(look, z, Y, d, tmp)) {
        const depth = xr * s + z * c;
        if (!hit || depth > o.depth) {
          Object.assign(o, tmp);
          o.depth = depth;
          o.nx = -c;
          o.nz = -s;
          hit = true;
        }
      }
    }
  }
  return hit;
}

const ext = blank();

/** The full sample at screen (X, Y) of a frame (local coordinates): into `o`; false = empty. */
export function sampleAt(look: Look, X: number, Y: number, d: number, o: Sample): boolean {
  let x = X;
  let y = Y;
  const v = look.view;
  if (v.pitch !== 0) {
    const [px, py] = v.pivot;
    const cp = Math.cos(-v.pitch);
    const sp = Math.sin(-v.pitch);
    const dx = X - px;
    const dy = Y - py;
    x = px + dx * cp - dy * sp;
    y = py + dx * sp + dy * cp;
  }
  o.depth = -1e9;
  o.mat = M.NONE;
  const body = bodyAt(look, x, y, d, o);
  if (look.cabin) {
    if (!body) return false;
    if (o.mat === M.HOLE) {
      const left = Math.cos(v.yaw) < 0;
      const W2 = halfWidth(y);
      const sx = left ? (x - W2 * Math.sin(v.yaw)) / Math.cos(v.yaw) : (x + W2 * Math.sin(v.yaw)) / Math.cos(v.yaw);
      cabinSurf(sx, y, left, d, o);
      return true;
    }
    if (o.mat === M.WELL) {
      o.part = PART.WELL;
      return true;
    }
    return false;
  }
  if (!body) o.depth = -1e9;
  ext.depth = -1e9;
  ext.mat = M.NONE;
  extras(look, x, y, ext, tmp);
  if (ext.mat !== M.NONE && (!body || ext.depth > o.depth || o.mat === M.HOLE || o.mat === M.WELL)) {
    Object.assign(o, ext);
    return true;
  }
  if (!body) return false;
  if (o.mat === M.WELL && !look.wheels) return false;
  return true;
}

/** A grid of samples over a canvas box (local, inclusive bounds) at density d (one per art px). */
export interface SampleGrid {
  readonly x0: number;
  readonly y0: number;
  readonly W: number;
  readonly H: number;
  readonly d: number;
  readonly cells: (Sample | null)[];
  at(x: number, y: number): Sample | null;
}

export function sampleGrid(look: Look, box: { x0: number; y0: number; x1: number; y1: number }, d: number): SampleGrid {
  const W = (box.x1 - box.x0 + 1) * d;
  const H = (box.y1 - box.y0 + 1) * d;
  const cells: (Sample | null)[] = new Array(W * H).fill(null);
  for (let j = 0; j < H; j++) {
    const y = box.y0 + (j + 0.5) / d;
    for (let i = 0; i < W; i++) {
      const s = blank();
      if (sampleAt(look, box.x0 + (i + 0.5) / d, y, d, s)) cells[j * W + i] = s;
    }
  }
  return {
    x0: box.x0,
    y0: box.y0,
    W,
    H,
    d,
    cells,
    at(x: number, y: number): Sample | null {
      const i = Math.floor((x - box.x0) * d);
      const j = Math.floor((y - box.y0) * d);
      if (i < 0 || j < 0 || i >= W || j >= H) return null;
      return cells[j * W + i];
    },
  };
}
