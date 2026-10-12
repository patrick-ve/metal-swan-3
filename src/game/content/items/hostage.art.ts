/**
 * Hostage sprites (`item/hostage/<kind>/<anim>`; docs/ARCHITECTURE.md §6.1, GDD §2.3, §7.2).
 * Every kind is a fully dressed humanoid-rig style with its own props:
 *
 * - `critic`   tweed suit, grey parted hair, round glasses, red bow tie, a notepad and a star card;
 * - `roadie`   heavy build, black tank top and cap, beard, cargo trousers, a black flight case;
 * - `tea-lady` white curly hair in pink curlers, pink dress, a white floral apron, a teapot;
 * - `tourist`  orange palm-print shirt, sun hat, shades, a camera bag and a flash camera;
 * - `composer` wild white hair, black tail coat, white bow tie, a conductor's baton (the 1UP);
 * - `dollop`   Mrs. Dollop: pink uniform, white paper hat, blond bob, a mint-striped apron.
 *
 * Strips per kind: `tied` (chair: rest, blink, struggle), `caged`, `mast` (same three frames),
 * `sack` (4-frame hop), `dangle` (2), `chute` (2, parachute), `freed` (4), `walk` (8), `gag` (4,
 * the kind's own beat), `give` (4, `hand`), `bow` (2, a curtain-call bow — never a salute),
 * `run` (8); the roadie adds `carry` (8, walking with his case). `item/hostage/<anim>` (no kind)
 * are the critic's strips. Small effects: `item/hostage/star`, `flash`, `note`, `steam`,
 * `case-open`. All feet-anchored unless noted.
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../engine/sprites';
import { withPieces, type Piece } from '../../art/human-fx';
import { withSwing } from '../../art/human-sprites';
import { renderHuman, stackFrames, type ArmPose, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { cageBack, cageFront, canopyPiece, chairPiece, sackPiece } from './binds.art';
import { DANGLE_HANDS, HOSTAGE_KINDS, type HostageKindId } from './ids';

type V2 = readonly [number, number];
type Pts = Record<string, readonly [number, number]>;

// ------------------------------------------------------------------------------------ styles

/** Rig styles (GDD §7.2 table; `ink` boots and tops use the `black` ramp so they stay lighter than the outline). */
export const HOSTAGE_STYLES: Readonly<Record<HostageKindId, HumanStyle>> = {
  critic: {
    skin: 'skinC',
    hair: 'stone',
    hairStyle: 'parted',
    headgear: 'none',
    accent: 'red',
    top: 'brown',
    topType: 'jacket',
    shirt: 'cloth',
    pants: 'brown',
    boots: 'black',
    belt: 'black',
    gloves: null,
    build: 'normal',
    accessories: ['bowtie'],
    face: ['glasses'],
  },
  roadie: {
    skin: 'skinB',
    hair: 'hairB',
    hairStyle: 'short',
    headgear: 'cap',
    gear: 'black',
    accent: 'gold',
    top: 'black',
    topType: 'tank',
    pants: 'steel',
    boots: 'black',
    belt: 'brown',
    gloves: null,
    build: 'heavy',
    face: ['beard'],
  },
  'tea-lady': {
    skin: 'skinA',
    hair: 'snow',
    hairStyle: 'curly',
    headgear: 'none',
    accent: 'pink',
    top: 'pink',
    topType: 'tunic',
    pants: 'pink',
    boots: 'brown',
    belt: 'pink',
    gloves: null,
    build: 'normal',
    face: ['blush'],
  },
  tourist: {
    skin: 'skinA',
    hair: 'hairC',
    hairStyle: 'short',
    headgear: 'rainhat',
    gear: 'sand',
    accent: 'teal',
    top: 'orange',
    topType: 'shirt',
    pants: 'sand',
    boots: 'brown',
    belt: 'brown',
    gloves: null,
    build: 'normal',
    accessories: ['satchel'],
    face: ['shades', 'blush'],
  },
  composer: {
    skin: 'skinA',
    hair: 'snow',
    hairStyle: 'spiky',
    headgear: 'none',
    accent: 'cloth',
    top: 'black',
    topType: 'coat',
    shirt: 'cloth',
    pants: 'black',
    boots: 'black',
    belt: 'black',
    gloves: null,
    build: 'slim',
    accessories: ['bowtie'],
  },
  dollop: {
    skin: 'skinB',
    hair: 'hairC',
    hairStyle: 'bob',
    headgear: 'cap',
    gear: 'cloth',
    accent: 'teal',
    top: 'pink',
    topType: 'tunic',
    pants: 'pink',
    boots: 'cloth',
    belt: 'pink',
    gloves: null,
    build: 'normal',
    face: ['blush'],
  },
};

// ------------------------------------------------------------------------------------ props

/** A buffer from rows (+ outline): the props are tiny hand-made drawings. */
function art(rows: readonly string[], key: Readonly<Record<string, Color>>): PixelBuffer {
  return ascii(rows, key).padded(1).outline(INK);
}

