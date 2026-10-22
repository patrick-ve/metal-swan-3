/**
 * The shared rules of the ring gangs ON FOOT (docs/design/ring.md §R.5; GDD §4.11 fairness): the
 * base `FootGang` (a `Creature`: attack tokens from the tell to the end of the recovery, tells of
 * at least 18 ticks scaled by difficulty, nothing attacks from outside the view, reactions cancel
 * the attack). Subclasses (kinds.ts) choose and run their attacks through four hooks.
 *
 * - Walk: in from the side (`enter`), turn with a `Turner` (hysteresis + the 2-frame turn strip),
 *   close to `hold` px of the nearest hero, never off the own floor (a car roof is a floor: they
 *   stop at its edge), then stand.
 * - Attack: when the cool-down ends, `choose(target, dist)` names an attack (or null); with a token
 *   and the hand in view the `tell-…` strip plays for `tele(base)` ticks (≥ 18, with its sound and
 *   maybe a Dutch bubble), then `strike(kind)` (the shot / the throw / the swing), the attack strip,
 *   a recovery, a cool-down (`fireInterval`).
 * - Hit (not in a tell / attack): the `hit` strip for 8 ticks, a small push back.
 * - The bloodless end (spec §R.5, mechanics §23): the `die` strip (a stagger, the knees go, a roll
 *   onto the backside, sitting), sitting dazed (`dazed`, `GANG.dazed` ticks, the stars warble), then
 *   he gets up and runs off out of the view (`run`, arms up). Not a target from the hit on
 *   (`dead`); `waitClear` does not wait for the run.
 * - The in-world continue: `gloat` (the kind's own quiet business; one Dutch line, never a laugh or
 *   a point) and `cower` (the Enemy defaults with the kind's strips).
 *
 * Params: `enter` / `entry` ('left' / 'right'), `facing`, `hold` (px), `hp`, `drop`, `tag` (the
 * Enemy params), `gag` (the courier's NIET THUIS card), `wait` (ticks standing before the first
 * attack).
 */
import type { Damage } from '../../../../../engine/entity';
import { strideRate } from '../../../../../engine/math';
import { jump } from '../../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../../engine/render';
import type { World } from '../../../../../engine/world';
import { hudOf } from '../../../../context';
import type { ReactionKind } from '../../../../enemy';
import { dust } from '../../../../fx';
import { paramNum, type SpawnParams } from '../../../../registry';
import { Creature, entryParam, Turner } from '../../../creatures/common';

/** Shared numbers (NORMAL; ticks, px, px/tick). */
export const GANG = {
  /** Ticks of the `hit` strip. */
  hitTicks: 8,
  /** The push back of a hit (px/tick, decays). */
  hitPush: 0.6,
  /** Sitting dazed after the roll, then the run-off speed. */
  dazed: 70,
  flee: 1.9,
  /** The run-off ends this long after it started even when still in view (safety). */
  fleeMax: 360,
  /** The highest block a walker hops over (px). */
  hop: 22,
  /** The vertical reach of a ground attack (px between the feet). */
  dy: 40,
} as const;

/** The tuning of one kind (kinds.ts). */
export interface GangSpec {
  hp: number;
  score: number;
  walk: number;
  /** Stand this far from the hero (px). */
  hold: number;
  /** The longest attack range (px). */
  range: number;
  /** The recovery after an attack and the cool-down (base, jitter). */
  recover: number;
  cool: number;
  coolJitter: number;
  w?: number;
  h?: number;
}

const turnOpts: DrawOpts = {};

export abstract class FootGang extends Creature {
  protected override fineDraw = true;
  readonly spec: GangSpec;
  /** The attack being told / struck ('' = none). */
  attack = '';
  /** The tell's length of the running attack (ticks; ≥ 18). */
  telegraph = 24;
  protected cool: number;
  protected readonly hold: number;
  protected readonly turner: Turner;
  private turnId = '';
  private hitT = 0;
  /** The bloodless end: 'roll' (the die strip), 'dazed', 'flee'. */
  endPhase: 'roll' | 'dazed' | 'flee' = 'roll';
  private endT = 0;
  private fleeDir: 1 | -1 = 1;

