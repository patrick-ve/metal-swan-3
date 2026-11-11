/**
 * The kit's canvas (docs/design/ams2.md §1.1): a sprite of palette ids where every pixel also keeps
 * a part id and a z, as the heroes' rig does (docs/design/squad40/rig.py): `finish` makes the selout
 * (a far part's edge next to a nearer part takes its dark tone) and one exterior outline. Hard
 * clusters only: there is no alpha, no blending, no gradient.
 *
 * `wrap` (a canvas that tiles, for floor bands and house rows): shapes that cross the left or the
 * right edge come back on the other side.
 */
import { DARK, K } from './palette';

/**
 * A window mark: the finer tiers draw glazing bars in it (hi.ts). A stamp mark: one pixel of a letter or
 * an arrow, with the id it covers; the finer tiers keep it out of EPX and put it back as a whole block,
 * so that small shapes keep their form.
 */
export type Mark =
  | readonly [kind: 'win', x: number, y: number, w: number, h: number]
  | readonly [kind: 'stamp', x: number, y: number, col: number, under: number];

/** A point list for `poly` / `gablePts`. */
export type Pts = ReadonlyArray<readonly [number, number]>;

const fround = Math.fround;
const POINT_FOUR = fround(0.4);

function roundUp(f: number): number {
  return f >= 0 ? Math.floor(f + 0.5) : -Math.floor(Math.abs(f) + 0.5);
}

function roundDown(f: number): number {
  return f >= 0 ? Math.ceil(f - 0.5) : -Math.ceil(Math.abs(f) - 0.5);
}

/** The polygon filler of the reference drawings: whole-number vertices, one scan line per row. */
function fillPolygon(mask: Uint8Array, W: number, H: number, pts: Pts): void {
  const n = pts.length;
  if (n === 0) return;
  const xy = new Int32Array(n * 2);
  for (let i = 0; i < n; i++) {
    xy[i * 2] = Math.trunc(pts[i][0]);
    xy[i * 2 + 1] = Math.trunc(pts[i][1]);
  }
  interface Edge {
    x0: number;
    y0: number;
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    dx: number;
  }
  const edges: Edge[] = [];
  const addEdge = (x0: number, y0: number, x1: number, y1: number): void => {
    edges.push({
      x0,
      y0,
      xmin: Math.min(x0, x1),
      xmax: Math.max(x0, x1),
      ymin: Math.min(y0, y1),
      ymax: Math.max(y0, y1),
      dx: y0 === y1 ? 0 : fround(fround(x1 - x0) / (y1 - y0)),
    });
  };
  let i = 0;
  for (; i < n - 1; i++) {
    const x0 = xy[i * 2];
    const y0 = xy[i * 2 + 1];
    const x1 = xy[i * 2 + 2];
    const y1 = xy[i * 2 + 3];
    if (y0 === y1 && i !== 0 && y0 === xy[i * 2 - 1]) {
      const last = edges[edges.length - 1];
      if (x1 > x0 && x0 > xy[i * 2 - 2]) {
        last.xmax = x1;
        continue;
      } else if (x1 < x0 && x0 < xy[i * 2 - 2]) {
        last.xmin = x1;
        continue;
      }
    }
    addEdge(x0, y0, x1, y1);
  }
  if (xy[i * 2] !== xy[0] || xy[i * 2 + 1] !== xy[1]) addEdge(xy[i * 2], xy[i * 2 + 1], xy[0], xy[1]);

  const hline = (x0: number, y: number, x1: number): void => {
    if (y < 0 || y >= H) return;
    const a = Math.max(0, x0);
    const b = Math.min(W - 1, x1);
    for (let x = a; x <= b; x++) mask[y * W + x] = 1;
  };
  let ymin = H - 1;
  let ymax = 0;
  const table: Edge[] = [];
  for (const e of edges) {
    if (ymin > e.ymin) ymin = e.ymin;
    if (ymax < e.ymax) ymax = e.ymax;
    if (e.ymin !== e.ymax) table.push(e);
  }
  if (ymin < 0) ymin = 0;
  if (ymax > H) ymax = H;
  const xx = new Float64Array(table.length * 2 + 2);
  const at = (e: Edge, y: number): number => fround(fround(fround(y - e.y0) * e.dx) + e.x0);
  for (let y = ymin; y <= ymax; y++) {
    let j = 0;
    for (let t = 0; t < table.length; t++) {
      const cur = table[t];
      if (y >= cur.ymin && y <= cur.ymax) {
        xx[j++] = at(cur, y);
        if (y === cur.ymax && y < ymax) {
          xx[j] = xx[j - 1];
          j++;
        } else if (cur.dx !== 0 && j % 2 === 1 && Math.round(xx[j - 1]) === xx[j - 1]) {
          for (let k = 0; k < t; k++) {
            const other = table[k];
            if ((cur.dx > 0 && other.dx <= 0) || (cur.dx < 0 && other.dx >= 0)) continue;
            if (xx[j - 1] === at(other, y)) {
              const off = y === ymax ? -1 : 1;
              const a = at(cur, y + off);
              const b = at(other, y + off);
              if (y === cur.ymax) {
                if (cur.dx > 0) xx[k] = Math.max(a, b) + 1;
                else xx[k] = Math.min(a, b) - 1;
              } else if (cur.dx > 0) xx[k] = Math.min(a, b);
              else xx[k] = Math.max(a, b) + 1;
              break;
            }
          }
        }
      }
    }
    const sorted = Array.from(xx.subarray(0, j)).sort((p, q) => p - q);
    let xPos = 0;
    for (let q = 1; q < j; q += 2) {
      const xEnd = roundDown(sorted[q]);
      if (xEnd < xPos) continue;
      let xStart = roundUp(sorted[q - 1]);
      if (xPos > xStart) {
        xStart = xPos;
        if (xEnd < xStart) continue;
      }
      hline(xStart, y, xEnd);
      xPos = xEnd + 1;
    }
    for (const e of edges) {
      if (e.ymin === y && e.ymin === e.ymax && e.xmax >= xPos) {
        hline(Math.max(e.xmin, xPos), y, e.xmax);
        xPos = e.xmax + 1;
      }
    }
  }
}

