/**
 * Mission oldenzaal — the ruin's painters (revision 2, spec §10.3, R2-7; owner RUIN): the shared,
 * density-generic shapes of the town after the outbreak. The shop fronts (missions/oldenzaal/
 * art-street.ts) and the `oz-boarded` entity art (./art.ts) use the SAME painters, so a boarded
 * window a zombie bursts through looks exactly like the boarded windows round it.
 *
 * - `plank` — one weathered plank (grey-brown, lit top arris, a shaded under edge, grain and knots
 *   at 4×, a nail at each end) between two logical points.
 * - `boards` — planks nailed across an opening (a dark gap between them), optional sprayed text.
 * - `smashed` — a window with its glass smashed out: a dark room, jagged shards at the frame, a
 *   torn blind; `soot` makes it a burnt-out one.
 * - `hole` — a burst opening: the dark room, splinters, a plank hanging from one nail.
 * - `note` — a paper note taped up (`GESLOTEN` / `NIET BETREDEN`; lines.ts `RUIN_NOTES`): typed
 *   at 4× (one art px per glyph px), a scribble at 1× / 2×.
 * - `R2` — a tone of the revision-2 ramps (`PAL_HD_OZ_R2`: rot, fieldGrey, rust, soot) at d.
 *
 * Same input, same pixels: no randomness except the hashes callers pass (`h2`).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD_OZ_R2, type HdOzR2RampName } from '../../../../engine/palette-hd';
import { dim, dq, h2, ladder, pick, snap, T, tinyText, tinyWidth, tones, type Dn, type Pen } from '../../missions/oldenzaal/art-kit';

/** The cold dusk grade (art-street.ts `GRADE` over `night[3]`). */
const COLD = T('night', 3, 2);

/**
 * Smooth value noise (0 … 1) at logical (x, y) with cells of `cell` logical px: clustered stains,
 * dust films and rust blooms instead of salt-and-pepper speckle.
 */
export function vnoise(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, seed);
  const b = h2(ix + 1, iy, seed);
  const c = h2(ix, iy + 1, seed);
  const e = h2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
}

/** Two octaves of `vnoise` (a rougher stain edge). */
export function fnoise(x: number, y: number, cell: number, seed: number): number {
  return vnoise(x, y, cell, seed) * 0.68 + vnoise(x, y, cell * 0.37, seed + 17) * 0.32;
}

/** Tone k (0 = deepest) of a revision-2 ramp at d (1×: the nearest PAL colour). */
export function R2(n: HdOzR2RampName, k: number, d: Dn): Color {
  const r = PAL_HD_OZ_R2[n];
  const c = r[Math.max(0, Math.min(r.length - 1, Math.round(k)))] >>> 0;
  return d === 1 ? snap(c, 1) : c;
}

/** A tone list of a revision-2 ramp at d. */
export function r2tones(n: HdOzR2RampName, d: Dn): readonly Color[] {
  return PAL_HD_OZ_R2[n].map((c) => (d === 1 ? snap(c >>> 0, 1) : c >>> 0));
}

/** Weathered plank wood: dark → grey-brown → bleached grey (a fine ladder at d). */
export function woodLadder(d: Dn): readonly Color[] {
  return ladder([T('ink', 1, d), T('brown', 1, d), T('brown', 2, d), T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d)], d === 1 ? 1 : 2, d);
}

/** The dark of an empty room behind an opening (top → bottom). */
export function roomTones(d: Dn): readonly Color[] {
  return [T('ink', 0, d), T('ink', 1, d), T('night', 1, d), T('night', 2, d)];
}

/**
 * One plank from (x0, y0) to (x1, y1) (its centre line), th logical px thick: the lit top arris,
 * the shaded under edge, grain and a knot at 4×, a nail near each end (`nails` false: none).
 * `k` the base tone on the wood ladder (0 … 1: dark … bleached).
 */
