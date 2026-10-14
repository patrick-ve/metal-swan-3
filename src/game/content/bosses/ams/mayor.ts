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
 *   4–6 `noise-letter`s flutter down: shoot them or step aside). Adds: a `handhaver` from an
 *   arena side every 420 ticks, at most 3 alive (tag cap).
 * - Phase 2 (the arm or the chain broken): C CHAIN WHIP (she whirls the chain high — crouch — or
 *   low — jump —, alternating, T 28, `ams/chain` pitched by lane; the lash reaches 124 px), B continues. If the
 *   chain broke first, A replaces C. Adds: a flock of 3 `seagull`s every 600 ticks.
 * - Phase 3 (both broken): the medallion opens. D SHIELD FAN (glow T 24; 5 `shield-shot`s in a
 *   fixed fan, 6°–72° below the horizon with safe lanes; HARD 6), E STOMP (a shadow under her landing spot, T 24;
 *   she hops 48 px forward, lands — only the landing under her feet hurts —, then back). Adds: a
 *   `delivery-rider` pass from alternating sides.
 * - Death (230 ticks): sparks and small blasts, the hair flies off like a wig, the head
 *   boings on a spring, she sits down and powers off, a big explosion.
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
import { ADD_TAG, MAYOR, MAYOR_NAME } from './geometry';
import { floorAt, NoiseLetter, ShieldShot, StampWave } from './shots';

