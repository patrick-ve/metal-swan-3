/**
 * The shops of oat-a (STREET-A, wave A; docs/design/oat.md §2.1, §6.2, §6.6, §8.2, §8.6 "Doors and
 * ground floors", §8.7 a 4–5): shop fronts drawn at the façade plane (depth 16, s 0.862) in GRAMMAR's
 * blank shop-front slots, so the strips paint the upper storeys and these sprites the ground band, at
 * TRUE scale (20 px/m): doors 46 px, shop glass from 0.4 m to 3.0 m, a fascia with painted letters.
 *
 * - `decor/oat/a/haverbar` DE HAVERBAR (spec §6.2): a coffee window with a counter hatch, a warm
 *   interior, a menu on the glass, a plain awning (the barista and the goods are PIECES' entities);
 * - `decor/oat/a/conceptstore` (spec §6.6): white and minimal, `MINDER` on the glass, an empty lit
 *   plinth (the glass case and the sock are PIECES' entity);
 * - `decor/oat/a/boutique-kaars`, `decor/oat/a/boutique-zeep`: boutiques with three items each, one a
 *   candle at `€ 400` (spec decision 6);
 * - `decor/oat/a/te-koop`: the whole canal house TE KOOP on the Singel (spec §2.1, §4): a wide
 *   18th-century cornice house with a double stoep, in full sun (no opposite row there).
 *
 * The 9 Straatjes' shop fronts lie in the opposite row's cool shade at 09:30 (spec §8.4 a): the
 * fronts use the shaded ladders, the interiors their own warm light. Static (no outline). Names are
 * ours (parody, never a real shop).
 */
import type { Color } from '../../../../../engine/color';
import { bay, h2, ladder, mx, reg, T, text, textW, type Dn, type Pen, type Rn } from './kit';
import { euro, lf, litLad, shadeLad, SKY_CAST, SUN } from './street';

const W = 55;
const H = 74;
/** The shop glass's top (3.0 m over the base) and its sill (0.4 m). */
const GLASS_TOP = H - 60;
const GLASS_SILL = H - 8;
/** The door: 2.3 m (46 px). */
const DOOR_TOP = H - 46;

interface Pui {
  /** The painted wood of the shop front. */
  readonly paint: readonly Color[];
  readonly fasciaBg: readonly Color[];
  readonly fasciaInk: Color;
  readonly name: string;
  /** The door: its x and width, its paint, glass in it. */
  readonly doorX: number;
  readonly doorW: number;
  readonly door: readonly Color[];
  readonly doorGlass: boolean;
}

/** Dark shop glass with the cool sky's reflection in a diagonal band, over an interior colour. */
function glassOver(inner: Color, X: number, Y: number, d: Dn): Color {
  const t = ((X / d) * 0.6 + Y / d) % 22;
  if (d >= 2 && t > 2 && t < 4.5) return mx(inner, mx(T('glass', 5, 2), SKY_CAST, 0.3, 2), 0.35, d);
  return inner;
}

