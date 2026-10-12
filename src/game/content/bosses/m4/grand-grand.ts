/**
 * THE GRAND GRAND (GDD §10.4) — the boss of m4-d: a black grand piano on four piston legs that walks,
 * bites with its lid and fires felt hammers, with Countess Pizzicata singing on the bench on top.
 * Entity id `grand-grand`. The fight is staged as an opera premiere: the curtain rises, the stalls
 * gasp and clap.
 *
 * Spawn (m4-d, `LOCK 1400–1784`): `ctx.spawn('grand-grand', 1690, 'ground', { arenaLeft: 1400 })`
 * (home = view x 290). It spawns behind the closed curtain and starts on its own once the camera
 * is locked (or it is on screen): the curtain rises (≈ 110 ticks), then the fight. Params:
 * `arenaLeft` (the locked view's left x; default the camera's left), `curtain` (false = no curtain
 * or stalls), `hpScale` (tests). It hangs three `chandelier`s at view x 60, 180, 300 (y 6) unless
 * the arena already has some.
 *
 * Parts (GDD §15.4): `lid` 1,500 (required) · `keyboard` 1,200 (optional; ends Glissando) ·
 * `front-legs` 1,000 (optional, knifeable; ends Pedal Stomp) · `strings` 2,500 (the required core,
 * hittable once the lid is gone) · and `case`, the armoured body (shots ping; it stops shots fired up
 * from under the piano). Touching the legs hurts; during the Castor Charge the whole body does.
 *
 * Phase 1 "Overture" (until the lid breaks): A Chomp, B Glissando, C High C, stomping 32 px toward
 * the player between attacks (anchor view x 262–300). Intermission: the curtain drops, stage hands
 * drag the lid away, the Countess's hairdo comes back twice as tall. Phase 2 "Intermezzo": D Harp
 * Strings, B Glissando, E Pedal Stomp. Phase 3 "Finale" (strings < half): the legs fold; F Castor
 * Charge, G Grand Aria, D Harp Strings, cooldowns × 0.8.
 * Death (300 ticks): the keys pop off one by one down a scale, a crashing chord, the Countess bows,
 * a rose lands, `BRAVA! ...WAIT. YOU'RE THE ENEMY.`, she faints; the curtain falls. Score 60,000.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { hudOf } from '../../../context';
import { debris, dust, explosion, hitSpark, musicNotes, smokeTrail, tumble } from '../../../fx';
import { defineEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { BACK_LEGS, COUNTESS, KEY_GLISS0, KEY_GLISS_N, KEY_RATTLE, LEGS, LID_FRAMES, LID_STEP } from './art-piano';
import { Chandelier } from './chandelier';
import { PIANO as G, type Box } from './geom';
import { BOSS_TAGS, CrystalShard, PedalWave, feltHammer, hitPlayersInRect, spawnHarpBeam } from './shots';
import { Audience, StageCurtain } from './stage';

const ART = 'boss/grand-grand';
export const GRAND_NAME = 'THE GRAND GRAND';
export const GRAND_SUBTITLE = 'COUNTESS PIZZICATA REQUESTS YOUR SILENCE';
const DEG = Math.PI / 180;

const P_LID = 0;
const P_KEYS = 1;
const P_LEGS = 2;
const P_STRINGS = 3;
const P_CASE = 4;

type Mode = 'hold' | 'charge' | 'dead';

const opts: DrawOpts = {};
const flashOpts: DrawOpts = { tint: 0xffffffff, alpha: 0.6 };

/** Mirror a right-facing local box into `out` (part boxes are given unflipped). */
function setBox(out: Rect, b: Box, dy = 0): void {
  out.x = b.x;
  out.y = b.y + dy;
  out.w = b.w;
  out.h = b.h;
}

/** A point over the part to shoot (followed while the piano moves). */
class HintPoint {
  readonly hitbox = { y: 0 };
  private readonly boss: GrandGrand;
  constructor(boss: GrandGrand) {
    this.boss = boss;
  }
  get x(): number {
    return this.boss.wx(10);
  }
  get y(): number {
    const top = this.boss.partAlive('lid') ? G.lidBox.y : G.stringsBox.y;
    return this.boss.y + top + this.boss.dy;
  }
  get removed(): boolean {
    return this.boss.removed;
  }
  get dead(): boolean {
    return this.boss.dead;
  }
}

/** Integrator fix (fairness, GDD §4.11): lead-in of the finale's first Castor Charge. */
export const FIRST_CHARGE_LEAD = 60;

