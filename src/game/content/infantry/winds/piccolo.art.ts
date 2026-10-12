/**
 * `enemy/piccolo[-<outfit>][-skin<b|c>]/…` — the Piccolo Sniper (GDD §9.1): build `slim`, a
 * crimson beret with a long white feather, always lying prone. Every strip is the prone rig
 * (rotated 90°: head forward, face down, chest propped up on the elbows), anchored at the pelvis
 * on the ground line (the 30×10 hurtbox lies along the body); points `hand` (the grip of the
 * piccolo-rifle) and `head`.
 *
 * Strips: idle (2f) · aim (1f, no piccolo: the game draws `enemy/piccolo-rifle` at the aim
 * angle) · fire (2f, no piccolo) · reload (4f) · startle (4f, the hop that loses the piccolo) ·
 * spare (4f, a new piccolo out of the beret) · gag-scales (6f, plays it like a flute) · gag-nap ·
 * gag (= scales) · double-take · alert · panic (curled up hugging the piccolo, beret over the
 * eyes, wriggling) · salute · confused · queue · photo-pose · ears · stumble · frozen · die (5f:
 * hit, the slide) · die-fall (4f tumble off the ledge) · die-blast · die-burn · die-knife ·
 * die-crush · die-shatter · hat (beret + feather) · shatter-head · dropped (the lost piccolo,
 * 4 tumble frames) · and the contract fillers walk / run (a crawl), crouch, shoot, crouch-shoot,
 * throw.
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { crumble, scorch, sootify, withFlames, withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type ArmPose, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
import { hatFrames, headgearArt, outfitStyle } from '../art';
import { defineSkinVariant, defineStrips, frazzled, hatless, headOnly, type Strips, type TypeArt } from './common.art';
import { bubbleArt, coinArt, drawShapes, iceBlock, iceCubes, markArt, noteArt, pancake, stamp, type Body, type Pt, type Shape, type WPose } from './kit';
import { ensureLook, registerLookDefiner, type Outfit, type Skin } from './looks';

/** Parade style: the slim sniper. */
export const PICCOLO_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'beret',
  gear: 'red',
  accent: 'snow',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'slim',
  accessories: ['cross-belt'],
  face: ['moustache'],
};

/** The look for an outfit: the crimson beret stays (it is his identity), the rest swaps. */
export function piccoloStyle(outfit: Outfit): HumanStyle {
  return { ...outfitStyle(PICCOLO_STYLE, outfit, { keepHat: true }), gear: 'red' };
}

// ---------------------------------------------------------------------------------------------
// Pieces (drawn in frame space: the piccolo stays straight whatever the body does)
// ---------------------------------------------------------------------------------------------

/** Per-frame extras read by the dresser. */
interface Pic {
  /** Piccolo in the near hand at this angle (degrees, + = down); undefined = none. */
  pic?: number;
  /** Where the piccolo sits: the hand (default) or the mouth (played like a flute). */
  at?: 'hand' | 'mouth' | 'head';
  /** The white feather on the beret (default true while the beret is on). */
  feather?: boolean;
  /** A music note over the piccolo (1..3 = rising). */
  note?: number;
  /** A snore bubble of this radius by the head. */
  snore?: number;
  /** A coin in the hand (the JINGLE queue) / a peace sign (SAY CHEESE). */
  coin?: boolean;
  vsign?: boolean;
  /** An exclamation mark over the head. */
  mark?: boolean;
}

type PPose = WPose<Pic>;

const FRAME_BODY: Body = { hip: [0, 0], angle: 0 };
const DEG = Math.PI / 180;

