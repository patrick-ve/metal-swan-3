/**
 * The canal scenes' tile store (docs/api/canal.md §4): loads a scene's camera-window packs per art
 * tier ahead of the camera, cuts them into tiles, and frees the tiles the camera has passed.
 *
 * - A pack (one PNG file, `CanalTierManifest.files`) holds the tiles whose first camera falls in its
 *   window (`fileCam`). `want(camX)` loads every pack whose window starts at most `ahead` camera px
 *   right of the camera and that still has a tile the camera needs (one whose last camera is at
 *   most `behind` px behind); a tile whose last camera is more than `behind` px behind is freed.
 *   Moving back re-loads what is missing.
 * - Tiers: the wanted tier, and tier 1 first (small) as the fallback a column draws while the wanted
 *   tier's tile is not in (`CanalView`). A tier the bake has not made: the highest one below.
 * - Loading: with a synchronous source (node tools, tests) at once, inside `want`; otherwise one
 *   pack at a time in the background (fetch, inflate with DecompressionStream, the row filters in
 *   slices of ~`SLICE_MS`), current scene first, tier 1 first, then by window; a prefetched scene
 *   (the next section) after the current one.
 * - In the browser every tile becomes a texture the store owns (`setCanalTextures`), and its pixels
 *   are dropped: only the textures stay resident.
 * - Failure (a file missing or broken): the scene is marked failed, ONE warning is logged, and its
 *   section draws its old scenery (`SectionView`).
 * - Canal sprites (docs/api/canal.md §7): a tier with `sprites` has one more file, the sprite sheet;
 *   it loads with the tier's first packs (before them in the queue) and stays until the scene goes.
 *   Its frames stay pixel buffers (the renderer draws them like any sprite frame).
 */
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { inflateStream, parsePng, unfilterRows } from '../../../engine/png';
import type { RowsTexture } from '../../../engine/render';
import { VIEW_W } from '../../../engine/render';
import { canalScene, canalSource, canalTextureOf, type CanalSource } from './registry';
import type { CanalLayerMeta, CanalManifest, CanalSectionManifest, CanalTierLayer, CanalTierManifest } from './types';

/** Time slice of the background decode (ms) before it yields to the frame loop. */
export const SLICE_MS = 4;
/**
 * Reads in flight at once (the browser): the network's latency overlaps (a dev server's or a CDN's
 * round trip per pack), the decode stays one at a time.
 */
export const PARALLEL_READS = 4;

/**
 * The browser loader's policy (`setCanalLoadPolicy`; the browser check compares it with the old one:
 * one read at a time, the tier-1 fallback by window): reads in flight, the whole-section fallback.
 */
const policy = { reads: PARALLEL_READS, wholeFallback: true };

/** The browser check: change the loader's policy (unset fields keep theirs). Returns the policy now. */
export function setCanalLoadPolicy(p: { reads?: number; wholeFallback?: boolean }): { reads: number; wholeFallback: boolean } {
  if (p.reads !== undefined) policy.reads = Math.max(1, Math.floor(p.reads));
  if (p.wholeFallback !== undefined) policy.wholeFallback = p.wholeFallback;
  return { ...policy };
}
/** Camera px the tier-1 fallback's packs come before the wanted tier's of the same window (the queue's order). */
const FALLBACK_LEAD = 512;
/**
 * The highest tier of a LIT stack's layers in the game (docs/api/canal.md "A lit section"; wave P6a,
 * 2026-11-12): both stacks of sewers-d at tier 4 hold 26.4 M px at their resident peak, over the
 * largest level 1 section (c2: 19.6 M px); the ambient stack and its canal sprites at tier 4 with the
 * lit stack (layers and canal sprites) at tier 2 hold 17.96 M px (68.5 MiB). The lit stack is still
 * baked at 1, 2 and 4 (its fidelity fixtures).
 */
export const LIT_LAYER_TIER = 2;
/** Logical px of slack in the visibility maths (the bake's MARGIN). */
const MARGIN = 2;

/** One tile of a tier: where it is, when the camera needs it, and its pixels (null: not resident). */
export interface CanalTile {
  readonly layer: number;
  readonly frame: number;
  readonly col: number;
  /** Real px of the tier, relative to the layer image's top-left. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly file: number;
  readonly sx: number;
  readonly sy: number;
  /** The camera x range (logical) over which it can be on screen. */
  readonly n0: number;
  readonly n1: number;
  img: PixelBuffer | RowsTexture | null;
}

