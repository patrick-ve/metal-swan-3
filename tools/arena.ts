/**
 * npm run arena -- [--spawn "id@x[,y][{k:v}];…"] [--vehicle id[{k:v}]] [--water x0-x1[:depth]]
 *                  [--gap x:width] [--platform x,y,len] [--solid x,y,w,h] [--slope x:len:dy]
 *                  [--step x:dy] [--width 2400] [--x 80] [--bg m0|plain] [--ticks 60]
 *                  [--every N --count K] [--scale 2] [--cols 3] [--out file.png] [--hold right,fire]
 *                  [--press "30:jump;45:jump,fire"] [--trace id,player] [--trace-every 1]
 *                  [--players 1|2] [--god] [--bot] [--weapon id] [--difficulty normal] [--seed 1]
 *                  [--res 1] [--gfx pixel|smooth|xbr]
 *
 * Entity sandbox (docs/api/slice.md §8, docs/ARCHITECTURE.md §9): a flat test section — floor at
 * y 170, no timer, empty script — with optional water, pits, platforms, solids, slopes and steps.
 * Entities spawn through the normal world factory (unknown ids → magenta placeholders), player 1
 * can start in a vehicle, input comes from --hold / --press (or --bot), --trace prints one line
 * per tick, and frames are saved like `npm run shot` (tmp/arena/). Ends with a JSON summary;
 * exit code 1 on errors.
 *
 * The `arena` mission is registered with the normal `defineMission` API, but only inside this
 * process; it is never part of the content manifest. Everything is exported for
 * tests/tools/arena.test.ts; `main()` runs only when this file is the entry point.
 */
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withAlpha } from '../src/engine/color';
import type { Entity } from '../src/engine/entity';
import { drawText, measure } from '../src/engine/font';
import { buttonMask, type Button } from '../src/engine/input';
import { PAL } from '../src/engine/palette';
import { PixelBuffer } from '../src/engine/pixel';
import { Animator, defineSprite, hasSprite } from '../src/engine/sprites';
import { Terrain, terrain, type TerrainDef } from '../src/engine/terrain';
import { loadContent } from '../src/game/content/index';
import type { BackgroundDef, DecorDef, MissionDef, SectionDef, TerrainStyleDef } from '../src/game/mission/index';
import { Player, type Mountable } from '../src/game/player/player';
import { defineMission, getMission, hasEntity, hasWeapon, listWeapons, type SpawnParams } from '../src/game/registry';
import type { Difficulty } from '../src/game/session';
import { isGraphicsMode } from '../src/game/settings';
import type { UpscaleMode } from '../src/engine/upscale';
import { applyTuning } from '../src/game/tuning';
import { Vehicle } from '../src/game/vehicle';
import { createHeadlessGame, type HeadlessGame, type SimError } from '../src/sim/index';
import { resolveGfx } from './lib/gfx';
import { savePNG, SHEET } from './lib/image';

/** Feet y of anything standing on the flat arena floor. */
export const FLOOR = 170;
export const ARENA_H = 216;
/** Mission id of the sandbox (registered only inside the tool process). */
export const ARENA_ID = 'arena';
/** Default water depth below the floor line (px). */
export const WATER_DEPTH = 48;

// ---------------------------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------------------------

/** One `--spawn` entry: `id@x[,y][{k:v}]`. */
export interface SpawnSpec {
  id: string;
  /** Absolute x, or (rel) an offset from player 1's start x (`+dx` / `-dx`). */
  x: number;
  rel: boolean;
  /** Feet y (default: the top floor or water surface under x). */
  y?: number;
  params: Record<string, unknown>;
}

/** Buttons held during ticks `from`..`to` (1-based; `--press 30:jump` = 30..30). */
export interface PressSpec {
  from: number;
  to: number;
  mask: number;
}

export interface ArenaArgs {
  help: boolean;
  width: number;
  /** Player 1 start x. */
  x: number;
  bg: 'm0' | 'plain';
  water: Array<{ x0: number; x1: number; depth: number }>;
  gaps: Array<{ x: number; w: number }>;
  platforms: Array<{ x: number; y: number; len: number }>;
  solids: Array<{ x: number; y: number; w: number; h: number }>;
  slopes: Array<{ x: number; len: number; dy: number }>;
  steps: Array<{ x: number; dy: number }>;
  spawns: SpawnSpec[];
  vehicle: { id: string; params: Record<string, unknown> } | null;
  players: 1 | 2;
  god: boolean;
  bot: boolean;
  weapon?: string;
  difficulty: Difficulty;
  seed: number;
  hold: Button[];
  presses: PressSpec[];
  ticks: number;
  every: number;
  count: number;
  /** 0 = 2 for one frame, 1 for a contact sheet (always 1 with res > 1). */
  scale: number;
  /** Backbuffer resolution of the frames (docs/ARCHITECTURE.md §3; 1 = the classic image). */
  res: number;
  /** Sprite filter at res > 1 (null = smooth). */
  gfx: UpscaleMode | null;
  cols: number;
  out?: string;
  trace: string[];
  traceEvery: number;
}

export function defaultArenaArgs(): ArenaArgs {
  return {
    help: false,
    width: 2400,
    x: 80,
    bg: 'm0',
    water: [],
    gaps: [],
    platforms: [],
    solids: [],
    slopes: [],
    steps: [],
    spawns: [],
    vehicle: null,
    players: 1,
    god: false,
    bot: false,
    difficulty: 'normal',
    seed: 1,
    hold: [],
    presses: [],
    ticks: 60,
    every: 0,
    count: 1,
    scale: 0,
    res: 1,
    gfx: null,
    cols: 3,
    trace: [],
    traceEvery: 1,
  };
}

