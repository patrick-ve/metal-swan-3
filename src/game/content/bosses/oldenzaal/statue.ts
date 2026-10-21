/**
 * ST. PLECHELMUS — the statue mini-boss of mission oldenzaal (docs/design/oldenzaal.md §5, §6;
 * revision 2: R2-6, R2-8). The saint is a VICTIM of the curse: Mevrouw Winkel flies into his
 * statue, and the squad frees him; he never threatens or mocks, and he ends whole, back on his
 * plinth, his eyes dark.
 *
 * Spawn it at the plinth's foot centre on the floor (`ctx.spawn('oz-plechelmus', x, 'ground')`).
 * It starts DORMANT: plain decor (team neutral, not shootable) drawn on its plinth. The section
 * script makes it shootable at the camera lock (`armDecor()`: shots chip dust and do nothing),
 * plays Mevrouw Winkel's wake scene, then calls `awaken()`: the stone cracks, the eyes glow, the
 * bar fills (the invulnerable intro), and the fight starts.
 *
 * - Phase 1, SEATED (100 % → 50 %): `sweep()` — the crozier glows and swings back (tell), then
 *   sweeps low: a low wave races along the pavers from the plinth's foot (jump it);
 *   `throwStone()` — he reaches down and tears a block off the plinth, lifts it (tell) and lobs
 *   it at a hero; it shatters into bouncing bits (shoot it down in the air for 50 points).
 * - Phase 2, ON FOOT (50 % → 0): `stepDown()` (invulnerable, `VERGEEF MIJ...`), then he walks
 *   slowly at the heroes: `groundSlam()` — the crozier raised high and glowing (tell), the blow
 *   sends a shockwave along the floor both ways (jump it); `hook()` — the crozier drawn back,
 *   glowing (tell), then its head shoots out at chest height (crouch under it): a hero it catches
 *   is pulled in; he breaks free by JUMPING or by SHOOTING THE CROZIER HEAD (36 damage), else the
 *   statue strikes him when he arrives. The crozier is a part (260 HP, shared): broken, no hook.
 * - Parts: `body`, `head` (× 1 seated, × 2 on foot: the weak point), `crozier` (phase 2 only).
 *   Contact damage only on foot (the body). Every attack: a tell ≥ 18 ticks (`telegraphFor`),
 *   on screen (the locked arena), recorded in `attacks` (tests).
 * - Stagger (a continued hero lands): the running attack ends cleanly (`cutAttack`: the hook
 *   lets go, the crozier comes back, no glow), the phase runs on after it (not while stepping).
 * - THE END (`deathSequence`): the ghost is torn out of the stone and flees with a shriek (not
 *   seen again in this level), the cracks close, he walks back, climbs up and SITS DOWN on his
 *   plinth, whole (the torn-out blocks are back), his eyes go dark: `DANK U, KINDEREN.` The boss
 *   stays as the statue (removeOnDeath false). 5,000 points (a mini-boss).
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { pushX } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import { Boss, type BossPart } from '../../../boss';
import { difficultyOf, hudOf, type BubbleTarget } from '../../../context';
import { debris, dust } from '../../../fx';
import { eraseEnemyShots } from '../../../projectile';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { OZ_SPEAKER, OZ_STATUE, OZ_WUGHOST } from '../../missions/oldenzaal/ids';
import { PLECHELMUS_LINES, STATUE_BOSS_NAME, WINKEL_LINES } from '../../missions/oldenzaal/lines';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../../oldenzaal/kit/light-api';
import type { OzWinkel } from '../../oldenzaal/npcs/index';
import { ART, CRACK_SPOTS, FX } from './art';
import { BOX, CROZIER_ANGLES, CZ, crozierTip, EYES_SIT, EYES_STAND, PLINTH, SIT, SIT_POSES, STAND, STAND_POSES, STATUE, type BodyPose } from './geometry';
import { StatueStone, StatueWave, chip } from './shots';

const ID_PLINTH = `${ART}/plinth`;
const ID_SIT = `${ART}/sit`;
const ID_STAND = `${ART}/stand`;
const ID_CROZIER = `${ART}/crozier`;
const ID_CROZIER_BROKEN = `${ART}/crozier-broken`;
const ID_FIST = `${ART}/fist`;
const ID_SHAFT = `${ART}/shaft`;
const ID_CRACK = `${FX}/crack`;
const ID_EYES = `${FX}/eyes`;
const ID_GLOW = `${FX}/glow`;
/** Ticks of calm after a stagger before his phase runs on. */
const RESUME_GAP = 12;
const GREEN = PAL_HD_OZ.ghost[5];

