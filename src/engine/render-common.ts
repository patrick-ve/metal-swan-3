import type { Color } from './color';
import { WHITE } from './color';
import type { PixelBuffer } from './pixel';
import type { DrawOpts } from './render';
import { upscaleFactor, type UpscaleMode } from './upscale';

/**
 * Placement maths shared by the software and Canvas 2D renderers, so both put every pixel in
 * exactly the same place. Pure functions; results go into caller-owned scratch objects
 * (no allocation per draw call).
 *
 * Rules (k = the renderer's `res`, backbuffer pixels per logical pixel; all results in
 * backbuffer pixels, which are logical pixels at k = 1):
 * - Camera: snapped to whole logical pixels, or to 1/k with sub-pixel 'camera' / 'all' (the
 *   default) at k > 1 (`cameraPx`).
 * - World → screen: Math.round(x) · k − camera (`toPx`); with sub-pixel 'all' world draws snap
 *   to 1/k instead (Math.round(x · k)). Screen-space draws always use whole logical pixels.
 * - Anchored drawing: the anchor pixel (ox, oy) lands on (x, y). flipX mirrors the image around
 *   the anchor pixel's column (left = x − (w − 1 − ox), in logical pixels of the frame, then
 *   times k); flipY likewise for rows. A sprite covers exactly its logical footprint times k,
 *   whatever upscaler drew it and whatever its density.
 * - Frames of density d > 1 (2× art) are never filtered. With d | k each buffer pixel is an
 *   exact (k / d) × (k / d) block; with k > d otherwise the buffer is enlarged by k / d with the
 *   nearest-neighbour rule of `PixelBuffer.blitScaled` (Canvas may pick the other pixel on ties);
 *   with k < d the renderers draw the reduction to `drawDensity(d, k)` (`reducedFor`: the
 *   top-left pixel of every block, flips mirror that image): a 4× frame at k 2 or 3 draws as a
 *   2× image, any dense frame at res 1 as a deterministic 1× image.
 * - Parallax layers: screen origin Math.round(offset − cam × factor), tiled by the buffer size;
 *   at k > 1 with any sub-pixel policy but 'off' in 1/k steps, and with 'parallax' / 'all' by
 *   the unrounded camera (`layerCam`).
 * - Rects, lines and text keep whole logical pixels relative to their origin (crisp k × k blocks).
 */

/**
 * Sub-pixel policy at res > 1 (docs/ARCHITECTURE.md §3):
 * - 'off': everything on whole logical pixels (the image is the 1× frame enlarged);
 * - 'parallax': the world (camera, terrain, entities) stays on whole logical pixels; background
 *   layers (`parallax` with a factor other than 1) scroll by the unrounded camera in 1/k steps,
 *   so slow layers glide instead of stepping;
 * - 'camera': the camera itself moves in 1/k steps; world draws keep Math.round(x) relative to
 *   the world, so every part of an entity stays on one grid;
 * - 'all' (the default): as 'camera', every world draw also snaps to 1/k, and background layers
 *   scroll by the unrounded camera like 'parallax'. Draw code passes unrounded positions (parts
 *   of one entity add whole-pixel offsets to one origin, so they stay together).
 * At res 1 every policy gives the classic whole-pixel image.
 */
export type SubpixelMode = 'off' | 'parallax' | 'camera' | 'all';

export const SUBPIXEL_MODES: readonly SubpixelMode[] = ['off', 'parallax', 'camera', 'all'];

/**
 * The default policy (chosen by measurement, see docs/ARCHITECTURE.md §3 and
 * tests/engine/hires-subpixel.test.ts): 'all', since the draw code of the player, the Swan and
 * her rider, the ams locals, NPCs and boss, shots, pickups and hostages passes unrounded
 * positions, so the whole world moves in 1/k steps without parts drifting apart.
 */
export const DEFAULT_SUBPIXEL: SubpixelMode = 'all';

/** Highest backbuffer resolution the browser uses at art tier 1 or 2 (backbuffer px per logical px). */
export const KMAX = 6;
/** Highest backbuffer resolution at art tier 4 (4K: the 4× art lands as exact 2 × 2 blocks). */
export const KMAX_TIER4 = 8;
/** Lowest integer display scale that picks art tier 4 in AUTO (4K s 10, 5K, Retina fullscreen s 9). */
export const TIER4_MIN_SCALE = 8;
/** Lowest integer display scale that picks art tier 2 in AUTO. */
export const TIER2_MIN_SCALE = 2;

