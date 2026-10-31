/**
 * THE STRIPS CONTRACT (mission `oat`, docs/design/oat.md §8.6 "The strips", lever L7; docs/api/
 * oat.md "Strips"). CORE wrote it (wave A); STRIPS implements the store (store.ts) and draws it in
 * the section view (view.ts); GRAMMAR implements a strip source (missions/oat/facade/). Types only.
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
 */
import type { PixelBuffer } from '../../../engine/pixel';

/** The densities a strip chunk is painted at (1 = the snapped 1× version, `Pen` rule). */
export type StripDensity = 1 | 2 | 4;

/** The light sets of a strip chunk (spec §8.9: the arena of oat-d has a lit and a dark bake). */
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
/** Chunks kept behind the view before they are evicted (spec §8.6: two). */
export const STRIP_KEEP_BEHIND = 2;

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
  /** The registered strip source (`defineStripSource`; oat: ids.ts `OAT_STRIP_SOURCE`). */
  source: string;
  /**
   * The façade plane's depth: floor depth px behind the walk line on flat ground (oat-a 16: the
   * façade base at screen y 160; spec §2.1). The view draws the strips at this depth and scrolls
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
  /** World x from which the dark set is prefetched (oat-d: the checkpoint at 3,500). */
  darkFrom?: number;
}

/** What a source knows of the section when it plans (no runner, no world: pure). */
export interface StripSectionInfo {
  readonly id: string;
  readonly width: number;
  /** The section's art seed (the view's seed: the same section paints the same strips every run). */
  readonly seed: number;
}

/**
 * A planned section (the source's lot sequence of every row): the store asks it for chunks. Every
 * method is pure and deterministic: the same arguments paint the same pixels.
 */
export interface StripPlan {
  /** Strip height in logical px (≤ the def's). */
  readonly height: number;
  /** Does chunk `cx` (world x from cx · STRIP_CHUNK) have any pixels? false = the store skips it. */
  covers(cx: number): boolean;
  /**
   * Into how many horizontal bands the store may slice one paint of chunk `cx` at density d (≥ 1;
   * the source's estimate so each band stays under STRIP_JOB_MS).
   */
  bands(cx: number, d: StripDensity): number;
  /**
   * Paint band `band` (0 … bands − 1, top to bottom) of chunk `cx` at density d in light set `set`
   * into `out`: (STRIP_CHUNK · d) × (height · d) art px, cleared by the store before band 0. Paints
   * only that band's art rows. The 'dark' set is asked only for chunks inside `SectionStripsDef.dark`.
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
   * Once per drawn frame before drawing: the view's left world x and its scroll speed (px per tick,
   * signed): queue the chunks ahead, evict the ones behind, run at most STRIP_FRAME_MS of jobs.
   */
  prepare(viewX: number, speed: number): void;
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
