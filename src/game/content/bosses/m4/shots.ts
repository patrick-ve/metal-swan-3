/**
 * Projectiles and area attacks of the m4 bosses (GDD §10.4, §9.4, §15.4). Every hit carries the
 * `boss` tag (a player vehicle loses 1 cell, docs/api/game.md §6); ground waves add `shockwave`.
 *
 * THE GRAND GRAND: `felt-hammer` (Glissando arc), `harp-beam` (Harp Strings: a 1 px flickering
 * preview line, then a 4 px laser for 30 ticks; never erasable), `crystal-shard` (Grand Aria with no
 * chandelier left: the shadow shows, then it falls at 4 px/tick; 8 × 12, lethal) and `pedal-wave`
 * (Pedal Stomp: a 10 px ground shockwave — jump it).
 * THE BIG HEAD: `enemy-bullet` (Moustache Volley), `leaflet-bomb` (Propaganda Drop: flutters
 * down, explodes on the ground r 12, 100 points shot down), `sonic-cone` (ATTENTION!: a cone
 * straight down from the mouth, 64 px wide at the ground) and the harmless `leaflet` (decor).
 */
import { Entity, type Damage } from '../../../../engine/entity';
import { overlaps, segmentRectT, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf } from '../../../context';
import { drawShadow, dust, explosion, impactPuff } from '../../../fx';
import { Projectile } from '../../../projectile';
import { defineEntity, paramNum } from '../../../registry';

export const BOSS_TAGS: readonly string[] = ['boss'];
export const WAVE_TAGS: readonly string[] = ['boss', 'shockwave'];
const GG = 'boss/grand-grand';
const BH = 'boss/big-head';
const drawOpts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// Hit tests against the player team
// ---------------------------------------------------------------------------------------------

const padRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Damage every player-team target whose hurtbox touches `r` (each once: `hit` remembers). */
export function hitPlayersInRect(world: World, r: Rect, d: Damage, hit: Entity[]): number {
  let n = 0;
  const list = world.snapshotTag('shootable');
  try {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t.alive || t.team !== 'player' || hit.includes(t)) continue;
      const boxes = t.hurtboxes();
      for (let k = 0; k < boxes.length; k++) {
        if (!overlaps(boxes[k], r)) continue;
        world.damage(t, d, k);
        hit.push(t);
        n++;
        break;
      }
    }
  } finally {
    world.releaseSnapshot();
  }
  return n;
}

/** Damage every player-team target whose hurtbox (grown by `pad`) the segment crosses. */
export function hitPlayersOnSegment(world: World, x0: number, y0: number, x1: number, y1: number, pad: number, d: Damage, hit: Entity[]): number {
  let n = 0;
  const list = world.snapshotTag('shootable');
  try {
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t.alive || t.team !== 'player' || hit.includes(t)) continue;
      const boxes = t.hurtboxes();
      for (let k = 0; k < boxes.length; k++) {
        const b = boxes[k];
        padRect.x = b.x - pad;
        padRect.y = b.y - pad;
        padRect.w = b.w + pad * 2;
        padRect.h = b.h + pad * 2;
        if (segmentRectT(x0, y0, x1, y1, padRect) < 0) continue;
        world.damage(t, d, k);
        hit.push(t);
        n++;
        break;
      }
    }
  } finally {
    world.releaseSnapshot();
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Felt hammer (Glissando)
// ---------------------------------------------------------------------------------------------

export function feltHammer(world: World, x: number, y: number, angle: number, speed: number, shooter: Entity | null): Projectile {
  const s = speed * difficultyOf(world).enemyBulletSpeed;
  return Projectile.spawn(world, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    gravity: 0.05,
    damage: 10,
    kind: 'impact',
    tags: BOSS_TAGS,
    w: 8,
    h: 8,
    sprite: `${GG}/hammer`,
    look: 'anim',
    ticksPerFrame: 4,
    life: 300,
    offscreen: 48,
    impact: (p, _t, ix, iy) => impactPuff(p.world, ix, iy, 0, -1),
    shooter,
    type: 'felt-hammer',
  });
}

