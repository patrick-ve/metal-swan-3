/**
 * The adds of the ring's test boss (docs/design/ring.md §6): the cargo (`barrel`, `crate`), the
 * loader in the container's doorway and the forklift with its driver. ONE density-generic drawer
 * per strip (PAL at 1×, PAL_HD at 2× / 4×), outline A, the people from the humanoid rig at the same
 * density (`renderHuman(…, d)`), bloodless. Nothing carries lettering, so the forklift may flip.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { finishA, mat, type Dn } from '../../stag/kit.art';
import { frac, frameOf, Pen, turnPt, type Turn } from './art-kit';
import { CARGO, FORK, type Pt } from './geometry';

// ---------------------------------------------------------------------------------------------
// Cargo
// ---------------------------------------------------------------------------------------------

/** The drum box (logical px) and its middle. */
const DRUM_BOX = 16;
const DRUM_C = 8;

/**
 * A steel drum lying on its side, seen end on (it rolls along the lane): the silver chime ring, the
 * blue lid with its two bungs and a white stencil band across it, turned `a` radians.
 */
export function drumBuf(a: number, d: Dn): PixelBuffer {
  const p = new Pen(-DRUM_C, -DRUM_C, DRUM_BOX, DRUM_BOX, d);
  const c = p.c;
  const R = CARGO.barrelR;
  const chime = mat(c, 'steel', { spec: 1.1, shine: 44, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.4 });
  const lid = mat(c, 'sky', { spec: 0.8, shine: 36, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const band = mat(c, 'snow', { spec: 0.3, lo1: 2, hi1: 3, lo: 3, hi: 5 });
  const bung = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  p.ellipsoid(0, 0, R, R, { mat: chime, z: 1, round: 0.5 });
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  p.ellipsoid(0, 0, R - 1.2, R - 1.2, {
    mat: lid,
    z: 4.2,
    round: 0.15,
    tex: (t) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      // An embossed ring on the lid and a white stencil mark beside the big bung (it turns with it).
      const r = Math.hypot(x, y);
      if (Math.abs(r - 3.9) < (d === 1 ? 0.45 : 0.3)) t.tone -= 0.45;
      if (Math.hypot(x + sa * 2.4 - ca * 1.2, y - ca * 2.4 - sa * 1.2) < (d === 1 ? 0.8 : 0.9)) t.mat = band;
    },
  });
  p.ellipsoid(ca * 3.3, sa * 3.3, 1.15, 1.15, { mat: bung, z: 6, round: 0.7 });
  p.ellipsoid(-ca * 3.4, -sa * 3.4, 0.75, 0.75, { mat: bung, z: 6, round: 0.7 });
  return finishA(c, 0.2);
}

/** The barrel rolling (8 frames, centre anchor), turning back (counter-clockwise) 45° a frame. */
export function barrelFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((f) => frameOf(drumBuf((-f * Math.PI) / 4, d), DRUM_C, DRUM_C, d));
}

/** A wooden crate (12 × 12) tumbling: turned 0 / 22.5 / 45 / 67.5° (centre anchor). */
export function crateFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const p = new Pen(-10, -10, 20, 20, d);
    const c = p.c;
    const wood = mat(c, 'wood', { spec: 0.25, shine: 14, lo1: 0, hi1: 3, lo: 2, hi: 6 });
    const frame = mat(c, 'wood', { spec: 0.3, shine: 16, lo1: 0, hi1: 2, lo: 1, hi: 4 });
    const t: Turn = { rot: -f * 22.5, px: 0, py: 0 };
    const inv: Turn = { rot: f * 22.5, px: 0, py: 0 };
    const h = CARGO.crate.w / 2;
    const quad: Pt[] = [turnPt(t, -h, -h), turnPt(t, h, -h), turnPt(t, h, h), turnPt(t, -h, h)];
    p.body(quad, 1, { mat: wood, z: 1 }, (x, y) => {
      const [u, v] = turnPt(inv, x, y);
      // The frame boards stand proud of the planks; a diagonal brace.
      const edge = Math.max(Math.abs(u), Math.abs(v)) > h - 2.2;
      const brace = Math.abs(u - v) < 1.3;
      return edge || brace ? 0.6 : 0;
    }, undefined, (s, x, y) => {
      const [u, v] = turnPt(inv, x, y);
      const edge = Math.max(Math.abs(u), Math.abs(v)) > h - 2.2;
      if (edge || Math.abs(u - v) < 1.3) s.mat = frame;
      else if (frac((v + h) / 3) < 0.14) s.tone -= 0.5;
      if (d > 1 && edge && Math.abs(Math.abs(u) - (h - 1.1)) < 0.35 && Math.abs(Math.abs(v) - (h - 1.1)) < 0.35) s.tone += 0.9;
    });
    return p.frame(finishA(c, 0.2));
  });
}

