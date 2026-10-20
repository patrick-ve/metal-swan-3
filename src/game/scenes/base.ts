/**
 * The menu backdrop (docs/design/squad.md §2.3): a military base at night. A dark sky with stars
 * and two searchlights sweeping it, a far tree line, two quonset hangars (one door ajar, warm
 * light), a lattice radio mast with blinking red lights, a parked SWAN-3 under camo netting,
 * drifting smoke from a stove pipe, and in front a sandbag wall topped with barbed wire.
 *
 * Used by the title, mode select, options, HOW TO PLAY, high scores and name entry (the lake in
 * lake.ts stays for the ending). The static parts are sprites (`ui/base/*`, content/ui/
 * screens.art.ts: sky, land, netting, puff, wall); each frame adds the beams, the smoke and the
 * mast lights with a few rects, no allocation. `veil()` (lake.ts) still works on top.
 *
 * The title draws its patrolling SWAN-3 between the land and the wall: `drawBase(r, t, NO_WALL)`,
 * the swan, then `drawBaseWall(r)`. With `parked: false` the camo netting hangs empty (the swan is
 * out on patrol).
 *
 * Screen art at the tier (UHD, docs/ART_GUIDE.md "UHD art"): the screens draw their sprites at the
 * art tier (2 or 4) when the backbuffer has room for it (`screenTier`), else at 1×.
 * `screenArt(r, ids)` returns the density a group of ids draws at NOW: the highest one ≤ the
 * tier at which every id of the group is built (one density per group, so a group switches to HD
 * at once), and hands the missing ones to the screen art pool (a small worker pool, opened on
 * the first request; in node, without Worker, they are built at once). The main thread never
 * generates a dense frame for a screen: until the pool delivers, the group draws at the next
 * lower built density (1× at least). `releaseScreenArt()` drops the 4× menu art when the game
 * proper starts (the tier-4 working set has the 256 MB to itself) and closes the pool once idle.
 */
import { browserArtPool, poolSize, type ArtPool } from '../../engine/art-pool';
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../engine/render';
import {
  artTier,
  frameW,
  getFrame,
  getFrames,
  hasFramesAt,
  hasHiSprite,
  hasSprite,
  releaseDense,
  setArtDensity,
  setDeferDense,
  type ArtDensity,
  type DenseDensity,
} from '../../engine/sprites';
import { centerText, drawCursor, UI_GOLD } from '../app';
import { stencilId } from '../content/ui/military.art';
import { BASE_ART, BASE_GROUND, BASE_LAND_Y, BASE_MAST_TOP, BASE_MAST_X, BASE_PARKED, BASE_WALL_Y, baseNetBox } from '../content/ui/screens.art';

export { BASE_GROUND, BASE_WALL_TOP } from '../content/ui/screens.art';
/** The feet line of the title's patrolling swan (her legs hide behind the wall). */
export const BASE_PATROL_Y = 194;

export interface BaseOpts {
  /** Draw the sandbag wall (default true). */
  wall?: boolean;
  /** A SWAN-3 parked under the netting (default true). */
  parked?: boolean;
}

/** Shared option records (no allocation per frame). */
export const NO_WALL: BaseOpts = { wall: false, parked: false };
const DEFAULT: BaseOpts = {};

const W = 384;
/** The searchlights: base x, base y, phase, speed. */
const BEAMS: readonly (readonly [number, number, number, number])[] = [
  [78, 150, 0, 0.0105],
  [262, 156, 2.1, 0.0085],
];

const plain: DrawOpts = { screen: true };
const beamOpts: DrawOpts = { screen: true, alpha: 0.08 };
const coreOpts: DrawOpts = { screen: true, alpha: 0.1 };
const smokeOpts: DrawOpts = { screen: true, alpha: 0.3 };
const glowOpts: DrawOpts = { screen: true, alpha: 0.35 };

/** The backdrop's layers (one density for all of them, so they switch to HD together). */
const LAYERS: readonly string[] = [BASE_ART.sky, BASE_ART.land, BASE_ART.net, BASE_ART.puff];
const WALL_LAYER: readonly string[] = [BASE_ART.wall];

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------

/**
 * The searchlight edges on a big backbuffer (UHD, docs/ART_GUIDE.md "UHD art"): at res k a rect
 * snaps to whole logical px (k × k blocks), so the beam rows of res 1 show 8-16 px stair steps at
 * 4K. At an even k the beam is drawn in 1-px rows whose edges sit on 1 / d logical px (d 4 when
 * 4 | k, else 2): the whole pixels as a rect, each partial edge pixel as a tiny dense frame (one
 * d × d cell with columns a..b filled; cached, a few dozen in all). Res 1 (and odd k) keep the
 * 2-px rows, so their pixels never change.
 */
