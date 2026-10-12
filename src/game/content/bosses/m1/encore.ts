/**
 * THE ENCORE (Commodore Blare) — the boss of mission m1 (GDD §10.1).
 *
 * A paddle-steamer warship: a brass foghorn at the bow, a 6-pipe steam calliope on the deck and
 * a red paddle wheel at the stern. Spawn it with x = the BOW TIP and y = the waterline (the m1-c
 * arena: `ctx.spawn('encore', 2848, 180)`; a 'ground' y snaps to the water surface under x).
 * The side the bow faces (`facing`, default −1 = left) is the players' stage: every attack
 * crosses it toward that side. It works on a flat test floor too (the waterline = the floor).
 *
 * Parts (required-parts model, GDD §10.0; HP × difficulty × co-op): `horn` 1,100, `calliope`
 * 1,300, `wheel` 1,600 (enabled from phase 2) and the armoured `hull` (no HP: shots ping;
 * blasts against it go to the nearest live part within 48 px, so grenades lobbed at the boat
 * count).
 *
 * - Phase 1 "First Act" (`horn` + `calliope`): A Steam Scale, B Foghorn, A, B …; C All Hands
 *   (2 deck riflemen every 600 ticks, NORMAL and HARD). One part gone: the other's recoveries
 *   × 0.8.
 * - Intermission: THAT WAS ONLY THE FIRST ACT!, the crowd chants ENCORE!, the boat reverses into a
 *   splash cloud and comes back stern first (96 ticks, everyone invulnerable, shots erased).
 * - Phase 2 "Encore" (`wheel` ≥ 50 %): D Paddle Wave, E Barrel Roll, F Smoke Stack.
 * - Phase 3 "Second Encore" (`wheel` < 50 %): a 60-tick intermission, Blare climbs onto the stern
 *   rail with a trombone; G Slide Shot, D, G, F; recoveries × 0.8; the hull sinks 1 px / 60 ticks
 *   (max 16).
 * - Death (300 ticks): 6 explosions along the hull, the wheel breaks off and rolls away, the boat
 *   lists and sinks while the calliope plays a sad run and Blare salutes until only his cap
 *   shows; then he pops up in a rubber ring (`encore-blare-ring`) and paddles off.
 * Every attack is telegraph (≥ 18 ticks, `telegraphFor`) → attack → recovery (`recoveryFor`).
 */
import { Entity, type Damage } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import { frameCount, getFrame } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { difficultyOf, hudOf } from '../../../context';
import { explosion, hitSpark, musicNotes, smokeTrail, splash, steamPuff } from '../../../fx';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { STUMP } from './art-boat';
import { ENC, ENCORE, ENCORE_NAME } from './geometry';
import { Barrel, BrassPellet, floorAt, FoghornWave, PaddleWave, SootBall, SteamNote, waterAt } from './shots';

const ART = 'boss/encore';
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.5 };
const srcRect = { x: 0, y: 0, w: 0, h: 0 };

/** Blare's speech point (over the bridge window), local. */
const BRIDGE_SAY: readonly [number, number] = [ENC.bridge.window[0], ENC.bridge.window[1] - 26];
const RAIL_SAY: readonly [number, number] = [ENC.rail[0], ENC.rail[1] - 44];

export class Encore extends Boss {
  /** The players' side (−1 = left): attacks cross the stage toward it. */
  readonly stageDir: 1 | -1;
  /** Bow tip x in phase 1 (the spawn x). */
  readonly homeX: number;
  /** River surface (the waterline) and the stage floor in front of the bow. */
  waterY: number;
  stageY: number;

