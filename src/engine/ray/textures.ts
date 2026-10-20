/**
 * Raycaster texture and billboard registry. Content modules register generators (code-generated
 * `PixelBuffer`s); the data is built on first use or ahead of time by `prepareRayAssets`.
 *
 * - Wall / door textures: 64 × 64, opaque, stored column-major (`cols[u × 64 + v]`) plus a dark
 *   variant (`stepShade(c, −1)` per texel) for y-side faces.
 * - Billboards: size² texels per (frame, yaw), column-major, with a Uint16 span per column
 *   (`first << 8 | last` opaque row; `0xFFFF` = empty column). With `yaws: 8` the generator renders
 *   yaws 0..4 and yaws 5, 6, 7 are the mirrors of 3, 2, 1.
 * - Missing ids and failing generators never crash: a 64 × 64 magenta / ink checker, one warning
 *   per id.
 * - Dense LEVELS (UHD art, density d = 2 or 4): content installs a texture's art at (64·d)² with
 *   `installRayTextureHd` (and its y-side variant, painted or two HD ramp steps down) and a
 *   billboard's frames at (size·d)² with `installRayBillboardHd`. A view of density D draws the
 *   highest installed level ≤ D (`rayTextureLevel`, `billboardLevel`); the world size and every
 *   logical size stay the 1× ones, so a level only adds texels. Nothing installed: the 1× level.
 */
import { MAGENTA, type Color } from '../color';
import { INK, stepShade } from '../palette';
import { hdHome } from '../palette-hd';
import { PixelBuffer } from '../pixel';
import { ANG_MASK, angleTo } from './fixed';

export const RAY_TEX = 64;

const warned = new Set<string>();
function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

/** 64 × 64 magenta / ink checker (8-px squares). */
function checker(size = RAY_TEX): PixelBuffer {
  const b = new PixelBuffer(size, size);
  const cell = size >> 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      b.data[y * size + x] = ((((x / cell) | 0) + ((y / cell) | 0)) & 1) === 0 ? MAGENTA : INK;
    }
  }
  return b.touch();
}

// ------------------------------------------------------------------------------------ textures

/** One density level of a wall / door texture: column-major texels (`cols[u × size + v]`). */
export interface RayTexLevel {
  /** Texels per logical texel (1, 2 or 4). */
  readonly density: number;
  /** Texels per side: 64 × density. */
  readonly size: number;
  readonly cols: Uint32Array;
  /** The y-side variant. */
  readonly dark: Uint32Array;
}

interface TexEntry {
  id: string;
  gen: (() => PixelBuffer) | null;
  cols: Uint32Array | null;
  dark: Uint32Array | null;
  error: string | null;
  /** The 1× level (made with cols / dark). */
  lv1: RayTexLevel | null;
  /** Installed dense levels: [2] and [4]. */
  hd: Array<RayTexLevel | null>;
}

const FALLBACK_ID = '#fallback';
const newTex = (id: string, gen: (() => PixelBuffer) | null): TexEntry => ({ id, gen, cols: null, dark: null, error: null, lv1: null, hd: [] });
const texList: TexEntry[] = [newTex(FALLBACK_ID, () => checker())];
const texIndex = new Map<string, number>();

/** Register (or replace, keeping its index) a 64 × 64 wall / door texture generator. */
export function defineRayTexture(id: string, gen: () => PixelBuffer): void {
  const i = texIndex.get(id);
  if (i !== undefined) {
    const e = texList[i];
    e.gen = gen;
    e.cols = null;
    e.dark = null;
    e.error = null;
    e.lv1 = null;
    e.hd = [];
    return;
  }
  texIndex.set(id, texList.length);
  texList.push(newTex(id, gen));
}

