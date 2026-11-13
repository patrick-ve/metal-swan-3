/**
 * THE STRIPS CONTRACT (docs/design/oat.md (deleted; git show eb3316a) §8.6 "The strips"; no mission uses
 * it since 2026-11-12, it stays as a generic piece). The store (store.ts) draws it in the section
 * view (view.ts); a strip source paints the rows. Types only.
 *
 * The idea: a section's façade rows are not decor sprites but STREAMED STRIPS. The strip source
 * lays out every row once at section load (the lot sequence of the façade grammar, seeded per
 * stretch: no house repeats) and then paints any 256-px chunk of it on demand, at any density, in
 * either light set. The store asks for the chunks around the view (prefetch ahead by the scroll
 * speed, evict behind), slices each paint into bands (no art job over 16 ms, ≤ 8 ms of jobs per
 * frame), keeps about five resident (≈ 18 MB at 4×, flat for any section length) and accounts for
 * their bytes; the view draws the chunks at the façade depth with that row's line-scroll speed.
 * Shadows, night light, wear and wetness are baked in WORLD space at paint time, so they cross
 * house borders.
 *
 * Determinism: art only. The sims never read `SectionDef.strips`; a source paints from its seed and
 * the section's sun (mission/light/api.ts `sectionSun`), never from an rng, a clock or the DOM.
 *
 * THE STRIP SPACE (STRIPS, wave A): a strip is drawn 1:1 — one strip px is one logical px on screen,
 * one art px at density d is one buffer px — so it stays crisp and palette-exact at every res (a
 * resampled façade would shimmer and leave the palette). It scrolls with the façade plane's
 * line-scroll speed `s` (`StripSectionInfo.scale`: the floor's s at `SectionStripsDef.depth`, e.g.
 * 0.862; 1 without a floor). So its columns are NOT world x: strip x p and world x u (the floor's u,
 * the decor's x, the lots' u) are tied by p = 192 + (u − 192) · s (space.ts `stripXOfU`, inverse
 * `uOfStripX`; 192 = FLOOR_CX): a feature painted at p shows exactly where a decor item at depth
 * `depth` and world x u shows (floor/cam.ts `shiftX`). Chunk cx holds strip x [cx · 256, cx · 256 +
 * 256), i.e. world x [uOfStripX(cx · 256), uOfStripX(cx · 256 + 256)) — about 297 world px at s 0.862.
 * Heights are strip px too: the façade's world px (spec §8.2: doors 44–48, the ground band at 20 px/m)
 * times s on the façade plane (a 173 px house is 149 strip px: its gable tip at y 11 over the base at
 * y 160). Row bounds (`StripRowDef.u0`/`u1`), `dark` and `darkFrom` stay in WORLD x.
 */
import type { PixelBuffer } from '../../../engine/pixel';

/** The densities a strip chunk is painted at (1 = the snapped 1× version, `Pen` rule). */
export type StripDensity = 1 | 2 | 4;

/** The light sets of a strip chunk (a night arena can have a lit and a dark bake). */
export type StripLightSet = 'lit' | 'dark';

/** Chunk width in logical px (spec §8.6: 256; 1,024 art px at 4×). */
export const STRIP_CHUNK = 256;
/** The tallest strip, logical px (the view's height). */
export const STRIP_MAX_H = 216;
/** No single paint job may take longer than this (ms; the store slices chunks into bands). */
export const STRIP_JOB_MS = 16;
/** At most this many ms of strip jobs run per frame (the rest wait; the lower density draws meanwhile). */
export const STRIP_FRAME_MS = 8;
/** Chunks prefetched ahead of the view (spec §8.6: one; two in auto-scroll sections). */
export const STRIP_PREFETCH = 1;
/**
 * Eviction behind the view (spec §8.6 "evict two behind", the terrain's EVICT_BEHIND_CHUNKS rule): a
 * chunk STRIP_KEEP_BEHIND or more chunks behind the chunk at the view's trailing edge is released, so
 * one chunk behind stays (a shake, a short step back). About 5 resident with one ahead.
 */
export const STRIP_KEEP_BEHIND = 2;
/**
 * Prefetch by scroll speed: the store keeps at least this many ticks of travel ahead of the view
 * queued (ahead = max(prefetch, ceil(|speed| · s · STRIP_LEAD_TICKS / STRIP_CHUNK)); 4 s: one chunk
 * at the c1 auto-scroll of 1.2 px/tick, three at the taxi's 3 px/tick).
 */
export const STRIP_LEAD_TICKS = 240;
/**
 * The memory accounting (inside the mission's dense reserve, `MissionDef.denseReserve`): every byte of
 * the lit set (resident chunks of every density, the stand-ins and the chunks being painted) stays
 * under STRIP_BUDGET_BYTES (18 MB: five 216-px chunks at 4×); the dark set (the 03:00 bake) under
 * STRIP_DARK_BUDGET_BYTES (11 MB: three). Near the cap the store releases what is furthest from the
 * view (behind first, then the far prefetch); a chunk on screen is always built.
 */
export const STRIP_BUDGET_BYTES = 18 * 1024 * 1024;
export const STRIP_DARK_BUDGET_BYTES = 11 * 1024 * 1024;

/** One façade row of a section: a stretch of street in world x with its street style sheet. */
export interface StripRowDef {
  /** World x range the row covers, [u0, u1) (no chunk is painted outside it). */
  u0: number;
  u1: number;
  /**
   * The source's street style sheet (GRAMMAR's ids: '9-straatjes', 'canal-front', 'grimburgwal',
   * 'oudezijds', 'trompettersteeg', 'oudekerksplein'; spec §8.6 table).
   */
  sheet: string;
  /** Seed of the lot sequencer for this stretch (default: a hash of the section id and u0). */
  seed?: number;
  /** Source parameters (opaque to the store: the source reads them). */
  params?: Readonly<Record<string, unknown>>;
}

