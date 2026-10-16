/**
 * Floor parsing (docs/design/fps.md §5): an ASCII grid + the §5.1 legend + `things[]` → a ray
 * grid, its doors, the push walls, the start and the placed actors, pickups and props.
 * Fail soft: unknown chars warn once per floor and become floor; a missing start warns and
 * uses the first floor cell; ragged rows are padded with wall.
 *
 * Texture ids resolve through `rayTextureIndex` (an id that is not registered draws the magenta
 * fallback with one warning), so parse after the fps content is loaded.
 */
import { ANG_90, CELL_PROP, CELL_PUSH, DoorTable, RayGrid, rayTextureIndex } from '../../engine/ray';
import type { Difficulty } from '../session';
import type { Cardinal, FpsFloorDef, FpsThing } from './types';

/** §5.1 / §8.1: wall letter → texture id. */
export const WALL_TEXTURES: Readonly<Record<string, string>> = {
  A: 'fps/wall/concrete',
  B: 'fps/wall/concrete-banner',
  C: 'fps/wall/brick',
  D: 'fps/wall/brick-notice',
  E: 'fps/wall/crates',
  F: 'fps/wall/wood',
  G: 'fps/wall/wood-map',
  H: 'fps/wall/steel',
  I: 'fps/wall/steel-vent',
  J: 'fps/wall/hangar',
  K: 'fps/wall/hangar-banner',
  L: 'fps/wall/freight',
  M: 'fps/wall/tile',
  N: 'fps/wall/cellar',
  O: 'fps/wall/sandbags',
  P: 'fps/wall/steel-pipes',
  X: 'fps/wall/switch',
  Y: 'fps/wall/elevator',
};
export const SWITCH_ON_TEXTURE = 'fps/wall/switch-on';

/** Door lock kinds (`ParsedFloor.doorLock`). */
export const LOCK_NONE = 0;
export const LOCK_GOLD = 1;
export const LOCK_SILVER = 2;
export const LOCK_LIFT = 3;
export const DOOR_TEXTURES: readonly string[] = ['fps/door/plain', 'fps/door/gold', 'fps/door/silver', 'fps/door/lift'];
export const DOOR_EDGE_TEXTURE = 'fps/door/edge';

/** Door chars: [vertical, lock]. `|` = the plane runs north–south (you pass east–west). */
const DOOR_CHARS: Readonly<Record<string, readonly [boolean, number]>> = {
  '|': [true, LOCK_NONE],
  '-': [false, LOCK_NONE],
  '!': [true, LOCK_GOLD],
  '=': [false, LOCK_GOLD],
  ':': [true, LOCK_SILVER],
  ';': [false, LOCK_SILVER],
  ']': [true, LOCK_LIFT],
  _: [false, LOCK_LIFT],
};

const START_CHARS: Readonly<Record<string, Cardinal>> = { '^': 'N', '>': 'E', v: 'S', '<': 'W' };

export type ActorType = 'guard' | 'officer' | 'ss' | 'dog' | 'boss';
const ACTOR_CHARS: Readonly<Record<string, readonly [ActorType, Difficulty]>> = {
  g: ['guard', 'easy'],
  h: ['guard', 'normal'],
  i: ['guard', 'hard'],
  o: ['officer', 'easy'],
  p: ['officer', 'normal'],
  q: ['officer', 'hard'],
  s: ['ss', 'easy'],
  t: ['ss', 'normal'],
  u: ['ss', 'hard'],
  d: ['dog', 'easy'],
  e: ['dog', 'normal'],
  f: ['dog', 'hard'],
  '@': ['boss', 'easy'],
};

/** §4.5 pickup chars → item ids (`fps/item/<id>`). */
export const PICKUP_CHARS: Readonly<Record<string, string>> = {
  '+': 'first-aid',
  n: 'food',
  r: 'ration',
  b: 'blood-pool',
  c: 'clip',
  w: 'mg',
  y: 'chaingun',
  '1': 'one-up',
  k: 'key-gold',
  l: 'key-silver',
  '5': 'pocket-watch',
  '6': 'tuning-fork',
  '7': 'gold-bars',
  '8': 'music-box',
  '9': 'golden-record',
};

/** §5.1 prop chars → [prop id (`fps/prop/<id>`), solid]. */
export const PROP_CHARS: Readonly<Record<string, readonly [string, boolean]>> = {
  Q: ['barrel', true],
  R: ['crates', true],
  S: ['pillar', true],
  T: ['table', true],
  U: ['banner-pole', true],
  V: ['lamp-stand', true],
  W: ['sandbags', true],
  Z: ['oil-drum', true],
  "'": ['ceiling-lamp', false],
  ',': ['debris', false],
  '"': ['chains', false],
};

const DIFF_RANK: Readonly<Record<Difficulty, number>> = { easy: 0, normal: 1, hard: 2 };
const CARDINALS: readonly Cardinal[] = ['N', 'E', 'S', 'W'];
const CARD_DX: Readonly<Record<Cardinal, number>> = { N: 0, E: 1, S: 0, W: -1 };
const CARD_DY: Readonly<Record<Cardinal, number>> = { N: -1, E: 0, S: 1, W: 0 };

