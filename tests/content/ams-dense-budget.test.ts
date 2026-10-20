/**
 * Mission ams — the tier-4 working set stays inside the budget (docs/design/ams-extras.md §8,
 * gameplay.ts `denseWorkingSet`, `DENSE_BUDGET_BYTES` = 256 MB): for every squad hero alone (1P) and
 * for hero pairs (2P), in every ams section (the next sections of a route split count as ahead),
 * the 4× bytes of the set fit the budget.
 *
 * The bytes come from the 1× frames (a 4× frame has its 1× frame's logical size: 16 × the pixels,
 * 4 bytes each), so no 4× art is built here. Measured 2026-10-20 against a real 4× build: the
 * estimate is at most 0.5 MB under the real bytes, so the test keeps a 2 MB margin. Worst case then:
 * bob 1P in section a, 251.6 MB real.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { getMission } from '../../src/game/registry';
import { ROSTER } from '../../src/game/scenes/flow-data';
import { DENSE_BUDGET_BYTES, denseWorkingSet, nextSections } from '../../src/game/scenes/gameplay';

beforeAll(async () => {
  await loadContent();
}, 120_000);

const MARGIN = 2 * 1024 * 1024;

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

describe('ams tier-4 working set', () => {
  it('1P: every squad hero in every section fits DENSE_BUDGET_BYTES', () => {
    const ams = getMission('ams')!;
    const order = Object.keys(ams.sections ?? {});
    const over: string[] = [];
    for (const hero of ROSTER) {
      for (const s of order) {
        const set = denseWorkingSet(ams, [`char/${hero}/`], s, nextSections(ams, order, s, order.indexOf(s)), 1);
        const b = bytes(set);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${hero} ${s} ${(b / 1048576).toFixed(1)} MB`);
      }
    }
    expect(over).toEqual([]);
  });

  it('2P: hero pairs in every section fit DENSE_BUDGET_BYTES', () => {
    const ams = getMission('ams')!;
    const order = Object.keys(ams.sections ?? {});
    const over: string[] = [];
    for (let i = 0; i < ROSTER.length; i++) {
      const pair = [ROSTER[i], ROSTER[(i + 1) % ROSTER.length]];
      for (const s of order) {
        const set = denseWorkingSet(ams, pair.map((h) => `char/${h}/`), s, nextSections(ams, order, s, order.indexOf(s)), 2);
        const b = bytes(set);
        if (b > DENSE_BUDGET_BYTES - MARGIN) over.push(`${pair.join('+')} ${s} ${(b / 1048576).toFixed(1)} MB`);
      }
    }
    expect(over).toEqual([]);
  });
});
