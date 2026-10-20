/**
 * HD terrain of mission `ams` (UHD art, docs/ART_GUIDE.md "UHD art"): every ams terrain material
 * at d ∈ {2, 4} with PAL_HD, painted per art px by one density-generic drawer each
 * (`defineHdTerrainMaterial`, src/game/art/terrain-art.ts). The painter classifies every logical
 * pixel like the 1× painter (same rows, bricks, bands, joints, seams and nails as the 1× materials
 * in terrain-art.ts), so geometry and collision cannot change; only the light, tones, texture and
 * wear are new. Terrain is painted: no ink outline, light from the upper left (lit top and left
 * edges, shaded bottom and right edges), ordered dither only at band borders, finer detail at 4×.
 *
 * - ground `klinker`: the grey brick street in perspective rows (each klinker a bevelled stone with
 *   a lit far edge and left edge, a shaded near edge, a low dome lit from the upper left, mottled
 *   grain, per-stone tones, brown-red klinkers; at 4× wear from hashes: polished lighter centres,
 *   pits, chipped corners and nicked arrises, sand and dirt in the lower corners, a few hairline
 *   cracks) set in sandy joints; under it the
 *   quay wall: a granite coping (lit arris, rounded nose, speckle, joints every 24 px), its cast
 *   shadow, then dark brick in stretcher bond going darker and wetter downward, with wet stains
 *   running down from the coping, lime bloom under some coping joints and a belt of algae and
 *   moss near the water line
 * - edge `bikepath`: red asphalt with aggregate (lit chips with their shadow), two polished tyre
 *   lanes and a lit far edge, the white kerb line (scuffed paint) and its shaded face with joints
 * - edge `kerb` (section d): granite kerb stones with a lit arris, a rounded nose, speckle, joints
 *   every 24 px with a lit end and a shaded foot
 * - platform `wood` (houseboat decks, awnings, ledges): planks with grain and knots, lit seams
 *   every 14 px, round nail heads, end grain, a shaded underside
 * - platform `whitewood` (the white Amstel bridge, c): painted planks with brush streaks, fine
 *   seams, paint chips; the cross beams under it (hangers) with a lit edge and a bolt
 * - solid `brick` (the Rijksmuseum passage ceiling, b): red brick 8 × 4 with recessed mortar, lit
 *   top and left edges, per-brick tones, soot toward the underside
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import { hash2, noise2 } from '../../../art/paint';
import { defineHdTerrainHang, defineHdTerrainMaterial, KLINKER_ROWS, type Px } from '../../../art/terrain-art';

const S = PAL_HD.stone;
const BROWN = PAL_HD.brown;
const RED = PAL_HD.red;
const SNOW = PAL_HD.snow;
const BRICK = PAL_HD.brick;
const DARK = PAL_HD.brickDark;
const MOSS = PAL_HD.moss;
const SAND = PAL_HD.sand;
const STEEL = PAL_HD.steel;

/** Ordered-dither offsets (4 × 4 Bayer, −0.5 … 0.5), world anchored by the art px. */
const BAY = new Float64Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((m) => (m + 0.5) / 16 - 0.5));

