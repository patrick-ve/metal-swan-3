/**
 * Terrain painter (docs/ARCHITECTURE.md §6.2, docs/ART_GUIDE.md §8), registered with
 * setTerrainPainter at import time.
 *
 * The painter samples `terrain.cellAt` over the chunk plus a margin, and derives for every
 * pixel how far it is from the region edges (above, below, left, right). Distances are
 * clamped to values smaller than the margin, so every pixel's colour is a pure function of its
 * WORLD position, the terrain and the style: chunks join without seams, wherever they start.
 *
 * Materials (TerrainStyleDef):
 * - ground: dirt, sand, rock, snow, ice, mud, metal, concrete (darker deeper underground)
 * - edge (top band that follows slopes): grass (tufts, overhanging lips), snow, sand, moss,
 *   rust (streaks), tiles
 * - platform (4-px band): wood, metal (grating + brackets), rock (drips), ice (icicles)
 * - solid: metal (panels, rivets), concrete, crate, rock, brick
 * - Amsterdam (mission `ams`): ground `klinker` (grey brick street pavement in perspective rows
 *   over a dark brick quay wall), edges `bikepath` (red bike path with a white kerb line) and
 *   `kerb` (grey granite kerb), platform `whitewood` (white painted drawbridge planks)
 * - Oldenzaal (mission `oldenzaal`, added 2026-10-21; additive rows, no existing material
 *   changed): ground `oz-pavers` (red-brown brick pavers in a herringbone, in perspective, with
 *   cast-iron drains), platform `oz-ledge` (a dark iron awning rail / lead flashing with a lit
 *   top), solid `oz-brick` (a low dark-red brick wall under a sandstone coping). The HD versions:
 *   missions/oldenzaal/art-terrain.ts. The church (wave B, additive rows): ground `oz-nave-floor`
 *   (worn sandstone flags in perspective) and `oz-crypt-floor` (rough dark flags), platform
 *   `oz-pew` (a pew's dark oak top rail), solid `oz-nave-step` (sandstone steps); the HD
 *   versions: content/oldenzaal/church/art-terrain.ts.
 *
 * HD terrain (UHD art, docs/ART_GUIDE.md "UHD art"): `defineHdTerrainMaterial(kind, id, paint)`
 * adds the density-generic version of one material for the 2× and the 4× tier:
 * `paint(p, d, out, i, stride)` fills the d × d art px of the logical pixel `p` (the same Px the
 * 1× material gets) with PAL_HD colours. The HD painter (`paintTerrainHd`, registered with
 * setHdTerrainPainter for d 2 and 4) classifies every logical pixel exactly like the 1× painter —
 * same cells, bands, cliff faces, undersides and hangers — and only asks the HD material for the
 * colours of its d × d block; materials without one fill their 1× colour. So the geometry (and
 * collision) never changes. Terrain has no ink outline: cliff faces and undersides are HD tone
 * steps of the material (`hdShift`). A rect where no HD material paints gives null (the view keeps
 * its 1× chunk). The ams materials: missions/ams/art-hd-terrain.ts.
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, PAL, stepShade } from '../../engine/palette';
import { hdHome } from '../../engine/palette-hd';
import { setHdTerrainPainter, setTerrainPainter } from './art-registry';
import type { HdTerrainPainter, TerrainPainter, TerrainSampler, TerrainStyleDef } from './art-registry';
import { bayer, hash1, hash2, noise2 } from './paint';

/** Margins sampled around the chunk; distances are clamped below them. */
const PAD_X = 96;
const PAD_UP = 52;
const PAD_DOWN = 8;
const MAX_UP = 48;
const MAX_SIDE = 90;
const MAX_DOWN = 6;

/** Everything a material needs to know about one pixel. */
export interface Px {
  /** World position. */
  x: number;
  y: number;
  /** Same-cell run lengths: 1 = this pixel touches the region edge on that side. */
  up: number;
  down: number;
  left: number;
  right: number;
  seed: number;
}

type Paint = (p: Px) => Color;

/** Ordered-dither pick from a ramp for a continuous index (world anchored). */
function dz(r: Ramp, v: number, x: number, y: number, spread = 0.8): Color {
  const k = Math.floor(v + (bayer(x, y) - 0.5) * spread);
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
}

/** Depth darkening: −0 near the surface, about −2 deep down, with dithered steps. */
function deep(depth: number): number {
  return -Math.min(2.2, depth / 22);
}

// ------------------------------------------------------------------------------------ ground

