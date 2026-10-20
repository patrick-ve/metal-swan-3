/**
 * The scan car's helpers (docs/design/ams-extras.md §3): the SCAN LOCK reticle and ticket strip,
 * the tow truck with its crane hook, the wheel clamps and the status `clamped`.
 *
 * - `ScanReticle` — the red reticle of SCAN LOCK (neutral, drawn over the players; the car moves it).
 * - `ams-scan-ticket` (`ScanTicket`) — the fine strip from the printer: straight, 5.5 px/tick ×
 *   the difficulty's shot speed, kills like every hit, erased by POOF and HONK, stops on terrain.
 * - `ams-tow-truck` (`AmsTowTruck`) — backs in from an arena side (reversing beeps from 100 px
 *   outside the view), stops with its crane tip `TRUCK.stopIn` px inside, lowers the hook and
 *   swings it at a standing player's chest (crouch under it or time a jump), tosses 2 wheel clamps
 *   off its bed and drives off after 10 s or when broken (300 HP × the big-enemy HP). Its body
 *   never hurts; only the swinging hook does.
 * - `ams-wheel-clamp` (`AmsWheelClamp`) — lands open (armed), waits, crouches (the hop tell,
 *   ≥ 18 ticks) and hops toward the nearest player. A player on foot whose feet are in its open
 *   jaws gets `clamped`; a driven vehicle crushes it. 2 hits break it (an explosion or the knife
 *   at once). Tags `enemy`, `shootable`, `soft`, `ams-scan`, `ams-scan-clamp`.
 * - Status `clamped` (45 ticks): the hero cannot walk, jump or mount; he can turn, crouch, aim,
 *   shoot and throw. The clamp is drawn on his boot; it pops off at the end, and the same hero
 *   cannot be clamped again for 40 ticks.
 */
