/**
 * The shopping street of Oldenzaal (TOWN, wave A; docs/design/oldenzaal.md §10.3, §2): the shop
 * fronts and the street furniture, ONE density-generic drawer per id (art-kit.ts `reg`: 1×, 2× and
 * 4× from the same shapes, so every dense frame has its 1× size, anchor and footprint). Static
 * decor: outline C; painted at dusk (a cold grade over every material, dark glass, closed shutters).
 *
 * Sprites (`decor/oz/…`):
 * - `decor/oz/shop` — the shop fronts, one frame per `SHOPS` entry (anchor bottom-left, the foot on
 *   the street line): Dutch brick and plastered fronts of two or three storeys, a shop on the ground
 *   floor (sign board in our own pixel lettering with a made-up or generic shop name, shutters
 *   down, a grille or a dark display, a recessed door and the narrow door to the floors above),
 *   white-framed sash windows with lintels and sills (dark, a rare warm one), a cornice, and an
 *   eaves roof with a dormer, a gable, a stepped gable, a flat parapet with a date stone or a
 *   mansard. A `bay` front has a first-floor bay window whose flat roof is a platform
 *   (`shopBayTop`).
 * - `decor/oz/awning` — shop awnings over the platforms (anchor top-left at the platform line):
 *   frames by `AWNING_WIDTHS` × `AWNING_COLOURS`.
 * - `decor/oz/balcony` — a stone balcony slab with an iron railing (anchor top-left at the slab
 *   top = the platform line): frames by `BALCONY_WIDTHS`.
 * - `decor/oz/lamp` — the tall black DOUBLE street lamp with a hanging flower basket (anchor at
 *   its foot; frame 0 lit, 1 unlit). `LAMP_HEADS`: the two lamp heads relative to the foot.
 * - `decor/oz/signpost` — the black signpost with four boards (MUSEUM, PLECHELMUSBASILIEK,
 *   STADHUIS, GANZENMARKT; lines.ts `SIGNPOST`), anchor at the pole's foot.
 * - `decor/oz/bike-rack` (front decor: hoops and two parked bikes), `decor/oz/bench`,
 *   `decor/oz/bin`, `decor/oz/planter` (flowers on a low wall's top), `decor/oz/bollard` (front).
 */
import type { Color } from '../../../../engine/color';
import { SIGNPOST } from './lines';
import { dq, F, h2, outlineC, pick, reg, snap, T, tinyText, tinyWidth, tones, type Dn, type FrameGeom, type Pen, type Rn } from './art-kit';

/** The street line (feet y) in the frames: the frames' bottom. */
const COLD = T('night', 3, 2);
/** The cold dusk grade over every near material (desaturated, a little blue). */
export const GRADE = 0.2;

/** Graded tones of a ramp at d. */
function gt(n: Rn, d: Dn, t = GRADE): readonly Color[] {
  return tones(n, d, COLD, t);
}

// ============================================================================================
// Shop fronts
// ============================================================================================

export type WallKind = 'red' | 'dark' | 'brown' | 'plaster' | 'grey' | 'cream';
export type RoofKind = 'eaves' | 'gable' | 'step' | 'flat' | 'mansard';
export type ShutKind = 'down' | 'half' | 'grille' | 'dark';

export interface ShopSpec {
  readonly w: number;
  /** Storeys including the shop (2 or 3). */
  readonly floors: 2 | 3;
  readonly wall: WallKind;
  readonly roof: RoofKind;
  /** The sign's text (generic or made up, never a real business). */
  readonly sign: string;
  readonly board: Rn;
  readonly shutter: ShutKind;
  readonly seed: number;
  /** A first-floor bay window with a flat roof (a platform). */
  readonly bay?: boolean;
  /** The door on the left (default) or the right of the shop window. */
  readonly door?: 'l' | 'r';
}

/** Ground floor (the shop) and upper storey heights, the cornice (logical px). */
export const SHOP_GF = 40;
export const SHOP_FL = 24;
const CORNICE = 4;

const WALL_RAMP: Readonly<Record<WallKind, readonly [Rn, number, boolean]>> = {
  red: ['brick', 2.6, true],
  dark: ['brickDark', 3.1, true],
  brown: ['brown', 2.7, true],
  plaster: ['plaster', 3.1, false],
  grey: ['stone', 3.3, false],
  cream: ['sand', 3.6, false],
};

