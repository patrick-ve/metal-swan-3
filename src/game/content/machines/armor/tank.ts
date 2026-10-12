/**
 * `oompah-tank` — the Oompah Tank (GDD §9.2), its `bell-shell` and bass pulse, and the
 * `tank-crewman` who escapes from its hatch.
 *
 * - Drives in to `params.stopX` (1.0 px/tick; GDD silent) with spawn armour: shots ping off
 *   until it stops or for 240 ticks. While it drives in, after 18 ticks in view, it runs over
 *   what it touches (a moving enemy vehicle, GDD §4.11 rule 5). Without `stopX` it starts in place.
 * - Then 0.4 px/tick, keeping 160–240 px from the nearest player (backing off never takes it
 *   out of the view); `params.maxX` (and `minX`) leash it. It never rolls into a pit, a hazard or
 *   off its floor. A player 40 px behind its centre makes it turn around in 40 ticks.
 * - Bell shell: T 45 (the bell glows and puffs, `enemy/tuba-inhale`) → an arcing shell
 *   (vx 2.2 × facing, vy −2.5, gravity 0.12, the same arc at every difficulty, flown faster on
 *   HARD) that bursts r 18 → R 80. Launched from the bell mouth (36 px ahead, 33 px up), the
 *   shell lands ≈ 150 px ahead: it guards the near edge of the 160–240 px band.
 * - Bass pulse (a player within 64 px): T 24 (the hull rumbles, dust, `machine/tank-charge`) → a
 *   ground wave 10 px tall runs 48 px out of each side of the hull (jump it) → R 40.
 * - The hull top is a one-way platform. Hurtboxes: hull 64×28 + turret 24×14 (one HP pool, 500).
 * - Death: the bell flips up and droops through three sad notes (`machine/sad-notes`), the
 *   crewman hops out, the tank blows up (harmless) and a smoking wreck stays as a solid block
 *   56×20 for 600 ticks (cover and a step).
 *
 * `tank-crewman`: infantry rig, 10 HP, no attacks; hops out (`entry: 'hatch'`) and scurries away
 * in the panic pose; 100 points if shot (knife ×5).
 */
import type { Damage } from '../../../../engine/entity';
import type { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, knifeComboStep } from '../../../enemy';
import { dust, explosion, FX_DUST, FX_SMOKE, FX_EMBER } from '../../../fx';
import { Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, paramFacing, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { TANK } from './geom';
import { Machine } from './machine';

/** Oompah Tank numbers (GDD §9.2; NORMAL; the code scales them by difficulty). */
export const OOMPAH_TANK = {
  hp: 500,
  /** Drive-in speed (GDD silent) and the combat crawl. */
  driveSpeed: 1.0,
  speed: 0.4,
  /** Preferred distance band to the nearest player. */
  near: 160,
  far: 240,
  /** Spawn armour lasts until stopX, or this long. */
  armourTicks: 240,
  turnTicks: 40,
  /** A player this far behind the tank's centre makes it turn around. */
  turnBehind: 40,
  shellTell: 45,
  shellRecover: 80,
  shellVx: 2.2,
  shellVy: -2.5,
  shellGravity: 0.12,
  shellRadius: 18,
  pulseRange: 64,
  pulseTell: 24,
  pulseRecover: 40,
  pulseReach: 48,
  pulseHeight: 10,
  /** Speed of the bass wave (GDD silent: 48 px in 16 ticks). */
  pulseSpeed: 3,
  /** Ticks between the end of a recovery and the next attack choice (GDD silent). */
  gap: 24,
  /** Death: the crewman hops out, then the blast; the wreck stays this long. */
  crewAt: 54,
  boomAt: 72,
  wreckTicks: 600,
} as const;

type TankMode = 'drive' | 'fight' | 'shell' | 'pulse' | 'recover' | 'turn';

const ART = 'machine/oompah-tank';
const drawOpts: DrawOpts = {};
const glowOpts: DrawOpts = { blend: 'add', alpha: 0.6 };
const tmp: Rect = { x: 0, y: 0, w: 0, h: 0 };
const pt: [number, number] = [0, 0];
/** Reused projectile options (Projectile.init copies what it needs). */
const shot: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };
const CONTACT: Damage = { amount: 10, kind: 'impact', dirX: 0 };
const BAD_HAZARDS: ReadonlySet<string> = new Set(['pit', 'water', 'kill', 'lava', 'spikes']);

