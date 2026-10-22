/**
 * `ring-zwaan-vee` — the ZWAAN train's LIVESTOCK TRAILER (bar name ZWAAN VEETRANSPORT; docs/design/
 * ring.md §R.3, part 4 of 5). A `ZwaanPart` (part.ts): rear end = its anchor, 164 px forward its
 * front; lanes 1–2. Slatted decks with cows (below) and pigs (above); a farmhand in the roof hatch.
 *
 * ATTACKS (each after a tell of ≥ 18 ticks on screen; `mode` 'tell-X' → 'X' for the sim's watch):
 * - THE HERD: the rear gate unlatches and drops onto the road (the tell: the clank, the gate frames,
 *   a moo from inside, the brake lights), then 2 animals (HARD 3: a cow, a pig, …) walk down it and
 *   TROT back across the lanes to the hard shoulder (`ZwaanAnimal`, vee-animals.ts: they block shots
 *   like civilian cars and cost a cell on a bump; never hurt; they graze on the shoulder). At most
 *   2 (HARD 3) animals are on the road at a time, so a lane is always free. With the gate broken
 *   off, they jump out of the open back (the tell: the moo, the brake lights).
 * - THE LOB: the farmhand hoists a hay bale or a milk churn over his head (the tell), then lobs it
 *   into the target wagon's lane where the wagon will be (`ZwaanLob`: 1 cell where it lands).
 *
 * PARTS (pool model; side by side, never overlapping): 0 `body` (x 12 … 102, × 1: part 0 is what the
 * bot aims at, it never breaks), 1 `gate` (× 1.5, own HP, passed on), 2 `hatch` (the farmhand's
 * hatch, × 1.5, own HP, passed on), 3 `body-front` (× 1). The gate broken (+1000): it falls
 * off and tumbles away. The hatch broken (+1000): the farmhand ducks, dazed (bloodless; `IK ZIE
 * STERRETJES...`), no more lobs. Phase 2 (HP ≤ 50 % or a part broken): shorter pauses.
 *
 * BEATEN (2,000 points): uncouple → brake (the gate drops) → onto the hard shoulder, where it STOPS
 * (no blast, no tip) → the animals wander out of its side door onto the shoulder unhurt and graze; the farmhand sits
 * dazed on the roof → the drop → it stands there while the road rolls on (it drops back).
 *
 * Params: `hp`, `hpScale`, `lane`, `rate`, `index`.
 */
