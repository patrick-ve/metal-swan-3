/**
 * The canal vistas and far banks of oat-a (STREET-A, wave A; docs/design/oat.md §8.1 item 2, §8.2
 * "Far rows", §8.7 a 3, §8.8 water): what the squad sees where the street opens onto a canal.
 *
 * - `decor/oat/a/vista-<canal>` (Prinsengracht, Keizersgracht, Herengracht): drawn at the façade
 *   plane (depth 16) at each bridge's x0, the canal running away from the camera: a small pinhole
 *   model (camera on the bridge, the eye over the water; spec widths of water 24.5 / 26.4 / 23.5 m,
 *   quay streets, rows of canal houses) is ray-cast per art px — façades of both banks (generated
 *   lots: lijst, klok, hals, tuit and trap gables, three bays, white sashes), the quay paving and
 *   copings, the quay walls with their wet band, the olive-brown water mirroring the banks (the ray
 *   mirrored at the surface, broken by ripple rows) and a far end (a low bridge, a row facing us);
 *   then the things on it far → near: houseboats (a concrete ark, an old steel barge), the
 *   Keizersgracht's low glass-roofed tour boat, parked cars nose to the water, bikes, the elms
 *   arching over the water. Haze and a thin morning mist grow with distance (`HAZE_MORNING`).
 * - `decor/oat/a/farbank-<canal>` (Prinsengracht, Singel): the far bank seen ACROSS the canal from
 *   our quay, a front elevation at ~5.6 px/m (spec "far rows uniform 0.4–0.5"): the far row of canal
 *   houses, elms, cars and bikes on the far quay, the quay wall, the water with its mirror image;
 *   houseboats on the Singel.
 *
 * Light (spec §8.3): the sun is LEFT and in front at 32°: in a vista the right bank's fronts face the
 * sun (lit, warm), the left bank's face away (cool shade); the far banks face the camera (lit).
 * Static decor, no outline. Transparent sky (the background layers show). Pure: hashes only.
 */
import type { Color } from '../../../../../engine/color';
import { HAZE_MORNING, h2, ladder, mx, reg, T, type Dn, type Pen, type Rn } from './kit';
import { drawBike, drawElm, SKY_CAST, SUN, type BikeKind } from './street';

// ------------------------------------------------------------------------------------ materials

type Mat = 'brick' | 'dark' | 'black' | 'red' | 'plaster' | 'grey';
const MATS: readonly Mat[] = ['brick', 'dark', 'black', 'red', 'plaster', 'grey', 'brick', 'dark'];
const MAT_RAMP: Readonly<Record<Mat, readonly [Rn, number, number]>> = {
  brick: ['oat.brick', 1, 6],
  dark: ['brickDark', 1, 5],
  black: ['oat.brick', 0, 2],
  red: ['brick', 2, 5],
  plaster: ['plaster', 3, 6],
  grey: ['stone', 3, 6],
};

/** Haze levels of every table (0 = clear … LEVELS − 1 = the haziest). */
const LEVELS = 8;
const MAX_AIR = 0.8;

/** A lit or shaded ladder of tones lo … hi of ramp n, and its haze levels. */
type Table = readonly (readonly Color[])[];
const tables = new Map<string, Table>();

function table(n: Rn, lo: number, hi: number, lit: boolean, d: Dn): Table {
  const key = `${n}:${lo}:${hi}:${lit ? 1 : 0}:${d}`;
  let t = tables.get(key);
  if (t) return t;
  const stops: Color[] = [];
  for (let k = lo; k <= hi; k++) stops.push(T(n, k, 2));
  const tone = stops.map((c, i) => (lit ? mx(c, SUN, (0.22 * i) / Math.max(1, stops.length - 1), 2) : mx(c, SKY_CAST, 0.18, 2)));
  const base = ladder(tone, 2, 2);
  const out: Color[][] = [];
  for (let a = 0; a < LEVELS; a++) {
    const air = (a / (LEVELS - 1)) * MAX_AIR;
    out.push(base.map((c) => mx(c, HAZE_MORNING, air, d)));
  }
  t = out;
  tables.set(key, t);
  return t;
}

function at(t: Table, air: number, f: number): Color {
  const a = Math.max(0, Math.min(LEVELS - 1, Math.round((air / MAX_AIR) * (LEVELS - 1))));
  const row = t[a];
  return row[Math.max(0, Math.min(row.length - 1, Math.floor(f * row.length)))];
}

// ------------------------------------------------------------------------------------ lots

