/**
 * The town's floor painter `oz/town` (docs/design/floor.md §5.1, §2; docs/api/floor.md §4): the
 * street of Oldenzaal from the shop fronts to the screen bottom, as the user picked it in the
 * mock-up's line-scroll direction. Back to front (depths: screen px behind the walk line on flat
 * ground; the layout is the section's, `OzTownLayout`):
 *
 *   Bentheimer sandstone pavement (square slabs, moss in the joints at the facades' feet and along
 *   the kerb, a few stained and cracked slabs) · the sandstone kerb (its top here; it is a raised
 *   ridge in the height field, its face the `kerb-face` tile) · the gutter of dark slate setts (the
 *   cast-iron drains) · the red-brown herringbone street (polished worn patches and walk lane, moss
 *   in the joints by the gutter; a flush strip of sandstone blocks under the front row of posts, when
 *   the layout has one) to the bottom, with the decals: cracked pavers at the rise spots
 *   (where the dead come up) and the cast frames of the manholes (the covers are the floor's
 *   openings, drawn flat over them).
 *
 * Nothing reads as blood (the level's rule): cracks darken toward soot and earth, never toward red;
 * wear is a lighter polish of the bricks; no puddles, no stains on the street.
 *
 * Pure in (u, v), the density, the params and the seed; texture space only (spec §2.2). Cost: one
 * zone test, a cell lookup and a ladder pick per texel (no allocation, no strings).
 */
import type { Color } from '../../../../../engine/color';
import { yOfV } from '../../../../../engine/floor/cam';
import { hash2 } from '../../../../art/paint';
import { defineFloorPainter, hasFloorPainter, type FloorPaintCtx } from '../../../../mission/floor/registry';
import { bevelW, blendRamps, dn, grain, jointW, moodShift, moodTones, moodTonesOf, OZ_FLOOR_IDS, smooth01, toneAt, vnoise, type OzLight } from './kit';

/** The street's layout for the painter (`FloorDef.painter.params`). */
export interface OzTownLayout {
  light: OzLight;
  /** Depths of the kerb top's far and near edge and of the gutter's near edge (the street starts there). */
  kerbBack: number;
  kerbFront: number;
  gutterFront: number;
  /** Rise spots (world x; cracked pavers around v = 0). */
  rise: readonly number[];
  /** Gutter drains (world x). */
  drains: readonly number[];
  /** Manholes (world x of the cover's middle; the painter draws the cast frame around the cover). */
  manholes: readonly number[];
  /** Optional: the depths of a flush strip of sandstone blocks in the street (far, near) the front posts stand on. */
  stripFar?: number;
  stripNear?: number;
}

/** Stoep slabs (world px), the kerb blocks, the gutter setts, the herringbone cell. */
const SLAB = 7;
const KERB_BLOCK = 24;
const STRIP_BLOCK = 18;
const SETT_L = 3.4;
const SETT_D = 2;
const HB = 4.6;
/** The manhole cover's radius (world px; the opening tile is 2 R square) and its cast frame. */
export const MANHOLE_R = 8;
const FRAME_R = 8.7;
/** The cracked pavers around a rise spot: half sizes along u and v (world px). */
const RISE_RU = 9.5;
const RISE_RV = 7.5;
/** Drains: half width along u. */
const DRAIN_HW = 4.5;
/** Decal lookup buckets (world px). */
const BUCKET = 8;

/** The grime of the worn patches and the broken bricks: grey-brown (stone blended toward brown). */
export const STREET_GRIME = (): readonly Color[] => blendRamps('stone', 'brown', 0.4);
/** The lowest tone a brick of the floor takes, street and side walls (the ramps' deeper tones read as wine red). */
export const BRICK_MIN = 2;
export const BRICK_DARK_MIN = 3;

/** Decal kinds in the bucket map. */
const NONE = 0;
const RISE = 1;
const DRAIN = 2;
const HOLE = 3;

function num(p: Readonly<Record<string, unknown>>, k: string, dflt: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
}

function nums(p: Readonly<Record<string, unknown>>, k: string): readonly number[] {
  const v = p[k];
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [];
}

function lightOf(p: Readonly<Record<string, unknown>>): OzLight {
  const v = p.light;
  return v === 'late' || v === 'night' ? v : 'dusk';
}

/**
 * The decals by bucket of BUCKET px over [u0, u1): kind and the decal's x. Decals are sparse (tens
 * of px apart); a bucket keeps the first decal that covers it.
 */
class Decals {
  readonly u0: number;
  readonly kind: Uint8Array;
  readonly at: Float64Array;

  constructor(u0: number, u1: number) {
    this.u0 = u0;
    const n = Math.max(1, Math.ceil((u1 - u0) / BUCKET));
    this.kind = new Uint8Array(n);
    this.at = new Float64Array(n);
  }

