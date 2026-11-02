/**
 * A PLACEHOLDER strip source (docs/design/oat.md §8.6; STRIPS, wave A): coloured canal houses with
 * gables (step, neck, bell, spout, cornice), windows, doors and shop fronts, lit from the left, with a
 * dark set (03:00: black brick, a few warm windows, red tubes). It is not the façade grammar (GRAMMAR's
 * `oat-facade` source replaces it): it exists so the store, the view and the tools can be tested and
 * looked at before the grammar lands, and as a stand-in source for any section (`source:
 * PLACEHOLDER_STRIP_SOURCE`). It paints in the strip space (space.ts) exactly as a real source must:
 * lots planned in world x, mapped with the plane's scale; heights in world px × s.
 *
 * Row params (optional): `markers: true` draws a tick at the base every 64 world px (and a taller one
 * every 256) to check the strips against the floor's grid (`--floor-debug`).
 *
 * Palette: PAL at 1×, PAL_HD + PAL_HD_OAT at 2× / 4× (every pixel exact; no outline).
 */
import type { Color } from '../../../engine/color';
import { PAL } from '../../../engine/palette';
import { PAL_HD, PAL_HD_OAT } from '../../../engine/palette-hd';
import { hash2 } from '../../art/paint';
import { defineStripSource } from './source';
import { stripBandRows, stripXOfU } from './space';
import { STRIP_CHUNK, type SectionStripsDef, type StripDensity, type StripLightSet, type StripPlan, type StripSectionInfo } from './types';
import type { PixelBuffer } from '../../../engine/pixel';

export const PLACEHOLDER_STRIP_SOURCE = 'strips-placeholder';

/** Lot widths in world px (18 … 26 Amsterdam feet at 0.6: spec §8.2). */
const LOT_W: readonly number[] = [61, 68, 74, 82, 89];

/** One placeholder lot, in strip px. */
interface Lot {
  p0: number;
  p1: number;
  /** Ridge / gable tip, cornice line and the ground band's top, strip px above the base. */
  ridge: number;
  cornice: number;
  band: number;
  /** 0 step, 1 neck, 2 bell, 3 spout, 4 cornice. */
  gable: number;
  /** Wall tone offset (0 … 2) and the door's colour (0 green, 1 oxblood). */
  tone: number;
  door: number;
  bays: number;
  /** A shop front in the ground band. */
  shop: boolean;
  /** The lot's hash (windows lit at night, the red tube). */
  h: number;
  markers: boolean;
}

/** The colour roles at 1× (PAL) and at 2× / 4× (PAL_HD ∪ PAL_HD_OAT). */
interface Roles {
  brick: readonly Color[];
  stone: readonly Color[];
  glass: readonly Color[];
  door: readonly (readonly Color[])[];
  lamp: readonly Color[];
  red: readonly Color[];
  white: Color;
}

const LO: Roles = {
  brick: [PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.red[0], PAL.red[1], PAL.brown[2], PAL.brown[3]],
  stone: [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]],
  glass: [PAL.navy[0], PAL.navy[1], PAL.steel[1]],
  door: [
    [PAL.ink[0], PAL.teal[0], PAL.green[0]],
    [PAL.ink[0], PAL.red[0], PAL.red[1]],
  ],
  lamp: [PAL.orange[0], PAL.gold[2], PAL.gold[3]],
  red: [PAL.red[1], PAL.red[2]],
  white: PAL.snow[1],
};

