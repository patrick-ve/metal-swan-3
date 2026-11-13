/**
 * DE RATTENJONG — the boss of mission sewers, the sewers-e arena (docs/design/sewers.md §4.2). A
 * giant rat king (an animal: no clothes, no words; creature sounds only) on his trash throne.
 *
 * Spawn at the throne's centre on the floor (`ctx.spawn('sewers-rattenjong', KING.homeX, 'ground')`);
 * he places his throne (`sewers-rattenjong-throne`) and sits on its top. He starts DORMANT (decor:
 * no team, no hurt boxes reached by shots); the section script calls `wake()` at the lock and the
 * fight starts with the boss intro (he rises and screeches; invulnerable).
 *
 * - One HP pool (KING.hp × difficulty × co-op); phases at 66 % and 33 %.
 * - Phase 1, ON THE THRONE: a throw every 90 ticks, in the order bike → cart → scooter: the bike
 *   (tell 30, lifted over his head; a high arc to the hero's x; shootable), the cart (tell 24, shoved
 *   off the pile; it rolls at 2.5 px/tick), the scooter (tell 24; a flat throw that bounces twice).
 * - Phase 2, THE RATS: the squeak (tell 40; every rat eye in the hall lights up), then a wave down
 *   the pile (6 runners and 1 spitter, P1a's `drop` entry) every 480 ticks; throws every 120 ticks
 *   between the waves; the pile lowers in three steps (his hitbox comes down with it).
 * - Phase 3, ON FOOT: he jumps down (tell 40: the crouch, the pile shakes), then walks at the
 *   heroes and charges (tell 30: rears and screeches; 3.2 px/tick; a 24 px high contact box: jump
 *   over his head or stand on a ledge; 60 ticks dazed after each charge: the window), sweeps his
 *   tail (tell 24: the tail rises; a low ring: jump) and bites (tell 20, reach 24).
 * - Every attack: a tell ≥ 18 ticks (`telegraphFor`) with a pose and a sound, recorded in
 *   `attacks` (tests). Contact damage only from the live attack boxes (ram, tail, jaw).
 * - Stagger (a continued hero lands): the running attack ends cleanly (`cutAttack`); the phase runs
 *   on after it (`resume`). Rat waves hold while every hero is out (`holdAdds`).
 * - THE END (`deathSequence`): he staggers back into the pile; the vault cracks; the canal comes
 *   down (`sewers-flood`, cosmetic); the heroes hang on (input locked ≤ 120 ticks, unhurt); the
 *   wave washes him off down the channel, tumbling and squeaking (bloodless); his rats are washed
 *   away with him. The section script fades to sewers-end after `defeated`.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { debris, dust, splash } from '../../../fx';
import { isPlayer, type Player } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { eraseEnemyShots } from '../../../projectile';
import { defineEntity, defineStatus, paramNum, type SpawnParams } from '../../../registry';
import { SEWERS_BOSS, SEWERS_E_IDS, SEWERS_RAT } from '../../missions/sewers/ids';
import { KING, KING_ART, KING_EYES, KING_NAME, KING_RAT_TAG } from './numbers';
import { KingThrone } from './props';
import { KingBike, KingCart, KingScooter } from './shots';

export type KingAttack = 'bike' | 'cart' | 'scooter' | 'wave' | 'jump' | 'charge' | 'tail' | 'bite';

/** One attack as it fired (tests): its tell in ticks, whether he was on screen, the tick. */
export interface KingAttackRecord {
  readonly kind: KingAttack;
  readonly tell: number;
  readonly onScreen: boolean;
  readonly tick: number;
}

/** The heroes hang on while the flood comes down (input locked, unhurt; spec §4.2: ≤ 120 ticks). */
export const SEWERS_HANG: StatusEffectDef = defineStatus({ id: 'sewers-hang', ticks: KING.end.flood, noControl: true, noFire: true, onHit: () => true });

/** The throws of phase 1 in order (phase 2 too, between the waves). */
const THROWS: readonly KingAttack[] = ['bike', 'cart', 'scooter'];

