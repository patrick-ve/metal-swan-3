/**
 * Our own pixel lettering for the blockade's signs and the pink boat (docs/design/ring.md §R.6,
 * §R.7, §R.9: our own lettering, never mirrored; never the real movement's fonts): two bitmap faces
 * drawn at any logical bit size, so a text reads at 1× (one or two px per bit) and is drawn natively
 * at 2× / 4× (each bit a block of art px; the caller roughens the edges for a hand-painted look).
 *
 * - `SMALL`: a 3 × 5 face (the ring's sign face, with `.` `,` `!` `-` added for the Dutch lines);
 *   M and W are 5 bits wide and N 4 (with diagonal middles), so they never read as H at 2× / 4×.
 * - `BOLD`: a chunky brush-letter face, 7 bits tall, variable width (the spandoek's title).
 *
 * `faceHit(face, text, x, y, s, gap, px, py)`: is the point (logical, continuous) on the text set at
 * top-left (x, y)? `faceWidth(face, text, s, gap)` measures it; `faceHitC` centres it. Pure: no imports.
 */

export interface Face {
  readonly h: number;
  readonly rows: Readonly<Record<string, readonly string[]>>;
  /** Width of a character missing from `rows` (drawn empty). */
  readonly blank: number;
}

export const SMALL: Face = {
  h: 5,
  blank: 3,
  rows: {
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
    M: ['10001', '11011', '10101', '10001', '10001'],
    N: ['1001', '1101', '1011', '1001', '1001'],
    O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'],
    R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'],
    T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '111'],
    V: ['101', '101', '101', '101', '010'],
    W: ['10001', '10001', '10101', '11011', '10001'],
    X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'],
    Z: ['111', '001', '010', '100', '111'],
    '!': ['1', '1', '1', '0', '1'],
    '.': ['0', '0', '0', '0', '1'],
    ',': ['0', '0', '0', '1', '1'],
    '-': ['00', '00', '11', '00', '00'],
    ' ': ['00', '00', '00', '00', '00'],
  },
};

export const BOLD: Face = {
  h: 7,
  blank: 3,
  rows: {
    A: ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
    B: ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
    E: ['11111', '11000', '11000', '11110', '11000', '11000', '11111'],
    G: ['01111', '11000', '11000', '11011', '11011', '11011', '01111'],
    H: ['11011', '11011', '11011', '11111', '11011', '11011', '11011'],
    I: ['1111', '0110', '0110', '0110', '0110', '0110', '1111'],
    L: ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
    N: ['110011', '111011', '111111', '110111', '110011', '110011', '110011'],
    O: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
    R: ['11110', '11011', '11011', '11110', '11010', '11011', '11011'],
    S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
    T: ['111111', '001100', '001100', '001100', '001100', '001100', '001100'],
    U: ['11011', '11011', '11011', '11011', '11011', '11011', '01110'],
    X: ['11011', '11011', '01110', '00100', '01110', '11011', '11011'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
  },
};

function glyph(face: Face, ch: string): readonly string[] | null {
  return face.rows[ch] ?? null;
}

function charW(face: Face, ch: string): number {
  const g = glyph(face, ch);
  return g ? g[0].length : face.blank;
}

/** Logical width of `text` in `face` with bits of `s` px and `gap` bits between letters. */
export function faceWidth(face: Face, text: string, s = 1, gap = 1): number {
  if (text.length === 0) return 0;
  let w = 0;
  for (let i = 0; i < text.length; i++) w += charW(face, text[i]) + (i > 0 ? gap : 0);
  return w * s;
}

/** Is the logical point (px, py) on a bit of `text` set at top-left (x, y)? */
export function faceHit(face: Face, text: string, x: number, y: number, s: number, gap: number, px: number, py: number): boolean {
  const u = (px - x) / s;
  const v = (py - y) / s;
  if (v < 0 || v >= face.h || u < 0) return false;
  let cx = 0;
  for (let i = 0; i < text.length; i++) {
    const w = charW(face, text[i]);
    if (u < cx + w) {
      const g = glyph(face, text[i]);
      if (!g) return false;
      return g[Math.floor(v)][Math.floor(u - cx)] === '1';
    }
    cx += w + gap;
    if (u < cx) return false;
  }
  return false;
}

/** `faceHit` for text centred on (cx, cy). */
export function faceHitC(face: Face, text: string, cx: number, cy: number, s: number, gap: number, px: number, py: number): boolean {
  return faceHit(face, text, cx - faceWidth(face, text, s, gap) / 2, cy - (face.h * s) / 2, s, gap, px, py);
}

/** Split a sign text into at most two lines at the space nearest the middle (cardboard placards). */
export function twoLines(text: string): [string, string] {
  if (text.length <= 10) return [text, ''];
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i;
  return best < 0 ? [text, ''] : [text.slice(0, best), text.slice(best + 1)];
}
