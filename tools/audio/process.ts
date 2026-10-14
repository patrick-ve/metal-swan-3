/**
 * Turns raw ElevenLabs takes into review candidates (ffmpeg 8 decodes and encodes; the DSP is
 * plain TS so the tests can check it on tiny buffers):
 *
 *   sfx    mono; trim silence; short fades; trimTo; loudness matched to the synth version of the
 *          same id (K-weighted momentary maximum, as tests/content/sfx.test.ts measures it);
 *          loops get a seam crossfade when trimmed and keep loopStart/loopEnd.
 *   line   mono; trim silence; fades; a radio band-pass for radio speakers; −15 LUFS momentary max.
 *   music  stereo; −16 LUFS integrated; loops cut to whole bars (intro + a phrase of bars) with an
 *          equal-power crossfade at the seam; loopStart/loopEnd in seconds.
 *
 *   npx tsx tools/audio/process.ts [--kind sfx|music|line] [--only id,...] [--force]
 *
 * Output: tmp/audio/cand/<kind>/<id>/take-<n>.mp3 (128 kbps) plus take-<n>.json (CandMeta).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrated, momentaryMax, peak } from './loudness';
import { candDir, items, paths, rawDir, readJson, selectItems, takesIn, type Item, type Kind, type Paths, type Spec } from './lib';
import type { LineSpec, MusicSpec, SfxSpec, VoiceSpec } from './spec-types';

export const FS = 44100;

export const FFMPEG = process.env.FFMPEG ?? (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

export function hasFfmpeg(): boolean {
  return spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status === 0;
}

/** Loudness targets in LUFS (sfx fall back to these when no synth version exists). */
export const TARGETS = {
  sfx: -20,
  sfxLoop: -22,
  line: -15,
  music: -16,
} as const;
const PEAK_CEILING = { sfx: 0.9, line: 0.9, music: 0.95 } as const;
const RADIO_FILTER = 'highpass=f=320,lowpass=f=3200,acompressor=threshold=-20dB:ratio=3:attack=5:release=80';

// ------------------------------------------------------------------------------------------ ffmpeg I/O

