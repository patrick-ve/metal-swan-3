/**
 * Headless ring harness (docs/design/ring.md §15, docs/api/sim.md "The ring"): the real app with a
 * `RingScene` (scenes/ring.ts) on a RingRunner, the software renderer, silent counting audio, a
 * memory store and the ring bot (bot-ring.ts) or scripted input. Used by `npm run sim -- --mission
 * ring`, `npm run shot -- --mission ring` and the tests.
 *
 * ```ts
 * const h = await createHeadlessRing({ seed: 7, god: true, bot: true });
 * h.runUntil((g) => g.done, 40_000);
 * console.log(h.report());                 // the RingRunner's report + god, timing, warnings …
 * const png = h.renderFrame();             // PixelBuffer of the current frame (384×216 × res)
 * h.spawn('ring-scooter', 120, 2);         // tools: one entity 120 px right of the view's centre, lane 2
 * h.dispose();
 * ```
 * Pure TypeScript (no DOM, no node APIs): timing uses an injected `clock`.
 */
import type { Damage, Entity } from '../engine/entity';
import type { InputTimeline, ScriptedFn } from '../engine/input';
import { InputManager, ScriptedSource } from '../engine/input';
import type { PixelBuffer } from '../engine/pixel';
import type { SubpixelMode } from '../engine/render-common';
import { SoftRenderer } from '../engine/render-soft';
import type { Scene } from '../engine/scene';
import { MemoryStore } from '../engine/storage';
import type { UpscaleMode } from '../engine/upscale';
import type { World } from '../engine/world';
import { createApp, newCampaign, type GameApp } from '../game/app';
import { loadContent } from '../game/content/index';
import { DEFAULT_PARAMS } from '../game/params';
import { hasEntity, type SpawnParams } from '../game/registry';
import { ringBoarding } from '../game/ring/boarding';
import { chunkAt } from '../game/ring/plan';
import type { RingHero } from '../game/ring/hero';
import { laneY } from '../game/ring/lanes';
import { RING_ID } from '../game/ring/ids';
import type { RingReport, RingRunner } from '../game/ring/runner';
import type { RingPlan } from '../game/ring/types';
import { GameSession, type Difficulty } from '../game/session';
import { RingScene } from '../game/scenes/ring';
import { applyTuning } from '../game/tuning';
import { RingBot, type RingBotOptions } from './bot-ring';
import { captureConsole, releaseConsole, SimAudio, SimStats, type ConsoleCapture, type SimError, type SimTiming } from './stats';

export interface HeadlessRingOptions {
  /** The ring's seed (default 1): the plan and the world. */
  seed?: number;
  players?: 1 | 2;
  /** God mode: the wagons take no damage. */
  god?: boolean;
  /** Drive every player with the ring bot (true or bot options); false = idle unless `input` is given. */
  bot?: boolean | RingBotOptions;
  characterId?: string;
  difficulty?: Difficulty;
  /** Start at this landmark (`?section=`). */
  section?: string;
  /** Start weapon for every player (like ?weapon=). */
  weapon?: string;
  /** A ready plan (tests); default `planRing(seed, difficulty)`. */
  plan?: RingPlan;
  /** Scripted input for player 1 (with the bot or alone). */
  input?: InputTimeline | ScriptedFn;
  /** Millisecond clock for tick / frame timing (tools pass performance.now). */
  clock?: () => number;
  /** Import the content manifest first (default true). */
  loadContent?: boolean;
  /** Every player out: the bot presses START (default true); false = the run ends there. */
  autoContinue?: boolean;
  /** Collect console warnings / errors into the report (default true) and echo them (default false). */
  captureConsole?: boolean;
  echoConsole?: boolean;
  /** Backbuffer resolution of `renderFrame` (default 1: the classic 384×216 image). */
  res?: number;
  gfx?: UpscaleMode;
  subpixel?: SubpixelMode;
}

/** One stretch of play time without an enemy on screen (pacing, GDD §1.5). */
export interface RingGap {
  /** Sim tick the gap started at, and its length (ticks). */
  tick: number;
  ticks: number;
  landmark: string;
  /** The plan chunk at the view's centre when it started (type and part). */
  chunk: string;
}

