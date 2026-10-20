/**
 * Bluetooth controllers in the scenes (docs/design/ams-extras.md §10), headless with fake
 * Gamepad objects behind a PadSource: claiming P1 / P2 on the menus, a mid-game join, the
 * lost-pad pause (2D and first-person) and its resume, rumble, RUMBLE and the P2 PAD rebind.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { InputManager, ScriptedSource, type Button } from '../../src/engine/input';
import { PAD, PadSource, type GamepadLike } from '../../src/engine/pads';
import type { TextOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { MemoryStore } from '../../src/engine/storage';
import { terrain } from '../../src/engine/terrain';
import { createApp, type GameApp } from '../../src/game/app';
import { defineFpsFloor, fpsFloorByNumber, hasFpsFloor } from '../../src/game/fps/registry';
import { newFpsRun } from '../../src/game/fps/run';
import type { MissionDef } from '../../src/game/mission/index';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { defineMission } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { CharacterSelectScene } from '../../src/game/scenes/character-select';
import { ControlsScene, CONTROL_ROWS } from '../../src/game/scenes/controls';
import { FpsScene } from '../../src/game/scenes/fps';
import { loadFpsContent } from '../../src/game/scenes/fps-intro';
import { GameplayScene, JOIN_KEY, startNewGame } from '../../src/game/scenes/gameplay';
import { ModeSelectScene } from '../../src/game/scenes/mode-select';
import { OPTION_ROWS, OptionsScene } from '../../src/game/scenes/options';
import { LostPadScene, PauseScene } from '../../src/game/scenes/pause';
import { TitleScene } from '../../src/game/scenes/title';
import { MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { loadSettings } from '../../src/game/settings';
import { SimAudio } from '../../src/sim/stats';
import { FLOOR } from './helpers';

const t = terrain(1600, 216);
t.ground().at(0, FLOOR).flat(1600);
const MISSION: MissionDef = {
  id: 'padtest',
  name: 'PAD TEST',
  music: 'm1',
  start: 'a',
  sections: {
    a: {
      id: 'a',
      width: 1600,
      height: 216,
      scroll: 'right',
      background: { sky: 0x102030ff, layers: [] },
      terrain: t.build(),
      terrainStyle: { ground: 'dirt' },
      playerStart: { x: 40, y: FLOOR },
      script: function* padtest() {
        yield 100000;
      },
    },
  },
};
defineMission(MISSION);

interface FakePad extends GamepadLike {
  index: number;
  connected: boolean;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
  effects: number;
}

const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';

function fakePad(index: number, id = DUALSENSE): FakePad {
  const pad: FakePad = {
    id,
    index,
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
    effects: 0,
    vibrationActuator: {
      playEffect: () => {
        pad.effects++;
        return Promise.resolve('complete');
      },
    },
  };
  return pad;
}

interface Rig {
  app: GameApp;
  pads: (FakePad | null)[];
  src: PadSource;
  held: Button[][];
  keys: string[];
  step: (n?: number) => void;
  /** Press a pad button for one tick, then release it for one tick. */
  tap: (p: FakePad, button: number) => void;
  /** Press a keyboard code for one tick (raw press; no held mask). */
  key: (code: string) => void;
  until: (cls: abstract new (...a: never[]) => unknown, max: number) => boolean;
}

function rig(players: 1 | 2 = 1, store = new MemoryStore()): Rig {
  const input = new InputManager();
  input.players = players;
  const pads: (FakePad | null)[] = [];
  const src = new PadSource(() => pads);
  input.useGamepads(src);
  const held: Button[][] = [[], []];
  input.addSource(new ScriptedSource(() => held[0], 0));
  input.addSource(new ScriptedSource(() => held[1], 1));
  const keys: string[] = [];
  input.addSource({ read: () => 0, drainPressed: (out) => out.push(...keys.splice(0)) });
  const app = createApp({ input, audio: new NullAudio(), store, params: { ...DEFAULT_PARAMS, players } });
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
  const tap = (p: FakePad, button: number): void => {
    p.buttons[button] = { pressed: true, value: 1 };
    step(1);
    p.buttons[button] = { pressed: false, value: 0 };
    step(1);
  };
  const key = (code: string): void => {
    keys.push(code);
    step(1);
    step(1);
  };
  const until = (cls: abstract new (...a: never[]) => unknown, max: number): boolean => {
    for (let i = 0; i < max; i++) {
      if (app.scenes.top instanceof cls) return true;
      step(1);
    }
    return app.scenes.top instanceof cls;
  };
  return { app, pads, src, held, keys, step, tap, key, until };
}

