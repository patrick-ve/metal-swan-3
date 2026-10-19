/**
 * npm run geometry-fixture -- <ids...> [--dry-run]
 *
 * Rewrites ONLY the named ids in tests/engine/fixtures/sprite-geometry.json with their current
 * geometry digest (spriteGeometrySample, tests/engine/hires-sample.ts: size, anchor and points of
 * every frame). For a sprite whose geometry changed on purpose. An id that is not registered is an
 * error; an id not yet in the fixture is added. --dry-run prints the diff and writes nothing.
 * Only verifiers run it without --dry-run (one writer at a time).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { hasSprite } from '../src/engine/sprites';
import { loadContent } from '../src/game/content/index';
import { spriteGeometrySample } from '../tests/engine/hires-sample';

const FIXTURE = new URL('../tests/engine/fixtures/sprite-geometry.json', import.meta.url);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const ids = argv.filter((a) => !a.startsWith('--'));
  if (ids.length === 0) {
    console.error('usage: npm run geometry-fixture -- <ids...> [--dry-run]');
    process.exit(2);
  }
  await loadContent();
  const missing = ids.filter((id) => !hasSprite(id));
  if (missing.length) {
    console.error(`not registered: ${missing.join(', ')}`);
    process.exit(1);
  }
  const text = readFileSync(FIXTURE, 'utf8');
  const want = JSON.parse(text) as Record<string, string>;
  const got = spriteGeometrySample(ids);
  let changed = 0;
  for (const id of ids) {
    if (want[id] === got[id]) {
      console.log(`  ${id}: unchanged`);
      continue;
    }
    changed++;
    console.log(`~ ${id}${id in want ? '' : ' (new)'}`);
    if (id in want) console.log(`  - ${want[id]}`);
    console.log(`  + ${got[id]}`);
    want[id] = got[id];
  }
  if (dry || changed === 0) {
    console.log(dry ? `dry run: ${changed} id(s) would change` : 'nothing to change');
    return;
  }
  const out: Record<string, string> = {};
  for (const k of Object.keys(want).sort()) out[k] = want[k];
  // The fixture's own format: one id per line, sorted.
  const lines = Object.keys(out).map((k) => `${JSON.stringify(k)}:${JSON.stringify(out[k])}`);
  writeFileSync(FIXTURE, `{${lines.join(',\n')}}\n`);
  console.log(`wrote ${changed} id(s)`);
}

void main();