const BUTTONS: readonly Button[] = ['left', 'right', 'up', 'down', 'fire', 'jump', 'bomb', 'start'];
const N = '(\\d+(?:\\.\\d+)?)';
const SN = '(-?\\d+(?:\\.\\d+)?)';
const RE = {
  water: new RegExp(`^${N}-${N}(?::${N})?$`),
  gap: new RegExp(`^${N}:${N}$`),
  platform: new RegExp(`^${N},${SN},${N}$`),
  solid: new RegExp(`^${N},${SN},${N},${N}$`),
  slope: new RegExp(`^${N}:${N}:${SN}$`),
  step: new RegExp(`^${N}:${SN}$`),
};

/** Match a compact option value (spaces ignored) and return its numbers (NaN for a missing group). */
function numbers(opt: string, value: string, re: RegExp, form: string): number[] {
  const m = re.exec(value.replace(/\s+/g, ''));
  if (!m) throw new Error(`${opt} "${value}": expected ${form}`);
  return m.slice(1).map((s) => (s === undefined ? NaN : Number(s)));
}

/**
 * Parse the command line (without `node tools/arena.ts`). Throws on unknown options and bad
 * values; `--help` only sets `help`.
 */
export function parseArenaArgs(argv: readonly string[]): ArenaArgs {
  const a = defaultArenaArgs();
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value after ${s}`);
      return v;
    };
    const num = (): number => {
      const v = next();
      const n = Number(v);
      if (v.trim() === '' || !Number.isFinite(n)) throw new Error(`${s} needs a number, got "${v}"`);
      return n;
    };
    const int = (min: number, max: number): number => Math.max(min, Math.min(max, Math.round(num())));
    switch (s) {
      case '--width':
        a.width = int(384, 32768);
        break;
      case '--x': {
        const x = num();
        if (x < 0) throw new Error('--x must be ≥ 0');
        a.x = x;
        break;
      }
      case '--bg': {
        const v = next();
        if (v !== 'm0' && v !== 'plain') throw new Error('--bg must be m0 or plain');
        a.bg = v;
        break;
      }
      case '--water': {
        const v = next();
        const [x0, x1, depth] = numbers(s, v, RE.water, 'x0-x1[:depth], e.g. 300-700 or 300-700:16');
        a.water.push({ x0, x1, depth: Number.isNaN(depth) ? WATER_DEPTH : depth });
        break;
      }
      case '--gap': {
        const [x, w] = numbers(s, next(), RE.gap, 'x:width, e.g. 600:48');
        a.gaps.push({ x, w });
        break;
      }
      case '--platform': {
        const [x, y, len] = numbers(s, next(), RE.platform, 'x,y,len, e.g. 400,130,64');
        a.platforms.push({ x, y, len });
        break;
      }
      case '--solid': {
        const [x, y, w, h] = numbers(s, next(), RE.solid, 'x,y,w,h, e.g. 500,138,32,32');
        a.solids.push({ x, y, w, h });
        break;
      }
      case '--slope': {
        const [x, len, dy] = numbers(s, next(), RE.slope, 'x:len:dy, e.g. 300:48:-48 (dy < 0 = up)');
        a.slopes.push({ x, len, dy });
        break;
      }
      case '--step': {
        const [x, dy] = numbers(s, next(), RE.step, 'x:dy, e.g. 500:-16 (dy < 0 = up)');
        a.steps.push({ x, dy });
        break;
      }
      case '--spawn': {
        const r = rejoinSpawn(next(), argv, i);
        i += r.used;
        a.spawns.push(...parseSpawnList(r.value));
        break;
      }
      case '--vehicle':
        a.vehicle = parseVehicle(next());
        break;
      case '--players':
        a.players = next() === '2' ? 2 : 1;
        break;
      case '--god':
        a.god = true;
        break;
      case '--bot':
        a.bot = true;
        break;
      case '--weapon':
        a.weapon = next();
        break;
      case '--difficulty': {
        const d = next();
        if (d !== 'easy' && d !== 'normal' && d !== 'hard') throw new Error('--difficulty must be easy, normal or hard');
        a.difficulty = d;
        break;
      }
      case '--seed':
        a.seed = num() >>> 0;
        break;
      case '--hold':
        a.hold = parseButtons(next(), s);
        break;
      case '--press':
        a.presses.push(...parsePresses(next()));
        break;
      case '--ticks':
        a.ticks = int(0, 1_000_000);
        break;
      case '--every':
        a.every = int(1, 1_000_000);
        break;
      case '--count':
        a.count = int(1, 64);
        break;
      case '--scale':
        a.scale = int(1, 6);
        break;
      case '--res':
        a.res = int(1, 8);
        break;
      case '--gfx': {
        const g = next().toLowerCase();
        if (!isGraphicsMode(g)) throw new Error(`--gfx must be pixel, smooth or xbr, got "${g}"`);
        a.gfx = g;
        break;
      }
      case '--cols':
        a.cols = int(1, 8);
        break;
      case '--out':
        a.out = next();
        break;
      case '--trace':
        for (const id of next().split(',')) if (id.trim()) a.trace.push(id.trim());
        break;
      case '--trace-every':
        a.traceEvery = int(1, 1_000_000);
        break;
      case '--help':
      case '-h':
        a.help = true;
        break;
      default:
        if (!s.startsWith('-')) throw new Error(`unexpected "${s}": ${BRACE_HINT}`);
        throw new Error(`unknown option ${s}`);
    }
  }
  return a;
}

const BRACE_HINT = 'npm run passes {a,b} unquoted to the shell, which splits it; write a space after each comma in params, e.g. {cells:5, shells:20}';
const SPAWN_HEAD = /^[^@{}\s;]+@[+-]?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)?/;

/**
 * `npm run` hands arguments to `sh -c` without quoting `{` `,` `}`, so the shell brace-expands
 * `rifleman@420{patrol:64,gag:false}` into `rifleman@420patrol:64 rifleman@420gag:false`. Glue
 * such words (same `id@x[,y]` head, braces gone) back into one spec. `used` = extra words taken.
 */
export function rejoinSpawn(value: string, argv: readonly string[], i: number): { value: string; used: number } {
  const head = SPAWN_HEAD.exec(value)?.[0];
  if (!head || head.length === value.length || /[{};]/.test(value)) return { value, used: 0 };
  const parts = [value.slice(head.length)];
  let used = 0;
  for (let k = i + 1; k < argv.length; k++) {
    const w = argv[k];
    if (w.startsWith('--') || SPAWN_HEAD.exec(w)?.[0] !== head || w.length === head.length) break;
    parts.push(w.slice(head.length));
    used++;
  }
  return { value: `${head}{${parts.join(',')}}`, used };
}

/** `right,fire` → buttons (unknown names throw). */
export function parseButtons(list: string, opt = '--hold'): Button[] {
  const out: Button[] = [];
  for (const raw of list.split(',')) {
    const b = raw.trim();
    if (!b) continue;
    if (!(BUTTONS as readonly string[]).includes(b)) throw new Error(`${opt}: unknown button "${b}" (buttons: ${BUTTONS.join(' ')})`);
    out.push(b as Button);
  }
  return out;
}

/** `30:jump;45:jump,fire;60-90:right` → one-tick presses (or from-to holds). Ticks count from 1. */
export function parsePresses(text: string): PressSpec[] {
  return splitTop(text, ';').map((part) => {
    const m = /^(\d+)(?:-(\d+))?:(.+)$/.exec(part.replace(/\s+/g, ''));
    if (!m) throw new Error(`--press "${part}": expected tick:buttons or from-to:buttons, e.g. 30:jump or 30-60:right,fire`);
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < from) throw new Error(`--press "${part}": ticks count from 1 and the range must not go backwards`);
    return { from, to, mask: buttonMask(...parseButtons(m[3], '--press')) };
  });
}

/** Buttons of the `--press` list down during tick `t` (1-based). */
export function pressMaskAt(presses: readonly PressSpec[], t: number): number {
  let m = 0;
  for (const p of presses) if (t >= p.from && t <= p.to) m |= p.mask;
  return m;
}

/** `rifleman@+80;crate@300,140{contains:bombs}` → spawn specs (`;` inside {…} or quotes is kept). */
export function parseSpawnList(text: string): SpawnSpec[] {
  return splitTop(text, ';').map(parseSpawn);
}

/** One spawn spec: `id@x[,y][{k:v,…}]`; x with a sign (`+60`, `-40`) is relative to player 1's start. */
export function parseSpawn(spec: string): SpawnSpec {
  const s = spec.trim();
  const brace = s.indexOf('{');
  const head = (brace >= 0 ? s.slice(0, brace) : s).replace(/\s+/g, '');
  const m = /^([^@{}]+)@([+-]?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?$/.exec(head);
  if (!m) throw new Error(`--spawn "${s}": expected id@x[,y][{k:v,…}] (x absolute, or +dx / -dx from player 1's start)`);
  const spawn: SpawnSpec = {
    id: m[1],
    x: Number(m[2]),
    rel: m[2].startsWith('+') || m[2].startsWith('-'),
    params: brace >= 0 ? parseParams(s.slice(brace), `--spawn "${s}"`) : {},
  };
  if (m[3] !== undefined) spawn.y = Number(m[3]);
  return spawn;
}

/** `swan` or `swan{cells:5}`. */
export function parseVehicle(text: string): { id: string; params: Record<string, unknown> } {
  const s = text.trim();
  const brace = s.indexOf('{');
  const id = (brace >= 0 ? s.slice(0, brace) : s).trim();
  if (!id || /[@\s]/.test(id)) throw new Error(`--vehicle "${s}": expected id or id{k:v,…}`);
  return { id, params: brace >= 0 ? parseParams(s.slice(brace), `--vehicle "${s}"`) : {} };
}

/** Split at `sep` outside quotes, braces and brackets; trims and drops empty parts. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (c === sep && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * JSON-ish spawn params: `{hp:30, gag:false, contains:machine-gun, kind:'golden record', list:[a,b],
 * drop:{id:pickup-bombs}}`. Keys may be unquoted; bare words become numbers, true / false / null,
 * or strings; quote strings that contain spaces or `,:{}[]`.
 */
export function parseParams(text: string, where = 'params'): Record<string, unknown> {
  const r = new ParamReader(text, where);
  const v = r.value();
  r.end();
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw r.fail('expected an object {k:v,…}');
  return v as Record<string, unknown>;
}

class ParamReader {
  private readonly s: string;
  private readonly where: string;
  private i = 0;

  constructor(s: string, where: string) {
    this.s = s;
    this.where = where;
  }

  fail(msg: string): Error {
    return new Error(`${this.where}: ${msg} (column ${this.i + 1} of ${this.s})`);
  }

  end(): void {
    this.ws();
    if (this.i < this.s.length) throw this.fail(`unexpected "${this.s[this.i]}"`);
  }

  value(): unknown {
    this.ws();
    const c = this.s[this.i];
    if (c === '{') return this.object();
    if (c === '[') return this.array();
    if (c === '"' || c === "'") return this.quoted();
    return bareValue(this.bare());
  }

  private ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  private object(): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    this.i++;
    this.ws();
    if (this.s[this.i] === '}') {
      this.i++;
      return o;
    }
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      const key = c === '"' || c === "'" ? this.quoted() : this.bare();
      this.ws();
      if (this.s[this.i] !== ':') throw this.fail(`expected ":" after "${key}"`);
      this.i++;
      o[key] = this.value();
      if (this.closes('}')) return o;
    }
  }

  private array(): unknown[] {
    const list: unknown[] = [];
    this.i++;
    this.ws();
    if (this.s[this.i] === ']') {
      this.i++;
      return list;
    }
    for (;;) {
      list.push(this.value());
      if (this.closes(']')) return list;
    }
  }

  /** After an item: ',' (a trailing comma before `close` is fine) or `close`. True when closed. */
  private closes(close: string): boolean {
    this.ws();
    const c = this.s[this.i];
    if (c === close) {
      this.i++;
      return true;
    }
    if (c !== ',') throw this.fail(c === undefined ? `missing "${close}"` : `expected "," or "${close}"`);
    this.i++;
    this.ws();
    if (this.s[this.i] === close) {
      this.i++;
      return true;
    }
    return false;
  }

  private quoted(): string {
    const q = this.s[this.i++];
    let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === q) return out;
      if (c === '\\' && this.i < this.s.length) {
        const e = this.s[this.i++];
        out += e === 'n' ? '\n' : e === 't' ? '\t' : e;
      } else out += c;
    }
    throw this.fail('missing closing quote');
  }

  private bare(): string {
    const start = this.i;
    while (this.i < this.s.length && !/[\s,:{}[\]"']/.test(this.s[this.i])) this.i++;
    if (this.i === start) throw this.fail(this.i < this.s.length ? `unexpected "${this.s[this.i]}"` : 'missing value');
    return this.s.slice(start, this.i);
  }
}

function bareValue(w: string): unknown {
  if (w === 'true') return true;
  if (w === 'false') return false;
  if (w === 'null') return null;
  const n = Number(w);
  return Number.isFinite(n) ? n : w;
}

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

/** A body of water: the hazard rect (top = the surface). */
export interface WaterRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type GroundFeature =
  | { kind: 'water'; x: number; len: number; depth: number; label: string }
  | { kind: 'gap'; x: number; len: number; label: string }
  | { kind: 'slope'; x: number; len: number; dy: number; label: string }
  | { kind: 'step'; x: number; len: 0; dy: number; label: string };

/** The built arena ground: terrain data, water rects and the spawn floor query. */
export interface ArenaGround {
  readonly def: TerrainDef;
  readonly terrain: Terrain;
  readonly water: readonly WaterRect[];
  /** Feet y for a spawn at x: the top floor (ground, platform, solid) or water surface; a pit's rim. */
  floorTop(x: number): number;
}

/**
 * Fluent builder for the arena ground: a flat floor at FLOOR across the width, with features
 * placed by x (any order; ground features must not overlap).
 * ```ts
 * new ArenaTerrain(2400).water(600, 900).gap(1200, 48).slope(1400, 48, -48).step(1600, 16)
 *   .platform(300, 130, 64).solid(500, 138, 32, 32).build();
 * ```
 */
export class ArenaTerrain {
  readonly width: number;
  private readonly ground: GroundFeature[] = [];
  private readonly platforms: Array<{ x: number; y: number; len: number }> = [];
  private readonly solids: Array<{ x: number; y: number; w: number; h: number }> = [];

  constructor(width: number) {
    this.width = width;
  }

  /** Water from x0 to x1: the floor under it drops `depth` px and a 'water' hazard fills the hole. */
  water(x0: number, x1: number, depth = WATER_DEPTH): this {
    const label = `--water ${x0}-${x1}:${depth}`;
    if (!(x1 > x0) || !(depth > 0)) throw new Error(`${label}: needs x1 > x0 and depth > 0`);
    return this.addGround({ kind: 'water', x: x0, len: x1 - x0, depth, label });
  }

  /** A pit `w` px wide (no ground; a 'pit' hazard 20 px under the rim). */
  gap(x: number, w: number): this {
    const label = `--gap ${x}:${w}`;
    if (!(w > 0)) throw new Error(`${label}: needs a width > 0`);
    return this.addGround({ kind: 'gap', x, len: w, label });
  }

  /** The floor rises (dy < 0) or falls over `len` px from x and stays at the new height. */
  slope(x: number, len: number, dy: number): this {
    const label = `--slope ${x}:${len}:${dy}`;
    if (!(len > 0)) throw new Error(`${label}: needs a length > 0`);
    return this.addGround({ kind: 'slope', x, len, dy, label });
  }

  /** A vertical step at x (dy < 0 = up). */
  step(x: number, dy: number): this {
    const label = `--step ${x}:${dy}`;
    if (dy === 0) throw new Error(`${label}: dy must not be 0`);
    return this.addGround({ kind: 'step', x, len: 0, dy, label });
  }

  /** One-way platform with its top at y. */
  platform(x: number, y: number, len: number): this {
    if (!(len > 0)) throw new Error(`--platform ${x},${y},${len}: needs a length > 0`);
    this.inside(x + len, `--platform ${x},${y},${len}`);
    this.platforms.push({ x, y, len });
    return this;
  }

  /** Solid block, top-left at (x, y). */
  solid(x: number, y: number, w: number, h: number): this {
    if (!(w > 0) || !(h > 0)) throw new Error(`--solid ${x},${y},${w},${h}: needs w and h > 0`);
    this.inside(x + w, `--solid ${x},${y},${w},${h}`);
    this.solids.push({ x, y, w, h });
    return this;
  }

  build(): ArenaGround {
    const t = terrain(this.width, ARENA_H);
    const g = t.ground().at(0, FLOOR);
    const water: WaterRect[] = [];
    const rims: Array<{ x: number; w: number; y: number }> = [];
    let x = 0;
    let last: GroundFeature | null = null;
    for (const f of [...this.ground].sort((a, b) => a.x - b.x)) {
      if (last && f.x < x) throw new Error(`arena terrain: ${f.label} overlaps ${last.label}`);
      if (f.x > x) g.flat(f.x - x);
      switch (f.kind) {
        case 'water': {
          const surface = g.y;
          g.step(f.depth).flat(f.len).step(-f.depth);
          t.hazard('water', f.x, surface, f.len, f.depth);
          water.push({ x: f.x, y: surface, w: f.len, h: f.depth });
          break;
        }
        case 'gap':
          rims.push({ x: f.x, w: f.len, y: g.y });
          t.hazard('pit', f.x, g.y + 20, f.len, 60);
          g.gap(f.len);
          break;
        case 'slope':
          g.slope(f.len, f.dy);
          break;
        case 'step':
          g.step(f.dy);
          break;
      }
      x = f.x + f.len;
      last = f;
    }
    if (x < this.width) g.flat(this.width - x);
    for (const p of this.platforms) t.platform(p.x, p.y, p.len);
    for (const s of this.solids) t.solid(s.x, s.y, s.w, s.h);
    const def = t.build();
    const ter = new Terrain(def);
    return {
      def,
      terrain: ter,
      water,
      floorTop(px: number): number {
        let top = ter.surfaceY(px, ter.bounds.y, Infinity);
        for (const w of water) if (px >= w.x && px < w.x + w.w && w.y < top) top = w.y;
        if (Number.isFinite(top)) return top;
        for (const r of rims) if (px >= r.x && px < r.x + r.w) return r.y;
        return FLOOR;
      },
    };
  }

  private addGround(f: GroundFeature): this {
    if (f.x < 0) throw new Error(`${f.label}: x must be ≥ 0`);
    this.inside(f.x + f.len, f.label);
    this.ground.push(f);
    return this;
  }

  private inside(right: number, label: string): void {
    if (right > this.width) throw new Error(`${label}: reaches x ${right}, past the arena width ${this.width} (use --width)`);
  }
}

// ---------------------------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------------------------

const PLAIN_BG: BackgroundDef = { sky: PAL.sky[3], layers: [{ gen: 'sky-gradient', params: { ramp: 'sky' }, factorX: 0 }] };
const PLAIN_STYLE: TerrainStyleDef = { ground: 'dirt', edge: 'grass', platform: 'wood', solid: 'crate' };
/** Water decor is cut into pieces this wide (decor is culled by its left edge). */
const WATER_PIECE = 128;

export interface ArenaBuild {
  mission: MissionDef;
  ground: ArenaGround;
}

/**
 * The `arena` mission: one free-scrolling section `a` without a timer and with an empty script;
 * background and terrain style from `base` (m0 section a) unless `--bg plain`.
 */
export function buildArena(a: ArenaArgs, base: Pick<SectionDef, 'background' | 'terrainStyle'> | null): ArenaBuild {
  const t = new ArenaTerrain(a.width);
  for (const w of a.water) t.water(w.x0, w.x1, w.depth);
  for (const g of a.gaps) t.gap(g.x, g.w);
  for (const s of a.slopes) t.slope(s.x, s.len, s.dy);
  for (const s of a.steps) t.step(s.x, s.dy);
  for (const p of a.platforms) t.platform(p.x, p.y, p.len);
  for (const s of a.solids) t.solid(s.x, s.y, s.w, s.h);
  const ground = t.build();
  if (a.x > a.width) throw new Error(`--x ${a.x} is past the arena width ${a.width}`);
  const section: SectionDef = {
    id: 'a',
    name: 'Arena',
    width: a.width,
    height: ARENA_H,
    scroll: 'free',
    background: a.bg === 'plain' || !base ? PLAIN_BG : base.background,
    terrain: ground.def,
    terrainStyle: base?.terrainStyle ?? PLAIN_STYLE,
    decor: waterDecor(ground.water),
    playerStart: { x: a.x, y: ground.floorTop(a.x) },
    timeLimit: 0,
    *script() {},
  };
  const mission: MissionDef = { id: ARENA_ID, name: 'ARENA', subtitle: 'SANDBOX', music: '', start: 'a', sections: { a: section } };
  return { mission, ground };
}

/** Water is not painted by the section view: an opaque body behind and a see-through front layer. */
function waterDecor(water: readonly WaterRect[]): DecorDef[] {
  const out: DecorDef[] = [];
  for (const w of water) {
    for (let x = w.x; x < w.x + w.w; x += WATER_PIECE) {
      const id = waterSprite(Math.min(WATER_PIECE, w.x + w.w - x), w.h);
      out.push({ sprite: `${id}-back`, x, y: w.y });
      out.push({ sprite: id, x, y: w.y, front: true, animate: true });
    }
  }
  return out;
}

/** Registers `arena/water-<w>x<h>` (front, 4 frames) and `…-back` once per size. */
function waterSprite(w: number, h: number): string {
  const id = `arena/water-${w}x${h}`;
  if (hasSprite(id)) return id;
  const depth = [PAL.sky[1], PAL.sky[0], PAL.navy[1], PAL.navy[0]];
  defineSprite(
    `${id}-back`,
    () => {
      const b = new PixelBuffer(w, h);
      for (let y = 0; y < h; y++) b.rect(0, y, w, 1, depth[Math.min(depth.length - 1, Math.floor(y / 12))]);
      // Faint current lines.
      for (let y = 6; y < h; y += 7) for (let x = 0; x < w; x++) if (((x + y * 5) & 31) < 6) b.set(x, y, PAL.sky[2]);
      return b;
    },
    { anchor: 'top-left' },
  );
  defineSprite(
    id,
    () =>
      [0, 1, 2, 3].map((f) => {
        const b = new PixelBuffer(w, h);
        b.rect(0, 2, w, Math.max(0, h - 2), withAlpha(PAL.sky[0], 96));
        for (let x = 0; x < w; x++) {
          b.set(x, 0, ((x + f * 3) & 15) < 5 ? PAL.snow[2] : PAL.sky[3]);
          b.set(x, 1, withAlpha(PAL.sky[2], 200));
        }
        return b;
      }),
    { anchor: 'top-left', ticksPerFrame: 8 },
  );
  return id;
}

// ---------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------

export interface ArenaIO {
  out(line: string): void;
  err(line: string): void;
}

export const STDIO: ArenaIO = {
  out: (line) => void process.stdout.write(`${line}\n`),
  err: (line) => void process.stderr.write(`${line}\n`),
};

export interface ArenaSummary {
  ticks: number;
  seed: number;
  file: string | null;
  errors: SimError[];
  warnings: string[];
  missingSfx: string[];
  missingSongs: string[];
  /** Spawned / vehicle ids that are not registered (drawn as placeholders). */
  unknownIds: string[];
  /** Live entities by id at the end. */
  alive: Record<string, number>;
  player: { x: number; y: number; state: string; vehicle: string | null; weapon: string; lives: number } | null;
  kills: number;
  deaths: number;
  deathCauses: Record<string, number>;
}

export interface ArenaRunOpts {
  io?: ArenaIO;
  /** Write the PNG (default true; tests turn it off). */
  save?: boolean;
}

interface Shot {
  buf: PixelBuffer;
  label: string[];
}

/** Build the arena, run it headless and return the summary (printing traces and the frame path). */
export async function runArena(a: ArenaArgs, o: ArenaRunOpts = {}): Promise<ArenaSummary> {
  const io = o.io ?? STDIO;
  const notes: string[] = [];
  const warn = (msg: string): void => {
    notes.push(msg);
    io.err(`arena: ${msg}`);
  };

  // Content first: the arena copies m0's background and needs every entity id registered.
  applyTuning();
  await loadContent();
  const m0 = getMission('m0')?.sections.a ?? null;
  if (!m0) warn('m0 section a is not registered: plain background and default terrain style');
  const { mission, ground } = buildArena(a, m0);
  defineMission(mission);
  if (a.weapon && !hasWeapon(a.weapon)) warn(`unknown weapon "${a.weapon}" (the pistol is used); weapons: ${listWeapons().join(' ')}`);

  const gfxWarning = resolveGfx(a.res, a.gfx).warning;
  if (gfxWarning) warn(gfxWarning);
  const hold = buttonMask(...a.hold.filter((b) => b !== 'fire'));
  const tapFire = a.hold.includes('fire');
  const fire = buttonMask('fire');
  const scripted = a.hold.length > 0 || a.presses.length > 0;
  const game = await createHeadlessGame({
    missionId: ARENA_ID,
    seed: a.seed,
    players: a.players,
    god: a.god,
    bot: a.bot,
    weapon: a.weapon,
    difficulty: a.difficulty,
    res: a.res,
    gfx: resolveGfx(a.res, a.gfx).mode,
    // The source's tick k is read while game tick k + 1 runs (ticks count from 1).
    input: scripted ? (k) => hold | (tapFire && k % 2 === 0 ? fire : 0) | pressMaskAt(a.presses, k + 1) : undefined,
  });

  let file: string | null = null;
  const unknown = new Set<string>();
  try {
    const runner = game.runner;
    if (!runner) throw new Error(`the arena did not start: ${game.report().errors.map((e) => e.message).join('; ')}`);
    const world = runner.world;
    // A clean view from the first frame: no mission banner, no start blink.
    runner.hud.clearBanner();
    for (const p of runner.players) p.invulnTicks = 0;

    const placed: string[] = [];
    const watched = new Set<Entity>();
    for (const s of a.spawns) {
      if (!hasEntity(s.id)) unknown.add(s.id);
      const x = s.rel ? a.x + s.x : s.x;
      const y = s.y ?? ground.floorTop(x);
      const e = world.spawn(s.id, x, y, s.params as SpawnParams);
      watched.add(e);
      placed.push(`${s.id}#${e.id} ${fmt(x)},${fmt(y)}`);
    }
    world.flush();
    // The game's own rules still apply: say so when a spawned entity leaves while alive.
    world.events.on('remove', (e) => {
      if (!watched.has(e) || e.dead) return;
      const why = e.y > world.terrain.killY ? 'fell out of the world' : `despawned: more than ${e.despawnMargin} px outside the view after being near it`;
      warn(`t=${game.ticks + 1} ${e.type}#${e.id} removed while alive at ${fmt(e.x)},${fmt(e.y)} (${why})`);
    });
    if (a.vehicle && !hasEntity(a.vehicle.id)) unknown.add(a.vehicle.id);
    if (unknown.size) warn(`unknown entity ids (drawn as placeholders): ${[...unknown].join(', ')}`);
    io.out(
      `arena ${a.width} px, floor y ${FLOOR}, P1 start ${fmt(a.x)},${fmt(ground.floorTop(a.x))}` +
        (placed.length ? `; spawned ${placed.join('; ')}` : ''),
    );

    const mountVehicle = (): void => {
      const v = a.vehicle;
      const p = game.player(0);
      if (!v) return;
      if (!p || p.state !== 'play') {
        warn(`--vehicle ${v.id}: player 1 is not on foot (state ${p?.state ?? 'none'}); not mounted`);
        return;
      }
      const e = world.spawn(v.id, p.x, ground.floorTop(p.x), v.params as SpawnParams);
      watched.add(e);
      world.flush();
      if (isMountable(e)) {
        e.mount(p);
        io.out(`t=${game.ticks} player 1 mounted ${v.id}#${e.id} at ${fmt(e.x)},${fmt(e.y)}`);
      } else warn(`--vehicle ${v.id}: not a vehicle (${unknown.has(v.id) ? 'unknown id, placeholder' : 'cannot be mounted'}); player 1 stays on foot`);
    };

    const every = a.count > 1 ? a.every || 60 : 1;
    const total = a.ticks + (a.count - 1) * (a.count > 1 ? every : 0);
    const shots: Shot[] = [];
    const frameWidth = game.renderer.target.w;
    const visit = (t: number): void => {
      if (a.trace.length && t % a.traceEvery === 0) for (const id of a.trace) io.out(traceLine(t, id, findTarget(game, id)));
      if (t >= a.ticks && (t - a.ticks) % every === 0 && shots.length < a.count) {
        const buf = game.renderFrame().clone();
        shots.push({ buf, label: frameLabel(game, a, Math.floor(frameWidth / a.res) - 2) });
      }
    };
    // Mounted before tick 1, as the runner does for SectionDef.startVehicle (a player placed in
    // deep water would drown during tick 1).
    mountVehicle();
    visit(0);
    for (let t = 1; t <= total; t++) {
      game.step(1);
      visit(t);
    }

    if (shots.length && o.save !== false) {
      const sheet = shots.length > 1;
      file = a.out ?? join('tmp/arena', sheet ? 'arena-sheet.png' : `arena-t${a.ticks}.png`);
      savePNG(composeSheet(shots, sheet ? a.cols : 1, sheetTitle(a, sheet ? every : 0), a.res), file, a.scale || (sheet || a.res > 1 ? 1 : 2));
      io.out(`${shots.length} frame(s) → ${file}`);
    }
  } finally {
    game.dispose();
  }

  const report = game.report();
  const alive: Record<string, number> = {};
  for (const e of game.world?.entities ?? []) if (e.alive) alive[e.type || '?'] = (alive[e.type || '?'] ?? 0) + 1;
  const p = game.player(0);
  for (const e of report.errors) io.err(`error: ${e.where}: ${e.message}${e.count > 1 ? ` (×${e.count})` : ''}`);
  return {
    ticks: game.ticks,
    seed: a.seed,
    file,
    errors: report.errors,
    warnings: [...notes, ...report.warnings],
    missingSfx: report.missingSfx,
    missingSongs: report.missingSongs,
    unknownIds: [...unknown],
    alive,
    player: p
      ? { x: round2(p.x), y: round2(p.y), state: p.state, vehicle: p.vehicle?.type ?? null, weapon: p.weapon.id, lives: p.slot.lives }
      : null,
    kills: report.kills,
    deaths: report.deaths,
    deathCauses: report.deathCauses,
  };
}

function isMountable(e: Entity): e is Mountable {
  if (e instanceof Vehicle) return true;
  const m = e as unknown as Partial<Mountable>;
  return typeof m.mount === 'function' && typeof m.canMount === 'function';
}

// ---------------------------------------------------------------------------------------------
// Traces and labels
// ---------------------------------------------------------------------------------------------

/** `player` / `p1` = player 1, `p2` = player 2, else the first live entity of that id (else a dying one). */
export function findTarget(game: HeadlessGame, id: string): Entity | null {
  if (id === 'player' || id === 'p1') return game.player(0);
  if (id === 'p2') return game.player(1);
  let dying: Entity | null = null;
  for (const e of game.world?.entities ?? []) {
    if (e.type !== id || e.removed) continue;
    if (e.alive) return e;
    dying ??= e;
  }
  return dying;
}

/** `state` (players, vehicles, bosses, hostages) or `mode` (soldiers); 'dead' when dead. */
function stateOf(e: Entity): string {
  const r = e as unknown as { state?: unknown; mode?: unknown };
  const s = typeof r.state === 'string' ? r.state : typeof r.mode === 'string' ? r.mode : '';
  return e.dead && s !== 'dead' ? (s ? `${s}/dead` : 'dead') : s;
}

/** Current animation `name:frame` (the last part of the sprite id). */
function animOf(e: Entity): string {
  let a: Animator | null = null;
  if (e instanceof Player) a = e.state === 'play' || !e.full.id ? e.legs : e.full;
  else {
    const anim = (e as unknown as { anim?: unknown }).anim;
    if (anim instanceof Animator) a = anim;
  }
  if (!a || !a.id) return '';
  return `${a.id.slice(a.id.lastIndexOf('/') + 1)}:${a.index}`;
}

/** One trace line: tick, id#n, x y vx vy (2 decimals), gnd / air, state, anim, hp (cells). */
export function traceLine(t: number, id: string, e: Entity | null): string {
  if (!e) return `t=${t} ${id} none`;
  const parts = [`t=${t}`, `${id}#${e.id}`, `x=${e.x.toFixed(2)}`, `y=${e.y.toFixed(2)}`, `vx=${e.vx.toFixed(2)}`, `vy=${e.vy.toFixed(2)}`];
  if (e.body) parts.push(e.body.onGround ? 'gnd' : 'air');
  const st = stateOf(e);
  if (st) parts.push(`state=${st}`);
  const an = animOf(e);
  if (an) parts.push(`anim=${an}`);
  parts.push(`hp=${fmt(e.hp)}`);
  if (e instanceof Vehicle) parts.push(`cells=${fmt(e.cells)}`);
  return parts.join(' ');
}

/** Frame label lines: tick, players (x,y state), bot goal, traced entities (x,y state). */
function frameLabel(game: HeadlessGame, a: ArenaArgs, width: number): string[] {
  const parts = [`t=${game.ticks}`];
  for (const slot of [0, 1] as const) {
    const p = game.player(slot);
    if (p) parts.push(`P${slot + 1} ${Math.round(p.x)},${Math.round(p.y)} ${p.state}${p.vehicle ? ` ${p.vehicle.type}` : ''}`);
  }
  const b = game.bots[0];
  if (b && b.goalKind) parts.push(`goal ${b.goalKind}`);
  for (const id of a.trace) {
    if (id === 'player' || id === 'p1' || id === 'p2') continue;
    const e = findTarget(game, id);
    const st = e ? stateOf(e) : '';
    parts.push(e ? `${id} ${Math.round(e.x)},${Math.round(e.y)}${st ? ` ${st}` : ''}` : `${id} none`);
  }
  return wrap(parts, width);
}

/** Greedy word wrap of label parts (joined by two spaces) to a pixel width. */
function wrap(parts: readonly string[], width: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const p of parts) {
    const next = cur ? `${cur}  ${p}` : p;
    if (cur && measure(next) > width) {
      lines.push(cur);
      cur = p;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function sheetTitle(a: ArenaArgs, every: number): string {
  const bits = [`ARENA  seed ${a.seed}  ${a.width} px`];
  if (every) bits.push(`every ${every} ticks`);
  if (a.god) bits.push('god');
  if (a.bot) bits.push('bot');
  if (a.vehicle) bits.push(`vehicle ${a.vehicle.id}`);
  if (a.spawns.length) bits.push(`spawn ${a.spawns.map((s) => s.id).join(',')}`);
  const note = resolveGfx(a.res, a.gfx).note.trim();
  if (note) bits.push(note);
  return bits.join('  ');
}

const PAD = 4;
const LINE_H = 10;

/** Frames in a grid with label lines under each (like `npm run shot`; `k`: text scale for --res). */
function composeSheet(frames: readonly Shot[], cols: number, title: string, k = 1): PixelBuffer {
  const fw = frames[0].buf.w;
  const fh = frames[0].buf.h;
  const pad = PAD * k;
  const labelH = (Math.max(...frames.map((f) => f.label.length)) * LINE_H + 2) * k;
  const c = Math.min(cols, frames.length);
  const rows = Math.ceil(frames.length / c);
  const head = 14 * k;
  const out = new PixelBuffer(pad + c * (fw + pad), head + rows * (fh + labelH + pad) + pad).fill(SHEET.bg);
  let t = title;
  while (t.length > 8 && measure(t, 'small', k) > out.w - pad * 2) t = `${t.slice(0, -4)}...`;
  drawText(out, t, pad, 3 * k, { color: SHEET.title, scale: k });
  frames.forEach((f, i) => {
    const x = pad + (i % c) * (fw + pad);
    const y = head + Math.floor(i / c) * (fh + labelH + pad);
    out.blit(f.buf, x, y);
    f.label.forEach((line, n) => drawText(out, line, x + k, y + fh + 2 * k + n * LINE_H * k, { color: SHEET.label, scale: k }));
  });
  return out;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------

export const USAGE = `usage: npm run arena -- [options]

Entity sandbox: a flat test section (floor at y ${FLOOR}, height ${ARENA_H}, free scrolling, no timer).
Entities spawn through the normal world factory; unknown ids show as magenta placeholders.

Terrain (repeatable, any order; x in world px):
  --width 2400              section width (min 384)
  --water x0-x1[:depth]     water from the floor line down; the floor under it drops depth px (${WATER_DEPTH})
  --gap x:width             a pit
  --platform x,y,len        one-way platform, top at y
  --solid x,y,w,h           solid block, top-left at x,y (on the floor: y = ${FLOOR} - h)
  --slope x:len:dy          the floor rises (dy < 0) or falls over len px and stays there
  --step x:dy               vertical step (dy < 0 = up)
  --bg m0|plain             m0 section a background (default) or a plain sky gradient
Entities and players:
  --spawn "id@x[,y][{k:v}];…"  x absolute, or +dx / -dx from player 1's start x; y (feet) defaults
                            to the top floor or water surface under x; params are JSON-ish:
                            {hp:30,gag:false,contains:bombs,kind:'tea-lady',list:[a,b]}
  --vehicle id[{k:v}]       spawn it at player 1 and mount player 1 in it before tick 1
  --x 80                    player 1 start x (player 2 starts 20 px behind)
  --players 1|2  --god  --bot  --weapon id  --difficulty easy|normal|hard  --seed 1
Input for player 1 (ticks count from 1; the trace line t=N is the state after tick N):
  --hold right,fire         held all the time (fire is tapped every 2 ticks)
  --press "30:jump;45:jump,fire;60-90:right"   down for that one tick (or from-to)
Output:
  --ticks 60                frame after this tick → tmp/arena/arena-t<tick>.png (scale 2)
  --every N --count K       K frames N ticks apart (the first after --ticks) → tmp/arena/arena-sheet.png (scale 1)
  --scale n  --cols 3  --out file.png     (several agents at once: give each run its own --out)
  --res k  --gfx pixel|smooth|xbr          high-resolution frames as the browser draws them at display
                            scale k (sprite filter, default pixel); PNG scale 1
  --trace id[,id…]          one line per tick for the first live entity of each id (player = P1, p2):
                            t x y vx vy gnd|air state anim:frame hp
  --trace-every N           trace every N ticks (default 1)
Ends with a JSON summary on stdout (errors with stacks, warnings, missing sfx / songs, unknown ids,
entities alive by id, player 1); exit code 1 on errors.

examples:
  npm run arena -- --spawn "drummer@+90;oompah-tank@+220{facing:-1}" --god --ticks 90 --out tmp/arena/band.png
  npm run arena -- --water 160-1400 --x 240 --vehicle swan --hold right --press "30:jump;45:jump,fire" \\
      --trace swan,player --every 15 --count 6 --out tmp/arena/swan.png
  npm run arena -- --gap 300:56 --spawn "rifleman@+300{patrol:48, gag:false}" --hold right --press "118:jump" \\
      --god --trace player,rifleman --trace-every 10 --ticks 100 --every 20 --count 6 --out tmp/arena/gap.png`;

async function main(): Promise<void> {
  let args: ArenaArgs;
  try {
    args = parseArenaArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`arena: ${err instanceof Error ? err.message : String(err)}\nrun: npm run arena -- --help\n`);
    process.exit(1);
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const summary = await runArena(args);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.errors.length) process.exitCode = 1;
}

/** True when this file is the program entry (`tsx tools/arena.ts`), false when a test imports it. */
function isEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntry()) {
  main().catch((err: unknown) => {
    process.stderr.write(`arena: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exit(1);
  });
}
