/**
 * Headless game harness (docs/ARCHITECTURE.md §4, §9): the real app — scenes, mission runner,
 * HUD — with the software renderer, silent counting audio, a memory store and scripted / bot
 * input. Used by `tools/shot.ts`, `tools/sim.ts` and the tests.
 *
 * ```ts
 * const game = await createHeadlessGame({ missionId: 'm0', seed: 1, god: true, bot: { route: 'upper' } });
 * game.runUntil((g) => g.done, 72_000);
 * console.log(game.report());
 * const png = game.renderFrame();           // PixelBuffer of the current frame (384×216)
 * game.dispose();
 * ```
 * Pure TypeScript (no DOM, no node APIs): timing uses an injected `clock`.
 */
import type { InputTimeline, ScriptedFn } from '../engine/input';
import { InputManager, ScriptedSource } from '../engine/input';
import type { PixelBuffer } from '../engine/pixel';
import { SoftRenderer } from '../engine/render-soft';
import type { Scene } from '../engine/scene';
import { MemoryStore } from '../engine/storage';
import type { World } from '../engine/world';
import { createApp, type GameApp } from '../game/app';
import { loadContent } from '../game/content/index';
import type { MissionRunner } from '../game/mission/runner';
import { DEFAULT_PARAMS } from '../game/params';
import type { Player } from '../game/player/player';
import { ContinueScene } from '../game/scenes/continue';
import { GameplayScene } from '../game/scenes/gameplay';
import { GameSession, type Difficulty } from '../game/session';
import { applyTuning } from '../game/tuning';
import { Bot, type BotOptions } from './bot';
import { captureConsole, releaseConsole, SimAudio, SimStats, type ConsoleCapture, type SimReport } from './stats';

export interface HeadlessOptions {
  missionId: string;
  /** Start section (default: the mission's start). */
  sectionId?: string;
  seed?: number;
  players?: 1 | 2;
  /** God mode: players ignore all damage except crushing (pits still kill). */
  god?: boolean;
  /** Drive every player with the bot (true or bot options); false = idle unless `input` is given. */
  bot?: boolean | BotOptions;
  characterId?: string;
  difficulty?: Difficulty;
  /** Start at the boss (?boss=1). */
  bossRush?: boolean;
  /** Start weapon for every player (like ?weapon=). */
  weapon?: string;
  /** Scripted input for player 1 (used together with the bot or alone). */
  input?: InputTimeline | ScriptedFn;
  /** Millisecond clock for tick / frame timing (tools pass performance.now). */
  clock?: () => number;
  /** Import the content manifest first (default true). */
  loadContent?: boolean;
  /** On game over, continue automatically (the bot presses start; default true). */
  autoContinue?: boolean;
  /** Collect console warnings / errors into the report (default true) and echo them (default false). */
  captureConsole?: boolean;
  echoConsole?: boolean;
}

export interface HeadlessGame {
  readonly app: GameApp;
  readonly input: InputManager;
  readonly session: GameSession;
  readonly renderer: SoftRenderer;
  readonly audio: SimAudio;
  readonly bots: readonly Bot[];
  readonly stats: SimStats;
  /** The running gameplay scene / mission runner / section world (null between missions). */
  readonly scene: GameplayScene | null;
  readonly runner: MissionRunner | null;
  readonly world: World | null;
  /** Ticks simulated so far. */
  readonly ticks: number;
  /** The mission was won (victory poses started). */
  readonly missionComplete: boolean;
  /** True when the run is over: mission complete, or game over without auto-continue. */
  readonly done: boolean;
  /** Advance n ticks (input → scenes). Errors are caught, recorded and the run goes on. */
  step(n?: number): void;
  /** Step until `pred` is true (checked before every tick) or `maxTicks` ran. Returns pred's result. */
  runUntil(pred: (g: HeadlessGame) => boolean, maxTicks: number): boolean;
  /** Draw the current frame with the software renderer. */
  renderFrame(): PixelBuffer;
  /** Move the players to world x (on the first floor from the top) and snap the camera there. */
  teleport(x: number): void;
  player(slot?: 0 | 1): Player | null;
  report(): SimReport;
  /** Stop capturing the console. */
  dispose(): void;
}

class Headless implements HeadlessGame {
  readonly app: GameApp;
  readonly input: InputManager;
  readonly session: GameSession;
  readonly renderer = new SoftRenderer();
  readonly audio = new SimAudio();
  readonly bots: Bot[] = [];
  readonly stats = new SimStats();
  scene: GameplayScene | null = null;
  ticks = 0;
  missionComplete = false;
  private readonly o: HeadlessOptions;
  private readonly clock: (() => number) | null;
  private readonly capture: ConsoleCapture | null;
  private lastTop: Scene | null = null;
  private lastWorld: World | null = null;
  private gameOver = false;

