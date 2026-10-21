/**
 * Mission oldenzaal in the flow (docs/design/oldenzaal.md §1; docs/api/oldenzaal.md "Flow"):
 * the last first-person floor's tally → the story card → the MISSION 4 intro card → the mission
 * → its MISSION COMPLETE tally → the TO BE CONTINUED card → today's ending (fps variant) → the
 * final tally. P2 rejoins the 2D runner after the one-slot fps mode; a P1 who went out in the fps
 * mode stays out (P2 plays alone). The m5 trap: m5 still ends the campaign. `?mission=oldenzaal`.
 */
import { describe, expect, it } from 'vitest';
import { InputManager, keySetFor, maskFromKeys, type InputContext, type InputSource, type PlayerSlot } from '../../src/engine/input';
import { SoftRenderer } from '../../src/engine/render-soft';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, newCampaign, type GameApp } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import { OLDENZAAL_ID } from '../../src/game/content/missions/oldenzaal/ids';
import { STORY_CARD_LINES } from '../../src/game/content/missions/oldenzaal/lines';
import { newFpsRun } from '../../src/game/fps/run';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { bootArt } from '../../src/game/scenes/boot';
import { EndingScene } from '../../src/game/scenes/ending';
import { FinalTallyScene } from '../../src/game/scenes/final-tally';
import { entryFor, missionDone } from '../../src/game/scenes/flow';
import { fpsTallyDone } from '../../src/game/scenes/fps-route';
import { GameplayScene, startNewGame } from '../../src/game/scenes/gameplay';
import { missionColumn } from '../../src/game/scenes/high-scores';
import { MissionCompleteScene } from '../../src/game/scenes/mission-complete';
import { MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { STORY_PRESS_FROM, StoryCardScene } from '../../src/game/scenes/story-card';
import { TBC_SKIP_AFTER, TBC_TICKS, ToBeContinuedScene } from '../../src/game/scenes/to-be-continued';
import { GameSession } from '../../src/game/session';
import { SimAudio } from '../../src/sim/stats';

await loadContent();

/** A keyboard stand-in: held codes drive the bound pads, taps feed the raw codes for one tick. */
class Keys implements InputSource {
  readonly held = new Set<string>();
  private readonly queue: string[] = [];
  private readonly latched = new Set<string>();
  private readonly isDown = (c: string): boolean => this.held.has(c) || this.latched.has(c);
  tap(code: string): void {
    this.latched.add(code);
    this.queue.push(code);
  }
  read(slot: PlayerSlot, ctx: InputContext): number {
    const set = keySetFor(slot, ctx.players);
    return set ? maskFromKeys(ctx.bindings[set], this.isDown) : 0;
  }
  drainPressed(out: string[]): void {
    out.push(...this.queue);
    this.queue.length = 0;
  }
  endTick(): void {
    this.latched.clear();
  }
}

interface H {
  app: GameApp;
  keys: Keys;
  step(n?: number): void;
  until(cls: abstract new (...a: never[]) => unknown, max: number): boolean;
  seen: string[];
}

function harness(players: 1 | 2 = 1): H {
  const input = new InputManager();
  input.players = players;
  const keys = new Keys();
  input.addSource(keys);
  const app = createApp({ input, audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS, players } });
  const r = new SoftRenderer();
  const seen: string[] = [];
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
      const name = app.scenes.top?.constructor.name ?? 'none';
      if (seen[seen.length - 1] !== name) seen.push(name);
    }
    r.begin();
    app.scenes.draw(r);
    r.end();
  };
  const until = (cls: abstract new (...a: never[]) => unknown, max: number): boolean => {
    for (let i = 0; i < max; i++) {
      if (app.scenes.top instanceof cls) return true;
      step(1);
    }
    return app.scenes.top instanceof cls;
  };
  return { app, keys, step, until, seen };
}

/** A session at the end of the fps mode: floor 2's tally is done (slot 0 played it). */
function afterFps(h: H, players: 1 | 2): GameSession {
  const s = new GameSession({ characters: players === 2 ? ['vincent', 'thom'] : ['vincent'], seed: 7 });
  h.app.session = s;
  h.app.campaign = newCampaign();
  h.app.campaign.missions.push('ams', 'ring', 'fps-1', 'fps-2');
  s.startMission('fps-2');
  return s;
}

