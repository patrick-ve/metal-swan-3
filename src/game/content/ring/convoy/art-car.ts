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
 */
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import { HdCanvas } from '../../../art/hd';
import { blinkHd, bodyHd, cabinHd, textHd, wheelHd } from '../../bosses/ams-scan/art-hd';
import { hookLo, truckLo } from '../../bosses/ams-scan/art-adds';
import { hookHd, truckHd } from '../../bosses/ams-scan/art-hd-adds';
import { ID as AMS } from '../../bosses/ams-scan/geometry';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { SCAN_BOX } from './geometry';

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

// ---------------------------------------------------------------------------------------------
// The tow truck (the ams drawers)
// ---------------------------------------------------------------------------------------------

export const towBody = (damaged: boolean, d: Dn): Frame => (d === 1 ? truckLo(damaged) : truckHd(damaged, d));
export const towHook = (d: Dn): Frame => (d === 1 ? hookLo() : hookHd(d));
