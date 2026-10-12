/**
 * `bassoonist` — the Bassoon Bazooka (GDD §9.1): goggles, padded ear-muffs (the only Legion
 * soldier who protects his ears: he ignores HONK's `ears` reaction) and a long wooden
 * bassoon-launcher with a curly brass crook. 40 HP, 600 points.
 *
 * - **Anti-vehicle:** targets a driven player vehicle first when one is on screen; keeps
 *   120–220 px away.
 * - **Rocket:** T 40 (kneels and aims, rising reed squeak `enemy/bassoon-aim`; the aim follows
 *   the target in 22.5° steps between 45° up and 45° down and holds still for the last 12
 *   ticks) → A a `bassoon-rocket` that starts at 1.0 px/tick and accelerates +0.1/tick to
 *   3.5 px/tick in a straight line; 10 HP (shoot it down for 50); blast r 12 → R 90.
 * - **Death:** his last rocket goes straight up and lands on his own head 30 ticks later
 *   (visual: no damage).
 * - **Gag:** `reed` (licks the reed, tests it, it squeaks, he frowns at it), or `nap`.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { Renderer } from '../../../../engine/render';
import { hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import type { ReactionKind } from '../../../enemy';
import { explosion, FxEntity, poof, smokeTrail } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { Vehicle } from '../../../vehicle';
import { looped, still, WindSoldier } from './soldier';

/** Bassoon Bazooka numbers (GDD §9.1; NORMAL, scaled by difficulty in code). */
export const BASSOON = {
  hp: 40,
  score: 600,
  walk: 0.6,
  minRange: 120,
  maxRange: 220,
  /** Fires at targets up to this far away (px). */
  reach: 260,
  /** T 40 (the last `lock` ticks hold still) → A → R 90 (the first `fireTicks` show the shot). */
  aim: 40,
  lock: 12,
  reload: 90,
  fireTicks: 10,
  /** Pause after the reload before the next telegraph (GDD silent; jittered ±20). */
  cooldown: 40,
  /** Aim directions (degrees, + = down; frames of `aim` / `fire`). */
  angles: [-45, -22.5, 0, 22.5, 45] as readonly number[],
  rocket: { v0: 1.0, accel: 0.1, vMax: 3.5, hp: 10, score: 50, damage: 10, blastR: 12, life: 300 },
  /** The death gag: the rocket rises and falls back onto his head after this many ticks. */
  lastRocket: 30,
} as const;

export const BASSOON_GAGS: readonly string[] = ['reed', 'nap'];

type Phase = 'aim' | 'fire' | 'reload';

const DEG = Math.PI / 180;
const muzzle: [number, number] = [0, 0];

