/**
 * The jam's own art for `rf-a` DE FILE (docs/design/ring.md §R.5; docs/ART_GUIDE.md "UHD art"):
 * ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× / 4×, content/stag/kit.art.ts
 * `mat`). The rest of the jam reuses the drive's art (the civilian cars `ring/car/…`, the wagons
 * `ring/wagon/…`, the gangs' parcel van `ring/parcel-van/…`, the scooters, the ring's road layers).
 *
 * - `ring/foot/verge` (2; anchor top-left, drawn at the feet line y 176 by props.ts): the strip the
 *   heroes stand on: the hard shoulder's asphalt (grain, a worn edge), the gravel edge and the
 *   grass verge below it (painted, no ink). Two variants (a drain grate in frame 1).
 * - `ring/foot/bus` (1; anchor = the road under the middle, facing right): an intercity coach in our
 *   own livery (white, a sky-blue sweep, tinted windows, no operator name, no badge); its roof is
 *   the highest platform of the jam. Wheels: `ring/car/wheel-l` (props.ts).
 * - `ring/foot/police-van` (2: the blue lamps of the light bar alternate; anchor = the road under
 *   the middle, facing right like the queue; never drawn mirrored): a white van with a blue band and our own `POLITIE`
 *   lettering (3 × 5 bits at 1×). Wheels: `ring/car/wheel-m`.
 * - `ring/foot/police-line` (3; feet anchor at the left post): two striped posts with the red and
 *   white tape across the shoulder: taut, fluttering, snapped (the heroes walk through it).
 * - `ring/foot/kbarrier` (1; feet anchor): a concrete road-works barrier block with a red-white
 *   reflector strip (cover: a solid of `KBARRIER` size, layout-rf-a.ts).
 * Outline A for the vehicles, the line and the block (things in the walking plane); the verge is
 * painted without ink.
 */
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { hash2 } from '../../../art/paint';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { glyphHitC } from '../traffic/lettering';

type Pt = readonly [number, number];

function frameOf(buf: Frame['buf'], ox: number, oy: number, d: Dn): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

const frac = (v: number): number => v - Math.floor(v);

// ---------------------------------------------------------------------------------------------
// Sizes shared with the layout (layout-rf-a.ts)
// ---------------------------------------------------------------------------------------------

export const VERGE_W = 128;
export const VERGE_H = 40;
export const BUS = { len: 150, height: 58, wheels: [-48, 40] as readonly number[], wheelR: 7.5 } as const;
export const POLICE_VAN = { len: 92, height: 44, wheels: [-30, 30] as readonly number[], wheelR: 6.5 } as const;
export const KBARRIER = { w: 34, h: 14 } as const;
export const POLICE_LINE_W = 56;

// ---------------------------------------------------------------------------------------------
// The verge strip
// ---------------------------------------------------------------------------------------------

/** Rows (logical, from the feet line): the shoulder asphalt, the worn edge, gravel, the grass. */
const SHOULDER_ROWS = 5;
const GRAVEL_ROWS = 2.5;