/** The camera range over which layer x [x0, x1) (logical) of a layer can be on screen (the bake's `need_range`). */
export function needRange(meta: CanalLayerMeta, L: CanalTierLayer, x0: number, x1: number): [number, number] {
  if (meta.kind === 'tile') return [0, Infinity];
  const a = meta.kind === 'rows' ? (L.s0 ?? L.speed) : L.speed;
  const b = meta.kind === 'rows' ? (L.s1 ?? L.speed) : L.speed;
  const smin = Math.min(a, b);
  const smax = Math.max(a, b);
  if (smax <= 0) return x0 < VIEW_W + MARGIN ? [0, Infinity] : [Infinity, Infinity];
  return [Math.max(0, (x0 - VIEW_W - MARGIN) / smax), smin <= 0 ? Infinity : (x1 + MARGIN) / smin];
}

/** One tier of a scene. */
export class CanalTier {
  readonly tier: number;
  readonly man: CanalTierManifest;
  readonly tiles: CanalTile[] = [];
  /** Tile index by layer, frame and column (-1: the column is empty at this tier). */
  private readonly byCol: Int32Array[][];
  /** The tiles of each file. */
  readonly fileTiles: number[][];
  /** 1 while a file is queued or loading. */
  readonly busy: Uint8Array;
  /** Resident pixels (tiles with an image). */
  px = 0;
  /** Is this tier one the scene draws now (the wanted one or the tier-1 fallback)? Others are freed. */
  wanted = false;
  /**
   * The WHOLE section stays in (the browser's tier-1 fallback, docs/api/canal.md §4): every pack
   * loads at the section start and nothing is freed while the tier is wanted (tier 1 is small: 1/16
   * of tier 4), so a column the wanted tier has not loaded yet always has its tier-1 tile.
   */
  whole = false;
  /** The canal sprites' frames at this tier (by entry of the section's `sprites`), null until loaded. */
  sprites: Frame[] | null = null;
  /** 1 while the sprite sheet is queued or loading. */
  spriteBusy = 0;

  constructor(tier: number, man: CanalTierManifest, sec: CanalSectionManifest, col: number, skip: ReadonlySet<number>) {
    this.tier = tier;
    this.man = man;
    this.fileTiles = man.files.map(() => []);
    this.busy = new Uint8Array(man.files.length);
    this.byCol = sec.layers.map((meta, li) => {
      const L = man.layers[li];
      const cols = Math.max(1, Math.ceil(L.pw / tier / col));
      const out: Int32Array[] = [];
      for (let f = 0; f < meta.n; f++) out.push(new Int32Array(cols).fill(-1));
      if (skip.has(li)) return out;
      const t = L.tiles;
      for (let i = 0; i + 7 < t.length; i += 8) {
        const [frame, x, y, w, h, file, sx, sy] = [t[i], t[i + 1], t[i + 2], t[i + 3], t[i + 4], t[i + 5], t[i + 6], t[i + 7]];
        const c = Math.floor(x / tier / col);
        const [n0, n1] = needRange(meta, L, x / tier, (x + w) / tier);
        const idx = this.tiles.length;
        this.tiles.push({ layer: li, frame, col: c, x, y, w, h, file, sx, sy, n0, n1, img: null });
        this.fileTiles[file].push(idx);
        if (frame < out.length && c < out[frame].length) out[frame][c] = idx;
      }
      return out;
    });
  }

  /** Columns of layer `li` at this tier. */
  cols(li: number): number {
    return this.byCol[li][0].length;
  }

  /** The tile at a layer, frame and column: an index, or -1 (empty column). */
  at(li: number, frame: number, col: number): number {
    const fr = this.byCol[li];
    const row = fr[frame < fr.length ? frame : 0];
    return col >= 0 && col < row.length ? row[col] : -1;
  }

  /** Is a tile needed at camera x (within the policy's margins)? */
  needed(t: CanalTile, camX: number, ahead: number, behind: number): boolean {
    return this.whole || (t.n1 >= camX - behind && t.n0 <= camX + ahead + VIEW_W);
  }

