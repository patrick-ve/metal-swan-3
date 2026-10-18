/**
 * Vite plugin: writes the offline cache (service worker) dist/sw.js after a production build
 * (docs/ARCHITECTURE.md §5.4 "Offline cache"). It lists every file in the output folder with a
 * hash of its content and fills them into the template tools/sw/sw.js.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export const SW_FILE = 'sw.js';
const TEMPLATE = fileURLToPath(new URL('./sw.js', import.meta.url));

/**
 * The files the service worker fetches when it installs: the page, the scripts and the boot
 * sample group (the start screens' audio: public/audio/boot/ and the two user tracks of the
 * 'boot' group in src/game/content/samples/index.ts). The rest is cached when the game fetches it.
 */
export function precached(path: string): boolean {
  return (
    path === 'index.html' ||
    path.startsWith('assets/') ||
    path.startsWith('audio/boot/') ||
    path === 'audio/user/music/title.mp3' ||
    path === 'audio/user/music/select.mp3'
  );
}

/** Short content hash of a file. */
export function revOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

/** Every file under `dir` (paths with '/', relative to it), sorted; sw.js itself is left out. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.filter((p) => p !== SW_FILE).sort();
}

/** The service worker source for these files ({path: rev}). */
export function renderServiceWorker(template: string, build: string, files: Readonly<Record<string, string>>): string {
  const precache = Object.keys(files).filter(precached);
  const head = [
    `const BUILD = ${JSON.stringify(build)};`,
    `const FILES = ${JSON.stringify(files)};`,
    `const PRECACHE = ${JSON.stringify(precache)};`,
  ].join('\n');
  return template.replace('/* global BUILD, FILES, PRECACHE */', head);
}

export function offlineCache(build: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'ms3-offline-cache',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files: Record<string, string> = {};
      for (const p of listFiles(outDir)) files[p] = revOf(readFileSync(join(outDir, p)));
      writeFileSync(join(outDir, SW_FILE), renderServiceWorker(readFileSync(TEMPLATE, 'utf8'), build, files));
    },
  };
}
