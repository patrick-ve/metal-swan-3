/**
 * Shared drawing helpers of mission m4 (OPENING NIGHT): the Grand Marshal's face for posters and
 * billboards, neon text panels. Pure functions on a PixelBuffer, palette colours only.
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import type { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';

/**
 * Bombastian Fanfaroni's propaganda portrait (GDD §2.2): a round face under a huge gold-and-
 * crimson bicorne with three white plumes, a curled moustache past the ears. `s` = scale (1 =
 * 24 px wide). (cx, cy) = the centre of the face. `look` −1 / 0 / 1 moves the pupils.
 */
export function fanfaroniFace(b: PixelBuffer, cx: number, cy: number, s = 1, look = 0): void {
  const r = Math.max(4, Math.round(7 * s));
  // Face.
  b.circle(cx, cy, r, PAL.skinA[1]);
  b.circle(cx - Math.round(r * 0.2), cy - Math.round(r * 0.2), r - Math.max(1, Math.round(s)), PAL.skinA[2]);
  // Bicorne: a wide crimson crescent with a gold rim and three white plumes.
  const hw = Math.round(r * 1.9);
  const hy = cy - r + 1;
  const hh = Math.max(3, Math.round(r * 0.75));
  b.ellipse(cx - hw, hy - hh, hw * 2 + 1, hh * 2, PAL.red[1]);
  b.ellipse(cx - hw + 1, hy - hh + 1, hw * 2 - 1, hh * 2 - 3, PAL.red[2]);
  b.hline(cx - hw, cx + hw, hy + hh - 1, PAL.gold[2]);
  b.hline(cx - hw + 1, cx + hw - 1, hy + hh - 2, PAL.gold[1]);
  b.rect(cx - hw - 1, hy + hh - 2, hw * 2 + 3, Math.max(1, Math.round(s)), PAL.gold[2]);
  b.circle(cx, hy, Math.max(1, Math.round(s * 1.5)), PAL.gold[3]);
  for (let i = -1; i <= 1; i++) {
    const px = cx + i * Math.round(r * 0.6);
    b.ellipse(px - Math.round(2 * s), hy - hh - Math.round(5 * s), Math.round(4 * s) + 1, Math.round(6 * s), PAL.snow[2]);
  }
  // Eyes (they follow the viewer when `look` changes).
  const ey = cy - Math.round(r * 0.15);
  const ex = Math.round(r * 0.4);
  const er = Math.max(1, Math.round(1.4 * s));
  for (const sx of [-1, 1]) {
    b.circle(cx + sx * ex, ey, er, PAL.snow[3]);
    b.set(cx + sx * ex + look * Math.max(0, er - 1), ey, INK);
  }
  // Nose and the curled moustache.
  b.circle(cx, cy + Math.round(r * 0.15), Math.max(1, Math.round(s * 1.2)), PAL.skinA[0]);
  const my = cy + Math.round(r * 0.45);
  const mw = Math.round(r * 1.5);
  b.thickLine(cx - mw, my - Math.round(r * 0.3), cx, my, Math.max(2, Math.round(2 * s)), PAL.hairA[1]);
  b.thickLine(cx + mw, my - Math.round(r * 0.3), cx, my, Math.max(2, Math.round(2 * s)), PAL.hairA[1]);
  b.set(cx - mw - 1, my - Math.round(r * 0.3) - 1, PAL.hairA[2]);
  b.set(cx + mw + 1, my - Math.round(r * 0.3) - 1, PAL.hairA[2]);
  // Open shouting mouth.
  b.ellipse(cx - Math.round(r * 0.25), my + 1, Math.max(3, Math.round(r * 0.5)), Math.max(2, Math.round(r * 0.35)), PAL.red[0]);
}

/** A framed neon panel with text (big or small font). Returns the panel width. */
export function neonPanel(
  b: PixelBuffer,
  x: number,
  y: number,
  text: string,
  neon: readonly Color[],
  o: { font?: 'big' | 'small'; crossed?: boolean; back?: Color } = {},
): number {
  const font = o.font ?? 'big';
  const tw = measure(text, font);
  const lines = text.split('\n').length;
  const w = tw + 10;
  const h = lines * 10 + 6;
  b.rect(x, y, w, h, o.back ?? PAL.ink[0]);
  const lit = !o.crossed;
  const frame = lit ? neon[1] : PAL.stone[0];
  b.strokeRect(x, y, w, h, frame);
  b.strokeRect(x + 1, y + 1, w - 2, h - 2, lit ? neon[0] : PAL.ink[1]);
  drawText(b, text, x + 5, y + 4, { font, color: lit ? neon[2] : PAL.stone[1], outline: lit ? neon[0] : undefined, align: 'left' });
  if (o.crossed) {
    // Painted over with a crimson X: the town's old name.
    b.thickLine(x + 2, y + 2, x + w - 3, y + h - 3, 2, PAL.red[2]);
    b.thickLine(x + 2, y + h - 3, x + w - 3, y + 2, 2, PAL.red[2]);
  }
  return w;
}

/** Neon colour sets (dark rim, tube, hot core). */
export const NEON = {
  pink: [PAL.pink[0], PAL.pink[1], PAL.pink[2]],
  cyan: [PAL.teal[1], PAL.teal[2], PAL.teal[3]],
  gold: [PAL.orange[1], PAL.gold[2], PAL.gold[3]],
  red: [PAL.red[1], PAL.red[2], PAL.red[3]],
} as const satisfies Record<string, readonly Color[]>;
