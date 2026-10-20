/**
 * `ring-gantry` — a matrix-sign gantry across the ring (docs/design/ring.md §7.1): one sign over
 * each lane with amber corner flashers. The faces: the white diagonal arrow (leave this lane; the
 * first gantry of a closure), the red X (the lane is closed: the closure follows), the red-ringed
 * 50 / 80 / 100 (a 50 warns of a jam), the white end-of-restrictions circle, or blank.
 *
 * Drawn oblique across the road (geometry.ts): the far post stands on the median behind lane 1 (a
 * `RingLayer` child drawn first), the beam, the signs and the near post beyond the hard shoulder are
 * drawn in front of every lane (their heights keep them clear of every vehicle under them). The signs
 * switch on with a click as the gantry comes into view. It is scenery for the rules: it neither
 * blocks nor hurts.
 *
 * Params: `signs` (four face codes, lane 1 … 4), or `closed` (lane numbers; an array, a number or
 * '3,4') with `stage`
 * ('warn' = arrows toward the nearest open lane, 'close' = red X; default 'close') and `limit`
 * (50 | 80 | 100 | 'end' | '' for the open lanes; default 100); `jam: true` = 50 everywhere.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { defineEntity, NO_PARAMS, type SpawnParams } from '../../../registry';
import { RING_ENTITY } from '../../../ring/ids';
import { LANE_COUNT } from '../../../ring/lanes';
import { RingLayer, type Layered } from '../traffic/road-kit';
import { FAR_P, FAR_POST_DX, flashes, NEAR_P, signAt, signFrame, SIGN_H, SIGN_W } from './geometry';

/** Ticks per flasher phase (the pairs alternate). */
export const FLASH_TICKS = 18;

const drawOpts: DrawOpts = {};

/** A limit param → its face code. */
function limitFace(v: unknown): string {
  if (v === 'end' || v === '') return v;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return '100';
  if (n <= 60) return '50';
  if (n <= 90) return '80';
  return '100';
}

/** A list param: an array, a number, or a comma-separated string ('3,4'). */
function listParam(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'number') return [v];
  if (typeof v === 'string' && v !== '') return v.split(',').map((t) => t.trim());
  return [];
}

/** The four faces (lane 1 … 4) of a gantry's params (see the header). */
export function gantryFaces(p: SpawnParams, open = LANE_COUNT): string[] {
  const signs = listParam(p.signs);
  if (signs.length) return [0, 1, 2, 3].map((i) => String(signs[i] ?? ''));
  if (p.jam === true) return ['50', '50', '50', '50'];
  const closed = listParam(p.closed).map((v) => Number(v)).filter((v) => v >= 1 && v <= LANE_COUNT);
  const limit = limitFace(p.limit);
  const warn = p.stage === 'warn';
  const faces: string[] = [];
  for (let lane = 1; lane <= LANE_COUNT; lane++) {
    if (lane > open) faces.push('');
    else if (!closed.includes(lane)) faces.push(limit);
    else if (!warn) faces.push('x');
    else {
      // The arrow points to the nearest open lane (the far side first on a tie).
      let best = 0;
      for (let d = 1; d < LANE_COUNT && !best; d++) {
        if (lane - d >= 1 && !closed.includes(lane - d)) best = lane - d;
        else if (lane + d <= open && !closed.includes(lane + d)) best = lane + d;
      }
      faces.push(best === 0 ? 'x' : best < lane ? 'arrow-far' : 'arrow-near');
    }
  }
  return faces;
}

export class RingGantry extends Entity implements Layered {
  faces: string[];
  /** The signs are lit (they switch on as the gantry comes into view). */
  lit = false;
  private t = 0;
  private layer: RingLayer | null = null;

  constructor(world: World, x: number, _y: number, p: SpawnParams = NO_PARAMS) {
    // Drawn in front of every lane: its plane y is the near post's.
    super(world, x, NEAR_P);
    this.faces = gantryFaces(p);
    this.team = 'neutral';
    this.z = 12;
    this.hitbox = { x: -40, y: -176, w: 80, h: 178 };
    this.despawnMargin = 64;
    this.addTag(RING_ENTITY.gantry);
  }

  /** Change the faces (a click; the flashers start with a face that warns). */
  setFaces(faces: readonly string[]): void {
    let changed = false;
    for (let i = 0; i < LANE_COUNT; i++) {
      const f = faces[i] ?? '';
      if (this.faces[i] !== f) changed = true;
      this.faces[i] = f;
    }
    if (changed && this.lit) this.world.audio.sfx('ring/matrix-click');
  }

  override update(): void {
    this.t++;
    if (!this.layer) {
      this.layer = new RingLayer(this.world, this, 0, FAR_P, 5);
      this.world.add(this.layer);
    }
    if (!this.lit && this.x - this.world.camera.right < 40) {
      this.lit = true;
      if (this.faces.some((f) => f !== '')) this.world.audio.sfx('ring/matrix-click');
    }
  }

  /** Layer 0: the far post on the median (behind lane 1). */
  drawLayer(r: Renderer, k: number): void {
    if (k !== 0) return;
    drawOpts.flipX = false;
    r.sprite('ring/hazard/gantry-post', 0, Math.round(this.x) + FAR_POST_DX, FAR_P, drawOpts);
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    drawOpts.flipX = false;
    r.sprite('ring/hazard/gantry-truss', 0, x, NEAR_P, drawOpts);
    const phase = Math.floor(this.t / FLASH_TICKS) % 2;
    for (let lane = 1; lane <= LANE_COUNT; lane++) {
      const face = this.lit ? this.faces[lane - 1] : '';
      const [dx, sy] = signAt(lane);
      const sx = x + Math.round(dx);
      r.sprite('ring/hazard/sign', signFrame(face), sx, Math.round(sy), drawOpts);
      if (!flashes(face)) continue;
      const hx = SIGN_W / 2 - 1;
      const hy = SIGN_H / 2 - 1;
      // Two pairs of amber flashers at the corners, alternating.
      r.sprite('ring/hazard/flasher', phase, sx - hx, Math.round(sy) - hy, drawOpts);
      r.sprite('ring/hazard/flasher', phase, sx + hx, Math.round(sy) - hy, drawOpts);
      r.sprite('ring/hazard/flasher', 1 - phase, sx - hx, Math.round(sy) + hy, drawOpts);
      r.sprite('ring/hazard/flasher', 1 - phase, sx + hx, Math.round(sy) + hy, drawOpts);
    }
  }
}

defineEntity(RING_ENTITY.gantry, (w, x, y, p) => new RingGantry(w, x, y, p), {
  category: 'prop',
  description: 'A matrix-sign gantry across the ring (params signs, or closed + stage + limit, or jam).',
});
