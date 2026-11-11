// Dump the layout of one mission (terrain, decor with sprite boxes, floor camera, rows, features, background) as JSON
// for the level kit (tools/levelkit/README.md). The kit paints from this file; it is derived from the game, so it is
// generated (git-ignored), never edited: re-run the dump after a section, a decor item or a game sprite changes.
//
//   npx tsx tools/levelkit/dump.ts <mission> [--out <file>] [--prefix <sprite id prefix> ...]
//
// --out     default tools/levelkit/work/<mission>/layout.json (where the kit reads it)
// --prefix  the sprite ids whose 1× frame geometry the canal bake checks a kit sprite against (bake_game.py
//           `sprites()`, docs/api/canal.md §7): every id under these prefixes. Default: decor/<mission>/,
//           npc/<mission>/, vehicle/. Repeat the flag for several prefixes (they replace the default).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../../src/game/content/index';
import { getMission, listMissions } from '../../src/game/registry';
import { getFrame, getFrames, frameCount, listSprites } from '../../src/engine/sprites';

function parseArgs(argv: string[]): { mission: string; out: string | null; prefixes: string[] } {
  let mission = '';
  let out: string | null = null;
  const prefixes: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out = argv[++i] ?? null;
    else if (a === '--prefix') prefixes.push(argv[++i] ?? '');
    else if (!a.startsWith('--') && !mission) mission = a;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!mission) throw new Error('usage: npx tsx tools/levelkit/dump.ts <mission> [--out <file>] [--prefix <sprite id prefix> ...]');
  return { mission, out, prefixes };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await loadContent();
  const m = getMission(args.mission);
  if (!m) throw new Error(`no mission ${args.mission} (missions: ${listMissions().join(', ')})`);
  const prefixes = args.prefixes.length ? args.prefixes : [`decor/${args.mission}/`, `npc/${args.mission}/`, 'vehicle/'];
  const here = dirname(fileURLToPath(import.meta.url));
  const file = args.out ? resolve(args.out) : resolve(here, 'work', args.mission, 'layout.json');
  const out: Record<string, unknown> = {};
  for (const [id, s] of Object.entries(m.sections)) {
    const decor = (s.decor ?? []).map((d, i) => {
      let box: unknown = null;
      try {
        const f = getFrame(d.sprite, d.frame ?? 0, 1);
        box = { w: f.buf.w, h: f.buf.h, ox: f.ox, oy: f.oy, n: frameCount(d.sprite) };
      } catch (e) { box = String(e); }
      const fd = s.floor?.decorDepth?.(d, i);
      return { i, ...d, box, floorDepth: d.depth !== undefined ? d.depth : fd === undefined ? (d.front ? 0 : s.floor?.defaultDepth ?? 0) : fd };
    });
    const fl = s.floor;
    out[id] = {
      width: s.width, height: s.height, playerStart: s.playerStart, checkpoints: s.checkpoints,
      background: s.background,
      terrain: s.terrain,
      exits: s.exits,
      floor: fl ? {
        camera: fl.camera, painter: fl.painter, features: fl.features, rows: fl.rows,
        overhangs: fl.overhangs, tops: fl.tops, openings: fl.openings,
        faces: fl.faces?.map((f) => ({ ...f })), hideDecor: fl.hideDecor, defaultDepth: fl.defaultDepth, keepClear: fl.keepClear,
      } : null,
      decor,
    };
  }
  // The game's 1× frames of the ids a canal sprite may replace: per id the frame list (w, h, ox, oy:
  // logical px; the bake refuses a kit sprite whose box differs). Not a section: read as LAY['sprites'].
  const sprites: Record<string, Array<{ w: number; h: number; ox: number; oy: number }>> = {};
  for (const pre of prefixes) {
    for (const id of listSprites(pre)) {
      try {
        sprites[id] = getFrames(id, 1).map((f) => ({ w: f.buf.w, h: f.buf.h, ox: f.ox, oy: f.oy }));
      } catch {
        // a generator that throws: the id cannot be replaced
      }
    }
  }
  out.sprites = sprites;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, (_k, v: unknown) => (typeof v === 'function' ? '[fn]' : v), 1));
  console.log(Object.keys(out).filter((k) => k !== 'sprites').map((k) => `${k}: ${(out[k] as { decor: unknown[] }).decor.length} decor`).join('\n'));
  console.log(`sprites: ${Object.keys(sprites).length} ids (${prefixes.join(', ')})`);
  console.log(`wrote ${file}`);
}
main().catch((e: unknown) => { console.error(e); process.exit(1); });
