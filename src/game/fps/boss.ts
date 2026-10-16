/**
 * MechaHitler (docs/design/fps.md §7; docs/api/fps.md §5): the boss of floor 2. Phase 1 is the
 * suit "Mecha Hofmans" (the user's face, the Dutch taunts 1–3), phase 2 the man on foot. The boss
 * is one pooled actor of type 'boss'; this module drives it through the `ActorPool.bossThink` /
 * `bossDamage` hooks (actors.ts) and never through the enemy state table.
 *
 * - Wake: stands (ambush) until he sees the player (or is hit): taunt 1, music `fps-boss`, the bar.
 * - Pattern: chase → tell → burst → recover → chase. The attack starts after ≥ 45 ticks of chase
 *   with line of sight (phase 2: 30), each tick with chance 24/256; always at 120 ticks. Without
 *   line of sight he holds; after 180 ticks he walks to the last place he saw the player.
 *   He never leaves the arena (the leash: his room, without its one-cell pockets).
 * - Events: suit 75 % → taunt 2; 50 % → taunt 3 + reinforcements (2 / 3 / 4 SS from the spawn
 *   bays, not counted for kill %); 0 → the break (120 ticks, invulnerable, act 5–8, 25,000), the
 *   wreck (a solid prop), he jumps out next to it toward the player, taunt 4, two clips spill.
 *   On foot 50 % → taunt 5; 0 → 50,000 and the death-cam (FpsGame.startDeathCam, §7.3).
 *
 * Deterministic (game rng only); no allocations per tick (the path search reuses its arrays).
 */
import { angleTo, angDelta, CELL_DOOR, CELL_PROP, CELL_SOLID } from '../../engine/ray';
import { BOSS_TAUNTS } from '../content/fps/lines';
import type { Difficulty } from '../session';
import {
  ACTOR_TYPES,
  BOSS_FOOT,
  DIFF_INDEX,
  DIR8_DX,
  DIR8_DY,
  ST_ATTACK,
  ST_CHASE,
  ST_DEAD,
  ST_DIE,
  ST_PAIN,
  ST_RECOVER,
  ST_STAND,
  ST_TELL,
  type Actor,
} from './actors';
import { canSee, canStep, hasLos, type ShotEvent } from './ai';
import type { FpsGame } from './game';
import { bandDist, bossDamage, enemyHitChance, RUN_MOVE, VIEW_HALF } from './hitscan';

/** HP per phase and difficulty (E, N, H; spec §7.2). */
export const BOSS_HP: Readonly<Record<1 | 2, readonly [number, number, number]>> = {
  1: [900, 1100, 1300],
  2: [500, 700, 900],
};
/** Tell ticks: phase 1 (30; 24 below 25 % suit HP), phase 2 (24). */
export const BOSS_TELL_1 = 30;
export const BOSS_TELL_1_LOW = 24;
export const BOSS_TELL_2 = 24;
/** Ticks between the shots of a burst. */
export const BOSS_SHOT_GAP = 4;
/** Chase ticks with line of sight before an attack may start (phase 1 / 2), the roll, the cap. */
export const BOSS_MIN_CHASE_1 = 45;
export const BOSS_MIN_CHASE_2 = 30;
export const BOSS_ATTACK_ROLL = 24;
export const BOSS_ATTACK_CAP = 120;
/** Without line of sight this long, he walks to the last place he saw the player. */
export const BOSS_LOST_TICKS = 180;
/** He stops walking toward the player inside this distance (tiles, with line of sight). */
export const BOSS_KEEP_DIST = 2;
/** The suit breaks: 120 ticks, 4 frames (act 5–8). */
export const BREAK_TICKS = 120;
/** A reinforcement point this close to the player (Chebyshev, tiles) stays empty. */
export const SPAWN_CLEAR = 3;
export const BREAK_FRAME = 5;
/** The death-cam (§7.3): 150 slow ticks (one step per 3), 60 hold, 30 fade. */
export const DEATHCAM_SLOW = 150;
export const DEATHCAM_HOLD = 60;
export const DEATHCAM_FADE = 30;
export const DEATHCAM_STEP = 3;
/** Taunt subtitles stay at least this long (§7.4). */
export const SUBTITLE_TICKS = 150;

