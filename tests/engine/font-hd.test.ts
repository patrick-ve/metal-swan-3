/**
 * HD glyphs (UHD wave, src/engine/font.ts): designed tables at glyph density 2 and 4 that keep
 * the 1× layout (advances, line heights, cells), the density each renderer picks, and the 1× text
 * path byte for byte.
 */
import { describe, expect, it } from 'vitest';
import type { Color } from '../../src/engine/color';
import {
  drawText,
  drawTextPx,
  fillColors,
  getFont,
  GLYPH_ATLAS_COLS,
  glyphAtlas,
  glyphDensity,
  glyphEdge,
  glyphMask,
  glyphRing,
  hdAtlasCell,
  hdTextPasses,
  measure,
  type HdTextPass,
} from '../../src/engine/font';
import { INK, PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import { PixelBuffer } from '../../src/engine/pixel';
import type { FontId, TextOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { setArtTier, setHiArt } from '../../src/engine/sprites';

const FONTS: readonly FontId[] = ['small', 'big'];

function fnv(buf: PixelBuffer): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.data.length; i++) {
    const v = buf.data[i];
    for (let s = 0; s < 32; s += 8) {
      h ^= (v >>> s) & 255;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16);
}

/** Run `fn` with art tier `t` and the dense art on (restored after). */
function withTier<T>(t: number, fn: () => T): T {
  const prevT = setArtTier(t);
  const prevH = setHiArt(true);
  try {
    return fn();
  } finally {
    setArtTier(prevT);
    setHiArt(prevH);
  }
}

describe('HD glyph tables', () => {
  it('every glyph has a (w·D) × (height·D) table at D 2 and 4, inside its 1× cell', () => {
    for (const id of FONTS) {
      const font = getFont(id);
      for (const D of [2, 4] as const) {
        for (const g of font.glyphs) {
          const m = glyphMask(font, g, D);
          expect(m.length, `${id} ${String.fromCodePoint(g.code)} @${D}`).toBe(g.w * D * font.height * D);
          // Cached: the same table every time.
          expect(glyphMask(font, g, D)).toBe(m);
        }
      }
    }
  });

  it('keeps every 1× ink px and adds no ink away from the 1× glyph', () => {
    for (const id of FONTS) {
      const font = getFont(id);
      for (const D of [2, 4] as const) {
        for (const g of font.glyphs) {
          const W = g.w * D;
          const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.w && y < font.height && ((g.rows[y] >>> (g.w - 1 - x)) & 1) === 1;
          const m = glyphMask(font, g, D);
          const label = `${id} '${String.fromCodePoint(g.code)}' @${D}`;
          for (let y = 0; y < font.height; y++) {
            for (let x = 0; x < g.w; x++) {
              if (!on(x, y)) continue;
              let ink = 0;
              for (let Y = y * D; Y < (y + 1) * D; Y++) for (let X = x * D; X < (x + 1) * D; X++) ink += m[Y * W + X];
              // At least half of the px's block stays ink (corners may be cut to 45°).
              expect(ink * 2, `${label} px ${x},${y}`).toBeGreaterThanOrEqual(D * D);
            }
          }
          for (let Y = 0; Y < font.height * D; Y++) {
            for (let X = 0; X < W; X++) {
              if (!m[Y * W + X]) continue;
              const x = Math.floor(X / D);
              const y = Math.floor(Y / D);
              let near = false;
              for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = on(x + dx, y + dy);
              expect(near, `${label} art px ${X},${Y}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('the outline ring holds the glyph and stays within one cell px of it (outline A)', () => {
    for (const id of FONTS) {
      const font = getFont(id);
      for (const D of [2, 4] as const) {
        for (const g of font.glyphs) {
          const m = glyphMask(font, g, D);
          const r = glyphRing(font, g, D);
          const mw = g.w * D;
          const mh = font.height * D;
          const rw = mw + 2 * D;
          expect(r.length).toBe(rw * (mh + 2 * D));
          for (let Y = 0; Y < mh; Y++) for (let X = 0; X < mw; X++) if (m[Y * mw + X]) expect(r[(Y + D) * rw + X + D]).toBe(1);
          // Every ring px is within D art px (plus the pen's rounding) of an ink px.
          for (let Y = 0; Y < mh + 2 * D; Y++) {
            for (let X = 0; X < rw; X++) {
              if (!r[Y * rw + X]) continue;
              let ok = false;
              for (let dy = -D; dy <= D && !ok; dy++) {
                for (let dx = -D; dx <= D && !ok; dx++) {
                  const mx = X - D + dx;
                  const my = Y - D + dy;
                  ok = mx >= 0 && my >= 0 && mx < mw && my < mh && m[my * mw + mx] === 1 && dx * dx + dy * dy <= D * D + D;
                }
              }
              expect(ok).toBe(true);
            }
          }
        }
      }
    }
  });

  it('designs smooth diagonals: the small x at 4× has art px on its 45° strokes between the 1× px', () => {
    const font = getFont('small');
    const g = font.glyphs.find((q) => q.code === 'x'.codePointAt(0));
    expect(g).toBeDefined();
    if (!g) return;
    const D = 4;
    const m = glyphMask(font, g, D);
    const W = g.w * D;
    // Bitmap scaling would leave a 1× px block corner-to-corner; the designed table fills the
    // concave notch between two diagonal neighbours (a smooth 45° stroke).
    let notches = 0;
    const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.w && y < font.height && ((g.rows[y] >>> (g.w - 1 - x)) & 1) === 1;
    for (let y = 0; y + 1 < font.height; y++) {
      for (let x = 0; x + 1 < g.w; x++) {
        if (on(x, y) && on(x + 1, y + 1) && !on(x + 1, y) && !on(x, y + 1)) {
          // The art px just right of the shared corner, inside the empty 1× px (x + 1, y).
          if (m[((y + 1) * D - 1) * W + (x + 1) * D]) notches++;
        }
      }
    }
    expect(notches).toBeGreaterThan(0);
  });
});

describe('the 1× text path is unchanged', () => {
  it('the bitmap atlases keep their pixels', () => {
    expect(fnv(glyphAtlas(getFont('small'), PAL.snow[3]))).toBe('1bf367a1');
    expect(fnv(glyphAtlas(getFont('big'), PAL.snow[3]))).toBe('77594901');
  });

  it('drawText at density 1 and drawTextPx at glyph density 1 keep their pixels', () => {
    const o: TextOpts = { font: 'small', color: PAL.gold[3], outline: INK, shadow: PAL.navy[0] };
    const a = new PixelBuffer(200, 40);
    drawText(a, 'Hey! My bike, 0123 ?', 2, 2, o);
    drawText(a, 'SWAN 3', 2, 16, { font: 'big', color: PAL.snow[3], outline: INK });
    expect(fnv(a)).toBe('88326a15');
    const b = new PixelBuffer(200, 40);
    drawTextPx(b, 'Hey! My bike, 0123 ?', 2, 2, o, 1, 1);
    drawTextPx(b, 'SWAN 3', 2, 16, { font: 'big', color: PAL.snow[3], outline: INK }, 1, 1);
    expect(fnv(b)).toBe('88326a15');
  });

  it('the software renderer draws bitmap text at art tier 1 and with the dense art off', () => {
    const o: TextOpts = { font: 'small', color: PAL.snow[3], outline: INK };
    const one = new SoftRenderer(64, 16);
    one.text('AB 12', 3, 4, o);
    for (const [tier, hi] of [
      [1, true],
      [4, false],
    ] as const) {
      const prevT = setArtTier(tier);
      const prevH = setHiArt(hi);
      try {
        const r = new SoftRenderer(64, 16, undefined, { res: 4 });
        r.text('AB 12', 3, 4, o);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) expect(r.target.get(x, y)).toBe(one.target.get(x >> 2, y >> 2));
      } finally {
        setArtTier(prevT);
        setHiArt(prevH);
      }
    }
  });
});

describe('glyph density per backbuffer', () => {
  it('follows the art tier and the res', () => {
    // [k, tier, scale] → D
    const table: readonly (readonly [number, number, number, number])[] = [
      [1, 4, 1, 1],
      [8, 1, 1, 1],
      [8, 4, 1, 4],
      [8, 2, 1, 2],
      [6, 2, 1, 2],
      [5, 2, 1, 2],
      [5, 4, 1, 2],
      [3, 2, 1, 2],
      [2, 2, 1, 2],
      [2, 4, 1, 2],
      [4, 2, 2, 4],
      [6, 2, 2, 4],
      [5, 2, 2, 2],
      [4, 4, 1, 4],
      [8, 4, 2, 4],
    ];
    for (const [k, tier, scale, D] of table) expect(glyphDensity(k, tier, scale), `k ${k} tier ${tier} scale ${scale}`).toBe(D);
  });

  it('places uneven art px without gaps or overlaps (k 5)', () => {
    let prev = glyphEdge(0, 2.5);
    expect(prev).toBe(0);
    for (let n = 1; n <= 40; n++) {
      const e = glyphEdge(n, 2.5);
      expect(e - prev === 2 || e - prev === 3).toBe(true);
      if (n % 2 === 0) expect(e).toBe(n * 2.5);
      prev = e;
    }
    for (let n = 0; n < 20; n++) expect(glyphEdge(n, 3)).toBe(3 * n);
  });

  it('draws at k 5 exactly the D 2 drawing stretched by 2.5 (nearest)', () => {
    const o: TextOpts = { font: 'small', color: PAL.snow[3], outline: INK, shadow: PAL.navy[0] };
    const s = 'Rk! 7x';
    const w = measure(s, 'small') + 4;
    const a = new PixelBuffer(w * 2, 14 * 2);
    drawTextPx(a, s, 2 * 2, 2 * 2, o, 2, 2);
    const b = new PixelBuffer(w * 5, 14 * 5);
    drawTextPx(b, s, 2 * 5, 2 * 5, o, 5, 2);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) expect(b.get(x, y)).toBe(a.get(Math.floor((x + 0.5) / 2.5), Math.floor((y + 0.5) / 2.5)));
  });
});

describe('HD text', () => {
  it('the software renderer draws the HD glyphs at tier 2 / 4, inside the 1× text footprint grown by one px', () => {
    const o: TextOpts = { font: 'small', color: PAL.snow[3], outline: INK };
    const one = new SoftRenderer(80, 16);
    one.text('Swan 3!', 4, 4, o);
    for (const [tier, k] of [
      [2, 2],
      [4, 8],
      [2, 5],
    ] as const) {
      const r = withTier(tier, () => {
        const sr = new SoftRenderer(80, 16, undefined, { res: k });
        sr.text('Swan 3!', 4, 4, o);
        return sr;
      });
      let differs = 0;
      for (let y = 0; y < r.target.h; y++) {
        for (let x = 0; x < r.target.w; x++) {
          const c = r.target.get(x, y);
          const lx = Math.floor(x / k);
          const ly = Math.floor(y / k);
          if (c !== one.target.get(lx, ly)) differs++;
          if ((c & 255) === 0) continue;
          // A drawn px lies on or next to a 1× drawn px.
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = (one.target.get(lx + dx, ly + dy) & 255) !== 0;
          expect(near, `tier ${tier} k ${k} px ${x},${y}`).toBe(true);
        }
      }
      // Not the bitmap glyphs scaled: the HD tables change pixels.
      expect(differs).toBeGreaterThan(0);
    }
  });

  it('uses HD palette colours for text in palette colours (lit fill, ink outline)', () => {
    const colors: readonly Color[] = [PAL.snow[3], PAL.gold[3], PAL.red[3], PAL.sky[3], PAL.stone[3], PAL.snow[1], INK];
    for (const id of FONTS) {
      for (const D of [2, 4] as const) {
        for (const c of colors) {
          const rows = fillColors(getFont(id), c, D);
          expect(rows.length).toBe(getFont(id).height * D);
          for (const v of rows) expect(inHdPalette(v), `${id} @${D} ${c.toString(16)} → ${v.toString(16)}`).toBe(true);
        }
      }
    }
    // The big font is lit: lighter capitals at the top than at the bottom.
    const big = fillColors(getFont('big'), PAL.gold[3], 4);
    expect(new Set(big).size).toBeGreaterThanOrEqual(3);
    const r = withTier(4, () => {
      const sr = new SoftRenderer(120, 20, undefined, { res: 8 });
      sr.text('MISSION 1', 4, 4, { font: 'big', color: PAL.gold[3], outline: INK });
      return sr;
    });
    for (let y = 0; y < r.target.h; y++) for (let x = 0; x < r.target.w; x++) if ((r.target.get(x, y) & 255) === 255) expect(inHdPalette(r.target.get(x, y)) || r.target.get(x, y) === 0x000000ff).toBe(true);
  });

  it('passes go shadow, outline, fill (back to front)', () => {
    const seen: [Color, HdTextPass, number, number][] = [];
    hdTextPasses({ color: PAL.snow[3], outline: INK, shadow: PAL.navy[0] }, (c, kind, dx, dy) => seen.push([c, kind, dx, dy]));
    expect(seen).toEqual([
      [PAL.navy[0], 'outline', 1, 1],
      [INK, 'outline', 0, 0],
      [PAL.snow[3], 'fill', 0, 0],
    ]);
    seen.length = 0;
    hdTextPasses({ color: PAL.snow[3], shadow: PAL.navy[0], scale: 2 }, (c, kind, dx, dy) => seen.push([c, kind, dx, dy]));
    expect(seen).toEqual([
      [PAL.navy[0], 'flat', 2, 2],
      [PAL.snow[3], 'fill', 0, 0],
    ]);
  });

  it('HD atlases put glyph g in cell (g.index % cols, g.index / cols)', () => {
    for (const id of FONTS) {
      const font = getFont(id);
      for (const D of [2, 4] as const) {
        const { cw, ch } = hdAtlasCell(font, D);
        const atlas = glyphAtlas(font, PAL.snow[3], D, 'flat');
        expect(atlas.w).toBe(GLYPH_ATLAS_COLS * cw);
        expect(atlas.h).toBe(Math.ceil(font.glyphs.length / GLYPH_ATLAS_COLS) * ch);
        for (const g of font.glyphs.slice(0, 40)) {
          const m = glyphMask(font, g, D);
          const ox = (g.index % GLYPH_ATLAS_COLS) * cw + D;
          const oy = Math.floor(g.index / GLYPH_ATLAS_COLS) * ch + D;
          for (let Y = 0; Y < font.height * D; Y++) for (let X = 0; X < g.w * D; X++) expect((atlas.get(ox + X, oy + Y) & 255) !== 0).toBe(m[Y * g.w * D + X] === 1);
        }
        // The outline atlas: glyph g's ring fills its cell from the corner (as the canvas renderer reads it).
        const rings = glyphAtlas(font, INK, D, 'outline');
        for (const g of font.glyphs.slice(0, 40)) {
          const r = glyphRing(font, g, D);
          const rw = (g.w + 2) * D;
          const ox = (g.index % GLYPH_ATLAS_COLS) * cw;
          const oy = Math.floor(g.index / GLYPH_ATLAS_COLS) * ch;
          for (let Y = 0; Y < (font.height + 2) * D; Y++) for (let X = 0; X < rw; X++) expect((rings.get(ox + X, oy + Y) & 255) !== 0).toBe(r[Y * rw + X] === 1);
        }
      }
    }
  });

  it('drawText into a dense art buffer uses the table of its density at the logical position', () => {
    for (const d of [2, 4] as const) {
      const b = new PixelBuffer(40 * d, 14 * d);
      drawText(b, 'RIDE?', 3, 3, { font: 'small', color: INK }, d);
      const ref = new PixelBuffer(40 * d, 14 * d);
      drawTextPx(ref, 'RIDE?', 3 * d, 3 * d, { font: 'small', color: INK }, d, d);
      expect(fnv(b)).toBe(fnv(ref));
      expect(fnv(b)).not.toBe(fnv(new PixelBuffer(40 * d, 14 * d)));
    }
  });
});