type Gable = 'lijst' | 'klok' | 'hals' | 'tuit' | 'trap';
const GABLES: readonly Gable[] = ['lijst', 'lijst', 'klok', 'hals', 'tuit', 'trap', 'lijst', 'klok'];

interface Lot {
  readonly a: number;
  readonly b: number;
  readonly ridge: number;
  readonly eaves: number;
  readonly gable: Gable;
  readonly mat: Mat;
  readonly tone: number;
  readonly bays: number;
  readonly green: boolean;
}

/** Lots along a row from a to b (metres), each 6–9 m, seeded. */
function lots(a: number, b: number, seed: number, wide = 1): Lot[] {
  const out: Lot[] = [];
  let x = a;
  let i = 0;
  while (x < b) {
    const len = (6 + 3 * h2(i, seed, 101)) * wide;
    const gable = GABLES[Math.floor(h2(i, seed, 103) * GABLES.length)];
    const ridge = 12.5 + 6.5 * h2(i, seed, 105);
    const eaves = gable === 'lijst' ? ridge : ridge - 3 - 1.5 * h2(i, seed, 107);
    out.push({
      a: x,
      b: x + len,
      ridge,
      eaves,
      gable,
      mat: MATS[Math.floor(h2(i, seed, 109) * MATS.length)],
      tone: 0.35 + 0.4 * h2(i, seed, 111),
      bays: len > 8.2 ? 4 : len < 6.4 ? 2 : 3,
      green: h2(i, seed, 113) < 0.2,
    });
    x += len;
    i++;
  }
  return out;
}

function lotAt(list: readonly Lot[], z: number): Lot | null {
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const l = list[m];
    if (z < l.a) hi = m - 1;
    else if (z >= l.b) lo = m + 1;
    else return l;
  }
  return null;
}

/** The top of a lot's front at fraction t (0 … 1) across it (metres over the street). */
function lotTop(l: Lot, t: number): number {
  const c = 1 - Math.abs(2 * t - 1);
  switch (l.gable) {
    case 'lijst':
      return l.ridge + (t > 0.3 && t < 0.7 ? 0.6 : 0);
    case 'tuit':
      return l.eaves + (l.ridge - l.eaves) * Math.min(1, c * 1.15);
    case 'trap':
      return l.eaves + (l.ridge - l.eaves) * Math.min(1, Math.floor(c * 4) / 3);
    case 'hals':
      return c > 0.45 ? l.ridge : l.eaves + (l.ridge - l.eaves) * Math.max(0, (c - 0.15) / 0.3) * 0.5;
    case 'klok':
      return c > 0.4 ? l.ridge - (1 - Math.min(1, (c - 0.4) / 0.6)) * 1.2 : l.eaves + (l.ridge - l.eaves) * Math.sqrt(Math.max(0, c / 0.4)) * 0.6;
  }
}

/**
 * The front of a lot at (t across, h over the street, metres), lit or shaded, with haze `air`; `px`
 * = screen px per metre here (details only where they show). Returns a colour.
 */
interface FrontTables {
  readonly wall: Readonly<Record<Mat, Table>>;
  readonly white: Table;
  readonly glass: Table;
  readonly green: Table;
  readonly ink: Table;
  readonly slate: Table;
}
const fronts = new Map<number, FrontTables>();

/** The façade tables of a light side at density d (made once: no string keys per art px). */
function frontTables(lit: boolean, d: Dn): FrontTables {
  const key = d * 2 + (lit ? 1 : 0);
  let f = fronts.get(key);
  if (!f) {
    const wall = {} as Record<Mat, Table>;
    for (const m of MATS) {
      const [n, lo, hi] = MAT_RAMP[m];
      wall[m] = table(n, lo, hi, lit, d);
    }
    f = { wall, white: table('gable', 2, 6, lit, d), glass: table('glass', 0, 4, lit, d), green: table('oat.green', 0, 3, lit, d), ink: table('ink', 0, 1, lit, d), slate: table('slate', 2, 5, lit, d) };
    fronts.set(key, f);
  }
  return f;
}

