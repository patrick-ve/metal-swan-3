/**
 * The pink boat's crew (`boss/ring-boot/…`; docs/design/ring.md §R.7): fictional, likeable comic
 * characters (the joke is the situation: a drum band and a megaphone on a boat on a motorway, never
 * their looks). ONE density-generic drawer per strip (the humanoid rig at 1× / 2× / 4×, held props as
 * pieces drawn on an `HdCanvas` at the same density), every frame cropped to its 1× box. Outline A.
 * The figures face RIGHT as drawn; the boat draws them mirrored (they face the heroes): no lettering
 * on them.
 *
 * | id | frames | what |
 * |---|---|---|
 * | `leader-<idle\|call\|duck>` | 2 / 2 / 1 | the leader on deck from the hip up (anchor: the hip): the megaphone held low; up at the mouth, the other arm pointing (the wave call); ducked behind the rail |
 * | `drum-a-<idle\|tell\|beat\|duck>` | 2 / 1 / 1 / 1 | the bass drummer (a felt mallet): sway; the mallet raised high (the tell); the beat |
 * | `drum-b-<idle\|tell\|beat\|lob\|throw\|duck>` | 2 / 1 / 1 / 1 / 1 / 1 | the snare drummer (a stick): sway; both arms up (the tell); the beat; a paint balloon lifted (the lob's tell); the throw |
 * | `kit-a` / `kit-b` | 2 | the bass drum (a painted sunflower on the head) / the snare on its stand: rest, hit (anchor: the boat's anchor) |
 * | `leider-<stand\|slide\|carried>` | 2 / 1 / 1 | the leader after the end (the NPC `ring-leider`; anchor: the feet / the middle under the body): talking with the megaphone low; sliding down the hull; carried off stiff as a plank, arms folded |
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { defStrip, Pen } from '../boss/art-kit';
import { finishA, mat, type Dn } from '../../stag/kit.art';
import { DRUM_A_HIP, DRUM_B_HIP } from './geometry';
import { BOAT_SPR } from './art-hull';

const S = (name: string): string => `${BOAT_SPR}/${name}`;

export const CREW_SPR = {
  leader: (pose: 'idle' | 'call' | 'duck') => S(`leader-${pose}`),
  drumA: (pose: 'idle' | 'tell' | 'beat' | 'duck') => S(`drum-a-${pose}`),
  drumB: (pose: 'idle' | 'tell' | 'beat' | 'lob' | 'throw' | 'duck') => S(`drum-b-${pose}`),
  kitA: S('kit-a'),
  kitB: S('kit-b'),
  leider: (pose: 'stand' | 'slide' | 'carried') => S(`leider-${pose}`),
} as const;

/** The leader: a bobble hat, round glasses, a big knitted sweater and a scarf. */
export const LEADER_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: 'hairB',
  hairStyle: 'curly',
  headgear: 'bobble',
  gear: 'gold',
  accent: 'orange',
  top: 'teal',
  topType: 'sweater',
  pants: 'olive',
  boots: 'brown',
  gloves: null,
  belt: 'brown',
  build: 'normal',
  accessories: ['scarf'],
  face: ['glasses', 'beard'],
};

/** The bass drummer: a pink bandana, a sunflower-yellow tee. */
export const DRUM_A_STYLE: HumanStyle = {
  skin: 'skinC',
  hair: 'hairA',
  hairStyle: 'puffs',
  headgear: 'bandana',
  gear: 'pink',
  top: 'gold',
  topType: 'tee',
  pants: 'navy',
  boots: 'black',
  gloves: null,
  build: 'stocky',
};

/** The snare drummer: a bucket hat, a sky-blue rain jacket, freckles. */
export const DRUM_B_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairC',
  hairStyle: 'long',
  headgear: 'rainhat',
  gear: 'olive',
  top: 'sky',
  topType: 'jacket',
  shirt: 'snow',
  pants: 'olive',
  boots: 'brown',
  gloves: null,
  build: 'lanky',
  face: ['freckles'],
};

// ---------------------------------------------------------------------------------------------
// Held props (pieces centred on the hand)
// ---------------------------------------------------------------------------------------------

const PC = 12;