function beamDensity(k: number): number {
  return k % 4 === 0 ? 4 : k % 2 === 0 ? 2 : 1;
}

const beamCells = new Map<string, Frame>();

function beamCell(d: number, c: Color, a: number, b: number): Frame {
  const key = `${d}:${c}:${a}:${b}`;
  let f = beamCells.get(key);
  if (!f) {
    const buf = new PixelBuffer(d, d);
    buf.rect(a, 0, b - a, d, c);
    beamCells.set(key, (f = { buf, ox: 0, oy: 0, density: d }));
  }
  return f;
}

/** One 1-px row of a beam from logical x0 to x1 (edges on 1 / d px), screen space. */
function beamRow(r: Renderer, d: number, x0: number, x1: number, y: number, c: Color, o: DrawOpts): void {
  const L = Math.round(x0 * d);
  const R = Math.max(L + 1, Math.round(x1 * d));
  const li = Math.ceil(L / d);
  const ri = Math.floor(R / d);
  if (li > ri) {
    // Inside one logical pixel.
    const cell = Math.floor(L / d);
    r.frame(beamCell(d, c, L - cell * d, R - cell * d), cell, y, o);
    return;
  }
  if (ri > li) r.rect(li, y, ri - li, 1, c, o);
  if (L < li * d) r.frame(beamCell(d, c, L - (li - 1) * d, d), li - 1, y, o);
  if (R > ri * d) r.frame(beamCell(d, c, 0, R - ri * d), ri, y, o);
}

/** Draw the sky, the beams, the base and (by default) the wall. `t` = frames (any clock). */
export function drawBase(r: Renderer, t: number, o: BaseOpts = DEFAULT): void {
  const parked = o.parked !== false;
  const prev = setArtDensity(screenArt(r, LAYERS));
  r.sprite(BASE_ART.sky, 0, 0, 0, plain);
  // Searchlights: long thin wedges sweeping the sky (drawn in 2-px rows; finer on a big backbuffer).
  const fine = beamDensity(r.res);
  for (const [bx, by, phase, speed] of BEAMS) {
    const a = Math.sin(t * speed + phase) * 0.62;
    const tan = Math.tan(a);
    if (fine > 1) {
      for (let y = by - 1; y > -2; y--) {
        const d = by - y;
        const cx = bx + d * tan;
        const hw = 1 + d * 0.085;
        beamRow(r, fine, cx - hw, cx + hw, y, PAL.sky[3], beamOpts);
        beamRow(r, fine, cx - Math.max(0.5, hw * 0.4), cx + Math.max(0.5, hw * 0.4), y, PAL.snow[3], coreOpts);
      }
      continue;
    }
    for (let y = by - 2; y > -2; y -= 2) {
      const d = by - y;
      const cx = bx + d * tan;
      const hw = 1 + d * 0.085;
      r.rect(Math.round(cx - hw), y, Math.round(hw * 2), 2, PAL.sky[3], beamOpts);
      r.rect(Math.round(cx - hw * 0.4), y, Math.max(1, Math.round(hw * 0.8)), 2, PAL.snow[3], coreOpts);
    }
  }
  r.sprite(BASE_ART.land, 0, 0, BASE_LAND_Y, plain);
  const net = netBox();
  r.sprite(BASE_ART.net, parked && hasSprite(BASE_PARKED) ? 1 : 0, net.x, net.y, plain);
  // Smoke from the stove pipe: five puffs rising and drifting right, fading as they go.
  for (let i = 0; i < 5; i++) {
    const life = (t * 0.35 + i * 34) % 170;
    const x = 36 + life * 0.55 + Math.sin((t + i * 40) * 0.02) * 3;
    const y = BASE_GROUND - 58 - life * 0.42;
    smokeOpts.alpha = 0.32 * (1 - life / 170);
    r.sprite(BASE_ART.puff, 0, Math.round(x), Math.round(y), smokeOpts);
  }
  setArtDensity(prev);
  // The mast lights: the top one blinks slowly, the middle one answers half a beat later.
  const on1 = t % 80 < 40;
  const on2 = (t + 40) % 80 < 30;
  mastLight(r, BASE_MAST_X, BASE_MAST_TOP - 2, on1);
  mastLight(r, BASE_MAST_X, BASE_MAST_TOP + 44, on2);
  // A warning light on the hangar roof.
  mastLight(r, 68, BASE_GROUND - 47, t % 120 < 12);
  if (o.wall !== false) drawBaseWall(r);
}

let netCache: { x: number; y: number } | null = null;

