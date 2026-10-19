/**
 * `enemy/handhaver…` — the city enforcement officer (docs/design/amsterdam.md §2): navy uniform
 * and cap, a yellow hi-vis vest with silver bands, a radio, a ticket book. Sets for the three
 * skin tones: `enemy/handhaver` (a), `enemy/handhaver-b`, `enemy/handhaver-c`.
 *
 * Strips: idle (4: breathing), walk (8, the free arm swings against the legs), turn (2: the
 * idle frame squeezed by turnSquash; the Turner in handhaver.ts plays it narrowing, flips, then
 * widening), alert (1), tell (3: opens the book, licks the pencil, writes),
 * throw (5: the flick at frame 1, then a 2-frame recover that eases the arm down), photo-pose (1), die (6: swoons), die-knife, die-blast, die-burn,
 * die-crush. `enemy/boete-ticket/fly` (4: the fluttering ticket, centre anchor).
 *
 * 2× art (mission ams): every strip is registered again at density 2 (the rig at 2×, the ticket
 * book and the ticket redrawn on the 2× grid; docs/ART_GUIDE.md "2x art (mission ams)").
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../engine/sprites';
import { HI, outlineHi } from '../../art/hi';
import { withPieces, type Piece } from '../../art/human-fx';
import { blastFrames, burnFrames, withSwing } from '../../art/human-sprites';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { CRUSH_TIMING, crushStrip, turnSquash } from '../creatures/draw';
import { tween } from '../../art/tween';
import { crushStripHi } from '../../art/hi-strips';

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
 * The 2× ticket book (the same 7×8 / 11×8 logical box as `book` with its outline): a navy cover
 * with a lit edge, the page block and an elastic band; open, two ruled pages, a red BOETE header
 * on the left page and a half-written ticket on the right one.
 */
function bookHi(open: boolean): PixelBuffer {
  const w = (open ? 9 : 5) * HI;
  const h = 6 * HI;
  const b = new PixelBuffer(w, h);
  const N = PAL.navy;
  if (open) {
    b.rect(0, 0, w, h, N[1]);
    b.hline(0, w - 1, 0, N[2]);
    b.vline(0, 0, h - 1, N[2]);
    b.hline(0, w - 1, h - 1, N[0]);
    // Pages (2 logical px of cover round them, the spine in the middle).
    for (const x0 of [2, 10]) {
      b.rect(x0, 2, 6, 8, PAL.snow[3]);
      b.vline(x0 + 5, 2, 9, PAL.snow[2]);
      b.hline(x0, x0 + 5, 9, PAL.snow[1]);
    }
    b.vline(8, 1, h - 2, N[0]);
    b.vline(9, 1, h - 2, N[2]);
    // Left page: red header, ruled lines.
    b.hline(3, 6, 3, PAL.red[2]);
    for (const y of [5, 7]) b.hline(3, 6, y, PAL.steel[3]);
    // Right page: a half-written ticket (dark scribbles on the rules) and a red total.
    b.hline(11, 14, 4, PAL.steel[2]);
    b.hline(11, 13, 6, PAL.steel[2]);
    b.hline(13, 14, 8, PAL.red[2]);
  } else {
    b.rect(0, 0, w, h, N[1]);
    b.hline(0, w - 2, 0, N[2]);
    b.vline(0, 0, h - 2, N[2]);
    b.hline(1, w - 1, h - 1, N[0]);
    // The page block on the right edge (two 1-px leaves) and the elastic band.
    b.vline(w - 2, 1, h - 3, PAL.snow[3]);
    b.vline(w - 1, 1, h - 3, PAL.snow[1]);
    for (let y = 2; y < h - 3; y += 2) b.set(w - 1, y, PAL.steel[3]);
    b.vline(6, 0, h - 1, PAL.black[1]);
    // A small gold city crest on the cover.
    b.set(2, 3, PAL.gold[3]);
    b.set(3, 3, PAL.gold[2]);
    b.set(2, 4, PAL.gold[2]);
    b.set(3, 4, PAL.gold[1]);
    b.hline(2, 3, 7, PAL.cloth[1]);
  }
  return outlineHi(b.padded(HI), 2);
}

