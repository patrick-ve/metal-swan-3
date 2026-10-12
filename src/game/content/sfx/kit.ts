/**
 * Sound-design kit for the sfx recipes: small pure builders that return synth layers
 * (docs/api/media.md §9.1, docs/api/sfx.md). Nothing here registers anything.
 *
 * Conventions used by every recipe file:
 * - Times are seconds, frequencies Hz, gains linear. GDD §12.1 numbers are used as written.
 * - Noise is always filtered; attacks are 0.5–5 ms; tails decay fast (arcade punch).
 * - Loops (`loopRecipe`) have a flat envelope and loop lengths that hold whole cycles of every
 *   tone and LFO, so the seam is clean.
 */
import type { FilterSpec, SfxLayer, SfxRecipe } from '../../../engine/synth';

export type Recipes = Record<string, SfxRecipe>;
type Extra = Partial<SfxLayer>;

// ---------------------------------------------------------------------------------------------
// Pitch helpers
// ---------------------------------------------------------------------------------------------

/** Semitones → frequency ratio. */
export const st = (n: number): number => Math.pow(2, n / 12);

const NAMES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Note name → Hz ('A4' = 440, 'F#5', 'Bb3'). Throws on a typo (caught by the tests at import). */
export function hz(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`sfx kit: bad note "${name}"`);
  const semis = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export const LP = (freq: number, to?: number, q?: number): FilterSpec => ({ type: 'lowpass', freq, to, q });
export const HP = (freq: number, to?: number, q?: number): FilterSpec => ({ type: 'highpass', freq, to, q });
export const BP = (freq: number, to?: number, q?: number): FilterSpec => ({ type: 'bandpass', freq, to, q });

// ---------------------------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------------------------

/** A tone with an exponential pitch sweep (freq → to over `d`) and a pluck envelope of `d`. */
export function tone(wave: SfxLayer['wave'], freq: number, to: number, d: number, vol: number, x: Extra = {}): SfxLayer {
  return { wave, freq, to, sweep: x.sweep ?? d, env: { a: 0.002, d }, vol, ...x };
}

/** Filtered white-noise burst of `d` seconds. */
export function noise(d: number, vol: number, filter: FilterSpec, x: Extra = {}): SfxLayer {
  return { wave: 'noise', env: { a: 0.001, d }, vol, filter, ...x };
}

/** A very short click (a transient on top of a sound). */
export function click(freq: number, vol: number, delay = 0): SfxLayer {
  return { wave: 'square', freq, to: freq * 0.5, env: { a: 0.0005, d: 0.012 }, vol, delay, filter: LP(6000) };
}

/** A noisy mechanical click (latches, clacks, ratchets): a square tick plus a noise tick. */
export function clack(freq: number, vol: number, delay = 0, d = 0.018): SfxLayer[] {
  return [
    { wave: 'square', freq, to: freq * 0.6, env: { a: 0.0005, d }, vol: vol * 0.7, delay, filter: LP(5000) },
    { wave: 'noise', env: { a: 0.0005, d: d * 0.6 }, vol, delay, filter: BP(freq * 2.2, undefined, 1.4) },
  ];
}

/**
 * A bell / metal "ting" from sine partials at inharmonic ratios with fast-decaying highs
 * (the older bell; `fmBell` is brighter and rings more like metal).
 */
export function bell(freq: number, d: number, vol: number, delay = 0, ratios: readonly number[] = [1, 2.76, 5.4]): SfxLayer[] {
  return ratios.map((r, i) => ({
    wave: 'sine' as const,
    freq: freq * r,
    env: { a: 0.001, d: d / (1 + i * 0.9) },
    vol: vol / (1 + i * 0.8),
    delay,
  }));
}

export interface FmBellOpts {
  /** Modulator ratio (default 3.5: a bright, inharmonic bell). 1.4: gong / clang. 1: piano-ish. */
  ratio?: number;
  /** Start index (default 4). */
  index?: number;
  /** Index decay time (default d / 4): the brightness fades before the tone. */
  decay?: number;
  delay?: number;
  /** A quiet octave partial for a glassier ring (default 0). */
  octave?: number;
}

/** FM bell (GDD "FM bell"): a sine carrier phase-modulated by an inharmonic sine. */
export function fmBell(freq: number, d: number, vol: number, o: FmBellOpts = {}): SfxLayer[] {
  const layers: SfxLayer[] = [
    {
      wave: 'sine',
      freq,
      env: { a: 0.0008, d },
      vol,
      delay: o.delay ?? 0,
      fm: { ratio: o.ratio ?? 3.5, index: o.index ?? 4, decay: o.decay ?? d / 4 },
    },
  ];
  if (o.octave) layers.push({ wave: 'sine', freq: freq * 2.01, env: { a: 0.0008, d: d * 0.4 }, vol: vol * o.octave, delay: o.delay ?? 0 });
  return layers;
}

/** A held note (melodic jingles): short attack, `len` at 75 %, quick release. */
export function note(wave: SfxLayer['wave'], freq: number, len: number, vol: number, delay = 0, x: Extra = {}): SfxLayer {
  return { wave, freq, env: { a: 0.003, d: 0.03, s: 0.75, hold: len, r: 0.05 }, vol, delay, ...x };
}

/** Notes played one after another: [freq, length] pairs from `delay` on, built by `make`. */
export function seq(
  notes: readonly (readonly [number, number])[],
  make: (freq: number, len: number, delay: number, i: number) => SfxLayer | SfxLayer[],
  delay = 0,
): SfxLayer[] {
  const out: SfxLayer[] = [];
  let t = delay;
  notes.forEach(([f, len], i) => {
    if (f > 0) {
      const l = make(f, len, t, i);
      if (Array.isArray(l)) out.push(...l);
      else out.push(l);
    }
    t += len;
  });
  return out;
}

