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
 * Dense art (docs/ARCHITECTURE.md §3, docs/ART_GUIDE.md "2x art (mission ams)", "UHD art"):
 * `defineHiSprite(id, gen2x)` (or `defineSprite(id, gen, { hi: gen2x })`) adds a 2× generator for
 * an existing id (buffers twice as wide and high), `defineHiSprite(id, gen4x, 4)` / `{ hi4 }` a 4×
 * one, and `defineHdSprite(id, (d) => …)` / `{ hd }` ONE density-generic generator called with
 * d 2 and d 4 (the UHD art). One cache per density. getFrames(id, d) returns the frames of the
 * highest density ≤ d that the id has (4 → 2 → 1; never an upscale); the default d is the art
 * density (`setArtDensity`, set by the mission runner to min(mission `artDensity`, `artTier()`)
 * around its drawing). The dense frames always get the logical geometry of the 1× frames — frame
 * count, logical size, anchor and every point — so game logic sees the same numbers at every
 * density: each dense frame is re-framed to its 1× frame's rectangle (pixels outside it are cut
 * and reported once), its points are the 1× points, and a wrong frame count, a buffer size that d
 * does not divide or other points make the id fall back to its next lower frames with a warning
 * (`spriteErrors()` lists it as 'id@<d>x').
 *
 * Tier 4 in the browser (`setDeferDense(true)`): getFrames never generates 4× frames; a missing
 * one draws the 2× frame and the id is queued (`takeDenseQueue`) for the art pool, which installs
 * the result (`installFrames`). `hasFramesAt` / `framesDensityAt` peek without generating, and
 * `releaseDense` drops the 4× frames the working set no longer needs.
 *
 * Dense aliases (`defineDenseAlias(id, target)`): ids whose dense art is the same picture as
 * another id's (a pair set's rider-only strips, a bike per skin, two names of one pickup) show
 * the TARGET's frames at that density — the same objects, never a copy — and have no generator
 * of their own there. Only the target is ever built, installed, counted (`denseBytes`), released,
 * queued, sent through the art pool or saved in a pack; `denseTarget(id, d)` names it. An alias
 * must have the target's 1× geometry (frame count, logical sizes, anchors, points): getFrames
 * checks it on first use, and an alias that does not fit draws its next lower frames with a
 * warning (`spriteErrors()` lists it as 'id@<d>x'). 1× frames are never aliased.
 */

export type SpriteAnchor = 'feet' | 'center' | 'top-left' | readonly [number, number];
/** Named points relative to the anchor of the unflipped frame. */
export type FramePoints = Readonly<Record<string, readonly [number, number]>>;
export type SpriteGenResult = Frame | PixelBuffer | readonly (Frame | PixelBuffer)[];
export type SpriteGen = () => SpriteGenResult;
/** A density-generic generator: frames at density `d` (2 or 4). */
export type HdSpriteGen = (d: DenseDensity) => SpriteGenResult;
/** Art densities: 1 (classic), 2 and 4 (dense art). */
export type ArtDensity = 1 | 2 | 4;
export type DenseDensity = 2 | 4;
/** Art tier: the highest art density the display draws (set by the app from the backbuffer). */
export type ArtTier = ArtDensity;

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
  /** A 4× generator for this id (same as `defineHiSprite(id, hi4, 4)`). */
  hi4?: SpriteGen;
  /**
   * One density-generic HD generator for both dense densities (same as `defineHdSprite(id, hd)`):
   * called with d 2 and d 4, it returns buffers d times the logical size. Wins over `hi` / `hi4`.
   */
  hd?: HdSpriteGen;
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

/** A dense alias (`defineDenseAlias`): the id shows `target`'s frames at one density. */
interface AliasEntry {
  /** The id named at registration (it may be an alias itself: chains resolve on lookup). */
  readonly target: string;
  /** The 1× geometry check: null until checked, '' when the alias fits, else why it does not. */
  error: string | null;
  /** The end of the chain and the 1× frames (alias, end) the check ran on: a change runs it again. */
  checked: string | null;
  own: readonly Frame[] | null;
  base: readonly Frame[] | null;
}

/** Density of 2× art. */
export const HI_DENSITY = 2;
/** The highest art density (4× art, tier 4). */
export const MAX_DENSITY = 4;
/** The dense densities, highest first (the fallback order of getFrames). */
export const DENSE_DENSITIES: readonly DenseDensity[] = [4, 2];

