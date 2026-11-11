/**
 * The street furniture of oat-a, DE 9 STRAATJES at 09:30 (STREET-A, wave A; docs/design/oat.md §8.2
 * "Street furniture", §8.7 a 5–7, §8.10 wear, §8.11 outlines): Amsterdammertjes, bike staples and
 * parked bikes, the Kroon lantern on its mast, the span-wire lamp, the navy street-name plates,
 * hanging shop signs, a chalkboard, door plants, a bistro chair, short flags, the quay elms, the
 * underground-waste column, a quay power box and the city's street bins.
 *
 * True scale (20 px/m) for everything in the ground band (spec §8.2): a paal 0.75 m = 15 px, a staple
 * 0.9 m, bikes 22 px wheels, the lantern 4.3–4.5 m = 90 px; the elm's trunk true, its crown at about
 * 0.4 like the upper band of the houses. The 09:30 sun stands LEFT and in front (spec §8.3, decision
 * 37): lit left and top faces, shaded right faces with a cool sky cast. Static props have no ink
 * outline (decision 38); the bins can be shot and keep outline A (decision 60).
 *
 * The helpers exported here (`SUN`, `SKY_CAST`, `litLad`, `shadeLad`, `cyl`, `drawBike`, `drawElm`,
 * `euro`) are shared by bridges.ts, vistas.ts and shops.ts.
 */
import type { Color } from '../../../../../engine/color';
import { noise2 } from '../../../../art/paint';
import { bay, F, h2, ladder, mx, pick, reg, T, text, textW, type Dn, type Pen, type Rn } from './kit';

// ------------------------------------------------------------------------------------ light

/** The 09:30 sun (spec §8.3: 4,500 K, ≈ #ffd9b6) and the shade's sky cast (≈ #bfd3ff). */
export const SUN: Color = 0xffd9b6ff;
export const SKY_CAST: Color = 0xbfd3ffff;

/** Tones lo … hi of ramp n warmed toward the sun at the top (a lit material), as a fine ladder. */
export function litLad(n: Rn, d: Dn, lo = 0, hi = 99, warm = 0.22): readonly Color[] {
  const stops: Color[] = [];
  const top = Math.min(hi, 99);
  for (let k = lo; k <= top; k++) {
    const c = T(n, k, 2);
    if (stops.length && stops[stops.length - 1] === c) break;
    stops.push(c);
  }
  const n1 = Math.max(1, stops.length - 1);
  return ladder(
    stops.map((c, i) => mx(c, SUN, (warm * i) / n1, 2)),
    2,
    d,
  );
}

/** The same tones cooled by the sky (a material in shade). */
export function shadeLad(n: Rn, d: Dn, lo = 0, hi = 99, cool = 0.16): readonly Color[] {
  const stops: Color[] = [];
  for (let k = lo; k <= hi; k++) {
    const c = T(n, k, 2);
    if (stops.length && stops[stops.length - 1] === c) break;
    stops.push(c);
  }
  return ladder(
    stops.map((c) => mx(c, SKY_CAST, cool, 2)),
    2,
    d,
  );
}

/** Fraction t (0 deep … 1 light) of a ladder. */
export function lf(l: readonly Color[], t: number): Color {
  return pick(l, Math.max(0, Math.min(0.999, t)) * l.length);
}

/**
 * A vertical cylinder from (x, y0) to y1, w logical px wide, lit from the left (the sun): bright a
 * quarter in from the left edge, falling off to the shaded right, a thin reflected rim at d 4.
 */
export function cyl(p: Pen, x: number, y0: number, y1: number, w: number, lad: readonly Color[], base = 0.55, span = 0.45): void {
  const d = p.d;
  const W = Math.max(1, Math.round(w * d));
  const X0 = Math.round(x * d);
  const Y0 = Math.round(y0 * d);
  const Y1 = Math.round(y1 * d);
  for (let i = 0; i < W; i++) {
    const t = (i + 0.5) / W;
    let b = t < 0.3 ? base + span * (0.55 + 1.5 * t) : base + span * (1 - (t - 0.3) * 2.6);
    if (d >= 4 && W >= 4 && i === W - 1) b += 0.12;
    if (d === 1 && W === 1) b = base + span * 0.6;
    p.rectA(X0 + i, Y0, 1, Y1 - Y0, lf(lad, b));
  }
}

/** A ring of radius r (logical), thickness th, shaded per art px by `sh(u, v)` (u, v ∈ [−1, 1]). */
function ring(p: Pen, cx: number, cy: number, r: number, th: number, sh: (u: number, v: number) => Color): void {
  const k = 1 - th / r;
  p.disc(cx, cy, r, r, (_X, _Y, u, v) => {
    const q = u * u + v * v;
    return q >= k * k ? sh(u, v) : 0;
  });
}

/** A small `€` sign (our own shape: a C with two bars) at (x, y), size h logical px (≥ 2 at d 4). */
export function euro(p: Pen, x: number, y: number, h: number, c: Color): void {
  const s = h / 5;
  p.rect(x + s, y, 2 * s, s, c);
  p.rect(x + s, y + 4 * s, 2 * s, s, c);
  p.rect(x + 0.5 * s, y + s, s, 3 * s, c);
  p.rect(x, y + 1.6 * s, 2.4 * s, 0.6 * s, c);
  p.rect(x, y + 2.8 * s, 2.4 * s, 0.6 * s, c);
}

// ------------------------------------------------------------------------------------ paal

/** The Amsterdammertje: 0.75 m oxblood steel, a domed top with a collar, XXX, chipped paint. */
function drawPaal(p: Pen): void {
  const d = p.d;
  const ox = litLad('oat.oxblood', d, 0, 2, 0.3);
  const lad = ladder([T('ink', 1, 2), ox[0], ...ox, mx(ox[ox.length - 1], SUN, 0.25, 2)], 1, d);
  cyl(p, 0.8, 3.4, 16, 2.4, lad, 0.45, 0.5);
  // The collar and the dome.
  cyl(p, 0.5, 2.6, 3.4, 3, lad, 0.4, 0.5);
  p.disc(2, 2.2, 1.2, 1.1, (_X, _Y, u, v) => lf(lad, 0.62 - 0.35 * (u + v) * 0.5 + 0.1));
  if (d >= 2) {
    // XXX: three small crosses down the front, a lighter oxblood.
    const xc = lf(lad, 0.95);
    for (let i = 0; i < 3; i++) {
      const y = 5.5 + i * 2.4;
      const s = 1 / d;
      for (let k = 0; k < (d >= 4 ? 4 : 2); k++) {
        p.rect(1.3 + k * s, y + k * s, s, s, xc);
        p.rect(2.3 - k * s, y + k * s, s, s, xc);
      }
    }
    // Chipped paint: grey primer and rust near the foot and on the dome.
    const chip = [T('stone', 4, 2), T('rust', 2, 2), T('stone', 3, 2)];
    for (let i = 0; i < (d >= 4 ? 7 : 3); i++) {
      const hx = h2(i, 3, 41);
      const hy = h2(i, 7, 43);
      p.rect(1 + hx * 2, 9 + hy * 6.5, 2 / d, 1 / d, pick(chip, h2(i, 9, 45) * 3));
    }
    p.rect(2.6, 15.5, 0.9, 0.5, T('rust', 1, d));
  }
}