/** A 1-player game of the test mission, past the fade in, P1 on pad 0 (claimed by a jump). */
function soloGame(credits?: number): { h: Rig; game: GameplayScene; a: FakePad; b: FakePad } {
  const h = rig(1);
  const a = fakePad(0);
  const b = fakePad(1, XBOX);
  h.pads.push(a, b);
  if (credits !== undefined) h.app.settings.credits = credits as 3;
  startNewGame(h.app, { mission: 'padtest', players: 1, characters: ['vincent'] });
  expect(h.until(GameplayScene, 60)).toBe(true);
  h.step(32);
  h.tap(a, PAD.south); // P1 jumps: pad 0 becomes P1's
  expect(h.src.liveIndex(0)).toBe(0);
  return { h, game: h.app.scenes.top as GameplayScene, a, b };
}

describe('claiming player slots on the menus', () => {
  it('title START claims P1; 2 SOLDIERS; a second pad claims P2 on the select; each pad drives its own cursor', () => {
    const h = rig(1);
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    const c = fakePad(2);
    h.pads.push(a, b, c);
    h.app.scenes.reset(new TitleScene(h.app));
    h.step(20);
    h.tap(b, PAD.start);
    expect(h.src.liveIndex(0)).toBe(1);
    expect(h.until(ModeSelectScene, 40)).toBe(true);
    h.step(20);
    h.tap(b, PAD.down);
    h.tap(b, PAD.south); // 2 SOLDIERS
    expect(h.until(CharacterSelectScene, 40)).toBe(true);
    const sel = h.app.scenes.top as CharacterSelectScene;
    h.step(20);
    expect(h.app.input.players).toBe(2);
    expect(sel.wantsPad(1)).toBe(true);
    expect(sel.wantsPad(0)).toBe(false);
    // Pad a claims P2: that START does not pick a soldier.
    h.tap(a, PAD.start);
    expect(h.src.liveIndex(1)).toBe(0);
    expect(sel.choices).toEqual([null, null]);
    expect(sel.wantsPad(1)).toBe(false);
    // Each pad moves its own cursor; the third pad moves nobody.
    const p1 = sel.cursorIndex(0);
    const p2 = sel.cursorIndex(1);
    h.tap(a, PAD.right);
    expect(sel.cursorIndex(1)).toBe(p2 + 1);
    expect(sel.cursorIndex(0)).toBe(p1);
    h.tap(c, PAD.right);
    expect(sel.cursorIndex(0)).toBe(p1);
    expect(sel.cursorIndex(1)).toBe(p2 + 1);
    h.tap(b, PAD.south);
    h.tap(a, PAD.south);
    expect(sel.choices.every((x) => x !== null)).toBe(true);
    expect(h.until(MissionIntroScene, 200)).toBe(true);
    expect(h.app.session!.activeCount).toBe(2);
  });
});