/** Angle of a cardinal (E 0, S 1024, W 2048, N 3072). */
export function cardinalAngle(c: Cardinal): number {
  return c === 'E' ? 0 : c === 'S' ? ANG_90 : c === 'W' ? 2 * ANG_90 : 3 * ANG_90;
}

/** The facing cardinal of an angle: index `round(angle / 1024) & 3` → E, S, W, N (spec §4.1). */
export function cardinalIndex(angle: number): number {
  return Math.round(angle / ANG_90) & 3;
}
/** dx, dy of `cardinalIndex` 0..3 (E, S, W, N). */
export const DIR_DX: readonly number[] = [1, 0, -1, 0];
export const DIR_DY: readonly number[] = [0, 1, 0, -1];

export interface ParsedActor {
  type: ActorType;
  /** Cell. */
  x: number;
  y: number;
  facing: Cardinal;
  ambush: boolean;
  patrol: boolean;
  /** The map char (g … @). */
  char: string;
}
export interface ParsedItem {
  /** Item id (§4.5), e.g. 'key-gold'. */
  id: string;
  x: number;
  y: number;
}
export interface ParsedProp {
  id: string;
  x: number;
  y: number;
  solid: boolean;
}
export interface ParsedPush {
  x: number;
  y: number;
  /** Texture index. */
  tex: number;
  /** The wall letter of the texture. */
  letter: string;
}

export interface ParsedFloor {
  def: FpsFloorDef;
  w: number;
  h: number;
  grid: RayGrid;
  doors: DoorTable;
  /** Per door index: LOCK_NONE / GOLD / SILVER / LIFT. */
  doorLock: Uint8Array;
  /** Start cell centre and angle. */
  start: { x: number; y: number; angle: number };
  actors: ParsedActor[];
  items: ParsedItem[];
  props: ParsedProp[];
  pushes: ParsedPush[];
  /** Elevator switch walls (`X`). */
  switches: Array<{ x: number; y: number }>;
  turns: Array<{ x: number; y: number; dir: Cardinal }>;
  spawns: Array<{ x: number; y: number; minDiff: Difficulty }>;
  /** Texture index of the switch's "on" frame. */
  switchOnTex: number;
  warnings: string[];
}

const warnedFloors = new Set<string>();

function inDiff(d: Difficulty, min?: Difficulty, max?: Difficulty): boolean {
  if (min && DIFF_RANK[d] < DIFF_RANK[min]) return false;
  if (max && DIFF_RANK[d] > DIFF_RANK[max]) return false;
  return true;
}

function texOf(def: FpsFloorDef, letter: string): number {
  const id = def.walls?.[letter] ?? WALL_TEXTURES[letter] ?? WALL_TEXTURES.A;
  return rayTextureIndex(id);
}

/** True for a wall letter of the legend (`A`–`P`, `X`, `Y`). */
export function isWallChar(ch: string): boolean {
  return ch in WALL_TEXTURES;
}

