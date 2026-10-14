/**
 * Gameplay scene: a MissionRunner (world + section + players) with the HUD, the pause overlay,
 * 2-player join / continue (a credit each when credits are limited), debug hooks (F4 skip, F5
 * weapons) and the hand-offs to the continue screen and the mission-complete tally. It also
 * plays the attract-mode demo (GDD §13.3): a bot on ams-a (m1-a without it) with `DEMO PLAY`, ended by any key.
 *
 * Missions that have a mission card (flow-data.ts) start with the card's banner (`MISSION 1` /
 * `START!`, 120 ticks, GDD §13.6) and announcer line, and end with `MISSION COMPLETE! BRAVO!`,
 * unless the MissionDef sets its own `startBanner`, `announce` or `clearLine`.
 */
import { NullAudio } from '../../engine/audio';
import { ACTION_BUTTONS, type InputSource } from '../../engine/input';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { HI_ART_FRAME_BUDGET_MS, preloadSprites, setDeferHiArt, withArtDensity } from '../../engine/sprites';
import { blinkOn, centerText, newCampaign, UI_WHITE, type GameApp } from '../app';
import { drawHud } from '../hud';
import type { MissionDef } from '../mission/index';
import { MissionRunner } from '../mission/runner';
import { getMission, getWeapon, hasCharacter, hasMission, listMissions, listWeapons } from '../registry';
import { GameSession, type Difficulty, type SlotIndex } from '../session';
import { creditsOf } from '../settings';
import { TUNING } from '../tuning';
import { ContinueScene } from './continue';
import { hasMissionCard, missionCard, ROSTER, VOICE } from './flow-data';
import { MissionCompleteScene } from './mission-complete';
import { PauseScene } from './pause';

export interface NewGameOpts {
  players?: 1 | 2;
  difficulty?: Difficulty;
  /** Mission id (default: m1, else the first registered mission). */
  mission?: string;
  section?: string;
  bossRush?: boolean;
  /** Characters per player (default: ?char= or 'recruit'). */
  characters?: readonly string[];
}

/** The background 2× preload, once started (sprites.ts caches what it generated). */
let hiPreload: Promise<unknown> | null = null;

/** Wait for the next browser frame (a 0 ms timeout where there is no requestAnimationFrame). */
function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Time budget (ms) of the 2× preload per browser frame: about half a 60 fps frame. The same
 * budget runs the queued 2× scenery jobs (background layers, terrain chunks; SectionView).
 */
export const MISSION_ART_BUDGET_MS = HI_ART_FRAME_BUDGET_MS;

/**
 * The order of a mission's 2× preload: the sprites of the joined players' characters first (the
 * first thing drawn), then the mission's `preloadFirst` prefixes; its `preloadLast` prefixes last.
 */
export function missionArtOrder(
  mission: Pick<MissionDef, 'preloadFirst' | 'preloadLast'> | undefined,
  session: Pick<GameSession, 'slots'> | null | undefined,
): { first: string[]; last: string[] } {
  const chars = (session?.slots ?? []).filter((s) => s.joined).map((s) => `char/${s.character}/`);
  return { first: [...new Set(chars), ...(mission?.preloadFirst ?? [])], last: [...(mission?.preloadLast ?? [])] };
}

/**
 * Start generating the 2× sprites (docs/ARCHITECTURE.md §3) in the background when a mission
 * draws 2× art (`density` 2, default the mission's `artDensity`): boot only makes the 1× frames,
 * so without this the first seconds of the mission would generate 2× frames lazily while drawing.
 * Each browser frame generates ids for MISSION_ART_BUDGET_MS, in `missionArtOrder` (the players'
 * characters, then what the first section shows; the boss last). The mission intro card starts
 * it; gameplay calls it again for a direct start (`?mission=`). Once is enough: later calls do
 * nothing. Only the browser app asks for it (`app.preloadArt`): headless runs (sims, tests,
 * shots) generate 2× frames lazily, if they draw at all.
 * It also switches on `setDeferHiArt`: the 2× scenery (background layers, terrain chunks) of each
 * section becomes art jobs that this preload runs first in its slices (and, once it is done, the
 * section view within the same budget per frame), so a section start never stalls on 2× scenery.
 * Returns true when the preload runs (started now or before).
 */
