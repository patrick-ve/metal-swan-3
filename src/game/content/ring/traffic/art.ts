/**
 * Sprites of content area `ring/traffic` — the civilian cars of the ring (docs/design/ring.md §8,
 * §11; docs/ART_GUIDE.md "UHD art"). ONE density-generic drawer per strip: an `HdCanvas` at density
 * d with the ramps of that density (`PAL` at 1×, `PAL_HD` at 2× and 4×; content/stag/kit.art.ts),
 * the same shapes at the same logical places (geometry.ts), outline A (they move and stop shots).
 * Facing right only (traffic drives right): nothing mirrors, so lettering reads.
 *
 * - `ring/car/<model>-<colour>` (1): the body of a model in one paint (geometry.ts `colours`): a lit
 *   painted volume (rolled edges, the shoulder under the glass, the lower doors tucking under),
 *   shut lines, handles, the tinted glass band with sky glints and the driver's dark silhouette,
 *   black pillars, sill, bumpers and rubbing strip, the side mirror, the headlight and the tall tail
 *   light, the wheel wells (the wheels are their own strip). No badge, no plates in view.
 *   Models: hatch, estate (a modern estate: never the players' boxy wagon shape or colours), van
 *   (a high-roof panel van), taxi (black, a lit TAXI roof sign), camper (an alcove camper, white
 *   with stripes in the paint colour), box-truck (a white box with a stripe, the cab in the colour,
 *   a black chassis with a side guard).
 * - `ring/car/wheel-<s|m|l>` (4, centre anchor): a black tyre with sidewall shine and a steel rim
 *   with five holes, turned 18° a frame (a full 72° step of the five-fold rim over 4 frames).
 * - `ring/car/dent` (4, centre anchor, no outline: decals on the paint): a small dent, a bigger
 *   crumple, a scrape to the primer, a crack star in the glass. car.ts lays them on its spots.
 * - `ring/car/van-open` (1, the van anchor): the hostage van's open rear: the near rear door
 *   swung out behind the van, the dark cargo hold with its floor and far wall.
 * - `ring/car/cage` (2: shut, dented) — the steel cage door over the hold (the hostage's door,
 *   items/hostage.ts); `ring/car/cage-fall` (5, `doorFallFrame`, anchor under the flat door's
 *   middle): the shot-off cage door tipping out of its opening toward us and landing flat.
 */
import { INK } from '../../../../engine/palette';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, inPoly, polyDist, type TexSample } from '../../../art/hd';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { CAR_GEO, carSprite, doorBox, doorFallAnchor, DOOR_FALL, HOSTAGE_VAN, WHEEL_R, type CarGeo, type Pt, type WheelSize } from './geometry';
import { glyphHitC } from './lettering';

const frac = (v: number): number => v - Math.floor(v);

/** A rolled edge: height over distance e from an edge with roll radius r. */
function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/** Half width of a fine line (a shut line, a crease) at density d, logical px. */
function lineW(d: number): number {
  return d === 1 ? 0.5 : d === 2 ? 0.26 : 0.17;
}

/** The canvas box of a car frame (local, integer): room for the outline. */
function carBox(g: CarGeo): { x0: number; y0: number; w: number; h: number } {
  const x0 = Math.floor(-g.len / 2) - 2;
  const x1 = Math.ceil(g.len / 2) + 2;
  const y0 = -Math.ceil(g.height) - 3;
  return { x0, y0, w: x1 - x0, h: 1 - y0 };
}

/** Continuous wheel centre of wheel i (the wheel strip lands its centre at x + 0.5). */
export function wheelCentre(g: CarGeo, i: number): Pt {
  return [g.wheels[i] + 0.5, -WHEEL_R[g.wheel]];
}

/** Distance to the nearer wheel centre. */
function wheelDist(g: CarGeo, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < g.wheels.length; i++) {
    const [cx, cy] = wheelCentre(g, i);
    best = Math.min(best, Math.hypot(x - cx, y - cy));
  }
  return best;
}

const archR = (g: CarGeo): number => WHEEL_R[g.wheel] + 1.2;

/** Depth of the fittings over the painted body (the body's surface reaches about z 3.6). */
const ZD = 5;

/** Paint material of a colour at density d. */
function paintMat(c: HdCanvas, colour: string): number {
  if (colour === 'gable') return mat(c, 'gable', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3, bounce: 0.3 });
  if (colour === 'black') return mat(c, 'black', { spec: 1, shine: 50, lo1: 0, hi1: 2, lo: 1, hi: 5, rim: 0.4, bounce: 0.4 });
  if (colour === 'steel') return mat(c, 'steel', { spec: 1, shine: 44, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.3, bounce: 0.3 });
  if (colour === 'navy') return mat(c, 'navy', { spec: 0.9, shine: 44, lo1: 0, hi1: 3, lo: 1, hi: 5, rim: 0.3, bounce: 0.4 });
  return mat(c, colour, { spec: 0.85, shine: 42, lo1: 0, hi1: 3, lo: 2, rim: 0.3, bounce: 0.3 });
}

