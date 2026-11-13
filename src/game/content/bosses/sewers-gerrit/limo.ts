/**
 * GOUDEN GERRIT (`sewers-gerrit`, docs/design/sewers.md §4.1) — the mini-boss at the end of
 * `sewers-a`: a long white stretch limo across the quay at the bridge head; Gerrit (gold suit, gold
 * chains, a white fur collar, a gold shotgun) rises out of the sunroof. Template: the parking scan
 * car (`bosses/ams-scan/car.ts`).
 *
 * Spawn it on the floor at the limo's middle, nose toward the heroes:
 * `ctx.spawn('sewers-gerrit', 2920, 'ground', { facing: -1 })`. It waits (`autoStart` false: the
 * section script calls `start()` when the arena locks; params `hpScale` for tests).
 *
 * - The limo is a dynamic SOLID (120 × 28, not one-way): its roof is a platform at y 148 (feet on
 *   the walk line 176). The wreck's solid turns one-way (stand on it, walk through it).
 * - Parts (required-parts model, HP × difficulty × co-op): `limo` 900, `gerrit` 500. Gerrit ducks
 *   into the car 60 ticks after each volley and is invulnerable while down (his part is off).
 * - Phase 1 (both parts > 50 %): THE SHOTGUN — tell 24 (he pumps it, a gold glint,
 *   `sewers/shotgun-pump`) → 3 pellets (`sewers/shotgun`) from the sunroof: the middle one at the
 *   target's chest (24 px over his feet), one 10° above, one 10° below. Far from the limo the low
 *   pellet hits the cobbles short of the hero and the high one passes over: a crouch dodges all;
 *   close to the limo the low pellet reaches a crouch: jump it. THE BACK DOOR: a bodyguard steps out
 *   at the nose (the first after 240 ticks, then every 480; at most 2 alive; never while `holdAdds`).
 * - Phase 2 (the limo ≤ 50 %, or Gerrit knocked out; between attacks; it opens with the roll): THE HORN — tell 30 (the horn,
 *   the car rocks on its springs) → the limo rolls 64 px toward the heroes and back (only the nose
 *   hurts, only on the way out: jump onto the roof or step back); THE GOLD CHAIN — tell 24 (he swings
 *   it over his head, `enemy/windup`) → an arc lob at the hero, shootable (10 HP); volleys between.
 * - The in-world continue: every hero out → Gerrit admires his gold teeth (the gloat), no new
 *   bodyguards; a continued hero lands → the base stagger (shocked look), never in the middle of a roll.
 * - The end: the limo breaks (the hood burns, the doors fall off, `MIJN LIMO!!`, `sewers/limo-wreck`);
 *   Gerrit jumps out and flees across the bridge into depth (cosmetic, untargetable, fades; drawn
 *   onto the painted bridge's deck, `FLEE_DECK`):
 *   `DIT IS NIET VOORBIJ!`. Then 'bossDefeated' (the section script waits on `defeated`). The wreck
 *   stays. A part that breaks first: the limo's wreck look comes at once (no roll); Gerrit knocked
 *   out first slumps in the sunroof (no more volleys or chains).
 */
import type { Damage } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer, SrcRect } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { difficultyOf } from '../../../context';
import { awardScore } from '../../../events';
import { debris, dust, explosion, FxEntity, muzzleFlash, smokeTrail, tumble } from '../../../fx';
import { isPlayer, type Player } from '../../../player/player';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { G, SEWERS_A } from '../../missions/sewers/terrain';
import { SEWERS_VOICE, sewersSayTicks } from '../../samples/sewers';
import { G_FIRE, G_GLOAT, G_IDLE, G_PUMP_A, G_PUMP_B, G_SHOCK, G_SHOUT, G_SLUMP, G_SWING, G_THROW, GERRIT_SPRITE, LIMO_WRECK } from './art';
import { GERRIT, GERRIT_ART, GERRIT_ID, GERRIT_NAME, GERRIT_TAG, GUARD_TAG } from './numbers';

