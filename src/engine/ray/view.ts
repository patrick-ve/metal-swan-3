/**
 * The first-person view: ceiling / floor colours, textured wall columns (perpendicular
 * distance, no fisheye) and billboards sorted far → near with a per-column z-buffer test.
 * Renders into a reused `PixelBuffer`; no allocations per frame (the sprite order arrays grow
 * only when a scene has more sprites than ever before). Walls and billboards are drawn column by
 * column, so they go to a column-major scratch first (sequential writes) and one cache-friendly
 * tiled transpose writes the buffer (at density 2 about half the time of writing the buffer's
 * columns directly, measured 2026-10-20; the pixels are the same).
 *
 * A view of density D (buffer w·D × h·D, the same 66° field) samples the highest texture and
 * billboard LEVEL installed at a density ≤ D (textures.ts `rayTextureLevel`, `billboardLevel`), so
 * the dense art (UHD) adds texels without changing any logical size; with only 1× levels it draws
 * the 1× texels, enlarged. The 1× view fills the ceiling and the floor flat; a dense view steps
 * them down their HD ramp toward the horizon (`depthTones`), a depth cue from the same template.
 */
import type { Color } from '../color';
import { hdHome } from '../palette-hd';
import { PixelBuffer } from '../pixel';
import { castRay, newRayHit, type RayHit } from './cast';
import { ANG_MASK, COS, SIN } from './fixed';
import type { DoorTable, PushWall, RayGrid } from './grid';
import { billboardLevel, billboardSlot, rayTextureLevel, type RayBillboard } from './textures';

export const RAY_VIEW_W = 384;
export const RAY_VIEW_H = 176;
export const RAY_FOCAL = 296;
/** Rays stop after this many tiles (an open, wall-less view shows ceiling and floor there). */
const VIEW_MAX_DIST = 128;
/** Billboards nearer than this (in tiles, along the view) are not drawn. */
const NEAR_CLIP = 0.05;

export class RayView {
  /** Logical size (the art size); the buffer is w·density × h·density. */
  readonly w: number;
  readonly h: number;
  readonly density: number;
  readonly buf: PixelBuffer;
  /** Perpendicular wall distance per buffer column (Infinity when no wall). */
  readonly zbuf: Float64Array;
  /** Focal length in buffer pixels: RAY_FOCAL × buffer width / RAY_VIEW_W (same 66° field at any size). */
  readonly focal: number;
  /** Camera-plane factor per buffer column: (x + 0.5 − W/2) / focal. */
  readonly colK: Float64Array;
  /** @internal reused cast result. */
  readonly hit: RayHit = newRayHit();
  /**
   * @internal The frame column-major (`cm[x × h + y]`, buffer px), then one template column
   * (ceiling / floor / transparent rows) at `w × h`.
   */
  readonly cm: Uint32Array;
  /** @internal sprite order (indices) and depths, grown on demand. */
  order: Int32Array = new Int32Array(256);
  depth: Float64Array = new Float64Array(256);

  constructor(w = RAY_VIEW_W, h = RAY_VIEW_H, density = 1) {
    this.w = Math.max(1, w | 0);
    this.h = Math.max(1, h | 0);
    this.density = Math.max(1, density | 0);
    const bw = this.w * this.density;
    const bh = this.h * this.density;
    this.buf = new PixelBuffer(bw, bh);
    this.cm = new Uint32Array(bw * bh + bh);
    this.zbuf = new Float64Array(bw);
    this.focal = (RAY_FOCAL * bw) / RAY_VIEW_W;
    this.colK = new Float64Array(bw);
    for (let x = 0; x < bw; x++) this.colK[x] = (x + 0.5 - bw / 2) / this.focal;
  }
}

export interface RayCamera {
  x: number;
  y: number;
  /** Integer angle 0..4095 (0 east, 1024 south). */
  angle: number;
  /** Eye height in tiles (0.5 = mid wall). Lower = the camera sinks toward the floor. */
  eyeZ: number;
  /** Vertical scale 0..1 around the horizon (the unfold; default 1). Rows outside stay TRANSPARENT. */
  squash?: number;
}

export interface RaySprite {
  x: number;
  y: number;
  bb: RayBillboard;
  frame: number;
  /** 0..7 (see `billboardYaw`); ignored for 1-yaw billboards. */
  yaw: number;
}

