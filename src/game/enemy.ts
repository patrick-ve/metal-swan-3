/**
 * Enemy base class (docs/ARCHITECTURE.md §6): team 'enemy', tags 'enemy' + 'shootable' (+ 'soft'
 * for infantry: knifeable, hurt by grenade splash), an Animator over `<art>/<anim>` sprites,
 * aggro helpers, shooting helpers, death handling by damage kind, score, drops, despawn rules
 * and off-screen spawn helpers.
 *
 * A content enemy overrides `think()` (its AI, once per tick while alive) and maybe `draw()`:
 * ```ts
 * class Grunt extends Enemy {
 *   private cool = 60;
 *   constructor(w: World, x: number, y: number, p: SpawnParams) { super(w, x, y, p, { art: 'enemy/grunt', hp: 10 }); }
 *   protected override think(): void {
 *     const t = this.target();
 *     if (!t) return this.play('idle');
 *     this.facePlayer();
 *     if (--this.cool <= 0 && this.inRange(t, 200, 40)) { this.play('shoot', { restart: true }); this.shoot({ speed: 3, damage: 10, sprite: 'enemy/bullet' }); this.cool = this.fireInterval(90); }
 *   }
 * }
 * defineEntity('grunt', (w, x, y, p) => new Grunt(w, x, y, p), { category: 'enemy', score: 100 });
 * ```
 * Spawn params understood by every enemy: `hp`, `drop` (entity id, `{ id, params }`, or a list
 * to pick from), `facing`, `tag(s)`.
 *
 * Shared rules for every enemy type live here too (GDD §4.11): attack tokens
 * (`takeAttackToken` …), telegraph scaling (`telegraphTicks`, never below 18), gag awareness
 * (`noticesPlayer`, `playerNoiseNear`, `shoutToAllies`, `doubleTakeTicks`, `caughtNapping`), the
 * knife-combo note (`knifeComboStep`) and the **reaction protocol**: `enemy.react(kind, ticks)` /
 * `reactInArea(world, shape, kind, ticks)` — anthem salutes, HONK ears, the JINGLE queue, SAY
 * CHEESE photo poses, panics … sent by any module and answered by any enemy that opts in.
 */
import type { Color } from '../engine/color';
import { Entity, type Damage, type DamageKind } from '../engine/entity';
import { distToRect, overlaps, type Rect } from '../engine/math';
import { Body, jump, moveBody, settle, type Contact } from '../engine/physics';
import type { DrawOpts, Renderer } from '../engine/render';
import { Animator, framePoint, getFrame, hasSprite, type PlayOpts } from '../engine/sprites';
import type { Circle, World } from '../engine/world';
import { difficultyOf, hudOf, playerCountOf, sessionOf } from './context';
import { awardScore } from './events';
import { explosion } from './fx';
import { Projectile, type ImpactFn, type ProjectileOpts } from './projectile';
import {
  NO_PARAMS,
  getEntityMeta,
  paramNum,
  paramSpawn,
  type SpawnParams,
  type SpawnSpec,
} from './registry';
import type { DifficultyMods } from './session';
import { TUNING } from './tuning';

export interface EnemyOpts {
  /** Sprite prefix: 'enemy/rifleman' → 'enemy/rifleman/run'. */
  art: string;
  /** Hit points (default 10 = one pistol shot). Spawn param `hp` overrides. */
  hp?: number;
  /** Body / hitbox size (default 14×30). */
  w?: number;
  h?: number;
  /** Infantry-like: knifeable and hurt by grenade splash (default true). */
  soft?: boolean;
  /** Physics body with gravity (default true). False for flyers and turrets that move themselves. */
  body?: boolean;
  /** Big enemy: HP scales with difficulty and co-op (default false). */
  big?: boolean;
  /** Points (default: registry meta score, else TUNING.score.enemy). */
  score?: number;
}

export interface EnemyShotOpts {
  speed: number;
  damage: number;
  sprite: string;
  /** Angle (radians); default: straight ahead along the facing. */
  angle?: number;
  kind?: DamageKind;
  life?: number;
  gravity?: number;
  w?: number;
  h?: number;
  /** Spawn point; default: the current frame's 'muzzle' point. */
  x?: number;
  y?: number;
  impact?: 'spark' | 'none' | ImpactFn;
  look?: 'angle' | 'anim';
  /** The player can shoot it down (hp) / knife it (soft). */
  shootable?: boolean;
  hp?: number;
  soft?: boolean;
  offscreen?: number;
}

export type Side = 'left' | 'right';

