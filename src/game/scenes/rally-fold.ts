/**
 * The fold of the glitch into 3D (docs/design/rally.md §1.2; docs/api/rally.md "A.I"): the broken 2D
 * picture, cut into flat-colour tiles of `FOLD_TILE` logical px, becomes a set of flat polygons in
 * front of each player's camera that fold down into the 3D start grid.
 *
 * - `foldTiles(players)`: the tile grid — per player view (1P: the whole 384 × 216; 2P: the two
 *   384 × 108 views) rows and columns of `FOLD_TILE` px from the view's corner, the last ones
 *   clipped. RallyGlitchScene flattens the picture into these same tiles (the 2D mosaic) before the
 *   RallyScene takes over, so the hand-over shows no seam.
 * - `RallyFold`: the tiles as flat quads on one page (four texels per tile: its average colour at
 *   four flat shades, `SHADES`; a CLUT row holds 64 tiles), batched into a few dynamic meshes (one per
 *   view and CLUT row: at most 7, so the fold costs a handful of draw calls, §7.3) whose vertices are
 *   written in world space every frame (`View3d.updateMesh`). Emissive and two-sided. At fold tick 0
 *   every tile sits on a plane `FOLD_PLANE` m in front of its view's camera and covers its own
 *   rectangle of the picture exactly (the vertex snap puts its edges on the 1× grid). Each tile then,
 *   after its own delay (a sweep from the bottom middle up, plus a cosmetic jitter), slides away along
 *   its own view ray (its screen footprint stays; a tile above the horizon drops onto the road far
 *   ahead), tips forward (+x axis: the top edge away) until it lies flat on the ground, catching the
 *   light in flat shades as it turns (its texel moves to the next shade), and is gone (a degenerate
 *   quad) — the 3D grid behind shows through. All tiles are gone by `FOLD_TICKS`.
 *
 * Cosmetic only: the race does not step while the fold runs (RallyScene), the jitter is a hash of
 * the tile index, and no rng is touched. The meshes and their vertex arrays are made once; `fill`
 * writes them in place and allocates nothing.
 */
import type { PixelBuffer } from '../../engine/pixel';
import { mat4Multiply, mat4PoseYPR } from '../../engine/r3/mat';
import { cosT, sinT, tanT } from '../../engine/r3/trig';
import type { Cam3, DrawItem, Mesh3, TexturePage, View3d } from '../../engine/view3d';
import { PAGE_IDS } from '../rally/ids';

/** Tile size (logical px). */
export const FOLD_TILE = 16;
/** All tiles are gone after this many ticks. */
export const FOLD_TICKS = 54;
/** One tile's own fold (ticks). */
const TILE_TICKS = 20;
/** The plane the tiles start on (m in front of the camera; past the near plane of 0.5 m). */
export const FOLD_PLANE = 1;
/** The ground under the camera (m below it) and the farthest a tile travels (m). */
const GROUND = 2.5;
const FAR = 40;
/** The fold's page id (the fx range, `PAGE_IDS.fx`). */
export const FOLD_PAGE = PAGE_IDS.fx;
/**
 * The shades of a tile as it tips: its colour mixed this much toward the race's haze (`FOLD_HAZE`),
 * a flat-shaded polygon catching the light (a black tile of the card reads as a polygon too).
 */
const SHADES = [0, 0.16, 0.32, 0.48] as const;
/** The haze the tiles light toward (the race light's fog colour, rally.ts RALLY_LIGHT). */
const FOLD_HAZE = [189, 204, 219] as const;

