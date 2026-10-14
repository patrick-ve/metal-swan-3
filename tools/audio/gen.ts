/**
 * Generation planning and running for tools/elevenlabs.ts. Planning is pure (it reads only the
 * raw folders to see which takes exist), so `plan` is a free dry run and `gen` is idempotent:
 * a take that already sits in tmp/audio/raw is skipped unless --force.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { ApiError, pool, type Client } from './client';
import {
  creditsPerTake,
  designRequest,
  designSaveRequest,
  lineRequest,
  musicRequest,
  pickKey,
  rawDir,
  readJson,
  sfxRequest,
  SUBSCRIPTION,
  takesIn,
  type ApiRequest,
  type Item,
  type Paths,
  type ReviewNotes,
  type VoicesFile,
} from './lib';
import type { LineSpec, MusicSpec, SfxSpec, VoiceSpec } from './spec-types';

export interface Job {
  kind: Item['kind'];
  id: string;
  /** Take numbers this request fills (three previews for a voice design, else one take). */
  takes: number[];
  request: ApiRequest;
  dir: string;
  credits: number;
  item: Item;
}

export interface Skipped {
  kind: Item['kind'];
  id: string;
  reason: string;
}

export interface PlanOptions {
  /** Overrides the takes per item. */
  takes?: number;
  /** Regenerate takes that already exist. */
  force?: boolean;
  /** Add `spec.takes` fresh takes to items flagged 'regenerate' on the review page. */
  regen?: boolean;
  /** Voice design calls per speaker (each returns three previews). */
  designs?: number;
}

export interface Plan {
  jobs: Job[];
  skipped: Skipped[];
  /** Takes already on disk that the plan leaves alone. */
  existing: number;
  credits: number;
  /** Credits of the line takes that wait for a saved voice (not in `credits`). */
  pending: number;
}

export function planJobs(list: readonly Item[], p: Paths, opts: PlanOptions = {}): Plan {
  const voices = readJson<VoicesFile>(p.voices, {});
  const notes = readJson<ReviewNotes>(p.notes, { notes: {}, regen: {} });
  const jobs: Job[] = [];
  const skipped: Skipped[] = [];
  let existing = 0;
  let pending = 0;

  for (const it of list) {
    const dir = rawDir(p, it.kind, it.id);
    if (it.kind === 'voice') {
      const have = takesIn(dir, 'preview');
      const calls = opts.designs ?? 1;
      const again = opts.regen === true && notes.regen[pickKey('voice', it.id)] === true;
      const wantCalls = opts.force || again || have.length === 0 ? calls : 0;
      existing += have.length;
      let next = opts.force ? 1 : (have.at(-1) ?? 0) + 1;
      for (let c = 0; c < wantCalls; c++) {
        jobs.push({ kind: 'voice', id: it.id, takes: [next, next + 1, next + 2], request: designRequest(it.spec as VoiceSpec), dir, credits: creditsPerTake('voice', it.spec), item: it });
        next += 3;
      }
      if (wantCalls === 0) skipped.push({ kind: 'voice', id: it.id, reason: `${have.length} previews exist` });
      continue;
    }

    let request: ApiRequest;
    if (it.kind === 'sfx') request = sfxRequest(it.spec as SfxSpec);
    else if (it.kind === 'music') request = musicRequest(it.spec as MusicSpec);
    else {
      const l = it.spec as LineSpec;
      const v = voices[l.speaker];
      if (!v?.voice_id) {
        skipped.push({ kind: 'line', id: it.id, reason: `no saved voice for ${l.speaker} (run design, then design-save)` });
        pending += (opts.takes ?? it.takes) * creditsPerTake('line', l);
        continue;
      }
      request = lineRequest(l, v.voice_id);
    }

    const have = takesIn(dir);
    const want = opts.takes ?? it.takes;
    let numbers: number[];
    if (opts.force) numbers = Array.from({ length: want }, (_, i) => i + 1);
    else {
      numbers = [];
      for (let n = 1; n <= want; n++) if (!have.includes(n)) numbers.push(n);
      if (opts.regen && notes.regen[pickKey(it.kind, it.id)]) {
        const top = Math.max(want, have.at(-1) ?? 0, numbers.at(-1) ?? 0);
        for (let n = 1; n <= it.takes; n++) numbers.push(top + n);
      }
    }
    existing += have.filter((n) => !numbers.includes(n)).length;
    if (numbers.length === 0) skipped.push({ kind: it.kind, id: it.id, reason: `${have.length} takes exist` });
    for (const n of numbers) jobs.push({ kind: it.kind, id: it.id, takes: [n], request, dir, credits: creditsPerTake(it.kind, it.spec), item: it });
  }
  return { jobs, skipped, existing, credits: jobs.reduce((s, j) => s + j.credits, 0), pending };
}

