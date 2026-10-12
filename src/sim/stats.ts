/**
 * Headless run statistics (docs/ARCHITECTURE.md §9): what the sim tool prints and the tests
 * check. A `SimStats` watches the running game (worlds, sections, events, errors, timing); the
 * `SimAudio` output counts sounds and notes ids that are not defined; a console capture collects
 * warnings and errors printed while the game runs.
 */
import type { AudioOut, SfxOpts } from '../engine/audio';
import { hasSfx } from '../engine/synth';
import { hasSong } from '../engine/music';
import type { World, WorldError } from '../engine/world';

export interface SimError {
  where: string;
  message: string;
  stack?: string;
  tick: number;
  /** How often the same place + message happened. */
  count: number;
}

export interface SimTiming {
  avgTickMs: number;
  maxTickMs: number;
  avgFrameMs: number;
  maxFrameMs: number;
}

export interface SimReport {
  mission: string;
  seed: number;
  players: number;
  god: boolean;
  route: string | null;
  difficulty: string;
  ticks: number;
  /** ticks / 60. */
  seconds: number;
  /** Section ids in the order they were loaded. */
  sectionsVisited: string[];
  finalSection: string;
  finalX: number;
  missionComplete: boolean;
  /** Tick at which the mission was won (victory poses started). */
  completeTick: number | null;
  bossDefeated: boolean;
  /** Times every player was out of lives (the continue screen appeared). */
  gameOvers: number;
  continues: number;
  kills: number;
  knifeKills: number;
  killsByType: Record<string, number>;
  deaths: number;
  deathCauses: Record<string, number>;
  shots: number;
  bombs: number;
  hostages: number;
  pickups: number;
  score: number;
  timeouts: number;
  /** Most entities alive in one world at once. */
  maxEntities: number;
  errors: SimError[];
  /** Unique console warnings / errors printed during the run (at most 60). */
  warnings: string[];
  missingSfx: string[];
  missingSongs: string[];
  timing: SimTiming | null;
}

// ---------------------------------------------------------------------------------------------
// Audio that counts
// ---------------------------------------------------------------------------------------------

/** Silent audio output that counts plays and remembers ids that are not defined. */
export class SimAudio implements AudioOut {
  readonly sfxCounts = new Map<string, number>();
  readonly songs: string[] = [];
  readonly missingSfx = new Set<string>();
  readonly missingSongs = new Set<string>();
  voices = 0;

  sfx(id: string, _o?: SfxOpts): void {
    this.sfxCounts.set(id, (this.sfxCounts.get(id) ?? 0) + 1);
    if (!this.missingSfx.has(id) && !hasSfx(id)) this.missingSfx.add(id);
  }

  music(id: string | null): void {
    if (id === null) return;
    if (this.songs[this.songs.length - 1] !== id) this.songs.push(id);
    if (!hasSong(id)) this.missingSongs.add(id);
  }

  voice(): void {
    this.voices++;
  }

  setVolume(): void {}
  stopAll(): void {}
  pauseMusic(): void {}
  resumeMusic(): void {}
  sfxLoop(_key: string, id: string): void {
    if (!this.missingSfx.has(id) && !hasSfx(id)) this.missingSfx.add(id);
  }
  stopSfx(): void {}
  duckMusic(): void {}
  setMuted(): void {}
}

// ---------------------------------------------------------------------------------------------
// Console capture (scoped: several games may run in one process)
// ---------------------------------------------------------------------------------------------

type ConsoleFn = (...args: unknown[]) => void;

export class ConsoleCapture {
  /** Unique lines (first 200 characters) with their counts, in first-seen order. */
  readonly lines = new Map<string, number>();
  readonly echo: boolean;

  constructor(echo = false) {
    this.echo = echo;
  }

  add(level: 'warn' | 'error', args: readonly unknown[]): void {
    const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeString(a))).join(' ');
    const key = `${level}: ${text}`.slice(0, 200);
    this.lines.set(key, (this.lines.get(key) ?? 0) + 1);
  }
}

function safeString(v: unknown): string {
  try {
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  } catch {
    return String(v);
  }
}

const active = new Set<ConsoleCapture>();
let original: { warn: ConsoleFn; error: ConsoleFn } | null = null;