/**
 * Cross-module enemy reactions (GDD §4.11 rules 6–7, §7.2, §8.2–8.4, §9.1). Who sends what:
 * - 'salute'   anthem-speaker (machines) → Legion infantry within 240 px: freeze, no attacks
 * - 'dance'    anthem-speaker → windup-bots (creatures)
 * - 'panic'    a player grenade within 36 px (weapons) / a moving player vehicle (vehicles) → infantry run away
 * - 'confused' a dying baton-major (infantry) → infantry within 160 px, 60 ticks ('?' bubble)
 * - 'freeze'   the sundae-mortar (vehicles) → infantry frozen in ice 90 ticks (a hit shatters them)
 * - 'queue'    the JINGLE (vehicles) → Legion infantry within 200 px queue at the van, 120 ticks
 * - 'ears'     HONK (vehicles) → infantry in the ring cover their ears, 60 ticks
 * - 'photo'    SAY CHEESE (the tourist hostage, items) → every non-boss enemy on screen, 45 ticks
 * - 'stumble'  a parade column's drummer dies (infantry) → the column stumbles, 60 ticks
 * - 'buff'     IN STEP! (baton-major) → riflemen within 120 px fire 30 % faster, 240 ticks
 * - 'gloat'    the in-world continue (mission runner): every player is out → every non-boss enemy
 *              on screen goes about its own business at the spot where the last player went down
 *              (`thinkGloat`; never a laugh, a point or a cheer) while the countdown runs
 * - 'cower'    the in-world continue: a continued hero lands → every non-boss enemy on screen
 *              cowers in place (TUNING.continues.cowerTicks)
 * While a reaction runs the enemy does not attack (its `think()` is replaced by
 * `thinkReaction()`); it still takes damage.
 */
export type ReactionKind = 'salute' | 'dance' | 'panic' | 'confused' | 'freeze' | 'queue' | 'ears' | 'photo' | 'stumble' | 'buff' | 'gloat' | 'cower';

/** Reactions every enemy answers (SAY CHEESE and the in-world continue), machines included. */
const EVERY_ENEMY_REACTIONS: ReadonlySet<ReactionKind> = new Set(['photo', 'gloat', 'cower']);

/** Does every enemy answer this reaction ('photo', 'gloat', 'cower')? For `acceptsReaction` overrides. */
export function everyEnemyReacts(kind: ReactionKind): boolean {
  return EVERY_ENEMY_REACTIONS.has(kind);
}

/** Reactions every Legion soldier (tag 'legion', soft) accepts by default. */
const LEGION_REACTIONS: ReadonlySet<ReactionKind> = new Set(['salute', 'panic', 'confused', 'freeze', 'queue', 'ears', 'photo', 'stumble']);

/** Default animation for a reaction (`<art>/<name>`; falls back to 'idle'). */
const REACTION_ANIMS: Readonly<Record<ReactionKind, string>> = {
  salute: 'salute',
  dance: 'dance',
  panic: 'panic',
  confused: 'confused',
  freeze: 'frozen',
  queue: 'queue',
  ears: 'ears',
  photo: 'photo-pose',
  stumble: 'stumble',
  buff: 'idle',
  gloat: 'gloat',
  cower: 'cower',
};

/** The animation a reaction plays when `<art>/<anim>` is missing (before 'idle'): Legion soldiers cower in their panic strip. */
const REACTION_FALLBACK: Partial<Record<ReactionKind, string>> = { cower: 'panic' };

const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = {};
const ptScratch: [number, number] = [0, 0];
const muzzleScratch: [number, number] = [0, 0];
/** Reused for every Enemy.shoot call (Projectile.init copies what it needs). */
const shotOpts: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 0 };

