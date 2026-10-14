/**
 * Ambient life of Amsterdam (mission `ams`) and the rideable canal boat: `ams-tour-boat`,
 * `ams-cyclist-bg`, `ams-pigeons`, `ams-ducks`, `ams-window-waver`, `ams-boat-platform`. Params and behaviour:
 * the table at the top of `entities.ts`. Cosmetic entities never allocate per tick and sleep
 * while far off-screen.
 */
import { Entity } from '../../../../engine/entity';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { PAL } from '../../../../engine/palette';
import type { World } from '../../../../engine/world';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { sfxNear } from '../../props/common';
import { isSwan } from '../../vehicles/swan/swan';
import { CYCLIST_LOOKS } from './npc.art';

const drawOpts: DrawOpts = {};
const hazeOpts: DrawOpts = { tint: PAL.sky[3], alpha: 0.28 };
const TAU = Math.PI * 2;
const VIEW_HALF = 192;

/** Is the entity farther than `margin` px outside the view (horizontally)? */
export function farOff(e: Entity, margin: number): boolean {
  return Math.abs(e.x - e.world.camera.centerX) > VIEW_HALF + margin;
}

/** Where a player is for proximity checks: on foot, or the vehicle he rides. Null = absent / dead. */
const where = { x: 0, y: 0, swan: false };
export function playerPos(p: Entity): typeof where | null {
  if (!isPlayer(p) || !p.alive) return null;
  if (p.state === 'mounted' && p.vehicle) {
    where.x = p.vehicle.x;
    where.y = p.vehicle.y;
    where.swan = isSwan(p.vehicle);
    return where;
  }
  if (p.state !== 'play' && p.state !== 'spawn') return null;
  where.x = p.x;
  where.y = p.y;
  where.swan = false;
  return where;
}

/** Nearest player position within dx / dy of (x, y) (fills `where`), or null. */
export function playerNear(world: World, x: number, y: number, dx: number, dy: number): typeof where | null {
  const list = world.players;
  for (let i = 0; i < list.length; i++) {
    const w = playerPos(list[i]);
    if (w && Math.abs(w.x - x) <= dx && Math.abs(w.y - y) <= dy) return w;
  }
  return null;
}

// ============================================================================== ambient

/** The tour boat's diesel loop: plays while the boat is within this margin of the view. */
export const TOUR_BOAT = { sfx: 'ams/tour-boat', margin: 48, vol: 0.6 } as const;

export class AmsTourBoat extends Entity {
  readonly x0: number;
  readonly range: number;
  readonly speed: number;
  private t = 0;
  /** Its engine loop is playing (key `tour-boat-<id>`). */
  private looping = false;
  /** The section or the mission ended ('stopLoops'): the loop stays off. */
  private silenced = false;
  private readonly loopKey: string;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.x0 = x;
    this.range = Math.max(0, paramNum(p, 'range', 480));
    this.speed = Math.max(0, paramNum(p, 'speed', 0.35));
    this.facing = paramNum(p, 'dir', 1) < 0 ? -1 : 1;
    this.z = 4;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -58, y: -28, w: 116, h: 30 };
    this.addTag('npc', 'decor');
    this.loopKey = `tour-boat-${this.id}`;
    world.events.on('stopLoops', () => {
      this.silenced = true;
      this.engine(false);
    });
  }

  /** Start / stop the diesel loop (only on a change: one audio call per transition). */
  private engine(on: boolean): void {
    if (on === this.looping) return;
    this.looping = on;
    if (on) this.world.audio.sfxLoop?.(this.loopKey, TOUR_BOAT.sfx, { vol: TOUR_BOAT.vol });
    else this.world.audio.stopSfx?.(this.loopKey, 20);
  }

  override onRemove(): void {
    this.engine(false);
  }

  override update(): void {
    this.engine(!this.silenced && !farOff(this, TOUR_BOAT.margin));
    if (farOff(this, 320)) return;
    this.t++;
    this.x += this.facing * this.speed;
    if (this.x > this.x0 + this.range) {
      this.x = this.x0 + this.range;
      this.facing = -1;
    } else if (this.x < this.x0) {
      this.x = this.x0;
      this.facing = 1;
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    const bob = Math.round(Math.sin((this.t / 90) * TAU));
    r.sprite('npc/ams/ams-tour-boat', (this.t >> 4) & 1, this.x, this.y + bob, drawOpts);
  }
}

/** A background lane narrower than this in view hides its rider (no loop at the view edge). */
const LANE_MIN = 64;

/** How far up the street (px) the background riders' lane sits above their spawn line. */
export const CYCLIST_LANE_LIFT = 12;

