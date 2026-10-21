/**
 * The container lorry's art (docs/design/ring.md §6, §11; docs/ART_GUIDE.md "UHD art"): ONE
 * density-generic drawer per strip — an `HdCanvas` at density d with the ramps of that density
 * (`PAL` at 1×, `PAL_HD` at 2× / 4×), the same shapes at the same logical places (geometry.ts),
 * outline A (it moves and can be hit). Our own livery, no maker badge, a made-up plate, our own
 * lettering (the lorry always faces right: nothing mirrors).
 *
 * The lorry is drawn in layers (lorry.ts): the trailer chassis, the container (or the open hold and
 * the dropping side panel), the rear door, the cab, the wheels (`ring/car/wheel-l`, or the blown
 * tyres' `rim`), the indicator and the brake lights. The jackknife (the death) has its own strips:
 * the wrecked cab turning toward the camera (`cab-yaw`) and the container tipping onto its side
 * (`box-tip`).
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { inPoly, type HdCanvas } from '../../../art/hd';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { glyphHit, glyphHitC } from '../traffic/lettering';
import { frac, frameOf, hash2, lineW, Pen, roll, turnPt, type Turn } from './art-kit';
import { LORRY, RIM_R, type Pt } from './geometry';

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------

export interface LorryMats {
  white: number;
  orange: number;
  red: number;
  black: number;
  plastic: number;
  well: number;
  glass: number;
  chrome: number;
  steel: number;
  head: number;
  tail: number;
  amber: number;
  rust: number;
  rustIn: number;
  wood: number;
  tyre: number;
  plate: number;
}

export function lorryMats(c: HdCanvas): LorryMats {
  return {
    white: mat(c, 'gable', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3, bounce: 0.3 }),
    orange: mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 0, hi1: 3, lo: 1, hi: 5, rim: 0.3, bounce: 0.3 }),
    red: mat(c, 'red', { spec: 0.85, shine: 42, lo1: 0, hi1: 3, lo: 2, rim: 0.3, bounce: 0.3 }),
    black: mat(c, 'black', { spec: 0.7, shine: 34, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    plastic: mat(c, 'slate', { spec: 0.25, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    well: mat(c, 'black', { spec: 0, amb: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 }),
    glass: mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 }),
    chrome: mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 4, lo: 3, hi: 6, rim: 0.4 }),
    steel: mat(c, 'steel', { spec: 0.9, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 }),
    head: mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 3, hi: 6 }),
    tail: mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 }),
    amber: mat(c, 'orange', { spec: 1, shine: 50, lo1: 0, hi1: 1, lo: 2, hi: 5 }),
    rust: mat(c, 'rust', { spec: 0.4, shine: 20, lo1: 0, hi1: 3, lo: 1, hi: 5, rim: 0.25, bounce: 0.3 }),
    rustIn: mat(c, 'rust', { spec: 0.1, shine: 10, lo1: 0, hi1: 1, lo: 0, hi: 2, amb: 0.2 }),
    wood: mat(c, 'wood', { spec: 0.2, shine: 12, lo1: 0, hi1: 2, lo: 2, hi: 5 }),
    tyre: mat(c, 'black', { spec: 0.3, shine: 12, lo1: 0, hi1: 1, lo: 1, hi: 3 }),
    plate: mat(c, 'gold', { spec: 0.5, shine: 30, lo1: 2, hi1: 3, lo: 4, hi: 6 }),
  };
}

/** The container's line: our own made-up name, a swan mark and a made-up box code. */
const LINE_NAME = 'ZWAAN';
const BOX_CODE = 'ZWAU 619072'; // ZWA: no N (the 3-wide N reads as an M at 4x)
/** A made-up yellow plate on the cab's nose (seen in the jackknife). */
const PLATE = 'ZW-99';

/** A spot of damage on a lit surface: dents (dark crescents) and bullet holes. */
function holes(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number, inside: (x: number, y: number) => boolean): void {
  const d = p.d;
  const ink = bot('black', d, 0);
  const rim = top('steel', d, 1);
  for (let i = 0; i < n; i++) {
    const hx = x + hash2(seed, i * 2) * w;
    const hy = y + hash2(seed + 7, i * 2 + 1) * h;
    if (!inside(hx, hy)) continue;
    const r = d === 1 ? 0.5 : 0.55 + hash2(seed, i) * 0.25;
    p.paint(hx - 1.5, hy - 1.5, 3, 3, (px, py) => {
      const dd = Math.hypot(px - hx, py - hy);
      if (dd < r) return ink;
      if (d > 1 && dd < r + 0.3 && px < hx && py < hy) return rim;
      return 0;
    });
  }
}

/** Dark soot over a surface (tone down where `inside`). */
function soot(p: Pen, x: number, y: number, w: number, h: number, cx: number, cy: number, rad: number, amount: number): void {
  p.shade(x, y, w, h, (px, py) => {
    const dd = Math.hypot((px - cx) / rad, (py - cy) / (rad * 0.7));
    return dd < 1 ? -amount * (1 - dd * dd) : 0;
  });
}

// ---------------------------------------------------------------------------------------------
// The cab (tractor), side view and the jackknife's yaw
// ---------------------------------------------------------------------------------------------

const CAB_SIDE: readonly Pt[] = [
  [48, -12.5],
  [48, -61],
  [50.5, -63.8],
  [60, -64.4],
  [72, -63.6],
  [80, -62],
  [85, -60],
  [88, -57],
  [89.6, -48],
  [90.6, -38],
  [91.6, -33],
  [92, -28],
  [92, -14],
  [90.4, -12.5],
];
const CAB_WIN: readonly Pt[] = [
  [66.4, -52.4],
  [86, -52.4],
  [88.4, -41],
  [66.4, -41],
];
/** Front width of the cab (front view, the jackknife). */
const CAB_W = 46;
const ARCHES: readonly Pt[] = [
  [80.5, -7.5],
  [53.5, -7.5],
];

