/**
 * THE WINDBAG's projectiles (GDD §10.3, §15.4). Every hit carries the `boss` tag (a player
 * vehicle loses 1 cell, docs/api/game.md §6).
 *
 * - `homing-note` — a Drone Bolt: a slow note (1.5 px/tick × difficulty) that turns 2°/tick
 *   toward the nearest player for 180 ticks; 10 HP, 50 points when shot down.
 * - `sheet-mine` — a page of sheet music tossed out of the gondola hatch: it flutters down
 *   slowly, swaying, and explodes (r 12) on the ground or on a player; 50 points when shot.
 * - `reel-note` — a note of the Reel: harmless while it arcs from the chanter to its spot on the
 *   deck (fixed flight time); there it bursts into a 10×10 impact for 8 ticks. The bursts of a
 *   stream form the moving impact line the players jump.
 */
import type { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { confetti, explosion, musicNotes, poof, snowPuff } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramNum } from '../../../registry';
import { WINDBAG } from './layout';

export const BOSS_TAGS: readonly string[] = ['boss'];
const ART = 'boss/windbag';
const drawOpts: DrawOpts = {};
const DEG = Math.PI / 180;

/** The walkable floor at x between y0 and y1 (ground, platforms, solid tops), else Infinity. */
export function floorAt(world: World, x: number, y0: number, y1: number): number {
  return world.terrain.surfaceY(x, y0, y1);
}

function base(o: Partial<ProjectileOpts> & Pick<ProjectileOpts, 'x' | 'y' | 'vx' | 'vy'>): ProjectileOpts {
  return { team: 'enemy', damage: 10, kind: 'bullet', tags: BOSS_TAGS, look: 'anim', offscreen: 64, life: 600, ...o };
}

// ---------------------------------------------------------------------------------------------
// Drone Bolts
// ---------------------------------------------------------------------------------------------

export class HomingNote extends Projectile {
  speed = 1.5;

  /** From (x, y) toward the nearest player (or straight down-left without one). */
  static fire(world: World, x: number, y: number, shooter: Entity | null): HomingNote {
    const s = WINDBAG.bolts.speed * difficultyOf(world).enemyBulletSpeed;
    const t = world.nearestPlayer(x, y);
    const a = t ? Math.atan2(t.y - 16 - y, t.x - x) : 2.3;
    const n = HomingNote.spawn(
      world,
      base({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 10, h: 10, life: WINDBAG.bolts.life, sprite: `${ART}/homing-note`, ticksPerFrame: 6, shootable: true, hp: WINDBAG.bolts.hp, score: 50, shooter, type: 'homing-note', hitsTerrain: true, offscreen: 48 }),
    );
    n.speed = s;
    return n;
  }

  override update(): void {
    // Turn at most 2°/tick toward the nearest player's chest.
    const t = this.world.nearestPlayer(this.x, this.y);
    if (t) {
      const want = Math.atan2(t.y - 16 - this.y, t.x - this.x);
      const cur = Math.atan2(this.vy, this.vx);
      let d = want - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const turn = WINDBAG.bolts.turnDeg * DEG;
      const a = cur + Math.max(-turn, Math.min(turn, d));
      this.vx = Math.cos(a) * this.speed;
      this.vy = Math.sin(a) * this.speed;
    }
    super.update();
  }

