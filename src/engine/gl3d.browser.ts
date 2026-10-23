/**
 * The WebGL2 3D view (docs/design/rally.md §7.1–§7.3, §12.2; docs/api/rally.md "A.5" and "A.GL The
 * 3D view"): the `View3d` of the browser, with the PS1 program (the sources: `r3/ps1.ts`).
 *
 * - One WebGL2 context on a detached canvas of 384·d × 216·d (d = `density`: 1, 2 or 4), created on
 *   the FIRST USE (reading `ok`, `setDensity`, `upload` or `render`): the rally card's preload makes
 *   it, which is the feature check (WebGL2, the limits, highp, both programs compile and link).
 * - Every view: its viewport and scissor (1P one view; 2P P1 on top, P2 below), a clear, the SKY
 *   pass (a gradient skyTop → skyBottom at the horizon, dithered), then the draw list: opaque items
 *   first (batched by texture page), then the blended ones back to front (by the view depth of the
 *   centre of the item's bounding sphere), with the blend modes of the era (average, add, sub,
 *   quarter). Items outside the view frustum (a sphere test) are skipped.
 * - The PS1 program: the vertex snap to the view's 1× grid, the affine texture mapping, the R8 index
 *   texel → the CLUT row (a palette swap per item; a CLUT entry with alpha < 0.5 is cut out), the
 *   Gouraud light, the per-vertex fog, the 15-bit cut with the 4×4 dither at the 1× grid.
 *   `Ps1Opts` switches each trait (tests); the game passes `PS1_ON`.
 * - Static meshes: one vertex buffer (pos | uv | nrm | rgb) and one index buffer per mesh, uploaded
 *   once; per item one matrix and one CLUT row uniform. No allocation per frame (the key arrays grow
 *   only when a draw list gets longer than ever before). A `Mesh3.dynamic` mesh (additive: the glitch
 *   fold's batched tiles) sends its `pos` and `uv` again on `updateMesh(id)` (`bufferSubData`, its
 *   bounding sphere refitted; no allocation).
 * - Robustness: `webglcontextlost` / `webglcontextrestored` (the CPU copies of every mesh and page
 *   are kept and uploaded again; `ok` is false while lost, `reason` says why); no exception leaves
 *   `render` (it returns null; 60 failures in a row set `ok` false with the reason).
 * - The density cap (`setCap`, the 3D governor in main.ts) and the device limit (`maxDensity`)
 *   clamp `setDensity`.
 * - An optional `bias` on a mesh (`Mesh3.bias`, 0..16; in the contract since the wave-A
 *   integration): a depth bias (`polygonOffset(−bias, −bias)`) that keeps a mesh in front of a
 *   coplanar one (the road over the ground, lane lines, decals): the vertex snap tilts big polygons
 *   by up to half a 1× pixel, which at a grazing angle is metres of depth.
 *
 * Hard Rule 3: GPU code only here (a `*.browser.ts` file), created by main.ts (`createGl3d`) and
 * injected through `AppOptions.view3d`.
 */
import { mat4Identity, mat4Multiply, mat4Perspective, mat4View } from './r3/mat';
import { PS1_AFFINE_NEAR, PS1_FS, PS1_UNIFORMS, PS1_VS, SKY_FS, SKY_UNIFORMS, SKY_VS, sortKeys, type Ps1Uniform, type SkyUniform } from './r3/ps1';
import { VIEW3D_H, VIEW3D_W, type Blend3, type Mesh3, type Ps1Opts, type TexturePage, type View3, type View3d, type View3dStats } from './view3d';

/** The numbers of the last frame (`stats()`), a superset of `View3dStats`. */
export interface Gl3dStats extends View3dStats {
  /** The average interval between the last 3D frames (ms; a rAF interval; 0 until two frames). */
  frameMs: number;
  /** The CPU time of the last `render` (ms). */
  cpuMs: number;
  /** Views drawn, items culled by the frustum test, items whose mesh or page is not uploaded. */
  views: number;
  culled: number;
  missing: number;
  /** The density cap (the 3D governor) and the device's highest density. */
  cap: 1 | 2 | 4;
  maxDensity: 1 | 2 | 4;
  lost: boolean;
  /** Frames drawn so far. */
  frames: number;
}

