/**
 * One section's perspective floor (docs/design/floor.md §1–§3, docs/api/floor.md): built from the
 * section's `FloorDef` and its terrain when the SectionView is made, then drawn by the view in the
 * spec's order (§3.4):
 *
 *   lifted background layers (`layerLift`) → backHook → `drawBand` (the floor: GPU or CPU raster)
 *   → `drawOpenings` → `drawBack` (back decor and back rows far → near, canopies / slabs / roofs /
 *   top faces, walk-plane decor) → terrain chunks (platforms and solids only) → the view's
 *   `floorHook` (the ground mist) → `drawShadows` → world.draw (entities with `drawDepth` through
 *   `drawAtDepth`) → `drawFront` (front decor and front rows near the camera last) → front layers →
 *   the light pass.
 *
 * Things at a depth stand ON the floor there (`liftAt`: a raised pavement lifts them); the section
 * start builds the visible 1× textures and queues the dense ones (`prepare`).
 *
 * Everything here is art: it reads the terrain and the entities, never writes them, and uses no
 * randomness. Per frame it makes no objects, arrays or closures: scaled props and chain links are
 * made once per size and density (the dense ones as art jobs), ovals once per size, and the quads'
 * and face groups' canvases come from one pool sized at the section start (`prepare`). Its CPU
 * memory is ONE number, `cpuBytes()` (spec §3.2, §8 gate 7).
 */
import type { Color } from '../../../engine/color';
import type { Entity } from '../../../engine/entity';
import {
  FLOOR_CX,
  FLOOR_FRONT_MARGIN,
  FLOOR_YW,
  makeFloorCam,
  sAtDepth,
  sOfV,
  vAtDepth,
  depthAtV,
  type FloorCam,
} from '../../../engine/floor/cam';
import type { FloorFrame, FloorGpu, FloorMaterial } from '../../../engine/floor/gpu';
import {
  buildFloorMesh,
  firstQuadAt,
  heightAt,
  profileAt,
  regionIndexAt,
  type FieldInput,
  type FieldLine,
  type FieldRegion,
  type FieldSegment,
  type FloorMesh,
} from '../../../engine/floor/mesh';
import { CANVAS_H_CLASSES, CANVAS_W_CLASSES, canvasClass, QUAD_EDGES, QuadCanvasPool, type QuadCanvas } from '../../../engine/floor/quad';
import { FloorRaster } from '../../../engine/floor/raster';
import { FloorTextureStore, type FloorTexture } from '../../../engine/floor/tex';
import { PixelBuffer } from '../../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../../engine/render';
import { frameH, frameW, VIEW_H, VIEW_W } from '../../../engine/render';
import { framesDensityAt, getFrame, getFrames, hasFramesAt, hiArtDeferred, queueArtJob, spriteAnim } from '../../../engine/sprites';
import type { Terrain } from '../../../engine/terrain';
import type { World } from '../../../engine/world';
import type { BgLayerDef } from '../../art/art-registry';
import type { DecorDef, SectionDef } from '../types';
import { ensureAwningTile, ensureBuiltinTiles } from './builtin';
import { getFloorPainter, getFloorProp, getFloorTile, type FloorPaintCtx } from './registry';
import { FramePlacer } from './place';
import { scaleFrame, ScaleJob } from './scale';
import { DEFAULT_SKY_GENS, type DepthLine, type FaceGroupDef, type FloorDef, type FloorSurface, type OverhangDef, type PropRowDef, type TopFaceDef } from './types';

/** Mesh margin beyond the section's ends (the back rows see wider than the screen). */
export const FLOOR_U_PAD = 160;
/** Rows of band kept above the floor's highest point (screen shake). */
const SHAKE_MARGIN = 6;
/** Contact shadows: bodies higher than this over the floor get none (spec §3.7). */
export const SHADOW_MAX_AIR = 48;
/** Default shadow strength (spec §3.7: ams about 0.3). */
export const DEFAULT_SHADOW = 0.3;
/** The default pit under a gap of the ground (px deep). */
const PIT_DEPTH = 48;
/**
 * The highest density of the per-frame quads (canopies, slabs, roofs, top faces) and the face
 * groups: their canvases are rasterised and streamed every frame, so at tier 4 they draw at 2× (the
 * 4K budget, spec §8 item 6; their silhouettes are anti-aliased and placed at 1/res, so they move
 * with the world). Openings on the floor keep the band's density. Their tiles are built at most at
 * this density too (a 4× tile would never be drawn).
 */
export const QUAD_MAX_DENSITY = 2;
/** The camera grid of the canvas plan (`planCanvases`: world px between two sampled cameras). */
const PLAN_STEP = 2;
/**
 * The tiles' window (spec §3.2, the 16 MB): a tile is built (its dense density queued) while
 * something that draws it lies within TILE_AHEAD_U past the view's right edge (at the back edge, the
 * widest row), and released once everything that draws it is TILE_BEHIND_U left of the view.
 */
const TILE_AHEAD_U = 384;
const TILE_BEHIND_U = 128;
/**
 * The band density the last floor drew at (any section; 0 before the first). A section start
 * queues its dense chunks at no more than this (the CPU fallback draws at most 2×; a res that
 * cannot show 4× draws 2×), so it never builds textures the band will not use.
 */
let lastBandDensity = 0;
/** A depth entry's defaults (no decor): every entry has every field, one shape. */
const NO_DECOR: DepthEntry = { depth: 0, lift: 0, tpf: 1, s: 1, x: 0.5, y: 0.5, par: 1, frame: 0, alpha: 1, flip: false, anim: false, decor: null, row: null, group: null };
/** The corners of a quad that is not an opening (none). */
const NO_CORNERS = new Float64Array(0);
/** The canvas plans per floor def and section (`planCanvases`: made once, a reloaded section reuses it). */
const canvasPlans = new WeakMap<FloorDef, Map<string, Map<number, number>>>();

/** One drawable at a depth: a decor item, a prop row or a face group. */
interface DepthEntry {
  depth: number;
  /** A decor item's lift on the floor there (`liftAt`, screen px; made once). */
  lift: number;
  /** An animated decor item's ticks per frame (looked up once). */
  tpf: number;
  /** The perspective scale of its depth (made once). */
  s: number;
  /**
   * A decor item's numbers, copied once into this one shape (the decor items come in many shapes, and
   * reading a fractional number from many shapes makes V8 box it): x, y, parallax, its first frame,
   * the alpha, mirrored, animated.
   */
  x: number;
  y: number;
  par: number;
  frame: number;
  alpha: number;
  flip: boolean;
  anim: boolean;
  decor: DecorDef | null;
  row: FloorRow | null;
  group: FaceGroup | null;
}

/**
 * A face group (spec §11 R1), resolved to the world once: per corner (4 per face) the world u, the
 * height h over the walk plane, the perspective scale s of its depth and the tile coordinates.
 */
interface FaceGroup {
  readonly def: FaceGroupDef;
  readonly n: number;
  readonly u: Float64Array;
  readonly h: Float64Array;
  readonly s: Float64Array;
  readonly a: Float64Array;
  readonly b: Float64Array;
  /** Per face: its tile (store index) and whether it shows from both sides. */
  readonly tile: Int32Array;
  readonly both: Uint8Array;
  /** Per face: rasterised in columns (constant u: a side wall), and its anti-aliased edges (quad.ts). */
  readonly cols: Uint8Array;
  readonly aa: Uint8Array;
  /** The anchor's scale and lift: the canvas grid is aligned to it (the sprite's own position). */
  readonly s0: number;
  readonly lift0: number;
  /** Projected corners of this frame (screen px) and which faces show. */
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly shown: Uint8Array;
  /** Logical height of its canvas (the tallest on-screen box it ever needs, shake included). */
  ch: number;
  /** The cameras (camX) it shows at (the canvas plan's cull). */
  camLo: number;
  camHi: number;
  /** The pooled canvas it holds while it shows (null off the view), and the width class it asked for. */
  cv: QuadCanvas | null;
  wc: number;
  /** What its canvas holds: a still camera redraws nothing. */
  lastCv: QuadCanvas | null;
  lastCamX: number;
  lastCamY: number;
  readonly lastTex: (FloorTexture | null)[];
}

/** A screen box of something drawn over the world (`frontBoxes`, gate 5). */
export interface FrontBox {
  what: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** A sprite or prop: its frame (top-left at x0, y0; mirrored with `flip`), so a check sees its opaque pixels. */
  f?: Frame;
  flip?: boolean;
}

/** A prop row, placed once. */
export interface FloorRow {
  readonly def: PropRowDef;
  readonly depth: number;
  readonly v: number;
  /** Perspective scale of the row (s) and the prop's final scale (s × def.scale). */
  readonly s: number;
  readonly scale: number;
  /** Prop positions (sorted) and the floor height under each. */
  readonly u: Float64Array;
  readonly h: Float64Array;
  /** Scaled frames by density (the source frame they were made from, to notice a finer one arriving). */
  frames: Map<number, { src: Frame | null; f: Frame | null }>;
  /** Chain frames by density and span (output px). */
  links: Map<number, Frame>;
  readonly linkMax: number;
  /** Its place in `rows` (its art jobs' key) and the densities whose frame is queued as a job (bits). */
  readonly index: number;
  queued: number;
}


