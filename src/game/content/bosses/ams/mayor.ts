/**
 * ROBO-HALSEMA, THE IRON MAYOR — the boss of mission `ams` (docs/design/amsterdam.md §3).
 *
 * Spawn it with x = the Stopera doors and y = the floor (`ctx.spawn('ams-mayor', 1190, 'ground')`):
 * the invulnerable intro steps her out of the doors 40 px toward the players (`facing`, default
 * −1 = left). It works on a flat test floor too.
 *
 * Parts (required-parts model, GDD §10.0; HP × difficulty × co-op): `stamp-arm` 400, `chain` 350,
 * `medallion` 450 (the core: armoured until the arm and the chain are broken), all required, and
 * the optional `head` 250 (the letter hatch: broken, the letter rain stops). `legs` and `torso`
 * are armour (shots ping; a blast against them reaches the nearest live part within 48 px).
 *
 * - Phase 1: A STAMP SLAM (the arm rises, a shadow marks the spot, T 30; the slam sends a
 *   `stamp-wave` along the floor both ways: jump it), B LETTER RAIN (the hair hatch opens, T 24;
 *   4–6 `noise-letter`s flutter down: shoot them or step aside). Adds: a `handhaver` every 420
 *   ticks, at most 3 alive (tag cap). Every phase's adds come in from alternating sides.
 * - Phase 2 (the arm or the chain broken): C CHAIN WHIP (she whirls the chain high — crouch — or
 *   low — jump —, alternating, T 28, `ams/chain` pitched by lane; the lash reaches 124 px), B continues. If the
 *   chain broke first, A replaces C. Adds: a flock of 3 `seagull`s every 600 ticks.
 * - Phase 3 (both broken): the medallion opens. D SHIELD FAN (glow T 24; 5 `shield-shot`s in a
 *   fixed fan, 6°–72° below the horizon with safe lanes; HARD 6), E STOMP (a shadow under her landing spot, T 24;
 *   she hops 48 px forward, lands — only the landing under her feet hurts —, then back). Adds: a
 *   `delivery-rider` pass from alternating sides.
 * - Death (230 ticks): sparks and small blasts, the hair flies off like a wig, the head
 *   boings on a spring, she sits down and powers off, a big explosion.
 * - Stagger (a continued hero landed, `Boss.stagger`): the shout face, a 1-px shake and a '!'. The
 *   running attack ends cleanly (`cutAttack`: no lash or landing box, no glow), after the stamp's
 *   slam and after a stomp's landing (`canStagger`); then her phase runs on without its opening.
 * Every attack is telegraph (≥ 18 ticks, `telegraphFor`) → attack → recovery (`recoveryFor`).
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer, SrcRect } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { difficultyOf } from '../../../context';
import { debris, dust, explosion, hitSpark, smokeTrail } from '../../../fx';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { easeInQuad } from '../../../../engine/math';
import { getFrames } from '../../../../engine/sprites';
import {
  ARM_ANTICIPATION,
  ARM_COIL,
  ARM_FRAMES,
  ARM_IMPACT,
  ARM_LIFT,
  ARM_LOW,
  ARM_LOWER,
  ARM_OVERSHOOT,
  ARM_RAISED,
  ARM_RECOIL,
  ARM_RISE_A,
  ARM_RISE_B,
  ARM_RISE_HIGH,
  ARM_RISE_LOW,
  ARM_RISE_MID,
  ARM_SAG,
  ARM_SETTLE,
  ARM_SLAM,
  ARM_SMEAR,
  ARM_SMEAR_LOW,
  ARM_TREMBLE,
  BACK_CATCH,
  BACK_HIGH,
  BACK_LOW,
  BACK_PULL_HIGH,
  BACK_PULL_LOW,
  BACK_RELEASE_HIGH,
  BACK_RELEASE_LOW,
  BACK_REST,
  BACK_WHIRL_HIGH,
  BACK_WHIRL_LOW,
  BACK_WHIRL_STEPS,
  BACK_WIND_HIGH,
  BACK_WIND_LOW,
  HEAD_BALD,
  HEAD_BALD_B,
  HEAD_BLINK,
  HEAD_BLINK_HALF,
  HEAD_HATCH,
  HEAD_HATCH_AJAR,
  HEAD_OFF,
  HEAD_SHOUT,
  HEAD_SHOUT_IN,
  HEAD_SMILE,
  LASH_BACK_A,
  LASH_OUT_A,
  LASH_SNAP_A,
  LASH_SNAP_B,
  LEGS_AIR,
  LEGS_BRACE,
  LEGS_GIVE,
  LEGS_HALF_SQUAT,
  LEGS_LAND,
  LEGS_PUSH_OFF,
  LEGS_REACH,
  LEGS_REEL,
  LEGS_SIT,
  LEGS_SQUAT,
  LEGS_STAND,
  LEGS_WALK_FRAMES,
  LEGS_WALK_TICKS,
  MAYOR_WALK,
  MED_CHARGE,
  MED_CLOSED,
  MED_CRACK,
  MED_FLASH,
  MED_GLOW,
  MED_OPEN,
  MED_PART,
  STUMP_FRAMES,
  WIG_FRAMES,
} from '../../art40/ams-mayor.gen';
import { HEAD_SHOW, MED_SHOW, STAMP_SHOW, STOMP_SHOW, WHIP_SHOW, WIG_ANCHOR, WIG_REST } from './layout';
import { ADD_TAG, MAYOR, MAYOR_NAME } from './geometry';
import { floorAt, NoiseLetter, ShieldShot, StampWave } from './shots';
import { MAYOR_LINES, type MayorLineId } from './voice';

const ART = 'boss/ams-mayor';
// Hoisted sprite ids of the per-tick draw (no template strings in the hot path).
const ID_ARM_BACK = ART + '/arm-back';
const ID_LEGS = ART + '/legs';
const ID_WIG = ART + '/wig';
const ID_LASH = ART + '/lash';
const OFFICER_TAG = 'ams-mayor-officer';
const RIDER_TAG = 'ams-mayor-rider';
const drawOpts: DrawOpts = {};
const srcRect: SrcRect = { x: 0, y: 0, w: 0, h: 0 };
const DEG = Math.PI / 180;
/** Ticks from the start of `ams/stamp` to its baked-in slam (0.5 s, content/sfx/ams.ts). */
const STAMP_SFX_SLAM = 30;
/** The `sfxLoop` key of her robot chatter (`ams/mayor-babble`). */
const BABBLE_KEY = 'mayor-babble';
/** The speaker name of her voice clips (`say`): her own lines replace each other. */
const MAYOR_SPEAKER = 'mayor';
/** Ticks of calm after a stagger before her phase runs on (its next tell follows). */
const RESUME_GAP = 12;

type Lane = 'high' | 'low';

export class AmsMayor extends Boss {
  /** The floor she stands on, the doors (spawn x) and her fighting spot. */
  readonly floorY: number;
  readonly doorX: number;
  homeX: number;