/** The browser's 3D view: `View3d` plus the governor's cap and a few debug members. */
export interface Gl3dView extends View3d {
  /** Frames drawn so far (main.ts samples the governor on a change). */
  readonly frames: number;
  /** The highest density `setDensity` may use (the 3D governor lowers it; 4 by default). */
  readonly cap: 1 | 2 | 4;
  setCap(d: 1 | 2 | 4): void;
  /** The highest density the device can draw (its viewport and renderbuffer limits). */
  readonly maxDensity: 1 | 2 | 4;
  /** The canvas (tests: pixels, `WEBGL_lose_context`); null before the first use or without WebGL2. */
  readonly canvas: HTMLCanvasElement | null;
  /**
   * A debug override of the traits (tools/shot3d.ts `--ps1` on the game, the console): each field
   * set here wins over the `Ps1Opts` the scene passes; null = none (the game never sets it).
   */
  ps1Override: Partial<Ps1Opts> | null;
  /** The near limit of the affine warp (m; `PS1_AFFINE_NEAR`; 0 = the pure trait). Tuning and tests. */
  affineNear: number;
  stats(): Gl3dStats;
}

interface GlMesh {
  readonly src: Mesh3;
  readonly vao: WebGLVertexArrayObject;
  readonly vbo: WebGLBuffer;
  readonly ibo: WebGLBuffer;
  readonly count: number;
  readonly type: number;
  readonly bytes: number;
  /** The page's sort slot (opaque batching). */
  readonly slot: number;
  /** The depth bias (`Mesh3.bias`, optional; 0 = none). */
  readonly bias: number;
  /** The bounding sphere in model space (a dynamic mesh refits it on `updateMesh`). */
  cx: number;
  cy: number;
  cz: number;
  r: number;
}

interface GlPage {
  readonly src: TexturePage;
  readonly index: WebGLTexture;
  readonly clut: WebGLTexture;
  readonly rows: number;
  readonly bytes: number;
}

type Locs<K extends string> = Record<K, WebGLUniformLocation | null>;

const IDENTITY = mat4Identity(new Float32Array(16));
/** Item index bits of a sort key (65,536 items per view at most). */
const ITEM = 65536;
/** Frames in the interval average. */
const AVG_N = 60;
/** A gap above this (ms) is not a frame interval (a pause, a hidden tab). */
const GAP_MS = 250;
/** `render` failures in a row before the view gives up (`ok` false). */
const MAX_FAILS = 60;

/** The WebGL2 view. */
class Gl3d implements Gl3dView {
  private _canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private sky: WebGLProgram | null = null;
  private emptyVao: WebGLVertexArrayObject | null = null;
  private u: Locs<Ps1Uniform> | null = null;
  private us: Locs<SkyUniform> | null = null;
  private tried = false;
  private lost = false;
  private disposed = false;
  private _ok = false;
  private _reason = 'not started';
  private _density: 1 | 2 | 4 = 1;
  private _cap: 1 | 2 | 4 = 4;
  private _maxD: 1 | 2 | 4 = 4;
  private _frames = 0;
  private fails = 0;
  ps1Override: Partial<Ps1Opts> | null = null;
  affineNear = PS1_AFFINE_NEAR;
  private readonly opts: Ps1Opts = { snap: true, affine: true, dither: true, fog: true };
  /** The CPU copies (kept for a context restore). */
  private readonly cpuMeshes = new Map<string, Mesh3>();
  private readonly cpuPages = new Map<number, TexturePage>();
  /** The GPU objects. */
  private readonly meshes = new Map<string, GlMesh>();
  private readonly pages = new Map<number, GlPage>();
  /** Page id → sort slot (stable for the session). */
  private readonly slots = new Map<number, number>();
  private readonly proj = new Float32Array(16);
  private readonly view = new Float32Array(16);
  private readonly viewProj = new Float32Array(16);
  private readonly camRot = new Float32Array(9);
  private opaqueKeys = new Float64Array(1024);
  private blendKeys = new Float64Array(256);
  private itemMesh: (GlMesh | null)[] = [];
  private readonly intervals = new Float32Array(AVG_N);
  private nIntervals = 0;
  private sumIntervals = 0;
  private lastAt = -1;
  private texBytes = 0;
  private bufBytes = 0;
  /** The last frame's numbers (mutated in place). */
  private readonly last: Gl3dStats = { tris: 0, draws: 0, texBytes: 0, bufBytes: 0, frameMs: 0, cpuMs: 0, views: 0, culled: 0, missing: 0, cap: 4, maxDensity: 4, lost: false, frames: 0 };
  /** Uniform caches of the current frame (reset per view). */
  private curPage = -1;
  private curRows = 1;
  private curRow = -1;
  private curLit = -1;
  private curNrm = -1;
  private curTwo = -1;
  private curBias = 0;
  private curBlend: Blend3 | '' = '';

