/**
 * Audio report — nobody on the team can listen, so this prints the numbers that catch broken
 * sounds (silent, too hot, too long, DC offset) and can write WAV files for a human.
 *
 *   npx tsx tools/lib/audio-report.ts [prefix] [--wav] [--songs] [--seconds 30] [--out tmp/audio]
 *
 * Sound effects render in node (pure TS synth). With --songs every song also renders for
 * `--seconds` through the real Web Audio instrument graph in headless Chromium (Playwright).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSongs, songError } from '../../src/engine/music';
import { listSfx, renderSfx, SAMPLE_RATE } from '../../src/engine/synth';
import { loadContent } from '../../src/game/content/index';
import type { AudioStats } from './wav';
import { audioStats, encodeWAV } from './wav';

interface Args {
  prefix: string;
  wav: boolean;
  songs: boolean;
  seconds: number;
  out: string;
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { prefix: '', wav: false, songs: false, seconds: 30, out: 'tmp/audio' };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--wav') a.wav = true;
    else if (s === '--songs') a.songs = true;
    else if (s === '--seconds') a.seconds = Math.max(1, Number(argv[++i]) || 30);
    else if (s === '--out') a.out = argv[++i] ?? a.out;
    else if (!s.startsWith('--')) a.prefix = s;
  }
  return a;
}

function flags(s: AudioStats, isSong: boolean): string {
  const f: string[] = [];
  if (s.peak < 0.01) f.push('SILENT');
  if (s.peak >= (isSong ? 1 : 0.97)) f.push('HOT');
  if (!isSong && s.duration > 4) f.push('LONG');
  if (Math.abs(s.dc) > 0.02) f.push('DC');
  return f.join(' ');
}

function row(id: string, s: AudioStats, isSong: boolean): string {
  const db = Number.isFinite(s.rmsDb) ? s.rmsDb.toFixed(1) : '-inf';
  return [
    id.padEnd(28),
    `${s.duration.toFixed(2)}s`.padStart(7),
    s.peak.toFixed(2).padStart(6),
    `${db}dB`.padStart(8),
    `${(s.attack * 1000).toFixed(0)}ms`.padStart(7),
    `${s.audible.toFixed(2)}s`.padStart(7),
    `${Math.round(s.zcrHz)}Hz`.padStart(8),
    `  ${flags(s, isSong)}`,
  ].join(' ');
}

const HEADER = `${'id'.padEnd(28)} ${'length'.padStart(7)} ${'peak'.padStart(6)} ${'rms'.padStart(8)} ${'attack'.padStart(7)} ${'audible'.padStart(7)} ${'zcr'.padStart(8)}  flags`;

function save(file: string, channels: Float32Array[], rate: number): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodeWAV(channels, rate));
}

async function renderSongs(args: Args): Promise<void> {
  const { chromium } = await import('playwright');
  const { build } = await import('vite');
  const entry = fileURLToPath(new URL('./audio-report.entry.ts', import.meta.url));
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, name: 'AudioReportBundle', formats: ['iife'], fileName: 'audio-report' } },
  });
  let code = '';
  for (const o of Array.isArray(out) ? out : [out]) {
    if ('output' in o) for (const c of o.output) if (c.type === 'chunk') code = c.code;
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('console', (m) => {
      if (m.type() === 'warning' || m.type() === 'error') console.log(`  [browser] ${m.text()}`);
    });
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code });
    type Api = {
      load(): Promise<string[]>;
      render(id: string, s: number): Promise<{ rate: number; channels: string[] } | null>;
    };
    const ids = (await page.evaluate(() => (window as unknown as { AudioReport: Api }).AudioReport.load())).filter((id) =>
      id.startsWith(args.prefix),
    );
    console.log(`\nSONGS (${ids.length}, first ${args.seconds}s through Web Audio)\n${HEADER}`);
    for (const id of ids) {
      const r = await page.evaluate(
        ([songId, secs]) => (window as unknown as { AudioReport: Api }).AudioReport.render(songId, secs),
        [id, args.seconds] as const,
      );
      if (!r) {
        console.log(`${id.padEnd(28)} not playable: ${songError(id) ?? 'unknown'}`);
        continue;
      }
      const channels = r.channels.map((b64) => {
        const bytes = Buffer.from(b64, 'base64');
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      });
      // Stats on the louder of the two channels.
      const stats = channels.map((c) => audioStats(c, r.rate)).sort((a, b) => b.peak - a.peak)[0];
      console.log(row(id, stats, true));
      if (args.wav) save(join(args.out, 'music', `${id.replace(/\//g, '_')}.wav`), channels, r.rate);
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // Every module, the lazy first-person content too (docs/design/fps.md §3.6): else the fps sounds
  // are silently skipped.
  const report = await loadContent(() => true);
  for (const f of report.failed) console.error(`module ${f.id} failed to load:\n${f.error}`);

  const sfx = listSfx(args.prefix);
  console.log(`SOUND EFFECTS (${sfx.length})\n${HEADER}`);
  let problems = 0;
  for (const id of sfx) {
    const s = renderSfx(id);
    if (!s) continue;
    const st = audioStats(s, SAMPLE_RATE);
    if (flags(st, false)) problems++;
    console.log(row(id, st, false));
    if (args.wav) save(join(args.out, 'sfx', `${id.replace(/\//g, '_')}.wav`), [s], SAMPLE_RATE);
  }

  const bad = listSongs(args.prefix).filter((id) => songError(id));
  for (const id of bad) console.log(`song ${id}: ${songError(id)}`);
  problems += bad.length;
  if (args.songs) await renderSongs(args);
  else console.log(`\n${listSongs(args.prefix).length} songs defined (add --songs to render them in Chromium)`);
  if (args.wav) console.log(`\nWAV files → ${args.out}/`);
  if (problems > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
