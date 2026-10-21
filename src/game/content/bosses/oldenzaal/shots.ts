/**
 * St. Plechelmus's projectiles (docs/design/oldenzaal.md §5.2). Team 'enemy'; every hit carries the
 * `boss` tag; the floor waves add `shockwave`. Bloodless and churchly: stone, dust, a cold green
 * glint of the curse.
 *
 * - `oz-plechelmus-stone` — a block torn off the plinth and lobbed in a high arc (phase 1). It
 *   shatters where it lands (or in the air when it is shot down: 24 HP, shootable, 50 points)
 *   into `oz-plechelmus-bit`s.
 * - `oz-plechelmus-bit` — a small stone that bounces along the pavers (2 bounces), then crumbles.
 * - `oz-plechelmus-wave` — a crest of dust and shards that runs along the floor (jump it): the
 *   ground slam's shockwave (phase 2, both ways) or, with `low`, the crozier sweep's low wave
 *   (phase 1, toward the players). With `slam` it is the short impact box of the blow itself.
 */
import type { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { debris, dust, poof } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramBool, paramFacing, paramNum } from '../../../registry';
import { OZ_STATUE } from '../../missions/oldenzaal/ids';
import { ART } from './art';
import { STATUE } from './geometry';

export const BOSS_TAGS: readonly string[] = ['boss'];
export const WAVE_TAGS: readonly string[] = ['boss', 'shockwave'];

const drawOpts: DrawOpts = {};

/** The walkable floor at x between y0 and y1, else Infinity. */
export function floorAt(world: World, x: number, y0: number, y1: number): number {
  return world.terrain.surfaceY(x, y0, y1);
}

function base(o: Partial<ProjectileOpts> & Pick<ProjectileOpts, 'x' | 'y' | 'vx' | 'vy'>): ProjectileOpts {
  return {
    team: 'enemy',
    damage: STATUE.damage,
    kind: 'impact',
    tags: BOSS_TAGS,
    hitsTerrain: false,
    look: 'anim',
    offscreen: 64,
    life: 600,
    impact: 'none',
    ...o,
  };
}

// ---------------------------------------------------------------------------------------------
// The floor wave (the slam's shockwave, the sweep's low wave, the blow's impact)
// ---------------------------------------------------------------------------------------------

export class StatueWave extends Projectile {
  groundY = 0;
  halfH = 6;
  low = false;

  /** A wave whose bottom sits on `groundY`, running in `dir` (speed × the difficulty). */
  static run(world: World, x: number, groundY: number, dir: number, shooter: Entity | null, low = false): StatueWave {
    const S = low ? STATUE.sweep : STATUE.slam;
    const s = S.waveSpeed * difficultyOf(world).enemyBulletSpeed;
    const w = StatueWave.spawn(
      world,
      base({ x, y: groundY - S.waveH / 2, vx: dir * s, vy: 0, tags: WAVE_TAGS, w: S.waveW, h: S.waveH, pierce: Infinity, offscreen: 24, sprite: `${ART}/${low ? 'sweep' : 'wave'}`, ticksPerFrame: 3, shooter, type: OZ_STATUE.shockwave }),
    );
    w.groundY = groundY;
    w.halfH = S.waveH / 2;
    w.low = low;
    return w;
  }

  /** The blow's own impact: a w × h box on the floor for `ticks` (does not move, not drawn). */
  static slam(world: World, x: number, groundY: number, w: number, h: number, ticks: number, shooter: Entity | null): StatueWave {
    const s = StatueWave.spawn(world, base({ x, y: groundY - h / 2, vx: 0, vy: 0, tags: WAVE_TAGS, w, h, pierce: Infinity, life: ticks, offscreen: 64, sprite: '', shooter, type: OZ_STATUE.shockwave }));
    s.groundY = groundY;
    s.halfH = h / 2;
    s.low = false;
    return s;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.halfH = (o.h ?? 12) / 2;
    this.groundY = o.y + this.halfH;
    this.low = false;
  }

  override update(): void {
    if (this.vx !== 0) {
      this.x += this.vx;
      this.facing = this.vx < 0 ? -1 : 1;
      // Hug the floor; over a gap it keeps its height.
      const f = floorAt(this.world, this.x, this.groundY - 10, this.groundY + 10);
      if (Number.isFinite(f)) this.groundY = f;
      this.y = this.groundY - this.halfH;
      if (this.t % 6 === 0) dust(this.world, this.x, this.groundY, 1);
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override draw(r: Renderer): void {
    if (!this.sprite) return;
    // The strip is drawn moving LEFT; flipped when the wave runs right.
    drawOpts.flipX = this.vx > 0;
    drawOpts.blend = 'normal';
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), this.x, this.groundY, drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The thrown stone and its bits
// ---------------------------------------------------------------------------------------------

export class StatueStone extends Projectile {
  landY = Infinity;
  spin = 0;

  /**
   * Lob a plinth block from (x, y) so it lands on the floor `landY` at about `tx` (the target's
   * x): the flight time follows from the launch speed, x speed from the distance.
   */
  static lob(world: World, x: number, y: number, tx: number, landY: number, shooter: Entity | null): StatueStone {
    const T = STATUE.throw;
    const k = difficultyOf(world).enemyBulletSpeed;
    const vy = T.vy * Math.sqrt(k);
    const g = T.gravity * k;
    // Time to fall back to landY: y + vy t + g t²/2 = landY.
    const dy = landY - y;
    const t = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * dy))) / g;
    const vx = Math.max(-3.2, Math.min(3.2, (tx - x) / Math.max(1, t)));
    const s = StatueStone.spawn(world, base({ x, y, vx, vy, gravity: g, w: 10, h: 9, life: 400, offscreen: 140, shootable: true, hp: T.hp, score: 50, sprite: `${ART}/stone`, ticksPerFrame: 4, shooter, type: OZ_STATUE.stone }));
    s.landY = landY;
    s.spin = vx < 0 ? -1 : 1;
    return s;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.landY = Infinity;
    this.spin = 1;
  }