export class Enemy extends Entity {
  /** Sprite prefix. */
  art: string;
  readonly anim = new Animator();
  /** Points for the kill; null = registry meta score, else TUNING.score.enemy. */
  score: number | null;
  /** Knifeable / hurt by grenade splash. */
  readonly soft: boolean;
  /** HP scales with difficulty and co-op. */
  readonly big: boolean;
  /** Item dropped on death (spawn param `drop`). */
  drop: SpawnSpec | null;
  /** True once `alert()` ran (the enemy noticed a player). */
  alerted = false;
  /** Range (px) within which `checkAlert()` notices a player. */
  sightRange = 260;
  /** Ticks the body stays after the death animation (it blinks during the last 20). */
  corpseTicks = 40;
  /** The hit that killed it. */
  killedBy: Damage | null = null;
  /** Ticks since death. */
  deathTicks = 0;
  /** The reaction running now (see ReactionKind) and its ticks left; null / 0 = none. */
  reaction: ReactionKind | null = null;
  reactionTicks = 0;
  /** Who caused the reaction (the speaker, the van …). */
  reactionSource: Entity | null = null;
  /** Spawn params, for subclasses. */
  readonly params: SpawnParams;
  private readonly ids = new Map<string, string>();
  private deathAnimDone = false;
  private shotTypeId = '';

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS, o: EnemyOpts) {
    super(world, x, y);
    this.params = params;
    this.art = o.art;
    this.team = 'enemy';
    this.z = 30;
    this.soft = o.soft ?? true;
    this.big = o.big ?? false;
    this.score = o.score ?? null;
    const w = o.w ?? 14;
    const h = o.h ?? 30;
    this.hitbox = { x: -w / 2, y: -h, w, h };
    if (o.body !== false) this.body = new Body({ w, h });
    const baseHp = paramNum(params, 'hp', o.hp ?? 10);
    this.hp = this.maxHp = this.big ? this.scaledHp(baseHp) : baseHp;
    this.drop = paramSpawn(params, 'drop', world);
    this.despawnMargin = 96;
    this.addTag('enemy', 'shootable');
    if (this.soft) this.addTag('soft');
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (this.dead) {
      this.updateDeath();
      return;
    }
    if (this.reactionTicks > 0) {
      this.thinkReaction(this.reaction as ReactionKind);
      if (--this.reactionTicks <= 0) this.endReaction();
    } else this.think();
    if (this.body) this.physics();
    this.anim.update();
  }

  // ------------------------------------------------------------------------------- reactions

  /**
   * Ask this enemy to react (anthem salute, HONK ears, SAY CHEESE …). Returns true when it
   * accepted; a running reaction is replaced (or extended when it is the same kind).
   */
  react(kind: ReactionKind, ticks: number, source: Entity | null = null): boolean {
    if (!this.alive || ticks <= 0 || !this.acceptsReaction(kind)) return false;
    if (this.reaction === kind) this.reactionTicks = Math.max(this.reactionTicks, ticks);
    else {
      if (this.reaction) this.endReaction();
      this.reaction = kind;
      this.reactionTicks = ticks;
      // The hero is back: a startled '!' over every enemy that starts to cower.
      if (kind === 'cower') hudOf(this.world).bubble(this, '!', { ticks: 30, kind: 'gag' });
    }
    this.reactionSource = source;
    this.onReact(kind, ticks, source);
    return true;
  }

  /** Is a reaction running (no attacks)? */
  get reacting(): boolean {
    return this.reactionTicks > 0;
  }

  /** Stop the running reaction now. */
  endReaction(): void {
    const k = this.reaction;
    this.reaction = null;
    this.reactionTicks = 0;
    this.reactionSource = null;
    if (k) this.onReactionEnd(k);
  }

  /**
   * Which reactions this enemy answers. Default: 'photo', 'gloat' and 'cower' for everyone
   * (`everyEnemyReacts`); Legion soldiers (tags 'legion' + 'soft') also salute, panic, get
   * confused, freeze, queue, cover their ears and stumble. Override to opt in or out
   * (windup-bots: 'dance'; riflemen: 'buff').
   */
  protected acceptsReaction(kind: ReactionKind): boolean {
    if (everyEnemyReacts(kind)) return true;
    return this.hasTag('legion') && this.soft && LEGION_REACTIONS.has(kind);
  }

  /** Hook: a reaction started (cancel a telegraph, release an attack token, show a bubble …). */
  protected onReact(_kind: ReactionKind, _ticks: number, _source: Entity | null): void {}

  /** Hook: a reaction ended (or was replaced). */
  protected onReactionEnd(_kind: ReactionKind): void {}

  /**
   * Behaviour during a reaction (instead of `think()`). Default: stand still and play
   * `<art>/<anim>` for the reaction (salute, photo-pose, ears …), else its fallback, else 'idle';
   * 'panic' runs away from the source; 'cower' faces it (the hero who came back); 'gloat' runs
   * `thinkGloat` (the spot where the last player went down). Override for walking reactions (the
   * JINGLE queue, a stumble) and for bodies that must hold their place another way (a flyer).
   */
  protected thinkReaction(kind: ReactionKind): void {
    if (kind === 'gloat') {
      this.stepGloat();
      return;
    }
    if (kind === 'panic') {
      const src = this.reactionSource ?? this.target();
      const dir = src ? (src.x > this.x ? -1 : 1) : -this.facing;
      this.facing = dir as 1 | -1;
      this.vx = dir * 1.6;
    } else {
      this.vx = 0;
      if (kind === 'cower') this.faceSpot(this.reactionSource);
    }
    this.play(this.reactionAnim(kind));
  }

  // ------------------------------------------------------------------------------- the gloat

  /**
   * Ticks of this hold's gloat so far (the clock of `thinkGloat`). A hold (`startGloatHold`, every
   * player out) starts it at 0 once; a gloat that lapses (off screen) and comes back in the same
   * hold goes on where it was.
   */
  protected gloatT = 0;
  /** This hold's gloat line was shown (`sayGloat`: at most one bubble per enemy per hold). */
  protected gloatSaid = false;
  /** The hold (`gloatHoldOf`) the gloat clock belongs to; −1 = never gloated. */
  private gloatHold = -1;

  /** One gloat tick: a new hold resets the clock and the line (`onGloatStart`), then `thinkGloat`. */
  private stepGloat(): void {
    const hold = gloatHoldOf(this.world);
    if (hold !== this.gloatHold) {
      this.gloatHold = hold;
      this.gloatT = 0;
      this.gloatSaid = false;
      this.onGloatStart(this.reactionSource);
    }
    this.thinkGloat(this.reactionSource, this.gloatT++);
  }

  /** Hook: the first gloat tick of a hold (pick a spot, ring a bell …). */
  protected onGloatStart(_spot: Entity | null): void {}

  /**
   * The gloat (docs/design/ams-extras.md §1, GDD §4.6): every player is out and this enemy goes
   * about its own business at the spot where the last player went down (`spot`: the out player,
   * it stays where it fell; `t`: ticks of this hold's gloat, 0 first). Never a laugh, a point or a
   * cheer. Default: stand still, face the spot, play `<art>/gloat` (else 'idle'). Overrides may
   * move a little (stay on the own floor and in view) and must not attack; the enemy still takes
   * damage. It ends when a hero drops back in (the cower replaces it): `onReactionEnd('gloat')`.
   */
  protected thinkGloat(spot: Entity | null, _t: number): void {
    this.vx = 0;
    this.faceSpot(spot);
    this.play(this.reactionAnim('gloat'));
  }

  /** Face `spot` (when it is 2+ px away). */
  protected faceSpot(spot: Entity | null): void {
    if (spot && Math.abs(spot.x - this.x) >= 2) this.facing = spot.x > this.x ? 1 : -1;
  }

  /**
   * Show this hold's gloat line over the enemy (a gag bubble, `gagBubble`): at most once per enemy
   * per hold, never over another gag bubble (then it tries again on a later tick). Returns true
   * when it shows now.
   */
  protected sayGloat(text: string, ticks: number, speaker = ''): boolean {
    if (this.gloatSaid || !gagBubble(this.world, this, text, ticks, speaker)) return false;
    this.gloatSaid = true;
    return true;
  }

  /** The animation `thinkReaction` plays for `kind`: its own strip, its fallback, else 'idle'. */
  protected reactionAnim(kind: ReactionKind): string {
    const name = REACTION_ANIMS[kind];
    if (this.hasAnim(name)) return name;
    const alt = REACTION_FALLBACK[kind];
    if (alt && this.hasAnim(alt)) return alt;
    return this.hasAnim('idle') ? 'idle' : name;
  }

  /** The AI. Called once per tick while alive (before physics and the animator). */
  protected think(): void {}

  /** Gravity, movement and terrain collision for enemies with a body. */
  protected physics(): Contact | null {
    return this.body ? moveBody(this, this.world.terrain, this.world) : null;
  }

  /** Put the enemy on the floor below it (call after spawning in the air by mistake). */
  settle(): boolean {
    return this.body ? settle(this, this.world.terrain, this.world) : false;
  }

  // ------------------------------------------------------------------------------- animation

  /** Full sprite id for an animation name (cached, no allocation after the first call). */
  spriteId(name: string): string {
    let id = this.ids.get(name);
    if (id === undefined) {
      id = `${this.art}/${name}`;
      this.ids.set(name, id);
    }
    return id;
  }

  /** Play `<art>/<name>` (keeps running if it already plays, unless `restart`). */
  play(name: string, o?: PlayOpts): void {
    this.anim.play(this.spriteId(name), o);
  }

  hasAnim(name: string): boolean {
    return hasSprite(this.spriteId(name));
  }

  /** Is `<art>/<name>` the current animation? */
  playing(name: string): boolean {
    return this.anim.id === this.spriteId(name);
  }

  /**
   * Draw at the unrounded position (the renderer snaps to 1/res with the default sub-pixel
   * policy, docs/ARCHITECTURE.md §3). Off by default: subclasses that draw extra parts at
   * Math.round positions after `super.draw` would drift against the body. Classes that draw only
   * through `draw` / `drawTint` (the ams locals) turn it on.
   */
  protected fineDraw = false;

  override draw(r: Renderer): void {
    if (this.dead && this.deathAnimDone && this.deathTicks % 4 < 2 && this.corpseLeft < 20) return;
    if (!this.anim.id) return;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0;
    const fine = this.fineDraw;
    r.sprite(this.anim.id, this.anim.index, fine ? this.x : Math.round(this.x), fine ? this.y : Math.round(this.y), drawOpts);
  }

  /** Draw a coloured flash over the sprite (attack telegraphs); call after `super.draw(r)`. */
  drawTint(r: Renderer, color: Color, alpha: number): void {
    if (!this.anim.id) return;
    tintOpts.flipX = this.facing < 0;
    tintOpts.tint = color;
    tintOpts.alpha = alpha;
    const fine = this.fineDraw;
    r.sprite(this.anim.id, this.anim.index, fine ? this.x : Math.round(this.x), fine ? this.y : Math.round(this.y), tintOpts);
  }

  // ------------------------------------------------------------------------------- awareness

  /** Nearest alive player (null when everyone is dead). */
  target(): Entity | null {
    return this.world.nearestPlayer(this.x, this.y);
  }

  dxTo(e: Entity): number {
    return e.x - this.x;
  }

  dyTo(e: Entity): number {
    return e.y - this.y;
  }

  distTo(e: Entity): number {
    return Math.hypot(e.x - this.x, e.y - this.y);
  }

  /** Is the entity in front (on the facing side)? */
  isFacing(e: Entity): boolean {
    return Math.sign(e.x - this.x) === this.facing || e.x === this.x;
  }

  /** Turn toward the nearest player. Returns it. */
  facePlayer(): Entity | null {
    const t = this.target();
    if (t && Math.abs(t.x - this.x) > 2) this.facing = t.x < this.x ? -1 : 1;
    return t;
  }

  /** |dx| ≤ rx and |dy| ≤ ry. */
  inRange(e: Entity, rx: number, ry = Infinity): boolean {
    return Math.abs(e.x - this.x) <= rx && Math.abs(e.y - this.y) <= ry;
  }

  /** No ground or solid between the eyes and the target's chest. */
  canSee(e: Entity): boolean {
    const eyeY = this.y + this.hitbox.y * 0.8;
    const ty = e.y + e.hitbox.y * 0.5;
    return this.world.terrain.lineOfSight(this.x, eyeY, e.x, ty);
  }

  /** Notice the nearest player when it is within `sightRange` and the enemy is on screen. */
  checkAlert(): boolean {
    if (this.alerted) return true;
    const t = this.target();
    if (!t || !this.onScreen(-8) || !this.inRange(t, this.sightRange, 120)) return false;
    this.alert();
    return true;
  }

  /** Become alerted (calls onAlert once). */
  alert(): void {
    if (this.alerted) return;
    this.alerted = true;
    this.onAlert();
  }

  /** Hook: just noticed a player (play 'alert', shout …). */
  protected onAlert(): void {}

  // ------------------------------------------------------------------------------- attacking

  get mods(): DifficultyMods {
    return difficultyOf(this.world);
  }

  /** A fire interval scaled by difficulty (and jittered by up to ±`jitter` ticks, gameplay rng). */
  fireInterval(base: number, jitter = 0): number {
    const t = base * this.mods.enemyFireInterval;
    return Math.max(1, Math.round(jitter > 0 ? this.world.rng.jitter(t, jitter) : t));
  }

  /** HP for big enemies: scaled by difficulty and co-op. */
  scaledHp(base: number): number {
    const coop = playerCountOf(this.world) > 1 ? TUNING.coop.bigEnemyHp : 1;
    return Math.max(1, Math.round(base * this.mods.bigEnemyHp * coop));
  }

  /**
   * World position of a named point of the current frame (e.g. 'muzzle', 'hand'), mirrored for
   * the facing; `fx, fy` (relative to the anchor, unflipped) when the frame has no such point.
   */
  point(name: string, fx: number, fy: number, out: [number, number] = [0, 0]): [number, number] {
    const p = this.anim.id ? framePoint(getFrame(this.anim.id, this.anim.index), name, this.facing < 0, false, ptScratch) : undefined;
    out[0] = this.x + (p ? p[0] : fx * this.facing);
    out[1] = this.y + (p ? p[1] : fy);
    return out;
  }

  /** Angle from a point to the nearest player's chest (or straight ahead without a target). */
  aimAt(x: number, y: number, e: Entity | null = this.target()): number {
    if (!e) return this.facing > 0 ? 0 : Math.PI;
    return Math.atan2(e.y + e.hitbox.y * 0.5 - y, e.x - x);
  }

  /** Fire an enemy projectile (speed scaled by difficulty). Returns it. */
  shoot(o: EnemyShotOpts): Projectile {
    const m = this.point('muzzle', 14, -22, muzzleScratch);
    const a = o.angle ?? (this.facing > 0 ? 0 : Math.PI);
    const s = o.speed * this.mods.enemyBulletSpeed;
    const b = shotOpts;
    b.x = o.x ?? m[0];
    b.y = o.y ?? m[1];
    b.vx = Math.cos(a) * s;
    b.vy = Math.sin(a) * s;
    b.damage = o.damage;
    b.kind = o.kind;
    b.life = o.life ?? 180;
    b.gravity = o.gravity;
    b.w = o.w;
    b.h = o.h;
    b.sprite = o.sprite;
    b.impact = o.impact;
    b.look = o.look;
    b.shootable = o.shootable;
    b.hp = o.hp;
    b.soft = o.soft;
    b.offscreen = o.offscreen ?? 32;
    b.shooter = this;
    b.type = this.shotType;
    const p = Projectile.spawn(this.world, b);
    b.shooter = null;
    return p;
  }

  /** Entity type of this enemy's projectiles ('<type>-shot'), built once. */
  private get shotType(): string {
    if (!this.shotTypeId) this.shotTypeId = `${this.type || 'enemy'}-shot`;
    return this.shotTypeId;
  }

  // ------------------------------------------------------------------------------- death

  /** Points for this kill (knife kills of soft enemies score more). */
  scoreValue(d: Damage): number {
    const base = this.score ?? getEntityMeta(this.type)?.score ?? TUNING.score.enemy;
    return d.kind === 'knife' && this.soft ? base * TUNING.score.knifeMultiplier : base;
  }

  /**
   * Killed: score + 'enemyKilled' event, drop, a death animation picked by damage kind
   * (`die-knife`, `die-blast`, `die-burn`, falling back to `die`), knock-back for blasts.
   * Without any death sprite the enemy pops in a small explosion. Override `onDeath` for
   * machines (explode, leave a wreck …).
   */
  override die(d?: Damage): void {
    if (this.dead) return;
    this.dead = true;
    const dmg: Damage = d ?? { amount: this.hp, kind: 'impact', dirX: 0 };
    this.killedBy = dmg;
    this.deathTicks = 0;
    this.deathAnimDone = false;
    this.contactDamage = null;
    const owner = dmg.owner ?? -1;
    const points = this.scoreValue(dmg);
    awardScore(this.world, owner, points, this.x, this.y + this.hitbox.y);
    const slot = sessionOf(this.world).slot(owner);
    if (slot) {
      slot.stats.kills++;
      if (dmg.kind === 'knife') slot.stats.knifeKills++;
    }
    this.world.events.emit('enemyKilled', { enemy: this, damage: dmg, points, player: owner });
    this.dropItem();
    this.onDeath(dmg);
  }

  /** Hook: death presentation. Default: death animation by damage kind (see `die`). */
  protected onDeath(d: Damage): void {
    const anim = this.deathAnim(d.kind);
    if (!anim) {
      explosion(this.world, this.x, this.y + this.hitbox.y / 2, 's');
      this.remove();
      return;
    }
    this.play(anim, { restart: true, loop: false });
    if (this.body && d.kind === 'explosion') {
      // GDD §9.0: launched in an arc (vx ±1.5, vy −3.0).
      this.vx = (d.dirX || -this.facing) * 1.5;
      jump(this, -3);
    } else this.vx = 0;
  }

  /**
   * Death animation name for a damage kind (GDD §9.0), or null when not even 'die' exists:
   * knife → 'die-knife', explosion → 'die-blast', fire → 'die-burn', crush → 'die-crush', a hit
   * while frozen → 'die-shatter', everything else (bullet, laser, impact) → 'die'.
   */
  deathAnim(kind: DamageKind): string | null {
    const pick =
      this.reaction === 'freeze'
        ? 'die-shatter'
        : kind === 'knife'
          ? 'die-knife'
          : kind === 'explosion'
            ? 'die-blast'
            : kind === 'fire'
              ? 'die-burn'
              : kind === 'crush'
                ? 'die-crush'
                : 'die';
    if (pick !== 'die' && this.hasAnim(pick)) return pick;
    return this.hasAnim('die') ? 'die' : null;
  }

  /** Spawn the drop (if any) with a little hop. */
  protected dropItem(): void {
    const spec = this.drop;
    if (!spec) return;
    this.drop = null;
    const e = this.world.spawn(spec.id, this.x, this.y - 4, { dropped: true, ...spec.params });
    e.vy = TUNING.pickup.popVy;
  }

  private get corpseLeft(): number {
    return this.corpseTicks - this.deathTicks;
  }

  /** While dead: keep falling, play the death animation, then blink and vanish. */
  protected updateDeath(): void {
    if (this.body) {
      const c = this.physics();
      if (c?.onGround) this.vx *= 0.8;
    }
    this.anim.update();
    if (!this.deathAnimDone) {
      if (this.anim.done || !this.anim.id) this.deathAnimDone = true;
      return;
    }
    if (++this.deathTicks >= this.corpseTicks) this.remove();
  }

  /** Killed by falling out of the world: no score, just gone. */
  override onOutOfWorld(): void {
    this.dead = true;
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Spawn helpers
// ---------------------------------------------------------------------------------------------

/** An x just outside the view on `side` (margin px beyond the edge). */
export function offscreenX(world: World, side: Side, margin = 24): number {
  const cam = world.camera;
  return side === 'left' ? cam.left - margin : cam.right + margin;
}

/** The floor at x: first surface below `fromY` (default: the view top), or the view bottom − 46. */
export function floorY(world: World, x: number, fromY: number = world.camera.top): number {
  const y = world.terrain.surfaceY(x, fromY, Infinity);
  return Number.isFinite(y) ? y : world.camera.bottom - 46;
}

export interface FindFloorOpts {
  /** Surfaces below this y count (default: the view top). */
  fromY?: number;
  /** Search this side first (1 = right, -1 = left; default 1). */
  prefer?: 1 | -1;
  /** Furthest shift from x (default 128 px). */
  maxShift?: number;
  /** Keep the result inside [minX, maxX] (default: the section bounds). */
  minX?: number;
  maxX?: number;
}

/**
 * The nearest x (searching outward from `x` in 4 px steps) that has a floor below `fromY`, with
 * that floor's y — so spawns never land over a pit. Null when nothing is found within `maxShift`.
 */
export function findFloor(world: World, x: number, o: FindFloorOpts = {}): { x: number; y: number } | null {
  const t = world.terrain;
  const fromY = o.fromY ?? world.camera.top;
  const b = t.bounds;
  const minX = o.minX ?? b.x + 8;
  const maxX = o.maxX ?? b.x + b.w - 8;
  const prefer = o.prefer ?? 1;
  const max = o.maxShift ?? 128;
  for (let d = 0; d <= max; d += 4) {
    for (let k = 0; k < (d === 0 ? 1 : 2); k++) {
      const cx = x + (k === 0 ? prefer : -prefer) * d;
      if (cx < minX || cx > maxX) continue;
      const y = t.surfaceY(cx, fromY, Infinity);
      if (Number.isFinite(y)) return { x: cx, y };
    }
  }
  return null;
}

export interface OffscreenOpts {
  /** Feet y (default: the floor at the spawn x). */
  y?: number;
  margin?: number;
  params?: SpawnParams;
}

/**
 * Spawn an entity just outside the view, facing into it (enemies running in from the edge).
 * Adds `enter: side` to the params so the AI can tell.
 */
export function spawnOffscreen(world: World, id: string, side: Side, o: OffscreenOpts = {}): Entity {
  let x = offscreenX(world, side, o.margin ?? 24);
  let y = o.y;
  if (y === undefined) {
    // Never over a pit: the nearest floor, searching away from the view first.
    const spot = findFloor(world, x, { prefer: side === 'left' ? -1 : 1 });
    if (spot) {
      x = spot.x;
      y = spot.y;
    } else y = floorY(world, x);
  }
  return world.spawn(id, x, y, { facing: side === 'left' ? 1 : -1, enter: side, ...o.params });
}

/** The side of the view away from (or toward) the nearest player: waves come from behind or ahead. */
export function sideAwayFromPlayer(world: World, toward = false): Side {
  const p = world.nearestPlayer(world.camera.centerX, world.camera.centerY);
  const playerLeft = p ? p.x < world.camera.centerX : true;
  return playerLeft !== toward ? 'right' : 'left';
}

// ---------------------------------------------------------------------------------------------
// Shared enemy rules (GDD §4.11): attack tokens, telegraphs, gag awareness, knife combo
// ---------------------------------------------------------------------------------------------

const tokenSets = new WeakMap<World, Set<Entity>>();

/** Attack tokens per difficulty (GDD §4.10): EASY 3, NORMAL 4, HARD 6. */
export function attackTokenLimit(world: World): number {
  return difficultyOf(world).tokens;
}

/**
 * Take an attack token before a telegraph (true) or keep moving and try later (false). At most
 * `attackTokenLimit` enemies telegraph or attack at once (rule 4); bosses do not use tokens.
 * Dead / removed holders are swept out first.
 */
export function takeAttackToken(world: World, e: Entity): boolean {
  let set = tokenSets.get(world);
  if (!set) {
    set = new Set();
    tokenSets.set(world, set);
  }
  if (set.has(e)) return true;
  for (const h of set) if (!h.alive) set.delete(h);
  if (set.size >= attackTokenLimit(world)) return false;
  set.add(e);
  return true;
}

/** Give the token back after the attack's recovery (or when the attack is cancelled). */
export function releaseAttackToken(world: World, e: Entity): void {
  tokenSets.get(world)?.delete(e);
}

/** A telegraph length for the difficulty (×1.25 / ×1 / ×0.9), never below 18 ticks (rule 2). */
export function telegraphTicks(world: World, base: number): number {
  return Math.max(18, Math.round(base * difficultyOf(world).telegraph));
}

/** The gag double-take window for the difficulty (36 / 24 / 12 ticks). */
export function doubleTakeTicks(world: World): number {
  return difficultyOf(world).doubleTake;
}

const combos = new WeakMap<World, { n: number; tick: number }>();

/**
 * Knife kills in a row (GDD §6.2): returns 0 for the first, then +1 for each knife kill within
 * 180 ticks of the last (capped at 7) — the swoon note rises a major-scale step each time.
 */
export function knifeComboStep(world: World): number {
  let c = combos.get(world);
  if (!c) {
    c = { n: 0, tick: -1000 };
    combos.set(world, c);
  }
  c.n = world.tick - c.tick <= 180 ? c.n + 1 : 0;
  c.tick = world.tick;
  return Math.min(c.n, 7);
}

/** Where and when the last player explosion happened (gag soldiers notice it). */
interface BlastMemory {
  x: number;
  y: number;
  tick: number;
}
const blasts = new WeakMap<World, BlastMemory>();

/** The world's player-explosion memory (installs one 'explosion' listener per world). */
function blastMemory(world: World): BlastMemory {
  let b = blasts.get(world);
  if (!b) {
    const mem: BlastMemory = { x: 0, y: 0, tick: -1000 };
    blasts.set(world, mem);
    world.events.on('explosion', (e) => {
      if (e.team !== 'player') return;
      mem.x = e.x;
      mem.y = e.y;
      mem.tick = world.tick;
    });
    b = mem;
  }
  return b;
}

/** Call once when an enemy that uses `playerNoiseNear` is created (so no blast is missed). */
export function listenForBlasts(world: World): void {
  blastMemory(world);
}

/**
 * A player in sight for a gag check (rule 1): within `front` px ahead or `behind` px behind,
 * roughly level (|dy| ≤ maxDy), with the enemy on screen. Returns that player or null.
 */
export function noticesPlayer(e: Enemy, front = 160, behind = 48, maxDy = 110): Entity | null {
  const t = e.target();
  if (!t || !e.onScreen(-4)) return null;
  const dx = t.x - e.x;
  const ahead = Math.sign(dx) === e.facing;
  if (Math.abs(dx) > (ahead ? front : behind) || Math.abs(t.y - e.y) > maxDy) return null;
  return t;
}

/** A player shot within `r` px of the enemy's body, or a player explosion near it just now (rule 1). */
export function playerNoiseNear(e: Entity, r = 48): boolean {
  const shots = e.world.byTag('shot');
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (s.alive && s.team === 'player' && Math.abs(s.x - e.x) < r && Math.abs(s.y - (e.y - 16)) < r) return true;
  }
  const b = blastMemory(e.world);
  return e.world.tick - b.tick < 3 && Math.abs(b.x - e.x) < r + 24 && Math.abs(b.y - e.y) < r + 24;
}

