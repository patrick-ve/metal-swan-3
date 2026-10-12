/**
 * `gramophone-mortar` — the Gramophone Mortar (GDD §9.2) and its `record`.
 *
 * A wooden box with a brass flower horn, placed on the ground, a ledge or a roof (it settles onto
 * the floor right under its spawn point). Every 150 ticks (the rest ×1.3 / ×1 / ×0.8 by
 * difficulty): T 50 — the horn swivels to aim for 30 ticks, then the needle drops with a scratch
 * for 20 (`machine/scratch`) — then it lobs a spinning vinyl record (12 px) in an arc that lands at
 * the player's x (vx ≤ 3, vy −3.5, gravity 0.15; on HARD the same arc, flown faster). On landing
 * the record rolls at 1.5 px/tick for 96 px (6 px tall: jump it) and shatters; it breaks on walls.
 * A record has 10 HP (50 points) and is knifeable. Death: the horn falls off and spins like a top
 * while the box winds down through a slowed-down tune for 60 ticks; the broken box stays.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { sweep } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { makeRayHit } from '../../../../engine/terrain';
import type { World } from '../../../../engine/world';
import { FxEntity, FX_SMOKE } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, type SpawnParams } from '../../../registry';
import { MORTAR, mortarMuzzle } from './geom';
import { Machine } from './machine';

/** Gramophone Mortar numbers (GDD §9.2; NORMAL). */
export const GRAMOPHONE = {
  hp: 240,
  /** Launch to launch; the telegraph is part of it (T 50 = aim 30 + needle drop 20). */
  cycle: 150,
  tell: 50,
  aim: 30,
  recordVy: -3.5,
  recordGravity: 0.15,
  maxVx: 3,
  rollSpeed: 1.5,
  rollDist: 96,
  recordHp: 10,
  recordScore: 50,
  recordDamage: 10,
  /** Death: the slowed-down tune. */
  windDown: 60,
} as const;

type MortarMode = 'wait' | 'aim' | 'scratch';

const ART = 'machine/gramophone-mortar';
const drawOpts: DrawOpts = {};
const muzzle: [number, number] = [0, 0];
const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };
const rayHit = makeRayHit();

/** A lob solution: launch velocity, gravity and the horn frame that matches it. */
interface Lob {
  vx: number;
  vy: number;
  g: number;
  frame: number;
}
const lob: Lob = { vx: 0, vy: 0, g: 0, frame: 2 };

