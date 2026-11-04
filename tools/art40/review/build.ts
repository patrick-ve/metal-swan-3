/**
 * npx tsx tools/art40/review/build.ts [--out tmp/ams40-review] [--old tmp/ams40-old] [--looks tmp/ams40-looks]
 *   [--sets src/game/content/art40] [--max-mb 12]
 *
 * Builds the private review page of the 40 px work: one self-contained HTML file
 * (<out>/index.html, every image a data URI, no external requests) with
 * - per character (plan "Scope" order): every strip, the OLD frames (the record of
 *   tools/art40/old/dump.ts) next to the NEW baked frames (src/game/content/art40/*.gen.ts),
 *   both playing at their real durations on one 60 Hz clock, anchors aligned; 1× and integer
 *   zoom; anchor and point marks; variant palettes;
 * - a line-up of every character next to VINCENT at 1× on the game's 384×216 view (old or new);
 * - the art40-check table and findings;
 * - "look samples": every PNG under <looks>/<name>/ with its notes.md;
 * - a dark / light background toggle.
 * The page stays under --max-mb (default 12): the builder exits 1 when it does not.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePNG } from '../../lib/png';
import { setPassed } from '../check/core';
import { decodeIndices } from '../check/decode';
import { checkLoaded, loadSet, setFiles, SETS_DIR } from '../check/load';
import { readContract } from '../check/contract';
import type { CheckSet, SetReport } from '../check/types';
import type { OldIndex } from '../old/dump';
import { AMS40_SCOPE, scopeOf } from '../old/scope';
import { PAGE_CSS, PAGE_JS } from './page';

interface Cell {
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/** One strip as the page plays it: a PNG of cells left to right, anchors at (ax, ay) in every cell. */
export interface PageStrip {
  src: string;
  n: number;
  cell: Cell;
  durations: number[];
  loop: boolean;
  /** Points per frame relative to the anchor. */
  pts: Array<Record<string, readonly [number, number]>>;
  cls?: string;
  why?: string;
  smear?: number[];
}

export interface PageCharacter {
  name: string;
  wave: number;
  /** Old strips by full id. */
  old: Record<string, PageStrip>;
  /** New sets of the character. */
  sets: Array<{ slug: string; prefix: string; pal: string[]; variants: Record<string, string[]>; strips: Record<string, PageStrip>; events: Record<string, number>; passed: boolean }>;
}

export interface PageLook {
  name: string;
  notes: string;
  images: Array<{ file: string; src: string }>;
}

export interface PageData {
  characters: PageCharacter[];
  looks: PageLook[];
  checks: Array<Omit<SetReport, 'findings'> & { findings: SetReport['findings']; passed: boolean }>;
  contract: boolean;
  oldFound: boolean;
}

function dataUri(bytes: Uint8Array, mime = 'image/png'): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

function rgbaOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A baked strip as cells with a common anchor (palette `pal`). */
export function bakedStrip(set: CheckSet, name: string): PageStrip {
  const st = set.strips[name];
  let l = 0;
  let r = 1;
  let t = 0;
  let b = 1;
  for (const f of st.frames) {
    l = Math.max(l, f.ox);
    r = Math.max(r, f.w - f.ox);
    t = Math.max(t, f.oy);
    b = Math.max(b, f.h - f.oy);
  }
  const cell = { w: l + r, h: t + b, ax: l, ay: t };
  const W = cell.w * st.frames.length;
  const rgba = new Uint8Array(W * cell.h * 4);
  const pal = set.pal.map((c, i) => (i === 0 ? null : rgbaOf(c)));
  st.frames.forEach((f, i) => {
    const idx = decodeIndices(f.px, f.w, f.h);
    const x0 = i * cell.w + l - f.ox;
    const y0 = t - f.oy;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const c = pal[idx[y * f.w + x]];
        if (!c) continue;
        const p = ((y0 + y) * W + x0 + x) * 4;
        rgba[p] = c[0];
        rgba[p + 1] = c[1];
        rgba[p + 2] = c[2];
        rgba[p + 3] = 255;
      }
    }
  });
  const smear = st.frames.flatMap((f, i) => (f.smear ? [i] : []));
  return {
    src: dataUri(encodePNG(W, cell.h, rgba)),
    n: st.frames.length,
    cell,
    durations: [...st.durations],
    loop: st.loop,
    pts: st.frames.map((f) => ({ ...(f.pts ?? {}) })),
    ...(st.cls ? { cls: st.cls } : {}),
    ...(st.why ? { why: st.why } : {}),
    ...(smear.length ? { smear } : {}),
  };
}

function readOld(dir: string): { index: OldIndex | null; strips: Map<string, PageStrip> } {
  const file = join(dir, 'index.json');
  const strips = new Map<string, PageStrip>();
  if (!existsSync(file)) return { index: null, strips };
  const index = JSON.parse(readFileSync(file, 'utf8')) as OldIndex;
  for (const [id, rec] of Object.entries(index.sprites)) {
    const png = join(dir, rec.x1.png);
    if (!existsSync(png)) continue;
    strips.set(id, {
      src: dataUri(readFileSync(png)),
      n: rec.x1.frames.length,
      cell: rec.x1.cell,
      durations: rec.durations,
      loop: rec.loop,
      pts: rec.x1.frames.map((f) => ({ ...(f.pts ?? {}) })),
    });
  }
  return { index, strips };
}

