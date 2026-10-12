/**
 * Projectiles of the m2 bosses (GDD §10.2, §9.4, §15.4): `tom-shell`, `drumstick`, `cymbal-saw`
 * (the BA-DUM BEHEMOTH), `golden-egg` (the GOLDEN GOOSE), and their ground waves, notes and
 * pellets. Every hit carries the `boss` tag (a player vehicle loses 1 cell, docs/api/game.md §6);
 * ground waves add `shockwave`.
 *
 * - `GroundWave` — hugs the floor (slopes too), stopped by walls and pit edges; jump it.
 * - `TomShell` — a mortar shell that lands on a chosen spot in a fixed flight time; it draws its
 *   own landing shadow for the whole flight (the GDD's 30-tick marker); blast r 14.
 * - `Drumstick` — waits `delay` ticks above the view (its shadow already shows), then falls at
 *   4 px/tick onto the shadow; lethal, 4×16.
 * - `CymbalSaw` — 24×8; out to the left 28 px over the floor (crouch), back 6 px over it (jump).
 * - `GoldenEgg` — dropped from the goose, rolls at 1.5 px/tick toward a player; 20 HP, knifeable,
 *   50 points shot down; explodes (r 16) on touch, on a wall or after 120 rolling ticks.
 */
import type { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { drawShadow, dust, explosion, impactPuff } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum } from '../../../registry';

export const BOSS_TAGS: readonly string[] = ['boss'];
export const WAVE_TAGS: readonly string[] = ['boss', 'shockwave'];

const BEH = 'boss/ba-dum-behemoth';
const GOOSE = 'boss/golden-goose';
const drawOpts: DrawOpts = {};

/** Floor under x near `nearY` (Infinity when there is none). */
function floorNear(world: World, x: number, nearY: number, span = 12): number {
  return world.terrain.surfaceY(x, nearY - span, nearY + span);
}

// ---------------------------------------------------------------------------------------------
// Ground wave (Kick Boom 12 px / 3 px/tick; Goose Step 8 px / 32 px each way)
// ---------------------------------------------------------------------------------------------

export interface WaveOpts {
  x: number;
  /** Floor y under x. */
  y: number;
  dir: 1 | -1;
  speed: number;
  height: number;
  range: number;
  sprite: string;
  shooter?: Entity | null;
}

export class GroundWave extends Projectile {
  dist = 0;
  range = 0;
  groundY = 0;
  waveH = 12;

  static launch(world: World, o: WaveOpts): GroundWave {
    const w = GroundWave.spawn(world, {
      team: 'enemy',
      x: o.x,
      y: o.y - o.height / 2,
      vx: o.dir * o.speed * difficultyOf(world).enemyBulletSpeed,
      vy: 0,
      damage: 10,
      kind: 'bullet',
      tags: WAVE_TAGS,
      w: Math.max(8, o.height),
      h: o.height,
      sprite: o.sprite,
      look: 'anim',
      ticksPerFrame: 3,
      hitsTerrain: false,
      pierce: Infinity,
      life: 600,
      offscreen: 48,
      shooter: o.shooter ?? null,
      type: 'boss-wave',
    }) as GroundWave;
    w.range = o.range;
    w.waveH = o.height;
    w.groundY = o.y;
    return w;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.dist = 0;
    this.range = 400;
    this.waveH = o.h ?? 12;
    this.groundY = o.y + this.waveH / 2;
  }

