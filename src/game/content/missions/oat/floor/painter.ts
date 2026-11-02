/**
 * The street floor painter `oat-street` (STREET-A, wave A; docs/design/oat.md §8.4, §8.7 a 6, §8.7
 * d 4, §8.10; docs/api/floor.md §4): the top surface of oat-a's streets, quays and bridge decks by
 * day and of oat-d's quay at night, painted in WORLD (u, v) at density d.
 *
 * Day (oat-a, 09:30, sun 32° high-left): the materials of layout.ts in the light of LIGHT-WATER's
 * shade model (`sectionShade('oat-a').floor`: the opposite row's shade over the narrow streets, the
 * sun wedges at their west ends, the full sun on the bridges, the casters' shadows), WET in the
 * shade after the night's rain and DRYING in the sun (the wetness field below reads the same
 * shade), puddles in the gutters and round the gully grates, and the wear decals (gum, cigarette
 * ends in the joints, yellow elm leaves, oil, litter, sunken bricks, moss along kerbs and the
 * coping, drain grates: ≥ 12 marks per 256 px, spec §8.10).
 *
 * Night (oat-d, the proof strip 0–1,280): all wet; the clinkers near-black with the navy sky's sheen
 * on their domes; the lamps' baked light (spec §8.9): every light of `D_LIGHTS` lifts the brick in
 * its own ramp (warm lantern, pink and cyan neon) in a pool round its foot; litter, bottle glass,
 * gum. The streaks (on the water and the wet floor) are LIGHT-WATER's light pass: a streak runs down
 * the SCREEN toward the eye, which a world-space chunk cannot paint (it would converge).
 *
 * Pure in (u, v), the density, the params and the seed (docs/api/floor.md §4): no screen
 * coordinate, no time, no global rng. Per texel: a stretch lookup, a band test, one brick function,
 * a decal cell hash and two ladder picks (no allocation).
 */
import type { Color } from '../../../../../engine/color';
import { defineFloorPainter, hasFloorPainter, type FloorPaintCtx } from '../../../../mission/floor/registry';
import { bay, type Dn } from '../art/kit';
import { sectionShade } from '../light/index';
import { defineWetness, wetnessOf } from './index';
import {
  A_STRETCHES,
  COPING,
  D_COPING_FAR,
  D_COPING_NEAR,
  D_FAR_KERB,
  D_STRETCHES,
  DECK_NEAR,
  FACADE,
  FAR_KERB,
  KERB_W,
  NEAR_KERB,
  OAT_CAMERA,
  stretchAt,
  type Stretch,
} from './layout';
import { at, B, blocks, cellHash, dayMats, grainAt, herringbone, nightMats, slabs, stretcher, type Mat } from './mat';

/** The painter id (docs/api/oat.md "Floor"). */
export const OAT_STREET_PAINTER = 'oat-street';

/** World v of a floor depth for the oat street camera (docs/api/floor.md §2). */
export function vOfDepth(depth: number): number {
  const s = 1 - depth / (176 - OAT_CAMERA.yh);
  return OAT_CAMERA.f * (1 - 1 / s);
}

function dnOf(d: number): Dn {
  return d >= 4 ? 4 : d >= 2 ? 2 : 1;
}

// ------------------------------------------------------------------------------------ the lights of oat-d

/** A baked light of the d strip (spec §8.9): world x, depth, height (px), kind, pool radius and strength. */
export interface FloorLight {
  readonly u: number;
  readonly depth: number;
  readonly h: number;
  readonly kind: 'lamp' | 'pink' | 'cyan' | 'red';
  readonly r: number;
  readonly k: number;
}

/**
 * The lights of the oat-d proof strip (0–1,280): the Ritter wall lanterns and the Kroon masts on our
 * pavement, the neon signs over the bar doors (art/place-d.ts places the same lights). GRAMMAR's
 * own façade lights (red tubes, bar windows, lit windows: its `FacadeFeature`s) join this list when
 * its lot query exports them (INTEGRATE; docs/api/oat.md "Floor").
 */
