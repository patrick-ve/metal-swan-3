/**
 * The parcel van's vehicle art (docs/design/ring.md §5.2; docs/ART_GUIDE.md "UHD art"): ONE
 * density-generic drawer per strip (art-kit.ts), outline A, facing right only (the lettering never
 * mirrors). Our own courier livery: `ZOEF!` / `PAKKETTEN` on a teal high-roof van with a pink
 * stripe and a parcel icon; no badge, no plate in view (side view).
 *
 * - `ring/parcel-van/body` (2, the van anchor): 0 the van, 1 beaten (soot, cracked glass, the front
 *   bumper hanging, the stripe scraped). Dents in between are the shared `ring/car/dent` decals.
 * - `ring/parcel-van/rear` (3, the van anchor): the near rear door swinging out (28°, 58°, 86°)
 *   and the cargo hold opening up behind it (a stack of parcels against the front wall).
 * - `ring/parcel-van/brake` (2): 0 the lit brake lights (the tall rear lamp, the third light over
 *   the doors), 1 their glow (drawn additive by the van).
 * - `ring/parcel-van/grille` (2: shut, dented): the steel grille the gang bolted over the hold (the
 *   hostage's door; items/hostage.ts tumbles the shared cage door off when it is shot open).
 */
import { INK } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { field, frac, frameOf, lettering, lineW, mats, paintMat, roll, volume, wells, type VolumeGeo } from './art-kit';
import { VAN, type Pt } from './geometry';

/** The van frame canvas: x −49 … 48, y −45 … +1. */
const BX0 = -49;
const BY0 = -45;
const BW = 97;
const BH = 46;

/** Depth of the fittings over the painted body. */
const ZD = 5;

const GEO: VolumeGeo = { wheels: VAN.wheels, wheelR: VAN.wheelR, holes: [VAN.band], belt: VAN.belt, sill: VAN.sill };

/** Cheap value noise for soot blotches (deterministic). */
function blot(x: number, y: number): number {
  const s = Math.sin(x * 0.37 + y * 0.71) * 0.5 + Math.sin(x * 0.13 - y * 0.29 + 1.7) * 0.5;
  return s;
}

