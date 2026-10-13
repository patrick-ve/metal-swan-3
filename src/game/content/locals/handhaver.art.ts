/**
 * `enemy/handhaver…` — the city enforcement officer (docs/design/amsterdam.md §2): navy uniform
 * and cap, a yellow hi-vis vest with silver bands, a radio, a ticket book. Sets for the three
 * skin tones: `enemy/handhaver` (a), `enemy/handhaver-b`, `enemy/handhaver-c`.
 *
 * Strips: idle (2), walk (8), alert (1), tell (3: opens the book, licks the pencil, writes),
 * throw (3: the flick), photo-pose (1), die (6: swoons), die-knife, die-blast, die-burn,
 * die-crush. `enemy/boete-ticket/fly` (4: the fluttering ticket, centre anchor).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { withPieces } from '../../art/human-fx';
import { blastFrames, burnFrames } from '../../art/human-sprites';
import { renderHuman, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { CRUSH_TIMING, crushStrip } from '../creatures/draw';

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

/** A figure with the book in the far hand (in front of the chest) when `bookOpen` is set. */
function officer(style: HumanStyle, pose: Pose, bookAt: 'none' | 'shut' | 'open'): Frame {
  const f = renderHuman(style, { weapon: 'none', ...pose }, 'full');
  if (bookAt === 'none') return f;
  const hip = f.pts?.hip ?? [0, -15];
  const bk = book(bookAt === 'open');
  return withPieces(f, [{ buf: bk, x: hip[0] + (bookAt === 'open' ? 3 : 5), y: hip[1] - (bookAt === 'open' ? 9 : 5) }]);
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

/** Register one officer set (`enemy/<set>/…`). */
function defineOfficer(set: string, style: HumanStyle): void {
  const pre = `enemy/${set}/`;
  const o = { trim: true };
  defineSprite(pre + 'idle', () => P.BREATH.map((b) => officer(style, { ...P.STAND, ...b, armF: HOLD }, 'shut')), { ...o, ticksPerFrame: 24 });
  defineSprite(pre + 'walk', () => P.WALK.map((w) => officer(style, { ...w, armF: HOLD }, 'shut')), { ...o, ticksPerFrame: 6 });
  defineSprite(pre + 'alert', () => [officer(style, { ...P.STAND, armF: HOLD, armN: A(150, 20, 'point'), expr: 'shout' }, 'shut')], { ...o, ticksPerFrame: 30 });
  defineSprite(pre + 'tell', () => TELL.map((p) => officer(style, p, 'open')), { ...o, durations: [8, 8, 9999] });
  defineSprite(pre + 'throw', () => THROW.map((p) => officer(style, p, 'open')), { ...o, durations: [3, 5, 9999], loop: false });
  defineSprite(pre + 'photo-pose', () => [officer(style, { ...P.STAND, armN: A(160, 30, 'open'), armF: HOLD, expr: 'happy' }, 'shut')], o);
  const swoon: readonly Pose[] = [
    { ...P.STAND, armN: A(170, 30, 'open'), armF: A(-20, 40, 'open'), head: { tilt: -10 }, expr: 'dazed' },
    { ...P.STAND, armN: A(160, 50, 'open'), armF: A(30, 20, 'open'), lean: -10, expr: 'dazed' },
    ...P.DIE.slice(2).map((p) => ({ ...p, expr: 'dazed' as const })),
  ];
  defineSprite(pre + 'die', () => swoon.map((p) => officer(style, { ...p, hat: false }, 'none')), { ...o, durations: [8, 8, 6, 8, 8, 30], loop: false });
  defineSprite(pre + 'die-knife', () => P.DIE_KNIFE.map((p) => officer(style, { ...p, hat: false }, 'none')), { ...o, durations: [8, 6, 6, 6, 30], loop: false });
  defineSprite(pre + 'die-blast', () => blastFrames(style, { hat: false, weapon: 'none' }), { ...o, durations: [5, 5, 5, 5, 30], loop: false });
  defineSprite(pre + 'die-burn', () => burnFrames(style, { weapon: 'none' }), { ...o, ticksPerFrame: 6, loop: false });
  defineSprite(pre + 'die-crush', () => crushStrip(renderHuman(style, { weapon: 'none', ...P.STAND }, 'full')), { durations: CRUSH_TIMING, loop: false });
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
defineSprite('enemy/boete-ticket/fly', ticketFrames, { ticksPerFrame: 4 });
