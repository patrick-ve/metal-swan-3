/**
 * `WindSoldier` — the thin layer the wind types (oompah.ts, piccolo.ts, bassoonist.ts) share on
 * top of the infantry `Soldier` (../index.ts). The Soldier base already runs every shared rule of
 * GDD §9.0 / §4.11: entries, gags + the double-take + CAUGHT NAPPING, parade columns and the
 * drummer's stumble, panic (rule 6), the reaction protocol (salute, queue, ears …), attack tokens,
 * telegraph scaling, deaths by damage kind (hat pop, laser notes, burn circle, knife aria).
 *
 * This layer adds:
 * - **Looks:** outfit × skin tone. The skin (`skinA` / `skinB` / `skinC`, GDD §9.0) is picked per
 *   spawn with `world.rng` (or `params.skin`: `a` | `b` | `c`); the art prefix is
 *   `enemy/<type>[-<outfit>][-skin<b|c>]` (looks.ts registers it on first use).
 * - **One attack at a time:** mode `attack` with `beginAttack()` (takes a token, rule 4),
 *   `endAttack(cooldown)` and `cancelAttack()` (a reaction, a panic or the muzzle leaving the view
 *   drops it: the type resets its telegraph in `onAttackCancelled`). The type implements
 *   `thinkCombat()` (positioning, choosing the attack) and `thinkAttack()` (T → A → R).
 * - **Frozen:** while frozen in ice (the sundae-mortar's `freeze`), any hit shatters him, whatever
 *   his HP (GDD §6.3): ice cubes and his surprised head sliding away.
 * - **Death extras:** `die-blast` ends head-first with a poof; `die-crush` peels off the ground
 *   and flutters away like paper; hooks `onDied(d)` and `updateDying()` for the types.
 * - **Drawing:** `drawExtras(r)` over the living body (telegraph shimmers, aim lines).
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { PlayOpts } from '../../../../engine/sprites';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { FxEntity, iceShatter, poof } from '../../../fx';
import type { SpawnParams } from '../../../registry';
import { Soldier, SOLDIER, type SoldierOpts } from '../index';
import { asOutfit, asSkin, ensureLook, lookPrefix, SKINS, type Skin, type WindType } from './looks';

export { SOLDIER };

export interface WindOpts extends Omit<SoldierOpts, 'art'> {
  type: WindType;
}

/** Shared PlayOpts objects, filled per call (state changes never allocate). */
const loopOpts: PlayOpts = {};
const uniform = new Map<number, readonly number[]>();
function frames(ticks: number): readonly number[] {
  let d = uniform.get(ticks);
  if (!d) {
    d = [ticks];
    uniform.set(ticks, d);
  }
  return d;
}

/** PlayOpts: loop a strip at `ticks` per frame (restarts only when it was not playing). */
export function looped(ticks: number): PlayOpts {
  loopOpts.restart = false;
  loopOpts.loop = true;
  loopOpts.frame = 0;
  loopOpts.ticksPerFrame = undefined;
  loopOpts.durations = frames(ticks);
  return loopOpts;
}

export { playHold as still, playOnce as once } from '../index';

export abstract class WindSoldier extends Soldier {
  /** Skin tone of this soldier (part of the art prefix). */
  readonly skin: Skin;
  /** Ticks since death (the Enemy base only counts after the death animation). */
  protected deadT = 0;
  /** He died frozen in ice (shattered): the types skip their own death motion. */
  protected shattered = false;

  constructor(world: World, x: number, y: number, p: SpawnParams, o: WindOpts) {
    // The look is chosen before the base runs: its entry already plays gag / walk strips.
    const skin = asSkin(p.skin) ?? SKINS[world.rng.int(0, SKINS.length - 1)];
    const art = ensureLook(o.type, asOutfit(p.outfit), skin) ?? lookPrefix(o.type);
    super(world, x, y, p, { ...o, art });
    this.skin = skin;
  }

  // ------------------------------------------------------------------------------- combat

  /** Positioning and the attack choice (alerted, no attack running). */
  protected abstract thinkCombat(): void;
  /** The running attack (telegraph → attack → recovery), mode `attack`. */
  protected abstract thinkAttack(): void;
  /** The attack stopped early: reset the type's telegraph state. */
  protected onAttackCancelled(): void {}

