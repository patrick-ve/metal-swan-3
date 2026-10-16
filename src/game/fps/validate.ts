/**
 * Floor validators (docs/design/fps.md §5.3; docs/api/fps.md §5). Pure: `validateFloor(def)`
 * parses the floor once per difficulty and checks the rules 1–11. Errors fail the floor tests;
 * warnings are for the designer. Texture ids resolve through `parseFloor`, so load the fps
 * content first (an unknown texture only warns).
 *
 * Rules: 1 size, 2 closed border, 3 one start, 4 doors and things, 5 keys before their doors,
 * 6 every secret reachable, 7 push-wall count and one golden record inside a secret,
 * 8 ammo budget, 9 fair start, 10 reinforcement spawns, 11 boss-fight ammo.
 */
import { lineOfSight } from '../../engine/ray';
import type { Difficulty } from '../session';
import { ACTOR_TYPES } from './actors';
import { BOSS_HP } from './boss';
import { isWallChar, LOCK_GOLD, LOCK_SILVER, parseFloor, PICKUP_CHARS, PROP_CHARS, type ParsedFloor } from './map';
import type { FpsFloorDef } from './types';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** Expected sizes per floor id (rule 1). */
const FLOOR_SIZE: Readonly<Record<string, readonly [number, number]>> = { 'fps-1': [48, 48], 'fps-2': [32, 32] };
const MAX_SIZE = 64;
/** Rounds per pickup (rule 8). */
const START_ROUNDS = 8;
const CLIP_ROUNDS = 8;
const GUN_ROUNDS = 6;
const ONE_UP_ROUNDS = 25;
const DROP_ROUNDS = 4;
/** The average mid-band bullet (rule 8) and the arena average incl. misses (rule 11). */
const AVG_BULLET = 22;
const AVG_ARENA_BULLET = 19;
/** The wreck spills two clips (spec §7.2; rule 11 counts them). */
export const WRECK_CLIPS = 2;
/** Reinforcements per difficulty (rule 10, spec §7.2). */
export const REINFORCEMENTS: Readonly<Record<Difficulty, number>> = { easy: 2, normal: 3, hard: 4 };

export interface FloorReport {
  errors: string[];
  warnings: string[];
  /** Per difficulty: the numbers of rule 8 / 11 (tests and docs read them). */
  budget: Partial<Record<Difficulty, AmmoBudget>>;
}

export interface AmmoBudget {
  enemies: number;
  hp: number;
  rounds: number;
  /** Boss floor only: 99 + arena rounds + drops, and the need (rule 11). */
  arenaRounds?: number;
  arenaNeed?: number;
}

/** Walkable for the BFS: plain floor (items, actors and non-solid props stand on floor). */
const F_WALL = 1;
const F_DOOR = 2;
const F_PUSH = 4;
const F_PROP = 8;

/** A char-level view of a parsed floor that the reach checks share. */
interface Cells {
  w: number;
  h: number;
  /** F_* bits per cell. */
  kind: Uint8Array;
  /** Door lock per cell (doors only). */
  lock: Uint8Array;
}

function cellsOf(m: ParsedFloor): Cells {
  const { w, h } = m;
  const kind = new Uint8Array(w * h);
  const lock = new Uint8Array(w * h);
  const rows = m.def.rows;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y]?.[x] ?? 'A';
      const i = y * w + x;
      if (isWallChar(ch)) kind[i] = F_WALL;
      else if (ch === '*') kind[i] = F_PUSH;
    }
  }
  for (let d = 0; d < m.doors.count; d++) {
    const i = m.doors.y[d] * w + m.doors.x[d];
    kind[i] = F_DOOR;
    lock[i] = m.doorLock[d];
  }
  for (const p of m.props) if (p.solid) kind[p.y * w + p.x] |= F_PROP;
  return { w, h, kind, lock };
}

/**
 * Cells reachable from (sx, sy) on foot: floor and doors the keys open (KEY bits: 1 gold,
 * 2 silver); walls, solid props and push walls block (`open` = push-wall cells already moved away).
 */
