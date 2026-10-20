/**
 * The flow between the screens (GDD §13.1):
 *
 * `Boot` → `Title` (attract loop) → `ModeSelect` → `CharacterSelect` → `MissionIntro` →
 * `Gameplay` (⇄ `Pause`, `Continue`) → `MissionComplete` (tally) → next `MissionIntro` … →
 * after the last mission: `Ending` → `Credits` → `FinalTally` → `NameEntry` (if the score
 * qualifies) → `HighScores` → `Title`. Every player out of continues: `GameOver` → `NameEntry`
 * → `HighScores` → `Title`.
 *
 * The normal route (docs/design/ring.md §1): `ams` (MISSION 1) → its tally → the ring's intro
 * card (MISSION 2, `RingScene`, ring-route.ts) → the glitch bridge (the ring's silent tally) →
 * the first-person floors → the ending. `ring` is not a registered mission: `missionDone` sends
 * its id to the intro card, which starts the RingScene.
 *
 * Scenes call these helpers instead of building each other directly where a step is shared.
 */
import { newCampaign, type GameApp } from '../app';
import { hasMission } from '../registry';
import { RING_ID } from '../ring/ids';
import type { Difficulty, HighScoreEntry, PlayerSlot } from '../session';
import { EndingScene } from './ending';
import { firstMission, newSession } from './gameplay';
import { HighScoresScene } from './high-scores';
import { tallyLines, type NextRunner, type TallyRunner } from './mission-complete';
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

/**
 * After a mission's tally: the next mission's intro card (the ring's too: it is not a registered
 * mission, its card starts the RingScene), or the ending after the last one.
 */
export function missionDone(app: GameApp, runner: NextRunner): void {
  const next = runner.nextMission();
  if (next && (hasMission(next) || next === RING_ID)) app.scenes.replace(new MissionIntroScene(app, next), { fade: 40 });
  else app.scenes.reset(new EndingScene(app), { fade: 60 });
}

/**
 * Campaign record of a finished mission (finished missions, golden records; final tally, GDD
 * §14.6). Both routes call it: the newspaper tally (MissionCompleteScene) and the glitch bridge
 * (docs/design/fps.md §1.2). Idempotent for the mission list; `session.completed` is the runner's.
 */
export function recordMissionClear(app: GameApp, runner: TallyRunner): void {
  const camp = app.campaign;
  if (!camp) return;
  const id = runner.mission.id;
  if (!camp.missions.includes(id)) camp.missions.push(id);
  for (const slot of runner.session.slots) if (slot.joined && slot.mission.goldenRecord) camp.goldenRecords[slot.index].add(id);
}

/**
 * The mission tally without its page (docs/design/fps.md §1.2): computes each joined slot's TOTAL
 * (tallyLines × tallyScore), pays it with slot.addScore (extends apply, no sound), zeroes
 * slot.rescued and returns the totals [p1, p2] (0 for a slot that is not joined).
 */
export function silentTally(_app: GameApp, runner: TallyRunner): [number, number] {
  const session = runner.session;
  const mul = session.mods.tallyScore;
  const totals: [number, number] = [0, 0];
  for (const slot of session.slots) {
    if (!slot.joined) continue;
    totals[slot.index] = Math.round(tallyLines(runner, session, slot).raw * mul);
  }
  for (const slot of session.slots) {
    if (!slot.joined) continue;
    slot.addScore(totals[slot.index]);
    slot.rescued = 0;
  }
  return totals;
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
