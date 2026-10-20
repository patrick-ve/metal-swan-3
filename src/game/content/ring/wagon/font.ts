/**
 * The wagons' own pixel lettering (spec §3, §12: our own lettering, never a traced logo):
 * condensed block capitals on a cell grid. ONE layout for every density: a glyph covers
 * `w` × `h` logical cells; the 1× art sets the cells of its BITMAP, the 2× / 4× art draws its
 * STROKES (round-capped polylines on the same grid), so the HD letters keep the 1× footprint.
 *
 * Two sizes: SMALL (3 × 5 cells; N 4, G 4, M 5, I 1) and BIG (4 × 6; M 5), used for `MAJOR`.
 * `textAt(text, box, o)` returns a predicate in continuous local coordinates for the HD art;
 * `textCells(text, box, o)` lists the 1× cells.
 */
import type { Pt } from './geometry';

interface Glyph {
  /** Cell rows, '#' = ink (top to bottom). */
  readonly rows: readonly string[];
  /** Stroke polylines in cell units (x 0..w, y 0..h). */
  readonly strokes: readonly (readonly Pt[])[];
}

const O3: readonly Pt[] = [[1.5, 0.5], [2.2, 0.8], [2.5, 1.5], [2.5, 3.5], [2.2, 4.2], [1.5, 4.5], [0.8, 4.2], [0.5, 3.5], [0.5, 1.5], [0.8, 0.8], [1.5, 0.5]];

