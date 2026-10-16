/**
 * Ships the picked candidates: copies them to public/audio/<boot|ams|fps>/<sfx|music|voice>/ and
 * regenerates src/game/content/samples/manifest.ts (deterministic order, no timestamps).
 *
 *   npm run audio:ship [-- --dry-run]
 *
 * Reads tmp/audio/picks.json ({ 'sfx:ui/confirm': [1, 3], ... }) and the candidate metas that
 * tools/audio/process.ts wrote (durations, loop points). MP3s under public/audio/boot,
 * public/audio/ams and public/audio/fps that are no longer picked are removed. The 'mode:fps'
 * group (the first-person mode) is written to the manifest only when it has picks.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CandMeta } from './process';
import { candDir, groupDir, items, paths, pickKey, readJson, slug, type Item, type Paths, type Picks, type Spec } from './lib';
import type { SampleGroupName } from './spec-types';

interface SfxEntry {
  files: string[];
  loopStart?: number;
  loopEnd?: number;
}
interface SongEntry {
  file: string;
  loopStart: number | null;
  loopEnd?: number;
  duration: number;
}
interface VoiceEntry {
  files: string[];
  duration: number;
}
export interface GroupData {
  sfx: Record<string, SfxEntry>;
  music: Record<string, SongEntry>;
  voice: Record<string, VoiceEntry>;
}

export interface ShipPlan {
  groups: Record<SampleGroupName, GroupData>;
  /** [candidate, destination] pairs, absolute paths. */
  copies: [string, string][];
  errors: string[];
  /** Picks that match no spec item (e.g. a line whose text changed): skipped, but reported. */
  warnings: string[];
}

const KIND_DIR = { sfx: 'sfx', music: 'music', line: 'voice' } as const;

/** Builds the manifest data and the copy list from the picks (pure apart from reading metas). */
export function planShip(list: readonly Item[], picks: Picks, p: Paths): ShipPlan {
  const groups: Record<SampleGroupName, GroupData> = {
    boot: { sfx: {}, music: {}, voice: {} },
    'mission:ams': { sfx: {}, music: {}, voice: {} },
    'mode:fps': { sfx: {}, music: {}, voice: {} },
  };
  const copies: [string, string][] = [];
  const errors: string[] = [];
  const known = new Set(list.map((it) => pickKey(it.kind, it.id)));
  const warnings = Object.keys(picks)
    .filter((key) => !known.has(key) && (picks[key]?.length ?? 0) > 0)
    .sort()
    .map((key) => `${key}: picked, but no such item in tools/audio/spec.ts (a changed line text?); skipped`);

  for (const it of list) {
    if (it.kind === 'voice' || !it.group) continue;
    const key = pickKey(it.kind, it.id);
    const chosen = [...new Set(picks[key] ?? [])].sort((a, b) => a - b);
    if (chosen.length === 0) continue;
    if (chosen.length > it.keep) {
      errors.push(`${key}: ${chosen.length} takes picked, keep is ${it.keep}`);
      continue;
    }
    const metas: CandMeta[] = [];
    const files: string[] = [];
    const name = it.kind === 'line' ? it.id : slug(it.id);
    let ok = true;
    chosen.forEach((take, i) => {
      const src = join(candDir(p, it.kind, it.id), `take-${take}.mp3`);
      const meta = readJson<CandMeta | null>(src.replace(/\.mp3$/, '.json'), null);
      if (!existsSync(src) || !meta) {
        errors.push(`${key}: candidate take ${take} is missing (run tools/audio/process.ts)`);
        ok = false;
        return;
      }
      const rel = `${groupDir(it.group as SampleGroupName)}/${KIND_DIR[it.kind as keyof typeof KIND_DIR]}/${name}-${i + 1}.mp3`;
      copies.push([src, join(p.publicAudio, rel)]);
      files.push(rel);
      metas.push(meta);
    });
    if (!ok) continue;
    const g = groups[it.group];
    if (it.kind === 'sfx') {
      const e: SfxEntry = { files };
      const loops = metas.filter((m) => m.loopEnd !== null);
      if (loops.length) {
        const ends = loops.map((m) => m.loopEnd as number);
        if (Math.max(...ends) - Math.min(...ends) > 0.001 || loops.length !== metas.length) {
          errors.push(`${key}: looped takes must share their loop points (pick one take, or set trimTo)`);
          continue;
        }
        e.loopStart = metas[0].loopStart ?? 0;
        e.loopEnd = ends[0];
      }
      g.sfx[it.id] = e;
    } else if (it.kind === 'music') {
      const m = metas[0];
      const e: SongEntry = { file: files[0], loopStart: m.loopStart, duration: m.duration };
      // The bar grid can land a hair past the decoded length (MP3 frames): clamp to the file.
      if (m.loopEnd !== null) e.loopEnd = Math.min(m.loopEnd, m.duration);
      g.music[it.id] = e;
    } else {
      g.voice[it.id] = { files, duration: Math.max(...metas.map((m) => m.duration)) };
    }
  }
  return { groups, copies, errors, warnings };
}

