/**
 * The car transporter's art (`boss/ring-zwaan/autos/`; docs/design/ring.md §R.3; docs/ART_GUIDE.md
 * "UHD art"): ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× / 4×), every frame
 * cropped to its 1× box (`defStrip`), outline A (it moves and can be hit). Our own livery (the
 * rust-red ZWAAN line colour, the swan mark), our own lettering; the cars are civilian-style
 * hatches with no badge and no plate. Nothing mirrors.
 *
 * | id | frames | what |
 * |---|---|---|
 * | `frame-<0\|1\|2>` | 1 | the running gear, the lower deck, the posts, the fixed upper section (by damage) |
 * | `head-<0\|1\|2>` | 1 | the headboard (drawn over the cars): the rust-red front wall, `ZWAAN`, the swan |
 * | `updeck` | 4 | the tilting rear section of the upper deck with its ram: 0°, 5°, 10°, 15° |
 * | `updeck-broken` | 4 | the same with the deck ram snapped (dark hydraulic oil, never red) |
 * | `ramp` | 4 | the rear ramp with its ram: stowed upright, 40°, 80°, on the road |
 * | `ramp-broken` | 1 | the ramp hanging on the road, the ram snapped |
 * | `car-<colour>` | 4 | a hatch (no wheels: the ring's turning `ring/car/wheel-s`), tilted 0°, 8°, 16°, 24° rear-down (anchor: its middle on the road line) |
 * | `lamps` | 2 | the rear lamp lit: brake (red), indicator (amber) |
 */
import type { Frame } from '../../../../engine/render';
import { inPoly, polyDist } from '../../../art/hd';
import { defStrip, frac, hash2, lineW, Pen, roll, turnPt, type Turn } from '../boss/art-kit';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { CAR_GEO } from '../traffic/geometry';
import { drawChassis, lampsFrame, swanHit, w5Hit, w5Width, zwMats, type ZwMats } from './autos-kit';
import { AUTOS, AUTOS_CARS, AUTOS_SPR, CAR_TILTS, CAR_WHEEL_R, CAR_WHEELS, upDeckY } from './autos-geo';

type Pt = readonly [number, number];

// ---------------------------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------------------------

/** Bullet holes and dents (dark dots with a light rim at 2× / 4×) inside `inside`. */
function holes(p: Pen, x: number, y: number, w: number, h: number, n: number, seed: number): void {
  const d = p.d;
  const ink = bot('black', d, 0);
  const rim = top('steel', d, 1);
  for (let i = 0; i < n; i++) {
    const hx = x + hash2(seed, i * 2) * w;
    const hy = y + hash2(seed + 7, i * 2 + 1) * h;
    const r = d === 1 ? 0.5 : 0.55 + hash2(seed, i) * 0.25;
    p.paint(hx - 1.5, hy - 1.5, 3, 3, (px, py) => {
      const dd = Math.hypot(px - hx, py - hy);
      if (dd < r) return ink;
      if (d > 1 && dd < r + 0.3 && px < hx && py < hy) return rim;
      return 0;
    });
  }
}

function soot(p: Pen, x: number, y: number, w: number, h: number, cx: number, cy: number, rad: number, amount: number, part?: number): void {
  p.shade(x, y, w, h, (px, py) => {
    const dd = Math.hypot((px - cx) / rad, (py - cy) / (rad * 0.7));
    return dd < 1 ? -amount * (1 - dd * dd) : 0;
  }, part);
}

/** A steel deck floor (a grating seen edge-on: a beam with a ribbed top) over [x0, x1] at floor y. */
function deckFloor(p: Pen, m: ZwMats, x0: number, x1: number, y: number, t: Turn | null = null): void {
  const pts: Pt[] = [turnPt(t, x0, y), turnPt(t, x1, y), turnPt(t, x1, y + 3), turnPt(t, x0, y + 3)];
  p.body(pts, 0.7, { mat: m.steel, z: 1.2 }, undefined, undefined, (s, x) => {
    // The grating's holes along the beam (a row of dark slots) and the punched pattern.
    const u = frac((x - x0) / 4);
    if (s.y + p.y0 > y + 1 && u > 0.2 && u < 0.6) s.tone -= 0.45;
  });
}

/** A side rail (a thin steel tube) between two points. */
function rail(p: Pen, m: ZwMats, a: Pt, b: Pt, r = 0.7): void {
  p.capsule(a[0], a[1], b[0], b[1], r, r, { mat: m.chrome, z: 2.2 });
}