// ------------------------------------------------------------------------------------ staple

/** The stainless fietsnietje: a U of round tube (0.9 m high, 1.2 m long) on a foot plate. */
function drawStaple(p: Pen): void {
  const d = p.d;
  const st = litLad('steel', d, 2, 7, 0.15);
  const th = d === 1 ? 1 : 1.4;
  const x0 = 2;
  const x1 = 24 - th;
  const top = 1.5;
  // Legs (lit from the left: the left leg's left side bright).
  cyl(p, x0, top + 2, 17, th, st, 0.5, 0.45);
  cyl(p, x1, top + 2, 17, th, st, 0.42, 0.4);
  // The top tube with rounded corners: lit on top.
  const Wt = Math.max(1, Math.round(th * d));
  const Y0 = Math.round(top * d);
  for (let j = 0; j < Wt; j++) {
    const t = (j + 0.5) / Wt;
    p.rectA(Math.round((x0 + 1.2) * d), Y0 + j, Math.round((x1 - x0 - 1.2) * d), 1, lf(st, t < 0.4 ? 0.95 : 0.55 - t * 0.3));
  }
  p.disc(x0 + 1.4, top + 1.6, 1.4, 1.6, (_X, _Y, u, v) => (u * u + v * v > 0.25 ? lf(st, 0.7 - v * 0.3 - u * 0.1) : 0));
  p.disc(x1 + th - 1.4, top + 1.6, 1.4, 1.6, (_X, _Y, u, v) => (u * u + v * v > 0.25 ? lf(st, 0.6 - v * 0.3 - u * 0.15) : 0));
  // The foot plates and the bolts.
  const pl = litLad('stone', d, 1, 4);
  p.rect(x0 - 1, 17, th + 2, 1, lf(pl, 0.4));
  p.rect(x1 - 1, 17, th + 2, 1, lf(pl, 0.3));
  if (d >= 4) p.rect(x0 - 1, 17, th + 2, 0.25, lf(pl, 0.85));
}

// ------------------------------------------------------------------------------------ bikes

/** Bike looks: frame ramp and tones, extras. */
export type BikeKind = 'black' | 'blue-crate' | 'child-seat' | 'rusty';

/**
 * A parked Dutch bike in side view, 38 × 24 logical px with its wheels' contact line at `yb`, from
 * x. `air` mixes toward a haze colour (vistas, far banks); `flip` mirrors it.
 */
export function drawBike(p: Pen, x: number, yb: number, kind: BikeKind, o: { flip?: boolean; haze?: Color; air?: number; scale?: number } = {}): void {
  const d = p.d;
  const s = o.scale ?? 1;
  const air = o.air ?? 0;
  const hz = (c: Color): Color => (air > 0 && o.haze !== undefined ? mx(c, o.haze, air, d) : d === 1 ? mx(c, c, 0, 1) : c);
  const X = (lx: number): number => (o.flip ? x + (38 - lx) * s : x + lx * s);
  const Y = (ly: number): number => yb - (24 - ly) * s;
  const frameN: Rn = kind === 'blue-crate' ? 'denim' : kind === 'rusty' ? 'rust' : 'black';
  const fr = kind === 'rusty' ? [T('brown', 1, 2), T('rust', 1, 2), T('rust', 2, 2), T('brown', 3, 2)] : kind === 'blue-crate' ? [T('denim', 1, 2), T('denim', 2, 2), T('denim', 3, 2), T('denim', 4, 2)] : [T('ink', 1, 2), T('black', 2, 2), T('black', 3, 2), T('black', 5, 2)];
  void frameN;
  const fc = (k: number): Color => hz(fr[Math.max(0, Math.min(3, k))]);
  const tw = Math.max(1, Math.round(0.55 * s * d));
  const ln = (ax: number, ay: number, bx: number, by: number, c: Color, w = tw): void => p.line(X(ax), Y(ay), X(bx), Y(by), c, w);
  // True scale (20 px/m): 28-inch wheels (0.71 m = 14 px), a 1.1 m wheelbase, bars at 1.05 m.
  const R = 7.2;
  const flat = kind === 'rusty';
  const rear = [8.2, 24 - R] as const;
  const front = [29.8, 24 - R + (flat ? 0.5 : 0)] as const;
  // Wheels: tyre, rim, spokes (4× only), hub.
  const tyreD = hz(T('ink', 1, 2));
  const tyreL = hz(T('black', 3, 2));
  const rim = hz(T('steel', 5, 2));
  const spoke = hz(T('steel', 3, 2));
  const wheel = (cx: number, cy: number, flatBottom: boolean): void => {
    const wx = X(cx);
    const wy = Y(cy);
    const r = R * s;
    ring(p, wx, wy, r, Math.max(1 / d, 1.1 * s), (u, v) => (flatBottom && v > 0.8 ? tyreD : v < -0.6 && u < 0.2 ? tyreL : tyreD));
    if (flatBottom) p.rect(wx - r * 0.5, wy + r - 0.7 * s, r, 0.9 * s, tyreD);
    if (d >= 2) ring(p, wx, wy, r - 1.1 * s, Math.max(1 / d, 0.4 * s), (u) => (u < -0.3 ? rim : hz(T('steel', 4, 2))));
    if (d >= 4 && s > 0.6) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.13;
        p.line(wx, wy, wx + Math.cos(a) * (r - 1.4 * s), wy + Math.sin(a) * (r - 1.4 * s), spoke, 1);
      }
    }
    p.disc(wx, wy, 0.7 * s, 0.7 * s, hz(T('steel', 4, 2)));
    // The mudguard: a thin black arc close over the upper half.
    ring(p, wx, wy, r + 0.9 * s, Math.max(1 / d, 0.5 * s), (u, v) => (v < 0.2 && !(u > 0.75 && v > -0.3 && cx < 20) ? hz(T('black', 2, 2)) : 0));
  };
  wheel(rear[0], rear[1], false);
  wheel(front[0], front[1], flat);
  // The frame: an omafiets with a double low tube.
  const bb = [17.6, 17.8] as const;
  const seat = [14.4, 8.6] as const;
  const head = [26.4, 7.4] as const;
  const headB = [27.4, 11.2] as const;
  ln(bb[0], bb[1], rear[0], rear[1], fc(1));
  ln(seat[0], seat[1], rear[0], rear[1], fc(1));
  ln(bb[0], bb[1], seat[0], seat[1], fc(2));
  ln(headB[0], headB[1], bb[0], bb[1], fc(2));
  ln(head[0], head[1] + 0.8, bb[0] + 1, bb[1] - 3, fc(2));
  ln(headB[0], headB[1], front[0], front[1], fc(1));
  ln(head[0], head[1], headB[0], headB[1], fc(3));
  // A lit line along the top of the tubes (4×).
  if (d >= 4 && s > 0.6) {
    p.line(X(seat[0]), Y(seat[1]) - 1 / d, X(rear[0]), Y(rear[1]) - 1 / d, fc(3), 1);
    p.line(X(head[0]), Y(head[1] + 0.8) - 1 / d, X(bb[0] + 1), Y(bb[1] - 3) - 1 / d, fc(3), 1);
  }
  // Chain guard (a slim plate), kickstand, seatpost, saddle, handlebars, the rear rack.
  p.poly(
    [
      [X(rear[0]), Y(rear[1] - 0.7)],
      [X(bb[0] + 1.2), Y(bb[1] - 1.2)],
      [X(bb[0] + 1.2), Y(bb[1] + 0.6)],
      [X(rear[0]), Y(rear[1] + 0.5)],
    ],
    hz(T('black', 2, 2)),
  );
  ln(bb[0], bb[1], bb[0] - 3, 23.8, hz(T('steel', 3, 2)), Math.max(1, tw - 1));
  ln(seat[0], seat[1], seat[0] - 0.5, seat[1] - 3, hz(T('steel', 4, 2)));
  p.rect(X(seat[0] - (o.flip ? -2.4 : 3)), Y(seat[1] - 4.3), 4.8 * s, 1.3 * s, hz(T('brown', 1, 2)));
  if (d >= 2) p.rect(X(seat[0] - (o.flip ? -2.4 : 3)), Y(seat[1] - 4.3), 4.8 * s, 0.4 * s, hz(T('brown', 3, 2)));
  ln(head[0], head[1], head[0] + 0.2, head[1] - 3, fc(2));
  ln(head[0] + 0.2, head[1] - 3, head[0] - 3.8, head[1] - 3.6, hz(T('steel', 4, 2)));
  p.rect(X(head[0] - (o.flip ? -3.2 : 4.4)), Y(head[1] - 4.2), 1.5 * s, 1.1 * s, hz(T('ink', 1, 2)));
  ln(seat[0] - 0.4, seat[1] + 0.4, 2.6, seat[1] + 0.6, hz(T('steel', 3, 2)), Math.max(1, tw - 1));
  ln(2.6, seat[1] + 0.6, rear[0], rear[1], hz(T('steel', 3, 2)), 1);
  if (kind === 'blue-crate') {
    // A wooden crate on the front rack.
    const wd = litLad('wood', d, 2, 6);
    const cx0 = 27.6;
    const cxs = o.flip ? X(cx0 + 9.4) : X(cx0);
    p.rect(cxs, Y(3.4), 9.4 * s, 5.4 * s, hz(lf(wd, 0.55)));
    for (let k = 0; k < 3; k++) p.rect(cxs, Y(4 + k * 1.8), 9.4 * s, 0.5 * s, hz(lf(wd, 0.25)));
    p.rect(cxs, Y(3.4), 0.8 * s, 5.4 * s, hz(lf(wd, 0.9)));
  }
  if (kind === 'child-seat') {
    // A child seat on the rear rack: a moulded shell, muted red.
    const cs = [T('red', 2, 2), T('red', 3, 2), T('red', 4, 2)];
    p.poly(
      [
        [X(2.4), Y(0.6)],
        [X(5.4), Y(0.2)],
        [X(7.2), Y(5.4)],
        [X(11.6), Y(5.4)],
        [X(11.6), Y(8.2)],
        [X(3.2), Y(8.2)],
      ],
      hz(cs[1]),
    );
    p.rect(X(o.flip ? 3.4 : 2.4), Y(0.6), 1 * s, 7.6 * s, hz(cs[2]));
    if (d >= 2) p.rect(X(o.flip ? 11.6 : 7.2), Y(5.4), 4.4 * s, 0.4 * s, hz(cs[0]));
  }
  if (kind === 'rusty' && d >= 2) {
    // A wreck label on the rusty one (the city's orange tag) and rust spots.
    p.rect(X(o.flip ? 21.4 : 19.8), Y(12), 1.6 * s, 2.2 * s, hz(T('orange', 3, 2)));
  }
}