/** Is (x, y) in a wheel arch of the cab? */
function inArch(x: number, y: number): boolean {
  if (y < -17) return false;
  for (const [ax, ay] of ARCHES) if (Math.hypot(x - ax, y - ay) < 9.4) return true;
  return false;
}

/**
 * The cab at damage state `s` turned `yaw` degrees toward the camera (0 = side on; the jackknife:
 * 25 … 90, the nose swinging toward the near lanes). The side face shrinks by cos(yaw) about its
 * back wall, the front face (`CAB_W` wide) grows to the right by sin(yaw). Wheels: only in the yaw
 * frames (the live cab's wheels are the entity's `ring/car/wheel-l`).
 */
export function cabFrame(s: number, yaw: number, d: Dn): Frame {
  const k = Math.cos((yaw * Math.PI) / 180);
  const sn = Math.sin((yaw * Math.PI) / 180);
  const p = new Pen(32, -70, yaw > 0 ? 90 : 66, 71, d);
  const c = p.c;
  const m = lorryMats(c);
  const X = (x: number): number => 48 + (x - 48) * k;
  const U = (x: number): number => (k > 0.01 ? 48 + (x - 48) / k : 48);
  const map = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [X(x), y] as const);
  const side = k > 0.12;
  const dark = yaw > 0 ? -0.25 * sn : 0;
  // The tractor's chassis rail, the fifth wheel, the air lines to the trailer (side on only).
  if (yaw === 0) {
    p.box(38, -17, 52, 4.6, { mat: m.black, z: -3.5, r: 0.4 });
    p.box(36, -21, 15, 3.6, { mat: m.steel, z: -3.4, r: 0.6, bevel: 0.5 });
    const coil = (dx: number, matId: number): void => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push([47.2 - t * 2.6 + Math.sin(t * Math.PI * 6) * 0.6 + dx, -42 + t * 20]);
      }
      p.stroke(pts, d === 1 ? 0.5 : 0.36, d === 1 ? 0.5 : 0.36, { mat: matId, z: -3 });
    };
    coil(0, m.red);
    coil(-1.4, mat(c, 'gold', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 }));
    // The drive wheel's mudguard (a black quarter arc).
    const arc: Pt[] = [];
    for (let a = 200; a <= 340; a += 20) arc.push([53.5 + Math.cos((a * Math.PI) / 180) * 9.2, -7.5 + Math.sin((a * Math.PI) / 180) * 9.2]);
    p.stroke(arc, 0.9, 0.9, { mat: m.black, z: -2.5 });
  }
  if (side) {
    // The painted side: rolled edges, the stripes, the door's shut lines, the vent louvres.
    const hw = lineW(d);
    p.body(
      map(CAB_SIDE),
      2.2 * Math.max(0.4, k),
      { mat: m.white, z: -2, part: c.newPart(), tone: dark },
      (x, y) => {
        const u = U(x);
        // The cab's side panel bulges a little under the window line.
        return y > -40 && y < -20 ? 0.3 * Math.sin(((y + 40) / 20) * Math.PI) * (u > 50 ? 1 : 0) : 0;
      },
      (x, y) => inArch(U(x), y) || inPoly(U(x), y, CAB_WIN),
      (t, x, y) => {
        const u = U(x);
        if (y > -30.6 && y < -27) t.mat = m.orange;
        else if (y > -26 && y < -25) t.mat = m.red;
        // Door shut lines: the front of the door at u 64.5, its bottom at −15.
        if (Math.abs(u - 64.5) < hw / Math.max(0.3, k) && y > -53.5 && y < -15) t.tone -= 0.8;
        if (Math.abs(y + 15) < hw && u > 64.5 && u < 90) t.tone -= 0.8;
        if (Math.abs(y + 53.5) < hw && u > 64.5 && u < 87.6) t.tone -= 0.6;
        // Vent louvres behind the door.
        if (u > 52 && u < 60 && y > -50 && y < -44 && frac((y + 50) / 1.5) < 0.4) t.tone -= 0.45;
        // A horizon in the gloss of the door, sky above, road below.
        if (u > 65 && u < 89 && y > -38 && y < -16) t.tone += y < -24 + Math.sin(u * 0.2) * 0.3 ? 0.08 : -0.18;
        // A crease along the roof fairing.
        if (y < -61.4 && y > -62.4) t.tone += 0.2;
      },
    );
    // The door glass with the driver behind it (a dark head and shoulders) and two sky glints.
    const win = map(CAB_WIN);
    p.field(X(66), -53, X(89) - X(66) + 1, 13, (x, y) => (inPoly(x, y, win) ? (y + 53) * 0.12 : NaN), { mat: m.glass, z: 1.05, tone: dark }, (t, x, y) => {
      const u = U(x);
      if (s >= 2) {
        // Broken out: the dark cab inside, jagged shards at the frame.
        t.tone -= 0.9;
        if (hash2(Math.floor(u * 2), Math.floor(y * 2)) < 0.08) t.tone += 1.1;
        return;
      }
      const hx = u - 78;
      const hy = y + 45.2;
      if ((hx * hx) / 5 + (hy * hy) / 9 < 1 || (y > -42.6 && Math.abs(hx + 0.4) < 4.4)) t.tone -= 0.6;
      const g = frac((u + (y + 41) * 0.7) / 12);
      if (g < 0.1) t.tone += 0.9;
      else if (g > 0.16 && g < 0.2) t.tone += 0.5;
      // A crack star (state 1).
      if (s === 1) {
        const cx = u - 82;
        const cy = y + 46;
        const a = Math.atan2(cy, cx);
        const r = Math.hypot(cx, cy);
        if (r < 4.5 && frac((a / (Math.PI * 2)) * 7) < 0.12 / Math.max(0.6, r)) t.tone += 1.2;
      }
    });
    // The window seal under the glass.
    p.box(X(66.4), -41.4, (88.6 - 66.4) * k, 0.9, { mat: m.black, z: 1.1 });
    // The grab handle, the door handle, the step below the door.
    p.capsule(X(63.4), -45.5, X(63.4), -23, 0.5, 0.5, { mat: m.chrome, z: 2.2 });
    p.box(X(66), -36.4, 3 * k, d === 1 ? 1 : 0.8, { mat: m.black, z: 1.6, r: 0.3 });
    p.box(X(61.5), -11.4, 9 * k, 1.4, { mat: m.plastic, z: 1.6, r: 0.3 });
    p.box(X(62), -12.5, 1 * k, 2.2, { mat: m.black, z: 1.4 });
    p.box(X(69.6), -12.5, 1 * k, 2.2, { mat: m.black, z: 1.4 });
    // The amber side marker (the indicator's lens), small marker lights along the skirt.
    p.box(X(85), -22, 2 * k, 1.4, { mat: m.amber, z: 1.8, r: 0.3, bevel: 0.4 });
    for (const mx of [56, 66]) p.box(X(mx), -15.2, 1.2 * k, 0.9, { mat: m.amber, z: 1.7, r: 0.2 });
    // The front bumper, the headlight at the corner, the sun visor, the mirror on its arm.
    p.box(X(84), -17, 9 * k, 8.5, { mat: m.plastic, z: 2, r: 1.2, bevel: 0.7 });
    p.box(X(90.2), -23, 2.2 * k, 4.5, { mat: m.head, z: 2.1, r: 0.5, bevel: 0.5 });
    p.box(X(85.5), -60.6, 5.1 * k, 2, { mat: m.black, z: 2.2, r: 0.4 });
    if (yaw === 0) {
      const hang = s >= 2 ? 3 : 0;
      p.stroke([[88.4, -50], [93.4, -50.4], [93.6, -48 + hang]], 0.45, 0.45, { mat: m.black, z: 2.4 });
      p.box(92.2, -53.5 + hang, 3.4, 12.5, { mat: m.black, z: 2.6, r: 0.8, bevel: 0.6 });
      p.box(93.6, -52.6 + hang, 1.4, 10.6, { mat: m.glass, z: 2.8, r: 0.3 });
      // Two air horns on the roof (they blow on its arrival and before a weave).
      p.capsule(69.6, -65.4, 78, -66.4, 0.6, 1.3, { mat: m.chrome, z: 2.3 });
      p.capsule(72, -64.6, 81.4, -65.4, 0.6, 1.2, { mat: m.chrome, z: 2.2 });
    }
    if (s >= 1) {
      holes(p, X(52), -56, 36 * k, 36, s >= 2 ? 16 : 7, 31 + s, (x, y) => inPoly(U(x), y, CAB_SIDE) && !inPoly(U(x), y, CAB_WIN) && !inArch(U(x), y));
      p.shade(X(50), -40, 40 * k, 24, (x, y) => {
        const u = U(x);
        const a = Math.hypot((u - 74) / 6, (y + 22) / 3);
        const b = Math.hypot((u - 58) / 4, (y + 34) / 4);
        return (a < 1 ? -0.5 * (1 - a) : 0) + (b < 1 ? -0.45 * (1 - b) : 0);
      });
    }
    if (s >= 2) soot(p, X(48), -66, 46 * k, 40, X(84), -52, 18 * Math.max(0.5, k), 0.7);
  }
  if (yaw > 0) {
    // The front face: CAB_W wide, from the near corner (left on screen) to the far one.
    const F = (w: number): number => X(92) + w * sn;
    const face: Pt[] = [[F(0), -58], [F(1.5), -60.5], [F(CAB_W - 1.5), -60.5], [F(CAB_W), -58], [F(CAB_W), -12], [F(0), -12]];
    p.body(face, 1.6, { mat: m.white, z: -2, part: c.newPart(), tone: 0.05 }, undefined, undefined, (t, _x, y) => {
      if (y > -39 && y < -37) t.mat = m.orange;
    });
    // The windscreen (smashed: a web of cracks), the visor over it.
    const W0 = F(3);
    const W1 = F(CAB_W - 3);
    p.field(W0 - 0.5, -57, W1 - W0 + 1, 18, (x, y) => (x >= W0 && x <= W1 && y > -56.4 && y < -40 ? 0.15 + (y + 56) * 0.01 : NaN), { mat: m.glass, z: 1.2, tone: -0.15 }, (t, x, y) => {
      const w = (x - X(92)) / Math.max(0.05, sn);
      const cx = w - CAB_W * 0.36;
      const cy = y + 48;
      const a = Math.atan2(cy, cx);
      const r = Math.hypot(cx, cy);
      const lw = (d === 1 ? 0.5 : 0.3) / Math.max(1, r);
      if (r < 12 && (Math.abs(frac((a / (Math.PI * 2)) * 7 + r * 0.02) - 0.5) < lw * 1.6 || Math.abs(r - 4) < (d === 1 ? 0.5 : 0.3))) t.tone += 1.1;
      else if (frac((w + (y + 40) * 0.7) / 14) < 0.08) t.tone += 0.6;
    });
    p.box(F(2), -60, (CAB_W - 4) * sn, 2.8, { mat: m.black, z: 1.4, r: 0.4 });
    // The grille: a black frame with chrome slats; the headlights in the lower corners.
    p.box(F(9), -35.5, 28 * sn, 12.5, { mat: m.black, z: 1.4, r: 0.8, bevel: 0.5 });
    for (let gy = -33.6; gy < -24; gy += 2.4) p.box(F(10), gy, 26 * sn, d === 1 ? 1 : 0.8, { mat: m.chrome, z: 1.6, r: 0.2 });
    for (const w0 of [2, CAB_W - 9]) {
      p.box(F(w0), -24.4, 7 * sn, 5, { mat: m.black, z: 1.45, r: 0.6 });
      p.box(F(w0 + 0.6), -23.8, 5.8 * sn, 3.8, { mat: m.head, z: 1.5, r: 0.5, bevel: 0.5 });
    }
    // The bumper with the made-up plate.
    p.box(F(0), -18, CAB_W * sn, 7, { mat: m.plastic, z: 1.6, r: 1, bevel: 0.6 });
    p.box(F(12), -16.6, 22 * sn, 4.4, { mat: m.plate, z: 1.8, r: 0.4 });
    if (sn > 0.85) {
      const ink = bot('black', d, 0);
      const cx = F(23);
      p.paint(cx - 12, -16.6, 24, 4.4, (x, y) => (glyphHitC(PLATE, cx, -14.4, d === 1 ? 0.8 : 0.72, 1, x, y) ? ink : 0));
    }
    soot(p, F(0), -62, CAB_W * sn, 30, F(CAB_W * 0.5), -50, 20 * sn, 0.5);
    // The wheels under it: the near front wheel and the far one, seen at an angle.
    for (const [wx, wk] of [[X(80.5), Math.max(0.3, k)], [F(CAB_W - 7), Math.max(0.3, k)], [X(53.5), Math.max(0.3, k)]] as const) {
      p.ellipsoid(wx, -7.5, 7.5 * wk, 7.5, { mat: m.tyre, z: 0.8, round: 0.6 });
      p.ellipsoid(wx, -7.5, 4 * wk, 4, { mat: m.steel, z: 0.9, round: 0.4 });
    }
  }
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// The trailer (chassis, bogie guard, landing legs, rear bar) and the wheels' blown state
// ---------------------------------------------------------------------------------------------

