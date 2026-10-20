/**
 * Shared base and helpers for the transport machines (GDD §9.2, §9.5).
 *
 * `TransportMachine` (an Enemy subclass, no physics body: every machine moves itself):
 * - Not knifeable (`soft: false`); HP scales with difficulty and co-op (`big`).
 * - Damage states (GDD §9.2 "Shared"): at 50 % HP smoke and a dented plate, at 25 % flames and
 *   sparks. `damageState` 1 / 2; `draw()` swaps `<strip>` for `<strip>-dmg` when that strip is
 *   registered; `damageFx()` adds the smoke, flames and sparks at `smokeX/smokeY`.
 * - Spawn armour (GDD §9.2): while `armourTicks > 0` shots ping off (sparks + `hit/metal`, the
 *   shot is absorbed, no damage). It counts down every tick; machines that stop clear it.
 * - Attack tokens and telegraphs (GDD §4.11): `takeToken()` / `releaseToken()`, `tele(base)`.
 * - Reactions: machines take only SAY CHEESE ('photo'): they hold still, attacks are cancelled
 *   (`cancelAttack()`), no attacks while it lasts.
 * - Death: score, stats and 'enemyKilled' (or only the score for props: `countsAsKill`
 *   false — GDD §9.5 "not counted as enemies"), the `drop` param, then `onDeath(d)`. The
 *   entity stays in the world (wrecks, crash sequences) until the subclass removes it.
 *
 * Helpers for carriers (rowboat, tank-barge, parade-float): `Deck` (a dynamic solid that carries
 * riders and keeps them on board), `travelDir`, `parseSpecs`, `riderParams`.
 */
