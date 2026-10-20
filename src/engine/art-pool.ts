/**
 * The art pool (docs/api/media.md "Art pool"; plan "Generation, memory, caching"): builds sprite
 * frames at a density in other threads and installs them in this thread's sprite registry
 * (`installFrames`), so the 2× and 4× art never stalls a drawn frame.
 *
 * - A worker (src/game/art-worker.ts) loads the content registry, builds the ids it is given
 *   (`buildRawPack`) and answers with a RAW pack: one ArrayBuffer of pixels per sprite id,
 *   handed over as transferables (no copy, no SharedArrayBuffer, so no cross-origin isolation).
 * - Ids of one family (`familyOf`: a hero's strip family, enemy/<set>, boss/<id>, vehicle/<id> …) always go
 *   to the same worker, so the art parts memoised inside the art modules stay warm there.
 * - A dense alias (sprites.ts `defineDenseAlias`) is built, sent and installed as its target, once.
 * - Backends (`ArtWorkerPort`): a browser module worker (`browserArtPool`), an in-process port
 *   for node tools and tests (`inProcessPort`), node worker_threads (`nodeArtPool`, wall time).
 * - Fallback: without Worker, or when a worker fails (console.warn once), its ids are built on
 *   the main thread by today's budgeted preload (`preloadSprites` with a time budget per frame).
 *
 * Determinism: a worker runs the same generators on the same input, so its frames are
 * byte-identical to main-thread `getFrames` (tests/engine/art-pool.test.ts).
 * DOM-free (runs in workers and node); the browser backend only touches `Worker`.
 */
import { PixelBuffer } from './pixel';
import type { Frame } from './render';
import { clearSpriteCache, denseTarget, getFrames, hasHiSprite, hasSprite, installFrames, preloadSprites, readyFrames, releaseDense, setDeferDense } from './sprites';

/** One frame of a raw sprite: [buffer index, ox, oy, density, points or 0]. */
type RawFrame = [number, number, number, number, NonNullable<Frame['pts']> | 0];

/** One sprite of a raw pack: its id, [w, h] per buffer and its frames. */
export interface RawSprite {
  id: string;
  b: Array<[number, number]>;
  f: RawFrame[];
}

/**
 * Frames of many ids at one density, ready to post: `px[i]` holds the pixels of `s[i]` (its
 * buffers in `b` order, w × h packed Colors each, this machine's byte order).
 */
export interface RawPack {
  d: number;
  s: RawSprite[];
  px: ArrayBuffer[];
  /** `id@<d>x` of the ids that have no frames of their own at `d` (no generator or an error). */
  failed: string[];
}

/** Copy frames into a raw pack (buffers shared by frames of one id stay shared). */
export function packFrames(d: number, sprites: Iterable<readonly [string, readonly Frame[]]>): RawPack {
  const pack: RawPack = { d, s: [], px: [], failed: [] };
  for (const [id, frames] of sprites) {
    const index = new Map<PixelBuffer, number>();
    const bufs: PixelBuffer[] = [];
    const s: RawSprite = { id, b: [], f: [] };
    for (const f of frames) {
      let bi = index.get(f.buf);
      if (bi === undefined) {
        bi = bufs.length;
        index.set(f.buf, bi);
        bufs.push(f.buf);
        s.b.push([f.buf.w, f.buf.h]);
      }
      s.f.push([bi, f.ox, f.oy, f.density ?? 1, f.pts ?? 0]);
    }
    let n = 0;
    for (const b of bufs) n += b.data.length;
    const px = new Uint32Array(n);
    let at = 0;
    for (const b of bufs) {
      px.set(b.data, at);
      at += b.data.length;
    }
    pack.s.push(s);
    pack.px.push(px.buffer);
  }
  return pack;
}

