/**
 * The near layers of the ring (docs/design/ring.md §2, §7.3, §11): ONE density-generic drawer
 * each (kit.ts `Pen`; d 1 = the 1× art in PAL, d 2 / 4 = PAL_HD), painted without ink outlines;
 * static furniture (guard rails, signs, doors, posts) gets outline C at d ≥ 2 (`edgeC`).
 *
 * - `ring-verge` (0.75; 256 × 64 from screen y 36): the far side of the oncoming carriageway —
 *   kinds trees, screens (noise screens), fence (port), reeds (lake), plain; `water` spans (the
 *   bridge parapet), `cut` spans (the tunnel approach walls), `signs` (white-on-blue RING A10
 *   signs and exit signs with the S-shield).
 * - `ring-farroad` (0.9; 256 × 44 from y 64): the oncoming carriageway ('road') or the railway
 *   between the carriageways at Zuid ('rail', catenary masts and wires).
 * - `ring-tunnel` (1.0; 256 × 113 from y 0): the tunnel interior between portals — the ceiling
 *   with jet fans, the LED light band (lit segments centred on every LAMP_STEP px), wall panels, a
 *   blue band with reflectors, green escape doors with the running-man pictogram, emergency phone
 *   posts, the concrete barrier at the wall foot — and covered stretches (the buildings over the
 *   road: soffit, columns, shade). `spans` = [a, b, covered, …] local x.
 * - `ring-road` (1.0; 256 × 123 from y 85): hectometre boards (`hm`), the median (a steel guard
 *   rail on a concrete plinth; a concrete barrier on bridges; the tunnel kerb), the asphalt with
 *   wear, wheel tracks, patches and cracks, white lane dashes and edge lines, the hard shoulder;
 *   tunnels: 3 lanes, the near lane becomes the raised walkway; bridges: expansion joints; the
 *   exit: block markings and the gore.
 * - `ring-front` (1.25; 256 × 22 from y 194): the near crash barrier (a W-beam guard rail on
 *   posts with reflectors), the concrete barrier in tunnels, the bridge parapet with its railing,
 *   the opening and crash cushion at the exit.
 *
 * Params: `kind`, `x0` (the chunk's layer x; textures and repeating furniture use GLOBAL x so
 * neighbouring chunks join), `rs` (run seed); the spans in local x.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD, type HdRampName } from '../../../../engine/palette-hd';
import { noise1 } from '../../../art/paint';
import { defineRingGen, tree, type Gen } from './layers-far';
import { bay, dq, h2, haze, num, nums, Pen, str, tinyText, tinyWidth, toneI, type Dn, type Params } from './kit';

const BIG = 1 << 22;

/** Local x pairs [a, b] (or triples with a flag) from a numeric param. */
function spans(p: Params, k: string, stride = 2): Array<[number, number, number]> {
  const v = nums(p, k);
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i + stride - 1 < v.length; i += stride) out.push([v[i], v[i + 1], stride > 2 ? v[i + 2] : 0]);
  return out;
}

function inSpans(x: number, list: ReadonlyArray<readonly [number, number, number]>): boolean {
  for (const s of list) if (x >= s[0] && x < s[1]) return true;
  return false;
}

/** HD tone k of a ramp at d (1× snaps to PAL). */
function T(r: HdRampName, k: number, d: Dn): Color {
  return toneI(r, k, d);
}

/** Outline C at d ≥ 2: ink ½ px on the shadow side (right and bottom) of a static piece. */
function edgeC(p: Pen, x: number, y: number, w: number, h: number): void {
  if (p.d === 1) return;
  const ink = PAL_HD.ink[1];
  p.rect(x + w - 0.5, y, 0.5, h, ink);
  p.rect(x, y + h - 0.5, w, 0.5, ink);
}

// =============================================================================================
// ring-verge (screen y 36 … 100)
// =============================================================================================

const VERGE_TOP = 36;

interface SignSpec {
  x: number;
  code: string;
  name: string;
  kind: string;
}

function signsOf(p: Params): SignSpec[] {
  const v = p.signs;
  if (!Array.isArray(v)) return [];
  const out: SignSpec[] = [];
  for (const s of v) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    if (typeof o.x !== 'number') continue;
    out.push({ x: o.x, code: String(o.code ?? ''), name: String(o.name ?? ''), kind: String(o.kind ?? 'exit') });
  }
  return out;
}

const verge: Gen = (w, h, p, seed, d) => {
  const pen = new Pen(w, h, d);
  const kind = str(p, 'kind', 'trees');
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  const water = spans(p, 'water');
  const cut = spans(p, 'cut');
  const Y = (sy: number): number => sy - VERGE_TOP;
  const air = 0.08;
  const bankTop = Y(90);
  // Ground: a grass bank (not on bridges: the parapet there).
  const grass: Color[] = [haze(T('green', 2, d), air, d), haze(T('green', 3, d), air, d), haze(T('green', 4, d), air, d), haze(T('green', 5, d), air, d)];
  for (let X = 0; X < pen.W; X++) {
    const lx = (X + 0.5) / d;
    if (inSpans(lx, water)) continue;
    const gx = x0 + lx;
    const top = bankTop - noise1(gx, 11, BIG, rs + 31) * 2 - (kind === 'reeds' ? -2 : 0);
    const T0 = Math.round(top * d);
    for (let Yy = T0; Yy < pen.H; Yy++) {
      const dy = (Yy - T0) / d;
      let k = dy < 0.6 ? 3 : dy < 2.5 ? 2 : 1;
      if (d > 1 && dy < 3 && h2(X, Yy >> 1, rs) > 0.82) k = Math.min(3, k + 1);
      pen.dot(X, Yy, grass[k]);
    }
  }
  if (kind === 'trees' || kind === 'plain') {
    const n = kind === 'trees' ? 7 : 3;
    for (let k = -1; k <= n; k++) {
      const gk = Math.floor(x0 / (w / n)) + k;
      const tx = (gk + 0.3 + h2(gk, 1, rs) * 0.4) * (w / n) - x0;
      if (tx < -20 || tx > w + 20 || inSpans(tx, water) || inSpans(tx, cut)) continue;
      const r = kind === 'trees' ? 7 + h2(gk, 2, rs) * 6 : 4 + h2(gk, 2, rs) * 3;
      tree(pen, tx, bankTop + 3, r, air, rs + gk);
      if (h2(gk, 3, rs) < 0.6) tree(pen, tx + r * 1.3, bankTop + 3, r * 0.45, air, rs + gk + 9, false);
    }
  } else if (kind === 'reeds') {
    const reed: Color[] = [haze(T('olive', 3, d), air, d), haze(T('olive', 5, d), air, d), haze(T('sand', 5, d), air, d)];
    // One reed per chosen logical column (the same columns at every density; finer at d ≥ 2).
    for (let lx = 0; lx < w; lx++) {
      if (inSpans(lx + 0.5, water)) continue;
      const gx = Math.floor(x0) + lx;
      if (h2(gx, 7, rs) < 0.45) continue;
      const hgt = Math.round(6 + h2(gx, 8, rs) * 9);
      const top = bankTop + 2 - hgt;
      const c = reed[Math.floor(h2(gx, 9, rs) * 3)];
      if (d === 1) pen.rect(lx, top, 1, bankTop + 3 - top, c);
      else {
        pen.rect(lx + 0.25, top, 0.5, bankTop + 3 - top, c);
        pen.rect(lx + 0.25, top, 0.25, bankTop + 3 - top, reed[2]);
      }
      if (h2(gx, 10, rs) < 0.2) pen.rect(lx, top - 2, 1, 2, haze(T('brown', 3, d), air, d));
    }
    // A willow now and then.
    for (let k = -1; k <= 2; k++) {
      const gk = Math.floor(x0 / 128) + k;
      if (h2(gk, 11, rs) < 0.5) continue;
      const tx = (gk + 0.5) * 128 - x0;
      if (tx < -24 || tx > w + 24 || inSpans(tx, water)) continue;
      willow(pen, tx, bankTop + 2, 11, air, rs + gk);
    }
  } else if (kind === 'screens') {
    noiseScreens(pen, x0, Y, water);
  } else if (kind === 'fence') {
    fence(pen, x0, Y, water, rs);
  }
  // Water spans: the bridge parapet of the oncoming carriageway (the river shows above it).
  for (const [a, b] of water) parapet(pen, Math.max(a, -4), Math.min(b, w + 4), Y(90), x0);
  for (const [a, b] of cut) cutWall(pen, a, b, Y, x0);
  for (const s of signsOf(p)) roadSign(pen, s, Y);
  void seed;
  return pen.finish();
};

