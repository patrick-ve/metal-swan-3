/**
 * Coroutine scripts for level events and boss patterns (docs/ARCHITECTURE.md §5.11).
 *
 * A script is a generator. What it yields says how long to wait:
 * - `yield` (nothing)  → resume next tick
 * - `yield n`          → resume n ticks later (n < 1 counts as 1)
 * - `yield () => bool` → resume on the first later tick where the predicate is true
 * Nest scripts with `yield* sub(ctx)`; run things in parallel with `yield* all(...)` /
 * `yield* race(...)`.
 *
 * `run()` executes the script up to its first yield immediately; after that the runner steps it
 * once per `update()` (once per world tick). A script with an `owner` is cancelled when the
 * owner is dead or removed. A throwing script is logged once and stopped; nothing else is hurt.
 *
 * ```ts
 * world.scripts.run(function* () {
 *   yield waitCamera(1200);                 // camera left edge reached x = 1200
 *   world.camera.lock(1200, 1584);
 *   for (let i = 0; i < 3; i++) { world.spawn('rifleman', 1600, 170); yield 40; }
 *   yield waitAllDead('enemy');
 *   world.camera.unlock();
 * });
 * ```
 */

export type Wait = number | (() => boolean) | void | undefined;
export type ScriptGen = Generator<Wait, void, unknown>;
export type ScriptFn<C> = (ctx: C) => ScriptGen;

/** Anything with a life: scripts owned by it stop when it is dead or removed. */
export interface ScriptOwner {
  readonly dead: boolean;
  readonly removed?: boolean;
}

export interface RunOptions {
  /** Cancel the script automatically when this owner is dead or removed. */
  owner?: ScriptOwner | null;
  /** Name for error messages (default: the function name). */
  name?: string;
}

export interface ScriptHandle {
  readonly name: string;
  /** Finished, cancelled or failed. */
  readonly done: boolean;
  readonly cancelled: boolean;
  /** Stopped because it threw. */
  readonly failed: boolean;
  /** Stop the script (runs its `finally` blocks). */
  cancel(): void;
}

/** What the ambient helpers (`waitCamera`, `waitAllDead(tag)`) read from the running context. */
export interface ScriptHost {
  readonly camera?: { readonly x: number; readonly y: number };
  byTag?(tag: string): readonly ScriptOwner[];
}

/** Steps one generator and interprets its yields. Used by ScriptRunner, `all` and `race`. */
export class Coroutine implements ScriptHandle {
  readonly name: string;
  readonly owner: ScriptOwner | null;
  done = false;
  cancelled = false;
  failed = false;
  error: unknown = null;
  /** @internal last runner frame this coroutine was stepped in. */
  lastFrame = -1;
  private readonly gen: ScriptGen;
  private waitTicks = 0;
  private waitPred: (() => boolean) | null = null;

  constructor(gen: ScriptGen, owner: ScriptOwner | null = null, name = 'script') {
    this.gen = gen;
    this.owner = owner;
    this.name = name;
  }

  /** Advance by one tick. Exceptions from the script propagate to the caller. */
  step(): void {
    if (this.done) return;
    if (this.waitTicks > 0) {
      if (--this.waitTicks > 0) return;
    } else if (this.waitPred) {
      if (!this.waitPred()) return;
      this.waitPred = null;
    }
    const r = this.gen.next();
    if (r.done) {
      this.done = true;
      return;
    }
    const w = r.value;
    if (typeof w === 'number') {
      this.waitTicks = w >= 1 ? Math.floor(w) : 1;
    } else if (typeof w === 'function') {
      this.waitPred = w;
    } else {
      this.waitTicks = 1;
    }
  }

  cancel(): void {
    if (this.done) return;
    this.done = true;
    this.cancelled = true;
    try {
      this.gen.return(undefined);
    } catch (err) {
      console.error(`[script] "${this.name}" threw while cancelling:`, err);
    }
  }
}

/** Context of the runner that is stepping a script right now (for the ambient helpers). */
let activeHost: unknown = null;

export class ScriptRunner<C = unknown> {
  readonly ctx: C;
  /** Called for every script that throws (replaces the default console report). */
  onError: ((name: string, error: unknown) => void) | null = null;
  private readonly list: Coroutine[] = [];
  private frame = 0;

  constructor(ctx: C) {
    this.ctx = ctx;
  }

  /** Number of live scripts. */
  get count(): number {
    let n = 0;
    for (const co of this.list) if (!co.done) n++;
    return n;
  }

  /** Start a script (a function receiving the runner context, or a generator object). */
  run(fn: ScriptFn<C> | ScriptGen, opts: RunOptions = {}): ScriptHandle {
    const name = opts.name ?? (typeof fn === 'function' ? fn.name || 'script' : 'script');
    let gen: ScriptGen;
    const prev = activeHost;
    activeHost = this.ctx;
    try {
      gen = typeof fn === 'function' ? fn(this.ctx) : fn;
    } catch (err) {
      const co = new Coroutine(emptyGen(), null, name);
      co.done = true;
      co.failed = true;
      co.error = err;
      this.report(co, err);
      return co;
    } finally {
      activeHost = prev;
    }
    const co = new Coroutine(gen, opts.owner ?? null, name);
    if (co.owner && (co.owner.dead || co.owner.removed)) {
      co.cancel();
      return co;
    }
    co.lastFrame = this.frame;
    this.list.push(co);
    this.stepSafe(co);
    return co;
  }