/** Boss phases on `actor.phase`: 1 suit, 2 on foot. */
export type BossPhase = 1 | 2;

const shotEv: ShotEvent = { actor: null as unknown as Actor, damage: 0, tell: 0, tick: 0 };

/** One boss of one floor attempt (FpsGame makes a new one on every load). */
export class FpsBoss {
  readonly g: FpsGame;
  readonly actor: Actor;
  phase: BossPhase = 1;
  awake = false;
  /** Breaking out of the suit (invulnerable) — ticks so far, -1 = not breaking. */
  breakT = -1;
  /** Ticks without line of sight while chasing. */
  lost = 0;
  /** Taunts already given (bit n = taunt n + 1). */
  taunts = 0;
  reinforced = false;
  /** The wreck cell (-1 = none yet). */
  wreckX = -1;
  wreckY = -1;
  /** Phase-2 pain ticks left (a short flinch; no tell cancel). */
  pain = 0;
  /** The leash: 1 = he may stand on the cell. */
  readonly leash: Uint8Array;
  private readonly w: number;
  private readonly h: number;
  // Path search scratch (reused).
  private readonly prev: Int32Array;
  private readonly queue: Int32Array;
  private readonly mark: Uint32Array;
  private stamp = 0;

  constructor(g: FpsGame, actor: Actor) {
    this.g = g;
    this.actor = actor;
    this.w = g.grid.w;
    this.h = g.grid.h;
    const n = this.w * this.h;
    this.prev = new Int32Array(n);
    this.queue = new Int32Array(n);
    this.mark = new Uint32Array(n);
    this.leash = leashOf(g, actor.cx, actor.cy);
    actor.phase = 1;
    actor.ambush = true;
    const bar = g.bossBar;
    bar.visible = false;
    bar.phase = 1;
    bar.frac = 1;
  }

  get diffIndex(): number {
    return DIFF_INDEX[this.g.difficulty];
  }

  /** The tell of the current phase (§7.2). */
  get tellTicks(): number {
    const a = this.actor;
    if (this.phase === 2) return BOSS_TELL_2;
    return a.hp * 4 < a.maxHp ? BOSS_TELL_1_LOW : BOSS_TELL_1;
  }

  // --------------------------------------------------------------------------------- think

  /** `ActorPool.bossThink`: one tick of the boss (true = handled). */
  think(): boolean {
    const g = this.g;
    const a = this.actor;
    if (a.state >= ST_DIE) return true; // the death-cam steps the die frames (slowStep)
    if (this.breakT >= 0) {
      this.breakTick();
      return true;
    }
    if (!this.awake) {
      if (canSee(g, a)) this.wake();
      return true;
    }
    this.updateBar();
    if (this.pain > 0 && --this.pain === 0 && a.state === ST_PAIN) {
      a.state = ST_CHASE;
      a.timer = 0;
    }
    switch (a.state) {
      case ST_CHASE:
        this.chase();
        break;
      case ST_TELL:
        a.angle = angleTo(g.player.x - a.x, g.player.y - a.y);
        if (a.timer >= this.tellTicks) {
          a.tellDone = a.timer;
          a.state = ST_ATTACK;
          a.timer = 0;
          a.shots = a.def.burst;
          this.fire();
        }
        break;
      case ST_ATTACK:
        a.angle = angleTo(g.player.x - a.x, g.player.y - a.y);
        if (a.shots > 0 && a.timer % BOSS_SHOT_GAP === 0) this.fire();
        if (a.shots === 0 && a.timer >= a.def.burst * BOSS_SHOT_GAP) {
          a.state = ST_RECOVER;
          a.timer = 0;
        }
        break;
      case ST_RECOVER:
        // The safe window: the suit vents steam (sparks), the man reloads.
        if (a.timer >= a.def.recover) {
          a.state = ST_CHASE;
          a.timer = 0;
        }
        break;
      default:
        break;
    }
    return true;
  }