/** The frames of a raw pack (buffers are views into the pack's ArrayBuffers, no copy). */
export function unpackFrames(pack: RawPack): Array<[string, Frame[]]> {
  return pack.s.map((s, i) => {
    const raw = pack.px[i];
    let at = 0;
    const bufs = s.b.map(([w, h]) => {
      const b = new PixelBuffer(w, h, new Uint32Array(raw, at * 4, w * h));
      at += w * h;
      return b;
    });
    if (at * 4 !== raw.byteLength) throw new Error(`art pool: "${s.id}" pixels do not add up`);
    const frames = s.f.map(([bi, ox, oy, d, pts]) => {
      const f: { buf: PixelBuffer; ox: number; oy: number; pts?: NonNullable<Frame['pts']>; density?: number } = { buf: bufs[bi], ox, oy };
      if (pts) f.pts = pts;
      if (d !== 1) f.density = d;
      return f as Frame;
    });
    return [s.id, frames];
  });
}

/** Bytes of pixels in a raw pack. */
export function rawPackBytes(pack: RawPack): number {
  let n = 0;
  for (const b of pack.px) n += b.byteLength;
  return n;
}

/**
 * `ids` at density `d` as the ids to build: a dense alias becomes its target (`denseTarget`),
 * each id once, in first-seen order. 1×: `ids` as they are.
 */
export function buildIds(ids: readonly string[], d: number): string[] {
  return d >= 2 ? [...new Set(ids.map((id) => denseTarget(id, d)))] : [...ids];
}

/**
 * Build `ids` at density `d` in THIS thread (the worker's job) and pack them. Ids without their
 * own frames at `d` are listed in `failed`; a dense alias is built and packed as its target, once
 * (`buildIds`). Dense frames built here are released after packing (the pack is a copy; the
 * worker keeps only its 1× frames and memoised parts).
 */
export function buildRawPack(ids: readonly string[], d: number): RawPack {
  const built: Array<[string, readonly Frame[]]> = [];
  const failed: string[] = [];
  const dense = d >= 2;
  const own = buildIds(ids, d);
  // In a worker deferral is off; in-process (node tools, tests) it may be on: build anyway.
  const deferred = setDeferDense(false);
  try {
    buildInto(own, d, dense, built, failed);
  } finally {
    setDeferDense(deferred);
  }
  const pack = packFrames(d, built);
  pack.failed = failed;
  if (dense) releaseDense(own, d >= 4 ? 4 : 2);
  return pack;
}

function buildInto(ids: readonly string[], d: number, dense: boolean, built: Array<[string, readonly Frame[]]>, failed: string[]): void {
  for (const id of ids) {
    if (dense ? !hasHiSprite(id, d >= 4 ? 4 : 2) : !hasSprite(id)) {
      failed.push(`${id}@${d}x`);
      continue;
    }
    getFrames(id, d);
    const frames = readyFrames(id, d);
    if (frames) built.push([id, frames]);
    else failed.push(`${id}@${d}x`);
  }
}

/** Main thread → worker. */
export interface ArtBuildRequest {
  t: 'build';
  job: number;
  d: number;
  ids: string[];
  /** Drop the worker's sprite cache first (benchmarks: every run from cold frames). */
  clear?: boolean;
}

/** Worker → main thread. */
export type ArtBuildReply = { t: 'done'; job: number; pack: RawPack; ms: number } | { t: 'error'; job: number; message: string };

/**
 * The handler a worker runs for each request: `load` imports the content registry once (with
 * the lazy content when an id needs it), then `buildRawPack`. Returns the reply and its
 * transferables.
 */
export function createArtWorkerHandler(
  load: (lazy: boolean) => Promise<void>,
  isLazyId: (id: string) => boolean = () => false,
): (req: ArtBuildRequest) => Promise<{ reply: ArtBuildReply; transfer: ArrayBuffer[] }> {
  let base: Promise<void> | null = null;
  let lazy: Promise<void> | null = null;
  return async (req) => {
    try {
      base ??= load(false);
      await base;
      if (req.clear) clearSpriteCache();
      if (req.ids.some(isLazyId)) {
        lazy ??= load(true);
        await lazy;
      }
      const t0 = now();
      const pack = buildRawPack(req.ids, req.d);
      return { reply: { t: 'done', job: req.job, pack, ms: now() - t0 }, transfer: pack.px };
    } catch (err) {
      return { reply: { t: 'error', job: req.job, message: err instanceof Error ? err.message : String(err) }, transfer: [] };
    }
  };
}

