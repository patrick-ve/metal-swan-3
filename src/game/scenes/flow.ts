/**
 * The flow between the screens (GDD §13.1):
 *
 * `Boot` → `Title` (attract loop) → `ModeSelect` → `CharacterSelect` → `MissionIntro` →
 * `Gameplay` (⇄ `Pause`, `Continue`) → `MissionComplete` (tally) → next `MissionIntro` … →
 * after the last mission: `Ending` → `Credits` → `FinalTally` → `NameEntry` (if the score
 * qualifies) → `HighScores` → `Title`. Every player out of continues: `GameOver` → `NameEntry`
 * → `HighScores` → `Title`.
 *
 * Scenes call these helpers instead of building each other directly where a step is shared.
 */
import { newCampaign, type GameApp } from '../app';
import type { MissionRunner } from '../mission/runner';
import { hasMission } from '../registry';
import type { Difficulty, HighScoreEntry, PlayerSlot } from '../session';
import { EndingScene } from './ending';
import { firstMission, newSession } from './gameplay';
import { HighScoresScene } from './high-scores';
import { MissionIntroScene } from './mission-intro';
import { NameEntryScene } from './name-entry';
import { TitleScene } from './title';

export interface CampaignOpts {
  players: 1 | 2;
  /** One character id per player. */
  characters: readonly string[];
  difficulty?: Difficulty;
  /** First mission (default: m1, else the first registered one). */
  mission?: string;
}

/** A new game from the menus: session, campaign record, then the first intro card. */
export function startCampaign(app: GameApp, o: CampaignOpts): void {
  app.input.players = o.players;
  app.session = newSession(app, o.characters.slice(0, o.players), o.difficulty ?? app.settings.difficulty);
  app.campaign = newCampaign();
  app.scenes.reset(new MissionIntroScene(app, o.mission ?? firstMission()), { fade: 40 });
}

/** After a mission's tally: the next mission's intro card, or the ending after the last one. */
export function missionDone(app: GameApp, runner: MissionRunner): void {
  const next = runner.nextMission();
  if (next && hasMission(next)) app.scenes.replace(new MissionIntroScene(app, next), { fade: 40 });
  else app.scenes.reset(new EndingScene(app), { fade: 60 });
}

/** The high-score row a slot would get. `finished` = the whole campaign was played through. */
export function entryFor(app: GameApp, slot: PlayerSlot, finished: boolean, name = '???'): HighScoreEntry {
  const s = app.session;
  return {
    name,
    score: slot.score,
    mission: finished ? 'all' : (s?.missionId ?? ''),
    character: slot.character,
    continues: slot.continues,
    difficulty: s?.difficulty,
  };
}

/**
 * The game is over (all players out, or the final tally is done): name entry for every joined
 * player whose score makes the table, then the high scores, then the title.
 */
export function finishGame(app: GameApp, finished: boolean): void {
  const slots = app.session?.slots.filter((s) => s.joined && app.highScores.qualifies(s.score)) ?? [];
  if (slots.length > 0) app.scenes.reset(new NameEntryScene(app, slots, finished), { fade: 30 });
  else app.scenes.reset(new HighScoresScene(app, { mode: 'after-game' }), { fade: 30 });
}

/** Back to the title: the game in progress is gone. */
export function toTitle(app: GameApp, fade = 30): void {
  app.session = null;
  app.campaign = null;
  app.input.players = 1;
  app.scenes.reset(new TitleScene(app), { fade });
}
