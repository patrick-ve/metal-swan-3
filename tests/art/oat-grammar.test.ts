/**
 * The façade grammar of mission oat (docs/design/oat.md §8.6, §8.10, §8.11, §8.13; docs/api/oat.md
 * "GRAMMAR"): the no-repeat rule (no triple within 1,536 px, no neighbour pair sharing two of three,
 * one twin pair per street at most), the variety per street sheet (≥ 5 gable and ≥ 4 window types in
 * every 4-screen strip), the strip source (registered, covers, bands), the palette of the painted
 * strips (PAL at 1×, PAL_HD ∪ PAL_HD_OAT at 2× / 4×, day, night and the 03:00 dark set), no ink
 * outline runs along the silhouettes and the lot borders, determinism (same plan, same pixels), the
 * lots LIGHT-WATER reads (`facadeLots`, our row and the opposite row) and wear ≥ 6 marks per lot.
 */
import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import { inPalette } from '../../src/engine/palette';
import { inOatPalette, PAL_HD } from '../../src/engine/palette-hd';
import '../../src/game/content/missions/oat/light/index';
import {
  BUILT_SHEETS,
  facadeLots,
  grammarPlan,
  OAT_STRIPS,
  planRow,
  planSection,
  type LotPlan,
} from '../../src/game/content/missions/oat/facade/index';
import { OAT_STRIP_SOURCE } from '../../src/game/content/missions/oat/ids';
import { getStripSource } from '../../src/game/mission/strips/source';
import { stripXOfU } from '../../src/game/mission/strips/space';
import { STRIP_CHUNK, type StripDensity, type StripLightSet, type StripPlan } from '../../src/game/mission/strips/types';

const S = 0.862;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function noRepeatProblems(lots: readonly LotPlan[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lots.length; i++) {
    const a = lots[i];
    for (let j = i + 1; j < lots.length; j++) {
      const b = lots[j];
      if (b.u0 - (a.u0 + a.w) >= 1536) break;
      const same = (a.gable === b.gable ? 1 : 0) + (a.wall === b.wall ? 1 : 0) + (a.window === b.window ? 1 : 0);
      const twin = j === i + 1 && b.twin;
      if (!twin && same === 3) out.push(`triple ${i}/${j} ${a.gable} ${a.wall} ${a.window}`);
      if (!twin && j === i + 1 && same >= 2) out.push(`pair ${i}/${j}`);
    }
  }
  return out;
}

function paintChunk(plan: StripPlan, cx: number, d: StripDensity, set: StripLightSet = 'lit'): PixelBuffer {
  const buf = new PixelBuffer(STRIP_CHUNK * d, plan.height * d);
  const n = plan.bands(cx, d);
  for (let b = 0; b < n; b++) plan.paint(cx, d, set, b, buf);
  return buf;
}

const planA = (): StripPlan => grammarPlan(OAT_STRIPS['oat-a'], { id: 'oat-a', width: 4608, seed: 1, scale: S });
const planD = (): StripPlan => grammarPlan(OAT_STRIPS['oat-d'], { id: 'oat-d', width: 4352, seed: 1, scale: S });
const chunkOf = (u: number): number => Math.floor(stripXOfU(u, S) / STRIP_CHUNK);

