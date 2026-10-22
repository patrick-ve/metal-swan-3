/**
 * `ZwaanPart` — the base class of every part of the ZWAAN train (docs/design/ring.md §R.3; the
 * contract: api.ts). A `Boss` on the ring plane with working defaults, so a part only adds its own
 * parts, phases, attacks and art:
 *
 * - the anchor: `x` = the part's REAR end, `length` px forward its FRONT (the coupling); `y` = the
 *   plane y of its lane (1 | 2; `ring-block`); `hitbox` = the visual box (bubbles, on-screen tests);
 * - the pace (`keepPace`, from `think`): the road speed plus a pull to the controller's anchor (the
 *   active part's rear near screen x 150), so it stays on screen while the road scrolls;
 * - the intro: invulnerable until the controller's entry / catch-up is over (`train.ready`), then
 *   'ringTrainPart' `start` and the fight (its first phase);
 * - the damage-rate bucket (`ZWAAN.rate`, like the lorry's: at most `perTick` HP per tick from a
 *   bucket of `burst`, both × difficulty × co-op; param `rate` 0 = no limit, for tests);
 * - the beaten sequence (`beatenSequence`, the default): uncouple (sparks at the coupling) → brake →
 *   swerve onto the hard shoulder → tip (a blast, the drop: `dropItem`) → drop back off the left
 *   edge as a wreck; then 'bossDefeated' (tagged `ring-zwaan-part`: the ring ignores it) and removal;
 * - the pips for the HUD (`barPips`, read by hud.ts `drawBossBar`);
 * - drawing: every part draws its own sprites; the base `draw` is a minimal 1× box (no sprites).
 *
 * Params: `hp` (base HP), `hpScale` (tests: × the HP), `lane` (1 | 2), `rate` (HP per tick of the
 * base HP; 0 = no limit), `index` (its place in the order; the controller sets `train`/`index`).
 */
