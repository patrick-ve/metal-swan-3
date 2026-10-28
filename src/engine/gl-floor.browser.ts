/**
 * The perspective floor's WebGL2 program (docs/design/floor.md §2, §3.3; docs/api/floor.md §7): the
 * browser's `FloorGpu`. It draws the same picture as the CPU raster (src/engine/floor/raster.ts, the
 * reference) from the same mesh and the same textures by the same sampling rules
 * (src/engine/floor/tex-layout.ts), so a browser test can hold the two together (spec §3.3: mean
 * difference ≤ 3/255, 99th percentile ≤ 24/255).
 *
 * - One WebGL2 context on a detached canvas, created by `warm()` (the mission preload of a mission
 *   with a floor section, docs/api/floor.md §7) or else on the FIRST USE (the first floor frame, or
 *   reading `ok`); its program compiles in the background where the driver has
 *   KHR_parallel_shader_compile (the CPU raster draws the frames until it is linked, so the section
 *   start waits for no compile). The canvas is (384·R) × (bandH·R): R is the backbuffer res when
 *   main.ts passes `res` (the band then lands 1:1 in `Renderer.surface`, and "sharp bilinear" has
 *   its soft edge one BACKBUFFER px wide, spec §2.3), else the band's density (tests). The texture
 *   density stays the frame's (the art tier). Transparent where there is no floor.
 * - The camera of spec §1.1 as clip coordinates: w = (f − v)/f = 1/s, x_clip = (u − eyeU)/192,
 *   y_clip = w − 2·(top·w + yw − yh − h)/bandH, z_clip = w − 2/sMax (z_ndc = 1 − 2s/sMax: larger s is
 *   nearer; LESS keeps the first drawn on a tie, as the CPU's z-buffer does). Standard GL
 *   perspective-correct varyings carry the texture coordinates (ta, tb). The CPU raster's fill rule
 *   on every GPU: a vertex within 1/16 px of a pixel centre moves 1/16 px off it, on the side the CPU
 *   raster sees it (`offCentre`: a GPU's own sub-pixel snap — 1/16 px on SwiftShader — cannot put an
 *   edge on a centre and break the tie the other way; the vertices move each on their own, which the
 *   mesh allows because it is watertight: mesh.ts welds every T-junction). No other vertex snap, no
 *   affine warp, no colour cut, no dither: NOT the rally's PS1 program.
 * - The mesh: uploaded once per `mesh.id` (one vertex buffer of 4 vertices per quad with the quad's
 *   kind, u0, material and chunk; one index buffer), drawn with ONE `drawElements` per frame for the
 *   visible quads [q0, q1). The u-faces that look away from the eye are culled in the vertex shader
 *   (QUAD_FACE_UP while eyeU ≤ u0, QUAD_FACE_UN while eyeU ≥ u0), as are quads whose texture is not
 *   ready (the CPU raster skips them too).
 * - Textures, each uploaded once by `key`: the chunk ("rows") textures into the layers of one
 *   TEXTURE_2D_ARRAY (LRU over CHUNK_LAYERS layers; at most one new chunk upload per frame while a
 *   lower density of the same chunk is resident), the tiles with their v-mips stacked into one atlas
 *   (shelf-packed; re-packed when full, grown in small steps; the layers and the atlas together stay
 *   within GPU_BUDGET, spec §3.2: a tile the atlas has no room for then is drawn at 2×). Both are
 *   fetched texel by texel (`texelFetch`) and filtered in the shader: the rows layout is an exact
 *   anisotropic pre-filter along v and the tiles carry v-only mips, so hardware mips or anisotropic
 *   filtering would leave the CPU's picture; "sharp
 *   bilinear" per axis (weight clamp((t − ½)·max(1, m) + ½, 0, 1), m = output px per texel from the
 *   screen derivatives), the tile level from the footprint along b, the `over` layer mixed at its
 *   alpha. A PixelBuffer's 0xRRGGBBAA words are uploaded as they lie in memory (little-endian: A, B,
 *   G, R bytes) and read back with `.abg`; a big-endian device reports `ok` false (the CPU draws).
 * - Per frame: no allocation (reused tables and stamps), a handful of GL calls.
 * - Robustness: `webglcontextlost` / `webglcontextrestored` (the section floor keeps the CPU copies
 *   of the mesh and every texture, so after a restore the next frame uploads again what it is
 *   handed); `render` returns null while lost (the CPU raster draws that frame, at most `cpuCap` =
 *   2); no exception leaves `render`; MAX_FAILS failures in a row set `ok` false with the reason.
 *   `enabled: false` (`?floorgl=0`) never makes a context: the CPU path draws every frame.
 *
 * Hard Rule 3: GPU code only here (a `*.browser.ts` file), created by main.ts (`createGlFloor`) and
 * injected through `AppOptions.floorGpu`.
 */
import type { FloorCam } from './floor/cam';
import type { FloorFrame, FloorGpu, FloorMaterial } from './floor/gpu';
import type { FloorMesh } from './floor/mesh';
import type { FloorTexture } from './floor/tex';
import { BAND_TILE_LEVELS } from './floor/tex-layout';
import type { PixelBuffer } from './pixel';

/** The numbers of the last frame (`stats()`). */
export interface GlFloorStats {
  /** CPU time of the last `render` (ms) and its average over the last AVG_N frames. */
  cpuMs: number;
  avgCpuMs: number;
  /** Frames drawn so far. */
  frames: number;
  /** Output px per logical px of the last frame (R) and the band's texture density. */
  res: number;
  density: number;
  /** The canvas of the last frame (px). */
  w: number;
  h: number;
  /** Quads sent in the last frame ([q0, q1)) and draw calls (1). */
  quads: number;
  draws: number;
  /** Chunks and tiles the last frame could not draw (no texture, no free layer). */
  missing: number;
  /** Chunks the last frame drew from a resident stand-in (its new texture waits for a later upload). */
  standIns: number;
  /** Textures uploaded in the last frame and so far. */
  uploads: number;
  totalUploads: number;
  /** GPU bytes: textures (the chunk layers + the tile atlas: ≤ GPU_BUDGET) and buffers (the mesh). */
  texBytes: number;
  /**
   * Tiles of this floor drawn at a lower density because the atlas reached its share of GPU_BUDGET
   * (spec §3.2: over budget, 2× textures at tier 4); 0 = every tile at the band's density.
   */
  tileFallbacks: number;
  bufBytes: number;
  /** Chunk layers allocated, and the layer size (texels). */
  layers: number;
  layerW: number;
  layerH: number;
  lost: boolean;
  /** `render` failures in a row. */
  fails: number;
  /** The context and program setup (ms; once, on the first use). */
  initMs: number;
  /** The last mesh upload (ms; once per floor). */
  meshMs: number;
}

