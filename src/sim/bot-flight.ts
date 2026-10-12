/**
 * Bot mode FLIGHT (src/sim/bot.ts): flies a Trumpeter (GDD §8.5, m5-a) like a shoot-em-up player.
 *
 * Every tick it tests the nine stick directions (and "let go") over the next 32 ticks: the ship
 * moves with the view (the auto-scroll) plus its own flight speed and is clamped inside the view;
 * enemy shots and enemy bodies move with their last per-tick motion (shots with their gravity).
 * A move that nothing touches is safe. Among the safe moves it takes the one that ends nearest
 * its wish: a pickup on screen, else the twin-gun line of the best target ahead (bullets fly
 * straight right from the bill, 14 px above the anchor), else the left middle of the view. When
 * no move is safe it takes the one hit last. The twin gun is held all the time; dive bombs drop
 * on targets below whose fall line they cross; HONK (fire + bomb) clears a crowd of shots that
 * no move escapes. It never presses jump (down + jump / fire + jump would bail out).
 *
 * Allocation-free per tick (pooled threat records).
 */
import { BUTTON_BIT } from '../engine/input';
import type { Entity } from '../engine/entity';
import type { World } from '../engine/world';
import type { MissionRunner } from '../game/mission/runner';
import type { Player } from '../game/player/player';
import type { Vehicle } from '../game/vehicle';
import type { Bot } from './bot';

const L = BUTTON_BIT.left;
const R = BUTTON_BIT.right;
const UP = BUTTON_BIT.up;
const DOWN = BUTTON_BIT.down;
const FIRE = BUTTON_BIT.fire;
const BOMB = BUTTON_BIT.bomb;

/** Ship numbers (content/vehicles/fleet/numbers.ts TRUMPETER; copied: the bot only reads). */
const SPEED = 2;
const ACCEL = 0.5;
const HULL = { x: -14, y: -14, w: 28, h: 14 };
const VIEW_BOX = { left: -41, right: 49, top: -42, bottom: 13 };
const VIEW_MARGIN = 4;
/** The twin bullets leave the bill 14 px above the anchor. */
const MUZZLE_DY = -14;
/** Dive bombs: gravity 0.2, from the belly (2, 2), with the ship's velocity. */
const BOMB_G = 0.2;
const BOMB_DY = 2;
/** Look-ahead and safety margin around the hull. */
const HORIZON = 32;
const MARGIN = 4;
const HONK_COST = 3;

interface Threat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  hw: number;
  hh: number;
}

/** Stick directions tried each tick: let go, then the eight directions. */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [-1, 1],
];

export class FlightPilot {
  private readonly threats: Threat[] = [];
  private n = 0;
  private lastDir = 0;
  private honkStep = 0;
  private lastHonk = -10_000;
  /** Debug: the wish point and whether the chosen move was safe. */
  wishX = 0;
  wishY = 0;
  safe = true;

  reset(): void {
    this.lastDir = 0;
    this.honkStep = 0;
  }