export function plank(p: Pen, x0: number, y0: number, x1: number, y1: number, th: number, seed: number, o: { k?: number; nails?: boolean; char?: number } = {}): void {
  const d = p.d;
  const lad = woodLadder(d);
  const top = lad.length - 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.max(0.01, Math.hypot(dx, dy));
  const ux = dx / L;
  const uy = dy / L;
  // The normal points down the screen (v grows toward the under edge).
  const nx = ux >= 0 ? -uy : uy;
  const ny = ux >= 0 ? ux : -ux;
  const h = th / 2;
  const base = (o.k ?? 0.45 + (h2(seed, 3, 41) - 0.5) * 0.3) * top;
  const char = o.char ?? 0;
  const knotU = 2 + h2(seed, 5, 41) * Math.max(1, L - 4);
  p.poly(
    [
      [x0 - nx * h, y0 - ny * h],
      [x1 - nx * h, y1 - ny * h],
      [x1 + nx * h, y1 + ny * h],
      [x0 + nx * h, y0 + ny * h],
    ],
    (X, Y) => {
      const x = (X + 0.5) / d - x0;
      const y = (Y + 0.5) / d - y0;
      const u = x * ux + y * uy;
      const v = x * nx + y * ny + h;
      const t = v / th;
      let k = base + (0.5 - t) * 2.2;
      if (d >= 2 && v < 1 / d + 0.01) k += 1.6;
      if (v > th - 1 / d - 0.01) k -= 2.2;
      if (d >= 2) {
        // Grain along the plank: thin darker lines, broken into lengths.
        const line = Math.floor(v * d * (d >= 4 ? 0.7 : 1));
        if (h2(line, Math.floor(u / 3), seed + 7) > 0.72) k -= 0.9;
        if (d >= 4 && h2(X, Y, seed + 9) > 0.94) k -= 0.8;
        // A knot.
        const ku = u - knotU;
        const kv = v - th * 0.5;
        if (ku * ku + kv * kv * 4 < 0.8) k -= 1.8;
      }
      // Charred: the far end burnt black (the burnt shop's boards).
      if (char > 0 && u > L * (1 - char)) k = Math.min(k, 1.2 - (u - L * (1 - char)) * 0.5);
      return pick(lad, dq(k, X, Y, 0.5));
    },
  );
  if (o.nails !== false && L > 4) {
    const nail = d === 1 ? T('steel', 1, d) : T('rust', 1, d);
    const head = d >= 4 ? T('steel', 4, d) : nail;
    for (const a of [1.6, L - 1.6]) {
      const cx = x0 + ux * a;
      const cy = y0 + uy * a;
      if (d === 1) continue;
      p.rect(cx - 0.5, cy - 0.5, 1, 1, nail);
      if (d >= 4) p.rect(cx - 0.5, cy - 0.5, 0.25, 0.25, head);
      // A rust run under the nail.
      if (d >= 4) p.rect(cx - 0.25, cy + 0.5, 0.25, 0.5 + h2(seed, a | 0, 3), T('rust', 1, d));
    }
  }
}

/** The dark room seen through an opening (x, y, w, h): deeper at the top, a faint cold floor. */
export function room(p: Pen, x: number, y: number, w: number, h: number, seed: number): void {
  const d = p.d;
  const t = roomTones(d);
  p.fill(x, y, w, h, (X, Y) => {
    const v = ((Y + 0.5) / d - y) / h;
    const u = ((X + 0.5) / d - x) / w;
    let k = v * 2.4 - 0.4 + (u > 0.7 ? -0.4 : 0);
    // A table / shelf silhouette low down in the dark (looted shop).
    if (d >= 2 && v > 0.62 && v < 0.68 && u > 0.18 && u < 0.86) k += 0.8;
    if (d >= 2 && v > 0.68 && (Math.abs(u - 0.24) < 0.03 || Math.abs(u - 0.8) < 0.03)) k += 0.7;
    if (d >= 4 && h2(X >> 1, Y >> 1, seed + 5) > 0.95) k += 0.6;
    return pick(t, dq(k, X, Y, 0.8));
  });
}

/**
 * Jagged glass left in a frame (x, y, w, h) after a smash: shards from the edges pointing in,
 * dark glass with a lit edge. `n` shards (by seed).
 */