function reach(c: Cells, sx: number, sy: number, keys: number, open?: Uint8Array): Uint8Array {
  const seen = new Uint8Array(c.w * c.h);
  const q: number[] = [sy * c.w + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % c.w;
    const y = (i / c.w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 2 ? -1 : 0);
      const ny = y + (k === 1 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= c.w || ny >= c.h) continue;
      const j = ny * c.w + nx;
      if (seen[j] || !passable(c, j, keys, open)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

function passable(c: Cells, j: number, keys: number, open?: Uint8Array): boolean {
  const k = c.kind[j];
  if (k & (F_WALL | F_PROP)) return false;
  if (k & F_PUSH) return open ? open[j] === 1 : false;
  if (k & F_DOOR) {
    const l = c.lock[j];
    if (l === LOCK_GOLD) return (keys & 1) !== 0;
    if (l === LOCK_SILVER) return (keys & 2) !== 0;
  }
  return true;
}

function count(seen: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < seen.length; i++) n += seen[i];
  return n;
}

/** A floor cell next to (x, y) (4-neighbour) is in `seen`. */
function besideReached(c: Cells, seen: Uint8Array, x: number, y: number): boolean {
  for (let k = 0; k < 4; k++) {
    const nx = x + (k === 0 ? 1 : k === 2 ? -1 : 0);
    const ny = y + (k === 1 ? 1 : k === 3 ? -1 : 0);
    if (nx >= 0 && ny >= 0 && nx < c.w && ny < c.h && seen[ny * c.w + nx]) return true;
  }
  return false;
}

/** Validate one floor on every difficulty. Never throws. */
export function validateFloor(def: FpsFloorDef): FloorReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const report: FloorReport = { errors, warnings, budget: {} };
  const err = (m: string): void => {
    if (!errors.includes(m)) errors.push(m);
  };
  const warnOnce = (m: string): void => {
    if (!warnings.includes(m)) warnings.push(m);
  };

  // Rule 1: size.
  const rows = def.rows;
  const w = rows[0]?.length ?? 0;
  rows.forEach((r, y) => {
    if (r.length !== w) err(`rule 1: row ${y} has ${r.length} cells, not ${w}`);
  });
  const want = FLOOR_SIZE[def.id];
  if (want && (w !== want[0] || rows.length !== want[1])) err(`rule 1: ${def.id} is ${w}×${rows.length}, not ${want[0]}×${want[1]}`);
  if (w > MAX_SIZE || rows.length > MAX_SIZE) err(`rule 1: ${w}×${rows.length} is larger than ${MAX_SIZE}×${MAX_SIZE}`);
  if (!w || !rows.length) {
    err('rule 1: empty floor');
    return report;
  }

  // Rule 2: closed border.
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      if (x !== 0 && y !== 0 && x !== w - 1 && y !== rows.length - 1) continue;
      const ch = rows[y][x];
      if (!isWallChar(ch)) err(`rule 2: border cell ${x},${y} is "${ch}", not a wall`);
    }
  }

  // Rule 3: one start.
  let starts = 0;
  for (const r of rows) for (const ch of r) if ('^>v<'.includes(ch)) starts++;
  if (starts !== 1) err(`rule 3: ${starts} starts (want exactly 1)`);

  // Rule 4 (things): no thing on a door / push wall / wall; at most one entry per cell.
  const thingCells = new Set<string>();
  for (const t of def.things ?? []) {
    const [x, y] = t.at;
    const ch = rows[y]?.[x] ?? '';
    const key = `${x},${y}`;
    const opts = t.turn || t.spawn ? 'marker' : 'thing';
    if (thingCells.has(key)) err(`rule 4: two things entries on ${key}`);
    thingCells.add(key);
    if (opts === 'marker') {
      if (ch !== '.') err(`rule 4: the ${t.turn ? 'turn' : 'spawn'} marker at ${key} is on "${ch}", not floor`);
      continue;
    }
    if (ch === '*') {
      if (t.facing || t.patrol || t.ambush) err(`rule 4: actor options on the push wall at ${key}`);
      continue;
    }
    if (isWallChar(ch) || '|-!=:;]_'.includes(ch)) err(`rule 4: a thing on the wall / door cell ${key}`);
  }

  for (const diff of DIFFICULTIES) {
    const m = parseFloor(def, diff);
    for (const msg of m.warnings) warnOnce(`parse: ${msg}`);
    checkDifficulty(def, m, diff, report, diff === 'normal' ? err : (s: string) => warnOnce(`${diff}: ${s}`), err);
  }
  return report;
}

