/**
 * Art of the breakable props: `prop/helium-tank/…`, `prop/statue-head/…`, `prop/rolling-drum/…`,
 * `prop/icicle/…`. Palette ramps only, 1-px INK outline, light from the upper left.
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { hash2 } from '../../art/paint';

// ------------------------------------------------------------------------------------ helium-tank

/** Shade of a cylinder column (0..1 across, lit from the left): 0 deep … 3 highlight. */
function cylTone(u: number): number {
  if (u < 0.12) return 2;
  if (u < 0.34) return 3;
  if (u < 0.72) return 2;
  if (u < 0.9) return 1;
  return 0;
}

/**
 * The tank: an 18×26 cylinder (20×28 with its outline) with pink-and-white candy stripes, a
 * domed top, a gold band, a steel valve and a party balloon on a string. `sway` (0..3) moves the
 * balloon.
 */
function heliumTank(sway: number): Frame {
  const W = 26;
  const H = 58;
  const b = new PixelBuffer(W, H);
  const x0 = 4;
  const x1 = 21;
  const top = 30;
  const bottom = 55;
  const pink = [PAL.pink[0], PAL.pink[0], PAL.pink[1], PAL.pink[2]];
  const white = [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  for (let y = top; y <= bottom; y++) {
    // Domed shoulder: the first rows are narrower.
    const inset = y === top ? 3 : y === top + 1 ? 1 : 0;
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      const u = (x - x0 + 0.5) / (x1 - x0 + 1);
      const t = cylTone(u);
      const stripe = Math.floor((x - x0 + (bottom - y)) / 4) % 2 === 0;
      b.set(x, y, stripe ? pink[t] : white[t]);
    }
  }
  // Shoulder highlight and the gold band near the base.
  b.hline(x0 + 4, x0 + 7, top + 1, PAL.snow[3]);
  for (let x = x0; x <= x1; x++) {
    const t = cylTone((x - x0 + 0.5) / (x1 - x0 + 1));
    b.set(x, bottom - 4, [PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]][t]);
    b.set(x, bottom - 3, [PAL.gold[0], PAL.gold[0], PAL.gold[1], PAL.gold[2]][t]);
  }
  // Foot ring.
  b.hline(x0 + 1, x1 - 1, bottom, PAL.steel[1]);
  // Valve: neck and a little hand wheel.
  b.rect(11, top - 4, 4, 4, PAL.steel[2]);
  b.vline(11, top - 4, top - 1, PAL.steel[3]);
  b.vline(14, top - 4, top - 1, PAL.steel[1]);
  b.rect(9, top - 6, 8, 2, PAL.gold[2]);
  b.hline(9, 16, top - 6, PAL.gold[3]);
  b.set(16, top - 5, PAL.gold[1]);
  // The party balloon.
  const bx = 13 + (sway === 1 || sway === 2 ? 1 : 0);
  const by = 9;
  b.ellipse(bx - 5, by - 6, 11, 13, PAL.sky[1]);
  b.ellipse(bx - 4, by - 5, 8, 10, PAL.sky[2]);
  b.rect(bx - 3, by - 4, 2, 3, PAL.sky[3]);
  b.set(bx - 2, by - 5, PAL.snow[3]);
  for (let y = by - 2; y <= by + 6; y++) {
    for (let x = bx - 5; x <= bx + 5; x++) {
      const c = b.get(x, y);
      if ((c & 255) !== 0 && x + (y - by) * 0.7 > bx + 3) b.set(x, y, PAL.sky[0]);
    }
  }
  b.set(bx, by + 7, PAL.sky[0]);
  b.hline(bx - 1, bx + 1, by + 8, PAL.sky[0]);
  b.outline(INK);
  // The string (drawn after the outline: a thin dark line, not a 3-px stroke).
  const sx0 = 13;
  const sy0 = top - 7;
  const sy1 = by + 9;
  for (let y = sy1; y <= sy0; y++) {
    const k = (y - sy1) / Math.max(1, sy0 - sy1);
    const x = Math.round(bx + (sx0 - bx) * k + Math.sin(k * Math.PI * 2 + sway) * 0.8);
    b.set(x, y, PAL.ink[1]);
  }
  return { buf: b, ox: 13, oy: bottom + 2 };
}

/** The balloon set free: it floats up with its string dangling (2 frames). */
function freeBalloon(phase: number): Frame {
  const b = new PixelBuffer(15, 26);
  const bx = 7;
  const by = 7;
  b.ellipse(bx - 5, by - 6, 11, 13, PAL.sky[1]);
  b.ellipse(bx - 4, by - 5, 8, 10, PAL.sky[2]);
  b.rect(bx - 3, by - 4, 2, 3, PAL.sky[3]);
  b.set(bx - 2, by - 5, PAL.snow[3]);
  for (let y = by - 2; y <= by + 6; y++) {
    for (let x = bx - 5; x <= bx + 5; x++) if ((b.get(x, y) & 255) !== 0 && x + (y - by) * 0.7 > bx + 3) b.set(x, y, PAL.sky[0]);
  }
  b.set(bx, by + 7, PAL.sky[0]);
  b.hline(bx - 1, bx + 1, by + 8, PAL.sky[0]);
  b.outline(INK);
  for (let y = by + 9; y < 25; y++) b.set(Math.round(bx + Math.sin((y + phase * 3) * 0.6) * 1.2), y, PAL.ink[1]);
  return { buf: b, ox: 7, oy: 13 };
}

