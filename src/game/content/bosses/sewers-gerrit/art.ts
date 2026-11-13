/**
 * The art of GOUDEN GERRIT and his limo (docs/design/sewers.md §4.1): the 40 px baked set of wave P5
 * (tools/art40/chars/sewers-gerrit/, baked to content/sewers/art40/sewers-gerrit.gen.ts; it loads
 * with the lazy sewers chunk only). Every id carries the `sewers-` segment (the lazy chunk).
 *
 * | id | frames | anchor |
 * |---|---|---|
 * | `boss/sewers-gerrit/limo` | 0 clean, 1 dented, 2 battered, 3 the wreck | the middle of the limo on the floor (nose right) |
 * | `boss/sewers-gerrit/door` | 0 the back door swung open | as the limo |
 * | `boss/sewers-gerrit/gerrit` | `G_*` poses in the sunroof | 48 × 48 box, anchor (24, 47): his feet, inside the car |
 * | `boss/sewers-gerrit/run` | 6, the flee | his feet |
 * | `boss/sewers-gerrit/pellet` · `chain` (4) · `flame` (3) · `glint` (3) · `door-bit` | small parts | centre (flame: its foot) |
 *
 * `gerrit` is the baked strip `sunroof` placed in the stand-in's fixed 48 × 48 box: limo.ts clips the
 * frame by buffer rows (`gerritSrc`, only the rows above the roof), which needs the anchor at row 47
 * on every frame; a baked frame is cropped to its pixels.
 */
import { bakedPalette, decodeBakedFrame, defineBakedSet } from '../../../../engine/baked';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { SET } from '../../sewers/art40/sewers-gerrit.gen';
import { GERRIT_ART } from './numbers';

export { G_FIRE, G_GLOAT, G_IDLE, G_PUMP_A, G_PUMP_B, G_SHOCK, G_SHOUT, G_SLUMP, G_SWING, G_THROW, LIMO_CLEAN, LIMO_WRECK } from '../../sewers/art40/sewers-gerrit.gen';

export const GERRIT_SPRITE = {
  limo: `${GERRIT_ART}/limo`,
  door: `${GERRIT_ART}/door`,
  gerrit: `${GERRIT_ART}/gerrit`,
  run: `${GERRIT_ART}/run`,
  pellet: `${GERRIT_ART}/pellet`,
  chain: `${GERRIT_ART}/chain`,
  flame: `${GERRIT_ART}/flame`,
  glint: `${GERRIT_ART}/glint`,
  doorBit: `${GERRIT_ART}/door-bit`,
} as const;

/** The box limo.ts clips Gerrit in (`gerritSrc` 48 × 48, the anchor on row 47). */
const BOX = 48;
const BOX_OX = 24;
const BOX_OY = 47;

defineBakedSet(SET);

/** A baked frame copied into the fixed box (pixels outside it are dropped; the set's bake checks none are). */
function boxed(f: Frame): Frame {
  const out = new PixelBuffer(BOX, BOX);
  const dx = BOX_OX - f.ox;
  const dy = BOX_OY - f.oy;
  for (let y = 0; y < f.buf.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= BOX) continue;
    for (let x = 0; x < f.buf.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= BOX) continue;
      const c = f.buf.data[y * f.buf.w + x];
      if (c !== 0) out.data[ty * BOX + tx] = c;
    }
  }
  return { buf: out, ox: BOX_OX, oy: BOX_OY };
}

const sunroof = SET.strips.sunroof;
defineSprite(
  GERRIT_SPRITE.gerrit,
  () => {
    const pal = bakedPalette(SET.pal);
    return sunroof.frames.map((f) => boxed(decodeBakedFrame(f, pal)));
  },
  { durations: sunroof.durations, loop: sunroof.loop },
);
