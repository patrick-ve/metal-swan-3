/**
 * `wreck-block` (GDD §10.5 stage 3, §15.4 prop): a 24×32 chunk of the broken organ console,
 * indestructible, solid on all sides (players stand on it, shots stop on it). The MAESTRO's
 * BRAVISSIMO! scream cannot pass it: crouch close behind an outer block.
 *
 * Spawn: `world.spawn('wreck-block', x, floorY, { drop?: true })` — x = the block's centre, y =
 * the floor it stands on. With `drop` it falls in from above the view (a shadow marks the spot;
 * it becomes solid only when it lands, and nudges a player standing there aside — never a crush).
 */
import { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { drawShadow, debris, dust } from '../../../fx';
import { defineEntity, paramBool, type SpawnParams } from '../../../registry';
import { SCREAM_BLOCK_TAG } from './common';

export const WRECK_BLOCK = { w: 24, h: 32 } as const;

const opts: DrawOpts = {};

export class WreckBlock extends Entity {
  /** The solid's rect once it stands (null while it falls). */
  solidRect: Rect | null = null;
  private box: SolidBox | null = null;
  private readonly floorY: number;
  private falling: boolean;
  private seed: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.floorY = y;
    this.team = 'neutral';
    this.z = 25;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -WRECK_BLOCK.w / 2, y: -WRECK_BLOCK.h, w: WRECK_BLOCK.w, h: WRECK_BLOCK.h };
    this.falling = paramBool(p, 'drop', false);
    this.seed = Math.round(x) % 3;
    this.addTag(SCREAM_BLOCK_TAG, 'cover', 'prop');
    if (this.falling) this.y = Math.min(y, world.camera.top - 8);
    else this.land();
  }

  get landed(): boolean {
    return !this.falling;
  }

  override update(): void {
    if (!this.falling) return;
    this.vy = Math.min(this.vy + 0.35, 8);
    this.y += this.vy;
    if (this.y >= this.floorY) {
      this.y = this.floorY;
      this.falling = false;
      this.land();
      this.world.camera.shake(4, 14);
      this.world.audio.sfx('machine/piano-crash', { vol: 0.6 });
      dust(this.world, this.x - 10, this.y, 4);
      dust(this.world, this.x + 10, this.y, 4);
      debris(this.world, this.x, this.y - 16, 'wood', 6);
    }
  }

  private land(): void {
    const x0 = Math.round(this.x - WRECK_BLOCK.w / 2);
    const y0 = Math.round(this.floorY - WRECK_BLOCK.h);
    // A player standing on the spot is nudged aside (the block never crushes).
    for (const p of this.world.players) {
      if (!p.alive) continue;
      const half = (p.hitbox.w || 14) / 2;
      if (p.x + half > x0 && p.x - half < x0 + WRECK_BLOCK.w && p.y > y0) {
        p.x = p.x < this.x ? x0 - half - 1 : x0 + WRECK_BLOCK.w + half + 1;
      }
    }
    this.box = this.world.addSolid(new SolidBox(x0, y0, WRECK_BLOCK.w, WRECK_BLOCK.h, false, this));
    this.solidRect = { x: x0, y: y0, w: WRECK_BLOCK.w, h: WRECK_BLOCK.h };
  }

  override onRemove(): void {
    if (this.box) this.world.removeSolid(this.box);
    this.box = null;
  }

  override draw(r: Renderer): void {
    if (this.falling) drawShadow(r, this.x, this.floorY, 26, 0.45);
    opts.flipX = this.seed === 1;
    r.sprite('prop/wreck-block/idle', this.seed, Math.round(this.x), Math.round(this.y), opts);
  }
}

defineEntity('wreck-block', (w, x, y, p) => new WreckBlock(w, x, y, p), {
  category: 'prop',
  description: 'Final-boss cover: an indestructible 24×32 console chunk (solid). Param `drop` = falls in.',
});