// ---------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------

/** The dock worker in the container's doorway: white hard hat, orange hi-vis vest, work gloves. */
export const LOADER: HumanStyle = {
  skin: 'skinB',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'helmet',
  gear: 'snow',
  top: 'orange',
  topType: 'vest',
  shirt: 'navy',
  pants: 'navy',
  boots: 'black',
  gloves: 'gold',
  belt: 'black',
  build: 'heavy',
};

/** The forklift driver: yellow hard hat, yellow hi-vis vest, a moustache. */
export const DRIVER: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'helmet',
  gear: 'gold',
  top: 'gold',
  topType: 'vest',
  shirt: 'steel',
  pants: 'stone',
  boots: 'black',
  belt: 'black',
  build: 'normal',
  face: ['moustache'],
};

/** A drum held at the frame's hands (the middle between the two hands, else the near hand). */
function drumAtHands(f: Frame, a: number, d: Dn, dy = 0): Piece | null {
  const h = f.pts?.hand;
  if (!h) return null;
  const p: Piece = { buf: drumBuf(a, d), x: Math.round(h[0] + 3) - DRUM_C, y: Math.round(h[1] + dy) - DRUM_C };
  if (d !== 1) p.density = d;
  return p;
}

const fig = (style: HumanStyle, pose: Pose, d: Dn): Frame => renderHuman(style, { weapon: 'none', ...pose }, 'full', d as Density);

/** The loader standing in the doorway, a hand on the door edge, breathing. */
export function loaderStand(d: Dn): Frame[] {
  return [0, 1].map((k) => fig(LOADER, { lean: 2, hunch: k, armN: { to: [5, -6 - k], hand: 'grip' }, armF: { sh: 10, el: 20, hand: 'open' }, head: { dy: k } }, d));
}

/** The tell: he crouches for a drum, hoists it to his chest, then over his head. */
export function loaderLift(d: Dn): Frame[] {
  const keys: Array<[Pose, number]> = [
    [{ crouch: 0.7, lean: 30, armN: { to: [7, 10], hand: 'grip' }, armF: { to: [6, 10], hand: 'grip' }, expr: 'normal' }, 2],
    [{ crouch: 0.2, lean: 8, armN: { to: [6, 2], hand: 'grip' }, armF: { to: [5, 2], hand: 'grip' }, expr: 'shout' }, 2],
    [{ lean: -10, armN: { to: [2, -12], hand: 'grip' }, armF: { to: [1, -12], hand: 'grip' }, head: { tilt: -6 }, expr: 'shout' }, -6],
  ];
  return keys.map(([pose, dy]) => {
    const f = fig(LOADER, pose, d);
    const pc = drumAtHands(f, 0, d, dy);
    return pc ? withPieces(f, [pc]) : f;
  });
}

/** The throw: the drum is gone, arms swung forward and down, then the follow-through. */
export function loaderThrow(d: Dn): Frame[] {
  return [
    fig(LOADER, { lean: 22, armN: { sh: 110, el: 10, hand: 'open' }, armF: { sh: 100, el: 10, hand: 'open' }, expr: 'shout' }, d),
    fig(LOADER, { lean: 14, armN: { sh: 60, el: 20, hand: 'open' }, armF: { sh: 50, el: 20, hand: 'open' }, expr: 'normal' }, d),
  ];
}

