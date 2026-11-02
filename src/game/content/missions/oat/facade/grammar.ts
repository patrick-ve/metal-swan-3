/**
 * The lot sequencer of the façade grammar (docs/design/oat.md §8.6 "The lot sequencer", §8.2 the
 * MIXED scale, §8.10 wear). A façade row (a stretch of street, `StripRowDef`) is planned ONCE: the
 * lot widths in Amsterdam feet, then each lot's gable, wall and window type under the NO-REPEAT
 * rule, then its geometry (the true-scale ground band with its seam, the half-scale storeys, the
 * gable), its details, its protrusions (the shadows of spec §8.4), its wear marks and its features.
 *
 * The no-repeat rule: within any 1,536 px of street no two lots share the triple (gable, wall,
 * window), and no neighbour pair shares two of the three; one deliberate twin pair per street is
 * allowed (`twin`). Fixed lots (`params.slots`) are planted first: the shop slots of STREET-A's
 * decor sprites, the warehouse whose hoist beam the hijsbalk set piece hangs from.
 *
 * Pure and deterministic: every choice is a hash of (row seed, lot index, key) — no Math.random, no
 * clock. The same row def plans the same lots in the painters, the shadows, the tests and the tools.
 */
import { hash2 } from '../../../../art/paint';
import type { StripRowDef } from '../../../../mission/strips/types';
import { GABLE_WALLS, GABLE_WINDOWS, sheetOf, type StreetSheet, type Weights } from './sheets';
import {
  LOT_PX,
  NO_REPEAT_PX,
  type FacadeFeature,
  type GableType,
  type GroundKind,
  type LotPlan,
  type Opening,
  type PaintId,
  type Protrusion,
  type SlotDef,
  type Storey,
  type StreetSheetId,
  type Tint,
  type WallId,
  type WearMark,
  type WindowId,
} from './types';

/** The row params the grammar reads (`StripRowDef.params`; all optional). */
export interface FacadeRowParams {
  /** Façade-to-façade width, metres (default the sheet's). */
  readonly streetM?: number;
  /** Fixed lots (shop slots, the hoist warehouse). */
  readonly slots?: readonly SlotDef[];
  /** Night (oat-d): lamp-lit bake, neon, red tubes, lit windows. */
  readonly night?: boolean;
  /** Wetness 0..1 of the wall feet and stone (spec §8.10: a 0.6 after the night's rain, b 0.1, d 1). */
  readonly wet?: number;
  /** The street lanterns in front of the row (world x; night bake). Default: one every 150 px. */
  readonly lamps?: readonly number[];
  /** A name for the features' lamp groups (default 'row<i>'). */
  readonly name?: string;
}

/** A planned row. */
export interface RowPlan {
  readonly u0: number;
  readonly u1: number;
  readonly sheet: StreetSheet;
  readonly seed: number;
  readonly lots: readonly LotPlan[];
  readonly params: FacadeRowParams;
  readonly night: boolean;
  readonly wet: number;
  readonly streetM: number;
  /** The street lanterns (world x) the night bake lights the row from. */
  readonly lamps: readonly number[];
}

/** FNV-1a of a string (section ids → seeds). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The default seed of a row (spec §8.6 contract: a hash of the section id and u0). */
export function rowSeed(sectionId: string, row: StripRowDef, opposite = false): number {
  const base = row.seed !== undefined ? row.seed >>> 0 : (hashStr(sectionId) ^ Math.imul(Math.round(row.u0) + 7919, 0x9e3779b1)) >>> 0;
  return opposite ? (base ^ 0x5bd1e995) >>> 0 : base;
}

function pick<K extends string | number>(w: Weights<K>, r: number, allow?: (k: K) => boolean): K {
  let total = 0;
  for (const [k, v] of w) if (!allow || allow(k)) total += v;
  if (total <= 0) return w[0][0];
  let x = r * total;
  for (const [k, v] of w) {
    if (allow && !allow(k)) continue;
    x -= v;
    if (x < 0) return k;
  }
  for (let i = w.length - 1; i >= 0; i--) if (!allow || allow(w[i][0])) return w[i][0];
  return w[0][0];
}

/** A value from deciles (p0, p10 … p90, p100) at quantile q. */
function fromDeciles(d: readonly number[], q: number): number {
  const t = Math.max(0, Math.min(0.9999, q)) * (d.length - 1);
  const i = Math.floor(t);
  return d[i] + (d[i + 1] - d[i]) * (t - i);
}

const PAINTS: Weights<PaintId> = [
  ['green', 46],
  ['black', 28],
  ['oxblood', 16],
  ['wood', 10],
];

/** Gables whose top is flat (the shadow model's 'flat' fronts). */
export function isFlatGable(g: GableType): boolean {
  return g === 'lijst' || g === 'plastered' || g === 'infill' || g === 'none';
}

// ------------------------------------------------------------------------------------ widths

interface Cut {
  u0: number;
  w: number;
  ft: number;
  slot: SlotDef | null;
  twin: boolean;
}