import type { Damage } from '../../../../engine/entity';
import { Entity } from '../../../../engine/entity';
import { overlaps, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import { SolidBox } from '../../../../engine/physics';
import { frameH, frameW, type DrawOpts, type Renderer } from '../../../../engine/render';
import { getFrame, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { sessionOf } from '../../../context';
import { Enemy, everyEnemyReacts, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { awardScore } from '../../../events';
import { debris, FX_FLAME, FX_SMOKE, FX_SPARK } from '../../../fx';
import { paramFacing, type SpawnParams, type SpawnSpec } from '../../../registry';

/** Ticks between two hit sounds of one machine (a machine-gun stream should not buzz). */
const HIT_SFX_GAP = 6;

export interface MachineOpts {
  /** Sprite prefix ('machine/band-truck'). */
  art: string;
  hp: number;
  /** Hurtbox size. */
  w: number;
  h: number;
  /** Anchor at the hull centre (flyers) instead of the feet. */
  centred?: boolean;
  /** Spawn armour ticks (GDD §9.2: 240 for machines that drive in; default 0 = none). */
  armour?: number;
  /** Counts as an enemy kill (stats, 'enemyKilled'). False for the 9.5 props. Default true. */
  countsAsKill?: boolean;
  /** Points (default: the registry meta score). */
  score?: number;
}

const drawOpts: DrawOpts = {};
const flashOpts: DrawOpts = { tint: PAL.snow[3], alpha: 0.55 };

export class TransportMachine extends Enemy {
  /** 0 = fine, 1 = at most 50 % HP (smoke, dented plate), 2 = at most 25 % (flames, sparks). */
  damageState: 0 | 1 | 2 = 0;
  /** Spawn armour: shots ping off while > 0 (counts down every tick). */
  armourTicks: number;
  /** Ticks since death (wrecks, crash sequences). */
  deadT = 0;
  /** Smoke / flame source relative to the anchor (unflipped), for the damage states. */
  protected smokeX = 0;
  protected smokeY = -20;
  /** Extra vertical draw offset (bobbing, braking nods). */
  protected drawDy = 0;
  /** Holds an attack token (GDD §4.11 rule 4). */
  protected holdsToken = false;
  protected readonly countsAsKill: boolean;
  private lastHitSfx = -100;
  private readonly dmgIds = new Map<string, string>();

  constructor(world: World, x: number, y: number, p: SpawnParams, o: MachineOpts) {
    super(world, x, y, p, { art: o.art, hp: o.hp, w: o.w, h: o.h, soft: false, body: false, big: true, score: o.score });
    if (o.centred) this.hitbox = { x: -o.w / 2, y: -o.h / 2, w: o.w, h: o.h };
    this.armourTicks = o.armour ?? 0;
    this.countsAsKill = o.countsAsKill ?? true;
    // Params are applied after construction (registry); read the facing ourselves.
    this.facing = paramFacing(p, -1);
    this.addTag('machine');
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (this.armourTicks > 0) this.armourTicks--;
    super.update();
    if (!this.dead) this.damageFx();
  }

  /** Smoke at ≤ 50 % HP; flames and sparks at ≤ 25 % (cosmetic, fxRng). */
  protected damageFx(): void {
    if (this.damageState === 0) return;
    const w = this.world;
    const sx = this.x + this.smokeX * this.facing;
    const sy = this.y + this.smokeY;
    if (this.age % 8 === 0) w.particles.emit(FX_SMOKE, sx + w.fxRng.range(-3, 3), sy, w.fxRng.range(-0.2, 0.2), -0.5);
    if (this.damageState < 2) return;
    if (this.age % 3 === 0) w.particles.emit(FX_FLAME, sx + w.fxRng.range(-4, 4), sy + 2, 0, -0.6);
    if (this.age % 24 === 0) w.particles.burst(FX_SPARK, sx, sy + 2, 4, 0.6, 2, -Math.PI / 2, 2);
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, _part = 0): boolean {
    if (!this.alive) return false;
    if (this.armourTicks > 0 && d.kind !== 'crush') {
      this.ping(d);
      return true; // the shot stops on the plating
    }
    if (this.invulnTicks > 0 && d.kind !== 'crush') return false;
    this.hp -= d.amount;
    this.flashTicks = 4;
    this.hitSound();
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(d);
    } else this.updateDamageState();
    return true;
  }

  /** A shot pings off the spawn armour: sparks where it struck and a metal tink. */
  protected ping(d: Damage): void {
    const s = d.source;
    const x = s ? s.x : this.x;
    const y = s ? s.y : this.y + this.hitbox.y + this.hitbox.h / 2;
    this.world.particles.burst(FX_SPARK, x, y, 4, 1, 2.6, d.dirX > 0 ? Math.PI : 0, 1.8);
    this.hitSound();
  }

  protected hitSound(): void {
    const t = this.world.tick;
    if (t - this.lastHitSfx < HIT_SFX_GAP) return;
    this.lastHitSfx = t;
    this.world.audio.sfx('hit/metal', { vol: 0.6 });
  }

  /** Recompute `damageState` from the HP fraction; a puff of debris when it gets worse. */
  protected updateDamageState(): void {
    const f = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    const s: 0 | 1 | 2 = f <= 0.25 ? 2 : f <= 0.5 ? 1 : 0;
    if (s <= this.damageState) return;
    this.damageState = s;
    const sx = this.x + this.smokeX * this.facing;
    const sy = this.y + this.smokeY;
    debris(this.world, sx, sy, 'metal', s === 1 ? 4 : 6);
    this.world.particles.burst(FX_SPARK, sx, sy, 6, 1, 2.8);
  }

  // ------------------------------------------------------------------------------- fairness

  /** A telegraph length for the difficulty (×1.25 / ×1 / ×0.9), never below 18 ticks. */
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

  /** Is a world point inside the view (GDD §4.11 rule 3: 8 px margin)? */
  protected inView(px: number, py: number, margin = -8): boolean {
    return this.world.camera.containsPoint(px, py, margin);
  }

  /** Hook: drop a running telegraph (reactions, the view scrolled away). */
  protected cancelAttack(): void {
    this.releaseToken();
  }

  // ------------------------------------------------------------------------------- reactions

  /** SAY CHEESE and the in-world continue (laugh, cower): the machine holds still (no attacks). Nothing else. */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    return everyEnemyReacts(kind);
  }

  protected override onReact(): void {
    this.cancelAttack();
  }

  /** Hold still and keep the current strip (machines have no photo pose). */
  protected override thinkReaction(): void {
    this.vx = 0;
    this.vy = 0;
  }

  // ------------------------------------------------------------------------------- death

  /**
   * Killed: score (+ stats and 'enemyKilled' unless a prop), the `drop` param (or
   * `defaultDrop()`), then `onDeath(d)`. Never calls the Enemy death animation: machines
   * explode and leave wrecks (subclasses), and remove themselves when done.
   */
  override die(d?: Damage): void {
    if (this.dead) return;
    this.dead = true;
    const dmg: Damage = d ?? { amount: this.hp, kind: 'impact', dirX: 0 };
    this.killedBy = dmg;
    this.deadT = 0;
    this.contactDamage = null;
    this.releaseToken();
    const owner = dmg.owner ?? -1;
    const points = this.scoreValue(dmg);
    awardScore(this.world, owner, points, this.x, this.y + this.hitbox.y);
    if (this.countsAsKill) {
      const slot = sessionOf(this.world).slot(owner);
      if (slot) slot.stats.kills++;
      this.world.events.emit('enemyKilled', { enemy: this, damage: dmg, points, player: owner });
    }
    if (this.drop) this.dropItem();
    else this.defaultDrop();
    this.onDeath(dmg);
  }

  /** Drop when no `drop` param was given (drop tables). Default: nothing. */
  protected defaultDrop(): void {}

  /** Death presentation. Default: remove at once (subclasses explode and leave wrecks). */
  protected override onDeath(_d: Damage): void {
    this.remove();
  }

  /** While dead: count the ticks (subclasses run their wreck / crash here). */
  protected override updateDeath(): void {
    this.deadT++;
    this.anim.update();
  }

  override onRemove(): void {
    this.releaseToken();
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  /** `<strip>-dmg` once the machine is damaged (when that strip is registered). */
  protected bodySprite(id: string): string {
    if (this.damageState === 0) return id;
    let d = this.dmgIds.get(id);
    if (d === undefined) {
      d = hasSprite(`${id}-dmg`) ? `${id}-dmg` : id;
      this.dmgIds.set(id, d);
    }
    return d;
  }

  /** Draw a strip at the anchor (+ `drawDy`), flipped by the facing, with a soft hit flash. */
  protected drawStrip(r: Renderer, id: string, frame: number, dx = 0, dy = 0, flash = true): void {
    const x = Math.round(this.x + dx * this.facing);
    const y = Math.round(this.y + this.drawDy + dy);
    drawOpts.flipX = this.facing < 0;
    r.sprite(id, frame, x, y, drawOpts);
    // Machines take long streams of fire: a light tint every other tick instead of a white box.
    if (flash && this.flashTicks > 0 && (this.flashTicks & 1) === 1) {
      flashOpts.flipX = drawOpts.flipX;
      r.sprite(id, frame, x, y, flashOpts);
    }
  }

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    this.drawStrip(r, this.bodySprite(this.anim.id), this.anim.index);
  }
}

const clipOpts: DrawOpts = { src: { x: 0, y: 0, w: 0, h: 0 } };

/**
 * Draw a sprite frame cut off at the world line `clipY` (only the rows above it): boats and
 * pianos in the water show just what sticks out of it, with or without a front water layer.
 */
export function drawAbove(r: Renderer, id: string, frame: number, x: number, y: number, flipX: boolean, clipY: number): void {
  const f = getFrame(id, frame);
  const rows = Math.round(clipY) - (Math.round(y) - f.oy);
  if (rows <= 0) return;
  const src = clipOpts.src as { x: number; y: number; w: number; h: number };
  src.w = frameW(f);
  src.h = Math.min(frameH(f), rows);
  clipOpts.flipX = flipX;
  r.sprite(id, frame, Math.round(x), Math.round(y), clipOpts);
}

// ---------------------------------------------------------------------------------------------
// Spawn-param helpers
// ---------------------------------------------------------------------------------------------

/**
 * Travel direction from the spawn params (1 = to the right): `dir` ('left' | 'right' | ±1),
 * else the side it comes from (`from`, or `enter` set by `ctx.enter`), else `facing`, else
 * `fallback` (most rows say "right to left").
 */
export function travelDir(p: SpawnParams, fallback: 1 | -1 = -1): 1 | -1 {
  const dir = p.dir;
  if (dir === 'left' || dir === -1) return -1;
  if (dir === 'right' || dir === 1) return 1;
  const from = p.from ?? p.enter;
  if (from === 'right') return -1;
  if (from === 'left') return 1;
  if ('facing' in p) return paramFacing(p, fallback);
  return fallback;
}

/**
 * A list of spawn specs: `'id'`, `{ id, params }`, a list of those (kept in order, unlike
 * `paramSpawn`, which picks one), or a count map `{ rifleman: 3, cymbalist: 1 }`.
 * Missing → `fallback`; an explicit empty list, `'none'`, `false` or `0` → nobody.
 */
export function parseSpecs(v: unknown, fallback: readonly SpawnSpec[]): SpawnSpec[] {
  if (v === 'none' || v === false || v === 0 || (Array.isArray(v) && v.length === 0)) return [];
  const out: SpawnSpec[] = [];
  const one = (x: unknown): void => {
    if (typeof x === 'string' && x) out.push({ id: x });
    else if (x && typeof x === 'object' && !Array.isArray(x)) {
      const o = x as { id?: unknown; params?: unknown };
      if (typeof o.id === 'string' && o.id) {
        out.push(o.params && typeof o.params === 'object' ? { id: o.id, params: o.params as SpawnParams } : { id: o.id });
      }
    }
  };
  if (Array.isArray(v)) for (const x of v) one(x);
  else if (typeof v === 'string') one(v);
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.id === 'string') one(o);
    else {
      for (const k of Object.keys(o)) {
        const n = o[k];
        if (typeof n === 'number' && n > 0) for (let i = 0; i < Math.min(16, Math.floor(n)); i++) out.push({ id: k });
      }
    }
  }
  return out.length > 0 ? out : fallback.slice();
}