export class OompahTank extends Machine {
  mode: TankMode;
  modeT = 0;
  /** Drive-in target (NaN = placed: no drive-in, no spawn armour). */
  readonly stopX: number;
  /** Leash: it never moves right of maxX (left of minX). */
  readonly maxX: number;
  readonly minX: number;
  /** Ticks until the next attack choice. */
  cool: number;
  /** Ticks since death (the sad notes, the blast, the wreck). */
  deathT = 0;
  /** The wreck is standing (after the blast). */
  wrecked = false;
  private telegraph = 0;
  private recoverTicks = 0;
  /** Ticks since the last shell (turret recoil frames). */
  private fireT = 99;
  /** Ticks the hull has been in view while driving in (contact needs 18). */
  private visibleT = 0;
  /** Tread animation phase (px driven, signed along the facing). */
  private tread = 0;
  private deck: SolidBox | null = null;
  private wreck: SolidBox | null = null;
  private readonly boxes: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly hullBox: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly noBoxes: Rect[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: OOMPAH_TANK.hp, w: TANK.bodyW, h: TANK.bodyH });
    this.hitbox = { ...TANK.bounds };
    this.despawnMargin = 128;
    // Face the side it enters from, else the nearest player.
    const t = world.nearestPlayer(x, y);
    const side = p.enter === 'left' ? 1 : p.enter === 'right' ? -1 : t ? (t.x < x ? -1 : 1) : -1;
    this.facing = paramFacing(p, side);
    this.maxX = paramNum(p, 'maxX', Infinity);
    this.minX = paramNum(p, 'minX', -Infinity);
    const stop = paramNum(p, 'stopX', NaN);
    this.stopX = Number.isFinite(stop) ? Math.max(this.minX, Math.min(this.maxX, stop)) : NaN;
    if (Number.isFinite(this.stopX)) {
      this.mode = 'drive';
      this.armored = true;
    } else this.mode = 'fight';
    this.cool = world.rng.int(30, 60);
    // The hull-top deck exists from the start, so a player placed on the tank lands on it
    // (World.cleanup drops every solid this tank owns when it is removed).
    const d = this.rel(TANK.deck, tmp);
    this.deck = world.addSolid(new SolidBox(d.x, d.y, d.w, d.h, true, this));
  }

  // ------------------------------------------------------------------------------- frame

  override update(): void {
    super.update();
    if (this.removed) return;
    this.syncBoxes();
    this.cosmetics();
  }

  /** Keep the hull-top platform and the wreck block on the tank (carrying riders). */
  private syncBoxes(): void {
    if (this.deck) this.follow(this.deck, TANK.deck);
    if (this.wreck) this.follow(this.wreck, TANK.wreck);
  }

  private follow(box: SolidBox, rel: Rect): void {
    const r = this.rel(rel, tmp);
    const dx = r.x - box.x;
    const dy = r.y - box.y;
    if (dx !== 0 || dy !== 0) this.world.moveSolid(box, dx, dy);
  }

  private setMode(m: TankMode): void {
    this.mode = m;
    this.modeT = 0;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.cool > 0) this.cool--;
    if (this.fireT < 99) this.fireT++;
    this.checkActive();
    switch (this.mode) {
      case 'drive':
        return this.thinkDrive();
      case 'fight':
        return this.thinkFight();
      case 'shell':
        return this.thinkShell();
      case 'pulse':
        return this.thinkPulse();
      case 'recover':
        return this.thinkRecover();
      case 'turn':
        return this.thinkTurn();
    }
  }

  /** Drive in to stopX (armoured; runs over what it touches once it has been in view 18 ticks). */
  private thinkDrive(): void {
    if (this.modeT > OOMPAH_TANK.armourTicks) this.armored = false;
    const left = this.stopX - this.x;
    const dir = Math.sign(left);
    if (Math.abs(left) < 0.5 || this.modeT > 900 || !this.canRoll(dir)) {
      this.arrive();
      return;
    }
    this.vx = dir * Math.min(OOMPAH_TANK.driveSpeed, Math.abs(left));
    this.visibleT = this.onScreen(0) ? this.visibleT + 1 : 0;
    // A moving enemy vehicle runs over players (GDD §4.11 rule 5) — only once it has been seen.
    this.contactDamage = this.visibleT >= 18 ? CONTACT : null;
  }

  private arrive(): void {
    this.vx = 0;
    this.armored = false;
    this.contactDamage = null;
    this.setMode('fight');
    this.cool = Math.max(this.cool, this.world.rng.int(20, 40));
    if (this.onScreen(0)) {
      dust(this.world, this.x - 28, this.y, 3);
      dust(this.world, this.x + 28, this.y, 3);
      this.world.audio.sfx('machine/brake', { vol: 0.5 });
    }
  }

  private thinkFight(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      return;
    }
    const dx = t.x - this.x;
    const ahead = dx * this.facing;
    const onScreen = this.onScreen(-8);
    if (onScreen && ahead < -OOMPAH_TANK.turnBehind) return this.startTurn();
    if (onScreen && this.cool <= 0) {
      const close = Math.abs(dx) <= OOMPAH_TANK.pulseRange && Math.abs(t.y - this.y) <= 48;
      if (close || (ahead > 0 && this.muzzleInView())) {
        if (this.takeToken()) return close ? this.startPulse() : this.startShell();
        this.cool = this.world.rng.int(10, 20);
      }
    }
    // Keep 160–240 px from the nearest player.
    const dist = Math.abs(dx);
    let dir = 0;
    if (dist < OOMPAH_TANK.near) dir = dx > 0 ? -1 : dx < 0 ? 1 : -this.facing;
    else if (dist > OOMPAH_TANK.far) dir = Math.sign(dx);
    // Backing off never leaves the view (a locked arena keeps its tank).
    if (dir !== 0 && onScreen && dir !== Math.sign(dx)) {
      const cam = this.world.camera;
      const edge = dir > 0 ? cam.right - 36 : cam.left + 36;
      if ((edge - this.x) * dir <= 0) dir = 0;
    }
    this.vx = dir !== 0 && this.canRoll(dir) ? this.clampLeash(dir * OOMPAH_TANK.speed) : 0;
  }

  /** Never move past the leash (maxX / minX). */
  private clampLeash(vx: number): number {
    if (vx > 0) return Math.max(0, Math.min(vx, this.maxX - this.x));
    if (vx < 0) return Math.min(0, Math.max(vx, this.minX - this.x));
    return 0;
  }

  /** Room to roll that way: inside the leash, a floor ahead, no pit, water or kill zone. */
  private canRoll(dir: number): boolean {
    if (dir === 0) return false;
    if (dir > 0 && this.x >= this.maxX - 0.01) return false;
    if (dir < 0 && this.x <= this.minX + 0.01) return false;
    const t = this.world.terrain;
    const fx = this.x + dir * (TANK.bodyW / 2 + 4);
    if (!Number.isFinite(t.surfaceY(fx, this.y - 12, this.y + 16))) return false;
    tmp.x = fx - 2;
    tmp.y = this.y - 6;
    tmp.w = 4;
    tmp.h = 10;
    const h = t.hazardAt(tmp);
    return !(h && BAD_HAZARDS.has(h.kind));
  }

  private muzzle(out: [number, number]): [number, number] {
    out[0] = this.wx(TANK.muzzle[0]);
    out[1] = this.y + TANK.muzzle[1];
    return out;
  }

  /** GDD §4.11 rule 3: the bell must be inside the view (8 px margin). */
  private muzzleInView(): boolean {
    const m = this.muzzle(pt);
    return this.inView(m[0], m[1]);
  }

  // ---- bell shell

  private startShell(): void {
    this.vx = 0;
    this.telegraph = this.tele(OOMPAH_TANK.shellTell);
    this.setMode('shell');
    this.world.audio.sfx('enemy/tuba-inhale');
  }

  private thinkShell(): void {
    this.vx = 0;
    if (this.modeT % 10 === 5) {
      // The bell puffs while it glows.
      const m = this.muzzle(pt);
      this.world.particles.emit(FX_SMOKE, m[0], m[1] - 4, this.facing * 0.3, -0.5);
    }
    if (this.modeT < this.telegraph) return;
    // The view may have scrolled: never fire from outside it.
    if (!this.muzzleInView()) return this.cancelAttack();
    this.fireShell();
    this.startRecover(OOMPAH_TANK.shellRecover);
  }

  private fireShell(): void {
    const m = this.muzzle(pt);
    const s = this.mods.enemyBulletSpeed;
    const o = shot;
    o.x = m[0];
    o.y = m[1];
    // The same arc at every difficulty, flown faster on HARD: v × s, gravity × s².
    o.vx = OOMPAH_TANK.shellVx * s * this.facing;
    o.vy = OOMPAH_TANK.shellVy * s;
    o.gravity = OOMPAH_TANK.shellGravity * s * s;
    o.damage = 10;
    o.kind = 'explosion';
    o.sprite = `${ART}/shell`;
    o.look = 'anim';
    o.ticksPerFrame = 4;
    o.w = 6;
    o.h = 6;
    o.life = 400;
    o.offscreen = 96;
    o.impact = 'none';
    o.shooter = this;
    o.type = 'bell-shell';
    BellShell.spawn(this.world, o);
    o.shooter = null;
    this.fireT = 0;
    this.world.audio.sfx('enemy/tuba-blast');
    this.world.particles.burst(FX_SMOKE, m[0], m[1], 4, 0.3, 1.2, this.facing > 0 ? 0 : Math.PI, 1.2);
  }

  // ---- bass pulse

  private startPulse(): void {
    this.vx = 0;
    this.telegraph = this.tele(OOMPAH_TANK.pulseTell);
    this.setMode('pulse');
    this.world.audio.sfx('machine/tank-charge');
  }

  private thinkPulse(): void {
    this.vx = 0;
    if (this.modeT % 4 === 0) {
      // Rumble: dust shakes out from under the treads.
      const p = this.world.particles;
      p.emit(FX_DUST, this.x - 30, this.y - 1, -0.5, -0.4);
      p.emit(FX_DUST, this.x + 30, this.y - 1, 0.5, -0.4);
    }
    if (this.modeT < this.telegraph) return;
    if (!this.onScreen(-8)) return this.cancelAttack();
    const s = this.mods.enemyBulletSpeed;
    for (let dir = -1; dir <= 1; dir += 2) {
      const o = shot;
      o.x = this.x + dir * (TANK.hull.w / 2 - 2);
      o.y = this.y - OOMPAH_TANK.pulseHeight / 2;
      o.vx = dir * OOMPAH_TANK.pulseSpeed * s;
      o.vy = 0;
      o.gravity = 0;
      o.damage = 10;
      o.kind = 'bullet';
      o.tags = PULSE_TAGS;
      o.sprite = `${ART}/pulse`;
      o.look = 'anim';
      o.ticksPerFrame = 4;
      o.w = 8;
      o.h = OOMPAH_TANK.pulseHeight;
      o.life = 60;
      o.offscreen = 32;
      o.impact = 'none';
      o.hitsTerrain = false;
      o.shooter = this;
      o.type = 'bass-pulse';
      BassPulse.spawn(this.world, o);
      o.shooter = null;
      o.tags = undefined;
      o.hitsTerrain = undefined;
    }
    this.world.camera.shake(2, 10);
    this.world.audio.sfx('drum/kick');
    dust(this.world, this.x - 30, this.y, 4);
    dust(this.world, this.x + 30, this.y, 4);
    this.startRecover(OOMPAH_TANK.pulseRecover);
  }

  // ---- recovery, turning

  private startRecover(base: number): void {
    this.recoverTicks = this.recover(base);
    this.setMode('recover');
  }

  private thinkRecover(): void {
    this.vx = 0;
    if (this.modeT < this.recoverTicks) return;
    this.releaseToken();
    this.cool = this.fireInterval(OOMPAH_TANK.gap, 10);
    this.setMode('fight');
  }

  private startTurn(): void {
    this.vx = 0;
    this.releaseToken();
    this.setMode('turn');
    this.world.audio.sfx('machine/tank-charge', { vol: 0.5, pitch: 0.7 });
  }

  /** 40 ticks: spin on the treads; the turret faces the camera mid-turn; flip at the halfway mark. */
  private thinkTurn(): void {
    this.vx = 0;
    this.tread -= 0.5;
    if (this.modeT === OOMPAH_TANK.turnTicks >> 1) this.facing = this.facing > 0 ? -1 : 1;
    if (this.modeT >= OOMPAH_TANK.turnTicks) {
      this.setMode('fight');
      this.cool = Math.max(this.cool, 20);
    }
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    if (this.mode === 'shell' || this.mode === 'pulse' || this.mode === 'recover') {
      this.setMode('fight');
      this.cool = Math.max(this.cool, this.world.rng.int(20, 40));
    }
  }

  // ------------------------------------------------------------------------------- hits

  override hurtboxes(): readonly Rect[] {
    this.rel(TANK.hull, this.boxes[0]);
    this.rel(TANK.turret, this.boxes[1]);
    return this.boxes;
  }

  /** Only the hull runs players over (while driving in). */
  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return this.noBoxes;
    this.rel(TANK.hull, this.hullBox[0]);
    return this.hullBox;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    this.releaseToken();
    this.loop(null);
    this.armored = false;
    this.contactDamage = null;
    this.vx = 0;
    this.deathT = 0;
    this.world.audio.sfx('machine/sad-notes');
  }

  protected override updateDeath(): void {
    this.deathT++;
    this.vx = 0;
    this.physics();
    const T = OOMPAH_TANK;
    if (this.deathT === T.crewAt) this.spawnCrewman();
    if (this.deathT === T.boomAt) this.blowUp();
    if (this.deathT >= T.boomAt + T.wreckTicks) this.crumble();
  }

  /** The crewman hops out of the hatch, away from the nearest player. */
  private spawnCrewman(): void {
    const t = this.target();
    const away: 1 | -1 = t ? (t.x < this.x ? 1 : -1) : (-this.facing as 1 | -1);
    const hx = this.wx(TANK.hatch[0]);
    const hy = this.y + TANK.hatch[1];
    this.world.spawn('tank-crewman', hx, hy, { entry: 'hatch', facing: away });
  }

  /** The blast (harmless), then the wreck: a solid block that stays for 600 ticks. */
  private blowUp(): void {
    this.boom(this.x, this.y - 18, 'l');
    if (this.deck) {
      this.world.removeSolid(this.deck);
      this.deck = null;
    }
    const r = this.rel(TANK.wreck, tmp);
    this.liftOut(r);
    this.wreck = this.world.addSolid(new SolidBox(r.x, r.y, r.w, r.h, false, this));
    this.wrecked = true;
  }

  /** Bodies standing where the wreck appears are moved out of it (on top, or to the nearer side). */
  private liftOut(r: Rect): void {
    const list = this.world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const b = e.body;
      if (e === this || !b || e.removed || !b.collide) continue;
      const half = b.w / 2;
      if (e.x + half <= r.x || e.x - half >= r.x + r.w || e.y <= r.y || e.y - b.h >= r.y + r.h) continue;
      const up = e.y - r.y;
      const left = e.x + half - r.x;
      const right = r.x + r.w - (e.x - half);
      if (up <= Math.min(left, right) + 8) {
        e.y = r.y;
        if (e.vy > 0) e.vy = 0;
      } else if (left < right) e.x = r.x - half;
      else e.x = r.x + r.w + half;
    }
  }

  private crumble(): void {
    if (this.onScreen(16)) {
      dust(this.world, this.x - 16, this.y, 4);
      dust(this.world, this.x + 16, this.y, 4);
      this.world.particles.burst(FX_SMOKE, this.x, this.y - 10, 6, 0.2, 0.9);
    }
    this.remove();
  }

  // ------------------------------------------------------------------------------- cosmetics

  private cosmetics(): void {
    const w = this.world;
    if (this.wrecked) {
      // A smoking wreck: thick smoke at first, thinner later, a few embers.
      const since = this.deathT - OOMPAH_TANK.boomAt;
      const every = since < 200 ? 5 : since < 400 ? 9 : 15;
      if (this.age % every === 0) w.particles.emit(FX_SMOKE, this.x + w.fxRng.range(-20, 20), this.y - 18, w.fxRng.range(-0.1, 0.1), -0.4);
      if (since < 300 && this.age % 23 === 0) w.particles.emit(FX_EMBER, this.x + w.fxRng.range(-16, 16), this.y - 16, 0, -0.6);
      return;
    }
    if (this.dead) {
      if (this.age % 6 === 0) w.particles.emit(FX_SMOKE, this.x + w.fxRng.range(-14, 14), this.y - 26, 0, -0.5);
      return;
    }
    const moved = (this.x - this.prevX) * this.facing;
    this.tread += moved;
    const moving = Math.abs(this.x - this.prevX) > 0.05 || this.mode === 'turn';
    this.loop(moving && this.onScreen(32) ? 'machine/tank-move' : null, 0.6);
    if (moving && this.mode === 'drive' && this.age % 6 === 0) w.particles.emit(FX_DUST, this.x - this.facing * 30, this.y - 1, -this.facing * 0.4, -0.3);
    // Exhaust: a little brass chimney at the rear puffs now and then.
    if (this.age % 40 === 0 && this.onScreen(0)) w.particles.emit(FX_SMOKE, this.wx(-24), this.y - 34, -this.facing * 0.2, -0.4);
    this.emitDamage(this.x, this.y - 30);
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0 && this.alive;
    if (this.wrecked) {
      drawOpts.flash = false;
      r.sprite(`${ART}/wreck`, 0, x, y, drawOpts);
      return;
    }
    // Rumble before the bass pulse; a shiver through the sad notes.
    const jx = (this.mode === 'pulse' && this.alive) || (this.dead && this.deathT > 60) ? (this.age % 4 < 2 ? 1 : -1) : 0;
    const frame = ((Math.floor(this.tread) % 3) + 3) % 3;
    r.sprite(this.damageState > 0 ? `${ART}/body-dented` : `${ART}/body`, frame, x + jx, y, drawOpts);
    let id = `${ART}/turret`;
    let f = 0;
    let dy = 0;
    if (this.dead) {
      id = `${ART}/flip`;
      f = flipFrame(this.deathT);
    } else if (this.mode === 'turn' && this.modeT >= 13 && this.modeT < 27) {
      id = `${ART}/turret-front`;
    } else if (this.mode === 'shell') {
      id = `${ART}/tell`;
      f = this.modeT % 8 < 4 ? 0 : 1;
      dy = this.modeT % 8 < 4 ? 0 : -1;
    } else if (this.fireT < 12) {
      id = `${ART}/fire`;
      f = this.fireT < 4 ? 0 : 1;
    }
    r.sprite(id, f, x + jx, y + dy, drawOpts);
    if (this.mode === 'shell' && this.alive && this.telegraph - this.modeT <= 12 && this.modeT % 4 < 2) {
      // The bell glows hot just before the shot.
      const m = this.muzzle(pt);
      r.rect(Math.round(m[0]) - 3, Math.round(m[1]) - 3, 7, 7, 0xfff184ff, glowOpts);
    }
  }
}