/** The ramp tone for a continuous index t (dithered only within `spread` of a band border). */
function tone(r: Ramp, t: number, X: number, Y: number, spread: number, lo = 0): number {
  let k = Math.floor(t + BAY[((Y & 3) << 2) | (X & 3)] * spread);
  if (k < lo) k = lo;
  else if (k >= r.length) k = r.length - 1;
  return r[k] >>> 0;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

// ------------------------------------------------------------------------------------ klinker

const LAST = KLINKER_ROWS[KLINKER_ROWS.length - 1];

/** The klinker street: perspective rows of bevelled stones in sandy joints. */
function street(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const depth = p.up;
  const seed = p.seed;
  let r = 0;
  while (KLINKER_ROWS[r + 1] <= depth) r++;
  const R0 = KLINKER_ROWS[r];
  const rh = KLINKER_ROWS[r + 1] - R0;
  const bw = 5 + r * 2;
  const xs = p.x + (r % 2) * (bw >> 1);
  const bx = Math.floor(xs / bw);
  const xIn = mod(xs, bw);
  // The 1× brick kinds: a brown-red klinker (10 %), a dark one (25 %), the grey street.
  const h = hash2(bx, r, seed + 41);
  const ramp = h > 0.9 ? BROWN : S;
  const grey = ramp === S && h >= 0.25;
  // Band centres, so a stone's body is one clean cluster: grey, a lighter grey, dark, brown-red;
  // every stone is a little lighter or darker than its kind (±0.25 … 0.45 tone).
  const base =
    (h > 0.9 ? 3.5 : h < 0.25 ? 2.5 : hash2(bx, r, seed + 59) > 0.78 ? 4.5 : 3.5) +
    (hash2(bx, r, seed + 71) - 0.5) * (d === 4 ? 0.9 : 0.5);
  // The rounded face of a stone (the far rows at 2× are too small: edges only).
  const faces = d === 4 || r >= 3;
  const BW = bw * d;
  const RH = rh * d;
  // Joints and bevels in art px: finer for the far rows (perspective), 1 art px at 2×.
  const JX = d === 2 ? 1 : r < 3 ? 1 : 2;
  const JY = d === 2 ? 1 : r < 2 ? 1 : 2;
  const E = d === 2 ? 1 : r < 4 ? 1 : 2;
  const BWb = BW - JX;
  const RHb = RH - JY;
  // Wear at 4×, per stone from hashes: a chipped corner or a nick in an arris (2-4 art px), a
  // polished lighter centre, sand and dirt in the lower corners, a crack across a few stones.
  const near = d === 4 && r >= 2;
  const hc = hash2(bx, r, seed + 61);
  const chipK = d === 4 && hc > 0.7 ? Math.floor(hash2(bx, r, seed + 62) * 4) : -1;
  const chipS = 2 + Math.floor(hash2(bx, r, seed + 63) * (r >= 4 ? 3 : 1.5));
  const nickU = near && hash2(bx, r, seed + 64) > 0.6 ? Math.floor(hash2(bx, r, seed + 65) * (BWb - 6)) + 3 : -99;
  const nickW = 1 + Math.floor(hash2(bx, r, seed + 66) * 2.5);
  const worn = d === 4 && hash2(bx, r, seed + 73) > 0.55 ? 0.55 + hash2(bx, r, seed + 74) * 0.5 : 0;
  const dirt = d === 4 ? hash2(bx, r, seed + 79) * (r >= 3 ? 5 : 3) - 0.8 : -1;
  const crack = near && hash2(bx, r, seed + 83) > 0.94;
  const ca = 0.2 + hash2(bx, r, seed + 84) * 0.6;
  const cb = ca + (hash2(bx, r, seed + 85) - 0.5) * 0.7;
  const v0 = (depth - R0) * d;
  const u0 = xIn * d;
  const pitT = d === 4 ? 0.972 : 0.99;
  for (let sy = 0; sy < d; sy++) {
    const v = v0 + sy;
    const Y = p.y * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const u = u0 + sx;
      const X = p.x * d + sx;
      const uu = u - JX;
      // A chip or nick shows the sandy joint under the arris.
      let chip = false;
      if (uu >= 0 && v < RHb) {
        if (chipK >= 0) {
          const du = chipK & 1 ? BWb - 1 - uu : uu;
          const dv = chipK & 2 ? RHb - 1 - v : v;
          chip = du + dv < chipS && du + dv + (hash2(X, Y, seed + 67) > 0.5 ? 1 : 0) < chipS + 0.5;
        }
        if (v === 0 && uu >= nickU && uu < nickU + nickW) chip = true;
      }
      // Sandy joints: the side away from the light in shadow, a few sand grains.
      if (u < JX || v >= RHb || chip) {
        let c: Color = S[1];
        if (v === RHb && JY > 1) c = S[0];
        else if (u === 0 && JX > 1) c = S[0];
        else if (hash2(X, Y, seed + 3) > (d === 4 ? 0.8 : 0.9)) c = SAND[2];
        out[row + sx] = c >>> 0;
        continue;
      }
      let t = base;
      let spread = 0;
      let lo = 2;
      if (v < E) t += uu < E ? 2.5 : 1.6;
      else if (uu < E) t += 1;
      else if (v >= RHb - E) t -= 1.2;
      else if (uu >= BWb - E) t -= 0.8;
      else if (faces) {
        // A low dome lit from the upper left: one smooth fall from the lit far-left corner to the
        // shaded near-right corner (no bands along the outline), mottled grain, a polished centre.
        const a = (uu + 0.5) / BWb;
        const b = (v + 0.5) / RHb;
        t += (0.5 - a) * 0.75 + (0.5 - b) * 1.45;
        if (d === 4) {
          t += (noise2(X, Y, 3.5 + r * 0.6, seed + 91) - 0.5) * 0.7;
          if (worn > 0) {
            const qa = (a - 0.42) / 0.36;
            const qb = (b - 0.4) / 0.42;
            const w = 1 - qa * qa - qb * qb;
            if (w > 0) t += worn * w;
          }
          spread = 0.12;
        }
        // Pits on the grey stones.
        if (grey && hash2(X, Y, seed + 43) > pitT) t -= 1.1;
        // Dirt and sand settle in the lower corners, against the joints.
        if (dirt > 0) {
          const cd = Math.min(uu, BWb - 1 - uu) * 0.7 + (RHb - 1 - v);
          if (cd < dirt + (noise2(X, Y, 2, seed + 97) - 0.5) * 2.4) {
            out[row + sx] = tone(SAND, 2.4 + hash2(X, Y, seed + 98) * 1.2, X, Y, 0) >>> 0;
            continue;
          }
        }
        // A hairline crack: a dark seam with a lit lower lip.
        if (crack) {
          const uc = (ca + (cb - ca) * b) * BWb + (noise2(X, v, 3, seed + 87) - 0.5) * 3;
          const dc = uu - uc;
          if (dc >= -0.5 && dc < 0.5) {
            t = Math.min(t, base) - 1.7;
            lo = 1;
          }
          else if (dc >= 0.5 && dc < 1.5) t += 0.6;
        }
      } else if (grey && hash2(X, Y, seed + 43) > pitT) t -= 1.1;
      out[row + sx] = tone(ramp, t, X, Y, spread, lo);
    }
  }
}

