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
 * cap (4: the flying cap), food-cube (4: the popped cube backpack).
 *
 * 2× art (mission ams): every strip is registered again at density 2 — the rider from the rig at
 * 2×, the bikes (fat tyres with tread, mag rims, battery, phone mount, speaker; spoked city
 * wheels), the cube backpack and the cap redrawn on the 2× grid (`…Hi` below).
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, getFrames } from '../../../engine/sprites';
import { HI, HiSketch, outlineHi, type HiPen } from '../../art/hi';
import { crushStripHi } from '../../art/hi-strips';
import { withPieces, type Piece } from '../../art/human-fx';
import { blastFrames, burnFrames } from '../../art/human-sprites';
import { renderHuman, type ArmPose, type Density, type HumanStyle, type LegPose, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { R } from '../../art/paint';
import { CRUSH_TIMING, FLAT, Sketch, crushStrip, turnSquash } from '../creatures/draw';
import { inbetween, tween } from '../../art/tween';

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

// ------------------------------------------------------------------------------------ the bike at 2×

/** Pixels of a 2× wheel buffer by their distance from its centre (in 2× px) and direction. */
function ringPaint(b: PixelBuffer, paint: (q: number, ux: number, uy: number, x: number, y: number) => void): void {
  const c = b.w / 2;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const q = Math.hypot(dx, dy);
      paint(q, q > 0 ? dx / q : 0, q > 0 ? dy / q : 0, x, y);
    }
  }
}

/**
 * The 2× fat tyre (the `fatWheel` disc doubled: 2·(2r + 1) px): thick rubber lit on the
 * upper-left, a 1-px sidewall line, 16 tread notches turning with the phase, a small steel mag
 * rim with three dark spokes, a hub and a bolt.
 */
function fatWheelHi(r: number, phase: number): PixelBuffer {
  const t = R('black');
  const rim = R('steel');
  const D = (r * 2 + 1) * HI;
  const R2 = D / 2;
  const b = new PixelBuffer(D, D);
  b.ellipse(0, 0, D, D, t[1]);
  const rr = Math.max(1, r - 4);
  const RR = (rr * 2 + 1) * HI / 2;
  ringPaint(b, (q, ux, uy, x, y) => {
    const lit = ux + uy < -0.6;
    const dark = ux + uy > 0.9;
    if (q > R2 - 2.2 && lit) b.set(x, y, q > R2 - 1.1 && ux + uy < -1.1 ? t[3] : t[2]);
    else if (q > R2 - 1.6 && dark) b.set(x, y, t[0]);
    // Sidewall: a line just outside the rim, lit on its upper-left arc (so it shows on the
    // black rubber), dark on the lower-right.
    else if (q > RR + 0.6 && q <= RR + 1.6) b.set(x, y, ux + uy < 0 ? t[2] : t[0]);
  });
  // Tread on the outer edge: 16 knobs, a broken 1-px ring one ramp step lighter than the rubber,
  // turning with the phase (dark knobs on the dark tyre do not show at game scale).
  for (let k = 0; k < 16; k++) {
    const a = ((k + phase) / 16) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = Math.floor(R2 + ca * (R2 - 1.5));
    const y = Math.floor(R2 + sa * (R2 - 1.5));
    if (b.get(x, y) === t[1] || b.get(x, y) === t[0]) b.set(x, y, t[2]);
  }
  // The rim: a steel disc, lit edge top-left, shadow edge bottom-right.
  const r0 = Math.round(R2 - RR);
  const rd = Math.round(RR * 2);
  const rb = new PixelBuffer(D, D);
  rb.ellipse(r0, r0, rd, rd, rim[2]);
  ringPaint(rb, (q, ux, uy, x, y) => {
    if (q > RR - 1.1 && ux + uy < -0.5) rb.set(x, y, rim[3]);
    else if (q > RR - 1.1 && ux + uy > 0.5) rb.set(x, y, rim[1]);
  });
  // Three spokes of the mag wheel, turning with the phase.
  for (let k = 0; k < 3; k++) {
    const a = (phase / 4) * Math.PI * 0.5 + (k * Math.PI * 2) / 3;
    rb.line(Math.floor(R2 + Math.cos(a) * 1.5), Math.floor(R2 + Math.sin(a) * 1.5), Math.floor(R2 + Math.cos(a) * (RR - 1.5)), Math.floor(R2 + Math.sin(a) * (RR - 1.5)), rim[0]);
  }
  rb.rect(R2 - 1, R2 - 1, 2, 2, rim[1]);
  rb.set(R2 - 1, R2 - 1, rim[4]);
  b.blit(rb, 0, 0);
  return b;
}

