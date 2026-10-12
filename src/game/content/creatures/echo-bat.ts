/**
 * `echo-bat` — the Echo Bat (docs/GAME_DESIGN.md §9.3; m3-b2, m5-b). 10 HP, 200 points. Contact
 * kills (a small creature: ½ vehicle cell).
 *
 * - Hangs from the ceiling singing little notes (its gag: free time; no contact while asleep).
 *   Disturbed — a player within 96 px, a player shot or blast nearby, a shouting ally — it does a
 *   double-take, drops and flies a sine path toward the player (1.5 px/tick, amplitude 24),
 *   settling into a hover beside and above the player.
 * - Dive: every 120 ticks, T 20 (it flashes white, `creature/bat-screech`) → dives at the player's
 *   position at 3 px/tick → climbs back.
 * - Death: a puff; it falls with X eyes.
 *
 * Spawn y: the bat hangs under the platform line or solid at (or just above) its spawn point
 * (`(100, 1600)` = under the ledge at y 1600); with no ceiling there it hovers asleep in place.
 * Params: `enter` / `entry` (`left` / `right` / `top` / `fly` / `swarm` = flies in awake), `facing`,
 * plus the Enemy params `hp`, `drop`, `tag`.
 * Our choices: one sine wave takes 90 ticks; the hover spot is 56 px beside and 56 px above the
 * player; a dive goes at most 160 px; the climb back takes 36 ticks.
 */
