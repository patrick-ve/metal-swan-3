/**
 * THE ZWAAN KIT (logic) — shared by all five parts of the ZWAAN train (docs/design/ring.md §R.3;
 * docs/api/ring.md "ZWAAN train: controller, container, cab"). Owner: TRAIN-1; TRAIN-2 builds its
 * parts on it. The art side is `art-kit.ts` (materials, the livery, the kit sprites).
 *
 * Every part is drawn and moves in its own LOCAL coordinates: x = 0 is its REAR end (the anchor),
 * `length` px forward is its FRONT (where its drawbar reaches into the part in front), y = 0 the
 * road under it (its lane's plane y), up negative. The kit gives:
 *
 * - `ZWAAN_KIT`: the shared geometry (the hitch height, the drawbar, the dolly, the wheel radius);
 * - drawing: `drawZwaanShadow` (the soft road shadow under the whole part: the runner's shadow pass
 *   centres a shadow on the anchor, which is the rear here), `drawZwaanWheels` (the shared wheel
 *   strip `ring/car/wheel-l`, or the blown tyre's rim), `drawZwaanDolly` (the converter dolly under a
 *   trailer's front: its frame and two wheels), `drawZwaanCoupling` (the drawbar from a part's front
 *   into the hitch of the part in front: coupled level, or loose: dropped onto the road),
 *   `drawZwaanHitch` (the towing jaw at a part's rear);
 * - the UNCOUPLE look (`uncoupleFx`: the clank, the coupling sparks), damage smoke (`zwaanSmoke`);
 * - touch (`pushWagonsOut`): a driven wagon in a part's slab is pushed out (from behind it stays
 *   behind the tailgate; beside it goes to the lane away from the part), one bump per wagon per
 *   `ZWAAN_KIT.touchGap` ticks;
 * - lanes (`laneFreeBeside`): no car, closure, forklift or other road blocker beside a part in a lane
 *   (a weave never goes into a car);
 * - shots (`zwaanShot`): an enemy bullet from a part (the road speed added, the difficulty's speed).
 *
 * Sound ids of the kit (synth, sfx/ring-zwaan-a.ts): `ZWAAN_SFX`.
 */
