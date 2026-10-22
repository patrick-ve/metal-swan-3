/**
 * The ring in the flow (docs/design/ring.md §1, §9, §13, §13.1): ams completes → its tally → the
 * ring's intro card (MISSION 2) → RingScene; the ring completes → the glitch bridge (the ring's
 * silent tally, its seed) → the fps floors (the floor-1 tally's MISSION 2 BONUS and seed footer);
 * `?mission=ring` boots into the RingScene; MISSION 2 / the M2 column; player 2 joins with a
 * wagon of their own; a fresh seed per play (`?seed=` wins) and the seed in the debug overlay.
 */
import { describe, expect, it } from 'vitest';
import { measure } from '../../../src/engine/font';
import { BUTTON_BIT, InputManager, keySetFor, maskFromKeys, type InputContext, type InputSource, type PlayerSlot } from '../../../src/engine/input';
import type { DrawOpts, TextOpts } from '../../../src/engine/render';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { createApp, newCampaign, type GameApp } from '../../../src/game/app';
import { loadContent } from '../../../src/game/content/index';
import { MISSION_CARDS } from '../../../src/game/content/ui/cards';
import { AMS_BONUS_KEY, missionBonusOf, newFpsRun } from '../../../src/game/fps/run';
import { DEFAULT_PARAMS, type LaunchParams } from '../../../src/game/params';
import { getCharacter, listCharacters } from '../../../src/game/registry';
import { RING_LANDMARKS } from '../../../src/game/ring/ids';
import { RING } from '../../../src/game/ring/types';
import { BootScene, bootArt, START_ART } from '../../../src/game/scenes/boot';
import { selectRoster } from '../../../src/game/scenes/character-select';
import { FPS_ROUTE, goldenRecordRoute, missionCard, missionLabel, missionNumber } from '../../../src/game/scenes/flow-data';
import { FpsIntroScene, loadFpsContent } from '../../../src/game/scenes/fps-intro';
import { FpsTallyScene } from '../../../src/game/scenes/fps-tally';
import { GameplayScene, JOIN_KEY, startNewGame } from '../../../src/game/scenes/gameplay';
import { BRIDGE_OPENING, bridgeStory, GlitchBridgeScene } from '../../../src/game/scenes/glitch-bridge';
import { missionColumn } from '../../../src/game/scenes/high-scores';
import { MissionCompleteScene } from '../../../src/game/scenes/mission-complete';
import { briefingLines, MissionIntroScene } from '../../../src/game/scenes/mission-intro';
import { RingScene } from '../../../src/game/scenes/ring';
import { expectedDrivers, prepareRing, RING_ART, startRing, startStretch } from '../../../src/game/scenes/ring-route';
import { GameSession } from '../../../src/game/session';
import { aimMask } from '../../../src/sim/bot-ring';
import { runRing } from '../../../src/sim/headless-ring';
import { SimAudio } from '../../../src/sim/stats';

await loadContent();

/** A keyboard stand-in: held codes drive the bound pads, presses feed the raw codes. */
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

/** A software renderer that remembers the text drawn. */
class Recorder extends SoftRenderer {
  texts: string[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    this.texts.push(s);
    super.text(s, x, y, o);
  }
  override sprite(id: string, frame: number, x: number, y: number, o?: DrawOpts): void {
    super.sprite(id, frame, x, y, o);
  }
}

interface H {
  app: GameApp;
  keys: Keys;
  step(n?: number): void;
  until(cls: abstract new (...a: never[]) => unknown, max: number): boolean;
  seen: string[];
}

function harness(params: Partial<LaunchParams> = {}): H {
  const input = new InputManager();
  input.players = params.players ?? 1;
  const keys = new Keys();
  input.addSource(keys);
  const app = createApp({ input, audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS, ...params } });
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

/**
 * Drive a RingScene to its end with F4 (`skip`: stretch by stretch, bosses die) until `cls` is on
 * top; revision R: then the on-foot GameplayScene (F4: section by section, MISSION COMPLETE).
 */