const GROUND: Readonly<Record<string, Paint>> = {
  dirt: (p) => {
    const r = PAL.brown;
    let v = 2.2 + deep(p.up) + (noise2(p.x, p.y, 7, p.seed) - 0.5) * 0.9;
    // Pebbles: 2×2 clusters on a coarse grid (lit top-left pixel).
    if (hash2(p.x >> 1, p.y >> 1, p.seed + 3) > 0.975) return (p.x & 1) === 0 && (p.y & 1) === 0 ? PAL.stone[3] : PAL.stone[1];
    if (Math.abs(noise2(p.x, p.y * 2, 5, p.seed + 9) - 0.5) < 0.025) v -= 1; // roots and cracks
    return dz(r, v, p.x, p.y);
  },
  sand: (p) => {
    const r = PAL.sand;
    let v = 2.4 + deep(p.up) * 0.8;
    // Wavy strata every ~10 px.
    if ((p.y + Math.round(noise2(p.x, 0, 24, p.seed) * 6)) % 10 === 0) v -= 0.8;
    if (hash2(p.x, p.y, p.seed) > 0.97) v += 1;
    return dz(r, v, p.x, p.y, 0.6);
  },
  rock: (p) => {
    const r = PAL.stone;
    let v = 2 + deep(p.up) + (noise2(p.x, p.y, 9, p.seed) - 0.5) * 1.1;
    const n = noise2(p.x, p.y, 11, p.seed + 5);
    if (Math.abs(n - 0.5) < 0.03) v = 0; // cracks
    if ((p.y + Math.round(noise2(p.x, 0, 30, p.seed + 1) * 8)) % 14 === 0) v -= 0.9; // strata
    return dz(r, v, p.x, p.y, 0.7);
  },
  snow: (p) => {
    const r = PAL.snow;
    const v = 2.3 + deep(p.up) * 1.1 + (noise2(p.x, p.y, 8, p.seed) - 0.5) * 0.7;
    if (hash2(p.x, p.y, p.seed + 1) > 0.992) return PAL.snow[3];
    return dz(r, v, p.x, p.y, 0.7);
  },
  ice: (p) => {
    const r: Ramp = [PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2], PAL.snow[1]];
    let v = 2.6 + deep(p.up);
    if ((p.x + p.y * 2) % 23 === 0 || (p.x * 2 - p.y) % 31 === 0) v += 1.1; // facets
    if (hash2(p.x, p.y, p.seed + 7) > 0.99) return PAL.snow[3]; // bubbles
    return dz(r, v, p.x, p.y, 0.5);
  },
  mud: (p) => {
    const r: Ramp = [PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.brown[2]];
    const v = 2.1 + deep(p.up) + (noise2(p.x, p.y, 6, p.seed) - 0.5);
    if (p.up < 6 && hash2(p.x, p.y, p.seed + 2) > 0.95) return PAL.brown[3]; // wet glints
    return dz(r, v, p.x, p.y);
  },
  metal: (p) => {
    const r = PAL.steel;
    const gx = ((p.x % 16) + 16) % 16;
    const gy = ((p.y % 8) + 8) % 8;
    if (gx === 0 || gy === 0) return r[0];
    let v = 2 + deep(p.up) * 0.7;
    if (gx === 1 || gy === 1) v += 1;
    if (gx === 15 || gy === 7) v -= 0.8;
    if ((gx === 3 && gy === 2) || (gx === 13 && gy === 2)) return r[4];
    // Tread-plate diamonds.
    if ((gx + gy * 2) % 6 === 0 && gy > 1 && gy < 7) v += 0.7;
    return dz(r, v, p.x, p.y, 0.4);
  },
  klinker: (p) => {
    const d = p.up;
    if (d < KLINKER_ROWS[KLINKER_ROWS.length - 1]) {
      // Street bricks in perspective: the rows grow taller and wider toward the viewer.
      let r = 0;
      while (KLINKER_ROWS[r + 1] <= d) r++;
      const yIn = d - KLINKER_ROWS[r];
      const rh = KLINKER_ROWS[r + 1] - KLINKER_ROWS[r];
      const bw = 5 + r * 2;
      const xs = p.x + (r % 2) * (bw >> 1);
      const bx = Math.floor(xs / bw);
      const xIn = ((xs % bw) + bw) % bw;
      if (yIn === rh - 1 || xIn === 0) return PAL.stone[1];
      const h = hash2(bx, r, p.seed + 41);
      if (h > 0.9) return yIn === 0 ? PAL.rust[2] : PAL.brown[2]; // a reddish klinker
      if (yIn === 0 || xIn === 1) return PAL.stone[3];
      return h < 0.25 ? PAL.stone[1] : PAL.stone[2];
    }
    // The quay wall under the street: a granite kerb, then dark brick going darker down.
    const k = d - KLINKER_ROWS[KLINKER_ROWS.length - 1];
    if (k === 0) return PAL.stone[3];
    if (k === 1) return PAL.stone[2];
    if (k === 2) return PAL.ink[1];
    const row = (k - 3) >> 2;
    const by = (k - 3) & 3;
    const xs = p.x + (row % 2) * 4;
    if (by === 3 || ((xs % 8) + 8) % 8 === 0) return PAL.ink[1];
    const v = 2.2 - k / 14 + (hash2(xs >> 3, row, p.seed + 5) - 0.5) * 0.9;
    return dz([PAL.ink[1], PAL.brown[0], PAL.rust[0], PAL.brown[1]], v, p.x, p.y, 0.5);
  },
  concrete: (p) => {
    const r = PAL.stone;
    let v = 2.2 + deep(p.up) + (noise2(p.x, p.y, 5, p.seed) - 0.5) * 0.8;
    if (((p.y % 12) + 12) % 12 === 0) v -= 0.8; // pour lines
    if (Math.abs(noise2(p.x, p.y, 13, p.seed + 3) - 0.5) < 0.02) v -= 1.2; // cracks
    return dz(r, v, p.x, p.y, 0.6);
  },
  // --- Oldenzaal (2026-10-21, additive): red-brown brick pavers in a herringbone, in perspective.
  'oz-pavers': (p) => {
    const z0 = ozPaverZ(p.up);
    const z1 = ozPaverZ(p.up + 1);
    const c = ozPaverCell(p.x + 0.5, (z0 + z1) / 2);
    if (ozDrainAt(p.x, p.up, p.seed)) return ((p.x + p.up) & 1) === 0 ? PAL.ink[0] : PAL.steel[1];
    if (p.up === 0) return PAL.brown[0];
    const zj = Math.floor(z1 / OZ_PAVER_A) > Math.floor(z0 / OZ_PAVER_A) && (c.m !== 2);
    if (c.fx < 1 && c.m !== 1) return PAL.ink[1];
    if (zj) return PAL.ink[1];
    const h = hash2(c.bx, c.bz, p.seed + 91);
    if (h > 0.9) return PAL.rust[0];
    if (h > 0.84 && p.up >= 8) return PAL.red[1];
    return PAL.brown[1];
  },
  // --- Oldenzaal, the church (CHURCH, wave B, additive): worn sandstone flags in perspective (the
  // nave) and rough dark flags (the crypt). HD: content/oldenzaal/church/art-terrain.ts.
  'oz-nave-floor': (p) => {
    const f = ozFlagAt(p.x, p.up, p.up + 1, false);
    if (p.up === 0) return PAL.ink[1];
    if (f.joint) return PAL.ink[1];
    const h = hash2(f.col, f.row, p.seed + 41);
    if (h > 0.86) return PAL.stone[0];
    return p.up > 14 && h < 0.5 ? PAL.stone[2] : PAL.stone[1];
  },
  'oz-crypt-floor': (p) => {
    const f = ozFlagAt(p.x, p.up, p.up + 1, true);
    if (p.up === 0) return PAL.ink[0];
    if (f.joint) return PAL.ink[0];
    const h = hash2(f.col, f.row, p.seed + 43);
    return h > 0.7 ? PAL.brown[0] : h > 0.2 ? PAL.stone[0] : PAL.stone[1];
  },
};