export class GramophoneMortar extends Machine {
  mode: MortarMode = 'wait';
  modeT = 0;
  /** Horn elevation as a (fractional) frame of the `horn` strip: 0 = 45° … 4 = 85°. */
  horn = 2;
  private hornGoal = 2;
  private cool: number;
  private aimLen: number = GRAMOPHONE.aim;
  private scratchLen: number = GRAMOPHONE.tell - GRAMOPHONE.aim;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: GRAMOPHONE.hp, w: 34, h: 36, body: false });
    this.hitbox = { ...MORTAR.bounds };
    // Settle onto the floor right under the spawn point (ground, ledge or roof).
    const floor = world.terrain.surfaceY(x, y - 4, y + 40);
    if (Number.isFinite(floor)) this.y = this.prevY = floor;
    const t = world.nearestPlayer(x, y);
    this.facing = paramFacing(p, t ? (t.x < x ? -1 : 1) : -1);
    this.cool = world.rng.int(40, 90);
  }

  private setMode(m: MortarMode): void {
    this.mode = m;
    this.modeT = 0;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    if (!this.checkActive()) return;
    this.modeT++;
    // The horn eases toward its goal (one frame per 6 ticks).
    if (this.horn !== this.hornGoal) {
      const step = 1 / 6;
      this.horn = Math.abs(this.hornGoal - this.horn) <= step ? this.hornGoal : this.horn + Math.sign(this.hornGoal - this.horn) * step;
    }
    const t = this.target();
    switch (this.mode) {
      case 'wait': {
        if (this.cool > 0) this.cool--;
        if (this.cool > 0 || !t || !this.onScreen(-8)) return;
        if (!this.takeToken()) {
          this.cool = this.world.rng.int(10, 20);
          return;
        }
        // T 50 split as the GDD does: 30 aiming, 20 needle drop.
        const T = this.tele(GRAMOPHONE.tell);
        this.aimLen = Math.round((T * GRAMOPHONE.aim) / GRAMOPHONE.tell);
        this.scratchLen = T - this.aimLen;
        this.setMode('aim');
        this.world.audio.sfx('machine/scratch', { vol: 0.35, pitch: 0.6 });
        return;
      }
      case 'aim': {
        if (t) {
          if (Math.abs(t.x - this.x) > 4) this.facing = t.x < this.x ? -1 : 1;
          this.hornGoal = this.solve(t).frame;
        }
        if (this.modeT >= this.aimLen) {
          this.setMode('scratch');
          this.world.audio.sfx('machine/scratch');
        }
        return;
      }
      case 'scratch': {
        if (this.modeT < this.scratchLen) return;
        this.launch(t);
        this.releaseToken();
        this.cool = this.recover(GRAMOPHONE.cycle - GRAMOPHONE.tell);
        this.setMode('wait');
        return;
      }
    }
  }

  /**
   * The lob that lands at the target's x: vy −3.5 and gravity 0.15 (× speed, × speed² on HARD:
   * the same arc, flown faster), vx from the flight time to the floor under the target, ≤ 3.
   */
  private solve(t: Entity): Lob {
    const s = this.mods.enemyBulletSpeed;
    const vy = GRAMOPHONE.recordVy * s;
    const g = GRAMOPHONE.recordGravity * s * s;
    const m = this.muzzleAt(Math.round(this.horn), muzzle);
    const floor = this.world.terrain.surfaceY(t.x, t.y - 24, t.y + 96);
    const ty = Number.isFinite(floor) ? floor : t.y;
    // y(τ) = my + vy·τ + g·τ²/2 = ty  →  τ = (−vy + √(vy² + 2·g·(ty − my))) / g
    const disc = vy * vy + 2 * g * (ty - m[1]);
    const tau = disc > 0 ? (-vy + Math.sqrt(disc)) / g : -vy / g;
    const max = GRAMOPHONE.maxVx * s;
    lob.vx = Math.max(-max, Math.min(max, (t.x - m[0]) / Math.max(1, tau)));
    lob.vy = vy;
    lob.g = g;
    // The horn shows the launch elevation (45° … 85°).
    const deg = (Math.atan2(-vy, Math.abs(lob.vx)) * 180) / Math.PI;
    let best = 0;
    for (let i = 1; i < MORTAR.angles.length; i++) if (Math.abs(MORTAR.angles[i] - deg) < Math.abs(MORTAR.angles[best] - deg)) best = i;
    lob.frame = best;
    return lob;
  }

  /** Horn mouth (world) for a horn frame. */
  private muzzleAt(frame: number, out: [number, number]): [number, number] {
    mortarMuzzle(frame, out);
    out[0] = this.x + out[0] * this.facing;
    out[1] = this.y + out[1];
    return out;
  }

  private launch(t: Entity | null): void {
    if (!t) return;
    const l = this.solve(t);
    this.horn = this.hornGoal = l.frame;
    const m = this.muzzleAt(l.frame, muzzle);
    // GDD §4.11 rule 3: never from outside the view.
    if (!this.inView(m[0], m[1])) return;
    const o = shot;
    o.x = m[0];
    o.y = m[1];
    o.vx = l.vx;
    o.vy = l.vy;
    o.gravity = l.g;
    o.damage = GRAMOPHONE.recordDamage;
    o.kind = 'bullet';
    o.sprite = `${ART}/record`;
    o.look = 'anim';
    o.ticksPerFrame = 3;
    o.w = 10;
    o.h = 8;
    o.life = 600;
    o.offscreen = 64;
    o.impact = 'none';
    o.hitsTerrain = false;
    o.shootable = true;
    o.soft = true;
    o.hp = GRAMOPHONE.recordHp;
    o.score = GRAMOPHONE.recordScore;
    o.shooter = this;
    o.type = 'record';
    VinylRecord.spawn(this.world, o);
    o.shooter = null;
    this.world.audio.sfx('enemy/tuba-blast', { vol: 0.5, pitch: 1.6 });
    this.world.particles.burst(FX_SMOKE, m[0], m[1], 3, 0.2, 0.8, -Math.PI / 2, 1.4);
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    if (this.mode !== 'wait') {
      this.setMode('wait');
      this.cool = Math.max(this.cool, this.world.rng.int(20, 40));
    }
  }

  override hurtboxes(): readonly Rect[] {
    this.rel(MORTAR.hurt, this.boxes[0]);
    return this.boxes;
  }

  override update(): void {
    super.update();
    if (this.alive) this.emitDamage(this.x, this.y - 14);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    this.releaseToken();
    this.boom(this.x, this.y - 12, 'm', 'wood');
    // The horn falls off and spins like a top beside the box.
    FxEntity.spawn(this.world, {
      sprite: `${ART}/horn-top`,
      x: this.wx(-6),
      y: this.y - 26,
      vx: -this.facing * 0.5,
      vy: -2.2,
      gravity: 0.2,
      drag: 0.99,
      loop: true,
      life: 70,
      ticksPerFrame: 3,
      z: 31,
    });
    // "The box plays a slowed-down tune for 60 ticks."
    this.world.audio.sfx('machine/sad-notes', { pitch: 0.6 });
  }

  protected override updateDeath(): void {
    this.deathTicks++;
    if (this.deathTicks < 200 && this.deathTicks % 9 === 0) this.world.particles.emit(FX_SMOKE, this.x + this.world.fxRng.range(-8, 8), this.y - 16, 0, -0.35);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    if (this.dead) {
      // The record still turns for the slowed-down tune, then stops.
      r.sprite(`${ART}/wreck`, this.deathTicks < GRAMOPHONE.windDown ? (this.deathTicks >> 3) % 2 : 0, x, y, drawOpts);
      return;
    }
    drawOpts.flash = this.flashTicks > 0;
    // Body frames: 0 tonearm up, 1–2 needle down (the record wobbles: the scratch).
    const f = this.mode === 'scratch' ? 1 + ((this.modeT >> 2) % 2) : 0;
    r.sprite(`${ART}/body`, f, x, y, drawOpts);
    // GDD §9.2: a dented plate from 50 % HP.
    if (this.damageState > 0) r.sprite(`${ART}/dent`, 0, x, y, drawOpts);
    // The horn shakes a little while it swivels.
    const shake = this.mode === 'aim' && this.horn !== this.hornGoal ? ((this.modeT >> 1) % 2) : 0;
    r.sprite(`${ART}/horn`, Math.round(this.horn), x, y - shake, drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Record: flies, lands, rolls 96 px along the floor and shatters (10 HP, knifeable, 50 points)
// ---------------------------------------------------------------------------------------------

/** Half the height of a rolling record (it rolls with its centre this far above the floor). */
const ROLL_HALF = 3;

export class VinylRecord extends Projectile {
  rolling = false;
  /** px rolled so far. */
  rolled = 0;
  private dir: 1 | -1 = 1;
  private rollV = 0;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    // The record handles floors and walls itself (it lands and rolls).
    this.hitsTerrain = false;
    this.rolling = false;
    this.rolled = 0;
    this.dir = o.vx < 0 ? -1 : 1;
    this.rollV = GRAMOPHONE.rollSpeed * (Math.abs(o.vy) / Math.abs(GRAMOPHONE.recordVy) || 1);
  }

  override update(): void {
    this.t++;
    if (this.rolling) this.roll();
    else this.fly();
    if (this.removed) return;
    if (this.t >= this.life) this.expire();
    else if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** Ballistic flight; floors (and one-way platforms) catch it, walls and ceilings break it. */
  private fly(): void {
    this.vy = Math.min(this.vy + this.gravity, 6);
    const x1 = this.x + this.vx;
    const y1 = this.y + this.vy;
    const h = sweep(this.world.terrain, this.x, this.y + ROLL_HALF, x1, y1 + ROLL_HALF, this.vy > 0, this.world, rayHit);
    if (!h) {
      this.x = x1;
      this.y = y1;
      return;
    }
    this.x = h.x;
    // On a floor it sits exactly on the surface (as it will while rolling).
    this.y = h.y - ROLL_HALF - (h.ny < -0.3 ? 0 : 0.5);
    if (h.ny < -0.3) this.land();
    else this.shatter();
  }

  private land(): void {
    this.rolling = true;
    this.vy = 0;
    this.vx = this.dir * this.rollV;
    this.hitbox.x = -5;
    this.hitbox.y = -ROLL_HALF;
    this.hitbox.w = 10;
    this.hitbox.h = ROLL_HALF * 2;
    this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: 1.8 });
  }

  /** Roll along the floor (slopes too); off a ledge it falls again; into a wall it breaks. */
  private roll(): void {
    const t = this.world.terrain;
    const nx = this.x + this.vx;
    const feet = this.y + ROLL_HALF;
    if (t.isSolid(nx + this.dir * 5, feet - ROLL_HALF)) {
      this.shatter();
      return;
    }
    const floor = t.surfaceY(nx, feet - 6, feet + 6);
    this.x = nx;
    this.rolled += Math.abs(this.vx);
    if (!Number.isFinite(floor)) {
      this.rolling = false;
      this.vy = 0;
    } else this.y = floor - ROLL_HALF;
    if (this.rolled >= GRAMOPHONE.rollDist) this.shatter();
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.shards(x, y);
  }

  /** Shot down, knifed, or out of time: it shatters. */
  override expire(): void {
    this.shatter();
  }

  private shatter(): void {
    if (this.removed) return;
    this.shards(this.x, this.y);
    this.remove();
  }

  private shards(x: number, y: number): void {
    this.world.particles.debris(x, y, 6, RECORD_SHARDS);
    this.world.audio.sfx('hit/metal', { vol: 0.5, pitch: 1.5 });
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.dir < 0;
    drawOpts.flash = false;
    if (this.rolling) r.sprite(`${ART}/record-roll`, this.t >> 2, Math.round(this.x), Math.round(this.y), drawOpts);
    else r.sprite(`${ART}/record`, this.t >> 2, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

/** Vinyl shards: black, dark grey and a speck of the crimson label. */
const RECORD_SHARDS = [0x221a28ff, 0x3d2e3cff, 0xc62f30ff];

defineEntity('gramophone-mortar', (w, x, y, p) => new GramophoneMortar(w, x, y, p), {
  category: 'enemy',
  score: 1200,
  description: 'Gramophone Mortar: aims its horn, scratches, lobs a record that rolls along the floor.',
});
defineEntity(
  'record',
  (w, x, y, p) =>
    VinylRecord.spawn(w, {
      team: 'enemy', x, y: y - 40, vx: paramFacing(p, -1) * 1.5, vy: GRAMOPHONE.recordVy, gravity: GRAMOPHONE.recordGravity,
      damage: GRAMOPHONE.recordDamage, sprite: `${ART}/record`, look: 'anim', w: 10, h: 8, life: 600, offscreen: 64, impact: 'none',
      shootable: true, soft: true, hp: GRAMOPHONE.recordHp, score: GRAMOPHONE.recordScore, type: 'record',
    }),
  { category: 'projectile', description: 'Gramophone record: lobbed, then rolls 96 px (10 HP, knifeable).' },
);
