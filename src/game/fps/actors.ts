/**
 * Enemies of the first-person mode (docs/design/fps.md §4.3): the per-type numbers, the state
 * ids, the preallocated actor pool (128), cell occupancy (one actor per cell; the target cell is
 * reserved), the movement blockers for the player and the billboard frame of every actor.
 * The behaviour (sight, noise, chase, attacks) lives in ai.ts; the hitscan maths in hitscan.ts.
 * No allocations per tick.
 */
import { angleTo, billboardYaw, getRayBillboard, hasRayBillboard, newBlockers, type Blockers, type RayBillboard } from '../../engine/ray';
import type { Difficulty } from '../session';
import type { ShotEvent } from './ai';
import type { FpsGame } from './game';
import type { ActorType, ParsedActor } from './map';

export const MAX_ACTORS = 128;

// --- States (the table and the think functions are in ai.ts) ---------------------------------
export const ST_STAND = 0;
export const ST_PATH = 1;
export const ST_CHASE = 2;
export const ST_TELL = 3;
export const ST_ATTACK = 4;
export const ST_RECOVER = 5;
export const ST_PAIN = 6;
export const ST_DIE = 7;
export const ST_DEAD = 8;
export const STATE_NAMES: readonly string[] = ['stand', 'path', 'chase', 'tell', 'attack', 'recover', 'pain', 'die', 'dead'];

/** 8 move directions, k × 45° clockwise from east (y grows south). */
export const DIR8_DX: readonly number[] = [1, 1, 0, -1, -1, -1, 0, 1];
export const DIR8_DY: readonly number[] = [0, 1, 1, 1, 0, -1, -1, -1];
/** Cardinal index (map.ts: 0 E, 1 S, 2 W, 3 N) → dir8. */
export const CARD_TO_DIR8: readonly number[] = [0, 2, 4, 6];

/** Frames of the `act` sheet (spec §8.2). */
export interface ActFrames {
  tell: number;
  shoot: number;
  /** -1 = no pain frame (dogs). */
  pain: number;
  die: number;
  dieCount: number;
  dead: number;
}

export interface ActorTypeDef {
  type: ActorType;
  /** HP per difficulty (E, N, H); the same for every enemy but the boss (G). */
  hp: readonly [number, number, number];
  patrol: number;
  chase: number;
  /** Reaction delay range (ticks) after the actor notices the player. */
  reactMin: number;
  reactMax: number;
  /** Tell ticks before every attack (≥ 18, GDD §4.11.2). */
  tell: number;
  /** Shots per attack and the ticks between them. */
  burst: number;
  burstGap: number;
  recover: number;
  /** Pain ticks (0 = no pain state). */
  pain: number;
  score: number;
  drop: 'clip' | 'ss' | 'none';
  /** Collision box half-size (tiles). */
  radius: number;
  /** Bites at d ≤ BITE_REACH (hitscan.ts) instead of shooting. */
  bite: boolean;
  opensDoors: boolean;
  /** Uses the attack tokens (§4.3; the boss does not). */
  tokens: boolean;
  /** Picks a dodge direction half of the time while it sees the player. */
  dodges: boolean;
  /** Billboard ids. */
  moveSheet: string;
  actSheet: string;
  frames: ActFrames;
  /** Ticks per die frame. */
  dieTicks: number;
  shotSfx: string;
  tellSfx: string;
  /** The voice speaker of alert / death lines ('' = none). */
  speaker: 'guard' | 'officer' | 'ss' | '';
  /** The base hit chance on the player (§4.3; the boss's is lower, §7.2) and when the player runs. */
  hitBase: number;
  hitBaseRun: number;
}

const PEOPLE_FRAMES: ActFrames = { tell: 0, shoot: 1, pain: 2, die: 3, dieCount: 4, dead: 7 };
const DOG_FRAMES: ActFrames = { tell: 0, shoot: 1, pain: -1, die: 2, dieCount: 3, dead: 5 };
const MECH_FRAMES: ActFrames = { tell: 0, shoot: 2, pain: 4, die: 5, dieCount: 4, dead: 8 };