/** The line drawer of the reference drawings (Bresenham, the last point included). */
function lineMask(mask: Uint8Array, W: number, H: number, ax: number, ay: number, bx: number, by: number): void {
  let x0 = Math.trunc(ax);
  let y0 = Math.trunc(ay);
  const x1 = Math.trunc(bx);
  const y1 = Math.trunc(by);
  const point = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1;
  };
  let dx = x1 - x0;
  let xs = 1;
  if (dx < 0) {
    dx = -dx;
    xs = -1;
  }
  let dy = y1 - y0;
  let ys = 1;
  if (dy < 0) {
    dy = -dy;
    ys = -1;
  }
  if (dx === 0) {
    for (let i = 0; i < dy; i++) {
      point(x0, y0);
      y0 += ys;
    }
  } else if (dy === 0) {
    for (let i = 0; i < dx; i++) {
      point(x0, y0);
      x0 += xs;
    }
  } else if (dx > dy) {
    const n = dx;
    dy += dy;
    let e = dy - dx;
    dx += dx;
    for (let i = 0; i < n; i++) {
      point(x0, y0);
      if (e >= 0) {
        y0 += ys;
        e -= dx;
      }
      e += dy;
      x0 += xs;
    }
  } else {
    const n = dy;
    dx += dx;
    let e = dx - dy;
    dy += dy;
    for (let i = 0; i < n; i++) {
      point(x0, y0);
      if (e >= 0) {
        x0 += xs;
        e -= dy;
      }
      e += dx;
      y0 += ys;
    }
  }
  point(x1, y1);
}