/** The street's shop fronts (frame index = index here). Names are generic Dutch shop words. */
export const SHOPS: readonly ShopSpec[] = [
  { w: 56, floors: 3, wall: 'red', roof: 'eaves', sign: 'BAKKERIJ', board: 'green', shutter: 'half', seed: 1 },
  { w: 48, floors: 2, wall: 'dark', roof: 'step', sign: 'SLAGERIJ', board: 'red', shutter: 'down', seed: 2, door: 'r' },
  { w: 64, floors: 3, wall: 'plaster', roof: 'flat', sign: 'BOEKHANDEL', board: 'navy', shutter: 'grille', seed: 3, bay: true },
  { w: 52, floors: 3, wall: 'brown', roof: 'gable', sign: 'OPTIEK', board: 'black', shutter: 'dark', seed: 4, door: 'r' },
  { w: 44, floors: 2, wall: 'red', roof: 'eaves', sign: 'KAPPER', board: 'navy', shutter: 'down', seed: 5 },
  { w: 60, floors: 3, wall: 'grey', roof: 'mansard', sign: 'DROGIST', board: 'green', shutter: 'half', seed: 6, door: 'r' },
  { w: 56, floors: 2, wall: 'dark', roof: 'gable', sign: 'SCHOENEN', board: 'red', shutter: 'grille', seed: 7 },
  { w: 48, floors: 3, wall: 'red', roof: 'step', sign: 'BLOEMEN', board: 'green', shutter: 'down', seed: 8, door: 'r' },
  { w: 60, floors: 3, wall: 'brown', roof: 'eaves', sign: 'IJZERWAREN', board: 'black', shutter: 'half', seed: 9, bay: true },
  { w: 52, floors: 2, wall: 'cream', roof: 'flat', sign: 'JUWELIER', board: 'navy', shutter: 'grille', seed: 10, door: 'r' },
  { w: 56, floors: 3, wall: 'dark', roof: 'eaves', sign: 'SPEELGOED', board: 'red', shutter: 'down', seed: 11 },
  { w: 44, floors: 2, wall: 'plaster', roof: 'gable', sign: 'KOFFIE', board: 'black', shutter: 'dark', seed: 12, door: 'r' },
  { w: 52, floors: 3, wall: 'red', roof: 'gable', sign: 'APOTHEEK', board: 'green', shutter: 'grille', seed: 13, door: 'r' },
  { w: 48, floors: 2, wall: 'brown', roof: 'eaves', sign: 'MUZIEK', board: 'navy', shutter: 'down', seed: 14 },
  { w: 56, floors: 3, wall: 'dark', roof: 'flat', sign: 'FOTO', board: 'black', shutter: 'half', seed: 15, door: 'r', bay: true },
  { w: 44, floors: 3, wall: 'cream', roof: 'step', sign: 'SPORT', board: 'red', shutter: 'down', seed: 16 },
  { w: 60, floors: 2, wall: 'grey', roof: 'eaves', sign: 'HOEDEN', board: 'red', shutter: 'dark', seed: 17, door: 'r' },
  { w: 52, floors: 3, wall: 'red', roof: 'mansard', sign: 'KLOKKEN', board: 'black', shutter: 'grille', seed: 18 },
];

/** Shop frame indices by name (layouts). */
export const SHOP = {
  bakkerij: 0,
  slagerij: 1,
  boekhandel: 2,
  optiek: 3,
  kapper: 4,
  drogist: 5,
  schoenen: 6,
  bloemen: 7,
  ijzerwaren: 8,
  juwelier: 9,
  speelgoed: 10,
  koffie: 11,
  apotheek: 12,
  muziek: 13,
  foto: 14,
  sport: 15,
  hoeden: 16,
  klokken: 17,
} as const;

function roofH(s: ShopSpec): number {
  switch (s.roof) {
    case 'eaves':
      return 18;
    case 'gable':
      return Math.round(s.w * 0.44) + 2;
    case 'step':
      return Math.round(s.w * 0.48) + 2;
    case 'flat':
      return 12;
    case 'mansard':
      return 18;
  }
}

/** Height of the walls (street to the cornice's top). */
export function shopWallH(s: ShopSpec): number {
  return SHOP_GF + (s.floors - 1) * SHOP_FL + CORNICE;
}

/** The frame's logical size: w × (walls + roof). */
export function shopGeom(s: ShopSpec): FrameGeom {
  const h = shopWallH(s) + roofH(s);
  return { w: s.w, h, ox: 0, oy: h };
}

/** The bay window's flat roof: its x range and y above the street line (feet y = G − this). */
export function shopBayTop(s: ShopSpec): { x0: number; w: number; up: number } | null {
  if (!s.bay) return null;
  const bw = Math.round(s.w * 0.62);
  return { x0: Math.round((s.w - bw) / 2), w: bw, up: SHOP_GF + SHOP_FL - 2 };
}

/** The top of the shop sign (y above the street line): awnings hang just under it. */
export const SHOP_SIGN_UP = SHOP_GF - 2;

/** A sash window with a white frame: (x, y) top-left, w × h, lit 0 (dark) … 2 (warm). */
function sash(p: Pen, x: number, y: number, w: number, h: number, seed: number, lit: number, curtain: boolean): void {
  const d = p.d;
  const frame = gt('cloth', d, 0.32);
  const glass = gt('night', d, 0.05);
  const warm = tones('candle', d);
  const dusk = gt('dusk', d, 0.1);
  p.rect(x, y, w, h, pick(frame, 3.2));
  const gx = x + 1;
  const gy = y + 1;
  const gw = w - 2;
  const gh = h - 2;
  p.fill(gx, gy, gw, gh, (X, Y) => {
    const u = (X + 0.5) / d - gx;
    const v = (Y + 0.5) / d - gy;
    if (lit > 0) return pick(warm, dq(lit === 2 ? 3.6 - v / gh : 2.4 - v / gh, X, Y, 0.8));
    // Dark glass: the dusk sky's reflection as one diagonal band, deeper at the bottom.
    const band = (u + v * 0.7 + (seed % 5)) % (gw + gh);
    if (band > gw * 0.35 && band < gw * 0.35 + 1.1) return pick(dusk, 2);
    return pick(glass, dq(1.6 - v / gh, X, Y, 0.8));
  });
  if (curtain) {
    const cl = lit > 0 ? tones('candle', d)[2] : pick(gt('red', d, 0.4), 1.4);
    p.rect(gx, gy, Math.max(1, gw * 0.3), gh, cl);
    p.rect(gx + gw - Math.max(1, gw * 0.3), gy, Math.max(1, gw * 0.3), gh, cl);
  }
  // The sash bars: the meeting rail and a mullion (a cross), one art px at the dense densities.
  const bar = pick(frame, 4);
  const t = d === 1 ? 1 : Math.max(1 / d, 0.5);
  p.rect(gx, gy + gh * 0.48, gw, t, bar);
  p.rect(gx + gw / 2 - t / 2, gy, t, gh, bar);
  if (d >= 2) {
    // The frame's light: a lit left / top edge, a shaded right / bottom inner edge.
    p.rect(x, y, w, 1 / d, pick(frame, 5));
    p.rect(x, y, 1 / d, h, pick(frame, 5));
    p.rect(gx, gy, gw, 1 / d, pick(frame, 1.6));
  }
}