/** Spec §4.3 (speeds in tiles/tick, times in ticks at 60 Hz). */
export const ACTOR_TYPES: Readonly<Record<ActorType, ActorTypeDef>> = {
  guard: {
    type: 'guard', hp: [25, 25, 25], patrol: 0.009, chase: 0.027, reactMin: 1, reactMax: 55, tell: 24, burst: 1, burstGap: 0,
    recover: 18, pain: 10, score: 100, drop: 'clip', radius: 0.4, bite: false, opensDoors: true, tokens: true, dodges: true,
    moveSheet: 'fps/guard/move', actSheet: 'fps/guard/act', frames: PEOPLE_FRAMES, dieTicks: 8,
    shotSfx: 'fps/enemy/pistol', tellSfx: 'fps/enemy/aim', speaker: 'guard', hitBase: 256, hitBaseRun: 160,
  },
  officer: {
    type: 'officer', hp: [50, 50, 50], patrol: 0.009, chase: 0.046, reactMin: 2, reactMax: 2, tell: 18, burst: 1, burstGap: 0,
    recover: 12, pain: 8, score: 400, drop: 'clip', radius: 0.4, bite: false, opensDoors: true, tokens: true, dodges: true,
    moveSheet: 'fps/officer/move', actSheet: 'fps/officer/act', frames: PEOPLE_FRAMES, dieTicks: 8,
    shotSfx: 'fps/enemy/pistol', tellSfx: 'fps/enemy/aim', speaker: 'officer', hitBase: 256, hitBaseRun: 160,
  },
  ss: {
    type: 'ss', hp: [100, 100, 100], patrol: 0.009, chase: 0.036, reactMin: 1, reactMax: 37, tell: 20, burst: 3, burstGap: 6,
    recover: 24, pain: 10, score: 500, drop: 'ss', radius: 0.4, bite: false, opensDoors: true, tokens: true, dodges: true,
    moveSheet: 'fps/ss/move', actSheet: 'fps/ss/act', frames: PEOPLE_FRAMES, dieTicks: 8,
    shotSfx: 'fps/enemy/mg', tellSfx: 'fps/enemy/aim', speaker: 'ss', hitBase: 256, hitBaseRun: 160,
  },
  dog: {
    type: 'dog', hp: [1, 1, 1], patrol: 0.027, chase: 0.053, reactMin: 1, reactMax: 27, tell: 18, burst: 1, burstGap: 0,
    recover: 20, pain: 0, score: 200, drop: 'none', radius: 0.3, bite: true, opensDoors: false, tokens: true, dodges: false,
    moveSheet: 'fps/dog/move', actSheet: 'fps/dog/act', frames: DOG_FRAMES, dieTicks: 8,
    shotSfx: 'fps/dog/bite', tellSfx: 'fps/dog/growl', speaker: '', hitBase: 256, hitBaseRun: 160,
  },
  // A stand-in for MechaHitler's suit (spec §7.2) until boss.ts (group floors) takes over through
  // `ActorPool.bossThink`: phase-1 numbers, no tokens, no pain.
  boss: {
    type: 'boss', hp: [900, 1100, 1300], patrol: 0.02, chase: 0.02, reactMin: 1, reactMax: 1, tell: 30, burst: 8, burstGap: 4,
    recover: 45, pain: 0, score: 25000, drop: 'none', radius: 0.6, bite: false, opensDoors: false, tokens: false, dodges: false,
    moveSheet: 'fps/boss/mech/move', actSheet: 'fps/boss/mech/act', frames: MECH_FRAMES, dieTicks: 10,
    shotSfx: 'fps/boss/chaingun', tellSfx: 'fps/boss/spin-up', speaker: '', hitBase: 208, hitBaseRun: 112,
  },
};

export const DIFF_INDEX: Readonly<Record<Difficulty, number>> = { easy: 0, normal: 1, hard: 2 };
/** Attack tokens per difficulty (§4.3, GDD §4.11.4). */
export const ATTACK_TOKENS: Readonly<Record<Difficulty, number>> = { easy: 3, normal: 4, hard: 6 };

/** Ticks the shoot frame shows after the last shot of an attack. */
export const ATTACK_HOLD = 8;

/** One enemy. Pool objects are reused: never keep a reference past a restart. */
export class Actor {
  readonly index: number;
  used = false;
  def: ActorTypeDef = ACTOR_TYPES.guard;
  type: ActorType = 'guard';
  /** Centre (tiles). */
  x = 0;
  y = 0;
  /** The cell it stands on / walks from, and the reserved target cell. */
  cx = 0;
  cy = 0;
  tx = 0;
  ty = 0;
  /** Move direction 0..7 while walking to (tx, ty); -1 = standing on (cx, cy). */
  dir = -1;
  /** Facing angle 0..4095 (for the 8-yaw billboard and the sight cone). */
  angle = 0;
  hp = 0;
  maxHp = 0;
  state = ST_STAND;
  /** Ticks in the current state. */
  timer = 0;
  /** Reaction delay left (> 0 = it noticed the player and reacts soon; still unaware). */
  react = 0;
  ambush = false;
  patrol = false;
  /** Placed on the map (counts for kill %); false for reinforcements. */
  placed = true;
  /** Holds an attack token (in tell / attack). */
  token = false;
  /** Shots left in the current attack. */
  shots = 0;
  /** Ticks of the last full tell (0 after a pain): the fairness check reads it at every shot. */
  tellDone = 0;
  /** Distance walked (tiles; the walk frames). */
  walked = 0;
  /** The last cell where it saw the player. */
  seenX = 0;
  seenY = 0;
  /** Waiting at a closed door (door index) or -1. */
  waitDoor = -1;
  /** Blood pool frame 0..2 under the corpse (cosmetic). */
  pool = 0;
  /** Ticks left of a hit spurt (cosmetic). */
  spurt = 0;
  /** Ticks of chase with line of sight (the boss's attack timer; group floors). */
  chaseSight = 0;
  /** Free slot for boss.ts (phase etc.). */
  phase = 0;