/** The 2× city wheel: a 4-px tyre (lit top-left), a 2-tone silver rim, eight 1-px spokes. */
function cityWheelHi(r: number, phase: number): PixelBuffer {
  const t = R('black');
  const rim = R('steel');
  const D = (r * 2 + 1) * HI;
  const R2 = D / 2;
  const b = new PixelBuffer(D, D);
  b.ellipse(0, 0, D, D, t[1]);
  // Rim band (2 px) inside the tyre, then the open wheel.
  const ri = R2 - 4;
  b.ellipse(Math.round(R2 - ri), Math.round(R2 - ri), Math.round(ri * 2), Math.round(ri * 2), rim[3]);
  const ro = R2 - 6;
  b.ellipse(Math.round(R2 - ro), Math.round(R2 - ro), Math.round(ro * 2), Math.round(ro * 2), 0);
  ringPaint(b, (q, ux, uy, x, y) => {
    if (q > R2 - 4) {
      if (ux + uy < -0.7 && q > R2 - 2.5) b.set(x, y, t[2]);
      else if (ux + uy > 1) b.set(x, y, t[0]);
    } else if (q <= ri - 1 && q > ro) b.set(x, y, rim[2]);
    else if (ux + uy > 0.8) b.set(x, y, rim[2]);
  });
  for (let k = 0; k < 8; k++) {
    const a = ((k + phase / 2) / 8) * Math.PI * 2;
    b.line(Math.floor(R2 + Math.cos(a) * 1), Math.floor(R2 + Math.sin(a) * 1), Math.floor(R2 + Math.cos(a) * (ro + 0.5)), Math.floor(R2 + Math.sin(a) * (ro + 0.5)), rim[k & 1 ? 1 : 2]);
  }
  b.rect(R2 - 1, R2 - 1, 2, 2, rim[2]);
  b.set(R2 - 1, R2 - 1, rim[4]);
  return b;
}

/** 2× buffer column / row of the LEFT / TOP edge of the 1× pixel a body-space point lands on. */
const gx = (p: HiPen, x: number): number => Math.round(p.ox + x) * HI;
const gy = (p: HiPen, y: number): number => Math.round(p.oy + y) * HI;

/**
 * The 2× twin of a 1× `thickLine(X(a), Y(a), X(b), Y(b), w)` (or a 1-px `line` for w 1): the same
 * pixels on the 1× grid, drawn as a `2w` capsule on the 2× grid.
 */
function tube(p: HiPen, a: Pt, b: Pt, w: number, c: Color): void {
  const o = w % 2 === 0 ? 1 : 0;
  p.b.thickLine(gx(p, a[0]) + o, gy(p, a[1]) + o, gx(p, b[0]) + o, gy(p, b[1]) + o, w * HI, c);
}

/** A 1-px (2×) line between the centres of the 1× pixels of two body-space points, offset by (dx, dy) 2× px. */
function hair(p: HiPen, a: Pt, b: Pt, c: Color, dx = 0, dy = 0): void {
  p.b.line(gx(p, a[0]) + dx, gy(p, a[1]) + dy, gx(p, b[0]) + dx, gy(p, b[1]) + dy, c);
}

