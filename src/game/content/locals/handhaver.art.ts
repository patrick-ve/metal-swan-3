/**
 * `enemy/handhaver…` — the city enforcement officer (docs/design/amsterdam.md §2): navy uniform
 * and cap, a yellow hi-vis vest with silver bands, a radio, a ticket book. Sets for the three
 * skin tones: `enemy/handhaver` (a), `enemy/handhaver-b`, `enemy/handhaver-c`.
 *
 * Strips: idle (4: breathing), walk (8, the free arm swings against the legs), turn (2: the
 * idle frame squeezed by turnSquash; the Turner in handhaver.ts plays it narrowing, flips, then
 * widening), alert (1), tell (3: opens the book, licks the pencil, writes),
 * throw (5: the flick at frame 1, then a 2-frame recover that eases the arm down), photo-pose (1), die (6: swoons), die-knife, die-blast, die-burn,
 * die-crush, and the continue reactions (deferred): gloat (5, frames picked by the game: writes in
 * the open book ×2, tears the page off and holds it up, lets it go, stands back with the book shut)
 * and cower (2: knees bent, an arm over the cap, trembling). `enemy/boete-ticket/fly` (4: the
 * fluttering ticket, centre anchor).
 *
 * UHD art (mission ams; docs/ART_GUIDE.md "UHD art"): every strip has one density-generic
 * generator for 2× and 4× (`hd`): the officer is the HD rig (`renderHuman(…, d)`: navy uniform,
 * cap, hi-vis vest with silver bands), the ticket book and the ticket are drawn natively here.
 */
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, getFrames, type DenseDensity as HdD, type SpriteOpts } from '../../../engine/sprites';
import { BLACK_ONE_HUE, HdCanvas } from '../../art/hd';
import { withPieces, type Piece } from '../../art/human-fx';
import { blastFrames, burnFrames, withSwing } from '../../art/human-sprites';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { CRUSH_TIMING, crushStrip, turnSquash } from '../creatures/draw';
import { tween } from '../../art/tween';
import { crushStripHi } from '../../art/hi-strips';
import { onBoxes } from './rider.hd';

const frac = (v: number): number => v - Math.floor(v);

export const HANDHAVER_STYLE: HumanStyle = {
  skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'cap', gear: 'navy', accent: 'gold',
  top: 'gold', topType: 'vest', shirt: 'navy', pants: 'navy', boots: 'black', belt: 'black',
  accessories: ['hivis'], build: 'normal',
};

/** The ticket book: a navy cover, white pages (open: two pages with lines). */
function book(open: boolean): PixelBuffer {
  const b = new PixelBuffer(open ? 9 : 5, 6);
  if (open) {
    b.rect(0, 0, 9, 6, PAL.navy[1]);
    b.rect(1, 1, 3, 4, PAL.snow[3]);
    b.rect(5, 1, 3, 4, PAL.snow[3]);
    b.hline(1, 3, 2, PAL.steel[2]);
    b.hline(5, 7, 2, PAL.steel[2]);
    b.hline(5, 6, 4, PAL.red[2]);
  } else {
    b.rect(0, 0, 5, 6, PAL.navy[1]);
    b.vline(4, 1, 4, PAL.snow[3]);
  }
  return b.padded(1).outline(INK);
}

/**
 * The HD ticket book at density d (the 7 × 8 / 11 × 8 logical box of `book` with its outline): a
 * navy board cover with a lit bevel and a small gold city crest, the page block and the black
 * elastic band (shut); open, two gently curved pages over the cover with a spine shadow, a red
 * header and ruled lines on the left page, a half-written ticket with a red total on the right
 * (the fine print at 4×).
 */
