/**
 * Bot mode SWAN (src/sim/bot.ts): rides the SWAN-3 (GDD §8.2; m1-c, m3-a) like a careful player.
 *
 * - Runs toward the bot's goal (exit, pickup, arena spot, section end) and holds the beak gun
 *   (aims up at targets above; beak shells at bosses and crowds).
 * - Jumps: walls and steps over her 12 px step-up (≤ 90 px), pits and deadly hazards, enemies
 *   in her way (a falling swan stomps soft enemies), banks and jetties out of the water, goals on
 *   ledges above. Every jump is planned with her own ballistics (4-tick squat, 8-tick paddle-up
 *   from water, vy −5.9, gravity 0.18, the air cap, the 60-tick glide at ≤ 1.0 fall and ≤ 2.2
 *   speed) and only taken when it lands on a floor or on water that is not deadly; a jump that
 *   needs the glide holds jump on the way down.
 * - In the air it tests "steer on / let go / steer back" × "glide / no glide" each tick and keeps
 *   the safest landing nearest the goal.
 * - Swims (water is a floor for her), never ducks.
 * - Never ejects and never makes a SWAN DIVE: down is never pressed (down + jump = eject), and
 *   jump is only pressed while fire has been held for 3+ ticks (fire + jump = SWAN DIVE; fire is
 *   held all the time, so there is no fire press near a jump press). At 0 cells (wings folded)
 *   it presses jump to get out before she blows up.
 *
 * Allocation-free per tick (scratch objects).
 */
import { BUTTON_BIT } from '../engine/input';
import type { Entity } from '../engine/entity';
import type { World } from '../engine/world';
import type { MissionRunner } from '../game/mission/runner';
import type { Player } from '../game/player/player';
import type { Vehicle } from '../game/vehicle';
import type { Bot } from './bot';
import { deadlyAt } from './bot-nav';

const L = BUTTON_BIT.left;
const R = BUTTON_BIT.right;
const UP = BUTTON_BIT.up;
const FIRE = BUTTON_BIT.fire;
const JUMP = BUTTON_BIT.jump;
const BOMB = BUTTON_BIT.bomb;

/** Her numbers (content/vehicles/swan/constants.ts; copied: the bot only reads). */
const S = {
  gravity: 0.18,
  maxFall: 5,
  jumpVy: -5.9,
  squat: 4,
  paddle: 8,
  airAccel: 0.1,
  capMin: 1.5,
  runMax: 2.6,
  glideFlapVy: -0.4,
  glideG: 0.06,
  glideFall: 1,
  glideSpeed: 2.2,
  glideDrag: 0.05,
  glideTicks: 60,
  stepUp: 12,
  reach: 90,
  swimDepth: 16,
  halfW: 14,
} as const;

/** The swan fields the rider reads (content/vehicles/swan/swan.ts). */
type SwanLike = Entity &
  Vehicle & {
    medium?: 'ground' | 'air' | 'water';
    swimming?: boolean;
    glide?: 'ready' | 'open' | 'folded';
    glideT?: number;
    airCap?: number;
    squatT?: number;
    paddleT?: number;
  };

/** A predicted landing. */
interface Fall {
  ok: boolean;
  safe: boolean;
  water: boolean;
  x: number;
  y: number;
  t: number;
}

const NO_PLATFORMS = { platforms: false } as const;

export class SwanRider {
  private fireHeld = 0;
  private best = -Infinity;
  private stuckT = 0;
  private glideWanted = false;
  private readonly fall: Fall = { ok: false, safe: false, water: false, x: 0, y: 0, t: 0 };
  private readonly tryFall: Fall = { ok: false, safe: false, water: false, x: 0, y: 0, t: 0 };
  /** Debug: why the last jump was taken and the air choice. */
  why = '';
  air = '';

  reset(): void {
    this.best = -Infinity;
    this.stuckT = 0;
    this.glideWanted = false;
  }

