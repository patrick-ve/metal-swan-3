/**
 * The ending's lake (GDD §13.3): a lake at dusk (`sky-gradient` + `hills` + `sea`) with the SWAN-3
 * swimming across it; the captions, the victory poses and the final tally are drawn over it.
 * `drawSwanRig` also draws the title's patrolling swan.
 *
 * The swan is composed in the draw order of docs/design/swan-mount/look.md §7: body strip
 * `vehicle/swan/swim`, the rider's `char/<id>/ride-sit` at the body's `seat` point, the
 * `swim-front` overlay, then `swim-neck-relax` at the body's `neck` point. Until that art exists
 * the stand-in `ui/title-swan` (screens.art.ts) is drawn instead. Pure drawing, no state.
 *
 * Screen art (UHD, docs/ART_GUIDE.md "UHD art"): the lake is the sprite `ui/ending-lake`
 * (content/ui/ending.art.ts: its 1× frame is the old backdrop, its 2× and 4× frames are painted
 * natively). The lake and a swan rig with `screen: true` draw at the density base.ts `screenArt`
 * picks for their group (the art tier when it is built; the screen art pool builds it, never this
 * thread). At res 1 or tier 1 everything draws exactly as before.
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import { getFrame, hasSprite, setArtDensity } from '../../engine/sprites';
import { getCharacter } from '../registry';
import { screenArt } from './base';

export const LAKE_HORIZON = 128;
/** The water surface the swan swims on (her float line is 16 px lower). */
export const LAKE_SURFACE = 186;
/** Her speed across the water (GDD §13.3). */
export const SWAN_SPEED = 0.25;

const plain: DrawOpts = { screen: true };
const shimmer: DrawOpts = { screen: true, alpha: 0.6 };
const swanOpts: DrawOpts = { screen: true };
const riderOpts: DrawOpts = { screen: true };

/**
 * The ending flow's screen art (content/ui/ending.art.ts registers it; scenes name sprites by id,
 * they never import art modules).
 */
export const LAKE_ID = 'ui/ending-lake';
export const GLINT_ID = 'ui/ending-glint';
export const NIGHT_ID = 'ui/ending-night';
export const EMBER_ID = 'ui/ending-ember';
export const BEAM_ID = 'ui/ending-beam';
export const STAGE_ID = 'ui/ending-stage';
export const SEA_NIGHT_ID = 'ui/ending-sea-night';
export const SEA_DAWN_ID = 'ui/ending-sea-dawn';
export const STREET_SKY_ID = 'ui/ending-street-sky';
export const STREET_CITY_ID = 'ui/ending-street-city';
export const STREET_ID = 'ui/ending-street';
/** Every backdrop and effect of the ending flow (their 4× frames are dropped when the flow ends). */
export const ENDING_ART: readonly string[] = [LAKE_ID, GLINT_ID, NIGHT_ID, EMBER_ID, BEAM_ID, STAGE_ID, SEA_NIGHT_ID, SEA_DAWN_ID, STREET_SKY_ID, STREET_CITY_ID, STREET_ID];
/** The lake's sprites (one group: they switch to HD together). */
export const LAKE_ART: readonly string[] = [LAKE_ID, GLINT_ID];

/**
 * Draw the lake backdrop with its moving water glints. `t` = frames since the title opened. At a
 * screen density ≥ 2 (`screenArt`) the UHD lake and glints.
 */
export function drawLake(r: Renderer, t: number): void {
  const d = screenArt(r, LAKE_ART);
  if (d > 1) r.frame(getFrame(LAKE_ID, 0, d), 0, 0, plain);
  else r.image(getFrame(LAKE_ID, 0, 1).buf, 0, 0, plain);
  // Slow glints drifting on the water (cosmetic, from the frame count).
  for (let i = 0; i < 14; i++) {
    const y = LAKE_HORIZON + 8 + ((i * 37) % (r.h - LAKE_HORIZON - 10));
    const x = ((i * 89 + Math.floor(t * (0.15 + (i % 3) * 0.05))) % (r.w + 20)) - 10;
    const len = 3 + (i % 4) * 2;
    if (d > 1) r.frame(getFrame(GLINT_ID, (i % 4) * 2 + (i % 2), d), x, y, shimmer);
    else r.rect(x, y, len, 1, i % 2 ? PAL.pink[2] : PAL.purple[2], shimmer);
  }
}

/** The far-bank parade: a column of eight bandsmen marching left at 0.3 px/tick, looping. */
export function drawParade(r: Renderer, t: number): void {
  if (!hasSprite('ui/parade')) return;
  const span = r.w + 120;
  const head = r.w + 40 - ((t * 0.3) % span);
  const frame = Math.floor(t / 10) % 2;
  for (let i = 0; i < 8; i++) {
    const x = Math.round(head + i * 9);
    if (x < -8 || x > r.w + 8) continue;
    r.sprite('ui/parade', (frame + i) % 2, x, LAKE_HORIZON - 3, plain);
  }
}

/** Is the real swimming swan art there (else the stand-in is drawn)? */
export function hasSwanArt(): boolean {
  return hasSprite('vehicle/swan/swim');
}