/** A figure with the book in the far hand (in front of the chest) when `bookOpen` is set. */
function officer(style: HumanStyle, pose: Pose, bookAt: 'none' | 'shut' | 'open', d: Density = 1): Frame {
  const f = renderHuman(style, { weapon: 'none', ...pose }, 'full', d);
  if (bookAt === 'none') return f;
  const hip = f.pts?.hip ?? [0, -15];
  const open = bookAt === 'open';
  const at = { x: hip[0] + (open ? 3 : 5), y: hip[1] - (open ? 9 : 5) };
  const piece: Piece = d === 1 ? { buf: book(open), ...at } : { buf: bookHi(open), ...at, density: HI };
  return withPieces(f, [piece]);
}

const A = (sh: number, el: number, hand: 'fist' | 'open' | 'point' = 'fist') => ({ sh, el, hand });
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

/** Walk with the free (near) arm swinging against the legs; the far hand keeps the book. */
export const WALK_SWING: readonly Pose[] = withSwing(P.WALK, 0.6, 24);

/** Register a strip at 1× and its 2× twin (the same recipe at density 2). */
function defHi(id: string, gen: (d: Density) => Frame[], o: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...o, hi: () => gen(2) });
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
  const swoon: readonly Pose[] = [
    { ...P.STAND, armN: A(170, 30, 'open'), armF: A(-20, 40, 'open'), head: { tilt: -10 }, expr: 'dazed' },
    { ...P.STAND, armN: A(160, 50, 'open'), armF: A(30, 20, 'open'), lean: -10, expr: 'dazed' },
    ...P.DIE.slice(2).map((p) => ({ ...p, expr: 'dazed' as const })),
  ];
  // At 2× the swoon hand goes to the forehead (back of the hand above the brow): the 1× arm
  // straight up across the face smears the finer 2× face. The 2× frame keeps the 1× points.
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
  defHi(pre + 'die-burn', (d) => burnFrames(style, { weapon: 'none' }, 9, d), { ...o, ticksPerFrame: 6, loop: false });
  const stand = (d: Density): Frame => renderHuman(style, { weapon: 'none', ...P.STAND }, 'full', d);
  defineSprite(pre + 'die-crush', () => crushStrip(stand(1)), {
    durations: CRUSH_TIMING,
    loop: false,
    hi: () => crushStripHi(stand(1), stand(2), getFrames(pre + 'die-crush', 1)),
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
 * The 2× ticket (same logical boxes as `ticketFrames`): a paper slip with a red header band, ruled
 * lines of fine print, a red stamp and a curled corner. No letters: the ticket is drawn mirrored
 * when it flies left, so the print stays an abstract (mirror-safe) pattern.
 */
function ticketFramesHi(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const w = i === 1 || i === 3 ? 8 : 9;
    const h = i === 2 ? 4 : 6;
    const W = w * HI;
    const H = h * HI;
    const b = new PixelBuffer(W, H);
    b.rect(0, 0, W, H, PAL.snow[3]);
    b.vline(W - 1, 0, H - 1, PAL.snow[2]);
    b.hline(0, W - 1, H - 1, PAL.snow[2]);
    // Red header band with a white rule through it (the title, abstracted).
    b.rect(2, 2, W - 4, 2, PAL.red[2]);
    b.hline(2, W - 3, 2, PAL.red[3]);
    for (let x = 3; x < W - 3; x += 3) b.set(x, 3, PAL.red[1]);
    if (h > 4) {
      // Fine print: two dashed rules, a red stamp on the right.
      for (let x = 2; x < W - 6; x++) if (x % 4 !== 1) b.set(x, 6, PAL.steel[2]);
      for (let x = 2; x < W - 7; x++) if (x % 5 !== 3) b.set(x, 8, PAL.steel[3]);
      b.rect(W - 5, 6, 3, 3, PAL.red[2]);
      b.set(W - 4, 7, PAL.snow[3]);
    } else {
      for (let x = 2; x < W - 3; x++) if (x % 4 !== 1) b.set(x, 5, PAL.steel[2]);
    }
    // A curled corner (bottom right).
    b.set(W - 1, H - 1, 0);
    b.set(W - 2, H - 1, PAL.snow[1]);
    b.set(W - 1, H - 2, PAL.snow[1]);
    b.set(W - 2, H - 2, PAL.steel[3]);
    const t = outlineHi(b.padded(HI), 2);
    return { buf: i === 3 ? t.flipped(false, true) : t, ox: (w + 2) >> 1, oy: (h + 2) >> 1, density: HI };
  });
}
defineSprite('enemy/boete-ticket/fly', ticketFrames, { ticksPerFrame: 4, hi: ticketFramesHi });