export function preloadMissionArt(
  app: Pick<GameApp, 'preloadArt' | 'session'>,
  mission: Pick<MissionDef, 'artDensity' | 'preloadFirst' | 'preloadLast'> | undefined,
  density = mission?.artDensity ?? 1,
  session: Pick<GameSession, 'slots'> | null = app.session,
): boolean {
  if (density < 2 || !app.preloadArt) return hiPreload !== null;
  // The 2× scenery of the sections becomes art jobs in the same budget (never a stalled frame).
  setDeferHiArt(true);
  hiPreload ??= preloadSprites(undefined, undefined, {
    density,
    timeBudgetMs: MISSION_ART_BUDGET_MS,
    ...missionArtOrder(mission, session),
    yieldFn: nextFrame,
  });
  return true;
}

/**
 * Start fetching and decoding a mission's sample group (`MissionDef.audioGroup`) in the
 * background, fire-and-forget. Returns the group name, or null when there is nothing to load.
 * Until it is ready the synth plays.
 */
export function preloadMissionAudio(app: Pick<GameApp, 'audio'>, mission: Pick<MissionDef, 'audioGroup'> | undefined): string | null {
  const group = mission?.audioGroup;
  if (!group || !app.audio.loadSamples) return null;
  void app.audio.loadSamples(group);
  return group;
}

/** Has the background 2× preload started (tests)? */
export function missionArtPreloadStarted(): boolean {
  return hiPreload !== null;
}

/** The mission a new game starts with: the Amsterdam prologue `ams`, else m1. */
export function firstMission(): string {
  if (hasMission('ams')) return 'ams';
  if (hasMission('m1')) return 'm1';
  const ids = listMissions();
  return ids.find((id) => id !== 'm0') ?? ids[0] ?? 'm0';
}

/** A new session for the options: difficulty, credits (CREDITS option), characters. */
export function newSession(app: GameApp, characters: readonly string[], difficulty?: Difficulty): GameSession {
  return new GameSession({
    difficulty: difficulty ?? app.params.difficulty ?? app.settings.difficulty,
    characters,
    credits: creditsOf(app.settings.credits),
    seed: app.params.seed ?? 1,
  });
}

/**
 * Start a fresh game (new session) straight into a mission, skipping the menus and the intro
 * card (URL `?mission=`, tools, tests). The menus use `startCampaign` (flow.ts).
 */
export function startNewGame(app: GameApp, o: NewGameOpts = {}): void {
  const players = o.players ?? app.params.players;
  const char = app.params.char ?? 'recruit';
  const characters = o.characters ?? (players === 2 ? [char, char] : [char]);
  app.input.players = players;
  app.session = newSession(app, characters, o.difficulty);
  app.campaign = newCampaign();
  const scene = new GameplayScene(app, { mission: o.mission ?? firstMission(), section: o.section, bossRush: o.bossRush });
  app.scenes.reset(scene, { fade: 30 });
}

/**
 * The character of a player who joins mid-game: the first roster Cygnet the other player is not
 * using (GDD §13.5: two players never share a character), else the other player's, else `recruit`.
 */
export function joinCharacter(other: string): string {
  for (const id of ROSTER) if (id !== other && hasCharacter(id)) return id;
  return other || 'recruit';
}

/** The attract-mode demo (GDD §13.3). */
export interface DemoOpts {
  /** The autopilot driving player 1 (the sim bot), added to the input while the demo runs. */
  bot: InputSource | null;
  /** Demo length in ticks (1200). */
  ticks: number;
  /** Called once when the demo ends: time up, the player is out, or any real key / click. */
  onEnd: (byKey: boolean) => void;
}

export interface GameplayOpts {
  mission: string;
  section?: string;
  bossRush?: boolean;
  /** Use this session instead of `app.session` (the attract demo). */
  session?: GameSession;
  demo?: DemoOpts;
}

/** The start banner of a mission with a card lasts 120 ticks (GDD §13.6). */
const START_BANNER_TICKS = 120;