  update(bot: Bot, runner: MissionRunner, _p: Player, v: Entity & Vehicle): number {
    const sw = v as SwanLike;
    const world = runner.world;
    const fireOk = this.fireHeld >= 3;
    // Fire is held from the first tick on (its press edge is the only one).
    this.fireHeld = (bot.lastMask & FIRE) !== 0 ? this.fireHeld + 1 : 1;
    let mask = FIRE;
    // 0 cells: the wings fold and a jump press ejects anywhere — get out (presses on even ticks).
    if (sw.state === 'doomed' || sw.cells <= 0) return bot.tick % 2 === 0 ? JUMP : 0;
    if (sw.state !== 'driven') return mask;

    const goal = bot.goal(runner, { x: sw.x, y: sw.y }, false);
    bot.goalX = goal.x;
    bot.goalY = goal.y;
    bot.goalKind = goal.kind;
    const dx = goal.x - sw.x;
    let dir = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
    const medium = sw.medium ?? (sw.body?.onGround ? 'ground' : 'air');
    const busy = (sw.squatT ?? 0) > 0 || (sw.paddleT ?? 0) > 0;
    let jump = false;
    let holdJump = false;

    if (medium === 'air') {
      const c = this.steerAir(world, sw, goal.x, goal.y, dir);
      dir = c.dir;
      holdJump = c.glide;
    } else if (!busy) {
      this.glideWanted = false;
      const wantJump = this.groundPlan(world, sw, dir, goal.x, goal.y, medium === 'water');
      if (wantJump === 'jump') jump = true;
      else if (wantJump === 'stop') dir = 0;
    } else holdJump = this.glideWanted;

    // Stuck: no progress for a while while trying to move → jump (with the glide).
    const progress = runner.section.scroll === 'up' ? -sw.y : runner.section.scroll === 'down' ? sw.y : sw.x;
    if (progress > this.best + 2 || dir === 0 || world.camera.locked) {
      if (progress > this.best + 2) this.best = progress;
      this.stuckT = 0;
    } else if (++this.stuckT >= 120 && medium !== 'air' && !busy) {
      this.stuckT = 0;
      jump = true;
      this.glideWanted = true;
      this.why = 'stuck';
    }

    if (dir < 0) mask |= L;
    else if (dir > 0) mask |= R;

    // Aim the neck up at targets above (up + forward still runs; up + back back-pedals).
    const target = bot.pickTarget(world, { x: sw.x, y: sw.y, facing: sw.facing });
    if (target) {
      const ty = target.y + target.hitbox.y + target.hitbox.h / 2;
      const tdx = target.x - sw.x;
      if (sw.y - ty > 72 && Math.abs(tdx) < 140 && (dir === 0 || Math.sign(tdx) === dir)) mask |= UP;
    }

    // Jump: an edge (released last tick), only while fire has been held a while (no SWAN DIVE).
    if (jump && fireOk && (bot.lastMask & JUMP) === 0) mask |= JUMP;
    else if (holdJump && (bot.lastMask & JUMP) !== 0) mask |= JUMP;
    else if (holdJump && medium === 'air' && (sw.vy ?? 0) > 0 && this.fall.t > 12) mask |= JUMP;

    // Beak shells at bosses and crowds (no fire press around it: fire + bomb = HONK).
    if (fireOk && sw.shells > 0 && (bot.lastMask & BOMB) === 0 && bot.bombReady(45) && bot.wantsBomb(world, { x: sw.x, y: sw.y, facing: sw.facing })) {
      bot.markBomb();
      mask |= BOMB;
    }
    return mask;
  }

  // ------------------------------------------------------------------------------- ground / water

  /** What to do on the ground or in water: 'jump', 'stop' (wait) or 'run'. */
  private groundPlan(world: World, sw: SwanLike, dir: number, gx: number, gy: number, water: boolean): 'jump' | 'stop' | 'run' {
    const vx = sw.vx;
    const look = S.halfW + 6 + Math.abs(vx) * (water ? S.paddle : S.squat);
    // A goal on a ledge above, close by: jump when a planned jump lands near it.
    if (gy < sw.y - 30 && Math.abs(gx - sw.x) < 150) {
      if (this.planJump(world, sw, dir, water, gx, gy, true)) {
        this.why = 'goal-above';
        return 'jump';
      }
    }
    if (dir === 0) return 'run';
    const fx = sw.x + dir * look;
    // A wall or a step over her step-up (water: a bank or jetty face over the float line).
    const wallH = this.wallHeight(world, sw.x + dir * (S.halfW + 2), fx, sw.y, dir);
    if (wallH > 0) {
      if (wallH > S.reach + 4) return 'run'; // too high: the stuck detector tries anyway
      if (this.planJump(world, sw, dir, water, gx, gy, false)) {
        this.why = 'wall';
        return 'jump';
      }
      return 'run';
    }
    // A pit, a long drop or a deadly hazard ahead (water is a floor for her).
    if (!water && this.gapAhead(world, sw, dir, fx)) {
      if (this.planJump(world, sw, dir, false, gx, gy, false)) {
        this.why = 'gap';
        return 'jump';
      }
      // Nothing lands: wait at the edge (a moving platform may come), else the stuck detector.
      return 'stop';
    }
    // An enemy body in the way at her height: hop on it (a stomp) or over it.
    if (this.enemyAhead(world, sw, dir) && this.planJump(world, sw, dir, water, gx, gy, false)) {
      this.why = 'enemy';
      return 'jump';
    }
    return 'run';
  }

