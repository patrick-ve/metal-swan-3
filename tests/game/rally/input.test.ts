/**
 * The race input channel (src/engine/race-input.ts, input.ts, pads.ts; docs/design/rally.md §7.7,
 * §12.5): an additive opt-in for both slots — off by default, the 8-button pad (keyboard, any pad,
 * ScriptedSource), a pad's stick and triggers, the race buttons, the suppress rule, the camera edge.
 */
import { describe, expect, it } from 'vitest';
import { BUTTON_BIT, defaultBindings, InputManager, ScriptedSource, timeline, type Button, type InputContext, type InputSource, type PlayerSlot } from '../../../src/engine/input';
import { defaultFpsKeyMap } from '../../../src/engine/input-actions';
import { PadSource, type GamepadLike } from '../../../src/engine/pads';
import { mergeRaceAxes, newRaceAxes, RACE_BIT, RACE_KEYS, RACE_MAX, RACE_PAD, raceFromPad, stickSteer, triggerValue, type RaceAxes } from '../../../src/engine/race-input';
import { emptyRallyInput, type RallyInput } from '../../../src/game/rally/api';
import { readPadInput, readRaceInput } from '../../../src/game/rally/input';

/** A fake standard pad: 18 buttons (values), axes. */
function pad(index: number, o: { axes?: number[]; pressed?: number[]; values?: Record<number, number> } = {}): GamepadLike {
  const buttons = Array.from({ length: 18 }, (_, i) => {
    const value = o.values?.[i] ?? (o.pressed?.includes(i) ? 1 : 0);
    return { pressed: value > 0.5 || (o.pressed?.includes(i) ?? false), value };
  });
  return { id: `Test Pad ${index} (STANDARD GAMEPAD Vendor: 045e Product: 02ea)`, index, connected: true, mapping: 'standard', buttons, axes: o.axes ?? [0, 0, 0, 0] };
}

describe('the race channel is an opt-in (off: nothing changes)', () => {
  it('race mode off by default: the race input stays zero and `raceOn` false; the pads work as before', () => {
    const input = new InputManager();
    expect(input.raceMode).toBe(false);
    input.addSource(new ScriptedSource(timeline().hold(['left', 'fire'], 10), 0, { race: (_t, o) => (o.steer = 50) }));
    input.update();
    expect(input.pad(0).held('left')).toBe(true);
    expect(input.pad(0).raceOn).toBe(false);
    expect(input.pad(0).race).toEqual({ steer: 0, gas: 0, brake: 0, handbrake: false, camera: false, lookBack: false });
    // The rally falls back to the 8 buttons.
    expect(readRaceInput(input.pad(0), emptyRallyInput())).toEqual(readPadInput(input.pad(0), emptyRallyInput()));
  });

  it('turning it off clears both slots once', () => {
    const input = new InputManager();
    input.raceMode = true;
    input.addSource(new ScriptedSource(timeline().hold('fire', 10)));
    input.update();
    expect(input.pad(0).race.gas).toBe(RACE_MAX);
    input.raceMode = false;
    input.update();
    expect(input.pad(0).raceOn).toBe(false);
    expect(input.pad(0).race.gas).toBe(0);
  });
});

