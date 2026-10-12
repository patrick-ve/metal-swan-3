/**
 * CRATE COLOSSUS — the test boss of mission m0 (a Boss with 2 parts and 2 phases).
 *
 * A giant Legion supply crate with a brass turret drops into the arena.
 * - Parts: `turret` (weak point, damage ×1.5) and `body` (tough, damage ×0.5); one HP pool.
 * - Phase 1 "guns" (100 %): aimed 3-round bursts and lobbed shells.
 * - Phase 2 "rage" (≤ 50 %): a 60-tick intermission (boss and players invulnerable, enemy shots
 *   fade), then the front hatch opens: bullet fans, crew riflemen running out, faster volleys.
 * Every attack is telegraph → attack → recovery; telegraphs ≥ 18 ticks (GDD §10.0).
 */
import type { Damage } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss } from '../../../boss';
import { difficultyOf } from '../../../context';
import { telegraphTicks } from '../../../enemy';
import { debris, dust, explosion, smokeTrail } from '../../../fx';
import { Projectile } from '../../../projectile';
import { defineEntity, paramFacing, type SpawnParams } from '../../../registry';
import { COLOSSUS } from './sprites';

const DEG = Math.PI / 180;
const bodyOpts: DrawOpts = {};
const partOpts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.5 };
const glowOpts: DrawOpts = { blend: 'add', alpha: 0.6 };

