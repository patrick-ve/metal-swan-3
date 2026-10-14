/**
 * 2× terrain of mission `ams` (docs/ART_GUIDE.md "2x art (mission ams)", "2x backgrounds and
 * terrain"): the `klinker` ground — the grey brick street in perspective rows over the dark brick
 * quay wall — on the 2× grid. Same rows, bricks and colours as the 1× material (terrain-art.ts);
 * the lit top and left brick edges keep the 1× weight (2 hi-res px), the finer grid gives 1 hi-res
 * px joints, a little grit on the darker bricks and flat-toned quay-wall bricks with 1 hi-res px
 * mortar. The kerb outline keeps 2 hi-res px.
 *
 * The other ams materials on the 2× grid (the same bands, colours and spacing as their 1× twins in
 * terrain-art.ts; edge rows and ends that read as a line keep 2 hi-res px):
 * - edge `bikepath`: red asphalt with fine aggregate (lit chips with a dark side), the white kerb
 *   line with a lit top, its shadow
 * - edge `kerb` (section d): a granite kerb with speckle, 1 hi-res px joints with a lit side
 * - platform `wood` (houseboat decks, awnings, ledges): planks with grain, 1 hi-res px seams with a
 *   lit plank edge, round nail heads
 * - platform `whitewood` (the white Amstel bridge, section c): painted planks, fine seams and a few
 *   paint chips; the cross beams under it (hangers) with a lit edge and a fine seam
 * - solid `brick` (the Rijksmuseum passage ceiling): the 1× red bricks and grey mortar weight, a
 *   lit top and left edge with a soft inner step, a bright corner, a few lit grains
 *
 * `paint(p, sx, sy)` gets the same Px as the 1× material (p.up = depth below the surface) and the
 * sub-pixel (sx, sy) of the logical pixel; hi-res coordinates are 2·x + sx and 2·depth + sy.
 */
import type { Color } from '../../../../engine/color';
import type { Ramp } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import { hash1, hash2 } from '../../../art/paint';
import { defineHiTerrainHang, defineHiTerrainMaterial, KLINKER_ROWS, type Px } from '../../../art/terrain-art';

const LAST = KLINKER_ROWS[KLINKER_ROWS.length - 1];
const WALL: Ramp = [PAL.ink[1], PAL.brown[0], PAL.rust[0], PAL.brown[1]];

function klinkerHi(p: Readonly<Px>, sx: number, sy: number): Color {
  const d = p.up;
  // Hi-res position: X along the street, D down from the surface.
  const X = p.x * 2 + sx;
  const D = d * 2 + sy;
  if (d < LAST) {
    let r = 0;
    while (KLINKER_ROWS[r + 1] <= d) r++;
    const rh = (KLINKER_ROWS[r + 1] - KLINKER_ROWS[r]) * 2;
    const yIn = D - KLINKER_ROWS[r] * 2;
    const bw = 5 + r * 2;
    const xs = p.x + (r % 2) * (bw >> 1);
    const bx = Math.floor(xs / bw);
    // The same bricks as 1×, measured in hi-res px.
    const xIn = ((((xs * 2 + sx) % (bw * 2)) + bw * 2) % (bw * 2));
    // Joints: 1 hi-res px (the bottom row and the left column of each brick).
    if (yIn === rh - 1 || xIn === 0) return PAL.stone[1];
    const h = hash2(bx, r, p.seed + 41);
    if (h > 0.9) {
      // A reddish klinker: lit top edge (the 1× weight), a few rust grains.
      if (yIn <= 1) return PAL.rust[2];
      return hash2(X, D, p.seed + 47) > 0.985 ? PAL.rust[1] : PAL.brown[2];
    }
    // Light from the top left: the lit top and left edge keep the 1× weight (2 hi-res px); the
    // 1 hi-res px joint is what the 2× grid adds.
    if (yIn <= 1 || xIn <= 2) return PAL.stone[3];
    const body = h < 0.25 ? 1 : 2;
    // Grit: only a few pixels per brick, and none on the light bricks.
    if (body === 1 && hash2(X, D, p.seed + 43) > 0.988) return PAL.stone[2];
    return PAL.stone[body];
  }
  // The quay wall: the granite kerb (outline rows stay 2 hi-res px), then brick going darker down.
  const k = d - LAST;
  if (k === 0) return sy === 0 ? PAL.snow[1] : PAL.stone[3];
  if (k === 1) return sy === 1 && ((X % 48) + 48) % 48 === 0 ? PAL.stone[1] : PAL.stone[2];
  if (k === 2) return PAL.ink[1];
  const K = D - LAST * 2 - 6;
  const row = K >> 3;
  const by = K & 7;
  const xs = X + (row % 2) * 8;
  const xIn = ((xs % 16) + 16) % 16;
  // Mortar 1 hi-res px; the brick gets a lit top row.
  if (by === 7 || xIn === 0) return PAL.ink[1];
  // One flat tone per brick (the 1× depth darkening taken at the brick's middle row), so the dark
  // fill reads as brick, not as dither.
  const kMid = 3 + row * 4 + 1.5;
  const v = 2.2 - kMid / 14 + (hash2(xs >> 4, row, p.seed + 5) - 0.5) * 0.9;
  const i = Math.floor(v);
  return WALL[i < 0 ? 0 : i >= WALL.length ? WALL.length - 1 : i];
}