  update(bot: Bot, runner: MissionRunner, _p: Player, v: Entity & Vehicle): number {
    const ship = v as Entity & Vehicle & { mode?: string; flyVx?: number; flyVy?: number; scrollVx?: number; scrollVy?: number };
    // Autopilot (fly-in, the landing hatch, a backup ship): no control.
    if (ship.mode !== undefined && ship.mode !== 'fly') return FIRE;
    const world = runner.world;
    const t = bot.tick;
    const last = bot.lastMask;

    // HONK in two ticks: let go of fire, then press fire + bomb together.
    if (this.honkStep === 1) {
      this.honkStep = 2;
      return this.steer(this.lastDir);
    }
    if (this.honkStep === 2) {
      this.honkStep = 0;
      this.lastHonk = t;
      return this.steer(this.lastDir) | FIRE | BOMB;
    }

    if (bot.opts.dodge) this.collect(world, ship);
    else this.n = 0;
    const cam = world.camera;
    const minX = cam.left + VIEW_MARGIN - VIEW_BOX.left;
    const maxX = cam.right - VIEW_MARGIN - VIEW_BOX.right;
    const minY = cam.top + VIEW_MARGIN - VIEW_BOX.top;
    const maxY = cam.bottom - VIEW_MARGIN - VIEW_BOX.bottom;
    const svx = ship.scrollVx ?? 0;
    const svy = ship.scrollVy ?? 0;

    // ---- the wish: a pickup, the gun line of a target ahead, else the left middle of the view
    const target = this.pickAhead(world, ship);
    let wx = cam.left + 90;
    let wy = (minY + maxY) / 2;
    const item = this.nearestItem(world, ship);
    if (item) {
      wx = item.x;
      wy = item.y + 7;
    } else if (target) {
      const tc = target.y + target.hitbox.y + target.hitbox.h / 2;
      wy = tc - MUZZLE_DY;
      wx = Math.min(target.x - 120, cam.left + 150);
    }
    wx = Math.max(minX + 8, Math.min(maxX - 8, wx));
    wy = Math.max(minY + 4, Math.min(maxY - 4, wy));
    this.wishX = wx;
    this.wishY = wy;

    // ---- test the moves
    let bestDir = 0;
    let bestSafe = false;
    let bestCost = Infinity;
    let bestHit = -1;
    for (let d = 0; d < DIRS.length; d++) {
      const ax = DIRS[d][0];
      const ay = DIRS[d][1];
      const s = SPEED * (ax !== 0 && ay !== 0 ? Math.SQRT1_2 : 1);
      let fvx = ship.flyVx ?? 0;
      let fvy = ship.flyVy ?? 0;
      let x = ship.x;
      let y = ship.y;
      let lo = minX;
      let hi = maxX;
      let top = minY;
      let bot2 = maxY;
      let hit = Infinity;
      let ex = x;
      let ey = y;
      for (let k = 1; k <= HORIZON; k++) {
        fvx = approach(fvx, ax * s, ACCEL);
        fvy = approach(fvy, ay * s, ACCEL);
        lo += svx;
        hi += svx;
        top += svy;
        bot2 += svy;
        x = Math.max(lo, Math.min(hi, x + fvx + svx));
        y = Math.max(top, Math.min(bot2, y + fvy + svy));
        if (k === 14) {
          ex = x - svx * 14;
          ey = y - svy * 14;
        }
        if (this.hits(x, y, k)) {
          hit = k;
          break;
        }
      }
      const safe = hit === Infinity;
      // Where the move ends (in view terms, now) against the wish; a small cost for turning.
      const cost = Math.abs(ex - wx) * 0.6 + Math.abs(ey - wy) + (d === this.lastDir ? 0 : 2);
      if (safe) {
        if (!bestSafe || cost < bestCost) {
          bestSafe = true;
          bestCost = cost;
          bestDir = d;
        }
      } else if (!bestSafe && (hit > bestHit || (hit === bestHit && cost < bestCost))) {
        bestHit = hit;
        bestCost = cost;
        bestDir = d;
      }
    }
    this.safe = bestSafe;
    this.lastDir = bestDir;
    let mask = this.steer(bestDir) | FIRE;

    // ---- HONK when shots close in and nothing escapes them
    if (!bestSafe && bestHit <= 12 && ship.shells >= HONK_COST && t - this.lastHonk > 260 && this.shotsNear(ship) >= 3 && bot.bombReady(20)) {
      this.honkStep = 1;
      bot.markBomb();
      return mask & ~FIRE;
    }

    // ---- dive bombs on targets below (not right after a fire press: that would be a HONK)
    if (ship.shells > 0 && (last & FIRE) !== 0 && (last & BOMB) === 0 && bot.bombReady(24) && this.bombLine(world, ship)) {
      bot.markBomb();
      mask |= BOMB;
    }
    return mask;
  }

  private steer(d: number): number {
    const ax = DIRS[d][0];
    const ay = DIRS[d][1];
    return (ax < 0 ? L : ax > 0 ? R : 0) | (ay < 0 ? UP : ay > 0 ? DOWN : 0);
  }

  /** Enemy shots and bodies near the ship, with their last per-tick motion. */
  private collect(world: World, ship: Entity): void {
    this.n = 0;
    this.add(world.byTag('shot'), ship, true);
    this.add(world.byTag('enemy'), ship, false);
    // Bosses and their parts are 'enemy' too; shootable hostiles that are not tagged 'enemy'
    // (props on the enemy team) are left alone: they do not move into the ship.
  }