/** Enemies that can be woken by a shouting ally implement this (duck-typed). */
export interface ShoutListener {
  hearShout(delay: number, from: Entity): void;
}

/** An alerted enemy shouts: allies within `range` px (and 64 px vertically) hear it after a random delay. */
export function shoutToAllies(e: Entity, range = 96): void {
  const list = e.world.byTag('enemy');
  for (let i = 0; i < list.length; i++) {
    const o = list[i] as Entity & Partial<ShoutListener>;
    if (o === e || !o.alive || typeof o.hearShout !== 'function') continue;
    if (Math.abs(o.x - e.x) < range && Math.abs(o.y - e.y) < 64) o.hearShout(e.world.rng.int(4, 18), e);
  }
}

/** Killed in a gag or before the double-take ended: CAUGHT NAPPING +100 for the killer (rule 1). */
export function caughtNapping(e: Entity, d: Damage): void {
  if (d.owner !== 0 && d.owner !== 1) return;
  awardScore(e.world, d.owner, 100, e.x, e.y - 48);
  hudOf(e.world).callout('CAUGHT NAPPING +100');
}

/** The gloat hold of each world: bumped once per hold (`startGloatHold`). */
const gloatHolds = new WeakMap<World, number>();

/**
 * A new gloat hold (the mission runner, when every player is out): every enemy that gloats in it
 * starts its gloat afresh (clock 0, its one line). Returns the hold's number (1, 2, …).
 */