/** The materials every car shares. */
interface Mats {
  black: number;
  plastic: number;
  well: number;
  glass: number;
  chrome: number;
  head: number;
  tail: number;
  amber: number;
}

function mats(c: HdCanvas): Mats {
  return {
    black: mat(c, 'black', { spec: 0.7, shine: 34, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    plastic: mat(c, 'slate', { spec: 0.25, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    well: mat(c, 'black', { spec: 0, amb: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 }),
    glass: mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 }),
    chrome: mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 4, lo: 3, hi: 6, rim: 0.4 }),
    head: mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 3, hi: 6 }),
    tail: mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 }),
    amber: mat(c, 'orange', { spec: 1, shine: 50, lo1: 0, hi1: 1, lo: 2, hi: 5 }),
  };
}

/**
 * A lit field over the local box where `inside(x, y)` holds (NaN elsewhere), `h(x, y)` its height.
 * (x0, y0) is the canvas origin in local coordinates.
 */
function field(c: HdCanvas, ox: number, oy: number, x: number, y: number, w: number, hgt: number, h: (x: number, y: number) => number, o: Parameters<HdCanvas['heightField']>[5]): void {
  c.heightField(x - ox, y - oy, w, hgt, (cx, cy) => h(cx + ox, cy + oy), o);
}

/** Draw a painted body volume over the polygon `poly` (arches cut, the band left out). */
function body(c: HdCanvas, g: CarGeo, poly: readonly Pt[], paint: number, ox: number, oy: number, part: number, extra?: (x: number, y: number) => number, tex?: (t: TexSample, x: number, y: number) => void): void {
  let xa = Infinity;
  let xb = -Infinity;
  let ya = Infinity;
  let yb = -Infinity;
  for (const [px, py] of poly) {
    xa = Math.min(xa, px);
    xb = Math.max(xb, px);
    ya = Math.min(ya, py);
    yb = Math.max(yb, py);
  }
  const ar = archR(g);
  field(
    c,
    ox,
    oy,
    xa - 1,
    ya - 1,
    xb - xa + 2,
    yb - ya + 2,
    (x, y) => {
      if (!inPoly(x, y, poly)) return NaN;
      const wd = wheelDist(g, x, y);
      if (wd < ar) return NaN;
      if (inPoly(x, y, g.band)) return NaN;
      const e = Math.min(polyDist(x, y, poly), wd - ar + 0.5);
      let h = roll(e, 2.2);
      // The shoulder just under the glass, the waist below it.
      const sb = y - g.belt;
      if (sb > -0.5) h += 0.55 * Math.exp(-(((sb - 1.1) / 0.8) ** 2)) - 0.2 * Math.exp(-(((sb - 3.2) / 1.4) ** 2));
      // The lower doors tuck under towards the sill.
      if (y > g.sill - 3) h -= (y - (g.sill - 3)) * 0.42;
      return h + (extra ? extra(x, y) : 0);
    },
    {
      mat: paint,
      z: 1,
      part,
      tex: (t) => {
        const x = t.x + ox;
        const y = t.y + oy;
        tex?.(t, x, y);
      },
    },
  );
}

/** Shut lines and creases as a texture: dark lines (a lighter edge on the lit side at 4×). */
function seamTex(g: CarGeo, d: number, top0: number): (t: TexSample, x: number, y: number) => void {
  const hw = lineW(d);
  return (t, x, y) => {
    if (y < top0 || y > g.sill + 0.5) return;
    for (const sx of g.seams) {
      const dx = x - sx;
      if (Math.abs(dx) < hw) {
        t.tone -= 0.75;
        return;
      }
      if (d === 4 && dx > -hw * 3 && dx < -hw) t.tone += 0.15;
    }
  };
}

/** The tinted glass band: dark glass, sky glints, the driver's silhouette, black pillars. */
function glassBand(c: HdCanvas, g: CarGeo, m: Mats, ox: number, oy: number, driverX: number | null): void {
  const b = g.band;
  let xa = Infinity;
  let xb = -Infinity;
  let ya = Infinity;
  let yb = -Infinity;
  for (const [px, py] of b) {
    xa = Math.min(xa, px);
    xb = Math.max(xb, px);
    ya = Math.min(ya, py);
    yb = Math.max(yb, py);
  }
  const isPillar = (x: number): boolean => {
    for (const [p0, p1] of g.pillars) if (x >= p0 && x < p1) return true;
    return false;
  };
  // The glass: nearly flat, a little round toward the top (tumblehome).
  field(c, ox, oy, xa - 0.5, ya - 0.5, xb - xa + 1, yb - ya + 1, (x, y) => (inPoly(x, y, b) && !isPillar(x) ? (y - ya) * 0.15 : NaN), {
    mat: m.glass,
    z: 1.05,
    tex: (t) => {
      const x = t.x + ox;
      const y = t.y + oy;
      // A head and shoulders through the glass (the driver), darker than the glass.
      if (driverX !== null) {
        const hx = x - driverX;
        const hy = y - (g.belt - 4.1);
        if (hx * hx / 4.4 + hy * hy / 6.2 < 1 || (y > g.belt - 2.2 && Math.abs(hx + 0.6) < 3.6)) t.tone -= 0.6;
      }
      // Two diagonal glints per window (sky light), fading toward the bottom.
      const u = frac((x + (y - yb) * 0.7) / 13);
      if (u < 0.1) t.tone += 0.9;
      else if (u > 0.16 && u < 0.2) t.tone += 0.5;
    },
  });
  // Pillars: glossy black over the band.
  for (const [p0, p1] of g.pillars) {
    field(c, ox, oy, p0 - 0.5, ya - 0.5, p1 - p0 + 1, yb - ya + 1, (x, y) => (x >= p0 && x < p1 && inPoly(x, y, b) ? 0.5 : NaN), { mat: m.black, z: 2.4 });
  }
  // The window seal under the glass (a dark line along the belt).
  field(c, ox, oy, xa - 0.5, g.belt - 0.6, xb - xa + 1, 1.2, (x, y) => (inPoly(x, y - 0.8, b) && !inPoly(x, y, b) ? 0.3 : NaN), { mat: m.black, z: 1.08 });
}

