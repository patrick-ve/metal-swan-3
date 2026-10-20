import { describe, expect, it } from 'vitest';
import { defaultBindings, InputManager, keySetFor, parseBindings, serializeBindings } from '../../src/engine/input';
import { HAT_NEUTRAL, hatBits, PAD, padInfo, padLabel, PadSource, parsePadId, playRumble, type GamepadLike } from '../../src/engine/pads';

/** A fake Gamepad (plain object; `press` / `axis` change it in place like a live snapshot). */
interface FakePad extends GamepadLike {
  index: number;
  connected: boolean;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
  effects: { type: string; params: Record<string, number> }[];
  vibrationActuator: { playEffect(type: string, params?: object): Promise<unknown> } | null;
}

const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const PRO = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';

function fakePad(index: number, id = DUALSENSE, mapping = 'standard', nButtons = 17, nAxes = 4): FakePad {
  const pad: FakePad = {
    id,
    index,
    connected: true,
    mapping,
    buttons: Array.from({ length: nButtons }, () => ({ pressed: false, value: 0 })),
    axes: new Array<number>(nAxes).fill(0),
    effects: [],
    vibrationActuator: null,
  };
  pad.vibrationActuator = {
    playEffect: (type: string, params?: object) => {
      pad.effects.push({ type, params: params as Record<string, number> });
      return Promise.resolve('complete');
    },
  };
  return pad;
}

function press(p: FakePad, i: number, on = true): void {
  p.buttons[i] = { pressed: on, value: on ? 1 : 0 };
}

/** An InputManager with a PadSource over a mutable list of fake pads (array index = Gamepad index). */
function rig(players: 1 | 2 = 1): { input: InputManager; src: PadSource; slots: (FakePad | null)[]; step: (n?: number) => void } {
  const slots: (FakePad | null)[] = [];
  const src = new PadSource(() => slots);
  const input = new InputManager();
  input.players = players;
  input.useGamepads(src);
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) input.update();
  };
  return { input, src, slots, step };
}

/** Tap a button of a pad: down for one tick, up for one tick. Returns what the first tick saw. */
function tap(r: ReturnType<typeof rig>, p: FakePad, i: number, look?: () => void): void {
  press(p, i);
  r.step();
  look?.();
  press(p, i, false);
  r.step();
}

