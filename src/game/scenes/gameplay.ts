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
import { browserArtPool, type ArtPool } from '../../engine/art-pool';
import {
  artTier,
  denseBytes,
  hasFramesAt,
  hasHiSprite,
  HI_ART_FRAME_BUDGET_MS,
  listHiSprites,
  preloadOrder,
  releaseDense,
  setDeferDense,
  setDeferHiArt,
  takeDenseQueue,
  toArtDensity,
  withArtDensity,
} from '../../engine/sprites';
import { blinkOn, centerText, newCampaign, UI_WHITE, type GameApp } from '../app';
import { drawHud } from '../hud';
import type { MissionDef } from '../mission/index';
import { MissionRunner } from '../mission/runner';
import { getMission, getWeapon, hasCharacter, hasMission, listMissions, listWeapons } from '../registry';
import { GameSession, type Difficulty, type SlotIndex } from '../session';
import { creditsOf, type GameSettings } from '../settings';
import { TUNING } from '../tuning';
import { ContinueScene, type Continuable } from './continue';
import { hasMissionCard, missionCard, ROSTER, VOICE } from './flow-data';
import { GlitchBridgeScene } from './glitch-bridge';
import { MissionCompleteScene } from './mission-complete';
import { PauseScene, type PauseHost } from './pause';

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

/**
 * Time budget (ms) of the 2× preload per browser frame: about half a 60 fps frame. The same
 * budget runs the queued 2× scenery jobs (background layers, terrain chunks; SectionView), and
 * the art pool's main-thread fallback (no Worker, or a broken worker).
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

/** The mission art the preload needs: its order prefixes, sections and boss section. */
export type MissionArtDef = Pick<MissionDef, 'artDensity' | 'preloadFirst' | 'preloadLast'> &
  Partial<Pick<MissionDef, 'id' | 'start' | 'sections' | 'bossSection'>>;

type ArtApp = Pick<GameApp, 'preloadArt' | 'session'> & { readonly artCache?: GameApp['artCache'] };

/**
 * Bytes of 4× frames the tier-4 working set keeps resident (plan: 256 MB). Over it, the ids of
 * the sections behind are released, least recently used first (the chosen heroes never are).
 */
export const DENSE_BUDGET_BYTES = 256 * 1024 * 1024;
/** How often (ms) the tier-4 pump hands the 4× ids drawn without frames to the pool. */
export const DENSE_PUMP_MS = 250;

let denseBudget = DENSE_BUDGET_BYTES;
let poolFactory: () => ArtPool = () => browserArtPool(undefined, { fallbackBudgetMs: MISSION_ART_BUDGET_MS });
let pool: ArtPool | null = null;

/** The art pool of the mission preloads (created on first use: browser workers, or main thread). */
function missionPool(): ArtPool {
  return (pool ??= poolFactory());
}

/** The tier-4 working set of the running mission. */
interface DenseRun {
  key: string;
  app: ArtApp;
  mission: MissionArtDef;
  /** Section ids in play order. */
  order: string[];
  /** `char/<id>/` of the chosen heroes (pinned: never released, never another hero at 4×). */
  heroes: string[];
  index: number;
  /** Section index of each 4× id's last use (built for, or drawn in, that section). */
  lastUse: Map<string, number>;
  inFlight: Set<string>;
  /**
   * Ids a pool build did not deliver at 4× (a broken 4× generator, or the main-thread fallback
   * without workers, which never generates 4× art): they keep their 2× frames and are not
   * queued again this run (no rebuild loop every DENSE_PUMP_MS).
   */
  unbuilt: Set<string>;
  /** Ids already in a section pack this session. */
  packed: Set<string>;
  timer: ReturnType<typeof setInterval> | null;
}

let dense: DenseRun | null = null;

/** Sprite id prefixes a section declares (`art` on its SectionDef, when present). */
function sectionArt(mission: MissionArtDef, section: string | undefined): readonly string[] {
  if (!section) return [];
  return mission.sections?.[section]?.art ?? [];
}

