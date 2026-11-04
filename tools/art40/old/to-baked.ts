/**
 * npx tsx tools/art40/old/to-baked.ts <prefix> [--out tmp/ams40-found-check/sets] [--budget 28|40|64] [--slug s]
 *
 * A test aid for the gates and the review page: writes TODAY's 1× frames of every id under
 * `<prefix>/` as a baked set (<out>/<slug>.gen.ts, the format of tools/art40/README.md): one
 * palette of every colour used, the darkest colour as the outline, the contract's classes, no
 * events (the check then reports what the real bake must add). Never write into src/: the result is not production art.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFrames, isDeferredSprite, listSprites, setHiArt, spriteAnim } from '../../../src/engine/sprites';
import { ART_MODULE_IDS, loadContent } from '../../../src/game/content/index';
import { readContract } from '../check/contract';
import { encodeIndices, MAX_PALETTE } from '../check/decode';
import type { CheckFrame, CheckSet, CheckStrip } from '../check/types';

function hex(c: number): string {
  return `#${(c >>> 8).toString(16).padStart(6, '0')}`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let out = 'tmp/ams40-found-check/sets';
  let budget = 28;
  let slug = '';
  let prefix = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--budget') budget = Number(argv[++i]);
    else if (argv[i] === '--slug') slug = argv[++i];
    else prefix = argv[i];
  }
  if (!prefix) {
    console.error('usage: to-baked.ts <prefix> [--out dir] [--budget n] [--slug s]');
    process.exit(2);
  }
  slug ||= prefix.split('/').pop() as string;
  setHiArt(false);
  await loadContent((id) => ART_MODULE_IDS.includes(id));
  const contract = readContract();
  const ids = listSprites(`${prefix}/`).filter((id) => !id.slice(prefix.length + 1).includes('/'));
  const colours = new Map<number, number>();
  const pal: string[] = ['#000000'];
  const strips: Record<string, CheckStrip> = {};
  for (const id of ids) {
    const fs = getFrames(id, 1);
    const frames: CheckFrame[] = fs.map((f) => {
      const idx = new Array<number>(f.buf.w * f.buf.h).fill(0);
      f.buf.data.forEach((c, p) => {
        if ((c & 255) < 128) return;
        const rgb = (c | 255) >>> 0;
        let k = colours.get(rgb);
        if (k === undefined) {
          k = pal.length;
          colours.set(rgb, k);
          pal.push(hex(rgb));
        }
        idx[p] = k;
      });
      return { w: f.buf.w, h: f.buf.h, ox: f.ox, oy: f.oy, px: encodeIndices(idx), ...(f.pts ? { pts: { ...f.pts } } : {}) };
    });
    const a = spriteAnim(id);
    const d = a.durations ?? [a.ticksPerFrame];
    const c = contract?.get(id);
    strips[id.slice(prefix.length + 1)] = {
      frames,
      durations: frames.map((_, i) => d[i % d.length]),
      loop: a.loop,
      ...(isDeferredSprite(id) ? { defer: true as const } : {}),
      ...(c?.cls ? { cls: c.cls } : {}),
    };
  }
  let outline = 1;
  let best = Infinity;
  pal.forEach((c, i) => {
    if (i === 0) return;
    const n = parseInt(c.slice(1), 16);
    const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    if (l < best) {
      best = l;
      outline = i;
    }
  });
  if (pal.length > MAX_PALETTE) throw new Error(`${prefix}: ${pal.length - 1} colours, the baked format holds ${MAX_PALETTE - 1}`);
  const set: CheckSet = { v: 2, slug, prefix, budget, pal, outline, strips };
  mkdirSync(out, { recursive: true });
  const file = join(out, `${slug}.gen.ts`);
  writeFileSync(file, `// TEST AID from tools/art40/old/to-baked.ts: today's frames of ${prefix} in the baked format. Not production art.\nexport const SET = ${JSON.stringify(set)};\n`);
  console.log(`${file}: ${ids.length} strips, ${pal.length - 1} colours`);
}

void main();
