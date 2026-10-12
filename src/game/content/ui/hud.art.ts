/**
 * HUD and menu icons (GDD §13, §15.6; docs/ARCHITECTURE.md §7.1). All top-left anchored.
 *
 * - `ui/icon-life`     a 6×6 SWAN-3 head (+ ink outline): ivory dome, gold lens eye, navy face
 *                      patch, orange beak (docs/design/swan-mount/look.md §5.7)
 * - `ui/swan-marker`   the same head outlined in the rider's colour (frame 0 P1 sky, 1 P2 gold)
 *                      and ink outside (GDD §13.7 Swan marker)
 * - `ui/cursor-swan`   the menu cursor: her head and the top of her neck, facing right
 * - `ui/icon-cell`     a vehicle HP cell 8×5: 0 empty, 1 half, 2 full, 3 half red, 4 full red
 * - `ui/onward`        three gold chevrons: frame 0 right, 1 left, 2 up, 3 down
 * - `ui/star`          a tally rating star
 * - `ui/icon-balloon`  the Helium Head status icon (a party balloon)
 * - `ui/ride`          a ready-made RIDE? bubble, anchored at its tail tip (GDD §8.1)
 * - `ui/bubble`        a small empty speech bubble (the pause gag's snore)
 */
import { ascii, type AsciiKey } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { drawText, measure } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';

const topLeft = { anchor: 'top-left' as const };

/** Her head colours (look.md §4): ivory enamel, gold lens ring, navy face patch, orange beak. */
const HEAD: AsciiKey = {
  W: PAL.snow[3],
  w: PAL.snow[2],
  v: PAL.snow[1],
  g: PAL.gold[2],
  k: INK,
  n: PAL.navy[0],
  O: PAL.orange[3],
  o: PAL.orange[2],
  s: PAL.steel[3],
};

/** The 6×6 head: dome top-left lit, lens eye, navy patch from the eye to the beak base. */
const HEAD_6 = ['.WWw..', 'WWgnOo', 'WWwnos', 'wWwv..', '.Ww...', '.wv...'];

function head6(): PixelBuffer {
  return ascii(HEAD_6, HEAD);
}

