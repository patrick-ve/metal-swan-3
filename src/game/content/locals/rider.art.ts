/**
 * `enemy/fatbike-youth…` and `enemy/delivery-rider…` — the Amsterdam riders
 * (docs/design/amsterdam.md §2): a person on a bike, built from the humanoid rig on a bike drawn
 * by code. Facing right, anchored at the ground under the middle of the bike.
 *
 * - The rider: `renderHuman(style, pose, 'full')` with the `RIDE_*` arm poses (hands on the grips
 *   at hip + (9, −5)) and legs solved onto the pedals (two-bone IK, thigh 6 / shin 6).
 * - The bike: `fat` (fat-tyre e-bike: very thick tyres r 7, short frame, battery, phone mount, a
 *   small speaker on the rear rack) or `city` (thin tyres r 8, phone on the bar).
 * - The delivery rider wears the green cube backpack (a `withPieces` piece behind the torso).
 *
 * Strips per set (`enemy/<set>/…`): idle (4, breathing + blink), ride (8 crank positions, 4 upper
 * poses), turn (3: the idle frame squeezed, drawn by `Rider` on a facing change), gag (4: fatbike
 * = head bob to the music, delivery = checking his phone), alert (1), tell (fatbike: 4-frame
 * wheelie, the bike tilt tweened; delivery: 2-frame bell), kick (4: chamber, swing, extend,
 * retract), photo-pose (2), die / die-knife / die-blast / die-burn / die-crush (the rider alone,
 * the bike leaves as an fx), fatbike only: die-seat (6) and get-up (5) (deferred; falls off the
 * seat, gets up, then flee), flee (4: runs off), bike (6: the riderless bike skids and fades),
 * cap (4: the flying cap), food-cube (4: the popped cube backpack), and the continue reactions
 * (deferred): gloat (fatbike 4: a slow wheelie in place, rocking on the back wheel, heads bobbing
 * to the speaker; delivery 2: stopped, checking his phone, the screen lit) and cower (2: forearms
 * up before the face, the bike rocking).
 *
 * UHD art (mission ams; docs/ART_GUIDE.md "UHD art"): every strip has ONE density-generic
 * generator for 2× and 4× (`hd`): the rider is the HD rig (`renderHuman(…, d)`); the bike, its
 * wheels, the cube bag and the cap are drawn natively by rider.hd.ts (the bike with its cranks at
 * the rider's crank angle). Strips that are the same picture as another set's are dense ALIASES
 * of it (`defineDenseAlias`: built, held and sent once; their 1× stays their own): a pair set's
 * rider-only strips are its solo twin's (`same`), its `passenger-flee` is the `flee` of the
 * passenger's solo set (`passengerSet`), and the riderless `bike` is the skin-a set's of the
 * same look (`sameBike`). So a pair adds only the strips with the bike and both riders.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineDenseAlias, defineSprite, getFrames } from '../../../engine/sprites';
import { crushStripHi } from '../../art/hi-strips';
import { withPieces, type Piece } from '../../art/human-fx';
import { blastFrames, burnFrames } from '../../art/human-sprites';
import { renderHuman, type ArmPose, type Density, type HumanStyle, type LegPose, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { R } from '../../art/paint';
import { CRUSH_TIMING, FLAT, Sketch, crushStrip, turnSquash } from '../creatures/draw';
import { inbetween, tween } from '../../art/tween';
import { BIKE, BIKE_OX, BIKE_OY, bikeHd, capFramesHd, cubePackHd, handPhoneHd, onBox, onBoxes, rotor, type BikeKind, type BikeOpts, type HdD, type Pt, type Rect } from './rider.hd';

export { BIKE, type BikeKind, type BikeOpts } from './rider.hd';

/** Rider looks: the youths (hoodie, cap or hood, trackpants, white sneakers). */
export const YOUTH_LOOKS: readonly HumanStyle[] = [
  { skin: 'skinA', hair: 'hairA', hairStyle: 'short', headgear: 'cap', gear: 'black', top: 'red', topType: 'sweater', pants: 'black', boots: 'snow', build: 'slim' },
  { skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'hood', gear: 'purple', top: 'purple', topType: 'sweater', pants: 'stone', boots: 'snow', build: 'slim' },
  { skin: 'skinC', hair: 'hairB', hairStyle: 'buzz', headgear: 'cap', gear: 'snow', top: 'teal', topType: 'sweater', pants: 'navy', boots: 'snow', build: 'normal' },
  { skin: 'skinA', hair: 'hairC', hairStyle: 'short', headgear: 'hood', gear: 'orange', top: 'orange', topType: 'sweater', pants: 'black', boots: 'snow', build: 'slim' },
];
/** Bike frame colour per youth look. */
const YOUTH_FRAME = ['gold', 'sky', 'stone', 'green'] as const;

/**
 * The food-delivery rider: a dark slate jacket (not pure black: it must read in the dark passage
 * and the sunset) with green trim, black helmet and trousers.
 */
export const DELIVERY_STYLE: HumanStyle = {
  skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'helmet', gear: 'black', accent: 'green',
  top: 'slate', topType: 'jacket', shirt: 'green', pants: 'black', boots: 'black', gloves: 'black', build: 'normal',
};

export const SKINS = { a: 'skinA', b: 'skinB', c: 'skinC' } as const;
export type SkinKey = keyof typeof SKINS;

// ------------------------------------------------------------------------------------ wheels

