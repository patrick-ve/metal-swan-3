/**
 * Mission oat in the flow (docs/design/oat.md §1; docs/api/oat.md "Flow"), wave A (CORE): the
 * route numbers (ams 1, oat 2, rally 3, the fps floors 4, oldenzaal 5) and columns, the next
 * missions (`ams.next = 'oat'`, `oat.next = 'rally'`), the route guard (the m5 trap: with oat loaded
 * m5's sorted next is `oat`, and the flow still ends the campaign), the golden-record route, the
 * lazy chunk's loader, the headless route ams → its tally → the MISSION 2 card → oat → its tally →
 * the MISSION 3 card, and the direct start (`?mission=oat&section=oat-c1`, the boot art).
 */
import { describe, expect, it } from 'vitest';
import { InputManager } from '../../src/engine/input';
import { SoftRenderer } from '../../src/engine/render-soft';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, newCampaign, type GameApp } from '../../src/game/app';
import { isLazyContent, loadContent } from '../../src/game/content/index';
import { OAT_ID, OAT_SPRITE_PREFIXES } from '../../src/game/content/missions/oat/ids';
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
import { isOat, loadOatContent, oatLoadState } from '../../src/game/scenes/oat-route';
import { Vehicle } from '../../src/game/vehicle';
import { SimAudio } from '../../src/sim/stats';

// The boot's content (the lazy oat chunk stays out), then the chunk through its own loader.
await loadContent((id) => !isLazyContent(id));
const registeredAtBoot = hasMission(OAT_ID);
await loadOatContent();

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

/** F4 (`skip`) every 120 ticks until the mission's tally page is on top (any tally scene: the newspaper, the kassabon). */
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
  it('FPS_ROUTE = ams, oat, rally, fps-1, fps-2, oldenzaal; numbers 1–5; the columns M1, M2, M3, F1, F2, M5', () => {
    expect(FPS_ROUTE).toEqual(['ams', 'oat', 'rally', 'fps-1', 'fps-2', 'oldenzaal']);
    expect(['ams', 'oat', 'rally', 'oldenzaal'].map(missionNumber)).toEqual([1, 2, 3, 5]);
    expect(['ams', 'oat', 'rally', 'oldenzaal'].map(missionLabel)).toEqual(['MISSION 1', 'MISSION 2', 'MISSION 3', 'MISSION 5']);
    const col = (mission: string): string => missionColumn({ name: 'AAA', score: 0, mission, character: '', continues: 0, difficulty: 'normal' });
    expect(['ams', 'oat', 'rally', 'fps-1', 'fps-2', 'oldenzaal', 'all'].map(col)).toEqual(['M1', 'M2', 'M3', 'F1', 'F2', 'M5', 'ALL']);
    // The cards agree; the dormant ring keeps MISSION 2; the passive campaign keeps its numbers.
    expect(missionCard('oat').label).toBe('MISSION 2');
    expect(missionCard('rally').label).toBe('MISSION 3');
    expect(missionCard('oldenzaal').label).toBe('MISSION 5');
    expect(missionCard('ring').label).toBe('MISSION 2');
    expect(CAMPAIGN_MISSIONS).toEqual(['ams', 'm1', 'm2', 'm3', 'm4', 'm5']);
    expect(missionLabel('m5')).toBe('FINAL MISSION');
    expect(missionLabel('m1')).toBe('MISSION 2');
    // No route level reaches FINAL MISSION.
    for (const id of FPS_ROUTE) expect(missionLabel(id)).not.toBe('FINAL MISSION');
  });

  it('the rally card follows the taxi ride; the announcer lines name the new numbers', () => {
    const rally = missionCard('rally');
    expect(rally.briefing[0]).toBe('TAXI PAID. NOW THE SQUAD RACES DE RINGRALLY: THREE LAPS OF THE A10.');
    expect(rally.announce).toBe('MISSION THREE. VOL GAS!');
    expect(missionCard('oldenzaal').announce).toBe('MISSIE VIJF. BLIJF BIJ ELKAAR, ZWAANTJES!');
    expect(missionCard('oat').announce).toBe('MISSIE TWEE. HOU JE PORTEMONNEE VAST!');
    expect(getMission('oldenzaal')!.subtitle).toBe('MISSION 5');
  });
});