/**
 * The church's flagstones (oz-nave-floor, oz-crypt-floor): the flag under the screen span of
 * depth u0 … u1 below the floor line at x (rows by the plan depth `ozPaverZ`, staggered by half a
 * flag). `joint`: a row boundary inside the span, or x within `jw` px of the flag's left edge.
 * `fx` / `fz`: the offset inside the flag (0 … 1).
 */
export function ozFlagAt(x: number, u0: number, u1: number, crypt: boolean, jw = 1): { row: number; col: number; fx: number; fz: number; joint: boolean } {
  const depth = crypt ? 7 : 10;
  const width = crypt ? 17 : 26;
  const z0 = ozPaverZ(u0);
  const z1 = ozPaverZ(u1);
  const z = (z0 + z1) / 2;
  const row = Math.floor(z / depth);
  const off = (row & 1) * (width >> 1) + (crypt ? (row % 3) * 3 : 0);
  const xx = x + off;
  const col = Math.floor(xx / width);
  const fx = (xx - col * width) / width;
  const fz = (z - row * depth) / depth;
  const rowJoint = Math.floor(z1 / depth) > Math.floor(z0 / depth);
  return { row, col, fx, fz, joint: rowJoint || xx - col * width < jw };
}

/** Oldenzaal pavers: the herringbone's unit (plan units; a brick is 2 × 1 units). */
export const OZ_PAVER_A = 4;

/** Plan depth (units) of screen depth `up` below the street line (perspective: near rows are taller). */
export function ozPaverZ(up: number): number {
  return 80 * Math.log(1 + up / 40);
}

/**
 * The herringbone cell at plan (x, z): m = (s − t) mod 4 (0, 1: the left and right half of a
 * horizontal brick; 3, 2: the lower and upper half of a vertical brick), fx the offset in the
 * cell (units), the brick's id (bx, bz).
 */
export function ozPaverCell(x: number, z: number): { m: number; fx: number; fz: number; bx: number; bz: number } {
  const a = OZ_PAVER_A;
  const s = Math.floor(x / a);
  const t = Math.floor(z / a);
  const m = (((s - t) % 4) + 4) % 4;
  return { m, fx: x - s * a, fz: z - t * a, bx: m === 1 ? s - 1 : s, bz: m === 2 ? t - 1 : t };
}

/** Drains in the paver gutter: every 384 px (from x 196 + 37 × seed), 8 px wide, rows 3 … 5. */
export function ozDrainAt(x: number, up: number, seed: number): boolean {
  if (up < 3 || up > 5) return false;
  const k = (((x - 196 - 37 * seed) % 384) + 384) % 384;
  return k < 8;
}


/** Klinker pavement row boundaries (depth below the surface); the quay wall starts at the last. */
export const KLINKER_ROWS: readonly number[] = [0, 3, 6, 9, 13, 17, 22, 28];

// ------------------------------------------------------------------------------------ edges

interface EdgeMat {
  /** Band thickness in px (can vary per column via `ragged`). */
  depth: number;
  ragged: number;
  paint: (p: Px, ground: Paint) => Color;
  /** Tuft colour above the surface (null = none) and max tuft height. */
  tuft: Color | null;
  tuftH: number;
  /** Lip colour hanging over cliff tops (null = none). */
  lip: Color | null;
}

const EDGE: Readonly<Record<string, EdgeMat>> = {
  grass: {
    depth: 4,
    ragged: 2,
    paint: (p) => {
      const r = PAL.green;
      if (p.up === 0) return r[4];
      if (p.up === 1) return hash1(p.x, p.seed) > 0.3 ? r[3] : r[4];
      return (p.x + p.up) % 3 === 0 ? r[1] : r[2];
    },
    tuft: PAL.green[3],
    tuftH: 3,
    lip: PAL.green[2],
  },
  snow: {
    depth: 4,
    ragged: 2,
    paint: (p) => (p.up <= 1 ? PAL.snow[3] : p.up === 2 ? PAL.snow[2] : PAL.snow[1]),
    tuft: PAL.snow[3],
    tuftH: 1,
    lip: PAL.snow[2],
  },
  sand: {
    depth: 3,
    ragged: 1,
    paint: (p) => (p.up === 0 ? PAL.sand[3] : (p.x + p.up * 3) % 7 === 0 ? PAL.sand[1] : PAL.sand[2]),
    tuft: null,
    tuftH: 0,
    lip: null,
  },
  moss: {
    depth: 3,
    ragged: 3,
    paint: (p, ground) => (hash2(p.x, p.y, p.seed + 4) > 0.25 ? (p.up === 0 ? PAL.green[2] : PAL.green[1]) : ground(p)),
    tuft: PAL.green[1],
    tuftH: 1,
    lip: PAL.green[1],
  },
  rust: {
    depth: 3,
    ragged: 6,
    paint: (p) => (p.up === 0 ? PAL.rust[3] : p.up < 2 ? PAL.rust[2] : PAL.rust[1]),
    tuft: null,
    tuftH: 0,
    lip: null,
  },
  tiles: {
    depth: 4,
    ragged: 0,
    paint: (p) => {
      const r = PAL.stone;
      const gx = ((p.x % 10) + 10) % 10;
      if (p.up === 3 || gx === 0) return r[0];
      if (p.up === 0) return r[3];
      return gx === 1 ? r[3] : r[2];
    },
    tuft: null,
    tuftH: 0,
    lip: null,
  },
  bikepath: {
    depth: 6,
    ragged: 0,
    paint: (p) => {
      // Red asphalt with grit, a lit top row, then a white kerb line and its shadow.
      if (p.up === 0) return hash1(p.x, p.seed + 3) > 0.85 ? PAL.red[3] : PAL.red[2];
      if (p.up === 4) return PAL.snow[2];
      if (p.up === 5) return PAL.stone[1];
      const g = hash2(p.x, p.y, p.seed + 7);
      return g > 0.86 ? PAL.rust[1] : g < 0.08 ? PAL.red[0] : PAL.red[1];
    },
    tuft: null,
    tuftH: 0,
    lip: null,
  },
  kerb: {
    depth: 3,
    ragged: 0,
    paint: (p) => (p.up === 0 ? PAL.stone[3] : p.up === 1 ? (((p.x % 24) + 24) % 24 === 0 ? PAL.stone[1] : PAL.stone[2]) : PAL.stone[0]),
    tuft: null,
    tuftH: 0,
    lip: null,
  },
};