import type { Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import type { BossPart } from '../../../boss';
import { dust, hitSpark } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { defineRingArt } from '../../../ring/art-def';
import { ringOf } from '../../../ring/entity';
import { laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { nearestWagon, tumbleOff } from '../traffic/road-kit';
import { ZWAAN, ZWAAN_NAMES, defineZwaanPart } from './api';
import { bodySpark } from './autos-kit';
import { drawZwaanCoupling, drawZwaanDolly, drawZwaanHitch, drawZwaanShadow, drawZwaanWheels, pushWagonsOut, uncoupleFx, ZWAAN_KIT_ART, ZWAAN_PACE, zwaanRate } from './kit';
import { ZwaanPart, zwaanSlab } from './part';
import { ANIMAL_TAG, COW_ID, LOB_ID, PIG_ID, ZwaanAnimal } from './vee-animals';
import { VEE, VEE_ART, VEE_ID, VEE_SPR } from './vee-geo';

export const VEE_AI = {
  /**
   * The pool (the integrator's momentum tuning, kit.ts `ZWAAN_PACE`; was 0.88 × the trailer HP: the
   * weak-point bot took 43–50 s); its rate (kit.ts `zwaanRate`) keeps the best gun at ≥ 30 s.
   */
  hp: ZWAAN_PACE.veeHp,
  gate: 360,
  hatch: 320,
  partMul: 1.5,
  bodyMul: 1,
  rate: zwaanRate(ZWAAN_PACE.veeHp),
  /** Telegraph bases (× difficulty, never below 18). */
  herdTell: 34,
  lobTell: 30,
  /** The gate's motion (ticks for the whole way), the gap between two animals. */
  gateTicks: 22,
  animalGap: 26,
  /** Animals per herd on NORMAL (HARD +1) and the most on the road at once (NORMAL; HARD +1). */
  herd: 2,
  onRoad: 2,
  /** The lob: flight ticks, where it lands (px ahead of the target wagon's middle). */
  lobTicks: 40,
  lobAhead: 18,
  /** Pauses (× the difficulty's fire interval). */
  pause: 60,
  pause2: 40,
  phase2: 0.5,
  score: ZWAAN.score.trailer,
} as const;

/** The farmhand's lines (Dutch, ≤ 24 characters a line). */
export const VEE_LINES = {
  lob: ['HOOI VOOR JOU!', 'VERSE MELK!', 'VAN DE BOER!'],
  dazed: 'IK ZIE STERRETJES...',
} as const;

export interface VeeAttackTrace {
  attack: 'herd' | 'lob';
  tell: number;
  fire: number;
  seen: number;
  lane: number;
}

type Farm = 'stand' | 'lift' | 'throw' | 'duck';

const P_GATE = 1;
const P_HATCH = 2;
const drawOpts: DrawOpts = {};
const SAY_AT: readonly [number, number] = [VEE.farmhand[0], VEE.farmhand[1] - 26];

export class VeePart extends ZwaanPart {
  /** The gate: 0 shut … 3 on the road (and its target). */
  gate = 0;
  gateTarget = 0;
  gateBroken = false;
  farm: Farm = 'stand';
  farmT = 0;
  liftKind: 'bale' | 'churn' = 'bale';
  dazed = false;
  mode: 'cruise' | 'tell-herd' | 'herd' | 'tell-lob' | 'lob' = 'cruise';
  readonly trace: VeeAttackTrace[] = [];
  /** Animals let out (tests). */
  released = 0;
  private lobNo = 0;
  private look = 0;
  private readonly touched = new WeakMap<Wagon, number>();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: VEE_ART, name: ZWAAN_NAMES[VEE_ID], hp: VEE_AI.hp, score: VEE_AI.score, length: VEE.length, height: VEE.height });
    const k = paramNum(p, 'hpScale', 1);
    const base = Math.max(1, Math.round(paramNum(p, 'hp', VEE_AI.hp) * k));
    this.dmgRate = Math.max(0, paramNum(p, 'rate', VEE_AI.rate)) * (this.maxHp / base);
    // Side by side, never overlapping (ties go to the lowest index): part 0 is a wide body section
    // (the bot aims at part 0; it never breaks).
    const h0 = VEE.hatch[0] - 2;
    const h1 = VEE.hatch[1] + 2;
    this.addPart('body', { box: zwaanSlab(12, h0), multiplier: VEE_AI.bodyMul });
    this.addPart('gate', { box: zwaanSlab(-2, 12), hp: Math.max(1, Math.round(VEE_AI.gate * k)), shared: true, multiplier: VEE_AI.partMul });
    this.addPart('hatch', { box: zwaanSlab(h0, h1), hp: Math.max(1, Math.round(VEE_AI.hatch * k)), shared: true, multiplier: VEE_AI.partMul });
    this.addPart('body-front', { box: zwaanSlab(h1, VEE.length), multiplier: VEE_AI.bodyMul });
    this.hitbox = { x: 0, y: -VEE.height - 18, w: VEE.length, h: VEE.height + 18 };
    this.phases = [
      { at: 1, name: 'farm', pattern: (b) => b.phaseFarm(false) },
      { at: VEE_AI.phase2, when: (b) => b.brokenCount() > 0, name: 'stampede', onEnter: (b) => b.resetAttack(), pattern: (b) => b.phaseFarm(true), resume: (b) => b.phaseFarm(true) },
    ];
  }

  /** The gate lies on the road (the animals walk down it). */
  get gateDown(): boolean {
    return this.gate >= 2.99;
  }

  // ------------------------------------------------------------------------------- phases

  *phaseFarm(fast: boolean): ScriptGen {
    yield 24;
    const gap = (): number => this.recoveryFor(fast ? VEE_AI.pause2 : VEE_AI.pause);
    for (;;) {
      yield* this.lob();
      yield gap();
      yield* this.herd();
      yield gap();
      yield* this.lob();
      yield gap();
    }
  }

  private mark(attack: VeeAttackTrace['attack'], lane: number): VeeAttackTrace {
    const tr: VeeAttackTrace = { attack, tell: this.world.tick, fire: -1, seen: 0, lane };
    this.trace.push(tr);
    return tr;
  }

  private inView(): boolean {
    return this.world.camera.containsPoint(this.x + 10, this.y - 30, -8) && this.world.camera.containsPoint(this.x + VEE.farmhand[0], this.y - 40, -8);
  }

  /** Animals still on the road (walking down or trotting). */
  animalsOnRoad(): number {
    let n = 0;
    const list = this.world.byTag(ANIMAL_TAG);
    for (let i = 0; i < list.length; i++) {
      const a = list[i] as ZwaanAnimal;
      if (a.alive && (a.mode === 'ramp' || a.mode === 'trot')) n++;
    }
    return n;
  }

  private get roadCap(): number {
    return this.volleySize(VEE_AI.onRoad);
  }

  /** THE HERD (see the header). */
  *herd(): ScriptGen {
    for (let g = 0; g < 240 && (!this.inView() || this.animalsOnRoad() >= this.roadCap); g++) yield 1;
    if (!this.inView() || this.animalsOnRoad() >= this.roadCap) return;
    const tr = this.mark('herd', nearestLane(this.y));
    this.mode = 'tell-herd';
    this.brakeT = 9999;
    this.world.audio.sfx('ring/zwaan/gate');
    this.world.audio.sfx('ring/zwaan/moo', { vol: 0.7 });
    if (!this.gateBroken) this.gateTarget = 3;
    const T = Math.max(this.telegraphFor(VEE_AI.herdTell), VEE_AI.gateTicks + 2);
    for (let i = 0; i < T; i++) {
      tr.seen++;
      yield 1;
    }
    tr.fire = this.world.tick;
    this.mode = 'herd';
    const n = this.volleySize(VEE_AI.herd);
    for (let i = 0; i < n && this.animalsOnRoad() < this.roadCap; i++) {
      const kind = (this.released + this.index) % 2 === 0 ? COW_ID : PIG_ID;
      this.world.spawn(kind, this.x + 8, this.y, { mode: 'ramp', host: this, lx: 8, look: this.look++ });
      this.released++;
      yield VEE_AI.animalGap;
    }
    yield 20;
    this.brakeT = 0;
    this.mode = 'cruise';
    if (!this.gateBroken) {
      this.gateTarget = 0;
      this.world.audio.sfx('ring/zwaan/gate', { pitch: 1.2, vol: 0.6 });
    }
  }

  /** THE LOB (see the header). */
  *lob(): ScriptGen {
    if (this.dazed) {
      yield 20;
      return;
    }
    for (let g = 0; g < 240 && (!this.inView() || !nearestWagon(this.world, this.x, this.y)); g++) yield 1;
    const w0 = nearestWagon(this.world, this.x, this.y);
    if (!w0 || !this.inView() || this.dazed) return;
    const kind: 'bale' | 'churn' = this.lobNo++ % 2 === 0 ? 'bale' : 'churn';
    const tr = this.mark('lob', nearestLane(w0.y));
    this.mode = 'tell-lob';
    this.liftKind = kind;
    this.setFarm('lift');
    this.world.audio.sfx('ring/zwaan/farm-throw', { pitch: 0.8 });
    if (this.lobNo % 3 === 1) this.say(VEE_LINES.lob[Math.floor(this.lobNo / 3) % VEE_LINES.lob.length], { at: SAY_AT, ticks: 70 });
    const T = this.telegraphFor(VEE_AI.lobTell);
    for (let i = 0; i < T; i++) {
      if (this.dazed) {
        this.mode = 'cruise';
        return;
      }
      tr.seen++;
      yield 1;
    }
    const w = nearestWagon(this.world, this.x, this.y);
    if (!w || this.dazed) {
      this.setFarm('stand');
      this.mode = 'cruise';
      return;
    }
    tr.fire = this.world.tick;
    tr.lane = nearestLane(w.y);
    this.mode = 'lob';
    this.setFarm('throw');
    const ticks = VEE_AI.lobTicks;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const x0 = this.x + VEE.farmhand[0] - 8;
    const landX = w.x + w.vx * ticks + VEE_AI.lobAhead;
    this.world.spawn(LOB_ID, x0, this.y, { kind, ty: laneY(tr.lane), ticks, vx: (landX - x0) / ticks || road, lift: -VEE.farmhand[1] + 10, arc: 24 });
    this.world.audio.sfx('ring/zwaan/farm-throw');
    yield 14;
    this.setFarm('stand');
    this.mode = 'cruise';
  }

  private setFarm(f: Farm): void {
    if (this.dazed && f !== 'duck') return;
    this.farm = f;
    this.farmT = 0;
  }

  // ------------------------------------------------------------------------------- tick

  protected override think(): void {
    super.think();
    this.farmT++;
    const gs = 3 / VEE_AI.gateTicks;
    if (this.gate < this.gateTarget) {
      this.gate = Math.min(this.gateTarget, this.gate + gs);
      if (this.gate >= 2.99) {
        dust(this.world, this.x - 30, this.y, 3);
        this.world.audio.sfx('ring/lorry-thud', { vol: 0.5 });
      }
    } else if (this.gate > this.gateTarget) this.gate = Math.max(this.gateTarget, this.gate - gs);
    if (this.state === 'fight' || this.state === 'intro') pushWagonsOut(this, this.x + (this.gate > 1.5 && !this.gateBroken ? VEE.gateFoot : 0), this.x + this.length, this.touched);
  }

  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.state === 'fight' && (part === 0 || part === 3)) {
      if (this.world.tick % 6 === 0) this.world.audio.sfx('ring/dent', { vol: 0.4, pitch: 0.9 });
      bodySpark(this.world, this.partRect(this.parts[part]), this.y, d.dirX);
    }
    return hit;
  }

  protected override onPartBroken(p: BossPart): void {
    const w = this.world;
    const road = ringOf(w)?.roadSpeed ?? 0;
    if (p.index === P_GATE) {
      this.gateBroken = true;
      this.gate = this.gateTarget = 0;
      tumbleOff(w, this.x - 4, this.y + 2, { sprite: VEE_SPR.gateFall, vx: road * 0.6, vy: 1, lift: 26, vlift: 2.2, bounces: 1, rest: 40, restFrame: 2, tpf: 4, shadowW: 30, z: 33, landSfx: 'ring/lorry-thud' });
      w.audio.sfx('ring/zwaan/gate', { pitch: 0.7 });
      w.audio.sfx('ring/zwaan/moo');
    } else if (p.index === P_HATCH) {
      this.dazed = true;
      this.farm = 'duck';
      this.farmT = 0;
      this.say(VEE_LINES.dazed, { at: SAY_AT, ticks: 110 });
      for (let i = 0; i < 4; i++) hitSpark(w, this.x + VEE.hatch[0] + i * 5, this.y + VEE.box.top - 2, i % 2 ? 1 : -1);
    }
    this.checkPhases();
  }

  protected override cutAttack(): boolean {
    this.resetAttack();
    return true;
  }

  /** End a running attack's look (a stagger, a new phase). */
  resetAttack(): void {
    this.mode = 'cruise';
    this.brakeT = 0;
    if (!this.gateBroken) this.gateTarget = 0;
    if (!this.dazed) this.setFarm('stand');
  }

  // ------------------------------------------------------------------------------- beaten

  protected override *beatenSequence(): ScriptGen {
    const w = this.world;
    const B = ZWAAN.beaten;
    this.mode = 'cruise';
    this.dazed = true;
    this.farm = 'duck';
    w.audio.sfx('ring/lorry-screech');
    for (let t = 0; t < B.uncouple; t++) {
      this.beatenMove(0);
      uncoupleFx(w, this.frontX, this.y, t);
      yield 1;
    }
    this.beaten = 'brake';
    this.brakeT = 9999;
    if (!this.gateBroken) this.gateTarget = 3;
    for (let t = 0; t < B.brake; t++) {
      this.beatenMove((B.brakeRel * t) / B.brake);
      this.gateStep();
      if (t % 4 === 0) dust(w, this.x + 30, this.y, 2);
      yield 1;
    }
    this.beaten = 'swerve';
    const y0 = this.y;
    const y1 = SHOULDER_TOP + 2;
    for (let t = 0; t < B.swerve; t++) {
      const k = (t + 1) / B.swerve;
      this.y = y0 + (y1 - y0) * (k * k * (3 - 2 * k));
      this.beatenMove(B.brakeRel);
      this.gateStep();
      yield 1;
    }
    // It stops on the shoulder (no blast): the animals wander out, unhurt.
    this.beaten = 'tip';
    w.audio.sfx('ring/lorry-brake');
    dust(w, this.x + 20, this.y, 6);
    this.dropItem();
    const road = ringOf(w)?.roadSpeed ?? 0;
    // They come out of the side door along the trailer (the far end is on screen longest).
    for (let i = 0; i < 3; i++) {
      const e = w.spawn(i % 2 === 0 ? COW_ID : PIG_ID, this.x + 50 + i * 40, this.y - 2, { mode: 'wander', look: this.look++ });
      e.vx = road * 0.2;
      this.released++;
    }
    w.audio.sfx('ring/zwaan/moo');
    for (let t = 0; t < B.tip; t++) {
      this.beatenMove(-road);
      yield 1;
    }
    this.beaten = 'wreck';
    for (let t = 0; t < B.maxTicks && this.x + this.length > this.world.camera.x - 8; t++) {
      this.beatenMove(-road);
      yield 1;
    }
  }

  private gateStep(): void {
    const gs = 3 / VEE_AI.gateTicks;
    if (this.gate < this.gateTarget) this.gate = Math.min(this.gateTarget, this.gate + gs);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    drawVee(r, this, this.x, this.y, this.world.tick);
  }
}

