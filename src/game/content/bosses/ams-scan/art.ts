/**
 * The parking scan car fight — the 1× art (64-colour PAL, 1-px ink outline, light from the top
 * left) of the car, and the registration of every strip of the fight with its 2× / 4× drawer
 * (art-hd.ts, art-hd-adds.ts: one density-generic drawer per id; geometry is law: the HD frames
 * keep the 1× size, anchor and points). The helpers' 1× art is in art-adds.ts.
 *
 * The car strips share the car anchor (geometry.ts; the floor point under the car's middle,
 * facing right); car.ts draws them back to front: cabin, body, wheels, lettering, scanner.
 * - `boss/ams-scan/body-<0|1|2>` — the compact, tall white electric hatchback in the city's livery
 *   (docs/design/ams-extras.md §3): a short sloping bonnet whose top face (seen a little from
 *   above) carries the red slanted stripes, a long raked windscreen, a high roof that curves down
 *   only at the very rear, a near-vertical tailgate; red slanted bars from just above the sill to
 *   mid-door (three on the front door, a stub on the front wing behind the front wheel), the three
 *   red crosses stacked on the rear door, a small red emblem over the rear arch; one dark band of
 *   glass with black pillars (A, the quarter glass divider, B, C, D) under the floating white roof;
 *   black arch trims, sill and wrap-round lower bumpers; the slim swept-back headlight, a black
 *   grille with a thin chrome bar and a plain round emblem (no maker's badge), a fog lamp, yellow
 *   plates (no real number), the red tail light, the black mirror and the handles. The glass is a
 *   hole (the cabin strip shows through). 1: dents, scuffed bars; 2: a buckled bonnet, soot, a
 *   hanging bumper and mirror.
 * - `boss/ams-scan/cabin` (5) — the dark tinted glass and what it shows: the handhaver at the
 *   wheel as a dark silhouette with his cap (calm, shouting, shocked), the airbag, empty; the
 *   windscreen sliver with the parking permit, glass glints.
 * - `boss/ams-scan/scanner-<0|1|2>` (4: down, lifted 1, lifted 2, lifted and scanning) and
 *   `scanner-gone` — the big, thick white scanner box (about 2/3 of the roof, over the windscreen
 *   at the front) on a black roof rack with feet: the lid's top face, the seam round the lid,
 *   smoked camera windows (two on the side, the lens behind the middle one, one on each end), the
 *   grey band with the number; scanning: a faint red cast behind the smoked glass and a lit lens
 *   (never a light bar); 1: a cracked window and a dented lid; 2: the box askew (its rear end
 *   dropped), both windows cracked, soot; gone: the bent rack, sheared struts, a dangling wire.
 * - `boss/ams-scan/text` (4, NEVER mirrored) — `PARKEERCONTROLE`, `Gemeente Amsterdam`, `24`, and
 *   `Gemeente Amsterdam` set for the car facing left (geometry.ts `ID.text`).
 * - `boss/ams-scan/wheel` (4 turn frames) — a silver multi-spoke alloy in a black tyre.
 * - `boss/ams-scan/blink` — the amber hazard glow.
 * - `boss/ams-scan/wreck` (8, deferred) — rolled 45°, 90°, 135°, then on its roof, facing right
 *   (0–3) and facing left (4–7, drawn unflipped: the lettering never mirrors); composited from the
 *   car strips at each density, so every density matches its own car.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames, type DenseDensity } from '../../../../engine/sprites';
import { inPoly } from '../../../art/hd/canvas';
import { hash2, shadeLayer } from '../../../art/paint';
import { DCanvas } from '../ams/canvas';
import { clampFootLo, clampLo, hookLo, reticleLo, ticketLo, truckLo } from './art-adds';
import * as hd from './art-hd';
import * as hda from './art-hd-adds';
import { ID, SCAN, WRECK, type Pt } from './geometry';
import {
  bandPart,
  barAt,
  beltY,
  boxLocal,
  camAt,
  inBand,
  inBody,
  inCross,
  inGlass,
  inGreyBand,
  inHood,
  inRack,
  inShell,
  inSill,
  inStripe,
  inStrut,
  inTrim,
  inWell,
  windowOf,
} from './shape';

// ---------------------------------------------------------------------------------------------
// Shared look
// ---------------------------------------------------------------------------------------------

/** Cabin frame → the driver's look ('' = no driver). */
export const DRIVER_EXPR = ['calm', 'shout', 'shock', 'airbag', ''] as const;