  override expire(): void {
    musicNotes(this.world, this.x, this.y, 1, 4, 24);
    poof(this.world, this.x, this.y);
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.blend = 'normal';
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Sheet-Music Mines
// ---------------------------------------------------------------------------------------------

export class SheetMine extends Projectile {
  drift = 0;
  phase = 0;
  burst = false;

  /** Tossed out of the hatch at (x, y) with a sideways drift `vx`. */
  static toss(world: World, x: number, y: number, vx: number, shooter: Entity | null): SheetMine {
    const m = SheetMine.spawn(
      world,
      base({ x, y, vx, vy: -1.1, w: 12, h: 12, kind: 'explosion', life: 900, sprite: `${ART}/sheet-mine`, ticksPerFrame: 6, shootable: true, hp: 10, score: 50, shooter, type: 'sheet-mine', hitsTerrain: false, offscreen: 64, impact: 'none' }),
    );
    m.drift = vx;
    m.phase = world.fxRng.range(0, 6);
    return m;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.drift = 0;
    this.phase = 0;
    this.burst = false;
  }

  override update(): void {
    const w = this.world;
    // Toss, then a slow flutter: the fall speed caps at `fall`, the sideways drift dies away and
    // a sway rocks the page from side to side.
    this.vy = Math.min(WINDBAG.mines.fall, this.vy + 0.06);
    this.drift *= 0.985;
    this.vx = this.drift + Math.sin(this.t / 14 + this.phase) * 0.45;
    this.x += this.vx;
    this.y += this.vy;
    if (this.vy > 0) {
      const f = floorAt(w, this.x, this.y - 2, this.y + 7);
      if (Number.isFinite(f)) {
        this.y = f - 6;
        this.explode(null);
        return;
      }
    }
    if (++this.t >= this.life) return this.expire();
    if (!w.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override onImpact(target: Entity | null): void {
    this.explode(target);
  }

  /** On the deck or on a player: a small blast (r 12). */
  explode(target: Entity | null): void {
    if (this.burst || this.removed) return;
    this.burst = true;
    explosion(this.world, this.x, this.y, 's', { damage: 10, team: 'enemy', radius: WINDBAG.mines.r, tags: BOSS_TAGS, exclude: target ?? undefined, debris: 'snow' });
    snowPuff(this.world, this.x, this.y + 4, 4);
    this.remove();
  }

  /** Shot down (or timed out): the page bursts into paper scraps, harmlessly. */
  override expire(): void {
    if (this.burst) return;
    this.burst = true;
    confetti(this.world, this.x, this.y, 6, 1.2);
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.vx < 0;
    drawOpts.blend = 'normal';
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The Reel
// ---------------------------------------------------------------------------------------------

export class ReelNote extends Projectile {
  landY = 0;
  landed = false;

  /** Lob from (x, y) onto the deck at (tx, floorY) in `flight` ticks. */
  static lob(world: World, x: number, y: number, tx: number, floorY: number, flight: number, shooter: Entity | null): ReelNote {
    const g = 0.12;
    const vx = (tx - x) / flight;
    const vy = (floorY - y - (g * flight * flight) / 2) / flight;
    const n = ReelNote.spawn(world, base({ x, y, vx, vy, gravity: g, w: 10, h: 14, pierce: Infinity, life: flight + 60, offscreen: 96, sprite: `${ART}/reel-note`, ticksPerFrame: 4, shooter, type: 'reel-note', hitsTerrain: false, impact: 'none' }));
    n.landY = floorY;
    // Harmless in flight: only the burst on the deck hurts.
    n.removeTag('shot');
    return n;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.landY = Infinity;
    this.landed = false;
  }

  override update(): void {
    if (!this.landed) {
      this.move();
      if (this.vy > 0 && this.y >= this.landY) this.land();
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** The note hits the deck: an impact 10×10 standing on the floor for 8 ticks. */
  land(): void {
    this.landed = true;
    this.y = this.landY - 5;
    this.hitbox.x = -5;
    this.hitbox.y = -5;
    this.hitbox.w = 10;
    this.hitbox.h = 10;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.sprite = `${ART}/reel-burst`;
    this.ticksPerFrame = 3;
    this.t = 0;
    this.life = 8;
    this.addTag('shot');
    if (this.world.tick % 2 === 0) this.world.audio.sfx('hit/drum', { vol: 0.25, pitch: 1.8 });
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.blend = 'normal';
    const y = this.landed ? this.landY : this.y;
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), Math.round(this.x), Math.round(y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Registry (scripts and the arena tool can fire them alone; x, y = the floor point)
// ---------------------------------------------------------------------------------------------

defineEntity('homing-note', (w, x, y) => HomingNote.fire(w, x, y - 120, null), {
  category: 'projectile',
  description: 'THE WINDBAG Drone Bolt: a homing note 120 px above (x, floor); 1.5 px/tick, turns 2°/tick, life 180, 10 HP, 50 points.',
});
defineEntity('sheet-mine', (w, x, y, p) => SheetMine.toss(w, x, y - paramNum(p, 'height', 60), paramNum(p, 'vx', 0), null), {
  category: 'projectile',
  description: 'THE WINDBAG sheet-music mine: tossed `height` (60) px above the floor, flutters down and explodes (r 12); 50 points shot.',
});
defineEntity('reel-note', (w, x, y, p) => ReelNote.lob(w, x + paramNum(p, 'from', 120), y - 20, x, y, WINDBAG.reel.flight, null), {
  category: 'projectile',
  description: 'THE WINDBAG Reel note: arcs from the chanter onto (x, floor) and bursts there (10×10, 8 ticks).',
});
