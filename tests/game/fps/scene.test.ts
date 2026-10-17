import { describe, expect, it } from 'vitest';
import { MAGENTA } from '../../../src/engine/color';
import { InputManager } from '../../../src/engine/input';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { MemoryStore } from '../../../src/engine/storage';
import { createApp } from '../../../src/game/app';
import { MODE_TITLE } from '../../../src/game/content/fps/names';
import { DYING_TICKS, ELEVATOR_TICKS } from '../../../src/game/fps/game';
import { reserveLives } from '../../../src/game/fps/run';
import { FpsScene, LOOK_HINT_TICKS, RESTART_CARD_TICKS } from '../../../src/game/scenes/fps';
import { CARD_AUTO, FpsIntroScene, fpsLoadState, loadFpsContent } from '../../../src/game/scenes/fps-intro';
import { ContinueScene } from '../../../src/game/scenes/continue';
import { PauseScene } from '../../../src/game/scenes/pause';
import { TitleScene } from '../../../src/game/scenes/title';
import { GameSession } from '../../../src/game/session';
import { createHeadlessFps } from '../../../src/sim/headless-fps';
import { SimAudio } from '../../../src/sim/stats';

function magenta(buf: { data: Uint32Array }): number {
  let n = 0;
  for (let i = 0; i < buf.data.length; i++) if (buf.data[i] >>> 0 === MAGENTA) n++;
  return n;
}

