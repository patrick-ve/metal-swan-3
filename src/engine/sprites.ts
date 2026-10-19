import { MAGENTA } from './color';
import { PixelBuffer } from './pixel';
import type { Frame } from './render';

export type { Frame } from './render';
export { frameDensity, frameH, frameW } from './render';

/**
 * Sprite registry and animation (docs/ARCHITECTURE.md §5.4, docs/api/media.md).
 *
 * Sprites are lazily generated frame strips registered by id (slash paths such as
 * 'enemy/rifleman/run'). The generator runs on first use (or in preloadSprites) and the frames
 * are cached. Missing ids and failing generators never crash: they give a magenta placeholder
 * and warn once per id.
 *
 * Anchor convention: drawing a frame at (x, y) puts buffer pixel (ox, oy) on (x, y). Flipping
 * mirrors around that pixel, so a point at +dx becomes −dx (see render-common.ts).
 * - 'feet' (default): ox = floor(w / 2), oy = h — the frame stands ON the line y (its lowest
 *   row is y − 1).
 * - 'center': ox = floor(w / 2), oy = floor(h / 2).
 * - 'top-left': (0, 0).
 * - [ox, oy]: explicit pixel in the buffer.
 * Anchors are logical pixels: for a frame of density d (2× art) 'feet' is (floor(w / 2), h) of
 * the logical size w × h = buffer size / d, and [ox, oy] is a logical pixel.
 *
 * 2× art (docs/ARCHITECTURE.md §3, docs/ART_GUIDE.md "2x art (mission ams)"): `defineHiSprite(id,
 * gen2x)` (or `defineSprite(id, gen, { hi: gen2x })`) adds a second generator for an existing id
 * whose frames have density 2 (buffers twice as wide and high). getFrames / getFrame return them
 * only while the art density is 2 (`setArtDensity`, set by the mission runner for a mission with
 * `artDensity: 2` around its drawing) AND a 2× generator exists; otherwise the 1× frames. Both are
 * cached separately. The 2× frames always get the logical geometry of the 1× frames — frame
 * count, logical size, anchor and every point — so game logic sees the same numbers at either
 * density: each 2× frame is re-framed to its 1× frame's rectangle (pixels outside it are cut and
 * reported once), its points are the 1× points, and a wrong frame count or odd buffer size makes
 * the id fall back to its 1× frames with a warning (`spriteErrors()` lists it as 'id@2x').
 */

export type SpriteAnchor = 'feet' | 'center' | 'top-left' | readonly [number, number];
/** Named points relative to the anchor of the unflipped frame. */
export type FramePoints = Readonly<Record<string, readonly [number, number]>>;
export type SpriteGenResult = Frame | PixelBuffer | readonly (Frame | PixelBuffer)[];
export type SpriteGen = () => SpriteGenResult;

export interface SpriteOpts {
  /** Anchor for frames returned as PixelBuffers (default 'feet'). Frames keep their own. */
  anchor?: SpriteAnchor;
  /** Points for all frames (one record) or per frame (array, cycled). Frames' own pts win. */
  pts?: FramePoints | readonly FramePoints[];
  /** Default Animator speed in ticks per frame (default 6). */
  ticksPerFrame?: number;
  /** Default per-frame durations in ticks (cycled; overrides ticksPerFrame). */
  durations?: readonly number[];
  /** Default Animator loop flag (default true). */
  loop?: boolean;
  /**
   * Trim transparent margins of each frame; anchors and points stay correct. Default false.
   * For frames of density d the trimmed box is widened to whole logical pixels.
   */
  trim?: boolean;
  /** A 2× generator for this id (same as `defineHiSprite(id, hi)`). */
  hi?: SpriteGen;
  /**
   * Deferred (rare cosmetic strips, e.g. fidgets): the boot preload skips it (`skipDeferred`),
   * and every other preload makes it after its `last` ids. Made on first use otherwise.
   */
  defer?: boolean;
}

/** Animation defaults of a sprite, used by Animator.play. */
export interface SpriteAnimInfo {
  readonly ticksPerFrame: number;
  readonly durations: readonly number[] | undefined;
  readonly loop: boolean;
}

interface Entry {
  readonly id: string;
  readonly gen: SpriteGen;
  readonly opts: SpriteOpts;
  frames: readonly Frame[] | null;
  error: string | null;
}