// ------------------------------------------------------------------------------------ platforms

interface PlatMat {
  paint: Paint;
  /** Decoration hanging below the band: colour for a pixel `k` rows below (0-based), or 0. */
  hang: (x: number, k: number, seed: number) => Color;
}

const PLATFORM: Readonly<Record<string, PlatMat>> = {
  wood: {
    paint: (p) => {
      const r = PAL.brown;
      if (p.left === 1 || p.right === 1) return r[1];
      if (p.up === 1) return r[3];
      if (p.down === 1) return r[1];
      const seam = ((p.x % 14) + 14) % 14;
      if (seam === 0) return r[0];
      if (seam === 2 && p.up === 2) return PAL.steel[3]; // nail
      return r[2];
    },
    hang: () => 0,
  },
  metal: {
    paint: (p) => {
      const r = PAL.steel;
      if (p.up === 1) return r[3];
      if (p.down === 1) return r[1];
      if (p.left === 1 || p.right === 1) return r[1];
      return ((p.x + p.up) % 3 === 0) ? PAL.ink[1] : r[2];
    },
    hang: (x, k) => {
      // Brackets every 24 px: a small triangle under the band.
      const m = ((x % 24) + 24) % 24;
      return m < 4 - k && k < 3 ? (m === 0 ? PAL.steel[3] : PAL.steel[1]) : 0;
    },
  },
  rock: {
    paint: (p) => {
      const r = PAL.stone;
      if (p.up === 1) return r[3];
      return dz(r, 2 - (p.up - 1) * 0.5 + (noise2(p.x, p.y, 4, p.seed) - 0.5), p.x, p.y);
    },
    hang: (x, k, seed) => (k < Math.floor(hash1(x, seed + 5) * 4) - 1 ? PAL.stone[1] : 0),
  },
  whitewood: {
    paint: (p) => {
      if (p.left === 1 || p.right === 1) return PAL.snow[0];
      if (p.up === 1) return PAL.snow[3];
      if (p.down === 1) return PAL.steel[3];
      return ((p.x % 12) + 12) % 12 === 0 ? PAL.snow[1] : PAL.snow[2];
    },
    hang: (x, k) => {
      // Cross beams every 32 px under the deck.
      const m = ((x % 32) + 32) % 32;
      return k < 3 && m < 3 ? (m === 0 ? PAL.snow[2] : PAL.snow[1]) : 0;
    },
  },
  ice: {
    paint: (p) => (p.up === 1 ? PAL.snow[3] : p.up === 2 ? PAL.snow[2] : PAL.sky[2]),
    hang: (x, k, seed) => {
      const len = hash1(Math.floor(x / 2), seed + 9) > 0.55 ? 1 + Math.floor(hash1(x, seed + 3) * 5) : 0;
      return k < len ? (k === len - 1 ? PAL.snow[3] : PAL.sky[2]) : 0;
    },
  },
  // --- Oldenzaal (additive): the dark iron rail on top of an awning, a balcony's or a bay's lead flashing.
  'oz-ledge': {
    paint: (p) => (p.up === 1 ? PAL.steel[2] : p.up === 2 ? PAL.steel[1] : p.down === 1 ? PAL.ink[0] : PAL.ink[1]),
    hang: () => 0,
  },
  // --- Oldenzaal, the church (CHURCH, additive): the dark oak top rail of a pew back / a coffin lid.
  'oz-pew': {
    paint: (p) => (p.up === 1 ? PAL.brown[2] : p.up === 2 ? PAL.brown[1] : p.down === 1 ? PAL.ink[0] : PAL.brown[0]),
    hang: () => 0,
  },
};

// ------------------------------------------------------------------------------------ solids

