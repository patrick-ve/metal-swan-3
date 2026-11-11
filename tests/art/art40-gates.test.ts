/**
 * The art40 gates (plan docs/design/ams40.md "Gates" 1-2) over every baked set in
 * src/game/content/art40/: the check (tools/art40/check) passes, and every REPLACED id (an id a
 * baked set registers in the game with its frames: '<prefix>/<strip>' and the same strip under
 * every variant prefix) is covered (tools/art40/check/coverage.ts): no sprite error and no
 * placeholder, its baked 1× frames at every art density (no 2× / 4× generator, no dense alias),
 * the baked durations and loop flag; every baked set is registered; every contract id of a
 * replaced prefix exists.
 * Budgets (plan "Pipeline": at most 1300 KB gzip for all baked data): the gzip size of every
 * generated file together.
 * With zero sets (before wave 1) everything passes trivially.
 */

/**
 * Plan "Pipeline" size budget for all baked data (gzip, bytes). Lead decision after wave 6
 * (2026-11-04): 500 -> 1200 KB, because the whole ams cast at 40 px with the high-fidelity mayor
 * and the select portraits measures about 1 MB gzip. Owner decision (2026-11-11): 1200 -> 1300 KB,
 * to take in the street and riders sets of waves 3 and 4 as they stand (1258 KB measured).
 */
const BAKED_GZIP_BUDGET = 1300 * 1024;
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { ART_MODULE_IDS, loadContent } from '../../src/game/content/index';
import { setPassed } from '../../tools/art40/check/core';
import { readContract } from '../../tools/art40/check/contract';
import { coverage } from '../../tools/art40/check/coverage';
import { formatFindings } from '../../tools/art40/check/index';
import { checkAll, loadSet, setFiles, type LoadedSet } from '../../tools/art40/check/load';

const files = setFiles();
let sets: LoadedSet[] = [];

beforeAll(async () => {
  sets = await Promise.all(files.map((f) => loadSet(f)));
  if (sets.length) {
    const rep = await loadContent((id) => ART_MODULE_IDS.includes(id));
    expect(rep.failed.map((f) => f.id)).toEqual([]);
  }
}, 120_000);

describe('art40 gates', () => {
  it('art40-check passes for every baked set', async () => {
    const run = await checkAll();
    expect(run.errors).toEqual([]);
    const failed = run.reports.filter((r) => !setPassed(r)).map((r) => `${r.slug}:\n${formatFindings(r, false, 20)}`);
    expect(failed, failed.join('\n')).toEqual([]);
    expect(run.reports.length).toBe(files.length);
  });

  it('all baked data together stays inside the size budget (1300 KB gzip)', () => {
    const gz = files.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
    expect(gz, `${files.length} sets: ${Math.round(gz / 1024)} KB gzip`).toBeLessThanOrEqual(BAKED_GZIP_BUDGET);
  });

  it('replaced ids are covered: registered, error-free, 1x frames at every density, contract ids present', () => {
    const cov = coverage(
      sets.map((l) => l.set),
      readContract(),
    );
    expect(cov.problems, cov.problems.slice(0, 30).join('\n')).toEqual([]);
    expect(cov.replaced.length + cov.notReplaced.length + cov.unregistered.length).toBe(sets.reduce((n, l) => n + (1 + Object.keys(l.set.variants ?? {}).length) * Object.keys(l.set.strips).length, 0));
  });
});