  constructor(world: World, x: number, y: number, p: SpawnParams, art: string, spec: GangSpec) {
    super(world, x, y, p, { art, hp: spec.hp, w: spec.w ?? 14, h: spec.h ?? 30, score: spec.score });
    this.spec = spec;
    this.hold = paramNum(p, 'hold', spec.hold);
    this.cool = paramNum(p, 'wait', world.rng.int(24, 60));
    this.alerted = true;
    const entry = entryParam(p);
    if (entry === 'left') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else if (p.facing === 1 || p.facing === -1) this.facing = p.facing;
    else this.facePlayer();
    this.turner = new Turner(this.facing, 2, 2);
    this.setMode('walk');
    this.play('idle');
  }

  // ------------------------------------------------------------------------------- hooks

  /** The attack to start now at this target and distance, or null (keep walking). */
  protected abstract choose(t: { x: number; y: number }, dist: number): string | null;
  /** The tell's base length, sound and bubble (the strip is `tell-<kind>`). */
  protected abstract tellOf(kind: string): { ticks: number; sfx: string; say?: string };
  /** The attack happens (spawn the shot / the throw / the swing's hit). */
  protected abstract strike(kind: string): void;
  /** The attack strip and how long it holds the stand. */
  protected abstract strikeOf(kind: string): { strip: string; ticks: number };
  /** Each tick of the attack (a swing's hit box). */
  protected during(_kind: string, _t: number): void {}

  // ------------------------------------------------------------------------------- AI

  /** The throwing / shooting hand is inside the view (rule 3). */
  protected handInView(): boolean {
    return this.inView(this.x + this.facing * 10, this.y - 24, -8);
  }

