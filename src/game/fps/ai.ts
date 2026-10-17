/**
 * Enemy behaviour (docs/design/fps.md §4.3, §4.4): the state table and its think functions,
 * sight (the front half-circle or 1.5 tiles all around, plus line of sight), noise through the
 * areas linked by open doors, ambush, patrols with turn markers, chase and dodge direction
 * choice on 8 directions (tile centre to tile centre, one actor per cell), doors, attack tokens,
 * the ≥ 18-tick tell before every attack, the shots / bites with the game rng, pain, death,
 * drops and blood. Deterministic: every roll that changes the simulation uses `g.rng`;
 * voice-line choice and blood size use `g.fxRng`. No allocations per tick.
 */
import { angDelta, angleTo, CELL_DOOR, CELL_PROP, CELL_SOLID, lineOfSight } from '../../engine/ray';
import { ALERT_LINES, DEATH_LINES, type FpsLine } from '../content/fps/lines';
import {
  angleFrom,
  ATTACK_HOLD,
  ATTACK_TOKENS,
  CARD_TO_DIR8,
  DIR8_DX,
  DIR8_DY,
  ST_ATTACK,
  ST_CHASE,
  ST_DEAD,
  ST_DIE,
  ST_PAIN,
  ST_PATH,
  ST_RECOVER,
  ST_STAND,
  ST_TELL,
  type Actor,
} from './actors';
import { DOOR_OPEN } from './doors';
import type { FpsGame } from './game';
import { bandDist, BITE_REACH, biteDamage, bossDamage, enemyDamage, enemyHitChance, RUN_MOVE, VIEW_HALF } from './hitscan';
import { LOCK_NONE } from './map';
import { WEAPON_MG } from './types';

/** Sight all around within this Chebyshev distance (tiles). */
export const CLOSE_SIGHT = 1.5;
/** At most one alert shout per this many ticks in the whole floor (§4.4). */
export const SHOUT_GAP = 30;
/** Ticks of a hit spurt. */
export const SPURT_TICKS = 9;
/** Minimum tell (GDD §4.11.2). */
export const MIN_TELL = 18;

type Think = (g: FpsGame, a: Actor) => void;

/** One row of the state table: its name and its think function. */
export interface StateRow {
  readonly name: string;
  readonly think: Think;
}

/** Index = state id (ST_*). */
export const STATE_TABLE: readonly StateRow[] = [
  { name: 'stand', think: thinkStand },
  { name: 'path', think: thinkPath },
  { name: 'chase', think: thinkChase },
  { name: 'tell', think: thinkTell },
  { name: 'attack', think: thinkAttack },
  { name: 'recover', think: thinkRecover },
  { name: 'pain', think: thinkPain },
  { name: 'die', think: thinkDie },
  { name: 'dead', think: thinkDead },
];

/** One tick of every actor. */
export function stepActors(g: FpsGame): void {
  const pool = g.actors;
  for (let i = 0; i < pool.count; i++) {
    const a = pool.actors[i];
    if (!a.used) continue;
    a.timer++;
    if (a.spurt > 0) a.spurt--;
    if (a.state === ST_DEAD) continue;
    const hook = pool.bossThink;
    if (a.type === 'boss' && hook && hook(g, a)) continue;
    STATE_TABLE[a.state].think(g, a);
  }
}

// ------------------------------------------------------------------------------------ sight

/** The player is in the actor's front half (or within 1.5 tiles) and in line of sight (§4.4). */
export function canSee(g: FpsGame, a: Actor): boolean {
  const p = g.player;
  const dx = p.x - a.x;
  const dy = p.y - a.y;
  if (bandDist(dx, dy) >= CLOSE_SIGHT) {
    const rel = angDelta(a.angle, angleTo(dx, dy));
    if (rel <= -1024 || rel >= 1024) return false;
  }
  return lineOfSight(g.grid, g.map.doors, g.pushes.push, a.x, a.y, p.x, p.y);
}

/** Line of sight between the actor and the player (no view cone). */
export function hasLos(g: FpsGame, a: Actor): boolean {
  return lineOfSight(g.grid, g.map.doors, g.pushes.push, a.x, a.y, g.player.x, g.player.y);
}

/** Start the reaction delay (the actor noticed the player; still unaware until it ends). */
export function notice(g: FpsGame, a: Actor): void {
  if (a.react > 0 || a.state > ST_PATH) return;
  a.react = g.rng.int(a.def.reactMin, a.def.reactMax);
}