/** The piccolo: a thin silver tube with dark keys and a brass crown, gripped `back` px from its end. */
function piccoloShapes(at: Pt, angle: number, len = 18, back = 4): Shape[] {
  const dx = Math.cos(angle * DEG);
  const dy = Math.sin(angle * DEG);
  const p = (k: number): Pt => [at[0] + dx * k, at[1] + dy * k];
  const keys: Pt[] = [];
  for (let k = 3; k < len - back - 3; k += 3) keys.push(p(k));
  return [
    { kind: 'tube', pts: [p(-back), p(len - back)], w: 2, ramp: PAL.steel, shade: { base: 2 } },
    { kind: 'dots', pts: keys, ramp: PAL.steel, color: PAL.steel[1], detail: true },
    { kind: 'tube', pts: [p(len - back - 2), p(len - back)], w: 2, ramp: PAL.gold, color: PAL.gold[2] },
    { kind: 'dots', pts: [p(-back)], ramp: PAL.gold, color: PAL.gold[3], detail: true },
  ];
}

/** The long white feather sweeping back from the beret (head point = head centre). */
function featherShapes(head: Pt): Shape[] {
  const [x, y] = head;
  return [
    { kind: 'tube', pts: [[x - 1, y - 6], [x - 5, y - 9], [x - 10, y - 10], [x - 14, y - 9]], w: 2, ramp: PAL.snow },
    { kind: 'tube', pts: [[x - 4, y - 9], [x - 13, y - 9]], w: 1, ramp: PAL.snow, color: PAL.snow[1], detail: true },
  ];
}

function piece(shapes: readonly Shape[], behind = false): Piece | null {
  const p = drawShapes(shapes, FRAME_BODY);
  return p ? { ...p, behind } : null;
}

/** Dress a rendered prone frame: feather, piccolo, small comedy marks. */
function picDress(f: Frame, _b: Body, p: WPose<unknown>): Frame {
  const s = (p.inst ?? {}) as Pic;
  const pieces: Piece[] = [];
  const head = f.pts?.head;
  const hand = f.pts?.hand;
  if (head && s.feather !== false && p.hat !== false) {
    const fp = piece(featherShapes(head), true);
    if (fp) pieces.push(fp);
  }
  if (s.pic !== undefined) {
    const at: Pt | undefined = s.at === 'mouth' && head ? [head[0] + 4, head[1] + 3] : s.at === 'head' && head ? [head[0] + 1, head[1] - 7] : hand;
    if (at) {
      const pp = piece(piccoloShapes(at, s.pic, 18, s.at === 'mouth' ? 1 : 4));
      if (pp) pieces.push(pp);
    }
  }
  let out = pieces.length > 0 ? withPieces(f, pieces) : f;
  if (s.note && head) out = stamp(out, noteArt(s.note % 2 === 0), head[0] + 8 + s.note * 3, head[1] - 10 - s.note * 3);
  if (s.snore && head) out = stamp(out, bubbleArt(s.snore), head[0] + 5, head[1] - 4 - s.snore * 2);
  if (s.coin && hand) out = stamp(out, coinArt(), hand[0] - 2, hand[1] - 6);
  if (s.vsign && hand) out = stamp(out, vSign(), hand[0] - 1, hand[1] - 6);
  if (s.mark && head) out = stamp(out, markArt('!'), head[0] + 4, head[1] - 18);
  return out;
}

/** Two raised fingers (the photo-pose peace sign). */
function vSign(): PixelBuffer {
  const b = new PixelBuffer(5, 6);
  b.set(1, 1, PAL.snow[3]);
  b.set(1, 2, PAL.snow[2]);
  b.set(3, 1, PAL.snow[3]);
  b.set(3, 2, PAL.snow[2]);
  b.set(2, 3, PAL.snow[2]);
  return b.outline(INK);
}

// ---------------------------------------------------------------------------------------------
// Prone poses (standing-space values; `rot: 90` lays the figure down, head forward)
// ---------------------------------------------------------------------------------------------

const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });
const A = (sh: number, el: number, hand: ArmPose['hand'] = 'grip'): ArmPose => ({ sh, el, hand });
/** Hand target in PRONE space (x forward, y down) from the shoulder, as a standing-space `to`. */
const T = (fx: number, fy: number, hand: ArmPose['hand'] = 'grip'): ArmPose => ({ to: [fy, -fx], hand });

