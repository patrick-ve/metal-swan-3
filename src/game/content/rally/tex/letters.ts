/**
 * The rally cars' pixel lettering (docs/design/rally.md §6, §11: our own lettering, never a traced
 * logo): condensed block capitals for the 1× car textures. SMALL glyphs are 3 × 5 texels (I 1, M / N /
 * W / G 4–5 wide), BIG ones 4 × 6 (for `MAJOR`). The letters the ring wagon font already had keep
 * its shapes (src/game/content/ring/wagon/font.ts), so the two estates letter the same in 2D and 3D;
 * the rest (B D F H Q U V Y, 4 5 7, punctuation) are drawn here in the same style.
 *
 * `paintText` writes palette indices into a `PageBuilder` rectangle, left to right as it reads:
 * the car painters place each text on the side, the roof or a plate in the texture's own reading
 * direction (tex/car-sheet.ts), so no text is ever mirrored. Pure; setup code.
 */
import type { PageBuilder, TexRect } from './kit';

export type LetterSize = 'small' | 'big';

/** Small capitals and digits ('#' = ink, top to bottom). */
const SMALL: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##.', '#...', '#.##', '#..#', '.##.'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['#', '#', '#', '#', '#'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '#.#', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '-': ['...', '...', '###', '...', '...'],
  '.': ['.', '.', '.', '.', '#'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  "'": ['#', '#', '.', '.', '.'],
  ' ': ['..', '..', '..', '..', '..'],
};

/** Big capitals (4 × 6; M 5 × 6); a letter without a big glyph uses the small one. */
const BIG: Readonly<Record<string, readonly string[]>> = {
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#'],
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
  J: ['...#', '...#', '...#', '...#', '#..#', '.##.'],
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'],
};

/** The glyph rows of a character (unknown characters are a space). */
export function glyphRows(ch: string, size: LetterSize = 'small'): readonly string[] {
  return (size === 'big' ? BIG[ch] : undefined) ?? SMALL[ch] ?? SMALL[' '];
}

/** Can the lettering write every character of `s`? */
export function canLetter(s: string): boolean {
  for (const ch of s) if (!SMALL[ch]) return false;
  return true;
}

/** Glyph height in texels. */
export function letterHeight(size: LetterSize = 'small'): number {
  return size === 'big' ? 6 : 5;
}

/** Width of `s` in texels with `gap` texels between the glyphs. */
export function letterWidth(s: string, size: LetterSize = 'small', gap = 1): number {
  let w = 0;
  let n = 0;
  for (const ch of s) {
    w += glyphRows(ch, size)[0].length;
    n++;
  }
  return n > 0 ? w + gap * (n - 1) : 0;
}

/**
 * Write `s` with its top-left corner at texel (x, y) of `r` (clipped to `r`), palette index `i`;
 * `gap` texels between the glyphs; `shadow` (an index) adds a 1-texel drop shadow down-right.
 */
export function paintText(b: PageBuilder, r: TexRect, s: string, x: number, y: number, i: number, o: { size?: LetterSize; gap?: number; shadow?: number } = {}): void {
  const size = o.size ?? 'small';
  const gap = o.gap ?? 1;
  const pass = (dx: number, dy: number, idx: number): void => {
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of s) {
      const rows = glyphRows(ch, size);
      for (let gy = 0; gy < rows.length; gy++) {
        const row = rows[gy];
        for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') b.set(r, cx + gx + dx, cy + gy + dy, idx);
      }
      cx += rows[0].length + gap;
    }
  };
  if (o.shadow !== undefined) pass(1, 1, o.shadow);
  pass(0, 0, i);
}
