/**
 * Mission oldenzaal — `oz-ghost-shot`: the gunner's spectral shot (docs/design/oldenzaal.md §3.2).
 * Owner: POSSESSED.
 *
 * Slow and visible: a glowing green orb with a wispy trail. Two flights:
 * - 'ground': it drops from the ghost rifle's muzzle to knee height (`GUNNER.shotY` over the
 *   shooter's floor) in its first 16 ticks, then glides along the street at `GUNNER.shotSpeed`
 *   (jump it);
 * - 'arc': a low lob (`arcVy`, `arcGravity`) that bursts in mist where it lands.
 * It can be shot down (`shotHp`, `shotScore` points), and it gives a little light (`LIGHT_TAG`).
 */
import type { Entity } from '../../../../engine/entity';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { GUNNER } from './numbers';
import { mistAt } from './mist';

const glowOpts: DrawOpts = { blend: 'add', alpha: 0.45 };

export class GhostShot extends Projectile implements LightSource {
  /** 'ground': drop to knee height, then glide; 'arc': a low lob. */
  flight: 'ground' | 'arc' = 'ground';
  private y0 = 0;
  private yGround = 0;

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.y0 = this.y;
    this.addTag(LIGHT_TAG);
  }

  /** Set the flight after init (the floor y of the shooter for the ground flight). */
  setFlight(flight: 'ground' | 'arc', floorY: number): void {
    this.flight = flight;
    this.yGround = floorY - GUNNER.shotY;
  }

  protected override move(): void {
    if (this.flight === 'arc') {
      super.move();
      return;
    }
    this.x += this.vx;
    const k = Math.min(1, this.t / 16);
    const e = k * k * (3 - 2 * k);
    this.y = this.y0 + (this.yGround - this.y0) * e;
    if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
  }

  lightOf(out: LightSpot): boolean {
    out.x = this.x;
    out.y = this.y;
    out.r = 18;
    out.color = PAL_HD_OZ.ghost[5];
    out.intensity = 0.6;
    out.flicker = 0.2;
    return true;
  }

  override draw(r: Renderer): void {
    r.sprite('fx/oz/soul/glow', 0, this.x, this.y, glowOpts);
    super.draw(r);
  }
}

const shotOpts: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: GUNNER.shotDamage };

function burst(p: Projectile, _target: Entity | null, x: number, y: number): void {
  mistAt(p.world, x, y, 0.7);
}

/**
 * Fire one ghost shot from (x, y) along `dir` (1 / −1); `floorY` = the shooter's feet; `arc`
 * picks the lob. Speed scaled by the difficulty's enemy bullet speed.
 */
export function fireGhostShot(world: World, x: number, y: number, dir: number, floorY: number, arc: boolean, shooter: Entity | null): GhostShot {
  const o = shotOpts;
  const mods = (shooter as { mods?: { enemyBulletSpeed: number } } | null)?.mods;
  const sp = GUNNER.shotSpeed * (mods?.enemyBulletSpeed ?? 1);
  o.x = x;
  o.y = y;
  o.vx = dir * sp * (arc ? 1.1 : 1);
  o.vy = arc ? GUNNER.arcVy : 0;
  o.gravity = arc ? GUNNER.arcGravity : 0;
  o.damage = GUNNER.shotDamage;
  o.kind = 'bullet';
  o.w = GUNNER.shotW;
  o.h = GUNNER.shotH;
  o.life = GUNNER.shotLife;
  o.sprite = 'enemy/oz-ghost-shot/fly';
  o.look = 'anim';
  o.ticksPerFrame = 5;
  o.offscreen = 32;
  o.type = 'oz-ghost-shot';
  o.shootable = true;
  o.hp = GUNNER.shotHp;
  o.score = GUNNER.shotScore;
  o.impact = burst;
  o.hitsTerrain = true;
  o.shooter = shooter;
  const p = GhostShot.spawn(world, o);
  o.shooter = null;
  p.setFlight(arc ? 'arc' : 'ground', floorY);
  return p;
}