/** Ids (4× generators only) under `prefixes`, ranked by the first prefix each matches. */
function idsUnder(prefixes: readonly string[], all: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of prefixes) {
    for (const id of all) {
      if (!seen.has(id) && id.startsWith(p)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/**
 * The tier-4 working set of section `index` in build order: the chosen heroes, the mission's
 * `preloadFirst`, the current and the next section's `art`, the boss (`preloadLast`) at the end.
 * Only ids with a 4× generator; the other heroes never.
 */
export function denseWorkingSet(
  mission: MissionArtDef,
  heroes: readonly string[],
  section: string | undefined,
  next: string | undefined,
): string[] {
  const all = listHiSprites(4).filter((id) => !id.startsWith('char/') || heroes.some((h) => id.startsWith(h)));
  return idsUnder([...heroes, ...(mission.preloadFirst ?? []), ...sectionArt(mission, section), ...sectionArt(mission, next), ...(mission.preloadLast ?? [])], all);
}

/**
 * Release 4× ids of the sections behind (least recently used first, never the heroes) until
 * the resident 4× frames fit `budget`. Returns the bytes freed.
 */
function trimDense(run: DenseRun, budget = denseBudget): number {
  let over = denseBytes(4) - budget;
  if (over <= 0) return 0;
  const behind = [...run.lastUse].filter(([id, at]) => at < run.index && !run.heroes.some((h) => id.startsWith(h)));
  behind.sort((a, b) => a[1] - b[1]);
  let freed = 0;
  for (const [id] of behind) {
    if (over <= 0) break;
    const n = releaseDense([id], 4);
    run.lastUse.delete(id);
    freed += n;
    over -= n;
  }
  return freed;
}

/** Build `ids` at 4× through the pool (those not built or in flight), then trim to the budget. */
async function buildDense(run: DenseRun, ids: readonly string[]): Promise<void> {
  const todo = ids.filter((id) => !hasFramesAt(id, 4) && !run.inFlight.has(id) && !run.unbuilt.has(id));
  for (const id of ids) run.lastUse.set(id, run.index);
  if (todo.length === 0) return;
  for (const id of todo) run.inFlight.add(id);
  try {
    await missionPool().build(todo, 4);
  } catch (err) {
    // A failed build leaves the 2× stand-ins; the ids may be queued and tried again.
    console.warn('[art-pool] 4× build failed', err);
  } finally {
    for (const id of todo) {
      run.inFlight.delete(id);
      if (!hasFramesAt(id, 4)) run.unbuilt.add(id);
    }
  }
  if (dense === run) trimDense(run);
}

/** Hand the 4× ids drawn without frames (sprites.ts `takeDenseQueue`) to the pool. */
export function pumpDenseQueue(): number {
  const run = dense;
  const ids = takeDenseQueue();
  if (!run) return 0;
  const todo = ids.filter((id) => hasHiSprite(id, 4));
  if (todo.length) void buildDense(run, todo);
  return todo.length;
}

/** Enter section `section` of the tier-4 run: restore its 4× packs, build its working set, save. */
async function enterDenseSection(run: DenseRun, section: string): Promise<void> {
  const i = run.order.indexOf(section);
  run.index = Math.max(run.index, i < 0 ? 0 : i);
  const next = run.order[run.index + 1];
  const set = denseWorkingSet(run.mission, run.heroes, section, next);
  const inSet = new Set(set);
  const cache = run.app.artCache;
  if (cache) {
    for (const h of run.heroes) await cache.restore(`hd4-char-${h.split('/')[1]}`, (id) => id.startsWith(h));
    for (const s of [section, next]) if (s) await cache.restore(`hd4-${s}`, (id) => inSet.has(id));
  }
  if (dense !== run) return;
  await buildDense(run, set);
  if (!cache || dense !== run) return;
  for (const h of run.heroes) void cache.save(`hd4-char-${h.split('/')[1]}`, (id) => id.startsWith(h));
  const own = set.filter((id) => !run.packed.has(id) && !run.heroes.some((h) => id.startsWith(h)));
  for (const id of own) run.packed.add(id);
  const ownSet = new Set(own);
  void cache.save(`hd4-${section}`, (id) => ownSet.has(id));
}

/**
 * Tier 4: start (or keep) the working set of this mission and these heroes, from `section`.
 * Turns on `setDeferDense`: the main thread never generates 4× art during play.
 */
function startDense(app: ArtApp, mission: MissionArtDef, session: Pick<GameSession, 'slots'> | null, section: string | undefined): void {
  const heroes = [...new Set((session?.slots ?? []).filter((s) => s.joined).map((s) => `char/${s.character}/`))];
  const key = `${mission.id ?? '?'}|${heroes.join(',')}`;
  setDeferDense(true);
  if (dense?.key !== key) {
    if (dense?.timer) clearInterval(dense.timer);
    const order = Object.keys(mission.sections ?? {});
    dense = { key, app, mission, order, heroes, index: 0, lastUse: new Map(), inFlight: new Set(), unbuilt: new Set(), packed: new Set(), timer: null };
    if (app.preloadArt && typeof setInterval === 'function') dense.timer = setInterval(pumpDenseQueue, DENSE_PUMP_MS);
  }
  void enterDenseSection(dense, section ?? mission.start ?? dense.order[0] ?? '');
}

/**
 * A section of the running mission loaded (gameplay's `sectionLoaded`): at tier 4 the working
 * set moves on (restore / build the new section's 4× ids; release the sections behind within
 * DENSE_BUDGET_BYTES). Nothing at tier 2.
 */
export function missionArtSection(section: string): void {
  if (dense) void enterDenseSection(dense, section);
}

/**
 * Start generating the dense sprites (docs/ARCHITECTURE.md §3) in the background when a mission
 * draws dense art (`density` ≥ 2, default the mission's `artDensity`): boot only makes the 1×
 * frames, so without this the first seconds of the mission would generate frames lazily while
 * drawing. The ART POOL (src/engine/art-pool.ts) builds them in workers, in `missionArtOrder`
 * (the players' characters, then what the first section shows; the boss last), and this thread
 * only installs them; without workers the pool falls back to today's budgeted main-thread
 * preload (MISSION_ART_BUDGET_MS per frame). The mission intro card starts it; gameplay calls it
 * again for a direct start (`?mission=`). Only the browser app asks for it (`app.preloadArt`):
 * headless runs (sims, tests, shots) generate dense frames lazily, if they draw at all.
 *
 * - Tier 2 (`artTier()` < 4): the whole 2× set, once; then the sprite cache saves pack 'hi'.
 * - Tier 4: the 2× set as above (the stand-in of every 4× frame not built yet), and the tier-4
 *   WORKING SET (`denseWorkingSet`) at 4× with `setDeferDense(true)`, so the main thread never
 *   generates 4× art; 4× ids drawn without frames are queued and pumped to the pool; a section
 *   change (`missionArtSection`) moves the set on and releases the sections behind within
 *   DENSE_BUDGET_BYTES. 4× packs ('hd4-<section>', 'hd4-char-<hero>') are restored and saved here.
 *
 * It also switches on `setDeferHiArt`: the 2× scenery (background layers, terrain chunks) of each
 * section becomes art jobs the section view runs within the same budget per frame (the pool's
 * main-thread fallback runs them first in its slices), so a section start never stalls.
 * Returns true when the preload runs (started now or before).
 */
export function preloadMissionArt(
  app: ArtApp,
  mission: MissionArtDef | undefined,
  density = mission?.artDensity ?? 1,
  session: Pick<GameSession, 'slots'> | null = app.session,
  section?: string,
): boolean {
  // The density checks: the mission's highest density, capped by the art tier (tier 1: nothing).
  const tier = Math.min(toArtDensity(density), artTier());
  if (tier < 2 || !app.preloadArt) return hiPreload !== null;
  // The 2× scenery of the sections becomes art jobs in the same budget (never a stalled frame).
  setDeferHiArt(true);
  const { first, last } = missionArtOrder(mission, session);
  // Ids the boot installed from pack 'hi' are not built again.
  hiPreload ??= missionPool()
    .build(preloadOrder(listHiSprites(2).filter((id) => !hasFramesAt(id, 2)), first, last), 2)
    .then(() => app.artCache?.save('hi', ['']));
  if (tier >= 4 && mission) startDense(app, mission, session, section);
  return true;
}

/** Tests: forget the preloads and the working set; `factory` makes the next pool (null: browser). */
export function resetMissionArt(factory: (() => ArtPool) | null = null, budget = DENSE_BUDGET_BYTES): void {
  if (dense?.timer) clearInterval(dense.timer);
  dense = null;
  hiPreload = null;
  pool?.close();
  pool = null;
  poolFactory = factory ?? (() => browserArtPool(undefined, { fallbackBudgetMs: MISSION_ART_BUDGET_MS }));
  denseBudget = budget;
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

/** The continue screen's view of a MissionRunner (docs/design/fps.md §1.10). */
function continuableRunner(runner: MissionRunner): Continuable {
  return {
    continuePlayer: (slot) => runner.continuePlayer(slot),
    resumeMusic: () => runner.resumeMusic(),
    clearOverlays: () => {
      runner.hud.clearBanner();
      runner.hud.hideGo();
    },
  };
}

export class GameplayScene implements Scene, PauseHost {
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
      preloadMissionArt(app, runner.mission, runner.artDensity, this.session, this.session.sectionId || undefined);
      // A direct start (?mission=, a continue, the next mission): the intro card did not run.
      preloadMissionAudio(app, runner.mission);
    }
    runner.events.on('complete', () => {
      if (this.demo) this.endDemo(false);
      // ams → the glitch bridge into the first-person mode (docs/design/fps.md §1.1): no tally page.
      else if (runner.mission.after === 'fps') app.scenes.replace(new GlitchBridgeScene(app, { from: this, runner }), { fade: 0 });
      else app.scenes.replace(new MissionCompleteScene(app, runner), { fade: 40 });
    });
    runner.events.on('gameOver', () => {
      if (this.demo) this.endDemo(false);
      else app.scenes.push(new ContinueScene(app, continuableRunner(runner)));
    });
    // TIME UP! is an announcer line too (GDD §12.3).
    runner.events.on('sectionLoaded', ({ id }) => {
      // Tier 4: the 4× working set moves on with the sections (preloadMissionArt).
      if (!this.demo) missionArtSection(id);
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

  /** OPTIONS changed a setting while paused (PauseHost): the camera shake. */
  applySettings(s: GameSettings): void {
    const cam = this.runner.world.camera;
    cam.shakeScale = s.screenShake === 'off' ? 0 : s.screenShake === 'low' ? 0.5 : 1;
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