/** A 2× generator and its cached frames (density 2). */
interface HiEntry {
  readonly gen: SpriteGen;
  frames: readonly Frame[] | null;
  error: string | null;
}

/** Density of 2× art. */
export const HI_DENSITY = 2;

const registry = new Map<string, Entry>();
const hiRegistry = new Map<string, HiEntry>();
/** The art density getFrames uses when none is passed (1, or 2 while a 2× mission draws). */
let density = 1;
/** False: getFrames ignores the 2× generators (`setHiArt`, tools and tests). */
let hiArt = true;
/** Sprite id of every generated frame buffer (the first id wins when ids share a buffer). */
const bufferIds = new WeakMap<PixelBuffer, string>();
const warned = new Set<string>();
const DEFAULT_TPF = 6;

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

/** 12×12 magenta box with a dark cross, anchored at its feet. */
function makePlaceholder(): readonly Frame[] {
  const b = new PixelBuffer(12, 12).fill(MAGENTA).strokeRect(0, 0, 12, 12, 0x100b14ff);
  b.line(2, 2, 9, 9, 0x100b14ff).line(9, 2, 2, 9, 0x100b14ff);
  return [{ buf: b, ox: 6, oy: 12 }];
}

let placeholder: readonly Frame[] | null = null;

/** The shared placeholder strip (one frame). */
export function placeholderFrames(): readonly Frame[] {
  placeholder ??= makePlaceholder();
  return placeholder;
}

/**
 * Register a lazily generated sprite. Redefining an id replaces it (and drops its cache).
 *
 * ```ts
 * defineSprite('fx/spark', () => [0, 1, 2].map((i) => new PixelBuffer(5, 5).circle(2, 2, 2 - i, PAL.gold[3])),
 *   { anchor: 'center', ticksPerFrame: 3, loop: false });
 * ```
 */
export function defineSprite(id: string, gen: SpriteGen, opts: SpriteOpts = {}): void {
  registry.set(id, { id, gen, opts, frames: null, error: null });
  const hi = hiRegistry.get(id);
  if (opts.hi) defineHiSprite(id, opts.hi);
  else if (hi) hi.frames = null; // the 2× frames take their geometry from the 1× frames
}

/**
 * Register a 2× generator for sprite `id` (defined before or after with defineSprite). It returns
 * the same number of frames as the 1× generator, each a PixelBuffer twice the size (density 2),
 * or a Frame whose `ox` / `oy` (and optional `pts`) are LOGICAL pixels and must equal the 1×
 * frame's. Buffers are anchored like the 1× ones (the sprite's `anchor` option, on the logical
 * size). Inside the generator getFrames(other) returns 1× frames; ask for 2× parts explicitly
 * with getFrames(other, 2) and compose them with `blitFrame(f, x, y, o, 2)`.
 *
 * ```ts
 * defineHiSprite('fx/spark', () => [0, 1, 2].map((i) => new PixelBuffer(10, 10).circle(4.5, 4.5, 4 - 2 * i, PAL.gold[3])));
 * ```
 */
export function defineHiSprite(id: string, gen: SpriteGen): void {
  hiRegistry.set(id, { gen, frames: null, error: null });
}

/** Is `id` registered with `defer: true` (SpriteOpts.defer)? */
export function isDeferredSprite(id: string): boolean {
  return registry.get(id)?.opts.defer === true;
}

export function hasSprite(id: string): boolean {
  return registry.has(id);
}

/** Does `id` have a 2× generator? */
export function hasHiSprite(id: string): boolean {
  return hiRegistry.has(id);
}

/** Ids with a 2× generator (sorted), optionally only those starting with `prefix`. */
export function listHiSprites(prefix = ''): string[] {
  const out: string[] = [];
  for (const id of hiRegistry.keys()) if (id.startsWith(prefix)) out.push(id);
  return out.sort();
}

/**
 * Set the art density getFrames / getFrame use by default (1 or 2; other values clamp) and
 * return the previous one. The mission runner sets its mission's `artDensity` around drawing
 * and restores the old value, so everything else (other missions, title, attract demo, tests,
 * game logic) sees density 1.
 */
export function setArtDensity(d: number): number {
  const prev = density;
  density = d >= HI_DENSITY ? HI_DENSITY : 1;
  return prev;
}