/** The browser's floor renderer: `FloorGpu` plus its state and a few debug members. */
export interface GlFloor extends FloorGpu {
  /** WebGL2 works here (reading it makes the context: the feature check). */
  readonly ok: boolean;
  /** Why not ('' when ok). */
  readonly reason: string;
  /** The canvas (tests: `WEBGL_lose_context`); null before the first use, off or without WebGL2. */
  readonly canvas: HTMLCanvasElement | null;
  stats(): GlFloorStats;
  /**
   * A debug knob (perf comparisons, the console): draw at the band's density (the art tier) instead
   * of the backbuffer res; `Renderer.surface` then scales the band up. The game never sets it.
   */
  atArtDensity: boolean;
  /**
   * TESTS AND TOOLS: the band of the last `render` as top-down RGBA bytes (call it in the same task,
   * before the browser presents the canvas). Null when nothing was drawn.
   */
  readBand(): { w: number; h: number; rgba: Uint8Array } | null;
  /** Free everything and lose the context (the renderer stays off). */
  dispose(): void;
}

export interface GlFloorOpts {
  /** False (`?floorgl=0`): `render` always returns null and no context is made. Default true. */
  enabled?: boolean;
  /**
   * The output px per logical px (main.ts: the renderer's backbuffer res). Default none: the band's
   * density. Never below the band's density; capped by the device's viewport and renderbuffer.
   */
  res?: () => number;
}

/** Chunk slots of the per-frame table (k & 15: the visible chunks are at most 4 neighbours). */
const CHUNK_SLOTS = 16;
/** Tile materials and tiles a floor may have on this path (more: the CPU raster draws it). */
const MAX_MAT = 32;
const MAX_TILE = 48;
/** Chunk layers (the visible chunks plus spares, LRU); fewer when a layer is big. */
const CHUNK_LAYERS = 6;
const MIN_LAYERS = 4;
/** The floor's GPU texture budget (spec §3.2, §8 gate 7): the chunk layers and the tile atlas together. */
export const GPU_BUDGET = 16 * 1024 * 1024;
/** GPU bytes the chunk layers may take; the atlas may take what the layers leave of GPU_BUDGET. */
const LAYER_BUDGET = 14 * 1024 * 1024;
/** Tile atlas width (texels; wider when a tile is wider) and its first height. */
const ATLAS_W = 1024;
const ATLAS_H0 = 128;
/** The atlas grows in steps of this many rows. */
const ATLAS_STEP = 64;
/** x rounded up to a multiple of step. */
function roundUp(x: number, step: number): number {
  return Math.ceil(x / step) * step;
}

/** `repack` results. */
const REPACK_OK = 0;
const REPACK_BUDGET = 1;
const REPACK_FAIL = 2;
/** Floats per vertex: u, v, h, ta, tb, kind, u0, material, chunk. */
const FLOATS = 9;
/** New chunk textures uploaded per frame while a stand-in of the same chunk is resident. */
const UPLOADS_PER_FRAME = 1;
/** `render` failures in a row before the renderer gives up (`ok` false). */
const MAX_FAILS = 60;
/** Frames in the CPU-time average. */
const AVG_N = 60;
/** The chunk apron (tex-layout.ts CHUNK_APRON; written into the shader). */
const APRON = 1;
/** Layer slot not holding a chunk. */
const NO_K = -0x7fffffff;

// ---------------------------------------------------------------------------------------------
// GLSL ES 3.00
// ---------------------------------------------------------------------------------------------

/**
 * Vertex shader: the projection of spec §1.1 as clip coordinates, the face cull, and the quad's
 * texture bindings looked up once per vertex (flat to the fragments): the chunk's layer, density,
 * size and u0, or the material's tiles (atlas place, level rows, density) and drifts.
 */