  /** He sees the player (or was hit): taunt 1, the boss music, the bar. */
  wake(): void {
    if (this.awake) return;
    const g = this.g;
    const a = this.actor;
    this.awake = true;
    a.ambush = false;
    a.react = 0;
    a.state = ST_CHASE;
    a.timer = 0;
    a.chaseSight = 0;
    a.seenX = Math.floor(g.player.x);
    a.seenY = Math.floor(g.player.y);
    a.angle = angleTo(g.player.x - a.x, g.player.y - a.y);
    g.sound.at('fps/boss/horn', a.x, a.y);
    this.taunt(0);
    g.audio.music('fps-boss', { fadeTicks: 30 });
    g.bossBar.visible = true;
    this.updateBar();
    g.actorWoke(a);
  }

  private chase(): void {
    const g = this.g;
    const a = this.actor;
    const p = g.player;
    const sees = hasLos(g, a);
    if (sees) {
      a.seenX = Math.floor(p.x);
      a.seenY = Math.floor(p.y);
      a.chaseSight++;
      this.lost = 0;
      a.angle = a.dir >= 0 ? a.angle : angleTo(p.x - a.x, p.y - a.y);
      // The attack start (§7.2): no tokens; the counter pauses while sight is lost.
      const min = this.phase === 1 ? BOSS_MIN_CHASE_1 : BOSS_MIN_CHASE_2;
      if (g.state === 'play' && a.chaseSight >= min && (a.chaseSight >= BOSS_ATTACK_CAP || g.rng.int(0, 255) < BOSS_ATTACK_ROLL)) {
        this.startTell();
        return;
      }
    } else this.lost++;
    // Move: toward the player while he sees him (not closer than 2 tiles); without sight he holds,
    // then walks to the last place he saw the player.
    let gx = -1;
    let gy = -1;
    if (sees) {
      if (bandDist(p.x - a.x, p.y - a.y) > BOSS_KEEP_DIST) {
        gx = Math.floor(p.x);
        gy = Math.floor(p.y);
      }
    } else if (this.lost >= BOSS_LOST_TICKS) {
      gx = a.seenX;
      gy = a.seenY;
    }
    if (a.dir >= 0 || gx >= 0) this.walk(gx, gy);
  }

  private startTell(): void {
    const g = this.g;
    const a = this.actor;
    a.chaseSight = 0;
    a.state = ST_TELL;
    a.timer = 0;
    a.tellDone = 0;
    a.angle = angleTo(g.player.x - a.x, g.player.y - a.y);
    g.sound.at(a.def.tellSfx, a.x, a.y);
  }

  /** One bullet of the burst (§7.2: the enemy formula with base 208 / 112, the boss damage). */
  private fire(): void {
    const g = this.g;
    const a = this.actor;
    const p = g.player;
    a.shots--;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const d = bandDist(dx, dy);
    g.sound.at(a.def.shotSfx, a.x, a.y);
    let dmg = 0;
    if (hasLos(g, a)) {
      const rel = angDelta(p.angle, angleTo(-dx, -dy));
      const inView = rel >= -VIEW_HALF && rel <= VIEW_HALF;
      const chance = enemyHitChance(d, g.playerMove >= RUN_MOVE, inView, a.def.hitBase, a.def.hitBaseRun);
      if (g.rng.int(0, 255) < chance) dmg = bossDamage(g.rng, d, g.difficulty);
    }
    if (dmg > 0) g.hurt(dmg, a.x, a.y);
    const hook = g.actors.onShot;
    if (hook) {
      shotEv.actor = a;
      shotEv.damage = dmg;
      shotEv.tell = a.tellDone;
      shotEv.tick = g.tick;
      hook(shotEv);
    }
  }

  /**
   * Debug F4 (spec §1.11): phase 1 → the suit breaks (as a fatal hit: the 50 % events, the break),
   * phase 2 → he dies (the death-cam). Nothing while the suit breaks or he is dying.
   */
  debugSkip(): void {
    const a = this.actor;
    if (this.breakT >= 0 || a.state >= ST_DIE || a.hp <= 0) return;
    if (!this.awake) this.wake();
    this.damage(a.hp);
  }