/** The shop front's frame: pilasters, the fascia, the stallriem panel, the door; `inside` paints the window. */
function pui(p: Pen, o: Pui, inside: (X: number, Y: number) => Color): void {
  const d = p.d;
  const x0 = 2.6;
  const x1 = o.doorX - 1.4;
  // The window opening (interior + glass).
  p.fill(x0, GLASS_TOP + 1.6, x1 - x0, GLASS_SILL - GLASS_TOP - 1.6, (X, Y) => glassOver(inside(X, Y), X, Y, d));
  // The frame: pilasters (lit left), the head, the sill, a mullion.
  const pt = o.paint;
  p.rect(0, GLASS_TOP, 2.6, H - GLASS_TOP, lf(pt, 0.62));
  p.rect(0, GLASS_TOP, 0.7, H - GLASS_TOP, lf(pt, 0.9));
  p.rect(2.1, GLASS_TOP, 0.5, H - GLASS_TOP, lf(pt, 0.35));
  p.rect(W - 2.6, GLASS_TOP, 2.6, H - GLASS_TOP, lf(pt, 0.5));
  p.rect(W - 0.7, GLASS_TOP, 0.7, H - GLASS_TOP, lf(pt, 0.25));
  p.rect(x1, GLASS_TOP, o.doorX - x1, H - GLASS_TOP, lf(pt, 0.55));
  p.rect(0, GLASS_TOP, W, 1.6, lf(pt, 0.45));
  p.rect(0, GLASS_TOP + 1.2, W, 0.4, lf(pt, 0.2));
  // The stallriem (panel under the glass) with a raised panel and a worn foot.
  p.rect(0, GLASS_SILL, o.doorX, H - GLASS_SILL, lf(pt, 0.5));
  p.rect(0, GLASS_SILL, o.doorX, 1, lf(pt, 0.88));
  p.rect(x0 + 1.4, GLASS_SILL + 2, x1 - x0 - 2.8, H - GLASS_SILL - 3.6, lf(pt, 0.42));
  if (d >= 2) {
    p.rect(x0 + 1.4, GLASS_SILL + 2, x1 - x0 - 2.8, 1 / d, lf(pt, 0.2));
    p.rect(x0 + 1.4, GLASS_SILL + 2, 1 / d, H - GLASS_SILL - 3.6, lf(pt, 0.2));
  }
  p.rect(0, H - 1, o.doorX, 1, mx(lf(pt, 0.3), T('stone', 2, 2), 0.5, d));
  // The fascia: a cornice moulding on top, the board with its painted name.
  p.rect(0, 0, W, 2.2, lf(pt, 0.72));
  p.rect(0, 0, W, 0.6, lf(pt, 0.95));
  p.rect(0, 1.8, W, 0.6, lf(pt, 0.28));
  p.fill(0, 2.4, W, GLASS_TOP - 2.4, (X) => lf(o.fasciaBg, 0.62 - (X / d / W) * 0.25));
  if (d >= 2) p.rect(0, GLASS_TOP - 0.6, W, 0.6, lf(o.fasciaBg, 0.15));
  const tw = textW(o.name);
  text(p, o.name, Math.round((W - tw) / 2), 5.4, o.fasciaInk);
  // The door: frame, panels or glass, a brass handle and letter slot, the step.
  const dx = o.doorX;
  const dw = o.doorW;
  p.rect(dx, DOOR_TOP - 12, dw, 12, (d >= 2 ? glassOver(mx(T('glass', 1, 2), SKY_CAST, 0.1, 2), 0, 0, d) : T('glass', 1, 1)));
  p.rect(dx, DOOR_TOP - 1, dw, 1, lf(pt, 0.5));
  p.fill(dx, DOOR_TOP, dw, H - DOOR_TOP, (X) => lf(o.door, 0.6 - ((X / d - dx) / dw) * 0.3));
  p.rect(dx, DOOR_TOP, 0.6, H - DOOR_TOP, lf(o.door, 0.9));
  if (o.doorGlass) {
    p.fill(dx + 1.6, DOOR_TOP + 2, dw - 3.2, 22, (X, Y) => glassOver(mx(T('glass', 1, 2), T('wood', 2, 2), 0.3, 2), X, Y, d));
  } else if (d >= 2) {
    p.rect(dx + 1.6, DOOR_TOP + 3, dw - 3.2, 16, lf(o.door, 0.4));
    p.rect(dx + 1.6, DOOR_TOP + 23, dw - 3.2, 18, lf(o.door, 0.4));
  }
  p.rect(dx + dw - 2.2, DOOR_TOP + 24, 0.8, 2.4, T('gold', 4, d));
  if (d >= 4) p.rect(dx + dw - 2.2, DOOR_TOP + 24, 0.3, 2.4, T('gold', 6, d));
  // Grime and a sticker on the frame at hand height (wear, spec §8.10).
  if (d >= 2) {
    p.rect(W - 2.2, 40, 1.4, 2, mx(T('pink', 4, 2), SKY_CAST, 0.3, d));
    p.rect(0.4, H - 4, 2, 3, mx(lf(pt, 0.3), T('brown', 2, 2), 0.4, d));
  }
}

