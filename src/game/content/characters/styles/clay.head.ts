/**
 * Art-direction trial `clay` (clay.ts): VINCENT's sculpted clay head. A ball cranium and an egg
 * jaw melted together, a ball nose, a cup ear, a bead eye under a heavy lid, ONE eyebrow raised
 * high (a sausage of dark clay), the smirk carved in with a tool (the back corner pulled up), the
 * heavy stubble pricked into the jaw, the short crop pressed on as a cap with scored locks and a
 * high hairline. Every piece is a height field in the head's own frame, so a tool groove is real
 * relief (lit lip, dark trough) and the head turns and scales (Helium Head) as one sculpture.
 *
 * Head frame: origin at the neck px centre (the rig's NECK), x forward, y down, logical px at
 * head scale 1; the rig's head centre is (1, −6).
 */
import type { Color } from '../../../../engine/color';
import type { Expression } from '../../../art/humanoid';
import type { DrawOpts, TexSample } from '../../../art/hd/canvas';
import { DEG, type V } from './clay.rig';
import { segDist, vnoise, type ClayPainter } from './clay.paint';

type HF = (x: number, y: number) => number;

/** Height of an ellipsoid cap at (x, y): ry-scaled dome, −Infinity outside. */
function dome(x: number, y: number, cx: number, cy: number, rx: number, ry: number, hgt = Math.min(rx, ry)): number {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  const q = 1 - u * u - v * v;
  return q > 0 ? hgt * Math.sqrt(q) : -Infinity;
}

/** Smooth max (clay melted together). */
function smax(a: number, b: number, k: number): number {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + (h * h * k) / 4;
}

/** A soft bump (0..1) of an ellipse, cosine falloff. */
function bump(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  return q < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(q)) : 0;
}

/** Distance to a polyline. */
function polyDist(x: number, y: number, pts: readonly V[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(x, y, pts[i], pts[i + 1])[0]);
  return best;
}

/** A tool groove profile (0..1) at distance `dist` of its line, half-width w. */
function trough(dist: number, w: number): number {
  return dist < w ? 0.5 + 0.5 * Math.cos((Math.PI * dist) / w) : 0;
}

/** Quadratic curve through a, b (control) and c, as a polyline. */
function curve(a: V, b: V, c: V, n = 8): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]);
  }
  return out;
}

// ------------------------------------------------------------------------------------ the shape

const CRAN = { cx: 0.45, cy: -7.0, rx: 6.15, ry: 5.95 };
const JAW = { cx: 2.7, cy: -3.55, rx: 4.3, ry: 3.25 };
const NOSE = { cx: 6.8, cy: -5.2, rx: 1.4, ry: 1.2 };
const EAR = { cx: -1.55, cy: -5.6, rx: 1.35, ry: 1.85 };
const EYE = { cx: 4.0, cy: -6.85, rx: 1.1, ry: 1.35 };
/** The hair cap: a shell a little larger than the cranium. */
const CAP = { cx: 0.3, cy: -7.25, rx: 6.75, ry: 6.45 };

/** The skull (cranium + jaw) height with the sculpted forms: brow ridge, cheek, chin. */
function skullH(x: number, y: number): number {
  let h = smax(dome(x, y, CRAN.cx, CRAN.cy, CRAN.rx, CRAN.ry, 5.2), dome(x, y, JAW.cx, JAW.cy, JAW.rx, JAW.ry, 4.0), 1.6);
  if (h === -Infinity) return NaN;
  h += 0.45 * bump(x, y, 4.3, -8.55, 2.1, 0.85); // the brow ridge
  h += 0.35 * bump(x, y, 2.6, -4.9, 1.8, 1.4); // the cheek
  h += 0.3 * bump(x, y, 5.0, -1.4, 1.5, 1.0); // the chin
  h -= 0.35 * bump(x, y, 4.0, -7.0, 1.8, 1.9); // the eye socket
  return h;
}

