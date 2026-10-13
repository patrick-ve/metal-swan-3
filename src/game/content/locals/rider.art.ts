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
 * Strips per set (`enemy/<set>/…`): idle (2), ride (4, pedalling), gag (4: fatbike = head bob to
 * the music, delivery = checking his phone), alert (1), tell (2: fatbike wheelie, delivery bell),
 * kick (2), photo-pose (2), die / die-knife / die-blast / die-burn / die-crush (the rider alone,
 * the bike leaves as an fx), flee (4: runs off), bike (6: the riderless bike skids and fades),
 * cap (4: the flying cap), food-cube (4: the popped cube backpack).
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { withPieces, type Piece } from '../../art/human-fx';
import { blastFrames, burnFrames } from '../../art/human-sprites';
import { renderHuman, type ArmPose, type HumanStyle, type LegPose, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { R } from '../../art/paint';
import { CRUSH_TIMING, FLAT, Sketch, crushStrip } from '../creatures/draw';

export type BikeKind = 'fat' | 'city';

interface BikeGeo {
  r: number;
  rear: readonly [number, number];
  front: readonly [number, number];
  bb: readonly [number, number];
  hip: readonly [number, number];
  crank: number;
}

/** Bike geometry (body space: x forward, y up negative, ground at 0). */
export const BIKE: Readonly<Record<BikeKind, BikeGeo>> = {
  fat: { r: 7, rear: [-11, -7], front: [12, -7], bb: [0, -10], hip: [-4, -20], crank: 3 },
  city: { r: 8, rear: [-13, -8], front: [13, -8], bb: [-1, -11], hip: [-4, -23], crank: 3 },
};

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

export interface BikeOpts {
  /** Frame colour ramp. */
  color: string;
  /** Rotation (degrees, negative = front up) about the rear wheel's ground contact. */
  rot?: number;
  /** Wheel phase 0..3. */
  phase?: number;
  /** A passenger seat on the rear rack (no speaker). */
  pair?: boolean;
}

type Pt = readonly [number, number];

/** Rotate a body-space point about the rear wheel's ground contact. */
function rotor(geo: BikeGeo, deg: number): (p: Pt) => [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const px = geo.rear[0];
  return (p) => {
    const dx = p[0] - px;
    const dy = p[1];
    return [px + dx * c - dy * s, dx * s + dy * c];
  };
}

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

/** A rider on the bike: the human placed with its hip on the saddle. */
function rider(style: HumanStyle, pose: Pose, kind: BikeKind, rot: number, extra?: (f: Frame) => Frame): Piece {
  let f = renderHuman(style, { weapon: 'none', grounded: false, ...pose, rot: (pose.rot ?? 0) + rot }, 'full');
  if (extra) f = extra(f) as typeof f;
  const geo = BIKE[kind];
  const hip = rotor(geo, rot)(geo.hip);
  const fh = f.pts?.hip ?? [0, -15];
  return { buf: f.buf, x: Math.round(hip[0] - fh[0] - f.ox), y: Math.round(hip[1] - fh[1] - f.oy) };
}

/** The green cube backpack (with tiny EATS letters), a piece placed behind the torso. */
export function cubePack(open = false): PixelBuffer {
  const s = new Sketch(16, 16, 0, 0);
  s.add(PAL.green, (b) => b.rect(1, open ? 4 : 2, 13, 12 - (open ? 2 : 0), FLAT));
  if (open) s.add(PAL.green, (b) => b.poly([1, 4, 14, 4, 11, 0, 3, 1], FLAT));
  s.detail((b) => {
    // A dark band with four tiny letters (E A T S, 2×3 each).
    const y = open ? 8 : 7;
    b.rect(2, y, 11, 4, PAL.black[1]);
    const G = PAL.snow[3];
    // E
    b.vline(3, y, y + 2, G); b.set(4, y, G); b.set(4, y + 2, G);
    // A
    b.vline(6, y + 1, y + 2, G); b.set(7, y, G); b.vline(8, y + 1, y + 2, G);
    // T
    b.set(9, y, G); b.vline(10, y, y + 2, G);
    // S
    b.set(12, y, G); b.set(11, y + 1, G); b.set(12, y + 2, G);
    b.hline(2, 13, open ? 5 : 3, PAL.green[4]);
  });
  return s.frame().buf;
}

/** Add the cube backpack to a rider frame (behind the torso, over the lower back). */
function withCube(f: Frame): Frame {
  const hip = f.pts?.hip ?? [0, -15];
  return withPieces(f, [{ buf: cubePack(), x: hip[0] - 15, y: hip[1] - 22, behind: true }]);
}

/** One frame: bike + rider (+ passenger). */
function combo(kind: BikeKind, color: string, phase: number, rot: number, people: Array<{ style: HumanStyle; pose: Pose; at?: 'rack' }>, cube: boolean): Frame {
  const geo = BIKE[kind];
  const s = new Sketch(64, 56, 32, 50);
  drawBike(s, kind, { color, rot, phase, pair: people.length > 1 });
  const bike = s.frame();
  const pieces: Piece[] = [];
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i];
    let piece = rider(p.style, p.pose, kind, rot, cube && i === 0 ? withCube : undefined);
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

const PASSENGER_SIT: Pose = { lean: 2, armN: { sh: 30, el: 60, hand: 'grip' }, armF: { sh: 20, el: 70, hand: 'grip' }, legN: { hip: 70, knee: 80 }, legF: { hip: 60, knee: 90 } };

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
}

