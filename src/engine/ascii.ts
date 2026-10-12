import type { Color } from './color';
import { MAGENTA } from './color';
import { PixelBuffer } from './pixel';

/** Character → colour. '.' and ' ' are transparent unless the key defines them. */
export type AsciiKey = Readonly<Record<string, Color>>;

const warnedChars = new Set<string>();

/**
 * Build a small hand-made image (faces, icons, emblems) from text rows.
 *
 * ```ts
 * const eye = ascii(['.##.', '#ow#', '.##.'], { '#': PAL.ink[0], o: PAL.sky[2], w: WHITE });
 * // or one template string: blank first/last lines and common indentation are removed
 * const tag = ascii(`
 *   #####
 *   #o.o#
 * `, key);
 * ```
 * Rows may differ in length (the width is the longest row). Unknown characters are drawn
 * magenta and warned about once.
 */
export function ascii(rows: readonly string[] | string, key: AsciiKey): PixelBuffer {
  const lines = typeof rows === 'string' ? dedent(rows) : rows;
  const w = lines.reduce((m, r) => Math.max(m, r.length), 0);
  const buf = new PixelBuffer(w, lines.length);
  for (let y = 0; y < lines.length; y++) {
    const row = lines[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const c = key[ch];
      if (c !== undefined) {
        buf.data[y * w + x] = c >>> 0;
      } else if (ch !== '.' && ch !== ' ') {
        if (!warnedChars.has(ch)) {
          warnedChars.add(ch);
          console.warn(`[ascii] no colour for character "${ch}" — drawing magenta`);
        }
        buf.data[y * w + x] = MAGENTA;
      }
    }
  }
  return buf.touch();
}

/** Split a template string into rows without blank edge lines or common indentation. */
function dedent(text: string): string[] {
  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  let indent = Infinity;
  for (const l of lines) {
    if (l.trim() === '') continue;
    indent = Math.min(indent, l.length - l.trimStart().length);
  }
  if (!Number.isFinite(indent)) indent = 0;
  return lines.map((l) => l.slice(indent));
}
