/**
 * The handhaver motorbike at 1× / 2× / 4× (docs/design/ring.md §5.3; docs/ART_GUIDE.md "UHD art"):
 * ONE density-generic drawer per strip. The bike is drawn on an `HdCanvas` with the ramps of the
 * density (`PAL` at 1×, `PAL_HD` at 2× / 4×: the stag kit's `mat`), the officer comes from the
 * humanoid rig at the same density (`renderHuman(…, d)`, the ams handhaver look: navy uniform and
 * cap, the yellow hi-vis vest), placed hip-on-seat as the scooter riders are
 * (content/ring/scooter/art.ts). Outline A. Bloodless. No maker badge, no lettering on the bike.
 *
 * The bike: a white city touring motorbike in the scan car's livery — a tall fairing with a smoked
 * screen, a white tank, a black seat, a white top box and panniers with the red slanted bars, a
 * black engine, a chrome exhaust, silver wheels. Strips (anchor: the road under the middle, facing
 * right): `ride` (4), `tell-baton` (3: draws the baton, raises it, cocks it overhead; held),
 * `baton` (2: the swing up at the window, the follow-through), `tell-sticker` (3: a fine sticker
 * out of the vest, held up, peeled; held), `sticker` (2: the slap up at the glass, the arm back),
 * `wobble` (2), `gloat` (5, deferred: he writes the fine in his book, tears the page off, holds it
 * up, lets it go, shuts the book), `cower` (2, deferred: he ducks behind his arm on the bike),
 * `down` (3: the riderless bike tipping over), `rider-tumble` (4), `rider-sit` (2: dazed on the
 * hard shoulder). The fine sticker (`fine`, 2) and its HUD icon (`fine-icon`).
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type Pose } from '../../../art/humanoid';
import { HANDHAVER_STYLE } from '../../locals/handhaver.art';
import { glyphHitC } from '../traffic/lettering';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { MOTO, STICKER, type Pt } from './geometry';

type FramePoints = Record<string, [number, number]>;

/** Canvas: x −32 … 32, y −64 … 3 (anchor 32, 64). */
const CW = 64;
const CH = 67;
const AX = 32;
const AY = 64;

/** A transform of local points: a turn about the rear wheel's ground contact, a vertical squash. */
interface Tf {
  rot: number;
  squash: number;
  dy: number;
}
const FLAT: Tf = { rot: 0, squash: 1, dy: 0 };

