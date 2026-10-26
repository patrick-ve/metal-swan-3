/**
 * The floor texture store (docs/design/floor.md §3.2): the chunk textures (the painter's top
 * surface, CHUNK_U world px × the band, at density 1, 2 or 4) and the tile textures (materials with
 * v-mips), built lazily, as art jobs in the browser, released behind the camera. Layout and sampling:
 * tex-layout.ts.
 *
 * - `chunk(k, want)` / `tile(m, want)` give the best texture ready at a density ≤ want (4 → 2 → 1)
 *   and make sure `want` is coming: built at once when not deferred (node tools, tests), else queued
 *   as art jobs (`queueArtJob`, run by the budgeted preload or SectionView's per-frame
 *   `runArtJobs`). A chunk is queued in slices of `sliceU(d)` world px (one art job each: 64 u at
 *   1× and 2×, 16 u at 4×, about 3 ms); it shows only once every slice is painted. With nothing
 *   ready at all the 1× texture is built on the spot (small: about 21 k texels).
 * - `prefetch(camX, want)` queues the chunks just outside the view; `evict(camX)` releases every
 *   chunk EVICT_BEHIND or more chunks left of the view (and cancels its jobs).
 * - Memory: `bytes(d)` / `bytes()`; over FLOOR_BUDGET_BYTES at 4× the store caps itself at 2×
 *   (`capped`), spec §3.2 "over budget, the floor uses 2× textures at tier 4": no NEW 4× texture is
 *   built, a resident one still draws (never a step down), and the cap clears again after the
 *   eviction has made room for CAP_CLEAR_CHUNKS chunks.
 * - `version` counts every texture published or released (a GPU can skip its sync when unchanged).
 */
import type { Color } from '../color';
import { PixelBuffer } from '../pixel';
import { cancelArtJobs, queueArtJob } from '../sprites';
import { vOfY, type FloorCam } from './cam';
import { CHUNK_APRON, CHUNK_U, chunkCols, chunkKey, MAX_ROW_SAMPLES, rowsOf, tileKey } from './tex-layout';

/** World px of one chunk slice (one art job) at density 1 and 2. */
export const SLICE_U = 64;
/**
 * World px of one slice at 4× (32 jobs per chunk): a 4× slice of 64 u took 11–13 ms in the browser,
 * so a frame that ran one went over 16.7 ms with the frame's own work and the per-frame job budget
 * (`HI_ART_FRAME_BUDGET_MS` 8, checked after each job); 16 u was about 3 ms on average but up to
 * 7–9 ms on the busiest ams stretches (FIX, wave A), 8 u keeps every job under about 5 ms.
 */
export const SLICE_U_4X = 8;

/** World px of one chunk slice at density d. */
export function sliceU(d: number): number {
  return d >= 4 ? SLICE_U_4X : SLICE_U;
}
/** Chunks this many (or more) left of the view are released (as the terrain chunks). */
export const FLOOR_EVICT_BEHIND = 2;
/**
 * The 4× chunks (1.7 MB each) go sooner: one chunk left of the view, once the view's left edge is
 * EVICT_MARGIN_U past that chunk's end (a shake does not bring it back at once).
 */
export const FLOOR_EVICT_BEHIND_4X = 1;
export const EVICT_MARGIN_U = 24;
/** The floor's CPU texture budget at tier 4 (spec §3.2). */
export const FLOOR_BUDGET_BYTES = 16 * 1024 * 1024;
/** A capped store builds 4× again once its 4× set has room for this many more chunks. */
export const CAP_CLEAR_CHUNKS = 3;

/** A texel painter: the colour at world (u, v) (chunks) or at tile coordinates (a, b), texel centres. */
export type TexelFn = (u: number, v: number) => Color;

/** A tile material as the store builds it. */
export interface TileSource {
  /** Size in world px (h a multiple of 4). */
  readonly w: number;
  readonly h: number;
  readonly paint: TexelFn;
}

