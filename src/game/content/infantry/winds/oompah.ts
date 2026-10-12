/**
 * `oompah-trooper` — the Oompah Trooper (GDD §9.1): a heavy bandsman with a sousaphone coiled
 * around his body and a big brass bell facing forward over his head. 60 HP, 500 points.
 *
 * - Walks 0.4 px/tick and attacks from 60–200 px (roughly level with the target).
 * - **OOMPAH:** T 36 (inhales: the body puffs +2 px, `enemy/tuba-inhale`) → a `sonic-ring` leaves
 *   the bell, drops into its lane (centre 18 px above the ground) and flies 1.5 px/tick for
 *   180 px while it grows 12 → 24 px over 40 ticks (30 HP: shoot it down for 50) → R 60 (he
 *   wheezes and wipes his brow). Jump over it or shoot it.
 * - **LOW NOTE:** every third blast, same telegraph: a flat 24×8 `low-ring` rolls along the
 *   ground at 2 px/tick (jump it).
 * - **Death:** a long sad "bwaaa" — the tuba blows him backwards off his feet in a spin; blast
 *   variant: the tuba crumples around him like an accordion (art).
 * - **Gags:** `polish` (polishes the bell), `practice` (two soft notes, then hiccups), `nap`.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { jump } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { frameCount, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { musicNotes, poof } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { once, WindSoldier } from './soldier';

/** Oompah Trooper numbers (GDD §9.1; NORMAL, scaled by difficulty in code). */
export const OOMPAH = {
  hp: 60,
  score: 500,
  walk: 0.4,
  /**
   * Attacks when the target is this far away (px) and at most `attackDy` above / below his feet:
   * the rings roll in HIS lane (18 px above his floor), so a target on another level is left
   * alone (GDD silent; 24 px still catches a player on a crate).
   */
  minRange: 60,
  maxRange: 200,
  attackDy: 24,
  /** T 36 → A → R 60 (the first `blastTicks` of R show the blast pose). */
  inhale: 36,
  recover: 60,
  blastTicks: 12,
  /** Extra pause after the recovery before the next telegraph (GDD silent; jittered ±15). */
  cooldown: 40,
  /** Every third blast is a LOW NOTE. */
  lowEvery: 3,
  ring: {
    speed: 1.5,
    range: 180,
    size0: 12,
    size1: 24,
    growTicks: 40,
    /** Lane: the ring's centre this many px above the shooter's feet. */
    laneY: 18,
    /** Ticks to drop from the bell into the lane. */
    swoopTicks: 12,
    hp: 30,
    score: 50,
    damage: 10,
  },
  low: { speed: 2, w: 24, h: 8, range: 180, damage: 10, dropTicks: 10 },
} as const;

/** Gags of the type (GDD §9.1) plus the shared `nap`. */
export const OOMPAH_GAGS: readonly string[] = ['polish', 'practice', 'nap'];

type Phase = 'inhale' | 'blast' | 'wheeze';

const muzzle: [number, number] = [0, 0];