const LEGS: Pose = { legN: L(0, 0, 60), legF: L(6, 10, 60) };
/** Lying flat, propped up on the elbows, head up looking ahead. */
const PRONE: Pose = { rot: 90, ...LEGS, lean: -20, head: { tilt: -78 } };
/** Both hands forward on the piccolo. */
const GRIP: Pose = { armN: T(11, 3), armF: T(9, 4) };
const AIM: Pose = { ...PRONE, lean: -26, head: { tilt: -82 }, armN: T(12, 2), armF: T(10, 3) };

const pr = (p: PPose): PPose => ({ ...PRONE, ...GRIP, ...p, inst: { pic: 0, ...p.inst } });
const bare = (p: PPose): PPose => ({ ...PRONE, ...GRIP, ...p });

/** The piccolo's TypeArt (common.art helpers; his strips are all his own). */
export const PICCOLO_ART: TypeArt = { dress: picDress, hold: GRIP, hug: GRIP, farHold: { armF: GRIP.armF }, hat: hatWithFeather };

/** The beret alone plus its feather (pops off on death). */
function hatWithFeather(st: HumanStyle): PixelBuffer | null {
  const hat = headgearArt(st);
  if (!hat) return null;
  const out = hat.padded(10, 6, 0, 0);
  const pts: Pt[] = [[10 + 1, 6 + 1], [10 - 3, 6 - 2], [10 - 7, 6 - 3], [10 - 9, 6 - 2]];
  const fp = drawShapes([{ kind: 'tube', pts, w: 2, ramp: PAL.snow }], FRAME_BODY, true);
  if (fp) out.blit(fp.buf, fp.x, fp.y);
  const tb = out.trimBounds();
  return tb ? out.crop(tb.x, tb.y, tb.w, tb.h) : out;
}

function render(st: HumanStyle, p: PPose): Frame {
  const f = renderHuman(st, p, 'full');
  return picDress(f, FRAME_BODY, p);
}

// ---------------------------------------------------------------------------------------------
// The strip table
// ---------------------------------------------------------------------------------------------

