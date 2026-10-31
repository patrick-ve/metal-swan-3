/**
 * Art-direction trial `painted` (painted.ts): VINCENT's painted head. It is drawn straight into
 * the figure's canvas (one G-buffer, one painter: the same light, brush, contact shadows and
 * shadow-side edge as the body), as smooth forms in HEAD-LOCAL coordinates (the rig's 18 × 19
 * head layout facing right: NECK, the eye, nose, mouth and ear at their 1× places) mapped to the
 * canvas by one similarity: the neck point, the tilt and the Helium Head's scale 2.
 *
 * The forms: one skull and face mass (cranium, jaw, chin and nose blended with a smooth max, so
 * no seams), brow ridge, eye socket, cheek and muzzle as soft relief; the ear as a lit rim round a
 * shaded bowl; the neck in the jaw's shadow; short dark hair combed back as a raised mass whose
 * brush runs in arcs round the crown, with a soft lift at the front. The face is painted, not
 * drawn: the RAISED BROW is one dark arched stroke of the hair's paint, the lopsided SMIRK a value
 * shape (a dark mouth line climbing to the back corner, a lit lower lip, a crease and a lifted
 * cheek), the HEAVY STUBBLE a soft dark glaze (the skin's own ramp, greyed and a step and a half
 * down) laid over the jaw, chin and upper lip with a broken, brushy border. Eyes: a dark iris with
 * a sliver of cool white in front, a heavy upper lid and one warm catchlight.
 */
import type { Color } from '../../../../engine/color';
import { hex } from '../../../../engine/color';
import { inPoly, polyDist, type HdCanvas } from '../../../art/hd/canvas';
import type { Pt } from '../../../art/hd/shape';
import type { Expression } from '../../../art/humanoid';
import { NECK } from '../../../art/humanoid-head';
import { hash2 } from '../../../art/paint';
import type { PaintMat } from './painted-paint';
import { RAMPS, rampFor, type PaintRamp } from './painted-ramps';
import { DEG, type Resolved, type V } from './painted-rig';

/** The canvas side: the canvas and a painted-material factory (painted-body.ts Painter.paint). */
export interface HeadCtx {
  c: HdCanvas;
  d: number;
  mat: (key: string, ramp: PaintRamp, bs: number, dir: number, at: Pt, o?: Partial<PaintMat>) => number;
}

export interface HeadPlace {
  /** Canvas point (logical) of the neck point. */
  neck: V;
  /** Degrees, clockwise. */
  tilt: number;
  /** 1, or 2 for the Helium Head. */
  k: 1 | 2;
  z: number;
  expr: Expression;
}

// ------------------------------------------------------------------------------------ layout

const EYE: V = [12.1, 12.95];
const EAR: V = [7.45, 13.85];
const NOSE: V = [14.7, 13.5];

const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number): number => {
  const a = (x - cx) / sx;
  const b = (y - cy) / sy;
  return Math.exp(-(a * a + b * b));
};
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Squared normalised distance in an ellipse (< 1 inside). */
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): number => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;

/** Smooth max of dome heights (log-sum-exp), NaN when no dome covers the point. */
function smax(hs: readonly number[], s: number): number {
  let m = -Infinity;
  for (const h of hs) if (h > m) m = h;
  if (m === -Infinity) return NaN;
  let acc = 0;
  for (const h of hs) if (h > -Infinity) acc += Math.exp((h - m) / s);
  return m + s * Math.log(acc);
}

const dome = (q: number, h: number): number => (q < 1 ? h * Math.sqrt(1 - q) : -Infinity);

/** A dome with a broad, flat-ish front (painted planes, not a ball): exponent < 0.5. */
const plateau = (q: number, h: number, e = 0.38): number => (q < 1 ? h * Math.pow(1 - q, e) : -Infinity);