/**
 * The ring watch (docs/design/ring.md §15, GDD §1.5 pacing and §4.11 fairness), measured on the
 * real run:
 * - pacing: play time without an enemy on screen, outside rests, scenes (the boarding, the exit),
 *   the continue hold and the victory drive (`gaps` lists those over `RING_GAP_TICKS`);
 * - fairness: enemy shots and bottles that appear off screen, wagon hits whose attacker is off
 *   screen, the shortest attack tell (`tell-x` → `x`) and its on-screen part, the fewest open
 *   lanes at the view's right edge;
 * - armour: the cells the wagons lost per source (`<attacker>/<projectile>` or the damage kind).
 */
export interface RingWatchReport {
  longestGap: number;
  gaps: RingGap[];
  /** Ticks counted for pacing (outside rests, scenes, holds) and the share with an enemy on screen. */
  paceTicks: number;
  enemyShare: number;
  outsideShots: number;
  offscreenHits: number;
  attacks: number;
  minTell: number;
  minTellInView: number;
  minOpenLanes: number;
  cellsLost: Record<string, number>;
}

/** A pacing gap is reported over this many ticks (GDD §1.5: 4 s). */
export const RING_GAP_TICKS = 240;

/** Pacing, fairness and armour numbers of a ring run (see `RingWatchReport`). */
class RingWatch {
  private readonly gaps: RingGap[] = [];
  private longest = 0;
  private gapStart = -1;
  private gapAt: { landmark: string; chunk: string } = { landmark: '', chunk: '' };
  private paceTicks = 0;
  private enemyTicks = 0;
  private outsideShots = 0;
  private offscreenHits = 0;
  private attacks = 0;
  private minTell = Infinity;
  private minTellInView = Infinity;
  private minOpen = Infinity;
  private readonly cells = new Map<string, number>();
  private readonly modes = new Map<Entity, { mode: string; n: number; seen: number }>();
  private readonly seenShots = new WeakSet<Entity>();
  /** The last hit of this tick per wagon (the source of a cell loss). */
  private readonly lastHit = new Map<Entity, string>();
  private readonly cellsBefore = new Map<Entity, number>();
  private world: World | null = null;

  attach(world: World): void {
    if (this.world === world) return;
    this.world = world;
    world.events.on('hit', (e) => {
      const t = e.target;
      if (!t.hasTag('ring-wagon')) return;
      const d = e.damage as Damage;
      this.lastHit.set(t, sourceName(d));
      const src = attacker(d);
      if (src && !world.onScreen(src, 8) && !e.absorbed) this.offscreenHits++;
    });
  }

  tick(runner: RingRunner, now: number): void {
    const world = runner.world;
    this.attach(world);
    const cam = world.camera;
    // Armour: cells lost this tick, per source.
    for (const e of world.byTag('ring-wagon')) {
      const w = e as Entity & { cells?: number };
      const c = w.cells ?? 0;
      const before = this.cellsBefore.get(e);
      if (before !== undefined && c < before) {
        const k = this.lastHit.get(e) ?? 'other';
        this.cells.set(k, (this.cells.get(k) ?? 0) + (before - c));
      }
      this.cellsBefore.set(e, c);
    }
    this.lastHit.clear();
    // Fairness: new enemy shots / bottles off screen; the tells.
    let enemyOn = false;
    for (const e of world.entities) {
      if (e.team !== 'enemy' || !e.alive) continue;
      const shot = e.hasTag('shot') || e.hasTag('ring-bottle');
      if (shot) {
        if (!this.seenShots.has(e)) {
          this.seenShots.add(e);
          if (!cam.containsPoint(e.x, e.y, -8)) this.outsideShots++;
        }
        continue;
      }
      if (!enemyOn && e.hasTag('shootable') && e.type !== 'ring-hostage' && !e.hasTag('secret') && !e.dead && world.onScreen(e, 0)) enemyOn = true;
      const mode = (e as Entity & { mode?: unknown }).mode;
      if (typeof mode !== 'string') continue;
      const st = this.modes.get(e);
      const on = world.onScreen(e, 0);
      if (!st) {
        this.modes.set(e, { mode, n: 1, seen: on ? 1 : 0 });
        continue;
      }
      if (mode === st.mode) {
        st.n++;
        if (on) st.seen++;
        continue;
      }
      if (st.mode === `tell-${mode}`) {
        this.attacks++;
        this.minTell = Math.min(this.minTell, st.n);
        this.minTellInView = Math.min(this.minTellInView, st.seen);
      }
      st.mode = mode;
      st.n = 1;
      st.seen = on ? 1 : 0;
    }
    for (const e of this.modes.keys()) if (!e.alive) this.modes.delete(e);
    // Open lanes at the view's right edge (closures from the plan; tunnels have 3).
    if (runner.state === 'playing') {
      const d = runner.planDist + cam.w;
      const open = runner.lanesOpenAtPlan(d);
      let closed = 0;
      for (const l of runner.closedLanesAtPlan(d)) if (l <= open) closed++;
      this.minOpen = Math.min(this.minOpen, open - closed);
    }
    // Pacing: outside rests, scenes, the boarding, holds and the victory drive.
    const c = chunkAt(runner.plan, runner.planDist + cam.w / 2);
    const excused = runner.state !== 'playing' || runner.held || ringBoarding(world) || !c || !!c.scene || c.type === 'rest';
    if (excused || enemyOn) {
      this.closeGap(now);
      if (!excused) {
        this.paceTicks++;
        this.enemyTicks++;
      }
      return;
    }
    this.paceTicks++;
    if (this.gapStart < 0) {
      this.gapStart = now;
      this.gapAt = { landmark: runner.section.id, chunk: c.part ? `${c.type}/${c.part}` : c.type };
    }
  }

