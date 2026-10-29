/**
 * The shotgun's fire blast (GDD §5; picked by the user on 2026-10-29 from five looks): the
 * cosmetic layer of every `ShotgunBlast` the shotgun fires (art: shotgun-fire.art.ts).
 *
 * | tick | what shows |
 * |---|---|
 * | 0–15 | one big fire blast at the muzzle, 10 % longer than the damage cone (peak t4), then it tears into five fire puffs; the bloom on the barrel; nine sparks; a shake of 3 px over 10 ticks |
 * | 0–10 | a warm glow pooled on the floor under the cone (additive) |
 * | 0–~25 | ten burning embers thrown along the cone: they arc, fall and bounce once on the floor |
 * | ~25–75 | the embers smoulder where they lie (30–55 ticks), their glow pulsing and dying to ash |
 * | 8–72 | a dark smoke cloud of three big puffs that swells, rises and lingers ~60 ticks |
 * | 12–33 | small grey-brown smoke puffs where the fire puffs die |
 *
 * At a wall the fire is cut where the cone meets it (the strip is drawn through `DrawOpts.src`),
 * the sparks glance off it and flames splash along it.
 *
 * How it draws: per shot one pooled `FxEntity` for the fire (34 ticks, z 60) and one for the cloud
 * (73 ticks, z 58: every cloud stays behind every fire). Their sprite ids are never registered, so
 * the fx calls its `fallback` every frame, which draws the strip (clipped) and the smoke. The fx
 * carries the aim in `angle`, the visible reach in `scale` and the turn in `flipX` / `flipY`. Plus
 * the bloom (4 ticks) and the floor glow (11 ticks).
 *
 * Caps: at most 24 embers alive per world (counted by their expiry tick). When the same shooter
 * fires again, its old cloud fades out over 14 ticks, so with fire held at most two clouds show (one
 * fading). Cosmetic only: the embers are particles (they never hurt anyone), the rng is
 * `world.fxRng` and the particles' own, and nothing here changes the cone, its hits or its timing.
 */
import type { Entity } from '../../../engine/entity';
import { PAL } from '../../../engine/palette';
import type { ParticlePreset } from '../../../engine/particles';
import type { DrawOpts, Renderer, SrcRect } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { FX_FLAME, FxEntity, muzzleFlash } from '../../fx';
import type { ShotgunBlast } from './shots';
import {
  CLOUD_FRAMES,
  CLOUD_ID,
  CLOUD_TPF,
  CONE_REACH,
  EMBER_FRAMES,
  EMBER_ID,
  EMBER_TPF,
  FIRE_PUFFS,
  FIRE_STYLE,
  GLOW_ID,
  SMOKE_FRAMES,
  SMOKE_ID,
  SMOKE_TPF,
  fireFrameAt,
  firePuffEnd,
  upGeom,
} from './shotgun-fire.art';

/** Hot sparks flying past the tip (additive). */
const FIRE_SPARK: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [11, 18],
  gravity: 0.06,
  drag: 0.94,
  colors: [PAL.fire[6], PAL.gold[3], PAL.fire[4], PAL.fire[3], PAL.fire[1]],
  additive: true,
  fadeFrom: 0.6,
  ground: 'bounce',
  bounce: 0.35,
};

/** A burning ember: a sprite particle that arcs, bounces once on the floor and smoulders. */
const EMBER_P: ParticlePreset = {
  kind: 'sprite',
  sprite: EMBER_ID,
  ticksPerFrame: EMBER_TPF,
  life: [50, 75],
  gravity: 0.22,
  drag: 0.985,
  fadeFrom: 0.82,
  ground: 'bounce',
  bounce: 0.3,
  friction: 0.5,
  randomFlip: true,
};

/** The fire's tongues lick up to here (logical px from the muzzle). */
const MAX_REACH = 98;
/** Lifetime of the fire fx (the strip, then its small smoke). */
const FIRE_LIFE = 34;
/** Small smoke: the tick the first puff starts, the gap between puffs, opacity, rise and drift per tick. */
const SMOKE_FROM = 12;
const SMOKE_GAP = 1.2;
const SMOKE_ALPHA = 0.8;
const SMOKE_RISE = 0.32;
const SMOKE_DRIFT = 0.16;

/** Embers per shot and alive at once (per world). */
const EMBERS_PER_SHOT = 10;
const EMBER_CAP = 24;
const EMBER_LIFE_MAX = EMBER_FRAMES * EMBER_TPF - 3;
/** Expiry ticks of the embers alive, per world (the cap). */
const emberExpiry = new WeakMap<World, number[]>();

