import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { InputManager, ScriptedSource, timeline, type Button, type InputTimeline } from '../../src/engine/input';
import { SoftRenderer } from '../../src/engine/render-soft';
import { MemoryStore } from '../../src/engine/storage';
import { terrain } from '../../src/engine/terrain';
import { createApp, GameAudio, graphicsMode, loadHighScores, newCampaign, type GameApp } from '../../src/game/app';
import type { MissionDef } from '../../src/game/mission/index';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { defineMission, getMission } from '../../src/game/registry';
import { BootScene, GameplayScene, MissionCompleteScene, PauseScene, TitleScene, startNewGame } from '../../src/game/scenes/index';
import { CharacterSelectScene } from '../../src/game/scenes/character-select';
import { EndingScene, LAST_NOTE_TICKS } from '../../src/game/scenes/ending';
import { FinalTallyScene } from '../../src/game/scenes/final-tally';
import { GameOverScene } from '../../src/game/scenes/game-over';
import { HighScoresScene, missionColumn } from '../../src/game/scenes/high-scores';
import { CAMPAIGN_MISSIONS, missionLabel } from '../../src/game/scenes/flow-data';
import { MissionIntroScene, INTRO_TICKS } from '../../src/game/scenes/mission-intro';
import { MISSION_ART_BUDGET_MS, missionArtOrder, missionArtPreloadStarted, newSession, preloadMissionArt } from '../../src/game/scenes/gameplay';
import { ModeSelectScene } from '../../src/game/scenes/mode-select';
import { NameEntryScene } from '../../src/game/scenes/name-entry';
import { graphicsHint, OPTION_ROWS, OPTION_STEP, OPTION_TOP, OptionsScene, optionValue, stepOption } from '../../src/game/scenes/options';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_VERSION } from '../../src/game/settings';
import { FLOOR } from './helpers';

const t = terrain(1200, 216);
t.ground().at(0, FLOOR).flat(1200);
const MISSION: MissionDef = {
  id: 'm1',
  name: 'SCENE TEST',
  music: 'm1',
  start: 'a',
  sections: {
    a: {
      id: 'a',
      width: 1200,
      height: 216,
      scroll: 'right',
      background: { sky: 0x102030ff, layers: [] },
      terrain: t.build(),
      terrainStyle: { ground: 'dirt' },
      playerStart: { x: 40, y: FLOOR },
      script: function* scenes(ctx) {
        yield 60;
        // Only with a hero on the ground: the game-over test's countdown holds this script.
        yield () => ctx.players.some((p) => p.state === 'play');
        yield ctx.missionComplete();
      },
    },
  },
};
defineMission(MISSION);

type SceneClass = abstract new (...args: never[]) => unknown;

interface Harness {
  app: GameApp;
  r: SoftRenderer;
  step: (n: number) => void;
  /** Press a button for one tick (slot 0 by default), then release it for one tick. */
  tap: (b: Button, slot?: 0 | 1) => void;
  /** Step until the top scene is an instance of `cls` (at most `max` ticks); true when it got there. */
  until: (cls: SceneClass, max: number) => boolean;
  log: () => string[];
}

function app(tl: InputTimeline = timeline().idle(1), store = new MemoryStore()): Harness {
  const input = new InputManager();
  input.addSource(new ScriptedSource(tl, 0));
  const held: Button[][] = [[], []];
  input.addSource(new ScriptedSource(() => held[0], 0));
  input.addSource(new ScriptedSource(() => held[1], 1));
  const a = createApp({ input, audio: new NullAudio(), store, params: { ...DEFAULT_PARAMS } });
  const r = new SoftRenderer();
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      a.scenes.update();
      r.begin();
      a.scenes.draw(r);
      r.end();
    }
  };
  const tap = (b: Button, slot: 0 | 1 = 0): void => {
    held[slot] = [b];
    step(1);
    held[slot] = [];
    step(1);
  };
  const until = (cls: SceneClass, max: number): boolean => {
    for (let i = 0; i < max; i++) {
      if (a.scenes.top instanceof cls) return true;
      step(1);
    }
    return a.scenes.top instanceof cls;
  };
  const log = (): string[] => ((a.audio as GameAudio).inner as NullAudio).log;
  return { app: a, r, step, tap, until, log };
}