/** Dent spots of a damage state (continuous local centres; the same spots at every density). */
export function dents(state: number): ReadonlyArray<Pt> {
  if (state === 0) return [];
  const one: Pt[] = [[-37.5, -12.5], [8.5, -9.5], [34.5, -11.5]];
  return state === 1 ? one : [...one, [-15.5, -10.5], [-39.5, -9.5], [20.5, -14.5], [1.5, -9.0]];
}

/** Scratches across the red bars (state ≥ 1): [x0, y0, x1, y1] continuous. */
export function scuffs(state: number): ReadonlyArray<readonly [number, number, number, number]> {
  if (state === 0) return [];
  const one = [[3.5, -10.5, 8, -8.5], [10.5, -7.5, 14, -9.6]] as const;
  return state === 1 ? one : [...one, [-3.8, -7, 0.4, -9.8], [17.6, -12.4, 20.4, -11.2]];
}

/** The soot smudge over the bonnet and the front (state 2): 0..1. */
export function sootAt(x: number, y: number): number {
  return Math.max(0, 1 - Math.hypot((x - 35) / 8.5, (y + 13.5) / 5.5));
}

/** Visit every px of a DCanvas with its centre in local coordinates. */
function eachPx(c: DCanvas, fn: (X: number, Y: number, x: number, y: number) => void): void {
  c.each(c.x0, c.y0, c.x0 + c.b.w - 1, c.y0 + c.b.h - 1, (X, Y, lx, ly) => fn(X, Y, lx + 0.5, ly + 0.5));
}

/** A colour that never stays in a frame (the glass holes before they are cleared). */
const MARK: Color = PAL.pink[0];

/** The slim swept-back LED headlight (continuous polygon) and the tail light's box (x0, y0, y1). */
export const HEADLIGHT: readonly Pt[] = [[34.4, -13.7], [38.4, -13.85], [40.5, -13.4], [41.4, -12.4], [40.4, -12.0], [36.4, -12.75]];
export const TAIL = { x: -40.0, y0: -22.8, y1: -17.2 } as const;

/** The white paint of a 1× px (any of the snow tones the body or the box uses). */
function isPaint(v: Color): boolean {
  return v === PAL.snow[1] || v === PAL.snow[2] || v === PAL.snow[3];
}

// ---------------------------------------------------------------------------------------------
// The car body
// ---------------------------------------------------------------------------------------------