/** The highest backbuffer resolution for art tier `tier` (KMAX_TIER4 at tier 4, else KMAX). */
export function kmaxForTier(tier: number): number {
  return tier >= 4 ? KMAX_TIER4 : KMAX;
}

/**
 * The AUTO art tier for a display scale `s` (device px per logical px): 4 when the integer scale
 * is ≥ TIER4_MIN_SCALE, 2 when it is ≥ TIER2_MIN_SCALE, else 1. `want` (ART DETAIL 1, 2 or 4;
 * 0 = AUTO) caps it: a forced tier is used as asked (4× on a small window still draws 4× art,
 * reduced by the renderers; `tierAtRes` limits it to what the backbuffer can show).
 */
export function chooseTier(s: number, want = 0): 1 | 2 | 4 {
  if (want === 1 || want === 2 || want === 4) return want;
  const n = s >= 1 ? Math.floor(s) : 0;
  return n >= TIER4_MIN_SCALE ? 4 : n >= TIER2_MIN_SCALE ? 2 : 1;
}

/**
 * The art tier a backbuffer of res k can show for a wanted tier: d > k falls back to the next
 * lower density (4 → 2; tier 4 also needs 4 | k), and to 1 only below k 2.
 */
export function tierAtRes(tier: number, k: number): 1 | 2 | 4 {
  if (tier >= 4 && k >= 4 && k % 4 === 0) return 4;
  if (tier >= 2 && k >= 2) return 2;
  return 1;
}

/**
 * The density at which a buffer of density `d` is drawn on a backbuffer of res `k`: d itself when
 * d ≤ k, else the highest density ≤ k that divides d (4 at k 2 or 3 → 2; at k 1 → 1). The
 * renderers draw the reduction `lowRes(buf, d / drawDensity(d, k))`.
 */
export function drawDensity(d: number, k: number): number {
  if (d <= k) return d;
  for (let e = Math.min(k, d); e > 1; e--) if (d % e === 0) return e;
  return 1;
}

/**
 * The image the renderers draw for a buffer of density `d` at res `k` (the buffer itself, or its
 * `lowRes` reduction to `drawDensity(d, k)`); no allocation once cached.
 */
export function reducedFor(buf: PixelBuffer, d: number, k: number): PixelBuffer {
  if (d <= k) return buf;
  const r = d / drawDensity(d, k);
  return r > 1 ? lowRes(buf, r) : buf;
}

/**
 * Backbuffer resolution k for a display scale `s` (device px per logical px) and the largest
 * upscale `factor` that will be drawn (upscaleFactor of the GRAPHICS mode; 1 for 'pixel'):
 * - s ≤ kmax: k = s. Presenting is then a 1:1 copy, so every filtered pixel lands exactly where
 *   a direct nearest-neighbour scale to the display would put it.
 * - s > kmax: the largest k ≤ kmax that `factor` divides (or kmax when none does). With f | k
 *   each filtered pixel covers k / f whole backbuffer pixels, and the presenting enlargement
 *   (s / k, possibly not an integer) again puts every filtered pixel where a direct
 *   nearest-neighbour scale would. Logical pixel edges are whole device pixels for any k ≤ s,
 *   so rects, lines and text stay even blocks too.
 * - Below 1× (a fractional scale under 1): 1.
 * Examples with kmax 6: 1080p (s 5) → 5; 4K (s 10) → 6 ('pixel', 'smooth') or 4 ('xbr');
 * 16-inch MacBook Pro fullscreen (s 9) → 6 or 4. At art tier 4 pass `kmaxForTier(4)` (8):
 * 4K (s 10) → 8, so the 4× art lands as exact 2 × 2 blocks (`chooseTierRes`).
 */
export function chooseRes(s: number, kmax = KMAX, factor = 1): number {
  const max = Math.max(1, Math.floor(kmax));
  if (!(s >= 1)) return 1;
  const n = Math.floor(s);
  if (n <= max) return n;
  const f = Math.max(1, Math.floor(factor));
  for (let k = max; k >= f; k--) if (k % f === 0) return k;
  return max;
}

/**
 * Backbuffer resolution and art tier for a display scale `s`, the wanted tier (`want`: 0 AUTO,
 * or 1 / 2 / 4) and the upscale factor of the GRAPHICS mode: the tier picks kmax
 * (`kmaxForTier`), `chooseRes` picks k, and the tier is cut to what k can show (`tierAtRes`).
 * Tier 4 keeps 4 | k (a forced 4× at s 5–7 → k 4); a forced 4× below s 4 draws 2× (or 1×) art.
 * The result goes into `out` (reused by the display, no allocation per frame).
 */
