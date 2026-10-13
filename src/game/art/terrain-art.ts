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
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, PAL, stepShade } from '../../engine/palette';
import { setTerrainPainter } from './art-registry';
import type { TerrainPainter, TerrainSampler, TerrainStyleDef } from './art-registry';
import { bayer, hash1, hash2, noise2 } from './paint';

/** Margins sampled around the chunk; distances are clamped below them. */
const PAD_X = 96;
const PAD_UP = 52;
const PAD_DOWN = 8;
const MAX_UP = 48;
const MAX_SIDE = 90;
const MAX_DOWN = 6;

/** Everything a material needs to know about one pixel. */
interface Px {
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
};

/** Klinker pavement row boundaries (depth below the surface); the quay wall starts at the last. */
const KLINKER_ROWS = [0, 3, 6, 9, 13, 17, 22, 28];

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
};

// ------------------------------------------------------------------------------------ painter

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

/**
 * Paint terrain cells for the world rect (x0, y0, w, h). Colours depend only on world
 * coordinates, the sampled terrain and the style (seamless across chunks).
 */
export const paintTerrain: TerrainPainter = (sample: TerrainSampler, style: TerrainStyleDef, x0, y0, w, h) => {
  const ground = GROUND[style.ground] ?? GROUND.dirt;
  const edge = style.edge ? EDGE[style.edge] : undefined;
  const plat = PLATFORM[style.platform ?? 'wood'] ?? PLATFORM.wood;
  const solid = SOLID[style.solid ?? 'metal'] ?? SOLID.metal;
  const seed = style.seed ?? 1;

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

  const out = new PixelBuffer(w, h);
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
      if (c === 1) {
        // up − 1 = depth below the surface (0 at the top pixel).
        const depth = p.up - 1;
        const band = edge ? edge.depth + Math.floor(hash1(p.x >> 1, seed + 17) * (edge.ragged + 1)) : 0;
        const q: Px = { ...p, up: depth };
        if (edge && depth < band && cellAt(gx, gy - depth - 1) === 0) col = edge.paint(q, ground);
        else col = ground(q);
        // Cliff walls (not slopes): lit left face, dark right face; dark underside.
        const inBand = edge !== undefined && depth < band;
        if (!inBand && cellAt(gx - 1, gy) === 0 && cellAt(gx - 1, gy + 1) === 0) col = stepShade(col, 1);
        if (!inBand && cellAt(gx + 1, gy) === 0 && cellAt(gx + 1, gy + 1) === 0) col = PAL.ink[1];
        if (p.down === 1 && cellAt(gx, gy + 1) === 0) col = INK;
      } else if (c === 2) {
        col = plat.paint(p);
      } else if (c === 3) {
        col = solid(p);
      } else {
        col = decorate(cellAt, gx, gy, p, edge, plat, up, GW, seed);
      }
      if (col !== 0) out.data[y * w + x] = col >>> 0;
    }
  }
  return out.touch();
};

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
