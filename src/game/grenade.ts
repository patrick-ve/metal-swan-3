/**
 * Thrown explosives that bounce: the player's grenade, bounce mines, enemy grenades, mortar
 * shells (mechanics.md §6, §22.4; GDD §5, §6.1).
 *
 * A Grenade moves itself and bounces off terrain (floors, walls, one-way platforms from above,
 * dynamic solids) with the engine `sweep`. It explodes on the n-th floor contact (`contacts`,
 * default 2 = after one bounce), when the fuse runs out, or when it touches a hostile shootable
 * (the World's shot pass applies the direct-hit damage first). Sprites: look 'anim' (a spinning
 * strip, centre anchor).
 * ```ts
 * Grenade.spawn(world, { team: 'enemy', x, y, vx: -1.5, vy: -3, damage: 30, sprite: 'enemy/grenade',
 *   gravity: 0.15, blastDamage: 30, blastSize: 'm' });
 * ```
 * Subclasses change the bounce rules through `onFloor(hit)` (return true when it exploded) and
 * `onWall(hit)` (the bounce mine hops onto steps). A player grenade that lands next to Legion
 * infantry makes them `panic` (GDD §4.11 rule 6: 36 px, 40 ticks).
 */
import type { Entity } from '../engine/entity';
import { sweep } from '../engine/physics';
import { makeRayHit, type RayHit } from '../engine/terrain';
import type { Circle, World } from '../engine/world';
import { reactInArea } from './enemy';
import { explosion, type ExplosionSize } from './fx';
import { Projectile, type ProjectileOpts } from './projectile';
import { TUNING } from './tuning';

export interface GrenadeOpts extends ProjectileOpts {
  /** Vertical restitution on floor contacts (default TUNING.grenade.bounce). */
  bounce?: number;
  /** Explode on this floor contact (default 2: one bounce first). */
  contacts?: number;
  /** Ticks until it explodes anyway (default TUNING.grenade.fuse). */
  fuse?: number;
  blastSize?: ExplosionSize;
  /** Splash damage of the explosion (default TUNING.grenade.splash). */
  blastDamage?: number;
  blastRadius?: number;
  /** Damage lost toward the blast edge (0..1; default 0.5 like `explosion`). */
  blastFalloff?: number;
  /** Splash hurts soft targets only. */
  softOnly?: boolean;
  /** Fastest fall (default 6). */
  maxFall?: number;
  /** Sound of a bounce (default 'weapon/grenade-bounce'; '' = silent). */
  bounceSfx?: string;
  /**
   * The enemy hit directly also takes the blast (rockets, mines: "30 hit + 40 blast"). Default
   * false: a grenade's direct hit replaces its splash for that target (GDD §6.1).
   */
  blastHitsTarget?: boolean;
}

/** GDD §4.11 rule 6: infantry within 36 px of a landed player grenade panic for 40 ticks. */
export const GRENADE_PANIC = { radius: 36, ticks: 40 } as const;

const hit = makeRayHit();
const panicCircle: Circle = { x: 0, y: 0, r: GRENADE_PANIC.radius };
const LEGION: readonly string[] = ['legion'];

export class Grenade extends Projectile {
  bounce = 0.65;
  contactsLeft = 2;
  blastSize: ExplosionSize = 'm';
  blastDamage = 20;
  blastRadius: number | undefined = undefined;
  blastFalloff: number | undefined = undefined;
  softOnly = false;
  maxFall = 6;
  bounceSfx = 'weapon/grenade-bounce';
  blastHitsTarget = false;
  private exploded = false;
  /** The enemy hit directly (excluded from the splash, it already took the direct damage). */
  private directTarget: Entity | null = null;

  constructor(world: World) {
    super(world);
  }