export class CrateColossus extends Boss {
  /** Current turret elevation (degrees, + = up) and the frame that shows it. */
  aimDeg = 0;
  turretFrame = 1;
  /** 0 closed, 1 half open, 2 open. */
  hatchState = 0;
  private aimLocked = false;
  /** Telegraph glow ticks left: turret (shots) / hatch (fans, crew). */
  private charge = 0;
  private hatchGlow = 0;
  private lastPing = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'boss/crate-colossus', name: 'CRATE COLOSSUS', hp: 1600, score: 30000 });
    this.facing = paramFacing(p, -1);
    this.addPart('turret', { box: { x: -16, y: -80, w: 32, h: 22 }, multiplier: 1.5 });
    this.addPart('body', { box: { x: -36, y: -58, w: 72, h: 50 }, multiplier: 0.5, contact: true });
    this.contactDamage = { amount: 10, kind: 'impact', dirX: this.facing };
    this.removeOnDeath = false;
    this.phases = [
      { at: 1, name: 'guns', pattern: (b) => b.cycle([(c) => c.burst(), (c) => c.lob()], 30) },
      { at: 0.5, name: 'rage', onEnter: (b) => b.rage(), pattern: (b) => b.ragePattern() },
    ];
  }

  private get hard(): boolean {
    return difficultyOf(this.world).id === 'hard';
  }

  /** A telegraph scaled by difficulty, never below 18 ticks. */
  private tele(base: number): number {
    return telegraphTicks(this.world, base);
  }

  /** A recovery scaled by difficulty. */
  private recover(base: number): number {
    return Math.max(1, Math.round(base * difficultyOf(this.world).enemyFireInterval));
  }

  // ------------------------------------------------------------------------------- intro

  /** Drops out of the sky and lands with a thud. */
  override *intro(): ScriptGen {
    const ground = this.world.terrain.surfaceY(this.x, this.y, Infinity);
    const floor = Number.isFinite(ground) ? ground : this.world.camera.bottom - 40;
    this.vy = 0;
    while (this.y < floor) {
      this.vy = Math.min(this.vy + 0.35, 9);
      this.y = Math.min(floor, this.y + this.vy);
      yield;
    }
    this.world.camera.shake(6, 24);
    for (const dx of [-30, -10, 10, 30]) dust(this.world, this.x + dx, this.y, 4);
    debris(this.world, this.x, this.y - 10, 'wood', 6);
    this.world.audio.sfx('ui/stamp');
    this.world.audio.sfx('explosion/s');
    yield 50;
  }

  // ------------------------------------------------------------------------------- aiming

  /** World position of the turret pivot. */
  private pivotX(): number {
    return this.x;
  }

  private pivotY(): number {
    return this.y + COLOSSUS.roofY + COLOSSUS.pivotY;
  }

  protected override think(): void {
    if (this.charge > 0) this.charge--;
    if (this.hatchGlow > 0) this.hatchGlow--;
    if (!this.aimLocked) {
      const t = this.world.nearestPlayer(this.x, this.y - 40);
      if (t) {
        const dx = (t.x - this.pivotX()) * this.facing;
        const dy = t.y - 15 - this.pivotY();
        // Elevation toward the player's chest; players behind it get the barrel straight up.
        const want = dx <= 4 ? 90 : -Math.atan2(dy, dx) / DEG;
        this.turnTurret(want, 2);
      }
    }
  }

  /** Turn the barrel toward `deg` by at most `step` degrees and pick the matching frame. */
  private turnTurret(deg: number, step: number): void {
    const want = Math.max(-15, Math.min(90, deg));
    this.aimDeg += Math.max(-step, Math.min(step, want - this.aimDeg));
    const angles = COLOSSUS.turretAngles;
    let best = 0;
    for (let i = 1; i < angles.length; i++) if (Math.abs(angles[i] - this.aimDeg) < Math.abs(angles[best] - this.aimDeg)) best = i;
    this.turretFrame = best;
  }

  /** Direction of the barrel (unit vector) for the current elevation. */
  private aimDir(out: [number, number]): [number, number] {
    out[0] = Math.cos(this.aimDeg * DEG) * this.facing;
    out[1] = -Math.sin(this.aimDeg * DEG);
    return out;
  }

  private readonly dir: [number, number] = [0, 0];

  // ------------------------------------------------------------------------------- attacks

  private bullet(x: number, y: number, dx: number, dy: number, speed: number): void {
    const s = speed * difficultyOf(this.world).enemyBulletSpeed;
    Projectile.spawn(this.world, {
      team: 'enemy',
      x,
      y,
      vx: dx * s,
      vy: dy * s,
      damage: 10,
      sprite: 'enemy/bullet',
      w: 6,
      h: 3,
      life: 300,
      offscreen: 32,
      shooter: this,
      type: 'colossus-shot',
    });
  }

  /** Aimed burst from the turret: glow + click (telegraph), 3 rounds (4 on HARD), recovery. */
  *burst(): ScriptGen {
    const tele = this.tele(30);
    this.charge = tele;
    this.world.audio.sfx('enemy/aim');
    yield tele - 8;
    this.aimLocked = true;
    yield 8;
    const n = 3 + (this.hard ? 1 : 0) + (this.phase === 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const d = this.aimDir(this.dir);
      const L = COLOSSUS.barrelLen;
      this.bullet(this.pivotX() + d[0] * L, this.pivotY() + d[1] * L, d[0], d[1], 2.6);
      this.world.audio.sfx('enemy/rifle');
      yield 8;
    }
    this.aimLocked = false;
    yield this.recover(40);
  }

  /** Lobbed shells: the barrel rises to 45° with a breathy swell, then 1–3 shells arc down. */
  *lob(): ScriptGen {
    const tele = this.tele(30);
    this.aimLocked = true;
    this.charge = tele;
    this.world.audio.sfx('enemy/tuba-inhale');
    for (let i = 0; i < tele; i++) {
      this.turnTurret(45, 3);
      yield;
    }
    const n = 1 + (this.phase === 1 ? 1 : 0) + (this.hard ? 1 : 0);
    for (let i = 0; i < n; i++) {
      this.shell(i * 36 - (n - 1) * 18);
      yield 14;
    }
    this.world.audio.sfx('enemy/tuba-blast');
    this.aimLocked = false;
    yield this.recover(50);
  }

  /** One shell aimed to land near the nearest player (+ `offset` px). */
  private shell(offset: number): void {
    const d = this.aimDir(this.dir);
    const L = COLOSSUS.barrelLen;
    const x0 = this.pivotX() + d[0] * L;
    const y0 = this.pivotY() + d[1] * L;
    const t = this.world.nearestPlayer(this.x, this.y);
    const tx = (t ? t.x : this.x + this.facing * 120) + offset;
    const ty = t ? t.y : this.y;
    const g = 0.1;
    const vy = -3.2;
    // Time until the arc comes back down to the target's feet: y0 + vy·t + g·t²/2 = ty.
    const flight = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, ty - y0))) / g;
    const vx = Math.max(-4, Math.min(4, (tx - x0) / Math.max(20, flight)));
    const world = this.world;
    Projectile.spawn(world, {
      team: 'enemy',
      x: x0,
      y: y0,
      vx,
      vy,
      gravity: g,
      damage: 10,
      kind: 'explosion',
      sprite: 'weapon/shell',
      w: 8,
      h: 6,
      life: 360,
      offscreen: 96,
      impact: 'none',
      shootable: true,
      hp: 10,
      shooter: this,
      type: 'colossus-shell',
      onImpact: (_p, _target, x, y) => {
        explosion(world, x, y, 'm', { damage: 10, team: 'enemy', radius: 22 });
      },
    });
  }

  /** Phase 2: the hatch opens and a fan of slow bullets sprays out. */
  *fan(): ScriptGen {
    this.hatchState = 2;
    const tele = this.tele(36);
    this.hatchGlow = tele;
    this.world.audio.sfx('enemy/cymbal-raise');
    yield tele;
    const hx = this.x + (COLOSSUS.hatch.x + COLOSSUS.hatch.w / 2) * this.facing;
    const hy = this.y + COLOSSUS.hatch.y + COLOSSUS.hatch.h / 2;
    const angles = this.hard ? [26, 14, 4, -6] : [22, 10, -2];
    for (const a of angles) this.bullet(hx, hy, Math.cos(a * DEG) * this.facing, Math.sin(a * DEG), 2.2);
    this.world.audio.sfx('enemy/cymbal-crash');
    yield this.recover(50);
    this.hatchState = 1;
  }

  /** Phase 2: a crew rifleman runs out of the hatch (at most 2 at a time). */
  *deploy(): ScriptGen {
    if (this.world.countAlive('colossus-crew') >= 2) {
      yield 10;
      return;
    }
    this.hatchState = 2;
    const tele = this.tele(30);
    this.hatchGlow = tele;
    this.world.audio.sfx('enemy/whistle');
    yield tele;
    const hx = this.x + (COLOSSUS.hatch.x + COLOSSUS.hatch.w + 6) * this.facing;
    this.world.spawn('rifleman', hx, this.y, { entry: 'run', facing: this.facing, grenades: false, tag: 'colossus-crew' });
    yield this.recover(60);
    this.hatchState = 1;
  }

  /** Phase change: a 60-tick intermission (everyone safe, enemy shots fade), the hatch bursts. */
  private rage(): void {
    this.intermission(60);
    const hx = this.x + (COLOSSUS.hatch.x + COLOSSUS.hatch.w / 2) * this.facing;
    explosion(this.world, hx, this.y + COLOSSUS.hatch.y + 8, 's', { debris: 'metal' });
    this.world.camera.shake(4, 24);
    this.hatchState = 1;
    this.aimLocked = false;
  }

  *ragePattern(): ScriptGen {
    yield 60;
    yield* this.cycle([(b) => b.fan(), (b) => b.deploy(), (b) => b.burst(), (b) => b.lob()], 24);
  }

  // ------------------------------------------------------------------------------- damage & death

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/metal', { vol: 0.5 });
    }
    return hit;
  }

  protected override onDeathStart(): void {
    this.hatchState = 2;
    this.aimLocked = true;
    this.charge = 0;
    this.hatchGlow = 0;
  }

  override update(): void {
    super.update();
    // The wreck keeps smoking after the fight.
    if (this.state === 'done' && this.world.tick % 5 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-24, 24), this.y - 50, true);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const flip = this.facing < 0;
    const turret = this.parts[0];
    const body = this.parts[1];
    const wreck = this.state === 'done';
    // Parts flash white for the first 2 of their 4 hit ticks (GDD §10.0).
    bodyOpts.flipX = flip;
    bodyOpts.flash = !wreck && body.flash >= 3;
    r.sprite('boss/crate-colossus/body', wreck ? 2 : this.damageState, x, y, bodyOpts);
    partOpts.flipX = flip;
    partOpts.flash = false;
    if (this.hatchState > 0) r.sprite('boss/crate-colossus/hatch', this.hatchState, x, y, partOpts);
    if (this.hatchGlow > 0 && this.hatchGlow % 6 < 4) {
      const hx = flip ? x - COLOSSUS.hatch.x - COLOSSUS.hatch.w : x + COLOSSUS.hatch.x;
      glowOpts.alpha = 0.35 + 0.25 * ((this.hatchGlow >> 1) % 2);
      r.rect(hx + 2, y + COLOSSUS.hatch.y + 2, COLOSSUS.hatch.w - 4, COLOSSUS.hatch.h - 4, PAL.gold[3], glowOpts);
    }
    partOpts.flash = !wreck && turret.flash >= 3;
    const ty = y + COLOSSUS.roofY;
    r.sprite('boss/crate-colossus/turret', this.turretFrame, x, ty, partOpts);
    if (this.charge > 0 && this.charge % 8 < 4) {
      tintOpts.flipX = flip;
      tintOpts.tint = this.charge % 16 < 8 ? PAL.red[3] : PAL.snow[3];
      r.sprite('boss/crate-colossus/turret', this.turretFrame, x, ty, tintOpts);
    }
    if (wreck) {
      tintOpts.flipX = flip;
      tintOpts.tint = PAL.ink[0];
      r.sprite('boss/crate-colossus/body', 2, x, y, tintOpts);
    }
  }
}

defineEntity('m0-crate-colossus', (w, x, y, p) => new CrateColossus(w, x, y, p), {
  category: 'boss',
  score: 30000,
  description: 'Test boss of m0: a giant crate with a brass turret (2 parts, 2 phases).',
});
