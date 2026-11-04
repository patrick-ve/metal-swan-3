/**
 * npx tsx tools/art40/old/dump.ts [--out tmp/ams40-old] [<id prefix>...]
 *
 * Records today's frames of every in-scope id (tools/art40/old/scope.ts; plus every id of
 * docs/design/ams40/contract.json when it exists) BEFORE the 40 px sets replace them: one PNG strip
 * per id and density (1× and the 4× request) and one index.json with sizes, anchors, points,
 * durations and loop / defer flags. The review page (tools/art40/review/build.ts) reads it.
 *
 * Strip layout: every frame sits in a cell of the same size with its anchor at the same cell point
 * (cell.ax, cell.ay), cells left to right with no gap, so a player can step through the cells.
 * 4× cells are in buffer pixels of the returned frames (`density`: 4, 2, or 1 when the id has no
 * dense art). Run it once before wave 1 replaces anything; later runs would record new art.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PixelBuffer } from '../../../src/engine/pixel';
import { frameDensity, getFrames, isDeferredSprite, listSprites, setDeferDense, setHiArt, spriteAnim, spriteErrors, type Frame } from '../../../src/engine/sprites';
import { ART_MODULE_IDS, loadContent } from '../../../src/game/content/index';
import { savePNG } from '../../lib/image';
import { AMS40_SCOPE, scopeOf } from './scope';

export interface OldFrame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  pts?: Record<string, readonly [number, number]>;
}

export interface OldStrip {
  /** Density of the frames in this strip (1, 2 or 4). */
  density: number;
  frames: OldFrame[];
  /** Cell size and the anchor in the cell, in buffer pixels. */
  cell: { w: number; h: number; ax: number; ay: number };
  /** PNG path relative to the dump folder. */
  png: string;
}

export interface OldId {
  id: string;
  character: string;
  wave: number;
  durations: number[];
  loop: boolean;
  defer: boolean;
  x1: OldStrip;
  x4: OldStrip;
}

export interface OldIndex {
  v: 1;
  ids: number;
  frames1: number;
  frames4: number;
  characters: Record<string, string[]>;
  sprites: Record<string, OldId>;
}

function fileOf(id: string, tag: string): string {
  return `png/${id}@${tag}.png`;
}

function stripOf(frames: readonly Frame[], file: string, out: string): OldStrip {
  const d = frameDensity(frames[0]);
  let l = 0;
  let r = 1;
  let t = 0;
  let b = 1;
  for (const f of frames) {
    const ox = f.ox * frameDensity(f);
    const oy = f.oy * frameDensity(f);
    l = Math.max(l, ox);
    r = Math.max(r, f.buf.w - ox);
    t = Math.max(t, oy);
    b = Math.max(b, f.buf.h - oy);
  }
  const cell = { w: l + r, h: t + b, ax: l, ay: t };
  const strip = new PixelBuffer(cell.w * frames.length, cell.h);
  frames.forEach((f, i) => {
    const fd = frameDensity(f);
    const x0 = i * cell.w + l - f.ox * fd;
    const y0 = t - f.oy * fd;
    const src = f.buf.data;
    for (let y = 0; y < f.buf.h; y++) {
      for (let x = 0; x < f.buf.w; x++) {
        const c = src[y * f.buf.w + x];
        if ((c & 255) === 0) continue;
        strip.data[(y0 + y) * strip.w + x0 + x] = c;
      }
    }
  });
  strip.touch();
  savePNG(strip, join(out, file));
  return {
    density: d,
    frames: frames.map((f) => ({ w: f.buf.w / frameDensity(f), h: f.buf.h / frameDensity(f), ox: f.ox, oy: f.oy, ...(f.pts ? { pts: { ...f.pts } } : {}) })),
    cell,
    png: file,
  };
}

function contractIds(): string[] {
  const p = 'docs/design/ams40/contract.json';
  if (!existsSync(p)) return [];
  try {
    const j = JSON.parse(readFileSync(p, 'utf8')) as { ids?: Record<string, unknown> | string[] };
    if (Array.isArray(j.ids)) return j.ids;
    return j.ids ? Object.keys(j.ids) : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let out = 'tmp/ams40-old';
  const prefixes: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else prefixes.push(argv[i]);
  }
  setHiArt(true);
  setDeferDense(false);
  const rep = await loadContent((id) => ART_MODULE_IDS.includes(id));
  if (rep.failed.length) console.error(`content failed: ${rep.failed.map((f) => f.id).join(', ')}`);
  const all = listSprites();
  const fromContract = new Set(contractIds());
  const ids = all.filter((id) => (scopeOf(id) || fromContract.has(id)) && (prefixes.length === 0 || prefixes.some((p) => id.startsWith(p))));
  mkdirSync(out, { recursive: true });
  const index: OldIndex = { v: 1, ids: 0, frames1: 0, frames4: 0, characters: {}, sprites: {} };
  for (const f of AMS40_SCOPE) index.characters[f.character] = [];
  for (const id of ids) {
    const fam = scopeOf(id);
    const character = fam?.character ?? 'contract-only';
    const f1 = getFrames(id, 1);
    const f4 = getFrames(id, 4);
    const anim = spriteAnim(id);
    const durations = anim.durations ? [...anim.durations] : [anim.ticksPerFrame];
    const rec: OldId = {
      id,
      character,
      wave: fam?.wave ?? 0,
      durations,
      loop: anim.loop,
      defer: isDeferredSprite(id),
      x1: stripOf(f1, fileOf(id, '1x'), out),
      x4: stripOf(f4, fileOf(id, '4x'), out),
    };
    index.sprites[id] = rec;
    (index.characters[character] ??= []).push(id);
    index.ids++;
    index.frames1 += f1.length;
    index.frames4 += f4.length;
  }
  const errs = spriteErrors().filter((e) => ids.includes(e.id.replace(/@\dx$/, '')));
  const file = join(out, 'index.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`recorded ${index.ids} ids, ${index.frames1} 1x frames, ${index.frames4} 4x-request frames -> ${out}/`);
  for (const [c, list] of Object.entries(index.characters)) console.log(`  ${c}: ${list.length} ids`);
  if (errs.length) console.log(`sprite errors in scope: ${errs.map((e) => e.id).join(', ')}`);
}

void main();
