/**
 * The convoy's vehicles at 1× / 2× / 4× (docs/design/ring.md §5.3; docs/ART_GUIDE.md "UHD art"):
 *
 * - The ring scan car is the `ams` likeness (docs/api/scan-car.md §3): its body, cabin, wheels and
 *   lettering are the ams strips' own drawers (content/bosses/ams-scan/art*.ts, never edited here)
 *   registered at `ring/scan-car/` ids, so the tier-4 working set holds them outside the ams boss
 *   section. The 1× frames are copies of the ams 1× frames; the 2× / 4× frames come from the ams
 *   density-generic drawers (`bodyHd`, `cabinHd`, …), which take their geometry from the ams 1×
 *   frames = these frames' geometry. Only the facing-right lettering (frames 0, 1): the ring car
 *   never faces left.
 * - The roof box is NEW and SMALLER (16 px instead of the ams 29): one density-generic drawer here
 *   (`boxFrame`), outline A: a white rounded box with a lid seam, two smoked camera windows, the
 *   lens behind the rear one, a low black rack on two feet. Frames: 0 idle, 1 scanning (a red cast
 *   behind the smoked glass, the lens lit), 2 the lens flares.
 * - The tow truck is the ams tow truck (its `truckLo` / `truckHd` and the hook) at `ring/tow-truck/`.
 *   Its cower (`towCower`, new) is an overlay over the cab's window: the driver ducks below the sill.
 */
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { hash2 } from '../../../art/paint';
import { DCanvas, geomOf, HdPiece } from '../../bosses/ams/canvas';
import { blinkHd, bodyHd, cabinHd, textHd, wheelHd } from '../../bosses/ams-scan/art-hd';
import { hookLo, inCab, truckLo } from '../../bosses/ams-scan/art-adds';
import { hookHd, truckHd } from '../../bosses/ams-scan/art-hd-adds';
import { ID as AMS, TRUCK, type Pt } from '../../bosses/ams-scan/geometry';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { SCAN_BOX } from './geometry';

/** A rolled edge: height over distance e from an edge with roll radius r. */
function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/** A copy of frame i of an ams strip at 1× (its own buffer: the ids never share pixels). */
export function amsLo(id: string, i = 0): Frame {
  const f = getFrames(id, 1)[i];
  return { ...f, buf: f.buf.clone() };
}

// ---------------------------------------------------------------------------------------------
// The scan car (the ams drawers)
// ---------------------------------------------------------------------------------------------

export const scanBody = (s: 0 | 1 | 2, d: Dn): Frame => (d === 1 ? amsLo(AMS.body[s]) : bodyHd(s, d));
export const scanCabin = (f: number, d: Dn): Frame => (d === 1 ? amsLo(AMS.cabin, f) : cabinHd(f, d));
export const scanWheel = (f: number, d: Dn): Frame => (d === 1 ? amsLo(AMS.wheel, f) : wheelHd(f, d));
export const scanText = (i: 0 | 1, d: Dn): Frame => (d === 1 ? amsLo(AMS.text, i) : textHd(i, d));
export const scanBlink = (d: Dn): Frame => (d === 1 ? amsLo(AMS.blink) : blinkHd(d));

// ---------------------------------------------------------------------------------------------
// The ring roof box (new, smaller)
// ---------------------------------------------------------------------------------------------

