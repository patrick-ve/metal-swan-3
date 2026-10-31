/**
 * The route of the first-person mode (docs/design/fps.md §1, §10, group flow; docs/design/rally.md
 * §1): ams complete → its tally → the rally (level 2) → its own tally page → bridge (records) → intro →
 * floor 1; tally → floor 2 → fps ending → final tally;
 * pause / continue / game over from the mode; P2's slot waits; the golden-record route; the story
 * lines fit; the bridge waits in `freeze` while the lazy content is not registered.
 */
import { describe, expect, it } from 'vitest';
import { measure } from '../../../src/engine/font';
import { InputManager, keySetFor, maskFromKeys, padButtonCode, type InputContext, type InputSource, type PlayerSlot } from '../../../src/engine/input';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { createApp, newCampaign, type GameApp } from '../../../src/game/app';
import { BRIDGE_LINES, FPS_ENDING_CAPTIONS, withCallsign } from '../../../src/game/content/fps/story';
import { loadContent } from '../../../src/game/content/index';
// Level 4 is registered for every test here (the last floor's tally leads to its story card).
import '../../../src/game/content/missions/oldenzaal/index';
import { DYING_TICKS } from '../../../src/game/fps/game';
import { PLACE_POINTS } from '../../../src/game/rally/score';
import { defineFpsFloor, fpsFloorByNumber, hasFpsFloor } from '../../../src/game/fps/registry';
import { newFpsRun } from '../../../src/game/fps/run';
import type { FloorResult, FpsRun } from '../../../src/game/fps/types';
import { DEFAULT_PARAMS } from '../../../src/game/params';
import { getCharacter, hasMission, listCharacters } from '../../../src/game/registry';
import { ContinueScene } from '../../../src/game/scenes/continue';
import { EndingScene } from '../../../src/game/scenes/ending';
import { FinalTallyScene, finalTallyLines, FINAL_TALLY } from '../../../src/game/scenes/final-tally';
import { recordMissionClear, silentTally } from '../../../src/game/scenes/flow';
import { CAMPAIGN_MISSIONS, FPS_ROUTE, goldenRecordRoute } from '../../../src/game/scenes/flow-data';
import { FpsScene } from '../../../src/game/scenes/fps';
import { FpsIntroScene, fpsLoadState, loadFpsContent } from '../../../src/game/scenes/fps-intro';
import { fpsFloorDone, fpsTallyDone } from '../../../src/game/scenes/fps-route';
import { FpsTallyScene } from '../../../src/game/scenes/fps-tally';
import { GameOverScene } from '../../../src/game/scenes/game-over';
import { GameplayScene, startNewGame } from '../../../src/game/scenes/gameplay';
import { AMS_BONUS_KEY, CARD_STEP, CARD_Y, FREEZE_MAX, FREEZE_MIN, GlitchBridgeScene, GLITCH_TICKS } from '../../../src/game/scenes/glitch-bridge';
import { missionColumn } from '../../../src/game/scenes/high-scores';
import { MissionCompleteScene } from '../../../src/game/scenes/mission-complete';
import { MissionIntroScene } from '../../../src/game/scenes/mission-intro';
import { RallyScene } from '../../../src/game/scenes/rally';
import { loadRallyContent } from '../../../src/game/scenes/rally-route';
import { loadOatContent } from '../../../src/game/scenes/oat-route';
import { StoryCardScene } from '../../../src/game/scenes/story-card';
import { missionBonusOf } from '../../../src/game/fps/run';
import { PauseScene } from '../../../src/game/scenes/pause';
import { TitleScene } from '../../../src/game/scenes/title';
import { GameSession } from '../../../src/game/session';
import { SimAudio } from '../../../src/sim/stats';

