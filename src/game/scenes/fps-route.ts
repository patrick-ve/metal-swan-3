/**
 * Route helpers of the first-person mode (docs/design/fps.md §1.1, §1.7), owned by group flow:
 *
 * bridge / `?mode=fps` → `startFpsRun` → FpsIntroScene(floor 1) → FpsScene → `fpsFloorDone` →
 * FpsTallyScene → `fpsTallyDone` → FpsIntroScene(floor 2) → … → after the last floor the story
 * card (StoryCardScene, docs/design/oldenzaal.md §1) → MissionIntroScene('oldenzaal') (MISSION 4)
 * → the mission → its tally → the TO BE CONTINUED card → EndingScene({ variant: 'fps' }) →
 * FinalTallyScene → finishGame. Without the oldenzaal mission registered (a broken module) the
 * last floor goes straight to the fps ending, as before. The test floor 0 goes back to the title
 * after its tally.
 */
import type { GameApp } from '../app';
import { fpsFloorByNumber } from '../fps/registry';
import { newFpsRun } from '../fps/run';
import type { FloorResult, FpsRun } from '../fps/types';
import { hasMission } from '../registry';
import { OLDENZAAL_ID } from '../content/missions/oldenzaal/ids';
import { EndingScene } from './ending';
import { FpsIntroScene } from './fps-intro';
import { FpsTallyScene } from './fps-tally';
import { toTitle } from './flow';
import { StoryCardScene } from './story-card';

/** A fresh fps run from `?mode=fps` or the bridge (the session must exist; slot = the fps slot). */
export function startFpsRun(app: GameApp, o: { floor: number; fromBridge?: boolean }): void {
  const session = app.session;
  if (!session) {
    console.warn('[fps] startFpsRun without a session — back to the title');
    toTitle(app);
    return;
  }
  const run = newFpsRun(session, o.floor);
  // From the bridge the screen is already black (the fold): no fade.
  app.scenes.reset(new FpsIntroScene(app, { floor: o.floor, run, fromBridge: o.fromBridge }), { fade: o.fromBridge ? 0 : 30 });
}

/** The elevator was used / the boss death-cam ended: the floor's tally page. */
export function fpsFloorDone(app: GameApp, run: FpsRun, result: FloorResult): void {
  if (run.results[run.results.length - 1] !== result) run.results.push(result);
  app.scenes.replace(new FpsTallyScene(app, run, result), { fade: 30 });
}

/**
 * After a floor tally: the next floor's intro; after the last floor the story card into mission
 * `oldenzaal` (the fps ending when it is not registered); or the title (floor 0).
 */
export function fpsTallyDone(app: GameApp, run: FpsRun): void {
  if (run.floor === 0) {
    app.audio.music(null, { fadeTicks: 30 });
    toTitle(app);
    return;
  }
  const next = run.floor + 1;
  if (!fpsFloorByNumber(next)) {
    if (hasMission(OLDENZAAL_ID)) app.scenes.reset(new StoryCardScene(app), { fade: 60 });
    else app.scenes.reset(new EndingScene(app, { variant: 'fps' }), { fade: 60 });
    return;
  }
  run.floor = next;
  run.entered = false;
  app.scenes.replace(new FpsIntroScene(app, { floor: next, run }), { fade: 30 });
}