function bookHd(open: boolean, d: HdD): PixelBuffer {
  const w = open ? 11 : 7;
  const c = new HdCanvas(w, 8, d);
  const cover = c.material({ ramp: PAL_HD.navy, lo: 1, hi: 4, spec: 0.35, shine: 16, wrap: 0.05 });
  const paper = c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.1, wrap: 0.15 });
  const band = c.material({ ramp: BLACK_ONE_HUE, lo: 1, hi: 4, spec: 0.4, shine: 14 });
  if (open) {
    c.box(1, 1, 9, 6, { mat: cover, z: 0, r: 0.4, bevel: 0.45 });
    for (const [x0, side] of [[1.55, -1], [5.45, 1]] as const) {
      c.box(x0, 1.5, 4, 5, {
        mat: paper,
        z: 0.6,
        tex: (t) => {
          // Each page bows up from the spine: the normal leans away from it.
          const u = side < 0 ? 1 - t.u : t.u;
          t.nx = side * (0.55 - u) * 0.9;
          t.nz = 1;
          if (u < 0.12) t.tone -= 0.3;
          if (d === 4 && t.v > 0.25 && t.v < 0.9 && frac(t.v * 6.5) < 0.12) t.tone -= 0.12;
        },
      });
    }
    // Left page: the red header; right page: the scribbled ticket and a red total.
    c.paint(2, 2.1, 3, 0.6, (x) => (x < 4.6 ? PAL_HD.red[5] : 0));
    c.paint(6.3, 2.4, 3.2, 3.6, (x, y) => {
      const row = Math.floor((y - 2.4) / 0.9);
      const v = frac((y - 2.4) / 0.9);
      if (row > 2 || v > (d === 4 ? 0.28 : 0.5)) return 0;
      if (row === 2) return x > 7.9 && x < 9.2 ? PAL_HD.red[5] : 0;
      const end = row === 0 ? 9.2 : 8.4;
      if (x > end) return 0;
      return d === 4 && frac(x * 2.2 + row * 0.4) < 0.25 ? 0 : PAL_HD.navy[3];
    });
  } else {
    c.box(1, 1, 5, 6, { mat: cover, z: 0, r: 0.4, bevel: 0.5 });
    c.box(4.75, 1.55, 1.1, 4.9, { mat: paper, z: 0.4, r: 0.15, tex: d === 4 ? (t) => {
      if (frac(t.x * 3) < 0.3) t.tone -= 0.18;
    } : null });
    c.capsule(3.55, 1.1, 3.55, 6.9, 0.32, 0.32, { mat: band, z: 1 });
    // The gold city crest: a small shield.
    c.paint(1.8, 2.6, 1.4, 1.8, (x, y) => {
      const u = Math.abs(x - 2.5);
      if (y < 2.8 || y > 4.3 - u * 0.9 || u > 0.6) return 0;
      return x < 2.5 ? PAL_HD.gold[6] : PAL_HD.gold[4];
    });
  }
  return c.render({ outline: 'A', ao: 0.25, rimLight: 2 });
}

/**
 * A figure with the book in the far hand (in front of the chest) when `bookAt` is set; `under`:
 * the book under the hands (the pencil hand writes on its page).
 */
function officer(style: HumanStyle, pose: Pose, bookAt: 'none' | 'shut' | 'open', d: Density = 1, under = false): Frame {
  const f = renderHuman(style, { weapon: 'none', ...pose }, 'full', d);
  if (bookAt === 'none') return f;
  const hip = f.pts?.hip ?? [0, -15];
  const open = bookAt === 'open';
  const at = { x: hip[0] + (open ? 3 : 5), y: hip[1] - (open ? 9 : 5) };
  const piece: Piece = d === 1 ? { buf: book(open), ...at } : { buf: bookHd(open, d), ...at, density: d };
  if (under) piece.behind = true;
  return withPieces(f, [piece]);
}

const A = (sh: number, el: number, hand: 'fist' | 'open' | 'point' = 'fist') => ({ sh, el, hand });

