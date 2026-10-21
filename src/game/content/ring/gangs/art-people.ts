/**
 * The people of `ring/gangs` (docs/design/ring.md §5.2, §5.4, §9; docs/ART_GUIDE.md "UHD art"):
 * the humanoid rig at the density of the frame (`renderHuman(…, d)`), placed in the vehicle's
 * frame and cropped to the box it shows through (the van's hold, the caravan's roof hatch), so the
 * 1×, 2× and 4× frames share their logical box, anchor and points. Outline A (the rig's). Bloodless.
 * Our own looks (a courier gang in teal and pink, a caravan dad in a bucket hat); nobody points or
 * laughs (docs/research/mechanics.md §23).
 *
 * Van crew (`ring/parcel-van/crew/…`, the van anchor, box `VAN.crewBox`, kneeling in the hold and
 * facing back): `idle` (2) · `tell-throw` (3: picks a parcel up and lifts it over his head) ·
 * `throw` (2; point `hand`) · `tell-shoot` (3: levels a pistol backwards; point `muzzle`) · `shoot`
 * (2) · `gloat` (4, deferred: scans a parcel, the scanner's red line blinking) · `cower` (2,
 * deferred). Free-standing (feet anchor): `crew/tumble` (4) and `crew/sit` (2), the same for the
 * driver (`driver/…`), all deferred.
 * The courier (`ring/parcel-van/courier/…`, feet anchor, facing right): `walk` (4) · `stick` (3: the
 * NIET THUIS card in his hand, pressed on, a pat) · `cower` (2), deferred.
 * Caravan gunner (`ring/caravan/gunner/…`, the caravan anchor, box `CARAVAN.gunBox`, standing in the
 * roof hatch facing back; the roof hides his legs): `ride` (2) · `tell` (3; point `muzzle`) ·
 * `shoot` (2) · `gloat` (4, deferred: pours a coffee from his thermos and sips) · `cower` (2,
 * deferred: ducks into the hatch, hands on his hat); `tumble` (4) and `sit` (2), deferred.
 */
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { withSwing } from '../../../art/human-sprites';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { lineW } from './art-kit';
import { CARAVAN, VAN } from './geometry';

type FramePoints = Record<string, [number, number]>;

// ---------------------------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------------------------

/** The van's driver and the courier on foot: a teal polo, a pink cap. */
export const COURIER: HumanStyle = { skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'cap', gear: 'pink', top: 'teal', topType: 'polo', pants: 'navy', boots: 'black', build: 'normal', belt: 'black' };
/** The crew in the hold: a teal sweater, a pink bandana, work gloves. */
export const CREW: HumanStyle = { skin: 'skinC', hair: 'hairB', hairStyle: 'buzz', headgear: 'bandana', gear: 'pink', top: 'teal', topType: 'sweater', pants: 'stone', boots: 'snow', build: 'stocky', gloves: 'black' };
/** The caravan's gunner: a bucket hat, glasses and a moustache, an orange fleece. */
export const GUNNER: HumanStyle = { skin: 'skinA', hair: 'hairC', hairStyle: 'short', headgear: 'rainhat', gear: 'olive', top: 'orange', topType: 'jacket', shirt: 'sand', pants: 'olive', boots: 'brown', build: 'heavy', face: ['moustache', 'glasses'] };

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

/** A rig frame whose anchor (or its point `at`) lands at local (x, y), maybe mirrored. */
interface Placed {
  f: Frame;
  x: number;
  y: number;
  flip?: boolean;
  /** Place this point of the frame (e.g. 'hip') at (x, y) instead of the anchor. */
  at?: string;
}

/** Extra pieces in local coordinates (top-left), at the frame's density. */
interface Extra {
  buf: PixelBuffer;
  x: number;
  y: number;
  behind?: boolean;
}

/**
 * Compose rig frames and pieces in a box [x0, y0, w, h] (local px, the anchor at 0, 0) and crop to
 * it: the same logical rectangle at every density. Points `hand` / `muzzle` of the first frame come
 * along (local).
 */