describe('FpsScene (headless)', () => {
  it('starts, turns the fps input on and draws the floor without magenta', async () => {
    const h = await createHeadlessFps({ floor: 0, seed: 1 });
    expect(h.scene).toBeInstanceOf(FpsScene);
    expect(h.app.input.fpsMode).toBe(true);
    expect(h.app.pointerLockWanted).toBe(true);
    for (const pose of [[1.5, 5.5, 0], [4, 5.5, 180], [4, 4, 270], [11, 3, 270], [16.5, 8, 270], [6, 9, 180]] as const) {
      h.setPose(pose[0], pose[1], pose[2]);
      h.step(1);
      const frame = h.renderFrame();
      expect(magenta(frame), `pose ${pose.join(',')}`).toBe(0);
    }
    const r = h.report();
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w) => w.includes('unknown texture') || w.includes('unknown billboard'))).toEqual([]);
    h.dispose();
  });

  it('pauses on focus loss with the fps input off, and turns it back on at resume', async () => {
    const h = await createHeadlessFps({ floor: 0 });
    h.app.focusLost = true;
    h.step(1);
    expect(h.app.scenes.top).toBeInstanceOf(PauseScene);
    expect(h.app.input.fpsMode).toBe(false);
    expect(h.app.pointerLockWanted).toBe(false);
    expect(h.app.focusLost).toBe(false);
    h.renderFrame(); // the pause overlay draws over the frozen view
    h.app.scenes.pop();
    expect(h.app.scenes.top).toBe(h.scene);
    expect(h.app.input.fpsMode).toBe(true);
    expect(h.app.pointerLockWanted).toBe(true);
    h.dispose();
  });

  it('a death costs a life, shows the restart card and restarts the floor with the start score', async () => {
    const h = await createHeadlessFps({ floor: 0, input: { actions: () => 1 } });
    const g = h.game!;
    const slot = h.session.slots[0];
    const lives = slot.lives;
    h.step(20);
    slot.score = 1234;
    g.hurt(500, g.player.x + 1, g.player.y);
    expect(g.state).toBe('dying');
    h.step(DYING_TICKS);
    expect(slot.lives).toBe(lives - 1);
    expect(g.state).toBe('play');
    expect(g.tick).toBe(0);
    expect(slot.score).toBe(h.run.floorStartScore);
    expect([g.player.x, g.player.y, g.player.hp]).toEqual([1.5, 5.5, 100]);
    h.step(RESTART_CARD_TICKS);
    expect(g.tick).toBe(0);
    h.step(40);
    expect(g.tick).toBe(40);
    expect(g.player.x).toBeGreaterThan(1.5); // a direction held through the card moves after the unfold
    h.dispose();
  });

  it('every fps screen shows the 2D life count: reserve lives (spec §4.13)', async () => {
    const h = await createHeadlessFps({ floor: 0 });
    const slot = h.session.slots[0];
    expect(slot.lives).toBe(3);
    expect(reserveLives(slot)).toBe(2);
    const texts: string[] = [];
    const r = h.renderer;
    const text = r.text.bind(r);
    r.text = ((s: string, ...rest: unknown[]) => {
      texts.push(s);
      return (text as (...a: unknown[]) => unknown)(s, ...rest);
    }) as typeof r.text;
    h.renderFrame();
    expect(texts).toContain('X2');
    expect(texts).not.toContain('X3');
    // The restart card after a death: LIVES 1 (2 lives left in the slot).
    h.game!.hurt(500);
    h.step(DYING_TICKS);
    expect(slot.lives).toBe(2);
    texts.length = 0;
    h.renderFrame();
    expect(texts).toContain('LIVES 1');
    // The floor card.
    const intro = new FpsIntroScene(h.app, { floor: 1, run: h.run });
    texts.length = 0;
    intro.draw(r);
    expect(texts).toContain('LIVES 1');
    r.text = text;
    h.dispose();
  });

  it('the waiting slot cannot act on the continue screen (spec §1.10)', async () => {
    const h = await createHeadlessFps({ floor: 0 });
    const scene = h.scene as FpsScene;
    expect(scene.acceptsSlot(0)).toBe(true);
    expect(scene.acceptsSlot(1)).toBe(false);
    h.dispose();
  });

  it('the CLICK TO LOOK hint comes back after a resume and hides under a subtitle', async () => {
    const h = await createHeadlessFps({ floor: 0 });
    const scene = h.scene as FpsScene;
    h.app.settings.mouseLook = true;
    let seen = false;
    for (let t = 0; t < 60 && !seen; t++) {
      h.step(1);
      seen = scene.lookHintOn();
    }
    expect(seen).toBe(true);
    h.step(LOOK_HINT_TICKS);
    expect(scene.lookHintOn()).toBe(false);
    scene.pause();
    scene.resume();
    seen = false;
    for (let t = 0; t < 60 && !seen; t++) {
      h.step(1);
      seen = scene.lookHintOn();
    }
    expect(seen).toBe(true);
    // Never over a taunt subtitle.
    h.game!.subtitle.text = 'IK BEN MECHA HOFMANS!';
    h.game!.subtitle.ticks = 200;
    for (let t = 0; t < 60; t++) {
      h.step(1);
      expect(scene.lookHintOn()).toBe(false);
    }
    h.dispose();
  });

  it('the last life goes to the continue screen (group flow, spec §1.10)', async () => {
    const h = await createHeadlessFps({ floor: 0 });
    const slot = h.session.slots[0];
    slot.lives = 1;
    h.game!.hurt(500);
    h.step(DYING_TICKS);
    expect(slot.gameOver).toBe(true);
    expect(h.app.scenes.top).toBeInstanceOf(ContinueScene);
    expect(h.app.input.fpsMode).toBe(false);
    h.dispose();
  });

  it('the elevator ends the floor; floor 0 then goes back to the title after its tally', async () => {
    const h = await createHeadlessFps({ floor: 0 });
    h.game!.useElevator();
    h.step(ELEVATOR_TICKS + 1);
    expect(h.complete).toBe(true);
    expect(h.run.results).toHaveLength(1);
    // Floor 0 holds the four treasures and the golden record (group actors, spec §6.0).
    expect(h.run.results[0]).toMatchObject({ floor: 0, secretsTotal: 1, treasureTotal: 5, goldenRecord: false });
    expect(h.run.carry).toMatchObject({ hp: 100, ammo: 8 });
    // The floor tally moves on by itself (spec §1.8: 600 ticks), then floor 0 goes to the title.
    expect(h.runUntil((x) => x.app.scenes.top instanceof TitleScene, 1200)).toBe(true);
    h.dispose();
  });
});

describe('FpsIntroScene', () => {
  it('shows the floor card after the load and starts the floor', async () => {
    const input = new InputManager();
    const app = createApp({ input, audio: new SimAudio(), store: new MemoryStore() });
    app.session = new GameSession({ characters: ['recruit'] });
    await loadFpsContent(app);
    expect(fpsLoadState()).toMatchObject({ registered: true, ready: true, frac: 1 });
    const intro = new FpsIntroScene(app, { floor: 0 });
    app.scenes.reset(intro);
    const r = new SoftRenderer();
    r.begin();
    app.scenes.draw(r);
    r.end();
    expect(magenta(r.target)).toBe(0);
    expect(MODE_TITLE).toBe('OPERATION OSTIA');
    for (let t = 0; t < CARD_AUTO + 30 && !(app.scenes.top instanceof FpsScene); t++) {
      input.update();
      app.scenes.update();
    }
    expect(app.scenes.top).toBeInstanceOf(FpsScene);
    expect(app.session.missionId).toBe('fps-0');
    expect(intro.run.entered).toBe(true);
    // A floor number that is not registered (yet) plays floor 0.
    const other = new FpsIntroScene(app, { floor: 2 });
    expect(other.run.floor).toBe(2);
  });
});
