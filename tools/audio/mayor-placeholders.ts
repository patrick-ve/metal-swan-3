/**
 * Writes a placeholder clip for every ROBO-HALSEMA line that has no file yet
 * (src/game/content/bosses/ams/voice.ts → public/audio/mayor/<voiceKey>.mp3):
 *
 *   npm run audio:mayor-placeholders [-- --dry-run] [-- --force]
 *
 * A placeholder is a wordless robot warble as long as the line takes to say, pitched a little
 * differently per line so the lines are easy to tell apart. Existing files are kept (they may be
 * the final recordings); `--force` rewrites only files that are still placeholders (marked by
 * their `comment=placeholder` tag).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAYOR_LINES, type MayorLine } from '../../src/game/content/bosses/ams/voice';
import { FFMPEG } from './process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_AUDIO = join(ROOT, 'public/audio');
/** The metadata tag that marks a generated placeholder (never set on a real recording). */
export const PLACEHOLDER_TAG = 'placeholder';

/** The ffmpeg arguments of one placeholder: a warble at `base` Hz lasting `seconds`. */
export function placeholderArgs(out: string, seconds: number, base: number): string[] {
  const d = seconds.toFixed(2);
  const fade = Math.max(0, seconds - 0.15).toFixed(2);
  // A wobbling sine (syllable-rate tremolo, a pitch wobble) with a soft attack and decay.
  const expr = `0.35*sin(2*PI*t*(${base}+${Math.round(base * 0.35)}*sin(2*PI*7*t)))*(0.5+0.5*sin(2*PI*9*t))*(1-exp(-40*t))`;
  return [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${d}`,
    '-af', `afade=t=out:st=${fade}:d=0.15`,
    '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k',
    '-metadata', `comment=${PLACEHOLDER_TAG}`,
    out,
  ];
}

/** True when an existing file carries the placeholder tag. */
function isPlaceholder(file: string): boolean {
  const r = spawnSync(FFMPEG.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'format_tags=comment', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === PLACEHOLDER_TAG;
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const lines = Object.values(MAYOR_LINES) as MayorLine[];
  let written = 0;
  lines.forEach((l, i) => {
    const out = join(PUBLIC_AUDIO, l.file);
    const rel = relative(ROOT, out);
    if (existsSync(out) && !(force && isPlaceholder(out))) {
      console.log(`  keep   ${rel}`);
      return;
    }
    console.log(`  write  ${rel}  (${l.duration.toFixed(1)} s)`);
    written++;
    if (dryRun) return;
    mkdirSync(dirname(out), { recursive: true });
    const r = spawnSync(FFMPEG, placeholderArgs(out, l.duration, 440 + i * 30), { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${rel}`);
  });
  console.log(`${dryRun ? 'dry run: ' : ''}${written} written, ${lines.length - written} kept`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
