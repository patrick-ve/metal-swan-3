/**
 * The strip store (docs/design/oat.md §8.6 "The strips", §8.9 the two bakes, §8.12 the memory; the
 * contract: ./types.ts `StripStoreApi`, the strip space: ./space.ts). Owner: STRIPS (wave A).
 *
 * A section with `SectionDef.strips` gets one store (the section view makes it on its first frame):
 * it plans the section through its source once, then keeps the chunks around the view resident.
 *
 * - `prepare(viewX, speed, d)` once per drawn frame: the chunks on screen and the ones ahead (by the
 *   scroll speed: at least `prefetch`, more when the view moves fast — the oat-c1 auto-scroll, the
 *   taxi ride), in that order, are queued at d as ART JOBS, one job per band of the source's
 *   `bands(cx, d)` (each band ≤ STRIP_JOB_MS; the shared per-frame budget HI_ART_FRAME_BUDGET_MS =
 *   STRIP_FRAME_MS runs them: the view calls `runArtJobs` once per frame, the budgeted preload during
 *   the section start). A chunk ON SCREEN with nothing ready gets its 1× now (small, as the floor's;
 *   also when its dense prefetch is still queued): the lower density draws until the dense one is
 *   painted, so no gap shows. The 1× itself (res 1, dense art off) and every chunk without deferred
 *   dense art (node tools, tests) are painted at once. A painted chunk releases its lower densities.
 * - Eviction: a chunk STRIP_KEEP_BEHIND chunks behind the view's trailing chunk (or past the far end of
 *   the prefetch) is released and its jobs cancelled; it is rebuilt if the view comes back.
 * - The light sets (spec §8.9): with `SectionStripsDef.dark` the chunks that touch that world range
 *   also have a 'dark' bake, queued after the lit ones once the view's centre passes `darkFrom` (or
 *   `darkMix` > 0). `darkMix` (0 lit … 1 dark) is set by the light pass's cross-fade; at 1 the lit
 *   chunks of the range are released (they come back if the mix drops).
 * - The memory accounting (spec §8.12): `bytes` = every buffer held (resident, stand-ins, being
 *   painted). The lit set stays under STRIP_BUDGET_BYTES, the dark set under STRIP_DARK_BUDGET_BYTES:
 *   before a new buffer would pass its budget the store releases what is furthest from the view
 *   (behind first, then the far prefetch, never what is on screen); a chunk that is further away than
 *   everything resident waits. A chunk on screen is always built (`stats.overBudget` counts it).
 * - A source that throws in a band leaves that band empty and warns once (fail soft).
 *
 * Frame path: `prepare` and `chunk` make no object, array or closure (fixed slot arrays per light set
 * and density, indexed by chunk); only a new chunk allocates its buffer and its band jobs. Art only:
 * nothing here reads or writes game state, randomness or a clock (`opts.now` is a test probe).
 */
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { VIEW_W } from '../../../engine/render';
import { cancelArtJobs, hiArtDeferred, queueArtJob, setArtDensity } from '../../../engine/sprites';
import { chunksOfRange, stripXOfU, uOfStripX } from './space';
import { getStripSource } from './source';
import {
  STRIP_BUDGET_BYTES,
  STRIP_CHUNK,
  STRIP_DARK_BUDGET_BYTES,
  STRIP_KEEP_BEHIND,
  STRIP_LEAD_TICKS,
  STRIP_MAX_H,
  STRIP_PREFETCH,
  type SectionStripsDef,
  type StripDensity,
  type StripLightSet,
  type StripPlan,
  type StripSectionInfo,
  type StripStoreApi,
} from './types';

/** The densities, by index 0 … 2. */
const DENSITIES: readonly StripDensity[] = [1, 2, 4];
/** The most chunks ahead the speed rule asks for (a respawn jump is not a speed). */
const MAX_AHEAD = 4;
/** A camera step longer than this (world px in one frame) is a jump (a respawn, a section start), not a speed. */
const JUMP_PX = 64;
/** The scroll speed is smoothed over about this many frames (camera smoothing and shake jitter). */
const SPEED_EMA = 0.1;
/** Below this smoothed speed (px per tick, leftward) the view counts as moving left. */
const LEFT_SPEED = -0.25;
/** Priority of a chunk the store will not hold (outside every window). */
const NO_PRIORITY = 1e9;

