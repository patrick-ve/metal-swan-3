/**
 * Small character head icons for the high-score table (GDD §13.14), made from each
 * character's 32 × 32 `char/<id>/portrait`: the portrait is a Scale2x enlargement of the 1×
 * head, so taking every second pixel gives the 1× head back; the portrait's background is
 * dropped and the head trimmed to at most 12 × 12. Rows without a playable character get a
 * little Legion shako. Built once per id; pure, no DOM.
 *
 * UHD (2× and 4×): the same icons are the sprites `ui/score-head/<id>` (`headSpriteId`;
 * content/ui/ending.art.ts: their 1× frame is `headIcon`, their HD frames are painted natively
 * from the same crop, `headCrop`); high-scores.ts draws them at the screen density.
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import { getFrame, hasSprite } from '../../engine/sprites';
import { getCharacter, hasCharacter } from '../registry';

/** The portrait background colours (human-sprites.ts `portrait`), dropped from the icon. */
export const HEAD_BACKGROUND: ReadonlySet<Color> = new Set([PAL.navy[0], PAL.navy[1], PAL.purple[0]]);
const MAX = 12;
const cache = new Map<string, PixelBuffer | null>();
const crops = new Map<string, HeadCrop | null>();

/** The Legion shako's design (8 × 11 inside a 10 × 13 icon) and its colour key. */
export const LEGION_HEAD = {
  rows: ['...ww...', '...ww...', '..kkkk..', '..kkkk..', '..kgkk..', '..kkkk..', '.rrrrrr.', '.rssssr.', '..s.ks..', '..ssss..', '...rr...'],
  key: { w: PAL.snow[3], k: PAL.black[1], g: PAL.gold[3], r: PAL.red[2], s: PAL.skinA[2] } as Readonly<Record<string, Color>>,
} as const;

/** A crimson Legion shako with a white plume and a gold badge (8 × 11). */
function legionShako(): PixelBuffer {
  const { rows, key } = LEGION_HEAD;
  const b = new PixelBuffer(10, 13);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = key[row[x]];
      if (c !== undefined) b.set(x + 1, y + 1, c);
    }
  });
  return b.outline(INK);
}

/**
 * Where a character's icon comes from: the rectangle (x, y, w, h) of the head in the portrait's
 * half-size grid (grid px (x, y) is portrait px (1 + 2x, 1 + 2y)). The icon is that rectangle,
 * its background dropped, padded by 1 px and outlined in ink.
 */
export interface HeadCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Every second pixel of the 1× portrait's inner area (inside its 1 px frame), background dropped; 1 px padding. */
function halfGrid(id: string): PixelBuffer | null {
  const portraitId = `${getCharacter(id).art}/portrait`;
  if (!hasSprite(portraitId)) return null;
  // The 1× portrait (density 1 whatever the art density): its pixels are read one by one.
  const src = getFrame(portraitId, 0, 1).buf;
  const w = Math.floor((src.w - 2) / 2);
  const h = Math.floor((src.h - 2) / 2);
  const small = new PixelBuffer(w + 2, h + 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = src.get(1 + x * 2, 1 + y * 2);
      if ((c & 255) === 0 || HEAD_BACKGROUND.has(c)) continue;
      small.set(x + 1, y + 1, c);
    }
  }
  return small;
}

/** The icon's crop of a character with a portrait (null without one, or with an empty portrait). */
export function headCrop(id: string): HeadCrop | null {
  if (crops.has(id)) return crops.get(id) ?? null;
  let crop: HeadCrop | null = null;
  const small = hasCharacter(id) ? halfGrid(id) : null;
  const box = small?.trimBounds();
  if (box) {
    // The head is at the top: keep at most MAX rows and MAX columns around its middle.
    const cw = Math.min(MAX, box.w);
    const ch = Math.min(MAX, box.h);
    const cx = box.x + ((box.w - cw) >> 1);
    crop = { x: cx - 1, y: box.y - 1, w: cw, h: ch };
  }
  crops.set(id, crop);
  return crop;
}

function fromPortrait(id: string): PixelBuffer | null {
  const crop = headCrop(id);
  const small = crop ? halfGrid(id) : null;
  if (!crop || !small) return null;
  return small.crop(crop.x + 1, crop.y + 1, crop.w, crop.h).padded(1).outline(INK);
}

/** The head icon of a character id ('' or 'legion': the Legion shako); null when none. */
export function headIcon(id: string): PixelBuffer | null {
  const key = id || 'legion';
  if (cache.has(key)) return cache.get(key) ?? null;
  const icon = key === 'legion' || !hasCharacter(key) ? (key === 'legion' || !id ? legionShako() : null) : fromPortrait(key);
  cache.set(key, icon);
  return icon;
}

/** The sprite of a head icon at the dense densities ('' → 'legion'). */
export function headSpriteId(id: string): string {
  return `ui/score-head/${id || 'legion'}`;
}
