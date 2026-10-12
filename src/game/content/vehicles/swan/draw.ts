/**
 * Draw a ridden SWAN-3 outside the game world (the title lake scene, menus): body strip, rider
 * (`ride-<pose>` at the body frame's `seat` point), the `-front` overlay, then the neck at the
 * `neck` point — the layer order of look.md §7 (GDD §15.9 item 5).
 * ```ts
 * drawRiddenSwan(r, 192, 196, { rider: 'char/grace', anim: 'swim', neck: 'swim-neck-relax', screen: true });
 * ```
 */
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { framePoint, getFrame, hasSprite } from '../../../../engine/sprites';
import type { RidePose } from '../../../player/player';
import { stripFrame } from '../../../player/player';
import { HULL_DY, REST } from './constants';

export interface RiddenSwanOpts {
  /** Rider art prefix ('char/grace'); null = no rider. Default 'char/grace'. */
  rider?: string | null;
  /** Body strip (default 'swim') and its frame (default: from `tick`). */
  anim?: string;
  frame?: number;
  /** Neck strip (default 'swim-neck-relax'; '' = none) and its frame (default 0). */
  neck?: string;
  neckFrame?: number;
  pose?: RidePose;
  /** The Mute's colours (P2). */
  mute?: boolean;
  flipX?: boolean;
  /** Screen space (ignore the camera). */
  screen?: boolean;
  /** Animation clock (ticks) for the default frames. */
  tick?: number;
}

const opts: DrawOpts = {};
const pt: [number, number] = [0, 0];

/** A named point of a body frame (mirrored), else the rest point moved by the strip's hull offset. */
function point(id: string, anim: string, frame: number, name: 'seat' | 'neck', flip: boolean): [number, number] {
  const p = hasSprite(id) ? framePoint(getFrame(id, frame), name, flip, false, pt) : undefined;
  if (p) return p;
  const dy = HULL_DY[anim]?.[frame % Math.max(1, HULL_DY[anim]?.length ?? 1)] ?? 0;
  pt[0] = flip ? -REST[name][0] : REST[name][0];
  pt[1] = REST[name][1] + dy;
  return pt;
}

export function drawRiddenSwan(r: Renderer, x: number, y: number, o: RiddenSwanOpts = {}): void {
  const color = o.mute ? 'vehicle/swan-mute' : 'vehicle/swan';
  const anim = o.anim ?? 'swim';
  const body = hasSprite(`${color}/${anim}`) ? `${color}/${anim}` : `vehicle/swan/${anim}`;
  const tick = o.tick ?? 0;
  const frame = o.frame ?? (hasSprite(body) ? stripFrame(body, tick) : 0);
  const flip = o.flipX ?? false;
  const bx = Math.round(x);
  const by = Math.round(y);
  opts.flipX = flip;
  opts.screen = o.screen ?? false;
  r.sprite(body, frame, bx, by, opts);
  const rider = o.rider === undefined ? 'char/grace' : o.rider;
  if (rider) {
    const s = point(body, anim, frame, 'seat', flip);
    let id = `${rider}/ride-${o.pose ?? 'sit'}`;
    if (!hasSprite(id)) id = `${rider}/ride-sit`;
    const sx = bx + s[0];
    const sy = by + s[1];
    if (hasSprite(id)) r.sprite(id, stripFrame(id, tick), sx, sy, opts);
    else r.sprite(`${rider}/mount`, 1, sx, sy + 17, opts);
  }
  const front = `${color}/${anim}-front`;
  if (hasSprite(front)) r.sprite(front, frame, bx, by, opts);
  const neck = o.neck ?? 'swim-neck-relax';
  if (neck) {
    const n = point(body, anim, frame, 'neck', flip);
    const nid = hasSprite(`${color}/${neck}`) ? `${color}/${neck}` : `vehicle/swan/${neck}`;
    r.sprite(nid, o.neckFrame ?? 0, bx + n[0], by + n[1], opts);
  }
  opts.screen = false;
}