/** A canopy / slab / roof / top face / opening, drawn through its own quad canvas. */
interface QuadThing {
  kind: 'overhang' | 'top' | 'opening';
  o: OverhangDef | null;
  t: TopFaceDef | null;
  /** Tile index (store) of its material. */
  tile: number;
  x0: number;
  x1: number;
  /** Logical height of its canvas (the tallest box it can show). */
  ch: number;
  /** An overhang's back edge: the facade's lift on the floor (`liftAt`, screen px). */
  lift: number;
  /** The pooled canvas it holds while it shows (null off the view), and the width class it asked for. */
  cv: QuadCanvas | null;
  wc: number;
  /** What its canvas holds (the canvas, the camera, the texture): a still camera redraws nothing. */
  lastCv: QuadCanvas | null;
  lastCamX: number;
  lastCamY: number;
  lastTex: FloorTexture | null;
  /** The perspective scale (and world v) of its depth: an overhang's facade, a top's back edge (made once). */
  s: number;
  v: number;
  /** Opening: per corner its scale and the floor's height there (s, h; made once). */
  corners: Float64Array;
  /** Opening: v range and ellipse flag. */
  vFar: number;
  vNear: number;
  ellipse: boolean;
}

/** Depth line → field line (world v). */
function vLine(cam: FloorCam, l: DepthLine | undefined, dflt: number): FieldLine {
  if (l === undefined) return dflt;
  if (typeof l === 'number') return Number.isFinite(l) ? vAtDepth(cam, l) : dflt;
  return l.map(([u, d]) => [u, vAtDepth(cam, d)] as [number, number]);
}

/** The ground segments of a terrain, extended flat beyond the section's ends. */
function profileSegments(t: Terrain, uMin: number, uMax: number, width: number): FieldSegment[] {
  const segs: FieldSegment[] = [];
  let first: FieldSegment | null = null;
  let last: FieldSegment | null = null;
  for (let i = 0; i < t.groundCount; i++) {
    const s = { x0: t.gx0[i], y0: t.gy0[i], x1: t.gx1[i], y1: t.gy1[i] };
    if (!(s.x1 > s.x0)) continue;
    segs.push(s);
    if (!first || s.x0 < first.x0) first = s;
    if (!last || s.x1 > last.x1) last = s;
  }
  if (first && first.x0 <= 1) segs.push({ x0: uMin, y0: first.y0, x1: first.x0, y1: first.y0 });
  if (last && last.x1 >= width - 1) segs.push({ x0: last.x1, y0: last.y1, x1: uMax, y1: last.y1 });
  return segs;
}

export class SectionFloor {
  readonly def: FloorDef;
  readonly section: SectionDef;
  readonly cam: FloorCam;
  readonly field: FieldInput;
  readonly mesh: FloorMesh;
  readonly store: FloorTextureStore;
  readonly raster = new FloorRaster();
  /** Tile ids by store index, and the mesh's materials. */
  readonly tileIds: string[] = [];
  readonly materials: FloorMaterial[] = [];
  /** The band (logical rows bandTop … VIEW_H). */
  readonly bandTop: number;
  readonly bandH: number;
  /** Scale of the back edge (the narrowest view). */
  readonly sBack: number;
  /** The GPU renderer (NullFloorGpu headless); set by the view. */
  gpu: FloorGpu | null = null;
  /** The last band was drawn by the GPU (debug / perf). */
  gpuDrawn = false;
  /** Prop rows (back and front). */
  readonly rows: FloorRow[] = [];
  /** Back entries (depth > 0) far → near, walk-plane back decor, front entries far → near. */
  private readonly backDeep: DepthEntry[] = [];
  private readonly backWalk: DepthEntry[] = [];
  private readonly frontList: DepthEntry[] = [];
  private readonly quads: QuadThing[] = [];
  /** Face groups (spec §11 R1: side faces), in the depth lists with the decor and rows. */
  readonly groups: FaceGroup[] = [];
  private readonly frame: FrameState;
  private bandFrame: Frame | null = null;
  private readonly shadowStrength: number;
  private readonly ovals = new Map<number, Frame>();
  private readonly skyGens: ReadonlySet<string>;
  // Draw options made once with every field they get (a double starts a double: no boxed store per draw).
  private readonly decorOpts: DrawOpts = { flipX: false, alpha: 0.5 };
  private readonly rowOpts: DrawOpts = { flipX: false };
  private readonly bandOpts: DrawOpts = { screen: true, stream: true };
  /** The quads' and groups' canvases: world space (the renderer's 1/res grid), streamed. */
  private readonly quadOpts: DrawOpts = { stream: true };
  /** The canvases of the quads and the face groups: one pool, sized at the section start (`prepare`). */
  readonly pool = new QuadCanvasPool();
  /** Tiles the band draws at its own density (the mesh's materials, the openings); the rest at ≤ QUAD_MAX_DENSITY. */
  private readonly bandTiles = new Set<number>();
  /** Per tile: the u range of everything that draws it (its window), and whether it was released. */
  private tileU0 = new Float64Array(0);
  private tileU1 = new Float64Array(0);
  private tileBand = new Uint8Array(0);
  private tileGone = new Uint8Array(0);
  /** This floor's art-job key prefix (the store's chunk and tile jobs, the rows' dense frames). */
  private readonly jobKey: string;
  /** The canvas densities the pool was sized for (`prepare`). */
  private readonly poolSized = new Set<number>();
  private readonly shadowOpts: DrawOpts = { alpha: 0.5 };
  private readonly overlayOpts: DrawOpts = { screen: true };
  /** Draws at sub-pixel positions with whole-number arguments (no boxed doubles per draw). */
  readonly placer = new FramePlacer();
  /** The tick of the decor being drawn (`drawEntries`). */
  private tick = 0;
  // Corner scratch for the quads.
  private readonly qx = new Float64Array(4);
  private readonly qy = new Float64Array(4);
  private readonly qq = new Float64Array(4);
  private readonly qa = new Float64Array(4);
  private readonly qb = new Float64Array(4);

  constructor(section: SectionDef, def: FloorDef, terrain: Terrain, seed: number, jobKey: string) {
    ensureBuiltinTiles();
    this.section = section;
    this.def = def;
    // The mesh reaches below the view by the floor's highest rise too (a hump lifts its near edge).
    const yw0 = def.camera.yw ?? FLOOR_YW;
    let rise = 0;
    for (let i = 0; i < terrain.groundCount; i++) rise = Math.max(rise, yw0 - terrain.gy0[i], yw0 - terrain.gy1[i]);
    let up = 0;
    for (const ft of def.features ?? []) up = Math.max(up, ft.kind === 'cut' ? (ft.level ?? 0) - rise : (ft.dh ?? 0));
    const lift = Math.max(0, rise + up);
    const front = VIEW_H + FLOOR_FRONT_MARGIN + Math.ceil(lift * 1.6);
    const cam = makeFloorCam({ yh: def.camera.yh, f: def.camera.f, back: def.camera.back, yw: def.camera.yw, front });
    this.cam = cam;
    this.sBack = sOfV(cam, cam.vBack);
    // --- the height field
    const uMin = -FLOOR_U_PAD;
    const uMax = section.width + FLOOR_U_PAD;
    const regions: FieldRegion[] = [];
    for (const ft of def.features ?? []) {
      const level = ft.kind === 'cut' ? (ft.level ?? -4) : undefined;
      regions.push({
        u0: ft.u0 ?? -Infinity,
        u1: ft.u1 ?? Infinity,
        v0: vLine(cam, ft.from, cam.vBack),
        v1: vLine(cam, ft.to, cam.vFront),
        dh: level === undefined ? (ft.dh ?? 0) : undefined,
        level,
        surface: this.surfaceMat(ft.surface),
        face: ft.face ? this.tileMat(ft.face) : -1,
      });
    }
    const pit = def.pit ?? {};
    this.field = {
      segments: profileSegments(terrain, uMin, uMax, section.width),
      yw: cam.yw,
      uMin,
      uMax,
      vBack: cam.vBack,
      vFront: cam.vFront,
      regions,
      baseFace: def.baseFace ? this.tileMat(def.baseFace) : -1,
      pit: {
        level: -(pit.depth ?? PIT_DEPTH),
        surface: this.surfaceMat(pit.surface ?? 'floor/pit'),
        face: this.tileMat(pit.face ?? 'floor/pit-wall'),
      },
    };
    this.mesh = buildFloorMesh(this.field);
    // --- textures
    const field = this.field;
    const painterRef = def.painter;
    const painter = getFloorPainter(painterRef.id);
    const tileIds = this.tileIds;
    this.jobKey = `${jobKey}F/`;
    this.store = new FloorTextureStore(
      cam,
      {
        chunkPainter: (d) => {
          const ctx: FloorPaintCtx = {
            d,
            params: painterRef.params ?? {},
            seed: (painterRef.seed ?? seed) >>> 0,
            cam,
            heightAt: (u, v) => heightAt(field, u, v),
            featureAt: (u, v) => regionIndexAt(field, u, v),
            vAt: (depth) => vAtDepth(cam, depth),
            depthAt: (v) => depthAtV(cam, v),
          };
          return painter(ctx);
        },
        tile: (m, d) => {
          const t = getFloorTile(tileIds[m]);
          if (!t) return null;
          return { w: t.w, h: t.h, paint: (a, b) => t.paint(a, b, d) };
        },
      },
      { jobKey: this.jobKey, deferred: hiArtDeferred, uMax },
    );
    // --- the band
    const top = cam.yh + (cam.yw - cam.yh - Math.max(0, this.mesh.hMax)) * this.sBack - SHAKE_MARGIN;
    this.bandTop = Math.max(0, Math.floor(top));
    this.bandH = VIEW_H - this.bandTop;
    this.frame = new FrameState(this);
    this.shadowStrength = def.shadow ?? DEFAULT_SHADOW;
    this.skyGens = new Set(def.skyLayers ?? DEFAULT_SKY_GENS);
    // --- rows, faces, decor, quads
    for (const rd of def.rows ?? []) this.rows.push(this.makeRow(rd, section.width));
    for (const gd of def.faces ?? []) this.groups.push(this.makeGroup(gd));
    this.sortDecor(section.decor ?? []);
    for (const o of def.overhangs ?? []) this.quads.push(this.makeOverhang(o));
    for (const t of def.tops ?? []) this.quads.push(this.makeTop(t));
    for (const op of def.openings ?? []) {
      const vFar = vAtDepth(cam, op.from);
      const vNear = vAtDepth(cam, op.to);
      this.quads.push({
        kind: 'opening',
        o: null,
        t: null,
        tile: this.tileIndex(op.tile),
        x0: op.x0,
        x1: op.x1,
        ch: Math.abs(op.from - op.to) * 1.5 + 8,
        lift: 0,
        s: 1,
        v: 0,
        corners: this.openingCorners(op.x0, op.x1, vFar, vNear),
        cv: null,
        wc: 0,
        lastCv: null,
        lastCamX: NaN,
        lastCamY: NaN,
        lastTex: null,
        vFar,
        vNear,
        ellipse: op.ellipse === true,
      });
    }
    // The tiles the band draws at its own density: the mesh's materials and the openings.
    for (const m of this.materials) {
      this.bandTiles.add(m.base.tile);
      if (m.over) this.bandTiles.add(m.over.tile);
    }
    for (const q of this.quads) if (q.kind === 'opening') this.bandTiles.add(q.tile);
    this.tileWindows();
  }

