/**
 * The shared rules of the blockade's activists (wave B; docs/design/ring.md §R.6; GDD §4.11 fairness):
 * the base `Activist` (a `Creature`: an attack token from the tell to the end of the recovery, every
 * tell ≥ 18 ticks scaled by difficulty, nothing attacks from outside the view, reactions cancel the
 * attack). The kinds (kinds.ts) name their attacks through four hooks, like the ring gangs on foot.
 *
 * - Attack: when the cool-down ends and a hero is in reach, `choose(target, dist)` names an attack;
 *   with a token and the hand in view the `tell-<attack>` strip plays for `tele(base)` ticks (its
 *   sound, maybe a Dutch bubble), then `strike(attack)`, the attack strip, a recovery, a cool-down.
 * - A hit (not in a tell): the `hit` strip for 8 ticks (a flinch).
 * - BLOODLESS END (spec §R.6; mechanics §23): nobody dies on screen. Beaten (`dead` from the hit on:
 *   no target, `waitClear` stops waiting), the kind's `beaten()` plays its exit: the glue rips (`LOS!`)
 *   or the megaphone squeals and they RUN OFF in a huff (`runOff`: `ACTIVIST_OUT_EVENT` 'runoff' at
 *   once), or the chain snaps and a police pair CARRIES them off stiff as a plank (`callPolice`;
 *   'carried' at the lift). While `carried`, the activist does nothing of its own (the police move it).
 * - The in-world continue: they never point or laugh. `gloat` = the kind's quiet business (hum, the
 *   sign `WIJ HADDEN HET GEZEGD`, a sandwich); `cower` = hands over their heads.
 *
 * Signs: an activist with a `sign` (one of `BANNERS`) has its hand-painted cardboard sign planted
 * beside it on the road (or, for a `loper`, held up on its stick). Signs are separate sprites drawn
 * UNFLIPPED (our lettering never mirrors).
 *
 * Deterministic: the jitter of the cool-downs comes from one rng fork per world ('ring/activists');
 * the looks from the spawn x. No per-tick allocations.
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { Rng } from '../../../../engine/rng';
import type { World } from '../../../../engine/world';
import { gagBubble, type ReactionKind } from '../../../enemy';
import { dust } from '../../../fx';
import { paramNum, paramStr, type SpawnParams } from '../../../registry';
import { Creature } from '../../creatures/common';
import { ACTIVIST_LINES, ACTIVIST_LINE_SPEAKER, BANNERS } from '../foot/lines';
import { ACTIVIST_OUT_EVENT, ACTIVIST_TAG, ACTIVIST_TUNE, type ActivistKind, type ActivistOutHow, type Carryable } from './api';
import { ACT_ART, lookOf, type Look } from './looks';

/**
 * The shortest bubble of each line (ticks; AUDIO-2, the voice fit): its shipped take in
 * 'mission:ring' plus a 10-tick pause, so the text stays up while the voice speaks. `say` never shows
 * a line for less (a tell's bubble may last longer than the tell). Only the bubble's length: no
 * gameplay reads it. A longer re-picked take needs a larger floor (tests/content/ring-voice-fit.test.ts).
 */
export const ACTIVIST_SAY_TICKS: Readonly<Record<keyof typeof ACTIVIST_LINES, number>> = {
  klimaatnood: 96,
  zitten: 97,
  lijm: 111,
  sit: 69,
  los: 75,
  ketting: 71,
  toeter: 115,
  moeder: 67,
};

/**
 * The shortest gap between two bubbles of the same line, across the whole blockade (ticks; the fix
 * of wave B: one run said IK BEL MIJN MOEDER! 42 times, once every 3 s). A line still on its cool-down
 * is skipped (`say` returns false). Only bubbles and voices: no gameplay reads it.
 */
export const ACTIVIST_LINE_GAP: Readonly<Record<keyof typeof ACTIVIST_LINES, number>> = {
  klimaatnood: 600,
  zitten: 600,
  lijm: 600,
  sit: 360,
  los: 300,
  ketting: 300,
  toeter: 480,
  moeder: 720,
};

/** Per world: the tick each line may next be said (the cool-downs of `ACTIVIST_LINE_GAP`). */
const lineNext = new WeakMap<World, Partial<Record<keyof typeof ACTIVIST_LINES, number>>>();

/** Shared numbers (NORMAL; ticks, px, px/tick). */
export const ACT = {
  /** Ticks of the `hit` flinch. */
  hitTicks: 8,
  /** Run-off speed (a huff, then a run: faster than a hero) and its safety cap. */
  flee: 2.4,
  /** The huff before the run: this slow (px/tick), this long (ticks). */
  huff: 0.9,
  huffT: 40,
  fleeMax: 420,
  /** The vertical reach of their attacks (px between the feet). */
  dy: 48,
  /** Lob gravity (px/tick²). */
  lobG: 0.12,
} as const;