/** A shaded painted-wood ladder (the pui), or a lit one. */
function paint(n: Rn, lo: number, hi: number, d: Dn): readonly Color[] {
  return shadeLad(n, d, lo, hi, 0.14);
}

/** A warm interior: back wall, floor, a ceiling lamp's pool; t = 0 … 1 brightness at (x, y). */
function warm(t: number, d: Dn): Color {
  const l = ladder([T('wood', 1, 2), T('wood', 2, 2), T('wood', 3, 2), mx(T('wood', 4, 2), T('oat.lantern', 2, 2), 0.3, 2), mx(T('sand', 6, 2), T('oat.lantern', 3, 2), 0.4, 2)], 2, d);
  return lf(l, t);
}

// ------------------------------------------------------------------------------------ DE HAVERBAR

function drawHaverbar(p: Pen): void {
  const d = p.d;
  const white = paint('gable', 3, 6, d);
  const green = paint('oat.green', 0, 3, d);
  const cream = mx(T('sand', 6, 2), SKY_CAST, 0.08, d);
  const doorX = 41.5;
  const steel = litLad('steel', d, 2, 7, 0.1);
  pui(
    p,
    { paint: white, fasciaBg: green, fasciaInk: cream, name: 'DE HAVERBAR', doorX, doorW: 11, door: green, doorGlass: true },
    (X, Y) => {
      const x = X / d;
      const y = Y / d;
      // The hatch: an opening in the lower glass (no glass), the counter at its foot.
      const back = 0.35 + Math.max(0, 1 - Math.abs(x - 20) / 18) * 0.35 - (y - 16) * 0.004;
      // Shelves with cups on the back wall.
      if (y > 25 && y < 26 && x > 6 && x < 30) return warm(0.85, d);
      if (y > 21.5 && y < 25 && x > 6 && x < 30 && Math.floor(x / 3) % 2 === 0) return mx(T('snow', 5, 2), T('oat.lantern', 2, 2), 0.25, d);
      // The espresso machine on the back counter.
      if (y > 33 && y < 42 && x > 9 && x < 21) return lf(steel, 0.35 + ((x - 9) / 12 < 0.3 ? 0.4 : 0) + (y < 34.2 ? 0.3 : 0));
      if (y > 42 && y < 44 && x > 5 && x < 36) return warm(0.7, d);
      return warm(back, d);
    },
  );
  // The hatch frame and the counter sill (lit top), a carton and a cup on it.
  p.rect(2.6, 41, 36.5, 1, lf(white, 0.4));
  p.rect(1.8, 55, 38, 1.6, lf(white, 0.95));
  p.rect(1.8, 56.6, 38, 0.8, lf(white, 0.25));
  p.rect(2.6, 42, 36.5, 13, d >= 2 ? T('wood', 1, d) : T('wood', 1, 1));
  p.fill(2.6, 42, 36.5, 13, (X, Y) => warm(0.25 + (Y / d - 42) * 0.03 + (Math.abs(X / d - 20) < 8 ? 0.15 : 0), d));
  // The oat carton (cream with a green band and a little oat ear) and a cup.
  const cx = 28;
  p.rect(cx, 48.6, 4, 6.4, mx(T('sand', 6, 2), SKY_CAST, 0.1, d));
  p.rect(cx, 48.6, 1, 6.4, T('snow', 6, d));
  p.rect(cx, 51, 4, 1.6, T('oat.green', 3, d));
  p.poly(
    [
      [cx, 48.6],
      [cx + 4, 48.6],
      [cx + 2, 47.2],
    ],
    T('sand', 5, d),
  );
  if (d >= 4) p.rect(cx + 1.6, 49.2, 0.5, 1.2, T('gold', 4, d));
  p.rect(10, 52, 2.6, 3, T('snow', 5, d));
  p.rect(10, 52, 2.6, 0.6, T('brown', 2, d));
  // The menu on the glass (top right of the window): a white card with lines.
  p.rect(30, 18, 7, 11, mx(T('snow', 5, 2), SKY_CAST, 0.15, d));
  if (d >= 2) {
    text(p, 'MENU', 30.9, 18.8, T('oat.green', 1, d), 0.5);
    for (let r = 0; r < 4; r++) p.rect(31, 22.2 + r * 1.6, 3.4 + h2(r, 2, 11) * 1.4, 0.5, T('ink', 1, d));
  } else p.rect(31, 21, 5, 1, T('ink', 1, 1));
  // A plain canvas awning over the window: a sloped band, a scalloped valance, shade under it.
  const canvas = shadeLad('sand', d, 4, 7, 0.1);
  p.poly(
    [
      [1.2, GLASS_TOP + 0.6],
      [40, GLASS_TOP + 0.6],
      [41.4, GLASS_TOP + 5],
      [-0.2, GLASS_TOP + 5],
    ],
    (X, Y) => lf(canvas, 0.75 - (Y / d - GLASS_TOP) * 0.06 - (X / d) * 0.004),
  );
  for (let x = 0; x < 41; x += 3.4) p.disc(x + 1.7, GLASS_TOP + 5, 1.7, 1.2, (_X, _Y, _u, v) => (v > 0 ? lf(canvas, 0.35) : 0));
  if (d >= 2) p.rect(2.6, GLASS_TOP + 6.2, 36.5, 1, mx(warm(0.3, d), T('ink', 1, 2), 0.4, d));
}

