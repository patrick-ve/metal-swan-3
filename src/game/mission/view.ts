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
 *
 * Opt-ins (off by default; a view without them draws and builds exactly as before):
 * - `evictRows` (vertical sections, e.g. the oldenzaal tower): dense chunks EVICT_ROWS_AWAY or more
 *   chunk rows above or below the view are released too, and the rows just above and below the
 *   view are prefetched (a tall section would otherwise keep every dense chunk it ever showed).
 * - `backHook(r, tick)`: called in `drawBack` after the background layers, before the pits,
 *   decor and terrain (the mission light pass draws its far fog and the backdrop flash there).
 * - `floorHook(r, tick)` (a floor only): called at the end of the floor's back half, before the
 *   contact shadows and the entities (the light pass's ground mist lies there, under the feet).
 * - THE PERSPECTIVE FLOOR (`SectionDef.floor`, docs/design/floor.md §3.4, docs/api/floor.md): the
 *   view builds a `SectionFloor` and draws in the floor's order — the non-sky layers lifted by the
 *   floor's depth behind the feet, `backHook`, the floor band, its openings, back decor and back
 *   rows at their depths far → near, canopies / slabs / top faces, walk-plane decor, then the
 *   terrain chunks with EMPTY ground cells (only platforms and solids; no pit shafts: the floor's
 *   pits and cuts are in its mesh); `drawShadows` (contact shadows, the runner calls it before
 *   world.draw); `drawFront`: front decor and front rows far → near, the front layers. Without a
 *   floor none of this runs: every call below draws exactly as before.
 * - THE CANAL SCENE (`SectionDef.canal`, mission `ams`, docs/api/canal.md, ./canal/): while the scene
 *   draws (`canalActive`: the opt-in, the switch on, a source; not failed), `drawBack` draws the
 *   stack's non-`over` layers in place of the background layers, the floor's band / openings / back
 *   decor and rows / canopies and tops, the decor and the terrain (none of them is built: `prepare`
 *   loads only the scene and the floor's entity face tiles), then `backHook` and `floorHook`;
 *   `drawShadows` is unchanged (contact shadows, entity faces); `drawFront` draws the floor's front
 *   entity faces and the `over` layers. A scene that fails to load falls back to all of the above
 *   (built lazily). Without the opt-in none of this runs.
 * - THE PAINTED FLOOR (`SectionDef.paintedFloor`, mission `ams2`, docs/design/ams2-contract.md): the
 *   section's decor draws the ground, so the terrain chunks have no ground cells (`'all'`: no cells at
 *   all) and there are no pit shafts. Without it none of this runs.
 * - THE FAÇADE STRIPS (`SectionDef.strips`, mission `oat`; docs/design/oat.md §8.6, ./strips/): the
 *   view makes the section's strip store on first use (the section start in the browser, else the
 *   first frame drawn: the sims never make one) and draws its chunks 1:1 at the façade depth with that
 *   plane's line-scroll speed s (the floor's s at `strips.depth`; strip x p shows where world x
 *   192 + (p − 192) / s at that depth shows), on the floor there (the row's `liftAt`): after the floor
 *   band and its openings, before the back decor and rows (with a floor), or after the layers and
 *   `backHook` (without one). In the 03:00 cross-fade (`darkMix`, set by the light pass through
 *   `setStripDarkMix`) the dark bake is drawn over the lit one. Without `strips` nothing of this runs.
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
  type TerrainCell,
  type TerrainSampler,
} from '../art/art-registry';
import type { World } from '../../engine/world';
import type { Entity } from '../../engine/entity';
import type { CanalDef } from './canal/types';
import type { FloorGpu } from '../../engine/floor/gpu';
import { canalActive } from './canal/registry';
import { CanalView } from './canal/view';
import { floorOf, floorOverlay } from './floor/registry';
import { FramePlacer } from './floor/place';
import { SectionFloor } from './floor/section-floor';
import { bindLiveStripStore, unbindLiveStripStore } from './strips/live';
import { stripBaseY, stripScale, TickSpeed } from './strips/space';
import { createStripStore, type StripStore } from './strips/store';
import { STRIP_CHUNK, type StripDensity } from './strips/types';
import type { DecorDef, SectionDef } from './types';

/** Terrain chunk size (px). */
export const CHUNK = 256;
/** Extra chunks generated per frame ahead of the view (keeps scrolling smooth). */
const PREFETCH_PER_FRAME = 1;
/** Dense chunks this many chunks (or more) left of the view are released. */
export const EVICT_BEHIND_CHUNKS = 2;
/** With `evictRows`: dense chunks this many chunk rows (or more) above or below the view are released. */
export const EVICT_ROWS_AWAY = 2;

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
/**
 * The density the last façade strips drew at (any section; 0 before the first): a section start
 * queues its strips at no more than this (a res that cannot show 4× draws 2×), as the floor does.
 */