/** Start collecting console.warn / console.error lines (echoed only when `echo` is set). */
export function captureConsole(echo = false): ConsoleCapture {
  const cap = new ConsoleCapture(echo);
  if (!original) {
    const orig = { warn: console.warn.bind(console) as ConsoleFn, error: console.error.bind(console) as ConsoleFn };
    original = orig;
    console.warn = (...args: unknown[]): void => {
      let echo = active.size === 0;
      for (const c of active) {
        c.add('warn', args);
        echo ||= c.echo;
      }
      if (echo) orig.warn(...args);
    };
    console.error = (...args: unknown[]): void => {
      let echo = active.size === 0;
      for (const c of active) {
        c.add('error', args);
        echo ||= c.echo;
      }
      if (echo) orig.error(...args);
    };
  }
  active.add(cap);
  return cap;
}

/** Stop a capture; the original console comes back when no capture is left. */
export function releaseConsole(cap: ConsoleCapture): void {
  active.delete(cap);
  if (active.size === 0 && original) {
    console.warn = original.warn;
    console.error = original.error;
    original = null;
  }
}

// ---------------------------------------------------------------------------------------------
// Stats collector
// ---------------------------------------------------------------------------------------------

const MAX_ERRORS = 100;

export class SimStats {
  readonly sectionsVisited: string[] = [];
  readonly killsByType: Record<string, number> = {};
  readonly deathCauses: Record<string, number> = {};
  bossDefeated = false;
  timeouts = 0;
  maxEntities = 0;
  gameOvers = 0;
  completeTick: number | null = null;
  private readonly errors = new Map<string, SimError>();
  private readonly seenWorlds = new Set<World>();
  private tickN = 0;
  private tickSum = 0;
  private tickMax = 0;
  private frameN = 0;
  private frameSum = 0;
  private frameMax = 0;

  /** A new section world: listen to its events. */
  watchWorld(world: World, sectionId: string): void {
    if (this.seenWorlds.has(world)) return;
    this.seenWorlds.add(world);
    this.sectionsVisited.push(sectionId);
    world.events.on('enemyKilled', (e) => {
      const t = e.enemy.type || 'enemy';
      this.killsByType[t] = (this.killsByType[t] ?? 0) + 1;
    });
    world.events.on('playerDied', (e) => {
      this.deathCauses[e.cause] = (this.deathCauses[e.cause] ?? 0) + 1;
    });
    world.events.on('bossDefeated', () => {
      this.bossDefeated = true;
    });
    world.events.on('timeOut', () => {
      this.timeouts++;
    });
  }

  /** Errors recorded by every world seen so far are merged in at report time. */
  private collectWorldErrors(): void {
    for (const w of this.seenWorlds) for (const e of w.errors) this.addWorldError(e);
  }

  private readonly worldErrorSeen = new WeakSet<WorldError>();

  private addWorldError(e: WorldError): void {
    if (this.worldErrorSeen.has(e)) return;
    this.worldErrorSeen.add(e);
    this.add(e.where, e.message, e.stack, e.tick);
  }

  /** Record an error (deduplicated by place + message). */
  add(where: string, message: string, stack: string | undefined, tick: number): void {
    const key = `${where}|${message}`;
    const old = this.errors.get(key);
    if (old) {
      old.count++;
      return;
    }
    if (this.errors.size >= MAX_ERRORS) return;
    this.errors.set(key, { where, message, stack, tick, count: 1 });
  }

  addError(where: string, err: unknown, tick: number): void {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    this.add(where, message, stack, tick);
  }

  tickTime(ms: number): void {
    this.tickN++;
    this.tickSum += ms;
    if (ms > this.tickMax) this.tickMax = ms;
  }

  frameTime(ms: number): void {
    this.frameN++;
    this.frameSum += ms;
    if (ms > this.frameMax) this.frameMax = ms;
  }

  entityCount(n: number): void {
    if (n > this.maxEntities) this.maxEntities = n;
  }

  errorList(): SimError[] {
    this.collectWorldErrors();
    return [...this.errors.values()];
  }

  timing(): SimTiming | null {
    if (this.tickN === 0) return null;
    const r = (v: number): number => Math.round(v * 1000) / 1000;
    return {
      avgTickMs: r(this.tickSum / this.tickN),
      maxTickMs: r(this.tickMax),
      avgFrameMs: this.frameN ? r(this.frameSum / this.frameN) : 0,
      maxFrameMs: r(this.frameMax),
    };
  }
}

/** The report without the parts that differ between identical runs (timing, console lines). */
export function comparableReport(r: SimReport): Omit<SimReport, 'timing' | 'warnings'> {
  const { timing: _t, warnings: _w, ...rest } = r;
  return rest;
}