describe('the 8-button pad (keyboard, any pad, ScriptedSource) as race input', () => {
  it('LEFT / RIGHT steer at full lock (+ = left), FIRE or UP gas, JUMP or DOWN brake, BOMB handbrake', () => {
    const input = new InputManager();
    input.raceMode = true;
    const cases: [Button[], Partial<RallyInput>][] = [
      [['left'], { steer: 127 }],
      [['right'], { steer: -127 }],
      [['left', 'right'], { steer: 0 }],
      [['fire'], { gas: 127 }],
      [['up'], { gas: 127 }],
      [['jump'], { brake: 127 }],
      [['down'], { brake: 127 }],
      [['bomb'], { handbrake: true }],
    ];
    for (const [buttons, want] of cases) {
      const src = new ScriptedSource(() => buttons);
      const off = input.addSource(src);
      input.update();
      expect(input.pad(0).race).toMatchObject({ steer: 0, gas: 0, brake: 0, handbrake: false, ...want });
      off();
      input.update();
    }
  });

  it('both slots: player 2 drives its own channel', () => {
    const input = new InputManager();
    input.players = 2;
    input.raceMode = true;
    input.addSource(new ScriptedSource(timeline().hold('right', 5), 1));
    input.addSource(new ScriptedSource(timeline().hold('fire', 5), 0));
    input.update();
    expect(input.pad(1).race.steer).toBe(-127);
    expect(input.pad(1).race.gas).toBe(0);
    expect(input.pad(0).race.gas).toBe(127);
    expect(input.pad(0).race.steer).toBe(0);
  });

  it('a button held through a menu (suppress) gives no gas until it is released', () => {
    const input = new InputManager();
    input.raceMode = true;
    input.addSource(new ScriptedSource(timeline().hold('fire', 3).idle(1).hold('fire', 3)));
    input.update();
    input.suppress();
    input.update();
    expect(input.pad(0).race.gas).toBe(0);
    input.update();
    input.update(); // released
    input.update(); // pressed again
    expect(input.pad(0).race.gas).toBe(127);
  });
});

describe('analog sources: ScriptedSource race axes, the pad stick, triggers and race buttons', () => {
  it('an analog steer wins over the buttons; gas / brake take the larger; the camera is an edge, the look back is held', () => {
    const input = new InputManager();
    input.raceMode = true;
    let steer = 40;
    let buttons: number = RACE_BIT.camera;
    input.addSource(new ScriptedSource(timeline().hold(['right', 'fire'], 100), 0, { race: (_t, o) => ((o.steer = steer), (o.gas = 30), (o.brake = 70), (o.buttons = buttons)) }));
    input.update();
    const r = input.pad(0).race;
    expect(r.steer).toBe(40);
    expect(r.gas).toBe(127);
    expect(r.brake).toBe(70);
    expect(r.camera).toBe(true);
    input.update();
    expect(r.camera).toBe(false); // held: no new press
    buttons = RACE_BIT.lookBack | RACE_BIT.handbrake;
    steer = 0; // the stick rests: the d-pad's RIGHT counts
    input.update();
    expect(r.lookBack).toBe(true);
    expect(r.handbrake).toBe(true);
    expect(r.steer).toBe(-127);
    buttons = RACE_BIT.camera;
    input.update();
    expect(r.camera).toBe(true);
    // The rally reads the channel as it is.
    expect(readRaceInput(input.pad(0), emptyRallyInput())).toEqual({ ...r });
  });

  it('a pad: the left stick steers in proportion, RT gas, LT brake, Y camera, LB look back, RB handbrake', () => {
    let gp: GamepadLike[] = [pad(0, { axes: [-0.5, 0, 0, 0], values: { [RACE_PAD.gasTrigger]: 0.5, [RACE_PAD.brakeTrigger]: 0.25 }, pressed: [RACE_PAD.camera, RACE_PAD.lookBack, RACE_PAD.handbrake] })];
    const input = new InputManager();
    input.raceMode = true;
    input.useGamepads(new PadSource(() => gp));
    input.update();
    const r = input.pad(0).race;
    expect(r.steer).toBe(stickSteer(-0.5));
    expect(r.steer).toBeGreaterThan(20);
    expect(r.steer).toBeLessThan(127);
    expect(r.gas).toBe(triggerValue(0.5));
    expect(r.brake).toBe(triggerValue(0.25));
    expect(r.camera && r.lookBack && r.handbrake).toBe(true);
    // Full right stick: full right lock.
    gp = [pad(0, { axes: [1, 0, 0, 0] })];
    input.update();
    expect(r.steer).toBe(-127);
    // The stick in its dead zone: no analog steer (and no stick bits).
    gp = [pad(0, { axes: [0.05, 0, 0, 0] })];
    input.update();
    expect(r.steer).toBe(0);
  });

  it('2 players: each slot its own pad; 1 player: every pad drives slot 0', () => {
    const gp: GamepadLike[] = [pad(0, { axes: [1, 0, 0, 0] }), pad(1, { values: { [RACE_PAD.gasTrigger]: 1 } })];
    const src = new PadSource(() => gp);
    const input = new InputManager();
    input.raceMode = true;
    input.useGamepads(src);
    input.update();
    expect(input.pad(0).race.steer).toBe(-127);
    expect(input.pad(0).race.gas).toBe(127);
    input.players = 2;
    input.update();
    src.claim(0, 0);
    src.claim(1, 1);
    input.update();
    expect(input.pad(0).race.steer).toBe(-127);
    expect(input.pad(0).race.gas).toBe(0);
    expect(input.pad(1).race.gas).toBe(127);
    expect(input.pad(1).race.steer).toBe(0);
  });

  it('race mode off: the pad source computes no race axes at all', () => {
    const gp: GamepadLike[] = [pad(0, { axes: [1, 0, 0, 0] })];
    const src = new PadSource(() => gp);
    const input = new InputManager();
    input.useGamepads(src);
    input.update();
    const out = newRaceAxes();
    src.readRace(0, out);
    expect(out).toEqual(newRaceAxes());
  });
});