function dIndex(d: number): number {
  return d >= 4 ? 2 : d >= 2 ? 1 : 0;
}

/** One chunk buffer of one light set at one density. */
interface ChunkEntry {
  readonly cx: number;
  readonly d: StripDensity;
  /** 0 lit, 1 dark. */
  readonly set: number;
  readonly buf: PixelBuffer;
  /** The buffer as a frame (anchor top-left, its density): made once, drawn every frame. */
  readonly frame: Frame;
  readonly bands: number;
  /** Bands painted so far. */
  painted: number;
  /** All bands painted: drawn from now on. */
  ready: boolean;
}

/** Store options (all optional; the section view passes none). */
export interface StripStoreOpts {
  /** Defer dense chunks to art jobs (default: `hiArtDeferred()`, true in the browser). */
  deferred?: () => boolean;
  /** Key prefix of this store's art jobs (default: a unique one). */
  jobKey?: string;
  /** Budgets (bytes; default STRIP_BUDGET_BYTES / STRIP_DARK_BUDGET_BYTES; tests). */
  budgetBytes?: number;
  darkBudgetBytes?: number;
  /** A clock for the job timing stats only (tests, perf probes); never read without it. */
  now?: () => number;
}

/** Counters of a store (debug, tests, the perf probe). */
export interface StripStats {
  /** Chunks painted completely, per density index (1×, 2×, 4×). */
  built: [number, number, number];
  /** Stand-ins: the 1× of a dense chunk on screen with nothing ready, painted at once on the frame path (deferred art only). */
  sync: number;
  /** Band jobs run. */
  jobs: number;
  /** Chunks released behind or past the prefetch (the eviction). */
  evicted: number;
  /** Chunks released to keep a budget. */
  squeezed: number;
  /** Requests refused for a budget (counted per attempt; the chunk comes when room is made). */
  refused: number;
  /** Chunks on screen built although their set was over its budget. */
  overBudget: number;
  /** Peaks of `bytes`, of the lit and of the dark set. */
  peakBytes: number;
  peakLitBytes: number;
  peakDarkBytes: number;
  /** The longest band job (ms; only with `opts.now`). */
  maxJobMs: number;
  /** Bands that threw. */
  failed: number;
}

let storeSerial = 0;
const warned = new Set<string>();

function warnOnce(key: string, msg: string, err?: unknown): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg, err ?? '');
}

/** Make the store of a section with `SectionDef.strips`. Never throws: a broken source gives a store without a plan. */
export function createStripStore(def: SectionStripsDef, section: StripSectionInfo, opts: StripStoreOpts = {}): StripStore {
  return new StripStore(def, section, opts);
}

export class StripStore implements StripStoreApi {
  readonly plan: StripPlan | null;
  readonly def: SectionStripsDef;
  /** The façade plane's scale s (strip x = 192 + (u − 192) · s). */
  readonly scale: number;
  /** Strip height (logical px, ≤ STRIP_MAX_H): the plan's, capped by the def's. */
  readonly height: number;
  /** The chunk index range the rows touch, [c0, c1]. */
  readonly c0: number;
  readonly c1: number;
  darkMix = 0;
  readonly stats: StripStats = {
    built: [0, 0, 0],
    sync: 0,
    jobs: 0,
    evicted: 0,
    squeezed: 0,
    refused: 0,
    overBudget: 0,
    peakBytes: 0,
    peakLitBytes: 0,
    peakDarkBytes: 0,
    maxJobMs: 0,
    failed: 0,
  };
  private readonly section: StripSectionInfo;
  private readonly opts: StripStoreOpts;
  private readonly jobKey: string;
  /** The chunks the plan covers (1 = has pixels), by chunk − c0. */
  private readonly covered: Uint8Array;
  /** The chunks that touch the dark range (they have a dark bake), by chunk − c0. */
  private readonly darkCovered: Uint8Array;
  /** The chunks lying wholly inside the dark range (their lit bake is not drawn at darkMix 1). */
  private readonly darkInside: Uint8Array;
  /** The dark range as chunks, [darkC0, darkC1] (empty without one). */
  private readonly darkC0: number;
  private readonly darkC1: number;
  /** Slots: [set · 3 + density index][chunk − c0]. */
  private readonly slots: (ChunkEntry | null)[][];
  private readonly budget: [number, number];
  /** Bytes held per set (lit, dark). */
  private readonly held: [number, number] = [0, 0];
  /** The density asked for last (0: none yet: nothing is built). */
  private want: 0 | StripDensity = 0;
  /** The smoothed scroll speed (world px per tick) and the last view x. */
  private speed = 0;
  private lastX = NaN;
  /** The window of the last prepare: the chunks on screen, the ones ahead, the direction (eviction runs when it moves). */
  private winL = 0;
  private winR = -1;
  private winAhead = 0;
  private winDir = 1;
  private evictKey = NaN;
  private darkArmed = false;
  private disposed = false;