/** The black lower parts: sill, bumpers, rubbing strip, wheel wells. */
function lowerTrim(c: HdCanvas, g: CarGeo, m: Mats, ox: number, oy: number, d: number, strip: boolean): void {
  const L = g.len / 2;
  const ar = archR(g);
  const poly = g.cab ?? g.profile;
  // Wheel wells: the dark arch behind each wheel.
  for (let i = 0; i < g.wheels.length; i++) {
    const [cx, cy] = wheelCentre(g, i);
    field(c, ox, oy, cx - ar, cy - ar, ar * 2, ar - cy, (x, y) => (Math.hypot(x - cx, y - cy) < ar && y < -1.6 ? 0 : NaN), { mat: m.well, z: 0.3 });
  }
  // The sill: a dark plastic strip under the doors, between the arches.
  const sx0 = g.wheels[0] + ar - 0.5;
  const sx1 = g.wheels[g.wheels.length - 1] - ar + 1.5;
  const sy = g.model === 'box-truck' ? g.sill : -4.8;
  field(c, ox, oy, sx0, sy, sx1 - sx0, -2.2 - sy, (x, y) => (inPoly(x, y, g.profile) || (g.cab ? inPoly(x, y, g.cab) : false) ? (y - sy) * -0.25 + 0.5 : NaN), {
    mat: m.plastic,
    z: ZD,
  });
  // Bumpers: the front one wraps the nose, the rear one the tail.
  const bumper = (xa: number, xb: number): void => {
    field(c, ox, oy, xa, -10, xb - xa, 7, (x, y) => (y > -9.2 && y < -3 && inPoly(x, y, poly) ? roll(Math.min(y + 9.2, -3 - y), 1.2) : NaN), {
      mat: m.plastic,
      z: ZD,
    });
  };
  if (g.model !== 'box-truck') bumper(-L - 0.5, -L + 4.5);
  bumper(L - 4.5, L + 0.5);
  // A rubbing strip along the doors (cars).
  if (strip) {
    const ys = g.sill - 3.2;
    field(c, ox, oy, -L + 4, ys - 0.7, g.len - 8, 1.4, (x, y) => (Math.abs(y - ys) < (d === 1 ? 0.5 : 0.55) && inPoly(x, y, poly) && wheelDist(g, x, y) > ar + 0.8 ? 0.4 : NaN), {
      mat: m.black,
      z: ZD + 0.2,
    });
  }
}

/** Lights, mirror and handles. */
function fittings(c: HdCanvas, g: CarGeo, m: Mats, ox: number, oy: number, d: number): void {
  const [hx0, hy0, hx1, hy1] = g.head;
  c.box(hx0 - ox - 0.4, hy0 - oy - 0.4, hx1 - hx0 + 0.8, hy1 - hy0 + 0.8, { mat: m.black, z: ZD, r: 0.4 });
  c.box(hx0 - ox, hy0 - oy, hx1 - hx0, hy1 - hy0, { mat: m.head, z: ZD + 0.3, r: 0.5, bevel: 0.5 });
  if (d > 1) c.dot(hx0 - ox + 0.6, hy0 - oy + 0.5, top('snow', d));
  // An amber side repeater behind the front wheel arch (small cars) or on the wing.
  const [tx0, ty0, tx1, ty1] = g.tail;
  c.box(tx0 - ox, ty0 - oy, tx1 - tx0, ty1 - ty0, { mat: m.tail, z: ZD + 0.3, r: 0.4, bevel: 0.5 });
  if (d > 1) c.dot(tx0 - ox + 0.5, ty0 - oy + 0.6, top('red', d, 1));
  const [mx, my] = g.mirror;
  c.ellipsoid(mx - ox, my - oy, 1.7, 1.15, { mat: m.black, z: ZD + 0.8 });
  c.capsule(mx - ox - 1.2, my - oy + 0.7, mx - ox - 2.2, my - oy + 1.4, 0.45, 0.4, { mat: m.black, z: ZD + 0.6 });
  for (const [x, y] of g.handles) c.box(x - ox - 1.1, y - oy - 0.35, 2.2, d === 1 ? 1 : 0.75, { mat: m.black, z: ZD + 0.1, r: 0.3 });
}