export const FLOOR_VS = `#version 300 es
precision highp float;
precision highp int;
#define SLOTS ${CHUNK_SLOTS}
#define MAX_MAT ${MAX_MAT}
#define MAX_TILE ${MAX_TILE}
layout(location = 0) in vec3 aPos;   // world u, v, h
layout(location = 1) in vec2 aTex;   // world texture coordinates (ta, tb)
layout(location = 2) in vec4 aQuad;  // the quad's kind, u0, material (-1 = the chunk painter), chunk k
uniform vec4 uCam;                   // eyeU, f, yw - yh, yh - camY - bandTop
uniform vec3 uBand;                  // bandH, 2 / sMax, R (output px per logical px)
uniform vec4 uChunk[SLOTS * 2];      // per slot: (layer, density, cols, rows), (k, u0, 0, 0)
uniform vec4 uMat[MAX_MAT * 2];      // per material: (base tile, a0, b0, over tile), (over alpha, a0, b0, 0)
uniform vec4 uTile[MAX_TILE * 2];    // per tile: (atlas x, y, cols, rows L0), (rows L1, rows L2, density, 0)
out vec2 vT;
flat out vec4 vB0;                   // base layer: x (chunk: layer), y, cols, rows L0
flat out vec4 vB1;                   // base layer: rows L1, rows L2, density, mode (0 chunk, 1 tile)
flat out vec4 vB2;                   // base offsets a0 (chunk: u0), b0; the over layer's alpha
flat out vec4 vO0;                   // over layer: x, y, cols, rows L0
flat out vec4 vO1;                   // over layer: rows L1, rows L2, density
flat out vec2 vO2;                   // over layer offsets a0, b0

int idx(float x) { return int(floor(x + 0.5)); }

// The CPU raster's fill rule on every GPU (raster.ts: a pixel centre ON an edge belongs to the
// triangle below / right of it). A GPU snaps the vertices to its sub-pixel grid (SwiftShader: 1/16
// px) and breaks a tie its own way, so an edge the CPU raster sees just above a centre could land on
// it and give the whole row to the other triangle (a kerb's face edge on a band row). A band-px
// coordinate within 1/16 px of a centre moves to 1/16 px off it, on the side the CPU raster sees it
// (at or before the centre: before), a grid point every GPU keeps: same coverage, no tie.
float offCentre(float p) {
  float c = floor(p) + 0.5;
  float d = p - c;
  if (abs(d) >= 0.0625) return p;
  return d <= 0.0 ? c - 0.0625 : c + 0.0625;
}

void main() {
  vT = aTex;
  vB0 = vec4(0.0);
  vB1 = vec4(0.0);
  vB2 = vec4(0.0);
  vO0 = vec4(0.0);
  vO1 = vec4(0.0);
  vO2 = vec2(0.0);
  int kind = idx(aQuad.x);
  bool keep = !((kind == 2 && uCam.x <= aQuad.y) || (kind == 3 && uCam.x >= aQuad.y));
  int m = idx(aQuad.z);
  if (m < 0) {
    int k = idx(aQuad.w);
    int s = ((k + 1024) & (SLOTS - 1)) * 2;
    vec4 c = uChunk[s];
    vec4 e = uChunk[s + 1];
    keep = keep && c.x >= 0.0 && abs(e.x - float(k)) < 0.5;
    vB0 = vec4(c.x, 0.0, c.z, c.w);
    vB1 = vec4(0.0, 0.0, c.y, 0.0);
    vB2 = vec4(e.y, 0.0, 0.0, 0.0);
  } else if (m < MAX_MAT) {
    vec4 m0 = uMat[m * 2];
    vec4 m1 = uMat[m * 2 + 1];
    int bt = idx(m0.x);
    int ot = idx(m0.w);
    keep = keep && bt >= 0 && bt < MAX_TILE;
    bt = clamp(bt, 0, MAX_TILE - 1);
    vB0 = uTile[bt * 2];
    vB1 = vec4(uTile[bt * 2 + 1].xyz, 1.0);
    bool over = ot >= 0 && ot < MAX_TILE && m1.x > 0.0;
    ot = clamp(ot, 0, MAX_TILE - 1);
    vB2 = vec4(m0.y, m0.z, over ? m1.x : 0.0, 0.0);
    vO0 = uTile[ot * 2];
    vO1 = uTile[ot * 2 + 1];
    vO2 = m1.yz;
  } else {
    keep = false;
  }
  float w = (uCam.y - aPos.y) / uCam.y;
  // The band px of the vertex (x right, y down from the band's top), off the pixel centres.
  float R = uBand.z;
  float px = offCentre((192.0 + (aPos.x - uCam.x) / w) * R);
  float py = offCentre((uCam.w + (uCam.z - aPos.z) / w) * R);
  gl_Position = keep
    ? vec4((px / (192.0 * R) - 1.0) * w, (1.0 - 2.0 * py / (uBand.x * R)) * w, w - uBand.y, w)
    : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

/**
 * Fragment shader: the sampling rules of tex-layout.ts. Chunk: the rows texture at
 * tu = (u − u0)·d + APRON − ½, tv = d·((yw − yh)·f/(f − v) + yh − back) − ½, clamped; tile: level L
 * from the footprint along b, tu = a·d − ½, tv = b·d/2^L − ½, wrapped; sharp bilinear per axis with
 * m from the screen derivatives (chunk rows: m = R/d, as the CPU's d_out/d).
 */
export const FLOOR_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler2DArray;
#define APRON ${APRON}.0
uniform sampler2DArray uChunks;
uniform sampler2D uAtlas;
uniform vec4 uRow;                   // f, (yw - yh) * f, yh - back, R (output px per logical px)
in vec2 vT;
flat in vec4 vB0;
flat in vec4 vB1;
flat in vec4 vB2;
flat in vec4 vO0;
flat in vec4 vO1;
flat in vec2 vO2;
out vec4 oColor;

float sharp(float t, float m) {
  return m <= 1.0 ? t : clamp((t - 0.5) * m + 0.5, 0.0, 1.0);
}

int wrapi(float i, int n) {
  float fn = float(n);
  int r = int(i - fn * floor(i / fn));
  if (r >= n) r -= n;
  if (r < 0) r += n;
  return r;
}

// One tile layer at level L (t0, t1: its atlas place, rows and density), sharpness mx, my.
vec3 tile(vec4 t0, vec4 t1, vec2 ab, int L, float mx, float my) {
  float d = t1.z;
  int cols = int(t0.z);
  int rows = L == 0 ? int(t0.w) : (L == 1 ? int(t1.x) : int(t1.y));
  int y0 = int(t0.y) + (L >= 1 ? int(t0.w) : 0) + (L >= 2 ? int(t1.x) : 0);
  int x0 = int(t0.x);
  float tu = ab.x * d - 0.5;
  float tv = ab.y * d / float(1 << L) - 0.5;
  float fi = floor(tu);
  float fj = floor(tv);
  float wx = sharp(tu - fi, mx);
  float wy = sharp(tv - fj, my);
  int i0 = wrapi(fi, cols);
  int i1 = i0 + 1 == cols ? 0 : i0 + 1;
  int j0 = wrapi(fj, rows);
  int j1 = j0 + 1 == rows ? 0 : j0 + 1;
  vec3 c00 = texelFetch(uAtlas, ivec2(x0 + i0, y0 + j0), 0).abg;
  vec3 c10 = texelFetch(uAtlas, ivec2(x0 + i1, y0 + j0), 0).abg;
  vec3 c01 = texelFetch(uAtlas, ivec2(x0 + i0, y0 + j1), 0).abg;
  vec3 c11 = texelFetch(uAtlas, ivec2(x0 + i1, y0 + j1), 0).abg;
  return mix(mix(c00, c10, wx), mix(c01, c11, wx), wy);
}

void main() {
  vec2 dx = dFdx(vT);
  vec2 dy = dFdy(vT);
  float d = vB1.z;
  float fa = max(abs(dx.x), abs(dy.x)) * d;
  float mx = fa > 1e-9 ? 1.0 / fa : 64.0;
  vec3 c;
  if (vB1.w < 0.5) {
    float tu = (vT.x - vB2.x) * d + (APRON - 0.5);
    float tv = d * (uRow.y / (uRow.x - vT.y) + uRow.z) - 0.5;
    float fi = floor(tu);
    float fj = floor(tv);
    float wx = sharp(tu - fi, mx);
    float wy = sharp(tv - fj, uRow.w / d);
    int cols = int(vB0.z);
    int rows = int(vB0.w);
    int layer = int(vB0.x);
    int i0 = clamp(int(fi), 0, cols - 1);
    int i1 = clamp(int(fi) + 1, 0, cols - 1);
    int j0 = clamp(int(fj), 0, rows - 1);
    int j1 = clamp(int(fj) + 1, 0, rows - 1);
    vec3 c00 = texelFetch(uChunks, ivec3(i0, j0, layer), 0).abg;
    vec3 c10 = texelFetch(uChunks, ivec3(i1, j0, layer), 0).abg;
    vec3 c01 = texelFetch(uChunks, ivec3(i0, j1, layer), 0).abg;
    vec3 c11 = texelFetch(uChunks, ivec3(i1, j1, layer), 0).abg;
    c = mix(mix(c00, c10, wx), mix(c01, c11, wx), wy);
  } else {
    float fb = max(abs(dx.y), abs(dy.y)) * d;
    int L = fb > 2.8284271 ? 2 : (fb > 1.4142135 ? 1 : 0);
    float fl = fb / float(1 << L);
    float my = fl > 1e-9 ? 1.0 / fl : 64.0;
    c = tile(vB0, vB1, vT - vB2.xy, L, mx, my);
    if (vB2.z > 0.0) {
      // The CPU writes the base layer (rounded to 8 bits) and mixes the over layer onto it.
      c = floor(c * 255.0 + 0.5) / 255.0;
      c = mix(c, tile(vO0, vO1, vT - vO2, L, mx, my), vB2.z);
    }
  }
  oColor = vec4(c, 1.0);
}
`;

const VS_UNIFORMS = ['uCam', 'uBand', 'uChunk', 'uMat', 'uTile', 'uRow', 'uChunks', 'uAtlas'] as const;
type Uniform = (typeof VS_UNIFORMS)[number];
type Locs = Record<Uniform, WebGLUniformLocation | null>;