const byKey = <T>(o: Record<string, T>): [string, T][] => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/** The manifest.ts source for the shipped groups. */
export function renderManifest(groups: Record<SampleGroupName, GroupData>): string {
  const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const num = (v: number): string => String(v);
  const out: string[] = [
    '// AUTO-GENERATED by tools/audio/ship.ts (npm run audio:ship). Do not edit by hand:',
    '// pick takes on the review page (npm run audio:review), then ship again.',
    "import type { SampleGroup } from '../../../engine/samples';",
    '',
    '/** Sampled audio by group (see src/engine/samples.ts). Paths are relative to public/audio/. */',
    'export const SAMPLE_MANIFEST: Readonly<Record<string, SampleGroup>> = {',
  ];
  for (const name of ['boot', 'mission:ams', 'mode:fps'] as const) {
    const g = groups[name] as GroupData | undefined;
    if (!g) continue;
    // The first-person mode's group appears once something of it is picked.
    if (name === 'mode:fps' && !Object.keys(g.sfx).length && !Object.keys(g.music).length && !Object.keys(g.voice).length) continue;
    out.push(`  ${q(name)}: {`);
    out.push('    sfx: {');
    for (const [id, e] of byKey(g.sfx)) {
      const loop = e.loopEnd !== undefined ? `, loopStart: ${num(e.loopStart ?? 0)}, loopEnd: ${num(e.loopEnd)}` : '';
      out.push(`      ${q(id)}: { files: [${e.files.map(q).join(', ')}]${loop} },`);
    }
    out.push('    },');
    out.push('    music: {');
    for (const [id, e] of byKey(g.music)) {
      const loopEnd = e.loopEnd !== undefined ? `, loopEnd: ${num(e.loopEnd)}` : '';
      out.push(`      ${q(id)}: { file: ${q(e.file)}, loopStart: ${e.loopStart === null ? 'null' : num(e.loopStart)}${loopEnd}, duration: ${num(e.duration)} },`);
    }
    out.push('    },');
    out.push('    voice: {');
    for (const [id, e] of byKey(g.voice)) out.push(`      ${q(id)}: { files: [${e.files.map(q).join(', ')}], duration: ${num(e.duration)} },`);
    out.push('    },');
    out.push('  },');
  }
  out.push('};', '');
  return out.join('\n');
}

function sameFile(a: string, b: string): boolean {
  return existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

function mp3sUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...mp3sUnder(f));
    else if (e.name.endsWith('.mp3')) out.push(f);
  }
  return out;
}

export interface ShipResult {
  copied: number;
  unchanged: number;
  removed: string[];
  manifest: string;
}

/** Applies a ship plan: copies, removes stale MP3s, writes the manifest. */
export function applyShip(plan: ShipPlan, p: Paths, dryRun = false): ShipResult {
  if (plan.errors.length) throw new Error(`ship refused:\n  ${plan.errors.join('\n  ')}`);
  let copied = 0;
  let unchanged = 0;
  const keep = new Set(plan.copies.map(([, d]) => d));
  for (const [src, dest] of plan.copies) {
    if (sameFile(src, dest)) {
      unchanged++;
      continue;
    }
    copied++;
    if (dryRun) continue;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  const removed: string[] = [];
  for (const g of ['boot', 'ams', 'fps']) {
    for (const f of mp3sUnder(join(p.publicAudio, g))) {
      if (keep.has(f)) continue;
      removed.push(relative(p.root, f));
      if (!dryRun) rmSync(f);
    }
  }
  const manifest = renderManifest(plan.groups);
  if (!dryRun) {
    mkdirSync(dirname(p.manifest), { recursive: true });
    writeFileSync(p.manifest, manifest);
  }
  return { copied, unchanged, removed, manifest };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const m = (await import('./spec')) as unknown as Spec;
  const spec: Spec = { SFX: m.SFX ?? [], MUSIC: m.MUSIC ?? [], VOICES: m.VOICES ?? [], LINES: m.LINES ?? [] };
  const p = paths();
  const plan = planShip(items(spec), readJson<Picks>(p.picks, {}), p);
  for (const w of plan.warnings) console.warn(`  warning: ${w}`);
  const r = applyShip(plan, p, dryRun);
  for (const f of r.removed) console.log(`  remove ${f}`);
  const count = (k: keyof GroupData): number => Object.values(plan.groups).reduce((n, g) => n + Object.keys(g[k]).length, 0);
  console.log(`${dryRun ? 'dry run: ' : ''}${r.copied} copied, ${r.unchanged} unchanged, ${r.removed.length} removed; manifest: ${count('sfx')} sfx, ${count('music')} songs, ${count('voice')} lines → ${relative(p.root, p.manifest)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