/** A prop piece: drawn on a 24 × 24 canvas with the grip at its centre, along `deg` (0 = forward). */
function propPiece(kind: 'mallet' | 'stick' | 'megaphone' | 'balloon', deg: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(PC * 2, PC * 2, d);
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const wood = mat(c, 'sand', { spec: 0.5, shine: 30, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  if (kind === 'stick' || kind === 'mallet') {
    const len = kind === 'mallet' ? 10 : 10.5;
    c.capsule(PC - ux * 2, PC - uy * 2, PC + ux * len, PC + uy * len, 0.55, 0.45, { mat: wood, z: 2 });
    if (kind === 'mallet') c.ellipsoid(PC + ux * (len + 1), PC + uy * (len + 1), 2.2, 2.2, { mat: mat(c, 'snow', { spec: 0.1, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.3 }), z: 3 });
  } else if (kind === 'megaphone') {
    // A white megaphone with a pink band: the narrow mouthpiece at the hand, the flare forward.
    const horn = mat(c, 'snow', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
    const band = mat(c, 'pink', { spec: 0.8, shine: 40, lo1: 0, hi1: 2, lo: 2, hi: 5 });
    c.capsule(PC - ux * 1, PC - uy * 1, PC + ux * 9, PC + uy * 9, 1.2, 3.6, { mat: horn, z: 2, tex: (t) => (t.u > 0.45 && t.u < 0.58 ? void (t.mat = band) : undefined) });
    c.ellipsoid(PC + ux * 9.4, PC + uy * 9.4, 1.1, 3.4, { mat: mat(c, 'black', { spec: 0, lo1: 0, hi1: 1, lo: 0, hi: 2 }), z: 2.6, round: 0.2 });
    c.capsule(PC + ux * 2, PC + uy * 2 + 1.5, PC + ux * 3.4, PC + uy * 3.4 + 3, 0.6, 0.6, { mat: mat(c, 'black', { spec: 0.4, lo1: 0, hi1: 2, lo: 1, hi: 4 }), z: 1.6 });
  } else {
    // A paint balloon (pink rubber, sloshing): held at its knot.
    const rub = mat(c, 'pink', { spec: 1, shine: 50, lo1: 1, hi1: 2, lo: 2, hi: 6 });
    c.ellipsoid(PC + ux * 4, PC + uy * 4, 3.4, 3, { mat: rub, z: 2 });
    c.ellipsoid(PC, PC, 0.9, 0.9, { mat: rub, z: 2.2 });
  }
  return finishA(c, 0.1);
}

function at(f: Frame, buf: PixelBuffer, d: Dn, behind = false): Piece | null {
  const h = (f as Frame & { pts?: Record<string, readonly [number, number]> }).pts?.hand;
  if (!h) return null;
  const pc: Piece = { buf, x: Math.round(h[0]) - PC, y: Math.round(h[1]) - PC, behind };
  if (d !== 1) pc.density = d;
  return pc;
}

function fig(style: HumanStyle, pose: Pose, d: Dn, prop?: { kind: Parameters<typeof propPiece>[0]; deg: number; behind?: boolean }, part: 'upper' | 'full' = 'upper'): Frame {
  const f = renderHuman(style, { weapon: 'none', ...pose }, part, d as Density);
  if (!prop) return f;
  const pc = at(f, propPiece(prop.kind, prop.deg, d), d, prop.behind);
  return pc ? withPieces(f, [pc]) : f;
}

// ---------------------------------------------------------------------------------------------
// The leader on deck
// ---------------------------------------------------------------------------------------------

export function leaderIdle(d: Dn): Frame[] {
  return [0, 1].map((k) => fig(LEADER_STYLE, { lean: 2, hunch: k, armN: { sh: 18, el: 46, hand: 'grip' }, armF: { sh: -24, el: 96, hand: 'open' }, head: { dy: k }, expr: k ? 'smile' : 'normal' }, d, { kind: 'megaphone', deg: 62 }));
}

export function leaderCall(d: Dn): Frame[] {
  return [0, 1].map((k) =>
    fig(LEADER_STYLE, { lean: -4 - k * 2, armN: { to: [7, -9 - k], hand: 'grip' }, armF: { sh: 150 + k * 12, el: 6, hand: 'point' }, head: { tilt: -4 }, expr: 'shout' }, d, { kind: 'megaphone', deg: -14 - k * 4 }),
  );
}

export function leaderDuck(d: Dn): Frame[] {
  return [fig(LEADER_STYLE, { lean: 34, hunch: 2, dy: 9, armN: { sh: 150, el: 120, hand: 'open' }, armF: { sh: 140, el: 120, hand: 'open' }, expr: 'panic' }, d)];
}

// ---------------------------------------------------------------------------------------------
// The drum band
// ---------------------------------------------------------------------------------------------

export function drumA(pose: 'idle' | 'tell' | 'beat' | 'duck', d: Dn): Frame[] {
  const st = DRUM_A_STYLE;
  switch (pose) {
    case 'idle':
      return [0, 1].map((k) => fig(st, { lean: 4, hunch: k, armN: { sh: 34, el: 64, hand: 'grip' }, armF: { sh: 24, el: 66, hand: 'open' }, head: { dy: k, tilt: k ? 4 : -2 }, expr: 'happy' }, d, { kind: 'mallet', deg: 26 }));
    case 'tell':
      return [fig(st, { lean: -8, armN: { sh: 168, el: 26, hand: 'grip' }, armF: { sh: 30, el: 70, hand: 'open' }, head: { tilt: -6 }, expr: 'shout' }, d, { kind: 'mallet', deg: -104 })];
    case 'beat':
      return [fig(st, { lean: 12, armN: { sh: 58, el: 24, hand: 'grip' }, armF: { sh: 26, el: 70, hand: 'open' }, expr: 'shout' }, d, { kind: 'mallet', deg: 46 })];
    case 'duck':
      return [fig(st, { lean: 36, hunch: 2, dy: 8, armN: { sh: 150, el: 120, hand: 'open' }, armF: { sh: 140, el: 120, hand: 'open' }, expr: 'panic' }, d)];
  }
}

export function drumB(pose: 'idle' | 'tell' | 'beat' | 'lob' | 'throw' | 'duck', d: Dn): Frame[] {
  const st = DRUM_B_STYLE;
  switch (pose) {
    case 'idle':
      return [0, 1].map((k) => fig(st, { lean: 2, hunch: k, armN: { sh: 40, el: 70, hand: 'grip' }, armF: { sh: 36, el: 74, hand: 'grip' }, head: { dy: k }, expr: 'smile' }, d, { kind: 'stick', deg: 30 }));
    case 'tell':
      return [fig(st, { lean: -6, armN: { sh: 160, el: 30, hand: 'grip' }, armF: { sh: 150, el: 36, hand: 'grip' }, expr: 'shout' }, d, { kind: 'stick', deg: -96 })];
    case 'beat':
      return [fig(st, { lean: 10, armN: { sh: 56, el: 40, hand: 'grip' }, armF: { sh: 50, el: 44, hand: 'grip' }, expr: 'shout' }, d, { kind: 'stick', deg: 40 })];
    case 'lob':
      return [fig(st, { lean: -10, armN: { sh: 170, el: 70, hand: 'grip' }, armF: { sh: 50, el: 30, hand: 'open' }, expr: 'happy' }, d, { kind: 'balloon', deg: -70 })];
    case 'throw':
      return [fig(st, { lean: 16, armN: { sh: 84, el: 8, hand: 'open' }, armF: { sh: -20, el: 30, hand: 'open' }, expr: 'happy' }, d)];
    case 'duck':
      return [fig(st, { lean: 36, hunch: 2, dy: 8, armN: { sh: 150, el: 120, hand: 'open' }, armF: { sh: 140, el: 120, hand: 'open' }, expr: 'panic' }, d)];
  }
}

/** The bass drum (in front of drummer A; boat coordinates): a painted sunflower on the head. */
export function kitAFrame(hit: number, d: Dn): Frame {
  const [hx, hy] = DRUM_A_HIP;
  const cx = hx - 9;
  const cy = hy - 7;
  const p = new Pen(cx - 9, cy - 10, 18, 20, d);
  const c = p.c;
  const shell = mat(c, 'teal', { spec: 0.9, shine: 46, lo1: 0, hi1: 2, lo: 2, hi: 5 });
  const head = mat(c, 'cloth', { spec: 0.2, shine: 20, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.2 });
  const petal = mat(c, 'gold', { spec: 0.4, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const seed = mat(c, 'brown', { spec: 0.2, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const rim = mat(c, 'steel', { spec: 1, shine: 56, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const sh = hit ? 0.5 : 0;
  // The shell seen at an angle (a short cylinder), the head facing the viewer.
  p.ellipsoid(cx + 2, cy, 4, 7.5, { mat: shell, z: 1 });
  p.ellipsoid(cx - 0.5 + sh, cy, 6.2, 7.6, { mat: rim, z: 2, round: 0.3 });
  p.ellipsoid(cx - 0.5 + sh, cy, 5.4, 6.8, {
    mat: head,
    z: 2.4,
    round: 0.25,
    tex: (t) => {
      const x = t.x + p.x0 - (cx - 0.5 + sh);
      const y = t.y + p.y0 - cy;
      const r = Math.hypot(x / 0.8, y);
      const ang = Math.atan2(y, x / 0.8);
      if (r < 1.8) t.mat = seed;
      else if (r < 2.4 + 1.6 * Math.abs(Math.cos(ang * 4))) t.mat = petal;
      if (hit) t.tone += 0.15;
    },
  });
  return p.frame(finishA(c, 0.2));
}

/** The snare on its stand (in front of drummer B). */
export function kitBFrame(hit: number, d: Dn): Frame {
  const [hx, hy] = DRUM_B_HIP;
  const cx = hx - 8;
  const cy = hy - 2;
  const p = new Pen(cx - 7, cy - 5, 14, 12, d);
  const c = p.c;
  const shell = mat(c, 'orange', { spec: 0.9, shine: 46, lo1: 1, hi1: 2, lo: 2, hi: 5 });
  const head = mat(c, 'cloth', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const steel = mat(c, 'steel', { spec: 1, shine: 56, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const dy = hit ? 0.5 : 0;
  p.capsule(cx, cy + 6, cx, cy + 1, 0.5, 0.5, { mat: steel, z: 1 });
  p.box(cx - 5, cy - 2 + dy, 10, 3.6, { mat: shell, z: 2, r: 0.6, round: 0.5 });
  p.ellipsoid(cx, cy - 2.2 + dy, 5, 1.1, { mat: head, z: 2.6, round: 0.3 });
  return p.frame(finishA(c, 0.2));
}

// ---------------------------------------------------------------------------------------------
// The leader after the end (the NPC `ring-leider`)
// ---------------------------------------------------------------------------------------------

/** Re-anchor a frame at the middle under its 1× opaque box (the carried pose). */
function bottomAnchored(gen: (d: Dn) => Frame): (d: Dn) => Frame {
  return (d) => {
    const f1 = gen(1);
    const b = f1.buf.trimBounds() ?? { x: 0, y: 0, w: f1.buf.w, h: f1.buf.h };
    const ox = Math.round(b.x + b.w / 2);
    const oy = b.y + b.h;
    const f = d === 1 ? f1 : gen(d);
    return { ...f, ox, oy };
  };
}

export function leiderStand(d: Dn): Frame[] {
  return [0, 1].map((k) => fig(LEADER_STYLE, { armN: { sh: 18 + k * 8, el: 46, hand: 'grip' }, armF: { sh: 30 + k * 40, el: 40, hand: 'open' }, head: { tilt: k ? -4 : 2 }, expr: k ? 'shout' : 'smile' }, d, { kind: 'megaphone', deg: 62 }, 'full'));
}

export function leiderSlide(d: Dn): Frame[] {
  return [fig(LEADER_STYLE, { grounded: false, rot: -18, legN: { hip: 84, knee: 6 }, legF: { hip: 78, knee: 10 }, armN: { sh: 120, el: 20, hand: 'grip' }, armF: { sh: 130, el: 10, hand: 'open' }, expr: 'panic' }, d, { kind: 'megaphone', deg: -60 }, 'full')];
}

const carried = bottomAnchored((d) =>
  fig(LEADER_STYLE, { grounded: false, rot: -90, legN: { hip: 0, knee: 0 }, legF: { hip: 0, knee: 0 }, armN: { sh: 40, el: 110, hand: 'grip' }, armF: { sh: 30, el: 115, hand: 'open' }, expr: 'smile' }, d, { kind: 'megaphone', deg: -40 }, 'full'),
);

export function leiderCarried(d: Dn): Frame[] {
  return [carried(d)];
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

defStrip(CREW_SPR.leader('idle'), leaderIdle, { ticksPerFrame: 30 });
defStrip(CREW_SPR.leader('call'), leaderCall, { ticksPerFrame: 10 });
defStrip(CREW_SPR.leader('duck'), leaderDuck);
for (const pose of ['idle', 'tell', 'beat', 'duck'] as const) defStrip(CREW_SPR.drumA(pose), (d) => drumA(pose, d), { ticksPerFrame: pose === 'idle' ? 24 : 8 });
for (const pose of ['idle', 'tell', 'beat', 'lob', 'throw', 'duck'] as const) defStrip(CREW_SPR.drumB(pose), (d) => drumB(pose, d), { ticksPerFrame: pose === 'idle' ? 22 : 8 });
defStrip(CREW_SPR.kitA, (d) => [kitAFrame(0, d), kitAFrame(1, d)]);
defStrip(CREW_SPR.kitB, (d) => [kitBFrame(0, d), kitBFrame(1, d)]);
defStrip(CREW_SPR.leider('stand'), leiderStand, { ticksPerFrame: 18, defer: true });
defStrip(CREW_SPR.leider('slide'), leiderSlide, { defer: true });
defStrip(CREW_SPR.leider('carried'), leiderCarried, { defer: true });