/** Stable small int (definition order, from 1); unknown id → 0, the magenta fallback (+ one warning). */
export function rayTextureIndex(id: string): number {
  const i = texIndex.get(id);
  if (i !== undefined) return i;
  warnOnce(`tex:${id}`, `[ray] unknown texture "${id}" — drawing the magenta fallback`);
  return 0;
}

export function hasRayTexture(id: string): boolean {
  return texIndex.has(id);
}

/** Id of a texture index ('#fallback' for 0 and unknown indices). */
export function rayTextureId(index: number): string {
  return texList[index]?.id ?? FALLBACK_ID;
}

/** Number of texture slots (the fallback included); valid indices are 0..count−1. */
export function rayTextureCount(): number {
  return texList.length;
}

function buildTexture(e: TexEntry): void {
  let src: PixelBuffer;
  try {
    if (!e.gen) throw new Error('no generator');
    src = e.gen();
    if (!(src instanceof PixelBuffer)) throw new Error('generator did not return a PixelBuffer');
    if (src.w !== RAY_TEX || src.h !== RAY_TEX) {
      warnOnce(`texsize:${e.id}`, `[ray] texture "${e.id}" is ${src.w}×${src.h}, not 64×64 — resized`);
      src = src.resized(RAY_TEX, RAY_TEX);
    }
  } catch (err) {
    e.error = err instanceof Error ? err.message : String(err);
    warnOnce(`texgen:${e.id}`, `[ray] texture "${e.id}" failed: ${e.error} — drawing the magenta fallback`);
    src = checker();
  }
  const cols = new Uint32Array(RAY_TEX * RAY_TEX);
  const dark = new Uint32Array(RAY_TEX * RAY_TEX);
  const shadeCache = new Map<Color, Color>();
  let holes = 0;
  for (let u = 0; u < RAY_TEX; u++) {
    for (let v = 0; v < RAY_TEX; v++) {
      let c = src.data[v * RAY_TEX + u] >>> 0;
      if ((c & 255) === 0) {
        holes++;
        c = INK;
      }
      cols[u * RAY_TEX + v] = c;
      let dc = shadeCache.get(c);
      if (dc === undefined) {
        dc = stepShade(c, -1) >>> 0;
        shadeCache.set(c, dc);
      }
      dark[u * RAY_TEX + v] = dc;
    }
  }
  if (holes > 0) warnOnce(`texhole:${e.id}`, `[ray] texture "${e.id}" has ${holes} transparent texels — filled with ink`);
  e.cols = cols;
  e.dark = dark;
}

/**
 * Column-major texels of texture `index` (`cols[u × 64 + v]`); `dark` = the y-side variant.
 * Builds the texture on first use. Bad indices give the fallback. For the renderer and tools.
 */
export function rayTextureColumns(index: number, dark = false): Uint32Array {
  const e = texList[index] ?? texList[0];
  if (!e.cols) buildTexture(e);
  return (dark ? e.dark : e.cols) as Uint32Array;
}

/** Ids of the registered textures (sorted; the fallback is not listed). */
export function listRayTextures(): string[] {
  return [...texIndex.keys()].sort();
}

/** The y-side texel of a dense level: two steps down its HD ramp (a 64-palette step is about two HD steps). */
function darkHd(c: Color): Color {
  if ((c & 255) === 0) return c;
  const h = hdHome(c);
  if (!h) return stepShade(c, -1) >>> 0;
  return h.ramp[h.i >= 2 ? h.i - 2 : 0] >>> 0;
}

/** The y-side variant of a dense texture: every texel two steps down its HD ramp (the default of `installRayTextureHd`). */
export function rayTexDarkHd(src: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(src.w, src.h);
  const cache = new Map<Color, Color>();
  for (let k = 0; k < src.data.length; k++) {
    const c = src.data[k] >>> 0;
    let v = cache.get(c);
    if (v === undefined) {
      v = darkHd(c);
      cache.set(c, v);
    }
    out.data[k] = v;
  }
  return out.touch();
}

