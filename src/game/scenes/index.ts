/**
 * Scenes (docs/ARCHITECTURE.md §6, GDD §13.1): Boot → Title (attract loop) → ModeSelect →
 * CharacterSelect → MissionIntro → Gameplay (+ Pause / Continue overlays) → MissionComplete → the
 * next MissionIntro … → Ending → FinalTally → NameEntry → HighScores → Title. All are pure (no
 * DOM): main.ts pushes the BootScene. flow.ts holds the shared steps.
 */
export { BootScene } from './boot';
export { CharacterSelectScene } from './character-select';
export { ContinueScene } from './continue';
export { EndingScene } from './ending';
export { FinalTallyScene } from './final-tally';
export { FpsScene } from './fps';
export { FpsIntroScene, fpsLoadState, loadFpsContent, type FpsIntroOpts } from './fps-intro';
export { fpsFloorDone, fpsTallyDone, startFpsRun } from './fps-route';
export { finishGame, missionDone, recordMissionClear, silentTally, startCampaign, toTitle, type CampaignOpts } from './flow';
export { CALLOUTS, defineMissionCard, HINTS, missionCard, type MissionCard } from './flow-data';
export { GameOverScene } from './game-over';
export { GlitchBridgeScene, type BridgeOpts } from './glitch-bridge';
export { GameplayScene, firstMission, startNewGame, type GameplayOpts, type NewGameOpts } from './gameplay';
export { HighScoresScene } from './high-scores';
export { MissionCompleteScene } from './mission-complete';
export { MissionIntroScene } from './mission-intro';
export { ModeSelectScene } from './mode-select';
export { NameEntryScene } from './name-entry';
export { PauseScene } from './pause';
export { TitleScene } from './title';