/** Is (x, y) under the hair (the short crop with a high front hairline)? */
/** The cap's lumpy rim: a slow wobble of its radius round the head (hand-pressed, not a lathe). */
function capWob(x: number, y: number): number {
  const ang = Math.atan2(y - CAP.cy, x - CAP.cx);
  return 1 + 0.035 * vnoise(ang * 2.4 + 10, 0.5, 3);
}

/** Is (x, y) under the hair (the short crop with a high front hairline)? */
function hairAt(x: number, y: number): boolean {
  const k = capWob(x, y);
  if (dome(x, y, CAP.cx, CAP.cy, CAP.rx * k, CAP.ry * k) === -Infinity) return false;
  // Front: a high hairline over a bare forehead, rising toward the front.
  if (x > 2.2) return y < -10.5 - (x - 2.2) * 0.3;
  // Temple and sideburn in front of the ear.
  if (x > 0.9) return y < -9.0 + (2.2 - x) * 0.6;
  if (x > -0.5) return y < -5.0;
  // Behind the ear down to the nape.
  return y < -3.6 + (x + 0.5) * 0.25;
}

// ------------------------------------------------------------------------------------ expressions

interface Face {
  /** Upper lid: 0 = wide open … 1 = closed. */
  lid: number;
  /** Eye shape when closed: a lid line, a happy arc, a squeezed chevron, a spiral. */
  eye: 'open' | 'closed' | 'happy' | 'squeeze' | 'spiral';
  /** Near (raised) brow and far brow: lift (+ up) and slant (+ the inner end down). */
  browN: [number, number];
  browF: [number, number];
  mouth: 'smirk' | 'smile' | 'grin' | 'open' | 'o' | 'yawn' | 'grimace' | 'wobble' | 'chew';
  pupil: number;
}

function faceOf(expr: Expression): Face {
  switch (expr) {
    case 'blink':
      return { lid: 1, eye: 'closed', browN: [1.1, 0], browF: [0, 0.2], mouth: 'smirk', pupil: 0.62 };
    case 'happy':
      return { lid: 1, eye: 'happy', browN: [0.9, -0.1], browF: [0.2, 0], mouth: 'grin', pupil: 0.62 };
    case 'smile':
      return { lid: 0.3, eye: 'open', browN: [0.9, 0], browF: [0.2, 0], mouth: 'smile', pupil: 0.62 };
    case 'shout':
      return { lid: 0.15, eye: 'open', browN: [-0.1, 0.55], browF: [-0.2, 0.5], mouth: 'open', pupil: 0.58 };
    case 'panic':
      return { lid: 0, eye: 'open', browN: [1.3, -0.4], browF: [1.0, -0.4], mouth: 'o', pupil: 0.45 };
    case 'hurt':
      return { lid: 1, eye: 'squeeze', browN: [0.1, 0.5], browF: [0, 0.4], mouth: 'grimace', pupil: 0.62 };
    case 'yawn':
      return { lid: 1, eye: 'closed', browN: [0.9, -0.2], browF: [0.4, -0.2], mouth: 'yawn', pupil: 0.62 };
    case 'dazed':
    case 'soot':
      return { lid: 0.2, eye: 'spiral', browN: [0.6, -0.3], browF: [0.5, -0.3], mouth: 'wobble', pupil: 0.62 };
    case 'chew':
      return { lid: 0.4, eye: 'open', browN: [1.0, 0], browF: [0, 0.2], mouth: 'chew', pupil: 0.62 };
    default:
      // VINCENT at rest: the smug half-lidded look, one brow raised high, the smirk.
      return { lid: 0.36, eye: 'open', browN: [1.15, -0.05], browF: [-0.1, 0.35], mouth: 'smirk', pupil: 0.62 };
  }
}

