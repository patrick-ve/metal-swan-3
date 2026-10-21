/**
 * `ring-closure` — a lane closed for a stretch (docs/design/ring.md §7.1): yellow temporary lines
 * on the road, a taper of orange cones with reflective bands, the arrow trailer with its flashing
 * amber arrow (toward the open lane) and the yellow crash-absorber truck at the head, then cones
 * along the closed lane to its end. It lies still on the road (world vx 0: it drifts back).
 *
 * - THE HEAD (trailer + truck): a wagon that hits it pays `HEAD_COST` cells (a ram), is stopped for a
 *   moment (its screen speed set to the road's, backwards) and is bounced toward the open lane.
 * - CONES: a wagon whose slab reaches a cone knocks it flying (a tumbler) and pays 1 cell (its hit
 *   invulnerability spaces the cones out).
 * - Civilian cars merge out of the lane before it (traffic/car.ts); scooters avoid it.
 * The plan keeps at least one lane open and never puts a closure inside a jam (GEN).
 *
 * Params: `length` (px of closed lane after the head, default `CLOSURE.length`), `toward` ('far' |
 * 'near': the open side; default far, lane 1 → near), `truck` (false: no head — the second lane of a
 * two-lane closure has only its cones and lines), `kind` ('gantry' | 'roadworks': the same look in
 * wave A). The lane is the spawn's lane.
 */
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { PAL } from '../../../../engine/palette';
import { debris, hitSpark } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, RingEntity } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { LANE_SPLIT, laneY, nearestLane, ROAD_TOP } from '../../../ring/lanes';
import { wagonBandEnd, WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, RingLayer, tumbleOff, wagonSlab, type Layered } from '../traffic/road-kit';
import { BOARD_AT, CLOSURE } from './geometry';

/** Armour cost of hitting the head (cells), of a cone. */
export const HEAD_COST = 2;
export const CONE_COST = 1;

const drawOpts: DrawOpts = {};
const YELLOW = PAL.gold[2];

interface Cone {
  /** Offset along the road from the closure's x, and the plane y. */
  dx: number;
  y: number;
  up: boolean;
}