/** The pencil in the writing fist: a short stick from the fist down onto the page (no outline: it lies inside the figure). */
function pencil(): PixelBuffer {
  const b = new PixelBuffer(3, 3);
  b.set(0, 0, PAL.gold[3]);
  b.set(1, 1, PAL.gold[2]);
  b.set(2, 2, PAL.black[1]);
  return b;
}

/** The HD pencil (the 1× 3 × 3 box): a lit yellow hexagonal stick, a pale wood cone and the graphite tip. */
function pencilHd(d: HdD): PixelBuffer {
  const c = new HdCanvas(3, 3, d);
  const wood = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.4, shine: 14 });
  const lead = c.material({ ramp: BLACK_ONE_HUE, lo: 1, hi: 4, spec: 0.5, shine: 16 });
  c.capsule(0.5, 0.5, 2, 2, 0.42, 0.36, { mat: wood, z: 0 });
  c.capsule(2.1, 2.1, 2.55, 2.55, 0.3, 0.15, { mat: lead, z: 0.2 });
  return c.render({ outline: 'none', ao: 0 });
}

/** Add the pencil to the writing fist (its tip toward the page, forward and down). */
function withPencil(f: Frame, on: boolean): Frame {
  if (!on) return f;
  const hand = f.pts?.hand ?? [6, -20];
  const d = f.density ?? 1;
  const at = { x: Math.round(hand[0]) + 1, y: Math.round(hand[1]) };
  const piece: Piece = d === 1 ? { buf: pencil(), ...at } : { buf: pencilHd(d as HdD), ...at, density: d };
  return withPieces(f, [piece]);
}

/** The torn-off page held up in the near hand (the BOETE ticket, held up by its lower edge). */
function withPage(f: Frame, page: boolean): Frame {
  if (!page) return f;
  const hand = f.pts?.hand ?? [8, -26];
  const d = f.density ?? 1;
  const at = { x: Math.round(hand[0]) - 3, y: Math.round(hand[1]) - 7 };
  const piece: Piece = d === 1 ? { buf: ticketFrames()[0].buf, ...at } : { buf: ticketFramesHd(d as HdD)[0].buf, ...at, density: d };
  return withPieces(f, [piece]);
}
const HOLD = { to: [7, 9] as const, hand: 'fist' as const };

const TELL: readonly Pose[] = [
  { ...P.STAND, armF: HOLD, armN: A(40, 80), expr: 'normal' },
  { ...P.STAND, armF: HOLD, armN: { to: [4, -4], hand: 'fist' }, head: { tilt: 6 }, expr: 'chew' },
  { ...P.STAND, armF: HOLD, armN: { to: [8, 6], hand: 'point' }, head: { tilt: 10 }, expr: 'normal' },
];
const THROW: readonly Pose[] = [
  { ...P.STAND, armF: HOLD, armN: A(-120, 70, 'open'), lean: -6, expr: 'shout' },
  { ...P.STAND, armF: HOLD, armN: { to: [10, -6], hand: 'open' }, lean: 8, expr: 'shout' },
  { ...P.STAND, armF: HOLD, armN: A(60, 20, 'open'), lean: 4, expr: 'happy' },
];
/** Throw recover (2 frames after the follow-through): the arm eases down to the side, the back straightens. */
const THROW_REST: Pose = { ...P.STAND, armF: HOLD, armN: A(10, 30, 'fist'), expr: 'normal' };
export const THROW_ALL = (s: HumanStyle): Pose[] => tween(s, [...THROW, THROW_REST], { perKey: [0, 0, 1], ease: 'out' });
/** Ticks per throw frame: the release keeps its timing (3, then the flick 5); recover 4 + 4 + 4. */
export const HANDHAVER_THROW_TIMING: readonly number[] = [3, 5, 4, 4, 4];
/** Ticks per walk frame at the nominal walk speed (Animator rate = strideRate). */
export const HANDHAVER_WALK_TPF = 6;