/**
 * The helium cloud (48×48, centre anchor, 4 frames): soft pastel puffs that churn slowly.
 * Opaque palette pixels; the game draws it see-through.
 */
function heliumCloud(frame: number): Frame {
  const S = 50;
  const b = new PixelBuffer(S, S);
  const c = S / 2;
  const puffs: Array<[number, number, number]> = [[c, c, 11]];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + frame * 0.22;
    const d = 12 + hash2(i, 1, 5) * 4;
    puffs.push([c + Math.cos(a) * d, c + Math.sin(a) * d * 0.9, 7 + hash2(i, 2, 5) * 3]);
  }
  for (const [x, y, r] of puffs) b.circle(Math.round(x), Math.round(y), Math.round(r), PAL.pink[1]);
  for (const [x, y, r] of puffs) b.circle(Math.round(x - 1), Math.round(y - 1), Math.round(r - 2), PAL.pink[2]);
  for (const [x, y, r] of puffs) b.circle(Math.round(x - r * 0.35), Math.round(y - r * 0.4), Math.max(1, Math.round(r * 0.35)), PAL.snow[2]);
  b.outline(PAL.pink[0]);
  return { buf: b, ox: c, oy: c };
}

// ------------------------------------------------------------------------------------ statue-head

/**
 * The gold head of a Fanfaroni statue (24×24), seen from the front and drawn by hand: an enormous
 * bicorne worn athwart with three plume stubs and a cockade, a round smug face with closed eyes
 * and raised brows, a big nose, a curled moustache whose points reach past the ears, a smirk and
 * a round collar with a medal. All gold (a statue), lit from the upper left.
 */
function statueHead(): PixelBuffer {
  return ascii(
    [
      '.......l...lb...l.......',
      '.......lb..lb..lb.......',
      '......wlbbbbbbbbbm......',
      '....llbbbbbmmbbbbbbm....',
      '...llbbbbbmllmbbbbbbm...',
      '..llbbbbbbbmmbbbbbbbbm..',
      '.lbbbbbbbbbbbbbbbbbbbbm.',
      'lbbbbbbbbbbbbbbbbbbbbbbm',
      'mmmmmmmmmmmmmmmmmmmmmmmd',
      'mm....dddddddddddd....md',
      '.....lbbbbbbbbbbbbm.....',
      '..l..lbmmmbbbbmmmbm..m..',
      '.l..llbdddblbbdddbmm..m.',
      '.b..lbbllbllbmbbbbmm..m.',
      '.bb.mmmmmmbbmmmmmmmm.mm.',
      '..bllllllbbbbbbbbbbbmm..',
      '...dmmmmmmmmmmmmmmmmd...',
      '......lbbbdddbbbbm......',
      '.......lbbbbbbbbm.......',
      '........mbbbbbbm........',
      '.....llbbmddddmbbbm.....',
      '....lbbbbbbllbbbbbbm....',
      '...lbbbbbbbmmbbbbbbbm...',
      '...dmmmmmmmmmmmmmmmmd...',
    ],
    { d: PAL.gold[0], m: PAL.gold[1], b: PAL.gold[2], l: PAL.gold[3], w: PAL.snow[3] },
  )
    .padded(1)
    .outline(INK);
}

function statueIdle(): Frame {
  const b = statueHead();
  return { buf: b, ox: 13, oy: 25 };
}

/** Roll frames: the head turned in 45° steps about its middle; the anchor sits 12 px below it. */
function statueRoll(): Frame[] {
  const head = statueHead();
  const S = 36;
  const sq = new PixelBuffer(S, S);
  sq.blit(head, (S - head.w) >> 1, (S - head.h) >> 1);
  const out: Frame[] = [];
  for (let k = 0; k < 8; k++) {
    const r = sq.rotated((k * Math.PI) / 4);
    out.push({ buf: r, ox: r.w >> 1, oy: (r.h >> 1) + 12 });
  }
  return out;
}

// ------------------------------------------------------------------------------------ rolling-drum

/** The Legion crest: a crimson shield with a gold megaphone and baton crossed on it (7×8). */
function crest(): PixelBuffer {
  const b = new PixelBuffer(9, 10);
  b.poly(
    [
      [1, 1],
      [7, 1],
      [7, 5],
      [4, 8],
      [1, 5],
    ],
    PAL.red[2],
  );
  b.hline(1, 7, 1, PAL.red[3]);
  b.line(2, 2, 6, 6, PAL.gold[2]);
  b.line(6, 2, 3, 5, PAL.gold[2]);
  b.set(6, 2, PAL.gold[3]);
  b.set(2, 6, PAL.gold[1]);
  return b;
}