/** The bike at 2× (`drawBike` on the 2× grid, the parts in the same 1× places). */
function drawBikeHi(s: HiSketch, kind: BikeKind, o: BikeOpts): void {
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
  const wheelBuf = (fat ? fatWheelHi : cityWheelHi)(geo.r, phase);
  const r = geo.r * HI;
  s.detail((p) => {
    p.b.blit(wheelBuf, gx(p, rear[0]) - r, gy(p, rear[1]) - r);
    p.b.blit(wheelBuf, gx(p, front[0]) - r, gy(p, front[1]) - r);
  });
  // Chain stay (with the chain: a 1-px steel dash line along it), seat stay.
  s.add(black, (p) => {
    tube(p, rear, bb, 1, FLAT);
    tube(p, rear, seat, 1, FLAT);
  }, { ring: false, hi: 0.5, lo: 0.5 });
  s.detail((p) => {
    const ax = gx(p, rear[0]) + 1;
    const ay = gy(p, rear[1]) + 1;
    const bx = gx(p, bb[0]) + 1;
    const by = gy(p, bb[1]) + 1;
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let i = 2; i < n - 1; i += 2) p.b.set(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n) + 1, steel[2]);
  });
  // Main frame: seat tube, top tube, down tube, fork, lit along the top with 1-px bands.
  s.add(frame, (p) => {
    tube(p, bb, seat, 2, FLAT);
    tube(p, seat, head, 2, FLAT);
    tube(p, head, bb, fat ? 3 : 2, FLAT);
    tube(p, head, front, 2, FLAT);
  }, { hi: 0.5, lo: 0.5 });
  // Weld seams and the head tube badge.
  s.detail((p) => {
    p.b.set(gx(p, head[0]) + 1, gy(p, head[1]) + 1, frame[Math.min(frame.length - 1, 3)]);
    p.b.set(gx(p, head[0]) + 2, gy(p, head[1]) + 2, steel[3]);
  });
  if (fat) {
    // The battery on the down tube: a black pack with a seam, a lock and three green charge LEDs.
    const b0 = T([5, -14]);
    const b1 = T([2, -11]);
    s.add(black, (p) => tube(p, b0, b1, 3, FLAT), { hi: 0.5, lo: 0.5 });
    s.detail((p) => {
      hair(p, b0, b1, black[0], 1, 1);
      const mx = (gx(p, b0[0]) + gx(p, b1[0])) / 2;
      const my = (gy(p, b0[1]) + gy(p, b1[1])) / 2;
      for (let k = 0; k < 3; k++) p.b.set(Math.round(mx) + k - 2, Math.round(my) - k, PAL.green[k < 2 ? 4 : 2]);
      p.b.set(gx(p, b1[0]), gy(p, b1[1]) + 1, steel[3]);
    });
  }
  // Stem, handlebar and its grips.
  s.add(steel, (p) => {
    tube(p, head, bar, 1, FLAT);
    p.b.rect(gx(p, bar[0]) - 2, gy(p, bar[1]), 6, 2, FLAT);
  }, { ring: false, hi: 0.5, lo: 0.5 });
  s.detail((p) => {
    p.b.rect(gx(p, bar[0]) + 2, gy(p, bar[1]), 2, 2, black[1]);
    p.b.set(gx(p, bar[0]) + 2, gy(p, bar[1]), black[2]);
  });
  // Saddle: a padded black seat with a lit top seam and a steel post.
  const sd = T([geo.hip[0], geo.hip[1] + 1]);
  s.add(black, (p) => p.b.rect(gx(p, sd[0]) - 6, gy(p, sd[1]), 12, 4, FLAT), { hi: 0.5, lo: 0.5 });
  s.detail((p) => {
    p.b.hline(gx(p, sd[0]) - 4, gx(p, sd[0]) + 3, gy(p, sd[1]) + 1, black[3]);
  });
  // Rear rack: two rails and a strut down to the axle.
  const rk0 = T([geo.hip[0] - 2, -16]);
  const rk1 = T([rear[0] - 4, -16]);
  s.add(steel, (p) => {
    tube(p, rk0, rk1, 1, FLAT);
    hair(p, rk1, rear, FLAT, 1, 1);
  }, { ring: false, hi: 0.5, lo: 0.5 });
  if (fat && !o.pair) {
    // The speaker: a black box with a steel cone (rings), a bass port and a green power LED.
    const sp = T([-16, -21]);
    s.add(black, (p) => p.b.rect(gx(p, sp[0]), gy(p, sp[1]), 12, 10, FLAT), { hi: 0.5, lo: 0.5 });
    s.detail((p) => {
      const x = gx(p, sp[0]);
      const y = gy(p, sp[1]);
      p.b.ellipse(x + 3, y + 2, 7, 7, steel[1]);
      p.b.ellipse(x + 4, y + 3, 5, 5, steel[2]);
      p.b.set(x + 5, y + 4, steel[4]);
      p.b.set(x + 6, y + 5, black[0]);
      p.b.set(x + 2, y + 1, PAL.green[4]);
      p.b.hline(x + 9, x + 10, y + 8, black[0]);
    });
  }
  // Phone on a steel clamp above the bar: a black case, a lit screen with a map line.
  const ph = T([bar[0] + 2, bar[1] - 3]);
  s.detail((p) => {
    const x = gx(p, ph[0]);
    const y = gy(p, ph[1]);
    p.b.rect(x, y, 4, 6, INK);
    p.b.rect(x + 1, y + 1, 2, 4, PAL.sky[2]);
    p.b.set(x + 1, y + 1, PAL.sky[3]);
    p.b.set(x + 2, y + 3, PAL.gold[3]);
    p.b.set(x + 1, y + 4, PAL.sky[3]);
    p.b.vline(x + 1, y + 6, y + 6, steel[2]);
  });
  if (fat) {
    // Mudguard over the front wheel: a 2-px arc in the frame colour with a lit top edge.
    s.add(frame, (p) => {
      for (let k = -6; k <= 6; k++) {
        const a = -Math.PI / 2 + (k / 6) * 0.9;
        const q = T([geo.front[0] + Math.cos(a) * (r / HI + 1), geo.front[1] + Math.sin(a) * (r / HI + 1)]);
        p.b.rect(Math.round((p.ox + q[0]) * HI), Math.round((p.oy + q[1]) * HI), 2, 2, FLAT);
      }
    }, { ring: false, hi: 0.5, lo: 0, clean: false });
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

/** A rider on the bike: the human placed with its hip on the saddle (`d` 2: a 2× piece). */
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

/**
 * The 2× cube backpack (the 16 × 16 box of `cubePack` on the 2× grid): green thermal bag with a
 * lit lid seam and stitched corners, a carry strap, and the burger logo in detail — sesame bun,
 * lettuce frill, cheese, patty, bottom bun. Symmetric, like the 1× logo (the rider is mirrored).
 */
export function cubePackHi(open = false): PixelBuffer {
  const s = new HiSketch(16, 16, 0, 0, 2);
  s.add(PAL.green, (p) => p.rect(1, open ? 4 : 2, 13, 12 - (open ? 2 : 0), FLAT), { hi: 0.5, lo: 0.5 });
  if (open) s.add(PAL.green, (p) => p.poly([1, 4, 14, 4, 11, 0, 3, 1], FLAT), { hi: 0.5, lo: 0.5 });
  s.detail((p) => {
    const b = p.b;
    const G = PAL.green;
    const y = (open ? 8 : 7) * HI;
    const top = (open ? 5 : 3) * HI;
    // Lid seam (lit) with a dark stitch line under it; stitched vertical edges.
    b.hline(4, 27, top + 1, G[4]);
    b.hline(4, 27, top + 2, G[1]);
    for (let yy = top + 3; yy < 28; yy += 2) {
      b.set(4, yy, G[3]);
      b.set(27, yy, G[1]);
    }
    // The dark logo band (11 × 4 logical) with a lit top edge.
    b.rect(4, y, 22, 8, PAL.black[1]);
    b.hline(4, 25, y, PAL.black[2]);
    // Burger, centred on the band (x 15 | 16 is the axis).
    b.hline(11, 20, y + 1, PAL.gold[2]);
    b.hline(10, 21, y + 2, PAL.gold[2]);
    b.hline(12, 19, y + 1, PAL.gold[3]);
    for (const x of [12, 15, 16, 19]) b.set(x, y + 2, PAL.snow[3]);
    for (let x = 9; x <= 22; x++) b.set(x, y + 3, (x & 1) === 0 ? PAL.green[4] : PAL.green[3]);
    b.hline(10, 21, y + 4, PAL.gold[3]);
    b.set(10, y + 5, PAL.gold[3]);
    b.set(21, y + 5, PAL.gold[3]);
    b.hline(10, 21, y + 5, PAL.brown[1]);
    b.hline(11, 20, y + 5, PAL.brown[2]);
    b.hline(11, 20, y + 6, PAL.gold[1]);
    // Carry strap on top (closed bag only).
    if (!open) {
      b.hline(12, 19, 5, PAL.black[2]);
      b.set(12, 6, PAL.black[1]);
      b.set(19, 6, PAL.black[1]);
    }
  });
  // A 2-px outline with its corners cut (no square-corner pixels): the bag is often the frame's
  // top-left extreme, and the 1× frame's box has no room for them.
  return s.buf.outline(INK).outline(INK);
}

/** Add the cube backpack to a rider frame (behind the torso, over the lower back). */
function withCube(f: Frame): Frame {
  const hip = f.pts?.hip ?? [0, -15];
  if ((f.density ?? 1) !== 1) return withPieces(f, [{ buf: cubePackHi(), x: hip[0] - 15, y: hip[1] - 22, behind: true, density: HI }]);
  return withPieces(f, [{ buf: cubePack(), x: hip[0] - 15, y: hip[1] - 22, behind: true }]);
}

/** 2× bikes by look (a set draws the same few bikes in every strip; read-only, `withPieces` copies). */
const bikeHiCache = new Map<string, Frame>();

/** The 2× bike frame for these options (cached). */
function bikeHi(kind: BikeKind, o: BikeOpts): Frame {
  const key = `${kind}|${o.color}|${o.rot ?? 0}|${o.phase ?? 0}|${o.pair === true}`;
  let f = bikeHiCache.get(key);
  if (!f) {
    const s = new HiSketch(64, 56, 32, 50, 2);
    drawBikeHi(s, kind, o);
    f = s.frame();
    bikeHiCache.set(key, f);
  }
  return f;
}

/** One frame: bike + rider (+ passenger); `d` 2 draws it all on the 2× grid. */
function combo(kind: BikeKind, color: string, phase: number, rot: number, people: Array<{ style: HumanStyle; pose: Pose; at?: 'rack' }>, cube: boolean, d: Density = 1): Frame {
  const geo = BIKE[kind];
  let bike: Frame;
  if (d === 1) {
    const s = new Sketch(64, 56, 32, 50);
    drawBike(s, kind, { color, rot, phase, pair: people.length > 1 });
    bike = s.frame();
  } else {
    bike = bikeHi(kind, { color, rot, phase, pair: people.length > 1 });
  }
  const pieces: Piece[] = [];
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i];
    let piece = rider(p.style, p.pose, kind, rot, cube && i === 0 ? withCube : undefined, d);
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
   * pictures, so the 2× art reuses them instead of drawing them again.
   */
  same?: string;
}