/** A worker as the pool sees it (browser Worker, node worker_threads, or in-process). */
export interface ArtWorkerPort {
  post(req: ArtBuildRequest): void;
  /** Called with every reply. */
  onReply(cb: (reply: ArtBuildReply) => void): void;
  /** Called once when the worker breaks (load error, crash). */
  onFail(cb: (message: string) => void): void;
  terminate(): void;
}

/**
 * A port that runs the handler in this thread (node tools and tests): the request runs after a
 * 0 ms timeout, the reply comes back as a worker's would (the frames are copies).
 */
export function inProcessPort(handler: ReturnType<typeof createArtWorkerHandler>): ArtWorkerPort {
  let reply: (r: ArtBuildReply) => void = () => {};
  let closed = false;
  return {
    post(req) {
      setTimeout(() => {
        if (closed) return;
        void handler(req).then(({ reply: r }) => {
          if (!closed) reply(r);
        });
      }, 0);
    },
    onReply(cb) {
      reply = cb;
    },
    onFail() {},
    terminate() {
      closed = true;
    },
  };
}

/**
 * Family of a sprite id: its ids go to one worker (shared parts stay warm there). A hero
 * (`char/<id>/…`, about 120 ids and 450 frames, the tier-4 working set) is split by strip family
 * so it spreads over the pool: `legs-*`, `torso-pistol-*`, `torso-heavy-*`, the Helium twins
 * `helium-*` and `helium-wob-*`, the rider strips `ride-*`, and the full-body rest (`char/<id>`).
 */
export function familyOf(id: string): string {
  const parts = id.split('/');
  const head = parts[0];
  if (head === 'char' && parts.length >= 3) {
    const sub = heroStripFamily(parts[2]);
    return sub ? `char/${parts[1]}/${sub}` : `char/${parts[1]}`;
  }
  if (head === 'char' || head === 'boss' || head === 'enemy' || head === 'vehicle' || head === 'npc') return parts.slice(0, 2).join('/');
  return parts.slice(0, 3).join('/');
}

/** The strip family of a hero strip name (null: the full-body rest). */
function heroStripFamily(strip: string): string | null {
  if (strip.startsWith('helium-wob-')) return 'helium-wob';
  if (strip.startsWith('helium-')) return 'helium';
  if (strip.startsWith('legs-')) return 'legs';
  if (strip.startsWith('torso-pistol-')) return 'torso-pistol';
  if (strip.startsWith('torso-heavy-')) return 'torso-heavy';
  if (strip.startsWith('ride-')) return 'ride';
  return null;
}

/** Pool size for `cores` hardware threads: cores − 1, at most 8, at least 1. */
export function poolSize(cores: number | undefined = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined): number {
  const n = Math.floor((cores ?? 2) - 1);
  return Math.max(1, Math.min(8, Number.isFinite(n) ? n : 1));
}

export interface ArtPoolReport {
  /** Ids asked for (dense aliases counted as their targets, each once). */
  total: number;
  /** Ids installed from the workers (ids that had frames already are not counted). */
  installed: number;
  /** Ids built by the main-thread fallback. */
  fallback: number;
  /** `id@<d>x` of the ids without frames of their own at d. */
  failed: string[];
  /** Wall time (ms). */
  ms: number;
}

export interface ArtPoolOpts {
  /** Ids per request (default 12): results stream back and install batch by batch. */
  batch?: number;
  /**
   * The main-thread fallback for ids a broken (or missing) worker cannot build. Default:
   * today's budgeted preload (`preloadSprites`, `fallbackBudgetMs` per browser frame).
   */
  fallback?: (ids: readonly string[], d: number) => Promise<void>;
  /** Time budget (ms) per frame of the default fallback (default 8). */
  fallbackBudgetMs?: number;
  /** Warn (default console.warn); called once for the first broken worker. */
  warn?: (msg: string) => void;
  /** Install each batch (default installFrames per id); returns the number installed. */
  install?: (pack: RawPack) => number;
}