const P_LIMO = 0;
const P_GERRIT = 1;
const DEG = Math.PI / 180;
/** Gerrit's muzzle and hand, relative to his figure's anchor (facing right). */
const MUZZLE: readonly [number, number] = [17, -31];
const HAND: readonly [number, number] = [6, -40];

/**
 * The flee's DRAWN path (cosmetic, wave P6b A): the painted bridge behind the limo, as the kit paints
 * it (tools/levelkit/missions/sewers/sw_a.py `BRIDGES[1]` = `SEWERS_A.bridges[1]`, parts_sw_a.py
 * `bridges_a`: the deck from depth 27 at the far kerb to 56 at the far quay, a 2.4 m hump, a 5 px
 * lift; the kit's perspective: horizon y 60, walk line 176, plane x = 192 + (x − 192) · s). Gerrit
 * hops from the sunroof onto the bridge head (`hop` ticks, `peak` px), then runs up the deck into
 * depth while he fades. The update's `fleeX` / `fleeY` stay as they were (the sims never see this).
 */
const FLEE_DECK = { span: SEWERS_A.bridges[1], d0: 27, d1: 56, rise: 2.4 * 13, lift: 5, horizon: 60, hop: 36, peak: 19 } as const;
const fleeAt: [number, number] = [0, 0];

const drawOpts: DrawOpts = {};
const gerritSrc: SrcRect = { x: 0, y: 0, w: 48, h: 48 };
const noseRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const SEAT = { aboard: 1 };
const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };

/** One attack: when its telegraph began and when it struck (ticks; −1 = not yet). */
export interface GerritAttackTrace {
  attack: 'volley' | 'roll' | 'chain' | 'door';
  tell: number;
  fire: number;
}

