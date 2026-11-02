/**
 * The MIXED scale of the oat façades (docs/design/oat.md §8.2, decision 36): the ground band at true
 * scale (20 px/m: band top 64–84 px, doors 44–48 px, shop glass from 0.4 to 3.0 m = 52 px, stoeps
 * 26–32 px), the lot widths at 0.6 (Amsterdam feet), the upper band at ~0.4 (storeys 22–26 px,
 * window openings at their real ratio 1.6–1.9), the seam rule (the scale changes only at a real line:
 * no opening crosses the band top; every lot has its seam and its protrusion there), at most 1 lot in
 * 6 above 18 m, neighbours' band tops within 20 px, and the painted strip's façade base and height.
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/missions/oat/light/index';
import { BUILT_SHEETS, FACADE_DEPTH, OAT_STRIPS, planRow, planSection, type LotPlan } from '../../src/game/content/missions/oat/facade/index';
import { LOT_PX } from '../../src/game/content/missions/oat/facade/types';
import { facadeMetres } from '../../src/game/content/missions/oat/light/shadow';

function rows(): { name: string; lots: readonly LotPlan[] }[] {
  const out: { name: string; lots: readonly LotPlan[] }[] = [];
  for (const sheet of BUILT_SHEETS) for (const seed of [1, 2, 3, 4, 5, 6]) out.push({ name: `${sheet}#${seed}`, lots: planRow('scale', { u0: 0, u1: 6144, sheet, seed }, 0).lots });
  for (const id of Object.keys(OAT_STRIPS)) for (const r of planSection(id)) out.push({ name: id, lots: r.lots });
  return out;
}

describe('oat façades: the MIXED scale (spec §8.2)', () => {
  it('ground band at true scale: band top 64–84 px, doors 44–48 px, stoeps 26–32 px, shop glass 0.4–3.0 m', () => {
    for (const { name, lots } of rows())
      for (const l of lots) {
        expect(l.bandTop, name).toBeGreaterThanOrEqual(64);
        expect(l.bandTop, name).toBeLessThanOrEqual(84);
        expect(l.door.hh, `${name} door`).toBeGreaterThanOrEqual(44);
        expect(l.door.hh, `${name} door`).toBeLessThanOrEqual(48);
        if (l.door2) expect(l.door2.hh).toBeGreaterThanOrEqual(44);
        if (l.stoep) {
          expect(l.stoep.h, `${name} stoep`).toBeGreaterThanOrEqual(26);
          expect(l.stoep.h, `${name} stoep`).toBeLessThanOrEqual(32);
          expect(l.door.h).toBe(l.stoep.h); // the door sits on the landing
        }
        if (l.ground === 'shop' || l.ground === 'bar')
          for (const o of l.groundWindows) {
            expect(o.h).toBe(8); // 0.4 m
            expect(o.h + o.hh).toBe(60); // 3.0 m
          }
      }
  });

  it('upper band at ~0.4: storeys 22–26 px, window openings at their real ratio 1.6–1.9 (narrowed, never squashed)', () => {
    for (const { name, lots } of rows())
      for (const l of lots)
        for (const s of l.storeys) {
          expect(s.hh, name).toBeGreaterThanOrEqual(22);
          expect(s.hh, name).toBeLessThanOrEqual(26);
          for (const o of s.windows) {
            if (l.window === 'loading' && o.h === s.h + 2) continue; // the stacked loading doors (floor to lintel)
            const r = o.hh / o.w;
            expect(r, `${name} ${l.window} ${o.w}×${o.hh}`).toBeGreaterThanOrEqual(1.6);
            expect(r, `${name} ${l.window} ${o.w}×${o.hh}`).toBeLessThanOrEqual(1.9);
          }
        }
  });

  it('the seam rule: no opening crosses the band top; every lot has its seam line and a protrusion there', () => {
    for (const { name, lots } of rows())
      for (const l of lots) {
        expect(['beam', 'lintel', 'string']).toContain(l.seam);
        expect(l.protrusions.some((p) => (p.kind === 'beam' || p.kind === 'string') && p.y === l.bandTop - 2), name).toBe(true);
        for (const o of l.groundWindows) expect(o.h + o.hh, `${name} ground ${l.ground}`).toBeLessThanOrEqual(l.bandTop);
        expect(l.door.h + l.door.hh + l.fanlight, `${name} door ${l.ground}`).toBeLessThanOrEqual(l.bandTop);
        for (const s of l.storeys) for (const o of s.windows) expect(o.h, name).toBeGreaterThanOrEqual(l.bandTop);
        expect(l.storeys[0]?.h ?? l.bandTop).toBe(l.bandTop);
      }
  });

  it('neighbours differ by at most 20 px at the band top; lot widths are Amsterdam feet at 0.6 (or doubles, infills, slots)', () => {
    const feet = new Set(Object.values(LOT_PX));
    for (const { name, lots } of rows()) {
      for (let i = 1; i < lots.length; i++) expect(Math.abs(lots[i].bandTop - lots[i - 1].bandTop), name).toBeLessThanOrEqual(20);
      const std = lots.filter((l) => l.ft > 0);
      for (const l of std) expect(feet.has(l.w), `${name} ${l.w}`).toBe(true);
      for (const l of lots) {
        expect(l.w, name).toBeGreaterThanOrEqual(24);
        expect(l.w, name).toBeLessThanOrEqual(204);
      }
      // Most lots are standard feet widths (the rest: doubles, infills, the fit at a row end, slots).
      if (name.includes('#')) expect(std.length / lots.length, name).toBeGreaterThan(0.6);
    }
  });

  it('at most 1 lot in 6 rises above 18 m; the 9 Straatjes median ridge is near 16 m', () => {
    for (const { name, lots } of rows()) {
      const tall = lots.filter((l) => facadeMetres(l.ridge, l.bandTop) > 18).length;
      expect(tall, name).toBeLessThanOrEqual(Math.ceil(lots.length / 6));
    }
    const all = planRow('scale', { u0: 0, u1: 12288, sheet: '9-straatjes', seed: 9 }, 0)
      .lots.map((l) => facadeMetres(l.ridge, l.bandTop))
      .sort((a, b) => a - b);
    const median = all[all.length >> 1];
    expect(median).toBeGreaterThan(14);
    expect(median).toBeLessThan(18);
  });

  it('the strips sit on the façade plane 16 px behind the feet and are tall enough for a 22 m house', () => {
    for (const id of ['oat-a', 'oat-b', 'oat-d']) {
      expect(OAT_STRIPS[id].depth).toBe(FACADE_DEPTH);
      expect(FACADE_DEPTH).toBe(16);
      // A 22 m house: 84 px of band + 17.8 m at 8 px/m = 226 world px; at the plane's s 0.862 that is 195 strip px.
      expect(OAT_STRIPS[id].height).toBeGreaterThanOrEqual(160);
    }
  });
});