interface Batch {
  job: number;
  d: number;
  ids: string[];
  clear?: boolean;
  done: (pack: RawPack | null) => void;
}

interface Slot {
  port: ArtWorkerPort | null;
  queue: Batch[];
  busy: Batch | null;
  /** Queued + busy ids (weighted by d²), for the least-loaded choice. */
  load: number;
  /** Families homed on this worker (tie-break: builds that arrive one family at a time spread). */
  fams: number;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const nextFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

/** Install every sprite of a raw pack (ids that have frames already keep theirs). */
export function installRawPack(pack: RawPack): number {
  let n = 0;
  for (const [id, frames] of unpackFrames(pack)) if (installFrames(id, pack.d, frames)) n++;
  return n;
}

/**
 * The pool. `ports` are its workers (may be empty: everything goes to the fallback). `build`
 * may be called many times; requests queue per worker in call order.
 */
export class ArtPool {
  readonly size: number;
  private readonly slots: Slot[];
  private readonly family = new Map<string, number>();
  private readonly batchSize: number;
  private readonly fallbackFn: (ids: readonly string[], d: number) => Promise<void>;
  private readonly warnFn: (msg: string) => void;
  private readonly installFn: (pack: RawPack) => number;
  private warned = false;
  private nextJob = 1;
  /** The fallback runs one batch list at a time, in order. */
  private fallbackChain: Promise<void> = Promise.resolve();

  constructor(ports: readonly ArtWorkerPort[], opts: ArtPoolOpts = {}) {
    this.batchSize = Math.max(1, opts.batch ?? 12);
    const budget = opts.fallbackBudgetMs ?? 8;
    this.fallbackFn =
      opts.fallback ??
      (async (ids, d) => {
        await preloadSprites(ids, undefined, { density: d, timeBudgetMs: budget, yieldFn: nextFrame });
      });
    this.warnFn = opts.warn ?? ((m) => console.warn(m));
    this.installFn = opts.install ?? installRawPack;
    this.slots = ports.map((port, i) => {
      const slot: Slot = { port, queue: [], busy: null, load: 0, fams: 0 };
      port.onReply((r) => this.reply(i, r));
      port.onFail((m) => this.fail(i, m));
      return slot;
    });
    this.size = this.slots.length;
  }

  /** Live workers. */
  get workers(): number {
    return this.slots.filter((s) => s.port).length;
  }

  /** Ids queued or in flight. */
  get pending(): number {
    let n = 0;
    for (const s of this.slots) n += (s.busy?.ids.length ?? 0) + s.queue.reduce((a, b) => a + b.ids.length, 0);
    return n;
  }

  /**
   * Build `ids` (in priority order) at density `d` and install them. `onProgress(done, total)`
   * after each batch. Never rejects: a broken worker's ids go to the main-thread fallback. A
   * dense alias is built as its target, once (`buildIds`): no worker builds or sends it twice.
   */
  build(asked: readonly string[], d: number, onProgress?: (done: number, total: number) => void): Promise<ArtPoolReport> {
    const t0 = now();
    const ids = buildIds(asked, d);
    const report: ArtPoolReport = { total: ids.length, installed: 0, fallback: 0, failed: [], ms: 0 };
    if (ids.length === 0) return Promise.resolve(report);
    // Group by family, keeping the order of each family's first id; cut into batches.
    const groups = new Map<string, string[]>();
    for (const id of ids) {
      const f = familyOf(id);
      const g = groups.get(f);
      if (g) g.push(id);
      else groups.set(f, [id]);
    }
    let done = 0;
    const waits: Promise<void>[] = [];
    for (const [fam, list] of groups) {
      for (let i = 0; i < list.length; i += this.batchSize) {
        const part = list.slice(i, i + this.batchSize);
        waits.push(
          new Promise<void>((resolve) => {
            const batch: Batch = {
              job: this.nextJob++,
              d,
              ids: part,
              done: (pack) => {
                if (pack) {
                  try {
                    report.installed += this.installFn(pack);
                    report.failed.push(...pack.failed);
                  } catch (err) {
                    // A pack that cannot install leaves its ids lazy (generated on first use).
                    this.warnOnce(`[art-pool] cannot install a batch: ${err instanceof Error ? err.message : String(err)}`);
                  }
                } else report.fallback += part.length;
                done += part.length;
                onProgress?.(done, ids.length);
                resolve();
              },
            };
            this.enqueue(fam, batch);
          }),
        );
      }
    }
    return Promise.all(waits).then(() => {
      report.ms = now() - t0;
      return report;
    });
  }