function tf(t: Tf, x: number, y: number): [number, number] {
  const px = MOTO.rear[0];
  const a = (t.rot * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const u = x - px;
  const v = y * t.squash;
  return [px + u * cs - v * sn + AX, u * sn + v * cs + AY + t.dy];
}

const frac = (v: number): number => v - Math.floor(v);

/** Is (x, y) on a red slanted bar of the city livery (bars leaning forward, inside the box)? */
function onBar(x: number, y: number, x0: number, x1: number, y0: number, y1: number): boolean {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const u = x - x0 + (y - y1) * 0.3;
  return frac(u / 3.6) < 1.9 / 3.6;
}

/** The bike itself (no rider) at density d, wheels turned by `phase` (0 … 1). */
function bikeBuf(t: Tf, phase: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(CW, CH, d);
  const white = mat(c, 'snow', { spec: 0.9, shine: 44, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.3 });
  const red = mat(c, 'red', { spec: 0.5, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const black = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const seat = mat(c, 'black', { spec: 0.8, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const chrome = mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.4 });
  const rim = mat(c, 'steel', { spec: 1.3, shine: 50, lo1: 2, hi1: 3, lo: 3, hi: 7, rim: 0.4 });
  const engine = mat(c, 'steel', { spec: 0.6, shine: 26, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const tyre = mat(c, 'black', { spec: 0.3, shine: 12, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const screen = mat(c, 'glass', { spec: 1.4, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const lamp = mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const tail = mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const k = t.squash;
  const P = (x: number, y: number): [number, number] => tf(t, x, y);
  const poly = (pts: ReadonlyArray<Pt>): Array<[number, number]> => pts.map(([x, y]) => P(x, y));
  /** The city livery's red bars inside a local box (only on the upright bike: the fallen one is seen flat). */
  const bars = (x0: number, x1: number, y0: number, y1: number) => (s: { x: number; y: number; mat: number }): void => {
    if (k === 1 && onBar(s.x - AX, s.y - AY - t.dy, x0, x1, y0, y1)) s.mat = red;
  };
  // Wheels: a black tyre, a bright silver rim with five dark spokes turning, a bright hub.
  for (const [wx, wy] of [MOTO.rear, MOTO.front]) {
    const [cx, cy] = P(wx, wy);
    const r = MOTO.wheelR;
    c.ellipsoid(cx, cy, r, r * k, { mat: tyre, z: 1, round: 0.7 });
    c.ellipsoid(cx, cy, r * 0.66, r * 0.66 * k, {
      mat: rim,
      // Over the tyre's rounded relief (its middle stands r × round high).
      z: 1 + MOTO.wheelR * 0.75,
      round: 0.35,
      tex: (s) => {
        const a = Math.atan2((s.y - cy) / Math.max(0.3, k), s.x - cx) / (Math.PI * 2) - phase / 5;
        const q = Math.hypot(s.x - cx, (s.y - cy) / Math.max(0.3, k));
        if (q > r * 0.22 && q < r * 0.5 && frac(a * 5) < 0.5) s.tone -= 0.8;
        if (q <= r * 0.22) s.tone += 0.3;
      },
    });
  }
  // The swing arm, the fork, the exhaust.
  c.stroke([P(-15.5, -5.6), P(-2, -10.5)], 1.0, 1.2, { mat: black, z: 1.7 });
  c.stroke([P(13.4, -22), P(16.5, -5.6)], 1.0, 0.9, { mat: chrome, z: 1.6 });
  c.stroke([P(-1, -8.4), P(-16, -8.4), P(-22.5, -10.6)], 1.1, 1.3, { mat: chrome, z: 2.6 });
  // The engine and the black belly pan under it.
  c.blob(poly([[-4, -16], [7, -16.6], [10.4, -12.6], [8, -8.2], [-4, -8.2], [-6, -11.4]]), 1.4, { mat: engine, z: 1.9, bulge: 0.9 });
  c.blob(poly([[-2, -9.6], [9.4, -9.8], [12.2, -12.2], [10.6, -8.2], [-1.4, -7.4]]), 0.8, { mat: black, z: 2.2, bulge: 0.6 });
  // The rear: the pannier (white, red bars), the top box with a red band, the tail light.
  c.blob(poly([[-24.4, -19.2], [-12.6, -19.2], [-12.2, -11.6], [-23.4, -11.6]]), 1.2, { mat: white, z: 3, bulge: 0.8, tex: bars(-22.8, -13.6, -17.8, -12.8) });
  c.blob(poly([[-23.8, -28.6], [-14.6, -28.6], [-14, -21.4], [-23.6, -21.4]]), 1.4, {
    mat: white,
    z: 2.8,
    bulge: 1,
    tex: (s) => {
      if (k === 1 && s.y - AY - t.dy > -23.4) s.mat = red;
    },
  });
  const [tx, ty] = P(-24.8, -16.4);
  c.ellipsoid(tx, ty, 0.9, 1.4 * k, { mat: tail, z: 3.4 });
  // The side panel under the seat (white, red bars), the seat, the tank.
  c.blob(poly([[-12.8, -20], [0.4, -20], [-1, -15.6], [-11.4, -14.8]]), 1, { mat: white, z: 3.1, bulge: 0.7, tex: bars(-11.6, -1.6, -19.4, -15.4) });
  c.capsule(...P(-13.5, -21.4), ...P(1, -21.8), 1.8 * Math.max(0.5, k), 1.7 * Math.max(0.5, k), { mat: seat, z: 3.2 });
  c.blob(poly([[0.4, -21.8], [8.6, -25.6], [10, -19.8], [1, -18.4]]), 1.3, { mat: white, z: 3.3, bulge: 1 });
  // The fairing (white, three red bars), the smoked screen leaning back, the headlight, the mirror; the bars.
  c.blob(poly([[8.8, -26.8], [12.6, -29.8], [17.2, -28.6], [20.8, -22.8], [21.4, -17.8], [19.4, -14], [13.4, -12.4], [9.4, -15.2]]), 1.5, {
    mat: white,
    z: 3.6,
    bulge: 1,
    tex: bars(10.4, 18.6, -24.2, -14.4),
  });
  c.poly(poly([[12.4, -29.6], [13.4, -35], [16.4, -35.2], [17.4, -28.8]]), {
    mat: screen,
    z: 3.8,
    tex: (s) => {
      // A pale streak across the smoked screen.
      const u = s.x - AX - 13.4 + (s.y - AY + 35) * 0.25;
      if (u > 0.6 && u < 1.4) s.tone += 0.7;
    },
  });
  const [hx, hy] = P(20.2, -20.4);
  c.ellipsoid(hx, hy, 1.1, 1.5 * k, { mat: lamp, z: 4 });
  c.stroke([P(7.6, -27.2), P(11.4, -27.6)], 0.65, 0.65, { mat: black, z: 4.2 });
  const [mx, my] = P(16.8, -28.6);
  c.ellipsoid(mx, my, 1.2, 0.8 * k, { mat: black, z: 4 });
  // The front mudguard.
  c.stroke([P(12, -10.6), P(16.5, -11.8), P(20.8, -9.8)], 0.8, 0.7, { mat: white, z: 2.4 });
  if (d > 1) {
    const [gx, gy] = P(4, -23.6);
    c.dot(gx, gy, top('snow', d, 0));
  }
  return finishA(c, 0.3);
}

// ---------------------------------------------------------------------------------------------
// Props: the baton, the fine sticker, the ticket book
// ---------------------------------------------------------------------------------------------

const PROP = 17;
const PG = 8;

/** A black baton along `deg` (0 = forward, −90 = up) in a 17 × 17 box, the grip at (8, 8). */
function batonBuf(deg: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(PROP, PROP, d);
  const black = mat(c, 'black', { spec: 0.9, shine: 36, lo1: 0, hi1: 3, lo: 1, hi: 4, rim: 0.3 });
  const grip = mat(c, 'steel', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const a = (deg * Math.PI) / 180;
  const P = (s: number): [number, number] => [PG + 0.5 + s * Math.cos(a), PG + 0.5 + s * Math.sin(a)];
  c.capsule(...P(-2), ...P(7.4), 0.85, 0.75, { mat: black, z: 1 });
  c.capsule(...P(-2.6), ...P(-1.4), 1.0, 1.0, { mat: grip, z: 1.2 });
  return finishA(c, 0.2);
}

/** The fine sticker card (13 × 9 with its outline): yellow, a red band with `BOETE` (2× / 4×), ruled lines. Curled: 1. */
export function fineBuf(curl: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(STICKER.w, STICKER.h, d);
  const card = mat(c, 'gold', { spec: 0.25, shine: 20, lo1: 1, hi1: 3, lo: 4, hi: 6, wrap: 0.15 });
  const band = mat(c, 'red', { spec: 0.3, lo1: 1, hi1: 3, lo: 3, hi: 5 });
  const white = top('snow', d, 0);
  // Our own 3 × 5 lettering (traffic/lettering.ts): one art px per bit at 2× and 4×.
  const s = d >= 4 ? 0.25 : 0.5;
  c.box(1, 1, STICKER.w - 2, STICKER.h - 2, {
    mat: card,
    z: 1,
    r: 0.4,
    bevel: 0.4,
    tex: (t) => {
      // A curled corner (frame 1): the lower right lifts and shades.
      if (curl > 0 && t.x + t.y > STICKER.w + STICKER.h - 7) {
        t.nx += 0.6;
        t.ny += 0.6;
        t.tone -= 0.25;
      }
      if (t.y < 3.7) {
        t.mat = band;
        if (d > 1 && glyphHitC('BOETE', STICKER.w / 2, 2.35, s, 1, t.x, t.y)) t.fix = white;
      }
    },
  });
  // Ruled lines (the fine's small print).
  const ink = top('black', d, 2);
  for (let r = 0; r < 2; r++) {
    const y = 4.8 + r * 1.6;
    const x1 = STICKER.w - 2.5 - (r === 1 ? 3 : 0);
    for (let x = 2; x < x1; x += 1 / d) c.dot(x, y, ink);
  }
  return finishA(c, 0.15);
}

/** The ticket book (open or shut) in a 13 × 9 box. */
function bookBuf(open: boolean, d: Dn): PixelBuffer {
  const c = new HdCanvas(13, 9, d);
  const cover = mat(c, 'navy', { spec: 0.35, shine: 16, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const paper = mat(c, 'snow', { spec: 0.1, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.15 });
  if (open) {
    c.box(1, 2, 11, 6, { mat: cover, z: 0, r: 0.4, bevel: 0.45 });
    c.box(1.6, 2.4, 4.6, 5, { mat: paper, z: 0.6 });
    c.box(6.8, 2.4, 4.6, 5, { mat: paper, z: 0.6 });
    const ink = top('black', d, 2);
    for (let r = 0; r < 3; r++) for (let x = 2.2; x < 5.6; x += 1 / d) c.dot(x, 3.6 + r * 1.2, ink);
  } else {
    c.box(3, 1.5, 6, 7, { mat: cover, z: 0, r: 0.4, bevel: 0.45 });
    c.box(8.2, 2, 0.8, 6, { mat: paper, z: 0.4 });
  }
  return finishA(c, 0.2);
}

/** A prop at the frame's `hand` point (its grip at the hand). */
function propAt(f: Frame, buf: PixelBuffer, gx: number, gy: number, d: Dn, behind = false): Piece | null {
  const h = f.pts?.hand;
  if (!h) return null;
  const p: Piece = { buf, x: Math.round(h[0]) - gx, y: Math.round(h[1]) - gy, behind };
  if (d !== 1) p.density = d;
  return p;
}

// ---------------------------------------------------------------------------------------------
// The officer on the seat
// ---------------------------------------------------------------------------------------------

/** Seated legs: the boots on the pegs. */
const LEGS: Pick<Pose, 'legN' | 'legF'> = { legN: { hip: 68, knee: 78 }, legF: { hip: 58, knee: 88 } };
const grip = (x: number, y: number): Pose['armN'] => ({ to: [x, y], hand: 'grip' });

/** Riding: both hands on the bars, a bob between frames. */
function ridePose(k: number, extra: Pose = {}): Pose {
  return { ...LEGS, lean: 16 + (k % 2), hunch: k % 2, armN: grip(11.4, 5.6 + (k % 2) * 0.5), armF: grip(10.6, 5.2 + (k % 2) * 0.5), head: { dy: k % 2 }, ...extra };
}

/** The far hand stays on the bar while the near arm works. */
const FAR_ON_BAR: Pose['armF'] = grip(10.6, 5.2);

interface Held {
  kind: 'baton' | 'fine' | 'book-open' | 'book-shut' | 'page';
  deg?: number;
}

/** The officer frame placed hip-on-seat, with what he holds; its `hand` point in bike coordinates. */
function officer(pose: Pose, t: Tf, d: Dn, held: Held | null): { piece: Piece; pts: FramePoints } {
  let f: Frame = renderHuman(HANDHAVER_STYLE, { weapon: 'none', grounded: false, ...pose, rot: (pose.rot ?? 0) + t.rot }, 'full', d as Density);
  if (held) {
    let piece: Piece | null = null;
    if (held.kind === 'baton') piece = propAt(f, batonBuf(held.deg ?? -90, d), PG, PG, d);
    else if (held.kind === 'fine' || held.kind === 'page') piece = propAt(f, fineBuf(held.kind === 'page' ? 1 : 0, d), 5, 4, d);
    else piece = propAt(f, bookBuf(held.kind === 'book-open', d), 6, 4, d);
    if (piece) f = withPieces(f, [piece]);
  }
  const fh = f.pts?.hip ?? [0, -15];
  const [sx, sy] = tf(t, MOTO.hip[0], MOTO.hip[1]);
  const x = Math.round(sx - AX - fh[0] - f.ox);
  const y = Math.round(sy - AY - fh[1] - f.oy);
  const piece: Piece = { buf: f.buf, x, y };
  if (d !== 1) piece.density = d;
  const pts: FramePoints = {};
  const h = f.pts?.hand;
  if (h) pts.hand = [x + f.ox + h[0], y + f.oy + h[1]];
  return { piece, pts };
}

interface ComboOpts {
  t?: Tf;
  phase?: number;
  rider?: Pose | null;
  held?: Held | null;
}

/** One frame: the bike and the officer. */
function combo(o: ComboOpts, d: Dn): Frame {
  const t = o.t ?? FLAT;
  const buf = bikeBuf(t, o.phase ?? 0, d);
  const base: Frame = d === 1 ? { buf, ox: AX, oy: AY } : { buf, ox: AX, oy: AY, density: d };
  if (!o.rider) return fit(base, d);
  const r = officer(o.rider, t, d, o.held ?? null);
  return fit(withPieces(base, [r.piece], r.pts), d);
}

/** Crop / pad a composed frame back to the fixed canvas (the same rectangle at every density). */
function fit(f: Frame, d: Dn): Frame {
  const W = CW * d;
  const H = CH * d;
  if (f.buf.w === W && f.buf.h === H && f.ox === AX && f.oy === AY) return f;
  const left = (AX - f.ox) * d;
  const topY = (AY - f.oy) * d;
  const buf = f.buf.crop(-left, -topY, W, H);
  return { buf, ox: AX, oy: AY, ...(f.pts ? { pts: f.pts } : {}), ...(d !== 1 ? { density: d } : {}) };
}

// ---------------------------------------------------------------------------------------------
// Strips
// ---------------------------------------------------------------------------------------------

export function rideFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((k) => combo({ phase: k / 4, rider: ridePose(k) }, d));
}

/** The baton tell: drawn (up and forward), raised, cocked overhead and back. */
const BATON_TELL: ReadonlyArray<[Pose, number]> = [
  [{ ...LEGS, lean: 10, armN: { sh: 60, el: 70, hand: 'fist' }, armF: FAR_ON_BAR, expr: 'normal' }, -80],
  [{ ...LEGS, lean: 4, armN: { sh: 150, el: 30, hand: 'fist' }, armF: FAR_ON_BAR, expr: 'shout' }, -125],
  [{ ...LEGS, lean: 0, armN: { sh: -170, el: 50, hand: 'fist' }, armF: FAR_ON_BAR, expr: 'shout' }, -165],
];
/** The swing up at the window (the baton forward and up), the follow-through. */
const BATON_GO: ReadonlyArray<[Pose, number]> = [
  [{ ...LEGS, lean: 14, armN: { sh: 135, el: 0, hand: 'fist' }, armF: FAR_ON_BAR, expr: 'shout' }, -45],
  [{ ...LEGS, lean: 18, armN: { sh: 75, el: 10, hand: 'fist' }, armF: FAR_ON_BAR, expr: 'normal' }, 15],
];

export function tellBatonFrames(d: Dn): Frame[] {
  return BATON_TELL.map(([p, deg], k) => combo({ phase: k / 3, rider: p, held: { kind: 'baton', deg } }, d));
}

export function batonFrames(d: Dn): Frame[] {
  return BATON_GO.map(([p, deg], k) => combo({ phase: k / 2, rider: p, held: { kind: 'baton', deg } }, d));
}

/** The sticker tell: out of the vest, held up, peeled (cocked); the slap up at the glass, the arm back. */
const STICK_TELL: readonly Pose[] = [
  { ...LEGS, lean: 12, armN: { sh: 20, el: 110, hand: 'open' }, armF: FAR_ON_BAR, expr: 'normal' },
  { ...LEGS, lean: 8, armN: { sh: 140, el: 30, hand: 'open' }, armF: FAR_ON_BAR, head: { tilt: -6 }, expr: 'normal' },
  { ...LEGS, lean: 4, armN: { sh: -172, el: 40, hand: 'open' }, armF: FAR_ON_BAR, expr: 'shout' },
];
const STICK_GO: readonly Pose[] = [
  { ...LEGS, lean: 14, armN: { sh: 150, el: 0, hand: 'open' }, armF: FAR_ON_BAR, expr: 'shout' },
  { ...LEGS, lean: 16, armN: { sh: 60, el: 40, hand: 'open' }, armF: FAR_ON_BAR, expr: 'normal' },
];

export function tellStickerFrames(d: Dn): Frame[] {
  return STICK_TELL.map((p, k) => combo({ phase: k / 3, rider: p, held: { kind: 'fine' } }, d));
}

export function stickerFrames(d: Dn): Frame[] {
  return STICK_GO.map((p, k) => combo({ phase: k / 2, rider: p, held: k === 0 ? { kind: 'fine' } : null }, d));
}

export function wobbleFrames(d: Dn): Frame[] {
  return [-5, 4].map((rot, k) => combo({ t: { rot, squash: 1, dy: rot > 0 ? -1 : 0 }, phase: k / 2, rider: ridePose(0, { lean: 4, expr: 'panic' }) }, d));
}

/** The gloat: writes in the book (2), tears the page off, holds it up, lets it go with the book shut. */
export function gloatFrames(d: Dn): Frame[] {
  const book: Pose['armF'] = { to: [7, 5], hand: 'open' };
  const keys: ReadonlyArray<[Pose, Held | null]> = [
    [{ ...LEGS, lean: 6, armN: { to: [7.6, 3.6], hand: 'fist' }, armF: book, head: { tilt: 8 }, expr: 'normal' }, { kind: 'book-open' }],
    [{ ...LEGS, lean: 6, armN: { to: [8.4, 4.2], hand: 'fist' }, armF: book, head: { tilt: 8, dy: 1 }, expr: 'blink' }, { kind: 'book-open' }],
    [{ ...LEGS, lean: 2, armN: { sh: 60, el: 60, hand: 'open' }, armF: book, expr: 'normal' }, { kind: 'page' }],
    [{ ...LEGS, lean: 0, armN: { sh: 150, el: 20, hand: 'open' }, armF: FAR_ON_BAR, expr: 'normal' }, { kind: 'page' }],
    [{ ...LEGS, lean: 4, armN: { sh: 10, el: 60, hand: 'fist' }, armF: FAR_ON_BAR, expr: 'normal' }, { kind: 'book-shut' }],
  ];
  return keys.map(([p, held], k) => combo({ phase: 0, rider: p, held, t: { rot: 0, squash: 1, dy: k === 3 ? -1 : 0 } }, d));
}

export function cowerFrames(d: Dn): Frame[] {
  return [0, 1].map((k) =>
    combo(
      {
        t: { rot: k ? 2 : -2, squash: 1, dy: k ? -1 : 0 },
        rider: { ...LEGS, lean: 26, hunch: 2, armN: { to: [2, -10 + k], hand: 'open' }, armF: FAR_ON_BAR, head: { dy: 1, tilt: 10 }, expr: 'panic' },
      },
      d,
    ),
  );
}

/** The riderless bike tipping over (0, 1) and lying on its side, seen flat (2). */
export function downFrames(d: Dn): Frame[] {
  return [0.8, 0.55, 0.32].map((squash, k) => combo({ t: { rot: 0, squash, dy: 0 }, phase: k / 3 }, d));
}

/** The officer rolling in a tuck (bloodless). */
export function tumbleFrames(d: Dn): Frame[] {
  return [0, 90, 180, 270].map((rot) =>
    renderHuman(HANDHAVER_STYLE, { weapon: 'none', grounded: false, crouch: 1, lean: 30, armN: { sh: 40, el: 120, hand: 'fist' }, armF: { sh: 30, el: 120, hand: 'fist' }, rot, expr: 'hurt', dy: -6 }, 'full', d as Density),
  );
}

/** The officer sitting dazed on the hard shoulder (legs out, propped on his hands), blinking. */
export function sitFrames(d: Dn): Frame[] {
  return [0, 1].map((k) =>
    renderHuman(
      HANDHAVER_STYLE,
      { legN: { hip: 88, knee: 6, foot: 20 }, legF: { hip: 80, knee: 14, foot: 20 }, lean: -14, armN: { sh: -30, el: 10, hand: 'open' }, armF: { sh: -40, el: 10, hand: 'open' }, head: { tilt: k ? 8 : -4 }, expr: k ? 'blink' : 'dazed', dy: 8 },
      'full',
      d as Density,
    ),
  );
}

/** The fine sticker: flat (0), curling (1); centre anchor. */
export function fineFrames(d: Dn): Frame[] {
  return [0, 1].map((k) => {
    const buf = fineBuf(k, d);
    const f: Frame = { buf, ox: (STICKER.w - 1) / 2, oy: (STICKER.h - 1) / 2 };
    return d === 1 ? f : { ...f, density: d };
  });
}

/** The HUD icon: the sticker card (top-left anchor). */
export function iconFrames(d: Dn): Frame[] {
  const buf = fineBuf(0, d);
  const f: Frame = { buf, ox: 0, oy: 0 };
  return [d === 1 ? f : { ...f, density: d }];
}

/** Strip timings (ticks per frame); the gloat's frames have their own durations. */
export const MOTO_TPF = { ride: 4, tell: 9, strike: 4, wobble: 5, cower: 3, down: 6 } as const;
export const MOTO_GLOAT_TIMING: readonly number[] = [10, 10, 12, 14, 60];