const def = (id: string, gen: () => Frame[], o: { ticksPerFrame?: number; durations?: readonly number[]; loop?: boolean } = {}): void => defineSprite(id, gen, { trim: true, ...o });

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
  def(pre + 'ride', () => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, crew(lean[i % 2], i / 4), cube)), { ticksPerFrame: 5 });
  def(pre + 'idle', () => [0, 1].map((i) => combo(kind, color, i * 2, 0, crew(sit[i], i / 2), cube)), { ticksPerFrame: 12 });
  def(pre + 'alert', () => [combo(kind, color, 0, 0, crew({ ...P.RIDE_UP[0], expr: 'shout' }, 0), cube)], { ticksPerFrame: 30 });
  if (o.gag === 'bob') {
    def(pre + 'gag', () => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, crew({ ...sit[0], head: { dy: i % 2, tilt: i % 2 ? 8 : -4 }, expr: i % 2 ? 'blink' : 'happy' }, i / 4), cube)), { ticksPerFrame: 7 });
  } else {
    // One hand off the bar, the phone up to his face.
    const phone = (k: number): Pose => ({ ...sit[0], armN: { to: [6, -5 - k], hand: 'fist' }, head: { tilt: 14 }, expr: k ? 'blink' : 'normal' });
    def(pre + 'gag', () => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, crew(phone(i % 2), i / 4), cube)), { ticksPerFrame: 6 });
  }
  if (o.tell === 'wheelie') {
    def(pre + 'tell', () => [0, 1].map((i) => combo(kind, color, i * 2, -16 - i * 2, crew({ ...P.RIDE_UP[0], lean: -6, expr: 'shout' }, i / 2, { ...PASSENGER_SIT, lean: -10, expr: 'shout' }), cube)), { ticksPerFrame: 6 });
  } else {
    // Ringing the bell: the near thumb flicks, he shouts.
    def(pre + 'tell', () => [0, 1].map((i) => combo(kind, color, i * 2, 0, crew({ ...lean[0], armN: grip(9, 1 + i), expr: i ? 'shout' : 'normal' }, i / 2), cube)), { ticksPerFrame: 5 });
  }
  def(pre + 'kick', () => [0, 1].map((i) => combo(kind, color, i * 2, 0, pass ? crew(lean[0], i / 2, PASSENGER_KICK[i]) : crew(KICK_POSES[i], i / 2), cube)), { durations: [3, 30] , loop: false });
  def(pre + 'photo-pose', () => [0, 1].map((i) => combo(kind, color, 0, 0, crew({ ...P.RIDE_CHEER[i], expr: 'happy' }, 0), cube)), { ticksPerFrame: 10 });
  // Deaths: the rider alone (the bike goes its own way as an fx).
  const bareStyle = style;
  const people = (poses: readonly Pose[], hat: boolean) => (): Frame[] => poses.map((p) => {
    let f: Frame = renderHuman(bareStyle, { weapon: 'none', ...p, hat }, 'full');
    if (cube) f = withCube(f);
    return f;
  });
  def(pre + 'die', people(P.DIE, false), { durations: [5, 5, 6, 6, 8, 20], loop: false });
  def(pre + 'die-knife', people(P.DIE_KNIFE, false), { durations: [8, 6, 6, 6, 20], loop: false });
  def(pre + 'die-blast', () => blastFrames(bareStyle, { hat: false, weapon: 'none' }), { durations: [5, 5, 5, 5, 30], loop: false });
  def(pre + 'die-burn', () => burnFrames(bareStyle, { weapon: 'none' }), { ticksPerFrame: 6, loop: false });
  def(pre + 'die-crush', () => crushStrip(renderHuman(bareStyle, { weapon: 'none', ...P.STAND }, 'full')), { durations: CRUSH_TIMING, loop: false });
  def(pre + 'flee', people(P.PANIC_FLAIL, false), { ticksPerFrame: 4 });
  def(pre + 'bike', () => bikeWreck(kind, color, !!pass), { durations: [6, 6, 6, 8, 6, 6], loop: false });
  // The passenger jumps off and runs for it (an fx, see FatbikeYouth.deathEffects).
  if (pass) def(pre + 'passenger-flee', () => P.PANIC_FLAIL.map((p) => renderHuman(pass, { weapon: 'none', ...p, hat: false }, 'full')), { ticksPerFrame: 4 });
}