/**
 * A view of density ≥ 2 picks a dense level per wall column by its height `span` (view px of one
 * whole texture height): the smallest installed level that is magnified at most this much, else
 * the largest (so a 256² level shows only on near walls, a 128² level elsewhere: less shimmer).
 */
export const RAY_LEVEL_MAG = 1.25;

/** Column-major copy of an opaque size × size buffer (transparent texels become ink). */
function columnsOf(src: PixelBuffer, size: number): { cols: Uint32Array; holes: number } {
  const cols = new Uint32Array(size * size);
  let holes = 0;
  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let c = src.data[v * size + u] >>> 0;
      if ((c & 255) === 0) {
        holes++;
        c = INK;
      }
      cols[u * size + v] = c;
    }
  }
  return { cols, holes };
}

const isDense = (d: number): d is 2 | 4 => d === 2 || d === 4;

/**
 * Install texture `id`'s art at density `d` (2 or 4): `src` is (64·d)², opaque; `dark` (same size,
 * optional) is its y-side variant — default: every texel two HD ramp steps down. Replaces an
 * earlier install of that level. False (and one warning) for an unknown id, a bad density or size.
 */
export function installRayTextureHd(id: string, d: number, src: PixelBuffer, dark?: PixelBuffer): boolean {
  const i = texIndex.get(id);
  const size = RAY_TEX * d;
  if (i === undefined || !isDense(d) || src.w !== size || src.h !== size || (dark && (dark.w !== size || dark.h !== size))) {
    warnOnce(`texhd:${id}@${d}`, `[ray] cannot install texture "${id}" at ${d}× (${src.w}×${src.h}; unknown id, density or size)`);
    return false;
  }
  const lit = columnsOf(src, size);
  const dk = columnsOf(dark ?? rayTexDarkHd(src), size).cols;
  if (lit.holes > 0) warnOnce(`texholehd:${id}@${d}`, `[ray] texture "${id}" at ${d}× has ${lit.holes} transparent texels — filled with ink`);
  texList[i].hd[d] = { density: d, size, cols: lit.cols, dark: dk };
  return true;
}

/**
 * The level of texture `index` a view of density `d` draws: at d 1 the 1× level (built on first
 * use); at d ≥ 2 the installed dense levels — for a column `span` view px tall the smallest one
 * magnified at most RAY_LEVEL_MAG, else the largest (span 0: the highest density ≤ d) — and the 1×
 * level when none is installed. Bad indices give the fallback. No allocation once built.
 */
export function rayTextureLevel(index: number, d: number, span = 0): RayTexLevel {
  const e = texList[index] ?? texList[0];
  if (d >= 2) {
    const l2 = e.hd[2];
    const l4 = e.hd[4];
    if (span <= 0) {
      if (d >= 4 && l4) return l4;
      if (l2) return l2;
    } else {
      if (l2 && (!l4 || span <= l2.size * RAY_LEVEL_MAG)) return l2;
      if (l4) return l4;
    }
  }
  if (!e.lv1) {
    if (!e.cols) buildTexture(e);
    e.lv1 = { density: 1, size: RAY_TEX, cols: e.cols as Uint32Array, dark: e.dark as Uint32Array };
  }
  return e.lv1;
}

/** Densities installed for texture `id` (1 always; then 2 and / or 4). */
export function rayTextureDensities(id: string): number[] {
  const i = texIndex.get(id);
  if (i === undefined) return [];
  const e = texList[i];
  return [1, ...[2, 4].filter((d) => !!e.hd[d])];
}

// ---------------------------------------------------------------------------------- billboards

export interface RayBillboardDef {
  size?: 64 | 96 | 128;
  yaws: 1 | 8;
  frames: number;
  /** World size in tiles (default size / 64). The billboard stands on the floor, centred. */
  worldW?: number;
  worldH?: number;
  /** Frame `frame` seen at yaw `yaw` (0..4 for `yaws: 8`, 0 for `yaws: 1`); size × size, TRANSPARENT = empty. */
  gen: (frame: number, yaw: number) => PixelBuffer;
}

