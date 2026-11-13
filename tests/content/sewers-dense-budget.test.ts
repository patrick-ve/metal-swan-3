/**
 * Mission sewers — the tier-4 working set stays inside the budget (docs/design/sewers.md §9;
 * gameplay.ts `denseWorkingSet`, `DENSE_BUDGET_BYTES` = 256 MB): for every squad hero alone (1P) and
 * for hero pairs (2P), in every sewers section, the 4× bytes of the sprite set PLUS the mission's own
 * reserve (`denseReserve`; none in P0: the canal scenes live in their own store budget, as ams's)
 * fit the budget with a 2 MB margin. The pattern of the former level 2's test
 * (`git show eb3316a:tests/content/oat-dense-budget.test.ts`).
 *
 * The sprite bytes come from the 1× frames (a 4× frame has its 1× frame's logical size: 16 × the
 * pixels, 4 bytes each), as in ams-dense-budget.test.ts and oldenzaal-dense-budget.test.ts, so no
 * 4× art is built here. The set grows as the waves add their cast, bosses and decor: this test is
 * the gate. The peaks are printed for the report.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames } from '../../src/engine/sprites';
import { isSewersContent, loadContent } from '../../src/game/content/index';
import { SEWERS_ID, SEWERS_SECTIONS } from '../../src/game/content/missions/sewers/ids';
import { getMission } from '../../src/game/registry';
import { ROSTER } from '../../src/game/scenes/flow-data';
import { DENSE_BUDGET_BYTES, denseWorkingSet, nextSections } from '../../src/game/scenes/gameplay';

beforeAll(async () => {
  await loadContent();
  await loadContent(isSewersContent);
}, 120_000);

const MARGIN = 2 * 1024 * 1024;
const MB = (b: number): string => (b / 1048576).toFixed(1);

/** The worst set seen per player count (printed once at the end). */
const peak: Record<number, { b: number; what: string }> = { 1: { b: 0, what: '' }, 2: { b: 0, what: '' } };
function note(n: 1 | 2, b: number, what: string): void {
  if (b > peak[n].b) peak[n] = { b, what };
}

/** 4× bytes of `ids` from their 1× frames (shared buffers once per id). */
function bytes(ids: readonly string[]): number {
  let b = 0;
  for (const id of ids) {
    const seen = new Set<unknown>();
    for (const f of getFrames(id, 1)) {
      if (seen.has(f.buf)) continue;
      seen.add(f.buf);
      b += f.buf.w * f.buf.h * 64;
    }
  }
  return b;
}

describe('sewers tier-4 working set', () => {
  it('covers every section of the mission', () => {
    expect(Object.keys(getMission(SEWERS_ID)!.sections)).toEqual([...SEWERS_SECTIONS]);
  });

  it('1P: every squad hero in every section fits DENSE_BUDGET_BYTES with the reserve', () => {
    const m = getMission(SEWERS_ID)!;
    const reserve = m.denseReserve ?? 0;
    const order = Object.keys(m.sections);
    const over: string[] = [];
    for (const hero of ROSTER) {
      for (const s of order) {
        const set = denseWorkingSet(m, [`char/${hero}/`], s, nextSections(m, order, s, order.indexOf(s)), 1);
        const b = bytes(set) + reserve;
        note(1, b, `${hero} ${s}`);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${hero} ${s} ${MB(b)} MB`);
      }
    }
    expect(over).toEqual([]);
  });

  it('2P: every hero pair in every section fits DENSE_BUDGET_BYTES with the reserve', () => {
    const m = getMission(SEWERS_ID)!;
    const reserve = m.denseReserve ?? 0;
    const order = Object.keys(m.sections);
    const over: string[] = [];
    let pairs = 0;
    for (let i = 0; i < ROSTER.length; i++) {
      for (let j = i + 1; j < ROSTER.length; j++) {
        const pair = [ROSTER[i], ROSTER[j]];
        pairs++;
        for (const s of order) {
          const set = denseWorkingSet(m, pair.map((h) => `char/${h}/`), s, nextSections(m, order, s, order.indexOf(s)), 2);
          const b = bytes(set) + reserve;
          note(2, b, `${pair.join('+')} ${s}`);
          if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${pair.join('+')} ${s} ${MB(b)} MB`);
        }
      }
    }
    expect(pairs).toBe((ROSTER.length * (ROSTER.length - 1)) / 2);
    expect(over).toEqual([]);
  });

  it('prints the peaks (1P / 2P) for the report', () => {
    expect(peak[1].b).toBeGreaterThan(0);
    expect(peak[2].b).toBeGreaterThanOrEqual(peak[1].b);
    console.info(`[sewers budget] 1P peak ${MB(peak[1].b)} MB (${peak[1].what}); 2P peak ${MB(peak[2].b)} MB (${peak[2].what}); limit ${MB(DENSE_BUDGET_BYTES)} MB`);
  });
});