// ------------------------------------------------------------------------------------ lantern

/**
 * The classic canal lantern (spec §8.7 a 6): an oxblood mast with a fluted base and collars, a black
 * four-sided Kroon lantern with a crown and a finial on top. By day the lamp is off: pale glass.
 */
export function drawLantern(p: Pen, x: number, yb: number, lit = false): void {
  const d = p.d;
  const ox = ladder([T('ink', 1, 2), T('oat.oxblood', 0, 2), T('oat.oxblood', 1, 2), T('oat.oxblood', 2, 2), mx(T('oat.oxblood', 2, 2), SUN, 0.3, 2)], 2, d);
  const c = x;
  // Base: a fluted foot 1.1 m.
  cyl(p, c - 2.4, yb - 6, yb, 4.8, ox, 0.4, 0.5);
  cyl(p, c - 1.9, yb - 20, yb - 6, 3.8, ox, 0.4, 0.5);
  if (d >= 2) for (let k = 0; k < 3; k++) p.rect(c - 1.4 + k * 1.3, yb - 19, 1 / d, 12.5, lf(ox, 0.15));
  cyl(p, c - 2.6, yb - 21.4, yb - 19.6, 5.2, ox, 0.45, 0.5);
  // The shaft and its collars.
  cyl(p, c - 1, yb - 66, yb - 21, 2, ox, 0.4, 0.5);
  cyl(p, c - 1.6, yb - 48, yb - 46.8, 3.2, ox, 0.45, 0.5);
  cyl(p, c - 1.8, yb - 68.4, yb - 66, 3.6, ox, 0.45, 0.5);
  // The lantern: a frustum, wider at the top; black frame, glass panes.
  const bk = litLad('black', d, 0, 4, 0.1);
  const top = yb - 82;
  const bot = yb - 69;
  p.poly(
    [
      [c - 2.2, bot],
      [c + 2.2, bot],
      [c + 3.6, top],
      [c - 3.6, top],
    ],
    lf(bk, 0.25),
  );
  const glassL = lit ? T('oat.lantern', 3, d) : mx(T('gable', 5, 2), SUN, 0.2, d);
  const glassR = lit ? T('oat.lantern', 2, d) : mx(T('glass', 4, 2), SKY_CAST, 0.3, d);
  p.poly(
    [
      [c - 1.7, bot - 1],
      [c - 0.3, bot - 1],
      [c - 0.3, top + 1.2],
      [c - 2.8, top + 1.2],
    ],
    glassL,
  );
  p.poly(
    [
      [c + 0.4, bot - 1],
      [c + 1.7, bot - 1],
      [c + 2.8, top + 1.2],
      [c + 0.4, top + 1.2],
    ],
    glassR,
  );
  if (d >= 4 && !lit) p.rect(c - 2.2, top + 2, 0.5, 6, mx(T('snow', 6, 2), SUN, 0.3, 4));
  // The cap and the crown with its points and the finial.
  p.rect(c - 4.2, top - 1.2, 8.4, 1.3, lf(bk, 0.5));
  p.rect(c - 4.2, top - 1.2, 8.4, 1 / d, lf(bk, 0.95));
  p.poly(
    [
      [c - 3.4, top - 1.2],
      [c + 3.4, top - 1.2],
      [c + 2.2, top - 4.2],
      [c - 2.2, top - 4.2],
    ],
    lf(bk, 0.35),
  );
  for (let k = -2; k <= 2; k++) p.rect(c + k * 1.3 - 0.35, top - 6, 0.7, 2, lf(bk, k < 0 ? 0.7 : 0.4));
  p.disc(c, top - 6.6, 0.9, 0.9, (_X, _Y, u, v) => lf(bk, 0.6 - 0.4 * (u + v) * 0.5));
  p.rect(c - 0.3, top - 8.2, 0.6, 1.4, lf(bk, 0.5));
  // The lamp bracket under the lantern.
  cyl(p, c - 1.3, bot, yb - 68, 2.6, ox, 0.45, 0.5);
}