/** Frame f of the roof box at density d (car anchor; 0 idle, 1 scanning, 2 the lens flares). */
export function boxFrame(f: number, d: Dn): Frame {
  const B = SCAN_BOX;
  const { x0, y0, x1, y1 } = B.canvas;
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const c = new HdCanvas(W, H, d);
  const X = (x: number): number => x - x0;
  const Y = (y: number): number => y - y0;
  const white = mat(c, 'snow', { spec: 0.75, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.25 });
  const black = mat(c, 'black', { spec: 0.4, shine: 18, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const smoke = mat(c, 'black', { spec: 1.1, shine: 60, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const grey = mat(c, 'steel', { spec: 0.5, shine: 24, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const red = mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const scanning = f >= 1;
  // The rack: two feet down to the roof, the mounting bar.
  for (const [fx0, fx1] of B.feet) c.box(X(fx0), Y(B.bar[3]), fx1 - fx0, B.feetTo - B.bar[3], { mat: black, z: 0.3, bevel: 0.3 });
  c.box(X(B.bar[0]), Y(B.bar[2]), B.bar[1] - B.bar[0], B.bar[3] - B.bar[2], { mat: black, z: 0.6, r: 0.3, bevel: 0.3 });
  // The shell: a white box with rounded ends; the lid's top face is lit, the seam under the lid.
  const s = B.shell;
  c.box(X(s.x0), Y(s.y0), s.x1 - s.x0, s.y1 - s.y0, {
    mat: white,
    z: 1,
    r: 1.1,
    bevel: 0.9,
    tex: (t) => {
      const y = t.y + y0;
      if (y < B.lidTop) t.tone += 0.18;
      if (Math.abs(y - B.seam) < 0.3 * Math.max(1, 2 / d)) t.tone -= 0.45;
      // The grey band near the front end (the ams box's number band, without the number).
      const x = t.x + x0;
      if (x > -1.6 && x < 0.2 && y > B.seam) t.mat = grey;
    },
  });
  // The smoked camera windows (a red cast while scanning) and the lens behind the rear one.
  for (const [wx0, wx1] of B.windows) {
    c.box(X(wx0), Y(B.win[0]), wx1 - wx0, B.win[1] - B.win[0], {
      mat: smoke,
      z: 1.6,
      r: 0.3,
      bevel: 0.3,
      tex: (t) => {
        if (scanning) t.tone += 0.35;
        // A glint across the glass.
        const u = t.x + x0 - wx0 - (t.y + y0 - B.win[0]) * 0.6;
        if (u > 0.4 && u < 0.4 + Math.max(0.3, 1 / d)) t.tone += 0.6;
      },
    });
  }
  const [lx, ly] = B.lens;
  c.ellipsoid(X(lx), Y(ly), 0.8, 0.65, { mat: scanning ? red : smoke, z: 1.9, tone: f === 2 ? 0.5 : scanning ? 0.15 : -0.1 });
  if (d > 1 && f === 2) c.dot(X(lx) - 0.2, Y(ly) - 0.3, top('snow', d, 0));
  if (d > 1 && scanning) {
    // A faint red cast behind both windows at 2× / 4× (the lit glass, no coloured lamps).
    for (const [wx0, wx1] of B.windows) c.dot(X((wx0 + wx1) / 2), Y(B.win[0]) + 0.6, top('red', d, 1));
  }
  const buf = finishA(c, 0.25);
  const fr: Frame = { buf, ox: -x0, oy: -y0 };
  return d === 1 ? fr : { ...fr, density: d };
}

/**
 * The roof box knocked askew by the breakdown (frames 3, 4 of `ring/scan-car/box`, car anchor):
 * the front foot tears off the rack and the box tips forward about its rear foot, 9° (3), then
 * 22° (4: its nose on the windscreen's top, a loose cable dangling, the lens dark and cracked).
 * The same box, drawn turned (fields evaluated in the box's own coordinates).
 */
export function boxBrokenFrame(f: 3 | 4, d: Dn): Frame {
  const B = SCAN_BOX;
  const x0 = -19;
  const y0 = -39;
  const W = 24;
  const H = 17;
  const c = new HdCanvas(W, H, d);
  const white = mat(c, 'snow', { spec: 0.75, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.25 });
  const black = mat(c, 'black', { spec: 0.4, shine: 18, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const smoke = mat(c, 'black', { spec: 1.1, shine: 60, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const grey = mat(c, 'steel', { spec: 0.5, shine: 24, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const a = ((f === 3 ? 9 : 22) * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // The pivot: the rear foot's bottom on the roof. Box coords → canvas (turned clockwise: nose down) and back.
  const [fx0, fx1] = B.feet[0];
  const px = (fx0 + fx1) / 2;
  const py = B.feetTo;
  const rot = (x: number, y: number): [number, number] => [px + (x - px) * ca - (y - py) * sa - x0, py + (x - px) * sa + (y - py) * ca - y0];
  const inv = (X: number, Y: number): [number, number] => {
    const u = X + x0 - px;
    const v = Y + y0 - py;
    return [px + u * ca + v * sa, py - u * sa + v * ca];
  };
  const seg = (ax: number, ay: number, bx: number, by: number, r: number, m: number, z: number): void => {
    const [p0, q0] = rot(ax, ay);
    const [p1, q1] = rot(bx, by);
    c.capsule(p0, q0, p1, q1, r, r, { mat: m, z });
  };
  /** Signed inside distance of the box-coords point to a rounded rect (≤ 0 outside). */
  const inside = (x: number, y: number, r: { x0: number; x1: number; y0: number; y1: number }, rr: number): number => {
    const qx = Math.max(r.x0 + rr - x, x - (r.x1 - rr), 0);
    const qy = Math.max(r.y0 + rr - y, y - (r.y1 - rr), 0);
    if (qx > 0 || qy > 0) return rr - Math.hypot(qx, qy);
    return rr + Math.min(x - (r.x0 + rr), r.x1 - rr - x, y - (r.y0 + rr), r.y1 - rr - y);
  };
  // The rack: the rear foot still holds; the front foot torn: a stub on the roof, a stub on the bar.
  c.capsule(rot(px, B.bar[3])[0], rot(px, B.bar[3])[1], px - x0, py - y0, 0.85, 0.85, { mat: black, z: 0.3 });
  const fx = (B.feet[1][0] + B.feet[1][1]) / 2;
  c.capsule(fx - x0, py - y0, fx + 0.3 - x0, py - 0.9 - y0, 0.8, 0.6, { mat: black, z: 0.3 });
  seg(fx, B.bar[3], fx - 0.4, B.bar[3] + 0.7, 0.6, black, 0.5);
  seg(B.bar[0], (B.bar[2] + B.bar[3]) / 2, B.bar[1], (B.bar[2] + B.bar[3]) / 2, 0.45, black, 0.6);
  // The shell (the lid's lit top, the seam, the grey band) on the turned box.
  const sh = B.shell;
  c.heightField(0, 0, W, H, (X, Y) => {
    const [x, y] = inv(X, Y);
    const e = inside(x, y, sh, 1.1);
    return e > 0 ? roll(e, 0.9) : NaN;
  }, {
    mat: white,
    z: 1,
    tex: (t) => {
      const [x, y] = inv(t.x, t.y);
      if (y < B.lidTop) t.tone += 0.18;
      if (Math.abs(y - B.seam) < 0.3 * Math.max(1, 2 / d)) t.tone -= 0.45;
      if (x > -1.6 && x < 0.2 && y > B.seam) t.mat = grey;
      // Road dust thrown up on it, a scuff on the nose.
      if (f === 4 && x > -2 && y > B.seam && (x * 3.1 + y * 1.7) % 1 < 0.3) t.tone -= 0.3;
    },
  });
  // The smoked windows, dark (no scan), and the lens, dark and cracked.
  for (const [wx0, wx1] of B.windows) {
    c.heightField(0, 0, W, H, (X, Y) => {
      const [x, y] = inv(X, Y);
      return x > wx0 && x < wx1 && y > B.win[0] && y < B.win[1] ? 0.3 : NaN;
    }, { mat: smoke, z: 1.6 });
  }
  const [lx, ly] = rot(B.lens[0], B.lens[1]);
  c.ellipsoid(lx, ly, 0.8, 0.65, { mat: smoke, z: 1.9, tone: -0.2 });
  if (d > 1) c.paint(lx - 1, ly - 1, 2, 2, (X, Y) => (Math.abs((X - lx) - (Y - ly) * 0.8) < 0.18 ? top('snow', d, 1) : 0));
  if (f === 4) {
    // A loose cable from under the box down to the roof, a sag in it.
    const [ax, ay] = rot(-7, B.bar[2]);
    c.stroke([[ax, ay], [ax - 1.2, ay + 1.6], [ax - 2.6, py - y0 - 0.2]], 0.32, 0.3, { mat: black, z: 0.4 });
  }
  const buf = finishA(c, 0.25);
  const fr: Frame = { buf, ox: -x0, oy: -y0 };
  return d === 1 ? fr : { ...fr, density: d };
}

// ---------------------------------------------------------------------------------------------
// The tow truck (the ams drawers)
// ---------------------------------------------------------------------------------------------

export const towBody = (damaged: boolean, d: Dn): Frame => (d === 1 ? truckLo(damaged) : truckHd(damaged, d));
export const towHook = (d: Dn): Frame => (d === 1 ? hookLo() : hookHd(d));

// ---------------------------------------------------------------------------------------------
// The tow truck's cower (new): the driver ducks below the sill
// ---------------------------------------------------------------------------------------------

/**
 * The tow truck's cower overlay (drawn over `ring/tow-truck/body` at the truck anchor; 6 frames:
 * 0–2 on the clean body, 3–5 on the damaged one): the driver ducks below the window sill, his
 * hands clasped over his head (0), trembling (1), peeking over the sill with wide eyes (2). The
 * window glass is redrawn as the body draws it (the 1× pixels, the HD glass on the body's own art
 * px grid) with the driver's head gone; only the window's inside is drawn (its rim stays the
 * body's). Cropped to local x 0 … 36, y −33 … 0 (the anchor in the frame).
 */
export const TOW_COWER_BOX = { x: 0, y: -33, w: 37, h: 34 } as const;

/** A frame cropped to the cower box (logical px) at density d; the anchor stays the truck's. */
function cowerCrop(f: Frame, d: number): Frame {
  const B = TOW_COWER_BOX;
  const cx = B.x + f.ox;
  const cy = B.y + f.oy;
  const buf = f.buf.crop(cx * d, cy * d, B.w * d, B.h * d);
  const fr: Frame = { buf, ox: -B.x, oy: -B.y };
  return d === 1 ? fr : { ...fr, density: d };
}

/** Is (x, y) inside the truck's window, at least `inset` px from its rim? */
function inWindow(x: number, y: number, inset: number): boolean {
  const w = TRUCK_WINDOW;
  return inPoly(x, y, w) && polyDist(x, y, w) >= inset;
}

const TRUCK_WINDOW = TRUCK.window as readonly Pt[];

/** The cowering driver's pose per frame: head top, hands, eyes (peek). */
function cowerPose(f: number): { head: number; hands: number; dx: number; peek: boolean } {
  if (f === 2) return { head: -25.4, hands: -22.4, dx: 0, peek: true };
  return f === 1 ? { head: -24.0, hands: -25.6, dx: 0.4, peek: false } : { head: -24.4, hands: -24.9, dx: 0, peek: false };
}

/** Frame f (0 duck, 1 tremble, 2 peek) of the cower overlay on the clean / damaged body at density d. */
export function towCower(f: number, damaged: boolean, d: Dn): Frame {
  const pose = cowerPose(f);
  if (d === 1) {
    const T = TRUCK;
    const c = new DCanvas(T.canvas.x0, T.canvas.y0, T.canvas.x1, T.canvas.y1);
    // The window as the 1× body paints it, without the driver's head.
    c.poly(T.window, PAL.navy[0]);
    c.line(26, -23, 30, -31, PAL.sky[2]).line(27, -23, 31, -31, PAL.sky[1]);
    if (damaged) {
      c.line(28, -30, 32, -24, PAL.snow[2]).line(30, -27, 33, -28, PAL.snow[2]);
      c.each(24, -31, 35, -22, (X, Y, lx, ly) => {
        const cur = c.b.get(X, Y);
        if ((cur & 255) === 0 || cur === PAL.navy[0]) return;
        if (hash2(lx, ly, 23) < 0.12) c.b.set(X, Y, PAL.ink[1]);
      });
    }
    // The driver below the sill: the top of his head, the hands over it (or the eyes, peeking).
    const sx = Math.round(pose.dx);
    if (pose.peek) {
      c.rect(27, -25, 4, 3, PAL.ink[1]);
      c.set(28, -24, PAL.snow[3]).set(30, -24, PAL.snow[3]);
      c.set(26, -23, PAL.skinA[2]).set(31, -23, PAL.skinA[2]);
    } else {
      // The head's top over the sill, the forearms up over it in a roof (one row higher: trembling).
      const up = f === 1 ? 1 : 0;
      c.rect(27 + sx, -23, 4, 2, PAL.ink[1]);
      c.set(26, -23 - up, PAL.skinA[1]).set(27, -24 - up, PAL.skinA[2]).set(28, -25 - up, PAL.skinA[2]);
      c.set(31, -23 - up, PAL.skinA[1]).set(30, -24 - up, PAL.skinA[2]).set(29, -25 - up, PAL.skinA[2]);
    }
    // Only the window's inside (the rim stays the body's).
    c.each(T.canvas.x0, T.canvas.y0, T.canvas.x1, T.canvas.y1, (X, Y, lx, ly) => {
      if (!inWindow(lx + 0.5, ly + 0.5, 0.01)) c.b.set(X, Y, 0);
    });
    return cowerCrop(c.frame(false), 1);
  }
  const body = amsLo(AMS.truck, damaged ? 1 : 0);
  const p = new HdPiece(geomOf(body), d);
  const R = PAL_HD;
  const T = TRUCK;
  const navy = p.material({ ramp: R.denim, lo: 1, hi: 5, spec: 0.6, shine: 34, wrap: 0.05 });
  const white = p.material({ ramp: R.snow, lo: 2, hi: 5, spec: 0.5, shine: 30 });
  const black = p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.3, shine: 14 });
  const skin = p.material({ ramp: R.skinA, lo: 2, hi: 6, spec: 0.3, shine: 20 });
  const eye = p.material({ ramp: R.snow, lo: 4, hi: 6, spec: 0.6, shine: 40 });
  // The cab panel as the body's drawer makes it (at 2× / 4× the side window reads as the navy
  // panel with the driver's dark head on it): the same field on the same art px grid.
  p.field(T.cab.x - 0.5, T.cab.y - 0.5, T.cab.w + T.bonnet.w + 1, T.cab.h + 1, (x, y) => {
    if (!inCab(x, y)) return NaN;
    let e = 9;
    for (const [ox, oy] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6]] as const) {
      if (!inCab(x + ox, y + oy)) e = Math.min(e, Math.hypot(ox, oy));
    }
    const t = Math.min(1, e / 1.2);
    return 1.2 * Math.sqrt(1 - (1 - t) * (1 - t)) + (x > 36 && y < -14 ? (-14 - y) * 0.12 : 0);
  }, {
    mat: navy,
    z: 2,
    tex: p.tex((s) => {
      if (s.y > -15.5 && s.y < -13.4) s.mat = white;
      if (Math.abs(s.x - 23.5) < 0.2 && s.y > -21 && s.y < -6) s.tone -= 0.7;
    }),
  });
  const sill = -22;
  const hx = 29 + pose.dx;
  // The head: its dome over the sill line (the rest hidden below it).
  p.field(hx - 2.4, pose.head - 0.2, 4.8, sill - pose.head + 0.2, (x, y) => {
    const q = Math.hypot((x - hx) / 2.1, (y - (pose.head + 2.3)) / 2.3);
    return q < 1 && y < sill ? 1.4 + Math.sqrt(1 - q * q) * 1.2 : NaN;
  }, { mat: black, z: 2.8 });
  if (pose.peek) {
    // Wide eyes over the sill, the fingers gripping it.
    for (const ex of [hx - 0.9, hx + 0.9]) {
      p.ell(ex, -24.3, 0.55, 0.6, { mat: eye, z: 5 });
      p.ell(ex + 0.15, -24.2, 0.22, 0.26, { mat: black, z: 5.2 });
    }
    for (const gx of [26.6, 31.4]) p.ell(gx, sill - 0.5, 0.9, 0.6, { mat: skin, z: 5 });
  } else {
    // The hands clasped over the head, the forearms down its sides.
    for (const [ax, bx] of [[hx - 2.2, hx - 0.8], [hx + 2.2, hx + 0.8]] as const) {
      p.cap(ax, sill - 0.2, bx, pose.hands + 0.4, 0.55, 0.5, { mat: skin, z: 4.6 });
      p.ell(bx, pose.hands, 0.85, 0.7, { mat: skin, z: 4.8 });
    }
  }
  // Only the patch over the old head and the sill: the rest stays the body's.
  p.erase(T0.x, T0.y, T0.w, T0.h, (x, y) => !(x > PATCH.x0 && x < PATCH.x1 && y > PATCH.y0 && y < PATCH.y1));
  return cowerCrop(p.frame({ outline: 'none', ao: 0.3, rimLight: 0 }), d);
}

/** The HD patch (local px): the old head with its AO ring, the sill where the driver ducks. */
const PATCH = { x0: 25.4, x1: 32.6, y0: -30.6, y1: -21.6 } as const;
const T0 = { x: 10, y: -40, w: 40, h: 40 } as const;
