/**
 * The race input of a player slot (docs/design/rally.md §7.7, §12.5; docs/api/rally.md "A.D").
 *
 * The engine's race channel (engine/race-input.ts; an additive opt-in like the first-person one):
 * while `InputManager.raceMode` is on, each slot's `VirtualPad.race` holds its race input — the
 * 8-button pad (keyboard, any pad, `ScriptedSource`: LEFT / RIGHT steer, FIRE or UP gas, JUMP or
 * DOWN brake and reverse, BOMB handbrake), a pad's stick (analog steering), its triggers (analog gas
 * and brake), and the race buttons (camera, look back). `readRaceInput` copies it; with the race
 * mode off it falls back to the 8 buttons (`readPadInput`), so a race also drives with the plain
 * pads (tests, a scene that did not turn the mode on).
 */
import type { VirtualPad } from '../../engine/input';
import type { RallyInput } from './api';

/** The 8-button pad of a slot as race input (full lock, full gas, full brake). */
export function readPadInput(pad: VirtualPad, out: RallyInput): RallyInput {
  out.steer = (pad.held('left') ? 127 : 0) - (pad.held('right') ? 127 : 0);
  out.gas = pad.held('fire') || pad.held('up') ? 127 : 0;
  out.brake = pad.held('jump') || pad.held('down') ? 127 : 0;
  out.handbrake = pad.held('bomb');
  out.camera = false;
  out.lookBack = false;
  return out;
}

/** The race channel of a slot (`pad.race` while the race mode is on, else the 8 buttons). */
export function readRaceInput(pad: VirtualPad, out: RallyInput): RallyInput {
  if (!pad.raceOn) return readPadInput(pad, out);
  const r = pad.race;
  out.steer = r.steer;
  out.gas = r.gas;
  out.brake = r.brake;
  out.handbrake = r.handbrake;
  out.camera = r.camera;
  out.lookBack = r.lookBack;
  return out;
}

/** Copy a race input. */
export function copyRallyInput(out: RallyInput, a: Readonly<RallyInput>): RallyInput {
  out.steer = a.steer;
  out.gas = a.gas;
  out.brake = a.brake;
  out.handbrake = a.handbrake;
  out.camera = a.camera;
  out.lookBack = a.lookBack;
  return out;
}