const registry = new Map<string, Entry>();
/** Dense generators and caches, one map per density. */
const denseRegistry: Record<DenseDensity, Map<string, HiEntry>> = { 2: new Map(), 4: new Map() };
const hiRegistry = denseRegistry[2];
/** Dense aliases, one map per density (an alias id has no entry in denseRegistry there). */
const denseAliases: Record<DenseDensity, Map<string, AliasEntry>> = { 2: new Map(), 4: new Map() };
/** The art density getFrames uses when none is passed (1, or 2 / 4 while a dense mission draws). */
let density: ArtDensity = 1;
/** The art tier (`setArtTier`): the highest density the display draws. Default 2. */
let tier: ArtTier = 2;
/** Tier-4 deferral (`setDeferDense`): a missing 4× frame draws its lower frame and is queued. */
let deferDense = false;
const denseQueue = new Set<string>();
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
  if (opts.hd) defineHdSprite(id, opts.hd);
  else {
    if (opts.hi) defineHiSprite(id, opts.hi);
    if (opts.hi4) defineHiSprite(id, opts.hi4, 4);
  }
  // Dense frames take their geometry from the 1× frames.
  for (const d of DENSE_DENSITIES) {
    const h = denseRegistry[d].get(id);
    if (h) h.frames = null;
  }
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
export function defineHiSprite(id: string, gen: SpriteGen, d: DenseDensity = 2): void {
  // A generator replaces an alias of this id at d (the last definition wins).
  denseAliases[denseOf(d)].delete(id);
  denseRegistry[denseOf(d)].set(id, { gen, frames: null, error: null });
}

/**
 * Register ONE density-generic generator for the 2× and 4× frames of `id` (the UHD art): it is
 * called with d 2 and d 4 and returns buffers d times the 1× logical size, with the 1× frame
 * count, anchor and points. `densities` (default both) limits it, e.g. [2] for a rare strip.
 */
export function defineHdSprite(id: string, gen: HdSpriteGen, densities: readonly DenseDensity[] = DENSE_DENSITIES): void {
  for (const d of densities) defineHiSprite(id, () => gen(d), d);
}

/**
 * Register `id` at the dense `densities` (default 2 and 4) as an ALIAS of `target`: it shows
 * target's frames there (the same objects), so identical art is built, held and sent once. It
 * replaces id's own generator at those densities (a later `defineHiSprite` / `hd` replaces the
 * alias). Chains resolve on lookup (an alias of an alias shows the end of the chain). Both ids
 * keep their own 1× sprite, and the alias must have the target's 1× geometry (checked on first
 * use, see the module comment). An alias of itself (also through a chain) is ignored with a warning.
 *
 * ```ts
 * defineDenseAlias('enemy/fatbike-youth-pair-0b/die', 'enemy/fatbike-youth-0b/die');
 * ```
 */
export function defineDenseAlias(id: string, target: string, densities: readonly DenseDensity[] = DENSE_DENSITIES): void {
  for (const dd of densities) {
    const d = denseOf(dd);
    if (target === id || aliasEnd(target, d) === id) {
      warnOnce(`alias-self:${id}@${d}`, `[sprites] ${d}× alias "${id}" → "${target}" points at itself — ignored`);
      continue;
    }
    denseRegistry[d].delete(id);
    denseAliases[d].set(id, { target, error: null, checked: null, own: null, base: null });
  }
}

/** The last id of `id`'s alias chain at d (an id with no alias there), or undefined when `id` is no alias. */
function aliasEnd(id: string, d: DenseDensity): string | undefined {
  const aliases = denseAliases[d];
  let t = aliases.get(id)?.target;
  // Registration refuses cycles; the bound only guards against a broken map.
  for (let n = 0; t !== undefined && n < 64; n++) {
    const next = aliases.get(t)?.target;
    if (next === undefined) return t;
    t = next;
  }
  return undefined;
}

/**
 * The id whose dense frames `id` shows at density `d` (default 4; values normalise like
 * `toArtDensity`, 1 → itself): the end of its alias chain (`defineDenseAlias`), else `id`. An
 * alias whose geometry check failed names itself (it draws its lower frames). Never generates.
 */
export function denseTarget(id: string, d: number = MAX_DENSITY): string {
  if (d < HI_DENSITY) return id;
  const dd = denseOf(d);
  const a = denseAliases[dd].get(id);
  if (!a) return id;
  const end = aliasEnd(id, dd) ?? id;
  return a.error && a.checked === end ? id : end;
}

