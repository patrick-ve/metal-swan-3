/**
 * The headless rally (docs/design/rally.md §14 item 3; docs/api/rally.md "A.11", "A.D"): the real
 * app with the real `RallyScene` (a `NullView3d`: node has no WebGL, the race is logic only), a
 * `SoftRenderer` (nothing is drawn unless `renderFrame()` is called), `SimAudio`, a `MemoryStore`,
 * and the rally bot (bot-rally.ts) as the input: the input manager's race mode is on, so the bot
 * drives through the race channel (analog steer, gas and brake), the path of a pad with a stick and
 * triggers.
 *
 * `runRally(o)` plays one race until the runner's 'complete' (or `maxTicks`) and returns the
 * `RallySimReport`: the runner's report (places, lap ticks, finish ticks, fines, score, stateHash)
 * plus the ticks, the game seconds, errors, console warnings, missing sounds and timing. The same
 * seed gives the same report (timing aside); drawing never changes the `stateHash`.
 */
import { InputManager } from '../engine/input';
import type { PixelBuffer } from '../engine/pixel';
import { SoftRenderer } from '../engine/render-soft';
import { MemoryStore } from '../engine/storage';
import { NullView3d, type View3d } from '../engine/view3d';
import { createApp, newCampaign, type GameApp } from '../game/app';
import { DEFAULT_PARAMS } from '../game/params';
import type { RallyReport } from '../game/rally/api';
import { linesCents } from '../game/rally/score';
import type { RallyCam } from '../game/rally/ids';
import type { RallyRunner } from '../game/rally/runner';
import { RallyScene } from '../game/scenes/rally';
import { loadRallyContent, prepareRally } from '../game/scenes/rally-route';
import { GameSession, type Difficulty } from '../game/session';
import { applyTuning } from '../game/tuning';
import { RallyBot } from './bot-rally';
import { captureConsole, releaseConsole, SimAudio, SimStats, type ConsoleCapture, type SimError, type SimTiming } from './stats';

export interface HeadlessRallyOptions {
  seed?: number;
  players?: 1 | 2;
  difficulty?: Difficulty;
  /** `?lap=`: start at this lap. */
  lap?: 1 | 2 | 3;
  cam?: RallyCam;
  /** Drive the player cars with the rally bot (default true). */
  bot?: boolean;
  /** The bot's pace (of its car's top speed; default the bot's own, `RallyBot.pace` 0.94). */
  botPace?: number;
  /** The player estates start at the back of the grid (`RallyOpts.gridBack`: the overtaking gate). */
  gridBack?: boolean;
  /** The race channel (`InputManager.raceMode`; default true). False: the bot presses the 8 buttons. */
  raceMode?: boolean;
  /** The 3D view (default `new NullView3d()`: draws nothing). */
  view3d?: View3d;
  /** Collect console warnings / errors into the report (default true) and echo them (default false). */
  captureConsole?: boolean;
  echoConsole?: boolean;
  /** A clock for the timing numbers (ms; default none: no timing). */
  clock?: () => number;
}

export interface RallySimReport extends RallyReport {
  /**
   * The euro budget per joined slot in cents after the race's prize money (docs/design/oat.md (deleted; git show eb3316a)
   * §7.8, §7.10): the slot's budget + the lines' cents × the difficulty factor (what the tally books).
   */
  budget: number[];
  /** Game seconds (ticks / 60, one decimal). */
  seconds: number;
  errors: SimError[];
  warnings: string[];
  missingSfx: string[];
  timing: SimTiming | null;
}

export class HeadlessRally {
  readonly input = new InputManager();
  readonly audio = new SimAudio();
  readonly renderer = new SoftRenderer();
  readonly app: GameApp;
  readonly session: GameSession;
  readonly stats = new SimStats();
  readonly bot: RallyBot | null = null;
  scene: RallyScene | null = null;
  ticks = 0;
  private readonly o: HeadlessRallyOptions;
  private readonly capture: ConsoleCapture | null;