function piccoloStrips(): Strips {
  const idle: PPose[] = [pr({}), pr({ hunch: 1, inst: { pic: 1 } })];
  const aim: PPose[] = [{ ...AIM }];
  const fire: PPose[] = [
    { ...AIM, lean: -24, armN: T(10, 2), armF: T(8, 3), expr: 'shout' },
    { ...AIM, expr: 'blink' },
  ];
  const reload: PPose[] = [
    pr({ armN: T(8, 1), armF: T(6, 3), inst: { pic: -4 } }),
    pr({ armN: T(14, 0), armF: T(6, 3), inst: { pic: -4 }, expr: 'blink' }),
    pr({ armN: T(16, 1), armF: T(6, 3), inst: { pic: -4 } }),
    pr({ armN: T(12, 1), armF: T(6, 3), inst: { pic: -4 }, expr: 'happy' }),
  ];
  const crawl: PPose[] = [
    pr({ armN: T(13, 3), armF: T(6, 4), legN: L(10, 30, 60), legF: L(0, 0, 60), inst: { pic: 2 } }),
    pr({ armN: T(10, 3), armF: T(8, 4), legN: L(4, 16, 60), legF: L(4, 10, 60), inst: { pic: 2 }, hunch: 1 }),
    pr({ armN: T(7, 3), armF: T(11, 4), legN: L(0, 0, 60), legF: L(10, 30, 60), inst: { pic: 2 } }),
    pr({ armN: T(9, 3), armF: T(13, 4), legN: L(4, 10, 60), legF: L(4, 16, 60), inst: { pic: 2 }, hunch: 1 }),
    pr({ armN: T(11, 3), armF: T(10, 4), legN: L(8, 24, 60), legF: L(2, 4, 60), inst: { pic: 2 } }),
    pr({ armN: T(12, 3), armF: T(7, 4), legN: L(10, 30, 60), legF: L(0, 0, 60), inst: { pic: 2 }, hunch: 1 }),
  ];
  const flat: Pose = { lean: 0, head: { tilt: -60 } };
  return {
    idle: { poses: idle, opts: { durations: [40, 30] } },
    crouch: { poses: [idle[0]], opts: { ticksPerFrame: 30 } },
    walk: { poses: crawl, opts: { ticksPerFrame: 8 } },
    run: { poses: [...crawl, ...crawl.slice(0, 2)], opts: { ticksPerFrame: 5 } },
    aim: { poses: aim, opts: { ticksPerFrame: 60 } },
    fire: { poses: fire, opts: { durations: [4, 8], loop: false } },
    shoot: { poses: fire, opts: { durations: [4, 8], loop: false } },
    'crouch-shoot': { poses: fire, opts: { durations: [4, 8], loop: false } },
    reload: { poses: reload, opts: { ticksPerFrame: 8 } },
    throw: { poses: reload, opts: { durations: [6, 6, 6, 8], loop: false } },
    startle: {
      poses: [
        bare({ grounded: false, dy: -2, armN: T(8, -2, 'open'), armF: T(6, -1, 'open'), expr: 'panic', head: { tilt: -90 } }),
        bare({ grounded: false, dy: -6, lean: -30, armN: T(4, -9, 'open'), armF: T(2, -8, 'open'), expr: 'panic', head: { tilt: -95 }, inst: { mark: true } }),
        bare({ grounded: false, dy: -2, armN: T(10, -3, 'open'), armF: T(8, -2, 'open'), expr: 'panic' }),
        bare({ ...flat, armN: T(12, 3, 'open'), armF: T(10, 4, 'open'), expr: 'hurt' }),
      ],
      opts: { durations: [3, 5, 4, 4], loop: false },
    },
    spare: {
      poses: [
        bare({ armN: T(9, -8, 'open'), armF: T(9, 4, 'open'), head: { tilt: -70 }, expr: 'blink' }),
        bare({ armN: T(9, -10), armF: T(9, 4, 'open'), head: { tilt: -70 }, inst: { pic: -80, at: 'head' }, expr: 'happy' }),
        pr({ armN: T(12, -2), armF: T(8, 4), inst: { pic: -30 }, expr: 'happy' }),
        pr({ expr: 'normal' }),
      ],
      opts: { durations: [6, 6, 6, 6], loop: false },
    },
    'gag-scales': {
      poses: [
        bare({ lean: -34, armN: T(10, -3), armF: T(7, -1), head: { tilt: -84 }, inst: { pic: 22, at: 'mouth' }, expr: 'blink' }),
        bare({ lean: -34, armN: T(10, -3), armF: T(7, -1), head: { tilt: -88 }, inst: { pic: 22, at: 'mouth', note: 1 }, expr: 'blink' }),
        bare({ lean: -36, armN: T(10, -4), armF: T(7, -2), head: { tilt: -92 }, inst: { pic: 20, at: 'mouth', note: 2 }, expr: 'blink' }),
        bare({ lean: -38, armN: T(10, -5), armF: T(7, -3), head: { tilt: -96 }, inst: { pic: 18, at: 'mouth', note: 3 }, expr: 'blink' }),
        bare({ lean: -30, armN: T(10, -2), armF: T(7, 0), head: { tilt: -80 }, inst: { pic: 22, at: 'mouth' }, expr: 'happy' }),
        pr({ expr: 'happy' }),
      ],
      opts: { durations: [14, 12, 12, 16, 24, 30] },
    },
    'gag-nap': {
      poses: [
        bare({ ...flat, lean: 6, head: { tilt: -40, dy: 1 }, armN: T(6, -1, 'open'), armF: T(4, 0, 'open'), expr: 'blink', inst: { snore: 1 } }),
        bare({ ...flat, lean: 6, head: { tilt: -40, dy: 1 }, armN: T(6, -1, 'open'), armF: T(4, 0, 'open'), expr: 'blink', hunch: 1, inst: { snore: 2 } }),
        bare({ ...flat, lean: 6, head: { tilt: -40, dy: 1 }, armN: T(6, -1, 'open'), armF: T(4, 0, 'open'), expr: 'blink', hunch: 1, inst: { snore: 3 } }),
        bare({ ...flat, lean: 6, head: { tilt: -40, dy: 1 }, armN: T(6, -1, 'open'), armF: T(4, 0, 'open'), expr: 'blink', inst: { snore: 1 } }),
      ],
      opts: { durations: [24, 24, 24, 12] },
    },
    'double-take': {
      poses: [pr({ expr: 'normal' }), pr({ head: { tilt: -60, dx: -1 }, expr: 'blink' }), pr({ head: { tilt: -92, dy: -1 }, lean: -26, expr: 'panic' })],
      opts: { durations: [8, 8, 8], loop: false },
    },
    alert: {
      poses: [pr({ grounded: false, dy: -2, lean: -28, head: { tilt: -92 }, expr: 'panic' }), pr({ expr: 'shout' })],
      opts: { durations: [10, 12], loop: false },
    },
    panic: {
      poses: [
        bare({ ...flat, armN: T(4, 1, 'open'), armF: T(3, 2, 'open'), hatDy: 3, expr: 'blink', inst: { pic: -10 }, dx: -1 }),
        bare({ ...flat, armN: T(4, 1, 'open'), armF: T(3, 2, 'open'), hatDy: 3, expr: 'blink', inst: { pic: -10 }, hunch: 1 }),
        bare({ ...flat, armN: T(4, 1, 'open'), armF: T(3, 2, 'open'), hatDy: 3, expr: 'blink', inst: { pic: -10 }, dx: 1 }),
        bare({ ...flat, armN: T(4, 1, 'open'), armF: T(3, 2, 'open'), hatDy: 3, expr: 'blink', inst: { pic: -10 }, hunch: 1 }),
      ],
      opts: { ticksPerFrame: 4 },
    },
    salute: {
      poses: [pr({ armN: T(4, -9, 'open'), expr: 'normal', inst: { pic: 0 } }), pr({ armN: T(4, -9, 'open'), lean: -26, expr: 'happy', inst: { pic: 0 } })],
      opts: { durations: [20, 40] },
    },
    confused: {
      poses: [pr({ armN: T(3, -10, 'point'), head: { tilt: -66 }, expr: 'dazed' }), pr({ armN: T(2, -11, 'point'), head: { tilt: -88 }, expr: 'blink' })],
      opts: { ticksPerFrame: 15 },
    },
    queue: {
      poses: [pr({ armN: T(12, -6), expr: 'happy', inst: { pic: 0, coin: true } }), pr({ armN: T(12, -5), expr: 'blink', inst: { pic: 0, coin: true } })],
      opts: { ticksPerFrame: 20 },
    },
    'photo-pose': {
      poses: [pr({ armN: T(9, -10, 'point'), head: { tilt: -86 }, lean: -28, expr: 'happy', inst: { pic: 0, vsign: true } })],
      opts: { ticksPerFrame: 30 },
    },
    ears: {
      poses: [
        bare({ armN: T(3, -8, 'open'), armF: T(5, -7, 'open'), expr: 'hurt', inst: { pic: undefined } }),
        bare({ armN: T(3, -7, 'open'), armF: T(5, -6, 'open'), expr: 'blink', hunch: 1 }),
      ],
      opts: { ticksPerFrame: 8 },
    },
    stumble: {
      poses: [pr({ head: { tilt: -50, dy: 1 }, expr: 'dazed' }), pr({ head: { tilt: -96 }, expr: 'dazed' })],
      opts: { durations: [12, 12] },
    },
    frozen: { frames: (st) => [iceBlock(render(st, pr({ expr: 'panic' })))], opts: { ticksPerFrame: 30 } },
    die: {
      poses: [
        bare({ lean: -40, head: { tilt: -100 }, armN: T(6, -6, 'open'), armF: T(4, -4, 'open'), expr: 'hurt', grounded: false, dy: -2 }),
        bare({ ...flat, armN: T(13, 2, 'open'), armF: T(11, 3, 'open'), expr: 'panic' }),
        bare({ ...flat, armN: T(14, 1, 'open'), armF: T(12, 2, 'open'), expr: 'panic', hunch: 1 }),
        bare({ ...flat, armN: T(13, 2, 'open'), armF: T(11, 3, 'open'), expr: 'hurt' }),
        bare({ ...flat, lean: 4, head: { tilt: -30 }, armN: T(10, 3, 'open'), armF: T(8, 4, 'open'), expr: 'dazed' }),
      ],
      style: hatless,
      opts: { durations: [6, 8, 8, 8, 30], loop: false },
    },
    'die-fall': {
      poses: [0, 1, 2, 3].map((k) => ({
        legN: L(30 + k * 10, 40),
        legF: L(-20, 30 + k * 10),
        armN: A(150 + k * 10, 20, 'open'),
        armF: A(190 - k * 10, 20, 'open'),
        rot: 90 + k * 90,
        grounded: false,
        expr: k % 2 === 0 ? ('panic' as const) : ('hurt' as const),
      })),
      style: hatless,
      opts: { ticksPerFrame: 5 },
    },
    'die-blast': {
      poses: [
        { legN: L(30, 60), legF: L(-30, 70), armN: A(150, 20, 'open'), armF: A(170, 20, 'open'), rot: 60, grounded: false, expr: 'soot' },
        { legN: L(70, 90), legF: L(10, 100), armN: A(140, 40, 'open'), armF: A(200, 30, 'open'), rot: 130, grounded: false, expr: 'soot' },
        { legN: L(40, 60), legF: L(-20, 60), armN: A(170, 10, 'open'), armF: A(150, 40, 'open'), rot: 160, grounded: false, expr: 'soot' },
        { legN: L(30, 60), legF: L(-20, 30), armN: A(150, 10, 'open'), armF: A(200, 10, 'open'), rot: 180, expr: 'soot' },
        { legN: L(-10, 30), legF: L(26, 70), armN: A(160, 10, 'open'), armF: A(190, 10, 'open'), rot: 176, expr: 'soot' },
        { legN: L(30, 60), legF: L(-20, 30), armN: A(150, 10, 'open'), armF: A(200, 10, 'open'), rot: 180, expr: 'soot' },
        { legN: L(-10, 30), legF: L(26, 70), armN: A(160, 10, 'open'), armF: A(190, 10, 'open'), rot: 176, expr: 'soot' },
      ],
      style: frazzled,
      post: (fs) => fs.map((f) => scorch(f, 2)),
      opts: { durations: [5, 5, 6, 7, 7, 7, 7], loop: false },
    },
    'die-burn': {
      frames: (st) => {
        const out: Frame[] = [];
        for (let i = 0; i < 4; i++) {
          const p = bare({ armN: T(8 + (i % 2) * 4, -4 - (i % 2) * 3, 'open'), armF: T(6, -2, 'open'), expr: 'panic', hunch: i % 2 });
          out.push(withFlames(scorch(render(st, p), 1), i * 2 + 1, 9));
        }
        const statue = sootify(render(st, bare({ ...flat, expr: 'soot', inst: { feather: false } })), 1, true, 9);
        out.push(withFlames(statue, 5, 12, 3), statue, crumble(statue, 0.4, 9), crumble(statue, 0.75, 9), crumble(statue, 1, 9));
        return out;
      },
      opts: { durations: [6, 6, 6, 6, 10, 14, 8, 8, 16], loop: false },
    },
    'die-knife': {
      poses: [
        bare({ lean: -30, armN: T(8, -4, 'open'), armF: T(8, 2, 'open'), expr: 'dazed' }),
        bare({ lean: -50, head: { tilt: -110 }, armN: T(6, -14, 'open'), armF: T(8, 2, 'open'), expr: 'shout' }),
        bare({ lean: -54, head: { tilt: -116 }, armN: T(5, -15, 'open'), armF: T(8, 2, 'open'), expr: 'shout', hunch: -1 }),
        bare({ lean: -10, head: { tilt: -60 }, armN: T(10, 0, 'open'), armF: T(8, 3, 'open'), expr: 'hurt' }),
        bare({ ...flat, lean: 6, head: { tilt: -20, dy: 1 }, armN: T(12, 3, 'open'), armF: T(10, 4, 'open'), expr: 'blink' }),
      ],
      style: hatless,
      opts: { durations: [8, 14, 16, 6, 30], loop: false },
    },
    'die-crush': {
      frames: (st) => {
        const f = render(st, pr({ expr: 'panic' }));
        return [pancake(f, 0.55, 1.15), pancake(f, 0.3, 1.3), pancake(f, 0.3, 1.3, 0.6), pancake(f, 0.28, 1.25, 0, 20), pancake(f, 0.28, 1.25, 0, -20)];
      },
      opts: { durations: [4, 30, 8, 10, 10], loop: false },
    },
    'die-shatter': {
      frames: (st) => {
        const f = render(st, pr({ expr: 'panic' }));
        return [iceBlock(f, 1), iceBlock(f, 2), iceCubes(9, 26, 3, 6), iceCubes(5, 22, 4, 0)];
      },
      opts: { durations: [4, 4, 10, 30], loop: false },
    },
    hat: {
      frames: (st) => {
        const b = hatWithFeather(st);
        return b ? hatFrames(b) : [{ buf: new PixelBuffer(1, 1), ox: 0, oy: 0 }];
      },
      opts: { ticksPerFrame: 5 },
    },
    'shatter-head': {
      frames: (st) => [headOnly(renderHuman(st, { armN: A(4, 10), armF: A(-4, 10), expr: 'panic' }, 'upper'))],
      opts: { ticksPerFrame: 30 },
    },
    dropped: {
      frames: () =>
        [0, 45, 90, 135].map((a) => {
          const p = drawShapes(piccoloShapes([0, 0], a, 18, 9), FRAME_BODY);
          return p ? { buf: p.buf, ox: -p.x, oy: -p.y } : { buf: new PixelBuffer(1, 1), ox: 0, oy: 0 };
        }),
      opts: { ticksPerFrame: 4 },
    },
  };
}