const W = PAL.snow;
const PROPS = {
  /** The critic's notepad (spiral on top). */
  notepad: (): PixelBuffer => art(['sss', 'www', 'wnw', 'www', 'wnw'], { s: PAL.steel[3], w: W[2], n: PAL.navy[1] }),
  /** The star card (stars drawn at run time on its `card` point). */
  card: (): PixelBuffer => {
    const b = new PixelBuffer(15, 11);
    b.rect(0, 0, 15, 11, W[3]);
    b.strokeRect(1, 1, 13, 9, W[1]);
    b.hline(0, 14, 10, W[0]);
    b.vline(14, 0, 10, W[0]);
    return b.padded(1).outline(INK);
  },
  /** The roadie's black flight case (steel corners, a handle). */
  ampCase: (): PixelBuffer => {
    const b = new PixelBuffer(14, 10);
    b.rect(0, 2, 14, 8, PAL.black[2]);
    b.hline(0, 13, 2, PAL.black[3]);
    b.hline(0, 13, 9, PAL.black[1]);
    b.hline(0, 13, 5, PAL.black[1]);
    for (const [x, y] of [[0, 2], [12, 2], [0, 8], [12, 8]] as const) {
      b.rect(x, y, 2, 2, PAL.steel[3]);
      b.set(x, y, PAL.steel[4]);
    }
    b.rect(5, 0, 4, 2, PAL.steel[2]);
    b.rect(6, 1, 2, 1, 0);
    b.hline(4, 9, 6, PAL.gold[1]);
    return b.padded(1).outline(INK);
  },
  /** The open, empty case left behind (lid up behind it). */
  caseOpen: (): PixelBuffer => {
    const b = new PixelBuffer(16, 14);
    b.rect(1, 0, 13, 6, PAL.black[2]);
    b.hline(1, 13, 0, PAL.black[3]);
    b.rect(2, 1, 11, 4, PAL.red[1]);
    b.rect(0, 7, 15, 7, PAL.black[2]);
    b.hline(0, 14, 7, PAL.black[3]);
    b.rect(2, 7, 11, 2, PAL.red[1]);
    for (const [x, y] of [[0, 12], [13, 12]] as const) b.rect(x, y, 2, 2, PAL.steel[3]);
    return b.padded(1).outline(INK);
  },
  /** White teapot with a navy band (spout right). */
  teapot: (): PixelBuffer =>
    art(
      ['..bb....', '.wWWw...', 'wWWWWw.w', 'hnnnnnww', 'hwwwwwws', '.wwwwws.'],
      { b: PAL.navy[1], w: W[2], W: W[3], n: PAL.navy[1], h: W[1], s: W[1] },
    ),
  /** Teacup on a saucer. */
  cup: (): PixelBuffer => art(['wWw.', 'wwwh', 'sss.'], { w: W[2], W: W[3], h: W[1], s: PAL.navy[1] }),
  /** The tourist's flash camera (lens forward, flash cube on top). */
  camera: (): PixelBuffer => art(['.ff....', 'kkkkkk.', 'kKKKllk', 'kkkkllk', '.kkkkk.'], { f: W[3], k: PAL.black[1], K: PAL.black[3], l: PAL.sky[2] }),
};

/** Props are built once per generation pass. */
const propCache = new Map<string, PixelBuffer>();
function prop(name: keyof typeof PROPS): PixelBuffer {
  let b = propCache.get(name);
  if (!b) {
    b = PROPS[name]();
    propCache.set(name, b);
  }
  return b;
}

/** A conductor's baton (ivory stick, cork grip) from the hand at `angle` degrees (0 = forward). */
function baton(angle: number): { buf: PixelBuffer; grip: V2; tip: V2 } {
  const b = new PixelBuffer(17, 17);
  const a = (angle * Math.PI) / 180;
  const c = 8;
  const tx = Math.round(c + Math.cos(a) * 7);
  const ty = Math.round(c + Math.sin(a) * 7);
  b.line(c, c, tx, ty, W[3]);
  b.set(c, c, PAL.sand[1]);
  return { buf: b.outline(INK), grip: [c, c], tip: [tx, ty] };
}

/** A tilted copy of the teapot (pouring), rotated about its centre. */
function teapotTilted(deg: number): PixelBuffer {
  return prop('teapot').rotated((deg * Math.PI) / 180, { quality: 'fast' });
}

// ------------------------------------------------------------------------------------ figure

/** Where the rig puts both wrists (only the near one is a frame point), for two-handed props. */
function farHand(f: Frame, pose: Pose): V2 {
  const hand = f.pts?.hand ?? [0, -20];
  const n = reach(pose.armN);
  const r = reach(pose.armF);
  // The far shoulder sits 2 px in front of the near one (3/4 view).
  return [Math.round(hand[0] - n[0] + 2 + r[0]), Math.round(hand[1] - n[1] + r[1])];
}

/** Wrist offset from its shoulder for an arm pose (IK reach ≤ 12 px; FK with 6 + 6 px bones). */
function reach(a: ArmPose | undefined): V2 {
  if (!a) return [0, 10];
  if (a.to) {
    const d = Math.hypot(a.to[0], a.to[1]);
    const k = d > 11.9 ? 11.9 / d : 1;
    return [a.to[0] * k, a.to[1] * k];
  }
  const D = Math.PI / 180;
  const sh = (a.sh ?? 5) * D;
  const fe = ((a.sh ?? 5) + (a.el ?? 20)) * D;
  return [Math.sin(sh) * 6 + Math.sin(fe) * 6, Math.cos(sh) * 6 + Math.cos(fe) * 6];
}

