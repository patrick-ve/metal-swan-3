import { describe, expect, it } from 'vitest';
import {
  ACTION_BIT,
  ActionPad,
  actionMask,
  actionsFromKeys,
  actionsFromPad,
  actionsFromPadButtons,
  type AnalogState,
  defaultFpsKeyMap,
  defaultFpsPadMap,
  FPS_ACTIONS,
  FPS_KEY_CODES,
  newAnalog,
  stickMove,
  stickScale,
  stickSpeed,
  stickTurn,
  TurnAccumulator,
  turnPerPixel,
} from '../../src/engine/input-actions';
import { buttonMask, InputManager, type InputSource, ScriptedSource, timeline } from '../../src/engine/input';
import { MemoryStore } from '../../src/engine/storage';
import { optionValue, stepOption } from '../../src/game/scenes/options';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/game/settings';

const F = ACTION_BIT.fire;
const FWD = ACTION_BIT.forward;

describe('FpsAction bits', () => {
  it('has 16 actions in the spec order (bit 0 forward … bit 15 weaponPrev)', () => {
    expect(FPS_ACTIONS.length).toBe(16);
    expect(ACTION_BIT.forward).toBe(1);
    expect(ACTION_BIT.strafe).toBe(1 << 6);
    expect(ACTION_BIT.fire).toBe(1 << 8);
    expect(ACTION_BIT.use).toBe(1 << 9);
    expect(ACTION_BIT.weapon1).toBe(1 << 10);
    expect(ACTION_BIT.weaponNext).toBe(1 << 14);
    expect(ACTION_BIT.weaponPrev).toBe(1 << 15);
    expect(actionMask('forward', 'fire')).toBe(FWD | F);
  });

  it('the key map follows the spec and never uses Ctrl, Alt, Meta or Enter', () => {
    const k = defaultFpsKeyMap();
    expect(k.forward).toEqual(['KeyW', 'ArrowUp']);
    expect(k.strafe).toEqual(['KeyC']);
    expect(k.fire).toEqual(['Space']);
    expect(k.use).toEqual(['KeyE', 'KeyF']);
    expect(k.weaponPrev).toEqual([]);
    for (const code of FPS_KEY_CODES) expect(code).not.toMatch(/Control|Alt|Meta|Enter|Escape/);
    const down = new Set(['KeyW', 'KeyD', 'Space', 'ShiftLeft']);
    expect(actionsFromKeys(k, (c) => down.has(c))).toBe(actionMask('forward', 'strafeRight', 'fire', 'run'));
  });

  it('the pad map: RT and X fire, A uses, RB/Y next, LB prev, d-pad moves and turns', () => {
    const p = defaultFpsPadMap();
    const on = (...idx: number[]): number => actionsFromPadButtons(p, (i) => idx.includes(i));
    expect(on(7)).toBe(F);
    expect(on(2)).toBe(F);
    expect(on(0)).toBe(ACTION_BIT.use);
    expect(on(5)).toBe(ACTION_BIT.weaponNext);
    expect(on(3)).toBe(ACTION_BIT.weaponNext);
    expect(on(4)).toBe(ACTION_BIT.weaponPrev);
    expect(on(10)).toBe(ACTION_BIT.run);
    expect(on(12, 13, 14, 15)).toBe(actionMask('forward', 'back', 'turnLeft', 'turnRight'));
    expect(on(9, 8)).toBe(0); // Start and Back stay pause buttons
  });
});