import type { Damage } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { Boss, type BossPart } from '../../../boss';
import { sessionOf } from '../../../context';
import { awardScore } from '../../../events';
import { dust, explosion, smokeTrail } from '../../../fx';
import type { BossBarPips } from '../../../hud';
import { NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { DEPTH_HALF, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { drivenWagons } from '../traffic/road-kit';
import { RING_ZWAAN_PART_TAG, ZWAAN, type ZwaanPartHandle, type ZwaanTrain } from './api';
import { drawZwaanShadow, uncoupleFx, ZWAAN_SFX } from './kit';

export interface ZwaanPartOpts {
  /** Sprite prefix (`zwaanArt(id)`: `boss/ring-zwaan/<part>`). */
  art: string;
  /** The bar name (api.ts `ZWAAN_NAMES`). */
  name: string;
  /** Base HP (× difficulty × co-op; param `hp` wins). */
  hp: number;
  /** Points for the part (2,000 a trailer, 10,000 the cab). */
  score: number;
  /** Length rear → front (px). */
  length: number;
  /** Visual height above the road (px; default 62). */
  height?: number;
  /**
   * The damage rate (HP per tick of the base HP; default `ZWAAN.rate.perTick`; the param `rate`
   * wins). TRAIN-1, additive: the kit's `zwaanRate(hp)` is the train's tuned value.
   */
  rate?: number;
}

/** A depth slab over [x0, x1) of a part (relative to its rear anchor): a part box for `addPart`. */
export function zwaanSlab(x0: number, x1: number): Rect {
  return { x: x0, y: -DEPTH_HALF, w: x1 - x0, h: DEPTH_HALF * 2 };
}

const NO_BOXES: readonly Rect[] = [];

export class ZwaanPart extends Boss implements RingDrawable, ZwaanPartHandle {
  /**
   * The runner's shadow pass centres a shadow on the anchor (the REAR here): 0 = none from it; the
   * part draws its own under its whole length (kit `drawZwaanShadow`; TRAIN-1, additive fix).
   */
  shadowW = 0;
  /** Length rear → front (px). */
  readonly length: number;
  readonly height: number;
  /** Its lane (1 | 2). */
  lane: number;
  /** The controller (set right after the spawn) and its index in the order. */
  train: ZwaanTrain | null = null;
  index: number;
  /** The fight began (its first phase), and the beaten sequence's state. */
  fought = false;
  /** Beaten: 'uncouple' → 'brake' → 'swerve' → 'tip' → 'wreck' (null while it lives). */
  beaten: 'uncouple' | 'brake' | 'swerve' | 'tip' | 'wreck' | null = null;
  /** Ticks into the current `beaten` step (the art reads it: the tip frames; TRAIN-1, additive). */
  beatT = 0;
  /** Brake-light ticks left (a tell or the beaten brake). */
  brakeT = 0;
  /** Ticks since the spawn. */
  protected t = 0;
  /** Wheel roll (px driven). */
  protected roll = 0;
  /** The drop of the wreck (tests). */
  dropped: string | null = null;
  /** The damage-rate bucket (HP left, refill per tick, size; refill 0 = no limit). */
  protected dmgLeft = 0;
  protected dmgRate = 0;
  protected dmgBurst = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS, o: ZwaanPartOpts) {
    super(world, x, y, p, { art: o.art, name: o.name, hp: o.hp, score: o.score });
    this.length = o.length;
    this.height = o.height ?? 62;
    this.index = Math.max(0, Math.round(paramNum(p, 'index', 0)));
    const lane = Math.max(1, Math.min(2, Math.round(paramNum(p, 'lane', Math.min(2, nearestLane(y))))));
    this.lane = lane;
    this.y = laneY(lane);
    this.facing = 1;
    const k = paramNum(p, 'hpScale', 1);
    const base = Math.max(1, Math.round(paramNum(p, 'hp', o.hp) * k));
    this.hp = this.maxHp = this.scaledHp(base);
    const scale = this.maxHp / base;
    this.dmgRate = Math.max(0, paramNum(p, 'rate', o.rate ?? ZWAAN.rate.perTick)) * scale;
    this.dmgBurst = this.dmgLeft = ZWAAN.rate.burst * scale;
    this.hitbox = { x: 0, y: -this.height, w: o.length, h: this.height };
    this.removeOnDeath = true;
    this.z = 30;
    this.addTag(RING_ZWAAN_PART_TAG, 'ring-block');
  }

  // ------------------------------------------------------------------------------- queries

  /** Its rear's screen x. */
  get screenX(): number {
    return this.x - this.world.camera.x;
  }

  get rearX(): number {
    return this.x;
  }

  get frontX(): number {
    return this.x + this.length;
  }

  /** The HUD pips under the boss bar (hud.ts reads `barPips`). */
  get barPips(): BossBarPips | null {
    return this.train ? this.train.pips : null;
  }

  // ------------------------------------------------------------------------------- the fight

  /** Invulnerable until the controller's entry / catch-up is over; then the fight. */
  override *intro(): ScriptGen {
    for (let g = 0; g < 1200; g++) {
      if (this.train && this.train.ready(this)) break;
      if (!this.train && g > 60) break;
      yield 1;
    }
    this.fought = true;
    this.world.events.emit('ringTrainPart', { part: this.type, index: this.index, phase: 'start' });
  }

  protected override think(): void {
    this.t++;
    if (this.dmgLeft < this.dmgBurst) this.dmgLeft = Math.min(this.dmgBurst, this.dmgLeft + this.dmgRate);
    if (this.brakeT > 0) this.brakeT--;
    this.keepPace();
  }

  /** Drive at the road speed with a pull to the anchor (the controller's, else screen x 150). */
  keepPace(): void {
    const ring = ringOf(this.world);
    const road = ring?.roadSpeed ?? 0;
    const target = this.train ? this.train.anchorWorldX() : this.world.camera.x + ZWAAN.anchorX;
    let rel = Math.max(-ZWAAN.maxRel, Math.min(ZWAAN.maxRel, (target - this.x) * ZWAAN.gain));
    if (this.staggerTicks > 0) rel = Math.min(rel, 0) * 0.5;
    this.vx = road + rel;
    this.x += this.vx;
    this.roll += this.vx;
  }

  /** Touching it does not hurt (the controller pushes wagons out of the train's slab). */
  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  /** The damage-rate bucket (see the header); subclasses call `super.onHit`. */
  override onHit(d: Damage, part = 0): boolean {
    const p = this.parts[part];
    if (this.state === 'fight' && !this.dead && this.invulnTicks <= 0 && p && p.enabled && !p.destroyed && !p.armored && d.amount > 0 && this.dmgRate > 0) {
      const mul = p.multiplier;
      const want = d.amount * mul;
      const room = Math.max(0, Math.min(this.hp, this.dmgLeft));
      this.dmgLeft = Math.max(0, this.dmgLeft - Math.min(want, room));
      if (want > room) d = { ...d, amount: room / mul };
    }
    return super.onHit(d, part);
  }

  // ------------------------------------------------------------------------------- beaten

  /** The death starts: the controller uncouples it (the next part, or the train's end). */
  protected override onDeathStart(): void {
    this.beaten = 'uncouple';
    this.train?.partBeaten(this);
  }

  protected override deathSequence(): ScriptGen | null {
    return this.beatenSequence();
  }

  /**
   * The default beaten sequence (see the header): uncouple → brake → swerve onto the hard
   * shoulder → tip (a blast and the drop) → drop back off the left edge. Ends with the Boss's
   * `finishDeath` ('bossDefeated', removal).
   */
  protected *beatenSequence(): ScriptGen {
    const w = this.world;
    const B = ZWAAN.beaten;
    w.audio.sfx('ring/lorry-screech');
    // Uncouple: the clank, the pin snaps, sparks at the coupling (kit `uncoupleFx`).
    this.beatT = 0;
    for (let t = 0; t < B.uncouple; t++, this.beatT++) {
      this.beatenMove(0);
      uncoupleFx(w, this.frontX, this.y, t);
      yield 1;
    }
    this.beaten = 'brake';
    this.beatT = 0;
    this.brakeT = 9999;
    for (let t = 0; t < B.brake; t++, this.beatT++) {
      this.beatenMove((B.brakeRel * t) / B.brake);
      if (t % 4 === 0) dust(w, this.x + 10, this.y, 2);
      yield 1;
    }
    // Swerve onto the hard shoulder (toward the camera).
    this.beaten = 'swerve';
    this.beatT = 0;
    const y0 = this.y;
    const y1 = SHOULDER_TOP + 2;
    for (let t = 0; t < B.swerve; t++, this.beatT++) {
      const k = (t + 1) / B.swerve;
      this.y = y0 + (y1 - y0) * (k * k * (3 - 2 * k));
      this.beatenMove(B.brakeRel);
      if (t % 6 === 0) smokeTrail(w, this.x + this.length * 0.5, this.y - this.height * 0.6, true);
      yield 1;
    }
    // Tip: a blast, the drop.
    this.beaten = 'tip';
    this.beatT = 0;
    explosion(w, this.x + this.length * 0.5, this.y - this.height * 0.5, 'm', { debris: 'metal' });
    w.camera.shake(3, 14);
    w.audio.sfx(ZWAAN_SFX.tip);
    w.audio.sfx('ring/lorry-slam');
    this.dropItem();
    for (let t = 0; t < B.tip; t++, this.beatT++) {
      this.beatenMove(B.brakeRel);
      if (t % 3 === 0) dust(w, this.x + ((t * 37) % Math.max(1, this.length)), this.y, 3);
      yield 1;
    }
    // The wreck drops back off the left edge.
    this.beaten = 'wreck';
    this.beatT = 0;
    for (let t = 0; t < B.maxTicks && this.x + this.length > this.world.camera.x - 8; t++, this.beatT++) {
      this.beatenMove(B.dropRel);
      if (t % 9 === 0) smokeTrail(w, this.x + this.length * 0.5, this.y - this.height * 0.5, true);
      yield 1;
    }
  }

  /** Move during the beaten sequence at screen speed `rel` (the road keeps scrolling). */
  protected beatenMove(rel: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.vx = Math.max(0, road + rel);
    this.x += this.vx;
    this.roll += this.vx;
  }

  /**
   * The visual middle of part `i` (world; the slabs lie on the road): default the middle of its x
   * range at half the part's height. Override for a spot of your own (TRAIN-1, additive).
   */
  partSpot(i: number): [number, number] {
    const p = this.parts[i];
    const out = this.pt2;
    out[0] = this.x + (p ? p.box.x + p.box.w / 2 : this.length / 2);
    out[1] = this.y - this.height * 0.5;
    return out;
  }

  /** A part broke: the blast at its visual spot (not on the road), +1000, the hook (TRAIN-1, additive). */
  protected override breakPart(p: BossPart, d: Damage): void {
    if (p.destroyed) return;
    p.hp = 0;
    p.destroyed = true;
    const at = this.partSpot(p.index);
    explosion(this.world, at[0], at[1], 'm', { debris: 'metal', silent: true });
    this.world.audio.sfx('boss/part-break');
    awardScore(this.world, d.owner, 1000, at[0], at[1] - 10);
    this.onPartBroken(p);
  }

  /** The middle of the visual box (the Boss default is the middle of the road slabs). */
  override center(): [number, number] {
    const out = this.pt2;
    out[0] = this.x + this.length / 2;
    out[1] = this.y - this.height * 0.5;
    return out;
  }

  /** A random point on the visual box (smoke, blasts; cosmetic rng). */
  override randomPoint(): [number, number] {
    const rng = this.world.fxRng;
    const r = rectAt(this.x, this.y, this.hitbox, false, this.visScratch);
    const out = this.pt2;
    out[0] = r.x + rng.range(0, r.w);
    out[1] = r.y + rng.range(0, r.h * 0.8);
    return out;
  }

  private readonly pt2: [number, number] = [0, 0];
  private readonly visScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };

  /** The wreck's drop: a repair for a wagon at ≤ 6 cells, else a weapon (by the part's index; no rng). */
  protected dropItem(): void {
    const w = this.world;
    let low = false;
    for (const wg of drivenWagons(w)) if (wg.cells <= 6) low = true;
    const item = low ? 'repair' : ZWAAN_DROP_WEAPONS[this.index % ZWAAN_DROP_WEAPONS.length];
    this.dropped = item;
    w.spawn(RING_ENTITY.crate, this.x + this.length * 0.5, laneY(4), { contains: item, dropped: true, vx: (ringOf(w)?.roadSpeed ?? 0) * 0.4, lift: 20, vlift: 2.6 });
  }

  // ------------------------------------------------------------------------------- drawing

  /**
   * A minimal 1× fallback (fixer, 2026-10-22: every real part draws its own sprites; this is for a
   * part without art, e.g. a test subclass): the shadow and a plain box.
   */
  override draw(r: Renderer): void {
    drawZwaanShadow(r, this.x, this.y, this.length);
    r.rect(Math.round(this.x), Math.round(this.y) - this.height, this.length, this.height, PAL.stone[2]);
  }

  /** The difficulty id of the play ('easy' | 'normal' | 'hard'). */
  protected get difficultyId(): string {
    return sessionOf(this.world).difficulty;
  }
}

/** Weapons a wreck drops by its index (no repair needed). */
export const ZWAAN_DROP_WEAPONS: readonly string[] = ['H', 'R', 'L', 'S', 'H'];