describe('scenes (headless)', () => {
  it('the GDD §13.1 flow: title → mode select → character select → intro card → gameplay → tally → ending → final tally → high scores → title', () => {
    const { app: a, step, tap, until } = app();
    a.scenes.reset(new TitleScene(a));
    step(20);
    tap('start');
    expect(until(ModeSelectScene, 40)).toBe(true);
    step(20);
    tap('fire'); // 1 PLAYER
    expect(until(CharacterSelectScene, 40)).toBe(true);
    step(20);
    tap('right');
    tap('fire'); // the second roster character
    expect(until(MissionIntroScene, 100)).toBe(true);
    expect(a.session?.slots[0].character).toBe('thom');
    expect(a.campaign).not.toBeNull();
    step(70);
    tap('start'); // start skips the card after 60 ticks
    expect(until(GameplayScene, 60)).toBe(true);
    expect(a.session?.activeCount).toBe(1);
    // The mission script completes after 60 ticks; victory poses, then the newspaper tally.
    expect(until(MissionCompleteScene, 600)).toBe(true);
    // The tally moves on by itself; m1 is the last registered mission here, so the ending follows.
    expect(until(EndingScene, 900)).toBe(true);
    const end = a.scenes.top as EndingScene;
    expect(end.phase).toBe('last-note');
    // Start skips each part of the ending after 60 ticks of it.
    for (let i = 0; i < 5 && a.scenes.top === end; i++) {
      step(65);
      tap('start');
    }
    expect(until(FinalTallyScene, 60)).toBe(true);
    // Lives left and ONE-TAKE WONDER push the score into the table: name entry, then the table, then the title.
    expect(until(NameEntryScene, 900)).toBe(true);
    for (let i = 0; i < 3; i++) tap('fire');
    expect(until(HighScoresScene, 60)).toBe(true);
    expect(a.highScores.entries.some((e) => e.mission === 'all')).toBe(true);
    step(40);
    tap('fire');
    expect(until(TitleScene, 120)).toBe(true);
    expect(a.session).toBeNull();
  });

  it('the intro card lasts at most 360 ticks and plays the briefing music', () => {
    const { app: a, until, log } = app();
    a.session = null;
    a.campaign = newCampaign();
    a.scenes.reset(new MissionIntroScene(a, 'm1'));
    expect(until(GameplayScene, INTRO_TICKS + 60)).toBe(true);
    expect(log()).toContain('music:briefing');
  });

  it('pause overlay: Escape-like pause, then resume', () => {
    const { app: a, step } = app(timeline().idle(40).tap('start').idle(10).tap('fire'));
    startNewGame(a, { mission: 'm1' });
    step(45);
    expect(a.scenes.top).toBeInstanceOf(PauseScene);
    const game = a.scenes.top as unknown as { transparent?: boolean };
    expect(game.transparent).toBe(true);
    step(10);
    expect(a.scenes.top).toBeInstanceOf(GameplayScene);
  });

  it('the pause menu host (PauseHost): OPTIONS changes reach the gameplay camera shake', () => {
    const { app: a, until } = app(timeline().idle(1));
    startNewGame(a, { mission: 'm1' });
    expect(until(GameplayScene, 60)).toBe(true);
    const game = a.scenes.top as GameplayScene;
    game.applySettings({ ...a.settings, screenShake: 'off' });
    expect(game.runner.world.camera.shakeScale).toBe(0);
    game.applySettings({ ...a.settings, screenShake: 'low' });
    expect(game.runner.world.camera.shakeScale).toBe(0.5);
  });

  it('pause → QUIT TO TITLE asks first (default NO); YES stops the music and returns to the title', () => {
    const { app: a, step, tap, until, log } = app(timeline().idle(40).tap('start'));
    startNewGame(a, { mission: 'm1' });
    step(45);
    const pause = a.scenes.top as PauseScene;
    expect(pause).toBeInstanceOf(PauseScene);
    tap('down');
    tap('down');
    expect(pause.selected).toBe('QUIT TO TITLE');
    tap('fire');
    expect(pause.asking).toBe(true);
    tap('fire'); // NO is the default
    expect(pause.asking).toBe(false);
    expect(a.scenes.top).toBe(pause);
    tap('fire');
    tap('left'); // → YES
    const before = log().length;
    tap('fire');
    expect(log().slice(before)).toContain('music:stop');
    expect(until(TitleScene, 60)).toBe(true);
    expect(a.session).toBeNull();
  });

  it('losing the window focus pauses a game in progress', () => {
    const { app: a, step } = app(timeline().idle(200));
    startNewGame(a, { mission: 'm1' });
    step(40);
    a.focusLost = true;
    step(2);
    expect(a.scenes.top).toBeInstanceOf(PauseScene);
  });

  it('game over: the countdown runs over the live world (no continue screen); time runs out → GAME OVER → high scores → title', () => {
    const { app: a, step, until } = app(timeline().idle(1));
    startNewGame(a, { mission: 'm1' });
    step(20);
    const game = a.scenes.top as GameplayScene;
    a.session!.slots[0].lives = 1;
    game.runner.players[0].kill('impact');
    step(80);
    expect(a.scenes.top).toBe(game);
    expect(game.runner.countdownHeld).toBe(true);
    expect(game.runner.countdownNumber).toBeGreaterThanOrEqual(8);
    expect(until(GameOverScene, 11 * 60 + 200)).toBe(true);
    // A score of 0 does not make the table: straight to the high scores, then the title.
    expect(until(HighScoresScene, 300)).toBe(true);
    expect(until(TitleScene, 700)).toBe(true);
  });

  it('the tally pays the bonus lines into the score and records the golden record for the final tally', () => {
    const { app: a, step, until } = app(timeline().idle(1));
    startNewGame(a, { mission: 'm1' });
    expect(until(GameplayScene, 60)).toBe(true);
    step(5);
    const slot = a.session!.slots[0];
    slot.rescued = 2;
    slot.mission.goldenRecord = true;
    const before = slot.score;
    a.scenes.reset(new MissionCompleteScene(a, (a.scenes.top as GameplayScene).runner));
    step(5);
    expect(until(EndingScene, 900)).toBe(true);
    // HOSTAGES 2 × 10,000 + FLAWLESS 30,000 (NORMAL × 1.0).
    expect(slot.score - before).toBe(50000);
    expect(slot.rescued).toBe(0);
    expect(a.campaign?.goldenRecords[0].has('m1')).toBe(true);
    expect(a.campaign?.missions).toEqual(['m1']);
  });

  it('the ending runs its five parts in order by itself', () => {
    const { app: a, step } = app(timeline().idle(1));
    startNewGame(a, { mission: 'm1', characters: ['grace'] });
    step(2);
    const end = new EndingScene(a);
    a.scenes.reset(end);
    const seen: string[] = [];
    for (let i = 0; i < 6000 && a.scenes.top === end; i++) {
      if (seen[seen.length - 1] !== end.phase) seen.push(end.phase);
      step(1);
      if (i === LAST_NOTE_TICKS - 2) expect(end.phase).toBe('last-note');
    }
    expect(seen).toEqual(['last-note', 'splashdown', 'parade', 'captions', 'poses']);
    step(45);
    expect(a.scenes.top).toBeInstanceOf(FinalTallyScene);
  });

  it('boot waits for a click or key before the title (it unlocks audio)', async () => {
    const input = new InputManager();
    const held: Button[] = [];
    input.addSource(new ScriptedSource(() => held, 0));
    const a = createApp({ input, audio: new NullAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS }, gesture: false });
    const boot = new BootScene(a);
    a.scenes.reset(boot);
    const tick = (): void => {
      input.update();
      a.scenes.update();
    };
    // The real preload is time-budgeted per tick; a busy CI runner (4 cores shared with the
    // Chromium tests) needs about 75 s of wall time for it, a laptop about 12 s.
    const t0 = Date.now();
    while (!boot.ready && Date.now() - t0 < 170_000) {
      tick();
      await new Promise((res) => setTimeout(res, 0));
    }
    expect(boot.progress).toBe(1);
    for (let i = 0; i < 40; i++) tick();
    expect(a.scenes.top).toBe(boot);
    held.push('fire');
    tick();
    held.length = 0;
    for (let i = 0; i < 40; i++) tick();
    expect(a.scenes.top).toBeInstanceOf(TitleScene);
  }, 180_000);
  it('2 PLAYERS: start on pad 2 joins an empty slot mid-mission (a free credit), never pausing', () => {
    const { app: a, step, tap, until } = app(timeline().idle(1));
    startNewGame(a, { mission: 'm1', players: 2, characters: ['grace'] });
    expect(until(GameplayScene, 60)).toBe(true);
    // Past the 30-tick fade in (no join while a scene change runs); the test mission ends at 60.
    step(32);
    const game = a.scenes.top as GameplayScene;
    expect(game.runner.players.length).toBe(1);
    tap('start', 1);
    expect(a.scenes.top).toBe(game);
    expect(game.runner.players.length).toBe(2);
    expect(a.session!.slots[1].joined).toBe(true);
  });

  it('a name entered for a high score is saved and survives a restart', () => {
    const store = new MemoryStore();
    const { app: a, step, tap, until } = app(timeline().idle(1), store);
    startNewGame(a, { mission: 'm1', characters: ['grace'] });
    step(2);
    const slot = a.session!.slots[0];
    slot.score = 9_000_000;
    a.scenes.reset(new NameEntryScene(a, [slot], true));
    step(2);
    for (let i = 0; i < 3; i++) tap('fire');
    expect(until(HighScoresScene, 120)).toBe(true);
    const top = loadHighScores(store).entries[0];
    expect(top.score).toBe(9_000_000);
    expect(top.name).toBe('AAA');
    expect(top.mission).toBe('all');
  });

  it('the menu difficulty is saved at once and loads on the next boot', () => {
    const store = new MemoryStore();
    const { app: a, step, tap } = app(timeline().idle(1), store);
    a.scenes.reset(new ModeSelectScene(a));
    step(2);
    tap('down');
    tap('down');
    tap('right');
    expect(a.settings.difficulty).toBe('hard');
    expect(loadSettings(store).difficulty).toBe('hard');
  });
});

