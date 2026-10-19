/**
 * `seagull` — an aggressive herring gull (docs/design/amsterdam.md §2). 10 HP, soft, 150 points.
 * Based on the `echo-bat` (creatures/echo-bat.ts).
 *
 * - `perch: true`: sits on a lamp post / railing at its spawn point (y = its feet), asleep (the
 *   sleep gag; free time). `gag: 'fries'`: stands at its spawn point pecking a stolen fries cone.
 *   Either wakes when a player comes within 96 px (or a shot / blast nearby, a shouting ally):
 *   a double-take, then it flies.
 * - Awake: a wobbly flight to a hover spot above and beside the player (60 px beside, 64 px up).
 * - TELL 20 (inside the view, with an attack token): flaps, `ams/gull`, bubble `KAW!`.
 * - ATTACK: a dive at the player's position at 3 px/tick (at most 170 px), then a climb back.
 *   The peck is contact damage ONLY while diving; the rest of the time the gull is harmless.
 * - `flock: n` (2–5): the spawn is a flock of n gulls that share one hover area (spread round
 *   the player) and take turns diving (pattern: kazoo-drone `KazooFormation`).
 * - Motion (draw-only, docs/ART_GUIDE.md "Motion"): a 3-frame take-off off the perch, a 2-frame
 *   pull-up out of the dive, and a 2-frame squash turn (Turner hysteresis) instead of an instant
 *   mid-air flip. A tell or a dive cancels them on the same tick; the tell timing is unchanged.
 * - Death: a feather puff; it falls (into the canal over water: a splash, gone).
 *
 * Params: `perch`, `gag` (`sleep` / `fries` / true / false), `flock`, `enter` / `entry`
 * (`left` / `right` / `top`: flies in), `facing`, + the Enemy params `hp`, `drop`, `tag`.
 */
import type { Damage } from '../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { PAL } from '../../../engine/palette';
import { hudOf } from '../../context';
import { doubleTakeTicks } from '../../enemy';
import { FxEntity, splash } from '../../fx';
import { defineEntity, paramBool, paramFacing, paramNum, paramStr, type SpawnParams } from '../../registry';
import { Creature, Turner, contactHit, entryParam } from '../creatures/common';
import { PULLUP_TIMING, TAKEOFF_TIMING, TURN_TICKS } from './seagull.art';

/** Seagull numbers (NORMAL). */
export const SEAGULL = {
  hp: 10,
  score: 150,
  wake: 96,
  fly: 1.4,
  amp: 9,
  wave: 70,
  diveEvery: 110,
  tele: 20,
  dive: 3,
  diveMax: 170,
  climb: 1.5,
  climbTicks: 36,
  hoverDx: 60,
  hoverDy: 64,
  /** Flock: extra spacing per member (px) and dive stagger (ticks). */
  flockDx: 22,
  flockDy: 12,
  flockStagger: 40,
  maxFlock: 5,
  /** Flying hurtbox round the body centre. */
  box: { x: -10, y: -7, w: 20, h: 13 },
  /** Perched hurtbox above the feet. */
  perchBox: { x: -9, y: -19, w: 18, h: 18 },
} as const;

const A = 'enemy/seagull';
const TAU = Math.PI * 2;
const goalPt: [number, number] = [0, 0];
const gullOpts: DrawOpts = {};
const TAKEOFF_TICKS = TAKEOFF_TIMING.reduce((a, b) => a + b, 0);
const PULLUP_TICKS = PULLUP_TIMING.reduce((a, b) => a + b, 0);

/** Frame of a draw-only strip `timing` with `left` ticks to go. */
function stripFrame(timing: readonly number[], total: number, left: number): number {
  let t = total - left;
  for (let i = 0; i < timing.length; i++) {
    if (t < timing[i]) return i;
    t -= timing[i];
  }
  return timing.length - 1;
}

/** One flock (shared by its gulls). */
export class SeagullFlock {
  readonly size: number;
  readonly members: Seagull[] = [];
  constructor(size: number) {
    this.size = size;
  }
}

