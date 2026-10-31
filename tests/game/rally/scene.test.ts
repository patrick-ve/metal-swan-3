/**
 * The rally's scenes (wave A, INTEGRATE; docs/design/rally.md §1.2, §7.6, §9, §12.2; docs/api/rally.md
 * "A.I"): the glitch into 3D (hold → break → the mosaic → the fold in the RallyScene), the fold's
 * tiles, the HUD texts, the pause menu's camera item, the tally's headline by place, a lost WebGL
 * context (the race waits, then the no-WebGL2 path), the debug teleport and autopilot, and that
 * neither the fold nor the drawing changes the race.
 */
import { describe, expect, it } from 'vitest';
import { InputManager } from '../../../src/engine/input';
import { PixelBuffer } from '../../../src/engine/pixel';
import type { TextOpts } from '../../../src/engine/render';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { NullView3d, PS1_ON, type DrawItem, type Mesh3, type Ps1Opts, type TexturePage, type View3, type View3d, type View3dStats } from '../../../src/engine/view3d';
import { createApp, newCampaign, type GameApp } from '../../../src/game/app';
import { loadContent } from '../../../src/game/content/index';
import { DEFAULT_PARAMS, type LaunchParams } from '../../../src/game/params';
import { INTRO, newCam } from '../../../src/game/rally/camera';
import { RallyRunner } from '../../../src/game/rally/runner';
import { MissionCompleteScene } from '../../../src/game/scenes/mission-complete';
import { PauseScene } from '../../../src/game/scenes/pause';
import { GL_LOST_TICKS, RallyScene } from '../../../src/game/scenes/rally';
import { FOLD_TICKS, FOLD_TILE, foldTiles, RallyFold } from '../../../src/game/scenes/rally-fold';
import { ANNOUNCE_BREAK, BREAK_TICKS, HOLD_MIN, RallyGlitchScene, RallyNoGlScene } from '../../../src/game/scenes/rally-glitch';
import { INTRO_TICKS, INTRO_VOICE_HOLD, MissionIntroScene, RALLY_VOICE_HOLD } from '../../../src/game/scenes/mission-intro';
import { loadRallyContent, prepareRally, RALLY_HEADLINES, rallyHeadline, rallyNoGlTally, rallyTally, startRally } from '../../../src/game/scenes/rally-route';
import { TEAM_NAMES } from '../../../src/game/content/rally/teams/index';
import { GameSession } from '../../../src/game/session';
import { SimAudio } from '../../../src/sim/stats';

await loadContent();
await loadRallyContent();

class Recorder extends SoftRenderer {
  texts: string[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    this.texts.push(s);
    super.text(s, x, y, o);
  }
}

/** A 3D view whose `ok` a test can switch (a lost context). */
class SwitchView implements View3d {
  on = true;
  private readonly inner = new NullView3d();
  get ok(): boolean {
    return this.on;
  }
  get reason(): string {
    return this.on ? '' : 'the WebGL context is lost';
  }
  get density(): number {
    return this.inner.density;
  }
  setDensity(d: 1 | 2 | 4): void {
    this.inner.setDensity(d);
  }
  upload(meshes: readonly Mesh3[], pages: readonly TexturePage[]): void {
    this.inner.upload(meshes, pages);
  }
  release(ids?: readonly string[]): void {
    this.inner.release(ids);
  }
  render(views: readonly View3[], opts: Ps1Opts): unknown {
    return this.on ? this.inner.render(views, opts) : null;
  }
  stats(): View3dStats {
    return this.inner.stats();
  }
  dispose(): void {
    this.inner.dispose();
  }
}

interface H {
  app: GameApp;
  input: InputManager;
  r: Recorder;
  step(n?: number): void;
  until(cls: abstract new (...a: never[]) => unknown, max: number): boolean;
}

/** Wave C: SimAudio that also remembers the engines that sound and can say it is speaking. */
class RecAudio extends SimAudio {
  readonly engines = new Set<string>();
  readonly lines: string[] = [];
  talking = false;
  override engine(key?: string): void {
    if (key) this.engines.add(key);
  }
  override stopEngine(key?: string): void {
    if (key) this.engines.delete(key);
  }
  override voice(line?: string): void {
    super.voice();
    if (line) this.lines.push(line);
  }
  speaking(): boolean {
    return this.talking;
  }
}