// ------------------------------------------------------------------------------------ span-wire lamp

/** A traditional span-wire lamp hung over the narrow street, two cables to the corners (spec §8.7 a 4). */
function drawSpanLamp(p: Pen): void {
  const d = p.d;
  const cable = T('ink', 1, d);
  const w = d >= 4 ? 1 : 1;
  const hx = 24;
  const hy = 48;
  p.line(0, 0, hx - 0.5, hy, cable, w);
  p.line(48, 0, hx + 0.5, hy, cable, w);
  const bk = litLad('black', d, 0, 4, 0.1);
  // Hook, canopy (a shallow cone), the glass bowl, the finial.
  p.rect(hx - 0.3, hy, 0.6, 1.4, lf(bk, 0.5));
  p.poly(
    [
      [hx - 5, hy + 4],
      [hx + 5, hy + 4],
      [hx + 1.4, hy + 1.2],
      [hx - 1.4, hy + 1.2],
    ],
    lf(bk, 0.35),
  );
  p.rect(hx - 5, hy + 3.4, 10, 0.8, lf(bk, 0.65));
  p.rect(hx - 5, hy + 3.4, 4, 1 / d, lf(bk, 0.95));
  p.poly(
    [
      [hx - 3.4, hy + 4.2],
      [hx + 3.4, hy + 4.2],
      [hx + 2.2, hy + 11],
      [hx - 2.2, hy + 11],
    ],
    (X) => {
      const u = X / d - hx;
      return u < -0.6 ? mx(T('gable', 5, 2), SUN, 0.25, d) : u < 1 ? mx(T('gable', 4, 2), SKY_CAST, 0.2, d) : mx(T('glass', 4, 2), SKY_CAST, 0.3, d);
    },
  );
  p.rect(hx - 2.4, hy + 11, 4.8, 1, lf(bk, 0.4));
  p.rect(hx - 0.5, hy + 12, 1, 1.4, lf(bk, 0.3));
  void w;
}

// ------------------------------------------------------------------------------------ street-name plates

/** The plates (spec §8.7 a 5): navy enamel, white capitals, a thin white border, CENTRUM small. */
const PLATES: readonly (readonly [string, string])[] = [
  ['berenstraat', 'BERENSTRAAT'],
  ['wolvenstraat', 'WOLVENSTRAAT'],
  ['oude-spiegelstraat', 'OUDE SPIEGELSTRAAT'],
  ['prinsengracht', 'PRINSENGRACHT'],
  ['keizersgracht', 'KEIZERSGRACHT'],
  ['herengracht', 'HERENGRACHT'],
  ['singel', 'SINGEL'],
];

export const OAT_A_PLATES: Readonly<Record<string, { id: string; w: number; h: number }>> = Object.fromEntries(
  PLATES.map(([slug, name]) => [slug, { id: `decor/oat/a/plate-${slug}`, w: textW(name) + 6, h: 12 }]),
);

function drawPlate(p: Pen, name: string): void {
  const d = p.d;
  const w = p.w;
  const h = p.h;
  const navy = [T('navy', 1, 2), T('navy', 2, 2), T('navy', 3, 2), mx(T('navy', 4, 2), SKY_CAST, 0.15, 2)];
  // The enamel: a soft bulge, lighter top-left.
  p.fill(0, 0, w, h, (X, Y) => {
    const u = X / (w * d);
    const v = Y / (h * d);
    const t = 1.6 - u * 0.9 - v * 1.0 + (d >= 4 && v < 0.12 ? 0.6 : 0);
    return d === 1 ? mx(navy[1], navy[1], 0, 1) : pick(navy, t + (bay(X, Y) - 0.5) * 0.4);
  });
  const white = d === 1 ? T('snow', 6, 1) : mx(T('snow', 5, 2), SKY_CAST, 0.1, d);
  // The border, inset half a px (a full px at 1×).
  if (d >= 2) {
    const e = 0.5;
    const t = 1 / d;
    p.rect(e, e, w - 2 * e, t, white);
    p.rect(e, h - e - t, w - 2 * e, t, white);
    p.rect(e, e, t, h - 2 * e, white);
    p.rect(w - e - t, e, t, h - 2 * e, white);
  } else {
    p.rect(0, 0, w, 1, white);
    p.rect(0, h - 1, w, 1, white);
    p.rect(0, 0, 1, h, white);
    p.rect(w - 1, 0, 1, h, white);
  }
  text(p, name, 3, 1.8, white);
  if (d >= 2) text(p, 'CENTRUM', (w - textW('CENTRUM', 0.5)) / 2, 7.9, mx(white, navy[2], 0.15, d), 0.5);
  else p.rect(w / 2 - 3, 8, 6, 1, T('snow', 4, 1));
  // Two screws and the edge's shadow on the wall.
  if (d >= 4) {
    p.rect(1.2, h / 2 - 0.25, 0.5, 0.5, T('stone', 5, d));
    p.rect(w - 1.7, h / 2 - 0.25, 0.5, 0.5, T('stone', 5, d));
  }
}

// ------------------------------------------------------------------------------------ hanging signs

