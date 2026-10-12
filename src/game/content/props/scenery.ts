/**
 * Scenery props (GDD §9.5): `card-table` (decor for the soldiers' `cards` gag) and `air-jet`
 * (a column of warm air that slows falls). Sprites: `prop/<id>/…` (scenery.art.ts).
 */
import { Entity } from '../../../engine/entity';
import type { Rect } from '../../../engine/math';
import { PAL } from '../../../engine/palette';
import type { ParticlePreset } from '../../../engine/particles';
import { displace } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { Enemy } from '../../enemy';
import { FxEntity, type FxOpts } from '../../fx';
import { NO_PARAMS, paramNum, type SpawnParams } from '../../registry';
import { isFootPlayer } from './common';

const drawOpts: DrawOpts = {};
const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
const fxOpts: FxOpts = { sprite: '', x: 0, y: 0 };

// ---------------------------------------------------------------------------------------------
// card-table
// ---------------------------------------------------------------------------------------------

export const CARD_TABLE = {
  /** Soldiers this close (px, horizontally) play at the table. */
  reach: 40,
  /** Cards thrown up when the game ends. */
  cards: 7,
} as const;

/**
 * A folding card table (20×12) with a game in progress: decor for a pair of soldiers in the
 * `cards` gag (they stand at x ± 12). When one of the players at the table notices a player or
 * dies, the cards fly up and the table is left bare. Not shootable, no body. y = the floor.
 */
export class CardTable extends Entity {
  /** The cards flew (the game is over). */
  scattered = false;

  constructor(world: World, x: number, y: number, _params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.hitbox = { x: -10, y: -12, w: 20, h: 12 };
    this.z = 28;
    this.despawnMargin = 200;
    this.addTag('prop', 'decor');
  }

  override update(): void {
    if (this.scattered) return;
    const list = this.world.byTag('enemy');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (Math.abs(e.x - this.x) > CARD_TABLE.reach || Math.abs(e.y - this.y) > 24) continue;
      if (!e.alive || (e instanceof Enemy && (e.alerted || e.reacting))) {
        this.scatter();
        return;
      }
    }
  }

  /** The cards fly up (cosmetic randomness only). */
  scatter(): void {
    if (this.scattered) return;
    this.scattered = true;
    const rng = this.world.fxRng;
    const o = fxOpts;
    for (let i = 0; i < CARD_TABLE.cards; i++) {
      o.sprite = 'prop/card-table/card';
      o.x = this.x + rng.range(-7, 7);
      o.y = this.y - 13;
      o.vx = rng.range(-1.4, 1.4);
      o.vy = rng.range(-3.4, -2.2);
      o.gravity = 0.12;
      o.drag = 0.98;
      o.loop = true;
      o.life = rng.int(44, 64);
      o.z = 61;
      o.flipX = rng.chance(0.5);
      FxEntity.spawn(this.world, o);
    }
    o.flipX = false;
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    r.sprite('prop/card-table/idle', this.scattered ? 1 : 0, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// air-jet
// ---------------------------------------------------------------------------------------------

export const AIR_JET = {
  w: 24,
  h: 96,
  /** px/tick of upward push on an airborne player inside the column. */
  push: 1.5,
} as const;

/**
 * Warm air blowing up out of a brass pipe: a column 24 px wide and `h` px tall above the pipe
 * mouth (the spawn point: x = the column's centre, y = its bottom). Every airborne player whose
 * body centre is inside the column is pushed up 1.5 px each tick, so falls slow from 4 to 2.5
 * px/tick and jumps inside it go higher; a player standing on a floor in the column is not
 * lifted. Params: `h`, `w`, `push`.
 */
export class AirJet extends Entity {
  readonly w: number;
  readonly h: number;
  readonly push: number;
  readonly column: Rect;
  /** Streak particles: they live long enough to rise through the whole column. */
  private readonly streak: ParticlePreset;
  private loopKey: string;
  private looping = false;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.w = Math.max(8, Math.round(paramNum(params, 'w', AIR_JET.w)));
    this.h = Math.max(8, Math.round(paramNum(params, 'h', AIR_JET.h)));
    this.push = paramNum(params, 'push', AIR_JET.push);
    this.column = { x: x - this.w / 2, y: y - this.h, w: this.w, h: this.h };
    this.hitbox = { x: -this.w / 2, y: -this.h, w: this.w, h: this.h + 10 };
    this.z = 14;
    this.despawnMargin = 200;
    this.addTag('prop');
    const life = Math.max(8, Math.round(this.h / 2.4));
    this.streak = {
      kind: 'rect',
      w: 1,
      h: 4,
      life: [Math.round(life * 0.7), life],
      drag: 1,
      colors: [PAL.snow[3], PAL.snow[2], PAL.gold[3]],
      alpha: 0.7,
      fadeFrom: 0.6,
    };
    this.loopKey = `air-jet-${this.id}`;
  }

  /** Is (the body centre of) this entity inside the column? */
  inside(e: Entity): boolean {
    const c = this.column;
    const b = e.hitRect(scratch);
    const cx = b.x + b.w / 2;
    return cx >= c.x && cx < c.x + c.w && b.y < c.y + c.h && b.y + b.h > c.y;
  }

  override update(): void {
    const list = this.world.players;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isFootPlayer(p) || p.body.onGround || !this.inside(p)) continue;
      displace(p, 0, -this.push, this.world.terrain, this.world);
    }
    const near = this.onScreen(24);
    if (near && this.world.tick % 3 === 0) {
      const rng = this.world.fxRng;
      this.world.particles.emit(this.streak, this.x + rng.range(-this.w / 2 + 2, this.w / 2 - 2), this.y - 6, 0, -rng.range(2.1, 2.7));
    }
    // A soft hiss while it is in view.
    if (near !== this.looping) {
      this.looping = near;
      if (near) this.world.audio.sfxLoop?.(this.loopKey, 'env/wind', { vol: 0.25 });
      else this.world.audio.stopSfx?.(this.loopKey);
    }
  }

  override onRemove(): void {
    if (this.looping) this.world.audio.stopSfx?.(this.loopKey);
    this.looping = false;
  }

  override draw(r: Renderer): void {
    // Faint rising streaks (deterministic, cosmetic) behind the particles.
    const c = this.column;
    const t = this.world.tick;
    for (let i = 0; i < 5; i++) {
      const sx = Math.round(c.x + 3 + ((i * 7 + (i & 1) * 3) % (c.w - 5)));
      const sy = Math.round(c.y + c.h - 10 - ((t * 2 + i * 41) % Math.max(1, c.h - 10)));
      r.rect(sx, sy, 1, 9, PAL.snow[2], { alpha: 0.28 });
    }
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    r.sprite('prop/air-jet/pipe', (t >> 2) % 2, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}
