/**
 * Headless first-person harness (docs/design/fps.md §10, docs/api/fps.md §6): the real app with
 * an FpsScene on one floor, the software renderer, silent counting audio and scripted fps input.
 * Used by `npm run shot -- --fps n`, the fps tests and (later) the fps bot and sim.
 *
 * ```ts
 * const h = await createHeadlessFps({ floor: 0, seed: 1, pose: { x: 2.5, y: 5.5, deg: 0 } });
 * h.step(60);
 * const png = h.renderFrame();     // PixelBuffer 384×216
 * console.log(h.report());
 * h.dispose();
 * ```
 * Pure TypeScript (no DOM, no node APIs).
 */
import type { AnalogState } from '../engine/input-actions';
import { InputManager, ScriptedSource } from '../engine/input';
import type { PixelBuffer } from '../engine/pixel';
import { degToAng } from '../engine/ray';
import { SoftRenderer } from '../engine/render-soft';
import { MemoryStore } from '../engine/storage';
import { createApp, newCampaign, type GameApp } from '../game/app';
import { loadContent } from '../game/content/index';
import type { FpsGame } from '../game/fps/game';
import { newFpsRun } from '../game/fps/run';
import type { FpsRun } from '../game/fps/types';
import { DEFAULT_PARAMS } from '../game/params';
import { FpsScene } from '../game/scenes/fps';
import { loadFpsContent } from '../game/scenes/fps-intro';
import { GameSession, type Difficulty } from '../game/session';
import { applyTuning } from '../game/tuning';
import { FpsBot } from './bot-fps';
import { captureConsole, releaseConsole, SimAudio, SimStats, type ConsoleCapture, type SimError } from './stats';

/** Scripted first-person input: held action masks and analog values per tick. */
export interface FpsScript {
  actions?: (tick: number) => number;
  analog?: (tick: number, out: AnalogState) => void;
}

export interface HeadlessFpsOptions {
  /** Floor number (default 0). */
  floor?: number;
  seed?: number;
  difficulty?: Difficulty;
  god?: boolean;
  players?: 1 | 2;
  input?: FpsScript;
  /** Drive the player with the fps bot (bot-fps.ts; `input` is ignored). */
  bot?: boolean;
  /** Start pose (tiles, degrees: 0 east, 90 south). Also skips the unfold. */
  pose?: { x: number; y: number; deg: number };
  /** Play the 30-tick unfold (default false: the view is open at tick 0). */
  unfold?: boolean;
  /** Also load the eager (2D) content (default false: the fps scene does not need it). */
  loadBase?: boolean;
  /** Collect console warnings / errors into the report (default true) and echo them (default false). */
  captureConsole?: boolean;
  echoConsole?: boolean;
}

export interface FpsReport {
  floor: number;
  seed: number;
  ticks: number;
  complete: boolean;
  deaths: number;
  kills: number;
  /** Placed enemies of the floor (kill % total; the boss counts as one). */
  killsTotal: number;
  secrets: number;
  secretsTotal: number;
  treasure: number;
  treasureTotal: number;
  goldenRecord: boolean;
  /** The fps slot's score. */
  score: number;
  /** Floor clock ticks (stops at the elevator / the boss's 0 HP). */
  clock: number;
  /** Boss floors: the boss phase reached (0 = no boss) and whether he died. */
  bossPhase: number;
  bossDead: boolean;
  hp: number;
  ammo: number;
  stateHash: number;
  errors: SimError[];
  warnings: string[];
  missingSfx: string[];
}

export interface HeadlessFps {
  readonly app: GameApp;
  readonly input: InputManager;
  readonly renderer: SoftRenderer;
  readonly audio: SimAudio;
  readonly session: GameSession;
  readonly run: FpsRun;
  /** The FpsScene of the floor (the first one; null when it failed to start). */
  readonly scene: FpsScene | null;
  readonly game: FpsGame | null;
  readonly ticks: number;
  /** The floor ended (elevator / F4). */
  readonly complete: boolean;
  /** The bot (with `bot: true`), else null. */
  readonly bot: FpsBot | null;
  step(n?: number): void;
  runUntil(pred: (h: HeadlessFps) => boolean, maxTicks: number): boolean;
  /** Put the player at (x, y) tiles facing `deg` degrees. */
  setPose(x: number, y: number, deg: number): void;
  renderFrame(): PixelBuffer;
  report(): FpsReport;
  dispose(): void;
}

class HeadlessFpsImpl implements HeadlessFps {
  readonly app: GameApp;
  readonly input = new InputManager();
  readonly renderer = new SoftRenderer();
  readonly audio = new SimAudio();
  readonly session: GameSession;
  readonly run: FpsRun;
  readonly stats = new SimStats();
  scene: FpsScene | null = null;
  bot: FpsBot | null = null;
  ticks = 0;
  complete = false;
  deaths = 0;
  private readonly o: HeadlessFpsOptions;
  private readonly capture: ConsoleCapture | null;