/** A fat tyre (very thick black rubber, small rim, tread blocks that turn with the phase). */
function fatWheel(r: number, phase: number): PixelBuffer {
  const t = R('black');
  const rim = R('steel');
  const d = r * 2 + 1;
  const b = new PixelBuffer(d, d);
  b.circle(r, r, r, t[1]);
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const dx = x - r;
      const dy = y - r;
      const q = Math.hypot(dx, dy);
      if (q > r - 1.2 && dx + dy < -r * 0.5) b.set(x, y, t[2]);
    }
  }
  // Tread blocks on the outer edge.
  for (let k = 0; k < 8; k++) {
    const a = ((k + phase / 2) / 8) * Math.PI * 2;
    b.set(Math.round(r + Math.cos(a) * (r - 0.6)), Math.round(r + Math.sin(a) * (r - 0.6)), t[0]);
  }
  const rr = Math.max(1, r - 4);
  b.circle(r, r, rr, rim[2]);
  b.set(r - 1, r - 1, rim[3]);
  b.set(r, r, rim[1]);
  const a = (phase / 4) * Math.PI * 0.5;
  b.set(Math.round(r + Math.cos(a) * rr), Math.round(r + Math.sin(a) * rr), rim[0]);
  b.set(Math.round(r - Math.cos(a) * rr), Math.round(r - Math.sin(a) * rr), rim[0]);
  return b;
}

/** A thin city-bike wheel (black tyre, silver rim, spokes turning with the phase). */
function cityWheel(r: number, phase: number): PixelBuffer {
  const t = R('black');
  const rim = R('steel');
  const d = r * 2 + 1;
  const b = new PixelBuffer(d, d);
  b.circle(r, r, r, t[1]);
  b.circle(r, r, r - 2, rim[3]);
  b.circle(r, r, r - 3, 0);
  for (let k = 0; k < 4; k++) {
    const a = ((k + phase / 4) / 4) * Math.PI;
    const cx = Math.cos(a) * (r - 3);
    const cy = Math.sin(a) * (r - 3);
    b.line(Math.round(r - cx), Math.round(r - cy), Math.round(r + cx), Math.round(r + cy), rim[1]);
  }
  b.set(r, r, rim[2]);
  // Highlight on the upper-left of the tyre.
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x - r;
      const dy = y - r;
      if (b.get(x, y) === t[1] && dx + dy < -r * 0.7) b.set(x, y, t[2]);
    }
  }
  return b;
}

// ------------------------------------------------------------------------------------ the bike

/** Draw a bike into a sketch (behind the rider). */
function drawBike(s: Sketch, kind: BikeKind, o: BikeOpts): void {
  const geo = BIKE[kind];
  const T = rotor(geo, o.rot ?? 0);
  const phase = o.phase ?? 0;
  const frame = R(o.color);
  const steel = R('steel');
  const black = R('black');
  const rear = T(geo.rear);
  const front = T(geo.front);
  const bb = T(geo.bb);
  const fat = kind === 'fat';
  const seat = T([geo.hip[0] - 1, geo.hip[1] + 2]);
  const head = T(fat ? [8, -17] : [9, -19]);
  const bar = T(fat ? [6, -25] : [5, -28]);
  const wheelBuf = (fat ? fatWheel : cityWheel)(geo.r, phase);
  const r = geo.r;
  s.detail((b, X, Y) => {
    b.blit(wheelBuf, X(rear[0]) - r, Y(rear[1]) - r);
    b.blit(wheelBuf, X(front[0]) - r, Y(front[1]) - r);
  });
  // Chain stay, seat stay, seat tube (thin, dark).
  s.add(black, (b, X, Y) => {
    b.thickLine(X(rear[0]), Y(rear[1]), X(bb[0]), Y(bb[1]), 1, FLAT);
    b.line(X(rear[0]), Y(rear[1]), X(seat[0]), Y(seat[1]), FLAT);
  }, { ring: false });
  // Main frame: seat tube, top tube, down tube, fork, stem.
  s.add(frame, (b, X, Y) => {
    b.thickLine(X(bb[0]), Y(bb[1]), X(seat[0]), Y(seat[1]), 2, FLAT);
    b.thickLine(X(seat[0]), Y(seat[1]), X(head[0]), Y(head[1]), 2, FLAT);
    b.thickLine(X(head[0]), Y(head[1]), X(bb[0]), Y(bb[1]), fat ? 3 : 2, FLAT);
    b.thickLine(X(head[0]), Y(head[1]), X(front[0]), Y(front[1]), 2, FLAT);
  });
  if (fat) {
    // The battery on the down tube.
    const b0 = T([5, -14]);
    const b1 = T([2, -11]);
    s.add(black, (b, X, Y) => b.thickLine(X(b0[0]), Y(b0[1]), X(b1[0]), Y(b1[1]), 3, FLAT));
  }
  // Stem and handlebar.
  s.add(steel, (b, X, Y) => {
    b.line(X(head[0]), Y(head[1]), X(bar[0]), Y(bar[1]), FLAT);
    b.line(X(bar[0]) - 1, Y(bar[1]), X(bar[0]) + 1, Y(bar[1]), FLAT);
  }, { ring: false });
  // Saddle.
  const sd = T([geo.hip[0], geo.hip[1] + 1]);
  s.add(black, (b, X, Y) => b.rect(X(sd[0]) - 3, Y(sd[1]), 6, 2, FLAT));
  // Rear rack (+ the speaker, or a padded seat for the passenger).
  const rk0 = T([geo.hip[0] - 2, -16]);
  const rk1 = T([rear[0] - 4, -16]);
  s.add(steel, (b, X, Y) => b.line(X(rk0[0]), Y(rk0[1]), X(rk1[0]), Y(rk1[1]), FLAT), { ring: false });
  if (fat && !o.pair) {
    const sp = T([-16, -21]);
    s.add(black, (b, X, Y) => b.rect(X(sp[0]), Y(sp[1]), 6, 5, FLAT));
    s.detail((b, X, Y) => {
      b.set(X(sp[0]) + 2, Y(sp[1]) + 2, PAL.steel[3]);
      b.set(X(sp[0]) + 3, Y(sp[1]) + 2, PAL.steel[2]);
      b.set(X(sp[0]) + 2, Y(sp[1]) + 3, PAL.steel[2]);
      b.set(X(sp[0]) + 3, Y(sp[1]) + 3, PAL.steel[1]);
      b.set(X(sp[0]) + 1, Y(sp[1]) + 1, PAL.green[3]);
    });
  }
  // Phone on the handlebar (a lit screen).
  const ph = T([bar[0] + 2, bar[1] - 3]);
  s.detail((b, X, Y) => {
    b.rect(X(ph[0]), Y(ph[1]), 2, 3, INK);
    b.set(X(ph[0]) + 1, Y(ph[1]), PAL.sky[3]);
    b.set(X(ph[0]) + 1, Y(ph[1]) + 1, PAL.sky[2]);
  });
  // Mudguard over the front wheel (fat) / a basket-less city bike keeps its fork bare.
  if (fat) {
    s.add(frame, (b, X, Y) => {
      for (let k = -3; k <= 3; k++) {
        const a = -Math.PI / 2 + (k / 3) * 0.9;
        const q = T([geo.front[0] + Math.cos(a) * (r + 1), geo.front[1] + Math.sin(a) * (r + 1)]);
        b.set(X(q[0]), Y(q[1]), FLAT);
      }
    }, { ring: false });
  }
}