/** The last floor's tally is done: the story card; two presses lead on to the MISSION 4 card. */
function toIntro(h: H): MissionIntroScene {
  const run = newFpsRun(h.app.session!, 2);
  fpsTallyDone(h.app, run);
  expect(h.until(StoryCardScene, 90)).toBe(true);
  const card = h.app.scenes.top as StoryCardScene;
  expect(card.lines).toEqual(STORY_CARD_LINES);
  h.step(STORY_PRESS_FROM + 1);
  expect(card.typed).toBe(false);
  // The first press finishes the typing; the second moves on.
  h.keys.tap('Enter');
  h.step(2);
  expect(card.typed).toBe(true);
  expect(h.app.scenes.top).toBe(card);
  h.keys.tap('Enter');
  h.step(2);
  expect(h.until(MissionIntroScene, 60)).toBe(true);
  const intro = h.app.scenes.top as MissionIntroScene;
  expect(intro.mission).toBe(OLDENZAAL_ID);
  expect(intro.card.label).toBe('MISSION 4');
  expect(intro.card.name).toBe('A HAUNTING IN OTOWN');
  return intro;
}

/** F4 until the mission completes; then the newspaper. */
function completeMission(h: H, game: GameplayScene): void {
  let ok = false;
  for (let i = 0; i < 4000 && !ok; i++) {
    if (i % 120 === 0 && game.runner.state === 'playing') game.runner.skip();
    h.step(1);
    ok = h.app.scenes.top instanceof MissionCompleteScene;
  }
  expect(ok).toBe(true);
}