/** What the store paints with (the game layer binds the painter ids, params and seed). */
export interface FloorPaintSource {
  /** The chunk painter at density d. */
  chunkPainter(d: number): TexelFn;
  /** Tile material `m` at density d (null: unknown, drawn as a magenta tile). */
  tile(m: number, d: number): TileSource | null;
}

/** One floor texture (immutable once published). */
export interface FloorTexture {
  /** `c<k>@<d>` or `t<m>@<d>` (unique in its store; a GPU uploads each key once). */
  readonly key: string;
  readonly kind: 'chunk' | 'tile';
  /** Texels per world px. */
  readonly density: number;
  /** chunk: one level (rows layout); tile: its v-mips down to one row (bakeTile). */
  readonly levels: readonly PixelBuffer[];
  /** chunk: its first u (k · CHUNK_U); tile: 0. */
  readonly u0: number;
  /** World px covered: chunk CHUNK_U × the band height; tile its repeat size. */
  readonly w: number;
  readonly h: number;
}

export interface FloorStoreOpts {
  /** Prefix of this store's art-job keys (cancelled by `dispose`). */
  readonly jobKey: string;
  /** Queue dense work as art jobs (the browser) instead of building it at once. */
  readonly deferred: () => boolean;
  /** The floor's last u (its mesh's end): no chunk past it is prefetched. */
  readonly uMax?: number;
}

interface Building {
  buf: PixelBuffer;
  left: number;
}

const MAGENTA: Color = 0xff00ffff;

/**
 * Paint columns [c0, c1) of chunk k at density d into `out` (chunkCols(d) × rowsOf(cam, d)): every
 * texel is the mean of the painter over its row's v range (the screen row's footprint).
 */
export function bakeChunkRows(cam: FloorCam, k: number, d: number, paint: TexelFn, out: PixelBuffer, c0 = 0, c1 = out.w): void {
  const rows = out.h;
  const W = out.w;
  const data = out.data;
  const u0 = k * CHUNK_U;
  for (let j = 0; j < rows; j++) {
    const va = vOfY(cam, cam.back + j / d);
    const vb = vOfY(cam, cam.back + (j + 1) / d);
    const span = vb - va;
    let n = Math.ceil(span * d - 1e-6);
    if (n < 1) n = 1;
    else if (n > MAX_ROW_SAMPLES) n = MAX_ROW_SAMPLES;
    const row = j * W;
    if (n === 1) {
      const v = va + span / 2;
      for (let i = c0; i < c1; i++) data[row + i] = (paint(u0 + (i - CHUNK_APRON + 0.5) / d, v) | 255) >>> 0;
      continue;
    }
    const inv = 1 / n;
    for (let i = c0; i < c1; i++) {
      const u = u0 + (i - CHUNK_APRON + 0.5) / d;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let s = 0; s < n; s++) {
        const c = paint(u, va + ((s + 0.5) * span) / n);
        r += c >>> 24;
        g += (c >>> 16) & 255;
        b += (c >>> 8) & 255;
      }
      data[row + i] = (((Math.round(r * inv) << 24) | (Math.round(g * inv) << 16) | (Math.round(b * inv) << 8) | 255) >>> 0);
    }
  }
  out.touch();
}

/** Level-0 texels a tile job paints at most (a few ms; a big tile is baked in several jobs). */
export const TILE_SLICE_TEXELS = 16384;

/**
 * A tile being baked at density d: level 0 painted at texel centres (`rows`, in slices), then the
 * v-mips down to ONE row (`finish`: each row the mean of the rows of the level above it covers; the
 * band uses the first BAND_TILE_LEVELS, the quads and faces the whole chain: tex-layout.ts).
 */
export class TileBake {
  readonly l0: PixelBuffer;
  /** Level-0 rows painted so far. */
  y = 0;
  private readonly src: TileSource;
  private readonly d: number;

  constructor(src: TileSource, d: number) {
    this.src = src;
    this.d = d;
    this.l0 = new PixelBuffer(Math.max(1, Math.round(src.w * d)), Math.max(4, Math.round(src.h * d)));
  }

