/**
 * ROBO-HALSEMA's projectiles (docs/design/amsterdam.md §3). Team 'enemy'; every hit carries the
 * `boss` tag (a player vehicle loses 1 cell); the stamp wave adds `shockwave`.
 *
 * - `stamp-wave` — a 14 × 14 px ink shockwave that runs along the floor at 2.5 px/tick (jump it).
 *   With `slam` it is the 56 × 22 px impact of the stamp itself (8 ticks, does not move).
 * - `noise-letter` — a complaint letter launched out of the hair hatch: it rises, then flutters
 *   down in a sine path onto a spot of the stage. 10 HP, shootable, 50 points.
 * - `shield-shot` — a small enamel shield from the medallion, flying straight (the 5-shot fan).
 */
import type { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { confetti, dust, poof } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramBool, paramFacing, paramNum } from '../../../registry';
import { MAYOR } from './geometry';

export const BOSS_TAGS: readonly string[] = ['boss'];
export const WAVE_TAGS: readonly string[] = ['boss', 'shockwave'];

const ART = 'boss/ams-mayor';
const drawOpts: DrawOpts = {};

/** The walkable floor at x between y0 and y1, else Infinity. */
export function floorAt(world: World, x: number, y0: number, y1: number): number {
  return world.terrain.surfaceY(x, y0, y1);
}

function base(o: Partial<ProjectileOpts> & Pick<ProjectileOpts, 'x' | 'y' | 'vx' | 'vy'>): ProjectileOpts {
  return {
    team: 'enemy',
    damage: 10,
    kind: 'bullet',
    tags: BOSS_TAGS,
    hitsTerrain: false,
    look: 'anim',
    offscreen: 48,
    life: 600,
    ...o,
  };
}

