/**
 * Browser bundle for tests/media/browser-floor.test.ts (and the GL floor's look and perf scripts):
 * the real WebGL2 floor (src/engine/gl-floor.browser.ts) fed with FRAME SNAPSHOTS made in node — the
 * mesh, the materials, the frame's numbers and exactly the textures the frame was handed — so the
 * GL picture can be held against the CPU raster's picture of the very same frame (spec §3.3). The
 * bundle needs no content: node builds the section floors (debug floor or the kits') and sends them.
 * Built with Vite into an IIFE and run in headless Chromium (SwiftShader without `--gpu`). Exposes
 * `window.FloorTest`.
 */
import type { FloorCam } from '../../../src/engine/floor/cam';
import type { FloorFrame, FloorMaterial } from '../../../src/engine/floor/gpu';
import type { FloorMesh } from '../../../src/engine/floor/mesh';
import type { FloorTexture } from '../../../src/engine/floor/tex';
import { createGlFloor, type GlFloor, type GlFloorStats } from '../../../src/engine/gl-floor.browser';
import { PixelBuffer } from '../../../src/engine/pixel';

/** A texture as node sends it (levels as base64 of their 0xRRGGBBAA words, little-endian). */
export interface SnapTex {
  key: string;
  kind: 'chunk' | 'tile';
  density: number;
  u0: number;
  w: number;
  h: number;
  levels: { w: number; h: number; data: string }[];
}

/** A mesh as node sends it (typed arrays as base64). */
export interface SnapMesh {
  id: number;
  vertexCount: number;
  quadCount: number;
  pu: string;
  pv: string;
  ph: string;
  ta: string;
  tb: string;
  quads: string;
  quadMat: string;
  quadKind: string;
  quadChunk: string;
  quadU0: string;
  quadU1: string;
  hMin: number;
  hMax: number;
  uMin: number;
  uMax: number;
  vBack: number;
  vFront: number;
}

/** One frame of a floor: everything `FloorGpu.render` reads. */
export interface Snap {
  cam: FloorCam;
  mesh: SnapMesh;
  materials: FloorMaterial[];
  camX: number;
  camY: number;
  eyeU: number;
  tick: number;
  density: number;
  bandTop: number;
  bandH: number;
  q0: number;
  q1: number;
  storeVersion: number;
  chunks: Record<string, SnapTex>;
  tiles: Record<string, SnapTex>;
}

export interface FloorShot {
  w: number;
  h: number;
  /** RGBA bytes, top-down, base64. */
  rgba: string;
  stats: GlFloorStats;
  /** `render` returned null. */
  none: boolean;
  /** An exception left `render` (must stay ''). */
  threw: string;
}

function bytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function base64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

const f32 = (s: string): Float32Array => new Float32Array(bytes(s).buffer);
const u32 = (s: string): Uint32Array => new Uint32Array(bytes(s).buffer);

function texOf(t: SnapTex): FloorTexture {
  const levels = t.levels.map((l) => {
    const b = new PixelBuffer(l.w, l.h);
    b.data.set(u32(l.data));
    return b.touch();
  });
  return { key: t.key, kind: t.kind, density: t.density, levels, u0: t.u0, w: t.w, h: t.h };
}

/** Decoded meshes by id (a floor's mesh is sent once). */
const meshes = new Map<number, FloorMesh>();

function meshOf(m: SnapMesh): FloorMesh {
  let out = meshes.get(m.id);
  if (out) return out;
  out = {
    id: m.id,
    vertexCount: m.vertexCount,
    quadCount: m.quadCount,
    pu: f32(m.pu),
    pv: f32(m.pv),
    ph: f32(m.ph),
    ta: f32(m.ta),
    tb: f32(m.tb),
    quads: u32(m.quads),
    quadMat: new Int16Array(bytes(m.quadMat).buffer),
    quadKind: bytes(m.quadKind),
    quadChunk: new Int32Array(bytes(m.quadChunk).buffer),
    quadU0: f32(m.quadU0),
    quadU1: f32(m.quadU1),
    hMin: m.hMin,
    hMax: m.hMax,
    uMin: m.uMin,
    uMax: m.uMax,
    vBack: m.vBack,
    vFront: m.vFront,
  };
  meshes.set(m.id, out);
  return out;
}

/** A FloorFrame from a snapshot (textures decoded once per key). */
const texCache = new Map<string, FloorTexture>();

function frameOf(s: Snap): FloorFrame {
  const tex = (t: SnapTex | undefined): FloorTexture | null => {
    if (!t) return null;
    const key = `${s.mesh.id}/${t.key}`;
    let x = texCache.get(key);
    if (!x) {
      x = texOf(t);
      texCache.set(key, x);
    }
    return x;
  };
  return {
    cam: s.cam,
    mesh: meshOf(s.mesh),
    materials: s.materials,
    camX: s.camX,
    camY: s.camY,
    eyeU: s.eyeU,
    tick: s.tick,
    density: s.density,
    bandTop: s.bandTop,
    bandH: s.bandH,
    q0: s.q0,
    q1: s.q1,
    storeVersion: s.storeVersion,
    chunk: (k) => tex(s.chunks[String(k)]),
    tile: (i) => tex(s.tiles[String(i)]),
  };
}

/** The output res of the next shots (0 = the frame's density). */
let res = 0;
const gl: GlFloor = createGlFloor({ res: () => res });
const frames: FloorFrame[] = [];

function shotOf(g: GlFloor, fr: FloorFrame): FloorShot {
  let out: unknown = null;
  let threw = '';
  try {
    out = g.render(fr);
  } catch (err) {
    threw = String(err);
  }
  const band = out ? g.readBand() : null;
  return { w: band?.w ?? 0, h: band?.h ?? 0, rgba: band ? base64(band.rgba) : '', stats: { ...g.stats() }, none: out === null, threw };
}

