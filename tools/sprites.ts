/**
 * npm run sprites -- [prefix] [--marks] [--scale 3] [--palette] [--density 2] [--out tmp/sprites]
 *
 * Loads every art module from the content manifest, generates all registered sprites (or those
 * whose id starts with `prefix`) and writes one labelled contact sheet per top-level group to
 * tmp/sprites/<group>.png (split into <group>-2.png … when tall). --marks shows anchors (cyan)
 * and named points (magenta). --palette writes tmp/sprites/palette.png.
 * Demo sprites ('demo/…') are registered here so the tool works before any content exists.
 * --density 2 draws the 2× frames (docs/ART_GUIDE.md "2x art (mission ams)") at 2 sheet px per
 * logical px, only for the ids that have a 2× generator (add --all for every id, 1× ones
 * enlarged); marks then cover the whole logical pixel, so they sit where the game reads the
 * points. The default --scale is 2 then. Sheets go to <out>/<group>@2x.png.
 * --ray (docs/design/fps.md §10): loads every content module (the lazy fps ones too) and draws
 * the raycaster textures and billboards whose id starts with `prefix` instead: one row per
 * texture group (`ray-tex-<group>.png`), one row per billboard yaw (`ray-bb-<group>.png`, every
 * frame of a yaw in a row; yaws 5–7 are the registry's mirrors).
 */
import { join } from 'node:path';
import { defineSprite, getFrames, hasHiSprite, listSprites, spriteErrors } from '../src/engine/sprites';
import { loadContent, ART_MODULE_IDS } from '../src/game/content/index';
import { defineArtDemos } from '../src/game/art/demo-art';
import { defineMachineDemos } from '../src/game/art/machines';
import { composeSheets, savePNG, type SheetItem } from './lib/image';
import { PixelBuffer } from '../src/engine/pixel';
import {
  billboardColumns,
  getRayBillboard,
  listRayBillboards,
  listRayTextures,
  RAY_TEX,
  rayTextureColumns,
  rayTextureIndex,
} from '../src/engine/ray';
import { registerDemoSprites, paletteSheet } from './lib/demo';

