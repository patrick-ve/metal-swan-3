/**
 * The 3D view (docs/design/rally.md §12.1, §12.2; docs/api/rally.md "A. Wave A contracts"): the
 * pure API the game codes against and `NullView3d` for node. The WebGL2 implementation lives in
 * `gl3d.browser.ts` (Hard Rule 3: GPU code only in `*.browser.ts`, created by main.ts and injected
 * through `AppOptions.view3d`).
 *
 * Space: y up, metres, radians. Yaw is a right-handed turn about +y (counter-clockwise seen from
 * above, so + = a left turn); the forward vector of yaw a is (sin a, 0, cos a) (`r3/mat.ts`).
 *
 * The flow of a frame: the scene uploads its meshes and texture pages once (`upload`), then each
 * frame builds its `View3` list (one view in 1P, two in split screen) and calls `render`; the
 * returned image (a canvas of 384·d × 216·d, d = `density`) goes to `Renderer.surface`, then the
 * 2D HUD draws on top. `render` returns null when nothing can be drawn (node, no WebGL2): the
 * renderer then draws its flat placeholder.
 */

/** A palettised texture page (§7.4): R8 palette indices plus CLUT rows. */
export interface TexturePage {
  /** The page number meshes refer to (`Mesh3.page`); unique per upload set. */
  readonly id: number;
  /** Texels (each ≤ 256). */
  readonly w: number;
  readonly h: number;
  /** One palette index per texel, row-major, `w * h` bytes. */
  readonly index: Uint8Array;
  /**
   * The CLUT rows: 256 entries per row, each an engine `Color` (0xRRGGBBAA). A 4-bit texture uses
   * only the first 16 entries of its row; alpha 0 = a transparent texel (cut out).
   */
  readonly clut: Uint32Array;
}

/** The blend modes of the era (§7.2): opaque, (src+dst)/2, src+dst, dst−src, dst+src/4. */
export type Blend3 = 'opaque' | 'average' | 'add' | 'sub' | 'quarter';

/** One mesh: triangles over one texture page. */
export interface Mesh3 {
  readonly id: string;
  /** Vertex positions (x, y, z) in model space. */
  readonly pos: Float32Array;
  /** Texture coordinates in TEXEL units of its page (u, v); they wrap at the page size. */
  readonly uv: Float32Array;
  /** Vertex colour (r, g, b 0..255; 128 = the texture as painted, 255 ≈ ×2): the Gouraud base. */
  readonly rgb: Uint8Array;
  /** Optional vertex normals (x, y, z) for the sun light; absent = vertex colour only. */
  readonly nrm?: Float32Array;
  /** Triangle list (3 indices per triangle). */
  readonly idx: Uint16Array | Uint32Array;
  /** The texture page (`TexturePage.id`). */
  readonly page: number;
  /** The CLUT row of that page. */
  readonly clutRow: number;
  readonly blend: Blend3;
  /** Draw both faces (no back-face culling). Front faces are counter-clockwise. */
  readonly twoSided?: boolean;
  /** Ignores the light (lamps, LEDs, glows). */
  readonly emissive?: boolean;
  /**
   * OPTIONAL (wave A, additive): a depth bias 0..16 (GL: `polygonOffset(−bias, −bias)`) that keeps
   * a mesh in front of a coplanar one (lane lines and decals on the road, the blob shadow, the
   * plates): the vertex snap tilts big polygons by up to half a 1× pixel. Absent = 0.
   */
  readonly bias?: number;
  /**
   * OPTIONAL (additive): the mesh's `pos` and `uv` change while it is uploaded (the caller writes the
   * same arrays in place, then calls `View3d.updateMesh`): the glitch fold's batched tiles. Absent =
   * a static mesh.
   */
  readonly dynamic?: boolean;
}

/** One draw: a mesh with a world matrix and an optional palette swap. */
export interface DrawItem {
  mesh: string;
  /** A 4×4 column-major world matrix (`r3/mat.ts`); null = identity. */
  m: Float32Array | null;
  /** A palette swap (another CLUT row of the mesh's page); absent = the mesh's own. */
  clutRow?: number;
}

export type Rgb3 = [number, number, number];

/** The light of a view (colours 0..1). */
export interface Light3 {
  /** The direction TO the sun (normalised). */
  sunDir: Rgb3;
  sun: Rgb3;
  ambient: Rgb3;
  fog: Rgb3;
  /** Linear fog from `fogNear` to `fogFar` (metres from the camera). */
  fogNear: number;
  fogFar: number;
  /** The sky gradient behind everything (top of the view → the horizon). */
  skyTop: Rgb3;
  skyBottom: Rgb3;
}