/**
 * One density level of a billboard, per slot (frame × yaws + yaw): column-major texels (size²) and
 * per column the first and last opaque row (`first[u]` 0xFFFF = an empty column).
 */
export interface RayBbLevel {
  readonly density: number;
  /** Texels per side: the billboard's size × density. */
  readonly size: number;
  readonly cols: readonly Uint32Array[];
  readonly first: readonly Uint16Array[];
  readonly last: readonly Uint16Array[];
}

export interface RayBillboard {
  readonly id: string;
  readonly size: number;
  readonly yaws: number;
  readonly frames: number;
  readonly worldW: number;
  readonly worldH: number;
}

class BillboardEntry implements RayBillboard {
  id: string;
  size: number;
  yaws: number;
  frames: number;
  worldW: number;
  worldH: number;
  gen: (frame: number, yaw: number) => PixelBuffer;
  /** Per (frame × yaws + yaw): column-major texels and column spans. Null until built. */
  cols: Uint32Array[] | null = null;
  spans: Uint16Array[] | null = null;
  errors: string[] = [];
  /** The 1× level (made with cols / spans). */
  lv1: RayBbLevel | null = null;
  /** Installed dense levels: [2] and [4]. */
  hd: Array<RayBbLevel | null> = [];

  constructor(id: string, def: RayBillboardDef) {
    this.id = id;
    this.gen = def.gen;
    this.size = 64;
    this.yaws = 1;
    this.frames = 1;
    this.worldW = 1;
    this.worldH = 1;
    this.apply(def);
  }

  apply(def: RayBillboardDef): void {
    const size = def.size === 96 || def.size === 128 ? def.size : 64;
    this.size = size;
    this.yaws = def.yaws === 8 ? 8 : 1;
    this.frames = Math.max(1, def.frames | 0);
    this.worldW = def.worldW ?? size / 64;
    this.worldH = def.worldH ?? size / 64;
    this.gen = def.gen;
    this.cols = null;
    this.spans = null;
    this.errors = [];
    this.lv1 = null;
    this.hd = [];
  }
}

const bbMap = new Map<string, BillboardEntry>();
const fallbackBB = new BillboardEntry(FALLBACK_ID, { yaws: 1, frames: 1, gen: () => checker() });

export function defineRayBillboard(id: string, def: RayBillboardDef): void {
  const e = bbMap.get(id);
  if (e) e.apply(def);
  else bbMap.set(id, new BillboardEntry(id, def));
}

export function hasRayBillboard(id: string): boolean {
  return bbMap.has(id);
}

/** The billboard `id`; unknown → the magenta fallback (64, 1 yaw, 1 frame) + one warning. */
export function getRayBillboard(id: string): RayBillboard {
  const e = bbMap.get(id);
  if (e) return e;
  warnOnce(`bb:${id}`, `[ray] unknown billboard "${id}" — drawing the magenta fallback`);
  return fallbackBB;
}

/** Ids of the registered billboards (sorted). */
export function listRayBillboards(): string[] {
  return [...bbMap.keys()].sort();
}

function columnize(src: PixelBuffer, size: number, mirror: boolean, cols: Uint32Array, spans: Uint16Array): void {
  for (let u = 0; u < size; u++) {
    const sx = mirror ? size - 1 - u : u;
    let first = -1;
    let last = -1;
    for (let v = 0; v < size; v++) {
      const c = src.data[v * size + sx] >>> 0;
      cols[u * size + v] = c;
      if ((c & 255) !== 0) {
        if (first < 0) first = v;
        last = v;
      }
    }
    spans[u] = first < 0 ? 0xffff : (first << 8) | last;
  }
}