/** One tile: its view and its rectangle in logical px (inside 384 × 216). */
export interface FoldTile {
  readonly view: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The player views' rectangles (1P: one; 2P: P1 on top, P2 below). */
export function foldViews(players: number): readonly { x: number; y: number; w: number; h: number }[] {
  return players > 1
    ? [
        { x: 0, y: 0, w: 384, h: 108 },
        { x: 0, y: 108, w: 384, h: 108 },
      ]
    : [{ x: 0, y: 0, w: 384, h: 216 }];
}

/** The tile grid of `players` views (see the header). */
export function foldTiles(players: number): FoldTile[] {
  const out: FoldTile[] = [];
  foldViews(players).forEach((v, view) => {
    for (let y = 0; y < v.h; y += FOLD_TILE) {
      for (let x = 0; x < v.w; x += FOLD_TILE) out.push({ view, x: v.x + x, y: v.y + y, w: Math.min(FOLD_TILE, v.w - x), h: Math.min(FOLD_TILE, v.h - y) });
    }
  });
  return out;
}

/** The average colour (0xRRGGBBAA, opaque) of a tile of a picture at density `d` (picture.w = 384·d). */
export function tileColour(pic: PixelBuffer, t: FoldTile): number {
  const d = Math.max(1, Math.round(pic.w / 384));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x1 = Math.min(pic.w, (t.x + t.w) * d);
  const y1 = Math.min(pic.h, (t.y + t.h) * d);
  for (let y = t.y * d; y < y1; y++) {
    const o = y * pic.w;
    for (let x = t.x * d; x < x1; x++) {
      const c = pic.data[o + x] >>> 0;
      r += c >>> 24;
      g += (c >>> 16) & 0xff;
      b += (c >>> 8) & 0xff;
      n++;
    }
  }
  if (n === 0) return 0x000000ff;
  return ((Math.round(r / n) << 24) | (Math.round(g / n) << 16) | (Math.round(b / n) << 8) | 0xff) >>> 0;
}

/** A 32-bit hash of the tile index (the cosmetic jitter; no rng). */
function hash(i: number): number {
  let h = Math.imul(i ^ 0x5bd1e995, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/** Tiles per CLUT row (four shades each: 256 entries) and per page row (64 texels wide). */
const ROW_TILES = 64;
const PAGE_TILES = 16;

/** One batched mesh: a view's tiles of one CLUT row. */
interface FoldBatch {
  readonly mesh: Mesh3;
  readonly item: DrawItem;
  /** The tile indices in the mesh's quad order. */
  readonly tiles: Int32Array;
}

export class RallyFold {
  readonly tiles: readonly FoldTile[];
  readonly meshes: readonly Mesh3[];
  readonly page: TexturePage;
  /** The batches of each view (index = view). */
  private readonly batches: FoldBatch[][] = [[], []];
  private readonly delay: Float64Array;
  private readonly roll: Float64Array;
  /** Scratch: the camera's world matrix, a tile's local one and their product. */
  private readonly cw = new Float32Array(16);
  private readonly loc = new Float32Array(16);
  private readonly mw = new Float32Array(16);

  /** `pic`: the broken picture (384·d × 216·d); `players`: the views (the tile grid). */
  constructor(pic: PixelBuffer, players: number) {
    const tiles = foldTiles(players);
    this.tiles = tiles;
    const n = tiles.length;
    const rows = Math.max(1, Math.ceil(n / ROW_TILES));
    const pw = PAGE_TILES * SHADES.length;
    const ph = Math.max(1, Math.ceil(n / PAGE_TILES));
    const index = new Uint8Array(pw * ph);
    const clut = new Uint32Array(rows * 256);
    this.delay = new Float64Array(n);
    this.roll = new Float64Array(n);
    // The sweep: from the bottom middle of each view, upward and outward.
    const views = foldViews(players);
    for (let i = 0; i < n; i++) {
      const t = tiles[i];
      const c = tileColour(pic, t);
      const row = Math.floor(i / ROW_TILES);
      const tx = (i % PAGE_TILES) * SHADES.length;
      const ty = Math.floor(i / PAGE_TILES);
      for (let s = 0; s < SHADES.length; s++) {
        const k = SHADES[s];
        const r = Math.round((c >>> 24) + (FOLD_HAZE[0] - (c >>> 24)) * k);
        const g = Math.round(((c >>> 16) & 0xff) + (FOLD_HAZE[1] - ((c >>> 16) & 0xff)) * k);
        const b = Math.round(((c >>> 8) & 0xff) + (FOLD_HAZE[2] - ((c >>> 8) & 0xff)) * k);
        const e = (i % ROW_TILES) * SHADES.length + s;
        clut[row * 256 + e] = ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0;
        index[ty * pw + tx + s] = e;
      }
      const vr = views[t.view];
      const fromBottom = (vr.y + vr.h - (t.y + t.h / 2)) / FOLD_TILE;
      const fromMid = Math.abs(t.x + t.w / 2 - (vr.x + vr.w / 2)) / FOLD_TILE;
      const h = hash(i);
      this.delay[i] = fromBottom * (players > 1 ? 3 : 1.6) + fromMid * 0.45 + (h & 7);
      this.roll[i] = (((h >>> 8) & 255) / 255 - 0.5) * 0.5;
    }
    // The batches: per view, the tiles of each CLUT row in one mesh.
    const meshes: Mesh3[] = [];
    for (let view = 0; view < views.length; view++) {
      for (let row = 0; row < rows; row++) {
        const list: number[] = [];
        for (let i = row * ROW_TILES; i < Math.min(n, (row + 1) * ROW_TILES); i++) if (tiles[i].view === view) list.push(i);
        if (list.length === 0) continue;
        const q = list.length;
        const idx = new Uint16Array(q * 6);
        for (let j = 0; j < q; j++) {
          const o = j * 4;
          idx.set([o, o + 1, o + 2, o, o + 2, o + 3], j * 6);
        }
        const mesh: Mesh3 = {
          id: `fold/${view}/${row}`,
          pos: new Float32Array(q * 12),
          uv: new Float32Array(q * 8),
          rgb: new Uint8Array(q * 12).fill(128),
          idx,
          page: FOLD_PAGE,
          clutRow: row,
          blend: 'opaque',
          twoSided: true,
          emissive: true,
          dynamic: true,
        };
        meshes.push(mesh);
        this.batches[view].push({ mesh, item: { mesh: mesh.id, m: null }, tiles: Int32Array.from(list) });
      }
    }
    this.meshes = meshes;
    this.page = { id: FOLD_PAGE, w: pw, h: ph, index, clut };
  }

  /** The mesh ids (to release after the fold). */
  get meshIds(): string[] {
    return this.meshes.map((m) => m.id);
  }

  /**
   * Write view `view`'s tiles at fold tick `t` into its batched meshes (in place; `v3.updateMesh`
   * sends them to the 3D view) and the batches with a tile still folding into `out` from `from` (the
   * camera `cam`, the view's size `w` × `h` logical px); returns the new length. No allocation.
   */
  fill(t: number, view: number, cam: Readonly<Cam3>, w: number, h: number, out: DrawItem[], from: number, v3?: Pick<View3d, 'updateMesh'>): number {
    const tiles = this.tiles;
    mat4PoseYPR(this.cw, cam.pos[0], cam.pos[1], cam.pos[2], cam.yaw, cam.pitch, cam.roll);
    const hh = FOLD_PLANE * tanT(cam.fovY / 2);
    const hw = (hh * w) / h;
    const vy0 = view === 1 ? 108 : 0;
    const loc = this.loc;
    const mw = this.mw;
    const batches = this.batches[view] ?? [];
    let k = from;
    for (let bi = 0; bi < batches.length; bi++) {
      const bt = batches[bi];
      const pos = bt.mesh.pos as Float32Array;
      const uv = bt.mesh.uv as Float32Array;
      let live = 0;
      for (let j = 0; j < bt.tiles.length; j++) {
        const i = bt.tiles[j];
        const tile = tiles[i];
        const p = (t - this.delay[i]) / TILE_TICKS;
        const o = j * 12;
        if (p >= 1) {
          // Gone: a degenerate quad at the camera (nothing to draw).
          for (let c = 0; c < 4; c++) {
            pos[o + c * 3] = cam.pos[0];
            pos[o + c * 3 + 1] = cam.pos[1];
            pos[o + c * 3 + 2] = cam.pos[2];
          }
          continue;
        }
        live++;
        const q = p <= 0 ? 0 : p;
        // The tile's centre on the start plane (camera space: +x left, +y up, +z forward).
        const uc = (tile.x + tile.w / 2) / w;
        const vc = (tile.y - vy0 + tile.h / 2) / h;
        const x0 = (1 - 2 * uc) * hw;
        const y0 = (1 - 2 * vc) * hh;
        // Where it lands: the ground under its own ray (it slides along the ray: its screen footprint
        // stays), or, above the horizon, the ground far ahead (it drops onto the road).
        const ground = y0 < -GROUND / FAR;
        const zt = ground ? (GROUND * FOLD_PLANE) / -y0 : FAR;
        const xt = (x0 * zt) / FOLD_PLANE;
        const yt = ground ? (y0 * zt) / FOLD_PLANE : -GROUND;
        const slide = q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q);
        const px = x0 + (xt - x0) * slide;
        const py = y0 + (yt - y0) * slide;
        const z = FOLD_PLANE + (zt - FOLD_PLANE) * slide;
        const sc = z / FOLD_PLANE;
        const a = q * q * 1.5708;
        const b = this.roll[i] * sinT(q * 3.1416);
        const ca = cosT(a), sa = sinT(a), cb = cosT(b), sb = sinT(b);
        const sx = ((tile.w / w) * 2 * hw) * sc;
        const sy = ((tile.h / h) * 2 * hh) * sc;
        // local = translate(x0·sc, y0·sc, z) · rotateX(a) · rotateZ(b) · scale(sx, sy, 1).
        loc[0] = cb * sx;
        loc[1] = ca * sb * sx;
        loc[2] = sa * sb * sx;
        loc[3] = 0;
        loc[4] = -sb * sy;
        loc[5] = ca * cb * sy;
        loc[6] = sa * cb * sy;
        loc[7] = 0;
        loc[8] = 0;
        loc[9] = -sa;
        loc[10] = ca;
        loc[11] = 0;
        loc[12] = px;
        loc[13] = py;
        loc[14] = z;
        loc[15] = 1;
        mat4Multiply(mw, this.cw, loc);
        // The four corners (−½, −½), (½, −½), (½, ½), (−½, ½) in world space.
        for (let c = 0; c < 4; c++) {
          const lx = c === 1 || c === 2 ? 0.5 : -0.5;
          const ly = c >= 2 ? 0.5 : -0.5;
          pos[o + c * 3] = mw[0] * lx + mw[4] * ly + mw[12];
          pos[o + c * 3 + 1] = mw[1] * lx + mw[5] * ly + mw[13];
          pos[o + c * 3 + 2] = mw[2] * lx + mw[6] * ly + mw[14];
        }
        // Its shade: the texel of that shade (the centre of the texel).
        const shade = Math.min(SHADES.length - 1, Math.floor(sa * SHADES.length));
        const u = (i % PAGE_TILES) * SHADES.length + shade + 0.5;
        const v = Math.floor(i / PAGE_TILES) + 0.5;
        const ou = j * 8;
        for (let c = 0; c < 4; c++) {
          uv[ou + c * 2] = u;
          uv[ou + c * 2 + 1] = v;
        }
      }
      if (live === 0) continue;
      v3?.updateMesh?.(bt.mesh.id);
      out[k++] = bt.item;
    }
    out.length = k;
    return k;
  }

  /** Is the fold over at tick t? */
  done(t: number): boolean {
    return t >= FOLD_TICKS;
  }
}
