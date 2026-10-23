/**
 * Determinism of the race (docs/design/rally.md §12.4): THE SCAN — a whitelist of the Math members
 * the sim folders may use (only + − × ÷, sqrt, floor, ceil, round, trunc, abs, sign, min, max, imul
 * and the constant PI; the trig through the r3 tables), no `**`, no clocks (Date, performance), no
 * crypto — and the same seed twice giving the same race.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RallyBot } from '../../../src/sim/bot-rally';
import { race, ringTrack } from './helpers';

const ROOT = join(import.meta.dirname, '../../..');
const DIRS = ['src/game/rally', 'src/engine/r3', 'src/game/content/rally'];
/** Sim code outside those folders: the bot's math reaches the stateHash, the race input turns every input into the sim's numbers. */
const FILES = ['src/sim/bot-rally.ts', 'src/sim/headless-rally.ts', 'src/engine/race-input.ts'];
const ALLOWED = new Set(['sqrt', 'floor', 'ceil', 'round', 'trunc', 'abs', 'sign', 'min', 'max', 'imul', 'PI']);

function files(dir: string): string[] {
  if (dir.endsWith('.ts')) return [dir];
  return readdirSync(join(ROOT, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(ROOT, p)).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** The code of a file without its comments and strings (lines marked `determinism-ok` dropped). */
function code(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('determinism-ok'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

/** The banned uses in a file's code (after `code()`). */
function scan(f: string, c: string): string[] {
  const bad: string[] = [];
  for (const m of c.matchAll(/\bMath\.([A-Za-z0-9_$]+)/g)) if (!ALLOWED.has(m[1])) bad.push(`${f}: Math.${m[1]}`);
  if (/\bMath\s*\[/.test(c)) bad.push(`${f}: Math[…]`);
  // An alias (`const M = Math`, `const { sin } = Math`, `f(Math)`) would hide a banned member.
  if (/\bMath\b(?!\s*[.[])/.test(c)) bad.push(`${f}: Math alias`);
  if (/\*\*/.test(c)) bad.push(`${f}: **`);
  for (const m of c.matchAll(/\b(Date|performance|crypto|setTimeout|setInterval|requestAnimationFrame)\b/g)) bad.push(`${f}: ${m[1]}`);
  return bad;
}

describe('THE SCAN (spec §12.4): the sim folders use only deterministic arithmetic', () => {
  it.each([...DIRS, ...FILES])('%s: Math members on the whitelist, no alias, no **, no clocks, no crypto', (dir) => {
    const list = files(dir);
    expect(list.length).toBeGreaterThan(0);
    const bad: string[] = [];
    for (const f of list) bad.push(...scan(f, code(f)));
    expect(bad).toEqual([]);
  });

  it('the alias check finds a hidden Math (a self-check)', () => {
    expect(scan('x', 'const M = Math; M.sin(1);')).toEqual(['x: Math alias']);
    expect(scan('x', 'const { sin } = Math;')).toEqual(['x: Math alias']);
    expect(scan('x', 'Math.sqrt(2) + Math.floor(1.5);')).toEqual([]);
  });

  it('the scan finds what it must (a self-check on a sample)', () => {
    const sample = "const a = Math.hypot(1, 2); // Math.sin in a comment\nconst b = x ** 2; const s = 'Math.random';\nconst t = Date.now();";
    const c = sample.replace(/\/\/[^\n]*/g, ' ').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
    expect([...c.matchAll(/\bMath\.([A-Za-z0-9_$]+)/g)].map((m) => m[1])).toEqual(['hypot']);
    expect(/\*\*/.test(c)).toBe(true);
    expect(/\bDate\b/.test(c)).toBe(true);
  });
});

describe('the same seed → the same race', () => {
  const play = (players: 1 | 2, difficulty: 'easy' | 'normal' | 'hard', ticks: number): { hash: number; report: string } => {
    const h = race({ track: ringTrack(), players, difficulty, seed: 9 });
    h.input.addSource(new RallyBot(() => h.runner));
    h.step(ticks);
    const { stateHash, ...rest } = h.runner.report();
    return { hash: stateHash, report: JSON.stringify(rest) };
  };

  it.each([
    [1, 'normal'],
    [2, 'hard'],
    [1, 'easy'],
  ] as const)('%iP %s: bit-identical twice', (players, difficulty) => {
    const a = play(players, difficulty, 6000);
    const b = play(players, difficulty, 6000);
    expect(a.hash).toBe(b.hash);
    expect(a.report).toBe(b.report);
  });

  it('the hash moves with the race (it covers the cars)', () => {
    expect(play(1, 'normal', 3000).hash).not.toBe(play(1, 'normal', 3001).hash);
  });
});