function skipRing(h: H, cls: abstract new (...a: never[]) => unknown, max = 6000): boolean {
  for (let i = 0; i < max; i++) {
    const top = h.app.scenes.top;
    if (top instanceof cls) return true;
    if (top instanceof RingScene && i % 60 === 0 && top.runner.state === 'playing') top.runner.skip();
    if (top instanceof GameplayScene && i % 60 === 0 && top.runner.state === 'playing') top.runner.skip();
    h.step(1);
  }
  return h.app.scenes.top instanceof cls;
}

describe('the route through the ring', () => {
  it('ams completes → its tally (the newspaper) → the ring card (MISSION 2) → RingScene', () => {
    const h = harness({ seed: 77 });
    startNewGame(h.app, { mission: 'ams', section: 'd', characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    let ok = false;
    for (let i = 0; i < 4000 && !ok; i++) {
      if (i % 120 === 0 && game.runner.state === 'playing') game.runner.skip();
      h.step(1);
      ok = h.app.scenes.top instanceof MissionCompleteScene;
    }
    expect(ok).toBe(true);
    expect(h.seen).not.toContain(GlitchBridgeScene.name);
    // The newspaper moves on by itself; the next card is the ring's.
    expect(h.until(MissionIntroScene, 900)).toBe(true);
    const card = h.app.scenes.top as MissionIntroScene;
    expect(card.mission).toBe('ring');
    expect(card.card.label).toBe('MISSION 2');
    expect(card.card.name).toBe('DE RING');
    expect(h.app.campaign!.missions).toEqual(['ams']);
    expect(h.until(RingScene, 500)).toBe(true);
    const ring = h.app.scenes.top as RingScene;
    h.step(2);
    // ?seed= wins: the plan and the runner use it.
    expect(ring.runner.seed).toBe(77);
    expect(ring.runner.plan.seed).toBe(77);
    expect(h.app.session!.missionId).toBe('ring');
    expect(ring.runner.players[0].state).not.toBe('out');
  }, 120000);

  it('the drive hands over to the foot part → the level completes → ONE MISSION COMPLETE page (hostages, fines, the seed) → the bridge → the fps floors', async () => {
    await loadFpsContent(createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore() }));
    const h = harness();
    const scene = startRing(h.app, { characters: ['vincent'], seed: 4242 }) as RingScene;
    expect(h.until(RingScene, 60)).toBe(true);
    expect(h.app.scenes.top).toBe(scene);
    const slot = h.app.session!.slots[0];
    slot.rescued = 2;
    slot.mission.goldenRecord = true;
    scene.runner.fine(0);
    const before = slot.score;
    // Revision R: the drive → the alight → the hand-over (no page) → the foot part → the one page.
    expect(skipRing(h, GameplayScene)).toBe(true);
    expect(h.seen).not.toContain(MissionCompleteScene.name);
    expect(h.app.session!.slots[0].rescued).toBe(2);
    expect(skipRing(h, MissionCompleteScene)).toBe(true);
    expect(h.seen.filter((n) => n === MissionCompleteScene.name)).toHaveLength(1);
    const page = h.app.scenes.top as MissionCompleteScene;
    expect(page.runner.mission.id).toBe('ring');
    expect(page.runner.tallyFooter).toBe('RING SEED 4242');
    expect(page.runner.tallyNotes?.(slot)).toEqual([{ label: 'FINES 1 X 500', points: null, note: '-500' }]);
    // A press shows the whole page and pays it; the page draws the FINES line and the seed.
    h.step(30);
    h.keys.tap('Enter');
    h.step(2);
    const r = new Recorder();
    r.begin();
    page.draw(r);
    r.end();
    expect(r.texts).toContain('FINES 1 X 500');
    expect(r.texts).toContain('-500');
    expect(r.texts).toContain('RING SEED 4242');
    expect(slot.score - before).toBeGreaterThanOrEqual(20000);
    const paid = slot.score;
    // The next press: the bridge freezes the page; it records the clear and pays nothing more.
    h.step(12);
    h.keys.tap('Enter');
    expect(h.until(GlitchBridgeScene, 30)).toBe(true);
    const bridge = h.app.scenes.top as GlitchBridgeScene;
    expect(slot.score).toBe(paid);
    expect(slot.rescued).toBe(0);
    expect(h.app.session!.records.has(AMS_BONUS_KEY)).toBe(false);
    expect(h.app.campaign!.missions).toEqual(['ring']);
    expect(h.app.campaign!.goldenRecords[0].has('ring')).toBe(true);
    // The story card opens with the neutral line (no ams boss any more).
    expect(bridge.lines[0]).toBe(BRIDGE_OPENING);
    for (let i = 0; i < 300 && bridge.phase !== 'card'; i++) h.step(1);
    expect(bridge.phase).toBe('card');
    h.step(61);
    h.keys.tap('Enter');
    h.step(2);
    h.keys.tap('Enter');
    h.step(2);
    expect(h.until(FpsIntroScene, 120)).toBe(true);
    expect((h.app.scenes.top as FpsIntroScene).floor).toBe(1);
    // The floor-1 tally does not pay or show the ring again (it had its own page).
    const run = newFpsRun(h.app.session!, 1);
    const tally = new FpsTallyScene(h.app, run, { floor: 1, ticks: 600, kills: 1, killsTotal: 2, secrets: 0, secretsTotal: 1, treasure: 0, treasureTotal: 1, goldenRecord: false });
    expect(tally.tally.lines.some((l) => l.label.includes('BONUS'))).toBe(false);
    expect(missionBonusOf(h.app.session!.records.get<unknown>(AMS_BONUS_KEY))).toBeUndefined();
  }, 120000);

  it('?mission=ring boots straight into the RingScene (section, seed); its boot art', () => {
    const h = harness({ mission: 'ring', section: 'exit', seed: 99 });
    const boot = new BootScene(h.app);
    // The loading itself is the boot test's; here the dispatch after the gesture.
    (boot as unknown as { finished: boolean }).finished = true;
    h.app.gesture = true;
    boot.update();
    expect(h.until(RingScene, 60)).toBe(true);
    const ring = h.app.scenes.top as RingScene;
    expect(ring.runner.seed).toBe(99);
    const exit = ring.runner.plan.landmarks.find((l) => l.id === 'exit')!;
    expect(ring.runner.planDist).toBeGreaterThanOrEqual(exit.start - RING.runIn);
    const art = bootArt({ mission: 'ring', char: null, mode: undefined }) ?? [];
    expect(art.slice(0, START_ART.length)).toEqual([...START_ART]);
    for (const p of RING_ART) expect(art).toContain(p);
    for (const c of selectRoster()) expect(art).toContain(`char/${c}/`);
  });
});