export function shards(p: Pen, x: number, y: number, w: number, h: number, seed: number, n = 6): void {
  const d = p.d;
  const glass = tones('night', d, COLD, 0.05);
  const edge = T('glass', d === 1 ? 4 : 5, d);
  for (let i = 0; i < n; i++) {
    // Most glass hangs from the top and the sides; a few low stubs stand in the bottom rail.
    const side = SHARD_SIDES[i % SHARD_SIDES.length];
    const a = 0.12 + h2(i, 1, seed) * 0.76;
    const len = Math.min(w, h) * (0.18 + h2(i, 2, seed) * 0.3) * (side === 2 ? 0.45 : 1);
    const wid = 1.4 + h2(i, 3, seed) * 3;
    let pts: Array<[number, number]>;
    if (side === 0) {
      const sx = x + a * w;
      pts = [[sx - wid, y], [sx + wid, y], [sx + (h2(i, 4, seed) - 0.5) * 2, y + len]];
    } else if (side === 1) {
      const sy = y + a * h;
      pts = [[x + w, sy - wid], [x + w, sy + wid], [x + w - len, sy + (h2(i, 4, seed) - 0.5) * 2]];
    } else if (side === 2) {
      const sx = x + a * w;
      pts = [[sx - wid, y + h], [sx + wid, y + h], [sx + (h2(i, 4, seed) - 0.5) * 2, y + h - len]];
    } else {
      const sy = y + a * h;
      pts = [[x, sy - wid], [x, sy + wid], [x + len, sy + (h2(i, 4, seed) - 0.5) * 2]];
    }
    if (d === 1 && len < 2) continue;
    p.poly(pts, (X, Y) => pick(glass, dq(1.2 + ((Y + 0.5) / d - y) / h, X, Y, 0.8)));
    if (d >= 2) p.line(pts[0][0], pts[0][1], pts[2][0], pts[2][1], edge);
  }
}

const SHARD_SIDES = [0, 1, 3, 0, 2, 3, 1, 0] as const;

/** A smashed window (glass gone, the dark room, shards, maybe a torn blind); `soot`: burnt out. */
export function smashed(p: Pen, x: number, y: number, w: number, h: number, seed: number, o: { soot?: boolean; blind?: boolean } = {}): void {
  const d = p.d;
  room(p, x, y, w, h, seed);
  if (o.blind ?? h2(seed, 7, 3) > 0.5) {
    // A torn roller blind hanging from the top: a ragged lower edge.
    const cloth = tones('cloth', d, COLD, 0.45);
    p.fill(x, y, w, h * 0.5, (X, Y) => {
      const u = (X + 0.5) / d - x;
      const v = (Y + 0.5) / d - y;
      const edge = h * (0.12 + 0.3 * h2(Math.floor(u / 2), 1, seed + 11)) + Math.sin(u * 1.3) * 0.8;
      if (v > edge) return 0;
      if (u > w * 0.62 && h2(Math.floor(u / 3), 2, seed) > 0.4) return 0;
      return pick(cloth, dq(o.soot ? 0.3 : 1.4 - v / edge, X, Y, 0.7));
    });
  }
  shards(p, x, y, w, h, seed, w > 16 ? 7 : 4);
  if (o.soot) {
    const soot = r2tones('soot', d);
    p.tint(x, y, w, h, (X, Y, old) => (h2(X >> 1, Y >> 1, seed) > 0.25 ? pick(soot, dq(0.6 + ((Y + 0.5) / d - y) / h, X, Y, 0.8)) : old));
  }
}

/**
 * Planks nailed across an opening (x, y, w, h): `n` planks (default by height), a dark gap
 * between them (the room behind), slightly crooked, overhanging the frame by `over`; optional
 * sprayed `text` across them.
 */