/**
 * Is clear pixel (x, y) a notch of the band's outline (not a hole)? One of its four neighbours is
 * clear and opens on into a clear area at least 2 px wide across it (a crack is 1 px wide: its
 * pixels lead only into each other).
 */
function notch(rgba: Uint8Array, w: number, x: number, y: number): boolean {
  const clear = (cx: number, cy: number): boolean => rgba[(cy * w + cx) * 4 + 3] !== 255;
  const h = rgba.length / 4 / w;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1 || !clear(nx, ny)) continue;
    // Across the step: a vertical step looks left and right, a horizontal one up and down.
    if (dy !== 0 ? clear(nx - 1, ny) || clear(nx + 1, ny) : clear(nx, ny - 1) || clear(nx, ny + 1)) return true;
  }
  return false;
}

const FloorTest = {
  info(): { ok: boolean; reason: string } {
    return { ok: gl.ok, reason: gl.reason };
  },
  /** Decode a snapshot; returns its frame id. */
  load(s: Snap): number {
    frames.push(frameOf(s));
    return frames.length - 1;
  },
  /** Render frame `id` (`r`: the output res, 0 = its density). */
  shot(id: number, r = 0): FloorShot {
    res = r;
    return shotOf(gl, frames[id]);
  },
  /** Render frame `id` `n` times; the CPU ms of each `render` (the GL floor's own clock). */
  bench(id: number, n: number, r = 0): number[] {
    res = r;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      gl.render(frames[id]);
      out.push(gl.stats().cpuMs);
    }
    return out;
  },
  /** Wall time per frame (ms) of `n` renders of frame `id` and one read back (the GPU's throughput). */
  wall(id: number, n: number, r = 0): number {
    res = r;
    gl.render(frames[id]);
    gl.readBand();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) gl.render(frames[id]);
    gl.readBand();
    return (performance.now() - t0) / n;
  },
  /** Lose the context (WEBGL_lose_context), then try to draw frame `id`. */
  async lose(id: number): Promise<{ ok: boolean; reason: string; drew: boolean; threw: string }> {
    const c = gl.canvas;
    const ext = c ? (c.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context') : null;
    if (!ext) return { ok: gl.ok, reason: 'no WEBGL_lose_context', drew: true, threw: '' };
    (window as unknown as { __loseExt?: WEBGL_lose_context }).__loseExt = ext;
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 50));
    const s = shotOf(gl, frames[id]);
    return { ok: gl.ok, reason: gl.reason, drew: !s.none, threw: s.threw };
  },
  async restore(): Promise<{ ok: boolean; reason: string }> {
    const ext = (window as unknown as { __loseExt?: WEBGL_lose_context }).__loseExt;
    ext?.restoreContext();
    for (let i = 0; i < 50 && !gl.ok; i++) await new Promise((r) => setTimeout(r, 20));
    return { ok: gl.ok, reason: gl.reason };
  },
  /** Render frame `id` at res `r` (drawn again while stand-ins are resident); its stats only. */
  stats(id: number, r = 0): GlFloorStats & { none: boolean } {
    res = r;
    let out: unknown = gl.render(frames[id]);
    for (let i = 0; i < 8 && gl.stats().standIns > 0; i++) out = gl.render(frames[id]);
    return { ...gl.stats(), none: out === null };
  },
  /**
   * Render frame `id` at res `r` (drawn again while stand-ins are resident) and count its CRACK
   * pixels in the page: a pixel with alpha < 255 whose two neighbours left and right, or above and
   * below, are opaque (a hole inside the floor's coverage). `first`: up to 8 of them (x, y). A notch
   * in the band's outline is no hole: a pixel whose neighbour opens into a wide clear area (oat-a's
   * back edge where the raised pavement meets a bridge deck 2 px lower: the corner pixel between the
   * two edges) is skipped; a seam crack's pixels open only into each other.
   */
  cracks(id: number, r = 0): { w: number; h: number; cracks: number; first: number[]; standIns: number; none: boolean } {
    res = r;
    let out: unknown = gl.render(frames[id]);
    for (let i = 0; i < 8 && gl.stats().standIns > 0; i++) out = gl.render(frames[id]);
    const band = out ? gl.readBand() : null;
    if (!band) return { w: 0, h: 0, cracks: 0, first: [], standIns: gl.stats().standIns, none: true };
    const { w, h, rgba } = band;
    let cracks = 0;
    const first: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x) * 4 + 3;
        if (rgba[p] === 255) continue;
        if (notch(rgba, w, x, y)) continue;
        if ((rgba[p - 4] === 255 && rgba[p + 4] === 255) || (rgba[p - w * 4] === 255 && rgba[p + w * 4] === 255)) {
          cracks++;
          if (first.length < 16) first.push(x, y);
        }
      }
    }
    return { w, h, cracks, first, standIns: gl.stats().standIns, none: false };
  },
  /** `?floorgl=0`: an off renderer draws nothing and makes no context. */
  off(id: number): { ok: boolean; reason: string; none: boolean; canvas: boolean; cpuCap: number } {
    const g = createGlFloor({ enabled: false });
    const s = shotOf(g, frames[id]);
    return { ok: g.ok, reason: g.reason, none: s.none, canvas: g.canvas !== null, cpuCap: g.cpuCap };
  },
};

export type FloorTestApi = typeof FloorTest;
(window as unknown as { FloorTest: FloorTestApi }).FloorTest = FloorTest;