describe('2× art preload (docs/ARCHITECTURE.md §3)', () => {
  it('headless apps never start the background 2× preload; only the browser app asks for it', () => {
    const { app: a } = app();
    expect(a.preloadArt).toBe(false);
    expect(preloadMissionArt(a, { artDensity: 2 })).toBe(false);
    // A 1× mission has nothing to preload.
    expect(preloadMissionArt({ preloadArt: true, session: null }, { artDensity: 1 })).toBe(false);
    expect(preloadMissionArt({ preloadArt: true, session: null }, { artDensity: 2 }, 1)).toBe(false);
    expect(missionArtPreloadStarted()).toBe(false);
  });

  it('preloads the joined players\' characters first, then the mission\'s first prefixes; the boss last', async () => {
    // The ams module registers the mission (a boot's content load elsewhere may still be running).
    await import('../../src/game/content/missions/ams/index');
    const session = newSession(app().app, ['pip', 'grace'], 'normal');
    const ams = getMission('ams');
    const order = missionArtOrder(ams, session);
    expect(order.first.slice(0, 3)).toEqual(['char/pip/', 'char/grace/', 'vehicle/swan']);
    // ROBO-HALSEMA last (the scan car, the mid-boss of c, is section art of c).
    expect(order.last[0]).toBe('boss/ams-mayor/');
    expect(missionArtOrder(undefined, newSession(app().app, ['recruit']))).toEqual({ first: ['char/recruit/'], last: [] });
    expect(MISSION_ART_BUDGET_MS).toBeGreaterThan(0);
    expect(MISSION_ART_BUDGET_MS).toBeLessThanOrEqual(8);
  });
});

