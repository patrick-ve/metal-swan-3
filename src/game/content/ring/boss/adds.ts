/**
 * The adds of the ring's test boss (docs/design/ring.md §6): the cargo it throws out of its rear
 * door (`ring-barrel`: a steel drum or a wooden crate) and the forklift that drives out of its open
 * side (`ring-forklift`). Both stand on the plane (x = road distance, y = the lane's feet line),
 * hurt and are hurt through depth slabs, and run inertly in a plain world (`ringOf(world)` null).
 *
 * - `ring-barrel` (`RingCargo`): thrown from the door it arcs over everything into its lane (its
 *   shadow runs to the spot: it hurts nothing in the air), lands with a bounce and rolls / tumbles
 *   back along that lane (`rel` px/tick on screen). A wagon whose slab it reaches pays 1 cell (a
 *   thrown object; a swerving wagon dodges it) and it bursts; a civilian car stops it (it bursts).
 *   Shot (on the road): it breaks (100 points); a crate may hold an item (`drop` → a `ring-crate`).
 *   Params: `kind` ('barrel' | 'crate'), `ty` (its lane's plane y; default its spawn y), `ticks`
 *   (flight; 0 = it starts on the road), `lift` (start height), `vx` (world speed in flight),
 *   `arc` (extra height), `rel` (rolling screen speed, default −2), `drop` (a drop value).
 * - `ring-forklift` (`RingForklift`, an `Enemy`, `body: false`): spawned in the lorry's hold
 *   (`lorry` param) it drives down the dropped side panel onto the road, then seeks a spot ahead
 *   of the nearest wagon in that wagon's lane and CHARGES back along the lane: the tell
 *   (`mode` 'tell-charge', the sim's fairness watch reads it; ≥ 18
 *   ticks, only on screen, with an attack token: the forks rise, the amber beacon flashes, the
 *   reverse beeper) → the charge (3.4 px/tick on screen, forks first; a wagon it reaches pays 2
 *   cells, a ram, and is shoved back) → it brakes at the left edge, backs up to its spot, again.
 *   Own HP (`big`: × difficulty × co-op). Death: the driver tumbles onto the hard shoulder
 *   (bloodless), the machine tips onto its forks. Gloat: forks down, a frikandel (no pointing, no
 *   laughing); cower. When its lorry is gone it drives off ahead (no score). Params: `lorry`, `hp`,
 *   `drop`.
 */