function readLooks(dir: string): PageLook[] {
  if (!existsSync(dir)) return [];
  const out: PageLook[] = [];
  for (const name of readdirSync(dir).sort()) {
    const d = join(dir, name);
    if (!statSync(d).isDirectory()) continue;
    const notesFile = join(d, 'notes.md');
    const images = readdirSync(d)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .sort()
      .map((f) => ({ file: f, src: dataUri(readFileSync(join(d, f))) }));
    out.push({ name, notes: existsSync(notesFile) ? readFileSync(notesFile, 'utf8') : '', images });
  }
  return out;
}

export async function buildPageData(o: { old: string; looks: string; sets?: string }): Promise<PageData> {
  const { index, strips: oldStrips } = readOld(o.old);
  const contract = readContract();
  const loaded = await Promise.all(setFiles(o.sets ?? SETS_DIR).map((f) => loadSet(f)));
  const chars = new Map<string, PageCharacter>();
  for (const f of AMS40_SCOPE) chars.set(f.character, { name: f.character, wave: f.wave, old: {}, sets: [] });
  for (const [id, s] of oldStrips) {
    const c = index?.sprites[id]?.character ?? scopeOf(id)?.character ?? 'other';
    if (!chars.has(c)) chars.set(c, { name: c, wave: 0, old: {}, sets: [] });
    (chars.get(c) as PageCharacter).old[id] = s;
  }
  const checks: PageData['checks'] = [];
  for (const l of loaded) {
    const rep = checkLoaded(l, contract);
    checks.push({ ...rep, passed: setPassed(rep) });
    const c = scopeOf(`${l.set.prefix}/x`)?.character ?? l.set.slug;
    if (!chars.has(c)) chars.set(c, { name: c, wave: 0, old: {}, sets: [] });
    const strips: Record<string, PageStrip> = {};
    for (const name of Object.keys(l.set.strips)) strips[name] = bakedStrip(l.set, name);
    (chars.get(c) as PageCharacter).sets.push({
      slug: l.set.slug,
      prefix: l.set.prefix,
      pal: [...l.set.pal],
      variants: Object.fromEntries(Object.entries(l.set.variants ?? {}).map(([k, v]) => [k, [...v]])),
      strips,
      events: { ...(l.set.events ?? {}) },
      passed: setPassed(rep),
    });
  }
  return {
    characters: [...chars.values()].filter((c) => Object.keys(c.old).length || c.sets.length),
    looks: readLooks(o.looks),
    checks,
    contract: Boolean(contract),
    oldFound: index !== null,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderPage(data: PageData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const sets = data.checks.length;
  const passed = data.checks.filter((c) => c.passed).length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ams40 sprite review</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="top">
  <div>
    <h1>Mission ams at 40 px: review</h1>
    <p class="sub">${esc(`${data.characters.length} characters, ${sets} baked set(s), ${passed} passing the check${data.contract ? '' : ' (no contract yet)'}${data.oldFound ? '' : ', no old-frame record found'}`)}</p>
  </div>
  <div class="controls" role="toolbar" aria-label="View">
    <label>Zoom <select id="zoom">${[1, 2, 3, 4, 5, 6, 8].map((z) => `<option value="${z}"${z === 3 ? ' selected' : ''}>${z}×</option>`).join('')}</select></label>
    <button id="theme" type="button">Light background</button>
    <button id="play" type="button">Pause</button>
    <label><input id="marks" type="checkbox"> Anchor and points</label>
  </div>
</header>
<nav class="toc" id="toc"></nav>
<main>
  <section id="lineup-sec"><h2>Line-up next to VINCENT (1×, 384×216 view)</h2>
    <div class="controls"><label><input type="radio" name="lu" value="new" checked> New where baked</label><label><input type="radio" name="lu" value="old"> Old</label></div>
    <div id="lineup"></div>
  </section>
  <section id="check-sec"><h2>art40-check</h2><div id="checks"></div></section>
  <section id="chars-sec"><h2>Characters: old next to new</h2><p class="hint">Open a character to play its strips. Both sides run on one 60 Hz clock at their real durations; one-shots hold their last frame for half a second. Grey: no frames on that side.</p><div id="chars"></div></section>
  <section id="looks-sec"><h2>Look samples</h2><div id="looks"></div></section>
</main>
<script>const DATA = ${json};</script>
<script>${PAGE_JS}</script>
</body>
</html>
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const o = { out: 'tmp/ams40-review', old: 'tmp/ams40-old', looks: 'tmp/ams40-looks', sets: SETS_DIR, maxMb: 12 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--old') o.old = argv[++i];
    else if (a === '--looks') o.looks = argv[++i];
    else if (a === '--sets') o.sets = argv[++i];
    else if (a === '--max-mb') o.maxMb = Number(argv[++i]);
  }
  const data = await buildPageData(o);
  const html = renderPage(data);
  mkdirSync(o.out, { recursive: true });
  const file = join(o.out, 'index.html');
  writeFileSync(file, html);
  const mb = Buffer.byteLength(html) / 1e6;
  const oldN = data.characters.reduce((n, c) => n + Object.keys(c.old).length, 0);
  const newN = data.characters.reduce((n, c) => n + c.sets.reduce((m, s) => m + Object.keys(s.strips).length, 0), 0);
  console.log(`review page: ${file} (${mb.toFixed(2)} MB): ${data.characters.length} characters, ${oldN} old strips, ${newN} new strips, ${data.checks.length} checked set(s), ${data.looks.length} look sample folder(s)`);
  if (mb > o.maxMb) {
    console.error(`the page is over ${o.maxMb} MB`);
    process.exit(1);
  }
}

const self = process.argv[1] ?? '';
if (/art40[\\/]review[\\/]build\.ts$/.test(self)) void main();