  /** Height of the terrain rising between x0 and x1 above the feet (0 = none over the step-up). */
  private wallHeight(world: World, x0: number, x1: number, feet: number, dir: number): number {
    const t = world.terrain;
    let best = 0;
    for (let x = x0; dir > 0 ? x <= x1 : x >= x1; x += dir * 4) {
      const top = t.surfaceY(x, feet - S.reach - 40, feet - S.stepUp - 1, NO_PLATFORMS);
      if (Number.isFinite(top)) best = Math.max(best, feet - top);
      else if (t.isSolid(x, feet - 20) || t.isSolid(x, feet - 40)) best = Math.max(best, S.reach + 40);
      // Solid dynamic boxes (floats, barges) count too.
      const solids = world.solids;
      for (let i = 0; i < solids.length; i++) {
        const b = solids[i];
        if (!b.enabled || b.oneWay || x < b.x || x >= b.x + b.w) continue;
        if (b.y < feet - S.stepUp && b.y + b.h > feet - 40) best = Math.max(best, feet - b.y);
      }
    }
    return best;
  }

  /** No floor (or water) within 120 px under the front, or a deadly hazard there. */
  private gapAhead(world: World, sw: SwanLike, dir: number, fx: number): boolean {
    for (let x = sw.x + dir * (S.halfW + 2); dir > 0 ? x <= fx : x >= fx; x += dir * 4) {
      if (deadlyAt(world, x, sw.y, 40, false)) return true;
    }
    const floor = this.floorUnder(world, fx, sw.y - 4, sw.y + 120);
    return !Number.isFinite(floor);
  }

