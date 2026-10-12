/**
 * `windup-bot` — the Wind-Up Bandbot (docs/GAME_DESIGN.md §9.3; m1–m5). 20 HP, 100 points.
 * Tin toys that march in lines of 3–6 at 0.8 px/tick, all in step (the march frame comes from the
 * world tick), walk off ledges and keep marching, turn at walls, and dance in place during the
 * anthem (reaction 'dance'). Contact kills only when one explodes.
 *
 * - Self-destruct (a player within 24 px): T 30 (it stops, the key spins fast, it shakes; rising
 *   ratchet `creature/windup`) → it explodes, r 16, and is gone (no points). It can be shot during
 *   the telegraph: then it just breaks (springs and cogs, the key flies off).
 * - Variants (`params.variant`): `walk` (default), `ski` (m3: tiny skis, 1.6 px/tick; 0.8 uphill),
 *   `fly` (m5: a propeller key, flies straight at 1.5 px/tick, contact kills, no self-destruct;
 *   touching a player vehicle destroys it and costs the vehicle ½ cell, GDD §8.5).
 * - STRIKE! +1,000 (GDD §14.2): 6 bandbots crushed by one player's vehicle in one run (each crush
 *   within 120 ticks of the last). Counted here, from the bots' own crush deaths.
 *
 * Params: `variant`, `facing` (default: toward the nearest player), `enter` / `entry`, plus the
 * Enemy params `hp`, `drop`, `tag`.
 * Our choices: the ski speed on flat ground is the downhill 1.6 (uphill 0.8); explosion damage 30.
 */
import type { Damage, Entity } from '../../../engine/entity';
import type { ParticlePreset } from '../../../engine/particles';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { awardScore } from '../../events';
import { debris, explosion, FxEntity } from '../../fx';
import { defineEntity, paramFacing, paramStr, type SpawnParams } from '../../registry';
import type { ReactionKind } from '../../enemy';
import { Creature, contactHit, held, once, slotOf } from './common';

/** Bandbot numbers (GDD §9.3; NORMAL). */
export const WINDUP = {
  hp: 20,
  score: 100,
  w: 12,
  h: 16,
  march: 0.8,
  ski: 1.6,
  skiUphill: 0.8,
  fly: 1.5,
  /** Self-destruct when a player is this close (px, both axes). */
  trigger: 24,
  tele: 30,
  blastR: 16,
  blastDamage: 30,
  /** Ticks per march frame: every bot reads the world tick, so a line marches in step. */
  beat: 8,
  /** STRIKE!: crushes in one run, ticks allowed between two of them, bonus. */
  strikeCount: 6,
  strikeGap: 120,
  strikeBonus: 1000,
} as const;

export type BotVariant = 'walk' | 'ski' | 'fly';
const A = 'creature/windup-bot';

/** Cogs that pop out of a broken bandbot (sprite particles; cosmetic rng). */
const COGS: ParticlePreset = {
  kind: 'sprite',
  sprite: `${A}/cog`,
  randomFrames: 2,
  randomFlip: true,
  life: [36, 56],
  gravity: 0.2,
  ground: 'bounce',
  bounce: 0.4,
  friction: 0.6,
  fadeFrom: 0.8,
};

/** STRIKE! tally per world and player slot: crushes in the current run and the last crush tick. */
const strikes = new WeakMap<World, Array<{ n: number; tick: number; vehicle: Entity | null }>>();

function strikeTally(world: World, slot: number): { n: number; tick: number; vehicle: Entity | null } {
  let list = strikes.get(world);
  if (!list) {
    list = [
      { n: 0, tick: -1e9, vehicle: null },
      { n: 0, tick: -1e9, vehicle: null },
    ];
    strikes.set(world, list);
  }
  return list[slot];
}