  private closeGap(now: number): void {
    if (this.gapStart < 0) return;
    const n = now - this.gapStart;
    this.longest = Math.max(this.longest, n);
    if (n > RING_GAP_TICKS) this.gaps.push({ tick: this.gapStart, ticks: n, ...this.gapAt });
    this.gapStart = -1;
  }

  report(now: number): RingWatchReport {
    this.closeGap(now);
    const cellsLost: Record<string, number> = {};
    for (const [k, v] of [...this.cells].sort((a, b) => b[1] - a[1])) cellsLost[k] = v;
    return {
      longestGap: this.longest,
      gaps: this.gaps.slice(0, 40),
      paceTicks: this.paceTicks,
      enemyShare: this.paceTicks ? Math.round((this.enemyTicks / this.paceTicks) * 1000) / 1000 : 0,
      outsideShots: this.outsideShots,
      offscreenHits: this.offscreenHits,
      attacks: this.attacks,
      minTell: Number.isFinite(this.minTell) ? this.minTell : -1,
      minTellInView: Number.isFinite(this.minTellInView) ? this.minTellInView : -1,
      minOpenLanes: Number.isFinite(this.minOpen) ? this.minOpen : -1,
      cellsLost,
    };
  }
}

/** The entity behind a hit: the shooter of a projectile, else the source itself. */
function attacker(d: Damage): Entity | null {
  const src = d.source as (Entity & { shooter?: Entity | null; thrower?: Entity | null }) | undefined;
  if (!src) return null;
  return src.shooter ?? src.thrower ?? src;
}

/** A short name of a hit's source (`ring-scooter/ring-bottle`, `ring-car`, `impact` …). */
function sourceName(d: Damage): string {
  const src = d.source as (Entity & { shooter?: Entity | null; thrower?: Entity | null }) | undefined;
  const tag = d.tags?.length ? `:${d.tags.join('+')}` : '';
  if (!src) return `${d.kind}${tag}`;
  const by = src.shooter ?? src.thrower;
  const own = src.type || (src.hasTag('ring-bottle') ? 'ring-scooter/bottle' : src.hasTag('shot') ? 'shot' : 'entity');
  return by && by !== src ? `${by.type}/${own}` : `${own}${tag}`;
}

/** The sim's ring report: the runner's numbers plus the harness's. */
export interface RingSimReport extends Omit<RingReport, 'errors'> {
  /** Pacing, fairness and armour (`RingWatch`). */
  watch: RingWatchReport;
  god: boolean;
  seconds: number;
  /** Times every player was out (the in-world continue started). */
  gameOvers: number;
  /** Errors from the scenes (update / draw) and the world, with stacks (deduplicated, counted). */
  errors: SimError[];
  warnings: string[];
  missingSfx: string[];
  missingSongs: string[];
  timing: SimTiming | null;
}