function frameSource(e: BillboardEntry, frame: number, yaw: number): PixelBuffer {
  const size = e.size;
  try {
    const b = e.gen(frame, yaw);
    if (!(b instanceof PixelBuffer)) throw new Error('generator did not return a PixelBuffer');
    if (b.w === size && b.h === size) return b;
    warnOnce(`bbsize:${e.id}`, `[ray] billboard "${e.id}" frame is ${b.w}×${b.h}, not ${size}×${size} — placed bottom-centre`);
    const fit = new PixelBuffer(size, size);
    fit.blit(b, (size - b.w) >> 1, size - b.h);
    return fit;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    e.errors.push(`${frame}/${yaw}: ${msg}`);
    warnOnce(`bbgen:${e.id}`, `[ray] billboard "${e.id}" frame ${frame} yaw ${yaw} failed: ${msg} — magenta fallback`);
    const c = checker(64);
    if (size === 64) return c;
    const fit = new PixelBuffer(size, size);
    fit.blit(c, (size - 64) >> 1, size - 64);
    return fit;
  }
}

function buildBillboard(e: BillboardEntry): void {
  const size = e.size;
  const n = e.frames * e.yaws;
  const cols: Uint32Array[] = new Array<Uint32Array>(n);
  const spans: Uint16Array[] = new Array<Uint16Array>(n);
  for (let f = 0; f < e.frames; f++) {
    const rendered = e.yaws === 8 ? 5 : 1;
    for (let k = 0; k < rendered; k++) {
      const src = frameSource(e, f, k);
      const i = f * e.yaws + k;
      cols[i] = new Uint32Array(size * size);
      spans[i] = new Uint16Array(size);
      columnize(src, size, false, cols[i], spans[i]);
      if (e.yaws === 8 && k >= 1 && k <= 3) {
        const m = f * e.yaws + (8 - k);
        cols[m] = new Uint32Array(size * size);
        spans[m] = new Uint16Array(size);
        columnize(src, size, true, cols[m], spans[m]);
      }
    }
  }
  e.cols = cols;
  e.spans = spans;
}

function entryOf(bb: RayBillboard): BillboardEntry {
  if (bb instanceof BillboardEntry) return bb;
  return bbMap.get(bb.id) ?? fallbackBB;
}

function slot(e: BillboardEntry, frame: number, yaw: number): number {
  let f = frame | 0;
  if (f < 0 || f >= e.frames) f = ((f % e.frames) + e.frames) % e.frames;
  const k = e.yaws === 8 ? yaw & 7 : 0;
  return f * e.yaws + k;
}

/** Column-major texels (size × size) of a billboard frame at a yaw. Builds on first use. */
export function billboardColumns(bb: RayBillboard, frame: number, yaw: number): Uint32Array {
  const e = entryOf(bb);
  if (!e.cols) buildBillboard(e);
  return (e.cols as Uint32Array[])[slot(e, frame, yaw)];
}

/** Column spans (`first << 8 | last`, 0xFFFF = empty) of a billboard frame at a yaw. */
export function billboardSpans(bb: RayBillboard, frame: number, yaw: number): Uint16Array {
  const e = entryOf(bb);
  if (!e.cols) buildBillboard(e);
  return (e.spans as Uint16Array[])[slot(e, frame, yaw)];
}

/** Column-major copy with first / last opaque rows per column (mirrored: u runs right to left). */
function columnizeHd(src: PixelBuffer, size: number, mirror: boolean): { cols: Uint32Array; first: Uint16Array; last: Uint16Array } {
  const cols = new Uint32Array(size * size);
  const first = new Uint16Array(size);
  const last = new Uint16Array(size);
  for (let u = 0; u < size; u++) {
    const sx = mirror ? size - 1 - u : u;
    let f = -1;
    let l = -1;
    for (let v = 0; v < size; v++) {
      const c = src.data[v * size + sx] >>> 0;
      cols[u * size + v] = c;
      if ((c & 255) !== 0) {
        if (f < 0) f = v;
        l = v;
      }
    }
    first[u] = f < 0 ? 0xffff : f;
    last[u] = l < 0 ? 0 : l;
  }
  return { cols, first, last };
}