function widths(row: StripRowDef, sheet: StreetSheet, seed: number, slots: readonly SlotDef[], allowTwin: boolean): Cut[] {
  const cuts: Cut[] = [];
  const sorted = [...slots].filter((s) => s.u1 > row.u0 && s.u0 < row.u1).sort((a, b) => a.u0 - b.u0);
  let u = row.u0;
  let k = 0;
  let si = 0;
  let twinDone = !allowTwin;
  while (u < row.u1 - 0.5) {
    const slot = sorted[si];
    if (slot && slot.u0 <= u + 0.5) {
      const a = Math.max(u, slot.u0);
      const b = Math.min(row.u1, slot.u1);
      if (b > a) cuts.push({ u0: a, w: b - a, ft: 0, slot, twin: false });
      u = b;
      si++;
      continue;
    }
    const limit = slot ? slot.u0 : row.u1;
    const rem = limit - u;
    const r = (j: number): number => hash2(k, j, seed);
    let w: number;
    let ft = 0;
    if (rem <= 112) {
      w = rem;
    } else {
      const kind = r(1);
      if (kind < sheet.infills) {
        w = 24 + Math.floor(r(2) * 25);
      } else if (kind < sheet.infills + sheet.doubles) {
        w = Math.min(204, Math.max(144, LOT_PX[pick(sheet.feet, r(3))] + LOT_PX[pick(sheet.feet, r(4))]));
      } else {
        ft = pick(sheet.feet, r(5));
        w = LOT_PX[ft];
      }
      // A deliberate twin of the last lot (spec §8.6: once per street).
      const prev = cuts[cuts.length - 1];
      if (!twinDone && prev && !prev.slot && prev.ft > 0 && r(6) < 0.18) {
        w = prev.w;
        ft = prev.ft;
        twinDone = true;
        if (rem - w >= 61 || rem - w === 0) {
          cuts.push({ u0: u, w, ft, slot: null, twin: true });
          u += w;
          k++;
          continue;
        }
      }
      if (rem - w < 61) {
        // Leave room for one standard lot (or fill exactly).
        w = rem - 61 >= 24 ? rem - 61 : rem;
        ft = 0;
      }
    }
    if (w < 24 && cuts.length > 0 && !cuts[cuts.length - 1].slot) {
      // A sliver: widen the last lot.
      cuts[cuts.length - 1].w += w;
      cuts[cuts.length - 1].ft = 0;
      u += w;
      k++;
      continue;
    }
    for (const [f, px] of Object.entries(LOT_PX)) if (px === w) ft = Number(f);
    cuts.push({ u0: u, w, ft, slot: null, twin: false });
    u += w;
    k++;
  }
  return cuts;
}

// ------------------------------------------------------------------------------------ types

interface Typed {
  gable: GableType;
  wall: WallId;
  window: WindowId;
  ground: GroundKind;
}

function sameCount(a: Typed, b: Typed): number {
  return (a.gable === b.gable ? 1 : 0) + (a.wall === b.wall ? 1 : 0) + (a.window === b.window ? 1 : 0);
}

function chooseTypes(cuts: readonly Cut[], sheet: StreetSheet, seed: number, night: boolean): Typed[] {
  const out: Typed[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const c = cuts[i];
    if (c.twin && i > 0) {
      out.push({ ...out[i - 1] });
      continue;
    }
    const narrow = c.w < 50;
    // Variety (spec §8.13: ≥ 5 gable and ≥ 4 window types per 4-screen strip): the types the
    // last 1,536 px already show; a new one earns a small bonus while the strip lacks variety.
    const seenG = new Set<GableType>();
    const seenW = new Set<WindowId>();
    for (let j = i - 1; j >= 0 && cuts[j].u0 + cuts[j].w > c.u0 - NO_REPEAT_PX; j--) {
      seenG.add(out[j].gable);
      seenW.add(out[j].window);
    }
    const needG = seenG.size < 6;
    const needW = seenW.size < 5;
    let best: Typed | null = null;
    let bestScore = Infinity;
    for (let a = 0; a < 48; a++) {
      const r = (j: number): number => hash2(i * 64 + a, j, seed ^ 0x2545f491);
      let gable: GableType;
      if (c.slot?.kind === 'hoist') gable = 'tuit';
      else if (narrow) gable = r(1) < 0.5 ? 'infill' : 'lijst';
      else gable = pick(sheet.gables, r(1));
      const wall = pick(sheet.walls, r(2), (w) => GABLE_WALLS[gable].includes(w));
      let window: WindowId;
      if (c.slot?.kind === 'hoist') window = 'loading';
      else window = pick(sheet.windows, r(3), (w) => GABLE_WINDOWS[gable].includes(w) && (w !== 'loading' || c.w >= 61));
      if (!GABLE_WINDOWS[gable].includes(window)) window = GABLE_WINDOWS[gable][Math.floor(r(4) * GABLE_WINDOWS[gable].length)];
      let ground: GroundKind;
      if (c.slot?.kind === 'slot') ground = 'slot';
      else if (window === 'loading') ground = night ? pick([['bar', 1], ['warehouse', 1]], r(5)) : 'warehouse';
      else ground = pick(sheet.ground, r(5), (g) => g !== 'warehouse' && (c.w >= 56 || g !== 'stoep'));
      const t: Typed = { gable, wall, window, ground };
      // Conflicts: the triple within 1,536 px; two of three with the left neighbour.
      let bad = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (cuts[j].u0 + cuts[j].w <= c.u0 - NO_REPEAT_PX) break;
        const s = sameCount(t, out[j]);
        if (s === 3) bad += 10;
        else if (j === i - 1 && s >= 2) bad += 4;
      }
      const bonus = (needG && !seenG.has(gable) ? 1 : 0) + (needW && !seenW.has(window) ? 1 : 0);
      const score = bad * 4 - bonus;
      if (score < bestScore) {
        best = t;
        bestScore = score;
        if (bad === 0 && (bonus > 0 || (!needG && !needW) || a >= 12)) break;
      }
    }
    out.push(best as Typed);
  }
  return out;
}

