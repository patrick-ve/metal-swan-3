/**
 * Machines sub-area "armor": the shared `Machine` base (an Enemy subclass) for the Legion's
 * machines (GDD §9.2, §9.5).
 *
 * - Not knifeable (`soft: false`); HP scales with difficulty and co-op (`big`: ×0.8 / ×1 / ×1.25,
 *   2 players ×1.25).
 * - Damage states (GDD §9.2 "Shared"): at 50 % HP smoke and a dented plate, at 25 % flames and
 *   sparks (`damageState` 1 / 2; the art swaps to its dented strips, `emitDamage` adds the fx).
 * - Spawn armour: while `armored` is true, shots ping off (sparks + `hit/metal`, absorbed, no
 *   damage). Machines that drive in set it until they stop (GDD §9.2).
 * - Attack tokens and telegraphs (GDD §4.11): `takeToken()` before a telegraph, `releaseToken()`
 *   after the recovery; `tele(base)` scales a telegraph by difficulty and never goes below 18.
 * - Reactions: machines only take SAY CHEESE ('photo'): they hold still for the photo, no attacks.
 * - A looping sound (tread rumble …) runs under `loopKey` and is stopped on removal.
 *
 * Subclasses draw themselves from part strips (`machine/<id>/…`) and override `think()`.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { rectAt } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import { Enemy, everyEnemyReacts, releaseAttackToken, takeAttackToken, telegraphTicks, type EnemyOpts, type ReactionKind } from '../../../enemy';
import { explosion, FX_FLAME, FX_SMOKE, FX_SPARK, type DebrisKind, type ExplosionSize, debris } from '../../../fx';
import type { SpawnParams } from '../../../registry';
import type { RelRect } from './geom';

/** Ticks between two hit sounds of one machine (a machine-gun burst should not buzz). */
const HIT_SFX_GAP = 6;

export abstract class Machine extends Enemy {
  /** 0 = fine, 1 = at most 50 % HP (smoke, dented plate), 2 = at most 25 % (flames, sparks). */
  damageState: 0 | 1 | 2 = 0;
  /** Spawn armour: shots ping off while true. */
  armored = false;
  /** Seen on screen at least once: the AI is running. */
  activated = false;
  /** Holds an attack token (GDD §4.11 rule 4). */
  protected holdsToken = false;
  /** Sound played (throttled) when a hit lands. */
  protected hitSfx = 'hit/metal';
  /** Key of this machine's looping sound (engines, rumbles). */
  readonly loopKey: string;
  private lastHitSfx = -100;
  private looping = false;

  constructor(world: World, x: number, y: number, params: SpawnParams, o: EnemyOpts) {
    super(world, x, y, params, { soft: false, big: true, ...o });
    this.loopKey = `machine-${this.id}`;
  }

  // ------------------------------------------------------------------------------- geometry

  /** A rect relative to the anchor → world space (mirrored when facing left), written to `out`. */
  protected rel(r: RelRect, out: Rect, flip: boolean = this.facing < 0): Rect {
    return rectAt(this.x, this.y, r, flip, out);
  }

  /** World x of an unflipped x offset. */
  protected wx(dx: number): number {
    return this.x + dx * this.facing;
  }

  /** Is a world point inside the view (GDD §4.11 rule 3: 8 px margin)? */
  protected inView(px: number, py: number, margin = -8): boolean {
    return this.world.camera.containsPoint(px, py, margin);
  }

  /** Mark the machine active once it is (nearly) on screen; returns `activated`. */
  protected checkActive(margin = 16): boolean {
    if (!this.activated && this.onScreen(margin)) {
      this.activated = true;
      this.onActivate();
    }
    return this.activated;
  }

  /** Hook: first time on screen. */
  protected onActivate(): void {}

  // ------------------------------------------------------------------------------- fairness

  /** A telegraph length for the difficulty, never below 18 ticks. */
  protected tele(base: number): number {
    return telegraphTicks(this.world, base);
  }

  /** A recovery / cooldown for the difficulty (×1.3 / ×1 / ×0.8). */
  protected recover(base: number): number {
    return Math.max(1, Math.round(base * this.mods.enemyFireInterval));
  }

  protected takeToken(): boolean {
    if (this.holdsToken) return true;
    this.holdsToken = takeAttackToken(this.world, this);
    return this.holdsToken;
  }

  protected releaseToken(): void {
    if (!this.holdsToken) return;
    this.holdsToken = false;
    releaseAttackToken(this.world, this);
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, part = 0): boolean {
    if (!this.alive) return false;
    if (this.armored || this.deflects(d, part)) {
      this.ping(d);
      return true;
    }
    return this.applyDamage(d, part);
  }

