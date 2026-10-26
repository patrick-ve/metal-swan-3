/**
 * The floor's registries (docs/design/floor.md §3.1, docs/api/floor.md §3): painters, tiles and
 * procedural props by id (the kits register them at import time, like sprites), the tools' floor
 * override and the injected GPU renderer. Unknown ids fail soft (a magenta texture, no prop, one
 * warning).
 */
import type { Color } from '../../../engine/color';
import type { FloorCam } from '../../../engine/floor/cam';
import { NullFloorGpu, type FloorGpu } from '../../../engine/floor/gpu';
import type { Frame } from '../../../engine/render';
import type { SectionDef } from '../types';
import type { FloorDef } from './types';

/** What a floor painter gets (once per density): pure inputs only. */
export interface FloorPaintCtx {
  /** Texels per world px (1, 2 or 4). */
  readonly d: number;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seed: number;
  readonly cam: FloorCam;
  /** The height field: h at (u, v) (world px). */
  heightAt(u: number, v: number): number;
  /** The feature that wins at (u, v): its index in `FloorDef.features`, -1 the walk profile, -2 a pit. */
  featureAt(u: number, v: number): number;
  /** World v of a depth (screen px behind the walk line on flat ground) and back. */
  vAt(depth: number): number;
  depthAt(v: number): number;
}

/**
 * A floor painter: called once per density, returns the texel function — the colour of the top
 * surface at world (u, v) (texel centres; the store box-filters far rows in v). A PURE function of
 * (u, v), the density, the params and the seed: never of screen coordinates, the time or a global rng.
 */
export type FloorPainter = (ctx: FloorPaintCtx) => (u: number, v: number) => Color;

/**
 * A tile material (faces, water, slabs …): `paint(a, b, d)` at texel centres over [0, w) × [0, h)
 * world px, repeating in both axes (paint it seamless). For a top surface (a, b) = (u, v); for a
 * face a = along it, b = px below its top edge; for a quad (canopy, top face) a = u, b = across it.
 * `h` must be a multiple of 4 (the v-mips).
 */
export interface FloorTileDef {
  w: number;
  h: number;
  paint(a: number, b: number, d: number): Color;
}

/** A procedural prop: its frame at the final scale (× the row's perspective scale) and density d (feet anchor). */
export type FloorPropGen = (scale: number, d: number) => Frame;

const painters = new Map<string, FloorPainter>();
const tiles = new Map<string, FloorTileDef>();
const props = new Map<string, FloorPropGen>();
const warned = new Set<string>();

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

export function defineFloorPainter(id: string, painter: FloorPainter): void {
  painters.set(id, painter);
}

/** The painter (fail soft: a magenta painter and one warning). */
export function getFloorPainter(id: string): FloorPainter {
  const p = painters.get(id);
  if (p) return p;
  warnOnce(`painter:${id}`, `[floor] unknown painter "${id}" — drawing magenta`);
  return () => () => 0xff00ffff;
}

export function hasFloorPainter(id: string): boolean {
  return painters.has(id);
}

export function defineFloorTile(id: string, def: FloorTileDef): void {
  if (def.h % 4 !== 0) throw new Error(`floor tile "${id}": h ${def.h} must be a multiple of 4`);
  tiles.set(id, def);
}

/** The tile (null + one warning when unknown). */
export function getFloorTile(id: string): FloorTileDef | null {
  const t = tiles.get(id);
  if (!t) warnOnce(`tile:${id}`, `[floor] unknown tile "${id}" — drawing magenta`);
  return t ?? null;
}

export function hasFloorTile(id: string): boolean {
  return tiles.has(id);
}

export function defineFloorProp(id: string, gen: FloorPropGen): void {
  props.set(id, gen);
}

export function getFloorProp(id: string): FloorPropGen | null {
  const g = props.get(id);
  if (!g) warnOnce(`prop:${id}`, `[floor] unknown prop "${id}" — the row is empty`);
  return g ?? null;
}

export function listFloorPainters(): string[] {
  return [...painters.keys()].sort();
}

export function listFloorTiles(): string[] {
  return [...tiles.keys()].sort();
}

// ------------------------------------------------------------------------------- the floor of a section

let override: ((s: SectionDef) => FloorDef | null | undefined) | null = null;

/**
 * TOOLS ONLY (`--floor-debug`, `--floor-off`, tests): a function that gives the floor of any
 * section (null = no floor, undefined = the section's own). Null removes the override.
 */
export function setFloorOverride(fn: ((s: SectionDef) => FloorDef | null | undefined) | null): void {
  override = fn;
}

/** The floor a section draws with (the override first, then `SectionDef.floor`). */
export function floorOf(s: SectionDef): FloorDef | undefined {
  if (override) {
    const f = override(s);
    if (f === null) return undefined;
    if (f !== undefined) return f;
  }
  return s.floor;
}

// ------------------------------------------------------------------------------- the GPU

let gpu: FloorGpu = new NullFloorGpu();

/** The GPU floor renderer the runners use by default (`createApp` sets `AppOptions.floorGpu`; null = none). */
export function setFloorGpu(g: FloorGpu | null): void {
  gpu = g ?? new NullFloorGpu();
}

export function activeFloorGpu(): FloorGpu {
  return gpu;
}

/**
 * The mission preload (gameplay.ts `preloadMissionArt`): when one of `sections` has a floor, the GPU
 * floor makes its context and starts its compile now (`FloorGpu.warm`), so no play frame pays the
 * GL setup. Returns true when it asked.
 */
export function warmFloorGpu(sections: Readonly<Record<string, SectionDef>> | undefined): boolean {
  if (!sections || !gpu.warm) return false;
  for (const id in sections) {
    if (floorOf(sections[id])) {
      gpu.warm();
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------------------- the overlay

let overlay = false;

/** The debug overlay (`?debug=floor`, `--floor-overlay`): the depth grid, the walk line and the row lines. */
export function setFloorOverlay(on: boolean): void {
  overlay = on;
}

export function floorOverlay(): boolean {
  return overlay;
}
