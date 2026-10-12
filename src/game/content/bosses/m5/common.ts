/**
 * Shared pieces of the m5 final boss (GDD §10.5): difficulty helpers, the hit tests the beams
 * use, the boss projectiles (`chord-note`, `homing-note`-style FLUTE notes, `note-bomb`) and the
 * area attacks (`anthem-beam`, `lane-blast`, `baton-beam`, `scream`) as entities.
 *
 * Every attack here carries the `boss` damage tag (a player vehicle loses a whole cell, GDD §6).
 */
import { type Damage, Entity } from '../../../../engine/entity';
import { overlaps, type Rect, segmentRectT } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { difficultyOf, gameOf } from '../../../context';
import { drawShadow, explosion } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';

export const BOSS_TAGS: readonly string[] = ['boss'];
export const SONIC_TAGS: readonly string[] = ['boss', 'sonic'];
export const WAVE_TAGS: readonly string[] = ['boss', 'shockwave'];

/** Sprite ids of the boss projectiles (drawn in ./art-shots.ts). */
export const SHOT = {
  chord: 'boss/grand-organ/chord-note',
  note: 'machine/baton-copter/note-bullet',
  homing: 'boss/organ-console/homing-note',
  bomb: 'boss/organ-console/note-bomb',
} as const;

/** Enemy projectile speed for the difficulty. */
export function shotSpeed(world: World, s: number): number {
  return s * difficultyOf(world).enemyBulletSpeed;
}

export function isHard(world: World): boolean {
  return difficultyOf(world).id === 'hard';
}

/** Ask the mission runner to switch songs (so it remembers it), else the audio directly. */
export function playSong(world: World, id: string | null, fadeTicks = 30): void {
  const r = gameOf(world).runner as { playMusic?: (id: string | null, fade?: number) => void } | null;
  if (r && typeof r.playMusic === 'function') r.playMusic(id, fadeTicks);
  else world.audio.music(id, { fadeTicks });
}

// ---------------------------------------------------------------------------------------------
// Hit tests against the player team (players and their vehicles)
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
// Area attacks
// ---------------------------------------------------------------------------------------------

export type BeamStyle = 'anthem' | 'lane' | 'baton';

const beamOpts: DrawOpts = { blend: 'add', alpha: 0.6 };

/**
 * A boss beam (no sprite: drawn from rects and lines). `anthem` and `lane` fill a rect for
 * `life` ticks; `baton` is a segment the owner moves every tick (`setSegment`). Each target is
 * hit once per beam. Never erasable (GDD §6: beams and lane blasts are not shots).
 */
export class BossBeam extends Entity {
  style: BeamStyle = 'lane';
  readonly rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  x1 = 0;
  y1 = 0;
  /** Beam thickness for 'baton' (px). */
  width = 6;
  life = 20;
  t = 0;
  readonly dmg: Damage = { amount: 10, kind: 'laser', dirX: 0, tags: BOSS_TAGS };
  private readonly hit: Entity[] = [];

  constructor(world: World, style: BeamStyle, life: number) {
    super(world, 0, 0);
    this.style = style;
    this.life = life;
    this.team = 'enemy';
    this.z = 52;
    this.despawnMargin = Infinity;
    this.type = style === 'anthem' ? 'anthem-beam' : style === 'lane' ? 'lane-blast' : 'baton-beam';
    this.dmg.source = this;
    if (style === 'lane') this.dmg.tags = SONIC_TAGS;
    if (style === 'lane') this.dmg.kind = 'impact';
  }

  setRect(x: number, y: number, w: number, h: number): this {
    this.rect.x = x;
    this.rect.y = y;
    this.rect.w = w;
    this.rect.h = h;
    this.x = x + w / 2;
    this.y = y + h / 2;
    return this;
  }

  setSegment(x0: number, y0: number, x1: number, y1: number): this {
    this.x = x0;
    this.y = y0;
    this.x1 = x1;
    this.y1 = y1;
    return this;
  }