// ------------------------------------------------------------------------------------ the conceptstore

function drawConceptstore(p: Pen): void {
  const d = p.d;
  const white = paint('gable', 4, 6, d);
  const doorX = 40;
  const room = ladder([mx(T('gable', 3, 2), SKY_CAST, 0.1, 2), T('gable', 4, 2), T('gable', 5, 2), T('gable', 6, 2), T('snow', 6, 2)], 2, d);
  const grey = mx(T('stone', 3, 2), SKY_CAST, 0.1, d);
  pui(
    p,
    { paint: white, fasciaBg: white, fasciaInk: white[0], name: '', doorX, doorW: 13, door: white, doorGlass: true },
    (X, Y) => {
      const x = X / d;
      const y = Y / d;
      // A white room: a spot over the plinth, the floor a step darker.
      const spot = Math.max(0, 1 - Math.hypot((x - 21) / 9, (y - 50) / 16));
      const t = (y > 62 ? 0.4 : 0.6) + spot * 0.22;
      return lf(room, t);
    },
  );
  // The empty plinth (a white block lit from above) and its shadow on the floor.
  p.rect(16, 50, 10, 14, lf(room, 0.62));
  p.rect(16, 50, 10, 1, lf(room, 0.98));
  p.rect(16, 50, 1.2, 14, lf(room, 0.8));
  p.rect(24.8, 50, 1.2, 14, lf(room, 0.4));
  p.rect(26, 62, 6, 2, lf(room, 0.22));
  // The ceiling spot.
  p.rect(20, GLASS_TOP + 1.8, 2, 1.6, T('ink', 1, d));
  // MINDER on the glass, small and grey (our name); the thin fascia stays blank white.
  text(p, 'MINDER', 4.6, 22, grey);
  // The door's vertical bar handle.
  p.rect(doorX + 2, 42, 0.6, 10, T('steel', 5, d));
}

// ------------------------------------------------------------------------------------ boutiques