  /** Every tile's window: the u range of the mesh quads, quads and face groups that draw it. */
  private tileWindows(): void {
    const n = this.tileIds.length;
    const u0 = new Float64Array(n).fill(Infinity);
    const u1 = new Float64Array(n).fill(-Infinity);
    const span = (t: number, a: number, b: number): void => {
      if (a < u0[t]) u0[t] = a;
      if (b > u1[t]) u1[t] = b;
    };
    const mesh = this.mesh;
    for (let q = 0; q < mesh.quadCount; q++) {
      const m = mesh.quadMat[q];
      if (m < 0) continue;
      const mat = this.materials[m];
      let a = Infinity;
      let b = -Infinity;
      for (let c = 0; c < 4; c++) {
        const u = mesh.pu[mesh.quads[q * 4 + c]];
        if (u < a) a = u;
        if (u > b) b = u;
      }
      span(mat.base.tile, a, b);
      if (mat.over) span(mat.over.tile, a, b);
    }
    for (const q of this.quads) span(q.tile, q.x0, q.x1);
    for (const g of this.groups) {
      let a = Infinity;
      let b = -Infinity;
      for (let k = 0; k < g.n * 4; k++) {
        if (g.u[k] < a) a = g.u[k];
        if (g.u[k] > b) b = g.u[k];
      }
      for (let f = 0; f < g.n; f++) span(g.tile[f], a, b);
    }
    // A tile nothing draws (yet): always in its window.
    for (let t = 0; t < n; t++) {
      if (u0[t] > u1[t]) {
        u0[t] = -Infinity;
        u1[t] = Infinity;
      }
    }
    this.tileU0 = u0;
    this.tileU1 = u1;
    this.tileBand = new Uint8Array(n);
    for (const t of this.bandTiles) this.tileBand[t] = 1;
    this.tileGone = new Uint8Array(n);
  }

  /**
   * The tiles' window at camX (spec §3.2): the tiles of everything near the view are built — their
   * dense density (`band` for the band's tiles, ≤ QUAD_MAX_DENSITY for the rest) queued, at 1× on the
   * spot when `now` (the section start) — and the tiles of everything left behind are released.
   */
  private windowTiles(camX: number, band: number, quad: number, now: boolean): void {
    const half = (FLOOR_CX + 2) / this.sBack;
    const lo = camX + FLOOR_CX - half - TILE_BEHIND_U;
    const hi = camX + FLOOR_CX + half + TILE_AHEAD_U;
    const n = this.tileU0.length;
    for (let i = 0; i < n; i++) {
      if (this.tileU1[i] < lo) {
        if (this.tileGone[i] === 0) {
          this.tileGone[i] = 1;
          this.store.releaseTile(i);
        }
        continue;
      }
      if (this.tileU0[i] > hi) continue;
      this.tileGone[i] = 0;
      if (now) this.store.tile(i, 1);
      const d = this.tileBand[i] === 1 ? band : quad;
      if (d > 1) this.store.prefetchTile(i, d);
    }
  }

  /** An opening's corners (far left, far right, near right, near left): scale and floor height each. */
  private openingCorners(x0: number, x1: number, vFar: number, vNear: number): Float64Array {
    const out = new Float64Array(8);
    for (let c = 0; c < 4; c++) {
      const u = c === 0 || c === 3 ? x0 : x1;
      const v = c < 2 ? vFar : vNear;
      const h = heightAt(this.field, u, v);
      out[c * 2] = sOfV(this.cam, v);
      out[c * 2 + 1] = Number.isFinite(h) ? h : 0;
    }
    return out;
  }

  // ------------------------------------------------------------------------------- materials

  /** Store index of a tile id (added once). */
  tileIndex(id: string): number {
    let i = this.tileIds.indexOf(id);
    if (i < 0) {
      i = this.tileIds.length;
      this.tileIds.push(id);
    }
    return i;
  }

  /** A static one-layer material of a tile id. */
  private tileMat(id: string): number {
    return this.material({ tile: id });
  }

  /** Material index of a surface (-1 = the chunk painter). */
  private surfaceMat(s: FloorSurface | undefined): number {
    if (s === undefined || s === 'chunk') return -1;
    return this.material(typeof s === 'string' ? { tile: s } : s);
  }

  private material(s: { tile: string; du?: number; dv?: number; over?: { tile: string; du?: number; dv?: number; alpha: number } }): number {
    const base = { tile: this.tileIndex(s.tile), du: s.du ?? 0, dv: s.dv ?? 0 };
    const over = s.over ? { tile: this.tileIndex(s.over.tile), du: s.over.du ?? 0, dv: s.over.dv ?? 0, alpha: s.over.alpha } : null;
    const animated = base.du !== 0 || base.dv !== 0 || (over !== null && (over.du !== 0 || over.dv !== 0));
    // Same material twice → same index.
    for (let i = 0; i < this.materials.length; i++) {
      const m = this.materials[i];
      if (m.base.tile === base.tile && m.base.du === base.du && m.base.dv === base.dv && JSON.stringify(m.over) === JSON.stringify(over)) return i;
    }
    this.materials.push({ base, over, animated });
    return this.materials.length - 1;
  }

  /** Does the floor move while the camera is still (an animated material)? */
  get animated(): boolean {
    return this.materials.some((m) => m.animated);
  }

  // ------------------------------------------------------------------------------- queries

  /** h(u, v) of the floor. */
  heightAt(u: number, v: number): number {
    return heightAt(this.field, u, v);
  }

  /** World v of a depth. */
  vAt(depth: number): number {
    return vAtDepth(this.cam, depth);
  }

  /**
   * How far a thing at `depth` over world x is drawn up so that its base stands ON the floor there
   * (spec §1.3; screen px): s · (h(x, v) − h(x, 0)), the floor's height at that depth over the walk
   * line at x, at the depth's scale. A kerb-raised pavement lifts the facades on it (their feet
   * stay on its rows and never slide); 0 on flat ground, under the cylinder rule (a hump runs
   * across the band: the 2D art already stands on it) and over a gap of the ground. Decor at a
   * depth, `drawDepth` entities, the overhangs' back edges and the light's `floorShift` all use it.
   */
  liftAt(x: number, depth: number): number {
    if (depth === 0) return 0;
    const h0 = profileAt(this.field, x);
    if (!Number.isFinite(h0)) return 0;
    const h = heightAt(this.field, x, vAtDepth(this.cam, depth));
    if (!Number.isFinite(h) || h === h0) return 0;
    return (h - h0) * sAtDepth(this.cam, depth);
  }

  /** The lift of a background layer (0 for sky layers): the floor's depth behind the feet. */
  layerLift(def: BgLayerDef): number {
    return this.skyGens.has(def.gen) ? 0 : this.cam.yw - this.cam.back;
  }

  /** Is a background layer lifted? */
  isLifted(def: BgLayerDef): boolean {
    return !this.skyGens.has(def.gen);
  }

  // ------------------------------------------------------------------------------- the band

  /** The density the band draws at for a wanted density d (the GPU's own or the CPU cap). */
  private bandDensity(d: number, cpu: boolean): number {
    const cap = cpu && this.gpu ? this.gpu.cpuCap : 4;
    return d > cap ? (cap >= 2 ? 2 : 1) : d;
  }

  /** Fill the frame description for the renderer's camera (no allocation). */
  private setFrame(r: Renderer, tick: number, d: number): FrameState {
    const fr = this.frame;
    fr.camX = r.camX;
    fr.camY = r.camY;
    fr.eyeU = r.camX + FLOOR_CX;
    fr.tick = tick;
    fr.density = d;
    fr.want = d;
    fr.bandTop = this.bandTop;
    fr.bandH = this.bandH;
    const half = (FLOOR_CX + 2) / this.sBack;
    fr.q0 = firstQuadAt(this.mesh, fr.eyeU - half);
    let q1 = fr.q0;
    const u0 = this.mesh.quadU0;
    const hi = fr.eyeU + half;
    while (q1 < this.mesh.quadCount && u0[q1] <= hi) q1++;
    fr.q1 = q1;
    fr.storeVersion = this.store.version;
    return fr;
  }