const drawOpts: DrawOpts = {};
const flashOpts: DrawOpts = { tint: 0xeaf3faff, alpha: 0.18 };
const eyeOpts: DrawOpts = {};

export class Rattenjong extends Boss {
  /** The throne's centre on the floor (his home) and the floor. */
  readonly homeX: number;
  readonly floorY: number;
  throne: KingThrone | null = null;
  /** Decor before the lock: no team, not shootable. */
  dormant = true;
  /** On the walk band (phase 3) — else on the throne. */
  onFoot = false;
  /** In the air (the jump down): never staggered then. */
  jumping = false;
  /**
   * The charge runs (its low contact box is live): the god-bot jumps it (sim/bot.ts `ramComing`).
   * Declared, not initialised: the property exists only from his landing on the walk band (the bot
   * takes a boss with a `ramming` key for a rammer and stands at its rear; on the throne it must
   * use its 45° stand-off instead).
   */
  declare ramming: boolean;
  /** The pose strip (`boss/sewers-rattenjong/<pose>`) and its start tick. */
  pose = 'sit';
  private poseT = 0;
  /** Every attack that fired (tests; capped). */
  readonly attacks: KingAttackRecord[] = [];
  /** The next throw of the cycle. */
  private nextThrow = 0;
  /** The tick of the last phase-2 wave. */
  private lastWave = -1e9;
  /** Phase 3: the next close attack (bite / tail alternate). */
  private nextBite = true;
  /** The end: washed away (hidden once off screen). */
  private gone = false;
  private shakeX = 0;
  private readonly bodyPart: BossPart;
  private readonly ramPart: BossPart;
  private readonly tailPart: BossPart;
  private readonly jawPart: BossPart;
  private readonly hit: Damage = { amount: KING.damage, kind: 'impact', dirX: 0, source: this, tags: ['boss'] };

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: KING_ART, name: KING_NAME, hp: KING.hp * Math.max(0.01, paramNum(p, 'hpScale', 1)), score: KING.score });
    this.homeX = x;
    const f = Number.isFinite(y) ? world.terrain.surfaceY(x, y - 48, y + 48) : Infinity;
    this.floorY = Number.isFinite(f) ? f : y;
    this.y = KING.tops[0];
    this.facing = -1;
    this.autoStart = false;
    this.z = 28;
    this.phaseIntermission = KING.intermission;
    this.bodyPart = this.addPart('body', { box: { ...KING.box.sit } });
    this.ramPart = this.addPart('ram', { box: { ...KING.box.ram }, contact: true, enabled: false });
    this.tailPart = this.addPart('tail', { box: { ...KING.box.tail }, contact: true, enabled: false });
    this.jawPart = this.addPart('jaw', { box: { ...KING.box.jaw }, contact: true, enabled: false });
    this.phases = [
      { at: 1, name: 'throne', pattern: (b) => b.phaseOne(false), resume: (b) => b.phaseOne(true) },
      { at: KING.phase2At, name: 'rats', pattern: (b) => b.phaseTwo(false), resume: (b) => b.phaseTwo(true) },
      { at: KING.phase3At, name: 'afoot', pattern: (b) => b.phaseThree(false), resume: (b) => b.phaseThree(true) },
    ];
    // Dormant: decor until the lock.
    this.team = 'neutral';
    this.removeTag('shootable');
    this.removeTag('enemy');
    this.setPose('sit');
  }

  // ------------------------------------------------------------------------------- helpers

  private setPose(name: string): void {
    if (this.pose === name) return;
    this.pose = name;
    this.poseT = this.world.tick;
  }

  private target(): Entity | null {
    return this.world.nearestPlayer(this.x, this.onFoot ? this.y - 20 : this.floorY - 20);
  }

  private faceTarget(): void {
    const t = this.target();
    if (t && Math.abs(t.x - this.x) > 4) this.facing = t.x < this.x ? -1 : 1;
  }

  private record(kind: KingAttack, tell: number): void {
    if (this.attacks.length >= 64) this.attacks.shift();
    this.attacks.push({ kind, tell, onScreen: this.world.onScreen(this, 0), tick: this.world.tick });
  }

  /** The arena's span for his x on foot (the locked view, a margin inside). */
  private arena(): [number, number] {
    const cam = this.world.camera;
    return [cam.left + KING.margin, cam.right - KING.margin];
  }

  /** The seat's y (the throne's top). */
  private seatY(): number {
    return this.throne ? this.throne.top : KING.tops[0];
  }

  /** Where a throw leaves his paws. */
  private handX(): number {
    return this.x + this.facing * KING.hands.x;
  }
  private handY(): number {
    return this.y + KING.hands.y;
  }

  /** No live attack box (the end of an attack, a stagger, the end). */
  private boxesOff(): void {
    if (this.onFoot) this.ramming = false;
    this.ramPart.enabled = false;
    this.tailPart.enabled = false;
    this.jawPart.enabled = false;
    this.contactDamage = null;
  }

  private boxOn(p: BossPart): void {
    p.enabled = true;
    this.hit.dirX = this.facing;
    this.contactDamage = this.hit;
  }

  private ensureThrone(): void {
    if (this.throne && !this.throne.removed) return;
    const t = this.world.spawn(SEWERS_E_IDS.throne, this.homeX, this.floorY, {});
    this.throne = t instanceof KingThrone ? t : null;
  }

  // ------------------------------------------------------------------------------- the wake

  /** The lock: he is a target now; the intro (rise, screech) runs with the boss banner. */
  wake(): void {
    if (this.state !== 'waiting') return;
    this.dormant = false;
    this.team = 'enemy';
    this.addTag('enemy');
    this.addTag('shootable');
    this.start();
  }

  override *intro(): ScriptGen {
    const w = this.world;
    this.faceTarget();
    this.setPose('squeak');
    w.audio.sfx('sewers/king-screech');
    w.camera.shake(3, 20);
    this.throne?.lightEyes(KING.introTicks);
    yield KING.introTicks;
    this.setPose('sit');
  }

  // ------------------------------------------------------------------------------- phase 1, 2: throws

  *phaseOne(resume: boolean): ScriptGen {
    yield resume ? 12 : 30;
    for (;;) yield* this.throwNext(KING.throwEvery[0]);
  }

  /** The next throw of the cycle; the whole beat lasts `every` ticks (tell + throw + rest). */
  *throwNext(every: number): ScriptGen {
    const kind = THROWS[this.nextThrow];
    this.nextThrow = (this.nextThrow + 1) % THROWS.length;
    const t0 = this.world.tick;
    if (kind === 'bike') yield* this.throwBike();
    else if (kind === 'cart') yield* this.shoveCart();
    else yield* this.throwScooter();
    const rest = this.recoveryFor(every) - (this.world.tick - t0);
    yield Math.max(8, rest);
  }

  /** The bike: lifted over his head (tell 30), a high arc to the hero's x. */
  *throwBike(): ScriptGen {
    const w = this.world;
    this.faceTarget();
    const tele = this.telegraphFor(KING.bike.tele);
    this.setPose('lift');
    w.audio.sfx('sewers/king-squeak', { pitch: 0.9 });
    yield tele;
    const t = this.target();
    const cam = w.camera;
    const tx = t ? Math.max(cam.left + 16, Math.min(cam.right - 16, t.x)) : this.x - 120;
    this.setPose('throw');
    this.record('bike', tele);
    w.audio.sfx('sewers/throw-bike');
    KingBike.lob(w, this.handX(), this.handY(), tx, this.floorY, this);
    yield 14;
    this.setPose('sit');
  }

  /** The cart: shoved off the pile's front edge toward the nearest hero (tell 24). */
  *shoveCart(): ScriptGen {
    const w = this.world;
    this.faceTarget();
    const tele = this.telegraphFor(KING.cart.tele);
    this.setPose('shove');
    this.throne?.shake(tele);
    w.audio.sfx('sewers/king-squeak', { pitch: 1.1 });
    yield tele;
    const dir = this.facing;
    const edge = dir < 0 ? KING.throne[0] + 14 : KING.throne[1] - 14;
    this.setPose('throw');
    this.record('cart', tele);
    w.audio.sfx('sewers/throw-cart');
    KingCart.shove(w, Math.max(this.x - 70, Math.min(this.x + 70, edge)) , this.seatY() - 8, dir, this);
    yield 14;
    this.setPose('sit');
  }

  /** The scooter: a flat throw that bounces twice (tell 24). */
  *throwScooter(): ScriptGen {
    const w = this.world;
    this.faceTarget();
    const tele = this.telegraphFor(KING.scooter.tele);
    this.setPose('lift');
    w.audio.sfx('sewers/king-squeak', { pitch: 1.25 });
    yield tele;
    this.setPose('throw');
    this.record('scooter', tele);
    w.audio.sfx('sewers/throw-scooter');
    KingScooter.fling(w, this.handX() + this.facing * 10, this.y - 30, this.facing, this);
    yield 14;
    this.setPose('sit');
  }

  *phaseTwo(resume: boolean): ScriptGen {
    yield resume ? 12 : 10;
    for (;;) {
      if (this.world.tick - this.lastWave >= this.recoveryFor(KING.wave.every)) yield* this.squeakWave();
      yield* this.throwNext(KING.throwEvery[1]);
    }
  }

  /** The squeak (tell 40: the hall's eyes light up), then a wave down the pile. */
  *squeakWave(): ScriptGen {
    const w = this.world;
    const W = KING.wave;
    this.faceTarget();
    const tele = this.telegraphFor(W.tele);
    this.setPose('squeak');
    w.audio.sfx('sewers/king-squeak');
    this.throne?.lightEyes(tele);
    yield tele;
    this.record('wave', tele);
    this.lastWave = w.tick;
    // No adds while every hero is out or the fight staggers (the in-world continue); never more
    // than `cap` of his rats at once.
    if (!this.holdAdds && w.countAlive(KING_RAT_TAG) < W.cap) {
      const top = this.seatY() - 6;
      for (let i = 0; i < W.runners; i++) {
        const k = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2);
        w.spawn(SEWERS_RAT.runner, this.homeX + k * W.gap, top, { entry: 'drop', delay: i * 12, tag: KING_RAT_TAG });
      }
      for (let i = 0; i < W.spitters; i++) w.spawn(SEWERS_RAT.spitter, this.homeX - 40 + i * 80, top, { entry: 'drop', delay: 30, tag: KING_RAT_TAG });
      this.throne?.shake(30);
      dust(w, this.homeX, top, 4);
    }
    yield 20;
    this.setPose('sit');
  }

  // ------------------------------------------------------------------------------- phase 3: on foot

  *phaseThree(resume: boolean): ScriptGen {
    if (!this.onFoot) yield* this.jumpDown();
    else yield resume ? 12 : 20;
    let n = 0;
    for (;;) {
      yield* this.approach();
      const t = this.target();
      const dx = t ? Math.abs(t.x - this.x) : 999;
      // At least every third attack is a charge (the window after it).
      if (dx > KING.bite.near || n >= 2) {
        yield* this.charge();
        n = 0;
      } else {
        if (this.nextBite) yield* this.bite();
        else yield* this.tailSweep();
        this.nextBite = !this.nextBite;
        n++;
      }
      yield 18;
    }
  }

  /** Off the throne: the crouch (tell 40, the pile shakes), the jump, the landing. */
  *jumpDown(): ScriptGen {
    const J = KING.jump;
    const w = this.world;
    this.faceTarget();
    const tele = this.telegraphFor(J.tele);
    this.setPose('crouch');
    this.throne?.shake(tele);
    w.audio.sfx('sewers/king-screech', { pitch: 0.8 });
    yield tele;
    this.record('jump', tele);
    this.throne?.lower(KING.tops.length - 1);
    this.jumping = true;
    this.setPose('jump');
    const x0 = this.x;
    const y0 = this.y;
    const [lo, hi] = this.arena();
    const x1 = Math.max(lo, Math.min(hi, this.x + J.dx));
    for (let t = 1; t <= J.ticks; t++) {
      const k = t / J.ticks;
      this.x = x0 + (x1 - x0) * k;
      this.y = y0 + (this.floorY - y0) * k - Math.sin(k * Math.PI) * J.peak;
      yield;
    }
    this.x = x1;
    this.y = this.floorY;
    this.onFoot = true;
    this.ramming = false;
    this.jumping = false;
    this.setBody();
    this.setPose('walk');
    w.audio.sfx('sewers/brute-stomp');
    w.camera.shake(4, 16);
    dust(w, this.x - 20, this.floorY, 5);
    dust(w, this.x + 20, this.floorY, 5);
    yield 20;
  }

  /** The body box for where he is (the throne or the walk band). */
  private setBody(): void {
    const B = this.onFoot ? KING.box.foot : KING.box.sit;
    const b = this.bodyPart.box;
    b.x = B.x;
    b.y = B.y;
    b.w = B.w;
    b.h = B.h;
  }

  /** Walk at the nearest hero until near (or a while), inside the arena. */
  *approach(): ScriptGen {
    const W = KING.walk;
    this.setPose('walk');
    for (let t = 0; t < W.max; t++) {
      const tg = this.target();
      if (!tg) break;
      const dx = tg.x - this.x;
      this.facing = dx < 0 ? -1 : 1;
      if (Math.abs(dx) < W.near) break;
      const [lo, hi] = this.arena();
      const nx = Math.max(lo, Math.min(hi, this.x + Math.sign(dx) * W.speed));
      if (nx === this.x) break;
      this.x = nx;
      if (t % (W.stride * 2) === 0) dust(this.world, this.x - this.facing * 20, this.floorY, 1);
      yield;
    }
  }

  /** The charge: rears and screeches (tell 30), runs across the arena at 3.2, then is dazed 60 ticks. */
  *charge(): ScriptGen {
    const C = KING.charge;
    const w = this.world;
    this.faceTarget();
    // No room ahead (the hero is between him and the arena's end): he backs off to the middle first.
    {
      const [lo, hi] = this.arena();
      const room = this.facing < 0 ? this.x - lo : hi - this.x;
      if (room < C.room) {
        this.setPose('walk');
        const mid = (lo + hi) / 2;
        for (let t = 0; t < C.backoff && Math.abs(this.x - mid) > 2; t++) {
          this.x += Math.sign(mid - this.x) * KING.walk.speed * 1.5;
          yield;
        }
        this.faceTarget();
      }
    }
    const tele = this.telegraphFor(C.tele);
    this.setPose('rear');
    w.audio.sfx('sewers/king-screech');
    yield tele;
    this.record('charge', tele);
    this.setPose('charge');
    this.boxOn(this.ramPart);
    this.ramming = true;
    const dir = this.facing;
    const [lo, hi] = this.arena();
    for (let t = 0; t < C.max; t++) {
      const nx = this.x + dir * C.speed;
      if (nx <= lo || nx >= hi) {
        this.x = Math.max(lo, Math.min(hi, nx));
        break;
      }
      this.x = nx;
      if (t % 6 === 0) dust(w, this.x - dir * 24, this.floorY, 1);
      yield;
    }
    this.boxesOff();
    // He runs into the arena's end: dazed (the window).
    w.audio.sfx('sewers/brute-stomp', { pitch: 1.2 });
    w.camera.shake(3, 10);
    debris(w, this.x + dir * 34, this.floorY - 20, 'rock', 4);
    this.setPose('daze');
    yield this.recoveryFor(C.daze);
    this.setPose('walk');
  }

  /** The tail sweep: the tail rises (tell 24), then a low ring round him (jump it). */
  *tailSweep(): ScriptGen {
    const T = KING.tail;
    const w = this.world;
    this.faceTarget();
    const tele = this.telegraphFor(T.tele);
    this.setPose('tail-up');
    w.audio.sfx('sewers/king-squeak', { pitch: 0.75 });
    yield tele;
    this.record('tail', tele);
    this.setPose('sweep');
    w.audio.sfx('sewers/throw-bike', { pitch: 1.3, vol: 0.7 });
    this.boxOn(this.tailPart);
    dust(w, this.x - 60, this.floorY, 2);
    dust(w, this.x + 60, this.floorY, 2);
    yield T.live;
    this.boxesOff();
    yield this.recoveryFor(T.rec);
    this.setPose('walk');
  }

  /** The bite: head back, mouth open (tell 20), a short lunge with the jaw box (reach 24). */
  *bite(): ScriptGen {
    const B = KING.bite;
    const w = this.world;
    this.faceTarget();
    const tele = this.telegraphFor(B.tele);
    this.setPose('bite-tell');
    w.audio.sfx('sewers/rat-hiss', { pitch: 0.6 });
    yield tele;
    this.record('bite', tele);
    this.setPose('bite');
    w.audio.sfx('sewers/rat-bite', { pitch: 0.7 });
    this.boxOn(this.jawPart);
    const [lo, hi] = this.arena();
    for (let t = 0; t < B.live; t++) {
      this.x = Math.max(lo, Math.min(hi, this.x + (this.facing * B.lunge) / B.live));
      yield;
    }
    this.boxesOff();
    yield this.recoveryFor(B.rec);
    this.setPose('walk');
  }

  // ------------------------------------------------------------------------------- per tick

  protected override think(): void {
    this.ensureThrone();
    // On the throne he sits on its (lowering) top.
    if (!this.onFoot && !this.jumping && this.state !== 'dying') this.y = this.seatY();
    // Phase 2: the pile lowers in three steps.
    if (this.state === 'fight' && this.phase === 1 && this.throne) {
      const f = this.healthFrac;
      let level = 0;
      for (let i = 0; i < KING.shrinkAt.length; i++) if (f <= KING.shrinkAt[i]) level = i + 1;
      if (level > this.throne.level) {
        this.throne.lower(level);
        this.world.audio.sfx('sewers/fatberg-slump', { pitch: 1.3, vol: 0.7 });
        dust(this.world, this.homeX, this.throne.top, 6);
      }
    }
    if (this.contactDamage) this.hit.dirX = this.facing;
  }

  override onHit(d: Damage, part = 0): boolean {
    if (this.dormant) return false;
    return super.onHit(d, part);
  }

  protected override canStagger(): boolean {
    return !this.jumping;
  }

  protected override onStagger(_ticks: number): void {
    this.shakeX = 1;
  }

  protected override cutAttack(): boolean {
    this.boxesOff();
    this.setPose(this.onFoot ? 'daze' : 'sit');
    return true;
  }

  override update(): void {
    super.update();
    if (this.staggerTicks > 0) this.shakeX = this.world.tick % 4 < 2 ? 1 : -1;
    else this.shakeX = 0;
  }

  // ------------------------------------------------------------------------------- the end

  protected override onDeathStart(): void {
    this.boxesOff();
    this.team = 'neutral';
    this.removeTag('shootable');
    this.removeTag('enemy');
    eraseEnemyShots(this.world, this.world.camera.view(16));
  }

  protected override deathSequence(): ScriptGen {
    const self = this;
    const E = KING.end;
    return (function* rattenjongWashedAway(): ScriptGen {
      const w = self.world;
      // He staggers back into the pile.
      self.setPose(self.onFoot ? 'daze' : 'squeak');
      w.audio.sfx('sewers/king-screech', { pitch: 0.7 });
      const x0 = self.x;
      const y0 = self.y;
      const seat = self.seatY();
      for (let t = 1; t <= E.back; t++) {
        const k = t / E.back;
        self.x = x0 + (self.homeX - x0) * k;
        self.y = y0 + (seat - y0) * k - (self.onFoot ? Math.sin(k * Math.PI) * 14 : 0);
        yield;
      }
      self.onFoot = false;
      self.setBody();
      self.setPose('squeak');
      self.throne?.shake(E.crack);
      // The vault cracks above: the canal's bottom.
      w.audio.sfx('sewers/hall-crack');
      w.camera.shake(4, E.crack);
      for (let t = 0; t < E.crack; t++) {
        if (t % 8 === 0) debris(w, self.homeX - 80 + w.fxRng.range(0, 140), 8, 'rock', 3);
        yield;
      }
      // The water comes down: the heroes hang on (input locked, unhurt), his rats are washed off.
      w.audio.sfx('sewers/flood');
      w.spawn(SEWERS_E_IDS.flood, self.homeX, self.floorY, {});
      for (const p of w.players) {
        if (!isPlayer(p) || p.state !== 'play') continue;
        (p as Player).status.add(SEWERS_HANG, E.flood);
        p.invulnTicks = Math.max(p.invulnTicks, E.flood + 30);
      }
      washRats(w);
      yield E.washAfter;
      // The wave takes him off down the channel, tumbling and squeaking.
      self.setPose('tumble');
      w.audio.sfx('sewers/king-squeak', { pitch: 1.4 });
      let t = 0;
      while (!self.gone && t < E.flood - E.washAfter) {
        self.x += E.washSpeed;
        self.y = Math.min(self.floorY + 6, self.y + 1.2);
        if (t % 20 === 10) w.audio.sfx('sewers/king-squeak', { pitch: 1.6, vol: 0.6 });
        if (t % 4 === 0) splash(w, self.x, self.floorY, 2);
        if (self.x > w.camera.right + 80) self.gone = true;
        t++;
        yield;
      }
      self.gone = true;
      // The rest of the beat (the flood is ≤ 120 ticks in all).
      yield Math.max(1, E.flood - E.washAfter - t);
    })();
  }

  // ------------------------------------------------------------------------------- draw

  override draw(r: Renderer): void {
    if (this.gone || this.state === 'done') return;
    const id = this.spriteId(this.pose);
    const f = Math.floor((this.world.tick - this.poseT) / 6);
    const x = Math.round(this.x + this.shakeX);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    r.sprite(id, f, x, y, drawOpts);
    // The hit flash: a pale overlay (not a white cut-out: under steady fire he stays readable).
    if (this.flashTicks > 0 && this.world.tick % 2 === 0) {
      flashOpts.flipX = drawOpts.flipX;
      r.sprite(id, f, x, y, flashOpts);
    }
  }

  /**
   * His eyes as EMITTERS (P2; spec §5.1, §4.2 "red eyes"): the eyes-only strip of the pose, drawn by
   * the light pass of sewers-e after the darkness (`SectionLight.emissive`), so they glow red in the
   * dark and flash white on the tells. Draw only. The tumble (washed away) has no eyes strip.
   */
  drawEyes(r: Renderer): void {
    if (this.gone || this.state === 'done' || this.pose === 'tumble') return;
    const f = Math.floor((this.world.tick - this.poseT) / 6);
    eyeOpts.flipX = this.facing < 0;
    r.sprite(this.spriteId(this.pose) + KING_EYES, f, Math.round(this.x + this.shakeX), Math.round(this.y), eyeOpts);
  }
}

/** The flood takes the king's rats too (no score, no euro: a splash and gone). */
function washRats(w: World): void {
  const list = w.byTag(KING_RAT_TAG);
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!e.alive) continue;
    splash(w, e.x, e.y, 4);
    e.remove();
  }
}

defineEntity(SEWERS_BOSS.rattenjong, (w, x, y, p) => new Rattenjong(w, x, y, p), {
  category: 'boss',
  score: KING.score,
  description:
    'sewers boss: DE RATTENJONG, the giant rat king on his trash throne (spawn at the throne centre on the floor; dormant until wake()). Phase 1 throws (bike, cart, scooter), phase 2 rat waves down the pile with throws between, phase 3 on foot (charge, tail sweep, bite; dazed after each charge). The end: the vault cracks, the flood washes him away.',
});