const SOLID: Readonly<Record<string, Paint>> = {
  metal: (p) => {
    const r = PAL.steel;
    if (p.up === 1 || p.left === 1) return r[4];
    if (p.down === 1 || p.right === 1) return r[0];
    if (p.up === 2 || p.left === 2) return r[3];
    const gx = p.left < MAX_SIDE ? (p.left - 1) % 16 : ((p.x % 16) + 16) % 16;
    const gy = p.up < MAX_UP ? (p.up - 1) % 16 : ((p.y % 16) + 16) % 16;
    if (gx === 0 || gy === 0) return r[1];
    if ((gx === 3 || gx === 13) && (gy === 3 || gy === 13)) return r[4];
    return gx === 1 || gy === 1 ? r[3] : r[2];
  },
  concrete: (p) => {
    const r = PAL.stone;
    if (p.up === 1 || p.left === 1) return r[3];
    if (p.down === 1 || p.right === 1) return r[0];
    let v = 2 + (noise2(p.x, p.y, 5, p.seed) - 0.5) * 0.8;
    if ((p.up - 1) % 10 === 0) v -= 0.8;
    return dz(r, v, p.x, p.y, 0.6);
  },
  crate: (p) => {
    const r = PAL.brown;
    // Crates on a 16-px grid measured from the block's top-left corner.
    const gx = p.left < MAX_SIDE ? (p.left - 1) % 16 : ((p.x % 16) + 16) % 16;
    const gy = p.up < MAX_UP ? (p.up - 1) % 16 : ((p.y % 16) + 16) % 16;
    if (gx === 0 || gy === 0) return r[3];
    if (gx === 15 || gy === 15) return r[0];
    if (gx === 1 || gy === 1 || gx === 14 || gy === 14) return r[1];
    if (Math.abs(gx - gy) <= 0) return r[1]; // diagonal brace
    if (Math.abs(gx - gy) === 1) return r[3];
    return r[2];
  },
  rock: (p) => {
    const r = PAL.stone;
    if (p.up === 1) return r[3];
    if (p.down === 1 || p.right === 1) return r[0];
    const v = 2 + (noise2(p.x, p.y, 6, p.seed) - 0.5) * 1.4 - (p.left === 1 ? -0.8 : 0);
    if (Math.abs(noise2(p.x, p.y, 8, p.seed + 2) - 0.5) < 0.03) return r[0];
    return dz(r, v, p.x, p.y, 0.7);
  },
  brick: (p) => {
    const r: Ramp = [PAL.brown[0], PAL.rust[0], PAL.rust[1], PAL.red[2], PAL.red[3]];
    if (p.down === 1 || p.right === 1) return PAL.ink[1];
    const row = Math.floor((p.up - 1) / 4);
    const off = row % 2 === 0 ? 0 : 4;
    const bx = ((p.left - 1 + off) % 8 + 8) % 8;
    const by = (p.up - 1) % 4;
    if (by === 3 || bx === 7) return PAL.stone[1]; // mortar
    if (by === 0 || bx === 0) return r[3];
    return hash2(Math.floor((p.left - 1 + off) / 8), row, p.seed) > 0.6 ? r[1] : r[2];
  },
  // --- Oldenzaal (additive): a low dark-red brick wall under a sandstone coping.
  'oz-brick': (p) => {
    if (p.up <= 3) return p.up === 1 ? PAL.stone[3] : p.up === 2 ? PAL.stone[2] : PAL.stone[0];
    if (p.down === 1) return PAL.ink[1];
    const row = Math.floor((p.up - 4) / 3);
    const off = row % 2 === 0 ? 0 : 3;
    const bx = (((p.left - 1 + off) % 6) + 6) % 6;
    if ((p.up - 4) % 3 === 2 || bx === 5) return PAL.ink[1];
    return hash2(Math.floor((p.left - 1 + off) / 6), row, p.seed + 3) > 0.6 ? PAL.brown[1] : PAL.rust[0];
  },
  // --- Oldenzaal, the church (CHURCH, additive): sandstone steps and blocks (a lit tread, joints).
  'oz-nave-step': (p) => {
    if (p.up === 1) return PAL.stone[3];
    if (p.down === 1 || p.right === 1) return PAL.ink[1];
    if (p.up === 2 || p.left === 1) return PAL.stone[2];
    if ((p.up - 1) % 6 === 0 || (((p.left - 1 + (Math.floor((p.up - 1) / 6) & 1) * 9) % 18) + 18) % 18 === 0) return PAL.stone[0];
    return PAL.stone[1];
  },
};

// ------------------------------------------------------------------------------------ run lengths

/** Run lengths of equal cells along one axis, clamped to `max`. */
function runs(cells: Uint8Array, out: Uint8Array, start: number, count: number, stride: number, max: number): void {
  let prev = -1;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const k = start + i * stride;
    const c = cells[k];
    n = c === prev ? Math.min(max, n + 1) : 1;
    prev = c;
    out[k] = n;
  }
}

// ------------------------------------------------------------------------------------ HD materials

/**
 * An HD terrain material (UHD art, d ∈ {2, 4}): fill the d × d art px of logical pixel `p` (the
 * same Px the 1× material gets: for ground and edge `p.up` = depth below the surface, 0 at the top
 * pixel) with opaque PAL_HD colours. The block's top-left art px is `out[i]`, the next art row
 * `out[i + stride]`. World art coordinates are `d·p.x + sx` and `d·p.y + sy` (or `d·p.up + sy`),
 * so chunks join without seams.
 */
export type HdTerrainPaint = (p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number) => void;
export type TerrainMaterialKind = 'ground' | 'edge' | 'platform' | 'solid';

const HD: Readonly<Record<TerrainMaterialKind, Map<string, HdTerrainPaint>>> = {
  ground: new Map(),
  edge: new Map(),
  platform: new Map(),
  solid: new Map(),
};

/** Add (or replace) the HD (2× and 4×) version of a material (see the module comment). */
export function defineHdTerrainMaterial(kind: TerrainMaterialKind, id: string, paint: HdTerrainPaint): void {
  HD[kind].set(id, paint);
}

/**
 * An HD hanger: fill the d × d art px of the hanger pixel `k` rows (0-based) below a platform band
 * at world column x. Only called where the 1× `hang` paints (the same footprint).
 */
export type HdTerrainHang = (x: number, k: number, seed: number, d: number, out: Uint32Array, i: number, stride: number) => void;

const HD_HANG = new Map<string, HdTerrainHang>();

/** Add (or replace) the HD hangers under a platform material. */
export function defineHdTerrainHang(platform: string, hang: HdTerrainHang): void {
  HD_HANG.set(platform, hang);
}

/** Does material `id` of `kind` have an HD (2× and 4×) version? */
export function hasHdTerrainMaterial(kind: TerrainMaterialKind, id: string): boolean {
  return HD[kind].has(id);
}

/** The same as hasHdTerrainMaterial (the HD materials serve the 2× tier too). */
export const hasHiTerrainMaterial = hasHdTerrainMaterial;

/** Material ids a style resolves to (unknown ids fall back like the painter does). */
function materialIds(style: TerrainStyleDef): Record<TerrainMaterialKind, string | undefined> {
  return {
    ground: GROUND[style.ground] ? style.ground : 'dirt',
    edge: style.edge && EDGE[style.edge] ? style.edge : undefined,
    platform: PLATFORM[style.platform ?? 'wood'] ? (style.platform ?? 'wood') : 'wood',
    solid: SOLID[style.solid ?? 'metal'] ? (style.solid ?? 'metal') : 'metal',
  };
}

/** Does any material of `style` have an HD version? */
export function styleHasHdTerrain(style: TerrainStyleDef): boolean {
  const ids = materialIds(style);
  return (Object.keys(HD) as TerrainMaterialKind[]).some((k) => ids[k] !== undefined && HD[k].has(ids[k] as string));
}

// ------------------------------------------------------------------------------------ HD tone steps

const stepCache = new Map<number, Color>();

/**
 * `c` moved `n` tones along its PAL_HD ramp (clamped; + = lighter). Colours outside PAL_HD stay.
 * Used for the cliff faces (lit left face, shaded right face and underside) of HD terrain.
 */