/** `SectionDef.strips` (opt-in): the façade strips of a section. */
export interface SectionStripsDef {
  /** The registered strip source (`defineStripSource`). */
  source: string;
  /**
   * The façade plane's depth: floor depth px behind the walk line on flat ground (e.g. 16: the
   * façade base at screen y 160). The view draws the strips at this depth and scrolls
   * them with its line-scroll speed (the floor's `s(y)` there; spec §8.2: s = 0.862 at y 160).
   */
  depth: number;
  /** Strip height in logical px, from the façade base up (≤ STRIP_MAX_H). */
  height: number;
  /** The rows (stretches of street), in world x order, not overlapping. */
  rows: readonly StripRowDef[];
  /** Chunks prefetched ahead (default STRIP_PREFETCH; 2 for auto-scroll sections). */
  prefetch?: number;
  /** Chunks kept behind before eviction (default STRIP_KEEP_BEHIND). */
  keepBehind?: number;
  /**
   * A second light set for this world x range (the 03:00 switch, spec §8.9): its chunks also exist
   * as a 'dark' bake, prefetched from `darkFrom` (default the range's start minus two chunks).
   */
  dark?: readonly [number, number];
  /**
   * World x from which the dark set is prefetched: once the view's centre passes it (e.g. a
   * checkpoint before the arena), the dark chunks of the range are queued after the lit ones.
   */
  darkFrom?: number;
}

/** What a source knows of the section when it plans (no runner, no world: pure). */
export interface StripSectionInfo {
  readonly id: string;
  readonly width: number;
  /** The section's art seed (the view's seed: the same section paints the same strips every run). */
  readonly seed: number;
  /**
   * The façade plane's line-scroll speed s (the floor's s at `SectionStripsDef.depth`; e.g. 0.862):
   * strip px = world px × s (see "THE STRIP SPACE" above; space.ts `stripXOfU`). Absent = 1 (no
   * floor: strip x = world x).
   */
  readonly scale?: number;
}

/**
 * A planned section (the source's lot sequence of every row): the store asks it for chunks. Every
 * method is pure and deterministic: the same arguments paint the same pixels.
 */
export interface StripPlan {
  /** Strip height in logical px (≤ the def's). */
  readonly height: number;
  /** Does chunk `cx` (STRIP x from cx · STRIP_CHUNK: see the strip space) have any pixels? false = the store skips it. */
  covers(cx: number): boolean;
  /**
   * Into how many horizontal bands the store may slice one paint of chunk `cx` at density d (≥ 1;
   * the source's estimate so each band stays under STRIP_JOB_MS).
   */
  bands(cx: number, d: StripDensity): number;
  /**
   * Paint band `band` (0 … bands − 1, top to bottom) of chunk `cx` at density d in light set `set`
   * into `out`: (STRIP_CHUNK · d) × (height · d) art px, cleared by the store before band 0. Paints
   * only that band's art rows (band b of n: rows [floor(b · H / n), floor((b + 1) · H / n)) of the H =
   * height · d art rows: space.ts `stripBandRows`). Buffer column c is strip x cx · STRIP_CHUNK + c / d;
   * the bottom row is the façade base. The 'dark' set is asked only for chunks inside
   * `SectionStripsDef.dark`. Called with the art density 1 set (`withArtDensity`, as every scenery job).
   */
  paint(cx: number, d: StripDensity, set: StripLightSet, band: number, out: PixelBuffer): void;
  /** OPTIONAL: the lot boundaries in world x (debug overlays, the no-repeat tests). */
  lots?(): readonly { readonly u0: number; readonly u1: number; readonly kind: string }[];
}

/** A strip source (the façade grammar): plans a section's rows once per section load. */
export interface StripSource {
  plan(def: SectionStripsDef, section: StripSectionInfo): StripPlan;
}

/** What the section view asks the store (STRIPS implements it; store.ts has the stub). */
export interface StripStoreApi {
  /** The plan (null: unknown source or a source that failed: the section draws no strips). */
  readonly plan: StripPlan | null;
  /**
   * Once per drawn frame before drawing: the view's left world x, its scroll speed (world px per tick,
   * signed) and the density it draws at (`d`; default the last one given — none yet: nothing is
   * built): build the 1× of a chunk on screen that has nothing ready, queue the chunks on screen and
   * ahead at d (or build them at once when dense art is not deferred: node tools and tests), evict the
   * ones behind, keep the budgets. The queued jobs run in the shared art job budget (`runArtJobs`,
   * HI_ART_FRAME_BUDGET_MS = STRIP_FRAME_MS per frame: the view runs it once per frame).
   */
  prepare(viewX: number, speed: number, d?: StripDensity): void;
  /**
   * The best ready chunk image for chunk `cx` at density ≤ d in light set `set` (the lower density
   * while the asked one is not built), or null (nothing ready: draw nothing there).
   */
  chunk(cx: number, d: StripDensity, set?: StripLightSet): PixelBuffer | null;
  /** The share of the dark set in the cross-fade, 0 (lit) … 1 (dark); set by the light pass. */
  darkMix: number;
  /** Bytes held by the resident chunks (the memory accounting: spec §8.12). */
  readonly bytes: number;
  /** Release every chunk and cancel the queued jobs (the section ends). */
  dispose(): void;
}