function bodyLo(state: 0 | 1 | 2): Frame {
  const S = SCAN;
  const C = S.canvas;
  const c = new DCanvas(C.x0, C.y0, C.x1, C.y1);
  const b = c.b;
  // The white panels: edge light from shadeLayer, then the form: the bonnet's top face and the
  // shoulder under the glass catch the light, the wing crease under the bonnet, the lower doors
  // turn under, the nose and the tailgate turn away from the light.
  const L = c.layer();
  eachPx(c, (X, Y, x, y) => {
    if (inBody(x, y) && !inBand(x, y) && !inSill(x, y) && !inTrim(x, y)) L.set(X, Y, PAL.snow[2]);
  });
  shadeLayer(L, PAL.snow);
  eachPx(c, (X, Y, x, y) => {
    const cur = L.get(X, Y);
    if ((cur & 255) === 0) return;
    if (inHood(x, y)) L.set(X, Y, PAL.snow[3]);
    else if (x > 23.5 && x < 38 && inHood(x, y - 1)) L.set(X, Y, PAL.snow[1]);
    else if (y > -8 && cur === PAL.snow[2]) L.set(X, Y, PAL.snow[1]);
    else if (x > 40.4 && cur === PAL.snow[2]) L.set(X, Y, PAL.snow[1]);
    else if (x < -40.6 && cur === PAL.snow[2]) L.set(X, Y, PAL.snow[1]);
  });
  c.put(L);
  // The window band: black pillars (A, the quarter glass divider, B, C, D); the glass is a hole
  // (MARK, cleared at the end).
  eachPx(c, (X, Y, x, y) => {
    const p = bandPart(x, y);
    if (p === null) return;
    b.set(X, Y, p === 'glass' || p === 'screen' ? MARK : PAL.black[1]);
  });
  // Wheel wells, the black arch trims (lit on the upper left), the sill and the lower bumpers.
  eachPx(c, (X, Y, x, y) => {
    if (inWell(x, y)) b.set(X, Y, PAL.ink[1]);
    else if (inTrim(x, y)) {
      const wx = x < 0 ? S.wheelC[0] : S.wheelC[1];
      b.set(X, Y, y < S.wheelCY - 6 && x < wx + 2 ? PAL.black[2] : PAL.black[1]);
    } else if (inSill(x, y)) b.set(X, Y, y < S.sill[0] + 1 && Math.abs(x) < S.bumperX ? PAL.black[2] : PAL.black[1]);
  });
  // Door shut lines.
  const seamBottom = [S.wheelCY - Math.sqrt(S.trimR ** 2 - (S.seams[0] - S.wheelC[0]) ** 2), S.sill[0], S.sill[0]];
  for (let i = 0; i < S.seams.length; i++) {
    const x = Math.floor(S.seams[i]);
    for (let y = Math.ceil(beltY(x + 0.5)); y + 0.5 < seamBottom[i]; y++) {
      if (inBody(x + 0.5, y + 0.5) && !inBand(x + 0.5, y + 0.5) && !inTrim(x + 0.5, y + 0.5)) c.set(x, y, PAL.snow[1]);
    }
  }
  // The livery: the bars, the bonnet stripes, the three crosses, the emblem.
  eachPx(c, (X, Y, x, y) => {
    if (!isPaint(b.get(X, Y))) return;
    if (Math.floor(x) === Math.floor(S.seams[1]) || Math.floor(x) === Math.floor(S.seams[2])) return;
    if (barAt(x, y) >= 0) b.set(X, Y, y > -6 ? PAL.red[1] : PAL.red[2]);
    else if (inStripe(x, y) || inCross(x, y)) b.set(X, Y, PAL.red[2]);
  });
  const [ex, ey] = S.emblem;
  c.rect(Math.floor(ex) - 1, Math.floor(ey) - 1, 2, 2, PAL.red[2]).set(Math.floor(ex) - 1, Math.floor(ey) - 1, PAL.red[3]);
  // Lamps: the tail light under the band's rear end, the slim headlight (a dark housing, the LED
  // line), the black grille with its chrome bar and a plain round emblem, the fog lamp, the
  // yellow plates (the rear one with the blue strip at its near end).
  eachPx(c, (X, Y, x, y) => {
    if (x < TAIL.x && y > TAIL.y0 && y < TAIL.y1 && inBody(x, y)) b.set(X, Y, y < -21.5 ? PAL.red[3] : y > -18.5 ? PAL.red[1] : PAL.red[2]);
    else if (inPoly(x, y, HEADLIGHT)) b.set(X, Y, y < -13 ? PAL.steel[1] : x > 39 ? PAL.sky[3] : PAL.snow[3]);
  });
  c.set(41, -13, PAL.orange[1]);
  c.rect(41, -12, 1, 3, PAL.black[1]).set(41, -11, PAL.steel[3]);
  c.set(40, -11, PAL.black[1]);
  c.set(38, -8, PAL.snow[3]).set(39, -8, PAL.black[1]);
  c.rect(41, -9, 1, 2, PAL.gold[2]);
  c.rect(-42, -13, 1, 3, PAL.gold[2]).set(-42, -13, PAL.sky[1]);
  // The black mirror at the base of the quarter glass, the door handles (a dark recess).
  const mirrorDrop = state === 2 ? 1 : 0;
  const [mx, my] = S.mirror;
  c.rect(Math.floor(mx) - 1, Math.floor(my) - 1 + mirrorDrop, 3, 2, PAL.black[1]).set(Math.floor(mx) - 1, Math.floor(my) - 1 + mirrorDrop, PAL.black[2]);
  for (const [hx, hy] of S.handles) c.rect(Math.floor(hx), Math.floor(hy), 2, 1, PAL.snow[0]);
  // Damage: dents (a dark crease with a lit lip), scuffed bars; 2: the bonnet buckles, soot, the
  // front bumper hangs.
  for (const [dx, dy] of dents(state)) {
    const x = Math.floor(dx);
    const y = Math.floor(dy);
    const on = (xx: number, yy: number): boolean => {
      const v = c.at(xx, yy);
      return isPaint(v) || v === PAL.red[1] || v === PAL.red[2];
    };
    if (on(x, y)) c.set(x, y, PAL.snow[0]);
    if (on(x + 1, y)) c.set(x + 1, y, PAL.snow[0]);
    if (on(x, y - 1)) c.set(x, y - 1, PAL.snow[3]);
  }
  for (const [x0, y0, x1, y1] of scuffs(state)) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.floor(x0 + ((x1 - x0) * k) / n);
      const y = Math.floor(y0 + ((y1 - y0) * k) / n);
      const v = c.at(x, y);
      if (v === PAL.red[1] || v === PAL.red[2]) c.set(x, y, k % 2 === 0 ? PAL.snow[1] : PAL.red[3]);
    }
  }
  if (state === 2) {
    // The bonnet buckles up into a crease.
    c.set(29, -18, PAL.snow[3]).set(30, -18, PAL.snow[3]).set(31, -17, PAL.snow[2]).set(28, -17, PAL.snow[0]).set(29, -17, PAL.snow[0]).set(30, -17, PAL.snow[1]);
    // Soot over the bonnet and the front: a dark smudge in clean bands (dither only at its rim).
    eachPx(c, (X, Y, x, y) => {
      const cur = b.get(X, Y);
      if ((cur & 255) === 0 || cur === MARK || cur === PAL.ink[1] || cur === PAL.black[1]) return;
      const q = sootAt(x, y);
      if (q > 0.55) b.set(X, Y, PAL.steel[1]);
      else if (q > 0.3) b.set(X, Y, PAL.steel[2]);
      else if (q > 0.12 && (X + Y) % 2 === 0) b.set(X, Y, PAL.steel[3]);
    });
    // The front bumper's lower lip hangs one px at its tip.
    c.rect(40, -7, 2, 5, 0).rect(39, -6, 3, 4, PAL.black[1]).set(41, -2, PAL.black[2]);
  }
  c.frame(true);
  // The glass holes.
  for (let i = 0; i < b.data.length; i++) if (b.data[i] === MARK) b.data[i] = 0;
  b.touch();
  return { buf: b, ox: c.X(0), oy: c.Y(0) };
}