  /**
   * Every live worker loads its content (if it has not yet) and drops its sprite cache, after
   * the batches queued before. Benchmarks use it to warm the workers up and to start each run
   * from cold frames.
   */
  reset(): Promise<void> {
    const waits: Promise<void>[] = [];
    this.slots.forEach((slot, i) => {
      if (!slot.port) return;
      waits.push(
        new Promise<void>((resolve) => {
          slot.queue.push({ job: this.nextJob++, d: 1, ids: [], clear: true, done: () => resolve() });
          this.pump(i);
        }),
      );
    });
    return Promise.all(waits).then(() => {});
  }

  /** Stop every worker; queued batches go to the fallback. */
  close(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      s.port?.terminate();
      s.port = null;
      this.drain(i);
    }
  }

  private enqueue(fam: string, batch: Batch): void {
    let w = this.family.get(fam);
    if (w === undefined || !this.slots[w].port) {
      w = -1;
      for (let i = 0; i < this.slots.length; i++) {
        if (!this.slots[i].port) continue;
        const s = this.slots[i];
        // Least loaded; on a tie (idle workers) the one with the fewest families, so builds of
        // one family at a time (the tier-4 pump, benches) do not all land on worker 0.
        if (w < 0 || s.load < this.slots[w].load || (s.load === this.slots[w].load && s.fams < this.slots[w].fams)) w = i;
      }
      if (w < 0) {
        this.runFallback([batch]);
        return;
      }
      this.family.set(fam, w);
      this.slots[w].fams++;
    }
    const slot = this.slots[w];
    slot.queue.push(batch);
    slot.load += batch.ids.length * batch.d * batch.d;
    this.pump(w);
  }

  private pump(i: number): void {
    const s = this.slots[i];
    if (!s.port || s.busy) return;
    const b = s.queue.shift();
    if (!b) return;
    s.busy = b;
    s.port.post({ t: 'build', job: b.job, d: b.d, ids: b.ids, ...(b.clear ? { clear: true } : {}) });
  }

  private reply(i: number, r: ArtBuildReply): void {
    const s = this.slots[i];
    const b = s.busy;
    if (!b || b.job !== r.job) return;
    if (r.t === 'error') {
      this.fail(i, r.message);
      return;
    }
    s.busy = null;
    s.load -= b.ids.length * b.d * b.d;
    b.done(r.pack);
    this.pump(i);
  }

  private fail(i: number, message: string): void {
    const s = this.slots[i];
    if (!s.port) return;
    this.warnOnce(`[art-pool] a worker failed (building on the main thread instead): ${message}`);
    s.port.terminate();
    s.port = null;
    this.drain(i);
  }

  /** Move a dead worker's batches (in flight and queued) to the fallback. */
  private drain(i: number): void {
    const s = this.slots[i];
    const list = [...(s.busy ? [s.busy] : []), ...s.queue];
    s.busy = null;
    s.queue = [];
    s.load = 0;
    if (list.length) this.runFallback(list);
  }

  private runFallback(list: Batch[]): void {
    this.fallbackChain = this.fallbackChain.then(async () => {
      for (const b of list) {
        try {
          await this.fallbackFn(b.ids, b.d);
        } catch {
          // The sprite registry never throws; a fallback error leaves the ids lazy.
        }
        b.done(null);
      }
    });
  }

  private warnOnce(msg: string): void {
    if (this.warned) return;
    this.warned = true;
    this.warnFn(msg);
  }
}

