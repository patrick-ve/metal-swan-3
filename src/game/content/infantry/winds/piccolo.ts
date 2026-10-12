/**
 * `piccolo` — the Piccolo Sniper (GDD §9.1): a slim soldier in a crimson beret with a long white
 * feather who always lies prone on rooftops, ledges and balconies (never on the main ground
 * line), aiming a long thin silver piccolo-rifle. 20 HP, 400 points, hitbox 30×10.
 *
 * - **Aim:** T 45 — a dotted crimson aim line (every other pixel) from the muzzle to the
 *   player's chest with a rising whistle (`enemy/piccolo-whistle`); the line **locks** (turns
 *   solid) 12 ticks before the shot, so a moving player can step out of it → A one
 *   `piccolo-bullet` at 4 px/tick along the locked line → R 120 (reload). He aims within a cone
 *   (70° up to 80° down from his facing) and only with a clear line of sight: right under his
 *   ledge a player is safe.
 * - **Gag** `scales` (or `nap`): when he notices a player he jumps, drops his piccolo off the
 *   ledge and takes a spare from his beret — 40 extra ticks before his first aim.
 * - **Death** (shot): slides off the ledge with a long slide whistle and lands off-screen
 *   ("plop"): he slides to the nearest ledge edge, drops, and vanishes behind the floor below.
 *   The other death variants are the shared ones (blast, burn, knife swoon, crush, shatter).
 * - He never walks (`anchored`): entries are ignored, a panic or a reaction plays where he lies.
 *
 * The prone body strips have no piccolo while aiming: the game draws `enemy/piccolo-rifle`
 * (32 directions) at the aim angle from the frame's `hand` point.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { Body } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { getFrame, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { drawAimLine, dust, tumble } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, type SpawnParams } from '../../../registry';
import { SoldierProp } from '../index';
import { looped, once, still, WindSoldier } from './soldier';

/** Piccolo Sniper numbers (GDD §9.1; NORMAL, scaled by difficulty in code). */
export const PICCOLO = {
  hp: 20,
  score: 400,
  /** T 45, the last 12 locked → A → R 120. */
  aim: 45,
  lock: 12,
  reload: 120,
  /** Ticks the shot pose shows before the reload starts (part of R). */
  fireTicks: 10,
  /** Pause after the reload before the next aim (GDD silent; jittered ±15). */
  cooldown: 30,
  bullet: { speed: 4, damage: 10 },
  /** Woken from a gag: startle hop + spare piccolo = 40 extra ticks before the first aim. */
  startle: 16,
  spare: 24,
  /** Aim cone relative to his facing (degrees, + = down) and reach (px). */
  coneUp: -70,
  coneDown: 80,
  sight: 320,
  /** Length of the piccolo-rifle from the hand to the muzzle (px). */
  barrel: 15,
  /** Death slide speed and the farthest ledge edge he looks for (px). */
  slide: 1.6,
  slideMax: 64,
} as const;

export const PICCOLO_GAGS: readonly string[] = ['scales', 'nap'];

type Phase = 'track' | 'lock' | 'fire' | 'reload';

const DEG = Math.PI / 180;
const hand: [number, number] = [0, 0];
const muz: [number, number] = [0, 0];
const head: [number, number] = [0, 0];
const rifleOpts: DrawOpts = {};
const clipOpts: DrawOpts = {};
/** Number of directions in `enemy/piccolo-rifle` (frame 0 points right, clockwise). */
const RIFLE_DIRS = 32;
const AIM_RED = PAL.red[3];

/** Spawn params without an entry: a prone sniper is always placed, never runs in. */
function placed(p: SpawnParams): SpawnParams {
  if (p.entry === undefined && p.enter === undefined) return p;
  const rest: Record<string, unknown> = { ...p };
  delete rest.entry;
  delete rest.enter;
  return rest;
}

