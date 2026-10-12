import { MAGENTA } from './color';
import { PixelBuffer } from './pixel';
import type { Frame } from './render';

export type { Frame } from './render';

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
  /** Trim transparent margins of each frame; anchors and points stay correct. Default false. */
  trim?: boolean;
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

const registry = new Map<string, Entry>();
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
}

export function hasSprite(id: string): boolean {
  return registry.has(id);
}

/** Registered ids (sorted), optionally only those starting with `prefix`. */
export function listSprites(prefix = ''): string[] {
  const out: string[] = [];
  for (const id of registry.keys()) if (id.startsWith(prefix)) out.push(id);
  return out.sort();
}

/** Frames of a sprite (generated on first use, then cached). Missing → placeholder + warn once. */
export function getFrames(id: string): readonly Frame[] {
  const e = registry.get(id);
  if (!e) {
    warnOnce(id, `[sprites] unknown sprite "${id}" — drawing a placeholder`);
    return placeholderFrames();
  }
  if (!e.frames) generate(e);
  return e.frames as readonly Frame[];
}

/** Frame `index` of a sprite, wrapped into range (negative indexes count from the end). */
export function getFrame(id: string, index: number): Frame {
  const frames = getFrames(id);
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

/** Generation errors so far (ids whose generator threw or returned nothing usable). */
export function spriteErrors(): Array<{ id: string; error: string }> {
  const out: Array<{ id: string; error: string }> = [];
  for (const e of registry.values()) if (e.error) out.push({ id: e.id, error: e.error });
  return out;
}

/** Drop cached frames (all, or one id) so they regenerate on next use. For tools and tests. */
export function clearSpriteCache(id?: string): void {
  for (const e of registry.values()) {
    if (id === undefined || e.id === id) {
      e.frames = null;
      e.error = null;
    }
  }
}

export interface PreloadOpts {
  /** Sprites generated between yields (default 24). */
  batch?: number;
  /** How to yield between batches (default: a 0 ms timeout, so the browser can paint). */
  yieldFn?: () => Promise<void>;
}

export interface PreloadReport {
  total: number;
  failed: string[];
}

/**
 * Generate every sprite (or those whose id starts with one of `prefixes`) in batches,
 * yielding between batches. Never rejects; failures become placeholders and are reported.
 */
export async function preloadSprites(
  prefixes?: string | readonly string[],
  onProgress?: (done: number, total: number) => void,
  opts?: PreloadOpts,
): Promise<PreloadReport> {
  const list = prefixes === undefined ? [''] : typeof prefixes === 'string' ? [prefixes] : prefixes;
  const ids = [...registry.keys()].filter((id) => list.some((p) => id.startsWith(p))).sort();
  const batch = Math.max(1, opts?.batch ?? 24);
  const yieldFn = opts?.yieldFn ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const failed: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const e = registry.get(ids[i]);
    if (e && !e.frames) generate(e);
    if (e?.error) failed.push(e.id);
    if ((i + 1) % batch === 0 || i + 1 === ids.length) {
      onProgress?.(i + 1, ids.length);
      if (i + 1 < ids.length) await yieldFn();
    }
  }
  if (ids.length === 0) onProgress?.(0, 0);
  return { total: ids.length, failed };
}

function generate(e: Entry): void {
  try {
    const result = e.gen();
    const items: readonly (Frame | PixelBuffer)[] = Array.isArray(result)
      ? (result as readonly (Frame | PixelBuffer)[])
      : [result as Frame | PixelBuffer];
    if (items.length === 0) throw new Error('generator returned no frames');
    e.frames = items.map((item, i) => normalize(item, i, e.opts));
    e.error = null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    e.error = msg;
    e.frames = placeholderFrames();
    warnOnce(`gen:${e.id}`, `[sprites] generator for "${e.id}" failed: ${msg} — drawing a placeholder`);
  }
}

function isBuffer(x: unknown): x is PixelBuffer {
  return x instanceof PixelBuffer;
}

function anchorOf(buf: PixelBuffer, a: SpriteAnchor | undefined): [number, number] {
  if (a === undefined || a === 'feet') return [buf.w >> 1, buf.h];
  if (a === 'center') return [buf.w >> 1, buf.h >> 1];
  if (a === 'top-left') return [0, 0];
  return [Math.round(a[0]), Math.round(a[1])];
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
  if (isBuffer(item)) {
    buf = item;
    [ox, oy] = anchorOf(item, opts.anchor);
    pts = pointsFor(opts, i);
  } else if (item && isBuffer((item as Frame).buf)) {
    buf = item.buf;
    ox = Math.round(item.ox);
    oy = Math.round(item.oy);
    pts = item.pts ?? pointsFor(opts, i);
  } else {
    throw new Error(`frame ${i} is not a PixelBuffer or Frame`);
  }
  if (opts.trim) {
    const b = buf.trimBounds();
    if (b && (b.x > 0 || b.y > 0 || b.w < buf.w || b.h < buf.h)) {
      buf = buf.crop(b.x, b.y, b.w, b.h);
      ox -= b.x;
      oy -= b.y;
    }
  }
  // Renderers need at least one pixel (a 0×0 canvas cannot be drawn).
  if (buf.w === 0 || buf.h === 0) buf = new PixelBuffer(1, 1);
  return pts ? { buf, ox, oy, pts } : { buf, ox, oy };
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

  /** Advance one tick. */
  update(): this {
    this.changed = false;
    if (this.done || this.id === '') return this;
    this.tick++;
    if (this.tick < this.duration(this.index)) return this;
    this.tick = 0;
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
