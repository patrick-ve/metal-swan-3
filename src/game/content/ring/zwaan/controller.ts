/**
 * `ring-zwaan` — the ZWAAN train's controller (docs/design/ring.md §R.3; the contract: api.ts).
 * Invisible (no `boss` tag, not hittable): the boss slot spawns it; it holds the plan lock for the
 * whole train, spawns the parts in order, runs the entry and the catch-ups, sends the small gangs,
 * draws the waiting parts and ends the train.
 *
 * Phases: 'enter' (the first part drives in from the right to the anchor) → 'fight' (the active
 * part fights; its intro ended when `ready`) → on its death start `partBeaten`: 'catchup' (the next
 * part, spawned at its place in the chain, eases back to the anchor over 130–180 ticks) → 'fight' …
 * → after the cab: 'done' ('ringTrainDone', the plan lock goes, the controller is removed; the cab's
 * wreck still plays its beaten sequence on the rolling road).
 *
 * Params: `order` (part ids rear → front; default `RING_ZWAAN_ORDER`; unknown ids are skipped),
 * `lane` (1 | 2; default 1), `adds` (false: no catch-up gangs; tests), `traffic` (false: no
 * civilian traffic while the train holds the plan; tests).
 *
 * TRAIN-1 (revision R, wave A), on CORE's working controller (the `ZwaanTrain` interface kept):
 * - THE CATCH-UP is visible: the uncoupled train surges ahead (`ZWAAN_CATCH.surge` px at the start,
 *   the beaten part brakes away behind it), then eases back to the anchor; 130–180 ticks in all;
 * - TRAFFIC while the plan is locked (the plan brings none): a civilian car every
 *   `ZWAAN_CATCH.traffic` ticks in lane 3 or 4 (never the train's lanes) when the lane's entry is
 *   free, from behind, passing the train at 1.1–1.5 px/tick (a car that sat beside the train would
 *   block the shots; its own rng fork `ring-zwaan/traffic`); none while every player is out (the
 *   runner's hold traffic runs then) or in a jam;
 * - the gang of each catch-up (2 / 2 / 3 scooters by difficulty) keeps the 4-second rule.
 */
import type { Rect } from '../../../../engine/math';
import type { Renderer } from '../../../../engine/render';
import type { Rng } from '../../../../engine/rng';
import type { World } from '../../../../engine/world';
import { sessionOf } from '../../../context';
import { hasEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, RingEntity } from '../../../ring/entity';
import { CAR_COLOURS, carRelOf, pickCarModel } from '../../../ring/director';
import { RING_ENTITY } from '../../../ring/ids';
import { DEPTH_HALF, LANE_COUNT, laneY, nearestLane } from '../../../ring/lanes';
import { RING } from '../../../ring/types';
import { WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, jamOf, slabsTouch, wagonSlab } from '../traffic/road-kit';
import { RING_ZWAAN_ORDER, ZWAAN, ZWAAN_LOCK, zwaanPartDef, type ZwaanPartHandle, type ZwaanPips, type ZwaanTrain } from './api';
import type { ZwaanPart } from './part';

export type ZwaanPhase = 'wait' | 'enter' | 'fight' | 'catchup' | 'done';

/** The catch-up's surge and the traffic while the train holds the plan (TRAIN-1 tuning). */
export const ZWAAN_CATCH = {
  /** The train surges ahead this many px (screen) early in a catch-up, then eases back. */
  surge: 18,
  /** A civilian car every `traffic[0]` … `traffic[1]` ticks while the train fights (lanes 3–4) … */
  traffic: [360, 600] as const,
  /** … from behind, passing at this screen speed (px/tick). */
  passRel: [1.1, 1.5] as const,
  /** The first car this many ticks after the train's first part arrives. */
  trafficFirst: 200,
} as const;

const slab: Rect = { x: 0, y: 0, w: 0, h: 0 };

