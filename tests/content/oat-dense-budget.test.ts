/**
 * Mission oat — the tier-4 working set stays inside the budget (docs/design/oat.md §8.12, decision
 * 50; gameplay.ts `denseWorkingSet`, `DENSE_BUDGET_BYTES` = 256 MB): the mission declares a dense
 * reserve of 84 MB (`OAT_SCENERY_RESERVE`) for its scenery (the 4× background layers, the façade
 * strips' lit cap, the 03:00 dark set, the terrain margin: `oatSceneryBytes`), and for every squad
 * hero alone (1P) and for hero pairs (2P), in every oat section, the 4× bytes of the sprite set PLUS
 * the reserve fit the budget with a 2 MB margin (the sprite set ≤ 170 MB).
 *
 * The sprite bytes come from the 1× frames (a 4× frame has its 1× frame's logical size: 16 × the
 * pixels, 4 bytes each), as in ams-dense-budget.test.ts and oldenzaal-dense-budget.test.ts, so no
 * 4× art is built here. The set grows as the waves add their cast, bosses and decor: this test is
 * the gate (the order of cuts if it fails: spec §8.12). The peaks are printed for the report.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames } from '../../src/engine/sprites';
import { isOatContent, loadContent } from '../../src/game/content/index';
import { OAT_SCENERY_RESERVE, oatSceneryBytes } from '../../src/game/content/missions/oat/index';
import { OAT_ID } from '../../src/game/content/missions/oat/ids';
import { getMission } from '../../src/game/registry';
import { ROSTER } from '../../src/game/scenes/flow-data';
import { DENSE_BUDGET_BYTES, denseWorkingSet, nextSections } from '../../src/game/scenes/gameplay';

beforeAll(async () => {
  await loadContent();
  await loadContent(isOatContent);
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

describe('oat tier-4 working set', () => {
  it('the mission declares the 84 MB scenery reserve', () => {
    expect(getMission(OAT_ID)!.denseReserve).toBe(OAT_SCENERY_RESERVE);
    expect(OAT_SCENERY_RESERVE).toBe(84 * 1024 * 1024);
  });

  it('the scenery reserve covers every section\'s 4× layers, strips, dark set and terrain margin', () => {
    const m = getMission(OAT_ID)!;
    const lines: string[] = [];
    for (const [id, s] of Object.entries(m.sections)) {
      const b = oatSceneryBytes(s);
      lines.push(`${id} ${MB(b)}`);
      expect(b, id).toBeLessThanOrEqual(OAT_SCENERY_RESERVE);
    }
    console.info(`[oat budget] scenery MB: ${lines.join(', ')} (reserve ${MB(OAT_SCENERY_RESERVE)})`);
  });

  it('1P: every squad hero in every section fits DENSE_BUDGET_BYTES with the reserve', () => {
    const m = getMission(OAT_ID)!;
    const order = Object.keys(m.sections);
    const over: string[] = [];
    for (const hero of ROSTER) {
      for (const s of order) {
        const set = denseWorkingSet(m, [`char/${hero}/`], s, nextSections(m, order, s, order.indexOf(s)), 1);
        const b = bytes(set) + OAT_SCENERY_RESERVE;
        note(1, b, `${hero} ${s}`);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${hero} ${s} ${MB(b)} MB`);
      }
    }
    expect(over).toEqual([]);
  });

  it('2P: hero pairs in every section fit DENSE_BUDGET_BYTES with the reserve', () => {
    const m = getMission(OAT_ID)!;
    const order = Object.keys(m.sections);
    const over: string[] = [];
    for (let i = 0; i < ROSTER.length; i++) {
      const pair = [ROSTER[i], ROSTER[(i + 1) % ROSTER.length]];
      for (const s of order) {
        const set = denseWorkingSet(m, pair.map((h) => `char/${h}/`), s, nextSections(m, order, s, order.indexOf(s)), 2);
        const b = bytes(set) + OAT_SCENERY_RESERVE;
        note(2, b, `${pair.join('+')} ${s}`);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${pair.join('+')} ${s} ${MB(b)} MB`);
      }
    }
    expect(over).toEqual([]);
  });

  it('prints the peaks (1P / 2P) for the report', () => {
    expect(peak[1].b).toBeGreaterThan(0);
    expect(peak[2].b).toBeGreaterThanOrEqual(peak[1].b);
    console.info(`[oat budget] 1P peak ${MB(peak[1].b)} MB (${peak[1].what}); 2P peak ${MB(peak[2].b)} MB (${peak[2].what}); limit ${MB(DENSE_BUDGET_BYTES)} MB`);
  });
});
