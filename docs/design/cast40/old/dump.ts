/**
 * Dumps the game's current sprite frame for each cast sample (the "now in the game" picture).
 *   cd REPO && npx tsx <cast40>/old/dump.ts <list.json> <outdir>
 * list.json: [{ "key": "<cast id>", "id": "<sprite id or prefix>", "frame": 0 }]
 * Writes <outdir>/<key>@1x.png and <outdir>/<key>@hd.png (the highest density the id has, ≤ 4) and
 * <outdir>/index.json with the sprite id used, the logical size and the hd density.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = process.cwd();
const imp = (p: string) => import(resolve(REPO, p));

async function main(): Promise<void> {
  const [listFile, outDir] = process.argv.slice(2);
  const list = JSON.parse(readFileSync(listFile, 'utf8')) as { key: string; id: string; frame?: number }[];
  mkdirSync(outDir, { recursive: true });
  const S = await imp('src/engine/sprites.ts');
  const R = await imp('src/engine/render.ts');
  const C = await imp('src/game/content/index.ts');
  const I = await imp('tools/lib/image.ts');
  S.setArtTier?.(4);
  const report = await C.loadContent((id: string) => C.ART_MODULE_IDS.includes(id));
  for (const f of report.failed) console.error(`module ${f.id} failed: ${String(f.error).split('\n')[0]}`);
  const index: Record<string, unknown> = {};
  for (const it of list) {
    let id = it.id;
    const all: string[] = S.listSprites(id);
    if (!all.includes(id)) id = all[0];
    if (!id) {
      console.log(`missing: ${it.key} (${it.id})`);
      continue;
    }
    const f1 = S.getFrames(id, 1);
    const fh = S.getFrames(id, 4);
    if (!f1.length) {
      console.log(`no frames: ${it.key} (${id})`);
      continue;
    }
    const k = Math.min(it.frame ?? 0, f1.length - 1);
    I.savePNG(f1[k].buf, join(outDir, `${it.key}@1x.png`));
    const h = fh[Math.min(k, fh.length - 1)];
    const d = R.frameDensity(h);
    I.savePNG(h.buf, join(outDir, `${it.key}@hd.png`));
    index[it.key] = { id, frame: k, w: f1[k].buf.w, h: f1[k].buf.h, hd: d, of: all.length };
    console.log(`${it.key}: ${id} #${k} ${f1[k].buf.w}x${f1[k].buf.h}, hd ${d}x`);
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
