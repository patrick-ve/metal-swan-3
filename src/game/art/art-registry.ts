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
 * 2× scenery (docs/ARCHITECTURE.md §3, docs/ART_GUIDE.md "2x art (mission ams)"): a background
 * generator may have a 2× version (`defineBgGenerator(id, gen, { hi })` or `defineHiBgGenerator`)
 * and the terrain may have a 2× painter (`setHiTerrainPainter`). Both get the same LOGICAL
 * arguments as the 1× ones and return a buffer twice as wide and high; a mission with
 * `artDensity: 2` draws them (SectionView), every other mission never calls them. A 2× result of
 * the wrong size, or a throwing 2× generator, falls back to the 1× art with a warning
 * (`hiSceneryErrors()`), like 2× sprites.
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
 * A 2× terrain painter: the same logical arguments as TerrainPainter, returns a buffer of
 * (2·w) × (2·h) for the world rect (x0, y0, w, h), or null when nothing in the rect has finer 2×
 * art (the view then keeps the 1× chunk, saving the memory of an enlarged copy).
 */
export type HiTerrainPainter = (
  sample: TerrainSampler,
  style: TerrainStyleDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
) => PixelBuffer | null;

/** Density of 2× scenery (the same as 2× sprites, sprites.ts HI_DENSITY). */
export const HI_SCENERY_DENSITY = 2;

const bgGenerators = new Map<string, BgGenerator>();
const hiBgGenerators = new Map<string, BgGenerator>();
let terrainPainter: TerrainPainter | null = null;
let hiTerrainPainter: { paint: HiTerrainPainter; supports: (style: TerrainStyleDef) => boolean } | null = null;
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
}

export function defineBgGenerator(id: string, gen: BgGenerator, opts: BgGeneratorOpts = {}): void {
  bgGenerators.set(id, gen);
  if (opts.hi) hiBgGenerators.set(id, opts.hi);
}

/**
 * Add a 2× version of background generator `id`: called with the same LOGICAL (w, h, params,
 * seed) as the 1× generator, it returns a buffer of exactly (2·w) × (2·h) with the same design
 * (same shapes and placement, finer detail) and tiles horizontally like the 1× layer.
 */
export function defineHiBgGenerator(id: string, gen: BgGenerator): void {
  hiBgGenerators.set(id, gen);
}

export function hasHiBgGenerator(id: string): boolean {
  return hiBgGenerators.has(id);
}

export function listHiBgGenerators(): string[] {
  return [...hiBgGenerators.keys()].sort();
}

/**
 * The 2× buffer of a background layer (density 2, (2·w) × (2·h)), or null when `id` has no 2×
 * generator or it fails (wrong size, throws): then the caller draws the 1× layer. Failures are
 * warned once and listed by `hiSceneryErrors()` as 'bg:id@2x'.
 */
export function makeHiBgLayer(id: string, w: number, h: number, params: Readonly<Record<string, unknown>>, seed: number): PixelBuffer | null {
  const gen = hiBgGenerators.get(id);
  if (!gen) return null;
  const d = HI_SCENERY_DENSITY;
  try {
    const buf = gen(w, h, params, seed);
    if (!(buf instanceof PixelBuffer) || buf.w !== w * d || buf.h !== h * d) {
      const size = buf instanceof PixelBuffer ? `${buf.w}×${buf.h}` : 'not a PixelBuffer';
      throw new Error(`returned ${size}, expected ${w * d}×${h * d}`);
    }
    return buf;
  } catch (err) {
    hiFailed(`bg:${id}@2x`, err);
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
 * Register the 2× terrain painter. `supports(style)` tells whether a style uses any material with
 * 2× art (false: the view never asks for 2× chunks of that section).
 */
export function setHiTerrainPainter(paint: HiTerrainPainter, supports: (style: TerrainStyleDef) => boolean): void {
  hiTerrainPainter = { paint, supports };
}

/** Does the 2× terrain painter have finer art for any material of `style`? */
export function hasHiTerrain(style: TerrainStyleDef): boolean {
  return hiTerrainPainter !== null && hiTerrainPainter.supports(style);
}

/**
 * The 2× buffer of a terrain rect (density 2), or null when there is no 2× painter, nothing in
 * the rect has finer art, or the painter fails (warned once, listed as 'terrain@2x').
 */
export function makeHiTerrain(sample: TerrainSampler, style: TerrainStyleDef, x0: number, y0: number, w: number, h: number): PixelBuffer | null {
  if (!hiTerrainPainter || !hiTerrainPainter.supports(style)) return null;
  const d = HI_SCENERY_DENSITY;
  try {
    const buf = hiTerrainPainter.paint(sample, style, x0, y0, w, h);
    if (buf === null) return null;
    if (buf.w !== w * d || buf.h !== h * d) throw new Error(`returned ${buf.w}×${buf.h}, expected ${w * d}×${h * d}`);
    return buf;
  } catch (err) {
    hiFailed('terrain@2x', err);
    return null;
  }
}

function hiFailed(key: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  hiErrors.set(key, msg);
  warnOnce(key, `[art] 2× ${key} failed: ${msg} — drawing the 1× art`);
}

/** 2× scenery that fell back to its 1× art: 'bg:<id>@2x' or 'terrain@2x', with the reason. */
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