/** The three big cloud puffs: local position, the tick they start. */
const CLOUD: ReadonlyArray<{ u: number; v: number; st: number }> = [
  { u: 38, v: -5, st: 8 },
  { u: 60, v: -9, st: 10 },
  { u: 80, v: -3, st: 12 },
];
const CLOUD_TICKS = CLOUD_FRAMES * CLOUD_TPF;
const CLOUD_ALPHA = 0.82;
const CLOUD_LIFE = CLOUD[CLOUD.length - 1].st + CLOUD_TICKS + 1;
/** Ticks an old cloud takes to fade out when its shooter fires again. */
const CLOUD_HANDOVER = 14;

/** Driver ids of the fire and the cloud fx (never registered: the fx calls its fallback). */
const FIRE_DRIVER = `${FIRE_STYLE.id}@fire`;
const CLOUD_DRIVER = `${CLOUD_ID}@fire`;
const FIRE_UP = `${FIRE_STYLE.id}-up`;

const drawOpts: DrawOpts = {};
const cloudOpts: DrawOpts = {};
const clip: SrcRect = { x: 0, y: 0, w: 0, h: 0 };
const pt: [number, number] = [0, 0];

/** Does a shot at `angle` point up or down (the up strip) rather than left or right? */
function isVertical(angle: number): boolean {
  return Math.abs(Math.sin(angle)) > 0.7;
}

/**
 * World position of local (u along the shot, v across) for an fx of the fire: the same turn as
 * the strip it draws (right, left = flipX, up, down = flipY of up).
 */
function localToWorld(fx: FxEntity, u: number, v: number, out: [number, number]): [number, number] {
  if (isVertical(fx.angle)) {
    out[0] = fx.x + v;
    out[1] = fx.flipY ? fx.y + u : fx.y - u;
  } else {
    out[0] = fx.flipX ? fx.x - u : fx.x + u;
    out[1] = fx.y + v;
  }
  return out;
}

/** The fire fx: its small smoke puffs behind, then the strip, cut where the cone met a wall. */
function drawFire(r: Renderer, fx: FxEntity): void {
  const s = FIRE_STYLE;
  const t = fx.t;
  const reach = fx.scale;
  // Smoke first (behind the fire): where each puff dies, rising and drifting on.
  for (let p = 0; p < FIRE_PUFFS; p++) {
    const st = SMOKE_FROM + Math.round(p * SMOKE_GAP);
    const age = t - st;
    if (age < 0 || age >= SMOKE_FRAMES * SMOKE_TPF) continue;
    const [u0, v0] = firePuffEnd(s, p);
    const u = u0 + age * SMOKE_DRIFT;
    if (u > reach - 3) continue;
    localToWorld(fx, u, v0, pt);
    drawOpts.flipX = (p & 1) === 1;
    drawOpts.flipY = false;
    // Fades as it spreads (the frames thin out too).
    const k = age / (SMOKE_FRAMES * SMOKE_TPF);
    drawOpts.alpha = SMOKE_ALPHA * (1 - k * k);
    drawOpts.blend = 'normal';
    drawOpts.src = undefined;
    r.sprite(SMOKE_ID, Math.floor(age / SMOKE_TPF), pt[0], pt[1] - age * SMOKE_RISE, drawOpts);
  }
  const i = fireFrameAt(t);
  if (i < 0) {
    // Only smoke left: step behind the fire of the next shot (pooled fx keep their old ids, so a
    // z tie could draw this smoke over the new fire).
    fx.z = 59;
    return;
  }
  const vertical = isVertical(fx.angle);
  const g = vertical ? upGeom(s) : s;
  drawOpts.flipX = !vertical && fx.flipX;
  drawOpts.flipY = vertical && fx.flipY;
  drawOpts.alpha = 1;
  drawOpts.blend = 'normal';
  // Cut the fire where the shot meets a wall (unflipped frame px; the flip mirrors the cut).
  drawOpts.src = undefined;
  const cut = Math.ceil(reach);
  if (vertical && cut < g.oy) {
    clip.x = 0;
    clip.y = g.oy - cut;
    clip.w = g.w;
    clip.h = g.h - clip.y;
    drawOpts.src = clip;
  } else if (!vertical && g.ox + cut < g.w) {
    clip.x = 0;
    clip.y = 0;
    clip.w = g.ox + cut;
    clip.h = g.h;
    drawOpts.src = clip;
  }
  // A mirrored frame keeps its anchor column / row: one px back so the fire starts at the muzzle.
  r.sprite(vertical ? FIRE_UP : s.id, i, fx.x - (drawOpts.flipX ? 1 : 0), fx.y - (drawOpts.flipY ? 1 : 0), drawOpts);
}