/** An apron hanging from the belt (tea lady: white with pink flowers; Mrs. Dollop: mint stripes). */
function apron(kind: HostageKindId): PixelBuffer {
  const b = new PixelBuffer(7, 10);
  b.rect(0, 0, 7, 10, PAL.cloth[2]);
  b.hline(0, 6, 0, PAL.cloth[3]);
  b.vline(6, 1, 9, PAL.cloth[1]);
  b.hline(0, 6, 9, kind === 'dollop' ? PAL.teal[2] : PAL.pink[2]);
  if (kind === 'dollop') {
    for (const x of [1, 4]) b.vline(x, 1, 8, PAL.teal[2]);
  } else {
    // Two small flowers.
    for (const [x, y] of [[1, 2], [4, 5]] as const) {
      b.set(x, y, PAL.pink[2]);
      b.set(x + 1, y, PAL.pink[1]);
      b.set(x, y + 1, PAL.gold[2]);
    }
  }
  return b.padded(1).outline(INK);
}

/** Pink curlers in the tea lady's white hair (only where there is hair). */
function curlers(f: Frame): Frame {
  const head = f.pts?.head;
  if (!head) return f;
  const b = f.buf.clone();
  const hair = new Set<number>([PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]]);
  for (const [dx, dy] of [[-5, -4], [-1, -6], [-6, 0]] as const) {
    const x = f.ox + head[0] + dx;
    const y = f.oy + head[1] + dy;
    if (!hair.has(b.get(x, y)) || !hair.has(b.get(x + 1, y + 1))) continue;
    b.set(x, y, PAL.pink[2]);
    b.set(x + 1, y, PAL.pink[2]);
    b.set(x, y + 1, PAL.pink[1]);
    b.set(x + 1, y + 1, PAL.pink[1]);
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Green palm leaves printed on the tourist's orange shirt (2-px clusters on a loose lattice). */
function palmPrint(f: Frame): Frame {
  const b = f.buf.clone();
  const shirt = new Set<number>([PAL.orange[1], PAL.orange[2]]);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w - 1; x++) {
      const wx = x - f.ox;
      const wy = y - f.oy;
      if ((((wx + 64) * 3 + (wy + 64) * 5) % 11 + 11) % 11 !== 0) continue;
      if (!shirt.has(b.get(x, y)) || !shirt.has(b.get(x + 1, y))) continue;
      b.set(x, y, PAL.green[3]);
      b.set(x + 1, y, PAL.green[2]);
    }
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

const APRONS: Readonly<Partial<Record<HostageKindId, true>>> = { 'tea-lady': true, dollop: true };

/** The kind's figure in a pose: the rig, plus its apron, curlers or shirt print. */
function figure(kind: HostageKindId, pose: Pose): Frame {
  const style = HOSTAGE_STYLES[kind];
  let f: Frame;
  if (APRONS[kind] && !pose.rot) {
    // The apron hangs between the legs and the arms: legs → apron → torso and arms.
    const lower = renderHuman(style, pose, 'lower');
    const upper = renderHuman(style, pose, 'upper');
    const hip = lower.pts.hip ?? [0, -15];
    const lean = pose.crouch || (pose.legN && pose.legN.hip > 70) ? 1 : 0;
    const legs = withPieces(lower, [{ buf: apron(kind), x: hip[0] - 3 + lean, y: hip[1] - 1 }]);
    f = stackFrames(legs, upper);
  } else f = renderHuman(style, pose, 'full');
  if (kind === 'tourist') f = palmPrint(f);
  if (kind === 'tea-lady') f = curlers(f);
  return f;
}

/** Add pieces (props) to a frame; extra points ride along. */
function dress(f: Frame, pieces: readonly Piece[], pts?: Pts): Frame {
  return pieces.length || pts ? withPieces(f, pieces, pts) : f;
}

/** A piece placed so that its pixel (px, py) lands on the frame point `at`. */
function at(buf: PixelBuffer, p: V2, px: number, py: number, behind = false): Piece {
  return { buf, x: Math.round(p[0] - px), y: Math.round(p[1] - py), behind };
}

// ------------------------------------------------------------------------------------ poses

const L = (hip: number, knee: number, foot?: number) => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** Sitting on the chair: thighs forward, shins down, hands tied behind the back. */
const SIT: Pose = {
  legN: L(88, 92),
  legF: L(82, 96),
  armN: { sh: -30, el: -10, hand: 'fist' },
  armF: { sh: -40, el: -10, hand: 'fist' },
};

/** Kneeling in the cage, hands on the front bars. */
const KNEEL: Pose = {
  ...P.CROUCH,
  lean: 6,
  armN: { to: [7, -2], hand: 'grip' },
  armF: { to: [8, -1], hand: 'grip' },
};

/** Standing against the mast, feet together, hands tied behind it. */
const POLE: Pose = {
  legN: L(6, 6),
  legF: L(-4, 6),
  armN: { sh: -35, el: -15, hand: 'fist' },
  armF: { sh: -42, el: -12, hand: 'fist' },
};

/** Hanging by the raised wrists under the balloon, legs dangling. */
const HANG: Pose = {
  legN: L(12, 18),
  legF: L(-8, 26),
  armN: { sh: 168, el: 4, hand: 'fist' },
  armF: { sh: 174, el: 2, hand: 'fist' },

  grounded: false,
};

/** Struggle-frame overrides: lean and kick, mouth open (MMF!). */
const STRUGGLE: Pose = { expr: 'shout' };

/** The rest / blink / struggle triple of a tied pose. */
function tiedTriple(base: Pose, struggle: Pose): Pose[] {
  return [
    { ...base, expr: 'normal' },
    { ...base, expr: 'blink' },
    { ...base, ...STRUGGLE, ...struggle },
  ];
}

/** Freed: hop up as the ropes drop, land with the arms up, stretch, relax. */
const FREED: readonly Pose[] = [
  { ...P.JUMP[0], armN: { sh: 160, el: 20, hand: 'open' }, armF: { sh: 170, el: 20, hand: 'open' }, dy: -3, expr: 'panic' },
  { ...P.STAND, armN: { to: [-2, -12], hand: 'open' }, armF: { to: [4, -12], hand: 'open' }, expr: 'happy' },
  { ...P.STAND, armN: { to: [-3, -12], hand: 'fist' }, armF: { to: [3, -12], hand: 'fist' }, lean: -6, expr: 'blink' },
  { ...P.STAND, armN: { sh: 20, el: 40, hand: 'fist' }, armF: { sh: -6, el: 30 }, expr: 'happy' },
];

/** Give: reach into a pocket, pull out the gift, hold it out (×2: the hand-over), let go. */
const GIVE: readonly Pose[] = [
  { ...P.STAND, armN: { to: [3, 7], hand: 'fist' }, lean: 4, expr: 'normal' },
  { ...P.STAND, armN: { to: [8, 1], hand: 'grip' }, held: 'gift', lean: 4, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, 2], hand: 'grip' }, held: 'gift', lean: 6, expr: 'happy' },
  { ...P.STAND, armN: { to: [10, 3], hand: 'open' }, lean: 6, expr: 'happy' },
];