export interface HeadlessRing {
  readonly app: GameApp;
  readonly input: InputManager;
  readonly session: GameSession;
  readonly renderer: SoftRenderer;
  readonly audio: SimAudio;
  readonly bots: readonly RingBot[];
  readonly stats: SimStats;
  /** The RingScene (null when it failed to start or the play moved on). */
  readonly scene: RingScene | null;
  readonly runner: RingRunner | null;
  readonly world: World | null;
  readonly ticks: number;
  /** The ring was won (the victory drive started). */
  readonly complete: boolean;
  /** The run is over: complete, or every player out without auto-continue. */
  readonly done: boolean;
  step(n?: number): void;
  runUntil(pred: (h: HeadlessRing) => boolean, maxTicks: number): boolean;
  renderFrame(): PixelBuffer;
  player(slot?: 0 | 1): RingHero | null;
  /**
   * Spawn a registered entity `dx` px right of the view's centre in `lane` (1 far … 4 near) or at
   * plane `y` (tools: `npm run shot -- --spawn`). Null for an unknown id.
   */
  spawn(id: string, dx: number, lane: number, params?: SpawnParams): Entity | null;
  report(): RingSimReport;
  dispose(): void;
}

class HeadlessRingImpl implements HeadlessRing {
  readonly app: GameApp;
  readonly input = new InputManager();
  readonly session: GameSession;
  readonly renderer: SoftRenderer;
  readonly audio = new SimAudio();
  readonly bots: RingBot[] = [];
  readonly stats = new SimStats();
  scene: RingScene | null = null;
  ticks = 0;
  complete = false;
  private readonly o: HeadlessRingOptions;
  private readonly clock: (() => number) | null;
  private readonly capture: ConsoleCapture | null;
  private lastHeld = false;
  private gameOver = false;
  private readonly watch = new RingWatch();

  constructor(o: HeadlessRingOptions, capture: ConsoleCapture | null) {
    this.o = o;
    this.capture = capture;
    this.clock = o.clock ?? null;
    this.renderer = new SoftRenderer(undefined, undefined, undefined, { res: o.res, mode: o.gfx, subpixel: o.subpixel });
    const players = o.players ?? 1;
    const seed = (o.seed ?? 1) >>> 0;
    this.input.players = players;
    const params = {
      ...DEFAULT_PARAMS,
      mission: RING_ID,
      section: o.section ?? null,
      god: o.god ?? false,
      seed,
      players,
      char: o.characterId ?? null,
      weapon: o.weapon ?? null,
      difficulty: o.difficulty ?? null,
    };
    this.app = createApp({ input: this.input, audio: this.audio, store: new MemoryStore(), params });
    this.app.debug.god = o.god ?? false;
    if (o.bot) {
      const host = this.botHost();
      const opts = typeof o.bot === 'object' ? o.bot : {};
      for (let i = 0; i < players; i++) {
        const b = new RingBot(host, i as 0 | 1, opts);
        this.bots.push(b);
        this.input.addSource(b);
      }
    }
    if (o.input) this.input.addSource(new ScriptedSource(o.input, 0));
    const char = o.characterId ?? 'recruit';
    this.session = new GameSession({ difficulty: o.difficulty ?? 'normal', characters: players === 2 ? [char, char] : [char], seed });
    this.app.session = this.session;
    this.app.campaign = newCampaign();
    const scene = new RingScene(this.app, o.plan ? { start: { seed, plan: o.plan, section: o.section } } : { seed, section: o.section });
    this.scene = scene;
    try {
      this.app.scenes.reset(scene);
    } catch (err) {
      this.stats.addError('RingScene.enter', err, 0);
    }
    if (scene.runner) this.stats.watchWorld(scene.runner.world, scene.runner.section.id);
  }

  private botHost(): { readonly runner: RingRunner | null; readonly topScene: Scene | null } {
    const self = this;
    return {
      get runner(): RingRunner | null {
        return self.runner;
      },
      get topScene(): Scene | null {
        return self.app.scenes.top;
      },
    };
  }

  get runner(): RingRunner | null {
    return this.scene?.runner ?? null;
  }

  get world(): World | null {
    return this.runner?.world ?? null;
  }

  get done(): boolean {
    return this.complete || (this.gameOver && this.o.autoContinue === false);
  }