  // --------------------------------------------------------------------------------- damage

  /** `ActorPool.bossDamage`: a player hit (no × 2 for the boss). Returns the damage dealt. */
  damage(dmg: number): number {
    const g = this.g;
    const a = this.actor;
    a.spurt = 9;
    if (this.breakT >= 0 || a.state >= ST_DIE) return 0;
    if (!this.awake) this.wake();
    a.hp -= dmg;
    if (this.phase === 1) {
      // Sparks only (a.spurt): the suit takes no pain.
      if (a.hp * 4 <= a.maxHp * 3) this.taunt(1);
      if (a.hp * 2 <= a.maxHp) {
        this.taunt(2);
        this.reinforce();
      }
      if (a.hp <= 0) this.startBreak();
    } else {
      g.sound.at('fps/enemy/hurt', a.x, a.y);
      if (a.hp * 2 <= a.maxHp) this.taunt(4);
      if (a.hp <= 0) this.die();
      else if (a.state === ST_CHASE && a.dir < 0) {
        // Pain (6 ticks) only interrupts the chase: it never cancels a tell (§7.2).
        a.state = ST_PAIN;
        a.timer = 0;
        this.pain = BOSS_FOOT.pain;
      }
    }
    this.updateBar();
    return dmg;
  }

  private updateBar(): void {
    const a = this.actor;
    const bar = this.g.bossBar;
    bar.phase = this.phase;
    bar.frac = a.maxHp > 0 ? Math.max(0, a.hp) / a.maxHp : 0;
  }

  /** Taunt n (0-based) once: the voice and its subtitle (§7.4). */
  taunt(n: number): void {
    if ((this.taunts >> n) & 1) return;
    this.taunts |= 1 << n;
    const line = BOSS_TAUNTS[n];
    if (!line) return;
    this.g.speak(line, line.meaning, subtitleTicks(line.text));
  }