  /** Free the tiles the camera has passed (more than `behind` px). */
  evict(camX: number, behind: number): void {
    if (this.whole) return;
    for (const t of this.tiles) {
      if (t.img && t.n1 < camX - behind) {
        this.px -= t.w * t.h;
        t.img = null;
      }
    }
  }

  /** Free every tile and the sprites. */
  clear(): void {
    for (const t of this.tiles) t.img = null;
    this.sprites = null;
    this.px = 0;
  }
}

/** A loaded (or loading) scene. */
export class CanalSceneState {
  readonly id: string;
  readonly man: CanalManifest;
  readonly sec: CanalSectionManifest;
  readonly skip: ReadonlySet<number>;
  readonly tiers = new Map<number, CanalTier>();
  /** A file failed: the section draws its old scenery. */
  failed = false;
  /** The camera the scene was last wanted at (the load queue's order, the eviction). */
  camX = 0;
  /** Priority rank: 0 = the scene a view draws, 1 = prefetched. */
  rank = 1;
  /**
   * The highest tier this scene loads and draws (its layers and its canal sprites): `LIT_LAYER_TIER`
   * for the lit stack of a pair (`canalLitState`; the memory decision of docs/api/canal.md "A lit
   * section"), else 4 (a lit stack drawn alone, as the fidelity test does, draws every tier).
   */
  layerCap = 4;

  constructor(id: string, man: CanalManifest, sec: CanalSectionManifest, skip: readonly string[]) {
    this.id = id;
    this.man = man;
    this.sec = sec;
    const ids = new Set(skip);
    this.skip = new Set(sec.layers.flatMap((l, i) => (ids.has(l.id) ? [i] : [])));
  }

  /** The baked tier to draw for a wanted density: the highest baked tier ≤ want (null: none baked). */
  bakedTier(want: number): number | null {
    for (const t of [4, 2, 1]) if (t <= want && this.sec.tiers[String(t)]) return t;
    return null;
  }

  /** Tier state (made on first use; null when that tier is not baked). */
  tier(t: number): CanalTier | null {
    let st = this.tiers.get(t);
    if (st) return st;
    const man = this.sec.tiers[String(t)];
    if (!man) return null;
    st = new CanalTier(t, man, this.sec, this.man.col, this.skip);
    this.tiers.set(t, st);
    return st;
  }

  /** Resident pixels and bytes: CPU buffers and owned textures (4 bytes per px each). */
  bytes(): { cpu: number; tex: number; px: number } {
    let cpu = 0;
    let tex = 0;
    for (const st of this.tiers.values()) {
      for (const t of st.tiles) {
        if (!t.img) continue;
        if (t.img instanceof PixelBuffer) cpu += t.img.data.byteLength;
        else tex += t.w * t.h * 4;
      }
      for (const f of st.sprites ?? []) cpu += f.buf.data.byteLength;
    }
    return { cpu, tex, px: (cpu + tex) / 4 };
  }

  clear(): void {
    for (const st of this.tiers.values()) {
      st.clear();
      st.busy.fill(0);
      st.spriteBusy = 0;
    }
  }
}

interface Job {
  scene: CanalSceneState;
  tier: CanalTier;
  /** A pack (index into the tier's files), or SPRITES: the tier's sprite sheet. */
  file: number;
  /** When it was queued (ms; the load log). */
  t: number;
}

/** The job of a tier's sprite sheet. */
const SPRITES = -1;

/** Every scene the store holds, by id. */
const scenes = new Map<string, CanalSceneState>();
const queue: Job[] = [];
let running = false;
const warned = new Set<string>();

function warnOnce(key: string, msg: string, err?: unknown): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg, err ?? '');
}

/** The state of a scene (made on first use), or null when the scene is not registered. */
export function canalState(id: string, skip: readonly string[] = []): CanalSceneState | null {
  let s = scenes.get(id);
  if (s) return s;
  const found = canalScene(id);
  if (!found) return null;
  s = new CanalSceneState(id, found.man, found.sec, skip);
  scenes.set(id, s);
  return s;
}

/** The state of the lit stack of a pair (made on first use): its layers capped at `LIT_LAYER_TIER`. */
export function canalLitState(id: string, skip: readonly string[] = []): CanalSceneState | null {
  const s = canalState(id, skip);
  if (s) s.layerCap = LIT_LAYER_TIER;
  return s;
}

