/**
 * Style `arcade` (arcade.ts): VINCENT's head, drawn natively on the body canvas — a big (about
 * 15 % larger than the rig's) caricature head with bold, readable features: a strong raised
 * brow, heavy-lidded smug eyes, a big nose, a lopsided smirk, the stubble as one clean dark band,
 * and a short crop of sculpted hair locks with a highlight glint.
 *
 * Head space: logical px of the rig's head (1 = one 1× px at scale 1), origin at the centre of
 * the neck pixel (the rig's NECK), x forward, y down. The painter maps it to the canvas: scale
 * (1.15, twice that for the Helium Head), turn (tilt + the figure's rot), then the neck point.
 */
import type { Color } from '../../../../engine/color';
import type { Expression } from '../../../art/humanoid';
import type { HdCanvas, Texture } from '../../../art/hd/canvas';
import { FACE, HAIR as HAIR_CEL } from './arcade-pal';

type V = [number, number];

/** The head's materials (canvas material ids). */
export interface HeadMats {
  skin: number;
  hair: number;
  stubble: number;
  brow: number;
}

/** A head placement: head space → canvas. */
export interface HeadXf {
  /** Canvas logical px of the head-space origin. */
  at: V;
  /** Scale (1.15; 2.3 for the Helium Head). */
  s: number;
  /** Turn in degrees, clockwise. */
  deg: number;
}

export interface HeadOpts {
  c: HdCanvas;
  m: HeadMats;
  xf: HeadXf;
  expr: Expression;
  /** Base depth. */
  z: number;
  /** Part ids used by the head (the Helium rim recolours their outline). */
  parts: number[];
  /** Drop the glint (tilted heads turn away from the light). */
  glint: boolean;
}

const DEG = Math.PI / 180;

class Xf {
  readonly t: HeadXf;
  readonly cs: number;
  readonly sn: number;
  constructor(t: HeadXf) {
    this.t = t;
    this.cs = Math.cos(t.deg * DEG);
    this.sn = Math.sin(t.deg * DEG);
  }
  /** Head space → canvas. */
  to(x: number, y: number): V {
    const s = this.t.s;
    return [this.t.at[0] + (x * this.cs - y * this.sn) * s, this.t.at[1] + (x * this.sn + y * this.cs) * s];
  }
  pts(p: readonly V[]): V[] {
    return p.map(([x, y]) => this.to(x, y));
  }
  /** Canvas → head space. */
  from(x: number, y: number): V {
    const s = this.t.s;
    const dx = (x - this.t.at[0]) / s;
    const dy = (y - this.t.at[1]) / s;
    return [dx * this.cs + dy * this.sn, -dx * this.sn + dy * this.cs];
  }
  /** Canvas bounds of a head-space box. */
  box(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
    const c = [this.to(x0, y0), this.to(x1, y0), this.to(x0, y1), this.to(x1, y1)];
    const xs = c.map((p) => p[0]);
    const ys = c.map((p) => p[1]);
    const a = Math.min(...xs);
    const b = Math.min(...ys);
    return [a, b, Math.max(...xs) - a, Math.max(...ys) - b];
  }
}

/** Distance from p to the segment a–b. */
function segDist(px: number, py: number, a: V, b: V): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  let t = ((px - a[0]) * vx + (py - a[1]) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - a[0] - vx * t, py - a[1] - vy * t);
}

/** Distance from p to a polyline. */
function lineDist(px: number, py: number, pts: readonly V[]): number {
  let m = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) m = Math.min(m, segDist(px, py, pts[i], pts[i + 1]));
  return m;
}