// ---------------------------------------------------------------------------------------------
// Crystal shard (Grand Aria with no chandelier left)
// ---------------------------------------------------------------------------------------------

export class CrystalShard extends Projectile {
  delay = 0;
  groundY = 176;
  total = 1;

  /** A shard that falls onto (x, groundY) after waiting `delay` ticks above the view (its shadow shows). */
  static drop(world: World, x: number, groundY: number, delay: number, shooter: Entity | null): CrystalShard {
    const top = world.camera.top - 16;
    const s = CrystalShard.spawn(world, {
      team: 'enemy',
      x,
      y: top,
      vx: 0,
      vy: 0,
      damage: 10,
      kind: 'impact',
      tags: BOSS_TAGS,
      w: 8,
      h: 12,
      sprite: `${GG}/shard`,
      look: 'anim',
      ticksPerFrame: 6,
      hitsTerrain: false,
      life: 400,
      offscreen: 200,
      impact: 'none',
      shooter,
      type: 'crystal-shard',
    }) as CrystalShard;
    s.delay = delay;
    s.groundY = groundY;
    s.total = delay + Math.max(1, (groundY - top) / 4);
    return s;
  }

  override update(): void {
    this.t++;
    if (this.delay > 0) {
      this.delay--;
      return;
    }
    this.vy = 4;
    this.y += this.vy;
    if (this.y + 6 >= this.groundY) {
      // It shatters on the stage.
      impactPuff(this.world, this.x, this.groundY - 1, 0, -1);
      dust(this.world, this.x, this.groundY, 2);
      this.world.audio.sfx('enemy/triangle', { vol: 0.5, pitch: 1.6 });
      this.remove();
      return;
    }
    if (this.t >= this.life) this.remove();
  }

  override draw(r: Renderer): void {
    const k = Math.min(1, this.t / this.total);
    drawShadow(r, this.x, this.groundY, 8 + Math.round(k * 8), 0.3 + 0.3 * k);
    if (this.delay > 0) return;
    super.draw(r);
  }
}

// ---------------------------------------------------------------------------------------------
// Pedal wave (Pedal Stomp): hugs the floor, stopped by walls and pit edges; jump it
// ---------------------------------------------------------------------------------------------

export class PedalWave extends Projectile {
  dist = 0;
  range = 240;
  groundY = 176;
  waveH = 10;

  static launch(world: World, x: number, groundY: number, dir: 1 | -1, speed: number, range: number, shooter: Entity | null): PedalWave {
    const h = 10;
    const w = PedalWave.spawn(world, {
      team: 'enemy',
      x,
      y: groundY - h / 2,
      vx: dir * speed * difficultyOf(world).enemyBulletSpeed,
      vy: 0,
      damage: 10,
      kind: 'impact',
      tags: WAVE_TAGS,
      w: 12,
      h,
      sprite: `${GG}/wave`,
      look: 'anim',
      ticksPerFrame: 3,
      hitsTerrain: false,
      pierce: Infinity,
      life: 600,
      offscreen: 48,
      shooter,
      type: 'pedal-wave',
    }) as PedalWave;
    w.dist = 0;
    w.range = range;
    w.groundY = groundY;
    w.waveH = h;
    return w;
  }