/**
 * Install billboard `id`'s frames at density `d` (2 or 4): `frames` in generator order — for each
 * frame its rendered yaws (5 for an 8-yaw billboard: yaws 0..4; the mirrors 5..7 are made here, as
 * at 1×), each (size·d)², TRANSPARENT = empty. Replaces an earlier install of that level. False
 * (and one warning) for an unknown id, a bad density, a wrong frame count or size.
 */
export function installRayBillboardHd(id: string, d: number, frames: readonly PixelBuffer[]): boolean {
  const e = bbMap.get(id);
  const rendered = e ? (e.yaws === 8 ? 5 : 1) : 0;
  const size = e ? e.size * d : 0;
  if (!e || !isDense(d) || frames.length !== e.frames * rendered || frames.some((b) => b.w !== size || b.h !== size)) {
    warnOnce(`bbhd:${id}@${d}`, `[ray] cannot install billboard "${id}" at ${d}× (unknown id, density, frame count or size)`);
    return false;
  }
  const n = e.frames * e.yaws;
  const cols: Uint32Array[] = new Array<Uint32Array>(n);
  const first: Uint16Array[] = new Array<Uint16Array>(n);
  const last: Uint16Array[] = new Array<Uint16Array>(n);
  for (let f = 0; f < e.frames; f++) {
    for (let k = 0; k < rendered; k++) {
      const src = frames[f * rendered + k];
      const i = f * e.yaws + k;
      const a = columnizeHd(src, size, false);
      cols[i] = a.cols;
      first[i] = a.first;
      last[i] = a.last;
      if (e.yaws === 8 && k >= 1 && k <= 3) {
        const m = f * e.yaws + (8 - k);
        const b = columnizeHd(src, size, true);
        cols[m] = b.cols;
        first[m] = b.first;
        last[m] = b.last;
      }
    }
  }
  e.hd[d] = { density: d, size, cols, first, last };
  return true;
}

/**
 * The level of billboard `bb` a view of density `d` draws: the highest installed density ≤ d, else
 * the 1× level (built on first use). No allocation once built.
 */
export function billboardLevel(bb: RayBillboard, d: number): RayBbLevel {
  const e = entryOf(bb);
  if (d >= 4 && e.hd[4]) return e.hd[4];
  if (d >= 2 && e.hd[2]) return e.hd[2];
  if (!e.lv1) {
    if (!e.cols) buildBillboard(e);
    const spans = e.spans as Uint16Array[];
    const first = spans.map((sp) => {
      const f = new Uint16Array(sp.length);
      for (let u = 0; u < sp.length; u++) f[u] = sp[u] === 0xffff ? 0xffff : sp[u] >> 8;
      return f;
    });
    const last = spans.map((sp) => {
      const l = new Uint16Array(sp.length);
      for (let u = 0; u < sp.length; u++) l[u] = sp[u] === 0xffff ? 0 : sp[u] & 255;
      return l;
    });
    e.lv1 = { density: 1, size: e.size, cols: e.cols as Uint32Array[], first, last };
  }
  return e.lv1;
}

/** The slot (frame × yaws + yaw) a frame and yaw draw from (frames wrap; 1-yaw billboards ignore the yaw). */
export function billboardSlot(bb: RayBillboard, frame: number, yaw: number): number {
  return slot(entryOf(bb), frame, yaw);
}

/** Densities installed for billboard `id` (1 always; then 2 and / or 4). */
export function rayBillboardDensities(id: string): number[] {
  const e = bbMap.get(id);
  if (!e) return [];
  return [1, ...[2, 4].filter((d) => !!e.hd[d])];
}