  /** Does this part shrug the hit off (armoured parts)? Default: no. */
  protected deflects(_d: Damage, _part: number): boolean {
    return false;
  }

  /** Lose HP (flash, hit sound, damage state), die at 0. Returns true (absorbed). */
  protected applyDamage(d: Damage, _part: number): boolean {
    this.hp -= d.amount;
    this.flashTicks = 4;
    this.hitSound();
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(d);
    } else this.updateDamageState();
    return true;
  }

  /** A shot pings off: sparks where it struck, a metal tink. */
  protected ping(d: Damage): void {
    const s = d.source;
    const x = s ? s.x : this.x;
    const y = s ? s.y : this.y + this.hitbox.y / 2;
    this.world.particles.burst(FX_SPARK, x, y, 4, 1, 2.6, d.dirX > 0 ? Math.PI : 0, 1.8);
    this.hitSound();
  }

  protected hitSound(): void {
    const t = this.world.tick;
    if (t - this.lastHitSfx < HIT_SFX_GAP) return;
    this.lastHitSfx = t;
    this.world.audio.sfx(this.hitSfx, { vol: 0.7 });
  }

  /** Recompute `damageState` from the HP fraction (GDD §9.2: 50 % and 25 %). */
  protected updateDamageState(): void {
    const f = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const s: 0 | 1 | 2 = f <= 0.25 ? 2 : f <= 0.5 ? 1 : 0;
    if (s > this.damageState) {
      this.damageState = s;
      this.onDamageState(s as 1 | 2);
    }
  }

  /** Hook: the damage state went up (a puff of smoke, a pop of sparks). */
  protected onDamageState(s: 1 | 2): void {
    const y = this.y + this.hitbox.y / 2;
    this.world.particles.burst(FX_SMOKE, this.x, y, s === 1 ? 4 : 6, 0.2, 0.8);
    if (s === 2) this.world.particles.burst(FX_SPARK, this.x, y, 8, 1, 3);
  }

  /**
   * Damage-state fx at a world point (call every tick from `update`): smoke from 50 %, flames and
   * sparks from 25 % (cosmetic rng only).
   */
  protected emitDamage(x: number, y: number): void {
    if (this.damageState === 0) return;
    const p = this.world.particles;
    const t = this.age;
    if (t % (this.damageState === 2 ? 5 : 9) === 0) p.emit(FX_SMOKE, x + this.world.fxRng.range(-4, 4), y, this.world.fxRng.range(-0.15, 0.15), -0.35);
    if (this.damageState === 2) {
      if (t % 4 === 0) p.emit(FX_FLAME, x + this.world.fxRng.range(-3, 3), y + 2, 0, -0.5);
      if (t % 37 === 0) p.burst(FX_SPARK, x, y, 5, 0.8, 2.4, -Math.PI / 2, 2);
    }
  }

  /** A harmless death blast (machines never hurt anyone as they die): fireball, debris, shake. */
  protected boom(x: number, y: number, size: ExplosionSize, kind: DebrisKind = 'metal'): void {
    // Team 'enemy' with no damage: hurts nobody and frees no hostage.
    explosion(this.world, x, y, size, { team: 'enemy', damage: 0, debris: null });
    debris(this.world, x, y, kind, size === 'l' || size === 'xl' ? 10 : 6);
  }

  // ------------------------------------------------------------------------------- reactions

  /** Machines only hold still for SAY CHEESE and the in-world continue (`everyEnemyReacts`). */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    return everyEnemyReacts(kind);
  }

  /** A reaction stops any telegraph (no attacks while it runs). */
  protected override onReact(): void {
    this.cancelAttack();
  }

  /** Hold still (no strips to play: machines draw their own parts). */
  protected override thinkReaction(): void {
    this.vx = 0;
  }

  /** Hook: drop a running telegraph or attack (reactions, the view scrolled away). */
  protected cancelAttack(): void {
    this.releaseToken();
  }

  // ------------------------------------------------------------------------------- sound loop

  /** Keep a looping sound running (or stop it). */
  protected loop(id: string | null, vol = 1): void {
    const a = this.world.audio;
    if (id) {
      a.sfxLoop?.(this.loopKey, id, { vol });
      this.looping = true;
    } else if (this.looping) {
      a.stopSfx?.(this.loopKey);
      this.looping = false;
    }
  }

  override onRemove(): void {
    this.releaseToken();
    this.loop(null);
    super.onRemove();
  }
}