export class AmsCyclistBg extends Entity {
  readonly look: number;
  readonly speed: number;
  readonly minX: number;
  readonly maxX: number;
  /** Alpha of the sky-haze overlay (0 = none). */
  readonly haze: number;
  private t = 0;
  /** The lane shows less than `LANE_MIN` px of the view: the rider is parked off screen. */
  private parked = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.look = Math.max(0, Math.min(CYCLIST_LOOKS - 1, Math.round(paramNum(p, 'look', Math.floor(Math.abs(x) / 37) % CYCLIST_LOOKS))));
    this.speed = Math.max(0.1, paramNum(p, 'speed', 1.2));
    this.facing = paramNum(p, 'dir', 1) < 0 ? -1 : 1;
    this.minX = paramNum(p, 'minX', -Infinity);
    this.maxX = paramNum(p, 'maxX', Infinity);
    this.haze = Math.max(0, Math.min(1, paramNum(p, 'haze', 0.5)));
    this.z = 6;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -17, y: -38, w: 34, h: 38 };
    this.addTag('npc', 'decor');
  }

  override update(): void {
    const cam = this.world.camera;
    // A lane the camera has (almost) left: park the rider instead of looping it at the view edge.
    this.parked = Math.min(this.maxX, cam.right) - Math.max(this.minX, cam.left) < LANE_MIN;
    if (this.parked) return;
    this.t++;
    this.x += this.facing * this.speed;
    const lo = Math.max(this.minX, cam.left - 40);
    const hi = Math.min(this.maxX, cam.right + 40);
    // Endless traffic: out on one side of the (bounded) view, back in on the other.
    if (this.facing > 0 && this.x > hi) this.x = lo - this.world.fxRng.range(0, 60);
    else if (this.facing < 0 && this.x < lo) this.x = hi + this.world.fxRng.range(0, 60);
  }

  override draw(r: Renderer): void {
    if (this.parked) return;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    const f = Math.floor((this.t * this.speed) / 7) & 3;
    const id = `npc/ams/ams-cyclist-bg/${this.look}`;
    const x = this.x;
    // The far bike lane: drawn 12 px up the street from its spawn line, behind every actor (z 6).
    const y = this.y - CYCLIST_LANE_LIFT;
    r.sprite(id, f, x, y, drawOpts);
    if (this.haze > 0) {
      // Depth cue: a light sky haze so the far-lane rider never reads as an enemy rider.
      hazeOpts.flipX = drawOpts.flipX;
      hazeOpts.alpha = this.haze;
      r.sprite(id, f, x, y, hazeOpts);
    }
  }
}

export const PIGEONS = { max: 8, scare: 56, flap: 'swan/flap', takeOff: 'ams/pigeon' } as const;

export class AmsPigeons extends Entity {
  readonly count: number;
  /** The flock took off. */
  fled = false;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly bvx: Float32Array;
  private readonly bvy: Float32Array;
  private readonly dir: Int8Array;
  /** Ground: 0 stand, 1 peck, 2 step; timers per bird. */
  private readonly act: Uint8Array;
  private readonly timer: Uint16Array;
  private t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    const n = Math.max(1, Math.min(PIGEONS.max, Math.round(paramNum(p, 'count', 4))));
    const spread = Math.max(4, paramNum(p, 'spread', 36));
    this.count = n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.bvx = new Float32Array(n);
    this.bvy = new Float32Array(n);
    this.dir = new Int8Array(n);
    this.act = new Uint8Array(n);
    this.timer = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      this.px[i] = x - spread / 2 + (n === 1 ? spread / 2 : (spread * i) / (n - 1));
      this.py[i] = y;
      this.dir[i] = (i + Math.floor(x)) % 2 ? 1 : -1;
      this.timer[i] = 10 + ((i * 23) % 50);
    }
    this.z = 26;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -spread / 2 - 6, y: -10, w: spread + 12, h: 10 };
    this.addTag('npc', 'decor');
  }

  /** Every bird takes off away from `fromX`. */
  scare(fromX: number): void {
    if (this.fled) return;
    this.fled = true;
    const rng = this.world.fxRng;
    for (let i = 0; i < this.count; i++) {
      const away = this.px[i] >= fromX ? 1 : -1;
      this.dir[i] = away;
      this.bvx[i] = away * rng.range(1.1, 2.0);
      this.bvy[i] = -rng.range(1.4, 2.4);
    }
    sfxNear(this.world, this.x, this.y, PIGEONS.flap, 0.5, 1.8);
    sfxNear(this.world, this.x, this.y, PIGEONS.takeOff, 0.8);
  }

  override update(): void {
    this.t++;
    if (!this.fled) {
      if (farOff(this, 200)) return;
      const w = playerNear(this.world, this.x, this.y, PIGEONS.scare + this.hitbox.w / 2, 48);
      if (w) {
        this.scare(w.x);
        return;
      }
      const rng = this.world.fxRng;
      for (let i = 0; i < this.count; i++) {
        if (this.timer[i] > 0) this.timer[i]--;
        else {
          const r = rng.next();
          this.act[i] = r < 0.45 ? 1 : r < 0.75 ? 2 : 0;
          this.timer[i] = this.act[i] === 1 ? 16 : rng.int(20, 60);
          if (this.act[i] === 2 && rng.chance(0.3)) this.dir[i] = -this.dir[i] as -1 | 1;
        }
        if (this.act[i] === 2 && (this.t & 3) === 0) this.px[i] += this.dir[i] * 0.5;
      }
      return;
    }
    let inView = 0;
    const cam = this.world.camera;
    for (let i = 0; i < this.count; i++) {
      this.bvy[i] = Math.max(-3, this.bvy[i] - 0.04);
      this.px[i] += this.bvx[i];
      this.py[i] += this.bvy[i];
      if (this.py[i] > cam.top - 16 && this.px[i] > cam.left - 16 && this.px[i] < cam.right + 16) inView++;
    }
    if (inView === 0) this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flash = false;
    for (let i = 0; i < this.count; i++) {
      let f: number;
      if (this.fled) f = ((this.t + i * 3) >> 2) & 1 ? 3 : 4;
      else f = this.act[i] === 1 ? ((this.t >> 3) & 1 ? 1 : 0) : this.act[i] === 2 ? ((this.t >> 3) & 1 ? 2 : 0) : 0;
      drawOpts.flipX = this.dir[i] < 0;
      r.sprite('npc/ams/ams-pigeons', f, this.px[i], this.py[i], drawOpts);
    }
    drawOpts.flipX = false;
  }
}

