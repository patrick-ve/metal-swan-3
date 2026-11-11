/**
 * The strip space (docs/design/oat.md §8.6, §8.2; the contract: ./types.ts "THE STRIP SPACE"): a
 * façade strip is drawn 1:1 and scrolls with its plane's line-scroll speed s, so its columns are
 * strip x p = 192 + (u − 192) · s of the world x u (192 = FLOOR_CX, the eye's column). Pure maths for
 * the store, the view and the strip sources (GRAMMAR maps its lots' world u and world px with these).
 */
import { FLOOR_CX, FLOOR_YW, sAtDepth } from '../../../engine/floor/cam';
import type { FloorCam } from '../../../engine/floor/cam';
import { STRIP_CHUNK } from './types';

/** Strip x of world x u on a plane of scale s (s 1: the same number). */
export function stripXOfU(u: number, s: number): number {
  return FLOOR_CX + (u - FLOOR_CX) * s;
}

/** World x of strip x p on a plane of scale s. */
export function uOfStripX(p: number, s: number): number {
  return FLOOR_CX + (p - FLOOR_CX) / s;
}

/** The chunk that holds world x u. */
export function stripChunkOfU(u: number, s: number): number {
  return Math.floor(stripXOfU(u, s) / STRIP_CHUNK);
}

/** World x range [u0, u1) of chunk cx. */
export function chunkWorldRange(cx: number, s: number, out: { u0: number; u1: number } = { u0: 0, u1: 0 }): { u0: number; u1: number } {
  out.u0 = uOfStripX(cx * STRIP_CHUNK, s);
  out.u1 = uOfStripX((cx + 1) * STRIP_CHUNK, s);
  return out;
}

/**
 * The chunks a world x range touches, [c0, c1] (inclusive; c1 < c0 for an empty range).
 */
export function chunksOfRange(u0: number, u1: number, s: number, out: { c0: number; c1: number } = { c0: 0, c1: -1 }): { c0: number; c1: number } {
  if (!(u1 > u0)) {
    out.c0 = 0;
    out.c1 = -1;
    return out;
  }
  out.c0 = Math.floor(stripXOfU(u0, s) / STRIP_CHUNK);
  out.c1 = Math.ceil(stripXOfU(u1, s) / STRIP_CHUNK) - 1;
  return out;
}

/**
 * The art rows of band b of n of a chunk painted at H art rows (H = height · d): [r0, r1). Bands
 * tile the chunk top to bottom without a gap or an overlap.
 */
export function stripBandRows(b: number, n: number, H: number, out: { r0: number; r1: number } = { r0: 0, r1: 0 }): { r0: number; r1: number } {
  const k = Math.max(1, n | 0);
  out.r0 = Math.floor((b * H) / k);
  out.r1 = Math.floor(((b + 1) * H) / k);
  return out;
}

/** The scale of a strip plane at `depth` behind the walk line (no floor camera: 1). */
export function stripScale(cam: Pick<FloorCam, 'yh' | 'yw'> | null, depth: number): number {
  if (!cam) return 1;
  const s = sAtDepth(cam, depth);
  return s > 0.05 ? s : 0.05;
}

/**
 * The world y of a strip's base (the façade's foot on flat ground): the walk line minus the depth
 * (the floor's `yw − depth`, as decor at that depth; FLOOR_YW without a floor camera).
 */
export function stripBaseY(cam: Pick<FloorCam, 'yw'> | null, depth: number): number {
  return (cam ? cam.yw : FLOOR_YW) - depth;
}

/**
 * The renderer's world x of strip x p while the camera is at camX: drawn there, p shows at screen x
 * p − camX · s (the plane's line-scroll speed), exactly where world x uOfStripX(p) at the plane's
 * depth shows (floor/cam.ts `shiftX`).
 */
export function stripDrawX(p: number, s: number, camX: number): number {
  return p + camX * (1 - s);
}

/**
 * The camera's speed in world px per TICK for the store's prefetch (`StripStore.prepare`): a display
 * draws more frames than ticks (120 Hz: every other frame has no tick), so the step between drawn
 * frames would halve it. The speed changes only when the tick does; a frame without a tick keeps it.
 */
export class TickSpeed {
  private lastX = NaN;
  private lastTick = NaN;
  private v = 0;

  /** The speed at camera x on tick `tick` (0 on the first call; after `reset`). */
  step(camX: number, tick: number): number {
    if (Number.isNaN(this.lastX) || tick < this.lastTick) {
      this.lastX = camX;
      this.lastTick = tick;
      this.v = 0;
    } else if (tick !== this.lastTick) {
      this.v = (camX - this.lastX) / (tick - this.lastTick);
      this.lastX = camX;
      this.lastTick = tick;
    }
    return this.v;
  }

  reset(): void {
    this.lastX = NaN;
    this.lastTick = NaN;
    this.v = 0;
  }
}