/** The tuning of one kind (kinds.ts). */
export interface ActSpec {
  hp: number;
  score: number;
  /** The longest attack range (px). */
  range: number;
  /** The recovery after an attack, the cool-down (base, jitter). */
  recover: number;
  cool: number;
  coolJitter: number;
  w: number;
  h: number;
}

/** One rng fork per world (the cool-downs' jitter): the gameplay rng never advances for them. */
const rngs = new WeakMap<World, Rng>();
export function actRng(world: World): Rng {
  let r = rngs.get(world);
  if (!r) {
    r = world.rng.fork('ring/activists');
    rngs.set(world, r);
  }
  return r;
}

/** A lob from (x0, y0) that lands at (tx, ty) after about `ticks` ticks: [vx, vy]. */
export function lobVel(x0: number, y0: number, tx: number, ty: number, ticks: number, out: [number, number]): [number, number] {
  const T = Math.max(20, ticks);
  out[0] = Math.max(-3, Math.min(3, (tx - x0) / T));
  out[1] = (ty - y0 - 0.5 * ACT.lobG * T * T) / T;
  return out;
}

const signOpts: DrawOpts = { flipX: false };
const lobScratch: [number, number] = [0, 0];

export abstract class Activist extends Creature implements Carryable {
  protected override fineDraw = true;
  readonly kind: ActivistKind;
  readonly look: Look;
  readonly spec: ActSpec;
  carried = false;
  /** How it left (null while it fights). */
  out: ActivistOutHow | null = null;
  /** The banner text it carries ('' none) and its sprite (one per `BANNERS` text). */
  readonly sign: string;
  protected readonly signId: string;
  /** The attack being told / struck ('' = none) and the tell's length. */
  attack = '';
  telegraph = 24;
  /** Attacks made so far (the kinds cycle their attacks and lines on it). */
  protected n = 0;
  protected cool: number;
  private hitT = 0;
  /** The bloodless end: 'exit' (the kind's exit strip), 'wait' (for the police), 'flee'. */
  endPhase: 'exit' | 'wait' | 'flee' = 'exit';
  protected endT = 0;
  protected fleeDir: 1 | -1 = 1;
  /** The planted sign was left on the road. */
  protected signLeft = false;

  constructor(world: World, x: number, y: number, p: SpawnParams, kind: ActivistKind, spec: ActSpec) {
    const look = lookOf(x, p.look);
    super(world, x, y, p, { art: ACT_ART.kind(kind, look), hp: spec.hp, w: spec.w, h: spec.h, score: spec.score });
    this.kind = kind;
    this.look = look;
    this.spec = spec;
    this.addTag(ACTIVIST_TAG);
    this.alerted = true;
    this.sign = paramStr(p, 'sign', '');
    const si = BANNERS.indexOf(this.sign);
    this.signId = si >= 0 ? ACT_ART.sign(si) : '';
    this.cool = paramNum(p, 'wait', 40 + actRng(world).int(0, 30));
    if (p.facing === 1 || p.facing === -1) this.facing = p.facing;
    else this.facePlayer();
    this.setMode('idle');
  }

  // ------------------------------------------------------------------------------- hooks

  /** The attack to start now at this target and distance (or null: not now). */
  protected abstract choose(t: Entity, dist: number): string | null;
  /** The tell's base length (≥ 18 after `tele`), its sound and maybe a line (`ACTIVIST_LINES` key). */
  protected abstract tellOf(a: string): { ticks: number; sfx: string; say?: keyof typeof ACTIVIST_LINES };
  /** The attack strip and how long it holds. */
  protected abstract strikeOf(a: string): { strip: string; ticks: number };
  /** The attack happens. */
  protected abstract strike(a: string): void;
  /** The beaten exit (the kind's strip, its line, then `runOff()` or `callPolice`). */
  protected abstract beaten(d: Damage): void;
  /** The rest strip ('sit' for sitters, 'idle' for the megaphone). */
  protected rest(): string {
    return 'sit';
  }
  /** Each tick of the attack strip. */
  protected during(_a: string, _t: number): void {}

  // ------------------------------------------------------------------------------- AI

  /** Is the throwing hand inside the view (rule 3)? */
  protected handInView(): boolean {
    return this.inView(this.x + this.facing * 8, this.y - 20, -8);
  }

