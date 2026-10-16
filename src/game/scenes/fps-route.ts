/**
 * Route helpers of the first-person mode (docs/design/fps.md §1.7). Group fps-shell wrote these
 * simple bodies (the next floor, else the title); group flow owns the file from group
 * `floors ‖ flow` on and writes the real route (tally, ending).
 */
import type { GameApp } from '../app';
import { fpsFloorByNumber } from '../fps/registry';
import { newFpsRun } from '../fps/run';
import type { FloorResult, FpsRun } from '../fps/types';
import { FpsIntroScene } from './fps-intro';
import { toTitle } from './flow';

/** A fresh fps run from `?mode=fps` or the bridge (the session must exist). */
export function startFpsRun(app: GameApp, o: { floor: number; fromBridge?: boolean }): void {
  const session = app.session;
  if (!session) {
    console.warn('[fps] startFpsRun without a session — back to the title');
    toTitle(app);
    return;
  }
  const run = newFpsRun(session, o.floor);
  app.scenes.reset(new FpsIntroScene(app, { floor: o.floor, run, fromBridge: o.fromBridge }), { fade: 30 });
}

/** The elevator was used / the boss died. Placeholder: straight to `fpsTallyDone` (no tally yet). */
export function fpsFloorDone(app: GameApp, run: FpsRun, result: FloorResult): void {
  if (run.results[run.results.length - 1] !== result) run.results.push(result);
  fpsTallyDone(app, run);
}

/** After a floor tally: the next floor's intro, or the title (floor 0 and the last floor). */
export function fpsTallyDone(app: GameApp, run: FpsRun): void {
  const next = run.floor + 1;
  if (run.floor === 0 || !fpsFloorByNumber(next)) {
    app.audio.music(null, { fadeTicks: 30 });
    toTitle(app);
    return;
  }
  run.floor = next;
  run.entered = false;
  app.scenes.replace(new FpsIntroScene(app, { floor: next, run }), { fade: 30 });
}