/** A weeping willow: a trunk and drooping strands. */
function willow(p: Pen, cx: number, foot: number, r: number, air: number, seed: number): void {
  const d = p.d;
  p.rect(cx - 0.75, foot - r * 0.9, 1.5, r * 0.9, haze(T('brown', 2, d), air, d));
  const leaf = [haze(T('olive', 3, d), air, d), haze(T('olive', 4, d), air, d), haze(T('olive', 6, d), air, d)];
  p.disc(cx, foot - r * 1.3, r, r * 0.65, (_X, _Y, u, v) => leaf[Math.max(0, Math.min(2, Math.floor(1.4 - u * 0.8 - v * 0.9)))]);
  // Strands hanging to the bank.
  for (let k = -5; k <= 5; k++) {
    const sx = cx + k * r * 0.17;
    const len = r * (0.5 + h2(k, seed, 4) * 0.5);
    p.rect(sx, foot - r * 1.0, d === 1 ? 1 : 0.5, len, leaf[k < 0 ? 1 : 0]);
  }
}

/** Noise screens: steel posts every 24 px, absorbing lower panels with ribs, glazed upper panels. */
function noiseScreens(p: Pen, x0: number, Y: (sy: number) => number, water: ReadonlyArray<readonly [number, number, number]>): void {
  const d = p.d;
  const top = Y(64);
  const mid = Y(80);
  const bot = Y(100);
  const panel: Color[] = [T('teal', 1, d), T('teal', 2, d), T('olive', 3, d), T('olive', 4, d)];
  const post: Color[] = [T('steel', 2, d), T('steel', 3, d), T('steel', 5, d)];
  const glass = T('glass', 4, d);
  const glint = T('snow', 5, d);
  for (let X = 0; X < p.W; X++) {
    const lx = (X + 0.5) / d;
    if (inSpans(lx, water)) continue;
    const gx = x0 + lx;
    // Lower panels: horizontal ribs, lit top of each rib.
    for (let Yy = Math.round(mid * d); Yy < Math.round(bot * d); Yy++) {
      const y = (Yy + 0.5) / d - mid;
      const rib = y % 2;
      const k = rib < 0.5 ? 3 : rib < 1.5 ? 2 : 1;
      p.dot(X, Yy, d === 1 ? panel[Math.floor(y) % 2 === 0 ? 2 : 1] : panel[k]);
    }
    // Upper glazing: clear, with two reflection streaks per panel and a tinted foot strip.
    const ux = ((gx % 24) + 24) % 24;
    for (let Yy = Math.round(top * d); Yy < Math.round(mid * d); Yy++) {
      const y = (Yy + 0.5) / d - top;
      if (y > mid - top - 1.5) p.dot(X, Yy, glass);
      else {
        // A reflection streak on the glass: the 1× px of the streak; the dense art draws a finer
        // line inside those px.
        const cx = Math.floor(gx) + 0.5 - Math.floor(gx / 24) * 24;
        const cy = Math.floor(y) + 0.5;
        if (Math.abs(cx - 6 - cy * 0.6) < 0.5 && (d === 1 || Math.abs(ux - 6 - y * 0.6) < 0.45)) p.dot(X, Yy, glint);
      }
    }
  }
  // Posts and the top rail.
  for (let g = Math.floor(x0 / 24) * 24 - 24; g < x0 + p.w + 24; g += 24) {
    const lx = g - x0;
    if (inSpans(lx, water)) continue;
    p.rect(lx - 1, top - 1, 2, bot - top + 1, post[1]);
    p.rect(lx - 1, top - 1, 0.5, bot - top + 1, post[2]);
    p.rect(lx + 0.5, top - 1, 0.5, bot - top + 1, post[0]);
  }
  p.rect(0, top - 1, p.w, 1, post[2]);
  p.rect(0, mid - 0.5, p.w, 1, post[1]);
}

/** A port fence: posts, line wires; bushes behind. */
function fence(p: Pen, x0: number, Y: (sy: number) => number, water: ReadonlyArray<readonly [number, number, number]>, rs: number): void {
  const d = p.d;
  const top = Y(76);
  const bot = Y(92);
  for (let k = -1; k <= 6; k++) {
    const gk = Math.floor(x0 / 48) + k;
    const tx = (gk + 0.5) * 48 - x0;
    if (inSpans(tx, water) || h2(gk, 1, rs) < 0.3) continue;
    tree(p, tx, bot + 1, 4 + h2(gk, 2, rs) * 3, 0.1, rs + gk, false);
  }
  const wire = T('steel', 4, d);
  const postC = T('steel', 3, d);
  for (let g = Math.floor(x0 / 16) * 16 - 16; g < x0 + p.w + 16; g += 16) {
    const lx = g - x0;
    if (inSpans(lx, water)) continue;
    p.rect(lx, top, d === 1 ? 1 : 0.75, bot - top + 2, postC);
  }
  // Wires on whole logical rows (thin at d ≥ 2): the top pair, line wires every 3 px, the foot.
  for (const y of [top, top + 2, bot]) p.rect(0, y, p.w, d === 1 ? 1 : 0.5, wire);
  for (let y = top + 5; y < bot - 1; y += 3) p.rect(0, y, p.w, d === 1 ? 1 : 0.25, wire);

}