  /**
   * 50 % suit HP: the bay doors open and 2 / 3 / 4 SS come out (not counted for kill %). A spawn
   * point within SPAWN_CLEAR cells of the player stays empty (no spawn behind the player).
   */
  reinforce(): void {
    if (this.reinforced) return;
    this.reinforced = true;
    const g = this.g;
    const rank = DIFF_INDEX[g.difficulty];
    for (const s of g.map.spawns) {
      if (DIFF_INDEX[s.minDiff] > rank) continue;
      // Never spawn at the player's back: a point within 3 cells of the player (in its bay) stays empty.
      if (Math.max(Math.abs(g.player.x - s.x - 0.5), Math.abs(g.player.y - s.y - 0.5)) < SPAWN_CLEAR) continue;
      const cell = this.freeCellNear(s.x, s.y, 1, false);
      if (cell < 0) continue;
      const x = cell % this.w;
      const y = (cell / this.w) | 0;
      const ss = g.actors.spawn('ss', x, y, angleTo(g.player.x - x - 0.5, g.player.y - y - 0.5), g.difficulty, false);
      if (!ss) continue;
      ss.state = ST_CHASE;
      ss.timer = 0;
      ss.seenX = Math.floor(g.player.x);
      ss.seenY = Math.floor(g.player.y);
      // The bay doors (within 3 cells of a spawn point) open.
      for (let d = 0; d < g.doors.count; d++) {
        const dx = g.map.doors.x[d] - s.x;
        const dy = g.map.doors.y[d] - s.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 3) g.doors.open(d);
      }
    }
    g.sound.play('fps/boss/horn');
  }

  // --------------------------------------------------------------------------------- break

  private startBreak(): void {
    const g = this.g;
    const a = this.actor;
    a.hp = 0;
    this.breakT = 0;
    a.state = ST_PAIN;
    a.timer = 0;
    a.forceFrame = BREAK_FRAME;
    g.sound.at('fps/boss/break', a.x, a.y);
    g.addScore(ACTOR_TYPES.boss.score);
    // Finish the step in progress: the wreck stands on a cell centre.
    this.updateBar();
  }

  private breakTick(): void {
    const a = this.actor;
    this.breakT++;
    a.forceFrame = BREAK_FRAME + Math.min(3, Math.floor((this.breakT * 4) / BREAK_TICKS));
    if ((this.breakT & 15) === 0) a.spurt = 6;
    if (this.breakT >= BREAK_TICKS) this.endBreak();
  }

  /** The wreck appears; he jumps out next to it, nearest to the player; phase 2 starts. */
  private endBreak(): void {
    const g = this.g;
    const a = this.actor;
    const pool = g.actors;
    // The wreck cell: the cell under his centre, unless the player's box reaches into it.
    let wx = Math.floor(a.x);
    let wy = Math.floor(a.y);
    if (this.playerIn(wx, wy) && !this.playerIn(a.cx, a.cy)) {
      wx = a.cx;
      wy = a.cy;
    } else if (this.playerIn(wx, wy) && !this.playerIn(a.tx, a.ty)) {
      wx = a.tx;
      wy = a.ty;
    }
    pool.releaseAll(a);
    this.wreckX = wx;
    this.wreckY = wy;
    g.addProp('fps/boss/wreck', wx, wy, true);
    // An item under the wreck moves to a free cell beside it.
    const it = g.items;
    for (let k = 0; k < it.count; k++) {
      if (it.taken[k] || it.x[k] !== wx || it.y[k] !== wy) continue;
      const c = this.freeCellNear(wx, wy, 2, true);
      if (c >= 0) {
        it.x[k] = c % this.w;
        it.y[k] = (c / this.w) | 0;
      }
    }
    // He jumps out on the free cell next to the wreck nearest to the player.
    const p = g.player;
    let best = -1;
    let bestD = Infinity;
    for (let r = 1; r <= 3 && best < 0; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = wx + dx;
          const y = wy + dy;
          if (!this.standable(x, y) || this.playerIn(x, y, BOSS_FOOT.radius)) continue;
          const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
          if (d < bestD) {
            bestD = d;
            best = y * this.w + x;
          }
        }
      }
    }
    const nx = best >= 0 ? best % this.w : wx;
    const ny = best >= 0 ? (best / this.w) | 0 : wy;
    a.x = nx + 0.5;
    a.y = ny + 0.5;
    a.cx = a.tx = nx;
    a.cy = a.ty = ny;
    a.dir = -1;
    pool.claim(a, nx, ny);
    // Phase 2.
    this.phase = 2;
    this.breakT = -1;
    a.phase = 2;
    a.def = BOSS_FOOT;
    a.hp = a.maxHp = BOSS_HP[2][this.diffIndex];
    a.state = ST_CHASE;
    a.timer = 0;
    a.chaseSight = 0;
    a.forceFrame = -1;
    a.angle = angleTo(p.x - a.x, p.y - a.y);
    this.lost = 0;
    this.taunt(3);
    // Two clips spill onto the two free cells next to the wreck farthest from him.
    for (let n = 0; n < 2; n++) {
      let far = -1;
      let farD = -1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = wx + dx;
          const y = wy + dy;
          if ((dx === 0 && dy === 0) || !this.dropFree(x, y) || (x === nx && y === ny)) continue;
          const d = Math.hypot(x - nx, y - ny);
          if (d > farD) {
            farD = d;
            far = y * this.w + x;
          }
        }
      }
      if (far < 0) break;
      g.dropItem('clip', far % this.w, (far / this.w) | 0);
    }
    this.updateBar();
  }

  /** On foot at 0 HP: 50,000, the death line, the death-cam. */
  private die(): void {
    const g = this.g;
    const a = this.actor;
    const pool = g.actors;
    a.hp = 0;
    pool.releaseAll(a);
    a.state = ST_DIE;
    a.timer = 0;
    a.dir = -1;
    a.pool = 2;
    a.spurt = 9;
    if (a.placed) pool.kills++;
    g.addScore(BOSS_FOOT.score);
    g.sound.at('fps/blood', a.x, a.y);
    this.taunt(5);
    g.startDeathCam(a);
  }

  /** One slow-motion step of the death-cam: the die frames, the fall sound at the last one. */
  slowStep(): void {
    const a = this.actor;
    if (a.state === ST_DEAD) return;
    a.timer++;
    const def = a.def;
    if (a.state === ST_DIE) {
      if (a.timer === (def.frames.dieCount - 1) * def.dieTicks) this.g.sound.at('fps/boss/fall', a.x, a.y);
      if (a.timer >= def.frames.dieCount * def.dieTicks) {
        a.state = ST_DEAD;
        a.timer = 0;
      }
    }
  }

  // --------------------------------------------------------------------------------- movement

  /**
   * Walk toward cell (gx, gy) (-1 = only finish the step in progress) over the leash, tile
   * centre to tile centre (8 directions, a diagonal needs both side cells free).
   */
  private walk(gx: number, gy: number): void {
    const g = this.g;
    const a = this.actor;
    const pool = g.actors;
    if (a.dir < 0) {
      if (gx < 0) return;
      const dir = this.nextDir(gx, gy);
      if (dir < 0) return;
      a.dir = dir;
      a.tx = a.cx + DIR8_DX[dir];
      a.ty = a.cy + DIR8_DY[dir];
      pool.claim(a, a.tx, a.ty);
      a.angle = dir << 9;
    }
    const speed = this.phase === 1 ? ACTOR_TYPES.boss.chase : BOSS_FOOT.chase;
    const tx = a.tx + 0.5;
    const ty = a.ty + 0.5;
    const dx = tx - a.x;
    const dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const step = speed < dist ? speed : dist;
    const nx = a.x + (dx / (dist || 1)) * step;
    const ny = a.y + (dy / (dist || 1)) * step;
    const pb = g.player.box;
    const r = a.def.radius + pb.r;
    if (Math.abs(nx - pb.x) < r && Math.abs(ny - pb.y) < r) return; // the player stands in the way
    a.x = nx;
    a.y = ny;
    a.walked += step;
    if (step >= dist) {
      a.x = tx;
      a.y = ty;
      pool.release(a, a.cx, a.cy);
      a.cx = a.tx;
      a.cy = a.ty;
      a.dir = -1;
      if (this.phase === 1) g.sound.at('fps/boss/step', a.x, a.y);
    }
  }

  /** The first direction of a shortest leash path toward (gx, gy) (or the leash cell nearest to it). */
  private nextDir(gx: number, gy: number): number {
    const g = this.g;
    const a = this.actor;
    const w = this.w;
    const start = a.cy * w + a.cx;
    const stamp = ++this.stamp;
    const mark = this.mark;
    const prev = this.prev;
    const q = this.queue;
    let head = 0;
    let tail = 0;
    q[tail++] = start;
    mark[start] = stamp;
    prev[start] = -1;
    let best = start;
    let bestD = Math.hypot(a.cx - gx, a.cy - gy);
    while (head < tail) {
      const i = q[head++];
      const x = i % w;
      const y = (i / w) | 0;
      const d = Math.hypot(x - gx, y - gy);
      if (d < bestD) {
        bestD = d;
        best = i;
        if (d === 0) break;
      }
      for (let k = 0; k < 8; k++) {
        const nx = x + DIR8_DX[k];
        const ny = y + DIR8_DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
        const j = ny * w + nx;
        if (mark[j] === stamp || !this.leash[j]) continue;
        if ((k & 1) === 1 && (!this.leash[y * w + nx] || !this.leash[ny * w + x])) continue;
        mark[j] = stamp;
        prev[j] = i;
        q[tail++] = j;
      }
    }
    if (best === start) return -1;
    let step = best;
    while (prev[step] !== start && prev[step] >= 0) step = prev[step];
    const dx = (step % w) - a.cx;
    const dy = ((step / w) | 0) - a.cy;
    for (let k = 0; k < 8; k++) {
      if (DIR8_DX[k] === dx && DIR8_DY[k] === dy) return canStep(g, a, k) ? k : -1;
    }
    return -1;
  }

  /** The player's box (or a box of half-size `r` at the player) reaches into cell (x, y). */
  private playerIn(x: number, y: number, extra = 0): boolean {
    const b = this.g.player.box;
    const r = b.r + extra;
    return b.x + r > x && b.x - r < x + 1 && b.y + r > y && b.y - r < y + 1;
  }

  /** Floor without wall, door, prop or actor (he may stand there). */
  private standable(x: number, y: number): boolean {
    const g = this.g;
    if (!g.grid.inside(x, y)) return false;
    if ((g.grid.flags[g.grid.idx(x, y)] & (CELL_SOLID | CELL_PROP | CELL_DOOR)) !== 0) return false;
    return !g.actors.cellTaken(x, y);
  }

  /** A free cell for a dropped item: floor, no item, no prop, no player. */
  private dropFree(x: number, y: number): boolean {
    const g = this.g;
    if (!g.grid.inside(x, y)) return false;
    if ((g.grid.flags[g.grid.idx(x, y)] & (CELL_SOLID | CELL_PROP | CELL_DOOR)) !== 0) return false;
    return !g.items.at(x, y);
  }

  /** A free cell within `r` of (x, y) (the cell itself first); -1 = none. */
  private freeCellNear(x: number, y: number, r: number, forItem: boolean): number {
    for (let k = 0; k <= r; k++) {
      for (let dy = -k; dy <= k; dy++) {
        for (let dx = -k; dx <= k; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
          const cx = x + dx;
          const cy = y + dy;
          const ok = forItem ? this.dropFree(cx, cy) && !(cx === this.wreckX && cy === this.wreckY) : this.standable(cx, cy) && !this.playerIn(cx, cy, 0.4);
          if (ok) return cy * this.w + cx;
        }
      }
    }
    return -1;
  }
}

