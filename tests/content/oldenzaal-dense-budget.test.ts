/**
 * Mission oldenzaal — the tier-4 working set stays inside the budget (docs/design/oldenzaal.md §10.4,
 * §16; gameplay.ts `denseWorkingSet`, `DENSE_BUDGET_BYTES` = 256 MB): for every squad hero alone
 * (1P) and for hero pairs (2P), in every oldenzaal section, the 4× bytes of the sprite set PLUS the
 * section's 4× scenery (art-layout.ts `ozSceneryBytes`: the 4× background layers and the resident
 * 4× terrain chunks, the town's `OZ_SCENERY_RESERVE`) fit the budget with a 2 MB margin.
 *
 * The sprite bytes come from the 1× frames (a 4× frame has its 1× frame's logical size: 16 × the
 * pixels, 4 bytes each), as in ams-dense-budget.test.ts, so no 4× art is built here. The set grows
 * as the builders add their art (hosts, souls, Meneer Wu, the statue in wave B): this test is the
 * gate.
 *
 * Revision 2 (RUIN): the town art grew (the worn fronts, the ruin decor `decor/oz-ruin/`, the
 * openings `prop/oz-boarded/`, `prop/oz-manhole/`); the peaks (1P and 2P, the section and the
 * heroes) are printed for the report and must stay under the budget with the margin.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { OZ_SCENERY_RESERVE, ozSceneryBytes } from '../../src/game/content/missions/oldenzaal/art-layout';
import { OLDENZAAL_ID } from '../../src/game/content/missions/oldenzaal/ids';
import { getMission } from '../../src/game/registry';
import { ROSTER } from '../../src/game/scenes/flow-data';
import { DENSE_BUDGET_BYTES, denseWorkingSet, nextSections } from '../../src/game/scenes/gameplay';

beforeAll(async () => {
  await loadContent();
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

describe('oldenzaal tier-4 working set', () => {
  it('the town scenery reserve covers every town section\'s 4× layers and chunks', () => {
    const m = getMission(OLDENZAAL_ID)!;
    for (const [id, s] of Object.entries(m.sections)) expect(ozSceneryBytes(s), id).toBeLessThanOrEqual(OZ_SCENERY_RESERVE);
  });

  it('1P: every squad hero in every section fits DENSE_BUDGET_BYTES with the scenery', () => {
    const m = getMission(OLDENZAAL_ID)!;
    const order = Object.keys(m.sections);
    const over: string[] = [];
    for (const hero of ROSTER) {
      for (const s of order) {
        const set = denseWorkingSet(m, [`char/${hero}/`], s, nextSections(m, order, s, order.indexOf(s)), 1);
        const b = bytes(set) + ozSceneryBytes(m.sections[s]);
        note(1, b, `${hero} ${s}`);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${hero} ${s} ${MB(b)} MB`);
      }
    }
    expect(over).toEqual([]);
  });

  it('2P: hero pairs in every section fit DENSE_BUDGET_BYTES with the scenery', () => {
    const m = getMission(OLDENZAAL_ID)!;
    const order = Object.keys(m.sections);
    const over: string[] = [];
    for (let i = 0; i < ROSTER.length; i++) {
      const pair = [ROSTER[i], ROSTER[(i + 1) % ROSTER.length]];
      for (const s of order) {
        const set = denseWorkingSet(m, pair.map((h) => `char/${h}/`), s, nextSections(m, order, s, order.indexOf(s)), 2);
        const b = bytes(set) + ozSceneryBytes(m.sections[s]);
        note(2, b, `${pair.join('+')} ${s}`);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${pair.join('+')} ${s} ${MB(b)} MB`);
      }
    }
    expect(over).toEqual([]);
  });

  it('prints the peaks (1P / 2P) for the report', () => {
    expect(peak[1].b).toBeGreaterThan(0);
    expect(peak[2].b).toBeGreaterThanOrEqual(peak[1].b);
    console.info(`[oz budget] 1P peak ${MB(peak[1].b)} MB (${peak[1].what}); 2P peak ${MB(peak[2].b)} MB (${peak[2].what}); limit ${MB(DENSE_BUDGET_BYTES)} MB`);
  });
});
