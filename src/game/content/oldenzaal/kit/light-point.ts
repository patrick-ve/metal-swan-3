/**
 * `oz-light-point` (ids.ts `OZ_LIGHT.point`): an invisible point light a section script or a
 * builder can place (docs/api/oldenzaal.md §3). Owner: LIGHT.
 *
 * Params: `r` (radius px, default 40), `color` (a Color number, default PAL_HD_OZ.candle[5]),
 * `flicker` (0..1, default 0), `intensity` (0..1, default 1), `dy` (light centre above the anchor,
 * default 0), `follow` (an entity to stick to, set by code: `pt.follow = e`). It has the tag
 * `oz-light` and `lightOf`, no body, no hitbox, never despawns; `remove()` it to put it out.
 * Purely cosmetic: it never draws, never touches the rngs and does nothing in a section without a
 * light pass.
 */
import type { Color } from '../../../../engine/color';
import { Entity } from '../../../../engine/entity';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { World } from '../../../../engine/world';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { LIGHT_TAG, type LightSource, type LightSpot } from './light-api';

export const OZ_LIGHT_POINT = 'oz-light-point';

export class OzLightPoint extends Entity implements LightSource {
  r: number;
  color: Color;
  flicker: number;
  intensity: number;
  dy: number;
  /** Stick to this entity (its anchor + dy) while it lives; null = stay put. */
  follow: Entity | null = null;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.r = paramNum(p, 'r', 40);
    this.color = (paramNum(p, 'color', PAL_HD_OZ.candle[5]) >>> 0) as Color;
    this.flicker = paramNum(p, 'flicker', 0);
    this.intensity = paramNum(p, 'intensity', 1);
    this.dy = paramNum(p, 'dy', 0);
    this.team = 'neutral';
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    this.despawnMargin = Infinity;
    this.z = 10;
    this.addTag(LIGHT_TAG);
  }

  override update(): void {
    const f = this.follow;
    if (f) {
      if (f.removed) this.follow = null;
      else {
        this.x = f.x;
        this.y = f.y;
      }
    }
  }

  lightOf(out: LightSpot, _tick: number): boolean {
    if (this.r <= 0 || this.intensity <= 0) return false;
    out.x = this.x;
    out.y = this.y - this.dy;
    out.r = this.r;
    out.color = this.color;
    out.intensity = this.intensity;
    out.flicker = this.flicker;
    return true;
  }
}

defineEntity(OZ_LIGHT_POINT, (w, x, y, p) => new OzLightPoint(w, x, y, p), {
  category: 'fx',
  description: 'oldenzaal: an invisible point light for the light pass (r, color, flicker, intensity, dy).',
});