describe('oat façade grammar: the lot sequencer', () => {
  it('never repeats a (gable, wall, window) triple within 1,536 px; neighbours share at most one (built sheets × seeds)', () => {
    for (const sheet of BUILT_SHEETS)
      for (const seed of SEEDS) {
        const r = planRow('test', { u0: 0, u1: 6144, sheet, seed }, 0);
        expect(noRepeatProblems(r.lots), `${sheet} seed ${seed}`).toEqual([]);
      }
  });

  it('allows at most one deliberate twin pair per street', () => {
    for (const sheet of BUILT_SHEETS)
      for (const seed of SEEDS) {
        const r = planRow('test', { u0: 0, u1: 6144, sheet, seed }, 0);
        expect(r.lots.filter((l) => l.twin).length).toBeLessThanOrEqual(1);
      }
  });

  it('shows ≥ 5 gable types and ≥ 4 window types in every 4-screen strip of each sheet', () => {
    for (const sheet of BUILT_SHEETS)
      for (const seed of SEEDS) {
        const r = planRow('test', { u0: 0, u1: 6144, sheet, seed }, 0);
        for (let u = 0; u + 1536 <= 6144; u += 256) {
          const w = r.lots.filter((l) => l.u0 >= u && l.u0 < u + 1536);
          expect(new Set(w.map((l) => l.gable)).size, `${sheet} #${seed} @${u} gables`).toBeGreaterThanOrEqual(5);
          expect(new Set(w.map((l) => l.window)).size, `${sheet} #${seed} @${u} windows`).toBeGreaterThanOrEqual(4);
        }
      }
  });

  it('keeps the rule on every section row of the start tables (slots and the hoist warehouse included)', () => {
    for (const id of Object.keys(OAT_STRIPS)) for (const r of planSection(id)) expect(noRepeatProblems(r.lots), id).toEqual([]);
  });

  it('plants the fixed lots: the shop slots and the hijsbalk warehouse with its beam at x 2,240', () => {
    const lots = facadeLots('oat-a') as LotPlan[];
    const hoist = lots.find((l) => l.hoist && l.u0 <= 2240 && l.u0 + l.w > 2240);
    expect(hoist?.hoist?.u).toBe(2240);
    expect(hoist?.window).toBe('loading');
    for (const id of ['haverbar', 'conceptstore', 'te-koop']) expect(lots.some((l) => l.ground === 'slot' && l.features.some((f) => f.kind === 'slot' && f.text === id))).toBe(true);
  });

  it('marks every lot with at least 6 wear marks (spec §8.10) and flower boxes on at most about 1 lot in 6', () => {
    for (const sheet of BUILT_SHEETS) {
      const r = planRow('test', { u0: 0, u1: 6144, sheet, seed: 3 }, 0);
      for (const l of r.lots) expect(l.wear.length).toBeGreaterThanOrEqual(6);
      expect(r.lots.filter((l) => l.flowerBox).length / r.lots.length).toBeLessThan(0.22);
    }
  });

  it('is deterministic: the same row plans the same lots', () => {
    const a = planRow('oat-a', { u0: 544, u1: 1568, sheet: '9-straatjes' }, 0);
    const b = planRow('oat-a', { u0: 544, u1: 1568, sheet: '9-straatjes' }, 0);
    expect(JSON.stringify(a.lots)).toBe(JSON.stringify(b.lots));
  });

  it('exposes our row and the unseen opposite row (another seed, the whole section) to the shadows', () => {
    const ours = facadeLots('oat-a');
    const opp = facadeLots('oat-a', true);
    expect(ours.length).toBeGreaterThan(30);
    expect(opp[0].u0).toBeLessThan(0);
    expect(opp[opp.length - 1].u0 + opp[opp.length - 1].w).toBeGreaterThan(4608);
    for (let i = 1; i < ours.length; i++) expect(ours[i].u0).toBeGreaterThanOrEqual(ours[i - 1].u0 + ours[i - 1].w - 0.01);
    expect(facadeLots('oat-e')).toEqual([]);
  });
});