  constructor(o: HeadlessFpsOptions, capture: ConsoleCapture | null) {
    this.o = o;
    this.capture = capture;
    const floor = o.floor ?? 0;
    const seed = (o.seed ?? 1) >>> 0;
    const players = o.players ?? 1;
    this.input.players = players;
    if (o.bot) {
      const bot = new FpsBot(() => this.game, seed);
      this.bot = bot;
      this.input.addSource(new ScriptedSource(() => 0, 0, { actions: (t) => bot.actions(t), analog: (t, out) => bot.analog(t, out) }));
    } else if (o.input) this.input.addSource(new ScriptedSource(() => 0, 0, { actions: o.input.actions, analog: o.input.analog }));
    const params = { ...DEFAULT_PARAMS, god: o.god ?? false, seed, players, difficulty: o.difficulty ?? null, mode: 'fps' as const, floor };
    this.app = createApp({ input: this.input, audio: this.audio, store: new MemoryStore(), params });
    this.app.debug.god = o.god ?? false;
    this.session = new GameSession({ difficulty: o.difficulty ?? 'normal', characters: players === 2 ? ['recruit', 'recruit'] : ['recruit'], seed });
    this.app.session = this.session;
    this.app.campaign = newCampaign();
    this.run = newFpsRun(this.session, floor);
    this.session.startMission(`fps-${floor}`);
    this.run.entered = true;
    try {
      const scene = new FpsScene(this.app, this.run);
      this.scene = scene;
      scene.game.events.on('floorComplete', () => {
        this.complete = true;
      });
      scene.game.events.on('playerDead', () => {
        this.deaths++;
      });
      this.app.scenes.reset(scene);
      // The scene suppresses held actions on enter (a real key held through the scene change);
      // a script that holds from tick 0 means it, so the harness clears that suppression.
      this.input.actions.reset();
      if (o.pose) this.setPose(o.pose.x, o.pose.y, o.pose.deg);
      else if (!o.unfold) scene.game.skipUnfold();
    } catch (err) {
      this.stats.addError('FpsScene', err, 0);
    }
  }

  get game(): FpsGame | null {
    return this.scene?.game ?? null;
  }

  setPose(x: number, y: number, deg: number): void {
    const g = this.game;
    if (!g) return;
    g.setPose(x, y, degToAng(deg));
    g.skipUnfold();
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      try {
        this.input.update();
        this.app.scenes.update();
      } catch (err) {
        this.stats.addError('scene.update', err, this.ticks);
      }
      this.ticks++;
    }
  }

  runUntil(pred: (h: HeadlessFps) => boolean, maxTicks: number): boolean {
    for (let i = 0; i < maxTicks; i++) {
      if (pred(this)) return true;
      this.step(1);
    }
    return pred(this);
  }

  renderFrame(): PixelBuffer {
    const r = this.renderer;
    try {
      r.begin();
      this.app.scenes.draw(r);
      r.end();
    } catch (err) {
      this.stats.addError('scene.draw', err, this.ticks);
    }
    return r.target;
  }

  report(): FpsReport {
    const g = this.game;
    const lines = this.capture ? [...this.capture.lines.entries()].slice(0, 60).map(([l, n]) => (n > 1 ? `${l} (×${n})` : l)) : [];
    const t = g ? g.items.treasure() : { taken: 0, total: 0, record: false };
    const boss = g?.boss ?? null;
    return {
      floor: this.run.floor,
      seed: (this.o.seed ?? 1) >>> 0,
      ticks: this.ticks,
      complete: this.complete,
      deaths: this.deaths,
      kills: g?.actors.kills ?? 0,
      killsTotal: g?.actors.placedTotal ?? 0,
      secrets: g?.pushes.found ?? 0,
      secretsTotal: g?.map.pushes.length ?? 0,
      treasure: t.taken,
      treasureTotal: t.total,
      goldenRecord: t.record,
      score: this.session.slots[this.run.slot].score,
      clock: g?.clock ?? 0,
      bossPhase: boss ? boss.phase : 0,
      bossDead: boss ? !boss.actor.alive && boss.phase === 2 : false,
      hp: g?.player.hp ?? 0,
      ammo: g?.player.ammo ?? 0,
      stateHash: g?.stateHash() ?? 0,
      errors: this.stats.errorList(),
      warnings: lines,
      missingSfx: [...this.audio.missingSfx].sort(),
    };
  }

  dispose(): void {
    if (this.capture) releaseConsole(this.capture);
  }
}

/** Build a headless fps floor (loads the lazy fps content first, once per process). */
export async function createHeadlessFps(o: HeadlessFpsOptions = {}): Promise<HeadlessFps> {
  applyTuning();
  const capture = o.captureConsole === false ? null : captureConsole(o.echoConsole ?? false);
  const stub = createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore() });
  if (o.loadBase) await loadContent();
  await loadFpsContent(stub);
  return new HeadlessFpsImpl(o, capture);
}

export interface RunFpsOptions extends HeadlessFpsOptions {
  /** Stop after this many ticks (default 60 × 60 × 5). */
  maxTicks?: number;
}

/** Run a floor until it ends or `maxTicks` (spec §10). */
export async function runFps(o: RunFpsOptions = {}): Promise<FpsReport> {
  const h = await createHeadlessFps(o);
  try {
    h.runUntil((x) => x.complete, o.maxTicks ?? 18000);
    return h.report();
  } finally {
    h.dispose();
  }
}