/** Subtitle ticks of a line: 150, or about the clip length + 30 (≈ 5 ticks per letter). */
export function subtitleTicks(text: string): number {
  return Math.max(SUBTITLE_TICKS, 30 + text.length * 5);
}

/**
 * The leash (§6.2): the boss's room (floor cells linked without doors) minus its one-cell pockets
 * (a cell is kept when it has floor on both sides along x or along y: no alcoves, no corners).
 */
export function leashOf(g: FpsGame, x0: number, y0: number): Uint8Array {
  const grid = g.grid;
  const w = grid.w;
  const h = grid.h;
  const room = new Uint8Array(w * h);
  const q = [y0 * w + x0];
  room[q[0]] = 1;
  const open = (x: number, y: number): boolean => grid.inside(x, y) && (grid.flags[grid.idx(x, y)] & (CELL_SOLID | CELL_DOOR)) === 0;
  while (q.length) {
    const i = q.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    for (let k = 0; k < 8; k += 2) {
      const nx = x + DIR8_DX[k];
      const ny = y + DIR8_DY[k];
      if (!open(nx, ny)) continue;
      const j = ny * w + nx;
      if (room[j]) continue;
      room[j] = 1;
      q.push(j);
    }
  }
  const leash = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!room[i] || (grid.flags[i] & CELL_PROP) !== 0) continue;
      const alongX = open(x - 1, y) && open(x + 1, y);
      const alongY = open(x, y - 1) && open(x, y + 1);
      if (alongX || alongY) leash[i] = 1;
    }
  }
  leash[y0 * w + x0] = 1;
  return leash;
}

/** Install the boss of a floor (FpsGame.load): the first 'boss' actor, or null. */
export function installBoss(g: FpsGame): FpsBoss | null {
  const pool = g.actors;
  let actor: Actor | null = null;
  for (let i = 0; i < pool.count; i++) {
    const a = pool.actors[i];
    if (a.used && a.type === 'boss') {
      actor = a;
      break;
    }
  }
  if (!actor) {
    pool.bossThink = null;
    pool.bossDamage = null;
    return null;
  }
  const boss = new FpsBoss(g, actor);
  pool.bossThink = () => boss.think();
  pool.bossDamage = (_g, _a, dmg) => boss.damage(dmg);
  return boss;
}

/** Boss HP of a difficulty (both phases; tools and docs). */
export function bossHpTotal(d: Difficulty): number {
  const i = DIFF_INDEX[d];
  return BOSS_HP[1][i] + BOSS_HP[2][i];
}

export { ST_STAND };
