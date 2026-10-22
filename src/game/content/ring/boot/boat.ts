/**
 * THE PINK BOAT `DE LAATSTE DRUPPEL` — the mini-boss of `rf-b` DE BLOKKADE (docs/design/ring.md
 * §R.7; docs/api/ring.md "R.B2"). A big pink Dutch flat-bottomed sailing boat on a wheeled trailer
 * in the middle of the A10 (our own design and name), facing the heroes (the bow at the left).
 * Spawn it at the trailer's middle on the road; `autoStart = false`: the section script starts it
 * with `startBoat` (the bossIntro `DE LAATSTE DRUPPEL` / `MINI-BOSS`).
 *
 * - The intro (invulnerable, ~2.5 s, under the WARNING banner): the leader taps the megaphone.
 * - Phase 1 `waves` (100 % → 50 %): the leader's megaphone RINGS (the tell, ≥ 18 ticks), then
 *   `MEDE-REBELLEN... ZITTEN!` and a wave of `loper`s comes down the ladder at the bow (2 / 3 / 4 by
 *   difficulty, tag `BOAT_LOPER_TAG`; a new wave only while fewer than the wave size sit there);
 *   the snare drummer lobs paint balloons from the deck (the balloon lifted: the tell);
 *   `DIT IS EEN VREEDZAAM PROTEST!` every second wave.
 * - Phase 2 `drums` (HP ≤ 50 % or both loudspeakers broken; `TROMMELS... NU!`): the drum band —
 *   each beat's tell is the sticks raised (≥ 18 ticks), the beat sends a ground shock rolling along
 *   the road (jump it); the boom swings out over the bow at chest height (its tell: the creak, the
 *   leader ducks; crouch under it or step back); smaller waves; balloons.
 * - Parts: `hull` (the HP; a damage-rate bucket so the fight lasts 45–75 s with any gun),
 *   `speaker-l` / `speaker-r` (breakable, × 1.5; they flash, the hull never does). The leader and
 *   the drummers are never targets (the leader ducks behind the rail when the boat is hit).
 * - Stagger (a continued hero lands): the running attack ends cleanly (`cutAttack`).
 * - THE END (`deathSequence`, bloodless): the hull cracks, the mast topples, the boat settles on
 *   its trailer, the drummers hide behind the rail; a weapon drop; the leader slides down the bow
 *   (the NPC `ring-leider`), says `WIJ KOMEN TERUG... NA DE LUNCH!` while the police walk up; when
 *   they lift the leader (stiff as a plank) → `ended`, BOAT_EVENT 'end' (the exit opens while they
 *   carry the leader off). The wreck stays (removeOnDeath false).
 *
 * Deterministic: no rng in the patterns (fixed orders); no per-tick allocations.
 */
