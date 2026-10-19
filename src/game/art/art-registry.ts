/**
 * Art-side registries shared by mission, background and terrain code
 * (docs/ARCHITECTURE.md §6.2). Pre-written by the orchestrator as a contract so the art agent and
 * the gameplay agents can work in parallel. Extend freely; do not break existing members.
 *
 * - Backgrounds are lists of parallax layers made by NAMED generators (defineBgGenerator).
 * - Terrain is painted per chunk by ONE terrain painter (setTerrainPainter) that reads a
 *   per-pixel sampler, so it does not depend on the terrain data structures.
 * Missing generators / painter fall back to simple flat art (never crash).
 *
 * Dense scenery (docs/ARCHITECTURE.md §3, docs/ART_GUIDE.md "2x art (mission ams)", "UHD art"):
 * a background generator may have versions at density d ∈ {2, 4}
 * (`defineBgGenerator(id, gen, { hi, hi4 })`, `defineHiBgGenerator(id, gen, d)`, or one
 * density-generic `defineHdBgGenerator(id, (w, h, params, seed, d) => …)`), and the terrain may
 * have painters per density (`setHiTerrainPainter(paint, supports, d)` / `setHdTerrainPainter`).
 * They get the same LOGICAL arguments as the 1× ones and return a buffer d times as wide and
 * high; a mission with `artDensity` ≥ 2 draws them (SectionView) at min(artDensity, art tier),
 * falling back to the highest lower density that has art (4 → 2 → 1); every other mission never
 * calls them. A dense result of the wrong size, or a throwing generator, falls back to lower art
 * with a warning (`hiSceneryErrors()`, ids labelled '@<d>x'), like dense sprites.
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';

/** 0 = empty, 1 = ground (below a ground polyline), 2 = one-way platform band, 3 = solid block. */
export type TerrainCell = 0 | 1 | 2 | 3;
export type TerrainSampler = (x: number, y: number) => TerrainCell;

/** How a section's terrain is painted. Material ids are resolved by the terrain painter. */
export interface TerrainStyleDef {
  /** Fill below ground lines: 'dirt' | 'sand' | 'rock' | 'snow' | 'ice' | 'mud' | 'metal' | 'concrete' … */
  ground: string;
  /** Surface band on top of ground: 'grass' | 'snow' | 'sand' | 'moss' | 'rust' | 'tiles' … */
  edge?: string;
  /** One-way platforms: 'wood' | 'metal' | 'rock' | 'ice' … */
  platform?: string;
  /** Solid blocks: 'metal' | 'concrete' | 'crate' | 'rock' | 'brick' … */
  solid?: string;
  seed?: number;
}

export type TerrainPainter = (
  sample: TerrainSampler,
  style: TerrainStyleDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
) => PixelBuffer;

/** One parallax background layer produced by a named generator. List far layers first. */
export interface BgLayerDef {
  /** Generator id, e.g. 'sky-gradient', 'clouds', 'mountains', 'hills', 'treeline'. */
  gen: string;
  params?: Record<string, unknown>;
  /** Buffer size; defaults: width 512, height = view height (216). */
  width?: number;
  height?: number;
  /** Parallax factor: 0 = fixed to the screen, 1 = moves with the world. */
  factorX: number;
  factorY?: number;
  offsetX?: number;
  offsetY?: number;
  /** Tile horizontally (default true) / vertically (default false; tall vertical sections). */
  repeatX?: boolean;
  repeatY?: boolean;
  /** Layer opacity 0..1 (default 1; m5-a front clouds 0.7). */
  alpha?: number;
  /**
   * Drift in px per tick, added on top of the parallax (clouds that keep moving while the
   * camera is locked). Default 0.
   */
  driftX?: number;
  driftY?: number;
  /** Draw in front of entities (foreground layer). */
  front?: boolean;
}

export interface BackgroundDef {
  /** Clear colour behind all layers. */
  sky: Color;
  layers: BgLayerDef[];
}

export type BgGenerator = (
  w: number,
  h: number,
  params: Readonly<Record<string, unknown>>,
  seed: number,
) => PixelBuffer;

/**
 * A dense terrain painter: the same logical arguments as TerrainPainter, returns a buffer of
 * (d·w) × (d·h) for the world rect (x0, y0, w, h) at density d, or null when nothing in the rect
 * has finer art (the view then keeps the lower chunk, saving the memory of an enlarged copy).
 * Painters registered with `setHiTerrainPainter(paint, supports)` serve d 2 only.
 */
export type HiTerrainPainter = (
  sample: TerrainSampler,
  style: TerrainStyleDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
) => PixelBuffer | null;