/** Decodes any audio file to `nch` float channels at 44.1 kHz, with an optional ffmpeg filter. */
export function decode(file: string, nch: 1 | 2, filter?: string): Float32Array[] {
  const args = ['-v', 'error', '-i', file];
  if (filter) args.push('-af', filter);
  args.push('-f', 'f32le', '-ac', String(nch), '-ar', String(FS), 'pipe:1');
  const r = spawnSync(FFMPEG, args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed for ${file}: ${r.stderr?.toString().trim()}`);
  const buf = r.stdout;
  const all = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength - (buf.byteLength % 4)));
  const frames = Math.floor(all.length / nch);
  const out = Array.from({ length: nch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < nch; c++) out[c][i] = all[i * nch + c];
  return out;
}

/** Encodes float channels to an MP3 (libmp3lame CBR 128 kbps). */
export function encodeMp3(channels: readonly Float32Array[], file: string): void {
  const nch = channels.length;
  const frames = channels[0]?.length ?? 0;
  const inter = new Float32Array(frames * nch);
  for (let i = 0; i < frames; i++) for (let c = 0; c < nch; c++) inter[i * nch + c] = channels[c][i];
  mkdirSync(dirname(file), { recursive: true });
  const r = spawnSync(
    FFMPEG,
    ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(FS), '-ac', String(nch), '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '128k', file],
    { input: Buffer.from(inter.buffer), maxBuffer: 1 << 26 },
  );
  if (r.status !== 0) throw new Error(`ffmpeg encode failed for ${file}: ${r.stderr?.toString().trim()}`);
}

// ------------------------------------------------------------------------------------------ DSP

const db = (v: number): number => Math.pow(10, v / 20);

/**
 * The [start, end) frame range that holds the sound: everything quieter than `relDb` below the
 * peak at either edge goes, apart from `preMs` before and `postMs` after.
 */
export function soundRange(ch: readonly Float32Array[], fs: number, relDb: number, preMs: number, postMs: number): [number, number] {
  const n = ch[0]?.length ?? 0;
  const thr = peak(ch) * db(relDb);
  if (thr <= 0) return [0, 0];
  const loud = (i: number): boolean => ch.some((c) => Math.abs(c[i]) > thr);
  let a = 0;
  while (a < n && !loud(a)) a++;
  let b = n - 1;
  while (b > a && !loud(b)) b--;
  return [Math.max(0, a - Math.round((preMs / 1000) * fs)), Math.min(n, b + 1 + Math.round((postMs / 1000) * fs))];
}

export function slice(ch: readonly Float32Array[], a: number, b: number): Float32Array[] {
  return ch.map((c) => c.slice(a, b));
}

/** Linear fade-in and fade-out in place (ms; 0 skips that side). */
export function fade(ch: Float32Array[], fs: number, inMs: number, outMs: number): void {
  for (const c of ch) {
    const fi = Math.min(c.length, Math.round((inMs / 1000) * fs));
    for (let i = 0; i < fi; i++) c[i] *= i / fi;
    const fo = Math.min(c.length, Math.round((outMs / 1000) * fs));
    for (let i = 0; i < fo; i++) c[c.length - 1 - i] *= i / fo;
  }
}

export function gain(ch: Float32Array[], g: number): void {
  for (const c of ch) for (let i = 0; i < c.length; i++) c[i] *= g;
}

/**
 * Loop seam: the audio that follows `loopEnd` is blended (equal power) into the head that follows
 * `loopStart`, then the file is cut at `loopEnd`. Playback that jumps from loopEnd back to
 * loopStart then hears the natural continuation fading into the head: no click, no gap.
 */
export function loopSeam(ch: readonly Float32Array[], loopStart: number, loopEnd: number, xf: number): Float32Array[] {
  const n = Math.max(0, Math.min(xf, (ch[0]?.length ?? 0) - loopEnd, loopEnd - loopStart));
  return ch.map((c) => {
    const o = c.slice(0, loopEnd);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      o[loopStart + i] = c[loopStart + i] * Math.sin((t * Math.PI) / 2) + c[loopEnd + i] * Math.cos((t * Math.PI) / 2);
    }
    return o;
  });
}

/**
 * Bar-aligned loop points for a song of `seconds`: the intro bars, then the longest run of whole
 * bars that still leaves `xf` seconds after it for the seam (rounded down to a 4-bar phrase when
 * there are 4 bars or more). Null when not even one bar fits.
 */
export function musicLoop(seconds: number, bpm: number, beatsPerBar: number, introBars: number, xf: number): { loopStart: number; loopEnd: number; bars: number } | null {
  const bar = (60 / bpm) * beatsPerBar;
  const loopStart = introBars * bar;
  let bars = Math.floor((seconds - loopStart - xf + 1e-9) / bar);
  if (bars < 1) return null;
  if (bars >= 4) bars -= bars % 4;
  return { loopStart, loopEnd: loopStart + bars * bar, bars };
}

// ------------------------------------------------------------------------------------------ one take

export interface CandMeta {
  kind: Kind;
  id: string;
  take: number;
  duration: number;
  channels: number;
  /** Measured after processing: momentary max (sfx, line) or integrated (music), LUFS. */
  lufs: number;
  target: number;
  gainDb: number;
  peak: number;
  loopStart: number | null;
  loopEnd: number | null;
  rawDuration: number;
  warnings: string[];
  processedAt: string;
}

export interface TakeOptions {
  /** Loudness target override (sfx: the synth level of the same id). */
  target?: number;
  /** Radio band-pass for lines of a radio speaker. */
  radio?: boolean;
}

const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d;

/** Processes one raw take into a candidate MP3 and returns (and writes) its meta. */
export function processTake(kind: Exclude<Kind, 'voice'>, id: string, spec: SfxSpec | MusicSpec | LineSpec, take: number, rawFile: string, outFile: string, opts: TakeOptions = {}): CandMeta {
  const warnings: string[] = [];
  let ch: Float32Array[];
  let loopStart: number | null = null;
  let loopEnd: number | null = null;
  let rawDuration: number;
  let target: number;

  if (kind === 'music') {
    const m = spec as MusicSpec;
    ch = decode(rawFile, 2);
    rawDuration = (ch[0]?.length ?? 0) / FS;
    const [a, b] = soundRange(ch, FS, -50, 0, 300);
    ch = slice(ch, a, m.loop ? ch[0].length : b);
    const bar = (60 / m.bpm) * m.beatsPerBar;
    const xf = Math.min(0.2, bar / 4);
    const lp = m.loop ? musicLoop(ch[0].length / FS, m.bpm, m.beatsPerBar, m.introBars ?? 0, xf) : null;
    if (m.loop && !lp) warnings.push('too short for a bar-aligned loop; shipped as a one-shot');
    if (lp) {
      const ls = Math.round(lp.loopStart * FS);
      const le = Math.round(lp.loopEnd * FS);
      ch = loopSeam(ch, ls, le, Math.round(xf * FS));
      if (ls > 0) fade(ch, FS, 5, 0);
      loopStart = ls / FS;
      loopEnd = le / FS;
    } else fade(ch, FS, 5, 50);
    target = opts.target ?? TARGETS.music;
  } else if (kind === 'sfx') {
    const s = spec as SfxSpec;
    ch = decode(rawFile, 1);
    rawDuration = (ch[0]?.length ?? 0) / FS;
    if (s.loop) {
      const want = s.trimTo !== undefined ? Math.round(s.trimTo * FS) : ch[0].length;
      if (want < ch[0].length) ch = loopSeam(ch, 0, want, Math.round(Math.min(0.1, want / FS / 8) * FS));
      loopStart = 0;
      loopEnd = ch[0].length / FS;
    } else {
      const [a, b] = soundRange(ch, FS, -50, 5, 30);
      ch = slice(ch, a, b);
      let outMs = 20;
      if (s.trimTo !== undefined && ch[0].length > s.trimTo * FS) {
        ch = slice(ch, 0, Math.round(s.trimTo * FS));
        outMs = Math.max(20, Math.min(80, s.trimTo * 150));
      }
      fade(ch, FS, 3, outMs);
    }
    target = opts.target ?? (s.loop ? TARGETS.sfxLoop : TARGETS.sfx);
  } else {
    const l = spec as LineSpec;
    ch = decode(rawFile, 1, opts.radio ? RADIO_FILTER : undefined);
    rawDuration = (ch[0]?.length ?? 0) / FS;
    const [a, b] = soundRange(ch, FS, -40, 20, 60);
    ch = slice(ch, a, b);
    fade(ch, FS, 10, 40);
    target = opts.target ?? TARGETS.line;
    if (l.maxSeconds !== undefined && ch[0].length / FS > l.maxSeconds) warnings.push(`longer than maxSeconds ${l.maxSeconds} s`);
  }

  if ((ch[0]?.length ?? 0) === 0) throw new Error(`${kind} ${id} take ${take}: silent after trimming`);
  // A loop is measured as it plays (two cycles), like the synth loudness plan.
  const measure = (c: Float32Array[]): number => {
    if (kind === 'music') return integrated(c, FS);
    if (loopEnd !== null) return momentaryMax(c.map((x) => { const o = new Float32Array(x.length * 2); o.set(x); o.set(x, x.length); return o; }), FS);
    return momentaryMax(c, FS);
  };
  const before = measure(ch);
  const ceiling = PEAK_CEILING[kind];
  let g = Number.isFinite(before) ? db(target - before) : 1;
  const pk = peak(ch);
  if (pk * g > ceiling) {
    g = ceiling / pk;
    warnings.push(`peak-limited: ${round(target - (before + 20 * Math.log10(g)), 1)} LU under target`);
  }
  if (Math.abs(20 * Math.log10(g)) > 18) warnings.push(`large gain ${round(20 * Math.log10(g), 1)} dB`);
  gain(ch, g);

  encodeMp3(ch, outFile);
  const meta: CandMeta = {
    kind,
    id,
    take,
    duration: round(ch[0].length / FS, 4),
    channels: ch.length,
    lufs: round(measure(ch), 1),
    target,
    gainDb: round(20 * Math.log10(g), 1),
    peak: round(peak(ch)),
    loopStart: loopStart === null ? null : round(loopStart, 6),
    loopEnd: loopEnd === null ? null : round(loopEnd, 6),
    rawDuration: round(rawDuration, 3),
    warnings,
    processedAt: new Date().toISOString(),
  };
  writeFileSync(outFile.replace(/\.mp3$/, '.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

// ------------------------------------------------------------------------------------------ synth levels

/**
 * The momentary-max loudness of the synth version of each sfx id (cached in
 * tmp/audio/cand/synth-levels.json). Loads the game content to render the recipes.
 */
export async function synthLevels(p: Paths, ids: readonly string[]): Promise<Record<string, number>> {
  const file = join(p.cand, 'synth-levels.json');
  const cache = readJson<Record<string, number>>(file, {});
  const missing = ids.filter((id) => !(id in cache));
  if (missing.length) {
    const { loadContent } = await import('../../src/game/content/index');
    const synth = await import('../../src/engine/synth');
    await loadContent();
    for (const id of missing) {
      const s = synth.hasSfx(id) ? synth.renderSfx(id) : null;
      if (!s) continue;
      const played = synth.sfxIsLoop(id) ? (() => { const o = new Float32Array(s.length * 2); o.set(s); o.set(s, s.length); return o; })() : s;
      cache[id] = round(momentaryMax([played], synth.SAMPLE_RATE), 2);
    }
    mkdirSync(p.cand, { recursive: true });
    writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
  }
  return cache;
}

// ------------------------------------------------------------------------------------------ batch

export interface ProcessOptions {
  force?: boolean;
  /** Synth loudness per sfx id (see synthLevels). */
  levels?: Record<string, number>;
  log?: (line: string) => void;
}

export function processItems(list: readonly Item[], spec: Spec, p: Paths, opts: ProcessOptions = {}): { done: number; skipped: number; failed: number } {
  const log = opts.log ?? ((s: string) => console.log(s));
  const radio = new Set(spec.VOICES.filter((v: VoiceSpec) => v.radio).map((v) => v.speaker));
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const it of list) {
    if (it.kind === 'voice') continue;
    const rdir = rawDir(p, it.kind, it.id);
    const cdir = candDir(p, it.kind, it.id);
    for (const n of takesIn(rdir)) {
      const raw = join(rdir, `take-${n}.mp3`);
      const out = join(cdir, `take-${n}.mp3`);
      if (!opts.force && existsSync(out) && existsSync(out.replace(/\.mp3$/, '.json')) && statSync(out).mtimeMs >= statSync(raw).mtimeMs) {
        skipped++;
        continue;
      }
      try {
        const synth = it.kind === 'sfx' ? opts.levels?.[it.id] : undefined;
        const target = synth !== undefined && Number.isFinite(synth) ? Math.max(-30, Math.min(-9, synth)) : undefined;
        const radioLine = it.kind === 'line' && radio.has((it.spec as LineSpec).speaker);
        const m = processTake(it.kind, it.id, it.spec as SfxSpec | MusicSpec | LineSpec, n, raw, out, { target, radio: radioLine });
        done++;
        const loop = m.loopEnd !== null ? `  loop ${m.loopStart}–${m.loopEnd}` : '';
        log(`  ${it.kind.padEnd(5)} ${it.id.slice(0, 40).padEnd(40)} take ${n}  ${m.duration.toFixed(2)} s  ${m.lufs} LUFS (target ${m.target})${loop}${m.warnings.length ? `  ! ${m.warnings.join('; ')}` : ''}`);
      } catch (err) {
        failed++;
        log(`  FAIL ${it.kind} ${it.id} take ${n}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return { done, skipped, failed };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let kinds: Kind[] | null = null;
  let only: string[] | null = null;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kind') kinds = (argv[++i] ?? '').split(',').map((k) => (k === 'lines' ? 'line' : k) as Kind);
    else if (argv[i] === '--only') only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (argv[i] === '--force') force = true;
  }
  if (!hasFfmpeg()) throw new Error(`ffmpeg not found (${FFMPEG})`);
  const m = (await import('./spec')) as unknown as Spec;
  const spec: Spec = { SFX: m.SFX ?? [], MUSIC: m.MUSIC ?? [], VOICES: m.VOICES ?? [], LINES: m.LINES ?? [] };
  const p = paths();
  const list = selectItems(items(spec), kinds, only);
  const levels = await synthLevels(p, list.filter((it) => it.kind === 'sfx').map((it) => it.id));
  const r = processItems(list, spec, p, { force, levels });
  console.log(`\nprocessed ${r.done}, up to date ${r.skipped}, failed ${r.failed}  → tmp/audio/cand/`);
  if (r.failed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