  /** Draw the floor band: the GPU's image, else the CPU raster's (spec §3.3). `d`: the view's density at this res. */
  drawBand(r: Renderer, tick: number, d: number): void {
    this.gpuDrawn = false;
    const gpu = this.gpu;
    if (gpu && r.surface) {
      const img = gpu.render(this.setFrame(r, tick, d));
      if (img) {
        r.surface(img, 0, this.bandTop, VIEW_W, this.bandH);
        this.gpuDrawn = true;
        lastBandDensity = d;
        // The CPU band of the frames before the GPU was ready (its compile) is not needed now.
        if (this.raster.band) {
          this.raster.release();
          this.bandFrame = null;
        }
        return;
      }
    }
    const fr = this.setFrame(r, tick, this.bandDensity(d, true));
    lastBandDensity = fr.density;
    const band = this.raster.render(fr);
    let bf = this.bandFrame;
    if (!bf || bf.buf !== band) {
      bf = { buf: band, ox: 0, oy: 0, density: fr.density };
      this.bandFrame = bf;
    }
    r.frame(bf, 0, this.bandTop, this.bandOpts);
  }

  /**
   * Build what the view at camX needs right now (section start, spec §2.6): the visible chunks and
   * every tile at 1× on the spot; with `want` > 1 (the browser's deferred dense art, the view's
   * density) the dense textures queued as art jobs now — the visible chunks and the ones just
   * outside the view, and the BAND's tiles (the mesh's materials, the openings) at the band density,
   * every other tile (canopies, tops, faces) at ≤ QUAD_MAX_DENSITY, what they draw at — capped by
   * the band density the last floor drew at (or, before any floor has drawn, by the CPU raster's cap
   * when the GPU will not draw), so the first frames of play upgrade from 1× without a bake on the
   * frame path; the rows' prop frames at 1× now and at `want` as art jobs (built at once headless);
   * and the canvas pool of the quads and face groups, sized for the most of them that ever show at
   * once (`planCanvases`), so the frame path makes no canvas.
   */
  prepare(camX: number, want = 1): void {
    const fr = this.frame;
    fr.want = 1;
    fr.camX = camX;
    fr.eyeU = camX + FLOOR_CX;
    const half = (FLOOR_CX + 2) / this.sBack;
    const lo = firstQuadAt(this.mesh, fr.eyeU - half);
    const gpu = this.gpu;
    const cap = lastBandDensity > 0 ? lastBandDensity : gpu && gpu.live?.() !== true ? gpu.cpuCap : want;
    const dense = Math.min(want, cap);
    for (let q = lo; q < this.mesh.quadCount && this.mesh.quadU0[q] <= fr.eyeU + half; q++) {
      const m = this.mesh.quadMat[q];
      if (m >= 0) continue;
      this.store.chunk(this.mesh.quadChunk[q], 1);
      if (dense > 1) this.store.chunk(this.mesh.quadChunk[q], dense);
    }
    this.windowTiles(camX, dense, Math.min(dense, QUAD_MAX_DENSITY), true);
    if (dense > 1) this.store.prefetch(camX, dense, this.sBack);
    // The rows' prop frames (1× now, the view's density as jobs) and their chain links.
    for (const row of this.rows) {
      this.rowFrame(row, 1);
      this.rowFrame(row, want);
    }
    // The canvases: every density the quads and faces will draw at (≤ 2×; the openings at the band's).
    this.sizePool(Math.min(want, QUAD_MAX_DENSITY), false);
    if (this.quads.some((q) => q.kind === 'opening')) this.sizePool(want, true);
  }

  /** Make the pool's canvases for density d (the plan: the most of each size that show at once). */
  private sizePool(d: number, openings: boolean): void {
    const key = openings ? -d : d;
    if (this.poolSized.has(key)) return;
    this.poolSized.add(key);
    const plan = this.planCanvases(openings);
    for (const [k, n] of plan) this.pool.ensure(Math.floor(k / 1000), k % 1000, d, n);
  }

  /**
   * Queue the chunks and tiles ahead and release the ones behind (once per frame, after drawing; `d`
   * the view's density at this res: the band's tiles at the density the band drew).
   */
  maintain(camX: number, d: number): void {
    const band = this.frame.density;
    this.store.prefetch(camX, band, this.sBack);
    this.store.evict(camX, this.sBack);
    this.windowTiles(camX, band, Math.min(d, QUAD_MAX_DENSITY), false);
  }

  dispose(): void {
    this.store.dispose();
    this.gpu?.release?.(this.mesh.id);
  }

  /**
   * Every CPU byte this floor holds (spec §3.2, §8 gate 7: the ONE number the memory test checks):
   * the texture store, the canvas pool (quads and face groups), the rows' prop frames and chain
   * links, the shadow ovals and the CPU raster's band (only where it drew).
   */
  cpuBytes(): number {
    let n = this.store.bytes() + this.store.pendingBytes() + this.pool.bytes();
    for (const row of this.rows) {
      for (const e of row.frames.values()) if (e.f) n += e.f.buf.data.byteLength;
      for (const l of row.links.values()) n += l.buf.data.byteLength;
    }
    for (const o of this.ovals.values()) n += o.buf.data.byteLength;
    n += this.raster.bytes();
    return n;
  }

  // ------------------------------------------------------------------------------- decor and rows

  private sortDecor(decor: readonly DecorDef[]): void {
    const def = this.def;
    const hide = def.hideDecor ?? [];
    const back: DepthEntry[] = [];
    const front: DepthEntry[] = [];
    // Faces first: at equal depths the stable sort keeps them before the decor (a facade covers its own edge).
    for (const g of this.groups) (g.def.front ? front : back).push({ ...NO_DECOR, depth: g.def.order ?? g.def.depth, group: g });
    decor.forEach((d, i) => {
      if (hide.some((p) => d.sprite.startsWith(p))) return;
      let depth: number | null | undefined = d.depth;
      if (depth === undefined && def.decorDepth) depth = def.decorDepth(d, i);
      if (depth === undefined) depth = d.front ? 0 : (def.defaultDepth ?? 0);
      if (depth === null) return;
      const lift = (d.parallax ?? 1) === 1 ? this.liftAt(d.x, depth) : 0;
      const tpf = Math.max(1, typeof d.animate === 'number' ? d.animate : d.animate ? spriteAnim(d.sprite).ticksPerFrame : 1);
      (d.front ? front : back).push({
        ...NO_DECOR,
        depth,
        lift,
        tpf,
        s: sAtDepth(this.cam, depth),
        x: d.x,
        y: d.y,
        par: d.parallax ?? 1,
        frame: d.frame ?? 0,
        alpha: d.alpha ?? 1,
        flip: d.flipX === true,
        anim: !!d.animate,
        decor: d,
      });
    });
    for (const row of this.rows) (row.depth > 0 ? back : front).push({ ...NO_DECOR, depth: row.depth, s: row.s, row });
    // Far → near; equal depths keep the list order (stable sort).
    back.sort((a, b) => b.depth - a.depth);
    front.sort((a, b) => b.depth - a.depth);
    // Back faces always go with the deep list (a walk-plane box's sides before its top faces and its sprite).
    for (const e of back) (e.depth > 0 || e.row || e.group ? this.backDeep : this.backWalk).push(e);
    for (const e of front) this.frontList.push(e);
  }

  private makeRow(rd: PropRowDef, width: number): FloorRow {
    const cam = this.cam;
    const v = vAtDepth(cam, rd.depth);
    const s = sAtDepth(cam, rd.depth);
    const u0 = rd.u0 ?? 0;
    const u1 = rd.u1 ?? width;
    const us: number[] = [];
    if (rd.at) us.push(...rd.at.filter((u) => u >= u0 && u < u1));
    else if (rd.spacing && rd.spacing > 0) for (let u = u0 + (rd.offset ?? 0); u < u1; u += rd.spacing) us.push(u);
    const gaps = rd.gaps ?? [];
    const keep = us.filter((u) => !gaps.some(([a, b]) => u >= a && u <= b)).sort((a, b) => a - b);
    const h = keep.map((u) => {
      const hh = heightAt(this.field, u, v);
      return Number.isFinite(hh) ? hh : 0;
    });
    const spacing = rd.spacing ?? (keep.length > 1 ? keep[1] - keep[0] : 32);
    return {
      def: rd,
      depth: rd.depth,
      v,
      s,
      scale: s * (rd.scale ?? 1),
      u: Float64Array.from(keep),
      h: Float64Array.from(h),
      frames: new Map(),
      links: new Map(),
      linkMax: rd.link?.max ?? spacing * 1.5,
      index: this.rows.length,
      queued: 0,
    };
  }

  /**
   * The row's prop frame at density d (scaled once; rebuilt when a finer source frame arrives). In
   * the browser (deferred dense art) a dense frame is scaled in an art job: until it is ready the
   * row draws its best lower one, so no frame of play scales a prop (spec §2.5, §2.6).
   */
  rowFrame(row: FloorRow, d: number): Frame | null {
    const def = row.def;
    if (!def.prop && !def.sprite) return null;
    const e = row.frames.get(d);
    if (e && (def.prop || e.src === this.rowSource(row, d))) return e.f;
    if (d > 1 && hiArtDeferred()) {
      if ((row.queued & d) === 0) {
        row.queued |= d;
        this.queueRowJob(row, d);
      }
      if (e) return e.f;
      const e2 = d > 2 ? row.frames.get(2) : undefined;
      return e2 ? e2.f : this.rowFrame(row, 1);
    }
    return this.buildRowFrame(row, d);
  }

  /**
   * The source frame of a sprite row at density d: the best the sprite has now. In the browser
   * (deferred art) a row never makes the sprite's dense art itself (the preload and the art pool do;
   * a 2× sprite is a 13 ms bake): until it is there the row scales the 1× frame, and a finer one
   * arriving rebuilds the row's frame (an art job).
   */
  private rowSource(row: FloorRow, d: number): Frame | null {
    const def = row.def;
    if (!def.sprite) return null;
    let dd = d;
    if (d > 1 && hiArtDeferred()) {
      dd = framesDensityAt(def.sprite, d);
      if (dd > 1 && !hasFramesAt(def.sprite, dd)) dd = 1;
    }
    const frames = getFrames(def.sprite, dd);
    return frames[(def.frame ?? 0) % Math.max(1, frames.length)] ?? null;
  }