  player(slot: 0 | 1 = 0): RingHero | null {
    return this.runner?.player(slot) ?? null;
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      const t0 = this.clock ? this.clock() : 0;
      try {
        this.input.update();
        this.app.scenes.update();
      } catch (err) {
        this.stats.addError('scene.update', err, this.ticks);
      }
      if (this.clock) this.stats.tickTime(this.clock() - t0);
      this.ticks++;
      this.observe();
    }
  }

  runUntil(pred: (h: HeadlessRing) => boolean, maxTicks: number): boolean {
    for (let i = 0; i < maxTicks; i++) {
      if (pred(this)) return true;
      this.step(1);
    }
    return pred(this);
  }

  private observe(): void {
    const runner = this.runner;
    if (!runner) return;
    const held = runner.countdownHeld;
    if (held && !this.lastHeld) {
      this.stats.gameOvers++;
      this.gameOver = true;
    }
    this.lastHeld = held;
    this.stats.entityCount(runner.world.entities.length);
    this.watch.tick(runner, this.ticks);
    if (!this.complete && (runner.state === 'victory' || runner.state === 'complete')) {
      this.complete = true;
      this.stats.completeTick = this.ticks;
    }
  }

  renderFrame(): PixelBuffer {
    const r = this.renderer;
    const t0 = this.clock ? this.clock() : 0;
    try {
      r.begin();
      this.app.scenes.draw(r);
      r.end();
    } catch (err) {
      this.stats.addError('scene.draw', err, this.ticks);
    }
    if (this.clock) this.stats.frameTime(this.clock() - t0);
    return r.target;
  }

  spawn(id: string, dx: number, lane: number, params?: SpawnParams): Entity | null {
    const runner = this.runner;
    if (!runner || !hasEntity(id)) return null;
    const cam = runner.world.camera;
    const y = lane >= 1 && lane <= 4 ? laneY(lane) : lane;
    const e = runner.world.spawn(id, cam.x + cam.w / 2 + dx, y, params);
    runner.world.flush();
    return e;
  }

  report(): RingSimReport {
    const runner = this.runner;
    const lines = this.capture ? [...this.capture.lines.entries()].slice(0, 60).map(([l, n]) => (n > 1 ? `${l} (×${n})` : l)) : [];
    const base: RingReport = runner
      ? runner.report()
      : {
          mission: RING_ID,
          seed: (this.o.seed ?? 1) >>> 0,
          difficulty: this.o.difficulty ?? 'normal',
          players: this.o.players ?? 1,
          ticks: 0,
          distance: 0,
          roadDistance: 0,
          planLength: 0,
          landmarks: [],
          kills: 0,
          deaths: 0,
          wrecks: 0,
          fines: 0,
          hostages: 0,
          continues: 0,
          score: 0,
          complete: false,
          gameOver: false,
          spawned: 0,
          skipped: {},
          bosses: [],
          errors: [],
          maxEntities: 0,
        };
    // The runner's world errors are in the stats too (watchWorld): report them once, with the scenes'.
    return {
      ...base,
      complete: this.complete || base.complete,
      watch: this.watch.report(this.ticks),
      god: this.o.god ?? false,
      seconds: Math.round((this.ticks / 60) * 10) / 10,
      gameOvers: this.stats.gameOvers,
      errors: this.stats.errorList(),
      warnings: lines,
      missingSfx: [...this.audio.missingSfx].sort(),
      missingSongs: [...this.audio.missingSongs].sort(),
      timing: this.stats.timing(),
    };
  }

  dispose(): void {
    if (this.capture) releaseConsole(this.capture);
  }
}

/** Build a headless ring (loads the content manifest first unless `loadContent: false`). */
export async function createHeadlessRing(o: HeadlessRingOptions = {}): Promise<HeadlessRing> {
  applyTuning();
  const capture = o.captureConsole === false ? null : captureConsole(o.echoConsole ?? false);
  let failed: Array<{ id: string; error: string }> = [];
  if (o.loadContent !== false) failed = (await loadContent()).failed;
  const h = new HeadlessRingImpl(o, capture);
  for (const f of failed) h.stats.add(`content "${f.id}"`, f.error.split('\n')[0], f.error, 0);
  return h;
}

export interface RunRingOptions extends HeadlessRingOptions {
  /** Stop after this many ticks (default 60 × 60 × 12). */
  maxTicks?: number;
}

/** Run the ring until it is done or `maxTicks` (the sim's loop without the tool). */
export async function runRing(o: RunRingOptions = {}): Promise<RingSimReport> {
  const h = await createHeadlessRing(o);
  try {
    h.runUntil((x) => x.done, o.maxTicks ?? 43200);
    return h.report();
  } finally {
    h.dispose();
  }
}