/** Knocked off (the doors broke): a tuck roll (4) … */
export function tumbleFrames(style: HumanStyle, d: Dn): Frame[] {
  return [0, 90, 180, 270].map((rot) =>
    renderHuman(style, { weapon: 'none', grounded: false, crouch: 1, lean: 30, armN: { sh: 40, el: 120, hand: 'fist' }, armF: { sh: 30, el: 120, hand: 'fist' }, rot, expr: 'hurt', dy: -6 }, 'full', d as Density),
  );
}

/** … and sitting dazed on the hard shoulder (2, a blink). */
export function sitFrames(style: HumanStyle, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    renderHuman(style, { legN: { hip: 88, knee: 6, foot: 20 }, legF: { hip: 80, knee: 14, foot: 20 }, lean: -14, armN: { sh: -30, el: 10, hand: 'open' }, armF: { sh: -40, el: 10, hand: 'open' }, head: { tilt: k ? 8 : -4 }, expr: k ? 'blink' : 'dazed', dy: 8 }, 'full', d as Density),
  );
}

// ---------------------------------------------------------------------------------------------
// The forklift
// ---------------------------------------------------------------------------------------------

const F_BOX = { x0: -26, y0: -44, w: 62, h: 46 } as const;

interface ForkOpts {
  /** Fork height over the road (px; 0 = on the road). */
  fh: number;
  /** Wheel turn 0 … 1. */
  phase: number;
  /** A turn of the whole machine (the tip-over), about the front wheel's contact. */
  turn?: Turn | null;
  /** The driver's pose (null: the seat is empty). */
  driver?: Pose | null;
  /** The body bobs up by this much (px). */
  bob?: number;
}