// ---------------------------------------------------------------------------------------------
// The lettering (never mirrored): 1× hints of small print
// ---------------------------------------------------------------------------------------------

function textLo(i: number): Frame {
  const [w, h] = SCAN.textSize[i === 3 ? 1 : i];
  const buf = new PixelBuffer(w, h);
  const m = (w - 1) / 2;
  if (i === 0) {
    // PARKEERCONTROLE: a row of small dark print about 20 px long.
    for (let x = m - 10; x <= m + 10; x++) if ((x - m + 10) % 3 !== 2) buf.set(x, 1, PAL.black[2]);
  } else if (i === 1 || i === 3) {
    // Gemeente / Amsterdam: two short lines of red print, set against the crosses (frame 1: on
    // their left, the car facing right; frame 3: the mirror, on their right).
    const at = (x: number, y: number): void => {
      buf.set(i === 1 ? x : w - 1 - x, y, PAL.red[2]);
    };
    for (let x = m - 1; x <= m + 7; x++) if ((x - m + 1) % 4 !== 3) at(x, 2);
    for (let x = m - 3; x <= m + 7; x++) if ((x - m + 3) % 4 !== 3) at(x, 4);
  } else {
    // 24.
    buf.set(1, 1, PAL.black[2]);
    buf.set(3, 1, PAL.black[2]);
  }
  return { buf, ox: m, oy: (h - 1) / 2 };
}

// ---------------------------------------------------------------------------------------------
// The cabin (the tinted glass and what it shows)
// ---------------------------------------------------------------------------------------------