  /** Paint up to n more rows of level 0; true once all are painted. */
  rows(n: number): boolean {
    const l0 = this.l0;
    const W = l0.w;
    const d = this.d;
    const end = Math.min(l0.h, this.y + n);
    for (let y = this.y; y < end; y++) {
      const b = (y + 0.5) / d;
      for (let x = 0; x < W; x++) l0.data[y * W + x] = (this.src.paint((x + 0.5) / d, b) | 255) >>> 0;
    }
    this.y = end;
    return end >= l0.h;
  }

  /** The levels: level 0 and its v-mips down to one row. */
  finish(): PixelBuffer[] {
    const l0 = this.l0;
    const W = l0.w;
    l0.touch();
    const levels = [l0];
    while (levels[levels.length - 1].h > 1) {
      const up = levels[levels.length - 1];
      const h = up.h >> 1;
      const lv = new PixelBuffer(W, h);
      for (let y = 0; y < h; y++) {
        // The rows of the level above that this row covers (two; three for the last row of an odd one).
        const r0 = 2 * y;
        const r1 = y === h - 1 ? up.h : 2 * y + 2;
        const n = r1 - r0;
        for (let x = 0; x < W; x++) {
          let r = 0;
          let g = 0;
          let bl = 0;
          for (let j = r0; j < r1; j++) {
            const c = up.data[j * W + x];
            r += c >>> 24;
            g += (c >>> 16) & 255;
            bl += (c >>> 8) & 255;
          }
          lv.data[y * W + x] = ((Math.round(r / n) << 24) | (Math.round(g / n) << 16) | (Math.round(bl / n) << 8) | 255) >>> 0;
        }
      }
      lv.touch();
      levels.push(lv);
    }
    return levels;
  }
}

/** The levels of a tile at density d (baked at once: `TileBake`). */
export function bakeTile(src: TileSource, d: number): PixelBuffer[] {
  const b = new TileBake(src, d);
  b.rows(b.l0.h);
  return b.finish();
}

function textureBytes(t: FloorTexture): number {
  let n = 0;
  for (const l of t.levels) n += l.w * l.h * 4;
  return n;
}

const DENSITIES = [4, 2, 1] as const;

export class FloorTextureStore {
  readonly cam: FloorCam;
  private readonly src: FloorPaintSource;
  private readonly opts: FloorStoreOpts;
  /** Published chunk textures by density, then chunk index. */
  private readonly chunks: Record<number, Map<number, FloorTexture>> = { 1: new Map(), 2: new Map(), 4: new Map() };
  private readonly building: Record<number, Map<number, Building>> = { 1: new Map(), 2: new Map(), 4: new Map() };
  private readonly tiles: Record<number, Map<number, FloorTexture>> = { 1: new Map(), 2: new Map(), 4: new Map() };
  private readonly tileQueued: Record<number, Set<number>> = { 1: new Set(), 2: new Set(), 4: new Set() };
  private readonly painters: Record<number, TexelFn | undefined> = {};
  private residentBytes: Record<number, number> = { 1: 0, 2: 0, 4: 0 };
  private evictCol = -1e9;
  /** Bumped on every publish / release. */
  version = 0;
  /** Chunk textures painted so far (debug / tests). */
  built = 0;
  /** Chunk textures released behind the camera (debug / tests). */
  evicted = 0;
  /** The 4× textures would pass FLOOR_BUDGET_BYTES: the store draws 2× at tier 4. */
  capped = false;

  constructor(cam: FloorCam, src: FloorPaintSource, opts: FloorStoreOpts) {
    this.cam = cam;
    this.src = src;
    this.opts = opts;
  }

  /** CPU bytes of the resident textures at density d (all densities without d). */
  bytes(d?: number): number {
    if (d !== undefined) return this.residentBytes[d] ?? 0;
    return this.residentBytes[1] + this.residentBytes[2] + this.residentBytes[4];
  }

  /** CPU bytes of the chunks being painted (their buffers exist from the moment they are queued). */
  pendingBytes(): number {
    let n = 0;
    for (const d of DENSITIES) for (const b of this.building[d].values()) n += b.buf.data.byteLength;
    return n;
  }

