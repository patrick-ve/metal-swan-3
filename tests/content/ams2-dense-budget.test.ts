/**
 * Mission ams2 — the tier-4 working set stays inside the budget (gameplay.ts `denseWorkingSet`,
 * `DENSE_BUDGET_BYTES` = 256 MB), as for `ams` (tests/content/ams-dense-budget.test.ts): for every
 * squad hero alone and for hero pairs, in every section (the next sections of the route count as
 * ahead), the 4× bytes of the set fit. The bytes come from the 1× frames: no 4× art is built here.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames } from '../../src/engine/sprites';
import { isAms2Content, isLazyContent, loadContent } from '../../src/game/content/index';
import { getMission } from '../../src/game/registry';
import { ROSTER } from '../../src/game/scenes/flow-data';
import { DENSE_BUDGET_BYTES, denseWorkingSet, nextSections } from '../../src/game/scenes/gameplay';

beforeAll(async () => {
  await loadContent((id) => !isLazyContent(id) || isAms2Content(id));
}, 120_000);

const MARGIN = 2 * 1024 * 1024;

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

describe('ams2 tier-4 working set', () => {
  it('1P: every squad hero in every section fits DENSE_BUDGET_BYTES', () => {
    const m = getMission('ams2')!;
    const order = Object.keys(m.sections ?? {});
    const over: string[] = [];
    let top = 0;
    for (const hero of ROSTER) {
      for (const s of order) {
        const b = bytes(denseWorkingSet(m, [`char/${hero}/`], s, nextSections(m, order, s, order.indexOf(s)), 1));
        top = Math.max(top, b);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${hero} ${s} ${(b / 1048576).toFixed(1)} MB`);
      }
    }
    console.log(`ams2 1P worst ${(top / 1048576).toFixed(1)} MB`);
    expect(over).toEqual([]);
  });

  it('2P: hero pairs in every section fit DENSE_BUDGET_BYTES', () => {
    const m = getMission('ams2')!;
    const order = Object.keys(m.sections ?? {});
    const over: string[] = [];
    for (let i = 0; i < ROSTER.length; i++) {
      const pair = [ROSTER[i], ROSTER[(i + 1) % ROSTER.length]];
      for (const s of order) {
        const b = bytes(denseWorkingSet(m, pair.map((h) => `char/${h}/`), s, nextSections(m, order, s, order.indexOf(s)), 2));
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${pair.join('+')} ${s} ${(b / 1048576).toFixed(1)} MB`);
      }
    }
    expect(over).toEqual([]);
  });
});