/** A shallow copy of the MissionDef with the card's banner, announcer line and clear line as defaults. */
function withCard(id: string): MissionDef | string {
  const def = getMission(id);
  if (!def || !hasMissionCard(id)) return id;
  const card = missionCard(id);
  return {
    ...def,
    startBanner: def.startBanner ?? { text: card.label, sub: card.startSub ?? 'START!' },
    announce: def.announce ?? card.announce,
    clearLine: def.clearLine ?? VOICE.missionComplete,
  };
}

export class GameplayScene implements Scene {
  readonly app: GameApp;
  readonly opts: GameplayOpts;
  runner!: MissionRunner;
  private t = 0;
  private weaponCycle = 0;
  private demoEnded = false;
  /** A scene on top silenced the loops (pause / resume). */
  private loopsPaused = false;
  private removeBot: (() => void) | null = null;

  constructor(app: GameApp, opts: GameplayOpts) {
    this.app = app;
    this.opts = opts;
  }

  get session(): GameSession {
    if (this.opts.session) return this.opts.session;
    if (!this.app.session) this.app.session = new GameSession({ seed: this.app.params.seed ?? 1 });
    return this.app.session;
  }

  /** True while this scene plays the attract demo. */
  get demo(): boolean {
    return this.opts.demo !== undefined;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.audio.duckMusic?.(1);
    app.focusLost = false;
    app.pointerPressed = false;
    const demo = this.opts.demo;
    const runner = new MissionRunner({
      session: this.session,
      mission: withCard(this.opts.mission),
      section: this.opts.section,
      pads: [app.input.pad(0), app.input.pad(1)],
      // The demo plays silently under the title song.
      audio: demo ? new NullAudio() : app.audio,
      seed: app.params.seed ?? this.session.seed,
      bossRush: this.opts.bossRush,
      settings: app.settings,
      // The attract demo keeps the 1× art: no 2× generation behind the title screen.
      artDensity: demo ? 1 : undefined,
    });
    this.runner = runner;
    if (!demo) {
      preloadMissionArt(app, runner.mission, runner.artDensity, this.session);
      // A direct start (?mission=, a continue, the next mission): the intro card did not run.
      preloadMissionAudio(app, runner.mission);
    }
    runner.events.on('complete', () => {
      if (this.demo) this.endDemo(false);
      else app.scenes.replace(new MissionCompleteScene(app, runner), { fade: 40 });
    });
    runner.events.on('gameOver', () => {
      if (this.demo) this.endDemo(false);
      else app.scenes.push(new ContinueScene(app, runner));
    });
    // TIME UP! is an announcer line too (GDD §12.3).
    runner.events.on('sectionLoaded', () => {
      runner.world.events.on('timeOut', () => {
        if (!this.demo) app.audio.voice('TIME UP!');
      });
    });
    runner.start();
    // A mission card's start banner shows for 120 ticks (the runner's default is longer).
    const b = runner.hud.banner;
    if (b && b.style === 'mission' && hasMissionCard(this.opts.mission) && !getMission(this.opts.mission)?.startBanner) b.ticks = b.total = START_BANNER_TICKS;
    if (demo) {
      runner.hud.clearBanner();
      if (demo.bot) this.removeBot = app.input.addSource(demo.bot);
    }
    const weapon = app.params.weapon;
    if (weapon && !demo) for (const p of runner.players) p.giveWeapon(weapon, undefined, false);
    app.debug.on('skip', () => runner.skip());
    app.debug.on('weapons', () => this.cycleWeapons());
  }

  exit(): void {
    this.app.debug.on('skip', () => {});
    this.app.debug.on('weapons', () => {});
    this.removeBot?.();
    this.removeBot = null;
    // Leaving gameplay (pause QUIT, game over, mission end): the ambience, the Swan's engine and
    // the other loops stop (at once when they were paused under a menu), and the loop bus
    // comes back up for the next screens.
    if (this.runner) this.runner.stopLoops(this.loopsPaused ? 0 : 30);
    if (this.loopsPaused) this.app.audio.resumeLoops?.();
    this.loopsPaused = false;
  }