export function hdShift(c: Color, n: number): Color {
  const key = (((c >>> 0) & 0xffffff00) >>> 0) * 16 + (n + 8);
  const hit = stepCache.get(key);
  if (hit !== undefined) return hit;
  const home = hdHome(c);
  let out = c;
  if (home) {
    const i = home.i + n;
    out = home.ramp[i < 0 ? 0 : i >= home.ramp.length ? home.ramp.length - 1 : i];
  }
  stepCache.set(key, out);
  return out;
}

// ------------------------------------------------------------------------------------ classification

/** The sampled cells around a rect and their run lengths (shared by the 1× and the HD painter). */
interface Grid {
  GW: number;
  GH: number;
  cells: Uint8Array;
  up: Uint8Array;
  down: Uint8Array;
  left: Uint8Array;
  right: Uint8Array;
}

function classify(sample: TerrainSampler, x0: number, y0: number, w: number, h: number): Grid {
  // Sample the chunk plus margins.
  const GW = w + PAD_X * 2;
  const GH = h + PAD_UP + PAD_DOWN;
  const gx0 = x0 - PAD_X;
  const gy0 = y0 - PAD_UP;
  const cells = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) cells[y * GW + x] = sample(gx0 + x, gy0 + y);
  // Run lengths in four directions.
  const up = new Uint8Array(GW * GH);
  const down = new Uint8Array(GW * GH);
  const left = new Uint8Array(GW * GH);
  const right = new Uint8Array(GW * GH);
  for (let x = 0; x < GW; x++) {
    runs(cells, up, x, GH, GW, MAX_UP);
    runs(cells, down, x + (GH - 1) * GW, GH, -GW, MAX_DOWN);
  }
  for (let y = 0; y < GH; y++) {
    runs(cells, left, y * GW, GW, 1, MAX_SIDE);
    runs(cells, right, y * GW + GW - 1, GW, -1, MAX_SIDE);
  }
  return { GW, GH, cells, up, down, left, right };
}

// ------------------------------------------------------------------------------------ painters

/**
 * Paint terrain cells for the world rect (x0, y0, w, h). Colours depend only on world
 * coordinates, the sampled terrain and the style (seamless across chunks).
 */
export const paintTerrain: TerrainPainter = (sample: TerrainSampler, style: TerrainStyleDef, x0, y0, w, h) => paintRect(sample, style, x0, y0, w, h);

/**
 * The 1× painter. Every logical pixel gets a base colour from its material, then a cliff /
 * underside pass (`post`: 1 = one step lighter, 2 = a fixed dark colour).
 */
function paintRect(sample: TerrainSampler, style: TerrainStyleDef, x0: number, y0: number, w: number, h: number): PixelBuffer {
  const ground = GROUND[style.ground] ?? GROUND.dirt;
  const edge = style.edge ? EDGE[style.edge] : undefined;
  const plat = PLATFORM[style.platform ?? 'wood'] ?? PLATFORM.wood;
  const solid = SOLID[style.solid ?? 'metal'] ?? SOLID.metal;
  const seed = style.seed ?? 1;
  const { GW, GH, cells, up, down, left, right } = classify(sample, x0, y0, w, h);

  const out = new PixelBuffer(w, h);
  const data = out.data;
  const p: Px = { x: 0, y: 0, up: 0, down: 0, left: 0, right: 0, seed };
  const cellAt = (gx: number, gy: number): number => (gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : cells[gy * GW + gx]);
  for (let y = 0; y < h; y++) {
    const gy = y + PAD_UP;
    for (let x = 0; x < w; x++) {
      const gx = x + PAD_X;
      const k = gy * GW + gx;
      const c = cells[k];
      p.x = x0 + x;
      p.y = y0 + y;
      p.up = up[k];
      p.down = down[k];
      p.left = left[k];
      p.right = right[k];
      let col: Color = 0;
      let post = 0;
      let postCol: Color = 0;
      if (c === 1) {
        // up − 1 = depth below the surface (0 at the top pixel).
        const depth = p.up - 1;
        const band = edge ? edge.depth + Math.floor(hash1(p.x >> 1, seed + 17) * (edge.ragged + 1)) : 0;
        const q: Px = { ...p, up: depth };
        if (edge && depth < band && cellAt(gx, gy - depth - 1) === 0) col = edge.paint(q, ground);
        else col = ground(q);
        // Cliff walls (not slopes): lit left face, dark right face; dark underside.
        const inBand = edge !== undefined && depth < band;
        if (!inBand && cellAt(gx - 1, gy) === 0 && cellAt(gx - 1, gy + 1) === 0) post = 1;
        if (!inBand && cellAt(gx + 1, gy) === 0 && cellAt(gx + 1, gy + 1) === 0) {
          post = 2;
          postCol = PAL.ink[1];
        }
        if (p.down === 1 && cellAt(gx, gy + 1) === 0) {
          post = 2;
          postCol = INK;
        }
      } else if (c === 2) {
        col = plat.paint(p);
      } else if (c === 3) {
        col = solid(p);
      } else {
        col = decorate(cellAt, gx, gy, p, edge, plat, up, GW, seed);
      }
      if (post === 1) col = stepShade(col, 1);
      else if (post === 2) col = postCol;
      if (col !== 0) data[y * w + x] = col >>> 0;
    }
  }
  return out.touch();
}

/** Fill a d × d block with one colour. */
function fillBlock(data: Uint32Array, i: number, stride: number, d: number, col: Color): void {
  const c = col >>> 0;
  for (let sy = 0; sy < d; sy++) data.fill(c, i + sy * stride, i + sy * stride + d);
}

/** Move every art px of a d × d block `n` tones along its PAL_HD ramp. */
function shiftBlock(data: Uint32Array, i: number, stride: number, d: number, n: number): void {
  for (let sy = 0; sy < d; sy++) {
    const r = i + sy * stride;
    for (let sx = 0; sx < d; sx++) data[r + sx] = hdShift(data[r + sx], n) >>> 0;
  }
}

/**
 * The HD painter (UHD art, d ∈ {2, 4}): a (d·w) × (d·h) buffer of the same rect, or null when no
 * HD material paints a pixel of it. Every logical pixel is classified exactly like the 1× painter
 * (cells, bands, cliff faces, undersides, hangers), so the opaque footprint, the geometry and the
 * collision art are the 1× ones; an HD material fills the d × d art px of its logical pixel, a
 * material without one fills its 1× colour. Terrain has no ink outline (style decisions): the lit
 * left cliff face is one HD tone lighter, the right face and the underside three tones darker
 * (the 1× art uses ink there).
 */