  override update(): void {
    const nx = this.x + this.vx;
    const ter = this.world.terrain;
    const dir = Math.sign(this.vx);
    if (ter.isSolid(nx + dir * 6, this.groundY - this.waveH + 1)) return this.fizzle();
    const floor = ter.surfaceY(nx, this.groundY - 12, this.groundY + 12, { platforms: false });
    if (!Number.isFinite(floor)) return this.fizzle();
    this.x = nx;
    this.groundY = floor;
    this.y = floor - this.waveH / 2;
    this.dist += Math.abs(this.vx);
    if (++this.t >= this.life || this.dist >= this.range) return this.fizzle();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  private fizzle(): void {
    dust(this.world, this.x, this.groundY, 3);
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// Harp beam (Harp Strings)
// ---------------------------------------------------------------------------------------------

const beamOpts: DrawOpts = { blend: 'add', alpha: 0.7 };

/**
 * One harp beam from (x0, y0) to (x1, y1): `preview` ticks of a flickering 1 px gold line (no
 * damage), then a 4 px laser for `active` ticks (each player is hit once). Not erasable.
 */
export class HarpBeam extends Entity {
  x1 = 0;
  y1 = 0;
  preview = 45;
  active = 30;
  t = 0;
  readonly dmg: Damage = { amount: 10, kind: 'laser', dirX: 0, tags: BOSS_TAGS };
  private readonly hit: Entity[] = [];

  constructor(world: World, x0: number, y0: number, x1: number, y1: number, preview: number, active: number) {
    super(world, x0, y0);
    this.x1 = x1;
    this.y1 = y1;
    this.preview = preview;
    this.active = active;
    this.team = 'enemy';
    this.z = 52;
    this.despawnMargin = Infinity;
    this.type = 'harp-beam';
    this.dmg.source = this;
  }

  get firing(): boolean {
    return this.t >= this.preview && this.t < this.preview + this.active;
  }

  /** Move the beam's origin (it follows the strings). */
  setOrigin(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  override update(): void {
    this.t++;
    if (this.t >= this.preview + this.active) {
      this.remove();
      return;
    }
    if (this.t === this.preview) this.world.audio.sfx('weapon/laser', { vol: 0.5, pitch: 0.7 });
    if (this.firing) hitPlayersOnSegment(this.world, this.x, this.y, this.x1, this.y1, 2, this.dmg, this.hit);
  }

  override draw(r: Renderer): void {
    const x0 = Math.round(this.x);
    const y0 = Math.round(this.y);
    const x1 = Math.round(this.x1);
    const y1 = Math.round(this.y1);
    if (!this.firing) {
      // The flickering preview line (GDD: 5 flickering 1 px gold lines).
      if (((this.world.tick >> 1) & 1) === 0 || this.t > this.preview - 10) r.line(x0, y0, x1, y1, PAL.gold[3]);
      return;
    }
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let o = -2; o <= 2; o++) {
      const c = o === 0 ? PAL.snow[3] : Math.abs(o) === 1 ? PAL.gold[3] : PAL.gold[2];
      r.line(Math.round(x0 + nx * o), Math.round(y0 + ny * o), Math.round(x1 + nx * o), Math.round(y1 + ny * o), c, Math.abs(o) === 2 ? beamOpts : undefined);
    }
    // Sparks where the beam meets the floor.
    if ((this.world.tick & 3) === 0) r.rect(x1 - 2, y1 - 2, 4, 2, PAL.snow[3]);
  }
}

export function spawnHarpBeam(world: World, x0: number, y0: number, x1: number, y1: number, preview: number, active = 30): HarpBeam {
  return world.add(new HarpBeam(world, x0, y0, x1, y1, preview, active));
}

// ---------------------------------------------------------------------------------------------
// Big Head: moustache bullets, leaflet bombs, leaflets, the sonic cone
// ---------------------------------------------------------------------------------------------

export function moustacheBullet(world: World, x: number, y: number, angle: number, speed: number, shooter: Entity | null): Projectile {
  const s = speed * difficultyOf(world).enemyBulletSpeed;
  return Projectile.spawn(world, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    damage: 10,
    tags: BOSS_TAGS,
    w: 5,
    h: 5,
    sprite: 'weapon/enemy-bullet',
    look: 'anim',
    ticksPerFrame: 4,
    life: 300,
    offscreen: 24,
    shooter,
    type: 'enemy-bullet',
  });
}

export class LeafletBomb extends Projectile {
  phase = 0;
  baseX = 0;

  static drop(world: World, x: number, y: number, phase: number, shooter: Entity | null): LeafletBomb {
    const b = LeafletBomb.spawn(world, {
      team: 'enemy',
      x,
      y,
      vx: 0,
      vy: 0.6,
      damage: 10,
      kind: 'explosion',
      tags: BOSS_TAGS,
      w: 8,
      h: 8,
      sprite: `${BH}/leaflet-bomb`,
      look: 'anim',
      ticksPerFrame: 8,
      hitsPlatforms: true,
      impact: 'none',
      life: 600,
      offscreen: 120,
      shootable: true,
      hp: 1,
      score: 100,
      shooter,
      type: 'leaflet-bomb',
    }) as LeafletBomb;
    b.phase = phase;
    b.baseX = x;
    return b;
  }

  override update(): void {
    // Flutter: a slow sway down (0.6 px/tick).
    const t = this.t + this.phase;
    this.vx = Math.cos(t / 14) * 0.6;
    this.vy = 0.6 + Math.sin(t / 7) * 0.15;
    super.update();
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.blast(x, y);
  }

  override expire(): void {
    this.blast(this.x, this.y);
    this.remove();
  }

  private blast(x: number, y: number): void {
    if (this.dead) return;
    this.dead = true;
    explosion(this.world, x, y, 's', { damage: 10, team: 'enemy', radius: 12, tags: BOSS_TAGS, kind: 'explosion', shake: 1 });
  }
}

/** A harmless propaganda leaflet: flutters down, lies on the floor, then blinks out. */
export class Leaflet extends Entity {
  private t = 0;
  private landed = -1;
  private readonly phase: number;

  constructor(world: World, x: number, y: number, phase: number) {
    super(world, x, y);
    this.phase = phase;
    this.team = 'neutral';
    this.z = 49;
    this.type = 'leaflet';
    this.despawnMargin = 64;
  }

  override update(): void {
    this.t++;
    if (this.landed >= 0) {
      if (this.t - this.landed > 150) this.remove();
      return;
    }
    const k = this.t + this.phase;
    this.x += Math.cos(k / 12) * 0.7;
    this.y += 0.5 + Math.sin(k / 6) * 0.2;
    const floor = this.world.terrain.surfaceY(this.x, this.y - 2, this.y + 3);
    if (Number.isFinite(floor)) {
      this.y = floor - 2;
      this.landed = this.t;
    }
    if (this.t > 900) this.remove();
  }

  override draw(r: Renderer): void {
    if (this.landed >= 0 && this.t - this.landed > 110 && (this.t & 2) === 0) return;
    drawOpts.flipX = ((this.t + this.phase) >> 4) % 2 === 0;
    drawOpts.flash = false;
    const frame = this.landed >= 0 ? 1 : ((this.t + this.phase) >> 3) % 3;
    r.sprite(`${BH}/leaflet`, frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

const coneOpts: DrawOpts = { blend: 'add', alpha: 0.35 };

/**
 * ATTENTION!: a visible sonic cone straight down from the mouth for `life` ticks, `bottom` px wide
 * at the ground. `follow` keeps it under a moving mouth (the blimp drifts and bobs).
 */
export class SonicCone extends Entity {
  t = 0;
  life = 30;
  groundY = 176;
  top = 18;
  bottom = 64;
  follow: (() => [number, number]) | null = null;
  readonly dmg: Damage = { amount: 10, kind: 'impact', dirX: 0, tags: BOSS_TAGS };
  private readonly hit: Entity[] = [];

  constructor(world: World, x: number, y: number, groundY: number, life: number) {
    super(world, x, y);
    this.groundY = groundY;
    this.life = life;
    this.team = 'enemy';
    this.z = 48;
    this.despawnMargin = Infinity;
    this.type = 'sonic-cone';
    this.dmg.source = this;
  }

  /** Half width of the cone at height y. */
  halfAt(y: number): number {
    const k = Math.max(0, Math.min(1, (y - this.y) / Math.max(1, this.groundY - this.y)));
    return (this.top + (this.bottom - this.top) * k) / 2;
  }

  override update(): void {
    if (this.follow) {
      const [fx, fy] = this.follow();
      this.x = fx;
      this.y = fy;
    }
    if (this.t++ >= this.life) {
      this.remove();
      return;
    }
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p.alive || p.team !== 'player' || this.hit.includes(p)) continue;
        const boxes = p.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          const b = boxes[k];
          if (b.y + b.h < this.y || b.y > this.groundY) continue;
          const yb = Math.min(this.groundY, b.y + b.h);
          const hw = this.halfAt(yb);
          if (b.x + b.w < this.x - hw || b.x > this.x + hw) continue;
          this.world.damage(p, this.dmg, k);
          this.hit.push(p);
          break;
        }
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y0 = Math.round(this.y);
    const y1 = Math.round(this.groundY);
    // A translucent wedge with white ring arcs travelling down.
    for (let y = y0; y < y1; y += 2) {
      const hw = Math.round(this.halfAt(y));
      r.rect(x - hw, y, hw * 2, 2, PAL.pink[2], coneOpts);
    }
    const ph = (this.t * 4) % 16;
    for (let y = y0 + ph; y < y1; y += 16) {
      const hw = Math.round(this.halfAt(y));
      r.line(x - hw, y, x - (hw >> 1), y + 3, PAL.snow[3]);
      r.line(x - (hw >> 1), y + 3, x + (hw >> 1), y + 3, PAL.snow[3]);
      r.line(x + (hw >> 1), y + 3, x + hw, y, PAL.snow[3]);
    }
    const hw0 = Math.round(this.halfAt(y0));
    const hw1 = Math.round(this.halfAt(y1));
    r.line(x - hw0, y0, x - hw1, y1, PAL.pink[2]);
    r.line(x + hw0, y0, x + hw1, y1, PAL.pink[2]);
  }
}

// Registered so `npm run arena -- --spawn …` and the mission scripts can place them alone.
defineEntity('felt-hammer', (w, x, y) => feltHammer(w, x, y - 60, (-145 * Math.PI) / 180, 2.5, null), {
  category: 'projectile',
  description: 'GRAND GRAND felt hammer: 2.5 px/tick, gravity 0.05 (Glissando).',
});
defineEntity('crystal-shard', (w, x, y, p) => CrystalShard.drop(w, x, y, paramNum(p, 'delay', 40), null), {
  category: 'projectile',
  description: 'GRAND GRAND crystal shard: its shadow shows, then it falls at 4 px/tick onto it (8 × 12, lethal).',
});
defineEntity('harp-beam', (w, x, y, p) => spawnHarpBeam(w, x, y - 100, x + paramNum(p, 'dx', -60), y, paramNum(p, 'preview', 45)), {
  category: 'projectile',
  description: 'GRAND GRAND harp beam: a flickering 1 px preview, then a 4 px laser for 30 ticks.',
});
defineEntity('pedal-wave', (w, x, y, p) => PedalWave.launch(w, x, y, paramNum(p, 'dir', -1) < 0 ? -1 : 1, 2.5, 240, null), {
  category: 'projectile',
  description: 'GRAND GRAND pedal shockwave: 10 px tall, 2.5 px/tick along the floor (jump it).',
});
defineEntity('leaflet-bomb', (w, x, y) => LeafletBomb.drop(w, x, y - 120, 0, null), {
  category: 'projectile',
  description: 'BIG HEAD leaflet bomb: flutters down, r 12 on the ground; shoot it in the air for 100.',
});
defineEntity('sonic-cone', (w, x, y, p) => w.add(new SonicCone(w, x, y - 100, y, paramNum(p, 'life', 30))), {
  category: 'projectile',
  description: 'BIG HEAD ATTENTION! cone: straight down from (x, y − 100), 64 px wide at the ground, 30 ticks.',
});