  // Look state (read by draw; ticks count down in think).
  hornTilt = 0;
  hornGlow = 0;
  calliopeGlow = 0;
  wheelSpin = 0;
  wheelAngle = 0;
  funnelPuff = 0;
  /** Deckhand: 0 hidden, 1 holding a barrel, 2 heaving. */
  deckhand = 0;
  /** Blare: on the bridge, on the stern rail (phase 3) or gone (death, after the cap). */
  blareAt: 'bridge' | 'rail' | 'gone' = 'bridge';
  blareFrame = 0;
  railPose = 0;
  /** Phase 3 sinking (px, also moves the hitboxes) and the death list / sink. */
  sink = 0;
  private sinkT = 0;
  deathSink = 0;
  listSlope = 0;
  /** The wheel after it broke off (death sequence). */
  looseWheel = false;
  wheelX = 0;
  wheelY = 0;
  private wheelVx = 0;
  /** Recovery multiplier (lone part in phase 1, phase 3). */
  rate = 1;
  private crewTimer = 0;
  private lastPing = 0;
  private readonly hullPart: BossPart;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: ENCORE_NAME, hp: 1, score: ENCORE.score });
    this.stageDir = paramFacing(p, -1);
    this.facing = this.stageDir;
    this.homeX = x;
    // Sit on the river under the bow (a 'ground' y may be a pit floor or Infinity).
    const ws = waterAt(world, x + this.stageDir * 8);
    if (Number.isFinite(ws) && (!Number.isFinite(y) || Math.abs(ws - y) < 120)) this.y = ws;
    else if (!Number.isFinite(y)) this.y = world.camera.bottom - 36;
    this.waterY = this.y;
    const stage = floorAt(world, x + this.stageDir * 16, this.waterY - 48, this.waterY + 24);
    this.stageY = Number.isFinite(stage) ? stage : this.waterY;
    // `hpScale` (spawn param, default 1): a test / sandbox knob for short fights.
    const k = Math.max(0.01, paramNum(p, 'hpScale', 1));
    this.addPart('horn', { box: ENC.horn.box, hp: ENCORE.hp.horn * k, required: true });
    this.addPart('calliope', { box: ENC.calliope.box, hp: ENCORE.hp.calliope * k, required: true });
    this.addPart('wheel', { box: { ...ENC.wheel.box }, hp: ENCORE.hp.wheel * k, required: true, enabled: false });
    this.hullPart = this.addPart('hull', { box: ENC.hull.box });
    this.phaseIntermission = 0;
    this.phases = [
      { at: 1, name: 'first-act', pattern: (b) => b.firstAct() },
      { name: 'encore', when: (b) => b.brokenCount(['horn', 'calliope']) >= 2, pattern: (b) => b.encorePhase() },
      { name: 'second-encore', when: (b) => b.phase >= 1 && b.wheelFrac() < 0.5, pattern: (b) => b.secondEncore() },
    ];
  }

  // ------------------------------------------------------------------------------- geometry

  /** World x of a local x (the art faces right; flipped when facing left). */
  wx(lx: number): number {
    return this.x + (this.facing < 0 ? -lx : lx);
  }

  wy(ly: number): number {
    return this.y + ly;
  }

  wheelFrac(): number {
    const w = this.parts[2];
    return w.maxHp > 0 ? w.hp / w.maxHp : 0;
  }

  /** The nearest live player (for aiming the notes). */
  private target(): Entity | null {
    return this.world.nearestPlayer(this.wx(-60), this.stageY - 20);
  }

  /** Clamp an x to the stage between the view's near edge and the boat's front. */
  private onStage(x: number): number {
    const cam = this.world.camera;
    const front = this.frontX() + this.stageDir * 10;
    const lo = this.stageDir < 0 ? cam.left + 10 : front;
    const hi = this.stageDir < 0 ? front : cam.right - 10;
    return Math.max(lo, Math.min(hi, x));
  }

  /** World x of the boat's end that faces the stage (the bow in phase 1, the stern later). */
  frontX(): number {
    return this.facing === this.stageDir ? this.x : this.wx(-ENC.len);
  }

  private chant(): void {
    hudOf(this.world).callout('ENCORE!', { ticks: 90, color: PAL.gold[3] });
    this.world.audio.sfx('env/applause');
  }

  private sayBlare(text: string, ticks = 120): void {
    this.say(text, { at: this.blareAt === 'rail' ? RAIL_SAY : BRIDGE_SAY, ticks });
  }

  // ------------------------------------------------------------------------------- intro

  /** Steams in from beyond the view (300 ticks): horn toots, the far bank cheers. */
  override *intro(): ScriptGen {
    const start = this.homeX - this.stageDir * 320;
    this.x = start;
    const total = ENCORE.intro;
    for (let t = 0; t < total; t++) {
      const k = Math.min(1, t / (total - 60));
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      this.x = start + (this.homeX - start) * e;
      if (t === 20) this.world.audio.sfx('env/applause');
      if (t === 70 || t === 190) {
        this.world.audio.sfx('boss/foghorn', { vol: 0.8 });
        this.hornGlow = 30;
        musicNotes(this.world, this.wx(ENC.horn.pivot[0] + ENC.horn.mouth[0]), this.wy(ENC.horn.pivot[1]), 3, 10);
      }
      if (t === 200) this.sayBlare('ALL HANDS! THE SHOW MUST GO ON!', 110);
      if (k < 1 && t % 5 === 0) splash(this.world, this.frontX(), this.waterY, 3);
      yield;
    }
    this.x = this.homeX;
    this.chant();
  }

  // ------------------------------------------------------------------------------- phase 1

  *firstAct(): ScriptGen {
    this.crewTimer = 0;
    yield 30;
    for (let i = 0; ; i++) {
      const horn = this.partAlive('horn');
      const calliope = this.partAlive('calliope');
      this.rate = horn && calliope ? 1 : ENCORE.lonePartRate;
      if ((i % 2 === 0 && calliope) || !horn) yield* this.steamScale();
      else yield* this.foghorn();
      yield 16;
    }
  }

  /** A — Steam Scale: the pipes puff low to high (T 40), 6 steam notes land around the player. */
  *steamScale(): ScriptGen {
    const tele = this.telegraphFor(ENCORE.steam.tele);
    this.calliopeGlow = tele;
    this.world.audio.sfx('boss/calliope-scale');
    const pipes = ENC.calliope.pipes;
    for (let k = 0; k < pipes.length; k++) {
      steamPuff(this.world, this.wx(pipes[k][0]), this.wy(pipes[k][1]) - 2, 0, -0.6);
      yield Math.floor(tele / pipes.length);
    }
    yield tele - Math.floor(tele / pipes.length) * pipes.length;
    if (!this.partAlive('calliope')) return;
    const t = this.target();
    const baseX = t ? t.x : this.frontX() + this.stageDir * 120;
    const n = this.volleySize(6);
    const offs = ENCORE.steam.offsets;
    for (let i = 0; i < n; i++) {
      if (!this.partAlive('calliope')) return;
      const now = this.target();
      const tx = this.onStage(i < offs.length ? baseX + offs[i] : now ? now.x : baseX);
      const pipe = pipes[i % pipes.length];
      const land = floorAt(this.world, tx, this.stageY - 40, this.stageY + 24);
      const px = this.wx(pipe[0]);
      // Flight time grows with the distance (a high, readable arc; 30–60 ticks).
      const flight = Math.min(60, 30 + Math.abs(tx - px) / 8);
      SteamNote.lob(this.world, px, this.wy(pipe[1]) - 4, tx, Number.isFinite(land) ? land : this.waterY, flight, this);
      musicNotes(this.world, this.wx(pipe[0]), this.wy(pipe[1]) - 6, 1, 4, 30);
      yield ENCORE.steam.gap;
    }
    yield this.recoveryFor(ENCORE.steam.rec * this.rate);
  }

  /** B — Foghorn: the horn tilts down (low wave: jump) or up (high wave: crouch), glows, toots. */
  *foghorn(): ScriptGen {
    const high = this.world.rng.next() < 0.5;
    const tele = this.telegraphFor(ENCORE.foghorn.tele);
    this.hornTilt = high ? 2 : 1;
    this.hornGlow = tele;
    this.world.audio.sfx('boss/foghorn');
    yield tele;
    if (!this.partAlive('horn')) {
      this.hornTilt = 0;
      return;
    }
    const n = this.volleySize(1);
    const bottom = high ? this.stageY - ENCORE.foghorn.high : this.stageY - ENCORE.foghorn.low;
    for (let i = 0; i < n; i++) {
      FoghornWave.blast(this.world, this.frontX() + this.stageDir * 6, bottom, this.stageDir, ENCORE.foghorn.speed, this);
      musicNotes(this.world, this.wx(ENC.horn.pivot[0] + ENC.horn.mouth[0]), this.wy(ENC.horn.pivot[1]), 2, 8);
      this.world.camera.shake(2, 10);
      if (i < n - 1) yield 24;
    }
    yield 12;
    this.hornTilt = 0;
    yield this.recoveryFor(ENCORE.foghorn.rec * this.rate);
  }

  /** C — All Hands (every 600 ticks in phase 1; [N] row: NORMAL and HARD). */
  private allHands(): void {
    const w = this.world;
    if (w.countAlive('encore-crew') > ENCORE.allHands.maxAlive - 2) return;
    // They leap off the bow rail and land on the stage in front of it (a 'drop' entry with a
    // little hop: the soldiers' 'truck' entry ignores the facing param, see the report).
    const dx = ENCORE.allHands.x;
    for (const off of [0, 22]) {
      const e = w.spawn('rifleman', this.frontX() + this.stageDir * (-dx - off), this.wy(ENC.deckY - 6), { entry: 'drop', facing: this.stageDir, outfit: 'deck', gag: false, tag: 'encore-crew' });
      e.vy = -2.2;
    }
    this.sayBlare('ALL HANDS ON DECK!', 80);
    w.audio.sfx('enemy/whistle');
  }

  // ------------------------------------------------------------------------------- phase 2

  *encorePhase(): ScriptGen {
    this.rate = 1;
    this.hornTilt = 0;
    this.hornGlow = 0;
    this.calliopeGlow = 0;
    this.intermission(ENCORE.turnTicks);
    this.sayBlare('THAT WAS ONLY THE FIRST ACT!', 110);
    this.chant();
    yield* this.turnAround();
    this.setPart('wheel', true);
    yield 20;
    yield* this.sequence([(b) => b.paddleWave(), (b) => b.barrelRoll(), (b) => b.smokeStack()], 20);
  }

  /** The boat backs into a splash cloud, flips behind it and comes back stern first. */
  *turnAround(): ScriptGen {
    const total = ENCORE.turnTicks;
    const away: 1 | -1 = this.stageDir < 0 ? 1 : -1;
    const startX = this.x;
    const flipAt = 40;
    const endX = this.homeX + away * ENC.len;
    const backX = endX + away * 140;
    for (let t = 0; t < total; t++) {
      if (t < flipAt) {
        const k = t / flipAt;
        this.x = startX + away * 90 * k * k;
      } else {
        if (t === flipAt) {
          this.facing = away;
          this.x = backX;
        }
        const k = (t - flipAt) / (total - flipAt - 1);
        const e = 1 - (1 - k) * (1 - k);
        this.x = backX + (endX - backX) * e;
      }
      // The splash cloud hides the turn.
      if (t >= 24 && t < 64 && t % 2 === 0) {
        const cx = this.homeX + away * (40 + this.world.fxRng.range(0, 200));
        splash(this.world, cx, this.waterY, 5);
        steamPuff(this.world, cx, this.waterY - this.world.fxRng.range(10, 70), this.world.fxRng.range(-0.4, 0.4), -0.3);
      }
      if (t === 24) {
        this.world.audio.sfx('env/water-rush');
        this.world.camera.shake(3, 20);
      }
      if (t % 4 === 0) splash(this.world, this.frontX(), this.waterY, 2);
      yield;
    }
    this.x = endX;
  }

  /** D — Paddle Wave: the wheel spins up (T 60), a 24-px wave rolls across the stage. */
  *paddleWave(): ScriptGen {
    const tele = this.telegraphFor(ENCORE.paddle.tele);
    this.wheelSpin = tele;
    this.world.audio.sfx('env/water-rush', { vol: 0.7 });
    yield tele;
    const n = this.volleySize(1);
    for (let i = 0; i < n; i++) {
      PaddleWave.roll(this.world, this.frontX() + this.stageDir * 14, this.stageY, this.stageDir, ENCORE.paddle.speed, this);
      splash(this.world, this.frontX(), this.waterY, 10);
      this.world.audio.sfx('env/water-splash');
      if (i < n - 1) yield 40;
    }
    yield this.recoveryFor(ENCORE.paddle.rec * this.rate);
  }

  /** E — Barrel Roll: a deckhand shows a barrel (T 24), then heaves 3, 20 ticks apart. */
  *barrelRoll(): ScriptGen {
    const tele = this.telegraphFor(ENCORE.barrels.tele);
    this.deckhand = 1;
    this.world.audio.sfx('enemy/alert', { vol: 0.6 });
    yield tele;
    const n = this.volleySize(ENCORE.barrels.n);
    const [dx, dy] = ENC.deckhand;
    for (let i = 0; i < n; i++) {
      this.deckhand = 2;
      Barrel.toss(this.world, this.wx(dx) + this.stageDir * 6, this.wy(dy + ENC.barrelHeld[1]), this.stageDir * 1.6, -2.2, this.stageDir, this);
      this.world.audio.sfx('weapon/grenade-throw', { vol: 0.6 });
      yield 8;
      this.deckhand = i < n - 1 ? 1 : 2;
      yield ENCORE.barrels.gap - 8;
    }
    this.deckhand = 0;
    yield this.recoveryFor(ENCORE.barrels.rec * this.rate);
  }

  /** F — Smoke Stack: the funnels puff black smoke (T 40), 4 soot balls arc out. */
  *smokeStack(): ScriptGen {
    const tele = this.telegraphFor(ENCORE.soot.tele);
    this.funnelPuff = tele;
    this.world.audio.sfx('enemy/tuba-inhale');
    yield tele;
    const n = this.volleySize(ENCORE.soot.n);
    for (let i = 0; i < n; i++) {
      const f = ENC.funnels[i % 2];
      const k = n > 1 ? i / (n - 1) : 0;
      const vx = ENCORE.soot.vx0 + (ENCORE.soot.vx1 - ENCORE.soot.vx0) * k;
      SootBall.launch(this.world, this.wx(f[0]), this.wy(f[1]) - 2, -this.stageDir * vx, ENCORE.soot.vy, this);
      smokeTrail(this.world, this.wx(f[0]), this.wy(f[1]) - 4, true);
      this.world.audio.sfx('weapon/cannon', { vol: 0.5 });
      yield 6;
    }
    yield this.recoveryFor(ENCORE.soot.rec * this.rate);
  }

  // ------------------------------------------------------------------------------- phase 3

  *secondEncore(): ScriptGen {
    this.rate = ENCORE.phase3Rate;
    this.wheelSpin = 0;
    this.deckhand = 0;
    this.funnelPuff = 0;
    this.intermission(ENCORE.encoreTicks);
    this.chant();
    // Blare leaves the bridge and climbs onto the stern rail with a trombone.
    steamPuff(this.world, this.wx(ENC.bridge.window[0]), this.wy(ENC.bridge.window[1]) - 8);
    this.blareAt = 'rail';
    this.railPose = 0;
    steamPuff(this.world, this.wx(ENC.rail[0]), this.wy(ENC.rail[1]) - 20);
    this.sayBlare('A SECOND ENCORE? YOU SPOIL ME!', 110);
    yield ENCORE.encoreTicks;
    yield* this.sequence([(b) => b.slideShot(), (b) => b.paddleWave(), (b) => b.slideShot(), (b) => b.smokeStack()], 16);
  }

  /** G — Slide Shot: the slide pulls back (T 30), 3 brass pellets 30 apart: chest, ankle, chest. */
  *slideShot(): ScriptGen {
    const tele = this.telegraphFor(ENCORE.slide.tele);
    this.railPose = 1;
    this.world.audio.sfx('boss/trombone-pull');
    yield tele;
    const n = this.volleySize(ENCORE.slide.n);
    for (let i = 0; i < n; i++) {
      this.railPose = 2;
      const lane = i % 2 === 0 ? ENCORE.slide.chest : ENCORE.slide.ankle;
      const bx = this.wx(ENC.rail[0]) + this.stageDir * ENC.bell[0];
      const by = this.wy(ENC.rail[1] + ENC.bell[1]) + this.sink;
      const swoop = Math.abs(bx - this.frontX()) + 12;
      BrassPellet.fire(this.world, bx, by, this.stageY - lane - 2, this.stageDir, ENCORE.slide.speed, swoop, this);
      this.world.audio.sfx('enemy/tuba-blast', { vol: 0.5 });
      yield 8;
      this.railPose = i < n - 1 ? 1 : 0;
      yield ENCORE.slide.gap - 8;
    }
    this.railPose = 0;
    yield this.recoveryFor(ENCORE.slide.rec * this.rate);
  }

  // ------------------------------------------------------------------------------- per tick

  protected override think(): void {
    const w = this.world;
    if (this.hornGlow > 0) this.hornGlow--;
    if (this.calliopeGlow > 0) this.calliopeGlow--;
    if (this.wheelSpin > 0) this.wheelSpin--;
    if (this.funnelPuff > 0) this.funnelPuff--;
    // Wheel: idles slowly, spins fast while winding up.
    if (this.phase >= 1 && this.partAlive('wheel')) this.wheelAngle += this.wheelSpin > 0 ? 1 : 0.125;
    // Blare's idle bob on the bridge.
    this.blareFrame = (w.tick >> 5) & 1;
    if (this.state !== 'fight') return;
    // C All Hands (phase 1, NORMAL / HARD).
    if (this.phase === 0 && difficultyOf(w).normalRows && this.invulnTicks <= 0) {
      if (++this.crewTimer >= ENCORE.allHands.every) {
        this.crewTimer = 0;
        this.allHands();
      }
    }
    // Phase 3: the hull sinks 1 px every 60 ticks (max 16).
    if (this.phase === 2 && this.sink < ENCORE.sinkMax && ++this.sinkT % ENCORE.sinkEvery === 0) {
      this.sink++;
      // Cosmetic (GDD): the art sinks; the wheel's hurtbox keeps its bottom at the waterline and
      // its top follows the art, so it stays in reach from the stage.
      const wb = this.parts[2].box;
      wb.y = ENC.wheel.box.y + this.sink;
      wb.h = ENC.wheel.box.h - this.sink;
      splash(w, this.wx(-120), this.waterY, 3);
    }
    // Smoke from the funnels: a light puff now and then, black during the Smoke Stack telegraph.
    const rate = this.funnelPuff > 0 ? 3 : 24;
    if (w.tick % rate === 0) {
      const f = ENC.funnels[(w.tick / rate) & 1];
      smokeTrail(w, this.wx(f[0]) + w.fxRng.range(-4, 4), this.wy(f[1]) - 4, this.funnelPuff > 0 || this.damageState > 0);
    }
    // Paddle spray while the wheel winds up.
    if (this.wheelSpin > 0 && w.tick % 4 === 0) splash(w, this.wx(ENC.wheel.c[0] - 20), this.waterY, 3);
    // Part damage looks: smoke at ≤ 50 %, sparks and flames at ≤ 25 %, a smoking stump when gone.
    if (w.tick % 8 === 0) {
      for (let i = 0; i < 3; i++) {
        const p = this.parts[i];
        if (!p.enabled && !p.destroyed) continue;
        const st = this.partState(p);
        if (st === 0) continue;
        const r = this.partRect(p);
        const local = p.destroyed ? p.box : null;
        const cx = local ? this.wx(local.x + local.w / 2) : r.x + w.fxRng.range(0, r.w);
        const cy = local ? this.wy(local.y + local.h * 0.6) : r.y + w.fxRng.range(0, r.h);
        if (st === 1 && w.tick % 16 !== 0) continue;
        smokeTrail(w, cx, cy, true);
        if (st === 2 && !p.destroyed) hitSpark(w, cx, cy, -this.stageDir);
      }
    }
  }

  // ------------------------------------------------------------------------------- damage

  override onHit(d: Damage, part = 0): boolean {
    let idx = part;
    const p = this.parts[part];
    if (p === this.hullPart && d.kind === 'explosion' && this.state === 'fight' && this.invulnTicks <= 0) {
      const t = this.blastTarget(d);
      if (t) idx = t.index;
    }
    const hit = super.onHit(d, idx);
    const q = this.parts[idx];
    if (hit && q !== this.hullPart && this.state === 'fight' && this.invulnTicks <= 0 && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      this.world.audio.sfx('hit/metal', { vol: 0.5 });
    }
    return hit;
  }

  /** The live part a blast against the hull reaches: the nearest within 48 px of the blast. */
  private blastTarget(d: Damage): BossPart | null {
    const src = d.source as Entity | undefined;
    let best: BossPart | null = null;
    let bestD = 48;
    for (let i = 0; i < 3; i++) {
      const p = this.parts[i];
      if (!p.enabled || p.destroyed) continue;
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
    if (p.name === 'horn') {
      this.hornGlow = 0;
      this.hornTilt = 0;
      this.sayBlare('MY BEAUTIFUL HORN!', 90);
    } else if (p.name === 'calliope') {
      this.calliopeGlow = 0;
      this.world.audio.sfx('machine/sad-notes', { vol: 0.6 });
      this.sayBlare('WHO TUNED THAT?!', 90);
    }
    this.checkPhases();
  }

  protected override onDamageState(): void {
    // The parts carry their own damage looks (think); the hull art follows damageState.
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.hush();
    this.hornGlow = this.calliopeGlow = this.wheelSpin = this.funnelPuff = 0;
    this.deckhand = 0;
    this.railPose = 0;
  }

  protected override deathSequence(): ScriptGen | null {
    return this.sinkShow();
  }

  *sinkShow(): ScriptGen {
    const w = this.world;
    const total = ENCORE.death;
    if (this.blareAt === 'rail') {
      steamPuff(w, this.wx(ENC.rail[0]), this.wy(ENC.rail[1]) - 20);
      this.blareAt = 'bridge';
    }
    for (let t = 0; t < total; t++) {
      // 6 explosions along the hull, 15 ticks apart (stage end → far end).
      if (t % 15 === 0 && t < 90) {
        const i = t / 15;
        const lx = this.facing === this.stageDir ? -20 - i * 36 : -210 + i * 36;
        explosion(w, this.wx(lx), this.wy(-30 - w.fxRng.range(0, 30)) + this.deathSink, i % 2 === 0 ? 'l' : 'm', { silent: i % 2 === 1, shake: 4, debris: 'wood' });
      }
      // The wheel breaks off and rolls away downriver (away from the stage).
      if (t === 20) {
        this.looseWheel = true;
        this.wheelX = this.wx(ENC.wheel.c[0]);
        this.wheelY = this.wy(ENC.wheel.c[1]);
        this.wheelVx = 0;
        explosion(w, this.wheelX, this.wheelY, 'm', { debris: 'metal' });
      }
      if (this.looseWheel) {
        this.wheelVx = Math.max(-2.2, Math.min(2.2, this.wheelVx - this.stageDir * 0.05));
        this.wheelX += this.wheelVx;
        this.wheelY = this.waterY - ENC.wheel.r + 8 + Math.sin(t / 6) * 2;
        this.wheelAngle += 0.5;
        if (t % 6 === 0) splash(w, this.wheelX, this.waterY, 3);
      }
      // List and sink; the calliope's sad run; Blare salutes until only his cap shows.
      if (t >= 30) {
        const k = Math.min(1, (t - 30) / 120);
        this.listSlope = 0.12 * k * -this.stageDir * this.facing;
        this.deathSink = Math.round(96 * k * k + (t > 150 ? (t - 150) * 0.15 : 0));
      }
      if (t === 40) w.audio.sfx('machine/sad-notes');
      if (t >= 40 && t < 120 && t % 10 === 0) musicNotes(w, this.wx(ENC.calliope.anchor[0]), this.wy(-70) + this.deathSink, 1, 10, 50);
      if (t >= 50 && t % 6 === 0) splash(w, this.wx(-110 + w.fxRng.range(-100, 100)), this.waterY, 3);
      this.blareFrame = t < 150 ? 3 : 4;
      if (t === 180) this.blareAt = 'gone';
      if (t === 270) {
        // He surfaces just off the stage end of the wreck (in view) and paddles away from the stage.
        const ring = w.spawn('encore-blare-ring', this.frontX() - this.stageDir * 60, this.waterY, { facing: -this.stageDir });
        splash(w, ring.x, this.waterY, 10);
      }
      yield;
    }
  }

  // ------------------------------------------------------------------------------- drawing

  /** Draw a strip frame at a local point (mirrored when facing left), clipped at the waterline. */
  private piece(r: Renderer, id: string, frame: number, lx: number, ly: number, flipExtra = false, flash = false): void {
    const n = frameCount(id);
    if (n === 0) return;
    const i = ((frame % n) + n) % n;
    const f = getFrame(id, i);
    const flip = this.facing < 0;
    const x = Math.round(this.wx(lx));
    const y = Math.round(this.wy(ly) + this.sink + this.deathSink + this.listSlope * lx);
    const rows = Math.min(f.buf.h, Math.round(this.waterY + 5 - (y - f.oy)));
    if (rows <= 0) return;
    drawOpts.flipX = flip !== flipExtra;
    drawOpts.flash = flash;
    drawOpts.src = rows < f.buf.h ? ((srcRect.x = 0), (srcRect.y = 0), (srcRect.w = f.buf.w), (srcRect.h = rows), srcRect) : undefined;
    r.sprite(id, i, x, y, drawOpts);
    drawOpts.src = undefined;
  }

  /** The hull: one draw, or 8-px slices while it lists (death). */
  private drawHull(r: Renderer): void {
    const id = `${ART}/hull-${this.dead ? 2 : this.damageState}`;
    if (this.listSlope === 0) {
      this.piece(r, id, 0, 0, 0);
      return;
    }
    const f = getFrame(id, 0);
    const flip = this.facing < 0;
    drawOpts.flipX = flip;
    drawOpts.flash = false;
    for (let sx = 0; sx < f.buf.w; sx += 8) {
      const lx = sx - f.ox + 4;
      const y = Math.round(this.y + this.sink + this.deathSink + this.listSlope * lx);
      const rows = Math.min(f.buf.h, Math.round(this.waterY + 5 - (y - f.oy)));
      if (rows <= 0) continue;
      srcRect.x = sx;
      srcRect.y = 0;
      srcRect.w = Math.min(8, f.buf.w - sx);
      srcRect.h = rows;
      drawOpts.src = srcRect;
      r.sprite(id, 0, Math.round(this.x), y, drawOpts);
    }
    drawOpts.src = undefined;
  }

  override draw(r: Renderer): void {
    if (this.state === 'done') return;
    const w = this.world;
    const faceStage = this.stageDir < 0 ? this.facing > 0 : this.facing < 0;
    // Bridge interior and Blare (the hull draws over him; he shows through the window).
    this.piece(r, `${ART}/bridge-back`, 0, 0, 0);
    if (this.blareAt === 'bridge') {
      const [bx, by] = ENC.bridge.window;
      const shout = this.state === 'fight' && this.invulnTicks > 0;
      this.piece(r, `${ART}/blare-bridge`, shout ? 2 : this.blareFrame, bx, by + 15, faceStage);
    }
    this.drawHull(r);
    // Parts.
    const horn = this.parts[0];
    const cal = this.parts[1];
    const wheel = this.parts[2];
    const [hpx, hpy] = ENC.horn.pivot;
    if (horn.destroyed) this.piece(r, `${ART}/horn-2`, STUMP.horn, hpx, hpy);
    else {
      const id = `${ART}/horn-${this.partState(horn)}`;
      this.piece(r, id, this.hornTilt, hpx, hpy, false, horn.flash >= 3);
      if (this.hornGlow > 0 && this.hornGlow % 8 < 5) this.glow(r, id, this.hornTilt, hpx, hpy, this.hornGlow % 16 < 8 ? PAL.gold[3] : PAL.snow[3]);
    }
    const [cax, cay] = ENC.calliope.anchor;
    if (cal.destroyed) this.piece(r, `${ART}/calliope-2`, STUMP.calliope, cax, cay);
    else {
      const id = `${ART}/calliope-${this.partState(cal)}`;
      const playing = this.calliopeGlow > 0 && (w.tick >> 2) % 2 === 0 ? 1 : 0;
      this.piece(r, id, playing, cax, cay, false, cal.flash >= 3);
      if (this.calliopeGlow > 0 && this.calliopeGlow % 8 < 5) this.glow(r, id, playing, cax, cay, PAL.snow[3]);
    }
    const [wcx, wcy] = ENC.wheel.c;
    if (this.looseWheel) {
      drawOpts.flipX = false;
      drawOpts.flash = false;
      r.sprite(`${ART}/wheel-2`, Math.floor(this.wheelAngle) & 3, Math.round(this.wheelX), Math.round(this.wheelY), drawOpts);
    } else if (wheel.destroyed) this.piece(r, `${ART}/wheel-2`, STUMP.wheel, wcx, wcy);
    else if (this.wheelSpin > 0) this.piece(r, `${ART}/wheel-blur`, w.tick >> 1, wcx, wcy);
    else this.piece(r, `${ART}/wheel-${this.partState(wheel)}`, Math.floor(this.wheelAngle) & 3, wcx, wcy, false, wheel.flash >= 3 && wheel.enabled);
    // Crew.
    if (this.deckhand > 0) this.piece(r, `${ART}/deckhand`, this.deckhand - 1, ENC.deckhand[0], ENC.deckhand[1], faceStage);
    if (this.blareAt === 'rail') this.piece(r, `${ART}/blare-rail`, this.railPose, ENC.rail[0], ENC.rail[1], faceStage);
  }

  /** A telegraph glow: the part's silhouette tinted on top. */
  private glow(r: Renderer, id: string, frame: number, lx: number, ly: number, color: number): void {
    tintOpts.flipX = this.facing < 0;
    tintOpts.tint = color;
    r.sprite(id, frame, Math.round(this.wx(lx)), Math.round(this.wy(ly) + this.sink), tintOpts);
  }
}