/** Glint streaks per side window: the streak's start x on the belt line. */
export const GLINTS: readonly number[] = [9.5, -12.5, -33.0];

/** Is (x, y) on a glint streak (0 = main, 1 = thin second, -1 = none)? */
export function glintAt(x: number, y: number, k = 1): number {
  const w = windowOf(x);
  const u = x - GLINTS[w] + (y - beltY(x)) * 0.55;
  if (u >= 0 && u < 1.2 * k) return 0;
  if (u >= 2.2 * k && u < 2.8 * k) return 1;
  return -1;
}

function cabinLo(frame: number): Frame {
  const K = SCAN.cabCanvas;
  const c = new DCanvas(K.x0, K.y0, K.x1, K.y1);
  const b = c.b;
  // Dark tinted glass: the far side's windows a little lighter in the middle, the top edge
  // catching the sky, the foot of the glass darkest; glint streaks.
  eachPx(c, (X, Y, x, y) => {
    if (!inGlass(x, y)) return;
    if (bandPart(x, y) === 'screen') {
      b.set(X, Y, y < -25 ? PAL.steel[2] : PAL.steel[1]);
      return;
    }
    const belt = beltY(x);
    let col: Color = !inBand(x, y - 1) ? PAL.steel[2] : y > belt - 1.2 ? PAL.steel[0] : PAL.steel[1];
    const g = glintAt(x, y);
    if (g === 0) col = PAL.steel[3];
    else if (g === 1) col = PAL.steel[2];
    b.set(X, Y, col);
  });
  // The parking permit behind the windscreen.
  c.set(Math.floor(SCAN.permit[0]), Math.floor(SCAN.permit[1]), PAL.snow[3]);
  // The rear headrests.
  c.rect(-17, -23, 3, 2, PAL.navy[0]).set(-16, -24, PAL.navy[0]);
  const look = DRIVER_EXPR[frame];
  if (look) {
    // The handhaver at the wheel: a dark silhouette with his cap (peak forward), a dim face.
    const [hx, hy] = SCAN.driverAt;
    c.rect(hx, hy, 6, 2, PAL.navy[0]).set(hx + 6, hy + 1, PAL.navy[0]);
    c.rect(hx + 1, hy + 2, 5, 4, PAL.ink[1]);
    c.rect(hx + 4, hy + 3, 2, 2, PAL.brown[0]);
    c.rect(hx - 2, hy + 5, 10, 2, PAL.navy[0]);
    // The steering wheel.
    c.rect(hx + 8, hy + 3, 1, 3, PAL.black[1]);
    if (look === 'shout') c.set(hx + 5, hy + 4, PAL.red[1]);
    if (look === 'shock') c.set(hx + 5, hy + 3, PAL.snow[3]).rect(hx + 6, hy + 1, 1, 2, PAL.skinA[1]);
    if (look === 'airbag') c.rect(hx + 6, hy + 1, 5, 5, PAL.snow[2]).rect(hx + 7, hy + 1, 3, 2, PAL.snow[3]);
  }
  // Only what the glass shows.
  eachPx(c, (X, Y, x, y) => {
    if (!inGlass(x, y)) b.set(X, Y, 0);
  });
  return c.frame(false);
}

// ---------------------------------------------------------------------------------------------
// The scanner box on its roof rack
// ---------------------------------------------------------------------------------------------

/** Cracks across a camera window (rest coordinates; state ≥ 1 the rear side window, 2 both). */
export function crackAt(u: number, v: number, state: number): boolean {
  if (state < 1) return false;
  const K = SCAN.scanner;
  for (let i = 0; i < (state >= 2 ? 2 : 1); i++) {
    const [x0, x1, y0, y1] = K.windows[i];
    const cx = x0 + (x1 - x0) * (i === 0 ? 0.35 : 0.6);
    const cy = (y0 + y1) / 2;
    if (Math.abs((u - cx) * 0.4 - (v - cy)) < 0.35 && Math.abs(u - cx) < 3.4) return true;
    if (Math.abs((u - cx) * -0.9 - (v - cy)) < 0.3 && u > cx && u < cx + 1.6) return true;
  }
  return false;
}