function drawKaars(p: Pen): void {
  const d = p.d;
  const black = paint('stone', 1, 3, d);
  const gold = T('gold', 5, d);
  const doorX = 41.5;
  pui(p, { paint: black, fasciaBg: black, fasciaInk: gold, name: 'VLAM', doorX, doorW: 11, door: black, doorGlass: false }, (X, Y) => {
    const y = Y / d;
    // A dim, warm boutique: a display plinth of dark wood.
    if (y > 52) return warm(0.18 + (d >= 2 ? (bay(X, Y) - 0.5) * 0.04 : 0), d);
    return warm(0.3 + Math.max(0, 1 - Math.abs(X / d - 20) / 20) * 0.2, d);
  });
  // The display plinth's lit edge.
  p.rect(2.6, 52, 36.5, 0.8, warm(0.6, d));
  // 1. The candle (a tall pillar, cream, its wick) on a brass dish, and its tag.
  const wax = ladder([T('sand', 4, 2), T('sand', 5, 2), T('sand', 6, 2), mx(T('sand', 7, 2), T('oat.lantern', 3, 2), 0.3, 2)], 2, d);
  p.fill(8, 34, 4, 18, (X) => lf(wax, 0.9 - ((X / d - 8) / 4) * 0.7));
  p.rect(9.8, 32.4, 0.5, 1.6, T('ink', 1, d));
  p.rect(6.6, 51, 6.8, 1, T('gold', 4, d));
  // The tag: a white card with € 400.
  p.rect(13.4, 44, 8.4, 4, T('snow', 5, d));
  if (d >= 2) {
    euro(p, 14, 44.8, 2.5, T('ink', 1, d));
    text(p, '400', 16.1, 44.8, T('ink', 1, d), 0.5);
  } else p.rect(14, 45, 6, 1, T('ink', 1, 1));
  p.rect(12, 46, 1.4, 0.3, T('gold', 4, d));
  // 2. A ceramic vase (sage, lit left).
  const sage = litLad('olive', d, 3, 6, 0.15);
  p.disc(26, 46, 4.4, 5.6, (_X, _Y, u, v) => lf(sage, 0.6 - u * 0.35 - v * 0.15));
  p.rect(24.6, 38, 2.8, 3.4, lf(sage, 0.5));
  // 3. A small leather bag.
  const lea = litLad('brown', d, 2, 6, 0.15);
  p.rect(31, 45, 6, 7, lf(lea, 0.55));
  p.rect(31, 45, 1.2, 7, lf(lea, 0.85));
  p.disc(34, 45, 2.2, 2.2, (_X, _Y, u, v) => (v < 0 && u * u + v * v > 0.45 ? lf(lea, 0.4) : 0));
}

function drawZeep(p: Pen): void {
  const d = p.d;
  const green = paint('oat.green', 0, 3, d);
  const cream = mx(T('sand', 6, 2), SKY_CAST, 0.08, d);
  const doorX = 41.5;
  pui(p, { paint: green, fasciaBg: green, fasciaInk: cream, name: 'SCHUIM', doorX, doorW: 11, door: green, doorGlass: true }, (X, Y) => {
    const x = X / d;
    const y = Y / d;
    // Pale tiled walls (white), two glass shelves.
    if ((y > 37 && y < 38) || (y > 52 && y < 53)) return mx(T('glass', 5, 2), T('snow', 6, 2), 0.4, d);
    const t = 0.5 + Math.max(0, 1 - Math.abs(x - 20) / 22) * 0.3;
    return mx(warm(t, d), T('gable', 5, 2), 0.55, d);
  });
  // 1. A stack of pastel soap bars, 2. a bottle with a pump, 3. a wooden brush.
  const soaps = [mx(T('pink', 5, 2), SKY_CAST, 0.2, 2), mx(T('sky', 6, 2), SKY_CAST, 0.1, 2), mx(T('olive', 6, 2), SKY_CAST, 0.2, 2), mx(T('sand', 6, 2), SKY_CAST, 0.1, 2)];
  for (let i = 0; i < 4; i++) {
    const c = d === 1 ? mx(soaps[i], soaps[i], 0, 1) : soaps[i];
    p.rect(6 + (i & 1) * 0.6, 34 - i * 2.4, 8, 2.2, c);
    if (d >= 2) p.rect(6 + (i & 1) * 0.6, 34 - i * 2.4 + 1.8, 8, 0.4, mx(c, T('ink', 1, 2), 0.3, d));
  }
  const amber = litLad('gold', d, 1, 5, 0.1);
  p.rect(22, 44, 5, 8, lf(amber, 0.5));
  p.rect(22, 44, 1.2, 8, lf(amber, 0.9));
  p.rect(23.8, 40.6, 1.4, 3.4, T('ink', 1, d));
  p.rect(23.8, 40.4, 3, 0.8, T('ink', 1, d));
  const wd = litLad('wood', d, 3, 6, 0.15);
  p.rect(30, 48, 7, 3, lf(wd, 0.6));
  p.rect(30, 48, 7, 0.8, lf(wd, 0.9));
  if (d >= 2) for (let k = 0; k < 6; k++) p.rect(30.5 + k * 1.1, 51, 0.5, 1.2, T('stone', 5, d));
}