/**
 * Switch 2× art on or off globally (default on) and return the previous value. Off, getFrames
 * gives the 1× frames at every density — for tests that compare a res-k image with the res-1
 * image enlarged, and for tools that show a 2× mission with its 1× art.
 */
export function setHiArt(on: boolean): boolean {
  const prev = hiArt;
  hiArt = on;
  return prev;
}

/** The current art density (1 or 2). */
export function artDensity(): number {
  return density;
}

/** Run `fn` with art density `d`, then restore the previous density (also when `fn` throws). */
export function withArtDensity<T>(d: number, fn: () => T): T {
  const prev = setArtDensity(d);
  try {
    return fn();
  } finally {
    density = prev;
  }
}

/** False: getFrames ignores the 2× generators (see `setHiArt`). Scenery reads it too. */
export function hiArtOn(): boolean {
  return hiArt;
}

// ------------------------------------------------------------------------------- art jobs

/**
 * Deferred 2× art jobs: work that is not a sprite id but belongs to the same budgeted 2× preload,
 * such as the 2× background layers and terrain chunks of the section on screen (SectionView).
 * While `setDeferHiArt(true)` (the browser app with a 2× mission) such work is queued instead of
 * done on the spot, and the caller draws its 1× art until the job has run. A running budgeted 2×
 * preload (`preloadSprites` with `density` 2 and `timeBudgetMs`) runs queued jobs before its next
 * sprite id, within the same time budget; without one, the owner calls `runArtJobs(budget)` once
 * per frame. Deferral is off by default, so headless tools and tests build 2× scenery at once.
 */
const artJobs = new Map<string, () => void>();
let deferHi = false;
let budgetedPreloads = 0;

/** Time budget (ms) per browser frame of 2× art work: about half a 60 fps frame. */
export const HI_ART_FRAME_BUDGET_MS = 8;

/** Defer 2× scenery work to the job queue (true) or do it on the spot (false, default); returns the previous value. */
export function setDeferHiArt(on: boolean): boolean {
  const prev = deferHi;
  deferHi = on;
  return prev;
}

export function hiArtDeferred(): boolean {
  return deferHi;
}

/** Queue a job under `key` (a key already queued keeps its first job). */
export function queueArtJob(key: string, run: () => void): void {
  if (!artJobs.has(key)) artJobs.set(key, run);
}

export function hasArtJob(key: string): boolean {
  return artJobs.has(key);
}

/** Drop every queued job whose key starts with `prefix` (a section view that is gone). */
export function cancelArtJobs(prefix: string): void {
  for (const key of [...artJobs.keys()]) if (key.startsWith(prefix)) artJobs.delete(key);
}

export function pendingArtJobs(): number {
  return artJobs.size;
}

/** Is a budgeted 2× preload running (it runs the queued jobs itself)? */
export function artPreloadActive(): boolean {
  return budgetedPreloads > 0;
}