export class RingZwaan extends RingEntity implements ZwaanTrain {
  readonly order: readonly string[];
  /** Index of the active part (−1 before the first; `order.length` when done). */
  index = -1;
  phase: ZwaanPhase = 'wait';
  /** The active part (null before the first and after the cab). */
  active: ZwaanPart | null = null;
  lane: number;
  /** Catch-ups so far and the ticks each took (tests, the report). */
  readonly catchUps: number[] = [];
  /** Scooters sent during catch-ups (tests). */
  addsSent = 0;
  private readonly adds: boolean;
  private anchorFrom: number = ZWAAN.anchorX;
  private catchT = 0;
  private catchLen = 0;
  private locked = false;
  private t = 0;
  private gangNo = 0;
  private readonly touched = new WeakMap<Wagon, number>();
  private readonly pipsObj = { total: 0, left: 0 };
  /** The traffic while the plan is locked: on, its timer and its own rng fork. */
  private readonly traffic: boolean;
  private trafficT: number = ZWAAN_CATCH.trafficFirst;
  private readonly rng: Rng;
  /** Civilian cars sent (tests). */
  carsSent = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    const raw = Array.isArray(p.order) ? (p.order as unknown[]).filter((v): v is string => typeof v === 'string') : RING_ZWAAN_ORDER;
    this.order = raw.filter((id) => hasEntity(id));
    this.lane = Math.max(1, Math.min(2, Math.round(paramNum(p, 'lane', Math.min(2, nearestLane(y))))));
    this.y = laneY(this.lane);
    this.adds = p.adds !== false;
    this.traffic = p.traffic !== false;
    this.rng = world.rng.fork('ring-zwaan/traffic');
    this.despawnMargin = Infinity;
    this.depthHalf = 0;
    this.z = 29;
    this.addTag('ring-zwaan');
    this.pipsObj.total = this.order.length;
    this.pipsObj.left = this.order.length;
  }

  // ------------------------------------------------------------------------------- ZwaanTrain

  get laneY(): number {
    return this.active && !this.active.beaten ? this.active.y : laneY(this.lane);
  }

  get catchingUp(): boolean {
    return this.phase === 'enter' || this.phase === 'catchup';
  }

  get pips(): ZwaanPips {
    return this.pipsObj;
  }

  /** The anchor's screen x this tick (eased during the entry and the catch-ups; a drift while it fights). */
  get anchorScreenX(): number {
    if (this.catchingUp) {
      const k = this.catchLen > 0 ? Math.min(1, this.catchT / this.catchLen) : 1;
      const e = k * k * (3 - 2 * k);
      // The catch-up: the uncoupled train surges ahead first, then eases back (not the entry).
      const surge = this.phase === 'catchup' ? ZWAAN_CATCH.surge * Math.sin(Math.PI * Math.min(1, k * 2.2)) * (1 - k) : 0;
      return this.anchorFrom + (ZWAAN.anchorX - this.anchorFrom) * e + surge;
    }
    return ZWAAN.anchorX + Math.sin((this.t / ZWAAN.driftPeriod) * Math.PI * 2) * ZWAAN.drift;
  }

  anchorWorldX(): number {
    return this.world.camera.x + this.anchorScreenX;
  }

  ready(part: ZwaanPartHandle): boolean {
    return part === this.active && this.phase === 'fight';
  }

  partBeaten(part: ZwaanPartHandle): void {
    if (part !== this.active || this.phase === 'done') return;
    this.world.events.emit('ringTrainPart', { part: part.type, index: this.index, phase: 'beaten' });
    this.pipsObj.left = Math.max(0, this.order.length - this.index - 1);
    const next = this.index + 1;
    if (next >= this.order.length) {
      this.finish();
      return;
    }
    // The next part takes its place in the chain at once; the train eases back (the catch-up).
    const x = part.x + part.length + ZWAAN.coupling;
    this.spawnPart(next, x);
    const cam = this.world.camera;
    this.beginCatchUp(x - cam.x, ZWAAN.catchUp.pxPerTick, ZWAAN.catchUp.min, ZWAAN.catchUp.max);
    this.phase = 'catchup';
    this.sendGang();
  }

  // ------------------------------------------------------------------------------- the run

  override update(): void {
    this.t++;
    const ring = ringOf(this.world);
    if (this.phase === 'wait') this.begin();
    if (this.catchingUp) {
      this.catchT++;
      if (this.catchT >= this.catchLen) {
        if (this.phase === 'catchup') this.catchUps.push(this.catchT);
        this.phase = 'fight';
      }
    }
    // A part gone without its death (a removal by a tool): the train goes on.
    const a = this.active;
    if (a && !a.alive && !a.beaten && this.phase !== 'done') this.partBeaten(a);
    // Follow the active part (the waiting parts are drawn from it).
    if (this.active && !this.active.beaten) {
      this.x = this.active.x;
      this.y = this.active.y;
    } else {
      this.x = this.anchorWorldX();
      this.vx = ring?.roadSpeed ?? 0;
    }
    this.touchWagons();
    if (this.phase === 'fight' || this.phase === 'catchup') this.updateTraffic();
  }

  /** A civilian now and then in lane 3 or 4 while the train holds the plan (see the header). */
  private updateTraffic(): void {
    const ring = ringOf(this.world);
    if (!this.traffic || !ring || ring.held || jamOf(this.world).level > 0.05) return;
    if (--this.trafficT > 0) return;
    const rng = this.rng;
    this.trafficT = rng.int(ZWAAN_CATCH.traffic[0], ZWAAN_CATCH.traffic[1]);
    if (!hasEntity(RING_ENTITY.car)) return;
    const cam = this.world.camera;
    const l = rng.int(3, Math.min(4, ring.lanesOpenAt(cam.x)));
    const model = pickCarModel(rng, l);
    const colour = rng.int(0, CAR_COLOURS - 1);
    // A passer from behind that drives through (never one that sits beside the train and blocks
    // the shots: carRelOf's near-lane cars hang about on screen).
    const rel = Math.max(carRelOf(l, model), rng.range(ZWAAN_CATCH.passRel[0], ZWAAN_CATCH.passRel[1]));
    const y = laneY(l);
    const x = cam.x - RING.spawnBehind;
    // The lane's entry must be free (no car, blocker or wagon near the spawn spot).
    for (const tag of [RING_ENTITY.car, 'ring-closure', 'ring-block', 'ring-wagon', 'ring-forklift']) {
      const list = this.world.byTag(tag);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.alive && Math.abs(e.y - y) <= 11 && Math.abs(e.x - x) < 200) return;
      }
    }
    this.world.spawn(RING_ENTITY.car, x, y, { model, colour, rel });
    this.carsSent++;
  }

  /** The first tick: the plan lock, the first part drives in from the right edge. */
  private begin(): void {
    const ring = ringOf(this.world);
    if (ring && !this.locked) {
      ring.lockPlan(ZWAAN_LOCK);
      this.locked = true;
    }
    if (this.order.length === 0) {
      this.finish();
      return;
    }
    const cam = this.world.camera;
    const sx = cam.w + ZWAAN.enterFrom;
    this.spawnPart(0, cam.x + sx);
    this.beginCatchUp(sx, 2.2, 60, 180);
    this.phase = 'enter';
  }

  private beginCatchUp(fromScreenX: number, pxPerTick: number, min: number, max: number): void {
    this.anchorFrom = fromScreenX;
    this.catchT = 0;
    const dist = Math.abs(fromScreenX - ZWAAN.anchorX);
    this.catchLen = Math.max(min, Math.min(max, Math.round(dist / pxPerTick)));
  }

  private spawnPart(i: number, x: number): void {
    this.index = i;
    const id = this.order[i];
    const e = this.world.spawn(id, x, laneY(this.lane), { lane: this.lane, index: i }) as ZwaanPart;
    e.train = this;
    e.index = i;
    this.active = e;
    this.pipsObj.left = this.order.length - i;
  }

  /** The cab is beaten: the train is done ('ringTrainDone'), the lock goes, the controller goes. */
  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.index = this.order.length;
    this.pipsObj.left = 0;
    this.active = null;
    this.world.events.emit('ringTrainDone', { controller: this });
    this.unlock();
    this.remove();
  }

  private unlock(): void {
    if (!this.locked) return;
    this.locked = false;
    ringOf(this.world)?.unlockPlan(ZWAAN_LOCK);
  }

  override onRemove(): void {
    this.unlock();
  }

  /** The small gang of a catch-up: scooters from behind in the near lanes (2 / 2 / 3 by difficulty). */
  private sendGang(): void {
    const ring = ringOf(this.world);
    if (!this.adds || !hasEntity(RING_ENTITY.scooter) || ring?.held) return;
    const n = ZWAAN.adds[sessionOf(this.world).difficulty] ?? 2;
    const cam = this.world.camera;
    const gang = 900 + this.gangNo++;
    for (let k = 0; k < n; k++) {
      const lane = k % 2 === 0 ? 3 : 4;
      this.world.spawn(RING_ENTITY.scooter, cam.x - RING.spawnBehind - k * 24, laneY(lane), {
        side: 'behind',
        pillion: k === 0 ? 'bottle' : 'pistol',
        lead: k === 0,
        gang,
        size: n,
        index: k,
      });
      this.addsSent++;
    }
  }

  /** A wagon in the waiting parts' slab is pushed out to the lane away from the train (½ cell). */
  private touchWagons(): void {
    const a = this.active;
    if (!a || a.beaten || this.phase === 'done') return;
    const x0 = a.x + a.length;
    const x1 = this.chainFront();
    if (x1 <= x0) return;
    slab.x = x0;
    slab.w = x1 - x0;
    slab.y = a.y - DEPTH_HALF;
    slab.h = DEPTH_HALF * 2;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!slabsTouch(wagonSlab(w), slab)) continue;
      let away = w.y >= a.y ? 1 : -1;
      const lane = nearestLane(a.y);
      const open = ringOf(this.world)?.lanesOpenAt(w.x) ?? LANE_COUNT;
      if (away < 0 && lane <= 1) away = 1;
      else if (away > 0 && lane >= open) away = -1;
      w.y = a.y + away * (DEPTH_HALF * 2 + 0.2);
      if (this.world.tick - (this.touched.get(w) ?? -999) >= 24) {
        this.touched.set(w, this.world.tick);
        w.bump({ dy: away, cost: 0.5, source: this });
      }
      // Never inside the coupling from behind either.
      if (w.x + WAGON_W / 2 < x0) w.x = x0 - WAGON_W / 2 - 1;
    }
  }

  /** World x of the front of the last waiting part (the chain from the active part). */
  chainFront(): number {
    const a = this.active;
    if (!a) return this.x;
    let x = a.x + a.length;
    for (let i = this.index + 1; i < this.order.length; i++) {
      const def = zwaanPartDef(this.order[i]);
      if (!def) continue;
      x += ZWAAN.coupling + def.length;
    }
    return x;
  }

  override hurtboxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  /** The waiting parts in front of the active one (decor: not hittable). */
  override draw(r: Renderer): void {
    const a = this.active;
    if (!a || a.beaten || this.phase === 'done') return;
    let x = a.x + a.length;
    const y = a.y;
    const cam = this.world.camera;
    for (let i = this.index + 1; i < this.order.length; i++) {
      const def = zwaanPartDef(this.order[i]);
      if (!def) continue;
      x += ZWAAN.coupling;
      if (x > cam.right + 8) break;
      def.drawWaiting(r, x, y, this.world.tick);
      x += def.length;
    }
  }
}

const NO_BOXES: readonly Rect[] = [];