import { type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { awardScore } from '../../../events';
import { debris, dust, explosion, hitSpark } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, RingEntity, slabBoxes, slabCache, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { clampLane, LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { drivenWagons, nearestWagon, slabsTouch, tumbleOff, wagonSlab } from '../traffic/road-kit';
import { CARGO, CARGO_ID, FORK, FORKLIFT_ID, LORRY, LORRY_ART, SPR } from './geometry';

const NO_BOXES: readonly Rect[] = [];
const drawOpts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// Cargo
// ---------------------------------------------------------------------------------------------

export type CargoKind = 'barrel' | 'crate';

/** Tuning of the cargo (px, ticks, px/tick). */
export const CARGO_AI = {
  hp: { barrel: 20, crate: 12 },
  score: 100,
  /** Rolling screen speed (back along the lane). */
  rel: -2,
  /** Armour a wagon pays when it reaches one (a thrown object). */
  cost: 1,
} as const;

export class RingCargo extends RingEntity implements RingDrawable {
  readonly kind: CargoKind;
  /** The plane y it lands on (its lane's feet line). */
  readonly ty: number;
  /** Flight ticks (0: on the road from the start). */
  readonly flight: number;
  readonly rel: number;
  readonly drop: string | null;
  /** Ticks since the spawn, distance rolled (the frame). */
  t = 0;
  rolled = 0;
  private readonly y0: number;
  private readonly lift0: number;
  private readonly arc: number;
  private readonly flyVx: number;
  private vlift = 0;
  private readonly slab = slabCache();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.kind = p.kind === 'crate' ? 'crate' : 'barrel';
    this.ty = laneY(nearestLane(paramNum(p, 'ty', y)));
    this.flight = Math.max(0, Math.round(paramNum(p, 'ticks', 0)));
    this.lift = this.lift0 = Math.max(0, paramNum(p, 'lift', 0));
    this.arc = paramNum(p, 'arc', 12);
    this.flyVx = paramNum(p, 'vx', ringOf(world)?.roadSpeed ?? 0);
    this.rel = paramNum(p, 'rel', CARGO_AI.rel);
    this.drop = typeof p.drop === 'string' ? p.drop : null;
    this.y0 = y;
    if (this.flight === 0) {
      this.y = this.ty;
      this.lift = 0;
    }
    this.team = 'enemy';
    this.hp = this.maxHp = CARGO_AI.hp[this.kind];
    this.z = 34;
    this.shadowW = this.kind === 'barrel' ? 12 : 13;
    this.hitbox = { x: -CARGO.half, y: -14, w: CARGO.half * 2, h: 14 };
    this.despawnMargin = 64;
    this.addTag(CARGO_ID, 'ring-cargo', 'shootable');
  }

  /** In the air (it hurts nothing and cannot be hit). */
  get flying(): boolean {
    return this.t < this.flight;
  }

  /** Where and when it lands (the bot reads them, as a bottle's): plane y, world x, ticks left. */
  get landY(): number {
    return this.ty;
  }

  get landX(): number {
    return this.x + this.flyVx * Math.max(0, this.flight - this.t);
  }

  get ticksLeft(): number {
    return Math.max(0, this.flight - this.t);
  }

  override hurtboxes(): readonly Rect[] {
    return this.flying || this.dead ? NO_BOXES : slabBoxes(this, this.slab);
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    this.t++;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    if (this.t <= this.flight) {
      const k = this.t / this.flight;
      this.vx = this.flyVx;
      this.x += this.vx;
      this.y = this.y0 + (this.ty - this.y0) * k;
      this.lift = Math.max(0, this.lift0 * (1 - k) + Math.sin(k * Math.PI) * this.arc);
      if (this.t === this.flight) this.land();
      return;
    }
    // On the road: it rolls back along its lane, with a small bounce after the landing.
    this.vx = road + this.rel;
    this.x += this.vx;
    this.rolled += Math.abs(this.rel);
    if (this.lift > 0 || this.vlift > 0) {
      this.vlift -= 0.3;
      this.lift = Math.max(0, this.lift + this.vlift);
      if (this.lift === 0) this.vlift = 0;
    }
    if (this.lift < 4) this.touch();
    if (this.removed) return;
    const cam = this.world.camera;
    if (this.x < cam.x - 24) this.remove();
  }

  private land(): void {
    this.y = this.ty;
    this.lift = 0;
    this.vlift = this.kind === 'barrel' ? 1.6 : 1.1;
    dust(this.world, this.x, this.y, 3);
    this.world.audio.sfx(this.kind === 'barrel' ? 'ring/lorry-roll' : 'ring/lorry-thud');
  }

  /** A wagon or a civilian car in its slab. */
  private touch(): void {
    const mine = this.hurtboxes()[0];
    if (!mine) return;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.swerveT > 0 || !slabsTouch(wagonSlab(w), mine)) continue;
      w.bump({ dx: -0.8, cost: CARGO_AI.cost, source: this });
      this.burst(-1);
      return;
    }
    const cars = this.world.byTag('ring-car');
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.alive || Math.abs(c.y - this.y) > 8) continue;
      const x0 = c.x + c.hitbox.x;
      if (this.x > x0 - 2 && this.x < x0 + c.hitbox.w + 2) {
        this.burst(-1);
        return;
      }
    }
  }

  override onHit(d: Damage): boolean {
    if (this.flying || this.dead || this.removed) return false;
    this.hp -= d.amount;
    this.flashTicks = 4;
    if (this.hp <= 0) {
      this.dead = true;
      awardScore(this.world, d.owner, CARGO_AI.score, this.x, this.y - 16);
      this.burst(d.owner ?? -1);
    }
    return true;
  }

  /** It breaks: debris, a sound; a shot crate drops its item. */
  burst(owner: number): void {
    if (this.removed) return;
    const w = this.world;
    const cy = this.y - 7 - this.lift;
    if (this.kind === 'barrel') {
      debris(w, this.x, cy, 'metal', 6);
      hitSpark(w, this.x, cy, -1);
      w.audio.sfx('ring/lorry-barrel');
    } else {
      debris(w, this.x, cy, 'wood', 8);
      w.audio.sfx('ring/lorry-crate');
    }
    if (owner >= 0 && this.drop && this.kind === 'crate') {
      w.spawn(RING_ENTITY.crate, this.x, this.y, { contains: this.drop, dropped: true, vx: (ringOf(w)?.roadSpeed ?? 0) * 0.5, lift: 8, vlift: 2.2 });
    }
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = this.flashTicks > 0;
    if (this.kind === 'barrel') {
      const f = this.flying ? Math.floor(this.t / 3) & 7 : Math.floor(this.rolled / 3) & 7;
      r.sprite(SPR.barrel, f, Math.round(this.x), Math.round(this.y - CARGO.barrelR - this.lift), drawOpts);
    } else {
      const f = this.flying ? Math.floor(this.t / 4) & 3 : Math.floor(this.rolled / 5) & 3;
      r.sprite(SPR.crate, f, Math.round(this.x), Math.round(this.y - CARGO.crate.h / 2 - 0.5 - this.lift), drawOpts);
    }
  }
}