let table: Strips | null = null;

/** Every piccolo strip (built once, rendered per look). */
export function piccoloTable(): Strips {
  if (!table) {
    table = piccoloStrips();
    table.gag = table['gag-scales'];
    // Strips without the beret (it popped off) have no feather either.
    for (const [name, s] of Object.entries(table)) {
      if (!s.style || !s.poses) continue;
      table[name] = { ...s, poses: s.poses.map((p) => ({ ...p, inst: { ...(p.inst as Pic | undefined), feather: false } })) };
    }
  }
  return table;
}

/** Register one look (`enemy/piccolo…`). */
export function definePiccoloLook(prefix: string, outfit: Outfit, skin: Skin): void {
  if (skin !== 'a') {
    const base = ensureLook('piccolo', outfit, 'a');
    if (base) return defineSkinVariant(prefix, base, piccoloTable(), skin);
  }
  defineStrips(prefix, piccoloStyle(outfit), PICCOLO_ART, piccoloTable());
}

registerLookDefiner('piccolo', definePiccoloLook);

// ---------------------------------------------------------------------------------------------
// The piccolo-rifle drawn by the game while he aims (32 directions, anchored at the grip)
// ---------------------------------------------------------------------------------------------

/** Frame `i` of `enemy/piccolo-rifle`: frame 0 points right, clockwise, 11.25° steps. */
export function piccoloRifleFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 32; i++) {
    const p = drawShapes(piccoloShapes([0, 0], i * 11.25, 19, 4), FRAME_BODY);
    out.push(p ? { buf: p.buf, ox: -p.x, oy: -p.y } : { buf: new PixelBuffer(1, 1), ox: 0, oy: 0 });
  }
  return out;
}