export function boards(p: Pen, x: number, y: number, w: number, h: number, seed: number, o: { n?: number; over?: number; text?: string; diag?: boolean; char?: number } = {}): void {
  const d = p.d;
  room(p, x, y, w, h, seed);
  const n = o.n ?? Math.max(2, Math.round(h / 5.5));
  const over = o.over ?? 1;
  const th = Math.min(4.5, (h / n) * 0.82);
  for (let i = 0; i < n; i++) {
    const cy = y + (h * (i + 0.5)) / n;
    const tilt = (h2(i, 1, seed) - 0.5) * Math.min(3, h * 0.12);
    const l = x - over + h2(i, 2, seed) * 0.8;
    const r = x + w + over - h2(i, 3, seed) * 0.8;
    plank(p, l, cy - tilt / 2, r, cy + tilt / 2, th, seed * 7 + i, { char: o.char });
  }
  if (o.diag ?? h > w * 1.2) {
    // A diagonal brace across the planks (doors).
    plank(p, x + 0.5, y + h - 2, x + w - 0.5, y + 2, Math.min(3.4, th), seed * 7 + 99, { char: o.char });
  }
  if (o.text && d >= 2) {
    // Sprayed letters (cold white, a drip or two at 4×).
    const tw = tinyWidth(o.text);
    const sc = tw + 2 <= w ? 1 : 0.5;
    const tx = x + (w - tw * sc) / 2;
    const ty = y + h * 0.35;
    const paint = T('cloth', 3, d);
    tinyText(p, o.text, tx, ty, paint, { scale: sc });
    if (d >= 4) for (let k = 0; k < 2; k++) p.rect(tx + 2 + h2(k, 1, seed) * tw * sc * 0.8, ty + 5 * sc, 0.25, 1 + h2(k, 2, seed) * 2, paint);
  }
}

/**
 * A burst opening (x, y, w, h): the dark room, splinters at the frame, one plank hanging from a
 * nail and one on the sill; `glass` adds the shards of the smashed window.
 */
export function hole(p: Pen, x: number, y: number, w: number, h: number, seed: number, o: { glass?: boolean } = {}): void {
  room(p, x, y, w, h, seed);
  if (o.glass) shards(p, x, y, w, h, seed + 3, 5);
  // Splintered stubs of the planks still nailed at the frame's left and right.
  const n = Math.max(2, Math.round(h / 5.5));
  for (let i = 0; i < n; i++) {
    const cy = y + (h * (i + 0.5)) / n;
    const lw = 1.5 + h2(i, 1, seed) * 2.5;
    const rw = 1.5 + h2(i, 2, seed) * 2.5;
    if (h2(i, 3, seed) > 0.3) plank(p, x - 1, cy, x - 1 + lw, cy + (h2(i, 4, seed) - 0.5), 3, seed + i, { nails: false });
    if (h2(i, 5, seed) > 0.3) plank(p, x + w + 1 - rw, cy + (h2(i, 6, seed) - 0.5), x + w + 1, cy, 3, seed + 11 + i, { nails: false });
  }
  // One plank hangs from its left nail, swung down; one lies across the sill.
  const hx = x + 1.5;
  const hy = y + h * 0.3;
  plank(p, hx, hy, hx + w * 0.35, Math.min(y + h + 1, hy + h * 0.7), 3.2, seed + 40);
  plank(p, x + w * 0.3, y + h - 1.2, x + w + 0.5, y + h - 2.6, 2.8, seed + 41, { nails: false });
}

/**
 * A paper note taped up (w × h logical): white paper gone grey, tape corners, the text in our
 * lettering at 4× (half scale), a scribble of lines at 1× / 2×. `lines` the text lines.
 */
export function note(p: Pen, x: number, y: number, w: number, h: number, lines: readonly string[], seed: number): void {
  const d = p.d;
  const paper = tones('cloth', d, COLD, 0.3);
  p.fill(x, y, w, h, (X, Y) => {
    const v = ((Y + 0.5) / d - y) / h;
    const u = ((X + 0.5) / d - x) / w;
    // A torn lower corner, damp at the bottom.
    if (u > 0.78 && v > 0.82 && u + v > 1.75) return 0;
    return pick(paper, dq(3.2 - v * 1.2 + (d >= 4 && h2(X, Y, seed) > 0.9 ? -0.6 : 0), X, Y, 0.6));
  });
  const ink = T('ink', 1, d);
  if (d >= 4) {
    // One art px per glyph px (a quarter logical px): a typed notice.
    let ly = y + 1;
    for (const s of lines) {
      const tw = tinyWidth(s) * 0.25;
      tinyText(p, s, x + Math.max(0.5, (w - tw) / 2), ly, ink, { scale: 0.25 });
      ly += 1.75;
    }
  } else {
    for (let i = 0; i < Math.min(3, Math.floor((h - 1) / 2)); i++) p.rect(x + 1, y + 1 + i * 2, w - 2 - (i % 2), d === 1 ? 1 : 0.5, i === 0 ? ink : dim(paper[2], -1, d));
  }
  if (d >= 2) {
    const tape = T('sand', 5, d);
    p.rect(x - 0.5, y - 0.5, 2, 1, tape);
    p.rect(x + w - 1.5, y - 0.5, 2, 1, tape);
  }
}