defineEntity(CARGO_ID, (w, x, y, p) => new RingCargo(w, x, y, p), {
  category: 'enemy',
  score: CARGO_AI.score,
  description: "The test lorry's cargo: a drum or a crate thrown into a lane; it rolls back along it, 1 cell to a wagon it reaches (params kind, ty, ticks, lift, vx, arc, rel, drop).",
});

// ---------------------------------------------------------------------------------------------
// The forklift
// ---------------------------------------------------------------------------------------------

export type ForkMode = 'out' | 'seek' | 'tell-charge' | 'charge' | 'brake' | 'return' | 'leave';

/** Tuning of the forklift (ticks, px, px/tick). */
export const FORKLIFT_AI = {
  hp: 160,
  score: 500,
  /** Telegraph base (scaled by difficulty, never below 18). */
  tell: 30,
  /** Down the ramp out of the hold. */
  outTicks: 44,
  /** Screen speeds: the charge (back along the lane), backing up, seeking. */
  chargeRel: -3.4,
  returnRel: 1.3,
  seekRel: 1.4,
  /** Lane change speed. */
  laneSpeed: 0.6,
  /** Its spot: this far ahead of the target wagon on screen, inside the screen band. */
  ahead: 150,
  minX: 200,
  maxX: 336,
  /** The charge ends here (screen x of its middle). */
  endX: 26,
  /** Pause between charges (× the difficulty's fire interval) and the first one. */
  every: 120,
  jitter: 30,
  first: 30,
  brakeTicks: 18,
  /** Armour a wagon pays when the charge reaches it (a ram). */
  ramCost: 2,
  /** The middle must be this far inside the view for a tell (its forks and the beacon on screen). */
  inset: 26,
} as const;

/** A lorry the forklift belongs to (duck-typed: lorry.ts). */
export interface ForkHome {
  x: number;
  y: number;
  vx: number;
  readonly alive: boolean;
  readonly dead: boolean;
}