describe('GRAPHICS option (docs/ARCHITECTURE.md §3)', () => {
  it('cycles PIXEL / SMOOTH / XBR, defaults to PIXEL, is saved and repaired', () => {
    const s = { ...DEFAULT_SETTINGS };
    expect(optionValue(s, 'graphics')).toBe('PIXEL');
    expect(stepOption(s, 'graphics', 1)).toBe(true);
    expect(optionValue(s, 'graphics')).toBe('SMOOTH');
    stepOption(s, 'graphics', 1);
    expect(s.graphics).toBe('xbr');
    stepOption(s, 'graphics', 1);
    expect(s.graphics).toBe('pixel');
    stepOption(s, 'graphics', -1);
    expect(s.graphics).toBe('xbr');
    const store = new MemoryStore();
    saveSettings(store, s);
    expect(loadSettings(store).graphics).toBe('xbr');
    store.set('settings', JSON.stringify({ ...s, graphics: 'hq4x' }));
    expect(loadSettings(store).graphics).toBe('pixel');
  });

  it('an old save (no version, GRAPHICS saved as the old SMOOTH default) loads as PIXEL once', () => {
    const store = new MemoryStore();
    // What the group-1 build saved on leaving Options or changing the difficulty.
    store.set('settings', JSON.stringify({ ...DEFAULT_SETTINGS, difficulty: 'hard', graphics: 'smooth' }));
    const s = loadSettings(store);
    expect(s.graphics).toBe('pixel');
    expect(s.difficulty).toBe('hard'); // the other fields survive
    expect('version' in s).toBe(false);
    // A choice made after the migration sticks.
    s.graphics = 'smooth';
    saveSettings(store, s);
    expect(JSON.parse(store.get('settings')!).version).toBe(SETTINGS_VERSION);
    expect(loadSettings(store).graphics).toBe('smooth');
  });

  it('?gfx= shows on the GRAPHICS row and steps from there; changing it drops the URL value', () => {
    const store = new MemoryStore();
    const { app: a, step, tap } = app(timeline().idle(1), store);
    a.graphicsOverride = 'xbr'; // as createApp does for ?gfx=xbr
    expect(a.settings.graphics).toBe('pixel');
    expect(graphicsMode(a)).toBe('xbr');
    a.scenes.reset(new OptionsScene(a));
    step(2);
    const row = OPTION_ROWS.findIndex((r) => r.id === 'graphics');
    for (let i = 0; i < row; i++) tap('down');
    tap('right'); // XBR → PIXEL (not SMOOTH → XBR, which would change nothing on screen)
    expect(a.graphicsOverride).toBe(null);
    expect(a.settings.graphics).toBe('pixel');
    expect(graphicsMode(a)).toBe('pixel');
  });

  it('says when the window is too small for the chosen filter', () => {
    expect(graphicsHint('xbr', 3)).toBe('XBR NEEDS A LARGER WINDOW: SMOOTH');
    expect(graphicsHint('smooth', 1)).toBe('SMOOTH NEEDS A LARGER WINDOW: PIXEL');
    expect(graphicsHint('xbr', 4)).toBe('');
    expect(graphicsHint('smooth', 5)).toBe('');
    expect(graphicsHint('pixel', 1)).toBe('');
    // It fits the panel (x 40..344) in the small font (6 px per character).
    expect(graphicsHint('smooth', 1).length * 6).toBeLessThanOrEqual(296);
  });

  it('every option row fits the panel and the menu draws without errors', () => {
    const last = OPTION_ROWS.length - 1;
    expect(OPTION_ROWS.map((r) => r.id)).toContain('graphics');
    // Rows from y 40, OPTION_STEP px apart: the last one ends above the bottom hint line (y 200).
    expect(OPTION_TOP + last * OPTION_STEP + 8).toBeLessThanOrEqual(200);
    const { app: a, step } = app(timeline().idle(1));
    a.scenes.reset(new OptionsScene(a));
    step(2);
    const r = new SoftRenderer();
    r.begin();
    a.scenes.draw(r);
    r.end();
  });
});