/**
 * Continue reactions. The gloat (docs/design/ams-extras.md §1; the game picks the frame by its
 * phase, handhaver.ts `GLOAT_FRAME`: write, write2, tear, drop, done — keep this order): he
 * writes the fine in the open book (the fist with the pencil on the page, the head bent over it;
 * frame 2 the pencil moved on and a blink), tears the page off and holds it up beside his cap,
 * lets it go (the hand open, palm down: it flutters onto the spot as a `GloatPage`), then stands
 * back, the book shut at his chest, the free hand at his belt, the chin up. Never a point or a
 * laugh.
 */
const GLOAT: readonly { pose: Pose; book: 'shut' | 'open'; under?: boolean; page?: boolean; pencil?: boolean }[] = [
  { pose: { ...P.STAND, armF: HOLD, armN: { to: [6, 2], hand: 'fist' }, head: { tilt: 14 }, expr: 'normal' }, book: 'open', under: true, pencil: true },
  { pose: { ...P.STAND, armF: HOLD, armN: { to: [8, 3], hand: 'fist' }, head: { tilt: 16 }, expr: 'blink' }, book: 'open', under: true, pencil: true },
  { pose: { ...P.STAND, armF: HOLD, armN: { to: [9, -6], hand: 'fist' }, lean: -2, head: { tilt: -4 }, expr: 'normal' }, book: 'open', page: true },
  { pose: { ...P.STAND, armF: HOLD, armN: { to: [11, 1], hand: 'open' }, lean: 2, head: { tilt: 6 }, expr: 'normal' }, book: 'shut' },
  { pose: { ...P.STAND, armF: HOLD, armN: A(14, 70, 'fist'), lean: -3, head: { tilt: -8 }, expr: 'normal' }, book: 'shut' },
];
/**
 * Cower: knees bent low, both hands clamped over the cap, panicking; frame 2 trembles (the upper
 * body sways 1 px forward). The book goes into a pocket: both hands are busy.
 */
const COWER: readonly Pose[] = [0, 1].map((k): Pose => ({
  legN: { hip: 72, knee: 104 },
  legF: { hip: 30, knee: 108 },
  lean: 8 + k * 8,
  hunch: 1,
  armN: { to: [1, -9], hand: 'open' },
  armF: { to: [2, -8], hand: 'open' },
  head: { dy: 1, tilt: 10 },
  expr: 'panic',
}));
/** Gloat timing (the frames' own durations; the game holds each frame as long as its phase). */
export const HANDHAVER_GLOAT_TIMING: readonly number[] = [8, 8, 10, 12, 60];
/** Ticks per frame of the cower (it loops). */
export const HANDHAVER_COWER_TPF = 3;

/** Walk with the free (near) arm swinging against the legs; the far hand keeps the book. */
export const WALK_SWING: readonly Pose[] = withSwing(P.WALK, 0.6, 24);

/** Register a strip at 1× and its UHD art (the same recipe at density 2 and 4). */
function defHi(id: string, gen: (d: Density) => Frame[], o: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d) });
}