defineEntity('encore', (w, x, y, p) => new Encore(w, x, y, p), {
  category: 'boss',
  score: ENCORE.score,
  description: 'THE ENCORE (m1 boss): Commodore Blare\'s paddle-steamer. x = bow tip, y = waterline; parts horn, calliope, wheel.',
});

/**
 * Commodore Blare in a rubber ring after the sinking: pops up, shouts his last line and paddles
 * off downriver (cosmetic; removed after 420 ticks or once out of the view).
 */
export class BlareRing extends Entity {
  private t = 0;
  private readonly waterY: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.facing = paramFacing(p, 1);
    this.waterY = y;
    this.z = 32;
    this.hitbox = { x: -10, y: -30, w: 20, h: 30 };
    this.despawnMargin = 64;
  }

  override update(): void {
    const t = ++this.t;
    if (t === 2) this.world.audio.sfx('env/water-splash');
    if (t === 12) hudOf(this.world).bubble(this, "THIS ISN'T OVER! ...IS IT? IT IS? DRAT!", { kind: 'gag', ticks: 220 });
    if (t > 40) {
      this.x += this.facing * 0.6;
      if (t % 20 === 0) splash(this.world, this.x - this.facing * 12, this.waterY, 2);
    }
    this.y = this.waterY + Math.round(Math.sin(t / 10));
    if (t > 420 || (t > 60 && !this.world.camera.containsPoint(this.x, this.y, 24))) this.remove();
  }

  override draw(r: Renderer): void {
    const frame = this.t < 40 ? 2 : (this.t >> 4) & 1;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    const f = getFrame(`${ART}/blare-ring`, frame);
    const rows = Math.min(f.buf.h, Math.round(this.waterY + 3 - (this.y - f.oy)));
    srcRect.x = 0;
    srcRect.y = 0;
    srcRect.w = f.buf.w;
    srcRect.h = Math.max(0, rows);
    drawOpts.src = srcRect;
    r.sprite(`${ART}/blare-ring`, frame, Math.round(this.x), Math.round(this.y), drawOpts);
    drawOpts.src = undefined;
  }

  override onRemove(): void {
    hudOf(this.world).clearBubble(this);
  }
}

defineEntity('encore-blare-ring', (w, x, y, p) => new BlareRing(w, x, y, p), {
  category: 'fx',
  description: 'THE ENCORE: Commodore Blare paddling off in a rubber ring after the sinking (x, y = the waterline).',
});