  get ok(): boolean {
    this.init();
    return this._ok && !this.isLost();
  }

  get reason(): string {
    this.init();
    if (this._ok && this.isLost()) return 'the WebGL context is lost';
    return this._ok ? '' : this._reason;
  }

  get density(): number {
    return this._density;
  }

  get frames(): number {
    return this._frames;
  }

  get cap(): 1 | 2 | 4 {
    return this._cap;
  }

  get maxDensity(): 1 | 2 | 4 {
    return this._maxD;
  }

  get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  private isLost(): boolean {
    return this.lost || (this.gl !== null && this.gl.isContextLost());
  }

  /** Create the context and the programs once (the feature check). */
  private init(): void {
    if (this.tried || this.disposed) return;
    this.tried = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = VIEW3D_W * this._density;
      canvas.height = VIEW3D_H * this._density;
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
        alpha: false,
        depth: true,
        stencil: false,
        premultipliedAlpha: false,
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
      if (!this.build()) return;
      this._ok = true;
      this._reason = '';
    } catch (err) {
      this._ok = false;
      this._reason = `WebGL2 failed: ${message(err)}`;
    }
  }

  /** The limits the view needs ('' = fine); sets `maxDensity`. */
  private limits(gl: WebGL2RenderingContext): string {
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const units = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number;
    const attribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) as number;
    const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
    const rb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!(maxTex >= 256)) return `texture size ${maxTex} < 256`;
    if (!(units >= 2)) return `texture units ${units} < 2`;
    if (!(attribs >= 4)) return `vertex attributes ${attribs} < 4`;
    if (!hp || hp.precision < 16) return 'no highp float in the fragment shader';
    const vw = vp ? Math.min(vp[0], rb) : rb;
    const vh = vp ? Math.min(vp[1], rb) : rb;
    if (vw < VIEW3D_W || vh < VIEW3D_H) return `viewport limit ${vw}×${vh}`;
    this._maxD = vw >= VIEW3D_W * 4 && vh >= VIEW3D_H * 4 ? 4 : vw >= VIEW3D_W * 2 && vh >= VIEW3D_H * 2 ? 2 : 1;
    return '';
  }

  /** Compile and link both programs (false + the reason on failure). */
  private build(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const main = this.program(gl, PS1_VS, PS1_FS, 'the 3D shader');
    const sky = main ? this.program(gl, SKY_VS, SKY_FS, 'the sky pass') : null;
    if (!main || !sky) return false;
    this.prog = main;
    this.sky = sky;
    this.u = locs(gl, main, PS1_UNIFORMS);
    this.us = locs(gl, sky, SKY_UNIFORMS);
    this.emptyVao = gl.createVertexArray();
    gl.useProgram(main);
    gl.uniform1i(this.u.uIndex, 0);
    gl.uniform1i(this.u.uClut, 1);
    gl.useProgram(null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    return true;
  }

  private program(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string, name: string): WebGLProgram | null {
    const sh = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) {
        this._reason = `${name}: no shader`;
        return null;
      }
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        this._reason = `${name}: ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${gl.getShaderInfoLog(s) ?? 'compile failed'}`;
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, vsSrc);
    const fs = vs ? sh(gl.FRAGMENT_SHADER, fsSrc) : null;
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    if (!p) {
      this._reason = `${name}: no program`;
      return null;
    }
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      this._reason = `${name}: link: ${gl.getProgramInfoLog(p) ?? 'failed'}`;
      return null;
    }
    return p;
  }

  /** The context is gone: forget every GPU object (the CPU copies stay). */
  private dropGpu(): void {
    this.meshes.clear();
    this.pages.clear();
    this.prog = null;
    this.sky = null;
    this.emptyVao = null;
    this.u = null;
    this.us = null;
    this.texBytes = 0;
    this.bufBytes = 0;
  }

  /** After a context loss: the programs and every upload again (from the CPU copies). */
  private restore(): void {
    if (this.disposed || !this.gl) return;
    this.dropGpu();
    try {
      this._ok = this.build();
      if (this._ok) {
        this._reason = '';
        this.fails = 0;
        const gl = this.gl;
        for (const p of this.cpuPages.values()) this.uploadPage(gl, p);
        for (const m of this.cpuMeshes.values()) this.uploadMesh(gl, m);
      }
    } catch (err) {
      this._ok = false;
      this._reason = `restore failed: ${message(err)}`;
    }
  }

  setCap(d: 1 | 2 | 4): void {
    this._cap = d;
    if (this._density > d) this.setDensity(d);
  }

  setDensity(d: 1 | 2 | 4): void {
    this.init();
    const want = Math.max(1, Math.min(d, this._cap, this._maxD)) as 1 | 2 | 4;
    this._density = want;
    const c = this._canvas;
    if (!c) return;
    const w = VIEW3D_W * want;
    const h = VIEW3D_H * want;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }

  upload(meshes: readonly Mesh3[], pages: readonly TexturePage[]): void {
    this.init();
    for (const p of pages) this.cpuPages.set(p.id, p);
    for (const m of meshes) this.cpuMeshes.set(m.id, m);
    const gl = this.gl;
    if (!gl || !this._ok || this.isLost() || !this.prog) return;
    try {
      for (const p of pages) this.uploadPage(gl, p);
      for (const m of meshes) this.uploadMesh(gl, m);
    } catch (err) {
      console.warn(`[gl3d] upload failed: ${message(err)}`);
    }
  }

  private slotOf(pageId: number): number {
    let s = this.slots.get(pageId);
    if (s === undefined) {
      s = this.slots.size;
      this.slots.set(pageId, s);
    }
    return s;
  }

  private uploadPage(gl: WebGL2RenderingContext, p: TexturePage): void {
    this.dropPage(gl, p.id);
    if (!(p.w >= 1 && p.h >= 1 && p.w <= 4096 && p.h <= 4096) || p.index.length < p.w * p.h) {
      console.warn(`[gl3d] page ${p.id}: bad size ${p.w}×${p.h} (${p.index.length} texels)`);
      return;
    }
    const index = gl.createTexture();
    const clut = gl.createTexture();
    if (!index || !clut) return;
    gl.bindTexture(gl.TEXTURE_2D, index);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, p.w, p.h, 0, gl.RED, gl.UNSIGNED_BYTE, p.index.length === p.w * p.h ? p.index : p.index.subarray(0, p.w * p.h));
    nearest(gl);
    const rows = Math.max(1, Math.floor(p.clut.length / 256));
    const bytes = new Uint8Array(rows * 256 * 4);
    for (let i = 0; i < rows * 256; i++) {
      const c = p.clut[i] ?? 0;
      bytes[i * 4] = (c >>> 24) & 255;
      bytes[i * 4 + 1] = (c >>> 16) & 255;
      bytes[i * 4 + 2] = (c >>> 8) & 255;
      bytes[i * 4 + 3] = c & 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, clut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    nearest(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const size = p.w * p.h + rows * 256 * 4;
    this.pages.set(p.id, { src: p, index, clut, rows, bytes: size });
    this.texBytes += size;
    this.slotOf(p.id);
  }

  private uploadMesh(gl: WebGL2RenderingContext, m: Mesh3): void {
    this.dropMesh(gl, m.id);
    const n = Math.floor(m.pos.length / 3);
    const bad = checkMesh(m, n);
    if (bad) {
      console.warn(`[gl3d] mesh "${m.id}": ${bad}`);
      return;
    }
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) return;
    const posB = n * 12;
    const uvB = n * 8;
    const nrmB = m.nrm ? n * 12 : 0;
    const rgbB = n * 3;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, posB + uvB + nrmB + rgbB, m.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.pos, 0, n * 3);
    gl.bufferSubData(gl.ARRAY_BUFFER, posB, m.uv, 0, n * 2);
    if (m.nrm) gl.bufferSubData(gl.ARRAY_BUFFER, posB + uvB, m.nrm, 0, n * 3);
    gl.bufferSubData(gl.ARRAY_BUFFER, posB + uvB + nrmB, m.rgb, 0, n * 3);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, posB);
    if (m.nrm) {
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, posB + uvB);
    } else {
      gl.disableVertexAttribArray(3);
      gl.vertexAttrib3f(3, 0, 1, 0);
    }
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.UNSIGNED_BYTE, true, 0, posB + uvB + nrmB);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    // The bounding sphere (the box centre, the farthest vertex).
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    const p = m.pos;
    for (let i = 0; i < n * 3; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    const cx = n > 0 ? (x0 + x1) / 2 : 0, cy = n > 0 ? (y0 + y1) / 2 : 0, cz = n > 0 ? (z0 + z1) / 2 : 0;
    let r2 = 0;
    for (let i = 0; i < n * 3; i += 3) {
      const dx = p[i] - cx, dy = p[i + 1] - cy, dz = p[i + 2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) r2 = d2;
    }
    const bytes = posB + uvB + nrmB + rgbB + m.idx.byteLength;
    const type = m.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const bias = Math.max(0, Math.min(16, Number(m.bias) || 0));
    this.meshes.set(m.id, { src: m, vao, vbo, ibo, count: m.idx.length - (m.idx.length % 3), type, bytes, slot: this.slotOf(m.page), bias, cx, cy, cz, r: Math.sqrt(r2) * 1.0001 + 1e-3 });
    this.bufBytes += bytes;
  }

  updateMesh(id: string): void {
    const gl = this.gl;
    if (!gl || !this._ok || this.isLost()) return;
    const gm = this.meshes.get(id);
    if (!gm) return;
    const m = gm.src;
    const n = Math.floor(m.pos.length / 3);
    try {
      gl.bindBuffer(gl.ARRAY_BUFFER, gm.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.pos, 0, n * 3);
      gl.bufferSubData(gl.ARRAY_BUFFER, n * 12, m.uv, 0, n * 2);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    } catch (err) {
      console.warn(`[gl3d] updateMesh "${id}" failed: ${message(err)}`);
      return;
    }
    // Refit the bounding sphere (the box centre, the farthest vertex).
    const p = m.pos;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n * 3; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    const cx = n > 0 ? (x0 + x1) / 2 : 0, cy = n > 0 ? (y0 + y1) / 2 : 0, cz = n > 0 ? (z0 + z1) / 2 : 0;
    let r2 = 0;
    for (let i = 0; i < n * 3; i += 3) {
      const dx = p[i] - cx, dy = p[i + 1] - cy, dz = p[i + 2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) r2 = d2;
    }
    gm.cx = cx;
    gm.cy = cy;
    gm.cz = cz;
    gm.r = Math.sqrt(r2) * 1.0001 + 1e-3;
  }

  private dropMesh(gl: WebGL2RenderingContext, id: string): void {
    const old = this.meshes.get(id);
    if (!old) return;
    gl.deleteVertexArray(old.vao);
    gl.deleteBuffer(old.vbo);
    gl.deleteBuffer(old.ibo);
    this.meshes.delete(id);
    this.bufBytes -= old.bytes;
  }

  private dropPage(gl: WebGL2RenderingContext, id: number): void {
    const old = this.pages.get(id);
    if (!old) return;
    gl.deleteTexture(old.index);
    gl.deleteTexture(old.clut);
    this.pages.delete(id);
    this.texBytes -= old.bytes;
  }

  release(meshIds?: readonly string[]): void {
    const gl = this.gl && !this.isLost() ? this.gl : null;
    if (meshIds) {
      for (const id of meshIds) {
        this.cpuMeshes.delete(id);
        if (gl) this.dropMesh(gl, id);
        else this.meshes.delete(id);
      }
      return;
    }
    this.cpuMeshes.clear();
    this.cpuPages.clear();
    if (gl) {
      for (const id of [...this.meshes.keys()]) this.dropMesh(gl, id);
      for (const id of [...this.pages.keys()]) this.dropPage(gl, id);
    }
    this.meshes.clear();
    this.pages.clear();
    this.texBytes = 0;
    this.bufBytes = 0;
  }

  render(views: readonly View3[], opts: Ps1Opts): unknown {
    const t0 = performance.now();
    let out: unknown = null;
    try {
      out = this.draw(views, opts, t0);
      if (out) this.fails = 0;
    } catch (err) {
      out = null;
      this.fails++;
      if (this.fails === 1) console.warn(`[gl3d] render failed: ${message(err)}`);
      if (this.fails >= MAX_FAILS && this._ok) {
        this._ok = false;
        this._reason = `render failed: ${message(err)}`;
      }
      try {
        this.gl?.bindVertexArray(null);
      } catch {
        // the context may be gone
      }
    }
    this.last.cpuMs = performance.now() - t0;
    return out;
  }

  private draw(views: readonly View3[], given: Ps1Opts, t0: number): unknown {
    this.init();
    const ov = this.ps1Override;
    const opts = ov ? this.opts : given;
    if (ov) {
      opts.snap = ov.snap ?? given.snap;
      opts.affine = ov.affine ?? given.affine;
      opts.dither = ov.dither ?? given.dither;
      opts.fog = ov.fog ?? given.fog;
    }
    const gl = this.gl;
    const u = this.u;
    const us = this.us;
    const canvas = this._canvas;
    if (!gl || !u || !us || !canvas || !this._ok || !this.prog || !this.sky || this.isLost()) return null;
    // The frame interval (a rAF interval while the scene draws every frame).
    if (this.lastAt >= 0) {
      const dt = t0 - this.lastAt;
      if (dt > 0 && dt <= GAP_MS) {
        const slot = this.nIntervals % AVG_N;
        if (this.nIntervals >= AVG_N) this.sumIntervals -= this.intervals[slot];
        this.intervals[slot] = dt;
        this.sumIntervals += dt;
        this.nIntervals++;
      }
    }
    this.lastAt = t0;
    const d = this._density;
    const H = VIEW3D_H * d;
    if (canvas.height !== H || canvas.width !== VIEW3D_W * d) this.setDensity(d);
    let tris = 0;
    let draws = 0;
    let culled = 0;
    let missing = 0;
    let nViews = 0;
    gl.enable(gl.SCISSOR_TEST);
    for (let vi = 0; vi < views.length; vi++) {
      const v = views[vi];
      const x = Math.round(v.x * d);
      const y = H - Math.round((v.y + v.h) * d);
      const w = Math.round(v.w * d);
      const h = Math.round(v.h * d);
      if (w <= 0 || h <= 0) continue;
      nViews++;
      gl.viewport(x, y, w, h);
      gl.scissor(x, y, w, h);
      const L = v.light;
      const cam = v.cam;
      gl.clearColor(L.skyBottom[0], L.skyBottom[1], L.skyBottom[2], 1);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspect = v.w / v.h;
      mat4Perspective(this.proj, cam.fovY, aspect, cam.near, cam.far);
      mat4View(this.view, cam);
      mat4Multiply(this.viewProj, this.proj, this.view);
      const V = this.view;
      const ty = Math.tan(cam.fovY / 2);
      const tx = ty * aspect;
      // The sky pass.
      gl.useProgram(this.sky);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(false);
      const R = this.camRot;
      R[0] = V[0]; R[1] = V[4]; R[2] = V[8];
      R[3] = V[1]; R[4] = V[5]; R[5] = V[9];
      R[6] = V[2]; R[7] = V[6]; R[8] = V[10];
      gl.uniformMatrix3fv(us.uCamRot, false, R);
      gl.uniform4f(us.uVp, x, y, w, h);
      gl.uniform2f(us.uTan, tx, ty);
      gl.uniform3f(us.uTop, L.skyTop[0], L.skyTop[1], L.skyTop[2]);
      gl.uniform3f(us.uBottom, L.skyBottom[0], L.skyBottom[1], L.skyBottom[2]);
      gl.uniform1f(us.uDensity, d);
      gl.uniform1f(us.uDither, opts.dither ? 1 : 0);
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // The geometry.
      gl.useProgram(this.prog);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
      gl.uniform3f(u.uSunDir, L.sunDir[0], L.sunDir[1], L.sunDir[2]);
      gl.uniform3f(u.uSun, L.sun[0], L.sun[1], L.sun[2]);
      gl.uniform3f(u.uAmbient, L.ambient[0], L.ambient[1], L.ambient[2]);
      gl.uniform2f(u.uGrid, v.w, v.h);
      gl.uniform1f(u.uSnap, opts.snap ? 1 : 0);
      gl.uniform1f(u.uAffine, opts.affine ? 1 : 0);
      gl.uniform1f(u.uAffineNear, Math.max(0, this.affineNear));
      const span = L.fogFar - L.fogNear;
      gl.uniform3f(u.uFog, L.fogNear, span > 1e-6 ? 1 / span : 1e6, opts.fog ? 1 : 0);
      gl.uniform3f(u.uFogCol, L.fog[0], L.fog[1], L.fog[2]);
      gl.uniform1f(u.uDensity, d);
      gl.uniform1f(u.uDither, opts.dither ? 1 : 0);
      this.resetCaches();
      // Cull and sort the draw list.
      const items = v.items;
      const n = Math.min(items.length, ITEM);
      if (this.itemMesh.length < n) this.itemMesh.length = n;
      if (this.opaqueKeys.length < n) this.opaqueKeys = new Float64Array(Math.max(n, this.opaqueKeys.length * 2));
      if (this.blendKeys.length < n) this.blendKeys = new Float64Array(Math.max(n, this.blendKeys.length * 2));
      const opq = this.opaqueKeys;
      const bk = this.blendKeys;
      const kx = 1 / Math.sqrt(1 + tx * tx);
      const ky = 1 / Math.sqrt(1 + ty * ty);
      let no = 0;
      let nb = 0;
      for (let i = 0; i < n; i++) {
        const it = items[i];
        const gm = this.meshes.get(it.mesh);
        this.itemMesh[i] = null;
        if (!gm) {
          missing++;
          continue;
        }
        const m = it.m;
        let cx = gm.cx, cy = gm.cy, cz = gm.cz, r = gm.r;
        if (m) {
          const wx = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
          const wy = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
          const wz = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
          const s0 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
          const s1 = m[4] * m[4] + m[5] * m[5] + m[6] * m[6];
          const s2 = m[8] * m[8] + m[9] * m[9] + m[10] * m[10];
          r *= Math.sqrt(Math.max(s0, s1, s2));
          cx = wx;
          cy = wy;
          cz = wz;
        }
        const vx = V[0] * cx + V[4] * cy + V[8] * cz + V[12];
        const vy = V[1] * cx + V[5] * cy + V[9] * cz + V[13];
        const depth = -(V[2] * cx + V[6] * cy + V[10] * cz + V[14]);
        if (depth + r < cam.near || depth - r > cam.far || (vx - tx * depth) * kx > r || (-vx - tx * depth) * kx > r || (vy - ty * depth) * ky > r || (-vy - ty * depth) * ky > r) {
          culled++;
          continue;
        }
        this.itemMesh[i] = gm;
        if (gm.src.blend === 'opaque') opq[no++] = (gm.slot * 2 + (gm.src.twoSided ? 1 : 0)) * ITEM + i;
        else bk[nb++] = (ITEM - 1 - Math.min(ITEM - 1, Math.max(0, Math.floor(depth * 16)))) * ITEM + i;
      }
      sortKeys(opq, no);
      sortKeys(bk, nb);
      for (let pass = 0; pass < 2; pass++) {
        const keys = pass === 0 ? opq : bk;
        const count = pass === 0 ? no : nb;
        if (pass === 0) this.setBlend(gl, 'opaque');
        for (let k = 0; k < count; k++) {
          const i = keys[k] % ITEM;
          const gm = this.itemMesh[i];
          if (!gm) continue;
          const src = gm.src;
          if (src.page !== this.curPage) {
            const pg = this.pages.get(src.page);
            if (!pg) {
              missing++;
              continue;
            }
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pg.index);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, pg.clut);
            gl.uniform2f(u.uPage, pg.src.w, pg.src.h);
            this.curPage = src.page;
            this.curRows = pg.rows;
            this.curRow = -1;
          }
          const it = items[i];
          const row = Math.max(0, Math.min(this.curRows - 1, it.clutRow ?? src.clutRow));
          if (row !== this.curRow) {
            gl.uniform1i(u.uRow, row);
            this.curRow = row;
          }
          const lit = src.emissive ? 0 : 1;
          if (lit !== this.curLit) {
            gl.uniform1f(u.uLit, lit);
            this.curLit = lit;
          }
          const nrm = src.nrm ? 1 : 0;
          if (nrm !== this.curNrm) {
            gl.uniform1f(u.uHasNrm, nrm);
            this.curNrm = nrm;
          }
          const two = src.twoSided ? 1 : 0;
          if (two !== this.curTwo) {
            if (two) gl.disable(gl.CULL_FACE);
            else gl.enable(gl.CULL_FACE);
            this.curTwo = two;
          }
          if (gm.bias !== this.curBias) {
            if (gm.bias > 0) {
              gl.enable(gl.POLYGON_OFFSET_FILL);
              gl.polygonOffset(-gm.bias, -gm.bias);
            } else gl.disable(gl.POLYGON_OFFSET_FILL);
            this.curBias = gm.bias;
          }
          if (pass === 1 && src.blend !== this.curBlend) this.setBlend(gl, src.blend);
          gl.uniformMatrix4fv(u.uModel, false, it.m ?? IDENTITY);
          gl.bindVertexArray(gm.vao);
          gl.drawElements(gl.TRIANGLES, gm.count, gm.type, 0);
          tris += gm.count / 3;
          draws++;
        }
      }
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    this._frames++;
    const st = this.last;
    st.tris = tris;
    st.draws = draws;
    st.culled = culled;
    st.missing = missing;
    st.views = nViews;
    st.texBytes = this.texBytes;
    st.bufBytes = this.bufBytes;
    st.frameMs = this.nIntervals > 0 ? this.sumIntervals / Math.min(this.nIntervals, AVG_N) : 0;
    st.frames = this._frames;
    return canvas;
  }

  /** Forget the uniform and state caches (a new view: the sky pass ran in between). */
  private resetCaches(): void {
    this.curPage = -1;
    this.curRows = 1;
    this.curRow = -1;
    this.curLit = -1;
    this.curNrm = -1;
    this.curTwo = -1;
    this.curBias = 0;
    this.curBlend = '';
  }

  /** The blend modes of the era: opaque, average (B/2 + F/2), add (B + F), sub (B − F), quarter (B + F/4). */
  private setBlend(gl: WebGL2RenderingContext, b: Blend3): void {
    this.curBlend = b;
    if (b === 'opaque') {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      return;
    }
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (b === 'average') {
      gl.blendColor(0.5, 0.5, 0.5, 0.5);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    } else if (b === 'add') {
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else if (b === 'sub') {
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      gl.blendColor(0.25, 0.25, 0.25, 0.25);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE);
    }
  }

  stats(): Gl3dStats {
    const st = this.last;
    st.cap = this._cap;
    st.maxDensity = this._maxD;
    st.lost = this.isLost();
    st.texBytes = this.texBytes;
    st.bufBytes = this.bufBytes;
    return st;
  }

  dispose(): void {
    this.release();
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

function locs<K extends string>(gl: WebGL2RenderingContext, p: WebGLProgram, names: readonly K[]): Locs<K> {
  const out = {} as Locs<K>;
  for (const n of names) out[n] = gl.getUniformLocation(p, n);
  return out;
}

function nearest(gl: WebGL2RenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** A mesh the GPU cannot draw ('' = fine): the lengths of its arrays and its index range. */
function checkMesh(m: Mesh3, n: number): string {
  if (m.pos.length !== n * 3) return `pos has ${m.pos.length} floats (not a multiple of 3)`;
  if (m.uv.length < n * 2) return `uv has ${m.uv.length} floats for ${n} vertices`;
  if (m.rgb.length < n * 3) return `rgb has ${m.rgb.length} bytes for ${n} vertices`;
  if (m.nrm && m.nrm.length < n * 3) return `nrm has ${m.nrm.length} floats for ${n} vertices`;
  if (m.idx instanceof Uint16Array && n > 65536) return `${n} vertices with 16-bit indices`;
  const idx = m.idx;
  for (let i = 0; i < idx.length; i++) if (idx[i] >= n) return `index ${idx[i]} at ${i} ≥ ${n} vertices`;
  return '';
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The browser's 3D view (main.ts → `AppOptions.view3d`). The context is created on first use. */
export function createGl3d(): Gl3dView {
  return new Gl3d();
}