/** A wrought-iron bracket from the wall (top-left) with a hanging sign board of our own words. */
function drawHangingSign(p: Pen, v: number): void {
  const d = p.d;
  const iron = litLad('black', d, 0, 4, 0.1);
  const ic = lf(iron, 0.3);
  // The wall plate, the arm, the scroll brace.
  p.rect(0, 0, 1.2, 9, lf(iron, 0.5));
  p.rect(0, 1.6, 21, 1, ic);
  if (d >= 2) p.rect(0, 1.6, 21, 1 / d, lf(iron, 0.9));
  p.line(0.6, 8.4, 9, 2.4, ic, Math.max(1, d >> 1));
  if (d >= 2) {
    p.disc(5.2, 4.6, 1.6, 1.6, (_X, _Y, u, vv) => (u * u + vv * vv > 0.4 ? ic : 0));
    p.rect(20.4, 1, 1, 2, lf(iron, 0.6));
  }
  // Chains or rings to the board.
  p.rect(7, 2.6, 0.5, 2.6, ic);
  p.rect(19, 2.6, 0.5, 2.6, ic);
  const bx = 5;
  const by = 5.2;
  const bw = 16.5;
  const bh = 13;
  const boards: readonly [Rn, number, Rn, number][] = [
    ['sand', 5, 'brown', 1],
    ['oat.green', 2, 'gable', 5],
    ['gable', 5, 'navy', 2],
    ['oat.oxblood', 1, 'sand', 6],
    ['brown', 2, 'sand', 6],
    ['stone', 5, 'ink', 1],
    ['ink', 1, 'ink', 0],
  ];
  const [bn, bk, tn, tk] = boards[(v - 1) % boards.length];
  const lad = shadeLad(bn, d, Math.max(0, bk - 2), bk + 1, 0.12);
  const ink = mx(T(tn, tk, 2), SKY_CAST, 0.1, d);
  if (v === 7) {
    // A record as the sign (a shaped board): the black disc with its grooves, a label, a light rim.
    const cx = 13.25;
    const cy = 12.6;
    // The chains run on down to the disc's shoulders.
    p.rect(7, 5.2, 0.5, 3.6, ic);
    p.rect(19, 5.2, 0.5, 3.6, ic);
    p.disc(cx, cy, 7.4, 7.4, (_X, _Y, u, vv) => {
      const r = Math.hypot(u, vv);
      if (r < 0.32) return r < 0.07 ? lf(lad, 0) : r > 0.26 && d >= 2 ? T('sand', 4, d) : mx(T('sand', 6, 2), SKY_CAST, 0.12, d);
      if (r > 0.93) return lf(lad, u + vv < -0.3 ? 0.9 : 0.35);
      const groove = d >= 2 && Math.floor(r * 7.4 * d * 0.7) % 2 === 0;
      return lf(lad, (groove ? 0.45 : 0.25) + (u < -0.2 && vv < -0.2 ? 0.3 : 0));
    });
    return;
  }
  p.fill(bx, by, bw, bh, (X) => lf(lad, 0.85 - (X / d - bx) / bw * 0.5));
  // A painted edge (shadow side right and below).
  p.rect(bx, by + bh - 0.7, bw, 0.7, lf(lad, 0.15));
  p.rect(bx + bw - 0.7, by, 0.7, bh, lf(lad, 0.2));
  if (d >= 2) p.rect(bx, by, bw, 1 / d, lf(lad, 1));
  if (v === 1) {
    // KAAS with a wedge of cheese.
    text(p, 'KAAS', bx + 1, by + 1.4, ink);
    p.poly(
      [
        [bx + 3, by + 11.5],
        [bx + 13.5, by + 11.5],
        [bx + 13.5, by + 8],
      ],
      T('gold', 5, d),
    );
    p.rect(bx + 3, by + 11.4, 10.5, 0.7, T('gold', 3, d));
    if (d >= 2) p.disc(bx + 10, by + 10.2, 0.6, 0.5, T('gold', 3, d));
  } else if (v === 2) {
    // BRIL with a pair of glasses.
    text(p, 'BRIL', bx + 1.5, by + 1.4, ink);
    for (const cx of [bx + 5, bx + 11.5]) p.disc(cx, by + 9.6, 2.4, 2, (_X, _Y, u, vv) => (u * u + vv * vv > 0.45 ? ink : 0));
    p.rect(bx + 7.2, by + 9, 2.2, 0.6, ink);
  } else if (v === 3) {
    // ZEEP with soap bubbles.
    text(p, 'ZEEP', bx + 1.2, by + 1.4, ink);
    const b2 = mx(T('sky', 5, 2), SKY_CAST, 0.2, d);
    for (const [cx, cy, r] of [
      [bx + 5, by + 10, 2],
      [bx + 9.5, by + 9, 1.4],
      [bx + 12.5, by + 10.8, 1.1],
    ] as const)
      p.disc(cx, cy, r, r, (_X, _Y, u, vv) => (u * u + vv * vv > 0.5 ? b2 : u < -0.2 && vv < -0.2 && d >= 2 ? T('snow', 6, d) : 0));
  } else if (v === 5) {
    // THEE with a teapot: the round body, the spout, the handle ring, the lid's knob.
    text(p, 'THEE', bx + 1.2, by + 1.4, ink);
    const pot = mx(T('sand', 6, 2), SKY_CAST, 0.12, d);
    p.disc(bx + 8.2, by + 9.8, 3.2, 2.4, pot);
    p.line(bx + 10.8, by + 9.4, bx + 13.4, by + 7.4, pot, Math.max(1, d >> 1));
    p.disc(bx + 4.6, by + 9.6, 1.5, 1.5, (_X, _Y, u, vv) => (u * u + vv * vv > 0.4 && u < 0.2 ? pot : 0));
    p.rect(bx + 7.6, by + 6.8, 1.2, 0.8, pot);
    if (d >= 2) p.rect(bx + 6, by + 9.2, 1, 1.4, lf(lad, 0.95));
  } else if (v === 6) {
    // DROP with liquorice lozenges (black diamonds, a lit edge up-left).
    text(p, 'DROP', bx + 1.2, by + 1.4, ink);
    for (const [cx, cy] of [
      [bx + 4.4, by + 9.8],
      [bx + 8.4, by + 10.4],
      [bx + 12.4, by + 9.6],
    ] as const) {
      p.poly(
        [
          [cx, cy - 2],
          [cx + 1.8, cy],
          [cx, cy + 2],
          [cx - 1.8, cy],
        ],
        ink,
      );
      if (d >= 2) p.rect(cx - 0.6, cy - 1, 0.6, 0.6, T('slate', 3, d));
    }
  } else {
    // A hatter's sign: a hat cut-out and OUD (our own).
    text(p, 'OUD', bx + 3.5, by + 1.4, ink);
    p.rect(bx + 4, by + 10.8, 9, 1, ink);
    p.rect(bx + 6, by + 7.4, 5, 3.6, ink);
    p.rect(bx + 6, by + 9.6, 5, 0.6, T('sand', 5, d));
  }
}

// ------------------------------------------------------------------------------------ small props

