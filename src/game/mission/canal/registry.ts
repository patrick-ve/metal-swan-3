/**
 * The canal scenes' registry (docs/api/canal.md): the baked manifests by mission, the on/off switch
 * (`?canal=0`, `--canal 0`, `setCanal`), where the image files come from (`CanalSource`) and how
 * the browser turns a decoded tile into a texture it owns.
 */
import type { PixelBuffer } from '../../../engine/pixel';
import type { RowsTexture } from '../../../engine/render';
import type { SectionDef } from '../types';
import type { CanalManifest, CanalSectionManifest } from './types';

/**
 * Where the scene files come from (a path relative to the site root, e.g. 'art/ams/a-u4-w0-0.png').
 * The browser fetches them (`fetchCanalSource`); node tools and tests read them from `public/` with
 * `readSync` and `inflateSync` (then a scene loads at once, before the frame that draws it).
 */
export interface CanalSource {
  read(path: string): Promise<Uint8Array>;
  readSync?(path: string): Uint8Array;
  inflateSync?(data: Uint8Array): Uint8Array;
}

const manifests = new Map<string, CanalManifest>();
let on = true;
let source: CanalSource | null = null;
let textureOf: ((buf: PixelBuffer) => RowsTexture) | null = null;

/** Register a mission's baked scenes under `id` (scene ids are `<id>/<section id>`). */
export function defineCanalManifest(id: string, man: CanalManifest): void {
  manifests.set(id, man);
}

/** The manifest registered under `id` (a mission's canal/index.ts registers it), or undefined. */
export function canalManifest(id: string): CanalManifest | undefined {
  return manifests.get(id);
}

/** The manifest and the section of scene `<id>/<section>`, or null (not registered, no such section). */
export function canalScene(scene: string): { man: CanalManifest; sec: CanalSectionManifest } | null {
  const i = scene.lastIndexOf('/');
  if (i <= 0) return null;
  const man = manifests.get(scene.slice(0, i));
  const sec = man?.sections[scene.slice(i + 1)];
  return man && sec ? { man, sec } : null;
}

/**
 * The lit stack paired with scene `<id>/<section>` (docs/api/canal.md "A lit section"): the scene
 * id of the manifest's section whose `litOf` is that section, or null (no lit pair).
 */
export function canalLitOf(scene: string): string | null {
  const i = scene.lastIndexOf('/');
  if (i <= 0) return null;
  const man = manifests.get(scene.slice(0, i));
  if (!man) return null;
  const sec = scene.slice(i + 1);
  for (const [id, s] of Object.entries(man.sections)) if (s.litOf === sec) return `${scene.slice(0, i)}/${id}`;
  return null;
}

/** The switch (default on): off draws every section's old scenery (`?canal=0`, `--canal 0`). Returns the previous value. */
export function setCanal(value: boolean): boolean {
  const prev = on;
  on = value;
  return prev;
}

export function canalOn(): boolean {
  return on;
}

/** Where the files come from (null: nowhere — a canal section then draws its old scenery). Returns the previous one. */
export function setCanalSource(src: CanalSource | null): CanalSource | null {
  const prev = source;
  source = src;
  return prev;
}

export function canalSource(): CanalSource | null {
  return source;
}

/** The browser: make a texture of a decoded tile (`canvasTexture`), so the store can drop its pixels. Null: keep buffers. */
export function setCanalTextures(fn: ((buf: PixelBuffer) => RowsTexture) | null): void {
  textureOf = fn;
}

export function canalTextureOf(): ((buf: PixelBuffer) => RowsTexture) | null {
  return textureOf;
}

/**
 * The base URL of the canal files. On the DEV server only, the other loopback name (`localhost` ↔
 * `127.0.0.1`, same port; the dev server sends the CORS header for it): the browser keeps six
 * connections per host, and the art workers' module loads (the whole module graph per worker, over a
 * thousand requests in flight) hold them for seconds, so the packs on the page's own host waited
 * 1.7–2.3 s each (measured, 2026-11-13). Production (one bundle per worker) and any other host:
 * `base` as it is.
 */