export function trailerFrame(d: Dn): Frame {
  const p = new Pen(-96, -24, 148, 25, d);
  const c = p.c;
  const m = lorryMats(c);
  // The main beams and the crossmembers' ends.
  p.box(-90, -20.4, 136, 5, { mat: m.black, z: 0.6, r: 0.5, bevel: 0.6 });
  if (d > 1) for (let x = -84; x < 44; x += 12) p.box(x, -18.6, 0.9, 1.4, { mat: m.steel, z: 0.9, r: 0.2 });
  // The bogie: a black valance over the three wheels, the arches' tops.
  p.box(-87, -16.4, 50, 2.6, { mat: m.black, z: 0.7, r: 0.4 });
  // The side underrun guard: two steel rails on three uprights.
  for (const gy of [-13.2, -9.2]) p.box(-36, gy, 48, d === 1 ? 1 : 1.1, { mat: m.steel, z: 1.4, r: 0.3, bevel: 0.4 });
  for (const gx of [-35, -13, 9]) p.box(gx, -15.6, d === 1 ? 1 : 1.1, 7.6, { mat: m.steel, z: 1.3, r: 0.2 });
  // An air tank under the beam.
  p.capsule(-20, -12.6, -3, -12.6, 2, 2, { mat: m.steel, z: 0.9 });
  // The landing legs with their feet and the crank.
  p.box(13, -15.6, 3, 11, { mat: m.steel, z: 1, r: 0.4, bevel: 0.5 });
  p.box(11.6, -4.8, 6, 1.6, { mat: m.black, z: 1.1, r: 0.3 });
  p.stroke([[16.4, -12], [18.6, -12], [18.6, -10]], 0.45, 0.45, { mat: m.black, z: 1.2 });
  // The rear: the lamp bar with the tail lamps, the striped underrun bar, the mud flap.
  p.box(-92, -18.6, 4, 5.4, { mat: m.black, z: 1.2, r: 0.4 });
  p.box(-92.2, -17.8, 1.6, 1.8, { mat: m.tail, z: 1.5, r: 0.3, bevel: 0.4 });
  p.box(-92.2, -15.6, 1.6, 1.2, { mat: m.amber, z: 1.5, r: 0.2 });
  const white = mat(c, 'snow', { spec: 0.4, lo1: 2, hi1: 3, lo: 3, hi: 5 });
  p.box(-92.4, -11.2, 6, 3, {
    mat: m.red,
    z: 1.6,
    r: 0.4,
    bevel: 0.4,
    tex: (t) => {
      if (frac((t.x + p.x0 + (t.y + p.y0)) / 3) < 0.5) t.mat = white;
    },
  });
  p.box(-88.4, -14.8, 2, 12.4, { mat: m.plastic, z: 0.9, r: 0.3 });
  return p.frame(finishA(c, 0.3));
}