/**
 * A bass drum on its rim, seen from the drumhead side (24×24): crimson hoop with six gold lugs,
 * an ivory head with the Legion crest. `k` (0..7) turns it by 45° steps; the light stays upper
 * left.
 */
function drumFrame(k: number, emblem: PixelBuffer): Frame {
  const S = 27;
  const c = 13;
  const b = new PixelBuffer(S, S);
  const a = (k * Math.PI) / 4;
  // Hoop: lit on the upper left, dark on the lower right.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (d > 11.5) continue;
      const lit = (dx + dy) / (d || 1);
      if (d > 8.5) b.set(x, y, lit < -0.5 ? PAL.red[3] : lit > 0.55 ? PAL.red[0] : d > 10.5 ? PAL.red[1] : PAL.red[2]);
      else b.set(x, y, lit < -0.6 && d > 6.5 ? PAL.snow[3] : lit > 0.6 && d > 6.5 ? PAL.snow[0] : PAL.snow[2]);
    }
  }
  // Lugs on the hoop.
  for (let i = 0; i < 6; i++) {
    const t = a + (i * Math.PI) / 3;
    const lx = Math.round(c + Math.cos(t) * 10);
    const ly = Math.round(c + Math.sin(t) * 10);
    b.set(lx, ly, PAL.gold[2]);
    b.set(lx - 1, ly, PAL.gold[3]);
  }
  // The crest turns with the drum.
  const e = emblem.rotated(a, { quality: 'smooth' });
  b.blit(e, c - (e.w >> 1), c - (e.h >> 1));
  b.outline(INK);
  return { buf: b, ox: c, oy: c + 12 };
}

// ------------------------------------------------------------------------------------ icicle

/** A hanging icicle 8×24, anchored at its top: icy blue-white, lit on the left; `glint` frame. */
function icicle(glint: boolean): Frame {
  const W = 10;
  const H = 26;
  const b = new PixelBuffer(W, H);
  for (let y = 1; y <= 24; y++) {
    const t = (y - 1) / 23;
    const half = Math.max(0.5, 4 * (1 - t) ** 1.15 + (hash2(0, y, 9) < 0.18 && t < 0.7 ? 0.6 : 0));
    const x0 = Math.round(5 - half);
    const x1 = Math.round(4 + half);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0 + 0.5) / (x1 - x0 + 1);
      const col: Color = u < 0.3 ? PAL.snow[3] : u < 0.6 ? PAL.sky[3] : u < 0.85 ? PAL.snow[1] : PAL.snow[0];
      b.set(x, y, col);
    }
  }
  b.hline(1, 8, 1, PAL.snow[2]);
  if (glint) {
    for (const y of [5, 9, 13]) b.set(4, y, PAL.snow[3]);
    b.set(3, 5, PAL.snow[3]);
  }
  b.outline(INK);
  return { buf: b, ox: 5, oy: 1 };
}

/** Ice shards flying apart (centre anchor, 4 frames). */
function shatter(frame: number): Frame {
  const S = 28;
  const b = new PixelBuffer(S, S);
  const c = S >> 1;
  const n = 9 - frame * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / 9) * Math.PI * 2 + hash2(i, 1, 13);
    const d = 2 + frame * 3.2 + hash2(i, 2, 13) * 2;
    const x = Math.round(c + Math.cos(a) * d);
    const y = Math.round(c + Math.sin(a) * d + frame * frame * 0.6);
    b.set(x, y, PAL.snow[3]);
    b.set(x + 1, y, i % 2 === 0 ? PAL.sky[3] : PAL.snow[1]);
    if (frame < 2) b.set(x, y + 1, PAL.snow[0]);
  }
  return { buf: b, ox: c, oy: c };
}

// ------------------------------------------------------------------------------------ registration

export function defineBreakableSprites(): void {
  defineSprite('prop/helium-tank/idle', () => [0, 1, 2, 3].map(heliumTank), { ticksPerFrame: 16 });
  defineSprite('prop/helium-tank/balloon', () => [0, 1].map(freeBalloon), { ticksPerFrame: 10 });
  defineSprite('prop/helium-tank/cloud', () => [0, 1, 2, 3].map(heliumCloud), { ticksPerFrame: 8 });
  defineSprite('prop/statue-head/idle', statueIdle);
  defineSprite('prop/statue-head/roll', statueRoll, { ticksPerFrame: 6 });
  defineSprite(
    'prop/rolling-drum/roll',
    () => {
      const emblem = crest();
      return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => drumFrame(k, emblem));
    },
    { ticksPerFrame: 5 },
  );
  defineSprite('prop/icicle/idle', () => [icicle(false), icicle(true)], { ticksPerFrame: 30 });
  defineSprite('prop/icicle/shatter', () => [0, 1, 2, 3].map(shatter), { ticksPerFrame: 4, loop: false });
}