const HI: Roles = {
  brick: PAL_HD_OAT.brick,
  stone: PAL_HD_OAT.mortar,
  glass: [PAL_HD_OAT.canal[0], PAL_HD_OAT.nightSky[1], PAL_HD_OAT.canal[3]],
  door: [
    [PAL_HD_OAT.green[0], PAL_HD_OAT.green[1], PAL_HD_OAT.green[3]],
    [PAL_HD_OAT.oxblood[0], PAL_HD_OAT.oxblood[1], PAL_HD_OAT.oxblood[2]],
  ],
  lamp: [PAL_HD_OAT.lantern[1], PAL_HD_OAT.lantern[2], PAL_HD_OAT.lantern[3]],
  red: [PAL_HD_OAT.redLight[1], PAL_HD_OAT.redLight[2]],
  white: PAL_HD.snow[2],
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The lots of a def's rows (world x planned, mapped to strip px with the plane's scale s). */
function planLots(def: SectionStripsDef, info: StripSectionInfo, s: number): Lot[] {
  const out: Lot[] = [];
  for (const row of def.rows) {
    const seed = row.seed ?? (hashStr(info.id) ^ Math.imul(Math.floor(row.u0), 2654435761)) >>> 0;
    const markers = row.params?.markers === true;
    let u = row.u0;
    for (let i = 0; u < row.u1; i++) {
      const r = (k: number): number => hash2(i, k, seed);
      let w = LOT_W[Math.floor(r(1) * LOT_W.length) % LOT_W.length];
      // A short rest joins the last lot.
      if (row.u1 - (u + w) < 30) w = row.u1 - u;
      const ridgeW = 130 + Math.floor(r(2) * 60);
      const gable = Math.floor(r(3) * 5) % 5;
      const ridge = ridgeW * s;
      const gableH = (gable === 4 ? 10 : 26 + r(4) * 14) * s;
      out.push({
        p0: stripXOfU(u, s),
        p1: stripXOfU(u + w, s),
        ridge: Math.min(ridge, def.height - 1),
        cornice: Math.min(ridge, def.height - 1) - gableH,
        band: (64 + Math.floor(r(5) * 20)) * s,
        gable,
        tone: Math.floor(r(6) * 3) % 3,
        door: r(7) < 0.6 ? 0 : 1,
        bays: w >= 80 ? 3 : 2,
        shop: r(8) < 0.55,
        h: Math.floor(r(9) * 1e6),
        markers,
      });
      u += w;
    }
  }
  return out;
}

/** Is strip point (t across the lot 0 … 1, y px above the base) inside the lot's silhouette? */
function inside(l: Lot, t: number, y: number): boolean {
  if (y < l.cornice) return true;
  if (y >= l.ridge) return false;
  const k = (y - l.cornice) / Math.max(1, l.ridge - l.cornice);
  const c = Math.abs(t - 0.5) * 2;
  switch (l.gable) {
    case 0: {
      // Step gable: three steps.
      const step = Math.min(2, Math.floor(k * 3));
      return c <= 1 - (step + 1) * 0.24;
    }
    case 1:
      // Neck gable: shoulders up to a third, then a narrow neck.
      return k < 0.33 ? c <= 1 - k * 1.2 : c <= 0.42;
    case 2:
      // Bell gable: a curved top.
      return c <= Math.sqrt(Math.max(0, 1 - k * k)) * 0.9;
    case 3:
      // Spout gable: a steep point with a small flat top.
      return c <= Math.max(0.16, 1 - k);
    default:
      // Cornice house: a flat top.
      return k < 0.7 || c < 0.96;
  }
}