  /** The density the store builds for a wanted density (4 → 2 when capped). */
  buildDensity(want: number): 1 | 2 | 4 {
    if (want >= 4) return this.capped ? 2 : 4;
    return want >= 2 ? 2 : 1;
  }

  /**
   * The best chunk texture ready at a density ≤ want (never null for a chunk in range: 1× on the
   * spot). A resident 4× chunk is returned while the store is capped too (the cap stops new 4×
   * builds; it never swaps a loaded chunk down: no pop, no seam).
   */
  chunk(k: number, want: number): FloorTexture | null {
    const d = this.buildDensity(want);
    this.request(k, d);
    const top = want >= 4 ? 4 : want >= 2 ? 2 : 1;
    for (const dd of DENSITIES) {
      if (dd > top) continue;
      const t = this.chunks[dd].get(k);
      if (t) return t;
    }
    // Nothing at all: the small 1× texture now.
    this.buildChunkNow(k, 1);
    return this.chunks[1].get(k) ?? null;
  }

  /** The best tile texture of material m ready at a density ≤ want (1× on the spot when none; never a step down). */
  tile(m: number, want: number): FloorTexture | null {
    const d = this.buildDensity(want);
    if (!this.tiles[d].has(m)) {
      if (d === 1 || !this.opts.deferred()) this.buildTileNow(m, d);
      else this.queueTile(m, d);
    }
    const top = want >= 4 ? 4 : want >= 2 ? 2 : 1;
    for (const dd of DENSITIES) {
      if (dd > top) continue;
      const t = this.tiles[dd].get(m);
      if (t) return t;
    }
    this.buildTileNow(m, 1);
    return this.tiles[1].get(m) ?? null;
  }

  /**
   * Make sure tile m at the density for `want` is built or coming (no stand-in is made: a prefetch
   * ahead of the view, spec §3.2).
   */
  prefetchTile(m: number, want: number): void {
    const d = this.buildDensity(want);
    if (this.tiles[d].has(m)) return;
    if (d === 1 || !this.opts.deferred()) this.buildTileNow(m, d);
    else this.queueTile(m, d);
  }

  /** Release every density of tile m (its users are behind the view) and drop its queued jobs. */
  releaseTile(m: number): void {
    for (const d of DENSITIES) {
      const t = this.tiles[d].get(m);
      if (t) {
        this.residentBytes[d] -= textureBytes(t);
        this.tiles[d].delete(m);
        this.version++;
      }
      if (this.tileQueued[d].delete(m)) cancelArtJobs(`${this.opts.jobKey}T${d}:${m};`);
    }
  }

  /** Is tile m resident at density d? (tests) */
  hasTile(m: number, d: number): boolean {
    return this.tiles[d]?.has(m) ?? false;
  }

  /**
   * Queue tile m at density d as art jobs: one job that paints TILE_SLICE_TEXELS of level 0 and
   * queues itself again until the tile is done (a big tile is spread over frames), then its mips.
   */
  private queueTile(m: number, d: number): void {
    if (this.tileQueued[d].has(m)) return;
    this.tileQueued[d].add(m);
    const key = `${this.opts.jobKey}T${d}:${m};`;
    let bake: TileBake | null = null;
    let src: TileSource | null = null;
    const step = (): void => {
      if (!this.tileQueued[d].has(m)) return;
      try {
        if (!bake) {
          src = this.tileSource(m, d);
          bake = new TileBake(src, d);
        }
        if (!bake.rows(Math.max(1, Math.floor(TILE_SLICE_TEXELS / bake.l0.w)))) {
          queueArtJob(key, step);
          return;
        }
        this.tileQueued[d].delete(m);
        this.publishTile(m, d, bake.finish(), (src as TileSource).w, (src as TileSource).h);
      } catch (err) {
        console.warn('[floor] tile failed:', err);
        this.tileQueued[d].delete(m);
        this.publishTile(m, d, bakeTile({ w: 8, h: 8, paint: () => MAGENTA }, d), 8, 8);
      }
    };
    queueArtJob(key, step);
  }

