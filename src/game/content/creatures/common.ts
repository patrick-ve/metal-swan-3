/**
 * Shared base for the non-human enemies (docs/GAME_DESIGN.md §9.3, §4.11).
 *
 * `Creature` extends the game-layer `Enemy` with what every creature needs:
 * - a `mode` / `modeT` state pair (the arena tool traces `mode`),
 * - attack tokens held from the telegraph to the end of the recovery (rule 4),
 * - telegraph scaling (`tele`, never below 18 ticks, rule 2) and view checks at the attack
 *   moment (rule 3: nothing attacks from outside the view, 8 px margin),
 * - gags as free time with the double-take and CAUGHT NAPPING (rule 1),
 * - reactions: every creature takes SAY CHEESE ('photo'); a reaction cancels the attack and
 *   frees the token. Legion reactions (anthem salute, JINGLE, HONK ears …) are infantry only.
 *
 * Creatures are soft (the knife, grenade splash and the Swan's STOMP reach them) and tagged
 * 'creature'. They are never tagged 'legion'.
 */
import type { Damage } from '../../../engine/entity';
import type { Entity } from '../../../engine/entity';
import type { Rect } from '../../../engine/math';
import { PAL } from '../../../engine/palette';
import type { Renderer } from '../../../engine/render';
import type { PlayOpts } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import {
  Enemy,
  caughtNapping,
  doubleTakeTicks,
  listenForBlasts,
  noticesPlayer,
  playerNoiseNear,
  releaseAttackToken,
  shoutToAllies,
  takeAttackToken,
  telegraphTicks,
  type EnemyOpts,
  type ReactionKind,
} from '../../enemy';
import { isPlayer } from '../../player/player';
import { paramStr, type SpawnParams } from '../../registry';

// ---------------------------------------------------------------------------------------------
// Animation option helpers (filled per call, so state changes never allocate)
// ---------------------------------------------------------------------------------------------

const playOpts: PlayOpts = {};
const uniform = new Map<number, readonly number[]>();

/** Uniform frame durations, cached per value (a sprite's own durations win over ticksPerFrame). */
export function frames(ticks: number): readonly number[] {
  let d = uniform.get(ticks);
  if (!d) {
    d = [ticks];
    uniform.set(ticks, d);
  }
  return d;
}

/** Play once from `frame`; `ticks` per frame overrides the sprite's timing. */
export function once(frame = 0, ticks?: number): PlayOpts {
  playOpts.restart = true;
  playOpts.loop = false;
  playOpts.frame = frame;
  playOpts.ticksPerFrame = undefined;
  playOpts.durations = ticks ? frames(ticks) : undefined;
  return playOpts;
}

/** Loop from the start with `ticks` per frame (keeps running if already playing). */
export function looping(ticks: number): PlayOpts {
  playOpts.restart = false;
  playOpts.loop = true;
  playOpts.frame = 0;
  playOpts.ticksPerFrame = undefined;
  playOpts.durations = frames(ticks);
  return playOpts;
}

/** Hold one frame (the caller sets `anim.index` for frame-exact strips such as marching in step). */
export function held(): PlayOpts {
  playOpts.restart = false;
  playOpts.loop = false;
  playOpts.frame = 0;
  playOpts.ticksPerFrame = undefined;
  playOpts.durations = frames(9999);
  return playOpts;
}

// ---------------------------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------------------------

/** A contact / strike Damage owned by one creature (reused every tick). */
export function contactHit(source: Entity, kind: Damage['kind'], amount = 10): Damage {
  return { amount, kind, dirX: 0, source };
}

/** Player slot of an entity that is a player or a driven vehicle (for kill credit), else -1. */
export function slotOf(e: Entity): number {
  if (isPlayer(e)) return e.index;
  const v = e as Entity & { driver?: Entity | null };
  return v.driver && isPlayer(v.driver) ? v.driver.index : -1;
}

/** Is a driven player vehicle (tag 'vehicle', team 'player', shootable while driven). */
export function isDrivenVehicle(e: Entity): boolean {
  return e.alive && e.team === 'player' && e.hasTag('vehicle') && e.hasTag('shootable');
}

