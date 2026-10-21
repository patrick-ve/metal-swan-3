/**
 * The Twente wares in the shop windows of Oldenzaal (revision 3, 2026-10-21; docs/design/
 * oldenzaal.md §10.3 "Revision 3: Twente wares", with the research summary and sources). ONE
 * density-generic painter per kind of ware, called by art-street.ts `shopWindow` between the dark
 * room and whatever covers the window (planks, shards, a half shutter, a grille, grimy glass), so
 * the goods read through the gaps. 1×: bold, few tones, whole px; 2× / 4×: new detail (currants,
 * mould, fat specks, checks, bindings, stoppers, cobwebs), never a scaled 1×.
 *
 * The town is ABANDONED: the colours are faded (a stronger cold grade than the fronts), the bread
 * has mould, the shelves are dusty and webbed, things lie knocked over. No brand, no label text,
 * no real business: plain generic goods.
 *
 * Kinds (`WareKind`), the shop that sells them (art-street.ts `SHOPS`):
 * - `bread` (BAKKERIJ) — ONE krentenwegge, the long Twente birth loaf, on its board across the
 *   whole window (currants, egg-wash gloss, mould); domed krentenbroden and a dark roggebrood
 *   below, one loaf fallen off the shelf, a tipped basket of rolls.
 * - `sausage` (SLAGERIJ) — metworsten, thick grey Twentse bakleverworsten (clipped casings) and
 *   thin droge worsten hanging from a rail on hooks (one hook empty), a tray with grey blocks of
 *   balkenbrij on the counter, a sausage on the floor.
 * - `cloth` (STOFFEN) — Twente cotton: checked cloth (blue / white, red / white: generic Dutch
 *   checks, not a claimed Twente pattern) rolled on a shelf and standing in bolts, a plain
 *   unbleached bolt, a torn length hanging down, cones of yarn.
 * - `klompen` (KLOMPEN) — pairs of pale poplar / willow klompen on shelves, one kicked over.
 * - `drink` (SLIJTERIJ) — beugelflessen (brown swing-top bottles, white stoppers), stoneware
 *   kruiken and square bottles of a local kruidenbitter with blank labels, a crate of swing-tops.
 * - `horns` (HOUTWAREN) — midwinterhoorns (long, slightly curved bare-wood horns widening to the
 *   bell, bound with bands, an elder mouthpiece) on hooks, one fallen; a peeled split trunk.
 * - `banket` (BANKET) — knieperkes (rolled New Year wafers) in jars and round tins, a
 *   krentenwegge with a bow (the kraamvisite loaf).
 * - `kool` (GROENTEN) — heads of boeskool (white cabbage: Oldenzaal is "Boeskoolstad" in its
 *   carnival) on a shelf and in crates, some rotting.
 *
 * Decor (registered in art-street.ts): `twenteFlag` (`decor/oz/flag`, the torn flag of Twente:
 * the white rearing horse on red) and `paveWares` (`decor/oz/wares`: a beer crate, klompen on a
 * crate, a tipped crate of boeskool on the pavement).
 *
 * Same input, same pixels: no randomness except the hashes (`h2`).
 */
import type { Color } from '../../../../engine/color';
import { R2 } from '../../oldenzaal/ruin/paint';
import { dim, h2, pick, T, tones, type Dn, type Pen, type Rn } from './art-kit';

export type WareKind = 'bread' | 'sausage' | 'cloth' | 'klompen' | 'drink' | 'horns' | 'banket' | 'kool';

/** A window rect (logical px, top-left and size). */
export interface WinRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface WareOpts {
  /** The burnt shop: the goods charred (soot tones, a pale unburnt edge here and there). */
  readonly charred?: boolean;
}

const COLD = T('night', 3, 2);
/** The wares' grade: faded under dust in a dark shop (stronger than the fronts' 0.2). */
const FADE = 0.34;

/** Faded tones of ramp n at d. */
function ft(n: Rn, d: Dn, t = FADE): readonly Color[] {
  return tones(n, d, COLD, t);
}

/** Paint the wares of `kind` into window r (call after the dark room, before the cover). */
export function paintWares(p: Pen, kind: WareKind, r: WinRect, seed: number, o: WareOpts = {}): void {
  switch (kind) {
    case 'bread':
      bread(p, r, seed);
      break;
    case 'sausage':
      sausages(p, r, seed);
      break;
    case 'cloth':
      cloth(p, r, seed);
      break;
    case 'klompen':
      klompen(p, r, seed, !!o.charred);
      break;
    case 'drink':
      drinks(p, r, seed);
      break;
    case 'horns':
      horns(p, r, seed);
      break;
    case 'banket':
      banket(p, r, seed);
      break;
    case 'kool':
      kool(p, r, seed);
      break;
  }
  if (!o.charred) {
    const right = h2(seed, 2, 5) > 0.5;
    cobweb(p, right ? r.x + r.w - 0.5 : r.x, r.y, 4 + h2(seed, 1, 5) * 3, right);
  }
}

// ============================================================================================
// Shared shapes
// ============================================================================================

/**
 * A rounded bar from (x0, y0) to (x1, y1), thickness th0 → th1 (logical): `sh(u, v)` per art px
 * with u 0 … 1 along it and v −1 … 1 across (−1 = the side toward the upper left: the lit side).
 */