  override update(): void {
    if (this.t++ >= this.life) {
      this.remove();
      return;
    }
    if (this.style === 'baton') hitPlayersOnSegment(this.world, this.x, this.y, this.x1, this.y1, this.width / 2, this.dmg, this.hit);
    else hitPlayersInRect(this.world, this.rect, this.dmg, this.hit);
  }

  override draw(r: Renderer): void {
    const t = this.t;
    const tick = this.world.tick;
    if (this.style === 'baton') {
      const dx = this.x1 - this.x;
      const dy = this.y1 - this.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      // A white core with gold edges (6 px wide).
      for (let o = -3; o <= 3; o++) {
        const c = o === 0 || o === 1 ? PAL.snow[3] : Math.abs(o) <= 2 ? PAL.gold[3] : PAL.orange[2];
        r.line(Math.round(this.x + nx * o), Math.round(this.y + ny * o), Math.round(this.x1 + nx * o), Math.round(this.y1 + ny * o), c);
      }
      return;
    }
    const b = this.rect;
    const fade = t < 3 ? 0.35 : t > this.life - 4 ? 0.3 : 0.55;
    beamOpts.alpha = fade;
    if (this.style === 'anthem') {
      r.rect(b.x, b.y, b.w, b.h, PAL.gold[2], beamOpts);
      r.rect(b.x, b.y + 5, b.w, b.h - 10, PAL.gold[3], beamOpts);
      r.rect(b.x, b.y + 9, b.w, b.h - 18, PAL.snow[3]);
      // Rolling sound-wave crests along the beam.
      const ph = (tick * 6) % 24;
      for (let x = b.x + b.w - ph; x > b.x; x -= 24) {
        r.line(Math.round(x), b.y + 1, Math.round(x - 4), b.y + b.h / 2, PAL.snow[3]);
        r.line(Math.round(x - 4), b.y + b.h / 2, Math.round(x), b.y + b.h - 2, PAL.snow[3]);
      }
    } else {
      // Lane blast: a band of crimson sound with white wave lines.
      r.rect(b.x, b.y, b.w, b.h, PAL.red[2], beamOpts);
      r.rect(b.x, b.y + 4, b.w, b.h - 8, PAL.pink[2], beamOpts);
      const mid = b.y + b.h / 2;
      const amp = b.h / 2 - 3;
      let px = b.x;
      let py = mid;
      for (let x = b.x + 4; x <= b.x + b.w; x += 4) {
        const y = mid + Math.sin((x + tick * 9) / 9) * amp;
        r.line(Math.round(px), Math.round(py), Math.round(x), Math.round(y), PAL.snow[3]);
        px = x;
        py = y;
      }
      r.rect(b.x, b.y, b.w, 1, PAL.snow[2]);
      r.rect(b.x, b.y + b.h - 1, b.w, 1, PAL.snow[2]);
    }
  }
}

/** Spawn a beam that fills a world rect for `life` ticks. */
export function spawnRectBeam(world: World, style: 'anthem' | 'lane', x: number, y: number, w: number, h: number, life: number): BossBeam {
  const b = new BossBeam(world, style, life).setRect(x, y, w, h);
  return world.add(b);
}

/**
 * Console Pedal Notes: a floor shockwave 10 px tall (16 wide) that runs along the floor from `x`
 * at `vx` until `endX` (the left wall). Jump it. Each target is hit once.
 */
export class PedalWave extends Entity {
  floor = 0;
  endX = 0;
  t = 0;
  readonly rect: Rect = { x: 0, y: 0, w: 16, h: 10 };
  readonly dmg: Damage = { amount: 10, kind: 'impact', dirX: -1, tags: WAVE_TAGS };
  private readonly hit: Entity[] = [];

  constructor(world: World, x: number, floor: number, vx: number, endX: number) {
    super(world, x, floor);
    this.team = 'enemy';
    this.z = 50;
    this.type = 'shockwave';
    this.despawnMargin = Infinity;
    this.floor = floor;
    this.vx = vx;
    this.endX = endX;
    this.dmg.source = this;
    this.dmg.dirX = Math.sign(vx) || -1;
  }

