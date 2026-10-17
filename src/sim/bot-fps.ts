/**
 * The first-person bot (docs/design/fps.md §10; docs/api/fps.md §5): an autopilot that plays a
 * floor through the scripted input of the headless harness (`createHeadlessFps({ bot: true })`,
 * `npm run sim -- --mode fps --floor n`).
 *
 * Each tick it reads the FpsGame (the state after the last tick) and decides:
 * 1. **Fight:** the nearest living enemy in line of sight (24 tiles): turn to it, fire when the
 *    aim line is on it (the pistol taps, the MG and chaingun hold; the knife walks in). The boss
 *    with a gun up: keep 2.6–5 tiles, run sideways through his tell and burst, hold fire while
 *    the suit breaks (`bossTactic`); the adds (reinforcements) in sight within 14 tiles first;
 *    below 20 rounds, fetch a clip between his bursts.
 * 2. **Navigate:** a BFS over the cells (walls, solid props and push walls block; locked doors
 *    without the key block) to the goal: health below 40 HP, ammo below 20 (or the knife is up),
 *    a gun not owned yet, the gold key, the silver key, then the elevator switch (use it) or the
 *    boss. Closed doors on the path are opened with "use" while facing them.
 * 3. **Unstick:** no progress for 90 ticks → strafe a random side for 20 ticks.
 *
 * Deterministic (its own Rng); pure TypeScript.
 */
import { ACTION_BIT } from '../engine/input-actions';
import type { AnalogState } from '../engine/input-actions';
import { angDelta, angleTo, CELL_DOOR, CELL_PROP, CELL_SOLID, lineOfSight, SIN } from '../engine/ray';
import { Rng } from '../engine/rng';
import { ST_ATTACK, ST_TELL, type Actor } from '../game/fps/actors';
import { DOOR_CLOSED, DOOR_CLOSING, DOOR_OPEN, KEY_GOLD, KEY_SILVER } from '../game/fps/doors';
import type { FpsGame } from '../game/fps/game';
import { aimWidth, bandDist, KNIFE_REACH } from '../game/fps/hitscan';
import { DIR_DX, DIR_DY, LOCK_GOLD, LOCK_SILVER } from '../game/fps/map';

/** Health / ammo thresholds (spec §10). */
export const BOT_LOW_HP = 40;
export const BOT_LOW_AMMO = 20;
/** Enemies farther than this are ignored (tiles). */
const FIGHT_RANGE = 24;
/** The largest turn per tick (angle units). */
const MAX_TURN = 96;
/** Walk forward while the heading error is below this (angle units, ~40°). */
const WALK_ARC = 460;
const STUCK_TICKS = 90;
const UNSTICK_TICKS = 20;

/** The boss fight: keep this band distance (tiles) — close enough for the 1..42 band, outside the 1..63 return fire. */
const BOSS_NEAR = 2.6;
const BOSS_FAR = 5;
/** In the boss fight, another enemy in sight this close is fought first (tiles). */
const ADDS_RANGE = 14;

const HEALTH = new Set(['first-aid', 'food', 'ration']);
const AMMO = new Set(['clip', 'clip-drop', 'mg', 'chaingun']);

const B = ACTION_BIT;

/** What the bot is doing (sim traces). */
export type BotGoal = 'idle' | 'fight' | 'health' | 'ammo' | 'gun' | 'key-gold' | 'key-silver' | 'switch' | 'boss' | 'explore';

export class FpsBot {
  private readonly game: () => FpsGame | null;
  private readonly rng: Rng;
  held = 0;
  turn = 0;
  goal: BotGoal = 'idle';
  goalX = -1;
  goalY = -1;
  /** Ticks seen (`actions` calls). */
  ticks = 0;
  private prevHeld = 0;
  private lastX = 0;
  private lastY = 0;
  private still = 0;
  private unstick = 0;
  private unstickDir = 0;
  /** The boss fight: the strafe side (+1 right, -1 left) for the current tell/burst. */
  private dodgeSide = 1;
  private dodging = false;
  // BFS scratch.
  private dist: Int32Array = new Int32Array(0);
  private prev: Int32Array = new Int32Array(0);
  private queue: Int32Array = new Int32Array(0);