export const paintTerrainHd: HdTerrainPainter = (sample, style, x0, y0, w, h, d) => {
  const ids = materialIds(style);
  const hdGround = HD.ground.get(ids.ground as string);
  const hdEdge = ids.edge ? HD.edge.get(ids.edge) : undefined;
  const hdPlat = HD.platform.get(ids.platform as string);
  const hdSolid = HD.solid.get(ids.solid as string);
  const hdHang = HD_HANG.get(ids.platform as string);
  if (!hdGround && !hdEdge && !hdPlat && !hdSolid) return null;
  const ground = GROUND[style.ground] ?? GROUND.dirt;
  const edge = style.edge ? EDGE[style.edge] : undefined;
  const plat = PLATFORM[style.platform ?? 'wood'] ?? PLATFORM.wood;
  const solid = SOLID[style.solid ?? 'metal'] ?? SOLID.metal;
  const seed = style.seed ?? 1;
  const { GW, GH, cells, up, down, left, right } = classify(sample, x0, y0, w, h);

  const out = new PixelBuffer(w * d, h * d);
  const ow = out.w;
  const data = out.data;
  let usedHd = false;
  const p: Px = { x: 0, y: 0, up: 0, down: 0, left: 0, right: 0, seed };
  const q: Px = { x: 0, y: 0, up: 0, down: 0, left: 0, right: 0, seed };
  const cellAt = (gx: number, gy: number): number => (gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : cells[gy * GW + gx]);
  // Rows with any cell: an empty pixel can only get a decoration (hanger, tuft, lip) when a row
  // from 6 above to 4 below it has one (decorate looks no further), so all-empty bands are skipped.
  const rowUsed = new Uint8Array(GH);
  for (let gy = 0; gy < GH; gy++) {
    const r0 = gy * GW;
    for (let gx = 0; gx < GW; gx++) {
      if (cells[r0 + gx] !== 0) {
        rowUsed[gy] = 1;
        break;
      }
    }
  }
  const bandAt = (x: number): number => (edge ? edge.depth + Math.floor(hash1(x >> 1, seed + 17) * (edge.ragged + 1)) : 0);
  /** Paint the block of ground cell (gx, gy) — its edge band or ground material — at dst[di]. */
  const groundBlock = (gx: number, gy: number, dst: Uint32Array, di: number, ds: number): void => {
    const k = gy * GW + gx;
    // up − 1 = depth below the surface (0 at the top pixel).
    const depth = up[k] - 1;
    q.x = x0 + gx - PAD_X;
    q.y = y0 + gy - PAD_UP;
    q.up = depth;
    q.down = down[k];
    q.left = left[k];
    q.right = right[k];
    if (edge && depth < bandAt(q.x) && cellAt(gx, gy - depth - 1) === 0) {
      if (hdEdge) {
        hdEdge(q, d, dst, di, ds);
        usedHd = true;
      } else fillBlock(dst, di, ds, d, edge.paint({ ...q }, ground));
    } else if (hdGround) {
      hdGround(q, d, dst, di, ds);
      usedHd = true;
    } else fillBlock(dst, di, ds, d, ground({ ...q }));
  };
  // Slopes: the 1× surface steps by whole px; the HD bands follow a smoothed surface line (the mean
  // run top of the columns around, R each side), shifted at most ½ logical px per art column, so
  // the opaque footprint stays the 1× one. runTop = the grid row where a ground cell's vertical
  // run starts (−1: above the grid, unknown → no shift).
  const runTop = new Int16Array(GW * GH);
  for (let gx = 0; gx < GW; gx++) {
    let start = -1;
    for (let gy = 0; gy < GH; gy++) {
      const k = gy * GW + gx;
      if (cells[k] !== 1) {
        runTop[k] = -1;
        continue;
      }
      if (gy > 0 && cells[k - GW] !== 1) start = gy;
      else if (gy === 0) start = -1;
      runTop[k] = start;
    }
  }
  const R = 2;
  /** The run top of column gx near row rs (probed R + 1 rows down), or −1. */
  const topNear = (gx: number, rs: number): number => {
    if (gx < 0 || gx >= GW) return -1;
    const gy = Math.min(GH - 1, rs + R + 1);
    const r2 = runTop[gy * GW + gx];
    return r2 >= 0 && Math.abs(r2 - rs) <= R + 1 ? r2 : -1;
  };
  const smoothRs = new Int16Array(GW).fill(-9);
  const smoothVal = new Float64Array(GW);
  /** The smoothed surface (grid rows) of column gx whose run starts at rs. */
  const smooth = (gx: number, rs: number): number => {
    if (smoothRs[gx] === rs) return smoothVal[gx];
    let sum = 0;
    let n = 0;
    for (let dx = -R; dx <= R; dx++) {
      const r2 = topNear(gx + dx, rs);
      if (r2 < 0) continue;
      sum += r2;
      n++;
    }
    const v = n > 0 ? sum / n : rs;
    smoothRs[gx] = rs;
    smoothVal[gx] = v;
    return v;
  };
  const shiftO = new Int8Array(d);
  let shiftMin = 0;
  let shiftMax = 0;
  const scratch = new Uint32Array(3 * d * d);
  /** Fill shiftO with the art-px shift of each sub-column of ground cell (gx, gy); false when all 0. */
  const slopeShift = (gx: number, gy: number): boolean => {
    const rs = runTop[gy * GW + gx];
    if (rs < 0) return false;
    const s = smooth(gx, rs);
    const l = topNear(gx - 1, rs);
    const r = topNear(gx + 1, rs);
    const sl = l >= 0 ? smooth(gx - 1, l) : s;
    const sr = r >= 0 ? smooth(gx + 1, r) : s;
    shiftMin = 0;
    shiftMax = 0;
    for (let sx = 0; sx < d; sx++) {
      const u = (sx + 0.5) / d - 0.5;
      const v = (u < 0 ? s + (sl - s) * -u : s + (sr - s) * u) - rs;
      const o = Math.round((v < -0.5 ? -0.5 : v > 0.5 ? 0.5 : v) * d) | 0;
      shiftO[sx] = o;
      if (o < shiftMin) shiftMin = o;
      if (o > shiftMax) shiftMax = o;
    }
    return shiftMin !== 0 || shiftMax !== 0;
  };
  for (let y = 0; y < h; y++) {
    const gy = y + PAD_UP;
    let near = false;
    for (let j = Math.max(0, gy - 6); j <= Math.min(GH - 1, gy + 4) && !near; j++) near = rowUsed[j] === 1;
    if (!near) continue;
    for (let x = 0; x < w; x++) {
      const gx = x + PAD_X;
      const k = gy * GW + gx;
      const c = cells[k];
      const i = y * d * ow + x * d;
      p.x = x0 + x;
      p.y = y0 + y;
      p.up = up[k];
      p.down = down[k];
      p.left = left[k];
      p.right = right[k];
      if (c === 0) {
        const col = decorate(cellAt, gx, gy, p, edge, plat, up, GW, seed);
        if (col === 0) continue;
        if (hdHang) {
          // A hanger under a platform band gets its HD colours (tufts and lips keep their 1× colour).
          const row = hangRow(cellAt, gx, gy);
          if (row >= 0 && plat.hang(p.x, row, seed) === col) {
            hdHang(p.x, row, seed, d, data, i, ow);
            usedHd = true;
            continue;
          }
        }
        fillBlock(data, i, ow, d, col);
        continue;
      }
      let post = 0;
      if (c === 1) {
        if (!slopeShift(gx, gy)) groundBlock(gx, gy, data, i, ow);
        else {
          // On a slope: the column's art px take the colours d·shift art px above or below, from the
          // blocks above (ground only), here and below; the top art px keeps the surface row.
          // Only the blocks a shift reaches are painted (up: a positive shift, down: a negative one).
          const hasAbove = cells[k - GW] === 1;
          const hasBelow = cells[k + GW] === 1;
          groundBlock(gx, gy, scratch, d * d, d);
          if (hasAbove && shiftMax > 0) groundBlock(gx, gy - 1, scratch, 0, d);
          if (hasBelow && shiftMin < 0) groundBlock(gx, gy + 1, scratch, 2 * d * d, d);
          for (let sx = 0; sx < d; sx++) {
            const o = shiftO[sx];
            for (let sy = 0; sy < d; sy++) {
              let s = d + sy - o;
              if ((!hasAbove && sy === 0) || (s < d && !hasAbove)) s = d;
              else if (s >= 2 * d && !hasBelow) s = 2 * d - 1;
              const b = s < d ? 0 : s < 2 * d ? 1 : 2;
              data[i + sy * ow + sx] = scratch[b * d * d + (s - b * d) * d + sx];
            }
          }
        }
        const inBand = edge !== undefined && up[k] - 1 < bandAt(p.x);
        // Cliff walls (not slopes): lit left face, shaded right face; shaded underside.
        if (!inBand && cellAt(gx - 1, gy) === 0 && cellAt(gx - 1, gy + 1) === 0) post = 1;
        if (!inBand && cellAt(gx + 1, gy) === 0 && cellAt(gx + 1, gy + 1) === 0) post = 2;
        if (p.down === 1 && cellAt(gx, gy + 1) === 0) post = 2;
      } else if (c === 2) {
        if (hdPlat) {
          hdPlat(p, d, data, i, ow);
          usedHd = true;
        } else fillBlock(data, i, ow, d, plat.paint(p));
      } else if (hdSolid) {
        hdSolid(p, d, data, i, ow);
        usedHd = true;
      } else fillBlock(data, i, ow, d, solid(p));
      if (post === 1) shiftBlock(data, i, ow, d, 1);
      else if (post === 2) shiftBlock(data, i, ow, d, -3);
    }
  }
  if (!usedHd) return null;
  return out.touch();
};

