/**
 * The floor's GPU contract (docs/design/floor.md §3.3): what one frame of the floor band needs, and
 * the interface a GPU renderer implements. Pure (no WebGL here, Hard Rule 3): the WebGL2 program
 * lives in `gl-floor.browser.ts`, created by main.ts and injected through `AppOptions.floorGpu`.
 *
 * The band: logical x 0 … VIEW_W, y `bandTop` … `bandTop + bandH`, with textures of `density`
 * texels per world px, rendered into an image of any size (the CPU raster's is (VIEW_W·density) ×
 * (bandH·density); the GL floor draws at the backbuffer res) and drawn over the band's logical
 * rectangle with `Renderer.surface(image, 0, bandTop, VIEW_W, bandH)` (transparent where no floor
 * is). The CPU raster (raster.ts) renders the same frame and is the reference: same mesh, same
 * textures, same sampling rules (tex-layout.ts).
 *
 * A GPU renderer:
 * - uploads `mesh` once per `mesh.id` (it never changes; positions in world px, see mesh.ts) and
 *   projects it with the camera (cam.ts: s = f/(f − v), x' = 192 + (u − camX − 192)·s,
 *   y' = yh − camY + (yw − yh − h)·s; depth test: larger s is nearer);
 * - draws the quads `q0 … q1 − 1` (two triangles 0-1-2, 0-2-3 each), skipping a QUAD_FACE_UP
 *   quad while `eyeU ≤ its u` and a QUAD_FACE_UN quad while `eyeU ≥ its u`;
 * - binds per quad: `quadMat < 0` → `chunk(quadChunk)` (a rows texture), else the material
 *   `materials[quadMat]`: `tile(layer.tile)` with the layer's offset (du, dv)·tick, and the `over`
 *   layer mixed at its alpha;
 * - uploads each texture once by `key` (textures never change once published; `storeVersion`
 *   changes when one is published or released, so a GPU may drop keys it has not seen for a while);
 * - returns its canvas, or null when it cannot draw this frame (no WebGL2, a lost context,
 *   `?floorgl=0`): the CPU raster then draws the frame (at most `cpuCap` density).
 */
import type { FloorCam } from './cam';
import type { FloorMesh } from './mesh';
import type { FloorTexture } from './tex';

/** One layer of a tile material: the tile and its drift (world px per tick, 0 = still). */
export interface FloorMaterialLayer {
  /** Tile index (`FloorFrame.tile(i)`). */
  readonly tile: number;
  readonly du: number;
  readonly dv: number;
}

/**
 * A tile material of the mesh (`FloorMesh.quadMat` ≥ 0): one layer, or two with the second mixed
 * over the first at `alpha` (a cheap shimmer for water: two drifting ripples).
 */
export interface FloorMaterial {
  readonly base: FloorMaterialLayer;
  readonly over: (FloorMaterialLayer & { readonly alpha: number }) | null;
  /** Animated (a layer drifts): the floor is not still while the camera is (the still test skips it). */
  readonly animated: boolean;
}

/** Everything one frame of the floor band needs (one reused object per floor; read-only to a GPU). */
export interface FloorFrame {
  readonly cam: FloorCam;
  readonly mesh: FloorMesh;
  readonly materials: readonly FloorMaterial[];
  /** The renderer's camera (snapped to 1/res: the ONE camera of the picture, spec §2.1). */
  camX: number;
  camY: number;
  /** The eye's u (camX + 192): the u-face cull. */
  eyeU: number;
  /** Ticks of the drawing (the animated layers' clock). */
  tick: number;
  /** Output px per logical px (1, 2 or 4). */
  density: number;
  /** The band (logical px, whole numbers): rows bandTop … bandTop + bandH, x 0 … VIEW_W. */
  bandTop: number;
  bandH: number;
  /** Visible quads [q0, q1). */
  q0: number;
  q1: number;
  /** Changes whenever a texture is published or released. */
  storeVersion: number;
  /** The best chunk texture ready now (a lower density stands in for one still being built). */
  chunk(k: number): FloorTexture | null;
  /**
   * The best texture of tile i ready now (at most the frame's density; `want`: at most that density —
   * a GPU whose tile atlas reached its budget asks for 2×, spec §3.2).
   */
  tile(i: number, want?: number): FloorTexture | null;
}

/** A GPU floor renderer (gl-floor.browser.ts); `NullFloorGpu` everywhere else. */
export interface FloorGpu {
  /**
   * The highest density the CPU raster may draw at when this GPU returns null (the browser: 2,
   * spec §3.3 "capped at density 2 there"; headless: 4).
   */
  readonly cpuCap: number;
  /** Render the band; returns the image for `Renderer.surface`, or null (the CPU raster draws it). */
  render(frame: FloorFrame): unknown | null;
  /** The floor of a mesh is gone (the section ended): free its buffers and textures. Optional. */
  release?(meshId: number): void;
  /**
   * Make the context and start the program's compile now, without blocking (a mission with a floor
   * calls it in its preload, so the first floor frame of play pays no setup). Optional; idempotent.
   */
  warm?(): void;
  /**
   * Will `render` draw the band (switched on, not failed, not lost; true while still unknown)?
   * Optional: without it the floor assumes the CPU raster draws (at most `cpuCap`). A section start
   * before any floor has drawn sizes its dense textures by it.
   */
  live?(): boolean;
}

/** No GPU (node, tests, tools): the CPU raster draws every frame, up to density 4. */
export class NullFloorGpu implements FloorGpu {
  readonly cpuCap = 4;
  render(_frame: FloorFrame): unknown | null {
    return null;
  }
}
