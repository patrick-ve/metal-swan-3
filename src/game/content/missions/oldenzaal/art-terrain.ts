/**
 * HD terrain of mission `oldenzaal` (TOWN, wave A; docs/ART_GUIDE.md "UHD art"): the town's
 * materials at d ∈ {2, 4}, one density-generic drawer each (`defineHdTerrainMaterial`,
 * src/game/art/terrain-art.ts). The painter classifies every logical px like the 1× painter
 * (the 1× `oz-pavers`, `oz-ledge` and `oz-brick` rows in terrain-art.ts), so geometry and collision
 * are the 1× ones; only the light, tones, texture and wear are new. Painted (no ink), light from
 * above (a cold dusk sky), finer detail at 4×.
 *
 * - ground `oz-pavers`: red-brown clay brick pavers in a herringbone seen in perspective (the far
 *   rows small, the near rows big; the same plan pattern as the 1× rows: `ozPaverCell`), each brick
 *   a bevelled block with a lit far edge and a shaded near edge, mottled per brick (dark brown,
 *   brick red, a few burnt ones), sandy dark joints, the shadow line at the façades' foot, a cold
 *   sheen of the dusk sky on the far rows, wear and chips at 4×; cast-iron drains in the gutter.
 * - platform `oz-ledge`: the dark iron rail / lead flashing on awnings, balconies and bays (lit top
 *   arris, rivets at 4×).
 * - solid `oz-brick`: low walls of dark red brick under a sandstone coping.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import { hash2 } from '../../../art/paint';
import { defineHdTerrainMaterial, OZ_PAVER_A, ozDrainAt, ozPaverCell, ozPaverZ, type Px } from '../../../art/terrain-art';

const BAY = new Float64Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((m) => (m + 0.5) / 16 - 0.5));

function tone(r: Ramp, t: number, X: number, Y: number, spread: number): number {
  let k = Math.floor(t + BAY[((Y & 3) << 2) | (X & 3)] * spread);
  if (k < 0) k = 0;
  else if (k >= r.length) k = r.length - 1;
  return r[k] >>> 0;
}

const BRICK = PAL_HD.brick;
const DARK = PAL_HD.brickDark;
const BROWN = PAL_HD.brown;
const STONE = PAL_HD.stone;
const STEEL = PAL_HD.steel;
const INK = PAL_HD.ink;
const SAND = PAL_HD_OZ.sandstone;
const NIGHT = PAL_HD_OZ.night;

/** The street: herringbone pavers in perspective. */
function paversHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  const drain = ozDrainAt(p.x, p.up, seed);
  for (let sy = 0; sy < d; sy++) {
    const u0 = p.up + sy / d;
    const z0 = ozPaverZ(u0);
    const z1 = ozPaverZ(u0 + 1 / d);
    const zm = (z0 + z1) / 2;
    const Y = p.y * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      const x = p.x + (sx + 0.5) / d;
      let c: Color;
      if (drain) {
        // A cast-iron grate: slots across, a lit frame.
        const fx = (((p.x - 196 - 37 * seed) % 384) + 384) % 384;
        const edge = fx === 0 || fx === 7 || (p.up === 3 && sy === 0) || (p.up === 5 && sy === d - 1);
        c = edge ? STEEL[2] : (X & 1) === 0 ? INK[0] : STEEL[1];
      } else if (p.up === 0) {
        // The shadow line along the façades' foot.
        c = sy < d / 2 ? INK[1] : DARK[1];
      } else {
        const cell = ozPaverCell(x, zm);
        const crossZ = Math.floor(z1 / OZ_PAVER_A) > Math.floor(z0 / OZ_PAVER_A) && cell.m !== 2;
        const jointX = cell.fx < 1 / d + (d >= 4 && p.up > 20 ? 0.25 : 0) && cell.m !== 1;
        if (crossZ || jointX) {
          // Sandy dark joints, a little lighter near the viewer.
          c = hash2(X, Y, seed + 5) > 0.75 ? BROWN[1] : p.up > 18 ? STONE[1] : INK[1];
        } else {
          const h = hash2(cell.bx, cell.bz, seed + 91);
          const r: Ramp = h > 0.9 ? BROWN : h < 0.72 ? DARK : BRICK;
          let t = r === DARK ? 3.6 : r === BRICK ? 2.1 : 2.1;
          t += (hash2(cell.bx, cell.bz, seed + 92) - 0.5) * 0.9;
          // The bevel: the far (top) edge lit, the near edge shaded (in plan z), the left edge lit.
          const fz = cell.m === 2 ? cell.fz + OZ_PAVER_A : cell.fz;
          const span = cell.m === 2 || cell.m === 3 ? OZ_PAVER_A * 2 : OZ_PAVER_A;
          if (fz < 0.55) t += 0.9;
          else if (fz > span - 0.6) t -= 0.9;
          const fxx = cell.m === 1 ? cell.fx + OZ_PAVER_A : cell.fx;
          if (fxx < 0.6) t += 0.4;
          // Far rows in the dusk shade; the near rows a little brighter.
          t -= Math.max(0, (10 - p.up) * 0.12);
          if (d >= 4) {
            const g = hash2(X, Y, seed + 7);
            if (g > 0.93) t -= 0.7;
            else if (g < 0.04) t += 0.6;
            // A chipped corner on some bricks.
            if (hash2(cell.bx, cell.bz, seed + 93) > 0.85 && fz < 0.9 && fxx < 0.9) t -= 1.6;
          }
          c = tone(r, t, X, Y, 0.25);
          // The cold sky's sheen on the far rows (wet stone at dusk).
          if (p.up >= 1 && p.up < 5 && hash2(X >> 1, Y, seed + 9) > 0.8) c = NIGHT[4];
        }
      }
      out[row + sx] = c >>> 0;
    }
  }
}