defineHiTerrainMaterial('ground', 'klinker', klinkerHi);

// ------------------------------------------------------------------------------------ edges

/** Red bike-path asphalt (depth 6): lit top row, asphalt, the white kerb line (row 4), its shadow. */
function bikepathHi(p: Readonly<Px>, sx: number, sy: number): Color {
  const X = p.x * 2 + sx;
  const D = p.up * 2 + sy;
  if (p.up === 4) return sy === 0 ? PAL.snow[3] : PAL.snow[2];
  if (p.up === 5) return sy === 0 ? PAL.stone[1] : PAL.ink[1];
  // The lit top edge: 1 hi-res px, a little brighter where the 1× art has its bright grit.
  if (D === 0) return hash1(p.x, p.seed + 3) > 0.85 || hash2(X, 0, p.seed + 9) > 0.8 ? PAL.red[3] : PAL.red[2];
  if (D === 1) return PAL.red[2];
  // Aggregate: a lit chip with a dark pixel to its lower right (light from the top left).
  if (hash2(X, D, p.seed + 11) > 0.975) return PAL.red[2];
  if (D > 2 && hash2(X - 1, D - 1, p.seed + 11) > 0.975) return PAL.red[0];
  const g = hash2(X, D, p.seed + 7);
  return g > 0.955 ? PAL.rust[1] : g < 0.02 ? PAL.red[0] : PAL.red[1];
}

/** The grey granite kerb of section d (depth 3): a lit top, speckled face with joints every 24 px, a dark foot. */
function kerbHi(p: Readonly<Px>, sx: number, sy: number): Color {
  const X = p.x * 2 + sx;
  const D = p.up * 2 + sy;
  if (p.up === 0) return sy === 0 ? PAL.snow[1] : PAL.stone[3];
  if (p.up === 2) return sy === 0 ? PAL.stone[1] : PAL.stone[0];
  const j = ((X % 48) + 48) % 48;
  if (j === 0) return PAL.stone[1];
  if (j === 1) return PAL.stone[3];
  const g = hash2(X, D, p.seed + 13);
  return g > 0.9 ? PAL.stone[3] : g < 0.08 ? PAL.stone[1] : PAL.stone[2];
}

// ------------------------------------------------------------------------------------ platforms

/** Brown deck planks (seams every 14 px): grain, 1 hi-res px seams with a lit edge, nail heads. */
function woodHi(p: Readonly<Px>, sx: number, sy: number): Color {
  const r = PAL.brown;
  if (p.left === 1 || p.right === 1) return p.right === 1 && sx === 1 ? PAL.brown[0] : r[1];
  if (p.up === 1) return r[3];
  if (p.down === 1) return sy === 0 ? r[1] : r[0];
  const seam = ((p.x % 14) + 14) % 14;
  if (seam === 0) return sx === 0 ? r[0] : r[3];
  if (seam === 2 && p.up === 2) {
    // A round nail head: lit top-left pixel.
    return sx === 0 && sy === 0 ? PAL.steel[3] : sx === 1 && sy === 1 ? PAL.steel[1] : PAL.steel[2];
  }
  // Grain: short darker streaks along the plank, a few hi-res rows apart.
  const X = p.x * 2 + sx;
  const D = p.up * 2 + sy;
  const plank = Math.floor(p.x / 14);
  if ((D + plank) % 3 === 0 && hash2(X >> 2, D, p.seed + 23 + plank) > 0.45) return r[1];
  return r[2];
}

