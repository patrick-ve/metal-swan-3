/**
 * The floor textures' layout and sampling rules (docs/design/floor.md §2, §3.2, §3.3): the ONE
 * definition both renderers follow (the CPU raster in raster.ts, the WebGL2 program in
 * gl-floor.browser.ts), so they draw the same picture.
 *
 * Two kinds of texture, both opaque, packed 0xRRGGBBAA, density d texels per world px:
 *
 * 1. CHUNK ("rows"): the chunk painter's top surface for u ∈ [k·CHUNK_U, (k+1)·CHUNK_U), one level of
 *    chunkCols(d) × rowsOf(cam, d) texels: CHUNK_U·d columns plus an apron of CHUNK_APRON column on
 *    each side (painted from the neighbour chunks' u, so bilinear sampling has no seam at a chunk
 *    edge; column c's centre is u0 + (c − CHUNK_APRON + 0.5)/d). Its rows are the SCREEN ROWS of
 *    flat ground: row j covers
 *    the floor between screen y `cam.back + j/d` and `cam.back + (j+1)/d`, box-filtered in v when it
 *    is baked (the painter is sampled ⌈Δv·d⌉ times per texel, at most MAX_ROW_SAMPLES). A far row is
 *    smaller than the painter's detail, so it is pre-filtered for exactly its footprint: no shimmer,
 *    no mips needed, and on flat ground a band row is exactly one texture row (crisp).
 *    Sampling at world (u, v) (texel centres at integers): tu = (u − u0)·d + CHUNK_APRON − 0.5,
 *    tv = rowOf(cam, d, v) = d·(y(v) − cam.back) − 0.5
 *    (y(v) = yh + (yw − yh)·f/(f − v): computed per pixel from the perspective-correct v).
 *
 * 2. TILE: a small repeating material (faces, water, the pit), W × H world px (H a multiple of 4),
 *    with v-mips: `levels[0]` (W·d) × (H·d), every next level halves the ROWS only (the
 *    foreshortened axis), each row the mean of the rows of the level above it covers, down to ONE
 *    row (the mean along b of every column: a face seen edge-on shows its calm mean colour, never
 *    noise). Sampling at texture coordinates (a, b) world px (tops: (u − du·tick, v − dv·tick) for
 *    an animated layer; faces: (along, back in depth)): tu = a·d − 0.5, tv = b·d·(rows_L / rows_0)
 *    − 0.5 (texel centres at integers, wrapping at W·d and the level's rows; = b·d/2^L for the
 *    first BAND_TILE_LEVELS levels, H·d being a multiple of 4).
 *    The BAND (both renderers, the floor mesh's materials) uses levels 0 … BAND_TILE_LEVELS − 1:
 *    L = clamp(round(log2(fb)), 0, 2), fb = level-0 texels of b per output pixel (per span on the
 *    CPU). The quads and the face groups (quad.ts, CPU only) use the whole chain, the level from
 *    the footprint per column of a constant-u face (a side wall) or per pixel.
 *
 * Within a level both use SHARP BILINEAR: per axis, with m = output px per texel along that axis,
 * the bilinear weight of the fraction t is clamp((t − 0.5)·max(1, m) + 0.5, 0, 1): crisp texels,
 * a soft edge one output pixel wide, plain bilinear when minified. Chunk rows clamp at the first
 * and last row; tiles wrap. Alpha is ignored (opaque); a second animated layer is mixed at its
 * fixed alpha after both layers are sampled.
 */
import { yOfV, type FloorCam } from './cam';

/** World px along u of one texture chunk (= the terrain chunk size). */
export const CHUNK_U = 256;
/** Apron columns on each side of a chunk texture. */
export const CHUNK_APRON = 1;
/** Painter samples per chunk texel at most (far rows: the box filter in v). */
export const MAX_ROW_SAMPLES = 8;
/** Mip levels of a tile the BAND samples (0 … BAND_TILE_LEVELS − 1; the GL program uploads only these). */
export const BAND_TILE_LEVELS = 3;

/** Texture columns of a chunk at density d (the apron included). */
export function chunkCols(d: number): number {
  return CHUNK_U * d + 2 * CHUNK_APRON;
}

/** Texture rows of a chunk at density d (the flat floor from the back edge to the front). */
export function rowsOf(cam: FloorCam, d: number): number {
  return Math.ceil((cam.front - cam.back) * d);
}

/** Fractional texture row of world depth v in a chunk of density d (row j's centre = j). */
export function rowOf(cam: FloorCam, d: number, v: number): number {
  return d * (yOfV(cam, v) - cam.back) - 0.5;
}

/** The sharp-bilinear weight of fraction t (0..1) at m output px per texel. */
export function sharpWeight(t: number, m: number): number {
  if (m <= 1) return t;
  const w = (t - 0.5) * m + 0.5;
  return w < 0 ? 0 : w > 1 ? 1 : w;
}

/** The band's tile mip level for a footprint fb (level-0 texels of b per output px). */
export function tileLevel(fb: number): number {
  if (!(fb > 1.4142135)) return 0;
  return fb > 2.8284271 ? 2 : 1;
}

/**
 * The quads' tile mip level (the whole chain, `last` = the one-row level) for a footprint fb:
 * round(log2(fb)) clamped to 0 … last.
 */
export function chainLevel(fb: number, last: number): number {
  let L = 0;
  let t = 1.4142135;
  while (fb > t && L < last) {
    L++;
    t *= 2;
  }
  return L;
}

/** Key of a chunk texture (`c<k>@<d>`) and of a tile texture (`t<id>@<d>`). */
export function chunkKey(k: number, d: number): string {
  return `c${k}@${d}`;
}

export function tileKey(id: string, d: number): string {
  return `t${id}@${d}`;
}