/** Lintel over and sill under a window (stone or plaster). */
function lintelSill(p: Pen, x: number, y: number, w: number, h: number, stone: readonly Color[], arch: boolean): void {
  const d = p.d;
  if (arch) {
    p.disc(x + w / 2, y, w / 2 + 1.5, 3, (_X, _Y, _u, v) => (v < 0 ? pick(stone, v < -0.6 ? 4.6 : 3.6) : 0));
  } else {
    p.rect(x - 1, y - 2.5, w + 2, 2.5, pick(stone, 3.6));
    if (d >= 2) p.rect(x - 1, y - 2.5, w + 2, 1 / d, pick(stone, 5));
  }
  p.rect(x - 1, y + h, w + 2, 1.5, pick(stone, 4));
  p.rect(x - 1, y + h + 1.5, w + 2, d === 1 ? 1 : 0.75, pick(stone, 1));
}

/** The wall shader of a front (brick courses or plaster with rustication). */
function wallShader(p: Pen, s: ShopSpec): (X: number, Y: number) => Color {
  const d = p.d;
  const [n, k0, brick] = WALL_RAMP[s.wall];
  const t = gt(n, d);
  const mortar = pick(gt('stone', d, 0.35), d === 1 ? 1 : 1.6);
  if (brick) {
    const bw = 6 * d;
    const bh = 3 * d;
    return (X, Y) => {
      const row = Math.floor(Y / bh);
      const xx = X + (row & 1 ? bw >> 1 : 0) + s.seed * 3 * d;
      const col = Math.floor(xx / bw);
      const u = xx - col * bw;
      const v = Y - row * bh;
      const hb = h2(col, row, s.seed);
      if (d === 1) {
        // Calm at 1×: one tone, a mortar course every other row, a few darker bricks.
        if (v === bh - 1 && row % 2 === 0) return mortar;
        return pick(t, k0 + (hb > 0.86 ? -1 : hb < 0.06 ? 0.8 : 0));
      }
      if (v >= bh - 1 || u < (d >= 4 ? 1 : 0) || (d === 2 && u === 0 && row % 2 === 0)) return mortar;
      let k = k0 + (hb - 0.5) * 0.8;
      if (v === 0) k += 0.5;
      if (d >= 4 && h2(X, Y, s.seed + 9) > 0.93) k -= 0.6;
      // Soot and damp on some brick columns.
      if (d >= 4 && h2(col, 3, s.seed + 1) > 0.88) k -= 0.4;
      return pick(t, k);
    };
  }
  return (X, Y) => {
    if (d === 1) return pick(t, k0 + (h2(X >> 3, Y >> 2, s.seed) > 0.9 ? -0.6 : 0));
    let k = k0 + (noise(X, Y, d, s.seed) - 0.5) * 0.5;
    if (h2(X >> 2, Y >> 3, s.seed) > 0.93) k -= 0.4;
    return pick(t, dq(k, X, Y, 0.6));
  };
}

function noise(X: number, Y: number, d: number, seed: number): number {
  const x = X / d;
  const y = Y / d;
  return (h2(Math.floor(x / 5), Math.floor(y / 4), seed) * 0.6 + h2(Math.floor(x / 2), Math.floor(y / 2), seed + 3) * 0.4);
}