import type { Damage } from '../../../../engine/entity';
import { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { sessionOf } from '../../../context';
import { gagBubble } from '../../../enemy';
import { confetti, debris, dust } from '../../../fx';
import { FxEntity } from '../../../fx';
import { Projectile } from '../../../projectile';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { ACTIVIST, callPolice, type Carryable } from '../activists/api';
import { LEIDER_LINES, RING_SPEAKER } from '../foot/lines';
import { BOAT_ART, BOAT_EVENT, BOAT_ID, BOAT_LEADER, BOAT_NAME, BOAT_PART, BOAT_TUNE } from './api';
import { BODY_SPR, MAST_FALL } from './art-hull';
import { CREW_SPR } from './art-crew';
import { FX_SPR, PAINTS } from './art-fx';
import {
  BALLOON_FROM,
  BOAT_BOX,
  BOAT_G,
  boomBox,
  DRUM_A_HIP,
  DRUM_B_HIP,
  GOOSENECK,
  LADDER_X,
  LEADER_HIP,
  LEADER_SAY,
  MEGAPHONE,
  SHOCK_X,
  TRAILER,
} from './geometry';

/** Base HP (× difficulty × co-op; 1,500, was 1,800: the bot's fight ~38-40 s, the momentum rule §R.13). */
export const BOAT_HP = 1500;
/** The section tag of the lopers a wave brings (the leader counts them). */
export const BOAT_LOPER_TAG = 'rf-b-boat';

/** Tuning (NORMAL ticks; tells through `telegraphFor`, never below 18). */
export const BOAT_PACE = {
  /**
   * The best gun's floor (ticks, the burst included): the hull's damage rate = (hp − burst) / floor.
   * 2,250 (37.5 s; was 3,000): the fight stays inside the momentum rule (§R.13, each part ≤ 40 s).
   */
  floorTicks: 2250,
  burst: 150,
  intro: 150,
  /** The megaphone's ring before a call; the balloon lifted; the sticks raised; the boom's creak. */
  callTell: 26,
  lobTell: 24,
  drumTell: 24,
  boomTell: 30,
  /** The boom stays out (frames 4–5) this long. */
  boomOut: 26,
  /** Ticks between the lopers of a wave. */
  waveGap: 22,
  /** The ground shock's speed (px / tick, to the left) and its box. */
  shockSpeed: 2.3,
  shockW: 14,
  shockH: 5,
  balloonG: 0.12,
  balloonT: 66,
  damage: 10,
} as const;

/** One attack as it fired (tests): its kind, its tell and the tick. */
export interface BoatAttack {
  readonly kind: 'wave' | 'lob' | 'beat' | 'boom';
  readonly tell: number;
  readonly tick: number;
}

type LeaderPose = 'idle' | 'call' | 'duck';
type DrumAPose = 'idle' | 'tell' | 'beat' | 'duck';
type DrumBPose = 'idle' | 'tell' | 'beat' | 'lob' | 'throw' | 'duck';

const drawOpts: DrawOpts = {};
const flipOpts: DrawOpts = { flipX: true };
const flashOpts: DrawOpts = { tint: 0xffffffff };
const addOpts: DrawOpts = { blend: 'add' };
const EMPTY: readonly Rect[] = [];
/** The two loudspeaker parts (drawn every frame: a module list, no per-frame array). */
const SPEAKERS = [BOAT_PART.speakerL, BOAT_PART.speakerR] as const;

export class PinkBoat extends Boss {
  wavesCalled = 0;
  ended = false;
  /** Ticks left of the drum tell (−1 none): the sticks are raised. */
  drumTell = -1;
  /** The boom's frame (0 rest … 5 out low; geometry.ts BOOM_ENDS). */
  boomF = 0;
  /** The attacks so far (tests). */
  readonly attacks: BoatAttack[] = [];
  leaderPose: LeaderPose = 'idle';
  drumAPose: DrumAPose = 'idle';
  drumBPose: DrumBPose = 'idle';
  /** The end: the hull broken, the mast frame (−1 standing), the settle (px). */
  wrecked = false;
  mastFallF = -1;
  settle = 0;
  /** The leader left the deck (the NPC took over). */
  leaderGoneFromDeck = false;
  private readonly waveSize: number;
  private t = 0;
  private duckT = 0;
  private ringT = -1;
  private kitA = 0;
  private kitB = 0;
  private readonly dmgRate: number;
  private dmgLeft: number;
  private readonly dmgBurst: number;
  private readonly boomRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly boomList: Rect[] = [this.boomRect];
  readonly hull: BossPart;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: BOAT_ART, name: BOAT_NAME, hp: BOAT_HP, score: BOAT_TUNE.score });
    this.autoStart = false;
    this.removeOnDeath = false;
    this.facing = 1;
    this.z = 24;
    const diff = sessionOf(world).difficulty;
    this.waveSize = Math.max(1, Math.round(paramNum(p, 'wave', BOAT_TUNE.waveSize[diff] ?? 3)));
    const base = Math.max(1, paramNum(p, 'hp', BOAT_HP));
    const scale = this.maxHp / base;
    this.dmgRate = (Math.max(0, paramNum(p, 'rate', (base - BOAT_PACE.burst) / BOAT_PACE.floorTicks)) || 1e9) * scale;
    this.dmgBurst = this.dmgLeft = BOAT_PACE.burst * scale;
    this.hull = this.addPart(BOAT_PART.hull, { box: { ...BOAT_BOX.hull } });
    this.addPart(BOAT_PART.speakerL, { box: { ...BOAT_BOX.speakerL }, hp: 40, multiplier: 1.5 });
    this.addPart(BOAT_PART.speakerR, { box: { ...BOAT_BOX.speakerR }, hp: 40, multiplier: 1.5 });
    this.hitbox = { x: BOAT_BOX.hull.x, y: -100, w: BOAT_BOX.hull.w, h: 100 };
    this.contactDamage = { amount: BOAT_PACE.damage, kind: 'impact', dirX: -1, tags: ['boss'] };
    this.phases = [
      { at: 1, name: 'waves', pattern: (b) => b.phaseWaves() },
      {
        at: BOAT_TUNE.phase2At,
        when: (b) => b.brokenCount([BOAT_PART.speakerL, BOAT_PART.speakerR]) === 2,
        name: 'drums',
        onEnter: (b) => {
          b.leaderPose = 'call';
          b.ringT = 0;
          b.say(LEIDER_LINES.drums, { at: LEADER_SAY, ticks: 122 });
          b.world.audio.sfx('ring/boot/megaphone');
          b.world.events.emit(BOAT_EVENT, { what: 'phase2', boat: b });
        },
        pattern: (b) => b.phaseDrums(),
        resume: (b) => b.phaseDrums(),
      },
    ];
  }

  // ------------------------------------------------------------------------------- the fight

  override *intro(): ScriptGen {
    // The leader taps the megaphone twice (a squeal), the drummers count in: no attack yet.
    yield 40;
    this.leaderPose = 'call';
    this.ringT = 0;
    this.world.audio.sfx('ring/boot/megaphone');
    yield 30;
    this.leaderPose = 'idle';
    yield BOAT_PACE.intro - 70;
  }

  private tell(base: number): number {
    return Math.max(18, this.telegraphFor(base));
  }

  private record(kind: BoatAttack['kind'], tell: number): void {
    this.attacks.push({ kind, tell, tick: this.world.tick });
  }

  /** Lopers of the boat's waves still there. */
  sitting(): number {
    return this.world.countAlive(BOAT_LOPER_TAG);
  }

  *phaseWaves(): ScriptGen {
    for (;;) {
      if (this.sitting() < this.waveSize && !this.holdAdds) yield* this.callWave(this.waveSize);
      yield* this.lob();
      yield 40;
      yield* this.lob();
      yield 46;
      if (this.wavesCalled > 0 && this.wavesCalled % 2 === 0 && this.t % 2 === 0) this.say(LEIDER_LINES.vreedzaam, { at: LEADER_SAY, ticks: 132 });
      yield 40;
    }
  }

  *phaseDrums(): ScriptGen {
    this.drumAPose = this.drumBPose = 'idle';
    yield 40;
    for (let round = 0; ; round++) {
      yield* this.beat();
      yield 54;
      yield* this.beat();
      yield 50;
      yield* this.boom();
      yield 36;
      if (this.sitting() < this.waveSize - 1 && !this.holdAdds) yield* this.callWave(Math.max(1, this.waveSize - 1));
      else yield* this.lob();
      yield 40;
    }
  }

  /** The megaphone rings (the tell), the call, a wave of lopers down the ladder. */
  *callWave(n: number): ScriptGen {
    const tell = this.tell(BOAT_PACE.callTell);
    this.leaderPose = 'call';
    this.ringT = 0;
    this.world.audio.sfx('ring/boot/megaphone');
    yield tell;
    this.record('wave', tell);
    this.wavesCalled++;
    this.say(LEIDER_LINES.wave, { at: LEADER_SAY, ticks: 175 });
    this.world.events.emit(BOAT_EVENT, { what: 'wave', boat: this, wave: this.wavesCalled, count: n });
    const room = Math.max(0, this.x + LADDER_X - this.world.camera.x - 40);
    for (let i = 0; i < n; i++) {
      const sitAt = this.x + LADDER_X - 24 - ((i * 34) % Math.max(34, room));
      this.world.spawn(ACTIVIST.loper, this.x + LADDER_X + 2, this.y, { enter: 'right', facing: -1, sitAt, tag: BOAT_LOPER_TAG, wait: 30 + i * 12 });
      yield BOAT_PACE.waveGap;
    }
    this.leaderPose = 'idle';
  }

  /** The snare drummer lifts a paint balloon (the tell) and lobs it at the nearest hero. */
  *lob(): ScriptGen {
    const tell = this.tell(BOAT_PACE.lobTell);
    this.drumBPose = 'lob';
    this.world.audio.sfx('ring/boot/balloon-lift');
    yield tell;
    this.record('lob', tell);
    this.drumBPose = 'throw';
    this.balloon();
    yield 14;
    this.drumBPose = 'idle';
  }

  private balloon(): void {
    const t = this.world.nearestPlayer(this.x, this.y);
    const x0 = this.x + BALLOON_FROM[0];
    const y0 = this.y + BALLOON_FROM[1];
    const tx = t ? t.x : this.x - 160;
    const T = BOAT_PACE.balloonT;
    const vx = Math.max(-3.2, Math.min(-0.6, (tx - x0) / T));
    const vy = (this.y - 4 - y0 - 0.5 * BOAT_PACE.balloonG * T * T) / T;
    const col = (this.attacks.length + this.wavesCalled) % PAINTS.length;
    Projectile.spawn(this.world, {
      team: 'enemy',
      x: x0,
      y: y0,
      vx,
      vy,
      damage: BOAT_PACE.damage,
      kind: 'impact',
      gravity: BOAT_PACE.balloonG,
      w: 7,
      h: 7,
      life: 240,
      sprite: FX_SPR.balloon(col),
      look: 'anim',
      ticksPerFrame: 6,
      shooter: this,
      type: `${BOAT_ID}-balloon`,
      impact: (p, _target, x, y) => splat(p.world, x, Math.min(y, this.y), col),
    });
    this.world.audio.sfx('ring/throw');
  }

  /** The drum band's beat: the sticks raised (the tell), the beat, a ground shock rolling left. */
  *beat(): ScriptGen {
    const tell = this.tell(BOAT_PACE.drumTell);
    this.drumTell = tell;
    this.drumAPose = 'tell';
    this.drumBPose = 'tell';
    this.world.audio.sfx('ring/boot/drum-tell');
    for (let i = 0; i < tell; i++) {
      this.drumTell = tell - i;
      yield 1;
    }
    this.drumTell = -1;
    this.record('beat', tell);
    this.drumAPose = 'beat';
    this.drumBPose = 'beat';
    this.kitA = this.kitB = 8;
    this.world.audio.sfx('ring/boot/drum');
    this.world.audio.sfx('ring/boot/shock');
    this.world.camera.shake(2, 8);
    this.shock();
    yield 12;
    this.drumAPose = 'idle';
    this.drumBPose = 'idle';
  }

  private shock(): void {
    const x0 = this.x + SHOCK_X;
    Projectile.spawn(this.world, {
      team: 'enemy',
      x: x0,
      y: this.y - BOAT_PACE.shockH / 2,
      vx: -BOAT_PACE.shockSpeed,
      vy: 0,
      damage: BOAT_PACE.damage,
      kind: 'impact',
      w: BOAT_PACE.shockW,
      h: BOAT_PACE.shockH,
      life: 400,
      hitsTerrain: false,
      pierce: Infinity,
      sprite: FX_SPR.shock,
      look: 'anim',
      ticksPerFrame: 4,
      shooter: this,
      type: `${BOAT_ID}-shock`,
      tags: ['boss', 'shockwave'],
      erasable: true,
    });
    dust(this.world, x0, this.y, 3);
  }

  /** The boom swings out over the bow at chest height (its tell: the creak; the leader ducks). */
  *boom(): ScriptGen {
    const tell = this.tell(BOAT_PACE.boomTell);
    this.boomF = 1;
    this.duckT = tell + 60;
    this.world.audio.sfx('ring/boot/boom-creak');
    yield tell;
    this.record('boom', tell);
    this.world.audio.sfx('ring/boot/boom');
    this.boomF = 2;
    yield 4;
    this.boomF = 3;
    yield 4;
    this.boomF = 4;
    yield 4;
    this.boomF = 5;
    yield BOAT_PACE.boomOut;
    this.boomF = 4;
    yield 4;
    this.boomF = 3;
    yield 5;
    this.boomF = 2;
    yield 5;
    this.boomF = 0;
  }

  protected override cutAttack(): boolean {
    this.drumTell = -1;
    this.boomF = 0;
    this.leaderPose = 'idle';
    this.drumAPose = 'idle';
    this.drumBPose = 'idle';
    return true;
  }

  override contactBoxes(): readonly Rect[] {
    if (this.dead || this.boomF < 4) return EMPTY;
    const b = boomBox(this.boomF);
    if (!b) return EMPTY;
    this.boomRect.x = this.x + b.x;
    this.boomRect.y = this.y + b.y;
    this.boomRect.w = b.w;
    this.boomRect.h = b.h;
    return this.boomList;
  }

  /** The hull's damage-rate bucket (any gun needs ≥ `floorTicks`); the speakers take it all. */
  override onHit(d: Damage, part = 0): boolean {
    if (this.state === 'fight' && !this.dead && part === this.hull.index && this.invulnTicks <= 0) {
      // An empty bucket still takes the hit as a plain one (no armour ping; no damage), like a ZWAAN part.
      const amount = Math.max(0, Math.min(d.amount, this.dmgLeft));
      this.dmgLeft -= amount;
      this.duckT = Math.max(this.duckT, 12);
      return super.onHit(amount === d.amount ? d : { ...d, amount }, part);
    }
    return super.onHit(d, part);
  }

  protected override onPartBroken(p: BossPart): void {
    // A broken loudspeaker squeals and dies (feedback, then the crunch).
    this.world.audio.sfx('ring/boot/feedback');
    this.world.audio.sfx('ring/boot/speaker-break');
    const r = this.partRect(p);
    debris(this.world, r.x + r.w / 2, r.y + r.h / 2, 'metal', 5);
    this.checkPhases();
  }

  protected override onDamageState(): void {
    // Paint chips and cloth, never metal shards off the pink hull.
    debris(this.world, this.x - 20, this.y - 40, 'cloth', 5);
  }

  protected override think(): void {
    this.t++;
    if (this.dmgLeft < this.dmgBurst) this.dmgLeft = Math.min(this.dmgBurst, this.dmgLeft + this.dmgRate);
    if (this.duckT > 0) this.duckT--;
    if (this.ringT >= 0 && ++this.ringT > 15) this.ringT = -1;
    if (this.kitA > 0) this.kitA--;
    if (this.kitB > 0) this.kitB--;
  }

  // ------------------------------------------------------------------------------- the end

  protected override deathSequence(): ScriptGen {
    const self = this;
    return (function* boatEnd(): ScriptGen {
      const w = self.world;
      self.cutAttack();
      self.hush();
      self.drumAPose = 'duck';
      self.drumBPose = 'duck';
      self.leaderPose = 'duck';
      w.events.emit(BOAT_EVENT, { what: 'beaten', boat: self });
      // The hull cracks (a loud splintering crack; paint chips and cloth, no blood).
      w.audio.sfx('ring/boot/crack');
      w.camera.shake(3, 14);
      for (let i = 0; i < 3; i++) {
        debris(w, self.x - 40 + i * 40, self.y - 34, 'cloth', 4);
        yield 5;
      }
      self.wrecked = true;
      confetti(w, self.x + 6, self.y - 44, 14, 2);
      dust(w, self.x + 6, self.y - 10, 4);
      yield 10;
      // The mast topples aft over the deckhouse.
      w.audio.sfx('ring/boot/mast-fall');
      for (let f = 0; f < MAST_FALL.length; f++) {
        self.mastFallF = f;
        yield 5;
      }
      w.camera.shake(3, 10);
      dust(w, self.x + 60, self.y - 60, 5);
      // The boat settles on its trailer.
      w.audio.sfx('ring/boot/settle');
      for (let i = 1; i <= 3; i++) {
        self.settle = i;
        yield 4;
      }
      dust(w, self.x - 40, self.y, 4);
      dust(w, self.x + 40, self.y, 4);
      // The weapon drop at the bow; the leader slides down the bow (the NPC), the police come.
      w.spawn('pickup-weapon', self.x + LADDER_X - 30, self.y - 24, { weapon: 'S' });
      self.leaderGoneFromDeck = true;
      const leader = w.spawn(BOAT_LEADER, self.x + LEADER_HIP[0], self.y + LEADER_HIP[1] + self.settle, { boat: self });
      if (leader instanceof BoatLeader) leader.boat = self;
      else self.leaderGone();
      yield 30;
    })();
  }

  /** The leader's carry-off is over (BoatLeader). */
  leaderGone(): void {
    if (this.ended) return;
    this.ended = true;
    this.world.events.emit(BOAT_EVENT, { what: 'end', boat: this });
  }

  // ------------------------------------------------------------------------------- draw

  private frameOf(_id: string, tpf: number, n: number): number {
    return Math.floor(this.t / tpf) % n;
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const sy = y + this.settle;
    // The trailer and its wheels.
    r.sprite(BODY_SPR.trailer, 0, x, y, drawOpts);
    const wy = y + BOAT_G - Math.round(TRAILER.wheelR + 0.5);
    for (const ax of TRAILER.axles) r.sprite('ring/car/wheel-m', 0, x + ax, wy, drawOpts);
    // The mast (standing or toppling), the boom at rest behind the deck.
    if (this.mastFallF < 0) r.sprite(BODY_SPR.mast, this.frameOf(BODY_SPR.mast, 9, 3), x, sy, drawOpts);
    const gx = x + GOOSENECK[0];
    const gy = sy + GOOSENECK[1];
    if (this.boomF < 2 && this.mastFallF < 0) r.sprite(BODY_SPR.boom, this.boomF, gx, gy, drawOpts);
    r.sprite(BODY_SPR.deck, 0, x, sy, drawOpts);
    // The loudspeakers (they flash when hit; the hull never does).
    for (const name of SPEAKERS) {
      const p = this.part(name);
      if (!p) continue;
      const id = BODY_SPR.speaker(name === BOAT_PART.speakerL ? 'l' : 'r', this.partState(p));
      r.sprite(id, 0, x, sy, drawOpts);
      if (p.flash > 0 && !p.destroyed && this.world.tick % 2 === 0) r.sprite(id, 0, x, sy, flashOpts);
    }
    // The crew behind the bulwark (drawn mirrored: they face the heroes).
    const lp: LeaderPose = this.leaderGoneFromDeck ? 'duck' : this.leaderPose === 'call' ? 'call' : this.duckT > 0 || this.dead ? 'duck' : 'idle';
    if (!this.leaderGoneFromDeck) r.sprite(CREW_SPR.leader(lp), lp === 'idle' ? this.frameOf('', 30, 2) : lp === 'call' ? this.frameOf('', 10, 2) : 0, x + LEADER_HIP[0], sy + LEADER_HIP[1], flipOpts);
    r.sprite(CREW_SPR.drumA(this.drumAPose), this.drumAPose === 'idle' ? this.frameOf('', 24, 2) : 0, x + DRUM_A_HIP[0], sy + DRUM_A_HIP[1], flipOpts);
    r.sprite(CREW_SPR.drumB(this.drumBPose), this.drumBPose === 'idle' ? this.frameOf('', 22, 2) : 0, x + DRUM_B_HIP[0], sy + DRUM_B_HIP[1], flipOpts);
    r.sprite(CREW_SPR.kitA, this.kitA > 4 ? 1 : 0, x, sy, drawOpts);
    r.sprite(CREW_SPR.kitB, this.kitB > 4 ? 1 : 0, x, sy, drawOpts);
    // The hull's near side (the damage state, or the wreck).
    if (this.wrecked) r.sprite(BODY_SPR.wreck, 0, x, y, drawOpts);
    else r.sprite(BODY_SPR.hull(this.damageState), 0, x, sy, drawOpts);
    // The toppled mast lies across the wreck (in front of it).
    if (this.mastFallF >= 0) r.sprite(BODY_SPR.mastFall, this.mastFallF, x, sy, drawOpts);
    // The boom swinging out over the bow (in front).
    if (this.boomF >= 2 && this.mastFallF < 0) r.sprite(BODY_SPR.boom, this.boomF, gx, gy, drawOpts);
    // The megaphone's ring (the call's tell).
    if (this.ringT >= 0 && !this.leaderGoneFromDeck) r.sprite(FX_SPR.ring, Math.min(2, this.ringT / 5) | 0, x + MEGAPHONE[0], sy + MEGAPHONE[1], addOpts);
  }
}