// ------------------------------------------------------------------------------------ the rider

/** Legs whose feet sit on the pedals (crank angle `a` in turns; near pedal at a, far at a + ½). */
function pedalLegs(kind: BikeKind, a: number, hip: Pt): { legN: LegPose; legF: LegPose } {
  const geo = BIKE[kind];
  const leg = (ang: number): LegPose => {
    const px = geo.bb[0] + Math.cos(ang * Math.PI * 2) * geo.crank;
    const py = geo.bb[1] + Math.sin(ang * Math.PI * 2) * geo.crank - 3;
    const dx = px - hip[0];
    const dy = py - hip[1];
    const d = Math.min(11.8, Math.hypot(dx, dy));
    const phi = (Math.atan2(dx, dy) * 180) / Math.PI;
    const al = (Math.acos(d / 12) * 180) / Math.PI;
    return { hip: phi + al, knee: 2 * al, foot: 0 };
  };
  return { legN: leg(a), legF: leg(a + 0.5) };
}

const grip = (x: number, y: number): ArmPose => ({ to: [x, y], hand: 'grip' });

/** A rider on the bike: the human placed with its hip on the saddle (`d` 2 / 4: a dense piece). */
function rider(style: HumanStyle, pose: Pose, kind: BikeKind, rot: number, extra?: (f: Frame) => Frame, d: Density = 1): Piece {
  let f = renderHuman(style, { weapon: 'none', grounded: false, ...pose, rot: (pose.rot ?? 0) + rot }, 'full', d);
  if (extra) f = extra(f) as typeof f;
  const geo = BIKE[kind];
  const hip = rotor(geo, rot)(geo.hip);
  const fh = f.pts?.hip ?? [0, -15];
  const piece: Piece = { buf: f.buf, x: Math.round(hip[0] - fh[0] - f.ox), y: Math.round(hip[1] - fh[1] - f.oy) };
  if (d !== 1) piece.density = d;
  return piece;
}

/**
 * The green cube backpack (a burger logo on a dark band), a piece placed behind the torso. The
 * logo is symmetric on purpose: the rider is drawn flipped when he faces left, and letters would
 * then read mirrored.
 */
export function cubePack(open = false): PixelBuffer {
  const s = new Sketch(16, 16, 0, 0);
  s.add(PAL.green, (b) => b.rect(1, open ? 4 : 2, 13, 12 - (open ? 2 : 0), FLAT));
  if (open) s.add(PAL.green, (b) => b.poly([1, 4, 14, 4, 11, 0, 3, 1], FLAT));
  s.detail((b) => {
    // A dark band with a tiny burger (7×4, centred on x 7): bun, lettuce, patty, bun.
    const y = open ? 8 : 7;
    b.rect(2, y, 11, 4, PAL.black[1]);
    b.hline(5, 9, y, PAL.gold[2]);
    b.hline(4, 10, y + 1, PAL.green[4]);
    b.hline(4, 10, y + 2, PAL.brown[2]);
    b.hline(5, 9, y + 3, PAL.gold[1]);
    b.hline(2, 13, open ? 5 : 3, PAL.green[4]);
  });
  return s.frame().buf;
}

/** Add the cube backpack to a rider frame (behind the torso, over the lower back). */
function withCube(f: Frame): Frame {
  const hip = f.pts?.hip ?? [0, -15];
  const d = f.density ?? 1;
  if (d !== 1) return withPieces(f, [{ buf: cubePackHd(false, d as HdD), x: hip[0] - 15, y: hip[1] - 22, behind: true, density: d }]);
  return withPieces(f, [{ buf: cubePack(), x: hip[0] - 15, y: hip[1] - 22, behind: true }]);
}

/**
 * A phone held in the near hand, seen from its back (black case; the lit screen faces the rider:
 * a sky-blue glow on its edge toward his face), upright above the fist.
 */
