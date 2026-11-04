/**
 * The Swan's neck-strip frame picks (presentation only; docs/design/ams40.md wave 7, "The Swan").
 *
 * The baked neck strips (tools/art40/chars/swan-neck/, `npm run art40 -- swan-neck`) are indexed
 * by the AIM first: frame = aim × phases + phase. The aim is the game's neckIndex (the barrel on the
 * drum turns to θ = +45° − 22.5°·i; the neck is free); the phase is the step of the face's timing
 * (the shot, the recoil, the return of the gun; the snap, wince and recovery of a hit; the honk's
 * draw-back, strain, snap and hold). The durations of one aim's phases are the face's time in the
 * game, so this module reads them from the baked strip itself (`NECK_ART`), never from the sprite
 * registry: the pick also works headless and before the art is registered.
 */
import {
  NECK_AIMS,
  NECK_FIRE_PHASES,
  NECK_HONK_PHASES,
  NECK_HURT_PHASES,
  NECK_RELAX_BLINK,
  NECK_RELAX_OPEN,
  NECK_RELAX_PHASES,
  NECK_SHELL_PHASES,
  SET as NECK_ART,
} from '../../art40/swan-neck.gen';

export { NECK_AIMS, NECK_HONK_BLAST, NECK_RELAX_BLINK, NECK_RELAX_OPEN } from '../../art40/swan-neck.gen';

/** The baked neck set (the strips' durations and frame counts). */
export { NECK_ART };

/** The aim the parked and riderless Swan rests her gun at: level forward (θ = 0°). */
export const NECK_REST_AIM = 2;

/** Phases per aim of a neck strip (its name without the colour prefix). */
export function neckPhases(name: string): number {
  if (name.endsWith('-fire')) return NECK_FIRE_PHASES;
  if (name.endsWith('-shell')) return NECK_SHELL_PHASES;
  if (name.endsWith('-hurt')) return NECK_HURT_PHASES;
  if (name.endsWith('-relax')) return NECK_RELAX_PHASES;
  if (name === 'neck-honk' || name === 'swim-neck-honk') return NECK_HONK_PHASES;
  return 1;
}

const phaseDurs = new Map<string, readonly number[]>();

/** The durations of one aim's phases (the baked strip's first `neckPhases(name)` durations). */
export function neckPhaseDurations(name: string): readonly number[] {
  let d = phaseDurs.get(name);
  if (!d) {
    const st = NECK_ART.strips[name];
    d = Object.freeze(st ? st.durations.slice(0, neckPhases(name)) : [1]);
    phaseDurs.set(name, d);
  }
  return d;
}

/** Ticks a face takes in the game: the sum of one aim's phase durations. */
export function neckFaceTicks(name: string): number {
  let t = 0;
  for (const d of neckPhaseDurations(name)) t += d;
  return t;
}

/** The number of aims a neck strip has (9; 1 for the crouch and duck necks). */
export function neckAims(name: string): number {
  const st = NECK_ART.strips[name];
  return st ? Math.max(1, Math.floor(st.frames.length / neckPhases(name))) : 1;
}

/** The phase at `elapsed` ticks into a face (the last phase holds; below 0 = the first). */
export function neckPhaseAt(name: string, elapsed: number): number {
  const d = neckPhaseDurations(name);
  let t = Math.max(0, Math.floor(elapsed));
  for (let i = 0; i < d.length; i++) {
    t -= d[i];
    if (t < 0) return i;
  }
  return d.length - 1;
}

/**
 * The frame of neck strip `name` at aim `aim` (0..8; clamped, and 0 on a one-aim strip) and
 * `elapsed` ticks into its face.
 */
export function neckFrame(name: string, aim: number, elapsed: number): number {
  const aims = neckAims(name);
  const a = aims <= 1 ? 0 : Math.min(aims - 1, Math.max(0, Math.round(aim)));
  return a * neckPhases(name) + neckPhaseAt(name, elapsed);
}

/** The relaxed neck (`neck-relax`, `swim-neck-relax`) at an aim, eye open or in the blink. */
export function relaxFrame(aim: number, blink: boolean): number {
  const a = Math.min(NECK_AIMS - 1, Math.max(0, Math.round(aim)));
  return a * NECK_RELAX_PHASES + (blink ? NECK_RELAX_BLINK : NECK_RELAX_OPEN);
}

/** The relaxed neck at rest (the eye open, the gun level): the frame a scene draws for a parked Swan. */
export const NECK_REST_FRAME = relaxFrame(NECK_REST_AIM, false);

/** The resting frame of any neck strip for a scene that draws one still picture (lake, swan jet). */
export function restFrame(name: string): number {
  return name.endsWith('-relax') ? NECK_REST_FRAME : neckFrame(name, NECK_REST_AIM, 0);
}