function frontColor(l: Lot, t: number, h: number, lit: boolean, air: number, px: number, d: Dn, X: number, Y: number): Color {
  const ft = frontTables(lit, d);
  const wall = ft.wall[l.mat];
  const white = ft.white;
  const glass = ft.glass;
  const top = lotTop(l, t);
  // Cornice / gable edging (white or sandstone) just under the top.
  if (top - h < 0.26 + 0.6 / Math.max(1, px) && px > 1.2) return at(white, air, 0.8);
  if (l.gable === 'lijst' && h > l.eaves - 1.1 && h < l.eaves - 0.5 && px > 1.6) return at(wall, air, 0.12);
  // Storeys: the ground floor 0 … 4 m, then 3 m each; bays across.
  const bt = t * l.bays;
  const bi = Math.floor(bt);
  const bf = bt - bi;
  if (h < 4) {
    const doorBay = l.bays > 2 ? 1 : 0;
    if (h > 0.3 && h < 3.1 && bf > 0.3 && bf < 0.7) {
      if (bi === doorBay) return l.green ? at(ft.green, air, 0.5) : at(ft.ink, air, 0.6);
      return at(glass, air, h > 2.3 ? 0.55 : 0.2);
    }
    if (h < 0.5) return at(ft.slate, air, 0.4);
    return at(wall, air, l.tone - 0.1);
  }
  const sf = (h - 4) / 3;
  const si = Math.floor(sf);
  const sfr = sf - si;
  const inGable = h > l.eaves;
  const win = bf > 0.28 && bf < 0.72 && sfr > 0.22 && sfr < 0.85 && (!inGable || (bi === Math.floor(l.bays / 2) && top - h > 1));
  if (win) {
    const edge = px * 0.25;
    if (px > 2.2 && (bf < 0.28 + 0.1 / Math.max(0.5, edge) || bf > 0.72 - 0.08 || sfr < 0.3 || sfr > 0.8)) return at(white, air, 0.75);
    if (px > 3 && d >= 2 && (Math.abs(bf - 0.5) < 0.03 || Math.abs(sfr - 0.53) < 0.03)) return at(white, air, 0.7);
    const refl = ((X * 0.5 + Y) & 15) < 3 && d >= 2;
    return at(glass, air, refl ? 0.8 : sfr > 0.55 ? 0.18 : 0.35);
  }
  // Sill shadows, anchors and the brick grain.
  if (sfr > 0.85 && sfr < 0.9 && bf > 0.26 && bf < 0.74 && px > 2) return at(white, air, 0.55);
  let f = l.tone + (lit ? 0.12 : -0.1) - (h < 5 ? 0.06 : 0);
  if (d >= 2 && px > 2.5) f += (h2(X >> 2, Y >> 1, 121) - 0.5) * 0.05;
  return at(wall, air, f);
}

// ------------------------------------------------------------------------------------ the vista model

interface Vista {
  /** Water width (m), quay street width (m), the far end (m), the vanishing point. */
  readonly water: number;
  readonly quay: number;
  readonly end: number;
  readonly vx: number;
  readonly vy: number;
  readonly seed: number;
  /** Which bank carries the houseboats (−1 left, 1 right) and the tour boat. */
  readonly boats: -1 | 1;
  readonly tour: boolean;
}

const VW = 194;
const VH = 150;
/** The bridge's water span at the frame's bottom (sprite x). */
const WATER_X0 = 17;
const WATER_X1 = 177;
const HQ = 1.1;

/** The camera of a vista: F (px · m at 1 m) and the eye height E over the water. */
function camOf(v: Vista): { F: number; E: number } {
  const k0 = (WATER_X1 - WATER_X0) / v.water;
  const Z0 = 12;
  const F = k0 * Z0;
  const E = (VH - v.vy) / k0;
  return { F, E };
}

function airOf(z: number): number {
  return Math.max(0, Math.min(MAX_AIR, (z - 12) / 150));
}

