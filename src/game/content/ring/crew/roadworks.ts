/**
 * `ring-roadworks` — the road-works crew (docs/design/ring.md §5.5; GDD §4.11 fairness).
 *
 * A slow road-works truck tows the orange-white arrow trailer of the wave-A closure (its amber
 * arrow flashes toward the open lane) in lane 4 or 3. It comes in from the right slower than the
 * traffic, crawls back through the screen while its crew works, then drops back and out of view
 * (no score when it leaves). Behind it the lane closes with cones (`RingConeLine`): the crew drops
 * one every `coneGap` px of road it covers, unless a plan closure (`ring-closure`) already closes
 * that lane there — so with the plan's road-works closure the line simply carries the closed lane
 * on up to the truck. At least one lane always stays open (the line never takes the last one).
 *
 * - THE CREW (`ring-roadworker`, up to three on the flatbed; light, 20 HP each, soft): each one
 *   lifts a cone off the stack and over his head (`tell-throw`, ≥ 18 ticks, only on screen, with an
 *   attack token), then lobs it (`throw`) into the target wagon's lane where the wagon will be
 *   (`RingConeLob`: it flies over everything; a thrown object, 1 cell to a wagon in that slab).
 *   Shot off the truck, or when the truck is wrecked, a worker tumbles onto the hard shoulder and
 *   sits there dazed (bloodless). Their hurt slab is a little deeper than the truck's (±10), so a
 *   shot that crosses into the lane at a worker's x hits him, while a shot along the lane hits the
 *   truck's tail first.
 * - THE TRUCK: `ROADWORKS.hp` (500, big: scaled by difficulty and co-op), 1,500 points; battered
 *   art at half its HP; at 0 an explosion, the crew bails, a crate (param `drop`, else the ring roll)
 *   and the wreck rolls to a stop and drifts back with the road. A wagon that drives into the truck
 *   or the wreck is held behind it (nose to tail) or sent back to its lane (alongside) and pays ½
 *   cell (1 for a hard hit: closing over `hardClose`, a swerve, a lane change into it), as at a car.
 * - The driver of the nearest wagon says `roadworks` when the truck comes into view; the beeper
 *   sounds every `beeperEvery` ticks while it is on screen.
 * - Reactions: the gloat (every player out) is the crew's coffee break (cups from the thermos, one
 *   line per hold, no pointing, no laughing); the cower: the crew ducks behind the drop side.
 *
 * Params (all optional; inert-safe with {} and in a plain world): `lane` (3 | 4: else the lane a
 * plan closure closes near it, else the spawn lane when it is 3 or 4, else 4 — 3 in a tunnel),
 * `crew` (0 … 3, default 3), `hp`, `drop`, `side` ('ahead' | 'behind': where it comes from;
 * default by its spawn x), `gang` (the director's wave number).
 */
