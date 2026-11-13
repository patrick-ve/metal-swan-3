/**
 * DE RATTENJONG's throws (docs/design/sewers.md §4.2, phase 1 and between the phase-2 waves;
 * template: oldenzaal's `StatueStone` / `StatueBit`). Team 'enemy'; every hit carries the `boss`
 * tag. Bloodless: scrap, dust, sparks.
 *
 * - `sewers-rattenjong-bike` — lifted over his head (tell 30) and thrown in a high arc to the hero's
 *   x. Shootable (24 HP, 50 points): shot down, it bursts into two HARMLESS bits of scrap (shooting
 *   it is the counter, so nothing that falls from it may hurt the shooter: the fairness lesson of
 *   oldenzaal's stone). Where it lands it breaks into 2 bouncing parts (`…-bike-part`, 2 bounces).
 * - `sewers-rattenjong-cart` — shoved off the pile (tell 24): it drops to the floor and rolls along
 *   it at 2.5 px/tick out of the arena (jump it, or stand on a trash ledge: it is 14 px high).
 * - `sewers-rattenjong-scooter` — a flat throw (tell 24) that bounces twice on the floor, then
 *   breaks.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { debris, dust } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum } from '../../../registry';
import { SEWERS_E_IDS } from '../../missions/sewers/ids';
import { KING, THROW_ART } from './numbers';

export const KING_TAGS: readonly string[] = ['boss'];

const drawOpts: DrawOpts = {};

/** The floor (the walk line or a ledge) under x between y0 and y1, else Infinity. */
function floorAt(world: World, x: number, y0: number, y1: number): number {
  return world.terrain.surfaceY(x, y0, y1);
}

function base(o: Partial<ProjectileOpts> & Pick<ProjectileOpts, 'x' | 'y' | 'vx' | 'vy'>): ProjectileOpts {
  return {
    team: 'enemy',
    damage: KING.damage,
    kind: 'impact',
    tags: KING_TAGS,
    hitsTerrain: false,
    look: 'anim',
    offscreen: 64,
    life: 600,
    impact: 'none',
    ...o,
  };
}

// ---------------------------------------------------------------------------------------------
// The bike and its parts
// ---------------------------------------------------------------------------------------------

export class KingBike extends Projectile {
  landY = Infinity;

  /** Throw a bike from (x, y) in a high arc so it lands on the floor `landY` at about `tx`. */
  static lob(world: World, x: number, y: number, tx: number, landY: number, shooter: Entity | null): KingBike {
    const B = KING.bike;
    const k = difficultyOf(world).enemyBulletSpeed;
    const vy = B.vy * Math.sqrt(k);
    const g = B.gravity * k;
    const dy = landY - y;
    const t = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * dy))) / g;
    const vx = Math.max(-3, Math.min(3, (tx - x) / Math.max(1, t)));
    const b = KingBike.spawn(world, base({ x, y, vx, vy, gravity: g, w: B.w, h: B.h, life: 400, offscreen: 160, shootable: true, hp: B.hp, score: 50, sprite: `${THROW_ART}/bike`, ticksPerFrame: 5, shooter, type: SEWERS_E_IDS.bike }));
    b.landY = landY;
    return b;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.landY = Infinity;
  }

  override update(): void {
    this.move();
    if (this.vy > 0 && this.y + KING.bike.h / 2 >= this.landY) {
      this.y = this.landY - KING.bike.h / 2;
      this.breakUp(true);
      return;
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** It hit a hero: it falls apart there. */
  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.x = x;
    this.y = y;
    this.breakUp(false);
  }

  /** Shot down in the air (or out of life): two harmless bits of scrap and sparks of metal. */
  override expire(): void {
    if (this.removed) return;
    const w = this.world;
    for (let i = 0; i < KING.bike.parts; i++) KingScrap.toss(w, this.x, this.y, i === 0 ? -1.2 : 1.2, -1.6, i);
    debris(w, this.x, this.y, 'metal', 6);
    w.audio.sfx('sewers/throw-bike', { vol: 0.5, pitch: 1.4 });
    this.dead = true;
    this.remove();
  }

  /** Where it lands (or at a hero): two parts bounce away both ways. */
  breakUp(onFloor: boolean): void {
    if (this.removed) return;
    const w = this.world;
    const B = KING.bike;
    const floor = Number.isFinite(this.landY) ? this.landY : this.y + 40;
    for (let i = 0; i < B.parts; i++) KingBikePart.toss(w, this.x, this.y, (i % 2 === 0 ? -1 : 1) * B.partVx, onFloor ? B.partVy : B.partVy * 0.4, floor, this.shooter, i);
    debris(w, this.x, this.y, 'metal', 5);
    dust(w, this.x, floor, 3);
    w.audio.sfx('sewers/throw-bike', { pitch: 0.8 });
    if (onFloor) w.camera.shake(2, 8);
    this.dead = true;
    this.remove();
  }
}

