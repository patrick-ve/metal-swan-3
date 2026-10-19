/**
 * Draws a section's scenery: parallax background layers (from named generators, built lazily),
 * terrain painted in 256×256 chunks (by the registered terrain painter sampling
 * `terrain.cellAt`, built lazily and prefetched ahead of the camera) and decor sprites.
 *
 * Call order per frame (camera already set on the renderer):
 *   view.drawBack(r, tick) → world.draw(r) → view.drawFront(r, tick)
 *
 * Dense scenery (docs/ARCHITECTURE.md §3): a view made with density 2 or 4 (the mission's
 * `artDensity`, its highest) draws at d = min(density, `artTier()`), never above the renderer's
 * res: the buffer of a layer whose generator has a version at d (`makeHiBgLayer`) and of a
 * terrain chunk the painter at d paints (`makeHiTerrain`), over the same logical rectangle. Items
 * without art at d use the highest lower density that has it (4 → 2 → 1), and an item at d that
 * is not built yet draws its lower one meanwhile. The 1× buffers are always built first. With
 * `setDeferHiArt(true)` (the browser) the dense items are queued as art jobs, run by the
 * budgeted preload or, after it, here within HI_ART_FRAME_BUDGET_MS per frame; otherwise
 * (headless tools, tests) they are built when first drawn. Dense chunks more than
 * EVICT_BEHIND_CHUNKS chunks left of the view are released (ams scrolls forward; a released
 * chunk is rebuilt if the camera comes back).
 */
import { PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, ParallaxOpts, Renderer } from '../../engine/render';
import { VIEW_H, VIEW_W } from '../../engine/render';
import type { Frame } from '../../engine/render';
import {
  artPreloadActive,
  artTier,
  cancelArtJobs,
  HI_ART_FRAME_BUDGET_MS,
  hiArtDeferred,
  hiArtOn,
  queueArtJob,
  runArtJobs,
  spriteAnim,
  withArtDensity,
} from '../../engine/sprites';
import type { Terrain } from '../../engine/terrain';
import {
  bgDensityFor,
  getBgGenerator,
  getTerrainPainter,
  HI_SCENERY_DENSITY,
  makeHiBgLayer,
  makeHiTerrain,
  terrainDensityFor,
  type BgLayerDef,
  type SceneryDensity,
  type TerrainSampler,
} from '../art/art-registry';
import type { DecorDef, SectionDef } from './types';

/** Terrain chunk size (px). */
export const CHUNK = 256;
/** Extra chunks generated per frame ahead of the view (keeps scrolling smooth). */
const PREFETCH_PER_FRAME = 1;
/** Dense chunks this many chunks (or more) left of the view are released. */
export const EVICT_BEHIND_CHUNKS = 2;

interface Layer {
  readonly def: BgLayerDef;
  buf: PixelBuffer | null;
  /**
   * The dense buffers by density: undefined = not built (yet), null = none (no generator at
   * that density, or it failed).
   */
  hi: Record<SceneryDensity, PixelBuffer | null | undefined>;
}

/** Serial number of views (keys of their queued 2× jobs). */
let viewSerial = 0;

const decorOpts: DrawOpts = {};
const pitOpts: DrawOpts = {};
const layerOpts: ParallaxOpts = {};
const hiLayerOpts: Record<SceneryDensity, ParallaxOpts> = { 2: { density: 2 }, 4: { density: 4 } };
/** The pit shaft: dark navy fading to ink (palette colours), band heights from the rim down. */
const PIT_BANDS: readonly number[] = [PAL.navy[1], PAL.navy[0], PAL.ink[1], PAL.ink[0]];
const PIT_BAND_H: readonly number[] = [4, 8, 14, 0];

interface PitSpan {
  x0: number;
  x1: number;
  /** Top of the shaft: the lower of the two rims (the ground on each side covers the rest). */
  y: number;
}

/** Gaps between consecutive ground polylines (sorted by x). */
function pitSpans(t: Terrain): PitSpan[] {
  const lines = [...t.def.ground].filter((l) => l.length >= 2).sort((a, b) => a[0][0] - b[0][0]);
  const out: PitSpan[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const end = lines[i][lines[i].length - 1];
    const start = lines[i + 1][0];
    if (start[0] - end[0] < 2) continue;
    out.push({ x0: end[0], x1: start[0], y: Math.max(end[1], start[1]) });
  }
  return out;
}