describe('numbering, the card and the bridge text', () => {
  it('the ring is MISSION 2 and M2 on the route; m1 keeps its old (passive) label', () => {
    expect(FPS_ROUTE).toEqual(['ams', 'ring', 'fps-1', 'fps-2', 'oldenzaal']);
    expect(missionNumber('ring')).toBe(2);
    // The fps floors count as one level (MISSION 3): oldenzaal is MISSION 4 (docs/design/oldenzaal.md §1).
    expect(missionNumber('oldenzaal')).toBe(4);
    expect(missionLabel('ring')).toBe('MISSION 2');
    expect(missionLabel('ams')).toBe('MISSION 1');
    expect(missionLabel('m1')).toBe('MISSION 2');
    const col = (mission: string): string => missionColumn({ name: 'AAA', score: 0, mission, character: '', continues: 0, difficulty: 'normal' });
    expect(['ams', 'ring', 'fps-1', 'fps-2', 'oldenzaal', 'all'].map(col)).toEqual(['M1', 'M2', 'F1', 'F2', 'M4', 'ALL']);
    const c = newCampaign();
    c.missions.push('ams', 'ring');
    expect(goldenRecordRoute(c)).toBe(FPS_ROUTE);
  });

  it('the ring card: MISSION 2, DE RING, an A10 map with its dot, a briefing that fits the radio box', () => {
    const card = missionCard('ring');
    expect(MISSION_CARDS.some((c) => c.id === 'ring')).toBe(true);
    expect(card.label).toBe('MISSION 2');
    expect(card.name).toBe('DE RING');
    expect(card.place).toContain('A10');
    expect(card.briefing.length).toBe(2);
    const lines = briefingLines(card);
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(' ')).toBe(card.briefing.join(' '));
    const [x, y] = card.map!.dot;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(384);
    expect(y).toBeGreaterThan(54);
    expect(y).toBeLessThan(120);
    for (const l of card.map!.lines) for (let i = 1; i < l.length; i += 2) expect(l[i]).toBeLessThan(120);
  });

  it('the bridge story opens with one neutral line; every line fits with the longest callsign', () => {
    const lines = bridgeStory();
    expect(lines[0]).toBe(BRIDGE_OPENING);
    expect(lines.join(' ')).not.toContain('HALSEMA');
    const names = listCharacters().map((id) => getCharacter(id).name);
    for (const l of lines) for (const n of names) expect(measure(l.replace('{CALLSIGN}', n), 'small'), l).toBeLessThanOrEqual(352);
  });
});