function harness(params: Partial<LaunchParams> = {}, view3d: View3d = new NullView3d(), audio: SimAudio = new SimAudio()): H {
  const input = new InputManager();
  input.players = params.players ?? 1;
  const app = createApp({ input, audio, store: new MemoryStore(), params: { ...DEFAULT_PARAMS, ...params }, view3d });
  const r = new Recorder();
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
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
  return { app, input, r, step, until };
}

describe('the glitch into 3D (rally-glitch.ts, rally-fold.ts)', () => {
  it('the tile grid covers every player view exactly (1P one view, 2P two)', () => {
    for (const players of [1, 2]) {
      const tiles = foldTiles(players);
      let area = 0;
      for (const t of tiles) {
        expect(t.w).toBeGreaterThan(0);
        expect(t.w).toBeLessThanOrEqual(FOLD_TILE);
        expect(t.h).toBeLessThanOrEqual(FOLD_TILE);
        area += t.w * t.h;
        // A 2P tile never crosses the split line.
        if (players === 2) expect(t.y < 108 ? t.y + t.h <= 108 : t.view === 1).toBe(true);
      }
      expect(area).toBe(384 * 216);
      expect(new Set(tiles.map((t) => t.view)).size).toBe(players);
    }
  });

  it('RallyFold: the tiles batched into a few dynamic meshes on one page; they start in front of the camera and are all gone by FOLD_TICKS', () => {
    const pic = new PixelBuffer(768, 432).fill(0x204060ff);
    const fold = new RallyFold(pic, 1);
    const n = foldTiles(1).length;
    // A handful of draws (§7.3: about 150 per view): one mesh per view and CLUT row of 64 tiles.
    expect(fold.meshes).toHaveLength(Math.ceil(n / 64));
    expect(fold.meshes.reduce((a, m) => a + m.idx.length / 6, 0)).toBe(n);
    expect(fold.page.clut.length % 256).toBe(0);
    // The average colour of a flat picture is that colour (the first shade = the tile itself).
    expect(fold.page.clut[0]).toBe(0x204060ff);
    for (const m of fold.meshes) {
      expect(m.page).toBe(fold.page.id);
      expect(m.emissive).toBe(true);
      expect(m.dynamic).toBe(true);
      expect(m.pos.length).toBe((m.idx.length / 6) * 12);
    }
    const cam = newCam();
    cam.pos[1] = 2.5;
    const out: DrawItem[] = [];
    const sent: string[] = [];
    const v3 = { updateMesh: (id: string) => void sent.push(id) };
    const n0 = fold.fill(0, 0, cam, 384, 216, out, 0, v3);
    expect(n0).toBe(fold.meshes.length);
    expect(sent).toEqual(fold.meshIds);
    expect(out.every((it) => it.m === null)).toBe(true);
    // Tick 0: every tile on the plane 1 m ahead (+z) of a camera at yaw 0 (world-space vertices).
    const m0 = fold.meshes[0];
    for (let v = 0; v < m0.pos.length / 3; v++) expect(m0.pos[v * 3 + 2]).toBeCloseTo(cam.pos[2] + 1, 3);
    const mid = fold.fill(FOLD_TICKS >> 1, 0, cam, 384, 216, out, 0, v3);
    expect(mid).toBeLessThanOrEqual(n0);
    expect(mid).toBeGreaterThan(0);
    expect(fold.fill(FOLD_TICKS, 0, cam, 384, 216, out, 0, v3)).toBe(0);
    expect(fold.done(FOLD_TICKS)).toBe(true);
    // The other view has no tiles in 1P.
    expect(fold.fill(0, 1, cam, 384, 108, out, 0, v3)).toBe(0);
    // 2P: each view its own batches.
    const two = new RallyFold(pic, 2);
    expect(two.fill(0, 0, cam, 384, 108, out, 0)).toBeGreaterThan(0);
    expect(two.fill(0, 1, cam, 384, 108, out, 0)).toBeGreaterThan(0);
    expect(two.meshes.length).toBeLessThanOrEqual(8);
  });

  it('a direct start: hold → break (the mosaic) → the RallyScene folds first (the race waits), the fly-over (the race waits), then counts down', () => {
    const h = harness({ mission: 'rally', seed: 7 });
    startRally(h.app);
    expect(h.until(RallyGlitchScene, 60)).toBe(true);
    const g = h.app.scenes.top as RallyGlitchScene;
    expect(g.phase).toBe('hold');
    expect(h.until(RallyScene, HOLD_MIN + BREAK_TICKS + 20)).toBe(true);
    // The picture went flat: every tile is one colour.
    const tile = foldTiles(1)[foldTiles(1).length - 30];
    const d = g.work.w / 384;
    const c0 = g.work.data[tile.y * d * g.work.w + tile.x * d];
    for (let y = tile.y * d; y < (tile.y + tile.h) * d; y++) for (let x = tile.x * d; x < (tile.x + tile.w) * d; x++) expect(g.work.data[y * g.work.w + x]).toBe(c0);
    const scene = h.app.scenes.top as RallyScene;
    expect(scene.folding).toBe(true);
    h.step(FOLD_TICKS - 1);
    expect(scene.runner.tick).toBe(0);
    h.step(2);
    expect(scene.folding).toBe(false);
    // The fly-over over the grid (spec §1): the race still waits, the titles show.
    expect(scene.introducing).toBe(true);
    h.step(INTRO.ticks - 2);
    expect(scene.runner.tick).toBe(0);
    h.step(2);
    expect(scene.introducing).toBe(false);
    expect(scene.runner.tick).toBeGreaterThan(0);
  });
});