export class KingBikePart extends Projectile {
  floorY = Infinity;
  bounces = 0;
  look2 = 0;

  static toss(world: World, x: number, y: number, vx: number, vy: number, floorY: number, shooter: Entity | null, i = 0): KingBikePart {
    const B = KING.bike;
    const p = KingBikePart.spawn(world, base({ x, y, vx, vy, gravity: B.partGravity, w: 8, h: 7, life: 160, offscreen: 32, sprite: `${THROW_ART}/bike-part`, ticksPerFrame: 4, shooter, type: SEWERS_E_IDS.bikePart }));
    p.floorY = floorY;
    p.bounces = B.partBounces;
    p.look2 = i % 3;
    return p;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.floorY = Infinity;
    this.bounces = 0;
    this.look2 = 0;
  }

  override update(): void {
    this.move();
    if (this.vy > 0 && this.y + 3 >= this.floorY) {
      this.y = this.floorY - 3;
      if (this.bounces-- > 0) {
        this.vy = -Math.abs(this.vy) * 0.5;
        this.vx *= 0.8;
      } else return this.expire();
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override expire(): void {
    dust(this.world, this.x, this.y + 2, 1);
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.vx < 0;
    drawOpts.blend = 'normal';
    r.sprite(this.sprite, (this.look2 + Math.floor(this.t / 6)) % 3, this.x, this.y, drawOpts);
  }
}

/** A harmless bit of a shot-down bike (cosmetic: no team, no damage; falls, bounces once, fades). */
export class KingScrap extends Entity {
  private t = 0;
  private bounced = false;
  private look2 = 0;

  static toss(world: World, x: number, y: number, vx: number, vy: number, i: number): KingScrap {
    const s = world.add(new KingScrap(world, x, y));
    s.vx = vx;
    s.vy = vy;
    s.look2 = i % 2;
    return s;
  }

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.z = 52;
    this.despawnMargin = 48;
  }

  override update(): void {
    this.vy += 0.2;
    this.x += this.vx;
    this.y += this.vy;
    const f = floorAt(this.world, this.x, this.y - 6, this.y + 6);
    if (this.vy > 0 && Number.isFinite(f) && this.y >= f - 2) {
      this.y = f - 2;
      if (this.bounced) {
        dust(this.world, this.x, f, 1);
        this.remove();
        return;
      }
      this.bounced = true;
      this.vy = -1.2;
      this.vx *= 0.5;
    }
    if (++this.t > 120) this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.vx < 0;
    drawOpts.blend = 'normal';
    r.sprite(`${THROW_ART}/scrap`, this.look2, this.x, this.y, drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The cart
// ---------------------------------------------------------------------------------------------

export class KingCart extends Projectile {
  dir = -1;
  rolling = false;

  /** Shove a cart off the pile at (x, y) toward `dir`: it drops to the floor and rolls. */
  static shove(world: World, x: number, y: number, dir: number, shooter: Entity | null): KingCart {
    const C = KING.cart;
    const s = C.speed * difficultyOf(world).enemyBulletSpeed;
    const c = KingCart.spawn(world, base({ x, y, vx: dir * s, vy: -0.8, gravity: C.gravity, w: C.w, h: C.h, life: 900, offscreen: 40, pierce: Infinity, sprite: `${THROW_ART}/cart`, ticksPerFrame: 4, shooter, type: SEWERS_E_IDS.cart }));
    c.dir = dir < 0 ? -1 : 1;
    return c;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.dir = -1;
    this.rolling = false;
  }

  override update(): void {
    const C = KING.cart;
    if (!this.rolling) {
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      // Only the walk line stops it (it rolls under the ledges, never onto them).
      if (this.vy > 0 && this.y + C.h / 2 >= KING_FLOOR) {
        this.y = KING_FLOOR - C.h / 2;
        this.vy = 0;
        this.rolling = true;
        dust(this.world, this.x, KING_FLOOR, 3);
        this.world.audio.sfx('sewers/cart-roll');
      }
    } else {
      this.x += this.vx;
      if (this.t % 10 === 0) dust(this.world, this.x - this.dir * 8, KING_FLOOR, 1);
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override expire(): void {
    debris(this.world, this.x, this.y, 'metal', 4);
    this.remove();
  }
}

/** The walk line of sewers-e (terrain.ts G); the cart and the scooter bounce on it. */
const KING_FLOOR = 176;

// ---------------------------------------------------------------------------------------------
// The scooter
// ---------------------------------------------------------------------------------------------

export class KingScooter extends Projectile {
  bounces = 0;

  /** A flat throw from (x, y) toward `dir`: it bounces twice on the floor, then breaks. */
  static fling(world: World, x: number, y: number, dir: number, shooter: Entity | null): KingScooter {
    const S = KING.scooter;
    const k = difficultyOf(world).enemyBulletSpeed;
    const s = KingScooter.spawn(world, base({ x, y, vx: dir * S.vx * k, vy: S.vy, gravity: S.gravity * k, w: S.w, h: S.h, life: 500, offscreen: 40, sprite: `${THROW_ART}/scooter`, ticksPerFrame: 4, shooter, type: SEWERS_E_IDS.scooter }));
    s.bounces = S.bounces;
    return s;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.bounces = 0;
  }

  override update(): void {
    const S = KING.scooter;
    this.move();
    if (this.vy > 0 && this.y + S.h / 2 >= KING_FLOOR) {
      this.y = KING_FLOOR - S.h / 2;
      if (this.bounces-- > 0) {
        this.vy = -Math.abs(this.vy) * S.keep;
        dust(this.world, this.x, KING_FLOOR, 2);
        this.world.audio.sfx('sewers/throw-scooter', { vol: 0.5, pitch: 1.3 });
      } else return this.expire();
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** It hit a hero: it breaks there. */
  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.x = x;
    this.y = y;
    this.expire();
  }

  override expire(): void {
    if (this.removed) return;
    debris(this.world, this.x, this.y, 'metal', 5);
    dust(this.world, this.x, this.y + 4, 2);
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Registry (tests and tools can fire them on their own; x, y = the floor point)
// ---------------------------------------------------------------------------------------------

defineEntity(SEWERS_E_IDS.bike, (w, x, y, p) => KingBike.lob(w, x, y - 60, x + paramFacing(p, -1) * paramNum(p, 'dist', 120), y, null), {
  category: 'projectile',
  description: 'DE RATTENJONG: a bike thrown in a high arc; shootable (24 HP, 50 points: two harmless scraps); breaks into 2 bouncing parts where it lands.',
});
defineEntity(SEWERS_E_IDS.bikePart, (w, x, y, p) => KingBikePart.toss(w, x, y - 10, paramFacing(p, -1) * KING.bike.partVx, KING.bike.partVy, y, null), {
  category: 'projectile',
  description: 'DE RATTENJONG: a part of a landed bike; bounces twice along the floor, then stops.',
});
defineEntity(SEWERS_E_IDS.cart, (w, x, y, p) => KingCart.shove(w, x, y - 30, paramFacing(p, -1), null), {
  category: 'projectile',
  description: 'DE RATTENJONG: a shopping cart shoved off the pile; rolls along the floor at 2.5 px/tick (jump it, or stand on a ledge).',
});
defineEntity(SEWERS_E_IDS.scooter, (w, x, y, p) => KingScooter.fling(w, x, y - 50, paramFacing(p, -1), null), {
  category: 'projectile',
  description: 'DE RATTENJONG: a scooter thrown flat; bounces twice on the floor, then breaks.',
});
