/**
 * The Plechelmus Basilica, exterior (TOWN, wave A; docs/design/oldenzaal.md §10.3; a likeness by eye,
 * never traced): ONE density-generic drawer for the tower and one for the whole church, used by
 * the town's backgrounds at every density.
 *
 * - `drawTower`: the tall square Romanesque tower of grey-brown Bentheimer sandstone (weathered,
 *   darker streaks, block courses), in stacked tiers set back a little each: the base tier with a
 *   blind arcade of tall shallow round arches and corner lesenes, then two tiers of round-arched
 *   bays (paired openings under a blind arch), the belfry with three tall round-arched openings
 *   (tracery, louvres), a corbel table of small round arches under every string course; the low
 *   slate pyramid roof, the small lantern with its clock and the little spire with a ball and a
 *   cross. Light: the cold sky ambient, a warm rim on the sun side (dusk), `air` haze for far
 *   versions.
 * - `drawBasilica`: the tower and the Gothic nave's long side (four bays of tall pointed tracery
 *   windows, stepped buttresses, a plinth, the steep slate roof with small pointed dormers and
 *   finials, the two red pointed-arch doors). The near version for Plechelmusplein (oz-c, wave B).
 *
 * Background generators (registered here): `oz-tower` (one tower; params `x` left edge px, `base`
 * y px of its foot, `s` px per unit, `light`, `air`) and `oz-basilica` (the church; params `x`,
 * `base`, `s`, `light`). Both draw with no ink (backgrounds are painted) and leave the rest clear.
 */
import type { Color } from '../../../../engine/color';
import { archPointed, archRound, dq, F, h2, num, ozLight, pick, regBg, snap, T, tones, type Dn, type OzLight, type Pen } from './art-kit';

/** How the stone is seen: the haze colour and amount, the warm rim on the sun side (0 = none), the mood. */
export interface StoneLook {
  air: Color;
  t: number;
  rim: Color;
  light: OzLight;
}

/** The tower's height in units (foot to the cross's top). */
export const TOWER_UNITS = 40.4;
/** The tower body's width in units. */
export const TOWER_W = 10;

interface Ctx {
  p: Pen;
  d: Dn;
  st: readonly Color[];
  sl: readonly Color[];
  look: StoneLook;
  s: number;
  seed: number;
}

/** The weathered sandstone face shader at tone `k0` (block courses, dark streaks, grain). */
function face(c: Ctx, k0: number): (X: number, Y: number) => Color {
  const { d, s, st, seed } = c;
  const course = Math.max(1, Math.round(0.55 * s * d));
  return (X: number, Y: number): Color => {
    const x = X / d;
    const col = Math.floor(x / Math.max(0.6, s * 0.45));
    let k = k0 + (h2(col, Math.floor(Y / (course * 3)), seed + 3) - 0.5) * 0.8;
    // Dark weather streaks running down from the ledges.
    const streak = h2(col, 7, seed + 11);
    if (streak > 0.72) k -= (streak - 0.72) * 4 * (0.5 + 0.5 * Math.sin(Y / (d * s * 1.7) + col));
    if (d >= 2 && Y % course === 0) k -= 0.7; // the course joints
    if (d >= 4 && (Math.floor(X / (course * 2.2)) + Math.floor(Y / course)) % 2 === 0 && X % Math.round(course * 2.2) === 0) k -= 0.6;
    if (d >= 4 && h2(X, Y, seed + 5) > 0.94) k -= 0.6;
    return pick(st, dq(k, X, Y, 0.8));
  };
}

/** A rect of face at tone k (logical units from the tower's left x and its foot `base`, y up). */
function block(c: Ctx, x: number, base: number, ux: number, uy: number, uw: number, uh: number, k: number): void {
  const s = c.s;
  c.p.fill(x + ux * s, base - (uy + uh) * s, uw * s, uh * s, face(c, k));
}

/** A string course (ledge): lit top, shadowed underside. */
function ledge(c: Ctx, x: number, base: number, ux: number, uy: number, uw: number): void {
  const { p, s, st, d } = c;
  const y = base - uy * s;
  p.rect(x + ux * s, y - 0.4 * s, uw * s, 0.4 * s, pick(st, 5.2));
  p.rect(x + ux * s, y - 0.4 * s, uw * s, d === 1 ? 1 : Math.max(1 / d, 0.1 * s), pick(st, 6.4));
  p.rect(x + ux * s, y, uw * s, Math.max(1 / d, 0.15 * s), pick(st, 1.2));
}