const ridden: SwanRigOpts = { anim: 'swim', neck: 'swim-neck-relax', char: 'vincent', pose: 'ride-sit', bodyTicks: 6 };

/**
 * The ridden, swimming SWAN-3 with her float line (feet) at (x, y), facing right; `t` animates
 * the paddling. The rider is `char` (default Vincent, the squad's first) in `ride-sit`. `screen`:
 * as SwanRigOpts.screen.
 */
export function drawRiddenSwan(r: Renderer, x: number, y: number, t: number, char = 'vincent', screen = false): void {
  if (hasSwanArt()) {
    ridden.char = char;
    ridden.screen = screen;
    drawSwanRig(r, x, y, t, ridden);
  } else {
    // The stand-in: one body sprite with seat and neck points, the rider on top.
    const fi = Math.floor(t / 6);
    const f = getFrame('ui/title-swan', fi, 1);
    const seat = f.pts?.seat ?? [-4, -30];
    r.sprite('ui/title-swan', fi, x, y, swanOpts);
    drawRider(r, x + seat[0], y + seat[1], t, char, 'ride-sit', 20);
  }
}

export interface SwanRigOpts {
  /** Body strip under `vehicle/swan/` (`swim`, `move`, `idle` …); its `-front` overlay is used when it exists. */
  anim: string;
  /** Neck strip under `vehicle/swan/` (`swim-neck-relax`, `neck-relax` …), at the body's `neck` point. */
  neck: string;
  /** Rider character id ('' = no rider). */
  char: string;
  /** Rider pose strip under `char/<id>/` (`ride-sit`, `ride-cheer`), else the `mount` frame. */
  pose: string;
  bodyTicks?: number;
  riderTicks?: number;
  flipX?: boolean;
  /**
   * Draw at the screen density (base.ts `screenArt` over the rig's sprites: body, front, neck
   * and the rider's strip, so they switch to HD together). Default: exactly r.sprite at the
   * global art density.
   */
  screen?: boolean;
}

/** The rig's sprites of one draw (reused: no allocation once grown). */
const rigIds: string[] = [];

/**
 * The swan with a rider composed from the real art (look.md §7): body, rider at the seat point,
 * front overlay, neck at the neck point. `flipX` mirrors the whole rig (she faces left). Nothing
 * is drawn when the body strip is missing.
 */
export function drawSwanRig(r: Renderer, x: number, y: number, t: number, o: SwanRigOpts): void {
  const body = `vehicle/swan/${o.anim}`;
  if (!hasSprite(body)) return;
  const front = `${body}-front`;
  const neckId = hasSprite(`vehicle/swan/${o.neck}`) ? `vehicle/swan/${o.neck}` : 'vehicle/swan/neck';
  const rider = o.char ? riderStrip(o.char, o.pose) : null;
  let prev = 0;
  if (o.screen) {
    rigIds.length = 0;
    rigIds.push(body, front, neckId);
    if (rider) rigIds.push(rider.id);
    prev = setArtDensity(screenArt(r, rigIds));
  }
  const fi = Math.floor(t / (o.bodyTicks ?? 6));
  const f = getFrame(body, fi, 1);
  const dir = o.flipX ? -1 : 1;
  swanOpts.flipX = o.flipX === true;
  const seat = f.pts?.seat ?? [-4, -30];
  const neck = f.pts?.neck ?? [16, -30];
  r.sprite(body, fi, x, y, swanOpts);
  if (o.char) drawRider(r, x + seat[0] * dir, y + seat[1], t, o.char, o.pose, o.riderTicks ?? 20, o.flipX === true);
  if (hasSprite(front)) r.sprite(front, fi, x, y, swanOpts);
  if (hasSprite(neckId)) r.sprite(neckId, 0, x + neck[0] * dir, y + neck[1], swanOpts);
  swanOpts.flipX = false;
  if (o.screen) setArtDensity(prev);
}

const strip = { id: '', frame1: false };

/** The rider's strip: the pose (e.g. `ride-sit`), else `ride-sit`, else the `mount` frame (frame1). */
function riderStrip(char: string, pose: string): { id: string; frame1: boolean } | null {
  const art = getCharacter(char).art;
  const want = `${art}/${pose}`;
  const sit = `${art}/ride-sit`;
  const mount = `${art}/mount`;
  if (hasSprite(want)) strip.id = want;
  else if (hasSprite(sit)) strip.id = sit;
  else if (hasSprite(mount)) strip.id = mount;
  else return null;
  strip.frame1 = strip.id === mount;
  return strip;
}

/** The rider at the hip point: the pose strip (e.g. `ride-sit`), else the `mount` frame 17 px lower. */
function drawRider(r: Renderer, hx: number, hy: number, t: number, char: string, pose: string, ticks: number, flipX = false): void {
  const s = riderStrip(char, pose);
  if (!s) return;
  riderOpts.flipX = flipX;
  if (s.frame1) r.sprite(s.id, 1, hx, hy + 17, riderOpts);
  else r.sprite(s.id, Math.floor(t / ticks), hx, hy, riderOpts);
}

/** A soft dark veil over the lake for menus drawn on top of it. */
export function veil(r: Renderer, alpha = 0.55, c: Color = INK): void {
  r.fade(c, alpha);
}