/** Parse a floor for a difficulty. Never throws. */
export function parseFloor(def: FpsFloorDef, difficulty: Difficulty = 'normal'): ParsedFloor {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const warn = (key: string, msg: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(msg);
    const k = `${def.id}:${key}`;
    if (warnedFloors.has(k)) return;
    warnedFloors.add(k);
    console.warn(`[fps] ${def.id}: ${msg}`);
  };
  const rows = def.rows.length ? def.rows : ['A'];
  const h = rows.length;
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  for (let y = 0; y < h; y++) if (rows[y].length !== w) warn(`ragged:${y}`, `row ${y} has ${rows[y].length} cells, not ${w} (padded with wall)`);
  const charAt = (x: number, y: number): string => rows[y][x] ?? 'A';

  let doorChars = 0;
  for (const r of rows) for (const ch of r) if (ch in DOOR_CHARS) doorChars++;
  const grid = new RayGrid(w, h);
  const doors = new DoorTable(Math.max(64, doorChars));
  const doorLock = new Uint8Array(doors.max);
  doors.edgeTex = rayTextureIndex(DOOR_EDGE_TEXTURE);
  const doorTex = DOOR_TEXTURES.map((id) => rayTextureIndex(id));

  const things = new Map<string, FpsThing>();
  const turns: ParsedFloor['turns'] = [];
  const spawns: ParsedFloor['spawns'] = [];
  for (const t of def.things ?? []) {
    const [tx, ty] = t.at;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) {
      warn(`thing:${tx},${ty}`, `thing at ${tx},${ty} is outside the map`);
      continue;
    }
    if (t.turn) turns.push({ x: tx, y: ty, dir: t.turn });
    if (t.spawn) spawns.push({ x: tx, y: ty, minDiff: t.minDiff ?? 'easy' });
    if (t.turn || t.spawn) continue;
    things.set(`${tx},${ty}`, t);
  }

  let start: { x: number; y: number; angle: number } | null = null;
  const actors: ParsedActor[] = [];
  const items: ParsedItem[] = [];
  const props: ParsedProp[] = [];
  const pushes: ParsedPush[] = [];
  const switches: ParsedFloor['switches'] = [];
  const pushCells: Array<[number, number]> = [];
  /** Actors without a `things` facing (resolved after the grid is built). */
  const autoFacing: ParsedActor[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = charAt(x, y);
      const thing = things.get(`${x},${y}`);
      if (isWallChar(ch)) {
        grid.setWall(x, y, texOf(def, ch));
        if (ch === 'X') switches.push({ x, y });
        continue;
      }
      if (ch === '*') {
        pushCells.push([x, y]);
        continue;
      }
      const door = DOOR_CHARS[ch];
      if (door) {
        const i = doors.place(grid, x, y, door[0], doorTex[door[1]]);
        if (i >= 0) doorLock[i] = door[1];
        continue;
      }
      // Everything else stands on floor.
      if (ch === '.') continue;
      const st = START_CHARS[ch];
      if (st) {
        if (start) warn('start2', `more than one start (extra at ${x},${y} ignored)`);
        else start = { x: x + 0.5, y: y + 0.5, angle: cardinalAngle(st) };
        continue;
      }
      const actor = ACTOR_CHARS[ch];
      if (actor) {
        if (inDiff(difficulty, actor[1])) {
          const a: ParsedActor = { type: actor[0], x, y, facing: thing?.facing ?? 'N', ambush: thing?.ambush ?? false, patrol: thing?.patrol ?? false, char: ch };
          actors.push(a);
          if (!thing?.facing) autoFacing.push(a);
        }
        continue;
      }
      const item = PICKUP_CHARS[ch];
      if (item) {
        if (inDiff(difficulty, thing?.minDiff, thing?.maxDiff)) items.push({ id: item, x, y });
        continue;
      }
      const prop = PROP_CHARS[ch];
      if (prop) {
        if (inDiff(difficulty, thing?.minDiff, thing?.maxDiff)) {
          props.push({ id: prop[0], x, y, solid: prop[1] });
          if (prop[1]) grid.flags[grid.idx(x, y)] |= CELL_PROP;
        }
        continue;
      }
      warn(`char:${ch}`, `unknown map char "${ch}" at ${x},${y} (floor)`);
    }
  }

  // Push walls: texture from things.tex, else the most common wall letter among the 4 neighbours.
  for (const [x, y] of pushCells) {
    const t = things.get(`${x},${y}`);
    let letter = t?.tex && isWallChar(t.tex) ? t.tex : '';
    if (!letter) {
      const counts = new Map<string, number>();
      let best = '';
      let bestN = 0;
      for (const c of CARDINALS) {
        const nx = x + CARD_DX[c];
        const ny = y + CARD_DY[c];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ch = charAt(nx, ny);
        if (!isWallChar(ch) || ch === 'X' || ch === 'Y') continue;
        const n = (counts.get(ch) ?? 0) + 1;
        counts.set(ch, n);
        if (n > bestN) {
          bestN = n;
          best = ch;
        }
      }
      letter = best || 'A';
    }
    const tex = texOf(def, letter);
    grid.setWall(x, y, tex);
    grid.flags[grid.idx(x, y)] |= CELL_PUSH;
    pushes.push({ x, y, tex, letter });
  }

  if (!start) {
    warn('start0', 'no start (using the first floor cell)');
    outer: for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid.flags[grid.idx(x, y)] === 0) {
          start = { x: x + 0.5, y: y + 0.5, angle: 0 };
          break outer;
        }
      }
    }
    start ??= { x: 0.5, y: 0.5, angle: 0 };
  }

  // Default actor facing: the cardinal with the longest free run of floor cells (ties N, E, S, W).
  for (const a of autoFacing) {
    let best: Cardinal = 'N';
    let bestRun = -1;
    for (const c of CARDINALS) {
      let run = 0;
      let cx = a.x + CARD_DX[c];
      let cy = a.y + CARD_DY[c];
      while (grid.inside(cx, cy) && grid.flags[grid.idx(cx, cy)] === 0) {
        run++;
        cx += CARD_DX[c];
        cy += CARD_DY[c];
      }
      if (run > bestRun) {
        bestRun = run;
        best = c;
      }
    }
    a.facing = best;
  }

  // things[] entries must point at a cell that holds a thing.
  for (const [key, t] of things) {
    const ch = charAt(t.at[0], t.at[1]);
    const ok = ch === '*' ? true : ch in ACTOR_CHARS || ch in PICKUP_CHARS || ch in PROP_CHARS;
    if (!ok) warn(`thing:${key}`, `thing at ${key} points at "${ch}", not a thing`);
  }

  return {
    def,
    w,
    h,
    grid,
    doors,
    doorLock,
    start,
    actors,
    items,
    props,
    pushes,
    switches,
    turns,
    spawns,
    switchOnTex: rayTextureIndex(SWITCH_ON_TEXTURE),
    warnings,
  };
}