/** Death turret frames: the bell flips up (0–1), then droops a little on each sad note (2–4). */
function flipFrame(t: number): number {
  if (t < 6) return 0;
  if (t < 22) return 1;
  if (t < 38) return 2;
  if (t < 54) return 3;
  return 4;
}

const PULSE_TAGS: readonly string[] = ['shockwave'];

// ---------------------------------------------------------------------------------------------
// Bell shell: an arcing brass handbell that bursts r 18 where it lands
// ---------------------------------------------------------------------------------------------

export class BellShell extends Projectile {
  constructor(world: World) {
    super(world);
  }

  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.burst(x, y);
  }

  override expire(): void {
    this.burst(this.x, this.y);
    this.remove();
  }

  private burst(x: number, y: number): void {
    explosion(this.world, x, y, 'm', { team: 'enemy', damage: 10, radius: OOMPAH_TANK.shellRadius, falloff: 0, kind: 'explosion' });
  }
}

// ---------------------------------------------------------------------------------------------
// Bass pulse: a 10 px ground wave that runs 48 px out of the hull and fades
// ---------------------------------------------------------------------------------------------

export class BassPulse extends Projectile {
  /** px travelled. */
  run = 0;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.run = 0;
  }

  override update(): void {
    this.t++;
    this.x += this.vx;
    this.run += Math.abs(this.vx);
    // Hug the floor (it follows slopes; it dies over a pit).
    const half = this.hitbox.h / 2;
    const feet = this.y + half;
    const floor = this.world.terrain.surfaceY(this.x, feet - 8, feet + 10);
    if (!Number.isFinite(floor) || this.run >= OOMPAH_TANK.pulseReach || this.t >= this.life) {
      this.remove();
      return;
    }
    this.y = floor - half;
  }
}