describe('seeds', () => {
  it('a fresh seed per play; ?seed= (or a given seed) wins; the plan follows the seed', () => {
    const h = harness();
    const a = prepareRing(h.app);
    const b = prepareRing(h.app);
    expect(a.seed).not.toBe(b.seed);
    expect(a.plan.seed).toBe(a.seed);
    const fixed = harness({ seed: 42 });
    expect(prepareRing(fixed.app).seed).toBe(42);
    expect(prepareRing(fixed.app, { seed: 7 }).seed).toBe(7);
    expect(prepareRing(fixed.app).plan).toEqual(prepareRing(fixed.app).plan);
  });

  it('the seed and the stretch show in the debug overlay', () => {
    const h = harness({ seed: 42 });
    h.app.debug.enabled = true;
    startRing(h.app, { characters: ['vincent'] });
    expect(h.until(RingScene, 60)).toBe(true);
    h.step(3);
    const r = new Recorder();
    r.begin();
    h.app.scenes.draw(r);
    r.end();
    expect(r.texts.some((t) => t.startsWith('SEED 42'))).toBe(true);
  });

  it('a start stretch and the expected drivers match the runner', () => {
    const h = harness({ seed: 5, players: 2 });
    const scene = startRing(h.app, { characters: ['vincent', 'thom'], section: RING_LANDMARKS.at(-1) }) as RingScene;
    expect(h.until(RingScene, 60)).toBe(true);
    const runner = scene.runner;
    const start = { seed: runner.seed, plan: runner.plan, section: RING_LANDMARKS.at(-1) };
    expect(startStretch(start)).toBe(runner.section.id);
    const session = new GameSession({ characters: ['vincent', 'thom'] });
    expect(expectedDrivers(runner.plan, session)).toEqual(runner.drivers);
    expect(runner.drivers[0]).not.toBe(runner.drivers[1]);
    for (const d of runner.drivers) expect(['vincent', 'thom']).not.toContain(d);
  });
});