export class GrandGrand extends Boss {
  arenaLeft = 0;
  mode: Mode = 'hold';
  /** 0 standing … 1 folded on the castors (phase 3). */
  fold = 0;
  foldTarget = 0;
  /** Lid opening (degrees) and its ×1.5 window after a Chomp. */
  lidDeg = 0;
  lidVuln = 0;
  /** The lid is still on the piano (it is dragged away in the intermission). */
  lidOn = true;
  keysFrame = 0;
  frontLegs: number = LEGS.stand;
  backLegs: number = BACK_LEGS.stand;
  pose: number = COUNTESS.sitA;
  /** Ticks the current Countess pose holds before the idle sway returns. */
  poseT = 0;
  tall = false;
  /** Lean offset of the whole piano (Castor Charge telegraph). */
  leanX = 0;
  leanY = 0;
  /**
   * Extra telegraph ticks for the next Castor Charge. The finale sets it: its first charge comes
   * right after the fold, and the only safe spots (the balconies) are two jumps away via the crate
   * step (~150 ticks from the far left of the stage), so 40 ticks alone could not be escaped.
   */
  chargeLead = 0;
  chandeliers: Chandelier[] = [];
  curtain: StageCurtain | null = null;
  audience: Audience | null = null;
  /** Death props. */
  private wrecked = false;
  private keysLeft = 16;
  private roseY = Number.NaN;
  private roseX = 0;
  private countessX = 0;
  private countessY = 0;
  private biteActive = false;
  private readonly biteRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly biteHit: Entity[] = [];
  private readonly contactList: Rect[] = [];
  private readonly contactRects: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private lastPing = 0;
  /** Case pings this phase, and the phase the 'SHOOT!' hint was last shown in. */
  private pings = 0;
  private hinted = -1;
  /** The hint point: the top middle of the lid (phase 1) or of the strings (phase 2). */
  private readonly hint = new HintPoint(this);
  private stepT = 0;
  private readonly tmp: [number, number] = [0, 0];