/** Damp streaks running down from a ledge (x … x + w at y), up to `len` px long: darker wall. */
export function damp(p: Pen, x: number, y: number, w: number, len: number, seed: number): void {
  const d = p.d;
  for (let i = 0; i < Math.ceil(w / 3); i++) {
    if (h2(i, 1, seed) < 0.45) continue;
    const sx = x + i * 3 + h2(i, 2, seed) * 2;
    const sw = 0.8 + h2(i, 3, seed) * 1.8;
    const sl = len * (0.3 + h2(i, 4, seed) * 0.7);
    p.tint(sx, y, sw, sl, (X, Y, old) => {
      const v = ((Y + 0.5) / d - y) / sl;
      if (dq(1.2 - v, X, Y, 1) < 1) return 0;
      return dim(old, v < 0.45 && d >= 2 ? -2 : -1, d);
    });
  }
}

/** A crack in a wall: a zigzag from (x, y) going down / sideways, `len` px (2× / 4× only). */
export function crack(p: Pen, x: number, y: number, len: number, seed: number): void {
  const d = p.d;
  if (d === 1) return;
  let cx = x;
  let cy = y;
  const steps = Math.max(2, Math.round(len / 3));
  for (let i = 0; i < steps; i++) {
    const nx = cx + (h2(i, 1, seed) - 0.5) * 3.2;
    const ny = cy + 2 + h2(i, 2, seed) * 1.6;
    p.line(nx, ny, cx, cy, T('ink', 1, d));
    // A short branch now and then.
    if (d >= 4 && h2(i, 3, seed) > 0.75) p.line(nx, ny, nx + (h2(i, 4, seed) - 0.5) * 3, ny + 1.2, T('ink', 1, d));
    cx = nx;
    cy = ny;
  }
}

/**
 * Soot over a wall from a burnt opening (the plume widens and fades upward): the wall's own px
 * pushed toward the soot ramp. (cx, y0) the opening's top middle, `w` its width, up to `rise` px.
 */
export function sootPlume(p: Pen, cx: number, y0: number, w: number, rise: number, seed: number): void {
  const d = p.d;
  const soot = r2tones('soot', d);
  p.tint(cx - w, y0 - rise, w * 2, rise + 2, (X, Y) => {
    const x = (X + 0.5) / d - cx;
    const v = (y0 - (Y + 0.5) / d) / rise; // 0 at the opening, 1 at the top
    const half = w * (0.5 + v * 0.5) + Math.sin(v * 9 + seed) * 1.5;
    const a = Math.abs(x) / half;
    if (a > 1) return 0;
    const s = (1 - v) * (1 - a * a) * 2.6 + (d >= 4 ? (h2(X >> 1, Y >> 1, seed) - 0.5) * 0.6 : 0);
    if (dq(s, X, Y, 1) < 1) return 0;
    return pick(soot, dq(3.6 - s, X, Y, 0.8));
  });
}

/** A weed tuft (dry and green) at (x, y) = its foot, up to h px tall. */
export function weed(p: Pen, x: number, y: number, h: number, seed: number, dry = 0.5): void {
  const d = p.d;
  const green = tones('moss', d, COLD, 0.2);
  const straw = tones('sand', d, COLD, 0.35);
  const n = 3 + Math.floor(h2(seed, 1, 5) * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * 1.6 + (h2(i, 2, seed) - 0.5) * 0.4;
    const l = h * (0.5 + h2(i, 3, seed) * 0.5);
    const isDry = h2(i, 4, seed) < dry;
    const c = isDry ? pick(straw, 1.2 + h2(i, 5, seed)) : pick(green, 2 + h2(i, 5, seed) * 2);
    p.line(x, y, x + Math.sin(a) * l, y - Math.cos(a) * l, c, 1);
    if (d >= 4 && !isDry) p.rect(x + Math.sin(a) * l - 0.25, y - Math.cos(a) * l, 0.5, 0.5, pick(green, 4.5));
  }
}
