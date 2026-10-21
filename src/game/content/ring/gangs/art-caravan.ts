/**
 * The caravan's art (docs/design/ring.md §5.4; docs/ART_GUIDE.md "UHD art"): ONE density-generic
 * drawer per strip (art-kit.ts), outline A, facing right only (the lettering never mirrors). A
 * 1970s touring caravan of our own design: cream with a brown band and an orange line, rounded
 * front with a wrap-round window, flowered curtains, the door on the camera side, our own
 * lettering `TOERTJE`; no maker badge, no plate in view.
 *
 * - `ring/caravan/body` (4, the caravan anchor): 0 clean, hatch shut · 1 clean, the roof hatch
 *   open (the gunner stands in it; the lid propped up) · 2 / 3 the same, battered (cracked
 *   windows, a torn band, soot at the wheel).
 * - `ring/caravan/open` (1): the door folded back against the side and the dark doorway (the
 *   hostage variant); `ring/caravan/grille` (2: shut, dented): the barred grille over it.
 * - `ring/caravan/drawbar` (3, the caravan anchor): 0 hitched to the tow car's ball · 1 strained
 *   (the tell: bent at the head, a crack glint) · 2 dropped (the head scraping on the road).
 * - `ring/caravan/tip` (4, deferred): tipping over toward the camera (25°, 55°, 80°) and lying on
 *   its side (the roof faces us: the hatch, the skylight, the vent).
 */
import type { Frame } from '../../../../engine/render';
import { INK } from '../../../../engine/palette';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { field, frac, frameOf, lettering, lineW, mats, paintMat, polyBox, roll, volume, wells, type VolumeGeo } from './art-kit';
import { grilleBuf } from './art-van';
import { CARAVAN, type Pt } from './geometry';

/** Caravan canvas: x −39 … 38, y −52 … +1 (room for the propped lid). */
const BX0 = -39;
const BY0 = -52;
const BW = 77;
const BH = 53;
const ZD = 5;

const GEO: VolumeGeo = { wheels: [CARAVAN.wheel], wheelR: CARAVAN.wheelR, belt: -22.4, sill: -8 };

