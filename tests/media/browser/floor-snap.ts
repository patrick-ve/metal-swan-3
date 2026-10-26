/**
 * The node side of the GL floor's browser checks (tests/media/browser-floor.test.ts and the GL
 * floor's look / perf scripts): one frame of a section floor captured as a snapshot for
 * `floor-entry.ts` (the mesh, the materials, the frame's numbers and exactly the textures the frame
 * was handed), the CPU raster's band of that same frame (the reference, docs/design/floor.md §3.3),
 * a plain `FloorFrame` to draw the frame again at another output density, and the comparison.
 */
import { Buffer } from 'node:buffer';
import type { FloorFrame, FloorGpu } from '../../../src/engine/floor/gpu';
import { FloorRaster } from '../../../src/engine/floor/raster';
import type { FloorTexture } from '../../../src/engine/floor/tex';
import { PixelBuffer } from '../../../src/engine/pixel';
import type { Renderer } from '../../../src/engine/render';
import type { SectionFloor } from '../../../src/game/mission/floor/section-floor';
import type { Snap, SnapMesh, SnapTex } from './floor-entry';

const b64 = (a: ArrayBufferView): string => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

function snapTex(t: FloorTexture): SnapTex {
  return { key: t.key, kind: t.kind, density: t.density, u0: t.u0, w: t.w, h: t.h, levels: t.levels.map((l) => ({ w: l.w, h: l.h, data: b64(l.data) })) };
}

const meshCache = new WeakMap<object, SnapMesh>();

function snapMesh(fr: FloorFrame): SnapMesh {
  const m = fr.mesh;
  let s = meshCache.get(m);
  if (!s) {
    s = {
      id: m.id,
      vertexCount: m.vertexCount,
      quadCount: m.quadCount,
      pu: b64(m.pu),
      pv: b64(m.pv),
      ph: b64(m.ph),
      ta: b64(m.ta),
      tb: b64(m.tb),
      quads: b64(m.quads),
      quadMat: b64(m.quadMat),
      quadKind: b64(m.quadKind),
      quadChunk: b64(m.quadChunk),
      quadU0: b64(m.quadU0),
      quadU1: b64(m.quadU1),
      hMin: m.hMin,
      hMax: m.hMax,
      uMin: m.uMin,
      uMax: m.uMax,
      vBack: m.vBack,
      vFront: m.vFront,
    };
    meshCache.set(m, s);
  }
  return s;
}

/** One captured frame. */
export interface Captured {
  snap: Snap;
  /** The CPU raster's band of this frame (a copy). */
  cpu: PixelBuffer;
  /** The frame as a plain object (`density` may be changed to draw it again: the textures stay). */
  frame: FloorFrame & { density: number };
}

/**
 * Capture the floor's frame at camera (camX, camY), tick and density d: `SectionFloor.drawBand`
 * through a GPU that records the frame and declines it, so the CPU raster then draws the very same
 * frame.
 */