  override update(): void {
    this.t++;
    this.x += this.vx;
    if ((this.vx < 0 && this.x <= this.endX) || (this.vx > 0 && this.x >= this.endX)) {
      dustAt(this.world, this.x, this.floor);
      this.remove();
      return;
    }
    this.rect.x = this.x - 8;
    this.rect.y = this.floor - 10;
    hitPlayersInRect(this.world, this.rect, this.dmg, this.hit);
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = this.floor;
    const k = (this.t >> 1) & 1;
    // Three nested sound arcs leaning the way it runs.
    for (let i = 0; i < 3; i++) {
      const h = 10 - i * 3;
      const c = i === 0 ? PAL.red[2] : i === 1 ? PAL.gold[3] : PAL.snow[3];
      const dx = Math.sign(this.vx) * (i * 3 + k);
      r.line(x - 6 + dx, y - 1, x + dx, y - h, c);
      r.line(x + dx, y - h, x + 6 + dx, y - 1, c);
    }
    r.rect(x - 8, y - 1, 16, 1, PAL.gold[2]);
  }
}

function dustAt(world: World, x: number, y: number): void {
  world.particles.debris(x, y - 2, 3, [PAL.gold[2], PAL.brown[1]]);
}

// ---------------------------------------------------------------------------------------------
// The scream (BRAVISSIMO!): line of sight from the mouth to every player's head
// ---------------------------------------------------------------------------------------------

/** Rects that block the scream (wreck blocks register themselves here). */
export const SCREAM_BLOCK_TAG = 'wreck-block';

/** Head point of a player-team target: 4 px under the top of its first hurtbox. */
function headOf(t: Entity, out: [number, number]): boolean {
  const boxes = t.hurtboxes();
  if (boxes.length === 0 || boxes[0].w <= 0) return false;
  out[0] = boxes[0].x + boxes[0].w / 2;
  out[1] = boxes[0].y + 4;
  return true;
}

const headPt: [number, number] = [0, 0];

/** Can the scream from (mx, my) reach this head? Wreck blocks and terrain hide it. */
export function screamReaches(world: World, mx: number, my: number, hx: number, hy: number): boolean {
  if (!world.terrain.lineOfSight(mx, my, hx, hy)) return false;
  const blocks = world.byTag(SCREAM_BLOCK_TAG);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] as WreckLike;
    if (b.removed || !b.solidRect) continue;
    if (segmentRectT(mx, my, hx, hy, b.solidRect) >= 0) return false;
  }
  return true;
}

interface WreckLike extends Entity {
  solidRect: Rect | null;
}

/**
 * The scream (`scream`): expanding rings from the mouth for `life` ticks; on its first
 * `hitTicks` ticks it hits every player whose head it can see (each once).
 */