/** The cloud fx: three big soot puffs along the far half of the cone. */
function drawCloud(r: Renderer, fx: FxEntity): void {
  const t = fx.t;
  // Cut short when the shooter fired again: fade out over the ticks left.
  const out = Math.min(1, (fx.life - t) / CLOUD_HANDOVER);
  for (let k = 0; k < CLOUD.length; k++) {
    const p = CLOUD[k];
    const age = t - p.st;
    if (age < 0 || age >= CLOUD_TICKS) continue;
    const u = p.u * FIRE_STYLE.len + age * 0.07;
    if (u > fx.scale - 4) continue;
    localToWorld(fx, u, p.v, pt);
    const a = age / CLOUD_TICKS;
    cloudOpts.alpha = CLOUD_ALPHA * Math.min(1, age / 4 + 0.35) * (1 - a * a) * out;
    if (cloudOpts.alpha < 0.03) continue;
    cloudOpts.flipX = (k & 1) === 1;
    cloudOpts.blend = 'normal';
    r.sprite(CLOUD_ID, Math.floor(age / CLOUD_TPF), pt[0], pt[1] - age * 0.2, cloudOpts);
  }
}

/** One shot's muzzle and aim (from the blast). */
interface Shot {
  world: World;
  x: number;
  y: number;
  angle: number;
  dirX: number;
  dirY: number;
  vertical: boolean;
}

const shot: Shot = { world: null as unknown as World, x: 0, y: 0, angle: 0, dirX: 1, dirY: 0, vertical: false };

/**
 * How far the fire may reach along the shot: the cone's length when a wall cut it, else up to
 * `MAX_REACH` (the tongues lick past the tip) or the first solid on the centre line.
 */
function fireReach(s: Shot, blast: ShotgunBlast): number {
  if (blast.len < CONE_REACH - 0.5) return blast.len;
  const t = s.world.terrain;
  for (let u = CONE_REACH; u <= MAX_REACH; u += 2) {
    if (t.isSolid(s.x + s.dirX * u, s.y + s.dirY * u)) return u;
  }
  return MAX_REACH;
}

/** A driver fx at the muzzle (the fire stays where it was fired). */
function spawnDriver(s: Shot, sprite: string, life: number, z: number, reach: number, draw: (r: Renderer, fx: FxEntity) => void): FxEntity {
  return FxEntity.spawn(s.world, {
    sprite,
    x: s.x,
    y: s.y,
    angle: s.angle,
    scale: reach,
    flipX: !s.vertical && s.dirX < 0,
    flipY: s.vertical && s.dirY > 0,
    life,
    z,
    fallback: draw,
  });
}

/** The last cloud of each shooter (to hand over to the next shot's cloud). */
const lastCloud = new WeakMap<Entity, { fx: FxEntity; x: number; y: number }>();

/** Spawn the shot's smoke cloud; the shooter's previous cloud fades out. */
function spawnCloud(s: Shot, reach: number, shooter: Entity | null): void {
  const prev = shooter ? lastCloud.get(shooter) : undefined;
  // Pooled: make sure the fx is still that cloud (same driver id, same place).
  if (prev && !prev.fx.removed && prev.fx.sprite === CLOUD_DRIVER && prev.fx.x === prev.x && prev.fx.y === prev.y) {
    prev.fx.life = Math.min(prev.fx.life, prev.fx.t + CLOUD_HANDOVER);
  }
  const fx = spawnDriver(s, CLOUD_DRIVER, CLOUD_LIFE, 58, reach, drawCloud);
  if (prev) {
    prev.fx = fx;
    prev.x = fx.x;
    prev.y = fx.y;
  } else if (shooter) lastCloud.set(shooter, { fx, x: fx.x, y: fx.y });
}

/** The bloom on the barrel (the flash family `fx/muzzle-shotgun`): follows the gun for its 4 ticks, over the fire. */
function spawnBloom(s: Shot, shooter: Entity | null): void {
  muzzleFlash(s.world, s.x, s.y, s.angle, { kind: 'heavy', weapon: 'shotgun', follow: shooter }).z = 62;
}

/**
 * `count` hot sparks along the cone that fly on past the tip (or glance off the wall); at a wall
 * a splash of flame spreads along it.
 */