describe('next missions and the route guard (the m5 trap)', () => {
  it('ams → oat → rally; oat is lazy, so the boot did not register it, its loader did', () => {
    expect(registeredAtBoot).toBe(false);
    expect(hasMission(OAT_ID)).toBe(true);
    expect(oatLoadState()).toMatchObject({ registered: true, failed: false });
    expect(isOat('oat')).toBe(true);
    expect(isOat('rally')).toBe(false);
    expect(getMission('ams')!.next).toBe('oat');
    expect(getMission(OAT_ID)!.next).toBe('rally');
  });

  it('a route mission opens only from its predecessor or an explicit next', () => {
    expect(routePredecessor('oat')).toBe('ams');
    expect(routePredecessor('rally')).toBe('oat');
    expect(routePredecessor('oldenzaal')).toBe('fps-2');
    expect(routePredecessor('ams')).toBeNull();
    expect(routePredecessor('m3')).toBeNull();
    expect(routeAllows(getMission('ams')!, 'oat')).toBe(true);
    expect(routeAllows(getMission(OAT_ID)!, 'rally')).toBe(true);
    expect(routeAllows({ id: 'm5' }, 'oat')).toBe(false);
    expect(routeAllows({ id: 'm5' }, 'oldenzaal')).toBe(false);
    expect(routeAllows({ id: 'oat' }, 'oldenzaal')).toBe(false);
    expect(routeAllows({ id: 'm4' }, 'm5')).toBe(true);
    expect(routeAllows({ id: 'x', next: 'oldenzaal' }, 'oldenzaal')).toBe(true);
  });

  it('with oat loaded m5 names oat (listMissions sorts ids); the flow still ends the campaign', () => {
    const ids = listMissions();
    expect(ids.indexOf('oat')).toBe(ids.indexOf('m5') + 1);
    const h = harness();
    startNewGame(h.app, { mission: 'm5', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    expect(game.runner.nextMission()).toBe(OAT_ID);
    missionDone(h.app, game.runner);
    expect(h.until(EndingScene, 90)).toBe(true);
    expect((h.app.scenes.top as EndingScene).variant).toBe('campaign');
  });

  it('the golden-record route: FPS_ROUTE once the campaign played oat (oat places a golden record in oat-a)', () => {
    const c = newCampaign();
    expect(goldenRecordRoute(c)).toBe(CAMPAIGN_MISSIONS);
    c.missions.push('ams', 'oat');
    expect(goldenRecordRoute(c)).toBe(FPS_ROUTE);
    expect(FPS_ROUTE).toContain(OAT_ID);
  });
});

describe('the headless route: ams → its tally → the oat card → oat → its tally → the rally card', () => {
  it('runs through with F4 and records oat in the campaign', () => {
    const h = harness();
    startNewGame(h.app, { mission: 'ams', section: 'd', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    h.app.campaign = newCampaign();
    const ams = h.app.scenes.top as GameplayScene;
    expect(skipToTally(h, ams, 'ams')).toBe(true);
    expect(h.app.scenes.top).toBeInstanceOf(MissionCompleteScene);
    // The newspaper moves on by itself: the MISSION 2 card, oat's (registered at boot).
    expect(h.until(MissionIntroScene, 900)).toBe(true);
    const card = h.app.scenes.top as MissionIntroScene;
    expect(card.mission).toBe(OAT_ID);
    expect(card.card.label).toBe('MISSION 2');
    expect(card.card.name).toBe('OAT OF CONTROL');
    // The card hands over to the mission (the chunk is loaded).
    expect(h.until(GameplayScene, 900)).toBe(true);
    const oat = h.app.scenes.top as GameplayScene;
    expect(oat.runner.mission.id).toBe(OAT_ID);
    h.step(3);
    expect(oat.runner.section.id).toBe('oat-a');
    // The start banner is the card's (MISSION 2 / START!).
    expect(oat.runner.hud.banner?.text).toBe('MISSION 2');
    expect(skipToTally(h, oat, OAT_ID)).toBe(true);
    expect(h.app.campaign!.missions).toEqual(['ams', 'oat']);
    // Its tally → the MISSION 3 card BINNEN DE RING (oat.next = 'rally').
    expect(h.until(MissionIntroScene, 1200)).toBe(true);
    const rally = h.app.scenes.top as MissionIntroScene;
    expect(rally.mission).toBe('rally');
    expect(rally.card.label).toBe('MISSION 3');
  }, 60000);
});

describe('the direct start (?mission=oat)', () => {
  it('the params pass; section=oat-c1 starts the chase with the player on a Swan', () => {
    const p = parseLaunchParams('?mission=oat&section=oat-c1&god=1');
    expect(p.mission).toBe('oat');
    expect(p.section).toBe('oat-c1');
    const h = harness();
    startNewGame(h.app, { mission: OAT_ID, section: 'oat-c1', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(5);
    expect(game.runner.section.id).toBe('oat-c1');
    const v = game.runner.players[0].vehicle;
    expect(v).toBeInstanceOf(Vehicle);
    expect(v?.type).toBe('swan');
  });

  it("the boot art: the start screens, the chosen hero and the mission's 1× art (oat's own prefixes)", () => {
    const art = bootArt({ mission: OAT_ID, char: null, mode: undefined }) ?? [];
    expect(art).toContain('ui/');
    expect(art).toContain('char/recruit/');
    for (const p of OAT_SPRITE_PREFIXES) expect(art).toContain(p);
  });
});