interface Args {
  prefix: string;
  marks: boolean;
  scale: number;
  palette: boolean;
  out: string;
  density: number;
  all: boolean;
  ray: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { prefix: '', marks: false, scale: 0, palette: false, out: 'tmp/sprites', density: 1, all: false, ray: false };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--marks') a.marks = true;
    else if (s === '--palette') a.palette = true;
    else if (s === '--scale') a.scale = Math.max(1, Number(argv[++i]) || 3);
    else if (s === '--density') a.density = Number(argv[++i]) >= 2 ? 2 : 1;
    else if (s === '--all') a.all = true;
    else if (s === '--ray') a.ray = true;
    else if (s === '--out') a.out = argv[++i] ?? a.out;
    else if (s === '--help' || s === '-h') {
      console.log('usage: npm run sprites -- [prefix] [--ray] [--marks] [--scale 3] [--palette] [--density 2 [--all]] [--out dir]');
      process.exit(0);
    } else if (!s.startsWith('--')) a.prefix = s;
    else console.warn(`unknown option ${s}`);
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.scale === 0) args.scale = args.density > 1 ? 2 : 3;
  const t0 = process.hrtime.bigint();

  if (args.palette) {
    const file = join(args.out, 'palette.png');
    savePNG(paletteSheet(), file, args.scale);
    console.log(`palette → ${file}`);
    if (!args.prefix) return;
  }

  if (args.ray) {
    await raySheets(args);
    return;
  }

  // 'demo/broken' shows how generation errors look; only on explicit request.
  registerDemoSprites(defineSprite, args.prefix === 'demo/broken');
  // The art rigs' sample sheets (not used by the game).
  defineMachineDemos();
  defineArtDemos();
  const report = await loadContent((id) => ART_MODULE_IDS.includes(id));
  for (const f of report.failed) console.error(`module ${f.id} failed to load:\n${f.error}`);

  const hi = args.density > 1;
  const ids = listSprites(args.prefix).filter((id) => !hi || args.all || hasHiSprite(id));
  if (ids.length === 0) {
    console.log(`no sprites match "${args.prefix}"${hi && !args.all ? ' with 2× art (--all lists every id)' : ''}`);
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
    const generated = list.map((id) => ({ id, frames: getFrames(id, args.density) }));
    const errs = new Map(spriteErrors().map((e) => [e.id, e.error]));
    const items = generated.map((g) => ({ ...g, error: errs.get(hi ? `${g.id}@2x` : g.id) ?? errs.get(g.id) ?? null }));
    for (const g of generated) frameTotal += g.frames.length;
    const pages = composeSheets(items, { title: hi ? `${group} @2x` : group, marks: args.marks, density: args.density, width: 640 * args.density, maxHeight: 720 * args.density });
    pages.forEach((page, i) => {
      const file = join(args.out, `${group.replace(/[^a-z0-9_-]/gi, '_')}${hi ? '@2x' : ''}${i === 0 ? '' : `-${i + 1}`}.png`);
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

/** A column-major size × size block back to a row-major PixelBuffer. */
function fromColumns(cols: Uint32Array, size: number): PixelBuffer {
  const b = new PixelBuffer(size, size);
  for (let u = 0; u < size; u++) for (let v = 0; v < size; v++) b.data[v * size + u] = cols[u * size + v];
  return b.touch();
}

/** --ray: contact sheets of the raycaster textures and billboards. */
async function raySheets(args: Args): Promise<void> {
  const report = await loadContent(() => true);
  for (const f of report.failed) console.error(`module ${f.id} failed to load:\n${f.error}`);
  const groupOf = (id: string): string => id.split('/').slice(0, 2).join('-');
  const frame = (buf: PixelBuffer) => ({ buf, ox: buf.w >> 1, oy: buf.h - 1 });
  const write = (name: string, items: SheetItem[]): void => {
    const pages = composeSheets(items, { title: name, marks: false, width: 1100, maxHeight: 900 });
    pages.forEach((page, i) => {
      const file = join(args.out, `ray-${name.replace(/[^a-z0-9_-]/gi, '_')}${i === 0 ? '' : `-${i + 1}`}.png`);
      savePNG(page, file, args.scale);
      console.log(`${name}: ${items.length} rows → ${file}`);
    });
  };
  const texIds = listRayTextures().filter((id) => id.startsWith(args.prefix) && !id.startsWith('#'));
  const texGroups = new Map<string, string[]>();
  for (const id of texIds) texGroups.set(groupOf(id), [...(texGroups.get(groupOf(id)) ?? []), id]);
  for (const [g, ids] of texGroups) {
    // each texture twice side by side (shows the seam) and its dark variant
    const items = ids.map((id) => {
      const i = rayTextureIndex(id);
      const lit = fromColumns(rayTextureColumns(i), RAY_TEX);
      const dark = fromColumns(rayTextureColumns(i, true), RAY_TEX);
      const pair = new PixelBuffer(RAY_TEX * 2, RAY_TEX).blit(lit, 0, 0).blit(lit, RAY_TEX, 0).touch();
      return { id, frames: [frame(pair), frame(dark)] };
    });
    write(`tex-${g}`, items);
  }
  let total = 0;
  const bbIds = listRayBillboards().filter((id) => id.startsWith(args.prefix));
  const bbGroups = new Map<string, string[]>();
  for (const id of bbIds) bbGroups.set(groupOf(id), [...(bbGroups.get(groupOf(id)) ?? []), id]);
  for (const [g, ids] of bbGroups) {
    const items: SheetItem[] = [];
    const singles = ids.filter((id) => {
      const bb = getRayBillboard(id);
      return bb.frames === 1 && bb.yaws === 1;
    });
    if (singles.length > 1) {
      // one-frame billboards (items, props) share a row, in id order
      for (let k = 0; k < singles.length; k += 8) {
        const part = singles.slice(k, k + 8);
        items.push({ id: part.map((id) => id.split('/').pop()).join(' '), frames: part.map((id) => frame(fromColumns(billboardColumns(getRayBillboard(id), 0, 0), getRayBillboard(id).size))) });
        total += part.length;
      }
    }
    for (const id of ids) {
      if (singles.length > 1 && singles.includes(id)) continue;
      const bb = getRayBillboard(id);
      for (let yaw = 0; yaw < bb.yaws; yaw++) {
        const frames = [];
        for (let f = 0; f < bb.frames; f++) frames.push(frame(fromColumns(billboardColumns(bb, f, yaw), bb.size)));
        total += frames.length;
        items.push({ id: bb.yaws > 1 ? `${id} yaw ${yaw}` : id, frames });
      }
    }
    write(`bb-${g}`, items);
  }
  console.log(`${texIds.length} textures, ${bbIds.length} billboards (${total} frames)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
