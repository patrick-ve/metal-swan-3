/**
 * The rally's place in the flow (docs/design/rally.md §1, §12.3; docs/api/rally.md "Flow"):
 *
 * `ams` → its tally (MissionCompleteScene) → `missionDone` → MissionIntroScene('rally') (the MISSION 2
 * card BINNEN DE RING: `prepareRally` makes the seed, `preloadRally` loads the lazy rally content and
 * creates the GL context — its feature check) → `RallyGlitchScene` (the glitch into 3D) →
 * `RallyScene` (the race) → 'complete' → `rallyDone` → the rally's MISSION COMPLETE page
 * (`rallyTally`: the race lines through `TallyRunner.tallyLines`, the seed in the footer) →
 * GlitchBridgeScene (it freezes the page) → the fps floors → oldenzaal.
 *
 * The no-WebGL2 path (spec §0 item 23): no GL (or `?gl=0`) → after the card `RallyNoGlScene` (THIS
 * DEVICE CANNOT SHOW 3D) → the tally with no race lines (`rallyNoGlTally`) → the bridge. The run
 * never dead-ends.
 *
 * `?mission=rally` (boot, tools) → `startRally` (a new session and campaign, no card; the glitch
 * scene loads the content). `rally` is NOT a registered mission: the flow knows its id (`RALLY_ID`).
 * The 2D `ring` is dormant since 2026-10-22 (ring-route.ts; `?mission=ring`).
 *
 * Seeds: every play gets a fresh seed (`freshSeed`, the ring's); `?seed=` / a tool's `--seed` wins.
 * The race's seed goes to the session (`LEVEL2_SEED_KEY`): floor 1's tally shows `RING SEED n`.
 * The tally's newspaper headline follows the best player's place (`rallyHeadline`, spec §1.1).
 */
import { newCampaign, type GameApp } from '../app';
import { HudState } from '../context';
import { isRallyContent, loadContent } from '../content/index';
import type { RallyOpts } from '../rally/api';
import { LEVEL2_SEED_KEY, RALLY_ID, type Level2Seed } from '../rally/ids';
import { hasRallyTrack } from '../rally/registry';
import type { RallyRunner } from '../rally/runner';
import { freshSeed } from '../ring/mission';
import type { Difficulty, GameSession } from '../session';
import type { Scene } from '../../engine/scene';
import { newSession } from './gameplay';
import { GlitchBridgeScene, type BridgeRunner } from './glitch-bridge';
import { MissionCompleteScene, type NextRunner } from './mission-complete';
import { joinCharacter } from './play-host';
import { RallyGlitchScene } from './rally-glitch';
import { RallyScene } from './rally';

export { RALLY_ID };

/** Is `id` the rally (the flow's dispatch)? */
export function isRally(id: string | null | undefined): boolean {
  return id === RALLY_ID;
}

/**
 * A new race: the seed (`o.seed`, else `?seed=`, else a fresh one), the session's difficulty, the
 * players, and the test params `?lap=` / `?cam=`. Pure apart from the fresh seed.
 */
export function prepareRally(
  app: Pick<GameApp, 'params' | 'session' | 'settings' | 'input'>,
  o: { seed?: number | null } = {},
): RallyOpts {
  const p = app.params;
  const seed = o.seed !== undefined && o.seed !== null ? o.seed >>> 0 : p.seed !== null ? p.seed >>> 0 : freshSeed();
  const difficulty: Difficulty = app.session?.difficulty ?? p.difficulty ?? app.settings.difficulty;
  const joined = app.session ? app.session.slots.filter((s) => s.joined).length : app.input.players;
  const out: RallyOpts = { seed, difficulty, players: joined > 1 ? 2 : 1 };
  if (p.lap !== undefined) out.lap = p.lap;
  if (p.cam !== undefined) out.cam = p.cam;
  return out;
}

// ---------------------------------------------------------------------------------------------
// The lazy content and the GL check
// ---------------------------------------------------------------------------------------------

const LOAD = { started: false, registered: false, failed: false };
let loading: Promise<void> | null = null;

/** The rally content's load state (read every tick by the glitch scene; no allocation). */
export function rallyLoadState(): { readonly started: boolean; readonly registered: boolean; readonly failed: boolean } {
  return LOAD;
}