function drawVista(p: Pen, v: Vista): void {
  const d = p.d;
  const { F, E } = camOf(v);
  const half = v.water / 2;
  const XF = half + v.quay;
  const left = lots(3, v.end, v.seed);
  const right = lots(3, v.end, v.seed + 17);
  const endRow = lots(-XF - 4, XF + 4, v.seed + 29, 1);
  const paving = table('stone', 2, 6, true, d);
  const coping = table('oat.mortar', 0, 3, true, d);
  const wallL = table('oat.brick', 0, 4, false, d);
  const wallR = table('oat.brick', 0, 4, true, d);
  const canal = table('oat.canal', 0, 5, true, d);
  const moss = table('moss', 1, 4, true, d);
  const bridgeT = table('oat.brick', 1, 5, true, d);

  /** The scene's colour along a ray through screen (x, y); mirror: the ray seen in the water. */
  const scene = (x: number, y: number, X: number, Y: number, mirror: boolean): Color => {
    const dx = x - v.vx;
    const dy = y - v.vy;
    // The two façade planes.
    if (dx !== 0) {
      const side = dx < 0 ? -1 : 1;
      const z = (side * XF * F) / dx;
      if (z > 2 && z < v.end) {
        const h = mirror ? (dy * z) / F - E - HQ : E - HQ - (dy * z) / F;
        const l = lotAt(side < 0 ? left : right, z);
        if (l && h >= 0) {
          const t = (z - l.a) / (l.b - l.a);
          if (h <= lotTop(l, t)) {
            const px = F / z;
            return frontColor(l, side < 0 ? 1 - t : t, h, side > 0, airOf(z) + (h < 2 && z > 30 ? 0.08 : 0), px, d, X, Y);
          }
          return 0;
        }
      }
    }
    // The far end: a row of houses facing us over a low bridge.
    if (!mirror ? dy > -(F / v.end) * 30 : true) {
      const z = v.end;
      const Xw = (dx * z) / F;
      const h = mirror ? (dy * z) / F - E : E - (dy * z) / F;
      if (Math.abs(Xw) < XF + 4 && h >= 0) {
        if (h < 2.6 && h > 1.1) return at(bridgeT, MAX_AIR * 0.8, 0.5);
        if (h <= 1.1) return Math.abs(Xw) < half - 1.5 && h < 0.9 ? at(canal, MAX_AIR * 0.6, 0.15) : at(bridgeT, MAX_AIR * 0.8, 0.35);
        const l = lotAt(endRow, Xw);
        if (l) {
          const t = (Xw - l.a) / (l.b - l.a);
          const hh = h - 2.6;
          if (hh <= lotTop(l, t)) return frontColor(l, t, hh, true, MAX_AIR * 0.85, F / z, d, X, Y);
        }
      }
    }
    return 0;
  };

  // Nothing above the tallest front at the frame's edges (the sky stays clear): start the fill there.
  const zEdge = (XF * F) / Math.max(v.vx, VW - v.vx);
  const yTop = Math.max(0, Math.floor(v.vy + ((E - HQ - 20.5) * F) / zEdge) - 1);
  p.fill(0, yTop, VW, VH - yTop, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const dx = x - v.vx;
    const dy = y - v.vy;
    if (dy > 0) {
      // Below the horizon: the ground (quays, copings, walls, water) unless a façade is nearer.
      const zq = ((E - HQ) * F) / dy;
      const xq = (dx * zq) / F;
      const zw = (E * F) / dy;
      const xw = (dx * zw) / F;
      const zEnd = Math.min(zq, zw);
      if (zEnd > v.end) return scene(x, y, X, Y, false);
      if (Math.abs(xq) >= half && Math.abs(xq) < XF) {
        // The quay: the coping at the water, the paving (stretcher courses toward the vanishing point).
        const air = airOf(zq);
        if (Math.abs(xq) < half + 0.45) return at(coping, air, 0.8 - (d >= 2 && Math.abs(xq) > half + 0.35 ? 0.4 : 0));
        let f = 0.5;
        if (d >= 2 && F / zq > 2) f += (h2(Math.floor(zq * 2.4), Math.floor(xq * 2), v.seed + 131) - 0.5) * 0.24;
        return at(paving, air, f - (xq < 0 ? 0.12 : 0));
      }
      if (Math.abs(xq) >= XF) return scene(x, y, X, Y, false);
      if (Math.abs(xw) >= half) {
        // The quay wall: brick, a dark wet band at the water, moss.
        const zwall = (half * F) / Math.abs(dx);
        const h = E - (dy * zwall) / F;
        const air = airOf(zwall);
        const side = dx < 0 ? wallL : wallR;
        if (h < 0.35) return at(moss, air, 0.2);
        if (h < 0.5 && d >= 2) return at(moss, air, 0.5);
        return at(side, air, 0.4 + (d >= 2 && F / zwall > 3 ? (h2(Math.floor(h * 6), Math.floor(zwall), 133) - 0.5) * 0.25 : 0));
      }
      // The water: the scene mirrored, broken by ripple rows; the body darker near the viewer.
      const air = airOf(zw) + Math.max(0, Math.min(0.15, (zw - 30) / 300));
      const band = Math.floor(zw * 1.6);
      const rip = d >= 2 ? (h2(band, Math.floor(x / 16), v.seed + 141) - 0.5) * Math.min(3, (F / zw) * 0.5) : 0;
      const mirror = scene(x + rip, y, X, Y, true);
      const fres = Math.min(1, 0.25 + zw / 60);
      if (mirror !== 0) {
        // Darker and greener than the thing mirrored: the canal tone by the mirrored brightness.
        const tl = 0.06 + luma(mirror) * (0.3 + 0.35 * fres) + (h2(band, 3, v.seed + 143) - 0.5) * (d >= 2 ? 0.08 : 0);
        return at(canal, air, tl);
      }
      // The sky in the water: the grey-blue sheen, stronger toward the far end.
      return at(canal, air, 0.22 + fres * 0.55 + (d >= 2 ? (h2(band, Math.floor(x / 14), v.seed + 145) - 0.5) * 0.08 : 0));
    }
    return scene(x, y, X, Y, false);
  });

  // ---- things on the canal and the quays, far → near
  type Thing = { z: number; draw: () => void };
  const things: Thing[] = [];
  const proj = (X: number, z: number, h: number): readonly [number, number] => [v.vx + (X * F) / z, v.vy + ((E - h) * F) / z];
  // Houseboats along one bank: an ark and a barge.
  const bs = v.boats;
  for (let i = 0; i < 2; i++) {
    const z1 = 22 + i * 26 + 6 * h2(i, v.seed, 151);
    const len = 15 + 4 * h2(i, v.seed, 153);
    const xo = bs * (half - 0.4);
    const xi = bs * (half - 4.4);
    const ark = i === 0;
    things.push({
      z: z1,
      draw: () => {
        const air = airOf(z1);
        const litSide = bs > 0;
        const hull = ark ? table('stone', 2, 5, litSide, d) : table('black', 1, 4, litSide, d);
        const cab = ark ? table('wood', 2, 5, litSide, d) : table('oat.green', 0, 3, litSide, d);
        const hullH = ark ? 0.8 : 1.1;
        const cabH = ark ? 3 : 2.4;
        const quad = (Xa: number, Xb: number, za: number, zb: number, h0: number, h1: number, c: Color): void => {
          const a = proj(Xa, za, h0);
          const b = proj(Xb, zb, h0);
          const cc = proj(Xb, zb, h1);
          const dd = proj(Xa, za, h1);
          p.poly([a, b, cc, dd], c);
        };
        // The inner side (faces the canal), then the near end.
        quad(xi, xi, z1, z1 + len, 0, hullH, at(hull, air, 0.45));
        const ci = xi + bs * -0.4 * -1;
        quad(ci, ci, z1 + 1, z1 + len - (ark ? 1 : 5), hullH, cabH, at(cab, air, 0.55));
        // Windows along the cabin.
        const nw = 4;
        for (let k = 0; k < nw; k++) {
          const za = z1 + 2 + k * ((len - 4) / nw);
          quad(ci, ci, za, za + 1.4, hullH + 0.7, cabH - 0.6, at(table('glass', 0, 3, litSide, d), air, 0.3));
        }
        quad(xo, xi, z1, z1, 0, hullH, at(hull, air, 0.6));
        quad(xo - bs * 0.4, ci, z1 + 1, z1 + 1, hullH, cabH, at(cab, air, 0.7));
        // The roof edge (a lit line) and plants on the ark's roof.
        quad(xo - bs * 0.4, ci, z1 + 1, z1 + 1, cabH - 0.15, cabH, at(table('gable', 3, 6, true, d), air, 0.8));
        if (ark) {
          const [px, py] = proj((xo + xi) / 2, z1 + 3, cabH + 0.4);
          const r = Math.max(0.8, 0.7 * (F / (z1 + 3)));
          p.disc(px, py, r * 1.4, r, at(table('green', 2, 5, true, d), air, 0.5));
        }
      },
    });
  }
  // The tour boat (Keizersgracht): long, low, a glass roof, electric (no exhaust).
  if (v.tour) {
    const z1 = 52;
    const len = 21.8;
    const xa = 0.6;
    const xb = 4.9;
    things.push({
      z: z1,
      draw: () => {
        const air = airOf(z1);
        const hull = table('navy', 1, 4, false, d);
        const glass = table('glass', 2, 5, true, d);
        const side = (h0: number, h1: number, c: Color): void => {
          p.poly([proj(xa, z1, h0), proj(xa, z1 + len, h0), proj(xa, z1 + len, h1), proj(xa, z1, h1)], c);
        };
        side(0, 0.9, at(hull, air, 0.5));
        side(0.9, 2.2, at(glass, air, 0.45));
        for (let k = 0; k < 7; k++) {
          const za = z1 + 1 + k * 3;
          p.poly([proj(xa, za, 0.9), proj(xa, za + 0.25, 0.9), proj(xa, za + 0.25, 2.2), proj(xa, za, 2.2)], at(hull, air, 0.3));
        }
        p.poly([proj(xa, z1, 0), proj(xb, z1, 0), proj(xb, z1, 0.9), proj(xa, z1, 0.9)], at(hull, air, 0.65));
        p.poly([proj(xa, z1, 0.9), proj(xb, z1, 0.9), proj(xb - 0.3, z1, 2.2), proj(xa + 0.3, z1, 2.2)], at(glass, air, 0.7));
        p.poly([proj(xa, z1, 2.2), proj(xb, z1, 2.2), proj(xb, z1 + len, 2.2), proj(xa, z1 + len, 2.2)], at(glass, air, 0.85));
        // Its wake: a pale V on the water behind the near end.
        const [wx, wy] = proj((xa + xb) / 2, z1 - 0.5, 0);
        p.rect(wx - 3, wy, 6, 0.5, at(canal, air, 0.95));
      },
    });
  }
  // Cars nose to the water and bikes on both quays.
  const carRamps: readonly [Rn, number, number][] = [
    ['stone', 3, 6],
    ['navy', 2, 5],
    ['gable', 3, 6],
    ['black', 1, 4],
    ['oat.oxblood', 0, 2],
  ];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 9; i++) {
      const z = 16 + i * 9 + 5 * h2(i, v.seed + side, 161);
      if (h2(i, v.seed + side, 163) < 0.35) continue;
      const kind = h2(i, v.seed + side, 165);
      if (kind < 0.7) {
        const ramp = carRamps[Math.floor(h2(i, v.seed + side, 167) * carRamps.length)];
        things.push({ z, draw: () => drawCar(p, proj, side * (half + 0.4), side * (half + 4.6), z, table(ramp[0], ramp[1], ramp[2], side > 0, d), airOf(z), d) });
      } else {
        const kinds: readonly BikeKind[] = ['black', 'blue-crate', 'child-seat', 'rusty'];
        things.push({
          z,
          draw: () => {
            const [bx, by] = proj(side * (half + 0.6), z, HQ);
            const sc = (1.9 * F) / z / 38;
            if (sc < 0.08) return;
            drawBike(p, side < 0 ? bx - 38 * sc : bx, by, kinds[i % 4], { scale: sc, haze: HAZE_MORNING, air: airOf(z), flip: side > 0 });
          },
        });
      }
    }
    // The elms: on the quay by the water, their crowns over it.
    for (let i = 0; i < 11; i++) {
      const z = 13 + i * 8.5 + 4 * h2(i, v.seed + side * 3, 171);
      if (h2(i, v.seed + side * 3, 173) < 0.2) continue;
      things.push({
        z: z - 0.01,
        draw: () => {
          const [ex, ey] = proj(side * (half + 1.3), z, HQ);
          const sc = (6.5 * F) / z / 74;
          if (sc < 0.05) return;
          drawElm(p, ex, ey, v.seed * 31 + i * 7 + (side > 0 ? 3 : 0), { scale: sc, haze: HAZE_MORNING, air: airOf(z) * 0.9, shade: side < 0 ? 0.08 : 0 });
        },
      });
    }
  }
  things.sort((a, b) => b.z - a.z);
  for (const t of things) t.draw();
}