/** The netting layer's top-left (its box depends on the parked swan's 1× frame). */
function netBox(): { x: number; y: number } {
  netCache ??= baseNetBox();
  return netCache;
}

function mastLight(r: Renderer, x: number, y: number, on: boolean): void {
  if (!on) {
    r.rect(x - 1, y, 3, 2, PAL.red[0], plain);
    return;
  }
  glowOpts.alpha = 0.35;
  r.rect(x - 3, y - 2, 7, 6, PAL.red[2], glowOpts);
  r.rect(x - 1, y, 3, 2, PAL.red[3], plain);
}

/** The sandbag wall with its barbed wire (the title draws it after its patrol). */
export function drawBaseWall(r: Renderer): void {
  const prev = setArtDensity(screenArt(r, WALL_LAYER));
  r.sprite(BASE_ART.wall, 0, 0, BASE_WALL_Y, plain);
  setArtDensity(prev);
}

/** The title patrol walks 0.4 px/tick between x 40 and w − 40, then turns round. */
const PATROL_SPEED = 0.4;

/** The patrol's x at time t. */
export function patrolX(t: number, w = W): number {
  const span = w - 80;
  const d = (t * PATROL_SPEED) % (span * 2);
  return 40 + (d < span ? d : span * 2 - d);
}

/** True while the patrol walks back to the left (draw it flipped). */
export function patrolFlip(t: number, w = W): boolean {
  const span = w - 80;
  return (t * PATROL_SPEED) % (span * 2) >= span;
}

const titleOpts: DrawOpts = { screen: true };

/**
 * A menu title as stencil lettering (`ui/mil/stencil-<slug>`, content/ui/military.art.ts),
 * centred with its top at y; the big font in gold when the sprite is missing.
 */
export function drawStencilTitle(r: Renderer, text: string, y: number): void {
  const id = stencilId(text);
  if (hasSprite(id)) {
    const f = getFrame(id, 0, 1);
    drawScreenSprite(r, id, 0, (r.w - frameW(f)) >> 1, y, titleOpts);
  } else centerText(r, text, y + 4, UI_GOLD, 'big');
}

const panelOpts: DrawOpts = { screen: true };

/**
 * A military menu box: a gunmetal fill at `alpha` inside a rust-brown steel rim (2 px, lit
 * top-left) with an ink edge and a bolt in each corner. Rects only.
 */
export function drawMilPanel(r: Renderer, x: number, y: number, w: number, h: number, alpha = 0.92): void {
  panelOpts.alpha = 1;
  r.rect(x - 3, y - 3, w + 6, h + 6, INK, panelOpts);
  r.rect(x - 2, y - 2, w + 4, h + 4, PAL.brown[1], panelOpts);
  r.rect(x - 2, y - 2, w + 4, 1, PAL.brown[3], panelOpts);
  r.rect(x - 2, y - 2, 1, h + 4, PAL.brown[2], panelOpts);
  r.rect(x - 2, y + h + 1, w + 4, 1, PAL.brown[0], panelOpts);
  r.rect(x + w + 1, y - 2, 1, h + 4, PAL.brown[0], panelOpts);
  r.rect(x - 1, y - 1, w + 2, h + 2, INK, panelOpts);
  panelOpts.alpha = alpha;
  r.rect(x, y, w, h, PAL.steel[0], panelOpts);
  panelOpts.alpha = 1;
  r.rect(x, y, w, 1, PAL.steel[1], panelOpts);
  // The corner bolts: HD bolt heads at the art tier (`ui/mil/bolt`), else the 1× rects.
  const d = hasSprite(BOLT) ? screenArtOf(r, BOLT) : 1;
  const prev = d > 1 ? setArtDensity(d) : 0;
  for (let i = 0; i < 4; i++) {
    const bx = i & 1 ? x + w - 2 : x - 3;
    const by = i & 2 ? y + h - 2 : y - 3;
    if (d > 1) {
      r.sprite(BOLT, 0, bx, by, panelOpts);
      continue;
    }
    r.rect(bx, by, 5, 5, INK, panelOpts);
    r.rect(bx + 1, by + 1, 3, 3, PAL.stone[2], panelOpts);
    r.rect(bx + 1, by + 1, 2, 1, PAL.stone[3], panelOpts);
    r.rect(bx + 3, by + 2, 1, 2, PAL.stone[0], panelOpts);
  }
  if (d > 1) setArtDensity(prev);
}
const BOLT = 'ui/mil/bolt';

// ---------------------------------------------------------------------------------------------
// Screen art at the tier
// ---------------------------------------------------------------------------------------------