export interface RayScene {
  grid: RayGrid;
  doors: DoorTable;
  push: PushWall | null;
  ceil: Color;
  floor: Color;
  /** Only the first `spriteCount` entries are drawn. */
  sprites: RaySprite[];
  spriteCount: number;
}

/**
 * Dense views only (density ≥ 2, UHD): the ceiling and the floor show four bands of their HD
 * ramp by the row's distance from the horizon in LOGICAL rows (the same rows at every density):
 * one tone lighter near the camera (more than DEPTH_ROWS[0] rows from the horizon), the scene
 * colour, then one and two tones darker (and cooler: the ramps are hue-shifted) toward the
 * horizon. About 3.4, 6.7 and 15 tiles away at eye height 0.5. A colour outside the 64 palette
 * keeps its flat fill. Cached per colour; the 1× view never calls it.
 */
const DEPTH_ROWS = [44, 22, 10] as const;
const depthCache = new Map<Color, Uint32Array>();

export function depthTones(c: Color): Uint32Array {
  let t = depthCache.get(c);
  if (!t) {
    const home = hdHome(c);
    const at = (i: number): number => (home ? home.ramp[Math.max(0, Math.min(home.ramp.length - 1, i))] : c) >>> 0;
    const i = home?.i ?? 0;
    t = Uint32Array.of(at(i + 1), c >>> 0, at(i - 1), at(i - 2));
    depthCache.set(c, t);
  }
  return t;
}