/** A blown tyre: the steel rim with shreds of rubber (centre anchor), turned `f` / 4 of 90°. */
export function rimFrame(f: number, d: Dn): Frame {
  const R = 8;
  const p = new Pen(-R - 1, -R - 1, R * 2 + 2, R * 2 + 2, d);
  const c = p.c;
  const m = lorryMats(c);
  const a0 = (f / 4) * (Math.PI / 2);
  // Shreds: jagged black flaps at a few angles round the rim.
  for (let i = 0; i < 5; i++) {
    const a = a0 + (i / 5) * Math.PI * 2 + hash2(i, 3) * 0.6;
    const r0 = RIM_R - 0.6;
    const r1 = RIM_R + 0.6 + hash2(i, 9) * 1.4;
    p.capsule(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a + 0.35) * r1, Math.sin(a + 0.35) * r1, 0.9, 0.5, { mat: m.tyre, z: 0.6 });
  }
  p.ellipsoid(0, 0, RIM_R - 0.2, RIM_R - 0.2, {
    mat: m.steel,
    z: 1,
    round: 0.4,
    tex: (t) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      const r = Math.hypot(x, y);
      if (r > RIM_R - 1.3) t.tone += 0.25;
      else if (r < 1.6) t.tone -= 0.3;
      else if (r > 2.4 && r < 3.6) {
        const a = Math.atan2(y, x) - a0;
        if (frac((a / (Math.PI * 2)) * 8) < 0.3) t.tone -= 0.9;
      }
    },
  });
  return p.frame(finishA(c, 0.2));
}