  override update(): void {
    this.move();
    if (this.vy > 0 && this.y + 4 >= this.landY) {
      this.y = this.landY - 4;
      this.shatter(true);
      return;
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** It hit a hero: it bursts there (the bits fall and bounce). */
  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.x = x;
    this.y = y;
    this.shatter(false);
  }

  /**
   * Shot down in the air (or out of life): it crumbles into harmless rubble and dust. Shooting
   * the stone is the counter, so nothing that falls from it may hurt the shooter below (the
   * fairness check of wave B: these bits caused most of the phase-1 deaths).
   */
  override expire(): void {
    if (this.removed) return;
    const w = this.world;
    debris(w, this.x, this.y, 'rock', 10);
    dust(w, this.x, this.y, 4);
    w.audio.sfx('oz/statue/shatter');
    this.dead = true;
    this.remove();
  }

  /** Break into bits where it lands or hits a hero (on the floor: they bounce away both ways; at a hero: they fall apart). */
  shatter(onFloor: boolean): void {
    if (this.removed) return;
    const w = this.world;
    const T = STATUE.throw;
    const n = T.bits + difficultyOf(w).extraVolley;
    const floor = Number.isFinite(this.landY) ? this.landY : this.y + 40;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sp = T.bitVx[0] + ((T.bitVx[1] - T.bitVx[0]) * i) / Math.max(1, n - 1);
      StatueBit.toss(w, this.x, this.y, side * sp, onFloor ? T.bitVy : T.bitVy * 0.4, floor, this.shooter, i);
    }
    debris(w, this.x, this.y, 'rock', 6);
    dust(w, this.x, onFloor ? floor : this.y, 3);
    w.audio.sfx('oz/statue/shatter');
    if (onFloor) w.camera.shake(2, 8);
    this.dead = true;
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.spin < 0;
    drawOpts.blend = 'normal';
    drawOpts.flash = this.flashTicks > 0;
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), this.x, this.y, drawOpts);
    drawOpts.flash = false;
  }
}

export class StatueBit extends Projectile {
  floorY = Infinity;
  bounces = 0;
  look2 = 0;

  static toss(world: World, x: number, y: number, vx: number, vy: number, floorY: number, shooter: Entity | null, i = 0): StatueBit {
    const T = STATUE.throw;
    const b = StatueBit.spawn(world, base({ x, y, vx, vy, gravity: T.bitGravity, w: 6, h: 5, life: 150, offscreen: 32, sprite: `${ART}/bit`, ticksPerFrame: 4, shooter, type: OZ_STATUE.stoneBit }));
    b.floorY = floorY;
    b.bounces = T.bitBounces;
    b.look2 = i % 3;
    return b;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.floorY = Infinity;
    this.bounces = 0;
    this.look2 = 0;
  }

  override update(): void {
    this.move();
    if (this.vy > 0 && this.y + 2.5 >= this.floorY) {
      this.y = this.floorY - 2.5;
      if (this.bounces-- > 0) {
        this.vy = -Math.abs(this.vy) * 0.5;
        this.vx *= 0.8;
        if (this.world.tick % 2 === 0) this.world.audio.sfx('oz/statue/bit', { vol: 0.5 });
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
    drawOpts.flipX = false;
    drawOpts.blend = 'normal';
    r.sprite(this.sprite, (this.look2 + Math.floor(this.t / 4)) % 3, this.x, this.y, drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Registry (the arena tool and tests can fire them on their own; x, y = the floor point)
// ---------------------------------------------------------------------------------------------

defineEntity(
  OZ_STATUE.shockwave,
  (w, x, y, p) => {
    if (paramBool(p, 'slam', false)) return StatueWave.slam(w, x, y, STATUE.slam.hitW, STATUE.slam.hitH, STATUE.slam.hitTicks, null);
    return StatueWave.run(w, x, y, paramFacing(p, -1), null, paramBool(p, 'low', false));
  },
  { category: 'projectile', description: 'St. Plechelmus: a crest of dust running along the floor (jump it); `low`: the crozier sweep\'s low wave; `slam`: the blow\'s short impact box.' },
);
defineEntity(OZ_STATUE.stone, (w, x, y, p) => StatueStone.lob(w, x, y - 60, x + paramFacing(p, -1) * paramNum(p, 'dist', 120), y, null), {
  category: 'projectile',
  description: 'St. Plechelmus: a plinth block lobbed in an arc; shatters into bouncing bits where it lands (24 HP, shootable, 50 points).',
});
defineEntity(OZ_STATUE.stoneBit, (w, x, y, p) => StatueBit.toss(w, x, y - 10, paramFacing(p, -1) * 1.6, -2.6, y, null), {
  category: 'projectile',
  description: 'St. Plechelmus: a small stone of the shattered block; bounces twice along the floor, then crumbles.',
});

/** A puff of stone dust where a shot chips the dormant statue (no damage). */
export function chip(world: World, x: number, y: number): void {
  poof(world, x, y);
  debris(world, x, y, 'rock', 2);
}