/**
 * A gunshot (§4.4): every non-ambush actor whose area is linked to the player's area by open
 * doors notices the player. Reads the reach `FpsSound.setListener` computed this tick.
 */
export function makeNoise(g: FpsGame): void {
  const pool = g.actors;
  for (let i = 0; i < pool.count; i++) {
    const a = pool.actors[i];
    if (!a.alive || a.ambush || a.state > ST_PATH || a.react > 0) continue;
    if (g.sound.reachedCell(a.cx, a.cy)) notice(g, a);
  }
}

/** The reaction ended: shout and chase. */
function wake(g: FpsGame, a: Actor): void {
  a.react = 0;
  a.state = ST_CHASE;
  a.timer = 0;
  a.chaseSight = 0;
  a.seenX = Math.floor(g.player.x);
  a.seenY = Math.floor(g.player.y);
  if (a.dir < 0) a.angle = angleFrom(a, g.player.x, g.player.y);
  shout(g, a, false);
  g.actorWoke(a);
}

/** An alert (or death) line: the voice sample when loaded, else the stand-in sfx (§9.3). */
function shout(g: FpsGame, a: Actor, death: boolean): void {
  if (!death) {
    if (g.tick - g.lastShout < SHOUT_GAP) return;
    g.lastShout = g.tick;
  }
  if (a.type === 'dog') {
    g.sound.at(death ? 'fps/dog/die' : 'fps/dog/bark', a.x, a.y);
    return;
  }
  const sp = a.def.speaker;
  if (!sp) return;
  const lines = death ? DEATH_LINES[sp] : ALERT_LINES[sp];
  const line: FpsLine = lines[lines.length > 1 ? g.fxRng.int(0, lines.length - 1) : 0];
  const audio = g.audio;
  if (audio.say && audio.hasVoice?.(line.text)) audio.say(line.text, line.speaker);
  else if (!death) g.sound.at(`fps/shout-${sp}`, a.x, a.y);
}

// ------------------------------------------------------------------------------------ think

function reactTick(g: FpsGame, a: Actor): boolean {
  if (a.react > 0) {
    if (--a.react === 0) {
      wake(g, a);
      return true;
    }
    return false;
  }
  if (canSee(g, a)) {
    notice(g, a);
    if (a.react === 0) a.react = 1;
  }
  return false;
}

function thinkStand(g: FpsGame, a: Actor): void {
  reactTick(g, a);
}

function thinkPath(g: FpsGame, a: Actor): void {
  if (reactTick(g, a)) return;
  walk(g, a, a.def.patrol, choosePatrol);
}

function thinkChase(g: FpsGame, a: Actor): void {
  const p = g.player;
  const sees = hasLos(g, a);
  if (sees) {
    a.seenX = Math.floor(p.x);
    a.seenY = Math.floor(p.y);
    a.chaseSight++;
  }
  if (sees && g.state === 'play' && tokenFree(g, a)) {
    const d = bandDist(p.x - a.x, p.y - a.y);
    let go: boolean;
    if (a.def.bite) go = d <= BITE_REACH;
    else go = d < 1 || g.rng.int(0, 255) < Math.floor(19 / Math.max(1, Math.floor(d)));
    if (go) {
      startTell(g, a);
      return;
    }
  }
  walk(g, a, a.def.chase, chooseChase);
}

function tokenFree(g: FpsGame, a: Actor): boolean {
  return !a.def.tokens || g.actors.tokensUsed < ATTACK_TOKENS[g.difficulty];
}

function takeToken(g: FpsGame, a: Actor): void {
  if (!a.def.tokens || a.token) return;
  a.token = true;
  g.actors.tokensUsed++;
}

function dropToken(g: FpsGame, a: Actor): void {
  if (!a.token) return;
  a.token = false;
  g.actors.tokensUsed--;
}

/** Begin an attack: the tell (aim pose + sound), ≥ 18 ticks (§4.3). */
export function startTell(g: FpsGame, a: Actor): void {
  takeToken(g, a);
  a.state = ST_TELL;
  a.timer = 0;
  a.tellDone = 0;
  a.angle = angleFrom(a, g.player.x, g.player.y);
  g.sound.at(a.def.tellSfx, a.x, a.y);
}