/** The skull and face height (logical px towards the viewer), NaN outside. */
function skullH(u: number, v: number): number {
  const h = smax(
    [
      plateau(ell(u, v, 9.1, 11.45, 5.3, 5.0), 4.6),
      plateau(ell(u, v, 10.75, 14.6, 3.85, 2.8), 3.4, 0.32),
      dome(ell(u, v, NOSE[0] - 0.06, NOSE[1], 0.68, 0.76), 2.0),
      dome(ell(u, v, 14.05, 12.45, 0.55, 1.05), 2.0),
      plateau(ell(u, v, 12.6, 16.6, 1.45, 0.95), 2.4, 0.4),
      plateau(ell(u, v, 9.4, 16.1, 1.7, 1.25), 2.6, 0.4),
    ],
    0.5,
  );
  if (h !== h) return NaN;
  let r = h;
  r += 0.3 * gauss(u, v, 12.3, 11.35, 1.4, 0.45);
  r -= 0.28 * gauss(u, v, 12.0, 12.95, 0.85, 0.75);
  r += 0.12 * gauss(u, v, 10.9, 14.0, 1.1, 0.9);
  r += 0.25 * gauss(u, v, 13.4, 15.3, 1.2, 0.8);
  const eq = earQ(u, v);
  if (eq < 1.2) r += 0.3 * smooth(1.2, 0.8, eq);
  return r;
}

function earQ(u: number, v: number): number {
  const ry = 1.5;
  const b = (v - EAR[1]) / ry;
  const rx = 1.02 - Math.max(0, b) * 0.2;
  const a = (u - EAR[0]) / rx;
  return a * a + b * b;
}

/**
 * Where the hair does NOT grow (head-local polygon): the forehead under the front hairline, the
 * temple recess, the face in front of the sideburn, the ear (the hair hugs over its top) and the
 * neck under the nape. Its edge is the hairline.
 */
const SKIN_POLY: readonly Pt[] = [
  [17, 6.6],
  [14.7, 7.25],
  [13.4, 7.9],
  [12.2, 8.55],
  [11.1, 8.95],
  [10.15, 9.35],
  [9.45, 9.95],
  [9.1, 10.7],
  [8.95, 11.6],
  [8.85, 12.45],
  [8.25, 12.55],
  [7.45, 12.2],
  [6.65, 12.35],
  [6.2, 13.0],
  [5.95, 14.0],
  [5.55, 14.85],
  [4.75, 15.35],
  [1, 15.9],
  [1, 21],
  [17, 21],
];

/** Distance to the hairline (head-local px; the SKIN_POLY edge). */
function hairGap(u: number, v: number): number {
  return polyDist(u, v, SKIN_POLY);
}

/** The hair mass height, NaN outside: a close crop over the skull (a squarish cap), a soft lift at the front. */
function hairH(u: number, v: number): number {
  if (inPoly(u, v, SKIN_POLY)) return NaN;
  // A superellipse cap a little larger than the cranium; its outline broken by short tufts.
  const ang = Math.atan2(v - 11.2, u - 8.9);
  const qx = Math.abs((u - 8.95) / 5.45);
  const qy = Math.abs((v - 11.25) / 5.05);
  const q0 = Math.pow(Math.pow(qx, 2.6) + Math.pow(qy, 2.6), 2 / 2.6);
  const tuft = (0.035 * Math.sin(ang * 11 + 0.7) + 0.025 * Math.sin(ang * 17 + 2.1)) * smooth(0.8, 1, q0);
  const q = q0 - tuft;
  const lift = ell(u, v, 12.0, 7.6, 1.4, 0.9);
  const h = smax([plateau(q, 5.2, 0.42), dome(lift, 4.6)], 0.4);
  if (h !== h) return NaN;
  // The hair's edge on the face rolls down onto the skin.
  return h * (0.72 + 0.28 * smooth(0, 0.7, hairGap(u, v)));
}

// ------------------------------------------------------------------------------------ expressions

type EyeKind = 'open' | 'closed' | 'happy' | 'squeeze' | 'wide' | 'half';
type MouthKind = 'smirk' | 'open' | 'yawn' | 'smile' | 'grimace' | 'o' | 'flat' | 'chew';
type BrowKind = 'raised' | 'normal' | 'up' | 'knit' | 'down';

