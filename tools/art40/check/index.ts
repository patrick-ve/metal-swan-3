/**
 * npm run art40-check -- [<slug>...] [--json] [--all-findings] [--dir <folder>] [--contract <file>]
 * npm run art40-check -- --write-rules   (writes tools/art40/rules.json for the Python bake)
 * (or: npx tsx tools/art40/check/index.ts ...)
 *
 * Runs the art40 gates (core.ts) over every baked set in src/game/content/art40/ (or the named
 * slugs) against docs/design/ams40/contract.json and prints one table row per set and the
 * findings. Exit 1 on any failure (a gate that fails or a file that does not import), 0 otherwise.
 * --json prints the machine report (CheckRun) instead.
 */
import { writeFileSync } from 'node:fs';
import { setPassed } from './core';
import { checkAll, SETS_DIR } from './load';
import { rulesJson, RULES_PATH } from './rules';
import { GATES, type Finding, type SetReport } from './types';

const MARK = { pass: 'ok', warn: 'w', fail: 'FAIL', skip: '-' } as const;

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

export function formatTable(reports: readonly SetReport[]): string {
  const head = ['set', 'budget', 'col', 'max/f', 'strips', 'frames', 'outline', 'orph', 'halo', 'travel', 'drift', ...GATES];
  const rows = reports.map((r) => [
    r.slug,
    String(r.budget),
    String(r.colours),
    String(r.maxFrameColours),
    String(r.strips),
    String(r.frames),
    `${(r.outlineShare * 100).toFixed(0)}%`,
    String(r.orphans),
    String(r.halos),
    r.worstTravel ? r.worstTravel.perTick.toFixed(2) : '-',
    r.worstDrift ? r.worstDrift.drift.toFixed(2) : '-',
    ...GATES.map((g) => MARK[r.gates[g]]),
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]): string => cells.map((c, i) => pad(c, w[i])).join('  ');
  return [line(head), line(w.map((n) => '-'.repeat(n))), ...rows.map(line)].join('\n');
}

export function formatFindings(r: SetReport, all = false, limit = 40): string {
  const list = r.findings.filter((f) => all || f.level !== 'info');
  const order: Record<Finding['level'], number> = { fail: 0, warn: 1, info: 2 };
  list.sort((a, b) => order[a.level] - order[b.level]);
  const out = list.slice(0, limit).map((f) => `  ${f.level.toUpperCase()} ${f.gate}${f.strip ? ` ${f.strip}` : ''}${f.frame !== undefined ? `#${f.frame}` : ''}: ${f.msg}`);
  if (list.length > limit) out.push(`  … ${list.length - limit} more (--json for all)`);
  return out.join('\n');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--write-rules')) {
    writeFileSync(RULES_PATH, rulesJson());
    console.log(`wrote ${RULES_PATH}`);
    return;
  }
  let dir = SETS_DIR;
  let contractPath: string | undefined;
  const slugs: string[] = [];
  let json = false;
  let all = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--all-findings') all = true;
    else if (a === '--dir') dir = argv[++i];
    else if (a === '--contract') contractPath = argv[++i];
    else slugs.push(a);
  }
  const run = await checkAll(slugs, dir, contractPath);
  const failed = run.errors.length > 0 || run.reports.some((r) => !setPassed(r));
  const missing = slugs.filter((s) => !run.reports.some((r) => r.slug === s) && !run.errors.some((e) => e.file.endsWith(`${s}.gen.ts`)));
  if (json) {
    console.log(JSON.stringify({ ...run, missing, passed: !failed && missing.length === 0 }, null, 1));
  } else {
    console.log(`art40-check: ${run.reports.length} set(s) in ${dir}${run.contract ? '' : ' (no contract: the contract gate is skipped)'}`);
    if (run.reports.length) console.log(formatTable(run.reports));
    for (const r of run.reports) {
      const f = formatFindings(r, all);
      if (f) console.log(`\n${r.slug} (${r.prefix}):\n${f}`);
    }
    for (const e of run.errors) console.log(`\nIMPORT ${e.file}: ${e.error}`);
    for (const s of missing) console.log(`\nMISSING ${s}: no ${dir}/${s}.gen.ts`);
    console.log(failed || missing.length ? '\nart40-check: FAIL' : '\nart40-check: pass');
  }
  process.exit(failed || missing.length ? 1 : 0);
}

const self = process.argv[1] ?? '';
if (/art40[\\/]check[\\/]index\.ts$/.test(self)) void main();
