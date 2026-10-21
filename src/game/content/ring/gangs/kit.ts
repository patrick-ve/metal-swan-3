/**
 * Shared logic of the gang vehicles (docs/design/ring.md §5.2, §5.4): lane checks against the road
 * things (civilian cars, closures, other blocking vehicles), the wagon contact (a push out of the
 * way, a bump that costs ½ or 1 cell, a ram that costs 2), bloodless tumbles onto the hard shoulder
 * and the drop as a ring crate. Every helper runs inertly in a plain world (`ringOf` null).
 */
import type { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import type { SpawnSpec } from '../../../registry';
import { ringOf } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { LANE_COUNT, laneY, SHOULDER_TOP } from '../../../ring/lanes';
import { wagonBandEnd, WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, slabsTouch, tumbleOff, wagonSlab } from '../traffic/road-kit';

/** Road things a gang vehicle keeps its gap to and will not change lanes into. */
export const BLOCK_TAGS: readonly string[] = ['ring-car', 'ring-closure', 'ring-block'];

/** The x range [x0, x1] of an entity's visual box (mirrored by facing). */
function spanOf(e: Entity, out: [number, number]): [number, number] {
  const hb = e.hitbox;
  const x0 = e.facing < 0 ? e.x - hb.x - hb.w : e.x + hb.x;
  out[0] = x0;
  out[1] = x0 + hb.w;
  return out;
}
const span: [number, number] = [0, 0];

/** Is lane `lane` free of road things (and driven wagons when `wagons`) over [x0, x1]? */
export function laneFree(world: World, self: Entity, lane: number, x0: number, x1: number, wagons = true): boolean {
  const y = laneY(lane);
  for (let k = 0; k < BLOCK_TAGS.length; k++) {
    const list = world.byTag(BLOCK_TAGS[k]);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === self || !e.alive || Math.abs(e.y - y) > 9) continue;
      spanOf(e, span);
      if (span[0] < x1 && x0 < span[1]) return false;
    }
  }
  if (wagons) {
    const list = drivenWagons(world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (Math.abs(w.y - y) > 9) continue;
      if (w.x - WAGON_W / 2 < x1 && x0 < w.x + WAGON_W / 2) return false;
    }
  }
  return true;
}

/** The road thing `gapAhead` found last (null when none): its world vx lets a follower match it. */
export let aheadOf: Entity | null = null;

/** Distance from `front` to the rear of the nearest road thing ahead in the plane y (Infinity). */
export function gapAhead(world: World, self: Entity, y: number, front: number, range: number): number {
  let best = Infinity;
  aheadOf = null;
  for (let k = 0; k < BLOCK_TAGS.length; k++) {
    const list = world.byTag(BLOCK_TAGS[k]);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === self || !e.alive || Math.abs(e.y - y) > 9) continue;
      spanOf(e, span);
      const g = span[0] - front;
      if (g > -6 && g < range && g < best) {
        best = g;
        aheadOf = e;
      }
    }
  }
  return best;
}

/**
 * The screen speed a follower may drive at behind the road thing ahead (`gapAhead` first): a
 * little slower than it when close, never faster; `rel` when nothing is close.
 */
export function followRel(rel: number, gap: number, road: number): number {
  if (gap >= 16 || !aheadOf) return rel;
  const theirs = aheadOf.vx - road;
  return Math.min(rel, theirs - (gap < 6 ? 0.6 : 0.25), gap < 6 ? -0.4 : rel);
}

/** Distance from the rear of the nearest road thing behind in the plane y to `rear` (Infinity). */
export function gapBehind(world: World, self: Entity, y: number, rear: number, range: number): number {
  let best = Infinity;
  for (let k = 0; k < BLOCK_TAGS.length; k++) {
    const list = world.byTag(BLOCK_TAGS[k]);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === self || !e.alive || Math.abs(e.y - y) > 9) continue;
      spanOf(e, span);
      const g = rear - span[1];
      if (g > -6 && g < range && g < best) best = g;
    }
  }
  return best;
}

/** Open lanes at a world x (4 outside the ring). */
export function openAt(world: World, x: number): number {
  return ringOf(world)?.lanesOpenAt(x) ?? LANE_COUNT;
}

/** The slot of a wagon's hero (−1 none). */
export function slotOf(w: Wagon | null): number {
  return w?.driver ? w.driver.index : -1;
}

/** A wagon-contact cooldown per (vehicle, wagon): a bump costs once, then pushes for free a while. */
export class BumpCooldown {
  private readonly until = new Map<Wagon, number>();
  ready(w: Wagon, tick: number): boolean {
    return (this.until.get(w) ?? -1) <= tick;
  }
  hold(w: Wagon, tick: number, ticks: number): void {
    this.until.set(w, tick + ticks);
  }
}

