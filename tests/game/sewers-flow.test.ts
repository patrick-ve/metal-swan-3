/**
 * Mission sewers in the flow (docs/design/sewers.md §1), wave P0: the route numbers (ams 1, sewers
 * 2, rally 3, the fps floors 4, oldenzaal 5) and columns, the next missions (`ams.next = 'sewers'`,
 * `sewers.next = 'rally'`), the route guard (the m5 trap: `listMissions` sorts ids, sewers comes
 * after oldenzaal; the flow still ends the campaign after m5), the golden-record route, the lazy
 * chunk's loader, the headless route ams → its tally → the MISSION 2 card → sewers → its tally →
 * the MISSION 3 card, and the direct start (`?mission=sewers`, the boot art).
 */
import { describe, expect, it } from 'vitest';
import { InputManager } from '../../src/engine/input';
import { SoftRenderer } from '../../src/engine/render-soft';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, newCampaign, type GameApp } from '../../src/game/app';
import { isLazyContent, loadContent } from '../../src/game/content/index';
import { SEWERS_ID } from '../../src/game/content/missions/sewers/ids';
import { DEFAULT_PARAMS, parseLaunchParams } from '../../src/game/params';
import { getMission, hasMission, listMissions } from '../../src/game/registry';
import { bootArt } from '../../src/game/scenes/boot';
import { EndingScene } from '../../src/game/scenes/ending';
import { missionDone, routeAllows } from '../../src/game/scenes/flow';
import { CAMPAIGN_MISSIONS, FPS_ROUTE, goldenRecordRoute, missionCard, missionLabel, missionNumber, routePredecessor } from '../../src/game/scenes/flow-data';
import { GameplayScene, startNewGame } from '../../src/game/scenes/gameplay';
import { missionColumn } from '../../src/game/scenes/high-scores';
import { MissionCompleteScene } from '../../src/game/scenes/mission-complete';
import { MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { isSewers, loadSewersContent, sewersLoadState } from '../../src/game/scenes/sewers-route';
import { SimAudio } from '../../src/sim/stats';

// The boot's content (the lazy sewers chunk stays out), then the chunk through its own loader.
await loadContent((id) => !isLazyContent(id));
const registeredAtBoot = hasMission(SEWERS_ID);
await loadSewersContent();

interface H {
  app: GameApp;
  step(n?: number): void;
  until(cls: abstract new (...a: never[]) => unknown, max: number): boolean;
}

function harness(): H {
  const input = new InputManager();
  input.players = 1;
  const app = createApp({ input, audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS } });
  const r = new SoftRenderer();
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
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
  return { app, step, until };
}

/** F4 (`skip`) every 120 ticks until the mission's tally page is on top. */
function skipToTally(h: H, game: GameplayScene, id: string): boolean {
  for (let i = 0; i < 6000; i++) {
    if (i % 120 === 0 && game.runner.state === 'playing') game.runner.skip();
    h.step(1);
    const top = h.app.scenes.top as { runner?: { mission?: { id: string } } } | null;
    if (!(top instanceof GameplayScene) && top?.runner?.mission?.id === id) return true;
  }
  return false;
}

describe('the route numbers (spec §1)', () => {
  it('FPS_ROUTE = ams, sewers, rally, fps-1, fps-2, oldenzaal; numbers 1–5; the columns M1, M2, M3, F1, F2, M5', () => {
    expect(FPS_ROUTE).toEqual(['ams', 'sewers', 'rally', 'fps-1', 'fps-2', 'oldenzaal']);
    expect(['ams', 'sewers', 'rally', 'oldenzaal'].map(missionNumber)).toEqual([1, 2, 3, 5]);
    expect(['ams', 'sewers', 'rally', 'oldenzaal'].map(missionLabel)).toEqual(['MISSION 1', 'MISSION 2', 'MISSION 3', 'MISSION 5']);
    const col = (mission: string): string => missionColumn({ name: 'AAA', score: 0, mission, character: '', continues: 0, difficulty: 'normal' });
    expect(['ams', 'sewers', 'rally', 'fps-1', 'fps-2', 'oldenzaal', 'all'].map(col)).toEqual(['M1', 'M2', 'M3', 'F1', 'F2', 'M5', 'ALL']);
    // The cards agree; the dormant ring keeps MISSION 2; the passive campaign keeps its numbers.
    expect(missionCard('sewers').label).toBe('MISSION 2');
    expect(missionCard('rally').label).toBe('MISSION 3');
    expect(missionCard('oldenzaal').label).toBe('MISSION 5');
    expect(missionCard('ring').label).toBe('MISSION 2');
    expect(CAMPAIGN_MISSIONS).toEqual(['ams', 'm1', 'm2', 'm3', 'm4', 'm5']);
    for (const id of FPS_ROUTE) expect(missionLabel(id)).not.toBe('FINAL MISSION');
  });

  it("the rally card's first line stays true after the sewers taxi; the announcer line of the sewers card", () => {
    const rally = missionCard('rally');
    expect(rally.briefing[0]).toBe('TAXI PAID. NOW THE SQUAD RACES DE RINGRALLY: THREE LAPS OF THE A10.');
    expect(missionCard('sewers').announce).toBe('MISSIE TWEE. HOU JE NEUS DICHT!');
  });
});