/** The bridge parapet of the far carriageway: concrete with a lit coping and a steel railing. */
function parapet(p: Pen, a: number, b: number, top: number, x0: number): void {
  const d = p.d;
  if (b <= a) return;
  const conc = [T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
  p.rect(a, top, b - a, p.h - top, conc[1]);
  p.rect(a, top, b - a, 1, conc[3]);
  if (d > 1) p.rect(a, top + 1, b - a, 0.5, conc[0]);
  // Railing: top rail, a mid rail, balusters every 3 px.
  const rail = [T('steel', 3, d), T('steel', 5, d), T('steel', 6, d)];
  p.rect(a, top - 6, b - a, 1, rail[1]);
  if (d > 1) p.rect(a, top - 6, b - a, 0.25, rail[2]);
  p.rect(a, top - 3, b - a, d === 1 ? 1 : 0.5, rail[0]);
  for (let g = Math.ceil((x0 + a) / 3) * 3; g < x0 + b; g += 3) p.rect(g - x0, top - 6, d === 1 ? 1 : 0.5, 6, rail[0]);
  // Expansion seams in the concrete.
  for (let g = Math.ceil((x0 + a) / 48) * 48; g < x0 + b; g += 48) p.rect(g - x0, top + 1, d === 1 ? 1 : 0.5, p.h - top, conc[0]);
}

/** The approach of a tunnel: a retaining wall rising toward the portal (span end). */
function cutWall(p: Pen, a: number, b: number, Y: (sy: number) => number, x0: number): void {
  const d = p.d;
  const conc = [T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
  const grassC = [T('green', 3, d), T('green', 4, d)];
  const lo = Y(92);
  const hi = Y(58);
  for (let X = Math.max(0, Math.floor(a * d)); X < Math.min(p.W, Math.ceil(b * d)); X++) {
    const lx = (X + 0.5) / d;
    const t = (lx - a) / Math.max(1, b - a);
    const top = lo + (hi - lo) * Math.min(1, t * 1.1);
    const T0 = Math.round(top * d);
    const gx = x0 + lx;
    const joint = ((gx % 16) + 16) % 16;
    for (let Yy = Math.max(0, T0 - 3 * d); Yy < p.H; Yy++) {
      if (Yy < T0) {
        p.dot(X, Yy, grassC[Yy < T0 - 2 * d ? 1 : 0]);
        continue;
      }
      const dy = (Yy - T0) / d;
      let k = dy < 1 ? 4 : dy < 1.5 ? 1 : 2;
      if (joint < (d === 1 ? 1 : 0.5) && dy > 1.5) k = 0;
      else if (joint < 1 && d > 1 && dy > 1.5) k = 3;
      else if (d > 1 && dy > 2 && h2(Math.floor(gx), Math.floor(dy), 77) > 0.93) k = 1;
      p.dot(X, Yy, conc[k]);
    }
  }
}

/** A white-on-blue direction sign on two legs: RING A10 with the S-shield, or an exit sign. */
function roadSign(p: Pen, s: SignSpec, Y: (sy: number) => number): void {
  const d = p.d;
  const blue = [T('navy', 3, d), T('navy', 4, d), T('navy', 5, d)];
  const white = T('snow', 6, d);
  const ink = T('ink', 0, d);
  if (s.kind === 'name') {
    // A bridge name plate on two thin posts: white letters on blue.
    const name = s.name.toUpperCase();
    const w = tinyWidth(name) + 6;
    const x = Math.round(s.x - w / 2);
    const top = Y(80);
    for (const lx of [x + 2, x + w - 3]) p.rect(lx, top + 9, 1, Y(100) - top - 9, T('steel', 4, d));
    p.rect(x, top, w, 9, white);
    p.rect(x + 1, top + 1, w - 2, 7, blue[1]);
    if (d > 1) p.rect(x + 1, top + 1, w - 2, 0.5, blue[2]);
    tinyText(p, name, x + 3, top + 2, white);
    edgeC(p, x, top, w, 9);
    return;
  }
  const code = s.code.replace(/^S\s*/, 'S');
  const shieldW = tinyWidth(code) + 4;
  const exit = s.kind === 'exit';
  const name = s.name.toUpperCase();
  const line1 = exit ? shieldW + 10 : shieldW + 4 + tinyWidth('RING A10');
  const w = Math.max(line1, exit ? tinyWidth(name) : 0) + 8;
  const hgt = exit ? 23 : 15;
  const bottom = Y(72);
  const top = bottom - hgt;
  const x = Math.round(s.x - w / 2);
  // Legs.
  const leg = [T('steel', 3, d), T('steel', 5, d)];
  for (const lx of [x + 5, x + w - 7]) {
    p.rect(lx, bottom, 2, Y(100) - bottom, leg[0]);
    p.rect(lx, bottom, 0.5, Y(100) - bottom, leg[1]);
  }
  // The panel: blue with a white rim; a sheen at the upper left (dense only).
  p.rect(x, top, w, hgt, blue[1]);
  if (d > 1) {
    p.fill(x, top, w, hgt, (X, Yy) => {
      const u = ((X + 0.5) / d - x) / w;
      const v = ((Yy + 0.5) / d - top) / hgt;
      return dq(1.15 - u * 0.6 - v * 0.5, X, Yy, 0.5) >= 1 ? blue[2] : 0;
    });
  }
  const rim = d === 1 ? 1 : 0.75;
  p.rect(x + 1, top + 1, w - 2, rim, white);
  p.rect(x + 1, top + hgt - 1 - rim, w - 2, rim, white);
  p.rect(x + 1, top + 1, rim, hgt - 2, white);
  p.rect(x + w - 1 - rim, top + 1, rim, hgt - 2, white);
  // The S-shield: white, a thick black border, the number in black.
  const sx = x + 4;
  const sy = top + 3;
  p.rect(sx, sy, shieldW, 9, ink);
  p.rect(sx + 1, sy + 1, shieldW - 2, 7, white);
  if (d > 1) {
    p.rect(sx + 0.5, sy + 0.5, shieldW - 1, 0.5, ink);
    p.rect(sx + 0.5, sy + 8, shieldW - 1, 0.5, ink);
  }
  tinyText(p, code, sx + 2, sy + 2, ink);
  if (exit) {
    // An arrow up and right (leave here), and the place name under it.
    const ax = sx + shieldW + 3;
    const ay = sy + 1;
    p.line(ax, ay + 6, ax + 6, ay, white, d === 1 ? 1 : d >> 1);
    p.rect(ax + 3, ay, 4, 1, white);
    p.rect(ax + 6, ay, 1, 4, white);
    tinyText(p, name, x + Math.round((w - tinyWidth(name)) / 2), top + 15, white);
  } else {
    tinyText(p, 'RING A10', sx + shieldW + 4, sy + 2, white);
  }
  edgeC(p, x, top, w, hgt);
}

// =============================================================================================
// ring-farroad (screen y 64 … 108)
// =============================================================================================

const FAR_TOP = 64;

const farroad: Gen = (w, h, p, _seed, d) => {
  const pen = new Pen(w, h, d);
  const kind = str(p, 'kind', 'road');
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  const Y = (sy: number): number => sy - FAR_TOP;
  const air = 0.06;
  if (kind === 'rail') {
    // Ballast, two tracks with sleepers, catenary masts and the wires.
    const ballast = [haze(T('stone', 2, d), air, d), haze(T('stone', 3, d), air, d), haze(T('brown', 3, d), air, d), haze(T('stone', 4, d), air, d)];
    for (let Yy = Math.round(Y(96) * d); Yy < pen.H; Yy++) {
      for (let X = 0; X < pen.W; X++) {
        const v = h2(Math.floor(x0 * d) + X, Yy, rs);
        pen.dot(X, Yy, ballast[d === 1 ? (v < 0.15 ? 3 : 1) : v < 0.1 ? 3 : v < 0.3 ? 2 : v < 0.65 ? 1 : 0]);
      }
    }
    const rail = [T('steel', 4, d), T('steel', 6, d)];
    const sleeper = T('brown', 2, d);
    for (const ry of [Y(99), Y(104)]) {
      if (d > 1) for (let g = Math.ceil(x0 / 1.5) * 1.5; g < x0 + w; g += 1.5) pen.rect(g - x0, ry - 0.5, 0.75, 2.5, sleeper);
      pen.rect(0, ry, w, d === 1 ? 1 : 0.5, rail[1]);
      pen.rect(0, ry + 1.25, w, d === 1 ? 1 : 0.5, rail[0]);
    }
    const mast = [T('steel', 2, d), T('steel', 3, d), T('steel', 5, d)];
    for (let g = Math.floor(x0 / 64) * 64 - 64; g < x0 + w + 64; g += 64) {
      const lx = g - x0 + 20;
      pen.rect(lx, Y(66), 1.5, Y(98) - Y(66), mast[1]);
      pen.rect(lx, Y(66), 0.5, Y(98) - Y(66), mast[2]);
      pen.rect(lx - 6, Y(69), 7.5, d === 1 ? 1 : 0.75, mast[1]);
      pen.line(lx, Y(74), lx - 5, Y(69.5), mast[0]);
    }
    const wire = T('ink', 1, d);
    pen.rect(0, Y(70), w, d === 1 ? 1 : 0.25, wire);
    pen.rect(0, Y(74), w, d === 1 ? 1 : 0.25, wire);
    if (d > 1) for (let g = Math.ceil(x0 / 8) * 8; g < x0 + w; g += 8) pen.rect(g - x0, Y(70), 0.25, 4, wire);
    return pen.finish();
  }
  // The oncoming carriageway: its outer guard rail, the asphalt, an edge line and lane dashes.
  const asph = [haze(T('steel', 1, d), air, d), haze(T('steel', 2, d), air, d), haze(T('steel', 3, d), air, d)];
  for (let Yy = Math.round(Y(97) * d); Yy < pen.H; Yy++) {
    for (let X = 0; X < pen.W; X++) {
      const v = d === 1 ? 0.5 : h2(Math.floor(x0 * d) + X, Yy, rs);
      pen.dot(X, Yy, asph[v < 0.06 ? 2 : v > 0.95 ? 0 : 1]);
    }
  }
  const line = haze(T('snow', 5, d), air, d);
  pen.rect(0, Y(98), w, d === 1 ? 1 : 0.5, line);
  for (let g = Math.floor(x0 / 72) * 72; g < x0 + w; g += 72) pen.rect(g - x0, Y(102), 24, d === 1 ? 1 : 0.75, line);
  const rail = [T('steel', 3, d), T('steel', 4, d), T('steel', 6, d)];
  for (let g = Math.floor(x0 / 20) * 20; g < x0 + w + 20; g += 20) pen.rect(g - x0, Y(94), 1, 4, rail[0]);
  pen.rect(0, Y(94), w, 2, rail[1]);
  pen.rect(0, Y(94), w, d === 1 ? 1 : 0.5, rail[2]);
  return pen.finish();
};

// =============================================================================================
// ring-tunnel (screen y 0 … 113)
// =============================================================================================

/** The LED band: lit segments of 48 px centred on every 64 px (light.ts LAMP_STEP). */
const LAMP_STEP = 64;

const tunnel: Gen = (w, h, p, _seed, d) => {
  const out = new Pen(w, h, d);
  const list = spans(p, 'spans', 3);
  if (list.length === 0) return out.finish();
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  const needT = list.some((s) => s[2] === 0);
  const needC = list.some((s) => s[2] !== 0);
  const inner = needT ? tunnelInterior(w, h, d, x0, rs) : null;
  const cover = needC ? coveredInterior(w, h, d, x0) : null;
  for (const [a, b, c] of list) {
    const src = c ? cover : inner;
    if (!src) continue;
    const X0 = Math.max(0, Math.round(a * d));
    const X1 = Math.min(out.W, Math.round(b * d));
    for (let Yy = 0; Yy < out.H; Yy++) {
      const row = Yy * out.W;
      for (let X = X0; X < X1; X++) {
        const v = src.px[row + X];
        if (v !== 0) out.px[row + X] = v;
      }
    }
  }
  return out.finish();
};

function tunnelInterior(w: number, h: number, d: Dn, x0: number, rs: number): Pen {
  const p = new Pen(w, h, d);
  const conc = [T('stone', 1, d), T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
  // Ceiling: dark concrete, lighter toward the light band; transverse joints every 32 px.
  for (let Yy = 0; Yy < 30 * d; Yy++) {
    const y = (Yy + 0.5) / d;
    for (let X = 0; X < p.W; X++) {
      const gx = x0 + (X + 0.5) / d;
      const j = ((gx % 32) + 32) % 32;
      let v = 0.6 + (y / 30) * 1.6;
      if (j < (d === 1 ? 1 : 0.5)) v = 0;
      else if (d > 1 && j < 1) v += 1;
      const k = d === 1 ? Math.round(v) : dq(v, X, Yy, 0.6);
      p.dot(X, Yy, conc[Math.max(0, Math.min(3, k))]);
    }
  }
  // Jet fans every 192 px: hangers, a lit cylinder with dark grilles at both ends.
  const fan = [T('steel', 2, d), T('steel', 3, d), T('steel', 4, d), T('steel', 5, d), T('steel', 6, d)];
  for (let g = Math.floor(x0 / 192) * 192 - 192 + 96; g < x0 + w + 192; g += 192) {
    const lx = g - x0;
    for (const hx of [lx - 9, lx + 8]) p.rect(hx, 0, d === 1 ? 1 : 0.5, 12, fan[1]);
    p.fill(lx - 15, 12, 30, 10, (_X, Yy) => {
      const v = ((Yy + 0.5) / d - 12) / 10;
      return fan[v < 0.15 ? 4 : v < 0.4 ? 3 : v < 0.75 ? 2 : 1];
    });
    for (const ex of [lx - 15, lx + 13]) {
      p.rect(ex, 12, 2, 10, fan[0]);
      if (d > 1) for (let gy = 13; gy < 21; gy += 1.5) p.rect(ex + 0.25, gy, 1.5, 0.5, fan[2]);
    }
    p.rect(lx - 15, 21.5, 30, 0.5, T('ink', 1, d));
  }
  // The LED band: a dark housing, lit segments.
  const house = T('steel', 1, d);
  const led = [T('snow', 5, d), T('snow', 6, d), PAL_HD.snow[6]];
  p.rect(0, 30, w, 5, house);
  for (let g = Math.floor(x0 / LAMP_STEP) * LAMP_STEP - LAMP_STEP; g < x0 + w + LAMP_STEP; g += LAMP_STEP) {
    const lx = g - x0;
    p.rect(lx - 24, 31.5, 48, 2, led[0]);
    p.rect(lx - 23, 32, 46, 1, led[1]);
  }
  // Upper wall: light panels 32 px wide, lighter toward the band.
  const pan = [T('gable', 3, d), T('gable', 4, d), T('gable', 5, d), T('gable', 6, d)];
  for (let Yy = 35 * d; Yy < 72 * d; Yy++) {
    const y = (Yy + 0.5) / d;
    for (let X = 0; X < p.W; X++) {
      const gx = x0 + (X + 0.5) / d;
      const j = ((gx % 32) + 32) % 32;
      let v = 2.6 - (y - 35) / 30;
      if (j < (d === 1 ? 1 : 0.5)) v = 0;
      else if (d > 1 && j < 1) v = 3;
      if (d > 1 && h2(Math.floor(gx * 2), Yy >> 2, rs) > 0.985) v -= 1;
      const k = d === 1 ? Math.round(v) : dq(v, X, Yy, 0.22);
      p.dot(X, Yy, pan[Math.max(0, Math.min(3, k))]);
    }
  }
  // A blue band with reflectors every 16 px.
  p.rect(0, 72, w, 4, T('navy', 4, d));
  p.rect(0, 72, w, d === 1 ? 1 : 0.5, T('navy', 5, d));
  for (let g = Math.floor(x0 / 16) * 16; g < x0 + w + 16; g += 16) p.rect(g - x0, 73.5, 1, 1, T('snow', 6, d));
  // Lower wall: grey panels with grime toward the foot.
  for (let Yy = 76 * d; Yy < 96 * d; Yy++) {
    const y = (Yy + 0.5) / d;
    for (let X = 0; X < p.W; X++) {
      const gx = x0 + (X + 0.5) / d;
      const j = ((gx % 32) + 32) % 32;
      let v = 3.2 - (y - 76) / 14;
      if (j < (d === 1 ? 1 : 0.5)) v = 1;
      const k = d === 1 ? Math.round(v) : dq(v, X, Yy, 0.3);
      p.dot(X, Yy, conc[Math.max(1, Math.min(4, k))]);
    }
  }
  // Escape doors every 256 px (green, a lit pictogram sign above) and phone posts between them.
  for (let g = Math.floor(x0 / 256) * 256 - 256; g < x0 + w + 256; g += 256) {
    escapeDoor(p, g - x0 + 128);
    phonePost(p, g - x0);
  }
  // The concrete barrier at the wall foot.
  p.rect(0, 96, w, 8, conc[3]);
  p.rect(0, 96, w, 1, conc[5]);
  p.rect(0, 97, w, 3, conc[4]);
  p.rect(0, 103, w, 1, conc[1]);
  return p;
}

/** A green escape door with its frame and the lit running-man sign above. */
function escapeDoor(p: Pen, cx: number): void {
  const d = p.d;
  const g = [T('green', 2, d), T('green', 3, d), T('green', 4, d), T('green', 5, d), T('green', 7, d)];
  const white = PAL_HD.snow[6];
  const wht = d === 1 ? T('snow', 6, 1) : white;
  // Glow round the frame (emissive green).
  p.rect(cx - 9, 75, 18, 21, g[3]);
  p.rect(cx - 8, 76, 16, 20, g[0]);
  p.rect(cx - 7, 77, 14, 19, g[2]);
  p.rect(cx - 7, 77, 1, 19, g[3]);
  p.rect(cx + 6, 77, 1, 19, g[1]);
  // Handle bar.
  p.rect(cx - 5, 86, 10, 1, T('steel', 5, d));
  // The sign: a lit green box with the running man and an arrow toward the door.
  p.rect(cx - 9, 64, 18, 8, g[4]);
  p.rect(cx - 8, 65, 16, 6, g[3]);
  pictoRunner(p, cx - 6, 65, wht);
  p.rect(cx + 2, 67.5, 4, 1, wht);
  p.rect(cx + 4, 66.5, 1, 3, wht);
  p.rect(cx + 5, 67, 1, 2, wht);
  edgeC(p, cx - 9, 64, 18, 8);
  edgeC(p, cx - 9, 75, 18, 21);
}

/** The running man (5 × 6 px at 1×). */
function pictoRunner(p: Pen, x: number, y: number, c: Color): void {
  const px: Array<[number, number]> = [
    [3, 0],
    [2, 1],
    [3, 1],
    [1, 2],
    [2, 2],
    [4, 2],
    [2, 3],
    [1, 4],
    [3, 4],
    [0, 5],
    [4, 5],
  ];
  for (const [a, b] of px) p.rect(x + a, y + b, 1, 1, c);
}

/** An emergency phone post: a white cabinet with an orange sign and a phone pictogram. */
function phonePost(p: Pen, cx: number): void {
  const d = p.d;
  const cab = [T('gable', 3, d), T('gable', 5, d), T('gable', 6, d)];
  const org = [T('orange', 2, d), T('orange', 4, d), T('orange', 5, d)];
  const ink = T('ink', 1, d);
  p.rect(cx - 5, 80, 10, 16, cab[1]);
  p.rect(cx - 5, 80, 1, 16, cab[2]);
  p.rect(cx + 4, 80, 1, 16, cab[0]);
  p.rect(cx - 4, 84, 8, 1, cab[0]);
  // Orange sign with the phone (handset) pictogram.
  p.rect(cx - 5, 70, 10, 8, org[1]);
  p.rect(cx - 5, 70, 10, d === 1 ? 1 : 0.5, org[2]);
  const wh = T('snow', 6, d);
  p.rect(cx - 3, 72, 6, 1, wh);
  p.rect(cx - 3, 73, 1, 2, wh);
  p.rect(cx + 2, 73, 1, 2, wh);
  p.rect(cx - 1, 74, 2, 2, wh);
  tinyText(p, 'SOS', cx - 5.5 + (10 - tinyWidth('SOS')) / 2, 87, T('red', 4, d));
  p.rect(cx - 2, 93, 4, 1, ink);
  edgeC(p, cx - 5, 80, 10, 16);
  edgeC(p, cx - 5, 70, 10, 8);
}

/** Under a building over the road: the soffit with lamp boxes, columns, deep shade behind. */
function coveredInterior(w: number, h: number, d: Dn, x0: number): Pen {
  const p = new Pen(w, h, d);
  const dark = [T('navy', 0, d), T('navy', 1, d), T('slate', 2, d)];
  p.rect(0, 50, w, 46, dark[1]);
  p.rect(0, 50, w, 8, dark[0]);
  // The far carriageway's rail faintly lit in the shade.
  p.rect(0, 92, w, 1, T('slate', 3, d));
  const conc = [T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d)];
  // The soffit: concrete beams with lamp boxes.
  p.rect(0, 56, w, 10, conc[1]);
  p.rect(0, 64, w, 2, conc[0]);
  for (let g = Math.floor(x0 / 48) * 48 - 48; g < x0 + w + 48; g += 48) {
    p.rect(g - x0 - 4, 66, 8, 1.5, T('snow', 6, d));
    p.rect(g - x0 - 4, 67.5, 8, 0.5, T('gold', 5, d));
  }
  // Columns every 64 px.
  for (let g = Math.floor(x0 / 64) * 64 - 64 + 32; g < x0 + w + 64; g += 64) {
    const lx = g - x0;
    p.rect(lx - 3, 66, 6, 30, conc[2]);
    p.rect(lx - 3, 66, 1.5, 30, conc[3]);
    p.rect(lx + 2, 66, 1, 30, conc[0]);
  }
  p.rect(0, 96, w, 8, conc[2]);
  p.rect(0, 96, w, 1, conc[3]);
  p.rect(0, 103, w, 1, conc[0]);
  return p;
}

// =============================================================================================
// ring-road (screen y 85 … 208)
// =============================================================================================

export const ROAD_LAYER_TOP = 85;

interface HmSpec {
  x: number;
  t: string;
}

function hmOf(p: Params): HmSpec[] {
  const v = p.hm;
  if (!Array.isArray(v)) return [];
  const out: HmSpec[] = [];
  for (const s of v) {
    const o = s as Record<string, unknown>;
    if (o && typeof o.x === 'number' && typeof o.t === 'string') out.push({ x: o.x, t: o.t });
  }
  return out;
}

/**
 * Grain of the asphalt: a 1024 × 512 table of hashed bytes, read at (global art x + a per-row
 * offset, art y), so the road's 400 k px per 4× chunk cost a table read each instead of a hash.
 */
const GRAIN = (() => {
  const t = new Uint8Array(1 << 19);
  for (let i = 0; i < t.length; i++) t[i] = (h2(i & 1023, i >> 10, 0x6a11) * 256) | 0;
  return t;
})();

const baseCache = new Map<string, Uint32Array>();

/** Bytes held by the road's cached base rows and the grain table (counted in the scenery reserve). */
export function roadBaseBytes(): number {
  let n = GRAIN.length;
  for (const b of baseCache.values()) n += b.length * 4;
  return n;
}

/**
 * The open road's base colours at density d for the chunk's rows (from art row Y0): 2048 px per
 * row (two periods of the grain), cached per density. Asphalt with light grain and dark pores,
 * darker wheel tracks (an ordered dither), the hard shoulder and its gravel edge.
 */
function roadBase(d: Dn, rowKind: Uint8Array, Y0: number): Uint32Array {
  const key = `${d}:${Y0}:${rowKind.length}`;
  const have = baseCache.get(key);
  if (have) return have;
  const asph = [T('steel', 1, d), T('steel', 2, d), T('steel', 3, d)];
  const shoulder = [T('steel', 2, d), T('steel', 3, d), T('stone', 3, d), T('steel', 4, d)];
  const olive2 = T('olive', 2, d);
  const stone2 = T('stone', 2, d);
  const lightP = (d === 4 ? 0.045 : d === 2 ? 0.022 : 0.012) * 256;
  const darkP = (d === 4 ? 0.94 : d === 2 ? 0.965 : 2) * 256;
  const out = new Uint32Array(rowKind.length * 2048);
  for (let r = 0; r < rowKind.length; r++) {
    const Yy = Y0 + r;
    const k = rowKind[r];
    const g0 = (Yy & 511) << 10;
    for (let x = 0; x < 2048; x++) {
      const g = GRAIN[g0 | (x & 1023)];
      let c: Color;
      if (k === 12) c = g < 128 ? olive2 : stone2;
      else if (k === 11) c = shoulder[d === 1 ? (g < 10 ? 3 : 1) : g < 26 ? 3 : g < 56 ? 2 : g > 238 ? 0 : 1];
      else {
        let a = g < lightP ? 2 : g > darkP ? 0 : 1;
        if (d > 1 && k === 1 && a === 1 && bay(x, Yy) < 0.22) a = 0;
        c = asph[a];
      }
      out[r * 2048 + x] = c >>> 0;
    }
  }
  baseCache.set(key, out);
  return out;
}

const SPLITS = [134, 156, 178];
const FEET = [124, 145, 167, 190];

const road: Gen = (w, h, p, seed, d) => {
  const pen = new Pen(w, h, d);
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  // [a, b, covered]: a tube closes the near lane (the walkway); a covered stretch keeps 4 lanes
  // and its median rail (the building's columns stand behind it).
  const covers = spans(p, 'tunnel', 3);
  const tun = covers.filter((t) => t[2] === 0);
  const bridge = spans(p, 'bridge');
  const exit = spans(p, 'exit');
  const Y = (sy: number): number => sy - ROAD_LAYER_TOP;
  const asph = [T('steel', 1, d), T('steel', 2, d), T('steel', 3, d), T('steel', 4, d)];
  const white = [T('snow', 4, d), T('snow', 5, d), T('snow', 6, d)];
  const X0w = Math.floor(x0 * d);
  // Asphalt: speckled aggregate, wheel tracks, the lane dashes and the edge lines. Rows are
  // classified once, columns once; the inner loop only reads tables (a 4× chunk is 400 k px).
  const W = pen.W;
  const Y0 = Math.round(Y(113) * d);
  const Y1 = Math.round(Y(208) * d);
  const colTun = new Uint8Array(W);
  const colBridge = new Uint8Array(W);
  const colExit = new Uint8Array(W);
  const colDash = new Uint8Array(W);
  const colBlock = new Uint8Array(W);
  for (let X = 0; X < W; X++) {
    const lx = (X + 0.5) / d;
    const gx = x0 + lx;
    colTun[X] = inSpans(lx, tun) ? 1 : 0;
    colBridge[X] = inSpans(lx, bridge) ? 1 : 0;
    colExit[X] = inSpans(lx, exit) ? 1 : 0;
    colDash[X] = ((gx % 96) + 96) % 96 < 32 ? 1 : 0;
    colBlock[X] = ((gx % 24) + 24) % 24 < 8 ? 1 : 0;
  }
  // Row kinds: 0 asphalt, 1 wheel track, 2 far edge line, 3/4/5 lane split 1|2, 2|3, 3|4 (top art
  // row 6/7/8 at 4×), 9 near edge line, 10 the line under it (exit block marks), 11 shoulder,
  // 12 gravel, 13 tunnel near edge (y 177).
  const rows = Y1 - Y0;
  const rowKind = new Uint8Array(rows);
  for (let r = 0; r < rows; r++) {
    const sy = (Y0 + r + 0.5) / d + ROAD_LAYER_TOP;
    let k = 0;
    if (sy >= 206.5) k = 12;
    else if (sy >= 200) k = 11;
    else if (sy >= 113 && sy < 114) k = 2;
    else if (sy >= 199) k = 9;
    else if (sy >= 177 && sy < 178) k = 13;
    else {
      for (let si = 0; si < 3; si++) if (sy >= SPLITS[si] && sy < SPLITS[si] + 1) k = d === 4 && sy < SPLITS[si] + 0.25 ? 6 + si : 3 + si;
      if (k === 0) for (const fy of FEET) if ((sy - fy > -1.2 && sy - fy < 0.6) || (sy - fy > -8 && sy - fy < -6.2)) k = 1;
    }
    rowKind[r] = k;
  }
  // The open road's colours per row come from a cached base (asphalt grain, wheel tracks, the
  // shoulder and gravel) two grain periods wide: each chunk row is one copy from it. The
  // markings and the tunnel / bridge / exit changes are written over it afterwards.
  const base = roadBase(d, rowKind, Y0);
  const px = pen.px;
  const stone2 = T('stone', 2, d);
  for (let r = 0; r < rows; r++) {
    const Yy = Y0 + r;
    const k = rowKind[r];
    const row = Yy * W;
    const s0 = (X0w + ((h2(Yy, 3, rs) * 1024) | 0)) & 1023;
    px.set(base.subarray(r * 2048 + s0, r * 2048 + s0 + W), row);
    if (k === 0 || k === 1 || k === 11 || k === 12) {
      if (k >= 11 || d > 1) {
        for (let X = 0; X < W; X++) {
          if (colTun[X] === 1 && k >= 11) px[row + X] = stone2 >>> 0;
          else if (d > 1 && colBridge[X] === 1 && k <= 1) {
            const g = GRAIN[((Yy & 511) << 10) | ((s0 + X) & 1023)];
            if (g > 204 && g < 220) px[row + X] = asph[2] >>> 0;
          }
        }
      }
      continue;
    }
    for (let X = 0; X < W; X++) {
      const inT = colTun[X] === 1;
      let c = 0;
      if (k === 2) c = white[1];
      else if (k === 9) {
        if (!inT && (colExit[X] === 0 || colBlock[X] === 1)) c = white[1];
      } else if (k === 13) {
        if (inT) c = white[1];
      } else if (k >= 3 && k <= 8) {
        const si = (k - 3) % 3;
        if (colDash[X] === 1 && !(inT && si === 2)) {
          const g = GRAIN[((Yy & 511) << 10) | ((s0 + X) & 1023)];
          c = k >= 6 ? white[2] : d > 1 && g > 235 ? asph[2] : white[1];
        }
      }
      if (c !== 0) px[row + X] = c >>> 0;
    }
  }
  // The exit's block marks are two px thick: the row under the near edge line.
  if (exit.length) {
    for (let r = 0; r < rows; r++) {
      const sy = (Y0 + r + 0.5) / d + ROAD_LAYER_TOP;
      if (sy < 198 || sy >= 199) continue;
      for (let X = 0; X < W; X++) if (colExit[X] === 1 && colTun[X] === 0 && colBlock[X] === 1) px[(Y0 + r) * W + X] = white[1] >>> 0;
    }
  }
  // Patches (newer asphalt with a sealed edge) and cracks: per chunk.
  const np = Math.floor(h2(1, 2, seed) * 3);
  for (let k = 0; k < np; k++) {
    const lane = Math.floor(h2(k, 3, seed) * 4);
    const pw = 26 + h2(k, 4, seed) * 60;
    const px0 = 6 + h2(k, 5, seed) * (w - pw - 12);
    const top = (lane === 0 ? 114 : SPLITS[lane - 1] + 2) + h2(k, 6, seed) * 4;
    const ph = 6 + h2(k, 7, seed) * 8;
    if (inSpans(px0, tun) || inSpans(px0 + pw, tun)) continue;
    // 2× / 4×: a light dither toward the darker tone that keeps the aggregate, and a seam in the
    // darkest asphalt tone (an ink seam read as a hole or a shadow at 4K; integrator 2026-10-20).
    pen.tint(px0, Y(top), pw, ph, (X, Yy, old) => (old === white[1] || old === white[2] ? old : d > 1 ? (bay(X, Yy) < 0.55 ? asph[1] : old) : asph[0]));
    if (d > 1) {
      const seal = asph[0];
      pen.rect(px0, Y(top), pw, 0.5, seal);
      pen.rect(px0, Y(top + ph) - 0.5, pw, 0.5, seal);
      pen.rect(px0, Y(top), 0.5, ph, seal);
      pen.rect(px0 + pw - 0.5, Y(top), 0.5, ph, seal);
    }
  }
  if (d > 1) {
    const crack = T('steel', 0, d);
    const nc = 2 + Math.floor(h2(2, 2, seed) * 3);
    for (let k = 0; k < nc; k++) {
      let cx = 8 + h2(k, 13, seed) * (w - 16);
      let cy = 115 + h2(k, 14, seed) * 82;
      const len = 8 + h2(k, 15, seed) * 18;
      for (let s = 0; s < len; s += 1 / d) {
        cx += 1 / d;
        cy += (h2(k, Math.floor(s * 4), seed) - 0.5) * 0.6;
        if (cy > 113 && cy < 200) pen.rect(cx, Y(cy), 1 / d, 1 / d, crack);
      }
    }
    // Oil drips in the lane middles.
    for (let k = 0; k < 3; k++) {
      if (h2(k, 20, seed) < 0.5) continue;
      const lane = Math.floor(h2(k, 21, seed) * 4);
      const ox = 10 + h2(k, 22, seed) * (w - 20);
      pen.disc(ox, Y(FEET[lane] - 3.5), 3 + h2(k, 23, seed) * 3, 1, (X, Yy) => (bay(X, Yy) < 0.6 ? asph[0] : 0));
    }
  }
  // The median: a steel guard rail on a concrete plinth (a concrete barrier on bridges; the
  // tunnel kerb under the wall).
  const conc = [T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
  const steel = [T('steel', 2, d), T('steel', 3, d), T('steel', 4, d), T('steel', 5, d), T('steel', 6, d)];
  for (let X = 0; X < pen.W; X++) {
    const lx = (X + 0.5) / d;
    const gx = x0 + lx;
    const inTun = inSpans(lx, tun);
    const onBridge = inSpans(lx, bridge);
    for (let Yy = Math.round(Y(103) * d); Yy < Math.round(Y(113) * d); Yy++) {
      const sy = (Yy + 0.5) / d + ROAD_LAYER_TOP;
      let c: Color = 0;
      if (inTun) {
        if (sy >= 104) c = sy < 105 ? conc[4] : sy < 112 ? conc[1] : conc[0];
      } else if (onBridge) {
        if (sy >= 104) c = sy < 105 ? conc[4] : sy < 108 ? conc[3] : sy < 111 ? conc[2] : conc[1];
        if (sy >= 105 && ((gx % 48) + 48) % 48 < (d === 1 ? 1 : 0.5)) c = conc[0];
      } else {
        // Plinth.
        if (sy >= 109) c = sy < 110 ? conc[3] : sy < 112 ? conc[2] : conc[1];
        // Posts every 24 px.
        const j = ((gx % 24) + 24) % 24;
        if (sy >= 103.5 && sy < 109 && j < 1.5) c = j < 0.5 ? steel[2] : steel[0];
        // The W-beam: lit top bulge, a groove, a shaded bottom bulge.
        if (sy >= 104 && sy < 108) {
          const v = sy - 104;
          c = v < 0.5 ? steel[4] : v < 1.5 ? steel[3] : v < 2.2 ? steel[1] : v < 3.2 ? steel[2] : steel[1];
          if (d >= 4 && v >= 0.5 && v < 0.75 && h2(Math.floor(gx / 3), 1, rs) > 0.3) c = PAL_HD.snow[6];
          if (d >= 4 && j > 22.6 && j < 23.4 && (Math.abs(v - 1.2) < 0.3 || Math.abs(v - 2.8) < 0.3)) c = PAL_HD.ink[1];
        }
      }
      if (c !== 0) pen.dot(X, Yy, c);
    }
  }
  // Expansion joints at both ends of a bridge: steel combs across the road.
  for (const [a, b] of bridge) {
    for (const jx of [a, b - 3]) {
      if (jx < -3 || jx > w) continue;
      pen.rect(jx, Y(113), 3, 95, steel[1]);
      if (d > 1) for (let y = 113; y < 208; y += 1) pen.rect(jx + (y % 2 === 0 ? 0.5 : 1.5), Y(y), 1, 0.5, steel[3]);
      pen.rect(jx, Y(113), 0.5, 95, steel[3]);
    }
  }
  // Tunnels: the near lane becomes the raised walkway (a kerb face, light concrete tiles).
  for (const [a, b] of tun) {
    const A = Math.max(0, a);
    const B = Math.min(w, b);
    if (B <= A) continue;
    pen.rect(A, Y(178), B - A, 4, conc[2]);
    pen.rect(A, Y(178), B - A, 1, conc[4]);
    pen.fill(A, Y(182), B - A, 18, (X, Yy) => {
      const gx = x0 + (X + 0.5) / d;
      const j = ((gx % 16) + 16) % 16;
      if (j < (d === 1 ? 1 : 0.5)) return conc[1];
      return d > 1 && h2(X0w + X, Yy, rs) < 0.06 ? conc[2] : conc[3];
    });
    pen.rect(A, Y(182), B - A, d === 1 ? 1 : 0.5, conc[0]);
    pen.rect(A, Y(198), B - A, 10, conc[1]);
  }
  // The exit gore: white chevrons on the shoulder at its start.
  for (const [a] of exit) {
    for (let k = 0; k < 6; k++) {
      const cx = a + 8 + k * 10;
      if (cx < -8 || cx > w + 8) continue;
      pen.line(cx, Y(206), cx + 6, Y(200.5), white[1], d === 1 ? 1 : d >> 1);
    }
  }
  // Hectometre boards on the median: green plates with a white rim, A10 and the km; 'RE' at d ≥ 2.
  for (const b of hmOf(p)) hmBoard(pen, b.x, Y(86), b.t);
  return pen.finish();
};

/** A hectometre board (16 × 15 at 1×) at centre x, top y, on its post. */
function hmBoard(p: Pen, cx: number, top: number, t: string): void {
  const d = p.d;
  const w = Math.max(16, tinyWidth(t) + 4);
  const x = Math.round(cx - w / 2);
  const green = [T('green', 1, d), T('green', 2, d), T('green', 3, d)];
  const white = T('snow', 6, d);
  p.rect(cx - 0.5, top + 15, 1.5, 3, T('steel', 3, d));
  p.rect(x, top, w, 15, white);
  p.rect(x + 1, top + 1, w - 2, 13, green[1]);
  if (d > 1) p.rect(x + 1, top + 1, w - 2, 0.5, green[2]);
  tinyText(p, 'A10', x + 2, top + 2, white);
  if (d > 1) tinyText(p, 'RE', x + w - 4.5, top + 2.5, white, { scale: 0.5 });
  tinyText(p, t, x + Math.round((w - tinyWidth(t)) / 2), top + 8, white);
  edgeC(p, x, top, w, 15);
}

// =============================================================================================
// ring-front (screen y 194 … 216)
// =============================================================================================

const FRONT_TOP = 194;

const front: Gen = (w, h, p, _seed, d) => {
  const pen = new Pen(w, h, d);
  const x0 = num(p, 'x0', 0);
  const rs = num(p, 'rs', 0);
  const tun = spans(p, 'tunnel');
  const bridge = spans(p, 'bridge');
  const exit = spans(p, 'exit');
  const Y = (sy: number): number => sy - FRONT_TOP;
  const steel = [T('steel', 1, d), T('steel', 2, d), T('steel', 3, d), T('steel', 4, d), T('steel', 5, d), T('steel', 6, d)];
  const conc = [T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
  const grass = [T('olive', 1, d), T('olive', 2, d), T('green', 2, d), T('olive', 3, d)];
  const X0w = Math.floor(x0 * d);
  for (let X = 0; X < pen.W; X++) {
    const lx = (X + 0.5) / d;
    const gx = x0 + lx;
    const inTun = inSpans(lx, tun);
    const onBridge = inSpans(lx, bridge);
    const ex = exit.find((s) => lx >= s[0] && lx < s[1]);
    const gap = ex !== undefined && lx >= ex[0] + 18;
    for (let Yy = 0; Yy < pen.H; Yy++) {
      const sy = (Yy + 0.5) / d + FRONT_TOP;
      const hsh = h2(X0w + X, Yy, rs);
      let c: Color = 0;
      if (inTun) {
        // The concrete safety barrier along the near wall: lit cap, a sloped face, a reflective strip.
        if (sy >= 197) {
          c = sy < 198 ? conc[4] : sy < 199.5 ? conc[3] : sy < 208 ? conc[2] : conc[1];
          if (sy >= 203 && sy < 204) c = T('snow', 5, d);
          const j = ((gx % 64) + 64) % 64;
          if (sy >= 198 && j < (d === 1 ? 1 : 0.5)) c = conc[0];
          if (d > 1 && sy > 205 && hsh > 0.9) c = conc[1];
        }
      } else if (onBridge) {
        // The bridge parapet: a concrete wall with a coping and a steel railing on top.
        if (sy >= 204) c = sy < 205.5 ? conc[4] : sy < 206.5 ? conc[1] : conc[2];
        else if (sy >= 196) {
          const j = ((gx % 4) + 4) % 4;
          if (sy < 197.2) c = sy < 196.5 ? steel[5] : steel[4];
          else if (Math.abs(sy - 200.5) < 0.5) c = steel[3];
          else if (j < (d === 1 ? 1 : 0.75)) c = steel[2];
        }
      } else if (gap) {
        // The exit ramp: asphalt toward the camera.
        if (sy >= 208) c = hsh < 0.08 ? steel[3] : steel[2];
      } else {
        // The verge under the rail, the posts, the W-beam.
        if (sy >= 208) c = grass[d === 1 ? 1 : hsh < 0.2 ? 0 : hsh < 0.75 ? 1 : hsh < 0.92 ? 2 : 3];
        const j = ((gx % 24) + 24) % 24;
        if (sy >= 201 && j < 2.2) c = j < 0.6 ? steel[4] : j < 1.6 ? steel[2] : steel[1];
        if (sy >= 202 && sy < 209) {
          const v = sy - 202;
          c = v < 0.6 ? steel[5] : v < 2 ? steel[4] : v < 2.8 ? steel[2] : v < 3.6 ? steel[1] : v < 5 ? steel[3] : v < 6.3 ? steel[2] : steel[1];
          if (d >= 4 && v >= 0.6 && v < 0.85 && h2(Math.floor(gx / 4), 2, rs) > 0.35) c = PAL_HD.snow[6];
          // Bolts at each post, a rail joint every 96 px.
          if (d >= 4 && j > 0.4 && j < 1.6 && (Math.abs(v - 1.3) < 0.35 || Math.abs(v - 4.3) < 0.35)) c = PAL_HD.ink[1];
          if (((gx % 96) + 96) % 96 < (d === 1 ? 1 : 0.5)) c = steel[0];
        }
        // Reflectors on every third post.
        if (sy >= 199.5 && sy < 201.5 && j < 2 && ((Math.floor(gx / 24) % 3) + 3) % 3 === 0) c = sy < 200.5 ? T('snow', 6, d) : T('orange', 4, d);
      }
      if (c !== 0) pen.dot(X, Yy, c);
    }
  }
  // The crash cushion at the gore: yellow and black chevrons.
  for (const [a] of exit) {
    if (a < -16 || a > w + 2) continue;
    pen.fill(a, Y(201), 16, 13, (X, Yy) => {
      const u = (X + 0.5) / d - a;
      const v = (Yy + 0.5) / d - Y(201);
      if (v < 1) return T('gold', 6, d);
      return Math.floor((u + v) / 3) % 2 === 0 ? T('gold', 5, d) : T('ink', 1, d);
    });
    edgeC(pen, a, Y(201), 16, 13);
  }
  return pen.finish();
};

defineRingGen('ring-verge', verge);
defineRingGen('ring-farroad', farroad);
defineRingGen('ring-tunnel', tunnel);
defineRingGen('ring-road', road);
defineRingGen('ring-front', front);

export const VERGE_KINDS = ['trees', 'screens', 'fence', 'reeds', 'plain'] as const;