  constructor(game: () => FpsGame | null, seed = 1) {
    this.game = game;
    this.rng = new Rng((seed ^ 0xb07f) >>> 0);
  }

  /** ScriptedSource `actions`: decide this tick, return the held mask. */
  actions(_tick: number): number {
    this.ticks++;
    this.think();
    return this.held;
  }

  /** ScriptedSource `analog`: the turn decided in `actions`. */
  analog(_tick: number, out: AnalogState): void {
    out.turn = this.turn;
  }

  private think(): void {
    const g = this.game();
    let held = 0;
    this.turn = 0;
    if (!g || g.state !== 'play' || g.unfolding) {
      this.prevHeld = 0;
      this.held = 0;
      this.goal = 'idle';
      return;
    }
    const p = g.player;
    held = this.fight(g);
    if (held < 0) held = this.navigate(g);
    // Unstick: no progress for a while while walking.
    const moved = Math.abs(p.x - this.lastX) + Math.abs(p.y - this.lastY);
    this.lastX = p.x;
    this.lastY = p.y;
    if ((held & B.forward) !== 0 && moved < 0.002) this.still++;
    else this.still = 0;
    if (this.still > STUCK_TICKS) {
      this.still = 0;
      this.unstick = UNSTICK_TICKS;
      this.unstickDir = this.rng.int(0, 1);
    }
    if (this.unstick > 0) {
      this.unstick--;
      held = (held & ~B.forward) | B.back | (this.unstickDir ? B.strafeLeft : B.strafeRight);
    }
    // Edges: "use" and the pistol need a fresh press.
    if ((held & B.use) !== 0 && (this.prevHeld & B.use) !== 0) held &= ~B.use;
    if ((held & B.fire) !== 0 && p.weapon === 1 && (this.prevHeld & B.fire) !== 0) held &= ~B.fire;
    this.prevHeld = held;
    this.held = held;
  }

