/**
 * The race input channel (docs/design/rally.md §7.7, §12.5; docs/api/rally.md "A.D") — an ADDITIVE
 * OPT-IN of the input layer, like the first-person channel (`input.fpsMode`), but for BOTH player
 * slots (the split screen). Off by default: every other mode is unchanged.
 *
 * While `InputManager.raceMode` is on, every tick each slot's `VirtualPad.race` holds that slot's
 * race input (`raceOn` true):
 *
 * - **The 8-button pad** (keyboard, any pad, `ScriptedSource`, the touch pad) — always, through the
 *   slot's `VirtualPad` (so `suppress()` still hides a held button after a menu): LEFT / RIGHT steer
 *   at full lock, FIRE or UP = full gas, JUMP or DOWN = full brake (and reverse), BOMB = handbrake.
 * - **Analog axes** from the sources that implement `InputSource.readRace` (`RaceAxes`): a pad's
 *   left stick steers in proportion (`stickSteer`), its triggers give analog gas (RT, standard 7)
 *   and brake (LT, standard 6) (`triggerValue`), and the race buttons (`RACE_BIT`): camera
 *   (standard 3: Y / triangle), look back (standard 4: LB / L1), handbrake (standard 5: RB / R1).
 *   The keyboard adds the race keys (`RACE_KEYS`: camera and look back per key set). Across sources
 *   the steer with the largest magnitude wins, gas and brake take the largest value, buttons OR.
 * - **Combined** (`raceFromPad`): an analog steer (non-zero) wins over the buttons (a d-pad press
 *   counts while the stick rests); gas and brake are the larger of the button and the trigger; the
 *   camera is an edge (pressed this tick), the look back and the handbrake are held.
 *
 * The race buttons and keys are fixed in this wave (CONTROLS does not rebind them yet). Pure TS
 * (no DOM): pads.ts and input.browser.ts feed it.
 */

/** Full scale of the analog values (steer −127…127, gas / brake 0…127). */
export const RACE_MAX = 127;

/** One slot's race input of one tick (`VirtualPad.race`; the game's `RallyInput` has the same shape). */
export interface RaceInput {
  /** −127 (full right) … 127 (full left). */
  steer: number;
  /** 0 … 127. */
  gas: number;
  /** 0 … 127 (brake; at a standstill: reverse). */
  brake: number;
  /** Held. */
  handbrake: boolean;
  /** Pressed this tick (the camera switch). */
  camera: boolean;
  /** Held (the view looks behind the car). */
  lookBack: boolean;
}

export function newRaceInput(): RaceInput {
  return { steer: 0, gas: 0, brake: 0, handbrake: false, camera: false, lookBack: false };
}

export function clearRaceInput(r: RaceInput): void {
  r.steer = 0;
  r.gas = 0;
  r.brake = 0;
  r.handbrake = false;
  r.camera = false;
  r.lookBack = false;
}

/** The race buttons beyond the 8-button pad (`RaceAxes.buttons`). */
export const RACE_BIT = Object.freeze({ handbrake: 1, camera: 2, lookBack: 4 });

/** What a source adds to a slot in one tick (`InputSource.readRace`; integers). */
export interface RaceAxes {
  /** −127 … 127 (+ = left); 0 = no analog steering. */
  steer: number;
  /** 0 … 127; 0 = no analog gas. */
  gas: number;
  brake: number;
  /** `RACE_BIT` mask, held. */
  buttons: number;
}

export function newRaceAxes(): RaceAxes {
  return { steer: 0, gas: 0, brake: 0, buttons: 0 };
}

export function clearRaceAxes(a: RaceAxes): void {
  a.steer = 0;
  a.gas = 0;
  a.brake = 0;
  a.buttons = 0;
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(v);
  return n < lo ? lo : n > hi ? hi : n || 0;
}