export class Seagull extends Creature {
  /** One sprite per draw: drawn at the sub-pixel position (Enemy.fineDraw). */
  protected override fineDraw = true;

  readonly flock: SeagullFlock | null;
  readonly slot: number;
  private bx: number;
  private by: number;
  private phase = 0;
  private diveCool: number;
  private telegraph: number = SEAGULL.tele;
  private diveVx = 0;
  private diveVy = 0;
  private diveLeft = 0;
  private perched: boolean;
  private readonly peck: Damage;
  private flash = false;
  private overWater = false;
  /** Draw-only transitions: ticks left of the take-off and the pull-up strips. */
  private takeoffT = 0;
  private pullupT = 0;
  /** Mid-air turns: squash frames, the facing flips half-way (hysteresis 12 px / 8 ticks). */
  private readonly turner = new Turner(1, 2, TURN_TICKS);

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: A, hp: SEAGULL.hp, w: 20, h: 13, body: false });
    this.peck = contactHit(this, 'bullet');
    const g = p.group;
    if (g instanceof SeagullFlock) {
      this.flock = g;
      this.slot = typeof p.slot === 'number' ? p.slot : g.members.length;
    } else {
      const n = Math.max(1, Math.min(SEAGULL.maxFlock, Math.round(paramNum(p, 'flock', 1))));
      this.flock = n > 1 ? new SeagullFlock(n) : null;
      this.slot = 0;
    }
    this.flock?.members.push(this);
    this.diveCool = world.rng.int(40, 80) + this.slot * SEAGULL.flockStagger;
    const t = world.nearestPlayer(this.x, this.y);
    this.facing = paramFacing(p, t && t.x < this.x ? -1 : 1);
    const entry = entryParam(p);
    const gag = paramStr(p, 'gag', '');
    const perch = paramBool(p, 'perch', false) || gag === 'fries' || gag === 'sleep';
    if (perch && !entry && p.awake !== true) {
      this.perched = true;
      this.setBox(SEAGULL.perchBox);
      this.startGag(gag === 'fries' ? 'fries' : '');
    } else {
      this.perched = false;
      this.alerted = true;
      this.setBox(SEAGULL.box);
      if (entry === 'left') this.facing = 1;
      if (entry === 'right') this.facing = -1;
      // Body centre: lifted off a floor spawn point.
      this.y -= p.group instanceof SeagullFlock ? 0 : 24;
      // `enter: 'top'`: start just above the view and fly down into it (hoverGoal clamps it in).
      if (entry === 'top') this.y = Math.min(this.y, world.camera.top - 12);
      this.setMode('fly');
    }
    this.turner.snap(this.facing);
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

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.takeoffT > 0) this.takeoffT--;
    if (this.pullupT > 0) this.pullupT--;
    this.flash = false;
    this.contactDamage = null;
    if (this.slot === 0 && this.flock && this.flock.members.length === 1) this.spawnFlock();
    if (this.heardShout() && this.mode === 'gag') this.startNotice(this.world.rng.int(10, 16), 0);
    switch (this.mode) {
      case 'gag':
        return this.thinkPerch();
      case 'notice':
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

  /** The flock's other gulls (beside the leader, same perch / flight state). */
  private spawnFlock(): void {
    const f = this.flock as SeagullFlock;
    for (let i = 1; i < f.size; i++) {
      const dx = (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2) * 16;
      const params: Record<string, unknown> = { group: f, slot: i, facing: this.facing, hp: this.maxHp };
      if (this.perched) {
        params.perch = true;
        if (this.gagAnim === 'gag-fries') params.gag = 'fries';
        this.world.spawn('seagull', this.x + dx, this.y, params);
      } else {
        params.awake = true;
        this.world.spawn('seagull', this.x + dx, this.y - (i % 3) * 8, params);
      }
    }
  }

  private thinkPerch(): void {
    this.vx = 0;
    this.vy = 0;
    const t = this.target();
    const near = !!t && Math.hypot(t.x - this.x, t.y - 16 - this.y) <= SEAGULL.wake && this.onScreen(-4);
    if (near) {
      const take = doubleTakeTicks(this.world);
      this.startNotice(take + 12, take);
    } else this.gagNotices(0, 0);
  }

  /** Woken: off the perch and into the air. */
  private takeOff(): void {
    if (this.perched) {
      this.perched = false;
      // Same body position: the anchor moves from the feet to the body centre (11 px up); the
      // take-off strip lifts the drawn bird off the perch over 3 frames.
      this.y -= 11;
      this.takeoffT = TAKEOFF_TICKS;
      this.world.audio.sfx('ams/gull', { vol: 0.6 });
    }
    this.setBox(SEAGULL.box);
    this.bx = this.x;
    this.by = this.y;
    this.phase = this.slot;
    this.setMode('fly');
  }

  private hoverGoal(): [number, number] | null {
    const t = this.target();
    if (!t) return null;
    // Flock: members spread to both sides and different heights.
    const s = this.slot;
    let side = this.x < t.x ? -1 : 1;
    if (this.flock && s % 2 === 1) side = -side;
    goalPt[0] = t.x + side * (SEAGULL.hoverDx + Math.ceil(s / 2) * SEAGULL.flockDx);
    goalPt[1] = t.y - SEAGULL.hoverDy - (s % 3) * SEAGULL.flockDy;
    // Stay inside the view top.
    goalPt[1] = Math.max(goalPt[1], this.world.camera.top + 20);
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
        const step = Math.min(SEAGULL.fly, d);
        mvx = (dx / d) * step;
        mvy = (dy / d) * step;
      }
    }
    const terr = this.world.terrain;
    if (!terr.isSolid(this.bx + mvx, this.by)) this.bx += mvx;
    if (!terr.isSolid(this.bx, this.by + mvy)) this.by += mvy;
    // A wobbly path: two sines (vertical bob + a sideways sway).
    this.phase += TAU / SEAGULL.wave;
    const ox = Math.sin(this.phase * 0.5) * SEAGULL.amp * 0.6;
    const oy = Math.sin(this.phase) * SEAGULL.amp * 0.5;
    this.placeAt(this.bx + ox, this.by + oy);
    const t = this.target();
    if (this.turner.facing !== this.facing && !this.turner.turning) this.turner.snap(this.facing);
    if (t) this.turner.update(t.x - this.x);
    this.facing = this.turner.facing;
    if (--this.diveCool <= 0) {
      if (this.onScreen(-8) && t && this.takeToken()) this.startTell();
      else this.diveCool = 12;
    }
  }

  private placeAt(x: number, y: number): void {
    if (this.world.terrain.isSolid(x, y)) return;
    this.vx = x - this.x;
    this.vy = y - this.y;
    this.x = x;
    this.y = y;
  }

  private startTell(): void {
    this.telegraph = this.tele(SEAGULL.tele);
    this.cancelMotion();
    this.setMode('tell');
    this.play('tell', { restart: true });
    this.world.audio.sfx('ams/gull');
    hudOf(this.world).bubble(this, 'KAW!', { ticks: this.telegraph + 6, kind: 'gag' });
  }

  private thinkTell(): void {
    this.vx = 0;
    this.vy = 0;
    this.flash = this.modeT % 4 < 2;
    this.play('tell');
    if (this.modeT < this.telegraph) return;
    const t = this.target();
    if (!t || !this.onScreen(-8)) return this.cancelAttack();
    const tx = t.x;
    const ty = t.y - 12;
    const d = Math.hypot(tx - this.x, ty - this.y) || 1;
    this.diveVx = ((tx - this.x) / d) * SEAGULL.dive;
    this.diveVy = ((ty - this.y) / d) * SEAGULL.dive;
    this.diveLeft = Math.min(SEAGULL.diveMax, d + 12);
    this.facing = this.diveVx < 0 ? -1 : 1;
    this.cancelMotion();
    this.setMode('dive');
    this.play('attack');
  }

  private thinkDive(): void {
    const nx = this.x + this.diveVx;
    const ny = this.y + this.diveVy;
    this.diveLeft -= SEAGULL.dive;
    if (this.world.terrain.isSolid(nx, ny + 5) || this.diveLeft <= 0) {
      this.setMode('climb');
      this.play('walk', { restart: true });
      this.pullupT = PULLUP_TICKS;
      return;
    }
    this.vx = this.diveVx;
    this.vy = this.diveVy;
    this.x = nx;
    this.y = ny;
    // The peck: contact damage only while diving.
    this.peck.dirX = this.facing;
    this.contactDamage = this.peck;
    this.breakOnVehicle(this.peck);
  }

  private thinkClimb(): void {
    this.play('walk');
    this.placeAt(this.x + this.facing * 0.8, this.y - SEAGULL.climb);
    if (this.modeT >= SEAGULL.climbTicks) {
      this.releaseToken();
      this.bx = this.x;
      this.by = this.y;
      this.phase = 0;
      this.diveCool = SEAGULL.diveEvery + (this.flock ? this.flock.size * 10 : 0);
      this.setMode('fly');
    }
  }

  /** Control first: drop every draw-only transition (a tell or a dive starts on this tick). */
  private cancelMotion(): void {
    this.takeoffT = 0;
    this.pullupT = 0;
    this.turner.snap(this.facing);
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.flash = false;
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'dive' || this.mode === 'climb') {
      this.bx = this.x;
      this.by = this.y;
      this.diveCool = 30;
      this.setMode('fly');
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    this.world.audio.sfx('ams/gull', { pitch: 1.4, vol: 0.7 });
    for (let i = 0; i < 5; i++) {
      FxEntity.spawn(this.world, {
        sprite: `${A}/feather`,
        x: this.x + this.world.fxRng.range(-6, 6),
        y: this.y + this.world.fxRng.range(-6, 4) - (this.perched ? 10 : 0),
        vx: this.world.fxRng.range(-0.8, 0.8),
        vy: this.world.fxRng.range(-1.2, -0.2),
        gravity: 0.03,
        drag: 0.96,
        loop: true,
        life: 60,
        wobble: 3,
        frame: i % 4,
      });
    }
    // From now on (x, y) is the feet: the death strips stand on it, and it falls to the floor.
    if (!this.perched) this.y += 7;
    this.vx = d.dirX * 0.6;
    this.vy = this.perched ? NaN : -0.5;
    this.corpseTicks = 16;
  }

  /** It falls (no physics body) until it lands on a floor, drops into water, or leaves the world. */
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
      const h = t.hazardAt({ x: this.x - 2, y: this.y - 2, w: 4, h: 2 });
      if (h && h.kind === 'water' && !this.overWater) {
        this.overWater = true;
        splash(this.world, this.x, h.y, 8);
        this.remove();
        return;
      }
    }
    super.updateDeath();
  }

  override draw(r: Renderer): void {
    if (!this.dead && (this.takeoffT > 0 || this.pullupT > 0 || this.turner.turning)) {
      let name: string;
      let i: number;
      if (this.takeoffT > 0) {
        name = 'takeoff';
        i = stripFrame(TAKEOFF_TIMING, TAKEOFF_TICKS, this.takeoffT);
      } else if (this.pullupT > 0) {
        name = 'pull-up';
        i = stripFrame(PULLUP_TIMING, PULLUP_TICKS, this.pullupT);
      } else {
        name = 'turn';
        i = this.turner.frame();
      }
      gullOpts.flipX = this.facing < 0;
      gullOpts.flash = this.flashTicks > 0;
      r.sprite(this.spriteId(name), i, this.x, this.y, gullOpts);
      return;
    }
    super.draw(r);
    if (this.flash && !this.dead) this.drawTint(r, PAL.gold[3], 0.55);
  }
}

defineEntity('seagull', (w, x, y, p) => new Seagull(w, x, y, p), {
  category: 'enemy',
  score: SEAGULL.score,
  description: 'Herring gull: perches asleep or pecks fries, wobbly flight, KAW! tell, dives (peck only while diving); flock: n (ams).',
});