export class Piccolo extends WindSoldier {
  phase: Phase = 'track';
  /** Aim angle (radians, world space: 0 right, +π/2 down). */
  aimAngle = 0;
  /** End of the aim line (world). */
  aimX = 0;
  aimY = 0;
  telegraph: number = PICCOLO.aim;
  private recoverT: number = PICCOLO.reload;
  /** Startle (hop + dropped piccolo) and spare-piccolo ticks left after a gag. */
  private startleT = 0;
  private startled = false;
  /** Death slide: direction, distance left, falling, the floor he vanishes behind. */
  private slideDir = 0;
  private slideLeft = 0;
  private falling = false;
  private floorBelow = Infinity;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, placed(p), { type: 'piccolo', hp: PICCOLO.hp, w: 30, h: 10, walk: 0, gags: PICCOLO_GAGS, hatY: 10 });
    this.anchored = true;
    // The 30×10 hurtbox lies along the ledge; the physics body stays narrow (thin ledges).
    this.body = new Body({ w: 12, h: 10 });
    if (p.facing === undefined) this.facePlayer();
  }

  /** The hand that holds the piccolo (frame point), world space. */
  private handPoint(): [number, number] {
    return this.point('hand', 11, -5, hand);
  }

  /** Muzzle for an aim angle (world). */
  private muzzle(angle: number, out: [number, number]): [number, number] {
    const h = this.handPoint();
    out[0] = h[0] + Math.cos(angle) * PICCOLO.barrel;
    out[1] = h[1] + Math.sin(angle) * PICCOLO.barrel;
    return out;
  }

  /**
   * Angle from the hand to the target's chest, or null when it is outside his cone, out of
   * reach or behind cover.
   */
  private angleTo(t: Entity): number | null {
    const h = this.handPoint();
    const tx = t.x;
    const ty = t.y + t.hitbox.y * 0.5;
    const dx = tx - h[0];
    const dy = ty - h[1];
    if (Math.abs(dx) > PICCOLO.sight || Math.sign(dx) !== this.facing) return null;
    const rel = Math.atan2(dy, Math.abs(dx)) / DEG;
    if (rel < PICCOLO.coneUp || rel > PICCOLO.coneDown) return null;
    const a = Math.atan2(dy, dx);
    const mx = h[0] + Math.cos(a) * PICCOLO.barrel;
    const my = h[1] + Math.sin(a) * PICCOLO.barrel;
    if (!this.world.terrain.lineOfSight(mx, my, tx, ty)) return null;
    return a;
  }

  // ------------------------------------------------------------------------------- combat

  protected override thinkCombat(): void {
    this.vx = 0;
    if (!this.startled && this.doubleTake > 0) {
      // Woken from his gag: a startled hop, the piccolo slips off the ledge, a spare from the beret.
      this.startled = true;
      this.startleT = PICCOLO.startle + PICCOLO.spare;
      // 40 EXTRA ticks: the aim cooldown keeps running while he fumbles, so add them on top.
      this.cool += this.startleT;
      this.play('startle', once());
    }
    if (this.startleT > 0) return this.thinkStartle();
    const t = this.combatTarget();
    if (!t) return;
    this.play('idle');
    if (this.cool > 0 || !this.onScreen(-4)) return;
    const a = this.angleTo(t);
    if (a === null) return;
    const m = this.muzzle(a, muz);
    if (!this.onScreenAt(m[0], m[1])) return;
    if (!this.beginAttack()) return;
    this.phase = 'track';
    this.aimAngle = a;
    this.telegraph = this.tele(PICCOLO.aim);
    this.trackLine(t);
    this.play('aim', still(0));
    this.world.audio.sfx('enemy/piccolo-whistle');
  }

  private thinkStartle(): void {
    const t = PICCOLO.startle + PICCOLO.spare - this.startleT;
    if (t === 4) {
      // The startled hop: his piccolo slips off the ledge and falls away.
      if (this.hasAnim('dropped')) {
        const h = this.handPoint();
        tumble(this.world, this.spriteId('dropped'), h[0], h[1], this.facing * 0.8, -1.2, { life: 70, z: 29, gravity: 0.16 });
      }
      this.world.audio.sfx('enemy/double-take', { vol: 0.7 });
    }
    if (t === PICCOLO.startle) this.play('spare', once());
    this.startleT--;
  }

  protected override thinkAttack(): void {
    this.vx = 0;
    if (this.phase === 'track' || this.phase === 'lock') {
      if (this.phase === 'track') {
        // The dotted line follows the target until 12 ticks before the shot.
        const t = this.target();
        const a = t ? this.angleTo(t) : null;
        if (a !== null) this.aimAngle = a;
        if (this.modeT >= this.telegraph - PICCOLO.lock) {
          this.phase = 'lock';
          this.lockLine(t);
        } else this.trackLine(t);
      }
      this.play('aim', still(0));
      if (this.modeT < this.telegraph) return;
      // Rule 3 at the shot: the muzzle must be inside the view.
      const m = this.muzzle(this.aimAngle, muz);
      if (!this.onScreenAt(m[0], m[1])) return this.cancelAttack();
      this.fire(m[0], m[1]);
      this.phase = 'fire';
      this.modeT = 0;
      this.play('fire', once());
      return;
    }
    if (this.phase === 'fire') {
      if (this.modeT >= PICCOLO.fireTicks) {
        this.phase = 'reload';
        this.recoverT = this.recovery(PICCOLO.reload) - PICCOLO.fireTicks;
        this.modeT = 0;
        this.play('reload', looped(8));
      }
      return;
    }
    if (this.modeT >= this.recoverT) {
      this.phase = 'track';
      this.endAttack(this.fireInterval(PICCOLO.cooldown, 15));
    }
  }

  /** Line end while tracking: the target's chest. */
  private trackLine(t: Entity | null): void {
    if (t) {
      this.aimX = t.x;
      this.aimY = t.y + t.hitbox.y * 0.5;
    }
  }

  /** Lock: the line freezes along the aim, 24 px past where the target was. */
  private lockLine(t: Entity | null): void {
    const m = this.muzzle(this.aimAngle, muz);
    const d = t ? Math.hypot(t.x - m[0], t.y + t.hitbox.y * 0.5 - m[1]) + 24 : 160;
    this.aimX = m[0] + Math.cos(this.aimAngle) * d;
    this.aimY = m[1] + Math.sin(this.aimAngle) * d;
  }

  private fire(x: number, y: number): void {
    PiccoloBullet.fire(this.world, x, y, this.aimAngle, PICCOLO.bullet.speed * this.mods.enemyBulletSpeed, this);
    this.world.audio.sfx('enemy/piccolo-shot');
    this.world.particles.smoke(x, y, 1);
  }

  protected override onAttackCancelled(): void {
    this.phase = 'track';
  }

  // ------------------------------------------------------------------------------- gags

  protected override gagThink(): void {
    // Scales: a quiet little rising run of notes now and then (on screen only).
    if (this.gagName === 'scales' && this.anim.changed && this.anim.index === 1 && this.onScreen(0)) {
      this.world.audio.sfx('enemy/piccolo-whistle', { vol: 0.15, pitch: 1.2 });
    }
  }

  // ------------------------------------------------------------------------------- death

  /** The beret pops from his head (which lies ahead of his centre), not from his middle. */
  protected override hatSprite(): string {
    return '';
  }

  protected override onDied(d: Damage): void {
    this.phase = 'track';
    const w = this.world;
    const hat = this.spriteId('hat');
    if (d.kind !== 'fire' && d.kind !== 'laser' && d.kind !== 'crush' && !this.shattered && hasSprite(hat)) {
      this.point('head', 10, -6, head);
      SoldierProp.spawn(w, { sprite: hat, x: head[0], y: head[1], vx: (d.dirX || -this.facing) * 0.7, vy: -2.6, spin: 4, rest: 50, restFrame: 0, flipX: this.facing < 0 });
    }
    if ((d.kind !== 'bullet' && d.kind !== 'impact') || this.shattered) return;
    // Slide off the ledge toward its nearest edge (or off the back of a long roof).
    const t = w.terrain;
    let dir = -this.facing;
    let dist = Infinity;
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? -this.facing : this.facing;
      for (let dx = 4; dx <= PICCOLO.slideMax; dx += 2) {
        if (!Number.isFinite(t.surfaceY(this.x + s * dx, this.y - 3, this.y + 6))) {
          if (dx < dist) {
            dist = dx;
            dir = s;
          }
          break;
        }
      }
    }
    this.slideDir = dir;
    this.slideLeft = Number.isFinite(dist) ? dist + 6 : 24;
    // No edge near: he slides off the back of the roof, behind its own ledge line.
    this.floorBelow = Number.isFinite(dist) ? Infinity : this.y;
    this.falling = false;
    this.vx = 0;
    this.vy = 0;
    this.play('die', still(1));
    w.audio.sfx('machine/piano-whistle', { pitch: 1.3, vol: 0.7 });
  }

  protected override updateDying(): boolean {
    if (this.slideDir === 0) return false;
    const w = this.world;
    if (!this.falling) {
      this.x += this.slideDir * PICCOLO.slide;
      this.slideLeft -= PICCOLO.slide;
      if (this.slideLeft <= 0) {
        this.falling = true;
        this.vy = 0;
        if (this.floorBelow === Infinity) this.floorBelow = w.terrain.surfaceY(this.x, this.y + 4, Infinity);
        this.play('die', looped(5));
      }
      return true;
    }
    this.vy = Math.min(this.vy + 0.22, 5);
    this.y += this.vy;
    this.x += this.slideDir * 0.5;
    this.anim.update();
    const gone = this.y - 14 > this.floorBelow || this.y - 20 > w.camera.bottom || this.deadT > 150;
    if (gone) {
      // "Plop" — he landed somewhere out of sight.
      if (Number.isFinite(this.floorBelow) && w.camera.containsPoint(this.x, this.floorBelow, 0)) dust(w, this.x, this.floorBelow, 5);
      w.audio.sfx('weapon/grenade-bounce', { pitch: 0.55 });
      this.remove();
    }
    return true;
  }

  override draw(r: Renderer): void {
    if (this.dead && this.falling && Number.isFinite(this.floorBelow) && this.anim.id) {
      // Falling behind the floor below: only the part above its line shows.
      const f = getFrame(this.anim.id, this.anim.index);
      const rows = Math.round(this.floorBelow - this.y) + f.oy;
      if (rows <= 0) return;
      clipOpts.flipX = this.facing < 0;
      clipOpts.src = { x: 0, y: 0, w: f.buf.w, h: Math.min(f.buf.h, rows) };
      r.sprite(this.anim.id, this.anim.index, Math.round(this.x), Math.round(this.y), clipOpts);
      return;
    }
    super.draw(r);
  }

  /** The aim line (dots crawl toward the target; solid when locked), then the piccolo-rifle. */
  protected override drawExtras(r: Renderer): void {
    if (this.mode !== 'attack' || (this.phase !== 'track' && this.phase !== 'lock') || this.reacting) return;
    const m = this.muzzle(this.aimAngle, muz);
    drawAimLine(r, m[0], m[1], this.aimX, this.aimY, this.phase === 'lock', this.world.tick >> 1, AIM_RED);
    const h = this.handPoint();
    const turns = this.aimAngle / (Math.PI * 2);
    const frame = ((Math.round(turns * RIFLE_DIRS) % RIFLE_DIRS) + RIFLE_DIRS) % RIFLE_DIRS;
    rifleOpts.flash = this.flashTicks > 0;
    if (hasSprite('enemy/piccolo-rifle')) r.sprite('enemy/piccolo-rifle', frame, Math.round(h[0]), Math.round(h[1]), rifleOpts);
  }
}