function thinkTell(g: FpsGame, a: Actor): void {
  a.angle = angleFrom(a, g.player.x, g.player.y);
  if (a.timer < a.def.tell) return;
  a.tellDone = a.timer;
  a.state = ST_ATTACK;
  a.timer = 0;
  a.shots = a.def.burst;
  fire(g, a);
}

function thinkAttack(g: FpsGame, a: Actor): void {
  const def = a.def;
  a.angle = angleFrom(a, g.player.x, g.player.y);
  if (a.shots > 0 && def.burstGap > 0 && a.timer % def.burstGap === 0) fire(g, a);
  if (a.shots === 0 && a.timer >= (def.burst - 1) * def.burstGap + ATTACK_HOLD) {
    dropToken(g, a);
    a.state = ST_RECOVER;
    a.timer = 0;
  }
}

function thinkRecover(_g: FpsGame, a: Actor): void {
  if (a.timer >= a.def.recover) {
    a.state = ST_CHASE;
    a.timer = 0;
  }
}

function thinkPain(_g: FpsGame, a: Actor): void {
  if (a.timer >= a.def.pain) {
    a.state = ST_CHASE;
    a.timer = 0;
  }
}

function thinkDie(g: FpsGame, a: Actor): void {
  const def = a.def;
  if (a.timer >= def.frames.dieCount * def.dieTicks) {
    a.state = ST_DEAD;
    a.timer = 0;
    if (a.type !== 'dog') g.sound.at('fps/enemy/fall', a.x, a.y);
  }
}

function thinkDead(): void {}

// ------------------------------------------------------------------------------------ attacks

/** Payload of `ActorPool.onShot` (reused): every damaging enemy event, hit or miss. */
export interface ShotEvent {
  actor: Actor;
  /** Damage dealt (0 = a miss). */
  damage: number;
  /** Ticks of the tell that preceded this attack. */
  tell: number;
  tick: number;
}
const shotEv: ShotEvent = { actor: null as unknown as Actor, damage: 0, tell: 0, tick: 0 };