export function handPhone(): PixelBuffer {
  const b = new PixelBuffer(2, 4);
  b.rect(0, 0, 2, 4, PAL.black[1]);
  b.set(1, 0, PAL.black[2]);
  b.vline(0, 1, 2, PAL.sky[3]);
  return b.padded(1).outline(INK);
}

/** Add the phone to a rider frame: upright in the near hand, its foot on the wrist. */
function withPhone(f: Frame): Frame {
  const hand = f.pts?.hand ?? [6, -20];
  const d = f.density ?? 1;
  const at = { x: Math.round(hand[0]) - 1, y: Math.round(hand[1]) - 5 };
  if (d !== 1) return withPieces(f, [{ buf: handPhoneHd(d as HdD), ...at, density: d }]);
  return withPieces(f, [{ buf: handPhone(), ...at }]);
}

/** The 1× bike sketch (64 × 56, anchor 32, 50). */
function bike1(kind: BikeKind, o: BikeOpts): Frame {
  const s = new Sketch(64, 56, BIKE_OX, BIKE_OY);
  drawBike(s, kind, o);
  return s.frame();
}

/** The 1× bike's opaque box (its colour never moves a pixel, so one box serves every colour). */
const bikeRects = new Map<string, Rect>();
function bikeRect(kind: BikeKind, o: BikeOpts): Rect {
  const key = `${kind}|${o.rot ?? 0}|${o.phase ?? 0}|${o.pair === true}`;
  let r = bikeRects.get(key);
  if (!r) {
    const t = bike1(kind, { ...o, color: 'stone' }).buf.trimBounds();
    r = t ? { x: t.x, y: t.y, w: t.w, h: t.h } : { x: 0, y: 0, w: 64, h: 56 };
    bikeRects.set(key, r);
  }
  return r;
}

/** The bike at density d (1×: the sketch; 2× / 4×: the HD bike with its cranks at `crank` turns). */
function bikeAt(kind: BikeKind, o: BikeOpts, crank: number, d: Density): Frame {
  if (d === 1) return bike1(kind, o);
  return bikeHd(kind, { ...o, crank: ((crank % 1) + 1) % 1 }, d, bikeRect(kind, o));
}

/**
 * One frame: bike + rider (+ passenger) at density d; `crank` = the rider's crank angle (turns);
 * `extra` adds a prop to the rider (after the cube backpack).
 */
function combo(kind: BikeKind, color: string, phase: number, rot: number, crank: number, people: Array<{ style: HumanStyle; pose: Pose; at?: 'rack' }>, cube: boolean, d: Density = 1, extra?: (f: Frame) => Frame): Frame {
  const geo = BIKE[kind];
  const bike = bikeAt(kind, { color, rot, phase, pair: people.length > 1 }, crank, d);
  const pieces: Piece[] = [];
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i];
    const own = i === 0 && extra ? extra : undefined;
    const add = cube && i === 0 ? (own ? (f: Frame) => own(withCube(f)) : withCube) : own;
    let piece = rider(p.style, p.pose, kind, rot, add, d);
    if (p.at === 'rack') {
      // The passenger sits on the rack, 10 px behind the rider.
      const T = rotor(geo, rot);
      const a = T(geo.hip);
      const b = T([geo.hip[0] - 10, geo.hip[1] + 1]);
      piece = { ...piece, x: piece.x + Math.round(b[0] - a[0]), y: piece.y + Math.round(b[1] - a[1]) };
    }
    pieces.push(piece);
  }
  return withPieces(bike, pieces);
}

// ------------------------------------------------------------------------------------ poses

const seatPose = (kind: BikeKind, a: number, upper: Pose): Pose => ({ ...pedalLegs(kind, a, BIKE[kind].hip), ...upper });

/** Kick: the near leg shoots forward at knee height, the body leans back. */
const KICK_POSES: readonly Pose[] = [
  { lean: -14, armN: grip(10.5, 2.5), armF: grip(9.5, 2), legN: { hip: 60, knee: 70 }, expr: 'shout' },
  { lean: -18, armN: grip(11, 3), armF: grip(10, 2.5), legN: { hip: 84, knee: 0, foot: 20 }, expr: 'shout' },
];

/** The passenger's kick (leaning out, the leg sweeping forward under the rider). */
const PASSENGER_KICK: readonly Pose[] = [
  { lean: 10, armN: { sh: 120, el: 30, hand: 'open' }, armF: { sh: -40, el: 20, hand: 'grip' }, legN: { hip: 60, knee: 60 }, legF: { hip: 40, knee: 80 }, expr: 'shout' },
  { lean: -20, armN: { sh: 150, el: 10, hand: 'open' }, armF: { sh: -40, el: 20, hand: 'grip' }, legN: { hip: 88, knee: 0, foot: 20 }, legF: { hip: 40, knee: 80 }, legScale: 1.4, expr: 'shout' },
];

/** Turn-around squash widths (3 frames; `Rider` plays them narrowing, flips, then widening). */
export const TURN_WIDTHS: readonly number[] = [0.75, 0.5, 0.25];
/** Ride: 8 crank positions; durations keep the old 20-tick crank turn. */
export const RIDE_DURATIONS: readonly number[] = [3, 2, 3, 2, 3, 2, 3, 2];
/** Idle: breathe in, hold, breathe out, blink. */
export const IDLE_DURATIONS: readonly number[] = [10, 5, 10, 5];
/** Wheelie tell: the front comes up over 3 frames, then rocks on the back wheel (bike tilt, °). */
export const WHEELIE_TILT: readonly number[] = [-7, -13, -18, -16];
export const WHEELIE_DURATIONS: readonly number[] = [3, 3, 4, 6];
/** Kick: chamber, (smear) in-between, full extension, retract — inside the 6-8 tick kick window. */
export const KICK_DURATIONS: readonly number[] = [2, 1, 3, 30];
/** Fall off the seat (rider alone, bike gone as an fx) and the get-up before the flee. */
export const DIE_SEAT_DURATIONS: readonly number[] = [4, 3, 3, 5, 6, 20];
export const GET_UP_DURATIONS: readonly number[] = [8, 5, 5, 4, 4];