type StripOpts = { ticksPerFrame?: number; durations?: readonly number[]; loop?: boolean; defer?: boolean };

/** Register a trimmed strip at 1× and its 2× twin (the same recipe at density 2). */
const def = (id: string, gen: (d: Density) => Frame[], o: StripOpts = {}): void => defineSprite(id, () => gen(1), { trim: true, ...o, hi: () => gen(2) });

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
  def(pre + 'ride', (d) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => combo(kind, color, i % 4, 0, crew(up4[i % 4], i / 8), cube, d)), { durations: RIDE_DURATIONS });
  def(pre + 'idle', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, 0, 0, crew(idle4[i], 0), cube, d)), { durations: IDLE_DURATIONS });
  // Turn-around (U-turn, circle ends, walls): the idle frame squeezed (draw-only, see Rider).
  def(pre + 'turn', (d) => turnSquash(getFrames(pre + 'idle', d)[0], TURN_WIDTHS), { ticksPerFrame: 2, loop: false });
  def(pre + 'alert', (d) => [combo(kind, color, 0, 0, crew({ ...P.RIDE_UP[0], expr: 'shout' }, 0), cube, d)], { ticksPerFrame: 30 });
  if (o.gag === 'bob') {
    def(pre + 'gag', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, crew({ ...sit[0], head: { dy: i % 2, tilt: i % 2 ? 8 : -4 }, expr: i % 2 ? 'blink' : 'happy' }, i / 4), cube, d)), { ticksPerFrame: 7 });
  } else {
    // One hand off the bar, the phone up to his face.
    const phone = (k: number): Pose => ({ ...sit[0], armN: { to: [6, -5 - k], hand: 'fist' }, head: { tilt: 14 }, expr: k ? 'blink' : 'normal' });
    def(pre + 'gag', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, crew(phone(i % 2), i / 4), cube, d)), { ticksPerFrame: 6 });
  }
  if (o.tell === 'wheelie') {
    // At 2× the passenger keeps a closed mouth: his open red mouth just behind the rider's neck
    // reads as a stray red mark.
    // The bike tilt is tweened (−7 → −18), then it rocks on the back wheel; the strip holds its
    // last frame for the rest of the telegraph.
    def(pre + 'tell', (d) => WHEELIE_TILT.map((rot, i) => combo(kind, color, i, rot, crew({ ...P.RIDE_UP[0], lean: i < 1 ? -2 : -6, expr: 'shout' }, i / 4, { ...PASSENGER_SIT, lean: i < 1 ? -4 : -10, expr: d === 1 ? 'shout' : 'normal' }), cube, d)), { durations: WHEELIE_DURATIONS, loop: false });
  } else {
    // Ringing the bell: the near thumb flicks, he shouts.
    def(pre + 'tell', (d) => [0, 1].map((i) => combo(kind, color, i * 2, 0, crew({ ...lean[0], armN: grip(9, 1 + i), expr: i ? 'shout' : 'normal' }, i / 2), cube, d)), { ticksPerFrame: 5 });
  }
  const kickR = kick4(style, KICK_POSES, { ...lean[0], expr: 'shout' });
  const kickP = pass ? kick4(pass, PASSENGER_KICK, { ...PASSENGER_SIT, expr: 'shout' }) : null;
  def(pre + 'kick', (d) => [0, 1, 2, 3].map((i) => combo(kind, color, i, 0, kickP ? crew(lean[0], i / 4, kickP[i]) : crew(kickR[i], i / 4), cube, d)), { durations: KICK_DURATIONS, loop: false });
  def(pre + 'photo-pose', (d) => [0, 1].map((i) => combo(kind, color, 0, 0, crew({ ...P.RIDE_CHEER[i], expr: 'happy' }, 0), cube, d)), { ticksPerFrame: 10 });
  // Deaths: the rider alone (the bike goes its own way as an fx).
  const bareStyle = style;
  // `all`: share the twin at 1× as well (the rider alone is the same art; used for the rare
  // deferred strips to keep the rider set inside its generation budget).
  const rideOnly = (name: string, gen: (d: Density) => Frame[], so: StripOpts, all = false): void => {
    const twin = o.same;
    def(pre + name, (d) => ((d !== 1 || all) && twin ? [...getFrames(`enemy/${twin}/${name}`, d)] : gen(d)), so);
  };
  const people = (poses: readonly Pose[], hat: boolean) => (d: Density): Frame[] => poses.map((p) => {
    let f: Frame = renderHuman(bareStyle, { weapon: 'none', ...p, hat }, 'full', d);
    if (cube) f = withCube(f);
    return f;
  });
  rideOnly('die', people(P.DIE, false), { durations: [5, 5, 6, 6, 8, 20], loop: false });
  rideOnly('die-knife', people(P.DIE_KNIFE, false), { durations: [8, 6, 6, 6, 20], loop: false });
  rideOnly('die-blast', (d) => blastFrames(bareStyle, { hat: false, weapon: 'none' }, d), { durations: [5, 5, 5, 5, 30], loop: false });
  rideOnly('die-burn', (d) => burnFrames(bareStyle, { weapon: 'none' }, 9, d), { ticksPerFrame: 6, loop: false });
  const stand = (d: Density): Frame => renderHuman(bareStyle, { weapon: 'none', ...P.STAND }, 'full', d);
  rideOnly('die-crush', (d) => (d === 1 ? crushStrip(stand(1)) : crushStripHi(stand(1), stand(2), getFrames(pre + 'die-crush', 1))), { durations: CRUSH_TIMING, loop: false });
  rideOnly('flee', people(P.PANIC_FLAIL, false), { ticksPerFrame: 4 });
  if (o.tell === 'wheelie') {
    // The youth falls off the seat, lies still, then gets up and runs (rare: deferred).
    rideOnly('die-seat', people(tween(style, DIE_SEAT_KEYS, { perKey: [0, 1, 0, 0], ease: ['in', 'out', 'linear', 'linear'] }), false), { durations: DIE_SEAT_DURATIONS, loop: false, defer: true }, true);
    rideOnly('get-up', people(GET_UP_KEYS, false), { durations: GET_UP_DURATIONS, loop: false, defer: true }, true);
  }
  def(pre + 'bike', (d) => bikeWreck(kind, color, !!pass, d), { durations: [6, 6, 6, 8, 6, 6], loop: false });
  // The passenger jumps off and runs for it (an fx, see FatbikeYouth.deathEffects).
  if (pass) def(pre + 'passenger-flee', (d) => P.PANIC_FLAIL.map((p) => renderHuman(pass, { weapon: 'none', ...p, hat: false }, 'full', d)), { ticksPerFrame: 4 });
}