interface VeeLook {
  readonly gate: number;
  readonly gateBroken: boolean;
  readonly farm: Farm;
  readonly farmT: number;
  readonly liftKind: 'bale' | 'churn';
  readonly dazed: boolean;
  readonly damageState: number;
  readonly brakeT: number;
  readonly staggerTicks: number;
  readonly parts: readonly BossPart[];
  readonly beaten: string | null;
}

const WAITING: VeeLook = { gate: 0, gateBroken: false, farm: 'stand', farmT: 0, liftKind: 'bale', dazed: false, damageState: 0, brakeT: 0, staggerTicks: 0, parts: [], beaten: null };

/** Draw the livestock trailer with its rear at world (x0, y0) (the live part and the waiting decor). */
export function drawVee(r: Renderer, a: VeeLook, x0: number, y0: number, tick: number): void {
  const sh = a.staggerTicks > 0 && Math.floor(tick / 2) % 2 === 0 ? 1 : 0;
  const x = Math.round(x0) + sh;
  const y = Math.round(y0);
  const fl = (i: number): boolean => (a.parts[i]?.flash ?? 0) > 0 && tick % 2 === 0;
  const L = VEE.length;
  drawZwaanShadow(r, x, y, L);
  drawZwaanDolly(r, x + L, y, x0);
  drawOpts.flipX = false;
  // The big body never flashes white (it reads as a glitch): the hits clang.
  drawOpts.flash = false;
  r.sprite(VEE_SPR.body(Math.max(0, Math.min(2, a.damageState))), 0, x, y, drawOpts);
  // The farmhand (from the hip up, facing back), then the hatch over his waist.
  drawOpts.flash = fl(P_HATCH);
  drawOpts.flipX = true;
  const [fx, fy] = VEE.farmhand;
  let id: string;
  let f: number;
  switch (a.farm) {
    case 'lift':
      id = VEE_SPR.farmhand(a.liftKind === 'churn' ? 'lift-churn' : 'lift');
      f = Math.min(2, Math.floor(a.farmT / 8));
      break;
    case 'throw':
      id = VEE_SPR.farmhand('throw');
      f = Math.min(1, Math.floor(a.farmT / 6));
      break;
    case 'duck':
      id = VEE_SPR.farmhand('duck');
      f = Math.floor(tick / 24) % 2;
      break;
    default:
      id = VEE_SPR.farmhand('stand');
      f = Math.floor(tick / 30) % 2;
  }
  r.sprite(id, f, x + fx, y + fy, drawOpts);
  drawOpts.flipX = false;
  r.sprite(VEE_SPR.hatch, a.dazed ? 1 : 0, x, y, drawOpts);
  // The gate.
  drawOpts.flash = fl(P_GATE);
  if (!a.gateBroken) r.sprite(VEE_SPR.gate, Math.min(3, Math.round(a.gate)), x, y, drawOpts);
  drawOpts.flash = false;
  drawZwaanWheels(r, x, y, VEE.wheels, x0);
  drawZwaanCoupling(r, x + L, y, a.beaten !== null);
  drawZwaanHitch(r, x, y);
  drawOpts.flipX = false;
  drawOpts.flash = false;
  if (a.brakeT > 0 && tick % 30 < 26) r.sprite(VEE_SPR.lamps, 0, x + VEE.lampAt[0], y + VEE.lampAt[1], drawOpts);
}

defineEntity(VEE_ID, (w, x, y, p) => new VeePart(w, x, y, p ?? NO_PARAMS), {
  category: 'boss',
  score: VEE_AI.score,
  description: 'ZWAAN VEETRANSPORT (the ZWAAN train, part 4): the gate drops and cows and pigs trot back across the lanes (never hurt); the farmhand lobs hay bales and milk churns (params hp, hpScale, lane, rate, index).',
});
defineZwaanPart(VEE_ID, {
  length: VEE.length,
  drawWaiting: (r, x, y, tick) => drawVee(r, WAITING, x, y, tick),
});
defineRingArt(VEE_ID, [`${VEE_ART}/`, ZWAAN_KIT_ART]);