/** Four upper-body poses for the 8-frame ride (lean in, ease, lean deeper, ease back). */
function rideUpper(style: HumanStyle): Pose[] {
  const [a, b] = P.RIDE_LEAN;
  return [a, { ...inbetween(style, a, b, 0.5), head: { dx: 1, dy: 1 } }, b, inbetween(style, b, a, 0.5)];
}

/** Idle breathing (hand-keyed 1-px motion) with a blink on the way back. */
function idleUpper(style: HumanStyle): Pose[] {
  const [a, b] = P.RIDE_SIT;
  const m = inbetween(style, a, b, 0.5);
  return [a, { ...m, head: { dy: 1 } }, b, { ...m, expr: 'blink' }];
}

/** Kick keys + eased in-betweens: chamber, mid-swing, extended, retract. */
function kick4(style: HumanStyle, keys: readonly Pose[], back: Pose): Pose[] {
  return [keys[0], inbetween(style, keys[0], keys[1], 0.5), keys[1], inbetween(style, keys[1], back, 0.45)];
}

/** Seat on the saddle (rider alone; hip lifted to the fatbike saddle). */
const FALL_SEAT: Pose = { legN: { hip: 70, knee: 80 }, legF: { hip: 55, knee: 95 }, armN: A_(60, 50), armF: A_(80, 40), lean: -10, grounded: false, dy: -8, expr: 'hurt' };
const DIE_SEAT_KEYS: readonly Pose[] = [
  FALL_SEAT,
  { legN: { hip: 80, knee: 50 }, legF: { hip: 60, knee: 70 }, armN: A_(140, 40), armF: A_(160, 30), lean: -10, rot: -40, grounded: false, dy: -7, expr: 'hurt' },
  P.DIE[3],
  P.DIE[4],
  P.DIE[5],
];
const GET_UP_KEYS: readonly Pose[] = [
  P.DIE[5],
  { legN: { hip: 90, knee: 110 }, legF: { hip: 60, knee: 120 }, armN: A_(30, 10), armF: A_(20, 20), rot: -45, lean: 10, grounded: false, dy: -1, expr: 'dazed' },
  { ...P.CROUCH, armN: A_(30, 10), armF: A_(20, 10), lean: 20, expr: 'dazed' },
  { ...P.STAND, armN: A_(40, 40), armF: A_(20, 50), lean: 6, expr: 'panic' },
  P.PANIC_FLAIL[0],
];
function A_(sh: number, el: number): ArmPose {
  return { sh, el, hand: 'open' };
}

const PASSENGER_SIT: Pose = { lean: 2, armN: { sh: 30, el: 60, hand: 'grip' }, armF: { sh: 20, el: 70, hand: 'grip' }, legN: { hip: 70, knee: 80 }, legF: { hip: 60, knee: 90 } };

/**
 * Continue reactions (every hero is out, then one drops back in). The gloat (docs/design/
 * ams-extras.md §1: their own business at the spot, never a laugh or a point):
 * - fatbike: a slow wheelie in place — the bike held up on the back wheel and rocking
 *   (`GLOAT_TILT`), the pedals creeping round to balance, the rider leaning back cool with both
 *   hands on the bar, his head bobbing to the speaker's beat (a blink on the last beat); the
 *   passenger holds on and bobs along.
 * - delivery: stopped (crank 0), the far hand on the bar, the near hand holding his phone up to
 *   his face (`withPhone`: the back of the phone, its screen light on his face), the head bent
 *   over it; frame 2 a thumb scroll (the phone 1 px lower) and a blink.
 */
export const GLOAT_TILT: readonly number[] = [-12, -15, -16, -14];
const GLOAT_UP: readonly Pose[] = GLOAT_TILT.map((_, k): Pose => ({
  ...P.RIDE_UP[0],
  lean: -6 - (k % 2),
  head: { dy: k % 2, tilt: k % 2 ? 2 : -8 },
  expr: k === 3 ? 'blink' : 'normal',
}));
const GLOAT_PASSENGER: readonly Pose[] = GLOAT_TILT.map((_, k): Pose => ({
  ...PASSENGER_SIT,
  lean: -8,
  head: { dy: (k + 1) % 2, tilt: (k + 1) % 2 ? 4 : -6 },
  expr: k === 1 ? 'blink' : 'normal',
}));
const GLOAT_PHONE: readonly Pose[] = [0, 1].map((k): Pose => ({
  ...P.RIDE_SIT[0],
  lean: 8,
  armN: { to: [8, -4 + k], hand: 'fist' },
  head: { tilt: 10 },
  expr: k ? 'blink' : 'normal',
}));
/**
 * Cower: the rider leans back, both forearms up in front of the face, panicking; the bike wobbles
 * (it rocks front up / rear up: `COWER_TILT` about the rear wheel's contact, the rear-up frame
 * lifted `COWER_LIFT` px so the front wheel stays on the ground line).
 */