/** The quay wall under the street: coping, its shadow, dark brick with wet stains, lime and moss. */
/** Per art column of the block being painted: the algae belt's top (world y) and a wet streak. */
const mossTop = new Float64Array(4);
const wetCol = new Uint8Array(4);

function quay(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const k = p.up - LAST;
  const seed = p.seed;
  if (k >= 3) {
    for (let sx = 0; sx < d; sx++) {
      const x = p.x + (sx + 0.5) / d;
      mossTop[sx] = 210.4 + noise2(x, 0, 7, seed + 91) * 3.4;
      wetCol[sx] = noise2(x, (k - 3) / 8, 3.2, seed + 81) > 0.6 ? 1 : 0;
    }
  }
  for (let sy = 0; sy < d; sy++) {
    const K = k * d + sy;
    const Y = p.y * d + sy;
    const wy = p.y + (sy + 0.5) / d;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let c: number;
      if (k < 2) {
        // The granite coping: lit arris, the top, a rounded nose, the face; joints every 24 px.
        const f = K / (2 * d);
        const jx = mod(X, 24 * d);
        let t = K === 0 ? 6.8 : f < 0.4 ? 5.6 : f < 0.55 ? 4.3 : 3.4 - (f - 0.55) * 2.6;
        if (jx === 0) t = 1.2;
        else if (jx < d / 2) t += 0.9;
        else if (jx === 24 * d - 1) t -= 0.7;
        else if (f >= 0.55) {
          const g = hash2(X, Y, seed + 71);
          if (g > (d === 4 ? 0.93 : 0.96)) t += 0.9;
          else if (g < (d === 4 ? 0.06 : 0.03)) t -= 0.9;
        }
        c = tone(S, t, X, Y, 0.4, 1);
      } else if (k === 2) {
        // The coping's cast shadow on the wall.
        c = (sy < d / 2 ? DARK[0] : DARK[1]) >>> 0;
      } else {
        const KK = K - 3 * d;
        const brow = Math.floor(KK / (4 * d));
        const v = KK - brow * 4 * d;
        const Xs = X + (brow % 2) * 4 * d;
        const bxI = Math.floor(Xs / (8 * d));
        const u = mod(Xs, 8 * d);
        const JM = d === 2 ? 1 : 2;
        // Moss and algae belt near the water line (ragged top), wet streaks from the coping.
        const mt = mossTop[sx];
        const wet = wetCol[sx] === 1;
        if (v >= 4 * d - JM || u < JM) {
          // Mortar: recessed, the top px in the brick's shadow; lime bloom under some coping joints.
          let t = v === 4 * d - JM && JM > 1 ? 0.6 : 1.4;
          const lime = d === 4 && mod(X, 24 * d) < d && KK < 6 * d && hash2(Math.floor(X / (24 * d)), 0, seed + 97) > 0.45;
          if (lime) t = 3.2;
          if (wy > mt - 0.6) c = MOSS[wy > mt + 1.5 ? 1 : 2] >>> 0;
          else c = tone(S, wet ? t - 0.6 : t, X, Y, 0.3, 0);
        } else {
          let t = 3.5 - k * 0.07 + (hash2(bxI, brow, seed + 5) > 0.7 ? 0.8 : hash2(bxI, brow, seed + 6) > 0.7 ? -0.8 : 0);
          if (v === 0) t += 1.1;
          else if (u === JM) t += 0.5;
          else if (v === 4 * d - JM - 1) t -= 0.8;
          else if (u === 8 * d - 1) t -= 0.4;
          else if (d === 4 && hash2(X, Y, seed + 73) > 0.97) t -= 0.9;
          if (wet) t -= 0.85;
          const m = wy > mt ? Math.min(1, (wy - mt) / 3) : 0;
          if (m > 0 && noise2(X / d, wy, 1.7, seed + 93) < 0.3 + m * 0.6) {
            // Algae: dark green clusters, a lit top where they start under clean brick.
            c = MOSS[wy - mt < 0.5 ? 3 : wy - mt > 2.2 ? 1 : 2] >>> 0;
          } else c = tone(DARK, t, X, Y, 0, 1);
        }
      }
      out[row + sx] = c;
    }
  }
}

function klinkerHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  if (p.up < LAST) street(p, d, out, i, stride);
  else quay(p, d, out, i, stride);
}

// ------------------------------------------------------------------------------------ edges

/** Red bike-path asphalt (depth 6): lit far edge, tyre lanes, aggregate; the white kerb line, its face. */
function bikepathHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const depth = p.up;
  const seed = p.seed;
  const chipT = d === 4 ? 0.962 : 0.978;
  const poreT = d === 4 ? 0.03 : 0.015;
  for (let sy = 0; sy < d; sy++) {
    const D = depth * d + sy;
    const Y = p.y * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let c: number;
      if (depth < 4) {
        let t = D === 0 ? 5.7 : depth === 0 ? 4.6 : 3.45 + (1 - D / (4 * d)) * 0.4;
        const lt = (D + 0.5) / d;
        if ((Math.abs(lt - 1.75) < 0.36 || Math.abs(lt - 2.95) < 0.3) && noise2(X / d, lt, 10, seed + 5) > 0.42) t += 0.5;
        if (D > 0) {
          const hv = hash2(X, D, seed + 11);
          if (hv > chipT) t += 1.6;
          else if (hash2(X - 1, D - 1, seed + 11) > chipT) t -= 1.15;
          else if (hv < poreT) t -= 0.85;
        }
        c = tone(RED, t, X, Y, 0.5, 1);
      } else if (depth === 4) {
        // The white kerb line: a lit top, scuffed paint, a shaded lower edge.
        const r = D - 4 * d;
        c = r === 0 ? SNOW[6] : r < d * 0.55 ? SNOW[5] : r < d - 1 || d === 2 ? SNOW[4] : SNOW[3];
        if (r > 0 && hash2(X, D, seed + 13) > (d === 4 ? 0.975 : 0.99)) c = S[5];
        c >>>= 0;
      } else {
        // The kerb's face in shadow, a joint every 24 px.
        const r = D - 5 * d;
        c = (mod(X, 24 * d) === 0 ? S[0] : r === 0 ? S[3] : r < d / 2 ? S[2] : S[1]) >>> 0;
      }
      out[row + sx] = c;
    }
  }
}

