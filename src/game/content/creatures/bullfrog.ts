/**
 * `bullfrog` — the Baritone Bullfrog (docs/GAME_DESIGN.md §9.3; m1-b2, m1-c). 40 HP, 400 points.
 * Its body only pushes (no contact kill); it hops toward a player every 60 ticks (48 px wide,
 * 40 px high), croaks a low ring along the ground and snaps its tongue up close.
 *
 * - Croak: T 40 (the throat sac inflates, `creature/croak-build`) → a ring rolls along the floor
 *   at 2 px/tick for 120 px (10 px tall: jump it) → R 40.
 * - Tongue (a player within 40 px): T 20 (eyes bulge) → the tongue shoots 40 px straight in 8
 *   ticks (kills) → it retracts in 12.
 * - Death: inflates, pops into bubbles and leaves a small dizzy plain frog that hops away.
 * - Gag: catches a fly with its tongue and burps one tiny note.
 *
 * Params: `entry` / `enter` (`hop` = jumps out of the reeds onto its spot with a splash; `top` =
 * drops in; `left` / `right` = hops in alerted), `gag` (true / false; default 40 % of placed
 * frogs), `facing`, plus the Enemy params `hp`, `drop`, `tag`.
 * Our choices where the GDD is silent: hop gravity 0.2 (vy −4.0, 40 ticks in the air, vx 1.2),
 * croak range 36–140 px, a frog never hops onto water or over a pit, its push is 1.5 px/tick.
 */
import { Entity, hostile, type Damage } from '../../../engine/entity';
import type { Rect } from '../../../engine/math';
import { PAL } from '../../../engine/palette';
import { Body, jump, moveBody, pushX } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { Animator } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { playerNoiseNear } from '../../enemy';
import { dust, splash } from '../../fx';
import { isPlayer } from '../../player/player';
import { Projectile, type ProjectileOpts } from '../../projectile';
import { defineEntity, paramFacing, type SpawnParams } from '../../registry';
import { Creature, contactHit, drawDizzy, entryParam, gagParam, held, once, touches } from './common';

/** Bullfrog numbers (GDD §9.3; NORMAL). */
export const BULLFROG = {
  hp: 40,
  score: 400,
  /** Hurtbox (the 28×20 figure without the cap). */
  w: 22,
  h: 15,
  hopEvery: 60,
  hopDist: 48,
  hopHeight: 40,
  /** Our choice: vy0 = −√(2·0.2·40) = −4.0 → 40 ticks in the air → vx = 48 / 40 = 1.2. */
  hopGravity: 0.2,
  /** Crouch before the take-off (part of the hop cycle). */
  hopCrouch: 6,
  croakTicks: 40,
  croakRecover: 40,
  ringSpeed: 2,
  ringRange: 120,
  ringH: 10,
  croakMin: 36,
  croakMax: 140,
  tongueTicks: 20,
  tongueReach: 40,
  tongueOut: 8,
  tongueIn: 12,
  sight: 220,
  push: 1.5,
  gagChance: 0.4,
} as const;

const SONIC: readonly string[] = ['sonic'];
const A = 'creature/bullfrog';

// ---------------------------------------------------------------------------------------------
// The croak ring: rolls along the floor, follows steps up to 6 px, stops at walls and edges.
// ---------------------------------------------------------------------------------------------

export class CroakRing extends Projectile {
  /** Floor line under the ring. */
  floorY = 0;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.floorY = this.y + BULLFROG.ringH / 2;
  }

  override update(): void {
    this.t++;
    const nx = this.x + this.vx;
    const fy = this.world.terrain.surfaceY(nx, this.floorY - 6, this.floorY + 6);
    if (!Number.isFinite(fy)) {
      // A wall or the end of the floor: the ring breaks up.
      this.world.particles.sparks(this.x, this.y, 3, -Math.sign(this.vx));
      this.remove();
      return;
    }
    this.x = nx;
    this.floorY = fy;
    this.y = fy - BULLFROG.ringH / 2;
    if (this.t >= this.life) this.expire();
    else if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }
}