  /**
   * Queue (or build) the chunks just outside the view at the wanted density: the next one ahead, and
   * below 4× the one behind (a 4× one behind is released soon after, `evict`); none past the floor.
   */
  prefetch(camX: number, want: number, sBack: number): void {
    const d = this.buildDensity(want);
    const half = 192 / Math.max(0.1, sBack);
    const eye = camX + 192;
    const k0 = Math.floor((eye - half) / CHUNK_U) - 1;
    const k1 = Math.floor((eye + half) / CHUNK_U) + 1;
    const last = Math.floor((this.opts.uMax ?? Infinity) / CHUNK_U);
    if (k1 >= 0 && k1 <= last) this.request(k1, d);
    if (k0 >= 0 && d < 4) this.request(k0, d);
  }

  /**
   * Release the chunks FLOOR_EVICT_BEHIND or more chunks left of the view, the 4× ones
   * FLOOR_EVICT_BEHIND_4X (and cancel their jobs).
   */
  evict(camX: number, sBack: number): void {
    const left = camX + 192 - 192 / Math.max(0.1, sBack);
    const limit = Math.floor(left / CHUNK_U) - FLOOR_EVICT_BEHIND;
    const limit4 = Math.floor((left - EVICT_MARGIN_U) / CHUNK_U) - FLOOR_EVICT_BEHIND_4X;
    if (limit4 === this.evictCol) return;
    this.evictCol = limit4;
    for (const d of DENSITIES) {
      const lim = d === 4 ? limit4 : limit;
      for (const k of [...this.chunks[d].keys()]) {
        if (k > lim) continue;
        this.residentBytes[d] -= textureBytes(this.chunks[d].get(k) as FloorTexture);
        this.chunks[d].delete(k);
        this.evicted++;
        this.version++;
      }
      for (const k of [...this.building[d].keys()]) {
        if (k > lim) continue;
        this.building[d].delete(k);
        cancelArtJobs(`${this.opts.jobKey}C${d}:${k}:`);
      }
    }
    // The cap clears again once the 4× set has room for CAP_CLEAR_CHUNKS chunks (hysteresis: it
    // does not flip at every chunk).
    if (this.capped && this.residentBytes[4] + CAP_CLEAR_CHUNKS * this.chunkBytes(4) <= FLOOR_BUDGET_BYTES) this.capped = false;
  }

  /** Drop every queued job (the view is replaced). */
  dispose(): void {
    cancelArtJobs(this.opts.jobKey);
    for (const d of DENSITIES) this.building[d].clear();
  }

  /** Every published chunk texture (debug / tests / a GPU that syncs by listing). */
  chunkList(d: number): FloorTexture[] {
    return [...(this.chunks[d]?.values() ?? [])];
  }

  /** Is chunk k published at density d? */
  hasChunk(k: number, d: number): boolean {
    return this.chunks[d]?.has(k) ?? false;
  }

  // ------------------------------------------------------------------------------- building

  private painter(d: number): TexelFn {
    let p = this.painters[d];
    if (!p) {
      try {
        p = this.src.chunkPainter(d);
      } catch (err) {
        console.warn('[floor] painter failed:', err);
        p = () => MAGENTA;
      }
      this.painters[d] = p;
    }
    return p;
  }

  /** Make sure chunk k at density d is built or coming. */
  private request(k: number, d: 1 | 2 | 4): void {
    if (this.chunks[d].has(k) || this.building[d].has(k)) return;
    if (d === 1 || !this.opts.deferred()) {
      this.buildChunkNow(k, d);
      return;
    }
    if (d === 4 && this.residentBytes[4] + (this.building[4].size + 1) * this.chunkBytes(4) > FLOOR_BUDGET_BYTES) {
      this.capped = true;
      this.request(k, 2);
      return;
    }
    const W = chunkCols(d);
    const su = sliceU(d);
    const n = Math.ceil(CHUNK_U / su);
    const b: Building = { buf: new PixelBuffer(W, rowsOf(this.cam, d)), left: n };
    this.building[d].set(k, b);
    for (let s = 0; s < n; s++) {
      // The aprons go with the first and the last slice.
      const c0 = s === 0 ? 0 : s * su * d + CHUNK_APRON;
      const c1 = s === n - 1 ? W : (s + 1) * su * d + CHUNK_APRON;
      queueArtJob(`${this.opts.jobKey}C${d}:${k}:${s}`, () => {
        if (this.building[d].get(k) !== b) return;
        this.paintSafe(k, d, b.buf, c0, c1);
        if (--b.left === 0) {
          this.building[d].delete(k);
          this.publishChunk(k, d, b.buf);
        }
      });
    }
  }