/**
 * Make sure what scene `s` needs at camera x for density `want` is loaded or coming (and, unless
 * `prefetch`, free what the camera has passed). Loads at once with a synchronous source.
 */
export function wantCanal(s: CanalSceneState, want: number, camX: number, prefetch = false): void {
  if (s.failed) return;
  const src = canalSource();
  if (!src) return;
  // A lit stack draws at `layerCap` at most (its layers and its canal sprites).
  const top = s.bakedTier(Math.min(want, s.layerCap));
  if (top === null) {
    s.failed = true;
    warnOnce(`${s.id}:tiers`, `[canal] scene ${s.id}: no tier baked at or below ${want}; drawing the section's old scenery`);
    return;
  }
  s.camX = camX;
  if (!prefetch) s.rank = 0;
  const { ahead, behind } = s.man;
  const sync = typeof src.readSync === 'function' && typeof src.inflateSync === 'function';
  // Tier 1 first (the fallback, the whole section: `whole`), then the wanted tier; a synchronous source
  // loads only the wanted one (by its window).
  const tiers = sync || top === 1 ? [top] : [1, top];
  // A tier the scene no longer draws (the density changed) is freed at once.
  for (const st of s.tiers.values()) {
    if (tiers.includes(st.tier)) continue;
    if (st.wanted || st.px > 0) {
      st.wanted = false;
      st.clear();
    }
  }
  for (const t of tiers) {
    const st = s.tier(t);
    if (!st) continue;
    st.wanted = true;
    st.whole = !sync && t === 1 && policy.wholeFallback;
    if (!prefetch) st.evict(camX, behind);
    // The canal sprites: the tier's sheet, once (before its packs in the queue).
    const sp = st.man.sprites;
    if (sp && s.sec.sprites?.length && !st.sprites && !st.spriteBusy) {
      if (sync) {
        try {
          cutSprites(s, st, readSheet(src, s.man.base + sp.file));
        } catch (err) {
          fail(s, sp.file, err);
          return;
        }
      } else {
        st.spriteBusy = 1;
        queue.push({ scene: s, tier: st, file: SPRITES, t: now() });
      }
    }
    const files = st.man.files;
    for (let f = 0; f < files.length; f++) {
      if (st.busy[f] || (!st.whole && st.man.fileCam[f] > camX + ahead)) continue;
      let missing = false;
      for (const i of st.fileTiles[f]) {
        const t = st.tiles[i];
        if (!t.img && st.needed(t, camX, ahead, behind)) {
          missing = true;
          break;
        }
      }
      if (!missing) continue;
      if (sync) {
        try {
          cutTiles(s, st, f, readSheet(src, s.man.base + files[f]), false);
        } catch (err) {
          fail(s, files[f], err);
          return;
        }
      } else {
        st.busy[f] = 1;
        queue.push({ scene: s, tier: st, file: f, t: now() });
      }
    }
  }
  if (!sync && queue.length > 0 && !running) void pump(src);
}

/** A sheet from a synchronous source (node tools, tests). */
function readSheet(src: CanalSource, path: string): PixelBuffer {
  const bytes = (src.readSync as (p: string) => Uint8Array)(path);
  const p = parsePng(bytes);
  const raw = (src.inflateSync as (d: Uint8Array) => Uint8Array)(p.data);
  const sheet = new PixelBuffer(p.w, p.h);
  unfilterRows(p, raw, sheet, 0, p.h);
  return sheet;
}

/** Cut a tier's sprite sheet into its frames (the game's 1× geometry at the tier's density). */
function cutSprites(s: CanalSceneState, st: CanalTier, sheet: PixelBuffer): void {
  const list = s.sec.sprites ?? [];
  const xy = st.man.sprites?.xy ?? [];
  const T = st.tier;
  const out: Frame[] = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const w = e.w * T;
    const h = e.h * T;
    const sx = xy[2 * i];
    const sy = xy[2 * i + 1];
    if (!(sx >= 0 && sy >= 0 && sx + w <= sheet.w && sy + h <= sheet.h)) throw new Error(`sprite ${e.id} frame ${e.frame} lies outside its sheet`);
    const buf = new PixelBuffer(w, h);
    for (let y = 0; y < h; y++) buf.data.set(sheet.data.subarray((sy + y) * sheet.w + sx, (sy + y) * sheet.w + sx + w), y * w);
    buf.touch();
    out.push(T === 1 ? { buf, ox: e.ox, oy: e.oy } : { buf, ox: e.ox, oy: e.oy, density: T });
    st.px += w * h;
  }
  st.sprites = out;
}