  override init(o: GrenadeOpts): void {
    super.init({
      look: 'anim',
      ticksPerFrame: 3,
      offscreen: 96,
      ...o,
      life: o.fuse ?? o.life ?? TUNING.grenade.fuse,
      hitsTerrain: false,
      impact: 'none',
      type: o.type ?? 'grenade',
    });
    this.bounce = o.bounce ?? TUNING.grenade.bounce;
    this.contactsLeft = Math.max(1, o.contacts ?? TUNING.grenade.contacts);
    this.blastSize = o.blastSize ?? 'm';
    this.blastDamage = o.blastDamage ?? TUNING.grenade.splash;
    this.blastRadius = o.blastRadius;
    this.blastFalloff = o.blastFalloff;
    this.softOnly = o.softOnly ?? false;
    this.maxFall = o.maxFall ?? 6;
    this.bounceSfx = o.bounceSfx ?? 'weapon/grenade-bounce';
    this.blastHitsTarget = o.blastHitsTarget ?? false;
    this.exploded = false;
    this.directTarget = null;
  }

  override update(): void {
    this.vy = Math.min(this.vy + this.gravity, this.maxFall);
    const x1 = this.x + this.vx;
    const y1 = this.y + this.vy;
    const h = sweep(this.world.terrain, this.x, this.y, x1, y1, true, this.world, hit);
    if (!h) {
      this.x = x1;
      this.y = y1;
    } else {
      // Stop just outside the surface, then react to what was hit.
      this.x = h.x + h.nx * 0.5;
      this.y = h.y + h.ny * 0.5;
      if (h.ny < -0.3) {
        if (this.onFloor(h)) return;
      } else if (Math.abs(h.nx) > 0.5) {
        this.onWall(h);
      } else {
        this.vy = Math.abs(this.vy) * 0.3;
      }
    }
    if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
    if (++this.t >= this.life) {
      this.expire();
      return;
    }
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /**
   * A floor contact: explode on the last one, else bounce (vy × −bounce, vx kept). Returns true
   * when it exploded. Player grenades make the infantry around the landing spot panic.
   */
  protected onFloor(_h: RayHit): boolean {
    if (this.team === 'player') {
      panicCircle.x = this.x;
      panicCircle.y = this.y;
      reactInArea(this.world, panicCircle, 'panic', GRENADE_PANIC.ticks, { tags: LEGION, source: this });
    }
    if (--this.contactsLeft <= 0) {
      this.explode();
      return true;
    }
    this.vy = -Math.abs(this.vy) * this.bounce;
    if (this.bounceSfx) this.world.audio.sfx(this.bounceSfx);
    return false;
  }

  /** A wall: bounce back with half the speed. */
  protected onWall(_h: RayHit): void {
    this.vx = -this.vx * 0.5;
  }

  /**
   * Touched a hostile shootable: the shot pass already dealt the direct damage. It explodes ON
   * the target (the blast is centred on the hit hurtbox), so soldiers standing next to it are
   * inside the blast too.
   */
  override onImpact(target: Entity | null, x: number, y: number): void {
    this.directTarget = target;
    this.x = x;
    this.y = y;
    if (target) {
      const boxes = target.hurtboxes();
      let best = Infinity;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const cx = b.x + b.w / 2;
        if (b.w > 0 && Math.abs(cx - x) < best) {
          best = Math.abs(cx - x);
          this.x = cx;
        }
      }
    }
    this.explode();
  }

  override expire(): void {
    this.explode();
  }

  /** Has it gone off already? */
  get hasExploded(): boolean {
    return this.exploded;
  }

  explode(): void {
    if (this.exploded) return;
    this.exploded = true;
    explosion(this.world, this.x, this.y, this.blastSize, {
      damage: this.blastDamage,
      radius: this.blastRadius,
      falloff: this.blastFalloff,
      team: this.team,
      owner: this.damage.owner,
      softOnly: this.softOnly,
      exclude: this.blastHitsTarget ? null : this.directTarget,
      weapon: this.damage.weapon,
    });
    this.directTarget = null;
    this.remove();
  }
}