  constructor(index: number) {
    this.index = index;
  }

  /** Alive and not dying: solid, can be hit, blocks cells. */
  get alive(): boolean {
    return this.used && this.state < ST_DIE;
  }
  /** Knows about the player (chase / tell / attack / recover / pain after a hit). */
  get aware(): boolean {
    return this.state >= ST_CHASE && this.state <= ST_PAIN;
  }
}

/** The preallocated pool, the cell occupancy and the player's movement blockers. */
export class ActorPool {
  readonly actors: Actor[] = [];
  count = 0;
  /** Per cell: actor index + 1 that stands on or reserved the cell (0 = free). */
  occ: Int16Array = new Int16Array(0);
  w = 0;
  h = 0;
  readonly blockers: Blockers = newBlockers(MAX_ACTORS);
  /** Kills of placed actors (kill %). */
  kills = 0;
  /** Placed actors (kill % total). */
  placedTotal = 0;
  /** Actors in tell or attack holding a token. */
  tokensUsed = 0;
  /** Patrol turn markers per cell (cardinal index 0 E, 1 S, 2 W, 3 N; -1 = none). */
  turns: Int8Array = new Int8Array(0);
  /**
   * Boss hooks (group floors, boss.ts): `bossThink` runs instead of the state table for the
   * boss (return true when it handled the tick); `bossDamage` takes the player's hits on the boss
   * (returns the damage dealt). Null = the stand-in behaviour of ai.ts.
   */
  bossThink: ((g: FpsGame, a: Actor) => boolean) | null = null;
  bossDamage: ((g: FpsGame, a: Actor, dmg: number) => number) | null = null;
  /** Every enemy shot or bite, hit or miss (tests, stats). The payload is reused. */
  onShot: ((e: ShotEvent) => void) | null = null;

  constructor() {
    for (let i = 0; i < MAX_ACTORS; i++) this.actors.push(new Actor(i));
  }

  /** Empty the pool for a floor of w × h cells. */
  reset(w: number, h: number): void {
    for (let i = 0; i < this.count; i++) this.actors[i].used = false;
    this.count = 0;
    this.kills = 0;
    this.placedTotal = 0;
    this.tokensUsed = 0;
    this.w = w;
    this.h = h;
    if (this.occ.length !== w * h) {
      this.occ = new Int16Array(w * h);
      this.turns = new Int8Array(w * h);
    } else this.occ.fill(0);
    this.turns.fill(-1);
    this.blockers.count = 0;
  }

  /** Spawn an actor on cell (x, y). Returns null when the pool is full. */
  spawn(type: ActorType, x: number, y: number, angle: number, difficulty: Difficulty, placed = true): Actor | null {
    if (this.count >= MAX_ACTORS) {
      console.warn('[fps] actor pool full');
      return null;
    }
    const a = this.actors[this.count++];
    const def = ACTOR_TYPES[type];
    a.used = true;
    a.def = def;
    a.type = type;
    a.x = x + 0.5;
    a.y = y + 0.5;
    a.cx = a.tx = x;
    a.cy = a.ty = y;
    a.dir = -1;
    a.angle = angle;
    a.hp = a.maxHp = def.hp[DIFF_INDEX[difficulty]];
    a.state = ST_STAND;
    a.timer = 0;
    a.react = 0;
    a.ambush = false;
    a.patrol = false;
    a.placed = placed;
    a.token = false;
    a.shots = 0;
    a.tellDone = 0;
    a.walked = 0;
    a.seenX = x;
    a.seenY = y;
    a.waitDoor = -1;
    a.pool = 0;
    a.spurt = 0;
    a.chaseSight = 0;
    a.phase = 0;
    if (placed) this.placedTotal++;
    this.claim(a, x, y);
    return a;
  }