describe('oat façade grammar: the strip source', () => {
  it('registers oat-facade and plans the start strips', () => {
    expect(getStripSource(OAT_STRIP_SOURCE)).toBeDefined();
    const p = planA();
    expect(p.height).toBe(OAT_STRIPS['oat-a'].height);
    expect(p.covers(chunkOf(800))).toBe(true);
    // The Prinsengracht quay (open canal behind) has no façade row.
    expect(p.covers(chunkOf(-400))).toBe(false);
    expect(p.bands(chunkOf(800), 4)).toBeGreaterThan(1);
    expect(p.lots?.().length).toBe(facadeLots('oat-a').length);
  });

  it('paints only PAL colours at 1× and only the oat set (PAL_HD ∪ PAL_HD_OAT) at 2× / 4×: day, night, the dark set', () => {
    const cases: [StripPlan, number, StripLightSet][] = [
      [planA(), chunkOf(900), 'lit'],
      [planD(), chunkOf(400), 'lit'],
      [planD(), chunkOf(4200), 'dark'],
    ];
    for (const [p, cx, set] of cases)
      for (const d of [1, 2, 4] as StripDensity[]) {
        const buf = paintChunk(p, cx, d, set);
        let opaque = 0;
        const bad = new Set<number>();
        for (const c of buf.data) {
          if (c === 0) continue;
          opaque++;
          if (!(d === 1 ? inPalette(c) : inOatPalette(c))) bad.add(c >>> 0);
        }
        expect(opaque, `d${d} ${set}`).toBeGreaterThan(buf.data.length * 0.3);
        expect([...bad].map((c) => c.toString(16)), `d${d} ${set}`).toEqual([]);
      }
  });

  it('draws no ink outline: no outline-colour runs along the silhouettes or the lot borders', () => {
    const ink = new Set(PAL_HD.ink.map((c) => c >>> 0));
    const p = planA();
    for (const d of [2, 4] as StripDensity[])
      for (const cx of [chunkOf(700), chunkOf(2200), chunkOf(3500)]) {
        const buf = paintChunk(p, cx, d);
        const W = buf.w;
        let edge = 0;
        let inked = 0;
        // The silhouette: every opaque px with a clear px above or beside it.
        for (let y = 1; y < buf.h; y++)
          for (let x = 1; x < W - 1; x++) {
            const c = buf.data[y * W + x];
            if (c === 0) continue;
            if (buf.data[(y - 1) * W + x] !== 0 && buf.data[y * W + x - 1] !== 0 && buf.data[y * W + x + 1] !== 0) continue;
            edge++;
            if (ink.has(c >>> 0)) inked++;
          }
        expect(edge).toBeGreaterThan(50);
        expect(inked / edge, `d${d} cx${cx} silhouette`).toBeLessThan(0.01);
        // The lot borders: no vertical ink run of ≥ 2 world px on either side of a border (an outline
        // would run the house's height; a dark door foot in shade may touch it for a px or two).
        for (const l of p.lots?.() ?? []) {
          const bx = Math.round(stripXOfU(l.u0, S) * d) - cx * STRIP_CHUNK * d;
          for (const x of [bx - 1, bx]) {
            if (x < 0 || x >= W) continue;
            let run = 0;
            let worst = 0;
            for (let y = 0; y < buf.h; y++) {
              run = ink.has(buf.data[y * W + x] >>> 0) ? run + 1 : 0;
              worst = Math.max(worst, run);
            }
            expect(worst, `d${d} border at ${l.u0}`).toBeLessThan(4 * d);
          }
        }
      }
  });

  it('is deterministic: two plans paint the same chunk to the same pixels, in any order', () => {
    const p1 = planA();
    const p2 = planA();
    const a = paintChunk(p1, chunkOf(1200), 4);
    paintChunk(p2, chunkOf(3300), 2); // another chunk first: no state leaks between paints
    const b = paintChunk(p2, chunkOf(1200), 4);
    expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(true);
  });

  it('tiles chunks without a seam: lot geometry agrees across a chunk border', () => {
    const p = planA();
    const cx = chunkOf(1000);
    const d = 2;
    const left = paintChunk(p, cx, d);
    const right = paintChunk(p, cx + 1, d);
    // The silhouette height of the last column of the left chunk and the first of the right differ
    // only where a lot border or a gable edge falls there (rare): compare the opaque counts.
    const heightAt = (buf: PixelBuffer, x: number): number => {
      let n = 0;
      for (let y = 0; y < buf.h; y++) if (buf.data[y * buf.w + x] !== 0) n++;
      return n;
    };
    expect(Math.abs(heightAt(left, left.w - 1) - heightAt(right, 0))).toBeLessThan(12);
  });

  it('bakes the night: lit windows, neon and red tubes emit in the lit set and go out in the 03:00 dark set', () => {
    const p = planD();
    const cx = chunkOf(4100);
    const lit = paintChunk(p, cx, 2, 'lit');
    const dark = paintChunk(p, cx, 2, 'dark');
    const bright = (buf: PixelBuffer): number => {
      let n = 0;
      for (const c of buf.data) {
        if (c === 0) continue;
        const r = (c >>> 24) & 255;
        const g = (c >>> 16) & 255;
        if (r + g > 330) n++;
      }
      return n;
    };
    expect(bright(lit)).toBeGreaterThan(bright(dark));
    expect(bright(dark)).toBeGreaterThan(0); // some windows and the lanterns stay
  });
});