describe('ActionPad', () => {
  it('detects edges once per tick and counts held ticks (by name or bit index)', () => {
    const p = new ActionPad();
    p.update(0);
    p.update(F);
    expect(p.pressed('fire')).toBe(true);
    expect(p.held(8)).toBe(true);
    expect(p.heldTicks('fire')).toBe(1);
    expect(p.pressedMask).toBe(F);
    p.update(F | FWD);
    expect(p.pressed('fire')).toBe(false);
    expect(p.pressed('forward')).toBe(true);
    expect(p.heldTicks(8)).toBe(2);
    p.update(FWD);
    expect(p.released('fire')).toBe(true);
    expect(p.releasedMask).toBe(F);
    expect(p.heldTicks('fire')).toBe(0);
    expect(p.mask).toBe(FWD);
    p.update(0x1ffff); // bits above 15 are dropped
    expect(p.mask).toBe(0xffff);
  });

  it('suppress hides a held action until it is released, also when the pad was idle', () => {
    const p = new ActionPad();
    p.update(F);
    p.suppress();
    expect(p.held('fire')).toBe(false);
    p.update(F);
    expect(p.held('fire')).toBe(false);
    expect(p.pressed('fire')).toBe(false);
    p.update(0);
    p.update(F);
    expect(p.pressed('fire')).toBe(true);
    // Not polled before (fpsMode was off): the held key is still hidden on the first update.
    const q = new ActionPad();
    q.suppress();
    q.update(F | FWD);
    expect(q.mask).toBe(0);
    q.update(FWD);
    expect(q.mask).toBe(0);
    q.update(F); // fire went up and down again; forward went up
    expect(q.pressed('fire')).toBe(true);
    // An action not held at the next update is not suppressed at all.
    const r = new ActionPad();
    r.suppress();
    r.update(0);
    r.update(F);
    expect(r.pressed('fire')).toBe(true);
  });
});

describe('fallback from the 8-button pad', () => {
  it('maps up/down/left/right/fire/jump/bomb; start maps to nothing', () => {
    expect(actionsFromPad(buttonMask('up'))).toBe(FWD);
    expect(actionsFromPad(buttonMask('down'))).toBe(ACTION_BIT.back);
    expect(actionsFromPad(buttonMask('left'))).toBe(ACTION_BIT.turnLeft);
    expect(actionsFromPad(buttonMask('right'))).toBe(ACTION_BIT.turnRight);
    expect(actionsFromPad(buttonMask('fire'))).toBe(F);
    expect(actionsFromPad(buttonMask('jump'))).toBe(ACTION_BIT.use);
    expect(actionsFromPad(buttonMask('bomb'))).toBe(ACTION_BIT.weaponNext);
    expect(actionsFromPad(buttonMask('start'))).toBe(0);
  });

  it('InputManager uses the fallback for sources without readActions, only in fpsMode, only slot 0', () => {
    const input = new InputManager();
    input.addSource(new ScriptedSource(() => ['up', 'fire']));
    input.addSource(new ScriptedSource(() => 'down', 1)); // slot 1 never feeds the actions
    input.update();
    expect(input.actions.mask).toBe(0); // fpsMode off
    expect(input.pad(0).held('up')).toBe(true);
    input.fpsMode = true;
    input.update();
    expect(input.actions.mask).toBe(FWD | F);
    expect(input.actions.pressed('fire')).toBe(true);
    expect(input.pad(0).held('fire')).toBe(true); // the 8-button pad keeps working
  });

  it('a source with readActions gets no second mapping', () => {
    const input = new InputManager();
    input.fpsMode = true;
    const src: InputSource = {
      read: () => buttonMask('fire'),
      readActions: (slot) => (slot === 0 ? ACTION_BIT.strafe : 0),
    };
    input.addSource(src);
    input.update();
    expect(input.actions.mask).toBe(ACTION_BIT.strafe);
  });
});

