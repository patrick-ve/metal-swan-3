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
 * - `ring/caravan/tip` (4, deferred): tipping over away from the camera (18°, 42°, 66°) and lying
 *   on its far side (84°): the livery (windows, band, line, TOERTJE) stays in view, foreshortened,
 *   and the underside turns toward us (rails, axle, both wheels, the A-frame).
 */
import type { Frame } from '../../../../engine/render';
import { INK } from '../../../../engine/palette';
import { HdCanvas, inPoly, polyDist } from '../../../art/hd';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { field, frac, frameOf, letterAt, lettering, lineW, mats, paintMat, polyBox, roll, volume, wells, type VolumeGeo } from './art-kit';
import { textWidth } from '../traffic/lettering';
import { grilleBuf } from './art-van';
import { CARAVAN, CARAVAN_DOOR, type Pt } from './geometry';

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
  grilleBuf(c, CARAVAN_DOOR, DX0, DY0, state);
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

/**
 * Tip angles (deg) of the frames: the caravan tips AWAY from us about its far bottom edge, so the
 * near wall (the livery) turns up toward the sky and stays in view, and the underside with the
 * axle, both wheels and the A-frame turns toward us. The last angle is the lying pose (its
 * rounded roof lip keeps it a little short of flat).
 */
const TIP = [18, 42, 66, 84];
/** The caravan's width (the depth of the floor) and the view: a depth shows TK as much as a height. */
const WIDTH = 24;
const TK = 0.42;
/** The floor's height over the road (the body's bottom edge). */
const FLOOR = 7.6;

/**
 * The tip's projection at angle `a` (rad): a body point (x, dz = depth from the near wall, ≤ 0
 * inside, h = height) → screen y, shifted down by TK·W·sin a so the lying caravan's road contact
 * stays on the plane y (the runner's shadow). `s`: the near wall's vertical scale.
 */
function tipView(a: number): { sy: (dz: number, h: number) => number; s: number; sy0: number; dsDz: number } {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const shift = TK * WIDTH * sa;
  const sy = (dz: number, h: number): number => {
    const rd = dz + WIDTH;
    const dep = -WIDTH + rd * ca - h * sa;
    const hei = rd * sa + h * ca;
    return -hei + TK * dep + shift;
  };
  return { sy, s: ca + TK * sa, sy0: sy(0, 0), dsDz: -sa + TK * ca };
}

/**
 * Tipping away from us (frames 0–2) and lying on its far side (3). Frame 0: the near side lifts
 * (the near wheel leaves the road, the far wheel still under it, a sliver of roof); 1–2: the wall
 * leans back, the floor turns toward us; 3: the livery lies foreshortened on top, under it the
 * chassis: the rails, the axle with both wheels sticking out toward us and the A-frame drawbar.
 */
