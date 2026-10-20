/**
 * The sprite cache (docs/ARCHITECTURE.md §5.4 "Sprite cache"): generated sprite frames, saved as
 * named packs (`sprite-pack.ts`) in a ByteStore (IndexedDB in the browser) and installed again on
 * a later visit, so the generators run once per build instead of on every visit.
 *
 * Packs: 'boot' (the 1× frames the boot scene preloads), 'hi' (the 2× frames of the background
 * mission preload), 'fps' (the first-person sprites, lazy content), 'hd2-fps' / 'hd4-fps' (the
 * dense fps art, content/fps/dense-load.ts) and the 4× packs of the tier-4 working set:
 * 'hd4-<section>' (a section's 4× ids) and 'hd4-char-<hero>' (a hero's 4× ids). A restore
 * decodes only the ids it installs, each buffer in its own ArrayBuffer (sprite-pack.ts), so a
 * released id frees its memory.
 * The boot restores 'boot' and 'hi'; the 4× packs are restored at the mission start and on a
 * section change (scenes/gameplay.ts), never at boot. Every pack carries the
 * build tag; a pack of another build is a miss and is deleted, so a deploy never draws old art.
 * Only the browser app has a cache (main.ts, production builds); headless apps and `?cache=0`
 * run without one. Every failure is a miss: the generators run as before.
 */
import type { ByteStore } from '../engine/byte-store';
import { decodeSpritePack, encodeSpritePack } from '../engine/sprite-pack';
import { generatedSprites, installFrames, readyFrames } from '../engine/sprites';

export type ArtPack = 'boot' | 'hi' | 'fps' | `hd2-${string}` | `hd4-${string}`;

/** Density of the frames in a pack: 'hi' and 'hd2-…' 2, 'hd4-…' 4, else 1. */
export function packDensity(name: ArtPack): number {
  return name === 'hi' || name.startsWith('hd2-') ? 2 : name.startsWith('hd4-') ? 4 : 1;
}

const key = (name: ArtPack): string => `sprites:${name}`;

export class ArtCache {
  readonly build: string;
  /** Ids installed by the last `restore` of each pack this session (tools/cache-check.ts reads it). */
  readonly restored = new Map<ArtPack, number>();
  private readonly store: ByteStore;
  private readonly warn: (msg: string) => void;
  /** Ids in each pack as stored now (restored or saved this session). */
  private readonly stored = new Map<ArtPack, number>();
  private readonly saving = new Map<ArtPack, Promise<boolean>>();

  constructor(store: ByteStore, build: string, warn: (msg: string) => void = (m) => console.warn(m)) {
    this.store = store;
    this.build = build;
    this.warn = warn;
  }

  /**
   * Install the frames of pack `name` made by this build into the sprite registry (ids that have
   * frames already keep theirs). `keep` (optional) limits the ids installed (a 4× pack installs
   * only the current working set). Returns the number of ids installed; 0 on a miss.
   */
  async restore(name: ArtPack, keep?: (id: string) => boolean): Promise<number> {
    const bytes = await this.store.get(key(name));
    if (!bytes) return 0;
    try {
      const d = packDensity(name);
      // Only the ids to install are decoded (each buffer its own ArrayBuffer): the ids left out,
      // and those that have frames already, cost no memory (sprite-pack.ts).
      const pack = await decodeSpritePack(bytes, (id) => (!keep || keep(id)) && readyFrames(id, d) === null);
      if (pack.tag !== this.build || pack.density !== d) {
        await this.store.delete(key(name));
        return 0;
      }
      let n = 0;
      for (const [id, frames] of pack.sprites) if (installFrames(id, pack.density, frames)) n++;
      this.stored.set(name, pack.total);
      this.restored.set(name, n);
      return n;
    } catch (err) {
      this.warn(`[art-cache] pack "${name}" is unreadable (generating instead): ${err instanceof Error ? err.message : String(err)}`);
      await this.store.delete(key(name));
      return 0;
    }
  }

  /**
   * Save the ready frames of the ids that start with one of `prefixes` as pack `name`, unless the
   * stored pack already holds that many ids (a restored pack is not written again). Runs in the
   * background (the encoder yields between chunks); a second call while one runs waits for it.
   * `prefixes` may also be a filter on ids (the 4× packs save an exact id set).
   * Returns true when it wrote the pack.
   */
  save(name: ArtPack, prefixes: readonly string[] | ((id: string) => boolean)): Promise<boolean> {
    const prev = this.saving.get(name) ?? Promise.resolve(false);
    const next = prev.then(() => this.write(name, prefixes));
    this.saving.set(name, next);
    return next;
  }

  private async write(name: ArtPack, prefixes: readonly string[] | ((id: string) => boolean)): Promise<boolean> {
    const d = packDensity(name);
    const keep = typeof prefixes === 'function' ? prefixes : (id: string): boolean => prefixes.some((p) => id.startsWith(p));
    const ids = generatedSprites(d).filter(keep);
    if (ids.length === 0 || this.stored.get(name) === ids.length) return false;
    try {
      const sprites: Array<[string, NonNullable<ReturnType<typeof readyFrames>>]> = [];
      for (const id of ids) {
        const frames = readyFrames(id, d);
        if (frames) sprites.push([id, frames]);
      }
      const bytes = await encodeSpritePack(this.build, d, sprites);
      if (!(await this.store.put(key(name), bytes))) return false;
      this.stored.set(name, ids.length);
      return true;
    } catch (err) {
      this.warn(`[art-cache] cannot save pack "${name}": ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