/** How a contact with a driven wagon is answered (see `pushWagons`). */
export interface ContactRule {
  /** Cost in cells of a wagon driving into the rear (by the closing speed, px/tick). */
  rearCost(closing: number): number;
  /** A ram this tick (the brake check, a loose caravan): cost 2, a hard shove. */
  ram: boolean;
  /**
   * Ticks a rammed wagon is safe from this vehicle's next ram and bump (default 30). The loose
   * caravan uses its whole crash: it drops back onto a wagon behind it and rammed it every 30 ticks
   * (review B: 6–20 cells per normal run from caravans).
   */
  ramCool?: number;
}

/**
 * The wagons touching `slab` (the vehicle's depth slab over [x0, x1] at its plane y): a wagon in
 * line behind is pushed out behind the rear (a bump by the closing speed, or the ram), a wagon in
 * line ahead pushes the vehicle back (returns the x correction, < 0), a wagon touching from the side
 * (a lane change) bounces back a lane (½ cell). A swerving wagon dodges (no cost). A wagon in line
 * behind at the left end of its band (`wagonBandEnd`: `RING.screenMinX`, or queued in front of the
 * other wagon there) cannot give way: it stays and the vehicle
 * is shoved ahead of it (returns the correction, > 0; fixer B: vans dropping back pushed wagons off
 * the screen). Returns the wagons hit by the ram this call (for the driver lines) in `rammed`.
 */
export function pushWagons(world: World, self: Entity, slab: Rect, rule: ContactRule, cool: BumpCooldown, rammed: Wagon[]): number {
  rammed.length = 0;
  let back = 0;
  let fwd = 0;
  const list = drivenWagons(world);
  const rear = slab.x;
  const front = slab.x + slab.w;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (w.scripted) continue;
    const ws = wagonSlab(w);
    if (!slabsTouch(ws, slab)) continue;
    const dy = w.y - self.y;
    const ready = cool.ready(w, world.tick);
    if (Math.abs(dy) < 7) {
      if (w.x < self.x) {
        // In line behind the vehicle: out behind its rear (at the band's end: the vehicle moves; a
        // push that would take the wagon past that end takes it only down to it, polish 2026-10-21).
        const end = wagonBandEnd(w);
        if (w.x <= end || rear - WAGON_W / 2 - 0.5 < end - 2) {
          if (w.x > end) w.x = end - 2;
          fwd = Math.max(fwd, w.x + WAGON_W / 2 + 0.5 - rear);
        } else w.x = Math.min(w.x, rear - WAGON_W / 2 - 0.5);
        if (w.sideV > 0) w.sideV = 0;
        if (w.swerveT > 0) continue;
        if (rule.ram) {
          if (ready) {
            w.bump({ dx: -2.6, cost: 2, source: self });
            cool.hold(w, world.tick, rule.ramCool ?? 30);
            rammed.push(w);
          }
          continue;
        }
        const cost = rule.rearCost(w.vx - self.vx);
        if (ready && cost > 0) {
          w.bump({ dx: -1.2, cost, source: self });
          cool.hold(w, world.tick, 24);
        }
      } else {
        // The wagon is ahead: the vehicle backs off behind it.
        back = Math.min(back, w.x - WAGON_W / 2 - 0.5 - front);
      }
    } else if (ready && w.swerveT <= 0) {
      // From the side (a lane change into it): a bounce back to its lane.
      w.bump({ dy: dy < 0 ? -1 : 1, cost: rule.ram ? 2 : 0.5, source: self });
      cool.hold(w, world.tick, rule.ram ? (rule.ramCool ?? 30) : 30);
      if (rule.ram) rammed.push(w);
    }
  }
  return back < 0 ? back : fwd;
}

/** Throw a person off a vehicle onto the hard shoulder (bloodless: a tuck, a dazed sit). */
export function flingPerson(world: World, x: number, y: number, pre: string, dir: number, blast: boolean, k = 0): void {
  const road = ringOf(world)?.roadSpeed ?? 0;
  const shoulder = SHOULDER_TOP + 5;
  tumbleOff(world, x, y, {
    sprite: `${pre}/tumble`,
    restSprite: `${pre}/sit`,
    vx: road * 0.5 + dir * (blast ? 1.4 : 0.8) + k * 0.3,
    vy: Math.max(0.6, (shoulder - y) / 28),
    lift: 18,
    vlift: blast ? 3.4 : 2.4,
    bounces: 1,
    rest: 80,
    tpf: 4,
    shoulder: true,
    shadowW: 14,
    z: 34,
  });
}

/** Drop a ring crate from a vehicle (a drop spec, a drop value, or the ring roll). */
export function dropCrate(world: World, x: number, y: number, spec: SpawnSpec | null, lift = 18): void {
  const value = !spec ? 'auto' : spec.id === 'loot' ? spec.params?.contains ?? 'auto' : spec.id === RING_ENTITY.crate ? spec.params?.contains ?? 'auto' : spec;
  world.spawn(RING_ENTITY.crate, x, y, { contains: value, dropped: true, vx: (ringOf(world)?.roadSpeed ?? 0) * 0.5, lift, vlift: 2.4 });
}