import { damageHas, Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { debris, drawShadow, dust, explosion, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, slabBoxes, slabCache, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY, RING_ENTITY_B } from '../../../ring/ids';
import { LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { wagonBandEnd, WAGON_W } from '../../../ring/wagon';
import { BOARD_AT } from '../hazards/geometry';
import { drivenWagons, nearestWagon, RingLayer, tumbleOff, wagonSlab, type Layered } from '../traffic/road-kit';
import { TRUCK, TRUCK_FRAME, TRUCK_ID, WORKER_LOOKS, workerArt } from './geometry';

/** The worker entity id (spawned by the truck with `{ truck, slot }`). */
export const RING_ROADWORKER = 'ring-roadworker';

export type RoadworksMode = 'enter' | 'work' | 'leave' | 'wreck';
export type WorkerMode = 'idle' | 'tell-throw' | 'throw' | 'recover' | 'bail';

/** Tuning (ticks, px, px/tick). */
export const ROADWORKS = {
  hp: 500,
  score: 1500,
  /** Screen speeds: coming in, crawling back while the crew works, dropping back out. */
  enterRel: -1.6,
  workRel: -0.3,
  leaveRel: -2,
  /** It starts to work once its middle is this far into the view (screen x) … */
  workX: 300,
  /** … works this long, or until its middle is back at `leaveX`, then drops back. */
  workTicks: 220,
  leaveX: 120,
  /** Cones behind it: their spacing (px of road) and the most cones in one line. */
  coneGap: 22,
  lineMax: 40,
  /** The cones stand this far toward the open lane from the lane's feet line (as a closure's). */
  coneEdge: 6,
  /** Ticks between two beeps of the beeper while it is on screen. */
  beeperEvery: 120,
  /** A wagon that drives into it: nose-to-tail when its slab reaches this far in (px), else alongside; a hard bump (1 cell, else ½) over this closing speed (px/tick on screen). */
  noseDepth: 14,
  hardClose: 1.4,
  /** The wreck rolls to a stop (its own road speed × this per tick). */
  wreckDrag: 0.95,
  // The crew.
  workerHp: 20,
  workerScore: 200,
  /** Telegraph base (scaled by difficulty, never below 18), the attack interval and jitter, the first delay. */
  tell: 26,
  every: 170,
  jitter: 40,
  firstDelay: 60,
  /** The throw strip's release tick and its length; the recover after it. */
  release: 3,
  throwTicks: 19,
  recover: 20,
  /** The lobbed cone: flight ticks, arc height, scatter round the target's screen x. */
  coneTicks: 36,
  coneArc: 34,
  scatter: 24,
  /** The crew's hurt slab half depth (a little deeper than the truck's: they win a tie). */
  workerHalf: 10,
} as const;

/** An attack starts only with the worker's middle this far inside the view (px). */
const ATTACK_INSET = 24;
const NO_BOXES: readonly Rect[] = [];
const drawOpts: DrawOpts = {};
const layerOpts: DrawOpts = {};

/** Lanes (1 … 4) closed by `ring-closure` / cone lines at world x (other than `except`). */
function closedLanes(world: World, x: number, except: Entity | null, out: number[]): number[] {
  out.length = 0;
  const list = world.byTag(RING_ENTITY.closure);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === except || !c.alive) continue;
    const x0 = c.x + c.hitbox.x;
    if (x < x0 || x > x0 + c.hitbox.w) continue;
    const l = nearestLane(c.y);
    if (!out.includes(l)) out.push(l);
  }
  return out;
}
const closedScratch: number[] = [];