/** The curtain-call bow: arms open wide, then a deep bow (hostages never salute). */
const BOW: readonly Pose[] = [
  { ...P.STAND, armN: { sh: 105, el: 10, hand: 'open' }, armF: { sh: 115, el: 10, hand: 'open' }, lean: -4, expr: 'happy' },
  { ...P.STAND, lean: 38, armN: { to: [2, 7], hand: 'open' }, armF: { sh: -50, el: 10, hand: 'open' }, head: { tilt: 10 }, expr: 'blink' },
];

/** The critic doffs an imaginary hat, then bows with the "hat" swept low. */
const BOW_CRITIC: readonly Pose[] = [
  { ...P.STAND, armN: { to: [3, -13], hand: 'grip' }, armF: { sh: -10, el: 20 }, expr: 'happy' },
  { ...P.STAND, lean: 36, armN: { sh: 70, el: 10, hand: 'grip' }, armF: { sh: -45, el: 10, hand: 'open' }, head: { tilt: 10 }, expr: 'blink' },
];

const WALK = withSwing(P.WALK, 0.9, 30).map((p) => ({ ...p, expr: 'happy' as const }));
const RUN = withSwing(P.RUN, 1.1, 80).map((p) => ({ ...p, lean: 10, expr: 'happy' as const }));

// ------------------------------------------------------------------------------------ strips

/** Bind strips stacked from pieces: the chair, the cage, the sack, the parachute. */