  protected override think(): void {
    this.modeT++;
    this.vx = 0;
    if (this.hitT > 0) {
      if (--this.hitT === 0) this.play(this.rest());
      return;
    }
    switch (this.mode) {
      case 'tell':
        if (this.modeT < this.telegraph) return;
        if (!this.handInView() || !this.target()) return this.cancelAttack();
        this.facePlayer();
        this.strike(this.attack);
        this.n++;
        this.setMode('attack');
        this.play(this.strikeOf(this.attack).strip, { restart: true, loop: false });
        return;
      case 'attack':
        this.during(this.attack, this.modeT);
        if (this.modeT >= this.strikeOf(this.attack).ticks) this.setMode('recover');
        return;
      case 'recover':
        if (this.anim.done) this.play(this.rest());
        if (this.modeT >= this.spec.recover) {
          this.releaseToken();
          this.attack = '';
          this.cool = this.coolDown();
          this.setMode('idle');
        }
        return;
      default:
        this.thinkIdle();
    }
  }

  /** The cool-down after an attack (difficulty-scaled, jittered by the activists' own rng fork). */
  protected coolDown(): number {
    const t = this.spec.cool * this.mods.enemyFireInterval;
    return Math.max(12, Math.round(t + actRng(this.world).int(-this.spec.coolJitter, this.spec.coolJitter)));
  }