import type { Damage, Entity } from '../../../../engine/entity';
import { Entity as EntityBase } from '../../../../engine/entity';
import { overlaps, rectAt, type Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { PAL } from '../../../../engine/palette';
import { difficultyOf, playerCountOf } from '../../../context';
import { telegraphTicks } from '../../../enemy';
import { awardScore } from '../../../events';
import { debris, dust, explosion, poof, smokeTrail } from '../../../fx';
import { isPlayer, type Player } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { Projectile } from '../../../projectile';
import { defineEntity, defineStatus, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { TUNING } from '../../../tuning';
import { CLAMP, CLAMP_ID, CLAMP_TAG, CLAMPED_ID, HOOK, ID, SCAN, SCAN_TAG, TICKET, TICKET_ID, TRUCK, TRUCK_ID, TRUCK_TAG } from './geometry';

/** Every hit of the fight carries the `boss` tag (a player vehicle loses one cell). */
export const BOSS_HIT: readonly string[] = ['boss'];

const drawOpts: DrawOpts = {};
const footOpts: DrawOpts = {};

/** The floor under x near y (ground, platforms, solids), else `y`. */
export function floorNear(world: World, x: number, y: number, up = 24, down = 48): number {
  const f = world.terrain.surfaceY(x, y - up, y + down);
  return Number.isFinite(f) ? f : y;
}

// ---------------------------------------------------------------------------------------------
// The SCAN LOCK reticle
// ---------------------------------------------------------------------------------------------

/** The red reticle (the car moves it; `locked` = frozen and blinking). */
export class ScanReticle extends EntityBase {
  locked = false;
  t = 0;
  /** Ticks left of the fade after the shot (−1 = none). */
  fade = -1;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.type = 'ams-scan-reticle';
    this.team = 'neutral';
    this.z = 75;
    this.hitbox = { x: -9, y: -9, w: 18, h: 18 };
    this.despawnMargin = Infinity;
  }

  /** Ease toward (x, y) at `speed` px/tick (not while locked). */
  follow(x: number, y: number, speed: number): void {
    if (this.locked) return;
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= speed) {
      this.x = x;
      this.y = y;
    } else {
      this.x += (dx / d) * speed;
      this.y += (dy / d) * speed;
    }
  }

  override update(): void {
    this.t++;
    if (this.fade >= 0 && --this.fade <= 0) this.remove();
  }

  override draw(r: Renderer): void {
    // Tracking: steady brackets; frozen: the closed crosshair blinks (3 on, 3 off).
    if (this.locked && Math.floor(this.t / 3) % 2 === 1) return;
    if (this.fade >= 0 && this.fade % 4 < 2) return;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(ID.reticle, this.locked ? 1 : 0, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The ticket strip
// ---------------------------------------------------------------------------------------------

/** The fine strip from the ticket printer (drawn flying LEFT; flipped when it flies right). */
export class ScanTicket extends Projectile {
  /** The frozen spot's x (the strip drops there) and the flight's side (+1 right, −1 left). */
  dropX = 0;
  dir: 1 | -1 = 1;
  /** It reached the spot and flutters down onto it. */
  falling = false;

  /**
   * From the printer (x, y) up to a point `SCAN.scan.lift` px over the frozen spot (tx, ty), then
   * it drops straight down onto the spot: a level flight over the heads (a step toward the car
   * passes under it), a drop that a step away from the spot dodges (docs/design/ams-extras.md §3).
   */
  static fire(world: World, x: number, y: number, tx: number, ty: number, shooter: Entity | null): ScanTicket {
    const s = SCAN.scan.speed * difficultyOf(world).enemyBulletSpeed;
    const dx = tx - x;
    const dy = ty - SCAN.scan.lift - y;
    const len = Math.hypot(dx, dy) || 1;
    const t = ScanTicket.spawn(world, {
      team: 'enemy',
      x,
      y,
      vx: (dx / len) * s,
      vy: (dy / len) * s,
      damage: 10,
      kind: 'bullet',
      tags: BOSS_HIT,
      hitsTerrain: true,
      look: 'anim',
      sprite: ID.ticket,
      ticksPerFrame: 3,
      w: TICKET.hit.w,
      h: TICKET.hit.h,
      life: Math.ceil(len / s) + 120,
      offscreen: 32,
      shooter,
      type: TICKET_ID,
    });
    t.dropX = tx;
    t.dir = dx < 0 ? -1 : 1;
    t.falling = Math.abs(dx) < 1;
    if (t.falling) t.startDrop();
    return t;
  }

  private startDrop(): void {
    this.falling = true;
    this.x = this.dropX;
    this.vx = 0;
    // A paper strip flutters down at a steady speed (no gravity: its fall is a straight line).
    this.vy = SCAN.scan.dropV;
    this.gravity = 0;
  }

  override update(): void {
    if (!this.falling && (this.x + this.vx - this.dropX) * this.dir >= 0) {
      // Over the spot: stop there and drop.
      this.startDrop();
      this.prevX = this.x;
    }
    super.update();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.dir > 0;
    drawOpts.flash = false;
    r.sprite(ID.ticket, Math.floor(this.t / this.ticksPerFrame) % 3, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The status `clamped`
// ---------------------------------------------------------------------------------------------

/** The tick after which a freed player may be clamped again. */
const graceUntil = new WeakMap<Player, number>();

/** Is the player clamped right now? */
export function isClamped(p: Entity): boolean {
  return isPlayer(p) && p.status.has(CLAMPED_ID);
}

export const CLAMPED: StatusEffectDef = {
  id: CLAMPED_ID,
  ticks: CLAMP.ticks,
  speed: 0,
  noJump: true,
  noMount: true,
  onStart(p) {
    p.vx = 0;
    p.world.audio.sfx('ams/clamp-clunk');
    dust(p.world, p.x, p.y, 3);
  },
  onTick(p) {
    if (p.onGround) p.vx = 0;
  },
  onEnd(p) {
    graceUntil.set(p, p.world.tick + CLAMP.grace);
    if (p.state !== 'play') return;
    // The clamp pops off the boot and falls apart.
    debris(p.world, p.x + p.facing * 2, p.y - 3, 'metal', 5);
    p.world.audio.sfx('ams/clamp-clunk', { pitch: 1.5, vol: 0.6 });
  },
  onDraw(p, r, left) {
    if (p.state !== 'play') return;
    // The last 12 ticks it rattles loose.
    const f = left <= 12 ? Math.floor(p.world.tick / 2) % 2 : 0;
    footOpts.flipX = p.facing < 0;
    footOpts.flash = false;
    r.sprite(ID.clampFoot, f, Math.round(p.x + p.facing * 2), Math.round(p.y), footOpts);
  },
};
defineStatus(CLAMPED);

/** May this player be clamped now (on foot, on the ground, not blinking, not just freed)? */
function canClamp(p: Entity): p is Player {
  if (!isPlayer(p) || p.state !== 'play' || !p.onGround || p.invulnTicks > 0) return false;
  if (p.status.has(CLAMPED_ID)) return false;
  return p.world.tick >= (graceUntil.get(p) ?? 0);
}

// ---------------------------------------------------------------------------------------------
// The wheel clamp
// ---------------------------------------------------------------------------------------------

type ClampState = 'air' | 'armed' | 'squat' | 'hop';

const jawRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const feetRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

export class AmsWheelClamp extends EntityBase {
  state: ClampState = 'air';
  /** Ticks in the current state. */
  t = 0;
  hits: number = CLAMP.hits;
  /** Ticks of its whole life (it falls apart after CLAMP.life). */
  private lifeT = 0;
  private tellTicks: number;
  /** Ticks the last hop tell lasted (tests). */
  lastTell = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 34;
    this.hitbox = { ...CLAMP.box };
    this.hp = this.maxHp = CLAMP.hits;
    this.addTag('enemy', 'shootable', 'soft', SCAN_TAG, CLAMP_TAG);
    this.vx = paramNum(p, 'vx', 0);
    this.vy = paramNum(p, 'vy', 0);
    this.state = this.vx !== 0 || this.vy !== 0 ? 'air' : 'armed';
    this.tellTicks = telegraphTicks(world, CLAMP.tell);
    if (this.state === 'armed') this.y = floorNear(world, x, y);
  }

  get armed(): boolean {
    return this.state === 'armed' || this.state === 'squat';
  }

  override update(): void {
    if (this.dead) return;
    this.t++;
    if (++this.lifeT >= CLAMP.life) {
      this.fallApart();
      return;
    }
    if (this.flashTicks > 0) this.flashTicks--;
    switch (this.state) {
      case 'air':
      case 'hop':
        this.fly();
        break;
      case 'armed':
        if (this.t >= CLAMP.wait && this.target()) this.setState('squat');
        break;
      case 'squat':
        if (this.t >= this.tellTicks) this.hop();
        break;
    }
    if (this.armed) this.bite();
  }

  private setState(s: ClampState): void {
    this.state = s;
    this.t = 0;
  }

  /** The nearest player on foot in the view (or null). */
  private target(): Entity | null {
    const t = this.world.nearestPlayer(this.x, this.y - 8);
    if (!t || !this.world.camera.containsPoint(this.x, this.y - 4, 8)) return null;
    return t;
  }

  private hop(): void {
    const t = this.target();
    this.lastTell = this.t;
    const dir = t ? Math.sign(t.x - this.x) || 1 : this.facing;
    this.facing = dir < 0 ? -1 : 1;
    const k = difficultyOf(this.world).enemyBulletSpeed;
    this.vx = dir * CLAMP.hopVx * k;
    this.vy = CLAMP.hopVy;
    this.world.audio.sfx('ams/clamp-clunk', { pitch: 1.3, vol: 0.45 });
    this.setState('hop');
  }

  private fly(): void {
    this.vy = Math.min(4, this.vy + CLAMP.gravity);
    const nx = this.x + this.vx;
    // A wall stops the sideways motion.
    if (this.world.terrain.isSolid(nx, this.y - 4)) this.vx = 0;
    else this.x = nx;
    const ny = this.y + this.vy;
    if (this.vy >= 0) {
      const f = this.world.terrain.surfaceY(this.x, this.y - 2, ny + 1);
      if (Number.isFinite(f) && ny >= f) {
        this.y = f;
        this.vx = 0;
        this.vy = 0;
        this.setState('armed');
        dust(this.world, this.x, this.y, 2);
        this.world.audio.sfx('ams/clamp-clunk', { vol: 0.5 });
        return;
      }
    }
    this.y = ny;
  }

  /** Open jaws: a player's feet in them are clamped; a driven vehicle crushes the clamp. */
  private bite(): void {
    rectAt(this.x, this.y, CLAMP.jaws, false, jawRect);
    const ps = this.world.players;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!canClamp(p)) continue;
      feetRect.x = p.x - 5;
      feetRect.y = p.y - 4;
      feetRect.w = 10;
      feetRect.h = 4;
      if (!overlaps(feetRect, jawRect)) continue;
      p.status.add(CLAMPED);
      this.dead = true;
      this.remove();
      return;
    }
    const vs = this.world.byTag('vehicle');
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i] as Entity & { state?: string; driver?: Player | null };
      if (!v.alive || v.team !== 'player' || v.state !== 'driven') continue;
      if (!overlaps(v.hitRect(), jawRect)) continue;
      this.smash(v.driver?.index ?? -1);
      return;
    }
  }

  override onHit(d: Damage): boolean {
    if (this.dead || this.removed) return false;
    this.flashTicks = 4;
    const hard = d.kind === 'explosion' || d.kind === 'knife' || d.kind === 'crush' || d.kind === 'fire' || d.kind === 'impact';
    this.hits = hard ? 0 : this.hits - 1;
    this.hp = Math.max(0, this.hits);
    if (this.hits <= 0) this.smash(d.owner ?? -1);
    else this.world.audio.sfx('hit/metal', { pitch: 1.2 });
    return true;
  }

  /** Broken (2 hits, a blast, the knife or a vehicle): points to `owner`. */
  smash(owner: number): void {
    if (this.dead) return;
    this.dead = true;
    debris(this.world, this.x, this.y - 4, 'metal', 6);
    poof(this.world, this.x, this.y - 4);
    this.world.audio.sfx('ams/clamp-clunk', { pitch: 1.6, vol: 0.7 });
    awardScore(this.world, owner, CLAMP.score, this.x, this.y - 12);
    this.remove();
  }

  /** The fight is over (or it lived too long): it falls apart, no points. */
  fallApart(): void {
    if (this.dead) return;
    this.dead = true;
    debris(this.world, this.x, this.y - 4, 'metal', 4);
    poof(this.world, this.x, this.y - 4);
    this.remove();
  }

  override onOutOfWorld(): void {
    this.fallApart();
  }

  override draw(r: Renderer): void {
    let f = 0;
    if (this.state === 'armed') f = this.t % 40 < 34 ? 1 : 2;
    else if (this.state === 'squat') f = 3;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0 && this.world.tick % 2 === 0;
    r.sprite(ID.clamp, f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The tow truck
// ---------------------------------------------------------------------------------------------

type TruckState = 'reverse' | 'work' | 'leave';

const hookBox: Rect = { x: 0, y: 0, w: 0, h: 0 };

export class AmsTowTruck extends EntityBase {
  state: TruckState = 'reverse';
  /** −1: it came in from the left (its rear points right), +1: from the right. */
  readonly from: 1 | -1;
  readonly arenaLeft: number;
  readonly arenaW: number;
  /** The anchor x where it stops. */
  readonly stopX: number;
  /** Ticks at work; the hook (cable length, angle, amplitude) and whether it hurts. */
  workT = 0;
  hookLen = 0;
  hookAng = 0;
  private amp = 0;
  hot = false;
  /** The tick the hook first hurt and the tick the beeps began (tests: the telegraph). */
  hotAt = -1;
  readonly beepAt: number;
  broken = false;
  private dropped = 0;
  private wheelDist = 0;
  private t = 0;
  private readonly contacts: Rect[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 26;
    this.hitbox = { ...TRUCK.box };
    const cam = world.camera;
    this.arenaLeft = paramNum(p, 'arenaLeft', Math.round(cam.left));
    this.arenaW = paramNum(p, 'arenaW', SCAN.arenaW);
    const side = paramStr(p, 'from', x < this.arenaLeft + this.arenaW / 2 ? 'left' : 'right');
    this.from = side === 'right' ? 1 : -1;
    // It backs in: the rear (the crane) leads into the arena.
    this.facing = this.from > 0 ? 1 : -1;
    this.stopX = this.from < 0 ? this.arenaLeft + TRUCK.stopIn + TRUCK.tip[0] : this.arenaLeft + this.arenaW - TRUCK.stopIn - TRUCK.tip[0];
    const coop = playerCountOf(world) > 1 ? TUNING.coop.bossHp : 1;
    this.hp = this.maxHp = Math.max(1, Math.round(TRUCK.hp * difficultyOf(world).bigEnemyHp * coop));
    this.contactDamage = { amount: 10, kind: 'impact', dirX: 0, tags: BOSS_HIT };
    this.despawnMargin = Infinity;
    this.addTag('enemy', 'shootable', SCAN_TAG, TRUCK_TAG);
    this.y = floorNear(world, x, y);
    this.beepAt = world.tick;
  }

  /** World x of the crane tip (the rear-most point; the hook swings under it). */
  tipX(): number {
    return this.x + (this.facing < 0 ? -TRUCK.tip[0] : TRUCK.tip[0]);
  }

  /** The hook's anchor (the cable's end) in world space. */
  hookPoint(out: [number, number]): [number, number] {
    out[0] = this.tipX() + Math.sin(this.hookAng) * this.hookLen;
    out[1] = this.y + TRUCK.tip[1] + Math.cos(this.hookAng) * this.hookLen;
    return out;
  }

  private readonly hp2: [number, number] = [0, 0];

  override update(): void {
    this.t++;
    if (this.flashTicks > 0) this.flashTicks--;
    switch (this.state) {
      case 'reverse': {
        // Backwards: the rear leads (−facing).
        const dir = -this.facing;
        const left = (this.stopX - this.x) * dir;
        const step = Math.min(TRUCK.reverse, Math.max(0, left));
        this.x += dir * step;
        this.wheelDist -= step;
        if ((this.t - 1) % TRUCK.beepEvery === 0) this.world.audio.sfx('ams/reverse-beep');
        if (left <= TRUCK.reverse) {
          this.state = 'work';
          this.workT = 0;
          dust(this.world, this.x, this.y, 3);
        }
        break;
      }
      case 'work':
        this.work();
        break;
      case 'leave': {
        this.hot = false;
        this.hookLen = Math.max(0, this.hookLen - 1);
        this.hookAng *= 0.9;
        this.x += this.facing * TRUCK.leave;
        this.wheelDist += TRUCK.leave;
        if (this.broken && this.t % 5 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-30, 30), this.y - 24, true);
        const cam = this.world.camera;
        if (this.x < cam.left - 140 || this.x > cam.right + 140) this.remove();
        break;
      }
    }
    this.y = floorNear(this.world, this.x, this.y, 12, 24);
  }

  private work(): void {
    const H = TRUCK.hook;
    const w = ++this.workT;
    this.hookLen = Math.min(H.len, (w / H.lower) * H.len);
    if (w > H.lower) {
      const s = w - H.lower;
      this.amp = Math.min(H.amp, (s / H.grow) * H.amp);
      this.hookAng = this.amp * Math.sin((2 * Math.PI * s) / H.period);
    }
    const hot = this.hookLen >= H.len && this.amp >= 0.15;
    if (hot && this.hotAt < 0) this.hotAt = this.world.tick;
    this.hot = hot;
    for (let i = 0; i < TRUCK.drops.length; i++) if (w === TRUCK.drops[i]) this.dropClamp();
    if (w >= TRUCK.stay) this.leave();
  }

  /** Toss a clamp off the bed toward the arena (the clamp cap holds). */
  private dropClamp(): void {
    if (this.world.countAlive(CLAMP_TAG) >= SCAN.tow.clampMax) return;
    const dir = -this.facing;
    const x = this.x + (this.facing < 0 ? -TRUCK.dropAt[0] : TRUCK.dropAt[0]);
    const k = this.dropped++;
    this.world.spawn(CLAMP_ID, x, this.y + TRUCK.dropAt[1], { vx: dir * (1.2 + k * 0.5), vy: -2.4 - k * 0.3 });
    this.world.audio.sfx('ams/clamp-clunk', { pitch: 0.8, vol: 0.5 });
  }

  /** Drive off (forward, out of the view). */
  leave(): void {
    if (this.state === 'leave') return;
    this.state = 'leave';
    this.hot = false;
  }

  override contactBoxes(): readonly Rect[] {
    const out = this.contacts;
    out.length = 0;
    if (!this.hot || this.broken) return out;
    const [hx, hy] = this.hookPoint(this.hp2);
    rectAt(hx, hy, HOOK.box, false, hookBox);
    out.push(hookBox);
    return out;
  }

  override onHit(d: Damage): boolean {
    if (this.broken || this.removed) return false;
    this.hp -= d.amount;
    this.flashTicks = 4;
    if (d.kind === 'bullet' && this.t % 4 === 0) this.world.audio.sfx('hit/metal', { vol: 0.4, pitch: 0.8 });
    if (this.hp <= 0) this.breakDown(d);
    return true;
  }

  /** Broken: a blast, points, and it limps off smoking (no longer an enemy). */
  private breakDown(d: Damage): void {
    this.hp = 0;
    this.broken = true;
    const c = this.hitRect();
    explosion(this.world, c.x + c.w / 2, c.y + c.h / 2, 'm', { debris: 'metal' });
    debris(this.world, c.x + c.w / 2, c.y + c.h / 2, 'metal', 10);
    awardScore(this.world, d.owner ?? -1, TRUCK.score, c.x + c.w / 2, c.y);
    this.removeTag('shootable');
    this.removeTag('enemy');
    this.leave();
  }

  override onOutOfWorld(): void {
    this.remove();
  }

  override draw(r: Renderer): void {
    const flip = this.facing < 0;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = flip;
    drawOpts.flash = this.flashTicks > 0 && this.world.tick % 2 === 0;
    // The cable and the hook behind the truck.
    if (this.hookLen > 0.5) {
      const [hx, hy] = this.hookPoint(this.hp2);
      r.line(Math.round(this.tipX()), y + TRUCK.tip[1], Math.round(hx), Math.round(hy), PAL.ink[1]);
      drawOpts.flash = false;
      r.sprite(ID.hook, 0, Math.round(hx), Math.round(hy), drawOpts);
      drawOpts.flash = this.flashTicks > 0 && this.world.tick % 2 === 0;
    }
    r.sprite(ID.truck, this.broken || this.hp <= this.maxHp / 2 ? 1 : 0, x, y, drawOpts);
    const f = ((Math.floor(this.wheelDist / 1.9) % 4) + 4) % 4;
    drawOpts.flash = false;
    for (let i = 0; i < TRUCK.wheelX.length; i++) {
      const wx = TRUCK.wheelX[i];
      r.sprite(ID.wheel, f, x + (flip ? -wx : wx), y + TRUCK.wheelY, drawOpts);
    }
    // The amber beacon on the cab roof turns (two lamps, alternating).
    if (!this.broken && Math.floor(this.t / 8) % 2 === 0) {
      const b = TRUCK.beacon;
      const bx = b.x + (Math.floor(this.t / 16) % 2 === 0 ? 2 : b.w - 2);
      r.sprite(ID.blink, 0, x + (flip ? -bx : bx), y + b.y + 1, drawOpts);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Registry (the arena tool and scripts can place them on their own)
// ---------------------------------------------------------------------------------------------

defineEntity(TRUCK_ID, (w, x, y, p) => new AmsTowTruck(w, x, y, p), {
  category: 'enemy',
  score: TRUCK.score,
  description: 'The scan car\'s tow truck: backs in (params from left|right, arenaLeft, arenaW), swings its crane hook at chest height, tosses 2 wheel clamps; 300 HP; leaves after 10 s or when broken.',
});
defineEntity(CLAMP_ID, (w, x, y, p) => new AmsWheelClamp(w, x, y, p), {
  category: 'enemy',
  score: CLAMP.score,
  description: 'Wheel clamp: hops toward the players (tell 22); open jaws clamp a hero\'s boot (status clamped, 45 ticks); 2 hits (a blast or the knife at once). Params vx, vy (tossed).',
});
defineEntity(TICKET_ID, (w, x, y, p) => ScanTicket.fire(w, x, y - 38, x + paramNum(p, 'tx', -200), y - 15, null), {
  category: 'projectile',
  description: 'The scan car\'s fine strip: straight at a spot (param tx: the spot\'s x offset), 5.5 px/tick.',
});