export class Bassoonist extends WindSoldier {
  phase: Phase = 'aim';
  /** Aim direction index into BASSOON.angles. */
  aimIndex = 2;
  telegraph: number = BASSOON.aim;
  /** The target of the running attack (a player vehicle first). */
  private aimTarget: Entity | null = null;
  private recoverT: number = BASSOON.reload;
  private readonly prefRange: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { type: 'bassoonist', hp: BASSOON.hp, w: 14, h: 28, crouchH: 24, walk: BASSOON.walk, gags: BASSOON_GAGS, hatY: 34 });
    this.prefRange = paramNum(p, 'range', world.rng.int(140, 200));
  }

  /** Anti-vehicle: a driven player vehicle on screen, else the nearest player. */
  pickTarget(): Entity | null {
    const list = this.world.byTag('vehicle');
    let best: Entity | null = null;
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v.alive || !(v instanceof Vehicle) || !v.driver || !v.onScreen(0)) continue;
      const d = Math.abs(v.x - this.x);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best ?? this.target();
  }

  /** The target's centre (world). */
  private aimY(t: Entity): number {
    return t.y + t.hitbox.y + t.hitbox.h * 0.5;
  }

  /** Nearest aim step toward the target (clamped to ±45°). */
  private aimStep(t: Entity): number {
    this.point('muzzle', 14, -20, muzzle);
    const dx = Math.abs(t.x - this.x) || 1;
    const rel = Math.atan2(this.aimY(t) - muzzle[1], dx) / DEG;
    let best = 0;
    for (let i = 1; i < BASSOON.angles.length; i++) {
      if (Math.abs(BASSOON.angles[i] - rel) < Math.abs(BASSOON.angles[best] - rel)) best = i;
    }
    return best;
  }

  private muzzleInView(): boolean {
    this.point('muzzle', 14, -20, muzzle);
    return this.onScreenAt(muzzle[0], muzzle[1]);
  }

  // ------------------------------------------------------------------------------- combat

  protected override thinkCombat(): void {
    const near = this.combatTarget();
    if (!near) return;
    const t = this.pickTarget() ?? near;
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    if (this.cool <= 0 && dist <= BASSOON.reach && this.body?.onGround && t.onScreen(0)) {
      this.facing = dx < 0 ? -1 : 1;
      if (this.muzzleInView() && this.beginAttack()) return this.startAim(t);
    }
    // Keep 120–220 px away (the preferred range in between).
    let goal = this.x;
    if (dist > BASSOON.maxRange || dist < BASSOON.minRange) goal = t.x - Math.sign(dx) * this.prefRange;
    goal = this.clampToView(goal);
    if (Math.abs(goal - this.x) > 4 && this.walkTo(goal, this.walkSpeed)) {
      this.play('walk');
      return;
    }
    this.facing = dx < 0 ? -1 : 1;
    this.play('idle');
  }

  private startAim(t: Entity): void {
    this.aimTarget = t;
    this.phase = 'aim';
    this.setCrouched(true);
    this.telegraph = this.tele(BASSOON.aim);
    this.aimIndex = this.aimStep(t);
    this.play('aim', still(this.aimIndex));
    this.world.audio.sfx('enemy/bassoon-aim');
  }

  protected override thinkAttack(): void {
    this.vx = 0;
    if (this.phase === 'aim') {
      const t = this.aimTarget;
      // The aim follows the target in 22.5° steps, then holds for the last 12 ticks.
      if (t && t.alive && this.modeT < this.telegraph - BASSOON.lock && this.modeT % 6 === 0) this.aimIndex = this.aimStep(t);
      this.play('aim', still(this.aimIndex));
      if (this.modeT < this.telegraph) return;
      // Rule 3 at the shot.
      if (!this.muzzleInView()) return this.cancelAttack();
      this.fire();
      this.phase = 'fire';
      this.modeT = 0;
      this.play('fire', still(this.aimIndex));
      return;
    }
    if (this.phase === 'fire') {
      if (this.modeT >= BASSOON.fireTicks) {
        this.phase = 'reload';
        this.recoverT = this.recovery(BASSOON.reload) - BASSOON.fireTicks;
        this.modeT = 0;
        this.play('reload', looped(10));
      }
      return;
    }
    if (this.modeT >= this.recoverT) {
      this.phase = 'aim';
      this.aimTarget = null;
      this.endAttack(this.fireInterval(BASSOON.cooldown, 20));
    }
  }

  private fire(): void {
    this.point('muzzle', 14, -20, muzzle);
    const a = BASSOON.angles[this.aimIndex] * DEG;
    const angle = this.facing > 0 ? a : Math.PI - a;
    BassoonRocket.fire(this.world, muzzle[0], muzzle[1], angle, this.mods.enemyBulletSpeed, this);
    this.world.audio.sfx('weapon/rocket', { vol: 0.8, pitch: 0.85 });
    this.world.particles.smoke(muzzle[0], muzzle[1], 2);
    // Back-blast out of the crook end.
    poof(this.world, this.x - this.facing * 12, this.y - 20);
  }

  protected override onAttackCancelled(): void {
    this.phase = 'aim';
    this.aimTarget = null;
  }

  // ------------------------------------------------------------------------------- reactions

  /** Ear-muffs: HONK does not make him cover his ears. */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    if (kind === 'ears') return false;
    return super.acceptsReaction(kind);
  }

  // ------------------------------------------------------------------------------- gags

  protected override gagThink(): void {
    // The reed squeaks on the test frame.
    if (this.gagName === 'reed' && this.anim.changed && this.anim.index === 3 && this.onScreen(0)) {
      this.world.audio.sfx('enemy/bassoon-aim', { vol: 0.3, pitch: 1.4 });
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDied(_d: Damage): void {
    this.aimTarget = null;
    this.phase = 'aim';
    const w = this.world;
    // His last rocket goes straight up … and comes down on his own head 30 ticks later.
    const x = this.x;
    const top = this.y - 30;
    const head = this.y - 26;
    if (hasSprite('enemy/winds/last-rocket')) {
      const g = 0.27;
      FxEntity.spawn(w, { sprite: 'enemy/winds/last-rocket', x, y: top, vy: -(g * BASSOON.lastRocket) / 2, gravity: g, ticksPerFrame: BASSOON.lastRocket / 2, life: BASSOON.lastRocket, z: 61 });
    }
    w.audio.sfx('weapon/rocket', { vol: 0.5, pitch: 1.2 });
    w.scripts.run(bonk(w, x, head));
  }

  protected override drawExtras(r: Renderer): void {
    // The telegraph: a reed-squeak shimmer on the kneeling soldier (every 8 ticks).
    if (this.mode === 'attack' && this.phase === 'aim' && this.modeT % 8 < 3) this.drawTint(r, PAL.gold[3], 0.25);
  }
}

defineEntity('bassoonist', (w, x, y, p) => new Bassoonist(w, x, y, p), {
  category: 'enemy',
  score: BASSOON.score,
  description: 'Bassoon Bazooka: anti-vehicle; kneels and fires an accelerating rocket (shoot it down).',
});

/** The death gag's landing: a harmless puff of a blast on his head and a CLONK. */
function* bonk(world: World, x: number, y: number): Generator<number, void, unknown> {
  yield BASSOON.lastRocket;
  explosion(world, x, y, 's', { damage: 0, team: 'enemy', silent: true, shake: 0 });
  world.audio.sfx('enemy/fumble');
}

// ---------------------------------------------------------------------------------------------
// Projectile
// ---------------------------------------------------------------------------------------------

const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };

/**
 * `bassoon-rocket` — flies straight, 1.0 → +0.1/tick → 3.5 px/tick (× the difficulty's shot
 * speed). Hits explode (r 12); shot down (10 HP) it pops harmlessly for 50 points.
 */
export class BassoonRocket extends Projectile {
  speed = 1;
  private dirX = 1;
  private dirY = 0;
  private mul = 1;

  constructor(world: World) {
    super(world);
  }

  static fire(world: World, x: number, y: number, angle: number, speedMul = 1, shooter: Entity | null = null): BassoonRocket {
    const R = BASSOON.rocket;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    shot.x = x;
    shot.y = y;
    shot.vx = dx * R.v0 * speedMul;
    shot.vy = dy * R.v0 * speedMul;
    shot.damage = R.damage;
    shot.kind = 'explosion';
    shot.life = R.life;
    shot.w = 6;
    shot.h = 6;
    shot.sprite = 'enemy/bassoon-rocket';
    shot.look = 'angle';
    shot.impact = 'none';
    shot.shootable = true;
    shot.hp = R.hp;
    shot.score = R.score;
    shot.offscreen = 32;
    shot.shooter = shooter;
    shot.type = 'bassoon-rocket';
    const p = BassoonRocket.spawn(world, shot);
    shot.shooter = null;
    p.dirX = dx;
    p.dirY = dy;
    p.mul = speedMul;
    p.speed = R.v0;
    return p;
  }

  override update(): void {
    const R = BASSOON.rocket;
    this.speed = Math.min(R.vMax, this.speed + R.accel);
    this.vx = this.dirX * this.speed * this.mul;
    this.vy = this.dirY * this.speed * this.mul;
    if ((this.t & 3) === 0) smokeTrail(this.world, this.x - this.dirX * 6, this.y - this.dirY * 6);
    super.update();
  }

  /** Hit a player, a vehicle or the terrain: a small blast (r 12). */
  override onImpact(target: Entity | null, x: number, y: number): void {
    explosion(this.world, x, y, 's', { damage: BASSOON.rocket.damage, team: 'enemy', radius: BASSOON.rocket.blastR, falloff: 0, exclude: target, shake: 1 });
    super.onImpact(target, x, y);
  }

  /** Shot down: a harmless pop (the base pays the 50 points). */
  override die(d?: Damage): void {
    if (this.dead) return;
    explosion(this.world, this.x, this.y, 's', { damage: 0, team: 'enemy', shake: 0 });
    super.die(d);
  }

  /** Out of fuel: it fizzles. */
  override expire(): void {
    if (!this.removed && !this.dead) poof(this.world, this.x, this.y);
    this.remove();
  }
}

defineEntity('bassoon-rocket', (w, x, y, p) => BassoonRocket.fire(w, x, y - 20, paramFacing(p, -1) > 0 ? 0 : Math.PI), {
  category: 'projectile',
  description: 'Bassoon rocket: 1.0 → +0.1/tick → 3.5 px/tick, straight; 10 HP (50 when shot down); blast r 12.',
});