function lifeFrames(): Frame[] {
  return [{ buf: head6().padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** The head outlined in the rider's colour, then in ink (readable on sky and snow). */
function markerFrames(): Frame[] {
  return [PAL.sky[3], PAL.gold[3]].map((c) => ({ buf: head6().padded(2).outline(c).outline(INK), ox: 0, oy: 0 }));
}

/** The cursor: a bigger head with a lens eye and a bit of neck, pointing right at the item. */
function cursorFrames(): Frame[] {
  const b = ascii(['..WWW....', '.WWWWw...', 'WWgkWnOO.', 'WWwgnoOos', '.wWWv....', '..Ww.....', '.Ww......', '.wv......'], HEAD);
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** HP cells: an 8×5 cell inside an ink frame (10×7). */
function cellFrames(): Frame[] {
  const out: Frame[] = [];
  const fills: readonly (readonly [number, Color, Color, Color] | null)[] = [
    null,
    [4, PAL.snow[3], PAL.snow[1], PAL.snow[3]],
    [8, PAL.snow[3], PAL.snow[1], PAL.snow[3]],
    [4, PAL.red[3], PAL.red[1], PAL.red[3]],
    [8, PAL.red[3], PAL.red[1], PAL.red[3]],
  ];
  for (const f of fills) {
    const b = new PixelBuffer(10, 7).fill(INK);
    b.rect(1, 1, 8, 5, PAL.navy[0]);
    if (f) {
      const [w, base, shade, lit] = f;
      b.rect(1, 1, w, 5, base);
      b.rect(1, 5, w, 1, shade);
      b.rect(1, 1, w, 1, lit);
      if (w === 4) b.rect(5, 1, 1, 5, INK);
    }
    out.push({ buf: b, ox: 0, oy: 0 });
  }
  return out;
}

/** Three chevrons pointing right (4×7 each, 2 px apart), then the same turned left, up and down. */
function onwardFrames(): Frame[] {
  const row = ['G..', 'gG.', '.gG', '..g', '.gG', 'gG.', 'G..'];
  const right = ascii(row.map((r) => `${r}..${r}..${r}`), { G: PAL.gold[3], g: PAL.gold[2] });
  const left = right.flipped(true, false);
  // Up / down: transpose the right-pointing strip.
  const down = new PixelBuffer(right.h, right.w);
  for (let y = 0; y < right.h; y++) for (let x = 0; x < right.w; x++) down.set(y, x, right.get(x, y));
  const up = down.flipped(false, true);
  return [right, left, up, down].map((b) => ({ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }));
}

/** A five-point gold star (tally ratings), lit from the top left. */
function starFrames(): Frame[] {
  const b = ascii(['....W....', '...GGg...', 'WGGGGGGgg', '.GGGGGgg.', '..GGgGg..', '.GGg.Ggg.', 'Gg.....gg'], {
    W: PAL.gold[3],
    G: PAL.gold[3],
    g: PAL.gold[2],
  });
  b.set(4, 0, PAL.snow[3]);
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** A pink party balloon on a string (Helium Head). */
function balloonFrames(): Frame[] {
  const b = ascii(['.PPP.', 'PpPPP', 'PPPPP', 'PPPPq', '.PPq.', '..s..', '..w..', '.w...', '..w..'], {
    P: PAL.pink[2],
    p: PAL.snow[3],
    q: PAL.pink[1],
    s: PAL.pink[1],
    w: PAL.stone[3],
  });
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** A speech bubble with `text` (small font, ink on white), anchored at the tip of its 3 px tail. */
export function bubbleFrame(text: string, fill: Color = PAL.snow[3], ink: Color = INK): Frame {
  const tw = measure(text, 'small');
  const w = Math.max(11, tw + 7);
  const h = 12;
  const b = new PixelBuffer(w + 2, h + 6);
  // Rounded box with an ink edge, then the tail at the middle of the bottom edge.
  b.rect(2, 0, w - 2, h + 2, INK).rect(0, 2, w + 2, h - 2, INK).rect(1, 1, w, h, INK);
  b.rect(2, 1, w - 2, h, fill).rect(1, 2, w, h - 2, fill);
  const tx = (w + 2) >> 1;
  b.rect(tx - 1, h + 1, 3, 1, fill);
  b.set(tx, h + 2, fill);
  for (const [x, y] of [[-2, 1], [-2, 2], [2, 1], [2, 2], [-1, 2], [1, 2], [0, 3]] as const) b.set(tx + x, h + y, INK);
  drawText(b, text, tx, 3, { font: 'small', color: ink, align: 'center' });
  return { buf: b, ox: tx, oy: h + 3 };
}

/** A small empty bubble for thoughts and snores ('Z' drawn by the scene). */
function smallBubble(): Frame[] {
  const b = ascii(['.kkkkk.', 'kWWWWWk', 'kWWWWWk', 'kWWWWWk', '.kkkkk.', '..kWk..', '...k...'], { k: INK, W: PAL.snow[3] });
  return [{ buf: b, ox: 3, oy: 6 }];
}

/** Register the HUD and menu icons (called again after content loads so these ids win). */
export function defineHudArt(): void {
  defineSprite('ui/icon-life', lifeFrames, topLeft);
  defineSprite('ui/swan-marker', markerFrames, topLeft);
  defineSprite('ui/cursor-swan', cursorFrames, topLeft);
  defineSprite('ui/icon-cell', cellFrames, topLeft);
  defineSprite('ui/onward', onwardFrames, topLeft);
  defineSprite('ui/star', starFrames, topLeft);
  defineSprite('ui/icon-balloon', balloonFrames, topLeft);
  defineSprite('ui/ride', () => [bubbleFrame('RIDE?')]);
  defineSprite('ui/bubble', smallBubble);
}