export function canalBase(base: string, loc: { href: string; hostname: string }, dev: boolean): string {
  if (!dev) return base;
  const alt = loc.hostname === 'localhost' ? '127.0.0.1' : loc.hostname === '127.0.0.1' ? 'localhost' : null;
  if (!alt) return base;
  const u = new URL(base, loc.href);
  u.hostname = alt;
  return u.href;
}

/** The browser's source: `fetch` under the site's base URL. */
export function fetchCanalSource(base: string): CanalSource {
  return {
    async read(path: string): Promise<Uint8Array> {
      // A high priority hint: the drawn scene's packs before other loads of the page (art worker scripts, audio).
      const res = await fetch(base + path, { priority: 'high' } as RequestInit);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/**
 * Does this section draw a canal scene now (the opt-in, the switch on, the scene registered, a
 * source set)? A scene that fails to load later falls back on its own (`SectionView`).
 */
export function canalActive(def: SectionDef | undefined): boolean {
  return !!def?.canal && on && source !== null && canalScene(def.canal.scene) !== null;
}

/**
 * The sprite ids of a live scene's canal sprites (docs/api/canal.md §7: the manifest's `sprites`):
 * entities still draw these ids (the listed frames as the kit's painting, the others, a wreck, in
 * the game's art; b's vendor draws `decor/ams/hotdog-front` over himself), so they stay built.
 */
function sceneSpriteIds(def: SectionDef): ReadonlySet<string> {
  const sc = def.canal ? canalScene(def.canal.scene) : null;
  return new Set((sc?.sec.sprites ?? []).map((s) => s.id));
}

/**
 * The sprite id prefixes a section draws (the tier-4 working set and the 2× preload order,
 * gameplay.ts): with its canal scene on, `canal.art`, else its `art` without its decor's sprites
 * (the scene paints them) but with its scene's canal sprites (entities draw them); otherwise its `art`.
 */
export function drawnArt(def: SectionDef | undefined): readonly string[] {
  if (!def) return [];
  const art = def.art ?? [];
  if (!canalActive(def)) return art;
  const c = def.canal;
  if (c?.art) return c.art;
  const keep = sceneSpriteIds(def);
  const decor = new Set((def.decor ?? []).map((d) => d.sprite).filter((id) => !keep.has(id)));
  return art.filter((id) => !decor.has(id));
}

/**
 * The old sprites the canal scenes of a mission paint instead (docs/api/canal.md §8): the decor
 * sprites of its sections whose scene is on, unless some section draws the id anyway (its
 * `drawnArt` covers it, a live scene lists it as a canal sprite, or a section without a live scene
 * lists it as decor). Empty when no section draws a canal scene (every other mission, `ams2`,
 * `?canal=0`, no source). The boot's 1× preload, the 2× mission preload and the scripts' `prewarm`
 * leave these ids out.
 */
export function canalPaintedArt(sections: Readonly<Record<string, SectionDef>> | undefined): ReadonlySet<string> {
  const painted = new Set<string>();
  if (!sections) return painted;
  const defs = Object.values(sections);
  for (const def of defs) if (canalActive(def)) for (const d of def.decor ?? []) painted.add(d.sprite);
  if (painted.size === 0) return painted;
  for (const def of defs) {
    const keep = drawnArt(def);
    for (const id of [...painted]) if (keep.some((p) => id.startsWith(p))) painted.delete(id);
    if (canalActive(def)) for (const id of sceneSpriteIds(def)) painted.delete(id);
    else for (const d of def.decor ?? []) painted.delete(d.sprite);
  }
  return painted;
}

const NONE: ReadonlySet<string> = new Set();
let paintedNow: ReadonlySet<string> = NONE;

/**
 * The painted set of the mission that loaded a section last (`canalPaintedArt`; the mission runner
 * sets it at each section start, before the section's script runs): the ids `prewarm` skips.
 */
export function setCanalPaintedNow(ids: ReadonlySet<string> | null): void {
  paintedNow = ids ?? NONE;
}

export function canalPaintedNow(): ReadonlySet<string> {
  return paintedNow;
}
