/**
 * The Swan's nervous egg (GDD §8.2 Empty gag, look.md §10.10): a riveted ivory capsule that lands
 * behind her tail, wobbles, cracks and pops open into a `pickup-bombs`. Sprite
 * `vehicle/swan/egg` (4 frames: 6, 10, 10, 20 ticks; feet anchor); the pickup appears on frame 3
 * and the egg is removed 20 ticks later.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { FX_TRAIL } from '../../../fx';
import { TUNING } from '../../../tuning';

const DURATIONS: readonly number[] = [6, 10, 10, 20];
/** Tick of frame 3 (the lid pops): 6 + 10 + 10. */
const POP_AT = 26;
const LIFE = 46;
const drawOpts: DrawOpts = {};

export class SwanEgg extends Entity {
  t = 0;

  constructor(world: World, x: number, y: number, facing: 1 | -1) {
    super(world, x, y);
    this.type = 'swan-egg';
    this.facing = facing;
    this.z = 36;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -4, y: -10, w: 8, h: 10 };
  }

  override update(): void {
    this.t++;
    if (this.t === POP_AT) {
      const e = this.world.spawn('pickup-bombs', this.x, this.y - 4, { dropped: true });
      e.vy = TUNING.pickup.popVy;
      this.world.particles.burst(FX_TRAIL, this.x, this.y - 8, 4, 0.2, 0.8, -Math.PI / 2, 1.2);
      this.world.audio.sfx('item/pickup', { vol: 0.5 });
    }
    if (this.t >= LIFE) this.remove();
  }

  override draw(r: Renderer): void {
    let f = 0;
    let acc = 0;
    for (let i = 0; i < DURATIONS.length; i++) {
      acc += DURATIONS[i];
      if (this.t < acc) {
        f = i;
        break;
      }
      f = i;
    }
    drawOpts.flipX = this.facing < 0;
    r.sprite('vehicle/swan/egg', f, this.x, this.y, drawOpts);
  }
}