  constructor(o: HeadlessRallyOptions, capture: ConsoleCapture | null) {
    this.o = o;
    this.capture = capture;
    const seed = (o.seed ?? 1) >>> 0;
    const players = o.players ?? 1;
    this.input.players = players;
    this.input.raceMode = o.raceMode !== false;
    if (o.bot !== false) {
      const bot = new RallyBot(() => this.runner);
      if (o.botPace !== undefined) bot.pace = o.botPace;
      this.bot = bot;
      this.input.addSource(bot);
    }
    const params = { ...DEFAULT_PARAMS, mission: 'rally', seed, players, difficulty: o.difficulty ?? null, lap: o.lap, cam: o.cam };
    this.app = createApp({ input: this.input, audio: this.audio, store: new MemoryStore(), params, view3d: o.view3d ?? new NullView3d() });
    this.session = new GameSession({ difficulty: o.difficulty ?? 'normal', characters: players === 2 ? ['recruit', 'vincent'] : ['recruit'], seed });
    this.app.session = this.session;
    this.app.campaign = newCampaign();
    try {
      const start = prepareRally(this.app, { seed });
      if (o.gridBack) start.gridBack = true;
      const scene = new RallyScene(this.app, { start });
      this.scene = scene;
      this.app.scenes.reset(scene);
    } catch (err) {
      this.stats.addError('RallyScene', err, 0);
    }
  }

  get runner(): RallyRunner | null {
    return this.scene?.runner ?? null;
  }

  /** The race is over ('complete': the scene moves on to the tally). */
  get done(): boolean {
    return this.runner?.done ?? false;
  }

  step(n = 1): void {
    const clock = this.o.clock;
    for (let i = 0; i < n; i++) {
      const t0 = clock ? clock() : 0;
      try {
        this.input.update();
        this.app.scenes.update();
      } catch (err) {
        this.stats.addError('scene.update', err, this.ticks);
      }
      if (clock) this.stats.tickTime(clock() - t0);
      this.ticks++;
    }
  }

  runUntil(pred: (h: HeadlessRally) => boolean, maxTicks: number): boolean {
    for (let i = 0; i < maxTicks; i++) {
      if (pred(this)) return true;
      this.step(1);
    }
    return pred(this);
  }

  renderFrame(): PixelBuffer {
    const r = this.renderer;
    const clock = this.o.clock;
    const t0 = clock ? clock() : 0;
    try {
      r.begin();
      this.app.scenes.draw(r);
      r.end();
    } catch (err) {
      this.stats.addError('scene.draw', err, this.ticks);
    }
    if (clock) this.stats.frameTime(clock() - t0);
    return r.target;
  }

  report(): RallySimReport {
    const lines = this.capture ? [...this.capture.lines.entries()].slice(0, 60).map(([l, n]) => (n > 1 ? `${l} (×${n})` : l)) : [];
    const r = this.runner;
    const base: RallyReport = r
      ? r.report()
      : { seed: (this.o.seed ?? 1) >>> 0, ticks: 0, complete: false, players: this.o.players ?? 1, difficulty: this.o.difficulty ?? 'normal', laps: 0, places: [], lapTicks: [], finishTicks: [], fines: [], score: [], stateHash: 0 };
    // The prize money is paid as it stands at every difficulty (spec §7.8: FINES − € 120 each).
    const budget = r ? r.session.slots.filter((s) => s.joined).map((s) => s.cents + linesCents(r.raceLines(s.index))) : [];
    return {
      ...base,
      budget,
      seconds: Math.round(base.ticks / 6) / 10,
      errors: this.stats.errorList(),
      warnings: lines,
      missingSfx: [...this.audio.missingSfx].sort(),
      timing: this.stats.timing(),
    };
  }

  dispose(): void {
    if (this.capture) releaseConsole(this.capture);
  }
}

/** Build a headless race (loads the lazy rally content first, once per process). */
export async function createHeadlessRally(o: HeadlessRallyOptions = {}): Promise<HeadlessRally> {
  applyTuning();
  const capture = o.captureConsole === false ? null : captureConsole(o.echoConsole ?? false);
  await loadRallyContent();
  return new HeadlessRally(o, capture);
}

export interface RunRallyOptions extends HeadlessRallyOptions {
  /** Stop after this many ticks (default 60 × 60 × 15: 15 minutes). */
  maxTicks?: number;
}

/** Run one race until it completes or `maxTicks`. */
export async function runRally(o: RunRallyOptions = {}): Promise<RallySimReport> {
  const h = await createHeadlessRally(o);
  try {
    h.runUntil((x) => x.done, o.maxTicks ?? 54000);
    return h.report();
  } finally {
    h.dispose();
  }
}