describe('pad ids, families and profiles', () => {
  it('reads vendor and product ids in the Chrome, Firefox and Safari formats', () => {
    expect(parsePadId(DUALSENSE)).toEqual({ vendor: 0x054c, product: 0x0ce6, name: 'DualSense Wireless Controller' });
    expect(parsePadId('USB Gamepad (Vendor: 0079 Product: 0011)')).toEqual({ vendor: 0x79, product: 0x11, name: 'USB Gamepad' });
    expect(parsePadId('054c-05c4-Wireless Controller')).toEqual({ vendor: 0x054c, product: 0x05c4, name: 'Wireless Controller' });
    expect(parsePadId('2dc8-6101-8BitDo SN30 Pro')).toEqual({ vendor: 0x2dc8, product: 0x6101, name: '8BitDo SN30 Pro' });
    expect(parsePadId('45e-b13-Xbox Wireless Controller')).toEqual({ vendor: 0x045e, product: 0x0b13, name: 'Xbox Wireless Controller' });
    expect(parsePadId('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toEqual({ vendor: null, product: null, name: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' });
  });

  it('knows the families and models (name first, then vendor)', () => {
    expect(padInfo(DUALSENSE, 'standard')).toMatchObject({ family: 'playstation', model: 'DUALSENSE', create: true, standard: true });
    expect(padInfo('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', 'standard')).toMatchObject({ family: 'playstation', model: 'DUALSHOCK 4', create: false });
    expect(padInfo('DUALSHOCK 4 Wireless Controller', 'standard').family).toBe('playstation');
    expect(padInfo(XBOX, 'standard')).toMatchObject({ family: 'xbox', model: 'XBOX' });
    expect(padInfo('Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'standard').family).toBe('xbox');
    expect(padInfo(PRO, 'standard')).toMatchObject({ family: 'nintendo', model: 'SWITCH PRO' });
    expect(padInfo('Joy-Con (L/R)', 'standard')).toMatchObject({ family: 'nintendo', model: 'JOY-CON' });
    expect(padInfo('2dc8-6101-8BitDo SN30 Pro', '')).toMatchObject({ family: 'nintendo', model: '8BITDO' });
    expect(padInfo('USB Gamepad (Vendor: 0079 Product: 0011)', '')).toMatchObject({ family: 'generic', model: 'GAMEPAD' });
    // The profile only applies without the standard mapping.
    expect(padInfo(DUALSENSE, 'standard').profile.name).toBe('standard');
    expect(padInfo('054c-0ce6-DualSense Wireless Controller', '').profile.name).toBe('ps-hid');
    expect(padInfo('2dc8-6101-8BitDo SN30 Pro', '').profile.name).toBe('8bitdo-dinput');
    expect(padInfo('0079-0011-USB Gamepad', '').profile.name).toBe('generic');
  });

  it('labels the buttons per family: PlayStation glyphs, Xbox A B X Y, Nintendo B A Y X, generic positions', () => {
    expect(padLabel('playstation', PAD.south)).toEqual({ text: '✕', glyph: 'ps', frame: 0 });
    expect(padLabel('playstation', PAD.north)).toEqual({ text: '△', glyph: 'ps', frame: 3 });
    expect(padLabel('playstation', PAD.select).text).toBe('SHARE');
    expect(padLabel('playstation', PAD.select, true).text).toBe('CREATE');
    expect(padLabel('playstation', PAD.start).text).toBe('OPTIONS');
    expect([0, 1, 2, 3].map((i) => padLabel('xbox', i).text)).toEqual(['A', 'B', 'X', 'Y']);
    expect([0, 1, 2, 3].map((i) => padLabel('nintendo', i).text)).toEqual(['B', 'A', 'Y', 'X']);
    expect(padLabel('nintendo', PAD.start).text).toBe('+');
    expect(padLabel('xbox', PAD.start).text).toBe('MENU');
    expect(padLabel('generic', PAD.west)).toEqual({ text: 'WEST', glyph: 'pos', frame: 2 });
    expect(padLabel('generic', PAD.up).text).toBe('↑');
    expect(padLabel('xbox', 30).text).toBe('B30');
  });

  it('decodes a hat-switch axis into the D-pad (8 directions, centred at 9/7)', () => {
    const bit = (i: number): number => 1 << i;
    expect(hatBits(-1)).toBe(bit(PAD.up));
    expect(hatBits(-1 + 2 / 7)).toBe(bit(PAD.up) | bit(PAD.right));
    expect(hatBits(-1 + 4 / 7)).toBe(bit(PAD.right));
    expect(hatBits(1 / 7)).toBe(bit(PAD.down));
    expect(hatBits(3 / 7)).toBe(bit(PAD.down) | bit(PAD.left));
    expect(hatBits(5 / 7)).toBe(bit(PAD.left));
    expect(hatBits(1)).toBe(bit(PAD.up) | bit(PAD.left));
    expect(hatBits(HAT_NEUTRAL)).toBe(0);
    expect(hatBits(Number.NaN)).toBe(0);
  });
});

describe('PadSource: mappings', () => {
  it('a non-standard DualShock 4 (HID order) jumps with Cross and moves with its hat', () => {
    const r = rig();
    const ds4 = fakePad(0, '054c-05c4-Wireless Controller', '', 14, 10);
    ds4.axes[9] = HAT_NEUTRAL;
    r.slots[0] = ds4;
    r.step();
    press(ds4, 1); // raw 1 = Cross
    ds4.axes[9] = 5 / 7; // hat left
    r.step();
    expect(r.input.pad(0).pressed('jump')).toBe(true);
    expect(r.input.pad(0).held('left')).toBe(true);
    expect(r.input.rawPressed).toContain('GamepadB0');
    expect(r.input.rawPressed).toContain('GamepadB14');
    press(ds4, 0); // raw 0 = Square: west = fire
    r.step();
    expect(r.input.pad(0).pressed('fire')).toBe(true);
  });

  it('an 8BitDo in D-input mode fires with Y (raw 4) and jumps with B (raw 1)', () => {
    const r = rig();
    const pad = fakePad(0, '2dc8-6101-8BitDo SN30 Pro', '', 16, 4);
    r.slots[0] = pad;
    r.step();
    press(pad, 4);
    press(pad, 1);
    r.step();
    expect(r.input.pad(0).held('fire')).toBe(true);
    expect(r.input.pad(0).held('jump')).toBe(true);
    expect(r.input.pad(0).held('bomb')).toBe(false);
  });

  it('an unknown pad reads the standard indices, finds its hat axis and ignores a resting trigger', () => {
    const r = rig();
    const pad = fakePad(0, 'Generic USB Joystick (Vendor: 0079 Product: 0006)', '', 12, 8);
    pad.axes[3] = -1; // a trigger at rest
    pad.axes[6] = HAT_NEUTRAL;
    r.slots[0] = pad;
    r.step();
    expect(r.input.pad(0).mask).toBe(0);
    pad.axes[6] = -1; // up
    press(pad, 2);
    r.step();
    expect(r.input.pad(0).held('up')).toBe(true);
    expect(r.input.pad(0).held('fire')).toBe(true);
  });

  it('the left stick moves (radial dead zone); a pad seen for the first time reports no edges', () => {
    const r = rig();
    const pad = fakePad(0);
    press(pad, PAD.south); // held while it connects
    pad.axes[0] = 0.9;
    r.slots[0] = pad;
    r.step();
    expect(r.input.pad(0).held('right')).toBe(true);
    expect(r.input.rawPressed).toEqual([]);
    pad.axes[0] = 0.2;
    r.step();
    expect(r.input.pad(0).held('right')).toBe(false);
  });

  it('first person: every pad feeds slot 0 (actions OR-ed, sticks by the largest value)', () => {
    const r = rig();
    r.input.fpsMode = true;
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    r.slots.push(a, b);
    r.step();
    press(b, PAD.r2);
    a.axes[1] = -1;
    b.axes[2] = 0.8;
    r.step();
    expect(r.input.actions.held('fire')).toBe(true);
    expect(r.input.analog.moveY).toBeGreaterThan(0); // stick up = forward
    expect(r.input.analog.turn).toBeGreaterThan(0);
  });
});

describe('PadSource: player slots', () => {
  it('1 player: every pad drives player 1; the first non-START press claims player 1', () => {
    const r = rig(1);
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    r.slots.push(a, b);
    r.step();
    expect(r.src.claims[0]).toBeNull();
    tap(r, b, PAD.south, () => expect(r.input.pad(0).pressed('jump')).toBe(true));
    expect(r.src.liveIndex(0)).toBe(1);
    // Pad a still drives player 1 (it is free: START on it asks to join).
    tap(r, a, PAD.west, () => expect(r.input.pad(0).pressed('fire')).toBe(true));
    expect(r.src.liveIndex(0)).toBe(1);
    expect(r.input.freePads()).toBe(1);
    r.input.joinWatch = true;
    tap(r, a, PAD.start, () => {
      expect(r.input.pad(0).pressed('start')).toBe(false);
      expect(r.input.freePadPressed(PAD.start)).toBe(0);
    });
    // Player 1's own START still pauses.
    tap(r, b, PAD.start, () => {
      expect(r.input.pad(0).pressed('start')).toBe(true);
      expect(r.input.freePadPressed(PAD.start)).toBe(-1);
    });
    // Without the join watch (menus) any pad's START reaches player 1.
    r.input.joinWatch = false;
    tap(r, a, PAD.start, () => expect(r.input.pad(0).pressed('start')).toBe(true));
  });

  it('2 players: each slot has its own pad and pad map; a third pad drives nobody but reaches the menus', () => {
    const r = rig(2);
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    const c = fakePad(2, PRO);
    r.slots.push(a, b, c);
    r.step();
    expect(r.input.claimPad(0, 0)).toBe(true);
    expect(r.input.claimPad(1, 1)).toBe(true);
    r.step();
    r.input.bindings.pad2.fire = [PAD.north];
    tap(r, b, PAD.north, () => {
      expect(r.input.pad(1).pressed('fire')).toBe(true);
      expect(r.input.pad(0).mask).toBe(0);
    });
    tap(r, a, PAD.west, () => {
      expect(r.input.pad(0).pressed('fire')).toBe(true);
      expect(r.input.pad(1).mask).toBe(0);
    });
    tap(r, c, PAD.south, () => {
      expect(r.input.pad(0).mask | r.input.pad(1).mask).toBe(0);
      expect(r.input.rawPressed).toEqual(['GamepadB0']);
      expect(r.input.freePadPressed(PAD.south)).toBe(2);
    });
    expect(r.input.freePads()).toBe(1);
    // A menu open over the game (menuPads): the third pad navigates it through slot 0.
    r.input.menuPads = true;
    tap(r, c, PAD.down, () => {
      expect(r.input.pad(0).pressed('down')).toBe(true);
      expect(r.input.pad(1).mask).toBe(0);
    });
    r.input.menuPads = false;
    tap(r, c, PAD.down, () => expect(r.input.pad(0).mask).toBe(0));
  });

  it('the START that claims a slot does not also press START for it', () => {
    const r = rig(2);
    const a = fakePad(0);
    r.slots.push(a);
    r.step();
    press(a, PAD.start);
    r.step();
    const gp = r.input.freePadPressed(PAD.start, PAD.south);
    expect(gp).toBe(0);
    r.input.claimPad(1, gp);
    r.step(); // still held
    expect(r.input.pad(1).pressed('start')).toBe(false);
    expect(r.input.pad(1).held('start')).toBe(false);
    press(a, PAD.start, false);
    r.step();
    tap(r, a, PAD.start, () => expect(r.input.pad(1).pressed('start')).toBe(true));
  });

  it('sticky slots: a pad that drops out is lost; the same pad back (any index) takes its slot again', () => {
    const r = rig(2);
    const a = fakePad(0);
    const b = fakePad(1, XBOX);
    r.slots.push(a, b);
    r.step();
    r.input.claimPad(0, 0);
    r.input.claimPad(1, 1);
    r.step();
    // Player 2's pad sleeps.
    r.slots[1] = null;
    r.step();
    expect(r.input.padLost(1)).toBe(true);
    expect(r.input.padLost(0)).toBe(false);
    expect(r.input.slotPad(1)?.family).toBe('xbox');
    // Player 1's pad drops out too; the Xbox pad comes back first, at index 0 (the browser's
    // lowest free index): it is still player 2's, never player 1's.
    r.slots[0] = null;
    r.step();
    r.slots[0] = { ...b, index: 0, buttons: b.buttons.map((x) => ({ ...x })) } as FakePad;
    r.step();
    expect(r.input.padLost(1)).toBe(false);
    expect(r.src.liveIndex(1)).toBe(0);
    expect(r.input.padLost(0)).toBe(true);
    // The DualSense comes back at index 1: player 1 again.
    r.slots[1] = { ...a, index: 1 } as FakePad;
    r.step();
    expect(r.src.liveIndex(0)).toBe(1);
    expect(r.input.padLost(0)).toBe(false);
    tap(r, r.slots[0]!, PAD.south, () => expect(r.input.pad(1).pressed('jump')).toBe(true));
  });

  it('another pad at a lost pad\'s index does not take the slot; START on a free pad can (claimPad)', () => {
    const r = rig(2);
    const a = fakePad(0);
    r.slots.push(a);
    r.step();
    r.input.claimPad(0, 0);
    r.slots[0] = null;
    r.step();
    expect(r.input.padLost(0)).toBe(true);
    const other = fakePad(0, PRO);
    r.slots[0] = other;
    r.step();
    expect(r.input.padLost(0)).toBe(true);
    press(other, PAD.start);
    r.step();
    const gp = r.input.freePadPressed(PAD.start);
    expect(gp).toBe(0);
    r.input.claimPad(0, gp);
    r.step();
    expect(r.input.padLost(0)).toBe(false);
    expect(r.input.slotPad(0)?.family).toBe('nintendo');
  });

  it('two identical pads keep their slots when one reconnects at its old index', () => {
    const r = rig(2);
    const a = fakePad(0);
    const b = fakePad(1);
    r.slots.push(a, b);
    r.step();
    r.input.claimPad(0, 0);
    r.input.claimPad(1, 1);
    r.slots[0] = null;
    r.step();
    expect(r.input.padLost(0)).toBe(true);
    expect(r.src.liveIndex(1)).toBe(1);
    r.slots[0] = fakePad(0);
    r.step();
    expect(r.src.liveIndex(0)).toBe(0);
    expect(r.src.liveIndex(1)).toBe(1);
  });

  it('a claimed pad moves: claiming the other slot\'s pad leaves that slot without one', () => {
    const r = rig(2);
    const a = fakePad(0);
    r.slots.push(a);
    r.step();
    r.input.claimPad(1, 0);
    r.input.claimPad(0, 0);
    expect(r.src.claims[1]).toBeNull();
    expect(r.src.liveIndex(0)).toBe(0);
    r.input.releasePad(0);
    expect(r.input.slotHasPad(0)).toBe(false);
    expect(r.input.padLost(0)).toBe(false);
  });

  it('no Gamepad API, or one that throws: no pads, no errors', () => {
    const src = new PadSource(() => {
      throw new Error('blocked');
    });
    const input = new InputManager();
    input.useGamepads(src);
    expect(() => input.update()).not.toThrow();
    expect(input.freePads()).toBe(0);
    const bare = new InputManager();
    expect(bare.padLost(0)).toBe(false);
    expect(bare.freePadPressed(PAD.start)).toBe(-1);
    expect(bare.rumble(0, 1, 1, 100)).toBe(false);
  });
});

describe('rumble', () => {
  it('plays a dual-rumble effect on the slot\'s pad; a weaker one does not cut a stronger one short', () => {
    const r = rig(2);
    const a = fakePad(0);
    const b = fakePad(1);
    r.slots.push(a, b);
    r.step();
    r.input.claimPad(1, 1);
    expect(r.input.rumble(1, 0.8, 0.4, 300)).toBe(true);
    expect(b.effects).toEqual([{ type: 'dual-rumble', params: { startDelay: 0, duration: 300, strongMagnitude: 0.8, weakMagnitude: 0.4 } }]);
    expect(a.effects).toEqual([]);
    expect(r.input.rumble(1, 0.2, 0.2, 100)).toBe(false);
    r.step(20);
    expect(r.input.rumble(1, 0.2, 0.2, 100)).toBe(true);
    // Player 1 has no pad in 2-player mode: nothing.
    expect(r.input.rumble(0, 1, 1, 100)).toBe(false);
  });

  it('1 player without a claim: the pad used last; feature-detected, never throws', () => {
    const r = rig(1);
    const a = fakePad(0);
    const b = fakePad(1);
    r.slots.push(a, b);
    r.step();
    r.input.joinWatch = true;
    tap(r, b, PAD.start);
    expect(r.input.rumble(0, 0.5, 0.5, 100)).toBe(true);
    expect(b.effects.length).toBe(1);
    const noMotor = { ...fakePad(2), vibrationActuator: null } as GamepadLike;
    expect(playRumble(noMotor, 1, 1, 100)).toBe(false);
    const pulses: number[] = [];
    const haptic = { ...fakePad(3), vibrationActuator: undefined, hapticActuators: [{ pulse: (v: number) => pulses.push(v) }] } as unknown as GamepadLike;
    expect(playRumble(haptic, 0.3, 0.6, 100)).toBe(true);
    expect(pulses).toEqual([0.6]);
    const throwing = {
      ...fakePad(4),
      vibrationActuator: {
        playEffect: () => {
          throw new Error('NotSupportedError');
        },
      },
    } as GamepadLike;
    expect(() => playRumble(throwing, 1, 1, 100)).not.toThrow();
    const rejecting = { ...fakePad(5), vibrationActuator: { playEffect: () => Promise.reject(new Error('busy')) } } as GamepadLike;
    expect(playRumble(rejecting, 1, 1, 100)).toBe(true);
  });
});

describe('bindings and key sets for a pad join', () => {
  it('player 2 has its own pad map; old saves copy the shared one', () => {
    const b = defaultBindings();
    expect(b.pad2).toEqual(b.pad);
    expect(parseBindings(serializeBindings(b))).toEqual(b);
    const old = parseBindings(JSON.stringify({ pad: { fire: [3] } }));
    expect(old.pad.fire).toEqual([3]);
    expect(old.pad2.fire).toEqual([3]);
    expect(old.pad2.jump).toEqual([0]);
  });

  it('a pad join leaves the keyboard whole (solo keys for player 1)', () => {
    expect(keySetFor(0, 2, false)).toBe('solo');
    expect(keySetFor(1, 2, false)).toBeNull();
    expect(keySetFor(1, 2)).toBe('p2');
    const input = new InputManager();
    input.players = 2;
    expect(input.keySplit).toBe(true);
    input.keySplit = false;
    input.players = 1;
    expect(input.keySplit).toBe(false);
  });
});