export class Scream extends Entity {
  life = 48;
  hitTicks = 24;
  t = 0;
  readonly dmg: Damage = { amount: 10, kind: 'impact', dirX: 0, tags: SONIC_TAGS };
  private readonly hit: Entity[] = [];

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 58;
    this.type = 'scream';
    this.despawnMargin = Infinity;
    this.dmg.source = this;
  }

  override update(): void {
    if (this.t++ >= this.life) {
      this.remove();
      return;
    }
    if (this.t > this.hitTicks) return;
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || t.team !== 'player' || this.hit.includes(t)) continue;
        if (!headOf(t, headPt)) continue;
        if (!screamReaches(this.world, this.x, this.y, headPt[0], headPt[1])) continue;
        this.dmg.dirX = Math.sign(headPt[0] - this.x);
        this.world.damage(t, this.dmg, 0);
        this.hit.push(t);
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  override draw(r: Renderer): void {
    // Concentric shock rings (drawn as 24-gons), white and gold.
    const t = this.t;
    for (let k = 0; k < 4; k++) {
      const rad = (t * 7 + k * 22) % 200;
      if (rad < 6) continue;
      const c = k % 2 ? PAL.gold[3] : PAL.snow[3];
      let px = this.x + rad;
      let py = this.y;
      for (let i = 1; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const x = this.x + Math.cos(a) * rad;
        const y = this.y + Math.sin(a) * rad * 0.8;
        if (i % 2 === 0) r.line(Math.round(px), Math.round(py), Math.round(x), Math.round(y), c);
        px = x;
        py = y;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------------------------

/** A boss note bullet (chord notes, speaker notes, bellows notes). */
export function noteShot(world: World, shooter: Entity | null, x: number, y: number, angle: number, speed: number, o: Partial<ProjectileOpts> = {}): Projectile {
  const s = shotSpeed(world, speed);
  return Projectile.spawn(world, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    damage: 10,
    tags: BOSS_TAGS,
    w: 6,
    h: 6,
    sprite: SHOT.chord,
    look: 'anim',
    ticksPerFrame: 6,
    life: 600,
    offscreen: 24,
    hitsTerrain: false,
    shooter,
    type: 'chord-note',
    ...o,
  });
}

/** FLUTE: a slow homing note (shoot it down: 10 HP, 100 points). Steers for `seek` ticks. */
export class HomingNote extends Projectile {
  seek = 150;
  turn = 0.05;
  speed = 1.6;

  static fire(world: World, shooter: Entity | null, x: number, y: number, angle: number): HomingNote {
    const s = shotSpeed(world, 1.6);
    const n = HomingNote.spawn(world, {
      team: 'enemy',
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      damage: 10,
      tags: BOSS_TAGS,
      w: 8,
      h: 8,
      sprite: SHOT.homing,
      look: 'anim',
      ticksPerFrame: 5,
      life: 420,
      offscreen: 48,
      hitsTerrain: false,
      shootable: true,
      hp: 10,
      score: 100,
      shooter,
      type: 'homing-note',
    });
    n.speed = s;
    n.seek = 150;
    return n;
  }

  override update(): void {
    if (this.t < this.seek) {
      const p = this.world.nearestPlayer(this.x, this.y);
      if (p) {
        const want = Math.atan2(p.y - 18 - this.y, p.x - this.x);
        let a = Math.atan2(this.vy, this.vx);
        let d = want - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        a += Math.max(-this.turn, Math.min(this.turn, d));
        this.vx = Math.cos(a) * this.speed;
        this.vy = Math.sin(a) * this.speed;
      }
    }
    super.update();
  }
}

/**
 * BOMBARDE: a note-bomb that waits `delay` ticks above the view while its shadow (r 12) marks
 * the landing spot at `groundY`, then falls and explodes (r 12) on the floor or a player.
 */
export class NoteBomb extends Projectile {
  delay = 40;
  groundY = 0;
  private falling = false;

  static drop(world: World, shooter: Entity | null, x: number, groundY: number, delay: number): NoteBomb {
    const top = world.camera.top - 12;
    const b = NoteBomb.spawn(world, {
      team: 'enemy',
      x,
      y: top,
      vx: 0,
      vy: 0,
      damage: 10,
      kind: 'explosion',
      tags: BOSS_TAGS,
      w: 10,
      h: 10,
      sprite: SHOT.bomb,
      look: 'anim',
      ticksPerFrame: 4,
      life: delay + 240,
      offscreen: Infinity,
      hitsTerrain: true,
      hitsPlatforms: true,
      impact: 'none',
      shooter,
      type: 'note-bomb',
    });
    b.delay = delay;
    b.groundY = groundY;
    b.falling = false;
    return b;
  }

  override update(): void {
    if (this.t < this.delay) {
      this.t++;
      this.prevX = this.x;
      this.prevY = this.y;
      return;
    }
    if (!this.falling) {
      this.falling = true;
      this.world.audio.sfx('machine/piano-whistle', { vol: 0.5, pitch: 1.6 });
    }
    this.vy = Math.min(this.vy + 0.3, 7);
    super.update();
    if (!this.removed && this.y >= this.groundY - 4) this.blowUp(this.x, this.groundY - 4);
  }

  override onImpact(_target: Entity | null, x: number, y: number): void {
    this.blowUp(x, y);
  }

  override expire(): void {
    this.blowUp(this.x, this.y);
  }

  private blowUp(x: number, y: number): void {
    if (this.removed) return;
    explosion(this.world, x, y, 's', { damage: 10, team: 'enemy', radius: 12, tags: BOSS_TAGS, debris: null });
    this.remove();
  }

  override draw(r: Renderer): void {
    if (this.t < this.delay + 30 && !this.removed) {
      // The marked shadow grows as the bomb comes: blinking for the first ticks.
      const k = Math.min(1, this.t / Math.max(1, this.delay));
      if (this.falling || this.world.tick % 8 < 6) drawShadow(r, this.x, this.groundY, Math.round(10 + 14 * k), 0.35 + 0.3 * k);
      if (!this.falling && this.world.tick % 16 < 10) {
        r.rect(Math.round(this.x) - 1, this.groundY - 10, 2, 5, PAL.red[3]);
        r.rect(Math.round(this.x) - 1, this.groundY - 4, 2, 2, PAL.red[3]);
      }
    }
    if (this.falling) super.draw(r);
  }
}

// ---------------------------------------------------------------------------------------------
// Spawnable ids (scripts and tests): `chord-note`, `homing-note` is the Windbag's own id, so the
// FLUTE notes register as `flute-note`; `note-bomb`, `anthem-beam`, `lane-blast`, `baton-beam`,
// `scream`.
// ---------------------------------------------------------------------------------------------

function angleParam(p: SpawnParams, dflt: number): number {
  return (paramNum(p, 'angle', dflt) * Math.PI) / 180;
}

defineEntity('chord-note', (w, x, y, p) => noteShot(w, null, x, y, angleParam(p, 180), paramNum(p, 'speed', 1.8)), {
  category: 'projectile',
  description: 'Grand Organ chord note (10, boss): params angle (deg, 180 = left), speed (1.8).',
});
defineEntity('flute-note', (w, x, y, p) => HomingNote.fire(w, null, x, y, angleParam(p, 180)), {
  category: 'projectile',
  description: 'Console FLUTE stop: a homing note (1.6 px/tick, steers 150 ticks, 10 HP, 100 points).',
});
defineEntity('note-bomb', (w, x, y, p) => NoteBomb.drop(w, null, x, y, paramNum(p, 'delay', 40)), {
  category: 'projectile',
  description: 'Console BOMBARDE note-bomb: shadow at (x, y) for `delay` (40) ticks, then falls; r 12.',
});
defineEntity('anthem-beam', (w, x, y, p) => spawnRectBeam(w, 'anthem', x - paramNum(p, 'w', 384), y - 12, paramNum(p, 'w', 384), 24, paramNum(p, 'life', 40)), {
  category: 'projectile',
  description: 'Grand Organ anthem beam: a 24 px band ending at (x, y), `w` (384) long, `life` (40).',
});
defineEntity('lane-blast', (w, x, y, p) => spawnRectBeam(w, 'lane', x, y - 26, paramNum(p, 'w', 384), 26, paramNum(p, 'life', 20)), {
  category: 'projectile',
  description: 'Console lane blast: band from (x, y − 26) to (x + w, y), 20 ticks.',
});
defineEntity('baton-beam', (w, x, y, p) => {
  const b = new BossBeam(w, 'baton', paramNum(p, 'life', 30));
  const a = angleParam(p, 180);
  return w.add(b.setSegment(x, y, x + Math.cos(a) * 120, y + Math.sin(a) * 120));
}, { category: 'projectile', description: 'Maestro baton beam: a 120 px segment from (x, y) at `angle`, 6 px wide.' });
defineEntity('scream', (w, x, y) => w.add(new Scream(w, x, y)), {
  category: 'projectile',
  description: 'Maestro BRAVISSIMO! scream: hits every player whose head it can see (wreck blocks hide).',
});

