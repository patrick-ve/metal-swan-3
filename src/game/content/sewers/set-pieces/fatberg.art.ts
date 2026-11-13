/**
 * STAND-IN art of `sewers-fatberg` (docs/design/sewers.md §5.4; wave P1b D). Plain code-drawn
 * frames at the play size so the grey play reads; wave P6 swaps in the kit's painting (the look
 * sample's fatberg as the entity's canal sprite, the stages as its frames) under the same ids,
 * anchors and sizes.
 *
 * - `prop/sewers-fatberg/big`      4 frames: intact, cracked (≤ 75 %), split (≤ 50 %), about to give
 *   (≤ 25 %); 80 × 104, feet anchor (bottom centre); the three rat holes on the left face
 * - `prop/sewers-fatberg/big-slump` 6 frames: the mass sags and spreads into the slick (frame 5)
 * - `prop/sewers-fatberg/small`    2 frames: the secret one in the side-tunnel mouth (40 × 36),
 *   frame 1 = the gold glint of what it hides (the hint)
 * - `prop/sewers-fatberg/small-slump` 6 frames, as the big one
 *
 * The sprite ids carry the `sewers-` segment, so they load with the lazy chunk.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';

/** Sprite prefix. */
export const FATBERG_ART = 'prop/sewers-fatberg';

/** The play sizes (px) of the two fatbergs and the big one's rat holes (dx, dy from the feet). */
export const FATBERG_SIZE = {
  big: { w: 80, h: 104 },
  small: { w: 40, h: 36 },
} as const;

/** The big fatberg's rat holes on its left face: the rim's y above the feet (the art draws them at the face). */
export const FATBERG_HOLES: readonly number[] = [-8, -44, -78];

/** Fat, grease and wet wipes: dark → light. */
const FAT: readonly Color[] = [PAL.olive[0], PAL.olive[2], PAL.sand[0], PAL.sand[1], PAL.sand[2]];
const WIPE: Color = PAL.snow[1];
const SLIME: Color = PAL.green[2];

/** The lumpy mass (w × h in a buffer of bw × bh, bottom centre at (ox, oy)), squashed by `sag` (0…1). */
function mass(b: PixelBuffer, w: number, h: number, ox: number, oy: number, sag: number, seed: number): void {
  const hh = Math.max(4, Math.round(h * (1 - sag)));
  const ww = Math.round(w * (1 + sag * 0.6));
  const x0 = ox - Math.floor(ww / 2);
  // The body: an ellipse-topped block, filled with lumps of fat in four tones.
  for (let y = 0; y < hh; y++) {
    const t = y / hh;
    // A dome on top, then a lumpy upright face (a rounded mound).
    const bump = hash2(Math.floor(y / 6), 3, seed) < 0.5 ? 0 : 1;
    const half = Math.round((ww / 2) * Math.sqrt(Math.min(1, 0.12 + t * 3.2))) - bump;
    for (let x = -half; x < half; x++) {
      const v = hash2(Math.floor((x + 200) / 3), Math.floor((y + 200) / 3), seed);
      const tone = v < 0.12 ? 1 : v < 0.5 ? 2 : v < 0.88 ? 3 : 4;
      const edge = x === -half || x === half - 1 || y === 0;
      b.set(ox + x, oy - hh + y, edge ? FAT[0] : FAT[tone]);
    }
  }
  // Wet wipes tangled in it (white streaks), a few lost things (a bottle cap, a sock).
  const n = Math.max(3, Math.round((ww * hh) / 260));
  for (let i = 0; i < n; i++) {
    const wx = x0 + 3 + Math.floor(hash2(i, 1, seed) * (ww - 8));
    const wy = oy - hh + 3 + Math.floor(hash2(i, 2, seed) * (hh - 6));
    if (b.get(wx, wy) === 0 || b.get(wx + 4, wy + 1) === 0) continue;
    b.line(wx, wy, wx + 3 + Math.floor(hash2(i, 3, seed) * 4), wy + 1, WIPE);
  }
  // Slime drips down the face.
  for (let i = 0; i < 4; i++) {
    const dx = x0 + 4 + Math.floor(hash2(i, 5, seed) * (ww - 8));
    for (let y = oy - Math.round(hh * 0.4); y < oy - 1; y++) if (b.get(dx, y) !== 0 && hash2(dx, y, seed + 9) < 0.7) b.set(dx, y, SLIME);
  }
}