function drawChalkboard(p: Pen): void {
  const d = p.d;
  const wd = shadeLad('wood', d, 1, 5);
  // The A-frame's legs (back leg darker), the board in its frame.
  p.line(9.5, 1, 11.5, 18, lf(wd, 0.15), Math.max(1, d >> 1));
  p.poly(
    [
      [2.4, 1],
      [9.6, 1],
      [10.8, 17.6],
      [1.2, 17.6],
    ],
    lf(wd, 0.55),
  );
  const sl = [T('slate', 1, 2), T('slate', 2, 2), T('ink', 1, 2)];
  p.poly(
    [
      [3.2, 2.2],
      [8.8, 2.2],
      [9.6, 14],
      [2.4, 14],
    ],
    d === 1 ? T('slate', 1, 1) : sl[0],
  );
  p.rect(1.6, 1, 0.7, 16.6, lf(wd, 0.9));
  // Chalk: a heading and lines of scribble.
  const ch = mx(T('snow', 5, 2), SKY_CAST, 0.2, d);
  if (d >= 2) {
    text(p, 'VERS', 3.6, 3.2, ch, 0.5);
    for (let r = 0; r < 4; r++) {
      const y = 6.4 + r * 1.8;
      const len = 3 + h2(r, 1, 51) * 2.6;
      p.rect(3.6 + r * 0.12, y, len, 1 / d, ch);
      if (d >= 4) p.rect(3.6 + len + 0.5, y, 0.8, 1 / d, T('gold', 5, d));
    }
  } else {
    p.rect(4, 5, 4, 1, T('snow', 3, 1));
    p.rect(4, 8, 3, 1, T('snow', 3, 1));
  }
}

function drawPlant(p: Pen, v: number): void {
  const d = p.d;
  // The pot: terracotta (laurel) or zinc (grass).
  const pot = v === 1 ? litLad('rust', d, 1, 4, 0.2) : litLad('steel', d, 2, 5, 0.1);
  p.poly(
    [
      [2, 10],
      [8, 10],
      [7.3, 16],
      [2.7, 16],
    ],
    lf(pot, 0.5),
  );
  p.rect(2, 10, 1.4, 6, lf(pot, 0.85));
  p.rect(6.8, 10, 1.2, 6, lf(pot, 0.2));
  p.rect(1.6, 9.6, 6.8, 1, lf(pot, 0.7));
  const g = [T('green', 1, 2), T('green', 2, 2), T('olive', 2, 2), T('olive', 3, 2), T('olive', 4, 2), T('olive', 5, 2)];
  if (v === 1) {
    // A clipped bay laurel: a stem and a ball, lit top-left, leaf clusters at 4×.
    p.rect(4.7, 6, 0.7, 4, T('brown', 2, d));
    p.disc(5, 4, 3.6, 3.6, (X, Y, u, vv) => {
      const t = 2.6 - (u + vv) * 1.6 + (d >= 4 ? (h2(X >> 1, Y >> 1, 61) - 0.5) * 1.6 : d === 2 ? (h2(X >> 1, Y >> 1, 61) - 0.5) * 0.8 : 0);
      return d === 1 ? T('olive', t > 2.5 ? 3 : 2, 1) : pick(g, t);
    });
  } else {
    // Ornamental grass: thin blades fanning out, a few dry tips.
    const blades = d >= 4 ? 14 : d >= 2 ? 8 : 4;
    for (let k = 0; k < blades; k++) {
      const a = -Math.PI / 2 + (k / (blades - 1) - 0.5) * 1.6;
      const len = 7 + h2(k, 2, 63) * 3;
      const c = k % 5 === 4 ? T('sand', 4, d) : pick(g, 1.5 + (k / blades) * 3);
      p.line(5, 10, 5 + Math.cos(a) * len, 10 + Math.sin(a) * len, c, 1);
    }
  }
}

function drawChair(p: Pen): void {
  const d = p.d;
  const iron = litLad('black', d, 1, 5, 0.1);
  const w = Math.max(1, d >> 1);
  // Legs (front, back), the seat, the bent backrest, rattan weave on the seat.
  p.line(2, 18, 3, 10, lf(iron, 0.4), w);
  p.line(8.6, 18, 7.4, 10, lf(iron, 0.3), w);
  p.line(7.4, 10, 8.4, 1, lf(iron, 0.5), w);
  p.line(8.4, 1, 6.6, 1.6, lf(iron, 0.5), w);
  p.line(6.6, 1.6, 7.2, 10, lf(iron, 0.35), w);
  const rt = litLad('sand', d, 2, 6, 0.15);
  p.rect(2.2, 9.6, 6, 1.2, lf(rt, 0.6));
  if (d >= 2) {
    p.rect(2.2, 9.6, 6, 1 / d, lf(rt, 0.95));
    for (let k = 0; k < 3; k++) p.rect(7.2 + 0.1 * k, 3 + k * 2, 0.9, 1, lf(rt, 0.5));
  }
}

function drawFlag(p: Pen, v: number): void {
  const d = p.d;
  const pole = litLad('steel', d, 2, 6, 0.1);
  p.rect(0, 9, 1.4, 3, lf(pole, 0.4));
  p.line(0.8, 10, 15, 1.2, lf(pole, 0.8), Math.max(1, d >> 1));
  p.disc(15.4, 1, 0.7, 0.7, T('gold', 5, d));
  // The cloth hangs from the outer half of the pole, its free edge waving.
  const c1 = v === 1 ? shadeLad('oat.green', d, 1, 3, 0.1) : shadeLad('sand', d, 4, 7, 0.1);
  const c2 = v === 1 ? shadeLad('gable', d, 4, 6, 0.1) : shadeLad('oat.oxblood', d, 0, 2, 0.1);
  p.poly(
    [
      [6.5, 6.6],
      [14.6, 1.6],
      [16, 14],
      [8.4, 15.2],
    ],
    (X, Y) => {
      const x = X / d;
      const y = Y / d;
      const wave = Math.sin(y * 0.9 + x * 0.4) * 0.35 + 0.5;
      const stripe = v === 1 ? x > 11.4 && x < 12.8 : y > 9;
      return lf(stripe ? c2 : c1, wave * 0.6 + 0.3 - (x - 6.5) * 0.02);
    },
  );
}

// ------------------------------------------------------------------------------------ elms

/**
 * A quay elm (spec §8.2 "Trees": the trunk at true scale, the crown at about 0.4 above), w × h with
 * its foot at (cx, yb): late-September green with the first yellow leaves, dappled clumps lit from
 * the upper left, light through gaps. `air` mixes toward `haze` (far elms); `scale` shrinks it.
 */