/** A paint balloon bursts: a bright splat on the road (never red). */
function splat(world: World, x: number, y: number, col: number): void {
  FxEntity.spawn(world, { sprite: FX_SPR.splat(col), x, y, z: 20, life: 22 });
  world.audio.sfx('ring/boot/splat');
}

defineEntity(BOAT_ID, (w, x, y, p) => new PinkBoat(w, x, y, p), {
  category: 'boss',
  score: BOAT_TUNE.score,
  description: 'ring mini-boss DE LAATSTE DRUPPEL: the pink protest boat on its trailer; autoStart false (startBoat); waves of lopers and paint balloons, then the drum band (ground shocks) and the swinging boom; the leader is carried off.',
});

// ---------------------------------------------------------------------------------------------
// The leader after the end
// ---------------------------------------------------------------------------------------------

/** The leader slides down the bow, says the lunch line, and the police carry the leader off. Never a target. */
export class BoatLeader extends Entity implements Carryable {
  carried = false;
  boat: PinkBoat | null = null;
  private t = 0;
  private called = false;
  private readonly x0: number;
  private readonly y0: number;
  private readonly floor: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.type = BOAT_LEADER;
    this.team = 'neutral';
    this.z = 32;
    this.hitbox = { x: -6, y: -26, w: 12, h: 26 };
    this.despawnMargin = Infinity;
    this.facing = -1;
    this.x0 = x;
    this.y0 = y;
    const b = (p as { boat?: unknown }).boat;
    this.floor = b instanceof PinkBoat ? b.y : y + 57;
  }

  /** Sliding down the hull (the first ticks). */
  get sliding(): boolean {
    return this.t < SLIDE;
  }

  override update(): void {
    this.t++;
    if (this.carried) {
      // In the officers' hands: the boat's end (the exit opens while they carry the leader off).
      this.boat?.leaderGone();
      return;
    }
    if (this.t <= SLIDE) {
      const u = this.t / SLIDE;
      this.x = this.x0 + (LADDER_X - LEADER_HIP[0] - 6) * u;
      this.y = this.y0 + (this.floor - this.y0) * (u * u);
      if (this.t === 1) this.world.audio.sfx('ring/boot/slide');
      if (this.t === SLIDE) dust(this.world, this.x, this.y, 3);
      return;
    }
    if (this.t === SLIDE + 16) gagBubble(this.world, this, LEIDER_LINES.lunch, 236, RING_SPEAKER.leider);
    if (this.t >= SLIDE + 6 && !this.called) {
      this.called = true;
      callPolice(this.world, this, { from: 'left', kind: 'leider', onDone: () => this.boat?.leaderGone() });
    }
  }

  override onRemove(): void {
    this.boat?.leaderGone();
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.carried) r.sprite(CREW_SPR.leider('carried'), 0, x, y, drawOpts);
    else if (this.sliding) r.sprite(CREW_SPR.leider('slide'), 0, x, y, flipOpts);
    else r.sprite(CREW_SPR.leider('stand'), Math.floor(this.t / 18) % 2, x, y, flipOpts);
  }
}

const SLIDE = 26;

defineEntity(BOAT_LEADER, (w, x, y, p) => new BoatLeader(w, x, y, p), {
  category: 'npc',
  description: "the pink boat's leader after the end: slides down the bow, the lunch line, then the police carry the leader off; never a target.",
});