/** A camera: position, yaw (see the header), pitch (+ = up), roll (+ = right side down), the field of view. */
export interface Cam3 {
  pos: Rgb3;
  yaw: number;
  pitch: number;
  roll: number;
  /** Vertical field of view (radians). */
  fovY: number;
  near: number;
  far: number;
}

/** One viewport: its rectangle in logical px (inside 384 × 216), its camera, light and draw list. */
export interface View3 {
  /** 1P: 0, 0, 384, 216; 2P: 0, 0, 384, 108 (P1) and 0, 108, 384, 108 (P2). */
  x: number;
  y: number;
  w: number;
  h: number;
  cam: Cam3;
  light: Light3;
  items: readonly DrawItem[];
}

/** The PS1 traits (§7.1); all true in the game (`PS1_ON`), tests and the shot3d tool may switch them. */
export interface Ps1Opts {
  snap: boolean;
  affine: boolean;
  dither: boolean;
  fog: boolean;
}

export const PS1_ON: Readonly<Ps1Opts> = Object.freeze({ snap: true, affine: true, dither: true, fog: true });

export interface View3dStats {
  /** Triangles and draw calls of the last frame. */
  tris: number;
  draws: number;
  /** GPU bytes held by texture pages and vertex / index buffers. */
  texBytes: number;
  bufBytes: number;
  /** CPU time of the last `render` (ms), when measured. */
  frameMs?: number;
}

/** The logical frame the 3D view covers. */
export const VIEW3D_W = 384;
export const VIEW3D_H = 216;

export interface View3d {
  /** The view can draw (WebGL2 and the program are fine). In node `NullView3d` decides. */
  readonly ok: boolean;
  /** Why it cannot draw ('' when ok). */
  readonly reason: string;
  /** Buffer pixels per logical pixel (1, 2 or 4). */
  readonly density: number;
  /** Resize the canvas to 384·d × 216·d (a no-op when d is unchanged). */
  setDensity(d: 1 | 2 | 4): void;
  /** Upload meshes and texture pages (a mesh id or page id already uploaded is replaced). */
  upload(meshes: readonly Mesh3[], pages: readonly TexturePage[]): void;
  /** Free these meshes (all meshes and pages when absent). */
  release(meshIds?: readonly string[]): void;
  /**
   * OPTIONAL (additive): send an uploaded mesh's `pos` and `uv` again (the caller wrote the arrays it
   * was uploaded with in place; a `Mesh3.dynamic` mesh). No allocation. Absent or an unknown id: a no-op.
   */
  updateMesh?(id: string): void;
  /**
   * Draw the views. Returns the image (a CanvasImageSource of 384·d × 216·d) to hand to
   * `Renderer.surface` in the same task, or null when nothing was drawn.
   */
  render(views: readonly View3[], opts: Ps1Opts): unknown;
  stats(): View3dStats;
  dispose(): void;
}

/**
 * The view of node runs (sims, tests): it accepts everything and draws nothing (`render` → null,
 * the renderer's placeholder shows). `ok` is true by default, so headless runs play the race
 * (logic only, spec §0 item 28); `new NullView3d(false, reason)` stands for a device without
 * WebGL2 (the no-3D path, spec §0 item 23).
 */
export class NullView3d implements View3d {
  readonly ok: boolean;
  readonly reason: string;
  density = 1;
  private readonly meshes = new Map<string, Mesh3>();
  private readonly pages = new Map<number, TexturePage>();

  constructor(ok = true, reason = '') {
    this.ok = ok;
    this.reason = ok ? '' : reason || 'no 3D view';
  }

  setDensity(d: 1 | 2 | 4): void {
    this.density = d;
  }

  upload(meshes: readonly Mesh3[], pages: readonly TexturePage[]): void {
    for (const m of meshes) this.meshes.set(m.id, m);
    for (const p of pages) this.pages.set(p.id, p);
  }

  release(meshIds?: readonly string[]): void {
    if (!meshIds) {
      this.meshes.clear();
      this.pages.clear();
      return;
    }
    for (const id of meshIds) this.meshes.delete(id);
  }

  /** Meshes uploaded so far (tests). */
  hasMesh(id: string): boolean {
    return this.meshes.has(id);
  }

  updateMesh(_id: string): void {}

  render(_views: readonly View3[], _opts: Ps1Opts): unknown {
    return null;
  }

  stats(): View3dStats {
    let texBytes = 0;
    for (const p of this.pages.values()) texBytes += p.index.length + p.clut.length * 4;
    let bufBytes = 0;
    for (const m of this.meshes.values()) bufBytes += m.pos.byteLength + m.uv.byteLength + m.rgb.byteLength + (m.nrm?.byteLength ?? 0) + m.idx.byteLength;
    return { tris: 0, draws: 0, texBytes, bufBytes };
  }

  dispose(): void {
    this.release();
  }
}