import type { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { drawShadow, hitSpark, smokeTrail } from '../../../fx';
import { Projectile } from '../../../projectile';
import { ringOf } from '../../../ring/entity';
import { DEPTH_HALF, LANE_COUNT, laneY, nearestLane } from '../../../ring/lanes';
import { WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, slabsTouch, wagonSlab } from '../traffic/road-kit';
import { ZWAAN } from './api';

/** Shared geometry of the train (local px; see the header). */
export const ZWAAN_KIT = {
  /** Height of the couplings (the drawbar's eye, the towing jaw) above the road. */
  hitchY: -12,
  /** The drawbar: it starts this far behind the part's front (its pivot on the dolly) … */
  drawbarBack: 16,
  /** … and its eye sits this far into the part in front (past the coupling gap). */
  drawbarEye: 3,
  /** The converter dolly under a trailer's front: its middle this far behind the front, its axles. */
  dollyBack: 26,
  dollyAxles: [-7, 7] as readonly number[],
  /** Wheel radius of the shared strip `ring/car/wheel-l` (and the rim's). */
  wheelR: 7.5,
  rimR: 6,
  /** One bump per wagon per this many ticks (touch). */
  touchGap: 24,
} as const;

/**
 * THE PACE of every part (momentum, docs/design/ring.md §R.3, R.13: each part 30–40 s with the
 * machine gun, ≥ 25 s with the best gun). The damage-rate bucket (part.ts) caps what any gun does
 * at the part's rate (`zwaanRate(hp)`, × difficulty × co-op like the HP), so a part lasts at least
 * `floorTicks` with any gun (the full bucket's burst included); the pistol (the bot: about 0.7–0.9
 * HP per tick) is slower than the cap. Measured with the ring bot (2026-10-22): docs/api/ring.md.
 * FIXER (2026-10-22): the flat rate 1.1 let the machine gun and the laser beat the tanker, the
 * livestock trailer and the cab in 22–23 s (under the 25 s floor; the burst came on top); every
 * part's rate is now (hp − burst) / floorTicks with a 30 s floor, so the special guns take 30–33 s.
 */
export const ZWAAN_PACE = {
  trailerHp: 2050,
  /**
   * INTEGRATOR (wave A momentum tuning, 2026-10-22; docs/design/ring.md §R "Status"): the ring bot
   * now aims at the exposed weak points, which wakes the parts' extra attacks; at the builders' HP the
   * tanker, the livestock trailer and the cab took 43–50 s (seeds 1–5, pistol and machine gun).
   * Their pools now aim at ~35 s; each part's rate = its HP / `floorTicks`, so the best gun still
   * needs ≥ 25 s (the spec's floor). Was: cab 2200, tank 0.83 × 2050, vee 0.88 × 2050.
   */
  cabHp: 1650,
  tankHp: 1300,
  veeHp: 1360,
  /** The best gun's floor per part (ticks: 30 s, the burst included; `zwaanRate`). */
  floorTicks: 1800,
} as const;

/** A part's damage rate (HP per tick of its base pool `hp`): the best gun needs `floorTicks`. */
export function zwaanRate(hp: number): number {
  return Math.max(0.05, (hp - ZWAAN.rate.burst) / ZWAAN_PACE.floorTicks);
}

/** Sprite ids of the kit (art-kit.ts draws them; all under `boss/ring-zwaan/kit/`). */
export const ZWAAN_KIT_ART = 'boss/ring-zwaan/kit/';
export const KIT_SPR = {
  /** The drawbar: 0 coupled (level, the eye in the jaw ahead), 1 loose (dropped, its eye on the road). Anchor: the part's FRONT on the road. */
  drawbar: `${ZWAAN_KIT_ART}drawbar`,
  /** The towing jaw at a part's rear (anchor: the part's REAR on the road). */
  hitch: `${ZWAAN_KIT_ART}hitch`,
  /** The converter dolly's frame (no wheels; anchor: its middle on the road). */
  dolly: `${ZWAAN_KIT_ART}dolly`,
  /** A blown tyre on its rim (centre anchor, 4 turn frames). */
  rim: `${ZWAAN_KIT_ART}rim`,
  /** The shared road wheel (the ring's car strip; 4 turn frames, centre anchor). */
  wheel: 'ring/car/wheel-l',
} as const;

/** Synth sound ids of the train (sfx/ring-zwaan-a.ts; TRAIN-2 adds its own in ring-zwaan-b.ts). */
export const ZWAAN_SFX = {
  /** The coupling lets go: a heavy clank and a ring. */
  clank: 'ring/zwaan-clank',
  /** The drawbar's pin pops: a sharp snap. */
  snap: 'ring/zwaan-snap',
  /** A part tips over onto the hard shoulder: a crunch and a long scrape. */
  tip: 'ring/zwaan-tip',
  /** The cab's air horn (every lane change). */
  horn: 'ring/zwaan-horn',
  /** The gunner: the sleeper window slides open, the gun is cocked (the tell) … */
  window: 'ring/zwaan-window',
  /** … and his shots. */
  gunner: 'ring/zwaan-gunner',
  /** The brake check: the brakes squeal and the air hisses. */
  squeal: 'ring/zwaan-squeal',
} as const;

const drawOpts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------

/** The soft road shadow under a whole part (rear at world x, plane y). */
export function drawZwaanShadow(r: Renderer, x: number, y: number, length: number, alpha = 0.4): void {
  drawShadow(r, x + length / 2, y, length - 6, alpha);
}

/**
 * Wheels on the road under a part: at local x `xs` from its rear at world (x, y), turning with
 * `roll` (px driven). `rims` draws the blown tyres; `flash` the hit flash.
 */
export function drawZwaanWheels(r: Renderer, x: number, y: number, xs: readonly number[], roll: number, o: { rims?: boolean; flash?: boolean } = {}): void {
  const f = Math.floor(roll / 2.5) & 3;
  drawOpts.flipX = false;
  drawOpts.flash = o.flash === true;
  const rx = Math.round(x);
  const ry = Math.round(y);
  for (const wx of xs) {
    if (o.rims) r.sprite(KIT_SPR.rim, f, rx + wx, ry - Math.round(ZWAAN_KIT.rimR + 0.5), drawOpts);
    else r.sprite(KIT_SPR.wheel, f, rx + wx, ry - Math.round(ZWAAN_KIT.wheelR + 0.5), drawOpts);
  }
  drawOpts.flash = false;
}

/** The converter dolly under a trailer's front (its frame and its two wheels); `front` = the part's front world x. */
export function drawZwaanDolly(r: Renderer, front: number, y: number, roll: number, flash = false): void {
  const cx = Math.round(front - ZWAAN_KIT.dollyBack);
  drawOpts.flipX = false;
  drawOpts.flash = flash;
  r.sprite(KIT_SPR.dolly, 0, cx, Math.round(y), drawOpts);
  drawZwaanWheels(r, cx, y, ZWAAN_KIT.dollyAxles, roll, { flash });
}

/** The drawbar at a part's front (world x): `loose` = uncoupled (dropped onto the road). */
export function drawZwaanCoupling(r: Renderer, front: number, y: number, loose = false): void {
  drawOpts.flipX = false;
  drawOpts.flash = false;
  r.sprite(KIT_SPR.drawbar, loose ? 1 : 0, Math.round(front), Math.round(y), drawOpts);
}

/** The towing jaw at a part's rear (world x). */
export function drawZwaanHitch(r: Renderer, rear: number, y: number): void {
  drawOpts.flipX = false;
  drawOpts.flash = false;
  r.sprite(KIT_SPR.hitch, 0, Math.round(rear), Math.round(y), drawOpts);
}

// ---------------------------------------------------------------------------------------------
// The uncouple, damage
// ---------------------------------------------------------------------------------------------

/**
 * The uncouple at a part's front (world x, plane y), tick `t` of it (0 = the clank): the clank and
 * the snap of the pin on the first tick, sparks off the coupling every other tick.
 */
export function uncoupleFx(world: World, front: number, y: number, t: number): void {
  if (t === 0) {
    world.audio.sfx(ZWAAN_SFX.clank);
    world.camera.shake(2, 8);
  }
  if (t === 4) world.audio.sfx(ZWAAN_SFX.snap);
  if (t % 2 === 0) hitSpark(world, front + 4, y + ZWAAN_KIT.hitchY, t % 4 === 0 ? 1 : -1);
}

/**
 * Damage smoke of a part: at a damage state 1 a light puff every 11 ticks, 2 a dark one every 5,
 * from one of the local points `pts` (relative to its rear at world (x, y)) in turn.
 */
export function zwaanSmoke(world: World, x: number, y: number, state: number, t: number, pts: readonly (readonly [number, number])[]): void {
  if (state <= 0 || pts.length === 0) return;
  const every = state >= 2 ? 5 : 11;
  if (t % every !== 0) return;
  const p = pts[Math.floor(t / every) % pts.length];
  smokeTrail(world, x + p[0], y + p[1], state >= 2);
}

// ---------------------------------------------------------------------------------------------
// Touch and lanes
// ---------------------------------------------------------------------------------------------

const slab: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * A driven wagon in the slab [x0, x1) of a part (world x; its plane y ± DEPTH_HALF) is pushed out:
 * from behind (its nose within `rearGrace` px of x0) it stays behind the tailgate and is shoved back;
 * beside it goes to the lane away from the part (always onto the road). One bump per wagon per
 * `ZWAAN_KIT.touchGap` ticks costs `cost` cells (½ by default; a weave into it 1). Returns the number
 * of wagons it touched.
 */
export interface PushOpts {
  cost?: number;
  rearCost?: number;
  rearGrace?: number;
}
const NO_PUSH: PushOpts = {};

export function pushWagonsOut(part: Entity, x0: number, x1: number, touched: WeakMap<Wagon, number>, o: PushOpts = NO_PUSH): number {
  const world = part.world;
  slab.x = x0;
  slab.w = x1 - x0;
  slab.y = part.y - DEPTH_HALF;
  slab.h = DEPTH_HALF * 2;
  const list = drivenWagons(world);
  const road = ringOf(world)?.roadSpeed ?? 0;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!slabsTouch(wagonSlab(w), slab)) continue;
    n++;
    const nose = w.x + WAGON_W / 2;
    const ready = world.tick - (touched.get(w) ?? -999) >= ZWAAN_KIT.touchGap;
    if (nose < x0 + (o.rearGrace ?? 16)) {
      w.x = x0 - WAGON_W / 2 - 1;
      if (w.sideV > -road * 0.2) w.sideV = -0.6;
      if (ready) {
        touched.set(w, world.tick);
        w.bump({ dx: -1, cost: o.rearCost ?? o.cost ?? 0.5, source: part });
      }
      continue;
    }
    let away = w.y >= part.y ? 1 : -1;
    const lane = nearestLane(part.y);
    const open = ringOf(world)?.lanesOpenAt(w.x) ?? LANE_COUNT;
    if (away < 0 && lane <= 1) away = 1;
    else if (away > 0 && lane >= open) away = -1;
    w.y = part.y + away * (DEPTH_HALF * 2 + 0.2);
    if (ready) {
      touched.set(w, world.tick);
      w.bump({ dy: away, cost: o.cost ?? 0.5, source: part });
    }
  }
  return n;
}