/** A hydraulic ram from `a` (the cylinder's foot) to `b` (the rod's eye); `broken` snaps the rod. */
function ram(p: Pen, m: ZwMats, a: Pt, b: Pt, broken: boolean): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const k = Math.min(0.62, 11 / Math.max(1, len));
  const mid: Pt = [a[0] + dx * k, a[1] + dy * k];
  // The cylinder (black barrel with a steel collar), then the chrome rod.
  p.capsule(a[0], a[1], mid[0], mid[1], 1.9, 1.9, { mat: m.black, z: 2.6 });
  p.capsule(mid[0] - dx * 0.03, mid[1] - dy * 0.03, mid[0], mid[1], 2.1, 2.1, { mat: m.steel, z: 2.7 });
  if (!broken) {
    p.capsule(mid[0], mid[1], b[0], b[1], 0.9, 0.9, { mat: m.chrome, z: 2.65 });
  } else {
    // The rod is snapped short and bent; dark oil runs from the collar (never red).
    const bx = mid[0] + dx * 0.15 + 1.2;
    const by = mid[1] + dy * 0.15;
    p.capsule(mid[0], mid[1], bx, by, 0.9, 0.8, { mat: m.chrome, z: 2.65 });
    p.capsule(b[0] - dx * 0.12 - 1, b[1] - dy * 0.12, b[0], b[1], 0.8, 0.9, { mat: m.chrome, z: 2.65 });
    const oil = bot('black', p.d, 1);
    const sheen = top('slate', p.d, 1);
    p.paint(mid[0] - 3, mid[1] - 1, 6, 12, (x, y) => {
      const run = Math.abs(x - mid[0] - 0.4 * Math.sin(y)) < 0.6 + (y - mid[1]) * 0.02 && y > mid[1];
      if (!run) return 0;
      return p.d > 1 && frac(y * 0.7) < 0.15 ? sheen : oil;
    }, 3);
  }
  // The eyes and their pins.
  p.ellipsoid(a[0], a[1], 1.4, 1.4, { mat: m.steel, z: 2.8 });
  p.ellipsoid(b[0], b[1], 1.2, 1.2, { mat: m.steel, z: 2.8 });
}

// ---------------------------------------------------------------------------------------------
// The car (a civilian-style hatch; no badge, no plate)
// ---------------------------------------------------------------------------------------------

const G = CAR_GEO.hatch;