/** Cracks: `stage` (0…3) dark-green rifts from the top down. */
function cracks(b: PixelBuffer, w: number, h: number, ox: number, oy: number, stage: number, seed: number): void {
  for (let k = 0; k < stage * 2; k++) {
    let x = ox + Math.round((hash2(k, 7, seed) - 0.5) * w * 0.6);
    let y = oy - h + 6 + Math.floor(hash2(k, 8, seed) * 10);
    const len = Math.round(h * (0.3 + 0.2 * stage));
    for (let i = 0; i < len; i++) {
      if (b.get(x, y) !== 0) b.set(x, y, PAL.green[0]);
      if (stage >= 2 && b.get(x + 1, y) !== 0) b.set(x + 1, y, PAL.ink[1]);
      y++;
      x += hash2(k, i, seed) < 0.33 ? -1 : hash2(k, i, seed) > 0.66 ? 1 : 0;
    }
  }
}

/** The dark rat holes on the left face (relative to the feet anchor). */
function holes(b: PixelBuffer, w: number, ox: number, oy: number): void {
  for (const dy of FATBERG_HOLES) {
    const cx = ox - Math.floor(w / 2) + 7;
    const cy = oy + dy - 4;
    b.ellipse(cx - 5, cy - 3, 10, 7, PAL.ink[1]);
    b.ellipse(cx - 3, cy - 2, 6, 4, PAL.ink[0]);
    b.hline(cx - 4, cx + 3, cy + 3, FAT[4]);
  }
}

function bigFrame(stage: number): PixelBuffer {
  const { w, h } = FATBERG_SIZE.big;
  const b = new PixelBuffer(w + 4, h + 2);
  const ox = Math.floor((w + 4) / 2);
  const oy = h + 2 - 1;
  mass(b, w, h, ox, oy, 0, 41);
  holes(b, w, ox, oy);
  cracks(b, w, h, ox, oy, stage, 43);
  return b;
}

function slumpFrame(size: { w: number; h: number }, k: number, seed: number): PixelBuffer {
  const { w, h } = size;
  const bw = Math.ceil(w * 1.7) + 4;
  const b = new PixelBuffer(bw, h + 2);
  const ox = Math.floor(bw / 2);
  const oy = h + 2 - 1;
  // k 0…4: sagging; 5: the flat slick that stays.
  const sag = k >= 5 ? 0.94 : 0.18 * (k + 1);
  mass(b, w, h, ox, oy, sag, seed);
  if (k >= 5) b.hline(ox - Math.round(w * 0.7), ox + Math.round(w * 0.7), oy, SLIME);
  return b;
}

function smallFrame(glint: boolean): PixelBuffer {
  const { w, h } = FATBERG_SIZE.small;
  const b = new PixelBuffer(w + 2, h + 2);
  const ox = Math.floor((w + 2) / 2);
  const oy = h + 2 - 1;
  mass(b, w, h, ox, oy, 0, 77);
  // A sliver of gold in the fat: what it hides (the hint).
  b.rect(ox + 4, oy - 15, 3, 2, PAL.gold[2]);
  if (glint) {
    b.set(ox + 5, oy - 18, PAL.gold[3]);
    b.set(ox + 5, oy - 12, PAL.gold[3]);
    b.set(ox + 2, oy - 15, PAL.gold[3]);
    b.set(ox + 8, oy - 15, PAL.gold[3]);
    b.set(ox + 5, oy - 15, PAL.snow[3]);
  }
  return b;
}

defineSprite(`${FATBERG_ART}/big`, () => [0, 1, 2, 3].map(bigFrame), { loop: false });
defineSprite(`${FATBERG_ART}/big-slump`, () => [0, 1, 2, 3, 4, 5].map((k) => slumpFrame(FATBERG_SIZE.big, k, 41)), { ticksPerFrame: 6, loop: false });
defineSprite(`${FATBERG_ART}/small`, () => [smallFrame(false), smallFrame(true)], { loop: false });
defineSprite(`${FATBERG_ART}/small-slump`, () => [0, 1, 2, 3, 4, 5].map((k) => slumpFrame(FATBERG_SIZE.small, k, 77)), { ticksPerFrame: 6, loop: false });
