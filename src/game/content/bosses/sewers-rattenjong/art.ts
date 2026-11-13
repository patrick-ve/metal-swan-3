/**
 * The art of DE RATTENJONG's fight (docs/design/sewers.md §4.2).
 *
 * - `boss/sewers-rattenjong/<pose>` — the giant rat king at 40 px scale: the baked set of wave P5
 *   (tools/art40/chars/sewers-rattenjong/, content/sewers/art40/sewers-rattenjong.gen.ts; the lazy
 *   sewers chunk only). Anchor: the feet centre, facing right. Seated `sit` (8), `lift` (2), `shove`
 *   (2), `throw` (3), `squeak` (4), `crouch` (2); on all fours `walk` (8), `rear` (3), `charge` (6),
 *   `daze` (4), `tail-up` (3), `sweep` (6), `bite-tell` (3), `bite` (5), `jump` (6), `tumble` (8,
 *   rolled). king.ts plays a pose by time at 6 ticks a frame (wrapped), so the counts are free.
 * - `boss/sewers-rattenjong/<pose>-eyes` — the eyes alone of every pose but the tumble, frame for
 *   frame (P2: the light pass draws them as emitters; the tells flash them white, 4 × 3).
 * - `decor/sewers-rattenjong-throne/pile` — the trash mountain, one frame per level (4; anchor: the
 *   floor point under the throne's centre); `…/chain` — Gerrit's gold chain on it (the gag). Stand-ins
 *   (scenery: the canal bake of P4 paints them, P6 ports).
 * - `fx/sewers-rattenjong/{bike,bike-part,cart,scooter,scrap}` — the throws (centre anchor): the
 *   baked set `sewers-rattenjong-throws`.
 */
import type { Color } from '../../../../engine/color';
import { defineBakedSet } from '../../../../engine/baked';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { SET as KING_SET } from '../../sewers/art40/sewers-rattenjong.gen';
import { SET as THROWS_SET } from '../../sewers/art40/sewers-rattenjong-throws.gen';
import { THRONE_ART } from './numbers';

defineBakedSet(KING_SET);
defineBakedSet(THROWS_SET);

const WHEEL = PAL.steel[2];
const KNOTS: readonly Color[] = [PAL.teal[1], PAL.gold[1], PAL.purple[1], PAL.olive[2]];

/** A small deterministic hash (stand-in texture; no Math.random in art either). */
function hash(n: number): number {
  let h = (n * 374761393 + 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// The throne
// ---------------------------------------------------------------------------------------------

/** The pile: 216 px wide; frame k has its top at the level's height (KING.tops). */
const PILE_W = 224;
const PILE_H = 92;
const PILE_TOPS = [44, 41, 38, 35];

function pileFrame(level: number): Frame {
  const b = new PixelBuffer(PILE_W, PILE_H);
  const ox = PILE_W / 2;
  const oy = PILE_H - 2;
  const top = PILE_TOPS[level];
  // The mound (dark, wet).
  for (let x = 0; x < PILE_W; x++) {
    const d = Math.abs(x - ox) / (PILE_W / 2);
    const h = Math.round(top * (1 - d * d) + 4 + hash(x) * 3);
    b.vline(x, oy - h, oy, d > 0.85 ? PAL.ink[1] : PAL.stone[0]);
  }
  // Junk on it: wheels, carts, scooter decks, bags (deterministic).
  for (let i = 0; i < 26; i++) {
    const x = Math.round(16 + hash(i * 7 + level * 101) * (PILE_W - 32));
    const d = Math.abs(x - ox) / (PILE_W / 2);
    const y = Math.round(oy - top * (1 - d * d) * (0.3 + 0.7 * hash(i * 13 + 5)) - 2);
    const kind = i % 5;
    if (kind === 0) b.circle(x, y - 4, 5, WHEEL, false);
    else if (kind === 1) b.strokeRect(x - 5, y - 6, 11, 7, PAL.steel[1]);
    else if (kind === 2) b.rect(x - 6, y - 2, 12, 3, PAL.teal[1]);
    else if (kind === 3) b.ellipse(x - 4, y - 5, 8, 6, PAL.stone[0]);
    else b.rect(x - 2, y - 4, 4, 5, KNOTS[i % KNOTS.length]);
  }
  // A few bike wheels standing up behind the seat.
  b.circle(ox - 22, oy - top - 6, 7, WHEEL, false);
  b.circle(ox + 24, oy - top - 4, 6, WHEEL, false);
  // Green water glow at the foot.
  b.hline(8, PILE_W - 8, oy, PAL.green[1]);
  b.hline(20, PILE_W - 20, oy - 1, PAL.teal[1]);
  return { buf: b, ox, oy };
}

defineSprite(`${THRONE_ART}/pile`, () => [0, 1, 2, 3].map(pileFrame), { loop: false });
defineSprite(
  `${THRONE_ART}/chain`,
  () => {
    const b = new PixelBuffer(18, 8);
    for (let i = 0; i < 8; i++) b.circle(1 + i * 2, 2 + Math.round(Math.sin(i * 0.8) * 2) + 2, 1, i % 2 ? PAL.gold[2] : PAL.gold[3], false);
    b.rect(13, 3, 4, 4, PAL.gold[3]);
    return { buf: b, ox: 9, oy: 7 };
  },
  {},
);