// ------------------------------------------------------------------------------------ TE KOOP

/** The house TE KOOP: 110 × 152, its base at row 152 (spec §2.1, §8.2, §8.6). */
function drawTeKoop(p: Pen): void {
  const d = p.d;
  const w = 110;
  const h = 152;
  const band = h - 80; // the ground band's top (4.0 m at 20 px/m): y 72
  const brick = ladder([T('oat.brick', 0, 2), T('oat.brick', 1, 2), T('oat.brick', 2, 2), T('oat.brick', 3, 2), mx(T('oat.brick', 4, 2), SUN, 0.1, 2), mx(T('oat.brick', 5, 2), SUN, 0.18, 2)], 2, d);
  const mortar = ladder([T('oat.mortar', 0, 2), T('oat.mortar', 1, 2), T('oat.mortar', 2, 2)], 1, d);
  const white = litLad('gable', d, 2, 6, 0.16);
  const sand = litLad('oat.mortar', d, 0, 3, 0.2);
  const hard = litLad('slate', d, 2, 6, 0.08);
  const green = litLad('oat.green', d, 0, 3, 0.25);
  // The wall: brick courses (true scale in the band, half scale above); the cornice's shadow.
  const shadowTop = 6;
  p.fill(0, 0, w, h, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    let sh = 0;
    if (y > shadowTop && y < shadowTop + 4.7 && x > 8.6) sh = 1;
    if (x > w - 1.6) sh = 0.5;
    if (d === 1) return lf(brick, 0.62 - sh * 0.3);
    const ch = y > band ? 1.3 : 0.75;
    const row = Math.floor(y / ch);
    const fr = y / ch - row;
    const L = ch * 3.2;
    const bx = Math.floor(x / L + (row & 1) * 0.5);
    const joint = d >= 4 ? fr < 0.22 || (x / L + (row & 1) * 0.5 - bx) < 0.07 : y > band && fr < 0.25;
    if (joint) return lf(mortar, 0.55 - sh * 0.5);
    const hv = h2(bx, row, 7);
    return lf(brick, 0.5 + (hv - 0.5) * (d >= 4 ? 0.34 : 0.2) - sh * 0.3);
  });
  // The cornice (wood, painted white) with a raised centre; its dentils.
  p.rect(0, 2, w, 4, lf(white, 0.62));
  p.rect(0, 2, w, 0.8, lf(white, 0.98));
  p.rect(0, 5.2, w, 0.8, lf(white, 0.3));
  p.rect(32, 0, 46, 2.4, lf(white, 0.7));
  p.rect(32, 0, 46, 0.6, lf(white, 0.98));
  if (d >= 2) for (let x = 1; x < w; x += 2.2) p.rect(x, 4.4, 1, 0.8, lf(white, 0.35));
  // The upper storeys: three rows of 12-pane white sashes, sandstone sills, reveals in shade.
  const bays = [11, 33, 55, 77, 99];
  const storeys = [8, 30, 52];
  for (const sy of storeys) {
    for (const bx of bays) {
      const ww = 11;
      const wh = 17;
      const x0 = bx - ww / 2;
      sash(p, x0, sy, ww, wh, 3, 4, white, d);
      p.rect(x0 - 0.8, sy + wh, ww + 1.6, 1, lf(sand, 0.85));
      p.rect(x0 - 0.2, sy + wh + 1, ww + 1, 0.8, lf(brick, 0.2));
    }
    // Wall anchors at the floor line (black crosses).
    for (const ax of [3.2, w - 3.2]) {
      p.rect(ax - 1, sy + 19.6, 2, 0.5, T('ink', 1, d));
      p.rect(ax - 0.25, sy + 18.6, 0.5, 2.4, T('ink', 1, d));
    }
  }
  // The ground band: hardstone plinth, the bel-etage windows, the cellar windows with grilles.
  p.rect(0, h - 7, w, 7, lf(hard, 0.55));
  p.rect(0, h - 7, w, 0.8, lf(hard, 0.95));
  for (const bx of [11, 33, 77, 99]) {
    sash(p, bx - 6.5, band + 10, 13, 24, 3, 4, white, d);
    p.rect(bx - 7.4, band + 34, 14.8, 1.2, lf(sand, 0.85));
    // The cellar window: low, a grille.
    p.rect(bx - 5, h - 18, 10, 9, T('glass', 0, d));
    for (let k = 0; k < 5; k++) p.rect(bx - 4.4 + k * 2.1, h - 18, 0.6, 9, lf(hard, 0.3));
    p.rect(bx - 5.6, h - 18.8, 11.2, 0.9, lf(sand, 0.75));
  }
  // The door on the bel-etage, a fanlight with a carved centre post.
  const doorTop = band + 7;
  const landing = h - 28;
  p.rect(48.4, band + 0.6, 13.2, 6.4, lf(sand, 0.7));
  p.fill(49, band + 1.2, 12, 5.4, (X, Y) => {
    const x = X / d - 55;
    const y = Y / d - band - 6.6;
    if (x * x / 36 + y * y / 29 > 1) return lf(sand, 0.7);
    if (Math.abs(x) < 0.6 || (d >= 2 && Math.abs(Math.atan2(y, x) + Math.PI / 2) % 0.6 < 0.12)) return lf(white, 0.8);
    return mx(T('glass', 2, 2), SKY_CAST, 0.2, d);
  });
  p.fill(49, doorTop, 12, landing - doorTop, (X) => lf(green, 0.62 - ((X / d - 49) / 12) * 0.35));
  p.rect(49, doorTop, 0.8, landing - doorTop, lf(green, 0.95));
  if (d >= 2) {
    p.rect(50.6, doorTop + 2.4, 3.6, 15, lf(green, 0.35));
    p.rect(55.8, doorTop + 2.4, 3.6, 15, lf(green, 0.35));
    p.rect(50.6, doorTop + 21, 3.6, 18, lf(green, 0.35));
    p.rect(55.8, doorTop + 21, 3.6, 18, lf(green, 0.35));
    p.rect(53.6, doorTop + 19, 3, 0.8, T('gold', 5, d));
  }
  p.rect(48, doorTop - 0.6, 14, 0.8, lf(white, 0.7));
  // The DOUBLE STOEP: a landing slab, two flights parallel to the façade, railings the door's colour.
  p.rect(44, landing, 22, 2.4, lf(hard, 0.75));
  p.rect(44, landing, 22, 0.7, lf(hard, 1));
  const steps = 7;
  const rise = (h - landing - 2.4) / steps;
  const go = 2.6;
  for (let i = 0; i < steps; i++) {
    const y = landing + 2.4 + i * rise;
    const xl = 44 - (i + 1) * go;
    const xr = 66 + i * go;
    p.rect(xl, y, go + 0.2, h - y, lf(hard, 0.6 - i * 0.02));
    p.rect(xl, y, go + 0.2, 0.6, lf(hard, 0.95));
    p.rect(xr, y, go + 0.2, h - y, lf(hard, 0.48 - i * 0.02));
    p.rect(xr, y, go + 0.2, 0.6, lf(hard, 0.85));
  }
  // The souterrain door between the flights, under the landing.
  p.rect(47, landing + 4, 16, h - landing - 11, mx(lf(hard, 0.15), T('ink', 1, 2), 0.4, d));
  p.rect(48.5, landing + 6, 13, h - landing - 13, lf(green, 0.3));
  // Railings (grachtengroen) along both flights and the landing.
  const rail = lf(green, 0.5);
  const rw = Math.max(1, d >> 1);
  p.line(44, landing - 9, 44 - steps * go, h - 16, rail, rw);
  p.line(66, landing - 9, 66 + steps * go, h - 16, rail, rw);
  p.line(44, landing - 9, 66, landing - 9, rail, rw);
  for (let i = 0; i <= steps; i += 2) {
    p.rect(44 - i * go, landing - 9 + i * rise, 0.5, 9, rail);
    p.rect(66 + i * go - 0.5, landing - 9 + i * rise, 0.5, 9, rail);
  }
  // The TE KOOP board hanging from a first-floor window (bays 4–5), its bracket.
  const bx0 = 60;
  const by0 = 44;
  p.rect(bx0 + 4, by0 - 3, 0.6, 3, T('ink', 1, d));
  p.rect(bx0 + 40, by0 - 3, 0.6, 3, T('ink', 1, d));
  const board = litLad('snow', d, 3, 6, 0.1);
  p.rect(bx0, by0, 46, 13, lf(board, 0.75));
  p.rect(bx0, by0, 46, 0.6, lf(board, 1));
  p.rect(bx0 + 45.2, by0, 0.8, 13, lf(board, 0.3));
  p.rect(bx0 + 1, by0 + 13, 45, 1.4, lf(brick, 0.15));
  const red = T('red', 4, d);
  text(p, 'TE KOOP', bx0 + (46 - textW('TE KOOP')) / 2, by0 + 1.6, red);
  if (d >= 2) text(p, 'VRAAGPRIJS OP AANVRAAG', bx0 + (46 - textW('VRAAGPRIJS OP AANVRAAG', 0.5)) / 2, by0 + 8.6, T('ink', 1, d), 0.5);
  else p.rect(bx0 + 4, by0 + 9, 38, 1, T('ink', 1, 1));
  // Wear: soot under the cornice, a downpipe, damp at the foot.
  p.rect(w - 2.4, 6, 1.4, h - 13, lf(hard, 0.3));
  if (d >= 2) p.rect(w - 2.4, 6, 0.4, h - 13, lf(hard, 0.7));
}