/** Drop every installed dense level of the textures and billboards (`d` alone, or both); returns the levels dropped. */
export function releaseRayHd(d?: number): number {
  let n = 0;
  const drop = (hd: Array<unknown>): void => {
    for (const k of [2, 4]) {
      if ((d === undefined || d === k) && hd[k]) {
        hd[k] = null;
        n++;
      }
    }
  };
  for (const e of texList) drop(e.hd);
  for (const e of bbMap.values()) drop(e.hd);
  return n;
}

/** Bytes held by the installed dense levels (texels of textures with their y-side variant, billboards with mirrors). */
export function rayHdBytes(d?: number): number {
  let bytes = 0;
  for (const k of [2, 4]) {
    if (d !== undefined && d !== k) continue;
    for (const e of texList) {
      const lv = e.hd[k];
      if (lv) bytes += (lv.cols.byteLength + lv.dark.byteLength);
    }
    for (const e of bbMap.values()) {
      const lv = e.hd[k];
      if (lv) for (const c of lv.cols) bytes += c.byteLength;
    }
  }
  return bytes;
}

/**
 * Yaw 0..7 to draw: yaw k = the actor faces k × 45° clockwise (seen from above, y down) from
 * "facing the viewer". Yaw 2 = the actor faces the viewer's left (screen left), 4 = its back,
 * 6 = it faces screen right.
 */
export function billboardYaw(actorAngle: number, ax: number, ay: number, camX: number, camY: number): number {
  const toViewer = angleTo(camX - ax, camY - ay);
  const rel = (actorAngle - toViewer) & ANG_MASK;
  return ((rel + 256) >> 9) & 7;
}

// ------------------------------------------------------------------------------------- prepare

export interface PrepareRayOpts {
  /** Time budget (ms) of one slice; checked after each asset, so a slice is at least one asset. Default 8. */
  timeBudgetMs?: number;
  /** How to yield between slices (default: a 0 ms timeout). */
  yieldFn?: () => Promise<void>;
  /** Clock for the budget (default performance.now, else Date.now). For tests. */
  now?: () => number;
}

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Build every texture and billboard (or those whose id starts with one of `prefixes`) in slices of
 * `timeBudgetMs`, yielding between slices; textures first, then billboards, each in id order.
 * Progress after each slice. Never rejects; failing ids get the fallback and are listed.
 */
export async function prepareRayAssets(
  prefixes?: readonly string[],
  onProgress?: (done: number, total: number) => void,
  opts?: PrepareRayOpts,
): Promise<{ failed: string[] }> {
  const match = (id: string): boolean => prefixes === undefined || prefixes.some((p) => id.startsWith(p));
  const texIds = listRayTextures().filter(match);
  const bbIds = listRayBillboards().filter(match);
  const total = texIds.length + bbIds.length;
  const budget = opts?.timeBudgetMs ?? 8;
  const now = opts?.now ?? clock;
  const yieldFn = opts?.yieldFn ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const failed: string[] = [];
  let sliceStart = now();
  for (let i = 0; i < total; i++) {
    try {
      if (i < texIds.length) {
        const e = texList[texIndex.get(texIds[i]) as number];
        if (!e.cols) buildTexture(e);
        if (e.error) failed.push(e.id);
      } else {
        const e = bbMap.get(bbIds[i - texIds.length]) as BillboardEntry;
        if (!e.cols) buildBillboard(e);
        if (e.errors.length > 0) failed.push(e.id);
      }
    } catch (err) {
      failed.push(i < texIds.length ? texIds[i] : bbIds[i - texIds.length]);
      warnOnce(`prep:${i}`, `[ray] prepare failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const last = i + 1 === total;
    if (last || now() - sliceStart >= budget) {
      onProgress?.(i + 1, total);
      if (!last) {
        await yieldFn();
        sliceStart = now();
      }
    }
  }
  if (total === 0) onProgress?.(0, 0);
  return { failed };
}