function compose(box: readonly [number, number, number, number], parts: readonly Placed[], extras: readonly Extra[], d: Dn, pts: FramePoints = {}): Frame {
  const [x0, y0, w, h] = box;
  const base: Frame = d === 1 ? { buf: new PixelBuffer(w, h), ox: -x0, oy: -y0 } : { buf: new PixelBuffer(w * d, h * d), ox: -x0, oy: -y0, density: d };
  const pieces: Piece[] = [];
  const out: FramePoints = { ...pts };
  parts.forEach((p, i) => {
    const f = p.f;
    const W = f.buf.w / d;
    const ref = p.at ? f.pts?.[p.at] : undefined;
    const rx = ref ? ref[0] : 0;
    const ry = ref ? ref[1] : 0;
    const ax = p.flip ? W - 1 - f.ox : f.ox;
    const px = Math.round(p.x - (p.flip ? -rx : rx) - ax);
    const py = Math.round(p.y - ry - f.oy);
    const piece: Piece = { buf: p.flip ? f.buf.flipped(true) : f.buf, x: px, y: py };
    if (d !== 1) piece.density = d;
    pieces.push(piece);
    if (i === 0) {
      for (const name of ['hand', 'muzzle'] as const) {
        const q = f.pts?.[name];
        if (!q || out[name]) continue;
        const lx = px + ax + (p.flip ? -q[0] : q[0]);
        out[name] = [lx, py + f.oy + q[1]];
      }
    }
  });
  for (const e of extras) {
    const piece: Piece = { buf: e.buf, x: e.x, y: e.y, behind: e.behind };
    if (d !== 1) piece.density = d;
    pieces.push(piece);
  }
  const all = withPieces(base, pieces, out);
  const buf = all.buf.crop((all.ox + x0) * d, (all.oy + y0) * d, w * d, h * d);
  const has = Object.keys(out).length > 0;
  if (d === 1) return has ? { buf, ox: -x0, oy: -y0, pts: out } : { buf, ox: -x0, oy: -y0 };
  return has ? { buf, ox: -x0, oy: -y0, pts: out, density: d } : { buf, ox: -x0, oy: -y0, density: d };
}

const human = (style: HumanStyle, pose: Pose, d: Dn): Frame => renderHuman(style, { weapon: 'none', ...pose }, 'full', d as Density);

// ---------------------------------------------------------------------------------------------
// Props: a parcel in the hands, the hand scanner, the card, the thermos and the cup
// ---------------------------------------------------------------------------------------------