/** A corbel table: a row of small round arches hanging under a ledge at uy (units), recessed. */
function corbels(c: Ctx, x: number, base: number, ux: number, uy: number, uw: number): void {
  const { p, s, st } = c;
  const n = Math.max(2, Math.round(uw / 0.9));
  const sw = (uw * s) / n;
  const top = base - uy * s;
  for (let i = 0; i < n; i++) archRound(p, x + ux * s + i * sw + sw * 0.18, top + 0.06 * s, sw * 0.64, 0.55 * s, pick(st, 1.6));
}

/** A round-arched opening of depth (dark), its round head at the top: units. */
function opening(c: Ctx, x: number, base: number, ux: number, uy: number, uw: number, uh: number, louvres = false): void {
  const { p, s, d, sl } = c;
  const X0 = x + ux * s;
  const Y0 = base - (uy + uh) * s;
  archRound(p, X0, Y0, uw * s, uh * s, pick(sl, 0.4));
  // The reveal: a lit sill and a lighter inner edge on the left at the dense densities.
  if (d >= 2) p.rect(X0, Y0 + uw * s * 0.5, Math.max(1 / d, 0.12 * s), uh * s - uw * s * 0.5, pick(c.st, 2.2));
  p.rect(X0 - 0.05 * s, base - uy * s - 0.18 * s, uw * s + 0.1 * s, 0.18 * s, pick(c.st, 4.8));
  if (louvres && d >= 2) {
    const step = Math.max(2 / d, 0.45 * s);
    for (let y = Y0 + uw * s * 0.6; y < base - uy * s - 0.3 * s; y += step) p.rect(X0 + 0.15 * s, y, uw * s - 0.3 * s, 1 / d, pick(sl, 1.6));
  }
}

/** A blind arch niche (shallow recess) with its round head: units. */
function niche(c: Ctx, x: number, base: number, ux: number, uy: number, uw: number, uh: number, kDrop = 1.1): void {
  const s = c.s;
  const sh = face(c, 2.9 - kDrop);
  archRound(c.p, x + ux * s, base - (uy + uh) * s, uw * s, uh * s, sh);
  // The arch's lit rim (the voussoirs catch the sky light).
  if (c.d >= 2) {
    const r = (uw * s) / 2;
    const cx = x + ux * s + r;
    const cy = base - (uy + uh) * s + r;
    c.p.disc(cx, cy, r, r, (_X, _Y, u, v) => (v < 0 && u * u + v * v > 0.72 ? pick(c.st, 4.4) : 0));
  }
}

/**
 * The tower: left edge x, foot y `base` (logical px; the foot may be hidden by roofs), s px per
 * unit. Returns the top y of the cross and the clock's centre.
 */