  private partHp(base: number): number {
    return Math.max(1, Math.round(base * paramNum(this.params, 'hpScale', 1)));
  }

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, name: GRAND_NAME, hp: 4000, score: 60000 });
    this.facing = paramNum(p, 'facing', -1) > 0 ? 1 : -1;
    this.addPart('lid', { box: { ...G.lidBox }, hp: this.partHp(1500), required: true });
    this.addPart('keyboard', { box: { ...G.keyboardBox }, hp: this.partHp(1200) });
    this.addPart('front-legs', { box: { ...G.frontLegsBox }, hp: this.partHp(1000), knifeable: true });
    this.addPart('strings', { box: { ...G.stringsBox }, hp: this.partHp(2500), required: true, enabled: false });
    this.addPart('case', { box: { ...G.caseBox }, armored: true });
    this.contactDamage = { amount: 10, kind: 'impact', dirX: -1, tags: BOSS_TAGS };
    this.removeOnDeath = false;
    this.phaseIntermission = 60;
    this.deathTicks = 300;
    this.phases = [
      {
        at: 1,
        name: 'overture',
        pattern: (b) => b.sequence([(c) => c.chomp(), (c) => c.stomp(), (c) => c.glissando(), (c) => c.stomp(), (c) => c.highC(), (c) => c.stomp()], 16),
      },
      {
        when: (b) => !b.partAlive('lid'),
        name: 'intermezzo',
        onEnter: (b) => b.costumeChange(),
        pattern: (b) => b.sequence([(c) => c.harpStrings(), (c) => c.stomp(), (c) => c.glissando(), (c) => c.stomp(), (c) => c.pedalStomp(), (c) => c.stomp()], 16),
      },
      {
        when: (b) => b.stringsBelowHalf(),
        name: 'finale',
        onEnter: (b) => b.finale(),
        pattern: (b) => b.sequence([(c) => c.castorCharge(), (c) => c.grandAria(), (c) => c.harpStrings()], Math.round(16 * 0.8)),
      },
    ];
  }

  stringsBelowHalf(): boolean {
    const s = this.parts[P_STRINGS];
    return !this.partAlive('lid') && s.hp < s.maxHp / 2;
  }

  /** +1 / −1: the side the keyboard points to in world space. */
  get fx(): 1 | -1 {
    return this.facing < 0 ? -1 : 1;
  }

  viewX(v: number): number {
    return this.arenaLeft + v;
  }

  /** World x of a local x (mirrored by the facing). */
  wx(lx: number): number {
    return this.x + lx * this.fx;
  }

  get dy(): number {
    return Math.round(this.fold * G.foldDy);
  }

  /** Recovery for the current phase (phase 3: cooldowns × 0.8). */
  private rec(base: number): number {
    return this.recoveryFor(this.phase >= 2 ? Math.round(base * 0.8) : base);
  }

  // ------------------------------------------------------------------------------- intro

  private trackArena(): void {
    if (this.params.arenaLeft !== undefined) return;
    const cam = this.world.camera;
    if (cam.locked || this.state === 'intro' || this.state === 'waiting') this.arenaLeft = Math.round(cam.left);
  }

  /** Stage dressing: the curtain and the stalls (at once: the curtain hides the piano). */
  private dressStage(): void {
    const w = this.world;
    if (this.curtain === null && paramBool(this.params, 'curtain', true)) {
      this.curtain = w.add(new StageCurtain(w, this.arenaLeft, 384, this.y - 10));
      this.audience = w.add(new Audience(w, this.arenaLeft, 384, w.camera.top + 216));
    }
  }

  /** The chandeliers: the arena's own, else three at the GDD spots (once the view has settled). */
  private hangChandeliers(): void {
    if (this.chandeliers.length > 0) return;
    const w = this.world;
    const x0 = this.arenaLeft - 8;
    const x1 = this.arenaLeft + 392;
    for (const e of w.entities) if (e instanceof Chandelier && !e.removed && e.x >= x0 && e.x <= x1) this.chandeliers.push(e);
    if (this.chandeliers.length === 0) {
      for (const vx of G.chandeliers) this.chandeliers.push(w.spawn('chandelier', this.viewX(vx), G.chandelierY) as Chandelier);
    }
  }

  /** The stage props follow the arena while the camera settles onto the lock. */
  private syncStage(): void {
    if (this.curtain) this.curtain.x0 = this.arenaLeft;
    if (this.audience) {
      this.audience.x0 = this.arenaLeft;
      this.audience.bottom = this.world.camera.top + 216;
    }
  }

  override update(): void {
    if (this.state === 'waiting' && this.curtain === null) {
      this.arenaLeft = paramNum(this.params, 'arenaLeft', Math.round(this.world.camera.left));
      this.dressStage();
    }
    super.update();
    if (this.state === 'dying' || this.state === 'done') this.animate();
  }

  override *intro(): ScriptGen {
    this.arenaLeft = paramNum(this.params, 'arenaLeft', Math.round(this.world.camera.left));
    this.dressStage();
    // Wait for the stage: the camera locked on the arena (or the piano in view), then settled.
    for (let i = 0; i < 900 && !this.world.camera.locked && !this.onScreen(-40); i++) {
      this.trackArena();
      this.syncStage();
      yield;
    }
    let prev = Number.NaN;
    for (let i = 0; i < 180; i++) {
      this.trackArena();
      this.syncStage();
      if (this.world.camera.left === prev) break;
      prev = this.world.camera.left;
      yield;
    }
    this.hangChandeliers();
    yield 20;
    this.say('AHEM.', { at: this.speakAt(), ticks: 50 });
    this.pose = COUNTESS.inhale;
    this.poseT = 50;
    yield 30;
    this.curtain?.moveTo(0, 50);
    this.audience?.react('clap', 100);
    this.world.audio.sfx('env/applause');
    yield 50;
    this.pose = COUNTESS.sing;
    this.poseT = 40;
    this.say('LA-LA-LAAA!', { at: this.speakAt(), ticks: 60 });
    this.world.audio.sfx('enemy/aria', { pitch: 1.2 });
    musicNotes(this.world, this.wx(G.seat[0] + 6), this.y + G.seat[1] - 26, 3);
    yield 40;
  }

  /** Speech point: above the Countess's head (the bubble follows the piano). */
  private speakAt(): [number, number] {
    const seat = this.lidOn ? G.seat : G.seatNoLid;
    this.tmp[0] = seat[0];
    this.tmp[1] = seat[1] + this.dy - (this.tall ? 58 : 44);
    return this.tmp;
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    this.trackArena();
    this.animate();
  }

  /** Per-tick animation state shared by the fight and the death. */
  private animate(): void {
    if (this.fold !== this.foldTarget) this.fold = Math.max(0, Math.min(1, this.fold + (this.foldTarget > this.fold ? 0.05 : -0.05)));
    if (this.lidVuln > 0) this.lidVuln--;
    if (this.poseT > 0) this.poseT--;
    else if (this.state !== 'dying' && this.state !== 'done') this.pose = ((this.world.tick / 40) | 0) % 2 ? COUNTESS.sitB : COUNTESS.sitA;
    this.syncParts();
    if (this.biteActive) {
      this.biteRect.w = G.bite.w;
      this.biteRect.h = G.bite.h;
      this.biteRect.x = this.fx > 0 ? this.x + G.bite.x : this.x - G.bite.x - G.bite.w;
      this.biteRect.y = this.y + G.bite.y + this.dy;
      hitPlayersInRect(this.world, this.biteRect, this.biteDmg, this.biteHit);
    }
  }

  private readonly biteDmg: Damage = { amount: 10, kind: 'impact', dirX: -1, tags: BOSS_TAGS };

  /** Part boxes follow the fold and the lid. */
  private syncParts(): void {
    const dy = this.dy;
    setBox(this.parts[P_KEYS].box, G.keyboardBox, dy);
    setBox(this.parts[P_STRINGS].box, G.stringsBox, dy);
    setBox(this.parts[P_CASE].box, G.caseBox, dy);
    setBox(this.parts[P_LEGS].box, this.fold > 0.5 ? G.frontLegsFolded : G.frontLegsBox, 0);
    const lid = this.parts[P_LID];
    lid.multiplier = this.lidVuln > 0 ? 1.5 : 1;
    if (this.lidDeg <= 0.5) setBox(lid.box, G.lidBox, dy);
    else {
      // The open lid: the bounding box of its front two thirds (slab + lip).
      const a = this.lidDeg * DEG;
      const [hx, hy] = G.hinge;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const u0 = G.lidLen * 0.33;
      const u1 = G.lidLen;
      // Corners: the slab's back-top and front-top, the lip's bottom at the tip.
      const x0 = Math.min(hx + u0 * c - 10 * s, hx + u0 * c);
      const x1 = Math.max(hx + u1 * c, hx + u1 * c + 12 * s);
      const y0 = Math.min(hy - u1 * s - 10 * c, hy - u0 * s - 10 * c);
      const y1 = Math.max(hy - u0 * s, hy - u1 * s + 12 * c);
      lid.box.x = x0;
      lid.box.y = y0 + dy;
      lid.box.w = x1 - x0;
      lid.box.h = y1 - y0;
    }
  }

  override contactBoxes(): readonly Rect[] {
    const out = this.contactList;
    out.length = 0;
    if (this.state !== 'fight' || this.invulnTicks > 0) return out;
    const dy = this.dy;
    if (this.mode === 'charge') {
      // The whole piano rolls: body, keyboard and castors.
      const r = this.contactRects[0];
      const x0 = G.body.x - 2;
      const x1 = G.keyboardBox.x + G.keyboardBox.w;
      r.x = this.fx > 0 ? this.x + x0 : this.x - x1;
      r.y = this.y + G.body.y + dy + 4;
      r.w = x1 - x0;
      r.h = -(G.body.y + dy + 4);
      out.push(r);
      return out;
    }
    if (this.fold > 0.5) return out;
    // The piston legs (the front pair only while it stands).
    const w = G.legContact.w;
    const h = G.legContact.h;
    const pairs = this.partAlive('front-legs') ? 2 : 1;
    for (let i = 0; i < pairs; i++) {
      const lx = i === 0 ? G.legBack - 6 : G.legFront - 6;
      const r = this.contactRects[i];
      r.x = this.fx > 0 ? this.x + lx - w / 2 : this.x - lx - w / 2;
      r.y = this.y - h;
      r.w = w;
      r.h = h;
      out.push(r);
    }
    return out;
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && this.world.tick - this.lastPing >= 6) {
      this.lastPing = this.world.tick;
      // A wrong note for every hit on the wood; the armour pings itself.
      if (part !== P_CASE) this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: part === P_STRINGS ? 1.8 : 1.2 });
    }
    // Shots that only ping the case: once per phase, point at what to shoot (GDD: "using height").
    if (hit && part === P_CASE && this.state === 'fight' && this.phase <= 1 && this.invulnTicks <= 0 && ++this.pings >= 30 && this.hinted !== this.phase) {
      this.hinted = this.phase;
      this.pings = 0;
      hudOf(this.world).pointer(this.hint, 'SHOOT!', { ticks: 180, dy: 2 });
      this.say('THE GOOD SEATS ARE UPSTAIRS, DARLING!', { at: this.speakAt(), ticks: 120 });
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    this.audience?.react('gasp', 50);
    if (p.index === P_KEYS) {
      for (let i = 0; i < 5; i++) this.popKey(i);
      this.keysFrame = 0;
      this.say('MY IVORIES!', { at: this.speakAt(), ticks: 70 });
    } else if (p.index === P_LEGS) {
      debris(this.world, this.wx(G.legFront), this.y - 20, 'metal', 8);
      this.frontLegs = LEGS.stand;
      this.say('HOW VULGAR!', { at: this.speakAt(), ticks: 70 });
    } else if (p.index === P_LID) {
      this.lidDeg = 0;
      this.lidVuln = 0;
      this.biteActive = false;
    } else if (p.index === P_STRINGS) {
      this.world.audio.sfx('boss/harp-charge', { pitch: 0.5, vol: 0.6 });
    }
  }

  /** A key flies off the keyboard (death sequence, broken keyboard). */
  private popKey(i: number): void {
    const rng = this.world.fxRng;
    const kx = this.wx(G.mouth[0] - 6);
    const ky = this.y + G.mouth[1] + 10 + this.dy;
    tumble(this.world, `${ART}/key`, kx, ky, rng.range(-1.5, 1.5) + this.fx * rng.range(0.5, 1.5), -rng.range(2.5, 4) - (i % 3) * 0.3, { life: 70 });
  }

  // ------------------------------------------------------------------------------- moves

  /** Between attacks: stomp up to 32 px toward the nearest player at 0.5 px/tick, on the beat. */
  *stomp(): ScriptGen {
    if (this.fold > 0.5) {
      yield 1;
      return;
    }
    const t = this.world.nearestPlayer(this.x, this.y - 40);
    const lo = this.viewX(G.minView);
    const hi = this.viewX(G.maxView);
    let goal = this.x;
    if (this.x < lo) goal = Math.min(lo, this.x + 32);
    else if (this.x > hi) goal = Math.max(hi, this.x - 32);
    else if (t) goal = Math.max(lo, Math.min(hi, this.x + Math.sign(t.x - this.x) * 32));
    while (Math.abs(goal - this.x) > 0.25) {
      this.x += Math.sign(goal - this.x) * 0.5;
      this.stepT++;
      const beat = this.stepT % 32;
      this.frontLegs = beat < 16 && this.partAlive('front-legs') ? LEGS.step : LEGS.stand;
      this.backLegs = beat >= 16 ? BACK_LEGS.step : BACK_LEGS.stand;
      if (beat === 0 || beat === 16) {
        this.world.audio.sfx('hit/ground', { vol: 0.7, pitch: 0.7 });
        dust(this.world, this.wx(beat === 0 ? G.legFront : G.legBack), this.y, 2);
      }
      yield;
    }
    this.frontLegs = LEGS.stand;
    this.backLegs = BACK_LEGS.stand;
  }

  // A Chomp
  *chomp(): ScriptGen {
    if (!this.partAlive('lid')) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(40);
    this.world.audio.sfx('boss/piano-rattle');
    for (let i = 0; i < tele; i++) {
      this.lidDeg = Math.min(G.lidOpenMax, this.lidDeg + 2.5);
      this.keysFrame = (i >> 2) % 2 ? KEY_RATTLE[1] : KEY_RATTLE[0];
      yield;
    }
    this.keysFrame = 0;
    // The lunge: 64 px forward (never past view x 8 with the keyboard).
    const minX = this.viewX(8) + (G.keyboardBox.x + G.keyboardBox.w);
    const maxX = this.viewX(384 - 8) - (G.keyboardBox.x + G.keyboardBox.w);
    const to = this.fx < 0 ? Math.max(minX, this.x - 64) : Math.min(maxX, this.x + 64);
    const from = this.x;
    for (let i = 1; i <= 12; i++) {
      this.x = from + ((to - from) * i) / 12;
      this.frontLegs = LEGS.step;
      if (i >= 9) this.lidDeg = Math.max(0, this.lidDeg - G.lidOpenMax / 3);
      if (i === 10) {
        this.biteActive = true;
        this.biteHit.length = 0;
      }
      yield;
    }
    this.lidDeg = 0;
    this.frontLegs = LEGS.stand;
    this.world.audio.sfx('machine/piano-crash', { vol: 0.6, pitch: 1.4 });
    this.world.camera.shake(2, 6);
    yield 4;
    this.biteActive = false;
    // Recovery: the lid springs open again for 20 ticks and takes × 1.5 damage.
    const rec = this.rec(50);
    this.lidVuln = Math.min(20, rec);
    for (let i = 0; i < rec; i++) {
      if (!this.partAlive('lid')) return;
      this.lidDeg = i < 20 ? Math.min(16, this.lidDeg + 4) : Math.max(0, this.lidDeg - 2);
      yield;
    }
    this.lidDeg = 0;
  }

  // B Glissando
  *glissando(): ScriptGen {
    if (!this.partAlive('keyboard')) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(36);
    this.world.audio.sfx('boss/piano-gliss');
    for (let i = 0; i < tele; i++) {
      if (!this.partAlive('keyboard')) return;
      this.keysFrame = KEY_GLISS0 + Math.min(KEY_GLISS_N - 1, Math.floor((i * KEY_GLISS_N) / tele));
      yield;
    }
    const n = this.volleySize(12);
    for (let i = 0; i < n; i++) {
      if (!this.partAlive('keyboard')) break;
      const deg = 10 + (60 * i) / Math.max(1, n - 1);
      const a = deg * DEG;
      const mx = this.wx(G.mouth[0]);
      const my = this.y + G.mouth[1] + this.dy;
      feltHammer(this.world, mx, my, Math.atan2(-Math.sin(a), Math.cos(a) * this.fx), 2.5, this);
      if (i % 2 === 0) this.world.audio.sfx('enemy/aria', { vol: 0.35, pitch: 1 + i * 0.06 });
      this.keysFrame = KEY_GLISS0 + (i % KEY_GLISS_N);
      yield 2;
    }
    this.keysFrame = 0;
    yield this.rec(50);
  }

  // C High C
  *highC(): ScriptGen {
    const ch = this.pickChandelier();
    if (!ch) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(40);
    this.pose = COUNTESS.inhale;
    this.poseT = tele;
    ch.drop(tele);
    yield tele;
    this.pose = COUNTESS.highC;
    this.poseT = 40;
    this.say('HIGH C!', { at: this.speakAt(), ticks: 40 });
    this.world.audio.sfx('enemy/aria', { pitch: 2 });
    musicNotes(this.world, this.wx(G.seat[0] + 8), this.y + G.seat[1] - 30 + this.dy, 3);
    yield this.rec(40);
  }

  /** The hanging chandelier closest (in x) to the nearest player. */
  pickChandelier(): Chandelier | null {
    const t = this.world.nearestPlayer(this.x, this.y - 40);
    const px = t ? t.x : this.viewX(120);
    let best: Chandelier | null = null;
    for (const c of this.chandeliers) {
      if (c.removed || !c.available) continue;
      if (!best || Math.abs(c.x - px) < Math.abs(best.x - px)) best = c;
    }
    return best;
  }

  // D Harp Strings
  *harpStrings(): ScriptGen {
    if (!this.partAlive('strings')) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(45);
    this.world.audio.sfx('boss/harp-charge');
    // A fan across the stage in front of the piano: 5 floor points ≥ 28 px apart (gaps ≥ 24 px).
    const ox = this.wx(40);
    const oy = this.y + G.stringsBox.y + this.dy + 4;
    const front = this.wx(G.keyboardBox.x + G.keyboardBox.w);
    const a = this.fx < 0 ? this.viewX(10) : front + 12;
    const b = this.fx < 0 ? front - 12 : this.viewX(374);
    const n = 5;
    const span = Math.max(4 * 28, b - a);
    const step = span / (n - 1);
    const jit = Math.max(0, Math.min(8, (step - 28) / 2));
    const rng = this.world.rng;
    for (let i = 0; i < n; i++) {
      const x = a + i * step + (i > 0 && i < n - 1 ? rng.range(-jit, jit) : 0);
      const f = this.world.terrain.surfaceY(x, this.y - 40, this.y + 40, { platforms: false });
      spawnHarpBeam(this.world, ox, oy, x, Number.isFinite(f) ? f : this.y, tele, 30);
    }
    for (let i = 0; i < tele; i++) {
      if (i % 6 === 0) hitSpark(this.world, ox, oy, this.fx);
      yield;
    }
    yield 30;
    yield this.rec(40);
  }

  // E Pedal Stomp
  *pedalStomp(): ScriptGen {
    if (!this.partAlive('front-legs') || this.fold > 0.5) {
      yield 1;
      return;
    }
    const tele = this.telegraphFor(30);
    this.frontLegs = LEGS.lift;
    this.world.audio.sfx('boss/beater-pull');
    yield tele;
    if (!this.partAlive('front-legs')) return;
    this.frontLegs = LEGS.stand;
    this.world.camera.shake(3, 10);
    this.world.audio.sfx('swan/stomp', { pitch: 0.6 });
    this.world.audio.sfx('enemy/drum-hit', { pitch: 0.6 });
    const lx = this.wx(G.legFront - 6);
    dust(this.world, lx - 8, this.y, 3);
    dust(this.world, lx + 8, this.y, 3);
    PedalWave.launch(this.world, lx - 14, this.y, -1, 2.5, 300, this);
    PedalWave.launch(this.world, lx + 14, this.y, 1, 2.5, 300, this);
    yield this.rec(30);
  }

  // F Castor Charge
  *castorCharge(): ScriptGen {
    const lead = this.chargeLead;
    const tele = this.telegraphFor(40) + lead;
    this.chargeLead = 0;
    this.world.audio.sfx('swan/skid', { pitch: 0.6 });
    for (let i = 0; i < tele; i++) {
      this.leanX = -this.fx * Math.min(4, i / 4);
      this.leanY = -Math.min(2, i / 8);
      this.frontLegs = (i >> 2) % 2 ? LEGS.foldA : LEGS.foldB;
      this.backLegs = (i >> 2) % 2 ? BACK_LEGS.foldA : BACK_LEGS.foldB;
      if (i % 5 === 0) {
        hitSpark(this.world, this.wx(G.legBack), this.y - 2, -this.fx);
        hitSpark(this.world, this.wx(G.legFront), this.y - 2, -this.fx);
      }
      if (i % 10 === 0) this.world.audio.sfx('swan/skid', { pitch: 0.7, vol: 0.6 });
      // The finale's first charge: a hint that the stage floor is no place to be.
      if (lead > 0 && i === 20) this.say('CLEAR THE STAGE!', { at: this.speakAt(), ticks: 60 });
      yield;
    }
    this.leanX = 0;
    this.leanY = 0;
    this.mode = 'charge';
    const frontOff = G.keyboardBox.x + G.keyboardBox.w;
    const far = this.fx < 0 ? this.viewX(G.chargeFront) + frontOff : this.viewX(384 - G.chargeFront) - frontOff;
    const home = this.viewX(G.homeView);
    for (const goal of [far, home]) {
      while (Math.abs(goal - this.x) > 0.1) {
        const s = Math.sign(goal - this.x) * Math.min(2.5, Math.abs(goal - this.x));
        this.x += s;
        this.stepT++;
        this.frontLegs = (this.stepT >> 2) % 2 ? LEGS.foldA : LEGS.foldB;
        this.backLegs = (this.stepT >> 2) % 2 ? BACK_LEGS.foldA : BACK_LEGS.foldB;
        if (this.stepT % 8 === 0) dust(this.world, this.wx(G.legBack), this.y, 1);
        if (this.stepT % 20 === 0) this.world.audio.sfx('machine/tank-move', { vol: 0.4, pitch: 1.6 });
        // It rolls straight through fallen chandeliers.
        for (const c of this.chandeliers) {
          if (c.state === 'down' && Math.abs(c.x - this.x) < 100) c.shatter();
        }
        yield;
      }
      this.world.camera.shake(2, 6);
    }
    this.mode = 'hold';
    yield this.rec(40);
  }

  // G Grand Aria
  *grandAria(): ScriptGen {
    const tele = this.telegraphFor(60);
    this.pose = COUNTESS.inhale;
    this.poseT = tele;
    this.say('A-A-A-A...', { at: this.speakAt(), ticks: tele });
    const hanging = this.chandeliers.filter((c) => !c.removed && c.available);
    if (hanging.length > 0) for (const c of hanging) c.drop(tele);
    else {
      // No chandelier left: crystal shards fall onto shadows that show during the telegraph.
      const n = this.volleySize(6);
      const t = this.world.nearestPlayer(this.x, this.y - 40);
      const rng = this.world.rng;
      for (let i = 0; i < n; i++) {
        let x = this.viewX(24 + ((384 - 48) * (i + 0.5)) / n + rng.range(-10, 10));
        if (i === 0 && t) x = t.x;
        const f = this.world.terrain.surfaceY(x, 0);
        CrystalShard.drop(this.world, x, Number.isFinite(f) ? f : this.y, tele, this);
      }
    }
    yield tele;
    this.pose = COUNTESS.highC;
    this.poseT = 60;
    this.say('...AAAAAH!', { at: this.speakAt(), ticks: 50 });
    this.world.audio.sfx('enemy/aria', { pitch: 1.8 });
    this.world.audio.sfx('enemy/aria', { pitch: 2.4, vol: 0.6 });
    musicNotes(this.world, this.wx(G.seat[0] + 8), this.y + G.seat[1] - 30 + this.dy, 5);
    yield this.rec(60);
  }

  // ------------------------------------------------------------------------------- phase gags

  /** Intermission 1 → 2: the curtain drops, the lid is dragged away, the hairdo doubles. */
  costumeChange(): void {
    this.resetPose();
    this.say('COSTUME CHANGE!', { at: this.speakAt(), ticks: 50 });
    this.audience?.react('gasp', 40);
    const self = this;
    this.world.scripts.run(
      (function* curtainCall(): ScriptGen {
        self.curtain?.moveTo(1, 14);
        yield 16;
        // Stage hands drag the broken lid off to the right under the hem.
        const cur = self.curtain;
        self.lidOn = false;
        if (cur) {
          cur.dragSprite = `${ART}/lid-2`;
          cur.dragFlip = self.fx < 0;
          cur.dragFrame = 0;
          cur.dragX = self.x - 40;
        }
        for (let i = 0; i < 28; i++) {
          if (cur) cur.dragX += 4;
          if (i % 7 === 0) self.world.audio.sfx('swan/skid', { vol: 0.3, pitch: 1.3 });
          yield;
        }
        if (cur) cur.dragX = Number.NaN;
        self.tall = true;
        self.setPart('strings', true);
        self.curtain?.moveTo(0, 14);
        self.audience?.react('clap', 60);
        self.world.audio.sfx('env/applause', { vol: 0.7 });
        yield 14;
        self.say('FROM THE TOP!', { at: self.speakAt(), ticks: 60 });
      })(),
      { owner: this, name: 'grand-grand.costume' },
    );
  }

  /** Intermission 2 → 3: the legs fold, the piano drops onto its castors. */
  finale(): void {
    this.resetPose();
    this.foldTarget = 1;
    this.chargeLead = FIRST_CHARGE_LEAD;
    this.frontLegs = LEGS.foldA;
    this.backLegs = BACK_LEGS.foldA;
    this.audience?.react('gasp', 40);
    this.world.audio.sfx('machine/brake', { pitch: 0.7 });
    this.say('THE FINALE, DARLINGS!', { at: this.speakAt(), ticks: 80 });
    const self = this;
    this.world.scripts.run(
      (function* settle(): ScriptGen {
        yield 22;
        self.world.camera.shake(3, 10);
        dust(self.world, self.wx(G.legBack), self.y, 4);
        dust(self.world, self.wx(G.legFront), self.y, 4);
        self.world.audio.sfx('hit/ground', { pitch: 0.5 });
      })(),
      { owner: this, name: 'grand-grand.fold' },
    );
  }

  private resetPose(): void {
    this.lidDeg = 0;
    this.lidVuln = 0;
    this.keysFrame = 0;
    this.biteActive = false;
    this.leanX = 0;
    this.leanY = 0;
    this.mode = 'hold';
    if (this.fold < 0.5) {
      this.frontLegs = LEGS.stand;
      this.backLegs = BACK_LEGS.stand;
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeathStart(): void {
    this.resetPose();
    this.mode = 'dead';
    this.hush();
  }

  protected override deathSequence(): ScriptGen | null {
    const self = this;
    const w = this.world;
    return (function* finaleCurtain(): ScriptGen {
      self.audience?.react('gasp', 60);
      explosion(w, self.x, self.y - 70 + self.dy, 'm', { debris: 'metal' });
      self.pose = COUNTESS.inhale;
      self.poseT = 200;
      // The piano collapses key by key: one note of a descending scale per key.
      const scale = [0, -2, -4, -5, -7, -9, -11, -12, -14, -16, -17, -19, -21, -23, -24, -26];
      for (let i = 0; i < self.keysLeft; i++) {
        self.popKey(i);
        w.audio.sfx('enemy/aria', { vol: 0.6, pitch: 1.6 * Math.pow(2, scale[i] / 12) });
        if (i === 6) {
          self.foldTarget = 1;
          self.frontLegs = LEGS.foldA;
          self.backLegs = BACK_LEGS.foldA;
        }
        if (i % 4 === 0) smokeTrail(w, self.x + w.fxRng.range(-60, 60), self.y - 40, true);
        yield 9;
      }
      // The final crashing chord.
      self.wrecked = true;
      w.audio.sfx('machine/piano-crash');
      w.audio.sfx('boss/organ-chord', { pitch: 0.6, vol: 0.8 });
      explosion(w, self.x, self.y - 30, 'l', { debris: 'wood' });
      debris(w, self.x, self.y - 20, 'wood', 12);
      w.camera.shake(5, 20);
      yield 20;
      // The Countess stands in the wreck and bows deeply.
      self.countessX = self.x;
      self.countessY = self.y - 34;
      self.pose = COUNTESS.stand;
      self.poseT = 999;
      yield 15;
      self.pose = COUNTESS.bow;
      self.audience?.react('clap', 140);
      w.audio.sfx('env/applause');
      yield 15;
      // A single rose lands at her feet.
      self.roseX = self.countessX + 10 * self.fx;
      self.roseY = w.camera.top - 10;
      for (let i = 0; i < 30 && self.roseY < self.countessY - 2; i++) {
        self.roseY = Math.min(self.countessY - 2, self.roseY + 5);
        yield;
      }
      self.pose = COUNTESS.stand;
      self.say("BRAVA! ...WAIT. YOU'RE THE ENEMY.", { at: [0, -100], ticks: 110 });
      yield 50;
      // An operatic swoon.
      self.pose = COUNTESS.faint;
      w.audio.sfx('hostage/faint');
      self.audience?.react('gasp', 30);
      yield 20;
      self.curtain?.moveTo(1, 60);
      yield 10;
    })();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x + this.leanX);
    const y = Math.round(this.y + this.leanY);
    const dy = this.dy;
    const dead = this.state === 'dying' || this.state === 'done';
    opts.flipX = this.fx < 0;
    opts.flash = false;
    if (this.wrecked) {
      r.sprite(`${ART}/wreck`, 0, x, y, opts);
      this.drawCountess(r, Math.round(this.countessX), Math.round(this.countessY), true);
      if (!Number.isNaN(this.roseY)) {
        opts.flipX = false;
        r.sprite(`${ART}/rose`, 0, Math.round(this.roseX), Math.round(this.roseY), opts);
      }
      return;
    }
    const legs = this.parts[P_LEGS];
    const keys = this.parts[P_KEYS];
    const lid = this.parts[P_LID];
    const strings = this.parts[P_STRINGS];
    const caseState = Math.max(this.damageState, this.state === 'dying' ? 2 : 0);
    r.sprite(`${ART}/back-legs`, this.backLegs, x, y, opts);
    r.sprite(`${ART}/case-${caseState}`, 0, x, y + dy, opts);
    if (!this.lidOn || lid.destroyed || this.lidDeg > 0.5) {
      // The harp frame shows when the lid is gone, and inside the open jaw.
      if (strings.enabled || strings.destroyed || this.lidDeg > 0.5) {
        this.drawPart(r, this.partSpriteId(strings), 0, x, y + dy, strings, dead);
      }
    }
    if (this.lidOn) {
      const k = Math.max(0, Math.min(LID_FRAMES - 1, Math.round(this.lidDeg / LID_STEP)));
      this.drawPart(r, this.partSpriteId(lid), k, x, y + dy, lid, dead);
    }
    this.drawPart(r, this.partSpriteId(keys), keys.destroyed ? 0 : this.keysFrame, x, y + dy, keys, dead);
    this.drawPart(r, legs.destroyed ? `${ART}/front-legs-broken` : this.partSpriteId(legs), this.frontLegs, x, y, legs, dead);
    // The bench and the Countess ride on the lid near the hinge.
    const seat = this.seatWorld();
    r.sprite(`${ART}/bench`, 0, seat[0], seat[1] + 1, opts);
    this.drawCountess(r, seat[0], seat[1] - 3, false);
    // The bite zone flashes white when the lid snaps.
    if (this.biteActive && (this.world.tick & 1) === 0) {
      const b = this.biteRect;
      r.rect(Math.round(b.x), Math.round(b.y + b.h / 2), Math.round(b.w), 2, 0xffffffff);
    }
  }

  /** A part's sprite; a hit flashes it with a white overlay (the detail stays readable). */
  private drawPart(r: Renderer, id: string, frame: number, x: number, y: number, p: BossPart, dead: boolean): void {
    r.sprite(id, frame, x, y, opts);
    if (dead || p.flash < 3) return;
    flashOpts.flipX = opts.flipX;
    r.sprite(id, frame, x, y, flashOpts);
  }

  /** The Countess's seat point in world space (it rides the opening lid). */
  private seatWorld(): [number, number] {
    const [sx, sy] = this.lidOn ? G.seat : G.seatNoLid;
    let lx: number = sx;
    let ly: number = sy;
    if (this.lidOn && this.lidDeg > 0) {
      const a = this.lidDeg * DEG;
      const [hx, hy] = G.hinge;
      const dx = sx - hx;
      const dyy = sy - hy;
      lx = hx + dx * Math.cos(a) + dyy * Math.sin(a);
      ly = hy - dx * Math.sin(a) + dyy * Math.cos(a);
    }
    this.tmp[0] = Math.round(this.x + this.leanX + lx * this.fx);
    this.tmp[1] = Math.round(this.y + this.leanY + ly + this.dy);
    return this.tmp;
  }

  private drawCountess(r: Renderer, x: number, y: number, standing: boolean): void {
    opts.flipX = this.fx < 0;
    opts.flash = false;
    const id = this.tall ? `${ART}/countess-tall` : `${ART}/countess`;
    let pose = this.pose;
    if (!standing && (pose === COUNTESS.stand || pose === COUNTESS.bow || pose === COUNTESS.faint)) pose = COUNTESS.sitA;
    r.sprite(id, pose, x, y, opts);
  }
}

defineEntity('grand-grand', (w, x, y, p) => new GrandGrand(w, x, y, p), {
  category: 'boss',
  score: 60000,
  description: 'm4 boss: a walking grand piano (lid, keyboard, front-legs, strings) with Countess Pizzicata; Chomp, Glissando, High C, Harp Strings, Pedal Stomp, Castor Charge, Grand Aria.',
});