function fail(s: CanalSceneState, file: string, err: unknown): void {
  s.failed = true;
  s.clear();
  warnOnce(`${s.id}:fail`, `[canal] scene ${s.id}: ${file} could not be loaded; the section draws its old scenery:`, err);
}

/** Cut a decoded sheet into the tiles of file f that the camera still needs (and make textures). */
function cutTiles(s: CanalSceneState, st: CanalTier, f: number, sheet: PixelBuffer, textures: boolean): void {
  const tex = textures ? canalTextureOf() : null;
  const { ahead, behind } = s.man;
  if (!st.wanted) return;
  for (const i of st.fileTiles[f]) {
    const t = st.tiles[i];
    if (t.img || !st.needed(t, s.camX, ahead, behind)) continue;
    const buf = new PixelBuffer(t.w, t.h);
    const sd = sheet.data;
    const bd = buf.data;
    for (let y = 0; y < t.h; y++) bd.set(sd.subarray((t.sy + y) * sheet.w + t.sx, (t.sy + y) * sheet.w + t.sx + t.w), y * t.w);
    buf.touch();
    t.img = tex ? tex(buf) : buf;
    st.px += t.w * t.h;
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yieldNow = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** The next job: the drawn scene first, tier 1 first, then by window. */
function nextJob(): Job | null {
  if (queue.length === 0) return null;
  let best = 0;
  // The drawn scene first; by window, a sprite sheet first, the tier-1 fallback LEAD px ahead of the wanted tier.
  const key = (j: Job): number =>
    j.scene.rank * 1e9 + (j.file === SPRITES ? -1e6 : j.tier.man.fileCam[j.file] - (j.tier.tier === 1 ? FALLBACK_LEAD : 0));
  for (let i = 1; i < queue.length; i++) if (key(queue[i]) < key(queue[best])) best = i;
  return queue.splice(best, 1)[0];
}

/** A file read and waiting for its decode (the loader). */
interface Fetched {
  job: Job;
  bytes: Uint8Array | null;
  err: unknown;
  start: number;
  read: number;
}

/** Reads in flight and the files read, waiting to be decoded. */
let reading = 0;
const fetched: Fetched[] = [];
/** Wakes the decode loop when a read ends. */
let wake: (() => void) | null = null;

/** Is a job of no use any more (its scene failed or went, its tier is not drawn)? Clears its busy mark. */
function stale(job: Job): boolean {
  const { scene: s, tier: st, file: f } = job;
  if (!s.failed && scenes.get(s.id) === s && st.wanted) return false;
  if (f === SPRITES) st.spriteBusy = 0;
  else st.busy[f] = 0;
  return true;
}

/** Start reads of the best queued jobs, up to `PARALLEL_READS` at a time (the network's latency overlaps). */
function startReads(src: CanalSource): void {
  while (reading < policy.reads) {
    const job = nextJob();
    if (!job) return;
    if (stale(job)) continue;
    const name = job.file === SPRITES ? (job.tier.man.sprites?.file ?? '') : job.tier.man.files[job.file];
    const start = now();
    reading++;
    src.read(job.scene.man.base + name).then(
      (bytes) => {
        fetched.push({ job, bytes, err: null, start, read: now() });
      },
      (err: unknown) => {
        fetched.push({ job, bytes: null, err, start, read: now() });
      },
    ).finally(() => {
      reading--;
      const w = wake;
      wake = null;
      if (w) w();
    });
  }
}

/** The best read file to decode (the same order as the queue). */
function nextFetched(): Fetched | null {
  if (fetched.length === 0) return null;
  let best = 0;
  const key = (j: Job): number => j.scene.rank * 1e9 + (j.file === SPRITES ? -1e6 : j.tier.man.fileCam[j.file] - (j.tier.tier === 1 ? FALLBACK_LEAD : 0));
  for (let i = 1; i < fetched.length; i++) if (key(fetched[i].job) < key(fetched[best].job)) best = i;
  return fetched.splice(best, 1)[0];
}

/**
 * The background loader: up to `PARALLEL_READS` reads at once, one decode at a time (the best read
 * first), the row filters in time slices.
 */
async function pump(src: CanalSource): Promise<void> {
  running = true;
  try {
    for (;;) {
      startReads(src);
      const fe = nextFetched();
      if (!fe) {
        if (reading === 0 && queue.length === 0) break;
        await new Promise<void>((r) => {
          wake = r;
        });
        continue;
      }
      const { job, start } = fe;
      const { scene: s, tier: st, file: f } = job;
      const name = f === SPRITES ? (st.man.sprites?.file ?? '') : st.man.files[f];
      let px = 0;
      try {
        if (stale(job)) continue;
        if (fe.err !== null || !fe.bytes) throw fe.err ?? new Error(`no bytes for ${name}`);
        const p = parsePng(fe.bytes);
        const raw = await inflateStream(p.data);
        const sheet = new PixelBuffer(p.w, p.h);
        px = p.w * p.h;
        let y = 0;
        while (y < p.h) {
          const t0 = now();
          let y1 = y;
          while (y1 < p.h && now() - t0 < SLICE_MS) {
            const step = Math.min(p.h, y1 + 16);
            unfilterRows(p, raw, sheet, y1, step);
            y1 = step;
          }
          y = y1;
          if (y < p.h) await yieldNow();
        }
        if (s.failed || scenes.get(s.id) !== s) continue;
        if (f === SPRITES) {
          if (st.wanted) cutSprites(s, st, sheet);
        } else cutTiles(s, st, f, sheet, true);
      } catch (err) {
        fail(s, name, err);
      } finally {
        if (f === SPRITES) st.spriteBusy = 0;
        else st.busy[f] = 0;
        if (loadLog) loadLog.push({ file: name, bytes: fe.bytes?.length ?? 0, px, queued: job.t, start, read: fe.read, done: now(), cam: s.camX });
      }
      await yieldNow();
    }
  } finally {
    running = false;
  }
}

/** One loaded file of the load log (`setCanalLoadLog`): times in ms (performance.now). */
export interface CanalLoadEntry {
  file: string;
  bytes: number;
  /** Decoded px. */
  px: number;
  queued: number;
  start: number;
  read: number;
  done: number;
  /** The scene's camera when it was done. */
  cam: number;
}

let loadLog: CanalLoadEntry[] | null = null;

/** The browser check: log every file the background loader loads (null: stop). Returns the log. */
export function setCanalLoadLog(on: boolean): CanalLoadEntry[] | null {
  loadLog = on ? [] : null;
  return loadLog;
}

export function canalLoadLog(): CanalLoadEntry[] | null {
  return loadLog;
}

/** Free a scene's tiles and drop its queued packs (the section is over). */
export function releaseCanal(id: string): void {
  const s = scenes.get(id);
  if (!s) return;
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].scene === s) queue.splice(i, 1);
  for (let i = fetched.length - 1; i >= 0; i--) if (fetched[i].job.scene === s) fetched.splice(i, 1);
  s.clear();
  scenes.delete(id);
}