/** A density-generic terrain painter (UHD art): HiTerrainPainter with the density d (2 or 4) last. */
export type HdTerrainPainter = (
  sample: TerrainSampler,
  style: TerrainStyleDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
  d: SceneryDensity,
) => PixelBuffer | null;

/** A density-generic background generator (UHD art): BgGenerator with the density d (2 or 4) last. */
export type HdBgGenerator = (
  w: number,
  h: number,
  params: Readonly<Record<string, unknown>>,
  seed: number,
  d: SceneryDensity,
) => PixelBuffer;

/** Dense scenery densities. */
export type SceneryDensity = 2 | 4;

/** Density of 2× scenery (the same as 2× sprites, sprites.ts HI_DENSITY). */
export const HI_SCENERY_DENSITY = 2;
/** The dense scenery densities, highest first (the fallback order). */
export const SCENERY_DENSITIES: readonly SceneryDensity[] = [4, 2];

function sceneryDensity(d: number): SceneryDensity {
  return d >= 4 ? 4 : 2;
}

const bgGenerators = new Map<string, BgGenerator>();
const hiBgGenerators: Record<SceneryDensity, Map<string, BgGenerator>> = { 2: new Map(), 4: new Map() };
let terrainPainter: TerrainPainter | null = null;
interface DenseTerrain {
  paint: HiTerrainPainter;
  supports: (style: TerrainStyleDef) => boolean;
}
const hiTerrainPainters: Record<SceneryDensity, DenseTerrain | null> = { 2: null, 4: null };
const hiErrors = new Map<string, string>();
const warned = new Set<string>();

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

export interface BgGeneratorOpts {
  /** A 2× generator for this id (same as `defineHiBgGenerator(id, hi)`). */
  hi?: BgGenerator;
  /** A 4× generator for this id (same as `defineHiBgGenerator(id, hi4, 4)`). */
  hi4?: BgGenerator;
  /** One density-generic generator for 2× and 4× (same as `defineHdBgGenerator(id, hd)`); wins over hi / hi4. */
  hd?: HdBgGenerator;
}

export function defineBgGenerator(id: string, gen: BgGenerator, opts: BgGeneratorOpts = {}): void {
  bgGenerators.set(id, gen);
  if (opts.hd) defineHdBgGenerator(id, opts.hd);
  else {
    if (opts.hi) defineHiBgGenerator(id, opts.hi);
    if (opts.hi4) defineHiBgGenerator(id, opts.hi4, 4);
  }
}

/**
 * Add a dense version (density d, default 2) of background generator `id`: called with the same
 * LOGICAL (w, h, params, seed) as the 1× generator, it returns a buffer of exactly (d·w) × (d·h)
 * with the same design (same shapes and placement, finer detail) and tiles horizontally like the
 * 1× layer.
 */
export function defineHiBgGenerator(id: string, gen: BgGenerator, d: SceneryDensity = 2): void {
  hiBgGenerators[sceneryDensity(d)].set(id, gen);
}

/** Register ONE density-generic generator for the 2× and 4× layers of `id` (or only `densities`). */
export function defineHdBgGenerator(id: string, gen: HdBgGenerator, densities: readonly SceneryDensity[] = SCENERY_DENSITIES): void {
  for (const d of densities) defineHiBgGenerator(id, (w, h, params, seed) => gen(w, h, params, seed, d), d);
}

/** Does `id` have a background generator at exactly density d (default 2)? */
export function hasHiBgGenerator(id: string, d: number = HI_SCENERY_DENSITY): boolean {
  return hiBgGenerators[sceneryDensity(d)].has(id);
}

/**
 * The highest density ≤ d (4 → 2 → 1) at which background `id` has a generator (never an
 * upscale; 1 = the 1× layer only).
 */
export function bgDensityFor(id: string, d: number): 1 | 2 | 4 {
  for (const dd of SCENERY_DENSITIES) if (dd <= d && hiBgGenerators[dd].has(id)) return dd;
  return 1;
}

/** Ids with a dense background generator at density d (default 2), sorted. */
export function listHiBgGenerators(d: number = HI_SCENERY_DENSITY): string[] {
  return [...hiBgGenerators[sceneryDensity(d)].keys()].sort();
}

/**
 * The buffer of a background layer at dense density d (default 2; (d·w) × (d·h)), or null when
 * `id` has no generator at d or it fails (wrong size, throws): then the caller draws a lower
 * layer. Failures are warned once and listed by `hiSceneryErrors()` as 'bg:id@<d>x'.
 */