describe('mid-game join (GDD §4.9)', () => {
  it('START on a free pad: P2 joins with the next hero, no pause, the input switches to 2 players', () => {
    const { h, game, b } = soloGame();
    expect(game.runner.players.length).toBe(1);
    expect(h.app.input.freePads()).toBe(1);
    h.tap(b, PAD.start);
    expect(h.app.scenes.top).toBe(game);
    expect(game.runner.players.length).toBe(2);
    const s = h.app.session!;
    expect(s.slots[1].joined).toBe(true);
    expect(s.slots[1].character).not.toBe(s.slots[0].character);
    expect(h.app.input.players).toBe(2);
    expect(h.app.input.keySplit).toBe(false);
    expect(h.src.liveIndex(1)).toBe(1);
    // Each pad now drives its own player.
    b.buttons[PAD.west] = { pressed: true, value: 1 };
    h.step();
    expect(h.app.input.pad(1).held('fire')).toBe(true);
    expect(h.app.input.pad(0).held('fire')).toBe(false);
    b.buttons[PAD.west] = { pressed: false, value: 0 };
    h.step();
    // P1's own START still pauses.
    h.tap(h.pads[0]!, PAD.start);
    expect(h.app.scenes.top).toBeInstanceOf(PauseScene);
    // A third pad (nobody's) navigates the pause menu; back in the game it drives nobody.
    const pause = h.app.scenes.top as PauseScene;
    const c = fakePad(2);
    h.pads.push(c);
    h.step(2);
    h.tap(c, PAD.down);
    expect(pause.selected).toBe('OPTIONS');
    h.tap(c, PAD.up);
    h.tap(c, PAD.south);
    h.step(4);
    expect(h.app.scenes.top).toBe(game);
    expect(h.app.input.menuPads).toBe(false);
    c.buttons[PAD.west] = { pressed: true, value: 1 };
    h.step();
    expect(h.app.input.pad(0).held('fire') || h.app.input.pad(1).held('fire')).toBe(false);
    c.buttons[PAD.west] = { pressed: false, value: 0 };
  });

  it('the P2 corner blinks PRESS START while a free pad is connected (and not without one)', () => {
    const { h, game, b } = soloGame();
    const texts: string[] = [];
    class Rec extends SoftRenderer {
      override text(str: string, x: number, y: number, o?: TextOpts): void {
        texts.push(str);
        super.text(str, x, y, o);
      }
    }
    const r = new Rec();
    const look = (): boolean => {
      texts.length = 0;
      for (let i = 0; i < 64; i++) {
        h.step();
        game.draw(r);
      }
      return texts.some((x) => /PRESS START/.test(x));
    };
    expect(look()).toBe(true);
    // The free pad goes away: no invitation.
    h.pads[1] = null;
    expect(look()).toBe(false);
    h.pads[1] = b;
    expect(look()).toBe(true);
  });

  it('a join costs a credit; without credits a free pad\'s START does nothing', () => {
    const { h, game, b } = soloGame(3);
    expect(h.app.session!.credits).toBe(3);
    h.app.session!.credits = 0;
    h.tap(b, PAD.start);
    expect(game.runner.players.length).toBe(1);
    expect(h.app.scenes.top).toBe(game);
    h.app.session!.credits = 2;
    h.tap(b, PAD.start);
    expect(game.runner.players.length).toBe(2);
    expect(h.app.session!.credits).toBe(1);
  });

  it('keyboard key 2 joins P2 on the keyboard (the 2-player key sets)', () => {
    const { h, game } = soloGame();
    h.key(JOIN_KEY);
    expect(game.runner.players.length).toBe(2);
    expect(h.app.input.players).toBe(2);
    expect(h.app.input.keySplit).toBe(true);
  });

  it('a pad with no owner pauses player 1 when nobody can join (and becomes player 1\'s)', () => {
    const h = rig(1);
    const a = fakePad(0);
    h.pads.push(a);
    h.app.settings.credits = 3;
    startNewGame(h.app, { mission: 'padtest', players: 1, characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    h.step(32);
    h.app.session!.credits = 0;
    h.tap(a, PAD.start);
    expect(h.app.scenes.top).toBeInstanceOf(PauseScene);
    expect(h.src.liveIndex(0)).toBe(0);
  });

  it("player 1 without a pad: the first START on a pad is player 1's pause (no join, no credit); a second pad then joins", () => {
    const h = rig(1);
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    h.pads.push(a, b);
    h.app.settings.credits = 3;
    startNewGame(h.app, { mission: 'padtest', players: 1, characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(32);
    expect(h.src.liveIndex(0)).toBe(-1);
    h.tap(a, PAD.start);
    expect(h.app.scenes.top).toBeInstanceOf(PauseScene);
    expect(h.src.liveIndex(0)).toBe(0);
    expect(game.runner.players.length).toBe(1);
    expect(h.app.session!.credits).toBe(3);
    h.tap(a, PAD.start); // resume
    expect(h.until(GameplayScene, 30)).toBe(true);
    h.tap(b, PAD.start);
    expect(game.runner.players.length).toBe(2);
    expect(h.src.liveIndex(1)).toBe(1);
  });

  it('player 1 on the keyboard (the last device): START on a pad joins player 2 with it', () => {
    const h = rig(1);
    const a = fakePad(0);
    h.pads.push(a);
    startNewGame(h.app, { mission: 'padtest', players: 1, characters: ['vincent'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    const game = h.app.scenes.top as GameplayScene;
    h.step(32);
    h.key('KeyX'); // player 1 jumps on the keyboard
    h.tap(a, PAD.start);
    expect(h.app.scenes.top).toBe(game);
    expect(game.runner.players.length).toBe(2);
    expect(h.src.liveIndex(1)).toBe(0);
    expect(h.src.liveIndex(0)).toBe(-1);
  });

  it('a keyboard split in mid-play shows both key sets (P1 KEYS / P2 KEYS)', () => {
    const { h, game } = soloGame();
    const texts: string[] = [];
    class Rec extends SoftRenderer {
      override text(str: string, x: number, y: number, o?: TextOpts): void {
        texts.push(str);
        super.text(str, x, y, o);
      }
    }
    h.key(JOIN_KEY);
    expect(h.app.input.keySplit).toBe(true);
    const r = new Rec();
    for (let i = 0; i < 4; i++) {
      h.step();
      game.draw(r);
    }
    expect(texts).toContain('P1 KEYS: WASD F G H');
    expect(texts).toContain('P2 KEYS: ARROWS , . /');
  });

  it('2 players: START on a free pad takes the slot without a pad (no credit, no pause)', () => {
    const h = rig(2);
    const a = fakePad(0);
    h.pads.push(a);
    h.app.settings.credits = 3;
    startNewGame(h.app, { mission: 'padtest', players: 2, characters: ['vincent', 'thom'] });
    expect(h.until(GameplayScene, 60)).toBe(true);
    h.step(32);
    h.tap(a, PAD.start);
    expect(h.app.scenes.top).toBeInstanceOf(GameplayScene);
    expect(h.src.liveIndex(0)).toBe(0);
    expect(h.app.session!.credits).toBe(3);
  });
});

describe('the lost-pad pause', () => {
  it('2D: P1\'s pad drops out → CONTROLLER 1 LOST; the same pad back resumes', () => {
    const { h, game, a } = soloGame();
    h.pads[0] = null;
    h.step(2);
    expect(h.app.scenes.top).toBeInstanceOf(LostPadScene);
    expect((h.app.scenes.top as LostPadScene).slot).toBe(0);
    const t0 = game.runner.world.tick;
    h.step(30);
    expect(game.runner.world.tick).toBe(t0);
    h.pads[0] = { ...a, index: 0 };
    h.step(2);
    expect(h.app.scenes.top).toBe(game);
    expect(h.src.liveIndex(0)).toBe(0);
  });

  it('2D: START on a free pad takes the lost slot; the keyboard resumes too (the slot forgets its pad)', () => {
    const { h, game, b } = soloGame();
    h.pads[0] = null;
    h.step(2);
    expect(h.app.scenes.top).toBeInstanceOf(LostPadScene);
    h.tap(b, PAD.start);
    expect(h.app.scenes.top).toBe(game);
    expect(h.src.liveIndex(0)).toBe(1);
    // That pad drops out too: Enter on the keyboard plays on.
    h.pads[1] = null;
    h.step(2);
    expect(h.app.scenes.top).toBeInstanceOf(LostPadScene);
    h.key('Enter');
    expect(h.app.scenes.top).toBe(game);
    expect(h.app.input.slotHasPad(0)).toBe(false);
    expect(h.app.input.padLost(0)).toBe(false);
    h.step(10);
    expect(h.app.scenes.top).toBe(game);
  });

  it('a lost pad of a player who is out (or of nobody in play) does not pause', () => {
    const { h, game, b } = soloGame();
    h.tap(b, PAD.start); // P2 joins on pad 1
    expect(game.runner.players.length).toBe(2);
    game.runner.players[1].state = 'out';
    h.pads[1] = null;
    h.step(5);
    expect(h.app.scenes.top).toBe(game);
  });

  it('first person: the player\'s pad drops out → the lost-pad pause; it resumes when the pad is back', async () => {
    const h = rig(1);
    await loadFpsContent(createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore() }));
    const f0 = fpsFloorByNumber(0);
    if (f0 && !hasFpsFloor('fps-1')) defineFpsFloor({ ...f0, id: 'fps-1', number: 1, name: 'SUPPLY DEPOT' });
    const a = fakePad(0);
    h.pads.push(a);
    h.step();
    h.app.input.claimPad(0, 0);
    h.app.session = new GameSession({ characters: ['vincent'], seed: 7 });
    const run = newFpsRun(h.app.session, 1);
    h.app.session.startMission('fps-1');
    run.entered = true;
    const scene = new FpsScene(h.app, run);
    h.app.scenes.reset(scene);
    scene.game.skipUnfold();
    h.step(5);
    expect(h.app.scenes.top).toBe(scene);
    h.pads[0] = null;
    h.step(2);
    expect(h.app.scenes.top).toBeInstanceOf(LostPadScene);
    h.pads[0] = { ...a };
    h.step(2);
    expect(h.app.scenes.top).toBe(scene);
  }, 60_000);
});

describe('rumble and the RUMBLE option', () => {
  it('a death rumbles the player\'s own pad; RUMBLE OFF keeps it still', () => {
    const { h, game, a, b } = soloGame();
    const p = game.runner.players[0];
    game.runner.world.events.emit('playerDied', { player: p, slot: 0, cause: 'bullet' as never });
    expect(a.effects).toBe(1);
    expect(b.effects).toBe(0);
    h.step(30);
    h.app.settings.rumble = false;
    game.runner.world.events.emit('playerDied', { player: p, slot: 0, cause: 'bullet' as never });
    expect(a.effects).toBe(1);
  });

  it('OPTIONS has RUMBLE (default ON); turning it on buzzes the pad and it is saved', () => {
    const store = new MemoryStore();
    const h = rig(1, store);
    const a = fakePad(0);
    h.pads.push(a);
    expect(h.app.settings.rumble).toBe(true);
    h.app.scenes.reset(new OptionsScene(h.app));
    h.step(2);
    const row = OPTION_ROWS.findIndex((r) => r.id === 'rumble');
    for (let i = 0; i < row; i++) h.tap(a, PAD.down);
    h.tap(a, PAD.right);
    expect(h.app.settings.rumble).toBe(false);
    h.tap(a, PAD.right);
    expect(h.app.settings.rumble).toBe(true);
    expect(a.effects).toBe(1);
    h.tap(a, PAD.east); // back: saved
    expect(loadSettings(store).rumble).toBe(true);
  });
});

describe('CONTROLS: P1 PAD and P2 PAD', () => {
  it('rebinds player 2\'s pad map only (and draws the pad rows with each pad\'s labels)', () => {
    const h = rig(2);
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    h.pads.push(a, b);
    h.step();
    h.app.input.claimPad(0, 0);
    h.app.input.claimPad(1, 1);
    h.app.scenes.reset(new ControlsScene(h.app));
    h.step(2);
    const row = CONTROL_ROWS.findIndex((r) => r.id === 'pad2');
    expect(row).toBeGreaterThan(0);
    for (let i = 0; i < row; i++) h.tap(a, PAD.down);
    h.tap(a, PAD.south);
    const scene = h.app.scenes.top as ControlsScene;
    expect(scene.asking).toBe('fire');
    h.tap(b, PAD.north); // fire = north (Y)
    h.tap(b, PAD.south); // jump
    h.tap(b, PAD.east); // bomb
    h.tap(b, PAD.start); // start
    expect(scene.asking).toBeNull();
    expect(h.app.input.bindings.pad2.fire).toEqual([PAD.north]);
    expect(h.app.input.bindings.pad.fire).toEqual([PAD.west]);
  });
});