/** The mouth line (a carved groove) per mouth, and an open cavity ellipse when open. */
function mouthOf(m: Face['mouth']): { line: V[] | null; cavity: { cx: number; cy: number; rx: number; ry: number } | null; w: number } {
  switch (m) {
    case 'smirk':
      // Front corner low, the back corner pulled up into the cheek.
      return { line: [...curve([6.05, -2.3], [4.8, -2.0], [3.45, -3.35]), [3.15, -3.95]], cavity: null, w: 0.36 };
    case 'smile':
      return { line: curve([6.0, -2.7], [5.0, -1.6], [3.6, -3.0]), cavity: null, w: 0.36 };
    case 'grin':
      return { line: curve([6.1, -2.6], [5.0, -1.2], [3.4, -3.2]), cavity: { cx: 5.0, cy: -2.1, rx: 1.1, ry: 0.5 }, w: 0.34 };
    case 'open':
      return { line: null, cavity: { cx: 5.05, cy: -2.0, rx: 1.25, ry: 1.0 }, w: 0.3 };
    case 'o':
      return { line: null, cavity: { cx: 5.2, cy: -2.0, rx: 0.85, ry: 0.95 }, w: 0.3 };
    case 'yawn':
      return { line: null, cavity: { cx: 5.0, cy: -1.95, rx: 1.15, ry: 1.35 }, w: 0.3 };
    case 'grimace':
      return { line: [[6.1, -2.3], [5.5, -2.65], [4.9, -2.25], [4.3, -2.65], [3.7, -2.35]], cavity: null, w: 0.32 };
    case 'wobble':
      return { line: [[6.0, -2.4], [5.4, -2.1], [4.8, -2.5], [4.2, -2.15], [3.7, -2.4]], cavity: null, w: 0.3 };
    case 'chew':
      return { line: curve([5.9, -2.3], [5.0, -2.6], [4.2, -2.2]), cavity: null, w: 0.32 };
  }
}

// ------------------------------------------------------------------------------------ drawing

/**
 * Draw the head on the painter's canvas at base depth z. Returns the head's part ids (for the
 * Helium rim) and its centre on the working canvas (index px: the rig's `head` point).
 */