export function startGloatHold(world: World): number {
  const n = (gloatHolds.get(world) ?? 0) + 1;
  gloatHolds.set(world, n);
  return n;
}

/** The world's current gloat hold (0 before the first). */
export function gloatHoldOf(world: World): number {
  return gloatHolds.get(world) ?? 0;
}

/**
 * A gag bubble over `e`, unless another live gag bubble already hangs within 56 × 32 px (two
 * enemies side by side would print their lines on top of each other). Returns false when skipped.
 * A shown line is voiced by its `speaker`'s sample when one is loaded (`HudState.onBubble`).
 */
export function gagBubble(world: World, e: { x: number; y: number }, text: string, ticks: number, speaker = ''): boolean {
  const hud = hudOf(world);
  const list = hud.bubbles;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.kind !== 'gag' || b.ticks <= 0 || b.target === e) continue;
    if (Math.abs(b.target.x - e.x) < 56 && Math.abs(b.target.y - e.y) < 32) return false;
  }
  hud.bubble(e, text, { ticks, kind: 'gag', speaker: speaker || undefined });
  return true;
}

export interface ReactFilter {
  /** Only entities with all of these tags (default ['enemy']). */
  tags?: readonly string[];
  /** Only enemies on screen. */
  onScreen?: boolean;
  /** Who caused it (passed to `react`). */
  source?: Entity | null;
  /** Skip this one (e.g. the sender itself). */
  exclude?: Entity | null;
}