defineEntity('piccolo', (w, x, y, p) => new Piccolo(w, x, y, p), {
  category: 'enemy',
  score: PICCOLO.score,
  description: 'Piccolo Sniper: lies prone on ledges; a dotted aim line that locks 12 ticks before a fast shot.',
});

// ---------------------------------------------------------------------------------------------
// Projectile
// ---------------------------------------------------------------------------------------------

const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };

/** `piccolo-bullet` — a slim brass dart along the locked aim line (16-direction strip). */
export class PiccoloBullet extends Projectile {
  constructor(world: World) {
    super(world);
  }

  static fire(world: World, x: number, y: number, angle: number, speed: number, shooter: Entity | null = null): PiccoloBullet {
    shot.x = x;
    shot.y = y;
    shot.vx = Math.cos(angle) * speed;
    shot.vy = Math.sin(angle) * speed;
    shot.damage = PICCOLO.bullet.damage;
    shot.kind = 'bullet';
    shot.life = 300;
    shot.w = 4;
    shot.h = 3;
    shot.sprite = 'enemy/piccolo-bullet';
    shot.look = 'angle';
    shot.offscreen = 32;
    shot.shooter = shooter;
    shot.type = 'piccolo-bullet';
    const p = PiccoloBullet.spawn(world, shot);
    shot.shooter = null;
    return p;
  }
}

defineEntity('piccolo-bullet', (w, x, y, p) => PiccoloBullet.fire(w, x, y - 24, paramFacing(p, -1) > 0 ? 0 : Math.PI, PICCOLO.bullet.speed), {
  category: 'projectile',
  description: 'Piccolo Sniper dart: 4 px/tick along the locked aim line.',
});