/** Small block capitals and digits (3 × 5 unless the bitmap is wider). */
const SMALL: Readonly<Record<string, Glyph>> = {
  A: { rows: ['.#.', '#.#', '###', '#.#', '#.#'], strokes: [[[0.5, 4.6], [0.5, 1.4], [1.5, 0.45], [2.5, 1.4], [2.5, 4.6]], [[0.5, 2.7], [2.5, 2.7]]] },
  C: { rows: ['.##', '#..', '#..', '#..', '.##'], strokes: [[[2.6, 0.9], [2.0, 0.5], [1.1, 0.5], [0.5, 1.2], [0.5, 3.8], [1.1, 4.5], [2.0, 4.5], [2.6, 4.1]]] },
  E: { rows: ['###', '#..', '##.', '#..', '###'], strokes: [[[2.6, 0.5], [0.5, 0.5], [0.5, 4.5], [2.6, 4.5]], [[0.5, 2.5], [2.0, 2.5]]] },
  G: { rows: ['.##.', '#...', '#.##', '#..#', '.##.'], strokes: [[[3.4, 1.0], [2.8, 0.5], [1.2, 0.5], [0.5, 1.2], [0.5, 3.8], [1.2, 4.5], [2.8, 4.5], [3.5, 3.8], [3.5, 2.6], [2.2, 2.6]]] },
  I: { rows: ['#', '#', '#', '#', '#'], strokes: [[[0.5, 0.4], [0.5, 4.6]]] },
  J: { rows: ['..#', '..#', '..#', '#.#', '.#.'], strokes: [[[2.5, 0.4], [2.5, 3.8], [1.9, 4.5], [1.1, 4.5], [0.5, 3.9]]] },
  K: { rows: ['#.#', '#.#', '##.', '#.#', '#.#'], strokes: [[[0.5, 0.4], [0.5, 4.6]], [[2.6, 0.4], [0.6, 2.6]], [[1.3, 2.0], [2.6, 4.6]]] },
  L: { rows: ['#..', '#..', '#..', '#..', '###'], strokes: [[[0.5, 0.4], [0.5, 4.5], [2.6, 4.5]]] },
  M: { rows: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], strokes: [[[0.5, 4.6], [0.5, 0.4], [2.5, 2.8], [4.5, 0.4], [4.5, 4.6]]] },
  N: { rows: ['#..#', '##.#', '#.##', '#..#', '#..#'], strokes: [[[0.5, 4.6], [0.5, 0.4], [3.5, 4.6], [3.5, 0.4]]] },
  O: { rows: ['.#.', '#.#', '#.#', '#.#', '.#.'], strokes: [O3] },
  P: { rows: ['##.', '#.#', '##.', '#..', '#..'], strokes: [[[0.5, 4.6], [0.5, 0.5], [1.9, 0.5], [2.5, 1.1], [2.5, 1.9], [1.9, 2.5], [0.5, 2.5]]] },
  R: { rows: ['##.', '#.#', '##.', '#.#', '#.#'], strokes: [[[0.5, 4.6], [0.5, 0.5], [1.9, 0.5], [2.5, 1.1], [2.5, 1.9], [1.9, 2.5], [0.5, 2.5]], [[1.5, 2.5], [2.5, 4.6]]] },
  S: {
    rows: ['.##', '#..', '.#.', '..#', '##.'],
    strokes: [[[2.5, 0.9], [2.0, 0.5], [1.0, 0.5], [0.5, 1.0], [0.5, 1.9], [1.0, 2.5], [2.0, 2.5], [2.5, 3.1], [2.5, 4.0], [2.0, 4.5], [1.0, 4.5], [0.5, 4.1]]],
  },
  T: { rows: ['###', '.#.', '.#.', '.#.', '.#.'], strokes: [[[0.4, 0.5], [2.6, 0.5]], [[1.5, 0.5], [1.5, 4.6]]] },
  W: { rows: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], strokes: [[[0.5, 0.4], [1.3, 4.6], [2.5, 2.2], [3.7, 4.6], [4.5, 0.4]]] },
  X: { rows: ['#.#', '#.#', '.#.', '#.#', '#.#'], strokes: [[[0.5, 0.4], [2.5, 4.6]], [[2.5, 0.4], [0.5, 4.6]]] },
  Z: { rows: ['###', '..#', '.#.', '#..', '###'], strokes: [[[0.4, 0.5], [2.6, 0.5], [0.5, 4.5], [2.6, 4.5]]] },
  '0': { rows: ['###', '#.#', '#.#', '#.#', '###'], strokes: [O3] },
  '1': { rows: ['.#.', '##.', '.#.', '.#.', '###'], strokes: [[[0.7, 1.2], [1.5, 0.45], [1.5, 4.5]], [[0.6, 4.5], [2.4, 4.5]]] },
  '2': { rows: ['##.', '..#', '.#.', '#..', '###'], strokes: [[[0.5, 1.1], [1.0, 0.5], [2.0, 0.5], [2.5, 1.1], [2.5, 1.8], [0.5, 4.5], [2.6, 4.5]]] },
  '3': { rows: ['##.', '..#', '.#.', '..#', '##.'], strokes: [[[0.5, 0.5], [2.5, 0.5], [1.4, 2.3], [2.0, 2.3], [2.5, 2.9], [2.5, 3.9], [2.0, 4.5], [0.5, 4.5]]] },
  '6': {
    rows: ['.##', '#..', '###', '#.#', '###'],
    strokes: [[[2.4, 0.6], [1.4, 0.5], [0.5, 1.6], [0.5, 3.9], [1.1, 4.5], [2.0, 4.5], [2.5, 3.9], [2.5, 3.0], [2.0, 2.4], [1.0, 2.4], [0.5, 2.9]]],
  },
  '8': {
    rows: ['###', '#.#', '###', '#.#', '###'],
    strokes: [[[1.5, 2.4], [0.7, 1.9], [0.6, 1.0], [1.1, 0.5], [1.9, 0.5], [2.4, 1.0], [2.3, 1.9], [1.5, 2.4], [0.6, 3.0], [0.5, 3.9], [1.1, 4.5], [1.9, 4.5], [2.5, 3.9], [2.4, 3.0], [1.5, 2.4]]],
  },
  '9': {
    rows: ['###', '#.#', '###', '..#', '##.'],
    strokes: [[[0.6, 4.4], [1.6, 4.5], [2.5, 3.4], [2.5, 1.1], [1.9, 0.5], [1.0, 0.5], [0.5, 1.1], [0.5, 2.0], [1.0, 2.6], [2.0, 2.6], [2.5, 2.1]]],
  },
  '-': { rows: ['...', '...', '###', '...', '...'], strokes: [[[0.5, 2.5], [2.5, 2.5]]] },
  ' ': { rows: ['..', '..', '..', '..', '..'], strokes: [] },
};