const FACE: Readonly<Record<Expression, { eye: EyeKind; mouth: MouthKind; brow: BrowKind }>> = {
  normal: { eye: 'open', mouth: 'smirk', brow: 'raised' },
  shout: { eye: 'open', mouth: 'open', brow: 'down' },
  panic: { eye: 'wide', mouth: 'o', brow: 'up' },
  hurt: { eye: 'squeeze', mouth: 'grimace', brow: 'knit' },
  happy: { eye: 'happy', mouth: 'smile', brow: 'raised' },
  smile: { eye: 'open', mouth: 'smile', brow: 'raised' },
  blink: { eye: 'closed', mouth: 'smirk', brow: 'raised' },
  yawn: { eye: 'closed', mouth: 'yawn', brow: 'up' },
  chew: { eye: 'open', mouth: 'chew', brow: 'raised' },
  dazed: { eye: 'half', mouth: 'flat', brow: 'normal' },
  soot: { eye: 'open', mouth: 'flat', brow: 'normal' },
};

/** Quadratic Bézier distance (sampled): distance to the curve and the parameter of the nearest point. */
function bez(u: number, v: number, a: Pt, c: Pt, b: Pt): { dist: number; t: number } {
  let best = Infinity;
  let bt = 0;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const s = 1 - t;
    const x = s * s * a[0] + 2 * s * t * c[0] + t * t * b[0];
    const y = s * s * a[1] + 2 * s * t * c[1] + t * t * b[1];
    const dd = (u - x) ** 2 + (v - y) ** 2;
    if (dd < best) {
      best = dd;
      bt = t;
    }
  }
  return { dist: Math.sqrt(best), t: bt };
}

const BROWS: Readonly<Record<BrowKind, readonly [Pt, Pt, Pt]>> = {
  // Vincent's arched, raised brow: high over the eye, a gap of skin under it.
  raised: [[10.9, 11.25], [12.0, 9.75], [13.25, 10.7]],
  normal: [[11.0, 11.4], [12.1, 10.9], [13.2, 11.2]],
  up: [[10.9, 11.0], [12.0, 9.9], [13.2, 10.45]],
  knit: [[11.1, 11.05], [12.3, 11.55], [13.2, 11.0]],
  down: [[11.0, 10.9], [12.2, 11.05], [13.2, 11.65]],
};

/** Mouth line curves: [front, control, back corner]. */
const MOUTHS: Readonly<Partial<Record<MouthKind, readonly [Pt, Pt, Pt]>>> = {
  // The smirk: the front of the mouth level, the back corner pulled up.
  smirk: [[14.35, 15.45], [13.1, 15.5], [12.15, 14.85]],
  chew: [[14.35, 15.4], [13.1, 15.55], [12.2, 14.95]],
  smile: [[14.35, 15.3], [13.2, 15.75], [12.2, 14.85]],
  flat: [[14.35, 15.5], [13.4, 15.5], [12.5, 15.45]],
};

// Fixed colours (PAL_HD) of the eye and the open mouth.
const C = {
  white: hex('#d0d6dc'),
  whiteShade: hex('#aab4c2'),
  iris: hex('#33201b'),
  irisLit: hex('#5b3828'),
  pupil: hex('#100b14'),
  glint: hex('#fff4e6'),
  lid: hex('#221a28'),
  mouth: hex('#2a0a1c'),
  mouthLit: hex('#4a0f1f'),
  tongue: hex('#861a2e'),
  teeth: hex('#ecefee'),
  teethShade: hex('#aab4c2'),
} as const;

// ------------------------------------------------------------------------------------ drawing

/** The face's key light: upper left, mostly from the front. */
const FACE_KEY: readonly [number, number, number] = (() => {
  const x = -0.42;
  const y = -0.5;
  const z = 0.76;
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l] as const;
})();

/** A light direction turned with the head's tilt (so the face keeps its light as it tilts... a little). */
function turnKey(k: readonly [number, number, number], tilt: number): readonly [number, number, number] {
  const a = tilt * 0.5 * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [k[0] * c - k[1] * s, k[0] * s + k[1] * c, k[2]];
}

/** Brush seeds of the head (stable). */
const BS = { face: 41, stubble: 42, hair: 43, brow: 44, neck: 45 } as const;

/**
 * Draw the head into the canvas. Returns the part ids of the face and the hair (the Helium
 * Head's rim). Head-local (u, v) ↔ canvas (x, y): canvas = neck + R(tilt) · k · (local − N0).
 */
