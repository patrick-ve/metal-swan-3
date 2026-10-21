/**
 * HD terrain of the church (CHURCH, wave B; docs/ART_GUIDE.md "UHD art"): the 2× / 4× versions
 * of the church's materials (the 1× rows `oz-nave-floor`, `oz-crypt-floor`, `oz-pew`,
 * `oz-nave-step` in src/game/art/terrain-art.ts), one density-generic drawer each
 * (`defineHdTerrainMaterial`). The HD painter classifies every logical px like the 1× painter,
 * so the geometry and the collision are the 1× ones; only the tones, texture and wear are new.
 * Painted (no ink). Light: the cold moon from above, the floor's far rows in shadow.
 *
 * - `oz-nave-floor`: big worn sandstone flags in perspective (`ozFlagAt`, the same plan as the 1×
 *   rows): a tone per flag, a lit far arris and a shaded near one, a dusty matt middle (weeks
 *   without a broom), cracks and chips at 4×, the cold sheen of the moon on the far rows, the
 *   shadow line along the far wall.
 * - `oz-crypt-floor`: smaller, rougher flags, damp and darker (brown-grey), worn hollows.
 * - `oz-pew`: the dark oak top rail of a pew back (a lit, rounded top; a dark underside).
 * - `oz-nave-step`: sandstone steps (a lit tread, block joints).
 */
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import { hash2 } from '../../../art/paint';
import { defineHdTerrainMaterial, ozFlagAt, type Px } from '../../../art/terrain-art';

const BAY = new Float64Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((m) => (m + 0.5) / 16 - 0.5));

function tone(r: Ramp, t: number, X: number, Y: number, spread: number): number {
  let k = Math.floor(t + BAY[((Y & 3) << 2) | (X & 3)] * spread);
  if (k < 0) k = 0;
  else if (k >= r.length) k = r.length - 1;
  return r[k] >>> 0;
}

const SAND = PAL_HD_OZ.sandstone;
const STONE = PAL_HD.stone;
const NIGHT = PAL_HD_OZ.night;
const INK = PAL_HD.ink;
const WOOD = PAL_HD.wood;
const BROWN = PAL_HD.brown;

/** The flags of the nave (crypt false) or the crypt (true). */
function flags(crypt: boolean) {
  return (p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void => {
    const seed = p.seed;
    for (let sy = 0; sy < d; sy++) {
      const u0 = p.up + sy / d;
      const u1 = u0 + 1 / d;
      const Y = p.y * d + sy;
      const row = i + sy * stride;
      for (let sx = 0; sx < d; sx++) {
        const X = p.x * d + sx;
        const x = p.x + sx / d;
        let c: number;
        if (p.up === 0) {
          // The shadow line along the far wall (the floor meets the wall's foot).
          c = sy < d / 2 ? INK[0] : crypt ? INK[1] : SAND[0];
        } else {
          const f = ozFlagAt(x, u0, u1, crypt, 1 / d + (d >= 4 && p.up > 22 ? 0.25 : 0));
          if (f.joint) {
            c = crypt ? (hash2(X, Y, seed) > 0.7 ? BROWN[0] : INK[0]) : hash2(X, Y, seed + 1) > 0.8 ? STONE[1] : INK[1];
          } else {
            const h = hash2(f.col, f.row, seed + 41);
            const r: Ramp = crypt ? (h > 0.7 ? BROWN : STONE) : h > 0.8 ? STONE : SAND;
            let t = crypt ? (r === BROWN ? 1.6 : 1.3) : r === STONE ? 2.2 : 3.1;
            t += (hash2(f.col, f.row, seed + 42) - 0.5) * 0.9;
            // The bevel: the far arris lit, the near one shaded, the left edge a touch lit.
            if (f.fz < 0.12) t += 0.8;
            else if (f.fz > 0.86) t -= 0.7;
            if (f.fx < 0.05) t += 0.4;
            else if (f.fx > 0.96) t -= 0.4;
            // The far rows in shadow, the near ones lit a little more (the view's own light).
            t -= Math.max(0, (12 - p.up) * (crypt ? 0.1 : 0.09));
            if (d >= 4) {
              const g = hash2(X, Y, seed + 7);
              if (g > 0.93) t -= 0.7;
              else if (g < 0.05) t += 0.5;
              // A crack across some flags; worn hollows (darker, smoother) in the crypt.
              if (hash2(f.col, f.row, seed + 44) > 0.78 && Math.abs(f.fx - 0.3 - f.fz * 0.4) < 0.012) t -= 1.4;
              if (crypt && hash2(f.col, f.row, seed + 45) > 0.6 && Math.abs(f.fx - 0.5) < 0.22 && Math.abs(f.fz - 0.5) < 0.25) t -= 0.5;
            }
            c = tone(r, t, X, Y, 0.3);
            // The cold sheen of the moon on the far rows (polished by centuries of feet).
            if (!crypt && p.up >= 1 && p.up < 6 && hash2(X >> 1, Y, seed + 9) > 0.78) c = NIGHT[3];
            // Dust in the middle of the near flags (weeks without a broom).
            if (!crypt && d >= 2 && p.up > 8 && hash2(X, Y, seed + 11) > 0.86 && f.fz > 0.2 && f.fz < 0.8) c = STONE[2];
          }
        }
        out[row + sx] = c >>> 0;
      }
    }
  };
}

/** A pew back's / coffin's dark oak top rail (4 px band). */
function pewHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  for (let sy = 0; sy < d; sy++) {
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let c: number;
      if (p.up === 1) c = sy === 0 ? WOOD[4] : WOOD[3];
      else if (p.down === 1) c = sy === d - 1 ? INK[0] : WOOD[0];
      else c = p.up === 2 ? WOOD[2] : WOOD[1];
      if (d >= 4 && p.up === 1 && hash2(X, 3, p.seed) > 0.8) c = STONE[2]; // dust on the rail
      out[row + sx] = c >>> 0;
    }
  }
}

/** Sandstone steps / blocks. */
function stepHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  for (let sy = 0; sy < d; sy++) {
    const row = i + sy * stride;
    const yy = (p.up - 1) * d + sy;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      const xx = (p.left - 1) * d + sx;
      let c: number;
      if (p.up === 1) c = sy === 0 ? SAND[6] : SAND[5];
      else if (p.down === 1 && sy === d - 1) c = INK[1];
      else {
        const r = Math.floor(yy / (6 * d));
        const off = (r & 1) * 9 * d;
        const bx = Math.floor((xx + off) / (18 * d));
        if (yy % (6 * d) === 0 || (xx + off) % (18 * d) === 0) c = SAND[1];
        else c = tone(SAND, 3.4 + (hash2(bx, r, seed + 3) - 0.5) * 0.9 - (hash2(X, yy, seed) > 0.93 ? 0.7 : 0), X, yy, 0.4);
      }
      out[row + sx] = c >>> 0;
    }
  }
}

defineHdTerrainMaterial('ground', 'oz-nave-floor', flags(false));
defineHdTerrainMaterial('ground', 'oz-crypt-floor', flags(true));
defineHdTerrainMaterial('platform', 'oz-pew', pewHd);
defineHdTerrainMaterial('solid', 'oz-nave-step', stepHd);