export function vergeFrame(v: number, d: Dn): Frame {
  const c = new HdCanvas(VERGE_W, VERGE_H, d);
  const asph = [top('steel', d, d === 1 ? 2 : 5), top('steel', d, d === 1 ? 2 : 4), top('steel', d, d === 1 ? 1 : 3), top('stone', d, d === 1 ? 2 : 4)];
  const gravel = [top('stone', d, d === 1 ? 1 : 2), top('stone', d, d === 1 ? 2 : 3), top('olive', d, d === 1 ? 2 : 4), top('stone', d, d === 1 ? 3 : 5)];
  // Light (sunlit tips) → dark (the roots, the shade under the guard rail).
  const grass = [top('olive', d, d === 1 ? 1 : 3), top('green', d, d === 1 ? 1 : 4), top('olive', d, d === 1 ? 2 : 4), top('green', d, d === 1 ? 2 : 5), top('olive', d, d === 1 ? 2 : 5)];
  const dark = top('olive', d, d === 1 ? 3 : 6);
  const drainX = 70;
  c.paint(0, 0, VERGE_W, VERGE_H, (x, y, X, Y) => {
    const g = hash2(X + v * 977, Y, 0x51d);
    // The drain grate (frame 1): dark slots in a steel frame on the shoulder's edge.
    if (v === 1 && x >= drainX && x < drainX + 10 && y >= 1 && y < 4.5) {
      const edge = x < drainX + 0.6 || x >= drainX + 9.4 || y < 1.6 || y >= 3.9;
      if (edge) return top('steel', d, d === 1 ? 1 : 2);
      return frac((x - drainX) / 1.5) < 0.5 ? top('ink', d, 0) : top('steel', d, d === 1 ? 3 : 5);
    }
    if (y < SHOULDER_ROWS) {
      // Grain: light aggregate and dark pores, a worn lighter band where the wheels never go.
      const k = g < 0.05 ? 2 : g > 0.93 ? 0 : 1;
      if (y > SHOULDER_ROWS - 1.2 && g < 0.3) return asph[3];
      return asph[k];
    }
    if (y < SHOULDER_ROWS + GRAVEL_ROWS) return gravel[Math.floor(g * 4)];
    // Grass: tufts in clusters (blades two art px wide at 4×), darker toward the bottom and in
    // the tufts' roots, a few yellow flowers near the gravel.
    const depth = (y - SHOULDER_ROWS - GRAVEL_ROWS) / (VERGE_H - SHOULDER_ROWS - GRAVEL_ROWS);
    const cx = Math.floor(x * 1.3);
    const tuft = hash2(Math.floor(x / 5), Math.floor(y / 4), 0x7e1 + v);
    const blade = hash2(cx, Math.floor(y / 3), 0x3b + v);
    const shade = 0.6 + depth * 2 + (tuft - 0.5) * 0.9 + (blade < 0.25 ? 0.5 : blade > 0.85 ? -0.4 : 0) + (hash2(X >> 1, Y >> 1, 0x99) - 0.5) * 0.35;
    if (d > 1 && g > 0.992 && depth < 0.35) return top('gold', d, 2);
    if (shade > 2.6) return dark;
    return grass[Math.max(0, Math.min(grass.length - 1, Math.floor(shade + 0.5)))];
  }, 1);
  const buf = c.render({ outline: 'none', ao: 0, clean: false, sep: false });
  return frameOf(buf, 0, 0, d);
}

// ---------------------------------------------------------------------------------------------
// Bodies (a rounded slab over a polygon, lit from above)
// ---------------------------------------------------------------------------------------------

function slab(c: HdCanvas, pts: readonly Pt[], ox: number, oy: number, m: number, z: number, part: number, tex?: Parameters<HdCanvas['heightField']>[5]['tex']): void {
  let xa = Infinity;
  let xb = -Infinity;
  let ya = Infinity;
  let yb = -Infinity;
  for (const [x, y] of pts) {
    xa = Math.min(xa, x);
    xb = Math.max(xb, x);
    ya = Math.min(ya, y);
    yb = Math.max(yb, y);
  }
  const local = pts.map(([x, y]) => [x + ox, y + oy] as const);
  const H = yb - ya;
  c.heightField(xa + ox - 1, ya + oy - 1, xb - xa + 2, yb - ya + 2, (x, y) => {
    if (!inPoly(x, y, local)) return NaN;
    const e = polyDist(x, y, local);
    // A softly bulging side (the tumblehome): rounder near the top, flatter below the belt.
    const v = (y - oy - ya) / H;
    return Math.min(1.6 + (1 - v) * 0.8, e * 0.9) + 0.3;
  }, {
    mat: m,
    z,
    part,
    tex: (t) => {
      // Form: a lit shoulder under the roof line, the side darkening toward the sills, grime low down.
      const v = (t.y - oy - ya) / H;
      t.tone += v < 0.12 ? 0.2 : v > 0.8 ? -0.35 * (v - 0.8) * 5 : (0.45 - v) * 0.25;
      if (v > 0.86 && hash2(Math.floor(t.x * 3), Math.floor(t.y * 3), 0x6d1) > 0.75) t.tone -= 0.25;
      tex?.(t);
    },
  });
}

