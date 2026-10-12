/**
 * npm run sprites -- [prefix] [--marks] [--scale 3] [--palette] [--out tmp/sprites]
 *
 * Loads every art module from the content manifest, generates all registered sprites (or those
 * whose id starts with `prefix`) and writes one labelled contact sheet per top-level group to
 * tmp/sprites/<group>.png (split into <group>-2.png … when tall). --marks shows anchors (cyan)
 * and named points (magenta). --palette writes tmp/sprites/palette.png.
 * Demo sprites ('demo/…') are registered here so the tool works before any content exists.
 */
import { join } from 'node:path';
import { defineSprite, getFrames, listSprites, spriteErrors } from '../src/engine/sprites';
import { loadContent, ART_MODULE_IDS } from '../src/game/content/index';
import { defineArtDemos } from '../src/game/art/demo-art';
import { defineMachineDemos } from '../src/game/art/machines';
import { composeSheets, savePNG } from './lib/image';
import { registerDemoSprites, paletteSheet } from './lib/demo';

interface Args {
  prefix: string;
  marks: boolean;
  scale: number;
  palette: boolean;
  out: string;
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { prefix: '', marks: false, scale: 3, palette: false, out: 'tmp/sprites' };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--marks') a.marks = true;
    else if (s === '--palette') a.palette = true;
    else if (s === '--scale') a.scale = Math.max(1, Number(argv[++i]) || 3);
    else if (s === '--out') a.out = argv[++i] ?? a.out;
    else if (s === '--help' || s === '-h') {
      console.log('usage: npm run sprites -- [prefix] [--marks] [--scale 3] [--palette] [--out dir]');
      process.exit(0);
    } else if (!s.startsWith('--')) a.prefix = s;
    else console.warn(`unknown option ${s}`);
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const t0 = process.hrtime.bigint();

  if (args.palette) {
    const file = join(args.out, 'palette.png');
    savePNG(paletteSheet(), file, args.scale);
    console.log(`palette → ${file}`);
    if (!args.prefix) return;
  }

  // 'demo/broken' shows how generation errors look; only on explicit request.
  registerDemoSprites(defineSprite, args.prefix === 'demo/broken');
  // The art rigs' sample sheets (not used by the game).
  defineMachineDemos();
  defineArtDemos();
  const report = await loadContent((id) => ART_MODULE_IDS.includes(id));
  for (const f of report.failed) console.error(`module ${f.id} failed to load:\n${f.error}`);

  const ids = listSprites(args.prefix);
  if (ids.length === 0) {
    console.log(`no sprites match "${args.prefix}"`);
    return;
  }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const g = id.split('/')[0] || id;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)?.push(id);
  }

  let frameTotal = 0;
  for (const [group, list] of groups) {
    const generated = list.map((id) => ({ id, frames: getFrames(id) }));
    const errs = new Map(spriteErrors().map((e) => [e.id, e.error]));
    const items = generated.map((g) => ({ ...g, error: errs.get(g.id) ?? null }));
    for (const g of generated) frameTotal += g.frames.length;
    const pages = composeSheets(items, { title: group, marks: args.marks });
    pages.forEach((page, i) => {
      const file = join(args.out, `${group.replace(/[^a-z0-9_-]/gi, '_')}${i === 0 ? '' : `-${i + 1}`}.png`);
      savePNG(page, file, args.scale);
      console.log(`${group}: ${list.length} sprites → ${file}${pages.length > 1 ? ` (page ${i + 1}/${pages.length})` : ''}`);
    });
  }

  const errors = spriteErrors();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`${ids.length} sprites, ${frameTotal} frames, ${groups.size} groups in ${ms.toFixed(0)} ms`);
  if (errors.length > 0) {
    console.error(`${errors.length} generation error(s):`);
    for (const e of errors) console.error(`  ${e.id}: ${e.error}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