  /**
   * Scale the row's frame at density d in art jobs of a few ms: a sprite in bands of rows (one job
   * re-queues itself until the frame is done), a procedural prop in one.
   */
  private queueRowJob(row: FloorRow, d: number): void {
    const key = `${this.jobKey}R${d}:${row.index}`;
    let job: ScaleJob | null = null;
    let src: Frame | null = null;
    let j = 0;
    const step = (): void => {
      if (row.def.prop) {
        row.queued &= ~d;
        this.buildRowFrame(row, d);
        return;
      }
      if (!job) {
        src = this.rowSource(row, d);
        if (!src) {
          row.queued &= ~d;
          this.setRowFrame(row, d, null, null);
          return;
        }
        job = new ScaleJob(src, row.scale, d);
      }
      job.rows(j, j + job.sliceRows);
      j += job.sliceRows;
      if (j < job.out.h) {
        queueArtJob(key, step);
        return;
      }
      row.queued &= ~d;
      this.setRowFrame(row, d, src, job.frame());
    };
    queueArtJob(key, step);
  }

  /** Scale the row's prop frame at density d now (and its chain links at that density). */
  private buildRowFrame(row: FloorRow, d: number): Frame | null {
    const def = row.def;
    let f: Frame | null = null;
    let src: Frame | null = null;
    if (def.prop) {
      const gen = getFloorProp(def.prop);
      if (gen) {
        try {
          f = gen(row.scale, d);
        } catch (err) {
          console.warn(`[floor] prop "${def.prop}" failed:`, err);
        }
      }
    } else {
      src = this.rowSource(row, d);
      f = src ? scaleFrame(src, row.scale, d) : null;
    }
    this.setRowFrame(row, d, src, f);
    return f;
  }

  /** Keep the row's frame at density d (scaled from `src`) and make its chain links at that density. */
  private setRowFrame(row: FloorRow, d: number, src: Frame | null, f: Frame | null): void {
    row.frames.set(d, { src, f });
    const def = row.def;
    // The chain links between its props (one frame per span length).
    const link = def.link;
    if (link && f) {
      const us = row.u;
      for (let i = 0; i + 1 < us.length; i++) {
        if (us[i + 1] - us[i] > row.linkMax || row.h[i + 1] !== row.h[i]) continue;
        const span = (us[i + 1] - us[i]) * row.s;
        const key = d * 100000 + Math.round(span * d);
        if (!row.links.has(key)) row.links.set(key, chainFrame(Math.round(span * d) / d, link.sag * row.scale, link.colors, d));
      }
    }
  }

  private drawRow(r: Renderer, row: FloorRow, d: number): void {
    const n = row.u.length;
    if (n === 0) return;
    const f = this.rowFrame(row, d);
    if (!f) return;
    const cam = this.cam;
    const s = row.s;
    const camX = r.camX;
    const eye = camX + FLOOR_CX;
    const reach = (FLOOR_CX + 48) / s;
    const lo = eye - reach;
    const hi = eye + reach;
    const us = row.u;
    // The first prop at u ≥ lo (a binary search, inline: no double through a call).
    let i = 0;
    let top = n;
    while (i < top) {
      const m = (i + top) >> 1;
      if (us[m] < lo) i = m + 1;
      else top = m;
    }
    const o = this.rowOpts;
    o.flipX = row.def.flipX === true;
    const link = row.def.link;
    const k1 = cam.yw - cam.yh;
    // The density of the frame drawn (a lower one stands in while the dense one is scaled).
    const fd = f.density ?? 1;
    for (; i < n && us[i] <= hi; i++) {
      const u = us[i];
      this.placer.x = u * s + (camX + FLOOR_CX) * (1 - s);
      this.placer.y = cam.yh + (k1 - row.h[i]) * s;
      this.placer.put(r, f, o);
      if (link && i + 1 < n && us[i + 1] - u <= row.linkMax && row.h[i + 1] === row.h[i]) this.drawLink(r, row, f, fd, i);
    }
  }

  /** A sagging chain from prop i (drawn at the placer's position) to its neighbour (spec §3.6). */
  private drawLink(r: Renderer, row: FloorRow, f: Frame, d: number, i: number): void {
    const link = row.def.link;
    if (!link) return;
    const p = f.pts?.[link.pt ?? 'chain'];
    const span = (row.u[i + 1] - row.u[i]) * row.s;
    const key = d * 100000 + Math.round(span * d);
    let lf = row.links.get(key);
    if (!lf) {
      // Not made with the row's frame (a prop frame from elsewhere): once, now.
      lf = chainFrame(Math.round(span * d) / d, link.sag * row.scale, link.colors, d);
      row.links.set(key, lf);
    }
    this.placer.x += p ? p[0] : 0;
    this.placer.y += p ? p[1] : -frameH(f) * 0.7;
    this.placer.put(r, lf, this.rowOpts);
  }

  /**
   * Draw a decor item at its depth (shift and speed of the depth, its own size, on the floor there:
   * the entry's `lift`; spec §1.3).
   */
  private drawDecorAt(r: Renderer, e: DepthEntry): void {
    const depth = e.depth;
    const camX = r.camX;
    const camY = r.camY;
    const p = e.par;
    // The position goes straight into the placer's fields from each branch (merging a whole number
    // from the data with a computed double would make V8 box the double).
    const pl = this.placer;
    if (p !== 1) {
      pl.x = e.x + camX * (1 - p);
      pl.y = e.y + camY * (1 - p) - depth;
    } else if (depth === 0) {
      pl.x = e.x;
      pl.y = e.y;
    } else {
      const s = e.s;
      pl.x = e.x * s + (camX + FLOOR_CX) * (1 - s);
      pl.y = e.y - depth - e.lift;
    }
    const x = pl.x;
    const y = pl.y;
    if (x < camX - 256 || x > camX + VIEW_W + 256 || y < camY - 256 || y > camY + VIEW_H + 256) return;
    let frame = e.frame | 0;
    if (e.anim) frame = (frame + this.tick / e.tpf) | 0;
    const o = this.decorOpts;
    o.flipX = e.flip;
    o.alpha = e.alpha;
    pl.put(r, getFrame((e.decor as DecorDef).sprite, frame), o);
  }

