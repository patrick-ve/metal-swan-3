/**
 * The title backdrop (GDD §13.3): a lake at dusk (`sky-gradient` + `hills` + `sea`), a tiny
 * crimson Legion parade marching along the far bank, and the SWAN-3 gliding across the water
 * from left to right at 0.25 px/tick with Captain Grace sitting perfectly still on her back
 * while her legs paddle like mad under the surface.
 *
 * The swan is composed in the draw order of docs/design/swan-mount/look.md §7: body strip
 * `vehicle/swan/swim`, the rider's `char/<id>/ride-sit` at the body's `seat` point, the
 * `swim-front` overlay, then `swim-neck-relax` at the body's `neck` point. Until that art exists
 * the stand-in `ui/title-swan` (screens.art.ts) is drawn instead. Pure drawing, no state but a
 * cached backdrop.
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Renderer } from '../../engine/render';
import { getFrame, hasSprite } from '../../engine/sprites';
import { getBgGenerator, hasBgGenerator } from '../art/art-registry';
import { getCharacter } from '../registry';

export const LAKE_HORIZON = 128;
/** The water surface the swan swims on (her float line is 16 px lower). */
export const LAKE_SURFACE = 186;
/** Her speed across the water (GDD §13.3). */
export const SWAN_SPEED = 0.25;

let backdrop: PixelBuffer | null = null;

/** Sky, far hills and water in one 384 × 216 buffer (built once). */
function buildBackdrop(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const dusk: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.orange[2]];
  if (hasBgGenerator('sky-gradient')) {
    b.blit(getBgGenerator('sky-gradient')(w, LAKE_HORIZON + 4, { colors: dusk, dither: 0.35, sun: { x: 0.74, y: LAKE_HORIZON - 2, r: 11 }, stars: 18, y1: LAKE_HORIZON }, 7), 0, 0);
  } else b.gradient(0, 0, w, LAKE_HORIZON + 4, dusk);
  if (hasBgGenerator('hills')) {
    b.blit(getBgGenerator('hills')(w, LAKE_HORIZON + 4, { ramp: [PAL.ink[1], PAL.navy[0], PAL.purple[0], PAL.purple[1]], y: LAKE_HORIZON - 22, height: 14, scale: 90, bushes: false }, 11), 0, 0);
  } else b.rect(0, LAKE_HORIZON - 12, w, 16, PAL.navy[0]);
  // The far bank: a dark strip the parade marches on.
  b.rect(0, LAKE_HORIZON - 3, w, 4, PAL.ink[1]);
  b.rect(0, LAKE_HORIZON - 4, w, 1, PAL.navy[0]);
  const water: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1]];
  if (hasBgGenerator('sea')) {
    // The sea layer is transparent above its horizon, so it goes on top as a whole.
    b.blit(getBgGenerator('sea')(w, h, { ramp: water, y: LAKE_HORIZON + 1, sparkle: 0.8, foam: PAL.pink[2] }, 5), 0, 0);
  } else b.gradient(0, LAKE_HORIZON + 1, w, h - LAKE_HORIZON - 1, [...water].reverse());
  // The sun's reflection: a column of gold dashes on the water under the sun.
  const sx = Math.round(w * 0.74);
  for (let y = LAKE_HORIZON + 2; y < h; y += 3) {
    const half = 2 + Math.floor((y - LAKE_HORIZON) / 9);
    const jitter = ((y * 7) % 5) - 2;
    b.rect(sx - half + jitter, y, half * 2 - ((y >> 2) % 3), 1, y < LAKE_HORIZON + 30 ? PAL.gold[2] : PAL.orange[2]);
  }
  return b;
}

const plain: DrawOpts = { screen: true };
const shimmer: DrawOpts = { screen: true, alpha: 0.6 };
const swanOpts: DrawOpts = { screen: true };
const riderOpts: DrawOpts = { screen: true };