/** The taxi's lit roof sign: TAXI in black on a warm yellow lamp. */
function taxiSign(c: HdCanvas, ox: number, oy: number, d: number): void {
  const lamp = mat(c, 'gold', { spec: 0.8, shine: 40, lo1: 2, hi1: 3, lo: 4, hi: 6, flat: false });
  const base = mat(c, 'black', { spec: 0.4, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  c.box(-6.5 - ox, -26.6 - oy, 13, 1.4, { mat: base, z: ZD, r: 0.3 });
  c.box(-6 - ox, -31.2 - oy, 12, 4.8, { mat: lamp, z: ZD + 0.2, r: 1.2, bevel: 0.9 });
  const s = d === 1 ? 1 : 0.62;
  const ink = bot('black', d, 0);
  c.paint(-6 - ox, -31.2 - oy, 12, 4.8, (x, y) => (glyphHitC('TAXI', -ox + 0, -28.8 - oy, s, 1, x, y) ? ink : 0));
}

/** The camper's extras: stripes in the paint colour, windows, the door, the alcove window, a roof hatch. */
/** The camper's stripes (a wide band low, sweeping up over the cab door; a thin one high). */
function camperStripe(x: number, y: number): boolean {
  const ya = -19.4 - Math.max(0, x - 18) * 0.12;
  return (y > ya && y < ya + 3.4) || (y > -41.4 && y < -40.2);
}

function camperExtras(c: HdCanvas, m: Mats, ox: number, oy: number): void {
  const frame = mat(c, 'gable', { spec: 0.4, lo1: 1, hi1: 2, lo: 1, hi: 3 });
  // Windows: dark glass in a white frame.
  const win = (x: number, y: number, w: number, h: number): void => {
    c.box(x - ox - 0.7, y - oy - 0.7, w + 1.4, h + 1.4, { mat: frame, z: ZD, r: 0.8, bevel: 0.5 });
    c.box(x - ox, y - oy, w, h, {
      mat: m.glass,
      z: ZD + 0.3,
      r: 0.6,
      tex: (t) => {
        const u = frac((t.x + ox + (t.y + oy) * 0.7) / 11);
        if (u < 0.12) t.tone += 0.8;
      },
    });
  };
  win(-48, -37, 13, 8);
  win(-24, -37, 15, 8);
  win(7.4, -34.6, 6.4, 8.4);
  win(22, -44.4, 10, 3.4);
  // The roof hatch.
  c.box(-18 - ox, -48 - oy, 11, 2.2, { mat: frame, z: ZD, r: 0.6, bevel: 0.6 });
  // A step under the door.
  c.box(5 - ox, -6.2 - oy, 12, 1.6, { mat: m.plastic, z: ZD, r: 0.3 });
}

/** The van's extras: the pressed rib along the cargo side, the sliding door's rail, the step. */
function vanExtras(c: HdCanvas, m: Mats, ox: number, oy: number, d: number): void {
  c.box(-24.6 - ox, -30.6 - oy, 15.4, d === 1 ? 1 : 0.6, { mat: m.black, z: ZD, r: 0.2 });
  c.box(-24 - ox, -6.6 - oy, 14, 1.5, { mat: m.plastic, z: ZD, r: 0.3 });
}

/** The box truck's extras: the stripe on the box, the rear roll door, the chassis, the side guard. */
function truckExtras(c: HdCanvas, colour: string, m: Mats, ox: number, oy: number, d: number): void {
  const steel = mat(c, 'steel', { spec: 0.9, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  // A made-up arrow mark on the box (no real logo; the band is the body's texture).
  const arrowAt = (x: number, y: number): boolean => {
    const u = x + 30;
    const v = y + 36;
    return (u > -4 && u < 3 && Math.abs(v) < 1.1) || (u >= 3 && u < 7 && Math.abs(v) < 4 - (u - 3));
  };
  c.paint(-38 - ox, -42 - oy, 16, 12, (x, y) => (arrowAt(x + ox, y + oy) ? top(colour === 'gable' ? 'navy' : colour, d, 2) : 0));
  // The roll door's ribs at the rear end.
  const hw = lineW(d);
  c.paint(-58 - ox, -49 - oy, 5, 40, (x, y) => (frac((y + oy) / 3.2) < hw / 1.6 && x + ox < -54.6 ? bot('stone', d, 1) : 0), 1.5);
  // The chassis beam under the box, the side guard rails between the wheels, a mud flap.
  c.box(-56 - ox, -9.4 - oy, 82, 3.4, { mat: m.black, z: 0.8, r: 0.3 });
  for (const gy of [-8.6, -5.6]) c.box(-29 - ox, gy - oy, 59, d === 1 ? 1 : 0.9, { mat: steel, z: ZD, r: 0.3 });
  for (const gx of [-29, -6, 17, 29]) c.box(gx - ox, -9 - oy, d === 1 ? 1 : 0.9, 4.4, { mat: steel, z: ZD - 0.1, r: 0.2 });
  c.box(-47.4 - ox, -9 - oy, 2, 7, { mat: m.plastic, z: ZD, r: 0.3 });
  // The cab step.
  c.box(28 - ox, -6.4 - oy, 8, 1.6, { mat: m.plastic, z: ZD, r: 0.3 });
}

/** The body of a model in a paint colour (see the header). */
export function carFrame(model: CarGeo['model'], colour: string, d: Dn): Frame {
  const g = CAR_GEO[model];
  const box = carBox(g);
  const ox = box.x0;
  const oy = box.y0;
  const c = new HdCanvas(box.w, box.h, d);
  const m = mats(c);
  const bodyColour = model === 'camper' || model === 'box-truck' ? 'gable' : colour;
  const paint = paintMat(c, bodyColour);
  const stripe = model === 'camper' || model === 'box-truck' ? paintMat(c, colour) : paint;
  const part = c.newPart();
  const seams = seamTex(g, d, g.model === 'van' || g.model === 'box-truck' ? -40 : g.belt - 0.5);
  const bandTop = Math.min(...g.band.map((p) => p[1]));
  body(c, g, g.profile, paint, ox, oy, part, undefined, (t, x, y) => {
    seams(t, x, y);
    // The van's pressed rib along the cargo side.
    if (model === 'van' && x < 12 && Math.abs(y + 27.4) < 1.2) t.tone += y < -27.4 ? 0.25 : -0.3;
    if (model === 'camper' && camperStripe(x, y)) t.mat = stripe;
    if (model === 'box-truck' && y > -25 && y < -20.6) t.mat = stripe;
    // A sky reflection along the roof's top face.
    if (y < bandTop - 0.6 && y > bandTop - 2.2 && model !== 'box-truck') t.tone += 0.1;
    // The horizon in the gloss of the doors: sky above a crisp line, the dark road below it.
    if (model !== 'box-truck' && y > g.belt + 1.6 && y < g.sill) {
      const hy = g.belt + (g.sill - g.belt) * 0.42 + Math.sin(x * 0.21) * 0.25;
      t.tone += y < hy ? 0.12 : -0.22;
    }
  });
  if (g.cab) {
    const cabPaint = paintMat(c, colour);
    body(c, g, g.cab, cabPaint, ox, oy, c.newPart(), undefined, seams);
  }
  // The driver sits at the front side window.
  const front = g.band.reduce((a, p) => Math.max(a, p[0]), -Infinity);
  const driverX = model === 'van' || model === 'box-truck' || model === 'camper' ? front - 8 : front - 9.5;
  glassBand(c, g, m, ox, oy, driverX);
  lowerTrim(c, g, m, ox, oy, d, model === 'hatch' || model === 'estate' || model === 'taxi');
  fittings(c, g, m, ox, oy, d);
  if (model === 'taxi') taxiSign(c, ox, oy, d);
  else if (model === 'camper') camperExtras(c, m, ox, oy);
  else if (model === 'van') vanExtras(c, m, ox, oy, d);
  else if (model === 'box-truck') truckExtras(c, colour, m, ox, oy, d);
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}

function frameOf(buf: PixelBuffer, ox: number, oy: number, d: Dn): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

// ---------------------------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------------------------

/** Half size k of a wheel frame (2k + 1 square, centre px k). */
export function wheelK(size: WheelSize): number {
  return Math.ceil(WHEEL_R[size]) + 1;
}

/** A wheel turned by `f` × 18° (four frames cover the five-fold rim's 72°). */
export function wheelFrame(size: WheelSize, f: number, d: Dn): Frame {
  const r = WHEEL_R[size];
  const k = wheelK(size);
  const n = 2 * k + 1;
  const c = new HdCanvas(n, n, d);
  const cx = k + 0.5;
  const cy = k + 0.5;
  const tyre = mat(c, 'black', { spec: 0.35, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const rim = mat(c, 'steel', { spec: 1.1, shine: 46, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.3 });
  const hub = mat(c, 'steel', { spec: 0.6, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const rr = r * 0.6;
  const a0 = (f * 18 * Math.PI) / 180;
  c.ellipsoid(cx, cy, r, r, {
    mat: tyre,
    z: 1,
    round: 0.45,
    tex: (t) => {
      // Tread blocks round the edge (they turn with the frame).
      const dx = t.x - cx;
      const dy = t.y - cy;
      const rd = Math.hypot(dx, dy);
      if (rd > r - 0.7 && d > 1) {
        const a = Math.atan2(dy, dx) - a0;
        if (frac((a / (Math.PI * 2)) * 20) < 0.3) t.tone -= 0.3;
      }
    },
  });
  c.ellipsoid(cx, cy, rr, rr, {
    mat: rim,
    z: 1 + r + 1,
    round: 0.5,
    tex: (t) => {
      const dx = t.x - cx;
      const dy = t.y - cy;
      const rd = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) - a0;
      // Five lightening holes between the spokes, a dark ring at the rim's lip.
      const u = frac((a / (Math.PI * 2)) * 5);
      if (rd > rr * 0.42 && rd < rr * 0.8 && u > 0.25 && u < 0.75) t.tone -= 0.9;
      if (rd > rr - (d === 1 ? 0.6 : 0.35)) t.tone -= 0.35;
    },
  });
  c.ellipsoid(cx, cy, rr * 0.34, rr * 0.34, { mat: hub, z: 1 + r + 3 });
  const buf = finishA(c, 0.25);
  return frameOf(buf, k, k, d);
}

// ---------------------------------------------------------------------------------------------
// Dents (decals on the paint)
// ---------------------------------------------------------------------------------------------

/** Decal i (0 small dent, 1 crumple, 2 scrape, 3 glass crack), centre anchor. */
export function dentFrame(i: number, d: Dn): Frame {
  const n = i === 2 ? 11 : 9;
  const k = (n - 1) / 2;
  const c = new HdCanvas(n, n, d);
  const cx = k + 0.5;
  const cy = k + 0.5;
  const dark = bot('black', d, d === 1 ? 1 : 2);
  const shade = bot('stone', d, d === 1 ? 0 : 1);
  const light = top('snow', d, d === 1 ? 1 : 2);
  const primer = top('stone', d, d === 1 ? 1 : 2);
  const glint = top('snow', d);
  c.paint(0, 0, n, n, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    if (i === 0 || i === 1) {
      // A dish: lit on its lower right inner wall, shaded on the upper left (seen as a hollow).
      const rx = i === 0 ? 2.4 : 3.6;
      const ry = i === 0 ? 1.7 : 2.6;
      const q = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (q >= 1) return 0;
      const s = dx * 0.6 + dy * 0.8;
      if (i === 1 && Math.abs(dx - dy * 0.4) < 0.4 && q < 0.8) return dark;
      if (q > 0.45 && s < -0.4) return shade;
      if (q > 0.45 && s > 0.6) return light;
      if (q < 0.2 && i === 1) return shade;
      return 0;
    }
    if (i === 2) {
      // A scrape: a ragged streak down to the grey primer with a dark lip.
      const v = dy + dx * 0.12;
      const len = Math.abs(dx) < 4.6;
      if (!len) return 0;
      if (Math.abs(v) < 0.55) return primer;
      if (v >= 0.55 && v < 1.1 && frac(Math.sin(x * 3.1) * 43.7) > 0.4) return shade;
      if (v <= -0.55 && v > -1.0 && d > 1 && frac(Math.sin(x * 5.3) * 17.1) > 0.6) return light;
      return 0;
    }
    // A crack star in the glass: thin light lines from the impact point.
    const r = Math.hypot(dx, dy);
    if (r < 0.7) return glint;
    if (r > 3.9) return 0;
    const a = Math.atan2(dy, dx);
    for (const ra of [0.3, 1.5, 2.6, 3.9, 5.1]) {
      let da = Math.abs(a - (ra - Math.PI));
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da * r < (d === 1 ? 0.5 : 0.32)) return light;
    }
    if (Math.abs(r - 2.4) < (d === 1 ? 0.5 : 0.25) && frac(a * 1.7) < 0.5) return light;
    return 0;
  });
  const buf = c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false });
  return frameOf(buf, k, k, d);
}

// ---------------------------------------------------------------------------------------------
// The hostage van: the open rear and the cage door
// ---------------------------------------------------------------------------------------------

/** Canvas of the van-anchored overlays: x −60 … −18, y −42 … +1. */
const VX0 = -60;
const VY0 = -42;

/** The open rear: the near door swung out behind the van, the dark hold. */
export function vanOpenFrame(colour: string, d: Dn): Frame {
  const c = new HdCanvas(42, 43, d);
  const [hx0, hy0, hx1, hy1] = HOSTAGE_VAN.hold;
  const ox = VX0;
  const oy = VY0;
  const hold = mat(c, 'stone', { spec: 0, lo1: 0, hi1: 1, lo: 0, hi: 2, amb: 0.3 });
  const floor = mat(c, 'stone', { spec: 0.2, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const inner = mat(c, 'stone', { spec: 0.3, lo1: 1, hi1: 2, lo: 2, hi: 4 });
  const paint = paintMat(c, colour);
  const m = mats(c);
  // The hold: dark inside with a lit far wall corner and a floor.
  c.box(hx0 - ox, hy0 - oy, hx1 - hx0, hy1 - hy0, {
    mat: hold,
    z: 1.4,
    round: 0,
    tex: (t) => {
      const x = t.x + ox;
      const y = t.y + oy;
      if (x > hx1 - 3) t.tone += 0.35 * ((x - (hx1 - 3)) / 3);
      if (y < hy0 + 2) t.tone += 0.2;
    },
  });
  c.box(hx0 - ox, hy1 - oy - 1.6, hx1 - hx0, 1.6, { mat: floor, z: 1.5, round: 0.3 });
  // The door frame round the opening (body paint, a rolled lip).
  field(c, ox, oy, hx0 - 1.2, hy0 - 1.2, hx1 - hx0 + 2.4, hy1 - hy0 + 2, (x, y) => {
    const inHold = x > hx0 && x < hx1 && y > hy0 && y < hy1;
    const inFrame = x > hx0 - 1.2 && x < hx1 + 1.2 && y > hy0 - 1.2 && y < hy1 + 0.6;
    return inFrame && !inHold ? roll(Math.min(Math.abs(x - hx0), Math.abs(x - hx1), Math.abs(y - hy0)) + 0.2, 1) : NaN;
  }, { mat: paint, z: 1.6 });
  // The near rear door, swung out about 60°: a foreshortened panel hinged at the van's rear edge,
  // its inner face (grey lining) toward us, a small window up top.
  const hinge = -44.2;
  const dw = 11;
  const doorPoly: Pt[] = [[hinge, -38.6], [hinge - dw, -36.8], [hinge - dw, -7.6], [hinge, -6.4]];
  field(c, ox, oy, hinge - dw - 0.5, -39, dw + 1, 33, (x, y) => (inPoly(x, y, doorPoly) ? roll(polyDist(x, y, doorPoly), 1.2) + (hinge - x) * 0.05 : NaN), {
    mat: inner,
    z: 2,
    tex: (t) => {
      const x = t.x + ox;
      const y = t.y + oy;
      // Lining panels (pressed rectangles).
      const e = polyDist(x, y, doorPoly);
      if (e > 1.6 && e < 2.0) t.tone -= 0.35;
    },
  });
  // The door's window (dark glass) and its paint edge on the outer skin (a sliver).
  const winPoly: Pt[] = [[hinge - 2, -35.4], [hinge - dw + 2, -34.2], [hinge - dw + 2, -26.6], [hinge - 2, -27]];
  field(c, ox, oy, hinge - dw, -36, dw, 10, (x, y) => (inPoly(x, y, winPoly) ? 0.4 : NaN), { mat: m.glass, z: 2.2 });
  field(c, ox, oy, hinge - dw - 0.8, -37.4, 1.4, 31, (x, y) => (x < hinge - dw + 0.6 && inPoly(x + 1, y, doorPoly) ? 0.3 : NaN), { mat: paint, z: 2.3 });
  // The tail light on the door's edge and a hinge.
  c.box(hinge - dw - 0.7 - ox, -24 - oy, 1.4, 6, { mat: m.tail, z: 2.4, r: 0.3 });
  c.box(hinge - 1 - ox, -33 - oy, 1.4, 2, { mat: m.black, z: 2.4, r: 0.2 });
  c.box(hinge - 1 - ox, -13 - oy, 1.4, 2, { mat: m.black, z: 2.4, r: 0.2 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}

/** The cage door over the hold (0 shut, 1 dented: a bent bar, a broken hinge). */
export function cageFrame(state: number, d: Dn): Frame {
  const [hx0, hy0, hx1, hy1] = HOSTAGE_VAN.hold;
  const c = new HdCanvas(42, 43, d);
  const ox = VX0;
  const oy = VY0;
  const steel = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const lock = mat(c, 'gold', { spec: 1.1, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  const bend = (x: number, y: number): number => (state === 1 ? Math.exp(-(((x - (hx0 + 9)) / 2.5) ** 2) - (((y - (hy0 + 16)) / 6) ** 2)) * 1.6 : 0);
  // The frame (four tubes) and the bars.
  const x0 = hx0 + 0.6;
  const x1 = hx1 - 0.6;
  const y0 = hy0 + 0.6;
  const y1 = hy1 - 0.4;
  const tube = (ax: number, ay: number, bx: number, by: number, r: number): void => {
    c.capsule(ax - ox, ay - oy, bx - ox, by - oy, r, r, { mat: steel, z: 3 });
  };
  // A frame of tubes, one cross bar low (the hostage's face stays in view) and three bars.
  const ym = y0 + (y1 - y0) * 0.62;
  tube(x0, y0, x1, y0, 0.7);
  tube(x0, y1, x1, y1, 0.7);
  tube(x0, y0, x0, y1, 0.7);
  tube(x1, y0, x1, y1, 0.7);
  tube(x0, ym, x1, ym, 0.5);
  for (let i = 1; i <= 3; i++) {
    const bx = x0 + ((x1 - x0) * i) / 4;
    const kx = bend(bx, ym);
    c.capsule(bx - ox, y0 - oy, bx + kx - ox, ym - oy, 0.4, 0.4, { mat: steel, z: 2.8 });
    c.capsule(bx + kx - ox, ym - oy, bx - ox, y1 - oy, 0.4, 0.4, { mat: steel, z: 2.8 });
  }
  // The padlock on the front edge.
  c.box(x1 - 2.4 - ox, ym - oy + 0.6, 3, 3, { mat: lock, z: 3.4, r: 0.7, bevel: 0.6 });
  c.capsule(x1 - 1.6 - ox, ym - oy + 0.6, x1 - 1 - ox, ym - oy - 1, 0.4, 0.4, { mat: steel, z: 3.3 });
  // Thin bars in the van's door frame: no ink outline (it would hide the hostage behind them).
  const buf = c.render({ outline: 'none', ink: INK, ao: 0.2, rimLight: d === 1 ? 0 : 2, sep: false });
  return frameOf(buf, -ox, -oy, d);
}

/**
 * The shot-off barred door falling (DOOR_FALL frames): it tips over toward the camera about its
 * sill (the hinges and the lock are shot off) and lands flat on the road. Frame 0 is the door
 * upright in its opening, exactly where the carrier drew it; then 24°, 48° (foreshortened, the
 * hinge side dropping first), 78° (past edge-on: nearly flat) and flat (90°: a low slab).
 * `box` is the bars' outer box in carrier-local px (tube centres: x0, y0, x1, y1), `n` the bar
 * divisions (n − 1 bars, as the door in place), `bend` the dented bar's x (local). The anchor is
 * `doorFallAnchor(box)`: under the middle of the door once it lies flat.
 */
export function doorFallFrame(box: readonly [number, number, number, number], n: number, bend: number, f: number, d: Dn): Frame {
  const [x0, y0, x1, y1] = box;
  const { ax, ay } = doorFallAnchor(box);
  const cx = (x0 + x1) / 2;
  const h = y1 - y0;
  const ox = Math.floor(x0) - 6;
  const oy = Math.floor(y0) - 4;
  const c = new HdCanvas(Math.ceil(x1) + 6 - ox, Math.ceil(y1 + DOOR_FALL.k * h) + 5 - oy, d);
  const steel = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const dark = mat(c, 'steel', { spec: 0.6, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const th = (DOOR_FALL.deg[f] * Math.PI) / 180;
  const ro = (DOOR_FALL.roll[f] * Math.PI) / 180;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const cr = Math.cos(ro);
  const sr = Math.sin(ro);
  // A door point (local x, height v over the sill) → canvas px: tipped toward us by th about the
  // sill (the depth it gains shows k as much as a height), then rolled by ro about the sill's middle.
  const P = (x: number, v: number): [number, number] => {
    const sx = x - cx;
    const sy = -v * ct + DOOR_FALL.k * v * st;
    return [cx + sx * cr - sy * sr - ox, y1 + sx * sr + sy * cr - oy];
  };
  const seg = (xa: number, va: number, xb: number, vb: number, r: number, z: number, m = steel): void => {
    const [px, py] = P(xa, va);
    const [qx, qy] = P(xb, vb);
    c.capsule(px, py, qx, qy, r, r, { mat: m, z });
  };
  // The frame, the low cross bar and the bars (one bent where the shots dented it).
  const vm = h * 0.38;
  seg(x0, h, x1, h, 0.7, 3);
  seg(x0, 0, x1, 0, 0.7, 3);
  seg(x0, 0, x0, h, 0.7, 3);
  seg(x1, 0, x1, h, 0.7, 3);
  seg(x0, vm, x1, vm, 0.5, 3);
  for (let i = 1; i < n; i++) {
    const bx = x0 + ((x1 - x0) * i) / n;
    const kx = Math.exp(-(((bx - bend) / 2.5) ** 2)) * 1.6;
    seg(bx, h, bx + kx, vm, 0.4, 2.8);
    seg(bx + kx, vm, bx, 0, 0.4, 2.8);
  }
  // The torn hinge plates on the hinge side and the broken hasp on the lock side: it reads as a door.
  for (const v of [h * 0.18, h * 0.82]) seg(x0 - 0.6, v - 1.1, x0 - 0.6, v + 1.1, 0.75, 3.2, dark);
  seg(x1 - 1.2, vm - 1.4, x1 - 1.2, vm - 3.6, 0.55, 3.3, dark);
  const buf = finishA(c, 0.25);
  return frameOf(buf, ax - ox, ay - oy, d);
}

/** The shot-off cage door of the hostage van falling (5, DOOR_FALL; its dented bar as `cageFrame`'s). */
export function cageFallFrame(f: number, d: Dn): Frame {
  return doorFallFrame(doorBox(HOSTAGE_VAN.hold), 4, HOSTAGE_VAN.hold[0] + 9, f, d);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const F4 = [0, 1, 2, 3];

for (const g of Object.values(CAR_GEO)) {
  for (const colour of g.colours) {
    const id = carSprite(g.model, colour);
    defineSprite(id, () => [carFrame(g.model, colour, 1)], { hd: (d) => [carFrame(g.model, colour, d)] });
  }
}
for (const size of ['s', 'm', 'l'] as const) {
  defineSprite(`ring/car/wheel-${size}`, () => F4.map((f) => wheelFrame(size, f, 1)), { hd: (d) => F4.map((f) => wheelFrame(size, f, d)) });
}
defineSprite('ring/car/dent', () => F4.map((i) => dentFrame(i, 1)), { hd: (d) => F4.map((i) => dentFrame(i, d)) });
for (const colour of CAR_GEO.van.colours) {
  defineSprite(`ring/car/van-open-${colour}`, () => [vanOpenFrame(colour, 1)], { hd: (d) => [vanOpenFrame(colour, d)] });
}
defineSprite('ring/car/cage', () => [0, 1].map((s) => cageFrame(s, 1)), { hd: (d) => [0, 1].map((s) => cageFrame(s, d)) });
const F5 = [0, 1, 2, 3, 4];
defineSprite('ring/car/cage-fall', () => F5.map((f) => cageFallFrame(f, 1)), { ticksPerFrame: 3, loop: false, defer: true, hd: (d) => F5.map((f) => cageFallFrame(f, d)) });