/** Is (x, y) in a window box (rounded corners r)? */
function inBox(x: number, y: number, b: readonly [number, number, number, number], r: number): boolean {
  const [x0, y0, x1, y1] = b;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** The body: `hatch` open or shut, `battered`. */
export function caravanBodyFrame(hatch: boolean, battered: boolean, d: Dn): Frame {
  const c = new HdCanvas(BW, BH, d);
  const ox = BX0;
  const oy = BY0;
  const m = mats(c);
  const paint = paintMat(c, 'cream');
  const brown = mat(c, 'brown', { spec: 0.8, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 5, rim: 0.3 });
  const orange = mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const frameMat = mat(c, 'gable', { spec: 0.5, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const curtain = mat(c, 'orange', { spec: 0.1, lo1: 0, hi1: 2, lo: 2, hi: 5 });
  const hw = lineW(d);
  const [dx0, dx1] = CARAVAN.doorX;
  const [dy0, dy1] = CARAVAN.doorY;
  wells(c, GEO, m, ox, oy);
  // The shell: cream, the brown band and the orange line, the door's shut line, a roof seam.
  volume(c, GEO, CARAVAN.profile, paint, ox, oy, c.newPart(), (t, x, y) => {
    if (y > CARAVAN.stripe[0] && y < CARAVAN.stripe[1]) t.mat = battered && x > 18 && x < 30 && frac(x * 0.3) < 0.5 ? paint : brown;
    else if (y > CARAVAN.stripe2[0] && y < CARAVAN.stripe2[1]) t.mat = orange;
    // The door: a shut line round it.
    const onDoor = x > dx0 - hw && x < dx1 + hw && y > dy0 - hw && y < dy1 + hw;
    if (onDoor && (Math.abs(x - dx0) < hw || Math.abs(x - dx1) < hw || Math.abs(y - dy0) < hw)) t.tone -= 0.75;
    // The roof's edge trim (a slightly darker rolled seam), the sky in the roof's top.
    if (y < -37.2 && y > -38.4) t.tone += 0.12;
    if (Math.abs(y + 36.6) < hw && x < 26) t.tone -= 0.3;
    // Soot round the wheel on a battered caravan.
    if (battered) {
      const r = Math.hypot(x - (CARAVAN.wheel + 0.5), y + 6.5);
      if (r < 13 && Math.sin(x * 0.9 + y * 0.6) + (13 - r) / 5 > 1.2) t.tone -= 0.45;
    }
  });
  // Windows: dark acrylic in a white rounded frame, the top half curtained (orange, flowered).
  CARAVAN.windows.forEach((w, i) => {
    const [x0, y0, x1, y1] = w;
    const r = i === 2 ? 2.4 : 1.6;
    field(c, ox, oy, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, (x, y) => (inBox(x, y, [x0 - 0.9, y0 - 0.9, x1 + 0.9, y1 + 0.9], r + 0.8) && !inBox(x, y, w, r) ? 0.5 : NaN), { mat: frameMat, z: ZD });
    field(c, ox, oy, x0, y0, x1 - x0, y1 - y0, (x, y) => (inBox(x, y, w, r) ? (y - y0) * 0.12 : NaN), {
      mat: m.glass,
      z: ZD - 0.4,
      tex: (t) => {
        const x = t.x + ox;
        const y = t.y + oy;
        // The curtain: the upper part, gathered in folds, a small flower print at 2× / 4×.
        const ch = (y1 - y0) * (i === 1 ? 0.45 : 0.55);
        if (y < y0 + ch) {
          t.mat = curtain;
          t.tone += Math.sin((x - x0) * (d === 1 ? 1.6 : 1.9)) * 0.25 - 0.1;
          if (d > 1 && frac((x - x0) / 3.1) < 0.18 && frac((y - y0) / 2.6) < 0.25) t.tone += 0.55;
          return;
        }
        const u = frac((x + (y - y1) * 0.8) / 9);
        if (u < 0.12) t.tone += 0.85;
        else if (u > 0.18 && u < 0.22) t.tone += 0.45;
        if (battered && i !== 1) {
          const rr = Math.hypot(x - (x0 + (x1 - x0) * 0.4), y - (y1 - 2));
          const a = Math.atan2(y - (y1 - 2), x - (x0 + (x1 - x0) * 0.4));
          if (rr < 5 && frac(a * 1.1) < (d === 1 ? 0.14 : 0.08)) t.tone += 1.1;
        }
      },
    });
  });
  // The door's handle and the step under it; the rear lamps; corner steadies.
  c.box(dx1 - 2.4 - ox, -20.6 - oy, 1.6, d === 1 ? 1 : 0.8, { mat: m.black, z: ZD, r: 0.3 });
  c.box(dx0 + 1 - ox, -7.4 - oy, dx1 - dx0 - 2, 1.4, { mat: m.plastic, z: ZD, r: 0.3 });
  c.box(-36.8 - ox, -15.6 - oy, 1.6, 5, { mat: m.tail, z: ZD, r: 0.4, bevel: 0.4 });
  c.box(-36.8 - ox, -10.4 - oy, 1.6, 1.6, { mat: m.amber, z: ZD, r: 0.3 });
  for (const sx of [-32.6, 30.4]) c.capsule(sx - ox, -7.6 - oy, sx - 0.6 - ox, -4.4 - oy, 0.6, 0.5, { mat: m.black, z: 0.6 });
  // A roof vent and the hatch (shut: a low lid; open: the opening and the lid propped up at the front edge).
  c.box(10 - ox, -40.4 - oy, 6, 1.6, { mat: frameMat, z: ZD, r: 0.6, bevel: 0.6 });
  const [hx0, hx1] = CARAVAN.hatch;
  if (!hatch) c.box(hx0 - ox, -40.6 - oy, hx1 - hx0, 1.8, { mat: frameMat, z: ZD, r: 0.6, bevel: 0.6 });
  else {
    // The lid, hinged at the hatch's front edge, propped up about 55° (seen from its side: a slab).
    const lid: Pt[] = [[hx1 - 1, -39.2], [hx1 + 1.6, -39.4], [hx1 + 8.4, -48.6], [hx1 + 5.8, -49.6]];
    field(c, ox, oy, hx1 - 1.5, -51, 11, 12.4, (x, y) => (inPoly(x, y, lid) ? roll(polyDist(x, y, lid), 0.7) : NaN), { mat: frameMat, z: ZD });
    c.box(hx0 - ox, -39.8 - oy, hx1 - hx0, 1, { mat: m.black, z: ZD - 0.2 });
  }
  // The lettering: TOERTJE in cream on the brown band, at the rear.
  lettering(c, ox, oy, 'TOERTJE', -21.4, -13.5, 1, 'sand', d === 1 ? 0 : 1, null);
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}

// ---------------------------------------------------------------------------------------------
// The hostage variant: the open door and the grille
// ---------------------------------------------------------------------------------------------

/** Canvas of the door overlays: x −14 … 17, y −38 … −6. */
const DX0 = -14;
const DY0 = -38;
const DW = 31;
const DH = 32;

/** The door folded back against the side (to the rear of the doorway), the dark doorway. */
export function caravanOpenFrame(d: Dn): Frame {
  const c = new HdCanvas(DW, DH, d);
  const ox = DX0;
  const oy = DY0;
  const m = mats(c);
  const hold = mat(c, 'stone', { spec: 0, lo1: 0, hi1: 1, lo: 0, hi: 2, amb: 0.3 });
  const floor = mat(c, 'wood', { spec: 0.2, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const paint = paintMat(c, 'cream');
  const [dx0, dx1] = CARAVAN.doorX;
  const [dy0, dy1] = CARAVAN.doorY;
  // The doorway: dark, a lit far corner, a lino floor.
  c.box(dx0 - ox, dy0 - oy, dx1 - dx0, dy1 - dy0, {
    mat: hold,
    z: 1.4,
    round: 0,
    tex: (t) => {
      const x = t.x + ox;
      if (x > dx1 - 3) t.tone += 0.3 * ((x - (dx1 - 3)) / 3);
    },
  });
  c.box(dx0 - ox, dy1 - 1.6 - oy, dx1 - dx0, 1.6, { mat: floor, z: 1.5, round: 0.3 });
  // The door, folded back flat against the side behind the doorway (its outer skin: the band).
  const door: Pt[] = [[dx0 - 0.6, dy0], [dx0 - 12.4, dy0 + 0.4], [dx0 - 12.4, dy1 - 0.2], [dx0 - 0.6, dy1]];
  const b = polyBox(door);
  const brown = mat(c, 'brown', { spec: 0.8, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 5 });
  field(c, ox, oy, b.x0 - 0.5, b.y0 - 0.5, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, (x, y) => (inPoly(x, y, door) ? roll(polyDist(x, y, door), 1) + 0.6 : NaN), {
    mat: paint,
    z: 2,
    tex: (t) => {
      const y = t.y + oy;
      if (y > CARAVAN.stripe[0] && y < CARAVAN.stripe[1]) t.mat = brown;
    },
  });
  field(c, ox, oy, dx0 - 10.4, -31.4, 7, 8, (x, y) => (x > dx0 - 10 && x < dx0 - 3 && y > -31 && y < -23.6 ? 0.4 : NaN), { mat: m.glass, z: 2.3 });
  c.box(dx0 - 11.6 - ox, -20.6 - oy, 1.6, d === 1 ? 1 : 0.8, { mat: m.black, z: 2.4, r: 0.3 });
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}

/** The barred grille over the doorway (0 shut, 1 dented). */
export function caravanGrilleFrame(state: number, d: Dn): Frame {
  const c = new HdCanvas(DW, DH, d);
  grilleBuf(c, [CARAVAN.doorX[0], CARAVAN.doorY[0], CARAVAN.doorX[1], CARAVAN.doorY[1]], DX0, DY0, state);
  const buf = c.render({ outline: 'none', ink: INK, ao: 0.2, rimLight: d === 1 ? 0 : 2, sep: false });
  return frameOf(buf, -DX0, -DY0, d);
}

// ---------------------------------------------------------------------------------------------
// The drawbar
// ---------------------------------------------------------------------------------------------

/** Canvas of the drawbar: x 30 … 58, y −18 … +1. */
const WX0 = 30;
const WY0 = -18;

/** 0 hitched, 1 strained (the tell), 2 dropped (the head on the road). */
export function drawbarFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(28, 19, d);
  const ox = WX0;
  const oy = WY0;
  const m = mats(c);
  const steel = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const zinc = mat(c, 'steel', { spec: 0.6, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const [hx, hy] = CARAVAN.hitch;
  // The head: hitched at the ball (level), lifted a little and bent (strained), or down on the road.
  const head: Pt = f === 2 ? [hx - 1.2, -2.2] : f === 1 ? [hx, hy - 1.2] : [hx, hy];
  const root: Pt = [34.4, -11.2];
  const mid: Pt = f === 1 ? [(root[0] + head[0]) / 2, (root[1] + head[1]) / 2 - 1] : [(root[0] + head[0]) / 2, (root[1] + head[1]) / 2];
  // The A-frame (two bars seen as one, a lighter top edge) and the gas bottle cover in front.
  c.stroke([[root[0] - ox, root[1] - oy], [mid[0] - ox, mid[1] - oy], [head[0] - 2.4 - ox, head[1] - oy]], 1.1, 0.9, { mat: zinc, z: 2 });
  c.capsule(root[0] - ox, root[1] + 1.4 - oy, head[0] - 3 - ox, head[1] + 1 - oy, 0.6, 0.5, { mat: m.black, z: 1.6 });
  // The coupling head with its handle, the breakaway cable.
  c.ellipsoid(head[0] - ox, head[1] - oy, 2.6, 1.9, { mat: steel, z: 2.6 });
  c.capsule(head[0] - 1.6 - ox, head[1] - 1.6 - oy, head[0] - 4.6 - ox, head[1] - 3.2 - oy, 0.5, 0.45, { mat: m.black, z: 2.8 });
  // The jockey wheel: folded up when hitched, scraping when dropped.
  const jx = 42;
  const jy = f === 2 ? -3 : -6.6;
  c.capsule(jx - ox, (f === 2 ? -6.8 : -11) - oy, jx - ox, jy - oy, 0.6, 0.6, { mat: steel, z: 2.2 });
  c.ellipsoid(jx - ox, jy + 1.2 - oy, 1.6, 1.6, { mat: m.black, z: 2.3 });
  // The strained head: a bright crack glint where the bar bends.
  if (f === 1) {
    const glint = top('snow', d);
    c.paint(mid[0] - 2 - ox, mid[1] - 2.6 - oy, 4, 4, (x, y) => {
      const u = x + ox - mid[0];
      const v = y + oy - (mid[1] - 0.6);
      return Math.abs(u - v * 0.6) < (d === 1 ? 0.5 : 0.3) && Math.abs(v) < 1.6 ? glint : 0;
    });
  }
  const buf = finishA(c, 0.25);
  return frameOf(buf, -ox, -oy, d);
}

// ---------------------------------------------------------------------------------------------
// Tipping over
// ---------------------------------------------------------------------------------------------

/** Tip angles (deg) of the frames: the side face shrinks by cos, the roof grows by sin. */
const TIP = [25, 55, 80, 90];
/** The caravan's width (the roof face's height when it lies on its side). */
const WIDTH = 24;

/** Tipping toward the camera (frames 0–2) and lying on its side (3): the roof faces us. */
export function caravanTipFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(90, 41, d);
  const ox = -40;
  const oy = -40;
  const a = ((TIP[f] ?? 90) * Math.PI) / 180;
  const H = 31.4;
  const sideH = H * Math.cos(a);
  const roofH = WIDTH * Math.sin(a);
  const paint = paintMat(c, 'cream');
  const brown = mat(c, 'brown', { spec: 0.8, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 5 });
  const orange = mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const roofMat = mat(c, 'gable', { spec: 0.6, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const m = mats(c);
  const y0 = -1.4;
  // The side face, squashed by cos(a) (its bottom edge on the road), with its band and line.
  if (sideH > 1) {
    const prof: Pt[] = [[-36, y0], [-36, y0 - sideH + 1], [-34, y0 - sideH], [26, y0 - sideH], [34, y0 - sideH * 0.7], [36, y0 - sideH * 0.35], [35, y0]];
    field(c, ox, oy, -37, y0 - sideH - 1, 74, sideH + 1.6, (x, y) => (inPoly(x, y, prof) ? roll(polyDist(x, y, prof), 1.6) : NaN), {
      mat: paint,
      z: 1,
      tex: (t) => {
        const v = (y0 - (t.y + oy)) / Math.max(1, sideH);
        // Heights over the bottom edge (y −7.6) of the band, the line and the rear window.
        const u = v * H;
        const hy = (yy: number): number => -yy - 7.6;
        if (u > hy(CARAVAN.stripe[1]) && u < hy(CARAVAN.stripe[0])) t.mat = brown;
        else if (u > hy(CARAVAN.stripe2[1]) && u < hy(CARAVAN.stripe2[0])) t.mat = orange;
        const w0 = CARAVAN.windows[0];
        if (u > hy(w0[3]) && u < hy(w0[1]) && t.x + ox > w0[0] && t.x + ox < w0[2]) t.mat = m.glass;
      },
    });
  }
  // The roof face above it: cream-white, rounded at the front, the hatch, the skylight, a vent.
  const rTop = y0 - sideH - roofH;
  const roof: Pt[] = [[-36, y0 - sideH], [-36, rTop + 1.6], [-34.4, rTop], [25, rTop], [33, rTop + roofH * 0.15], [36, rTop + roofH * 0.5], [34, y0 - sideH]];
  if (roofH > 1) {
    field(c, ox, oy, -37, rTop - 1, 74, roofH + 1.6, (x, y) => (inPoly(x, y, roof) ? roll(polyDist(x, y, roof), 2) + 0.4 : NaN), {
      mat: roofMat,
      z: 1.2,
      tex: (t) => {
        const x = t.x + ox;
        const v = (t.y + oy - rTop) / roofH;
        // A rain gutter along each long edge, the roof's seams.
        if (v < 0.08 || v > 0.92) t.tone -= 0.2;
        if (d > 1 && frac((x + 36) / 12) < 0.04) t.tone -= 0.18;
      },
    });
    const mid = rTop + roofH / 2;
    const s = Math.max(0.2, roofH / WIDTH);
    c.box(-20 - ox, mid - 4 * s - oy, 12, 8 * s, { mat: roofMat, z: 2.4, r: 0.8, bevel: 0.8, tone: -0.15 });
    c.ellipsoid(6 - ox, mid - oy, 4.6, 3.2 * s, { mat: m.glass, z: 2.4, round: 0.8 });
    c.box(14 - ox, mid - 1.4 * s - oy, 5, 2.8 * s, { mat: m.plastic, z: 2.4, r: 0.4 });
  }
  if (f >= 2) {
    // Lying: the far side faces up (a cream strip with its brown band over the roof's top edge),
    // the drawbar sticks out of the front end, a dark seam where it lies on the road.
    const top0 = rTop - 3;
    field(c, ox, oy, -35.5, top0 - 0.5, 68, 4, (x, y) => (x > -35 && x < 31 - (y - top0) && y > top0 && y < rTop + 0.4 ? 0.6 : NaN), {
      mat: paint,
      z: 1.1,
      tex: (t) => {
        if (t.y + oy > top0 + 1.6) t.mat = brown;
      },
    });
    const zinc = mat(c, 'steel', { spec: 0.6, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
    const by = rTop + roofH * 0.55;
    c.capsule(35 - ox, by - oy, 46 - ox, by + 1 - oy, 1, 0.8, { mat: zinc, z: 1.4 });
    c.ellipsoid(47 - ox, by + 1 - oy, 2, 1.6, { mat: m.chrome, z: 1.6 });
  }
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}
