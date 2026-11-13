/**
 * sewers-d's own helpers (wave P1b D; docs/design/sewers.md §2.4): the STAND-IN decor that makes
 * the grey play read (the paint of Phase 5 replaces every one of them; the kit paints the real
 * plinths, pipe stubs and tunnel mouths at the same x, play sits on its art):
 *
 * - `decor/sewers-d/plinth`      a brick plinth under each spitter platform (48 × 28, top y 148)
 * - `decor/sewers-d/pipe-stub`   an outfall riser at the walkway's back edge, its mouth at y 150
 *   facing the heroes (the leaper's lurk draws in it)
 * - `decor/sewers-d/tunnel`      a dark side-tunnel mouth in the far wall (640, 1,200, 1,980; the
 *   1,200 mouth holds the secret fatberg)
 *
 * Sprite ids carry the `sewers-` segment (the lazy chunk).
 */
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineSprite } from '../../../../engine/sprites';
import type { DecorDef } from '../../../mission/index';
import { hash2 } from '../../../art/paint';
import { G, SEWERS_D } from './terrain';

/** The stand-in decor prefix of sewers-d. */
export const D_DECOR = 'decor/sewers-d';

/** Brick courses (8 × 4) in dark sewer brick. */
function bricks(b: PixelBuffer, x0: number, y0: number, w: number, h: number, seed: number): void {
  b.rect(x0, y0, w, h, PAL.stone[0]);
  for (let row = 0; row * 4 < h; row++) {
    const y = y0 + row * 4;
    const off = row % 2 === 0 ? 0 : 4;
    for (let x = x0 - off; x < x0 + w; x += 8) {
      const a = Math.max(x0, x + 1);
      const z = Math.min(x0 + w - 1, x + 7);
      if (z < a) continue;
      const v = hash2(x, row, seed);
      b.rect(a, y + 1, z - a + 1, Math.min(3, y0 + h - y - 1), v < 0.2 ? PAL.brown[0] : v > 0.85 ? PAL.rust[1] : PAL.brown[1]);
    }
  }
}

/** The plinth: brick, a stone cap at y 148 (the platform's top), moss and slime at the foot. */
defineSprite(`${D_DECOR}/plinth`, () => {
  const b = new PixelBuffer(48, 28);
  bricks(b, 1, 3, 46, 25, 5);
  b.rect(0, 0, 48, 3, PAL.stone[2]);
  b.hline(0, 47, 0, PAL.stone[3]);
  for (let x = 2; x < 46; x += 5) b.set(x, 27, PAL.green[1]);
  return b;
});

/** The pipe stub: a rusty riser, a round dark mouth at 26 px over the feet (y 150), slime below it. */
defineSprite(`${D_DECOR}/pipe-stub`, () => {
  const b = new PixelBuffer(26, 40);
  // The riser (feet at the bottom centre: 13, 39) and the elbow toward the heroes (left).
  b.rect(8, 8, 12, 32, PAL.rust[1]);
  b.vline(9, 8, 39, PAL.rust[3]);
  b.vline(19, 8, 39, PAL.brown[0]);
  b.rect(1, 6, 19, 14, PAL.rust[1]);
  b.hline(1, 19, 6, PAL.rust[3]);
  b.hline(1, 19, 19, PAL.brown[0]);
  // The mouth (centre at 13 − 9 = 4 px left of the anchor, 26 px up).
  b.ellipse(1, 8, 8, 10, PAL.ink[0]);
  b.ellipse(0, 7, 4, 12, PAL.rust[2], false);
  // A slime run under the mouth.
  for (let y = 18; y < 39; y++) if (hash2(3, y, 9) < 0.8) b.set(3 + (y % 3 === 0 ? 1 : 0), y, PAL.green[2]);
  return b;
});

/** A side-tunnel mouth in the far wall: a dark arch with a brick ring (64 × 56). */
defineSprite(`${D_DECOR}/tunnel`, () => {
  const b = new PixelBuffer(64, 56);
  b.ellipse(0, 0, 64, 64, PAL.stone[1]);
  b.ellipse(5, 5, 54, 56, PAL.ink[1]);
  b.ellipse(10, 12, 44, 48, PAL.ink[0]);
  for (let a = 0; a < 16; a++) {
    const t = Math.PI * (a / 15);
    b.set(32 - Math.round(Math.cos(t) * 29), 31 - Math.round(Math.sin(t) * 29), PAL.stone[3]);
  }
  b.rect(0, 52, 64, 4, PAL.stone[0]);
  return b;
});

/** The decor list of sewers-d (stand-ins). Tunnel mouths in the far wall sit behind the walkway (feet y 160). */
export function dDecor(): DecorDef[] {
  const out: DecorDef[] = [];
  for (const x of SEWERS_D.tunnels) out.push({ sprite: `${D_DECOR}/tunnel`, x, y: SEWERS_D.backY });
  for (const x of SEWERS_D.plinths) {
    out.push({ sprite: `${D_DECOR}/plinth`, x, y: G });
    out.push({ sprite: `${D_DECOR}/plinth`, x: x + SEWERS_D.plinthGap, y: G });
  }
  for (const x of SEWERS_D.pipes) out.push({ sprite: `${D_DECOR}/pipe-stub`, x: x + 8, y: G });
  return out;
}

/** The art sewers-d draws (its section `art` list). */
// Explicit ids (docs/api/canal.md §8): a prefix here would keep every grey stand-in in `canalPaintedArt`, so the scene
// on would still build them.
export const D_ART = [`${D_DECOR}/plinth`, `${D_DECOR}/pipe-stub`, `${D_DECOR}/tunnel`, 'prop/sewers-fatberg/'] as const;