  add(kind: number, x: number, half: number): void {
    const a = Math.max(0, Math.floor((x - half - this.u0) / BUCKET));
    const b = Math.min(this.kind.length - 1, Math.floor((x + half - this.u0) / BUCKET));
    for (let i = a; i <= b; i++) {
      if (this.kind[i] !== NONE) continue;
      this.kind[i] = kind;
      this.at[i] = x;
    }
  }

  bucket(u: number): number {
    const i = Math.floor((u - this.u0) / BUCKET);
    return i < 0 || i >= this.kind.length ? -1 : i;
  }
}

/** The texel function of the town floor at density d (see the module header). */
export function townTexels(c: FloorPaintCtx): (u: number, v: number) => Color {
  const p = c.params;
  const d = c.d;
  const D = dn(d);
  const light = lightOf(p);
  const seed = c.seed;
  const cam = c.cam;
  const vBack = cam.vBack;
  const vKB = c.vAt(num(p, 'kerbBack', 8.4));
  const vKF = c.vAt(num(p, 'kerbFront', 7));
  const vGF = c.vAt(num(p, 'gutterFront', 5));
  // The posts' strip (none: an empty range).
  const vSF = c.vAt(num(p, 'stripFar', 0));
  const vSN = typeof p.stripNear === 'number' ? c.vAt(num(p, 'stripNear', 0)) : vSF;
  const jw = jointW(d);
  const bev = bevelW(d);
  const sb = d <= 1 ? 1 : 0.5;
  const shift = moodShift(light);
  // Ladders (tone · 2 indexes them).
  const SST = moodTones('sandstone', light, D);
  const SLT = moodTones('slate', light, D);
  // The bricks never reach their deepest (wine-red) tones; the darkening of wear, damage and dirt
  // is grey-brown grime instead (no-blood rule).
  const BRK = moodTones('brick', light, D);
  const BRD = moodTones('brickDark', light, D);
  const GRM = moodTonesOf('oz-grime', STREET_GRIME(), light, D);
  const SND = moodTones('sand', light, D);
  const MOS = moodTones('moss', light, D);
  const IRN = moodTones('black', light, D);
  const STN = moodTones('stone', light, D);
  // Decals over the mesh's u range (the section ± the floor's margin).
  const decals = new Decals(-256, 8192);
  for (const x of nums(p, 'manholes')) decals.add(HOLE, x, FRAME_R + 1);
  for (const x of nums(p, 'rise')) decals.add(RISE, x, RISE_RU + 1);
  for (const x of nums(p, 'drains')) decals.add(DRAIN, x, DRAIN_HW + 1);
  const kinds = decals.kind;
  const ats = decals.at;
  const back = cam.back;

  /** The light over depth: the far rows darker (the facades' shade), a vignette at the bottom. */
  const depthLight = (v: number): number => {
    const y = yOfV(cam, v);
    return shift - 0.6 * (1 - smooth01(back, back + 10, y)) - 0.4 * smooth01(200, 216, y);
  };

  /** Bentheimer sandstone slabs. */
  const stoep = (u: number, v: number, L: number): Color => {
    const iu = Math.floor(u / SLAB);
    const iv = Math.floor((v - vBack) / SLAB);
    const lu = u - iu * SLAB;
    const lv = v - vBack - iv * SLAB;
    // Contact shade at the facades' feet.
    const ao = v - vBack < 2.5 ? -0.9 * (1 - (v - vBack) / 2.5) : 0;
    if (lu < jw || lv < jw) {
      const nearWall = v - vBack < 3.2;
      const nearKerb = vKB - v < 2.4;
      const mossWall = nearWall && hash2(Math.floor(u * 2), Math.floor(v * 2), seed + 11) < 0.55;
      const mossKerb = nearKerb && hash2(Math.floor(u * 2), Math.floor(v * 2), seed + 12) < 0.3;
      if (mossWall || mossKerb) return toneAt(MOS, 2.3 + L * 0.5 + ao);
      return toneAt(SST, 1.6 + L * 0.5 + ao);
    }
    const h = hash2(iu, iv, seed + 1);
    let t = 4.4 + (h - 0.5) * 0.9 + L + ao;
    if (hash2(iu, iv, seed + 2) < 0.08) t -= 0.8;
    t += (vnoise(u, v, 3, seed + 3) - 0.5) * 0.6 + grain(u, v, d, seed + 4) * 0.35;
    if (lv < jw + sb) t += 0.6;
    else if (SLAB - lv < sb) t -= 0.6;
    if (lu < jw + sb) t += 0.35;
    else if (SLAB - lu < sb) t -= 0.35;
    // A hairline crack across a few slabs (a wobbly diagonal).
    if (hash2(iu, iv, seed + 5) < 0.07) {
      const k = lu / SLAB - (lv / SLAB) * (0.6 + h) + Math.sin(lv * 1.7) * 0.06;
      if (Math.abs(k - 0.15) * SLAB < jw * 0.75) t = 2.2 + L;
    }
    return toneAt(SST, t);
  };

  /** The kerb's top: long sandstone blocks, a lit front arris. */
  const kerbTop = (u: number, v: number, L: number): Color => {
    const b = Math.floor(u / KERB_BLOCK);
    const lu = u - b * KERB_BLOCK;
    if (lu < jw) return toneAt(SST, 2.4 + L * 0.5);
    let t = 5 + (hash2(b, 7, seed + 6) - 0.5) * 0.7 + L * 0.6 + grain(u, v, d, seed + 7) * 0.5;
    if (vKF - v < Math.max(jw, 0.6)) t = 6.8 + L * 0.4;
    else if (v - vKB < 0.5) t -= 1;
    return toneAt(SST, t);
  };

  /**
   * The posts' strip: a flush band of long sandstone blocks laid along the street (the front row of
   * iron posts stands on it), dark joints where it meets the bricks, the blocks a little worn.
   */
  const strip = (u: number, v: number, L: number): Color => {
    const b = Math.floor(u / STRIP_BLOCK);
    const lu = u - b * STRIP_BLOCK;
    if (lu < jw || v - vSF < jw || vSN - v < jw) return toneAt(SND, 1.2 + L * 0.5);
    let t = 4.3 + (hash2(b, 11, seed + 21) - 0.5) * 0.6 + L * 0.6 + grain(u, v, d, seed + 22) * 0.45;
    if (v - vSF < jw + sb) t += 0.5;
    else if (vSN - v < jw + sb) t -= 0.5;
    return toneAt(SST, t);
  };

  /** The gutter: two rows of dark slate setts (running bond), the drains. */
  const gutter = (u: number, v: number, L: number, k: number): Color => {
    if (k >= 0 && kinds[k] === DRAIN) {
      const dx = u - ats[k];
      if (dx > -DRAIN_HW && dx < DRAIN_HW) {
        if (dx < -DRAIN_HW + 0.8 || dx > DRAIN_HW - 0.8 || v - vKF < 0.5 || vGF - v < 0.5) return toneAt(IRN, 2.6 + L * 0.5);
        return (Math.floor((dx + DRAIN_HW) / 1.1) & 1) === 0 ? toneAt(IRN, 0.4) : toneAt(IRN, 1.6 + L * 0.4);
      }
    }
    const r = Math.floor((v - vKF) / SETT_D);
    const lv = v - vKF - r * SETT_D;
    const uu = u + (r & 1) * SETT_L * 0.5;
    const b = Math.floor(uu / SETT_L);
    const lu = uu - b * SETT_L;
    if (lu < jw || lv < jw * 0.8) return toneAt(IRN, 0.6 + L * 0.4);
    let t = 2.9 + (hash2(b, r, seed + 8) - 0.5) * 0.9 + L + grain(u, v, d, seed + 9) * 0.4;
    if (lv < jw * 0.8 + sb) t += 0.7;
    // Damp along the kerb's foot.
    if (r === 0) t -= 0.4;
    return toneAt(SLT, t);
  };

  /** The herringbone street (Dutch "keperverband" of 2:1 bricks). */
  const street = (u: number, v: number, L: number, k: number): Color => {
    const kind = k >= 0 ? kinds[k] : NONE;
    if (kind === HOLE) {
      const dx = u - ats[k];
      const r2 = dx * dx + v * v;
      if (r2 < FRAME_R * FRAME_R) {
        // The cast frame round the cover (the cover itself is the floor's opening, drawn over it).
        if (r2 < MANHOLE_R * MANHOLE_R) return toneAt(IRN, 1.2 + L * 0.4);
        return toneAt(IRN, (v > 0 ? 3 : 1.8) + L * 0.5);
      }
    }
    const x = Math.floor(u / HB);
    const y = Math.floor(v / HB);
    const m = (((x - y) % 4) + 4) % 4;
    let x0 = x;
    let y0 = y;
    let BL = 2 * HB;
    let BD = HB;
    if (m === 1) x0 = x - 1;
    else if (m === 2) {
      y0 = y - 1;
      BL = HB;
      BD = 2 * HB;
    } else if (m === 3) {
      BL = HB;
      BD = 2 * HB;
    }
    const lu = u - x0 * HB;
    const lv = v - y0 * HB;
    const h = hash2(x0 * 2 + (BL > HB ? 0 : 1), y0, seed + 10);
    // Cracked pavers round a rise spot: broken bricks, dark cracks, a few gone to the earth.
    let crack = 0;
    if (kind === RISE) {
      const qx = (u - ats[k]) / RISE_RU;
      const qy = v / RISE_RV;
      const q = qx * qx + qy * qy;
      if (q < 1) {
        const cx = (x0 * HB + BL / 2 - ats[k]) / RISE_RU;
        const cy = (y0 * HB + BD / 2) / RISE_RV;
        if (cx * cx + cy * cy < 0.45 && h < 0.3) return toneAt(STN, 0.8 + L * 0.4 + grain(u, v, d, seed + 13) * 0.6);
        const sk = hash2(Math.floor(ats[k]), 1, seed + 14) * 6.283;
        const ang = Math.atan2(qy, qx);
        for (let i = 0; i < 4; i++) {
          const a = sk + i * 1.62 + (hash2(Math.floor(ats[k]), i, seed + 15) - 0.5) * 0.7;
          const dev = Math.sin(ang - a) * Math.sqrt(q) * RISE_RU;
          if (Math.abs(dev + Math.sin(q * 9 + i) * 0.35) < jw * 0.6 && Math.cos(ang - a) > 0) return toneAt(GRM, 0.5 + L * 0.3);
        }
        crack = 1 - q;
      }
    }
    if (lu < jw || lv < jw) {
      const nearGutter = v - vGF < 2.2;
      if (nearGutter && hash2(Math.floor(u * 2), Math.floor(v * 2), seed + 16) < 0.3) return toneAt(MOS, 2 + L * 0.5);
      return toneAt(SND, 1.1 + L * 0.5 - crack * 0.6);
    }
    let ramp = BRK;
    let t: number;
    if (h < 0.4) t = 2.6;
    else if (h < 0.8) {
      ramp = BRD;
      t = 3.6;
    } else t = 3.3;
    // Broken bricks round a rise spot: grey-brown grime (soot and dust).
    if (crack > 0) {
      ramp = GRM;
      t = 2.3;
    }
    // Worn patches: bricks polished by feet and wheels, brick by brick a little lighter and more even
    // (a sheen, never a dark blot that could read as a stain).
    const wear = smooth01(0.72, 0.86, vnoise(x0 * HB + BL / 2, y0 * HB + BD / 2, 22, seed + 18));
    t += L + (hash2(Math.floor(h * 1e4), 3, seed + 17) - 0.5) * 0.5 * (1 - 0.6 * wear) + wear * 0.45;
    if (lv < jw + bev) t += 0.9;
    else if (BD - lv < bev) t -= 0.8;
    if (lu < jw + bev) t += 0.5;
    else if (BL - lu < bev) t -= 0.6;
    // A low dome: lighter in the middle of the brick.
    t += (0.25 - Math.abs(lu / BL - 0.45) * 0.5 - Math.abs(lv / BD - 0.4) * 0.5) * 0.8;
    // A polished walk lane, grain; broken bricks round a rise spot sink and darken.
    if (v > -6 && v < 12) t += 0.25;
    t += grain(u, v, d, seed + 19) * 0.45;
    if (crack > 0) t -= 0.3 + crack * 0.6;
    if (ramp === BRK && t < BRICK_MIN) t = BRICK_MIN;
    else if (ramp === BRD && t < BRICK_DARK_MIN) t = BRICK_DARK_MIN;
    return toneAt(ramp, t);
  };

  return (u: number, v: number): Color => {
    const L = depthLight(v);
    if (v < vKB) return stoep(u, v, L);
    if (v < vKF) return kerbTop(u, v, L);
    const k = decals.bucket(u);
    if (v < vGF) return gutter(u, v, L, k);
    if (v >= vSF && v < vSN) return strip(u, v, L);
    return street(u, v, L, k);
  };
}

/**
 * Where nothing may stand in the town's street (spec §11 R2, the street logic), as a world-v range
 * [far, near] for `vAt` (depth → world v): the gutter of slate setts between the kerb and the street,
 * with its drains. The herringbone in front of it is a pedestrian street (the walk plane lies in it:
 * the planters on their walls, the abandoned cars, the crates, the front row of posts).
 */
export function townGutter(p: Readonly<Record<string, unknown>>, vAt: (depth: number) => number): readonly [number, number] {
  return [vAt(num(p, 'kerbFront', 7)), vAt(num(p, 'gutterFront', 5))];
}

/** Register the town painter (once). */
export function ensureTownPainter(): void {
  if (!hasFloorPainter(OZ_FLOOR_IDS.painter)) defineFloorPainter(OZ_FLOOR_IDS.painter, townTexels);
}