/** Rect overlap with a margin-free test (touching edges do not count). */
export function touches(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Gag choice from params: a name, true (the default gag), false / 'none', or a chance when absent. */
export function gagParam(p: SpawnParams, world: World, chance: number): string | null {
  const g = p.gag;
  if (g === false || g === 'none') return null;
  if (typeof g === 'string' && g !== '') return g;
  if (g === true) return '';
  return world.rng.chance(chance) ? '' : null;
}

/** `enter` / `entry` params (ctx.enter sets enter: 'left' | 'right' | 'top'). */
export function entryParam(p: SpawnParams): string {
  const entry = paramStr(p, 'entry', '');
  if (entry) return entry;
  const e = p.enter;
  return e === 'left' || e === 'right' || e === 'top' ? e : '';
}

/**
 * Dizzy stars circling over a head at (x, y) (world space; `t` = ticks). Drawn by code so every
 * creature shares one look (stunned goats, dazed snakes, the froglet).
 */
export function drawDizzy(r: Renderer, x: number, y: number, t: number, n = 3): void {
  for (let i = 0; i < n; i++) {
    const a = t * 0.15 + (i * Math.PI * 2) / n;
    const sx = Math.round(x + Math.cos(a) * 7);
    const sy = Math.round(y + Math.sin(a) * 2.5);
    r.rect(sx - 1, sy, 3, 1, PAL.gold[2]);
    r.rect(sx, sy - 1, 1, 3, PAL.gold[2]);
    r.rect(sx, sy, 1, 1, PAL.snow[3]);
  }
}

// ---------------------------------------------------------------------------------------------
// Creature
// ---------------------------------------------------------------------------------------------

/** Rule 1 notice ranges for gags (px in front / behind, max height difference). */
export const GAG_NOTICE = { front: 160, behind: 48, dy: 110, shot: 48, shout: 96 } as const;

export abstract class Creature extends Enemy {
  /** Current behaviour state (traced by `npm run arena`). */
  mode = 'idle';
  /** Ticks spent in the current mode. */
  modeT = 0;
  /** Holds an attack token (from the telegraph to the end of the recovery). */
  holdsToken = false;
  /** Gag strip (`gag-<name>` when drawn, else `gag`). */
  protected gagAnim = 'gag';
  /** Length of the running notice (double-take + alert) and of its double-take part. */
  protected noticeLen = 0;
  protected doubleTake = 0;
  /** Woken by a shouting ally: notice after this many ticks (-1 = none). */
  protected shoutIn = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams, o: EnemyOpts) {
    super(world, x, y, p, o);
    this.addTag('creature');
    listenForBlasts(world);
  }

  /**
   * A small creature that touches a driven player vehicle breaks on it (GDD §8.1, §8.5: "touching
   * a small enemy destroys it and costs ½ cell"): the vehicle takes `touch` (kind 'bullet' = ½
   * cell), the creature dies with the driver credited. Returns true when it broke.
   */
  protected breakOnVehicle(touch: Damage): boolean {
    const me = this.hitRect();
    const list = this.world.byTag('vehicle');
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!isDrivenVehicle(v) || !touches(me, v.hitRect())) continue;
      this.world.damage(v, touch);
      this.world.damage(this, { amount: 1e6, kind: 'impact', dirX: v.x < this.x ? 1 : -1, owner: slotOf(v), source: v });
      return true;
    }
    return false;
  }

  /** Keep a walker inside the section (an `R+16` entry at the section's end). */
  protected clampToSection(): void {
    const b = this.world.terrain.bounds;
    this.x = this.prevX = Math.max(b.x + 8, Math.min(b.x + b.w - 8, this.x));
  }

  setMode(m: string): void {
    this.mode = m;
    this.modeT = 0;
  }

  /** Take an attack token (rule 4). False: keep moving and try again later. */
  takeToken(): boolean {
    if (this.holdsToken) return true;
    if (!takeAttackToken(this.world, this)) return false;
    this.holdsToken = true;
    return true;
  }

  releaseToken(): void {
    if (!this.holdsToken) return;
    this.holdsToken = false;
    releaseAttackToken(this.world, this);
  }

  /** A telegraph length for the difficulty (× 1.25 / 1 / 0.9), never below 18 ticks. */
  tele(base: number): number {
    return telegraphTicks(this.world, base);
  }

  /** Is a world point inside the view (default: 8 px inside its edges, rule 3)? */
  inView(x: number, y: number, margin = -8): boolean {
    return this.world.camera.containsPoint(x, y, margin);
  }

  // ------------------------------------------------------------------------------- gags

  /** Start a gag (free time, rule 1). A random start frame keeps groups out of sync. */
  protected startGag(name: string): void {
    this.gagAnim = name && this.hasAnim(`gag-${name}`) ? `gag-${name}` : 'gag';
    this.setMode('gag');
    this.play(this.gagAnim, { restart: true, frame: this.world.rng.int(0, 3) });
  }

  /** In a gag: does it notice a player, a shot or a blast nearby (rule 1)? Starts the notice. */
  protected gagNotices(front: number = GAG_NOTICE.front, behind: number = GAG_NOTICE.behind): boolean {
    if (noticesPlayer(this, front, behind, GAG_NOTICE.dy) || playerNoiseNear(this, GAG_NOTICE.shot)) {
      const take = doubleTakeTicks(this.world);
      this.startNotice(take + 12, take);
      return true;
    }
    return false;
  }

  /** The double-take (`take` ticks: looks, looks away, looks back) then a 12-tick alert with '!'. */
  protected startNotice(len: number, take = 0): void {
    this.vx = 0;
    if (!this.body) this.vy = 0;
    this.noticeLen = len;
    this.doubleTake = take;
    this.setMode('notice');
    this.facePlayer();
    this.world.audio.sfx(take > 0 ? 'enemy/double-take' : 'enemy/alert');
    hudOf(this.world).bubble(this, '!', { ticks: len, kind: 'gag' });
  }

  /** Runs the notice; returns true on the tick it ends (then the creature is alerted). */
  protected thinkNotice(): boolean {
    this.vx = 0;
    const t = this.modeT;
    const take = this.doubleTake;
    if (take > 0) {
      // Look away at a third of the double-take, back at two thirds.
      if (t === Math.round(take / 3)) this.facing = this.facing > 0 ? -1 : 1;
      else if (t === Math.round((take * 2) / 3)) this.facePlayer();
      else if (t === take) this.world.audio.sfx('enemy/alert');
    }
    this.play(this.hasAnim('alert') ? 'alert' : 'idle');
    if (t < this.noticeLen) return false;
    this.alert();
    return true;
  }

  /** Called by a shouting ally (enemy.ts `shoutToAllies`). */
  hearShout(delay: number): void {
    if ((this.mode === 'gag' || this.mode === 'idle' || this.mode === 'hang' || this.mode === 'hover') && this.shoutIn < 0) {
      this.shoutIn = delay;
    }
  }

  /** Count down a heard shout; true when it fires now (start a short notice). */
  protected heardShout(): boolean {
    if (this.shoutIn > 0 && --this.shoutIn === 0) {
      this.shoutIn = -1;
      return true;
    }
    return false;
  }

  protected override onAlert(): void {
    shoutToAllies(this, GAG_NOTICE.shout);
  }

  /** Killed in a gag or before its double-take ended (CAUGHT NAPPING, rule 1). */
  protected isNapping(): boolean {
    return this.mode === 'gag' || this.mode === 'hang' || (this.mode === 'notice' && this.modeT < this.doubleTake);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    const napping = this.isNapping();
    this.releaseToken();
    this.contactDamage = null;
    super.onDeath(d);
    if (napping) caughtNapping(this, d);
    this.deathEffects(d);
  }

  /** Hook: sounds and effects of a death (the anim is already playing). */
  protected deathEffects(_d: Damage): void {}

  override onRemove(): void {
    this.releaseToken();
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- reactions

  /** Every creature poses for SAY CHEESE; other reactions are opted in per type. */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    return kind === 'photo';
  }

  /** A reaction stops any telegraph or attack and frees the token (no attacks while it lasts). */
  protected override onReact(): void {
    this.releaseToken();
    this.contactDamage = null;
    this.cancelAttack();
  }

  /** Hook: drop the running attack (back to the creature's neutral mode). */
  protected cancelAttack(): void {}

  protected override thinkReaction(kind: ReactionKind): void {
    // Flyers hang in the air while they pose.
    if (!this.body) this.vy = 0;
    super.thinkReaction(kind);
  }
}