const ART = 'boss/ams-mayor';
const OFFICER_TAG = 'ams-mayor-officer';
const RIDER_TAG = 'ams-mayor-rider';
const drawOpts: DrawOpts = {};
const srcRect: SrcRect = { x: 0, y: 0, w: 0, h: 0 };
const DEG = Math.PI / 180;
/** Ticks from the start of `ams/stamp` to its baked-in slam (0.5 s, content/sfx/ams.ts). */
const STAMP_SFX_SLAM = 30;
/** The `sfxLoop` key of her robot chatter (`ams/mayor-babble`). */
const BABBLE_KEY = 'mayor-babble';

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
  private nextLane: Lane = 'high';
  private addT = 0;
  private addSide: 1 | -1 = -1;
  private lastPing = 0;
  /** A second bubble that follows a long taunt after `wait` ticks (cosmetic, no script yield). */
  private followUp: { text: string; ticks: number; wait: number } | null = null;
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
      { at: 1, name: 'stamp', pattern: (b) => b.phaseOne() },
      { name: 'chain', when: (b) => b.brokenCount(['stamp-arm', 'chain']) >= 1, pattern: (b) => b.phaseTwo(), onEnter: (b) => b.enterTwo() },
      { name: 'core', when: (b) => b.brokenCount(['stamp-arm', 'chain']) >= 2, pattern: (b) => b.phaseThree(), onEnter: (b) => b.enterThree() },
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
    this.armPose = pose;
    const src = pose === 0 ? MAYOR.box.armLow : pose === 1 ? MAYOR.box.armHigh : MAYOR.box.armSlam;
    const b = this.armPart.box;
    b.x = src.x;
    b.y = src.y;
    b.w = src.w;
    b.h = src.h;
  }

  private say2(text: string, ticks = 110, pitch = 1): void {
    // Text only: the mayor never gets a voice (docs/ORIGINALITY.md, mission ams). Wordless robot
    // chatter plays for as long as the line takes to read (a placeholder, not speech).
    this.say(text, { at: MAYOR.sayAt, ticks, voice: false });
    this.world.audio.sfxLoop?.(BABBLE_KEY, 'ams/mayor-babble', { pitch });
    this.babbleT = Math.min(ticks, Math.max(24, text.length * 3));
  }

  /** A taunt in two bubbles: the second one follows the first without delaying the script. */
  private sayTwo(first: string, second: string, ticks = 90): void {
    this.say2(first, ticks);
    this.followUp = { text: second, ticks, wait: ticks };
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
        this.legsFrame = 1 + (((t - I.dim) >> 3) & 1);
        if ((t - I.dim) % 16 === 15) {
          this.world.audio.sfx('hit/ground', { vol: 0.6 });
          this.world.camera.shake(2, 6);
          dust(this.world, this.x, this.floorY, 3);
        }
      } else this.legsFrame = 0;
      if (t === I.dim + I.walk + 4) {
        this.headFrame = 2;
        this.say2('DE BUREN HEBBEN\nGEKLAAGD.', 70);
      }
      if (t === I.dim + I.walk + 20) this.headFrame = 0;
      if (t === I.dim + I.walk + 76) {
        this.headFrame = 2;
        this.setArm(1);
        this.say2('FABEL FRIET IS VANAF\nNU GESLOTEN!', 56);
      }
      if (t === I.total - 12) {
        this.headFrame = 0;
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

  *phaseOne(): ScriptGen {
    // 40: the intro's GESLOTEN bubble has cleared before the first raised-stamp tell.
    yield 40;
    let taunted = false;
    for (;;) {
      if (this.partAlive('stamp-arm')) yield* this.stampSlam();
      if (!taunted) {
        taunted = true;
        this.say2('FABEL FRIET WILLEN\nWE NIET!', 90);
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
    this.world.audio.sfx('ams/stamp', { pitch: STAMP_SFX_SLAM / tele });
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
    this.headFrame = 1;
    this.world.audio.sfx('ams/ticket');
    yield tele;
    if (!this.partAlive('head')) {
      this.headFrame = 0;
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
    this.headFrame = 0;
    yield this.recoveryFor(L.rec);
  }

  // ------------------------------------------------------------------------------- phase 2

  enterTwo(): void {
    this.lashLen = 0;
    this.lashHot = false;
    this.backArm = 0;
    this.addT = 0;
  }

  *phaseTwo(): ScriptGen {
    this.headFrame = 2;
    // The bubble hangs where the chain loop whirls: it clears before the first whip tell.
    this.say2('REGELS ZIJN REGELS!', 48);
    yield 52;
    this.headFrame = 0;
    let taunted = false;
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
        this.sayTwo('IK WORD HELEMAAL GEK\nVAN DIE HOTDOGKRAAM...', '...OP MIJN\nMUSEUMPLEIN!');
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
    this.medFrame = 1;
    this.addT = 0;
  }

  *phaseThree(): ScriptGen {
    this.headFrame = 2;
    this.say2('DIT KOST JE EEN\nFLINKE BOETE!', 110);
    yield 30;
    this.headFrame = 0;
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
    this.medFrame = 2;
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
    yield 16;
    this.medFrame = 1;
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
    this.legsFrame = 3;
    this.world.audio.sfx('machine/brake', { vol: 0.5 });
    yield tele;
    this.legsFrame = 0;
    for (let t = 1; t <= S.air; t++) {
      const k = t / S.air;
      this.x = from + (to - from) * k;
      this.lift = Math.round(Math.sin(k * Math.PI) * S.lift);
      yield;
    }
    this.lift = 0;
    this.x = to;
    this.legsFrame = 3;
    this.stompHot = S.land;
    this.world.camera.shake(5, 16);
    this.world.audio.sfx('hit/ground', { pitch: 0.6 });
    this.world.audio.sfx('hit/metal', { vol: 0.5, pitch: 0.6 });
    dust(this.world, this.x - 16, this.floorY, 5);
    dust(this.world, this.x + 16, this.floorY, 5);
    yield 10;
    this.legsFrame = 0;
    yield this.recoveryFor(S.rec);
  }

  // ------------------------------------------------------------------------------- per tick

  override update(): void {
    super.update();
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
      if (this.state === 'fight') this.say2(f.text, f.ticks);
    }
    if (this.recheck && this.state === 'fight' && this.phase >= 0) {
      this.recheck = false;
      this.checkPhases();
    }
    if (this.state === 'fight' && this.invulnTicks <= 0) this.adds();
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

  /** Adds by phase, capped by tags (GDD §10.0 adds). */
  private adds(): void {
    const w = this.world;
    const A = MAYOR.adds;
    const cam = w.camera;
    this.addT++;
    this.addSide = this.addSide < 0 ? 1 : -1;
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
    }
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
      this.say2('MIJN STEMPEL!', 70);
    } else if (p === this.chainPart) {
      this.lashLen = 0;
      this.lashHot = false;
      this.backArm = 0;
      this.world.audio.sfx('ams/chain', { pitch: 0.7 });
      debris(this.world, this.wx(0), this.wy(-96), 'metal', 8);
    } else if (p === this.headPart) {
      this.headFrame = 0;
      this.say2('MIJN HAAR, MIJN\nPRACHTIGE HAAR!', 90);
    }
    if (!this.partAlive('stamp-arm') && !this.partAlive('chain')) {
      this.medPart.armored = false;
      this.medFrame = 1;
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
    this.medFrame = 1;
    this.headFrame = 2;
  }

  protected override deathSequence(): ScriptGen | null {
    return this.powerDown();
  }

  *powerDown(): ScriptGen {
    const w = this.world;
    this.say2('TOT ZIENS...', 120, 0.7);
    for (let t = 0; t < MAYOR.death; t++) {
      // Sparks and small blasts.
      if (t < 120 && t % 9 === 0) {
        const c = this.randomPoint();
        explosion(w, c[0], c[1] - this.lift, t % 27 === 0 ? 'm' : 's', { silent: t % 18 !== 0, shake: 2 });
      }
      if (t % 5 === 0) hitSpark(w, this.wx(w.fxRng.range(-20, 20)), this.wy(w.fxRng.range(-120, -50)) + this.sitDrop, w.fxRng.range(-1, 1));
      // The hair flies off like a wig.
      if (t === 40) {
        this.wigOn = false;
        this.wigX = this.wx(-6);
        this.wigY = this.wy(-128);
        this.wigVx = -this.facing * 1.4;
        this.wigVy = -4.2;
        this.headFrame = 5;
        w.audio.sfx('boss/part-break', { vol: 0.7 });
      }
      if (!this.wigOn) {
        this.wigVy += 0.15;
        this.wigX += this.wigVx;
        this.wigY = Math.min(this.floorY - 34, this.wigY + this.wigVy);
        if (this.wigY >= this.floorY - 34) this.wigVx *= 0.8;
      }
      // The head boings on a spring.
      if (t >= 50 && t < 150) {
        const k = (t - 50) / 100;
        this.springH = Math.max(0, Math.round((22 + Math.sin(k * Math.PI * 6) * 14) * (1 - k * 0.6)));
        if (t === 50) w.audio.sfx('boss/voice-crack');
      } else if (t >= 150) this.springH = Math.max(0, this.springH - 1);
      // She sits down and powers off.
      if (t >= 120 && t < 140) {
        this.sitDrop = Math.round(((t - 120) / 20) * 24);
        this.legsFrame = 4;
      }
      if (t === 140) {
        w.camera.shake(4, 12);
        w.audio.sfx('hit/ground');
        dust(w, this.x, this.floorY, 8);
      }
      if (t === 160) {
        this.headFrame = 4;
        this.medFrame = 0;
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
    r.sprite(id, frame, this.x, this.y + dy, drawOpts);
    if (this.dim > 0) {
      drawOpts.tint = PAL.ink[0];
      drawOpts.alpha = Math.min(0.85, this.dim);
      r.sprite(id, frame, this.x, this.y + dy, drawOpts);
      drawOpts.tint = undefined;
      drawOpts.alpha = undefined;
    }
  }

  private glow(r: Renderer, id: string, frame: number, dy: number, color: number, own = false): void {
    drawOpts.flipX = !own && this.facing < 0;
    drawOpts.flash = false;
    drawOpts.tint = color;
    drawOpts.alpha = 0.5;
    r.sprite(id, frame, this.x, this.y + dy, drawOpts);
    drawOpts.tint = undefined;
    drawOpts.alpha = undefined;
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
    // Idle life while standing: a 1-px hydraulic breath on the upper body every 32 ticks.
    const idle = this.state === 'fight' && !this.dead && this.legsFrame === 0 && this.sitDrop === 0 && this.lift === 0;
    const dy = this.sitDrop - this.lift + (idle ? (w.tick >> 5) & 1 : 0);
    // Blink (the powered-off eyes) for 6 ticks every 150 ticks while the face rests.
    const headFrame = idle && this.headFrame === 0 && w.tick % 150 < 6 ? 3 : this.headFrame;
    const telegraphOn = this.glowT > 0 && this.glowT % 8 < 5;
    const glowCol = this.glowT % 16 < 8 ? PAL.gold[3] : PAL.snow[3];
    // Far arm at rest sits behind the body.
    if (this.backArm === 0) this.piece(r, `${ART}/arm-back`, 0, dy);
    this.piece(r, `${ART}/legs`, this.legsFrame, this.lift > 0 ? -this.lift : 0);
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
    this.piece(r, medId, this.medFrame, dy, med.flash >= 3 && !med.armored);
    if (this.medFrame === 2 && telegraphOn) this.glow(r, medId, 2, dy, glowCol);
    // Far arm holding the chain loop (in front of the chest).
    if (this.backArm > 0) {
      this.piece(r, `${ART}/arm-back`, this.backArm, dy);
      if (telegraphOn) this.glow(r, `${ART}/arm-back`, this.backArm, dy, glowCol);
    }
    // Stamp arm.
    const arm = this.armPart;
    if (arm.destroyed) this.piece(r, `${ART}/stamp-arm-gone`, 0, dy);
    else {
      const id = `${ART}/stamp-arm-${this.partState(arm)}`;
      const fr = this.armPose + (this.facing < 0 ? 3 : 0);
      this.piece(r, id, fr, dy, arm.flash >= 3, true);
      if (this.armPose === 1 && telegraphOn) this.glow(r, id, fr, dy, glowCol, true);
    }
    // The lash.
    if (this.lashLen > 0) {
      const lane = this.lashLane === 'high' ? MAYOR.whip.high : MAYOR.whip.low;
      drawOpts.flipX = this.facing < 0;
      drawOpts.flash = false;
      drawOpts.tint = undefined;
      drawOpts.alpha = undefined;
      srcRect.x = 0;
      srcRect.y = 0;
      srcRect.w = Math.min(165, this.lashLen + 4);
      srcRect.h = 11;
      drawOpts.src = srcRect;
      r.sprite(`${ART}/lash`, w.tick >> 1, this.wx(28), Math.round(this.floorY - (lane[0] + lane[1]) / 2), drawOpts);
      drawOpts.src = undefined;
    }
    // The wig in flight (death).
    if (!this.wigOn) {
      drawOpts.flipX = this.facing < 0;
      drawOpts.flash = false;
      r.sprite(`${ART}/wig`, 0, this.wigX, this.wigY, drawOpts);
    }
  }
}

defineEntity('ams-mayor', (w, x, y, p) => new AmsMayor(w, x, y, p), {
  category: 'boss',
  score: MAYOR.score,
  description: 'ROBO-HALSEMA, THE IRON MAYOR (ams boss): x = the Stopera doors, y = the floor; parts stamp-arm, chain, medallion (core), head (bonus).',
});

/** Exposed for tests: the difficulty factor of the waves. */
export function stampWaveSpeed(world: World): number {
  return MAYOR.stamp.waveSpeed * difficultyOf(world).enemyBulletSpeed;
}
