/**
 * `subway-train` — the Legion metro (GDD §9.5; m4-c1 "The Underground" @800 and @1600).
 *
 * A moving kill zone 400×40 on the track bed. Spawn it with its feet on the track bed (m4-c1:
 * y 192); its x does not matter: it always comes from just outside the view.
 * - Telegraph (120 ticks, × difficulty): the rails spark at the edge it comes from, a headlight
 *   beam sweeps the tunnel and a bell rings `DING DING` (`env/train-bell`, every 60 ticks); the
 *   tunnel rumbles in the last 30 ticks.
 * - Then the train (4 crimson cars with gold stripes and lit windows) runs through the view at
 *   6 px/tick (`env/train-pass`) and leaves on the far side. Everything it touches is hit
 *   (`impact` + tag `hazard`, team neutral): players on the track bed die, vehicles lose all
 *   cells, Legion soldiers on the track are flattened too. Players standing on a station
 *   platform (its top at the train's roof, y 152 in m4-c1) are safe. Invulnerable players (the
 *   respawn blink) are not hurt. Not shootable, no points, never holds a wave.
 * Params: `from` ('right' = passes right to left, default; 'left'), or `dir` (travel
 * direction), `telegraph` (120), `speed` (6), `cars` (4; 100 px each).
 */
import { type Damage, Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { FX_SPARK } from '../../../fx';
import { telegraphTicks } from '../../../enemy';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { travelDir } from './machine';

export const TRAIN = {
  /** One car; the train is `cars` × 100 (400 px). */
  carW: 100,
  cars: 4,
  h: 40,
  speed: 6,
  telegraph: 120,
  /** The bell rings every 60 ticks during the telegraph. */
  bellEvery: 60,
  /** The kill box starts this far under the roof (players on the platform stand on the roof line). */
  roofGap: 2,
  hit: 1000,
} as const;

export const TRAIN_ART = 'machine/subway-train';
const HEAD_SPRITE = `${TRAIN_ART}/head`;
const CAR_SPRITE = `${TRAIN_ART}/car`;

export type TrainState = 'telegraph' | 'run' | 'gone';

const drawOpts: DrawOpts = {};
const beamOpts: DrawOpts = { blend: 'add', alpha: 0.2 };
const NO_BOXES: readonly Rect[] = [];

export class SubwayTrain extends Entity {
  state: TrainState = 'telegraph';
  stateT = 0;
  /** Travel direction (-1 = right to left). */
  readonly dir: 1 | -1;
  readonly speed: number;
  readonly cars: number;
  readonly length: number;
  telegraph: number;
  private readonly killBox: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly killList: Rect[] = [this.killBox];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.type = 'subway-train';
    this.team = 'neutral';
    this.z = 33;
    this.despawnMargin = Infinity; // it removes itself once it has passed
    this.dir = travelDir(p, -1);
    this.facing = this.dir;
    this.speed = Math.max(1, paramNum(p, 'speed', TRAIN.speed));
    this.cars = Math.max(1, Math.min(8, Math.round(paramNum(p, 'cars', TRAIN.cars))));
    this.length = this.cars * TRAIN.carW;
    this.telegraph = Math.max(0, Math.round(paramNum(p, 'telegraph', TRAIN.telegraph)));
    this.hitbox = { x: -this.length / 2, y: -TRAIN.h, w: this.length, h: TRAIN.h };
    // Waiting off-screen until it runs (the anchor is the middle of the train).
    this.x = this.startX();
    this.prevX = this.x;
    const hit: Damage = { amount: TRAIN.hit, kind: 'impact', dirX: this.dir, source: this, tags: ['hazard'] };
    this.contactDamage = hit;
  }

  /** Train centre with its nose just outside the view on the side it comes from. */
  private startX(): number {
    const cam = this.world.camera;
    return this.dir < 0 ? cam.right + 8 + this.length / 2 : cam.left - 8 - this.length / 2;
  }

  /** The edge of the view the train comes from. */
  private entryEdge(): number {
    const cam = this.world.camera;
    return this.dir < 0 ? cam.right : cam.left;
  }

  override update(): void {
    this.stateT++;
    const w = this.world;
    if (this.state === 'telegraph') {
      const T = this.telegraph > 0 ? telegraphTicks(w, this.telegraph) : 0;
      this.x = this.startX();
      if (this.stateT === 1 || (this.stateT - 1) % TRAIN.bellEvery === 0) w.audio.sfx('env/train-bell');
      // The rails spark at the tunnel mouth, more and more.
      const k = T > 0 ? this.stateT / T : 1;
      if (this.stateT % Math.max(2, Math.round(8 - 6 * k)) === 0) {
        const ex = this.entryEdge() - this.dir * w.fxRng.range(2, 20);
        w.particles.burst(FX_SPARK, ex, this.y - 1, 2, 0.6, 2.2, -Math.PI / 2 - this.dir * 0.6, 1.2);
      }
      if (T - this.stateT < 30) w.camera.shake(1, 2);
      if (this.stateT >= T) {
        this.state = 'run';
        this.stateT = 0;
        w.audio.sfx('env/train-pass');
      }
      return;
    }
    if (this.state !== 'run') return;
    this.x += this.dir * this.speed;
    if (this.stateT % 3 === 0) {
      // Wheel sparks along the bogies.
      const back = this.x - this.dir * (this.length / 2 - 10);
      w.particles.burst(FX_SPARK, back + w.fxRng.range(-6, 6), this.y - 2, 2, 0.5, 1.8, -Math.PI / 2 + this.dir * 1.2, 1);
    }
    // Gone when the tail has left the view on the far side.
    const cam = w.camera;
    const tail = this.x - this.dir * (this.length / 2);
    if ((this.dir < 0 && tail < cam.left - 16) || (this.dir > 0 && tail > cam.right + 16)) {
      this.state = 'gone';
      this.dead = true; // done, not killed: it has left the view
      this.remove();
    }
  }

  /** Is the train in the view (running)? */
  get running(): boolean {
    return this.state === 'run';
  }

  override contactBoxes(): readonly Rect[] {
    if (this.state !== 'run') return NO_BOXES;
    const b = this.killBox;
    b.x = this.x - this.length / 2;
    b.y = this.y - TRAIN.h + TRAIN.roofGap;
    b.w = this.length;
    b.h = TRAIN.h - TRAIN.roofGap;
    return this.killList;
  }

  override draw(r: Renderer): void {
    if (this.state === 'telegraph') {
      this.drawBeam(r);
      return;
    }
    if (this.state !== 'run') return;
    const cam = this.world.camera;
    const left = this.x - this.length / 2;
    const y = Math.round(this.y);
    // Cars from the nose back; only the ones in view are drawn.
    for (let i = 0; i < this.cars; i++) {
      const cx = this.dir < 0 ? left + TRAIN.carW * (i + 0.5) : left + this.length - TRAIN.carW * (i + 0.5);
      if (cx + TRAIN.carW / 2 < cam.left - 4 || cx - TRAIN.carW / 2 > cam.right + 4) continue;
      const head = i === 0 || i === this.cars - 1;
      // The head car faces the travel direction; the tail car is a head turned around.
      drawOpts.flipX = i === 0 ? this.dir < 0 : this.dir > 0;
      r.sprite(head ? HEAD_SPRITE : CAR_SPRITE, Math.floor(this.stateT / 3) % 2, Math.round(cx), y, drawOpts);
    }
  }

  /** The headlight: a cone of light that sweeps out of the tunnel mouth and grows brighter. */
  private drawBeam(r: Renderer): void {
    const T = this.telegraph > 0 ? telegraphTicks(this.world, this.telegraph) : 1;
    const k = Math.min(1, this.stateT / T);
    const edge = Math.round(this.entryEdge());
    const ly = Math.round(this.y - 26);
    const sweep = Math.sin(this.stateT / 9) * 10 * (1 - k * 0.6);
    const len = Math.round(60 + 140 * k);
    beamOpts.alpha = 0.08 + 0.2 * k;
    for (let s = 0; s < len; s += 4) {
      const half = Math.round(2 + s * 0.22);
      const cy = Math.round(ly + (sweep * s) / len);
      const x = this.dir < 0 ? edge - s - 4 : edge + s;
      r.rect(x, cy - half, 4, half * 2, PAL.gold[3], beamOpts);
    }
    // The lamp itself, at the tunnel mouth.
    beamOpts.alpha = 0.5 + 0.4 * k;
    r.rect(this.dir < 0 ? edge - 3 : edge, ly - 2, 3, 5, PAL.snow[3], beamOpts);
  }
}

defineEntity('subway-train', (w, x, y, p) => new SubwayTrain(w, x, y, p), {
  category: 'hazard',
  description: 'Subway train 400x40: 120-tick bell / spark / headlight telegraph, then a 6 px/tick kill zone through the view. Params from, telegraph, speed.',
});