const ringOpts: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };

// ---------------------------------------------------------------------------------------------
// The froglet: the small plain frog left behind by the pop (cosmetic, neutral).
// ---------------------------------------------------------------------------------------------

const frogletDraw: DrawOpts = {};

export class Froglet extends Entity {
  override body = new Body({ w: 6, h: 5, gravity: 0.2 });
  readonly anim = new Animator();
  private readonly dir: 1 | -1;
  private t = 0;

  constructor(world: World, x: number, y: number, dir: 1 | -1) {
    super(world, x, y);
    this.type = 'froglet';
    this.team = 'neutral';
    this.z = 31;
    this.dir = dir;
    this.facing = dir;
    this.hitbox = { x: -3, y: -5, w: 6, h: 5 };
    this.despawnMargin = 24;
    this.anim.play(`${A}/froglet`);
  }

  override update(): void {
    this.t++;
    const b = this.body;
    if (b.onGround) {
      this.vx = 0;
      // Dazed for a moment, then small hops away.
      if (this.t > 40 && this.t % 22 === 0) {
        this.vx = this.dir * 1.1;
        jump(this, -2.2);
      }
    }
    moveBody(this, this.world.terrain, this.world);
    if (b.contact.hitWall) this.vx = 0;
    this.anim.index = b.onGround ? 0 : 1;
    if (this.t > 360) this.remove();
  }

  override draw(r: Renderer): void {
    frogletDraw.flipX = this.facing < 0;
    r.sprite(this.anim.id, this.anim.index, Math.round(this.x), Math.round(this.y), frogletDraw);
    if (this.t < 90) drawDizzy(r, Math.round(this.x), Math.round(this.y) - 9, this.t, 2);
  }
}

// ---------------------------------------------------------------------------------------------
// Bullfrog
// ---------------------------------------------------------------------------------------------

const mouth: [number, number] = [0, 0];
const tongueBox: Rect = { x: 0, y: 0, w: 0, h: 0 };
/** Landing-spot probe of a hop (reused). */
const landBox: Rect = { x: 0, y: 0, w: 8, h: 6 };
const HOP_TRIES: readonly number[] = [BULLFROG.hopDist, BULLFROG.hopDist / 2];
const tongueOpts: DrawOpts = {};