/** The granite kerb of section d (depth 3): a lit arris and top, a rounded nose, speckle, joints, the foot. */
function kerbHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  for (let sy = 0; sy < d; sy++) {
    const D = p.up * d + sy;
    const Y = p.y * d + sy;
    const f = D / (3 * d);
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      const jx = mod(X, 24 * d);
      let t = D === 0 ? 6.8 : f < 0.3 ? 5.5 : f < 0.42 ? 4.4 : f < 0.78 ? 3.4 : 2.1 - (f - 0.78) * 4;
      if (jx === 0) t = Math.min(t, 1.2);
      else if (jx < d / 2) t += 0.9;
      else if (jx === 24 * d - 1) t -= 0.6;
      else if (f >= 0.3 && f < 0.78) {
        const g = hash2(X, Y, seed + 13);
        if (g > (d === 4 ? 0.92 : 0.95)) t += 0.9;
        else if (g < (d === 4 ? 0.07 : 0.04)) t -= 0.9;
      }
      out[row + sx] = tone(S, t, X, Y, 0.4, 0);
    }
  }
}

// ------------------------------------------------------------------------------------ platforms

/** A round nail head (light from the upper left) in the d × d block, or false outside it. */
function nail(d: number, sx: number, sy: number): Color | 0 {
  if (d === 2) return sx === 0 && sy === 0 ? STEEL[6] : sx === 1 && sy === 1 ? STEEL[2] : STEEL[4];
  const dx = sx - 1.5;
  const dy = sy - 1.5;
  if (dx * dx + dy * dy > 2.6) return 0;
  return dx + dy < -1.2 ? STEEL[7] : dx + dy > 1.2 ? STEEL[2] : dx + dy > 0 ? STEEL[3] : STEEL[5];
}

/** Brown deck planks (band 4, seams every 14 px): grain, knots, lit seams, nails, end grain, the underside. */
function woodHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  const pl = Math.floor(p.x / 14);
  const xIn = mod(p.x, 14);
  const isNail = xIn === 2 && p.up === 2;
  // A knot per plank (4× only): its centre in logical px.
  const kx = pl * 14 + 4 + hash2(pl, 1, seed + 25) * 7;
  const ky = 1.6 + hash2(pl, 2, seed + 25) * 1.2;
  const knot = d === 4 && hash2(pl, 3, seed + 25) > 0.45;
  for (let sy = 0; sy < d; sy++) {
    const V = (p.up - 1) * d + sy;
    const Y = p.y * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      if (isNail) {
        const n = nail(d, sx, sy);
        if (n !== 0) {
          out[row + sx] = n >>> 0;
          continue;
        }
      }
      let t: number;
      if (p.left === 1) t = sx === 0 ? 4.6 : (V + sx) % 3 === 0 ? 2.6 : 3.4;
      else if (p.right === 1) t = sx === d - 1 ? 1.2 : 2.0;
      else if (p.down === 1) t = sy === d - 1 ? 1.3 : 2.2;
      else {
        t = V === 0 ? 6.4 : V < d ? 5.4 : 3.45;
        const ps = xIn * d + sx;
        if (ps === 0) t = 1.2;
        else if (ps === 1) t += 1.0;
        else if (ps === 14 * d - 1) t -= 0.6;
        else if (V >= d) {
          const g = noise2(X / (d * 6), V / d + pl * 5, 0.9, seed + 23);
          if (g > 0.64) t -= 0.75;
          else if (g < 0.2) t += 0.35;
          if (knot) {
            const dx = (X + 0.5) / d - kx;
            const dy = (V + 0.5) / d - ky;
            const q = dx * dx * 0.6 + dy * dy * 2.2;
            if (q < 0.18) t = 1.6;
            else if (q < 0.42) t = 2.6;
          }
        }
      }
      out[row + sx] = tone(BROWN, t, X, Y, 0.4, 1);
    }
  }
}

/** White painted bridge planks (band 4, seams every 12 px): brush streaks, fine seams, paint chips. */
function whitewoodHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  const xIn = mod(p.x, 12);
  for (let sy = 0; sy < d; sy++) {
    const V = (p.up - 1) * d + sy;
    const Y = p.y * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let t: number;
      if (p.left === 1) t = sx === 0 ? 3.4 : 1.6;
      else if (p.right === 1) t = sx === d - 1 ? 0.6 : 1.4;
      else if (p.down === 1) t = sy === d - 1 ? 2.4 : 3.4;
      else {
        t = V === 0 ? 6.4 : V < d ? 5.6 : 5.3;
        const ps = xIn * d + sx;
        if (ps === 0) t = 2.2;
        else if (ps === 1) t = 6.2;
        else if (V >= d) {
          if ((V & 1) === 1 && noise2(X / (d * 5), V, 0.8, seed + 31) > 0.66) t -= 0.7;
          if (d === 4 && hash2(X, V, seed + 29) > 0.994) {
            out[row + sx] = PAL_HD.wood[3] >>> 0;
            continue;
          }
        }
      }
      out[row + sx] = tone(SNOW, t, X, Y, 0.35, 0);
    }
  }
}

