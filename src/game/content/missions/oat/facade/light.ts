/**
 * The light of the façade strips (docs/design/oat.md §8.3 the sun per section, §8.4 the opposite
 * row's shade and the casters on the wall, §8.9 the baked night light). Owner: GRAMMAR. It runs
 * after the part drawers (parts.ts) over one band of a chunk and resolves the colours:
 *
 * - DAY: every LIT art px asks LIGHT-WATER's shade model (`sectionShade(id).facade(u, m, d)`: the
 *   opposite row's jagged line and the shadows of trees, lanterns and posts climbing the wall) and
 *   turns SHADE where it is shaded (an ordered dither in world-anchored art px for the soft edge at
 *   2× / 4×, a hard edge at 1×). The tables (palette.ts `dayTables`) warm the lit tones toward the
 *   section's sun colour and cool and darken the shade (≤ about 1.5 tones: spec §8.4).
 * - NIGHT (oat-d): every px gets a light level 0 … 5 and a tint from the baked lights of the row
 *   (the street lanterns in front, wall lamps, lit windows, the neon words, the red tubes, the bar
 *   windows) — brick near a lantern shows in its own warm lit ramp, plaster near a sign takes the
 *   neon's hue. The 'dark' set (03:00) keeps only the lanterns, the wall lamps and a third of the
 *   lit windows. Emitters (EMIT) keep their colours.
 *
 * Lights come from the PLAN (`nightLights`), never from what one chunk painted, so a light spills
 * across chunk borders without a seam. No per-px allocation: one level buffer reused.
 */
import type { PixelBuffer } from '../../../../../engine/pixel';
import { bayer, hash2 } from '../../../../art/paint';
import { facadeMetres, type StreetShade } from '../light/shadow';
import type { RowPlan } from './grammar';
import { dayTables, M_DEEP, M_EMIT, M_LIT, M_NIGHT, M_SHADE, NIGHT_LEVELS, nightTables } from './palette';
import type { Art } from './raster';
import type { LotPlan, Tint } from './types';
import type { Color } from '../../../../../engine/color';

/** A night light in WORLD px (u along the street, h over the façade base). */
export interface WorldLight {
  readonly u: number;
  readonly h: number;
  /** Radius (world px) and strength 0 … 1. */
  readonly r: number;
  readonly k: number;
  readonly tint: Tint;
  /** True for the lights that go out at 03:00 (neon, red tubes, bar windows, most lit windows). */
  readonly neon: boolean;
}

/** The lantern height on the façade plane (a 4.3 m post in front: its pool centres about 3.6 m up). */
const LANTERN_H = 72;

/** The baked lights of a night row (spec §8.9), from the plan only. */
export function nightLights(row: RowPlan): WorldLight[] {
  const out: WorldLight[] = [];
  if (!row.night) return out;
  for (const u of row.lamps) out.push({ u, h: LANTERN_H, r: 118, k: 1, tint: 'warm', neon: false });
  for (const l of row.lots) {
    for (let k = 0; k < l.storeys.length; k++) {
      const s = l.storeys[k];
      for (let b = 0; b < s.windows.length; b++) {
        if (((l.lit[k] ?? 0) & (1 << b)) === 0) continue;
        const o = s.windows[b];
        const stays = hash2(k, b, l.seed) < 0.35;
        out.push({ u: o.u + o.w / 2, h: o.h + o.hh / 2, r: o.w * 1.4, k: 0.5, tint: 'warm', neon: !stays });
      }
    }
    for (const f of l.features) {
      switch (f.kind) {
        case 'neon':
          out.push({ u: f.u + f.w / 2, h: f.h, r: 46, k: 0.9, tint: f.tint ?? 'pink', neon: true });
          break;
        case 'red-tube':
          out.push({ u: f.u + f.w / 2, h: f.h, r: f.w * 1.2 + 8, k: 0.6, tint: 'red', neon: true });
          break;
        case 'bar-window':
          out.push({ u: f.u + f.w / 2, h: f.h + f.hh / 2, r: f.w * 0.9 + 8, k: 0.75, tint: 'warm', neon: true });
          break;
        case 'wall-lamp':
          out.push({ u: f.u, h: f.h, r: 42, k: 0.85, tint: 'warm', neon: false });
          break;
      }
    }
  }
  return out;
}

const TINT_IX: Readonly<Record<Tint, number>> = { warm: 1, red: 2, pink: 3, cyan: 4 };

let lv = new Float32Array(0);
let lk = new Float32Array(0);
let lt = new Uint8Array(0);

/** What the resolve of one band needs. */
export interface ResolveCtx {
  readonly lots: readonly LotPlan[];
  /** Day: the section's shade model and sun colour; null at night. */
  readonly shade: StreetShade | null;
  readonly sun: Color;
  readonly night: boolean;
  readonly dark: boolean;
  /** The dark set's world range: only the lights inside it go out (or dim). */
  readonly darkU0: number;
  readonly darkU1: number;
  readonly lights: readonly WorldLight[];
  readonly lut: Uint32Array;
}