/** Rows (0-based) from an empty cell up to the platform band right above it, or −1. */
function hangRow(cellAt: (gx: number, gy: number) => number, gx: number, gy: number): number {
  for (let k = 0; k < 6; k++) {
    const c = cellAt(gx, gy - k - 1);
    if (c === 2) return k;
    if (c !== 0) return -1;
  }
  return -1;
}

/** Decorations in empty cells: tufts above surfaces, lips over cliff tops, hangers under platforms. */
function decorate(
  cellAt: (gx: number, gy: number) => number,
  gx: number,
  gy: number,
  p: Px,
  edge: EdgeMat | undefined,
  plat: PlatMat,
  up: Uint8Array,
  GW: number,
  seed: number,
): Color {
  if (edge?.tuft) {
    // Tufts: the ground surface is k px below and the column's tuft is at least k tall.
    const hgt = Math.floor(hash1(p.x, seed + 21) * (edge.tuftH + 1.5));
    for (let k = 1; k <= Math.min(hgt, edge.tuftH); k++) {
      if (cellAt(gx, gy + k) === 1) {
        let open = true;
        for (let j = 0; j < k; j++) if (cellAt(gx, gy + j) !== 0) open = false;
        if (open) return k === hgt ? stepShade(edge.tuft, 1) : edge.tuft;
        break;
      }
    }
  }
  if (edge?.lip) {
    // Lip hanging over a cliff top: ground surface right next to this empty pixel.
    for (const dx of [-1, 1]) {
      const n = cellAt(gx + dx, gy);
      if (n === 1 && up[gy * GW + gx + dx] <= 2 && cellAt(gx + dx, gy - up[gy * GW + gx + dx]) === 0) {
        if (hash2(p.x, p.y, seed + 33) > 0.35) return edge.lip;
      }
    }
  }
  // Hangers under a platform band.
  for (let k = 0; k < 6; k++) {
    if (cellAt(gx, gy - k - 1) === 2) {
      const c = plat.hang(p.x, k, seed);
      return c;
    }
    if (cellAt(gx, gy - k - 1) !== 0) break;
  }
  return 0;
}

setTerrainPainter(paintTerrain);
setHdTerrainPainter(paintTerrainHd, (style) => styleHasHdTerrain(style));