/** A car parked nose to the water, seen from its side (its long axis across the view). */
function drawCar(p: Pen, proj: (X: number, z: number, h: number) => readonly [number, number], xa: number, xb: number, z: number, t: Table, air: number, d: Dn): void {
  const [ax, ay] = proj(xa, z, HQ);
  const [bx] = proj(xb, z, HQ);
  const x0 = Math.min(ax, bx);
  const L = Math.abs(bx - ax);
  if (L < 2) return;
  const k = L / 4.2;
  const base = ay;
  const body = at(t, air, 0.55);
  p.rect(x0, base - 1.0 * k, L, 0.65 * k, body);
  p.poly(
    [
      [x0 + L * 0.2, base - 1.0 * k],
      [x0 + L * 0.78, base - 1.0 * k],
      [x0 + L * 0.68, base - 1.45 * k],
      [x0 + L * 0.3, base - 1.45 * k],
    ],
    at(t, air, 0.7),
  );
  if (k > 1.2) {
    p.poly(
      [
        [x0 + L * 0.25, base - 1.02 * k],
        [x0 + L * 0.73, base - 1.02 * k],
        [x0 + L * 0.66, base - 1.36 * k],
        [x0 + L * 0.32, base - 1.36 * k],
      ],
      at(table('glass', 1, 4, true, d), air, 0.4),
    );
  }
  const tyre = at(table('ink', 0, 1, false, d), air, 0.3);
  p.disc(x0 + L * 0.2, base - 0.3 * k, 0.32 * k, 0.32 * k, tyre);
  p.disc(x0 + L * 0.8, base - 0.3 * k, 0.32 * k, 0.32 * k, tyre);
  p.rect(x0, base - 1.0 * k, L, Math.max(1 / d, 0.1 * k), at(t, air, 0.95));
}