/** Load the lazy rally content once (the track and the car models register). Never rejects. */
export function loadRallyContent(): Promise<void> {
  if (!loading) {
    LOAD.started = true;
    loading = loadContent(isRallyContent).then(
      (report) => {
        for (const f of report.failed) console.error(`[rally] content "${f.id}" failed`);
        LOAD.registered = hasRallyTrack();
        LOAD.failed = !LOAD.registered;
      },
      (err: unknown) => {
        console.error('[rally] loading the content failed:', err);
        LOAD.failed = true;
      },
    );
  }
  return loading;
}

/**
 * Can this device show the race? `?gl=0` (a test param) says no; else the 3D view's own check
 * (reading `ok` creates the WebGL2 context and compiles the program the first time).
 */
export function rallyGl(app: Pick<GameApp, 'params' | 'view3d'>): { ok: boolean; reason: string } {
  if (app.params.gl === false) return { ok: false, reason: 'gl=0' };
  const v = app.view3d;
  return { ok: v.ok, reason: v.reason };
}

/** The card's preload: the lazy content, the GL context (its feature check); wave C: the samples. */
export function preloadRally(app: GameApp, _start: RallyOpts): void {
  void loadRallyContent();
  rallyGl(app);
}

// ---------------------------------------------------------------------------------------------
// Starts and ends
// ---------------------------------------------------------------------------------------------

export interface StartRallyOpts {
  players?: 1 | 2;
  /** Characters per player (default: ?char= or 'recruit'). */
  characters?: readonly string[];
  difficulty?: Difficulty;
  /** The race's seed (default `?seed=`, else a fresh one). */
  seed?: number;
}

/**
 * `?mission=rally` (boot, tools, tests): a fresh session and campaign, no card; the glitch scene
 * loads the content, checks the GL and starts the race (or takes the no-WebGL2 path).
 */
export function startRally(app: GameApp, o: StartRallyOpts = {}): RallyGlitchScene {
  const players = o.players ?? app.params.players;
  const char = app.params.char ?? 'recruit';
  const characters = o.characters ?? (players === 2 ? [char, joinCharacter(char)] : [char]);
  app.input.players = players;
  app.session = newSession(app, characters, o.difficulty);
  app.campaign = newCampaign();
  const start = prepareRally(app, { seed: o.seed });
  const scene = new RallyGlitchScene(app, { start });
  app.scenes.reset(scene, { fade: 30 });
  return scene;
}

/** What the rally's tally reads from the finished race (a RallyRunner). */
export type RallyTallyRunner = Pick<RallyRunner, 'session' | 'mission' | 'seed' | 'artDensity' | 'hud' | 'raceLines' | 'raceStars'> & Partial<Pick<RallyRunner, 'carOf'>>;

/** The newspaper's headlines by the best player's place (spec §1.1). */
export const RALLY_HEADLINES = {
  win: 'SQUAD WINS DE RINGRALLY! PERMIT SECURED!',
  podium: 'PODIUM! BUT NO PERMIT. BACK ON THE LIST.',
  rest: 'NO PERMIT. 12 MORE YEARS ON THE LIST.',
  /** The no-WebGL2 path: no race, and no judgement of the player (a device limit, not a failure). */
  off: 'RALLY CALLED OFF. THE SQUAD DRIVES ON.',
} as const;

/** The headline of a race by the best place of the joined players (0 = none placed: the 1st-place one). */
export function rallyHeadline(bestPlace: number): string {
  if (bestPlace <= 1) return RALLY_HEADLINES.win;
  return bestPlace <= 3 ? RALLY_HEADLINES.podium : RALLY_HEADLINES.rest;
}

/** The best place of the joined players' cars (0 when none raced). */
function bestPlace(runner: RallyTallyRunner): number {
  let best = 0;
  for (const s of runner.session.slots) {
    if (!s.joined) continue;
    const p = runner.carOf?.(s.index)?.place ?? 0;
    if (p > 0 && (best === 0 || p < best)) best = p;
  }
  return best;
}

/**
 * The rally's MISSION COMPLETE page (spec §9): the race lines instead of the bonus lines
 * (`tallyLines`: PLACE, TIME; wave B adds the rest), the stars by place, the seed in the footer,
 * then the glitch bridge (`tallied`: the page paid, the bridge does not).
 */
