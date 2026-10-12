/**
 * `pipe-battery` art (`machine/pipe-battery/…`): an original wall emplacement of five brass organ
 * pipes (each with its flue mouth and a crimson band) standing in a crimson wind chest with a gold
 * rail, rivets, bunting and the Legion crest. Every strip uses the bottom-centre (feet) anchor, so
 * the pipes and the chest stack; the pipes are drawn first, the chest over their feet.
 *
 * Strips: `pipe-0` … `pipe-4` (3f: whole, dented ≤ 50 %, broken stub), `body` (the chest),
 * `wreck` (the burnt chest with five bent stubs), `rocket` (2f, centre: a brass eighth-note
 * rocket climbing on a flame), `rocket-down` (2f, centre: the note falling head-first, whistling),
 * `shadow` (5f, centre: the growing ground shadow under a falling note-rocket).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { damage, rivet } from '../../../art/machines';
import { bayer, Composer, shadeLayer } from '../../../art/paint';
import { PIPES, pipeRect } from './geom';
import { bunting, crest, fr, PENNANTS_ON_RED } from './kit.art';

const ART = 'machine/pipe-battery';

const W = 70;
const H = 70;
const OX = 35;
const OY = 68;
const X = (dx: number): number => OX + dx;
const Y = (dy: number): number => OY + dy;

/** Height of a broken pipe's stub above the chest. */
const STUB = 8;

// ------------------------------------------------------------------------------------ pipes

/** One pipe (whole or a broken stub), running down behind the chest's top rail. */
function pipeLayer(i: number, state: 0 | 1 | 2): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const r = pipeRect(i);
  const x0 = X(r.x);
  const x1 = x0 + r.w - 1;
  const top = state === 2 ? Y(PIPES.chest.y - STUB) : Y(r.y);
  const bot = Y(PIPES.chest.y + 2);
  // A brass cylinder lit from the left: highlight, base, shadow, deep shadow.
  for (let x = x0; x <= x1; x++) {
    const k = x - x0;
    const c = k <= 1 ? PAL.gold[3] : k >= r.w - 1 ? PAL.gold[0] : k >= r.w - 3 ? PAL.gold[1] : PAL.gold[2];
    b.vline(x, top, bot, c);
  }
  if (state === 2) {
    // A jagged, torn rim with the dark inside showing.
    for (let x = x0; x <= x1; x++) {
      const dip = (x * 5 + i * 3) % 4;
      for (let y = top; y < top + dip; y++) b.set(x, y, 0);
      b.set(x, top + dip, PAL.gold[1]);
      if (x > x0 && x < x1) b.set(x, top + dip + 1, PAL.ink[1]);
    }
    return b;
  }
  // The open top: a dark mouth inside a bright rim.
  b.hline(x0, x1, top, PAL.gold[3]);
  b.hline(x0 + 1, x1 - 1, top + 1, PAL.ink[1]);
  b.hline(x0 + 2, x1 - 2, top + 2, PAL.gold[0]);
  // A crimson band a third of the way down.
  const band = top + Math.round(r.h / 3);
  b.hline(x0, x1, band, PAL.red[3]);
  b.hline(x0, x1, band + 1, PAL.red[2]);
  b.hline(x0, x1, band + 2, PAL.red[1]);
  // The flue mouth: an arched slot with a light lower lip, 7 px above the chest.
  const my = Y(PIPES.chest.y - 7);
  const cx = x0 + (r.w >> 1);
  b.rect(cx - 2, my - 2, 4, 3, PAL.ink[1]);
  b.hline(cx - 1, cx, my - 3, PAL.ink[1]);
  b.hline(cx - 3, cx + 2, my + 1, PAL.gold[3]);
  b.hline(cx - 2, cx + 1, my + 2, PAL.gold[1]);
  return b;
}

function pipeFrame(i: number, state: 0 | 1 | 2): Frame {
  let buf = pipeLayer(i, state).outline(INK);
  if (state === 1) buf = damage(buf, 4, 41 + i);
  return fr(buf, OX, OY);
}

// ------------------------------------------------------------------------------------ chest

function chestLayer(burnt: boolean): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const c = PIPES.chest;
  b.rect(X(c.x), Y(c.y), c.w, c.h, PAL.red[2]);
  shadeLayer(b, PAL.red, { hi: 1, lo: 1 });
  // The gold top rail and a dark plinth.
  b.hline(X(c.x), X(c.x + c.w - 1), Y(c.y), PAL.gold[3]);
  b.hline(X(c.x), X(c.x + c.w - 1), Y(c.y + 1), PAL.gold[2]);
  b.hline(X(c.x), X(c.x + c.w - 1), Y(c.y + 2), PAL.gold[0]);
  b.rect(X(c.x), Y(-4), c.w, 4, PAL.steel[1]);
  b.hline(X(c.x), X(c.x + c.w - 1), Y(-4), PAL.steel[3]);
  b.hline(X(c.x), X(c.x + c.w - 1), Y(-1), PAL.steel[0]);
  for (let x = c.x + 3; x < c.x + c.w - 3; x += 8) rivet(b, X(x), Y(-3), PAL.steel);
  // Bunting across the front, the crest in the middle, brass corner plates.
  bunting(b, X(c.x + 2), X(-6), Y(c.y + 3), 3, PENNANTS_ON_RED, 6);
  bunting(b, X(5), X(c.x + c.w - 3), Y(c.y + 3), 3, PENNANTS_ON_RED, 6);
  crest(b, X(0), Y(c.y + 9));
  for (const x of [c.x + 1, c.x + c.w - 4]) {
    b.rect(X(x), Y(c.y + 9), 3, 4, PAL.gold[1]);
    b.set(X(x), Y(c.y + 9), PAL.gold[3]);
  }
  if (burnt) {
    for (let y = c.y; y < 0; y++) {
      for (let x = c.x; x < c.x + c.w; x++) {
        if ((b.get(X(x), Y(y)) & 255) === 0) continue;
        const n = Math.sin(x * 0.45 + y * 0.2) + Math.cos(y * 0.9 - x * 0.13);
        if (n > 0.5 && bayer(x, y) < 0.6) b.set(X(x), Y(y), PAL.ink[1]);
      }
    }
  }
  return b;
}