describe('wave C: the card, the announcer and the race sound in the scenes', () => {
  it('the glitch voices the card\'s announcer line and holds the frozen frame while it speaks (the break on its shout)', () => {
    const audio = new RecAudio();
    audio.talking = true;
    const h = harness({ mission: 'rally', seed: 7 }, new NullView3d(), audio);
    startRally(h.app);
    expect(h.until(RallyGlitchScene, 60)).toBe(true);
    const g = h.app.scenes.top as RallyGlitchScene;
    // Level 3 since the oat wave (docs/design/oat.md §0 #61).
    expect(audio.lines).toEqual(['MISSION THREE. VOL GAS!']);
    h.step(ANNOUNCE_BREAK - 2);
    expect(g.phase).toBe('hold');
    h.step(4);
    expect(g.phase).toBe('break');
    expect(h.until(RallyScene, BREAK_TICKS + 20)).toBe(true);
  });

  it('the MISSION 3 card waits for Gusto\'s second line (RALLY_VOICE_HOLD; the other cards INTRO_VOICE_HOLD)', () => {
    expect(RALLY_VOICE_HOLD).toBeGreaterThan(INTRO_VOICE_HOLD);
    const audio = new RecAudio();
    audio.talking = true;
    const h = harness({ seed: 7 }, new NullView3d(), audio);
    h.app.session = new GameSession({ characters: ['recruit'], seed: 7 });
    h.app.scenes.reset(new MissionIntroScene(h.app, 'rally'));
    h.step(INTRO_TICKS + INTRO_VOICE_HOLD + 10);
    expect(h.app.scenes.top).toBeInstanceOf(MissionIntroScene);
    audio.talking = false;
    h.step(2);
    expect(h.until(RallyGlitchScene, 20)).toBe(true);
  });

  it('the race sound: engines while the race runs (the grid idles too), every engine stops on exit; the countdown beeps and GO once each', () => {
    const audio = new RecAudio();
    const h = harness({ mission: 'rally', seed: 5 }, new NullView3d(), audio);
    h.app.session = new GameSession({ characters: ['recruit'], seed: 5 });
    const scene = new RallyScene(h.app, { start: prepareRally(h.app, { seed: 5 }) });
    h.app.scenes.reset(scene);
    h.step(5);
    expect(audio.engines.size).toBeGreaterThan(0);
    expect(audio.engines.size).toBeLessThanOrEqual(4);
    while (scene.runner.phase === 'grid') h.step(1);
    h.step(30);
    expect(audio.sfxCounts.get('rally/count')).toBe(3);
    expect(audio.sfxCounts.get('rally/go')).toBe(1);
    // Wave B's placeholders are gone (the module plays the flash and the pull-over).
    expect(audio.sfxCounts.get('rally/flash') ?? 0).toBe(0);
    // The race scene leaves (any scene after it): its exit stops every engine.
    h.app.scenes.reset({ update() {}, draw() {} });
    h.step(2);
    expect(audio.engines.size).toBe(0);
  });
});