/** [alias, target] of every dense alias at density `d` (default 4; the end of each chain), sorted by alias id. */
export function listDenseAliases(d: number = MAX_DENSITY): Array<[string, string]> {
  const dd = denseOf(d);
  const out: Array<[string, string]> = [];
  for (const id of denseAliases[dd].keys()) out.push([id, aliasEnd(id, dd) ?? id]);
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/**
 * The id whose dense frames getFrames(id, d) draws: the end of the alias chain once the alias
 * passed its 1× geometry check (run here when the end or the 1× frames are new), else `id`.
 */
function drawnId(id: string, d: DenseDensity): string {
  const a = denseAliases[d].get(id);
  if (!a) return id;
  const end = aliasEnd(id, d);
  if (end === undefined) return id;
  const own = getFrames(id, 1);
  const base = getFrames(end, 1);
  if (a.checked !== end || a.own !== own || a.base !== base) {
    a.checked = end;
    a.own = own;
    a.base = base;
    a.error = sameGeometry(own, base);
    if (a.error) warnOnce(`alias:${id}@${d}`, `[sprites] ${d}× alias "${id}" → "${end}": ${a.error} — drawing the lower frames`);
  }
  return a.error ? id : end;
}

/** '' when two 1× strips have the same geometry (frame count, logical size, anchor, points), else the first difference. */
function sameGeometry(a: readonly Frame[], b: readonly Frame[]): string {
  if (a.length !== b.length) return `${a.length} frames, the target has ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    const pd = p.density ?? 1;
    const qd = q.density ?? 1;
    if (p.buf.w / pd !== q.buf.w / qd || p.buf.h / pd !== q.buf.h / qd) return `frame ${i} is ${p.buf.w / pd}×${p.buf.h / pd}, the target's ${q.buf.w / qd}×${q.buf.h / qd}`;
    if (p.ox !== q.ox || p.oy !== q.oy) return `frame ${i} anchor (${p.ox}, ${p.oy}), the target's (${q.ox}, ${q.oy})`;
    if (!samePoints(p.pts, q.pts)) return `frame ${i}: points differ from the target's`;
  }
  return '';
}

/** 2 or 4 for a dense density request (values ≥ 4 → 4, else 2). */
function denseOf(d: number): DenseDensity {
  return d >= MAX_DENSITY ? 4 : 2;
}

/** Normalise any number to an art density: ≥ 4 → 4, ≥ 2 → 2, else 1. */
export function toArtDensity(d: number): ArtDensity {
  return d >= MAX_DENSITY ? 4 : d >= HI_DENSITY ? 2 : 1;
}

/** Is `id` registered with `defer: true` (SpriteOpts.defer)? */
export function isDeferredSprite(id: string): boolean {
  return registry.get(id)?.opts.defer === true;
}

export function hasSprite(id: string): boolean {
  return registry.has(id);
}

/** Does `id` have art at dense density `d` (default 2): a generator, or an alias of an id with one? */
export function hasHiSprite(id: string, d: DenseDensity = 2): boolean {
  return denseRegistry[denseOf(d)].has(denseTarget(id, d));
}

/**
 * Ids with art at dense density `d` (sorted): a generator, or an alias of an id with one
 * (`defineDenseAlias`; build `denseTarget(id, d)`, never both). Optionally only those starting
 * with `prefix`. Both argument orders work: listHiSprites('enemy/'), listHiSprites(4),
 * listHiSprites('enemy/', 4), listHiSprites(4, 'enemy/'). Default density 2.
 */
export function listHiSprites(a: string | number = '', b: string | number = ''): string[] {
  const prefix = typeof a === 'string' ? a : typeof b === 'string' ? b : '';
  const d = denseOf(typeof a === 'number' ? a : typeof b === 'number' ? b : 2);
  const out: string[] = [];
  for (const id of denseRegistry[d].keys()) if (id.startsWith(prefix)) out.push(id);
  for (const id of denseAliases[d].keys()) if (id.startsWith(prefix) && denseRegistry[d].has(aliasEnd(id, d) ?? id)) out.push(id);
  return out.sort();
}

/**
 * Non-generating peek: are the frames of `id` at exactly density `d` built (generated or
 * installed; an alias: its target's)? d 1: the 1× frames.
 */
export function hasFramesAt(id: string, d: number): boolean {
  const e = d >= HI_DENSITY ? denseRegistry[denseOf(d)].get(denseTarget(id, d)) : registry.get(id);
  return !!e?.frames;
}

/**
 * The density getFrames(id, d) would return now WITHOUT generating: the highest density ≤ d
 * whose frames are built, else the highest density ≤ d with a generator (1 at least).
 */
export function framesDensityAt(id: string, d: number): ArtDensity {
  if (hiArt) {
    for (const dd of DENSE_DENSITIES) {
      if (dd > d) continue;
      const h = denseRegistry[dd].get(denseTarget(id, dd));
      if (!h || (h.frames && h.error)) continue;
      if (h.frames || !(deferDense && dd > HI_DENSITY)) return dd;
    }
  }
  return 1;
}