  /** The fight: returns the held mask, or -1 when there is nothing to fight. */
  private fight(g: FpsGame): number {
    const p = g.player;
    const target = this.target(g);
    if (!target) return -1;
    const noAmmo = p.weapon === 0;
    const d = bandDist(target.x - p.x, target.y - p.y);
    // Out of ammo with an enemy far away: go get ammo first when there is any.
    if (noAmmo && d > 2.5 && this.findItem(g, AMMO) >= 0) return -1;
    // Low on ammo against the boss (not in his tell or burst): fetch a clip first, like a player.
    const boss0 = g.boss;
    if (boss0 && target === boss0.actor && p.ammo < BOT_LOW_AMMO && target.state !== ST_TELL && target.state !== ST_ATTACK && this.findItem(g, AMMO) >= 0) return -1;
    this.goal = 'fight';
    this.goalX = Math.floor(target.x);
    this.goalY = Math.floor(target.y);
    const want = angleTo(target.x - p.x, target.y - p.y);
    const delta = angDelta(p.angle, want);
    this.turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, delta));
    let held = B.run;
    const dist = Math.hypot(target.x - p.x, target.y - p.y);
    const perp = Math.abs(SIN[(delta + 4096) & 4095] * dist);
    const onTarget = perp < aimWidth(dist) * 0.8 && Math.abs(delta) < 1024;
    const boss = g.boss;
    if (boss && target === boss.actor && !noAmmo) return held | this.bossTactic(g, boss.actor, d, delta, onTarget, boss.breakT >= 0);
    if (noAmmo) {
      if (d > KNIFE_REACH - 0.2 && Math.abs(delta) < WALK_ARC) held |= B.forward;
      if (onTarget && d <= KNIFE_REACH) held |= B.fire;
    } else if (onTarget) held |= B.fire;
    return held;
  }

  /**
   * The boss with a gun up (a player's tactic, docs/api/fps.md §5.6): close to 2.6–5 tiles (the
   * 1..42 band; from across the arena most bullets miss), run sideways through his tell and
   * burst (running lowers his hit chance), and hold fire while the suit breaks (invulnerable).
   */
  private bossTactic(g: FpsGame, a: Actor, d: number, delta: number, onTarget: boolean, breaking: boolean): number {
    let held = 0;
    if (Math.abs(delta) < WALK_ARC) {
      if (d > BOSS_FAR) held |= B.forward;
      else if (d < BOSS_NEAR) held |= B.back;
    }
    const threat = !breaking && (a.state === ST_TELL || a.state === ST_ATTACK);
    if (threat) {
      if (!this.dodging) {
        this.dodging = true;
        this.dodgeSide = this.rng.int(0, 1) ? 1 : -1;
      }
      // Blocked sideways (a pillar, a wall): try the other side.
      const p = g.player;
      if (Math.abs(p.x - this.lastX) + Math.abs(p.y - this.lastY) < 0.01 && this.ticks % 8 === 0) this.dodgeSide = -this.dodgeSide;
      held |= this.dodgeSide > 0 ? B.strafeRight : B.strafeLeft;
    } else this.dodging = false;
    if (onTarget && !breaking) held |= B.fire;
    return held;
  }

  /**
   * The nearest living enemy in line of sight, or null. In the boss fight the adds come first (a
   * player's tactic: they die in a few bullets and hit hard): any other enemy in sight within
   * ADDS_RANGE tiles beats the boss.
   */
  private target(g: FpsGame): Actor | null {
    const p = g.player;
    const pool = g.actors;
    const bossActor = g.boss?.actor ?? null;
    let best: Actor | null = null;
    let bestD = FIGHT_RANGE;
    let add: Actor | null = null;
    let addD = ADDS_RANGE;
    for (let i = 0; i < pool.count; i++) {
      const a = pool.actors[i];
      if (!a.alive) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d >= bestD && (a === bossActor || d >= addD)) continue;
      if (!lineOfSight(g.grid, g.map.doors, g.pushes.push, p.x, p.y, a.x, a.y)) continue;
      if (bossActor && a !== bossActor && d < addD) {
        add = a;
        addD = d;
      }
      if (d < bestD) {
        best = a;
        bestD = d;
      }
    }
    return add ?? best;
  }

  /** Navigate to the current goal: returns the held mask. */
  private navigate(g: FpsGame): number {
    const p = g.player;
    const grid = g.grid;
    const w = grid.w;
    this.bfs(g);
    const goalCell = this.pickGoal(g);
    if (goalCell < 0) {
      this.goal = 'idle';
      return 0;
    }
    this.goalX = goalCell % w;
    this.goalY = (goalCell / w) | 0;
    const here = Math.floor(p.y) * w + Math.floor(p.x);
    if (goalCell === here) return this.atGoal(g);
    // The next cell on the path.
    let next = goalCell;
    while (this.prev[next] !== here && this.prev[next] >= 0) next = this.prev[next];
    const nx = next % w;
    const ny = (next / w) | 0;
    // A closed door on the path: face it and use it.
    if ((grid.flags[next] & CELL_DOOR) !== 0) {
      const di = grid.door[next];
      const st = g.doors.state[di];
      if (st === DOOR_CLOSED || st === DOOR_CLOSING) return this.faceAndUse(g, nx, ny);
      if (st !== DOOR_OPEN) return this.steer(g, nx + 0.5, ny + 0.5, false);
    }
    return this.steer(g, nx + 0.5, ny + 0.5, true);
  }

  /** Turn toward (x, y); walk (run) when roughly facing it. */
  private steer(g: FpsGame, x: number, y: number, walk: boolean): number {
    const p = g.player;
    const delta = angDelta(p.angle, angleTo(x - p.x, y - p.y));
    this.turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, delta));
    let held = 0;
    if (walk && Math.abs(delta) < WALK_ARC) held |= B.forward | B.run;
    return held;
  }

  /** Face the neighbour cell (x, y) in its cardinal direction and press use. */
  private faceAndUse(g: FpsGame, x: number, y: number): number {
    const p = g.player;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    let card = -1;
    for (let k = 0; k < 4; k++) if (cx + DIR_DX[k] === x && cy + DIR_DY[k] === y) card = k;
    if (card < 0) return this.steer(g, x + 0.5, y + 0.5, true);
    const want = card * 1024;
    const delta = angDelta(p.angle, want);
    this.turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, delta));
    // Centre in the cell a little so the door jambs do not catch the box.
    let held = 0;
    const ox = cx + 0.5 - p.x;
    const oy = cy + 0.5 - p.y;
    if (Math.abs(delta) < 64) {
      held |= B.use;
      // Drift toward the cell centre across the facing (strafe).
      const side = card === 0 || card === 2 ? oy : ox;
      const sgn = card === 0 || card === 3 ? 1 : -1;
      if (Math.abs(side) > 0.12) held |= side * sgn > 0 ? B.strafeRight : B.strafeLeft;
    }
    return held;
  }

  /** At the goal cell: use the switch / just wait (items are picked up by walking in). */
  private atGoal(g: FpsGame): number {
    if (this.goal === 'switch') {
      const p = g.player;
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      for (const s of g.map.switches) {
        if (Math.abs(s.x - cx) + Math.abs(s.y - cy) === 1) return this.faceAndUse(g, s.x, s.y);
      }
    }
    return this.steer(g, Math.floor(g.player.x) + 0.5, Math.floor(g.player.y) + 0.5, true);
  }

  /** The goal cell for this tick (reachable in the last BFS), or -1. */
  private pickGoal(g: FpsGame): number {
    const p = g.player;
    if (p.hp < BOT_LOW_HP) {
      const c = this.findItem(g, HEALTH);
      if (c >= 0) return this.setGoal('health', c);
    }
    if (p.ammo < BOT_LOW_AMMO || p.weapon === 0) {
      const c = this.findItem(g, AMMO);
      if (c >= 0) return this.setGoal('ammo', c);
    }
    const gun = this.findGun(g);
    if (gun >= 0) return this.setGoal('gun', gun);
    if ((p.keys & KEY_GOLD) === 0) {
      const c = this.findItem(g, KEYS_GOLD);
      if (c >= 0) return this.setGoal('key-gold', c);
    }
    if ((p.keys & KEY_SILVER) === 0) {
      const c = this.findItem(g, KEYS_SILVER);
      if (c >= 0) return this.setGoal('key-silver', c);
    }
    const boss = g.boss;
    // Before the boss wakes: fill up on ammo first.
    if (boss && !boss.awake && p.ammo < 99) {
      const c = this.findItem(g, AMMO);
      if (c >= 0) return this.setGoal('ammo', c);
    }
    if (boss && boss.actor.alive) {
      // The nearest reachable cell next to him (his own cell is never free).
      const a = boss.actor;
      const c = this.nearestReached(g, Math.floor(a.x), Math.floor(a.y));
      if (c >= 0) return this.setGoal('boss', c);
    }
    const w = g.grid.w;
    let best = -1;
    for (const s of g.map.switches) {
      for (let k = 0; k < 4; k++) {
        const x = s.x + DIR_DX[k];
        const y = s.y + DIR_DY[k];
        if (!g.grid.inside(x, y)) continue;
        const c = y * w + x;
        if (this.dist[c] >= 0 && (best < 0 || this.dist[c] < this.dist[best])) best = c;
      }
    }
    if (best >= 0) return this.setGoal('switch', best);
    // Anything left: an untaken item, else stay.
    const any = this.findItem(g, null);
    if (any >= 0) return this.setGoal('explore', any);
    return -1;
  }

  private setGoal(goal: BotGoal, cell: number): number {
    this.goal = goal;
    return cell;
  }

  /** The nearest reached cell (BFS distance) holding an untaken item of `ids` (null = any). */
  private findItem(g: FpsGame, ids: ReadonlySet<string> | null): number {
    const it = g.items;
    const w = g.grid.w;
    let best = -1;
    for (let k = 0; k < it.count; k++) {
      if (it.taken[k] || (ids && !ids.has(it.id[k]))) continue;
      if (!ids && (it.id[k] === 'blood-pool' || !this.wants(g, it.id[k]))) continue;
      const c = it.y[k] * w + it.x[k];
      if (this.dist[c] < 0) continue;
      if (best < 0 || this.dist[c] < this.dist[best]) best = c;
    }
    return best;
  }

  /** A gun not owned yet, reachable. */
  private findGun(g: FpsGame): number {
    const p = g.player;
    const it = g.items;
    const w = g.grid.w;
    let best = -1;
    for (let k = 0; k < it.count; k++) {
      if (it.taken[k]) continue;
      const id = it.id[k];
      const bit = id === 'mg' ? 2 : id === 'chaingun' ? 3 : -1;
      if (bit < 0 || ((p.weapons >> bit) & 1) === 1) continue;
      const c = it.y[k] * w + it.x[k];
      if (this.dist[c] < 0) continue;
      if (best < 0 || this.dist[c] < this.dist[best]) best = c;
    }
    return best;
  }

  /** Would picking item `id` up do anything now (a refused item would hold the bot there)? */
  private wants(g: FpsGame, id: string): boolean {
    const p = g.player;
    if (HEALTH.has(id)) return p.hp < 100;
    if (AMMO.has(id)) return p.ammo < 99;
    return true;
  }

  /** The reached cell nearest (BFS order) to cell (x, y) within 2 cells, or -1. */
  private nearestReached(g: FpsGame, x: number, y: number): number {
    const w = g.grid.w;
    let best = -1;
    let bestD = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (!g.grid.inside(cx, cy)) continue;
        const c = cy * w + cx;
        if (this.dist[c] < 0) continue;
        const d = Math.abs(dx) + Math.abs(dy) + this.dist[c] * 0.001;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    return best;
  }

  /** BFS from the player's cell: `dist` (-1 = not reached) and `prev`. */
  private bfs(g: FpsGame): void {
    const grid = g.grid;
    const n = grid.w * grid.h;
    if (this.dist.length !== n) {
      this.dist = new Int32Array(n);
      this.prev = new Int32Array(n);
      this.queue = new Int32Array(n);
    }
    const dist = this.dist;
    dist.fill(-1);
    const keys = g.player.keys;
    const w = grid.w;
    const p = g.player;
    const start = Math.floor(p.y) * w + Math.floor(p.x);
    let head = 0;
    let tail = 0;
    this.queue[tail++] = start;
    dist[start] = 0;
    this.prev[start] = -1;
    while (head < tail) {
      const i = this.queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DIR_DX[k];
        const ny = y + DIR_DY[k];
        if (!grid.inside(nx, ny)) continue;
        const j = ny * w + nx;
        if (dist[j] >= 0) continue;
        const f = grid.flags[j];
        if ((f & CELL_DOOR) !== 0) {
          const lock = g.doors.lock[grid.door[j]];
          if (lock === LOCK_GOLD && (keys & KEY_GOLD) === 0) continue;
          if (lock === LOCK_SILVER && (keys & KEY_SILVER) === 0) continue;
        } else if ((f & (CELL_SOLID | CELL_PROP)) !== 0) continue;
        dist[j] = dist[i] + 1;
        this.prev[j] = i;
        this.queue[tail++] = j;
      }
    }
  }
}

const KEYS_GOLD: ReadonlySet<string> = new Set(['key-gold']);
const KEYS_SILVER: ReadonlySet<string> = new Set(['key-silver']);
