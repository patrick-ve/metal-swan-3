/**
 * The scan car's shapes as predicates in CONTINUOUS local coordinates (geometry.ts): the 1× art
 * tests pixel centres, the 2× / 4× art tests art-px centres, so every density draws the same car.
 */
import { inPoly, polyDist } from '../../../art/hd/canvas';
import { beltY, SCAN, type Pt } from './geometry';

const S = SCAN;
const K = S.scanner;

/** Distance from (x, y) to the nearer wheel centre. */
export function wheelDist(x: number, y: number): number {
  let best = Infinity;
  for (const wx of S.wheelC) best = Math.min(best, Math.hypot(x - wx, y - S.wheelCY));
  return best;
}

/** Inside the side profile (the arches not cut). */
export function inProfile(x: number, y: number): boolean {
  return inPoly(x, y, S.profile);
}

/** The painted / trimmed body: the profile less the arch cuts. */
export function inBody(x: number, y: number): boolean {
  return inProfile(x, y) && wheelDist(x, y) >= S.archR;
}

/** The dark wheel well behind a wheel (inside the profile and the arch cut). */
export function inWell(x: number, y: number): boolean {
  return inProfile(x, y) && wheelDist(x, y) < S.archR;
}

/** The black plastic arch trim (a ring round each arch cut). */
export function inTrim(x: number, y: number): boolean {
  const r = wheelDist(x, y);
  return r >= S.archR && r < S.trimR && inProfile(x, y);
}

/** The window band (glass and pillars). */
export function inBand(x: number, y: number): boolean {
  return inPoly(x, y, S.band);
}

/** Distance from the windscreen line (the band's front edge), positive behind it. */
export function screenDist(x: number, y: number): number {
  const [[ax, ay], [bx, by]] = S.screen;
  const vx = bx - ax;
  const vy = by - ay;
  const l = Math.hypot(vx, vy);
  return ((x - ax) * vy - (y - ay) * vx) / -l;
}

export type BandPart = 'screen' | 'apillar' | 'pillar' | 'glass' | null;

/**
 * What the band shows at (x, y): the windscreen sliver, the A-pillar, a black pillar (the quarter
 * glass divider, B, C, the D-pillar at the tailgate) or side glass.
 */
export function bandPart(x: number, y: number): BandPart {
  if (!inBand(x, y)) return null;
  const sd = screenDist(x, y);
  if (sd < 0.8) return 'screen';
  if (sd < 1.8) return 'apillar';
  if (x >= S.quarter[0] && x < S.quarter[1]) return 'pillar';
  for (const [x0, x1] of S.pillars) if (x >= x0 && x < x1) return 'pillar';
  if (x < S.dPillar) return 'pillar';
  return 'glass';
}

/** Glass the cabin strip shows through (the windscreen sliver and the side windows). */
export function inGlass(x: number, y: number): boolean {
  const p = bandPart(x, y);
  return p === 'glass' || p === 'screen';
}

/** Which side window (0 the front door and its quarter glass, 1 the rear door, 2 the rear quarter) holds x. */
export function windowOf(x: number): 0 | 1 | 2 {
  if (x >= S.pillars[0][1]) return 0;
  if (x >= S.pillars[1][1]) return 1;
  return 2;
}

/** The black side sill and the lower bumpers (they wrap round both ends). */
export function inSill(x: number, y: number): boolean {
  if (!inBody(x, y)) return false;
  if (y >= S.sill[0] && y < S.sill[1]) return true;
  return y >= S.lowBumper && Math.abs(x) > S.bumperX;
}

/** A red slanted bar (index: 0–2 the front door, 3 the wing stub) or −1. */
export function barAt(x: number, y: number): number {
  const B = S.bars;
  if (y < B.top || y >= B.bottom) return -1;
  const t = (B.bottom - y) / (B.bottom - B.top);
  for (let i = 0; i < B.x.length; i++) {
    const x0 = B.x[i] + B.lean * t;
    if (x >= x0 && x < x0 + B.w) return i;
  }
  return -1;
}

/** The bonnet's top face (seen a little from above). */
export function inHood(x: number, y: number): boolean {
  return inPoly(x, y, S.hood) && inBody(x, y);
}

/** The wing crease under the bonnet face at x (a straight line, continuous y). */
export function creaseY(x: number): number {
  const H = S.hood;
  return H[7][1] + ((x - H[7][0]) * (H[5][1] - H[7][1])) / (H[5][0] - H[7][0]);
}

/** How far across the bonnet face (x, y) lies: 0 at the wing crease, 1 at the bonnet's edge. */
export function hoodAcross(x: number, y: number): number {
  const H = S.hood;
  // The edge (H[0] → H[4]) and the crease (H[7] → H[5]) as straight lines.
  const ye = H[0][1] + ((x - H[0][0]) * (H[4][1] - H[0][1])) / (H[4][0] - H[0][0]);
  const yc = creaseY(x);
  return Math.max(0, Math.min(1, (yc - y) / Math.max(0.5, yc - ye)));
}