export interface TierRes {
  tier: 1 | 2 | 4;
  k: number;
}

export function chooseTierRes(s: number, want = 0, factor = 1, kmaxCap = Infinity, out: TierRes = { tier: 1, k: 1 }): TierRes {
  let t = chooseTier(s, want);
  // AUTO picks tier 4 only with its k 8 (a lower ?kmax cap keeps AUTO at tier 2).
  if (t === 4 && want !== 4 && Math.min(KMAX_TIER4, kmaxCap) < KMAX_TIER4) t = 2;
  let k = chooseRes(s, Math.min(kmaxForTier(t), kmaxCap), factor);
  // Tier 4 wants 4 | k (exact 2 × 2 or 1 × 1 blocks): s 5–7 with a forced 4× → k 4.
  if (t === 4 && k > 4 && k % 4 !== 0) k -= k % 4;
  out.tier = tierAtRes(t, k);
  out.k = k;
  return out;
}

/** Camera offset in backbuffer px for a camera at `v` (world px). */
export function cameraPx(v: number, k: number, subpixel: SubpixelMode): number {
  return k === 1 || subpixel === 'off' || subpixel === 'parallax' ? Math.round(v) * k : Math.round(v * k);
}

/**
 * Camera position (logical px) a parallax layer of `factor` scrolls by: the unrounded camera
 * `exact` with policy 'parallax' or 'all' at res > 1 (except factor 1, which stays locked to the
 * world), else the renderer's snapped camera `cam`.
 */
export function layerCam(cam: number, exact: number, factor: number, k: number, subpixel: SubpixelMode): number {
  return k > 1 && (subpixel === 'parallax' || subpixel === 'all') && factor !== 1 ? exact : cam;
}

const lowResCache = new WeakMap<PixelBuffer, { version: number; d: number; buf: PixelBuffer }>();

/**
 * The 1× image of a buffer of density d > 1 (`PixelBuffer.downsampled(d)`: the top-left pixel of
 * every d × d block), cached per buffer and version. Both renderers draw it for a 2× frame on a
 * backbuffer with res k < d, so the res-1 image is deterministic and the same in both.
 */
export function lowRes(buf: PixelBuffer, d: number): PixelBuffer {
  const e = lowResCache.get(buf);
  if (e && e.version === buf.version && e.d === d) return e.buf;
  const out = buf.downsampled(d);
  lowResCache.set(buf, { version: buf.version, d, buf: out });
  lowResSource.set(out, buf);
  return out;
}

/** The buffer a `lowRes` reduction was made from (a renderer's texture of it goes with its source). */
const lowResSource = new WeakMap<PixelBuffer, PixelBuffer>();

/** The source of `buf` when it is a `lowRes` reduction, else `buf`. */
export function reductionSource(buf: PixelBuffer): PixelBuffer {
  return lowResSource.get(buf) ?? buf;
}

/** A coordinate in backbuffer px: whole logical px times k, or snapped to 1/k when `fine`. */
export function toPx(v: number, k: number, fine: boolean): number {
  return fine ? Math.round(v * k) : Math.round(v) * k;
}

/**
 * Sprite-id prefixes that are never filtered by the upscaler (crisp UI: icons, cursors, the
 * HUD, lettering), except the ids under `FILTERED_UI_PREFIXES`. Buffers without a sprite id
 * (backgrounds, terrain chunks, `image`, the font) are never filtered either.
 */
export const UNFILTERED_PREFIXES: readonly string[] = ['ui/'];

/**
 * Character and object art that lives under 'ui/' (title, intro and ending scenes):
 * filtered like the game sprites next to it, so one scene does not mix two looks.
 */
export const FILTERED_UI_PREFIXES: readonly string[] = [
  'ui/leader-',
  'ui/horse',
  'ui/fanfaroni',
  'ui/ending-',
  'ui/title-swan',
  'ui/portrait-',
];

/**
 * Exact sprite ids that are never filtered: art where the filters only add noise (visual review
 * of group 1: the dithered fire of the large explosions gets rings and 'x' marks, the 'Fabel'
 * script gets dots and gaps). The smaller explosions are filtered.
 */
export const UNFILTERED_IDS: ReadonlySet<string> = new Set(['fx/explosion-l', 'fx/explosion-xl', 'decor/ams/fabel-sign']);