function inPolyL(x: number, y: number, pts: readonly V[]): boolean {
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

// ------------------------------------------------------------------------------------ shapes

/** The face and skull (skin silhouette), facing right: a strong chin, a big nose. */
const SKULL: readonly V[] = [
  [-1.6, -11.9],
  [1.2, -12.1],
  [3.7, -11.5],
  [5.3, -10.2],
  [6.0, -8.6],
  [6.25, -7.3],
  [6.0, -6.5],
  [6.6, -5.9],
  [7.5, -4.9],
  [7.5, -4.4],
  [6.6, -4.1],
  [6.4, -3.6],
  [6.65, -3.0],
  [6.5, -2.3],
  [6.25, -1.5],
  [5.3, -0.55],
  [3.4, -0.45],
  [1.4, -0.9],
  [-0.3, -2.0],
  [-2.6, -2.9],
  [-3.9, -3.6],
  [-4.75, -5.4],
  [-4.95, -8.0],
  [-4.0, -10.4],
];

/** The hair mass: a short crop with a high front hairline, a sideburn in front of the ear. */
const HAIR: readonly V[] = [
  [4.9, -10.0],
  [3.4, -9.4],
  [2.2, -8.6],
  [1.6, -7.5],
  [1.5, -5.6],
  [1.2, -4.5],
  [0.4, -4.4],
  [0.0, -6.0],
  [-1.2, -6.7],
  [-2.4, -6.3],
  [-2.9, -4.6],
  [-3.6, -3.3],
  [-4.6, -3.9],
  [-5.25, -6.0],
  [-5.4, -8.8],
  [-4.5, -11.4],
  [-2.3, -12.9],
  [0.8, -13.25],
  [3.4, -12.8],
  [5.2, -11.7],
  [5.75, -10.6],
];

/** Hair locks (centre, radii, turn): sculpted chunks, each with its own light. */
const LOCKS: ReadonlyArray<{ c: V; r: V; a: number }> = [
  { c: [3.3, -11.2], r: [2.6, 1.5], a: -18 },
  { c: [0.6, -11.7], r: [2.9, 1.6], a: -8 },
  { c: [-2.3, -11.0], r: [2.6, 1.7], a: 24 },
  { c: [-4.0, -8.6], r: [1.6, 2.6], a: 10 },
  { c: [-3.6, -5.4], r: [1.3, 2.0], a: -10 },
  { c: [1.4, -9.4], r: [2.4, 1.3], a: -12 },
  { c: [-1.4, -8.6], r: [2.2, 1.6], a: 18 },
  { c: [1.0, -6.4], r: [0.9, 2.0], a: 4 },
];

/** Polygon of an ellipse turned by `a` degrees (head space). */
function ellipse(c: V, r: V, a: number, n = 18): V[] {
  const cs = Math.cos(a * DEG);
  const sn = Math.sin(a * DEG);
  const out: V[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * r[0];
    const y = Math.sin(t) * r[1];
    out.push([c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]);
  }
  return out;
}

/**
 * Stubble band (head space): one clean band along the jaw from under the sideburn, widening over
 * the chin and round the mouth (the upper lip included), never over the cheek.
 */
function inStubble(x: number, y: number): boolean {
  if (x < 0.3) return false;
  // Jaw band: below a line from under the sideburn to the chin.
  if (y > -3.0 + (x - 0.3) * 0.32) return true;
  // Round the mouth: the chin and the upper lip, in front of the mouth corner.
  if (x > 4.0 && y > -3.75 + (x - 4.0) * 0.05) return true;
  return false;
}

// ------------------------------------------------------------------------------------ the head

export function drawArcadeHead(o: HeadOpts): void {
  const { c, m, expr } = o;
  const X = new Xf(o.xf);
  const z = o.z;
  const skinPart = c.newPart();
  const hairPart = c.newPart();
  o.parts.push(skinPart, hairPart);

  // The neck: behind the jaw and the collar.
  {
    const a = X.to(0.4, -1.6);
    const b = X.to(0.2, 1.6);
    const neckPart = c.newPart();
    o.parts.push(neckPart);
    c.capsule(a[0], a[1], b[0], b[1], 2.0 * o.xf.s, 1.9 * o.xf.s, { mat: m.skin, z: -0.6, part: neckPart, round: 0.7, tone: -0.12 });
  }

  // Skull and face: one soft volume; the eye socket, the cheekbone and the underside of the nose
  // as painted cel shapes; the stubble band as a material of the same surface.
  const skull = X.pts(SKULL);
  const faceTex: Texture = (s) => {
    const [x, y] = X.from(s.x, s.y);
    if (inStubble(x, y)) {
      s.mat = m.stubble;
      // The band's own small shade under the jaw line.
      if (y > -1.2 && x < 4.6) s.tone -= 0.18;
    }
    // Eye socket: a shade under the brow ridge (a clean cel cluster).
    const ex = (x - 4.4) / 1.9;
    const ey = (y + 6.0) / 1.1;
    if (ex * ex + ey * ey < 1 && y > -6.9) s.tone -= 0.22;
    // Under the nose: a hard shade wedge.
    if (y > -4.35 && y < -3.75 && x > 5.6 && x < 7.2) s.tone -= 0.45;
    // The back of the jaw turns away.
    if (x < 1.2 && y > -3.6) s.tone -= 0.12;
  };
  c.blob(skull, 2.2 * o.xf.s, { mat: m.skin, z, part: skinPart, bulge: 0.35, tex: faceTex });

  // The ear: a lit cup, its inner fold a dark crescent opening to the face.
  {
    const ear = X.pts(ellipse([-1.0, -4.7], [1.45, 1.95], 8));
    const earPart = c.newPart();
    o.parts.push(earPart);
    c.blob(ear, 0.9 * o.xf.s, {
      mat: m.skin,
      z: z + 1.4,
      part: earPart,
      bulge: 0.3,
      tex: (s) => {
        const [x, y] = X.from(s.x, s.y);
        const a1 = ((x + 0.95) / 0.75) ** 2 + ((y + 4.6) / 1.2) ** 2;
        const a2 = ((x + 0.55) / 0.75) ** 2 + ((y + 4.6) / 1.15) ** 2;
        if (a1 < 1 && a2 > 1) s.tone -= 0.6;
      },
    });
  }

  // The hair: the mass, then the locks (one surface, each lock lit as its own chunk).
  const hair = X.pts(HAIR);
  c.blob(hair, 1.2 * o.xf.s, { mat: m.hair, z: z + 2.0, part: hairPart, bulge: 0.2, tone: -0.1 });
  const inHair = (x: number, y: number): boolean => inPolyL(x, y, HAIR);
  // The locks need room: at 1× the mass alone reads cleaner.
  for (const L of c.d >= 2 ? LOCKS : []) {
    const pts = X.pts(ellipse(L.c, L.r, L.a));
    c.blob(pts, Math.min(L.r[0], L.r[1]) * 0.95 * o.xf.s, {
      mat: m.hair,
      z: z + 2.3,
      part: hairPart,
      bulge: 0.15,
      tex: (s) => {
        const [x, y] = X.from(s.x, s.y);
        if (!inHair(x, y)) s.cut = true;
      },
    });
  }

  // Features: fixed colours in head space (they turn and scale with the head).
  const k = o.xf.s;
  // At 1× a feature line is at least one px wide.
  const minW = c.d >= 2 ? 0 : 1.1 / k;
  const box = (x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => Color): void => {
    const [bx, by, bw, bh] = X.box(x0, y0, x1, y1);
    c.paint(bx - 0.5, by - 0.5, bw + 1, bh + 1, (cx, cy) => {
      const [x, y] = X.from(cx, cy);
      if (x < x0 || x > x1 || y < y0 || y > y1) return 0;
      return fn(x, y);
    });
  };
  const thick = (pts: readonly V[], w: number, col: Color): void => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const ww = Math.max(w, minW);
    box(x0 - ww, y0 - ww, x1 + ww, y1 + ww, (x, y) => (lineDist(x, y, pts) <= ww / 2 ? col : 0));
  };
  const dot = (cx: number, cy: number, rx: number, ry: number, col: Color): void => {
    box(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? col : 0));
  };

  const BROW = FACE.eye;
  const ex = 4.15;
  const ey = -5.75;
  // Brows: the raised, arched near brow (VINCENT's trait) unless the expression bends it.
  const browUp = expr === 'normal' || expr === 'blink' || expr === 'happy' || expr === 'chew' || expr === 'smile' || expr === 'soot';
  if (expr === 'shout') thick([[2.6, -8.0], [4.2, -7.5], [5.7, -6.95]], 0.95, BROW);
  else if (expr === 'panic' || expr === 'hurt') thick([[2.7, -7.2], [4.0, -7.9], [5.4, -8.6]], 0.85, BROW);
  else if (expr === 'yawn' || expr === 'dazed') thick([[2.6, -7.7], [4.1, -8.0], [5.6, -7.7]], 0.85, BROW);
  else if (browUp) thick([[2.45, -7.5], [3.4, -8.45], [4.5, -8.85], [5.75, -8.25]], 1.0, BROW);

  // Eyes.
  const lid = (pts: readonly V[]): void => thick(pts, 0.6, FACE.eye);
  if (expr === 'blink' || expr === 'yawn') {
    // Closed: a heavy lid line, curved down.
    lid([[3.1, -5.9], [4.1, -5.45], [5.2, -5.75]]);
  } else if (expr === 'happy') {
    // Closed and pleased: an arch.
    lid([[3.1, -5.45], [4.15, -6.25], [5.2, -5.55]]);
  } else if (expr === 'dazed') {
    // A ring: knocked silly.
    box(ex - 1.2, ey - 1.2, ex + 1.2, ey + 1.2, (x, y) => {
      const r = Math.hypot(x - ex, (y - ey) * 0.95);
      return r < 1.05 && r > 0.55 ? FACE.eye : r <= 0.55 ? FACE.white : 0;
    });
  } else {
    const wide = expr === 'shout' || expr === 'panic' || expr === 'hurt';
    // The white: a clean sliver in front of the pupil.
    dot(ex + 0.35, ey + 0.05, 1.05, wide ? 1.2 : 0.95, FACE.white);
    // The pupil: a tall dark oval, a crisp glint.
    const pr = expr === 'panic' ? 0.5 : 0.62;
    dot(ex + 0.15, ey + 0.15, pr, wide ? 1.05 : 0.95, FACE.eye);
    if (o.glint) dot(ex - 0.1, ey - 0.3, 0.26, 0.26, FACE.glint);
    // The heavy upper lid (the smug look) unless wide-eyed.
    if (!wide) lid([[2.9, -6.45], [4.2, -6.75], [5.45, -6.4]]);
    else lid([[3.0, -6.95], [4.2, -7.15], [5.4, -6.85]]);
    if (expr === 'hurt') lid([[3.0, -5.2], [4.2, -4.95], [5.3, -5.15]]);
  }

  // The nose: a crisp nostril.
  dot(6.3, -4.35, 0.32, 0.22, FACE.mouth);

  // Mouth.
  const mouthLine = (pts: readonly V[]): void => thick(pts, 0.55, FACE.mouth);
  if (expr === 'shout' || expr === 'panic' || expr === 'hurt') {
    // Open: a dark mouth with the top teeth.
    const cx = 5.55;
    const cy = expr === 'shout' ? -2.55 : -2.7;
    const rx = expr === 'shout' ? 1.05 : 0.9;
    const ry = expr === 'shout' ? 0.95 : 0.65;
    box(cx - rx - 0.3, cy - ry - 0.3, cx + rx + 0.3, cy + ry + 0.3, (x, y) => {
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (q > 1) return q < 1.45 ? FACE.mouth : 0;
      if (y < cy - ry * 0.45) return FACE.teeth;
      if (expr === 'shout' && y > cy + ry * 0.35) return FACE.tongue;
      return FACE.mouthIn;
    });
  } else if (expr === 'yawn') {
    box(4.6, -3.8, 6.6, -1.2, (x, y) => {
      const q = ((x - 5.55) / 0.85) ** 2 + ((y - 2.5 * -1) / 1.15) ** 2;
      if (q > 1) return q < 1.4 ? FACE.mouth : 0;
      return y > -1.9 ? FACE.tongue : FACE.mouthIn;
    });
  } else if (expr === 'happy' || expr === 'smile') {
    // A big pleased grin, the smirk's corner still higher.
    box(4.3, -3.6, 6.7, -1.8, (x, y) => {
      const top = -3.25 + (x - 4.4) * 0.05;
      const bot = -3.0 + Math.max(0, 1 - ((x - 5.5) / 1.1) ** 2) * 0.75;
      if (x < 4.45 || x > 6.45) return 0;
      if (y >= top && y <= bot) return y < top + 0.32 ? FACE.teeth : FACE.mouthIn;
      if (y > bot && y < bot + 0.45) return FACE.mouth;
      if (y < top && y > top - 0.4) return FACE.mouth;
      return 0;
    });
  } else if (expr === 'chew') {
    mouthLine([[5.0, -2.8], [6.2, -2.9]]);
    dot(4.6, -2.7, 0.55, 0.45, FACE.blush);
  } else {
    // The lopsided smirk: low at the front, the back corner hooked up into the cheek.
    thick([[6.4, -2.8], [5.5, -2.62], [4.7, -2.85], [4.3, -3.4]], 0.7, FACE.mouth);
  }
  if (expr === 'soot') {
    dot(2.6, -3.8, 0.7, 0.45, FACE.mouth);
    dot(4.8, -9.2, 0.6, 0.35, FACE.mouth);
  }

  // A crisp glint on the top lock (lit hair).
  if (o.glint) {
    const g = HAIR_CEL.ramp[4];
    thick([[1.0, -12.35], [2.2, -12.2]], 0.42, g);
    thick([[-2.9, -11.4], [-2.2, -11.85]], 0.36, g);
  }
}