const BLOCKERS = ['ring-car', 'ring-closure', 'ring-forklift', 'ring-block'] as const;

/**
 * Is lane `lane` free beside a part between world x0 … x1 (no civilian car, closure, forklift or
 * other road blocker but `self` in it)? A weave checks it on every tick of its tell.
 */
export function laneFreeBeside(world: World, self: Entity, lane: number, x0: number, x1: number): boolean {
  const y = laneY(lane);
  for (const tag of BLOCKERS) {
    const list = world.byTag(tag);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === self || !e.alive || Math.abs(e.y - y) > 10) continue;
      const ex0 = e.facing < 0 ? e.x - e.hitbox.x - e.hitbox.w : e.x + e.hitbox.x;
      if (ex0 < x1 && ex0 + e.hitbox.w > x0) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------------------------

/** An enemy bullet from a part at world (x, plane y) at `angle` (rad; π = back along the lane), `speed` on screen. */
export function zwaanShot(owner: Entity, x: number, y: number, angle: number, speed: number, type: string): Projectile {
  const w = owner.world;
  const s = speed * difficultyOf(w).enemyBulletSpeed;
  return Projectile.spawn(w, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s + (ringOf(w)?.roadSpeed ?? 0),
    vy: Math.sin(angle) * s,
    damage: 10,
    kind: 'bullet',
    sprite: 'weapon/enemy-bullet',
    w: 6,
    h: 3,
    life: 150,
    offscreen: 32,
    shooter: owner,
    type,
  });
}
