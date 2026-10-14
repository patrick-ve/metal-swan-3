/**
 * Shared, pure helpers of the ElevenLabs audio pipeline (tools only; never imported by src/).
 *
 *   spec (tools/audio/spec.ts) ─ gen (tools/elevenlabs.ts) ─▶ tmp/audio/raw/<kind>/<slug>/take-<n>.mp3
 *                              ─ process (tools/audio/process.ts) ─▶ tmp/audio/cand/<kind>/<slug>/take-<n>.mp3
 *                              ─ review (tools/audio/review.ts) ─▶ tmp/audio/picks.json
 *                              ─ ship (tools/audio/ship.ts) ─▶ public/audio/** + src/game/content/samples/manifest.ts
 *
 * Nothing in here touches the network or the API key: request bodies are built as plain data so
 * the tests can check them, and tools/audio/client.ts sends them.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { voiceKey } from '../../src/engine/samples';
import type { LineSpec, MusicSpec, SampleGroupName, SfxSpec, VoiceSpec } from './spec-types';

export { voiceKey };

/** Repository root (two levels above this file). */
export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export type Kind = 'sfx' | 'music' | 'voice' | 'line';
export const KINDS: readonly Kind[] = ['sfx', 'music', 'voice', 'line'];

export interface Spec {
  SFX: readonly SfxSpec[];
  MUSIC: readonly MusicSpec[];
  VOICES: readonly VoiceSpec[];
  LINES: readonly LineSpec[];
}

/** Folder layout under one root (the repo, or a temp dir in tests). */
export interface Paths {
  root: string;
  raw: string;
  cand: string;
  picks: string;
  notes: string;
  ledger: string;
  voices: string;
  publicAudio: string;
  manifest: string;
}

export function paths(root = ROOT): Paths {
  return {
    root,
    raw: join(root, 'tmp/audio/raw'),
    cand: join(root, 'tmp/audio/cand'),
    picks: join(root, 'tmp/audio/picks.json'),
    notes: join(root, 'tmp/audio/review-notes.json'),
    ledger: join(root, 'tmp/audio/raw/ledger.jsonl'),
    voices: join(root, 'tools/audio/voices.json'),
    publicAudio: join(root, 'public/audio'),
    manifest: join(root, 'src/game/content/samples/manifest.ts'),
  };
}

// ------------------------------------------------------------------------------------------ names