  override update(): void {
    const nx = this.x + this.vx;
    const ter = this.world.terrain;
    const dir = Math.sign(this.vx);
    // A wall taller than the wave, or a pit edge, stops it.
    if (ter.isSolid(nx + dir * 5, this.groundY - this.waveH + 1)) return this.fizzle();
    const floor = floorNear(this.world, nx, this.groundY);
    if (!Number.isFinite(floor)) return this.fizzle();
    this.x = nx;
    this.groundY = floor;
    this.y = floor - this.waveH / 2;
    this.dist += Math.abs(this.vx);
    if (++this.t >= this.life || this.dist >= this.range) return this.fizzle();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  private fizzle(): void {
    dust(this.world, this.x, this.groundY, 3);
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Tom shell (Tom Volley): lands on its spot after `flight` ticks, blast r 14
// ---------------------------------------------------------------------------------------------

export class TomShell extends Projectile {
  targetX = 0;
  targetY = 0;
  flight = 30;

  /** Fire from (x, y) to land on (tx, ty) after `flight` ticks. */
  static lob(world: World, x: number, y: number, tx: number, ty: number, flight: number, shooter: Entity | null): TomShell {
    const g = 0.18;
    const vx = (tx - x) / flight;
    // y(t) = y + vy·t + g·t²/2 = ty at t = flight.
    const vy = (ty - 4 - y - (g * flight * flight) / 2) / flight;
    const s = TomShell.spawn(world, {
      team: 'enemy',
      x,
      y,
      vx,
      vy,
      gravity: g,
      damage: 10,
      kind: 'explosion',
      tags: BOSS_TAGS,
      w: 8,
      h: 8,
      sprite: `${BEH}/tom-shell`,
      look: 'anim',
      ticksPerFrame: 3,
      impact: 'none',
      hitsPlatforms: true,
      life: flight + 60,
      offscreen: 160,
      shooter,
      type: 'tom-shell',
    }) as TomShell;
    s.targetX = tx;
    s.targetY = ty;
    s.flight = flight;
    return s;
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.blast(x, y);
  }

  override expire(): void {
    this.blast(this.x, this.y);
    this.remove();
  }

  private blast(x: number, y: number): void {
    if (this.dead) return;
    this.dead = true;
    explosion(this.world, x, y, 's', { damage: 10, team: 'enemy', radius: 14, tags: BOSS_TAGS, kind: 'explosion', shake: 1 });
  }

  override draw(r: Renderer): void {
    // The landing marker: a shadow that grows as the shell comes down.
    const k = Math.min(1, this.t / Math.max(1, this.flight));
    drawShadow(r, this.targetX, this.targetY, 10 + Math.round(k * 18), 0.35 + 0.25 * k);
    super.draw(r);
  }
}

// ---------------------------------------------------------------------------------------------
// Drumstick (Stick Storm)
// ---------------------------------------------------------------------------------------------

export class Drumstick extends Projectile {
  delay = 0;
  groundY = 176;
  total = 1;

  /** A stick that falls onto (x, groundY) after waiting `delay` ticks above the view. */
  static drop(world: World, x: number, groundY: number, delay: number, shooter: Entity | null): Drumstick {
    const top = world.camera.top - 20;
    const s = Drumstick.spawn(world, {
      team: 'enemy',
      x,
      y: top,
      vx: 0,
      vy: 0,
      damage: 10,
      kind: 'impact',
      tags: BOSS_TAGS,
      w: 4,
      h: 16,
      sprite: `${BEH}/drumstick`,
      look: 'anim',
      ticksPerFrame: 4,
      hitsTerrain: false,
      life: 400,
      offscreen: 200,
      impact: 'none',
      shooter,
      type: 'drumstick',
    }) as Drumstick;
    s.delay = delay;
    s.groundY = groundY;
    s.total = delay + Math.max(1, (groundY - top) / 4);
    return s;
  }

  override update(): void {
    this.t++;
    if (this.delay > 0) {
      this.delay--;
      return;
    }
    this.vy = 4;
    this.y += this.vy;
    if (this.y + 8 >= this.groundY) {
      // It sticks in the sand for a moment: a puff, then gone.
      impactPuff(this.world, this.x, this.groundY - 1, 0, -1);
      dust(this.world, this.x, this.groundY, 2);
      this.world.audio.sfx('drum/rim', { vol: 0.5 });
      this.remove();
      return;
    }
    if (this.t >= this.life) this.remove();
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
  }

  override draw(r: Renderer): void {
    const k = Math.min(1, this.t / this.total);
    drawShadow(r, this.x, this.groundY, 8 + Math.round(k * 8), 0.3 + 0.3 * k);
    if (this.delay > 0) return;
    super.draw(r);
  }
}

// ---------------------------------------------------------------------------------------------
// Cymbal saw (Cymbal Saw)
// ---------------------------------------------------------------------------------------------

export class CymbalSaw extends Projectile {
  /** 'out' (high, to the left), 'back' (low, to the right). */
  leg: 'out' | 'back' = 'out';
  minX = 0;
  homeX = 0;
  groundY = 176;
  speed = 3;
  /** Called once when the saw is back (the boss catches it). */
  onHome: (() => void) | null = null;

  static throwSaw(world: World, x: number, groundY: number, minX: number, homeX: number, shooter: Entity | null): CymbalSaw {
    const speed = 3 * difficultyOf(world).enemyBulletSpeed;
    const s = CymbalSaw.spawn(world, {
      team: 'enemy',
      x,
      y: groundY - 28,
      vx: -speed,
      vy: 0,
      damage: 10,
      kind: 'bullet',
      tags: BOSS_TAGS,
      w: 22,
      h: 6,
      sprite: `${BEH}/cymbal-saw`,
      look: 'anim',
      ticksPerFrame: 2,
      hitsTerrain: false,
      pierce: Infinity,
      life: 900,
      offscreen: 400,
      impact: 'none',
      shooter,
      type: 'cymbal-saw',
    }) as CymbalSaw;
    s.leg = 'out';
    s.minX = minX;
    s.homeX = homeX;
    s.groundY = groundY;
    s.speed = speed;
    return s;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.onHome = null;
  }

  override update(): void {
    this.t++;
    if (this.leg === 'out') {
      this.x -= this.speed;
      if (this.x <= this.minX || this.world.terrain.isSolid(this.x - 12, this.y)) {
        // Turn: drop to 6 px over the floor and come back.
        this.leg = 'back';
        this.y = this.groundY - 6;
        this.vx = this.speed;
        this.world.audio.sfx('hit/metal', { vol: 0.6, pitch: 1.6 });
        dust(this.world, this.x, this.groundY, 3);
      }
    } else {
      this.x += this.speed;
      if (this.x >= this.homeX) {
        this.onHome?.();
        this.remove();
        return;
      }
    }
    if (this.t % 6 === 0) this.world.audio.sfx('drum/hat', { vol: 0.35, pitch: 1.4 });
    if (this.t >= this.life) this.remove();
  }

  override onRemove(): void {
    this.onHome = null;
    super.onRemove();
  }
}

// ---------------------------------------------------------------------------------------------
// Golden egg-bomb (Egg Drop)
// ---------------------------------------------------------------------------------------------

const EGG_HALF = 7;

export class GoldenEgg extends Projectile {
  rolling = false;
  rollT = 0;
  dir: 1 | -1 = -1;
  private shotDown = false;

  static lay(world: World, x: number, y: number, dir: 1 | -1, shooter: Entity | null): GoldenEgg {
    const e = GoldenEgg.spawn(world, {
      team: 'enemy',
      x,
      y,
      vx: dir * 0.4,
      vy: 0.5,
      gravity: 0.2,
      damage: 10,
      kind: 'explosion',
      tags: BOSS_TAGS,
      w: 12,
      h: 14,
      sprite: `${GOOSE}/egg`,
      look: 'anim',
      ticksPerFrame: 5,
      hitsTerrain: false,
      shootable: true,
      soft: true,
      hp: 20,
      score: 50,
      life: 600,
      offscreen: 96,
      impact: 'none',
      shooter,
      type: 'golden-egg',
    }) as GoldenEgg;
    e.dir = dir;
    return e;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.rolling = false;
    this.rollT = 0;
    this.shotDown = false;
  }

  override update(): void {
    this.t++;
    const ter = this.world.terrain;
    if (!this.rolling) {
      this.vy = Math.min(this.vy + this.gravity, 5);
      this.x += this.vx;
      const ny = this.y + this.vy;
      const floor = ter.surfaceY(this.x, this.y + EGG_HALF - 2, ny + EGG_HALF + 1);
      if (Number.isFinite(floor)) {
        this.y = floor - EGG_HALF;
        this.rolling = true;
        this.vx = this.dir * 1.5;
        this.vy = 0;
        this.world.audio.sfx('hit/metal', { vol: 0.35, pitch: 1.9 });
      } else this.y = ny;
    } else {
      const nx = this.x + this.vx;
      const feet = this.y + EGG_HALF;
      if (ter.isSolid(nx + this.dir * 7, feet - EGG_HALF)) return this.burst();
      const floor = ter.surfaceY(nx, feet - 6, feet + 8);
      this.x = nx;
      if (!Number.isFinite(floor)) {
        this.rolling = false;
        this.vx = this.dir * 0.6;
      } else this.y = floor - EGG_HALF;
      if (++this.rollT >= 120) return this.burst();
    }
    if (this.t >= this.life) this.burst();
    else if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.burst();
  }

  /** Shot down or knifed: a harmless golden pop (50 points). */
  override die(d?: Parameters<Projectile['die']>[0]): void {
    this.shotDown = true;
    super.die(d);
  }

  override expire(): void {
    this.burst();
  }

  private burst(): void {
    if (this.removed) return;
    if (this.shotDown) {
      impactPuff(this.world, this.x, this.y, 0, -1);
      explosion(this.world, this.x, this.y, 's', { damage: 0, team: 'enemy', radius: 1, silent: false, shake: 0 });
    } else {
      explosion(this.world, this.x, this.y, 's', { damage: 10, team: 'enemy', radius: 16, tags: BOSS_TAGS, kind: 'explosion', shake: 2 });
    }
    this.dead = true;
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.dir < 0;
    drawOpts.flash = false;
    const frame = this.rolling ? (this.t >> 3) & 3 : 0;
    // The last 30 ticks before it bursts it blinks red-hot.
    if (this.rolling && this.rollT > 90 && (this.t >> 2) % 2 === 0) drawOpts.flash = true;
    r.sprite(`${GOOSE}/egg`, frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Simple shots: honk notes and neck pellets
// ---------------------------------------------------------------------------------------------

export function gooseNote(world: World, x: number, y: number, angle: number, speed: number, shooter: Entity | null): Projectile {
  const s = speed * difficultyOf(world).enemyBulletSpeed;
  return Projectile.spawn(world, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    damage: 10,
    tags: BOSS_TAGS,
    w: 6,
    h: 6,
    sprite: `${GOOSE}/note`,
    look: 'anim',
    ticksPerFrame: 6,
    life: 360,
    offscreen: 24,
    shooter,
    type: 'goose-note',
  });
}

export function goosePellet(world: World, x: number, y: number, angle: number, speed: number, shooter: Entity | null): Projectile {
  const s = speed * difficultyOf(world).enemyBulletSpeed;
  return Projectile.spawn(world, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    damage: 10,
    tags: BOSS_TAGS,
    w: 5,
    h: 5,
    sprite: `${GOOSE}/pellet`,
    look: 'anim',
    ticksPerFrame: 4,
    life: 300,
    offscreen: 24,
    shooter,
    type: 'goose-pellet',
  });
}

// ---------------------------------------------------------------------------------------------
// Spawnable ids (scripts and tests; GDD §15.4). x / y = where it starts (feet for the egg).
// ---------------------------------------------------------------------------------------------

defineEntity(
  'tom-shell',
  (w, x, y, p) => TomShell.lob(w, x, y - 60, x + paramNum(p, 'dx', -96), y, paramNum(p, 'flight', 30), null),
  { category: 'projectile', description: 'BA-DUM BEHEMOTH tom mortar shell: lands on its shadow after 30 ticks, r 14.' },
);
defineEntity(
  'drumstick',
  (w, x, y, p) => Drumstick.drop(w, x, y, paramNum(p, 'delay', 30), null),
  { category: 'projectile', description: 'BA-DUM BEHEMOTH drumstick: its shadow shows, then it falls at 4 px/tick (4×16, lethal).' },
);
defineEntity(
  'cymbal-saw',
  (w, x, y, p) => CymbalSaw.throwSaw(w, x, y, x - paramNum(p, 'range', 300), x + 8, null),
  { category: 'projectile', description: 'BA-DUM BEHEMOTH cymbal saw: out 28 px over the floor (crouch), back 6 px over it (jump).' },
);
defineEntity(
  'golden-egg',
  (w, x, y, p) => GoldenEgg.lay(w, x, y - 20, paramFacing(p, -1), null),
  { category: 'projectile', description: 'GOLDEN GOOSE egg-bomb: rolls 1.5 px/tick, 20 HP, knifeable, r 16 after 120 ticks.' },
);