/** `quack`: ticks between two idle quacks while the ducks are in view (a startled one is extra). */
export const DUCKS = { max: 4, speed: 0.12, shy: 40, quack: 420, sfx: 'ams/duck' } as const;

/**
 * `ams-ducks`: 1–4 mallards paddling on the canal at the waterline (x, y = the water surface),
 * drifting slowly back and forth within `range` px; they turn away from a player close by.
 * Pure decor: no hitbox interaction.
 */
export class AmsDucks extends Entity {
  readonly count: number;
  private readonly px: Float32Array;
  private readonly dir: Int8Array;
  private readonly x0: number;
  private readonly x1: number;
  private t = 0;
  /** A player was close last tick (the ducks quack when one comes near). */
  private startled = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    const n = Math.max(1, Math.min(DUCKS.max, Math.round(paramNum(p, 'count', 3))));
    const range = Math.max(16, paramNum(p, 'range', 60));
    this.count = n;
    this.x0 = x - range / 2;
    this.x1 = x + range / 2;
    this.px = new Float32Array(n);
    this.dir = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      this.px[i] = x - 6 * (n - 1) + 12 * i;
      this.dir[i] = i % 2 ? -1 : 1;
    }
    this.z = 5;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -range / 2, y: -8, w: range, h: 8 };
    this.addTag('npc', 'decor');
  }

  override update(): void {
    this.t++;
    if (farOff(this, 200)) return;
    const w = playerNear(this.world, this.x, this.y, DUCKS.shy + this.hitbox.w / 2, 64);
    // A quack when a player comes near, and now and then while they paddle in view (tick-based).
    if ((w !== null && !this.startled) || this.t % DUCKS.quack === 0) sfxNear(this.world, this.x, this.y, DUCKS.sfx, 0.7, w ? 1.1 : 1);
    this.startled = w !== null;
    for (let i = 0; i < this.count; i++) {
      if (w && Math.abs(w.x - this.px[i]) < DUCKS.shy) this.dir[i] = w.x < this.px[i] ? 1 : -1;
      this.px[i] += this.dir[i] * DUCKS.speed * (w ? 3 : 1);
      if (this.px[i] < this.x0) this.dir[i] = 1;
      else if (this.px[i] > this.x1) this.dir[i] = -1;
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flash = false;
    for (let i = 0; i < this.count; i++) {
      const f = (i % 2 ? 2 : 0) + (((this.t >> 4) + i) & 1);
      drawOpts.flipX = this.dir[i] < 0;
      r.sprite('npc/ams/ams-ducks', f, this.px[i], this.y, drawOpts);
    }
    drawOpts.flipX = false;
  }
}

