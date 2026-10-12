/**
 * Headless harness + bot autopilot (docs/ARCHITECTURE.md §4, §9): public entry for the node
 * tools (`tools/shot.ts`, `tools/sim.ts`) and the tests.
 */
export { createHeadlessGame, type HeadlessGame, type HeadlessOptions } from './headless';
export { Bot, type BotHost, type BotOptions, type BotRoute } from './bot';
export {
  captureConsole,
  comparableReport,
  releaseConsole,
  SimAudio,
  SimStats,
  type ConsoleCapture,
  type SimError,
  type SimReport,
  type SimTiming,
} from './stats';