const drawOpts: DrawOpts = {};
const addOpts: DrawOpts = { blend: 'add' };
const flashOpts: DrawOpts = { tint: 0xeaf3faff };
const tip: [number, number] = [0, 0];

export type StatueAttack = 'sweep' | 'throw' | 'slam' | 'hook';

/** One attack as it fired (tests): its tell in ticks and whether the statue was on screen. */
export interface AttackRecord {
  readonly kind: StatueAttack;
  readonly tell: number;
  readonly onScreen: boolean;
  readonly tick: number;
}

/** Where a speech bubble of the statue points (above the head; follows the body). */
class HeadPoint implements BubbleTarget {
  readonly hitbox = { y: -6 };
  private readonly s: Plechelmus;
  constructor(s: Plechelmus) {
    this.s = s;
  }
  get x(): number {
    return this.s.eyeX();
  }
  get y(): number {
    return this.s.eyeY() - 14;
  }
  get removed(): boolean {
    return this.s.removed;
  }
}

export class Plechelmus extends Boss implements LightSource {
  /** The plinth's foot centre (his home) and the floor. */
  readonly homeX: number;
  readonly floorY: number;
  /** Decor before the wake (no team, no hurt boxes reached by shots until `armDecor`). */
  dormant = true;
  seated = true;
  /** Body frame (index into SIT_POSES / STAND_POSES). */
  pose: number = SIT.rest;
  /** Vertical offset of the body (step down / climb up; negative = up). */
  lift = 0;
  /** The hook's stretch (px the crozier head is out beyond the hand). */
  crozierOut = 0;
  /** The plinth's torn-out blocks (0 … 3). */
  missing = 0;
  /** The curse's cracks (0 none … 1 open) and the eyes' glow (0 … 1). */
  crack = 0;
  eyes = 0;
  /** Ticks left of a tell's glow on the crozier. */
  glowT = 0;
  /** The hero on the hook, and the damage done to the crozier head while he hangs there. */
  hooked: Entity | null = null;
  hookDmg = 0;
  /** The boss bar's fill during the wake (0 … 1). */
  barFill = 1;
  /** Every attack that fired (tests; capped). */
  readonly attacks: AttackRecord[] = [];
  /** Stepping on or off the plinth (no stagger hold). */
  stepping = false;
  private shakeX = 0;
  private walkT = 0;
  private stride = 0;
  private nextSlam = true;
  private lastChip = -99;
  private crackState = 0;
  private readonly bodyPart: BossPart;
  private readonly headPart: BossPart;
  private readonly crozierPart: BossPart;
  /** The phase-2 body contact and the hook strike: `source` is the statue (deaths and hits trace back to it). */
  private readonly hitDamage: Damage = { amount: STATUE.damage, kind: 'impact', dirX: 0, source: this, tags: ['boss'] };
  private readonly strike: Damage = { amount: STATUE.damage, kind: 'impact', dirX: 0, owner: -1, source: this, tags: ['boss'] };
  private readonly headPoint = new HeadPoint(this);
  private readonly hookRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: STATUE_BOSS_NAME, hp: STATUE.hp * Math.max(0.01, paramNum(p, 'hpScale', 1)), score: STATUE.score });
    this.facing = 1;
    this.homeX = x;
    const f = Number.isFinite(y) ? world.terrain.surfaceY(x, y - 48, y + 48) : Infinity;
    this.y = Number.isFinite(f) ? f : y;
    this.floorY = this.y;
    this.autoStart = false;
    this.removeOnDeath = false;
    this.deathTicks = 400;
    this.z = 24;
    this.bodyPart = this.addPart('body', { box: { ...BOX.sit.body }, contact: true });
    this.headPart = this.addPart('head', { box: { ...BOX.sit.head }, multiplier: STATUE.headMul[0] });
    this.crozierPart = this.addPart('crozier', { box: { x: -8, y: -8, w: BOX.crozierHead, h: BOX.crozierHead }, hp: STATUE.crozierHp, shared: true, enabled: false });
    this.phases = [
      { at: 1, name: 'seated', pattern: (b) => b.phaseOne(false), resume: (b) => b.phaseOne(true) },
      { at: STATUE.phase2At, name: 'afoot', pattern: (b) => b.phaseTwo(false), resume: (b) => b.phaseTwo(true), onEnter: (b) => b.enterTwo() },
    ];
    // Dormant: decor until the lock.
    this.team = 'neutral';
    this.removeTag('shootable');
    this.removeTag('enemy');
    this.addTag(LIGHT_TAG);
  }

  // ------------------------------------------------------------------------------- geometry

  get bodyPose(): BodyPose {
    return this.seated ? SIT_POSES[this.pose] : STAND_POSES[this.pose];
  }

  /** The body sprite's anchor (world). */
  anchorX(): number {
    return this.x;
  }
  anchorY(): number {
    return (this.seated ? this.floorY - PLINTH.h : this.floorY) + this.lift;
  }

  eyeX(): number {
    const p = this.bodyPose;
    return this.anchorX() + (this.seated ? EYES_SIT[0] : EYES_STAND[0]) + p.lean;
  }
  eyeY(): number {
    const p = this.bodyPose;
    return this.anchorY() + (this.seated ? EYES_SIT[1] : EYES_STAND[1]) + p.dip;
  }

  /** The crozier head's centre in world px (the hook's stretch included). */
  crozierHead(out: [number, number] = tip): [number, number] {
    const p = this.bodyPose;
    crozierTip(p.crozier, out);
    out[0] += this.anchorX() + p.hand[0] - this.crozierOut;
    out[1] += this.anchorY() + p.hand[1];
    return out;
  }

  private setBoxes(): void {
    const B = this.seated ? BOX.sit : BOX.stand;
    const dy = this.seated ? this.lift : this.lift;
    const b = this.bodyPart.box;
    b.x = B.body.x;
    b.y = B.body.y + dy;
    b.w = B.body.w;
    b.h = B.body.h;
    const h = this.headPart.box;
    h.x = B.head.x + this.bodyPose.lean;
    h.y = B.head.y + dy + this.bodyPose.dip;
    h.w = B.head.w;
    h.h = B.head.h;
  }

  private setPose(seated: boolean, pose: number): void {
    this.seated = seated;
    this.pose = pose;
    this.setBoxes();
  }

  private target(): Entity | null {
    return this.world.nearestPlayer(this.x, this.floorY - 20);
  }

  private record(kind: StatueAttack, tell: number): void {
    if (this.attacks.length >= 64) this.attacks.shift();
    this.attacks.push({ kind, tell, onScreen: this.world.onScreen(this, 0), tick: this.world.tick });
  }

  /** The arena's walkable span for the walking statue (the locked view, a margin inside). */
  private arena(): [number, number] {
    const cam = this.world.camera;
    return [cam.left + STATUE.margin, cam.right - STATUE.margin];
  }

  // ------------------------------------------------------------------------------- talk

  /** A line of the saint (speaker 'plechelmus': the deep stony rumble). */
  speak(text: string, ticks = 120): void {
    hudOf(this.world).bubble(this.headPoint, text, { kind: 'gag', ticks, speaker: OZ_SPEAKER.plechelmus });
  }

  // ------------------------------------------------------------------------------- the wake

  /** The camera locked: the decor can be shot now (it chips dust and takes nothing). */
  armDecor(): void {
    if (!this.dormant) return;
    this.team = 'enemy';
    this.addTag('shootable');
  }

  /** Mevrouw Winkel flew in: crack, glow, fill the bar, fight (the invulnerable intro). */
  awaken(): void {
    if (this.state !== 'waiting') return;
    this.armDecor();
    this.dormant = false;
    this.addTag('enemy');
    this.barFill = 0;
    this.start();
  }

  override *intro(): ScriptGen {
    const W = STATUE.wake;
    const w = this.world;
    w.audio.sfx('oz/statue/crack');
    w.camera.shake(3, 16);
    for (let t = 0; t < W.crack; t++) {
      this.crack = (t + 1) / W.crack;
      this.eyes = Math.min(1, t / (W.crack * 0.6));
      this.shakeX = t % 4 < 2 ? 1 : -1;
      if (t === W.crack >> 1) {
        w.audio.sfx('oz/statue/crack', { pitch: 0.85 });
        debris(w, this.x, this.floorY - PLINTH.h - 30, 'rock', 6);
      }
      yield;
    }
    this.shakeX = 0;
    this.speak(PLECHELMUS_LINES.wake, 90);
    for (let t = 0; t < W.fill; t++) {
      this.barFill = (t + 1) / W.fill;
      yield;
    }
    yield W.hold;
  }

  override get healthFrac(): number {
    const f = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    return this.state === 'intro' ? f * this.barFill : f;
  }

  // ------------------------------------------------------------------------------- phase 1

  *phaseOne(resume: boolean): ScriptGen {
    yield resume ? RESUME_GAP : 24;
    for (;;) {
      yield* this.sweep();
      yield 26;
      yield* this.throwStone();
      yield 26;
    }
  }

  /** The crozier sweep: glow + swing back (tell), then the low wave from the plinth's foot. */
  *sweep(): ScriptGen {
    const S = STATUE.sweep;
    const tele = this.telegraphFor(S.tele);
    this.setPose(true, SIT.sweepBack);
    this.glowT = tele;
    this.world.audio.sfx('oz/statue/tell');
    yield tele;
    this.setPose(true, SIT.sweepMid);
    this.world.audio.sfx('oz/statue/sweep');
    yield S.swing >> 1;
    this.setPose(true, SIT.sweepLow);
    const fx = this.homeX - PLINTH.w / 2 - 4;
    this.record('sweep', tele);
    StatueWave.slam(this.world, fx - S.hitW / 2 + 12, this.floorY, S.hitW, S.hitH, S.hitTicks, this);
    StatueWave.run(this.world, fx, this.floorY, -1, this, true);
    this.world.camera.shake(2, 10);
    dust(this.world, fx, this.floorY, 6);
    const extra = difficultyOf(this.world).extraVolley;
    for (let i = 0; i < extra; i++) {
      yield 22;
      StatueWave.run(this.world, fx, this.floorY, -1, this, true);
    }
    yield S.swing;
    this.setPose(true, SIT.rest);
    yield this.recoveryFor(S.rec);
  }

  /** The thrown stone: reach down, tear a block off the plinth, lift it (tell), lob it. */
  *throwStone(): ScriptGen {
    const T = STATUE.throw;
    const w = this.world;
    this.setPose(true, SIT.reach);
    w.audio.sfx('oz/statue/wrench');
    yield T.reach;
    if (this.missing < PLINTH.maxMissing) this.missing++;
    debris(w, this.homeX - 14, this.floorY - 26, 'rock', 5);
    dust(w, this.homeX - 14, this.floorY - 20, 2);
    this.setPose(true, SIT.lift);
    this.glowT = 0;
    const tele = this.telegraphFor(T.tele);
    yield tele;
    const p = this.bodyPose;
    const hx = this.anchorX() + p.raise[0];
    const hy = this.anchorY() + p.raise[1] - 6;
    const t = this.target();
    const cam = w.camera;
    const tx = t ? Math.max(cam.left + 16, Math.min(cam.right - 16, t.x)) : this.x - 120;
    this.setPose(true, SIT.throw);
    this.record('throw', T.reach + tele);
    w.audio.sfx('oz/statue/throw');
    StatueStone.lob(w, hx, hy, tx, this.floorY, this);
    yield 14;
    this.setPose(true, SIT.rest);
    yield this.recoveryFor(T.rec);
  }

  // ------------------------------------------------------------------------------- phase 2

  enterTwo(): void {
    this.headPart.multiplier = STATUE.headMul[1];
    this.crozierPart.enabled = !this.crozierPart.destroyed;
    this.contactDamage = this.hitDamage;
  }

  *phaseTwo(resume: boolean): ScriptGen {
    if (!resume) yield* this.stepDown();
    else yield RESUME_GAP;
    for (;;) {
      yield* this.approach();
      const t = this.target();
      const far = t ? Math.abs(t.x - this.x) > 96 : false;
      if (this.partAlive('crozier') && (far || !this.nextSlam)) yield* this.hook();
      else yield* this.groundSlam();
      this.nextSlam = !this.nextSlam;
      yield 22;
    }
  }

  /** Off the plinth: rise, hop down in front of it, land (invulnerable; the line). */
  *stepDown(): ScriptGen {
    const S = STATUE.step;
    const w = this.world;
    this.stepping = true;
    this.intermission(S.rise + S.hop + S.land);
    this.speak(PLECHELMUS_LINES.step, 100);
    w.audio.sfx('oz/statue/crack', { pitch: 0.75 });
    for (let t = 0; t < S.rise; t++) {
      this.shakeX = t % 4 < 2 ? 1 : -1;
      yield;
    }
    this.shakeX = 0;
    // Standing up on the plinth's top (the rise pose crouches), then the hop down in front.
    this.setPose(false, STAND.rise);
    this.lift = -PLINTH.h;
    this.setBoxes();
    w.audio.sfx('oz/statue/sit', { pitch: 1.2 });
    const x0 = this.x;
    const [lo] = this.arena();
    const x1 = Math.max(lo, this.x - 18);
    for (let t = 1; t <= S.hop; t++) {
      const k = t / S.hop;
      this.x = x0 + (x1 - x0) * k;
      this.lift = -PLINTH.h * (1 - k) - Math.sin(k * Math.PI) * 14;
      if (t === 6) this.setPose(false, STAND.stand);
      this.setBoxes();
      yield;
    }
    this.lift = 0;
    this.setPose(false, STAND.slamDown);
    w.audio.sfx('oz/statue/slam', { vol: 0.8 });
    w.camera.shake(4, 16);
    dust(w, this.x, this.floorY, 8);
    yield S.land;
    this.setPose(false, STAND.stand);
    this.stepping = false;
  }

  /** Walk at the nearest hero until near (or a while), inside the arena. */
  *approach(): ScriptGen {
    const W = STATUE.walk;
    const w = this.world;
    for (let t = 0; t < W.max; t++) {
      const tg = this.target();
      if (!tg) break;
      const dx = tg.x - this.x;
      if (Math.abs(dx) < W.near) break;
      const [lo, hi] = this.arena();
      const nx = Math.max(lo, Math.min(hi, this.x + Math.sign(dx) * W.speed));
      if (nx === this.x) break;
      this.x = nx;
      this.walkT++;
      const f = Math.floor(this.walkT / W.stride) % 4;
      if (f !== this.stride) {
        this.stride = f;
        if (f === 1 || f === 3) {
          w.audio.sfx('oz/statue/step', { vol: 0.7 });
          w.camera.shake(1, 4);
          dust(w, this.x + (f === 1 ? -7 : 7), this.floorY, 1);
        }
      }
      this.setPose(false, STAND.walk[f]);
      yield;
    }
    this.setPose(false, STAND.stand);
  }

  /** The ground slam: the crozier raised, glowing (tell); the blow and a shockwave both ways. */
  *groundSlam(): ScriptGen {
    const S = STATUE.slam;
    const w = this.world;
    const tele = this.telegraphFor(S.tele);
    this.setPose(false, STAND.slamUp);
    this.glowT = tele;
    w.audio.sfx('oz/statue/tell', { pitch: 0.8 });
    yield tele;
    this.setPose(false, STAND.slamDown);
    this.record('slam', tele);
    w.audio.sfx('oz/statue/slam');
    w.camera.shake(5, 18);
    StatueWave.slam(w, this.x, this.floorY, S.hitW, S.hitH, S.hitTicks, this);
    const n = 1 + difficultyOf(w).extraVolley;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        yield 24;
        w.audio.sfx('oz/statue/step');
      }
      StatueWave.run(w, this.x - 18, this.floorY, -1, this);
      StatueWave.run(w, this.x + 18, this.floorY, 1, this);
    }
    dust(w, this.x - 16, this.floorY, 5);
    dust(w, this.x + 16, this.floorY, 5);
    debris(w, this.x, this.floorY - 4, 'rock', 6);
    yield 16;
    this.setPose(false, STAND.stand);
    yield this.recoveryFor(S.rec);
  }

  /** The crozier hook: drawn back, glowing (tell); the head shoots out at chest height. */
  *hook(): ScriptGen {
    const H = STATUE.hook;
    const w = this.world;
    const tele = this.telegraphFor(H.tele);
    this.setPose(false, STAND.hookBack);
    this.glowT = tele;
    w.audio.sfx('oz/statue/tell', { pitch: 1.15 });
    yield tele;
    if (!this.partAlive('crozier')) {
      this.setPose(false, STAND.stand);
      return;
    }
    this.setPose(false, STAND.hookOut);
    this.record('hook', tele);
    w.audio.sfx('oz/statue/hook');
    this.crozierOut = 0;
    this.hookDmg = 0;
    // Out until it catches a hero, reaches its end or leaves the view.
    const speed = H.speed * difficultyOf(w).enemyBulletSpeed;
    while (this.crozierOut < H.reach && !this.hooked) {
      this.crozierOut = Math.min(H.reach, this.crozierOut + speed);
      if (!this.partAlive('crozier')) break;
      if (this.crozierHead()[0] < w.camera.left + 4) break;
      this.tryCatch();
      yield;
    }
    if (this.hooked) {
      w.audio.sfx('oz/statue/caught');
      let t = 0;
      while (this.hooked && this.crozierOut > 0 && t++ < H.hold) {
        this.crozierOut = Math.max(0, this.crozierOut - H.pull);
        yield;
      }
      // Pulled all the way in: the statue strikes (the hook lets go).
      const p = this.hooked as Entity | null;
      if (p && this.crozierOut <= 0) {
        this.strike.dirX = p.x < this.x ? -1 : 1;
        // Through world.damage (INTEGRATE): god mode and the damage rules apply to the strike too.
        w.damage(p, this.strike);
        pushX(p as Parameters<typeof pushX>[0], this.strike.dirX * 10, w.terrain, w);
      }
      this.letGo(false);
    }
    while (this.crozierOut > 0) {
      this.crozierOut = Math.max(0, this.crozierOut - H.speed);
      yield;
    }
    this.setPose(false, STAND.stand);
    yield this.recoveryFor(H.rec);
  }

  /** Does the crozier head touch a hero's body now? He is caught. */
  private tryCatch(): void {
    const [cx, cy] = this.crozierHead();
    const r = this.hookRect;
    r.x = cx - 6;
    r.y = cy - STATUE.hook.laneH / 2;
    r.w = 12;
    r.h = STATUE.hook.laneH;
    const list = this.world.byTag('player');
    for (let i = 0; i < list.length; i++) {
      const p = list[i] as Entity & { state?: string };
      if (!p.alive || (p.state !== undefined && p.state !== 'play')) continue;
      const hb = p.hitRect();
      if (hb.x < r.x + r.w && hb.x + hb.w > r.x && hb.y < r.y + r.h && hb.y + hb.h > r.y) {
        this.hooked = p;
        return;
      }
    }
  }

  /** Release the hooked hero (`free`: he broke loose: a snap). */
  letGo(free: boolean): void {
    if (!this.hooked) return;
    this.hooked = null;
    this.hookDmg = 0;
    if (free) this.world.audio.sfx('oz/statue/free');
  }

  // ------------------------------------------------------------------------------- per tick

  protected override think(): void {
    if (this.glowT > 0) this.glowT--;
    // The crozier part follows its head.
    if (!this.seated && this.crozierPart.enabled && !this.crozierPart.destroyed) {
      this.crozierHead();
      const b = this.crozierPart.box;
      b.x = tip[0] - this.x - BOX.crozierHead / 2;
      b.y = tip[1] - this.y - BOX.crozierHead / 2;
    }
    // The hook drags its hero along; a jump (or the crozier gone) frees him.
    const p = this.hooked as (Entity & { state?: string; onGround?: boolean }) | null;
    if (p) {
      if (!p.alive || p.state !== 'play' || !this.partAlive('crozier')) this.letGo(true);
      else if (p.vy < -0.5 && p.onGround === false) this.letGo(true);
      else {
        this.crozierHead();
        const dx = tip[0] + 4 - p.x;
        if (Math.abs(dx) > 0.5) pushX(p as Parameters<typeof pushX>[0], Math.max(-4, Math.min(4, dx)), this.world.terrain, this.world);
      }
    }
    // Deep cracks shed a little dust.
    if (!this.dormant && this.state === 'fight' && this.healthFrac < 0.5 && this.world.tick % 23 === 0) {
      const c = this.randomPoint();
      dust(this.world, c[0], c[1], 1);
    }
  }

  override onHit(d: Damage, part = 0): boolean {
    if (this.dead || this.removed) return false;
    if (this.dormant || this.state === 'waiting' || this.state === 'intro') {
      // Decor (and the wake): shots chip a little dust and do nothing.
      const box = this.hurtboxes()[part];
      if (box && this.world.tick - this.lastChip > 3) {
        this.lastChip = this.world.tick;
        chip(this.world, box.x + box.w / 2 - (d.dirX || 1) * box.w * 0.4, box.y + box.h * 0.4);
        this.world.audio.sfx('oz/statue/chip', { vol: 0.6 });
      }
      return true;
    }
    if (part === this.crozierPart.index && this.hooked && this.state === 'fight' && this.invulnTicks <= 0) {
      this.hookDmg += d.amount;
      if (this.hookDmg >= STATUE.hook.breakDmg) this.letGo(true);
    }
    return super.onHit(d, part);
  }

  protected override breakPart(p: BossPart, d: Damage): void {
    if (p.destroyed) return;
    super.breakPart(p, d);
    if (p === this.crozierPart) {
      this.letGo(true);
      this.world.audio.sfx('oz/statue/break');
      debris(this.world, this.crozierHead()[0], tip[1], 'rock', 10);
    }
  }

  protected override onDamageState(state: 1 | 2): void {
    // Stone, not metal: no smoke (the base smokes while damageState > 0), a burst of rock instead.
    this.damageState = 0;
    if (state <= this.crackState) return;
    this.crackState = state;
    const c = this.center();
    debris(this.world, c[0], c[1], 'rock', 8);
    this.world.audio.sfx('oz/statue/crack', { vol: 0.7, pitch: 1.1 });
  }

  protected override onStagger(_ticks: number): void {
    this.shakeX = 1;
  }

  protected override canStagger(): boolean {
    return !this.stepping;
  }

  protected override cutAttack(): boolean {
    this.letGo(false);
    this.crozierOut = 0;
    this.glowT = 0;
    this.setPose(this.seated, this.seated ? SIT.rest : STAND.stand);
    return true;
  }

  override update(): void {
    super.update();
    if (this.staggerTicks <= 0 && this.shakeX !== 0 && this.state === 'fight') this.shakeX = 0;
    else if (this.staggerTicks > 0) this.shakeX = this.world.tick % 4 < 2 ? 1 : -1;
  }

  // ------------------------------------------------------------------------------- the end

  protected override onDeathStart(): void {
    this.letGo(false);
    this.crozierOut = 0;
    this.glowT = 0;
    this.shakeX = 0;
    this.team = 'neutral';
    this.removeTag('shootable');
    this.removeTag('enemy');
    this.crozierPart.enabled = false;
    eraseEnemyShots(this.world, this.world.camera.view(16));
  }

  protected override deathSequence(): ScriptGen {
    const self = this;
    const E = STATUE.end;
    return (function* plechelmusFreed(): ScriptGen {
      const w = self.world;
      self.setPose(self.seated, self.seated ? SIT.rest : STAND.stand);
      // The ghost is torn out of the stone and flees with a shriek (not seen again in this level).
      w.audio.sfx('oz/statue/tear');
      w.camera.shake(4, 30);
      for (let t = 0; t < 24; t++) {
        self.shakeX = t % 4 < 2 ? 1 : -1;
        self.crack = 1;
        self.eyes = 1;
        yield;
      }
      self.shakeX = 0;
      const g = w.spawn(OZ_WUGHOST.winkel, self.eyeX(), self.eyeY() + 30, { visible: true, facing: 1 }) as OzWinkel;
      if (g && typeof g.shriek === 'function') {
        g.shriek(50);
        g.say(WINKEL_LINES.flee, 100);
      }
      self.eyes = 0.3;
      yield E.tear;
      if (g && typeof g.flee === 'function' && !g.removed) g.flee(260, 2.8);
      // The cracks close, the eyes go dark.
      w.audio.sfx('oz/statue/heal');
      for (let t = 1; t <= E.close; t++) {
        self.crack = 1 - t / E.close;
        self.eyes = Math.max(0, 0.3 - t / E.close);
        yield;
      }
      self.crack = 0;
      self.eyes = 0;
      // Back to the plinth: walk home, climb up, sit down; the torn-out blocks are whole again.
      if (!self.seated) {
        let k = 0;
        while (Math.abs(self.x - (self.homeX - 18)) > 1) {
          self.x += Math.sign(self.homeX - 18 - self.x) * Math.min(E.walk, Math.abs(self.homeX - 18 - self.x));
          self.setPose(false, STAND.walk[Math.floor(++k / STATUE.walk.stride) % 4]);
          if (k % (STATUE.walk.stride * 2) === STATUE.walk.stride) w.audio.sfx('oz/statue/step', { vol: 0.5 });
          yield;
        }
        self.setPose(false, STAND.rise);
        const x0 = self.x;
        for (let t = 1; t <= STATUE.step.hop; t++) {
          const q = t / STATUE.step.hop;
          self.x = x0 + (self.homeX - x0) * q;
          self.lift = -PLINTH.h * q - Math.sin(q * Math.PI) * 10;
          yield;
        }
        w.audio.sfx('oz/statue/sit');
        yield 10;
        self.lift = 0;
        self.x = self.homeX;
        self.setPose(true, SIT.rest);
        w.camera.shake(2, 10);
      }
      self.missing = 0;
      dust(w, self.homeX, self.floorY - 20, 4);
      yield E.sit;
      self.speak(PLECHELMUS_LINES.freed, E.thanks);
      yield E.thanks;
    })();
  }

  // ------------------------------------------------------------------------------- light, draw

  lightOf(out: LightSpot, _tick: number): boolean {
    if (this.eyes <= 0.05) return false;
    out.x = this.eyeX();
    out.y = this.eyeY();
    out.r = 22;
    out.color = GREEN;
    out.intensity = 0.4 * this.eyes;
    out.flicker = 0.2;
    return true;
  }

  override draw(r: Renderer): void {
    r.sprite(ID_PLINTH, this.missing, this.homeX, this.floorY, drawOpts);
    const p = this.bodyPose;
    const ax = Math.round(this.anchorX() + this.shakeX);
    const ay = Math.round(this.anchorY());
    // The hit flash: a pale overlay on the stone (not a white cut-out: he stays a statue).
    const flash = this.flashTicks > 0 && this.world.tick % 2 === 0;
    drawOpts.flash = false;
    const bodyId = this.seated ? ID_SIT : ID_STAND;
    r.sprite(bodyId, this.pose, ax, ay, drawOpts);
    if (flash) {
      flashOpts.alpha = 0.22;
      r.sprite(bodyId, this.pose, ax, ay, flashOpts);
    }
    // The crozier (whole or broken), the hook's stretched staff, the hand over the shaft.
    const broken = this.crozierPart.destroyed;
    const hx = ax + p.hand[0];
    const hy = ay + p.hand[1];
    const cid = broken ? ID_CROZIER_BROKEN : ID_CROZIER;
    if (this.crozierOut > 0 && !broken) {
      for (let s = hx - 10; s > hx - this.crozierOut - 4; s -= 10) r.sprite(ID_SHAFT, 0, s, hy, drawOpts);
    }
    r.sprite(cid, p.crozier, hx - (broken ? 0 : this.crozierOut), hy, drawOpts);
    if (this.glowT > 0 && !broken) {
      addOpts.tint = GREEN;
      addOpts.alpha = 0.35 + 0.25 * Math.sin(this.world.tick * 0.5);
      r.sprite(cid, p.crozier, hx - this.crozierOut, hy, addOpts);
      addOpts.tint = undefined;
    }
    r.sprite(ID_FIST, 0, hx, hy, drawOpts);
    drawOpts.flash = false;
    // The curse: the glowing cracks and eyes, a faint aura.
    if (this.crack > 0) {
      const spots = this.seated ? CRACK_SPOTS.sit : CRACK_SPOTS.stand;
      const deep = this.state === 'fight' ? 1 - this.healthFrac : 0;
      addOpts.alpha = Math.min(1, this.crack * (0.55 + 0.45 * deep));
      const n = this.crack >= 1 && deep > 0.4 ? 3 : 2;
      for (let i = 0; i < n; i++) r.sprite(ID_CRACK, i, ax + spots[i][0] + (i === 0 ? p.lean : 0), ay + spots[i][1] + (i === 0 ? p.dip : 0), addOpts);
    }
    if (this.eyes > 0) {
      addOpts.alpha = this.eyes * 0.35;
      r.sprite(ID_GLOW, 0, this.eyeX() + this.shakeX, this.eyeY(), addOpts);
      addOpts.alpha = this.eyes;
      r.sprite(ID_EYES, this.world.tick % 30 < 15 ? 0 : 1, this.eyeX() + this.shakeX, this.eyeY(), addOpts);
    }
    addOpts.alpha = 1;
  }
}

/** The crozier's angle for a test / tools (degrees). */
export function crozierAngle(i: number): number {
  return CROZIER_ANGLES[i];
}

export { CZ };

defineEntity(OZ_STATUE.boss, (w, x, y, p) => new Plechelmus(w, x, y, p), {
  category: 'boss',
  score: STATUE.score,
  description:
    'oldenzaal mini-boss: the statue of St. Plechelmus on its plinth (spawn at the plinth foot). Dormant decor until awaken(); phase 1 seated (crozier sweep, thrown stone), phase 2 on foot (ground slam, crozier hook). Freed at the end: back on the plinth, whole.',
});