/** The road-works truck (see the header). */
export class RingRoadworks extends Enemy implements RingDrawable, Layered {
  mode: RoadworksMode = 'enter';
  modeT = 0;
  readonly lane: number;
  /** −1: the open lane is the far one (the arrow points there); +1: the near one. */
  readonly side: -1 | 1;
  lift = 0;
  shadowW = 0;
  /** The crew on the deck (null: gone). */
  readonly crew: (RingRoadworker | null)[] = [null, null, null];
  /** The cone line it lays (null before the first cone / after it stopped laying). */
  line: RingConeLine | null = null;
  private readonly crewCount: number;
  private spawned = false;
  private layer: RingLayer | null = null;
  private lastCone = NaN;
  private beepT = 30;
  private said = false;
  private readonly from: 'ahead' | 'behind';
  private readonly slab = slabCache();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: 'ring/roadworks', hp: ROADWORKS.hp, body: false, big: true, soft: false, w: TRUCK.x1 - TRUCK.x0, h: TRUCK.h, score: ROADWORKS.score });
    this.hitbox = { x: TRUCK.x0, y: -TRUCK.h, w: TRUCK.x1 - TRUCK.x0, h: TRUCK.h };
    this.lane = pickLane(world, x, y, p);
    this.y = laneY(this.lane);
    this.side = this.lane === 1 ? 1 : -1;
    this.facing = 1;
    this.z = 31;
    this.crewCount = Math.max(0, Math.min(3, Math.round(paramNum(p, 'crew', 3))));
    const cam = world.camera;
    this.from = p.side === 'behind' || (p.side !== 'ahead' && x < cam.x + cam.w / 2 && x + TRUCK.x1 < cam.x) ? 'behind' : 'ahead';
    // Spawned in view (a tool, a test): it works at once.
    if (x + TRUCK.x0 > cam.x && x + TRUCK.x1 < cam.right) this.mode = 'work';
    this.despawnMargin = Infinity;
    this.addTag(RING_ENTITY_B.roadworks, 'ring-big');
  }

  /** Screen x of its middle. */
  get sx(): number {
    return this.x - this.world.camera.x;
  }

  override hurtboxes(): readonly Rect[] {
    return this.dead ? NO_BOXES : slabBoxes(this, this.slab);
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    if (!this.spawned) this.spawnParts();
    super.update();
  }

  private spawnParts(): void {
    this.spawned = true;
    this.layer = new RingLayer(this.world, this, 0, this.y, this.z + 2);
    this.world.add(this.layer);
    for (let i = 0; i < this.crewCount; i++) {
      const slot = TRUCK.crewX.length - this.crewCount + i;
      this.crew[slot] = this.world.spawn(RING_ROADWORKER, this.x + TRUCK.crewX[slot], this.y, { truck: this, slot, look: slot }) as RingRoadworker;
    }
  }

  private setMode(m: RoadworksMode): void {
    this.mode = m;
    this.modeT = 0;
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    this.modeT++;
    this.facing = 1;
    const sx = this.sx;
    const cam = this.world.camera;
    let rel: number;
    switch (this.mode) {
      case 'enter': {
        const ahead = this.from === 'ahead';
        rel = ahead ? ROADWORKS.enterRel : -ROADWORKS.enterRel * 0.8;
        if (ahead ? sx <= ROADWORKS.workX : sx >= ROADWORKS.workX - 120) this.setMode('work');
        break;
      }
      case 'work':
        rel = ROADWORKS.workRel;
        if (this.modeT >= ROADWORKS.workTicks || sx < ROADWORKS.leaveX) this.setMode('leave');
        break;
      default:
        rel = ROADWORKS.leaveRel;
        if (this.x + TRUCK.x1 < cam.x - 24) this.leave();
        break;
    }
    this.drive(rel);
    if (this.onScreen(0)) {
      if (!this.said) {
        this.said = true;
        nearestWagon(this.world, this.x, this.y)?.say('roadworks');
      }
      if (--this.beepT <= 0) {
        this.beepT = ROADWORKS.beeperEvery;
        this.world.audio.sfx('ring/crew-beeper');
      }
    }
    this.layCones();
    this.touchWagons();
  }

  /** Motion: the road's speed plus `rel` on screen (never backwards on the road: in a jam it stops). */
  private drive(rel: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.vx = Math.max(0, road + rel);
    this.x += this.vx;
  }

  /** Gone off the left edge: no score, the crew and its line go with it. */
  private leave(): void {
    for (const w of this.crew) w?.remove();
    this.line?.stop();
    this.remove();
  }

  /** A cone every `coneGap` px of road behind the trailer (not where a closure already closes the lane). */
  private layCones(): void {
    const cx = this.x + TRUCK.coneDrop;
    if (!Number.isNaN(this.lastCone) && cx - this.lastCone < ROADWORKS.coneGap) return;
    this.lastCone = cx;
    const ring = ringOf(this.world);
    const open = ring?.lanesOpenAt(cx) ?? LANE_COUNT;
    const closed = closedLanes(this.world, cx, this.line, closedScratch);
    if (closed.includes(this.lane)) {
      // A closure closes the lane here already: a new line starts after it.
      this.line?.stop();
      this.line = null;
      return;
    }
    let free = 0;
    for (let l = 1; l <= open; l++) if (l !== this.lane && !closed.includes(l)) free++;
    if (free < 1 || this.lane > open) return;
    if (!this.line || this.line.full) {
      this.line?.stop();
      this.line = new RingConeLine(this.world, this, cx, this.lane, this.side);
      this.world.add(this.line);
    } else this.line.add(cx);
  }

  /** A wagon that drives into the truck (or the wreck) is held behind it, pays a cell, bounces out. */
  private touchWagons(): void {
    const list = drivenWagons(this.world);
    const x0 = this.x + TRUCK.x0;
    const x1 = this.x + TRUCK.x1;
    const rel = this.vx - (ringOf(this.world)?.roadSpeed ?? 0);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (Math.abs(w.y - this.y) >= 12) continue;
      const s = wagonSlab(w);
      if (s.x + s.w <= x0 || s.x >= x1) continue;
      const behind = w.x < this.x;
      const overlap = behind ? s.x + s.w - x0 : x1 - s.x;
      let close: number;
      if (behind && rel < 0 && overlap <= ROADWORKS.noseDepth && w.x <= wagonBandEnd(w)) {
        // It drops back onto a wagon at the left end of its band, which cannot give way: the wagon
        // bounces into the next lane instead of being pushed off the screen (fixer B).
        const open = ringOf(this.world)?.lanesOpenAt(w.x) ?? LANE_COUNT;
        const away = this.lane > 1 ? -1 : 1;
        w.laneTarget = Math.max(1, Math.min(open, this.lane + away));
        close = w.sideV - rel;
      } else if (overlap <= ROADWORKS.noseDepth) {
        // Nose to tail (or tail to nose): held behind (in front of) it, at its pace.
        w.x = behind ? x0 - WAGON_W / 2 - 1 : x1 + WAGON_W / 2 + 1;
        close = behind ? w.sideV - rel : rel - w.sideV;
        if (behind ? w.sideV > rel : w.sideV < rel) w.sideV = rel;
      } else {
        // Alongside (a lane change into it): back out to the lane it came from.
        const open = ringOf(this.world)?.lanesOpenAt(w.x) ?? LANE_COUNT;
        const away = w.y < this.y ? -1 : 1;
        const back = Math.max(1, Math.min(open, this.lane + away));
        w.laneTarget = back === this.lane ? Math.max(1, Math.min(open, this.lane - away)) : back;
        w.y += away * 0.8;
        close = 2;
      }
      if (w.invulnTicks <= 0) {
        // A light bump (½ cell) unless it hit hard (closing fast, a swerve, a lane change into it).
        const hard = close > ROADWORKS.hardClose || w.swerveT > 0;
        w.bump({ dx: overlap <= ROADWORKS.noseDepth ? (behind ? rel - 0.8 : rel + 0.8) : 0, cost: hard ? 1 : 0.5, source: this });
        this.world.audio.sfx(hard ? 'ring/crash' : 'ring/wagon-bump');
      }
    }
  }

  // ------------------------------------------------------------------------------- reactions

  protected override thinkReaction(_kind: ReactionKind): void {
    // The truck itself just rolls on with the road (it holds while every player is out).
    this.drive(this.mode === 'leave' ? ROADWORKS.leaveRel : 0);
    this.layCones();
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    this.setMode('wreck');
    this.contactDamage = null;
    const cx = this.x + (TRUCK.cab[0] + TRUCK.cab[1]) / 2;
    explosion(this.world, cx, this.y - 18, 'm');
    explosion(this.world, this.x - 20, this.y - 10, 's');
    debris(this.world, cx, this.y - 20, 'metal', 8);
    this.world.audio.sfx('ring/crew-wreck');
    this.world.camera.shake(3, 12);
    for (const w of this.crew) w?.bail(damageHas(d, 'ram') ? 1.4 : 1);
    this.line?.stop();
  }

  /** The drop falls off the deck as a ring crate (param `drop`, else the ring roll). */
  protected override dropItem(): void {
    const spec = this.drop;
    this.drop = null;
    const value = !spec ? undefined : spec.id === 'loot' ? spec.params?.contains ?? 'auto' : spec.id === RING_ENTITY.crate ? spec.params?.contains : spec;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.world.spawn(RING_ENTITY.crate, this.x - 10, this.y, { ...(value !== undefined ? { contains: value } : {}), dropped: true, vx: road * 0.5, lift: TRUCK.deck + 4, vlift: 2.6 });
  }

  /** The wreck rolls to a stop on the road, smoking, and drifts back out of view. */
  protected override updateDeath(): void {
    this.vx *= ROADWORKS.wreckDrag;
    if (this.vx < 0.05) this.vx = 0;
    this.x += this.vx;
    this.touchWagons();
    if ((this.world.tick + this.id) % 9 === 0) smokeTrail(this.world, this.x + 26 + this.world.fxRng.range(-6, 6), this.y - 36, true);
    if (this.x + TRUCK.x1 < this.world.camera.x - 24) this.remove();
  }

  // ------------------------------------------------------------------------------- drawing

  /** The truck frame now: beacon pair by time, battered at half HP, the wreck. */
  private frame(): number {
    if (this.dead) return TRUCK_FRAME.wreck;
    const base = this.hp <= this.maxHp / 2 ? TRUCK_FRAME.battered : TRUCK_FRAME.clean;
    return base + (Math.floor((this.age + this.id) / 12) & 1);
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawShadow(r, x, y, (TRUCK.half * 2) * 0.95, 0.4);
    drawShadow(r, x + TRUCK.trailerX, y, 26, 0.35);
    drawOpts.flipX = false;
    drawOpts.flash = this.flashTicks > 0;
    const tx = x + TRUCK.trailerX;
    r.sprite(TRUCK_ID.trailer, 0, tx, y, drawOpts);
    const lit = !this.dead && Math.floor((this.age + this.id) / 20) % 3 !== 2;
    r.sprite(TRUCK_ID.board, lit ? (this.side < 0 ? 1 : 2) : 0, tx + BOARD_AT[0], y + BOARD_AT[1], drawOpts);
    r.sprite(TRUCK_ID.truck, this.frame(), x, y, drawOpts);
  }

  /** Layer 0 (drawn after the crew): the near drop side of the flatbed. */
  drawLayer(r: Renderer, k: number): void {
    if (k !== 0) return;
    layerOpts.flipX = false;
    layerOpts.flash = this.flashTicks > 0;
    const f = this.dead ? 2 : this.hp <= this.maxHp / 2 ? 1 : 0;
    r.sprite(TRUCK_ID.side, f, Math.round(this.x), Math.round(this.y), layerOpts);
  }

  override onRemove(): void {
    this.layer?.remove();
    this.line?.stop();
  }
}