function wheelArches(c: HdCanvas, xs: readonly number[], r: number, ox: number, oy: number, well: number): void {
  for (const wx of xs) c.ellipsoid(wx + ox, oy - r - 0.5, r + 1.2, r + 1.2, { mat: well, z: 4, round: 0 });
}

// ---------------------------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------------------------

const BUS_PROFILE: readonly Pt[] = [
  [-75, -4], [-75.4, -54], [-73.6, -57.6], [-70, -58], [66, -58], [71, -56.6], [74.2, -52], [75.4, -40], [75.4, -6], [73.6, -3], [-73, -3],
];

export function busFrame(d: Dn): Frame {
  const ox = 77;
  const oy = 60;
  const c = new HdCanvas(154, 62, d);
  const paint = mat(c, 'gable', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3, bounce: 0.3 });
  const sweep = mat(c, 'sky', { spec: 0.9, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const navy = mat(c, 'navy', { spec: 0.8, shine: 36, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const glass = mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 });
  const black = mat(c, 'black', { spec: 0.6, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const well = mat(c, 'black', { spec: 0, amb: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 });
  const head = mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const tail = mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const part = c.newPart();
  slab(c, BUS_PROFILE, ox, oy, paint, 1, part, (t) => {
    const x = t.x - ox;
    const y = t.y - oy;
    // Our own livery: a sky-blue sweep rising from the rear wheel to the front, a navy skirt line.
    const sw = -14 - (x + 75) * 0.12;
    if (y > sw - 4 && y < sw + 2) t.mat = sweep;
    if (y > -9 && y < -7) t.mat = navy;
    // Panel seams and the luggage-hold doors (at 2× / 4×: a fine dark line).
    for (const sx of [-50, -22, 6, 34]) if (y > -18 && y < -8 && Math.abs(x - sx) < (d === 1 ? 0.5 : 0.25)) t.tone -= 0.6;
    if (y > -58 && y < -56.5) t.tone += 0.15;
  });
  // The window band (tinted glass with pillars), the windscreen at the front.
  const wTop = -51;
  const wBot = -34;
  c.box(-70 + ox, wTop + oy, 136, wBot - wTop, {
    mat: glass,
    z: 5,
    r: 0.6,
    round: 0.2,
    tex: (t) => {
      const x = t.x - ox;
      const y = t.y - oy;
      if (frac((x + 70) / 17) < 0.09) t.mat = black;
      // A sky streak in the glass.
      const s = (x + 70) * 0.25 + (y - wTop);
      if (frac(s / 9) < 0.12) t.tone += 0.5;
    },
  });
  c.poly([[66 + ox, wTop + oy], [71 + ox, -50 + oy], [74 + ox, -40 + oy], [74 + ox, wBot + oy], [66 + ox, wBot + oy]], { mat: glass, z: 5.2, round: 0.1 });
  // The door at the front (two glass leaves).
  c.box(52 + ox, -33 + oy, 11, 26, { mat: glass, z: 5.6, r: 0.4, round: 0.1, tex: (t) => (Math.abs(t.x - ox - 57.5) < 0.4 ? void (t.mat = black) : undefined) });
  wheelArches(c, BUS.wheels, BUS.wheelR, ox, oy, well);
  c.box(72.6 + ox, -16 + oy, 2.6, 4, { mat: head, z: 6, r: 0.5 });
  c.box(-75.6 + ox, -22 + oy, 2.2, 7, { mat: tail, z: 6, r: 0.5 });
  // The mirror arm at the front.
  c.capsule(74 + ox, -50 + oy, 77 + ox, -44 + oy, 0.6, 0.6, { mat: black, z: 6 });
  // The bumpers, the destination display (A10, amber).
  const roofKit = mat(c, 'stone', { spec: 0.4, shine: 20, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  c.box(-76 + ox, -9 + oy, 5, 5, { mat: black, z: 5, r: 0.8 });
  c.box(71 + ox, -9 + oy, 5, 5, { mat: black, z: 5, r: 0.8 });
  const amber = top('orange', d, d === 1 ? 0 : 1);
  c.box(62 + ox, -56.5 + oy, 10, 4, { mat: black, z: 4, r: 0.4 });
  c.paint(62 + ox, -56.5 + oy, 10, 4, (x, y) => (d > 1 && glyphHitC('A10', 67 + ox, -54.5 + oy, 0.6, 1, x, y) ? amber : 0), 9);
  // The door's rubber frame and its step.
  c.box(51.4 + ox, -33.6 + oy, 12.2, 27.2, { mat: black, z: 5.4, r: 0.6 });
  c.box(52 + ox, -6 + oy, 11, 1.6, { mat: roofKit, z: 5.8 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, ox, oy, d);
}

// ---------------------------------------------------------------------------------------------
// The police van
// ---------------------------------------------------------------------------------------------

/** The van's side profile (facing right). */
const PV_PROFILE: readonly Pt[] = [
  [-46, -4], [-46.4, -40], [-44.6, -43], [18.6, -43], [23, -41.6], [31.4, -26], [39.4, -23.2], [44.6, -19.8], [46.4, -14], [46, -4], [44, -2.2], [-44, -2.2],
];

export function policeVanFrame(f: number, d: Dn): Frame {
  const ox = 48;
  const oy = 50;
  const c = new HdCanvas(96, 52, d);
  const paint = mat(c, 'gable', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3, bounce: 0.3 });
  const band = mat(c, 'navy', { spec: 0.9, shine: 44, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const stripe = mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const glass = mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 });
  const black = mat(c, 'black', { spec: 0.6, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const well = mat(c, 'black', { spec: 0, amb: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 });
  const lampOn = mat(c, 'sky', { spec: 1, shine: 50, lo1: 2, hi1: 3, lo: 5, hi: 7, flat: true });
  const lampOff = mat(c, 'navy', { spec: 1, shine: 50, lo1: 1, hi1: 2, lo: 2, hi: 4 });
  const part = c.newPart();
  slab(c, PV_PROFILE, ox, oy, paint, 1, part, (t) => {
    const y = t.y - oy;
    const x = t.x - ox;
    if (y > -21 && y < -14) t.mat = band;
    else if (y >= -14 && y < -12.6) t.mat = stripe;
    if (Math.abs(x + 12.4) < (d === 1 ? 0.5 : 0.25) && y > -40 && y < -6) t.tone -= 0.6;
  });
  // The cab glass.
  c.poly([[15 + ox, -25.8 + oy], [15 + ox, -38 + oy], [22.4 + ox, -39.4 + oy], [29.4 + ox, -25.8 + oy]], { mat: glass, z: 5, round: 0.2 });
  // Our own lettering on the band: POLITIE (white).
  const white = top('snow', d, d === 1 ? 0 : 1);
  c.paint(-40 + ox, -21 + oy, 52, 7, (x, y) => (glyphHitC('POLITIE', -14 + ox, -17.5 + oy, 1, 1, x, y) ? white : 0), 9);
  // The light bar on the roof: two blue lamps, alternating.
  c.box(-6 + ox, -46 + oy, 18, 3, { mat: black, z: 2, r: 0.6 });
  c.box(-5 + ox, -47 + oy, 6, 3, { mat: f === 0 ? lampOn : lampOff, z: 3, r: 0.8 });
  c.box(5 + ox, -47 + oy, 6, 3, { mat: f === 1 ? lampOn : lampOff, z: 3, r: 0.8 });
  wheelArches(c, POLICE_VAN.wheels, POLICE_VAN.wheelR, ox, oy, well);
  const buf = finishA(c, 0.3);
  return frameOf(buf, ox, oy, d);
}

// ---------------------------------------------------------------------------------------------
// The police line and the barrier block
// ---------------------------------------------------------------------------------------------

/** The police line: 0 taut, 1 fluttering, 2 snapped (the ends hang from the posts). */
export function policeLineFrame(f: number, d: Dn): Frame {
  const W = POLICE_LINE_W + 4;
  const H = 26;
  const c = new HdCanvas(W, H, d);
  const red = mat(c, 'red', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const white = mat(c, 'snow', { spec: 0.4, shine: 26, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const foot = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const post = (x: number): void => {
    c.box(x - 1, 4, 2.4, H - 7, {
      mat: white,
      z: 2,
      r: 0.6,
      tex: (t) => {
        if (frac((t.y - 4) / 5) < 0.5) t.mat = red;
      },
    });
    c.box(x - 3, H - 3.4, 6.4, 2.6, { mat: foot, z: 2.2, r: 0.8 });
  };
  post(2);
  post(W - 2);
  const tapeY = 7;
  const tape = (x0: number, x1: number, sag: (u: number) => number): void => {
    c.paint(x0, 0, x1 - x0, H - 4, (x, y) => {
      const u = (x - x0) / (x1 - x0);
      const cy = tapeY + sag(u);
      if (Math.abs(y - cy) > 1.1) return 0;
      return frac((x + y * 0.4) / 6) < 0.5 ? top('red', d, d === 1 ? 1 : 2) : top('snow', d, d === 1 ? 0 : 1);
    }, 1);
  };
  if (f === 0) tape(3, W - 3, (u) => Math.sin(u * Math.PI) * 2);
  else if (f === 1) tape(3, W - 3, (u) => Math.sin(u * Math.PI) * 3 + Math.sin(u * Math.PI * 4) * 1.2);
  else {
    // Snapped: each end hangs down from its post.
    c.paint(3, 0, 10, H - 4, (x, y) => (Math.abs(y - (tapeY + (x - 3) * 1.4)) < 1 ? top('red', d, d === 1 ? 1 : 2) : 0), 1);
    c.paint(W - 13, 0, 10, H - 4, (x, y) => (Math.abs(y - (tapeY + (W - 3 - x) * 1.4)) < 1 ? top('snow', d, d === 1 ? 0 : 1) : 0), 1);
  }
  const buf = finishA(c, 0.15);
  return frameOf(buf, 2, H - 1, d);
}

export function kbarrierFrame(d: Dn): Frame {
  const W = KBARRIER.w + 2;
  const H = KBARRIER.h + 2;
  const c = new HdCanvas(W, H, d);
  const conc = mat(c, 'stone', { spec: 0.15, shine: 12, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const red = mat(c, 'red', { spec: 0.8, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const white = mat(c, 'snow', { spec: 0.8, shine: 40, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  // The jersey profile seen from the side: a slab with a chamfered top.
  c.poly([[1, H - 1], [1, 5], [3, 1.5], [W - 3, 1.5], [W - 1, 5], [W - 1, H - 1]], {
    mat: conc,
    z: 1,
    round: 0.3,
    tex: (t) => {
      const g = hash2(Math.floor(t.x * d), Math.floor(t.y * d), 0xc0c);
      if (g > 0.9) t.tone -= 0.35;
      else if (g < 0.06) t.tone += 0.25;
      // A chipped corner and a dark rain streak (wear).
      if (t.x > W - 8 && t.x < W - 7 && t.y > 5) t.tone -= 0.25;
    },
  });
  // The reflector strip (red and white blocks).
  c.box(4, 5, W - 8, 2.4, { mat: white, z: 2, r: 0.3, tex: (t) => (frac(t.x / 6) < 0.5 ? void (t.mat = red) : undefined) });
  const buf = finishA(c, 0.2);
  return frameOf(buf, 1, H - 1, d);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

type Gen = (d: Dn) => Frame[];
const def = (id: string, gen: Gen, o: { ticksPerFrame?: number; loop?: boolean; defer?: boolean } = {}): void => defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d as Dn) });

def('ring/foot/verge', (d) => [vergeFrame(0, d), vergeFrame(1, d)]);
def('ring/foot/bus', (d) => [busFrame(d)]);
def('ring/foot/police-van', (d) => [policeVanFrame(0, d), policeVanFrame(1, d)], { ticksPerFrame: 14 });
def('ring/foot/police-line', (d) => [0, 1, 2].map((f) => policeLineFrame(f, d)), { ticksPerFrame: 8 });
def('ring/foot/kbarrier', (d) => [kbarrierFrame(d)]);