  /** Step every script once. Scripts started during this call first step in the next one. */
  update(): void {
    this.frame++;
    const list = this.list;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const co = list[i];
      if (co.done || co.lastFrame >= this.frame) continue;
      co.lastFrame = this.frame;
      const o = co.owner;
      if (o && (o.dead || o.removed)) {
        co.cancel();
        continue;
      }
      this.stepSafe(co);
    }
    let w = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].done) list[w++] = list[i];
    list.length = w;
  }

  /** Cancel every script (e.g. when a section ends). */
  cancelAll(): void {
    for (const co of this.list) co.cancel();
    this.list.length = 0;
  }

  /** Cancel the scripts owned by `owner`. */
  cancelOwned(owner: ScriptOwner): void {
    for (const co of this.list) if (co.owner === owner) co.cancel();
  }

  private stepSafe(co: Coroutine): void {
    const prev = activeHost;
    activeHost = this.ctx;
    try {
      co.step();
    } catch (err) {
      co.done = true;
      co.failed = true;
      co.error = err;
      this.report(co, err);
    } finally {
      activeHost = prev;
    }
  }

  private report(co: Coroutine, err: unknown): void {
    if (this.onError) this.onError(co.name, err);
    else console.error(`[script] "${co.name}" threw and was stopped:`, err);
  }
}

function* emptyGen(): ScriptGen {}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** `yield wait(60)` — same as `yield 60`. */
export function wait(ticks: number): number {
  return ticks;
}

/** `yield until(() => boss.dead)` — same as yielding the predicate. */
export function until(pred: () => boolean): () => boolean {
  return pred;
}

function host(): ScriptHost {
  if (!activeHost) throw new Error('script helper used outside a running script; pass the camera / list explicitly');
  return activeHost as ScriptHost;
}

/**
 * Wait until the camera's left edge reaches world x (`camera.x >= x`).
 * Without `camera`, uses the camera of the context running the script (the World).
 */
export function waitCamera(x: number, camera?: { readonly x: number }): () => boolean {
  const cam = camera ?? host().camera;
  if (!cam) throw new Error('waitCamera: the script context has no camera');
  return () => cam.x >= x;
}

/**
 * Wait until every entity in the list is dead or removed, or — given a tag — until no live
 * entity with that tag is left (uses the World running the script).
 */
export function waitAllDead(target: readonly ScriptOwner[] | string, world?: ScriptHost): () => boolean {
  if (typeof target === 'string') {
    const h = world ?? host();
    if (!h.byTag) throw new Error('waitAllDead(tag): the script context has no byTag()');
    const tag = target;
    return () => {
      const list = h.byTag!(tag);
      for (let i = 0; i < list.length; i++) if (!list[i].dead && !list[i].removed) return false;
      return true;
    };
  }
  const list = target;
  return () => {
    for (let i = 0; i < list.length; i++) if (!list[i].dead && !list[i].removed) return false;
    return true;
  };
}

/** Things `all` / `race` can wait for: a Wait value, a generator (sub-script) or a handle. */
export type Waitable = Wait | ScriptGen | ScriptHandle;

function isGen(v: unknown): v is ScriptGen {
  return typeof v === 'object' && v !== null && typeof (v as ScriptGen).next === 'function';
}

function isHandle(v: unknown): v is ScriptHandle {
  return typeof v === 'object' && v !== null && 'done' in v && typeof (v as ScriptHandle).cancel === 'function';
}

function toCoroutine(item: Waitable): Coroutine {
  if (isGen(item)) return new Coroutine(item, null, 'child');
  if (isHandle(item)) {
    const h = item;
    return new Coroutine(once(() => h.done), null, 'child');
  }
  return new Coroutine(once(item as Wait), null, 'child');
}

function* once(w: Wait): ScriptGen {
  yield w;
}

/** Cancel the items that are running scripts of their own (handles from `world.scripts.run`). */
function cancelHandles(items: readonly Waitable[]): void {
  for (const it of items) if (!isGen(it) && isHandle(it) && !it.done) it.cancel();
}

/**
 * Run several waits / sub-scripts in parallel inside the current script and continue when all
 * of them are done: `yield* all(enterLeft(ctx), enterRight(ctx), 120)`. When the script running
 * `all` is cancelled, the items are cancelled too (script handles included).
 */
export function* all(...items: Waitable[]): ScriptGen {
  const cos = items.map(toCoroutine);
  try {
    for (;;) {
      let pending = false;
      for (const co of cos) {
        if (co.done) continue;
        co.step();
        if (!co.done) pending = true;
      }
      if (!pending) return;
      yield;
    }
  } finally {
    for (const co of cos) co.cancel();
    cancelHandles(items);
  }
}

/**
 * Like `all`, but continues as soon as one item is done; the others are cancelled — script
 * handles too: `yield* race(world.scripts.run(volley), 120)` stops the volley after 2 s.
 */
export function* race(...items: Waitable[]): ScriptGen {
  const cos = items.map(toCoroutine);
  try {
    for (;;) {
      for (const co of cos) {
        if (co.done) continue;
        co.step();
        if (co.done) return;
      }
      if (cos.length === 0) return;
      yield;
    }
  } finally {
    for (const co of cos) co.cancel();
    cancelHandles(items);
  }
}
