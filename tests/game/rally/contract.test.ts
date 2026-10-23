/**
 * The rally's wave-A contracts (docs/design/rally.md §12; docs/api/rally.md "A. Wave A
 * contracts"): the 3D API and NullView3d, the lazy content and the registry (the track, the
 * models, the texture pages), the race runner (determinism, F4, 2P join), the tally hook, the
 * flow (the card, the glitch into 3D, the race, the tally, the bridge, the no-WebGL2 path), the
 * params, the route numbering, and the determinism scan of the sim folders.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InputManager, keySetFor, maskFromKeys, type InputContext, type InputSource, type PlayerSlot } from '../../../src/engine/input';
import type { TextOpts } from '../../../src/engine/render';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { NullView3d } from '../../../src/engine/view3d';
import { createApp, newCampaign, type GameApp } from '../../../src/game/app';
import { CONTENT_MODULES, isFpsContent, isLazyContent, isRallyContent, loadContent } from '../../../src/game/content/index';
import { pageToPixels, PageBuilder, ramp } from '../../../src/game/content/rally/tex/kit';
import { newFpsRun } from '../../../src/game/fps/run';
import { DEFAULT_PARAMS, parseLaunchParams, type LaunchParams } from '../../../src/game/params';
import { LEVEL2_SEED_KEY, RALLY_ID, RALLY_MODEL } from '../../../src/game/rally/ids';
import { listRallyModels, rallyModel, rallyTrack } from '../../../src/game/rally/registry';
import { FINISH_HOLD, RallyRunner } from '../../../src/game/rally/runner';
import { FPS_ROUTE, goldenRecordRoute, missionCard, missionLabel } from '../../../src/game/scenes/flow-data';
import { loadFpsContent } from '../../../src/game/scenes/fps-intro';
import { FpsTallyScene } from '../../../src/game/scenes/fps-tally';
import { GlitchBridgeScene } from '../../../src/game/scenes/glitch-bridge';
import { missionColumn } from '../../../src/game/scenes/high-scores';
import { MissionCompleteScene, tallyLines } from '../../../src/game/scenes/mission-complete';
import { briefingLines, MissionIntroScene } from '../../../src/game/scenes/mission-intro';
import { RallyScene } from '../../../src/game/scenes/rally';
import { RallyGlitchScene, RallyNoGlScene } from '../../../src/game/scenes/rally-glitch';
import { FOLD_TICKS } from '../../../src/game/scenes/rally-fold';
import { isRally, loadRallyContent, prepareRally, rallyProbe, rallyTally, startRally } from '../../../src/game/scenes/rally-route';
import { GameSession } from '../../../src/game/session';
import { createHeadlessRally, runRally } from '../../../src/sim/headless-rally';
import { SimAudio } from '../../../src/sim/stats';

await loadContent();
await loadRallyContent();

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

class Recorder extends SoftRenderer {
  texts: string[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    this.texts.push(s);
    super.text(s, x, y, o);
  }
}

interface H {
  app: GameApp;
  keys: Keys;
  r: Recorder;
  step(n?: number): void;
  until(cls: abstract new (...a: never[]) => unknown, max: number): boolean;
  seen: string[];
}

function harness(params: Partial<LaunchParams> = {}, view3d = new NullView3d()): H {
  const input = new InputManager();
  input.players = params.players ?? 1;
  const keys = new Keys();
  input.addSource(keys);
  const app = createApp({ input, audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS, ...params }, view3d });
  const r = new Recorder();
  const seen: string[] = [];
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
      const name = app.scenes.top?.constructor.name ?? 'none';
      if (seen[seen.length - 1] !== name) seen.push(name);
    }
    r.texts.length = 0;
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
  return { app, keys, r, step, until, seen };
}

describe('the 3D API (engine/view3d.ts)', () => {
  it('NullView3d: ok by default (headless races run), or a no-3D stand-in with a reason; it keeps uploads', () => {
    const v = new NullView3d();
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('');
    const off = new NullView3d(false, 'no WebGL2');
    expect(off.ok).toBe(false);
    expect(off.reason).toBe('no WebGL2');
    const t = rallyTrack();
    const first = t.meshes[0].id;
    v.upload(t.meshes, t.pages);
    expect(v.hasMesh(first)).toBe(true);
    expect(v.stats().bufBytes).toBeGreaterThan(0);
    expect(v.render([], { snap: true, affine: true, dither: true, fog: true })).toBeNull();
    v.setDensity(4);
    expect(v.density).toBe(4);
    v.release();
    expect(v.hasMesh(first)).toBe(false);
  });
});

describe('the lazy content and the registry', () => {
  it('the rally content is lazy (skipped at boot, not in the fps loader of the future)', () => {
    expect(CONTENT_MODULES.rally).toBeDefined();
    expect(isLazyContent('rally')).toBe(true);
    expect(isRallyContent('rally/x')).toBe(true);
    expect(isFpsContent('rally')).toBe(false);
    expect(isLazyContent('fps/floors')).toBe(true);
  });

  it('the track: a closed spline, 8 grid slots behind the line, valid meshes on ≤ 256² pages', () => {
    const t = rallyTrack();
    expect(t.length).toBeCloseTo(t.spline.length, 9);
    expect(t.length).toBeGreaterThan(500);
    expect(t.grid).toHaveLength(8);
    expect(t.halfWidth).toBeGreaterThan(4);
    expect(t.parLapTicks).toBeGreaterThan(0);
    const pages = new Map(t.pages.map((p) => [p.id, p]));
    let tris = 0;
    for (const m of t.meshes) {
      const n = m.pos.length / 3;
      expect(m.uv.length, m.id).toBe(n * 2);
      expect(m.rgb.length, m.id).toBe(n * 3);
      expect(m.idx.length % 3, m.id).toBe(0);
      for (const i of m.idx) expect(i).toBeLessThan(n);
      const p = pages.get(m.page)!;
      expect(p, m.id).toBeDefined();
      expect(m.clutRow).toBeLessThan(p.clut.length / 256);
      tris += m.idx.length / 3;
    }
    for (const p of t.pages) {
      expect(p.w).toBeLessThanOrEqual(256);
      expect(p.h).toBeLessThanOrEqual(256);
      expect(p.index.length).toBe(p.w * p.h);
      expect(p.clut.length % 256).toBe(0);
    }
    // The whole track is far over a view's budget (spec §7.3): the per-view budget is the culler's
    // (TRACK's tests/content/rally-track.test.ts). Every item draws a mesh of the track.
    expect(tris).toBeGreaterThan(0);
    expect(t.items.length).toBeLessThanOrEqual(t.meshes.length);
    const ids = new Set(t.meshes.map((m) => m.id));
    for (const it of t.items) expect(ids.has(it.mesh), it.mesh).toBe(true);
  });

  it('a model for every RALLY_MODEL id (CARS\' models)', () => {
    for (const id of Object.values(RALLY_MODEL)) {
      const m = rallyModel(id);
      expect(m, id).not.toBeNull();
      expect(m!.parts.length).toBeGreaterThan(0);
      expect(m!.tris).toBeGreaterThan(0);
      for (const part of m!.parts) expect(m!.meshes.some((x) => x.id === part)).toBe(true);
    }
    expect(listRallyModels()).toEqual(Object.values(RALLY_MODEL).sort());
  });

  it('the texture kit: shelf allocation, ≤ 16-colour rows from the PAL_HD ramps, lettering, the PNG helper', () => {
    const b = new PageBuilder(7, 64, 32);
    const row = b.addRow(ramp('stone', 0, 3));
    const a = b.alloc(40, 10)!;
    const c = b.alloc(40, 10)!;
    expect(c.y).toBe(10);
    expect(b.alloc(80, 4)).toBeNull();
    b.fill(a, 1);
    b.text(a, 'A10', 1, 1, 3);
    const page = b.build();
    expect(page.clut.length).toBe(256);
    const px = pageToPixels(page, row);
    expect(px.data[0]).toBe(ramp('stone', 1, 1)[0] >>> 0);
    expect([...page.index].some((v) => v === 3)).toBe(true);
  });
});

describe('the race (rally/runner.ts) and the sim', () => {
  it('runs to the end deterministically (the same seed → the same report); drawing never changes the hash', async () => {
    const a = await runRally({ seed: 5 });
    const b = await runRally({ seed: 5 });
    expect(a.complete).toBe(true);
    expect(a.errors).toEqual([]);
    expect(a.places[0]).toBeGreaterThan(0);
    expect(a.lapTicks[0]).toHaveLength(3);
    const { timing: _t1, ...ra } = a;
    const { timing: _t2, ...rb } = b;
    expect(ra).toEqual(rb);
    const h = await createHeadlessRally({ seed: 5 });
    for (let i = 0; i < 3000 && !h.done; i++) {
      h.step(1);
      if (i % 97 === 0) h.renderFrame();
    }
    // The race on the A10 takes about 24,000 ticks (headless-rally's sims).
    h.runUntil((x) => x.done, 60000);
    expect(h.report().stateHash).toBe(a.stateHash);
    h.dispose();
  });

  it('2P: two estates (white P1, green P2), both placed', async () => {
    const r = await runRally({ seed: 1, players: 2 });
    expect(r.complete).toBe(true);
    expect(r.players).toBe(2);
    expect(r.places.every((p) => p > 0)).toBe(true);
    expect(new Set(r.places).size).toBe(2);
  });

  it('finishNow (debug F4): places by the current order, projected times, then the results and complete', () => {
    const s = new GameSession({ characters: ['recruit'], seed: 3 });
    const input = new InputManager();
    const runner = new RallyRunner({ seed: 3, difficulty: 'normal', players: 1, session: s, pads: [input.pad(0), input.pad(1)] });
    runner.start();
    for (let i = 0; i < 400; i++) runner.step();
    const order = runner.race.order.map((c) => c.id);
    runner.finishNow();
    expect(runner.phase).toBe('finish');
    expect(runner.race.order.map((c) => c.id)).toEqual(order);
    const times = runner.race.order.map((c) => c.finishTicks);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    expect(runner.cars.every((c) => c.finished && c.projected)).toBe(true);
    let done = false;
    runner.events.on('complete', () => (done = true));
    for (let i = 0; i < FINISH_HOLD && !done; i++) runner.step();
    expect(done).toBe(true);
    expect(s.completed).toContain(RALLY_ID);
    expect(s.missionId).toBe(RALLY_ID);
  });

  it('player 2 joins during the race: the green estate behind the last car', () => {
    const s = new GameSession({ characters: ['recruit'], seed: 3 });
    const input = new InputManager();
    const runner = new RallyRunner({ seed: 3, difficulty: 'normal', players: 1, session: s, pads: [input.pad(0), input.pad(1)] });
    for (let i = 0; i < 500; i++) runner.step();
    const last = Math.min(...runner.cars.map((c) => c.dist));
    const car = runner.joinPlayer(1, 'vincent')!;
    expect(car.spec.model).toBe(RALLY_MODEL.green);
    expect(car.dist).toBeLessThan(last);
    expect(s.slots[1].joined).toBe(true);
    expect(runner.players.map((p) => p.index)).toEqual([0, 1]);
  });
});

describe('the tally hook (TallyRunner.tallyLines)', () => {
  it("the rally's page: PLACE and TIME instead of the bonus lines; the stars by place; absent = unchanged", () => {
    const s = new GameSession({ characters: ['recruit'], seed: 2 });
    const input = new InputManager();
    const runner = new RallyRunner({ seed: 2, difficulty: 'normal', players: 1, session: s, pads: [input.pad(0), input.pad(1)] });
    runner.start();
    runner.finishNow();
    const nr = rallyTally(runner);
    const t = tallyLines(nr, s, s.slots[0]);
    expect(t.lines.map((l) => l.label.split(' ')[0])).toEqual(['PLACE', 'TIME']);
    expect(t.raw).toBe(t.lines.reduce((a, l) => a + (l.points ?? 0), 0));
    expect(t.stars).toBe(runner.raceStars(0));
    const plain = tallyLines({ session: s, mission: { id: 'ams' } }, s, s.slots[0]);
    expect(plain.lines.some((l) => l.label === 'FLAWLESS PERFORMANCE')).toBe(true);
  });
});

describe('the flow: card → glitch into 3D → race → tally → bridge', () => {
  it('the route numbering: rally is MISSION 2 / M2; the dormant ring is RING / RIN', () => {
    expect(FPS_ROUTE).toEqual(['ams', 'rally', 'fps-1', 'fps-2', 'oldenzaal']);
    expect(missionLabel('rally')).toBe('MISSION 2');
    expect(missionLabel('ring')).toBe('RING');
    const col = (mission: string): string => missionColumn({ name: 'AAA', score: 0, mission, character: '', continues: 0, difficulty: 'normal' });
    expect(['ams', 'rally', 'fps-1', 'oldenzaal', 'ring'].map(col)).toEqual(['M1', 'M2', 'F1', 'M4', 'RIN']);
    const c = newCampaign();
    c.missions.push('ams', 'rally');
    expect(goldenRecordRoute(c)).toBe(FPS_ROUTE);
    expect(isRally('rally')).toBe(true);
  });

  it('the card: MISSION 2, BINNEN DE RING (no question mark), the briefing fits the radio box', () => {
    const card = missionCard('rally');
    expect(card.label).toBe('MISSION 2');
    expect(card.name).toBe('BINNEN DE RING');
    expect(card.briefing).toHaveLength(2);
    const lines = briefingLines(card);
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(' ')).toBe(card.briefing.join(' '));
    expect(card.headline).toBe('SQUAD WINS DE RINGRALLY! PERMIT SECURED!');
  });

  it('the params: lap, cam, gl=0', () => {
    expect(parseLaunchParams('?mission=rally&lap=2&cam=bumper&gl=0')).toMatchObject({ mission: 'rally', lap: 2, cam: 'bumper', gl: false });
    const p = parseLaunchParams('?mission=rally&lap=9&cam=x');
    expect(p.lap).toBeUndefined();
    expect(p.cam).toBeUndefined();
    expect(p.gl).toBeUndefined();
  });

  it('ams → the MISSION 2 card → the glitch → the race; F4 → the tally (race lines, seed) → the bridge; floor 1 shows the seed', async () => {
    await loadFpsContent(createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore() }));
    const h = harness({ seed: 4321, debug: true });
    h.app.session = new GameSession({ characters: ['vincent'], seed: 4321 });
    h.app.campaign = newCampaign();
    h.app.campaign.missions.push('ams');
    h.app.scenes.reset(new MissionIntroScene(h.app, 'rally'));
    h.step(2);
    const card = h.app.scenes.top as MissionIntroScene;
    expect(card.card.name).toBe('BINNEN DE RING');
    expect(h.until(RallyGlitchScene, 700)).toBe(true);
    expect(h.until(RallyScene, 200)).toBe(true);
    const scene = h.app.scenes.top as RallyScene;
    expect(scene.runner.seed).toBe(4321);
    // The glitch's fold first (the race waits), then the countdown.
    expect(scene.folding).toBe(true);
    h.step(FOLD_TICKS);
    expect(scene.folding).toBe(false);
    expect(scene.runner.tick).toBe(0);
    h.step(10);
    expect(scene.runner.tick).toBe(10);
    expect(rallyProbe(h.app)).toMatchObject({ gl: { ok: true }, scene: 'RallyScene', players: 1 });
    // The HUD draws (the 3D view is the renderer's placeholder in node).
    expect(h.r.texts.some((t) => t.startsWith('POSITIE'))).toBe(true);
    scene.runner.finishNow(); // what debug F4 ('skip') calls
    expect(h.until(MissionCompleteScene, 400)).toBe(true);
    const page = h.app.scenes.top as MissionCompleteScene;
    expect(page.runner.mission.id).toBe(RALLY_ID);
    expect(page.runner.tallyFooter).toBe('RALLY SEED 4321');
    h.step(30);
    h.keys.tap('Enter');
    h.step(2);
    expect(h.r.texts.some((t) => t.startsWith('PLACE'))).toBe(true);
    h.step(12);
    h.keys.tap('Enter');
    expect(h.until(GlitchBridgeScene, 60)).toBe(true);
    expect(h.app.campaign.missions).toEqual(['ams', 'rally']);
    expect(h.app.session.records.get<{ seed: number }>(LEVEL2_SEED_KEY)?.seed).toBe(4321);
    const tally = new FpsTallyScene(h.app, newFpsRun(h.app.session, 1), { floor: 1, ticks: 600, kills: 1, killsTotal: 2, secrets: 0, secretsTotal: 1, treasure: 0, treasureTotal: 1, goldenRecord: false });
    expect(tally.seed).toBe(4321);
  }, 120000);

  it('?mission=rally starts the race straight away (no card); ?gl=0 takes the no-WebGL2 path to the tally and the bridge', () => {
    const h = harness({ mission: 'rally', seed: 9 });
    startRally(h.app);
    expect(h.until(RallyScene, 300)).toBe(true);
    expect(h.app.session!.slots.filter((s) => s.joined)).toHaveLength(1);
    const g = harness({ mission: 'rally', seed: 9, gl: false });
    startRally(g.app);
    expect(g.until(RallyNoGlScene, 300)).toBe(true);
    g.step(2);
    expect(g.r.texts).toContain('THIS DEVICE CANNOT SHOW 3D');
    expect(g.until(MissionCompleteScene, 400)).toBe(true);
    const page = g.app.scenes.top as MissionCompleteScene;
    expect(page.runner.mission.id).toBe(RALLY_ID);
    expect(page.runner.tallyLines?.(g.app.session!.slots[0])).toEqual([]);
    for (let i = 0; i < 900 && !(g.app.scenes.top instanceof GlitchBridgeScene); i++) g.step(1);
    expect(g.app.scenes.top).toBeInstanceOf(GlitchBridgeScene);
    // A device without WebGL2 (the view says no) takes the same path.
    const n = harness({ mission: 'rally', seed: 9 }, new NullView3d(false, 'no WebGL2'));
    startRally(n.app);
    expect(n.until(RallyNoGlScene, 300)).toBe(true);
  });

  it('prepareRally: ?seed= wins, a fresh seed otherwise; lap and cam pass through', () => {
    const h = harness({ seed: 42, lap: 2, cam: 'bumper' });
    expect(prepareRally(h.app)).toMatchObject({ seed: 42, lap: 2, cam: 'bumper', players: 1 });
    const f = harness();
    expect(prepareRally(f.app).seed).not.toBe(prepareRally(f.app).seed);
  });
});

describe('determinism scan (spec §12.4): the sim folders use no banned Math / clock names', () => {
  const ROOT = join(import.meta.dirname, '../../..');
  const DIRS = ['src/game/rally', 'src/engine/r3', 'src/game/content/rally', 'src/sim/bot-rally.ts', 'src/engine/race-input.ts'];
  const BANNED = /\bMath\.(sin|cos|tan|atan2|atan|asin|acos|exp|log|log2|log10|pow|hypot|random|cbrt|expm1|log1p|sinh|cosh|tanh)\b|\bDate\b|\bperformance\b/;
  const files = (dir: string): string[] =>
    dir.endsWith('.ts')
      ? [dir]
      : readdirSync(join(ROOT, dir)).flatMap((f) => {
          const p = join(dir, f);
          return statSync(join(ROOT, p)).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
        });
  it.each(DIRS)('%s', (dir) => {
    const list = files(dir);
    expect(list.length).toBeGreaterThan(0);
    for (const f of list) {
      const code = readFileSync(join(ROOT, f), 'utf8')
        .split('\n')
        // Comments and lines marked `determinism-ok` (the trig table's one-time build) do not count.
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l) && !l.includes('determinism-ok'))
        .join('\n');
      expect(BANNED.exec(code)?.[0] ?? null, f).toBeNull();
    }
  });
});