export class AmsWindowWaver extends Entity {
  readonly cat: boolean;
  readonly period: number;
  private t: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    const look = p.look;
    this.cat = look === 'cat' || look === 1;
    this.period = Math.max(240, paramNum(p, 'period', 360));
    this.t = Math.floor(Math.abs(x)) % this.period;
    this.z = 3;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -10, y: -26, w: 20, h: 26 };
    this.addTag('npc', 'decor');
  }

  /** Frame of the person strip at phase t: empty → idle → waving → idle → empty. */
  private frame(): number {
    const t = this.t % this.period;
    if (t < 100) return 0;
    if (t < 130) return 1;
    if (t < 250) return ((t - 130) >> 3) & 1 ? 3 : 2;
    if (t < 280) return 1;
    return 0;
  }

  override update(): void {
    if (farOff(this, 120)) return;
    this.t++;
    // A player passing by gets a wave: jump to the waving part if the window is empty.
    if (!this.cat && this.frame() === 0 && (this.t & 7) === 0 && playerNear(this.world, this.x, this.y, 96, 200)) {
      this.t = this.t - (this.t % this.period) + 100;
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    const x = this.x;
    const y = this.y;
    if (this.cat) r.sprite('npc/ams/ams-window-waver/cat', (this.t >> 5) & 1, x, y, drawOpts);
    else r.sprite('npc/ams/ams-window-waver/person', this.frame(), x, y, drawOpts);
  }
}

// ============================================================================== boat platform

export class AmsBoatPlatform extends Entity {
  readonly box: SolidBox;
  readonly w: number;
  readonly x0: number;
  readonly range: number;
  readonly speed: number;
  private readonly baseY: number;
  private readonly bob: number;
  private readonly period: number;
  private readonly pause: number;
  private wait = 0;
  private t = 0;
  /** Exact (sub-pixel) centre x; the solid moves in whole steps. */
  private fx: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.w = Math.max(24, Math.min(60, paramNum(p, 'w', 52)));
    this.x0 = x;
    this.fx = x;
    this.range = Math.max(0, paramNum(p, 'range', 160));
    this.speed = Math.max(0, paramNum(p, 'speed', 0.5));
    this.facing = paramNum(p, 'dir', 1) < 0 ? -1 : 1;
    this.baseY = y;
    this.bob = paramNum(p, 'bob', 1);
    this.period = Math.max(16, paramNum(p, 'period', 120));
    this.pause = Math.max(0, paramNum(p, 'pause', 40));
    this.z = 22;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -this.w / 2, y: 0, w: this.w, h: 14 };
    this.addTag('prop', 'platform', 'moving-platform');
    this.box = world.addSolid(new SolidBox(x - this.w / 2, y, this.w, 4, true, this));
  }

  get top(): number {
    return this.box.y;
  }

  override update(): void {
    this.t++;
    if (this.range > 0 && this.speed > 0) {
      if (this.wait > 0) this.wait--;
      else {
        this.fx += this.facing * this.speed;
        if (this.fx >= this.x0 + this.range) {
          this.fx = this.x0 + this.range;
          this.facing = -1;
          this.wait = this.pause;
        } else if (this.fx <= this.x0) {
          this.fx = this.x0;
          this.facing = 1;
          this.wait = this.pause;
        }
      }
    }
    const tx = Math.round(this.fx - this.w / 2);
    const ty = this.baseY + Math.round(this.bob * Math.sin((this.t / this.period) * TAU));
    const dx = tx - this.box.x;
    const dy = ty - this.box.y;
    if (dx !== 0 || dy !== 0) this.world.moveSolid(this.box, dx, dy);
    this.x = this.box.x + this.w / 2;
    this.y = this.box.y;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    r.sprite('decor/ams/ams-boat-platform', (this.t >> 4) & 1, this.x, this.y, drawOpts);
  }
}

// ============================================================================== registry

defineEntity('ams-tour-boat', (w, x, y, p) => new AmsTourBoat(w, x, y, p), { category: 'npc', description: 'ams ambient canal tour boat gliding back and forth.' });
defineEntity('ams-cyclist-bg', (w, x, y, p) => new AmsCyclistBg(w, x, y, p), { category: 'npc', description: 'ams ambient background cyclist (endless traffic).' });
defineEntity('ams-ducks', (w, x, y, p) => new AmsDucks(w, x, y, p), { category: 'npc', description: 'ams ducks paddling on the canal (pure decor); params count, range.' });
defineEntity('ams-pigeons', (w, x, y, p) => new AmsPigeons(w, x, y, p), { category: 'npc', description: 'ams pigeon flock: pecks, flies up when a player comes near.' });
defineEntity('ams-window-waver', (w, x, y, p) => new AmsWindowWaver(w, x, y, p), { category: 'npc', description: 'ams canal-house window with a waving person (or a cat).' });
defineEntity('ams-boat-platform', (w, x, y, p) => new AmsBoatPlatform(w, x, y, p), { category: 'prop', description: 'ams small canal boat: moving one-way platform.' });