export function caravanTipFrame(f: number, d: Dn): Frame {
  const ox = -40;
  const oy = -58;
  const c = new HdCanvas(98, 61, d);
  const a = ((TIP[f] ?? 84) * Math.PI) / 180;
  const v = tipView(a);
  const m = mats(c);
  const paint = paintMat(c, 'cream');
  const brown = mat(c, 'brown', { spec: 0.8, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 5, rim: 0.3 });
  const orange = mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const frameMat = mat(c, 'gable', { spec: 0.5, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const curtain = mat(c, 'orange', { spec: 0.1, lo1: 0, hi1: 2, lo: 2, hi: 5 });
  const roofMat = mat(c, 'gable', { spec: 0.6, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const pan = mat(c, 'stone', { spec: 0.2, shine: 14, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const zinc = mat(c, 'steel', { spec: 0.6, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const steel = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const hw = lineW(d);
  // The near wall's mapping: body y (−h) → screen y = sy0 + s·y; back: y = (sy − sy0) / s.
  const s = v.s;
  const by = (sy: number): number => (sy - v.sy0) / s;
  const Y = (y: number): number => v.sy0 + s * y;
  /** A field over a body box of the near wall (x0, y0, w, h in body px), evaluated at body coords. */
  const wall = (x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => number, o: Parameters<HdCanvas['heightField']>[5]): void => {
    field(c, ox, oy, x0, Y(y0) - 0.5, w, h * s + 1, (x, sy) => fn(x, by(sy)), o);
  };
  /** A box on the near wall (body px). */
  const wbox = (x: number, y: number, w: number, h: number, o: Parameters<HdCanvas['box']>[4]): void => {
    c.box(x - ox, Y(y) - oy, w, Math.max(0.6, h * s), o);
  };
  const P = (x: number, dz: number, h: number): [number, number] => [x - ox, v.sy(dz, h) - oy];
  const seg = (x0: number, dz0: number, h0: number, x1: number, dz1: number, h1: number, r0: number, r1: number, o: Parameters<HdCanvas['capsule']>[6]): void => {
    const [ax, ay] = P(x0, dz0, h0);
    const [bx, bb] = P(x1, dz1, h1);
    c.capsule(ax, ay, bx, bb, r0, r1, o);
  };
  /** A wheel (one axle: x −1.5) at depth dz0 … dz1 (outer face first): a drum of stacked discs. */
  const wx = CARAVAN.wheel + 0.5;
  const wr = CARAVAN.wheelR;
  const wheel = (dzFace: number, dzIn: number, z: number, hub: boolean): void => {
    const [cx, yF] = P(wx, dzFace, wr);
    const yI = v.sy(dzIn, wr) - oy;
    const ry = wr * s;
    const lo = Math.min(yF, yI);
    const hi = Math.max(yF, yI);
    // The tread: every disc between the faces (a drum), shaded round across x.
    field(c, ox, oy, cx + ox - wr - 0.5, lo + oy - ry - 0.5, wr * 2 + 1, hi - lo + ry * 2 + 1, (x, sy) => {
      const u = (x - (cx + ox)) / wr;
      if (u * u >= 1) return NaN;
      const e = ry * Math.sqrt(1 - u * u);
      const y = sy - oy;
      return y >= lo - e && y <= hi + e ? Math.sqrt(1 - u * u) * 1.2 : NaN;
    }, { mat: m.black, z, tex: (t) => void (t.tone += Math.abs(t.y - (yF + yI) / 2) < 0.6 ? 0 : -0.1) });
    // The face toward us: the tyre's sidewall ring, the steel rim and the hub (the far wheel: its
    // inner side, a dull brake drum where the axle goes in).
    field(c, ox, oy, cx + ox - wr, yF + oy - ry, wr * 2, ry * 2, (x, sy) => {
      const q = Math.hypot((x - (cx + ox)) / wr, (sy - (yF + oy)) / ry);
      return q < 1 ? 1.6 - q * 0.4 : NaN;
    }, {
      mat: m.black,
      z: z + 0.6,
      tex: (t) => {
        const q = Math.hypot((t.x - cx) / wr, (t.y - yF) / ry);
        if (q < 0.62) t.mat = hub ? steel : zinc;
        if (hub && q < 0.22) t.mat = m.black;
        if (!hub && q < 0.62) t.tone -= 0.25;
        if (q > 0.62 && q < 0.7) t.tone -= 0.3;
      },
    });
  };
  const W = WIDTH;
  const floorOn = v.dsDz < -0.05;
  // 1. The far wheel (still on the road under the lifting side; later the bottom of the chassis).
  wheel(-W - 2.5, -W + 1.5, 0.5, false);
  // 2. The underside, once it turns toward us: the floor pan, two rails, cross members, the
  //    axle, the corner steadies and the A-frame to the coupling head.
  if (floorOn) {
    const yn = v.sy(0, FLOOR);
    const yf = v.sy(-W, FLOOR);
    const x0 = -34.6;
    const x1 = 33.6;
    field(c, ox, oy, x0 - 1, yn - 1, x1 - x0 + 2, yf - yn + 2, (x, sy) => {
      if (x < x0 || x > x1 || sy < yn || sy > yf) return NaN;
      const e = Math.min(x - x0, x1 - x, (sy - yn) * 2, (yf - sy) * 2);
      return roll(e, 1.2) * 0.6;
    }, {
      mat: pan,
      z: 1.2,
      tex: (t) => {
        const x = t.x + ox;
        // Pressed ribs across the pan, a grimy edge.
        if (frac((x + 34.6) / 7.4) < (d === 1 ? 0.14 : 0.08)) t.tone -= 0.3;
        if (t.y + oy > yf - 1.2) t.tone -= 0.25;
      },
    });
    for (const dz of [-5, -W + 5]) seg(-33, dz, FLOOR - 0.6, 33, dz, FLOOR - 0.6, 0.9, 0.9, { mat: m.black, z: 1.6 });
    for (const x of [-24, 14, 26]) seg(x, -3, FLOOR - 0.4, x, -W + 3, FLOOR - 0.4, 0.5, 0.5, { mat: zinc, z: 1.5 });
    for (const x of [-32.6, 30.4]) for (const dz of [-1.4, -W + 1.4]) seg(x, dz, FLOOR, x - 0.4, dz, 4.6, 0.6, 0.5, { mat: m.black, z: 1.9 });
    // The A-frame: from the front corners of the chassis to the coupling head in the middle.
    const [hx] = CARAVAN.hitch;
    for (const dz of [-5, -W + 5]) seg(33, dz, FLOOR + 0.4, hx - 2.4, -W / 2, 9.6, 1.1, 0.9, { mat: zinc, z: 2 });
    const [kx, ky] = P(hx, -W / 2, 9.6);
    c.ellipsoid(kx, ky, 2.6, 2.2, { mat: steel, z: 2.6 });
    // The axle between the wheels.
    seg(wx, -1.5, wr, wx, -W + 1.5, wr, 1, 1, { mat: zinc, z: 1.8 });
  }
  // 3. A sliver of the roof while it still faces up a little (frame 0).
  if (v.dsDz > 0.05) {
    const yt = v.sy(0, -CARAVAN.roof);
    const yb = v.sy(-W, -CARAVAN.roof);
    field(c, ox, oy, -34, yb - 1, 60, yt - yb + 2, (x, sy) => (x > -33.6 && x < 25 && sy > yb && sy < yt + 0.5 ? 0.4 : NaN), { mat: roofMat, z: 2.4 });
  }
  // 4. The near wall, foreshortened: the shell with the band, the line and the door, the windows
  //    (curtains, cracks), the lamps, TOERTJE. It faces the sky more as it tips: a little lighter.
  const lift = 0.12 * Math.sin(a);
  const ar = wr + 1.2;
  const poly = CARAVAN.profile;
  const [dx0, dx1] = CARAVAN.doorX;
  const [dy0, dy1] = CARAVAN.doorY;
  wall(-37, -40, 75, 33, (x, y) => {
    if (!inPoly(x, y, poly)) return NaN;
    const wd = Math.hypot(x - wx, y + wr);
    if (wd < ar) return NaN;
    const e = Math.min(polyDist(x, y, poly), wd - ar + 0.5);
    return roll(e, 2.2) * Math.min(1, s);
  }, {
    mat: paint,
    z: 3,
    tex: (t) => {
      const x = t.x + ox;
      const y = by(t.y + oy);
      t.tone += lift;
      if (y > CARAVAN.stripe[0] && y < CARAVAN.stripe[1]) t.mat = x > 18 && x < 30 && frac(x * 0.3) < 0.5 ? paint : brown;
      else if (y > CARAVAN.stripe2[0] && y < CARAVAN.stripe2[1]) t.mat = orange;
      const onDoor = x > dx0 - hw && x < dx1 + hw && y > dy0 - hw / s && y < dy1 + hw / s;
      if (onDoor && (Math.abs(x - dx0) < hw || Math.abs(x - dx1) < hw || Math.abs(y - dy0) < hw / s)) t.tone -= 0.75;
      if (y < -37.2 && y > -38.4) t.tone += 0.12;
      // Road grime and scrapes along the bottom edge.
      if (y > -10.4 && frac(x * 0.37 + y * 0.2) < 0.3) t.tone -= 0.3;
    },
  });
  CARAVAN.windows.forEach((w, i) => {
    const [x0, y0, x1, y1] = w;
    const r = i === 2 ? 2.4 : 1.6;
    wall(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, (x, y) => (inBox(x, y, [x0 - 0.9, y0 - 0.9, x1 + 0.9, y1 + 0.9], r + 0.8) && !inBox(x, y, w, r) ? 0.5 : NaN), { mat: frameMat, z: 7 });
    wall(x0, y0, x1 - x0, y1 - y0, (x, y) => (inBox(x, y, w, r) ? (y - y0) * 0.12 * s : NaN), {
      mat: m.glass,
      z: 6.6,
      tex: (t) => {
        const x = t.x + ox;
        const y = by(t.y + oy);
        const ch = (y1 - y0) * (i === 1 ? 0.45 : 0.55);
        if (y < y0 + ch) {
          t.mat = curtain;
          t.tone += Math.sin((x - x0) * (d === 1 ? 1.6 : 1.9)) * 0.25 - 0.1;
          if (d > 1 && frac((x - x0) / 3.1) < 0.18 && frac((y - y0) / 2.6) < 0.25) t.tone += 0.55;
          return;
        }
        // The sky in the glass (it faces up now) and a crack star.
        t.tone += 0.25 * Math.sin(a);
        const u = frac((x + (y - y1) * 0.8) / 9);
        if (u < 0.12) t.tone += 0.85;
        const rr = Math.hypot(x - (x0 + (x1 - x0) * 0.4), (y - (y1 - 2)) * s);
        const ang = Math.atan2(y - (y1 - 2), x - (x0 + (x1 - x0) * 0.4));
        if (i !== 1 && rr < 5 && frac(ang * 1.1) < (d === 1 ? 0.14 : 0.08)) t.tone += 1.1;
      },
    });
  });
  wbox(dx1 - 2.4, -20.6, 1.6, d === 1 ? 1 : 0.8, { mat: m.black, z: 7, r: 0.3 });
  wbox(-36.8, -15.6, 1.6, 5, { mat: m.tail, z: 7, r: 0.4, bevel: 0.4 });
  wbox(-36.8, -10.4, 1.6, 1.6, { mat: m.amber, z: 7, r: 0.3 });
  // TOERTJE on the band (the letters foreshortened with the wall: read in the bits at 1×, strokes at 2× / 4×).
  const ink = top('sand', d, d === 1 ? 0 : 1);
  const tw = textWidth('TOERTJE', 1, 1) + 2;
  c.paint(-21.4 - tw / 2 - ox, Y(-17) - oy, tw + 1, 7 * s + 2, (x, sy) => (letterAt(d, 'TOERTJE', -21.4, -13.5, 1, x + ox, by(sy + oy)) ? ink : 0));
  // 5. The near wheel last: it sticks out of the wall (its hub toward us), in the arch.
  wheel(2.5, -1.5, 9, true);
  const buf = finishA(c, 0.3);
  return frameOf(buf, -ox, -oy, d);
}