/** The art tier (1, 2 or 4): the highest density the display draws. */
export function artTier(): ArtTier {
  return tier;
}

/** Set the art tier (values normalise like `toArtDensity`); returns the previous one. */
export function setArtTier(t: number): ArtTier {
  const prev = tier;
  tier = toArtDensity(t);
  return prev;
}

/**
 * Tier-4 deferral (the browser at tier 4): getFrames at density 4 never generates 4× frames;
 * it returns the next lower frames and queues the id (`takeDenseQueue`) for the art pool.
 * Returns the previous value. Off by default (tools and tests generate at once).
 */
export function setDeferDense(on: boolean): boolean {
  const prev = deferDense;
  deferDense = on;
  return prev;
}

export function denseDeferred(): boolean {
  return deferDense;
}

/** Ids queued by deferred 4× requests (insertion order), and clear the queue. */
export function takeDenseQueue(): string[] {
  const out = [...denseQueue];
  denseQueue.clear();
  return out;
}

export function pendingDense(): number {
  return denseQueue.size;
}

/**
 * Drop the cached frames of `ids` at dense density `d` (the tier-4 working set releases ids it
 * no longer needs); they regenerate (or are queued) on next use. Returns the bytes freed (each
 * buffer once). An alias has no frames of its own: releasing it leaves its target alone.
 */
export function releaseDense(ids: Iterable<string>, d: DenseDensity = 4): number {
  const seen = new Set<PixelBuffer>();
  let bytes = 0;
  const reg = denseRegistry[denseOf(d)];
  for (const id of ids) {
    const h = reg.get(id);
    if (!h?.frames) continue;
    if (!h.error) bytes += newBytes(h.frames, seen);
    h.frames = null;
    h.error = null;
  }
  return bytes;
}

/**
 * Bytes of the built frames at dense density `d` (own frames, not fallbacks), each buffer once:
 * frames that share a buffer, and aliases (which show their target's frames), add nothing.
 */
export function denseBytes(d: DenseDensity = 4): number {
  const seen = new Set<PixelBuffer>();
  let bytes = 0;
  for (const h of denseRegistry[denseOf(d)].values()) if (h.frames && !h.error) bytes += newBytes(h.frames, seen);
  return bytes;
}

/** Bytes of the buffers of `frames` not in `seen` yet (and add them to it). */
function newBytes(frames: readonly Frame[], seen: Set<PixelBuffer>): number {
  let bytes = 0;
  for (const f of frames) {
    if (seen.has(f.buf)) continue;
    seen.add(f.buf);
    bytes += f.buf.data.byteLength;
  }
  return bytes;
}

/**
 * Set the art density getFrames / getFrame use by default (1, 2 or 4; other values normalise
 * like `toArtDensity`) and return the previous one. The mission runner sets its mission's `artDensity` around drawing
 * and restores the old value, so everything else (other missions, title, attract demo, tests,
 * game logic) sees density 1.
 */
export function setArtDensity(d: number): ArtDensity {
  const prev = density;
  density = toArtDensity(d);
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

/** The current art density (1, 2 or 4). */
export function artDensity(): ArtDensity {
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
    for (const [id, h] of denseRegistry[denseOf(d)]) if (h.frames && !h.error && id.startsWith(prefix)) out.push(id);
  } else {
    for (const e of registry.values()) if (e.frames && !e.error && e.id.startsWith(prefix)) out.push(e.id);
  }
  return out.sort();
}

/**
 * The frames of `id` at density `d` (2: its 2× frames) when they exist without an error, else
 * null. Never generates (the sprite cache reads what is already made). Own frames only: a dense
 * alias has none (its target has them), so packs never hold an alias.
 */
export function readyFrames(id: string, d = 1): readonly Frame[] | null {
  const e = d >= HI_DENSITY ? denseRegistry[denseOf(d)].get(id) : registry.get(id);
  return e?.frames && !e.error ? e.frames : null;
}

/**
 * Give a registered id frames made earlier by its own generator (the sprite cache), so it never
 * runs the generator. `d` 2 installs 2× frames (the id needs a 2× generator; a dense alias takes
 * none). Only an id without frames takes them; returns true when it did.
 */