export function drawPaintedHead(h: HeadCtx, st: Resolved, pl: HeadPlace): { face: number; hair: number } {
  const { c, d } = h;
  const k = pl.k;
  const N0: V = [(NECK[0] * k + 0.5) / k, (NECK[1] * k + 0.5) / k];
  const cs = Math.cos(pl.tilt * DEG);
  const sn = Math.sin(pl.tilt * DEG);
  const toCanvas = (u: number, v: number): V => {
    const x = (u - N0[0]) * k;
    const y = (v - N0[1]) * k;
    return [pl.neck[0] + x * cs - y * sn, pl.neck[1] + x * sn + y * cs];
  };
  const toLocal = (x: number, y: number): V => {
    const dx = (x - pl.neck[0]) / k;
    const dy = (y - pl.neck[1]) / k;
    return [N0[0] + dx * cs + dy * sn, N0[1] - dx * sn + dy * cs];
  };
  // Canvas bounds of a local box.
  const box = (u0: number, v0: number, u1: number, v1: number): [number, number, number, number] => {
    const pts = [toCanvas(u0, v0), toCanvas(u1, v0), toCanvas(u0, v1), toCanvas(u1, v1)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs) - 0.5;
    const y0 = Math.min(...ys) - 0.5;
    return [x0, y0, Math.max(...xs) + 0.5 - x0, Math.max(...ys) + 0.5 - y0];
  };
  const face = FACE[pl.expr] ?? FACE.normal;
  const soot = pl.expr === 'soot';
  const skinR = soot ? RAMPS.leather : rampFor(st.skin);
  const stubR = soot ? RAMPS.leather : RAMPS.stubble;
  const hairR = soot ? RAMPS.leather : RAMPS.hair;
  const heavy = (st.s.face ?? []).includes('heavy-stubble') || (st.s.face ?? []).includes('stubble');
  const centre = toCanvas(9.2, 12.2);
  const faceDir = -58 + pl.tilt;
  const sw = { len: 1.4 * k, wid: 0.5 * k };
  // The face's own key light, more from the front (the face turned away from the scene's key
  // would sit in back light), turned with the head.
  const key = turnKey(FACE_KEY, pl.tilt);
  const skin = h.mat('head-skin', skinR, BS.face, faceDir, centre, { ...sw, jit: 0.025, soft: 0.6, gloss: 0.1, bounce: 0.45, key, bend: 1, span: [0, 1] });
  const stub = h.mat('head-stubble', stubR, BS.stubble, faceDir + 90, centre, { len: 0.8 * k, wid: 0.36 * k, jit: 0.05, soft: 0.6, key, bounce: 0.45, span: [0, 1] });
  const earM = h.mat('head-ear', soot ? RAMPS.leather : RAMPS.ear, BS.face, faceDir, centre, { ...sw, jit: 0.02, soft: 0.6, key, bounce: 0.3, span: [0, 1] });
  const brow = h.mat('head-brow', hairR, BS.brow, faceDir, centre, { len: 0.8 * k, wid: 0.3 * k, jit: 0.03, span: [0, 0.75] });
  const neckM = h.mat('head-neck', skinR, BS.neck, 90 + pl.tilt, centre, { ...sw, jit: 0.04, soft: 0.62, span: [0, 0.85] });
  const crown = toCanvas(8.8, 12.4);
  const hairM = h.mat('head-hair', hairR, BS.hair, 0, centre, { polar: [crown[0] * d, crown[1] * d], len: 1.5 * k, wid: 0.36 * k, jit: 0.04, soft: 0.45, gloss: 0.45, span: [0, 0.68] });
  const facePart = c.newPart();
  const hairPart = c.newPart();
  const z = pl.z;

  // The neck: behind the jaw (a contact shadow under it), a little stubble at the top.
  {
    const a = toCanvas(8.6, 15.2);
    const b = toCanvas(8.6, 20.2);
    c.capsule(a[0], a[1], b[0], b[1], 1.55 * k, 1.55 * k, { mat: neckM, z: z - 0.45, round: 0.7, tone: -0.04 });
  }

  // Stubble weight over the jaw, chin and upper lip (0..1), with a brushy border.
  const stubW = (u: number, v: number): number => {
    if (!heavy) return 0;
    // Under the jaw line from the ear's lobe to the chin, and the upper lip.
    const jl = u < 8.2 ? 15.35 : u < 11.2 ? 15.35 - (u - 8.2) * 0.04 : u < 12.6 ? 15.23 - (u - 11.2) * 0.4 : 14.7;
    let w = smooth(jl - 0.2, jl + 0.5, v);
    // The upper lip: a lighter glaze between the nose and the mouth.
    if (u > 12.7 && v > 14.35 && v < 15.15) w = Math.max(w, 0.55 * smooth(12.7, 13.3, u));
    // Gone on the neck (under the jaw's back), kept on the chin.
    w *= 1 - smooth(16.7, 17.6, v) * smooth(11.8, 10.6, u) * 0.85;
    w *= 1 - smooth(17.6, 18.4, v) * 0.9;
    // The lips themselves stay skin.
    const mc = MOUTHS[face.mouth];
    if (mc && bez(u, v, mc[0], mc[1], mc[2]).dist < 0.38 && u > 12.4) w *= 0.15;
    return w;
  };

  // The skull and face.
  {
    const [bx, by, bw, bh] = box(2.6, 5.6, 16.2, 18.2);
    const browC = BROWS[face.brow];
    const mouthC = MOUTHS[face.mouth];
    c.heightField(bx, by, bw, bh, (x, y) => {
      const [u, v] = toLocal(x, y);
      const hh = skullH(u, v);
      return hh === hh ? hh * k : NaN;
    }, {
      mat: skin,
      part: facePart,
      z,
      tex: (s) => {
        const [u, v] = toLocal(s.x, s.y);
        // The ear: a lit rim (upper left), the bowl and canal in shade, a shadow behind it.
        const eq = earQ(u, v);
        if (eq < 1) {
          // A warm ear: the lit rim (helix) round a darker bowl, the canal deepest.
          s.mat = earM;
          const r = Math.sqrt(eq);
          const lit = -(u - EAR[0]) * 0.62 - (v - EAR[1]) * 0.78 > 0.1;
          if (r > 0.7) s.tone += lit ? 0.1 : -0.06;
          else if (ell(u, v, EAR[0] + 0.32, EAR[1] + 0.2, 0.3, 0.42) < 1) s.tone -= 0.4;
          else s.tone -= 0.22;
        } else if (eq < 1.7 && u > EAR[0] + 0.3) s.tone -= 0.1;
        else if (eq < 1.5) s.tone -= 0.12;
        // A soft shade on the skin under the hairline (the hair's contact shadow).
        {
          const gap = hairGap(u, v);
          if (gap < 0.5 && v < 13.2) s.tone -= 0.1 * (1 - gap / 0.5);
        }
        // The jaw's turn under the chin and the cheek's plane: a soft cool shade.
        s.tone -= 0.1 * smooth(16.6, 17.6, v) * smooth(9, 12, u);
        // The socket under the brow, a warm cheek.
        s.tone -= 0.08 * gauss(u, v, 12.0, 12.7, 1.0, 0.7);
        // The nose: held back a little (a painted nose, not a bulb), its nostril and the shade under it.
        s.tone -= 0.06 * gauss(u, v, NOSE[0] + 0.2, NOSE[1], 0.5, 0.6) + 0.1 * smooth(NOSE[1], NOSE[1] + 0.7, v) * gauss(u, v, NOSE[0], NOSE[1] + 0.5, 0.7, 0.5);
        if (ell(u, v, 14.25, 14.0, 0.32, 0.22) < 1) s.tone -= 0.32;
        s.tone -= 0.12 * gauss(u, v, 14.0, 14.35, 0.7, 0.25);
        // Stubble: the glaze where its brushy border lets it through.
        const w = stubW(u, v);
        if (w > 0) {
          const th = hash2(Math.floor((u * 2.4 + v * 1.1) * (d / 2) * k), Math.floor((v * 2.4 - u * 1.1) * (d / 4) * k * 1.5), 53);
          if (w > th * 0.85 + 0.08) {
            s.mat = stub;
            // A glaze: a little darker overall, denser along the jaw line.
            s.tone -= 0.1 + 0.06 * gauss(u, v, 11.5, 16.9, 2.5, 0.5);
            // A few darker hair dabs (4×).
            if (d * k >= 4 && hash2(s.X >> 1, s.Y, 61) < 0.06) s.tone -= 0.1;
          }
        }
        // The raised brow: one dark arched stroke of the hair's paint.
        {
          const b = bez(u, v, browC[0], browC[1], browC[2]);
          const wdt = 0.24 + 0.1 * Math.sin(Math.PI * Math.min(1, b.t * 1.2));
          if (b.dist < wdt) {
            s.mat = brow;
            s.tone += 0.02 - 0.08 * b.t;
          }
        }
        // The mouth as a value shape.
        if (mouthC) {
          const m = bez(u, v, mouthC[0], mouthC[1], mouthC[2]);
          const wdt = 0.13 + 0.09 * m.t;
          if (m.dist < wdt) s.tone -= 0.5;
          else if (m.dist < wdt + 0.35) {
            // Lit lower lip under the front half; shade over the back corner.
            const below = v > mouthC[0][1] + (mouthC[2][1] - mouthC[0][1]) * m.t;
            if (below && m.t < 0.55) s.tone += 0.1;
            else if (!below) s.tone -= 0.05;
          }
          if (face.mouth === 'smirk' || face.mouth === 'chew' || face.mouth === 'smile') {
            // The corner's crease and the cheek lifted over it.
            const bc = mouthC[2];
            const cr = bez(u, v, bc, [bc[0] - 0.25, bc[1] - 0.15], [bc[0] - 0.35, bc[1] - 0.55]);
            if (cr.dist < 0.13) s.tone -= 0.3;
            s.tone += 0.08 * gauss(u, v, bc[0] - 0.4, bc[1] - 0.9, 0.6, 0.45);
          }
          if (face.mouth === 'chew') s.tone += 0.1 * gauss(u, v, 12.0, 14.9, 0.7, 0.6);
        }
      },
    });
  }

  // The hair: a raised mass over the skull, the brush in arcs round the crown.
  {
    const [bx, by, bw, bh] = box(2.4, 5.4, 15.8, 16.2);
    c.heightField(bx, by, bw, bh, (x, y) => {
      const [u, v] = toLocal(x, y);
      const hh = hairH(u, v);
      return hh === hh ? hh * k : NaN;
    }, {
      mat: hairM,
      part: hairPart,
      z: z + 0.4,
      tex: (s) => {
        const [u, v] = toLocal(s.x, s.y);
        // Combed locks: thin lanes round the crown, each a little lighter or darker, broken into
        // lengths (the comb's streaks).
        const r = Math.hypot(u - 8.8, v - 12.4);
        const a = Math.atan2(u - 8.8, -(v - 12.4));
        const lane = Math.floor(r * 3);
        const seg = Math.floor(a * r * 0.55 + hash2(lane, 9, 73) * 3);
        s.tone += (hash2(lane, seg, 71) - 0.5) * 0.08;
        // The lit front lift, the sheen along the top.
        s.tone += 0.05 * gauss(u, v, 11.4, 7.7, 1.5, 0.7);
        // The ends at the hairline: a darker, broken edge.
        if (hairGap(u, v) < 0.3 && hash2(s.X, s.Y >> 1, 72) < 0.45) s.tone -= 0.08;
      },
    });
  }

  // The eye (and the open mouth) as fixed paint over the skin.
  const paintLocal = (u0: number, v0: number, u1: number, v1: number, fn: (u: number, v: number) => Color): void => {
    const [bx, by, bw, bh] = box(u0, v0, u1, v1);
    c.paint(bx, by, bw, bh, (x, y) => {
      const [u, v] = toLocal(x, y);
      return fn(u, v);
    }, z + 8);
  };
  const [ex, ey] = EYE;
  const lidArc = (u: number, v: number, a: Pt, m: Pt, b: Pt, w: number): boolean => bez(u, v, a, m, b).dist < w;
  const fine = d * k >= 4;
  switch (face.eye) {
    case 'open':
    case 'wide':
    case 'half': {
      const wide = face.eye === 'wide';
      const half = face.eye === 'half';
      paintLocal(ex - 1.2, ey - 1.2, ex + 1.3, ey + 1.0, (u, v) => {
        const white = ell(u, v, ex + 0.22, ey + 0.05, wide ? 0.9 : 0.78, wide ? 0.68 : 0.5) < 1 && u > ex - (wide ? 0.85 : 0.55);
        const lidTop = ey - (wide ? 0.62 : 0.45) + (half ? 0.45 : 0);
        // The heavy upper lid line (lashes), thicker at the back.
        if (!wide && lidArc(u, v, [ex - 0.7, ey - 0.12], [ex, lidTop - 0.15], [ex + 0.95, ey - 0.15 + (half ? 0.2 : 0)], fine ? 0.17 : 0.24)) return C.lid;
        if (!white) return 0;
        if (v < lidTop + 0.1) return half ? 0 : C.lid;
        const ir = ell(u, v, ex + (half ? 0.05 : 0), ey + (half ? 0.12 : 0.02), wide ? 0.3 : 0.42, wide ? 0.38 : 0.52);
        if (ir < 1) {
          if (fine && ell(u, v, ex - 0.12, ey - 0.2, 0.17, 0.17) < 1 && !half) return C.glint;
          if (ell(u, v, ex + 0.05, ey + 0.04, 0.24, 0.32) < 1) return C.pupil;
          return v > ey + 0.15 ? C.irisLit : C.iris;
        }
        return v < ey - 0.12 ? C.whiteShade : C.white;
      });
      if (!fine) {
        // 2×: one catchlight art px on the iris.
        paintLocal(ex - 0.4, ey - 0.4, ex + 0.1, ey, (u, v) => (!half && ell(u, v, ex - 0.12, ey - 0.2, 0.26, 0.26) < 1 ? C.glint : 0));
      }
      break;
    }
    case 'closed':
      paintLocal(ex - 1, ey - 0.8, ex + 1.2, ey + 0.8, (u, v) => (lidArc(u, v, [ex - 0.65, ey - 0.05], [ex + 0.1, ey + 0.35], [ex + 0.9, ey - 0.02], fine ? 0.15 : 0.22) ? C.lid : 0));
      break;
    case 'happy':
      paintLocal(ex - 1, ey - 1, ex + 1.2, ey + 0.8, (u, v) => (lidArc(u, v, [ex - 0.7, ey + 0.2], [ex + 0.1, ey - 0.55], [ex + 0.85, ey + 0.15], fine ? 0.15 : 0.22) ? C.lid : 0));
      break;
    case 'squeeze':
      paintLocal(ex - 1, ey - 1, ex + 1.2, ey + 1, (u, v) => {
        const w = fine ? 0.15 : 0.22;
        return lidArc(u, v, [ex + 0.8, ey], [ex + 0.1, ey - 0.25], [ex - 0.6, ey - 0.5], w) || lidArc(u, v, [ex + 0.8, ey], [ex + 0.1, ey + 0.2], [ex - 0.6, ey + 0.45], w) ? C.lid : 0;
      });
      break;
  }
  // Open mouths: a dark interior, the tongue, a row of teeth.
  const open = face.mouth === 'open' ? ([13.75, 15.6, 0.72, 0.58] as const) : face.mouth === 'yawn' ? ([13.6, 15.8, 0.68, 0.95] as const) : face.mouth === 'o' ? ([13.9, 15.6, 0.42, 0.48] as const) : null;
  if (open) {
    const [mx, my, rx, ry] = open;
    paintLocal(mx - rx - 0.2, my - ry - 0.2, mx + rx + 0.2, my + ry + 0.2, (u, v) => {
      if (ell(u, v, mx, my, rx, ry) >= 1) return 0;
      if (face.mouth === 'open' && v < my - ry * 0.45) return fine && v < my - ry * 0.75 ? C.teethShade : C.teeth;
      if (v > my + ry * 0.35) return C.tongue;
      return u > mx + rx * 0.3 ? C.mouthLit : C.mouth;
    });
  }
  if (face.mouth === 'grimace') {
    paintLocal(12.3, 14.9, 14.6, 16.0, (u, v) => {
      if (u < 12.6 || u > 14.4 || Math.abs(v - 15.45) > 0.32) return 0;
      if (Math.abs(v - 15.45) < (fine ? 0.08 : 0.13)) return C.mouth;
      return Math.abs(v - 15.45) > 0.24 ? C.lid : C.teeth;
    });
  }
  return { face: facePart, hair: hairPart };
}