// ------------------------------------------------------------------------------------ far banks

interface Bank {
  readonly w: number;
  readonly seed: number;
  /** Houseboats moored on the far side (x, length in px, ark?). */
  readonly boats: readonly (readonly [number, number, boolean])[];
}

const BH = 120;
/** Scale of the far row (px per metre). */
const PXM = 5.6;

function drawBank(p: Pen, b: Bank): void {
  const d = p.d;
  const water = BH - 8;
  const wallTop = water - 4;
  const base = wallTop - 3.6;
  // Across 25–30 m of canal in the morning haze: lighter and greyer than our row (spec §8.13: lower saturation).
  const air = 0.36;
  const row = lots(0, b.w / PXM + 2, b.seed, 1.05);
  const paving = table('stone', 2, 6, true, d);
  const coping = table('oat.mortar', 0, 3, true, d);
  const wall = table('oat.brick', 0, 4, true, d);
  const canal = table('oat.canal', 0, 5, true, d);
  const moss = table('moss', 1, 4, true, d);
  // The row of houses (front elevation), the quay, the wall.
  p.fill(0, 0, b.w, water, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    if (y >= wallTop) {
      if (y < wallTop + 0.8) return at(coping, air, 0.85);
      if (y > water - 1.1) return at(moss, air, 0.25);
      return at(wall, air, 0.42 + (d >= 2 ? (h2(Math.floor(x / 1.4) + (Math.floor(y / 0.7) & 1), Math.floor(y / 0.7), b.seed + 3) - 0.5) * 0.2 : 0));
    }
    if (y >= base) return at(paving, air, 0.45 + (y - base) * 0.05);
    const m = x / PXM;
    const l = lotAt(row, m);
    if (!l) return 0;
    const t = (m - l.a) / (l.b - l.a);
    const h = (base - y) / PXM;
    if (h > lotTop(l, t)) return 0;
    // A cornice's shadow down-right on its own front (the sun is up-left).
    const c = frontColor(l, t, h, true, air, PXM, d, X, Y);
    return c;
  });
  // Elms, cars and bikes on the far quay; a lamp post or two.
  for (let i = 0; i * 34 < b.w + 40; i++) {
    const x = i * 34 + 12 * h2(i, b.seed, 201);
    const kind = h2(i, b.seed, 203);
    if (kind < 0.42) {
      drawElm(p, x, base + 1.4, b.seed * 13 + i, { scale: 0.42, haze: HAZE_MORNING, air: air + 0.05 });
    } else if (kind < 0.62) {
      // A car (seen from its end, nose to the water): a small box with its rear window and lamps.
      const ct = table(['stone', 'navy', 'gable', 'black'][i % 4] as Rn, 2, 5, true, d);
      p.rect(x, base - 6.6, 10, 5.4, at(ct, air, 0.55));
      p.rect(x + 1.2, base - 9.2, 7.6, 2.8, at(ct, air, 0.7));
      p.rect(x + 1.8, base - 8.8, 6.4, 2, at(table('glass', 1, 4, true, d), air, 0.4));
      p.rect(x + 0.4, base - 5.6, 1.4, 0.9, at(table('red', 3, 5, true, d), air, 0.5));
      p.rect(x + 8.2, base - 5.6, 1.4, 0.9, at(table('red', 3, 5, true, d), air, 0.5));
      p.rect(x + 0.8, base - 1.4, 1.6, 1.4, T('ink', 1, d));
      p.rect(x + 7.6, base - 1.4, 1.6, 1.4, T('ink', 1, d));
    } else if (kind < 0.85) {
      drawBike(p, x, base + 0.6, (['black', 'rusty', 'blue-crate', 'child-seat'] as const)[i % 4], { scale: 0.34, haze: HAZE_MORNING, air });
      drawBike(p, x + 7, base + 0.8, (['blue-crate', 'black', 'child-seat', 'rusty'] as const)[i % 4], { scale: 0.34, haze: HAZE_MORNING, air, flip: true });
    }
  }
  // Houseboats on the far side.
  for (const [x, len, ark] of b.boats) {
    const hull = ark ? table('stone', 2, 5, true, d) : table('slate', 1, 4, true, d);
    const cab = ark ? table('gable', 2, 5, true, d) : table('oat.green', 0, 3, true, d);
    const hb = BH - 1.6;
    p.rect(x, hb - 5.4, len, 5.4, at(hull, air, 0.5));
    p.rect(x, hb - 5.4, len, 0.8, at(hull, air, 0.85));
    if (!ark) p.poly([[x + len, hb - 5.4], [x + len + 5, hb - 6.4], [x + len + 3, hb - 1], [x + len, hb]], at(hull, air, 0.4));
    const c0 = x + (ark ? 1.5 : 3);
    const cw = ark ? len - 3 : len * 0.55;
    p.rect(c0, hb - 18, cw, 12.6, at(cab, air, 0.55));
    p.rect(c0, hb - 18.8, cw + 1, 1.2, at(table('gable', 3, 6, true, d), air, 0.8));
    for (let k = 0; k < Math.floor(cw / 7); k++) p.rect(c0 + 2 + k * 7, hb - 15, 3.6, 4.4, at(table('glass', 0, 3, true, d), air, 0.3 + (k & 1) * 0.3));
    if (ark) {
      p.disc(c0 + 4, hb - 19.6, 2.6, 1.6, at(table('green', 2, 5, true, d), air, 0.55));
      p.disc(c0 + cw - 5, hb - 19.4, 2, 1.4, at(table('olive', 3, 6, true, d), air, 0.6));
    } else {
      p.rect(c0 + cw * 0.15, hb - 23, cw * 0.3, 5, at(cab, air, 0.7));
    }
  }
  // The water: the bank mirrored (read back from the pen), darker and greener, broken by ripples.
  for (let Y = Math.round(water * d); Y < BH * d; Y++) {
    const yy = (Y + 0.5) / d;
    const off = yy - water;
    for (let X = 0; X < b.w * d; X++) {
      const rip = d >= 2 ? Math.round((h2(Math.floor(yy * 1.5), Math.floor(X / (6 * d)), b.seed + 211) - 0.5) * d * 1.2) : 0;
      const sy = Math.round((water - off) * d) - 1;
      const src = p.at(X + rip, sy);
      const band = 0.18 + off * 0.02 + (d >= 2 ? (h2(Math.floor(yy * 1.5), Math.floor(X / (9 * d)), b.seed + 213) - 0.5) * 0.12 : 0);
      if (p.at(X, Y) !== 0 && Y < (BH - 1.6) * d) continue;
      if (p.at(X, Y) !== 0) continue;
      p.dot(X, Y, src === 0 ? at(canal, air, 0.8 - off * 0.03) : (Y + X * 3) % 11 === 0 && d >= 2 ? src : at(canal, air, band + (luma(src) - 0.35) * 0.6));
    }
  }
}