describe('the route into oldenzaal and out of it', () => {
  it('fps-2 tally → story card → MISSION 4 → oldenzaal → tally → TO BE CONTINUED → fps ending → final tally', () => {
    const h = harness();
    afterFps(h, 1);
    toIntro(h);
    expect(h.until(GameplayScene, 400)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(5);
    expect(game.runner.mission.id).toBe(OLDENZAAL_ID);
    expect(game.runner.section.id).toBe('oz-a');
    expect(h.app.session!.missionId).toBe(OLDENZAAL_ID);
    expect(game.runner.players.length).toBe(1);
    // A game over here would show M4 in the hall of fame.
    expect(missionColumn(entryFor(h.app, h.app.session!.slots[0], false))).toBe('M4');
    completeMission(h, game);
    expect((h.app.scenes.top as MissionCompleteScene).runner.mission.id).toBe(OLDENZAAL_ID);
    expect(h.until(ToBeContinuedScene, 1200)).toBe(true);
    expect(h.app.campaign!.missions).toContain(OLDENZAAL_ID);
    const tbc = h.app.scenes.top as ToBeContinuedScene;
    // Unattended it moves on after TBC_TICKS.
    h.step(TBC_TICKS - 2);
    expect(h.app.scenes.top).toBe(tbc);
    expect(h.until(EndingScene, 90)).toBe(true);
    const end = h.app.scenes.top as EndingScene;
    expect(end.variant).toBe('fps');
    let ok = false;
    for (let i = 0; i < 200 && !ok; i++) {
      h.step(60);
      ok = h.app.scenes.top instanceof FinalTallyScene;
    }
    expect(ok).toBe(true);
    expect(h.seen).toEqual(expect.arrayContaining(['StoryCardScene', 'MissionIntroScene', 'GameplayScene', 'MissionCompleteScene', 'ToBeContinuedScene', 'EndingScene', 'FinalTallyScene']));
  }, 120000);

  it('the TO BE CONTINUED card is skippable after TBC_SKIP_AFTER ticks', () => {
    const h = harness();
    afterFps(h, 1);
    const tbc = new ToBeContinuedScene(h.app);
    h.app.scenes.reset(tbc);
    h.step(5);
    h.keys.tap('Enter');
    h.step(2);
    expect(h.app.scenes.top).toBe(tbc);
    h.step(TBC_SKIP_AFTER);
    h.keys.tap('Enter');
    h.step(2);
    expect(h.until(EndingScene, 90)).toBe(true);
  });

  it('2P: P2 rejoins the 2D runner after the one-slot fps mode', () => {
    const h = harness(2);
    const s = afterFps(h, 2);
    toIntro(h);
    expect(h.until(GameplayScene, 400)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(5);
    expect(h.app.input.fpsMode).toBe(false);
    expect(game.runner.players.map((p) => p.index)).toEqual([0, 1]);
    expect(game.runner.players.every((p) => p.alive)).toBe(true);
    expect(s.slots[1].active).toBe(true);
  }, 60000);

  it('2P with P1 out of the fps mode: P2 plays oldenzaal alone; P1 stays out until he continues', () => {
    const h = harness(2);
    const s = afterFps(h, 2);
    s.slots[0].gameOver = true;
    s.slots[0].lives = 0;
    toIntro(h);
    expect(h.until(GameplayScene, 400)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(5);
    expect(game.runner.players.map((p) => p.index)).toEqual([1]);
    expect(s.slots[0].gameOver).toBe(true);
  }, 60000);
});

describe('the m5 trap and the direct start', () => {
  it('m5 still ends the campaign (its runner names oldenzaal, the flow does not go there)', () => {
    const h = harness();
    startNewGame(h.app, { mission: 'm5', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    expect(game.runner.nextMission()).toBe(OLDENZAAL_ID);
    missionDone(h.app, game.runner);
    expect(h.until(EndingScene, 90)).toBe(true);
    expect((h.app.scenes.top as EndingScene).variant).toBe('campaign');
  });

  it('?mission=oldenzaal&section=oz-c starts there; the boot preloads the mission\'s 1× art', () => {
    const h = harness();
    startNewGame(h.app, { mission: OLDENZAAL_ID, section: 'oz-c', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(3);
    expect(game.runner.section.id).toBe('oz-c');
    const art = bootArt({ mission: OLDENZAAL_ID, char: null, mode: undefined }) ?? [];
    for (const p of ['decor/oz/', 'npc/oz-wu/', 'fx/oz/light/']) expect(art).toContain(p);
    // Revision 2 (R2-6): the wave-A possessed are gone.
    expect(art).not.toContain('enemy/oz-shambler/');
    // Revision 2: the dead soldiers and the wave-B owners' prefixes are in the boot art too.
    for (const p of ['enemy/oz-grunt/', 'enemy/oz-mg/', 'boss/oz-plechelmus/', 'decor/oz-nave/', 'decor/oz-tower/', 'decor/oz-ruin/']) expect(art).toContain(p);
  });

  it('?mission=oldenzaal&section=oz-f (revision 2: the tower) starts at the foot of the climb', () => {
    const h = harness();
    startNewGame(h.app, { mission: OLDENZAAL_ID, section: 'oz-f', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(3);
    expect(game.runner.section.id).toBe('oz-f');
    expect(game.runner.section.scroll).toBe('up');
    expect(game.runner.players[0].y).toBeGreaterThan(game.runner.section.height - 64);
  });
});

describe('the oldenzaal tally (no hostages)', () => {
  it('shows no HOSTAGES / STANDING OVATION lines and still gives the hostage star', async () => {
    const { GameSession } = await import('../../src/game/session');
    const { tallyLines } = await import('../../src/game/scenes/mission-complete');
    const session = new GameSession({ difficulty: 'normal', seed: 1 });
    const slot = session.slots[0];
    slot.joined = true;
    slot.mission.route = ['oz-a', 'oz-b'];
    const oz = tallyLines({ session, mission: { id: OLDENZAAL_ID, hostages: {} } }, session, slot);
    const labels = oz.lines.map((l) => l.label);
    expect(labels.some((l) => l.startsWith('HOSTAGES'))).toBe(false);
    expect(labels).not.toContain('STANDING OVATION');
    // With hostages on the route and none rescued, that star is missing.
    const ams = tallyLines({ session, mission: { id: 'ams', hostages: { 'oz-a': 3 } } }, session, slot);
    expect(ams.lines[0].label.startsWith('HOSTAGES')).toBe(true);
    expect(oz.stars).toBe(ams.stars + 1);
  });
});