  // Look state (read by draw; set by the scripts).
  /** Stamp arm: 0 low, 1 raised, 2 slammed. */
  armPose: 0 | 1 | 2 = 0;
  /** Far arm: 0 rest, 1 chain loop high, 2 low. */
  backArm: 0 | 1 | 2 = 0;
  /** Head: 0 smile, 1 hatch open, 2 shout, 3 off, 4 bald off, 5 bald dizzy. */
  headFrame = 0;
  /** Draw-only x offset of the stagger shake (px). */
  private shakeX = 0;
  /** Medallion: 0 closed, 1 open, 2 firing glow. */
  medFrame: 0 | 1 | 2 = 0;
  legsFrame = 0;
  /** Lift off the floor (stomp hop, px up) and the sit drop (death, px down). */
  lift = 0;
  sitDrop = 0;
  /** Doorway dimming during the intro (0..1). */
  dim = 0;
  /** A floor shadow tell: world x, frame (0 = 56 px, 1 = 52 px), ticks left. */
  shadowX = 0;
  shadowFrame = 0;
  shadowT = 0;
  /** The chain lash: lane, length (0 = none), damaging. */
  lashLane: Lane = 'high';
  lashLen = 0;
  lashHot = false;
  /** Landing under her feet hurts for these ticks. */
  stompHot = 0;
  /** Glow flicker of a telegraph (ticks left). */
  glowT = 0;
  /** Death: the wig in flight, the spring. */
  wigOn = true;
  wigX = 0;
  wigY = 0;
  private wigVx = 0;
  private wigVy = 0;
  springH = 0;
  /** Death: the wig's spin (ticks; 3 per 45° step). */
  wigSpin = 0;
  /** Draw-only transition timers (docs/ART_GUIDE.md "Motion"): the tick the arm / legs look changed and from what. */
  private armAt = -99;
  private armFrom: 0 | 1 | 2 = 0;
  private legsAt = -99;
  private legsFrom = 0;
  private legsSeen = 0;
  /**
   * Draw-only trackers of the presentation (layout.ts): when the far arm, the head and the medallion
   * last changed and from what, the tick the slam is due, the last tick in the air, the tick the
   * lash reached full length and the tick of the shield volley. Nothing in the fight reads them.
   */
  private armDueAt = -99;
  private backAt = -99;
  private backFrom = 0;
  private backSeen = 0;
  private headAt = -99;
  private headFrom = 0;
  private headSeen = 0;
  private medAt = -99;
  private medFrom = 0;
  private medSeen = 0;
  private airAt = -99;
  private lashFullAt = -99;
  private medFireAt = -99;
  private nextLane: Lane = 'high';
  private addT = 0;
  /** The side the next add comes in from (flips only when an add spawns). */
  private addSide: 1 | -1 = -1;
  /** World tick of the slam baked into the running `ams/stamp` sound (a stagger waits for it). */
  private slamAt = -1;
  private lastPing = 0;
  /** A second bubble that follows a long taunt after `wait` ticks (cosmetic, no script yield). */
  private followUp: { id: MayorLineId; ticks: number; wait: number } | null = null;
  /** Ticks left of the robot chatter loop (`ams/mayor-babble`) under her current bubble. */
  private babbleT = 0;
  /** Check the phase conditions on the next fight tick (a sandbox start in a later phase). */
  private recheck = false;
  private readonly armPart: BossPart;
  private readonly chainPart: BossPart;
  private readonly medPart: BossPart;
  private readonly headPart: BossPart;
  private readonly armorParts: BossPart[] = [];
  private readonly hot: Rect[] = [];
  private readonly lashRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly stompRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly hitDamage: Damage = { amount: 10, kind: 'impact', dirX: 0, tags: ['boss'] };

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: MAYOR_NAME, hp: 1, score: MAYOR.score });
    this.facing = paramFacing(p, -1);
    const f = Number.isFinite(y) ? floorAt(world, x, y - 48, y + 48) : floorAt(world, x, 0, 400);
    this.y = Number.isFinite(f) ? f : Number.isFinite(y) ? y : world.camera.bottom - 40;
    this.floorY = this.y;
    this.doorX = x;
    this.homeX = x + this.facing * MAYOR.intro.step;
    // `hpScale` (spawn param, default 1): a test / sandbox knob for short fights.
    const k = Math.max(0.01, paramNum(p, 'hpScale', 1));
    const B = MAYOR.box;
    this.armPart = this.addPart('stamp-arm', { box: { ...B.armLow }, hp: MAYOR.hp.arm * k, required: true });
    this.chainPart = this.addPart('chain', { box: B.chain, hp: MAYOR.hp.chain * k, required: true });
    this.medPart = this.addPart('medallion', { box: B.medallion, hp: MAYOR.hp.medallion * k, required: true, armored: true });
    this.headPart = this.addPart('head', { box: B.head, hp: MAYOR.hp.head * k });
    this.armorParts.push(this.addPart('legs', { box: B.legs }), this.addPart('torso', { box: B.torso }));
    this.contactDamage = this.hitDamage;
    this.phaseIntermission = MAYOR.phaseIntermission;
    this.phases = [
      { at: 1, name: 'stamp', pattern: (b) => b.phaseOne(), resume: (b) => b.phaseOne(true) },
      { name: 'chain', when: (b) => b.brokenCount(['stamp-arm', 'chain']) >= 1, pattern: (b) => b.phaseTwo(), resume: (b) => b.phaseTwo(true), onEnter: (b) => b.enterTwo() },
      { name: 'core', when: (b) => b.brokenCount(['stamp-arm', 'chain']) >= 2, pattern: (b) => b.phaseThree(), resume: (b) => b.phaseThree(true), onEnter: (b) => b.enterThree() },
    ];
  }

  // ------------------------------------------------------------------------------- geometry

  /** World x of a local x (the art faces right; mirrored when facing left). */
  wx(lx: number): number {
    return this.x + (this.facing < 0 ? -lx : lx);
  }

  wy(ly: number): number {
    return this.y + ly;
  }

  private target(): Entity | null {
    return this.world.nearestPlayer(this.wx(40), this.floorY - 20);
  }

  private setArm(pose: 0 | 1 | 2): void {
    if (pose !== this.armPose) {
      this.armFrom = this.armPose;
      this.armAt = this.world.tick;
    }
    this.armPose = pose;
    const src = pose === 0 ? MAYOR.box.armLow : pose === 1 ? MAYOR.box.armHigh : MAYOR.box.armSlam;
    const b = this.armPart.box;
    b.x = src.x;
    b.y = src.y;
    b.w = src.w;
    b.h = src.h;
  }

  /** Show one of her lines in a bubble and speak it (`playVoice`). */
  private say2(id: MayorLineId, ticks = 110, pitch = 1): void {
    const text = MAYOR_LINES[id].text;
    // `voice: false`: the runner does not voice this bubble; playVoice speaks it instead.
    this.say(text, { at: MAYOR.sayAt, ticks, voice: false });
    this.playVoice(id, ticks, pitch);
  }

  /**
   * Play her voice clip for a line (bosses/ams/voice.ts: `MAYOR_LINES[id].file` under
   * public/audio/, the placeholder `mayor/placeholder.mp3` until the final recordings exist).
   * When no clip is loaded (headless, a failed fetch, VOICE VOLUME 0) the wordless robot chatter
   * `ams/mayor-babble` stands in for as long as the line takes to read; `pitch` only shapes the
   * chatter (TOT ZIENS... winds down). Cosmetic: nothing in the fight waits for the audio.
   */
  private playVoice(id: MayorLineId, ticks: number, pitch = 1): void {
    const audio = this.world.audio;
    const text = MAYOR_LINES[id].text;
    if (audio.hasVoice?.(text)) {
      if (this.babbleT > 0) audio.stopSfx?.(BABBLE_KEY);
      this.babbleT = 0;
      audio.say?.(text, MAYOR_SPEAKER, { important: true });
      return;
    }
    audio.sfxLoop?.(BABBLE_KEY, 'ams/mayor-babble', { pitch });
    this.babbleT = Math.min(ticks, Math.max(24, text.length * 3));
  }

  /** A taunt in two bubbles: the second one follows the first without delaying the script. */
  private sayTwo(first: MayorLineId, second: MayorLineId, ticks = 90): void {
    this.say2(first, ticks);
    this.followUp = { id: second, ticks, wait: ticks };
  }

  // ------------------------------------------------------------------------------- intro

  /** She steps out of the Stopera doors (dim → lit), walks 40 px forward and complains. */
  override *intro(): ScriptGen {
    const I = MAYOR.intro;
    this.x = this.doorX;
    for (let t = 0; t < I.total; t++) {
      // The doors hiss open and clank; her servos whirr up (0.35 s in) as she steps out at `dim`.
      if (t === I.dim - 20) this.world.audio.sfx('ams/mayor-intro');
      this.dim = t < I.dim ? 1 - t / I.dim : 0;
      if (t >= I.dim && t < I.dim + I.walk) {
        const k = (t - I.dim + 1) / I.walk;
        this.x = this.doorX + (this.homeX - this.doorX) * k;
        // The 12-frame walk over two 16-tick strides (the footfalls stay on ticks 15 and 31: the
        // near foot lands on walk frame 5, the far one on frame 11).
        this.legsFrame = MAYOR_WALK + Math.floor((((t - I.dim) % LEGS_WALK_TICKS) * LEGS_WALK_FRAMES) / LEGS_WALK_TICKS);
        if ((t - I.dim) % 16 === 15) {
          this.world.audio.sfx('hit/ground', { vol: 0.6 });
          this.world.camera.shake(2, 6);
          dust(this.world, this.x, this.floorY, 3);
        }
      } else this.legsFrame = LEGS_STAND;
      if (t === I.dim + I.walk + 4) {
        this.headFrame = HEAD_SHOUT;
        this.say2('complained', 70);
      }
      if (t === I.dim + I.walk + 20) this.headFrame = HEAD_SMILE;
      if (t === I.dim + I.walk + 76) {
        this.headFrame = HEAD_SHOUT;
        this.setArm(1);
        this.armDueAt = this.world.tick + (I.total - 12 - t);
        this.say2('closed', 56);
      }
      if (t === I.total - 12) {
        this.headFrame = HEAD_SMILE;
        this.setArm(2);
        // A plain thud: the arm rises only 12 ticks before, too short for the `ams/stamp` creak.
        this.world.audio.sfx('hit/ground', { pitch: 0.7 });
        this.world.audio.sfx('hit/metal', { vol: 0.5, pitch: 0.8 });
        this.world.camera.shake(3, 10);
        dust(this.world, this.wx(MAYOR.slamX), this.floorY, 6);
      }
      yield;
    }
    this.x = this.homeX;
    this.setArm(0);
    this.dim = 0;
    // `phase` (spawn param, 1–3): a test / sandbox knob that starts the fight in a later phase.
    const start = Math.round(paramNum(this.params, 'phase', 1));
    const d: Damage = { amount: 0, kind: 'explosion', dirX: 0, owner: -1 };
    if (start >= 2) this.breakPart(this.armPart, d);
    if (start >= 3) this.breakPart(this.chainPart, d);
    if (start >= 2) {
      this.refreshRequiredHp();
      this.recheck = true;
    }
  }

  // ------------------------------------------------------------------------------- phase 1

  /** Phase 1; `resume`: after a stagger (no opening wait, no taunt). */
  *phaseOne(resume = false): ScriptGen {
    // 40: the intro's GESLOTEN bubble has cleared before the first raised-stamp tell.
    yield resume ? RESUME_GAP : 40;
    let taunted = resume;
    for (;;) {
      if (this.partAlive('stamp-arm')) yield* this.stampSlam();
      if (!taunted) {
        taunted = true;
        this.say2('noFries', 90);
      }
      yield 20;
      yield* this.letterRain();
      yield 20;
    }
  }

  /** A — Stamp Slam: arm up, shadow on the spot (T 30); slam, two floor waves (HARD: two pairs). */
  *stampSlam(): ScriptGen {
    const S = MAYOR.stamp;
    const tele = this.telegraphFor(S.tele);
    this.setArm(1);
    this.glowT = tele;
    this.shadowX = this.wx(MAYOR.slamX);
    this.shadowFrame = 0;
    this.shadowT = tele;
    // `ams/stamp` is the whole warning: a creak with the slam baked in at STAMP_SFX_SLAM ticks.
    // The rate is matched to this difficulty's telegraph so the baked-in slam lands on the slam.
    // A stagger waits for that slam (`canStagger`): it never leaves the sound's slam for later.
    this.world.audio.sfx('ams/stamp', { pitch: STAMP_SFX_SLAM / tele });
    this.slamAt = this.world.tick + tele;
    this.armDueAt = this.slamAt;
    yield tele;
    if (!this.partAlive('stamp-arm')) return;
    this.setArm(2);
    const sx = this.wx(MAYOR.slamX);
    StampWave.slam(this.world, sx, this.floorY, this);
    this.world.camera.shake(4, 14);
    dust(this.world, sx, this.floorY, 8);
    const n = this.volleySize(1);
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        yield 24;
        if (!this.partAlive('stamp-arm')) return;
        // Draw only: the stamp thumps again (the impact, the recoil, the settle replay).
        this.armAt = this.world.tick;
        this.world.audio.sfx('hit/ground', { vol: 0.8, pitch: 0.7 });
        this.world.camera.shake(3, 10);
      }
      StampWave.run(this.world, sx - 30, this.floorY, -1, this);
      StampWave.run(this.world, sx + 30, this.floorY, 1, this);
    }
    yield this.recoveryFor(S.rec);
    if (this.partAlive('stamp-arm')) this.setArm(0);
  }

  /** B — Letter Rain: the hatch opens (T 24), 4–6 letters (HARD +1) flutter down round the player. */
  *letterRain(): ScriptGen {
    if (!this.partAlive('head')) return;
    const L = MAYOR.letters;
    const tele = this.telegraphFor(L.tele);
    this.headFrame = HEAD_HATCH;
    this.world.audio.sfx('ams/ticket');
    yield tele;
    if (!this.partAlive('head')) {
      this.headFrame = HEAD_SMILE;
      return;
    }
    const w = this.world;
    const t = this.target();
    const cx = t ? t.x : this.wx(120);
    const n = this.volleySize(w.rng.int(L.min, L.max));
    const cam = w.camera;
    for (let i = 0; i < n; i++) {
      if (!this.partAlive('head')) break;
      // Spread across the stage round the player: −60 … +60 px.
      const off = n > 1 ? -60 + (120 * i) / (n - 1) : 0;
      const tx = Math.max(cam.left + 12, Math.min(cam.right - 12, cx + off + w.rng.range(-8, 8)));
      NoiseLetter.launch(w, this.wx(MAYOR.hatch[0]), this.wy(MAYOR.hatch[1] - 4), tx, this.floorY, i * 7, this);
      w.audio.sfx('ams/ticket', { vol: 0.4 });
      yield L.gap;
    }
    yield 12;
    this.headFrame = HEAD_SMILE;
    yield this.recoveryFor(L.rec);
  }

  // ------------------------------------------------------------------------------- phase 2

  enterTwo(): void {
    this.lashLen = 0;
    this.lashHot = false;
    this.backArm = 0;
    this.addT = 0;
  }

  /** Phase 2; `resume`: after a stagger (no opening line, no taunt). */
  *phaseTwo(resume = false): ScriptGen {
    if (resume) yield RESUME_GAP;
    else {
      this.headFrame = HEAD_SHOUT;
      // The bubble hangs where the chain loop whirls: it clears before the first whip tell.
      this.say2('rules', 48);
      yield 52;
      this.headFrame = HEAD_SMILE;
    }
    let taunted = resume;
    for (;;) {
      if (this.partAlive('chain')) {
        yield* this.chainWhip(this.nextLane);
        this.nextLane = this.nextLane === 'high' ? 'low' : 'high';
        yield 16;
        yield* this.chainWhip(this.nextLane);
        this.nextLane = this.nextLane === 'high' ? 'low' : 'high';
      } else if (this.partAlive('stamp-arm')) yield* this.stampSlam();
      if (!taunted) {
        taunted = true;
        this.sayTwo('hotdog1', 'hotdog2');
      }
      yield 20;
      yield* this.letterRain();
      yield 20;
    }
  }

  /** C — Chain Whip: the loop whirls high (crouch) or low (jump), T 28; the lash shoots out 124 px. */
  *chainWhip(lane: Lane): ScriptGen {
    const W = MAYOR.whip;
    const tele = this.telegraphFor(W.tele);
    this.backArm = lane === 'high' ? 1 : 2;
    this.glowT = tele;
    // Height cue by ear too: the high lash winds up on a higher pitch than the low sweep.
    this.world.audio.sfx('ams/chain', { pitch: lane === 'high' ? 1.15 : 0.8 });
    yield tele;
    if (!this.partAlive('chain')) {
      this.backArm = 0;
      return;
    }
    this.lashLane = lane;
    this.lashHot = true;
    this.world.audio.sfx('ams/chain', { pitch: 1.3 });
    for (let t = 0; t < W.out; t++) {
      this.lashLen = Math.round((W.reach * (t + 1)) / W.out);
      yield;
    }
    yield W.hold;
    this.lashHot = false;
    for (let t = W.back - 1; t >= 0; t--) {
      this.lashLen = Math.round((W.reach * t) / W.back);
      yield;
    }
    this.lashLen = 0;
    this.backArm = 0;
    yield this.recoveryFor(W.rec);
  }

  // ------------------------------------------------------------------------------- phase 3

  enterThree(): void {
    this.lashLen = 0;
    this.lashHot = false;
    this.backArm = 0;
    this.medPart.armored = false;
    this.medFrame = MED_OPEN;
    this.addT = 0;
  }

  /** Phase 3; `resume`: after a stagger (no opening line; a stomp back home first when she is out). */
  *phaseThree(resume = false): ScriptGen {
    if (resume) {
      yield RESUME_GAP;
      if (Math.abs(this.x - this.homeX) > 1) {
        yield* this.stomp(-1);
        yield 20;
      }
    } else {
      this.headFrame = HEAD_SHOUT;
      this.say2('fine', 110);
      yield 30;
      this.headFrame = HEAD_SMILE;
    }
    for (;;) {
      yield* this.shieldFan();
      yield 20;
      yield* this.stomp(1);
      yield 16;
      yield* this.shieldFan();
      yield 20;
      yield* this.stomp(-1);
      yield 20;
      yield* this.letterRain();
      yield 20;
    }
  }

  /** D — Shield Fan: the core glows (T 24), 5 enamel shields (HARD 6) in a fixed downward fan. */
  *shieldFan(): ScriptGen {
    const F = MAYOR.fan;
    const tele = this.telegraphFor(F.tele);
    this.medFrame = MED_GLOW;
    this.glowT = tele;
    this.world.audio.sfx('machine/pipe-charge');
    yield tele;
    const n = Math.min(F.angles.length, this.volleySize(5));
    const mx = this.wx(MAYOR.medallionC[0] + 10);
    const my = this.wy(MAYOR.medallionC[1]) - this.lift;
    for (let i = 0; i < n; i++) {
      const a = F.angles[i] * DEG;
      const ang = this.facing < 0 ? Math.PI - a : a;
      ShieldShot.fire(this.world, mx, my, ang, this);
    }
    this.world.audio.sfx('hit/shield');
    this.medFireAt = this.world.tick;
    yield 16;
    this.medFrame = MED_OPEN;
    yield this.recoveryFor(F.rec);
  }

  /**
   * E — Stomp: a shadow on the landing spot (T 24, she squats), a 22-tick hop of 48 px (forward
   * `dir` 1 / back −1), the landing hurts only under her feet (6 ticks), screen shake.
   */
  *stomp(dir: 1 | -1): ScriptGen {
    const S = MAYOR.stomp;
    const cam = this.world.camera;
    const from = this.x;
    let to = dir > 0 ? from + this.facing * S.dist : this.homeX;
    to = Math.max(cam.left + 40, Math.min(cam.right - 30, to));
    const tele = this.telegraphFor(S.tele);
    this.shadowX = to;
    this.shadowFrame = 1;
    this.shadowT = tele + S.air;
    this.legsFrame = LEGS_SQUAT;
    this.world.audio.sfx('machine/brake', { vol: 0.5 });
    yield tele;
    this.legsFrame = LEGS_STAND;
    for (let t = 1; t <= S.air; t++) {
      const k = t / S.air;
      this.x = from + (to - from) * k;
      this.lift = Math.round(Math.sin(k * Math.PI) * S.lift);
      yield;
    }
    this.lift = 0;
    this.x = to;
    this.legsFrame = LEGS_SQUAT;
    // A stagger that came in mid-air waited for this landing: it lands harmless.
    this.stompHot = this.staggering ? 0 : S.land;
    this.world.camera.shake(5, 16);
    this.world.audio.sfx('hit/ground', { pitch: 0.6 });
    this.world.audio.sfx('hit/metal', { vol: 0.5, pitch: 0.6 });
    dust(this.world, this.x - 16, this.floorY, 5);
    dust(this.world, this.x + 16, this.floorY, 5);
    yield 10;
    this.legsFrame = LEGS_STAND;
    yield this.recoveryFor(S.rec);
  }

  // ------------------------------------------------------------------------------- per tick

  override update(): void {
    super.update();
    if (this.legsFrame !== this.legsSeen) {
      this.legsFrom = this.legsSeen;
      this.legsSeen = this.legsFrame;
      this.legsAt = this.world.tick;
    }
    // Draw-only trackers (the presentation of layout.ts).
    const now = this.world.tick;
    if (this.backArm !== this.backSeen) {
      this.backFrom = this.backSeen;
      this.backSeen = this.backArm;
      this.backAt = now;
    }
    if (this.headFrame !== this.headSeen) {
      this.headFrom = this.headSeen;
      this.headSeen = this.headFrame;
      this.headAt = now;
    }
    if (this.medFrame !== this.medSeen) {
      this.medFrom = this.medSeen;
      this.medSeen = this.medFrame;
      this.medAt = now;
    }
    if (this.lift > 0) this.airAt = now;
    if (!this.lashHot || this.lashLen < MAYOR.whip.reach) this.lashFullAt = now + 1;
    if (this.babbleT > 0 && --this.babbleT === 0) this.world.audio.stopSfx?.(BABBLE_KEY);
  }

  override onRemove(): void {
    super.onRemove();
    if (this.babbleT > 0) this.world.audio.stopSfx?.(BABBLE_KEY);
    this.babbleT = 0;
  }

  protected override think(): void {
    const w = this.world;
    if (this.shadowT > 0) this.shadowT--;
    if (this.glowT > 0) this.glowT--;
    if (this.stompHot > 0) this.stompHot--;
    if (this.followUp && --this.followUp.wait <= 0) {
      const f = this.followUp;
      this.followUp = null;
      if (this.state === 'fight') this.say2(f.id, f.ticks);
    }
    if (this.recheck && this.state === 'fight' && this.phase >= 0) {
      this.recheck = false;
      this.checkPhases();
    }
    // No adds while every player is out (the continue countdown) or while she staggers.
    if (this.state === 'fight' && this.invulnTicks <= 0 && !this.holdAdds) this.adds();
    // Part damage looks: smoke at ≤ 50 %, sparks at ≤ 25 %, a smoking stump when gone.
    if (w.tick % 8 === 0) {
      for (let i = 0; i < 4; i++) {
        const p = this.parts[i];
        const st = this.partState(p);
        if (st === 0 || (st === 1 && w.tick % 16 !== 0)) continue;
        const b = p === this.armPart && p.destroyed ? { x: 20, y: -104, w: 16, h: 16 } : p.box;
        const cx = this.wx(b.x + w.fxRng.range(0, b.w));
        const cy = this.wy(b.y + w.fxRng.range(0, b.h)) - this.lift;
        smokeTrail(w, cx, cy, true);
        if (st === 2) hitSpark(w, cx, cy, -this.facing);
      }
    }
  }

  /** A continued hero landed: a '!' where her lines show (draw: the shout face and a 1-px shake). */
  protected override onStagger(): void {
    this.say('!', { at: MAYOR.sayAt, ticks: 30, voice: false });
    this.world.audio.sfx('enemy/double-take');
  }

  /**
   * Never hold the attack in the air (a stomp in flight lands first), nor between the stamp's
   * creak and its slam (the slam is baked into `ams/stamp`: it lands on time, then she holds).
   */
  protected override canStagger(): boolean {
    return this.lift === 0 && this.world.tick >= this.slamAt;
  }

  /**
   * A stagger holds her: the running attack ends cleanly — the lash and the landing box off, no
   * glow or shadow tell, the stamp arm, the far arm, the hatch, the core and the legs at rest. The
   * phase runs on (`phaseOne/Two/Three(true)`) when the stagger ends.
   */
  protected override cutAttack(): boolean {
    this.lashLen = 0;
    this.lashHot = false;
    this.backArm = 0;
    this.stompHot = 0;
    this.glowT = 0;
    this.shadowT = 0;
    this.legsFrame = LEGS_STAND;
    if (this.partAlive('stamp-arm')) this.setArm(0);
    if (this.headFrame === HEAD_HATCH || this.headFrame === HEAD_SHOUT) this.headFrame = HEAD_SMILE;
    if (this.medFrame === MED_GLOW) this.medFrame = MED_OPEN;
    return true;
  }

  /** Adds by phase, capped by tags (GDD §10.0 adds). */
  private adds(): void {
    const w = this.world;
    const A = MAYOR.adds;
    const cam = w.camera;
    this.addT++;
    const side = this.addSide;
    const enter = side < 0 ? 'left' : 'right';
    if (this.phase === 0) {
      if (this.addT % A.officerEvery !== 180 % A.officerEvery) return;
      if (w.countAlive(OFFICER_TAG) >= A.officerMax) return;
      const x = side < 0 ? cam.left - 10 : cam.right + 10;
      w.spawn('handhaver', x, this.floorY, { enter, tags: [ADD_TAG, OFFICER_TAG] });
    } else if (this.phase === 1) {
      if (this.addT % A.gullEvery !== 120) return;
      if (this.aliveOfType('seagull') > 0) return;
      const x = side < 0 ? cam.left + 30 : cam.right - 30;
      w.spawn('seagull', x, cam.top + 30, { flock: A.flock, enter: 'top', tags: [ADD_TAG] });
    } else if (this.phase === 2) {
      if (this.addT % A.riderEvery !== 150) return;
      if (w.countAlive(RIDER_TAG) >= A.riderMax) return;
      if (side < 0) w.spawn('delivery-rider', cam.left - 20, this.floorY, { from: 'behind', tags: [ADD_TAG, RIDER_TAG] });
      else w.spawn('delivery-rider', cam.right + 20, this.floorY, { from: 'right', tags: [ADD_TAG, RIDER_TAG] });
    } else return;
    // An add came in: the next one comes from the other side (bug 7.1: the side flipped every
    // tick and every spawn tick is even, so each phase used one side only).
    this.addSide = side < 0 ? 1 : -1;
  }

  private aliveOfType(type: string): number {
    const list = this.world.byTag('enemy');
    let n = 0;
    for (let i = 0; i < list.length; i++) if (list[i].type === type && list[i].alive) n++;
    return n;
  }

  /** Hurt boxes of the live attacks: the lash and the landing under her feet. */
  override contactBoxes(): readonly Rect[] {
    const out = this.hot;
    out.length = 0;
    if (this.dead || this.state !== 'fight') return out;
    if (this.lashHot && this.lashLen > 0) {
      const lane = this.lashLane === 'high' ? MAYOR.whip.high : MAYOR.whip.low;
      const root = this.wx(28);
      const r = this.lashRect;
      r.w = this.lashLen;
      r.x = this.facing < 0 ? root - this.lashLen : root;
      r.y = this.floorY - lane[1];
      r.h = lane[1] - lane[0];
      out.push(r);
    }
    if (this.stompHot > 0) {
      const r = this.stompRect;
      r.x = this.x - 24;
      r.w = 48;
      r.y = this.floorY - 12;
      r.h = 12;
      out.push(r);
    }
    this.hitDamage.dirX = this.facing;
    return out;
  }

  override hurtboxes(): readonly Rect[] {
    const boxes = super.hurtboxes();
    if (this.lift !== 0) for (let i = 0; i < boxes.length; i++) if (boxes[i].w > 0) boxes[i].y -= this.lift;
    return boxes;
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, part = 0): boolean {
    let idx = part;
    const p = this.parts[part];
    if (p && this.armorParts.includes(p) && d.kind === 'explosion' && this.state === 'fight' && this.invulnTicks <= 0) {
      const t = this.blastTarget(d);
      if (t) idx = t.index;
    }
    const hit = super.onHit(d, idx);
    const q = this.parts[idx];
    if (hit && q && !q.armored && !this.armorParts.includes(q) && this.state === 'fight' && this.invulnTicks <= 0 && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/metal', { vol: 0.5 });
    }
    return hit;
  }

  /** The live, unarmoured breakable part a blast against her armour reaches (nearest within 48 px). */
  private blastTarget(d: Damage): BossPart | null {
    const src = d.source as Entity | undefined;
    let best: BossPart | null = null;
    let bestD = 48;
    for (let i = 0; i < 4; i++) {
      const p = this.parts[i];
      if (!p.enabled || p.destroyed || p.armored) continue;
      if (!src) return p;
      const r = this.partRect(p);
      const dx = Math.max(r.x - src.x, 0, src.x - (r.x + r.w));
      const dy = Math.max(r.y - src.y, 0, src.y - (r.y + r.h));
      const dist = Math.hypot(dx, dy);
      if (dist <= bestD) {
        bestD = dist;
        best = p;
      }
    }
    return best;
  }

  protected override onPartBroken(p: BossPart): void {
    this.world.camera.shake(4, 20);
    if (p === this.armPart) {
      this.setArm(0);
      this.shadowT = 0;
      this.say2('stamp', 70);
    } else if (p === this.chainPart) {
      this.lashLen = 0;
      this.lashHot = false;
      this.backArm = 0;
      this.world.audio.sfx('ams/chain', { pitch: 0.7 });
      debris(this.world, this.wx(0), this.wy(-96), 'metal', 8);
    } else if (p === this.headPart) {
      this.headFrame = HEAD_SMILE;
      this.say2('hair', 90);
    }
    if (!this.partAlive('stamp-arm') && !this.partAlive('chain')) {
      this.medPart.armored = false;
      this.medFrame = MED_OPEN;
    }
    this.checkPhases();
  }

  protected override onDamageState(): void {
    // The parts carry their own damage looks (think); the body art follows damageState.
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.hush();
    this.lashLen = 0;
    this.lashHot = false;
    this.stompHot = 0;
    this.shadowT = 0;
    this.glowT = 0;
    this.lift = 0;
    this.backArm = 0;
    this.medFrame = MED_OPEN;
    this.headFrame = HEAD_SHOUT;
  }

  protected override deathSequence(): ScriptGen | null {
    return this.powerDown();
  }

  *powerDown(): ScriptGen {
    const w = this.world;
    this.say2('goodbye', 120, 0.7);
    for (let t = 0; t < MAYOR.death; t++) {
      // Sparks and small blasts.
      if (t < 120 && t % 9 === 0) {
        const c = this.randomPoint();
        explosion(w, c[0], c[1] - this.lift, t % 27 === 0 ? 'm' : 's', { silent: t % 18 !== 0, shake: 2 });
      }
      if (t % 5 === 0) hitSpark(w, this.wx(w.fxRng.range(-20, 20)), this.wy(w.fxRng.range(-120, -50)) + this.sitDrop, w.fxRng.range(-1, 1));
      // Draw only: the hatch pops before the hair flies off.
      if (t === 32) this.headFrame = HEAD_HATCH;
      // The hair flies off like a wig.
      if (t === 40) {
        this.wigOn = false;
        // wigX / wigY: the wig's anchor (the launch point and the turn's centre, wig.py ANCHOR).
        this.wigX = this.wx(WIG_ANCHOR[0]);
        this.wigY = this.wy(WIG_ANCHOR[1]) + this.sitDrop - this.lift;
        this.wigVx = -this.facing * 1.4;
        this.wigVy = -4.2;
        this.headFrame = HEAD_BALD;
        w.audio.sfx('boss/part-break', { vol: 0.7 });
      }
      if (!this.wigOn) {
        this.wigVy += 0.15;
        this.wigX += this.wigVx;
        this.wigY = Math.min(this.floorY - WIG_REST, this.wigY + this.wigVy);
        if (this.wigY >= this.floorY - WIG_REST) this.wigVx *= 0.8;
        // It tumbles in flight and finishes the turn it is in once it lands.
        if (this.wigY < this.floorY - WIG_REST || this.wigSpin % 24 !== 0) this.wigSpin++;
      }
      // The head boings on a spring.
      if (t >= 50 && t < 150) {
        const k = (t - 50) / 100;
        this.springH = Math.max(0, Math.round((22 + Math.sin(k * Math.PI * 6) * 14) * (1 - k * 0.6)));
        if (t === 50) w.audio.sfx('boss/voice-crack');
      } else if (t >= 150) this.springH = Math.max(0, this.springH - 1);
      // She sits down and powers off.
      if (t >= 120 && t < 140) {
        // Eased: the knees give slowly, then she drops onto the floor.
        this.sitDrop = Math.round(easeInQuad((t - 119) / 20) * 24);
        this.legsFrame = LEGS_SIT;
      }
      // A small bounce as she lands on the floor.
      if (t >= 140 && t < 144) this.sitDrop = [22, 23, 24, 24][t - 140];
      if (t === 140) {
        w.camera.shake(4, 12);
        w.audio.sfx('hit/ground');
        dust(w, this.x, this.floorY, 8);
      }
      if (t === 160) {
        this.headFrame = HEAD_OFF;
        this.medFrame = MED_CLOSED;
        w.audio.sfx('machine/sad-notes', { vol: 0.7 });
      }
      yield;
    }
    // The big explosion (finishDeath adds the 'xl' blast).
    this.finishDeath(true);
  }

  // ------------------------------------------------------------------------------- drawing

  /** Draw a body strip at the anchor (`own`: the strip has pre-mirrored frames, see the stamp arm). */
  private piece(r: Renderer, id: string, frame: number, dy = 0, flash = false, own = false): void {
    drawOpts.flipX = !own && this.facing < 0;
    drawOpts.flash = flash;
    drawOpts.tint = undefined;
    drawOpts.alpha = undefined;
    drawOpts.src = undefined;
    r.sprite(id, frame, this.x + this.shakeX, this.y + dy, drawOpts);
    if (this.dim > 0) {
      drawOpts.tint = PAL.ink[0];
      drawOpts.alpha = Math.min(0.85, this.dim);
      r.sprite(id, frame, this.x + this.shakeX, this.y + dy, drawOpts);
      drawOpts.tint = undefined;
      drawOpts.alpha = undefined;
    }
  }

  private glow(r: Renderer, id: string, frame: number, dy: number, color: number, own = false): void {
    drawOpts.flipX = !own && this.facing < 0;
    drawOpts.flash = false;
    drawOpts.tint = color;
    drawOpts.alpha = 0.5;
    r.sprite(id, frame, this.x + this.shakeX, this.y + dy, drawOpts);
    drawOpts.tint = undefined;
    drawOpts.alpha = undefined;
  }

  /**
   * Stamp arm role (ARM_*, facing right) round `armPose` (layout.ts STAMP_SHOW): the raise is a dip,
   * a coil, a 2-step rise, an overshoot and a trembling hold; the last ticks before the slam are
   * the 2-frame smear; the slam is the impact squash, a recoil and a settle; the way back lifts the
   * stamp off the floor. Draw only: the hitbox follows `armPose` (setArm).
   */
  private armShown(): number {
    const S = STAMP_SHOW;
    const now = this.world.tick;
    const t = now - this.armAt;
    if (this.sitDrop > 0) return this.sitDrop >= S.sag ? ARM_SAG : ARM_LOW;
    if (this.armPose === 1) {
      const left = this.armDueAt - now;
      if (left >= 0 && left < S.smear) return left >= S.smear / 2 ? ARM_SMEAR : ARM_SMEAR_LOW;
      if (t < S.antic) return ARM_ANTICIPATION;
      if (t < S.coil) return ARM_COIL;
      if (t < S.riseLow) return ARM_RISE_LOW;
      if (t < S.riseA) return ARM_RISE_A;
      if (t < S.riseMid) return ARM_RISE_MID;
      if (t < S.riseB) return ARM_RISE_B;
      if (t < S.riseHigh) return ARM_RISE_HIGH;
      if (t < S.over) return ARM_OVERSHOOT;
      return Math.floor((t - S.over) / S.tremble) & 1 ? ARM_TREMBLE : ARM_RAISED;
    }
    if (this.armPose === 2) {
      if (t < S.impact) return ARM_IMPACT;
      if (t < S.slam) return ARM_SLAM;
      if (t < S.recoil) return ARM_RECOIL;
      if (t < S.settle) return ARM_SETTLE;
      return ARM_SLAM;
    }
    if (this.armFrom === 2 && t < S.lower) return t < S.lift ? ARM_LIFT : ARM_LOWER;
    if (this.armFrom === 1 && t < 6) return t < 2 ? ARM_RISE_B : t < 4 ? ARM_RISE_MID : ARM_RISE_A;
    return ARM_LOW;
  }

  /** The upper body's drop for a legs frame: the frame's `hip` point against the stand (draw only). */
  private hipDy(f: number): number {
    const fs = getFrames(ID_LEGS);
    const p = fs[f]?.pts?.hip;
    const s = fs[LEGS_STAND]?.pts?.hip;
    return p && s ? p[1] - s[1] : 0;
  }

  /** Legs role (LEGS_*): the stomp hop (layout.ts STOMP_SHOW), the stagger brace, the death sit. */
  private legsShown(): number {
    const now = this.world.tick;
    const t = now - this.legsAt;
    const f = this.legsFrame;
    const S = STOMP_SHOW;
    if (f === LEGS_SIT) return this.sitDrop < STAMP_SHOW.sag ? LEGS_GIVE : LEGS_SIT;
    if (f === LEGS_SQUAT) {
      // Landing (she was in the air just before): the squash, then the squat.
      // (The hop's last tick has lift 0: the landing is up to 2 ticks after the last lift.)
      if (this.legsAt - this.airAt <= 2) return t < S.land ? LEGS_LAND : LEGS_SQUAT;
      return t < S.half ? LEGS_HALF_SQUAT : LEGS_SQUAT;
    }
    if (f === LEGS_STAND) {
      if (this.lift > 0) return t < S.pushOff ? LEGS_PUSH_OFF : t < S.tuck ? LEGS_AIR : LEGS_REACH;
      if (this.legsFrom === LEGS_SQUAT && now - this.airAt <= 1) return LEGS_REACH;
      if (this.legsFrom === LEGS_SQUAT && t < S.half) return LEGS_HALF_SQUAT;
      if (this.staggering) return (now >> 3) & 1 ? LEGS_BRACE : LEGS_REEL;
    }
    return f;
  }

  /** Far-arm role (BACK_*): the wind-up, the flail whirl (faster in the last telegraph ticks), the release, the pull, the catch. */
  private backArmShown(): number {
    const W = WHIP_SHOW;
    const now = this.world.tick;
    const t = now - this.backAt;
    if (this.backArm === 0) return this.backFrom > 0 && t < W.catch && this.partAlive('chain') ? BACK_CATCH : BACK_REST;
    const high = this.backArm === 1;
    if (this.lashLen > 0) {
      if (this.lashHot) return high ? BACK_RELEASE_HIGH : BACK_RELEASE_LOW;
      return high ? BACK_PULL_HIGH : BACK_PULL_LOW;
    }
    if (t < W.wind) return high ? BACK_WIND_HIGH : BACK_WIND_LOW;
    const fast = this.glowT > 0 ? Math.max(0, W.fast - this.glowT) : 0;
    const k = (Math.floor((t - W.wind - fast) / W.step) + fast) % BACK_WHIRL_STEPS;
    if (k === 0) return high ? BACK_HIGH : BACK_LOW;
    return (high ? BACK_WHIRL_HIGH : BACK_WHIRL_LOW) + k - 1;
  }

  /** The low whirl and its wind-up swing at her back hip: drawn behind the body, as the rest arm. */
  private static backBehind(f: number): boolean {
    return f === BACK_REST || f === BACK_LOW || f === BACK_WIND_LOW || (f >= BACK_WHIRL_LOW && f < BACK_WHIRL_LOW + BACK_WHIRL_STEPS - 1);
  }

  /** Head role (HEAD_*, layout.ts HEAD_SHOW). */
  private headShown(idle: boolean): number {
    const H = HEAD_SHOW;
    const now = this.world.tick;
    const t = now - this.headAt;
    const f = this.headFrame;
    // A stagger sputters: the shout and its in-breath.
    if (this.staggering) return (now >> 2) & 1 ? HEAD_SHOUT_IN : HEAD_SHOUT;
    if (f === HEAD_SHOUT && t < H.shoutIn) return HEAD_SHOUT_IN;
    if (f === HEAD_HATCH && t < H.ajar) return HEAD_HATCH_AJAR;
    if (f === HEAD_SMILE && this.headFrom === HEAD_HATCH && t < H.close) return HEAD_HATCH_AJAR;
    if (f === HEAD_BALD) return Math.floor(now / H.bald) & 1 ? HEAD_BALD_B : HEAD_BALD;
    if (f === HEAD_OFF && this.headFrom === HEAD_BALD && t < H.offFlicker) return Math.floor(t / 3) & 1 ? HEAD_BALD : HEAD_OFF;
    if (f === HEAD_SMILE && idle) {
      const k = now % H.blinkEvery;
      if (k < H.blink[0]) return HEAD_BLINK_HALF;
      if (k < H.blink[1]) return HEAD_BLINK;
      if (k < H.blink[2]) return HEAD_BLINK_HALF;
    }
    return f;
  }

  /** Medallion role (MED_*, layout.ts MED_SHOW): the core opens, charges and pulses, flashes at the volley, closes. */
  private medShown(): number {
    const M = MED_SHOW;
    const now = this.world.tick;
    const t = now - this.medAt;
    const f = this.medFrame;
    if (f === MED_OPEN) {
      if (this.medFrom === MED_CLOSED && t < M.part) return t < M.crack ? MED_CRACK : MED_PART;
      if (this.medFrom === MED_GLOW && t < M.cool) return MED_CHARGE;
      return MED_OPEN;
    }
    if (f === MED_GLOW) {
      if (this.glowT > 0) {
        if (t < M.charge) return MED_CHARGE;
        if (this.glowT > M.settle) return Math.floor(t / M.pulse) & 1 ? MED_CHARGE : MED_GLOW;
        return MED_GLOW;
      }
      return now - this.medFireAt < M.flash ? MED_FLASH : MED_GLOW;
    }
    if (f === MED_CLOSED && this.medFrom !== MED_CLOSED && t < M.close) return MED_PART;
    return f;
  }

  override draw(r: Renderer): void {
    if (this.state === 'done') return;
    const w = this.world;
    // Floor shadow tell (pulsing).
    if (this.shadowT > 0) {
      drawOpts.flipX = false;
      drawOpts.flash = false;
      drawOpts.tint = undefined;
      drawOpts.src = undefined;
      drawOpts.alpha = (w.tick >> 2) % 2 === 0 ? 0.75 : 0.5;
      r.sprite(`${ART}/shadow`, this.shadowFrame, this.shadowX, this.floorY, drawOpts);
      drawOpts.alpha = undefined;
    }
    // Idle life while standing: a 1-px hydraulic breath on the upper body every 32 ticks. The upper
    // body follows the legs' hip (a squat squats; the walk bobs); the death sit uses its own drop.
    const idle = this.state === 'fight' && !this.dead && this.legsFrame === LEGS_STAND && this.sitDrop === 0 && this.lift === 0;
    const legsF = this.legsShown();
    const dy = this.sitDrop > 0 ? this.sitDrop - this.lift : this.hipDy(legsF) - this.lift + (idle ? (w.tick >> 5) & 1 : 0);
    const headFrame = this.headShown(idle);
    // A stagger shakes her 1 px (draw only).
    this.shakeX = this.staggering ? ((w.tick >> 1) & 1 ? 1 : -1) : 0;
    const telegraphOn = this.glowT > 0 && this.glowT % 8 < 5;
    const glowCol = this.glowT % 16 < 8 ? PAL.gold[3] : PAL.snow[3];
    // The far arm at rest (and the low whirl at her back hip) sits behind the body.
    const bf = this.backArmShown();
    const behind = AmsMayor.backBehind(bf);
    if (behind) {
      this.piece(r, ID_ARM_BACK, bf, dy);
      if (this.backArm > 0 && telegraphOn) this.glow(r, ID_ARM_BACK, bf, dy, glowCol);
    }
    this.piece(r, ID_LEGS, legsF, this.lift > 0 ? -this.lift : 0);
    const bodyId = `${ART}/body-${this.dead ? 2 : this.damageState}`;
    this.piece(r, bodyId, 0, dy);
    // Head (on its spring during the death boing).
    const head = this.headPart;
    const headId = `${ART}/head-${this.partState(head)}`;
    if (this.springH > 0) this.piece(r, `${ART}/spring`, Math.min(3, Math.floor(this.springH / 8)), dy - 112);
    this.piece(r, headId, headFrame, dy - this.springH, head.flash >= 3);
    // Chain and medallion.
    const chain = this.chainPart;
    if (chain.destroyed) this.piece(r, `${ART}/chain-gone`, 0, dy);
    else this.piece(r, `${ART}/chain-${this.partState(chain)}`, 0, dy, chain.flash >= 3);
    const med = this.medPart;
    const medId = `${ART}/medallion-${this.partState(med)}`;
    const mf = this.medShown();
    this.piece(r, medId, mf, dy, med.flash >= 3 && !med.armored);
    if (this.medFrame === MED_GLOW && telegraphOn) this.glow(r, medId, mf, dy, glowCol);
    // The far arm whirling, throwing or catching the chain (in front of the chest).
    if (!behind) {
      this.piece(r, ID_ARM_BACK, bf, dy);
      if (this.backArm > 0 && telegraphOn) this.glow(r, ID_ARM_BACK, bf, dy, glowCol);
    }
    // Stamp arm.
    const arm = this.armPart;
    if (arm.destroyed) this.piece(r, `${ART}/stamp-arm-gone`, (w.tick >> 3) % STUMP_FRAMES, dy);
    else {
      const id = `${ART}/stamp-arm-${this.partState(arm)}`;
      const fr = this.armShown() + (this.facing < 0 ? ARM_FRAMES : 0);
      this.piece(r, id, fr, dy, arm.flash >= 3, true);
      if (this.armPose === 1 && telegraphOn) this.glow(r, id, fr, dy, glowCol, true);
    }
    // The lash: the frame's last (lashLen + 4) px, so the tip weight leads (out, the snap, back).
    if (this.lashLen > 0) {
      const lane = this.lashLane === 'high' ? MAYOR.whip.high : MAYOR.whip.low;
      let lf: number;
      if (this.lashHot && this.lashLen < MAYOR.whip.reach) lf = LASH_OUT_A + ((w.tick >> 1) & 1);
      else if (this.lashHot) lf = w.tick - this.lashFullAt < WHIP_SHOW.snap ? LASH_SNAP_A : LASH_SNAP_B;
      else lf = LASH_BACK_A + ((w.tick >> 2) & 1);
      const f = getFrames(ID_LASH)[lf];
      const vis = Math.min(f.buf.w, this.lashLen + 4);
      drawOpts.flipX = this.facing < 0;
      drawOpts.flash = false;
      drawOpts.tint = undefined;
      drawOpts.alpha = undefined;
      srcRect.x = f.buf.w - vis;
      srcRect.y = 0;
      srcRect.w = vis;
      srcRect.h = f.buf.h;
      drawOpts.src = srcRect;
      r.sprite(ID_LASH, lf, this.wx(28 + vis - (f.buf.w - f.ox)), Math.round(this.floorY - (lane[0] + lane[1]) / 2), drawOpts);
      drawOpts.src = undefined;
    }
    // The wig in flight (death).
    if (!this.wigOn) {
      drawOpts.flipX = this.facing < 0;
      drawOpts.flash = false;
      // The baked frames keep the boss's floor origin (0, 0): draw them so that their anchor
      // (WIG_ANCHOR, mirrored with her) lands on (wigX, wigY).
      const ax = this.facing < 0 ? -WIG_ANCHOR[0] : WIG_ANCHOR[0];
      r.sprite(ID_WIG, ((this.wigSpin / 3) | 0) % WIG_FRAMES, Math.round(this.wigX - ax), Math.round(this.wigY - WIG_ANCHOR[1]), drawOpts);
    }
  }
}

defineEntity('ams-mayor', (w, x, y, p) => new AmsMayor(w, x, y, p), {
  category: 'boss',
  score: MAYOR.score,
  description: 'MECHA HASLEMA, THE IRON MAYOR (ams boss): x = the Stopera doors, y = the floor; parts stamp-arm, chain, medallion (core), head (bonus).',
});

/** Exposed for tests: the difficulty factor of the waves. */
export function stampWaveSpeed(world: World): number {
  return MAYOR.stamp.waveSpeed * difficultyOf(world).enemyBulletSpeed;
}