export function formatPlan(plan: Plan, p: Paths): string {
  const lines: string[] = [];
  const byKind = new Map<string, { jobs: number; credits: number }>();
  for (const j of plan.jobs) {
    const k = byKind.get(j.kind) ?? { jobs: 0, credits: 0 };
    k.jobs++;
    k.credits += j.credits;
    byKind.set(j.kind, k);
    const what = j.kind === 'voice' ? `previews ${j.takes.join(',')}` : `take ${j.takes[0]}`;
    lines.push(`  ${j.kind.padEnd(5)} ${j.id.slice(0, 48).padEnd(48)} ${what.padEnd(16)} ~${String(j.credits).padStart(5)} cr  → ${relative(p.root, j.dir)}`);
  }
  for (const s of plan.skipped) lines.push(`  ${s.kind.padEnd(5)} ${s.id.slice(0, 48).padEnd(48)} skip: ${s.reason}`);
  lines.push('');
  for (const [k, v] of byKind) lines.push(`  ${k.padEnd(5)} ${String(v.jobs).padStart(4)} requests  ~${v.credits} credits`);
  lines.push(`  total ${String(plan.jobs.length).padStart(4)} requests  ~${plan.credits} credits (${plan.existing} takes already on disk)`);
  if (plan.pending) lines.push(`  later: ~${plan.pending} credits of line takes that wait for a saved voice`);
  return lines.join('\n');
}

// ------------------------------------------------------------------------------------------ running

export interface Credits {
  used: number;
  limit: number;
  tier?: string;
}

export async function readCredits(client: Client): Promise<Credits | { error: string }> {
  try {
    const r = await client.send(SUBSCRIPTION);
    const j = r.json as { character_count?: number; character_limit?: number; tier?: string };
    return { used: Number(j.character_count ?? NaN), limit: Number(j.character_limit ?? NaN), tier: j.tier };
  } catch (err) {
    return { error: err instanceof ApiError ? `HTTP ${err.status}` : String(err instanceof Error ? err.message : err) };
  }
}