// ------------------------------------------------------------------------------------ geometry

const r01 = (seed: number, i: number, k: number): number => hash2(i, k, seed);

/** Gable zone metres per type (spec §8.2: gables and attics 3–5 m = 24–40 px). */
function gableMetres(g: GableType, q: number, warehouse: boolean): number {
  switch (g) {
    case 'trap':
      return 4 + q * 1;
    case 'hals':
    case 'verhoogde-hals':
      return 3.6 + q * 1.2;
    case 'klok':
      return 3.6 + q * 1.1;
    case 'tuit':
      return warehouse ? 4 + q : 3.2 + q * 1.2;
    case 'lijst':
      return 2.2 + q * 1.6;
    case 'plastered':
      return 1.1 + q * 0.7;
    case 'infill':
      return 0.4 + q * 0.3;
    default:
      return 0.5;
  }
}

function windowWidth(win: WindowId, q: number): number {
  switch (win) {
    case 'sash-12':
      return 11;
    case 'sash-2-2':
      return 10 + Math.round(q);
    case 'sash-1-1':
    case 'casement':
      return 11 + Math.round(q);
    case 'kruis':
      return 12;
    case 'modern':
      return 12 + Math.round(q);
    case 'loading':
      return 9;
  }
}

/** The ground band of one lot (true scale, 20 px/m). */
interface GroundPlan {
  bandTop: number;
  seam: LotPlan['seam'];
  door: Opening;
  door2: Opening | null;
  windows: Opening[];
  stoep: LotPlan['stoep'];
  fanlight: number;
}