export function captureFrame(floor: SectionFloor, camX: number, d: number, tick = 0, camY = 0): Captured {
  const got: { snap: Snap | null; frame: (FloorFrame & { density: number }) | null } = { snap: null, frame: null };
  const gpu: FloorGpu = {
    cpuCap: 4,
    render(fr: FloorFrame): null {
      const chunks = new Map<number, FloorTexture>();
      const tiles = new Map<number, FloorTexture>();
      const tile = (i: number): void => {
        if (tiles.has(i)) return;
        const t = fr.tile(i);
        if (t) tiles.set(i, t);
      };
      for (let q = fr.q0; q < fr.q1; q++) {
        const m = fr.mesh.quadMat[q];
        if (m < 0) {
          const k = fr.mesh.quadChunk[q];
          if (!chunks.has(k)) {
            const t = fr.chunk(k);
            if (t) chunks.set(k, t);
          }
        } else {
          const mat = fr.materials[m];
          if (!mat) continue;
          tile(mat.base.tile);
          if (mat.over && mat.over.alpha > 0) tile(mat.over.tile);
        }
      }
      const rec = (src: Map<number, FloorTexture>): Record<string, SnapTex> => Object.fromEntries([...src].map(([k, t]) => [String(k), snapTex(t)]));
      got.snap = {
        cam: { ...fr.cam },
        mesh: snapMesh(fr),
        materials: fr.materials.map((m) => ({ base: { ...m.base }, over: m.over ? { ...m.over } : null, animated: m.animated })),
        camX: fr.camX,
        camY: fr.camY,
        eyeU: fr.eyeU,
        tick: fr.tick,
        density: fr.density,
        bandTop: fr.bandTop,
        bandH: fr.bandH,
        q0: fr.q0,
        q1: fr.q1,
        storeVersion: fr.storeVersion,
        chunks: rec(chunks),
        tiles: rec(tiles),
      };
      got.frame = {
        cam: fr.cam,
        mesh: fr.mesh,
        materials: fr.materials,
        camX: fr.camX,
        camY: fr.camY,
        eyeU: fr.eyeU,
        tick: fr.tick,
        density: fr.density,
        bandTop: fr.bandTop,
        bandH: fr.bandH,
        q0: fr.q0,
        q1: fr.q1,
        storeVersion: fr.storeVersion,
        chunk: (k) => chunks.get(k) ?? null,
        tile: (i) => tiles.get(i) ?? null,
      };
      return null;
    },
  };
  const before = floor.gpu;
  floor.gpu = gpu;
  // drawBand reads the camera and hands the band to `surface` / `frame` (both ignored here).
  const r = { camX, camY, res: d, surface(): void {}, frame(): void {} } as unknown as Renderer;
  try {
    floor.drawBand(r, tick, d);
  } finally {
    floor.gpu = before;
  }
  const band = floor.raster.band;
  const { snap, frame } = got;
  if (!snap || !frame || !band) throw new Error('captureFrame: nothing captured');
  const cpu = new PixelBuffer(band.w, band.h);
  cpu.data.set(band.data);
  return { snap, cpu, frame };
}

/** The CPU raster's band of a captured frame drawn at output density `d` (its textures unchanged). */
export function cpuAt(c: Captured, d: number): PixelBuffer {
  const fr = { ...c.frame, density: d };
  const band = new FloorRaster().render(fr);
  const out = new PixelBuffer(band.w, band.h);
  out.data.set(band.data);
  return out;
}

/** GL vs CPU over every pixel either one draws: mean and percentiles of the largest channel difference (/255). */
export interface BandDiff {
  /** Pixels compared (drawn by either). */
  n: number;
  /** Pixels drawn by one renderer only (each counts as 255). */
  coverage: number;
  mean: number;
  p99: number;
  max: number;
}

export function compareBands(cpu: PixelBuffer, gl: { w: number; h: number; rgba: Uint8Array }): BandDiff {
  if (cpu.w !== gl.w || cpu.h !== gl.h) throw new Error(`band sizes differ: CPU ${cpu.w}×${cpu.h}, GL ${gl.w}×${gl.h}`);
  const hist = new Float64Array(256);
  let n = 0;
  let coverage = 0;
  let sum = 0;
  let max = 0;
  const g = gl.rgba;
  for (let i = 0; i < cpu.data.length; i++) {
    const c = cpu.data[i];
    const ca = c & 255;
    const ga = g[i * 4 + 3];
    if (ca === 0 && ga === 0) continue;
    n++;
    let d: number;
    if (ca === 0 || ga === 0) {
      d = 255;
      coverage++;
    } else {
      d = Math.max(Math.abs((c >>> 24) - g[i * 4]), Math.abs(((c >>> 16) & 255) - g[i * 4 + 1]), Math.abs(((c >>> 8) & 255) - g[i * 4 + 2]));
    }
    hist[d]++;
    sum += d;
    if (d > max) max = d;
  }
  let acc = 0;
  let p99 = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * 0.99) {
      p99 = v;
      break;
    }
  }
  return { n, coverage, mean: n ? sum / n : 0, p99, max };
}

/** A GL band (top-down RGBA bytes) as a PixelBuffer (for PNGs). */
export function glBuffer(gl: { w: number; h: number; rgba: Uint8Array }): PixelBuffer {
  const b = new PixelBuffer(gl.w, gl.h);
  for (let i = 0; i < gl.w * gl.h; i++) b.data[i] = ((gl.rgba[i * 4] << 24) | (gl.rgba[i * 4 + 1] << 16) | (gl.rgba[i * 4 + 2] << 8) | gl.rgba[i * 4 + 3]) >>> 0;
  return b.touch();
}
