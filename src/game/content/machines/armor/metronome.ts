/**
 * `metronome-turret` — the Metronome Turret (GDD §9.2) and its `metronome-bullet`.
 *
 * A wooden pyramid metronome hung upside down from a ceiling or under a bridge (the spawn y is
 * the mount surface); `params.floor: true` stands it upright on the ground (without the param a
 * turret spawned on a floor with open air above stands up by itself). Its pendulum is the gun:
 * - it swings between −50° and +50° from straight down (up on the floor); one swing (extreme to
 *   extreme) takes 60 ticks (×1.3 / ×1 / ×0.8 by difficulty: the time between attacks);
 * - it glows for the last 18 ticks before each extreme (the telegraph; an attack token is taken
 *   when the glow starts, no token = no glow and no burst) and ticks or tocks there
 *   (`machine/metronome-tick` / `-tock`);
 * - at each extreme it fires a 3-bullet burst along the pendulum (2.5 px/tick, 6 ticks apart);
 * - accelerando: 600 ticks after it first came into view the sliding weight slides down (visible)
 *   and from the next extreme a swing takes 45 ticks.
 * It starts swinging (from the middle, so the first glow is complete) the first time it is on
 * screen, and never fires with the pendulum tip outside the view. Death: the pendulum snaps and
 * twangs away, spinning; the broken box stays.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { FxEntity, FX_SMOKE } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { METRONOME, metronomeFrame, type RelRect } from './geom';
import { Machine } from './machine';

/** Metronome Turret numbers (GDD §9.2; NORMAL). */
export const METRONOME_TURRET = {
  hp: 300,
  amplitude: METRONOME.maxAngle,
  swing: 60,
  fastSwing: 45,
  accelAfter: 600,
  glow: 18,
  burst: 3,
  burstGap: 6,
  bulletSpeed: 2.5,
  bulletDamage: 10,
  /** Ticks the weight takes to slide down (cosmetic). */
  weightSlide: 24,
} as const;

const ART = 'machine/metronome-turret';
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.55 };
const glowOpts: DrawOpts = { blend: 'add', alpha: 0.8 };
const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };
const tip: [number, number] = [0, 0];
const DEG = Math.PI / 180;