/** The iron rail / lead flashing on top of awnings, balconies and bays (4 px band). */
function ledgeHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  for (let sy = 0; sy < d; sy++) {
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let c: Color;
      if (p.up === 1) c = sy === 0 ? STEEL[4] : STEEL[3];
      else if (p.down === 1) c = sy === d - 1 ? INK[0] : INK[1];
      else c = p.up === 2 ? STEEL[2] : STEEL[1];
      if (d >= 4 && p.up === 3 && ((X >> 2) % 12 === 0) && sx > 0 && sx < 3) c = STEEL[4];
      out[row + sx] = c >>> 0;
    }
  }
}

/** A low wall: dark red brick under a sandstone coping. */
function brickHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  for (let sy = 0; sy < d; sy++) {
    const Y = (p.up - 1) * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let c: Color;
      if (p.up <= 3) {
        // The coping: a lit top, a rounded nose, its shadow on the brick.
        const k = p.up === 1 ? (sy === 0 ? 6 : 5) : p.up === 2 ? 4 : sy >= d - 1 ? 0 : 2;
        c = SAND[k];
        if (d >= 4 && p.up === 2 && hash2(X, Y, seed) > 0.9) c = SAND[3];
      } else if (p.down === 1 && sy === d - 1) {
        c = INK[1];
      } else {
        const yy = Y - 3 * d;
        const r = Math.floor(yy / (3 * d));
        const off = r % 2 === 0 ? 0 : 3 * d;
        const xx = (p.left - 1) * d + sx + off;
        const bx = Math.floor(xx / (6 * d));
        const u = xx - bx * 6 * d;
        const v = yy - r * 3 * d;
        if (v >= 3 * d - 1 || u === 0) c = STONE[1];
        else {
          const h = hash2(bx, r, seed + 3);
          let t = (h > 0.6 ? 3 : 2.4) + (v === 0 ? 0.8 : 0);
          if (d >= 4 && hash2(X, Y, seed + 4) > 0.92) t -= 0.7;
          c = tone(h > 0.85 ? BRICK : DARK, h > 0.85 ? t - 0.4 : t + 1, X, Y, 0.6);
        }
      }
      out[row + sx] = c >>> 0;
    }
  }
}

defineHdTerrainMaterial('ground', 'oz-pavers', paversHd);
defineHdTerrainMaterial('platform', 'oz-ledge', ledgeHd);
defineHdTerrainMaterial('solid', 'oz-brick', brickHd);

/** The town's terrain style (oz-a, oz-b): pavers, iron ledges, low brick walls. */
export const OZ_TOWN_STYLE = { ground: 'oz-pavers', platform: 'oz-ledge', solid: 'oz-brick' } as const;