/** The riderless bike: on its side, skidding, then fading out (dithered away; at 2× in whole logical px). */
function bikeWreck(kind: BikeKind, color: string, pair: boolean, d: Density = 1): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 6; i++) {
    let f: Frame;
    if (d === 1) {
      const s = new Sketch(64, 56, 32, 50);
      drawBike(s, kind, { color, rot: i === 0 ? -10 : 0, phase: i % 4, pair });
      f = s.frame();
    } else {
      const g = bikeHi(kind, { color, rot: i === 0 ? -10 : 0, phase: i % 4, pair });
      f = { ...g, buf: g.buf.clone() };
    }
    // Lying down: squash vertically to a low skid (keep it readable), then dither away.
    const fade = i < 3 ? 0 : (i - 2) / 4;
    if (fade > 0) {
      const b = f.buf;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if ((((x / d) | 0) * 7 + ((y / d) | 0) * 13 + i * 5) % 8 / 8 < fade) b.set(x, y, 0);
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

/** The 2× cap: crown panels with 1-px seams, a top button, a lit peak with a stitched edge. */
function capFramesHi(color: Color, peak: Color): Frame[] {
  const out: Frame[] = [];
  const K = PAL.black;
  for (let i = 0; i < 4; i++) {
    const b = new PixelBuffer(20, 16);
    b.ellipse(2, 2, 14, 10, color);
    b.rect(2, 8, 14, 2, color);
    // Lit crown, panel seams, the button on top.
    b.ellipse(4, 3, 6, 4, K[2]);
    b.line(9, 3, 7, 9, K[0]);
    b.line(12, 4, 13, 9, K[0]);
    b.rect(8, 2, 2, 1, PAL.snow[3]);
    b.hline(2, 15, 9, K[0]);
    const px = i % 2 === 0 ? 12 : 0;
    b.rect(px, 8, 8, 4, peak);
    b.hline(px, px + 7, 8, K[3]);
    b.hline(px + 1, px + 6, 10, K[1]);
    const r = i >= 2 ? b.flipped(false, true) : b;
    out.push({ buf: outlineHi(r.padded(HI), 2), ox: 6, oy: 5, density: HI });
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
    defineRiderSet(youthSet(look, skin, true), { kind: 'fat', style, color: YOUTH_FRAME[look], passenger: youthStyle(pk, ps), tell: 'wheelie', gag: 'bob', same: youthSet(look, skin, false) });
  }
}

for (const skin of Object.keys(SKINS) as SkinKey[]) {
  defineRiderSet(skin === 'b' ? 'delivery-rider' : `delivery-rider-${skin}`, { kind: 'city', style: { ...DELIVERY_STYLE, skin: SKINS[skin] }, color: 'stone', cube: true, tell: 'bell', gag: 'phone' });
}

defineSprite('enemy/fatbike-youth/cap', () => capFrames(PAL.black[1], PAL.black[2]), { ticksPerFrame: 4, hi: () => capFramesHi(PAL.black[1], PAL.black[2]) });
/** The popped cube backpack tumbling (`d` 2: the 2× bag). */
function foodCube(d: Density): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = d === 1 ? cubePack(true) : cubePackHi(true);
    const r = i % 2 ? b.flipped(true, false) : b;
    out.push(d === 1 ? { buf: r, ox: 8, oy: 8 } : { buf: r, ox: 8, oy: 8, density: HI });
  }
  return out;
}
defineSprite('enemy/delivery-rider/food-cube', () => foodCube(1), { ticksPerFrame: 5, hi: () => foodCube(2) });