/** File-system name of an sfx or music id: 'ams/bell' → 'ams-bell'. */
export function slug(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The id a spec item is known by in picks.json, the raw folders and the review page. */
export function itemId(kind: Kind, item: SfxSpec | MusicSpec | VoiceSpec | LineSpec): string {
  if (kind === 'line') return voiceKey((item as LineSpec).text);
  if (kind === 'voice') return (item as VoiceSpec).speaker;
  return (item as SfxSpec | MusicSpec).id;
}

/** Folder name of an item under raw/ and cand/. Line keys and speakers are already safe. */
export function itemDir(kind: Kind, id: string): string {
  return kind === 'line' ? id : slug(id);
}

/** The picks.json key: 'sfx:ui/confirm', 'line:hoi-welkom-bij-fabel-friet', 'voice:GRAMPS'. */
export function pickKey(kind: Kind, id: string): string {
  return `${kind}:${id}`;
}

export function groupDir(group: SampleGroupName): string {
  return group === 'boot' ? 'boot' : 'ams';
}

/** The mayor's lines stay text-only: no voice is ever designed or spoken for her. */
export function isMayor(s: string): boolean {
  return /halsema/i.test(s);
}

// ------------------------------------------------------------------------------------------ .env.local

/**
 * Reads ELEVENLABS_API_KEY from .env.local with a small manual parser (no dotenv, no process.env
 * export). The value is returned to the caller only; it is never printed.
 */
export function readApiKey(root = ROOT): string {
  const file = join(root, '.env.local');
  if (!existsSync(file)) throw new Error('.env.local not found (it must hold ELEVENLABS_API_KEY)');
  const key = parseEnv(readFileSync(file, 'utf8')).ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is missing in .env.local');
  return key;
}

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

// ------------------------------------------------------------------------------------------ validation

const GROUPS: readonly string[] = ['boot', 'mission:ams'];

/** Every problem in the spec, as readable strings (empty when the spec is sound). */
export function validateSpec(spec: Spec): string[] {
  const errs: string[] = [];
  const seen = new Map<string, string>();
  const unique = (kind: Kind, id: string, what: string): void => {
    const k = `${kind}:${kind === 'line' ? id : slug(id)}`;
    const prev = seen.get(k);
    if (prev) errs.push(`${what}: same ${kind} name as ${prev}`);
    else seen.set(k, what);
  };
  const intIn = (v: number, lo: number, hi: number): boolean => Number.isInteger(v) && v >= lo && v <= hi;

  for (const s of spec.SFX) {
    const w = `sfx ${s.id}`;
    unique('sfx', s.id, w);
    if (!GROUPS.includes(s.group)) errs.push(`${w}: bad group ${s.group}`);
    if (!s.prompt.trim()) errs.push(`${w}: empty prompt`);
    if (s.prompt.length > 450) errs.push(`${w}: prompt longer than 450 chars (${s.prompt.length})`);
    if (!(s.seconds >= 0.5 && s.seconds <= 30)) errs.push(`${w}: seconds ${s.seconds} not in 0.5..30`);
    if (s.trimTo !== undefined && !(s.trimTo > 0 && s.trimTo <= s.seconds)) errs.push(`${w}: trimTo ${s.trimTo} not in (0, seconds]`);
    if (!intIn(s.takes, 1, 10)) errs.push(`${w}: takes ${s.takes} not an integer 1..10`);
    if (!intIn(s.keep, 1, s.takes)) errs.push(`${w}: keep ${s.keep} not an integer 1..takes`);
    if (s.influence !== undefined && !(s.influence >= 0 && s.influence <= 1)) errs.push(`${w}: influence not in 0..1`);
  }
  for (const m of spec.MUSIC) {
    const w = `music ${m.id}`;
    unique('music', m.id, w);
    if (!GROUPS.includes(m.group)) errs.push(`${w}: bad group ${m.group}`);
    if (!m.prompt.trim()) errs.push(`${w}: empty prompt`);
    if (!(m.seconds >= 3 && m.seconds <= 600)) errs.push(`${w}: seconds ${m.seconds} not in 3..600`);
    if (!(m.bpm >= 30 && m.bpm <= 300)) errs.push(`${w}: bpm ${m.bpm} not in 30..300`);
    if (!intIn(m.beatsPerBar, 1, 16)) errs.push(`${w}: beatsPerBar ${m.beatsPerBar} not an integer 1..16`);
    if (m.introBars !== undefined && !intIn(m.introBars, 0, 64)) errs.push(`${w}: introBars not an integer 0..64`);
    if (!intIn(m.takes, 1, 10)) errs.push(`${w}: takes ${m.takes} not an integer 1..10`);
    if (m.loop) {
      const bar = (60 / m.bpm) * m.beatsPerBar;
      if (m.seconds < ((m.introBars ?? 0) + 1) * bar + 0.5) errs.push(`${w}: too short for the intro plus one loop bar`);
    }
  }
  const speakers = new Set<string>();
  for (const v of spec.VOICES) {
    const w = `voice ${v.speaker}`;
    if (speakers.has(v.speaker)) errs.push(`${w}: speaker listed twice`);
    speakers.add(v.speaker);
    if (isMayor(`${v.speaker} ${v.name} ${v.description}`)) errs.push(`${w}: the mayor never gets a voice`);
    if (v.description.length < 20 || v.description.length > 1000) errs.push(`${w}: description must be 20..1000 chars`);
    if (v.previewText.length < 100 || v.previewText.length > 1000) errs.push(`${w}: previewText must be 100..1000 chars`);
    if (!v.name.trim()) errs.push(`${w}: empty name`);
  }
  for (const l of spec.LINES) {
    const key = voiceKey(l.text);
    const w = `line ${l.speaker} "${l.text.replace(/\n/g, ' ')}"`;
    if (!key) errs.push(`${w}: empty voice key`);
    unique('line', key, w);
    if (isMayor(l.speaker)) errs.push(`${w}: the mayor's lines stay text-only`);
    if (!speakers.has(l.speaker)) errs.push(`${w}: no VoiceSpec for speaker ${l.speaker}`);
    if (!GROUPS.includes(l.group)) errs.push(`${w}: bad group ${l.group}`);
    if (l.lang !== 'en' && l.lang !== 'nl') errs.push(`${w}: bad lang ${String(l.lang)}`);
    if (!l.say.trim()) errs.push(`${w}: empty say`);
    if (!intIn(l.takes, 1, 10)) errs.push(`${w}: takes ${l.takes} not an integer 1..10`);
  }
  return errs;
}

// ------------------------------------------------------------------------------------------ requests

export const OUTPUT_FORMAT = 'mp3_44100_128';
export const MODELS = {
  sfx: 'eleven_text_to_sound_v2',
  music: 'music_v2_5',
  design: 'eleven_ttv_v3',
  tts: 'eleven_v3',
} as const;

export interface ApiRequest {
  method: 'GET' | 'POST';
  /** Path and query, relative to https://api.elevenlabs.io. */
  path: string;
  body?: Record<string, unknown>;
  /** What the response holds: an audio file or JSON. */
  expect: 'audio' | 'json';
}

export function sfxRequest(s: SfxSpec): ApiRequest {
  const body: Record<string, unknown> = {
    text: s.prompt,
    model_id: MODELS.sfx,
    duration_seconds: s.seconds,
    loop: s.loop === true,
  };
  if (s.influence !== undefined) body.prompt_influence = s.influence;
  return { method: 'POST', path: `/v1/sound-generation?output_format=${OUTPUT_FORMAT}`, body, expect: 'audio' };
}

/** `withModel` false drops model_id so the API picks its default (the fallback when music_v2_5 is refused). */
export function musicRequest(m: MusicSpec, withModel = true): ApiRequest {
  const body: Record<string, unknown> = {
    prompt: m.prompt,
    music_length_ms: Math.round(m.seconds * 1000),
    force_instrumental: true,
  };
  if (withModel) body.model_id = MODELS.music;
  return { method: 'POST', path: `/v1/music?output_format=${OUTPUT_FORMAT}`, body, expect: 'audio' };
}

export function designRequest(v: VoiceSpec): ApiRequest {
  return {
    method: 'POST',
    path: `/v1/text-to-voice/design?output_format=${OUTPUT_FORMAT}`,
    body: { voice_description: v.description, model_id: MODELS.design, text: v.previewText },
    expect: 'json',
  };
}

export function designSaveRequest(v: VoiceSpec, generatedVoiceId: string): ApiRequest {
  return {
    method: 'POST',
    path: '/v1/text-to-voice',
    body: { voice_name: v.name, voice_description: v.description, generated_voice_id: generatedVoiceId },
    expect: 'json',
  };
}

export function lineRequest(l: LineSpec, voiceId: string): ApiRequest {
  return {
    method: 'POST',
    path: `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`,
    body: { text: l.say, model_id: MODELS.tts, language_code: l.lang },
    expect: 'audio',
  };
}

export const SUBSCRIPTION: ApiRequest = { method: 'GET', path: '/v1/user/subscription', expect: 'json' };

// ------------------------------------------------------------------------------------------ credits

/** Credit cost of one take (ElevenLabs pricing pages, 2026-10): see tmp/audio/overview/musdlg.md §5. */
export function creditsPerTake(kind: Kind, item: SfxSpec | MusicSpec | VoiceSpec | LineSpec): number {
  switch (kind) {
    case 'sfx':
      return Math.ceil((item as SfxSpec).seconds * 40);
    case 'music':
      return Math.ceil(((item as MusicSpec).seconds / 60) * 900);
    case 'voice':
      return (item as VoiceSpec).previewText.length;
    case 'line':
      return (item as LineSpec).say.length;
  }
}

// ------------------------------------------------------------------------------------------ takes on disk

/** Take numbers present in a folder as take-<n>.mp3 (or preview-<n>.mp3), sorted. */
export function takesIn(dir: string, prefix = 'take'): number[] {
  if (!existsSync(dir)) return [];
  const re = new RegExp(`^${prefix}-(\\d+)\\.mp3$`);
  const out: number[] = [];
  for (const f of readdirSync(dir)) {
    const m = re.exec(f);
    if (m) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

export function rawDir(p: Paths, kind: Kind, id: string): string {
  return join(p.raw, kind, itemDir(kind, id));
}

export function candDir(p: Paths, kind: Kind, id: string): string {
  return join(p.cand, kind, itemDir(kind, id));
}

// ------------------------------------------------------------------------------------------ json files

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export type Picks = Record<string, number[]>;

export interface ReviewNotes {
  notes: Record<string, string>;
  /** Items the user wants regenerated (gen --regen adds fresh takes, then clears the flag). */
  regen: Record<string, boolean>;
}

export interface SavedVoice {
  voice_id: string;
  name: string;
  generated_voice_id: string;
  preview: number;
  savedAt: string;
}
export type VoicesFile = Record<string, SavedVoice>;

/** The spec flattened into one list, in spec order. */
export interface Item {
  kind: Kind;
  id: string;
  group: SampleGroupName | null;
  spec: SfxSpec | MusicSpec | VoiceSpec | LineSpec;
  takes: number;
  keep: number;
}

export function items(spec: Spec): Item[] {
  const out: Item[] = [];
  for (const s of spec.SFX) out.push({ kind: 'sfx', id: s.id, group: s.group, spec: s, takes: s.takes, keep: s.keep });
  for (const m of spec.MUSIC) out.push({ kind: 'music', id: m.id, group: m.group, spec: m, takes: m.takes, keep: 1 });
  for (const v of spec.VOICES) {
    if (isMayor(v.speaker)) continue;
    out.push({ kind: 'voice', id: v.speaker, group: null, spec: v, takes: 1, keep: 1 });
  }
  for (const l of spec.LINES) {
    if (isMayor(l.speaker)) continue;
    out.push({ kind: 'line', id: voiceKey(l.text), group: l.group, spec: l, takes: l.takes, keep: 1 });
  }
  return out;
}

/** Filters by --kind and --only (ids, slugs or line keys, comma-separated). */
export function selectItems(all: readonly Item[], kinds: readonly Kind[] | null, only: readonly string[] | null): Item[] {
  return all.filter((it) => {
    if (kinds && !kinds.includes(it.kind)) return false;
    if (only && !only.some((o) => o === it.id || o === slug(it.id) || o === pickKey(it.kind, it.id))) return false;
    return true;
  });
}