/** The ids of the scenes the store holds. */
export function scenesHeld(): string[] {
  return [...scenes.keys()];
}

/** Is anything queued or loading (tools, tests)? */
export function canalBusy(): boolean {
  return running || queue.length > 0 || reading > 0 || fetched.length > 0;
}

/** Resolves when nothing is queued or loading (tools, tests). */
export async function canalIdle(): Promise<void> {
  while (canalBusy()) await yieldNow();
}

/** Each held scene's resident bytes by scene id (the browser check, `window.__ms3.canal.scenes()`). */
export function canalSceneBytes(): Record<string, { cpu: number; tex: number }> {
  const out: Record<string, { cpu: number; tex: number }> = {};
  for (const [id, s] of scenes) out[id] = s.bytes();
  return out;
}

/** Every scene's resident bytes (the memory report). */
export function canalBytes(): { cpu: number; tex: number } {
  let cpu = 0;
  let tex = 0;
  for (const s of scenes.values()) {
    const b = s.bytes();
    cpu += b.cpu;
    tex += b.tex;
  }
  return { cpu, tex };
}

/** Tests: forget every scene and warning. */
export function resetCanalStore(): void {
  for (const s of scenes.values()) s.clear();
  scenes.clear();
  queue.length = 0;
  fetched.length = 0;
  warned.clear();
}