export class RingClosure extends RingEntity implements Layered {
  readonly lane: number;
  readonly length: number;
  /** −1: the open lane is the far one; +1: the near one. */
  readonly side: -1 | 1;
  readonly cones: Cone[] = [];
  /** It has the head (the arrow trailer and the absorber truck). */
  readonly head: boolean;
  private layer: RingLayer | null = null;
  private t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const lane = nearestLane(y);
    super(world, x, laneY(lane));
    this.lane = lane;
    this.length = Math.max(CLOSURE.head[1] + 40, paramNum(p, 'length', CLOSURE.length));
    this.side = p.toward === 'near' || (p.toward !== 'far' && lane === 1) ? 1 : -1;
    this.head = p.truck !== false;
    this.team = 'neutral';
    this.z = 28;
    const x0 = CLOSURE.taper[0] - 8;
    this.hitbox = { x: x0, y: -44, w: this.length - x0, h: 44 };
    this.shadowW = 0;
    this.despawnMargin = 64;
    this.addTag(RING_ENTITY.closure, 'hazard');
    // The taper: from the open lane's edge into the closed lane; then cones along its open edge.
    const edge = this.y + this.side * 6;
    CLOSURE.taper.forEach((dx, i) => this.cones.push({ dx, y: this.y + this.side * (8 - i * 3), up: true }));
    const first = this.head ? CLOSURE.head[1] + 12 : 0;
    for (let dx = first; dx < this.length; dx += CLOSURE.coneGap) this.cones.push({ dx, y: edge, up: true });
  }

  /** The open lane next to it. */
  get openLane(): number {
    return this.lane + this.side;
  }

  override update(): void {
    this.t++;
    if (!this.layer) {
      this.layer = new RingLayer(this.world, this, 0, ROAD_TOP - 1, 0);
      this.world.add(this.layer);
    }
    this.vx = 0;
    this.hitWagons();
  }

  private hitWagons(): void {
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.scripted) continue;
      const s = wagonSlab(w);
      // The head: the trailer and the truck in the closed lane.
      if (this.head && Math.abs(w.y - this.y) < 14 && s.x < this.x + CLOSURE.head[1] && s.x + s.w > this.x + CLOSURE.head[0]) this.hitHead(w);
      // Cones (still standing) under the wagon's slab.
      for (const c of this.cones) {
        if (!c.up) continue;
        const cx = this.x + c.dx;
        if (cx < s.x - 2 || cx > s.x + s.w + 2 || Math.abs(w.y - c.y) > 10) continue;
        this.knock(c, w.vx, w.x < cx ? 1 : -1);
        if (w.invulnTicks <= 0) w.bump({ dx: -0.8, cost: CONE_COST, source: this });
      }
    }
  }

  /** The wagon hit the head: a ram's cost, a stop, a bounce toward the open lane. */
  private hitHead(w: Wagon): void {
    const head0 = this.x + CLOSURE.head[0];
    // Pushed back behind the head, but never past the left end of its band (polish 2026-10-21:
    // at the band end it went up to 23 px off the screen while it bounced out): the head cannot
    // move, so there the nose stays in the cones until the lane change takes it out.
    if (w.x < head0) w.x = Math.max(head0 - WAGON_W / 2 - 1, Math.min(w.x, wagonBandEnd(w) - 2));
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const open = this.openLane;
    if (w.invulnTicks <= 0) {
      w.bump({ dx: -Math.min(3.2, road + 0.4), dy: this.side, cost: HEAD_COST, source: this });
      this.world.audio.sfx('ring/crash');
      hitSpark(this.world, head0, this.y - 14, -1);
      debris(this.world, head0, this.y - 10, 'metal', 5);
    } else if (w.sideV > -road) w.sideV = -Math.min(3.2, road + 0.4);
    // Out to the open lane (once: a bump repeated while it still overlaps would go on lane by lane).
    if (w.swerveT <= 0) w.laneTarget = open;
  }

  /** A cone knocked flying. */
  private knock(c: Cone, vx: number, dir: number): void {
    c.up = false;
    this.world.audio.sfx('ring/cone');
    tumbleOff(this.world, this.x + c.dx, c.y, {
      sprite: 'ring/hazard/cone',
      vx: vx + dir * 1.2,
      vy: this.world.fxRng.range(-0.6, 0.6),
      lift: 2,
      vlift: 2.6 + this.world.fxRng.range(0, 1.2),
      bounces: 2,
      rest: 90,
      restFrame: 2,
      tpf: 3,
      shadowW: 6,
    });
  }

  /** Layer 0: the yellow temporary lines on the road (under everything). */
  drawLayer(r: Renderer, k: number): void {
    if (k !== 0) return;
    const x0 = Math.round(this.x + CLOSURE.taper[0]);
    const x1 = Math.round(this.x + this.length);
    const lane = this.lane;
    // The closed lane's edges (the lane splits) and the taper line from the edge into the lane.
    const far = lane > 1 ? LANE_SPLIT[lane - 2] : ROAD_TOP + 1;
    const near = lane < 4 ? LANE_SPLIT[lane - 1] : LANE_SPLIT[2] + 21;
    const yOpen = this.side < 0 ? far : near;
    const yOther = this.side < 0 ? near : far;
    const head = Math.round(this.x + CLOSURE.head[0]);
    r.rect(x0, yOpen, x1 - x0, 1, YELLOW, drawOpts);
    r.rect(head, yOther, x1 - head, 1, YELLOW, drawOpts);
    // The taper: a diagonal from the open edge to the lane's other edge before the head.
    const steps = Math.abs(yOther - yOpen);
    for (let i = 0; i <= steps; i += 1) {
      const xx = Math.round(x0 + ((head - x0) * i) / Math.max(1, steps));
      r.rect(xx, yOpen + Math.sign(yOther - yOpen) * i, 2, 1, YELLOW, drawOpts);
    }
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    // Far cones first (the taper sits across the lane), then the head, then the near ones.
    for (const c of this.cones) if (c.up && c.y <= this.y) r.sprite('ring/hazard/cone', 0, x + c.dx, Math.round(c.y), drawOpts);
    if (this.head) {
      const truckX = x + Math.round((CLOSURE.truck[0] + CLOSURE.truck[1]) / 2);
      r.sprite('ring/hazard/absorber', Math.floor(this.t / 12) % 2, truckX, y, drawOpts);
      const tx = x + CLOSURE.trailer;
      r.sprite('ring/hazard/arrow-trailer', 0, tx, y, drawOpts);
      const lit = Math.floor(this.t / 20) % 3 !== 2;
      r.sprite('ring/hazard/arrow-board', lit ? (this.side < 0 ? 1 : 2) : 0, tx + BOARD_AT[0], y + BOARD_AT[1], drawOpts);
    }
    for (const c of this.cones) if (c.up && c.y > this.y) r.sprite('ring/hazard/cone', 0, x + c.dx, Math.round(c.y), drawOpts);
  }
}

defineEntity(RING_ENTITY.closure, (w, x, y, p) => new RingClosure(w, x, y, p), {
  category: 'hazard',
  description: 'A closed lane: yellow lines, cones, the arrow trailer and the crash-absorber truck (params length, toward).',
});