/** Draw a shop front (frame of `shopGeom(s)`). */
function drawShop(p: Pen, s: ShopSpec): void {
  const d = p.d;
  const W = s.w;
  const H = p.h;
  const wallTop = H - shopWallH(s);
  const stone = gt('sandstone', d, 0.1);
  const plasterTrim = gt('plaster', d, 0.25);
  const trim = WALL_RAMP[s.wall][2] ? stone : plasterTrim;
  const shade = wallShader(p, s);

  // ---- the roof (behind the walls' top)
  drawRoof(p, s, wallTop, shade, trim);

  // ---- the walls
  p.fill(0, wallTop, W, H - wallTop, shade);

  // ---- the cornice: a moulded band with dentils, brackets at the ends
  const cy = wallTop;
  p.rect(0, cy, W, CORNICE, pick(trim, 3.4));
  p.rect(0, cy, W, d === 1 ? 1 : 0.75, pick(trim, 5));
  p.rect(0, cy + CORNICE - 1, W, 1, pick(trim, 1.4));
  if (d >= 2) for (let x = 1; x < W - 1; x += 2) p.rect(x, cy + 1.5, 1, 1, pick(trim, 2.4));
  p.rect(0, cy + CORNICE, 2, 3, pick(trim, 3));
  p.rect(W - 2, cy + CORNICE, 2, 3, pick(trim, 2.2));

  // ---- the upper storeys: windows with lintels and sills
  const n = Math.max(1, Math.floor((W - 6) / 15));
  const ww = 9;
  const wh = 15;
  const gap = (W - n * ww) / (n + 1);
  for (let f = 1; f < s.floors; f++) {
    const fy = H - SHOP_GF - f * SHOP_FL;
    for (let i = 0; i < n; i++) {
      const wx = Math.round(gap + i * (ww + gap));
      const wy = fy + 5;
      const r = h2(i, f, s.seed + 40);
      const lit = r > 0.9 ? 1 : 0;
      lintelSill(p, wx, wy, ww, wh, trim, (s.seed + f) % 3 === 0);
      sash(p, wx, wy, ww, wh, s.seed + i + f, lit, r > 0.55 && r < 0.75);
    }
  }
  // A bay window on the first floor: a box of three windows, its flat lead roof a platform.
  const bay = shopBayTop(s);
  if (bay) {
    const by1 = H - SHOP_GF;
    const by0 = H - bay.up;
    const bx = bay.x0;
    p.rect(bx, by0, bay.w, by1 - by0, pick(trim, 3.2));
    if (d >= 2) p.rect(bx, by0, 1, by1 - by0, pick(trim, 4.4));
    p.rect(bx + bay.w - 1, by0, 1, by1 - by0, pick(trim, 1.6));
    const bww = (bay.w - 8) / 3;
    for (let i = 0; i < 3; i++) sash(p, bx + 2 + i * (bww + 2), by0 + 4, bww, by1 - by0 - 8, s.seed + 7 + i, 0, i === 1);
    // The lead roof slab (the platform) and the corbel under the bay.
    p.rect(bx - 1, by0 - 1, bay.w + 2, 3, pick(gt('slate', d), 2.4));
    p.rect(bx - 1, by0 - 1, bay.w + 2, d === 1 ? 1 : 0.5, pick(gt('slate', d), 4.4));
    p.rect(bx + 2, by1, bay.w - 4, 2, pick(trim, 1.6));
  }

  // ---- the shop (ground floor)
  const gy = H - SHOP_GF;
  // The fascia and the sign board.
  const board = gt(s.board, d, 0.15);
  const signY = gy + 3;
  p.rect(1, gy, W - 2, 2, pick(trim, 2.6));
  p.rect(2, signY, W - 4, 9, pick(board, 1.2));
  p.rect(2, signY, W - 4, d === 1 ? 1 : 0.5, pick(board, 3));
  p.rect(2, signY + 8, W - 4, 1, pick(board, 0.3));
  const letters = snap(T('sand', 6, d), d);
  const tw = tinyWidth(s.sign);
  tinyText(p, s.sign, Math.round((W - tw) / 2), signY + 2, letters, { lit: T('sand', 7, d) });
  // Pilasters.
  p.rect(0, gy + 12, 3, SHOP_GF - 12, pick(trim, 3.4));
  p.rect(W - 3, gy + 12, 3, SHOP_GF - 12, pick(trim, 2.2));
  if (d >= 2) p.rect(0, gy + 12, 1 / d, SHOP_GF - 12, pick(trim, 5));
  // The plinth.
  p.rect(0, H - 3, W, 3, pick(gt('stone', d, 0.3), 1.6));
  p.rect(0, H - 3, W, d === 1 ? 1 : 0.5, pick(gt('stone', d, 0.3), 3));
  // Door and window.
  const doorW = 11;
  const doorLeft = (s.door ?? 'l') === 'l';
  const dx = doorLeft ? 4 : W - 4 - doorW;
  const sx0 = doorLeft ? dx + doorW + 2 : 4;
  const sw = W - 8 - doorW - 2;
  const top = gy + 14;
  const bottom = H - 3;
  shopWindow(p, s, sx0, top, sw, bottom - top);
  shopDoor(p, s, dx, top - 2, doorW, bottom - top + 2);
  outlineC(p);
}

/** The shop window under its shutter state. */
function shopWindow(p: Pen, s: ShopSpec, x: number, y: number, w: number, h: number): void {
  const d = p.d;
  const frame = gt(s.board, d, 0.2);
  const steel = gt('steel', d, 0.2);
  const glass = gt('night', d, 0.05);
  p.rect(x - 1, y - 1, w + 2, h + 2, pick(frame, 0.8));
  // The glass behind: a dark shop, a faint cold display light low down, the street's reflection.
  p.fill(x, y, w, h, (X, Y) => {
    const v = (Y + 0.5) / d - y;
    const u = (X + 0.5) / d - x;
    if (s.shutter === 'dark' && v > h * 0.62 && u > 2 && u < w - 2) return pick(gt('teal', d, 0.6), dq(1.2 + (v - h * 0.62) / h, X, Y, 0.7));
    const band = (u + v * 0.8) % 23;
    if (band > 14 && band < 15) return pick(gt('dusk', d, 0.1), 2);
    return pick(glass, dq(1.2 + v / h * 0.6, X, Y, 0.8));
  });
  if (s.shutter === 'down' || s.shutter === 'half') {
    // A rolling shutter: steel slats (the half shutter stops a third up).
    const sh = s.shutter === 'down' ? h : Math.round(h * 0.62);
    const slat = d === 1 ? 2 : 1.5;
    p.fill(x, y, w, sh, (X, Y) => {
      const v = (Y + 0.5) / d - y;
      const k = (v % slat) < slat * 0.5 ? 3 : 2.2;
      const grime = d >= 4 && h2(X >> 3, 1, s.seed) > 0.8 ? -0.4 : 0;
      return pick(steel, k + grime - (v / sh) * 0.5);
    });
    p.rect(x, y + sh - 1.5, w, 1.5, pick(steel, 1.2));
    if (d >= 2) p.rect(x + w / 2 - 1, y + sh - 2.5, 2, 1, pick(steel, 4));
    p.rect(x, y, w, 2, pick(steel, 1.4));
  } else if (s.shutter === 'grille') {
    // A trellis grille over the dark glass.
    const g = pick(steel, 3);
    for (let gx = x; gx < x + w; gx += 3) p.rect(gx, y, d === 1 ? 1 : 0.5, h, g);
    if (d >= 2) for (let gy = y; gy < y + h; gy += 3) p.rect(x, gy, w, 0.5, pick(steel, 2.2));
  }
  if (d >= 2) p.rect(x - 1, y - 1, w + 2, 1 / d, pick(frame, 2.4));
}