/** Turn the band's mask into light and write the colours into `out` (the chunk's buffer). */
export function resolveBand(a: Art, c: ResolveCtx, out: PixelBuffer): void {
  if (c.night) resolveNight(a, c, out);
  else resolveDay(a, c, out);
}

function resolveDay(a: Art, c: ResolveCtx, out: PixelBuffer): void {
  const T = dayTables(c.sun);
  const lut = c.lut;
  const W = a.W;
  const d = a.d;
  const shade = c.shade && c.shade.geom ? c.shade : null;
  for (let x = 0; x < W; x++) {
    const li = a.colLot[x];
    const band = li >= 0 ? c.lots[li].bandTop : 72;
    const u = a.uOf(x);
    const gx = a.gx0 + x;
    let cache = -1;
    let cy = -999;
    for (let y = a.yLo; y < a.yHi; y++) {
      const o = a.at(x, y);
      const i = a.idx[o];
      if (i === 0) continue;
      let m = a.mask[o];
      if (m === M_LIT && shade) {
        // The shade field is smooth: one query per 2 art rows at 4×.
        if (d < 4 || y - cy >= 2) {
          cache = shade.facade(u, facadeMetres(a.hOf(y), band), d);
          cy = y;
        }
        if (cache > 0 && (d === 1 ? cache >= 0.5 : cache > bayer(gx, y))) m = M_SHADE;
      }
      out.data[o] = lut[T[m][i]];
    }
  }
}

function resolveNight(a: Art, c: ResolveCtx, out: PixelBuffer): void {
  const T = nightTables();
  const lut = c.lut;
  const W = a.W;
  const rows = a.yHi - a.yLo;
  if (rows <= 0) return;
  const n = W * rows;
  if (lv.length < n) {
    lv = new Float32Array(n);
    lk = new Float32Array(n);
    lt = new Uint8Array(n);
  }
  // Ambient: the navy night, a little lift near the wet, lamp-lit street.
  const sd = a.s * a.d;
  for (let r = 0; r < rows; r++) {
    const y = a.yLo + r;
    const amb = 0.1 + 0.22 * Math.exp(-y / (34 * sd));
    lv.fill(amb, r * W, (r + 1) * W);
    lk.fill(0, r * W, (r + 1) * W);
    lt.fill(0, r * W, (r + 1) * W);
  }
  for (const L of c.lights) {
    const off = c.dark && L.u >= c.darkU0 && L.u < c.darkU1;
    if (off && L.neon) continue;
    const lx = a.X(L.u);
    const ly = a.Y(L.h);
    const rr = Math.max(2, L.r * sd);
    const x0 = Math.max(0, Math.floor(lx - rr));
    const x1 = Math.min(W, Math.ceil(lx + rr));
    const y0 = Math.max(a.yLo, Math.floor(ly - rr));
    const y1 = Math.min(a.yHi, Math.ceil(ly + rr));
    if (x0 >= x1 || y0 >= y1) continue;
    const k = off && L.tint === 'warm' && !L.neon ? L.k * 0.85 : L.k;
    const inv = 1 / rr;
    for (let y = y0; y < y1; y++) {
      const dy = (y - ly) * inv;
      const base = (y - a.yLo) * W;
      for (let x = x0; x < x1; x++) {
        const dx = (x - lx) * inv;
        const q = 1 - Math.sqrt(dx * dx + dy * dy);
        if (q <= 0) continue;
        const I = k * q * Math.sqrt(q);
        const p = base + x;
        lv[p] = 1 - (1 - lv[p]) * (1 - I);
        if (I > lk[p]) {
          lk[p] = I;
          lt[p] = TINT_IX[L.tint];
        }
      }
    }
  }
  for (let y = a.yLo; y < a.yHi; y++) {
    const base = (y - a.yLo) * W;
    for (let x = 0; x < W; x++) {
      const o = a.at(x, y);
      const i = a.idx[o];
      if (i === 0) continue;
      const m = a.mask[o];
      if (m === M_EMIT) {
        out.data[o] = lut[i];
        continue;
      }
      const p = base + x;
      const dith = a.d === 1 ? 0 : (bayer(a.gx0 + x, y) - 0.5) * 0.9;
      let level = Math.floor(lv[p] * (NIGHT_LEVELS - 0.01) + dith);
      if (m === M_DEEP || m === M_SHADE) level--;
      level = level < 0 ? 0 : level >= NIGHT_LEVELS ? NIGHT_LEVELS - 1 : level;
      const tint = lk[p] > 0.06 ? lt[p] : 0;
      out.data[o] = lut[T[M_NIGHT + tint * 8 + level][i]];
    }
  }
}