describe('ScriptedSource actions and analog', () => {
  it('gives the scripted actions and analog per tick; analog is cleared every tick and clamped', () => {
    const input = new InputManager();
    input.fpsMode = true;
    input.addSource(
      new ScriptedSource(timeline().idle(10), 0, {
        actions: (t) => (t === 1 ? F : t >= 2 ? FWD : 0),
        analog: (t, out) => {
          if (t === 0) out.turn = 7;
          if (t === 1) {
            out.turn = -9000;
            out.moveX = 300;
            out.moveY = -40.4;
          }
        },
      }),
    );
    input.update();
    expect(input.analog).toEqual({ turn: 7, moveX: 0, moveY: 0 });
    expect(input.actions.mask).toBe(0);
    input.update();
    expect(input.analog).toEqual({ turn: -2048, moveX: 127, moveY: -40 });
    expect(input.actions.pressed('fire')).toBe(true);
    input.update();
    expect(input.analog).toEqual({ turn: 0, moveX: 0, moveY: 0 });
    expect(input.actions.held('forward')).toBe(true);
    expect(input.actions.released('fire')).toBe(true);
  });

  it('analog from several sources adds up; nothing is read while fpsMode is off', () => {
    const input = new InputManager();
    const a = (out: AnalogState): void => {
      out.turn = 3;
      out.moveY = 100;
    };
    input.addSource(new ScriptedSource(() => 0, 0, { analog: (_t, out) => a(out) }));
    input.addSource(new ScriptedSource(() => 0, 0, { analog: (_t, out) => a(out) }));
    input.update();
    expect(input.analog).toEqual({ turn: 0, moveX: 0, moveY: 0 });
    input.fpsMode = true;
    input.update();
    expect(input.analog).toEqual({ turn: 6, moveX: 0, moveY: 127 });
  });

  it('a fast mouse flick turns in full (300 px at sensitivity 5 = 900 units in one tick)', () => {
    const input = new InputManager();
    const acc = new TurnAccumulator();
    acc.sensitivity = 5;
    input.addSource(
      new ScriptedSource(() => 0, 0, {
        analog: (t, out) => {
          if (t === 0) acc.add(300);
          out.turn += acc.take();
        },
      }),
    );
    input.fpsMode = true;
    input.update();
    const first = input.analog.turn;
    input.update();
    expect(first + input.analog.turn).toBe(900);
    expect(first).toBe(900);
  });

  it('InputManager.suppress hides a held action until it is released', () => {
    const input = new InputManager();
    input.addSource(new ScriptedSource(() => 0, 0, { actions: (t) => (t < 3 || t >= 4 ? F : 0) }));
    input.update(); // t0, fpsMode off
    input.fpsMode = true;
    input.suppress(); // the fps scene enters with fire held
    input.update(); // t1
    expect(input.actions.held('fire')).toBe(false);
    input.update(); // t2
    expect(input.actions.held('fire')).toBe(false);
    input.update(); // t3: released
    input.update(); // t4: pressed again
    expect(input.actions.pressed('fire')).toBe(true);
    input.reset();
    expect(input.actions.mask).toBe(0);
  });
});

