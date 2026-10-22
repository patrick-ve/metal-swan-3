/**
 * The livestock trailer's animals and the farmhand's lobs (docs/design/ring.md §R.3):
 *
 * - `ring-zwaan-cow` / `ring-zwaan-pig` (`ZwaanAnimal`, a `ZwaanObstacle`): out of the trailer
 *   down its rear gate (`ramp`, on the trailer), then they TROT back across the lanes toward the
 *   hard shoulder (`trot`: a little slower than the road, drifting toward the camera) and GRAZE
 *   there (`graze`, world-fixed, not solid). On the road they are cover like a civilian car (a
 *   neutral SolidBox: they stop both teams' shots in their lane) and a wagon that drives into one
 *   pays a cell. They are NEVER hurt: a shot stops on them with a moo / an oink and a startled hop,
 *   no damage, no death; they always reach the shoulder. `wander`: the beaten trailer lets them out
 *   onto the shoulder (they walk a few steps and graze). Params: `kind` ('cow' | 'pig'), `mode`,
 *   `host` (the trailer), `lx` (local x on it), `look` (a variety index).
 * - `ring-zwaan-lob` (`ZwaanLob`): a hay bale or a milk churn thrown by the farmhand: it flies over
 *   everything into its lane (its shadow runs to the spot: it hurts nothing in the air) and lands
 *   where the target wagon will be: 1 cell in its spot (a thrown thing); the bale bursts into hay,
 *   the churn clangs and splashes milk. Tagged `ring-bottle` (the bot reads `landX`, `landY`,
 *   `ticksLeft`). Params: `kind`, `ty`, `ticks`, `vx`, `lift`, `arc`.
 */
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { debris, dust, snowPuff } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, type RingDrawable } from '../../../ring/entity';
import { nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { Entity } from '../../../../engine/entity';
import { ZwaanObstacle } from './autos-kit';
import { gateY, VEE, VEE_SPR } from './vee-geo';

export const COW_ID = 'ring-zwaan-cow';
export const PIG_ID = 'ring-zwaan-pig';
export const LOB_ID = 'ring-zwaan-lob';
export const ANIMAL_TAG = 'ring-zwaan-animal';

/** Tuning (px, px/tick, ticks). */
export const ANIMAL_AI = {
  /** Screen speed back along the road and the drift toward the shoulder while trotting. */
  cow: { rel: -0.8, side: 0.6, len: 34, h: 24, ramp: 0.9 },
  pig: { rel: -1, side: 0.75, len: 20, h: 13, ramp: 1.1 },
  /** The plane y they graze at (on the hard shoulder). */
  graze: SHOULDER_TOP + 4,
  /** A moo / oink at most this often per animal (ticks). */
  callGap: 24,
} as const;

export type AnimalKind = 'cow' | 'pig';
export type AnimalMode = 'ramp' | 'trot' | 'graze' | 'wander';

/** What the animal reads from its trailer (vee.ts `VeePart`). */
export interface AnimalHost {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly alive: boolean;
  readonly gateBroken: boolean;
  /** The gate lies on the road (they walk down it). */
  readonly gateDown: boolean;
  readonly beaten: string | null;
}

const drawOpts: DrawOpts = {};

export class ZwaanAnimal extends ZwaanObstacle {
  readonly kind: AnimalKind;
  mode: AnimalMode;
  host: AnimalHost | null;
  lx: number;
  /** Shots that stopped on it and its calls (tests). */
  calls = 0;
  /** It reached the shoulder (tests). */
  reachedShoulder = false;
  vlift = 0;
  t = 0;
  private callT = -999;
  private readonly look: number;
  private wanderT = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const kind: AnimalKind = p.kind === 'pig' ? 'pig' : 'cow';
    const k = ANIMAL_AI[kind];
    super(world, x, y, k.len, k.h);
    this.kind = kind;
    this.type = kind === 'pig' ? PIG_ID : COW_ID;
    const m = p.mode;
    this.mode = m === 'ramp' || m === 'graze' || m === 'wander' ? m : 'trot';
    this.host = p.host && typeof p.host === 'object' && typeof (p.host as AnimalHost).x === 'number' ? (p.host as AnimalHost) : null;
    if (this.mode === 'ramp' && !this.host) this.mode = 'trot';
    this.lx = paramNum(p, 'lx', 8);
    this.look = Math.round(paramNum(p, 'look', 0));
    this.lift = paramNum(p, 'lift', 0);
    this.vx = ringOf(world)?.roadSpeed ?? 0;
    this.solid = this.mode === 'trot';
    this.shadowW = k.len - 6;
    this.z = 32;
    this.addTag(ANIMAL_TAG);
    if (this.mode === 'wander') this.wanderT = 40 + (this.look % 3) * 20;
    this.syncBox();
  }

  /** The lane it blocks (0 on the shoulder). */
  busyLane(): number {
    return this.mode === 'trot' || this.mode === 'ramp' ? nearestLane(this.y) : 0;
  }

  /** Never hurt. */
  override onHit(): boolean {
    return false;
  }

  override update(): void {
    this.t++;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const k = ANIMAL_AI[this.kind];
    const h = this.host;
    if (this.mode === 'ramp') {
      if (!h || !h.alive || h.beaten) this.mode = 'trot';
      else {
        // Down the gate (or a hop off the open back when the gate is gone).
        this.lx -= k.ramp;
        const g = h.gateDown && !h.gateBroken ? gateY(this.lx) : this.lx > VEE.hinge[0] ? VEE.hinge[1] : Math.min(0, VEE.hinge[1] + (VEE.hinge[0] - this.lx) * 1.4);
        this.x = h.x + this.lx;
        this.y = h.y;
        this.vx = h.vx - k.ramp;
        this.lift = -g;
        if (this.lift <= 0.5 && this.lx < VEE.hinge[0] - 4) {
          this.mode = 'trot';
          this.lift = 0;
          dust(this.world, this.x, this.y, 2);
        }
      }
    }
    if (this.mode === 'trot') {
      this.vx = road + k.rel;
      this.x += this.vx;
      this.y = Math.min(ANIMAL_AI.graze, this.y + k.side);
      if (this.y >= ANIMAL_AI.graze) {
        this.mode = 'graze';
        this.reachedShoulder = true;
        this.call();
      }
      if (this.t % 18 === 0) this.world.audio.sfx('ring/zwaan/hooves', { vol: 0.35, pitch: this.kind === 'pig' ? 1.4 : 1 });
    } else if (this.mode === 'graze') {
      this.vx = 0;
    } else if (this.mode === 'wander') {
      // Out of the stopped trailer onto the shoulder: a few steps, then graze.
      this.vx = Math.max(0, this.vx * 0.9);
      this.x += this.vx - 0.3;
      if (this.y < ANIMAL_AI.graze) this.y = Math.min(ANIMAL_AI.graze, this.y + 0.5);
      if (--this.wanderT <= 0) {
        this.mode = 'graze';
        this.reachedShoulder = true;
      }
    }
    if (this.lift > 0 && this.mode !== 'ramp') {
      this.vlift -= 0.3;
      this.lift = Math.max(0, this.lift + this.vlift);
      if (this.lift === 0) this.vlift = 0;
    }
    this.solid = this.mode === 'trot' && this.lift < 4;
    this.obstacleTick();
    if (this.x + this.len < this.world.camera.x - 24) this.remove();
  }

  /** A moo or an oink (rate-limited). */
  private call(): void {
    if (this.world.tick - this.callT < ANIMAL_AI.callGap) return;
    this.callT = this.world.tick;
    this.calls++;
    this.world.audio.sfx(this.kind === 'pig' ? 'ring/zwaan/oink' : 'ring/zwaan/moo', { pitch: 0.92 + (this.look % 4) * 0.05 });
  }

  /** A shot stopped on it: a call and a startled hop; no damage. */
  protected override onShot(): void {
    this.call();
    if (this.lift === 0) this.vlift = 1.1;
  }

  override draw(r: Renderer): void {
    const gait = this.mode === 'graze' ? 'graze' : this.mode === 'ramp' || this.mode === 'wander' ? 'walk' : 'trot';
    const id = this.kind === 'pig' ? VEE_SPR.pig(gait) : VEE_SPR.cow(gait);
    const tpf = gait === 'graze' ? (this.kind === 'pig' ? 12 : 14) : gait === 'walk' ? 7 : this.kind === 'pig' ? 4 : 5;
    const n = gait === 'graze' ? (this.kind === 'pig' ? 2 : 3) : 4;
    const f = Math.floor((this.t + this.look * 5) / tpf) % n;
    drawOpts.flipX = gait === 'graze' ? this.look % 2 === 0 : true;
    drawOpts.flash = false;
    r.sprite(id, f, Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
  }
}

defineEntity(COW_ID, (w, x, y, p) => new ZwaanAnimal(w, x, y, { ...(p ?? NO_PARAMS), kind: 'cow' }), {
  category: 'prop',
  description: 'A cow off the ZWAAN livestock trailer: trots back across the lanes to the hard shoulder and grazes; blocks shots (a moo), a wagon that drives into it pays a cell; NEVER hurt (params mode, host, lx, look).',
});
defineEntity(PIG_ID, (w, x, y, p) => new ZwaanAnimal(w, x, y, { ...(p ?? NO_PARAMS), kind: 'pig' }), {
  category: 'prop',
  description: 'A pig off the ZWAAN livestock trailer: trots back across the lanes to the hard shoulder and roots there; blocks shots (an oink), a wagon that drives into it pays a cell; NEVER hurt (params mode, host, lx, look).',
});

// =============================================================================================
// The lob
// =============================================================================================

const NO_BOXES: readonly Rect[] = [];

export class ZwaanLob extends Entity implements RingDrawable {
  lift: number;
  shadowW = 10;
  readonly kind: 'bale' | 'churn';
  private readonly lift0: number;
  private readonly y0: number;
  private readonly ty: number;
  private readonly ticks: number;
  private readonly arc: number;
  private t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.kind = p.kind === 'churn' ? 'churn' : 'bale';
    this.lift = this.lift0 = paramNum(p, 'lift', 60);
    this.y0 = y;
    this.ty = paramNum(p, 'ty', y);
    this.ticks = Math.max(8, Math.round(paramNum(p, 'ticks', 40)));
    this.arc = paramNum(p, 'arc', 26);
    this.vx = paramNum(p, 'vx', ringOf(world)?.roadSpeed ?? 0);
    this.team = 'enemy';
    this.z = 52;
    this.hitbox = { x: -5, y: -10, w: 10, h: 10 };
    this.despawnMargin = 96;
    this.addTag('ring-bottle', LOB_ID);
  }

  get landY(): number {
    return this.ty;
  }

  get landX(): number {
    return this.x + this.vx * (this.ticks - this.t);
  }

  get ticksLeft(): number {
    return this.ticks - this.t;
  }

  override hurtboxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    this.t++;
    const k = Math.min(1, this.t / this.ticks);
    this.x += this.vx;
    this.y = this.y0 + (this.ty - this.y0) * k;
    this.lift = Math.max(0, this.lift0 * (1 - k) + Math.sin(k * Math.PI) * this.arc);
    if (this.t >= this.ticks) this.land();
  }

  private land(): void {
    const w = this.world;
    w.damageArea({ x: this.x - 11, y: this.y - 7, w: 22, h: 14 }, { amount: 1, kind: 'impact', dirX: -1, source: this, tags: ['thrown'] }, 'enemy');
    if (this.kind === 'bale') {
      debris(w, this.x, this.y - 4, 'plant', 10);
      dust(w, this.x, this.y, 4);
      w.audio.sfx('ring/zwaan/bale-thud');
    } else {
      snowPuff(w, this.x, this.y - 2, 8);
      debris(w, this.x, this.y - 4, 'metal', 3);
      w.audio.sfx('ring/zwaan/churn-clang');
    }
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(this.kind === 'bale' ? VEE_SPR.bale : VEE_SPR.churn, Math.floor(this.t / 3) & 3, Math.round(this.x), Math.round(this.y - this.lift - 5), drawOpts);
  }
}

defineEntity(LOB_ID, (w, x, y, p) => new ZwaanLob(w, x, y, p), {
  category: 'enemy',
  description: 'A hay bale or a milk churn thrown by the ZWAAN farmhand: flies into a lane, 1 cell where it lands (params kind, ty, ticks, vx, lift, arc).',
});