export function rallyTally(runner: RallyTallyRunner): NextRunner {
  const bridge: BridgeRunner = { session: runner.session, mission: runner.mission, artDensity: runner.artDensity, hud: runner.hud, seed: runner.seed };
  return {
    session: runner.session,
    mission: runner.mission,
    nextMission: () => null,
    tallyLines: (slot) => runner.raceLines(slot.index),
    tallyStars: (slot) => runner.raceStars(slot.index),
    tallyFooter: `RALLY SEED ${runner.seed}`,
    tallyHeadline: rallyHeadline(bestPlace(runner)),
    afterTally: (app, page) => app.scenes.replace(new GlitchBridgeScene(app, { from: page, runner: bridge, tallied: true }), { fade: 0 }),
  };
}

/** Remember the seed of the level 2 this run passed (floor 1's `RING SEED n`). */
export function recordLevel2Seed(session: GameSession, seed: number): void {
  const rec: Level2Seed = { mission: RALLY_ID, seed: seed >>> 0 };
  session.records.set(LEVEL2_SEED_KEY, rec);
}

/** The race is over (its 'complete' after the results): the rally's MISSION COMPLETE page, then the bridge. */
export function rallyDone(app: GameApp, _from: Scene, runner: RallyTallyRunner): void {
  recordLevel2Seed(runner.session, runner.seed);
  app.scenes.replace(new MissionCompleteScene(app, rallyTally(runner)), { fade: 30 });
}

/**
 * The no-WebGL2 path's tally (spec §0 item 23): the page with no race lines (DIFFICULTY and a TOTAL
 * of 0), the default stars and a neutral headline (a device limit is no failure of the player:
 * mechanics.md §23), then the bridge. The clear is recorded; the run goes on.
 */
export function rallyNoGlTally(session: GameSession, seed: number): NextRunner {
  const mission = { id: RALLY_ID, hostages: {} as Readonly<Record<string, number>> };
  const bridge: BridgeRunner = { session, mission, artDensity: 2, hud: new HudState(), seed };
  return {
    session,
    mission,
    nextMission: () => null,
    tallyLines: () => [],
    tallyFooter: 'NO 3D ON THIS DEVICE',
    tallyHeadline: RALLY_HEADLINES.off,
    afterTally: (app, page) => app.scenes.replace(new GlitchBridgeScene(app, { from: page, runner: bridge, tallied: true }), { fade: 0 }),
  };
}

// ---------------------------------------------------------------------------------------------
// The debug probe (main.ts exposes it as `window.__ms3.rally`; tools/smoke.ts and shot3d read it)
// ---------------------------------------------------------------------------------------------

export interface RallyProbe {
  gl: { ok: boolean; reason: string };
  /** The scene on top (constructor name) — 'none' when no scene. */
  scene: string;
  /** The last race: ticks since its start, since GO (−1 = countdown), the phase. */
  tick: number;
  raceTick: number;
  phase: string;
  /** Player 1's car (else player 2's): lap, place, finished. */
  lap: number;
  place: number;
  finished: boolean;
  /** Player cars and all cars in the race. */
  players: number;
  cars: number;
  /** The 3D view's last frame. */
  tris: number;
  draws: number;
  density: number;
}

/** The probe of the last RallyScene (pure: main.ts wraps it in a getter on `window.__ms3`). */
export function rallyProbe(app: GameApp): RallyProbe {
  const gl = rallyGl(app);
  const runner = RallyScene.last;
  const car = runner ? (runner.carOf(0) ?? runner.carOf(1)) : null;
  const st = app.view3d.stats();
  return {
    gl,
    scene: app.scenes.top ? app.scenes.top.constructor.name : 'none',
    tick: runner?.tick ?? -1,
    raceTick: runner?.race.raceTick ?? -1,
    phase: runner?.phase ?? 'none',
    lap: car?.lap ?? 0,
    place: car?.place ?? 0,
    finished: car?.finished ?? false,
    players: runner ? runner.cars.filter((c) => c.slot >= 0).length : 0,
    cars: runner?.cars.length ?? 0,
    tris: st.tris,
    draws: st.draws,
    density: app.view3d.density,
  };
}