export class MetronomeTurret extends Machine {
  /** Stands upright on the ground (true) or hangs from the ceiling (false). */
  readonly floor: boolean;
  /** Pendulum angle in degrees from straight down (ceiling) / up (floor); + = toward +x. */
  angle = 0;
  /** Ticks into the current swing and its length. */
  swingT = 0;
  period: number;
  /** The extreme the pendulum is swinging toward (+1 right, −1 left). */
  side: 1 | -1 = 1;
  /** Ticks since it first came into view (the accelerando counts these). */
  activeT = 0;
  /** After the accelerando: the weight is down and the swing is shorter. */
  fast = false;
  /** The glow (telegraph) before the coming extreme is on. */
  glowing = false;
  /** Shots left in the running burst. */
  burstLeft = 0;
  private burstT = 0;
  private fastPending = false;
  private readonly fastPeriod: number;
  /** 0 → 1 while the weight slides down. */
  private weightT = 0;
  private readonly box: RelRect;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: METRONOME_TURRET.hp, w: 28, h: 32, body: false });
    this.floor = paramBool(p, 'floor', standsOnFloor(world, x, y));
    const b = METRONOME.box;
    this.box = this.floor ? { x: b.x, y: -b.y - b.h, w: b.w, h: b.h } : b;
    const bb = METRONOME.bounds;
    this.hitbox = this.floor ? { x: bb.x, y: -bb.h, w: bb.w, h: bb.h } : { ...bb };
    this.period = this.recover(paramNum(p, 'swing', METRONOME_TURRET.swing));
    this.fastPeriod = this.recover(METRONOME_TURRET.fastSwing);
    this.facing = 1;
  }

  /** Start swinging from the middle toward the right extreme. */
  protected override onActivate(): void {
    this.swingT = this.period >> 1;
    this.side = 1;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    if (!this.checkActive()) return;
    this.activeT++;
    if (this.activeT === METRONOME_TURRET.accelAfter) this.fastPending = true;
    if (this.fastPending || this.fast) this.weightT = Math.min(1, this.weightT + 1 / METRONOME_TURRET.weightSlide);
    this.swingT++;
    // The glow (telegraph) covers the last 18 ticks before the extreme.
    const glow = this.tele(METRONOME_TURRET.glow);
    if (!this.glowing && this.burstLeft === 0 && this.period - this.swingT === glow) {
      this.glowing = this.onScreen(-8) && this.takeToken();
    }
    if (this.swingT >= this.period) this.extreme();
    this.angle = -this.side * METRONOME_TURRET.amplitude * Math.cos((Math.PI * this.swingT) / this.period);
    if (this.burstLeft > 0) {
      if (this.burstT <= 0) {
        this.fire();
        this.burstLeft--;
        this.burstT = METRONOME_TURRET.burstGap;
        if (this.burstLeft === 0) this.releaseToken();
      }
      this.burstT--;
    }
  }

  /** At an extreme: tick (right) or tock (left), start the burst, turn back. */
  private extreme(): void {
    if (this.onScreen(16)) this.world.audio.sfx(this.side > 0 ? 'machine/metronome-tick' : 'machine/metronome-tock');
    if (this.glowing) {
      this.glowing = false;
      this.burstLeft = METRONOME_TURRET.burst;
      this.burstT = 0;
    }
    this.side = this.side > 0 ? -1 : 1;
    this.swingT = 0;
    if (this.fastPending) {
      this.fastPending = false;
      this.fast = true;
      this.period = this.fastPeriod;
    }
  }

  /** Pivot of the pendulum (world). */
  private pivotY(): number {
    return this.y + (this.floor ? -METRONOME.pivotY : METRONOME.pivotY);
  }

  /** A point `dist` px along the pendulum from the pivot. */
  private along(dist: number, out: [number, number]): [number, number] {
    const a = this.angle * DEG;
    out[0] = this.x + Math.sin(a) * dist;
    out[1] = this.pivotY() + (this.floor ? -Math.cos(a) : Math.cos(a)) * dist;
    return out;
  }

  /** One bullet along the pendulum, from just past the bob (never from outside the view). */
  private fire(): void {
    const m = this.along(METRONOME.muzzle, tip);
    if (!this.inView(m[0], m[1])) return;
    const a = this.angle * DEG;
    const s = METRONOME_TURRET.bulletSpeed * this.mods.enemyBulletSpeed;
    const o = shot;
    o.x = m[0];
    o.y = m[1];
    o.vx = Math.sin(a) * s;
    o.vy = (this.floor ? -Math.cos(a) : Math.cos(a)) * s;
    o.damage = METRONOME_TURRET.bulletDamage;
    o.kind = 'bullet';
    o.sprite = `${ART}/bullet`;
    o.look = 'anim';
    o.ticksPerFrame = 4;
    o.w = 4;
    o.h = 4;
    o.life = 300;
    o.offscreen = 24;
    o.shooter = this;
    o.type = 'metronome-bullet';
    Projectile.spawn(this.world, o);
    o.shooter = null;
    this.world.audio.sfx('enemy/rifle', { vol: 0.6, pitch: 1.3 });
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    this.glowing = false;
    this.burstLeft = 0;
  }

  /** SAY CHEESE: the pendulum holds still for the photo (the swing resumes afterwards). */
  protected override thinkReaction(): void {
    this.vx = 0;
  }

  override hurtboxes(): readonly Rect[] {
    this.rel(this.box, this.boxes[0], false);
    return this.boxes;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    this.releaseToken();
    this.glowing = false;
    this.burstLeft = 0;
    const cy = this.y + this.box.y + this.box.h / 2;
    this.boom(this.x, cy, 'm', 'wood');
    // The pendulum snaps and twangs away, spinning.
    const t = this.along(METRONOME.rod * 0.6, tip);
    const dir = this.angle >= 0 ? 1 : -1;
    FxEntity.spawn(this.world, {
      sprite: `${ART}/snap`,
      x: t[0],
      y: t[1],
      vx: dir * 1.6,
      vy: this.floor ? -3.2 : -1.6,
      gravity: 0.16,
      loop: true,
      life: 90,
      ticksPerFrame: 3,
      z: 31,
    });
    this.world.audio.sfx('hit/metal', { pitch: 0.55 });
  }

  /** The broken box stays (smoking for a while) until it scrolls away. */
  protected override updateDeath(): void {
    this.deathTicks++;
    if (this.deathTicks < 240 && this.deathTicks % 8 === 0) {
      const cy = this.y + this.box.y + this.box.h / 2;
      this.world.particles.emit(FX_SMOKE, this.x + this.world.fxRng.range(-6, 6), cy, 0, -0.35);
    }
  }

  override update(): void {
    super.update();
    if (this.alive) this.emitDamage(this.x, this.y + this.box.y + this.box.h / 2);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    drawOpts.flash = false;
    const suffix = this.floor ? '-floor' : '';
    if (this.dead) {
      r.sprite(`${ART}/wreck${suffix}`, 0, x, y, drawOpts);
      return;
    }
    drawOpts.flash = this.flashTicks > 0;
    r.sprite(`${ART}/body${suffix}`, 0, x, y, drawOpts);
    // GDD §9.2: a dented plate from 50 % HP.
    if (this.damageState > 0) r.sprite(`${ART}/dent${suffix}`, 0, x, y, drawOpts);
    const f = metronomeFrame(this.angle);
    const py = Math.round(this.pivotY());
    r.sprite(`${ART}/pendulum${suffix}`, f, x, py, drawOpts);
    // The sliding weight, drawn on its own so the accelerando slide is visible. It slides DOWN
    // (GDD): away from the pivot on a hanging turret, toward it on a standing one.
    const from = this.floor ? METRONOME.weightFast : METRONOME.weight;
    const to = this.floor ? METRONOME.weight : METRONOME.weightFast;
    const w = this.along(from + (to - from) * this.weightT, tip);
    r.sprite(`${ART}/weight${suffix}`, f, Math.round(w[0]), Math.round(w[1]), drawOpts);
    if (this.glowing || this.burstLeft > 0) this.drawGlow(r, x, py, f, suffix);
  }

  /** The telegraph: the pendulum glows gold (pulsing white near the extreme), a hot spot at the tip. */
  private drawGlow(r: Renderer, x: number, py: number, f: number, suffix: string): void {
    const near = this.glowing && this.period - this.swingT <= 6;
    tintOpts.tint = near && this.age % 4 < 2 ? 0xffffffff : 0xfff184ff;
    tintOpts.alpha = this.glowing ? 0.35 + 0.25 * ((this.age >> 1) % 2) : 0.5;
    r.sprite(`${ART}/pendulum${suffix}`, f, x, py, tintOpts);
    const m = this.along(METRONOME.rod, tip);
    const mx = Math.round(m[0]);
    const my = Math.round(m[1]);
    r.rect(mx - 2, my - 2, 5, 5, 0xf6c537ff, glowOpts);
    r.rect(mx - 1, my - 1, 3, 3, 0xffffffff, glowOpts);
  }
}

/** A floor below the spawn point with open air above it (and no ceiling to hang from). */
function standsOnFloor(world: World, x: number, y: number): boolean {
  const t = world.terrain;
  return t.cellAt(x, y + 2) !== 0 && t.cellAt(x, y - 3) === 0;
}

defineEntity('metronome-turret', (w, x, y, p) => new MetronomeTurret(w, x, y, p), {
  category: 'enemy',
  score: 1500,
  description: 'Metronome Turret: a hanging (or `floor: true` standing) metronome; its pendulum fires 3-bullet bursts at each extreme.',
});
defineEntity(
  'metronome-bullet',
  (w, x, y, p) =>
    Projectile.spawn(w, {
      team: 'enemy', x, y: y - 24, vx: (p.facing === 1 || p.facing === 'right' ? 1 : -1) * METRONOME_TURRET.bulletSpeed, vy: 0,
      damage: METRONOME_TURRET.bulletDamage, sprite: `${ART}/bullet`, look: 'anim', w: 4, h: 4, life: 300, type: 'metronome-bullet',
    }),
  { category: 'projectile', description: 'Metronome Turret bullet (2.5 px/tick).' },
);
