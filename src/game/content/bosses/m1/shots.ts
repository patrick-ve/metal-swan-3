/**
 * THE ENCORE's projectiles (GDD §10.1, §15.4). Every hit carries the `boss` tag (a player vehicle
 * loses 1 cell, docs/api/game.md §6); the river waves add `shockwave`. All move toward the
 * players (right → left in the m1 arena) and keep their own floor logic (they ignore terrain so
 * a one-way pontoon over deep water works like a floor).
 *
 * - `steam-note` — lobbed from a calliope pipe onto a spot of the stage in a fixed flight time;
 *   on landing it leaves a `steam-puff` (24×16, lethal for 20 ticks).
 * - `foghorn-wave` — a sonic band 16 px tall at a fixed height, 3 px/tick (low: jump, high: crouch).
 * - `paddle-wave` — a 24-px water wave hugging the stage, 2 px/tick (jump it).
 * - `barrel` — tossed from the stern, rolls 1.2 px/tick; 16 px, contact kills, 20 HP, knifeable,
 *   50 points shot down; sinks in the river.
 * - `soot-ball` — arcs out of a funnel (gravity 0.12) and bursts on landing (r 10).
 * - `brass-pellet` — from Blare's trombone: swoops down to its lane (chest or ankle), then
 *   flies flat at 4 px/tick.
 */
import type { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { debris, dust, explosion, poof, smokeTrail, splash, steamPuff } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum, paramStr } from '../../../registry';

export const BOSS_TAGS: readonly string[] = ['boss'];
export const WAVE_TAGS: readonly string[] = ['boss', 'shockwave'];
export const SONIC_TAGS: readonly string[] = ['boss', 'sonic'];

const ART = 'boss/encore';
const drawOpts: DrawOpts = {};

/** The walkable floor at x between y0 and y1 (ground, one-way platforms, solid tops), else Infinity. */
export function floorAt(world: World, x: number, y0: number, y1: number): number {
  return world.terrain.surfaceY(x, y0, y1);
}

/** The water surface under x (a 'water' hazard top), else Infinity. */
export function waterAt(world: World, x: number): number {
  const hz = world.terrain.hazards;
  let best = Infinity;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    if (h.kind === 'water' && x >= h.x && x < h.x + h.w && h.y < best) best = h.y;
  }
  return best;
}

