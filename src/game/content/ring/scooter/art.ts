/**
 * Sprites of content area `ring/scooter` — the scooter gang (docs/design/ring.md §5.1, §9;
 * docs/ART_GUIDE.md "UHD art"). ONE density-generic drawer per strip: the scooter is drawn on an
 * `HdCanvas` with the ramps of the density (`PAL` at 1×, `PAL_HD` at 2× / 4×; content/stag/kit.art.ts)
 * and the two riders come from the humanoid rig at the same density (`renderHuman(…, d)`), placed
 * hip-on-seat as the ams riders are (content/locals/rider.art.ts). Outline A. Bloodless.
 *
 * Per look L (0 red scooter, 1 sky-blue, 2 black; each with its own driver and pillion), under
 * `ring/scooter/<L>/` (anchor: the road under the middle of the scooter, facing right):
 * - `ride` (4): wheels turning, the riders bobbing; the pillion holds on.
 * - `tell-throw` (3): the pillion turns round on the seat and raises a bottle behind his head (the
 *   telegraph, ≥ 18 ticks: the entity holds the last frame); `throw` (2): the throw back over the
 *   tail and the follow-through (point `hand`: where the bottle leaves).
 * - `tell-shoot` (3): the pillion turns round and levels a pistol backwards (point `muzzle`); `shoot`
 *   (2): the shot and the recoil.
 * - `wobble` (2): shoved (the scooter tilts, both riders lean).
 * - `gloat` (4, deferred): slow wheelies in place — rocking on the back wheel, both riders bobbing
 *   along, the pillion leaning back cool (no pointing, no laughing).
 * - `cower` (2, deferred): both duck behind their arms, the scooter rocking.
 * - `down` (3): the riderless scooter tipping over and lying on its side (seen flat).
 * - `driver-tumble` / `pillion-tumble` (4): a rider rolling in a tuck; `driver-sit` / `pillion-sit` (2):
 *   sitting dazed on the hard shoulder (a blink).
 * Shared: `ring/scooter/bottle` (8, centre): the thrown bottle turning end over end.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';

type FramePoints = Record<string, [number, number]>;
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';

type Pt = readonly [number, number];

// ---------------------------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------------------------

export interface ScooterLook {
  /** Body paint ramp. */
  paint: string;
  driver: HumanStyle;
  pillion: HumanStyle;
}

export const SCOOTER_LOOKS: readonly ScooterLook[] = [
  {
    paint: 'red',
    driver: { skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'cap', gear: 'black', top: 'black', topType: 'jacket', shirt: 'snow', pants: 'navy', boots: 'snow', build: 'normal' },
    pillion: { skin: 'skinA', hair: 'hairC', hairStyle: 'short', headgear: 'hood', gear: 'teal', top: 'teal', topType: 'sweater', pants: 'stone', boots: 'black', build: 'slim' },
  },
  {
    paint: 'sky',
    driver: { skin: 'skinC', hair: 'hairA', hairStyle: 'buzz', headgear: 'helmet', gear: 'gold', top: 'olive', topType: 'jacket', shirt: 'black', pants: 'black', boots: 'black', build: 'heavy' },
    pillion: { skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'bandana', gear: 'red', top: 'red', topType: 'tee', pants: 'navy', boots: 'snow', build: 'slim' },
  },
  {
    paint: 'black',
    driver: { skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'cap-back', gear: 'orange', top: 'orange', topType: 'sweater', pants: 'black', boots: 'snow', build: 'slim' },
    pillion: { skin: 'skinC', hair: 'hairA', hairStyle: 'buzz', headgear: 'bobble', gear: 'purple', top: 'purple', topType: 'sweater', pants: 'stone', boots: 'snow', build: 'normal' },
  },
];

// ---------------------------------------------------------------------------------------------
// Geometry (local: anchor = the road under the middle, facing right)
// ---------------------------------------------------------------------------------------------