/** Render one frame of `scene` from `cam` into `view.buf` (and `view.zbuf`); ends with `buf.touch()`. */
export function renderView(view: RayView, scene: RayScene, cam: RayCamera): void {
  const buf = view.buf;
  const data = buf.data;
  const W = buf.w;
  const H = buf.h;
  const F = view.focal;
  const zbuf = view.zbuf;
  const colK = view.colK;
  const hit = view.hit;
  const D = view.density;

  const a = cam.angle & ANG_MASK;
  const dirX = COS[a];
  const dirY = SIN[a];
  // Camera plane = the view's right (angle + 90°).
  const plX = -dirY;
  const plY = dirX;
  const px = cam.x;
  const py = cam.y;
  const eyeZ = cam.eyeZ;
  let s = cam.squash ?? 1;
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  const hz = H / 2;

  let bandTop = Math.round(hz - hz * s);
  let bandBot = Math.round(hz + hz * s);
  if (bandTop < 0) bandTop = 0;
  if (bandBot > H) bandBot = H;
  if (bandBot <= bandTop) bandBot = bandTop + 1;
  const hzRow = Math.floor(hz);

  // Ceiling and floor: the template column, copied into every column (doubling copies).
  const cm = view.cm;
  const tpl = W * H;
  cm.fill(0, tpl, tpl + bandTop);
  if (D > 1) {
    // Dense view: the bands of `depthTones` by the row's logical distance from the horizon.
    const ct = depthTones(scene.ceil);
    const ft = depthTones(scene.floor);
    for (let y = bandTop; y < bandBot; y++) {
      const o = Math.abs(y + 0.5 - hz) / D;
      const b = o > DEPTH_ROWS[0] ? 0 : o > DEPTH_ROWS[1] ? 1 : o > DEPTH_ROWS[2] ? 2 : 3;
      cm[tpl + y] = (y < hzRow ? ct : ft)[b];
    }
  } else {
    cm.fill(scene.ceil >>> 0, tpl + bandTop, tpl + hzRow);
    cm.fill(scene.floor >>> 0, tpl + hzRow, tpl + bandBot);
  }
  cm.fill(0, tpl + bandBot, tpl + H);
  cm.copyWithin(0, tpl, tpl + H);
  for (let done = H; done < tpl; done *= 2) cm.copyWithin(done, 0, Math.min(done, tpl - done));

  // Walls and doors.
  const g = scene.grid;
  const doors = scene.doors;
  const push = scene.push;
  for (let x = 0; x < W; x++) {
    const k = colK[x];
    const rdx = dirX + plX * k;
    const rdy = dirY + plY * k;
    if (!castRay(g, doors, push, px, py, rdx, rdy, hit, VIEW_MAX_DIST)) {
      zbuf[x] = Infinity;
      continue;
    }
    const dist = hit.dist < 1e-4 ? 1e-4 : hit.dist;
    zbuf[x] = dist;
    const scale = (F * s) / dist;
    const top = hz - (1 - eyeZ) * scale;
    const bottom = hz + eyeZ * scale;
    let y0 = Math.ceil(top - 0.5);
    let y1 = Math.ceil(bottom - 0.5);
    if (y0 < bandTop) y0 = bandTop;
    if (y1 > bandBot) y1 = bandBot;
    if (y1 <= y0) continue;
    const lv = rayTextureLevel(hit.tex, D, D > 1 ? bottom - top : 0);
    const T = lv.size;
    const cols = hit.side === 1 ? lv.dark : lv.cols;
    let tu = (hit.u * T) | 0;
    if (tu < 0) tu = 0;
    else if (tu > T - 1) tu = T - 1;
    const base = tu * T;
    const step = T / (bottom - top);
    let vpos = (y0 + 0.5 - top) * step;
    let o = x * H + y0;
    for (let y = y0; y < y1; y++) {
      let v = vpos | 0;
      if (v > T - 1) v = T - 1;
      cm[o++] = cols[base + v];
      vpos += step;
    }
  }

  // Billboards, far → near.
  const sprites = scene.sprites;
  let n = scene.spriteCount;
  if (n > sprites.length) n = sprites.length;
  if (n > view.order.length) {
    let cap = view.order.length;
    while (cap < n) cap *= 2;
    view.order = new Int32Array(cap);
    view.depth = new Float64Array(cap);
  }
  const order = view.order;
  const depth = view.depth;
  for (let i = 0; i < n; i++) {
    const sp = sprites[i];
    depth[i] = (sp.x - px) * dirX + (sp.y - py) * dirY;
    // Insertion sort: depth descending, then index ascending (deterministic).
    let j = i - 1;
    while (j >= 0 && depth[order[j]] < depth[i]) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = i;
  }

  for (let oi = 0; oi < n; oi++) {
    const si = order[oi];
    const d = depth[si];
    if (d <= NEAR_CLIP) continue;
    const sp = sprites[si];
    const bb = sp.bb;
    const lat = (sp.x - px) * plX + (sp.y - py) * plY;
    const blv = billboardLevel(bb, D);
    const size = blv.size;
    const wpx = (F * bb.worldW) / d;
    const hpx = (F * bb.worldH * s) / d;
    if (wpx <= 0 || hpx <= 0) continue;
    const centreX = W / 2 + (F * lat) / d;
    const left = centreX - wpx / 2;
    const bottom = hz + (eyeZ * F * s) / d;
    const top = bottom - hpx;
    let x0 = Math.ceil(left - 0.5);
    let x1 = Math.ceil(left + wpx - 0.5);
    if (x0 < 0) x0 = 0;
    if (x1 > W) x1 = W;
    if (x1 <= x0) continue;
    const k = billboardSlot(bb, sp.frame, sp.yaw);
    const cols = blv.cols[k];
    const firsts = blv.first[k];
    const lasts = blv.last[k];
    const uStep = size / wpx;
    const vStep = size / hpx;
    const rowH = hpx / size;
    for (let x = x0; x < x1; x++) {
      if (zbuf[x] <= d) continue;
      let u = ((x + 0.5 - left) * uStep) | 0;
      if (u < 0) u = 0;
      else if (u > size - 1) u = size - 1;
      const first = firsts[u];
      if (first === 0xffff) continue;
      const last = lasts[u];
      let ys = Math.ceil(top + first * rowH - 0.5);
      let ye = Math.ceil(top + (last + 1) * rowH - 0.5);
      if (ys < bandTop) ys = bandTop;
      if (ye > bandBot) ye = bandBot;
      if (ye <= ys) continue;
      const base = u * size;
      let vpos = (ys + 0.5 - top) * vStep;
      let o = x * H + ys;
      for (let y = ys; y < ye; y++) {
        let v = vpos | 0;
        if (v > last) v = last;
        const c = cols[base + v];
        if ((c & 255) !== 0) cm[o] = c;
        vpos += vStep;
        o++;
      }
    }
  }

  // Column-major → the buffer, in TILE × TILE tiles (both sides stay in the cache).
  for (let by = 0; by < H; by += TILE) {
    const ye = by + TILE < H ? by + TILE : H;
    for (let bx = 0; bx < W; bx += TILE) {
      const xe = bx + TILE < W ? bx + TILE : W;
      for (let y = by; y < ye; y++) {
        let o = y * W + bx;
        let i = bx * H + y;
        for (let x = bx; x < xe; x++) {
          data[o++] = cm[i];
          i += H;
        }
      }
    }
  }
  buf.touch();
}

/** Tile side of the transpose (buffer px). */
const TILE = 32;