function bar(p: Pen, x0: number, y0: number, x1: number, y1: number, th0: number, th1: number, sh: (u: number, v: number, X: number, Y: number) => Color, round = true): void {
  const d = p.d;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L2 = Math.max(1e-6, dx * dx + dy * dy);
  const L = Math.sqrt(L2);
  const r = Math.max(th0, th1) / 2 + 1;
  const bx0 = Math.min(x0, x1) - r;
  const by0 = Math.min(y0, y1) - r;
  const bx1 = Math.max(x0, x1) + r;
  const by1 = Math.max(y0, y1) + r;
  // The normal pointing to the upper left (the lit side) is −v.
  let nx = -dy / L;
  let ny = dx / L;
  if (nx + ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  p.fill(bx0, by0, bx1 - bx0, by1 - by0, (X, Y) => {
    const px = (X + 0.5) / d - x0;
    const py = (Y + 0.5) / d - y0;
    let t = (px * dx + py * dy) / L2;
    const out = t < 0 || t > 1;
    if (out && !round) return 0;
    const tc = Math.max(0, Math.min(1, t));
    const half = (th0 + (th1 - th0) * tc) / 2;
    const cx = dx * tc - px;
    const cy = dy * tc - py;
    const dist = Math.hypot(cx, cy);
    if (dist > half) return 0;
    const side = -(px - dx * tc) * nx - (py - dy * tc) * ny;
    t = tc;
    return sh(t, Math.max(-1, Math.min(1, -side / half)), X, Y);
  });
}

/** A shelf plank across the window at y (its top), lit top edge at 2× / 4×, a bracket at each end. */
function shelf(p: Pen, x: number, y: number, w: number, seed: number): void {
  const d = p.d;
  const wood = ft('wood', d, 0.42);
  p.rect(x, y, w, 1, pick(wood, 2));
  if (d >= 2) {
    p.rect(x, y, w, 1 / d, pick(wood, 3.4));
    // Dust on the shelf: a pale film in patches (clusters, not speckle).
    for (let i = 0; i < 3; i++) {
      const sx = x + 1 + h2(i, 1, seed) * (w - 6);
      p.rect(sx, y, 2 + h2(i, 2, seed) * 4, 1 / d, pick(ft('stone', d, 0.4), 3));
    }
    p.rect(x, y + 1, 1, 1.5, pick(wood, 1));
    p.rect(x + w - 1, y + 1, 1, 1.5, pick(wood, 1));
  }
}

/** A cobweb in a top corner of a window (2× / 4×): spokes from the corner and sagging threads. */
function cobweb(p: Pen, cx: number, y: number, size: number, right: boolean): void {
  const d = p.d;
  if (d === 1) return;
  const c = pick(ft('cloth', d, 0.5), 1.6);
  const sgn = right ? -1 : 1;
  const spokes = [0, 0.45, 0.95, 1.45];
  const ends: Array<[number, number]> = [];
  for (const a of spokes) {
    const ex = Math.cos(a) * size;
    const ey = Math.sin(a) * size;
    ends.push([ex, ey]);
    p.line(cx, y, cx + sgn * ex, y + ey, c, 1);
  }
  // Two rings of threads between the spokes, sagging toward the corner.
  for (const f of [0.45, 0.8]) {
    for (let k = 0; k + 1 < ends.length; k++) {
      const [ax, ay] = ends[k];
      const [bx, by] = ends[k + 1];
      const mx = ((ax + bx) / 2) * f * 0.86;
      const my = ((ay + by) / 2) * f * 0.86;
      p.line(cx + sgn * ax * f, y + ay * f, cx + sgn * mx, y + my, c, 1);
      p.line(cx + sgn * mx, y + my, cx + sgn * bx * f, y + by * f, c, 1);
    }
  }
}

/** A blot of mould (rot ramp, pale bloom rim) at (cx, cy), r logical: 2× / 4× only; 1× one px. */
function mould(p: Pen, cx: number, cy: number, r: number, seed: number): void {
  const d = p.d;
  if (d === 1) {
    p.rect(Math.round(cx), Math.round(cy), 1, 1, R2('rot', 5, d));
    return;
  }
  p.disc(cx, cy, r, r * 0.7, (X, Y, u, v) => {
    const rr = u * u + v * v + (h2(X >> 1, Y >> 1, seed) - 0.5) * 0.35;
    if (rr > 0.9) return 0;
    return R2('rot', rr > 0.5 ? 6 : rr > 0.2 ? 5 : 4, d);
  });
}

// ============================================================================================
// The wares
// ============================================================================================

/** A krentenwegge lying on a shelf: (x, base) its left end on the shelf top, len × th. */
function wegge(p: Pen, x: number, base: number, len: number, th: number, seed: number, mouldy: boolean): void {
  const d = p.d;
  const crust = ft('brown', d, 0.2);
  const top = base - th;
  p.fill(x, top, len, th, (X, Y) => {
    const u = (X + 0.5) / d - x;
    const v = ((Y + 0.5) / d - top) / th;
    const ex = Math.min(u, len - u);
    // Rounded ends: the top corners cut, the bottom ones less.
    if (ex < 0.9 && v < 0.4) return 0;
    if (ex < 0.4 && v > 0.8) return 0;
    let k = v < 0.3 ? 5 : v < 0.75 ? 4 : 2.4;
    if (d >= 2) k = 5.6 - v * 3.4 - (ex < 1.2 ? 0.8 : 0);
    // 1×: currants as a row of dark px along the middle (every third px).
    if (d === 1 && v >= 0.3 && v < 0.75 && ex > 1 && Math.floor(u + seed) % 3 === 0) k = 1.6;
    return pick(crust, k);
  });
  if (d >= 2) {
    // The glossy egg-wash highlight along the top, the currants pressed into the crust.
    p.rect(x + 1.5, top + 0.5, len - 3, 1 / d, pick(ft('sand', d, 0.24), 5));
    const n = Math.floor(len / 1.6);
    for (let i = 0; i < n; i++) {
      const cx = x + 1 + i * 1.6 + h2(i, 1, seed) * 0.6;
      const cy = top + 1 + h2(i, 2, seed) * (th - 1.8);
      p.rect(cx, cy, 0.5, 0.5, pick(crust, 1));
      if (d >= 4) p.rect(cx, cy, 0.25, 0.25, pick(crust, 3)); // the currant's gloss
    }
  }
  if (mouldy) mould(p, x + len * (0.3 + h2(seed, 3, 9) * 0.4), top + th * 0.35, Math.min(2.2, th * 0.7), seed);
}

/** A krentenbrood (an ordinary domed currant loaf) at (x, base): w × h. */
function loaf(p: Pen, x: number, base: number, w: number, h: number, seed: number, mouldy: boolean): void {
  const d = p.d;
  const crust = ft('brown', d, 0.22);
  p.disc(x + w / 2, base, w / 2, h, (X, Y, u, v) => {
    if (v > 0) return 0;
    let k = v < -0.6 ? 4.6 : u < -0.3 ? 4 : 3;
    if (d >= 2) k = 3.2 - v * 1.8 - u * 0.8;
    if (d >= 2 && h2(X >> (d >> 1), Y >> (d >> 1), seed) > 0.9 && v > -0.75) k = 1.2; // currants
    return pick(crust, k);
  });
  p.rect(x + 0.5, base - 0.6, w - 1, 0.6, pick(crust, 2));
  if (mouldy) mould(p, x + w * 0.6, base - h * 0.55, 1.2, seed);
}

/** A Twents roggebrood: a dark block (base its foot), w × h, a cut face at 2× / 4×. */
function rye(p: Pen, x: number, base: number, w: number, h: number, seed: number, cut: boolean): void {
  const d = p.d;
  const t = ft('brown', d, 0.3);
  const y = base - h;
  p.rect(x, y, w, h, pick(t, 1.6));
  p.rect(x, y, w, 1, pick(t, 2.6));
  if (d >= 2) {
    p.rect(x, y, 1 / d, h, pick(t, 3));
    p.rect(x + w - 1 / d, y, 1 / d, h, pick(t, 1));
    if (cut) {
      // The cut end: the dense crumb (a lighter grey-brown face), the crust round it.
      p.rect(x + w - 1.5, y + 0.5, 1.5 - 1 / d, h - 1, pick(ft('stone', d, 0.3), 2));
    }
  }
  void seed;
}

/**
 * A glass jar of rolled knieperkes (golden tubes stacked side on, like logs) at (x, base): w × h,
 * a lid; `full` 0 … 1.
 */
function wafersJar(p: Pen, x: number, base: number, w: number, h: number, full: number): void {
  const d = p.d;
  const gold = ft('gold', d, 0.3);
  const jar = ft('glass', d, 0.3);
  // The jar: dark glass, rounded shoulders, a lit left edge, a neck and a tin lid.
  p.rect(x, base - h + 1.5, w, h - 1.5, pick(jar, 1.4));
  p.rect(x + 0.5, base - h + 1, w - 1, 0.5, pick(jar, 1.4));
  const rows = Math.floor(((h - 2) * full) / (d === 1 ? 2 : 1.25));
  for (let j = 0; j < rows; j++) {
    const ry = base - 1.5 - j * (d === 1 ? 2 : 1.25);
    p.rect(x + 0.5, ry, w - 1, 1, pick(gold, 4));
    if (d >= 2) {
      p.rect(x + 0.5, ry, w - 1, 1 / d, pick(gold, 5)); // the lit top of the roll
      p.rect(x + 0.5, ry, 0.5, 1, pick(gold, 2)); // the spiral end
      p.rect(x + w - 1, ry, 0.5, 1, pick(gold, 2));
    }
  }
  p.rect(x + 1, base - h, w - 2, 1, pick(ft('steel', d, 0.3), 3.4));
  p.rect(x, base - h + 1.5, d === 1 ? 1 : 0.5, h - 1.5, pick(jar, 3.4));
  if (d >= 2) p.rect(x + w - 1 / d, base - h + 1.5, 1 / d, h - 1.5, pick(jar, 2));
}

function bread(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  const s1 = r.y + 8;
  const s2 = r.y + 15;
  shelf(p, r.x, s1, r.w, seed);
  shelf(p, r.x, s2, r.w, seed + 1);
  // Top shelf: ONE krentenwegge on its board, the length of the whole window (the long birth loaf),
  // mouldy in two places.
  wegge(p, r.x + 1, s1, r.w - 2, 4, seed, true);
  if (d >= 2) mould(p, r.x + r.w * 0.78, s1 - 2.6, 1.6, seed + 11);
  // Middle shelf: domed krentenbroden and a dark roggebrood; one loaf fallen half off the end.
  const n = Math.max(2, Math.floor((r.w - 12) / 7));
  for (let i = 0; i < n; i++) {
    if (i === n - 1) rye(p, r.x + 1.5 + i * 7, s2, 6, 3.5, seed, true);
    else loaf(p, r.x + 1 + i * 7, s2, 6, 3.4, seed + i, h2(i, 6, seed) > 0.5);
  }
  const fx = r.x + r.w - 10;
  bar(p, fx, s2 - 2, fx + 8, s2 + 4, 3.4, 3.4, (u, v) => pick(ft('brown', d, 0.24), d === 1 ? (v < -0.2 ? 4.6 : 3) : 5 - (v + 1) * 1.4 - (u > 0.85 ? 0.8 : 0)));
  if (d >= 2) mould(p, fx + 5.5, s2 + 1.2, 1.4, seed + 7);
  // The floor of the display: a tipped bread basket, rolls spilt out of it.
  const fy = r.y + r.h;
  const wick = ft('sand', d, 0.4);
  const bx = r.x + 2;
  p.poly(
    [
      [bx, fy - 4],
      [bx + 7, fy - 5],
      [bx + 8, fy],
      [bx + 1, fy],
    ],
    (X, Y) => pick(wick, d >= 2 && (X + (Y >> 1)) % (2 * d) < d ? 3.4 : 2.4),
  );
  const roll = ft('brown', d, 0.26);
  for (let i = 0; i < 3; i++) {
    const cx = bx + 10 + i * 3.4 + h2(i, 5, seed);
    p.disc(cx, fy - 1.2, 1.6, 1.2, (_X, _Y, u, v) => pick(roll, v < -0.3 ? 5 : u > 0.4 ? 3 : 4));
  }
  if (d >= 2) mould(p, bx + 13.4, fy - 1.6, 1, seed + 3);
}

/** One sausage hanging from a hook at (hx, y0): its kind's colours, length and thickness. */
function hanging(p: Pen, hx: number, y0: number, kind: 0 | 1 | 2, len: number, lean: number, seed: number): void {
  const d = p.d;
  // 0 metworst (dark red-brown, fat specks), 1 bakleverworst (thick, grey, a clear casing),
  // 2 droge worst (thin, dark, a dry white bloom).
  const t = kind === 1 ? ft('stone', d, 0.3) : ft('brickDark', d, kind === 0 ? 0.18 : 0.28);
  const th = kind === 1 ? 3.2 : kind === 0 ? 2.2 : 1.6;
  const base = kind === 1 ? 2.6 : 3.6;
  bar(p, hx + 0.5, y0 + th * 0.5, hx + 0.5 + lean, y0 + len, th, th * 0.9, (u, v, X, Y) => {
    let k = d === 1 ? (v < -0.1 ? base + 1.2 : base - 0.6) : base + 1.4 - (v + 1) * 1.3 - (u > 0.92 ? 0.8 : 0);
    if (d >= 2 && kind === 0 && h2(X >> (d >> 1), Y >> (d >> 1), seed) > 0.86) return pick(ft('cloth', d, 0.4), 2.6);
    if (d >= 2 && kind === 2 && v > -0.3 && h2(X >> 1, Y >> 2, seed + 30) > 0.8) k += 1.4;
    if (d >= 2 && kind === 1 && v < -0.55) return pick(ft('cloth', d, 0.45), 2.6); // the casing's sheen
    return pick(t, k);
  });
  if (kind === 1) {
    // The clipped ends of the casing.
    p.rect(hx, y0 - 0.2, 1, 0.8, pick(ft('steel', d, 0.3), 3.4));
    p.rect(hx + lean, y0 + len + th * 0.4, 1, 0.8, pick(ft('steel', d, 0.3), 3));
  }
}

function sausages(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  const steel = ft('steel', d, 0.3);
  const meat = ft('brickDark', d, 0.18);
  const str = ft('cloth', d, 0.45);
  // The rail across the top and its hooks: metworsten, bakleverworsten and droge worsten in turn.
  p.rect(r.x, r.y + 1, r.w, 1, pick(steel, 2.4));
  if (d >= 2) p.rect(r.x, r.y + 1, r.w, 1 / d, pick(steel, 4));
  const order: ReadonlyArray<0 | 1 | 2> = [0, 1, 2, 0, 1, 0, 2, 1, 0, 2];
  let x = r.x + 2;
  let i = 0;
  while (x < r.x + r.w - 3) {
    const kind = order[(i + seed) % order.length];
    const hx = Math.round(x);
    p.rect(hx, r.y + 2, 1, 1, pick(steel, 3.4));
    const empty = h2(i, 1, seed) < 0.14;
    if (!empty) {
      p.rect(hx, r.y + 3, 1, 1, pick(str, 2.4));
      const len = (kind === 1 ? 8 : kind === 0 ? 9 : 11) + Math.floor(h2(i, 2, seed) * 3);
      hanging(p, hx, r.y + 4, kind, len, (h2(i, 3, seed) - 0.5) * 1.4, seed + i);
    }
    x += kind === 1 ? 5 : 4;
    i++;
  }
  // The counter: a white enamel tray with blocks of balkenbrij (one sliced), a metworst on the floor.
  const ty = r.y + r.h - 3;
  const tray = ft('cloth', d, 0.42);
  p.rect(r.x + 2, ty, r.w * 0.55, 1, pick(tray, 2.2));
  if (d >= 2) p.rect(r.x + 2, ty, r.w * 0.55, 1 / d, pick(tray, 3.4));
  const bb = ft('stone', d, 0.3);
  p.rect(r.x + 3, ty - 3, 6, 3, pick(bb, 1.8));
  p.rect(r.x + 3, ty - 3, 6, 1, pick(bb, 2.8));
  p.rect(r.x + 10, ty - 2, 3, 2, pick(bb, 1.8));
  if (d >= 2) {
    p.rect(r.x + 10, ty - 2, 3, 1 / d, pick(bb, 3));
    p.rect(r.x + 3, ty - 3, 1 / d, 3, pick(bb, 3.4));
    for (let k = 0; k < 2; k++) p.rect(r.x + 13.5 + k * 1.2, ty - 2, 0.75, 2, pick(bb, 2.6)); // slices
  }
  const fx = r.x + r.w * 0.62;
  bar(p, fx, r.y + r.h - 1.2, fx + 8, r.y + r.h - 1.6, 2, 2, (_u, v) => pick(meat, v < -0.2 ? 4.4 : 2.6));
}

/** A head of boeskool (white cabbage) at (cx, cy), r: pale green, leaf veins at 2× / 4×; `rot` 0 … 1. */
function cabbage(p: Pen, cx: number, cy: number, r: number, rot: number, seed: number): void {
  const d = p.d;
  const g = ft('olive', d, 0.3);
  p.disc(cx, cy, r, r * 0.9, (X, _Y, u, v) => {
    const rr = u * u + v * v;
    // Rot: brown-black patches from the bottom up.
    if (rot > 0 && v > 0.6 - rot * 1.2 && h2(X >> (d >> 1), 1, seed) > 0.35) return R2('rot', v > 0.7 ? 1 : 2, d);
    let k = rr < 0.3 && u < 0.2 && v < 0.1 ? 7 : u < -0.2 && v < 0.2 ? 6.4 : u > 0.45 || v > 0.55 ? 4.4 : 5.4;
    if (d >= 2) {
      // The outer leaves' veins: curves round the head.
      const a = Math.atan2(v, u);
      if (rr > 0.45 && Math.abs(Math.sin(a * 3 + seed)) < 0.12) k -= 1.2;
      if (rr > 0.86) k -= 0.8;
    }
    return pick(g, k);
  });
}

/** A wooden crate (slats) at (x, base), w × h. */
function crate(p: Pen, x: number, base: number, w: number, h: number): void {
  const d = p.d;
  const wood = ft('wood', d, 0.4);
  p.rect(x, base - h, w, h, pick(wood, 2.6));
  p.rect(x, base - h, w, 1, pick(wood, 3.6));
  p.rect(x, base - h * 0.5, w, d === 1 ? 1 : 0.5, pick(wood, 1.4));
  if (d >= 2) {
    p.rect(x, base - h, 1 / d, h, pick(wood, 4));
    p.rect(x + w - 1 / d, base - h, 1 / d, h, pick(wood, 1.2));
  }
}

function kool(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  // A stepped display: a crate high up on a stand, two on the floor; heads of boeskool piled in
  // them, some rotting, one rolled out on the floor; a wilted leaf.
  const fy = r.y + r.h;
  const sy = r.y + 11;
  shelf(p, r.x, sy, r.w, seed);
  const n = Math.max(2, Math.floor((r.w - 2) / 8));
  for (let i = 0; i < n; i++) {
    const cx = r.x + 4 + i * 8 + (h2(i, 1, seed) - 0.5);
    cabbage(p, cx, sy - 3.4, 3.4, h2(i, 2, seed) > 0.7 ? 0.6 : 0, seed + i);
  }
  const cw = Math.floor((r.w - 3) / 2);
  for (let k = 0; k < 2; k++) {
    const x = r.x + 1 + k * (cw + 1);
    // Heads above the crate's rim, then the crate's front over their lower halves.
    for (let i = 0; i < Math.floor(cw / 6); i++) cabbage(p, x + 3 + i * 6, fy - 6, 3, h2(i, k, seed + 5) > 0.6 ? 0.8 : 0, seed + 10 + i + k * 7);
    crate(p, x, fy, cw, 4);
  }
  // One head rolled out, rotten, by the glass; a fallen leaf on the shelf.
  if (d >= 2) {
    const lx = r.x + r.w * 0.4;
    p.poly(
      [
        [lx, sy],
        [lx + 3, sy - 1],
        [lx + 4.5, sy],
      ],
      R2('rot', 4, d),
    );
  }
}

/** Gingham checks (bont): two stripe sets crossing; tone 0 / 1 / 2 = none / one / both. */
function checks(u: number, v: number, cell: number, a: readonly Color[], b: readonly Color[], ka: number, kb: number): Color {
  const cu = Math.floor(u / cell) % 2 === 0;
  const cv = Math.floor(v / cell) % 2 === 0;
  if (cu && cv) return pick(a, ka - 1.4);
  if (cu || cv) return pick(a, ka);
  return pick(b, kb);
}

function cloth(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  const blue = ft('denim', d, 0.4);
  const red = ft('red', d, 0.42);
  const white = ft('cloth', d, 0.48);
  const cell = d === 1 ? 2 : 1;
  const sy = r.y + 9;
  shelf(p, r.x, sy, r.w, seed);
  // The shelf: rolled bolts lying, seen side on (rounded ends, the checks along them).
  const n = Math.max(2, Math.floor((r.w - 2) / 11));
  const bw = (r.w - 2 - (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = r.x + 1 + i * (bw + 1);
    const col = i % 3 === 1 ? red : blue;
    for (let k = 0; k < 2; k++) {
      const y = sy - 3 - k * 3;
      if (k === 1 && i % 2 === 1) continue;
      p.fill(x, y, Math.floor(bw), 3, (X, Y) => {
        const u = (X + 0.5) / d - x;
        const v = (Y + 0.5) / d - y;
        if ((u < 0.6 || u > Math.floor(bw) - 0.6) && (v < 0.6 || v > 2.4)) return 0;
        const c = checks(u, v, cell, col, white, 3.6, 3.4);
        return v > 2.2 ? dim(c, -1, d) : c;
      });
    }
  }
  // The floor: bolts standing on end, leaning, checks and one plain unbleached; a torn length
  // hanging from the shelf down to the floor; cones of yarn.
  const fy = r.y + r.h;
  const kinds = [blue, red, ft('sand', d, 0.4), blue];
  const m = Math.max(2, Math.floor((r.w - 10) / 6));
  for (let i = 0; i < m; i++) {
    const x = r.x + 1 + i * 6;
    const h = 10 + Math.floor(h2(i, 3, seed) * 3);
    const lean = i === m - 1 ? 2 : 0;
    const col = kinds[i % kinds.length];
    const plain = col !== blue && col !== red;
    p.poly(
      [
        [x + lean, fy - h],
        [x + 5 + lean, fy - h],
        [x + 5, fy],
        [x, fy],
      ],
      (X, Y) => {
        const u = (X + 0.5) / d - x;
        const v = (Y + 0.5) / d - (fy - h);
        if (plain) return pick(col, (u < 1 ? 4 : 3) - (d >= 2 && Math.floor(v) % 3 === 0 ? 0.6 : 0));
        const c = checks(u, v, cell, col, white, 3.4, 3.2);
        return u > 4 ? dim(c, -1, d) : c;
      },
    );
  }
  // The torn length: from the shelf's front edge down over the bolts (ragged lower end).
  const lx = r.x + r.w - 8;
  p.fill(lx, sy + 1, 6, fy - sy - 3, (X, Y) => {
    const u = (X + 0.5) / d - lx;
    const v = (Y + 0.5) / d - sy - 1;
    const end = fy - sy - 5 + Math.sin(u * 2.1 + seed) * 1.6 + h2(Math.floor(u), 1, seed) * 1.5;
    if (v > end) return 0;
    const c = checks(u + v * 0.15, v, cell, red, white, 3.6, 3.2);
    return u > 4.5 ? dim(c, -1, d) : c;
  });
  // Cones of yarn (the mills' spools) on the floor in front.
  const yarn = ft('cloth', d, 0.38);
  for (let i = 0; i < 2; i++) {
    const cx = r.x + r.w - 13 + i * 3.5;
    p.poly(
      [
        [cx - 1.5, fy],
        [cx + 1.5, fy],
        [cx + 0.6, fy - 4],
        [cx - 0.6, fy - 4],
      ],
      (X) => pick(yarn, (X + 0.5) / d < cx ? 3.6 : 2.4),
    );
    if (d >= 2) p.rect(cx - 0.5, fy - 4.5, 1, 0.5, pick(ft('wood', d, 0.3), 3));
  }
}

/**
 * A klomp in profile, toe to the right: (x, base) its heel's foot, 7 × 3.5 logical. `t` the
 * wood's tones, `k` its mid tone; `back` the far one of a pair (a tone deeper).
 */
function klomp(p: Pen, x: number, base: number, t: readonly Color[], k: number, charred: number, seed: number): void {
  const d = p.d;
  const y = base - 3.5;
  const pts: Array<[number, number]> = [
    [x, y],
    [x + 4.2, y + 0.2],
    [x + 6.4, y + 1.6],
    [x + 7.4, y + 2.1],
    [x + 7.2, y + 3.5],
    [x + 0.4, y + 3.5],
    [x, y + 3.0],
  ];
  p.poly(pts, (X, Y) => {
    const u = (X + 0.5) / d - x;
    const v = (Y + 0.5) / d - y;
    // The foot opening at the back of the top: dark inside.
    if (u > 0.9 && u < 3.6 && v < (d === 1 ? 1 : 1.1)) return pick(t, Math.max(0, k - 3));
    let kk = k + (v < 1.6 ? 0.9 : v > 3 ? -1.4 : 0);
    if (d >= 2 && u > 6) kk -= 0.5;
    // Burnt (the burnt shop): scorched from the sole up to `charred` × its height; the rest of
    // the wood darkened by the heat.
    if (charred > 0) {
      const edge = 3.5 * (1 - charred) + (d >= 2 ? Math.sin(u * 2.3 + seed) * 0.35 : 0);
      if (v > edge) return R2('soot', v > edge + 1 ? 1 : 2, d);
      kk -= 1;
    }
    return pick(t, kk);
  });
  if (d >= 2 && charred < 1) {
    // The heel's lit back edge, a carved line round the opening.
    p.rect(x + 0.2, y + 0.6, 1 / d, 1.4, pick(t, k + 1.6 - (charred > 0 ? 1 : 0)));
    p.rect(x + 0.9, y + 1.1, 2.7, 1 / d, pick(t, k - 1));
  }
}

function klompen(p: Pen, r: WinRect, seed: number, charred: boolean): void {
  const d = p.d;
  const wood = ft('sand', d, 0.18);
  const painted = ft('gold', d, 0.3);
  const shelves = [r.y + 7, r.y + 14];
  for (const [i, sy] of shelves.entries()) shelf(p, r.x, sy, r.w, seed + i);
  const rows = [...shelves, r.y + r.h];
  const n = Math.floor((r.w - 1) / 11);
  // One gap on a shelf (a pair taken), one klomp kicked over on the floor.
  const gap = Math.floor(h2(seed, 1, 13) * n);
  rows.forEach((base, row) => {
    for (let i = 0; i < n; i++) {
      const x = r.x + 1 + i * 11 + (row === 1 ? 1.5 : 0);
      if (row === 0 && i === gap) continue;
      const t = (i + row) % 4 === 3 ? painted : wood;
      // Burnt shop: the fire came from the floor: the lower klompen scorched more.
      const burn = charred ? Math.min(1, 0.25 + row * 0.25 + h2(i, row + 3, seed) * 0.3) : 0;
      if (row === 2 && i === n - 1) {
        // On its side, the sole up.
        bar(p, x, base - 1.4, x + 7, base - 2, 2.6, 2.2, (_u, v) => (charred ? R2('soot', v < 0 ? 3 : 2, d) : pick(t, v < 0 ? 3.4 : 5)));
        continue;
      }
      // A pair: the far one behind (2.5 px on, a little higher, a tone deeper), the near one in front.
      klomp(p, x + 2.5, base - 0.6, t, 3.4, burn, seed + i);
      klomp(p, x, base, t, 4.8, burn, seed + i + 9);
    }
  });
}

/** A swing-top bottle (beugelfles) standing at (x, base): 2 wide, 6 high; brown glass. */
function beugel(p: Pen, x: number, base: number, glass: readonly Color[], seed: number): void {
  const d = p.d;
  const y = base - 6;
  p.rect(x, y + 2.5, 2, 3.5, pick(glass, 2));
  p.rect(x, y + 2.5, 1, 3.5, pick(glass, 3.4));
  p.rect(x + 0.5, y + 1, 1, 1.5, pick(glass, 2.4));
  // The white stopper.
  p.rect(x + 0.5, y, 1, 1, pick(ft('cloth', d, 0.35), 4));
  if (d >= 2) {
    // The wire clamp down the neck, a pale label band, a lit glint.
    p.rect(x + 0.25, y + 1, 1 / d, 1.5, pick(ft('steel', d, 0.3), 4));
    p.rect(x + 1.5, y + 1, 1 / d, 1.5, pick(ft('steel', d, 0.3), 3));
    p.rect(x, y + 3.5, 2, 1.25, pick(ft('sand', d, 0.4), 4));
    p.rect(x + 0.25, y + 2.75, 1 / d, 0.5, pick(glass, 5));
    if (d >= 4) p.rect(x + 0.5, y + 0.75, 1, 0.25, pick(ft('red', d, 0.3), 3)); // the rubber ring
  }
  void seed;
}

/** A stoneware jenever kruik at (x, base): 4 × 5, a brown salt-glazed top and a handle. */
function kruik(p: Pen, x: number, base: number): void {
  const d = p.d;
  const clay = ft('sand', d, 0.34);
  const glaze = ft('brown', d, 0.3);
  const y = base - 5;
  p.disc(x + 2, y + 3, 2, 2.2, (_X, _Y, u, v) => pick(v < -0.3 ? glaze : clay, v < -0.3 ? 3 : u < -0.3 ? 4.4 : u > 0.5 ? 2.6 : 3.4));
  p.rect(x + 1.5, y, 1, 1.4, pick(glaze, 3));
  if (d >= 2) {
    // The ear (handle) on the right, a cork.
    p.rect(x + 3.6, y + 1.2, 0.5, 2, pick(glaze, 2.4));
    p.rect(x + 3, y + 1, 0.75, 0.5, pick(glaze, 2.4));
    p.rect(x + 1.5, y - 0.4, 1, 0.5, pick(ft('wood', d, 0.3), 4));
  }
}

/** A square bitter bottle at (x, base): 3 × 6, dark herb liquor in clear glass, a pale blank label. */
function bitter(p: Pen, x: number, base: number): void {
  const d = p.d;
  const liq = ft('rust', d, 0.3);
  const y = base - 6;
  p.rect(x, y + 2, 3, 4, pick(liq, 1.4));
  p.rect(x, y + 2, 1, 4, pick(liq, 2.6));
  p.rect(x + 1, y, 1, 2, pick(liq, 1.6));
  p.rect(x + 0.5, y + 3, 2, 2, pick(ft('cloth', d, 0.42), d === 1 ? 2.4 : 3));
  if (d >= 2) p.rect(x + 1, y - 0.5, 1, 0.5, pick(ft('gold', d, 0.4), 3));
}

function drinks(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  const glass = ft('brown', d, 0.2);
  const s1 = r.y + 8;
  const s2 = r.y + 15;
  shelf(p, r.x, s1, r.w, seed);
  shelf(p, r.x, s2, r.w, seed + 1);
  // Top shelf: a row of swing-tops (two missing, one fallen over).
  const n = Math.floor((r.w - 2) / 3);
  for (let i = 0; i < n; i++) {
    const x = r.x + 1 + i * 3;
    const hv = h2(i, 1, seed);
    if (hv < 0.12) continue;
    if (hv > 0.9) {
      bar(p, x - 1, s1 - 1, x + 4, s1 - 1, 2, 2, (_u, v) => pick(glass, v < 0 ? 3.4 : 2));
      continue;
    }
    beugel(p, x, s1, glass, seed + i);
  }
  // Middle shelf: stone kruiken and square bitter bottles.
  let x = r.x + 1;
  let i = 0;
  while (x < r.x + r.w - 4) {
    if (i % 3 === 2) {
      bitter(p, x, s2);
      x += 4;
    } else {
      kruik(p, x, s2);
      x += 5;
    }
    i++;
  }
  // The floor: a wooden crate of swing-tops (the white stoppers in a row), one bottle rolled out.
  const fy = r.y + r.h;
  const wood = ft('wood', d, 0.4);
  const cw = Math.min(14, r.w - 10);
  const cx = r.x + 2;
  for (let k = 0; k < Math.floor(cw / 2); k++) {
    p.rect(cx + 0.5 + k * 2, fy - 6, 1, 2, pick(glass, 2));
    p.rect(cx + 0.5 + k * 2, fy - 7, 1, 1, pick(ft('cloth', d, 0.35), 4));
  }
  p.rect(cx, fy - 4, cw, 4, pick(wood, 2.4));
  p.rect(cx, fy - 4, cw, 1, pick(wood, 3.4));
  if (d >= 2) {
    p.rect(cx + 1, fy - 2.5, cw - 2, 1 / d, pick(wood, 1.4));
    p.rect(cx + cw / 2 - 1.5, fy - 3, 3, 1, pick(wood, 1));
  }
  bar(p, cx + cw + 2, fy - 1.2, cx + cw + 8, fy - 1, 2, 2, (u, v) => (u > 0.82 ? pick(ft('cloth', d, 0.35), 4) : pick(glass, v < 0 ? 3.4 : 2)));
}

/**
 * A midwinterhoorn hanging level on two hooks, from (x0, y) (the thin mouthpiece end) to x1 (the
 * bell): a long tapered wooden horn, a little curved, bound with dark rings.
 */
function horn(p: Pen, x0: number, x1: number, y: number, th: number, seed: number, rise: number): void {
  const d = p.d;
  const wood = ft('wood', d, 0.28);
  const L = x1 - x0;
  const cy = (t: number): number => y - rise * t * t;
  const rad = (t: number): number => (0.55 + (th / 2 - 0.55) * Math.pow(t, 1.8));
  // Column by column: the curved axis bending up toward the bell, the bore widening.
  p.fill(x0, y - rise - th, L, rise + th * 2, (X, Y) => {
    const t = ((X + 0.5) / d - x0) / L;
    if (t < 0 || t > 1) return 0;
    const v = ((Y + 0.5) / d - cy(t)) / rad(t);
    if (Math.abs(v) > 1) return 0;
    const at = t * L;
    // The bindings (bands round the horn): every 6 px at 1×, every 4 px dense.
    const step = d === 1 ? 6 : 4;
    const ring = t > 0.1 && t < 0.93 && Math.abs(at - Math.round(at / step) * step) < (d === 1 ? 0.5 : 0.3);
    if (ring) return pick(wood, v < -0.3 ? 2.4 : 1.2);
    // The bell's rim and its dark mouth (seen a little from the side).
    if (t > 1 - 0.6 / L) return pick(wood, v < 0 ? 1.6 : 1);
    if (d === 1) return pick(wood, v < -0.2 ? 5 : 3.4);
    return pick(wood, 5.4 - (v + 1) * 1.25);
  });
  // The loose mouthpiece (elder, paler) at the thin end, cut at a slant.
  const elder = ft('sand', d, 0.34);
  p.rect(x0 - 1.5, y - 0.5, 2, 1, pick(elder, 3.4));
  if (d >= 2) p.rect(x0 - 1.5, y - 0.5, 0.5, 0.5, pick(elder, 5));
  // The hooks it hangs on.
  const hook = pick(ft('steel', d, 0.3), 3);
  for (const t of [0.3, 0.75]) p.rect(x0 + L * t, cy(t) - rad(t) - 1, 1, 1, hook);
  void seed;
}

function horns(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  // Two horns on hooks on the back wall, a third fallen (diagonal, its bell on the floor).
  horn(p, r.x + 3, r.x + r.w - 2, r.y + 6, 4, seed, 2.5);
  horn(p, r.x + 5, r.x + r.w - 4, r.y + 12.5, 3.6, seed + 1, 2);
  const wood = ft('wood', d, 0.32);
  bar(p, r.x + 4, r.y + 15.5, r.x + r.w * 0.66, r.y + r.h - 2, 1.2, 3.4, (u, v) => {
    const at = u * r.w * 0.6;
    const ring = d === 1 ? u > 0.15 && Math.abs(at - Math.round(at / 6) * 6) < 0.5 : u > 0.12 && Math.abs(at - Math.round(at / 4) * 4) < 0.3;
    if (ring) return pick(wood, 1.4);
    return pick(wood, d === 1 ? (v < 0 ? 4.6 : 3.2) : 5 - (v + 1) * 1.3);
  });
  // The maker's work: a peeled half of a split trunk leaning in the corner, shavings on the floor.
  const bx = r.x + r.w - 6;
  const bark = ft('sand', d, 0.36);
  p.poly(
    [
      [bx, r.y + r.h],
      [bx + 1.5, r.y + 14],
      [bx + 3.5, r.y + 14],
      [bx + 3, r.y + r.h],
    ],
    (X) => pick(bark, (X + 0.5) / d < bx + 1.6 ? 4.4 : 3),
  );
  if (d >= 2) p.rect(bx + 1.6, r.y + 15, 1 / d, r.h - 16, pick(bark, 1.6)); // the hollowed bore
  const shav = ft('sand', d, 0.3);
  for (let k = 0; k < 4; k++) p.rect(r.x + r.w * 0.7 + k * 1.6, r.y + r.h - 1, d === 1 ? 1 : 1.2, d === 1 ? 1 : 0.5, pick(shav, 4 + (k % 2)));
}

/** A tin of kniepertjes at (x, base): w × h, a lid, faded paint. */
function tin(p: Pen, x: number, base: number, w: number, h: number, col: readonly Color[]): void {
  const d = p.d;
  const y = base - h;
  p.rect(x, y, w, h, pick(col, 2.6));
  p.rect(x, y, 1, h, pick(col, 3.6));
  p.rect(x - 0.5, y, w + 1, 1, pick(ft('steel', d, 0.3), 3.6));
  if (d >= 2) p.rect(x + 1, y + h * 0.45, w - 2, 1, pick(ft('cloth', d, 0.4), 3)); // a blank paper band
}

function banket(p: Pen, r: WinRect, seed: number): void {
  const d = p.d;
  const s1 = r.y + 10;
  shelf(p, r.x, s1, r.w, seed);
  // The shelf: tall glass jars of rolled knieperkes (one nearly empty), a krentenwegge with a
  // bow (the kraamvisite loaf).
  const n = Math.max(1, Math.floor((r.w - 14) / 7));
  for (let i = 0; i < n; i++) wafersJar(p, r.x + 1.5 + i * 7, s1, 6, 9, i === 1 ? 0.3 : 0.9);
  const wx = r.x + 1 + n * 7;
  const wl = r.x + r.w - wx - 1;
  wegge(p, wx, s1, wl, 3, seed + 3, true);
  const bowc = ft('sky', d, 0.4);
  const bcx = Math.round(wx + wl / 2);
  p.rect(bcx, s1 - 3, 1, 3, pick(bowc, 3));
  p.rect(bcx - 1, s1 - 4, 3, 1, pick(bowc, 4));
  // The floor: round tins of knieperkes, one stacked, one knocked over (its lid off, wafers out).
  const fy = r.y + r.h;
  const reds = ft('red', d, 0.38);
  const blues = ft('navy', d, 0.25);
  tin(p, r.x + 2, fy, 7, 4, reds);
  tin(p, r.x + 3, fy - 4, 5, 3, blues);
  tin(p, r.x + 11, fy, 6, 4, blues);
  bar(p, r.x + 19, fy - 2, r.x + 24, fy - 1.5, 3.4, 3.4, (_u, v) => pick(reds, v < 0 ? 3.4 : 2.2));
  const gold = ft('gold', d, 0.3);
  for (let k = 0; k < 3; k++) p.rect(r.x + 25 + k * 1.8, fy - 1, 1.4, 1, pick(gold, 4));
}

// ============================================================================================
// The Twentse Ros flag and the pavement wares (decor)
// ============================================================================================

/** The flag's size (logical; anchor top-left at the window sill it is pinned under). */
export const FLAG_W = 17;
export const FLAG_H = 13;

/**
 * The flag of Twente, torn and faded, hanging flat against the wall from a window sill: a red
 * field with the white rearing horse (the Twentse Ros, facing the hoist; a black outline at 2× /
 * 4× as in the 1981 design). Pinned at the top left, the right corner sagging; the lower right
 * torn ragged, mould and soot stains.
 */
export function twenteFlag(p: Pen): void {
  const d = p.d;
  const W = FLAG_W;
  const H = FLAG_H;
  const red = d === 1 ? tones('red', d) : ft('red', d, 0.14);
  // The cloth: a soft fold every few px (2× / 4×), the right top corner sagging, the tear.
  p.fill(0, 0, W, H, (X, Y) => {
    const u = (X + 0.5) / d;
    const v = (Y + 0.5) / d;
    const sag = u > W * 0.6 ? (u - W * 0.6) * 0.18 : 0;
    if (v < sag) return 0;
    const tear = H - 0.6 - (u > W * 0.74 ? (u - W * 0.74) * 0.9 : 0) - h2(Math.floor(u * 1.4), 3, 41) * 1.4;
    if (v > tear) return 0;
    let k = 4;
    if (d >= 2) k += Math.sin(u * 1.15) * 0.6 - v / H * 0.8;
    else k -= u > W * 0.72 ? 1 : 0;
    if (v - sag < 1) k -= 1.2; // the hem
    return pick(red, k);
  });
  // The horse: rearing, facing left (the hoist): body, neck and head, the raised forelegs, the
  // hind legs on the ground, the tail. Black outline first (dense), then the white.
  const white = ft('cloth', d, 0.36);
  const parts = (c: (u: number, v: number) => Color, grow: number): void => {
    const sh = (u: number, v: number): Color => c(u, v);
    bar(p, 10.8, 7.8, 7.6, 4.8, 3 + grow, 2.7 + grow, sh); // body, steep: rump low, chest high
    bar(p, 7.6, 4.4, 6.6, 2.0, 1.9 + grow, 1.4 + grow, sh); // neck
    bar(p, 6.8, 1.8, 4.7, 2.7, 1.5 + grow, 1.1 + grow, sh); // head, the muzzle down left
    bar(p, 7.0, 5.0, 5.0, 4.4, 0.9 + grow, 0.8 + grow, sh); // the forelegs raised, bent at the knee
    bar(p, 5.0, 4.4, 4.6, 6.0, 0.8 + grow, 0.7 + grow, sh);
    bar(p, 7.6, 5.8, 5.8, 6.4, 0.9 + grow, 0.8 + grow, sh);
    bar(p, 5.8, 6.4, 5.6, 7.8, 0.8 + grow, 0.7 + grow, sh);
    bar(p, 10.2, 8.4, 9.8, 11.6, 1 + grow, 0.8 + grow, sh); // the hind legs, on the ground
    bar(p, 11.2, 8.2, 12.0, 11.6, 1 + grow, 0.8 + grow, sh);
    bar(p, 11.8, 6.6, 13.6, 9.8, 0.9 + grow, 0.7 + grow, sh); // the tail
  };
  if (d >= 2) parts(() => T('ink', 1, d), 1 / d + 0.25);
  parts((_u, v) => pick(white, d === 1 ? 4 : v < -0.2 ? 5 : 4), 0);
  if (d >= 2) {
    // Grime over the lower cloth and the horse (a mould stain, soot from the street).
    p.tint(0, H * 0.55, W, H * 0.45, (X, Y, old) => (h2(X >> (d >> 1), Y >> d, 44) > 0.72 ? dim(old, -1, d) : 0));
    mould(p, W * 0.2, H * 0.84, 1.3, 45);
  }
  // The iron nail at the top left.
  p.rect(0.5, 0, 1, 1, pick(ft('steel', d, 0.3), 2));
}

/** The pavement wares' frames (decor in front of the Twente shops; anchor bottom-left on G). */
export const PAVE_WARES: ReadonlyArray<{ w: number; h: number }> = [
  { w: 22, h: 9 },
  { w: 18, h: 10 },
  { w: 20, h: 9 },
];

/**
 * The pavement wares (frame i, `PAVE_WARES`): 0 a beer crate of swing-top bottles (one rolled
 * out, one broken), 1 a low crate with klompen on it (one pair kicked off), 2 a
 * tipped crate of boeskool (the heads rolled out, rotting).
 */
export function paveWares(p: Pen, i: number): void {
  const d = p.d;
  const H = p.h;
  const wood = ft('wood', d, 0.36);
  if (i === 0) {
    // A beer crate: the swing-tops standing in it (white stoppers in a row, one gap), one bottle
    // rolled out and one broken on the pavers.
    const glass = ft('brown', d, 0.2);
    const stop = ft('cloth', d, 0.3);
    for (let k = 0; k < 5; k++) {
      if (k === 2) continue;
      const bx = 1.5 + k * 2.2;
      p.rect(bx, H - 8, 1.4, 3, pick(glass, 2.4));
      if (d >= 2) p.rect(bx, H - 8, 0.5, 3, pick(glass, 3.6));
      p.rect(bx, H - 9, 1.4, 1, pick(stop, 4.6));
      if (d >= 2) p.rect(bx + 0.25, H - 8, 1 / d, 1, pick(ft('steel', d, 0.3), 4)); // the wire
    }
    p.rect(0.5, H - 5, 12, 5, pick(wood, 2));
    p.rect(0.5, H - 5, 12, 1, pick(wood, 3.4));
    if (d >= 2) {
      p.rect(0.5, H - 5, 1 / d, 5, pick(wood, 4));
      p.rect(4.5, H - 3.4, 4, 1, T('ink', 1, d)); // the hand hole
      p.rect(0.5, H - 1.5, 12, 1 / d, pick(wood, 1.2));
    }
    bar(p, 13.5, H - 1.2, 18.5, H - 1.6, 2, 2, (u, v) => (u > 0.84 ? pick(stop, 4.6) : pick(glass, v < 0 ? 3.4 : 2)));
    bar(p, 19.2, H - 1.2, 21, H - 1.4, 2, 2, (_u, v) => pick(glass, v < 0 ? 3.4 : 2));
    if (d >= 2) for (let k = 0; k < 3; k++) p.rect(17.6 + k * 0.9, H - 0.6 - (k % 2) * 0.5, 0.5, 0.5, pick(glass, 4.6));
  } else if (i === 1) {
    // A low crate (a display bench by the door), two pairs on it, one klomp on the pavers.
    const t = ft('sand', d, 0.18);
    const dark = ft('wood', d, 0.5);
    p.rect(0, H - 4, 14, 4, pick(dark, 1.4));
    p.rect(0, H - 4, 14, 1, pick(dark, 2.4));
    if (d >= 2) p.rect(1, H - 2, 12, 1 / d, pick(dark, 0.6));
    klomp(p, 2.5, H - 4.6, t, 3.4, 0, 3);
    klomp(p, 0, H - 4, t, 4.8, 0, 4);
    klomp(p, 8.5, H - 4.6, t, 3.4, 0, 5);
    klomp(p, 6, H - 4, t, 4.8, 0, 6);
    bar(p, 14.2, H - 1.4, 17.2, H - 2.4, 2.4, 2, (_u, v) => pick(t, v < 0 ? 3.4 : 5));
  } else {
    // The crate tipped forward, the heads rolled out over the pavers; two rotten.
    p.poly(
      [
        [0, H - 6],
        [9, H - 7.5],
        [10, H],
        [1, H],
      ],
      (X) => pick(wood, (X + 0.5) / d < 1.5 ? 3.6 : 2.4),
    );
    p.rect(0.5, H - 3.4, 9.2, d === 1 ? 1 : 0.5, pick(wood, 1.2));
    cabbage(p, 12, H - 3, 3, 0, 61);
    cabbage(p, 17.4, H - 2.6, 2.6, 0.9, 62);
    cabbage(p, 7.6, H - 8.2, 2.8, 0.5, 63);
  }
}