/**
 * Ask every Enemy whose hitbox touches the circle / rect to react (see ReactionKind).
 * Returns how many accepted. Bosses are not Enemies and never react.
 * ```ts
 * reactInArea(world, { x: van.x, y: van.y - 20, r: 200 }, 'queue', 120, { tags: ['legion'], source: van });
 * reactInArea(world, world.camera.view(), 'photo', 45, { onScreen: true });   // SAY CHEESE
 * ```
 */
export function reactInArea(world: World, shape: Circle | Rect, kind: ReactionKind, ticks: number, f: ReactFilter = {}): number {
  const tags = f.tags ?? DEFAULT_REACT_TAGS;
  const list = world.snapshotTag(tags[0] ?? 'enemy');
  let n = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!(e instanceof Enemy) || !e.alive || e === f.exclude) continue;
      let ok = true;
      for (let k = 1; k < tags.length; k++) if (!e.hasTag(tags[k])) ok = false;
      if (!ok || (f.onScreen && !e.onScreen(0))) continue;
      const box = e.hitRect();
      const hit = 'r' in shape ? distToRect(shape.x, shape.y, box) <= shape.r : overlaps(shape, box);
      if (hit && e.react(kind, ticks, f.source ?? null)) n++;
    }
  } finally {
    world.releaseSnapshot();
  }
  return n;
}

const DEFAULT_REACT_TAGS: readonly string[] = ['enemy'];