export const D_LIGHTS: readonly FloorLight[] = [
  { u: 96, depth: 15.5, h: 72, kind: 'lamp', r: 46, k: 0.9 },
  { u: 196, depth: 15.5, h: 50, kind: 'pink', r: 30, k: 0.8 },
  { u: 330, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1 },
  { u: 486, depth: 15.5, h: 52, kind: 'cyan', r: 28, k: 0.75 },
  { u: 600, depth: 15.5, h: 72, kind: 'lamp', r: 46, k: 0.9 },
  { u: 742, depth: 15.5, h: 50, kind: 'red', r: 26, k: 0.75 },
  { u: 880, depth: 12.8, h: 84, kind: 'lamp', r: 56, k: 1 },
  { u: 1012, depth: 15.5, h: 52, kind: 'lamp', r: 30, k: 0.7 }, // the KOFFIE sign (warm)
  { u: 1150, depth: 15.5, h: 72, kind: 'lamp', r: 46, k: 0.9 },
  { u: 1250, depth: 15.5, h: 50, kind: 'pink', r: 26, k: 0.7 }, // the second BAR (pink)
];

// ------------------------------------------------------------------------------------ wetness (spec §8.10)

/** Gully grates along the gutters (world u; every ~150 px, a little jitter): puddles gather there. */
export function gratesOf(list: readonly Stretch[]): number[] {
  const out: number[] = [];
  for (const s of list) {
    if (s.kind === 'bridge') continue;
    for (let u = s.u0 + 70; u < s.u1 - 30; u += 150) out.push(u + Math.round((cellHash(u, 1, 91) - 0.5) * 40));
  }
  return out;
}

const A_GRATES = gratesOf(A_STRETCHES);
const D_GRATES = gratesOf(D_STRETCHES);

function nearGrate(grates: readonly number[], u: number, r: number): number {
  let best = Infinity;
  for (let i = 0; i < grates.length; i++) {
    const g = Math.abs(grates[i] - u);
    if (g < best) best = g;
  }
  return best < r ? 1 - best / r : 0;
}

/** Smooth value noise 0 … 1 on a grid of `cell` world px (world-anchored). */
function vnoise(u: number, v: number, cell: number, seed: number): number {
  const x = u / cell;
  const y = v / cell;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = cellHash(ix, iy, seed);
  const b = cellHash(ix + 1, iy, seed);
  const c = cellHash(ix, iy + 1, seed);
  const e = cellHash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
}

const V_FAR_KERB = vOfDepth(FAR_KERB);
const V_NEAR_KERB = vOfDepth(NEAR_KERB);
const V_D_KERB = vOfDepth(D_FAR_KERB);
const V_D_COPING = vOfDepth(D_COPING_FAR);

/**
 * oat-a: wet in the shade after a night of rain, drying in the sun strips (the same shade model the
 * painter lights with), damp at the edge of the sun; puddles in the gutters along both kerbs and
 * round the gully grates, which stay wet in the sun too. 0 dry … 1 a puddle.
 */
function wetA(u: number, v: number): number {
  const sh = sectionShade('oat-a').floor(u, v, 4);
  const s = stretchAt(A_STRETCHES, u);
  let w = 0.12 + 0.78 * sh;
  // The gutters (the street's edge courses at both kerbs) and the grates.
  if (s.kind !== 'bridge') {
    const g = Math.min(Math.abs(v - V_FAR_KERB - 1.2), Math.abs(v - V_NEAR_KERB + 1.2));
    if (g < 2.4) {
      const n = vnoise(u, v, 9, 717);
      const k = (1 - g / 2.4) * (0.55 + 0.6 * n) + nearGrate(A_GRATES, u, 14) * 0.6;
      if (k > 0.62) return 1;
      w = Math.max(w, 0.5 + k * 0.5);
    }
  } else {
    // The deck drains to its edges: a few damp joints in the hollows.
    const n = vnoise(u, v, 7, 719);
    if (n > 0.8 && sh > 0.3) return 1;
  }
  return Math.min(0.97, w);
}