  private drawEntries(r: Renderer, list: readonly DepthEntry[], tick: number, d: number): void {
    // The clock of the animated decor (a field: `drawDecorAt` takes only objects).
    this.tick = tick | 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.decor) this.drawDecorAt(r, e);
      else if (e.row) this.drawRow(r, e.row, d);
      else if (e.group) this.drawGroup(r, e.group, d);
    }
  }

  /** Back decor and back rows (far → near), the canopies and top faces, then the walk-plane decor. */
  drawBack(r: Renderer, tick: number, d: number): void {
    this.drawEntries(r, this.backDeep, tick, d);
    this.drawQuads(r, d, false);
    this.drawEntries(r, this.backWalk, tick, d);
  }

  /** Flat openings on the floor (right after the band). */
  drawOpenings(r: Renderer, d: number): void {
    this.drawQuads(r, d, true);
  }

  /** Front decor and front rows, far → near (over the world). */
  drawFront(r: Renderer, tick: number, d: number): void {
    this.drawEntries(r, this.frontList, tick, d);
  }

  // ------------------------------------------------------------------------------- quads

  private makeOverhang(o: OverhangDef): QuadThing {
    let tile: number;
    if (o.kind === 'awning' && o.colors) tile = this.tileIndex(ensureAwningTile(o.colors, o.stripe ?? 4));
    else tile = this.tileIndex(o.tile ?? 'floor/slab');
    const lift = this.liftAt(o.anchorX ?? (o.x0 + o.x1) / 2, o.depth);
    return {
      kind: 'overhang',
      o,
      t: null,
      tile,
      x0: o.x0,
      x1: o.x1,
      ch: Math.abs(o.depth) + (o.rise ?? 0) + Math.abs(lift) + 6,
      lift,
      s: sAtDepth(this.cam, o.depth),
      v: vAtDepth(this.cam, o.depth),
      corners: NO_CORNERS,
      cv: null,
      wc: 0,
      lastCv: null,
      lastCamX: NaN,
      lastCamY: NaN,
      lastTex: null,
      vFar: 0,
      vNear: 0,
      ellipse: false,
    };
  }

  private makeTop(t: TopFaceDef): QuadThing {
    return {
      kind: 'top',
      o: null,
      t,
      tile: this.tileIndex(t.tile),
      x0: t.x0,
      x1: t.x1,
      ch: Math.abs(t.depth) + Math.abs((t.y1 ?? t.y) - t.y) + 8,
      lift: 0,
      s: sOfV(this.cam, vAtDepth(this.cam, t.depth)),
      v: vAtDepth(this.cam, t.depth),
      corners: NO_CORNERS,
      cv: null,
      wc: 0,
      lastCv: null,
      lastCamX: NaN,
      lastCamY: NaN,
      lastTex: null,
      vFar: 0,
      vNear: 0,
      ellipse: false,
    };
  }

  /**
   * Project quad q for the camera (pcx, pcy) into the corner scratch (screen px qx / qy, weights qq, texture
   * coordinates qa / qb) and return its box clamped to the view ± 1 (null: nothing shows). Sets
   * `alignX` / `alignY`: the screen point of the sprite the quad joins (an awning's facade and
   * valance, a prop's top edge), which its canvas grid is aligned to (NaN: the renderer's grid).
   */
  private projectQuad(q: QuadThing): number[] | null {
    const camX = this.pcx;
    const camY = this.pcy;
    if (q.x1 < camX - 96 || q.x0 > camX + VIEW_W + 96) return null;
    const cam = this.cam;
    const X = this.qx;
    const Y = this.qy;
    const Q = this.qq;
    const A = this.qa;
    const B = this.qb;
    if (q.kind === 'overhang') {
      const o = q.o as OverhangDef;
      const s = q.s;
      const by = o.y - o.depth - (o.rise ?? 0) - q.lift - camY;
      const bx0 = o.anchorX !== undefined ? FLOOR_CX + (o.anchorX - camX - FLOOR_CX) * s + (o.x0 - o.anchorX) : FLOOR_CX + (o.x0 - camX - FLOOR_CX) * s;
      const bx1 = o.anchorX !== undefined ? bx0 + (o.x1 - o.x0) : FLOOR_CX + (o.x1 - camX - FLOOR_CX) * s;
      X[0] = bx0;
      Y[0] = by;
      X[1] = bx1;
      Y[1] = by;
      X[2] = o.x1 - camX;
      Y[2] = o.y - camY;
      X[3] = o.x0 - camX;
      Y[3] = o.y - camY;
      Q[0] = Q[1] = s;
      Q[2] = Q[3] = 1;
      const depthB = Math.abs(o.depth) + (o.rise ?? 0);
      A[0] = A[3] = o.x0;
      A[1] = A[2] = o.x1;
      B[0] = B[1] = 0;
      B[2] = B[3] = depthB;
      // The facade sprite (anchorX at its depth) or the valance at the front edge; its platform line.
      this.alignX = o.anchorX !== undefined ? FLOOR_CX + (o.anchorX - camX - FLOOR_CX) * s : X[3];
      this.alignY = Y[3];
    } else if (q.kind === 'top') {
      const t = q.t as TopFaceDef;
      const v = q.v;
      const s = q.s;
      const y1 = t.y1 ?? t.y;
      X[0] = FLOOR_CX + (t.x0 - camX - FLOOR_CX) * s;
      Y[0] = cam.yh - camY + (t.y - cam.yh) * s;
      X[1] = FLOOR_CX + (t.x1 - camX - FLOOR_CX) * s;
      Y[1] = cam.yh - camY + (y1 - cam.yh) * s;
      X[2] = t.x1 - camX;
      Y[2] = y1 - camY;
      X[3] = t.x0 - camX;
      Y[3] = t.y - camY;
      Q[0] = Q[1] = s;
      Q[2] = Q[3] = 1;
      A[0] = A[3] = t.x0;
      A[1] = A[2] = t.x1;
      B[0] = B[1] = v;
      B[2] = B[3] = 0;
      // The prop's sprite: its top edge is the face's front edge.
      this.alignX = X[3];
      this.alignY = Y[3];
    } else {
      // An opening: flat on the floor (its corners' scale and height, made once).
      const k1 = cam.yw - cam.yh;
      const oc = q.corners;
      for (let c = 0; c < 4; c++) {
        const u = c === 0 || c === 3 ? q.x0 : q.x1;
        const s = oc[c * 2];
        X[c] = FLOOR_CX + (u - camX - FLOOR_CX) * s;
        Y[c] = cam.yh - camY + (k1 - oc[c * 2 + 1]) * s;
        Q[c] = s;
        A[c] = u - q.x0;
        B[c] = (c < 2 ? q.vFar : q.vNear) - q.vFar;
      }
      this.alignX = NaN;
      this.alignY = NaN;
    }
    const minX = Math.min(X[0], X[1], X[2], X[3]);
    const minY = Math.min(Y[0], Y[1], Y[2], Y[3]);
    const maxX = Math.max(X[0], X[1], X[2], X[3]);
    const maxY = Math.max(Y[0], Y[1], Y[2], Y[3]);
    if (minX > VIEW_W + 1 || maxX < -1 || minY > VIEW_H || maxY < 0) return null;
    const box = this.quadBox;
    box[0] = Math.max(-1, minX);
    box[1] = Math.max(-1, minY);
    box[2] = Math.min(VIEW_W + 1, maxX);
    box[3] = Math.min(VIEW_H + 1, maxY);
    return box;
  }

  /** The box of `projectQuad` (reused). */
  private readonly quadBox = [0, 0, 0, 0];
  /** The screen point a canvas grid is aligned to (`placeCanvas`; NaN: the renderer's 1/res grid). */
  private alignX = NaN;
  private alignY = NaN;

  /**
   * Put a canvas just left of / above a box with its grid aligned to (alignX, alignY) — the sprite the
   * quad joins, so the joined edges meet it exactly (spec §2.1: on the world's 1/res grid, not on
   * whole logical px) — or snapped to the renderer's 1/res grid; then clear it.
   */
  private placeCanvas(cv: QuadCanvas, box: readonly number[], res: number): void {
    const d = cv.d;
    const ax = this.alignX;
    const ay = this.alignY;
    const g = res >= 1 ? res : 1;
    cv.ox = ax === ax ? ax - Math.ceil((ax - box[0]) * d - 1e-9) / d : Math.floor(box[0] * g + 1e-9) / g;
    cv.oy = ay === ay ? ay - Math.ceil((ay - box[1]) * d - 1e-9) / d : Math.floor(box[1] * g + 1e-9) / g;
    cv.clear();
  }

  private drawQuads(r: Renderer, d: number, openings: boolean): void {
    const camX = r.camX;
    const camY = r.camY;
    const X = this.qx;
    const Y = this.qy;
    const Q = this.qq;
    const A = this.qa;
    const B = this.qb;
    // The quads over the floor at ≤ 2× (QUAD_MAX_DENSITY); the openings in it at the band's density.
    const dq = openings ? d : Math.min(d, QUAD_MAX_DENSITY);
    for (let i = 0; i < this.quads.length; i++) {
      const q = this.quads[i];
      if ((q.kind === 'opening') !== openings) continue;
      this.pcx = camX;
      this.pcy = camY;
      const box = this.projectQuad(q);
      const tex = box ? this.store.tile(q.tile, dq) : null;
      if (!box || !tex) {
        // Off the view: its canvas goes back to the pool.
        this.pool.release(q.cv);
        q.cv = null;
        continue;
      }
      const wc = canvasClass(Math.ceil(box[2] - box[0] + 1) + 1, CANVAS_W_CLASSES);
      let cv = q.cv;
      if (!cv || cv.d !== dq || q.wc !== wc) {
        this.pool.release(cv);
        cv = this.pool.acquire(q, wc, canvasClass(Math.ceil(q.ch), CANVAS_H_CLASSES), dq);
        q.cv = cv;
        q.wc = wc;
      }
      // A still camera (a lock, a fight): the canvas already holds this quad (no raster, no upload).
      if (cv !== q.lastCv || camX !== q.lastCamX || camY !== q.lastCamY || tex !== q.lastTex) {
        q.lastCv = cv;
        q.lastCamX = camX;
        q.lastCamY = camY;
        q.lastTex = tex;
        this.placeCanvas(cv, box, r.res);
        if (q.kind === 'opening' && q.ellipse) cv.ellipse(q.x1 - q.x0, q.vNear - q.vFar);
        else cv.ellipse(0, 0);
        cv.quad(X, Y, Q, A, B, tex, q.ellipse ? 0 : QUAD_EDGES);
      }
      if (cv.drawn) {
        this.placer.x = cv.ox + camX;
        this.placer.y = cv.oy + camY;
        this.placer.put(r, cv.frame, this.quadOpts);
      }
    }
  }

  /**
   * How many canvases of each size the quads (or the openings) and the face groups need at most at
   * once, over every camera of the section (sampled every PLAN_STEP px): wClass · 1000 + hClass →
   * count (made once per floor def).
   */
  private planCanvases(openings: boolean): Map<number, number> {
    let byDef = canvasPlans.get(this.def);
    if (!byDef) {
      byDef = new Map();
      canvasPlans.set(this.def, byDef);
    }
    const key = `${this.section.id}/${openings ? 'o' : 'q'}`;
    const known = byDef.get(key);
    if (known) return known;
    const plan = new Map<number, number>();
    const now = new Map<number, number>();
    const add = (w: number, h: number): void => {
      const k = canvasClass(Math.ceil(w + 1) + 1, CANVAS_W_CLASSES) * 1000 + canvasClass(Math.ceil(h), CANVAS_H_CLASSES);
      now.set(k, (now.get(k) ?? 0) + 1);
    };
    const last = Math.max(0, this.section.width - VIEW_W) + 8;
    for (let camX = -8; camX <= last; camX += PLAN_STEP) {
      now.clear();
      if (!openings) {
        for (const g of this.groups) {
          if (camX < g.camLo || camX > g.camHi) continue;
          this.pcx = camX;
          this.pcy = 0;
          const box = this.projectGroupAt(g);
          if (box) add(box[2] - box[0], g.ch);
        }
      }
      for (const q of this.quads) {
        if ((q.kind === 'opening') !== openings) continue;
        this.pcx = camX;
        this.pcy = 0;
        const box = this.projectQuad(q);
        if (box) add(box[2] - box[0], q.ch);
      }
      for (const [k, n] of now) if (n > (plan.get(k) ?? 0)) plan.set(k, n);
    }
    byDef.set(key, plan);
    return plan;
  }

  // ------------------------------------------------------------------------------- faces

  /**
   * Resolve a face group to the world (spec §11 R1): a corner [x, y, depth] in the anchor's sprite px
   * is the world point the anchor's decor would draw there — u = ax + x / s0, h = (yw − ay + lift + y)
   * / s0 at the anchor's depth (s0, its lift on the floor) — moved to the corner's depth. So the front
   * edge of a side meets its sprite exactly and the side recedes in true perspective. A world corner
   * [x, y, depth, 1] is u = ax + x, h = y. Per face: a column raster when it has one u (a side wall),
   * and the edges it anti-aliases (all but the ones it shares with another face of the group and a
   * receding face's front edge on its sprite: those stay hard, no seam). Then the canvas size: the
   * largest on-screen box the group ever needs (sampled over the camera), and the cameras it shows at.
   */
  private makeGroup(gd: FaceGroupDef): FaceGroup {
    const cam = this.cam;
    const n = gd.faces.length;
    const s0 = sAtDepth(cam, gd.depth);
    const lift = this.liftAt(gd.x, gd.depth);
    const g: FaceGroup = {
      def: gd,
      n,
      u: new Float64Array(n * 4),
      h: new Float64Array(n * 4),
      s: new Float64Array(n * 4),
      a: new Float64Array(n * 4),
      b: new Float64Array(n * 4),
      tile: new Int32Array(n),
      both: new Uint8Array(n),
      cols: new Uint8Array(n),
      aa: new Uint8Array(n),
      s0,
      lift0: lift,
      px: new Float64Array(n * 4),
      py: new Float64Array(n * 4),
      shown: new Uint8Array(n),
      ch: 1,
      camLo: Infinity,
      camHi: -Infinity,
      cv: null,
      wc: 0,
      lastCv: null,
      lastCamX: NaN,
      lastCamY: NaN,
      lastTex: new Array<FloorTexture | null>(n).fill(null),
    };
    // Per corner: on the anchor's sprite (sprite px at the anchor's depth)?
    const onSprite = new Uint8Array(n * 4);
    for (let f = 0; f < n; f++) {
      const fd = gd.faces[f];
      g.tile[f] = this.tileIndex(fd.tile);
      g.both[f] = fd.both ? 1 : 0;
      for (let c = 0; c < 4; c++) {
        const p = fd.pts[c] ?? fd.pts[fd.pts.length - 1];
        const [x, y, depth] = p;
        const world = p.length === 4;
        const k = f * 4 + c;
        g.u[k] = world ? gd.x + x : gd.x + x / s0;
        g.h[k] = world ? y : (cam.yw - gd.y + lift + y) / s0;
        g.s[k] = sAtDepth(cam, depth);
        onSprite[k] = !world && depth === gd.depth ? 1 : 0;
        const t = fd.tex[c] ?? [0, 0];
        g.a[k] = t[0];
        g.b[k] = t[1];
      }
    }
    const same = (i: number, j: number): boolean => Math.abs(g.u[i] - g.u[j]) < 1e-6 && Math.abs(g.h[i] - g.h[j]) < 1e-6 && Math.abs(g.s[i] - g.s[j]) < 1e-9;
    for (let f = 0; f < n; f++) {
      const k = f * 4;
      g.cols[f] = Math.abs(g.u[k] - g.u[k + 1]) < 1e-6 && Math.abs(g.u[k] - g.u[k + 2]) < 1e-6 && Math.abs(g.u[k] - g.u[k + 3]) < 1e-6 ? 1 : 0;
      const flat = onSprite[k] && onSprite[k + 1] && onSprite[k + 2] && onSprite[k + 3];
      let mask = 0;
      for (let c = 0; c < 4; c++) {
        const i = k + c;
        const j = k + ((c + 1) & 3);
        if (same(i, j)) continue;
        // A receding face's front edge on its sprite: hard (the facade covers it, no gap opens).
        if (!flat && onSprite[i] && onSprite[j]) continue;
        // An edge another face of the group shares: hard on both sides (no seam).
        let shared = false;
        for (let f2 = 0; f2 < n && !shared; f2++) {
          if (f2 === f) continue;
          for (let c2 = 0; c2 < 4 && !shared; c2++) {
            const i2 = f2 * 4 + c2;
            const j2 = f2 * 4 + ((c2 + 1) & 3);
            shared = (same(i, i2) && same(j, j2)) || (same(i, j2) && same(j, i2));
          }
        }
        if (!shared) mask |= 1 << c;
      }
      g.aa[f] = mask;
    }
    // The canvas: the largest clamped on-screen box over every camera that shows a face.
    let u0 = Infinity;
    let u1 = -Infinity;
    for (let k = 0; k < n * 4; k++) {
      u0 = Math.min(u0, g.u[k]);
      u1 = Math.max(u1, g.u[k]);
    }
    let mh = 0;
    for (let camX = Math.floor((u0 - 900) / PLAN_STEP) * PLAN_STEP; camX <= u1 + 500; camX += PLAN_STEP) {
      this.pcx = camX;
      this.pcy = 0;
      const box = this.projectGroupAt(g);
      if (box) {
        mh = Math.max(mh, box[3] - box[1]);
        if (camX < g.camLo) g.camLo = camX;
        if (camX > g.camHi) g.camHi = camX;
      }
    }
    g.ch = Math.min(VIEW_H + 4, mh + 3 + SHAKE_MARGIN);
    return g;
  }

  /** Box of the projection (clamped to the view ± 1), shared by the build and the draw. */
  private readonly groupBox = [0, 0, 0, 0];
  /** The camera `projectGroup` / `projectQuad` project for (fields: no double passes through a call). */
  private pcx = 0.5;
  private pcy = 0.5;

  /**
   * Project a group's corners for the camera (pcx, pcy) (screen px, `px` / `py`), mark the faces that show
   * (facing the eye: clockwise on screen; or both-sided) and return their box clamped to the view
   * (null: nothing shows).
   */
  projectGroup(g: FaceGroup, camX: number, camY: number): number[] | null {
    this.pcx = camX;
    this.pcy = camY;
    return this.projectGroupAt(g);
  }

  /** `projectGroup` for the camera in (pcx, pcy) (the draw path: no double through a call). */
  private projectGroupAt(g: FaceGroup): number[] | null {
    const camX = this.pcx;
    const camY = this.pcy;
    const cam = this.cam;
    const k1 = cam.yw - cam.yh;
    const eye = camX + FLOOR_CX;
    const X = g.px;
    const Y = g.py;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let f = 0; f < g.n; f++) {
      const k = f * 4;
      for (let c = 0; c < 4; c++) {
        const s = g.s[k + c];
        X[k + c] = FLOOR_CX + (g.u[k + c] - eye) * s;
        Y[k + c] = cam.yh - camY + (k1 - g.h[k + c]) * s;
      }
      // Twice the signed area (y down: positive = clockwise on screen).
      let area = 0;
      for (let c = 0; c < 4; c++) {
        const c1 = (c + 1) & 3;
        area += X[k + c] * Y[k + c1] - X[k + c1] * Y[k + c];
      }
      const show = g.both[f] ? Math.abs(area) > 0.5 : area > 0.5;
      g.shown[f] = show ? 1 : 0;
      if (!show) continue;
      for (let c = 0; c < 4; c++) {
        if (X[k + c] < minX) minX = X[k + c];
        if (X[k + c] > maxX) maxX = X[k + c];
        if (Y[k + c] < minY) minY = Y[k + c];
        if (Y[k + c] > maxY) maxY = Y[k + c];
      }
    }
    if (minX > VIEW_W + 1 || maxX < -1 || minY > VIEW_H + 1 || maxY < -1) return null;
    const box = this.groupBox;
    box[0] = Math.max(-1, minX);
    box[1] = Math.max(-1, minY);
    box[2] = Math.min(VIEW_W + 1, maxX);
    box[3] = Math.min(VIEW_H + 1, maxY);
    return box;
  }

  /**
   * Draw a face group (spec §11 R1): the faces that look at the eye, perspective-correct from their
   * tiles (the whole v-mip chain: a narrow side shows its mean colour, not noise) into a pooled
   * canvas at ≤ 2× (QUAD_MAX_DENSITY: the 4K budget) of the width class its box needs now (a side
   * narrows toward the centre: it streams only that), aligned to the anchor sprite and drawn on the
   * renderer's 1/res grid; side walls in columns. A still camera re-rasterises nothing; a group off
   * the view gives its canvas back.
   */
  private drawGroup(r: Renderer, g: FaceGroup, d: number): void {
    const camX = r.camX;
    const camY = r.camY;
    this.pcx = camX;
    this.pcy = camY;
    const box = this.projectGroupAt(g);
    if (!box) {
      this.pool.release(g.cv);
      g.cv = null;
      return;
    }
    const dq = Math.min(d, QUAD_MAX_DENSITY);
    const wc = canvasClass(Math.ceil(box[2] - box[0] + 1) + 1, CANVAS_W_CLASSES);
    let cv = g.cv;
    if (!cv || cv.d !== dq || g.wc !== wc) {
      this.pool.release(cv);
      cv = this.pool.acquire(g, wc, canvasClass(Math.ceil(g.ch), CANVAS_H_CLASSES), dq);
      g.cv = cv;
      g.wc = wc;
    }
    let same = cv === g.lastCv && camX === g.lastCamX && camY === g.lastCamY;
    for (let f = 0; f < g.n; f++) {
      const tex = g.shown[f] ? this.store.tile(g.tile[f], dq) : null;
      if (tex !== g.lastTex[f]) same = false;
      g.lastTex[f] = tex;
    }
    if (!same) {
      g.lastCv = cv;
      g.lastCamX = camX;
      g.lastCamY = camY;
      // The canvas grid on the anchor sprite's own position (its front edges meet it exactly).
      this.alignX = FLOOR_CX + (g.def.x - camX - FLOOR_CX) * g.s0;
      this.alignY = g.def.y - g.def.depth - g.lift0 - camY;
      this.placeCanvas(cv, box, r.res);
      cv.ellipse(0, 0);
      const X = this.qx;
      const Y = this.qy;
      const Q = this.qq;
      const A = this.qa;
      const B = this.qb;
      for (let f = 0; f < g.n; f++) {
        const tex = g.lastTex[f];
        if (!tex) continue;
        const k = f * 4;
        for (let c = 0; c < 4; c++) {
          X[c] = g.px[k + c];
          Y[c] = g.py[k + c];
          Q[c] = g.s[k + c];
          A[c] = g.a[k + c];
          B[c] = g.b[k + c];
        }
        cv.quad(X, Y, Q, A, B, tex, g.aa[f], g.cols[f] === 1);
      }
    }
    if (cv.drawn) {
      this.placer.x = cv.ox + camX;
      this.placer.y = cv.oy + camY;
      this.placer.put(r, cv.frame, this.quadOpts);
    }
  }

  // ------------------------------------------------------------------------------- shadows

  /**
   * Contact shadows (spec §3.7): a dithered oval on the floor under every hero, enemy and npc whose
   * feet are at most SHADOW_MAX_AIR px over it, smaller and fainter with height. Draw between
   * drawBack and world.draw.
   */
  drawShadows(r: Renderer, world: World, d: number): void {
    const strength = this.shadowStrength;
    if (strength <= 0) return;
    const t = world.terrain;
    const list = world.entities;
    const o = this.shadowOpts;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.removed || e.dead) continue;
      if (!(e.tags.has('player') || e.tags.has('enemy') || e.tags.has('npc'))) continue;
      // At a depth (drawn off the walk plane) or not drawn now (hidden under the ground, flown off).
      if (e.drawDepth !== 0 || !e.castsShadow) continue;
      const floor = t.surfaceY(e.x, e.y - 2, e.y + SHADOW_MAX_AIR);
      if (!Number.isFinite(floor)) continue;
      const air = floor - e.y;
      if (air < -2 || air > SHADOW_MAX_AIR) continue;
      const k = 1 - (0.5 * Math.max(0, air)) / SHADOW_MAX_AIR;
      const hw = e.hitbox.w;
      const w = Math.max(8, Math.min(40, Math.round(hw * 1.15 * k)));
      const h = Math.max(3, Math.round(w / 4));
      o.alpha = strength * k;
      this.placer.x = e.x;
      this.placer.y = floor;
      this.placer.put(r, this.oval(w, h, d), o);
    }
  }

  /** A dithered oval (dark core, checkered rim in its own pixel grid), anchor at its centre. */
  private oval(w: number, h: number, d: number): Frame {
    const key = (w * 64 + h) * 8 + d;
    let f = this.ovals.get(key);
    if (f) return f;
    const W = w * d;
    const H = h * d;
    const b = new PixelBuffer(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - W / 2) / (W / 2);
        const dy = (y + 0.5 - H / 2) / (H / 2);
        const q = dx * dx + dy * dy;
        if (q >= 1) continue;
        if (q > 0.55 && (x + y) & 1) continue;
        b.data[y * W + x] = 0x100b14ff;
      }
    }
    b.touch();
    f = { buf: b, ox: w / 2, oy: h / 2, density: d };
    this.ovals.set(key, f);
    return f;
  }

  // ------------------------------------------------------------------------------- overlay

  /**
   * The debug overlay (`?debug=floor`, `--floor-overlay`): depth lines every 10 px (flat ground),
   * the back edge, the walk line (the physics ground, red), the band's top and the rows' depths.
   */
  drawOverlay(r: Renderer): void {
    const cam = this.cam;
    const camY = r.camY;
    const o = this.overlayOpts;
    o.alpha = 0.35;
    for (let dpt = -40; dpt <= cam.yw - cam.back; dpt += 10) r.line(0, cam.yw - dpt - camY, VIEW_W - 1, cam.yw - dpt - camY, 0x40c0ffff, o);
    o.alpha = 0.8;
    r.line(0, cam.back - camY, VIEW_W - 1, cam.back - camY, 0x40ffc0ff, o);
    r.line(0, this.bandTop, VIEW_W - 1, this.bandTop, 0xffffffff, o);
    for (const row of this.rows) r.line(0, cam.yw - row.depth - camY, VIEW_W - 1, cam.yw - row.depth - camY, row.depth > 0 ? 0xffe040ff : 0xff8040ff, o);
    const segs = this.field.segments;
    const camX = r.camX;
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      if (sg.x1 < camX || sg.x0 > camX + VIEW_W) continue;
      r.line(sg.x0 - camX, sg.y0 - camY, sg.x1 - camX, sg.y1 - camY, 0xff3030ff, o);
    }
  }

  // ------------------------------------------------------------------------------- checks

  /**
   * Gate 5 (spec §3.6, §8): the screen boxes (logical px, camera camX / camY) of everything drawn
   * OVER the world — front decor, the props of front rows, front face groups — for a check against
   * the heroes' heads and guns. Not for the frame path (it allocates).
   */
  frontBoxes(camX: number, camY: number): FrontBox[] {
    const out: FrontBox[] = [];
    const cam = this.cam;
    const k1 = cam.yw - cam.yh;
    for (const e of this.frontList) {
      if (e.decor) {
        const d = e.decor;
        const p = d.parallax ?? 1;
        const x = p !== 1 ? d.x + camX * (1 - p) : e.depth === 0 ? d.x : d.x * e.s + (camX + FLOOR_CX) * (1 - e.s);
        const y = p !== 1 ? d.y + camY * (1 - p) - e.depth : e.depth === 0 ? d.y : d.y - e.depth - e.lift;
        const f = getFrame(d.sprite, d.frame ?? 0, 1);
        const w = frameW(f);
        const left = d.flipX ? x - (w - 1 - f.ox) : x - f.ox;
        out.push({ what: `decor ${d.sprite} @${d.x}`, x0: left - camX, y0: y - f.oy - camY, x1: left + w - camX, y1: y - f.oy + frameH(f) - camY, f, flip: d.flipX === true });
      } else if (e.row) {
        const row = e.row;
        const f = this.rowFrame(row, 1);
        if (!f) continue;
        const w = frameW(f);
        for (let i = 0; i < row.u.length; i++) {
          const x = row.u[i] * row.s + (camX + FLOOR_CX) * (1 - row.s) - camX;
          if (x < -64 || x > VIEW_W + 64) continue;
          const y = cam.yh + (k1 - row.h[i]) * row.s - camY;
          out.push({ what: `row ${row.def.name ?? row.index} @${row.u[i]}`, x0: x - f.ox, y0: y - f.oy, x1: x - f.ox + w, y1: y - f.oy + frameH(f), f, flip: row.def.flipX === true });
        }
      } else if (e.group) {
        const box = this.projectGroup(e.group, camX, camY);
        if (box) out.push({ what: `faces ${e.group.def.name ?? ''}`, x0: box[0], y0: box[1], x1: box[2], y1: box[3] });
      }
    }
    return out;
  }

  // ------------------------------------------------------------------------------- depth

  /**
   * Draw an entity at its `drawDepth` (render only, spec §3.7): the shift and speed of that depth,
   * no scaling. The world's draw calls it through `World.depthDraw`.
   */
  drawAtDepth(r: Renderer, e: Entity, world: World): void {
    const depth = e.drawDepth;
    const s = sAtDepth(this.cam, depth);
    const camX = r.camX;
    const camY = r.camY;
    // Screen x of e.x at the depth: 192 + (x − camX − 192)·s; y moves up by the depth (and the
    // floor's lift there, as the decor at that depth: a waver stays in its window).
    r.setCamera(e.x - FLOOR_CX - (e.x - camX - FLOOR_CX) * s, camY + depth + this.liftAt(e.x, depth));
    try {
      e.draw(r);
    } finally {
      r.setCamera(world.camera.viewX, world.camera.viewY);
    }
  }
}