/** The dent in the box's lid (rest coordinates, continuous centre). */
export const BOX_DENT: Pt = [-7.5, -38.4];

const pt: [number, number] = [0, 0];

function scannerLo(state: 0 | 1 | 2, frame: number): Frame {
  const K = SCAN.scanCanvas;
  const B = SCAN.scanner;
  const c = new DCanvas(K.x0, K.y0, K.x1, K.y1);
  const b = c.b;
  const rise = B.rise[frame];
  const scanning = frame === 3;
  const askew = state === 2;
  eachPx(c, (X, Y, x, y) => {
    if (inRack(x, y)) b.set(X, Y, y < B.bar[2] + 1 ? PAL.black[2] : PAL.black[1]);
    else if (inStrut(x, y, rise)) b.set(X, Y, PAL.steel[2]);
  });
  const L = c.layer();
  eachPx(c, (X, Y, x, y) => {
    const [u, v] = boxLocal(x, y, rise, askew, pt);
    if (inShell(u, v)) L.set(X, Y, PAL.snow[2]);
  });
  shadeLayer(L, PAL.snow);
  c.put(L);
  // The faces: the lid's top face catches the light, the lid's rim, the lower body (its sides
  // slope in, away from the light) with the smoked camera windows and the grey band.
  eachPx(c, (X, Y, x, y) => {
    const [u, v] = boxLocal(x, y, rise, askew, pt);
    if (!inShell(u, v)) return;
    const cam = camAt(u, v);
    if (cam >= 0) {
      const y0 = cam < 2 ? B.windows[cam][2] : -37;
      const top = cam < 2 && v < y0 + 1;
      const lens = cam === 1 && Math.hypot(u - B.lens[0], v - B.lens[1]) < 0.9;
      let col: Color = scanning ? (lens ? PAL.red[2] : PAL.red[0]) : top || lens ? PAL.steel[1] : PAL.navy[0];
      if (crackAt(u, v, state)) col = scanning ? PAL.red[1] : PAL.steel[3];
      b.set(X, Y, col);
    } else if (inGreyBand(u, v)) b.set(X, Y, v < B.lidTop ? PAL.snow[1] : PAL.snow[0]);
    else if (v < B.lidTop) b.set(X, Y, PAL.snow[3]);
    else if (v > B.shut) b.set(X, Y, PAL.snow[1]);
  });
  if (state >= 1) {
    // A dent in the lid; 2: soot over the rear end.
    eachPx(c, (X, Y, x, y) => {
      const [u, v] = boxLocal(x, y, rise, askew, pt);
      if (!inShell(u, v) || camAt(u, v) >= 0) return;
      if (Math.hypot(u - BOX_DENT[0], v - BOX_DENT[1]) < 0.8) b.set(X, Y, PAL.snow[0]);
      if (state === 2 && u < -17 && v > -38 && (Math.floor(u) + Math.floor(v)) % 2 === 0) b.set(X, Y, PAL.steel[3]);
    });
  }
  return c.frame(true);
}

function scannerGoneLo(): Frame {
  const K = SCAN.scanCanvas;
  const B = SCAN.scanner;
  const c = new DCanvas(K.x0, K.y0, K.x1, K.y1);
  const b = c.b;
  eachPx(c, (X, Y, x, y) => {
    if (inRack(x, y, true)) b.set(X, Y, PAL.black[1]);
  });
  // Sheared strut stubs, a dangling wire, a shard of the box on the bar.
  const top = Math.floor(B.bar[2]) - 1;
  for (const sx of B.struts) c.rect(sx, top, 1, 1, PAL.steel[2]);
  c.set(B.struts[1], top - 1, PAL.steel[3]);
  c.set(-6, top, PAL.red[2]).set(-5, top + 1, PAL.red[2]).set(-5, top + 2, PAL.gold[2]).set(-4, top + 3, PAL.gold[2]);
  c.rect(-12, top, 3, 1, PAL.snow[2]).set(-12, top, PAL.snow[3]).set(-10, top - 1, PAL.snow[1]);
  return c.frame(true);
}

// ---------------------------------------------------------------------------------------------
// Wheel, lamp glow
// ---------------------------------------------------------------------------------------------

