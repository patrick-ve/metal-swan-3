/**
 * The river's mooring piles (docs/design/floor.md §12.2 c2; the c2 back row): a dolphin of three tarred
 * timbers bound with steel bands, a pale weathered top, standing in the water behind the fairway where
 * boats moor along the far side (they never stand where a boat sails: the street logic of c2). A
 * procedural row prop (`defineFloorProp`): drawn at its row's final scale and density, feet at the
 * waterline.
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import type { Frame } from '../../../../../../engine/render';
import { HdCanvas, grime } from '../../../../../art/hd/index';
import { defineFloorProp } from '../../../../../mission/floor/registry';
import { scaleFrame } from '../../../../../mission/floor/scale';
import { deco, fr } from '../../art-hd-ab-kit';

/** The prop id and its size at scale 1 (logical px: about 2.4 m over the water beside the 1.8 m heroes). */
export const C2_PILE = 'ams/c2-pile';
const PILE_W = 7;
const PILE_H = 30;

/** A dolphin at scale k and density d (feet anchor at the waterline). */
export function pileFrame(k: number, d: number): Frame {
  const W = Math.max(4, Math.ceil(PILE_W * k + 1));
  const H = Math.max(8, Math.ceil(PILE_H * k));
  const dd = d >= 2 ? d : 2;
  const c = new HdCanvas(W, H, dd);
  const tar = deco(c, PAL_HD.wood, { lo: 0, hi: 3, spec: 0.2 });
  const top = deco(c, PAL_HD.stone, { lo: 2, hi: 5 });
  const steel = deco(c, PAL_HD.steel, { lo: 1, hi: 4, spec: 0.7, shine: 16 });
  const cx = W / 2;
  const K = (a: number): number => a * k;
  const foot = H - 0.2;
  // Three timbers: the middle one tallest, the outer ones leaning in a little.
  for (const [dx, h, z] of [[-1.9, 26, 1], [1.9, 27.5, 1.1], [0, 29.4, 1.3]] as const) {
    c.cylinder(cx + K(dx) - K(1.2), foot - K(h), K(2.4), K(h), { mat: tar, z, tex: grime(7, 0.4, 2) });
    c.ellipsoid(cx + K(dx), foot - K(h), K(1.15), K(0.55), { mat: top, z: z + 0.2 });
  }
  // The steel bands binding them, a wet dark foot at the water.
  for (const y of [6, 19]) c.box(cx - K(3.3), foot - K(y) - K(0.7), K(6.6), K(1.4), { mat: steel, z: 2, bevel: 0.3 });
  c.box(cx - K(3.2), foot - K(2.2), K(6.4), K(2.2), { mat: tar, z: 1.5, tone: -0.3 });
  const f = fr(c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 0.6 }), cx, H, dd);
  return d >= 2 ? f : scaleFrame(f, 1, 1);
}

defineFloorProp(C2_PILE, (scale, d) => pileFrame(scale, d));