export function drawTower(p: Pen, x: number, base: number, s: number, look: StoneLook, seed: number): { top: number; clock: readonly [number, number] } {
  const d = p.d;
  const c: Ctx = { p, d, st: tones('sandstone', d, look.air, look.t), sl: tones('night', d, look.air, look.t * 0.6), look, s, seed };
  const W = TOWER_W;
  // The tiers (units from the foot): base tier, tier 2, tier 3, belfry; each set back 0.15 u.
  const tiers: ReadonlyArray<readonly [number, number, number]> = [
    [0, 13, 0],
    [13, 18.6, 0.15],
    [18.6, 24.2, 0.3],
    [24.2, 30.6, 0.45],
  ];
  for (const [y0, y1, inset] of tiers) block(c, x, base, inset, y0, W - inset * 2, y1 - y0, 2.9);
  // Base tier: corner lesenes and the blind arcade of tall shallow arches.
  block(c, x, base, 0, 0, 0.7, 13, 3.6);
  block(c, x, base, W - 0.7, 0, 0.7, 13, 2.3);
  for (let i = 0; i < 4; i++) niche(c, x, base, 0.95 + i * 2.05, 0.6, 1.75, 6.2, 0.7);
  for (let i = 0; i < 4; i++) niche(c, x, base, 0.95 + i * 2.05, 7.4, 1.75, 4.3, 0.6);
  // Tiers 2 and 3: three bays of paired openings under a blind arch.
  for (const [y0, , inset] of tiers.slice(1, 3)) {
    const bw = (W - inset * 2 - 0.9) / 3;
    for (let i = 0; i < 3; i++) {
      const bx = inset + 0.45 + i * bw;
      niche(c, x, base, bx + 0.12, y0 + 0.8, bw - 0.24, 4.1, 1.2);
      const ow = (bw - 0.9) / 2;
      opening(c, x, base, bx + 0.35, y0 + 1.0, ow, 2.7);
      opening(c, x, base, bx + 0.55 + ow, y0 + 1.0, ow, 2.7);
    }
  }
  // The belfry: three tall round-arched openings, the middle one wider, with louvres.
  {
    const inset = 0.45;
    const y0 = 24.2;
    opening(c, x, base, inset + 0.55, y0 + 0.9, 2.2, 4.5, true);
    opening(c, x, base, W / 2 - 1.35, y0 + 0.9, 2.7, 4.9, true);
    opening(c, x, base, W - inset - 0.55 - 2.2, y0 + 0.9, 2.2, 4.5, true);
    // The middle opening's tracery: a mullion and a small round light at the top (dense art).
    if (d >= 2) {
      p.rect(x + (W / 2 - 0.08) * s, base - (y0 + 0.9 + 3.6) * s, Math.max(1 / d, 0.16 * s), 3.6 * s, pick(c.st, 3.6));
      p.disc(x + (W / 2) * s, base - (y0 + 5.15) * s, 0.42 * s, 0.42 * s, (_X, _Y, u, v) => (u * u + v * v > 0.45 ? pick(c.st, 3.8) : 0));
    }
  }
  // String courses with the corbel tables under them.
  for (const [, y1, inset] of tiers) {
    corbels(c, x, base, inset + 0.2, y1 - 0.4, W - inset * 2 - 0.4);
    ledge(c, x, base, inset - 0.1, y1, W - inset * 2 + 0.2);
  }
  // The low slate pyramid roof (a trapezoid), the lantern with the clock, the spire, the cross.
  const sl = tones('slate', d, look.air, look.t);
  const ry0 = base - 30.6 * s;
  const ry1 = base - 32.6 * s;
  p.poly(
    [
      [x + 0.4 * s, ry0],
      [x + 3.6 * s, ry1],
      [x + (W - 3.6) * s, ry1],
      [x + (W - 0.4) * s, ry0],
    ],
    (X, Y) => pick(sl, dq(2.2 + ((X / d - x) / (W * s)) * 0.8 + (d >= 4 && Y % 3 === 0 ? -0.6 : 0), X, Y, 0.6)),
  );
  const lx = x + (W / 2 - 1.2) * s;
  const ly1 = base - 35.2 * s;
  p.rect(lx, ly1, 2.4 * s, 2.6 * s, pick(sl, 1.4));
  p.rect(lx, ly1, Math.max(1 / d, 0.2 * s), 2.6 * s, pick(sl, 3));
  p.rect(lx - 0.2 * s, ly1 - 0.25 * s, 2.8 * s, 0.3 * s, pick(sl, 3.4));
  const clock: [number, number] = [x + (W / 2) * s, ly1 + 1.25 * s];
  // The clock face: pale, with two hands at the dense densities (the time is always ten to ten).
  const face0 = look.light === 'night' ? T('candle', 5, d) : F('stone', 0.72, d);
  p.disc(clock[0], clock[1], 0.75 * s, 0.75 * s, (_X, _Y, u, v) => (u * u + v * v > 0.7 ? pick(sl, 0.5) : face0));
  if (d >= 2) {
    p.line(clock[0], clock[1], clock[0] - 0.45 * s, clock[1] - 0.2 * s, snap(T('ink', 1, d), d));
    p.line(clock[0], clock[1], clock[0] + 0.4 * s, clock[1] - 0.3 * s, snap(T('ink', 1, d), d));
  }
  // The spire: a slim pointed roof, a ball and a cross.
  const sy0 = ly1 - 0.25 * s;
  const apex = sy0 - 3.4 * s;
  p.poly(
    [
      [lx + 0.25 * s, sy0],
      [x + (W / 2) * s, apex],
      [lx + 2.15 * s, sy0],
    ],
    (X, Y) => pick(sl, dq(1.4 + ((X / d - lx) / (2.4 * s)) * 1.6, X, Y, 0.6)),
  );
  const gold = F('gold', 0.45, d);
  p.disc(x + (W / 2) * s, apex - 0.2 * s, Math.max(0.6 / d, 0.22 * s), Math.max(0.6 / d, 0.22 * s), gold);
  const ink = snap(T('ink', 1, d), d);
  const cw = Math.max(1 / d, 0.14 * s);
  p.rect(x + (W / 2) * s - cw / 2, apex - 1.5 * s, cw, 1.2 * s, ink);
  p.rect(x + (W / 2 - 0.4) * s, apex - 1.15 * s, 0.8 * s, cw, ink);
  // The warm rim on the sun side (dusk): the right edges of the tiers and the roof.
  if (look.rim && d >= 2) {
    const rim = look.rim;
    for (const [y0, y1, inset] of tiers) p.rect(x + (W - inset) * s - 1 / d, base - y1 * s, 1 / d, (y1 - y0) * s, rim);
    p.line(x + (W - 3.4) * s, ry1, x + (W - 0.2) * s, ry0, rim);
    p.line(x + (W / 2) * s, apex, lx + 2.15 * s, sy0, rim);
  }
  return { top: apex - 1.5 * s, clock };
}

