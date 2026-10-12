/**
 * `ram-goat` — the Avalanche Goat (docs/GAME_DESIGN.md §9.3; m3-a, m3-b1, m3-c). 80 HP, 800 points.
 * The Legion mascot: a white mountain goat in a crimson knitted scarf. Contact kills only while
 * it charges or leaps.
 *
 * - Charge: T 40 (paws the ground and snorts, dust, `creature/goat`) → charges along its ledge at
 *   3 px/tick, jumping gaps up to 32 px; hitting a wall stuns it for 60 ticks (stars; it takes ×2
 *   damage) → R 40. A goat that misses runs on (into the m3-a avalanche).
 * - Leap-down: T 30 (a shadow appears on the lower ledge) → it leaps down onto it.
 * - Death: tumbles, horns stuck in the snow, legs kicking; poof.
 * - Gag: chews a Legion flag. The first goat a session meets makes Mittens (when he plays) say
 *   `NICE STITCHING.`
 *
 * Params: `enter` / `entry` (`left` / `right`: trots in at 0.8 px/tick, alerted, no gag), `gag`
 * (true / false; default 50 % of placed goats), `facing`, plus the Enemy params `hp`, `drop`, `tag`.
 * Our choices where the GDD is silent: charge range 300 px ahead with the player within 40 px of
 * its height; a charge ends at a wall (stun), at an edge it cannot jump (it skids to a stop),
 * after 320 px, or 24 px outside the view; after a stun it still recovers 40 ticks; a leap-down
 * reaches 112 px sideways and 24–160 px down and is followed by a 16-tick landing squat; a goat
 * steps over bumps up to 10 px (the m3-a moguls) and never trots off a ledge.
 */