import type { Damage } from '../../../engine/entity';
import type { Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { PAL } from '../../../engine/palette';
import { doubleTakeTicks } from '../../enemy';
import { FxEntity, poof } from '../../fx';
import { defineEntity, paramFacing, type SpawnParams } from '../../registry';
import { Creature, contactHit, entryParam } from './common';

/** Echo bat numbers (GDD §9.3; NORMAL). */
export const ECHO_BAT = {
  hp: 10,
  score: 200,
  wake: 96,
  fly: 1.5,
  amp: 24,
  /** Ticks per sine wave (our choice). */
  wave: 90,
  diveEvery: 120,
  tele: 20,
  dive: 3,
  diveMax: 160,
  climb: 1.5,
  climbTicks: 36,
  hoverDx: 56,
  hoverDy: 56,
  /** Hurtbox around the body centre (the 20×14 body, ears excluded). */
  box: { x: -7, y: -6, w: 14, h: 12 },
  /** Hanging: the body hangs 9–21 px below the feet. */
  hangBox: { x: -6, y: 4, w: 12, h: 18 },
} as const;

const A = 'creature/echo-bat';
const TAU = Math.PI * 2;
/** The hover goal (reused every tick). */
const goalPt: [number, number] = [0, 0];

export class EchoBat extends Creature {
  /** Base point of the sine flight (the bat is drawn at base + normal × sine). */
  private bx: number;
  private by: number;
  private phase = 0;
  /** Smoothed unit normal of the flight (the sine offset direction). */
  private nx = 0;
  private ny = 1;
  private diveCool: number;
  private telegraph: number = ECHO_BAT.tele;
  private diveVx = 0;
  private diveVy = 0;
  private diveLeft = 0;
  private hangs: boolean;
  private readonly touch: Damage;
  private flash = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: A, hp: ECHO_BAT.hp, w: 14, h: 12, body: false });
    this.touch = contactHit(this, 'bullet');
    this.diveCool = world.rng.int(50, ECHO_BAT.diveEvery);
    const t = world.nearestPlayer(this.x, this.y);
    this.facing = paramFacing(p, t && t.x < this.x ? -1 : 1);
    this.setBox(ECHO_BAT.box);
    // `entry` or `enter` may name a flying entry ('fly' / 'swarm'); entryParam reads only left / right / top from `enter`.
    const entry = entryParam(p) || (p.enter === 'fly' || p.enter === 'swarm' ? p.enter : '');
    if (entry === 'left' || entry === 'right' || entry === 'top' || entry === 'fly' || entry === 'swarm' || p.swarm === true) {
      // Awake and flying in (a swarm): body centre at the spawn point.
      this.alerted = true;
      this.hangs = false;
      this.y -= 8;
      if (entry === 'left') this.facing = 1;
      if (entry === 'right') this.facing = -1;
      this.setMode('fly');
    } else {
      // Hang under the ceiling at (or just above) the spawn point, else hover asleep.
      const ceil = this.ceilingAt(this.x, this.y);
      this.hangs = Number.isFinite(ceil);
      if (this.hangs) {
        this.y = ceil;
        this.setBox(ECHO_BAT.hangBox);
        this.setMode('hang');
      } else {
        this.y -= 12;
        this.setMode('hover');
      }
    }
    this.prevY = this.y;
    this.bx = this.x;
    this.by = this.y;
  }

  private setBox(r: { x: number; y: number; w: number; h: number }): void {
    this.hitbox.x = r.x;
    this.hitbox.y = r.y;
    this.hitbox.w = r.w;
    this.hitbox.h = r.h;
  }

  /**
   * The ceiling a bat at (x, y) can hang from: a platform line within 6 px of y (the ledge the
   * spawn names), else the underside of a platform or a solid up to 48 px above. Returns the y of
   * the hanging point (the underside), or Infinity.
   */
  private ceilingAt(x: number, y: number): number {
    const t = this.world.terrain;
    const p = t.platformY(x, y - 48, y + 6);
    if (Number.isFinite(p)) return p + 4;
    const c = t.ceilingY(x, y + 6, 54);
    return Number.isFinite(c) ? c : Infinity;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    this.flash = false;
    this.contactDamage = null;
    if (this.heardShout() && (this.mode === 'hang' || this.mode === 'hover')) this.startNotice(this.world.rng.int(10, 16), 0);
    switch (this.mode) {
      case 'hang':
      case 'hover':
        return this.thinkAsleep();
      case 'notice':
        if (!this.hangs) this.bob();
        if (this.thinkNotice()) this.takeOff();
        return;
      case 'fly':
        return this.thinkFly();
      case 'tell':
        return this.thinkTell();
      case 'dive':
        return this.thinkDive();
      case 'climb':
        return this.thinkClimb();
    }
  }

  private thinkAsleep(): void {
    this.vx = 0;
    this.vy = 0;
    if (this.mode === 'hang') this.play('gag');
    else {
      this.play('idle');
      this.bob();
    }
    // Disturbed: a player within 96 px (any direction), a shot or blast nearby.
    const t = this.target();
    const near = !!t && Math.hypot(t.x - this.x, t.y - 16 - this.y) <= ECHO_BAT.wake && this.onScreen(-4);
    if (near || this.gagNotices(0, 0)) {
      if (this.mode !== 'notice') {
        const take = doubleTakeTicks(this.world);
        this.startNotice(take + 12, take);
      }
    }
    // A note now and then while it sings.
    if (this.mode === 'hang' && this.modeT % 40 === 20 && this.onScreen(16)) this.singNote();
  }

  private bob(): void {
    this.y = this.by + Math.round(Math.sin(this.age / 12) * 2);
  }

  /** Woken: drop off the ceiling and fly. */
  private takeOff(): void {
    if (this.hangs) {
      // From the feet on the ceiling to the body centre below them.
      this.y += 10;
      this.hangs = false;
    }
    this.setBox(ECHO_BAT.box);
    this.bx = this.x;
    this.by = this.y;
    this.phase = 0;
    this.setMode('fly');
  }

  /** Where the bat wants to hover: beside the player (its own side) and above. */
  private hoverGoal(): [number, number] | null {
    const t = this.target();
    if (!t) return null;
    const side = this.x < t.x ? -1 : 1;
    goalPt[0] = t.x + side * ECHO_BAT.hoverDx;
    goalPt[1] = t.y - ECHO_BAT.hoverDy;
    return goalPt;
  }

  private thinkFly(): void {
    this.play('walk');
    const goal = this.hoverGoal();
    let mvx = 0;
    let mvy = 0;
    if (goal) {
      const dx = goal[0] - this.bx;
      const dy = goal[1] - this.by;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const step = Math.min(ECHO_BAT.fly, d);
        mvx = (dx / d) * step;
        mvy = (dy / d) * step;
      }
    }
    this.moveBase(mvx, mvy);
    // Sine offset across the flight direction (vertical while hovering).
    const sp = Math.hypot(mvx, mvy);
    const tnx = sp > 0.3 ? -mvy / sp : 0;
    const tny = sp > 0.3 ? mvx / sp : 1;
    this.nx += (tnx - this.nx) * 0.08;
    this.ny += (Math.abs(tny) - this.ny) * 0.08;
    const nl = Math.hypot(this.nx, this.ny) || 1;
    this.phase += TAU / ECHO_BAT.wave;
    const off = Math.sin(this.phase) * ECHO_BAT.amp * (sp > 0.3 ? 1 : 0.5);
    this.placeAt(this.bx + (this.nx / nl) * off, this.by + (this.ny / nl) * off);
    const t = this.target();
    if (t && Math.abs(t.x - this.x) > 2) this.facing = t.x < this.x ? -1 : 1;
    this.dangerous();
    if (this.dead) return;
    // The dive every 120 ticks (needs an attack token and the bat in view).
    if (--this.diveCool <= 0) {
      if (this.onScreen(-8) && t && this.takeToken()) this.startTell();
      else this.diveCool = 10;
    }
  }

  /** Move the sine base, never into solid terrain. */
  private moveBase(dx: number, dy: number): void {
    const terr = this.world.terrain;
    if (!terr.isSolid(this.bx + dx, this.by)) this.bx += dx;
    if (!terr.isSolid(this.bx, this.by + dy)) this.by += dy;
  }

  /** Put the bat at (x, y) unless that is inside terrain (then it stays). */
  private placeAt(x: number, y: number): void {
    if (this.world.terrain.isSolid(x, y)) return;
    this.vx = x - this.x;
    this.vy = y - this.y;
    this.x = x;
    this.y = y;
  }

  private startTell(): void {
    this.telegraph = this.tele(ECHO_BAT.tele);
    this.setMode('tell');
    this.play('tell');
    this.world.audio.sfx('creature/bat-screech');
  }

  private thinkTell(): void {
    this.vx = 0;
    this.vy = 0;
    this.flash = this.modeT % 4 < 2;
    this.dangerous();
    if (this.modeT < this.telegraph) return;
    const t = this.target();
    // Rule 3: it dives only from inside the view.
    if (!t || !this.onScreen(-8)) return this.cancelAttack();
    const tx = t.x;
    const ty = t.y - 12;
    const d = Math.hypot(tx - this.x, ty - this.y) || 1;
    this.diveVx = ((tx - this.x) / d) * ECHO_BAT.dive;
    this.diveVy = ((ty - this.y) / d) * ECHO_BAT.dive;
    this.diveLeft = Math.min(ECHO_BAT.diveMax, d + 10);
    this.facing = this.diveVx < 0 ? -1 : 1;
    this.setMode('dive');
    this.play('attack');
  }

  private thinkDive(): void {
    const nx = this.x + this.diveVx;
    const ny = this.y + this.diveVy;
    this.diveLeft -= ECHO_BAT.dive;
    if (this.world.terrain.isSolid(nx, ny + 4) || this.diveLeft <= 0) {
      this.setMode('climb');
      this.play('walk');
      return;
    }
    this.vx = this.diveVx;
    this.vy = this.diveVy;
    this.x = nx;
    this.y = ny;
    this.dangerous();
  }

  private thinkClimb(): void {
    this.play('walk');
    this.placeAt(this.x - this.facing * 0.5, this.y - ECHO_BAT.climb);
    this.dangerous();
    if (this.modeT >= ECHO_BAT.climbTicks) {
      this.releaseToken();
      this.bx = this.x;
      this.by = this.y;
      this.phase = 0;
      this.diveCool = ECHO_BAT.diveEvery;
      this.setMode('fly');
    }
  }

  /** Awake: contact kills; touching a driven vehicle breaks the bat (½ cell, GDD §8.5). */
  private dangerous(): void {
    this.touch.dirX = this.facing;
    this.contactDamage = this.touch;
    this.breakOnVehicle(this.touch);
  }

  private singNote(): void {
    FxEntity.spawn(this.world, { sprite: `${A}/note`, x: this.x + this.facing * 8, y: this.y + 18, vx: this.facing * 0.25, vy: -0.35, life: 50, loop: true, z: 31 });
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.flash = false;
    if (this.mode === 'tell' || this.mode === 'dive' || this.mode === 'climb') {
      this.bx = this.x;
      this.by = this.y;
      this.diveCool = 30;
      this.setMode('fly');
    }
  }

  protected override isNapping(): boolean {
    return this.mode === 'hang' || this.mode === 'hover' || super.isNapping();
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    poof(this.world, this.x, this.y);
    this.world.audio.sfx('creature/bat-screech', { pitch: 0.6, vol: 0.7 });
    // From now on (x, y) is the feet: the death strips stand on it, and it falls to the floor.
    if (this.mode === 'hang') this.y += 22;
    else this.y += 6;
    this.vx = d.dirX * 0.6;
    this.vy = -0.5;
    this.corpseTicks = 16;
  }

  /** It falls (no physics body): until it lands on a floor or leaves the world. */
  protected override updateDeath(): void {
    const t = this.world.terrain;
    if (Number.isFinite(this.vy)) {
      const ny = this.y + this.vy;
      const floor = t.surfaceY(this.x, this.y - 1, ny);
      if (Number.isFinite(floor) && this.vy > 0) {
        this.y = floor;
        this.vy = NaN;
      } else {
        this.y = ny;
        this.x += this.vx;
        this.vy = Math.min(this.vy + 0.2, 4);
      }
    }
    super.updateDeath();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.flash && !this.dead) this.drawTint(r, PAL.snow[3], 0.85);
  }
}

defineEntity('echo-bat', (w, x, y, p) => new EchoBat(w, x, y, p), {
  category: 'enemy',
  score: ECHO_BAT.score,
  description: 'Echo Bat: hangs and sings, flies a sine path, dives every 120 ticks (m3, m5).',
});