/** One shot (or bite) of the current attack. */
function fire(g: FpsGame, a: Actor): void {
  a.shots--;
  const def = a.def;
  const p = g.player;
  const dx = p.x - a.x;
  const dy = p.y - a.y;
  const d = bandDist(dx, dy);
  g.sound.at(def.shotSfx, a.x, a.y);
  let dmg = 0;
  if (def.bite) {
    if (d <= BITE_REACH) dmg = biteDamage(g.rng, g.difficulty);
  } else if (hasLos(g, a)) {
    const rel = angDelta(p.angle, angleTo(-dx, -dy));
    const inView = rel >= -VIEW_HALF && rel <= VIEW_HALF;
    const chance = enemyHitChance(d, g.playerMove >= RUN_MOVE, inView, def.hitBase, def.hitBaseRun);
    if (g.rng.int(0, 255) < chance) dmg = def.type === 'boss' ? bossDamage(g.rng, d, g.difficulty) : enemyDamage(g.rng, d, g.difficulty);
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

// ------------------------------------------------------------------------------------ damage

/**
 * The player hit actor `a` for `dmg` (§4.2, §4.4): × 2 when it is unaware (not the boss), pain
 * (cancels a tell) or death. Returns the damage dealt.
 */
export function damageActor(g: FpsGame, a: Actor, dmg: number): number {
  if (!a.alive || dmg <= 0) return 0;
  if (a.type !== 'boss' && !a.aware) dmg *= 2;
  const hook = g.actors.bossDamage;
  if (a.type === 'boss' && hook) return hook(g, a, dmg);
  a.hp -= dmg;
  a.spurt = SPURT_TICKS;
  if (a.hp <= 0) {
    killActor(g, a);
    return dmg;
  }
  g.sound.at('fps/enemy/hurt', a.x, a.y);
  // A hit wakes an unaware actor at once (it shouts, the boss hooks hear it); pain still follows.
  const unaware = !a.aware;
  if (unaware && a.def.pain > 0) {
    a.react = 0;
    a.seenX = Math.floor(g.player.x);
    a.seenY = Math.floor(g.player.y);
    shout(g, a, false);
    g.actorWoke(a);
  }
  if (a.def.pain > 0) {
    dropToken(g, a);
    a.state = ST_PAIN;
    a.timer = 0;
    a.tellDone = 0;
    a.react = 0;
    a.angle = angleFrom(a, g.player.x, g.player.y);
  } else if (!a.aware) wake(g, a);
  return dmg;
}

/** Death: score, drop, blood, the death line; the corpse is not solid. */
export function killActor(g: FpsGame, a: Actor): void {
  const pool = g.actors;
  dropToken(g, a);
  pool.releaseAll(a);
  a.state = ST_DIE;
  a.timer = 0;
  a.react = 0;
  a.dir = -1;
  a.waitDoor = -1;
  a.hp = 0;
  a.pool = 1 + g.fxRng.int(0, 1);
  a.spurt = SPURT_TICKS;
  if (a.placed) pool.kills++;
  g.addScore(a.def.score);
  g.sound.at('fps/blood', a.x, a.y);
  shout(g, a, true);
  const cx = Math.floor(a.x);
  const cy = Math.floor(a.y);
  if (a.def.drop === 'clip') g.dropItem('clip-drop', cx, cy);
  else if (a.def.drop === 'ss') g.dropItem(((g.player.weapons >> WEAPON_MG) & 1) === 0 ? 'mg' : 'clip-drop', cx, cy);
  g.actorKilled(a);
}

// ------------------------------------------------------------------------------------ movement

type Chooser = (g: FpsGame, a: Actor) => number;

/** Can actor `a` (standing on its cell centre) step in direction `dir`? */
export function canStep(g: FpsGame, a: Actor, dir: number): boolean {
  const nx = a.cx + DIR8_DX[dir];
  const ny = a.cy + DIR8_DY[dir];
  if (!enterable(g, a, nx, ny, false)) return false;
  if ((dir & 1) === 1) {
    // A diagonal needs both orthogonal cells free (§4.3).
    if (!enterable(g, a, nx, a.cy, true) || !enterable(g, a, a.cx, ny, true)) return false;
  }
  return true;
}

/** Cell (x, y) is free for actor `a`; `strict` = a diagonal's side cell (no doors at all). */
function enterable(g: FpsGame, a: Actor, x: number, y: number, strict: boolean): boolean {
  const grid = g.grid;
  if (!grid.inside(x, y)) return false;
  const c = grid.idx(x, y);
  const f = grid.flags[c];
  if ((f & CELL_DOOR) !== 0) {
    if (strict) return false;
    const di = grid.door[c];
    const full = g.doors.state[di] === DOOR_OPEN;
    if (!full && !(a.def.opensDoors && g.doors.lock[di] === LOCK_NONE)) return false;
  } else if ((f & (CELL_SOLID | CELL_PROP)) !== 0) return false;
  const pw = g.pushes.push;
  if (pw.active && ((x === pw.x && y === pw.y) || (x === pw.x + pw.dx && y === pw.y + pw.dy))) return false;
  const occ = g.actors.occupant(x, y);
  if (occ !== 0 && occ !== a.index + 1) return false;
  // Never step onto the player.
  const p = g.player.box;
  const r = a.def.radius + p.r;
  if (Math.abs(x + 0.5 - p.x) < r && Math.abs(y + 0.5 - p.y) < r) return false;
  return true;
}

/**
 * Walk toward the reserved cell; on a cell centre ask `choose` for the next direction. People
 * open the doors they walk into and wait until they are open (§4.3).
 */
function walk(g: FpsGame, a: Actor, speed: number, choose: Chooser): void {
  const pool = g.actors;
  if (a.waitDoor >= 0) {
    if (g.doors.state[a.waitDoor] !== DOOR_OPEN) {
      g.doors.open(a.waitDoor);
      return;
    }
    a.waitDoor = -1;
  }
  if (a.dir < 0) {
    const dir = choose(g, a);
    if (dir < 0) return;
    a.dir = dir;
    a.tx = a.cx + DIR8_DX[dir];
    a.ty = a.cy + DIR8_DY[dir];
    pool.claim(a, a.tx, a.ty);
    a.angle = dir << 9;
    const grid = g.grid;
    const c = grid.idx(a.tx, a.ty);
    if ((grid.flags[c] & CELL_DOOR) !== 0 && g.doors.state[grid.door[c]] !== DOOR_OPEN) {
      a.waitDoor = grid.door[c];
      g.doors.open(a.waitDoor);
      return;
    }
  }
  const gx = a.tx + 0.5;
  const gy = a.ty + 0.5;
  const dx = gx - a.x;
  const dy = gy - a.y;
  const dist = Math.hypot(dx, dy);
  const step = speed < dist ? speed : dist;
  const nx = a.x + (dx / (dist || 1)) * step;
  const ny = a.y + (dy / (dist || 1)) * step;
  // Wait while the player stands in the way.
  const p = g.player.box;
  const r = a.def.radius + p.r;
  if (Math.abs(nx - p.x) < r && Math.abs(ny - p.y) < r) return;
  a.x = nx;
  a.y = ny;
  a.walked += step;
  if (step >= dist) {
    a.x = gx;
    a.y = gy;
    pool.release(a, a.cx, a.cy);
    a.cx = a.tx;
    a.cy = a.ty;
    a.dir = -1;
  }
}

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** dir8 of a unit step (sx, sy), or -1 for (0, 0). */
export function dirOf(sx: number, sy: number): number {
  for (let k = 0; k < 8; k++) if (DIR8_DX[k] === sx && DIR8_DY[k] === sy) return k;
  return -1;
}

/**
 * Chase (§4.3): toward the player — the diagonal first, then the major axis, the minor axis,
 * any free direction, the reverse. People with line of sight pick a dodge direction
 * (perpendicular to the player line) half of the time. Dogs chase straight.
 */
export function chooseChase(g: FpsGame, a: Actor): number {
  const p = g.player;
  const ddx = Math.floor(p.x) - a.cx;
  const ddy = Math.floor(p.y) - a.cy;
  const sx = sign(ddx);
  const sy = sign(ddy);
  const reverse = ((((a.angle + 256) >> 9) & 7) + 4) & 7; // back where it came from
  if (a.def.dodges && g.rng.int(0, 1) === 0 && hasLos(g, a)) {
    const dodge = chooseDodge(g, a, sx, sy, Math.abs(ddx) >= Math.abs(ddy));
    if (dodge >= 0) return dodge;
  }
  if (sx !== 0 && sy !== 0) {
    const d = dirOf(sx, sy);
    if (canStep(g, a, d)) return d;
  }
  const majorX = Math.abs(ddx) >= Math.abs(ddy);
  const d1 = majorX ? dirOf(sx, 0) : dirOf(0, sy);
  const d2 = majorX ? dirOf(0, sy) : dirOf(sx, 0);
  if (d1 >= 0 && d1 !== reverse && canStep(g, a, d1)) return d1;
  if (d2 >= 0 && d2 !== reverse && canStep(g, a, d2)) return d2;
  if (sx === 0 && sy === 0) return -1;
  const start = g.rng.int(0, 7);
  for (let k = 0; k < 8; k++) {
    const d = (start + k) & 7;
    if (d !== reverse && canStep(g, a, d)) return d;
  }
  return canStep(g, a, reverse) ? reverse : -1;
}

/** A dodge: perpendicular to the player line (both sides, random order), then the diagonals toward. */
function chooseDodge(g: FpsGame, a: Actor, sx: number, sy: number, majorX: boolean): number {
  const flip = g.rng.int(0, 1) === 0 ? 1 : -1;
  for (let k = 0; k < 2; k++) {
    const s = k === 0 ? flip : -flip;
    const d = majorX ? dirOf(0, s) : dirOf(s, 0);
    if (canStep(g, a, d)) return d;
  }
  for (let k = 0; k < 2; k++) {
    const s = k === 0 ? flip : -flip;
    const d = majorX ? dirOf(sx || s, s) : dirOf(s, sy || s);
    if (d >= 0 && canStep(g, a, d)) return d;
  }
  return -1;
}

/** Patrol (§4.3): walk in the facing direction; turn at turn markers; reverse when blocked. */
export function choosePatrol(g: FpsGame, a: Actor): number {
  let dir = ((a.angle + 256) >> 9) & 7;
  dir &= 6; // patrols walk the 4 cardinals
  const t = g.turnAt(a.cx, a.cy);
  if (t >= 0) dir = CARD_TO_DIR8[t];
  if (canStep(g, a, dir)) return dir;
  const rev = (dir + 4) & 7;
  if (canStep(g, a, rev)) return rev;
  a.angle = rev << 9;
  return -1;
}

export { ST_STAND, ST_CHASE };