/** The truck's lane (see the header's `lane` param). */
function pickLane(world: World, x: number, y: number, p: SpawnParams): number {
  const open = ringOf(world)?.lanesOpenAt(x) ?? LANE_COUNT;
  const given = Math.round(paramNum(p, 'lane', 0));
  if (given >= 1 && given <= open) return given;
  // A plan closure in lane 3 or 4 near it (the plan's road works): the crew works inside it.
  const list = world.byTag(RING_ENTITY.closure);
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const l = nearestLane(c.y);
    if (!c.alive || l < 3 || l > open) continue;
    const x0 = c.x + c.hitbox.x;
    const dd = x < x0 ? x0 - x : x > x0 + c.hitbox.w ? x - x0 - c.hitbox.w : 0;
    if (dd < 640 && dd < bd) {
      bd = dd;
      best = l;
    }
  }
  if (best) return best;
  const own = nearestLane(y);
  if (own >= 3 && own <= open) return own;
  return Math.min(4, open);
}

// ---------------------------------------------------------------------------------------------
// The crew
// ---------------------------------------------------------------------------------------------

/**
 * A road worker on the truck's deck (or, spawned alone with {}, standing on the road): lifts a cone
 * over his head and lobs it into a wagon's lane (see the file header). Params: `truck` (the
 * `RingRoadworks`), `slot` (0 … 2, his place on the deck), `look` (0 … 2), `hp`, `drop`.
 */