/** A sprite canvas of palette ids. Every method mirrors one of the reference drawing's. */
export class S {
  readonly w: number;
  readonly h: number;
  c: Int16Array;
  z: Float32Array;
  p: Int16Array;
  thin: Uint8Array;
  marks: Mark[] = [];
  /** The canvas tiles: shapes over the side edges come back on the other side. */
  wrap = false;
  private zv = 0;
  private pv = 1;

  constructor(w: number, h: number) {
    this.w = Math.trunc(w);
    this.h = Math.trunc(h);
    const n = this.w * this.h;
    this.c = new Int16Array(n);
    this.z = new Float32Array(n).fill(-9);
    this.p = new Int16Array(n);
    this.thin = new Uint8Array(n);
  }

  /** The part id and the z of what is drawn next. */
  use(part: number, z: number): this {
    this.pv = part;
    this.zv = fround(z);
    return this;
  }

  private fillBox(col: number, x0: number, y0: number, x1: number, y1: number): void {
    const w = this.w;
    const zv = this.zv;
    const pv = this.pv;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > w) x1 = w;
    if (y1 > this.h) y1 = this.h;
    for (let y = y0; y < y1; y++) {
      const row = y * w;
      for (let x = x0; x < x1; x++) {
        const i = row + x;
        if (this.z[i] <= zv) {
          this.c[i] = col;
          this.z[i] = zv;
          this.p[i] = pv;
        }
      }
    }
  }

  rect(col: number, x: number, y: number, w: number, h: number): void {
    const x0 = Math.trunc(x);
    const y0 = Math.trunc(y);
    const x1 = x0 + Math.trunc(w);
    const y1 = y0 + Math.trunc(h);
    this.fillBox(col, x0, y0, x1, y1);
    if (this.wrap) {
      if (x0 < 0) this.fillBox(col, x0 + this.w, y0, x1 + this.w, y1);
      if (x1 > this.w) this.fillBox(col, x0 - this.w, y0, x1 - this.w, y1);
    }
  }

  px(col: number, x: number, y: number): void {
    this.rect(col, x, y, 1, 1);
  }

  hl(col: number, x: number, y: number, w: number): void {
    this.rect(col, x, y, w, 1);
  }

  vl(col: number, x: number, y: number, h: number): void {
    this.rect(col, x, y, 1, h);
  }

  /** Paint `col` on the pixels of a mask (where z allows it). */
  maskPaint(col: number, k: Uint8Array): void {
    const zv = this.zv;
    const pv = this.pv;
    for (let i = 0; i < k.length; i++) {
      if (k[i] && this.z[i] <= zv) {
        this.c[i] = col;
        this.z[i] = zv;
        this.p[i] = pv;
      }
    }
  }

  /** A filled polygon. Returns its mask. */
  poly(col: number, pts: Pts): Uint8Array {
    const k = new Uint8Array(this.w * this.h);
    fillPolygon(k, this.w, this.h, pts);
    this.maskPaint(col, k);
    return k;
  }

  /** A filled ellipse (centre, radii). */
  ell(col: number, cx: number, cy: number, rx: number, ry: number): void {
    const a = Math.max(rx, 0.1);
    const b = Math.max(ry, 0.1);
    const x0 = Math.max(0, Math.floor(cx - a) - 1);
    const x1 = Math.min(this.w - 1, Math.ceil(cx + a) + 1);
    const y0 = Math.max(0, Math.floor(cy - b) - 1);
    const y1 = Math.min(this.h - 1, Math.ceil(cy + b) + 1);
    const zv = this.zv;
    const pv = this.pv;
    for (let y = y0; y <= y1; y++) {
      const v = ((y - cy) / b) ** 2;
      for (let x = x0; x <= x1; x++) {
        if (((x - cx) / a) ** 2 + v <= 1) {
          const i = y * this.w + x;
          if (this.z[i] <= zv) {
            this.c[i] = col;
            this.z[i] = zv;
            this.p[i] = pv;
          }
        }
      }
    }
  }

  /** A one-pixel line. Returns its mask. */
  line(col: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
    const k = new Uint8Array(this.w * this.h);
    lineMask(k, this.w, this.h, x0, y0, x1, y1);
    this.maskPaint(col, k);
    return k;
  }

  /** One pixel that stays out of EPX at the finer tiers (a letter, an arrow). */
  stamp(col: number, x: number, y: number): void {
    const px = Math.trunc(x);
    const py = Math.trunc(y);
    const under = px >= 0 && py >= 0 && px < this.w && py < this.h ? this.c[py * this.w + px] : 0;
    this.px(col, px, py);
    if (px >= 0 && py >= 0 && px < this.w && py < this.h && this.c[py * this.w + px] === col) this.marks.push(['stamp', px, py, col, under]);
  }

  /** `grid` with stamps: a small shape that must keep its form at every tier. */
  stampGrid(rows: readonly string[], x: number, y: number, leg: Readonly<Record<string, number>>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && ch !== ' ') this.stamp(leg[ch], x + i, y + j);
      }
    });
  }

  /** Draw rows of characters, `.` and space are empty, `leg` gives the ids. */
  grid(rows: readonly string[], x: number, y: number, leg: Readonly<Record<string, number>>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && ch !== ' ') this.px(leg[ch], x + i, y + j);
      }
    });
  }

  /** Move the pixels of a mask along their ramps, in order: pairs of [from id, to id]. */
  retone(k: Uint8Array, pairs: ReadonlyArray<readonly [number, number]>): void {
    for (const [a, b] of pairs) {
      for (let i = 0; i < k.length; i++) if (k[i] && this.c[i] === a) this.c[i] = b;
    }
  }

  /** Copy a finished sprite (its z and part ids too). Top-left at (x, y). */
  paste(o: S, x: number, y: number, z?: number, part?: number): void {
    const px = Math.trunc(x);
    const py = Math.trunc(y);
    this.pasteAt(o, px, py, z, part);
    if (this.wrap) {
      if (px < 0) this.pasteAt(o, px + this.w, py, z, part);
      if (px + o.w > this.w) this.pasteAt(o, px - this.w, py, z, part);
    }
    for (const m of o.marks) this.marks.push([m[0], m[1] + px, m[2] + py, m[3], m[4]]);
  }

  private pasteAt(o: S, x: number, y: number, z?: number, part?: number): void {
    const xa = Math.max(0, -x);
    const ya = Math.max(0, -y);
    const xb = Math.min(o.w, this.w - x);
    const yb = Math.min(o.h, this.h - y);
    if (xb <= xa || yb <= ya) return;
    const zf = z === undefined ? 0 : fround(z);
    for (let j = ya; j < yb; j++) {
      for (let i = xa; i < xb; i++) {
        const si = j * o.w + i;
        const c = o.c[si];
        if (c > 0) {
          const di = (y + j) * this.w + x + i;
          this.c[di] = c;
          this.z[di] = z === undefined ? o.z[si] : zf;
          this.p[di] = part === undefined ? o.p[si] : part;
        }
      }
    }
  }

  /** The heroes' pass: selout at part borders, then one exterior outline (0 = none). */
  finish(outline: number = K, selout = true): this {
    const w = this.w;
    const h = this.h;
    const src = this.c;
    const out = src.slice();
    if (selout) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const ci = src[i];
          if (ci <= 0) continue;
          const pi = this.p[i];
          const lim = fround(this.z[i] + POINT_FOUR);
          let dark = false;
          if (y > 0 && src[i - w] > 0 && this.p[i - w] !== pi && this.z[i - w] > lim) dark = true;
          else if (y < h - 1 && src[i + w] > 0 && this.p[i + w] !== pi && this.z[i + w] > lim) dark = true;
          else if (x > 0 && src[i - 1] > 0 && this.p[i - 1] !== pi && this.z[i - 1] > lim) dark = true;
          else if (x < w - 1 && src[i + 1] > 0 && this.p[i + 1] !== pi && this.z[i + 1] > lim) dark = true;
          if (dark) out[i] = DARK.get(ci) ?? ci;
        }
      }
    }
    if (outline) {
      let zmin = Infinity;
      for (let i = 0; i < this.z.length; i++) if (this.z[i] < zmin) zmin = this.z[i];
      const zo = fround(zmin - 1);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (src[i] !== 0) continue;
          const on =
            (y > 0 && src[i - w] > 0 && !this.thin[i - w]) ||
            (y < h - 1 && src[i + w] > 0 && !this.thin[i + w]) ||
            (x > 0 && src[i - 1] > 0 && !this.thin[i - 1]) ||
            (x < w - 1 && src[i + 1] > 0 && !this.thin[i + 1]);
          if (on) {
            out[i] = outline;
            this.z[i] = zo;
            this.p[i] = 0;
          }
        }
      }
    }
    this.c = out;
    return this;
  }

  /** A new canvas with rows y0 up to y1 of this one (window marks follow). */
  cropRows(y0: number, y1: number): S {
    const o = new S(this.w, y1 - y0);
    const a = y0 * this.w;
    const b = y1 * this.w;
    o.c.set(this.c.subarray(a, b));
    o.z.set(this.z.subarray(a, b));
    o.p.set(this.p.subarray(a, b));
    o.thin.set(this.thin.subarray(a, b));
    o.marks = this.marks.map((m) => [m[0], m[1], m[2] - y0, m[3], m[4]] as Mark);
    o.wrap = this.wrap;
    return o;
  }

  /** A mask of the pixels that have one of these ids. */
  maskOf(ids: readonly number[]): Uint8Array {
    const k = new Uint8Array(this.c.length);
    const set = new Set(ids);
    for (let i = 0; i < k.length; i++) if (set.has(this.c[i])) k[i] = 1;
    return k;
  }
}