function planGround(kind: GroundKind, u0: number, w: number, seed: number, i: number): GroundPlan {
  const R = (k: number): number => r01(seed, i, 100 + k);
  const left = R(1) < 0.5;
  const doorW = 20 + (R(2) < 0.5 ? 0 : 2);
  const doorH = 44 + Math.floor(R(3) * 5);
  const fan = 8 + (R(4) < 0.5 ? 0 : 2);
  const edge = Math.max(2, Math.min(5, Math.floor((w - doorW) * 0.08)));
  const doorU = left ? u0 + edge : u0 + w - edge - doorW;
  const restU0 = left ? doorU + doorW + 2 : u0 + 2;
  const restU1 = left ? u0 + w - 2 : doorU - 2;
  switch (kind) {
    case 'stoep': {
      const sh = 26 + Math.floor(R(5) * 5); // 7–9 steps (spec §8.2: 26–32 px)
      const dh = 44 + Math.floor(R(6) * 2);
      // The fanlight stays under the band's top (the seam rule: never cut an opening).
      const fanS = Math.max(6, Math.min(fan, 82 - sh - dh));
      const bandTop = Math.min(84, sh + dh + fanS + 2);
      const windows: Opening[] = [];
      const room = restU1 - restU0;
      const n = Math.max(0, Math.min(3, Math.floor((room + 3) / 25)));
      const ww = n > 0 ? Math.min(22, Math.floor((room - (n - 1) * 3) / n)) : 0;
      const pier = n > 0 ? Math.floor((room - n * ww) / (n + 1)) : 0;
      // Bel-etage windows: 2.0 m tall (40 px), sill at the stoep's landing (ratio 1.8–2).
      for (let k = 0; k < n; k++) windows.push({ u: restU0 + pier + k * (ww + pier), h: sh + 4, w: ww, hh: Math.min(40, bandTop - sh - 8) });
      const flight = Math.max(8, Math.min(14, Math.floor((w - doorW) / 2) - 2));
      const s0 = Math.max(u0 + 1, doorU - flight);
      const s1 = Math.min(u0 + w - 1, doorU + doorW + flight);
      return { bandTop, seam: 'lintel', door: { u: doorU, h: sh, w: doorW, hh: dh }, door2: null, windows, stoep: { h: sh, u0: s0, u1: s1 }, fanlight: fanS };
    }
    case 'flat': {
      const bandTop = 64 + Math.floor(R(5) * 7);
      const two = w >= 74 && R(7) < 0.25;
      const door2: Opening | null = two ? { u: left ? doorU + doorW + 2 : doorU - doorW - 2, h: 3, w: doorW, hh: doorH } : null;
      const a = two && left ? restU0 + doorW + 2 : restU0;
      const b = two && !left ? restU1 - doorW - 2 : restU1;
      const windows: Opening[] = [];
      const room = b - a;
      const n = Math.max(0, Math.min(3, Math.floor((room + 3) / 26)));
      const ww = n > 0 ? Math.min(24, Math.floor((room - (n - 1) * 4) / n)) : 0;
      const pier = n > 0 ? Math.floor((room - n * ww) / (n + 1)) : 0;
      // Tall ground-floor windows: sill 0.9 m (18 px), top 3.0 m (60 px).
      for (let k = 0; k < n; k++) windows.push({ u: a + pier + k * (ww + pier), h: 18, w: ww, hh: Math.min(42, bandTop - 22) });
      return { bandTop, seam: 'string', door: { u: doorU, h: 3, w: doorW, hh: doorH }, door2, windows, stoep: null, fanlight: Math.min(fan, bandTop - doorH - 8) };
    }
    case 'warehouse': {
      const bandTop = 66 + Math.floor(R(5) * 7);
      const bw = Math.min(36, Math.max(24, w - doorW - 14));
      const bu = left ? doorU + doorW + Math.max(3, Math.floor((restU1 - restU0 - bw) / 2)) : u0 + Math.max(3, Math.floor((restU1 - restU0 - bw) / 2));
      return { bandTop, seam: 'beam', door: { u: doorU, h: 2, w: doorW, hh: doorH }, door2: null, windows: [{ u: bu, h: 2, w: bw, hh: 54 }], stoep: null, fanlight: 0 };
    }
    case 'bar':
    case 'shop':
    case 'slot': {
      const bandTop = kind === 'slot' ? 72 : 68 + Math.floor(R(5) * 7);
      // Shop glass from 0.4 to 3.0 m (spec §8.2: 52 px), in one or two lights.
      const glassW = restU1 - restU0;
      const two = glassW > 34;
      const windows: Opening[] = two
        ? [
            { u: restU0, h: 8, w: Math.floor((glassW - 2) / 2), hh: 52 },
            { u: restU0 + Math.floor((glassW - 2) / 2) + 2, h: 8, w: glassW - Math.floor((glassW - 2) / 2) - 2, hh: 52 },
          ]
        : [{ u: restU0, h: 8, w: glassW, hh: 52 }];
      return { bandTop, seam: 'beam', door: { u: doorU, h: 2, w: doorW, hh: Math.max(doorH, 46) }, door2: null, windows, stoep: null, fanlight: 0 };
    }
    case 'frames': {
      const bandTop = 66 + Math.floor(R(5) * 7);
      // Window frames (architecture only): glass doors in plain frames, curtains closed.
      const fw = 18 + (R(8) < 0.5 ? 0 : 2);
      const room = restU1 - restU0;
      const n = Math.max(1, Math.min(3, Math.floor((room + 3) / (fw + 3))));
      const pier = Math.floor((room - n * fw) / (n + 1));
      const windows: Opening[] = [];
      for (let k = 0; k < n; k++) windows.push({ u: restU0 + pier + k * (fw + pier), h: 3, w: fw, hh: 46 });
      return { bandTop, seam: 'beam', door: { u: doorU, h: 3, w: doorW, hh: doorH }, door2: null, windows, stoep: null, fanlight: Math.min(fan, bandTop - doorH - 9) };
    }
  }
}