  private add(list: readonly Entity[], ship: Entity, shots: boolean): void {
    const th = this.threats;
    for (let i = 0; i < list.length && this.n < 48; i++) {
      const e = list[i] as Entity & { gravity?: number };
      if (!e.alive || e.team !== 'enemy') continue;
      if (Math.abs(e.x - ship.x) > 260 || Math.abs(e.y - ship.y) > 220) continue;
      const r = th[this.n] ?? (th[this.n] = { x: 0, y: 0, vx: 0, vy: 0, g: 0, hw: 0, hh: 0 });
      const hb = e.hitbox;
      const hx = e.facing < 0 ? -(hb.x + hb.w) : hb.x;
      r.x = e.x + hx + hb.w / 2;
      r.y = e.y + hb.y + hb.h / 2;
      // Motion: the last tick's step (formations move themselves; vx may be 0).
      const mx = e.x - e.prevX;
      const my = e.y - e.prevY;
      r.vx = Math.abs(mx) < 20 ? mx : e.vx;
      r.vy = Math.abs(my) < 20 ? my : e.vy;
      r.g = shots && typeof e.gravity === 'number' ? e.gravity : 0;
      r.hw = hb.w / 2;
      r.hh = hb.h / 2;
      this.n++;
    }
  }

  /** Does any threat overlap the hull (with the margin) at tick k when the ship is at (x, y)? */
  private hits(x: number, y: number, k: number): boolean {
    const cx = x + HULL.x + HULL.w / 2;
    const cy = y + HULL.y + HULL.h / 2;
    const hw = HULL.w / 2 + MARGIN;
    const hh = HULL.h / 2 + MARGIN;
    for (let i = 0; i < this.n; i++) {
      const s = this.threats[i];
      const sx = s.x + s.vx * k;
      const sy = s.y + s.vy * k + 0.5 * s.g * k * k;
      if (Math.abs(sx - cx) < hw + s.hw && Math.abs(sy - cy) < hh + s.hh) return true;
    }
    return false;
  }

  private shotsNear(ship: Entity): number {
    const list = ship.world.byTag('shot');
    let c = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.alive && s.team === 'enemy' && Math.abs(s.x - ship.x) < 72 && Math.abs(s.y - ship.y + 7) < 64) c++;
    }
    return c;
  }

  /** The best target ahead of the bill (the gun only fires right): nearest in x, on screen. */
  private pickAhead(world: World, ship: Entity): Entity | null {
    const list = world.byTag('shootable');
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== 'enemy' || !world.onScreen(e, -4)) continue;
      const dx = e.x - ship.x;
      if (dx < 24) continue;
      const tc = e.y + e.hitbox.y + e.hitbox.h / 2;
      const score = dx + Math.abs(tc - (ship.y + MUZZLE_DY)) * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private nearestItem(world: World, ship: Entity): Entity | null {
    const list = world.byTag('item');
    let best: Entity | null = null;
    let bestD = 260;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!it.alive || !world.onScreen(it, -12)) continue;
      const d = Math.abs(it.x - ship.x) + Math.abs(it.y - ship.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  /** Would a dive bomb dropped now fall onto a target below? */
  private bombLine(world: World, ship: Entity): boolean {
    const list = world.byTag('shootable');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== 'enemy' || !world.onScreen(e, 0)) continue;
      const top = e.y + e.hitbox.y;
      const dy = top - (ship.y + BOMB_DY);
      if (dy < 16 || dy > 200) continue;
      // Fall time under gravity (starting with the ship's vy), then where it is in x by then.
      const vy = ship.vy;
      const tFall = (-vy + Math.sqrt(vy * vy + 2 * BOMB_G * dy)) / BOMB_G;
      const bx = ship.x + 2 + ship.vx * tFall;
      const ex = e.x + (e.x - e.prevX) * tFall;
      if (Math.abs(bx - ex) < e.hitbox.w / 2 + 6) return true;
    }
    return false;
  }
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}