/** The best texture lookups of one frame (the store's `chunk` / `tile` at the frame's density). */
class FrameState implements FloorFrame {
  readonly cam: FloorCam;
  readonly mesh: FloorMesh;
  readonly materials: readonly FloorMaterial[];
  camX = 0;
  camY = 0;
  eyeU = FLOOR_CX;
  tick = 0;
  density = 1;
  bandTop = 0;
  bandH = 0;
  q0 = 0;
  q1 = 0;
  storeVersion = 0;
  /** The texture density wanted (the band's density). */
  want = 1;
  private readonly floor: SectionFloor;

  constructor(floor: SectionFloor) {
    this.floor = floor;
    this.cam = floor.cam;
    this.mesh = floor.mesh;
    this.materials = floor.materials;
  }

  chunk(k: number): FloorTexture | null {
    return this.floor.store.chunk(k, this.want);
  }

  tile(i: number): FloorTexture | null {
    return this.floor.store.tile(i, this.want);
  }
}


/**
 * A chain frame: links along a sagging curve from (0, 0) to (span, 0) (logical px), density d,
 * anchor at the left end. Alternating light / dark links.
 */
export function chainFrame(span: number, sag: number, colors: readonly [Color, Color], d: number): Frame {
  const top = Math.ceil(Math.max(0, sag) + 2);
  const W = Math.max(1, Math.ceil(span + 2)) * d;
  const H = (top + 2) * d;
  const b = new PixelBuffer(W, H);
  const n = Math.max(2, Math.round(span * d * 0.75));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 + span * t) * d;
    const y = (1 + sag * 4 * t * (1 - t)) * d;
    const c = i & 1 ? colors[1] : colors[0];
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi >= 0 && xi < W && yi >= 0 && yi < H) b.data[yi * W + xi] = c >>> 0;
    if (d >= 2 && xi + 1 < W && yi < H) b.data[yi * W + xi + 1] = c >>> 0;
  }
  b.touch();
  return { buf: b, ox: 1, oy: 1, density: d };
}