/** Spokes of the alloy: count; the turn per frame (radians). */
export const SPOKES = 5;
export const SPOKE_TURN = (Math.PI * 2) / SPOKES / 4;

function wheelLo(phase: number): Frame {
  const r = SCAN.wheelR;
  const n = 2 * r + 3;
  const buf = new PixelBuffer(n, n);
  const cx = n / 2;
  const cy = n / 2;
  for (let Y = 0; Y < n; Y++) {
    for (let X = 0; X < n; X++) {
      const dx = X + 0.5 - cx;
      const dy = Y + 0.5 - cy;
      const q = Math.hypot(dx, dy);
      if (q > r + 0.5) continue;
      let col: Color;
      if (q > 4.5) col = q > 5.6 || dx + dy > 3 ? PAL.black[1] : PAL.black[2];
      else if (q > 3.6) col = dx + dy < -1.5 ? PAL.steel[4] : dx + dy > 1.5 ? PAL.steel[2] : PAL.steel[3];
      else if (q < 1.2) col = dx + dy < 0 ? PAL.steel[4] : PAL.steel[2];
      else {
        const a = Math.atan2(dy, dx) - phase * SPOKE_TURN;
        const k = (((a / (Math.PI * 2)) * SPOKES) % 1 + 1) % 1;
        col = k < 0.36 ? (dx + dy < 0 ? PAL.steel[3] : PAL.steel[2]) : PAL.black[1];
      }
      buf.set(X, Y, col);
    }
  }
  buf.outline(INK);
  return { buf, ox: (n - 1) / 2, oy: (n - 1) / 2 };
}

const BLINK_SIZE = 5;

function blinkLo(): Frame {
  const n = BLINK_SIZE;
  const b = new PixelBuffer(n, n);
  const m = (n - 1) / 2;
  for (const [x, y] of [[m, m - 2], [m, m + 2], [m - 2, m], [m + 2, m]] as const) b.set(x, y, PAL.orange[2]);
  b.rect(m - 1, m - 1, 3, 3, PAL.gold[2]);
  b.set(m, m, PAL.gold[3]);
  return { buf: b, ox: m, oy: m };
}

// ---------------------------------------------------------------------------------------------
// The wreck (composited from the car strips at the frame's density)
// ---------------------------------------------------------------------------------------------

/**
 * Composite of the dead car (empty cabin, body-2, its lettering, wheels; the box is gone) on the
 * wreck canvas, facing right, or facing left (`left`: the car mirrored, the lettering NOT: it is
 * set at the mirrored spots with the left-facing frames, as car.ts draws the live car).
 */
export function wreckComposite(d: 1 | DenseDensity, left = false): PixelBuffer {
  const n = WRECK.size;
  const out = new PixelBuffer(n * d, n * d);
  const ax = n / 2;
  const ay = n / 2 - WRECK.mid;
  const X = (x: number): number => (left ? -x : x);
  const text = (i: number): number => (left ? SCAN.textFlip[i] : i);
  const parts: Array<[string, number, number, number, boolean]> = [
    [ID.cabin, 4, 0, 0, left],
    [ID.body[2], 0, 0, 0, left],
    [ID.text, text(0), X(SCAN.text[0][0]), SCAN.text[0][1], false],
    [ID.text, text(1), X(SCAN.text[1][0]), SCAN.text[1][1], false],
    [ID.wheel, 0, X(SCAN.wheelX[0]), SCAN.wheelY, left],
    [ID.wheel, 0, X(SCAN.wheelX[1]), SCAN.wheelY, left],
  ];
  for (const [id, i, dx, dy, flipX] of parts) {
    const f = getFrames(id, d)[i];
    out.blitFrame(f, (ax + dx) * d, (ay + dy) * d, flipX ? { flipX } : undefined, d);
  }
  return out;
}

/**
 * Wreck frame i at density d: 0–2 rolled 45° · (i + 1) backwards, 3 on its roof (the car facing
 * right); 4–7 the same for the car facing left (drawn unflipped, so the lettering never mirrors).
 */