export class GerritLimo extends Boss {
  /** The limo's solid (its roof the platform at y 148). */
  readonly box: SolidBox;
  /** Where it stands (x); the roll moves it out and back. */
  readonly homeX: number;
  // Gerrit (look and attack state; the scripts set it, draw reads it).
  /** Pose (G_*), facing (world), how far he has sunk into the sunroof (px). */
  gPose = G_IDLE;
  gFace: 1 | -1 = -1;
  gSink: number = GERRIT.sun.sink;
  /** His part broke: he slumps in the sunroof. */
  gerritOut = false;
  // The limo.
  wrecked = false;
  rolling = false;
  returning = false;
  /** The springs' rock during the horn (px up). */
  rockY = 0;
  doorT = 0;
  nextDoor = Infinity;
  /** The headlights flash with the horn. */
  private hornT = 0;
  busy = false;
  /** Every attack in order (tests). */
  readonly trace: GerritAttackTrace[] = [];
  // The flee.
  private fleeOn = false;
  fleeX = 0;
  fleeY = 0;
  private fleeVy = 0;
  private fleeGround = 0;
  private fleeT = 0;
  private readonly contactList: Rect[] = [];
  private lastPing = 0;
  /**
   * Gerrit sits a little above the gun line, as the beer bike's riders do: the sim bot reads this
   * duck-typed hint (`seat.aboard`, sim/bot.ts "a rider seated a little above the gun") and hops to
   * fire at the top of the jump. Play never reads it.
   */
  readonly seat = SEAT;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: GERRIT_ART, name: GERRIT_NAME, hp: GERRIT.hp.limo + GERRIT.hp.gerrit, score: GERRIT.score });
    this.facing = paramFacing(p, -1);
    this.homeX = x;
    this.autoStart = false;
    this.removeOnDeath = false;
    this.z = 30;
    this.addTag(GERRIT_TAG);
    const scale = paramNum(p, 'hpScale', 1);
    this.addPart('limo', { box: { ...GERRIT.limo.box }, hp: Math.max(1, Math.round(GERRIT.hp.limo * scale)), required: true });
    this.addPart('gerrit', { box: { ...GERRIT.sun.box }, hp: Math.max(1, Math.round(GERRIT.hp.gerrit * scale)), required: true, enabled: false });
    this.contactDamage = { amount: 10, kind: 'impact', dirX: this.facing, source: this };
    const L = GERRIT.limo;
    this.box = world.addSolid(new SolidBox(x - L.halfW, y - L.roof, L.halfW * 2, L.roof, false, this));
    this.phases = [
      { at: 1, name: 'shotgun', pattern: (b) => b.phaseOne() },
      { when: (b) => b.hornReady(), name: 'horn', pattern: (b) => b.phaseTwo() },
    ];
  }

  // ------------------------------------------------------------------------------- queries

  /** The limo part's HP fraction. */
  get limoFrac(): number {
    const p = this.parts[P_LIMO];
    return p.maxHp > 0 ? Math.max(0, p.hp) / p.maxHp : 0;
  }

  /** Phase 2 may start: the limo at half or Gerrit knocked out, and no attack runs. */
  hornReady(): boolean {
    return !this.busy && (this.limoFrac <= 0.5 || !this.partAlive('gerrit'));
  }

  /** Gerrit's x (the sunroof, world). */
  get gerritX(): number {
    return this.x + this.facing * GERRIT.sun.x;
  }

  /** His figure's anchor y (world): the hips inside the car, plus the sink. */
  get gerritY(): number {
    return this.y - GERRIT.limo.roof + GERRIT.sun.hip + Math.round(this.gSink) - this.rockY;
  }

  /** The roof line (world y). */
  get roofY(): number {
    return this.y - GERRIT.limo.roof;
  }

  /** The nearest hero in play (on foot or riding). */
  target(): Player | null {
    const ps = this.world.players;
    let best: Player | null = null;
    let bd = Infinity;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!isPlayer(p) || (p.state !== 'play' && p.state !== 'mounted')) continue;
      const d = Math.abs(p.x - this.x);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private mark(attack: GerritAttackTrace['attack']): GerritAttackTrace {
    const tr: GerritAttackTrace = { attack, tell: this.world.tick, fire: -1 };
    this.trace.push(tr);
    return tr;
  }

  private faceTarget(): Player | null {
    const t = this.target();
    if (t) this.gFace = t.x < this.gerritX ? -1 : 1;
    return t;
  }

  // ------------------------------------------------------------------------------- intro

  override *intro(): ScriptGen {
    // Gerrit rises out of the sunroof, holds the shotgun up: GOUD IS GOUD!
    this.gSink = GERRIT.sun.sink;
    yield 20;
    yield* this.rise();
    this.faceTarget();
    this.gPose = G_SHOUT;
    this.world.audio.sfx('sewers/shotgun-pump');
    // The line waits until the WARNING banner (bossIntro, 120 ticks from the start) is gone (P2).
    yield GERRIT.sayAfter;
    this.say(SEWERS_VOICE.gerrit.gold, { at: GERRIT.sayAt, ticks: sewersSayTicks(SEWERS_VOICE.gerrit.gold) });
    yield 60;
    this.gPose = G_IDLE;
    this.nextDoor = this.world.tick + this.recoveryFor(GERRIT.door.first);
  }

  // ------------------------------------------------------------------------------- Gerrit's moves

  /** Out of the sunroof (his part turns on halfway). */
  *rise(): ScriptGen {
    const S = GERRIT.sun;
    while (this.gSink > 0) {
      this.gSink = Math.max(0, this.gSink - S.sink / S.rise);
      yield;
    }
  }

  /** Into the car, then `ticks` down (invulnerable). */
  *duckFor(ticks: number): ScriptGen {
    const S = GERRIT.sun;
    if (this.gerritOut) {
      yield ticks;
      return;
    }
    this.gPose = G_IDLE;
    while (this.gSink < S.sink) {
      this.gSink = Math.min(S.sink, this.gSink + S.sink / S.duck);
      yield;
    }
    yield ticks;
  }

  /**
   * THE SHOTGUN: rise, tell 24 (pump, glint), 3 pellets at the hero (middle at his chest, ±10°),
   * then up for 60 ticks (the window).
   */
  *volley(): ScriptGen {
    const V = GERRIT.volley;
    if (this.gerritOut) {
      yield 20;
      return;
    }
    this.busy = true;
    try {
      yield* this.rise();
      const tr = this.mark('volley');
      this.world.audio.sfx('sewers/shotgun-pump');
      this.glint();
      const tele = this.telegraphFor(V.tele);
      for (let i = 0; i < tele; i++) {
        this.faceTarget();
        this.gPose = Math.floor(i / 6) % 2 === 0 ? G_PUMP_A : G_PUMP_B;
        yield;
      }
      if (this.gerritOut) return;
      const t = this.faceTarget();
      this.firePellets(t);
      tr.fire = this.world.tick;
      this.gPose = G_FIRE;
      yield 8;
      for (let i = 0; i < V.up; i++) {
        if (this.gerritOut) return;
        this.faceTarget();
        this.gPose = G_IDLE;
        yield;
      }
    } finally {
      if (!this.gerritOut) this.gPose = G_IDLE;
      this.busy = false;
    }
  }

  /** The 3-pellet spread from the sunroof (no allocation: the shot options are reused). */
  private firePellets(t: Player | null): void {
    const V = GERRIT.volley;
    const mx = this.gerritX + this.gFace * MUZZLE[0];
    const my = this.gerritY + MUZZLE[1];
    let mid: number;
    if (t) {
      const dx = Math.max(8, Math.abs(t.x - mx));
      // His chest line: 24 px over the floor he stands on (in a jump: the quay under him).
      const feet = t.body?.onGround ? t.y : this.y;
      const dy = feet - V.chestY - my;
      mid = Math.max(V.minDeg * DEG, Math.min(V.maxDeg * DEG, Math.atan2(dy, dx)));
    } else mid = 8 * DEG;
    const speed = V.speed * difficultyOf(this.world).enemyBulletSpeed;
    const n = V.pellets;
    for (let k = 0; k < n; k++) {
      const a = mid + (k - (n - 1) / 2) * V.spreadDeg * DEG;
      shot.team = 'enemy';
      shot.x = mx;
      shot.y = my;
      shot.vx = Math.cos(a) * speed * this.gFace;
      shot.vy = Math.sin(a) * speed;
      shot.damage = 10;
      shot.kind = 'bullet';
      shot.gravity = 0;
      shot.w = V.size;
      shot.h = V.size;
      shot.life = V.life;
      shot.sprite = GERRIT_SPRITE.pellet;
      shot.look = 'angle';
      shot.shootable = false;
      shot.hp = undefined;
      shot.offscreen = 32;
      shot.shooter = this;
      shot.type = 'sewers-gerrit-shot';
      shot.score = 0;
      Projectile.spawn(this.world, shot);
    }
    shot.shooter = null;
    this.world.audio.sfx('sewers/shotgun');
    muzzleFlash(this.world, mx, my, this.gFace < 0 ? Math.PI : 0);
    this.world.camera.shake(1, 4);
  }

  /** The gold glint on the shotgun at the tell (look only). */
  private glint(): void {
    FxEntity.spawn(this.world, { sprite: GERRIT_SPRITE.glint, x: this.gerritX + this.gFace * 10, y: this.gerritY - 34, z: 61 });
  }

  /**
   * THE GOLD CHAIN: rise, tell 24 (he swings it over his head, `enemy/windup`), an arc lob to the
   * hero's x (shootable, 10 HP).
   */
  *chainLob(): ScriptGen {
    const C = GERRIT.chain;
    if (this.gerritOut) {
      yield 20;
      return;
    }
    this.busy = true;
    try {
      yield* this.rise();
      const tr = this.mark('chain');
      this.world.audio.sfx('enemy/windup');
      const tele = this.telegraphFor(C.tele);
      for (let i = 0; i < tele; i++) {
        this.faceTarget();
        this.gPose = G_SWING;
        yield;
      }
      if (this.gerritOut) return;
      const t = this.faceTarget();
      const x0 = this.gerritX + this.gFace * HAND[0];
      const y0 = this.gerritY + HAND[1];
      const tx = t ? t.x : x0 + this.gFace * 120;
      const g = C.gravity;
      const vy = -Math.sqrt(2 * g * C.peak);
      const land = this.y - 4;
      const tt = (-vy + Math.sqrt(vy * vy + 2 * g * (land - y0))) / g;
      shot.team = 'enemy';
      shot.x = x0;
      shot.y = y0;
      shot.vx = (tx - x0) / tt;
      shot.vy = vy;
      shot.damage = 10;
      shot.kind = 'impact';
      shot.gravity = g;
      shot.w = C.size;
      shot.h = C.size;
      shot.life = C.life;
      shot.sprite = GERRIT_SPRITE.chain;
      shot.look = 'anim';
      shot.shootable = true;
      shot.hp = C.hp;
      shot.offscreen = 48;
      shot.shooter = this;
      shot.type = 'sewers-gerrit-chain';
      shot.score = 50;
      Projectile.spawn(this.world, shot);
      shot.shooter = null;
      tr.fire = this.world.tick;
      this.gPose = G_THROW;
      yield 12;
      this.gPose = G_IDLE;
      yield this.recoveryFor(C.rec);
    } finally {
      if (!this.gerritOut) this.gPose = G_IDLE;
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------- the limo's moves

  /** Move the limo by dx (its solid carries riders and pushes bodies). */
  private shift(dx: number): void {
    this.x += dx;
    this.world.moveSolid(this.box, dx, 0);
  }

  /**
   * THE HORN: Gerrit ducks, tell 30 (the horn, the car rocks), the limo rolls 64 px toward the
   * heroes (its nose hurts) and back.
   */
  *hornRoll(): ScriptGen {
    const R = GERRIT.roll;
    if (!this.partAlive('limo')) {
      yield 20;
      return;
    }
    this.busy = true;
    let moved = 0;
    try {
      if (this.gSink < GERRIT.sun.sink && !this.gerritOut) yield* this.duckFor(0);
      const tr = this.mark('roll');
      this.world.audio.sfx('sewers/limo-horn');
      const tele = this.telegraphFor(R.tele);
      for (let i = 0; i < tele; i++) {
        this.rockY = Math.floor(i / 3) % 2;
        this.hornT = tele - i;
        yield;
      }
      this.rockY = 0;
      this.hornT = 0;
      if (!this.partAlive('limo')) return;
      const dir = this.facing;
      this.rolling = true;
      tr.fire = this.world.tick;
      let v = 0;
      for (let guard = 0; guard < 200 && moved < R.dist; guard++) {
        v = Math.min(R.speed, v + R.accel);
        const dx = Math.min(v, R.dist - moved);
        this.shift(dir * dx);
        moved += dx;
        if (guard % 5 === 0) dust(this.world, this.x - dir * 50, this.y, 1);
        yield;
      }
      this.rolling = false;
      this.world.audio.sfx('swan/skid', { pitch: 0.8, vol: 0.5 });
      dust(this.world, this.x + dir * 58, this.y, 3);
      yield R.pause;
      this.returning = true;
      for (let guard = 0; guard < 400 && moved > 0; guard++) {
        const dx = Math.min(R.back, moved);
        this.shift(-dir * dx);
        moved -= dx;
        yield;
      }
    } finally {
      this.rolling = false;
      this.returning = false;
      this.rockY = 0;
      this.hornT = 0;
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------- patterns

  /** Phase 1: volleys, Gerrit down between them. */
  *phaseOne(): ScriptGen {
    for (;;) {
      yield* this.volley();
      yield* this.duckFor(this.recoveryFor(GERRIT.volley.down));
    }
  }

  /** Phase 2: the horn roll (it opens the phase), a volley, the gold chain, again. */
  *phaseTwo(): ScriptGen {
    for (;;) {
      let acted = false;
      if (this.partAlive('limo')) {
        yield* this.hornRoll();
        yield this.recoveryFor(GERRIT.roll.rec);
        acted = true;
      }
      if (!this.gerritOut) {
        yield* this.volley();
        yield* this.duckFor(this.recoveryFor(30));
        acted = true;
      }
      if (!this.gerritOut) {
        yield* this.chainLob();
        yield* this.duckFor(this.recoveryFor(60));
        acted = true;
      }
      if (!acted) yield 30;
    }
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    // Phase 2 starts between attacks (never from inside the pattern script).
    if (this.phase === 0 && this.state === 'fight' && this.hornReady()) this.checkPhases();
    // Gerrit's part: hittable while up (from halfway out), never while down or knocked out.
    const gp = this.parts[P_GERRIT];
    gp.enabled = this.state === 'fight' && !this.gerritOut && this.gSink <= GERRIT.sun.sink / 2;
    if (this.doorT > 0) this.doorT--;
    this.backDoor();
    if (this.wrecked && this.world.tick % 9 === 0) smokeTrail(this.world, this.x + this.facing * this.world.fxRng.range(30, 56), this.y - 26, true);
  }

  /** THE BACK DOOR: a bodyguard steps out at the nose (phase 1; at most 2 alive; never while `holdAdds`). */
  private backDoor(): void {
    const D = GERRIT.door;
    if (this.state !== 'fight' || this.phase !== 0 || this.wrecked || this.world.tick < this.nextDoor) return;
    if (this.holdAdds || this.world.countAlive(GUARD_TAG) >= D.maxAlive) {
      this.nextDoor = this.world.tick + 30;
      return;
    }
    this.doorT = D.open;
    this.world.audio.sfx('swan/skid', { pitch: 1.6, vol: 0.3 });
    const x = this.x + this.facing * (GERRIT.limo.halfW + D.out);
    this.world.spawn('sewers-bodyguard', x, this.y, { facing: this.facing, tag: GUARD_TAG, look: this.trace.length % 2 === 0 ? 'a' : 'b' });
    const tr = this.mark('door');
    tr.fire = this.world.tick;
    this.nextDoor = this.world.tick + this.recoveryFor(D.every);
  }

  protected override canStagger(): boolean {
    // A limo in the middle of a roll finishes it first.
    return !this.rolling && !this.returning;
  }

  protected override onStagger(ticks: number): void {
    if (!this.gerritOut && this.gSink < GERRIT.sun.sink) this.say('!', { at: GERRIT.sayAt, ticks: Math.min(60, ticks), voice: false });
  }

  override contactBoxes(): readonly Rect[] {
    const out = this.contactList;
    out.length = 0;
    if (!this.rolling || this.state !== 'fight') return out;
    out.push(rectAt(this.x, this.y, GERRIT.roll.box, this.facing < 0, noseRect));
    return out;
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && part === P_LIMO && d.kind === 'bullet' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: 1.1 });
    }
    return hit;
  }

  /** Gerrit's part breaks without the metal blast (a person: he slumps); the limo's breaks as a machine. */
  protected override breakPart(p: BossPart, d: Damage): void {
    if (p.index !== P_GERRIT) {
      super.breakPart(p, d);
      return;
    }
    if (p.destroyed) return;
    p.hp = 0;
    p.destroyed = true;
    this.world.audio.sfx('enemy/die-2');
    awardScore(this.world, d.owner, 1000, this.gerritX, this.roofY - 30);
    this.onPartBroken(p);
  }

  protected override onPartBroken(p: BossPart): void {
    if (p.index === P_GERRIT) {
      this.gerritOut = true;
      this.gPose = G_SLUMP;
      this.gSink = 8;
      return;
    }
    this.wreckNow();
  }

  /** The limo breaks: the hood burns, the doors fall off, `MIJN LIMO!!` (once). */
  private wreckNow(): void {
    if (this.wrecked) return;
    this.wrecked = true;
    this.rolling = false;
    const w = this.world;
    w.audio.sfx('sewers/limo-wreck');
    explosion(w, this.x + this.facing * 50, this.y - 22, 'm', { debris: 'metal', shake: 3 });
    debris(w, this.x, this.y - 20, 'glass', 8);
    tumble(w, GERRIT_SPRITE.doorBit, this.x + this.facing * 10, this.y - 14, -this.facing * 0.2 + 0.6, -2.6, { life: 60 });
    tumble(w, GERRIT_SPRITE.doorBit, this.x + this.facing * 28, this.y - 14, this.facing * 0.9, -2.2, { life: 60 });
    if (this.gerritOut) this.say(SEWERS_VOICE.gerrit.limo, { at: GERRIT.sayAt, ticks: sewersSayTicks(SEWERS_VOICE.gerrit.limo) });
    else {
      this.gPose = G_SHOCK;
      this.say(SEWERS_VOICE.gerrit.limo, { at: GERRIT.sayAt, ticks: sewersSayTicks(SEWERS_VOICE.gerrit.limo) });
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.rolling = false;
    this.returning = false;
    this.rockY = 0;
    this.hornT = 0;
    this.doorT = 0;
    this.parts[P_GERRIT].enabled = false;
    // The wreck: stand on it, walk through it.
    this.box.oneWay = true;
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    const w = this.world;
    const D = GERRIT.death;
    return (function* gerritDeath(): ScriptGen {
      const already = self.wrecked;
      self.wreckNow();
      for (let k = 0; k < D.blasts; k++) {
        const c = self.randomPoint();
        explosion(w, c[0], c[1], 's', { silent: k % 2 === 1 });
        yield 8;
      }
      yield already ? D.jump : D.wreck;
      // Gerrit jumps out of the sunroof and runs off over the bridge, into depth.
      self.gPose = G_SHOUT;
      self.fleeOn = true;
      self.fleeX = self.gerritX;
      self.fleeY = self.roofY;
      self.fleeVy = -2.4;
      self.fleeGround = self.y;
      self.fleeT = 0;
      self.gSink = GERRIT.sun.sink + 20;
      self.say(SEWERS_VOICE.gerrit.notOver, { at: GERRIT.sayAt, ticks: sewersSayTicks(SEWERS_VOICE.gerrit.notOver) });
      w.audio.sfx('enemy/panic');
      yield D.flee;
      self.fleeOn = false;
    })();
  }

  override update(): void {
    super.update();
    if (this.state !== 'dying' && this.state !== 'done') return;
    const w = this.world;
    if (w.tick % 7 === 0) smokeTrail(w, this.x + this.facing * w.fxRng.range(30, 56), this.y - 26, true);
    if (!this.fleeOn) return;
    // The flee: a hop off the roof to the quay behind the limo, then a run up the bridge into depth.
    const D = GERRIT.death;
    this.fleeT++;
    this.fleeX += D.fleeVx * (this.facing < 0 ? 1 : -1);
    if (this.fleeVy !== 0 || this.fleeY < this.fleeGround) {
      this.fleeVy += 0.15;
      this.fleeY += this.fleeVy;
      if (this.fleeY >= this.fleeGround) {
        this.fleeY = this.fleeGround;
        this.fleeVy = 0;
      }
    } else {
      this.fleeGround += D.fleeVy;
      this.fleeY = this.fleeGround;
    }
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const dead = this.state === 'dying' || this.state === 'done';
    const x = Math.round(this.x);
    const y = Math.round(this.y) - this.rockY;
    const flash = (p: BossPart): boolean => !dead && p.flash >= 3;
    // Gerrit first (the car hides his legs): only the rows above the roof.
    if (!this.fleeOn && !(dead && this.gSink > GERRIT.sun.sink)) {
      const gy = Math.round(this.gerritY);
      const rows = 47 - (gy - Math.round(this.roofY - this.rockY));
      if (rows > 0) {
        gerritSrc.h = Math.min(48, rows);
        drawOpts.src = gerritSrc;
        drawOpts.flipX = this.gFace < 0;
        drawOpts.flash = flash(this.parts[P_GERRIT]);
        drawOpts.alpha = 1;
        r.sprite(GERRIT_SPRITE.gerrit, this.poseNow(), Math.round(this.gerritX), gy, drawOpts);
        drawOpts.src = undefined;
      }
    }
    // The limo (its damage state; the wreck), the open back door, the headlights with the horn.
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = flash(this.parts[P_LIMO]);
    drawOpts.alpha = 1;
    const frame = this.wrecked ? LIMO_WRECK : this.partState(this.parts[P_LIMO]);
    r.sprite(GERRIT_SPRITE.limo, frame, x, y, drawOpts);
    drawOpts.flash = false;
    if (this.doorT > 0 && !this.wrecked) r.sprite(GERRIT_SPRITE.door, 0, x, y, drawOpts);
    if (this.hornT > 0 && Math.floor(this.hornT / 4) % 2 === 0) {
      const hx = x + this.facing * 61;
      r.sprite(GERRIT_SPRITE.glint, 1, hx, y - 15, drawOpts);
    }
    if (this.wrecked) {
      const f = Math.floor(this.world.tick / 5) % 3;
      r.sprite(GERRIT_SPRITE.flame, f, x + this.facing * 50, y - 20, drawOpts);
      r.sprite(GERRIT_SPRITE.flame, (f + 1) % 3, x + this.facing * 56, y - 21, drawOpts);
    }
    if (this.fleeOn) {
      drawOpts.flipX = this.facing > 0;
      const fade = GERRIT.death.flee - this.fleeT;
      drawOpts.alpha = Math.max(0, Math.min(1, fade / 50));
      const [fx, fy] = this.fleeDrawAt();
      r.sprite(GERRIT_SPRITE.run, Math.floor(this.fleeT / 4) % 6, Math.round(fx), Math.round(fy), drawOpts);
      drawOpts.alpha = 1;
    }
  }

  /** The bridge deck's middle at depth k, in world px for the current camera (`FLEE_DECK`). */
  private deckAt(k: number): [number, number] {
    const F = FLEE_DECK;
    const s = (G - k - F.horizon) / (G - F.horizon);
    const mid = (F.d0 + F.d1) / 2;
    const t = (k - mid) / ((F.d1 - F.d0) / 2);
    const cam = this.world.camera.left;
    fleeAt[0] = cam + 192 + ((F.span[0] + F.span[1]) / 2 - 192 - cam) * s;
    fleeAt[1] = G - k - F.rise * s * (1 - t * t) - (F.lift * (k - F.d0)) / (F.d1 - F.d0) + 2;
    return fleeAt;
  }

  /** Where the flee draws now: the hop onto the bridge head, then the run up the deck (`FLEE_DECK`). */
  private fleeDrawAt(): [number, number] {
    const F = FLEE_DECK;
    const D = GERRIT.death;
    const t = this.fleeT;
    if (t < F.hop) {
      const x0 = this.fleeX - D.fleeVx * (this.facing < 0 ? 1 : -1) * t;
      const [bx, by] = this.deckAt(F.d0);
      const e = t / F.hop;
      fleeAt[0] = x0 + (bx - x0) * e;
      fleeAt[1] = this.roofY + (by - this.roofY) * e - 4 * F.peak * e * (1 - e);
      return fleeAt;
    }
    return this.deckAt(F.d0 + (F.d1 - F.d0) * Math.min(1, (t - F.hop) / (D.flee - F.hop)));
  }

  /** The pose drawn now: the knock-out, the stagger's shock, the gloat while every hero is out. */
  private poseNow(): number {
    if (this.gerritOut) return G_SLUMP;
    if (this.staggerTicks > 0) return G_SHOCK;
    if (this.addsHeld && !this.busy) return G_GLOAT;
    return this.gPose;
  }
}

defineEntity(GERRIT_ID, (w, x, y, p) => new GerritLimo(w, x, y, p), {
  category: 'boss',
  score: GERRIT.score,
  description:
    'sewers mini-boss (end of sewers-a): GOUDEN GERRIT in the sunroof of his white limo (limo 900 solid, roof y 148; Gerrit 500, ducks after each volley); shotgun spread, back-door bodyguards; phase 2 horn roll + gold chain lob. Params facing, hpScale. Call start().',
});