describe('RallyScene', () => {
  it('the HUD: 1P POSITIE n/8, RONDE n/3, RONDETIJD, KM/H, the countdown; 2P a compact line set per view', () => {
    const one = harness({ mission: 'rally', seed: 3 });
    one.app.session = new GameSession({ characters: ['recruit'], seed: 3 });
    one.app.scenes.reset(new RallyScene(one.app, { start: prepareRally(one.app, { seed: 3 }) }));
    one.step(2);
    const t1 = one.r.texts;
    expect(t1).toContain('POSITIE');
    expect(t1).toContain('6/8');
    expect(t1).toContain('RONDE 1/3');
    expect(t1).toContain('RONDETIJD');
    expect(t1).toContain('KM/H');
    expect(t1).toContain('3');
    const two = harness({ mission: 'rally', seed: 3, players: 2 });
    two.app.session = new GameSession({ characters: ['recruit', 'vincent'], seed: 3 });
    two.app.scenes.reset(new RallyScene(two.app, { start: prepareRally(two.app, { seed: 3 }) }));
    two.step(2);
    const t2 = two.r.texts;
    expect(t2).toContain('P1');
    expect(t2).toContain('P2');
    expect(t2.filter((s) => s.startsWith('POSITIE ')).length).toBe(2);
    expect(t2.filter((s) => s.endsWith(' KM/H')).length).toBe(2);
  });

  it('the pause menu has the camera item (both views switch); the results show UITSLAG with every car', () => {
    const h = harness({ mission: 'rally', seed: 3, debug: true });
    h.app.session = new GameSession({ characters: ['recruit'], seed: 3 });
    const scene = new RallyScene(h.app, { start: prepareRally(h.app, { seed: 3 }) });
    h.app.scenes.reset(scene);
    h.step(2);
    const extra = scene.pauseExtra();
    expect(extra?.label).toBe('CAMERA: CHASE');
    extra!.act();
    expect(scene.runner.cams).toEqual(['bumper', 'bumper']);
    expect(scene.pauseExtra()?.label).toBe('CAMERA: BUMPER');
    const pause = new PauseScene(h.app, scene);
    expect(pause.selected).toBe('RESUME');
    h.app.scenes.push(pause);
    h.step(1);
    expect(h.r.texts).toContain('CAMERA: BUMPER');
    h.app.scenes.pop();
    scene.runner.finishNow();
    h.step(5);
    expect(h.r.texts).toContain('UITSLAG');
    // FIELD's rally teams: every one of the seven on the results.
    for (const name of TEAM_NAMES) expect(h.r.texts).toContain(name);
  });

  it('a lost WebGL context: the race waits; back within GL_LOST_TICKS it goes on, else the no-WebGL2 path', () => {
    const view = new SwitchView();
    const h = harness({ mission: 'rally', seed: 3 }, view);
    h.app.session = new GameSession({ characters: ['recruit'], seed: 3 });
    const scene = new RallyScene(h.app, { start: prepareRally(h.app, { seed: 3 }) });
    h.app.scenes.reset(scene);
    h.step(10);
    const tick = scene.runner.tick;
    view.on = false;
    h.step(60);
    expect(scene.runner.tick).toBe(tick);
    expect(h.r.texts).toContain('THE 3D VIEW WAS LOST');
    view.on = true;
    h.step(5);
    expect(scene.runner.tick).toBe(tick + 5);
    view.on = false;
    // GL_LOST_TICKS, then the scene change's fade.
    expect(h.until(RallyNoGlScene, GL_LOST_TICKS + 40)).toBe(true);
    expect(h.until(MissionCompleteScene, 400)).toBe(true);
  });

  it('the tally headline follows the best player place (spec §1.1)', () => {
    expect(rallyHeadline(1)).toBe(RALLY_HEADLINES.win);
    expect(rallyHeadline(2)).toBe(RALLY_HEADLINES.podium);
    expect(rallyHeadline(3)).toBe(RALLY_HEADLINES.podium);
    expect(rallyHeadline(4)).toBe(RALLY_HEADLINES.rest);
    expect(rallyHeadline(8)).toBe(RALLY_HEADLINES.rest);
    // The no-WebGL2 page judges nobody: the default stars, a neutral headline.
    const off = rallyNoGlTally(new GameSession({ characters: ['recruit'], seed: 1 }), 1);
    expect(off.tallyStars).toBeUndefined();
    expect(off.tallyHeadline).toBe(RALLY_HEADLINES.off);
    const s = new GameSession({ characters: ['recruit'], seed: 3 });
    const input = new InputManager();
    const runner = new RallyRunner({ seed: 3, difficulty: 'normal', players: 1, session: s, pads: [input.pad(0), input.pad(1)] });
    runner.placeCar(0, -40);
    runner.finishNow();
    const place = runner.carOf(0)!.place;
    expect(rallyTally(runner).tallyHeadline).toBe(rallyHeadline(place));
  });

  it('the debug teleport and autopilot: placeCar puts the car on the lap, the autopilot drives it (never on by itself)', () => {
    const s = new GameSession({ characters: ['recruit'], seed: 3 });
    const input = new InputManager();
    const runner = new RallyRunner({ seed: 3, difficulty: 'normal', players: 1, session: s, pads: [input.pad(0), input.pad(1)] });
    expect(runner.autopilot).toEqual([false, false]);
    for (let i = 0; i < 200; i++) runner.step();
    const L = runner.track.length;
    runner.placeCar(0, L + 500, 40);
    const car = runner.carOf(0)!;
    expect(car.lap).toBe(2);
    expect(car.dist).toBe(L + 500);
    runner.setAutopilot(0, true);
    for (let i = 0; i < 300; i++) runner.step();
    // 5 s from 40 m/s on: about 200 m (a standing car would not move).
    expect(car.dist).toBeGreaterThan(L + 500 + 150);
    expect(car.phys.scrapes).toBe(0);
  });

  it('the fold and the drawing never change the race (the same state hash as a race with neither)', () => {
    const run = (fold: boolean, draw: boolean): number => {
      const h = harness({ mission: 'rally', seed: 11 });
      h.app.session = new GameSession({ characters: ['recruit'], seed: 11 });
      h.app.campaign = newCampaign();
      const pic = fold ? new PixelBuffer(768, 432).fill(0x000000ff) : null;
      const scene = new RallyScene(h.app, { start: prepareRally(h.app, { seed: 11 }), fold: pic });
      h.app.scenes.reset(scene);
      for (let i = 0; i < (fold ? FOLD_TICKS + INTRO.ticks : 0) + 600; i++) {
        h.input.update();
        h.app.scenes.update();
        if (draw && i % 7 === 0) {
          h.r.begin();
          h.app.scenes.draw(h.r);
          h.r.end();
        }
      }
      return scene.runner.stateHash();
    };
    const plain = run(false, false);
    expect(run(true, true)).toBe(plain);
    expect(run(false, true)).toBe(plain);
  });
});

describe('the views', () => {
  it('PS1_ON is the game default (all four traits)', () => {
    expect(PS1_ON).toEqual({ snap: true, affine: true, dither: true, fog: true });
    const v: View3 = { x: 0, y: 0, w: 384, h: 216, cam: newCam(), light: { sunDir: [0, 1, 0], sun: [1, 1, 1], ambient: [0.5, 0.5, 0.5], fog: [1, 1, 1], fogNear: 1, fogFar: 2, skyTop: [0, 0, 1], skyBottom: [1, 1, 1] }, items: [] };
    expect(new NullView3d().render([v], PS1_ON)).toBeNull();
  });
});