export class OompahTrooper extends WindSoldier {
  phase: Phase = 'inhale';
  /** Blasts fired (every third is a LOW NOTE). */
  blasts = 0;
  /** Telegraph and recovery lengths of the running attack. */
  telegraph: number = OOMPAH.inhale;
  private recoverT: number = OOMPAH.recover;
  private readonly prefRange: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    // Hurtbox: the stout body inside the coil (the bell over his head is not a target).
    super(world, x, y, p, { type: 'oompah-trooper', hp: OOMPAH.hp, w: 18, h: 30, crouchH: 26, walk: OOMPAH.walk, gags: OOMPAH_GAGS, hatY: 36 });
    this.prefRange = paramNum(p, 'range', world.rng.int(110, 170));
  }

  /** The bell mouth (frame point `muzzle`), world space. */
  bellPoint(out: [number, number] = muzzle): [number, number] {
    return this.point('muzzle', 9, -43, out);
  }

  private bellInView(): boolean {
    const m = this.bellPoint();
    return this.onScreenAt(m[0], m[1]);
  }

  // ------------------------------------------------------------------------------- combat

  protected override thinkCombat(): void {
    const t = this.combatTarget();
    if (!t) return;
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    const level = Math.abs(t.y - this.y) <= OOMPAH.attackDy;
    if (this.cool <= 0 && level && dist >= OOMPAH.minRange && dist <= OOMPAH.maxRange && this.body?.onGround && this.bellInView()) {
      this.facePlayer();
      if (this.beginAttack()) return this.startInhale();
    }
    // Keep inside the 60–200 px band, near his preferred range.
    let goal = this.x;
    if (dist > this.prefRange + 24) goal = t.x - Math.sign(dx) * this.prefRange;
    else if (dist < OOMPAH.minRange + 8) goal = t.x - Math.sign(dx) * (OOMPAH.minRange + 36);
    goal = this.clampToView(goal);
    const facing = this.facing;
    if (this.walkTo(goal, this.walkSpeed)) {
      // Backing off he keeps facing the player (a slow, proud moonwalk).
      if (Math.sign(goal - this.x) !== Math.sign(dx)) this.facing = facing;
      this.play('walk');
      return;
    }
    this.play('idle');
  }

  private startInhale(): void {
    this.phase = 'inhale';
    this.telegraph = this.tele(OOMPAH.inhale);
    this.play('inhale', once(0, Math.ceil(this.telegraph / 3)));
    this.world.audio.sfx('enemy/tuba-inhale');
  }

  protected override thinkAttack(): void {
    this.vx = 0;
    if (this.phase === 'inhale') {
      if (this.modeT < this.telegraph) return;
      // The view may have scrolled during the telegraph: never fire from outside it (rule 3).
      if (!this.bellInView()) return this.cancelAttack();
      this.blast();
      this.phase = 'blast';
      this.recoverT = this.recovery(OOMPAH.recover);
      this.modeT = 0;
      this.play('blast', once());
      return;
    }
    if (this.phase === 'blast') {
      if (this.modeT >= OOMPAH.blastTicks) {
        this.phase = 'wheeze';
        this.play('wheeze');
      }
      return;
    }
    if (this.modeT >= this.recoverT) {
      this.phase = 'inhale';
      this.endAttack(this.fireInterval(OOMPAH.cooldown, 15));
    }
  }

  /** OOMPAH: a sonic ring, or every third time the LOW NOTE. */
  private blast(): void {
    this.blasts++;
    const m = this.bellPoint();
    const low = this.blasts % OOMPAH.lowEvery === 0;
    const speed = (low ? OOMPAH.low.speed : OOMPAH.ring.speed) * this.mods.enemyBulletSpeed;
    if (low) LowRing.fire(this.world, m[0], m[1], this.facing * speed, this.y, this);
    else SonicRing.fire(this.world, m[0], m[1], this.facing * speed, this.y - OOMPAH.ring.laneY, this);
    this.world.audio.sfx('enemy/tuba-blast', { pitch: low ? 0.8 : 1 });
  }

  protected override onAttackCancelled(): void {
    this.phase = 'inhale';
  }

  // ------------------------------------------------------------------------------- gags

  protected override gagThink(): void {
    if (!this.anim.changed || !this.onScreen(0)) return;
    const i = this.anim.index;
    if (this.gagName === 'practice') {
      // Two soft notes, then a hiccup.
      if (i === 1 || i === 2) this.world.audio.sfx('enemy/tuba-blast', { vol: 0.22, pitch: i === 1 ? 1.25 : 1.5 });
      else if (i === 4) this.world.audio.sfx('enemy/alert', { vol: 0.35, pitch: 1.6 });
    } else if (this.gagName === 'polish' && i === 3) {
      this.world.audio.sfx('item/gem', { vol: 0.25, pitch: 1.5 });
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDied(d: Damage): void {
    this.phase = 'inhale';
    if (d.kind === 'bullet' || d.kind === 'impact' || d.kind === 'laser') {
      // The tuba gives a long sad "bwaaa" and blows him backwards off his feet in a spin.
      if (d.kind !== 'laser') {
        this.vx = -this.facing * 1.1;
        jump(this, -2.2);
      }
    }
    if (d.kind !== 'knife') this.world.audio.sfx('enemy/tuba-blast', { pitch: d.kind === 'explosion' ? 0.5 : 0.62, vol: 0.9 });
  }

  // ------------------------------------------------------------------------------- drawing

  protected override drawExtras(r: Renderer): void {
    // The telegraph: a gold shimmer every 8 ticks while he inhales.
    if (this.mode === 'attack' && this.phase === 'inhale' && this.modeT % 8 < 4) this.drawTint(r, PAL.gold[3], 0.3);
  }
}

defineEntity('oompah-trooper', (w, x, y, p) => new OompahTrooper(w, x, y, p), {
  category: 'enemy',
  score: OOMPAH.score,
  description: 'Oompah Trooper: heavy sousaphone soldier; sonic rings (shoot them down) and a rolling LOW NOTE.',
});

// ---------------------------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------------------------

const ringOpts: DrawOpts = {};

/** Shared spawn options (filled per shot; Projectile.init copies what it needs). */
const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };
const SONIC: readonly string[] = ['sonic'];