let lastStripDensity = 0;

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
  /**
   * OPT-IN (vertical sections): also release dense chunks far above / below the view and prefetch
   * the rows next to it. Off by default.
   */
  evictRows = false;
  /** The chunk row of the last row-eviction pass. */
  private evictRow = -1e9;
  /** OPT-IN: drawn after the background layers, before the terrain (null = nothing; default). */
  backHook: ((r: Renderer, tick: number) => void) | null = null;
  /**
   * OPT-IN, a section with a floor only: drawn at the end of the floor's back half (after the
   * walk-plane decor and the terrain), before the contact shadows and the entities — the light
   * pass lays its ground mist there, under the feet (null = nothing; default).
   */
  floorHook: ((r: Renderer, tick: number) => void) | null = null;
  /** The perspective floor (`SectionDef.floor`; null without one: the view draws as before). */
  readonly floor: SectionFloor | null;
  /** The GPU floor renderer (the runner sets it; null = the CPU raster draws the floor). */
  floorGpu: FloorGpu | null = null;
  /** The façade strips' store (`SectionDef.strips`): undefined = not made yet, null = none. */
  private stripStore: StripStore | null | undefined = undefined;
  /** The strip's top at lift 0 (world y: the façade base minus the strip height) and each chunk's lift (by chunk − c0). */
  private stripTop = 0;
  private stripLift = new Float64Array(0);
  /** The camera's speed per tick for the strips' prefetch (not per drawn frame: a 120 Hz display). */
  private readonly stripSpeed = new TickSpeed();
  private readonly stripPlacer = new FramePlacer();
  private readonly stripOpts: DrawOpts = { alpha: 1 };
  /** The canal scene (`SectionDef.canal`; null without one, with the switch off or without a source). */
  readonly canal: CanalView | null;

  constructor(section: SectionDef, terrain: Terrain, seed: number, density = 1) {
    this.section = section;
    this.seed = seed;
    this.density = density >= 4 ? 4 : density >= HI_SCENERY_DENSITY ? 2 : 1;
    this.layers = (section.background?.layers ?? []).map((def) => ({ def, buf: null, hi: { 2: undefined, 4: undefined } }));
    this.jobKey = `scenery/${++viewSerial}/`;
    this.floor = makeFloor(section, terrain, seed, this.jobKey);
    this.canal = section.canal && canalActive(section) ? CanalView.make(section.canal) : null;
    // The scene's render-only depth rules (a gull on a kit lamp), only while the scene draws.
    const rules = this.canal ? section.canal?.depth : undefined;
    if (rules && this.floor) {
      for (const [kind, fn] of Object.entries(rules)) this.floor.wrapEntityDepth(kind, (own) => (e) => (this.canalLive ? fn(e) : own ? own(e) : 0));
    }
    // The kinds whose floor faces the scene paints itself (`CanalDef.hideFaces`), only while the scene draws.
    const hide = this.canal ? section.canal?.hideFaces : undefined;
    if (hide && this.floor) {
      const rules: [string, true | ((e: Entity) => boolean)][] = isKindList(hide) ? hide.map((k) => [k, true]) : Object.entries(hide);
      for (const [kind, rule] of rules) this.floor.hideEntityFaces(kind, (e) => this.canalLive !== null && (rule === true || rule(e)));
    }
    // Without a floor (none, `--floor-off`, a failed build) the floor-only decor stays out.
    const all = section.decor ?? [];
    const decor = this.floor ? all : all.filter((d) => !d.floorOnly);
    this.back = decor.filter((d) => !d.front);
    this.front = decor.filter((d) => d.front);
    // With a floor the ground cells are empty (the floor draws the ground); platforms and solids stay.
    this.sample =
      section.paintedFloor === 'all' ? () => 0 : this.floor || section.paintedFloor ? (x, y) => groundless(terrain.cellAt(x, y)) : (x, y) => terrain.cellAt(x, y);
    this.pits = this.floor || section.paintedFloor ? [] : pitSpans(terrain);
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
    // The canal scene: the scene's packs at the view's density and the floor's entity face tiles only.
    const canal = this.canalLive;
    if (canal) {
      canal.prepare(camX, this.drawDensity());
      if (this.floor) {
        this.floor.gpu = this.floorGpu;
        this.floor.prepareEntities(this.hiOn && hiArtDeferred() ? this.drawDensity() : 1);
      }
      return;
    }
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
    // The floor: its visible 1× chunks now, its dense ones queued (the browser), spec §2.6.
    if (this.floor) {
      this.floor.gpu = this.floorGpu;
      this.floor.prepare(camX, want);
    }
    // The façade strips (the browser only: tools and the sims build them when first drawn): the
    // chunks on screen at 1× now, the dense ones queued (the preload runs them).
    if (this.section.strips && hiArtDeferred()) {
      const st = this.strips;
      const sd = lastStripDensity > 0 && lastStripDensity < want ? lastStripDensity : want;
      if (st) st.prepare(camX, 0, (sd >= 4 ? 4 : sd >= 2 ? 2 : 1) as StripDensity);
    }
  }

  /**
   * The façade strips' store of this section (`SectionDef.strips`; made on first use: it plans the
   * section through its source), or null without strips.
   */
  get strips(): StripStore | null {
    if (this.stripStore !== undefined) return this.stripStore;
    const def = this.section.strips;
    if (!def) {
      this.stripStore = null;
      return null;
    }
    const cam = this.floor ? this.floor.cam : null;
    const scale = stripScale(cam, def.depth);
    const st = createStripStore(def, { id: this.section.id, width: this.section.width, seed: this.seed, scale }, { jobKey: `${this.jobKey}S/` });
    this.stripStore = st;
    this.stripTop = stripBaseY(cam, def.depth) - st.height;
    // Each chunk stands on the floor at the façade depth: the lift of the row it overlaps most (a row
    // keeps one lift, so no chunk border steps inside a house).
    const floor = this.floor;
    const n = Math.max(0, st.c1 - st.c0 + 1);
    this.stripLift = new Float64Array(n);
    if (floor && n > 0) {
      const rowLift = def.rows.map((row) => floor.liftAt(Math.max(0, Math.min(this.section.width, (row.u0 + row.u1) / 2)), def.depth));
      for (let i = 0; i < n; i++) {
        const cx = st.c0 + i;
        const a = 192 + (cx * STRIP_CHUNK - 192) / scale;
        const b = 192 + ((cx + 1) * STRIP_CHUNK - 192) / scale;
        let best = 0;
        let lift = 0;
        def.rows.forEach((row, k) => {
          const o = Math.min(b, row.u1) - Math.max(a, row.u0);
          if (o > best) {
            best = o;
            lift = rowLift[k];
          }
        });
        this.stripLift[i] = Number.isFinite(lift) ? lift : 0;
      }
    }
    bindLiveStripStore(this.section.id, st);
    return st;
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

  /** The canal scene while it draws (not failed), else null. */
  get canalLive(): CanalView | null {
    const c = this.canal;
    return c !== null && !c.failed ? c : null;
  }

  /** Drop this view's queued 2× jobs (the runner replaces the view). */
  dispose(): void {
    cancelArtJobs(this.jobKey);
    this.canal?.dispose();
    this.floor?.dispose();
    const st = this.stripStore;
    if (st) {
      st.dispose();
      unbindLiveStripStore(this.section.id, st);
    }
  }

  /** Draw dense scenery at all? (density ≥ 2 and dense art not switched off by `setHiArt(false)`). */
  private get hiOn(): boolean {
    return this.density > 1 && hiArtOn();
  }

  /** Background layers, the dark behind pits, terrain and back decor. */
  drawBack(r: Renderer, tick: number): void {
    const canal = this.canalLive;
    if (canal) {
      this.drawBackCanal(r, tick, canal);
      return;
    }
    if (this.floor) {
      this.drawBackFloor(r, tick, this.floor);
      return;
    }
    for (let i = 0; i < this.layers.length; i++) {
      if (!this.layers[i].def.front) this.drawLayer(r, i, tick);
    }
    if (this.backHook) this.backHook(r, tick);
    if (this.section.strips) this.drawStrips(r, SectionView.atRes(this.drawDensity(), r.res), tick);
    this.drawPits(r);
    this.drawDecor(r, this.back, tick);
    this.drawTerrain(r);
  }

  /**
   * The façade strips (`SectionDef.strips`): the store's frame (prefetch, eviction, jobs queued), then
   * the chunks on screen drawn 1:1 at the plane's speed s — strip x p at the renderer's world x
   * p + camX · (1 − s) — the lit bake, and over it the dark one at `darkMix` (spec §8.9). No allocation.
   */
  private drawStrips(r: Renderer, dd: number, tick: number): void {
    const st = this.stripStore === undefined ? this.strips : this.stripStore;
    if (!st || !st.plan) return;
    const camX = r.camX;
    const step = this.stripSpeed.step(camX, tick);
    const d: StripDensity = dd >= 4 ? 4 : dd >= 2 ? 2 : 1;
    lastStripDensity = d;
    st.prepare(camX, step, d);
    const s = st.scale;
    const p0 = camX * s;
    const c0 = Math.max(st.c0, Math.floor(p0 / STRIP_CHUNK));
    const c1 = Math.min(st.c1, Math.floor((p0 + VIEW_W) / STRIP_CHUNK));
    const mix = st.darkMix;
    const pl = this.stripPlacer;
    const o = this.stripOpts;
    for (let cx = c0; cx <= c1; cx++) {
      const dark = mix > 0 && st.hasDark(cx) ? st.frameOf(cx, d, 'dark') : null;
      const lit = dark === null || mix < 1 ? st.frameOf(cx, d, 'lit') : null;
      if (lit === null && dark === null) continue;
      pl.x = cx * STRIP_CHUNK + camX * (1 - s);
      pl.y = this.stripTop - this.stripLift[cx - st.c0];
      if (lit !== null) {
        o.alpha = 1;
        pl.put(r, lit, o);
      }
      if (dark !== null) {
        o.alpha = lit !== null ? mix : 1;
        pl.put(r, dark, o);
      }
    }
  }

  /** The terrain chunks (with their prefetch, eviction and the per-frame dense jobs). */
  private drawTerrain(r: Renderer): void {
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
    if (this.evictRows) {
      this.prefetchRows(camX, camY, td);
      if (td > 1) this.evictAwayRows(camY);
    }
    // Without a running preload, this view runs its own queued dense jobs within the frame budget.
    if (this.density > 1 && hiArtDeferred() && !artPreloadActive()) runArtJobs(HI_ART_FRAME_BUDGET_MS);
  }

  /**
   * The canal scene's back pass: the stack's non-`over` layers, `backHook`, the floor's frame (its
   * entity faces' density and tiles), the art jobs, `floorHook`.
   */
  private drawBackCanal(r: Renderer, tick: number, canal: CanalView): void {
    const dd = SectionView.atRes(this.drawDensity(), r.res);
    canal.draw(r, tick, false, dd);
    if (this.backHook) this.backHook(r, tick);
    if (this.floor) {
      this.floor.gpu = this.floorGpu;
      this.floor.canalFrame(dd);
    }
    // Without a running preload, this view runs its own queued dense jobs within the frame budget.
    if (this.density > 1 && hiArtDeferred() && !artPreloadActive()) runArtJobs(HI_ART_FRAME_BUDGET_MS);
    if (this.floor && this.floorHook) this.floorHook(r, tick);
  }

  /** Front decor and foreground layers. */
  drawFront(r: Renderer, tick: number): void {
    const canal = this.canalLive;
    if (canal) {
      this.floor?.drawFrontEntities(r);
      canal.draw(r, tick, true, SectionView.atRes(this.drawDensity(), r.res));
      if (this.floor && floorOverlay()) this.floor.drawOverlay(r);
      return;
    }
    const floor = this.floor;
    if (floor) floor.drawFront(r, tick, SectionView.atRes(this.drawDensity(), r.res));
    else this.drawDecor(r, this.front, tick);
    for (let i = 0; i < this.layers.length; i++) {
      if (this.layers[i].def.front) this.drawLayer(r, i, tick);
    }
    if (floor && floorOverlay()) floor.drawOverlay(r);
  }

  /**
   * The floor's back half (docs/design/floor.md §3.4 steps 1–5): lifted layers, backHook, the band,
   * the openings, back decor / rows far → near, canopies and top faces, walk-plane decor, terrain.
   */
  private drawBackFloor(r: Renderer, tick: number, floor: SectionFloor): void {
    for (let i = 0; i < this.layers.length; i++) {
      const def = this.layers[i].def;
      if (!def.front) this.drawLayer(r, i, tick, floor.layerLift(def));
    }
    if (this.backHook) this.backHook(r, tick);
    const dd = SectionView.atRes(this.drawDensity(), r.res);
    floor.gpu = this.floorGpu;
    floor.drawBand(r, tick, dd);
    floor.drawOpenings(r, dd);
    if (this.section.strips) this.drawStrips(r, dd, tick);
    floor.drawBack(r, tick, dd);
    this.drawTerrain(r);
    floor.maintain(r.camX, dd);
    if (this.floorHook) this.floorHook(r, tick);
  }

  /** Contact shadows on the floor (a floor only; the runner calls it between drawBack and world.draw). */
  drawShadows(r: Renderer, world: World): void {
    // The canal scene's layer rules (`CanalDef.show`) read this world from the next frame on.
    if (this.canal) this.canal.world = world;
    if (this.floor) this.floor.drawShadows(r, world, SectionView.atRes(this.drawDensity(), r.res));
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

  /** Draw layer i (`lift`: px up, the floor's lift of a non-sky layer; 0 = as defined). */
  private drawLayer(r: Renderer, i: number, tick: number, lift = 0): void {
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
    const oy = (d.offsetY ?? 0) - lift + (d.driftY ? (tick * d.driftY) % buf.h : 0);
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

  /**
   * `evictRows`: release the dense chunks EVICT_ROWS_AWAY or more chunk rows above or below the
   * rows the view shows (and cancel their queued jobs); rebuilt if the camera comes back.
   */
  private evictAwayRows(camY: number): void {
    const top = Math.floor(camY / CHUNK);
    if (top === this.evictRow) return;
    this.evictRow = top;
    const bottom = Math.floor((camY + VIEW_H - 1) / CHUNK);
    const lo = top - EVICT_ROWS_AWAY;
    const hi = bottom + EVICT_ROWS_AWAY;
    for (const d of [2, 4] as const) {
      const map = this.hiChunkMaps[d];
      if (map.size === 0) continue;
      for (const k of map.keys()) {
        const cy = Math.floor(k / 65536) - 64;
        if (cy <= lo || cy >= hi) {
          map.delete(k);
          cancelArtJobs(`${this.jobKey}C${d}:${k}`);
          this.evicted++;
        }
      }
    }
  }

  /** `evictRows`: generate one chunk of the row just above or below the view (vertical scrolling). */
  private prefetchRows(camX: number, camY: number, td: number): void {
    const x0 = Math.floor(camX / CHUNK);
    const x1 = Math.floor((camX + VIEW_W - 1) / CHUNK);
    const rows = [Math.floor(camY / CHUNK) - 1, Math.floor((camY + VIEW_H - 1) / CHUNK) + 1];
    for (const cy of rows) {
      if (cy < 0 || cy * CHUNK >= this.section.height) continue;
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        if (!this.chunks.has(k)) {
          this.chunk(cx, cy);
          if (td > 1) this.hiChunk(cx, cy, td as SceneryDensity);
          return;
        }
        if (td < 2) continue;
        const map = this.hiChunkMaps[td as SceneryDensity];
        if (map.has(k)) continue;
        // Queued when deferred (cheap, run by the art jobs); built now otherwise (one per frame).
        this.hiChunk(cx, cy, td as SceneryDensity);
        if (map.has(k)) return;
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
      let x = d.x + camX * (1 - p);
      const y = d.y + camY * (1 - p);
      // OPT-IN: a far mover (`moveX`, mission ams2); every other decor has none.
      if (d.moveX !== undefined) {
        const span = d.moveSpan ?? 1024;
        x += (((d.moveFrom ?? 0) + tick * d.moveX) % span + span) % span;
      }
      if (x < camX - 256 || x > camX + VIEW_W + 256 || y < camY - 256 || y > camY + VIEW_H + 256) continue;
      let frame = d.frame ?? 0;
      if (d.animate) {
        const tpf = typeof d.animate === 'number' ? d.animate : spriteAnim(d.sprite).ticksPerFrame;
        frame += Math.floor((tick + (d.animPhase ?? 0)) / Math.max(1, tpf)) * (d.animStep ?? 1);
      }
      decorOpts.flipX = d.flipX ?? false;
      decorOpts.alpha = d.alpha ?? 1;
      // Unrounded: parallax decor glides in 1/res steps (whole-pixel decor stays on the world grid).
      r.sprite(d.sprite, frame, x, y, decorOpts);
    }
  }
}

/** The floor of a section (null: none, or its def failed to build: warned, the section draws flat). */
/** `CanalDef.hideFaces` as a plain list of kinds (always hidden)? */
function isKindList(h: NonNullable<CanalDef['hideFaces']>): h is readonly string[] {
  return Array.isArray(h);
}

function makeFloor(section: SectionDef, terrain: Terrain, seed: number, jobKey: string): SectionFloor | null {
  const def = floorOf(section);
  if (!def) return null;
  try {
    return new SectionFloor(section, def, terrain, seed, jobKey);
  } catch (err) {
    console.warn(`[floor] section ${section.id}: the floor failed, drawing without it:`, err);
    return null;
  }
}

/** A terrain cell with the ground taken out (the floor draws the ground). */
function groundless(c: TerrainCell): TerrainCell {
  return c === 1 ? 0 : c;
}