/**
 * A 2× chunk buffer as a frame without its transparent margins (most chunks are partly sky, and
 * a 2× chunk is four times the memory): cropped to whole logical pixels, the anchor moved so that
 * drawing the frame at the chunk's top-left puts every pixel where it was. Null when empty.
 */
function trimmedChunk(buf: PixelBuffer, d: number = HI_SCENERY_DENSITY): Frame | null {
  const b = buf.trimBounds();
  if (!b) return null;
  const x0 = Math.floor(b.x / d) * d;
  const y0 = Math.floor(b.y / d) * d;
  const x1 = Math.ceil((b.x + b.w) / d) * d;
  const y1 = Math.ceil((b.y + b.h) / d) * d;
  const crop = x0 === 0 && y0 === 0 && x1 === buf.w && y1 === buf.h ? buf : buf.crop(x0, y0, x1 - x0, y1 - y0);
  return { buf: crop, ox: -x0 / d, oy: -y0 / d, density: d };
}

export class SectionView {
  readonly section: SectionDef;
  private readonly seed: number;
  private readonly layers: Layer[];
  /** Chunk buffers by key (null = generated but empty). */
  private readonly chunks = new Map<number, PixelBuffer | null>();
  private readonly back: DecorDef[];
  private readonly front: DecorDef[];
  private readonly sample: TerrainSampler;
  /** Gaps between ground polylines (pits), with the lower rim height. */
  private readonly pits: readonly PitSpan[];
  /** Chunks generated so far (debug / tests). */
  generated = 0;
  /** The highest art density (1, 2 or 4: the mission's `artDensity`); drawing uses `drawDensity`. */
  readonly density: 1 | 2 | 4;
  /** Dense chunk frames by density and key (null = none: no finer art there, or it failed). */
  private readonly hiChunkMaps: Record<SceneryDensity, Map<number, Frame | null>> = { 2: new Map(), 4: new Map() };
  /** Key prefix of this view's queued dense jobs. */
  private readonly jobKey: string;
  /** Dense items built so far (debug / tests). */
  hiGenerated = 0;
  /** Dense chunks released behind the camera so far (debug / tests). */
  evicted = 0;
  /** The chunk column of the last eviction pass (one pass per column the camera enters). */
  private evictCol = -1;

  constructor(section: SectionDef, terrain: Terrain, seed: number, density = 1) {
    this.section = section;
    this.seed = seed;
    this.density = density >= 4 ? 4 : density >= HI_SCENERY_DENSITY ? 2 : 1;
    this.layers = (section.background?.layers ?? []).map((def) => ({ def, buf: null, hi: { 2: undefined, 4: undefined } }));
    this.jobKey = `scenery/${++viewSerial}/`;
    const decor = section.decor ?? [];
    this.back = decor.filter((d) => !d.front);
    this.front = decor.filter((d) => d.front);
    this.sample = (x, y) => terrain.cellAt(x, y);
    this.pits = pitSpans(terrain);
  }

  /** Background colour behind every layer. */
  get sky(): number {
    return this.section.background?.sky ?? 0x000000ff;
  }