/** oat-d: all wet (the strongest night picture); puddles in the gutter and the dips by the coping. */
function wetD(u: number, v: number): number {
  const g = Math.min(Math.abs(v - V_D_KERB - 1.2), Math.abs(v - V_D_COPING + 1.4));
  const n = vnoise(u, v, 8, 723);
  if (g < 2.2 && (1 - g / 2.2) * (0.6 + 0.6 * n) + nearGrate(D_GRATES, u, 12) * 0.5 > 0.6) return 1;
  if (n > 0.86) return 1;
  return 0.95;
}

defineWetness('oat-a', wetA);
defineWetness('oat-d', wetD);

// ------------------------------------------------------------------------------------ decals (spec §8.10)

/** Decal kinds (by band). */
const GUM = 1;
const BUTT = 2;
const LEAF = 3;
const OIL = 4;
const PAPER = 5;
const TYRE = 6;

/** Elms on the open quays (u of the trunk; leaves gather under them: art/place-a.ts plants them there). */
export const A_ELMS: readonly number[] = [60, 236, 4140, 4300];

function leafBias(u: number): number {
  let b = 0;
  for (let i = 0; i < A_ELMS.length; i++) {
    const dd = Math.abs(u - A_ELMS[i]);
    if (dd < 90) b = Math.max(b, 1 - dd / 90);
  }
  return b;
}

// ------------------------------------------------------------------------------------ the painter

function str(p: Readonly<Record<string, unknown>>, k: string, dflt: string): string {
  const v = p[k];
  return typeof v === 'string' ? v : dflt;
}