/** Params passed on from a carrier to what it carries: the wave tag(s) and the Legion outfit. */
export function riderParams(p: SpawnParams, extra: SpawnParams): Record<string, unknown> {
  const o: Record<string, unknown> = { ...extra };
  if (p.tag !== undefined) o.tag = p.tag;
  if (p.tags !== undefined) o.tags = p.tags;
  if (typeof p.outfit === 'string') o.outfit = p.outfit;
  return o;
}

// ---------------------------------------------------------------------------------------------
// Deck: a dynamic solid that carries riders and keeps them on board
// ---------------------------------------------------------------------------------------------

const deckRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * A moving platform for a carrier (boat, raft, float). `move()` carries everything that stands
 * on it (players too). Registered riders (crews, the barge's tank, a tied hostage) are kept on
 * board: while one stands on the deck its x is clamped inside the edges, so an AI that wants to
 * walk away stays aboard. The carrier must update before its riders (spawn them after it).
 * Riders without a body are carried by hand (x moves with the deck, feet on its top).
 */
export class Deck {
  readonly box: SolidBox;
  readonly riders: Entity[] = [];
  /** Riders kept on board: return false to let one go (a freed hostage walks off). */
  keep: ((e: Entity) => boolean) | null = null;
  private readonly world: World;

  constructor(owner: Entity, x: number, y: number, w: number, h: number, oneWay: boolean) {
    this.world = owner.world;
    this.box = new SolidBox(x, y, w, h, oneWay, owner);
    this.world.addSolid(this.box);
  }

  /** Top of the deck (riders' feet). */
  get top(): number {
    return this.box.y;
  }

  get enabled(): boolean {
    return this.box.enabled;
  }

  attach(e: Entity): void {
    if (!this.riders.includes(e)) this.riders.push(e);
  }

  /** Move the deck, carrying whatever stands on it (and pushing bodies in the way). */
  move(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.world.moveSolid(this.box, dx, dy);
    for (let i = 0; i < this.riders.length; i++) {
      const e = this.riders[i];
      if (!e.body && e.alive) {
        e.x += dx;
        e.y = this.box.y;
      }
    }
  }

  /**
   * Keep riders standing on the deck inside its edges. Riders that left (jumped or were blown
   * off and landed elsewhere), let go (`keep`) or are gone are dropped from the list.
   */
  keepRiders(): void {
    const box = this.box;
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const e = this.riders[i];
      if (e.removed || (this.keep && !this.keep(e))) {
        this.riders.splice(i, 1);
        continue;
      }
      if (e.dead || !box.enabled) continue;
      const b = e.body;
      if (!b) continue;
      if (b.onGround && b.supportSolid !== box) {
        this.riders.splice(i, 1); // stepped off onto something else
        continue;
      }
      if (!b.onGround || b.supportSolid !== box) continue;
      const half = Math.min(b.w / 2, box.w / 2);
      const lo = box.x + half;
      const hi = box.x + box.w - half;
      if (e.x < lo) e.x = lo;
      else if (e.x > hi) e.x = hi;
    }
  }

  /** Riders still aboard and alive. */
  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.riders.length; i++) if (this.riders[i].alive) n++;
    return n;
  }

  /** Stop carrying (the deck breaks or sinks): riders fall. */
  disable(): void {
    this.box.enabled = false;
  }

  /** Take the box out of the world. */
  destroy(): void {
    this.box.enabled = false;
    this.world.removeSolid(this.box);
    this.riders.length = 0;
  }

  /** The deck rect (shared scratch). */
  rect(): Rect {
    deckRect.x = this.box.x;
    deckRect.y = this.box.y;
    deckRect.w = this.box.w;
    deckRect.h = this.box.h;
    return deckRect;
  }

  /** Is a rect touching the deck's top surface (standing on it)? */
  standsOn(r: Rect): boolean {
    const box = this.box;
    return r.x < box.x + box.w && r.x + r.w > box.x && Math.abs(r.y + r.h - box.y) < 1.5;
  }
}

/** Does any alive player-team body (a player on foot or a driven vehicle) overlap `r`? */
export function playerBodyIn(world: World, r: Rect): boolean {
  const players = world.byTag('player');
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.alive && p.body && overlaps(p.hitRect(), r)) return true;
  }
  const vehicles = world.byTag('vehicle');
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.alive && v.team === 'player' && overlaps(v.hitRect(), r)) return true;
  }
  return false;
}

/** Is `e` an alive entity of the player team that can be hurt (a player or a driven vehicle)? */
export function isPlayerTarget(e: Entity): boolean {
  return e.alive && e.team === 'player' && e.hasTag('shootable');
}