describe('campaign numbering (docs/design/amsterdam.md §8)', () => {
  it('ams comes first; labels and the high-score column number missions by their campaign place', () => {
    expect(CAMPAIGN_MISSIONS).toEqual(['ams', 'm1', 'm2', 'm3', 'm4', 'm5']);
    expect(['ams', 'm1', 'm2', 'm3', 'm4', 'm5', 'm0'].map(missionLabel)).toEqual(['MISSION 1', 'MISSION 2', 'MISSION 3', 'MISSION 4', 'MISSION 5', 'FINAL MISSION', 'MISSION 0']);
    const col = (mission: string): string => missionColumn({ name: 'AAA', score: 0, mission, character: '', continues: 0, difficulty: 'normal' });
    expect(['ams', 'm1', 'm4', 'm5', 'all'].map(col)).toEqual(['M1', 'M2', 'M5', 'M6', 'ALL']);
    // The first-person floors (docs/design/fps.md §1.9).
    expect(['fps-1', 'fps-2'].map(col)).toEqual(['F1', 'F2']);
    // The ring road is level 2 on the route (docs/design/ring.md §1): MISSION 2, column M2.
    expect(missionLabel('ring')).toBe('MISSION 2');
    expect(col('ring')).toBe('M2');
    // Level 4 (docs/design/oldenzaal.md §1): the fps floors count as level 3.
    expect(missionLabel('oldenzaal')).toBe('MISSION 4');
    expect(col('oldenzaal')).toBe('M4');
  });
});