function sparks(s: Shot, reach: number, count: number, speed: number): void {
  const p = s.world.particles;
  const nx = -s.dirY;
  const ny = s.dirX;
  for (let j = 0; j < count; j++) {
    const u = reach * (0.42 + (0.4 * j) / Math.max(1, count - 1));
    const v = (j % 2 === 0 ? -1 : 1) * (3 + 7 * (u / CONE_REACH)) * ((j % 3) / 2 + 0.4);
    p.burst(FIRE_SPARK, s.x + s.dirX * u + nx * v, s.y + s.dirY * u + ny * v, 1, 3.4 * speed, 5.6 * speed, s.angle + v * 0.02, 0.36);
  }
  if (reach < CONE_REACH - 0.5) {
    // The fire splashes along the wall: flames up and down it, sparks thrown back.
    const wx = s.x + s.dirX * (reach - 1);
    const wy = s.y + s.dirY * (reach - 1);
    const along = Math.atan2(ny, nx);
    p.burst(FX_FLAME, wx, wy, 3, 0.8, 1.8, along, 0.7);
    p.burst(FX_FLAME, wx, wy, 3, 0.8, 1.8, along + Math.PI, 0.7);
    p.burst(FIRE_SPARK, wx, wy, 4, 1.5, 3, s.angle + Math.PI, 1.6);
  }
}

/** Throw up to `EMBERS_PER_SHOT` burning embers along the cone (the cap permitting). */
function throwEmbers(s: Shot, reach: number): void {
  const world = s.world;
  let list = emberExpiry.get(world);
  if (!list) {
    list = [];
    emberExpiry.set(world, list);
  }
  const now = world.tick;
  for (let i = list.length - 1; i >= 0; i--) if (list[i] <= now) list.splice(i, 1);
  const n = Math.min(EMBERS_PER_SHOT, EMBER_CAP - list.length);
  if (n <= 0) return;
  const rng = world.fxRng;
  const nx = -s.dirY;
  const ny = s.dirX;
  const span = Math.min(reach, CONE_REACH) - 4;
  for (let j = 0; j < n; j++) {
    const u = span * (0.18 + (0.78 * (j + rng.next() * 0.8)) / n);
    const half = 7 + 12 * (u / CONE_REACH);
    const v = (rng.next() * 2 - 1) * half * 0.8;
    const x = s.x + s.dirX * u + nx * v;
    const y = s.y + s.dirY * u + ny * v;
    let vx: number;
    let vy: number;
    if (s.vertical) {
      // Up: thrown high and out to the sides; down: hurled at the floor, they bounce off it.
      vx = (v >= 0 ? 1 : -1) * rng.range(0.4, 1.4);
      vy = s.dirY * rng.range(1.0, 2.4);
    } else {
      // Forward and up: a high arc, the far ones flung further.
      vx = s.dirX * rng.range(0.7, 1.2 + 1.4 * (u / CONE_REACH));
      vy = -rng.range(1.1, 2.4);
    }
    const life = Math.min(EMBER_LIFE_MAX, rng.int(50, 75));
    world.particles.emit(EMBER_P, x, y, vx, vy, life);
    list.push(now + life);
  }
}

/** The warm glow pooled on the floor under the cone (or where a down shot hits it). */
function floorGlow(s: Shot, reach: number): void {
  if (s.vertical && s.dirY < 0) return;
  const mid = s.vertical ? 0 : Math.min(reach, CONE_REACH * FIRE_STYLE.len) * 0.5;
  const gx = s.x + s.dirX * mid;
  const floor = s.world.terrain.surfaceY(gx, s.y - 2, s.y + (s.vertical ? reach + 6 : 44));
  if (!Number.isFinite(floor)) return;
  FxEntity.spawn(s.world, {
    sprite: GLOW_ID,
    x: gx,
    y: floor,
    flipX: s.dirX < 0,
    blend: 'add',
    alpha: 0.75,
    z: 54,
  });
}

/**
 * The fire of a blast that was just spawned: the floor glow, the cloud, the fire, the bloom on
 * the barrel (it follows `shooter`), the sparks, the embers and the shake.
 */
export function shotgunFire(blast: ShotgunBlast, shooter: Entity | null): void {
  const s = shot;
  s.world = blast.world;
  s.x = blast.x;
  s.y = blast.y;
  s.angle = blast.angle;
  s.dirX = Math.cos(blast.angle);
  s.dirY = Math.sin(blast.angle);
  s.vertical = isVertical(blast.angle);
  const reach = fireReach(s, blast);
  floorGlow(s, reach);
  spawnCloud(s, reach, shooter);
  spawnDriver(s, FIRE_DRIVER, FIRE_LIFE, 60, reach, drawFire);
  spawnBloom(s, shooter);
  sparks(s, Math.min(reach, CONE_REACH), 9, 1.15);
  throwEmbers(s, reach);
  s.world.camera.shake(3, 10);
}
