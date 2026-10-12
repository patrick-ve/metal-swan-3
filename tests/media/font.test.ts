import { describe, expect, it } from 'vitest';
import { drawText, getFont, layoutText, measure, measureText } from '../../src/engine/font';
import { PixelBuffer } from '../../src/engine/pixel';

describe('fonts', () => {
  it("'small' covers printable ASCII and the special glyphs", () => {
    const f = getFont('small');
    for (let c = 32; c <= 126; c++) expect(f.glyph(c).code, String.fromCharCode(c)).toBe(c);
    for (const ch of '←↑→↓∞©×♥★') expect(f.glyph(ch.charCodeAt(0)).code, ch).toBe(ch.charCodeAt(0));
  });

  it("'big' covers caps, digits and punctuation; lower case maps to caps", () => {
    const f = getFont('big');
    for (let c = 32; c <= 126; c++) {
      const want = c >= 97 && c <= 122 ? c - 32 : c;
      expect(f.glyph(c).code, String.fromCharCode(c)).toBe(want);
    }
    for (const ch of '←↑→↓©') expect(f.glyph(ch.charCodeAt(0)).code, ch).toBe(ch.charCodeAt(0));
  });

  it('unknown glyphs fall back to "?"', () => {
    expect(getFont('small').glyph(0x4e00).code).toBe(63);
  });

  it('glyphs fit their cells; digits are tabular', () => {
    for (const id of ['small', 'big'] as const) {
      const f = getFont(id);
      for (const g of f.glyphs) {
        expect(g.rows.length).toBe(f.height);
        for (const r of g.rows) expect(r >>> g.w).toBe(0);
      }
      const dw = new Set('0123456789'.split('').map((d) => f.glyph(d.charCodeAt(0)).w));
      expect(dw.size, id).toBe(1);
    }
  });

  it('measures widths and multi-line text', () => {
    expect(measure('A')).toBe(5);
    expect(measure('AB')).toBe(11);
    expect(measure('')).toBe(0);
    expect(measure('AB\nA')).toBe(11);
    expect(measure('A', 'big')).toBe(8);
    expect(measureText('AB\nA', { outline: 0x000000ff })).toEqual({ w: 13, h: 10 + 7 + 2 });
  });

  it('scales text like drawing at 1x and enlarging', () => {
    const one = new PixelBuffer(16, 12);
    drawText(one, 'A', 1, 1, { outline: 0x000000ff });
    const two = new PixelBuffer(32, 24);
    drawText(two, 'A', 2, 2, { outline: 0x000000ff, scale: 2 });
    expect(Array.from(two.data)).toEqual(Array.from(one.scaled(2).data));
    expect(measure('AB', 'small', 3)).toBe(33);
    expect(measureText('A', { scale: 2, outline: 0x000000ff })).toEqual({ w: 14, h: 18 });
  });

  it('lays out alignment per line', () => {
    const xs: number[] = [];
    const f = getFont('small');
    layoutText('AB', 100, 0, f, 'center', (_g, x) => xs.push(x));
    layoutText('AB', 100, 0, f, 'right', (_g, x) => xs.push(x));
    expect(xs).toEqual([95, 101, 89, 95]);
  });

  it('draws fill, outline and shadow layers in order', () => {
    const b = new PixelBuffer(12, 12);
    drawText(b, 'I', 2, 2, { color: 0xffffffff, outline: 0x000000ff, shadow: 0xff0000ff });
    // 'I' top bar starts at (2, 2): fill.
    expect(b.get(2, 2)).toBe(0xffffffff);
    // Left of the bar: outline.
    expect(b.get(1, 2)).toBe(0x000000ff);
    // Bottom-right beyond the outline: shadow of the outlined silhouette.
    expect(b.get(6, 10)).toBe(0xff0000ff);
  });
});