import type { Damage } from '../../../engine/entity';
import type { Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { hudOf, sessionOf } from '../../context';
import { dust, drawShadow, poof, snowPuff } from '../../fx';
import { isPlayer } from '../../player/player';
import { defineEntity, paramFacing, type SpawnParams } from '../../registry';
import { Creature, contactHit, drawDizzy, entryParam, gagParam, once } from './common';

/** Avalanche goat numbers (GDD §9.3; NORMAL). */
export const RAM_GOAT = {
  hp: 80,
  score: 800,
  /** Hurtbox: the 36×32 figure without the horn curl and the beard. */
  w: 28,
  h: 26,
  trot: 0.8,
  tele: 40,
  charge: 3,
  gapMax: 32,
  stun: 60,
  stunMultiplier: 2,
  recover: 40,
  leapTele: 30,
  /** Charge: a player this far ahead (px) and this close in height. */
  chargeRange: 300,
  chargeDy: 40,
  chargeMax: 320,
  /** Leap-down reach (px). */
  leapDx: 112,
  leapMinDy: 24,
  leapMaxDy: 160,
  leapVy: -2.2,
  land: 16,
  stepUp: 10,
  gagChance: 0.5,
  sight: 300,
} as const;

const A = 'creature/ram-goat';
const head: [number, number] = [0, 0];
/** Sessions that have heard Mittens' line already (once per game). */
const stitched = new WeakSet<object>();

export class RamGoat extends Creature {
  private telegraph: number = RAM_GOAT.tele;
  private readonly ram: Damage;
  private readonly doubled: Damage = { amount: 0, kind: 'bullet', dirX: 0 };
  /** Charge distance so far and the next mode after a stun or a charge. */
  private run = 0;
  /** Leap-down target (feet). */
  private leapX = 0;
  private leapY = 0;
  private stunned = false;
  private greeted = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: A, hp: RAM_GOAT.hp, w: RAM_GOAT.w, h: RAM_GOAT.h });
    this.clampToSection();
    this.ram = contactHit(this, 'impact');
    this.sightRange = RAM_GOAT.sight;
    if (this.body) this.body.stepUp = RAM_GOAT.stepUp;
    const t = world.nearestPlayer(this.x, this.y);
    this.facing = paramFacing(p, t && t.x < this.x ? -1 : 1);
    const entry = entryParam(p);
    if (entry === 'left' || entry === 'right') {
      this.alerted = true;
      this.facing = entry === 'left' ? 1 : -1;
      this.setMode('trot');
    } else {
      const gag = gagParam(p, world, RAM_GOAT.gagChance);
      if (gag !== null) this.startGag(gag);
      else this.setMode('idle');
    }
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    this.contactDamage = null;
    if (!this.greeted && this.onScreen(0)) this.greet();
    if (this.heardShout() && (this.mode === 'gag' || this.mode === 'idle')) this.startNotice(this.world.rng.int(10, 16));
    switch (this.mode) {
      case 'idle':
        this.vx = 0;
        this.play('idle');
        if (this.checkAlert()) this.startNotice(this.world.rng.int(12, 20));
        return;
      case 'gag':
        this.vx = 0;
        this.play(this.gagAnim);
        this.gagNotices();
        return;
      case 'notice':
        if (this.thinkNotice()) this.setMode('trot');
        return;
      case 'trot':
        return this.thinkTrot();
      case 'tell':
        return this.thinkTell();
      case 'charge':
        return this.thinkCharge();
      case 'stun':
        this.vx = 0;
        this.play('stun');
        if (this.modeT >= RAM_GOAT.stun) {
          this.stunned = false;
          this.toRecover();
        }
        return;
      case 'recover':
        this.vx = 0;
        this.play('idle');
        if (this.modeT >= RAM_GOAT.recover) {
          this.releaseToken();
          this.setMode('trot');
        }
        return;
      case 'leap-tell':
        return this.thinkLeapTell();
      case 'leap':
        return this.thinkLeap();
      case 'land':
        this.vx = 0;
        this.play('land');
        if (this.modeT >= RAM_GOAT.land) {
          this.releaseToken();
          this.setMode('trot');
        }
        return;
    }
  }

  /** The first goat a game meets: Mittens admires the scarf (GDD §9.3). */
  private greet(): void {
    this.greeted = true;
    const session = sessionOf(this.world);
    if (stitched.has(session)) return;
    const players = this.world.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive || !isPlayer(p) || p.character.id !== 'mittens') continue;
      stitched.add(session);
      hudOf(this.world).bubble(p, 'NICE STITCHING.', { kind: 'gag', ticks: 150 });
      return;
    }
  }

  /** Trot toward the player along the ledge; paw when one is level and ahead, leap when below. */
  private thinkTrot(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    if (this.modeT % 20 === 1 || Math.abs(t.x - this.x) > 48) this.facePlayer();
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const inView = this.onScreen(-8);
    if (inView && this.body?.onGround) {
      if (Math.abs(dy) <= RAM_GOAT.chargeDy && Math.abs(dx) <= RAM_GOAT.chargeRange && this.takeToken()) return this.startTell();
      if (dy >= RAM_GOAT.leapMinDy && dy <= RAM_GOAT.leapMaxDy && Math.abs(dx) <= RAM_GOAT.leapDx + 40 && this.findLeapSpot(t.x) && this.takeToken()) {
        return this.startLeapTell();
      }
    }
    // Close enough or at the end of its ledge: wait there.
    if (Math.abs(dx) < 12 || !this.groundAhead(10, 12)) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    this.vx = this.facing * RAM_GOAT.trot;
    this.play('walk');
  }

  /** Is there floor `ahead` px in front within `drop` px below (a bump up to stepUp counts)? */
  private groundAhead(ahead: number, drop: number): boolean {
    const x = this.x + this.facing * (RAM_GOAT.w / 2 + ahead);
    return Number.isFinite(this.world.terrain.surfaceY(x, this.y - RAM_GOAT.stepUp - 2, this.y + drop));
  }

  // ------------------------------------------------------------------------------- charge

  private startTell(): void {
    this.vx = 0;
    this.facePlayer();
    this.telegraph = this.tele(RAM_GOAT.tele);
    this.setMode('tell');
    this.play('tell', { restart: true });
    this.world.audio.sfx('creature/goat');
  }

  private thinkTell(): void {
    this.vx = 0;
    // Paw: a puff of snow behind each scrape.
    if (this.modeT % 10 === 3) snowPuff(this.world, this.x - this.facing * 8, this.y - 1, 2);
    if (this.modeT < this.telegraph) return;
    // Rule 3: the charge starts only with its horns inside the view.
    this.point('horns', 20, -18, head);
    if (!this.inView(head[0], head[1])) return this.cancelAttack();
    this.run = 0;
    this.setMode('charge');
    this.play('attack');
    this.world.audio.sfx('creature/goat', { pitch: 1.3 });
  }

  private thinkCharge(): void {
    const b = this.body;
    this.ram.dirX = this.facing;
    this.contactDamage = this.ram;
    this.play('attack');
    if (b?.contact.hitWall && b.contact.wallDir === this.facing && this.run > 0) return this.hitWall();
    if (this.run >= RAM_GOAT.chargeMax || (this.run > 24 && !this.onScreen(24))) return this.stopCharge();
    if (b?.onGround) {
      if (!this.groundAhead(2, 24)) {
        // An edge: jump a gap up to 32 px, else skid to a stop at the rim.
        if (this.gapLanding()) {
          this.vy = -1.6;
          b.onGround = false;
        } else return this.stopCharge();
      }
      if (this.modeT % 6 === 0) dust(this.world, this.x - this.facing * 10, this.y, 1);
    }
    this.vx = this.facing * RAM_GOAT.charge;
    this.run += RAM_GOAT.charge;
  }

  /** Floor on the far side of a gap (≤ 32 px, about level). */
  private gapLanding(): boolean {
    const t = this.world.terrain;
    for (let d = 8; d <= RAM_GOAT.gapMax + 8; d += 4) {
      const x = this.x + this.facing * (RAM_GOAT.w / 2 + d);
      if (Number.isFinite(t.surfaceY(x, this.y - 12, this.y + 12))) return true;
    }
    return false;
  }

  private hitWall(): void {
    this.vx = 0;
    this.contactDamage = null;
    this.stunned = true;
    this.setMode('stun');
    this.play('stun');
    this.world.camera.shake(2, 8);
    this.world.audio.sfx('hit/metal', { pitch: 0.6 });
    snowPuff(this.world, this.x + this.facing * 16, this.y - 20, 6);
  }

  private stopCharge(): void {
    this.vx = 0;
    this.contactDamage = null;
    dust(this.world, this.x + this.facing * 10, this.y, 4);
    this.toRecover();
  }

  private toRecover(): void {
    this.vx = 0;
    this.setMode('recover');
  }

  // ------------------------------------------------------------------------------- leap-down

  /**
   * A landing spot on a lower floor near `px`: not under the goat's own ledge (it would land on
   * it again), 24–160 px down, at most 112 px sideways. Sets leapX / leapY.
   */
  private findLeapSpot(px: number): boolean {
    const t = this.world.terrain;
    const dir = px >= this.x ? 1 : -1;
    for (let k = 0; k <= 6; k++) {
      const x = px + dir * k * 8;
      if (Math.abs(x - this.x) > RAM_GOAT.leapDx || Math.abs(x - this.x) < 16) continue;
      if (Number.isFinite(t.surfaceY(x, this.y - 40, this.y + 4))) continue;
      const fy = t.surfaceY(x, this.y + 8, this.y + RAM_GOAT.leapMaxDy);
      if (!Number.isFinite(fy) || fy - this.y < RAM_GOAT.leapMinDy) continue;
      if (t.hazardAt({ x: x - 6, y: fy - 4, w: 12, h: 8 })) continue;
      this.leapX = x;
      this.leapY = fy;
      return true;
    }
    return false;
  }

  private startLeapTell(): void {
    this.vx = 0;
    this.facing = this.leapX < this.x ? -1 : 1;
    this.telegraph = this.tele(RAM_GOAT.leapTele);
    this.setMode('leap-tell');
    this.play('tell', { restart: true });
    this.world.audio.sfx('creature/goat', { pitch: 0.9 });
  }

  private thinkLeapTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    this.point('horns', 20, -18, head);
    if (!this.inView(head[0], head[1]) || !this.inView(this.leapX, this.leapY - 4)) return this.cancelAttack();
    // An arc that lands on the spot: y(t) = vy·t + g·t²/2 = dy → t, then vx = dx / t.
    const g = this.body ? this.body.gravity : 0.13;
    const vy = RAM_GOAT.leapVy;
    const dy = this.leapY - this.y;
    const ticks = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
    this.vx = (this.leapX - this.x) / ticks;
    this.vy = vy;
    if (this.body) this.body.onGround = false;
    this.setMode('leap');
    this.play('leap', once());
    this.world.audio.sfx('creature/goat', { pitch: 1.2 });
  }

  private thinkLeap(): void {
    this.ram.dirX = this.facing;
    this.contactDamage = this.ram;
    if (this.modeT > 2 && this.body?.onGround) {
      this.vx = 0;
      this.contactDamage = null;
      snowPuff(this.world, this.x, this.y - 2, 5);
      this.world.camera.shake(1, 6);
      this.setMode('land');
      this.play('land');
      return;
    }
    if (this.modeT > 180) this.setMode('land');
  }

  // ------------------------------------------------------------------------------- hits

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'charge' || this.mode === 'leap-tell') {
      this.vx = 0;
      this.setMode('trot');
    }
  }

  /** Dazed after a wall: every hit counts twice (GDD §9.3). */
  override onHit(d: Damage, part = 0): boolean {
    if (!this.stunned || this.dead) return super.onHit(d, part);
    const x = this.doubled;
    x.amount = d.amount * RAM_GOAT.stunMultiplier;
    x.kind = d.kind;
    x.dirX = d.dirX;
    x.source = d.source;
    x.owner = d.owner;
    x.weapon = d.weapon;
    x.tags = d.tags;
    return super.onHit(x, part);
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    this.stunned = false;
    this.world.audio.sfx('creature/goat', { pitch: 0.7 });
    this.corpseTicks = this.playing('die') ? 24 : d.kind === 'crush' ? 8 : 20;
  }

  override onRemove(): void {
    if (this.dead && this.playing('die')) poof(this.world, this.x, this.y - 12);
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    // The leap's shadow on the lower ledge grows during the telegraph.
    if (!this.dead && (this.mode === 'leap-tell' || this.mode === 'leap')) {
      const k = this.mode === 'leap' ? 1 : Math.min(1, this.modeT / this.telegraph);
      drawShadow(r, this.leapX, this.leapY, 12 + 16 * k, 0.25 + 0.3 * k);
    }
    super.draw(r);
    if (!this.dead && this.mode === 'stun') {
      this.point('head', 12, -30, head);
      drawDizzy(r, Math.round(head[0]), Math.round(head[1]) - 4, this.modeT);
    }
  }
}

defineEntity('ram-goat', (w, x, y, p) => new RamGoat(w, x, y, p), {
  category: 'enemy',
  score: RAM_GOAT.score,
  description: 'Avalanche Goat: paws, charges 3 px/tick along its ledge, leaps down at players below (m3).',
});