// ---------------------------------------------------------------------------------------------
// The container, the open hold, the dropping side panel, the rear door
// ---------------------------------------------------------------------------------------------

const C = LORRY.container;
/** The side wall between the posts and the rails. */
const WALL = { x0: C.x0 + 2.5, x1: C.x1 - 2.5, top: C.top + 2, bottom: C.bottom - 2 } as const;

/** Trapezoid corrugation (0 … 1) along x, period 5 px. */
function corr(x: number): number {
  const u = frac((x - C.x0) / 5);
  return u < 0.18 ? u / 0.18 : u < 0.5 ? 1 : u < 0.68 ? 1 - (u - 0.5) / 0.18 : 0;
}

/**
 * The container's line name in our own wide block letters (5 × 5 bits: the sign face's 3-bit W
 * reads as an H at this size).
 */
const WIDE: Readonly<Record<string, readonly string[]>> = {
  Z: ['11111', '00010', '00100', '01000', '11111'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  A: ['01110', '10001', '11111', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001'],
};

/** Logical width of `text` in the wide face (bits of `s` px, one bit between letters). */
function wideWidth(text: string, s: number): number {
  return (text.length * 6 - 1) * s;
}

/** Is (px, py) on a bit of `text` in the wide face set from its top-left (x, y)? */
function wideHit(text: string, x: number, y: number, s: number, px: number, py: number): boolean {
  const u = (px - x) / s;
  const v = (py - y) / s;
  if (u < 0 || v < 0 || v >= 5) return false;
  const i = Math.floor(u / 6);
  const cu = Math.floor(u - i * 6);
  if (i >= text.length || cu >= 5) return false;
  const rows = WIDE[text[i]];
  return rows !== undefined && rows[Math.floor(v)][cu] === '1';
}


/**
 * The container's side wall drawn onto `p` as a face of height `h` (≤ the full 40) standing on
 * its bottom rail at `base`: corrugated rust paint, the line name and mark, the box code, rust
 * streaks, damage (s 1: dents and holes; s 2: more, scorch). `tone` darkens a face turned away.
 */
function wallFace(p: Pen, m: LorryMats, s: number, base: number, h: number, tone: number, part: number, xa: number = WALL.x0, xb: number = WALL.x1): void {
  const full = WALL.bottom - WALL.top;
  const k = h / full;
  // Local wall coordinate v (0 at the top … full at the bottom) of a canvas y.
  const V = (y: number): number => (y - (base - h)) / Math.max(0.05, k);
  const d = p.d;
  p.field(
    xa,
    base - h,
    xb - xa,
    h,
    (x, y) => {
      const v = V(y);
      if (v < 0 || v > full) return NaN;
      return 0.55 * corr(x) * Math.max(0.3, k);
    },
    { mat: m.rust, z: 1, part, tone },
    (t, x, y) => {
      const v = V(y);
      // Rust streaks running down from the top rail (deterministic).
      const col = Math.floor(x / 2.5);
      const run = hash2(col, 17) * 18;
      if (hash2(col, 5) < 0.22 && v < run) t.tone -= 0.25 * (1 - v / Math.max(1, run));
      // A paler sun-bleached band along the top.
      if (v < 3) t.tone += 0.12;
    },
  );
  const ink = top('snow', d, d === 1 ? 0 : 1);
  const y0 = base - h;
  // The line name in big letters and its swan mark (squashed with the face).
  const sz = 2.2;
  const nameW = wideWidth(LINE_NAME, sz);
  const nx = -53 - nameW / 2;
  const ny = 14;
  p.paint(xa, y0, xb - xa, h, (x, y) => {
    const v = V(y);
    if (wideHit(LINE_NAME, nx, ny, sz, x, v)) return d === 4 && hash2(Math.floor(x * 4), Math.floor(v * 4)) < 0.05 ? 0 : ink;
    // The box code, small, top right.
    if (glyphHit(BOX_CODE, -8, 4, 1, 1, x, v)) return ink;
    return 0;
  }, 2);
  if (s >= 1) {
    holes(p, xa, y0, xb - xa, h, s >= 2 ? 30 : 12, 51 + s, (_x, y) => V(y) > 1 && V(y) < full - 1);
    p.shade(xa, y0, xb - xa, h, (x, y) => {
      const v = V(y);
      const a = Math.hypot((x + 50) / 7, (v - 26) / 5);
      const b = Math.hypot((x - 18) / 6, (v - 12) / 4);
      return (a < 1 ? -0.55 * (1 - a) : 0) + (b < 1 ? -0.45 * (1 - b) : 0);
    }, part);
  }
  if (s >= 2) {
    soot(p, xa, y0, xb - xa, h, -70, y0 + h * 0.4, 22, 0.7);
    soot(p, xa, y0, xb - xa, h, 30, y0 + h * 0.2, 16, 0.6);
  }
}

/** The frame (rails, posts, corner castings) round the side wall. */
function wallFrame(p: Pen, m: LorryMats, s: number, open: boolean): void {
  const part = p.c.newPart();
  const rail = (y: number, h: number): void => p.box(C.x0, y, C.x1 - C.x0, h, { mat: m.rust, z: 1.6, r: 0.4, bevel: 0.6, part });
  rail(C.top, 2.2);
  rail(C.bottom - 2.2, 2.2);
  for (const x of [C.x0, C.x1 - 2.6]) p.box(x, C.top, 2.6, C.bottom - C.top, { mat: m.rust, z: 1.7, r: 0.4, bevel: 0.6, part });
  // Corner castings: darker blocks with an oval hole.
  const ink = bot('black', p.d, 0);
  for (const x of [C.x0, C.x1 - 3]) {
    for (const y of [C.top, C.bottom - 3]) {
      p.box(x, y, 3, 3, { mat: m.rustIn, z: 1.9, r: 0.3, bevel: 0.4 });
      p.paint(x, y, 3, 3, (px, py) => (Math.hypot((px - x - 1.5) / 0.9, (py - y - 1.5) / 0.55) < 1 ? ink : 0), 3);
    }
  }
  if (open) {
    // Lashing rings along the floor edge and the floor's front lip (wood) of the open hold.
    p.box(WALL.x0, C.bottom - 3.4, WALL.x1 - WALL.x0, 1.4, { mat: m.wood, z: 1.5, r: 0.2 });
  }
  if (s >= 2) {
    // The top rail torn at the rear corner.
    p.erase(C.x0 - 1, C.top - 1, 14, 6, (x, y) => !(y < C.top + 4 - (x - C.x0) * 0.35 && x > C.x0 + 3));
  }
}

/** The container with its side panel closed, by the boss's damage state. */
export function containerFrame(s: number, d: Dn): Frame {
  const p = new Pen(-92, -66, 136, 47, d);
  const m = lorryMats(p.c);
  wallFace(p, m, s, WALL.bottom, WALL.bottom - WALL.top, 0, p.c.newPart());
  wallFrame(p, m, s, false);
  return p.frame(finishA(p.c, 0.3));
}

/** The container with its near side panel gone: the dark hold (far wall, floor, a stack of cargo at the rear). */
export function holdFrame(s: number, d: Dn): Frame {
  const p = new Pen(-92, -66, 136, 47, d);
  const c = p.c;
  const m = lorryMats(c);
  const [b0, b1] = LORRY.bay;
  // The far wall inside: dark corrugation, lit from the opening (lighter low, dark under the roof).
  p.field(b0, WALL.top, b1 - b0, WALL.bottom - WALL.top, (x) => 0.2 * corr(x), { mat: m.rustIn, z: 0.2 }, (t, _x, y) => {
    t.tone += Math.round(((y - WALL.top) / (WALL.bottom - WALL.top)) * 3) * 0.2 - 0.45;
  });
  // The wooden floor seen at its front edge, the roof's underside.
  p.box(b0, WALL.bottom - 2.2, b1 - b0, 2.2, { mat: m.wood, z: 0.6, r: 0.2, tex: (t) => (frac((t.x + p.x0) / 7) < 0.08 ? (t.tone -= 0.6) : 0) });
  p.box(b0, WALL.top, b1 - b0, 2, { mat: m.rustIn, z: 0.4, tone: -0.5 });
  // Cargo still stacked at the bay's rear end: drums and a crate (the loader's stock).
  const drum = mat(c, 'sky', { spec: 0.7, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  for (const [bx, by] of [[b0 + 5, -27.4], [b0 + 13, -27.4], [b0 + 9, -40]] as const) {
    p.box(bx - 3.6, by - 6.2, 7.2, 12.4, { mat: drum, z: 0.8, r: 1.2, bevel: 1, tone: -0.2, tex: (t) => (Math.abs(frac((t.y + p.y0 - by) / 4.2 + 0.5) - 0.5) < 0.08 ? (t.tone += 0.3) : 0) });
  }
  p.box(b0 + 18, -36, 12, 12.8, { mat: m.wood, z: 0.7, r: 0.4, bevel: 0.5, tone: -0.3, tex: (t) => (frac((t.y + p.y0) / 3.2) < 0.15 ? (t.tone -= 0.5) : 0) });
  // The rest of the side wall stands; posts frame the bay.
  wallFace(p, m, s, WALL.bottom, WALL.bottom - WALL.top, 0, c.newPart(), WALL.x0, b0);
  wallFace(p, m, s, WALL.bottom, WALL.bottom - WALL.top, 0, c.newPart(), b1, WALL.x1);
  for (const x of [b0 - 1.6, b1]) p.box(x, WALL.top, 1.6, WALL.bottom - WALL.top, { mat: m.rust, z: 1.65, r: 0.3, bevel: 0.5 });
  wallFrame(p, m, s, true);
  return p.frame(finishA(c, 0.3));
}

/**
 * The near side panel dropping about its bottom edge (the deck): 0 upright (the outer face, as
 * the closed container), 1 tilted toward the camera (the face squashed), 2 nearly flat (an edge),
 * 3 the ramp: it lies from the deck down onto the road, its inner face up.
 */
export function panelFrame(f: number, d: Dn): Frame {
  const p = new Pen(-92, -66, 136, 78, d);
  const c = p.c;
  const m = lorryMats(c);
  const full = WALL.bottom - WALL.top;
  const [b0, b1] = LORRY.bay;
  if (f <= 1) {
    wallFace(p, m, 0, WALL.bottom, f === 0 ? full : full * 0.62, f === 0 ? 0 : -0.2, c.newPart(), b0, b1);
    // The panel's own top and bottom edges.
    const h = f === 0 ? full : full * 0.62;
    p.box(b0, WALL.bottom - h - 1, b1 - b0, 1.4, { mat: m.rust, z: 1.6, r: 0.3, bevel: 0.4 });
  } else if (f === 2) {
    // Nearly flat: its edge and a sliver of the outer face below it.
    p.box(b0, WALL.bottom - 2, b1 - b0, 2.2, { mat: m.rust, z: 1.6, r: 0.4, bevel: 0.5 });
    p.field(b0, WALL.bottom, b1 - b0, 4, (x) => 0.3 * corr(x), { mat: m.rust, z: 1.2, tone: -0.35 });
  } else {
    // The ramp: from the deck edge (y −22) down to its foot on the road (y +9), the inner face up.
    const y0 = WALL.bottom;
    const y1 = 9;
    p.field(b0, y0, b1 - b0, y1 - y0, (x, y) => 0.7 * corr(x) + (y - y0) * 0.02, { mat: m.rust, z: 1.1, tone: 0.1 }, (t, x, y) => {
      // Light falling off toward the foot; lashing points along it.
      t.tone -= ((y - y0) / (y1 - y0)) * 0.35;
      if (Math.abs(frac((x - b0) / 22) - 0.5) < 0.04 && Math.abs(y - (y0 + 6)) < 0.8) t.tone -= 0.8;
    });
    // The lip that rests on the road and the hinge line at the deck.
    p.box(b0, y1 - 1.6, b1 - b0, 1.8, { mat: m.steel, z: 1.4, r: 0.3, bevel: 0.4 });
    p.box(b0, y0 - 0.6, b1 - b0, 1.4, { mat: m.black, z: 1.3, r: 0.3 });
  }
  return p.frame(finishA(c, 0.25));
}

/**
 * The near rear door: 0 shut (only its hinges at the rear post), 1 ajar (a narrow, darker panel
 * behind), 2 open (the outer face behind the container: two locking bars with cam handles, the box
 * code), 3 hanging off one hinge (dented, tilted).
 */
export function doorsFrame(f: number, d: Dn): Frame {
  const D = LORRY.door;
  const p = new Pen(-122, -68, 36, 52, d);
  const c = p.c;
  const m = lorryMats(c);
  const hinge = D.hinge;
  if (f === 0) {
    for (const y of [-58, -44, -30]) p.box(hinge - 2, y, 2, 3, { mat: m.rustIn, z: 1, r: 0.3, bevel: 0.4 });
    return p.frame(finishA(c, 0.25));
  }
  const w = f === 1 ? D.w * 0.62 : D.w;
  const tilt: Turn | null = f === 3 ? { rot: -9, px: hinge, py: D.top + 6 } : null;
  const T = (x: number, y: number): Pt => turnPt(tilt, x, y);
  const x0 = hinge - w;
  const quad: Pt[] = [T(x0, D.top), T(hinge, D.top), T(hinge, D.bottom), T(x0, D.bottom)];
  const tone = f === 1 ? -0.3 : 0.05;
  const inv = tilt ? { rot: 9, px: hinge, py: D.top + 6 } : null;
  const part = c.newPart();
  p.body(quad, 1.2, { mat: m.rust, z: 1, part, tone }, (x, y) => {
    const [u] = turnPt(inv, x, y);
    // Vertical corrugation pressed in the door (squashed when ajar).
    return 0.4 * corr(((u - x0) / w) * D.w + C.x0);
  });
  // The two locking bars with their cam handles and keepers; the box code on the upper half.
  const bars = [0.3, 0.72];
  for (const b of bars) {
    const bx = x0 + w * b;
    const [ax, ay] = T(bx, D.top + 1);
    const [bx2, by2] = T(bx, D.bottom - 1);
    p.capsule(ax, ay, bx2, by2, 0.55, 0.55, { mat: m.steel, z: 1.8 });
    const [hx, hy] = T(bx, -36);
    p.capsule(hx, hy, hx + (f === 1 ? 2.4 : 3.6), hy + 1.2, 0.5, 0.5, { mat: m.steel, z: 2 });
    for (const ky of [D.top + 2, D.bottom - 3]) {
      const [kx, kyy] = T(bx - 1, ky);
      p.box(kx, kyy, 2, 1.4, { mat: m.rustIn, z: 1.9, r: 0.3 });
    }
  }
  if (f >= 2) {
    const ink = top('snow', d, d === 1 ? 0 : 1);
    const [tx, ty] = T(x0 + 2.5, D.top + 5);
    p.paint(x0 - 4, D.top, w + 8, 12, (x, y) => {
      const [u, v] = turnPt(inv, x, y);
      return glyphHit('ZWAU', tx + (u - x) * 0, ty, 1, 1, u, v) ? ink : 0;
    });
  }
  if (f === 3) {
    holes(p, x0, D.top, w, D.bottom - D.top, 9, 77, (x, y) => inPoly(x, y, quad));
    soot(p, x0 - 2, D.top, w + 4, D.bottom - D.top, x0 + w * 0.6, -30, 12, 0.5);
  }
  return p.frame(finishA(c, 0.25));
}

/** A torn-off door tumbling (centre anchor): turned 0 / 45 / 90 / 135°. */
export function doorFallFrame(f: number, d: Dn): Frame {
  const D = LORRY.door;
  const R = 26;
  const p = new Pen(-R, -R, R * 2, R * 2, d);
  const c = p.c;
  const m = lorryMats(c);
  const t: Turn = { rot: f * 45, px: 0, py: 0 };
  const hw = D.w / 2;
  const hh = (D.bottom - D.top) / 2;
  const quad: Pt[] = [turnPt(t, -hw, -hh), turnPt(t, hw, -hh), turnPt(t, hw, hh), turnPt(t, -hw, hh)];
  const inv: Turn = { rot: -f * 45, px: 0, py: 0 };
  p.body(quad, 1.2, { mat: m.rust, z: 1 }, (x, y) => {
    const [u] = turnPt(inv, x, y);
    return 0.4 * corr(u + C.x0 + 100);
  });
  for (const b of [-0.3, 0.3]) {
    const [ax, ay] = turnPt(t, b * D.w, -hh + 1);
    const [bx, by] = turnPt(t, b * D.w, hh - 1);
    p.capsule(ax, ay, bx, by, 0.55, 0.55, { mat: m.steel, z: 1.8 });
  }
  holes(p, -R, -R, R * 2, R * 2, 8, 91, (x, y) => inPoly(x, y, quad));
  return p.frame(finishA(c, 0.25));
}

/**
 * The container falling off onto its side (the death), anchor = the road under its middle: the
 * near face squashes by cos θ while the roof turns toward the camera (θ 25°, 55°, 90°).
 */
export function boxTipFrame(f: number, d: Dn): Frame {
  const L = C.x1 - C.x0;
  const H = C.bottom - C.top;
  const W = 40;
  const th = ([25, 55, 90][f] * Math.PI) / 180;
  const hFace = H * Math.cos(th);
  const hRoof = W * Math.sin(th);
  const p = new Pen(-L / 2 - 2, -(hFace + hRoof) - 3, L + 4, hFace + hRoof + 4, d);
  const c = p.c;
  const m = lorryMats(c);
  const x0 = -L / 2;
  // The near face (with the line name, squashed) at the bottom.
  if (hFace > 1.5) {
    const ink = top('snow', d, d === 1 ? 0 : 1);
    p.field(x0, -hFace, L, hFace, (x) => 0.45 * corr(x - x0 + C.x0) * Math.cos(th), { mat: m.rust, z: 1, tone: -0.25 }, (t, x, y) => {
      const v = ((y + hFace) / hFace) * H;
      if (wideHit(LINE_NAME, 2 - wideWidth(LINE_NAME, 2.4) / 2, 14, 2.4, x, v)) t.fix = ink;
    });
  }
  // The roof: a flat corrugated sheet (ribs across), lit, dented, the two top rails along its edges.
  const r0 = -hFace - hRoof;
  p.field(x0, r0, L, hRoof, (x, y) => 0.25 * Math.sin(((x - x0) / 6) * Math.PI * 2) * Math.sin(th) + roll(Math.min(y - r0, -hFace - y), 1.5) * 0.5, { mat: m.rust, z: 1.2, tone: 0.15 * Math.sin(th) }, (t, x, y) => {
    const a = Math.hypot((x - 20) / 9, (y - (r0 + hRoof * 0.5)) / Math.max(2, hRoof * 0.3));
    if (a < 1) t.tone -= 0.5 * (1 - a);
  });
  p.box(x0, r0 - 0.6, L, 2, { mat: m.rust, z: 1.6, r: 0.4, bevel: 0.5 });
  p.box(x0, -hFace - 1, L, 2, { mat: m.rust, z: 1.6, r: 0.4, bevel: 0.5 });
  for (const x of [x0, x0 + L - 2.6]) p.box(x, r0, 2.6, hFace + hRoof, { mat: m.rust, z: 1.7, r: 0.4, bevel: 0.5 });
  soot(p, x0, r0, L, hFace + hRoof, x0 + 12, r0 + 6, 24, 0.6);
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------------------------

/** The cab's indicator (centre anchor): 0 the dark amber lens, 1 lit with a glow. */
export function blinkFrame(f: number, d: Dn): Frame {
  const p = new Pen(-4, -3, 8, 6, d);
  const c = p.c;
  if (f === 0) {
    p.box(-1, -0.7, 2, 1.4, { mat: mat(c, 'orange', { spec: 0.6, lo1: 0, hi1: 1, lo: 1, hi: 3 }), z: 1, r: 0.3 });
    return p.frame(finishA(c, 0));
  }
  const glow = mat(c, 'gold', { flat: true, lo1: 2, hi1: 3, lo: 4, hi: 7 });
  p.ellipsoid(0, 0, 3, 2, { mat: mat(c, 'orange', { flat: true, lo1: 1, hi1: 3, lo: 3, hi: 6 }), z: 1 });
  p.ellipsoid(0, 0, 1.6, 1.1, { mat: glow, z: 2, tone: 0.5 });
  return p.frame(c.render({ outline: 'none' }));
}

/** The rear light bar lit red (anchor = LORRY.brakeAt): the lamps and a glow behind them. */
export function brakeFrame(d: Dn): Frame {
  const p = new Pen(-3, -4, 6, 8, d);
  const c = p.c;
  p.box(-0.6, -2.6, 2.6, 3.2, { mat: mat(c, 'red', { flat: true, lo1: 1, hi1: 2, lo: 3, hi: 5 }), z: 0.5, r: 0.8 });
  p.box(-0.2, -1.8, 1.6, 1.8, { mat: mat(c, 'red', { flat: true, lo1: 2, hi1: 3, lo: 5, hi: 7 }), z: 1, r: 0.3, tone: 0.5 });
  p.box(-0.2, 0.4, 1.6, 1.2, { mat: mat(c, 'orange', { flat: true, lo1: 2, hi1: 3, lo: 4, hi: 6 }), z: 1, r: 0.2 });
  return p.frame(c.render({ outline: 'none' }));
}

/** The 1× buffer of a frame (tests). */
export function bufOf(f: Frame): PixelBuffer {
  return f.buf;
}

export { frameOf };