/**
 * Sprite-id prefixes that 'xbr' draws with 'smooth' (MMPX) instead: xBR turns bricks into pills,
 * square windows round and lettering into blobs, and leaves seams between tiles of a strip
 * (its 'transparent outside' edge rule); MMPX keeps all of these.
 */
export const XBR_AS_SMOOTH_PREFIXES: readonly string[] = ['decor/'];

function startsWithAny(id: string, list: readonly string[]): boolean {
  for (let i = 0; i < list.length; i++) if (id.startsWith(list[i])) return true;
  return false;
}

/** Is a buffer with this sprite id (undefined = none) drawn through the upscaler? */
export function filtersId(id: string | undefined): boolean {
  if (id === undefined || UNFILTERED_IDS.has(id)) return false;
  if (startsWithAny(id, FILTERED_UI_PREFIXES)) return true;
  return !startsWithAny(id, UNFILTERED_PREFIXES);
}

/**
 * The filter that GRAPHICS mode `mode` can use at res k: a filter whose factor is above k steps
 * down ('xbr' → 'smooth' → 'pixel'), so a small window still gets the nearest smoothing.
 */
export function modeAtRes(mode: UpscaleMode, k: number): UpscaleMode {
  let m = mode;
  while (m !== 'pixel' && upscaleFactor(m) > k) m = m === 'xbr' ? 'smooth' : 'pixel';
  return m;
}

/**
 * The filter a buffer with sprite id `id` (undefined = none) is drawn with under GRAPHICS mode
 * `mode` at res k: 'pixel' for unfiltered buffers (`filtersId`), 'smooth' for decor in 'xbr'
 * mode (`XBR_AS_SMOOTH_PREFIXES`), else `modeAtRes(mode, k)`. Both renderers use it, so the
 * soft and Canvas images agree.
 */
export function spriteFilter(id: string | undefined, mode: UpscaleMode, k: number): UpscaleMode {
  if (mode === 'pixel' || k === 1 || !filtersId(id)) return 'pixel';
  const m = modeAtRes(mode, k);
  return m === 'xbr' && startsWithAny(id as string, XBR_AS_SMOOTH_PREFIXES) ? 'smooth' : m;
}

export interface Placement {
  x: number;
  y: number;
}

/**
 * Top-left (backbuffer px) of a (w × h) image, k backbuffer px per image px, whose anchor
 * (ox, oy) lands on backbuffer px (ax, ay).
 */
export function anchorTopLeft(
  out: Placement,
  w: number,
  h: number,
  ox: number,
  oy: number,
  ax: number,
  ay: number,
  flipX: boolean,
  flipY: boolean,
  k: number,
): Placement {
  out.x = ax - (flipX ? w - 1 - ox : ox) * k;
  out.y = ay - (flipY ? h - 1 - oy : oy) * k;
  return out;
}

/** Screen top-left of a (w × h) image whose anchor (ox, oy) is drawn at (x, y) (1×, whole px). */
export function placeAnchored(
  out: Placement,
  w: number,
  h: number,
  ox: number,
  oy: number,
  x: number,
  y: number,
  flipX: boolean,
  flipY: boolean,
  camX: number,
  camY: number,
): Placement {
  const ax = Math.round(x) - camX;
  const ay = Math.round(y) - camY;
  out.x = flipX ? ax - (w - 1 - ox) : ax - ox;
  out.y = flipY ? ay - (h - 1 - oy) : ay - oy;
  return out;
}

/** A source part of an image after `placePart` (reused scratch object). */
export interface Part {
  /** Source rectangle inside the (possibly flipped) image variant. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Screen position of that rectangle. */
  dx: number;
  dy: number;
}

/**
 * Where a source sub-rectangle (unflipped coordinates, clipped to the w × h image) of an
 * image whose full top-left is at (left, top) lands, and where it sits inside the flipped
 * variant. Everything is in logical pixels of the image (buffer pixels at density 1; for a frame
 * of density d pass its logical size and multiply the result's sx…sh by d to address the
 * buffer); with k backbuffer px per logical px the destination is left + sx · k (and the part is
 * sw · k wide). Returns false when nothing is left after clipping.
 */
export function placePart(
  out: Part,
  w: number,
  h: number,
  src: { x: number; y: number; w: number; h: number },
  left: number,
  top: number,
  flipX: boolean,
  flipY: boolean,
  k = 1,
): boolean {
  let x0 = Math.round(src.x);
  let y0 = Math.round(src.y);
  let x1 = x0 + Math.round(src.w);
  let y1 = y0 + Math.round(src.h);
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > w) x1 = w;
  if (y1 > h) y1 = h;
  if (x0 >= x1 || y0 >= y1) return false;
  out.sw = x1 - x0;
  out.sh = y1 - y0;
  out.sx = flipX ? w - x1 : x0;
  out.sy = flipY ? h - y1 : y0;
  out.dx = left + out.sx * k;
  out.dy = top + out.sy * k;
  return true;
}

