/**
 * The road-works truck (docs/design/ring.md §5.5): ONE density-generic drawer per strip (`PAL` at
 * 1×, `PAL_HD` at 2× and 4×; the stag kit's `mat` / `finishA`), outline A (it moves and is hit).
 * No maker badge, no lettering.
 *
 * - `ring/roadworks/truck` (5, feet anchor at the truck's middle): a cab-over truck in road-works
 *   orange with a white-red reflective band, the driver behind the door glass, an amber beacon bar,
 *   a black chassis, the flatbed's steel headboard and two stacks of cones on the deck behind the
 *   cab, the wheels (the hubs turn a sixth of a turn per frame pair). Frames: 0 / 1 clean (beacon
 *   left / right lit, hub phase), 2 / 3 battered (dents, a cracked window, a sooty patch), 4 the
 *   wreck (soot all over, the glass gone, the beacons dark, the front tyre flat).
 * - `ring/roadworks/side` (3): the near drop side of the flatbed, drawn IN FRONT of the crew (a
 *   `RingLayer`): orange boards with steel ribs and hinges, red-white chevrons on the tail end and
 *   the rear light. Frames: clean, battered, wreck.
 */
import type { Frame } from '../../../../engine/render';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { finishA, mat, type Dn } from '../../stag/kit.art';
import { TRUCK } from './geometry';

type Pt = [number, number];

const frac = (v: number): number => v - Math.floor(v);

function frameOf(buf: Frame['buf'], ox: number, oy: number, d: Dn): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

/** A rolled edge: height over distance e from an edge with roll radius r. */
function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/** Canvas of the truck's frames (local x −45 … 45, y −41 … 1). */
const W = 90;
const H = 42;
const AX = 45;
const AY = 41;

/** Damage state of a frame: 0 clean, 1 battered, 2 wreck. */
type Dmg = 0 | 1 | 2;

/** The cab outline (cab-over: a flat upright front, a rounded roof edge). */
const CAB: Pt[] = [[12, -5], [12, -33.2], [13.6, -34.6], [37.6, -34.6], [40.2, -33.4], [41.6, -21], [42.6, -19.6], [42.8, -6.6], [41.4, -4.4], [13, -4.4]];
/** The door window (its front edge leans with the windscreen). */
const WIN: Pt[] = [[27.4, -21.6], [27.4, -31.8], [37.4, -31.8], [39.6, -21.6]];
/** Dents of the battered state: centre and radius. */
const DENTS: ReadonlyArray<readonly [number, number, number]> = [[18.5, -12.5, 2.2], [33.5, -10.5, 1.8], [22, -27, 1.6]];

/**
 * The truck's body (everything behind the crew): `beacon` 0 / 1 = which beacon is lit and the hub
 * phase; `dmg` the damage state.
 */