export function wreckFrame(i: number, d: 1 | DenseDensity): Frame {
  const n = WRECK.size;
  const left = i >= 4;
  const k = i % 4;
  const base = wreckComposite(d, left);
  let buf: PixelBuffer;
  if (k >= 3) {
    // On its roof: turned 180° about the car's middle; the roof rests on the floor.
    buf = base.flipped(true, true);
  } else {
    // 'smooth' at 1×; the dense frames are fine enough for a plain rotation (and much faster).
    const r = base.rotated((left ? 1 : -1) * (Math.PI / 4) * (k + 1), { align: d, quality: d === 1 ? 'smooth' : 'fast' });
    const kx = (r.w - n * d) / 2;
    const ky = (r.h - n * d) / 2;
    buf = r.crop(kx, ky, n * d, n * d);
  }
  const f: Frame = { buf, ox: n / 2, oy: n / 2 - WRECK.mid };
  return d === 1 ? f : { ...f, density: d };
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

/** Every strip of the fight (section c's art list wants them all; `SCAN_DEFERRED_IDS` are rare). */
export const SCAN_ART_IDS: readonly string[] = [
  ...ID.body,
  ...ID.scanner,
  ID.scannerGone,
  ID.text,
  ID.cabin,
  ID.wheel,
  ID.blink,
  ID.wreck,
  ID.reticle,
  ID.ticket,
  ID.truck,
  ID.hook,
  ID.clamp,
  ID.clampFoot,
];
/** Strips drawn only at the end of the fight. */
export const SCAN_DEFERRED_IDS: readonly string[] = [ID.wreck];

const STATES = [0, 1, 2] as const;
const F4 = [0, 1, 2, 3] as const;
for (const s of STATES) {
  defineSprite(ID.body[s], () => [bodyLo(s)], { hd: (d) => [hd.bodyHd(s, d)] });
  defineSprite(ID.scanner[s], () => F4.map((f) => scannerLo(s, f)), { hd: (d) => F4.map((f) => hd.scannerHd(s, f, d)) });
}
defineSprite(ID.scannerGone, () => [scannerGoneLo()], { hd: (d) => [hd.scannerGoneHd(d)] });
defineSprite(ID.text, () => [0, 1, 2, 3].map((i) => textLo(i)), { hd: (d) => [0, 1, 2, 3].map((i) => hd.textHd(i, d)) });
defineSprite(ID.cabin, () => [0, 1, 2, 3, 4].map((f) => cabinLo(f)), { hd: (d) => [0, 1, 2, 3, 4].map((f) => hd.cabinHd(f, d)) });
defineSprite(ID.wheel, () => F4.map((f) => wheelLo(f)), { hd: (d) => F4.map((f) => hd.wheelHd(f, d)) });
defineSprite(ID.blink, () => [blinkLo()], { hd: (d) => [hd.blinkHd(d)] });
const F8 = [0, 1, 2, 3, 4, 5, 6, 7] as const;
defineSprite(ID.wreck, () => F8.map((i) => wreckFrame(i, 1)), { defer: true, hd: (d) => F8.map((i) => wreckFrame(i, d)) });
defineSprite(ID.reticle, () => [reticleLo(false), reticleLo(true)], { hd: (d) => [hda.reticleHd(false, d), hda.reticleHd(true, d)] });
defineSprite(ID.ticket, () => [0, 1, 2].map((f) => ticketLo(f)), { ticksPerFrame: 3, hd: (d) => [0, 1, 2].map((f) => hda.ticketHd(f, d)) });
defineSprite(ID.truck, () => [truckLo(false), truckLo(true)], { hd: (d) => [hda.truckHd(false, d), hda.truckHd(true, d)] });
defineSprite(ID.hook, () => [hookLo()], { hd: (d) => [hda.hookHd(d)] });
defineSprite(ID.clamp, () => F4.map((f) => clampLo(f)), { hd: (d) => F4.map((f) => hda.clampHd(f, d)) });
defineSprite(ID.clampFoot, () => [0, 1].map((f) => clampFootLo(f)), { hd: (d) => [0, 1].map((f) => hda.clampFootHd(f, d)) });

/** Unused hash import guard (the 1× art is deterministic without noise). */
void hash2;