/** A cardboard box w × h (logical px) turned `deg` in a square canvas n (its middle at n / 2). */
export function parcelBuf(n: number, w: number, h: number, deg: number, d: Dn, crushed = false): PixelBuffer {
  const c = new HdCanvas(n, n, d);
  const card = mat(c, 'sand', { spec: 0.25, shine: 16, lo1: 0, hi1: 3, lo: 2, hi: 5 });
  const label = mat(c, 'snow', { spec: 0.2, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const a = (deg * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const cx = n / 2;
  const cy = n / 2;
  const hw = lineW(d);
  const part = c.newPart();
  c.heightField(0, 0, n, n, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * cs + dy * sn;
    const v = -dx * sn + dy * cs;
    const sq = crushed ? 1 - Math.max(0, u / w) * 0.5 : 1;
    if (Math.abs(u) > w / 2 || Math.abs(v) > (h / 2) * sq) return NaN;
    const e = Math.min(w / 2 - Math.abs(u), (h / 2) * sq - Math.abs(v));
    return Math.min(1.2, e * 0.8) + 0.4;
  }, {
    mat: card,
    z: 1,
    part,
    tex: (t) => {
      const dx = t.x - cx;
      const dy = t.y - cy;
      const u = dx * cs + dy * sn;
      const v = -dx * sn + dy * cs;
      // Brown tape across the middle (lighter), a white label with a barcode at 2× / 4×.
      if (Math.abs(u) < Math.max(hw * 1.6, w * 0.09)) t.tone += 0.4;
      if (u > w * 0.12 && u < w * 0.42 && v > -h * 0.3 && v < h * 0.12) {
        t.mat = label;
        if (d > 1 && v > -h * 0.12 && Math.floor((u - w * 0.12) * d * 0.9) % 2 === 0) t.tone -= 1.2;
      }
    },
  });
  return finishA(c, 0.2);
}

/** A parcel piece centred on (x, y) (local), `w × h`, turned `deg`. */
function parcelAt(x: number, y: number, w: number, h: number, deg: number, d: Dn, behind = false): Extra {
  const n = Math.ceil(Math.max(w, h) * 1.5) + 2;
  return { buf: parcelBuf(n, w, h, deg, d), x: Math.round(x - n / 2), y: Math.round(y - n / 2), behind };
}

/** The hand scanner (a dark grey brick with a red window; `beam`: the red scan line out of it). */
function scannerBuf(beam: boolean, d: Dn): PixelBuffer {
  const c = new HdCanvas(9, 6, d);
  const body = mat(c, 'slate', { spec: 0.6, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const red = mat(c, 'red', { flat: true, lo1: 3, hi1: 3, lo: 5, hi: 6 });
  c.box(0.5, 1.2, 5, 3, { mat: body, z: 1, r: 0.6, bevel: 0.6 });
  c.box(4.6, 1.8, 1, 1.8, { mat: red, z: 1.4, r: 0.2 });
  if (beam) c.box(5.6, 2.4, 3.2, d === 1 ? 1 : 0.6, { mat: red, z: 1.4 });
  return finishA(c, 0.1);
}

/** The NIET THUIS card held in a hand (a small pink-and-white card). */
function heldCardBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(7, 6, d);
  const white = mat(c, 'snow', { spec: 0.2, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const pink = mat(c, 'pink', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 5 });
  c.box(0.5, 0.5, 6, 5, { mat: white, z: 1, r: 0.3, tex: (t) => (t.y < 2 ? void (t.mat = pink) : undefined) });
  return finishA(c, 0.1);
}

/** The thermos (a tall dark-green flask with a steel cup lid) tilted `deg` (0 upright). */
function thermosBuf(deg: number, d: Dn): PixelBuffer {
  const n = 13;
  const c = new HdCanvas(n, n, d);
  const flask = mat(c, 'green', { spec: 1, shine: 40, lo1: 0, hi1: 2, lo: 1, hi: 5 });
  const steel = mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const a = (deg * Math.PI) / 180;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const P = (s: number): [number, number] => [n / 2 + s * ux, n / 2 + s * uy];
  c.capsule(...P(-4.4), ...P(2.6), 1.6, 1.6, { mat: flask, z: 1 });
  c.capsule(...P(2.8), ...P(4.6), 1.3, 1.1, { mat: steel, z: 1.2 });
  return finishA(c, 0.15);
}

/** A white mug (the thermos cup), `steam` above it. */
function cupBuf(steam: boolean, d: Dn): PixelBuffer {
  const c = new HdCanvas(6, 8, d);
  const cup = mat(c, 'snow', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  c.box(1, 4, 3.4, 3.4, { mat: cup, z: 1, r: 0.6, bevel: 0.6 });
  c.ellipsoid(4.8, 5.6, 0.9, 1.1, { mat: cup, z: 0.9 });
  if (steam && d > 1) {
    const s = top('snow', d, 2);
    c.paint(1, 0, 4, 4, (x, y) => (Math.abs(x - 2.6 - Math.sin(y * 2.2) * 0.6) < 0.3 ? s : 0));
  }
  return finishA(c, 0.1);
}

// ---------------------------------------------------------------------------------------------
// The van crew in the hold (kneeling, facing back)
// ---------------------------------------------------------------------------------------------

const L = (hip: number, knee: number): { hip: number; knee: number } => ({ hip, knee });
/** Kneeling on the hold floor (the wind section's swoon kneel). */
const KNEEL: Pose = { legN: L(92, 96), legF: L(-6, 120), legScale: 0.85 };
const [CX, CY] = [VAN.crewHip[0], VAN.hold[3] - 0.2];

const crewBox = VAN.crewBox;
function crew(pose: Pose, d: Dn, extras: Extra[] = [], parcel?: { at: 'hand'; w: number; h: number; deg: number }): Frame {
  const f = human(CREW, { ...KNEEL, ...pose }, d);
  const ex = [...extras];
  if (parcel) {
    const hp = f.pts?.hand;
    const W = f.buf.w / d;
    const ax = W - 1 - f.ox;
    const px = Math.round(CX - ax);
    const py = Math.round(CY - f.oy);
    if (hp) ex.push(parcelAt(px + ax - hp[0], py + f.oy + hp[1] - 1, parcel.w, parcel.h, parcel.deg, d));
  }
  return compose(crewBox, [{ f, x: CX, y: CY, flip: true }], ex, d);
}

export function crewIdleFrames(d: Dn): Frame[] {
  return [0, 1].map((k) => crew({ lean: 6, armN: { to: [2, -13 + k], hand: 'grip' }, armF: { sh: 30, el: 40, hand: 'open' }, head: { dy: k, tilt: k ? 4 : 0 } }, d));
}

export function crewTellThrowFrames(d: Dn): Frame[] {
  const keys: Pose[] = [
    { lean: 24, armN: { to: [7, 10], hand: 'grip' }, armF: { to: [6, 10], hand: 'grip' }, expr: 'normal' },
    { lean: 8, armN: { to: [7, 3], hand: 'grip' }, armF: { to: [6, 3], hand: 'grip' }, expr: 'shout' },
    { lean: -10, armN: { to: [1, -12], hand: 'grip' }, armF: { to: [0, -11], hand: 'grip' }, expr: 'shout' },
  ];
  return keys.map((p) => crew(p, d, [], { at: 'hand', w: 8, h: 6, deg: 0 }));
}

export function crewThrowFrames(d: Dn): Frame[] {
  return [
    crew({ lean: 14, armN: { to: [10, -5], hand: 'open' }, armF: { to: [9, -4], hand: 'open' }, expr: 'shout' }, d),
    crew({ lean: 20, armN: { to: [9, 6], hand: 'open' }, armF: { to: [8, 6], hand: 'open' }, expr: 'normal' }, d),
  ];
}

export function crewTellShootFrames(d: Dn): Frame[] {
  const keys: Pose[] = [
    { weapon: 'pistol', aim: 'down', armF: { to: [2, -13], hand: 'grip' }, expr: 'normal' },
    { weapon: 'pistol', aim: 'fwd', armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' },
    { weapon: 'pistol', aim: 'fwd', armF: { to: [2, -13], hand: 'grip' }, expr: 'shout', lean: 2 },
  ];
  return keys.map((p) => crew(p, d));
}

export function crewShootFrames(d: Dn): Frame[] {
  return [
    crew({ weapon: 'pistol', aim: 'fwd', recoil: 1, armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' }, d),
    crew({ weapon: 'pistol', aim: 'fwd', armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' }, d),
  ];
}

/** The gloat: he scans a parcel (the scanner's red line on frames 1 and 3), unhurried. */
export function crewGloatFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((k) => {
    const f = human(CREW, { ...KNEEL, lean: 4, armN: { to: [7, 1], hand: 'grip' }, armF: { to: [6, 5], hand: 'grip' }, head: { tilt: 8, dy: k === 2 ? 1 : 0 }, expr: k === 3 ? 'blink' : 'normal' }, d);
    const W = f.buf.w / d;
    const ax = W - 1 - f.ox;
    const px = Math.round(CX - ax);
    const py = Math.round(CY - f.oy);
    const hn = f.pts?.hand ?? [7, -14];
    const handX = px + ax - hn[0];
    const handY = py + f.oy + hn[1];
    const sc = scannerBuf(k % 2 === 1, d).flipped(true);
    return compose(crewBox, [{ f, x: CX, y: CY, flip: true }], [parcelAt(handX - 2, handY + 5, 8, 6, 0, d, true), { buf: sc, x: Math.round(handX - 7), y: Math.round(handY - 3) }], d);
  });
}

export function crewCowerFrames(d: Dn): Frame[] {
  return [0, 1].map((k) => crew({ lean: 26, hunch: 2, armN: { to: [3, -8 + k], hand: 'open' }, armF: { to: [4, -9 + k], hand: 'open' }, head: { dy: 1, tilt: 10 }, expr: 'panic' }, d));
}

// ---------------------------------------------------------------------------------------------
// Free-standing: tumbles and dazed sits (bloodless), the courier on foot
// ---------------------------------------------------------------------------------------------

/** A rider rolling in a tuck (feet anchor at the roll's middle). */
export function tumbleFrames(style: HumanStyle, d: Dn): Frame[] {
  return [0, 90, 180, 270].map((rot) =>
    renderHuman(style, { weapon: 'none', grounded: false, crouch: 1, lean: 30, armN: { sh: 40, el: 120, hand: 'fist' }, armF: { sh: 30, el: 120, hand: 'fist' }, rot, expr: 'hurt', dy: -6 }, 'full', d as Density),
  );
}

/** Sitting dazed on the hard shoulder, blinking. */
export function sitFrames(style: HumanStyle, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    renderHuman(style, { weapon: 'none', legN: { hip: 88, knee: 6, foot: 20 }, legF: { hip: 80, knee: 14, foot: 20 }, lean: -14, armN: { sh: -30, el: 10, hand: 'open' }, armF: { sh: -40, el: 10, hand: 'open' }, head: { tilt: k ? 8 : -4 }, expr: k ? 'blink' : 'dazed', dy: 8 }, 'full', d as Density),
  );
}

/** The courier's frame box (feet anchor): x −16 … 17, y −40 … +1. */
const COURIER_BOX: readonly [number, number, number, number] = [-16, -40, 33, 41];

export function courierWalkFrames(d: Dn): Frame[] {
  const walk = withSwing(P.WALK, 0.6, 24);
  const n = walk.length;
  return [0, 1, 2, 3].map((k) => {
    const p = walk[Math.floor((k * n) / 4)];
    return compose(COURIER_BOX, [{ f: human(COURIER, { ...p, expr: 'normal' }, d), x: 0, y: 0 }], [], d);
  });
}

/** The card gag: the card raised (0), pressed on with a flat hand (1), a pat and a nod (2). */
export function courierStickFrames(d: Dn): Frame[] {
  const keys: Pose[] = [
    { ...P.STAND, armN: { to: [8, -6], hand: 'grip' }, armF: { sh: -6, el: 30, hand: 'fist' }, expr: 'normal' },
    { ...P.STAND, lean: 6, armN: { to: [11, -8], hand: 'open' }, armF: { sh: -6, el: 30, hand: 'fist' }, expr: 'normal' },
    { ...P.STAND, armN: { to: [9, -9], hand: 'open' }, armF: { sh: 10, el: 20, hand: 'open' }, head: { tilt: 6 }, expr: 'happy' },
  ];
  return keys.map((p, k) => {
    const f = human(COURIER, p, d);
    const extras: Extra[] = [];
    const hn = f.pts?.hand;
    if (k === 0 && hn) extras.push({ buf: heldCardBuf(d), x: Math.round(hn[0] - 1), y: Math.round(hn[1] - 5) });
    return compose(COURIER_BOX, [{ f, x: 0, y: 0 }], extras, d);
  });
}

export function courierCowerFrames(d: Dn): Frame[] {
  return P.PANIC_COWER.slice(0, 2).map((p) => compose(COURIER_BOX, [{ f: human(COURIER, { ...p, expr: 'panic' }, d), x: 0, y: 0 }], [], d));
}

// ---------------------------------------------------------------------------------------------
// The caravan's gunner in the roof hatch (facing back, cropped at the roof line)
// ---------------------------------------------------------------------------------------------

const [GX, GY] = CARAVAN.gunHip;
const STANDING: Pose = { grounded: false, legN: L(4, 6), legF: L(-4, 6) };

function gunner(pose: Pose, d: Dn, extras: (f: Frame, hx: number, hy: number) => Extra[] = () => [], dy = 0): Frame {
  const f = human(GUNNER, { ...STANDING, ...pose }, d);
  const hip = f.pts?.hip ?? [0, -15];
  const W = f.buf.w / d;
  const ax = W - 1 - f.ox;
  const px = Math.round(GX + hip[0] - ax);
  const py = Math.round(GY + dy - hip[1] - f.oy);
  const hn = f.pts?.hand ?? [6, -20];
  return compose(CARAVAN.gunBox, [{ f, x: GX, y: GY + dy, flip: true, at: 'hip' }], extras(f, px + ax - hn[0], py + f.oy + hn[1]), d);
}

export function gunnerRideFrames(d: Dn): Frame[] {
  return [0, 1].map((k) => gunner({ lean: 4, armN: { to: [6, 9], hand: 'open' }, armF: { to: [5, 9], hand: 'open' }, head: { tilt: k ? -6 : 2 }, expr: 'normal' }, d));
}

export function gunnerTellFrames(d: Dn): Frame[] {
  const keys: Pose[] = [
    { weapon: 'pistol', aim: 'down', armF: { to: [5, 9], hand: 'open' }, expr: 'normal' },
    { weapon: 'pistol', aim: 'fwd', armF: { to: [5, 9], hand: 'open' }, expr: 'shout' },
    { weapon: 'pistol', aim: 'fwd', armF: { to: [5, 9], hand: 'open' }, expr: 'shout', lean: 3 },
  ];
  return keys.map((p) => gunner(p, d));
}

export function gunnerShootFrames(d: Dn): Frame[] {
  return [
    gunner({ weapon: 'pistol', aim: 'fwd', recoil: 1, armF: { to: [5, 9], hand: 'open' }, expr: 'shout' }, d),
    gunner({ weapon: 'pistol', aim: 'fwd', armF: { to: [5, 9], hand: 'open' }, expr: 'shout' }, d),
  ];
}

/** The gloat: a coffee from the thermos (pour, pour, sip, sip with a contented blink). */
export function gunnerGloatFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((k) => {
    const sip = k >= 2;
    const pose: Pose = sip
      ? { lean: -4, armN: { to: [4, -10], hand: 'grip' }, armF: { to: [5, 8], hand: 'open' }, head: { tilt: -6 }, expr: k === 3 ? 'blink' : 'happy' }
      : { lean: 2, armN: { to: [8, 2], hand: 'grip' }, armF: { to: [7, -3], hand: 'grip' }, head: { tilt: 8 }, expr: 'normal' };
    return gunner(pose, d, (_f, hx, hy) => {
      const out: Extra[] = [{ buf: cupBuf(sip, d).flipped(true), x: Math.round(hx - 3), y: Math.round(hy - 6) }];
      if (!sip) out.push({ buf: thermosBuf(k === 0 ? 50 : 70, d).flipped(true), x: Math.round(hx - 5), y: Math.round(hy - 14) });
      return out;
    });
  });
}

export function gunnerCowerFrames(d: Dn): Frame[] {
  return [0, 1].map((k) => gunner({ lean: 14, hunch: 2, armN: { to: [2, -9 + k], hand: 'open' }, armF: { to: [3, -10 + k], hand: 'open' }, head: { dy: 1, tilt: 8 }, expr: 'panic' }, d, () => [], 5 + k));
}
