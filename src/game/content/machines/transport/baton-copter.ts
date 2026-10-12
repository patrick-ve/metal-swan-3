/**
 * `baton-copter` — Baton Copter (GDD §9.2).
 *
 * A one-seat gyrocopter whose rotor is a giant spinning conductor's baton; the pilot wears a
 * leather flying helmet with a white plume. Anchor = the hull centre.
 * - Ground mode (default): flies in and hovers 60–90 px above the ground (its skids), moving to
 *   a new spot near the player every 120 ticks at 1.2 px/tick.
 *   **Note spread:** telegraph 24 (× difficulty, ≥ 18: the pilot raises his baton, the rotor
 *   pitch rises) → 3 note-bullets at 60°, 90° and 120° (forward-down, down, back-down; 0° = the
 *   facing), 2 px/tick, 10 damage → recovery 60. Attack tokens apply; the bell under the pod
 *   must be in view at the shot.
 * - Flight mode (`mode: 'air'`): level flight at 1.2 px/tick in its direction (m3-a crosses the
 *   piste; m5-a flies through the scrolling sky); the spread is aimed at the player (±15°).
 * - Contact kills (a moving enemy vehicle; a big hit for vehicles).
 * - Death: it spins down like a sycamore seed and crashes; the pilot bails out under a
 *   parachute, holding his hat, and scurries off (cosmetic).
 * Params: `mode` ('ground' | 'air'), `dir` / `from` / `enter` / `facing` (direction), plus
 * `hp`, `drop`. The spawn y is the hull centre; spawned on the floor (`ctx.enter` without `y`)
 * it climbs to its hover height.
 */
import type { Damage } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { ParticlePreset } from '../../../../engine/particles';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { debris, explosion, smokeTrail } from '../../../fx';
import { Projectile } from '../../../projectile';
import { defineEntity, paramStr, type SpawnParams } from '../../../registry';
import { TransportMachine, travelDir } from './machine';
import { Parachutist } from './props';

/** Baton copter numbers (GDD §9.2; NORMAL). */
export const COPTER = {
  hp: 200,
  score: 1500,
  w: 48,
  h: 36,
  /** Hover height: the skids this far above the ground. */
  hoverMin: 60,
  hoverMax: 90,
  moveEvery: 120,
  speed: 1.2,
  telegraph: 24,
  recover: 60,
  /** Ticks between attacks (+ up to 20 random), × difficulty. */
  interval: 40,
  noteSpeed: 2,
  noteDamage: 10,
  /** The ground-mode spread (degrees from the facing, + = down). */
  spread: [60, 90, 120] as readonly number[],
  /** Flight mode: aimed, ±15°. */
  airSpread: 15,
  /** The brass bell under the pod (note muzzle), unflipped. */
  gunDx: 3,
  gunDy: 15,
  /** Skids below the anchor. */
  skids: 18,
  contact: 100,
} as const;

export const COPTER_ART = 'machine/baton-copter';
export const NOTE_SPRITE = `${COPTER_ART}/note-bullet`;
const SPIN_SPRITE = `${COPTER_ART}/spin`;
const DEG = Math.PI / 180;

export type CopterState = 'fly' | 'tell' | 'recover';

const glowOpts: DrawOpts = { blend: 'add', alpha: 0.9 };

/** Brass glints at the bell when the notes leave. */
const GLINT: ParticlePreset = {
  kind: 'pixel',
  life: [6, 12],
  drag: 0.9,
  colors: [PAL.gold[3], PAL.gold[2], PAL.gold[1]],
  additive: true,
};

/** Fire one note-bullet (`note-bullet`, GDD §15.4): a gold eighth note, 10 damage. */
export function fireNote(world: World, shooter: TransportMachine, x: number, y: number, angle: number, speed: number): Projectile {
  const s = speed * shooter.mods.enemyBulletSpeed;
  return Projectile.spawn(world, {
    team: 'enemy',
    x,
    y,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    damage: COPTER.noteDamage,
    kind: 'bullet',
    sprite: NOTE_SPRITE,
    look: 'anim',
    ticksPerFrame: 6,
    w: 6,
    h: 6,
    life: 300,
    offscreen: 32,
    shooter,
    type: 'note-bullet',
  });
}