/** The shop door (recessed, a dark glass panel) and its transom. */
function shopDoor(p: Pen, s: ShopSpec, x: number, y: number, w: number, h: number): void {
  const d = p.d;
  const frame = gt(s.board, d, 0.2);
  const wood = gt('wood', d, 0.3);
  p.rect(x, y, w, h, pick(frame, 0.6));
  p.rect(x + 1, y + 1, w - 2, 4, pick(gt('night', d), 1.4));
  p.rect(x + 1, y + 6, w - 2, h - 6, pick(wood, 1.2));
  p.rect(x + 2.5, y + 8, w - 5, h * 0.42, pick(gt('night', d), 1));
  if (d >= 2) {
    p.rect(x + 1, y + 6, w - 2, 1 / d, pick(wood, 2.6));
    p.rect(x + 1, y + 6, 1 / d, h - 6, pick(wood, 2.4));
    p.rect(x + w - 3, y + h * 0.55, 1, 1, F('gold', 0.5, d));
  }
  // The step.
  p.rect(x - 1, y + h - 1.5, w + 2, 1.5, pick(gt('stone', d, 0.3), 3));
  void s;
}

/** The roof of a front, from the walls' top `top` upward. */
function drawRoof(p: Pen, s: ShopSpec, top: number, shade: (X: number, Y: number) => Color, trim: readonly Color[]): void {
  const d = p.d;
  const W = s.w;
  const tiles = gt('brickDark', d, 0.35);
  const slate = gt('slate', d, 0.15);
  const rh = roofH(s);
  const rt = top - rh;
  if (s.roof === 'eaves' || s.roof === 'mansard') {
    const mansard = s.roof === 'mansard';
    const t = mansard ? slate : tiles;
    const inset = mansard ? 3 : 7;
    p.poly(
      [
        [-0.5, top + 1],
        [inset, rt + 4],
        [W - inset, rt + 4],
        [W + 0.5, top + 1],
      ],
      (X, Y) => {
        const v = (Y + 0.5) / d - rt;
        const row = Math.floor(v / 2.5);
        let k = 2.2 - v / rh;
        if (d >= 2 && (v % 2.5) < 1 / d + 0.01) k -= 1;
        if (d >= 4 && h2(Math.floor(X / (3 * d)) + row * 7, row, s.seed) > 0.85) k += 0.6;
        return pick(t, dq(k, X, Y, 0.6));
      },
    );
    // The ridge.
    p.rect(inset, rt + 3, W - inset * 2, 1.5, pick(t, 3.4));
    // A dormer (or two on the mansard), with a small pitched top.
    const ndorm = mansard ? 2 : 1;
    for (let i = 0; i < ndorm; i++) {
      const cx = mansard ? W * (0.3 + i * 0.4) : W / 2;
      const dw = 12;
      const dy = rt + 7;
      p.rect(cx - dw / 2, dy, dw, 10, pick(trim, 3));
      sash(p, cx - 4, dy + 2, 8, 7, s.seed + 30 + i, h2(i, 9, s.seed) > 0.8 ? 1 : 0, false);
      p.poly(
        [
          [cx - dw / 2 - 1, dy],
          [cx, dy - 4],
          [cx + dw / 2 + 1, dy],
        ],
        (X) => pick(t, X / d < cx ? 3 : 1.6),
      );
    }
    if (!mansard) {
      // A chimney at one end.
      const chx = s.seed % 2 ? 9 : W - 15;
      p.fill(chx, rt + 1.5, 6, 8, shade);
      p.rect(chx - 0.5, rt + 0.5, 7, 1.5, pick(trim, 3));
    }
    return;
  }
  if (s.roof === 'gable' || s.roof === 'step') {
    const rise = rh - 2;
    const pts: Array<[number, number]> = [];
    if (s.roof === 'gable') {
      pts.push([0, top + 1], [0, top - 1], [W / 2, top - rise], [W, top - 1], [W, top + 1]);
    } else {
      pts.push([0, top + 1]);
      const steps = 4;
      const sw = W / (steps * 2 + 1);
      for (let i = 0; i < steps; i++) {
        const y0 = top - (i * rise) / steps;
        const y1 = top - ((i + 1) * rise) / steps;
        pts.push([i * sw, y0], [i * sw, y1]);
      }
      pts.push([steps * sw, top - rise], [W - steps * sw, top - rise]);
      for (let i = steps - 1; i >= 0; i--) {
        const y0 = top - (i * rise) / steps;
        const y1 = top - ((i + 1) * rise) / steps;
        pts.push([W - i * sw, y1], [W - i * sw, y0]);
      }
      pts.push([W, top + 1]);
    }
    p.poly(pts, shade);
    // The coping along the gable and a round attic window or a hoist beam.
    const cop = pick(trim, 4.2);
    if (s.roof === 'gable') {
      p.line(0, top - 1, W / 2, top - rise, cop, d);
      p.line(W / 2, top - rise, W, top - 1, pick(trim, 2), d);
    } else {
      for (let i = 1; i < pts.length - 2; i++) if (pts[i][1] === pts[i + 1][1]) p.rect(Math.min(pts[i][0], pts[i + 1][0]) - 0.5, pts[i][1] - 0.5, Math.abs(pts[i + 1][0] - pts[i][0]) + 1, 1.5, cop);
    }
    const ay = top - rise * 0.45;
    p.disc(W / 2, ay, 3.5, 3.5, (_X, _Y, u, v) => (u * u + v * v > 0.6 ? pick(trim, 3.6) : pick(gt('night', d), 1)));
    // Wall anchors (iron S-hooks) at the dense densities.
    if (d >= 2) {
      const iron = pick(gt('black', d), 1);
      for (const ax of [W * 0.25, W * 0.75]) p.rect(ax - 1, top - rise * 0.2, 2, 0.5, iron);
    }
    return;
  }
  // Flat: a parapet with a date stone (our own year).
  p.fill(0, rt + 4, W, rh - 4, shade);
  p.rect(0, rt + 4, W, 1.5, pick(trim, 4));
  p.rect(0, top - 1, W, 1, pick(trim, 1.6));
  const sw = 18;
  p.rect(W / 2 - sw / 2, rt, sw, 9, pick(trim, 3.4));
  p.rect(W / 2 - sw / 2, rt, sw, d === 1 ? 1 : 0.5, pick(trim, 5));
  tinyText(p, s.seed % 2 ? '1897' : '1904', W / 2 - 7.5, rt + 2, pick(trim, 1));
}

