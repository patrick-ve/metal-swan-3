/**
 * Our own pixel lettering for the ring's signs and vehicles (docs/design/ring.md §11, §12: signs
 * use our own lettering): a 3 × 5 bitmap face drawn at any logical size, so the same text reads at
 * 1× (one px per bit) and is drawn natively at 2× and 4× (each bit a block of art px).
 *
 * `glyphHit(text, x, y, s, gap, px, py)`: is the point (px, py) (logical, continuous) on the
 * text set from its top-left (x, y) with bits of `s` logical px and `gap` bits between letters?
 * Use it from an `HdCanvas.paint` callback. `textWidth(text, s, gap)` measures it.
 */

const ROWS: Readonly<Record<string, readonly string[]>> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '!': ['010', '010', '010', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

/** Width of a letter in bits (the narrow ones: '1', '!', ' ' count 3 as well: a fixed pitch). */
const GLYPH_W = 3;
export const GLYPH_H = 5;

/** Logical width of `text` set with bits of `s` px and `gap` bits between letters. */
export function textWidth(text: string, s = 1, gap = 1): number {
  if (text.length === 0) return 0;
  return (text.length * GLYPH_W + (text.length - 1) * gap) * s;
}

/** Is the logical point (px, py) on a bit of `text` set at top-left (x, y)? */
export function glyphHit(text: string, x: number, y: number, s: number, gap: number, px: number, py: number): boolean {
  const u = (px - x) / s;
  const v = (py - y) / s;
  if (v < 0 || v >= GLYPH_H || u < 0) return false;
  const pitch = GLYPH_W + gap;
  const i = Math.floor(u / pitch);
  if (i >= text.length) return false;
  const cu = Math.floor(u - i * pitch);
  if (cu >= GLYPH_W) return false;
  const rows = ROWS[text[i]] ?? ROWS[' '];
  return rows[Math.floor(v)][cu] === '1';
}

/** `glyphHit` for text centred on (cx, cy). */
export function glyphHitC(text: string, cx: number, cy: number, s: number, gap: number, px: number, py: number): boolean {
  return glyphHit(text, cx - textWidth(text, s, gap) / 2, cy - (GLYPH_H * s) / 2, s, gap, px, py);
}