  protected fight(): void {
    if (this.mode === 'attack') this.thinkAttack();
    else this.thinkCombat();
  }

  /** Start an attack: needs a token (rule 4); false = keep moving and try again soon. */
  protected beginAttack(): boolean {
    if (!this.takeToken()) {
      this.cool = this.world.rng.int(10, 30);
      return false;
    }
    this.vx = 0;
    this.setMode('attack');
    return true;
  }

  /** The recovery is over: free the token, stand up, wait `cooldown` ticks. */
  protected endAttack(cooldown: number): void {
    this.releaseToken();
    this.setCrouched(false);
    this.cool = Math.max(this.cool, cooldown);
    this.setMode(this.combatMode);
  }

  /** Drop the attack (rule 3 at the shot, a reaction, a panic): free the token, wait a moment. */
  protected override cancelAttack(): void {
    const attacking = this.mode === 'attack';
    super.cancelAttack();
    if (!attacking) return;
    this.onAttackCancelled();
    this.setCrouched(false);
    this.cool = Math.max(this.cool, this.world.rng.int(10, 30));
  }

  /** The nearest player, facing him every 30 ticks (GDD §9.0); idles when nobody is left. */
  protected combatTarget(): Entity | null {
    const t = this.turnToPlayer();
    if (!t) {
      this.vx = 0;
      this.play('idle');
    }
    return t;
  }

  /** Walk toward a goal x (stops within 4 px); true while moving. */
  protected walkTo(goalX: number, speed: number): boolean {
    const dx = goalX - this.x;
    if (Math.abs(dx) <= 4) {
      this.vx = 0;
      return false;
    }
    return this.walk(Math.sign(dx), speed);
  }

  // ------------------------------------------------------------------------------- frozen

  /** Frozen in ice: any player hit shatters him, whatever his HP (GDD §6.3). */
  override onHit(d: Damage, part?: number): boolean {
    if (this.reaction === 'freeze' && this.alive && d.amount > 0 && d.kind !== 'crush') {
      this.hp = 0;
      this.die(d);
      return true;
    }
    return super.onHit(d, part);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    const shatter = this.reaction === 'freeze';
    this.deadT = 0;
    this.shattered = shatter;
    super.onDeath(d);
    if (shatter) {
      // Ice cubes and his surprised head sliding away over the ground.
      const w = this.world;
      iceShatter(w, this.x, this.y - 14, 10);
      if (this.hasAnim('shatter-head')) {
        const fx = FxEntity.spawn(w, { sprite: this.spriteId('shatter-head'), x: this.x, y: this.y, vx: (d.dirX || this.facing) * 1.4, drag: 0.96, life: 50, loop: true, z: 31, flipX: this.facing < 0 });
        fx.vy = 0;
      }
      w.audio.sfx('hit/metal', { pitch: 1.6, vol: 0.6 });
    }
    this.onDied(d);
  }

  /** Hook: type death extras (the oompah's sad bwaaa, the bassoonist's last rocket …). */
  protected onDied(_d: Damage): void {}

  /** Hook: a type's own death motion; true when it handled the tick. */
  protected updateDying(): boolean {
    return false;
  }

  protected override updateDeath(): void {
    this.deadT++;
    if (this.updateDying()) return;
    const d = this.killedBy;
    if (d?.kind === 'explosion' && this.playing('die-blast') && this.anim.done && this.deadT > 20) {
      // Head-first in the ground, legs kicked: poof.
      poof(this.world, this.x, this.y - 8);
      this.remove();
      return;
    }
    if (d?.kind === 'crush' && this.playing('die-crush') && this.anim.index >= 2) {
      // Peels off the ground and flutters away like a sheet of paper.
      if (this.body) this.body.collide = false;
      this.vy = -0.45;
      this.vx = Math.sin(this.deadT / 6) * 0.8;
      this.x += this.vx;
      this.y += this.vy;
      this.anim.update();
      if (this.anim.done || this.deadT > 90) this.remove();
      return;
    }
    super.updateDeath();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    if (!this.dead) this.drawExtras(r);
  }

  /** Telegraph marks, aim lines … drawn over the living body. */
  protected drawExtras(_r: Renderer): void {}
}