/** Draw the lake backdrop with its moving water glints. `t` = frames since the title opened. */
export function drawLake(r: Renderer, t: number): void {
  backdrop ??= buildBackdrop(r.w, r.h);
  r.image(backdrop, 0, 0, plain);
  // Slow glints drifting on the water (cosmetic, from the frame count).
  for (let i = 0; i < 14; i++) {
    const y = LAKE_HORIZON + 8 + ((i * 37) % (r.h - LAKE_HORIZON - 10));
    const x = ((i * 89 + Math.floor(t * (0.15 + (i % 3) * 0.05))) % (r.w + 20)) - 10;
    const len = 3 + (i % 4) * 2;
    r.rect(x, y, len, 1, i % 2 ? PAL.pink[2] : PAL.purple[2], shimmer);
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

/**
 * The ridden, swimming SWAN-3 with her float line (feet) at (x, y), facing right; `t` animates
 * the paddling. The rider is `char` (default Grace) in `ride-sit`.
 */
export function drawRiddenSwan(r: Renderer, x: number, y: number, t: number, char = 'grace'): void {
  if (hasSwanArt()) drawSwanRig(r, x, y, t, { anim: 'swim', neck: 'swim-neck-relax', char, pose: 'ride-sit', bodyTicks: 6 });
  else {
    // The stand-in: one body sprite with seat and neck points, the rider on top.
    const fi = Math.floor(t / 6);
    const f = getFrame('ui/title-swan', fi);
    const seat = f.pts?.seat ?? [-4, -30];
    r.sprite('ui/title-swan', fi, x, y, swanOpts);
    drawRider(r, x + seat[0], y + seat[1], t, char, 'ride-sit', 20);
  }
}

export interface SwanRigOpts {
  /** Body strip under `vehicle/swan/` (`swim`, `move`, `idle` …); its `-front` overlay is used when it exists. */
  anim: string;
  /** Neck strip under `vehicle/swan/` (`swim-neck-relax`, `neck-relax` …), drawn at the body's `neck` point. */
  neck: string;
  /** Rider character id and pose strip (`ride-sit`, `ride-cheer` …); no rider when `char` is ''. */
  char: string;
  pose: string;
  /** Ticks per body frame and per rider frame. */
  bodyTicks?: number;
  riderTicks?: number;
  flipX?: boolean;
}

/**
 * A ridden SWAN-3 composed in the draw order of look.md §7: the body strip, the rider at the
 * body's `seat` point, the `-front` overlay that hides the rider's hips, then the neck at the
 * body's `neck` point. Facing right (or left with `flipX`); feet at (x, y).
 */
export function drawSwanRig(r: Renderer, x: number, y: number, t: number, o: SwanRigOpts): void {
  const body = `vehicle/swan/${o.anim}`;
  if (!hasSprite(body)) return;
  const fi = Math.floor(t / (o.bodyTicks ?? 6));
  const f = getFrame(body, fi);
  const dir = o.flipX ? -1 : 1;
  swanOpts.flipX = o.flipX === true;
  const seat = f.pts?.seat ?? [-4, -30];
  const neck = f.pts?.neck ?? [16, -30];
  r.sprite(body, fi, x, y, swanOpts);
  if (o.char) drawRider(r, x + seat[0] * dir, y + seat[1], t, o.char, o.pose, o.riderTicks ?? 20, o.flipX === true);
  const front = `${body}-front`;
  if (hasSprite(front)) r.sprite(front, fi, x, y, swanOpts);
  const neckId = hasSprite(`vehicle/swan/${o.neck}`) ? `vehicle/swan/${o.neck}` : 'vehicle/swan/neck';
  if (hasSprite(neckId)) r.sprite(neckId, 0, x + neck[0] * dir, y + neck[1], swanOpts);
  swanOpts.flipX = false;
}

/** The rider at the hip point: the pose strip (e.g. `ride-sit`), else the `mount` frame 17 px lower. */
function drawRider(r: Renderer, hx: number, hy: number, t: number, char: string, pose: string, ticks: number, flipX = false): void {
  const art = getCharacter(char).art;
  riderOpts.flipX = flipX;
  const strip = `${art}/${pose}`;
  const sit = `${art}/ride-sit`;
  if (hasSprite(strip) || hasSprite(sit)) {
    const id = hasSprite(strip) ? strip : sit;
    r.sprite(id, Math.floor(t / ticks), hx, hy, riderOpts);
    return;
  }
  const mount = `${art}/mount`;
  if (hasSprite(mount)) r.sprite(mount, 1, hx, hy + 17, riderOpts);
}

/** A soft dark veil over the lake for menus drawn on top of it. */
export function veil(r: Renderer, alpha = 0.55, c: Color = INK): void {
  r.fade(c, alpha);
}