  /**
   * A scene opened on top (pause menu, continue screen): the music plays on at half level
   * (GDD §13.8) and the looping sounds (ambience, engines) fall silent until the game resumes.
   */
  pause(): void {
    this.app.audio.duckMusic?.(0.5);
    this.app.audio.pauseLoops?.();
    this.loopsPaused = true;
  }

  resume(): void {
    this.app.audio.duckMusic?.(1);
    this.app.audio.resumeLoops?.();
    this.loopsPaused = false;
    // Only the action buttons: a direction held through the pause keeps moving the player.
    this.app.input.suppress(ACTION_BUTTONS);
  }

  update(): void {
    this.t++;
    const app = this.app;
    const input = app.input;
    const runner = this.runner;
    if (this.demo) {
      this.updateDemo();
      if (this.demoEnded) return;
    } else if (runner.state === 'playing' && !app.scenes.busy) {
      // Pause: Esc / P, start on the pad of a player who is in the game, or a lost window focus.
      let pause = input.pausePressed || app.focusLost;
      app.focusLost = false;
      for (const p of runner.players) if (p.state !== 'out' && input.pad(p.index).pressed('start')) pause = true;
      if (pause) {
        app.scenes.push(new PauseScene(app, this));
        return;
      }
      if (input.players === 2) this.handleJoin();
    }
    app.debug.apply(runner.world);
    if (this.demo) runner.world.god = true;
    runner.update();
    const cam = runner.world.camera;
    runner.hud.trackCamera(cam.x, cam.y);
  }

  /** The demo ends after its ticks, or at once on any real key, pad button or click. */
  private updateDemo(): void {
    const demo = this.opts.demo;
    if (!demo || this.demoEnded) return;
    const app = this.app;
    const byKey = app.input.rawPressed.length > 0 || app.pointerPressed;
    app.pointerPressed = false;
    if (byKey || this.t >= demo.ticks) this.endDemo(byKey);
  }

  private endDemo(byKey: boolean): void {
    if (this.demoEnded) return;
    this.demoEnded = true;
    this.removeBot?.();
    this.removeBot = null;
    this.opts.demo?.onEnd(byKey);
  }

  /** 2-player mode: start joins an empty slot (a credit when credits are limited) or continues a slot that is out. */
  private handleJoin(): void {
    const s = this.session;
    for (let i = 0; i < 2; i++) {
      const slot = s.slots[i];
      const pad = this.app.input.pad(i as 0 | 1);
      if (!pad.pressed('start')) continue;
      if (!slot.joined) {
        if (s.credits !== Infinity) {
          if (s.credits <= 0) continue;
          s.credits--;
        }
        this.runner.joinPlayer(i as SlotIndex, joinCharacter(s.slots[1 - i].character));
        this.app.audio.sfx('ui/coin');
      } else if (slot.gameOver && this.runner.continueTicks[i] < 0) {
        if (this.runner.continuePlayer(i as SlotIndex)) this.app.audio.sfx('ui/confirm');
      }
    }
  }

  /** Debug F5: give the next registered player weapon with full ammo, and 99 bombs. */
  private cycleWeapons(): void {
    const ids = listWeapons((w) => (w.kind ?? 'gun') === 'gun');
    if (ids.length === 0) return;
    const id = ids[this.weaponCycle++ % ids.length];
    for (const p of this.runner.players) {
      p.giveWeapon(id, getWeapon(id).maxAmmo ?? TUNING.weapons.maxAmmo);
      p.addBombs(TUNING.grenade.cap);
    }
  }

  draw(r: Renderer): void {
    const runner = this.runner;
    r.begin(runner.sky);
    runner.draw(r);
    // The HUD draws with the mission's art density too (2× icons where they exist).
    withArtDensity(runner.artDensity, () =>
      drawHud(r, { session: this.session, hud: runner.hud, runner, inputPlayers: this.app.input.players, ticks: this.t, settings: this.app.settings }),
    );
    if (this.demo && blinkOn(this.t)) centerText(r, 'DEMO PLAY', 40, UI_WHITE, 'big');
    if (!this.demo) this.app.debug.draw(r, runner.world);
  }
}