/** First tile position (≤ 0) so that tiles of `size` starting there cover the view from 0. */
export function firstTile(origin: number, size: number): number {
  return origin - Math.ceil(origin / size) * size;
}

/**
 * Screen origin of a parallax layer on one axis, in backbuffer px (k per logical px): whole
 * logical pixels, or 1/k steps when `fine` (a sub-pixel camera).
 */
export function parallaxOrigin(offset: number, cam: number, factor: number, k = 1, fine = false): number {
  return fine ? Math.round((offset - cam * factor) * k) : Math.round(offset - cam * factor) * k;
}

/** Endpoints of a line after `clipLine` (reused scratch object). */
export interface LineEnds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LONG_LINE = 2048;
const MARGIN = 64;

/**
 * Screen-space line guard shared by both renderers: lines longer than 2048 px are clipped
 * (Liang–Barsky) to the view plus a 64-px margin, so absurd coordinates cannot stall the
 * Bresenham loop. Shorter lines are left untouched (exact pixels). Returns false when the
 * line misses the view.
 */
export function clipLine(out: LineEnds, x0: number, y0: number, x1: number, y1: number, w: number, h: number): boolean {
  out.x0 = Math.round(x0);
  out.y0 = Math.round(y0);
  out.x1 = Math.round(x1);
  out.y1 = Math.round(y1);
  const dx = out.x1 - out.x0;
  const dy = out.y1 - out.y0;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= LONG_LINE) return true;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, out.x0 + MARGIN],
    [dx, w + MARGIN - out.x0],
    [-dy, out.y0 + MARGIN],
    [dy, h + MARGIN - out.y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  const ax = out.x0;
  const ay = out.y0;
  out.x0 = Math.round(ax + dx * t0);
  out.y0 = Math.round(ay + dy * t0);
  out.x1 = Math.round(ax + dx * t1);
  out.y1 = Math.round(ay + dy * t1);
  return true;
}

/** Colour for solid shapes (rect, line): `tint` or white `flash` replace the RGB, alpha stays. */
export function solidColor(c: Color, o: DrawOpts | undefined): Color {
  const t = o?.tint ?? (o?.flash ? WHITE : undefined);
  return t === undefined ? c >>> 0 : ((t & 0xffffff00) | (c & 255)) >>> 0;
}

/** Average render + present time (ms) above which the governor drops art tier 4. */
export const GOVERNOR_LIMIT_MS = 8;
/** Length of one governor measuring window (ms). */
export const GOVERNOR_WINDOW_MS = 2000;

/**
 * Frame-time governor (docs/ARCHITECTURE.md §3): at art tier 4 it averages render + present time
 * over windows of GOVERNOR_WINDOW_MS; when a window averages more than GOVERNOR_LIMIT_MS (e.g.
 * software rendering of a k 8 backbuffer) it trips, once per session: the app then caps the tier
 * at 2 (k ≤ 6). Pure; no allocation per frame.
 */
export class FrameGovernor {
  /** True once tripped (stays true). */
  tripped = false;
  /** The window average that tripped it (ms; 0 before). */
  trippedMs = 0;
  private start = -1;
  private sum = 0;
  private n = 0;

  readonly limitMs: number;
  readonly windowMs: number;

  constructor(limitMs = GOVERNOR_LIMIT_MS, windowMs = GOVERNOR_WINDOW_MS) {
    this.limitMs = limitMs;
    this.windowMs = windowMs;
  }

  /**
   * Record one frame: `ms` its render + present time, `now` a clock (ms), `tier` the art tier it
   * was drawn at (only tier-4 frames count; another tier restarts the window). Returns true on
   * the frame that trips the governor.
   */
  sample(ms: number, now: number, tier: number): boolean {
    if (this.tripped) return false;
    if (tier < 4) {
      this.start = -1;
      return false;
    }
    if (this.start < 0) {
      this.start = now;
      this.sum = 0;
      this.n = 0;
    }
    this.sum += ms;
    this.n++;
    if (now - this.start < this.windowMs) return false;
    const avg = this.sum / this.n;
    this.start = -1;
    if (avg <= this.limitMs) return false;
    this.tripped = true;
    this.trippedMs = avg;
    return true;
  }
}