/** Strips are drawn moving LEFT; flipped when the shot moves right. */
class MayorShot extends Projectile {
  override draw(r: Renderer): void {
    if (!this.sprite) return;
    drawOpts.flipX = this.vx > 0;
    drawOpts.blend = this.blend;
    r.sprite(this.sprite, Math.floor(this.t / this.ticksPerFrame), Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Stamp wave
// ---------------------------------------------------------------------------------------------

export class StampWave extends MayorShot {
  groundY = 0;
  halfH = 7;

  /** A wave whose bottom sits on `groundY`, running in `dir` (speed × the difficulty). */
  static run(world: World, x: number, groundY: number, dir: number, shooter: Entity | null): StampWave {
    const S = MAYOR.stamp;
    const s = S.waveSpeed * difficultyOf(world).enemyBulletSpeed;
    const w = StampWave.spawn(world, base({ x, y: groundY - S.waveH / 2, vx: dir * s, vy: 0, kind: 'impact', tags: WAVE_TAGS, w: S.waveW, h: S.waveH, pierce: Infinity, offscreen: 24, sprite: `${ART}/stamp-wave`, ticksPerFrame: 3, shooter, type: 'stamp-wave', impact: 'none' }));
    w.groundY = groundY;
    w.halfH = S.waveH / 2;
    return w;
  }

  /** The stamp's own impact: 56 × 22 on the floor for 8 ticks. */
  static slam(world: World, x: number, groundY: number, shooter: Entity | null): StampWave {
    const S = MAYOR;
    const w = StampWave.spawn(world, base({ x, y: groundY - S.slamH / 2, vx: 0, vy: 0, kind: 'impact', tags: WAVE_TAGS, w: S.slamW, h: S.slamH, pierce: Infinity, life: S.stamp.slam, offscreen: 64, sprite: '', shooter, type: 'stamp-wave', impact: 'none' }));
    w.groundY = groundY;
    w.halfH = S.slamH / 2;
    return w;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.halfH = (o.h ?? 14) / 2;
    this.groundY = o.y + this.halfH;
  }

  override update(): void {
    if (this.vx !== 0) {
      this.x += this.vx;
      this.facing = this.vx < 0 ? -1 : 1;
      // Hug the floor (steps, kerbs); over a gap it keeps its height.
      const f = floorAt(this.world, this.x, this.groundY - 10, this.groundY + 10);
      if (Number.isFinite(f)) this.groundY = f;
      this.y = this.groundY - this.halfH;
      if (this.t % 5 === 0) dust(this.world, this.x, this.groundY, 1);
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Noise letter
// ---------------------------------------------------------------------------------------------

export class NoiseLetter extends MayorShot {
  landY = Infinity;
  tx = 0;
  phase = 0;
  rising = true;

  /** Out of the hatch at (x, y): up and over toward `tx`, then flutters down onto `landY`. */
  static launch(world: World, x: number, y: number, tx: number, landY: number, phase: number, shooter: Entity | null): NoiseLetter {
    const L = MAYOR.letters;
    // Rise for ~22 ticks (vy −1.1, gravity 0.05), drifting toward tx; the flutter covers the rest.
    const vx = Math.max(-2.2, Math.min(2.2, (tx - x) / 50));
    const n = NoiseLetter.spawn(world, base({ x, y, vx, vy: -1.1, gravity: 0.05, w: 10, h: 8, life: 600, offscreen: 140, shootable: true, hp: L.hp, soft: true, score: 50, sprite: `${ART}/noise-letter`, ticksPerFrame: 5, shooter, type: 'noise-letter', impact: 'none' }));
    n.landY = landY;
    n.tx = tx;
    n.phase = phase;
    n.rising = true;
    return n;
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.landY = Infinity;
    this.tx = o.x;
    this.phase = 0;
    this.rising = true;
  }

  override update(): void {
    const L = MAYOR.letters;
    if (this.rising) {
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      if (this.vy >= 0) this.rising = false;
    } else {
      // Flutter: a slow fall, swaying round the line to the target spot.
      const k = this.t + this.phase;
      const drift = Math.max(-0.6, Math.min(0.6, (this.tx - this.x) / 60));
      this.vx = drift + Math.sin(k / 9) * L.sway;
      this.vy = L.fall * difficultyOf(this.world).enemyBulletSpeed * (0.8 + 0.4 * Math.abs(Math.cos(k / 9)));
      this.x += this.vx;
      this.y += this.vy;
    }
    if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
    if (!this.rising && this.y + 4 >= this.landY) {
      // Lands: crumples into paper scraps.
      confetti(this.world, this.x, this.landY - 2, 4, 1);
      this.remove();
      return;
    }
    if (++this.t >= this.life) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override expire(): void {
    poof(this.world, this.x, this.y);
    confetti(this.world, this.x, this.y, 5, 1.2);
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.blend = 'normal';
    // Flaps open while rising, tumbles while it flutters.
    const f = this.rising ? 0 : 1 + (Math.floor((this.t + this.phase) / 6) % 3);
    r.sprite(this.sprite, f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Shield shot
// ---------------------------------------------------------------------------------------------

export class ShieldShot extends MayorShot {
  /** From (x, y) at `angle` (radians, world space), speed × the difficulty. */
  static fire(world: World, x: number, y: number, angle: number, shooter: Entity | null): ShieldShot {
    const s = MAYOR.fan.speed * difficultyOf(world).enemyBulletSpeed;
    return ShieldShot.spawn(world, base({ x, y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, w: 7, h: 7, life: 400, offscreen: 24, hitsTerrain: true, sprite: `${ART}/shield-shot`, ticksPerFrame: 4, shooter, type: 'shield-shot' }));
  }
}

// ---------------------------------------------------------------------------------------------
// Registry (the arena tool and scripts can fire them on their own; x, y = the floor point)
// ---------------------------------------------------------------------------------------------

defineEntity(
  'stamp-wave',
  (w, x, y, p) => (paramBool(p, 'slam', false) ? StampWave.slam(w, x, y, null) : StampWave.run(w, x, y, paramFacing(p, -1), null)),
  { category: 'projectile', description: 'ROBO-HALSEMA stamp shockwave: 14×14 on the floor at 2.5 px/tick (jump it); `slam`: the 56×22 stamp impact for 8 ticks.' },
);
defineEntity('noise-letter', (w, x, y, p) => NoiseLetter.launch(w, x + paramFacing(p, -1) * -60, y - 140, x, y, paramNum(p, 'phase', 0), null), {
  category: 'projectile',
  description: 'ROBO-HALSEMA complaint letter: rises out of the hair hatch, flutters down onto (x, floor); 10 HP, shootable, 50 points.',
});
defineEntity('shield-shot', (w, x, y, p) => ShieldShot.fire(w, x, y - 76, paramFacing(p, -1) < 0 ? Math.PI - 0.3 : 0.3, null), {
  category: 'projectile',
  description: 'ROBO-HALSEMA enamel shield from the medallion fan (2.2 px/tick, straight).',
});
