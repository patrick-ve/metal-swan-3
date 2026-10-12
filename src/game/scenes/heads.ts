/**
 * Small character head icons for the high-score table (GDD §13.14), made from each
 * character's 32 × 32 `char/<id>/portrait`: the portrait is a Scale2x enlargement of the 1×
 * head, so taking every second pixel gives the 1× head back; the portrait's background is
 * dropped and the head trimmed to at most 12 × 12. Rows without a playable character get a
 * little Legion shako. Built once per id; pure, no DOM.
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import { getFrame, hasSprite } from '../../engine/sprites';
import { getCharacter, hasCharacter } from '../registry';

/** The portrait background colours (human-sprites.ts `portrait`), dropped from the icon. */
const BACKGROUND: ReadonlySet<Color> = new Set([PAL.navy[0], PAL.navy[1], PAL.purple[0]]);
const MAX = 12;
const cache = new Map<string, PixelBuffer | null>();

/** A crimson Legion shako with a white plume and a gold badge (8 × 11). */
function legionShako(): PixelBuffer {
  const rows = ['...ww...', '...ww...', '..kkkk..', '..kkkk..', '..kgkk..', '..kkkk..', '.rrrrrr.', '.rssssr.', '..s.ks..', '..ssss..', '...rr...'];
  const key: Readonly<Record<string, Color>> = { w: PAL.snow[3], k: PAL.black[1], g: PAL.gold[3], r: PAL.red[2], s: PAL.skinA[2] };
  const b = new PixelBuffer(10, 13);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = key[row[x]];
      if (c !== undefined) b.set(x + 1, y + 1, c);
    }
  });
  return b.outline(INK);
}

function fromPortrait(id: string): PixelBuffer | null {
  const portraitId = `${getCharacter(id).art}/portrait`;
  if (!hasSprite(portraitId)) return null;
  const src = getFrame(portraitId, 0).buf;
  // Every second pixel of the inner area (inside the 1 px frame).
  const w = Math.floor((src.w - 2) / 2);
  const h = Math.floor((src.h - 2) / 2);
  const small = new PixelBuffer(w + 2, h + 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = src.get(1 + x * 2, 1 + y * 2);
      if ((c & 255) === 0 || BACKGROUND.has(c)) continue;
      small.set(x + 1, y + 1, c);
    }
  }
  const box = small.trimBounds();
  if (!box) return null;
  // The head is at the top: keep at most MAX rows and MAX columns around its middle.
  const cw = Math.min(MAX, box.w);
  const ch = Math.min(MAX, box.h);
  const cx = box.x + ((box.w - cw) >> 1);
  return small.crop(cx, box.y, cw, ch).padded(1).outline(INK);
}

/** The head icon of a character id ('' or 'legion': the Legion shako); null when none. */
export function headIcon(id: string): PixelBuffer | null {
  const key = id || 'legion';
  if (cache.has(key)) return cache.get(key) ?? null;
  const icon = key === 'legion' || !hasCharacter(key) ? (key === 'legion' || !id ? legionShako() : null) : fromPortrait(key);
  cache.set(key, icon);
  return icon;
}