export class RingRoadworker extends Enemy implements RingDrawable {
  mode: WorkerMode = 'idle';
  modeT = 0;
  lift = 0;
  shadowW = 0;
  shotLift = 30;
  holdsToken = false;
  readonly truck: RingRoadworks | null;
  readonly slot: number;
  readonly look: number;
  private cool: number = ROADWORKS.firstDelay;
  private prey: Entity | null = null;
  private readonly slab = slabCache();

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const look = Math.max(0, Math.round(paramNum(p, 'look', 0))) % WORKER_LOOKS.length;
    super(world, x, y, p, { art: workerArt(look), hp: ROADWORKS.workerHp, body: false, soft: true, w: 12, h: 38, score: ROADWORKS.workerScore });
    this.look = look;
    const t = (p as { truck?: unknown }).truck;
    this.truck = t instanceof RingRoadworks ? t : null;
    this.slot = Math.max(0, Math.min(2, Math.round(paramNum(p, 'slot', 0))));
    this.cool += this.slot * 41;
    this.z = 32;
    this.lift = this.truck ? TRUCK.deck : 0;
    this.y = this.truck ? this.truck.y : laneY(nearestLane(y));
    this.hitbox = { x: -6, y: -38 - this.lift, w: 12, h: 38 + this.lift };
    this.despawnMargin = this.truck ? Infinity : 96;
    this.addTag(RING_ROADWORKER, 'ring-crew');
    this.play('idle');
  }

  override hurtboxes(): readonly Rect[] {
    return this.dead ? NO_BOXES : slabBoxes(this, this.slab, ROADWORKS.workerHalf);
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    this.follow();
    super.update();
  }

  /** Ride on the deck (the truck moved this tick already: it updates first). */
  private follow(): void {
    const t = this.truck;
    if (!t) {
      this.vx = ringOf(this.world)?.roadSpeed ?? 0;
      this.x += this.vx;
      return;
    }
    if (t.removed) {
      this.remove();
      return;
    }
    this.x = t.x + TRUCK.crewX[this.slot];
    this.y = t.y;
    this.vx = t.vx;
  }

  private setMode(m: WorkerMode): void {
    this.mode = m;
    this.modeT = 0;
    if (m === 'tell-throw') this.play('tell', { restart: true });
    else if (m === 'throw') this.play('throw', { restart: true });
    else this.play('idle');
  }

  protected override think(): void {
    this.modeT++;
    this.prey = nearestWagon(this.world, this.x, this.y);
    if (this.prey && Math.abs(this.prey.x - this.x) > 2) this.facing = this.prey.x < this.x ? -1 : 1;
    switch (this.mode) {
      case 'idle':
        if (--this.cool <= 0) this.tryAttack();
        break;
      case 'tell-throw':
        if (!this.prey || !this.inView(ATTACK_INSET - 6)) this.endAttack(40);
        else if (this.modeT >= telegraphTicks(this.world, ROADWORKS.tell)) this.setMode('throw');
        break;
      case 'throw':
        if (this.modeT === ROADWORKS.release && this.prey) this.lob(this.prey);
        if (this.modeT >= ROADWORKS.throwTicks) this.setMode('recover');
        break;
      case 'recover':
        if (this.modeT >= ROADWORKS.recover) this.endAttack();
        break;
      default:
        break;
    }
  }

  /** His middle (over the deck) at least `inset` px inside the view. */
  private inView(inset: number): boolean {
    return this.world.camera.containsPoint(this.x, this.y - this.lift - 18, -inset);
  }

  private tryAttack(): void {
    const t = this.prey;
    if (!t || this.reacting || !this.inView(ATTACK_INSET) || this.truck?.dead) {
      this.cool = 20;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 30;
      return;
    }
    this.holdsToken = true;
    this.setMode('tell-throw');
    this.world.audio.sfx('ring/crew-cone-lift');
  }

  /** The cone leaves his hands: a lob into the target's lane, landing where the wagon will be on screen. */
  private lob(t: Entity): void {
    const cam = this.world.camera;
    const hx = this.x + 3 * this.facing;
    const hy = this.y - this.lift - 40;
    const T = ROADWORKS.coneTicks;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const landSx = t.x - cam.x + this.world.rng.range(-ROADWORKS.scatter, ROADWORKS.scatter);
    const lob = new RingConeLob(this.world, hx, this.y, {
      lift: this.y - hy,
      ty: laneY(nearestLane(t.y)),
      vx: road + (landSx - (hx - cam.x)) / T,
      ticks: T,
      arc: ROADWORKS.coneArc,
    });
    this.world.add(lob);
    this.world.audio.sfx('ring/crew-cone-throw');
  }

  private endAttack(cool?: number): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.cool = cool ?? this.fireInterval(ROADWORKS.every, ROADWORKS.jitter);
    this.setMode('idle');
  }

  protected override onReact(_kind: ReactionKind): void {
    if (this.mode !== 'idle') this.endAttack(40);
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'gloat') {
      super.thinkReaction(kind);
      return;
    }
    this.play(this.reactionAnim(kind));
  }

  /** The gloat: the coffee break on the deck (a cup from the thermos), one line per hold. */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    this.faceSpot(spot);
    this.play(this.reactionAnim('gloat'));
    if (this.onScreen(0) && t >= 10 + this.slot * 9) this.sayGloat('KOFFIEPAUZE!', 70, 'worker');
  }

  /** The truck is wrecked: he jumps off onto the hard shoulder (no score, bloodless). */
  bail(k = 1): void {
    if (this.dead || this.removed) return;
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.dead = true;
    this.fling(k);
    this.remove();
  }

  protected override onDeath(d: Damage): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.fling(d.kind === 'explosion' ? 1.4 : 1);
    this.world.audio.sfx('ring/crew-knocked');
    this.remove();
  }

  /** Off the deck in a tuck, onto the hard shoulder, sitting up dazed (bloodless). */
  private fling(k: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const shoulder = SHOULDER_TOP + 5;
    const pre = this.art;
    tumbleOff(this.world, this.x, this.y, {
      sprite: `${pre}/tumble`,
      restSprite: `${pre}/sit`,
      vx: road * 0.4 - 0.5 * k,
      vy: Math.max(0.5, (shoulder - this.y) / 30),
      lift: this.lift + 8,
      vlift: 2.2 * k,
      bounces: 1,
      rest: 70,
      tpf: 4,
      shoulder: true,
      shadowW: 14,
      z: 34,
    });
    dust(this.world, this.x, this.y, 3);
  }

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0;
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
    // The last third of a tell blinks a warm tint (the cone is coming).
    if (this.mode === 'tell-throw') {
      const T = telegraphTicks(this.world, ROADWORKS.tell);
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) {
        drawOpts.flash = false;
        drawOpts.tint = 0xff6040ff;
        drawOpts.alpha = 0.35;
        r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
        drawOpts.tint = undefined;
        drawOpts.alpha = undefined;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The lobbed cone and the cone line
// ---------------------------------------------------------------------------------------------

/** Options of a lobbed cone (as a scooter's bottle). */
export interface ConeLobOpts {
  lift: number;
  ty: number;
  vx: number;
  ticks: number;
  arc: number;
}

/**
 * A cone lobbed into a lane: it flies over everything (it is not a shot), its shadow runs along the
 * road to the landing spot; there a wagon in that slab takes a thrown object's hit (1 cell) and the
 * cone bounces off it; else it bounces and lies on the road (harmless). Tagged `ring-bottle` with
 * `landX` / `landY` / `ticksLeft` like the scooter's bottle (the bot and the sim watch read them).
 */
export class RingConeLob extends Entity implements RingDrawable {
  lift: number;
  shadowW = 9;
  private readonly lift0: number;
  private readonly y0: number;
  private readonly o: ConeLobOpts;
  private t = 0;

  constructor(world: World, x: number, y: number, o: ConeLobOpts) {
    super(world, x, y);
    this.type = 'ring-roadworks/cone';
    this.o = o;
    this.lift = this.lift0 = o.lift;
    this.y0 = y;
    this.vx = o.vx;
    this.team = 'enemy';
    this.z = 52;
    this.hitbox = { x: -5, y: -12, w: 10, h: 12 };
    this.despawnMargin = 64;
    this.addTag('ring-bottle', 'ring-cone');
  }

  get landY(): number {
    return this.o.ty;
  }

  get landX(): number {
    return this.x + this.vx * (this.o.ticks - this.t);
  }

  get ticksLeft(): number {
    return this.o.ticks - this.t;
  }

  override update(): void {
    this.t++;
    const T = this.o.ticks;
    const k = Math.min(1, this.t / T);
    this.x += this.vx;
    this.y = this.y0 + (this.o.ty - this.y0) * k;
    this.lift = Math.max(0, this.lift0 * (1 - k) + Math.sin(k * Math.PI) * this.o.arc);
    if (this.t >= T) this.land();
  }

  private land(): void {
    const w = this.world;
    const hits = w.damageArea({ x: this.x - 10, y: this.y - 7, w: 20, h: 14 }, { amount: 1, kind: 'impact', dirX: -1, source: this, tags: ['thrown'] }, 'enemy');
    const road = ringOf(w)?.roadSpeed ?? 0;
    tumbleOff(w, this.x, this.y, {
      sprite: TRUCK_ID.cone,
      vx: hits > 0 ? road * 0.6 - 1.2 : this.vx * 0.3,
      vy: w.fxRng.range(-0.4, 0.4),
      lift: hits > 0 ? 14 : 1,
      vlift: hits > 0 ? 2.4 : 1.6,
      bounces: 2,
      rest: 80,
      restFrame: 2,
      tpf: 3,
      shadowW: 6,
    });
    w.audio.sfx(hits > 0 ? 'ring/crew-cone-hit' : 'ring/cone');
    this.remove();
  }

  override draw(r: Renderer): void {
    // Tumbling end over end: the cone's frames 1 … 3, mirrored every other half turn.
    const f = Math.floor(this.t / 3) % 6;
    drawOpts.flipX = f >= 3;
    drawOpts.flash = false;
    r.sprite(TRUCK_ID.cone, 1 + (f % 3), Math.round(this.x), Math.round(this.y - this.lift + 6), drawOpts);
  }
}

/**
 * The cones the crew drops behind the truck: a closed lane for a stretch (tags `ring-closure` and
 * `hazard`: civilian cars merge out before it, scooters avoid it). It lies still on the road (world
 * vx 0). A wagon that reaches a standing cone knocks it flying and pays 1 cell (its hit
 * invulnerability spaces the cones out), as at a closure.
 */
export class RingConeLine extends Entity {
  readonly lane: number;
  readonly side: -1 | 1;
  readonly owner: RingRoadworks | null;
  /** World x of each cone (first … count − 1) and whether it still stands. */
  readonly xs = new Float64Array(ROADWORKS.lineMax);
  readonly up = new Uint8Array(ROADWORKS.lineMax);
  count = 0;
  /** No more cones come (the truck left, was wrecked, or started a new line). */
  stopped = false;

  constructor(world: World, owner: RingRoadworks | null, x: number, lane: number, side: -1 | 1) {
    super(world, x, laneY(lane));
    this.type = 'ring-roadworks/cones';
    this.owner = owner;
    this.lane = lane;
    this.side = side;
    this.team = 'neutral';
    this.z = 28;
    this.hitbox = { x: -6, y: -14, w: 12, h: 14 };
    this.despawnMargin = Infinity;
    this.addTag(RING_ENTITY.closure, 'hazard', 'ring-cones');
    this.add(x);
  }

  get full(): boolean {
    return this.count >= ROADWORKS.lineMax;
  }

  /** The cones' plane y (at the lane's edge toward the open lane). */
  get coneY(): number {
    return this.y + this.side * ROADWORKS.coneEdge;
  }

  add(x: number): void {
    if (this.stopped || this.full) return;
    this.xs[this.count] = x;
    this.up[this.count] = 1;
    this.count++;
    // The anchor is the newest (front) cone; the box reaches back to the first one (readers take
    // `x + hitbox.x` … `+ hitbox.w`, as at a closure; a lane-safety look ahead finds the front).
    const span = x - this.xs[0];
    this.x = x;
    this.hitbox.x = -span - 6;
    this.hitbox.w = span + 12;
    if (this.count > 1) this.world.audio.sfx('ring/cone', { vol: 0.25 });
  }

  stop(): void {
    this.stopped = true;
  }

  override update(): void {
    this.vx = 0;
    const cam = this.world.camera;
    // Gone once every cone is behind the view and no more come.
    if ((this.stopped || !this.owner || this.owner.removed) && this.x + 6 < cam.x - 32) {
      this.remove();
      return;
    }
    this.hitWagons();
  }

  private hitWagons(): void {
    const list = drivenWagons(this.world);
    const cy = this.coneY;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (Math.abs(w.y - cy) > 10) continue;
      const s = wagonSlab(w);
      for (let k = 0; k < this.count; k++) {
        if (!this.up[k]) continue;
        const cx = this.xs[k];
        if (cx < s.x - 2 || cx > s.x + s.w + 2) continue;
        this.up[k] = 0;
        this.world.audio.sfx('ring/cone');
        tumbleOff(this.world, cx, cy, {
          sprite: TRUCK_ID.cone,
          vx: w.vx + (w.x < cx ? 1.2 : -1.2),
          vy: this.world.fxRng.range(-0.6, 0.6),
          lift: 2,
          vlift: 2.6 + this.world.fxRng.range(0, 1.2),
          bounces: 2,
          rest: 90,
          restFrame: 2,
          tpf: 3,
          shadowW: 6,
        });
        if (w.invulnTicks <= 0) w.bump({ dx: -0.8, cost: 1, source: this });
      }
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    const cam = this.world.camera;
    const y = Math.round(this.coneY);
    for (let k = 0; k < this.count; k++) {
      if (!this.up[k]) continue;
      const x = this.xs[k];
      if (x < cam.x - 16 || x > cam.right + 16) continue;
      r.sprite(TRUCK_ID.cone, 0, Math.round(x), y, drawOpts);
    }
  }
}

defineEntity(RING_ENTITY_B.roadworks, (w, x, y, p) => new RingRoadworks(w, x, y, p), {
  category: 'enemy',
  score: ROADWORKS.score,
  description: 'The road-works crew: a slow truck with the arrow trailer, workers lob cones into your lane, cones close its lane behind it (params lane, crew, hp, drop).',
});

defineEntity(RING_ROADWORKER, (w, x, y, p) => new RingRoadworker(w, x, y, p), {
  category: 'enemy',
  score: ROADWORKS.workerScore,
  description: 'A road worker on the road-works truck (spawned by it with truck, slot): lobs cones into your lane.',
});