/** Rules 4 (doors) – 11 on one parsed difficulty. `soft` = error on NORMAL, warning else (rule 8). */
function checkDifficulty(def: FpsFloorDef, m: ParsedFloor, diff: Difficulty, report: FloorReport, soft: (s: string) => void, err: (s: string) => void): void {
  const c = cellsOf(m);
  const { w } = c;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= c.w || y >= c.h ? F_WALL : c.kind[y * w + x]);
  const isFloorCell = (x: number, y: number): boolean => (at(x, y) & (F_WALL | F_DOOR | F_PUSH | F_PROP)) === 0;
  const isWallish = (x: number, y: number): boolean => (at(x, y) & (F_WALL | F_PUSH)) !== 0;

  // Rule 4 (doors): walls on both sides of the plane, floor on both passage sides.
  for (let d = 0; d < m.doors.count; d++) {
    const x = m.doors.x[d];
    const y = m.doors.y[d];
    const vertical = m.doors.vertical[d] === 1;
    const wallsOk = vertical ? isWallish(x, y - 1) && isWallish(x, y + 1) : isWallish(x - 1, y) && isWallish(x + 1, y);
    const passOk = vertical ? isFloorCell(x - 1, y) && isFloorCell(x + 1, y) : isFloorCell(x, y - 1) && isFloorCell(x, y + 1);
    if (!wallsOk) err(`rule 4: door ${x},${y} lacks walls on both sides of its plane`);
    if (!passOk) err(`rule 4: door ${x},${y} lacks floor on both passage sides`);
  }

  // Rule 5: keys before their doors; secrets never required.
  const sx = Math.floor(m.start.x);
  const sy = Math.floor(m.start.y);
  const gold = m.items.find((i) => i.id === 'key-gold');
  const silver = m.items.find((i) => i.id === 'key-silver');
  let keys = 0;
  let seen = reach(c, sx, sy, keys);
  if (gold) {
    if (!seen[gold.y * w + gold.x]) err(`rule 5 (${diff}): the gold key ${gold.x},${gold.y} is not reachable without keys`);
    keys |= 1;
    seen = reach(c, sx, sy, keys);
  }
  if (silver) {
    if (!seen[silver.y * w + silver.x]) err(`rule 5 (${diff}): the silver key ${silver.x},${silver.y} is not reachable with ${gold ? 'the gold key' : 'no keys'}`);
    keys |= 2;
    seen = reach(c, sx, sy, keys);
  }
  const boss = m.actors.find((a) => a.type === 'boss');
  if (def.boss || boss) {
    if (!boss) err('rule 5: a boss floor without the boss "@"');
    else if (!seen[boss.y * w + boss.x]) err(`rule 5 (${diff}): the boss ${boss.x},${boss.y} is not reachable`);
  } else {
    if (!m.switches.length) err('rule 5: no elevator switch "X"');
    else if (!m.switches.some((s) => besideReached(c, seen, s.x, s.y))) err(`rule 5 (${diff}): no elevator switch is reachable`);
  }
  const base = seen;

  // Rule 6: every secret can be pushed from a reached cell into a free cell; contents reachable.
  // Pushes are applied one after another (a closet may hold the next push wall).
  const open = new Uint8Array(c.w * c.h);
  const pushedTo = new Uint8Array(c.w * c.h);
  const thingAt = new Set<number>();
  for (const it of m.items) thingAt.add(it.y * w + it.x);
  for (const p of m.props) thingAt.add(p.y * w + p.x);
  for (const a of m.actors) thingAt.add(a.y * w + a.x);
  let reached = base;
  const done = new Set<number>();
  for (let pass = 0; pass < m.pushes.length; pass++) {
    let moved = false;
    for (let k = 0; k < m.pushes.length; k++) {
      if (done.has(k)) continue;
      const p = m.pushes[k];
      for (let dk = 0; dk < 4; dk++) {
        const dx = dk === 0 ? 1 : dk === 2 ? -1 : 0;
        const dy = dk === 1 ? 1 : dk === 3 ? -1 : 0;
        // The player stands on the cell behind (p − d) and pushes toward +d.
        const fromX = p.x - dx;
        const fromY = p.y - dy;
        if (!(fromX >= 0 && fromY >= 0 && fromX < c.w && fromY < c.h && reached[fromY * w + fromX])) continue;
        const free = (x: number, y: number): boolean => isFloorCell(x, y) && !thingAt.has(y * w + x) && !pushedTo[y * w + x];
        if (!free(p.x + dx, p.y + dy)) continue;
        // It moves up to 2 tiles and stops early at a blocked cell.
        let ex = p.x + dx;
        let ey = p.y + dy;
        if (free(ex + dx, ey + dy)) {
          ex += dx;
          ey += dy;
        }
        open[p.y * w + p.x] = 1;
        pushedTo[ey * w + ex] = 1;
        c.kind[ey * w + ex] |= F_PUSH;
        done.add(k);
        moved = true;
        break;
      }
    }
    if (!moved) break;
    reached = reach(c, sx, sy, keys, open);
  }
  for (let k = 0; k < m.pushes.length; k++) {
    if (!done.has(k)) err(`rule 6 (${diff}): the push wall ${m.pushes[k].x},${m.pushes[k].y} cannot be pushed from a reachable cell into a free cell`);
  }
  for (const it of m.items) {
    if (!reached[it.y * w + it.x]) err(`rule 6 (${diff}): the ${it.id} at ${it.x},${it.y} is not reachable (even after every push)`);
  }
  if (count(reached) <= count(base) && m.pushes.length) err(`rule 6 (${diff}): the push walls open no new cells`);

  // Rule 7: push-wall count; one golden record, inside a secret.
  if (m.pushes.length !== def.secrets) err(`rule 7: ${m.pushes.length} push walls, the def says ${def.secrets}`);
  const records = m.items.filter((i) => i.id === 'golden-record');
  if (records.length !== 1) err(`rule 7 (${diff}): ${records.length} golden records (want 1)`);
  for (const r of records) if (base[r.y * w + r.x]) err(`rule 7 (${diff}): the golden record ${r.x},${r.y} is not inside a secret`);

  // Rule 8: ammo budget (items inside secrets do not count; reinforcements are not counted).
  let clips = 0;
  let guns = 0;
  let ups = 0;
  for (const it of m.items) {
    if (!base[it.y * w + it.x]) continue;
    if (it.id === 'clip') clips++;
    else if (it.id === 'mg' || it.id === 'chaingun') guns++;
    else if (it.id === 'one-up') ups++;
  }
  const di = diff === 'easy' ? 0 : diff === 'normal' ? 1 : 2;
  let hp = 0;
  let droppers = 0;
  let enemies = 0;
  for (const a of m.actors) {
    const t = ACTOR_TYPES[a.type];
    if (a.type === 'boss') hp += BOSS_HP[1][di] + BOSS_HP[2][di];
    else {
      hp += t.hp[di];
      enemies++;
      if (t.drop !== 'none') droppers++;
    }
  }
  const rounds = START_ROUNDS + CLIP_ROUNDS * clips + GUN_ROUNDS * guns + ONE_UP_ROUNDS * ups + (DROP_ROUNDS * droppers) / 2;
  const budget: AmmoBudget = { enemies, hp, rounds };
  report.budget[diff] = budget;
  if (rounds * AVG_BULLET < 1.5 * hp) soft(`rule 8: ${rounds} rounds × ${AVG_BULLET} < 1.5 × ${hp} HP`);

  // Rule 9: fair start — no enemy sees the start cell at load (doors closed).
  for (let d = 0; d < m.doors.count; d++) m.doors.open[d] = 0;
  for (const a of m.actors) {
    if (lineOfSight(m.grid, m.doors, null, a.x + 0.5, a.y + 0.5, m.start.x, m.start.y)) err(`rule 9 (${diff}): the ${a.type} at ${a.x},${a.y} sees the start`);
  }

  // Rules 10 and 11: the boss floor.
  if (!boss) return;
  const spawns = m.spawns.filter((s) => rank(diff) >= rank(s.minDiff));
  if (spawns.length !== REINFORCEMENTS[diff]) err(`rule 10 (${diff}): ${spawns.length} reinforcement spawns (want ${REINFORCEMENTS[diff]})`);
  const arena = room(c, boss.x, boss.y);
  for (const s of spawns) {
    if (!isFloorCell(s.x, s.y)) err(`rule 10: spawn ${s.x},${s.y} is not on floor`);
    if (arena[s.y * w + s.x]) err(`rule 10: spawn ${s.x},${s.y} is not behind a door`);
  }
  let arenaClips = 0;
  for (const it of m.items) if (it.id === 'clip' && arena[it.y * w + it.x]) arenaClips++;
  const ssHp = ACTOR_TYPES.ss.hp[di];
  const have = 99 + CLIP_ROUNDS * (arenaClips + WRECK_CLIPS) + DROP_ROUNDS * spawns.length;
  const need = (1.3 * (BOSS_HP[1][di] + BOSS_HP[2][di] + spawns.length * ssHp)) / AVG_ARENA_BULLET;
  budget.arenaRounds = have;
  budget.arenaNeed = Math.ceil(need);
  if (have < need) err(`rule 11 (${diff}): ${have} rounds < ${need.toFixed(0)} for the boss fight`);
}

const RANK: Readonly<Record<Difficulty, number>> = { easy: 0, normal: 1, hard: 2 };
function rank(d: Difficulty): number {
  return RANK[d];
}

/** The room of (x, y): floor cells linked without doors. */
export function room(c: { w: number; h: number; kind: Uint8Array }, x: number, y: number): Uint8Array {
  const seen = new Uint8Array(c.w * c.h);
  const q = [y * c.w + x];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const cx = i % c.w;
    const cy = (i / c.w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 2 ? -1 : 0);
      const ny = cy + (k === 1 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= c.w || ny >= c.h) continue;
      const j = ny * c.w + nx;
      if (seen[j] || (c.kind[j] & (F_WALL | F_DOOR | F_PUSH)) !== 0) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** The cells of a char that are things (actors, pickups, props) — for tools. */
export function isThingChar(ch: string): boolean {
  return ch in PICKUP_CHARS || ch in PROP_CHARS || 'ghiopqstudef@'.includes(ch);
}