export function ledger(p: Paths, entry: Record<string, unknown>): void {
  mkdirSync(dirname(p.ledger), { recursive: true });
  appendFileSync(p.ledger, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

export interface RunResult {
  done: number;
  failed: { kind: string; id: string; take: number; error: string }[];
}

export interface RunOptions {
  concurrency?: number;
  log?: (line: string) => void;
  label?: string;
}

/** Runs the jobs (concurrency 2), writes take files with a .json meta, logs to the ledger. */
export async function runJobs(jobs: readonly Job[], client: Client, p: Paths, opts: RunOptions = {}): Promise<RunResult> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const result: RunResult = { done: 0, failed: [] };
  if (jobs.length === 0) return result;
  const before = await readCredits(client);
  ledger(p, { event: 'batch-start', label: opts.label ?? 'gen', requests: jobs.length, estimate: jobs.reduce((s, j) => s + j.credits, 0), credits: before });
  let musicModel = true;

  await pool(jobs, opts.concurrency ?? 2, async (job) => {
    const t0 = Date.now();
    let req = job.request;
    if (job.kind === 'music' && !musicModel) req = musicRequest(job.item.spec as MusicSpec, false);
    try {
      let res;
      try {
        res = await client.send(req);
      } catch (err) {
        // music_v2_5 is not on every plan: fall back to the API default model once.
        if (job.kind === 'music' && req.body?.model_id && err instanceof ApiError && (err.status === 400 || err.status === 422) && /model/i.test(err.detail)) {
          if (musicModel) log(`  music: model ${String(req.body.model_id)} refused, using the API default model`);
          musicModel = false;
          req = musicRequest(job.item.spec as MusicSpec, false);
          res = await client.send(req);
        } else throw err;
      }
      mkdirSync(job.dir, { recursive: true });
      const meta = { kind: job.kind, id: job.id, path: req.path, body: req.body, at: new Date().toISOString(), ms: Date.now() - t0, headers: res.headers };
      if (job.kind === 'voice') {
        const previews = ((res.json as { previews?: { audio_base_64: string; generated_voice_id: string; duration_secs?: number }[] }).previews ?? []);
        previews.slice(0, job.takes.length).forEach((pv, i) => {
          const n = job.takes[i];
          writeFileSync(join(job.dir, `preview-${n}.mp3`), Buffer.from(pv.audio_base_64, 'base64'));
          writeFileSync(join(job.dir, `preview-${n}.json`), `${JSON.stringify({ ...meta, take: n, generated_voice_id: pv.generated_voice_id, duration: pv.duration_secs ?? null }, null, 2)}\n`);
        });
        result.done += previews.length;
        log(`  voice ${job.id}: ${previews.length} previews`);
      } else {
        const n = job.takes[0];
        writeFileSync(join(job.dir, `take-${n}.mp3`), res.audio ?? new Uint8Array());
        writeFileSync(join(job.dir, `take-${n}.json`), `${JSON.stringify({ ...meta, take: n, bytes: res.audio?.length ?? 0 }, null, 2)}\n`);
        result.done++;
        log(`  ${job.kind} ${job.id} take ${n}: ${res.audio?.length ?? 0} bytes`);
      }
      ledger(p, { event: 'ok', kind: job.kind, id: job.id, takes: job.takes, estimate: job.credits, ms: Date.now() - t0, headers: res.headers });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const take of job.takes.slice(0, 1)) result.failed.push({ kind: job.kind, id: job.id, take, error: msg });
      ledger(p, { event: 'fail', kind: job.kind, id: job.id, takes: job.takes, error: msg });
      log(`  FAIL ${job.kind} ${job.id} take ${job.takes[0]}: ${msg}`);
    }
  });

  const after = await readCredits(client);
  const spent = 'used' in before && 'used' in after ? after.used - before.used : null;
  ledger(p, { event: 'batch-end', label: opts.label ?? 'gen', done: result.done, failed: result.failed.length, credits: after, spent });
  return result;
}

/** Saves a chosen design preview as a permanent account voice and records it in voices.json. */
export async function saveDesign(client: Client, p: Paths, v: VoiceSpec, preview: number): Promise<string> {
  const dir = rawDir(p, 'voice', v.speaker);
  const meta = readJson<{ generated_voice_id?: string } | null>(join(dir, `preview-${preview}.json`), null);
  if (!meta?.generated_voice_id) throw new Error(`no preview ${preview} for ${v.speaker} in ${relative(p.root, dir)}`);
  const res = await client.send(designSaveRequest(v, meta.generated_voice_id));
  const voiceId = (res.json as { voice_id?: string }).voice_id;
  if (!voiceId) throw new Error('the API returned no voice_id');
  const voices = readJson<VoicesFile>(p.voices, {});
  voices[v.speaker] = { voice_id: voiceId, name: v.name, generated_voice_id: meta.generated_voice_id, preview, savedAt: new Date().toISOString() };
  const sorted = Object.fromEntries(Object.entries(voices).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(p.voices, `${JSON.stringify(sorted, null, 2)}\n`);
  ledger(p, { event: 'design-save', speaker: v.speaker, preview, voice_id: voiceId });
  return voiceId;
}

/** Clears the 'regenerate' flags of the given items after a successful --regen run. */
export function clearRegen(p: Paths, keys: readonly string[]): void {
  const notes = readJson<ReviewNotes>(p.notes, { notes: {}, regen: {} });
  let changed = false;
  for (const k of keys) {
    if (notes.regen[k]) {
      delete notes.regen[k];
      changed = true;
    }
  }
  if (changed) writeFileSync(p.notes, `${JSON.stringify(notes, null, 2)}\n`);
}