describe('the helpers', () => {
  it('stickSteer: + = left, a dead zone, a soft centre, full lock at the edge, junk → 0', () => {
    expect(stickSteer(0)).toBe(0);
    expect(stickSteer(0.1)).toBe(0);
    expect(stickSteer(-1)).toBe(127);
    expect(stickSteer(1)).toBe(-127);
    expect(Object.is(stickSteer(0.11), 0)).toBe(true);
    expect(stickSteer(-0.3)).toBeLessThan(Math.round(((0.3 - 0.12) / 0.88) * 127));
    expect(stickSteer(Number.NaN)).toBe(0);
    expect(stickSteer(9 / 7)).toBe(0);
    for (let x = -1; x <= 1; x += 0.01) expect(Math.abs(stickSteer(x))).toBeLessThanOrEqual(127);
  });

  it('triggerValue: 0..127 with a small dead zone; mergeRaceAxes: largest steer, max pedals, OR buttons', () => {
    expect(triggerValue(0)).toBe(0);
    expect(triggerValue(0.05)).toBe(0);
    expect(triggerValue(1)).toBe(127);
    expect(triggerValue(-1)).toBe(0);
    const a: RaceAxes = { steer: -30, gas: 10, brake: 0, buttons: 1 };
    mergeRaceAxes(a, { steer: 20, gas: 5, brake: 300, buttons: 4 });
    expect(a).toEqual({ steer: -30, gas: 10, brake: 127, buttons: 5 });
  });

  it('raceFromPad maps the 8-button mask as the rally expects', () => {
    const out = emptyRallyInput();
    const none = newRaceAxes();
    raceFromPad(BUTTON_BIT.left | BUTTON_BIT.up | BUTTON_BIT.bomb, none, 0, out);
    expect(out).toEqual({ steer: 127, gas: 127, brake: 0, handbrake: true, camera: false, lookBack: false });
  });

  it('the race keys are free: no default key set, pause, mute, debug or first-person key uses them', () => {
    const b = defaultBindings();
    const used = new Set<string>([...b.pause, 'KeyM', 'Digit2', ...Object.values(defaultFpsKeyMap()).flat()]);
    for (const set of [b.solo, b.p1, b.p2]) for (const codes of Object.values(set)) for (const c of codes) used.add(c);
    for (const set of Object.values(RACE_KEYS)) for (const c of [...set.camera, ...set.lookBack]) {
      expect(used.has(c), c).toBe(false);
      expect(/^F\d+$/.test(c)).toBe(false);
    }
    // The pad's race buttons are not in the default pad map.
    const padUsed = new Set(Object.values(b.pad).flat());
    for (const i of Object.values(RACE_PAD)) expect(padUsed.has(i)).toBe(false);
  });

  it('a source with readRace gets the context (race mode on, both slots)', () => {
    const seen: string[] = [];
    const src: InputSource = {
      read: () => 0,
      readRace(slot: PlayerSlot, _out: RaceAxes, ctx: InputContext) {
        seen.push(`${slot}:${ctx.raceMode}`);
      },
    };
    const input = new InputManager();
    input.addSource(src);
    input.update();
    expect(seen).toEqual([]);
    input.raceMode = true;
    input.update();
    expect(seen).toEqual(['0:true', '1:true']);
  });
});