export function installFrames(id: string, d: number, frames: readonly Frame[]): boolean {
  const e = d >= HI_DENSITY ? denseRegistry[denseOf(d)].get(id) : registry.get(id);
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
    for (const dd of DENSE_DENSITIES) {
      if (dd > d) continue;
      // A dense alias draws (and builds, and queues) its target.
      const t = drawnId(id, dd);
      const h = denseRegistry[dd].get(t);
      if (!h) continue;
      if (!h.frames) {
        if (deferDense && dd > HI_DENSITY) {
          denseQueue.add(t);
          continue;
        }
        generateHi(t, h, dd);
      }
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
 * generator is listed as `id@2x` (that id then draws its 1× frames), and so is a dense alias whose
 * 1× geometry differs from its target's.
 */
export function spriteErrors(): Array<{ id: string; error: string }> {
  const out: Array<{ id: string; error: string }> = [];
  for (const e of registry.values()) if (e.error) out.push({ id: e.id, error: e.error });
  for (const d of DENSE_DENSITIES) for (const [id, h] of denseRegistry[d]) if (h.error) out.push({ id: `${id}@${d}x`, error: h.error });
  for (const d of DENSE_DENSITIES) for (const [id, a] of denseAliases[d]) if (a.error) out.push({ id: `${id}@${d}x`, error: `alias of "${a.checked}": ${a.error}` });
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
  for (const d of DENSE_DENSITIES) {
    for (const [hid, h] of denseRegistry[d]) {
      if (id === undefined || hid === id) {
        h.frames = null;
        h.error = null;
      }
    }
    // The alias geometry checks run again on the new 1× frames.
    for (const [aid, a] of denseAliases[d]) {
      if (id === undefined || aid === id || a.checked === id) {
        a.error = a.checked = null;
        a.own = a.base = null;
      }
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
   * have a 2× generator (and nothing else) — for a 2× mission's start, not for boot. 4: the ids
   * with 4× or 2× art, each at the highest density it has; with `setDeferDense(true)` a 4× id is
   * queued (`takeDenseQueue`) instead and its 2× frames are made.
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
  const pd = denseOf(opts?.density ?? 1);
  // Density 4: the ids with 4× or 2× art (each at the highest density it has; deferred 4× ids are
  // queued for the pool and get their 2× frames meanwhile). A dense alias builds its target.
  const keys: Iterable<string> = !hi ? registry.keys() : pd === 4 ? new Set([...listHiSprites(4), ...listHiSprites(2)]) : listHiSprites(2);
  const ids = preloadOrder(
    [...keys].filter(
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
        let dd: DenseDensity = pd;
        let id = denseTarget(ids[i], pd);
        let h = denseRegistry[pd].get(id);
        if (pd === 4 && h && !h.frames && deferDense) {
          denseQueue.add(id);
          h = undefined;
        }
        if (!h && pd === 4) {
          dd = 2;
          id = denseTarget(ids[i], 2);
          h = hiRegistry.get(id);
        }
        if (h && !h.frames) generateHi(id, h, dd);
        if (h?.error) failed.push(`${id}@${dd}x`);
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
function generateHi(id: string, h: HiEntry, d: DenseDensity): void {
  const base = getFrames(id, 1);
  const e = registry.get(id);
  // A failing 4× generator falls back to the 2× frames (when the id has them), else 1×.
  const lower = (): readonly Frame[] => {
    const h2 = d > HI_DENSITY ? hiRegistry.get(id) : undefined;
    if (!h2) return base;
    if (!h2.frames) generateHi(id, h2, 2);
    return h2.frames as readonly Frame[];
  };
  if (!e || e.error) {
    h.frames = base;
    h.error = e ? null : 'no 1× sprite with this id';
    if (!e) warnOnce(`hi:${id}`, `[sprites] 2× art for unknown sprite "${id}" — ignored`);
    return;
  }
  try {
    const items = runGen(h.gen);
    if (items.length !== base.length) throw new Error(`${items.length} frames, the 1× sprite has ${base.length}`);
    h.frames = items.map((item, i) => normalizeHi(id, item, i, e.opts, base[i], d));
    h.error = null;
    for (const f of h.frames) if (!bufferIds.has(f.buf)) bufferIds.set(f.buf, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    h.error = msg;
    h.frames = lower();
    warnOnce(`hi:${id}@${d}`, `[sprites] ${d}× generator for "${id}" failed: ${msg} — drawing the lower frames`);
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
function normalizeHi(id: string, item: Frame | PixelBuffer, i: number, opts: SpriteOpts, base: Frame, d: DenseDensity): Frame {
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
    if (cut > 0) warnOnce(`hi-cut:${id}@${d}`, `[sprites] ${d}× frame ${i} of "${id}" has ${cut} pixels outside the 1× frame — cut`);
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