/** A hatch in `colour` tilted `tilt`° rear-down about its anchor (its middle on the road line). */
export function carFrame(colour: string, tilt: number, d: Dn): Frame {
  const p = new Pen(-40, -46, 80, 62, d);
  const c = p.c;
  const m = zwMats(c);
  const lo1 = colour === 'gable' ? 1 : 0;
  const paint = mat(c, colour, { spec: 0.95, shine: 48, lo1, hi1: 3, lo: colour === 'gable' ? 2 : 1, hi: 5, rim: 0.3, bounce: 0.3 });
  const T: Turn = { rot: -tilt, px: 0, py: 0 };
  const U: Turn = { rot: tilt, px: 0, py: 0 };
  const tp = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => turnPt(T, x, y));
  // The wheel wells (dark, behind the turning wheels).
  for (const wx of CAR_WHEELS) {
    const [cx, cy] = turnPt(T, wx, -CAR_WHEEL_R - 0.5);
    p.ellipsoid(cx, cy, CAR_WHEEL_R + 0.9, CAR_WHEEL_R + 0.9, { mat: m.well, z: 0.2, round: 0 });
  }
  // The body: the profile rolled at its edges, the arches cut out; a crease along the shoulder.
  const prof = tp(G.profile);
  p.body(
    prof,
    2.4,
    { mat: paint, z: 1 },
    (x, y) => {
      const [, v] = turnPt(U, x, y);
      // The shoulder crease and the sill's tuck-under.
      return (Math.abs(v - (G.belt + 2.6)) < 0.5 ? 0.35 : 0) - (v > G.sill + 1.4 ? (v - G.sill - 1.4) * 0.3 : 0);
    },
    (x, y) => {
      const [u, v] = turnPt(U, x, y);
      for (const wx of CAR_WHEELS) if (Math.hypot(u - wx, v + CAR_WHEEL_R + 0.5) < CAR_WHEEL_R + 1.2 && v > -CAR_WHEEL_R - 4) return true;
      return false;
    },
  );
  // The glass band, its pillars in the body colour, a cool sky reflection band.
  const band = tp(G.band);
  p.poly(band, { mat: m.glass, z: 4 });
  for (const [x0, x1] of G.pillars) {
    p.poly(tp([[x0, G.belt + 0.2], [x1, G.belt + 0.2], [x1, -23.6], [x0, -23.6]]), { mat: paint, z: 4.2 });
  }
  if (d > 1) {
    const hi = top('slate', d, 0);
    p.paint(-40, -46, 80, 62, (x, y) => {
      if (!inPoly(x, y, band)) return 0;
      const [u, v] = turnPt(U, x, y);
      if (G.pillars.some(([a, b]) => u >= a && u <= b)) return 0;
      // A diagonal sky streak across each window.
      return frac((u + v * 1.2) / 15) < 0.12 && polyDist(x, y, band) > 0.6 ? hi : 0;
    }, 6);
  }
  // Door shut lines, the handle, the mirror, the lamps.
  const seam = bot(colour === 'gable' ? 'stone' : colour, d, 0);
  for (const sx of G.seams) {
    const a = turnPt(T, sx, G.belt + 0.4);
    const b = turnPt(T, sx + 0.6, G.sill + 2.2);
    p.paint(Math.min(a[0], b[0]) - 1, Math.min(a[1], b[1]) - 1, Math.abs(b[0] - a[0]) + 2, Math.abs(b[1] - a[1]) + 2, (x, y) => {
      const t = Math.max(0, Math.min(1, (y - a[1]) / (b[1] - a[1])));
      return Math.abs(x - (a[0] + (b[0] - a[0]) * t)) < lineW(d) + 0.05 ? seam : 0;
    }, 5);
  }
  for (const [hx, hy] of G.handles) {
    const [x, y] = turnPt(T, hx, hy);
    p.box(x - 1.2, y - 0.4, 2.4, 0.9, { mat: m.chrome, z: 4.4, r: 0.3 });
  }
  {
    const [x, y] = turnPt(T, G.mirror[0], G.mirror[1]);
    p.ellipsoid(x + 0.6, y - 0.4, 1.5, 1.1, { mat: paint, z: 4.6 });
  }
  const lamp = (b: readonly [number, number, number, number], mt: number): void => {
    p.poly(tp([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]), { mat: mt, z: 4.3 });
  };
  lamp(G.head, mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 3, hi: 6 }));
  lamp(G.tail, m.tail);
  // The black bumper strips and the sill.
  p.poly(tp([[-33.6, -9.6], [-31.4, -9.6], [-31.4, -5.4], [-33.6, -5.4]]), { mat: m.plastic, z: 4.1 });
  p.poly(tp([[31.2, -9.2], [33.6, -9.2], [33.6, -5], [31.2, -5]]), { mat: m.plastic, z: 4.1 });
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// The transporter
// ---------------------------------------------------------------------------------------------

const L = AUTOS.length;
const LOW = AUTOS.lowY;
const UP = AUTOS.upY;

