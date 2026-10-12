/**
 * The opera staging of THE GRAND GRAND (GDD §10.4): the stage curtain (drawn between the piano and
 * the players: z 35) and the stalls — a row of audience silhouettes along the bottom of the view
 * (foreground, z 90) that gasp and clap. Both are owned by the boss (removed with it).
 */
import { Entity } from '../../../../engine/entity';
import { INK, PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { AUDIENCE_W, CURTAIN_H, CURTAIN_W } from './art-piano';

const ART = 'boss/grand-grand';
const opts: DrawOpts = {};

/** The stage curtain over [x0, x0 + width]: `down` 0 (up) … 1 (down to `hemY`). */
export class StageCurtain extends Entity {
  x0: number;
  width: number;
  /** World y of the hem when fully down. */
  hemY: number;
  down = 1;
  target = 1;
  /** Fraction per tick. */
  speed = 1 / 30;
  /** Stage hands dragging the broken lid off to the right (world x; NaN = none). */
  dragX = Number.NaN;
  dragSprite = '';
  dragFrame = 0;
  dragFlip = false;

  constructor(world: World, x0: number, width: number, hemY: number) {
    super(world, x0 + width / 2, 0);
    this.x0 = x0;
    this.width = width;
    this.hemY = hemY;
    this.team = 'neutral';
    this.z = 35;
    this.despawnMargin = Infinity;
    this.type = 'stage-curtain';
    this.hitbox = { x: -width / 2, y: 0, w: width, h: hemY };
  }

  /** Move the curtain toward `target` over `ticks`. */
  moveTo(target: number, ticks: number): void {
    this.target = target;
    this.speed = Math.abs(target - this.down) / Math.max(1, ticks);
  }

  get settled(): boolean {
    return this.down === this.target;
  }

  override update(): void {
    if (this.down < this.target) this.down = Math.min(this.target, this.down + this.speed);
    else if (this.down > this.target) this.down = Math.max(this.target, this.down - this.speed);
  }

  override draw(r: Renderer): void {
    const x0 = Math.round(this.x0);
    if (!Number.isNaN(this.dragX) && this.dragSprite) {
      // Stage hands' legs under the hem, dragging the broken lid away.
      const gy = Math.round(this.hemY + 10);
      // The lid lies on the floor: its lip shows under the hem as it slides away.
      opts.flipX = this.dragFlip;
      r.sprite(this.dragSprite, this.dragFrame, Math.round(this.dragX), gy + 100, opts);
      opts.flipX = false;
      const f = (this.world.tick >> 3) & 1;
      r.sprite(`${ART}/stagehand`, f, Math.round(this.dragX) + 70, gy, opts);
      r.sprite(`${ART}/stagehand`, 1 - f, Math.round(this.dragX) + 86, gy, opts);
    }
    // The pelmet (always there): a crimson valance with a gold fringe.
    const hem = Math.round(this.hemY * this.down);
    if (hem > 0) {
      const top = hem - CURTAIN_H;
      opts.flipX = false;
      opts.flash = false;
      for (let x = x0, i = 0; x < x0 + this.width; x += CURTAIN_W, i++) {
        // A gentle sway at the hem while it moves.
        const sway = this.down !== this.target ? (((this.world.tick >> 3) + i) & 1) : 0;
        r.sprite(`${ART}/curtain`, 0, x, top + sway, opts);
      }
      // The two halves meet in the middle with a dark seam.
      r.rect(x0 + Math.round(this.width / 2) - 1, Math.max(0, top), 2, hem - Math.max(0, top) - 9, PAL.red[0]);
    }
    for (let x = x0; x < x0 + this.width; x += 16) {
      r.rect(x, 0, 16, 7, PAL.red[1]);
      r.rect(x + 2, 7, 12, 2, PAL.red[1]);
      r.rect(x, 0, 16, 1, PAL.red[2]);
      r.rect(x + 1, 8, 14, 1, PAL.gold[2]);
      r.rect(x + 7, 9, 2, 2, PAL.gold[3]);
    }
    r.rect(x0, 6, this.width, 1, PAL.gold[1]);
  }
}

export type AudienceMood = 'still' | 'gasp' | 'clap';

/** The stalls: silhouettes along the bottom of the view that react to the show. */
export class Audience extends Entity {
  x0: number;
  width: number;
  bottom: number;
  mood: AudienceMood = 'still';
  private moodT = 0;

  constructor(world: World, x0: number, width: number, bottom: number) {
    super(world, x0 + width / 2, bottom);
    this.x0 = x0;
    this.width = width;
    this.bottom = bottom;
    this.team = 'neutral';
    this.z = 90;
    this.despawnMargin = Infinity;
    this.type = 'opera-audience';
    this.hitbox = { x: -width / 2, y: -26, w: width, h: 26 };
  }

  react(mood: AudienceMood, ticks: number): void {
    this.mood = mood;
    this.moodT = ticks;
  }

  override update(): void {
    if (this.moodT > 0 && --this.moodT === 0) this.mood = 'still';
  }

  override draw(r: Renderer): void {
    const tick = this.world.tick;
    const frame = this.mood === 'gasp' ? 1 : this.mood === 'clap' ? ((tick >> 3) & 1 ? 2 : 0) : 0;
    opts.flash = false;
    for (let x = Math.round(this.x0) - 8, i = 0; x < this.x0 + this.width; x += AUDIENCE_W, i++) {
      opts.flipX = false;
      const bob = this.mood === 'clap' && ((tick >> 2) + i) % 3 === 0 ? 1 : 0;
      r.sprite(`${ART}/audience`, frame, x, Math.round(this.bottom) + bob, opts);
    }
    // The front rail of the stalls.
    r.rect(Math.round(this.x0), Math.round(this.bottom) - 1, this.width, 1, INK);
  }
}