/** Shared look: the strips are drawn moving LEFT, so a shot flies flipped when vx > 0. */
class EncoreShot extends Projectile {
  override draw(r: Renderer): void {
    if (!this.sprite) return;
    drawOpts.flipX = this.vx > 0;
    drawOpts.blend = this.blend;
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

function base(o: Partial<ProjectileOpts> & Pick<ProjectileOpts, 'x' | 'y' | 'vx' | 'vy'>): ProjectileOpts {
  return {
    team: 'enemy',
    damage: 10,
    kind: 'bullet',
    tags: BOSS_TAGS,
    hitsTerrain: false,
    look: 'anim',
    offscreen: 64,
    life: 600,
    ...o,
  };
}

// ---------------------------------------------------------------------------------------------
// Steam Scale: notes and the puffs they leave
// ---------------------------------------------------------------------------------------------

export class SteamPuff extends EncoreShot {
  static at(world: World, x: number, floorY: number, shooter: Entity | null): SteamPuff {
    return SteamPuff.spawn(world, base({ x, y: floorY - 8, vx: 0, vy: 0, kind: 'fire', w: 24, h: 16, pierce: Infinity, life: 20, sprite: `${ART}/steam-puff`, ticksPerFrame: 7, shooter, type: 'steam-puff', impact: 'none' }));
  }

  override expire(): void {
    // The scald is over; a harmless wisp drifts off.
    steamPuff(this.world, this.x, this.y - 4, 0, -0.4);
    this.remove();
  }
}

export class SteamNote extends EncoreShot {
  landY = 0;

  /** Lob from (x, y) to land on (tx, landY) after `flight` ticks. */
  static lob(world: World, x: number, y: number, tx: number, landY: number, flight: number, shooter: Entity | null): SteamNote {
    const g = 0.16;
    const vx = (tx - x) / flight;
    const vy = (landY - y - (g * flight * flight) / 2) / flight;
    const n = SteamNote.spawn(world, base({ x, y, vx, vy, gravity: g, kind: 'fire', w: 8, h: 8, life: flight + 60, offscreen: 120, sprite: `${ART}/steam-note`, ticksPerFrame: 6, shooter, type: 'steam-note' }));
    n.landY = landY;
    return n;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.landY = Infinity;
  }

  /** Hit someone on the way down: it still bursts into its puff on the floor below. */
  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    if (Number.isFinite(this.landY)) SteamPuff.at(this.world, x, this.landY, this.shooter);
  }

  override update(): void {
    this.move();
    if (this.vy > 0 && this.y >= this.landY) {
      SteamPuff.at(this.world, this.x, this.landY, this.shooter);
      this.world.audio.sfx('env/water-splash', { vol: 0.3 });
      this.remove();
      return;
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Foghorn wave and Paddle wave
// ---------------------------------------------------------------------------------------------

export class FoghornWave extends EncoreShot {
  /** A band whose bottom edge is `bottom` (16 px tall), moving at `speed` px/tick in `dir`. */
  static blast(world: World, x: number, bottom: number, dir: number, speed: number, shooter: Entity | null): FoghornWave {
    const s = speed * difficultyOf(world).enemyBulletSpeed;
    return FoghornWave.spawn(world, base({ x, y: bottom - 8, vx: dir * s, vy: 0, kind: 'impact', tags: SONIC_TAGS, w: 10, h: 16, pierce: Infinity, offscreen: 32, sprite: `${ART}/foghorn-wave`, ticksPerFrame: 3, shooter, type: 'foghorn-wave', impact: 'none' }));
  }
}

export class PaddleWave extends EncoreShot {
  groundY = 0;

  static roll(world: World, x: number, groundY: number, dir: number, speed: number, shooter: Entity | null): PaddleWave {
    const s = speed * difficultyOf(world).enemyBulletSpeed;
    const w = PaddleWave.spawn(world, base({ x, y: groundY - 12, vx: dir * s, vy: 0, kind: 'impact', tags: WAVE_TAGS, w: 18, h: 24, pierce: Infinity, offscreen: 40, sprite: `${ART}/paddle-wave`, ticksPerFrame: 4, shooter, type: 'paddle-wave', impact: 'none' }));
    w.groundY = groundY;
    return w;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.groundY = o.y + 12;
  }

  override update(): void {
    this.x += this.vx;
    // Hug the stage (a pontoon, a slope); over open water it keeps its height.
    const f = floorAt(this.world, this.x, this.groundY - 10, this.groundY + 10);
    if (Number.isFinite(f)) this.groundY = f;
    this.y = this.groundY - 12;
    if (this.t % 6 === 0) splash(this.world, this.x + 6, this.groundY - 20, 2);
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------------------------

export class Barrel extends EncoreShot {
  rolling = false;
  dir = -1;
  rollSpeed = 1.2;
  waterY = Infinity;

  /** Tossed from (x, y) with (vx, vy); rolls in `dir` once it lands. */
  static toss(world: World, x: number, y: number, vx: number, vy: number, dir: number, shooter: Entity | null): Barrel {
    const b = Barrel.spawn(world, base({ x, y, vx, vy, gravity: 0.18, kind: 'impact', w: 14, h: 16, pierce: Infinity, shootable: true, hp: 20, soft: true, score: 50, offscreen: 48, life: 1500, sprite: `${ART}/barrel`, ticksPerFrame: 5, shooter, type: 'barrel', impact: 'none' }));
    b.dir = dir;
    b.waterY = waterAt(world, x);
    return b;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.rolling = false;
    this.dir = -1;
    this.rollSpeed = 1.2;
    this.waterY = Infinity;
  }

  override update(): void {
    const w = this.world;
    if (this.rolling) {
      this.x += this.vx;
      const f = floorAt(w, this.x, this.y + 8 - 8, this.y + 8 + 8);
      if (Number.isFinite(f)) this.y = f - 8;
      else {
        this.rolling = false;
        this.vy = 0;
      }
    } else {
      this.vy += this.gravity;
      this.x += this.vx;
      const ny = this.y + this.vy;
      if (this.vy > 0) {
        const f = floorAt(w, this.x, this.y + 8, ny + 8);
        if (Number.isFinite(f)) {
          this.y = f - 8;
          this.rolling = true;
          this.vx = this.dir * this.rollSpeed * difficultyOf(w).enemyBulletSpeed;
          this.vy = 0;
          dust(w, this.x, f, 3);
          w.audio.sfx('hit/ground', { vol: 0.5 });
        } else this.y = ny;
      } else this.y = ny;
    }
    if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
    // Into the river: a splash, gone.
    const water = Number.isFinite(this.waterY) ? this.waterY : waterAt(w, this.x);
    if (!this.rolling && this.y - 4 > water) {
      splash(w, this.x, water, 8);
      w.audio.sfx('env/water-splash', { vol: 0.5 });
      this.remove();
      return;
    }
    if (++this.t >= this.life) return this.expire();
    if (!w.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** Shot or knifed: it bursts into staves. */
  override expire(): void {
    debris(this.world, this.x, this.y, 'wood', 6);
    poof(this.world, this.x, this.y);
    this.world.audio.sfx('crate/break', { vol: 0.6 });
    this.remove();
  }

  override draw(r: Renderer): void {
    // Spins with the roll direction; only turns while moving.
    drawOpts.flipX = this.vx > 0;
    drawOpts.blend = 'normal';
    const frame = this.rolling || this.vx !== 0 ? Math.floor(this.t / 5) : 0;
    r.sprite(this.sprite, frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Soot ball
// ---------------------------------------------------------------------------------------------

export class SootBall extends EncoreShot {
  static launch(world: World, x: number, y: number, vx: number, vy: number, shooter: Entity | null): SootBall {
    return SootBall.spawn(world, base({ x, y, vx, vy, gravity: 0.12, kind: 'explosion', w: 10, h: 10, offscreen: 120, life: 400, sprite: `${ART}/soot-ball`, ticksPerFrame: 5, shooter, type: 'soot-ball', impact: 'none' }));
  }

  override update(): void {
    const w = this.world;
    const ny = this.y + this.vy + this.gravity;
    if (this.vy > 0) {
      const f = floorAt(w, this.x + this.vx, this.y + 4, ny + 5);
      if (Number.isFinite(f)) {
        this.x += this.vx;
        this.y = f - 5;
        return this.burst();
      }
      const water = waterAt(w, this.x);
      if (ny > water) {
        splash(w, this.x, water, 6);
        w.audio.sfx('env/water-splash', { vol: 0.4 });
        this.remove();
        return;
      }
    }
    this.move();
    if (this.t % 4 === 0) smokeTrail(w, this.x, this.y, true);
    if (++this.t >= this.life) return this.burst();
    if (!w.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.burst();
  }

  burst(): void {
    if (this.removed) return;
    explosion(this.world, this.x, this.y, 's', { damage: 10, team: 'enemy', radius: 10, tags: BOSS_TAGS, debris: 'dirt' });
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Brass pellet
// ---------------------------------------------------------------------------------------------

export class BrassPellet extends EncoreShot {
  laneY = 0;

  /** From (x, y) toward `dir`, swooping to `laneY` within `swoop` px, then flat. */
  static fire(world: World, x: number, y: number, laneY: number, dir: number, speed: number, swoop: number, shooter: Entity | null): BrassPellet {
    const s = speed * difficultyOf(world).enemyBulletSpeed;
    const ticks = Math.max(4, swoop / s);
    const p = BrassPellet.spawn(world, base({ x, y, vx: dir * s, vy: (laneY - y) / ticks, w: 6, h: 5, offscreen: 32, life: 300, sprite: `${ART}/brass-pellet`, ticksPerFrame: 3, shooter, type: 'brass-pellet' }));
    p.laneY = laneY;
    return p;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.laneY = o.y;
  }

  override update(): void {
    this.x += this.vx;
    if (this.vy !== 0) {
      this.y += this.vy;
      if ((this.vy > 0 && this.y >= this.laneY) || (this.vy < 0 && this.y <= this.laneY)) {
        this.y = this.laneY;
        this.vy = 0;
      }
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Registry (scripts and the arena tool can fire them on their own; x, y = the floor point)
// ---------------------------------------------------------------------------------------------

defineEntity('steam-note', (w, x, y, p) => SteamNote.lob(w, x + 120, y - 90, x, y, paramNum(p, 'flight', 40), null), {
  category: 'projectile',
  description: 'THE ENCORE steam note: lands on (x, floor) and leaves a lethal 24×16 steam puff for 20 ticks.',
});
defineEntity('steam-puff', (w, x, y) => SteamPuff.at(w, x, y, null), { category: 'projectile', description: 'THE ENCORE steam puff (24×16, lethal, 20 ticks).' });
defineEntity(
  'foghorn-wave',
  (w, x, y, p) => FoghornWave.blast(w, x, y - (paramStr(p, 'lane', 'low') === 'high' ? 22 : 0), paramFacing(p, -1), 3, null),
  { category: 'projectile', description: 'THE ENCORE sonic band, 16 px tall at 3 px/tick: lane low (0–16 px over the floor, jump) or high (22–38, crouch).' },
);
defineEntity('paddle-wave', (w, x, y, p) => PaddleWave.roll(w, x, y, paramFacing(p, -1), 2, null), {
  category: 'projectile',
  description: 'THE ENCORE paddle wave: 24 px of water rolling along the floor at 2 px/tick (jump it).',
});
defineEntity('barrel', (w, x, y, p) => Barrel.toss(w, x, y - 8, 0, 0, paramFacing(p, -1), null), {
  category: 'projectile',
  description: 'THE ENCORE barrel: rolls 1.2 px/tick, 16 px, contact kills, 20 HP, knifeable, 50 points.',
});
defineEntity('soot-ball', (w, x, y, p) => SootBall.launch(w, x, y - 60, paramNum(p, 'vx', -2), -3, null), {
  category: 'projectile',
  description: 'THE ENCORE soot ball: arcs (gravity 0.12) and bursts on landing (r 10).',
});
defineEntity(
  'brass-pellet',
  (w, x, y, p) => BrassPellet.fire(w, x, y - 40, y - (paramStr(p, 'lane', 'chest') === 'ankle' ? 4 : 24), paramFacing(p, -1), 4, 40, null),
  { category: 'projectile', description: 'THE ENCORE trombone pellet: 4 px/tick at chest (crouch) or ankle (jump) height.' },
);