/** A keyboard stand-in: held codes drive the bound pads, presses feed the raw codes. */
class Keys implements InputSource {
  readonly held = new Set<string>();
  private readonly queue: string[] = [];
  private readonly latched = new Set<string>();
  private readonly isDown = (c: string): boolean => this.held.has(c) || this.latched.has(c);
  /** Press `code` for one tick (down + up before the next update). */
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
  /** Step until the top scene is a `cls` (at most `max` ticks). */
  until(cls: abstract new (...a: never[]) => unknown, max: number): boolean;
  /** Top scene classes seen, in order (no repeats). */
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

/** An fps session in the app (the fps slot = slot `fpsSlot`). */
function fpsSession(app: GameApp, players: 1 | 2 = 1): GameSession {
  app.session = new GameSession({ characters: players === 2 ? ['vincent', 'thom'] : ['vincent'], seed: 7 });
  app.campaign = newCampaign();
  return app.session;
}

/** Floors 1 and 2 as copies of floor 0 when group floors has not registered them (yet). */
function ensureFloors(): void {
  const f0 = fpsFloorByNumber(0);
  if (!f0) throw new Error('floor 0 missing');
  if (!hasFpsFloor('fps-1')) defineFpsFloor({ ...f0, id: 'fps-1', number: 1, name: 'SUPPLY DEPOT' });
  if (!hasFpsFloor('fps-2')) defineFpsFloor({ ...f0, id: 'fps-2', number: 2, name: 'HANGAR', boss: true });
}

const RESULT = (floor: number, goldenRecord = false): FloorResult => ({
  floor,
  ticks: 600,
  kills: 1,
  killsTotal: 2,
  secrets: 0,
  secretsTotal: 1,
  treasure: 0,
  treasureTotal: 1,
  goldenRecord,
});

/** Start a floor scene directly (the intro's first entry). */
function startFloor(app: GameApp, run: FpsRun): FpsScene {
  app.session!.startMission(`fps-${run.floor}`);
  run.floorStartScore = app.session!.slots[run.slot].score;
  run.entered = true;
  const scene = new FpsScene(app, run);
  app.scenes.reset(scene);
  scene.game.skipUnfold();
  return scene;
}

// This must run first: nothing has loaded the lazy content in this file yet.
describe('GlitchBridgeScene before the lazy content', () => {
  it('waits in freeze while the fps content is not registered (the cap), then glitches', async () => {
    const h = harness();
    fpsSession(h.app);
    expect(fpsLoadState().registered).toBe(false);
    const bridge = new GlitchBridgeScene(h.app);
    h.app.scenes.reset(bridge);
    // Synchronous ticks: the content load (dynamic imports) cannot finish in between.
    h.step(FREEZE_MIN + 10);
    expect(bridge.phase).toBe('freeze');
    h.step(FREEZE_MAX - FREEZE_MIN - 11);
    expect(bridge.phase).toBe('freeze');
    h.step(2);
    expect(bridge.phase).toBe('glitch');
    await loadFpsContent(h.app);
    expect(fpsLoadState().registered).toBe(true);
  });
});

describe('the route (headless)', () => {
  it('ams complete → its tally → oat → its tally → the rally → its tally → bridge (records) → intro → floor 1', async () => {
    await loadContent();
    await loadOatContent();
    await loadRallyContent();
    await loadFpsContent(createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore() }));
    ensureFloors();
    const h = harness();
    startNewGame(h.app, { mission: 'ams', section: 'd', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    h.step(5);
    const game = h.app.scenes.top as GameplayScene;
    const slot = h.app.session!.slots[0];
    slot.mission.goldenRecord = true;
    // F4: the boss dies (or the mission completes); victory poses for 210 ticks, then the newspaper.
    let ok = false;
    for (let i = 0; i < 4000 && !ok; i++) {
      if (i % 120 === 0 && game.runner.state === 'playing') game.runner.skip();
      h.step(1);
      ok = h.app.scenes.top instanceof MissionCompleteScene;
    }
    expect(ok).toBe(true);
    expect(h.seen).not.toContain(GlitchBridgeScene.name);
    // The newspaper → oat's card (MISSION 2 OAT OF CONTROL; its lazy chunk is loaded above) → oat (F4
    // completes it) → its tally (docs/design/oat.md §1; the newspaper until the kassabon lands).
    expect(h.until(MissionIntroScene, 900)).toBe(true);
    expect((h.app.scenes.top as MissionIntroScene).mission).toBe('oat');
    expect(h.until(GameplayScene, 900)).toBe(true);
    const oat = h.app.scenes.top as GameplayScene;
    expect(oat.runner.mission.id).toBe('oat');
    let oatDone = false;
    for (let i = 0; i < 4000 && !oatDone; i++) {
      if (i % 120 === 0 && oat.runner.state === 'playing') oat.runner.skip();
      h.step(1);
      const top = h.app.scenes.top as { runner?: { mission?: { id: string } } } | null;
      oatDone = !(top instanceof GameplayScene) && top?.runner?.mission?.id === 'oat';
    }
    expect(oatDone).toBe(true);
    // The oat tally → the rally's card (MISSION 3 BINNEN DE RING) → the glitch into 3D → the race
    // (docs/design/rally.md §1; the 2D ring is dormant since 2026-10-22).
    expect(h.until(MissionIntroScene, 900)).toBe(true);
    expect((h.app.scenes.top as MissionIntroScene).mission).toBe('rally');
    expect(h.until(RallyScene, 900)).toBe(true);
    const race = h.app.scenes.top as RallyScene;
    h.step(5);
    const before = slot.score;
    // F4 on the race (`finishNow`): it ends at once in the grid order (the player's estate starts 6th:
    // FIELD's grid, docs/design/rally.md §2 — no golden record then); the results, then the rally's
    // MISSION COMPLETE page, then the bridge.
    race.runner.finishNow();
    const place = race.runner.carOf(0)!.place;
    expect(h.until(MissionCompleteScene, 400)).toBe(true);
    expect(h.seen).toContain(RallyScene.name);
    expect((h.app.scenes.top as MissionCompleteScene).runner.mission.id).toBe('rally');
    // The page pays the race lines (PLACE n/8: 5,000 for 6th) and moves on by itself.
    expect(h.until(GlitchBridgeScene, 900)).toBe(true);
    const bridge = h.app.scenes.top as GlitchBridgeScene;
    expect(bridge.snap.density).toBe(2);
    expect(slot.score - before).toBeGreaterThanOrEqual(PLACE_POINTS[place - 1]);
    expect(slot.rescued).toBe(0);
    // The bridge pays nothing more: no bonus record, no MISSION 2 BONUS line on floor 1.
    expect(missionBonusOf(h.app.session!.records.get<unknown>(AMS_BONUS_KEY))).toBeUndefined();
    expect(h.app.campaign!.missions).toEqual(['ams', 'oat', 'rally']);
    expect(h.app.campaign!.goldenRecords[0].has('ams')).toBe(true);
    expect(h.app.campaign!.goldenRecords[0].has('rally')).toBe(place === 1);
    // The phases, then a press finishes the typing and a second press folds the card.
    expect(h.until(GlitchBridgeScene, 1)).toBe(true);
    for (let i = 0; i < 200 && bridge.phase !== 'card'; i++) h.step(1);
    expect(bridge.phase).toBe('card');
    expect(bridge.lines[2]).toBe('VINCENT WOKE UP IN A FREIGHT CAR. THE YEAR: 1944.');
    h.step(61);
    h.keys.tap('Enter');
    h.step(2);
    expect(bridge.phase).toBe('card');
    h.keys.tap('Enter');
    h.step(2);
    expect(bridge.phase).toBe('fold');
    expect(h.until(FpsIntroScene, 70)).toBe(true);
    const intro = h.app.scenes.top as FpsIntroScene;
    expect(intro.floor).toBe(1);
    expect(intro.fromBridge).toBe(true);
    expect(h.until(FpsScene, 400)).toBe(true);
    const fps = h.app.scenes.top as FpsScene;
    expect(fps.run.floor).toBe(1);
    expect(fps.run.slot).toBe(0);
    expect(h.app.session!.missionId).toBe('fps-1');
    expect(h.app.input.fpsMode).toBe(true);
  }, 120000);

  it('the bridge without a runner (?mode=bridge) draws its placeholder and needs no records', () => {
    const h = harness();
    fpsSession(h.app);
    const bridge = new GlitchBridgeScene(h.app);
    h.app.scenes.reset(bridge);
    h.step(FREEZE_MIN + 1);
    expect(bridge.phase).toBe('glitch');
    expect(h.app.session!.records.has(AMS_BONUS_KEY)).toBe(false);
    h.step(GLITCH_TICKS);
    expect(bridge.phase).toBe('card');
    // Unattended, the card folds by itself and the fps mode starts.
    expect(h.until(FpsIntroScene, 3000)).toBe(true);
  });

  it('floor 1 → tally → floor 2 → tally → the story card (oldenzaal) | the fps ending (captions, credits, poses) → final tally', () => {
    ensureFloors();
    const h = harness();
    fpsSession(h.app);
    const run = newFpsRun(h.app.session!, 1);
    startFloor(h.app, run);
    fpsFloorDone(h.app, run, RESULT(1, true));
    expect(h.until(FpsTallyScene, 60)).toBe(true);
    fpsTallyDone(h.app, run);
    expect(h.until(FpsIntroScene, 60)).toBe(true);
    expect((h.app.scenes.top as FpsIntroScene).floor).toBe(2);
    expect(run.floor).toBe(2);
    expect(run.entered).toBe(false);
    fpsTallyDone(h.app, run);
    // Level 4 follows the floors (docs/design/oldenzaal.md §1): the story card, then MISSION 4.
    // The fps ending now comes after oldenzaal's TO BE CONTINUED card (tests/game/oldenzaal-flow.test.ts).
    expect(hasMission('oldenzaal')).toBe(true);
    expect(h.until(StoryCardScene, 90)).toBe(true);
    h.app.scenes.reset(new EndingScene(h.app, { variant: 'fps' }));
    expect(h.until(EndingScene, 90)).toBe(true);
    const end = h.app.scenes.top as EndingScene;
    expect(end).toBeInstanceOf(EndingScene);
    expect(end.variant).toBe('fps');
    const phases: string[] = [];
    for (let i = 0; i < 8000 && h.app.scenes.top === end; i++) {
      if (phases[phases.length - 1] !== end.phase) phases.push(end.phase);
      h.step(1);
    }
    expect(phases).toEqual(['captions', 'parade', 'poses']);
    expect(h.until(FinalTallyScene, 60)).toBe(true);
    expect(FPS_ENDING_CAPTIONS.length).toBe(5);
  });

  it('floor 0 (the test range) goes back to the title after its tally', () => {
    ensureFloors();
    const h = harness();
    fpsSession(h.app);
    const run = newFpsRun(h.app.session!, 0);
    fpsTallyDone(h.app, run);
    expect(h.app.session).toBeNull();
    expect(h.until(TitleScene, 60)).toBe(true);
  });
});

describe('pause, continue and game over in the fps mode', () => {
  it('Esc and the raw pad Start pause; Digit1 (2P start of slot 0, the weapon-1 key) does not', () => {
    ensureFloors();
    const h = harness(2);
    fpsSession(h.app, 2);
    const scene = startFloor(h.app, newFpsRun(h.app.session!, 1));
    h.step(2);
    h.keys.tap('Digit1');
    h.step(1);
    expect(h.app.scenes.top).toBe(scene);
    h.keys.tap('Escape');
    h.step(1);
    expect(h.app.scenes.top).toBeInstanceOf(PauseScene);
    expect(h.app.input.fpsMode).toBe(false);
    h.keys.tap('Escape');
    h.step(2);
    expect(h.app.scenes.top).toBe(scene);
    expect(h.app.input.fpsMode).toBe(true);
    h.keys.tap(padButtonCode(9));
    h.step(1);
    expect(h.app.scenes.top).toBeInstanceOf(PauseScene);
  });

  it('the last life pushes the continue screen; a continue keeps the last score digit and replays the floor', () => {
    ensureFloors();
    const h = harness();
    const session = fpsSession(h.app);
    session.credits = 2;
    const run = newFpsRun(session, 1);
    const scene = startFloor(h.app, run);
    const slot = session.slots[0];
    slot.score = 4560;
    run.floorStartScore = 4560;
    slot.lives = 1;
    scene.game.hurt(500);
    h.step(DYING_TICKS + 1);
    expect(slot.gameOver).toBe(true);
    expect(h.app.scenes.top).toBeInstanceOf(ContinueScene);
    h.step(10);
    h.keys.tap('Enter'); // solo start
    h.step(60);
    expect(h.app.scenes.top).toBe(scene);
    expect(slot.gameOver).toBe(false);
    expect(slot.continues).toBe(1);
    expect(session.credits).toBe(1);
    expect(slot.score % 10).toBe(1);
    expect(run.floorStartScore).toBe(4561);
    expect(scene.game.state).toBe('play');
    expect(h.app.input.fpsMode).toBe(true);
  });

  it('no continue in time → GAME OVER (unchanged)', () => {
    ensureFloors();
    const h = harness();
    fpsSession(h.app);
    const scene = startFloor(h.app, newFpsRun(h.app.session!, 1));
    h.app.session!.slots[0].lives = 1;
    scene.game.hurt(500);
    h.step(DYING_TICKS + 1);
    expect(h.app.scenes.top).toBeInstanceOf(ContinueScene);
    expect(h.until(GameOverScene, 11 * 60 + 200)).toBe(true);
  });

  it('P1 out at the ams kill: P2 plays with slot 0 devices (HUD 2P), dies, continues; P1 waits', () => {
    ensureFloors();
    const h = harness(2);
    const session = fpsSession(h.app, 2);
    const p1 = session.slots[0];
    const p2 = session.slots[1];
    p1.gameOver = true;
    p1.lives = 0;
    const p1Before = { score: p1.score, continues: p1.continues };
    const run = newFpsRun(session, 1);
    expect(run.slot).toBe(1);
    const scene = startFloor(h.app, run);
    expect(scene.slot).toBe(p2);
    p2.score = 7770;
    run.floorStartScore = 7770;
    p2.lives = 1;
    scene.game.hurt(500);
    h.step(DYING_TICKS + 1);
    const cont = h.app.scenes.top;
    expect(cont).toBeInstanceOf(ContinueScene);
    // The waiting slot cannot continue here, and P2 uses slot 0's keys (Digit1 = slot 0's 2P start).
    expect(scene.continuePlayer(0)).toBe(false);
    expect(scene.startPressed(0, h.app.input)).toBe(false);
    h.step(5);
    h.keys.tap('Digit1');
    h.step(2);
    expect(p2.gameOver).toBe(false);
    expect(p2.continues).toBe(1);
    expect(p2.score % 10).toBe(1);
    expect(h.until(FpsScene, 60)).toBe(true);
    expect(p1).toMatchObject({ gameOver: true, ...p1Before });
  });
});

describe('records, route lists and text', () => {
  it('the golden-record route: ams + oat + rally + fps-1 + fps-2 + oldenzaal on the route, the six missions otherwise', () => {
    const c = newCampaign();
    expect(goldenRecordRoute(c)).toBe(CAMPAIGN_MISSIONS);
    expect(goldenRecordRoute(null)).toBe(CAMPAIGN_MISSIONS);
    c.missions.push('ams', 'fps-1');
    expect(goldenRecordRoute(c)).toBe(FPS_ROUTE);
    // Oat is level 2 (docs/design/oat.md §1), the rally level 3 (docs/design/rally.md §1; the 2D ring
    // is dormant since 2026-10-22). Level 5, the haunted town, follows the floors.
    expect(FPS_ROUTE).toEqual(['ams', 'oat', 'rally', 'fps-1', 'fps-2', 'oldenzaal']);
    expect(CAMPAIGN_MISSIONS).toEqual(['ams', 'm1', 'm2', 'm3', 'm4', 'm5']);
    const s = new GameSession({ characters: ['vincent', 'thom'] });
    for (const id of FPS_ROUTE) c.goldenRecords[0].add(id);
    c.goldenRecords[1].add('ams');
    const line = (i: 0 | 1): number | null => finalTallyLines(s.slots[i], c).lines[1].points;
    expect(line(0)).toBe(FINAL_TALLY.allGoldenRecords);
    // The waiting slot's records lack fps-1 / fps-2.
    expect(line(1)).toBeNull();
  });

  it('the high-score column shows F1 / F2 for the fps floors', () => {
    const e = { name: 'X', score: 1, character: 'vincent', continues: 0 };
    expect(missionColumn({ ...e, mission: 'fps-1' })).toBe('F1');
    expect(missionColumn({ ...e, mission: 'fps-2' })).toBe('F2');
    expect(missionColumn({ ...e, mission: 'ams' })).toBe('M1');
  });

  it('every story line fits one row of the small font (≤ 352 px) with the longest callsign', async () => {
    await loadContent();
    const names = listCharacters().map((id) => getCharacter(id).name);
    for (const id of ['vincent', 'thom', 'dirk', 'bob', 'patrick', 'recruit']) expect(names).toContain(getCharacter(id).name);
    for (const l of BRIDGE_LINES) for (const n of names) expect(measure(withCallsign(l, n), 'small'), `${l} / ${n}`).toBeLessThanOrEqual(352);
    expect(CARD_Y + (BRIDGE_LINES.length - 1) * CARD_STEP + 9).toBeLessThanOrEqual(162);
  });

  it('recordMissionClear and silentTally are what the newspaper would record and pay', async () => {
    await loadContent();
    const h = harness();
    startNewGame(h.app, { mission: 'ams', section: 'a', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const runner = (h.app.scenes.top as GameplayScene).runner;
    const slot = h.app.session!.slots[0];
    slot.rescued = 2;
    const before = slot.score;
    recordMissionClear(h.app, runner);
    recordMissionClear(h.app, runner);
    expect(h.app.campaign!.missions).toEqual(['ams']);
    const [p1, p2] = silentTally(h.app, runner);
    expect(p2).toBe(0);
    expect(p1).toBeGreaterThanOrEqual(20000);
    expect(slot.score - before).toBe(p1);
    expect(slot.rescued).toBe(0);
  });
});
