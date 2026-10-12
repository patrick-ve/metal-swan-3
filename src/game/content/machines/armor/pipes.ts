/**
 * `pipe-battery` — the Pipe Battery (GDD §9.2) and its `note-rocket`.
 *
 * A wall emplacement: a crimson wind chest (armoured: shots ping off it, a blast on it hits the
 * nearest pipe) under 5 brass organ pipes of different heights; the spawn point is the bottom
 * centre (m4-d "y 100–164" → spawn y 164). Each pipe is a part with 120 HP (×difficulty, ×1.25
 * with 2 players), worth +300; the battery dies (3,000) when all 5 are gone.
 *
 * Attack (cycle 180 ticks, ×1.3 / ×1 / ×0.8 by difficulty): the pipes light up in chord order
 * (lowest note up: an arpeggio); each glows for 30 ticks (`machine/pipe-charge`; an attack token
 * per glow), then toots and fires a note-rocket straight up. Above the view the rocket picks a
 * player and comes down near them: a shadow grows on the ground for 40 ticks before the impact,
 * blast r 14. A note-rocket has 10 HP (50 points when shot down).
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { distToRect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { awardScore } from '../../../events';
import { explosion, FX_SMOKE, FX_TRAIL, debris } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { PIPES, pipeRect, type RelRect } from './geom';
import { Machine } from './machine';

/** Pipe Battery numbers (GDD §9.2; NORMAL). */
export const PIPE_BATTERY = {
  pipeHp: 120,
  pipeScore: 300,
  cycle: 180,
  glow: 30,
  /** The shadow grows this long before a note-rocket lands. */
  shadow: 40,
  /** Rocket climb speed and fall speed (GDD silent). */
  rocketUp: 4,
  rocketFall: 5,
  rocketHp: 10,
  rocketScore: 50,
  rocketDamage: 10,
  blast: 14,
  /** "Near a player": the target x is within this many px of the player. */
  spread: 20,
} as const;

/** Each pipe's note when it toots (a major chord, lowest pipe = root). */
const PIPE_PITCH: readonly number[] = [1.5, 1.26, 1, 2, 1.89];

const ART = 'machine/pipe-battery';
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.5 };
const glowOpts: DrawOpts = { blend: 'add', alpha: 0.7 };
const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };
const tmp: Rect = { x: 0, y: 0, w: 0, h: 0 };
const top: [number, number] = [0, 0];
/** Broken pipes report a box far outside the world. */
const GONE = -1e6;