/** The WebGL2 floor. */
class GlFloorImpl implements GlFloor {
  readonly cpuCap = 2;
  atArtDensity = false;
  private readonly enabled: boolean;
  private readonly resFn: (() => number) | null;
  private _canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private u: Locs | null = null;
  /** The program being compiled and linked (null once finished). */
  private pending: { p: WebGLProgram; vs: WebGLShader; fs: WebGLShader } | null = null;
  /** KHR_parallel_shader_compile (null: the program is built synchronously). */
  private parallel: KHR_parallel_shader_compile | null = null;
  private tried = false;
  private lost = false;
  private disposed = false;
  private _ok = false;
  private _reason = 'not started';
  private fails = 0;
  private frames = 0;
  /** Device limits (px). */
  private maxVpW = 0;
  private maxVpH = 0;
  private maxTex = 0;
  private maxLayers = 0;
  // --- the mesh of the current floor
  private meshId = -1;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;
  private ibo: WebGLBuffer | null = null;
  private bufBytes = 0;
  private sMax = 1;
  private kMin = 0;
  private chunkStamp = new Int32Array(1);
  private matStamp = new Int32Array(MAX_MAT);
  /** The mesh fits this path (materials and tiles within the tables). */
  private fits = true;
  // --- the chunk layers (one TEXTURE_2D_ARRAY)
  private arr: WebGLTexture | null = null;
  private arrW = 0;
  private arrH = 0;
  private nLayers = 0;
  private readonly layerTex: (FloorTexture | null)[] = [];
  private readonly layerKey: string[] = [];
  private readonly layerK = new Int32Array(CHUNK_LAYERS).fill(NO_K);
  private readonly layerUsed = new Int32Array(CHUNK_LAYERS);
  // --- the tile atlas
  private atlas: WebGLTexture | null = null;
  private atlasW = 0;
  private atlasH = 0;
  private shelfX = 0;
  private shelfY = 0;
  private shelfH = 0;
  private readonly tileTex: (FloorTexture | null)[] = new Array<FloorTexture | null>(MAX_TILE).fill(null);
  private readonly tileKey: string[] = new Array<string>(MAX_TILE).fill('');
  // --- the per-frame tables (uniform arrays)
  private readonly chunkTab = new Float32Array(CHUNK_SLOTS * 8);
  private readonly matTab = new Float32Array(MAX_MAT * 8);
  private readonly tileTab = new Float32Array(MAX_TILE * 8);
  /** Per tile: the density it is asked at once the atlas reached its budget (0 = the band's), and how many fell back. */
  private readonly tileCap = new Uint8Array(MAX_TILE);
  private fallbacks = 0;
  private stamp = 0;
  private uploads = 0;
  private totalUploads = 0;
  private missing = 0;
  private standIns = 0;
  private readonly cpuRing = new Float32Array(AVG_N);
  private cpuN = 0;
  private cpuSum = 0;
  private drewW = 0;
  private drewH = 0;
  private drewFrame = -1;
  private readonly last: GlFloorStats = {
    cpuMs: 0,
    avgCpuMs: 0,
    frames: 0,
    res: 0,
    density: 0,
    w: 0,
    h: 0,
    quads: 0,
    draws: 0,
    missing: 0,
    standIns: 0,
    uploads: 0,
    totalUploads: 0,
    texBytes: 0,
    tileFallbacks: 0,
    bufBytes: 0,
    layers: 0,
    layerW: 0,
    layerH: 0,
    lost: false,
    fails: 0,
    initMs: 0,
    meshMs: 0,
  };
  private readonly warned = new Set<string>();

  constructor(o: GlFloorOpts) {
    this.enabled = o.enabled !== false;
    this.resFn = o.res ?? null;
    if (!this.enabled) this._reason = 'off (?floorgl=0)';
  }

  get ok(): boolean {
    this.init();
    this.settle();
    return this._ok && !this.isLost();
  }

  get reason(): string {
    this.init();
    this.settle();
    if (this._ok && this.isLost()) return 'the WebGL context is lost';
    return this._ok ? '' : this._reason;
  }

  get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  /** Finish a program still being built (blocking: the feature check of `ok` and `reason`). */
  private settle(): void {
    if (!this.pending || this.isLost()) return;
    try {
      this.finish(true);
    } catch (err) {
      this._ok = false;
      this._reason = `WebGL2 failed: ${message(err)}`;
    }
  }

  private isLost(): boolean {
    return this.lost || (this.gl !== null && this.gl.isContextLost());
  }