export function truckFrame(beacon: number, dmg: Dmg, d: Dn): Frame {
  const c = new HdCanvas(W, H, d);
  const wreck = dmg === 2;
  const orange = mat(c, 'orange', { spec: 0.8, shine: 36, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.3 });
  const white = mat(c, 'snow', { spec: 0.6, shine: 30, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const red = mat(c, 'red', { spec: 0.5, shine: 30, lo1: 1, hi1: 2, lo: 3, hi: 6 });
  const glass = mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 });
  const black = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const plastic = mat(c, 'slate', { spec: 0.25, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const steel = mat(c, 'steel', { spec: 1.1, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const tyre = mat(c, 'black', { spec: 0.35, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const lampOn = mat(c, 'gold', { flat: true, lo1: 3, hi1: 3, lo: 6, hi: 7 });
  const lampOff = mat(c, 'orange', { spec: 0.6, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const head = mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const coneM = mat(c, 'orange', { spec: 0.5, shine: 22, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const coneBand = mat(c, 'snow', { spec: 1.1, shine: 50, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const X = (x: number): number => x + AX;
  const Y = (y: number): number => y + AY;
  /** Soot of the wreck (and a sooty patch on the battered tail). */
  const soot = (t: { x: number; y: number; tone: number }): void => {
    const lx = t.x - AX;
    const ly = t.y - AY;
    if (wreck) t.tone -= 0.45 + 0.2 * frac(Math.sin(lx * 1.7 + ly * 2.3) * 43758.5);
    else if (dmg === 1) {
      for (const [dx, dy, r] of DENTS) {
        const q = Math.hypot(lx - dx, ly - dy);
        if (q < r) t.tone -= 0.35 * (1 - q / r) + 0.1;
      }
    }
  };
  const field = (x0: number, y0: number, w: number, h: number, hf: (x: number, y: number) => number, o: { mat: number; z: number; tex?: (t: { x: number; y: number; tone: number; mat: number }) => void }): void => {
    c.heightField(X(x0), Y(y0), w, h, (cx, cy) => hf(cx - AX, cy - AY), {
      mat: o.mat,
      z: o.z,
      tex: (t) => {
        const lx = t.x;
        const ly = t.y;
        t.x = lx - AX;
        t.y = ly - AY;
        o.tex?.(t);
        t.x = lx;
        t.y = ly;
        soot(t);
      },
    });
  };
  const wr = TRUCK.wheelR;
  const wheels = TRUCK.wheelX;
  const nearWheel = (x: number, y: number): number => Math.min(...wheels.map((wx) => Math.hypot(x - wx, y + wr)));

  // The flatbed's frame under the deck and the chassis rail (black), the mudguards.
  c.box(X(-43), Y(-14.5), 56, 3.2, { mat: black, z: 1.2, r: 0.4 });
  c.box(X(-38), Y(-7.6), 78, 2.8, { mat: black, z: 1.4, r: 0.3 });
  c.box(X(-34.4), Y(-13.6), 15, 2.2, { mat: black, z: 3.2, r: 0.8, bevel: 0.5 });
  // The headboard: a steel frame with bars behind the cab (the crew's back rail).
  c.box(X(9.4), Y(-31), 2.4, 17.5, { mat: steel, z: 1.6, r: 0.4 });
  c.box(X(-42.8), Y(-27.4), 2, 13, { mat: steel, z: 1.6, r: 0.4 });
  for (const yy of [-31, -24.6]) c.box(X(-1), Y(yy), 12.6, 1.2, { mat: steel, z: 1.7, r: 0.3 });
  // Two stacks of cones on the deck behind the cab (a nested stack: the bands repeat).
  for (const [sx, n] of [[0.5, 4], [6.4, 3]] as const) {
    const h = 9 + n * 1.6;
    const foot = -14;
    c.poly([[X(sx - 3.2), Y(foot)], [X(sx + 3.2), Y(foot)], [X(sx + 0.9), Y(foot - h)], [X(sx - 0.9), Y(foot - h)]], {
      mat: coneM,
      z: 1.8 + (sx > 3 ? 0.2 : 0),
      tex: (t) => {
        const v = Y(foot) - t.y;
        const k = (v - 2.2) % 2.6;
        if (v > 2 && v < h - 1.6 && k > 0 && k < 0.9) t.mat = coneBand;
        if (wreck) t.tone -= 0.45;
      },
    });
  }
  // The cab: a rolled volume with the window hole; the door seam; the reflective band low down.
  field(11, -36, 33, 32, (x, y) => {
    if (!inPoly(x, y, CAB) || inPoly(x, y, WIN) || nearWheel(x, y) < wr + 1.1) return NaN;
    let h = roll(Math.min(polyDist(x, y, CAB), nearWheel(x, y) - wr - 1.1 + 0.4), 2.2);
    if (y > -8) h -= (y + 8) * 0.4;
    return h;
  }, {
    mat: orange,
    z: 2,
    tex: (t) => {
      if (Math.abs(t.x - 26.4) < (d === 1 ? 0.5 : 0.22) && t.y > -33 && t.y < -6) t.tone -= 0.7;
      if (t.y > -15.4 && t.y < -12.8 && t.x > 13 && t.x < 41.6) t.mat = frac((t.x + t.y) / 3.4) < 0.5 ? red : white;
      // The door handle and the step below the door.
      if (t.x > 28 && t.x < 30.4 && t.y > -19.4 && t.y < -18.4) t.tone -= 0.6;
    },
  });
  // The door glass with the driver's head and shoulder behind it (a cracked or a broken window).
  field(27, -32.2, 13, 11, (x, y) => (inPoly(x, y, WIN) ? (y + 32) * 0.12 : NaN), {
    mat: glass,
    z: 2.1,
    tex: (t) => {
      const hx = t.x - 33.2;
      const hy = t.y + 26.4;
      if (!wreck && (hx * hx / 4.2 + hy * hy / 6 < 1 || (t.y > -23.6 && Math.abs(hx + 0.4) < 3.8))) t.tone -= 0.6;
      if (frac((t.x + (t.y + 21) * 0.7) / 10) < 0.12) t.tone += 0.9;
      if (dmg === 1 && Math.abs(t.y + 27 - (t.x - 35) * 0.9) < 0.3 && t.x > 33) t.tone += 1.2;
      if (wreck) t.tone -= 1;
    },
  });
  // The window frame's pillar, the mirror on its arm, the headlight, the grille and the bumper.
  c.box(X(27), Y(-32.2), 1.2, 11, { mat: black, z: 3.4, r: 0.3 });
  c.ellipsoid(X(42.6), Y(-27.4), 1.5, 2.2, { mat: black, z: 5 });
  c.capsule(X(41.2), Y(-25.8), X(39.4), Y(-24.4), 0.4, 0.4, { mat: black, z: 4.8 });
  c.box(X(39.8), Y(-11.2), 3, 2.6, { mat: wreck ? plastic : head, z: 4.2, r: 0.5, bevel: 0.4 });
  c.box(X(40.8), Y(-19), 2, 6.6, { mat: plastic, z: 4, r: 0.4 });
  c.box(X(37.6), Y(-7.6), 6, 3.2, { mat: black, z: 4.4, r: 0.6, bevel: 0.4 });
  c.box(X(16), Y(-6.4), 7, 1.6, { mat: steel, z: 3.6, r: 0.3 });
  // The beacon bar on the cab roof.
  c.box(X(15.6), Y(-37.4), 21, 2.6, { mat: black, z: 3, r: 0.6 });
  c.ellipsoid(X(18.4), Y(-38), 2, 1.7, { mat: !wreck && beacon === 0 ? lampOn : lampOff, z: 4 });
  c.ellipsoid(X(33.6), Y(-38), 2, 1.7, { mat: !wreck && beacon === 1 ? lampOn : lampOff, z: 4 });
  c.box(X(24), Y(-37.8), 4, 1.6, { mat: !wreck ? lampOn : lampOff, z: 3.6, r: 0.5 });
  // The wheels: tyre, steel rim with six lug holes (turned per frame), hub; the wreck's front tyre is flat.
  for (const wx of wheels) {
    const flat = wreck && wx > 0;
    const cx = X(wx);
    const cy = Y(-wr + (flat ? 0.9 : 0));
    c.ellipsoid(cx, cy, wr + (flat ? 0.6 : 0), wr - (flat ? 0.9 : 0), { mat: tyre, z: 6, round: 0.45 });
    c.ellipsoid(cx, cy, wr * 0.58, wr * 0.58, {
      mat: steel,
      z: 6 + wr + 1,
      round: 0.5,
      tex: (t) => {
        const a = Math.atan2(t.y - cy, t.x - cx) + beacon * (Math.PI / 6);
        const r = Math.hypot(t.x - cx, t.y - cy);
        if (r > wr * 0.22 && r < wr * 0.46 && frac((a / (Math.PI * 2)) * 6) < 0.4) t.tone -= 0.8;
        if (wreck) t.tone -= 0.4;
      },
    });
  }
  return frameOf(finishA(c, 0.3), AX, AY, d);
}

/** The near drop side of the flatbed (in front of the crew): `dmg` 0 clean, 1 battered, 2 wreck. */
export function sideFrame(dmg: Dmg, d: Dn): Frame {
  const c = new HdCanvas(W, H, d);
  const wreck = dmg === 2;
  const orange = mat(c, 'orange', { spec: 0.7, shine: 30, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const steel = mat(c, 'steel', { spec: 1.1, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const red = mat(c, 'red', { spec: 0.5, shine: 30, lo1: 1, hi1: 2, lo: 3, hi: 6 });
  const white = mat(c, 'snow', { spec: 0.6, shine: 30, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const black = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const lamp = mat(c, 'red', { flat: true, lo1: 2, hi1: 2, lo: 4, hi: 5 });
  const X = (x: number): number => x + AX;
  const Y = (y: number): number => y + AY;
  const x0 = -43.2;
  const x1 = 11.2;
  const y0 = TRUCK.sideTop;
  const y1 = -TRUCK.deck;
  const box: Pt[] = [[x0, y1 + 0.6], [x0, y0 + 0.4], [x0 + 0.6, y0], [x1, y0], [x1, y1 + 0.6]];
  c.heightField(X(x0 - 0.5), Y(y0 - 0.5), x1 - x0 + 1, y1 - y0 + 1.5, (cx, cy) => {
    const x = cx - AX;
    const y = cy - AY;
    if (!inPoly(x, y, box)) return NaN;
    // Two pressed ribs along the board.
    const rib = Math.abs(y - (y0 + 2.3)) < 0.6 || Math.abs(y - (y0 + 4.9)) < 0.6 ? 0.5 : 0;
    return roll(polyDist(x, y, box), 1.1) + rib;
  }, {
    mat: orange,
    z: 8,
    tex: (t) => {
      const x = t.x - AX;
      const y = t.y - AY;
      // Red-white chevrons on the tail end of the board.
      if (x < x0 + 9.4) t.mat = frac((x - Math.abs(y - (y0 + y1) / 2) * 0.9) / 3) < 0.5 ? red : white;
      // The board's seams (three boards) and the hinges.
      if (Math.abs(x + 25) < (d === 1 ? 0.5 : 0.22) || Math.abs(x + 7) < (d === 1 ? 0.5 : 0.22)) t.tone -= 0.6;
      if (dmg === 1 && Math.hypot(x + 14, y + 17) < 2.4) t.tone -= 0.45;
      if (wreck) t.tone -= 0.45 + 0.2 * frac(Math.sin(x * 1.3 + y * 2.9) * 43758.5);
    },
  });
  for (const hx of [-31, -15, 3]) c.box(X(hx), Y(y1 - 1.6), 2.4, 1.6, { mat: steel, z: 9.2, r: 0.3 });
  c.box(X(x0 - 0.4), Y(y1 - 0.2), x1 - x0 + 0.6, 1, { mat: black, z: 9, r: 0.2 });
  // The rear light cluster at the tail (red; dark on the wreck).
  c.box(X(x0 - 0.6), Y(-11.2), 2.2, 2.6, { mat: wreck ? black : lamp, z: 9.4, r: 0.5 });
  return frameOf(finishA(c, 0.3), AX, AY, d);
}