/** Add `a` into `into`: the steer with the larger magnitude, the larger gas and brake, buttons OR-ed. */
export function mergeRaceAxes(into: RaceAxes, a: Readonly<RaceAxes>): void {
  const s = clampInt(a.steer, -RACE_MAX, RACE_MAX);
  if (Math.abs(s) > Math.abs(into.steer)) into.steer = s;
  const g = clampInt(a.gas, 0, RACE_MAX);
  if (g > into.gas) into.gas = g;
  const b = clampInt(a.brake, 0, RACE_MAX);
  if (b > into.brake) into.brake = b;
  into.buttons |= a.buttons & 7;
}

// The 8-button bits (= input.ts BUTTON_BIT; repeated here so this module has no import cycle).
const LEFT = 1;
const RIGHT = 2;
const UP = 4;
const DOWN = 8;
const FIRE = 16;
const JUMP = 32;
const BOMB = 64;

/**
 * The race input of a slot: its 8-button `mask` (the VirtualPad's, after `suppress`) and the summed
 * analog `axes`; `prevButtons` = the race buttons held last tick (for the camera edge). Writes `out`
 * and returns the race buttons held now (pass them back next tick).
 */
export function raceFromPad(mask: number, axes: Readonly<RaceAxes>, prevButtons: number, out: RaceInput): number {
  const digital = (mask & LEFT ? RACE_MAX : 0) - (mask & RIGHT ? RACE_MAX : 0);
  out.steer = axes.steer !== 0 ? clampInt(axes.steer, -RACE_MAX, RACE_MAX) : digital;
  out.gas = Math.max(mask & (FIRE | UP) ? RACE_MAX : 0, clampInt(axes.gas, 0, RACE_MAX));
  out.brake = Math.max(mask & (JUMP | DOWN) ? RACE_MAX : 0, clampInt(axes.brake, 0, RACE_MAX));
  const held = axes.buttons & 7;
  out.handbrake = (mask & BOMB) !== 0 || (held & RACE_BIT.handbrake) !== 0;
  out.camera = (held & RACE_BIT.camera) !== 0 && (prevButtons & RACE_BIT.camera) === 0;
  out.lookBack = (held & RACE_BIT.lookBack) !== 0;
  return held;
}

/** The keyboard's race keys per key set (KeyboardEvent.code; fixed in this wave, free in every set). */
export const RACE_KEYS: Readonly<Record<'solo' | 'p1' | 'p2', { readonly camera: readonly string[]; readonly lookBack: readonly string[] }>> = Object.freeze({
  solo: { camera: ['KeyV'], lookBack: ['KeyB'] },
  p1: { camera: ['KeyR'], lookBack: ['KeyT'] },
  p2: { camera: ['Quote', 'Numpad4'], lookBack: ['Semicolon', 'Numpad5'] },
});

/** The race buttons of a pad (standard indices; fixed in this wave, unused by the default pad map). */
export const RACE_PAD = Object.freeze({ brakeTrigger: 6, gasTrigger: 7, camera: 3, lookBack: 4, handbrake: 5 });

/** Axial dead zone of the steering stick. */
export const STEER_DEAD_ZONE = 0.12;
/** Dead zone of an analog trigger (0..1). */
export const TRIGGER_DEAD_ZONE = 0.06;

/**
 * A raw stick X (−1 left … 1 right) → steer (+ = left, −127…127): an axial dead zone, rescaled, with
 * a softer centre (x·(0.4 + 0.6·|x|)) for small corrections at speed. NaN or a hat value → 0.
 */
export function stickSteer(x: number, dead = STEER_DEAD_ZONE): number {
  if (!(x >= -1.05 && x <= 1.05)) return 0;
  const a = Math.abs(x);
  if (a <= dead) return 0;
  const t = Math.min(1, (a - dead) / (1 - dead));
  const n = clampInt(t * (0.4 + 0.6 * t) * RACE_MAX, 0, RACE_MAX);
  return n === 0 ? 0 : x > 0 ? -n : n;
}

/** A trigger value (0..1) → 0…127 with a small dead zone; anything outside 0..1.05 → 0. */
export function triggerValue(v: number, dead = TRIGGER_DEAD_ZONE): number {
  if (!(v > dead && v <= 1.05)) return 0;
  return clampInt(((Math.min(1, v) - dead) / (1 - dead)) * RACE_MAX, 0, RACE_MAX);
}