/** Register one officer set (`enemy/<set>/…`). */
function defineOfficer(set: string, style: HumanStyle): void {
  const pre = `enemy/${set}/`;
  const o = { trim: true };
  const idle = (d: Density): Frame => officer(style, { ...P.STAND, armF: HOLD }, 'shut', d);
  defHi(pre + 'idle', (d) => P.BREATH4.map((b) => officer(style, { ...P.STAND, ...b, armF: HOLD }, 'shut', d)), { ...o, ticksPerFrame: 12 });
  defHi(pre + 'walk', (d) => WALK_SWING.map((w) => officer(style, { ...w, armF: HOLD }, 'shut', d)), { ...o, ticksPerFrame: HANDHAVER_WALK_TPF });
  defHi(pre + 'turn', (d) => turnSquash(idle(d)), { ...o, ticksPerFrame: 2 });
  defHi(pre + 'alert', (d) => [officer(style, { ...P.STAND, armF: HOLD, armN: A(150, 20, 'point'), expr: 'shout' }, 'shut', d)], { ...o, ticksPerFrame: 30 });
  defHi(pre + 'tell', (d) => TELL.map((p) => officer(style, p, 'open', d)), { ...o, durations: [8, 8, 9999] });
  defHi(pre + 'throw', (d) => THROW_ALL(style).map((p, i) => officer(style, p, i < 3 ? 'open' : 'shut', d)), { ...o, durations: HANDHAVER_THROW_TIMING, loop: false });
  defHi(pre + 'photo-pose', (d) => [officer(style, { ...P.STAND, armN: A(160, 30, 'open'), armF: HOLD, expr: 'happy' }, 'shut', d)], o);
  // Continue reactions (rare: deferred; they show only around a continue).
  defHi(pre + 'gloat', (d) => GLOAT.map((g) => withPencil(withPage(officer(style, g.pose, g.book, d, g.under === true), g.page === true), g.pencil === true)), { ...o, durations: HANDHAVER_GLOAT_TIMING, loop: false, defer: true });
  defHi(pre + 'cower', (d) => COWER.map((p) => officer(style, p, 'none', d)), { ...o, ticksPerFrame: HANDHAVER_COWER_TPF, defer: true });
  const swoon: readonly Pose[] = [
    { ...P.STAND, armN: A(170, 30, 'open'), armF: A(-20, 40, 'open'), head: { tilt: -10 }, expr: 'dazed' },
    { ...P.STAND, armN: A(160, 50, 'open'), armF: A(30, 20, 'open'), lean: -10, expr: 'dazed' },
    ...P.DIE.slice(2).map((p) => ({ ...p, expr: 'dazed' as const })),
  ];
  // At 2× / 4× the swoon hand goes to the forehead (back of the hand above the brow): the 1× arm
  // straight up across the face smears the finer HD face. The HD frame keeps the 1× points.
  const swoonHi: readonly Pose[] = [
    { ...swoon[0], armN: { to: [5, -9], hand: 'open' } },
    { ...swoon[1], armN: { to: [5, -10], hand: 'open' } },
  ];
  defHi(pre + 'die', (d) => swoon.map((p, i) => {
    if (d === 1 || i >= swoonHi.length) return officer(style, { ...p, hat: false }, 'none', d);
    const f = officer(style, { ...swoonHi[i], hat: false }, 'none', d);
    return { ...f, pts: officer(style, { ...p, hat: false }, 'none', 1).pts };
  }), { ...o, durations: [8, 8, 6, 8, 8, 30], loop: false });
  defHi(pre + 'die-knife', (d) => P.DIE_KNIFE.map((p) => officer(style, { ...p, hat: false }, 'none', d)), { ...o, durations: [8, 6, 6, 6, 30], loop: false });
  defHi(pre + 'die-blast', (d) => blastFrames(style, { hat: false, weapon: 'none' }, d), { ...o, durations: [5, 5, 5, 5, 30], loop: false });
  // HD flames may reach a few art px past the trimmed 1× box: cut them to it here (geometry is law).
  defHi(pre + 'die-burn', (d) => (d === 1 ? burnFrames(style, { weapon: 'none' }, 9, 1) : onBoxes(burnFrames(style, { weapon: 'none' }, 9, d), getFrames(pre + 'die-burn', 1), d)), { ...o, ticksPerFrame: 6, loop: false });
  const stand = (d: Density): Frame => renderHuman(style, { weapon: 'none', ...P.STAND }, 'full', d);
  defineSprite(pre + 'die-crush', () => crushStrip(stand(1)), {
    durations: CRUSH_TIMING,
    loop: false,
    hd: (d) => crushStripHi(stand(1), stand(d), getFrames(pre + 'die-crush', 1)),
  });
}

defineOfficer('handhaver', HANDHAVER_STYLE);
defineOfficer('handhaver-b', { ...HANDHAVER_STYLE, skin: 'skinB', hair: 'hairA' });
defineOfficer('handhaver-c', { ...HANDHAVER_STYLE, skin: 'skinC', hair: 'hairA', hairStyle: 'curly' });