  constructor(def: SectionStripsDef, section: StripSectionInfo, opts: StripStoreOpts) {
    this.def = def;
    this.section = section;
    this.opts = opts;
    this.jobKey = opts.jobKey ?? `strips/${++storeSerial}/`;
    const s = section.scale !== undefined && section.scale > 0 ? section.scale : 1;
    this.scale = s;
    let plan: StripPlan | null = null;
    try {
      plan = getStripSource(def.source)?.plan(def, section) ?? null;
    } catch (err) {
      console.warn(`[strips] source "${def.source}" failed to plan ${section.id}:`, err);
    }
    this.plan = plan;
    this.height = Math.max(1, Math.min(STRIP_MAX_H, Math.floor(plan?.height ?? def.height), Math.floor(def.height)));
    this.budget = [opts.budgetBytes ?? STRIP_BUDGET_BYTES, opts.darkBudgetBytes ?? STRIP_DARK_BUDGET_BYTES];
    // The chunk range of the rows (the world rows in strip space).
    let c0 = 0;
    let c1 = -1;
    const r = { c0: 0, c1: -1 };
    for (const row of def.rows) {
      chunksOfRange(row.u0, row.u1, s, r);
      if (r.c1 < r.c0) continue;
      if (c1 < c0) {
        c0 = r.c0;
        c1 = r.c1;
      } else {
        c0 = Math.min(c0, r.c0);
        c1 = Math.max(c1, r.c1);
      }
    }
    if (!plan) c1 = c0 - 1;
    this.c0 = c0;
    this.c1 = c1;
    const n = Math.max(0, c1 - c0 + 1);
    this.covered = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      try {
        this.covered[i] = plan && plan.covers(c0 + i) ? 1 : 0;
      } catch (err) {
        warnOnce(`covers:${def.source}`, `[strips] source "${def.source}" covers() failed:`, err);
      }
    }
    // The dark range (world x) as chunks: touched (has a dark bake) and wholly inside.
    this.darkCovered = new Uint8Array(n);
    this.darkInside = new Uint8Array(n);
    let dc0 = 0;
    let dc1 = -1;
    if (def.dark && plan) {
      const [x0, x1] = def.dark;
      chunksOfRange(x0, x1, s, r);
      dc0 = Math.max(r.c0, c0);
      dc1 = Math.min(r.c1, c1);
      const p0 = stripXOfU(x0, s);
      const p1 = stripXOfU(x1, s);
      for (let cx = dc0; cx <= dc1; cx++) {
        if (this.covered[cx - c0] === 0) continue;
        this.darkCovered[cx - c0] = 1;
        if (cx * STRIP_CHUNK >= p0 && (cx + 1) * STRIP_CHUNK <= p1) this.darkInside[cx - c0] = 1;
      }
    }
    this.darkC0 = dc0;
    this.darkC1 = dc1;
    this.slots = [];
    for (let k = 0; k < 6; k++) this.slots.push(new Array<ChunkEntry | null>(n).fill(null));
  }

  /** Bytes held by every chunk buffer (resident, stand-ins and the ones being painted). */
  get bytes(): number {
    return this.held[0] + this.held[1];
  }

  /** Bytes held by the lit (0) or the dark (1) set. */
  setBytes(set: 0 | 1): number {
    return this.held[set];
  }

  /** The smoothed scroll speed the prefetch uses (world px per tick). */
  get smoothedSpeed(): number {
    return this.speed;
  }

  /** Bytes of one chunk buffer at density d. */
  chunkBytes(d: StripDensity): number {
    return STRIP_CHUNK * d * this.height * d * 4;
  }

  /** Is chunk cx in the plan's range and covered? */
  covers(cx: number): boolean {
    const i = cx - this.c0;
    return i >= 0 && i < this.covered.length && this.covered[i] === 1;
  }

  /** Does chunk cx have a dark bake? */
  hasDark(cx: number): boolean {
    const i = cx - this.c0;
    return i >= 0 && i < this.darkCovered.length && this.darkCovered[i] === 1;
  }

  // ------------------------------------------------------------------------------- the frame

  prepare(viewX: number, speed: number, d?: StripDensity): void {
    if (d !== undefined) this.setWant(d);
    const want = this.want;
    if (want === 0 || !this.plan || this.disposed || this.covered.length === 0) return;
    // The smoothed speed (a jump resets it: a respawn, a checkpoint, the section start).
    const step = Number.isNaN(this.lastX) ? 0 : viewX - this.lastX;
    this.lastX = viewX;
    if (Math.abs(step) > JUMP_PX) this.speed = 0;
    else this.speed += ((Number.isFinite(speed) ? speed : 0) - this.speed) * SPEED_EMA;
    const s = this.scale;
    // The chunks on screen: strip x [viewX · s, viewX · s + VIEW_W] (one more column at a sub-pixel camera).
    const p0 = viewX * s;
    const cL = Math.floor(p0 / STRIP_CHUNK);
    const cR = Math.floor((p0 + VIEW_W) / STRIP_CHUNK);
    const dir = this.speed < LEFT_SPEED ? -1 : 1;
    const base = Math.max(0, Math.floor(this.def.prefetch ?? STRIP_PREFETCH));
    const bySpeed = Math.ceil((Math.abs(this.speed) * s * STRIP_LEAD_TICKS) / STRIP_CHUNK);
    const ahead = Math.min(MAX_AHEAD, Math.max(base, bySpeed));
    this.winL = cL;
    this.winR = cR;
    this.winAhead = ahead;
    this.winDir = dir;
    // Eviction when the window moved (or the dark state changed).
    const key = ((cL * 8 + ahead) * 2 + (dir > 0 ? 1 : 0)) * 4 + (this.darkMix >= 1 ? 2 : 0) + (this.darkArmed ? 1 : 0);
    if (key !== this.evictKey) {
      this.evictKey = key;
      this.evict();
    }
    // The dark set: armed once the view's centre passes darkFrom (or a cross-fade has begun).
    if (this.darkC1 >= this.darkC0) {
      const from = this.def.darkFrom ?? (this.def.dark as readonly [number, number])[0] - 2 * STRIP_CHUNK;
      const centre = viewX + VIEW_W / 2;
      const armed = this.darkMix > 0 || centre >= from;
      if (armed !== this.darkArmed) {
        this.darkArmed = armed;
        this.evictKey = NaN;
      }
    }
    const litDone = this.darkMix >= 1;
    // On screen first (in the scroll direction), then ahead.
    for (let k = 0; k <= cR - cL; k++) {
      const cx = dir > 0 ? cL + k : cR - k;
      if (litDone && this.darkReady(cx, want)) continue;
      this.need(cx, 0, want, true);
    }
    for (let k = 1; k <= ahead; k++) this.need(dir > 0 ? cR + k : cL - k, 0, want, false);
    if (this.darkArmed) {
      // Nearest first.
      for (let k = 0; k <= this.darkC1 - this.darkC0; k++) {
        const cx = dir > 0 ? this.darkC0 + k : this.darkC1 - k;
        this.need(cx, 1, want, cx >= cL && cx <= cR);
      }
    }
  }

  chunk(cx: number, d: StripDensity, set: StripLightSet = 'lit'): PixelBuffer | null {
    const f = this.frameOf(cx, d, set);
    return f ? f.buf : null;
  }

  /** The best ready chunk at a density ≤ d in a light set, as a frame (anchor top-left; the view draws it), or null. */
  frameOf(cx: number, d: StripDensity, set: StripLightSet = 'lit'): Frame | null {
    const i = cx - this.c0;
    if (i < 0 || i >= this.covered.length) return null;
    const si = set === 'dark' ? 3 : 0;
    for (let di = dIndex(d); di >= 0; di--) {
      const e = this.slots[si + di][i];
      if (e !== null && e.ready) return e.frame;
    }
    return null;
  }

  /** Is chunk cx resident (painted) at exactly density d in a set? (tests) */
  has(cx: number, d: StripDensity, set: StripLightSet = 'lit'): boolean {
    const e = this.entry(set === 'dark' ? 1 : 0, dIndex(d), cx);
    return e !== null && e.ready;
  }

  /** Is chunk cx being painted (queued, not ready) at density d in a set? (tests) */
  pending(cx: number, d: StripDensity, set: StripLightSet = 'lit'): boolean {
    const e = this.entry(set === 'dark' ? 1 : 0, dIndex(d), cx);
    return e !== null && !e.ready;
  }

  /** How many chunk buffers are held (resident or being painted), per set, all densities. (tests) */
  count(set?: StripLightSet): number {
    let n = 0;
    for (let k = 0; k < 6; k++) {
      if (set === 'lit' && k >= 3) continue;
      if (set === 'dark' && k < 3) continue;
      const row = this.slots[k];
      for (let i = 0; i < row.length; i++) if (row[i] !== null) n++;
    }
    return n;
  }

  dispose(): void {
    this.disposed = true;
    cancelArtJobs(this.jobKey);
    for (let k = 0; k < 6; k++) this.slots[k].fill(null);
    this.held[0] = 0;
    this.held[1] = 0;
  }

  // ------------------------------------------------------------------------------- building

  /** A new draw density: the denser chunks are drawn no more (released). */
  private setWant(d: StripDensity): void {
    const dd = DENSITIES[dIndex(d)];
    if (dd === this.want) return;
    this.want = dd;
    const top = dIndex(dd);
    for (let k = 0; k < 6; k++) {
      if (k % 3 <= top) continue;
      const row = this.slots[k];
      for (let i = 0; i < row.length; i++) if (row[i] !== null) this.release(row[i] as ChunkEntry);
    }
    this.evictKey = NaN;
  }

  private entry(set: number, di: number, cx: number): ChunkEntry | null {
    const i = cx - this.c0;
    if (i < 0 || i >= this.covered.length) return null;
    return this.slots[set * 3 + di][i];
  }

  private darkReady(cx: number, want: StripDensity): boolean {
    const i = cx - this.c0;
    if (i < 0 || i >= this.covered.length || this.darkInside[i] === 0) return false;
    for (let di = dIndex(want); di >= 0; di--) {
      const e = this.slots[3 + di][i];
      if (e !== null && e.ready) return true;
    }
    return false;
  }

  /**
   * Make sure chunk cx of a set is coming at `want`. The 1× (small) and every chunk without deferral
   * (node tools, tests) are painted at once; a dense chunk is queued as band jobs, and while it is
   * not ready a chunk ON SCREEN with nothing ready below it gets its 1× now (the stand-in: also when
   * the dense one was queued as the prefetch and the view caught up with it, so no gap ever shows).
   */
  private need(cx: number, set: number, want: StripDensity, onScreen: boolean): void {
    const i = cx - this.c0;
    if (i < 0 || i >= this.covered.length || this.covered[i] === 0) return;
    if (set === 1 && this.darkCovered[i] === 0) return;
    const wi = dIndex(want);
    const slots = this.slots;
    const top = slots[set * 3 + wi][i];
    if (top !== null && top.ready) return;
    if (wi === 0 || !this.deferred()) {
      const e = top ?? this.make(cx, set, want, onScreen);
      if (e) this.paintNow(e);
      return;
    }
    if (onScreen && slots[set * 3][i] === null) {
      let ready = false;
      for (let di = wi - 1; di > 0; di--) {
        const e = slots[set * 3 + di][i];
        if (e !== null && e.ready) {
          ready = true;
          break;
        }
      }
      if (!ready) {
        const e = this.make(cx, set, 1, true);
        if (e) {
          this.paintNow(e);
          this.stats.sync++;
        }
      }
    }
    if (top !== null) return;
    const e = this.make(cx, set, want, onScreen);
    if (e) this.queue(e);
  }

  private deferred(): boolean {
    return this.opts.deferred ? this.opts.deferred() : hiArtDeferred();
  }

  /** A new entry (its buffer held) for chunk cx, or null when its set's budget has no room for it. */
  private make(cx: number, set: number, d: StripDensity, onScreen: boolean): ChunkEntry | null {
    const bytes = this.chunkBytes(d);
    const rank = onScreen ? 0 : set === 1 ? this.darkPriority(cx) : this.priority(cx);
    if (this.held[set] + bytes > this.budget[set] && !this.makeRoom(set, bytes, rank)) {
      if (!onScreen) {
        this.stats.refused++;
        return null;
      }
      this.stats.overBudget++;
    }
    let bands = 1;
    try {
      bands = Math.max(1, Math.min(64, Math.floor((this.plan as StripPlan).bands(cx, d)) || 1));
    } catch (err) {
      warnOnce(`bands:${this.def.source}`, `[strips] source "${this.def.source}" bands() failed:`, err);
    }
    const buf = new PixelBuffer(STRIP_CHUNK * d, this.height * d);
    const e: ChunkEntry = { cx, d, set, buf, frame: { buf, ox: 0, oy: 0, density: d }, bands, painted: 0, ready: false };
    this.slots[set * 3 + dIndex(d)][cx - this.c0] = e;
    this.held[set] += bytes;
    this.peaks();
    return e;
  }

  /** Paint every band of e now. */
  private paintNow(e: ChunkEntry): void {
    for (let b = e.painted; b < e.bands; b++) this.paintBand(e, b);
  }

  /** Queue e's bands as art jobs (in order; a job of a released entry does nothing). */
  private queue(e: ChunkEntry): void {
    const base = `${this.jobKey}${e.set}:${e.d}:${e.cx}:`;
    for (let b = 0; b < e.bands; b++) {
      queueArtJob(base + b, () => {
        if (this.slots[e.set * 3 + dIndex(e.d)][e.cx - this.c0] !== e || e.ready) return;
        this.paintBand(e, b);
      });
    }
  }

  private paintBand(e: ChunkEntry, band: number): void {
    const now = this.opts.now;
    const t0 = now ? now() : 0;
    const prev = setArtDensity(1);
    try {
      (this.plan as StripPlan).paint(e.cx, e.d, e.set === 1 ? 'dark' : 'lit', band, e.buf);
    } catch (err) {
      this.stats.failed++;
      warnOnce(`paint:${this.def.source}`, `[strips] source "${this.def.source}" failed to paint ${this.section.id} chunk ${e.cx} at ${e.d}x:`, err);
    } finally {
      setArtDensity(prev);
    }
    this.stats.jobs++;
    if (now) this.stats.maxJobMs = Math.max(this.stats.maxJobMs, now() - t0);
    e.painted++;
    if (e.painted >= e.bands) this.publish(e);
  }

  /** e is painted: it draws from now on; its lower densities are drawn no more (released). */
  private publish(e: ChunkEntry): void {
    e.ready = true;
    e.buf.touch();
    this.stats.built[dIndex(e.d)]++;
    // A dark bake ready after the cross-fade: the lit one under it goes at the next prepare.
    if (e.set === 1 && this.darkMix >= 1) this.evictKey = NaN;
    const i = e.cx - this.c0;
    for (let di = dIndex(e.d) - 1; di >= 0; di--) {
      const old = this.slots[e.set * 3 + di][i];
      if (old !== null) this.release(old);
    }
  }

  /** Release one entry (its buffer and its queued bands). */
  private release(e: ChunkEntry): void {
    const k = e.set * 3 + dIndex(e.d);
    const i = e.cx - this.c0;
    if (this.slots[k][i] !== e) return;
    this.slots[k][i] = null;
    this.held[e.set] -= this.chunkBytes(e.d);
    if (!e.ready) cancelArtJobs(`${this.jobKey}${e.set}:${e.d}:${e.cx}:`);
  }

  private peaks(): void {
    const st = this.stats;
    const b = this.held[0] + this.held[1];
    if (b > st.peakBytes) st.peakBytes = b;
    if (this.held[0] > st.peakLitBytes) st.peakLitBytes = this.held[0];
    if (this.held[1] > st.peakDarkBytes) st.peakDarkBytes = this.held[1];
  }

  // ------------------------------------------------------------------------------- the window

  /**
   * How much the store wants chunk cx now (lower = more): 0 on screen, k the k-th chunk ahead, 100 + j
   * the j-th behind; NO_PRIORITY outside every window. The dark chunks of an armed range rank as ahead.
   */
  private priority(cx: number): number {
    const L = this.winL;
    const R = this.winR;
    if (cx >= L && cx <= R) return 0;
    const fwd = this.winDir > 0 ? cx - R : L - cx;
    if (fwd > 0) return fwd <= this.winAhead + 1 ? fwd : NO_PRIORITY;
    const back = this.winDir > 0 ? L - cx : cx - R;
    return back < this.keepBehind() ? 100 + back : NO_PRIORITY;
  }

  /** Chunks kept behind (the def's, default STRIP_KEEP_BEHIND; at least 1). */
  private keepBehind(): number {
    return Math.max(1, Math.floor(this.def.keepBehind ?? STRIP_KEEP_BEHIND));
  }

  /** The priority of a dark chunk (armed: like the ahead chunks, by its distance; else none). */
  private darkPriority(cx: number): number {
    if (!this.darkArmed) return NO_PRIORITY;
    const p = this.priority(cx);
    if (p < 100) return p;
    // Ahead of the lit prefetch (the range is queued from darkFrom on): by distance.
    const fwd = this.winDir > 0 ? cx - this.winR : this.winL - cx;
    return fwd > 0 ? fwd : p;
  }

  /** Release what the window no longer holds (behind, past the prefetch, the lit bakes of a finished cross-fade). */
  private evict(): void {
    const n = this.covered.length;
    const keep = this.keepBehind();
    const litDone = this.darkMix >= 1;
    for (let i = 0; i < n; i++) {
      const cx = this.c0 + i;
      const fwd = this.winDir > 0 ? cx - this.winR : this.winL - cx;
      const back = this.winDir > 0 ? this.winL - cx : cx - this.winR;
      const litGone = fwd > this.winAhead + 1 || back >= keep || (litDone && this.darkInside[i] === 1 && this.darkReady(cx, this.want || 1));
      const darkGone = !this.darkArmed || back >= keep;
      for (let di = 0; di < 3; di++) {
        const l = this.slots[di][i];
        if (l !== null && litGone) {
          this.release(l);
          this.stats.evicted++;
        }
        const k = this.slots[3 + di][i];
        if (k !== null && darkGone) {
          this.release(k);
          this.stats.evicted++;
        }
      }
    }
  }

  /**
   * Free `bytes` in a set's budget by releasing its entries that the store wants less than a chunk
   * of priority `rank` (furthest first: behind before the far prefetch; never on screen). True when
   * there is room now.
   */
  private makeRoom(set: number, bytes: number, rank: number): boolean {
    const budget = this.budget[set];
    const n = this.covered.length;
    while (this.held[set] + bytes > budget) {
      let worst: ChunkEntry | null = null;
      let worstP = rank;
      for (let i = 0; i < n; i++) {
        const cx = this.c0 + i;
        const p = set === 1 ? this.darkPriority(cx) : this.priority(cx);
        if (p <= worstP) continue;
        for (let di = 0; di < 3; di++) {
          const e = this.slots[set * 3 + di][i];
          if (e === null) continue;
          worst = e;
          worstP = p;
          break;
        }
      }
      if (worst === null) return false;
      this.release(worst);
      this.stats.squeezed++;
    }
    return true;
  }
}

/** The world x range of a store's chunk cx (debug overlays, tests). */
export function stripChunkWorld(store: StripStore, cx: number): readonly [number, number] {
  return [uOfStripX(cx * STRIP_CHUNK, store.scale), uOfStripX((cx + 1) * STRIP_CHUNK, store.scale)];
}