/** `n` hits at accelerating (k > 1) or steady (k = 1) intervals: the start times. */
export function hits(n: number, first: number, gap: number, k = 1): number[] {
  const out: number[] = [];
  let t = first;
  let g = gap;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += g;
    g /= k;
  }
  return out;
}

/**
 * A fixed pseudo-random sequence in [0, 1) (an LCG with a constant seed): crowd claps,
 * droplets and crackles are "random" but identical on every run and machine.
 */
export function scatter(n: number, seed: number): number[] {
  const out: number[] = [];
  let x = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push(x / 4294967296);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------------------------

/** Cross-fade of every loop recipe (seconds). */
export const LOOP_FADE = 0.05;

/** Flat envelope for a layer of a loop that is `len` seconds long after the cross-fade. */
export function loopEnv(len: number): SfxLayer['env'] {
  return { a: 0, s: 1, hold: len + LOOP_FADE, r: 0 };
}

/**
 * A seamless loop of `len` seconds for `AudioOut.sfxLoop` (engines, rotors, drones, wind).
 * Every layer of `layers` gets the flat loop envelope (pick tones and LFO rates that make whole
 * cycles in `len`); `events` are one-shot layers inside the loop (drips, clicks) that keep their
 * own envelopes and delays.
 */
export function loopRecipe(len: number, vol: number, layers: readonly SfxLayer[], events: readonly SfxLayer[] = []): SfxRecipe {
  return {
    vol,
    voices: 1,
    gap: 0,
    loop: true,
    loopFade: LOOP_FADE,
    layers: [...layers.map((l) => ({ ...l, env: loopEnv(len) })), ...events],
  };
}

// ---------------------------------------------------------------------------------------------
// The Swan's honk family (swan/honk, swan/migrate, boss/goose-honk, trumpeter/bail, ui/select-confirm)
// ---------------------------------------------------------------------------------------------

export interface HonkOpts {
  /** Pitch the honk settles on (GDD: 220 Hz). */
  base?: number;
  /** Total length in seconds (GDD: 0.4). */
  len?: number;
  /** Semitones below `base` where the scoop starts (default 2). */
  scoop?: number;
  /** Semitones the honk slides after the scoop over its whole length (migrate: −5, a fourth). */
  slide?: number;
  /** Start offset (seconds). */
  delay?: number;
  /** Overall gain of the honk layers (default 1). */
  vol?: number;
  /** Fade over the whole length instead of a held note (the migrate honk fades out over 1 s). */
  fade?: boolean;
  /** Nasal band-pass centre (GDD: 1.2 kHz). */
  formant?: number;
  /** Extra grit per layer (the goose: distorted). */
  drive?: number;
}

/**
 * The SWAN-3 honk: a saw and a pulse at `base` (220 Hz) through a nasal band-pass (1.2 kHz),
 * with a quick pitch scoop up from `scoop` semitones below, a reedy 26 Hz flutter and a breathy
 * rasp at the onset. A robot goose horn — never a sampled animal.
 */
export function honk(o: HonkOpts = {}): SfxLayer[] {
  const base = o.base ?? 220;
  const len = o.len ?? 0.4;
  const delay = o.delay ?? 0;
  const v = o.vol ?? 1;
  const formant = o.formant ?? 1200;
  const scoopT = Math.min(0.07, len * 0.25);
  // One envelope for the voiced layers: a held note, or a fade over the whole length.
  const env = o.fade
    ? { a: 0.012, d: Math.max(0.05, len - 0.012) }
    : { a: 0.012, d: 0.06, s: 0.78, hold: Math.max(0.02, len - 0.012 - 0.06 - 0.07), r: 0.07 };
  // Pitch: a scoop up from below, then (migrate) a slide over the rest of the honk.
  const bend: [number, number][] = [
    [0, -(o.scoop ?? 2)],
    [scoopT, 0],
  ];
  if (o.slide) bend.push([len, o.slide]);
  const pitch = (mult: number): Extra => ({ freq: base * mult, bend });
  const flutter = { rate: 26, depth: 0.18, shape: 'sine' as const, delay: scoopT };
  return [
    // The nasal body: a saw through the 1.2 kHz band-pass.
    { wave: 'saw', ...pitch(1), env, vol: 0.62 * v, delay, filter: BP(formant, undefined, 2.4), drive: o.drive, tremolo: flutter, vibrato: { rate: 5.5, depth: 0.12, delay: scoopT } },
    // A 30 % pulse a hair sharp: the reedy beat and the horn's "edge".
    { wave: 'pulse', duty: 0.3, ...pitch(1.006), env, vol: 0.42 * v, delay, filter: BP(formant * 0.92, undefined, 3), drive: o.drive },
    // A second formant for the "onk" brightness.
    { wave: 'saw', ...pitch(1), env, vol: 0.22 * v, delay, filter: BP(formant * 2.15, undefined, 4) },
    // Chest: the fundamental, low-passed.
    { wave: 'triangle', ...pitch(1), env, vol: 0.28 * v, delay, filter: LP(600) },
    // The rasp at the onset ("h-ONK").
    { wave: 'noise', env: { a: 0.004, d: 0.05 }, vol: 0.35 * v, delay, filter: BP(formant * 1.3, undefined, 1.2) },
  ];
}
