/**
 * Boss base class (docs/ARCHITECTURE.md §6, GDD §10.0): multi-part hurtboxes with per-part HP,
 * armour and weak-point multipliers; phases started at HP thresholds, each running an
 * attack-pattern script (world.scripts, owned by the boss); damage states at 50 % / 25 %; an
 * invulnerable intro; a big death sequence of chained explosions, then the 'bossDefeated' event.
 *
 * Two HP models:
 * - **Pool** (no part is `required`): hits go to the boss HP (`hp` option); parts with their own
 *   `hp` break on their own (`shared` also passes the damage on, never more than the part had).
 * - **Required parts** (GDD §10.0): the fight ends when every `required` part is destroyed. The
 *   boss HP, the HUD bar (`healthFrac`) and the phase thresholds follow the remaining HP of the
 *   required parts; parts without HP only ping. Override `onRequiredPartsGone` for a last gag.
 * Part flags: `knifeable` (the automatic knife may hit it), `contact` (touching it hurts — the
 * contact pass uses only these boxes, GDD §4.11 rule 5). Per-part art: `partSpriteId(p)` =
 * `<art>/<part>-<0|1|2>` by its damage state.
 *
 * ```ts
 * class Crusher extends Boss {
 *   constructor(w: World, x: number, y: number, p: SpawnParams) {
 *     super(w, x, y, p, { art: 'boss/crusher', name: 'THE CRUSHER', hp: 3000 });
 *     this.addPart('body', { box: { x: -40, y: -60, w: 80, h: 60 } });
 *     this.addPart('eye', { box: { x: 20, y: -70, w: 12, h: 12 }, multiplier: 2 });     // weak point
 *     this.addPart('shield', { box: { x: 40, y: -50, w: 10, h: 50 }, armored: true });  // blocks shots
 *     this.addPart('cannon', { box: { x: -50, y: -80, w: 20, h: 16 }, hp: 400 });       // breakable
 *     this.phases = [
 *       { at: 1, pattern: (b) => b.cycle([(b) => b.stomp(), (b) => b.volley()]) },
 *       { at: 0.4, name: 'rage', pattern: (b) => b.cycle([(b) => b.volley(), (b) => b.charge()], 10) },
 *     ];
 *   }
 *   *volley(): ScriptGen { for (let i = 0; i < 3; i++) { this.shoot(…); yield 20; } }
 * }
 * ```
 * Part indices are the order of `addPart` (the `part` argument of `onHit`). Disabled or
 * destroyed parts report an off-world box, so indices never shift.
 *
 * GDD §10 helpers: phases may start on a condition (`when`, e.g. "until 2 of 3 drones are
 * gone": `when: (b) => b.brokenCount(['a', 'b', 'c']) >= 2`) as well as at an HP fraction;
 * `say(text, { at })` puts a speech bubble at a speaker point (the captain on the bridge);
 * `telegraphFor` / `recoveryFor` / `volleySize` apply the difficulty (GDD §4.10, HARD +1
 * projectile per volley); `deathSequence()` replaces the default explosion chain with a script.
 */
import { Entity, type Damage } from '../engine/entity';
import { rectAt, type Rect } from '../engine/math';
import type { DrawOpts, Renderer } from '../engine/render';
import type { ScriptGen, ScriptHandle } from '../engine/script';
import { Animator, hasSprite, type PlayOpts } from '../engine/sprites';
import type { World } from '../engine/world';
import { difficultyOf, hudOf, playerCountOf, sessionOf, type BubbleKind, type BubbleTarget } from './context';
import { telegraphTicks } from './enemy';
import { awardScore } from './events';
import { debris, explosion, hitSpark, smokeTrail } from './fx';
import { eraseEnemyShots } from './projectile';
import { NO_PARAMS, getEntityMeta, paramNum, type SpawnParams } from './registry';
import { TUNING } from './tuning';

export interface BossOpts {
  /** Sprite prefix ('boss/crusher' → 'boss/crusher/idle'). */
  art: string;
  /** Display name for the health bar. */
  name: string;
  /** Base HP (scaled by difficulty and co-op). Spawn param `hp` overrides the base. */
  hp: number;
  /** Points for the kill (default: registry meta score, else TUNING.score.boss). */
  score?: number;
}