/** White painted bridge planks (seams every 12 px): fine seams with a lit edge, a few paint chips. */
function whitewoodHi(p: Readonly<Px>, sx: number, sy: number): Color {
  if (p.left === 1 || p.right === 1) return PAL.snow[0];
  if (p.up === 1) return sy === 0 ? PAL.snow[3] : PAL.snow[2];
  if (p.down === 1) return sy === 0 ? PAL.steel[3] : PAL.steel[2];
  const seam = ((p.x % 12) + 12) % 12;
  if (seam === 0) return sx === 0 ? PAL.snow[1] : PAL.snow[3];
  const X = p.x * 2 + sx;
  const D = p.up * 2 + sy;
  // Paint chips: a bare wood pixel now and then, a faint brush streak along the plank.
  if (hash2(X, D, p.seed + 29) > 0.996) return PAL.brown[2];
  if ((D & 1) === 1 && hash2(X >> 3, D, p.seed + 31) > 0.7) return PAL.snow[1];
  return PAL.snow[2];
}

/**
 * The cross beams under the white bridge deck (1×: 3 px wide every 32 px, 3 rows deep): a lit left
 * edge, a shaded right edge, a 1 hi-res px seam where the beam meets the deck, a shaded foot.
 */
function whitewoodHangHi(x: number, k: number, _seed: number, sx: number, sy: number): Color {
  const X = (((x % 32) + 32) % 32) * 2 + sx;
  if (X === 0) return PAL.snow[3];
  if (X === 5) return PAL.steel[3];
  if (k === 0 && sy === 0) return PAL.snow[1];
  if (k === 2 && sy === 1) return PAL.snow[1];
  return X === 1 ? PAL.snow[3] : PAL.snow[2];
}

// ------------------------------------------------------------------------------------ solids

const BRICK: Ramp = [PAL.brown[0], PAL.rust[0], PAL.rust[1], PAL.red[2], PAL.red[3]];

/**
 * Red brick (bricks 8 × 4 measured from the block's top-left corner) with the 1× tone: grey mortar
 * at the 1× weight (2 hi-res px), a lit top and left edge, the 1× brick red; the 2× grid adds a
 * bright corner pixel, a 1 hi-res px soft step inside the lit edge and a few lit grains.
 */
function brickHi(p: Readonly<Px>, sx: number, sy: number): Color {
  if (p.down === 1 || p.right === 1) return PAL.ink[1];
  const row = Math.floor((p.up - 1) / 4);
  const off = row % 2 === 0 ? 0 : 4;
  const bx = ((((p.left - 1 + off) % 8) + 8) % 8) * 2 + sx;
  const by = ((p.up - 1) % 4) * 2 + sy;
  // Mortar: the last logical row and column of each brick.
  if (by >= 6 || bx >= 14) return PAL.stone[1];
  const h = hash2(Math.floor((p.left - 1 + off) / 8), row, p.seed);
  const body = h > 0.6 ? 1 : 2;
  if (by === 0 && bx === 0) return BRICK[4];
  if (by === 0 || bx === 0) return BRICK[3];
  if (by === 1 || bx === 1) return body === 2 ? BRICK[3] : BRICK[2];
  // A few lit grains on the brick face.
  if (hash2(p.x * 2 + sx, p.y * 2 + sy, p.seed + 37) > 0.985) return BRICK[body + 1];
  return BRICK[body];
}

defineHiTerrainMaterial('edge', 'bikepath', bikepathHi);
defineHiTerrainMaterial('edge', 'kerb', kerbHi);
defineHiTerrainMaterial('platform', 'wood', woodHi);
defineHiTerrainMaterial('platform', 'whitewood', whitewoodHi);
defineHiTerrainHang('whitewood', whitewoodHangHi);
defineHiTerrainMaterial('solid', 'brick', brickHi);