  protected thinkIdle(): void {
    this.play(this.rest());
    const t = this.target();
    if (!t) return;
    if (this.mode !== 'idle') this.setMode('idle');
    this.facePlayer();
    if (--this.cool > 0) return;
    const dist = Math.abs(t.x - this.x);
    const a = Math.abs(t.y - this.y) <= ACT.dy && dist <= this.spec.range && this.onScreen(-8) && this.handInView() ? this.choose(t, dist) : null;
    if (a && this.takeToken()) {
      this.attack = a;
      const tell = this.tellOf(a);
      this.telegraph = Math.max(ACTIVIST_TUNE.minTell, this.tele(tell.ticks));
      this.setMode('tell');
      this.play(`tell-${a}`, { restart: true, loop: false });
      this.world.audio.sfx(tell.sfx);
      if (tell.say) this.say(tell.say, this.telegraph + 30);
    } else this.cool = 12;
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.attack = '';
    if (this.mode === 'tell' || this.mode === 'attack' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('idle');
    }
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && !this.dead && this.mode === 'idle' && this.reactionTicks <= 0 && this.hasAnim('hit')) {
      this.hitT = ACT.hitTicks;
      this.play('hit', { restart: true, loop: false });
    }
    return hit;
  }

  /** A lob of `sprite` from the hand at the nearest hero's feet (lands where the hero stood). */
  protected lob(sprite: string, ticks: number, impact: Parameters<Creature['shoot']>[0]['impact'], w = 7, h = 7): void {
    const t = this.target();
    const hand = this.point('hand', 4, -22);
    const tx = t ? t.x : this.x + this.facing * 90;
    const ty = t ? t.y - 6 : this.y - 6;
    const [vx, vy] = lobVel(hand[0], hand[1], tx, ty, ticks, lobScratch);
    // The shot's speed is scaled by difficulty (Enemy.shoot): divide it out, so the lob lands where aimed.
    const k = this.mods.enemyBulletSpeed || 1;
    this.shoot({ speed: Math.hypot(vx, vy) / k, angle: Math.atan2(vy, vx), damage: 10, sprite, look: 'anim', gravity: ACT.lobG, x: hand[0], y: hand[1], w, h, life: 240, kind: 'impact', impact });
    this.world.audio.sfx('ring/throw');
  }

  /**
   * A Dutch bubble (voiced when its take exists), unless the same line was said in the last
   * `ACTIVIST_LINE_GAP[key]` ticks anywhere on the road.
   */
  protected say(key: keyof typeof ACTIVIST_LINES, ticks = 80): boolean {
    let next = lineNext.get(this.world);
    if (!next) lineNext.set(this.world, (next = {}));
    const now = this.world.tick;
    if (now < (next[key] ?? -1)) return false;
    if (!gagBubble(this.world, this, ACTIVIST_LINES[key], Math.max(ticks, ACTIVIST_SAY_TICKS[key]), ACTIVIST_LINE_SPEAKER[key])) return false;
    next[key] = now + ACTIVIST_LINE_GAP[key];
    return true;
  }

  /** The run-off line: IK BEL MIJN MOEDER!, or KLIMAATNOOD! while that one is on its cool-down. */
  protected sayOff(): boolean {
    return this.say('moeder', 60) || this.say('klimaatnood', 60);
  }

  // ------------------------------------------------------------------------------- the end

  protected override onDeath(d: Damage): void {
    // No white flash on the beaten one: nothing hurts them.
    this.flashTicks = 0;
    this.releaseToken();
    this.contactDamage = null;
    this.attack = '';
    this.vx = 0;
    this.endT = 0;
    this.endPhase = 'exit';
    this.fleeDir = (d.dirX > 0 ? 1 : d.dirX < 0 ? -1 : -this.facing) as 1 | -1;
    this.beaten(d);
  }

  /** Mark the run-off (the moment it starts to leave: the rip, the squeal): the event, once. */
  protected markRunoff(): void {
    if (this.out) return;
    this.out = 'runoff';
    this.world.events.emit(ACTIVIST_OUT_EVENT, { kind: this.kind, how: 'runoff', entity: this });
  }

  /** Off the road in a huff: `strip` away from the nearest hero; a planted sign stays on the road. */
  protected runOff(strip = 'huff'): void {
    if (this.endPhase === 'flee') return;
    this.markRunoff();
    this.endPhase = 'flee';
    this.endT = 0;
    // Off by the nearer screen edge (faster than a hero runs: they never trot along ahead of one).
    const cam = this.world.camera;
    this.fleeDir = this.x < cam.x + cam.w / 2 ? -1 : 1;
    this.facing = this.fleeDir;
    this.play(strip);
    dust(this.world, this.x, this.y, 2);
    this.leaveSign();
  }

  /** The planted sign stays on the road when its owner leaves (decor). */
  protected leaveSign(): void {
    if (!this.signId || this.signLeft) return;
    const s = this.signAt(signScratch);
    this.signLeft = true;
    if (s) this.world.add(new SignProp(this.world, s[1], s[2], s[0]));
  }

  /** The exit strip ended (or `maxT` passed): the kind's next step (default: run off). */
  protected exitDone(): void {
    this.runOff();
  }

  protected exitMax(): number {
    return 90;
  }

  protected override updateDeath(): void {
    this.anim.update();
    if (this.carried) return;
    this.endT++;
    switch (this.endPhase) {
      case 'exit':
        if (this.body) this.physics();
        if (this.anim.done || this.endT > this.exitMax()) this.exitDone();
        break;
      case 'wait':
        if (this.body) this.physics();
        break;
      case 'flee':
        this.vx = this.fleeDir * this.fleeSpeed();
        if (this.body) this.physics();
        else this.x += this.vx;
        if (!this.onScreen(16) || this.endT >= ACT.fleeMax) this.remove();
        break;
    }
  }

  /** The huff: stomping off slowly for `huffT` ticks, then running (the `flee` strip) faster than a hero. */
  protected fleeSpeed(): number {
    const huffing = this.playing('huff');
    if (huffing && this.endT >= ACT.huffT && this.hasAnim('flee')) this.play('flee');
    if (this.playing('huff')) return ACT.huff;
    return this.endT < 10 ? ACT.flee * 0.6 : ACT.flee;
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReactionEnd(kind: ReactionKind): void {
    if ((kind === 'gloat' || kind === 'cower') && this.alive) {
      this.setMode('idle');
      this.play(this.rest());
    }
  }

  // ------------------------------------------------------------------------------- drawing

  /** The sign this tick: [sprite id, world x, world y] or null. Default: planted behind a sitter. */
  protected signAt(out: [string, number, number]): [string, number, number] | null {
    if (!this.signId || this.signLeft || this.carried) return null;
    out[0] = this.signId;
    out[1] = this.x - this.facing * 11;
    out[2] = this.y;
    return out;
  }

  /** The body's draw offset (the megaphone stands on a crate). */
  protected liftPx(): number {
    return 0;
  }

  override draw(r: Renderer): void {
    const s = this.signAt(signScratch);
    if (s && this.signBehind()) {
      r.sprite(s[0], 0, Math.round(s[1]), Math.round(s[2]), signOpts);
    }
    if (this.carried) {
      if (!this.hasAnim('plank')) return;
      plankOpts.flipX = this.facing < 0;
      r.sprite(this.spriteId('plank'), (this.world.tick >> 3) % 2, this.x, this.y, plankOpts);
      return;
    }
    if (this.anim.id) {
      bodyOpts.flipX = this.facing < 0;
      bodyOpts.flash = this.flashTicks > 0;
      r.sprite(this.anim.id, this.anim.index, this.x, this.y - this.liftPx(), bodyOpts);
    }
    if (s && !this.signBehind()) r.sprite(s[0], 0, Math.round(s[1]), Math.round(s[2]), signOpts);
  }

  /** Is the sign drawn behind the body (planted) or in front (held)? */
  protected signBehind(): boolean {
    return true;
  }
}

const signScratch: [string, number, number] = ['', 0, 0];

/** A sign left planted on the road (never mirrored). */
export class SignProp extends Entity {
  readonly sprite: string;
  constructor(world: World, x: number, y: number, sprite: string) {
    super(world, x, y);
    this.sprite = sprite;
    this.team = 'neutral';
    this.z = 7;
    this.hitbox = { x: -12, y: -30, w: 24, h: 30 };
    this.despawnMargin = 160;
  }
  override draw(r: Renderer): void {
    r.sprite(this.sprite, 0, Math.round(this.x), Math.round(this.y), signOpts);
  }
}
const bodyOpts: DrawOpts = {};
const plankOpts: DrawOpts = {};