/** Plan the geometry, details, protrusions, wear and features of every lot of a row. */
function geometry(cuts: readonly Cut[], types: readonly Typed[], sheet: StreetSheet, seed: number, p: FacadeRowParams, rowName: string): LotPlan[] {
  const lots: LotPlan[] = [];
  const night = p.night === true;
  let tallRun = 6;
  let wordAt = Math.floor(r01(seed, 0, 900) * sheet.shopWords.length);
  for (let i = 0; i < cuts.length; i++) {
    const c = cuts[i];
    const t = types[i];
    const prev = lots[i - 1];
    // Twins: the same geometry seed as the left lot.
    const gi = c.twin && prev ? prev.index : i;
    const R = (k: number): number => r01(seed, gi, k);
    const L = (k: number): number => r01(seed, i, 500 + k);

    // --- the ground band (true scale) and its seam
    const g = planGround(t.ground, c.u0, c.w, seed, gi);
    if (c.twin && prev) {
      // A twin copies its neighbour's ground layout shifted by the lot width.
      const dx = c.u0 - prev.u0;
      g.bandTop = prev.bandTop;
      g.door = { ...prev.door, u: prev.door.u + dx };
      g.door2 = prev.door2 ? { ...prev.door2, u: prev.door2.u + dx } : null;
      g.windows = prev.groundWindows.map((o) => ({ ...o, u: o.u + dx }));
      g.stoep = prev.stoep ? { h: prev.stoep.h, u0: prev.stoep.u0 + dx, u1: prev.stoep.u1 + dx } : null;
    }
    let bandTop = g.bandTop;
    if (prev) bandTop = Math.max(prev.bandTop - 20, Math.min(prev.bandTop + 20, bandTop));
    bandTop = Math.max(64, Math.min(84, bandTop));
    const bandTopM = bandTop / 20;

    // --- heights: the ridge from the sheet's deciles (≤ 1 lot in 6 above 18 m)
    let ridgeM = fromDeciles(sheet.ridge, R(10));
    const allowTall = tallRun >= 6;
    if (ridgeM > 18 && !allowTall) ridgeM = 14 + R(11) * 3.5;
    if (t.gable === 'infill') ridgeM = Math.min(ridgeM, 12 + R(12) * 4);
    const warehouse = t.window === 'loading';
    const gableM = gableMetres(t.gable, R(13), warehouse);
    const storeysPx = Math.max(44, Math.round((ridgeM - bandTopM - gableM) * 8));
    let n = Math.max(2, Math.min(6, Math.round(storeysPx / 24)));
    while (n > 2 && storeysPx / n < 22) n--;
    while (n < 6 && storeysPx / n > 26) n++;
    const per = Math.max(22, Math.min(26, Math.floor(storeysPx / n)));
    let extra = Math.max(0, Math.min(n, storeysPx - per * n));
    const heights: number[] = [];
    for (let k = 0; k < n; k++) {
      // The first floor is the tallest; the top one a little lower (spec §8.2: 22–26 px).
      let hh = per + (extra > 0 && per < 26 ? 1 : 0);
      if (extra > 0 && per < 26) extra--;
      if (k === n - 1 && n > 2 && hh > 22) hh--;
      heights.push(hh);
    }
    let eaves = bandTop;
    const bays = c.w <= 44 ? 1 : c.w <= 64 ? 2 : c.w <= 96 ? 3 : c.w <= 130 ? 4 : Math.min(7, Math.round(c.w / 30));
    let ww = windowWidth(t.window, R(14));
    const ratio = 1.65 + R(15) * 0.22;
    const storeys: Storey[] = [];
    for (let k = 0; k < n; k++) {
      const sh = heights[k];
      const hhMax = sh - 6;
      let wk = ww;
      let hk = Math.min(hhMax - (k === n - 1 ? 1 : 0), Math.round(wk * ratio));
      if (hk / wk < 1.6) wk = Math.floor(hk / 1.6);
      if (bays * wk + (bays + 1) * 3 > c.w) wk = Math.max(6, Math.floor((c.w - (bays + 1) * 3) / bays));
      hk = Math.min(hk, Math.round(wk * 1.9));
      if (hk / wk < 1.6) hk = Math.ceil(wk * 1.6);
      if (hk > hhMax) {
        hk = hhMax;
        wk = Math.max(6, Math.floor(hk / 1.6));
      }
      const free = c.w - bays * wk;
      const pier = free / (bays + 1);
      const windows: Opening[] = [];
      for (let b = 0; b < bays; b++) {
        let wu = c.u0 + Math.round(pier + b * (wk + pier));
        let wwB = wk;
        let hhB = hk;
        let hB = eaves + 3;
        if (warehouse && bays >= 2 && (b === Math.floor(bays / 2) || (bays === 2 && b === 0))) {
          // The stacked loading doors of the middle bay (spec §8.6): floor to lintel.
          wwB = Math.min(14, wk + 3);
          wu -= Math.floor((wwB - wk) / 2);
          hB = eaves + 2;
          hhB = sh - 4;
        }
        windows.push({ u: wu, h: hB, w: wwB, hh: hhB });
      }
      storeys.push({ h: eaves, hh: sh, windows });
      eaves += sh;
    }
    ww = storeys[0].windows[0]?.w ?? ww;

    // --- the gable zone
    const gableH = Math.max(3, Math.round(gableM * 8));
    // At most 1 lot in 6 above 18 m (spec §8.2): drop a storey when the rounding made it taller.
    const metres = (top: number): number => bandTopM + (top - bandTop) / 8;
    while (!allowTall && storeys.length > 2 && metres(eaves + gableH) > 18) eaves -= (storeys.pop() as Storey).hh;
    const ridge = eaves + gableH;
    tallRun = metres(ridge) > 18 ? 0 : tallRun + 1;
    const neckW = Math.max(18, Math.min(c.w - 16, Math.round(c.w * (0.38 + R(16) * 0.08))));
    const topW = Math.max(10, Math.round(c.w * (0.2 + R(17) * 0.06)));
    const steps: { w: number; hh: number }[] = [];
    if (t.gable === 'trap') {
      const ns = c.w >= 80 ? 4 : 3;
      const side = (c.w - topW) / 2;
      const capH = 6;
      const avail = gableH - capH;
      // Few, large, unequal steps (spec §8.6).
      const wts: number[] = [];
      const hts: number[] = [];
      for (let k = 0; k < ns; k++) {
        wts.push(0.8 + R(20 + k) * 0.5);
        hts.push(0.8 + R(30 + k) * 0.5);
      }
      const sw = wts.reduce((a, b) => a + b, 0);
      const shh = hts.reduce((a, b) => a + b, 0);
      let accW = 0;
      let accH = 0;
      for (let k = 0; k < ns; k++) {
        const wv = k === ns - 1 ? Math.round(side) - accW : Math.round((wts[k] / sw) * side);
        const hv = k === ns - 1 ? avail - accH : Math.round((hts[k] / shh) * avail);
        steps.push({ w: wv, hh: hv });
        accW += wv;
        accH += hv;
      }
    }
    const attic = t.gable === 'lijst' && R(18) < 0.45;
    const roofH = t.gable === 'lijst' ? Math.max(6, gableH - 8 - (attic ? 9 : 0)) : t.gable === 'plastered' ? Math.max(0, gableH - 7) : 0;
    const gableWindows: Opening[] = [];
    const mid = c.u0 + c.w / 2;
    if (t.gable === 'trap' || t.gable === 'hals' || t.gable === 'verhoogde-hals' || t.gable === 'klok' || t.gable === 'tuit') {
      const lw = warehouse ? Math.min(14, ww + 3) : Math.min(11, Math.max(8, (t.gable === 'trap' ? topW + 8 : neckW) - 8));
      const lh = warehouse ? Math.min(gableH - 10, 20) : Math.min(gableH - 12, Math.round(lw * 1.7));
      if (lh >= 8) gableWindows.push({ u: Math.round(mid - lw / 2), h: eaves + 3, w: lw, hh: lh });
      if (gableH >= 34 && !warehouse) gableWindows.push({ u: Math.round(mid - 3), h: eaves + 5 + lh + 3, w: 6, hh: Math.min(9, gableH - lh - 16) });
    } else if (attic) {
      gableWindows.push({ u: Math.round(mid - 4), h: eaves + 8, w: 8, hh: 6 });
    }
    const hoistP = sheet.hoists * (t.gable === 'lijst' ? 0.35 : t.gable === 'plastered' || t.gable === 'infill' ? 0 : 1);
    let hoist: LotPlan['hoist'] = null;
    if (c.slot?.kind === 'hoist' || warehouse || R(40) < hoistP) {
      const hu = c.slot?.kind === 'hoist' && c.slot.x !== undefined ? c.slot.x : Math.round(mid);
      const hh = t.gable === 'lijst' ? eaves + 3 : t.gable === 'tuit' ? ridge - 7 : t.gable === 'trap' ? ridge - 9 : ridge - 9;
      hoist = { u: hu, h: hh, roof: R(41) < 0.4 };
    }

    // --- paints, frames, shutters
    const doorPaint = pick(PAINTS, R(50));
    const plasterOrPainted = t.wall.startsWith('plaster') || t.wall.startsWith('painted');
    let sashPaint: PaintId = t.window === 'sash-12' || t.window === 'kruis' ? 'white' : R(51) < 0.55 ? 'white' : 'green';
    if (t.window === 'modern') sashPaint = 'black';
    const frame: LotPlan['frame'] = t.window === 'kruis' || (R(52) < 0.25 && !plasterOrPainted) ? 'sandstone' : 'white';
    const shutters: PaintId | null = t.window === 'kruis' || warehouse ? (R(53) < 0.5 ? 'red' : 'green') : null;

    // --- details
    const anchorPts: [number, number][] = [];
    if (t.gable !== 'plastered' && t.gable !== 'infill' && !t.wall.startsWith('plaster')) {
      for (let k = 0; k < storeys.length; k++) {
        const s = storeys[k];
        const yA = s.h + s.hh - 2;
        const ws = s.windows;
        if (ws.length === 0) continue;
        const xs: number[] = [c.u0 + 3, c.u0 + c.w - 3];
        for (let b = 0; b + 1 < ws.length; b++) xs.push(Math.round((ws[b].u + ws[b].w + ws[b + 1].u) / 2));
        for (const x of xs) if (r01(seed, i, 600 + k * 8 + xs.indexOf(x)) < 0.8) anchorPts.push([x, yA]);
      }
    }
    const downpipe = R(54) < 0.4 ? (R(55) < 0.5 ? c.u0 + 1 : c.u0 + c.w - 2) : null;
    const shopLike = t.ground === 'shop' || t.ground === 'bar';
    const awning = t.ground === 'shop' && R(56) < sheet.awnings ? { kind: (R(57) < 0.6 ? 'stripe' : 'plain') as 'stripe' | 'plain', paint: Math.floor(R(58) * 5) } : null;
    const sign = shopLike && R(59) < sheet.signs;
    let shopWord = '';
    if (shopLike) {
      shopWord = sheet.shopWords[wordAt % sheet.shopWords.length];
      wordAt += 1 + Math.floor(L(1) * 2);
    }
    const flowerBox = R(60) < sheet.flowers;
    const gableStone = R(61) < sheet.gableStones && t.ground !== 'slot';
    const number = 1 + Math.floor(L(2) * 198);
    const tilt = R(62) < sheet.tilt ? (R(63) < 0.5 ? -1 : 1) * (1 + Math.floor(R(64) * 2)) : 0;
    const anchors: LotPlan['anchors'] = R(65) < 0.55 ? 'rosette' : 'cross';

    // --- protrusions (spec §8.4: they cast on their own wall)
    const prot: Protrusion[] = [];
    if (t.gable === 'lijst') prot.push({ kind: 'cornice', u0: c.u0 - 1, u1: c.u0 + c.w + 1, y: eaves, depthM: 0.45 + R(70) * 0.15 });
    if (t.gable === 'plastered') prot.push({ kind: 'cornice', u0: c.u0 - 1, u1: c.u0 + c.w + 1, y: eaves, depthM: 0.35 });
    if (t.gable === 'infill') prot.push({ kind: 'coping', u0: c.u0, u1: c.u0 + c.w, y: eaves, depthM: 0.1 });
    prot.push({ kind: g.seam === 'beam' ? 'beam' : 'string', u0: c.u0, u1: c.u0 + c.w, y: bandTop - 2, depthM: g.seam === 'beam' ? 0.18 : 0.06 });
    for (const s of storeys) for (const o of s.windows) prot.push({ kind: 'sill', u0: o.u - 1, u1: o.u + o.w + 1, y: o.h - 1, depthM: 0.07 });
    if (hoist) prot.push({ kind: 'hoist', u0: hoist.u - 1, u1: hoist.u + 1, y: hoist.h - 1, depthM: 1.0 });
    if (awning) for (const o of g.windows) prot.push({ kind: 'awning', u0: o.u - 1, u1: o.u + o.w + 1, y: 50, depthM: 1.0 });
    if (sign) prot.push({ kind: 'sign', u0: (g.door.u > c.u0 + c.w / 2 ? c.u0 + 2 : c.u0 + c.w - 4), u1: (g.door.u > c.u0 + c.w / 2 ? c.u0 + 4 : c.u0 + c.w - 2), y: 60, depthM: 0.8 });
    if (flowerBox && storeys[0]) for (const o of storeys[0].windows) prot.push({ kind: 'flowerbox', u0: o.u - 1, u1: o.u + o.w + 1, y: o.h - 3, depthM: 0.25 });

    // --- wear (spec §8.10: ≥ 6 marks per lot; fine detail at 4×, clusters at 2×, tone at 1×)
    const wear: WearMark[] = [];
    const ws = (k: number): number => (seed ^ Math.imul(i + 1, 0x27d4eb2d) ^ Math.imul(k + 1, 0x165667b1)) >>> 0;
    wear.push({ kind: 'damp', u: c.u0, h: 0, w: c.w, hh: 5 + Math.floor(R(80) * 6), seed: ws(1) });
    wear.push({ kind: 'salt', u: c.u0 + Math.floor(L(3) * (c.w - 12)), h: 1, w: 8 + Math.floor(L(4) * 8), hh: 4 + Math.floor(L(5) * 4), seed: ws(2) });
    for (const [x, y] of anchorPts) wear.push({ kind: 'rust', u: x, h: y - 1, w: 1, hh: 4 + Math.floor(r01(seed, i, 700 + x) * 6), seed: ws(3 + x) });
    wear.push({ kind: 'soot', u: c.u0, h: eaves - 7, w: c.w, hh: 7, seed: ws(4) });
    if (L(6) < 0.65 && storeys.length > 1) {
      const s = storeys[1 + Math.floor(L(7) * (storeys.length - 1))];
      wear.push({ kind: 'patch', u: c.u0 + 2 + Math.floor(L(8) * Math.max(1, c.w - 14)), h: s.h + 1, w: 8 + Math.floor(L(9) * 5), hh: 5 + Math.floor(L(10) * 6), seed: ws(5) });
    }
    for (const s of storeys)
      for (const o of s.windows) if (r01(seed, i, 720 + o.u + s.h) < 0.35) wear.push({ kind: 'streak', u: o.u + 1 + Math.floor(r01(seed, i, 730 + o.u) * Math.max(1, o.w - 2)), h: o.h - 2 - 8, w: 1, hh: 8, seed: ws(6 + o.u + s.h) });
    wear.push({ kind: 'peel', u: g.door.u + 2, h: g.door.h + 6, w: g.door.w - 4, hh: g.door.hh - 12, seed: ws(7) });
    if (downpipe !== null) {
      const ns = 1 + Math.floor(L(11) * 3);
      for (let k = 0; k < ns; k++) wear.push({ kind: 'sticker', u: downpipe, h: 20 + Math.floor(r01(seed, i, 740 + k) * 14), w: 1, hh: 2, seed: ws(8 + k) });
    }
    if (t.gable === 'lijst' || t.gable === 'plastered' || storeys[0]) wear.push({ kind: 'spikes', u: c.u0 + 1, h: t.gable === 'lijst' || t.gable === 'plastered' ? eaves + 6 : storeys[0].h + 2, w: c.w - 2, hh: 1, seed: ws(9) });
    if (night || L(12) < 0.25) wear.push({ kind: 'tag', u: c.u0 + 2 + Math.floor(L(13) * Math.max(1, c.w - 16)), h: 3 + Math.floor(L(14) * 6), w: 10 + Math.floor(L(15) * 6), hh: 4, seed: ws(10) });
    if (t.wall.startsWith('plaster') || L(16) < 0.3) wear.push({ kind: 'crack', u: c.u0 + 4 + Math.floor(L(17) * Math.max(1, c.w - 8)), h: bandTop + 2, w: 6, hh: 14 + Math.floor(L(18) * 10), seed: ws(11) });

    // At least 6 marks per lot (spec §8.10): grime streaks at the foot fill up.
    for (let k = 0; wear.length < 6; k++) wear.push({ kind: 'streak', u: c.u0 + 2 + Math.floor(L(30 + k) * Math.max(1, c.w - 4)), h: 2, w: 1, hh: 6 + Math.floor(L(40 + k) * 8), seed: ws(20 + k) });

    // --- night: lit windows, the neon word, the features
    const lit: number[] = [];
    let neon: LotPlan['neon'] = null;
    const features: FacadeFeature[] = [];
    if (hoist) features.push({ kind: 'hoist', u: hoist.u, h: hoist.h, w: 0, hh: 0, lot: i });
    if (c.slot?.kind === 'slot') features.push({ kind: 'slot', u: c.u0, h: 0, w: c.w, hh: bandTop, text: c.slot.id, lot: i });
    features.push({ kind: 'door', u: g.door.u, h: g.door.h, w: g.door.w, hh: g.door.hh, lot: i });
    if (night) {
      for (let k = 0; k < storeys.length; k++) {
        let m = 0;
        storeys[k].windows.forEach((o, b) => {
          if (r01(seed, i, 800 + k * 8 + b) < sheet.litWindows) {
            m |= 1 << b;
            features.push({ kind: 'lit-window', u: o.u, h: o.h, w: o.w, hh: o.hh, tint: 'warm', lot: i });
          }
        });
        lit.push(m);
      }
      if (t.ground === 'bar') {
        const tints: Tint[] = ['pink', 'cyan', 'red', 'warm'];
        neon = { word: shopWord || 'BAR', tint: tints[Math.floor(L(20) * tints.length)] };
        const tw = neonWidth(neon.word);
        features.push({ kind: 'neon', u: Math.round(c.u0 + c.w / 2 - tw / 2), h: bandTop - 9, w: tw, hh: 6, text: neon.word, tint: neon.tint, group: `neon-${rowName}-${i}`, lot: i });
        for (const o of g.windows) features.push({ kind: 'bar-window', u: o.u, h: o.h, w: o.w, hh: o.hh, tint: 'warm', group: `bar-${rowName}-${i}`, lot: i });
      }
      if (t.ground === 'frames') for (const o of g.windows) features.push({ kind: 'red-tube', u: o.u, h: o.h + o.hh + 1, w: o.w, hh: 1, text: String(10 + ((number + g.windows.indexOf(o)) % 89)), tint: 'red', group: `red-${rowName}-${i}`, lot: i });
      if (L(21) < 0.3) {
        const wu = downpipe === c.u0 + 1 ? c.u0 + c.w - 4 : c.u0 + 3;
        features.push({ kind: 'wall-lamp', u: wu, h: bandTop - 6, w: 3, hh: 5, tint: 'warm', lot: i });
      }
    }

    lots.push({
      index: i,
      u0: c.u0,
      w: c.w,
      ft: c.ft,
      sheet: sheet.id as StreetSheetId,
      seed: (seed ^ Math.imul(gi + 1, 0x85ebca6b)) >>> 0,
      gable: t.gable,
      wall: t.wall,
      window: t.window,
      twin: c.twin,
      bandTop,
      seam: g.seam,
      eaves,
      ridge,
      storeys,
      bays,
      ground: t.ground,
      door: g.door,
      door2: g.door2,
      groundWindows: g.windows,
      stoep: g.stoep,
      fanlight: g.fanlight,
      doorPaint,
      sashPaint,
      frame,
      shutters,
      neckW,
      topW,
      steps,
      attic,
      roofH,
      gableWindows,
      hoist,
      anchors,
      anchorPts,
      downpipe,
      flowerBox,
      awning,
      sign,
      shopWord,
      number,
      gableStone,
      tilt,
      protrusions: prot,
      wear,
      features,
      lit,
      neon,
    });
  }
  return lots;
}