/** Smooth step-out (fast first, settling into the lane). */
function easeOut(k: number): number {
  return 1 - (1 - k) * (1 - k);
}

/**
 * `sonic-ring` — leaves the bell, drops into its lane (centre 18 px above the ground) in 12
 * ticks, flies 1.5 px/tick and grows 12 → 24 px over 40 ticks; gone after 180 px. 30 HP (50
 * points when shot down), erasable, `bullet` + `sonic` (½ vehicle cell).
 */
export class SonicRing extends Projectile {
  /** Current diameter (px). */
  size: number = OOMPAH.ring.size0;
  private startY = 0;
  private laneY = 0;
  private travelled = 0;

  constructor(world: World) {
    super(world);
  }

  /** Fire from the bell (x, y) at `vx`; `laneY` = the ring's centre height in its lane. */
  static fire(world: World, x: number, y: number, vx: number, laneY: number, shooter: Entity | null = null): SonicRing {
    const R = OOMPAH.ring;
    shot.x = x;
    shot.y = y;
    shot.vx = vx;
    shot.vy = 0;
    shot.damage = R.damage;
    shot.kind = 'bullet';
    shot.tags = SONIC;
    shot.life = 600;
    shot.w = Math.round(R.size0 * 0.5);
    shot.h = R.size0;
    shot.sprite = 'enemy/sonic-ring';
    shot.look = 'anim';
    shot.impact = 'none';
    shot.shootable = true;
    shot.hp = R.hp;
    shot.score = R.score;
    shot.offscreen = 32;
    shot.shooter = shooter;
    shot.type = 'sonic-ring';
    const p = SonicRing.spawn(world, shot);
    shot.shooter = null;
    p.startY = y;
    p.laneY = laneY;
    p.travelled = 0;
    p.size = R.size0;
    return p;
  }