/** A sash window (cols × rows panes), white frames, dark glass with the sky; reveals shaded top-left. */
function sash(p: Pen, x: number, y: number, w: number, h: number, cols: number, rows: number, white: readonly Color[], d: Dn): void {
  p.rect(x, y, w, h, lf(white, 0.7));
  const gx = x + 0.9;
  const gy = y + 0.9;
  const gw = w - 1.8;
  const gh = h - 1.8;
  p.fill(gx, gy, gw, gh, (X, Y) => {
    const u = (X / d - gx) / gw;
    const v = (Y / d - gy) / gh;
    const t = (u * 0.5 + v) % 0.7;
    return d >= 2 && t > 0.12 && t < 0.24 ? mx(T('glass', 4, 2), SKY_CAST, 0.35, d) : T('glass', v < 0.5 ? 2 : 1, d);
  });
  if (d >= 2) {
    const bw = 1 / d;
    for (let c = 1; c < cols; c++) p.rect(gx + (gw * c) / cols - bw / 2, gy, bw, gh, lf(white, 0.8));
    for (let r = 1; r < rows; r++) p.rect(gx, gy + (gh * r) / rows - bw / 2, gw, bw, lf(white, r === rows / 2 ? 0.9 : 0.8));
    // The jamb's and the head's shadow inside the opening (the sun is up-left).
    p.rect(gx, gy, 1.2, gh, T('glass', 0, d));
    p.rect(gx, gy, gw, 0.6, T('glass', 0, d));
  } else {
    p.rect(gx, gy + gh / 2, gw, 1, lf(white, 0.8));
  }
  p.rect(x + w - 0.5, y, 0.5, h, lf(white, 0.3));
}

// ------------------------------------------------------------------------------------ registration

const G = (w: number, h: number): { w: number; h: number; ox: number; oy: number } => ({ w, h, ox: 0, oy: h });
reg('decor/oat/a/haverbar', [G(W, H)], (p) => drawHaverbar(p));
reg('decor/oat/a/conceptstore', [G(W, H)], (p) => drawConceptstore(p));
reg('decor/oat/a/boutique-kaars', [G(W, H)], (p) => drawKaars(p));
reg('decor/oat/a/boutique-zeep', [G(W, H)], (p) => drawZeep(p));
reg('decor/oat/a/te-koop', [G(110, 152)], (p) => drawTeKoop(p));