reg(
  'decor/oz/shop',
  SHOPS.map((s) => shopGeom(s)),
  (p, i) => drawShop(p, SHOPS[i]),
);

/** Widths of a row of fronts. */
export function shopRowWidth(frames: readonly number[]): number {
  let w = 0;
  for (const f of frames) w += SHOPS[f].w;
  return w;
}

// ============================================================================================
// Awnings and balconies (platform decor)
// ============================================================================================

export const AWNING_WIDTHS = [32, 40, 48] as const;
/** Muted canvas colour pairs (stripe a, stripe b). */
const AWNING_COLOURS: ReadonlyArray<readonly [Rn, Rn]> = [
  ['green', 'cloth'],
  ['red', 'cloth'],
  ['navy', 'steel'],
];
/** Awning height below its platform line. */
export const AWNING_H = 13;

/** The awning frame index for a width (one of AWNING_WIDTHS) and a colour 0 … 2. */
export function awningFrame(w: number, colour: number): number {
  const i = AWNING_WIDTHS.indexOf(w as (typeof AWNING_WIDTHS)[number]);
  return Math.max(0, i) * AWNING_COLOURS.length + (colour % AWNING_COLOURS.length);
}

reg(
  'decor/oz/awning',
  AWNING_WIDTHS.flatMap((w) => AWNING_COLOURS.map(() => ({ w: w + 2, h: AWNING_H + 1, ox: 1, oy: 0 }))),
  (p, i) => {
    const d = p.d;
    const w = p.w - 2;
    const [ra, rb] = AWNING_COLOURS[i % AWNING_COLOURS.length];
    const a = gt(ra, d, 0.3);
    const b = gt(rb, d, 0.3);
    const sw = 6;
    // The canvas under the iron rail (the platform band covers rows 0 … 4): stripes, darker
    // down the slope, soft folds at 4×; the valance ends in a rounded tongue per stripe.
    p.fill(1, 0, w, AWNING_H, (X, Y) => {
      const x = (X + 0.5) / d - 1;
      const y = (Y + 0.5) / d;
      const k0 = Math.floor(x / sw);
      const u = (x - k0 * sw) / sw;
      const bottom = 10.5 + Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1))) * 2.2;
      if (y > bottom) return 0;
      const stripe = k0 % 2 === 0 ? a : b;
      let k = (stripe === a ? 2.8 : 3.8) - y * 0.11;
      if (y > 9.6 && y < 10.4) k -= 1.1; // the valance seam
      if (d >= 2 && (u < 0.5 / sw || u > 1 - 0.5 / sw)) k -= 0.5;
      if (d >= 4 && y < 9.6) k += Math.sin(u * Math.PI * 2) * 0.3;
      return pick(stripe, k);
    });
    // The arms to the wall.
    const steel = gt('black', d, 0.2);
    p.line(2, 4, 0.5, AWNING_H, pick(steel, 1.5), d);
    p.line(w, 4, w + 1.5, AWNING_H, pick(steel, 1.5), d);
    outlineC(p);
  },
);

export const BALCONY_WIDTHS = [32, 40] as const;
/** The balcony frame's height above its slab top (the railing). */
export const BALCONY_RAIL = 10;

reg(
  'decor/oz/balcony',
  BALCONY_WIDTHS.map((w) => ({ w: w + 2, h: BALCONY_RAIL + 7, ox: 1, oy: BALCONY_RAIL })),
  (p) => {
    const d = p.d;
    const w = p.w - 2;
    const stone = gt('sandstone', d, 0.1);
    const iron = gt('black', d, 0.15);
    const top = BALCONY_RAIL;
    // The railing: a top rail, bars and a scroll in the middle (behind whoever stands there).
    p.rect(1, 1, w, 1.2, pick(iron, 2.4));
    for (let x = 2; x < w; x += 3) {
      p.rect(1 + x, 1, 1, top - 1, pick(iron, 1.4));
      if (d >= 2) p.rect(1 + x, 1, 1 / d, top - 1, pick(iron, 2.8));
    }
    p.disc(1 + w / 2, top / 2 + 1, 2.5, 2.5, (_X, _Y, u, v) => (u * u + v * v > 0.5 ? pick(iron, 2.6) : 0));
    // The slab (the platform) and the corbels under it.
    p.rect(0, top, w + 2, 3, pick(stone, 4));
    p.rect(0, top, w + 2, d === 1 ? 1 : 0.5, pick(stone, 6));
    p.rect(0, top + 2.5, w + 2, 0.5, pick(stone, 1.6));
    for (const cx of [4, w - 4]) {
      p.poly(
        [
          [cx - 2, top + 3],
          [cx + 2, top + 3],
          [cx + 0.5, top + 7],
        ],
        pick(stone, 2.8),
      );
    }
    outlineC(p);
  },
);

// ============================================================================================
// Street furniture
// ============================================================================================

/** The double street lamp's size (anchor at its foot, the centre of the pole). */
export const LAMP_W = 48;
export const LAMP_H = 108;
/** The two lamp heads (the light's centre under the hoods) relative to the lamp's foot. */
export const LAMP_HEADS: ReadonlyArray<readonly [number, number]> = [
  [-15, -95],
  [15, -95],
];