// ---------------------------------------------------------------------------------------------
// Tank crewman
// ---------------------------------------------------------------------------------------------

type CrewMode = 'hop' | 'flee' | 'cower';

/** Crewman numbers (GDD §9.2: infantry rig, 10 HP, no attacks; flees at the panic speed). */
export const CREWMAN = {
  hp: 10,
  hopVy: -2.0,
  hopVx: 1.2,
  speed: 1.6,
} as const;

export class TankCrewman extends Enemy {
  mode: CrewMode = 'flee';
  modeT = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/tank-crewman', hp: CREWMAN.hp, w: 14, h: 28 });
    this.hitbox = { x: -7, y: -28, w: 14, h: 28 };
    this.addTag('legion');
    this.facing = paramFacing(p, 1);
    if (paramStr(p, 'entry', '') === 'hatch') {
      this.mode = 'hop';
      this.vy = CREWMAN.hopVy;
      this.vx = this.facing * CREWMAN.hopVx;
      this.world.audio.sfx('enemy/panic');
    }
    this.alerted = true;
  }

  protected override think(): void {
    this.modeT++;
    if (this.mode === 'hop') {
      this.vx = this.facing * CREWMAN.hopVx;
      this.play('hop');
      if (this.modeT > 2 && this.body?.onGround) {
        dust(this.world, this.x, this.y, 3);
        this.mode = 'flee';
        this.modeT = 0;
      }
      return;
    }
    // Run away from the nearest player; cornered (wall or drop), cower in place for a moment.
    const t = this.target();
    const dir: 1 | -1 = t ? (t.x < this.x ? 1 : -1) : this.facing;
    this.facing = dir;
    if (this.mode === 'cower') {
      this.vx = 0;
      this.play('panic');
      if (this.modeT > 30) {
        this.mode = 'flee';
        this.modeT = 0;
      }
      return;
    }
    this.play('panic');
    if (!this.roomAhead(dir) || this.body?.contact.hitWall) {
      this.vx = 0;
      this.mode = 'cower';
      this.modeT = 0;
      return;
    }
    this.vx = dir * CREWMAN.speed;
  }

  /** Floor ahead (a drop of at most 40 px), so he never runs into a pit. */
  private roomAhead(dir: number): boolean {
    const floor = this.world.terrain.surfaceY(this.x + dir * 10, this.y - 8, this.y + 40);
    return Number.isFinite(floor);
  }

  protected override onDeath(d: Damage): void {
    super.onDeath(d);
    const w = this.world;
    if (d.kind === 'knife') w.audio.sfx('enemy/aria', { pitch: Math.pow(2, [0, 2, 4, 5, 7, 9, 11, 12][knifeComboStep(w)] / 12) });
    else w.audio.sfx('enemy/scream');
  }
}

defineEntity('oompah-tank', (w, x, y, p) => new OompahTank(w, x, y, p), {
  category: 'enemy',
  score: 3000,
  description: 'Oompah Tank: drives in, lobs bell shells, bass-pulses up close; leaves a wreck and a crewman.',
});
defineEntity('tank-crewman', (w, x, y, p) => new TankCrewman(w, x, y, p), {
  category: 'enemy',
  score: 100,
  description: 'Tank crewman: hops out of a dying oompah-tank and scurries away (no attacks).',
});
defineEntity(
  'bell-shell',
  (w, x, y, p) => {
    const f = paramFacing(p, -1);
    return BellShell.spawn(w, {
      team: 'enemy', x, y: y - 2, vx: OOMPAH_TANK.shellVx * f, vy: OOMPAH_TANK.shellVy, gravity: OOMPAH_TANK.shellGravity,
      damage: 10, kind: 'explosion', sprite: `${ART}/shell`, look: 'anim', w: 6, h: 6, life: 400, offscreen: 96, impact: 'none', type: 'bell-shell',
    });
  },
  { category: 'projectile', description: 'Oompah Tank shell: arcs and bursts r 18.' },
);