/** Run the oldest queued job (false when none). A throwing job is dropped with a warning. */
function runOneArtJob(): boolean {
  const first = artJobs.entries().next();
  if (first.done) return false;
  const [key, run] = first.value;
  artJobs.delete(key);
  try {
    run();
  } catch (err) {
    warnOnce(`job:${key}`, `[sprites] 2× art job "${key}" failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return true;
}

/**
 * Run queued jobs, oldest first, until `budgetMs` has passed (checked after each job, so at least
 * one runs when any is queued). Returns the number of jobs run.
 */
export function runArtJobs(budgetMs: number, now: () => number = clock): number {
  const t0 = now();
  let n = 0;
  while (runOneArtJob()) {
    n++;
    if (now() - t0 >= budgetMs) break;
  }
  return n;
}

/** Registered ids (sorted), optionally only those starting with `prefix`. */
export function listSprites(prefix = ''): string[] {
  const out: string[] = [];
  for (const id of registry.keys()) if (id.startsWith(prefix)) out.push(id);
  return out.sort();
}

/**
 * Ids (sorted) whose frames at density `d` exist and came from their own generator without an
 * error (generated or installed). `d` 2 lists the ids with 2× frames. The sprite cache saves these.
 */
export function generatedSprites(d = 1, prefix = ''): string[] {
  const out: string[] = [];
  if (d >= HI_DENSITY) {
    for (const [id, h] of hiRegistry) if (h.frames && !h.error && id.startsWith(prefix)) out.push(id);
  } else {
    for (const e of registry.values()) if (e.frames && !e.error && e.id.startsWith(prefix)) out.push(e.id);
  }
  return out.sort();
}

/**
 * The frames of `id` at density `d` (2: its 2× frames) when they exist without an error, else
 * null. Never generates (the sprite cache reads what is already made).
 */
export function readyFrames(id: string, d = 1): readonly Frame[] | null {
  const e = d >= HI_DENSITY ? hiRegistry.get(id) : registry.get(id);
  return e?.frames && !e.error ? e.frames : null;
}

/**
 * Give a registered id frames made earlier by its own generator (the sprite cache), so it never
 * runs the generator. `d` 2 installs 2× frames (the id needs a 2× generator). Only an id without
 * frames takes them; returns true when it did.
 */
export function installFrames(id: string, d: number, frames: readonly Frame[]): boolean {
  const e = d >= HI_DENSITY ? hiRegistry.get(id) : registry.get(id);
  if (!e || e.frames || frames.length === 0) return false;
  e.frames = frames;
  e.error = null;
  for (const f of frames) if (!bufferIds.has(f.buf)) bufferIds.set(f.buf, id);
  return true;
}

/**
 * The sprite id whose frames contain this buffer, or undefined (backgrounds, terrain, buffers made
 * by game code, placeholders). Renderers use it to decide which buffers the upscaler filters.
 */
export function spriteIdOf(buf: PixelBuffer): string | undefined {
  return bufferIds.get(buf);
}

/**
 * Frames of a sprite (generated on first use, then cached). Missing → placeholder + warn once.
 * `d` (default: the art density, `setArtDensity`): 2 gives the 2× frames when the id has a 2×
 * generator, else the 1× frames; 1 always gives the 1× frames.
 */
export function getFrames(id: string, d: number = density): readonly Frame[] {
  if (d >= HI_DENSITY && hiArt) {
    const h = hiRegistry.get(id);
    if (h) {
      if (!h.frames) generateHi(id, h);
      return h.frames as readonly Frame[];
    }
  }
  const e = registry.get(id);
  if (!e) {
    warnOnce(id, `[sprites] unknown sprite "${id}" — drawing a placeholder`);
    return placeholderFrames();
  }
  if (!e.frames) generate(e);
  return e.frames as readonly Frame[];
}

/**
 * Frame `index` of a sprite, wrapped into range (negative indexes count from the end). `d` as in
 * getFrames.
 */
export function getFrame(id: string, index: number, d: number = density): Frame {
  const frames = getFrames(id, d);
  const n = frames.length;
  let i = Math.floor(index) % n;
  if (i < 0) i += n;
  return frames[i];
}

export function frameCount(id: string): number {
  return getFrames(id).length;
}

/** Animation defaults declared with defineSprite (fallbacks for unknown ids). */
export function spriteAnim(id: string): SpriteAnimInfo {
  const o = registry.get(id)?.opts;
  return {
    ticksPerFrame: o?.ticksPerFrame ?? DEFAULT_TPF,
    durations: o?.durations,
    loop: o?.loop ?? true,
  };
}

/**
 * Generation errors so far (ids whose generator threw or returned nothing usable). A failing 2×
 * generator is listed as `id@2x` (that id then draws its 1× frames).
 */
export function spriteErrors(): Array<{ id: string; error: string }> {
  const out: Array<{ id: string; error: string }> = [];
  for (const e of registry.values()) if (e.error) out.push({ id: e.id, error: e.error });
  for (const [id, h] of hiRegistry) if (h.error) out.push({ id: `${id}@2x`, error: h.error });
  return out;
}

/** Drop cached frames (all, or one id; 1× and 2×) so they regenerate on next use. For tools and tests. */
export function clearSpriteCache(id?: string): void {
  for (const e of registry.values()) {
    if (id === undefined || e.id === id) {
      e.frames = null;
      e.error = null;
    }
  }
  for (const [hid, h] of hiRegistry) {
    if (id === undefined || hid === id) {
      h.frames = null;
      h.error = null;
    }
  }
}

export interface PreloadOpts {
  /**
   * Sprites generated between yields (default 24; no limit when `timeBudgetMs` is set, unless
   * given as well).
   */
  batch?: number;
  /**
   * Time budget (ms) of one slice: generate ids until this much time has passed, then yield.
   * Checked after each id, so a slice is at least one id and can end one id over the budget.
   * For a preload that runs while the game draws (one slice per browser frame).
   */
  timeBudgetMs?: number;
  /** Clock for `timeBudgetMs` (default performance.now, else Date.now). For tests. */
  now?: () => number;
  /**
   * Id prefixes to generate first, in this order (the ids of the first prefix, then those of the
   * second, …); the other ids follow in id order.
   */
  first?: readonly string[];
  /** Id prefixes to generate last, in this order, after every other id (deferred ids follow). */
  last?: readonly string[];
  /** Leave out the deferred ids (SpriteOpts.defer) — for the boot preload. */
  skipDeferred?: boolean;
  /**
   * 1 (default): the 1× frames of every matching id. 2: the 2× frames of the matching ids that
   * have a 2× generator (and nothing else) — for a 2× mission's start, not for boot.
   */
  density?: number;
  /** How to yield between batches (default: a 0 ms timeout, so the browser can paint). */
  yieldFn?: () => Promise<void>;
}

export interface PreloadReport {
  total: number;
  failed: string[];
}

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Sort `ids` (id order) by `first` / `last` priority: ids under first[0], first[1], …, then the
 * rest, then ids under last[0], last[1], …, then the deferred ids (SpriteOpts.defer). An id under
 * a `first` prefix never moves to `last`; a deferred id always goes to the end.
 */
export function preloadOrder(ids: string[], first: readonly string[], last: readonly string[]): string[] {
  const rank = (id: string): number => {
    if (isDeferredSprite(id)) return first.length + 1 + last.length;
    const f = first.findIndex((p) => id.startsWith(p));
    if (f >= 0) return f;
    const l = last.findIndex((p) => id.startsWith(p));
    return l >= 0 ? first.length + 1 + l : first.length;
  };
  const ranked = ids.sort().map((id) => [rank(id), id] as const);
  // Array.prototype.sort is stable: equal ranks keep the id order.
  return ranked.sort((a, b) => a[0] - b[0]).map(([, id]) => id);
}

/**
 * Generate every sprite (or those whose id starts with one of `prefixes`) in slices (`batch` ids,
 * or `timeBudgetMs` of work), yielding between slices; `first` / `last` set the order. Progress is
 * reported after each slice. Never rejects; failures become placeholders and are reported.
 */
export async function preloadSprites(
  prefixes?: string | readonly string[],
  onProgress?: (done: number, total: number) => void,
  opts?: PreloadOpts,
): Promise<PreloadReport> {
  const list = prefixes === undefined ? [''] : typeof prefixes === 'string' ? [prefixes] : prefixes;
  const hi = (opts?.density ?? 1) >= HI_DENSITY;
  const ids = preloadOrder(
    [...(hi ? hiRegistry : registry).keys()].filter(
      (id) => list.some((p) => id.startsWith(p)) && !(opts?.skipDeferred && isDeferredSprite(id)),
    ),
    opts?.first ?? [],
    opts?.last ?? [],
  );
  const budget = opts?.timeBudgetMs;
  const batch = Math.max(1, opts?.batch ?? (budget === undefined ? 24 : Infinity));
  const now = opts?.now ?? clock;
  const yieldFn = opts?.yieldFn ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const failed: string[] = [];
  let inSlice = 0;
  let sliceStart = budget === undefined ? 0 : now();
  // A budgeted 2× preload also runs the queued 2× art jobs, before its next id and within the
  // same budget (the scenery on screen first); a slice they fill ends there and the id waits.
  const jobs = hi && budget !== undefined;
  if (jobs) budgetedPreloads++;
  try {
    for (let i = 0; i < ids.length; i++) {
      if (jobs && artJobs.size > 0) {
        do runOneArtJob();
        while (artJobs.size > 0 && now() - sliceStart < (budget as number));
        if (now() - sliceStart >= (budget as number)) {
          await yieldFn();
          inSlice = 0;
          sliceStart = now();
          i--;
          continue;
        }
      }
      if (hi) {
        const h = hiRegistry.get(ids[i]);
        if (h && !h.frames) generateHi(ids[i], h);
        if (h?.error) failed.push(`${ids[i]}@2x`);
      } else {
        const e = registry.get(ids[i]);
        if (e && !e.frames) generate(e);
        if (e?.error) failed.push(e.id);
      }
      inSlice++;
      const spent = budget !== undefined && now() - sliceStart >= budget;
      if (inSlice >= batch || spent || i + 1 === ids.length) {
        onProgress?.(i + 1, ids.length);
        if (i + 1 < ids.length) {
          await yieldFn();
          inSlice = 0;
          if (budget !== undefined) sliceStart = now();
        }
      }
    }
  } finally {
    if (jobs) budgetedPreloads--;
  }
  if (ids.length === 0) onProgress?.(0, 0);
  return { total: ids.length, failed };
}

/** Run a generator at art density 1 (its getFrame calls get 1× parts) and list its items. */
function runGen(gen: SpriteGen): readonly (Frame | PixelBuffer)[] {
  const prev = density;
  density = 1;
  try {
    const result = gen();
    const items: readonly (Frame | PixelBuffer)[] = Array.isArray(result)
      ? (result as readonly (Frame | PixelBuffer)[])
      : [result as Frame | PixelBuffer];
    if (items.length === 0) throw new Error('generator returned no frames');
    return items;
  } finally {
    density = prev;
  }
}

function generate(e: Entry): void {
  try {
    const items = runGen(e.gen);
    e.frames = items.map((item, i) => normalize(item, i, e.opts));
    e.error = null;
    for (const f of e.frames) if (!bufferIds.has(f.buf)) bufferIds.set(f.buf, e.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    e.error = msg;
    e.frames = placeholderFrames();
    warnOnce(`gen:${e.id}`, `[sprites] generator for "${e.id}" failed: ${msg} — drawing a placeholder`);
  }
}

/**
 * Generate the 2× frames of `id`: re-framed to the 1× geometry (see the module comment). Any
 * failure falls back to the 1× frames, so a broken 2× generator never changes what is drawn
 * beyond losing the extra detail.
 */
function generateHi(id: string, h: HiEntry): void {
  const base = getFrames(id, 1);
  const e = registry.get(id);
  if (!e || e.error) {
    h.frames = base;
    h.error = e ? null : 'no 1× sprite with this id';
    if (!e) warnOnce(`hi:${id}`, `[sprites] 2× art for unknown sprite "${id}" — ignored`);
    return;
  }
  try {
    const items = runGen(h.gen);
    if (items.length !== base.length) throw new Error(`${items.length} frames, the 1× sprite has ${base.length}`);
    h.frames = items.map((item, i) => normalizeHi(id, item, i, e.opts, base[i]));
    h.error = null;
    for (const f of h.frames) if (!bufferIds.has(f.buf)) bufferIds.set(f.buf, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    h.error = msg;
    h.frames = base;
    warnOnce(`hi:${id}`, `[sprites] 2× generator for "${id}" failed: ${msg} — drawing the 1× frames`);
  }
}

function isBuffer(x: unknown): x is PixelBuffer {
  return x instanceof PixelBuffer;
}

/** Anchor (logical px) of a buffer of density d. */
function anchorOf(buf: PixelBuffer, a: SpriteAnchor | undefined, d = 1): [number, number] {
  const w = Math.floor(buf.w / d);
  const h = Math.floor(buf.h / d);
  if (a === undefined || a === 'feet') return [w >> 1, h];
  if (a === 'center') return [w >> 1, h >> 1];
  if (a === 'top-left') return [0, 0];
  return [Math.round(a[0]), Math.round(a[1])];
}

function samePoints(a: FramePoints | undefined, b: FramePoints | undefined): boolean {
  const ka = a ? Object.keys(a) : [];
  const kb = b ? Object.keys(b) : [];
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const p = (a as FramePoints)[k];
    const q = b?.[k];
    if (!q || p[0] !== q[0] || p[1] !== q[1]) return false;
  }
  return true;
}

/** A 2× item → a density-2 frame with exactly the logical geometry of the 1× frame `base`. */
function normalizeHi(id: string, item: Frame | PixelBuffer, i: number, opts: SpriteOpts, base: Frame): Frame {
  const d = HI_DENSITY;
  let buf: PixelBuffer;
  let ox: number;
  let oy: number;
  if (isBuffer(item)) {
    buf = item;
    if (buf.w % d !== 0 || buf.h % d !== 0) throw new Error(`frame ${i} is ${buf.w}×${buf.h}, not a multiple of ${d}`);
    [ox, oy] = anchorOf(buf, opts.anchor, d);
  } else if (item && isBuffer((item as Frame).buf)) {
    buf = item.buf;
    if ((item.density ?? d) !== d) throw new Error(`frame ${i} has density ${String(item.density)}, expected ${d}`);
    if (buf.w % d !== 0 || buf.h % d !== 0) throw new Error(`frame ${i} is ${buf.w}×${buf.h}, not a multiple of ${d}`);
    ox = Math.round(item.ox);
    oy = Math.round(item.oy);
    if (item.pts && !samePoints(item.pts, base.pts)) throw new Error(`frame ${i}: points differ from the 1× frame`);
  } else {
    throw new Error(`frame ${i} is not a PixelBuffer or Frame`);
  }
  const bd = base.density ?? 1;
  const bw = base.buf.w / bd;
  const bh = base.buf.h / bd;
  // The 1× frame's rectangle in this buffer's logical pixels.
  const x = ox - base.ox;
  const y = oy - base.oy;
  if (x !== 0 || y !== 0 || buf.w !== bw * d || buf.h !== bh * d) {
    const cut = opaqueOutside(buf, x * d, y * d, bw * d, bh * d);
    if (cut > 0) warnOnce(`hi-cut:${id}`, `[sprites] 2× frame ${i} of "${id}" has ${cut} pixels outside the 1× frame — cut`);
    buf = buf.crop(x * d, y * d, bw * d, bh * d);
  }
  return base.pts ? { buf, ox: base.ox, oy: base.oy, pts: base.pts, density: d } : { buf, ox: base.ox, oy: base.oy, density: d };
}

/** Opaque pixels of `buf` outside the rectangle (x, y, w, h). */
function opaqueOutside(buf: PixelBuffer, x: number, y: number, w: number, h: number): number {
  let n = 0;
  const data = buf.data;
  for (let py = 0; py < buf.h; py++) {
    const inY = py >= y && py < y + h;
    for (let px = 0; px < buf.w; px++) {
      if (inY && px >= x && px < x + w) continue;
      if ((data[py * buf.w + px] & 255) !== 0) n++;
    }
  }
  return n;
}

function pointsFor(opts: SpriteOpts, i: number): FramePoints | undefined {
  const p = opts.pts;
  if (p === undefined) return undefined;
  if (Array.isArray(p)) return p.length > 0 ? (p as readonly FramePoints[])[i % p.length] : undefined;
  return p as FramePoints;
}

function normalize(item: Frame | PixelBuffer, i: number, opts: SpriteOpts): Frame {
  let buf: PixelBuffer;
  let ox: number;
  let oy: number;
  let pts: FramePoints | undefined;
  let d = 1;
  if (isBuffer(item)) {
    buf = item;
    [ox, oy] = anchorOf(item, opts.anchor);
    pts = pointsFor(opts, i);
  } else if (item && isBuffer((item as Frame).buf)) {
    buf = item.buf;
    d = Math.max(1, Math.floor(item.density ?? 1));
    if (buf.w % d !== 0 || buf.h % d !== 0) throw new Error(`frame ${i} is ${buf.w}×${buf.h}, not a multiple of its density ${d}`);
    ox = Math.round(item.ox);
    oy = Math.round(item.oy);
    pts = item.pts ?? pointsFor(opts, i);
  } else {
    throw new Error(`frame ${i} is not a PixelBuffer or Frame`);
  }
  if (opts.trim) {
    const b = buf.trimBounds();
    if (b && (b.x > 0 || b.y > 0 || b.w < buf.w || b.h < buf.h)) {
      // Whole logical pixels: widen the box to multiples of the density.
      const x0 = Math.floor(b.x / d) * d;
      const y0 = Math.floor(b.y / d) * d;
      const x1 = Math.ceil((b.x + b.w) / d) * d;
      const y1 = Math.ceil((b.y + b.h) / d) * d;
      buf = buf.crop(x0, y0, x1 - x0, y1 - y0);
      ox -= x0 / d;
      oy -= y0 / d;
    }
  }
  // Renderers need at least one pixel (a 0×0 canvas cannot be drawn).
  if (buf.w === 0 || buf.h === 0) buf = new PixelBuffer(d, d);
  const f: { buf: PixelBuffer; ox: number; oy: number; pts?: FramePoints; density?: number } = { buf, ox, oy };
  if (pts) f.pts = pts;
  if (d !== 1) f.density = d;
  return f;
}

/**
 * Point of a frame relative to its anchor, mirrored for flipped drawing; undefined if absent.
 * Pass `out` to avoid allocating in per-tick code.
 */
export function framePoint(
  f: Frame,
  name: string,
  flipX = false,
  flipY = false,
  out: [number, number] = [0, 0],
): [number, number] | undefined {
  const p = f.pts?.[name];
  if (!p) return undefined;
  out[0] = flipX ? -p[0] : p[0];
  out[1] = flipY ? -p[1] : p[1];
  return out;
}

export interface PlayOpts {
  ticksPerFrame?: number;
  durations?: readonly number[];
  loop?: boolean;
  /** Restart even when this sprite is already playing. */
  restart?: boolean;
  /** Start at this frame (default 0). */
  frame?: number;
}

/**
 * Frame-strip player driven by simulation ticks.
 *
 * ```ts
 * anim.play('enemy/rifleman/run');           // keeps running if already playing
 * anim.update();                             // once per tick
 * r.sprite(anim.id, anim.index, x, y, { flipX: facing < 0 });
 * if (anim.done) …                           // non-looping strip finished
 * ```
 * A non-looping strip stops on its last frame and sets `done` after that frame's duration.
 */
export class Animator {
  id = '';
  index = 0;
  /** Ticks spent on the current frame. */
  tick = 0;
  ticksPerFrame = DEFAULT_TPF;
  durations: readonly number[] | undefined = undefined;
  loop = true;
  done = false;
  /** True when the frame index changed during the last update() (or play() restarted). */
  changed = false;
  /** Completed passes through the strip. */
  loops = 0;
  private count = 1;

  play(id: string, o?: PlayOpts): this {
    const same = id === this.id;
    const info = spriteAnim(id);
    this.ticksPerFrame = Math.max(1, Math.round(o?.ticksPerFrame ?? info.ticksPerFrame));
    this.durations = o?.durations ?? info.durations;
    this.loop = o?.loop ?? info.loop;
    if (same && !o?.restart) return this;
    this.id = id;
    this.count = frameCount(id);
    this.index = Math.max(0, Math.min(this.count - 1, Math.floor(o?.frame ?? 0)));
    this.tick = 0;
    this.done = false;
    this.loops = 0;
    this.changed = true;
    return this;
  }

  /**
   * Advance one tick, or `rate` ticks (a float, e.g. strideRate for a walk cycle that follows the
   * speed). The remainder carries over to the next frame; at most one frame advances per update.
   * Rate 1 is exactly the integer tick count.
   */
  update(rate = 1): this {
    this.changed = false;
    if (this.done || this.id === '') return this;
    this.tick += rate;
    const dur = this.duration(this.index);
    if (this.tick < dur) return this;
    this.tick = rate === 1 ? 0 : Math.min(this.tick - dur, dur - 1e-9);
    if (this.index + 1 < this.count) {
      this.index++;
      this.changed = true;
    } else if (this.loop) {
      this.loops++;
      if (this.count > 1) {
        this.index = 0;
        this.changed = true;
      }
    } else {
      this.done = true;
    }
    return this;
  }

  /** Duration in ticks of frame i. */
  duration(i: number): number {
    const d = this.durations;
    if (d && d.length > 0) return Math.max(1, Math.round(d[i % d.length]));
    return this.ticksPerFrame;
  }

  /** Total ticks of one pass through the strip. */
  get length(): number {
    let t = 0;
    for (let i = 0; i < this.count; i++) t += this.duration(i);
    return t;
  }

  get frameCount(): number {
    return this.count;
  }

  get frame(): Frame {
    return this.id === '' ? placeholderFrames()[0] : getFrame(this.id, this.index);
  }

  /** Named point of the current frame relative to the anchor (mirrored when flipped). */
  point(name: string, flipX = false, out?: [number, number]): [number, number] | undefined {
    return this.id === '' ? undefined : framePoint(this.frame, name, flipX, false, out);
  }
}