/** The sprite with an empty margin (room for the outline). */
export function addMargin(s: S, m = 1): S {
  const o = new S(s.w + 2 * m, s.h + 2 * m);
  o.paste(s, m, m);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) o.thin[(y + m) * o.w + x + m] = s.thin[y * s.w + x];
  }
  return o;
}

/** A new empty mask of a canvas. */
export function emptyMask(s: S): Uint8Array {
  return new Uint8Array(s.w * s.h);
}

/** A mask with the rectangle set (clipped as the reference does: `_m`). */
export function rectMask(H: number, W: number, x: number, y: number, w: number, h: number): Uint8Array {
  const k = new Uint8Array(H * W);
  const x0 = Math.max(x, 0);
  const x1 = Math.min(Math.max(x + w, 0), W);
  const y0 = Math.max(y, 0);
  const y1 = Math.min(Math.max(y + h, 0), H);
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) k[j * W + i] = 1;
  return k;
}

const FONT: Readonly<Record<string, string>> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110',
  T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', ' ': '000000000000000',
};

/** Small letters on a canvas (3 × 5). They are stamps: EPX would close them (D reads O, O reads U). */
export function text(s: S, msg: string, x: number, y: number, col: number, gap = 1): void {
  let cx = x;
  for (const ch of msg.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') s.stamp(col, cx + i, y + j);
    cx += 3 + gap;
  }
}

export function textW(msg: string, gap = 1): number {
  return msg.length * (3 + gap) - gap;
}

/** The art tier the parts are drawn for (the reference's `U`): 1, 2 or 4. Small things appear at 2 and up. */
let tier: 1 | 2 | 4 = 1;

export function kitTier(): 1 | 2 | 4 {
  return tier;
}

/** Run `fn` with the art tier set. Synchronous: safe in the art workers. */
export function withKitTier<T>(u: 1 | 2 | 4, fn: () => T): T {
  const was = tier;
  tier = u;
  try {
    return fn();
  } finally {
    tier = was;
  }
}