/** Width (world px) of a neon word in the strip lettering (4 px per glyph incl. the gap). */
export function neonWidth(word: string): number {
  return Math.max(0, word.length * 4 - 1);
}

/** Plan one row (our row, or with `opposite` the unseen row across the street: another seed, no slots). */
export function planRow(sectionId: string, row: StripRowDef, index: number, opposite = false): RowPlan {
  const sheet = sheetOf(row.sheet);
  const p = (row.params ?? {}) as FacadeRowParams;
  const seed = rowSeed(sectionId, row, opposite);
  const night = !opposite && p.night === true;
  const slots = opposite ? [] : (p.slots ?? []);
  const cuts = widths(row, sheet, seed, slots, !opposite);
  const types = chooseTypes(cuts, sheet, seed, night);
  const name = p.name ?? `row${index}`;
  const lots = geometry(cuts, types, sheet, seed, { ...p, night }, name);
  const lamps: number[] = [];
  if (p.lamps) lamps.push(...p.lamps);
  else if (night) for (let x = row.u0 + 70; x < row.u1; x += 150) lamps.push(x);
  return {
    u0: row.u0,
    u1: row.u1,
    sheet,
    seed,
    lots,
    params: p,
    night,
    wet: p.wet ?? (night ? 1 : 0.3),
    streetM: p.streetM ?? sheet.streetM,
    lamps,
  };
}
