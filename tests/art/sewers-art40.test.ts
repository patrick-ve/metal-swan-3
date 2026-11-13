/**
 * The art40 gates of mission sewers (wave P5, docs/design/sewers.md §9) over every baked set in
 * src/game/content/sewers/art40/ (the lazy sewers chunk; the shared folder src/game/content/art40/ and
 * its 1300 KB budget stay untouched): the same gates as tests/art/art40-gates.test.ts for the shared
 * folder.
 *
 * - The check (tools/art40/check) passes for every set of the folder.
 * - Coverage: every REPLACED id (an id a baked set registers in the game with its frames) has no
 *   sprite error, no placeholder, its 1× frames at every art density, the baked durations and loop
 *   flag; every baked set is registered by the lazy sewers content (defineBakedSet in the group's art
 *   file).
 * - The lazy budget: all sewers sets together at most 450 KB gzip (STREET 160, RATS 110, BOSSES 180).
 * - No sewers set sits in the shared folder (it would load with the boot set).
 *
 * With zero sets everything passes trivially. The other P5 artists run the same check by command:
 * `npm run art40-check -- --dir src/game/content/sewers/art40 [<slug>...]`.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { ART_MODULE_IDS, loadContent } from '../../src/game/content/index';
import { setPassed } from '../../tools/art40/check/core';
import { readContract } from '../../tools/art40/check/contract';
import { coverage } from '../../tools/art40/check/coverage';
import { formatFindings } from '../../tools/art40/check/index';
import { checkAll, loadSet, setFiles, SETS_DIR, type LoadedSet } from '../../tools/art40/check/load';

/** The folder of mission sewers' baked sets (the bake's `--out`). */
const SEWERS_DIR = 'src/game/content/sewers/art40';
/** The lazy budget of all sewers sets together (gzip, bytes; brief P5: 160 + 110 + 180 KB). */
const SEWERS_GZIP_BUDGET = 450 * 1024;

const files = setFiles(SEWERS_DIR);
let sets: LoadedSet[] = [];

beforeAll(async () => {
  sets = await Promise.all(files.map((f) => loadSet(f)));
  if (sets.length) {
    const rep = await loadContent((id) => ART_MODULE_IDS.includes(id));
    expect(rep.failed.map((f) => f.id)).toEqual([]);
  }
}, 120_000);

describe('sewers art40 gates', () => {
  it('art40-check passes for every sewers set', async () => {
    const run = await checkAll([], SEWERS_DIR);
    expect(run.errors).toEqual([]);
    const failed = run.reports.filter((r) => !setPassed(r)).map((r) => `${r.slug}:\n${formatFindings(r, false, 20)}`);
    expect(failed, failed.join('\n')).toEqual([]);
    expect(run.reports.length).toBe(files.length);
  });

  it('all sewers sets together stay inside the lazy budget (450 KB gzip)', () => {
    const sizes = files.map((f) => [basename(f), gzipSync(readFileSync(f), { level: 9 }).length] as const);
    const gz = sizes.reduce((n, [, s]) => n + s, 0);
    const table = sizes.map(([f, s]) => `${f} ${(s / 1024).toFixed(1)} KB`).join('\n');
    expect(gz, `${files.length} sets: ${Math.round(gz / 1024)} KB gzip\n${table}`).toBeLessThanOrEqual(SEWERS_GZIP_BUDGET);
  });

  it('no sewers set sits in the shared art40 folder (the boot set)', () => {
    expect(setFiles(SETS_DIR).filter((f) => basename(f).startsWith('sewers-'))).toEqual([]);
  });

  it('replaced ids are covered: registered, error-free, 1x frames at every density', () => {
    const cov = coverage(
      sets.map((l) => l.set),
      readContract(),
    );
    expect(cov.problems, cov.problems.slice(0, 30).join('\n')).toEqual([]);
    expect(cov.replaced.length + cov.notReplaced.length + cov.unregistered.length).toBe(sets.reduce((n, l) => n + (1 + Object.keys(l.set.variants ?? {}).length) * Object.keys(l.set.strips).length, 0));
  });
});