reg(
  'decor/oz/lamp',
  [0, 1].map(() => ({ w: LAMP_W, h: LAMP_H, ox: LAMP_W / 2, oy: LAMP_H })),
  (p, frame) => {
    const d = p.d;
    const cx = LAMP_W / 2;
    const H = LAMP_H;
    const iron = gt('black', d, 0.1);
    const lit = frame === 0;
    // The foot and the pole (tapering), lit on the left.
    p.rect(cx - 3, H - 5, 6, 5, pick(iron, 1.6));
    p.rect(cx - 2.5, H - 5, 5, d === 1 ? 1 : 0.5, pick(iron, 3.4));
    p.fill(cx - 1.5, 14, 3, H - 19, (X) => {
      const u = ((X + 0.5) / d - (cx - 1.5)) / 3;
      return pick(iron, u < 0.34 ? 3 : u < 0.67 ? 2 : 0.8);
    });
    // The two arms: a curve up and over to each head (a quarter ellipse), the heads hanging down.
    for (const side of [-1, 1]) {
      const hx = cx + side * 15;
      const steps = 24;
      let px = cx;
      let py = 22;
      for (let k = 1; k <= steps; k++) {
        // Out from the pole, up over a crest and down into the hood.
        const t = k / steps;
        const nx = cx + side * 15 * t;
        const ny = 22 - 14 * Math.sin(Math.PI * 0.75 * t);
        p.line(px, py, nx, ny, pick(iron, 2.2), Math.max(1, Math.round(d * 1.25)));
        px = nx;
        py = ny;
      }
      // The hood (a shallow dish), the glass bowl under it.
      p.disc(hx, 13, 7.5, 3.4, (_X, _Y, _u, v) => (v < 0.3 ? pick(iron, v < -0.5 ? 3.6 : 2) : 0));
      p.rect(hx - 7.5, 13, 15, 1, pick(iron, 1));
      p.disc(hx, 14.5, 5.5, 3.2, (_X, _Y, u, v) => {
        if (v < -0.2) return 0;
        if (!lit) return pick(gt('steel', d, 0.3), 2 + (u < -0.2 ? 1 : 0));
        const r = u * u + v * v;
        return T('candle', r < 0.35 ? 6 : r < 0.7 ? 5 : 4, d);
      });
      p.rect(hx - 0.5, 9, 1, 2, pick(iron, 2));
    }
    // The finial over the pole.
    p.rect(cx - 1, 9, 2, 5, pick(iron, 2.6));
    p.disc(cx, 8.5, 1.4, 1.4, pick(iron, 3.4));
    // The hanging flower basket: a bracket, the basket and a mound of geraniums.
    const by = 50;
    p.rect(cx + 1, by - 6, 7, 1, pick(iron, 2));
    p.line(cx + 7.5, by - 6, cx + 7.5, by - 2, pick(iron, 1.4), d);
    const leaf = gt('green', d, 0.35);
    const red = gt('red', d, 0.2);
    p.disc(cx + 7.5, by + 3, 7, 5.5, (X, Y, u, v) => {
      const hh = h2(X >> (d >= 4 ? 1 : 0), Y >> (d >= 4 ? 1 : 0), 77);
      if (v > 0.35 && hh > 0.5) return pick(leaf, 1 + hh);
      if (hh > 0.78 && v < 0.6) return pick(red, v < -0.2 ? 5 : 4);
      return pick(leaf, 2 + (u < -0.2 ? 1 : 0) + (v < -0.3 ? 0.6 : 0) - hh * 0.8);
    });
    // Trailing leaves under the basket.
    for (let k = 0; k < 4; k++) p.rect(cx + 3 + k * 3, by + 8, 1, 2 + (k % 2) * 2, pick(leaf, 1.6));
    p.rect(cx + 2, by + 1, 11, 1, pick(iron, 1.2));
    outlineC(p);
  },
);

/**
 * The signpost: the black pole on the right, four boards reaching left (the two upper ones point
 * right toward the basilica, the lower two left); anchor at the pole's foot. The pole is tall
 * (94 px), so the lowest board (G − 59 … G − 51) stays above the shop signs, the awnings and the
 * balcony slabs (G − 42) of the shops behind it, and above the heroes' heads.
 */
export const SIGNPOST_W = 96;
export const SIGNPOST_H = 94;
reg(
  'decor/oz/signpost',
  [{ w: SIGNPOST_W, h: SIGNPOST_H, ox: SIGNPOST_W - 6, oy: SIGNPOST_H }],
  (p) => {
    const d = p.d;
    const iron = gt('black', d, 0.1);
    const board = gt('black', d, 0.05);
    const cream = snap(T('sand', 6, d), d);
    const px = SIGNPOST_W - 7.5;
    p.fill(px, 4, 3, SIGNPOST_H - 4, (X) => pick(iron, ((X + 0.5) / d - px) / 3 < 0.4 ? 3 : 1.4));
    p.rect(px - 1, SIGNPOST_H - 3, 5, 3, pick(iron, 1.4));
    p.disc(px + 1.5, 3, 2, 2, pick(iron, 3.4));
    for (let i = 0; i < SIGNPOST.length; i++) {
      const text = SIGNPOST[i];
      const right = i < 2;
      const tw = tinyWidth(text);
      const bw = tw + 11;
      const y = 8 + i * 9;
      const x1 = px;
      const x0 = x1 - bw;
      // The board, its pointed end on the arrow's side.
      p.rect(x0, y, bw, 8, pick(board, 2));
      if (!right) p.poly([[x0, y], [x0 - 4, y + 4], [x0, y + 8]], pick(board, 2));
      if (d >= 2) {
        p.rect(x0, y, bw, 0.5, pick(board, 4));
        p.rect(x0, y + 7.5, bw, 0.5, pick(board, 0.6));
      }
      // The arrow (a chevron and a shaft) and the name.
      const ax = right ? x1 - 7 : x0 + 1;
      p.rect(ax, y + 3.5, 5, 1, cream);
      if (right) {
        p.rect(ax + 3, y + 2.5, 1, 3, cream);
        p.rect(ax + 2, y + 1.5, 1, 1, cream);
        p.rect(ax + 2, y + 5.5, 1, 1, cream);
      } else {
        p.rect(ax + 1, y + 2.5, 1, 3, cream);
        p.rect(ax + 2, y + 1.5, 1, 1, cream);
        p.rect(ax + 2, y + 5.5, 1, 1, cream);
      }
      tinyText(p, text, right ? x0 + 3 : x0 + 8, y + 1.5, cream);
    }
    outlineC(p);
  },
);