export function drawElm(p: Pen, cx: number, yb: number, seed: number, o: { scale?: number; haze?: Color; air?: number; trunk?: boolean; shade?: number } = {}): void {
  const d = p.d;
  const s = o.scale ?? 1;
  const air = o.air ?? 0;
  const hz = (c: Color): Color => (air > 0.01 && o.haze !== undefined ? mx(c, o.haze, air, d) : c);
  const leafSun = [T('olive', 1, 2), T('green', 2, 2), mx(T('green', 2, 2), T('olive', 3, 2), 0.5, 2), T('olive', 3, 2), T('olive', 4, 2), mx(T('olive', 4, 2), SUN, 0.15, 2), mx(T('olive', 5, 2), SUN, 0.2, 2)].map((c) => hz(c));
  const leaves = ladder(leafSun, 1, d);
  const yellow = [hz(T('gold', 3, 2)), hz(T('gold', 4, 2)), hz(mx(T('gold', 5, 2), SUN, 0.3, 2))].map((c) => (d === 1 ? mx(c, c, 0, 1) : c));
  const bark = ladder([T('ink', 1, 2), T('stone', 1, 2), T('stone', 2, 2), T('brown', 2, 2), T('stone', 3, 2), mx(T('stone', 4, 2), SUN, 0.15, 2)].map((c) => hz(c)), 1, d);
  // The trunk (true scale: about 0.5 m = 10 px), a flare at the foot, limbs into the crown.
  const tw = 10 * s;
  const tTop = yb - 74 * s;
  if (o.trunk !== false) {
    p.fill(cx - tw / 2 - 1.5 * s, tTop, tw + 3 * s, yb - tTop, (X, Y) => {
      const x = X / d - cx;
      const y = Y / d;
      const k = (y - tTop) / (yb - tTop);
      const half = tw / 2 + (k > 0.9 ? (k - 0.9) * 15 * s : 0) - (1 - k) * 0.8 * s;
      if (Math.abs(x) > half) return 0;
      const t = (x / half + 1) / 2;
      let b = t < 0.3 ? 0.62 + t * 0.9 : 0.89 - (t - 0.3) * 1.15;
      if (d >= 2) b += (h2(X >> (d >= 4 ? 1 : 0), Math.floor(Y / (d * 2.4)), seed + 3) - 0.5) * (d >= 4 ? 0.28 : 0.16);
      return lf(bark, b);
    });
    // Limbs: two or three, up and out.
    const limbs = 4;
    for (let k = 0; k < limbs; k++) {
      const dir = [-1, 1, -0.45, 0.55][k];
      const x1 = cx + dir * (11 + 7 * h2(seed, k, 73)) * s;
      const y1 = tTop - (16 + 8 * h2(seed, k, 75)) * s;
      const wA = Math.max(1, Math.round(3.4 * s * d));
      p.line(cx + dir * 1.5 * s, tTop + 6 * s, x1, y1, lf(bark, 0.5), wA);
      p.line(cx + dir * 1.5 * s - 1 / d, tTop + 6 * s, x1 - 1 / d, y1, lf(bark, 0.75), Math.max(1, wA >> 1));
    }
  }
  // The crown: clumps (seeded), each a lit dome; gaps let the light through.
  const cyc = yb - 112 * s;
  const n = 30;
  const cl: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = h2(seed, i, 81) * Math.PI * 2;
    const r = Math.sqrt(h2(seed, i, 83));
    const x = cx + Math.cos(a) * r * 46 * s;
    const y = cyc + Math.sin(a) * r * 38 * s - (1 - r) * 4 * s;
    const rr = (9 + 7 * h2(seed, i, 85)) * s;
    cl.push(x, y, rr);
  }
  // Low clumps round the limbs, so the crown sits on its branches.
  for (let i = 0; i < 5; i++) cl.push(cx + (i - 2) * 11 * s, tTop - (12 + 6 * h2(seed, i, 91)) * s, (8 + 3 * h2(seed, i, 93)) * s);
  const x0 = cx - 60 * s;
  const y0 = Math.max(0, cyc - 54 * s);
  const shadeK = o.shade ?? 0;
  // The clumps that reach each art row (the fill runs row by row): fewer tests per art px.
  let rowY = -1;
  const cand: number[] = [];
  p.fill(x0, y0, 120 * s, tTop - y0 + 14 * s, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    if (Y !== rowY) {
      rowY = Y;
      cand.length = 0;
      for (let i = 0; i < cl.length; i += 3) if (Math.abs(y - cl[i + 1]) < cl[i + 2] * 0.85) cand.push(i);
    }
    let best = 0;
    let bi = -1;
    for (let j = 0; j < cand.length; j++) {
      const i = cand[j];
      const dx = (x - cl[i]) / cl[i + 2];
      const dy = (y - cl[i + 1]) / (cl[i + 2] * 0.85);
      const q = 1 - (dx * dx + dy * dy);
      if (q > best) {
        best = q;
        bi = i;
      }
    }
    if (bi < 0) return 0;
    // Gaps only between and at the rims of the clumps (where `best` is low), shaped by a smooth noise
    // at 3–4 px, so the light comes through in clustered openings (no holes inside a clump).
    const gap = noise2(x, y, 3.5 * Math.max(0.6, s), seed + 87);
    if (best < 0.4 && gap < 0.66 - best * 1.7) return 0;
    // A few clustered openings where clumps meet inside the crown (the sky and the roofs show through).
    if (best < 0.75 && noise2(x, y, 4 * Math.max(0.6, s), seed + 90) < 0.36 - best * 0.3) return 0;
    const dx = (x - cl[bi]) / cl[bi + 2];
    const dy = (y - cl[bi + 1]) / cl[bi + 2];
    // Light from the upper left on each clump, the whole crown darker below and right.
    const lit = -dx * 0.55 - dy * 0.75;
    const whole = -((x - cx) / (50 * s)) * 0.25 - ((y - cyc) / (40 * s)) * 0.3;
    let t = 0.48 + lit * 0.32 + whole + best * 0.15 - shadeK;
    // Leaf clusters: a smooth grain (no per-px noise).
    if (d >= 2) t += (noise2(x, y, 1.6 * Math.max(0.6, s), seed + 86) - 0.5) * (d >= 4 ? 0.3 : 0.2);
    // The first yellow leaves: 2 × 2 clusters on the lit tops of the clumps, ragged at 2× / 4×.
    if (lit > 0.3 && t > 0.58 && h2(Math.floor(x / 2), Math.floor(y / 2), seed + 89) < 0.09 && (d === 1 || noise2(x, y, 0.8, seed + 88) > 0.38)) return yellow[Math.min(2, Math.floor(t * 2.2))];
    return lf(leaves, Math.min(0.86, t));
  });
}

// ------------------------------------------------------------------------------------ waste, power, bins

function drawWasteColumn(p: Pen): void {
  const d = p.d;
  const gr = litLad('stone', d, 0, 4, 0.08);
  cyl(p, 1.5, 3, 26, 9, gr, 0.3, 0.42);
  p.disc(6, 3, 4.5, 2.4, (_X, _Y, u, v) => (v < 0.3 ? lf(gr, 0.6 - u * 0.25 - v * 0.2) : 0));
  // The flap and three small crosses (our own mark).
  p.rect(3, 6.5, 6, 3, lf(gr, 0.15));
  if (d >= 2) p.rect(3, 6.5, 6, 1 / d, lf(gr, 0.05));
  const xc = lf(gr, 0.8);
  for (let i = 0; i < 3; i++) {
    const y = 12.5 + i * 3;
    const st = d >= 2 ? 1 / d : 1;
    if (d === 1) {
      p.rect(5.5, y, 1, 1, xc);
      continue;
    }
    for (let k = 0; k < 3 * (d / 2); k++) {
      p.rect(4.9 + k * st, y + k * st, st, st, xc);
      p.rect(6.9 - k * st, y + k * st, st, st, xc);
    }
  }
  p.rect(1.5, 25, 9, 1, lf(gr, 0.1));
}