/** The cross beams under the white bridge deck (1×: 3 px wide every 32 px, 3 rows deep). */
function whitewoodHangHd(x: number, k: number, _seed: number, d: number, out: Uint32Array, i: number, stride: number): void {
  const m = mod(x, 32);
  for (let sy = 0; sy < d; sy++) {
    const V = k * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const u = m * d + sx;
      let t = u === 0 ? 6 : u < d ? 5.2 : u >= 3 * d - 1 ? 1.6 : u >= 2 * d ? 3.2 : 4.4;
      if (V === 0) t = Math.min(t, 2.0);
      else if (V === 3 * d - 1) t -= 1.2;
      // A bolt in the middle of the beam (4×).
      if (d === 4 && m === 1 && k === 1 && sx >= 1 && sx <= 2 && sy >= 1 && sy <= 2) {
        out[row + sx] = (sx === 1 && sy === 1 ? STEEL[6] : sx === 2 && sy === 2 ? STEEL[1] : STEEL[3]) >>> 0;
        continue;
      }
      out[row + sx] = tone(SNOW, t, x * d + sx, V, 0, 0);
    }
  }
}

// ------------------------------------------------------------------------------------ solids

/**
 * Red brick (8 × 4, rows from the block's top, columns on the world grid like the 1× bricks of a
 * block on it): recessed mortar, lit top and left edges, per-brick tones, soot toward the underside,
 * the shaded bottom and right faces of the block.
 */
function brickHd(p: Readonly<Px>, d: number, out: Uint32Array, i: number, stride: number): void {
  const seed = p.seed;
  const brow = Math.floor((p.up - 1) / 4);
  const off = brow % 2 === 0 ? 0 : 4;
  const JM = d === 2 ? 1 : 2;
  for (let sy = 0; sy < d; sy++) {
    const v = ((p.up - 1) % 4) * d + sy;
    const Y = p.y * d + sy;
    const row = i + sy * stride;
    for (let sx = 0; sx < d; sx++) {
      const X = p.x * d + sx;
      let t: number;
      let r: Ramp = BRICK;
      if (p.down === 1) t = sy === d - 1 ? 0.4 : 1.2;
      else if (p.right === 1) t = sx === d - 1 ? 0.6 : 1.3;
      else {
        const Xb = X + off * d;
        const u = mod(Xb, 8 * d);
        const bxI = Math.floor(Xb / (8 * d));
        if (v >= 4 * d - JM || u >= 8 * d - JM) {
          r = S;
          t = v === 4 * d - JM && JM > 1 ? 1.4 : 2.4;
        } else {
          const h = hash2(bxI, brow, seed);
          t = h > 0.6 ? 2.7 : 3.4;
          if (hash2(bxI, brow, seed + 7) > 0.85) r = DARK;
          if (v === 0) t += p.up === 1 ? 1.9 : 1.4;
          else if (u === 0) t += 0.8;
          else if (v === 4 * d - JM - 1) t -= 0.9;
          else if (u === 8 * d - JM - 1) t -= 0.5;
          else if (d === 4 && hash2(X, Y, seed + 37) > 0.975) t += 0.8;
          // Soot from the traffic under the ceiling.
          if (p.down <= 2) t -= 0.9;
        }
      }
      out[row + sx] = tone(r, t, X, Y, 0, 0);
    }
  }
}

defineHdTerrainMaterial('ground', 'klinker', klinkerHd);
defineHdTerrainMaterial('edge', 'bikepath', bikepathHd);
defineHdTerrainMaterial('edge', 'kerb', kerbHd);
defineHdTerrainMaterial('platform', 'wood', woodHd);
defineHdTerrainMaterial('platform', 'whitewood', whitewoodHd);
defineHdTerrainHang('whitewood', whitewoodHangHd);
defineHdTerrainMaterial('solid', 'brick', brickHd);
