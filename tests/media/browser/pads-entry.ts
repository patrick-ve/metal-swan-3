/**
 * Browser bundle for tests/media/pads-browser.test.ts (built with Vite, run in headless
 * Chromium): the real KeyboardSource and GamepadSource (input.browser.ts) on an InputManager,
 * with `navigator.getGamepads` replaced by a list of fake pads the test connects, presses,
 * disconnects and reconnects. Exposes window.PadTest.
 */
import { InputManager } from '../../../src/engine/input';
import { GamepadSource, KeyboardSource } from '../../../src/engine/input.browser';
import { PAD } from '../../../src/engine/pads';

interface Fake {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  timestamp: number;
  buttons: { pressed: boolean; touched: boolean; value: number }[];
  axes: number[];
  vibrationActuator: { type: string; playEffect(type: string, params: object): Promise<string> };
}

const fakes: (Fake | null)[] = [null, null, null, null];
const effects: { pad: number; type: string; params: object }[] = [];
Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => fakes });

const input = new InputManager();
input.addSource(new KeyboardSource(window, { isBound: (c) => input.isBound(c) }));
const pads = new GamepadSource();
input.useGamepads(pads);

function make(index: number, id: string, mapping = 'standard', nButtons = 17, nAxes = 4): Fake {
  return {
    id,
    index,
    connected: true,
    mapping,
    timestamp: 0,
    buttons: Array.from({ length: nButtons }, () => ({ pressed: false, touched: false, value: 0 })),
    axes: new Array<number>(nAxes).fill(0),
    vibrationActuator: {
      type: 'dual-rumble',
      playEffect: (type, params) => {
        effects.push({ pad: index, type, params });
        return Promise.resolve('complete');
      },
    },
  };
}

const api = {
  PAD,
  connect(index: number, id: string, mapping = 'standard', nButtons = 17, nAxes = 4): void {
    fakes[index] = make(index, id, mapping, nButtons, nAxes);
  },
  disconnect(index: number): void {
    fakes[index] = null;
  },
  press(index: number, button: number, on = true): void {
    const f = fakes[index];
    if (f) f.buttons[button] = { pressed: on, touched: on, value: on ? 1 : 0 };
  },
  axis(index: number, axis: number, v: number): void {
    const f = fakes[index];
    if (f) f.axes[axis] = v;
  },
  step(n = 1): void {
    for (let i = 0; i < n; i++) input.update();
  },
  setPlayers(n: 1 | 2): void {
    input.players = n;
  },
  setJoinWatch(on: boolean): void {
    input.joinWatch = on;
  },
  claim(slot: 0 | 1, index: number): boolean {
    return input.claimPad(slot, index);
  },
  freePressed(b0: number, b1 = -1, b2 = -1): number {
    return input.freePadPressed(b0, b1, b2);
  },
  rumble(slot: 0 | 1): boolean {
    return input.rumble(slot, 0.5, 0.25, 120);
  },
  state(): {
    held: [number, number];
    pressed: [number, number];
    lost: [boolean, boolean];
    live: [number, number];
    free: number;
    raw: string[];
    family: [string | null, string | null];
    effects: number;
  } {
    return {
      held: [input.pad(0).mask, input.pad(1).mask],
      pressed: [input.pad(0).pressedMask, input.pad(1).pressedMask],
      lost: [input.padLost(0), input.padLost(1)],
      live: [pads.liveIndex(0), pads.liveIndex(1)],
      free: input.freePads(),
      raw: [...input.rawPressed],
      family: [input.slotPad(0)?.family ?? null, input.slotPad(1)?.family ?? null],
      effects: effects.length,
    };
  },
};

declare global {
  interface Window {
    PadTest: typeof api;
  }
}
window.PadTest = api;