/** Rope coils around a sitting figure, drawn only over its own pixels (they hug the silhouette). */
function roped(f: Frame): Frame {
  const b = f.buf.clone();
  const hip = f.pts?.hip ?? [0, -10];
  const rope = PAL.sand;
  for (const dy of [3, 7]) {
    const y = f.oy + hip[1] - dy;
    let first = -1;
    let last = -1;
    for (let x = 0; x < b.w; x++) {
      const c = f.buf.get(x, y);
      if ((c & 255) !== 0 && c !== INK) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    for (let x = first - 1; x <= last + 1; x++) {
      b.set(x, y, (x & 1) === 0 ? rope[3] : rope[2]);
      if ((f.buf.get(x, y + 1) & 255) !== 0) b.set(x, y + 1, rope[0]);
    }
    b.set(first - 2, y, INK);
    b.set(last + 2, y, INK);
    b.set(first - 1, y - 1, INK);
    b.set(last + 1, y - 1, INK);
  }
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Loose rope pieces on the ground (freed). */
function droppedRope(): PixelBuffer {
  const b = new PixelBuffer(14, 4);
  b.line(1, 2, 5, 1, PAL.sand[2]).line(6, 2, 12, 2, PAL.sand[3]);
  return b.outline(INK);
}

function hipOf(f: Frame): V2 {
  return f.pts?.hip ?? [0, -14];
}

/** Tied to the chair (rest, blink, struggle: lean back and kick). */
function tiedFrames(kind: HostageKindId): Frame[] {
  return tiedTriple(SIT, { lean: -8, legN: L(70, 50) }).map((p) => {
    const f = figure(kind, p);
    const [hx, hy] = hipOf(f);
    return roped(withPieces(f, [{ buf: chairPiece(), x: hx - 8, y: hy - 13, behind: true }]));
  });
}

/** Kneeling in the hanging cage, gripping the bars (rest, blink, struggle: shake the bars). */
function cagedFrames(kind: HostageKindId): Frame[] {
  const back = cageBack();
  const front = cageFront();
  return tiedTriple(KNEEL, { lean: 12, armN: { to: [8, -4], hand: 'grip' } }).map((p) => {
    const f = figure(kind, p);
    return withPieces(f, [
      { buf: back, x: -11, y: -31, behind: true },
      { buf: front, x: -11, y: -31 },
    ]);
  });
}

/** Tied to the float mast, ropes drawn by the bind (rest, blink, struggle). */
function mastFrames(kind: HostageKindId): Frame[] {
  return tiedTriple(POLE, { lean: -4, legN: L(14, 20) }).map((p) => figure(kind, p));
}

/** Hopping blindly in a sack: only the shoes show (squash, push off, airborne, land). */
function sackFrames(kind: HostageKindId): Frame[] {
  const style = HOSTAGE_STYLES[kind];
  const steps: Array<{ legs: Pose; w: number; h: number; dy: number; tilt: number }> = [
    { legs: { legN: L(30, 50), legF: L(10, 50) }, w: 18, h: 27, dy: 0, tilt: 0 },
    { legs: { legN: L(8, 10, -20), legF: L(-6, 12, -20) }, w: 15, h: 30, dy: 0, tilt: 1 },
    { legs: { legN: L(16, 30), legF: L(0, 34), grounded: false, dy: -4 }, w: 15, h: 30, dy: -5, tilt: 1 },
    { legs: { legN: L(24, 36), legF: L(4, 36) }, w: 17, h: 28, dy: 0, tilt: 0 },
  ];
  return steps.map((s) => {
    const legs = renderHuman(style, s.legs, 'lower');
    // Keep only the shoes (the rows under the ankles); the sack covers the rest.
    const b = legs.buf.clone();
    for (let y = 0; y < b.h; y++) if (y - legs.oy < -5 + (s.legs.dy ?? 0)) for (let x = 0; x < b.w; x++) b.set(x, y, 0);
    const feet: Frame = { buf: b, ox: legs.ox, oy: legs.oy };
    const sack = sackPiece(s.w, s.h, s.tilt);
    const bottom = s.dy - 3;
    return withPieces(feet, [{ buf: sack, x: -(sack.w >> 1), y: bottom - (s.h + 3) }]);
  });
}

/** Hanging from the balloon rope by the wrists, legs kicking (the rope is drawn by the bind). */
function dangleFrames(kind: HostageKindId): Frame[] {
  return [
    { ...HANG, expr: 'panic' as const },
    { ...HANG, legN: L(-4, 30), legF: L(14, 20), expr: 'shout' as const },
  ].map((p) => {
    // The rig's raised arms end behind the head: drawn-on forearms and fists stick up over it
    // and grip the rope, so the hang reads at 1x.
    const f = figure(kind, p);
    const head = f.pts?.head ?? [0, -29];
    const y = head[1] - 9;
    const grip: Pts = { hand: [head[0], y + 2] };
    return fitHands(withPieces(f, [{ buf: raisedFists(kind), x: head[0] - 3, y }], grip));
  });
}

/** Raised forearms (sleeves) with both fists on top: the hanging hostage's grip on the rope. */
function raisedFists(kind: HostageKindId): PixelBuffer {
  const st = HOSTAGE_STYLES[kind];
  const skin = PAL[st.skin as keyof typeof PAL];
  const top = PAL[st.top as keyof typeof PAL];
  // Both fists together round the rope, the sleeves spreading down to the shoulders.
  return art(['.Ssm.', '.ssm.', '.c.d.', 'c...d'], {
    S: skin[3] ?? INK,
    s: skin[2] ?? INK,
    m: skin[1] ?? INK,
    c: top[2] ?? INK,
    d: top[1] ?? INK,
  });
}

/** Parachuting: both hands on the risers, the canopy above. */
function chuteFrames(kind: HostageKindId): Frame[] {
  return [0, 1].map((i) => {
    const f = fitHands(figure(kind, { ...HANG, armN: { sh: 150, el: 26, hand: 'fist' }, armF: { sh: 160, el: 24, hand: 'fist' }, legN: L(i ? 20 : 8, 24), legF: L(i ? -2 : 6, 30), expr: 'happy' }));
    const hand = f.pts?.hand ?? [4, DANGLE_HANDS];
    const canopy = canopyPiece(i);
    const top = hand[1] - 22;
    const lines = new PixelBuffer(canopy.w, 22);
    const cx = canopy.w >> 1;
    // Risers from the canopy hem down to the hands.
    lines.line(2, 0, cx - 1, 20, PAL.stone[2]);
    lines.line(canopy.w - 3, 0, cx + 1, 20, PAL.stone[2]);
    lines.line(cx, 0, cx, 20, PAL.stone[3]);
    return withPieces(f, [
      { buf: lines, x: hand[0] - cx, y: top + 9, behind: true },
      { buf: canopy, x: hand[0] - cx, y: top },
    ]);
  });
}

/** Shift a hanging figure so its hands meet the rope end (DANGLE_HANDS above the anchor). */
function fitHands(f: Frame): Frame {
  const hand = f.pts?.hand;
  if (!hand) return f;
  const dy = DANGLE_HANDS - hand[1];
  const dx = -hand[0];
  const pts: Pts = {};
  for (const [k, p] of Object.entries(f.pts ?? {})) pts[k] = [p[0] + dx, p[1] + dy];
  return { buf: f.buf, ox: f.ox - dx, oy: f.oy - dy, pts };
}

/** Freed: the ropes drop to the ground while they hop up, stretch and relax. */
function freedFrames(kind: HostageKindId): Frame[] {
  const rope = droppedRope();
  return FREED.map((p, i) => {
    const f = figure(kind, p);
    return i < 3 ? withPieces(f, [{ buf: rope, x: -8 + i, y: -4, behind: i > 0 }]) : f;
  });
}

// ---- per-kind dressing --------------------------------------------------------------------

/** Near-arm override and prop for the kind's walk (critic: notepad; tea lady: teapot; composer: baton). */
function walkFrames(kind: HostageKindId): Frame[] {
  return WALK.map((p) => {
    if (kind === 'critic') {
      const pose: Pose = { ...p, armN: { to: [5, 3], hand: 'grip' } };
      const f = figure(kind, pose);
      return dress(f, [at(prop('notepad'), f.pts?.hand ?? [4, -16], 2, 3)]);
    }
    if (kind === 'tea-lady') {
      const pose: Pose = { ...p, armN: { sh: 6, el: 16, hand: 'grip' } };
      const f = figure(kind, pose);
      return dress(f, [at(prop('teapot'), f.pts?.hand ?? [2, -10], 1, 1)]);
    }
    if (kind === 'composer') {
      const f = figure(kind, p);
      const b = baton(-40);
      return dress(f, [at(b.buf, f.pts?.hand ?? [2, -10], b.grip[0], b.grip[1])]);
    }
    return figure(kind, p);
  });
}

/** The roadie walks with the heavy case held in front with both hands, leaning back. */
function carryFrames(kind: HostageKindId): Frame[] {
  const c = prop('ampCase');
  return WALK.map((p) => {
    const pose: Pose = { ...p, armN: { to: [7, 6], hand: 'grip' }, armF: { to: [7, 6], hand: 'grip' }, lean: -6, expr: 'normal' };
    const f = figure(kind, pose);
    const hand = f.pts?.hand ?? [6, -10];
    return dress(f, [at(c, hand, 7, 1)]);
  });
}

/** The kind's 4-frame comedy beat (frames picked by the kind's `gagFrame`). */
function gagFrames(kind: HostageKindId): Frame[] {
  switch (kind) {
    case 'critic': {
      // Scribbling on the notepad (the hand moves), then the star card held up high.
      const pad = prop('notepad');
      const card = prop('card');
      const scribble = [3, 5].map((x) => {
        const pose: Pose = { ...P.STAND, armN: { to: [x, 2], hand: 'grip' }, armF: { to: [6, 3], hand: 'grip' }, head: { tilt: 8 }, expr: 'normal' };
        const f = figure(kind, pose);
        const far = farHand(f, pose);
        return dress(f, [at(pad, far, 2, 2)]);
      });
      const up = [0, 1].map((i) => {
        const pose: Pose = { ...P.STAND, armN: { to: [2, -12], hand: 'grip' }, armF: { to: [4, -12], hand: 'grip' }, expr: 'happy', bob: i };
        const f = figure(kind, pose);
        const hand = f.pts?.hand ?? [2, -34];
        const cardAt: V2 = [hand[0] + 1, hand[1] - 6];
        return dress(f, [at(card, cardAt, 8, 6)], { card: [cardAt[0], cardAt[1]] });
      });
      return [...scribble, ...up];
    }
    case 'roadie': {
      const c = prop('ampCase');
      const caseAt: V2 = [10, -1];
      const poses: Pose[] = [
        { ...P.STAND, lean: 22, armN: { to: [6, 9], hand: 'open' }, armF: { to: [7, 9], hand: 'open' }, expr: 'normal' },
        { ...P.STAND, armN: { to: [4, -9], hand: 'open' }, armF: { sh: -6, el: 20 }, expr: 'blink' },
        { ...P.STAND, lean: -6, armN: { sh: 30, el: 60, hand: 'fist' }, armF: { sh: -20, el: 60, hand: 'fist' }, expr: 'shout' },
        { ...P.STAND, lean: -4, armN: { sh: 30, el: 60, hand: 'fist' }, armF: { sh: -20, el: 60, hand: 'fist' }, expr: 'blink' },
      ];
      return poses.map((p) => dress(figure(kind, p), [at(c, caseAt, 0, 11)]));
    }
    case 'tea-lady': {
      const cup = prop('cup');
      const poses: Array<{ pose: Pose; pot: number | null }> = [
        { pose: { ...P.STAND, armN: { to: [7, -3], hand: 'grip' }, armF: { to: [7, 3], hand: 'grip' }, expr: 'happy' }, pot: 35 },
        { pose: { ...P.STAND, armN: { to: [7, -4], hand: 'grip' }, armF: { to: [7, 3], hand: 'grip' }, expr: 'happy' }, pot: 55 },
        { pose: { ...P.STAND, armN: { sh: 6, el: 16, hand: 'grip' }, armF: { to: [6, -5], hand: 'grip' }, head: { tilt: -8 }, expr: 'blink' }, pot: 0 },
        { pose: { ...P.STAND, armN: { sh: 6, el: 16, hand: 'grip' }, armF: { to: [7, 2], hand: 'grip' }, expr: 'happy' }, pot: 0 },
      ];
      return poses.map(({ pose, pot }) => {
        const f = figure(kind, pose);
        const hand = f.pts?.hand ?? [5, -20];
        const far = farHand(f, pose);
        const potBuf = pot ? teapotTilted(pot) : prop('teapot');
        const pieces: Piece[] = [at(potBuf, hand, pot ? potBuf.w >> 1 : 1, pot ? (potBuf.h >> 1) + 1 : 1), at(cup, far, 2, 1)];
        return dress(f, pieces, { cup: [far[0], far[1] - 2] });
      });
    }
    case 'tourist': {
      const cam = prop('camera');
      const poses: Pose[] = [
        { ...P.STAND, armN: { to: [6, -2], hand: 'grip' }, armF: { to: [7, -1], hand: 'grip' }, expr: 'happy' },
        { ...P.STAND, armN: { to: [7, -5], hand: 'grip' }, armF: { to: [8, -4], hand: 'grip' }, lean: 4, expr: 'blink' },
        { ...P.STAND, armN: { to: [7, -5], hand: 'grip' }, armF: { to: [8, -4], hand: 'grip' }, lean: 4, expr: 'happy' },
        { ...P.STAND, armN: { to: [5, 3], hand: 'grip' }, armF: { to: [6, 3], hand: 'grip' }, expr: 'happy' },
      ];
      return poses.map((p) => {
        const f = figure(kind, p);
        const hand = f.pts?.hand ?? [6, -26];
        const camAt: V2 = [hand[0] + 1, hand[1] - 2];
        return dress(f, [at(cam, camAt, 2, 3)], { flash: [camAt[0], camAt[1] - 3] });
      });
    }
    case 'composer': {
      // A 4/4 pattern with the eyes closed: down, in, out, up.
      const beats: Array<{ to: V2; angle: number }> = [
        { to: [6, 3], angle: 20 },
        { to: [1, -4], angle: -60 },
        { to: [9, -3], angle: -20 },
        { to: [5, -11], angle: -80 },
      ];
      return beats.map((b, i) => {
        const pose: Pose = { ...P.STAND, armN: { to: b.to, hand: 'grip' }, armF: { sh: 40 + i * 10, el: 50, hand: 'open' }, lean: i === 3 ? -4 : 2, expr: 'blink' };
        const f = figure(kind, pose);
        const hand = f.pts?.hand ?? [5, -20];
        const bt = baton(b.angle);
        return dress(f, [at(bt.buf, hand, bt.grip[0], bt.grip[1])], { baton: [hand[0] + bt.tip[0] - bt.grip[0], hand[1] + bt.tip[1] - bt.grip[1]] });
      });
    }
    case 'dollop': {
      const poses: Pose[] = [
        { ...P.STAND, armN: { to: [5, -9], hand: 'fist' }, armF: { to: [2, 6], hand: 'open' }, expr: 'shout' },
        { ...P.STAND, armN: { to: [6, -10], hand: 'fist' }, armF: { to: [2, 6], hand: 'open' }, lean: 3, expr: 'shout' },
        { ...P.STAND, armN: { to: [11, -3], hand: 'point' }, armF: { to: [2, 6], hand: 'open' }, lean: 4, expr: 'happy' },
        { ...P.STAND, armN: { to: [11, -4], hand: 'point' }, armF: { to: [2, 6], hand: 'open' }, lean: 5, expr: 'normal' },
      ];
      return poses.map((p) => figure(kind, p));
    }
    default:
      return GIVE.map((p) => figure(kind, p));
  }
}

/** Give: generic gift box; the roadie opens his case instead; Mrs. Dollop gestures to the shed. */
function giveFrames(kind: HostageKindId): Frame[] {
  if (kind === 'roadie') {
    const c = prop('ampCase');
    const open = prop('caseOpen');
    const caseAt: V2 = [10, -1];
    const poses: Pose[] = [
      { ...P.CROUCH, armN: { to: [7, 4], hand: 'open' }, armF: { to: [7, 5], hand: 'open' }, lean: 10, expr: 'normal' },
      { ...P.CROUCH, armN: { to: [8, -2], hand: 'open' }, armF: { to: [7, 5], hand: 'open' }, lean: 6, expr: 'happy' },
      { ...P.CROUCH, armN: { to: [8, -3], hand: 'open' }, armF: { to: [7, 5], hand: 'open' }, lean: 6, expr: 'happy' },
      { ...P.STAND, armN: { sh: 160, el: 30, hand: 'thumb' }, armF: { sh: -6, el: 20 }, expr: 'happy' },
    ];
    return poses.map((p, i) => {
      const f = figure(kind, p);
      const piece = i === 0 ? at(c, caseAt, 0, 11) : at(open, [caseAt[0] - 1, caseAt[1] + 1], 0, 15);
      // The gift pops out of the open case.
      return dress(f, [piece], i === 1 || i === 2 ? { hand: [caseAt[0] + 7, caseAt[1] - 8] } : undefined);
    });
  }
  if (kind === 'dollop') {
    const poses: Pose[] = [
      { ...P.STAND, armN: { to: [9, -6], hand: 'point' }, expr: 'happy' },
      { ...P.STAND, armN: { to: [11, -2], hand: 'open' }, lean: 4, expr: 'happy' },
      { ...P.STAND, armN: { to: [11, -1], hand: 'open' }, lean: 5, expr: 'happy' },
      { ...P.STAND, armN: { to: [4, -11], hand: 'open' }, expr: 'happy' },
    ];
    return poses.map((p) => figure(kind, p));
  }
  return GIVE.map((p) => {
    if (kind === 'composer') {
      // A flourish of the baton in the far hand would hide; he hands the gift over with a bow of the head.
      return figure(kind, { ...p, head: { tilt: 6 } });
    }
    return figure(kind, p);
  });
}

function bowFrames(kind: HostageKindId): Frame[] {
  const poses = kind === 'critic' ? BOW_CRITIC : kind === 'composer' ? BOW.map((p, i) => (i === 1 ? { ...p, lean: 46 } : { ...p, armN: { sh: 150, el: 10, hand: 'grip' as const } })) : BOW;
  return poses.map((p, i) => {
    const f = figure(kind, p);
    if (kind === 'composer' && i === 0) {
      const b = baton(-70);
      return dress(f, [at(b.buf, f.pts?.hand ?? [4, -30], b.grip[0], b.grip[1])]);
    }
    return f;
  });
}

function runFrames(kind: HostageKindId): Frame[] {
  return RUN.map((p) => figure(kind, p));
}

// ------------------------------------------------------------------------------------ small fx

/** A gold star (3×3 plus with a white heart) for the critic's card (centre anchor). */
function starFrames(): Frame[] {
  const b = ascii(['.g.', 'gwg', '.g.'], { g: PAL.gold[2], w: PAL.gold[3] });
  return [{ buf: b, ox: 1, oy: 1 }];
}

/** The camera flash: a white burst shrinking to a twinkle (centre anchor). */
function flashFrames(): Frame[] {
  return [9, 6, 3].map((r) => {
    const s = r * 2 + 3;
    const b = new PixelBuffer(s, s);
    const c = s >> 1;
    b.circle(c, c, Math.max(1, r >> 1), W[3]);
    b.line(c - r, c, c + r, c, W[3]);
    b.line(c, c - r, c, c + r, W[3]);
    if (r > 3) {
      b.line(c - (r >> 1), c - (r >> 1), c + (r >> 1), c + (r >> 1), PAL.gold[3]);
      b.line(c - (r >> 1), c + (r >> 1), c + (r >> 1), c - (r >> 1), PAL.gold[3]);
    }
    return { buf: b, ox: c, oy: c };
  });
}

/** A floating music note (the composer's phrase), 2 frames (centre anchor). */
function noteFrames(): Frame[] {
  const rows = [
    ['...k', '..kk', '..k.', '..k.', 'kkk.', 'kkk.'],
    ['..k.', '..kk', '..k.', '..k.', 'kkk.', 'kkk.'],
  ];
  return rows.map((r) => {
    const b = ascii(r, { k: PAL.navy[1] }).padded(1);
    // A white rim keeps the dark note readable on dark backgrounds.
    b.outline(W[2]);
    return { buf: b, ox: b.w >> 1, oy: b.h >> 1 };
  });
}

/** A wisp of tea steam (3 frames, centre anchor). */
function steamFrames(): Frame[] {
  const rows = [['.w', 'w.', '.w', 'w.'], ['w.', '.w', 'w.'], ['.w', 'w.']];
  return rows.map((r) => {
    const b = ascii(r, { w: W[2] });
    return { buf: b, ox: 1, oy: b.h >> 1 };
  });
}

/** The roadie's empty open case (feet anchor). */
function caseOpenFrames(): Frame[] {
  const b = prop('caseOpen');
  return [{ buf: b, ox: b.w >> 1, oy: b.h }];
}

// ------------------------------------------------------------------------------------ register

/** Strip builders and timings (ticks). */
const STRIPS: ReadonlyArray<readonly [string, (k: HostageKindId) => Frame[], SpriteOpts]> = [
  ['tied', tiedFrames, { ticksPerFrame: 30 }],
  ['caged', cagedFrames, { ticksPerFrame: 30 }],
  ['mast', mastFrames, { ticksPerFrame: 30 }],
  ['sack', sackFrames, { durations: [7, 5, 8, 6] }],
  ['dangle', dangleFrames, { ticksPerFrame: 14 }],
  ['chute', chuteFrames, { ticksPerFrame: 20 }],
  ['freed', freedFrames, { durations: [6, 6, 4, 4], loop: false }],
  ['walk', walkFrames, { ticksPerFrame: 6 }],
  ['gag', gagFrames, { ticksPerFrame: 8 }],
  ['give', giveFrames, { ticksPerFrame: 6, loop: false }],
  ['bow', bowFrames, { durations: [4, 8], loop: false }],
  ['run', runFrames, { ticksPerFrame: 4 }],
];

export function defineHostageSprites(): void {
  for (const kind of HOSTAGE_KINDS) {
    for (const [name, gen, opts] of STRIPS) defineSprite(`item/hostage/${kind}/${name}`, () => gen(kind), opts);
  }
  defineSprite('item/hostage/roadie/carry', () => carryFrames('roadie'), { ticksPerFrame: 7 });
  // The kind-less strips are the critic's (the default kind).
  for (const [name, , opts] of STRIPS) defineSprite(`item/hostage/${name}`, () => [...getFrames(`item/hostage/critic/${name}`)], opts);
  defineSprite('item/hostage/star', starFrames, { anchor: 'center' });
  defineSprite('item/hostage/flash', flashFrames, { durations: [2, 3, 3], loop: false });
  defineSprite('item/hostage/note', noteFrames, { ticksPerFrame: 10 });
  defineSprite('item/hostage/steam', steamFrames, { ticksPerFrame: 8 });
  defineSprite('item/hostage/case-open', caseOpenFrames, { ticksPerFrame: 60 });
}