function bodyFrame(): Frame {
  return fr(chestLayer(false).outline(INK), OX, OY);
}

function wreckFrame(): Frame {
  const c = new Composer(W, H);
  for (let i = 0; i < 5; i++) {
    const s = pipeLayer(i, 2);
    // Each stub leans a little: shift its top pixels sideways.
    const lean = i % 2 === 0 ? -1 : 1;
    const bent = new PixelBuffer(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const col = s.get(x, y);
      if ((col & 255) === 0) continue;
      bent.set(x + (y < Y(PIPES.chest.y - 4) ? lean : 0), y, col);
    }
    c.add(bent, { ramp: PAL.gold });
  }
  c.add(chestLayer(true), { ramp: PAL.red });
  return fr(c.finish(), OX, OY);
}

// ------------------------------------------------------------------------------------ rockets

/** The brass eighth note: head at the bottom, stem up on the right, a flag at the top. */
function noteShape(b: PixelBuffer, cx: number, cy: number): void {
  // Head: a slanted oval 6×4.
  b.ellipse(cx - 3, cy + 3, 6, 4, PAL.gold[2]);
  b.set(cx - 2, cy + 3, PAL.gold[3]);
  b.set(cx + 1, cy + 6, PAL.gold[1]);
  // Stem and flag.
  b.rect(cx + 1, cy - 6, 2, 10, PAL.gold[2]);
  b.vline(cx + 1, cy - 6, cy + 3, PAL.gold[3]);
  b.line(cx + 3, cy - 6, cx + 5, cy - 3, PAL.gold[2]);
  b.line(cx + 3, cy - 5, cx + 5, cy - 2, PAL.gold[1]);
  b.set(cx + 5, cy - 1, PAL.gold[1]);
}

function rocketFrames(): Frame[] {
  return [0, 1].map((k) => {
    const b = new PixelBuffer(14, 22);
    noteShape(b, 6, 8);
    // A flame under the head.
    const fl = k === 0 ? [PAL.fire[5], PAL.fire[3], PAL.fire[1]] : [PAL.fire[6], PAL.fire[4], PAL.fire[2]];
    b.rect(4, 15, 4, 2, fl[0]);
    b.rect(4, 17, 3, 2 + k, fl[1]);
    b.set(5, 19 + k, fl[2]);
    return fr(b.outline(INK), 6, 10);
  });
}

function rocketDownFrames(): Frame[] {
  return [0, 1].map((k) => {
    const b = new PixelBuffer(14, 22);
    noteShape(b, 6, 10);
    // Speed streaks above it (white, then gold).
    b.vline(2, 1 + k, 5 + k, PAL.snow[3]);
    b.vline(10, 0 + k, 3 + k, PAL.snow[2]);
    return fr(b.outline(INK), 6, 12);
  });
}

/** The ground shadow: a dithered dark ellipse that grows (6 … 22 px wide), centre anchor. */
function shadowFrames(): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < 5; k++) {
    const w = 6 + k * 4;
    const h = 3 + (k >> 1);
    const b = new PixelBuffer(24, 7);
    const x0 = 12 - (w >> 1);
    const y0 = 3 - (h >> 1);
    b.ellipse(x0, y0, w, h, PAL.ink[0]);
    // Ordered dither in the outer ring so the ground shows through the soft edge.
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 24; x++) {
        if ((b.get(x, y) & 255) === 0) continue;
        const dx = (x + 0.5 - 12) / (w / 2);
        const dy = (y + 0.5 - (y0 + h / 2)) / (h / 2);
        if (dx * dx + dy * dy > 0.45 && ((x + y) & 1) === 1) b.set(x, y, 0);
      }
    }
    out.push(fr(b, 12, 3));
  }
  return out;
}

// ------------------------------------------------------------------------------------ register

export function definePipeSprites(): void {
  for (let i = 0; i < 5; i++) defineSprite(`${ART}/pipe-${i}`, () => [pipeFrame(i, 0), pipeFrame(i, 1), pipeFrame(i, 2)], { ticksPerFrame: 30 });
  defineSprite(`${ART}/body`, () => [bodyFrame()], { ticksPerFrame: 30 });
  defineSprite(`${ART}/wreck`, () => [wreckFrame()], { ticksPerFrame: 30 });
  defineSprite(`${ART}/rocket`, rocketFrames, { ticksPerFrame: 3 });
  defineSprite(`${ART}/rocket-down`, rocketDownFrames, { ticksPerFrame: 3 });
  defineSprite(`${ART}/shadow`, shadowFrames, { ticksPerFrame: 8, loop: false });
}