/** The running gear, the lower deck, the posts and the fixed front section of the upper deck. */
export function frameFrame(s: number, d: Dn): Frame {
  const p = new Pen(-4, -60, L + 16, 61, d);
  const c = p.c;
  const m = zwMats(c);
  drawChassis(p, m, { length: L, deck: LOW, wheels: AUTOS.wheels, skirt: [50, 160], skirtH: 6.4, state: s });
  // The lower deck's floor (a grating) and its low near rail.
  deckFloor(p, m, 1, 158, LOW - 1.6);
  // The posts: the rear pivot post, the middle post, the front tower (box section, rust-red).
  const post = (x: number, w: number, y0: number, y1: number): void => {
    p.box(x, y1, w, y0 - y1, { mat: m.rust, z: 1.8, r: 0.5, bevel: 0.6, tex: (t) => (t.y + p.y0 < y1 + 1.2 ? (t.tone += 0.2) : undefined) });
  };
  post(1, 3.4, LOW - 1, UP + 2);
  post(78.4, 3.6, LOW - 1, UP);
  post(152, 5, LOW - 1, UP - 2);
  // Diagonal braces between the middle post and the front tower (steel).
  rail(p, m, [82, LOW - 2.4], [116, UP + 2.6], 0.55);
  rail(p, m, [150, LOW - 2.4], [116, UP + 2.6], 0.55);
  // The fixed front section of the upper deck and its rail.
  deckFloor(p, m, 80, 156, UP);
  rail(p, m, [80, UP - 4], [154, UP - 4]);
  for (const x of [96, 126]) p.box(x, UP - 4, 1.2, 4, { mat: m.steel, z: 2.1, r: 0.2 });
  // Wheel chocks (yellow) on the empty decks, the strap anchors.
  const chock = mat(c, 'gold', { spec: 0.4, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  for (const x of [AUTOS.lowSlots[0] - 28, AUTOS.lowSlots[1] - 28]) p.box(x, LOW - 4.2, 3, 2.6, { mat: chock, z: 1.5, r: 0.6 });
  p.box(AUTOS.upSlots[1] - 28, UP - 2.6, 3, 2.6, { mat: chock, z: 1.5, r: 0.6 });
  if (s >= 1) {
    holes(p, 50, LOW + 0.5, 110, 6, s >= 2 ? 16 : 7, 31 + s);
    holes(p, 152, UP, 5, 30, s >= 2 ? 5 : 2, 41 + s);
  }
  if (s >= 2) {
    soot(p, 40, LOW - 6, 130, 14, 96, LOW + 2, 30, 0.6);
    // A bent brace (the far one hangs).
    p.erase(140, UP, 14, 26, (x, y) => !(Math.abs(y - (UP + 2.6 + (150 - x) * 0.62)) < 1.2 && x > 140));
  }
  return p.frame(finishA(c, 0.3));
}

/** The headboard at the front (drawn over the cars): the rust-red wall with the name and the mark. */
export function headFrame(s: number, d: Dn): Frame {
  const p = new Pen(154, -72, 44, 58, d);
  const c = p.c;
  const m = zwMats(c);
  const x0 = 156;
  const x1 = L - 1;
  const yT = -68;
  const yB = LOW - 1;
  const part = c.newPart();
  // The wall: rust-red ribbed panel, a white top cap with the orange band (the cab's livery).
  p.field(x0, yT, x1 - x0, yB - yT, (x, y) => (x < x0 || x > x1 || y < yT || y > yB ? NaN : roll(Math.min(x - x0, x1 - x, y - yT, yB - y), 1.2) + 0.3 * Math.max(0, Math.sin((y - yT) * 0.9))), { mat: m.rust, z: 1, part }, (t, x, y) => {
    const col = Math.floor(x / 2.5);
    if (hash2(col, 9) < 0.2 && y < yT + 12) t.tone -= 0.2 * (1 - (y - yT) / 12);
  });
  p.box(x0 - 0.5, yT - 1, x1 - x0 + 1, 4, { mat: m.white, z: 1.6, r: 0.6, bevel: 0.6 });
  p.box(x0 - 0.5, yT + 3, x1 - x0 + 1, 1.6, { mat: m.orange, z: 1.62, r: 0.3 });
  // The name, upright in our block face, and the swan mark under it.
  const ink = top('snow', d, d === 1 ? 0 : 1);
  const sz = 1.2;
  const name = 'ZWAAN';
  const nw = w5Width(name, sz);
  const nx = (x0 + x1) / 2 - nw / 2;
  p.paint(x0, yT, x1 - x0, yB - yT, (x, y) => {
    if (w5Hit(name, nx, yT + 9, sz, x, y)) return ink;
    const sw = swanHit((x0 + x1) / 2 - 8, yT + 34, 1.3, x, y);
    return sw === 2 ? top('orange', d, 1) : sw === 1 ? ink : 0;
  }, 2);
  // Marker lamps on the top corners (amber).
  p.box(x0 + 1, yT - 2.6, 2, 1.6, { mat: m.amber, z: 2, r: 0.4 });
  p.box(x1 - 3, yT - 2.6, 2, 1.6, { mat: m.amber, z: 2, r: 0.4 });
  if (s >= 1) holes(p, x0 + 2, yT + 4, x1 - x0 - 4, yB - yT - 8, s >= 2 ? 22 : 9, 71 + s);
  if (s >= 2) {
    soot(p, x0, yT, x1 - x0, yB - yT, x0 + 14, yT + 20, 14, 0.7, part);
    p.erase(x1 - 9, yT - 2, 10, 9, (x, y) => y > yT + 5 - (x1 - x) * 0.6);
  }
  return p.frame(finishA(c, 0.3));
}

/** The tilting rear section of the upper deck (with its deck ram) at `tilt`°. */
export function updeckFrame(tilt: number, broken: boolean, d: Dn): Frame {
  const p = new Pen(-3, -72, 88, 56, d);
  const c = p.c;
  const m = zwMats(c);
  const [px, py] = AUTOS.pivot;
  const T: Turn = { rot: -tilt, px, py };
  const [x0, x1] = AUTOS.tiltX;
  deckFloor(p, m, x0, x1 - 1, UP, T);
  rail(p, m, turnPt(T, x0 + 1, UP - 4), turnPt(T, x1 - 2, UP - 4));
  for (const x of [x0 + 1, 28, 54, x1 - 3]) {
    const a = turnPt(T, x, UP - 4);
    const b = turnPt(T, x + 1.2, UP);
    p.box(Math.min(a[0], b[0]), a[1], 1.2, b[1] - a[1], { mat: m.steel, z: 2.1, r: 0.2 });
  }
  // The pivot (a big pin on the rear post), the chock.
  p.ellipsoid(px, py + 1, 1.6, 1.6, { mat: m.steel, z: 2.9 });
  const chock = mat(c, 'gold', { spec: 0.4, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const ck = turnPt(T, AUTOS.upSlots[0] - 28, UP - 2.6);
  p.box(ck[0], ck[1], 3, 2.6, { mat: chock, z: 1.5, r: 0.6 });
  // The deck ram: from the lower deck's rail up to the deck's underside.
  const rx = AUTOS.ramFx;
  ram(p, m, [rx, LOW - 3], [rx - 0.4, upDeckY(rx, tilt) + 3.4], broken);
  return p.frame(finishA(c, 0.3));
}

/** The ramp's ram foot on the chassis. */
const RAMP_RAM: Pt = [12, -12];
/** Ramp angles (degrees from upright, turning back over the rear) of the `ramp` frames. */
export const RAMP_ANGLES = [0, 40, 80, 115] as const;
const RAMP_LEN = 39.8;

/** The rear ramp at angle `a`° from upright (115 = on the road), its ram; `broken`: hanging, snapped. */
export function rampFrame(a: number, broken: boolean, d: Dn): Frame {
  const p = new Pen(-42, -62, 60, 64, d);
  const c = p.c;
  const m = zwMats(c);
  const [hx, hy] = AUTOS.hinge;
  const r = (a * Math.PI) / 180;
  const ex = hx - Math.sin(r) * RAMP_LEN;
  const ey = hy - Math.cos(r) * RAMP_LEN;
  // A steel ramp: a ribbed plate seen edge-on (4 px deep), with a tread pattern on its face.
  const nx = Math.cos(r);
  const ny = -Math.sin(r);
  const w = 1.7;
  const poly: Pt[] = [
    [hx + nx * w, hy + ny * w],
    [ex + nx * w, ey + ny * w],
    [ex - nx * w, ey - ny * w],
    [hx - nx * w, hy - ny * w],
  ];
  p.body(poly, 0.8, { mat: m.alu, z: 1.4 }, undefined, undefined, (t, x, y) => {
    const along = ((x - hx) * -Math.sin(r) + (y - hy) * -Math.cos(r)) / RAMP_LEN;
    if (frac(along * 13) < 0.22) t.tone -= 0.3;
    if (broken && hash2(Math.floor(x * 2), Math.floor(y * 2)) < 0.1) t.tone -= 0.4;
  });
  // The ramp's end lip (rolled), the hinge knuckle.
  p.ellipsoid(ex, ey, 1.4, 1.4, { mat: m.steel, z: 1.6 });
  p.ellipsoid(hx, hy, 1.8, 1.8, { mat: m.steel, z: 1.8 });
  // The ram: from the chassis to a third along the ramp.
  const k = 0.32;
  ram(p, m, RAMP_RAM, [hx + (ex - hx) * k, hy + (ey - hy) * k], broken);
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

for (const s of [0, 1, 2]) {
  defStrip(AUTOS_SPR.frame(s), (d) => [frameFrame(s, d)]);
  defStrip(AUTOS_SPR.head(s), (d) => [headFrame(s, d)]);
}
defStrip(AUTOS_SPR.updeck, (d) => AUTOS.tilts.map((t) => updeckFrame(t, false, d)));
defStrip(AUTOS_SPR.updeckBroken, (d) => AUTOS.tilts.map((t) => updeckFrame(t, true, d)), { defer: true });
defStrip(AUTOS_SPR.ramp, (d) => RAMP_ANGLES.map((a) => rampFrame(a, false, d)), { ticksPerFrame: 6, loop: false });
defStrip(AUTOS_SPR.rampBroken, (d) => [rampFrame(118, true, d)], { defer: true });
for (const col of AUTOS_CARS) defStrip(AUTOS_SPR.car(col), (d) => CAR_TILTS.map((t) => carFrame(col, t, d)));
defStrip(AUTOS_SPR.lamps, (d) => [lampsFrame(0, d), lampsFrame(1, d)]);