/**
 * The menu art the screens own (`releaseScreenArt` drops its 4× frames when the game proper
 * starts): the backdrop, the military frame and its parts, the logo, the radio card, the gags.
 */
export const MENU_ART: readonly string[] = ['ui/base/', 'ui/mil/', 'ui/logo', 'ui/portrait-gusto', 'ui/radio', 'ui/loudspeaker', 'ui/chair', 'ui/rope'];

/** Workers of the screen art pool (at most; never more than the machine's pool size). */
export const SCREEN_POOL_MAX = 4;

/** The highest density a screen may draw on `r` now: the art tier, at most the backbuffer res. */
export function screenTier(r: Pick<Renderer, 'res'>): ArtDensity {
  const t = artTier();
  if (t >= 4 && r.res >= 4 && r.res % 4 === 0) return 4;
  if (t >= 2 && r.res >= 2) return 2;
  return 1;
}

let poolFactory: (() => ArtPool | null | 'none') | null = null;
let pool: ArtPool | null = null;
/** Ids handed to the pool and not back yet, per density. */
const inFlight2 = new Set<string>();
const inFlight4 = new Set<string>();
/** Ids the pool did not deliver at that density (a broken generator): never asked again. */
const unbuilt2 = new Set<string>();
const unbuilt4 = new Set<string>();
/** Ids a screen drew or asked for at 4× since the last release. */
const asked4 = new Set<string>();
/** Bumped by releaseScreenArt: a build that comes back after a release is released again. */
let epoch = 0;
/** The `keep` of the last release (a late build releases what it would not keep). */
let keepAfter: ((id: string) => boolean) | undefined;
/** Close the pool once it is idle (after a release). */
let closing = false;
let todo: string[] = [];

/**
 * The default screen art pool: browser workers; null (build in this thread) in node tools and
 * tests; 'none' in a browser without Worker (the screens keep the art they have: a dense screen
 * never stalls the main thread).
 */
function defaultPool(): ArtPool | null | 'none' {
  if (typeof Worker !== 'undefined') return browserArtPool(Math.min(SCREEN_POOL_MAX, poolSize()));
  return typeof document === 'undefined' ? null : 'none';
}

/**
 * Replace the screen art pool (tests, tools): `factory` returns the pool, or null to build in
 * this thread at once; null restores the default (browser workers; in-thread without Worker).
 * Closes the old pool and forgets every request.
 */
export function setScreenArtPool(factory: (() => ArtPool | null | 'none') | null): void {
  pool?.close();
  pool = null;
  poolFactory = factory;
  inFlight2.clear();
  inFlight4.clear();
  unbuilt2.clear();
  unbuilt4.clear();
  asked4.clear();
  keepAfter = undefined;
  closing = false;
}

/** The keep rule of a mission start: the strips of these heroes (`char/<id>/`) and the vehicles. */
export function keepForHeroes(heroes: readonly string[]): (id: string) => boolean {
  const pre = heroes.map((h) => `char/${h}/`);
  return (id) => id.startsWith('vehicle/') || pre.some((p) => id.startsWith(p));
}

/** The dense density getFrames(id, d) would draw `id` at (its highest art ≤ d that is not broken), else 1. */
function denseAt(id: string, d: number): ArtDensity {
  if (d >= 4 && !unbuilt4.has(id) && hasHiSprite(id, 4)) return 4;
  if (d >= 2 && !unbuilt2.has(id) && hasHiSprite(id, 2)) return 2;
  return 1;
}

/** Would `id` draw at density d without generating anything? */
function readyAt(id: string, d: number): boolean {
  const dd = denseAt(id, d);
  return dd === 1 || hasFramesAt(id, dd);
}

/**
 * The density to draw a group of sprite ids at on `r` NOW (1, 2 or 4): the highest one ≤
 * `screenTier(r)` at which every id is built. Missing frames at the tier go to the screen art
 * pool. Unknown ids are skipped. No allocation once everything is built.
 */
export function screenArt(r: Renderer, ids: readonly string[]): ArtDensity {
  const top = screenTier(r);
  if (top === 1) return 1;
  request(ids, top);
  let ok4 = top >= 4;
  let ok2 = true;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!hasSprite(id)) continue;
    if (ok4 && !readyAt(id, 4)) ok4 = false;
    if (ok2 && !readyAt(id, 2)) ok2 = false;
  }
  return ok4 ? 4 : ok2 ? 2 : 1;
}

/**
 * Ask the screen art pool now for a group the NEXT screen draws (at the tier `r` shows), so it is
 * built by the time that screen opens. Nothing at tier 1.
 */