export function drawHead(p: ClayPainter, z: number): { parts: number[]; center: V } {
  const c = p.c;
  const pose = p.pose;
  const sk = p.sk;
  const k = pose.headScale === 2 ? 2 : 1;
  const hx = pose.head?.dx ?? 0;
  const hy = pose.head?.dy ?? 0;
  const neckB: V = [sk.neck[0] + hx, sk.neck[1] + hy + 1];
  const N = p.J(neckB);
  const th = ((pose.head?.tilt ?? 0) + p.rot) * DEG;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const toC = (x: number, y: number): V => [N[0] + (x * cs - y * sn) * k, N[1] + (x * sn + y * cs) * k];
  const toL = (X: number, Y: number): V => {
    const dx = (X - N[0]) / k;
    const dy = (Y - N[1]) / k;
    return [dx * cs + dy * sn, -dx * sn + dy * cs];
  };
  const parts: number[] = [];
  /** Is art px (X, Y) drawn by `part` (fixed details only land on their own part)? */
  const on = (X: number, Y: number, part: number): boolean => {
    if (X < 0 || Y < 0 || X >= c.W || Y >= c.H) return false;
    const i = Y * c.W + X;
    return c.mat[i] !== 0 && c.part[i] === part;
  };
  const fine = p.fine;
  const hd = p.hd;
  const face = faceOf(pose.expr ?? 'normal');
  const calm = (pose.expr ?? 'normal') === 'normal' || pose.expr === 'blink' || pose.expr === 'chew' || pose.expr === 'smile';

  /** A height field in head coords over the local box, as one part. */
  const field = (box: readonly [number, number, number, number], hf: HF, o: DrawOpts, tex?: (s: TexSample, x: number, y: number) => void): number => {
    const [x0, y0, x1, y1] = box;
    const pts = [toC(x0, y0), toC(x1, y0), toC(x0, y1), toC(x1, y1)];
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (const q of pts) {
      bx0 = Math.min(bx0, q[0]);
      by0 = Math.min(by0, q[1]);
      bx1 = Math.max(bx1, q[0]);
      by1 = Math.max(by1, q[1]);
    }
    const part = o.part ?? c.newPart();
    parts.push(part);
    c.heightField(bx0 - 0.5, by0 - 0.5, bx1 - bx0 + 1, by1 - by0 + 1, (X, Y) => {
      const [x, y] = toL(X, Y);
      const h = hf(x, y);
      return h === h ? h * k : NaN;
    }, {
      ...o,
      part,
      tex: tex
        ? (s) => {
            const [x, y] = toL(s.x, s.y);
            tex(s, x, y);
          }
        : o.tex,
    });
    return part;
  };

  // The neck: a short skin sausage down into the collar.
  {
    const a = toC(0.1, 0.9);
    const b = toC(0.7, -2.8);
    c.capsule(a[0], a[1], b[0], b[1], 1.9 * k, 2.0 * k, { mat: p.mat('skin'), z: -4, tone: -0.12 });
  }

  // ---- the skull: cranium + jaw, the carved mouth, stubble pricked into the jaw.
  const mouth = mouthOf(face.mouth);
  const skin = p.mat('skin');
  const stubble = p.mat('stubble');
  const lipM = p.mat('lip');
  const cavM = p.mat('tie', { lo: 0, hi: 2, spec: 0.3 });
  const tongueM = p.mat('pink', { lo: 1, hi: 3 });
  const cheek = face.mouth === 'chew' ? 0.7 : 0;
  const skullHF: HF = (x, y) => {
    let h = skullH(x, y);
    if (h !== h) return NaN;
    if (cheek > 0) h += cheek * bump(x, y, 3.6, -3.2, 1.7, 1.4);
    // Carve the mouth line and dent the open mouth.
    if (mouth.line) h -= 0.42 * trough(polyDist(x, y, mouth.line), mouth.w);
    if (mouth.cavity) {
      const m = mouth.cavity;
      const q = ((x - m.cx) / m.rx) ** 2 + ((y - m.cy) / m.ry) ** 2;
      if (q < 1) h -= 0.9 * Math.sqrt(1 - q);
      else if (q < 1.6) h += 0.18 * (1 - (q - 1) / 0.6); // the lips roll out round the hole
    }
    // The nostril and the line from the nose wing to the mouth corner.
    h -= 0.25 * trough(Math.hypot(x - 6.2, y + 4.35), 0.35);
    return h;
  };
  // Stubble zone: the jaw and the upper lip below the cheekbone line.
  // Stubble: how far below the (wobbly) cheek line a point lies (> 0: in the stubble).
  const stubbleDepth = (x: number, y: number): number => {
    if (x < -0.7) return -9;
    if (dome(x, y, NOSE.cx, NOSE.cy, NOSE.rx + 0.2, NOSE.ry + 0.2) !== -Infinity) return -9;
    const line = (x < 2.8 ? -3.8 + (x + 0.7) * 0.1 : x < 5.3 ? -3.45 + (x - 2.8) * 0.05 : -3.75) + 0.3 * vnoise(x * 1.4, 0.5, 21);
    return y - line;
  };
  /** A tool prick of the stubble at (x, y): a jittered grid of small pits (`keep` of 4 kept). */
  const prick = (x: number, y: number, keep: number): boolean => {
    const g = 0.5;
    const gx = Math.floor(x / g);
    const gy = Math.floor(y / g);
    if (((gx * 7 + gy * 13) & 3) >= keep) return false;
    const jx = (vnoise(gx * 1.7, gy * 1.3, 5) * 0.5 + 0.5) * g * 0.7;
    const jy = (vnoise(gx * 1.1, gy * 1.9, 9) * 0.5 + 0.5) * g * 0.7;
    const dx = x - (gx * g + g * 0.15 + jx);
    const dy = y - (gy * g + g * 0.15 + jy);
    return dx * dx + dy * dy < 0.018;
  };
  const skullPart = field([-6, -13.2, 7.2, 0.2], skullHF, { mat: skin, z, round: 1 }, (s, x, y) => {
    if (mouth.cavity) {
      const m = mouth.cavity;
      const q = ((x - m.cx) / m.rx) ** 2 + ((y - m.cy) / m.ry) ** 2;
      if (q < 1) {
        // The open mouth: a dark red hole, a pink tongue at its floor.
        const tongue = y > m.cy + m.ry * 0.25 && face.mouth !== 'o';
        s.mat = tongue ? tongueM : cavM;
        s.tone -= tongue ? 0.1 : 0.3;
        return;
      }
      if (q < 1.6) {
        s.mat = lipM;
        return;
      }
    }
    const md = mouth.line ? polyDist(x, y, mouth.line) : Infinity;
    if (md < mouth.w * 0.55) {
      // The carved line itself: a dark trough.
      s.tone -= 0.55;
      return;
    }
    const sd = stubbleDepth(x, y);
    if (sd > 0 && md > mouth.w + 0.28) {
      s.mat = stubble;
      if (fine && prick(x, y, 3)) s.tone -= 0.45;
      return;
    }
    if (fine && sd > -0.9 && md > mouth.w + 0.28 && prick(x, y, sd > -0.45 ? 2 : 1)) {
      // A few stray pricks fading out above the cheek line.
      s.mat = stubble;
      s.tone -= 0.1;
      return;
    }
    if (fine) {
      const a = vnoise(x * 0.9, y * 0.9, 3) * 0.12;
      s.nx += a;
      s.ny += vnoise(x * 0.9 + 4, y * 0.9, 4) * 0.12;
    }
  });

  // ---- the ear: a cup pressed on the side, a C groove inside.
  field([-3.2, -7.8, 0.2, -3.4], (x, y) => {
    let h = dome(x, y, EAR.cx, EAR.cy, EAR.rx, EAR.ry, 1.0);
    if (h === -Infinity) return NaN;
    const r = Math.hypot((x - EAR.cx + 0.2) / 0.8, (y - EAR.cy) / 1.15);
    if (x > EAR.cx - 0.6) h -= 0.45 * trough(Math.abs(r - 0.75), 0.35);
    return h + 4.6;
  }, { mat: skin, z: z + 7, tone: -0.05 });

  // ---- the hair: a cap with scored locks.
  const hairM = p.mat('hair');
  field([-6.6, -14, 5.2, -3.2], (x, y) => {
    if (!hairAt(x, y)) return NaN;
    const k = capWob(x, y);
    let h = dome(x, y, CAP.cx, CAP.cy, CAP.rx * k, CAP.ry * k, 5.6);
    if (h === -Infinity) return NaN;
    // A smooth pressed cap: slow lumps of the thumb, a few long tool strokes swept back from
    // the front hairline, a little tuft at the front.
    h += 0.28 * vnoise(x * 0.55 + 3, y * 0.55, 17);
    const fx = x + 10;
    const fy = y + 1.5;
    const psi = Math.atan2(fy, fx) * 7.5 + Math.hypot(fx, fy) * 0.12;
    const f = psi - Math.floor(psi);
    h -= 0.38 * trough(Math.min(f, 1 - f), 0.1);
    h += 0.12 * Math.sin(f * Math.PI);
    h += 0.55 * bump(x, y, 3.3, -11.7, 1.9, 1.05);
    // The rolled front edge of the crop.
    return h;
  }, { mat: hairM, z: z + 6 });

  // ---- the eye: a white bead under a heavy lid (or a closed lid line).
  const eyeOpen = face.eye === 'open' || face.eye === 'spiral';
  let eyePart = -1;
  if (eyeOpen) {
    eyePart = field([EYE.cx - 1.6, EYE.cy - 1.8, EYE.cx + 1.6, EYE.cy + 1.8], (x, y) => {
      const h = dome(x, y, EYE.cx, EYE.cy, EYE.rx, EYE.ry, 0.9);
      return h === -Infinity ? NaN : h + 4.4;
    }, { mat: p.mat('eye'), z: z + 8 });
    // The lid: skin over the top of the bead down to the lid line.
    const lidY = EYE.cy - EYE.ry + face.lid * EYE.ry * 1.7;
    if (face.lid > 0.02) {
      field([EYE.cx - 1.7, EYE.cy - 2.0, EYE.cx + 1.7, EYE.cy + 1.8], (x, y) => {
        const h = dome(x, y, EYE.cx, EYE.cy - 0.05, EYE.rx + 0.28, EYE.ry + 0.22, 1.2);
        if (h === -Infinity) return NaN;
        // The smug lid line tilts down toward the nose.
        if (y > lidY - (x - EYE.cx) * 0.08) return NaN;
        return h + 4.6;
      }, { mat: skin, z: z + 9, tone: -0.05 });
    }
  } else {
    // Closed: the lid as a soft bulge with a carved line (a happy arc, a squeezed chevron).
    const line: V[] =
      face.eye === 'happy'
        ? curve([EYE.cx - 1.2, EYE.cy + 0.3], [EYE.cx, EYE.cy - 1.2], [EYE.cx + 1.2, EYE.cy + 0.3])
        : face.eye === 'squeeze'
          ? [[EYE.cx - 1.1, EYE.cy - 0.7], [EYE.cx + 0.9, EYE.cy], [EYE.cx - 1.1, EYE.cy + 0.6]]
          : curve([EYE.cx - 1.2, EYE.cy - 0.1], [EYE.cx, EYE.cy + 0.8], [EYE.cx + 1.2, EYE.cy - 0.1]);
    field([EYE.cx - 1.8, EYE.cy - 2.0, EYE.cx + 1.8, EYE.cy + 1.8], (x, y) => {
      let h = dome(x, y, EYE.cx, EYE.cy, EYE.rx + 0.2, EYE.ry + 0.1, 0.8);
      if (h === -Infinity) return NaN;
      h -= 0.5 * trough(polyDist(x, y, line), 0.3);
      return h + 4.3;
    }, { mat: skin, z: z + 9 });
  }

  // ---- the brows: sausages of dark clay. The near one raised high (Vincent), the far one low.
  const browM = p.mat('brow');
  const [nl, ns] = face.browN;
  const nb: V[] = [[2.45, -8.55 - nl + ns * 0.5], [3.7, -9.05 - nl * 1.1], [5.15, -8.75 - nl + -ns * 0.6]];
  const nbRaised = calm && nl > 0.6;
  if (nbRaised) {
    // The arched raised brow: high in the middle, a clear gap over the eye.
    nb[0] = [2.5, -8.85 - nl * 0.3];
    nb[1] = [3.55, -9.15 - nl];
    nb[2] = [4.95, -8.75 - nl * 0.85];
  }
  const browPart = field([1.6, -11.6, 6.0, -7.0], (x, y) => {
    const dd = polyDist(x, y, nb);
    const r = 0.62 - 0.12 * Math.abs((x - 3.8) / 1.8);
    return dd < r ? Math.sqrt(1 - (dd / r) ** 2) * 0.55 + 5.1 : NaN;
  }, { mat: browM, z: z + 10 });
  const [fl, fs] = face.browF;
  const fb: V[] = [[5.75, -8.35 - fl + fs * 0.3], [6.85, -7.95 - fl - fs * 0.4]];
  field([5.0, -10.4, 7.6, -6.8], (x, y) => {
    const dd = polyDist(x, y, fb);
    return dd < 0.5 ? Math.sqrt(1 - (dd / 0.5) ** 2) * 0.45 + 5.1 : NaN;
  }, { mat: browM, z: z + 10 });

  // ---- the nose: a ball of clay with a nostril.
  field([NOSE.cx - 1.8, NOSE.cy - 1.6, NOSE.cx + 1.8, NOSE.cy + 1.6], (x, y) => {
    let h = dome(x, y, NOSE.cx, NOSE.cy, NOSE.rx, NOSE.ry, 1.2);
    if (h === -Infinity) return NaN;
    h -= 0.35 * trough(Math.hypot((x - (NOSE.cx - 0.55)) / 1.3, y - (NOSE.cy + 0.7)), 0.38);
    return h + 4.7;
  }, { mat: skin, z: z + 8, tone: 0.04 });

  // ---- fixed details: the pupil and its catchlight, the dizzy spiral.
  if (eyeOpen) {
    const pc = toC(EYE.cx + 0.42, EYE.cy + 0.12);
    const ink: Color = hd ? p.col('sole', 0, 0) : p.col('sole', 0, 0);
    if (face.eye === 'spiral' && hd) {
      p.c.paint(pc[0] - 2 * k, pc[1] - 2 * k, 4 * k, 4 * k, (lx, ly, X, Y) => {
        if (!on(X, Y, eyePart)) return 0;
        const [x, y] = toL(lx, ly);
        const r = Math.hypot(x - EYE.cx - 0.1, y - EYE.cy);
        const a = Math.atan2(y - EYE.cy, x - EYE.cx - 0.1);
        if (r > 1.05) return 0;
        const ph = r * 2.6 - a / (2 * Math.PI);
        return Math.abs(ph - Math.round(ph)) < 0.2 ? ink : 0;
      }, 1e6);
    } else {
      const lidY = EYE.cy - EYE.ry + face.lid * EYE.ry * 1.7;
      // The pupil shows below the lid only.
      const r = face.pupil * k;
      p.c.paint(pc[0] - r - 1, pc[1] - r - 1, r * 2 + 2, r * 2 + 2, (lx, ly, X, Y) => {
        if (!on(X, Y, eyePart)) return 0;
        const [x, y] = toL(lx, ly);
        if (y < lidY - (x - EYE.cx) * 0.08 + 0.05) return 0;
        return (lx - pc[0]) ** 2 + (ly - pc[1]) ** 2 <= r * r ? ink : 0;
      }, 1e6);
      if (hd && face.lid < 0.55) {
        const cl = toC(EYE.cx + 0.2, EYE.cy - 0.05);
        const rr = Math.max((fine ? 0.2 : 0.26) * k, 0.5 / p.d);
        const white = p.col('eye', 6, 3);
        p.c.paint(cl[0] - rr - 1, cl[1] - rr - 1, rr * 2 + 2, rr * 2 + 2, (lx, ly, X, Y) => (on(X, Y, eyePart) && (lx - cl[0]) ** 2 + (ly - cl[1]) ** 2 <= rr * rr ? white : 0));
      }
    }
  }
  if (!hd) {
    // 1×: the carved lines would fall between the px: paint the mouth and the brow dark.
    const dark = p.col('brow', 0, 0);
    const line = mouth.line;
    const dot1 = (q: V, col: Color, part: number): void => {
      const a = toC(q[0], q[1]);
      const X = Math.floor(a[0]);
      const Y = Math.floor(a[1]);
      if (on(X, Y, part)) p.c.dot(a[0], a[1], col);
    };
    if (line) for (const q of line) dot1(q, p.col('skin', 0, 0), skullPart);
    for (const q of nb) dot1(q, dark, browPart);
  }
  const cIdx = toC(1, -6);
  return { parts, center: [cIdx[0] - 0.5 + p.org[0], cIdx[1] - 0.5 + p.org[1]] };
}