export interface BossPartOpts {
  /** Box relative to the anchor for the unflipped boss (mirrored when facing left). */
  box: Rect;
  /** Own HP pool: the part breaks at 0. Without one, hits go to the boss HP. */
  hp?: number;
  /** A part with its own HP also passes the damage on to the boss HP. Default false. */
  shared?: boolean;
  /** Damage multiplier: 2 = weak point, 0.5 = tough. Default 1. */
  multiplier?: number;
  /** Absorbs shots without taking damage. */
  armored?: boolean;
  /** Hittable from the start (default true). */
  enabled?: boolean;
  /** Must be destroyed to end the fight (needs `hp`); see the class notes. */
  required?: boolean;
  /** The automatic knife may hit this part (the boss becomes 'soft'; other parts stay safe). */
  knifeable?: boolean;
  /** Touching this part hurts players (`contactDamage`). */
  contact?: boolean;
}

export interface BossPart {
  readonly name: string;
  readonly index: number;
  box: Rect;
  hp: number;
  maxHp: number;
  /** Has its own HP pool. */
  readonly breakable: boolean;
  shared: boolean;
  multiplier: number;
  armored: boolean;
  enabled: boolean;
  destroyed: boolean;
  required: boolean;
  knifeable: boolean;
  contact: boolean;
  /** Hit-flash ticks of this part. */
  flash: number;
}

export interface BossPhase<B extends Boss = Boss> {
  /**
   * Starts when hp / maxHp ≤ this (the first phase normally uses 1). Optional when `when` is
   * given.
   */
  at?: number;
  /**
   * Starts when this returns true (checked after every hit, every broken part and on
   * `checkPhases()`), e.g. `(b) => b.brokenCount(['horn', 'calliope']) === 2`. With `at` too,
   * either one starts it.
   */
  when?: (boss: B) => boolean;
  name?: string;
  /** Attack script while the phase lasts (cancelled when the next phase starts). */
  pattern?: (boss: B) => ScriptGen;
  /** Called when the phase starts. */
  onEnter?: (boss: B) => void;
}

export type BossState = 'waiting' | 'intro' | 'fight' | 'dying' | 'done';

export interface BossSayOpts {
  /** Ticks on screen (default 120). */
  ticks?: number;
  /** Speaker point relative to the anchor for the unflipped boss (default: the top of the hitbox). */
  at?: readonly [number, number];
  /** 'gag' (default; hidden with SPEECH BUBBLES OFF) or 'radio' (always shown). */
  kind?: BubbleKind;
  /** false: the line is never voiced (BubbleOpts.voice). */
  voice?: boolean;
}

/** The point a boss speaks from (followed while the boss moves). */
class BossSpeaker implements BubbleTarget {
  dx = 0;
  dy = 0;
  readonly hitbox = { y: 0 };
  private readonly boss: Boss;
  constructor(boss: Boss) {
    this.boss = boss;
  }
  get x(): number {
    return this.boss.x + (this.boss.facing < 0 ? -this.dx : this.dx);
  }
  get y(): number {
    return this.boss.y + this.dy;
  }
  get removed(): boolean {
    return this.boss.removed;
  }
}

/** Hurtbox of a part that cannot be hit (keeps part indices stable). */
const OFF: Rect = { x: -1e9, y: -1e9, w: 0, h: 0 };
const viewScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
/** The contact boxes of the boss being asked (the contact pass uses them right away). */
const contactView: Rect[] = [];
const drawOpts: DrawOpts = {};
const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 };