export const SCOOTER = {
  wheelR: 4.5,
  rear: [-14.5, -4.5] as Pt,
  front: [15.5, -4.5] as Pt,
  /** Hips of the driver and the pillion on the seat. */
  driverHip: [0, -19.5] as Pt,
  pillionHip: [-9.5, -19] as Pt,
  /** The handlebar grips. */
  bar: [11.5, -26] as Pt,
  /** Length (the depth slab's x range is ±len/2). */
  len: 40,
} as const;

/** Canvas: x −36 … 36, y −58 … 3 (anchor 36, 58). */
const CW = 72;
const CH = 61;
const AX = 36;
const AY = 58;

/** A transform of local points: a turn about the rear wheel's ground contact, a vertical squash. */
interface Tf {
  rot: number;
  squash: number;
  dy: number;
}
const FLAT: Tf = { rot: 0, squash: 1, dy: 0 };

function tf(t: Tf, x: number, y: number): [number, number] {
  const px = SCOOTER.rear[0];
  const a = (t.rot * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const u = x - px;
  const v = y * t.squash;
  return [px + u * cs - v * sn + AX, u * sn + v * cs + AY + t.dy];
}

const frac = (v: number): number => v - Math.floor(v);

/** The scooter itself (no riders) at density d, wheels turned by `phase` (0 … 1). */
function scooterBuf(look: ScooterLook, t: Tf, phase: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(CW, CH, d);
  const paint = mat(c, look.paint, { spec: 0.9, shine: 44, lo1: 0, hi1: 3, lo: look.paint === 'black' ? 1 : 2, hi: look.paint === 'black' ? 5 : 6, rim: 0.3, bounce: 0.3 });
  const black = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const seat = mat(c, 'black', { spec: 0.8, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const chrome = mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.4 });
  const tyre = mat(c, 'black', { spec: 0.3, shine: 12, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const lamp = mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const tail = mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const k = t.squash;
  const P = (x: number, y: number): [number, number] => tf(t, x, y);
  const poly = (pts: ReadonlyArray<Pt>): Array<[number, number]> => pts.map(([x, y]) => P(x, y));
  // Wheels: a black tyre, a steel rim with five spokes turning.
  for (const [wx, wy] of [SCOOTER.rear, SCOOTER.front]) {
    const [cx, cy] = P(wx, wy);
    const r = SCOOTER.wheelR;
    c.ellipsoid(cx, cy, r, r * k, { mat: tyre, z: 1, round: 0.7 });
    c.ellipsoid(cx, cy, r * 0.55, r * 0.55 * k, {
      mat: chrome,
      z: 1.5,
      round: 0.5,
      tex: (s) => {
        const a = Math.atan2((s.y - cy) / Math.max(0.3, k), s.x - cx) / (Math.PI * 2) - phase / 5;
        if (frac(a * 5) < 0.45) s.tone -= 0.6;
      },
    });
  }
  // The exhaust under the rear, the rear rack, the fork.
  c.stroke([P(-6, -5.6), P(-19, -6.4), P(-21.5, -7.6)], 1.0, 0.9, { mat: chrome, z: 1.8 });
  c.stroke([P(-21.5, -18.6), P(-16, -19.2)], 0.55, 0.55, { mat: chrome, z: 2.4 });
  c.stroke([P(13.4, -22), P(15.4, -5.2)], 0.85, 0.85, { mat: chrome, z: 1.6 });
  // The rear cowl over the back wheel, the floorboard, the leg shield and the front fender.
  c.blob(poly([[-21.5, -8.5], [-20.6, -13.6], [-16.4, -17.8], [-6, -18.4], [-0.6, -16.4], [0.6, -10.2], [-4, -7.6], [-18, -7.2]]), 2, { mat: paint, z: 2, bulge: 1.1 });
  c.blob(poly([[-3, -9.2], [11.5, -9.2], [11.5, -6.4], [-3, -6.4]]), 0.8, { mat: paint, z: 2.1, bulge: 0.6, tone: -0.15 });
  c.blob(poly([[9.6, -6.4], [12.6, -6.6], [15.8, -19], [15.6, -24.6], [12.6, -24.6], [10.6, -17]]), 1.4, { mat: paint, z: 2.2, bulge: 0.9 });
  c.blob(poly([[11.2, -8.6], [13.2, -10.8], [18.4, -10.8], [20.4, -8.2], [19.2, -7.8], [12.6, -8.2]]), 0.9, { mat: paint, z: 2.3, bulge: 0.7 });
  // The long dual seat.
  c.capsule(...P(-17.5, -19.4), ...P(1.5, -19.2), 1.7 * Math.max(0.5, k), 1.6 * Math.max(0.5, k), { mat: seat, z: 3 });
  // The headset with the headlight, the handlebar, the mirror.
  c.blob(poly([[11.2, -27], [16.6, -27.2], [17.6, -24.4], [12, -24]]), 0.9, { mat: paint, z: 3.2, bulge: 0.8 });
  const [hx, hy] = P(17.2, -25.6);
  c.ellipsoid(hx, hy, 1.2, 1.2 * k, { mat: lamp, z: 3.6 });
  c.stroke([P(10.4, -27.4), P(13.4, -26.8)], 0.7, 0.7, { mat: black, z: 3.8 });
  c.stroke([P(14.6, -27.2), P(14, -31.4)], 0.35, 0.35, { mat: chrome, z: 3.4 });
  const [mx, my] = P(13.8, -31.8);
  c.ellipsoid(mx, my, 1.1, 0.8 * k, { mat: chrome, z: 3.5 });
  const [tx, ty] = P(-21.4, -12.4);
  c.ellipsoid(tx, ty, 0.9, 1.2 * k, { mat: tail, z: 3 });
  if (d > 1) {
    const [gx, gy] = P(-10, -17.6);
    c.dot(gx, gy, top('snow', d, 1));
  }
  return finishA(c, 0.3);
}

// ---------------------------------------------------------------------------------------------
// The bottle
// ---------------------------------------------------------------------------------------------

/** Bottle box (logical px) and its middle. */
export const BOTTLE_BOX = 15;
const BG = 7;

/**
 * A brown beer bottle along `deg` (0 = neck forward, −90 = up) in a 15 × 15 box, its middle at
 * (7, 7) (the grip): amber-brown glass with a lit streak, a cream label, a gold cap.
 */
export function beerBottleBuf(deg: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(BOTTLE_BOX, BOTTLE_BOX, d);
  const glass = mat(c, 'brown', { spec: 1.3, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.4 });
  const label = mat(c, 'sand', { spec: 0.2, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const cap = mat(c, 'gold', { spec: 1.1, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const P = (s: number): [number, number] => [BG + 0.5 + s * ux, BG + 0.5 + s * uy];
  const part = c.newPart();
  const along = (x: number, y: number): number => (x - BG - 0.5) * ux + (y - BG - 0.5) * uy;
  c.capsule(...P(-4.2), ...P(0.8), 1.7, 1.7, {
    mat: glass,
    z: 1,
    part,
    tex: (t) => {
      const s = along(t.x, t.y);
      if (s > -3.2 && s < -0.6) t.mat = label;
    },
  });
  c.capsule(...P(0.8), ...P(3.4), 1.6, 0.8, { mat: glass, z: 1, part });
  c.capsule(...P(3.4), ...P(4.8), 0.8, 0.8, { mat: glass, z: 1.1, part });
  c.capsule(...P(4.9), ...P(5.5), 0.95, 0.95, { mat: cap, z: 1.3 });
  return finishA(c, 0.2);
}

/** The bottle held at the frame's `hand` point (the grip a little along `deg`). */
function bottleAtHand(f: Frame, deg: number, d: Dn): Piece | null {
  const h = f.pts?.hand;
  if (!h) return null;
  const gx = Math.round(h[0] + Math.cos((deg * Math.PI) / 180) * 1.5);
  const gy = Math.round(h[1] + Math.sin((deg * Math.PI) / 180) * 1.5);
  const p: Piece = { buf: beerBottleBuf(deg, d), x: gx - BG, y: gy - BG };
  if (d !== 1) p.density = d;
  return p;
}

// ---------------------------------------------------------------------------------------------
// Riders
// ---------------------------------------------------------------------------------------------

type Who = 'driver' | 'pillion';

/** Seated legs: the driver's feet on the floorboard, the pillion's on the pegs. */
const LEGS: Readonly<Record<Who, Pick<Pose, 'legN' | 'legF'>>> = {
  driver: { legN: { hip: 62, knee: 70 }, legF: { hip: 52, knee: 80 } },
  pillion: { legN: { hip: 48, knee: 82 }, legF: { hip: 38, knee: 92 } },
};

const grip = (x: number, y: number): Pose['armN'] => ({ to: [x, y], hand: 'grip' });

/** The driver's upper body: hands on the bar, a bob between frames. */
function driverPose(k: number, extra: Pose = {}): Pose {
  return { ...LEGS.driver, lean: 12 + (k % 2), hunch: k % 2, armN: grip(9.6, 3.2 + (k % 2) * 0.5), armF: grip(8.8, 2.8 + (k % 2) * 0.5), head: { dy: k % 2 }, ...extra };
}

/** The pillion facing forward, holding on to the driver's waist. */
function pillionPose(k: number, extra: Pose = {}): Pose {
  return { ...LEGS.pillion, lean: 6, hunch: (k + 1) % 2, armN: { to: [6.5, 8], hand: 'grip' }, armF: { to: [6, 7.4], hand: 'grip' }, head: { dy: (k + 1) % 2 }, ...extra };
}

/** Throw keys of the pillion (facing right; drawn mirrored: he faces back). */
const THROW_TELL: readonly Pose[] = [
  { lean: -4, armN: { sh: -60, el: 70, hand: 'fist' }, armF: { to: [6, 6], hand: 'grip' }, expr: 'normal' },
  { lean: -10, armN: { sh: -140, el: 60, hand: 'fist' }, armF: { to: [6, 6], hand: 'grip' }, expr: 'shout' },
  { lean: -14, armN: { sh: -165, el: 50, hand: 'fist' }, armF: { sh: 30, el: 30, hand: 'open' }, expr: 'shout' },
];
const THROW_GO: readonly Pose[] = [
  { lean: 10, armN: { to: [10, -6], hand: 'open' }, armF: { sh: 20, el: 30, hand: 'open' }, expr: 'shout' },
  { lean: 12, armN: { sh: 80, el: 10, hand: 'open' }, armF: { to: [6, 6], hand: 'grip' }, expr: 'normal' },
];
/** Bottle angle (deg) per throw-tell frame: lifted, cocked overhead. */
const TELL_BOTTLE = [-40, -110, -140];

const AIM_TELL: readonly Pose[] = [
  { lean: 0, weapon: 'pistol', aim: 'down', armF: { to: [6, 6], hand: 'grip' }, expr: 'normal' },
  { lean: 2, weapon: 'pistol', aim: 'fwd', armF: { to: [6, 6], hand: 'grip' }, expr: 'shout' },
  { lean: 2, weapon: 'pistol', aim: 'fwd', armF: { to: [6, 6], hand: 'grip' }, expr: 'shout' },
];
const SHOOT: readonly Pose[] = [
  { lean: 2, weapon: 'pistol', aim: 'fwd', recoil: 1, armF: { to: [6, 6], hand: 'grip' }, expr: 'shout' },
  { lean: 0, weapon: 'pistol', aim: 'fwd', armF: { to: [6, 6], hand: 'grip' }, expr: 'shout' },
];

/** A rider frame placed hip-on-seat: the piece, plus its named points in scooter coordinates. */
function rider(style: HumanStyle, pose: Pose, hip: Pt, t: Tf, back: boolean, d: Dn, add?: (f: Frame) => Frame): { piece: Piece; pts: FramePoints } {
  let f: Frame = renderHuman(style, { weapon: 'none', grounded: false, ...pose, rot: (pose.rot ?? 0) + (back ? -t.rot : t.rot) }, 'full', d as Density);
  if (add) f = add(f);
  const fh = f.pts?.hip ?? [0, -15];
  const W = f.buf.w / d;
  const [sx, sy] = tf(t, hip[0], hip[1]);
  const hx = sx - AX;
  const hy = sy - AY;
  let buf = f.buf;
  let x: number;
  if (back) {
    buf = buf.flipped(true);
    x = Math.round(hx + fh[0] - (W - 1 - f.ox));
  } else x = Math.round(hx - fh[0] - f.ox);
  const y = Math.round(hy - fh[1] - f.oy);
  const piece: Piece = { buf, x, y };
  if (d !== 1) piece.density = d;
  const pts: FramePoints = {};
  for (const name of ['hand', 'muzzle'] as const) {
    const p = f.pts?.[name];
    if (!p) continue;
    // Point relative to the rider anchor → scooter anchor.
    const ax = back ? x + (W - 1 - f.ox) : x + f.ox;
    const ay = y + f.oy;
    pts[name] = [ax + (back ? -p[0] : p[0]), ay + p[1]];
  }
  return { piece, pts };
}

interface ComboOpts {
  t?: Tf;
  phase?: number;
  driver?: Pose | null;
  pillion?: Pose | null;
  /** The pillion sits turned round (he throws / shoots backwards). */
  back?: boolean;
  /** The bottle in the pillion's hand (deg, as the stag kit's bottle). */
  bottle?: number;
}

/** One frame of a look: the scooter and its riders. */
function combo(look: ScooterLook, o: ComboOpts, d: Dn): Frame {
  const t = o.t ?? FLAT;
  const base: Frame = d === 1 ? { buf: scooterBuf(look, t, o.phase ?? 0, d), ox: AX, oy: AY } : { buf: scooterBuf(look, t, o.phase ?? 0, d), ox: AX, oy: AY, density: d };
  const pieces: Piece[] = [];
  let pts: FramePoints = {};
  if (o.pillion) {
    const add = o.bottle !== undefined ? (f: Frame): Frame => {
      const p = bottleAtHand(f, o.bottle as number, d);
      return p ? withPieces(f, [p]) : f;
    } : undefined;
    const r = rider(look.pillion, o.pillion, SCOOTER.pillionHip, t, o.back === true, d, add);
    pieces.push(r.piece);
    pts = r.pts;
  }
  if (o.driver) pieces.push(rider(look.driver, o.driver, SCOOTER.driverHip, t, false, d).piece);
  const out = pieces.length ? withPieces(base, pieces, pts) : base;
  return fit(out, d);
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

export function rideFrames(look: ScooterLook, d: Dn): Frame[] {
  return [0, 1, 2, 3].map((k) => combo(look, { phase: k / 4, driver: driverPose(k), pillion: pillionPose(k) }, d));
}

export function tellThrowFrames(look: ScooterLook, d: Dn): Frame[] {
  return THROW_TELL.map((p, k) => combo(look, { phase: k / 3, driver: driverPose(0), pillion: { ...LEGS.pillion, ...p }, back: true, bottle: TELL_BOTTLE[k] }, d));
}

export function throwFrames(look: ScooterLook, d: Dn): Frame[] {
  return THROW_GO.map((p, k) => combo(look, { phase: k / 2, driver: driverPose(k), pillion: { ...LEGS.pillion, ...p }, back: true }, d));
}

export function tellShootFrames(look: ScooterLook, d: Dn): Frame[] {
  return AIM_TELL.map((p, k) => combo(look, { phase: k / 3, driver: driverPose(0), pillion: { ...LEGS.pillion, ...p }, back: true }, d));
}

export function shootFrames(look: ScooterLook, d: Dn): Frame[] {
  return SHOOT.map((p, k) => combo(look, { phase: k / 2, driver: driverPose(k), pillion: { ...LEGS.pillion, ...p }, back: true }, d));
}

export function wobbleFrames(look: ScooterLook, d: Dn): Frame[] {
  return [-5, 4].map((rot, k) =>
    combo(look, { t: { rot, squash: 1, dy: rot > 0 ? -1 : 0 }, phase: k / 2, driver: driverPose(0, { lean: 4, expr: 'panic' }), pillion: pillionPose(0, { lean: -6, expr: 'panic' }) }, d),
  );
}

/** The gloat's slow wheelie (the bike rocks on its back wheel, both riders bob to it). */
export const GLOAT_TILT: readonly number[] = [-16, -20, -22, -19];
export function gloatFrames(look: ScooterLook, d: Dn): Frame[] {
  return GLOAT_TILT.map((rot, k) =>
    combo(
      look,
      {
        t: { rot, squash: 1, dy: 0 },
        phase: k / 8,
        driver: { ...LEGS.driver, lean: -6, armN: grip(10.4, 1.4), armF: grip(9.6, 1.2), head: { dy: k % 2, tilt: k % 2 ? 2 : -6 }, expr: k === 3 ? 'blink' : 'happy' },
        pillion: { ...LEGS.pillion, lean: -12, armN: { sh: -20, el: 70, hand: 'open' }, armF: { to: [6, 6], hand: 'grip' }, head: { dy: (k + 1) % 2, tilt: -8 }, expr: k === 1 ? 'blink' : 'normal' },
      },
      d,
    ),
  );
}

export function cowerFrames(look: ScooterLook, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    combo(
      look,
      {
        t: { rot: k ? 2 : -2, squash: 1, dy: k ? -1 : 0 },
        driver: { ...LEGS.driver, lean: -10, hunch: 1, armN: { to: [6, -7 + k], hand: 'open' }, armF: { to: [7, -9 + k], hand: 'open' }, head: { tilt: -6 }, expr: 'panic' },
        pillion: { ...LEGS.pillion, lean: 26, hunch: 2, armN: { to: [2, -10 + k], hand: 'open' }, armF: { to: [3, -10 + k], hand: 'open' }, head: { dy: 1, tilt: 10 }, expr: 'panic' },
      },
      d,
    ),
  );
}

/** The riderless scooter tipping over (0, 1) and lying on its side, seen flat (2). */
export function downFrames(look: ScooterLook, d: Dn): Frame[] {
  const tfs: Tf[] = [
    { rot: 0, squash: 0.8, dy: 0 },
    { rot: 0, squash: 0.55, dy: 0 },
    { rot: 0, squash: 0.32, dy: 0 },
  ];
  return tfs.map((t, k) => combo(look, { t, phase: k / 3 }, d));
}

/** A rider rolling in a tuck (feet anchor at the roll's middle). */
export function tumbleFrames(style: HumanStyle, d: Dn): Frame[] {
  return [0, 90, 180, 270].map((rot) => {
    const f = renderHuman(style, { weapon: 'none', grounded: false, crouch: 1, lean: 30, armN: { sh: 40, el: 120, hand: 'fist' }, armF: { sh: 30, el: 120, hand: 'fist' }, rot, expr: 'hurt', dy: -6 }, 'full', d as Density);
    return f;
  });
}

/** A rider sitting dazed on the hard shoulder (legs out, propped on the hands), blinking. */
export function sitFrames(style: HumanStyle, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    renderHuman(style, { legN: { hip: 88, knee: 6, foot: 20 }, legF: { hip: 80, knee: 14, foot: 20 }, lean: -14, armN: { sh: -30, el: 10, hand: 'open' }, armF: { sh: -40, el: 10, hand: 'open' }, head: { tilt: k ? 8 : -4 }, expr: k ? 'blink' : 'hurt', dy: 8 }, 'full', d as Density),
  );
}

/** The thrown bottle turning end over end (8 frames, centre anchor). */
export function bottleFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const buf = beerBottleBuf(i * 45 - 90, d);
    return d === 1 ? { buf, ox: BG, oy: BG } : { buf, ox: BG, oy: BG, density: d };
  });
}

/** Strip timings (ticks per frame). */
export const SCOOTER_TPF = { ride: 4, tell: 7, throw: 5, shoot: 4, wobble: 5, gloat: 10, cower: 3, down: 6 } as const;

type Gen = (d: Dn) => Frame[];
/**
 * Cropped to the 1× frame's opaque box plus a 1 px margin, the same logical rectangle at every
 * density (the fixed canvas is mostly air: the tier-4 working set keeps only the box; the margin
 * keeps the HD art's sub-pixel overhang, which a plain trim would cut).
 */
function boxed(f: Frame, box: { x: number; y: number; w: number; h: number }, d: Dn): Frame {
  const buf = f.buf.crop(box.x * d, box.y * d, box.w * d, box.h * d);
  const ox = f.ox - box.x;
  const oy = f.oy - box.y;
  const pts = f.pts;
  return d === 1 ? { buf, ox, oy, ...(pts ? { pts } : {}) } : { buf, ox, oy, density: d, ...(pts ? { pts } : {}) };
}

/** The crop box of a 1× frame (its opaque box grown by 1 px, inside the frame). */
function boxOf(f1: Frame): { x: number; y: number; w: number; h: number } {
  const t = f1.buf.trimBounds();
  if (!t) return { x: 0, y: 0, w: f1.buf.w, h: f1.buf.h };
  const x = Math.max(0, t.x - 1);
  const y = Math.max(0, t.y - 1);
  return { x, y, w: Math.min(f1.buf.w, t.x + t.w + 1) - x, h: Math.min(f1.buf.h, t.y + t.h + 1) - y };
}

/** A strip at density d, each frame cropped to its 1× box (see `boxed`). */
function cropped(gen: Gen, d: Dn): Frame[] {
  const lo = gen(1);
  const fs = d === 1 ? lo : gen(d);
  return fs.map((f, i) => boxed(f, boxOf(lo[i]), d));
}

const def = (id: string, gen: Gen, o: { ticksPerFrame?: number; loop?: boolean; defer?: boolean } = {}): void =>
  defineSprite(id, () => cropped(gen, 1), { ...o, hd: (d) => cropped(gen, d as Dn) });

SCOOTER_LOOKS.forEach((look, L) => {
  const pre = `ring/scooter/${L}/`;
  def(pre + 'ride', (d) => rideFrames(look, d), { ticksPerFrame: SCOOTER_TPF.ride });
  def(pre + 'tell-throw', (d) => tellThrowFrames(look, d), { ticksPerFrame: SCOOTER_TPF.tell, loop: false });
  def(pre + 'throw', (d) => throwFrames(look, d), { ticksPerFrame: SCOOTER_TPF.throw, loop: false });
  def(pre + 'tell-shoot', (d) => tellShootFrames(look, d), { ticksPerFrame: SCOOTER_TPF.tell, loop: false });
  def(pre + 'shoot', (d) => shootFrames(look, d), { ticksPerFrame: SCOOTER_TPF.shoot, loop: false });
  def(pre + 'wobble', (d) => wobbleFrames(look, d), { ticksPerFrame: SCOOTER_TPF.wobble });
  def(pre + 'gloat', (d) => gloatFrames(look, d), { ticksPerFrame: SCOOTER_TPF.gloat, defer: true });
  def(pre + 'cower', (d) => cowerFrames(look, d), { ticksPerFrame: SCOOTER_TPF.cower, defer: true });
  def(pre + 'down', (d) => downFrames(look, d), { ticksPerFrame: SCOOTER_TPF.down, loop: false });
  def(pre + 'driver-tumble', (d) => tumbleFrames(look.driver, d), { ticksPerFrame: 4 });
  def(pre + 'pillion-tumble', (d) => tumbleFrames(look.pillion, d), { ticksPerFrame: 4 });
  def(pre + 'driver-sit', (d) => sitFrames(look.driver, d), { ticksPerFrame: 30 });
  def(pre + 'pillion-sit', (d) => sitFrames(look.pillion, d), { ticksPerFrame: 30 });
});
def('ring/scooter/bottle', bottleFrames, { ticksPerFrame: 3 });