export class WindupBot extends Creature {
  readonly variant: BotVariant;
  private telegraph: number = WINDUP.tele;
  private readonly touch: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const v = paramStr(p, 'variant', 'walk');
    const variant: BotVariant = v === 'ski' || v === 'fly' ? v : 'walk';
    super(world, x, y, p, { art: A, hp: WINDUP.hp, w: WINDUP.w, h: WINDUP.h, body: variant !== 'fly' });
    this.variant = variant;
    if (variant !== 'fly') this.clampToSection();
    this.touch = contactHit(this, 'bullet');
    const t = world.nearestPlayer(this.x, this.y);
    const enter = p.enter;
    const toward: 1 | -1 = enter === 'left' ? 1 : enter === 'right' ? -1 : t && t.x < this.x ? -1 : 1;
    this.facing = paramFacing(p, toward);
    this.alerted = true;
    this.setMode(variant === 'fly' ? 'fly' : 'march');
    if (this.body) this.body.stepUp = 6;
  }

  private get speed(): number {
    if (this.variant === 'fly') return WINDUP.fly;
    if (this.variant === 'walk') return WINDUP.march;
    // Skis: fast on flats and downhill, a marching pace uphill.
    const slope = this.body?.onGround ? this.body.slope : 0;
    return slope * this.facing < -0.08 ? WINDUP.skiUphill : WINDUP.ski;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.mode === 'fly') return this.thinkFly();
    if (this.mode === 'tell') return this.thinkTell();
    this.contactDamage = null;
    // March: constant speed, turn at walls and at the section edges, walk off ledges.
    const b = this.body;
    if (b?.contact.hitWall && b.contact.wallDir === this.facing) this.turn();
    const tb = this.world.terrain.bounds;
    if ((this.facing < 0 && this.x < tb.x + 8) || (this.facing > 0 && this.x > tb.x + tb.w - 8)) this.turn();
    this.vx = this.facing * this.speed;
    this.marchFrame(this.variant === 'ski' ? 'ski' : 'walk', this.variant === 'ski' ? 10 : WINDUP.beat);
    if (b?.onGround && this.playerClose() && this.onScreen(-8) && this.takeToken()) this.startTell();
  }

  private turn(): void {
    this.facing = this.facing > 0 ? -1 : 1;
  }

  /** Strip frame from the world tick: every bot in a line steps at the same moment. */
  private marchFrame(name: string, beat: number): void {
    this.play(name, held());
    this.anim.index = Math.floor(this.world.tick / beat) % this.anim.frameCount;
  }

  private playerClose(): boolean {
    const players = this.world.byTag('player');
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.alive && Math.abs(p.x - this.x) <= WINDUP.trigger && Math.abs(p.y - this.y) <= WINDUP.trigger) return true;
    }
    return false;
  }

  private startTell(): void {
    this.vx = 0;
    this.telegraph = this.tele(WINDUP.tele);
    this.setMode('tell');
    this.play(this.variant === 'ski' ? 'ski-tell' : 'tell', { restart: true, loop: true });
    this.world.audio.sfx('creature/windup');
  }

  private thinkTell(): void {
    this.vx = 0;
    this.contactDamage = null;
    if (this.modeT < this.telegraph) return;
    // Rule 3: it never bursts outside the view (then it shrugs and marches on).
    if (!this.onScreen(-8)) return this.cancelAttack();
    this.selfDestruct();
  }

  /** The bang: an enemy explosion r 16, the key flies off, the bot is gone (nobody scores). */
  selfDestruct(): void {
    const w = this.world;
    explosion(w, this.x, this.y - 8, 's', { damage: WINDUP.blastDamage, team: 'enemy', radius: WINDUP.blastR, source: this, debris: null });
    this.flingKey(this.facing > 0 ? -1 : 1);
    debris(w, this.x, this.y - 8, 'metal', 5);
    this.releaseToken();
    this.contactDamage = null;
    this.dead = true;
    this.remove();
  }

  private thinkFly(): void {
    // Straight flight; the propeller key hums. Contact kills (a small creature: ½ vehicle cell).
    this.vx = this.facing * WINDUP.fly;
    this.vy = 0;
    this.x += this.vx;
    this.play('fly');
    this.touch.dirX = this.facing;
    this.contactDamage = this.touch;
    this.breakOnVehicle(this.touch);
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    if (this.mode === 'tell') this.setMode('march');
  }

  // ------------------------------------------------------------------------------- reactions

  /** Bandbots on foot dance to the anthem; every bot poses for SAY CHEESE. */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    if (kind === 'dance') return this.variant !== 'fly';
    return super.acceptsReaction(kind);
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'dance') {
      this.vx = 0;
      this.marchFrame('dance', WINDUP.beat);
      return;
    }
    super.thinkReaction(kind);
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    const w = this.world;
    this.corpseTicks = 16;
    if (this.variant === 'fly' && d.kind !== 'explosion' && d.kind !== 'fire') {
      this.play('fly-die', once());
      this.vy = -1;
    }
    w.audio.sfx('hit/metal');
    if (d.kind === 'bullet' || d.kind === 'laser' || d.kind === 'impact' || d.kind === 'knife') {
      // Springs and cogs pop out; the key flies off spinning.
      this.flingKey(d.dirX ? (d.dirX > 0 ? 1 : -1) : this.facing > 0 ? -1 : 1);
      for (let i = 0; i < 3; i++) w.particles.emit(COGS, this.x, this.y - 12, w.fxRng.range(-1.4, 1.4), w.fxRng.range(-3, -1.5));
    }
    if (d.kind === 'crush') this.countStrike(d);
  }

  /** Flyers that die drop out of the sky (no body: fall by hand). */
  protected override updateDeath(): void {
    if (!this.body) {
      this.vy = Math.min(this.vy + 0.18, 4);
      this.y += this.vy;
      this.x += this.vx * 0.5;
    }
    super.updateDeath();
  }

  private flingKey(dir: number): void {
    FxEntity.spawn(this.world, { sprite: `${A}/key`, x: this.x - this.facing * 8, y: this.y - 12, vx: dir * 1.2, vy: -3.2, gravity: 0.18, loop: true, life: 48, z: 31 });
  }

  /** STRIKE!: 6 bandbots crushed by one player's vehicle, each within 120 ticks of the last. */
  private countStrike(d: Damage): void {
    const src = d.source ?? null;
    const vehicle = src && src.hasTag('vehicle') ? src : null;
    const slot = d.owner === 0 || d.owner === 1 ? d.owner : vehicle ? slotOf(vehicle) : -1;
    if (slot !== 0 && slot !== 1) return;
    const w = this.world;
    const s = strikeTally(w, slot);
    if (w.tick - s.tick > WINDUP.strikeGap || (vehicle && s.vehicle && s.vehicle !== vehicle)) s.n = 0;
    s.n++;
    s.tick = w.tick;
    s.vehicle = vehicle;
    if (s.n === WINDUP.strikeCount) {
      awardScore(w, slot, WINDUP.strikeBonus, this.x, this.y - 40);
      hudOf(w).callout(`STRIKE! +${WINDUP.strikeBonus}`);
    }
  }
}

defineEntity('windup-bot', (w, x, y, p) => new WindupBot(w, x, y, p), {
  category: 'enemy',
  score: WINDUP.score,
  description: 'Wind-Up Bandbot: marches in step, self-destructs up close (variant walk | ski | fly).',
});