  private warnOnce(key: string, msg: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`[gl-floor] ${msg}`);
  }

  // ------------------------------------------------------------------------------- context

  /** Create the context and the program once (the feature check). */
  private init(): void {
    if (this.tried || this.disposed || !this.enabled) return;
    this.tried = true;
    const t0 = performance.now();
    try {
      this.setup();
    } finally {
      this.last.initMs = performance.now() - t0;
    }
  }

  private setup(): void {
    try {
      if (new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] !== 0x44) {
        this._reason = 'big-endian device (the textures are uploaded as they lie in memory)';
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 8;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.lost = true;
        this.dropGpu();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        this.lost = false;
        this.restore();
      });
      const gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: true,
        depth: true,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
      if (!gl) {
        this._reason = 'no WebGL2';
        return;
      }
      this._canvas = canvas;
      this.gl = gl;
      const limit = this.limits(gl);
      if (limit) {
        this._reason = limit;
        return;
      }
      this.parallel = gl.getExtension('KHR_parallel_shader_compile');
      if (!this.build()) return;
      this._ok = true;
      this._reason = '';
    } catch (err) {
      this._ok = false;
      this._reason = `WebGL2 failed: ${message(err)}`;
    }
  }

  /** The limits this program needs ('' = fine). */
  private limits(gl: WebGL2RenderingContext): string {
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const layers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number;
    const vsVec = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) as number;
    const varyings = gl.getParameter(gl.MAX_VARYING_VECTORS) as number;
    const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
    const rb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const hi = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_INT);
    if (!(maxTex >= 1026)) return `texture size ${maxTex} < 1026`;
    if (!(layers >= MIN_LAYERS)) return `texture array layers ${layers} < ${MIN_LAYERS}`;
    if (!(vsVec >= CHUNK_SLOTS * 2 + MAX_MAT * 2 + MAX_TILE * 2 + 4)) return `vertex uniform vectors ${vsVec}`;
    if (!(varyings >= 8)) return `varying vectors ${varyings} < 8`;
    if (!hp || hp.precision < 16) return 'no highp float in the fragment shader';
    if (!hi || hi.rangeMax < 16) return 'no highp int in the fragment shader';
    this.maxTex = maxTex;
    this.maxLayers = Math.min(CHUNK_LAYERS, layers);
    this.maxVpW = Math.min(vp ? vp[0] : rb, rb);
    this.maxVpH = Math.min(vp ? vp[1] : rb, rb);
    if (this.maxVpW < 384 || this.maxVpH < 216) return `viewport limit ${this.maxVpW}×${this.maxVpH}`;
    return '';
  }

  /**
   * Start compiling and linking the program (false + the reason on failure). With
   * KHR_parallel_shader_compile the driver builds it in the background and `finish(false)` asks
   * without blocking (the CPU raster draws the frames until then: no frame waits for a compile);
   * without the extension it finishes now.
   */
  private build(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const p = gl.createProgram();
    if (!vs || !fs || !p) {
      this._reason = 'the floor shader: no shader or program';
      return false;
    }
    gl.shaderSource(vs, FLOOR_VS);
    gl.compileShader(vs);
    gl.shaderSource(fs, FLOOR_FS);
    gl.compileShader(fs);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    this.pending = { p, vs, fs };
    return this.parallel ? true : this.finish(true);
  }

  /**
   * Finish the program being built: its uniforms and the 1-texel stand-in textures. False while it
   * is still compiling (`block` false, the extension's status query) or when it failed (`ok` false
   * with the shader's log).
   */
  private finish(block: boolean): boolean {
    const gl = this.gl;
    const pd = this.pending;
    if (!gl || !pd) return this.prog !== null;
    if (!block && this.parallel && !gl.getProgramParameter(pd.p, this.parallel.COMPLETION_STATUS_KHR)) return false;
    this.pending = null;
    const { p, vs, fs } = pd;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const why = !gl.getShaderParameter(vs, gl.COMPILE_STATUS)
        ? `vertex shader: ${gl.getShaderInfoLog(vs) ?? 'compile failed'}`
        : !gl.getShaderParameter(fs, gl.COMPILE_STATUS)
          ? `fragment shader: ${gl.getShaderInfoLog(fs) ?? 'compile failed'}`
          : `link: ${gl.getProgramInfoLog(p) ?? 'failed'}`;
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(p);
      this._ok = false;
      this._reason = `the floor shader: ${why}`;
      return false;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.prog = p;
    const u = {} as Locs;
    for (const n of VS_UNIFORMS) u[n] = gl.getUniformLocation(p, n);
    this.u = u;
    gl.useProgram(p);
    gl.uniform1i(u.uChunks, 0);
    gl.uniform1i(u.uAtlas, 1);
    gl.useProgram(null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    // Stand-ins until the first textures arrive (a sampler never points at nothing).
    this.allocArray(gl, 1, 1, 1);
    this.allocAtlas(gl, 1, 1);
    return true;
  }

  /** The context is gone: forget every GPU object (the section floor keeps the CPU copies). */
  private dropGpu(): void {
    this.prog = null;
    this.u = null;
    this.pending = null;
    this.vao = null;
    this.vbo = null;
    this.ibo = null;
    this.arr = null;
    this.atlas = null;
    this.forgetMesh();
  }

  /** Forget the mesh and every texture slot (a new floor, a lost context, a release). */
  private forgetMesh(): void {
    this.meshId = -1;
    this.bufBytes = 0;
    this.arrW = 0;
    this.arrH = 0;
    this.nLayers = 0;
    this.atlasW = 0;
    this.atlasH = 0;
    this.layerTex.length = 0;
    this.layerKey.length = 0;
    this.layerK.fill(NO_K);
    this.layerUsed.fill(0);
    this.tileTex.fill(null);
    this.tileKey.fill('');
    this.tileTab.fill(0);
    this.tileCap.fill(0);
    this.fallbacks = 0;
  }

  /** After a context loss: the program again; the next frame uploads the mesh and its textures. */
  private restore(): void {
    if (this.disposed || !this.gl) return;
    this.dropGpu();
    try {
      this._ok = this.build();
      if (this._ok) {
        this._reason = '';
        this.fails = 0;
      }
    } catch (err) {
      this._ok = false;
      this._reason = `restore failed: ${message(err)}`;
    }
  }

  // ------------------------------------------------------------------------------- FloorGpu

  /**
   * The context and the program's compile now (a mission preload with a floor section): the first
   * floor frame of play then pays no setup. Never blocks on the compile; nothing throws out of it.
   */
  warm(): void {
    if (!this.enabled || this.disposed) return;
    try {
      this.init();
    } catch (err) {
      this.warnOnce('warm', `warm failed: ${message(err)}`);
    }
  }

  live(): boolean {
    // Not asked yet (no context made): assume it will draw; else on, not failed, not lost.
    return this.enabled && !this.disposed && (!this.tried || (this._ok && !this.isLost()));
  }

  render(fr: FloorFrame): unknown | null {
    if (!this.enabled || this.disposed) return null;
    const t0 = performance.now();
    let out: unknown = null;
    try {
      out = this.draw(fr);
      if (out) this.fails = 0;
    } catch (err) {
      out = null;
      this.fails++;
      if (this.fails === 1) console.warn(`[gl-floor] render failed: ${message(err)}`);
      if (this.fails >= MAX_FAILS && this._ok) {
        this._ok = false;
        this._reason = `render failed ${MAX_FAILS} times in a row: ${message(err)}`;
        console.warn(`[gl-floor] off: ${this._reason}`);
      }
      try {
        this.gl?.bindVertexArray(null);
      } catch {
        // the context may be gone
      }
    }
    const ms = performance.now() - t0;
    this.last.cpuMs = ms;
    const slot = this.cpuN % AVG_N;
    if (this.cpuN >= AVG_N) this.cpuSum -= this.cpuRing[slot];
    this.cpuRing[slot] = ms;
    this.cpuSum += ms;
    this.cpuN++;
    return out;
  }

  release(meshId: number): void {
    if (meshId !== this.meshId) return;
    const gl = this.gl && this._ok && !this.isLost() ? this.gl : null;
    // Called from the section floor's dispose (outside `render`): nothing may throw out of here.
    try {
      if (gl) {
        if (this.vao) gl.deleteVertexArray(this.vao);
        if (this.vbo) gl.deleteBuffer(this.vbo);
        if (this.ibo) gl.deleteBuffer(this.ibo);
        // The layers and the atlas shrink back to their stand-ins (the next floor sizes its own).
        this.allocArray(gl, 1, 1, 1);
        this.allocAtlas(gl, 1, 1);
      }
    } catch (err) {
      console.warn(`[gl-floor] release failed: ${message(err)}`);
    }
    this.vao = null;
    this.vbo = null;
    this.ibo = null;
    this.forgetMesh();
  }

  private draw(fr: FloorFrame): unknown | null {
    this.init();
    if (this.pending && !this.finish(false)) return null;
    const gl = this.gl;
    const u = this.u;
    const canvas = this._canvas;
    if (!gl || !u || !canvas || !this._ok || !this.prog || this.isLost()) return null;
    const mesh = fr.mesh;
    if (mesh.id !== this.meshId) {
      const t0 = performance.now();
      this.setMesh(gl, mesh, fr.cam, fr.materials);
      this.last.meshMs = performance.now() - t0;
    }
    if (!this.fits || !this.vao) return null;
    // The output: R px per logical px (the backbuffer res, never below the band's density).
    let R = fr.density;
    if (this.resFn && !this.atArtDensity) R = Math.max(R, Math.floor(this.resFn()) || 1);
    R = Math.max(1, Math.min(R, Math.floor(this.maxVpW / 384), Math.floor(this.maxVpH / Math.max(1, fr.bandH))));
    const W = 384 * R;
    const H = Math.max(1, fr.bandH * R);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    this.stamp++;
    this.uploads = 0;
    this.missing = 0;
    this.standIns = 0;
    const stamp = this.stamp;
    // The textures the visible quads use: their chunks and their materials.
    const q0 = Math.max(0, fr.q0);
    const q1 = Math.min(fr.q1, mesh.quadCount);
    const qm = mesh.quadMat;
    const qc = mesh.quadChunk;
    const nMat = fr.materials.length;
    const cs = this.chunkStamp;
    const kMin = this.kMin;
    let kLo = 0x7fffffff;
    let kHi = -0x7fffffff;
    for (let q = q0; q < q1; q++) {
      const m = qm[q];
      if (m < 0) {
        const k = qc[q];
        cs[k - kMin] = stamp;
        if (k < kLo) kLo = k;
        if (k > kHi) kHi = k;
      } else if (m < nMat) this.matStamp[m] = stamp;
    }
    for (let k = kLo; k <= kHi; k++) if (cs[k - kMin] === stamp) this.bindChunk(gl, fr, k);
    for (let m = 0; m < nMat; m++) if (this.matStamp[m] === stamp) this.bindMaterial(gl, fr, m);
    // The draw.
    const cam = fr.cam;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform4f(u.uCam, fr.eyeU, cam.f, cam.yw - cam.yh, cam.yh - fr.camY - fr.bandTop);
    gl.uniform3f(u.uBand, fr.bandH, 2 / this.sMax, R);
    gl.uniform4f(u.uRow, cam.f, (cam.yw - cam.yh) * cam.f, cam.yh - cam.back, R);
    gl.uniform4fv(u.uChunk, this.chunkTab);
    gl.uniform4fv(u.uMat, this.matTab);
    gl.uniform4fv(u.uTile, this.tileTab);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.arr);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.bindVertexArray(this.vao);
    if (q1 > q0) gl.drawElements(gl.TRIANGLES, (q1 - q0) * 6, gl.UNSIGNED_INT, q0 * 24);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    this.frames++;
    this.drewW = W;
    this.drewH = H;
    this.drewFrame = this.frames;
    const st = this.last;
    st.frames = this.frames;
    st.res = R;
    st.density = fr.density;
    st.w = W;
    st.h = H;
    st.quads = Math.max(0, q1 - q0);
    st.draws = q1 > q0 ? 1 : 0;
    st.missing = this.missing;
    st.standIns = this.standIns;
    st.uploads = this.uploads;
    return canvas;
  }

  // ------------------------------------------------------------------------------- the mesh

  /** Upload a floor's mesh (once per `mesh.id`); the textures of the previous floor are forgotten. */
  private setMesh(gl: WebGL2RenderingContext, mesh: FloorMesh, cam: FloorCam, materials: readonly FloorMaterial[]): void {
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.ibo) gl.deleteBuffer(this.ibo);
    this.vao = null;
    this.vbo = null;
    this.ibo = null;
    this.forgetMesh();
    this.meshId = mesh.id;
    // The materials and their tiles must fit the tables (else the CPU raster draws this floor).
    const nMat = materials.length;
    let tiles = 0;
    for (const m of materials) tiles = Math.max(tiles, m.base.tile + 1, m.over ? m.over.tile + 1 : 0);
    this.fits = nMat <= MAX_MAT && tiles <= MAX_TILE;
    if (!this.fits) {
      this.warnOnce(`fit${mesh.id}`, `the floor has ${nMat} materials and ${tiles} tiles (> ${MAX_MAT} / ${MAX_TILE}): the CPU raster draws it`);
      return;
    }
    const nq = mesh.quadCount;
    const vert = new Float32Array(nq * 4 * FLOATS);
    const idx = new Uint32Array(nq * 6);
    let kMin = 0x7fffffff;
    let kMax = -0x7fffffff;
    let vMax = -Infinity;
    for (let q = 0; q < nq; q++) {
      const kind = mesh.quadKind[q];
      const u0 = mesh.quadU0[q];
      const mat = mesh.quadMat[q];
      const k = mesh.quadChunk[q];
      if (mat < 0) {
        if (k < kMin) kMin = k;
        if (k > kMax) kMax = k;
      }
      for (let c = 0; c < 4; c++) {
        const i = mesh.quads[q * 4 + c];
        const o = (q * 4 + c) * FLOATS;
        vert[o] = mesh.pu[i];
        vert[o + 1] = mesh.pv[i];
        vert[o + 2] = mesh.ph[i];
        vert[o + 3] = mesh.ta[i];
        vert[o + 4] = mesh.tb[i];
        vert[o + 5] = kind;
        vert[o + 6] = u0;
        vert[o + 7] = mat;
        vert[o + 8] = k;
        if (mesh.pv[i] > vMax) vMax = mesh.pv[i];
      }
      const b = q * 4;
      const j = q * 6;
      idx[j] = b;
      idx[j + 1] = b + 1;
      idx[j + 2] = b + 2;
      idx[j + 3] = b;
      idx[j + 4] = b + 2;
      idx[j + 5] = b + 3;
    }
    if (kMin > kMax) {
      kMin = 0;
      kMax = 0;
    }
    this.kMin = kMin;
    this.chunkStamp = new Int32Array(kMax - kMin + 1);
    this.matStamp = new Int32Array(Math.max(1, nMat));
    this.stamp = 0;
    // The nearest point of the mesh sets the depth range (z_ndc = 1 − 2s/sMax stays above −1).
    const vNear = Math.max(Number.isFinite(vMax) ? vMax : 0, mesh.vFront, cam.vFront);
    this.sMax = (cam.f / (cam.f - vNear)) * 1.001 + 1e-6;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('no vertex array or buffer');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vert, gl.STATIC_DRAW);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 20);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    this.vao = vao;
    this.vbo = vbo;
    this.ibo = ibo;
    this.bufBytes = vert.byteLength + idx.byteLength;
    this.chunkTab.fill(0);
    for (let s = 0; s < CHUNK_SLOTS; s++) {
      this.chunkTab[s * 8] = -1;
      this.chunkTab[s * 8 + 4] = NO_K;
    }
    this.matTab.fill(-1);
  }

  // ------------------------------------------------------------------------------- chunk layers

  /** Fill chunk k's slot of the table: its layer (uploading the texture when new), or −1. */
  private bindChunk(gl: WebGL2RenderingContext, fr: FloorFrame, k: number): void {
    const o = ((k + 1024) & (CHUNK_SLOTS - 1)) * 8;
    const t = this.chunkTab;
    t[o + 4] = k;
    const tex = fr.chunk(k);
    const layer = tex && tex.kind === 'chunk' && tex.levels.length > 0 ? this.layerFor(gl, tex, k) : -1;
    const lt = layer >= 0 ? this.layerTex[layer] : null;
    if (!lt) {
      t[o] = -1;
      this.missing++;
      return;
    }
    if (lt !== tex) this.standIns++;
    const lv = lt.levels[0];
    t[o] = layer;
    t[o + 1] = lt.density;
    t[o + 2] = lv.w;
    t[o + 3] = lv.h;
    t[o + 5] = lt.u0;
  }

  /** The layer that holds `tex` (or a stand-in of chunk k while this frame's upload is spent); −1 = none. */
  private layerFor(gl: WebGL2RenderingContext, tex: FloorTexture, k: number): number {
    const n = this.nLayers;
    for (let i = 0; i < n; i++) {
      const lt = this.layerTex[i];
      if (lt === tex || (lt && this.layerKey[i] === tex.key)) {
        this.layerTex[i] = tex;
        this.layerUsed[i] = this.stamp;
        return i;
      }
    }
    if (this.uploads >= UPLOADS_PER_FRAME) {
      for (let i = 0; i < n; i++) {
        if (this.layerK[i] === k && this.layerTex[i]) {
          this.layerUsed[i] = this.stamp;
          return i;
        }
      }
    }
    const lv = tex.levels[0];
    if (lv.w > this.arrW || lv.h > this.arrH || this.nLayers < MIN_LAYERS) {
      if (!this.growArray(gl, Math.max(lv.w, this.arrW), Math.max(lv.h, this.arrH))) return -1;
    }
    // A free layer, else the least recently used one not used this frame.
    let pick = -1;
    let oldest = 0x7fffffff;
    for (let i = 0; i < this.nLayers; i++) {
      if (!this.layerTex[i]) {
        pick = i;
        break;
      }
      const used = this.layerUsed[i];
      if (used !== this.stamp && used < oldest) {
        oldest = used;
        pick = i;
      }
    }
    if (pick < 0) return -1;
    this.uploadLayer(gl, pick, tex, k);
    return pick;
  }

  private uploadLayer(gl: WebGL2RenderingContext, i: number, tex: FloorTexture, k: number): void {
    const lv = tex.levels[0];
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.arr);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, lv.w, lv.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytesOf(lv));
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    this.layerTex[i] = tex;
    this.layerKey[i] = tex.key;
    this.layerK[i] = k;
    this.layerUsed[i] = this.stamp;
    this.uploads++;
    this.totalUploads++;
  }

  /** Make the layers at least w × h (the textures held so far are uploaded again). */
  private growArray(gl: WebGL2RenderingContext, w: number, h: number): boolean {
    if (w > this.maxTex || h > this.maxTex) {
      this.warnOnce(`size${w}x${h}`, `a chunk texture of ${w}×${h} is over the device limit ${this.maxTex}`);
      return false;
    }
    const per = w * h * 4;
    const n = Math.max(MIN_LAYERS, Math.min(this.maxLayers, Math.floor(LAYER_BUDGET / per)));
    const keep: (FloorTexture | null)[] = this.layerTex.slice(0, n);
    const keepK = Array.from(this.layerK.subarray(0, n));
    this.allocArray(gl, w, h, n);
    for (let i = 0; i < CHUNK_LAYERS; i++) {
      this.layerTex[i] = null;
      this.layerKey[i] = '';
      this.layerK[i] = NO_K;
      this.layerUsed[i] = 0;
    }
    const used = this.uploads;
    for (let i = 0; i < keep.length; i++) {
      const t = keep[i];
      if (t) this.uploadLayer(gl, i, t, keepK[i]);
    }
    // A resize is not this frame's one new upload.
    this.uploads = used;
    return true;
  }

  private allocArray(gl: WebGL2RenderingContext, w: number, h: number, n: number): void {
    if (this.arr) gl.deleteTexture(this.arr);
    const t = gl.createTexture();
    if (!t) throw new Error('no texture');
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, w, h, n);
    nearest(gl, gl.TEXTURE_2D_ARRAY);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    this.arr = t;
    this.arrW = w === 1 && h === 1 ? 0 : w;
    this.arrH = w === 1 && h === 1 ? 0 : h;
    this.nLayers = w === 1 && h === 1 ? 0 : n;
  }

  // ------------------------------------------------------------------------------- tiles

  /** Fill material m's row of the table: its tiles (placed in the atlas when new) and drifts. */
  private bindMaterial(gl: WebGL2RenderingContext, fr: FloorFrame, m: number): void {
    const mat = fr.materials[m];
    const o = m * 8;
    const t = this.matTab;
    const base = mat.base;
    const bt = this.tileFor(gl, fr, base.tile);
    if (bt < 0) {
      t[o] = -1;
      this.missing++;
      return;
    }
    const btex = this.tileTex[bt] as FloorTexture;
    t[o] = bt;
    t[o + 1] = wrap(base.du * fr.tick, btex.w);
    t[o + 2] = wrap(base.dv * fr.tick, btex.h);
    t[o + 3] = -1;
    t[o + 4] = 0;
    const ov = mat.over;
    if (!ov || !(ov.alpha > 0)) return;
    const ot = this.tileFor(gl, fr, ov.tile);
    if (ot < 0) return;
    const otex = this.tileTex[ot] as FloorTexture;
    t[o + 3] = ot;
    t[o + 4] = ov.alpha;
    t[o + 5] = wrap(ov.du * fr.tick, otex.w);
    t[o + 6] = wrap(ov.dv * fr.tick, otex.h);
  }

  /** Tile i in the atlas (placed now when its texture is new); −1 = none. */
  private tileFor(gl: WebGL2RenderingContext, fr: FloorFrame, i: number): number {
    if (!(i >= 0 && i < MAX_TILE)) {
      this.warnOnce(`tile${i}`, `tile ${i} is over the table (${MAX_TILE} tiles)`);
      return -1;
    }
    const cap = this.tileCap[i];
    const tex = cap > 0 ? fr.tile(i, cap) : fr.tile(i);
    if (!tex || tex.levels.length === 0) return -1;
    const have = this.tileTex[i];
    if (have === tex || (have && this.tileKey[i] === tex.key)) {
      this.tileTex[i] = tex;
      return i;
    }
    this.tileTex[i] = tex;
    this.tileKey[i] = tex.key;
    if (this.place(gl, i)) return i;
    // Re-pack every tile into a larger atlas, within the atlas's share of the GPU budget.
    const r = this.repack(gl);
    if (r === REPACK_OK) return i;
    if (r === REPACK_BUDGET) {
      // Over the budget (the atlas stays as it was): this tile at the next lower density from now on.
      this.tileTex[i] = null;
      this.tileKey[i] = '';
      if (tex.density <= 1) return -1;
      this.tileCap[i] = tex.density >= 4 ? 2 : 1;
      this.fallbacks++;
      this.warnOnce('atlas-budget', `the tile atlas is at its share of the ${GPU_BUDGET >> 20} MiB GPU budget: tiles fall back to a lower density`);
      return this.tileFor(gl, fr, i);
    }
    // Nothing fits (a new atlas was started): every tile is placed again later.
    this.tileTex.fill(null);
    this.tileKey.fill('');
    return -1;
  }

  /**
   * Shelf-pack tile i's band levels (stacked: level 0, 1, 2; the deeper ones are for the CPU's
   * quads and faces only) into the atlas; false = no room.
   */
  private place(gl: WebGL2RenderingContext, i: number): boolean {
    const tex = this.tileTex[i] as FloorTexture;
    const cw = tex.levels[0].w;
    const nl = Math.min(BAND_TILE_LEVELS, tex.levels.length);
    let ch = 0;
    for (let L = 0; L < nl; L++) ch += tex.levels[L].h;
    if (this.shelfX + cw > this.atlasW) {
      this.shelfY += this.shelfH;
      this.shelfX = 0;
      this.shelfH = 0;
    }
    if (cw > this.atlasW || this.shelfY + ch > this.atlasH) return false;
    const x = this.shelfX;
    let y = this.shelfY;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    for (let L = 0; L < nl; L++) {
      const lv = tex.levels[L];
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, lv.w, lv.h, gl.RGBA, gl.UNSIGNED_BYTE, bytesOf(lv));
      y += lv.h;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.shelfX += cw;
    this.shelfH = Math.max(this.shelfH, ch);
    const o = i * 8;
    const L = tex.levels;
    this.tileTab[o] = x;
    this.tileTab[o + 1] = this.shelfY;
    this.tileTab[o + 2] = cw;
    this.tileTab[o + 3] = L[0].h;
    this.tileTab[o + 4] = (L[1] ?? L[0]).h;
    this.tileTab[o + 5] = (L[2] ?? L[1] ?? L[0]).h;
    this.tileTab[o + 6] = tex.density;
    this.tileTab[o + 7] = 0;
    this.uploads++;
    this.totalUploads++;
    return true;
  }

  /**
   * A new atlas big enough for every tile held now, no larger than what the chunk layers leave of
   * GPU_BUDGET: REPACK_OK; REPACK_BUDGET = it would be over that share (nothing changed: the atlas and
   * its tiles stay as they were); REPACK_FAIL = over the device limit (a new atlas was started).
   */
  private repack(gl: WebGL2RenderingContext): number {
    let wMax = ATLAS_W;
    let area = 0;
    for (const t of this.tileTex) {
      if (!t) continue;
      let ch = 0;
      for (let L = 0; L < Math.min(BAND_TILE_LEVELS, t.levels.length); L++) ch += t.levels[L].h;
      wMax = Math.max(wMax, t.levels[0].w);
      area += t.levels[0].w * ch;
    }
    const w = Math.min(this.maxTex, wMax);
    const budget = GPU_BUDGET - this.arrW * this.arrH * 4 * this.nLayers;
    // The height the tiles' area needs (+ a quarter for the shelves), in steps of ATLAS_STEP; a shelf
    // pack that does not fit grows it by a quarter (not doubled: the atlas stays near its tiles' size).
    let h = Math.max(ATLAS_H0, roundUp((area * 1.25) / w, ATLAS_STEP));
    for (;;) {
      const hh = Math.min(h, this.maxTex);
      // The budget is checked per try (a shelf pack may need a little more than the area).
      if (w * hh * 4 > budget) return REPACK_BUDGET;
      this.allocAtlas(gl, w, hh);
      let ok = true;
      for (let i = 0; i < MAX_TILE && ok; i++) if (this.tileTex[i]) ok = this.place(gl, i);
      if (ok) return REPACK_OK;
      if (hh >= this.maxTex) break;
      h = roundUp(h * 1.25, ATLAS_STEP);
    }
    this.warnOnce('atlas', `the tiles do not fit a ${w}×${this.maxTex} atlas`);
    return REPACK_FAIL;
  }

  private allocAtlas(gl: WebGL2RenderingContext, w: number, h: number): void {
    if (this.atlas) gl.deleteTexture(this.atlas);
    const t = gl.createTexture();
    if (!t) throw new Error('no texture');
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    nearest(gl, gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.atlas = t;
    this.atlasW = w === 1 && h === 1 ? 0 : w;
    this.atlasH = w === 1 && h === 1 ? 0 : h;
    this.shelfX = 0;
    this.shelfY = 0;
    this.shelfH = 0;
  }

  // ------------------------------------------------------------------------------- debug

  stats(): GlFloorStats {
    const st = this.last;
    st.avgCpuMs = this.cpuN > 0 ? this.cpuSum / Math.min(this.cpuN, AVG_N) : 0;
    st.totalUploads = this.totalUploads;
    st.texBytes = this.arrW * this.arrH * 4 * this.nLayers + this.atlasW * this.atlasH * 4;
    st.tileFallbacks = this.fallbacks;
    st.bufBytes = this.bufBytes;
    st.layers = this.nLayers;
    st.layerW = this.arrW;
    st.layerH = this.arrH;
    st.lost = this.isLost();
    st.fails = this.fails;
    return st;
  }

  readBand(): { w: number; h: number; rgba: Uint8Array } | null {
    const gl = this.gl;
    if (!gl || this.isLost() || this.drewFrame < 0) return null;
    const w = this.drewW;
    const h = this.drewH;
    const up = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, up);
    // GL rows run bottom-up.
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) out.set(up.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return { w, h, rgba: out };
  }

  dispose(): void {
    if (this.meshId >= 0) this.release(this.meshId);
    const ext = this.gl && !this.isLost() ? this.gl.getExtension('WEBGL_lose_context') : null;
    this.disposed = true;
    this.dropGpu();
    ext?.loseContext();
    this.gl = null;
    this._canvas = null;
    this._ok = false;
    this._reason = 'disposed';
  }
}

/** The bytes of a buffer's 0xRRGGBBAA words as they lie in memory (little-endian: A, B, G, R). */
function bytesOf(b: PixelBuffer): Uint8Array {
  return new Uint8Array(b.data.buffer, b.data.byteOffset, b.w * b.h * 4);
}

/** x mod n into [0, n) (a drift offset; n the tile's repeat in world px). */
function wrap(x: number, n: number): number {
  if (!(n > 0)) return 0;
  const r = x - Math.floor(x / n) * n;
  return r >= n ? r - n : r;
}

function nearest(gl: WebGL2RenderingContext, target: number): void {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The browser's floor renderer (main.ts → `AppOptions.floorGpu`). The context is made on first use. */
export function createGlFloor(o: GlFloorOpts = {}): GlFloor {
  return new GlFloorImpl(o);
}
