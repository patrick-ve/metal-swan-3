/**
 * ElevenLabs generation tool for the start screens and mission ams (see docs/api/audio-pipeline.md).
 *
 *   npm run audio:gen                       dry run: every request and a credit estimate (= plan)
 *   npm run audio:gen -- plan [--kind sfx|music|voice|line] [--only id,...] [--group mission:oldenzaal,...]
 *   npm run audio:gen -- credits            used / limit of the account
 *   npm run audio:gen -- gen   [--kind ..] [--only ..] [--group ..] [--takes n] [--force] [--regen] [--budget n]
 *   npm run audio:gen -- sfx | music | lines [--only ..] [--takes n] [--force] [--regen]
 *   npm run audio:gen -- design [--only SPEAKER,..] [--designs n]   Voice Design previews
 *   npm run audio:gen -- design-save <SPEAKER> [<preview n>]          keep one preview as a voice
 *
 * --group keeps only the items of those sample groups (their sfx, songs and lines, plus the voice
 * designs of the lines' speakers; tools/audio/lib.ts `itemsOfGroups`), e.g. `--group mission:oldenzaal`.
 *
 * The API key comes from .env.local (ELEVENLABS_API_KEY). It is never printed or written out.
 * Raw takes land in tmp/audio/raw/<kind>/<id>/take-<n>.mp3; tools/audio/process.ts goes next.
 */
import { SAMPLE_GROUPS } from '../src/engine/samples';
import { createClient } from './audio/client';
import { clearRegen, formatPlan, planJobs, readCredits, runJobs, saveDesign } from './audio/gen';
import { items, isMayor, KINDS, paths, pickKey, readApiKey, readJson, selectItems, validateSpec, type Kind, type Picks, type Spec } from './audio/lib';
import type { SampleGroupName } from './audio/spec-types';

interface Args {
  cmd: string;
  kinds: Kind[] | null;
  only: string[] | null;
  /** --group: only the items of these sample groups (null = all). */
  groups: SampleGroupName[] | null;
  takes?: number;
  force: boolean;
  regen: boolean;
  budget: number;
  designs?: number;
  rest: string[];
}

const ALIASES: Record<string, Kind> = { sfx: 'sfx', music: 'music', lines: 'line', line: 'line', design: 'voice', voice: 'voice' };

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { cmd: 'plan', kinds: null, only: null, groups: null, force: false, regen: false, budget: 30000, rest: [] };
  let first = true;
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--kind') a.kinds = (argv[++i] ?? '').split(',').map((k) => ALIASES[k] ?? (k as Kind));
    else if (s === '--only') a.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (s === '--group') a.groups = (argv[++i] ?? '').split(',').filter(Boolean) as SampleGroupName[];
    else if (s === '--takes') a.takes = Math.max(1, Number(argv[++i]) || 1);
    else if (s === '--designs') a.designs = Math.max(1, Number(argv[++i]) || 1);
    else if (s === '--budget') a.budget = Number(argv[++i]) || a.budget;
    else if (s === '--force') a.force = true;
    else if (s === '--regen') a.regen = true;
    else if (first && !s.startsWith('--')) {
      a.cmd = s;
      first = false;
    } else a.rest.push(s);
  }
  if (a.kinds) for (const k of a.kinds) if (!KINDS.includes(k)) throw new Error(`unknown --kind ${k}`);
  if (a.groups) for (const g of a.groups) if (!(SAMPLE_GROUPS as readonly string[]).includes(g)) throw new Error(`unknown --group ${g} (one of ${SAMPLE_GROUPS.join(', ')})`);
  return a;
}

async function loadSpec(): Promise<Spec> {
  const m = (await import('./audio/spec')) as unknown as Spec;
  const spec: Spec = { SFX: m.SFX ?? [], MUSIC: m.MUSIC ?? [], VOICES: m.VOICES ?? [], LINES: m.LINES ?? [] };
  const errs = validateSpec(spec);
  if (errs.length) throw new Error(`tools/audio/spec.ts has ${errs.length} problem(s):\n  ${errs.join('\n  ')}`);
  return spec;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const p = paths();

  if (args.cmd === 'credits') {
    const c = await readCredits(createClient({ key: readApiKey() }));
    if ('error' in c) console.log(`credits: not readable (${c.error}; the key may lack the user_read permission)`);
    else console.log(`credits: ${c.used} used of ${c.limit} (${c.limit - c.used} left)${c.tier ? `, tier ${c.tier}` : ''}`);
    return;
  }

  const spec = await loadSpec();
  const all = items(spec);

  if (args.cmd === 'design-save') {
    const speaker = args.rest[0];
    if (!speaker) throw new Error('usage: design-save <SPEAKER> [<preview n>]');
    if (isMayor(speaker)) throw new Error('the mayor never gets a voice');
    const v = spec.VOICES.find((x) => x.speaker === speaker);
    if (!v) throw new Error(`no VoiceSpec for ${speaker}`);
    let n = Number(args.rest[1]);
    if (!Number.isInteger(n) || n < 1) n = readJson<Picks>(p.picks, {})[pickKey('voice', speaker)]?.[0] ?? NaN;
    if (!Number.isInteger(n)) throw new Error(`pick a preview for ${speaker} on the review page, or pass its number`);
    const id = await saveDesign(createClient({ key: readApiKey(), log: console.log }), p, v, n);
    console.log(`${speaker}: preview ${n} saved as voice ${id} (tools/audio/voices.json)`);
    return;
  }

  const kindCmd = ALIASES[args.cmd];
  const kinds: Kind[] | null = kindCmd ? [kindCmd] : args.cmd === 'gen' && !args.kinds ? ['sfx', 'music', 'line'] : args.kinds;
  const selected = selectItems(all, kinds, args.only, args.groups);
  const plan = planJobs(selected, p, { takes: args.takes, force: args.force, regen: args.regen, designs: args.designs });
  console.log(formatPlan(plan, p));

  if (args.cmd === 'plan') {
    console.log('\nDry run. Nothing was sent. Use `gen` (or sfx / music / lines / design) to generate.');
    return;
  }
  if (!kindCmd && args.cmd !== 'gen') throw new Error(`unknown command ${args.cmd}`);
  if (plan.jobs.length === 0) {
    console.log('\nNothing to generate.');
    return;
  }
  if (plan.credits > args.budget) {
    throw new Error(`estimate ~${plan.credits} credits is above --budget ${args.budget}; narrow with --kind/--only or raise --budget`);
  }

  const client = createClient({ key: readApiKey(), log: console.log });
  console.log(`\nGenerating ${plan.jobs.length} request(s), ~${plan.credits} credits, 2 at a time...`);
  const res = await runJobs(plan.jobs, client, p, { label: args.cmd, log: console.log });
  console.log(`\ndone ${res.done}, failed ${res.failed.length} (ledger: tmp/audio/raw/ledger.jsonl)`);
  if (args.regen) {
    const failed = new Set(res.failed.map((f) => pickKey(f.kind as Kind, f.id)));
    clearRegen(p, [...new Set(plan.jobs.map((j) => pickKey(j.kind, j.id)))].filter((k) => !failed.has(k)));
  }
  if (res.failed.length) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