export function prefetchScreenArt(r: Pick<Renderer, 'res'>, ids: readonly string[]): void {
  const top = screenTier(r);
  if (top > 1) request(ids, top);
}

/** The density of one id (screenArt for a group of one, without an array). */
export function screenArtOf(r: Renderer, id: string): ArtDensity {
  one[0] = id;
  return screenArt(r, one);
}
const one: string[] = [''];

/** The menu cursor (app.ts `drawCursor`) at the screen density of `ui/cursor-swan`. */
export function drawScreenCursor(r: Renderer, x: number, y: number, t: number): void {
  const prev = setArtDensity(screenArtOf(r, CURSOR));
  drawCursor(r, x, y, t);
  setArtDensity(prev);
}
const CURSOR = 'ui/cursor-swan';

/** r.sprite at the screen density of `id` (the global art density is restored after). */
export function drawScreenSprite(r: Renderer, id: string, frame: number, x: number, y: number, o?: DrawOpts): void {
  const prev = setArtDensity(screenArtOf(r, id));
  r.sprite(id, frame, x, y, o);
  setArtDensity(prev);
}

/** Hand the ids of a group without frames at the tier to the pool (each once). */
function request(ids: readonly string[], top: number): void {
  for (let pass = 0; pass < 2; pass++) {
    const d: DenseDensity = pass === 0 ? 4 : 2;
    if (d > top) continue;
    const flight = d === 4 ? inFlight4 : inFlight2;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!hasSprite(id) || denseAt(id, top) !== d) continue;
      if (d === 4) asked4.add(id);
      if (hasFramesAt(id, d) || flight.has(id)) continue;
      todo.push(id);
    }
    if (todo.length > 0) {
      const list = todo;
      todo = [];
      build(list, d);
    }
  }
}

function build(list: string[], d: DenseDensity): void {
  closing = false;
  if (!pool) {
    const made = (poolFactory ?? defaultPool)();
    if (made === 'none') {
      // No workers in this browser: these ids stay at the art they have.
      for (const id of list) (d === 4 ? unbuilt4 : unbuilt2).add(id);
      return;
    }
    pool = made;
  }
  const p = pool;
  if (!p) {
    // No workers (node tools and tests): build in this thread now.
    const deferred = setDeferDense(false);
    try {
      for (const id of list) getFrames(id, d);
    } finally {
      setDeferDense(deferred);
    }
    return;
  }
  const flight = d === 4 ? inFlight4 : inFlight2;
  const broken = d === 4 ? unbuilt4 : unbuilt2;
  for (const id of list) flight.add(id);
  const at = epoch;
  const done = (): void => {
    for (const id of list) {
      flight.delete(id);
      if (!hasFramesAt(id, d)) broken.add(id);
    }
    // Released while it was building: drop the late 4× frames again (those the release kept stay).
    if (d === 4 && at !== epoch) releaseDense(list.filter((id) => !keepAfter?.(id)), 4);
    closeIfIdle();
  };
  void p.build(list, d).then(done, (err: unknown) => {
    console.warn('[screens] art build failed', err);
    done();
  });
}

function isMenuArt(id: string): boolean {
  for (const p of MENU_ART) if (id.startsWith(p)) return true;
  return false;
}

function closeIfIdle(): void {
  if (closing && pool && pool.pending === 0 && inFlight2.size === 0 && inFlight4.size === 0) {
    pool.close();
    pool = null;
    closing = false;
  }
}

/**
 * The game proper starts (a mission, the attract demo): drop the 4× frames the screens built or
 * drew (the menu art, the title's patrol, the select previews) except those `keep` names (the
 * chosen heroes' strips, the Swan: the mission's working set holds them), so the tier-4 working
 * set has DENSE_BUDGET_BYTES to itself; close the screen pool once its builds are back. The 2×
 * frames stay. Returns the bytes freed.
 */
export function releaseScreenArt(keep?: (id: string) => boolean): number {
  epoch++;
  keepAfter = keep;
  const ids: string[] = [];
  for (const id of asked4) if (!keep?.(id)) ids.push(id);
  asked4.clear();
  closing = true;
  closeIfIdle();
  return releaseDense(ids, 4);
}

/** Bytes of the 4× frames of the menu art resident now (each buffer once). */
export function screenArtBytes(): number {
  const seen = new Set<object>();
  let bytes = 0;
  for (const id of asked4) {
    if (!isMenuArt(id) || !hasFramesAt(id, 4)) continue;
    for (const f of getFrames(id, 4)) {
      if (seen.has(f.buf) || (f.density ?? 1) !== 4) continue;
      seen.add(f.buf);
      bytes += f.buf.data.byteLength;
    }
  }
  return bytes;
}
