/**
 * Art-side registries shared by mission, background and terrain code
 * (docs/ARCHITECTURE.md §6.2). Pre-written by the orchestrator as a contract so the art agent and
 * the gameplay agents can work in parallel. Extend freely; do not break existing members.
 *
 * - Backgrounds are lists of parallax layers made by NAMED generators (defineBgGenerator).
 * - Terrain is painted per chunk by ONE terrain painter (setTerrainPainter) that reads a
 *   per-pixel sampler, so it does not depend on the terrain data structures.
 * Missing generators / painter fall back to simple flat art (never crash).
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

const bgGenerators = new Map<string, BgGenerator>();
let terrainPainter: TerrainPainter | null = null;
const warned = new Set<string>();

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

export function defineBgGenerator(id: string, gen: BgGenerator): void {
  bgGenerators.set(id, gen);
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
