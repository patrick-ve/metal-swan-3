/**
 * sewers-a's grey kit (wave P1b A; docs/design/sewers.md §2.1): STAND-IN decor drawn in code so the
 * play reads in grey (the canal bake of Phase 6 replaces it): the krul urinals and the tree the
 * dealers lurk behind, and the limo's bridge in depth (Gerrit flees over it). Ids carry the
 * `sewers-` segment (the lazy chunk). Nothing here is solid: decor only.
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineSprite } from '../../../../engine/sprites';
import type { DecorDef } from '../../../mission/index';
import { G, SEWERS_A } from './terrain';

export const A_DECOR_ART = 'decor/sewers-a';
export const A_KRUL = `${A_DECOR_ART}/krul`;
export const A_TREE = `${A_DECOR_ART}/tree`;
export const A_BRIDGE = `${A_DECOR_ART}/bridge`;

/** A krul: a curled green iron screen round a street urinal (26 × 42, feet anchored). */
defineSprite(A_KRUL, () => {
  const b = new PixelBuffer(26, 42);
  b.roundRect(3, 8, 20, 33, 6, PAL.green[1]);
  b.rect(5, 10, 3, 29, PAL.green[2]);
  b.rect(18, 10, 3, 29, PAL.green[0]);
  // The curl on top and the little roof.
  b.ellipse(4, 2, 18, 8, PAL.green[1]);
  b.ellipse(8, 3, 9, 5, PAL.green[3]);
  b.hline(2, 23, 39, PAL.green[0]);
  b.outline(INK);
  return [b];
});

/** A canal elm: a trunk and a dark crown (44 × 76, feet anchored). */
defineSprite(A_TREE, () => {
  const b = new PixelBuffer(44, 76);
  b.rect(19, 30, 6, 46, PAL.brown[1]);
  b.vline(20, 32, 74, PAL.brown[2]);
  b.ellipse(2, 0, 40, 36, PAL.green[0]);
  b.ellipse(6, 4, 28, 22, PAL.green[1]);
  b.dither(6, 4, 28, 22, PAL.green[2], 0.2);
  b.outline(INK);
  return [b];
});

/** The limo's bridge seen across the canal: a low brick arch with a railing (128 × 40, feet anchored). */
defineSprite(A_BRIDGE, () => {
  const b = new PixelBuffer(128, 40);
  b.rect(0, 14, 128, 26, PAL.brown[0]);
  b.ellipse(24, 22, 80, 36, PAL.navy[0]);
  b.hline(0, 127, 14, PAL.brown[2]);
  for (let x = 2; x < 128; x += 8) b.vline(x, 4, 13, PAL.black[2]);
  b.hline(0, 127, 4, PAL.black[3]);
  b.outline(INK);
  return [b];
});

/** The section's stand-in decor (behind the actors). */
export function aDecor(): DecorDef[] {
  const out: DecorDef[] = [];
  for (const x of SEWERS_A.krul) out.push({ sprite: A_KRUL, x, y: G - 2 });
  out.push({ sprite: A_TREE, x: SEWERS_A.tree, y: G - 4 });
  const [b0, b1] = SEWERS_A.bridges[1];
  out.push({ sprite: A_BRIDGE, x: Math.round((b0 + b1) / 2), y: G - 38 });
  return out;
}