export class PipeBattery extends Machine {
  /** HP of each pipe (0 = broken). */
  readonly pipeHp: number[] = [];
  readonly pipeMax: number;
  /** Ticks into the attack cycle. */
  cycleT = 0;
  /** Pipe glowing now (−1 = none) and its glow ticks. */
  glowPipe = -1;
  glowT = 0;
  private readonly pipeFlash: number[] = [0, 0, 0, 0, 0];
  private readonly rects: readonly RelRect[];
  private readonly boxes: Rect[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: PIPE_BATTERY.pipeHp * 5, w: 64, h: 64, body: false });
    this.hitbox = { ...PIPES.bounds };
    this.facing = 1;
    this.pipeMax = this.scaledHp(paramNum(p, 'pipeHp', PIPE_BATTERY.pipeHp));
    const rects: RelRect[] = [];
    for (let i = 0; i < 5; i++) {
      this.pipeHp.push(this.pipeMax);
      rects.push(pipeRect(i));
    }
    this.rects = rects;
    for (let i = 0; i < 6; i++) this.boxes.push({ x: 0, y: 0, w: 0, h: 0 });
    this.hp = this.maxHp = this.pipeMax * 5;
  }

  /** Pipes still standing. */
  get pipesLeft(): number {
    let n = 0;
    for (let i = 0; i < 5; i++) if (this.pipeHp[i] > 0) n++;
    return n;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    for (let i = 0; i < 5; i++) if (this.pipeFlash[i] > 0) this.pipeFlash[i]--;
    if (!this.checkActive() || !this.onScreen(-8)) {
      if (this.glowPipe >= 0) this.cancelAttack();
      return;
    }
    const G = this.tele(PIPE_BATTERY.glow);
    const cycle = Math.max(this.recover(PIPE_BATTERY.cycle), G * 5 + 10);
    // Slot k of the chord: its pipe glows from k·G to (k+1)·G, then fires.
    const k = Math.floor(this.cycleT / G);
    // A running glow counts first (the start tick is not counted: the telegraph is G whole ticks).
    if (this.glowPipe >= 0 && ++this.glowT >= G) this.fire(this.glowPipe);
    if (this.glowPipe < 0 && this.cycleT % G === 0 && k < 5) {
      const pipe = PIPES.order[k];
      if (this.pipeHp[pipe] > 0 && this.takeToken()) {
        this.glowPipe = pipe;
        this.glowT = 0;
        this.world.audio.sfx('machine/pipe-charge', { vol: 0.7, pitch: PIPE_PITCH[pipe] });
      }
    }
    if (++this.cycleT >= cycle) this.cycleT = 0;
  }

  /** The glowing pipe toots and a note-rocket leaves its top (never from outside the view). */
  private fire(pipe: number): void {
    this.glowPipe = -1;
    this.releaseToken();
    const t = this.pipeTop(pipe);
    if (!this.inView(t[0], t[1])) return;
    const s = this.mods.enemyBulletSpeed;
    const o = shot;
    o.x = t[0];
    o.y = t[1];
    o.vx = 0;
    o.vy = -PIPE_BATTERY.rocketUp * s;
    o.damage = PIPE_BATTERY.rocketDamage;
    o.kind = 'explosion';
    o.sprite = `${ART}/rocket`;
    o.look = 'anim';
    o.ticksPerFrame = 3;
    o.w = 6;
    o.h = 10;
    o.life = 400;
    o.offscreen = Infinity;
    o.impact = 'none';
    o.hitsTerrain = false;
    o.shootable = true;
    o.hp = PIPE_BATTERY.rocketHp;
    o.score = PIPE_BATTERY.rocketScore;
    o.shooter = this;
    o.type = 'note-rocket';
    NoteRocket.spawn(this.world, o);
    o.shooter = null;
    this.world.audio.sfx('enemy/tuba-blast', { vol: 0.7, pitch: PIPE_PITCH[pipe] });
    this.world.particles.burst(FX_TRAIL, t[0], t[1], 4, 0.3, 1, -Math.PI / 2, 1.2);
  }

  /** World point just above a pipe's open top (written to `top`). */
  private pipeTop(i: number): [number, number] {
    const r = this.rel(this.rects[i], tmp);
    top[0] = r.x + r.w / 2;
    top[1] = r.y - 2;
    return top;
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    this.glowPipe = -1;
  }

  // ------------------------------------------------------------------------------- parts

  /** [0] the wind chest, [1..5] the pipes (a broken pipe reports a box outside the world). */
  override hurtboxes(): readonly Rect[] {
    this.rel(PIPES.chest, this.boxes[0]);
    for (let i = 0; i < 5; i++) {
      const b = this.boxes[i + 1];
      if (this.pipeHp[i] > 0) this.rel(this.rects[i], b);
      else {
        b.x = GONE;
        b.y = GONE;
        b.w = 1;
        b.h = 1;
      }
    }
    return this.boxes;
  }

  override onHit(d: Damage, part = 0): boolean {
    if (!this.alive) return false;
    let pipe = part - 1;
    if (part === 0) {
      // The chest is armoured; a blast against it still reaches the nearest pipe.
      if (d.kind !== 'explosion') {
        this.ping(d);
        return true;
      }
      pipe = this.nearestPipe(d);
    }
    if (pipe < 0 || this.pipeHp[pipe] <= 0) {
      this.ping(d);
      return true;
    }
    this.pipeHp[pipe] -= d.amount;
    this.hp = Math.max(0, this.hp - d.amount);
    this.pipeFlash[pipe] = 4;
    this.hitSound();
    if (this.pipeHp[pipe] <= 0) this.breakPipe(pipe, d);
    else this.updateDamageState();
    return true;
  }

  /** The intact pipe nearest to where the hit came from. */
  private nearestPipe(d: Damage): number {
    const sx = d.source ? d.source.x : this.x;
    const sy = d.source ? d.source.y : this.y;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < 5; i++) {
      if (this.pipeHp[i] <= 0) continue;
      const dd = distToRect(sx, sy, this.rel(this.rects[i], tmp));
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    }
    return best;
  }

  /** A pipe bursts: +300 to the player who broke it; the last one takes the battery down. */
  private breakPipe(i: number, d: Damage): void {
    this.pipeHp[i] = 0;
    if (this.glowPipe === i) this.cancelAttack();
    const r = this.rel(this.rects[i], tmp);
    const cx = r.x + r.w / 2;
    awardScore(this.world, d.owner, PIPE_BATTERY.pipeScore, cx, r.y);
    explosion(this.world, cx, r.y + 6, 's', { team: 'enemy', damage: 0, debris: null, silent: true });
    debris(this.world, cx, r.y + 4, 'metal', 5);
    this.world.audio.sfx('explosion/part');
    if (this.pipesLeft === 0) {
      this.hp = 0;
      this.die(d);
    } else this.updateDamageState();
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    this.releaseToken();
    this.glowPipe = -1;
    this.boom(this.x, this.y - 20, 'l');
  }

  protected override updateDeath(): void {
    this.deathTicks++;
    if (this.deathTicks < 240 && this.deathTicks % 8 === 0) this.world.particles.emit(FX_SMOKE, this.x + this.world.fxRng.range(-24, 24), this.y - 20, 0, -0.35);
  }

  override update(): void {
    super.update();
    if (this.alive) this.emitDamage(this.x, this.y - 30);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    drawOpts.flash = false;
    if (this.dead) {
      r.sprite(`${ART}/wreck`, 0, x, y, drawOpts);
      return;
    }
    // Pipes behind the chest's front rail; frames: 0 whole, 1 dented (≤ 50 %), 2 broken stub.
    for (let i = 0; i < 5; i++) {
      const hp = this.pipeHp[i];
      const f = hp <= 0 ? 2 : hp <= this.pipeMax / 2 ? 1 : 0;
      drawOpts.flash = this.pipeFlash[i] > 0;
      r.sprite(`${ART}/pipe-${i}`, f, x, y, drawOpts);
      if (i === this.glowPipe) this.drawGlow(r, i, x, y, f);
    }
    drawOpts.flash = false;
    r.sprite(`${ART}/body`, 0, x, y, drawOpts);
  }

  /** The telegraph: the pipe glows gold (brighter toward the shot), light spills from its mouth. */
  private drawGlow(r: Renderer, i: number, x: number, y: number, f: number): void {
    const G = this.tele(PIPE_BATTERY.glow);
    const k = this.glowT / G;
    tintOpts.tint = k > 0.7 && this.age % 4 < 2 ? 0xffffffff : 0xfff184ff;
    tintOpts.alpha = 0.25 + 0.4 * k;
    r.sprite(`${ART}/pipe-${i}`, f, x, y, tintOpts);
    const rr = pipeRect(i);
    const mx = x + rr.x + rr.w / 2;
    const my = y + PIPES.chest.y - 7;
    r.rect(mx - 3, my - 1, 6, 3, 0xf6c537ff, glowOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Note-rocket: up out of the view, then down near a player after a 40-tick growing shadow
// ---------------------------------------------------------------------------------------------

type RocketPhase = 'up' | 'away' | 'down';

/** The ground shadow under a falling note-rocket: hidden for `delay` ticks, then it grows for `ticks`. */
class DropShadow extends Entity {
  private t = 0;
  private readonly delay: number;
  private readonly total: number;

  constructor(world: World, x: number, y: number, delay: number, ticks: number) {
    super(world, x, y);
    this.delay = delay;
    this.total = Math.max(1, ticks);
    this.z = 15;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -12, y: -4, w: 24, h: 6 };
  }

  override update(): void {
    if (++this.t > this.delay + this.total) this.remove();
  }

  override draw(r: Renderer): void {
    if (this.t < this.delay) return;
    const f = Math.min(4, Math.floor(((this.t - this.delay) / this.total) * 5));
    r.sprite(`${ART}/shadow`, f, Math.round(this.x), Math.round(this.y));
  }
}

export class NoteRocket extends Projectile {
  phase: RocketPhase = 'up';
  targetX = 0;
  targetY = 0;
  /** Tick (own `t`) of the impact, and of the start of the fall. */
  impactT = 0;
  fallT = 0;
  private fallV = 0;
  private shadow: DropShadow | null = null;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    // It leaves the view on purpose (up and away, then down on its shadow): no terrain, no cull.
    this.hitsTerrain = false;
    this.offscreen = Infinity;
    this.phase = 'up';
    this.shadow = null;
  }

  override update(): void {
    this.t++;
    const cam = this.world.camera;
    if (this.phase === 'up') {
      this.y += this.vy;
      if (this.t % 2 === 0) this.world.particles.emit(FX_TRAIL, this.x, this.y + 6, 0, 0.3);
      if (this.y < cam.top - 24) this.goAway();
    } else if (this.phase === 'away') {
      if (this.t >= this.fallT) {
        this.phase = 'down';
        this.x = this.prevX = this.targetX;
        this.y = this.prevY = cam.top - 16;
        this.vy = this.fallV;
        this.world.audio.sfx('machine/piano-whistle', { vol: 0.4, pitch: 1.4 });
      }
    } else {
      this.y += this.vy;
      if (this.t % 2 === 0) this.world.particles.emit(FX_TRAIL, this.x, this.y - 6, 0, -0.3);
      if (this.t >= this.impactT) {
        this.y = this.targetY;
        this.blast(this.x, this.y);
        this.remove();
        return;
      }
    }
    if (this.t >= this.life) this.remove();
  }

  /** Out of the top of the view: pick a player, start the shadow, plan the fall. */
  private goAway(): void {
    this.phase = 'away';
    const w = this.world;
    const cam = w.camera;
    const players = w.alivePlayers();
    const p = players.length ? players[players.length > 1 ? w.rng.int(0, players.length - 1) : 0] : null;
    const px = p ? p.x : cam.centerX;
    const py = p ? p.y : cam.bottom - 40;
    this.targetX = Math.max(cam.left + 8, Math.min(cam.right - 8, px + w.rng.int(-PIPE_BATTERY.spread, PIPE_BATTERY.spread)));
    const floor = w.terrain.surfaceY(this.targetX, py - 24, py + 120);
    this.targetY = Number.isFinite(floor) ? floor : py;
    // The shadow grows for the last 40 ticks; the rocket falls in at most that time.
    const lead = 8;
    this.impactT = this.t + lead + PIPE_BATTERY.shadow;
    const startY = cam.top - 16;
    const fall = Math.max(1, Math.min(PIPE_BATTERY.shadow, Math.ceil((this.targetY - startY) / PIPE_BATTERY.rocketFall)));
    this.fallT = this.impactT - fall;
    this.fallV = (this.targetY - startY) / fall;
    this.shadow = w.add(new DropShadow(w, this.targetX, this.targetY, lead, PIPE_BATTERY.shadow));
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.blast(x, y);
  }

  /** Shot down: a harmless pop (50 points went to the shooter). */
  override expire(): void {
    if (this.removed) return;
    explosion(this.world, this.x, this.y, 's', { team: 'enemy', damage: 0, debris: null });
    this.remove();
  }

  private blast(x: number, y: number): void {
    explosion(this.world, x, y, 's', { team: 'enemy', damage: PIPE_BATTERY.rocketDamage, radius: PIPE_BATTERY.blast, falloff: 0, kind: 'explosion' });
  }

  override draw(r: Renderer): void {
    if (this.phase === 'away') return;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(this.phase === 'up' ? `${ART}/rocket` : `${ART}/rocket-down`, this.t >> 2, Math.round(this.x), Math.round(this.y), drawOpts);
  }

  override onRemove(): void {
    this.shadow?.remove();
    this.shadow = null;
    super.onRemove();
  }
}

defineEntity('pipe-battery', (w, x, y, p) => new PipeBattery(w, x, y, p), {
  category: 'enemy',
  score: 3000,
  description: 'Pipe Battery: 5 organ pipes (120 HP, +300 each) fire note-rockets that fall near a player.',
});
defineEntity(
  'note-rocket',
  (w, x, y) =>
    NoteRocket.spawn(w, {
      team: 'enemy', x, y: y - 10, vx: 0, vy: -PIPE_BATTERY.rocketUp, damage: PIPE_BATTERY.rocketDamage, kind: 'explosion',
      sprite: `${ART}/rocket`, look: 'anim', w: 6, h: 10, life: 400, impact: 'none', shootable: true, hp: PIPE_BATTERY.rocketHp,
      score: PIPE_BATTERY.rocketScore, type: 'note-rocket',
    }),
  { category: 'projectile', description: 'Pipe Battery note-rocket: up, then down near a player after a 40-tick shadow (r 14).' },
);