export class BatonCopter extends TransportMachine {
  state: CopterState = 'fly';
  stateT = 0;
  readonly air: boolean;
  readonly dir: 1 | -1;
  /** The hover spot it is flying to (ground mode). */
  spotX: number;
  spotY: number;
  /** Volleys fired (scripts and tests). */
  volleys = 0;
  private spotT = 0;
  private cool: number;
  private faceT = 0;
  private telegraph: number = COPTER.telegraph;
  private readonly loopKey: string;
  private looping = false;
  private readonly contact: Damage;
  private spinVy = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: COPTER_ART, hp: COPTER.hp, w: COPTER.w, h: COPTER.h, centred: true });
    this.air = paramStr(p, 'mode', 'ground') === 'air';
    this.dir = travelDir(p, -1);
    this.facing = this.dir;
    this.spotX = x;
    this.spotY = y;
    this.cool = world.rng.int(30, 60);
    this.loopKey = `copter-${this.id}`;
    this.smokeX = -8;
    this.smokeY = -4;
    this.contact = { amount: COPTER.contact, kind: 'impact', dirX: this.dir, source: this };
    this.contactDamage = this.contact;
    if (!this.air) this.pickSpot();
    this.play('body');
  }

  private setState(s: CopterState): void {
    this.state = s;
    this.stateT = 0;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.stateT++;
    if (this.cool > 0) this.cool--;
    if (this.air) this.flyLevel();
    else this.hover();
    switch (this.state) {
      case 'fly':
        if (this.cool <= 0) this.tryAttack();
        break;
      case 'tell':
        if (this.stateT >= this.telegraph) this.fire();
        break;
      case 'recover':
        if (this.stateT >= this.recover(COPTER.recover)) {
          this.releaseToken();
          this.cool = this.fireInterval(COPTER.interval, 20);
          this.setState('fly');
        }
        break;
    }
    this.contactDamage = this.contact;
    this.play(this.state === 'tell' ? 'tell' : this.state === 'recover' && this.stateT < 8 ? 'fire' : 'body');
    this.rotorSound();
  }

  /** Ground mode: hold a hover spot near the player; a new one every 120 ticks. */
  private hover(): void {
    if (++this.spotT >= COPTER.moveEvery && this.state === 'fly') this.pickSpot();
    const busy = this.state !== 'fly';
    const dx = this.spotX - this.x;
    const dy = this.spotY - this.y;
    const d = Math.hypot(dx, dy);
    if (!busy && d > 0.5) {
      const s = Math.min(COPTER.speed, d);
      this.vx = (dx / d) * s;
      this.vy = (dy / d) * s;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
    this.x += this.vx;
    this.y += this.vy;
    // A gentle hover bob (cosmetic) and a turn toward the player every 30 ticks.
    this.drawDy = Math.round(Math.sin(this.age / 14));
    if (++this.faceT >= 30 && !busy) {
      this.faceT = 0;
      this.facePlayer();
    }
  }

  /** A new hover spot: near the player, inside the view, its skids 60–90 px over the floor. */
  private pickSpot(): void {
    const w = this.world;
    const cam = w.camera;
    const t = this.target();
    const rng = w.rng;
    this.spotT = 0;
    let sx = (t ? t.x : cam.centerX) + rng.range(-100, 100);
    sx = Math.max(cam.left + 40, Math.min(cam.right - 40, sx));
    const floor = w.terrain.surfaceY(sx, cam.top + 40, Infinity);
    const ground = Number.isFinite(floor) ? Math.min(floor, cam.bottom) : cam.bottom - 40;
    let sy = ground - rng.range(COPTER.hoverMin, COPTER.hoverMax) - COPTER.skids;
    sy = Math.max(cam.top + 26, Math.min(cam.bottom - 60, sy));
    this.spotX = sx;
    this.spotY = sy;
  }

  /** Flight mode: level flight across. */
  private flyLevel(): void {
    this.facing = this.dir;
    this.vx = this.dir * COPTER.speed;
    this.vy = 0;
    this.x += this.vx;
    this.drawDy = Math.round(Math.sin(this.age / 14));
  }

  private gunX(): number {
    return this.x + COPTER.gunDx * this.facing;
  }

  private gunY(): number {
    return this.y + COPTER.gunDy;
  }

  private tryAttack(): void {
    const t = this.target();
    if (!t || !this.inView(this.gunX(), this.gunY())) return;
    // Ground mode attacks only once it hovers near the player (not while still flying in).
    if (!this.air && (Math.abs(this.spotX - this.x) > 8 || Math.abs(t.x - this.x) > 220)) return;
    if (!this.takeToken()) {
      this.cool = 10;
      return;
    }
    if (!this.air) this.facePlayer();
    this.telegraph = this.tele(COPTER.telegraph);
    this.setState('tell');
  }

  private fire(): void {
    const w = this.world;
    const gx = this.gunX();
    const gy = this.gunY();
    // Never from outside the view (checked again at the shot, GDD §4.11 rule 3).
    if (!this.inView(gx, gy)) {
      this.cancelAttack();
      return;
    }
    if (this.air) {
      const base = this.aimAt(gx, gy);
      for (let k = -1; k <= 1; k++) fireNote(w, this, gx, gy, base + k * COPTER.airSpread * DEG, COPTER.noteSpeed);
    } else {
      for (let i = 0; i < COPTER.spread.length; i++) {
        const a = COPTER.spread[i] * DEG;
        fireNote(w, this, gx, gy, this.facing > 0 ? a : Math.PI - a, COPTER.noteSpeed);
      }
    }
    this.volleys++;
    w.audio.sfx('enemy/rifle', { pitch: 1.7, vol: 0.7 });
    w.particles.burst(GLINT, gx, gy, 3, 0.4, 1.2, Math.PI / 2, 1.2);
    this.setState('recover');
  }

  protected override cancelAttack(): void {
    if (this.state === 'tell') {
      this.setState('fly');
      this.cool = 20;
    }
    this.releaseToken();
  }

  /** The rotor chop while (nearly) on screen; its pitch rises during the telegraph. */
  private rotorSound(): void {
    const a = this.world.audio;
    const on = this.onScreen(32);
    if (on) {
      a.sfxLoop?.(this.loopKey, 'machine/copter', { pitch: this.state === 'tell' ? 1.35 : 1, vol: 0.5 });
      this.looping = true;
    } else if (this.looping) {
      a.stopSfx?.(this.loopKey);
      this.looping = false;
    }
  }

  private stopRotor(): void {
    if (!this.looping) return;
    this.world.audio.stopSfx?.(this.loopKey, 10);
    this.looping = false;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    const w = this.world;
    this.stopRotor();
    this.spinVy = 0.6;
    explosion(w, this.x, this.y, 's', { team: 'enemy', lift: 0 });
    // The pilot bails out holding his hat.
    w.add(new Parachutist(w, this.x, this.y - 4, COPTER_ART, this.facing));
  }

  protected override updateDeath(): void {
    const w = this.world;
    this.deadT++;
    // Spins down like a sycamore seed: a swaying, slowly accelerating fall.
    this.spinVy = Math.min(this.spinVy + 0.03, 1.8);
    this.x += Math.sin(this.deadT / 7) * 1.1 + (this.air ? this.dir * 0.6 : 0);
    this.y += this.spinVy;
    if (this.deadT % 3 === 0) smokeTrail(w, this.x, this.y - 6, true);
    const floor = w.terrain.surfaceY(this.x, this.y - 10, Infinity);
    if (this.y + COPTER.skids >= floor) {
      explosion(w, this.x, floor, 'm', { team: 'enemy', debris: 'metal' });
      debris(w, this.x, floor - 4, 'metal', 6);
      this.remove();
    } else if (this.y - 20 > w.camera.bottom + 16) this.remove();
  }

  override onRemove(): void {
    this.stopRotor();
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.dead) {
      this.drawStrip(r, SPIN_SPRITE, Math.floor(this.deadT / 3), 0, 0, false);
      return;
    }
    super.draw(r);
    if (this.state === 'tell' && this.telegraph - this.stateT <= 6) {
      // The bell under the pod glows just before the volley.
      const gx = Math.round(this.gunX());
      const gy = Math.round(this.gunY() + this.drawDy);
      r.rect(gx - 2, gy - 1, 5, 3, PAL.gold[3], glowOpts);
      r.rect(gx - 1, gy - 2, 3, 5, PAL.gold[2], glowOpts);
    }
  }
}

defineEntity('baton-copter', (w, x, y, p) => new BatonCopter(w, x, y, p), {
  category: 'enemy',
  score: COPTER.score,
  description: 'Baton Copter: hovers 60-90 px up, telegraphed 3-note spreads (mode air: level flight, aimed). Params mode, dir.',
});

defineEntity(
  'note-bullet',
  (w, x, y, p) => {
    // A stand-alone note (missions rarely need one): flies left at 2 px/tick unless told otherwise.
    const vx = typeof p.vx === 'number' ? p.vx : -COPTER.noteSpeed;
    const vy = typeof p.vy === 'number' ? p.vy : 0;
    const n = new Projectile(w);
    n.init({ team: 'enemy', x, y, vx, vy, damage: COPTER.noteDamage, sprite: NOTE_SPRITE, look: 'anim', ticksPerFrame: 6, w: 6, h: 6, life: 300, offscreen: 32, type: 'note-bullet' });
    return n;
  },
  { category: 'projectile', description: 'Baton-copter note: a gold eighth note, 10 damage (params vx, vy).' },
);