/** The red slanted stripes across the bonnet face. */
export function inStripe(x: number, y: number): boolean {
  if (!inHood(x, y)) return false;
  const T = S.stripes;
  const t = hoodAcross(x, y);
  for (const xb of T.x) {
    const e = xb + T.lean * t;
    if (x >= e && x < e + T.w) return true;
  }
  return false;
}

/** The three red crosses on the rear door (a stroke half-width `w`). */
export function inCross(x: number, y: number, w = 0.55): boolean {
  const C = S.crosses;
  const dx = Math.abs(x - C.x);
  if (dx > C.r + w) return false;
  for (const cy of C.y) {
    const dy = Math.abs(y - cy);
    if (dy > C.r + w) continue;
    if (Math.abs(dx - dy) < w * 1.42 && dx <= C.r + 0.2 && dy <= C.r + 0.2) return true;
  }
  return false;
}

/** The livery colour at (x, y) on the paint: red or not. */
export function liveryRed(x: number, y: number): boolean {
  return barAt(x, y) >= 0 || inStripe(x, y) || inCross(x, y);
}

// ---------------------------------------------------------------------------------------------
// The scanner box (frame rise, state 2 askew)
// ---------------------------------------------------------------------------------------------

/** Map a point of the (lifted, maybe askew) box back to the box's rest coordinates. */
export function boxLocal(x: number, y: number, rise: number, askew: boolean, out: [number, number]): [number, number] {
  let u = x;
  let v = y + rise;
  if (askew) {
    const [px, py] = K.pivot;
    const a = -K.askew;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = u - px;
    const dy = v - py;
    u = px + c * dx - s * dy;
    v = py + s * dx + c * dy;
  }
  out[0] = u;
  out[1] = v;
  return out;
}

/** Inside the box shell (rest coordinates). */
export function inShell(u: number, v: number): boolean {
  return inPoly(u, v, K.shell);
}

/** Distance to the box shell's edge (rest coordinates). */
export function shellEdge(u: number, v: number): number {
  return polyDist(u, v, K.shell);
}

/** A side camera window (0, 1), the front window (2), the rear window (3), else −1 (rest coordinates). */
export function camAt(u: number, v: number): number {
  for (let i = 0; i < K.windows.length; i++) {
    const [x0, x1, y0, y1] = K.windows[i];
    if (u >= x0 && u < x1 && v >= y0 && v < y1) {
      // Rounded corners.
      const cx = Math.min(u - x0, x1 - u);
      const cy = Math.min(v - y0, y1 - v);
      if (cx < 0.7 && cy < 0.7 && Math.hypot(0.7 - cx, 0.7 - cy) > 0.7) return -1;
      return i;
    }
  }
  if (inPoly(u, v, K.front)) return 2;
  if (inPoly(u, v, K.rear)) return 3;
  return -1;
}

/** The grey band (with the number) across the box's side (rest coordinates). */
export function inGreyBand(u: number, v: number): boolean {
  const [xt, xb, w] = K.band;
  const [, y0] = K.shell[0];
  const [, y1] = K.shell[6];
  const t = (v - y0) / (y1 - y0);
  const x0 = xt + (xb - xt) * t;
  return u >= x0 && u < x0 + w;
}

/** The rack: its mounting bar and its two feet down to the roof. */
export function inRack(x: number, y: number, bent = false): boolean {
  const [x0, x1, y0, y1] = K.bar;
  let yy = y;
  // Bent: the rear half of the bar droops towards the roof.
  if (bent && x < -12) yy = y - Math.min(1.4, (-12 - x) * 0.1);
  if (x >= x0 && x < x1 && yy >= y0 && yy < y1) return true;
  if (y >= y1 && y < K.feetTo) {
    for (const [f0, f1] of K.feet) {
      // The feet taper a little towards the bar.
      const k = ((y - y1) / (K.feetTo - y1)) * 0.4;
      if (x >= f0 + 0.4 - k && x < f1 - 0.4 + k) return true;
    }
  }
  return false;
}

/** The lift struts between the bar and the lifted box (x, the strut's column range). */
export function inStrut(x: number, y: number, rise: number): boolean {
  if (rise <= 0) return false;
  const top = K.bar[2] - rise - 0.4;
  if (y < top || y >= K.bar[2]) return false;
  for (const sx of K.struts) if (x >= sx && x < sx + 1.2) return true;
  return false;
}

/** The point of a strip frame's lettering block (text frame i), facing right. */
export function textAt(i: number): Pt {
  return S.text[i];
}

/** The belt line (re-exported for the art). */
export { beltY };