/** A rough luma 0 … 1 of a packed colour (for the mirror's tone). */
function luma(c: Color): number {
  const r = (c >>> 24) & 255;
  const g = (c >>> 16) & 255;
  const b = (c >>> 8) & 255;
  return (0.3 * r + 0.59 * g + 0.11 * b) / 255;
}

// ------------------------------------------------------------------------------------ registration

const VISTAS: readonly (readonly [string, Vista])[] = [
  ['prinsengracht', { water: 24.5, quay: 8, end: 130, vx: 92, vy: 98, seed: 0x31, boats: 1, tour: false }],
  ['keizersgracht', { water: 26.4, quay: 9.5, end: 150, vx: 101, vy: 97, seed: 0x4b, boats: -1, tour: true }],
  ['herengracht', { water: 23.5, quay: 9, end: 120, vx: 96, vy: 100, seed: 0x6d, boats: 1, tour: false }],
];
for (const [name, v] of VISTAS) reg(`decor/oat/a/vista-${name}`, [{ w: VW, h: VH, ox: 0, oy: VH }], (p) => drawVista(p, v));

reg('decor/oat/a/farbank-prinsengracht', [{ w: 304, h: BH, ox: 0, oy: BH }], (p) => drawBank(p, { w: 304, seed: 0x81, boats: [[196, 52, true]] }));
reg('decor/oat/a/farbank-singel', [{ w: 222, h: BH, ox: 0, oy: BH }], (p) => drawBank(p, { w: 222, seed: 0x93, boats: [[18, 58, true], [104, 66, false]] }));