/**
 * The basilica's long side: the tower at x and the Gothic nave to its right (foot y `base`, s px
 * per unit). Returns the doors' centre x (logical px).
 */
export function drawBasilica(p: Pen, x: number, base: number, s: number, look: StoneLook, seed: number): { doorX: number; right: number } {
  const d = p.d;
  const c: Ctx = { p, d, st: tones('sandstone', d, look.air, look.t), sl: tones('night', d, look.air, look.t * 0.6), look, s, seed: seed + 17 };
  const nx = x + (TOWER_W + 0.6) * s; // the nave's left (after the stair turret)
  const BAYS = 4;
  const BW = 10;
  const WALL = 12;
  const ROOF = 9.5;
  const L = BAYS * BW;
  const right = nx + L * s;
  // The steep slate roof: a slab from the eaves to the ridge, hipped at the right end.
  const sl = tones('slate', d, look.air, look.t);
  const ey = base - WALL * s;
  const ry = ey - ROOF * s;
  p.poly(
    [
      [nx - 1.2 * s, ey],
      [nx - 1.2 * s, ry],
      [right - 4 * s, ry],
      [right + 0.6 * s, ey],
    ],
    (X, Y) => {
      const v = (Y / d - ry) / (ey - ry);
      let k = (look.light === 'night' ? 2.6 : 1.8) + v * 1.2 - (look.light === 'night' && v < 0.08 ? -1.2 : 0);
      if (d >= 2 && Math.floor(Y / Math.max(1, Math.round(0.5 * s * d))) % 2 === 0 && h2(Math.floor(X / Math.max(1, Math.round(0.7 * s * d))), Math.floor(Y / Math.max(1, Math.round(0.5 * s * d))), seed) > 0.8) k += 0.6;
      return pick(sl, dq(k, X, Y, 0.7));
    },
  );
  // Ridge finials and the small pointed dormers on the roof.
  for (let i = 0; i < 3; i++) {
    const fx = nx + (6 + i * 13) * s;
    p.rect(fx - 0.12 * s, ry - 1.2 * s, Math.max(1 / d, 0.24 * s), 1.2 * s, pick(sl, 3));
  }
  for (let i = 0; i < 3; i++) {
    const dx = nx + (8 + i * 12) * s;
    const dy = ey - (2.5 + (i % 2) * 2) * s;
    p.rect(dx - 0.8 * s, dy - 1.4 * s, 1.6 * s, 1.4 * s, pick(sl, 0.8));
    p.rect(dx - 0.5 * s, dy - 1.2 * s, 1 * s, 1 * s, pick(c.sl, 0.6));
    p.poly(
      [
        [dx - 1 * s, dy - 1.4 * s],
        [dx, dy - 3.8 * s],
        [dx + 1 * s, dy - 1.4 * s],
      ],
      (X) => pick(sl, X / d < dx ? 2.6 : 1.3),
    );
  }
  // The wall, the eaves course and the plinth.
  block(c, x, base, TOWER_W, 0, L + 0.6, WALL, 2.7);
  // The stair turret between the tower and the nave.
  block(c, x, base, TOWER_W - 0.1, 0, 1.4, WALL + 2, 3.3);
  ledge(c, x, base, (nx - x) / s - 1, WALL, L + 1.2);
  block(c, x, base, (nx - x) / s - 0.6, 0, L + 0.6, 1.4, 3.6);
  ledge(c, x, base, (nx - x) / s - 0.6, 1.4, L + 0.6);
  // Four bays: a tall pointed tracery window each (the third bay: the red doors under a shorter
  // window), stepped buttresses between them.
  let doorX = 0;
  for (let b = 0; b < BAYS; b++) {
    const bx = nx + b * BW * s;
    const door = b === 2;
    const wx = bx + 3 * s;
    const ww = 4.2 * s;
    const wy = base - (door ? 11 : 11.2) * s;
    const wh = (door ? 5.6 : 9) * s;
    // The splayed reveal, then the glass with its tracery.
    archPointed(p, wx - 0.35 * s, wy - 0.35 * s, ww + 0.7 * s, wh + 0.35 * s, pick(c.st, 1.8));
    const glass = c.sl;
    archPointed(p, wx, wy, ww, wh, (X, Y) => {
      const g = 0.6 + (h2(Math.floor(X / Math.max(1, d * 0.8 * s)), Math.floor(Y / Math.max(1, d * 0.9 * s)), seed + b) > 0.7 ? 0.8 : 0);
      return pick(glass, dq(g, X, Y, 0.5));
    });
    const mull = pick(c.st, 3.8);
    const mw = Math.max(1 / d, 0.18 * s);
    for (let m = 1; m <= 3; m++) p.rect(wx + (ww * m) / 4 - mw / 2, wy + ww * 0.62, mw, wh - ww * 0.62, mull);
    if (d >= 2) {
      // The tracery head: two small pointed lights and a round light over them.
      p.disc(wx + ww / 2, wy + ww * 0.42, ww * 0.2, ww * 0.2, (_X, _Y, u, v) => (u * u + v * v > 0.55 ? mull : 0));
      p.rect(wx, wy + ww * 0.62, ww, mw, mull);
    }
    if (door) {
      doorX = bx + 5 * s;
      // The doors: two narrow pointed arches in a stone surround, painted red.
      const dyTop = base - 5.2 * s;
      archPointed(p, bx + 2.6 * s, dyTop - 0.3 * s, 4.8 * s, 5.5 * s, pick(c.st, 4.2));
      const red = tones('red', d, look.air, look.t);
      for (let k = 0; k < 2; k++) {
        const dx = bx + (3 + k * 2.1) * s;
        archPointed(p, dx, dyTop, 1.8 * s, 5.2 * s, (X, Y) => pick(red, dq(2.4 + (d >= 4 && X % Math.max(1, Math.round(0.6 * s * d)) === 0 ? -0.8 : 0), X, Y, 0.5)));
        if (d >= 2) p.rect(dx + 1.3 * s, base - 2.6 * s, Math.max(1 / d, 0.2 * s), Math.max(1 / d, 0.2 * s), F('gold', 0.4, d));
      }
    }
    // The buttress at the bay's right edge (stepped: two set-offs with sloped weatherings).
    {
      const ux = (bx - x) / s + BW - 0.8;
      block(c, x, base, ux, 0, 1.6, 7, 3.5);
      block(c, x, base, ux + 0.2, 7, 1.2, 3.4, 3.4);
      block(c, x, base, ux + 0.35, 10.4, 0.9, 2.6, 3.3);
      for (const [yy, ww2, off] of [[7, 1.6, 0], [10.4, 1.2, 0.2]] as const) {
        const X0 = x + (ux + off) * s;
        p.poly(
          [
            [X0, base - yy * s],
            [X0 + ww2 * s, base - yy * s],
            [X0 + ww2 * s, base - (yy + 0.7) * s],
          ],
          pick(c.st, 5),
        );
      }
      p.rect(x + (ux + 1.6) * s, base - 7 * s, Math.max(1 / d, 0.18 * s), 7 * s, pick(c.st, 1.4));
    }
  }
  drawTower(p, x, base, s, look, seed);
  return { doorX, right };
}

/** The look of the stone in a mood (`air` = the haze colour, `t` its amount). */
export function stoneLook(light: OzLight, air: number, d: Dn): StoneLook {
  if (light === 'night') return { air: T('night', 3, 2), t: air, rim: 0, light };
  if (light === 'late') return { air: T('dusk', 2, 2), t: air, rim: d >= 2 ? T('dusk', 4, d) : 0, light };
  return { air: T('dusk', 3, 2), t: air, rim: d >= 2 ? T('dusk', 6, d) : 0, light };
}

regBg('oz-tower', (p, params, seed) => {
  const light = ozLight(params);
  const s = num(params, 's', 3);
  drawTower(p, num(params, 'x', 8), num(params, 'base', p.h), s, stoneLook(light, num(params, 'air', 0.35), p.d), seed);
});

regBg('oz-basilica', (p, params, seed) => {
  const light = ozLight(params);
  drawBasilica(p, num(params, 'x', 24), num(params, 'base', 176), num(params, 's', 4.4), stoneLook(light, num(params, 'air', 0.12), p.d), seed);
});