/** The machine itself at density d (no driver). */
function forkBuf(o: ForkOpts, d: Dn): PixelBuffer {
  const p = new Pen(F_BOX.x0, F_BOX.y0, F_BOX.w, F_BOX.h, d);
  const c = p.c;
  const T = (x: number, y: number): Pt => turnPt(o.turn ?? null, x, y - (o.bob ?? 0));
  const Tw = (x: number, y: number): Pt => turnPt(o.turn ?? null, x, y);
  const map = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => T(x, y));
  const paint = mat(c, 'gold', { spec: 0.9, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.3 });
  const black = mat(c, 'black', { spec: 0.7, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const steel = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const chrome = mat(c, 'steel', { spec: 1.3, shine: 60, lo1: 2, hi1: 4, lo: 3, hi: 7 });
  const tyre = mat(c, 'black', { spec: 0.3, shine: 12, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const seat = mat(c, 'black', { spec: 0.8, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const lamp = mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const ink = mat(c, 'black', { spec: 0.2, lo1: 0, hi1: 1, lo: 0, hi: 2 });
  // Wheels: a black tyre with a steel hub, the hub's holes turning.
  const wheel = (cx: number, cy: number, r: number, z: number): void => {
    const [x, y] = Tw(cx, cy);
    p.ellipsoid(x, y, r, r, { mat: tyre, z, round: 0.7 });
    p.ellipsoid(x, y, r * 0.5, r * 0.5, {
      mat: steel,
      z: z + 0.3,
      round: 0.4,
      tex: (t) => {
        const a = Math.atan2(t.y + p.y0 - y, t.x + p.x0 - x) / (Math.PI * 2) - o.phase / 4;
        if (frac(a * 4) < 0.3 && Math.hypot(t.y + p.y0 - y, t.x + p.x0 - x) > r * 0.22) t.tone -= 0.7;
      },
    });
  };
  // The mast, its cylinder, the carriage and the near fork.
  const fh = o.fh;
  p.stroke([T(13.4, -32), T(13.4, -3.5)], 1.4, 1.4, { mat: steel, z: 1.2 });
  p.stroke([T(11.6, -28), T(11.6, -6)], 0.55, 0.55, { mat: chrome, z: 1.4 });
  p.stroke([T(15.6, -fh - 8.5), T(15.6, -fh - 1)], 1.1, 1.1, { mat: black, z: 1.6 });
  p.stroke([T(17, -fh - 7.5), T(17, -fh - 0.8), T(31, -fh - 0.6)], 0.75, 0.6, { mat: steel, z: 1.8 });
  // The counterweight (with a black-and-yellow band at the back) and the body.
  const cw: Pt[] = [[-21.5, -4.5], [-21.8, -13.5], [-19.6, -18.2], [-9, -18.6], [-8, -4.5]];
  p.body(map(cw), 2, { mat: paint, z: 1, part: c.newPart() }, undefined, (x, y) => {
    const [u, v] = turnPt(o.turn ? { ...o.turn, rot: -o.turn.rot } : null, x, y);
    return Math.hypot(u + 11, v + 3.5) < 4.4;
  }, (t, x, y) => {
    const [u, v] = turnPt(o.turn ? { ...o.turn, rot: -o.turn.rot } : null, x, y);
    if (u < -19.6 && v > -12 && frac((u + v * 0.9) / 2.6) < 0.5) t.mat = ink;
  });
  const bodyPoly: Pt[] = [[-9, -4.5], [-9, -13.5], [8.4, -14], [10.8, -10], [11, -4.5]];
  p.body(map(bodyPoly), 1.4, { mat: paint, z: 1.1, part: c.newPart() }, undefined, (x, y) => {
    const [u, v] = turnPt(o.turn ? { ...o.turn, rot: -o.turn.rot } : null, x, y);
    return Math.hypot(u - FORK.front[0], v - FORK.front[1]) < FORK.frontR + 0.9;
  });
  // The seat and the steering column with its wheel.
  p.blob(map([[-10, -14], [-2, -14], [-2, -16.2], [-8, -16.6], [-9.4, -21.6], [-10.8, -21]]), 0.9, { mat: seat, z: 2.2 });
  p.stroke([T(5, -14), T(2.2, -21)], 0.6, 0.6, { mat: black, z: 2 });
  {
    const [sx, sy] = T(2, -21.4);
    p.ellipsoid(sx, sy, 2.4, 0.9, { mat: black, z: 3.4 });
  }
  // The overhead guard: two posts, the roof frame with slats, a work lamp on the front post.
  p.stroke([T(-11.6, -17), T(-10.8, -35)], 0.7, 0.7, { mat: black, z: 2.6 });
  p.stroke([T(8, -14), T(5.4, -35)], 0.7, 0.7, { mat: black, z: 3.6 });
  p.stroke([T(-12.4, -35.2), T(6.4, -35.2)], 0.85, 0.85, { mat: black, z: 3.5 });
  {
    const [lx, ly] = T(6.6, -29);
    p.ellipsoid(lx, ly, 1.1, 1, { mat: lamp, z: 3.8 });
    const [bx, by] = T(-4, -36.2);
    p.ellipsoid(bx, by, 1.5, 0.8, { mat: black, z: 3.6 });
  }
  wheel(FORK.front[0], FORK.front[1], FORK.frontR, 2.4);
  wheel(FORK.rearW[0], FORK.rearW[1], FORK.rearR, 2.4);
  return finishA(c, 0.3);
}

/** A forklift frame (anchor: the road under its middle), with its driver hip-on-seat. */
function forkFrame(o: ForkOpts, d: Dn, held?: (f: Frame) => Frame): Frame {
  const base = frameOf(forkBuf(o, d), -F_BOX.x0, -F_BOX.y0, d);
  if (!o.driver) return base;
  let f: Frame = renderHuman(DRIVER, { weapon: 'none', grounded: false, legN: { hip: 66, knee: 72 }, legF: { hip: 56, knee: 82 }, ...o.driver }, 'full', d as Density);
  if (held) f = held(f);
  const fh = f.pts?.hip ?? [0, -15];
  const [hx, hy] = turnPt(o.turn ?? null, FORK.hip[0], FORK.hip[1] - (o.bob ?? 0));
  const piece: Piece = { buf: f.buf, x: Math.round(hx - fh[0] - f.ox), y: Math.round(hy - fh[1] - f.oy) };
  if (d !== 1) piece.density = d;
  const out = withPieces(base, [piece]);
  return fit(out, d);
}

/** Back to the fixed canvas (the same logical rectangle at every density). */
function fit(f: Frame, d: Dn): Frame {
  const left = (-F_BOX.x0 - f.ox) * d;
  const topY = (-F_BOX.y0 - f.oy) * d;
  const buf = f.buf.crop(-left, -topY, F_BOX.w * d, F_BOX.h * d);
  return frameOf(buf, -F_BOX.x0, -F_BOX.y0, d);
}

/** Hands on the steering wheel (relative to the shoulder), a small bob. */
const steer = (k: number, x: Pose = {}): Pose => ({ lean: 10 + (k % 2), hunch: k % 2, armN: { to: [7.4, 5.6], hand: 'grip' }, armF: { to: [6.8, 5.2], hand: 'grip' }, head: { dy: k % 2 }, ...x });

export function forkDrive(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((k) => forkFrame({ fh: 2, phase: k / 4, bob: k % 2 === 1 ? 0.5 : 0, driver: steer(k) }, d));
}

/** The tell: the forks rise, the driver hunches over the wheel (the beacon flashes: its own strip). */
export function forkTell(d: Dn): Frame[] {
  return [4, 7, 9].map((fh, k) => forkFrame({ fh, phase: 0, driver: steer(0, { lean: 16 + k * 3, hunch: 1, expr: k ? 'shout' : 'normal' }) }, d));
}

export function forkCharge(d: Dn): Frame[] {
  return [0, 1].map((k) => forkFrame({ fh: 9, phase: k / 2, bob: k * 0.5, driver: steer(k, { lean: 24, hunch: 2, expr: 'shout' }) }, d));
}

/** The gloat: forks down, he leans back and eats a frikandel (a snack break; no pointing, no laughing). */
export function forkGloat(d: Dn): Frame[] {
  const poses: Pose[] = [
    { lean: -6, armN: { to: [4, -7], hand: 'grip' }, armF: { to: [6.8, 5.2], hand: 'grip' }, held: 'frikandel', heldAngle: -60, expr: 'normal' },
    { lean: -6, armN: { to: [3, -8.6], hand: 'grip' }, armF: { to: [6.8, 5.2], hand: 'grip' }, held: 'frikandel', heldAngle: -50, expr: 'chew' },
    { lean: -8, armN: { to: [4, -7], hand: 'grip' }, armF: { to: [6.8, 5.2], hand: 'grip' }, held: 'frikandel', heldAngle: -60, expr: 'chew', head: { tilt: -4 } },
    { lean: -6, armN: { to: [5, -4], hand: 'grip' }, armF: { to: [6.8, 5.2], hand: 'grip' }, held: 'frikandel', heldAngle: -70, expr: 'happy' },
  ];
  return poses.map((pose) => forkFrame({ fh: 0, phase: 0, driver: pose }, d));
}

/** The cower: the driver ducks low behind the wheel, hands on his hard hat. */
export function forkCower(d: Dn): Frame[] {
  return [0, 1].map((k) => forkFrame({ fh: 2, phase: 0, driver: { lean: 34, hunch: 2, armN: { to: [2, -9 + k], hand: 'open' }, armF: { to: [3, -9 + k], hand: 'open' }, head: { dy: 2, tilt: 12 }, expr: 'panic' } }, d));
}

/** Knocked out: the empty machine tipping forward onto its forks (0°, 22°, 44°). */
export function forkDown(d: Dn): Frame[] {
  return [0, 22, 44].map((rot) => forkFrame({ fh: 2, phase: 0, turn: { rot, px: FORK.front[0] + FORK.frontR, py: 0 }, driver: null }, d));
}

/** The amber beacon (centre anchor): 0 dark, 1 lit with a glow. */
export function beaconFrames(d: Dn): Frame[] {
  return [0, 1].map((f) => {
    const p = new Pen(-4, -4, 8, 8, d);
    const c = p.c;
    if (f === 0) {
      p.ellipsoid(0, 0.6, 1.4, 1.3, { mat: mat(c, 'orange', { spec: 0.7, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 3 }), z: 1 });
      return p.frame(finishA(c, 0));
    }
    p.ellipsoid(0, 0.4, 3.6, 3.2, { mat: mat(c, 'orange', { flat: true, lo1: 1, hi1: 3, lo: 3, hi: 5 }), z: 0.5 });
    p.ellipsoid(0, 0.6, 1.5, 1.4, { mat: mat(c, 'gold', { flat: true, lo1: 2, hi1: 3, lo: 5, hi: 7 }), z: 1, tone: 0.6 });
    return p.frame(c.render({ outline: 'none' }));
  });
}
