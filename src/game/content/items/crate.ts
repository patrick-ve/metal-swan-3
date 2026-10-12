/**
 * The breakable supply crate (GDD §7.1, §14.3): 24×20, 30 HP (three pistol shots; any knife or
 * explosion breaks it at once), 100 points, breaks into planks and drops its `contains` (else a
 * roll of the `crate` table).
 *
 * Params: `contains` (aliases `contents`, `drop`; any drop value, see drops.ts), `hp` (30),
 * `variant` ('supply' = the Task Force crate with a white swan stencil, the default; 'legion' =
 * a captured crimson Legion crate), `chute` (true: it floats down under a small parachute — the
 * continue crate and arena rewards dropped from above the view).
 */
import { Entity, type Damage } from '../../../engine/entity';
import { Body, moveBody } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { Animator, hasSprite } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { awardScore } from '../../events';
import { debris, FxEntity } from '../../fx';
import { NO_PARAMS, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';
import { contentsSpecs, spawnDrops } from './drops';

/** Points for breaking a crate (GDD §14.3). */
export const CRATE_SCORE = 100;
/** A parachuting crate falls at this speed (px/tick). */
const CHUTE_FALL = 0.7;

export type CrateVariant = 'supply' | 'legion';

const crateDraw: DrawOpts = {};
const chuteDraw: DrawOpts = {};

/**
 * Team 'enemy' so player shots, blasts and the knife hit it ('soft' = knifeable), but it is not
 * an enemy: no 'enemy' tag, so it never counts as a kill and never holds a wave. It does not
 * block movement. Tagged 'crate' and 'cover' (riflemen hide behind it).
 */
export class Crate extends Entity {
  readonly anim = new Animator();
  readonly params: SpawnParams;
  /** What it drops (resolved when it breaks, so `auto` rolls happen at that moment). */
  readonly contains: unknown;
  readonly variant: CrateVariant;
  /** Sprite prefix: 'item/crate' or 'item/crate-legion'. */
  readonly art: string;
  broken = false;
  /** Still hanging under its parachute. */
  chute: boolean;
  private hitTicks = 0;
  private brokenTicks = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.params = params;
    this.contains = params.contains ?? params.contents ?? params.drop;
    this.variant = paramStr(params, 'variant', 'supply') === 'legion' ? 'legion' : 'supply';
    this.art = this.variant === 'legion' ? 'item/crate-legion' : 'item/crate';
    this.chute = paramBool(params, 'chute', false);
    this.team = 'enemy';
    this.z = 22;
    this.hp = this.maxHp = paramNum(params, 'hp', 30);
    this.hitbox = { x: -12, y: -20, w: 24, h: 20 };
    this.body = new Body({ w: 22, h: 18, groundFriction: 0.8 });
    if (this.chute) this.body.maxFall = CHUTE_FALL;
    this.despawnMargin = 200;
    this.addTag('shootable', 'soft', 'crate', 'cover');
    this.anim.play(this.sprite(''));
  }

  private sprite(suffix: string): string {
    const id = this.art + suffix;
    return hasSprite(id) || this.art === 'item/crate' ? id : 'item/crate' + suffix;
  }

  override onHit(d: Damage): boolean {
    if (this.broken) return false;
    // Any knife or explosion breaks it at once (GDD §7.1); other hits chip its 30 HP.
    this.hp -= d.kind === 'knife' || d.kind === 'explosion' ? this.hp : d.amount;
    this.flashTicks = 3;
    if (this.hp <= 0) this.die(d);
    else {
      this.hitTicks = 8;
      this.anim.play(this.sprite('-hit'), { restart: true, loop: false });
      if (d.kind === 'bullet') this.world.audio.sfx('hit/ground', { vol: 0.6 });
    }
    return true;
  }

  /** Break apart: planks, sound, 100 points, and the contents pop out. */
  override die(d?: Damage): void {
    if (this.broken) return;
    this.broken = true;
    this.dead = true;
    this.removeTag('cover');
    if (this.chute) this.dropChute();
    this.anim.play(this.sprite('-break'), { restart: true, loop: false });
    this.world.audio.sfx('item/crate-break');
    debris(this.world, this.x, this.y - 10, 'wood', 8);
    awardScore(this.world, d?.owner, CRATE_SCORE, this.x, this.y - 24);
    spawnDrops(this.world, contentsSpecs(this.contains, this.world, 'crate'), this.x, this.y - 6);
  }

  /** The parachute folds away (landed or shot down). */
  private dropChute(): void {
    this.chute = false;
    if (this.body) this.body.maxFall = 4;
    FxEntity.spawn(this.world, { sprite: 'item/crate-chute-fold', x: this.x, y: this.y - 20, vx: this.facing * 0.2, vy: 0.3, ticksPerFrame: 6, life: 30, z: this.z - 1 });
  }

  override update(): void {
    if (this.body) {
      const c = moveBody(this, this.world.terrain, this.world);
      if (this.chute) {
        // A gentle sway under the canopy until it lands.
        this.vx = Math.sin(this.age * 0.06) * 0.25;
        if (c.onGround) {
          this.vx = 0;
          this.dropChute();
        }
      }
    }
    this.anim.update();
    if (this.broken) {
      if (this.anim.done || ++this.brokenTicks > 60) this.remove();
      return;
    }
    if (this.hitTicks > 0 && --this.hitTicks === 0) this.anim.play(this.sprite(''));
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.chute && !this.broken) {
      chuteDraw.flipX = false;
      r.sprite('item/crate-chute', Math.floor(this.age / 10) % 2, x, y - 20, chuteDraw);
    }
    crateDraw.flash = this.flashTicks > 0 && !this.broken;
    r.sprite(this.anim.id, this.anim.index, x, y, crateDraw);
  }

  override onOutOfWorld(): void {
    this.remove();
  }
}