function drawPowerBox(p: Pen): void {
  const d = p.d;
  const gg = ladder([T('oat.green', 1, 2), T('oat.green', 2, 2), T('oat.green', 3, 2), mx(T('oat.green', 3, 2), T('stone', 5, 2), 0.4, 2), mx(T('stone', 5, 2), SUN, 0.2, 2)], 2, d);
  p.rect(1, 2, 10, 18, lf(gg, 0.5));
  p.rect(1, 2, 1.4, 18, lf(gg, 0.8));
  p.rect(9.6, 2, 1.4, 18, lf(gg, 0.2));
  p.rect(0.6, 1, 10.8, 1.4, lf(gg, 0.9));
  if (d >= 2) {
    p.rect(6, 3.5, 1 / d, 15, lf(gg, 0.15));
    for (let k = 0; k < 4; k++) p.rect(2.8, 4 + k * 1.2, 2.4, 0.5, lf(gg, 0.15));
    // Stickers (invented: a round one, a strip, a torn corner).
    p.disc(4, 12, 1.4, 1.4, T('gold', 5, d));
    p.rect(3.2, 11.6, 1.6, 0.6, T('ink', 1, d));
    p.rect(7.2, 9, 2, 3, mx(T('pink', 4, 2), SKY_CAST, 0.25, d));
    p.rect(7, 15.5, 2.6, 1.2, T('snow', 5, d));
  }
  p.rect(1, 19.4, 10, 0.6, lf(gg, 0.05));
}

/** The city's dark grey street bin (100 L / 200 L), our own mark; shootable: outline A (reg). */
function drawBin(p: Pen, big: boolean): void {
  const d = p.d;
  const w = p.w;
  const h = p.h;
  const gr = litLad('stone', d, 0, 4, 0.1);
  const x0 = 1.5;
  const x1 = w - 1.5;
  const top = big ? 3.4 : 4.2;
  // The body tapers a little toward the foot.
  p.poly(
    [
      [x0, top],
      [x1, top],
      [x1 - 0.6, h - 1],
      [x0 + 0.6, h - 1],
    ],
    (X) => {
      const t = (X / d - x0) / (x1 - x0);
      return lf(gr, t < 0.25 ? 0.5 + t * 1.2 : 0.8 - t * 0.6);
    },
  );
  // The lid: a dome (100 L) or a flat lid with a flap (200 L).
  if (big) {
    p.rect(x0 - 0.4, top - 2, x1 - x0 + 0.8, 2.2, lf(gr, 0.62));
    p.rect(x0 - 0.4, top - 2, x1 - x0 + 0.8, 1 / d, lf(gr, 0.95));
    p.rect(x0 + 2, top + 1.2, x1 - x0 - 4, 2.6, T('ink', 1, d));
  } else {
    p.disc((x0 + x1) / 2, top, (x1 - x0) / 2 + 0.3, 2.8, (_X, _Y, u, v) => (v < 0.05 ? lf(gr, 0.62 - u * 0.25 - v * 0.2) : 0));
    p.rect(x0 + 2.4, top + 1, x1 - x0 - 4.8, 2.4, T('ink', 1, d));
  }
  // Seams and the mark: a light disc with a wave (our city mark, never the arms).
  if (d >= 2) {
    p.rect(x0, top + 5.4, x1 - x0, 1 / d, lf(gr, 0.15));
    p.rect(x0, h - 3.2, x1 - x0, 1 / d, lf(gr, 0.15));
  }
  const mcx = (x0 + x1) / 2;
  const mcy = top + (big ? 10 : 9);
  p.disc(mcx, mcy, 2.4, 2.4, lf(gr, 0.9));
  if (d >= 2) {
    p.rect(mcx - 1.4, mcy - 0.2, 2.8, 0.6, lf(gr, 0.25));
    p.rect(mcx - 1, mcy + 0.8, 2, 0.4, lf(gr, 0.35));
  }
  // A sticker and grime at the foot (wear).
  if (d >= 2) {
    p.rect(x1 - 4, top + 6.5, 2, 1.4, mx(T('orange', 4, 2), SKY_CAST, 0.3, d));
    p.rect(x0 + 0.6, h - 2.4, x1 - x0 - 1.2, 1.2, mx(lf(gr, 0.2), T('brown', 2, 2), 0.4, d));
  }
}

// ------------------------------------------------------------------------------------ registration

const G = (w: number, h: number, ox: number, oy: number): { w: number; h: number; ox: number; oy: number } => ({ w, h, ox, oy });

reg('decor/oat/a/paal', [G(4, 16, 2, 16)], (p) => drawPaal(p));
reg('decor/oat/a/staple', [G(26, 18, 13, 18)], (p) => drawStaple(p));
const BIKES: readonly BikeKind[] = ['black', 'blue-crate', 'child-seat', 'rusty'];
BIKES.forEach((k, i) => reg(`decor/oat/a/bike-${i + 1}`, [G(38, 24, 19, 24)], (p) => drawBike(p, 0, 24, k)));
reg('decor/oat/a/lantern', [G(12, 90, 6, 90)], (p) => drawLantern(p, 6, 90));
reg('decor/oat/a/span-lamp', [G(48, 64, 24, 64)], (p) => drawSpanLamp(p));
for (const [slug, name] of PLATES) {
  const g = OAT_A_PLATES[slug];
  reg(g.id, [G(g.w, g.h, 0, g.h)], (p) => drawPlate(p, name));
}
for (let v = 1; v <= 7; v++) reg(`decor/oat/a/hanging-sign-${v}`, [G(24, 22, 0, 0)], (p) => drawHangingSign(p, v));
reg('decor/oat/a/chalkboard', [G(12, 18, 6, 18)], (p) => drawChalkboard(p));
reg('decor/oat/a/plant-1', [G(10, 16, 5, 16)], (p) => drawPlant(p, 1));
reg('decor/oat/a/plant-2', [G(10, 16, 5, 16)], (p) => drawPlant(p, 2));
reg('decor/oat/a/cafe-chair', [G(10, 18, 5, 18)], (p) => drawChair(p));
reg('decor/oat/a/flag-1', [G(22, 16, 0, 0)], (p) => drawFlag(p, 1));
reg('decor/oat/a/flag-2', [G(22, 16, 0, 0)], (p) => drawFlag(p, 2));
reg('decor/oat/a/elm-1', [G(120, 168, 60, 168)], (p) => drawElm(p, 60, 168, 0x51a7));
reg('decor/oat/a/elm-2', [G(120, 168, 60, 168)], (p) => drawElm(p, 60, 168, 0x2c93));
reg('decor/oat/a/waste-column', [G(12, 26, 6, 26)], (p) => drawWasteColumn(p));
reg('decor/oat/a/power-box', [G(12, 20, 6, 20)], (p) => drawPowerBox(p));
reg('decor/oat/a/bin-100', [G(16, 22, 8, 22)], (p) => drawBin(p, false), { hittable: true });
reg('decor/oat/a/bin-200', [G(18, 26, 9, 26)], (p) => drawBin(p, true), { hittable: true });

/** The tone at fraction t of a PAL_HD / oat ramp (re-export for the other art files). */
export { F };