/** Bike rack with two parked bikes (front decor; anchor bottom-centre). */
reg(
  'decor/oz/bike-rack',
  [{ w: 50, h: 22, ox: 25, oy: 22 }],
  (p) => {
    const d = p.d;
    const steel = gt('steel', d, 0.25);
    const ink = pick(gt('steel', d, 0.2), d === 1 ? 2 : 1.2);
    // Three hoops.
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 16;
      p.disc(x + 4, 13, 4, 4, (_X, _Y, u, v) => (v < 0.05 && u * u + v * v > 0.55 ? pick(steel, 3) : 0));
      p.rect(x, 13, 1, 9, pick(steel, 3));
      p.rect(x + 7, 13, 1, 9, pick(steel, 2));
    }
    // Two bikes (dark frames, thin wheels), one leaning the other way.
    const frames = [gt('red', d, 0.25), gt('teal', d, 0.3)];
    for (let b = 0; b < 2; b++) {
      const bx = 6 + b * 22;
      const fr = frames[b];
      for (const wx of [bx, bx + 16]) p.disc(wx + 4, 16, 5, 5, (_X, _Y, u, v) => (u * u + v * v > 0.68 ? ink : d >= 2 && (Math.abs(u) < 0.08 || Math.abs(v) < 0.08) ? pick(steel, 2) : 0));
      const c = pick(fr, 2.6);
      p.line(bx + 4, 16, bx + 10, 10, c, d);
      p.line(bx + 10, 10, bx + 18, 10, c, d);
      p.line(bx + 10, 10, bx + 12, 16, c, d);
      p.line(bx + 18, 10, bx + 20, 16, c, d);
      p.line(bx + 12, 16, bx + 4, 16, c, d);
      p.rect(bx + 8, 8, 4, 1, ink);
      p.rect(bx + 17, 7, 1, 3, pick(steel, 3));
      p.rect(bx + 15, 7, 4, 1, ink);
    }
    outlineC(p);
  },
);

/** A park bench (dark slats on black iron; anchor bottom-centre). */
reg(
  'decor/oz/bench',
  [{ w: 30, h: 15, ox: 15, oy: 15 }],
  (p) => {
    const d = p.d;
    const wood = gt('wood', d, 0.35);
    const iron = gt('black', d, 0.1);
    for (const y of [1, 4]) p.rect(1, y, 28, 2, pick(wood, 2.6));
    p.rect(1, 8, 28, 2, pick(wood, 3.2));
    if (d >= 2) for (const y of [1, 4, 8]) p.rect(1, y, 28, 0.5, pick(wood, 4.2));
    for (const x of [3, 25]) {
      p.rect(x, 0, 2, 15, pick(iron, 1.4));
      p.rect(x - 1, 14, 4, 1, pick(iron, 1));
    }
    outlineC(p);
  },
);

/** A municipal litter bin (dark green; anchor bottom-centre). */
reg(
  'decor/oz/bin',
  [{ w: 10, h: 17, ox: 5, oy: 17 }],
  (p) => {
    const d = p.d;
    const g = gt('green', d, 0.4);
    p.rect(1, 3, 8, 10, pick(g, 2));
    p.rect(1, 3, 2, 10, pick(g, 3));
    p.rect(0.5, 2, 9, 2, pick(g, 3.2));
    p.rect(3, 5, 4, 1.5, pick(gt('night', d), 0.8));
    p.rect(4, 13, 2, 4, pick(gt('black', d), 1.2));
    outlineC(p);
  },
);

/** Flowers along the top of a low wall (a planter; anchor bottom-left at the wall's top). */
reg(
  'decor/oz/planter',
  [{ w: 32, h: 8, ox: 0, oy: 8 }],
  (p) => {
    const d = p.d;
    const leaf = gt('green', d, 0.4);
    const red = gt('red', d, 0.25);
    const pink = gt('pink', d, 0.35);
    p.fill(0, 0, 32, 8, (X, Y) => {
      const x = (X + 0.5) / d;
      const y = (Y + 0.5) / d;
      const top = 3 + Math.sin(x * 0.9) * 1.2 + h2(Math.floor(x / 2), 1, 5) * 1.5;
      if (y < top) return 0;
      const hh = h2(X >> (d >= 4 ? 1 : 0), Y >> (d >= 4 ? 1 : 0), 31);
      if (hh > 0.86) return pick(Math.floor(x / 8) % 2 ? red : pink, 4);
      return pick(leaf, 2.4 - (y - top) * 0.25 + hh * 0.6);
    });
  },
);

/** A cast-iron bollard (front decor; anchor bottom-centre). */
reg(
  'decor/oz/bollard',
  [{ w: 6, h: 14, ox: 3, oy: 14 }],
  (p) => {
    const d = p.d;
    const iron = gt('black', d, 0.1);
    p.rect(1, 3, 4, 11, pick(iron, 1.6));
    p.rect(1, 3, 1.5, 11, pick(iron, 3));
    p.disc(3, 3, 2, 2, pick(iron, 3.4));
    p.rect(0.5, 7, 5, 1, pick(iron, 3));
    outlineC(p);
  },
);