describe('next missions and the route guard (the m5 trap)', () => {
  it('ams → sewers → rally; sewers is lazy, so the boot did not register it, its loader did', () => {
    expect(registeredAtBoot).toBe(false);
    expect(hasMission(SEWERS_ID)).toBe(true);
    expect(sewersLoadState()).toMatchObject({ registered: true, failed: false });
    expect(isSewers('sewers')).toBe(true);
    expect(isSewers('rally')).toBe(false);
    expect(getMission('ams')!.next).toBe('sewers');
    expect(getMission(SEWERS_ID)!.next).toBe('rally');
  });

  it('a route mission opens only from its predecessor or an explicit next', () => {
    expect(routePredecessor('sewers')).toBe('ams');
    expect(routePredecessor('rally')).toBe('sewers');
    expect(routePredecessor('oldenzaal')).toBe('fps-2');
    expect(routePredecessor('ams')).toBeNull();
    expect(routeAllows(getMission('ams')!, 'sewers')).toBe(true);
    expect(routeAllows(getMission(SEWERS_ID)!, 'rally')).toBe(true);
    expect(routeAllows({ id: 'm5' }, 'sewers')).toBe(false);
    expect(routeAllows({ id: 'oldenzaal' }, 'sewers')).toBe(false);
    expect(routeAllows({ id: 'm5' }, 'oldenzaal')).toBe(false);
    expect(routeAllows({ id: 'sewers' }, 'oldenzaal')).toBe(false);
    expect(routeAllows({ id: 'm4' }, 'm5')).toBe(true);
  });

  it('with sewers loaded m5 still names oldenzaal (sewers sorts after it); the flow still ends the campaign', () => {
    const ids = listMissions();
    expect(ids.indexOf('sewers')).toBe(ids.indexOf('oldenzaal') + 1);
    const h = harness();
    startNewGame(h.app, { mission: 'm5', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    expect(game.runner.nextMission()).toBe('oldenzaal');
    missionDone(h.app, game.runner);
    expect(h.until(EndingScene, 90)).toBe(true);
    expect((h.app.scenes.top as EndingScene).variant).toBe('campaign');
  });

  it('the golden-record route: FPS_ROUTE once the campaign played sewers', () => {
    const c = newCampaign();
    expect(goldenRecordRoute(c)).toBe(CAMPAIGN_MISSIONS);
    c.missions.push('ams', 'sewers');
    expect(goldenRecordRoute(c)).toBe(FPS_ROUTE);
    expect(FPS_ROUTE).toContain(SEWERS_ID);
  });
});

describe('the headless route: ams → its tally → the sewers card → sewers → its tally → the rally card', () => {
  it('runs through with F4 and records sewers in the campaign', () => {
    const h = harness();
    startNewGame(h.app, { mission: 'ams', section: 'd', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    h.app.campaign = newCampaign();
    const ams = h.app.scenes.top as GameplayScene;
    expect(skipToTally(h, ams, 'ams')).toBe(true);
    expect(h.app.scenes.top).toBeInstanceOf(MissionCompleteScene);
    // The newspaper moves on by itself: the MISSION 2 card, sewers' (registered at boot).
    expect(h.until(MissionIntroScene, 900)).toBe(true);
    const card = h.app.scenes.top as MissionIntroScene;
    expect(card.mission).toBe(SEWERS_ID);
    expect(card.card.label).toBe('MISSION 2');
    expect(card.card.name).toBe('RATTENJONG MET DE RATTENITEMS');
    // The card hands over to the mission (the chunk is loaded).
    expect(h.until(GameplayScene, 900)).toBe(true);
    const sewers = h.app.scenes.top as GameplayScene;
    expect(sewers.runner.mission.id).toBe(SEWERS_ID);
    h.step(3);
    expect(sewers.runner.section.id).toBe('sewers-a');
    // The start banner is the card's (MISSION 2 / START!).
    expect(sewers.runner.hud.banner?.text).toBe('MISSION 2');
    expect(skipToTally(h, sewers, SEWERS_ID)).toBe(true);
    // Its tally is the newspaper (no receipt).
    expect(h.app.scenes.top).toBeInstanceOf(MissionCompleteScene);
    expect(h.app.campaign!.missions).toEqual(['ams', 'sewers']);
    // Its tally → the MISSION 3 card BINNEN DE RING (sewers.next = 'rally').
    expect(h.until(MissionIntroScene, 1200)).toBe(true);
    const rally = h.app.scenes.top as MissionIntroScene;
    expect(rally.mission).toBe('rally');
    expect(rally.card.label).toBe('MISSION 3');
  }, 60000);
});

describe('the direct start (?mission=sewers)', () => {
  it('the params pass; section=sewers-c starts in the sewer', () => {
    const p = parseLaunchParams('?mission=sewers&section=sewers-c&god=1');
    expect(p.mission).toBe('sewers');
    expect(p.section).toBe('sewers-c');
    const h = harness();
    startNewGame(h.app, { mission: SEWERS_ID, section: 'sewers-c', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(5);
    expect(game.runner.section.id).toBe('sewers-c');
  });

  it("the boot art: the start screens, the chosen hero and the mission's 1× art", () => {
    const art = bootArt({ mission: SEWERS_ID, char: null, mode: undefined }) ?? [];
    expect(art).toContain('ui/');
    expect(art).toContain('char/recruit/');
    for (const p of getMission(SEWERS_ID)!.art ?? []) expect(art).toContain(p);
  });
});