  private chunkBytes(d: number): number {
    return chunkCols(d) * rowsOf(this.cam, d) * 4;
  }

  private buildChunkNow(k: number, d: 1 | 2 | 4): void {
    if (this.chunks[d].has(k)) return;
    if (d === 4 && this.residentBytes[4] + this.chunkBytes(4) > FLOOR_BUDGET_BYTES && this.opts.deferred()) {
      this.capped = true;
      return;
    }
    this.building[d].delete(k);
    const buf = new PixelBuffer(chunkCols(d), rowsOf(this.cam, d));
    this.paintSafe(k, d, buf, 0, buf.w);
    this.publishChunk(k, d, buf);
  }

  private paintSafe(k: number, d: number, buf: PixelBuffer, c0: number, c1: number): void {
    try {
      bakeChunkRows(this.cam, k, d, this.painter(d), buf, c0, c1);
    } catch (err) {
      console.warn(`[floor] chunk ${k} at ${d}x failed:`, err);
      for (let y = 0; y < buf.h; y++) buf.data.fill(MAGENTA, y * buf.w + c0, y * buf.w + c1);
      buf.touch();
    }
  }

  private publishChunk(k: number, d: number, buf: PixelBuffer): void {
    const t: FloorTexture = { key: chunkKey(k, d), kind: 'chunk', density: d, levels: [buf], u0: k * CHUNK_U, w: CHUNK_U, h: this.cam.front - this.cam.back };
    this.chunks[d].set(k, t);
    this.residentBytes[d] += textureBytes(t);
    this.built++;
    this.version++;
    // Its stand-ins (the lower densities of this chunk) are not drawn again: released.
    for (const dd of DENSITIES) {
      if (dd >= d) continue;
      const old = this.chunks[dd].get(k);
      if (!old) continue;
      this.residentBytes[dd] -= textureBytes(old);
      this.chunks[dd].delete(k);
    }
  }

  private buildTileNow(m: number, d: number): void {
    if (this.tiles[d].has(m)) return;
    let levels: PixelBuffer[];
    let w = 8;
    let h = 8;
    try {
      const src = this.tileSource(m, d);
      levels = bakeTile(src, d);
      w = src.w;
      h = src.h;
    } catch (err) {
      console.warn('[floor] tile failed:', err);
      levels = bakeTile({ w, h, paint: () => MAGENTA }, d);
    }
    // A job of the same tile still painting is not needed any more.
    if (this.tileQueued[d].delete(m)) cancelArtJobs(`${this.opts.jobKey}T${d}:${m};`);
    this.publishTile(m, d, levels, w, h);
  }

  /** Tile m's source at density d (throws for an unknown one or a bad height). */
  private tileSource(m: number, d: number): TileSource {
    const src = this.src.tile(m, d);
    if (!src) throw new Error(`no tile material ${m}`);
    if (src.h % 4 !== 0) throw new Error(`tile material ${m}: height ${src.h} is not a multiple of 4`);
    return src;
  }

  private publishTile(m: number, d: number, levels: PixelBuffer[], w: number, h: number): void {
    if (this.tiles[d].has(m)) return;
    const t: FloorTexture = { key: tileKey(String(m), d), kind: 'tile', density: d, levels, u0: 0, w, h };
    this.tiles[d].set(m, t);
    this.residentBytes[d] += textureBytes(t);
    this.version++;
  }
}