/** The riderless bike: on its side, skidding, then fading out (dithered away). */
function bikeWreck(kind: BikeKind, color: string, pair: boolean): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 6; i++) {
    const s = new Sketch(64, 56, 32, 50);
    drawBike(s, kind, { color, rot: i === 0 ? -10 : 0, phase: i % 4, pair });
    const f = s.frame();
    // Lying down: squash vertically to a low skid (keep it readable), then dither away.
    const fade = i < 3 ? 0 : (i - 2) / 4;
    if (fade > 0) {
      const b = f.buf;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (((x * 7 + y * 13 + i * 5) % 8) / 8 < fade) b.set(x, y, 0);
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

for (let look = 0; look < YOUTH_LOOKS.length; look++) {
  for (const skin of Object.keys(SKINS) as SkinKey[]) {
    const style = youthStyle(look, skin);
    defineRiderSet(youthSet(look, skin, false), { kind: 'fat', style, color: YOUTH_FRAME[look], tell: 'wheelie', gag: 'bob' });
    const pk = (look + 2) % YOUTH_LOOKS.length;
    const ps: SkinKey = skin === 'a' ? 'c' : skin === 'b' ? 'a' : 'b';
    defineRiderSet(youthSet(look, skin, true), { kind: 'fat', style, color: YOUTH_FRAME[look], passenger: youthStyle(pk, ps), tell: 'wheelie', gag: 'bob' });
  }
}

for (const skin of Object.keys(SKINS) as SkinKey[]) {
  defineRiderSet(skin === 'b' ? 'delivery-rider' : `delivery-rider-${skin}`, { kind: 'city', style: { ...DELIVERY_STYLE, skin: SKINS[skin] }, color: 'stone', cube: true, tell: 'bell', gag: 'phone' });
}

defineSprite('enemy/fatbike-youth/cap', () => capFrames(PAL.black[1], PAL.black[2]), { ticksPerFrame: 4 });
defineSprite('enemy/delivery-rider/food-cube', () => {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = cubePack(true);
    const r = i % 2 ? b.flipped(true, false) : b;
    out.push({ buf: r, ox: 8, oy: 8 });
  }
  return out;
}, { ticksPerFrame: 5 });