/** The fluttering BOETE ticket: white paper, red title marks, tilting as it flies. */
function ticketFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const w = i === 1 || i === 3 ? 8 : 9;
    const h = i === 2 ? 4 : 6;
    const b = new PixelBuffer(w, h);
    b.rect(0, 0, w, h, PAL.snow[3]);
    b.hline(1, w - 2, 1, PAL.red[2]);
    if (h > 4) b.hline(1, w - 3, 3, PAL.steel[2]);
    b.set(w - 1, h - 1, PAL.snow[1]);
    const t = b.padded(1).outline(INK);
    return { buf: i === 3 ? t.flipped(false, true) : t, ox: (w + 2) >> 1, oy: (h + 2) >> 1 };
  });
}

/**
 * The HD BOETE ticket (the logical boxes of `ticketFrames`, density d): a paper slip bowed as it
 * flutters, a red header band with a white rule, ruled lines of fine print and a red stamp ring
 * (4×: dashed print and a double ring), a curled corner. No letters: the ticket is drawn
 * mirrored when it flies left, so the print stays an abstract (mirror-safe) pattern.
 */
function ticketFramesHd(d: HdD): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const w = i === 1 || i === 3 ? 8 : 9;
    const h = i === 2 ? 4 : 6;
    const c = new HdCanvas(w + 2, h + 2, d);
    const paper = c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.15, shine: 10, wrap: 0.15 });
    const bow = [0.5, -0.4, 0.2, -0.5][i];
    c.box(1, 1, w, h, {
      mat: paper,
      z: 0,
      tex: (t) => {
        t.nx = (t.u - 0.5) * bow;
        t.ny = (t.v - 0.5) * 0.25;
        t.nz = 1;
        // The curled corner (bottom right): its back faces away from the light.
        if (t.u + t.v > 1.72) {
          t.tone -= 0.35;
          t.nx = 0.5;
          t.ny = 0.5;
        }
      },
    });
    c.erase(w - 0.2, h - 0.2, 1.4, 1.4, (x, y) => x + y > w + h + 1.4);
    c.paint(1.6, 1.6, w - 1.2, 1.1, (x, y) => {
      if (d === 4 && Math.abs(y - 2.15) < 0.12 && x > 2.2 && x < w - 0.4) return PAL_HD.snow[6];
      return PAL_HD.red[5];
    });
    if (h > 4) {
      c.paint(1.8, 3.4, w - 3.4, 2.4, (x, y) => {
        const v = frac((y - 3.4) / 0.95);
        if (v > (d === 4 ? 0.26 : 0.5)) return 0;
        if (y > 4.35 && x > w - 2.6) return 0;
        return d === 4 && frac(x * 1.7) < 0.22 ? 0 : PAL_HD.steel[3];
      });
      const sx = w - 1.1;
      const sy = 4.4;
      c.paint(sx - 1, sy - 1, 2, 2, (x, y) => {
        const q = Math.hypot(x - sx, y - sy);
        if (d === 2) return q < 0.75 ? PAL_HD.red[5] : 0;
        if (q < 0.85 && q > 0.55) return PAL_HD.red[5];
        return q < 0.25 ? PAL_HD.red[4] : 0;
      });
    } else {
      c.paint(1.8, 3.6, w - 2.4, 0.6, (x) => (d === 4 && frac(x * 1.7) < 0.22 ? 0 : PAL_HD.steel[3]));
    }
    const b = c.render({ outline: 'A', ao: 0, rimLight: 2 });
    return { buf: i === 3 ? b.flipped(false, true) : b, ox: (w + 2) >> 1, oy: (h + 2) >> 1, density: d };
  });
}
defineSprite('enemy/boete-ticket/fly', ticketFrames, { ticksPerFrame: 4, hd: (d) => ticketFramesHd(d) });