  /**
   * Build everything a view at (camX, camY) needs right now (section start, respawn jumps): the
   * 1× art; the 2× art is queued when deferred (the browser), else built when first drawn (so
   * headless runs that never draw never build it).
   */
  prepare(camX: number, camY: number): void {
    const want = this.hiOn && hiArtDeferred() ? this.drawDensity() : 1;
    const td = want > 1 ? this.terrainDensity(want) : 1;
    for (let i = 0; i < this.layers.length; i++) {
      this.layerBuf(i);
      const ld = want > 1 ? bgDensityFor(this.layers[i].def.gen, want) : 1;
      if (ld > 1) this.hiLayer(i, ld as SceneryDensity);
    }
    const x0 = Math.floor(camX / CHUNK);
    const x1 = Math.floor((camX + VIEW_W - 1) / CHUNK);
    const y0 = Math.floor(camY / CHUNK);
    const y1 = Math.floor((camY + VIEW_H - 1) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        this.chunk(cx, cy);
        if (td > 1) this.hiChunk(cx, cy, td as SceneryDensity);
      }
    }
  }

  /**
   * The density the view draws at now: min(`density`, `artTier()`) (dense art on), else 1.
   * Items use the highest density ≤ this that has art (and ≤ the renderer's res).
   */
  drawDensity(): 1 | 2 | 4 {
    if (!this.hiOn) return 1;
    const t = artTier();
    return t < this.density ? t : this.density;
  }

  /** The terrain density for a wanted density (the highest ≤ want with dense terrain art). */
  private terrainDensity(want: number): 1 | 2 | 4 {
    return terrainDensityFor(this.section.terrainStyle ?? { ground: 'dirt' }, want);
  }

  /** The highest density ≤ want that the renderer res k can show (4 needs 4 | k; 2 needs k ≥ 2). */
  private static atRes(want: number, k: number): number {
    if (want >= 4 && k >= 4 && k % 4 === 0) return 4;
    return want >= 2 && k >= 2 ? 2 : 1;
  }

  /** Drop this view's queued 2× jobs (the runner replaces the view). */
  dispose(): void {
    cancelArtJobs(this.jobKey);
  }

  /** Draw dense scenery at all? (density ≥ 2 and dense art not switched off by `setHiArt(false)`). */
  private get hiOn(): boolean {
    return this.density > 1 && hiArtOn();
  }

  /** Background layers, the dark behind pits, terrain and back decor. */
  drawBack(r: Renderer, tick: number): void {
    for (let i = 0; i < this.layers.length; i++) {
      if (!this.layers[i].def.front) this.drawLayer(r, i, tick);
    }
    this.drawPits(r);
    this.drawDecor(r, this.back, tick);
    const camX = r.camX;
    const camY = r.camY;
    // A sub-pixel camera (high-resolution backbuffer) shows part of one more pixel column / row.
    const x0 = Math.floor(camX / CHUNK);
    const x1 = Math.floor((Math.ceil(camX) + VIEW_W - 1) / CHUNK);
    const y0 = Math.floor(camY / CHUNK);
    const y1 = Math.floor((Math.ceil(camY) + VIEW_H - 1) / CHUNK);
    // At res 1 the 1× chunk is the exact image (a dense chunk would be drawn reduced); at res 2
    // or 3 the 2× chunk.
    const td = this.terrainDensity(SectionView.atRes(this.drawDensity(), r.res));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const buf = this.chunk(cx, cy);
        if (!buf) continue;
        let f: Frame | null = null;
        if (td > 1) {
          f = this.hiChunk(cx, cy, td as SceneryDensity);
          // Not built yet at 4: the 2× chunk when it is there (never built for this).
          if (!f && td === 4) f = this.hiChunkMaps[2].get(this.key(cx, cy)) ?? null;
        }
        if (f) r.frame(f, cx * CHUNK, cy * CHUNK);
        else r.image(buf, cx * CHUNK, cy * CHUNK);
      }
    }
    this.prefetch(camX, camY, td);
    if (td > 1) this.evictBehind(camX);
    // Without a running preload, this view runs its own queued dense jobs within the frame budget.
    if (this.density > 1 && hiArtDeferred() && !artPreloadActive()) runArtJobs(HI_ART_FRAME_BUDGET_MS);
  }

  /** Front decor and foreground layers. */
  drawFront(r: Renderer, tick: number): void {
    this.drawDecor(r, this.front, tick);
    for (let i = 0; i < this.layers.length; i++) {
      if (this.layers[i].def.front) this.drawLayer(r, i, tick);
    }
  }

  // ------------------------------------------------------------------------------- pits

  /**
   * Pits read as deadly drops, not as windows into the background: a dark shaft fades in under
   * every gap in the ground (from the lower rim down to the bottom of the section).
   */
  private drawPits(r: Renderer): void {
    const pits = this.pits;
    if (pits.length === 0) return;
    const camX = r.camX;
    const camY = r.camY;
    const bottom = Math.max(this.section.height, camY + VIEW_H);
    for (let i = 0; i < pits.length; i++) {
      const p = pits[i];
      if (p.x1 < camX || p.x0 > camX + VIEW_W) continue;
      const w = p.x1 - p.x0;
      // Three bands getting darker toward the bottom, dithered at the top edge by a 2 px step.
      let y = p.y;
      for (let k = 0; k < PIT_BANDS.length; k++) {
        const h = k === PIT_BANDS.length - 1 ? bottom - y : PIT_BAND_H[k];
        if (h <= 0) break;
        r.rect(p.x0, y, w, h, PIT_BANDS[k], pitOpts);
        y += h;
      }
    }
  }

  // ------------------------------------------------------------------------------- layers

  private layerBuf(i: number): PixelBuffer | null {
    const l = this.layers[i];
    if (l.buf) return l.buf;
    const d = l.def;
    const w = Math.max(1, Math.floor(d.width ?? 512));
    const h = Math.max(1, Math.floor(d.height ?? VIEW_H));
    try {
      // Background layers are 1× buffers: their generators read 1× sprite frames.
      l.buf = withArtDensity(1, () => getBgGenerator(d.gen)(w, h, d.params ?? {}, (this.seed + i * 7919) >>> 0));
    } catch (err) {
      console.warn(`[mission] background generator "${d.gen}" failed:`, err);
      l.buf = new PixelBuffer(w, h);
    }
    return l.buf;
  }

  /**
   * The buffer of layer i at dense density d once built, else null. The first call builds it (or
   * queues it when deferred); a layer without a generator at d is null at once.
   */
  private hiLayer(i: number, dd: SceneryDensity): PixelBuffer | null {
    const l = this.layers[i];
    const have = l.hi[dd];
    if (have !== undefined) return have;
    const build = (): void => {
      if (l.hi[dd] !== undefined) return;
      const d = l.def;
      const lw = Math.max(1, Math.floor(d.width ?? 512));
      const lh = Math.max(1, Math.floor(d.height ?? VIEW_H));
      l.hi[dd] = withArtDensity(1, () => makeHiBgLayer(d.gen, lw, lh, d.params ?? {}, (this.seed + i * 7919) >>> 0, dd));
      this.hiGenerated++;
    };
    if (hiArtDeferred()) queueArtJob(`${this.jobKey}L${dd}:${i}`, build);
    else build();
    return l.hi[dd] ?? null;
  }

  private drawLayer(r: Renderer, i: number, tick: number): void {
    const buf = this.layerBuf(i);
    if (!buf) return;
    const d = this.layers[i].def;
    // At res 1 the 1× layer is the exact image (a dense layer would be drawn reduced).
    const want = SectionView.atRes(this.drawDensity(), r.res);
    const ld = want > 1 ? bgDensityFor(d.gen, want) : 1;
    let hi: PixelBuffer | null = null;
    let hd: SceneryDensity = 2;
    if (ld > 1) {
      hd = ld as SceneryDensity;
      hi = this.hiLayer(i, hd);
      // Not built yet at 4: the 2× layer when it is there (never built for this).
      if (!hi && hd === 4) {
        hd = 2;
        hi = this.layers[i].hi[2] ?? null;
      }
    }
    const o = hi ? hiLayerOpts[hd] : layerOpts;
    o.repeatX = d.repeatX ?? true;
    o.repeatY = d.repeatY ?? false;
    o.alpha = d.alpha ?? 1;
    // Drift keeps clouds moving even while the camera is locked (wrapped into the tile, logical px).
    const ox = (d.offsetX ?? 0) + (d.driftX ? (tick * d.driftX) % buf.w : 0);
    const oy = (d.offsetY ?? 0) + (d.driftY ? (tick * d.driftY) % buf.h : 0);
    r.parallax(hi ?? buf, d.factorX, d.factorY ?? 0, ox, oy, o);
  }

  // ------------------------------------------------------------------------------- terrain chunks

  private key(cx: number, cy: number): number {
    return (cy + 64) * 65536 + (cx + 64);
  }

  /** The chunk buffer (generated on first use; null when empty or outside the section). */
  chunk(cx: number, cy: number): PixelBuffer | null {
    const k = this.key(cx, cy);
    const cached = this.chunks.get(k);
    if (cached !== undefined) return cached;
    const s = this.section;
    let buf: PixelBuffer | null = null;
    if (cx >= 0 && cy >= 0 && cx * CHUNK < s.width + CHUNK && cy * CHUNK < s.height + CHUNK) {
      try {
        // Terrain chunks are 1× buffers: their painters read 1× sprite frames.
        buf = withArtDensity(1, () => getTerrainPainter()(this.sample, s.terrainStyle ?? { ground: 'dirt' }, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK));
      } catch (err) {
        console.warn('[mission] terrain painter failed:', err);
        buf = null;
      }
      if (buf && buf.countOpaque() === 0) buf = null;
      this.generated++;
    }
    this.chunks.set(k, buf);
    return buf;
  }

  /**
   * The dense frame of a chunk at density d (default: the terrain density for the view's
   * `drawDensity`; anchor top-left) once built, else null. The first call builds it (or queues it
   * when deferred); only chunks with 1× pixels get one.
   */
  hiChunk(cx: number, cy: number, density?: SceneryDensity): Frame | null {
    const dd = density ?? this.terrainDensity(this.drawDensity());
    if (dd < 2) return null;
    const d = dd as SceneryDensity;
    const style = this.section.terrainStyle ?? { ground: 'dirt' };
    if (this.terrainDensity(d) !== d) return null;
    const map = this.hiChunkMaps[d];
    const k = this.key(cx, cy);
    const cached = map.get(k);
    if (cached !== undefined) return cached;
    const build = (): void => {
      if (map.has(k)) return;
      let f: Frame | null = null;
      if (this.chunk(cx, cy)) {
        const buf = withArtDensity(1, () => makeHiTerrain(this.sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK, d));
        if (buf) f = trimmedChunk(buf, d);
      }
      map.set(k, f);
      this.hiGenerated++;
    };
    if (hiArtDeferred()) queueArtJob(`${this.jobKey}C${d}:${k}`, build);
    else build();
    return map.get(k) ?? null;
  }

  /** Dense chunks built at density d (debug / tests; null entries count too). */
  hiChunkCount(d: SceneryDensity): number {
    return this.hiChunkMaps[d].size;
  }

  /**
   * Release the dense chunks EVICT_BEHIND_CHUNKS or more chunks left of the view (and cancel
   * their queued jobs); they are rebuilt if the camera comes back.
   */
  private evictBehind(camX: number): void {
    const limit = Math.floor(camX / CHUNK) - EVICT_BEHIND_CHUNKS;
    if (limit < 0 || limit === this.evictCol) return;
    this.evictCol = limit;
    for (const d of [2, 4] as const) {
      const map = this.hiChunkMaps[d];
      if (map.size === 0) continue;
      for (const k of map.keys()) {
        if ((k % 65536) - 64 <= limit) {
          map.delete(k);
          this.evicted++;
        }
      }
    }
  }

  /** Generate a chunk or two just outside the view so scrolling never waits for one. */
  private prefetch(camX: number, camY: number, td: number): void {
    let budget = PREFETCH_PER_FRAME;
    const y0 = Math.floor(camY / CHUNK);
    const y1 = Math.floor((camY + VIEW_H - 1) / CHUNK);
    const right = Math.floor((camX + VIEW_W + CHUNK / 2) / CHUNK);
    const left = Math.floor((camX - CHUNK / 2) / CHUNK);
    for (let cy = y0 - 1; cy <= y1 + 1 && budget > 0; cy++) {
      for (let side = 0; side < 2 && budget > 0; side++) {
        const cx = side === 0 ? right : left;
        if (this.chunks.has(this.key(cx, cy))) continue;
        this.chunk(cx, cy);
        if (td > 1) this.hiChunk(cx, cy, td as SceneryDensity);
        budget--;
      }
    }
  }

  // ------------------------------------------------------------------------------- decor

  private drawDecor(r: Renderer, list: readonly DecorDef[], tick: number): void {
    const camX = r.camX;
    const camY = r.camY;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const p = d.parallax ?? 1;
      // Parallax decor: screen x = d.x − camX·p, i.e. world x = d.x + camX·(1 − p).
      const x = d.x + camX * (1 - p);
      const y = d.y + camY * (1 - p);
      if (x < camX - 256 || x > camX + VIEW_W + 256 || y < camY - 256 || y > camY + VIEW_H + 256) continue;
      let frame = d.frame ?? 0;
      if (d.animate) {
        const tpf = typeof d.animate === 'number' ? d.animate : spriteAnim(d.sprite).ticksPerFrame;
        frame += Math.floor(tick / Math.max(1, tpf));
      }
      decorOpts.flipX = d.flipX ?? false;
      decorOpts.alpha = d.alpha ?? 1;
      // Unrounded: parallax decor glides in 1/res steps (whole-pixel decor stays on the world grid).
      r.sprite(d.sprite, frame, x, y, decorOpts);
    }
  }
}
