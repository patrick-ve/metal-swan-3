/**
 * The rally bot (docs/design/rally.md §14 item 3; docs/api/rally.md "A.D"): an `InputSource` that
 * drives the player cars of the running race THROUGH THE RACE CHANNEL (engine/race-input.ts: the
 * analog steer, gas and brake of `readRace`, as a pad with a stick and triggers would), so the sim
 * plays the real scene with the real input path. With the race mode off it presses the 8 buttons
 * instead (LEFT / RIGHT past a dead band, FIRE for gas, JUMP for the brake).
 *
 * Per slot and tick (in `update`, once, before the reads): a driver of its own (rally/ai.ts
 * `drive`: the racing line (`racing`) or its lane, the car ahead, the speed envelope of the track at
 * `pace`). It starts at GO
 * and stops at the car's finish (the race's cruise takes over). Deterministic: no rng; it reads the
 * race state of the last tick (a one-tick reaction, like a player).
 */
import type { InputContext, InputSource, PlayerSlot } from '../engine/input';
import { BUTTON_BIT } from '../engine/input';
import { mergeRaceAxes, type RaceAxes } from '../engine/race-input';
import { drive, newDriver, type Driver } from '../game/rally/ai';
import { emptyRallyInput, type CarState, type RallyInput } from '../game/rally/api';
import { GUIDE_AHEAD } from '../game/rally/rules/works';
import { rulesOf } from '../game/rally/rules/rules';
import type { RallyRunner } from '../game/rally/runner';

/** The steer the bot needs before it presses a direction with the 8 buttons (of 127). */
const DEAD = 24;

export class RallyBot implements InputSource {
  private readonly runner: () => RallyRunner | null;
  /** The bot's pace (of its car's top speed and grip; the rivals drive at about 0.93–0.96 on normal). */
  pace = 0.94;
  /** It follows the track's racing line (when the track has one) except while passing; false: lanes. */
  racing = true;
  /** The slots it drives (default both). */
  readonly slots: [boolean, boolean] = [true, true];
  private readonly drivers: [Driver | null, Driver | null] = [null, null];
  private readonly cars: [CarState | null, CarState | null] = [null, null];
  private readonly out: [RallyInput, RallyInput] = [emptyRallyInput(), emptyRallyInput()];
  private readonly active = [false, false];
  private readonly axes: RaceAxes = { steer: 0, gas: 0, brake: 0, buttons: 0 };

  constructor(runner: () => RallyRunner | null) {
    this.runner = runner;
  }

  update(): void {
    this.active[0] = this.active[1] = false;
    const r = this.runner();
    if (!r || r.phase !== 'race') return;
    for (let s = 0; s <= 1; s++) {
      const car = r.carOf(s);
      if (!car || car.finished || !this.slots[s]) continue;
      let d = this.drivers[s];
      if (this.cars[s] !== car || !d) {
        this.cars[s] = car;
        d = this.drivers[s] = newDriver(r.track, car.s, car.side, this.pace, true, this.racing);
      }
      // Like a player who reads the red X and the merge arrows: out of a lane the road works close ahead.
      const rules = rulesOf(r);
      if (rules) {
        const off = rules.offOf(car.dist);
        // Fixer (wave B): and keeps its line and its passes inside the open lanes (no shoulder under a red X).
        rules.works.keepLanes(off, d);
        const lane = rules.works.openLane(off, d.lane, GUIDE_AHEAD);
        if (lane !== d.lane) d.lane = lane;
      }
      drive(car, d, r.track, r.bodies, r.bodies.length, this.out[s]);
      this.active[s] = true;
    }
  }

  /** The 8 buttons (only with the race mode off). */
  read(slot: PlayerSlot, ctx: InputContext): number {
    if (!this.active[slot] || ctx.raceMode === true) return 0;
    const inp = this.out[slot];
    let mask = 0;
    if (inp.steer > DEAD) mask |= BUTTON_BIT.left;
    else if (inp.steer < -DEAD) mask |= BUTTON_BIT.right;
    if (inp.gas > 0) mask |= BUTTON_BIT.fire;
    if (inp.brake > 0) mask |= BUTTON_BIT.jump;
    return mask;
  }

  /** The race channel: analog steer, gas and brake. */
  readRace(slot: PlayerSlot, out: RaceAxes): void {
    if (!this.active[slot]) return;
    const inp = this.out[slot];
    const a = this.axes;
    a.steer = inp.steer;
    a.gas = inp.gas;
    a.brake = inp.brake;
    a.buttons = 0;
    mergeRaceAxes(out, a);
  }
}