export class Bullfrog extends Creature {
  /** Ticks until the next choice while sitting. */
  private cool: number;
  private croakCool = 0;
  private telegraph: number = BULLFROG.croakTicks;
  /** Tongue length now (px from the mouth). */
  tongueLen = 0;
  private readonly lick: Damage;
  private readonly licked: Entity[] = [];
  private popped = false;
  private hopDir: 1 | -1 = 1;
  /** 1 = a full 48 px hop, 0.5 = a short one (the full one would land on water or in a pit). */
  private hopScale = 1;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: A, hp: BULLFROG.hp, w: BULLFROG.w, h: BULLFROG.h });
    if (this.body) this.body.gravity = BULLFROG.hopGravity;
    this.clampToSection();
    this.lick = contactHit(this, 'bullet');
    this.sightRange = BULLFROG.sight;
    const rng = world.rng;
    this.cool = rng.int(10, 40);
    const t = world.nearestPlayer(this.x, this.y);
    this.facing = paramFacing(p, t && t.x < this.x ? -1 : 1);
    const entry = entryParam(p);
    if (entry === 'top' || entry === 'drop') {
      this.alerted = true;
      this.setMode('drop');
    } else if (entry === 'hop' || entry === 'water') {
      // Out of the reeds: start 48 px behind the spot and land on it.
      this.alerted = true;
      this.x = this.prevX = this.x - this.facing * BULLFROG.hopDist;
      this.y = this.prevY = this.y - 2;
      this.hopDir = this.facing;
      this.vx = this.facing * this.hopSpeed();
      this.vy = this.hopVy();
      this.setMode('hop');
      this.modeT = BULLFROG.hopCrouch;
      if (world.terrain.hazardAt({ x: this.x - 4, y: this.y - 2, w: 8, h: 8 })?.kind === 'water') splash(world, this.x, this.y + 2, 8);
    } else if (entry === 'left' || entry === 'right') {
      this.alerted = true;
      this.facing = entry === 'left' ? 1 : -1;
      this.setMode('sit');
      this.cool = rng.int(0, 12);
    } else {
      const gag = gagParam(p, world, BULLFROG.gagChance);
      if (gag !== null) this.startGag(gag);
      else this.setMode('idle');
    }
  }

  private hopVy(): number {
    return -Math.sqrt(2 * BULLFROG.hopGravity * BULLFROG.hopHeight);
  }

  /** vx that covers the hop distance in the time of a flat hop (2·|vy0| / g ticks). */
  private hopSpeed(): number {
    return BULLFROG.hopDist / ((2 * -this.hopVy()) / BULLFROG.hopGravity);
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.cool > 0) this.cool--;
    if (this.croakCool > 0) this.croakCool--;
    if (this.heardShout() && (this.mode === 'gag' || this.mode === 'idle')) this.startNotice(this.world.rng.int(10, 16));
    this.pushPlayers();
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.play('idle');
        if (this.checkAlert() || playerNoiseNear(this, 48)) this.startNotice(this.world.rng.int(12, 20));
        return;
      case 'gag':
        this.vx = 0;
        this.play(this.gagAnim);
        this.gagNotices();
        return;
      case 'notice':
        if (this.thinkNotice()) this.toSit(10);
        return;
      case 'drop':
        this.vx = 0;
        this.play('walk', held());
        this.anim.index = 2;
        if (this.body?.onGround && this.modeT > 1) {
          dust(this.world, this.x, this.y, 4);
          this.startNotice(12);
        }
        return;
      case 'sit':
        return this.thinkSit();
      case 'hop':
        return this.thinkHop();
      case 'tell':
        return this.thinkCroakTell();
      case 'croak':
        this.vx = 0;
        if (this.modeT >= BULLFROG.croakRecover) {
          this.releaseToken();
          this.croakCool = this.world.rng.int(80, 140);
          this.toSit(this.world.rng.int(10, 30));
        }
        return;
      case 'tell-tongue':
        return this.thinkTongueTell();
      case 'tongue':
        return this.thinkTongue();
    }
  }

  private toSit(cool: number): void {
    this.setMode('sit');
    this.cool = Math.max(this.cool, cool);
    this.tongueLen = 0;
  }

  private thinkSit(): void {
    this.vx = 0;
    this.play('idle');
    if (this.cool > 0 || !this.body?.onGround) return;
    const t = this.target();
    if (!t) {
      this.cool = 30;
      return;
    }
    this.facePlayer();
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    const level = Math.abs(t.y - this.y) <= 24;
    if (level && dist <= BULLFROG.tongueReach + 6 && this.mouthInView()) {
      if (this.takeToken()) return this.startTongue();
    } else if (level && dist >= BULLFROG.croakMin && dist <= BULLFROG.croakMax && this.croakCool <= 0 && this.ringInView()) {
      if (this.world.rng.chance(0.65) && this.takeToken()) return this.startCroak();
    }
    if (dist > BULLFROG.tongueReach && this.startHop(dx > 0 ? 1 : -1)) return;
    this.cool = this.world.rng.int(12, 30);
  }

  /** Hop toward `dir` when the landing spot is real floor (never water, never a pit). */
  private startHop(dir: 1 | -1): boolean {
    const t = this.world.terrain;
    for (let i = 0; i < HOP_TRIES.length; i++) {
      const dist = HOP_TRIES[i];
      const tx = this.x + dir * dist;
      const b = t.bounds;
      if (tx < b.x + 8 || tx > b.x + b.w - 8) continue;
      const fy = t.surfaceY(tx, this.y - BULLFROG.hopHeight, this.y + 48);
      if (!Number.isFinite(fy)) continue;
      landBox.x = tx - 4;
      landBox.y = fy - 3;
      if (t.hazardAt(landBox)) continue;
      this.hopDir = dir;
      this.facing = dir;
      this.setMode('hop');
      this.vx = 0;
      this.hopScale = dist / BULLFROG.hopDist;
      return true;
    }
    return false;
  }

  private thinkHop(): void {
    const b = this.body;
    this.play('walk', held());
    if (this.modeT < BULLFROG.hopCrouch) {
      this.vx = 0;
      this.anim.index = 0;
      return;
    }
    if (this.modeT === BULLFROG.hopCrouch) {
      this.vx = this.hopDir * this.hopSpeed() * this.hopScale;
      jump(this, this.hopVy());
      this.world.audio.sfx('creature/croak', { vol: 0.25, pitch: 1.8 });
      this.anim.index = 1;
      return;
    }
    if (b && b.onGround && this.modeT > BULLFROG.hopCrouch + 2) {
      // Landed: a short squat, then sit until the 60-tick hop cycle is over.
      this.vx = 0;
      this.anim.index = 3;
      dust(this.world, this.x, this.y, 2);
      this.toSit(Math.max(6, BULLFROG.hopEvery - this.modeT));
      return;
    }
    if (b?.contact.hitWall) this.vx = 0;
    this.anim.index = this.vy < -1.2 ? 1 : this.vy < 2.4 ? 2 : 3;
  }

  // ------------------------------------------------------------------------------- croak

  private ringInView(): boolean {
    return this.inView(this.x + this.facing * 12, this.y - BULLFROG.ringH / 2);
  }

  private startCroak(): void {
    this.vx = 0;
    this.telegraph = this.tele(BULLFROG.croakTicks);
    this.setMode('tell');
    this.play('tell', once(0, Math.ceil(this.telegraph / 4)));
    this.world.audio.sfx('creature/croak-build');
  }

  private thinkCroakTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    // Rule 3, checked at the attack: the ring must start inside the view.
    if (!this.ringInView()) return this.cancelAttack();
    this.fireRing();
    this.setMode('croak');
    this.play('attack', once());
    this.world.audio.sfx('creature/croak');
  }

  private fireRing(): void {
    const speed = BULLFROG.ringSpeed * this.mods.enemyBulletSpeed;
    const rx = this.x + this.facing * 12;
    const fy = this.world.terrain.surfaceY(rx, this.y - 6, this.y + 6);
    const o = ringOpts;
    o.x = rx;
    o.y = (Number.isFinite(fy) ? fy : this.y) - BULLFROG.ringH / 2;
    o.vx = this.facing * speed;
    o.vy = 0;
    o.damage = 10;
    o.kind = 'bullet';
    o.tags = SONIC;
    o.life = Math.round(BULLFROG.ringRange / speed);
    o.w = 8;
    o.h = BULLFROG.ringH;
    o.sprite = `${A}/croak-ring`;
    o.look = 'anim';
    o.ticksPerFrame = 4;
    o.hitsTerrain = false;
    o.offscreen = 32;
    o.type = 'croak-ring';
    o.shooter = this;
    CroakRing.spawn(this.world, o);
    o.shooter = null;
  }

  // ------------------------------------------------------------------------------- tongue

  private mouthInView(): boolean {
    this.point('mouth', 13, -8, mouth);
    return this.inView(mouth[0], mouth[1]);
  }

  private startTongue(): void {
    this.vx = 0;
    this.telegraph = this.tele(BULLFROG.tongueTicks);
    this.setMode('tell-tongue');
    this.play('tell-tongue');
    this.world.audio.sfx('creature/croak-build', { pitch: 1.7, vol: 0.6 });
  }

  private thinkTongueTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    if (!this.mouthInView()) return this.cancelAttack();
    this.licked.length = 0;
    this.setMode('tongue');
    this.play('tongue');
    this.world.audio.sfx('creature/croak', { pitch: 2, vol: 0.6 });
  }

  private thinkTongue(): void {
    this.vx = 0;
    const t = this.modeT;
    const out = BULLFROG.tongueOut;
    if (t <= out) {
      this.tongueLen = (BULLFROG.tongueReach * t) / out;
      this.strike();
    } else {
      this.tongueLen = Math.max(0, BULLFROG.tongueReach * (1 - (t - out) / BULLFROG.tongueIn));
    }
    if (t >= out + BULLFROG.tongueIn) {
      this.releaseToken();
      this.toSit(this.world.rng.int(16, 36));
    }
  }

  /** The tongue's box (mouth → tip, 4 px tall) hurts each player target once per strike. */
  private strike(): void {
    this.point('mouth', 13, -8, mouth);
    const len = Math.max(1, Math.round(this.tongueLen));
    tongueBox.x = this.facing > 0 ? mouth[0] : mouth[0] - len;
    tongueBox.y = mouth[1] - 2;
    tongueBox.w = len;
    tongueBox.h = 4;
    this.lick.dirX = this.facing;
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !hostile(this.team, e.team) || this.licked.includes(e)) continue;
        const boxes = e.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          if (!touches(tongueBox, boxes[k])) continue;
          this.licked.push(e);
          this.world.damage(e, this.lick, k);
          break;
        }
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  // ------------------------------------------------------------------------------- body push

  /** The frog's body is a soft obstacle: it pushes players on foot away (never into a pit). */
  private pushPlayers(): void {
    const me = this.hitRect();
    const players = this.world.byTag('player');
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive || !isPlayer(p) || p.state !== 'play' || !touches(me, p.hitRect())) continue;
      const dir = p.x > this.x ? 1 : p.x < this.x ? -1 : -this.facing;
      const nx = p.x + dir * (BULLFROG.push + 7);
      if (!Number.isFinite(this.world.terrain.surfaceY(nx, p.y - 8, p.y + 24))) continue;
      pushX(p, dir * BULLFROG.push, this.world.terrain, this.world);
    }
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.tongueLen = 0;
    if (this.mode === 'tell' || this.mode === 'croak' || this.mode === 'tell-tongue' || this.mode === 'tongue') {
      this.toSit(this.world.rng.int(20, 40));
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    this.tongueLen = 0;
    const a = this.world.audio;
    if (this.playing('die')) {
      a.sfx('creature/croak', { pitch: 0.7 });
      this.corpseTicks = 2;
    } else {
      this.corpseTicks = d.kind === 'crush' ? 6 : 20;
    }
  }

  protected override updateDeath(): void {
    super.updateDeath();
    // The pop: bubbles and the little frog (frame 4 of the inflate strip).
    if (!this.popped && this.playing('die') && this.anim.index >= 4) {
      this.popped = true;
      const w = this.world;
      w.audio.sfx('hit/enemy', { pitch: 1.6 });
      const away = this.killedBy?.dirX ? (this.killedBy.dirX > 0 ? 1 : -1) : this.facing > 0 ? -1 : 1;
      w.add(new Froglet(w, this.x, this.y - 2, away as 1 | -1));
    }
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.dead || this.mode !== 'tongue' || this.tongueLen < 1) return;
    this.point('mouth', 13, -8, mouth);
    const len = Math.round(this.tongueLen);
    const x0 = this.facing > 0 ? Math.round(mouth[0]) : Math.round(mouth[0]) - len;
    const y = Math.round(mouth[1]);
    tongueOpts.alpha = 1;
    r.rect(x0, y - 2, len, 4, PAL.ink[0], tongueOpts);
    r.rect(x0, y - 1, len, 2, PAL.pink[1], tongueOpts);
    r.rect(x0, y - 1, len, 1, PAL.pink[2], tongueOpts);
    const tip = this.facing > 0 ? x0 + len - 2 : x0 - 1;
    r.rect(tip - 1, y - 3, 5, 6, PAL.ink[0], tongueOpts);
    r.rect(tip, y - 2, 3, 4, PAL.pink[2], tongueOpts);
  }
}

defineEntity('bullfrog', (w, x, y, p) => new Bullfrog(w, x, y, p), {
  category: 'enemy',
  score: BULLFROG.score,
  description: 'Baritone Bullfrog: hops, croaks a ground ring, snaps its tongue (m1).',
});