  override update(): void {
    const R = OOMPAH.ring;
    this.t++;
    this.x += this.vx;
    this.travelled += Math.abs(this.vx);
    const k = Math.min(1, this.t / R.swoopTicks);
    this.y = this.startY + (this.laneY - this.startY) * easeOut(k);
    this.size = R.size0 + (R.size1 - R.size0) * Math.min(1, this.t / R.growTicks);
    // The hitbox grows with the ring (centred on the anchor).
    const h = Math.round(this.size);
    const w = Math.round(this.size * 0.5);
    this.hitbox.x = -w / 2;
    this.hitbox.y = -h / 2;
    this.hitbox.w = w;
    this.hitbox.h = h;
    if (this.travelled >= R.range) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** Range spent: it fades out with a puff. */
  override expire(): void {
    if (!this.removed) poof(this.world, this.x, this.y);
    this.remove();
  }

  /** Shot down: it bursts into notes (the base pays the 50 points). */
  override die(d?: Damage): void {
    if (this.dead) return;
    musicNotes(this.world, this.x, this.y, 2, 6, 36);
    super.die(d);
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    poof(this.world, x, y);
    super.onImpact(target, x, y);
  }

  override draw(r: Renderer): void {
    if (!hasSprite(this.sprite)) return;
    const R = OOMPAH.ring;
    const steps = Math.max(1, frameCount(this.sprite) >> 1);
    const step = Math.round(((this.size - R.size0) / (R.size1 - R.size0)) * (steps - 1));
    ringOpts.flipX = this.vx < 0;
    r.sprite(this.sprite, step * 2 + ((this.t >> 2) & 1), Math.round(this.x), Math.round(this.y), ringOpts);
  }
}

/**
 * `low-ring` — the LOW NOTE: a flat 24×8 ring that drops from the bell to the floor and rolls
 * along it at 2 px/tick (follows slopes, stops at steps and walls, falls into pits); gone after
 * 180 px. Not shootable (jump it); erasable; `bullet` + `sonic`.
 */
export class LowRing extends Projectile {
  private travelled = 0;
  private floorY = 0;
  private startY = 0;
  private rolling = false;

  constructor(world: World) {
    super(world);
  }

  /** Fire from the bell (x, y) at `vx`; it lands on the floor near `floorY`. */
  static fire(world: World, x: number, y: number, vx: number, floorY: number, shooter: Entity | null = null): LowRing {
    const L = OOMPAH.low;
    shot.x = x;
    shot.y = y;
    shot.vx = vx;
    shot.vy = 0;
    shot.damage = L.damage;
    shot.kind = 'bullet';
    shot.tags = SONIC;
    shot.life = 600;
    shot.w = L.w - 4;
    shot.h = L.h;
    shot.sprite = 'enemy/low-ring';
    shot.look = 'anim';
    shot.impact = 'none';
    shot.shootable = false;
    shot.hp = 1;
    shot.score = 0;
    shot.offscreen = 32;
    shot.shooter = shooter;
    shot.type = 'low-ring';
    const p = LowRing.spawn(world, shot);
    shot.shooter = null;
    p.travelled = 0;
    p.startY = y;
    p.floorY = floorY;
    p.rolling = false;
    return p;
  }

  override update(): void {
    const L = OOMPAH.low;
    const half = L.h / 2;
    this.t++;
    this.x += this.vx;
    this.travelled += Math.abs(this.vx);
    if (!this.rolling) {
      // Drops from the bell to the floor.
      const k = Math.min(1, this.t / L.dropTicks);
      this.y = this.startY + (this.floorY - half - this.startY) * k * k;
      if (k >= 1) this.rolling = true;
    } else {
      const feet = this.y + half;
      const s = this.world.terrain.surfaceY(this.x, feet - 6, feet + 12);
      if (Number.isFinite(s)) {
        this.y = s - half;
        this.vy = 0;
      } else {
        // Over a pit: it falls in.
        this.vy = Math.min(this.vy + 0.25, 4);
        this.y += this.vy;
      }
    }
    if (this.travelled >= L.range) return this.expire();
    if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  override expire(): void {
    if (!this.removed) poof(this.world, this.x, this.y);
    this.remove();
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    poof(this.world, x, y);
    super.onImpact(target, x, y);
  }
}

// Projectile entities (GDD §15.4): spawned by a script they fly toward `facing` from (x, y) on
// the floor line, like the trooper's own shots.
defineEntity('sonic-ring', (w, x, y, p) => SonicRing.fire(w, x, y - 30, paramFacing(p, -1) * OOMPAH.ring.speed, y - OOMPAH.ring.laneY), {
  category: 'projectile',
  description: 'Oompah sonic ring: grows 12 → 24 px, 1.5 px/tick, 180 px; 30 HP (50 points when shot down).',
});
defineEntity('low-ring', (w, x, y, p) => LowRing.fire(w, x, y - 30, paramFacing(p, -1) * OOMPAH.low.speed, y), {
  category: 'projectile',
  description: 'Oompah LOW NOTE: a flat 24×8 ring rolling along the ground at 2 px/tick (jump it).',
});