/** The van body: 0 clean, 1 beaten. */
export function vanBodyFrame(state: number, d: Dn): Frame {
  const c = new HdCanvas(BW, BH, d);
  const ox = BX0;
  const oy = BY0;
  const m = mats(c);
  const paint = paintMat(c, 'teal');
  const pink = mat(c, 'pink', { spec: 0.9, shine: 44, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const scrape = mat(c, 'steel', { spec: 0.5, shine: 20, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const beaten = state >= 1;
  const hw = lineW(d);
  const bandTop = Math.min(...VAN.band.map((p) => p[1]));
  wells(c, GEO, m, ox, oy);
  volume(c, GEO, VAN.profile, paint, ox, oy, c.newPart(), (t, x, y) => {
    // Shut lines: the cab door, the sliding door (its rail at the belt), the rear pillar.
    if (y > -41 && y < VAN.sill + 0.5) {
      for (const sx of VAN.seams) {
        const dx = x - sx;
        if (Math.abs(dx) < hw) t.tone -= 0.75;
        else if (d === 4 && dx > -hw * 3 && dx < -hw) t.tone += 0.15;
      }
      if (Math.abs(x + 44.2) < hw) t.tone -= 0.6;
    }
    // A pressed rib along the cargo side (the roof's rain gutter line).
    if (x < 12 && Math.abs(y + 39.2) < 0.7) t.tone += y < -39.2 ? 0.2 : -0.3;
    // The pink stripe low along the side (scraped on a beaten van).
    if (y > -14.2 && y < -10.8 && x < 40) {
      t.mat = beaten && x > 20 && x < 36 && frac(x * 0.21) < 0.6 ? scrape : pink;
    }
    // Sky in the roof's top face; the horizon in the gloss of the doors.
    if (y < bandTop - 0.6 && y > bandTop - 2.6) t.tone += 0.1;
    if (y > -24 && y < VAN.sill && x < 40) {
      const hy = -16.6 + Math.sin(x * 0.21) * 0.25;
      if (y < -14.2 || y > -10.8) t.tone += y < hy ? 0.1 : -0.2;
    }
    if (beaten) {
      // Soot round the nose and the wheel arches, a dark smear along the rear.
      const n = blot(x, y);
      const nose = Math.max(0, (x - 26) / 20);
      const arch = Math.max(0, 1 - Math.abs(Math.hypot(x - 30.5, y + 6.5) - 9) / 3);
      if (n + nose * 0.9 + arch * 0.6 > 0.95) t.tone -= 0.55;
      else if (n > 0.6 && x < -30) t.tone -= 0.3;
    }
  });
  // The cab glass: dark, two glints per pane, the driver's head and shoulders; cracked when beaten.
  const g = VAN.band;
  field(c, ox, oy, 14.5, -39.5, 16, 14.5, (x, y) => (inPoly(x, y, g) && !(x >= 15 && x < 16.4) ? (y + 39) * 0.15 : NaN), {
    mat: m.glass,
    z: 1.05,
    tex: (t) => {
      const x = t.x + ox;
      const y = t.y + oy;
      const hx = x - 21.6;
      const hy = y - (VAN.belt - 4.4);
      if ((hx * hx) / 4.4 + (hy * hy) / 6.2 < 1 || (y > VAN.belt - 2.4 && Math.abs(hx + 0.6) < 3.8)) t.tone -= 0.6;
      const u = frac((x + (y + 25.8) * 0.7) / 11);
      if (u < 0.1) t.tone += 0.9;
      else if (u > 0.16 && u < 0.2) t.tone += 0.5;
      if (beaten) {
        const r = Math.hypot(x - 22.4, y + 31.4);
        const a = Math.atan2(y + 31.4, x - 22.4);
        if (r < 6 && frac(a * 0.95 + 0.1) < (d === 1 ? 0.12 : 0.07)) t.tone += 1.1;
      }
    },
  });
  // The B-pillar, the window seal.
  field(c, ox, oy, 14.5, -38, 2.4, 13, (x, y) => (x >= 15 && x < 16.4 && inPoly(x, y, g) ? 0.5 : NaN), { mat: m.black, z: 2.4 });
  field(c, ox, oy, 14.5, VAN.belt - 0.6, 16, 1.2, (x, y) => (inPoly(x, y - 0.8, g) && !inPoly(x, y, g) ? 0.3 : NaN), { mat: m.black, z: 1.08 });
  // The sill between the arches, the bumpers (the front one hangs on a beaten van).
  const ar = VAN.wheelR + 1.2;
  const sx0 = VAN.wheels[0] + ar - 0.5;
  const sx1 = VAN.wheels[1] - ar + 1.5;
  field(c, ox, oy, sx0, -4.8, sx1 - sx0, 2.6, (x, y) => (inPoly(x, y, VAN.profile) ? (y + 4.8) * -0.25 + 0.5 : NaN), { mat: m.plastic, z: ZD });
  const rear: Pt[] = [[-46.8, -10.2], [-41.6, -10.2], [-41.6, -3], [-46.8, -3]];
  const front: Pt[] = beaten ? [[41.2, -10.4], [46.8, -8.4], [45.6, -1.4], [41.2, -3.2]] : [[41.4, -10.2], [46.8, -10.2], [46.8, -3], [41.4, -3]];
  for (const b of [rear, front]) {
    field(c, ox, oy, -48, -11, 96, 10, (x, y) => (inPoly(x, y, b) ? roll(polyDist(x, y, b), 1.2) : NaN), { mat: m.plastic, z: ZD });
  }
  // A step under the sliding door.
  c.box(-10 - ox, -6.6 - oy, 14, 1.5, { mat: m.plastic, z: ZD, r: 0.3 });
  // Lamps: the headlight, the tall rear lamp, the third brake light (off), the amber repeater.
  const [hx0, hy0, hx1, hy1] = VAN.head;
  c.box(hx0 - ox - 0.4, hy0 - oy - 0.4, hx1 - hx0 + 0.8, hy1 - hy0 + 0.8, { mat: m.black, z: ZD, r: 0.4 });
  c.box(hx0 - ox, hy0 - oy, hx1 - hx0, hy1 - hy0, { mat: m.head, z: ZD + 0.3, r: 0.5, bevel: 0.5 });
  if (d > 1 && !beaten) c.dot(hx0 - ox + 0.6, hy0 - oy + 0.5, top('snow', d));
  const [tx0, ty0, tx1, ty1] = VAN.tail;
  c.box(tx0 - ox, ty0 - oy, tx1 - tx0, ty1 - ty0, { mat: m.tail, z: ZD + 0.3, r: 0.4, bevel: 0.5, tone: -0.25 });
  const [rx0, ry0, rx1, ry1] = VAN.third;
  c.box(rx0 - ox, ry0 - oy, rx1 - rx0, ry1 - ry0, { mat: m.tail, z: ZD + 0.2, r: 0.3, tone: -0.4 });
  c.box(34.6 - ox, -18.4 - oy, 2.2, 1.2, { mat: m.amber, z: ZD + 0.2, r: 0.3 });
  // The mirror on its arm, the handles.
  const [mx, my] = VAN.mirror;
  c.ellipsoid(mx - ox, my - oy, 1.8, 1.25, { mat: m.black, z: ZD + 0.8 });
  c.capsule(mx - ox - 1.2, my - oy + 0.7, mx - ox - 2.4, my - oy + 1.6, 0.45, 0.4, { mat: m.black, z: ZD + 0.6 });
  for (const [x, y] of VAN.handles) c.box(x - ox - 1.1, y - oy - 0.35, 2.2, d === 1 ? 1 : 0.75, { mat: m.black, z: ZD + 0.1, r: 0.3 });
  // The livery: ZOEF! (white, a pink shadow), PAKKETTEN under it, a parcel with speed lines.
  lettering(c, ox, oy, 'ZOEF!', -6.4, -31.2, 2, 'snow', d === 1 ? 0 : 1, 'pink');
  lettering(c, ox, oy, 'PAKKETTEN', -6.4, -21.4, 1, 'snow', d === 1 ? 0 : 1, null);
  parcelIcon(c, ox, oy, -35, -34.2, d);
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}

/** The livery's parcel icon: a pink box with a white tape cross and three speed lines behind it. */
function parcelIcon(c: HdCanvas, ox: number, oy: number, x: number, y: number, d: number): void {
  const white = top('snow', d, d === 1 ? 0 : 1);
  const pink = top('pink', d, d === 1 ? 1 : 2);
  const hw = d === 1 ? 0.5 : 0.4;
  c.paint(x - 6 - ox, y - oy, 15, 7, (px, py) => {
    const u = px + ox - x;
    const v = py + oy - y;
    // The box (6 × 5.5), a tape line across and down the middle.
    if (u >= 2.5 && u < 8.5 && v >= 0.5 && v < 6) return Math.abs(u - 5.5) < hw || Math.abs(v - 2.4) < hw ? white : pink;
    // Speed lines behind it.
    for (const [ly, l0] of [[1.8, -3], [3.3, -4.5], [4.8, -3]] as const) if (Math.abs(v - ly) < hw && u >= l0 && u < 1.5) return white;
    return 0;
  });
}

// ---------------------------------------------------------------------------------------------
// The open rear: the hold and the swung-out door
// ---------------------------------------------------------------------------------------------

/** Canvas of the rear overlays: x −60 … −17, y −43 … +1. */
const RX0 = -60;
const RY0 = -43;
const RW = 43;
const RH = 44;

/** The rear opening frame f (0, 1, 2): the door at `VAN.swing[f]`, the hold opened that far. */
export function vanRearFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(RW, RH, d);
  const ox = RX0;
  const oy = RY0;
  const [hx0, hy0, hx1, hy1] = VAN.hold;
  const k = [0.4, 0.75, 1][f] ?? 1;
  const hxk = hx0 + (hx1 - hx0) * k;
  const hold = mat(c, 'stone', { spec: 0, lo1: 0, hi1: 1, lo: 0, hi: 2, amb: 0.3 });
  const floor = mat(c, 'stone', { spec: 0.2, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const inner = mat(c, 'stone', { spec: 0.3, lo1: 1, hi1: 2, lo: 2, hi: 4 });
  const card = mat(c, 'sand', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const paint = paintMat(c, 'teal');
  const m = mats(c);
  // The hold: dark, its far wall lit toward the front, a ribbed floor.
  c.box(hx0 - ox, hy0 - oy, hxk - hx0, hy1 - hy0, {
    mat: hold,
    z: 1.4,
    round: 0,
    tex: (t) => {
      const x = t.x + ox;
      const y = t.y + oy;
      if (x > hxk - 3) t.tone += 0.35 * ((x - (hxk - 3)) / 3);
      if (y < hy0 + 2) t.tone += 0.2;
      if (d > 1 && frac((x - hx0) / 4) < 0.08 && y < hy1 - 2) t.tone -= 0.2;
    },
  });
  c.box(hx0 - ox, hy1 - oy - 1.6, hxk - hx0, 1.6, { mat: floor, z: 1.5, round: 0.3 });
  // A stack of parcels against the front wall (once the hold is fully open).
  if (k >= 1) {
    const boxes: ReadonlyArray<readonly [number, number, number, number]> = [
      [-28.6, -16.2, 7.4, 7.4],
      [-27.2, -23.4, 6, 7.2],
      [-29.8, -12.6, 3.6, 3.8],
    ];
    for (const [bx, by, bw, bh] of boxes) {
      c.box(bx - ox, by - oy, bw, bh, {
        mat: card,
        z: 1.8,
        r: 0.4,
        bevel: 0.6,
        tone: -0.25,
        tex: (t) => {
          const u = t.x + ox - bx;
          if (Math.abs(u - bw / 2) < lineW(d) * 1.4) t.tone += 0.35;
        },
      });
    }
  }
  // The door frame round the opening (body paint, a rolled lip).
  field(c, ox, oy, hx0 - 1.2, hy0 - 1.2, hxk - hx0 + 2.4, hy1 - hy0 + 2, (x, y) => {
    const inHold = x > hx0 && x < hxk && y > hy0 && y < hy1;
    const inFrame = x > hx0 - 1.2 && x < hxk + 1.2 && y > hy0 - 1.2 && y < hy1 + 0.6;
    return inFrame && !inHold ? roll(Math.min(Math.abs(x - hx0), Math.abs(x - hxk), Math.abs(y - hy0)) + 0.2, 1) : NaN;
  }, { mat: paint, z: 1.6 });
  // The near rear door, swung out behind the van: foreshortened by the swing, its inner face (a
  // grey lining with a pressed panel) toward us, a small window up top, a hinge pair.
  const a = ((VAN.swing[f] ?? 86) * Math.PI) / 180;
  const hinge = VAN.hinge;
  const dw = VAN.doorW * Math.sin(a);
  const sk = 1.6 * Math.sin(a);
  const doorPoly: Pt[] = [[hinge, -39.6], [hinge - dw, -39.6 + sk], [hinge - dw, -6.2 - sk * 0.7], [hinge, -6.2]];
  field(c, ox, oy, hinge - dw - 0.5, -40, dw + 1, 35, (x, y) => (inPoly(x, y, doorPoly) ? roll(polyDist(x, y, doorPoly), 1.2) + (hinge - x) * 0.05 : NaN), {
    mat: inner,
    z: 2,
    tex: (t) => {
      const e = polyDist(t.x + ox, t.y + oy, doorPoly);
      if (dw > 5 && e > 1.6 && e < 2.0) t.tone -= 0.35;
    },
  });
  if (dw > 4) {
    const winPoly: Pt[] = [[hinge - 1.8, -36.4], [hinge - dw + 1.8, -36.4 + sk * 0.8], [hinge - dw + 1.8, -28.4], [hinge - 1.8, -28.8]];
    field(c, ox, oy, hinge - dw, -37, dw, 10, (x, y) => (inPoly(x, y, winPoly) ? 0.4 : NaN), { mat: m.glass, z: 2.2 });
  }
  // The outer skin's edge (a teal sliver), the hinges.
  field(c, ox, oy, hinge - dw - 0.8, -39, 1.4, 33, (x, y) => (x < hinge - dw + 0.6 && inPoly(x + 1, y, doorPoly) ? 0.3 : NaN), { mat: paint, z: 2.3 });
  c.box(hinge - 1 - ox, -34 - oy, 1.4, 2, { mat: m.black, z: 2.4, r: 0.2 });
  c.box(hinge - 1 - ox, -13 - oy, 1.4, 2, { mat: m.black, z: 2.4, r: 0.2 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}

// ---------------------------------------------------------------------------------------------
// Brake lights
// ---------------------------------------------------------------------------------------------

/** Canvas of the brake overlay: x −55 … −35, y −48 … −8. */
const LX0 = -55;
const LY0 = -48;

/** 0: the lit lamps (opaque); 1: their soft glow (the van draws it additive). */
export function brakeFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(20, 40, d);
  const ox = LX0;
  const oy = LY0;
  if (f === 0) {
    const lit = mat(c, 'red', { flat: true, lo1: 3, hi1: 3, lo: 5, hi: 6 });
    const core = mat(c, 'orange', { flat: true, lo1: 3, hi1: 3, lo: 5, hi: 6 });
    const [tx0, ty0, tx1, ty1] = VAN.tail;
    c.box(tx0 - ox, ty0 - oy, tx1 - tx0, ty1 - ty0, { mat: lit, z: 1, r: 0.4 });
    c.box(tx0 - ox + 0.3, ty0 - oy + 2, (tx1 - tx0) * 0.6, (ty1 - ty0) - 4, { mat: core, z: 1.2, r: 0.3 });
    const [rx0, ry0, rx1, ry1] = VAN.third;
    c.box(rx0 - ox, ry0 - oy, rx1 - rx0, ry1 - ry0, { mat: lit, z: 1, r: 0.3 });
    return frameOf(c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false }), -ox, -oy, d);
  }
  // The glow: soft red halos round the lamps (dark → bright toward the middle), drawn additive.
  const glow = [bot('red', d, 0), bot('red', d, 1), bot('red', d, 2), top('red', d, d === 1 ? 1 : 3)];
  c.paint(0, 0, 20, 40, (x, y) => {
    const lx = x + ox;
    const ly = y + oy;
    const dl = Math.hypot((lx + 45.5) / 1.7, (ly + 21) / 4.2);
    const dt = Math.hypot((lx + 42.5) / 2.8, (ly + 40.7) / 1.3);
    const r = Math.min(dl, dt);
    if (r < 1.5) return glow[3];
    if (r < 2.4) return glow[2];
    if (r < 3.4) return glow[1];
    if (r < 4.4 && (d === 1 ? (Math.floor(x) + Math.floor(y)) % 2 === 0 : true)) return glow[0];
    return 0;
  });
  return frameOf(c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false }), -ox, -oy, d);
}

// ---------------------------------------------------------------------------------------------
// The hostage grille over the hold
// ---------------------------------------------------------------------------------------------

/** A barred steel grille over a door box (0 shut, 1 dented: bent bars, a sprung hinge). */
export function grilleBuf(c: HdCanvas, box: readonly [number, number, number, number], ox: number, oy: number, state: number): void {
  const [gx0, gy0, gx1, gy1] = box;
  const steel = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const lock = mat(c, 'gold', { spec: 1.1, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  const x0 = gx0 + 0.6;
  const x1 = gx1 - 0.6;
  const y0 = gy0 + 0.6;
  const y1 = gy1 - 0.4;
  const bend = (x: number, y: number): number => (state === 1 ? Math.exp(-(((x - (x0 + (x1 - x0) * 0.4)) / 2.5) ** 2) - (((y - (y0 + (y1 - y0) * 0.5)) / 6) ** 2)) * 1.6 : 0);
  const tube = (ax: number, ay: number, bx: number, by: number, r: number): void => {
    c.capsule(ax - ox, ay - oy, bx - ox, by - oy, r, r, { mat: steel, z: 3 });
  };
  const ym = y0 + (y1 - y0) * 0.62;
  tube(x0, y0, x1, y0, 0.7);
  tube(x0, y1, x1, y1, 0.7);
  tube(x0, y0, x0, y1, 0.7);
  tube(x1, y0 + (state === 1 ? 1.6 : 0), x1, y1, 0.7);
  tube(x0, ym, x1, ym, 0.5);
  const n = Math.max(3, Math.round((x1 - x0) / 5.6));
  for (let i = 1; i < n; i++) {
    const bx = x0 + ((x1 - x0) * i) / n;
    const kx = bend(bx, ym);
    c.capsule(bx - ox, y0 - oy, bx + kx - ox, ym - oy, 0.4, 0.4, { mat: steel, z: 2.8 });
    c.capsule(bx + kx - ox, ym - oy, bx - ox, y1 - oy, 0.4, 0.4, { mat: steel, z: 2.8 });
  }
  c.box(x1 - 2.4 - ox, ym - oy + 0.6, 3, 3, { mat: lock, z: 3.4, r: 0.7, bevel: 0.6 });
  c.capsule(x1 - 1.6 - ox, ym - oy + 0.6, x1 - 1 - ox, ym - oy - 1, 0.4, 0.4, { mat: steel, z: 3.3 });
}

/** The van's grille over the hold. */
export function vanGrilleFrame(state: number, d: Dn): Frame {
  const c = new HdCanvas(RW, RH, d);
  grilleBuf(c, VAN.hold, RX0, RY0, state);
  // Thin bars: no ink outline (it would hide the hostage behind them), as the van's cage door.
  const buf = c.render({ outline: 'none', ink: INK, ao: 0.2, rimLight: d === 1 ? 0 : 2, sep: false });
  return frameOf(buf, -RX0, -RY0, d);
}