  protected override think(): void {
    this.modeT++;
    if (this.hitT > 0) {
      this.hitT--;
      this.vx *= 0.8;
      if (this.hitT === 0 && this.mode === 'walk') this.play('idle');
      return;
    }
    switch (this.mode) {
      case 'gag':
        return this.thinkGag();
      case 'notice':
        if (this.thinkNotice()) this.setMode('walk');
        return;
      case 'walk':
        return this.thinkWalk();
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.handInView() || !this.target()) return this.cancelAttack();
        this.facePlayer();
        this.turner.snap(this.facing);
        this.strike(this.attack);
        this.setMode('attack');
        this.play(this.strikeOf(this.attack).strip, { restart: true, loop: false });
        return;
      case 'attack':
        this.vx = 0;
        this.during(this.attack, this.modeT);
        if (this.modeT >= this.strikeOf(this.attack).ticks) this.setMode('recover');
        return;
      case 'recover':
        this.vx = 0;
        if (this.anim.done) this.play('idle');
        if (this.modeT >= this.spec.recover) {
          this.releaseToken();
          this.attack = '';
          this.cool = this.fireInterval(this.spec.cool, this.spec.coolJitter);
          this.setMode('walk');
        }
        return;
      default:
        this.setMode('walk');
    }
  }

  /** The courier's card gag (kinds.ts); the others never start one. */
  protected thinkGag(): void {
    this.setMode('walk');
  }

  /** Is there floor at his own height `dist` px ahead (no wall, no drop off a roof)? */
  protected floorAhead(dir: number, dist = 9): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * dist;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 6, this.y + 6);
    return Number.isFinite(fy) && Math.abs(fy - this.y) <= 3;
  }

  private thinkWalk(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    if (this.turner.facing !== this.facing && !this.turner.turning) this.turner.snap(this.facing);
    this.turner.update(t.x - this.x);
    this.facing = this.turner.facing;
    const dist = Math.abs(t.x - this.x);
    // Coming in from outside the view: always walk in first (never attack from off screen).
    const entering = !this.onScreen(-12);
    // A low block in the way (the road-works barriers): hop over it.
    const wall = this.world.terrain.isSolid(this.x + this.facing * 9, this.y - 6) && !this.world.terrain.isSolid(this.x + this.facing * 9, this.y - GANG.hop);
    if (!this.turner.turning && (dist > this.hold || entering) && wall && this.body?.onGround) {
      jump(this, -3.1);
      this.vx = this.spec.walk * 1.4 * this.facing;
      return;
    }
    if (this.body && !this.body.onGround && this.vx !== 0) return;
    if (this.turner.turning) {
      this.vx = 0;
      this.play('idle');
    } else if ((dist > this.hold || entering) && (this.floorAhead(this.facing) || (entering && !this.world.terrain.isSolid(this.x + this.facing * 9, this.y - 6)))) {
      // Coming into view a little quicker (no long empty stretch while he walks in).
      this.vx = this.spec.walk * (entering ? 1.6 : 1) * this.facing;
      this.play('walk');
      this.anim.tick += strideRate(this.vx, this.spec.walk) - 1;
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (entering || --this.cool > 0) return;
    const a = this.choose(t, dist);
    if (a && dist <= this.spec.range && this.handInView() && this.onScreen(-8) && this.takeToken()) {
      this.attack = a;
      this.facePlayer();
      this.turner.snap(this.facing);
      const tell = this.tellOf(a);
      this.telegraph = this.tele(tell.ticks);
      this.vx = 0;
      this.setMode('tell');
      this.play(`tell-${a}`, { restart: true, loop: false });
      this.world.audio.sfx(tell.sfx);
      if (tell.say) hudOf(this.world).bubble(this, tell.say, { ticks: this.telegraph + 10, kind: 'gag' });
    } else this.cool = 12;
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.attack = '';
    if (this.mode === 'tell' || this.mode === 'attack' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('walk');
    }
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    if ((kind === 'gloat' || kind === 'cower') && this.alive) this.setMode('walk');
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && !this.dead && this.mode === 'walk' && this.reactionTicks <= 0) {
      this.hitT = GANG.hitTicks;
      this.vx = (d.dirX || -this.facing) * GANG.hitPush;
      this.play('hit', { restart: true, loop: false });
    }
    return hit;
  }

  // ------------------------------------------------------------------------------- the end

  protected override onDeath(d: Damage): void {
    this.releaseToken();
    this.endPhase = 'roll';
    this.endT = 0;
    this.fleeDir = (d.dirX > 0 ? 1 : d.dirX < 0 ? -1 : -this.facing) as 1 | -1;
    this.vx = this.fleeDir * (d.kind === 'explosion' ? 1.4 : 0.7);
    if (this.body && d.kind === 'explosion') this.vy = -2.2;
    this.play('die', { restart: true, loop: false });
    this.world.audio.sfx('ring/foot/tumble');
  }

  protected override updateDeath(): void {
    this.endT++;
    if (this.body) {
      const c = this.physics();
      if (c?.onGround && this.endPhase !== 'flee') this.vx *= 0.85;
    }
    this.anim.update();
    switch (this.endPhase) {
      case 'roll':
        if (this.anim.done || this.endT > 90) {
          this.endPhase = 'dazed';
          this.endT = 0;
          this.vx = 0;
          this.play('dazed');
          this.world.audio.sfx('ring/foot/dazed', { vol: 0.6 });
        }
        break;
      case 'dazed':
        if (this.endT >= GANG.dazed) {
          this.endPhase = 'flee';
          this.endT = 0;
          // Away from the nearest hero (they never come back).
          const t = this.target();
          if (t) this.fleeDir = t.x > this.x ? -1 : 1;
          this.facing = this.fleeDir;
          this.play('run');
          dust(this.world, this.x, this.y, 2);
        }
        break;
      case 'flee':
        this.vx = this.fleeDir * GANG.flee;
        if (!this.floorAhead(this.fleeDir) && this.body) this.vx = this.fleeDir * GANG.flee; // off a roof: he drops
        if (!this.onScreen(16) || this.endT >= GANG.fleeMax) this.remove();
        break;
    }
  }

  override draw(r: Renderer): void {
    const f = this.dead ? -1 : this.turner.frame();
    if (f < 0) {
      if (!this.anim.id) return;
      turnOpts.flipX = this.facing < 0;
      turnOpts.flash = this.flashTicks > 0;
      r.sprite(this.anim.id, this.anim.index, this.x, this.y, turnOpts);
      return;
    }
    if (!this.turnId) this.turnId = this.spriteId('turn');
    turnOpts.flipX = this.facing < 0;
    turnOpts.flash = this.flashTicks > 0;
    r.sprite(this.turnId, f, this.x, this.y, turnOpts);
  }
}