/** Big block capitals (4 × 6; M 5 × 6) for `MAJOR`. */
const BIG: Readonly<Record<string, Glyph>> = {
  M: { rows: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#'], strokes: [[[0.5, 5.6], [0.5, 0.4], [2.5, 3.4], [4.5, 0.4], [4.5, 5.6]]] },
  A: { rows: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'], strokes: [[[0.5, 5.6], [0.5, 1.6], [2.0, 0.45], [3.5, 1.6], [3.5, 5.6]], [[0.5, 3.4], [3.5, 3.4]]] },
  J: { rows: ['...#', '...#', '...#', '...#', '#..#', '.##.'], strokes: [[[3.5, 0.4], [3.5, 4.6], [2.7, 5.5], [1.3, 5.5], [0.5, 4.7]]] },
  O: {
    rows: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
    strokes: [[[2.0, 0.5], [3.1, 0.9], [3.5, 1.8], [3.5, 4.2], [3.1, 5.1], [2.0, 5.5], [0.9, 5.1], [0.5, 4.2], [0.5, 1.8], [0.9, 0.9], [2.0, 0.5]]],
  },
  R: { rows: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'], strokes: [[[0.5, 5.6], [0.5, 0.5], [2.7, 0.5], [3.5, 1.3], [3.5, 2.3], [2.7, 3.1], [0.5, 3.1]], [[2.0, 3.1], [3.5, 5.6]]] },
};

export type FontSize = 'small' | 'big';

function glyphOf(ch: string, size: FontSize): Glyph {
  const g = (size === 'big' ? BIG[ch] : undefined) ?? SMALL[ch] ?? SMALL[' '];
  return g;
}

/** Width of a text in cells (one cell between letters). */
export function textWidth(text: string, size: FontSize = 'small'): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) w += glyphOf(text[i], size).rows[0].length + (i > 0 ? 1 : 0);
  return w;
}

export interface TextOpts {
  size?: FontSize;
  /** Stroke radius in cells for the HD letters (0.45 bold block, 0.3 thin). */
  weight?: number;
  /** Horizontal alignment in the box: 0 left, 0.5 centre, 1 right. */
  align?: number;
  /** Logical px per cell across (default 1: the 1× grid) and down (default `scale`); HD only below 1. */
  scale?: number;
  scaleY?: number;
}

/** A laid-out text: every glyph's origin cell (local px) with its glyph. */
interface Placed {
  readonly x: number;
  readonly y: number;
  readonly g: Glyph;
}

function layout(text: string, box: readonly number[], o: TextOpts): Placed[] {
  const size = o.size ?? 'small';
  const sx = o.scale ?? 1;
  const [x0, x1, y0] = box;
  const w = textWidth(text, size) * sx;
  const raw = x0 + (x1 - x0 - w) * (o.align ?? 0);
  // The 1× grid snaps to whole px; a scaled (HD-only) text keeps its exact place.
  const left = sx === 1 ? Math.round(raw) : raw;
  const out: Placed[] = [];
  let x = left;
  for (let i = 0; i < text.length; i++) {
    const g = glyphOf(text[i], size);
    out.push({ x, y: sx === 1 ? Math.round(y0) : y0, g });
    x += (g.rows[0].length + 1) * sx;
  }
  return out;
}

/** The 1× cells of a text set in `box` = [x0, x1, y0, y1] (local px; top-left cell corners). */
export function textCells(text: string, box: readonly number[], o: TextOpts = {}): Pt[] {
  const cells: Pt[] = [];
  for (const p of layout(text, box, o)) {
    p.g.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') cells.push([p.x + c, p.y + r]);
    });
  }
  return cells;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)) : 0;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

/**
 * The HD letters of a text set in `box`: a predicate `(x, y) → distance to the nearest stroke
 * minus its radius` (≤ 0 inside a letter) in continuous local coordinates.
 */
export function textField(text: string, box: readonly number[], o: TextOpts = {}): (x: number, y: number) => number {
  const placed = layout(text, box, o);
  const sx = o.scale ?? 1;
  const sy = o.scaleY ?? sx;
  const r = (o.weight ?? 0.45) * Math.min(sx, sy);
  const [, , y0, y1] = box;
  const segs: number[] = [];
  for (const p of placed) {
    for (const s of p.g.strokes) {
      for (let k = 0; k + 1 < s.length; k++) segs.push(p.x + s[k][0] * sx, p.y + s[k][1] * sy, p.x + s[k + 1][0] * sx, p.y + s[k + 1][1] * sy);
    }
  }
  const bx0 = placed.length ? placed[0].x - 1 : 0;
  const last = placed[placed.length - 1];
  const bx1 = last ? last.x + (last.g.rows[0].length + 1) * sx : 0;
  return (x, y) => {
    if (x < bx0 || x > bx1 || y < y0 - 1 || y > y1 + 1) return 9;
    let best = 9;
    for (let i = 0; i < segs.length; i += 4) {
      const d = segDist(x, y, segs[i], segs[i + 1], segs[i + 2], segs[i + 3]);
      if (d < best) best = d;
    }
    return best - r;
  };
}