  /** Spawn the parsed actors of a floor. */
  spawnParsed(list: readonly ParsedActor[], difficulty: Difficulty, angleOf: (c: ParsedActor['facing']) => number): void {
    for (const p of list) {
      const a = this.spawn(p.type, p.x, p.y, angleOf(p.facing), difficulty, true);
      if (!a) break;
      a.ambush = p.ambush || p.type === 'boss';
      a.patrol = p.patrol && p.type !== 'boss';
      if (a.patrol) a.state = ST_PATH;
    }
  }

  /** Mark a patrol turn marker (cardinal index) on cell (x, y). */
  setTurn(x: number, y: number, card: number): void {
    if (this.inside(x, y)) this.turns[y * this.w + x] = card;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** The actor index + 1 on / reserving cell (x, y), 0 = none. */
  occupant(x: number, y: number): number {
    return this.inside(x, y) ? this.occ[y * this.w + x] : 0;
  }

  claim(a: Actor, x: number, y: number): void {
    if (this.inside(x, y)) this.occ[y * this.w + x] = a.index + 1;
  }

  release(a: Actor, x: number, y: number): void {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    if (this.occ[i] === a.index + 1) this.occ[i] = 0;
  }

  /** Release both cells (death). */
  releaseAll(a: Actor): void {
    this.release(a, a.cx, a.cy);
    this.release(a, a.tx, a.ty);
  }

  /** A living actor stands on or reserved the cell. */
  cellTaken(x: number, y: number): boolean {
    return this.occupant(x, y) !== 0;
  }

  /** Rebuild the player's movement blockers (living actors' boxes). */
  buildBlockers(): Blockers {
    const b = this.blockers;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const a = this.actors[i];
      if (!a.alive) continue;
      b.x[n] = a.x;
      b.y[n] = a.y;
      b.r[n] = a.def.radius;
      n++;
    }
    b.count = n;
    return b;
  }

  /** The billboard and frame of an actor seen from (camX, camY). Null billboard = not registered. */
  frameOf(a: Actor, camX: number, camY: number, out: ActorFrame): ActorFrame {
    const def = a.def;
    const f = def.frames;
    let sheet = def.moveSheet;
    let frame = 0;
    let yaw = billboardYaw(a.angle, a.x, a.y, camX, camY);
    switch (a.state) {
      case ST_STAND:
        frame = 0;
        break;
      case ST_PATH:
      case ST_CHASE:
        frame = a.dir >= 0 || a.waitDoor >= 0 ? 1 + (Math.floor(a.walked / 0.25) & 3) : 0;
        break;
      case ST_TELL:
        sheet = def.actSheet;
        frame = f.tell + (def.type === 'boss' && a.timer >= def.tell >> 1 ? 1 : 0);
        yaw = 0;
        break;
      case ST_ATTACK:
        sheet = def.actSheet;
        // The flash frame on the shot tick and the next 3; the aim frame between bullets.
        frame = def.burstGap > 0 && a.timer % def.burstGap >= 4 ? f.tell : f.shoot;
        if (def.type === 'boss') frame = f.shoot + ((a.timer >> 1) & 1);
        yaw = 0;
        break;
      case ST_RECOVER:
        sheet = def.actSheet;
        frame = f.tell;
        yaw = 0;
        break;
      case ST_PAIN:
        if (f.pain >= 0) {
          sheet = def.actSheet;
          frame = f.pain;
          yaw = 0;
        }
        break;
      case ST_DIE:
        sheet = def.actSheet;
        frame = f.die + Math.min(f.dieCount - 1, Math.floor(a.timer / def.dieTicks));
        yaw = 0;
        break;
      default:
        sheet = def.actSheet;
        frame = f.dead;
        yaw = 0;
        break;
    }
    out.bb = billboardOf(sheet);
    out.frame = frame;
    out.yaw = yaw;
    return out;
  }
}

export interface ActorFrame {
  bb: RayBillboard | null;
  frame: number;
  yaw: number;
}

const bbCache = new Map<string, RayBillboard | null>();
/** A billboard by id, or null when it is not registered (drawn as nothing; cached once found). */
export function billboardOf(id: string): RayBillboard | null {
  const hit = bbCache.get(id);
  if (hit) return hit;
  if (!hasRayBillboard(id)) return null;
  const bb = getRayBillboard(id);
  bbCache.set(id, bb);
  return bb;
}

/** The facing angle from an actor toward a point. */
export function angleFrom(a: Actor, x: number, y: number): number {
  return angleTo(x - a.x, y - a.y);
}