export class Boss extends Entity {
  art: string;
  /** Health-bar name. */
  name: string;
  readonly anim = new Animator();
  readonly parts: BossPart[] = [];
  /** Phases in order of decreasing `at`. */
  phases: BossPhase<this>[] = [];
  /** Current phase index (-1 before the fight). */
  phase = -1;
  state: BossState = 'waiting';
  /** 0 healthy, 1 at ≤ 50 % HP, 2 at ≤ 25 % HP. */
  damageState: 0 | 1 | 2 = 0;
  score: number | null;
  /** Show the HUD health bar. */
  showBar = true;
  /** Start the intro on the first update (false: call `start()` yourself, e.g. from a section script). */
  autoStart = true;
  /** Length of the death sequence (ticks). */
  deathTicks = 150;
  /** Remove the boss after the death sequence (false: it stays as a wreck, drawn by you). */
  removeOnDeath = true;
  /** True once the death sequence finished ('bossDefeated' was emitted). */
  defeated = false;
  /**
   * Ticks of the intermission played before every phase after the first (GDD §10.0: 60 — the
   * boss and the players are invulnerable and enemy shots fade out). 0 = none.
   */
  phaseIntermission = 0;
  readonly params: SpawnParams;
  protected killer = -1;
  protected deathT = 0;
  private patternHandle: ScriptHandle | null = null;
  private deathScripted = false;
  private speaker: BossSpeaker | null = null;
  private readonly boxes: Rect[] = [];
  private readonly contacts: Rect[] = [];
  private readonly ids = new Map<string, string>();

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS, o: BossOpts) {
    super(world, x, y);
    this.params = params;
    this.art = o.art;
    this.name = o.name;
    this.score = o.score ?? null;
    this.team = 'enemy';
    this.z = 30;
    this.despawnMargin = Infinity;
    this.hp = this.maxHp = this.scaledHp(paramNum(params, 'hp', o.hp));
    this.addTag('enemy', 'boss', 'shootable');
  }

  /** Boss HP for a base value: × difficulty × co-op. */
  scaledHp(base: number): number {
    const coop = playerCountOf(this.world) > 1 ? TUNING.coop.bossHp : 1;
    return Math.max(1, Math.round(base * difficultyOf(this.world).bossHp * coop));
  }

  // ------------------------------------------------------------------------------- parts

  /** Add a hurtbox part (index = order of calls). */
  addPart(name: string, o: BossPartOpts): BossPart {
    const breakable = o.hp !== undefined;
    const hp = breakable ? this.scaledHp(o.hp as number) : Infinity;
    const p: BossPart = {
      name,
      index: this.parts.length,
      box: { ...o.box },
      hp,
      maxHp: hp,
      breakable,
      shared: o.shared ?? false,
      multiplier: o.multiplier ?? 1,
      armored: o.armored ?? false,
      enabled: o.enabled ?? true,
      destroyed: false,
      required: (o.required ?? false) && breakable,
      knifeable: o.knifeable ?? false,
      contact: o.contact ?? false,
      flash: 0,
    };
    if (o.required && !breakable) console.warn(`[boss] ${this.name}: required part "${name}" needs hp`);
    this.parts.push(p);
    this.boxes.push({ x: 0, y: 0, w: 0, h: 0 });
    this.contacts.push({ x: 0, y: 0, w: 0, h: 0 });
    if (p.knifeable) this.addTag('soft');
    if (p.required) this.refreshRequiredHp();
    // The hitbox (used for culling and on-screen tests) grows to cover every part.
    const hb = this.hitbox;
    if (this.parts.length === 1) this.hitbox = { ...o.box };
    else {
      const x0 = Math.min(hb.x, o.box.x);
      const y0 = Math.min(hb.y, o.box.y);
      const x1 = Math.max(hb.x + hb.w, o.box.x + o.box.w);
      const y1 = Math.max(hb.y + hb.h, o.box.y + o.box.h);
      this.hitbox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return p;
  }

  part(name: string): BossPart | undefined {
    return this.parts.find((p) => p.name === name);
  }

  /** Enable / disable a part (a hatch opens, a shield drops …). */
  setPart(name: string, enabled: boolean): void {
    const p = this.part(name);
    if (p) p.enabled = enabled;
  }

  /** Does the fight follow required parts (instead of the boss HP pool)? */
  get usesRequiredParts(): boolean {
    for (const p of this.parts) if (p.required) return true;
    return false;
  }

  /** hp / maxHp = the remaining / total HP of the required parts (required-parts model). */
  protected refreshRequiredHp(): void {
    let hp = 0;
    let max = 0;
    for (const p of this.parts) {
      if (!p.required) continue;
      hp += Math.max(0, p.hp);
      max += p.maxHp;
    }
    this.hp = hp;
    this.maxHp = max;
  }

  /** The knife may hit only parts flagged `knifeable` (weapons.meleeTargetIn / meleeStrike ask). */
  isKnifeable(part: number): boolean {
    return this.parts[part]?.knifeable === true;
  }

  /** Contact damage comes from parts flagged `contact` (else from every hittable part). */
  override contactBoxes(): readonly Rect[] {
    if (this.parts.length === 0) return super.contactBoxes();
    let flagged = false;
    for (const p of this.parts) if (p.contact) flagged = true;
    const flip = this.facing < 0;
    const out = this.contacts;
    let n = 0;
    for (const p of this.parts) {
      if (!p.enabled || p.destroyed || (flagged && !p.contact)) continue;
      rectAt(this.x, this.y, p.box, flip, out[n++]);
    }
    contactView.length = 0;
    for (let i = 0; i < n; i++) contactView.push(out[i]);
    return contactView;
  }

  /** Damage state of a part: 0 clean, 1 at ≤ 50 % HP, 2 at ≤ 25 % (or destroyed). */
  partState(p: BossPart): 0 | 1 | 2 {
    if (p.destroyed) return 2;
    if (!p.breakable) return this.damageState;
    const f = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    return f <= 0.25 ? 2 : f <= 0.5 ? 1 : 0;
  }

  /** Sprite id of a part in its damage state: `<art>/<part>-<state>` (GDD §15.6). */
  partSpriteId(p: BossPart): string {
    return this.spriteId(`${p.name}-${this.partState(p)}`);
  }

  /** World-space box of a part (reused rect; OFF when not hittable). */
  partRect(p: BossPart): Rect {
    return this.hurtboxes()[p.index] ?? OFF;
  }

  override hurtboxes(): readonly Rect[] {
    if (this.parts.length === 0) return super.hurtboxes();
    const flip = this.facing < 0;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      const out = this.boxes[i];
      if (p.enabled && !p.destroyed) rectAt(this.x, this.y, p.box, flip, out);
      else {
        out.x = OFF.x;
        out.y = OFF.y;
        out.w = 0;
        out.h = 0;
      }
    }
    return this.boxes;
  }

  /**
   * Damage goes to the hit part: armour absorbs, multipliers apply, breakable parts break (a hit
   * never takes more than the part had left, so the bar never runs ahead of the parts).
   */
  override onHit(d: Damage, part = 0): boolean {
    if (this.dead || this.removed) return false;
    const p = this.parts[part];
    if (this.state !== 'fight' || this.invulnTicks > 0 || (p && p.armored)) {
      // Invulnerable entrance, intermission or armour: the shot stops with a spark, no damage.
      if (d.kind === 'bullet' || d.kind === 'laser') this.world.audio.sfx('hit/armor');
      return true;
    }
    if (p && (!p.enabled || p.destroyed)) return false;
    const amount = d.amount * (p ? p.multiplier : 1);
    if (p) p.flash = 4;
    this.flashTicks = 4;
    const required = this.usesRequiredParts;
    if (p && p.breakable) {
      const dealt = Math.min(amount, Math.max(0, p.hp));
      p.hp -= dealt;
      if (p.hp <= 0) this.breakPart(p, d);
      if (required) {
        this.refreshRequiredHp();
        this.afterDamage();
        if (this.hp <= 0) this.onRequiredPartsGone(d);
        return true;
      }
      if (!p.shared) return true;
      this.hp -= dealt;
    } else if (required) {
      // A part without its own HP on a part-driven boss: it only pings.
      if (d.kind === 'bullet' || d.kind === 'laser') this.world.audio.sfx('hit/armor');
      return true;
    } else this.hp -= amount;
    this.afterDamage();
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(d);
    }
    return true;
  }

  /** Every required part is destroyed. Default: the death sequence. Override for a last gag. */
  protected onRequiredPartsGone(d: Damage): void {
    this.die(d);
  }

  /** Debug (F4 skip): destroy the boss at once, credited to `owner`. */
  kill(owner = -1): void {
    if (this.dead) return;
    const d: Damage = { amount: 1e9, kind: 'explosion', dirX: 0, owner };
    if (this.state === 'waiting' || this.state === 'intro') this.state = 'fight';
    for (const p of this.parts) if (p.required && !p.destroyed) this.breakPart(p, d);
    this.hp = 0;
    this.die(d);
  }

  /** A breakable part reached 0 HP: explode it, disable it, call the hook. */
  protected breakPart(p: BossPart, d: Damage): void {
    if (p.destroyed) return;
    p.hp = 0;
    p.destroyed = true;
    const r = rectAt(this.x, this.y, p.box, this.facing < 0);
    // GDD §10.0: fx/explosion-m with its own sound, boss/part-break.
    explosion(this.world, r.x + r.w / 2, r.y + r.h / 2, 'm', { debris: 'metal', silent: true });
    this.world.audio.sfx('boss/part-break');
    awardScore(this.world, d.owner, 1000, r.x + r.w / 2, r.y);
    this.onPartBroken(p);
  }

  /** Hook: a breakable part was destroyed. */
  protected onPartBroken(_p: BossPart): void {}

  /** How many of these parts (default: all) are destroyed. */
  brokenCount(names?: readonly string[]): number {
    let n = 0;
    for (const p of this.parts) if (p.destroyed && (!names || names.includes(p.name))) n++;
    return n;
  }

  /** Is the part there and not destroyed? (false for unknown names) */
  partAlive(name: string): boolean {
    const p = this.part(name);
    return p !== undefined && !p.destroyed;
  }

  // ------------------------------------------------------------------------------- difficulty

  /** A telegraph of `base` NORMAL ticks for the difficulty (never below 18; GDD §4.10, §4.11). */
  telegraphFor(base: number): number {
    return telegraphTicks(this.world, base);
  }

  /** A recovery / cooldown of `base` NORMAL ticks for the difficulty (× enemy fire interval). */
  recoveryFor(base: number): number {
    return Math.max(1, Math.round(base * difficultyOf(this.world).enemyFireInterval));
  }

  /** Projectiles in a volley of `n` (NORMAL): HARD adds one (GDD §10.0). */
  volleySize(n: number): number {
    return n + difficultyOf(this.world).extraVolley;
  }

  // ------------------------------------------------------------------------------- talk

  /**
   * A speech bubble from the boss (one at a time; a new line replaces the old one). `at` is the
   * speaker point (mirrored when the boss faces left); the bubble follows the boss.
   */
  say(text: string, o: BossSayOpts = {}): void {
    const sp = this.speaker ?? (this.speaker = new BossSpeaker(this));
    sp.dx = o.at ? o.at[0] : this.hitbox.x + this.hitbox.w / 2;
    sp.dy = o.at ? o.at[1] : this.hitbox.y;
    hudOf(this.world).bubble(sp, text, { ticks: o.ticks ?? 120, kind: o.kind ?? 'gag', voice: o.voice });
  }

  /** Remove the boss's speech bubble. */
  hush(): void {
    if (this.speaker) hudOf(this.world).clearBubble(this.speaker);
  }

  // ------------------------------------------------------------------------------- phases

  /** Start the fight: run the intro (invulnerable), then phase 0. */
  start(): void {
    if (this.state !== 'waiting') return;
    this.state = 'intro';
    const self = this;
    this.world.scripts.run(
      (function* bossIntro(): ScriptGen {
        yield* self.intro();
        self.state = 'fight';
        self.enterPhase(0);
      })(),
      { owner: this, name: `${this.type || 'boss'}.intro` },
    );
  }

  /** Entrance script (override; runs while invulnerable). Default: nothing. */
  *intro(): ScriptGen {}

  /**
   * Switch to phase i: cancel the running pattern, run the new one (after `phaseIntermission`
   * ticks for every phase but the first).
   */
  enterPhase(i: number): void {
    if (i < 0 || i >= this.phases.length || i === this.phase) return;
    const first = this.phase < 0;
    this.phase = i;
    this.patternHandle?.cancel();
    this.patternHandle = null;
    const ph = this.phases[i];
    ph.onEnter?.(this);
    const pause = first ? 0 : this.phaseIntermission;
    if (ph.pattern || pause > 0) {
      const self = this;
      const run = (function* phaseScript(): ScriptGen {
        if (pause > 0) yield self.intermission(pause);
        if (ph.pattern) yield* ph.pattern(self);
      })();
      this.patternHandle = this.world.scripts.run(run, { owner: this, name: `${this.type || 'boss'}.${ph.name ?? `phase${i}`}` });
    }
    this.world.events.emit('bossPhase', { boss: this, phase: i });
  }

  /**
   * A pause in the fight (GDD §10.0 phase-change gag): the boss and every player are
   * invulnerable for `ticks` and the enemy shots on screen fade out. Returns `ticks` (yield it).
   */
  intermission(ticks: number): number {
    this.invulnTicks = Math.max(this.invulnTicks, ticks);
    const players = this.world.byTag('player');
    for (let i = 0; i < players.length; i++) players[i].invulnTicks = Math.max(players[i].invulnTicks, ticks);
    eraseEnemyShots(this.world, this.world.camera.view(16, viewScratch));
    return ticks;
  }

  /** HP fraction 0..1. */
  get healthFrac(): number {
    return this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
  }

  /**
   * Start the latest phase whose `at` threshold or `when` condition is met (skips several at
   * once after a huge hit). Runs after every hit; call it when a condition changes otherwise.
   */
  checkPhases(): void {
    if (this.state !== 'fight' || this.dead) return;
    const f = this.healthFrac;
    let next = this.phase;
    for (let i = this.phase + 1; i < this.phases.length; i++) {
      const ph = this.phases[i];
      if ((ph.at !== undefined && f <= ph.at) || (ph.when !== undefined && ph.when(this))) next = i;
    }
    if (next !== this.phase && this.hp > 0) this.enterPhase(next);
  }

  private afterDamage(): void {
    const f = this.healthFrac;
    this.checkPhases();
    const ds: 0 | 1 | 2 = f <= 0.25 ? 2 : f <= 0.5 ? 1 : 0;
    if (ds > this.damageState) {
      this.damageState = ds;
      this.onDamageState(ds as 1 | 2);
    }
  }

  /** Hook: reached damage state 1 (≤ 50 %) or 2 (≤ 25 %). Default: a puff of debris. */
  protected onDamageState(_state: 1 | 2): void {
    const c = this.center();
    debris(this.world, c[0], c[1], 'metal', 6);
  }

  // ------------------------------------------------------------------------------- pattern helpers

  /**
   * Run patterns forever, picking a random one each time (never the same twice in a row when
   * there are several), with `gap` ticks between them: `pattern: (b) => b.cycle([a, b, c])`.
   */
  *cycle(patterns: ReadonlyArray<(boss: this) => ScriptGen>, gap = 30): ScriptGen {
    let last = -1;
    for (;;) {
      if (patterns.length === 0) {
        yield 60;
        continue;
      }
      let i = this.world.rng.int(0, patterns.length - 1);
      if (patterns.length > 1 && i === last) i = (i + 1) % patterns.length;
      last = i;
      yield* patterns[i](this);
      yield gap;
    }
  }

  /**
   * Run patterns forever in a fixed order (GDD attack cycles are written in order), with `gap`
   * ticks between them: `pattern: (b) => b.sequence([a, b, c])`.
   */
  *sequence(patterns: ReadonlyArray<(boss: this) => ScriptGen>, gap = 30): ScriptGen {
    for (let i = 0; ; i = (i + 1) % Math.max(1, patterns.length)) {
      if (patterns.length === 0) {
        yield 60;
        continue;
      }
      yield* patterns[i](this);
      yield gap;
    }
  }

  /** Random element (gameplay rng). */
  pick<T>(list: readonly T[]): T {
    return this.world.rng.pick(list);
  }

  // ------------------------------------------------------------------------------- tick / draw

  override update(): void {
    if (this.state === 'waiting' && this.autoStart) this.start();
    for (const p of this.parts) if (p.flash > 0) p.flash--;
    if (this.state === 'dying') {
      this.updateDeath();
      return;
    }
    if (this.state === 'done') return;
    this.think();
    this.anim.update();
    // Damaged bosses smoke.
    if (this.damageState > 0 && this.world.tick % (this.damageState === 2 ? 6 : 12) === 0) {
      const c = this.randomPoint();
      smokeTrail(this.world, c[0], c[1], true);
    }
  }

  /** Per-tick behaviour next to the pattern scripts (movement, facing …). Override. */
  protected think(): void {}

  spriteId(name: string): string {
    let id = this.ids.get(name);
    if (id === undefined) {
      id = `${this.art}/${name}`;
      this.ids.set(name, id);
    }
    return id;
  }

  play(name: string, o?: PlayOpts): void {
    this.anim.play(this.spriteId(name), o);
  }

  hasAnim(name: string): boolean {
    return hasSprite(this.spriteId(name));
  }

  override draw(r: Renderer): void {
    if (this.state === 'done' || !this.anim.id) return;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0 && this.world.tick % 2 === 0;
    r.sprite(this.anim.id, this.anim.index, Math.round(this.x), Math.round(this.y), drawOpts);
  }

  // ------------------------------------------------------------------------------- death

  /** Points for the kill. */
  scoreValue(): number {
    return this.score ?? getEntityMeta(this.type)?.score ?? TUNING.score.boss;
  }

  /** HP reached 0: patterns stop (they are owned by the boss) and the death sequence starts. */
  override die(d?: Damage): void {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dying';
    this.deathT = 0;
    this.killer = d?.owner ?? -1;
    this.patternHandle?.cancel();
    this.patternHandle = null;
    this.contactDamage = null;
    awardScore(this.world, this.killer, this.scoreValue(), this.x, this.y - 40);
    const slot = sessionOf(this.world).slot(this.killer);
    if (slot) slot.stats.bossKills++;
    this.onDeathStart();
    const seq = this.deathSequence();
    if (seq) {
      this.deathScripted = true;
      const self = this;
      // Not owned by the boss: owned scripts stop when their owner is dead.
      this.world.scripts.run(
        (function* bossDeath(): ScriptGen {
          yield* seq;
          if (!self.removed && self.state === 'dying') self.finishDeath(false);
        })(),
        { name: `${this.type || 'boss'}.death` },
      );
    }
  }

  /**
   * Hook: a scripted death sequence (GDD §10: the wheel rolls away, the drums explode one by
   * one …). Return a script to replace the default chain of explosions; when it ends, the boss
   * finishes (`finishDeath(false)`: 'bossDefeated', `onDefeated`, removal). Default null.
   * Use `this.deathT` (ticks since death) or your own waits; `explosion(...)` for the blasts.
   */
  protected deathSequence(): ScriptGen | null {
    return null;
  }

  /** Hook: the death sequence starts (play a 'die' animation …). */
  protected onDeathStart(): void {
    if (this.hasAnim('die')) this.play('die', { restart: true, loop: false });
  }

  /** Chained explosions over `deathTicks`, then a big one, 'bossDefeated' and removal. */
  protected updateDeath(): void {
    const t = this.deathT++;
    this.anim.update();
    if (this.deathScripted) return;
    if (t < this.deathTicks) {
      if (t % 7 === 0) {
        const c = this.randomPoint();
        explosion(this.world, c[0], c[1], t % 21 === 0 ? 'm' : 's', { silent: t % 14 !== 0, shake: 2 });
      }
      return;
    }
    this.finishDeath(true);
  }

  /**
   * End the death sequence: optional final 'xl' blast, then 'bossDefeated', `onDefeated` and
   * the removal (unless `removeOnDeath` is false). Called once.
   */
  protected finishDeath(bigBlast = true): void {
    if (this.defeated) return;
    if (bigBlast) {
      const c = this.center();
      explosion(this.world, c[0], c[1], 'xl', { debris: 'metal' });
      debris(this.world, c[0], c[1], 'metal', 16);
    }
    this.state = 'done';
    this.defeated = true;
    this.world.events.emit('bossDefeated', { boss: this, player: this.killer });
    this.onDefeated();
    if (this.removeOnDeath) this.remove();
  }

  /** Hook: the death sequence finished. */
  protected onDefeated(): void {}

  private readonly pt: [number, number] = [0, 0];

  /** Centre of the boss (middle of all part boxes, or of the hitbox). */
  center(): [number, number] {
    const boxes = this.hurtboxes();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.x === OFF.x && this.parts.length) {
        // Disabled part: use its local box anyway (the wreck still has that shape).
        const r = rectAt(this.x, this.y, this.parts[i].box, this.facing < 0, scratch);
        x0 = Math.min(x0, r.x);
        y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w);
        y1 = Math.max(y1, r.y + r.h);
        continue;
      }
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    }
    this.pt[0] = Number.isFinite(x0) ? (x0 + x1) / 2 : this.x;
    this.pt[1] = Number.isFinite(y0) ? (y0 + y1) / 2 : this.y - 20;
    return this.pt;
  }

  /** A random point inside one of the parts (cosmetic rng). */
  randomPoint(): [number, number] {
    const rng = this.world.fxRng;
    const n = this.parts.length;
    const box = n ? this.parts[rng.int(0, n - 1)].box : this.hitbox;
    const r = rectAt(this.x, this.y, box, this.facing < 0, scratch);
    this.pt[0] = r.x + rng.range(0, r.w);
    this.pt[1] = r.y + rng.range(0, r.h);
    return this.pt;
  }

  /** Spark at a part (e.g. armour pings). */
  sparkAt(p: BossPart, dirX: number): void {
    const r = this.partRect(p);
    hitSpark(this.world, r.x + r.w / 2, r.y + r.h / 2, dirX);
  }

  /** Bosses never fall out of the world on their own. */
  override onOutOfWorld(): void {}
}