describe('mouse turn and sticks', () => {
  it('turns 0.6 × sensitivity units per pixel and carries the remainder', () => {
    expect(turnPerPixel(5)).toBe(3);
    const acc = new TurnAccumulator();
    acc.sensitivity = 1; // 0.6 units per px
    acc.add(1);
    expect(acc.take()).toBe(0);
    expect(acc.remainder).toBeCloseTo(0.6);
    acc.add(1);
    expect(acc.take()).toBe(1); // 1.2 → 1, 0.2 carried
    expect(acc.remainder).toBeCloseTo(0.2);
    acc.add(-2); // -1.2 + 0.2 = -1.0
    expect(acc.take()).toBe(-1);
    expect(acc.remainder).toBeCloseTo(0);
    // 1365 px at the default sensitivity ≈ one full turn (4096 units), nothing lost on the way.
    const b = new TurnAccumulator();
    let sum = 0;
    for (let i = 0; i < 1365; i++) {
      b.add(1);
      sum += b.take();
    }
    expect(sum).toBe(4095);
    const c = new TurnAccumulator();
    c.sensitivity = 3; // 1.8 units per px
    let total = 0;
    for (let i = 0; i < 10; i++) {
      c.add(1);
      total += c.take();
    }
    expect(total).toBe(18);
  });

  it('sticks: 0.2 dead zone, rescaled, integers; turn = round(48 × s²)', () => {
    const out = newAnalog();
    stickMove(0.1, -0.1, out);
    expect(out).toEqual({ turn: 0, moveX: 0, moveY: 0 });
    stickMove(0, -1, out);
    expect(out.moveY).toBe(127); // stick up = forward
    expect(out.moveX).toBe(0);
    stickMove(0.7, 0, out);
    expect(out.moveX).toBe(79); // (0.7 − 0.2) / 0.8 = 0.625 → 79.4 → 79
    stickMove(-1, 0, out);
    expect(out.moveX).toBe(-127);
    expect(stickTurn(0.15)).toBe(0);
    expect(stickTurn(1)).toBe(48);
    expect(stickTurn(-1)).toBe(-48);
    expect(stickTurn(0.6)).toBe(12);
    expect(stickTurn(-0.6)).toBe(-12);
    expect(Number.isInteger(stickTurn(0.537))).toBe(true);
  });

  it('stick → speed scale: walk × m, run × m above 0.9 or with run held', () => {
    expect(stickScale(0, 0)).toBe(0);
    expect(stickScale(127, 127)).toBe(1);
    expect(stickSpeed(0, 0, true, 0.09, 0.15)).toBe(0);
    expect(stickSpeed(0, 64, false, 0.09, 0.15)).toBeCloseTo(0.09 * (64 / 127));
    expect(stickSpeed(0, 64, true, 0.09, 0.15)).toBeCloseTo(0.15 * (64 / 127));
    expect(stickSpeed(0, 127, false, 0.09, 0.15)).toBeCloseTo(0.15);
    expect(stickSpeed(0, 114, false, 0.09, 0.15)).toBeCloseTo(0.09 * (114 / 127));
    expect(stickSpeed(0, 115, false, 0.09, 0.15)).toBeCloseTo(0.15 * (115 / 127));
  });
});

describe('MOUSE LOOK and SENSITIVITY settings', () => {
  it('default ON / 5, step, clamp and persist; old saves get the defaults', () => {
    expect(DEFAULT_SETTINGS.mouseLook).toBe(true);
    expect(DEFAULT_SETTINGS.mouseSensitivity).toBe(5);
    const s = { ...DEFAULT_SETTINGS };
    expect(optionValue(s, 'mouseLook')).toBe('ON');
    expect(stepOption(s, 'mouseLook', 1)).toBe(true);
    expect(optionValue(s, 'mouseLook')).toBe('OFF');
    expect(optionValue(s, 'sensitivity')).toBe('5');
    for (let i = 0; i < 9; i++) stepOption(s, 'sensitivity', 1);
    expect(s.mouseSensitivity).toBe(10);
    expect(stepOption(s, 'sensitivity', 1)).toBe(false);
    for (let i = 0; i < 12; i++) stepOption(s, 'sensitivity', -1);
    expect(s.mouseSensitivity).toBe(1);
    expect(stepOption(s, 'sensitivity', -1)).toBe(false);
    stepOption(s, 'sensitivity', 1);
    const store = new MemoryStore();
    saveSettings(store, s);
    const back = loadSettings(store);
    expect(back.mouseLook).toBe(false);
    expect(back.mouseSensitivity).toBe(2);
    // Old save without the fields, and broken values.
    store.set('settings', JSON.stringify({ difficulty: 'hard' }));
    expect(loadSettings(store)).toMatchObject({ difficulty: 'hard', mouseLook: true, mouseSensitivity: 5 });
    store.set('settings', JSON.stringify({ mouseLook: 'yes', mouseSensitivity: 0 }));
    expect(loadSettings(store)).toMatchObject({ mouseLook: true, mouseSensitivity: 1 });
    store.set('settings', JSON.stringify({ mouseSensitivity: 99 }));
    expect(loadSettings(store).mouseSensitivity).toBe(10);
  });
});
