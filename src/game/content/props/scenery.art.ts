/**
 * Art of the scenery props: `prop/card-table/…` (the soldiers' card game) and `prop/air-jet/pipe`
 * (the brass nozzle under a warm-air column). Palette ramps only, 1-px INK outline, light from
 * the upper left.
 */
import { ascii } from '../../../engine/ascii';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';

// ------------------------------------------------------------------------------------ card-table

/**
 * A folding card table (20×12), feet anchor: a crimson baize top with a gold rim seen a little
 * from above, a dark apron and two pairs of crossed folding legs. `game`: a hand of cards fanned
 * on the baize, a face-down pile and a little stack of gold coins (frame 0); frame 1 is the bare
 * table after the cards flew.
 */
function cardTable(game: boolean): Frame {
  const W = 22;
  const H = 18;
  const b = new PixelBuffer(W, H);
  const floor = H - 1; // the row under the feet (outline)
  const top = floor - 12; // baize top row
  // Crossed legs (behind the apron): X shapes at both ends, lit wood on the near strut.
  for (const [x0, x1] of [
    [2, 7],
    [14, 19],
  ] as const) {
    b.line(x0, top + 4, x1, floor - 1, PAL.brown[1]);
    b.line(x1, top + 4, x0, floor - 1, PAL.brown[2]);
    b.set(x0, floor - 1, PAL.brown[0]);
    b.set(x1, floor - 1, PAL.brown[0]);
  }
  // Baize top: 2 rows of felt seen from above, a gold rim in front, a dark apron under it.
  b.hline(2, 19, top, PAL.red[3]);
  b.hline(1, 20, top + 1, PAL.red[2]);
  b.hline(1, 20, top + 2, PAL.gold[2]);
  b.set(1, top + 2, PAL.gold[3]);
  b.hline(2, 19, top + 3, PAL.red[0]);
  if (game) {
    // A fanned hand on the left, the face-down pile, a coin stack on the right.
    const hand = ascii(['.wWw.', 'wwkww', 'wRwRw'], { w: PAL.snow[2], W: PAL.snow[3], k: PAL.ink[1], R: PAL.red[2] });
    b.blit(hand, 4, top - 3);
    b.rect(11, top - 1, 4, 2, PAL.navy[1]);
    b.hline(11, 14, top - 1, PAL.sky[1]);
    b.rect(16, top - 2, 3, 3, PAL.gold[2]);
    b.hline(16, 18, top - 2, PAL.gold[3]);
    b.hline(16, 18, top, PAL.gold[1]);
  } else {
    // One forgotten card.
    b.hline(13, 15, top, PAL.snow[3]);
  }
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: floor };
}

/** A playing card tumbling through the air (centre anchor, 4 frames: face, edge, back, edge). */
function card(frame: number): Frame {
  const b = new PixelBuffer(7, 8);
  if (frame === 0) {
    b.rect(2, 2, 3, 4, PAL.snow[3]);
    b.set(3, 3, PAL.red[2]);
    b.set(3, 4, PAL.red[2]);
  } else if (frame === 2) {
    b.rect(2, 2, 3, 4, PAL.navy[1]);
    b.set(3, 3, PAL.sky[1]);
    b.set(2, 5, PAL.sky[1]);
  } else {
    b.vline(3, 2, 5, frame === 1 ? PAL.snow[2] : PAL.stone[3]);
  }
  b.outline(INK);
  return { buf: b, ox: 3, oy: 4 };
}

// ------------------------------------------------------------------------------------ air-jet

/**
 * The brass nozzle a warm-air column blows out of (28 wide), anchored at the middle of its mouth
 * (the column's bottom): a flared brass bell with a dark grille, a riveted collar and a pipe stub
 * going down. Frame 1 lights the grille's heat glow one shade up (the hiss pulse).
 */
function airPipe(glow: boolean): Frame {
  const W = 30;
  const H = 22;
  const b = new PixelBuffer(W, H);
  const mouth = 2; // the mouth's top row
  const g = PAL.gold;
  // Flared bell: wide at the mouth, narrowing to the collar.
  for (let y = mouth; y < mouth + 8; y++) {
    const k = y - mouth;
    const half = 13 - Math.floor(k * 0.9);
    const x0 = 15 - half;
    const x1 = 14 + half;
    b.hline(x0, x1, y, g[2]);
    b.set(x0, y, g[3]);
    b.set(x0 + 1, y, g[3]);
    b.set(x1, y, g[0]);
    b.set(x1 - 1, y, g[1]);
  }
  // The mouth: a dark ring with a glowing grille.
  b.hline(3, 26, mouth, g[3]);
  b.hline(4, 25, mouth + 1, PAL.ink[1]);
  for (let x = 5; x <= 24; x += 3) b.set(x, mouth + 1, glow ? PAL.orange[2] : PAL.orange[1]);
  // Collar with rivets, then the pipe stub.
  b.rect(8, mouth + 8, 14, 3, PAL.gold[1]);
  b.hline(8, 21, mouth + 8, g[3]);
  for (let x = 10; x <= 20; x += 5) b.set(x, mouth + 9, g[3]);
  b.rect(10, mouth + 11, 10, H - mouth - 12, PAL.gold[1]);
  b.vline(10, mouth + 11, H - 2, g[3]);
  b.vline(11, mouth + 11, H - 2, g[2]);
  b.vline(19, mouth + 11, H - 2, g[0]);
  b.outline(INK);
  return { buf: b, ox: 15, oy: mouth };
}

// ------------------------------------------------------------------------------------ registration

export function defineScenerySprites(): void {
  defineSprite('prop/card-table/idle', () => [cardTable(true), cardTable(false)], { loop: false });
  defineSprite('prop/card-table/card', () => [0, 1, 2, 3].map(card), { ticksPerFrame: 4 });
  defineSprite('prop/air-jet/pipe', () => [airPipe(false), airPipe(true)], { ticksPerFrame: 4 });
}
