/**
 * Mission-local entities of m3 (GDD §11.0 "Mission-local entities", §11.3). Prefixed `m3-` so no
 * other mission's sign can replace them in the registry.
 *
 * | id | what | params |
 * |---|---|---|
 * | `m3-sign` | a route sign (feet at x, y) that drops into place | `frame` (SIGN in art.ts) |
 * | `m3-cargo-chute` | the Swan's cargo parachute (GDD m3-a start): it holds the falling entity it carries to a slow fall (`fall` px/tick) and is drawn over it; it folds away when the load lands | `fall` (0.9); set `load` with `attach()` |
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import './art';

const drawOpts: DrawOpts = {};

// ------------------------------------------------------------------------------------ sign

export class M3Sign extends Entity {
  readonly frame: number;
  private readonly restY: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.frame = Math.max(0, Math.round(paramNum(p, 'frame', 0)));
    this.restY = y;
    this.y = y - 40;
    this.z = 12;
    this.despawnMargin = Infinity;
    this.addTag('prop');
  }

  override update(): void {
    if (this.y < this.restY || this.vy < 0) {
      this.vy = Math.min(4, this.vy + 0.4);
      this.y += this.vy;
      if (this.y >= this.restY) {
        this.y = this.restY;
        this.vy = this.vy > 2 ? -1.2 : 0;
        if (this.vy === 0) this.world.audio.sfx('hit/metal', { vol: 0.5 });
      }
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.alpha = 1;
    r.sprite('decor/m3/sign', this.frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ------------------------------------------------------------------------------------ cargo chute

/** Height of the harness point over the load's feet (the Swan's back). */
const HARNESS = 40;

export class M3CargoChute extends Entity {
  private load: Entity | null = null;
  private readonly fall: number;
  /** Ticks since the load landed (−1 = still in the air). */
  private foldT = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.fall = paramNum(p, 'fall', 0.9);
    this.z = 40;
    this.despawnMargin = Infinity;
    this.addTag('prop');
  }

  /** Carry this entity (its body falls at most `fall` px/tick until it lands). */
  attach(load: Entity): this {
    this.load = load;
    this.x = load.x;
    this.y = load.y - HARNESS;
    return this;
  }

  /** Has the load touched down? */
  get landed(): boolean {
    return this.foldT >= 0;
  }

  override update(): void {
    const l = this.load;
    if (this.foldT >= 0) {
      // The canopy settles down behind the load and fades.
      this.foldT++;
      this.y += 0.6;
      this.x -= 0.4;
      if (this.foldT > 50) this.remove();
      return;
    }
    if (!l || !l.alive || l.removed) {
      this.foldT = 0;
      return;
    }
    if (l.vy > this.fall) l.vy = this.fall;
    this.x = l.x;
    this.y = l.y - HARNESS;
    if (l.body?.onGround && this.world.tick > 2) {
      this.foldT = 0;
      this.world.audio.sfx('player/land', { vol: 0.6 });
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.alpha = this.foldT < 0 ? 1 : Math.max(0, 1 - this.foldT / 50);
    r.sprite('decor/m3/cargo-chute', 0, Math.round(this.x), Math.round(this.y), drawOpts);
    drawOpts.alpha = 1;
  }
}

defineEntity('m3-sign', (w, x, y, p) => new M3Sign(w, x, y, p), { category: 'prop', description: 'm3 route sign dropping into place (param frame).' });
defineEntity('m3-cargo-chute', (w, x, y, p) => new M3CargoChute(w, x, y, p), {
  category: 'prop',
  description: 'm3-a cargo parachute: slows a falling load (attach()) and folds when it lands.',
});