const COWER_UP: readonly Pose[] = [0, 1].map((k): Pose => ({
  lean: -12,
  hunch: 1,
  armN: { to: [7, -7 + k], hand: 'open' },
  armF: { to: [8, -10 + k], hand: 'open' },
  head: { tilt: -6 },
  expr: 'panic',
}));
/** The passenger ducks behind the rider, hands over his head. */
const COWER_PASSENGER: readonly Pose[] = [0, 1].map((k): Pose => ({
  ...PASSENGER_SIT,
  lean: 30,
  hunch: 2,
  armN: { to: [2, -10 + k], hand: 'open' },
  armF: { to: [3, -10 + k], hand: 'open' },
  head: { dy: 1, tilt: 10 },
  expr: 'panic',
}));
const COWER_TILT: readonly number[] = [-3, 3];
const COWER_LIFT: readonly number[] = [0, 1];
/** Ticks per frame of the reactions (both loop): the wheelie rocks one beat per frame (4 beats = one thump). */
export const GLOAT_TPF = { wheelie: 9, phone: 14 } as const;
export const COWER_TPF = 3;

// ------------------------------------------------------------------------------------ sets

export interface RiderSetOpts {
  kind: BikeKind;
  style: HumanStyle;
  color: string;
  passenger?: HumanStyle;
  cube?: boolean;
  /** Tell strip: 'wheelie' (fatbike) or 'bell' (delivery). */
  tell: 'wheelie' | 'bell';
  /** Gag strip: 'bob' (head bob to the music) or 'phone'. */
  gag: 'bob' | 'phone';
  /**
   * A set with the same rider (style and cube): its rider-only strips (deaths, flee) are the same
   * pictures, so their 2× and 4× art are aliases of that set's strips.
   */
  same?: string;
  /** The solo set of the passenger's look and skin: `passenger-flee` is (at 2× / 4×) its `flee`. */
  passengerSet?: string;
  /** A set with the same bike (kind, frame colour, pair): `bike` is (at 2× / 4×) its `bike`. */
  sameBike?: string;
}

type StripOpts = { ticksPerFrame?: number; durations?: readonly number[]; loop?: boolean; defer?: boolean };

/** Register a trimmed strip at 1× and its UHD art (the same recipe at density 2 and 4). */
const def = (id: string, gen: (d: Density) => Frame[], o: StripOpts = {}): void => defineSprite(id, () => gen(1), { trim: true, ...o, hd: (d) => gen(d) });

/**
 * Register a trimmed strip whose 2× and 4× art is the same picture as `target`'s (when given): its
 * own 1× frames, and a dense alias of `target`. Without a target: `def`.
 */
const defAs = (id: string, gen: (d: Density) => Frame[], o: StripOpts, target: string | undefined, gen1: () => Frame[] = () => gen(1)): void => {
  if (!target) return def(id, gen, o);
  defineSprite(id, gen1, { trim: true, ...o });
  defineDenseAlias(id, target);
};