describe('player 2 on the ring', () => {
  it('the key 2 joins player 2 at any time: a wagon with a driver of its own drives in from the left', () => {
    const h = harness({ seed: 11 });
    const scene = startRing(h.app, { characters: ['vincent'] }) as RingScene;
    expect(h.until(RingScene, 60)).toBe(true);
    // Past the boarding scene (about 150 ticks): P1 is mounted when P2 joins.
    h.step(240);
    const runner = scene.runner;
    expect(runner.players.length).toBe(1);
    expect(runner.player(0)!.state).toBe('mounted');
    const d1 = runner.drivers[0];
    h.keys.tap(JOIN_KEY);
    h.step(2);
    expect(h.app.scenes.top).toBe(scene);
    expect(h.app.input.players).toBe(2);
    expect(h.app.session!.slots[1].joined).toBe(true);
    expect(runner.players.length).toBe(2);
    const p2 = runner.player(1)!;
    expect(p2.state).toBe('spawn');
    const w2 = p2.wagon!;
    expect(w2.screenX).toBeLessThan(RING.startX[1]);
    // A driver of its own: neither P1's driver nor a playing hero.
    const d2 = runner.drivers[1];
    expect(d2).not.toBeNull();
    expect(d2).not.toBe(d1);
    expect([h.app.session!.slots[0].character, h.app.session!.slots[1].character]).not.toContain(d2);
    expect(runner.drivers[0]).toBe(d1);
    h.step(RING.driveInTicks + 5);
    expect(p2.state).toBe('mounted');
    // The HUD's vehicle panel shows both wagons' armour.
    const r = new Recorder();
    r.begin();
    h.app.scenes.draw(r);
    r.end();
    expect(r.texts.filter((t) => t === 'WAGON').length).toBe(2);
  });
});

describe('the ring tools (sim, bot)', () => {
  it('the bot aims along the lane, on the diagonal or straight across', () => {
    const { left: L, right: R, up: U, down: D } = BUTTON_BIT;
    expect(aimMask(100, 0)).toBe(R);
    expect(aimMask(-90, 2)).toBe(L);
    expect(aimMask(60, -22)).toBe(R | U);
    expect(aimMask(-70, 22)).toBe(L | D);
    expect(aimMask(10, -44)).toBe(U);
    expect(aimMask(-5, 30)).toBe(D);
  });

  it('runRing: the ring bot drives from the exit landmark to MISSION COMPLETE (god) with no errors', async () => {
    const r = await runRing({ seed: 2, god: true, bot: true, section: 'exit', loadContent: false, maxTicks: 20000 });
    expect(r.errors).toEqual([]);
    expect(r.complete).toBe(true);
    expect(r.landmarks.at(-1)).toBe('exit');
    expect(r.god).toBe(true);
  });

  it('revision R: P2 joins during the drive and goes on foot with P1; P2 joins on foot (rf-a)', () => {
    // During the drive (the truck's run-in), then the hand-over: both heroes on foot.
    const h = harness({ seed: 11 });
    const scene = startRing(h.app, { characters: ['vincent'], section: 'zwaan' }) as RingScene;
    expect(h.until(RingScene, 60)).toBe(true);
    h.step(240);
    h.keys.tap(JOIN_KEY);
    h.step(RING.driveInTicks + 10);
    expect(scene.runner.players.length).toBe(2);
    scene.runner.handOver();
    expect(h.until(GameplayScene, 200)).toBe(true);
    const foot = h.app.scenes.top as GameplayScene;
    h.step(5);
    expect(foot.runner.section.id).toBe('rf-a');
    expect(foot.runner.players.length).toBe(2);
    expect(h.app.session!.slots[1].joined).toBe(true);

    // On foot: a 1P start at rf-a, then the key 2.
    const g = harness({ seed: 12 });
    const f = startRing(g.app, { characters: ['vincent'], section: 'rf-a' }) as GameplayScene;
    expect(g.until(GameplayScene, 60)).toBe(true);
    g.step(120);
    expect(f.runner.players.length).toBe(1);
    g.keys.tap(JOIN_KEY);
    g.step(120);
    expect(g.app.session!.slots[1].joined).toBe(true);
    expect(f.runner.players.length).toBe(2);
  });
});