  constructor(o: HeadlessOptions, capture: ConsoleCapture | null) {
    this.o = o;
    this.clock = o.clock ?? null;
    this.capture = capture;
    const players = o.players ?? 1;
    const seed = (o.seed ?? 1) >>> 0;
    const input = new InputManager();
    input.players = players;
    this.input = input;
    const params = {
      ...DEFAULT_PARAMS,
      mission: o.missionId,
      section: o.sectionId ?? null,
      god: o.god ?? false,
      seed,
      players,
      char: o.characterId ?? null,
      weapon: o.weapon ?? null,
      boss: o.bossRush ?? false,
      difficulty: o.difficulty ?? null,
    };
    this.app = createApp({ input, audio: this.audio, store: new MemoryStore(), params });
    this.app.debug.god = o.god ?? false;
    if (o.bot) {
      const host = this.botHost();
      const botOpts = typeof o.bot === 'object' ? o.bot : {};
      for (let i = 0; i < players; i++) {
        const b = new Bot(host, i as 0 | 1, botOpts);
        this.bots.push(b);
        input.addSource(b);
      }
    }
    if (o.input) input.addSource(new ScriptedSource(o.input, 0));
    const char = o.characterId ?? 'recruit';
    this.session = new GameSession({ difficulty: o.difficulty ?? 'normal', characters: players === 2 ? [char, char] : [char], seed });
    this.app.session = this.session;
    const scene = new GameplayScene(this.app, { mission: o.missionId, section: o.sectionId, bossRush: o.bossRush });
    try {
      this.app.scenes.reset(scene);
    } catch (err) {
      this.stats.addError('GameplayScene.enter', err, 0);
    }
    this.observe();
  }

  private botHost(): { readonly topScene: Scene | null; readonly runner: MissionRunner | null } {
    const self = this;
    return {
      get topScene(): Scene | null {
        return self.app.scenes.top;
      },
      get runner(): MissionRunner | null {
        return self.runner;
      },
    };
  }

  get runner(): MissionRunner | null {
    return this.scene?.runner ?? null;
  }

  get world(): World | null {
    return this.runner?.world ?? null;
  }

  get done(): boolean {
    return this.missionComplete || (this.gameOver && this.o.autoContinue === false);
  }

  player(slot: 0 | 1 = 0): Player | null {
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

  runUntil(pred: (g: HeadlessGame) => boolean, maxTicks: number): boolean {
    for (let i = 0; i < maxTicks; i++) {
      if (pred(this)) return true;
      this.step(1);
    }
    return pred(this);
  }

  /** Follow scene, runner and world changes after every tick. */
  private observe(): void {
    const top = this.app.scenes.top;
    if (top !== this.lastTop) {
      if (top instanceof GameplayScene) this.scene = top;
      if (top instanceof ContinueScene) {
        this.stats.gameOvers++;
        this.gameOver = true;
      }
      this.lastTop = top;
    }
    const runner = this.runner;
    if (!runner) return;
    const world = runner.world;
    if (world && world !== this.lastWorld) {
      this.lastWorld = world;
      this.stats.watchWorld(world, runner.section.id);
    }
    if (world) this.stats.entityCount(world.entities.length);
    if (!this.missionComplete && (runner.state === 'victory' || runner.state === 'complete')) {
      this.missionComplete = true;
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

  teleport(x: number): void {
    const runner = this.runner;
    if (!runner) return;
    const world = runner.world;
    const t = world.terrain;
    runner.players.forEach((p, i) => {
      const px = Math.max(8, x - i * 20);
      const floor = t.surfaceY(px, t.bounds.y, Infinity);
      p.placeAt(px, Number.isFinite(floor) ? floor : world.camera.bottom - 40, 60);
    });
    world.camera.snap();
  }

  report(): SimReport {
    const slots = this.session.slots.filter((s) => s.joined);
    const sum = (f: (s: (typeof slots)[number]) => number): number => slots.reduce((a, s) => a + f(s), 0);
    const runner = this.runner;
    const p = this.player(0);
    const bot = typeof this.o.bot === 'object' ? this.o.bot : null;
    const lines = this.capture ? [...this.capture.lines.entries()].slice(0, 60).map(([l, n]) => (n > 1 ? `${l} (×${n})` : l)) : [];
    return {
      mission: this.o.missionId,
      seed: (this.o.seed ?? 1) >>> 0,
      players: this.o.players ?? 1,
      god: this.o.god ?? false,
      route: this.o.bot ? (bot?.route ?? 'lower') : null,
      difficulty: this.session.difficulty,
      ticks: this.ticks,
      seconds: Math.round((this.ticks / 60) * 10) / 10,
      sectionsVisited: [...this.stats.sectionsVisited],
      finalSection: runner?.section.id ?? '',
      finalX: p ? Math.round(p.x) : 0,
      missionComplete: this.missionComplete,
      completeTick: this.stats.completeTick,
      bossDefeated: this.stats.bossDefeated,
      gameOvers: this.stats.gameOvers,
      continues: sum((s) => s.continues),
      kills: sum((s) => s.stats.kills),
      knifeKills: sum((s) => s.stats.knifeKills),
      killsByType: { ...this.stats.killsByType },
      deaths: sum((s) => s.stats.deaths),
      deathCauses: { ...this.stats.deathCauses },
      shots: sum((s) => s.stats.shots),
      bombs: sum((s) => s.stats.bombsThrown),
      hostages: sum((s) => s.stats.hostages),
      pickups: sum((s) => s.stats.pickups),
      score: sum((s) => s.score),
      timeouts: this.stats.timeouts,
      maxEntities: this.stats.maxEntities,
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

/** Build a headless game (loads the content manifest first unless `loadContent: false`). */
export async function createHeadlessGame(o: HeadlessOptions): Promise<HeadlessGame> {
  applyTuning();
  const capture = o.captureConsole === false ? null : captureConsole(o.echoConsole ?? false);
  let failed: Array<{ id: string; error: string }> = [];
  if (o.loadContent !== false) failed = (await loadContent()).failed;
  const game = new Headless(o, capture);
  for (const f of failed) game.stats.add(`content "${f.id}"`, f.error.split('\n')[0], f.error, 0);
  return game;
}