/** The texel function at density d (see the module header). */
export function streetTexels(c: FloorPaintCtx): (u: number, v: number) => Color {
  const p = c.params;
  const d = c.d;
  const D = dnOf(d);
  const night = str(p, 'light', 'morning') === 'night';
  // `wear: false` paints the bare materials (the tests count the marks as the difference).
  const wear = p.wear !== false;
  const sectionId = str(p, 'section', night ? 'oat-d' : 'oat-a');
  const list = night ? D_STRETCHES : A_STRETCHES;
  const seed = c.seed | 0;
  const shade = sectionShade(sectionId);
  const wet = wetnessOf(sectionId);
  const vFacade = c.vAt(FACADE);
  const vCop = c.vAt(COPING);
  const vKerbTop = c.vAt(FAR_KERB + KERB_W);
  const vFarKerb = c.vAt(FAR_KERB);
  const vNear = c.vAt(NEAR_KERB);
  const vNearTop = c.vAt(NEAR_KERB - KERB_W);
  const vDeckNear = c.vAt(DECK_NEAR);
  const vDKerbTop = c.vAt(D_FAR_KERB + KERB_W);
  const vDKerb = c.vAt(D_FAR_KERB);
  const vDCop0 = c.vAt(D_COPING_FAR);
  const vDCop1 = c.vAt(D_COPING_NEAR);
  // Joints: half a px wide at 2× / 4×, none at 1× (only tone, spec §8.10); bevels at 2× / 4×.
  const jw = d <= 1 ? 0 : 0.25;
  const bv = d >= 4 ? 0.3 : d >= 2 ? 0.5 : 0;
  const fine = d >= 2;
  const day = dayMats(D);
  const nm = nightMats(D);
  // Lights by 64 px bucket (night).
  const nb = Math.ceil(4608 / 64) + 2;
  const lightB: FloorLight[][] = Array.from({ length: nb }, () => []);
  const lv = new Map<FloorLight, number>();
  if (night) {
    for (const L of D_LIGHTS) {
      lv.set(L, c.vAt(L.depth));
      const a = Math.max(0, Math.floor((L.u - L.r - 4) / 64));
      const b = Math.min(nb - 1, Math.floor((L.u + L.r + 4) / 64));
      for (let i = a; i <= b; i++) lightB[i].push(L);
    }
  }
  let last: Stretch = list[0];

  /** A day texel of a material: tone t on the material's ladders, lit `lit`, wetness w, at art (X, Y). */
  const dayTone = (m: Mat, t: number, lit: number, w: number, X: number, Y: number, joint: boolean): Color => {
    // Ordered dither only in the transitions (the penumbra, the drying edge): spec §8.5.
    const sunny = lit + (bay(X, Y) - 0.5) * 0.4 > 0.5;
    const isWet = w + (bay(X + 3, Y + 5) - 0.5) * 0.3 > 0.5;
    if (joint) {
      if (isWet && m.flatJoints) return at(m.jointWet, sunny ? 2 : 1);
      if (isWet) return at(day.sheen, 0.6 + (sunny ? 1.5 : 0.5) * cellHash(X >> 2, Y >> 2, 31));
      return at(m.joint, (sunny ? 2.2 : 1) + (t - 6) * 0.15);
    }
    const list2 = sunny ? (isWet ? m.sunWet : m.sun) : isWet ? m.shadeWet : m.shade;
    return at(list2, t);
  };

  return (u: number, v: number): Color => {
    if (u < last.u0 || u >= last.u1) last = stretchAt(list, u);
    const s = last;
    const X = Math.floor(u * d);
    const Y = Math.floor(v * d);
    const gr = fine ? grainAt(u, v, d, seed + 3) - 0.5 : 0;

    // ---------------------------------------------------------------- night: the d quay
    if (night) {
      let m: readonly Color[];
      let t: number;
      let joint = false;
      let stone = 0; // 0 clinker, 1 kerb / coping, 2 paver
      if (v < vDKerbTop) {
        stretcher(u, v, 4.2, 2, jw, bv, seed + 21);
        m = nm.paver;
        stone = 2;
      } else if (v < vDKerb) {
        blocks(u, 22, jw * 1.4, seed + 23);
        m = nm.granite;
        stone = 1;
      } else if (v < vDCop0) {
        herringbone(u, v, 2, jw, bv, seed + 25);
        m = nm.clinker;
      } else if (v < vDCop1) {
        blocks(u, 30, jw * 1.4, seed + 27);
        m = nm.coping;
        stone = 1;
      } else {
        // Under the water cut (its own tile draws it): the chunk keeps a dark wet edge.
        return at(nm.clinker, 0);
      }
      joint = B.joint === 1;
      t = (fine ? 1.4 : 1.6) + B.h * (stone === 1 ? 1.2 : 2.2) + B.edge * 0.7 + gr * 0.5;
      if (B.h2 < 0.04 && stone === 0) t -= 1.2; // a sunken brick
      // The lights: the strongest pool or streak here.
      let best = 0;
      let kind: FloorLight['kind'] = 'lamp';
      const bucket = lightB[Math.max(0, Math.min(nb - 1, Math.floor(u / 64)))];
      for (let i = 0; i < bucket.length; i++) {
        const L = bucket[i];
        const v0 = lv.get(L) as number;
        const du = (u - L.u) / L.r;
        const dv = (v - v0) / (L.r * 0.42);
        let q = 1 - (du * du + dv * dv);
        q = q > 0 ? q * q * L.k : 0;
        if (q > best) {
          best = q;
          kind = L.kind;
        }
      }
      const w = wet(u, v);
      if (best > 0.08) {
        const lad = kind === 'lamp' ? nm.lamp : kind === 'pink' ? nm.pink : kind === 'cyan' ? nm.cyan : nm.red;
        if (w >= 0.98 && kind === 'lamp') return at(lad, lad.length - 1 - (1 - best) * 3);
        if (joint) return at(lad, best * 2);
        const k = best * (lad.length - 1) * (0.75 + 0.35 * B.across) + gr * 0.8 + B.edge * 0.4;
        return at(lad, k);
      }
      if (w >= 0.98) return at(nm.sheen, 1 + gr + B.across);
      if (joint) return at(nm.joint, B.h2 * 2);
      // Wear at night: litter, gum, bottle glass on the quay (≥ 12 per 256 px).
      if (wear && fine && stone !== 1) {
        const cu = Math.floor(u / 7);
        const cv = Math.floor(v / 7);
        const hh = cellHash(cu, cv, seed + 61);
        if (hh < 0.2) {
          const h3 = cellHash(cv, cu, seed + 62);
          const cx = cu * 7 + 2 + 3 * h3;
          const cy = cv * 7 + 2 + 3 * cellHash(cu + 9, cv, seed + 63);
          const dx = u - cx;
          const dy = v - cy;
          if (hh < 0.08) {
            if (dx * dx + dy * dy < 0.5) return nm.gum[h3 < 0.5 ? 0 : 1];
          } else if (hh < 0.14) {
            if (Math.abs(dx) < 1.1 && Math.abs(dy) < 0.7) return nm.paper[Math.floor(h3 * 3)];
          } else if (Math.abs(dx + dy * 0.6) < 0.6 && Math.abs(dy) < 0.4) return nm.glass[Math.floor(h3 * 4)];
        }
      }
      // The navy sky's sheen on the wet domes, away from the lamps.
      if (B.across > 0.6 && B.h2 > 0.55) return at(nm.sheen, (B.across - 0.6) * 4);
      return at(m, t);
    }

    // ---------------------------------------------------------------- day: oat-a
    const lit = 1 - shade.floor(u, v, d);
    const w = wet(u, v);
    // Puddles: the sky's flat mirror, a dark rim.
    if (w >= 0.98) {
      const rim = wet(u, v - 0.8) < 0.98 || wet(u, v + 0.8) < 0.98 || wet(u - 1, v) < 0.98 || wet(u + 1, v) < 0.98;
      if (rim && fine) return at(day.puddle, 0.4);
      return at(day.puddle, 2 + (lit > 0.5 ? 2.5 : 0.5) + 1.6 * (1 - (v - vFacade) / 90) + gr * 0.6);
    }
    let m: Mat;
    let t: number;
    let band: 'street' | 'pave' | 'kerb' | 'coping' | 'deck' | 'tile';
    if (s.kind === 'bridge') {
      if (v < vFacade + 2.4 || v > vDeckNear - 2.4) {
        blocks(u, 18, jw * 1.4, seed + 13);
        m = day.granite;
        band = 'kerb';
      } else {
        herringbone(u, v, 2, jw, bv, seed + 11);
        m = day.clinker;
        band = 'deck';
      }
    } else if (v < vKerbTop) {
      if (s.kind === 'quay' && v < vCop) {
        blocks(u, 26, jw * 1.4, seed + 15);
        m = day.coping;
        band = 'coping';
      } else if (s.kind === 'quay') {
        herringbone(u, v, 2, jw, bv, seed + 17);
        m = day.paver;
        band = 'pave';
      } else {
        stretcher(u, v, 4.2, 2, jw, bv, seed + 19);
        m = day.paver;
        band = 'pave';
      }
    } else if (v < vFarKerb || (v >= vNear && v < vNearTop)) {
      blocks(u, 20, jw * 1.4, seed + 13);
      m = day.granite;
      band = 'kerb';
    } else if (v < vNear) {
      // The gutter: the street's edge course of clinkers laid along the kerb.
      if (v < vFarKerb + 2 || v > vNear - 2) stretcher(u, v - (v < 0 ? vFarKerb : vNear), 4, 2, jw, bv, seed + 23);
      else herringbone(u, v, 2, jw, bv, seed + 11);
      m = day.clinker;
      band = 'street';
    } else {
      slabs(u, v, 6, jw, bv, seed + 29);
      m = day.tile;
      band = 'tile';
    }
    const joint = B.joint === 1;
    const len = m.sun.length;
    t = len * 0.3 + B.h * len * (band === 'kerb' || band === 'coping' ? 0.22 : band === 'tile' ? 0.2 : 0.42) + B.edge * 1.6 + gr * 0.8;
    if (band === 'kerb') t += B.edge > 0 ? 1.5 : 0.8; // the kerb's worn top
    if (band === 'street' && B.h2 < 0.025) t -= 2.4; // a sunken, broken brick
    if (band === 'tile' && B.h2 < 0.06) t -= 1.4; // a stained or sunken tile
    // Moss in the joints along the kerbs and the coping.
    if (wear && joint && fine && (band === 'coping' || band === 'kerb' || (band === 'pave' && v < vFacade + 3)) && cellHash(X >> 1, Y >> 1, seed + 51) < 0.5) {
      return at(day.moss, cellHash(X, Y, seed + 52) * 3 + (lit > 0.5 ? 1 : 0));
    }
    // Wear decals (texture space; at 1× only the big oil stains).
    const cu = Math.floor(u / 8);
    const cv = Math.floor(v / 8);
    const hh = cellHash(cu, cv, seed + 101);
    const leafy = leafBias(u);
    const pDecal = 0.13 + (band === 'street' ? 0.05 : 0) + leafy * 0.5;
    if (wear && hh < pDecal && !joint) {
      const h3 = cellHash(cv, cu, seed + 102);
      const h4 = cellHash(cu + 13, cv - 7, seed + 103);
      const cx = cu * 8 + 2 + 4 * h3;
      const cy = cv * 8 + 2 + 4 * h4;
      const dx = u - cx;
      const dy = v - cy;
      let kind = leafy > 0 && h3 < leafy * 0.8 ? LEAF : hh < 0.05 ? GUM : hh < 0.08 ? BUTT : hh < 0.1 ? PAPER : band === 'street' && hh < 0.12 ? OIL : band === 'street' ? TYRE : GUM;
      if (kind === OIL && band !== 'street') kind = GUM;
      if (!fine && kind !== OIL) kind = 0;
      switch (kind) {
        case GUM:
          if (dx * dx + dy * dy < 0.35 + h4 * 0.3) return day.gum[h4 < 0.5 ? 0 : 1];
          break;
        case BUTT: {
          const a = h4 * Math.PI;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const along = dx * ca + dy * sa;
          const across = -dx * sa + dy * ca;
          if (Math.abs(along) < 0.9 && Math.abs(across) < 0.25) return day.butt[along > 0.45 ? 3 : h3 < 0.5 ? 1 : 0];
          break;
        }
        case LEAF: {
          const a = h4 * Math.PI * 2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const along = dx * ca + dy * sa;
          const across = -dx * sa + dy * ca;
          if ((along * along) / 1.6 + (across * across) / 0.4 < 1) return day.leaf[Math.floor(cellHash(cu, cv, seed + 104) * 5) + (lit > 0.5 && across < 0 ? 0 : 0)];
          break;
        }
        case PAPER:
          if (Math.abs(dx) < 1.2 && Math.abs(dy) < 0.8) return day.paper[lit > 0.5 ? (dy < 0 ? 2 : 1) : dy < 0 ? 1 : 0];
          break;
        case OIL: {
          const r = 2.2 + h4 * 1.6;
          const q = (dx * dx) / (r * r) + (dy * dy) / (r * r * 0.5);
          if (q < 1) return q < 0.35 && fine ? day.oil[2] : day.oil[q < 0.7 ? 0 : 1];
          break;
        }
        case TYRE:
          // A bike tyre's dark track on the wet street (along u).
          if (Math.abs(dy) < 0.22 && Math.abs(dx) < 3.5 && w > 0.3) return at(m.shadeWet, 1);
          break;
      }
    }
    // The drain grates at the gutters (cast iron bars).
    if (wear && band === 'street' && fine) {
      const g = nearGrate(A_GRATES, u, 3);
      const nearFar = v < vFarKerb + 2.2;
      const nearNear = v > vNear - 2.2;
      if (g > 0 && (nearFar || nearNear)) {
        const bar = Math.floor((u - Math.floor(u / 0.8) * 0.8) * 2.5) === 0;
        return day.iron[bar ? 3 : g > 0.7 ? 0 : 1];
      }
    }
    return dayTone(m, t, lit, w, X, Y, joint);
  };
}

/** Register the painter once (the section files call it; tests may too). */
export function ensureStreetPainter(): string {
  if (!hasFloorPainter(OAT_STREET_PAINTER)) defineFloorPainter(OAT_STREET_PAINTER, streetTexels);
  return OAT_STREET_PAINTER;
}