/** Register one rider set under `enemy/<set>/…`. */
export function defineRiderSet(set: string, o: RiderSetOpts): void {
  const pre = `enemy/${set}/`;
  const { kind, style, color } = o;
  const cube = o.cube === true;
  const pass = o.passenger;
  const crew = (pose: Pose, a: number, pPose?: Pose): Array<{ style: HumanStyle; pose: Pose; at?: 'rack' }> => {
    const out: Array<{ style: HumanStyle; pose: Pose; at?: 'rack' }> = [{ style, pose: seatPose(kind, a, pose) }];
    if (pass) out.push({ style: pass, pose: { weapon: 'none', ...(pPose ?? PASSENGER_SIT) }, at: 'rack' });
    return out;
  };
  const lean = P.RIDE_LEAN;
  const sit = P.RIDE_SIT;
  const up4 = rideUpper(style);
  const idle4 = idleUpper(style);
  def(pre + 'ride', (d) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => combo(kind, color, i % 4, 0, i / 8, crew(up4[i % 4], i / 8), cube, d)), { durations: RIDE_DURATIONS });
  def(pre + 'idle', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, 0, 0, 0, crew(idle4[i], 0), cube, d)), { durations: IDLE_DURATIONS });
  // Turn-around (U-turn, circle ends, walls): the idle frame squeezed (draw-only, see Rider).
  // At 2× / 4× the idle frame is made here (not read back from the registry, which may defer 4×
  // art) and cut to the 1× idle frame's box, so the squash has the 1× widths.
  def(pre + 'turn', (d) => turnSquash(d === 1 ? getFrames(pre + 'idle', 1)[0] : onBox(combo(kind, color, 0, 0, 0, crew(idle4[0], 0), cube, d), getFrames(pre + 'idle', 1)[0], d), TURN_WIDTHS), { ticksPerFrame: 2, loop: false });
  def(pre + 'alert', (d) => [combo(kind, color, 0, 0, 0, crew({ ...P.RIDE_UP[0], expr: 'shout' }, 0), cube, d)], { ticksPerFrame: 30 });
  if (o.gag === 'bob') {
    def(pre + 'gag', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, i / 4, crew({ ...sit[0], head: { dy: i % 2, tilt: i % 2 ? 8 : -4 }, expr: i % 2 ? 'blink' : 'happy' }, i / 4), cube, d)), { ticksPerFrame: 7 });
  } else {
    // One hand off the bar, the phone up to his face.
    const phone = (k: number): Pose => ({ ...sit[0], armN: { to: [6, -5 - k], hand: 'fist' }, head: { tilt: 14 }, expr: k ? 'blink' : 'normal' });
    def(pre + 'gag', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, i / 4, crew(phone(i % 2), i / 4), cube, d)), { ticksPerFrame: 6 });
  }
  if (o.tell === 'wheelie') {
    // At 2× / 4× the passenger keeps a closed mouth: his open red mouth just behind the rider's neck
    // reads as a stray red mark.
    // The bike tilt is tweened (−7 → −18), then it rocks on the back wheel; the strip holds its
    // last frame for the rest of the telegraph.
    def(pre + 'tell', (d) => WHEELIE_TILT.map((rot, i) => combo(kind, color, i, rot, i / 4, crew({ ...P.RIDE_UP[0], lean: i < 1 ? -2 : -6, expr: 'shout' }, i / 4, { ...PASSENGER_SIT, lean: i < 1 ? -4 : -10, expr: d === 1 ? 'shout' : 'normal' }), cube, d)), { durations: WHEELIE_DURATIONS, loop: false });
  } else {
    // Ringing the bell: the near thumb flicks, he shouts.
    def(pre + 'tell', (d) => [0, 1].map((i) => combo(kind, color, i * 2, 0, i / 2, crew({ ...lean[0], armN: grip(9, 1 + i), expr: i ? 'shout' : 'normal' }, i / 2), cube, d)), { ticksPerFrame: 5 });
  }
  const kickR = kick4(style, KICK_POSES, { ...lean[0], expr: 'shout' });
  const kickP = pass ? kick4(pass, PASSENGER_KICK, { ...PASSENGER_SIT, expr: 'shout' }) : null;
  def(pre + 'kick', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, i / 4, kickP ? crew(lean[0], i / 4, kickP[i]) : crew(kickR[i], i / 4), cube, d)), { durations: KICK_DURATIONS, loop: false });
  def(pre + 'photo-pose', (d) => [0, 1].map((i) => combo(kind, color, 0, 0, 0, crew({ ...P.RIDE_CHEER[i], expr: 'happy' }, 0), cube, d)), { ticksPerFrame: 10 });
  // Continue reactions (rare: deferred; they show only around a continue). The bike and both
  // riders are in every frame, so no other set has the same picture (no dense alias).
  if (o.tell === 'wheelie') {
    def(pre + 'gloat', (d) => GLOAT_TILT.map((rot, k) => combo(kind, color, k, rot, k / 8, crew(GLOAT_UP[k], k / 8, GLOAT_PASSENGER[k]), cube, d)), { ticksPerFrame: GLOAT_TPF.wheelie, defer: true });
  } else {
    def(pre + 'gloat', (d) => [0, 1].map((k) => combo(kind, color, 0, 0, 0, crew(GLOAT_PHONE[k], 0), cube, d, withPhone)), { ticksPerFrame: GLOAT_TPF.phone, defer: true });
  }
  def(pre + 'cower', (d) => [0, 1].map((k) => {
    const f = combo(kind, color, 0, COWER_TILT[k], 0, crew(COWER_UP[k], 0, COWER_PASSENGER[k]), cube, d);
    return { ...f, oy: f.oy + COWER_LIFT[k] };
  }), { ticksPerFrame: COWER_TPF, defer: true });
  // Deaths: the rider alone (the bike goes its own way as an fx).
  const bareStyle = style;
  // A twin's strip is the same picture: 2× / 4× an alias of it. `all`: share the twin at 1× as
  // well (the rare deferred strips, to keep the rider set inside its generation budget).
  const rideOnly = (name: string, gen: (d: Density) => Frame[], so: StripOpts, all = false): void => {
    const twin = o.same ? `enemy/${o.same}/${name}` : undefined;
    defAs(pre + name, gen, so, twin, () => (all && twin ? [...getFrames(twin, 1)] : gen(1)));
  };
  const people = (poses: readonly Pose[], hat: boolean) => (d: Density): Frame[] => poses.map((p) => {
    let f: Frame = renderHuman(bareStyle, { weapon: 'none', ...p, hat }, 'full', d);
    if (cube) f = withCube(f);
    return f;
  });
  rideOnly('die', people(P.DIE, false), { durations: [5, 5, 6, 6, 8, 20], loop: false });
  rideOnly('die-knife', people(P.DIE_KNIFE, false), { durations: [8, 6, 6, 6, 20], loop: false });
  rideOnly('die-blast', (d) => blastFrames(bareStyle, { hat: false, weapon: 'none' }, d), { durations: [5, 5, 5, 5, 30], loop: false });
  // HD flames may reach a few art px past the trimmed 1× box: cut them to it here (geometry is law).
  rideOnly('die-burn', (d) => (d === 1 ? burnFrames(bareStyle, { weapon: 'none' }, 9, 1) : onBoxes(burnFrames(bareStyle, { weapon: 'none' }, 9, d), getFrames(pre + 'die-burn', 1), d)), { ticksPerFrame: 6, loop: false });
  const stand = (d: Density): Frame => renderHuman(bareStyle, { weapon: 'none', ...P.STAND }, 'full', d);
  rideOnly('die-crush', (d) => (d === 1 ? crushStrip(stand(1)) : crushStripHi(stand(1), stand(d), getFrames(pre + 'die-crush', 1))), { durations: CRUSH_TIMING, loop: false });
  rideOnly('flee', people(P.PANIC_FLAIL, false), { ticksPerFrame: 4 });
  if (o.tell === 'wheelie') {
    // The youth falls off the seat, lies still, then gets up and runs (rare: deferred).
    rideOnly('die-seat', people(tween(style, DIE_SEAT_KEYS, { perKey: [0, 1, 0, 0], ease: ['in', 'out', 'linear', 'linear'] }), false), { durations: DIE_SEAT_DURATIONS, loop: false, defer: true }, true);
    rideOnly('get-up', people(GET_UP_KEYS, false), { durations: GET_UP_DURATIONS, loop: false, defer: true }, true);
  }
  defAs(pre + 'bike', (d) => bikeWreck(kind, color, !!pass, d), { durations: [6, 6, 6, 8, 6, 6], loop: false }, o.sameBike && `enemy/${o.sameBike}/bike`);
  // The passenger jumps off and runs for it (an fx, see FatbikeYouth.deathEffects).
  if (pass) defAs(pre + 'passenger-flee', (d) => P.PANIC_FLAIL.map((p) => renderHuman(pass, { weapon: 'none', ...p, hat: false }, 'full', d)), { ticksPerFrame: 4 }, o.passengerSet && `enemy/${o.passengerSet}/flee`);
}

