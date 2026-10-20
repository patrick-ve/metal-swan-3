import type { Color } from './color';
import { WHITE } from './color';
import { HD_RAMP_NAMES, PAL_HD } from './palette-hd';
import { PixelBuffer } from './pixel';
import type { FontId, TextOpts } from './render';

/**
 * Original bitmap fonts defined in code (docs/ARCHITECTURE.md §5.6).
 *
 * - 'small': proportional, caps 5×7 with lower case (x-height 5, 2-row descenders), digits are
 *   all 5 px wide (tabular, so scores do not wobble), punctuation, arrows ← ↑ → ↓, ∞, ©, ×, ♥, ★.
 * - 'big': chunky 8-row arcade capitals with 2-px strokes, digits and punctuation. Lower case
 *   falls back to capitals.
 *
 * Text is laid out by `layoutText`, which BOTH renderers use, so they place glyphs identically.
 * (x, y) is the top-left of the first line's cap height; `align` is per line; '\n' breaks lines.
 *
 * HD glyphs (UHD wave; tests/engine/font-hd.test.ts): every glyph also has a designed table at
 * glyph density 2 and 4 (`glyphMask`), drawn natively at (w·D) × (height·D) art px inside the
 * SAME cell: same advances, line heights, ascent and spacing, so `layoutText`, `measure` and every
 * layout keep their numbers. The renderers pick the density with `glyphDensity` (what the art
 * tier and the backbuffer can show; 1 keeps the bitmap path byte for byte) and draw the HD passes
 * of `hdTextPasses`: shadow, a round outline one cell px wide (outline A), then the fill, lit
 * from the top (`fillColors`).
 */

export interface Glyph {
  readonly code: number;
  readonly w: number;
  /** One bit mask per row of the font cell; bit (w - 1 - x) is column x. */
  readonly rows: Uint32Array;
  /** Position in the font's glyph list (used for atlases). */
  readonly index: number;
}

export interface BitmapFont {
  readonly id: FontId;
  /** Rows in a glyph cell, including descenders. */
  readonly height: number;
  /** Rows above the baseline (cap height). */
  readonly ascent: number;
  /** Distance between lines. */
  readonly lineHeight: number;
  /** Empty columns between glyphs. */
  readonly spacing: number;
  readonly glyphs: readonly Glyph[];
  /** Widest glyph (atlas cell width = maxW + 1). */
  readonly maxW: number;
  /** Glyph for a code point; lower case falls back to capitals, unknown → '?'. */
  glyph(code: number): Glyph;
}

type GlyphTable = Record<string, readonly string[]>;