/** A port around anything with postMessage / message / error events (browser Worker). */
function messagePort(w: {
  postMessage(m: unknown): void;
  addEventListener(type: string, cb: (e: { data?: unknown; message?: string }) => void): void;
  terminate(): void;
}): ArtWorkerPort {
  let fail: (m: string) => void = () => {};
  let reply: (r: ArtBuildReply) => void = () => {};
  w.addEventListener('message', (e) => reply(e.data as ArtBuildReply));
  w.addEventListener('error', (e) => fail(e.message ?? 'worker error'));
  w.addEventListener('messageerror', () => fail('message error'));
  return {
    post: (req) => w.postMessage(req),
    onReply: (cb) => {
      reply = cb;
    },
    onFail: (cb) => {
      fail = cb;
    },
    terminate: () => w.terminate(),
  };
}

/**
 * The browser pool: `size` (default `poolSize()`) module workers running src/game/art-worker.ts.
 * Without Worker (or when one cannot start) it has no workers and every build runs on the main
 * thread (the budgeted fallback), after one console.warn.
 */
export function browserArtPool(size = poolSize(), opts: ArtPoolOpts = {}): ArtPool {
  const ports: ArtWorkerPort[] = [];
  const warn = opts.warn ?? ((m: string) => console.warn(m));
  if (typeof Worker === 'undefined') {
    warn('[art-pool] no Worker: building art on the main thread');
  } else {
    try {
      for (let i = 0; i < size; i++) {
        ports.push(messagePort(new Worker(new URL('../game/art-worker.ts', import.meta.url), { type: 'module', name: `art-${i}` })));
      }
    } catch (err) {
      warn(`[art-pool] cannot start a worker (building art on the main thread): ${err instanceof Error ? err.message : String(err)}`);
      for (const p of ports) p.terminate();
      ports.length = 0;
    }
  }
  return new ArtPool(ports, { ...opts, warn });
}

/** Node only: the module id of worker_threads (not a static import, so browser builds skip it). */
const NODE_WORKER_THREADS = 'node:worker_threads';

/** The parts of node's worker_threads the pool uses (src has no node types). */
export interface NodeWorkerThreads {
  Worker: new (
    url: URL,
    opts: { execArgv: string[] },
  ) => {
    postMessage(m: unknown): void;
    on(ev: string, cb: (x: never) => void): void;
    terminate(): Promise<number>;
  };
  parentPort: { postMessage(m: unknown, transfer?: ArrayBuffer[]): void; on(ev: 'message', cb: (m: never) => void): void } | null;
}
const WORKER_SOURCE = '../game/art-worker.ts';

/**
 * Node tools: a pool of `size` worker_threads running src/game/art-worker.ts through tsx
 * (tools/anim-bench.ts --pool N, tests). Close it when done (`close`), or node keeps running.
 */
export async function nodeArtPool(size: number, opts: ArtPoolOpts = {}): Promise<ArtPool> {
  const wt = (await import(/* @vite-ignore */ NODE_WORKER_THREADS)) as NodeWorkerThreads;
  // Not a literal: the bundler must not copy the worker source as an asset for this node path.
  const entry = new URL(WORKER_SOURCE, import.meta.url);
  const ports: ArtWorkerPort[] = [];
  for (let i = 0; i < size; i++) {
    const w = new wt.Worker(entry, { execArgv: ['--import', 'tsx'] });
    let fail: (m: string) => void = () => {};
    let reply: (r: ArtBuildReply) => void = () => {};
    w.on('message', (m: ArtBuildReply) => reply(m));
    w.on('error', (e: Error) => fail(e.message));
    w.on('exit', (code: number) => {
      if (code !== 0) fail(`exit ${code}`);
    });
    ports.push({
      post: (req) => w.postMessage(req),
      onReply: (cb) => {
        reply = cb;
      },
      onFail: (cb) => {
        fail = cb;
      },
      terminate: () => {
        fail = () => {};
        void w.terminate();
      },
    });
  }
  return new ArtPool(ports, opts);
}