/** The colour of a strip point of lot l (t across, x px into the lot, y px above the base), or 0 = clear. */
function shade(l: Lot, t: number, x: number, y: number, w: number, d: number, set: StripLightSet, R: Roles): Color {
  if (!inside(l, t, y)) return 0;
  const dark = set === 'dark';
  const px = 1 / d;
  // The sun from the left: the lit left jamb of the lot, the shaded right one (no outline).
  const lit = x < 1.5 ? 1 : x > w - 1.5 ? -1 : 0;
  const base = dark ? 0 : 2 + l.tone;
  let brick = R.brick[Math.max(0, Math.min(6, base + lit))];
  // The cornice band and the gable's stone edging.
  if (y >= l.cornice - 3 && y < l.cornice) return dark ? R.brick[1] : R.stone[lit < 0 ? 1 : 2];
  // Mortar courses every 4 strip px (a recessed line at 2× / 4×).
  if (d > 1 && (Math.floor(y * d) % (4 * d)) === 0 && !dark) brick = R.brick[Math.max(0, base - 1)];
  // The ground band: a door and a shop window (or a second window).
  if (y < l.band) {
    if (y >= l.band - 3) return dark ? R.brick[0] : R.stone[1];
    const doorW = 0.26;
    const dt = (t - 0.12) / doorW;
    if (dt >= 0 && dt <= 1 && y < l.band * 0.66) {
      const ramp = R.door[l.door];
      return dt < 0.12 ? ramp[2] : dt > 0.88 ? ramp[0] : ramp[1];
    }
    if (l.shop && t > 0.46 && t < 0.92 && y > 6 && y < l.band - 7) {
      if (t < 0.48 || t > 0.9 || y < 7 || y > l.band - 9) return R.white;
      if (dark) return (l.h & 1) === 1 ? R.lamp[0] : R.glass[0];
      return y > l.band - 14 ? R.glass[2] : R.glass[1];
    }
    if (dark && (l.h & 6) === 2 && y > l.band - 6 && y < l.band - 4) return R.red[1];
    return brick;
  }
  // The upper storeys: a grid of windows (bays × storeys of 24 · s, a sill shadow under each).
  const storeyH = 22;
  const sy = (y - l.band) % storeyH;
  const storey = Math.floor((y - l.band) / storeyH);
  if (y < l.cornice - 5) {
    const bay = Math.floor(t * l.bays);
    const bt = t * l.bays - bay;
    if (bt > 0.25 && bt < 0.75 && sy > 4 && sy < 18) {
      if (bt < 0.29 || bt > 0.71 || sy < 5.5 || sy > 16.5 || Math.abs(sy - 11) < px) return R.white;
      if (dark) return hash2(storey, bay, l.h) < 0.3 ? R.lamp[storey & 1] : R.glass[0];
      return sy < 8 ? R.glass[2] : R.glass[1];
    }
    // The sill's shadow (down-right of the window).
    if (!dark && bt > 0.3 && bt < 0.78 && sy >= 3 && sy < 4) return R.brick[Math.max(0, base - 2)];
  }
  return brick;
}

/** A placeholder plan for a def (the section's scale from `info.scale`). */
export function placeholderPlan(def: SectionStripsDef, info: StripSectionInfo): StripPlan {
  const s = info.scale !== undefined && info.scale > 0 ? info.scale : 1;
  const lots = planLots(def, info, s);
  const height = def.height;
  const band = { r0: 0, r1: 0 };
  const bandsOf = (d: StripDensity): number => (d >= 4 ? 4 : d >= 2 ? 2 : 1);
  return {
    height,
    covers(cx) {
      const a = cx * STRIP_CHUNK;
      const b = a + STRIP_CHUNK;
      for (const l of lots) if (l.p1 > a && l.p0 < b) return true;
      return false;
    },
    bands: (_cx, d) => bandsOf(d),
    paint(cx: number, d: StripDensity, set: StripLightSet, b: number, out: PixelBuffer) {
      const R = d === 1 ? LO : HI;
      const W = out.w;
      const H = out.h;
      stripBandRows(b, bandsOf(d), H, band);
      const x0 = cx * STRIP_CHUNK;
      let li = 0;
      for (let c = 0; c < W; c++) {
        const p = x0 + (c + 0.5) / d;
        while (li < lots.length && lots[li].p1 <= p) li++;
        const l = li < lots.length && lots[li].p0 <= p ? lots[li] : null;
        if (!l) continue;
        const w = l.p1 - l.p0;
        const x = p - l.p0;
        const t = x / w;
        for (let r = band.r0; r < band.r1; r++) {
          const y = (H - r - 0.5) / d;
          let col = shade(l, t, x, y, w, d, set, R);
          if (l.markers && y < 6) {
            // A tick every 64 world px (taller every 256): the floor grid check.
            const u = 192 + (p - 192) / s;
            const m = ((u % 64) + 64) % 64;
            if (m < 1 / s / d + 1e-9 && (y < 3 || ((u % 256) + 256) % 256 < 1)) col = R.white;
          }
          if (col !== 0) out.data[r * W + c] = col;
        }
      }
    },
  };
}

let defined = false;

/** Register the placeholder source (once; tests, tools and stand-in sections call it). */
export function definePlaceholderStrips(): void {
  if (defined) return;
  defined = true;
  defineStripSource(PLACEHOLDER_STRIP_SOURCE, { plan: placeholderPlan });
}