// prettier-ignore
const SMALL: GlyphTable = {
  ' ': ['...'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'],
  f: ['..##', '.#..', '.#..', '####', '.#..', '.#..', '.#..'],
  g: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#'],
  i: ['#', '.', '#', '#', '#', '#', '#'],
  j: ['..#', '...', '..#', '..#', '..#', '..#', '..#', '..#', '##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  m: ['.....', '.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['....', '....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['...', '.#.', '###', '.#.', '.#.', '.#.', '..#'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'],
  v: ['.....', '.....', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['....', '....', '#..#', '#..#', '.##.', '#..#', '#..#'],
  y: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  z: ['....', '....', '####', '...#', '.##.', '#...', '####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '"': ['#.#', '#.#'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['#', '#'],
  '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
  ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
  '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..'],
  ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  '-': ['....', '....', '....', '####'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  ':': ['.', '.', '#', '.', '.', '.', '#'],
  ';': ['..', '..', '.#', '..', '..', '..', '.#', '#.'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '=': ['....', '....', '####', '....', '####'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '[': ['###', '#..', '#..', '#..', '#..', '#..', '###'],
  '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
  ']': ['###', '..#', '..#', '..#', '..#', '..#', '###'],
  '^': ['..#..', '.#.#.', '#...#'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '`': ['#.', '.#'],
  '{': ['..##', '.#..', '.#..', '#...', '.#..', '.#..', '..##'],
  '|': ['#', '#', '#', '#', '#', '#', '#', '#'],
  '}': ['##..', '..#.', '..#.', '...#', '..#.', '..#.', '##..'],
  '~': ['.....', '.....', '.#...', '#.#.#', '...#.'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '∞': ['.......', '.......', '.##.##.', '#..#..#', '#..#..#', '.##.##.'],
  '©': ['.#####.', '#.....#', '#..##.#', '#.#...#', '#..##.#', '#.....#', '.#####.'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '·': ['.', '.', '.', '#'],
  '°': ['.#.', '#.#', '.#.'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '♥': ['.....', '##.##', '#####', '#####', '.###.', '..#..'],
  '★': ['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#'],
};

// prettier-ignore
const BIG: GlyphTable = {
  ' ': ['....'],
  A: ['..####..', '.######.', '###..###', '##....##', '########', '########', '##....##', '##....##'],
  B: ['#######.', '########', '##....##', '#######.', '#######.', '##....##', '########', '#######.'],
  C: ['.######.', '########', '##....##', '##......', '##......', '##....##', '########', '.######.'],
  D: ['######..', '#######.', '##...###', '##....##', '##....##', '##...###', '#######.', '######..'],
  E: ['########', '########', '##......', '######..', '######..', '##......', '########', '########'],
  F: ['########', '########', '##......', '######..', '######..', '##......', '##......', '##......'],
  G: ['.######.', '########', '##......', '##..####', '##..####', '##....##', '########', '.######.'],
  H: ['##....##', '##....##', '##....##', '########', '########', '##....##', '##....##', '##....##'],
  I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '######', '######'],
  J: ['....####', '....####', '......##', '......##', '##....##', '##....##', '########', '.######.'],
  K: ['##....##', '##...###', '##..###.', '######..', '#####...', '##.####.', '##...###', '##....##'],
  L: ['##......', '##......', '##......', '##......', '##......', '##......', '########', '########'],
  M: ['##....##', '###..###', '########', '##.##.##', '##.##.##', '##....##', '##....##', '##....##'],
  N: ['##....##', '###...##', '####..##', '##.##.##', '##..####', '##...###', '##....##', '##....##'],
  O: ['.######.', '########', '##....##', '##....##', '##....##', '##....##', '########', '.######.'],
  P: ['#######.', '########', '##....##', '########', '#######.', '##......', '##......', '##......'],
  Q: ['.######.', '########', '##....##', '##....##', '##..#.##', '##...###', '########', '.#######'],
  R: ['#######.', '########', '##....##', '########', '#######.', '##..###.', '##...###', '##....##'],
  S: ['.#######', '########', '##......', '#######.', '.#######', '......##', '########', '#######.'],
  T: ['########', '########', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...'],
  U: ['##....##', '##....##', '##....##', '##....##', '##....##', '##....##', '########', '.######.'],
  V: ['##....##', '##....##', '##....##', '##....##', '###..###', '.######.', '..####..', '...##...'],
  W: ['##....##', '##....##', '##....##', '##.##.##', '##.##.##', '########', '###..###', '##....##'],
  X: ['##....##', '###..###', '.######.', '..####..', '..####..', '.######.', '###..###', '##....##'],
  Y: ['##....##', '##....##', '###..###', '.######.', '..####..', '...##...', '...##...', '...##...'],
  Z: ['########', '########', '.....###', '....###.', '...###..', '..###...', '########', '########'],
  '0': ['.######.', '########', '##...###', '##..####', '####..##', '###...##', '########', '.######.'],
  '1': ['...##...', '..###...', '.####...', '...##...', '...##...', '...##...', '.######.', '.######.'],
  '2': ['.######.', '########', '##....##', '....###.', '..###...', '.###....', '########', '########'],
  '3': ['#######.', '########', '......##', '..#####.', '..#####.', '......##', '########', '#######.'],
  '4': ['....###.', '...####.', '..##.##.', '.##..##.', '########', '########', '.....##.', '.....##.'],
  '5': ['########', '########', '##......', '#######.', '########', '......##', '########', '#######.'],
  '6': ['.######.', '########', '##......', '#######.', '########', '##....##', '########', '.######.'],
  '7': ['########', '########', '.....###', '....###.', '...###..', '...##...', '...##...', '...##...'],
  '8': ['.######.', '########', '##....##', '.######.', '########', '##....##', '########', '.######.'],
  '9': ['.######.', '########', '##....##', '########', '.#######', '......##', '########', '.######.'],
  '!': ['##', '##', '##', '##', '##', '..', '##', '##'],
  '"': ['##.##', '##.##', '#..#.'],
  '#': ['.##..##.', '########', '########', '.##..##.', '.##..##.', '########', '########', '.##..##.'],
  $: ['...##...', '.#######', '##.##...', '.######.', '...##.##', '#######.', '...##...', '........'],
  '%': ['###...##', '###..###', '....###.', '...###..', '..###...', '.###....', '###..###', '##...###'],
  '&': ['.####...', '##..##..', '.####...', '.####.##', '##..###.', '##...##.', '########', '.####.##'],
  "'": ['##', '##', '#.'],
  '(': ['..##', '.##.', '##..', '##..', '##..', '##..', '.##.', '..##'],
  ')': ['##..', '.##.', '..##', '..##', '..##', '..##', '.##.', '##..'],
  '*': ['........', '.##..##.', '..####..', '########', '..####..', '.##..##.'],
  '+': ['......', '..##..', '..##..', '######', '######', '..##..', '..##..'],
  ',': ['..', '..', '..', '..', '..', '##', '##', '#.'],
  '-': ['......', '......', '......', '######', '######'],
  '.': ['..', '..', '..', '..', '..', '..', '##', '##'],
  '/': ['......##', '.....###', '....###.', '...###..', '..###...', '.###....', '###.....', '##......'],
  ':': ['..', '##', '##', '..', '..', '##', '##'],
  ';': ['..', '##', '##', '..', '..', '##', '##', '#.'],
  '<': ['...##', '..##.', '.##..', '##...', '##...', '.##..', '..##.', '...##'],
  '=': ['......', '......', '######', '######', '......', '######', '######'],
  '>': ['##...', '.##..', '..##.', '...##', '...##', '..##.', '.##..', '##...'],
  '?': ['.######.', '########', '##....##', '....####', '...####.', '...##...', '........', '...##...'],
  '@': ['.######.', '##....##', '##.#####', '##.##.##', '##.#####', '##......', '.#######', '........'],
  '[': ['####', '####', '##..', '##..', '##..', '##..', '####', '####'],
  '\\': ['##......', '###.....', '.###....', '..###...', '...###..', '....###.', '.....###', '......##'],
  ']': ['####', '####', '..##', '..##', '..##', '..##', '####', '####'],
  '^': ['..##..', '.####.', '##..##'],
  _: ['........', '........', '........', '........', '........', '........', '########', '########'],
  '`': ['##.', '.##'],
  '{': ['..###', '.##..', '.##..', '##...', '##...', '.##..', '.##..', '..###'],
  '|': ['##', '##', '##', '##', '##', '##', '##', '##'],
  '}': ['###..', '..##.', '..##.', '...##', '...##', '..##.', '..##.', '###..'],
  '~': ['........', '........', '........', '.###..##', '##.####.', '##..##..'],
  '←': ['...##...', '..##....', '.##.....', '########', '########', '.##.....', '..##....', '...##...'],
  '→': ['...##...', '....##..', '.....##.', '########', '########', '.....##.', '....##..', '...##...'],
  '↑': ['...##...', '..####..', '.######.', '##.##.##', '...##...', '...##...', '...##...', '...##...'],
  '↓': ['...##...', '...##...', '...##...', '...##...', '##.##.##', '.######.', '..####..', '...##...'],
  '×': ['........', '##....##', '.##..##.', '..####..', '..####..', '.##..##.', '##....##'],
  '©': ['.######.', '##....##', '#..###.#', '#.##...#', '#.##...#', '#..###.#', '##....##', '.######.'],
  '♥': ['.##..##.', '########', '########', '########', '.######.', '..####..', '...##...'],
  '★': ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.', '##....##'],
};

function buildFont(
  id: FontId,
  table: GlyphTable,
  height: number,
  ascent: number,
  lineHeight: number,
  upperOnly: boolean,
): BitmapFont {
  const glyphs: Glyph[] = [];
  const byCode = new Map<number, Glyph>();
  const ascii: (Glyph | undefined)[] = new Array(128);
  let maxW = 1;
  for (const [ch, rows] of Object.entries(table)) {
    const code = ch.codePointAt(0) ?? 63;
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const masks = new Uint32Array(height);
    rows.forEach((r, y) => {
      if (y >= height) throw new Error(`font ${id}: glyph "${ch}" has more than ${height} rows`);
      let m = 0;
      for (let x = 0; x < w; x++) if (r[x] === '#') m |= 1 << (w - 1 - x);
      masks[y] = m >>> 0;
    });
    const g: Glyph = { code, w, rows: masks, index: glyphs.length };
    glyphs.push(g);
    byCode.set(code, g);
    if (code < 128) ascii[code] = g;
    maxW = Math.max(maxW, w);
  }
  const fallback = byCode.get(63) as Glyph; // '?'
  return {
    id,
    height,
    ascent,
    lineHeight,
    spacing: 1,
    glyphs,
    maxW,
    glyph(code: number): Glyph {
      const g = code < 128 ? ascii[code] : byCode.get(code);
      if (g) return g;
      if (upperOnly && code >= 97 && code <= 122) return ascii[code - 32] ?? fallback;
      return fallback;
    },
  };
}

const FONTS: Readonly<Record<FontId, BitmapFont>> = {
  small: buildFont('small', SMALL, 9, 7, 10, false),
  big: buildFont('big', BIG, 8, 8, 10, true),
};

export function getFont(id: FontId = 'small'): BitmapFont {
  return FONTS[id] ?? FONTS.small;
}

/** Width in pixels of text[start, end) on one line (no trailing spacing). */
export function lineWidth(text: string, start: number, end: number, font: BitmapFont): number {
  let w = 0;
  let n = 0;
  for (let i = start; i < end; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) continue; // astral glyphs are not supported
    w += font.glyph(code).w;
    n++;
  }
  return n > 0 ? w + (n - 1) * font.spacing : 0;
}

/** Integer text scale ≥ 1. */
export function textScale(o: TextOpts | undefined): number {
  const s = o?.scale;
  return s === undefined ? 1 : Math.max(1, Math.round(s));
}

/** Width in pixels of the widest line (times `scale`). */
export function measure(text: string, font: FontId = 'small', scale = 1): number {
  const f = getFont(font);
  let max = 0;
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text.charCodeAt(i) === 10) {
      max = Math.max(max, lineWidth(text, start, i, f));
      start = i + 1;
    }
  }
  return max * Math.max(1, Math.round(scale));
}

/** Bounding size of drawn text, including outline (+1 each side) and shadow (+1 right/down). */
export function measureText(text: string, o?: TextOpts): { w: number; h: number } {
  const f = getFont(o?.font);
  const s = textScale(o);
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  const extra = (o?.outline !== undefined ? 2 : 0) + (o?.shadow !== undefined ? 1 : 0);
  return { w: (measure(text, f.id) + extra) * s, h: ((lines - 1) * f.lineHeight + f.ascent + extra) * s };
}

export type GlyphVisitor = (g: Glyph, x: number, y: number) => void;

/**
 * Visit every visible glyph with its top-left position. Shared by both renderers so text is
 * placed identically. x/y are rounded; centred lines start at x − floor(width / 2). With
 * `scale` s every metric is multiplied by s (glyphs are drawn as s×s blocks).
 */
export function layoutText(
  text: string,
  x: number,
  y: number,
  font: BitmapFont,
  align: 'left' | 'center' | 'right',
  visit: GlyphVisitor,
  scale = 1,
): void {
  const x0 = Math.round(x);
  let ly = Math.round(y);
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text.charCodeAt(i) !== 10) continue;
    const w = lineWidth(text, start, i, font) * scale;
    let gx = align === 'center' ? x0 - (w >> 1) : align === 'right' ? x0 - w : x0;
    for (let k = start; k < i; k++) {
      const code = text.charCodeAt(k);
      if (code >= 0xd800 && code <= 0xdbff) continue;
      const g = font.glyph(code);
      if (code !== 32) visit(g, gx, ly);
      gx += (g.w + font.spacing) * scale;
    }
    ly += font.lineHeight * scale;
    start = i + 1;
  }
}

/** Offsets of the 8-neighbour text outline, in drawing order. */
export const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export type TextPassVisitor = (color: Color, dx: number, dy: number) => void;

/**
 * The layered passes of styled text, back to front: shadow (+1, +1; the outlined silhouette
 * when an outline is set), outline (8 neighbours), then the fill. Both renderers use this.
 */
export function textPasses(o: TextOpts | undefined, visit: TextPassVisitor): void {
  const outline = o?.outline;
  const shadow = o?.shadow;
  const s = textScale(o);
  if (shadow !== undefined) {
    if (outline !== undefined) for (const [dx, dy] of OUTLINE_OFFSETS) visit(shadow, (dx + 1) * s, (dy + 1) * s);
    else visit(shadow, s, s);
  }
  if (outline !== undefined) for (const [dx, dy] of OUTLINE_OFFSETS) visit(outline, dx * s, dy * s);
  visit(o?.color ?? WHITE, 0, 0);
}

/** Plot one glyph into a buffer as scale×scale blocks (alpha < 1 blends). */
export function drawGlyph(buf: PixelBuffer, g: Glyph, x: number, y: number, color: Color, alpha = 1, scale = 1): void {
  const { w: bw, h: bh, data } = buf;
  const solid = alpha >= 1 && (color & 255) === 255;
  for (let r = 0; r < g.rows.length; r++) {
    const mask = g.rows[r];
    if (mask === 0) continue;
    for (let c = 0; c < g.w; c++) {
      if (((mask >>> (g.w - 1 - c)) & 1) === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        const yy = y + r * scale + sy;
        if (yy < 0 || yy >= bh) continue;
        for (let sx = 0; sx < scale; sx++) {
          const xx = x + c * scale + sx;
          if (xx < 0 || xx >= bw) continue;
          if (solid) data[yy * bw + xx] = color >>> 0;
          else buf.blendPixel(xx, yy, color, alpha);
        }
      }
    }
  }
  buf.touch();
}

/**
 * Draw styled text into a PixelBuffer (used by the software renderer and by art/tools). `d`
 * (default 1) is the buffer's density (buffer px per logical px): a 2× or 4× art buffer gets
 * the HD glyphs of that density, at the logical position (x, y) (rounded like `layoutText`).
 */
export function drawText(buf: PixelBuffer, text: string, x: number, y: number, o?: TextOpts, d = 1): void {
  const k = Math.max(1, Math.round(d));
  if (k > 1) {
    drawTextPx(buf, text, Math.round(x) * k, Math.round(y) * k, o, k, glyphDensity(k, k, textScale(o)));
    return;
  }
  const font = getFont(o?.font);
  const align = o?.align ?? 'left';
  const alpha = o?.alpha ?? 1;
  const s = textScale(o);
  textPasses(o, (color, dx, dy) => {
    layoutText(text, x + dx, y + dy, font, align, (g, gx, gy) => drawGlyph(buf, g, gx, gy, color, alpha, s), s);
  });
}

/**
 * Draw styled text into a buffer whose px are 1/k logical px, the first line's top-left at
 * buffer px (bx, by) (laid out in logical px from there). Glyph density D 1: the bitmap glyphs as
 * (scale·k)-px blocks with the passes of `textPasses` (the software renderer at res k, as
 * before); D 2 / 4: the HD glyphs with the passes of `hdTextPasses`, every art px a
 * (scale·k / D)-px block (uneven art px when D does not divide scale·k: `glyphEdge`).
 */
export function drawTextPx(buf: PixelBuffer, text: string, bx: number, by: number, o: TextOpts | undefined, k: number, D: GlyphDensity): void {
  const font = getFont(o?.font);
  const align = o?.align ?? 'left';
  const alpha = o?.alpha ?? 1;
  const s = textScale(o);
  if (D === 1) {
    textPasses(o, (color, dx, dy) => {
      layoutText(text, dx, dy, font, align, (g, gx, gy) => drawGlyph(buf, g, bx + gx * k, by + gy * k, color, alpha, s * k), s);
    });
    return;
  }
  const f = (s * k) / D;
  hdTextPasses(o, (color, kind, dx, dy) => {
    layoutText(text, dx, dy, font, align, (g, gx, gy) => drawGlyphHd(buf, font, g, D, kind, bx + gx * k, by + gy * k, color, alpha, f), s);
  });
}

/**
 * Atlas of every glyph of a font in one colour. Density 1 (default): glyph g sits at
 * (g.index * (maxW + 1), 0), the canvas renderer's bitmap atlas (one per font and colour).
 * Density 2 / 4: the HD atlas of pass `kind` (`hdTextPasses`), a grid of GLYPH_ATLAS_COLS
 * columns of cells `hdAtlasCell(font, D)`: glyph g's cell starts at
 * ((g.index % GLYPH_ATLAS_COLS) · cw, floor(g.index / GLYPH_ATLAS_COLS) · ch); 'fill' and 'flat'
 * draw the glyph D art px (one cell px) in from the cell's corner, 'outline' its ring silhouette
 * from the corner. `scale` (default 1) draws every art px `scale` atlas px wide (the canvas
 * renderer's atlas for uneven art px, `glyphEdge`; cw · scale and ch · scale must be whole px):
 * a 1:1 copy of a cell then has the software renderer's pixels.
 */
export function glyphAtlas(font: BitmapFont, color: Color, d: GlyphDensity = 1, kind: HdTextPass = 'fill', scale = 1): PixelBuffer {
  if (d === 1) {
    const cell = font.maxW + 1;
    const buf = new PixelBuffer(font.glyphs.length * cell, font.height);
    for (const g of font.glyphs) drawGlyph(buf, g, g.index * cell, 0, color, 1);
    return buf;
  }
  const { cw, ch } = hdAtlasCell(font, d);
  const rows = Math.ceil(font.glyphs.length / GLYPH_ATLAS_COLS);
  const buf = new PixelBuffer(Math.round(GLYPH_ATLAS_COLS * cw * scale), Math.round(rows * ch * scale));
  const pad = Math.round(d * scale);
  for (const g of font.glyphs) {
    const ox = Math.round((g.index % GLYPH_ATLAS_COLS) * cw * scale);
    const oy = Math.round(Math.floor(g.index / GLYPH_ATLAS_COLS) * ch * scale);
    // The glyph's cell one cell px (d art px) in: the ring of 'outline' reaches back to the corner.
    drawGlyphHd(buf, font, g, d, kind, ox + pad, oy + pad, color, 1, scale);
  }
  return buf;
}

// ---------------------------------------------------------------------------------------------
// HD glyphs (UHD wave): designed tables at glyph density 2 and 4, the HD text passes
// ---------------------------------------------------------------------------------------------

/** Glyph densities: 1 (the bitmap fonts) and the designed HD tables 2 and 4. */
export type GlyphDensity = 1 | 2 | 4;

/**
 * The passes of HD text: 'fill' the glyph in the text colour lit from the top (`fillColors`),
 * 'flat' the glyph in one colour (the shadow of text without an outline), 'outline' the glyph
 * grown by a round pen one cell px wide (`glyphRing`; the outline, and the shadow of outlined text).
 */
export type HdTextPass = 'fill' | 'flat' | 'outline';
export type HdTextPassVisitor = (color: Color, kind: HdTextPass, dx: number, dy: number) => void;

/** Columns of the HD glyph atlases (`glyphAtlas` at density 2 / 4). */
export const GLYPH_ATLAS_COLS = 16;

/** Cell of a font's HD atlas at density D, in art px: one cell px of room on every side for the outline. */
export function hdAtlasCell(font: BitmapFont, D: GlyphDensity): { cw: number; ch: number } {
  return { cw: (font.maxW + 2) * D, ch: (font.height + 2) * D };
}

/**
 * The glyph density text uses at backbuffer res `k` for art tier `tier` (1, 2 or 4; pass 1 when
 * the dense art is off) and text scale `scale`: 1 (the bitmap path, unchanged) when the tier is 1
 * or the backbuffer has no room for an HD table (k 1); else the HD table the tier draws (as the
 * sprites: tier 4 needs 4 | k, tier 2 any k ≥ 2), and big text (scale 2) at tier 2 takes the 4
 * table when its art px are whole backbuffer px (4 | scale·k). An art px is scale·k / D backbuffer
 * px: whole at k 2, 4, 6, 8; at an odd k (1080p: k 5) the art px alternate between the two
 * nearest widths, as 2× sprites do there (`glyphEdge`).
 */
export function glyphDensity(k: number, tier: number, scale = 1): GlyphDensity {
  const td = tier >= 4 && k >= 4 && k % 4 === 0 ? 4 : tier >= 2 && k >= 2 ? 2 : 1;
  if (td === 1) return 1;
  const s = Math.max(1, Math.round(scale));
  if (td === 4) return 4;
  return s >= 2 && (k * s) % 4 === 0 ? 4 : 2;
}

/**
 * The backbuffer px offset of art px edge `n` of a glyph cell drawn with art px `f` backbuffer px
 * wide: n·f, rounded the way a nearest-neighbour stretch samples it (an art px covers the
 * backbuffer px whose centres fall in it), so both renderers place uneven art px (f 2.5 at k 5)
 * alike and never leave a gap or an overlap between two art px.
 */
export function glyphEdge(n: number, f: number): number {
  return Math.ceil(n * f - 0.5 - 1e-9) + 0;
}

/**
 * The HD passes of styled text, back to front (`textPasses` at glyph density 2 / 4): the shadow
 * (+1, +1 cell px: the outlined silhouette when an outline is set, else the flat glyph), the
 * outline (`glyphRing` in the outline colour) and the lit fill. (dx, dy) in logical px.
 */
export function hdTextPasses(o: TextOpts | undefined, visit: HdTextPassVisitor): void {
  const outline = o?.outline;
  const shadow = o?.shadow;
  const s = textScale(o);
  if (shadow !== undefined) visit(shadow, outline !== undefined ? 'outline' : 'flat', s, s);
  if (outline !== undefined) visit(outline, 'outline', 0, 0);
  visit(o?.color ?? WHITE, 'fill', 0, 0);
}

interface HdGlyphSet {
  readonly masks: (Uint8Array | undefined)[];
  readonly rings: (Uint8Array | undefined)[];
}

const hdSets = new Map<string, HdGlyphSet>();

function hdSet(font: BitmapFont, D: number): HdGlyphSet {
  const key = `${font.id}@${D}`;
  let set = hdSets.get(key);
  if (!set) {
    set = { masks: new Array(font.glyphs.length), rings: new Array(font.glyphs.length) };
    hdSets.set(key, set);
  }
  return set;
}

/**
 * The designed HD glyph at density D: (g.w·D) × (font.height·D) art px, row by row, 1 = ink
 * (cached; never change it). It stays inside the 1× cell, so advances and layout are the 1×
 * ones. Two designs (both drawn from the 1× glyph, one art px = 1/D logical px):
 * - stroke (the 'small' font, 1 px strokes): every 1× px is a node of a pen path; straight runs
 *   are swept with a square pen (crisp stems, bars and corners), diagonal steps between two px
 *   that touch only at a corner with a round pen of the stroke's width (smooth diagonals and
 *   rounded joints, the same weight as the stems);
 * - contour (the 'big' font with its 2 px strokes, and the solid ♥ ★): the filled shape with
 *   every one-px stair cut to a 45° edge through the step midpoints (convex step corners cut,
 *   concave step corners filled, corner-to-corner px joined), long edges and real corners kept
 *   square.
 */
export function glyphMask(font: BitmapFont, g: Glyph, D: 2 | 4): Uint8Array {
  const set = hdSet(font, D);
  let m = set.masks[g.index];
  if (!m) {
    m = font.id === 'big' || SOLID_GLYPHS.has(g.code) ? contourGlyph(g, font.height, D) : strokeGlyph(g, font.height, D);
    set.masks[g.index] = m;
  }
  return m;
}

/**
 * The outline silhouette of an HD glyph: `glyphMask` grown by a round pen of radius D art px
 * (one cell px: outline A), (g.w·D + 2D) × (font.height·D + 2D) art px, the glyph at (D, D).
 */
export function glyphRing(font: BitmapFont, g: Glyph, D: 2 | 4): Uint8Array {
  const set = hdSet(font, D);
  let r = set.rings[g.index];
  if (!r) {
    const m = glyphMask(font, g, D);
    const mw = g.w * D;
    const mh = font.height * D;
    const rw = mw + 2 * D;
    r = new Uint8Array(rw * (mh + 2 * D));
    // The disc of the sprites' outline A (hd/canvas.ts): dx² + dy² ≤ D² + D / 2, as row offsets.
    const pen: number[] = [];
    for (let dy = -D; dy <= D; dy++) {
      for (let dx = -D; dx <= D; dx++) if (dx * dx + dy * dy <= D * D + D * 0.5) pen.push(dy * rw + dx);
    }
    for (let Y = 0; Y < mh; Y++) {
      for (let X = 0; X < mw; X++) {
        if (m[Y * mw + X] === 0) continue;
        const c = (Y + D) * rw + X + D;
        for (let q = 0; q < pen.length; q++) r[c + pen[q]] = 1;
      }
    }
    set.rings[g.index] = r;
  }
  return r;
}

/** Small glyphs drawn as filled shapes (contour design) instead of strokes. */
const SOLID_GLYPHS = new Set<number>([0x2665, 0x2605]);

type OnFn = (x: number, y: number) => boolean;

function glyphOn(g: Glyph, h: number): OnFn {
  return (x, y) => x >= 0 && y >= 0 && x < g.w && y < h && ((g.rows[y] >>> (g.w - 1 - x)) & 1) === 1;
}

/** Stroke design (see `glyphMask`): square pen on straight runs, round pen (radius ½) on diagonal steps. */
function strokeGlyph(g: Glyph, h: number, D: number): Uint8Array {
  const on = glyphOn(g, h);
  const W = g.w * D;
  const out = new Uint8Array(W * h * D);
  // Per px: the quarters its square pen covers (bit 0 TL, 1 TR, 2 BL, 3 BR) and the diagonal links.
  const quads = new Uint8Array(g.w * h);
  const segs: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (!on(x, y)) continue;
      const L = on(x - 1, y);
      const R = on(x + 1, y);
      const U = on(x, y - 1);
      const B = on(x, y + 1);
      const ul = on(x - 1, y - 1) && !U && !L;
      const ur = on(x + 1, y - 1) && !U && !R;
      const dl = on(x - 1, y + 1) && !B && !L;
      const dr = on(x + 1, y + 1) && !B && !R;
      const diag = ul || ur || dl || dr;
      // A px with a diagonal link keeps only the halves towards its straight neighbours: the
      // round pen of the diagonal covers its centre, so the joint is a smooth turn, not a notch.
      quads[y * g.w + x] = diag ? (L || U ? 1 : 0) | (R || U ? 2 : 0) | (L || B ? 4 : 0) | (R || B ? 8 : 0) : 15;
      if (dl) segs.push(x + 0.5, y + 0.5, x - 0.5, y + 1.5);
      if (dr) segs.push(x + 0.5, y + 0.5, x + 1.5, y + 1.5);
    }
  }
  const r2 = 0.25 + 1e-9;
  for (let Y = 0; Y < h * D; Y++) {
    const v = (Y + 0.5) / D;
    const y = Math.floor(v);
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / D;
      const x = Math.floor(u);
      let ink = false;
      if (on(x, y)) {
        const bit = (u - x < 0.5 ? 0 : 1) | (v - y < 0.5 ? 0 : 2);
        ink = ((quads[y * g.w + x] >> bit) & 1) === 1;
      }
      for (let i = 0; !ink && i < segs.length; i += 4) {
        const ax = segs[i];
        const ay = segs[i + 1];
        const dx = segs[i + 2] - ax;
        const dy = segs[i + 3] - ay;
        let t = ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx - u;
        const ey = ay + t * dy - v;
        if (ex * ex + ey * ey <= r2) ink = true;
      }
      if (ink) out[Y * W + X] = 1;
    }
  }
  return out;
}

/** Contour design (see `glyphMask`): one-px stairs become 45° edges through the step midpoints. */
function contourGlyph(g: Glyph, h: number, D: number): Uint8Array {
  const on = glyphOn(g, h);
  const W = g.w * D;
  const out = new Uint8Array(W * h * D);
  const t = 0.5 + 1e-9;
  for (let Y = 0; Y < h * D; Y++) {
    const v = (Y + 0.5) / D;
    const y = Math.floor(v);
    const fy = v - y;
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / D;
      const x = Math.floor(u);
      const fx = u - x;
      const L = on(x - 1, y);
      const R = on(x + 1, y);
      const U = on(x, y - 1);
      const B = on(x, y + 1);
      let ink: boolean;
      if (on(x, y)) {
        // A convex corner is cut when the edge steps on diagonally there (a stair), never at a
        // real corner (E, L, T stay square).
        ink = !(
          (!L && !U && (on(x - 1, y + 1) || on(x + 1, y - 1)) && fx + fy <= t) ||
          (!R && !U && (on(x + 1, y + 1) || on(x - 1, y - 1)) && 1 - fx + fy <= t) ||
          (!L && !B && (on(x - 1, y - 1) || on(x + 1, y + 1)) && fx + 1 - fy <= t) ||
          (!R && !B && (on(x + 1, y - 1) || on(x - 1, y + 1)) && 2 - fx - fy <= t)
        );
      } else {
        // A concave corner is filled when both edges meeting there are one-px steps, or when
        // the two px meet only at that corner (a diagonal joint).
        ink =
          (R && B && (!on(x + 1, y + 1) || (!on(x + 1, y - 1) && !on(x - 1, y + 1))) && 2 - fx - fy <= t) ||
          (L && B && (!on(x - 1, y + 1) || (!on(x - 1, y - 1) && !on(x + 1, y + 1))) && fx + 1 - fy <= t) ||
          (R && U && (!on(x + 1, y - 1) || (!on(x + 1, y + 1) && !on(x - 1, y - 1))) && 1 - fx + fy <= t) ||
          (L && U && (!on(x - 1, y - 1) || (!on(x - 1, y + 1) && !on(x + 1, y - 1))) && fx + fy <= t);
      }
      if (ink) out[Y * W + X] = 1;
    }
  }
  return out;
}

const fillCache = new Map<string, Uint32Array>();
const rampCache = new Map<Color, { ramp: readonly Color[]; i: number } | null>();

/** Chroma difference of two colours (opponent axes r − g and (r + g) / 2 − b; lightness ignored). */
function chromaDiff(a: Color, b: Color): number {
  const ar = a >>> 24;
  const ag = (a >>> 16) & 255;
  const ab = (a >>> 8) & 255;
  const br = b >>> 24;
  const bg = (b >>> 16) & 255;
  const bb = (b >>> 8) & 255;
  return Math.hypot(ar - ag - (br - bg), (ar + ag) / 2 - ab - ((br + bg) / 2 - bb));
}

/**
 * The HD ramp of a text colour (palette-hd.ts): of the ramps holding it, the one whose
 * neighbouring tones keep its hue best (white text shades to cool snow, not to fire yellow).
 * null for a colour outside the HD palette.
 */
function textRamp(c: Color): { ramp: readonly Color[]; i: number } | null {
  const key = (c | 255) >>> 0;
  const hit = rampCache.get(key);
  if (hit !== undefined) return hit;
  let best: { ramp: readonly Color[]; i: number } | null = null;
  let bestScore = Infinity;
  for (const name of HD_RAMP_NAMES) {
    const ramp: readonly Color[] = PAL_HD[name];
    const i = ramp.indexOf(key);
    if (i < 0) continue;
    const score = (i > 0 ? chromaDiff(key, ramp[i - 1]) : 0) + (i < ramp.length - 1 ? chromaDiff(key, ramp[i + 1]) : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { ramp, i };
    }
  }
  rampCache.set(key, best);
  return best;
}

/**
 * The fill colour of every art row of a glyph cell at density D (`font.height`·D rows): the
 * text colour lit from the top, in its HD ramp (`textRamp`). Big: the top quarter
 * of the capitals one tone lighter, the lowest quarter one tone darker (the lettering of arcade
 * banners); small: the lowest cap row one tone darker at 4× only (strokes stay solid at 2×). A
 * colour outside the palettes, or at the end of its ramp, stays flat there. Cached.
 */
export function fillColors(font: BitmapFont, color: Color, D: GlyphDensity): Uint32Array {
  const key = `${font.id}@${D}:${color >>> 0}`;
  let rows = fillCache.get(key);
  if (rows) return rows;
  rows = new Uint32Array(font.height * D).fill(color >>> 0);
  const home = D > 1 ? textRamp(color) : null;
  if (home) {
    const a = color & 255;
    const tone = (i: number): number => ((home.ramp[Math.max(0, Math.min(home.ramp.length - 1, i))] & ~255) | a) >>> 0;
    const cap = font.ascent;
    for (let Y = 0; Y < rows.length; Y++) {
      const v = (Y + 0.5) / D;
      if (font.id === 'big') {
        if (v < cap * 0.25) rows[Y] = tone(home.i + 1);
        else if (v >= cap * 0.75) rows[Y] = tone(home.i - 1);
      } else if (D >= 4 && v >= cap - 1 && v < cap) rows[Y] = tone(home.i - 1);
    }
  }
  if (fillCache.size > 1024) fillCache.clear();
  fillCache.set(key, rows);
  return rows;
}

/**
 * Plot one HD glyph pass into a buffer: the glyph's cell top-left at buffer px (x, y), every art
 * px an f × f block (f may be fractional: edges at `glyphEdge`; alpha < 1 blends). 'outline' draws `glyphRing`, which starts one cell px
 * (D art px) up and left of the cell; 'fill' uses `fillColors`, 'flat' and 'outline' one colour.
 */
export function drawGlyphHd(buf: PixelBuffer, font: BitmapFont, g: Glyph, D: 2 | 4, kind: HdTextPass, x: number, y: number, color: Color, alpha = 1, f = 1): void {
  const ring = kind === 'outline';
  const m = ring ? glyphRing(font, g, D) : glyphMask(font, g, D);
  const mw = g.w * D + (ring ? 2 * D : 0);
  const mh = font.height * D + (ring ? 2 * D : 0);
  const ox = ring ? x - D * f : x;
  const oy = ring ? y - D * f : y;
  const colors = kind === 'fill' ? fillColors(font, color, D) : null;
  for (let Y = 0; Y < mh; Y++) {
    const c = colors ? colors[Y] : color >>> 0;
    const row = Y * mw;
    const y0 = oy + glyphEdge(Y, f);
    const y1 = oy + glyphEdge(Y + 1, f);
    if (y1 <= y0) continue;
    let X = 0;
    while (X < mw) {
      if (m[row + X] === 0) {
        X++;
        continue;
      }
      let X1 = X + 1;
      while (X1 < mw && m[row + X1] !== 0) X1++;
      const x0 = ox + glyphEdge(X, f);
      buf.blendRect(x0, y0, ox + glyphEdge(X1, f) - x0, y1 - y0, c, alpha);
      X = X1;
    }
  }
  buf.touch();
}
