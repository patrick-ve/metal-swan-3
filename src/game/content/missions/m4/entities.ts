/**
 * Mission-local entities of m4 (GDD §11.0 "Mission-local entities"). Prefixed `m4-` so the other
 * missions' own `hatch` / `sign` can never replace them in the global registry.
 *
 * | id | what | params |
 * |---|---|---|
 * | `m4-hatch` | the subway hatch lid over the m4-b stairs: a dynamic solid (top-left at x, y) that blocks everything until `open()` | `w` (40) |
 * | `m4-sign` | a route sign that drops into place (GDD §11.0 "a sign with an arrow appears over each exit") | `frame` (`SIGN` in art.ts) |
 */
import { Entity } from '../../../../engine/entity';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';

const drawOpts: DrawOpts = {};

export class M4Hatch extends Entity {
  readonly w: number;
  private box: SolidBox | null;
  /** Ticks since it opened (−1 = closed). */
  openT = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.w = Math.max(16, paramNum(p, 'w', 40));
    this.z = 12;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: this.w, h: 8 };
    this.addTag('prop');
    this.box = world.addSolid(new SolidBox(x, y, this.w, 8, false, this));
  }

  get isOpen(): boolean {
    return this.openT >= 0;
  }

  /** Slide the lid aside: the gap under it is open from this tick on. */
  open(): void {
    if (this.openT >= 0) return;
    this.openT = 0;
    if (this.box) this.world.removeSolid(this.box);
    this.box = null;
    this.world.audio.sfx('machine/brake');
  }

  override update(): void {
    if (this.openT >= 0) this.openT++;
  }

  override draw(r: Renderer): void {
    const f = this.openT < 0 ? 0 : this.openT < 8 ? 1 : 2;
    drawOpts.flipX = false;
    r.sprite('decor/m4/hatch', f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

export class M4Sign extends Entity {
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
    // Drops into place in ~16 ticks with a small bounce.
    if (this.y < this.restY) {
      this.vy = Math.min(4, this.vy + 0.4);
      this.y += this.vy;
      if (this.y >= this.restY) {
        this.y = this.restY;
        this.vy = this.vy > 2 ? -1.2 : 0;
        if (this.vy === 0) this.world.audio.sfx('hit/metal');
      }
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    r.sprite('decor/m4/sign', this.frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

defineEntity('m4-hatch', (w, x, y, p) => new M4Hatch(w, x, y, p), { category: 'prop', description: 'm4-b subway hatch (dynamic solid; open()).' });
defineEntity('m4-sign', (w, x, y, p) => new M4Sign(w, x, y, p), { category: 'prop', description: 'm4 route sign dropping into place (param frame).' });