  /** Terrain, a dynamic solid or a water float line under x between y0 and y1. */
  private floorUnder(world: World, x: number, y0: number, y1: number): number {
    let f = world.terrain.surfaceY(x, y0, y1);
    const solids = world.solids;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (!b.enabled || x < b.x || x >= b.x + b.w || b.w < 12) continue;
      if (b.y >= y0 && b.y <= y1 && b.y < f) f = b.y;
    }
    const hz = world.terrain.hazards;
    for (let i = 0; i < hz.length; i++) {
      const h = hz[i];
      if (h.kind !== 'water' || x < h.x || x >= h.x + h.w) continue;
      const fl = h.y + S.swimDepth;
      if (fl >= y0 && fl <= y1 && fl < f) f = fl;
    }
    return f;
  }

  /** An enemy body (not a boss) within 56 px ahead at her height. */
  private enemyAhead(world: World, sw: SwanLike, dir: number): boolean {
    const list = world.byTag('enemy');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== 'enemy' || e.hasTag('boss')) continue;
      const d = (e.x - sw.x) * dir;
      if (d < 8 || d > 56) continue;
      const top = e.y + e.hitbox.y;
      if (e.y >= sw.y - 12 && top <= sw.y + 4 && top > sw.y - 60) return true;
    }
    return false;
  }

  /**
   * Would a jump started now (squat / paddle-up, then the launch with the air cap toward `dir`)
   * land safely: without the glide first, then with it? For `nearGoal` the landing must also come
   * down within 24 px of the goal's height (a ledge with the goal). Sets `glideWanted`.
   */
  private planJump(world: World, sw: SwanLike, dir: number, water: boolean, gx: number, gy: number, nearGoal: boolean): boolean {
    const wait = water ? S.paddle : S.squat;
    const x0 = sw.x + sw.vx * wait;
    const vx = Math.abs(sw.vx) < 0.3 ? 0 : sw.vx;
    const cap = Math.min(S.runMax, Math.max(S.capMin, Math.abs(vx)));
    for (let g = 0; g < 2; g++) {
      const f = this.simulate(world, x0, sw.y, vx, S.jumpVy, dir, cap, g === 1, 0, this.tryFall);
      if (!f.ok || !f.safe) continue;
      if (nearGoal && (Math.abs(f.y - gy) > 24 || Math.abs(f.x - gx) > 64)) continue;
      if (!nearGoal && dir !== 0 && (f.x - sw.x) * dir < 8) continue;
      this.glideWanted = g === 1;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------- air

  private readonly airOut = { dir: 0, glide: false };

  /** In the air: pick the steering and glide whose landing is safe and nearest the goal. */
  private steerAir(world: World, sw: SwanLike, gx: number, gy: number, want: number): { dir: number; glide: boolean } {
    const glide = sw.glide ?? 'folded';
    const cap = sw.airCap ?? S.capMin;
    let bestCost = Infinity;
    const out = this.airOut;
    out.dir = want;
    out.glide = glide === 'open';
    for (let gi = 0; gi < 2; gi++) {
      const g = gi === 1;
      if (g && glide === 'folded') continue;
      for (let k = 0; k < 3; k++) {
        const d = want !== 0 ? (k === 0 ? want : k === 1 ? 0 : -want) : k === 0 ? 0 : k === 1 ? 1 : -1;
        const f = this.simulate(world, sw.x, sw.y, sw.vx, sw.vy, d, cap, g, glide === 'open' ? (sw.glideT ?? 0) : 0, this.tryFall);
        let cost = !f.ok ? 1e6 : !f.safe ? 5e5 : Math.abs(f.x - gx) + Math.abs(f.y - gy) * 0.5;
        // Prefer holding the plan: small costs for a change of mind.
        if (d !== want) cost += 6;
        if (g !== this.glideWanted) cost += 4;
        if (cost < bestCost) {
          bestCost = cost;
          out.dir = d;
          out.glide = g;
          this.copyFall(f);
        }
      }
    }
    this.glideWanted = out.glide;
    this.air = `${out.dir}${out.glide ? 'g' : ''}`;
    return out;
  }

  private copyFall(f: Fall): void {
    const o = this.fall;
    o.ok = f.ok;
    o.safe = f.safe;
    o.water = f.water;
    o.x = f.x;
    o.y = f.y;
    o.t = f.t;
  }

  /**
   * Her flight from (x, y) with (vx, vy), steering `dir` (air accel 0.1 up to `cap`), with the
   * glide when `glide` (opens once falling; `glideT` ticks already used), until she crosses a
   * floor, a dynamic solid or a water float line (≤ 300 ticks).
   */
  private simulate(world: World, x: number, y: number, vx: number, vy: number, dir: number, cap: number, glide: boolean, glideT: number, out: Fall): Fall {
    const t = world.terrain;
    const bottom = t.bounds.y + t.bounds.h + 48;
    let open = glide && glideT > 0;
    let gt = glideT;
    out.ok = false;
    out.safe = false;
    out.water = false;
    for (let k = 1; k <= 300; k++) {
      if (glide && !open && vy > 0 && gt < S.glideTicks) {
        open = true;
        vy = Math.min(vy, S.glideFlapVy);
      }
      const gliding = open && gt < S.glideTicks;
      const c = gliding ? Math.min(cap, S.glideSpeed) : cap;
      if (dir !== 0 && vx * dir < c) vx = approach(vx, dir * c, S.airAccel);
      if (gliding) {
        if (Math.abs(vx) > c) vx = approach(vx, Math.sign(vx) * c, S.glideDrag);
        vy = Math.min(vy + S.glideG, S.glideFall);
        gt++;
      } else vy = Math.min(vy + S.gravity, S.maxFall);
      const ny = y + vy;
      x += vx;
      if (vy > 0) {
        const f = this.floorUnder(world, x, y, ny);
        if (Number.isFinite(f)) {
          out.ok = true;
          out.x = x;
          out.y = f;
          out.t = k;
          out.water = !Number.isFinite(t.surfaceY(x, y, f + 0.5)) && this.isWaterLine(world, x, f);
          out.safe = !deadlyAt(world, x, f, 40, false) && x > t.bounds.x + 16 && x < t.bounds.x + t.bounds.w - 16;
          return out;
        }
      }
      y = ny;
      if (y > bottom) break;
    }
    out.x = x;
    out.y = y;
    out.t = 300;
    return out;
  }

  private isWaterLine(world: World, x: number, y: number): boolean {
    const hz = world.terrain.hazards;
    for (let i = 0; i < hz.length; i++) {
      const h = hz[i];
      if (h.kind === 'water' && x >= h.x && x < h.x + h.w && Math.abs(h.y + S.swimDepth - y) < 1) return true;
    }
    return false;
  }
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}
