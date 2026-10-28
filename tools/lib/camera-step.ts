/**
 * Frames by the camera (docs/design/floor.md §12.3: the c2 tooling): step a headless game until the
 * view's left edge reaches a world x — where `--x` cannot place the camera (`ams` c2: the cruise boat
 * carries it and the players ride the boat). Deterministic, like stepping by ticks. Used by
 * `npm run shot -- --cam-x` and `npm run floor-clip -- --cam-x`.
 */
import type { HeadlessGame } from '../../src/sim/index';

/** Step `game` until its view's left edge is at world x ≥ `x` (at most `max` ticks). True when it got there. */
export function stepToCamera(game: HeadlessGame, x: number, max = 20000): boolean {
  for (let i = 0; i < max; i++) {
    const cam = game.runner?.world.camera;
    if (cam && cam.left >= x) return true;
    game.step(1);
  }
  return (game.runner?.world.camera.left ?? -Infinity) >= x;
}