export function makeHiBgLayer(
  id: string,
  w: number,
  h: number,
  params: Readonly<Record<string, unknown>>,
  seed: number,
  density: number = HI_SCENERY_DENSITY,
): PixelBuffer | null {
  const d = sceneryDensity(density);
  const gen = hiBgGenerators[d].get(id);
  if (!gen) return null;
  try {
    const buf = gen(w, h, params, seed);
    if (!(buf instanceof PixelBuffer) || buf.w !== w * d || buf.h !== h * d) {
      const size = buf instanceof PixelBuffer ? `${buf.w}×${buf.h}` : 'not a PixelBuffer';
      throw new Error(`returned ${size}, expected ${w * d}×${h * d}`);
    }
    return buf;
  } catch (err) {
    hiFailed(`bg:${id}@${d}x`, err);
    return null;
  }
}

export function hasBgGenerator(id: string): boolean {
  return bgGenerators.has(id);
}

export function listBgGenerators(): string[] {
  return [...bgGenerators.keys()].sort();
}

/** Returns the generator, or a fallback that makes an empty (transparent) layer. */
export function getBgGenerator(id: string): BgGenerator {
  const gen = bgGenerators.get(id);
  if (gen) return gen;
  warnOnce(`bg:${id}`, `[art] unknown background generator "${id}" — using an empty layer`);
  return (w, h) => new PixelBuffer(w, h);
}

export function setTerrainPainter(painter: TerrainPainter): void {
  terrainPainter = painter;
}

export function getTerrainPainter(): TerrainPainter {
  return terrainPainter ?? fallbackTerrainPainter;
}

/**
 * Register the dense terrain painter for density d (default 2). `supports(style)` tells whether a
 * style uses any material with art at d (false: the view never asks for chunks of that section
 * at d).
 */
export function setHiTerrainPainter(paint: HiTerrainPainter, supports: (style: TerrainStyleDef) => boolean, d: SceneryDensity = 2): void {
  hiTerrainPainters[sceneryDensity(d)] = { paint, supports };
}

/** Register ONE density-generic terrain painter for 2× and 4× (or only `densities`). */
export function setHdTerrainPainter(
  paint: HdTerrainPainter,
  supports: (style: TerrainStyleDef, d: SceneryDensity) => boolean,
  densities: readonly SceneryDensity[] = SCENERY_DENSITIES,
): void {
  for (const d of densities) {
    setHiTerrainPainter((sample, style, x0, y0, w, h) => paint(sample, style, x0, y0, w, h, d), (style) => supports(style, d), d);
  }
}

/** Does the terrain painter at density d (default 2) have finer art for any material of `style`? */
export function hasHiTerrain(style: TerrainStyleDef, d: number = HI_SCENERY_DENSITY): boolean {
  const t = hiTerrainPainters[sceneryDensity(d)];
  return t !== null && t.supports(style);
}

/** The highest density ≤ d (4 → 2 → 1) with dense terrain art for `style`. */
export function terrainDensityFor(style: TerrainStyleDef, d: number): 1 | 2 | 4 {
  for (const dd of SCENERY_DENSITIES) if (dd <= d && hasHiTerrain(style, dd)) return dd;
  return 1;
}

/**
 * The buffer of a terrain rect at dense density d (default 2), or null when there is no painter
 * at d, nothing in the rect has finer art, or the painter fails (warned once, listed as
 * 'terrain@<d>x').
 */
export function makeHiTerrain(
  sample: TerrainSampler,
  style: TerrainStyleDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
  density: number = HI_SCENERY_DENSITY,
): PixelBuffer | null {
  const d = sceneryDensity(density);
  const t = hiTerrainPainters[d];
  if (!t || !t.supports(style)) return null;
  try {
    const buf = t.paint(sample, style, x0, y0, w, h);
    if (buf === null) return null;
    if (buf.w !== w * d || buf.h !== h * d) throw new Error(`returned ${buf.w}×${buf.h}, expected ${w * d}×${h * d}`);
    return buf;
  } catch (err) {
    hiFailed(`terrain@${d}x`, err);
    return null;
  }
}

function hiFailed(key: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  hiErrors.set(key, msg);
  warnOnce(key, `[art] ${key} failed: ${msg} — drawing the lower art`);
}

/** Dense scenery that fell back to lower art: 'bg:<id>@<d>x' or 'terrain@<d>x', with the reason. */
export function hiSceneryErrors(): Array<{ id: string; error: string }> {
  return [...hiErrors].map(([id, error]) => ({ id, error }));
}

const FALLBACK_CELL_COLORS: readonly Color[] = [0, 0x5a4632ff, 0x8a6a3aff, 0x60646cff];

/** Flat-colour painter used until the art agent registers the real one. */
function fallbackTerrainPainter(
  sample: TerrainSampler,
  _style: TerrainStyleDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
): PixelBuffer {
  const buf = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = sample(x0 + x, y0 + y);
      if (cell !== 0) buf.set(x, y, FALLBACK_CELL_COLORS[cell]);
    }
  }
  return buf;
}