/** The riderless bike: on its side, skidding, then fading out (dithered away; at 2× / 4× in whole logical px, the 1× pattern). */
function bikeWreck(kind: BikeKind, color: string, pair: boolean, d: Density = 1): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 6; i++) {
    let f: Frame;
    if (d === 1) {
      const s = new Sketch(64, 56, 32, 50);
      drawBike(s, kind, { color, rot: i === 0 ? -10 : 0, phase: i % 4, pair });
      f = s.frame();
    } else {
      const g = bikeAt(kind, { color, rot: i === 0 ? -10 : 0, phase: i % 4, pair }, 0, d);
      f = { ...g, buf: g.buf.clone() };
    }
    // Lying down: squash vertically to a low skid (keep it readable), then dither away.
    const fade = i < 3 ? 0 : (i - 2) / 4;
    if (fade > 0) {
      const b = f.buf;
      // Logical px of the 64 × 56 bike sketch (the HD bike frame is its opaque box only).
      const lx = BIKE_OX - f.ox;
      const ly = BIKE_OY - f.oy;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (((((x / d) | 0) + lx) * 7 + (((y / d) | 0) + ly) * 13 + i * 5) % 8 / 8 < fade) b.set(x, y, 0);
    }
    out.push(f);
  }
  return out;
}

/** A small cap tumbling (4 turning frames, centre anchor). */
function capFrames(color: Color, peak: Color): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new PixelBuffer(10, 8);
    b.ellipse(1, 1, 7, 5, color);
    b.rect(1, 4, 7, 1, color);
    const px = i % 2 === 0 ? 6 : 0;
    b.rect(px, 4, 4, 2, peak);
    b.set(4, 1, PAL.snow[3]);
    const r = i >= 2 ? b.flipped(false, true) : b;
    out.push({ buf: r.padded(1).outline(INK), ox: 6, oy: 5 });
  }
  return out;
}

// ------------------------------------------------------------------------------------ registration

/** Youth set id for a look (0–3), a skin and pair mode. */
export function youthSet(look: number, skin: SkinKey, pair: boolean): string {
  const base = pair ? 'fatbike-youth-pair' : 'fatbike-youth';
  return look === 0 && skin === 'a' && !pair ? 'fatbike-youth' : `${base}-${look}${skin}`;
}

export function youthStyle(look: number, skin: SkinKey): HumanStyle {
  return { ...YOUTH_LOOKS[look], skin: SKINS[skin] };
}

// The skins of one look ride the same bike: skin a's `bike` strip serves b and c (dense aliases).
for (let look = 0; look < YOUTH_LOOKS.length; look++) {
  for (const skin of Object.keys(SKINS) as SkinKey[]) {
    const style = youthStyle(look, skin);
    const bike = (pair: boolean): string | undefined => (skin === 'a' ? undefined : youthSet(look, 'a', pair));
    defineRiderSet(youthSet(look, skin, false), { kind: 'fat', style, color: YOUTH_FRAME[look], tell: 'wheelie', gag: 'bob', sameBike: bike(false) });
    const pk = (look + 2) % YOUTH_LOOKS.length;
    const ps: SkinKey = skin === 'a' ? 'c' : skin === 'b' ? 'a' : 'b';
    defineRiderSet(youthSet(look, skin, true), {
      kind: 'fat',
      style,
      color: YOUTH_FRAME[look],
      passenger: youthStyle(pk, ps),
      tell: 'wheelie',
      gag: 'bob',
      same: youthSet(look, skin, false),
      passengerSet: youthSet(pk, ps, false),
      sameBike: bike(true),
    });
  }
}

for (const skin of Object.keys(SKINS) as SkinKey[]) {
  const set = skin === 'b' ? 'delivery-rider' : `delivery-rider-${skin}`;
  defineRiderSet(set, { kind: 'city', style: { ...DELIVERY_STYLE, skin: SKINS[skin] }, color: 'stone', cube: true, tell: 'bell', gag: 'phone', sameBike: skin === 'b' ? undefined : 'delivery-rider' });
}

defineSprite('enemy/fatbike-youth/cap', () => capFrames(PAL.black[1], PAL.black[2]), { ticksPerFrame: 4, hd: (d) => capFramesHd(d) });
/** The popped cube backpack tumbling (`d` 2 / 4: the HD bag). */
function foodCube(d: Density): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = d === 1 ? cubePack(true) : cubePackHd(true, d);
    const r = i % 2 ? b.flipped(true, false) : b;
    out.push(d === 1 ? { buf: r, ox: 8, oy: 8 } : { buf: r, ox: 8, oy: 8, density: d });
  }
  return out;
}
defineSprite('enemy/delivery-rider/food-cube', () => foodCube(1), { ticksPerFrame: 5, hd: (d) => foodCube(d) });