export class RingForklift extends Enemy implements RingDrawable {
  mode: ForkMode = 'seek';
  modeT = 0;
  lift = 0;
  shadowW = 36;
  /** The attack token is held (fairness watcher). */
  holdsToken = false;
  laneTarget: number;
  readonly home: ForkHome | null;
  private cool: number = FORKLIFT_AI.first;
  private prey: Wagon | null = null;
  private outY0 = 0;
  private rel = 0;
  private wheel = 0;
  private readonly slab = slabCache();
  private bumpT = -999;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: `${LORRY_ART}/forklift`, hp: FORKLIFT_AI.hp, body: false, w: FORK.len, h: 38, soft: false, big: true, score: FORKLIFT_AI.score });
    const home = p.lorry as ForkHome | undefined;
    this.home = home && typeof home === 'object' && typeof home.x === 'number' ? home : null;
    this.hitbox = { ...FORK.box };
    this.facing = -1;
    this.z = 32;
    this.despawnMargin = 96;
    this.laneTarget = nearestLane(y);
    if (this.home) {
      this.mode = 'out';
      this.lift = LORRY.deck;
      this.outY0 = y;
    } else this.y = laneY(this.laneTarget);
    this.addTag(FORKLIFT_ID);
    this.play('drive');
  }

  override hurtboxes(): readonly Rect[] {
    return this.dead ? NO_BOXES : slabBoxes(this, this.slab);
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  private setMode(m: ForkMode): void {
    this.mode = m;
    this.modeT = 0;
    this.play(m === 'tell-charge' ? 'tell' : m === 'charge' ? 'charge' : 'drive', { restart: m === 'tell-charge' });
  }

  /** Its middle on screen (px). */
  get screenX(): number {
    return this.x - this.world.camera.x;
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    this.modeT++;
    this.facing = -1;
    const ring = ringOf(this.world);
    const road = ring?.roadSpeed ?? 0;
    const cam = this.world.camera;
    const sx = this.x - cam.x;
    this.prey = nearestWagon(this.world, this.x, this.y);
    if (this.home && this.mode !== 'out' && this.mode !== 'leave' && (!this.home.alive || this.home.dead)) this.setMode('leave');
    switch (this.mode) {
      case 'out':
        this.driveOut();
        return;
      case 'seek':
        this.seek(sx);
        break;
      case 'tell-charge':
        this.rel = 0;
        if (!this.prey || !cam.containsPoint(this.x, this.y - 12, -(FORKLIFT_AI.inset - 6))) this.endAttack(30);
        else if (this.modeT >= telegraphTicks(this.world, FORKLIFT_AI.tell)) {
          this.setMode('charge');
          this.world.audio.sfx('ring/forklift-whine', { pitch: 1.3 });
        }
        break;
      case 'charge':
        this.rel = FORKLIFT_AI.chargeRel;
        if (sx <= FORKLIFT_AI.endX || this.carAhead(6)) this.brake();
        break;
      case 'brake':
        this.rel *= 0.8;
        if (this.modeT % 4 === 0) dust(this.world, this.x + 14, this.y, 1);
        if (this.modeT >= FORKLIFT_AI.brakeTicks) {
          this.endAttack();
          this.setMode('return');
        }
        break;
      case 'return': {
        const spot = this.spotX();
        this.rel = FORKLIFT_AI.returnRel;
        if (sx >= spot - 6 || sx > cam.w - 40 || this.carAhead(-6)) this.setMode('seek');
        break;
      }
      case 'leave':
        this.rel = 3;
        if (sx > cam.w + 60) this.remove();
        break;
    }
    this.vx = road + this.rel;
    this.x += this.vx;
    this.wheel += Math.abs(this.rel) + 0.2;
    this.steerLane(ring?.lanesOpenAt(this.x) ?? LANE_COUNT);
    this.touchWagons();
  }

  /** Down the ramp from the hold: it follows the lorry, drops the deck height and comes toward the camera. */
  private driveOut(): void {
    const h = this.home;
    const T = FORKLIFT_AI.outTicks;
    const k = Math.min(1, this.modeT / T);
    if (h) {
      this.vx = h.vx;
      this.x += this.vx - 0.15;
      this.outY0 = h.y;
    }
    this.lift = LORRY.deck * (1 - k) * (k < 0.25 ? 1 : 1 - (k - 0.25) * 0.2);
    this.y = this.outY0 + 13 * k;
    this.wheel += 0.6;
    if (this.modeT >= T) {
      this.lift = 0;
      const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
      this.laneTarget = clampLane(nearestLane(this.outY0) + 1, open);
      this.setMode('seek');
      this.world.audio.sfx('ring/lorry-thud');
      dust(this.world, this.x, this.y, 4);
    }
  }

  /** The spot it holds before a charge: ahead of the target wagon, inside the screen band. */
  private spotX(): number {
    const t = this.prey;
    const tx = t ? t.x - this.world.camera.x + FORKLIFT_AI.ahead : 280;
    return Math.max(FORKLIFT_AI.minX, Math.min(FORKLIFT_AI.maxX, tx));
  }

  private seek(sx: number): void {
    const t = this.prey;
    const spot = this.spotX();
    this.rel = Math.max(-FORKLIFT_AI.seekRel, Math.min(FORKLIFT_AI.seekRel, (spot - sx) * 0.03));
    if (t) {
      const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
      const want = nearestLane(t.y, 1, open);
      if (want !== this.laneTarget && !this.laneBlocked(want)) this.laneTarget = want;
    }
    if (--this.cool > 0 || !t || this.reacting) return;
    // In the target's lane, ahead of it, fully on screen, a token: the tell.
    const inLane = Math.abs(this.y - laneY(this.laneTarget)) < 1 && Math.abs(t.y - this.y) < 6;
    if (!inLane || t.x > this.x - 60 || !this.world.camera.containsPoint(this.x, this.y - 12, -FORKLIFT_AI.inset)) {
      this.cool = 10;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 20;
      return;
    }
    this.holdsToken = true;
    this.setMode('tell-charge');
    this.world.audio.sfx('ring/forklift-beep');
  }

  /** Something in a lane beside it (a car, the lorry, another road blocker). */
  private laneBlocked(lane: number): boolean {
    const y = laneY(lane);
    for (const tag of BLOCK_TAGS) {
      const list = this.world.byTag(tag);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === this || !e.alive || Math.abs(e.y - y) > 9) continue;
        const x0 = e.facing < 0 ? e.x - e.hitbox.x - e.hitbox.w : e.x + e.hitbox.x;
        if (this.x + 26 > x0 && this.x - 26 < x0 + e.hitbox.w) return true;
      }
    }
    return false;
  }

  /** A car in its lane just ahead in the direction it moves (dir < 0: to its left). */
  private carAhead(gap: number): boolean {
    const cars = this.world.byTag('ring-car');
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.alive || Math.abs(c.y - this.y) > 8) continue;
      const x0 = c.x + c.hitbox.x;
      const x1 = x0 + c.hitbox.w;
      if (gap > 0 ? x1 > this.x - 22 - gap && x1 < this.x : x0 < this.x + 24 - gap && x0 > this.x) return true;
    }
    return false;
  }

  private steerLane(open: number): void {
    this.laneTarget = clampLane(this.laneTarget, open);
    if (this.mode === 'tell-charge' || this.mode === 'charge' || this.mode === 'brake') return;
    const dy = laneY(this.laneTarget) - this.y;
    const s = FORKLIFT_AI.laneSpeed;
    this.y += Math.abs(dy) <= s ? dy : Math.sign(dy) * s;
  }

  private brake(): void {
    this.setMode('brake');
    this.world.audio.sfx('ring/wagon-screech', { vol: 0.5, pitch: 1.4 });
  }

  /** The charge reaches a wagon: a ram (2 cells), the wagon shoved back; any other touch: a light push. */
  private touchWagons(): void {
    if (this.lift > 4) return;
    const mine = this.hurtboxes()[0];
    if (!mine) return;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!slabsTouch(wagonSlab(w), mine)) continue;
      if (this.mode === 'charge') {
        if (w.swerveT > 0) continue;
        w.bump({ dx: -2.6, cost: FORKLIFT_AI.ramCost, source: this });
        this.world.audio.sfx('ring/crash');
        hitSpark(this.world, this.x - 20, this.y - 10, -1);
        this.brake();
        return;
      }
      if (this.world.tick - this.bumpT >= 30) {
        this.bumpT = this.world.tick;
        w.bump({ dx: w.x < this.x ? -1 : 1, cost: 0, source: this });
      }
    }
  }

  /** Its lorry is gone: it drives off ahead (no score). */
  setLeave(): void {
    if (this.dead || this.mode === 'leave') return;
    this.endAttack(999);
    this.lift = 0;
    this.setMode('leave');
  }

  private endAttack(cool?: number): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.cool = cool ?? this.fireInterval(FORKLIFT_AI.every, FORKLIFT_AI.jitter);
    if (this.mode === 'tell-charge') this.setMode('seek');
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(_kind: ReactionKind): void {
    if (this.mode === 'tell-charge') this.endAttack(40);
    else if (this.mode === 'charge') this.brake();
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'gloat') super.thinkReaction(kind);
    else this.play(this.reactionAnim(kind));
    this.facing = -1;
    // Hold its place on screen (the road holds while everyone is out).
    this.vx = ringOf(this.world)?.roadSpeed ?? 0;
    this.x += this.vx;
    if (this.mode === 'out') {
      this.lift = 0;
      this.mode = 'seek';
    }
  }

  /** The gloat: forks down, a frikandel (a snack break; no pointing, no laughing). */
  protected override thinkGloat(): void {
    this.play(this.reactionAnim('gloat'));
  }

  // ------------------------------------------------------------------------------- death

  /** Bloodless: the driver tumbles onto the hard shoulder, the machine tips onto its forks. */
  protected override onDeath(d: Damage): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const dir = d.dirX || 1;
    tumbleOff(this.world, this.x - 4, this.y, {
      sprite: SPR.forklift('driver-tumble'),
      restSprite: SPR.forklift('driver-sit'),
      vx: road * 0.5 + dir * 0.8,
      vy: Math.max(0.6, (SHOULDER_TOP + 5 - this.y) / 28),
      lift: 18 + this.lift,
      vlift: 2.4,
      bounces: 1,
      rest: 80,
      tpf: 4,
      shoulder: true,
      shadowW: 14,
      z: 34,
    });
    tumbleOff(this.world, this.x, this.y, { sprite: SPR.forklift('down'), vx: road * 0.6, vy: 0, lift: this.lift, vlift: 0.6, bounces: 0, rest: 60, restFrame: 2, tpf: 6, shadowW: 34, z: 31, flipX: true });
    explosion(this.world, this.x, this.y - 12 - this.lift, 's', { silent: true });
    debris(this.world, this.x, this.y - 10, 'metal', 6);
    this.world.audio.sfx('ring/lorry-thud');
    this.remove();
  }

  /** The drop falls as a ring crate. */
  protected override dropItem(): void {
    const spec = this.drop;
    if (!spec) return;
    this.drop = null;
    const value = spec.id === 'loot' ? spec.params?.contains ?? 'auto' : spec.id === RING_ENTITY.crate ? spec.params?.contains : spec;
    this.world.spawn(RING_ENTITY.crate, this.x, this.y, { contains: value, dropped: true, vx: (ringOf(this.world)?.roadSpeed ?? 0) * 0.5, lift: 12, vlift: 2.4 });
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0;
    // The drive strip turns its wheels with the distance it covers.
    const f = this.mode === 'tell-charge' || this.reacting ? this.anim.index : this.playing('drive') ? Math.floor(this.wheel / 3) & 3 : this.anim.index;
    r.sprite(this.anim.id, f, x, y, drawOpts);
    // The amber beacon: it flashes in the tell and the charge.
    const lit = (this.mode === 'tell-charge' || this.mode === 'charge') && Math.floor(this.modeT / 4) % 2 === 0;
    const bx = x + (this.facing < 0 ? -FORK.beacon[0] : FORK.beacon[0]);
    drawOpts.flash = false;
    r.sprite(SPR.forklift('beacon'), lit ? 1 : 0, bx, y + FORK.beacon[1], drawOpts);
    if (this.mode === 'tell-charge') {
      const T = telegraphTicks(this.world, FORKLIFT_AI.tell);
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) this.drawTint(r, 0xff6040ff, 0.3);
    }
  }
}

/** What blocks a lane beside the forklift. */
const BLOCK_TAGS: readonly string[] = ['ring-car', 'ring-block', 'ring-closure'];

defineEntity(FORKLIFT_ID, (w, x, y, p) => new RingForklift(w, x, y, p), {
  category: 'enemy',
  score: FORKLIFT_AI.score,
  description: "The test lorry's forklift: down the side ramp onto the road, then it charges back along a wagon's lane after a tell (params lorry, hp, drop).",
});

