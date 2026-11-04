/**
 * Find and import the baked sets (src/game/content/art40/<slug>.gen.ts) and run the gates over
 * them. Shared by the CLI (index.ts), the gates test and the review page.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkSet } from './core';
import { readContract, setPrefixes, type ContractEntry } from './contract';
import type { CheckSet, SetReport } from './types';

export const SETS_DIR = 'src/game/content/art40';
/** Where the bake writes the joint tracks of the game's sets (not shipped). */
export const JOINTS_DIR = 'tools/art40/joints';

/** The joint sidecar of a set file: '<dir>/<slug>.joints.json' next to it, else (a game set) JOINTS_DIR/<slug>.json. */
export function jointsFile(file: string): string | null {
  const slug = basename(file).replace(/\.gen\.ts$/, '');
  const own = join(dirname(file), `${slug}.joints.json`);
  if (existsSync(own)) return own;
  const game = join(JOINTS_DIR, `${slug}.json`);
  return resolve(dirname(file)) === resolve(SETS_DIR) && existsSync(game) ? game : null;
}

export interface LoadedSet {
  file: string;
  set: CheckSet;
  /** The module's other exports (the named event constants). */
  consts: Record<string, unknown>;
}

/** The .gen.ts files of a folder (sorted), optionally only these slugs. */
export function setFiles(dir = SETS_DIR, slugs: readonly string[] = []): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.gen.ts') && !f.startsWith('_'))
    .filter((f) => slugs.length === 0 || slugs.includes(f.slice(0, -'.gen.ts'.length)))
    .sort()
    .map((f) => join(dir, f));
}

export async function loadSet(file: string): Promise<LoadedSet> {
  const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>;
  const raw = mod.SET as CheckSet | undefined;
  if (!raw || typeof raw !== 'object') throw new Error(`${file}: no export SET`);
  const jf = jointsFile(file);
  const set: CheckSet = jf ? { ...raw, joints: (JSON.parse(readFileSync(jf, 'utf8')) as { strips: CheckSet['joints'] }).strips } : raw;
  const consts: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mod)) if (k !== 'SET') consts[k] = v;
  return { file, set, consts };
}

/** Check one loaded set, plus the module rule: one named const per entry of SET.events. */
export function checkLoaded(l: LoadedSet, contract?: ReadonlyMap<string, ContractEntry>): SetReport {
  const r = checkSet(l.set, contract ? { contract } : {});
  for (const [k, v] of Object.entries(l.set.events ?? {})) {
    if (l.consts[k] !== v) r.findings.push({ gate: 'format', level: 'fail', msg: `export const ${k} is ${String(l.consts[k])}, SET.events.${k} is ${v}` });
  }
  const want = `${l.set.slug}.gen.ts`;
  if (!l.file.endsWith(want)) r.findings.push({ gate: 'format', level: 'fail', msg: `file ${l.file} is not ${want}` });
  if (r.findings.some((f) => f.gate === 'format' && f.level === 'fail')) r.gates.format = 'fail';
  return r;
}

export interface CheckRun {
  reports: SetReport[];
  /** Files that did not import. */
  errors: Array<{ file: string; error: string }>;
  contract: boolean;
}

/**
 * Several sets may share one prefix (boss/ams-scan: the scan car, the tow truck, the wheel clamp;
 * disjoint strips). Rule 1 then asks each set only for the contract ids no sibling set gives: the
 * contract without the ids of the other sets of its prefix in `dir`.
 */
async function contractFor(l: LoadedSet, contract: ReadonlyMap<string, ContractEntry> | undefined, dir: string): Promise<ReadonlyMap<string, ContractEntry> | undefined> {
  if (!contract) return contract;
  let out: Map<string, ContractEntry> | null = null;
  for (const f of setFiles(dir)) {
    if (resolve(f) === resolve(l.file)) continue;
    const other = (await loadSet(f)).set;
    if (other.prefix !== l.set.prefix) continue;
    out ??= new Map(contract);
    // ... and the ids of the sibling's variant prefixes (the Swan's P2 `vehicle/swan-mute`).
    for (const p of setPrefixes(other)) for (const name of Object.keys(other.strips)) out.delete(`${p}/${name}`);
  }
  return out ?? contract;
}

export async function checkAll(slugs: readonly string[] = [], dir = SETS_DIR, contractPath?: string): Promise<CheckRun> {
  const contract = readContract(contractPath);
  const run: CheckRun = { reports: [], errors: [], contract: Boolean(contract) };
  for (const f of setFiles(dir, slugs)) {
    try {
      const l = await loadSet(f);
      run.reports.push(checkLoaded(l, await contractFor(l, contract, dir)));
    } catch (e) {
      run.errors.push({ file: f, error: (e as Error).message });
    }
  }
  return run;
}
