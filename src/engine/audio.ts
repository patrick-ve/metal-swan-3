/**
 * Shared audio contract (docs/ARCHITECTURE.md §5.7), pre-written by the orchestrator.
 * The media-core agent owns this file: extend it (recipes, songs, registries), but do not rename
 * or remove members of AudioOut — the simulation side codes against them in parallel.
 * The Web Audio implementation lives in audio.browser.ts.
 */

import type { SayOpts } from './samples';

export type VolumeKind = 'master' | 'music' | 'sfx' | 'voice';

export interface SfxOpts {
  /** 0..1 multiplier, default 1. */
  vol?: number;
  /** Playback-rate multiplier, default 1. */
  pitch?: number;
  /** -1 (left) .. 1 (right), default 0. */
  pan?: number;
}

export interface MusicOpts {
  fadeTicks?: number;
  /** Restart even if the same song is already playing. */
  restart?: boolean;
  /**
   * Start at this index of the song's order list (default 0: the top). The song then loops as
   * usual (to its `loop` slot). Ignored when the same song keeps playing (no `restart`).
   */
  from?: number;
  /**
   * Play the song ONCE to its end even when it loops (the rally's radio: a song, then the DJ, then
   * the next song); the song-end event (`onSongEnd`) fires at its end. Optional and opt-in (rally
   * wave C); without it a looping song loops as before. A song that ended stays the current one:
   * `music(sameId)` without `restart` then does nothing (as before), so pass `restart: true`.
   */
  once?: boolean;
}

/** What plays the current song: the synth tracker, a decoded sample or a streamed file. */
export type SongSource = 'synth' | 'sample' | 'stream';

/** The current song (`AudioOut.songState`; rally wave C). */
export interface SongState {
  id: string;
  source: SongSource;
  /** Seconds into the song or file, folded into its loop (a song played `once` is not folded). */
  position: number;
  /** Seconds of one pass (synth), of the file (sample, stream). */
  duration: number;
  /** It played to its end (a one-shot, or a song played `once`); it never ends while it loops. */
  ended: boolean;
  paused: boolean;
}

/**
 * The car radio (`AudioOut.setRadio`; rally wave C, docs/design/rally.md §8, §12.6): a chain on the
 * music bus (after the dialogue duck) and the voice bus. All fields 0..1; absent = the default.
 */
export interface RadioOpts {
  /** The car-speaker band-pass (a high-pass up to 180 Hz and a low-pass down to 4.5 kHz). Default 1. */
  speaker?: number;
  /** The tunnel muffle (a low-pass from 20 kHz down to 300 Hz). Default 0. */
  muffle?: number;
  /** The programme level (music + voice; 0 = no reception, the DJ's take is cut). Default 1. */
  signal?: number;
  /** The static loop's level (follows the music volume; under the speaker filter, not the muffle). Default 0. */
  static?: number;
  /** A sound effect id (sampled or synth) for the static loop; default: the output's own noise. */
  staticId?: string;
  /** Seconds for the change (default 0.2, 0.005 … 5). */
  ramp?: number;
}

/**
 * A parametric engine voice (`AudioOut.engine`; rally wave C): oscillators at the firing frequency
 * plus band-passed noise and a turbo whine, driven by rpm and load through AudioParam ramps (call
 * it as often as every tick; the output smooths). `engineParams` turns it into the node values.
 */
export interface EngineOpts {
  /** Engine speed (revolutions per minute, clamped ENGINE_RPM_MIN … ENGINE_RPM_MAX). */
  rpm: number;
  /** Throttle load 0 (coasting) … 1 (full gas): louder, brighter and rougher under load. */
  load: number;
  /** −1 (left) … 1 (right), default 0 (the centre keeps the level of an unpanned loop). */
  pan?: number;
  /** 0..1, default 1. */
  vol?: number;
  /** Cylinders 1 … 12 (default 4): the firing frequency is rpm / 60 × cyl / 2. */
  cyl?: number;
  /** A pitch multiplier on top (the doppler, `dopplerPitch`; 0.25 … 4, default 1). */
  pitch?: number;
  /** The turbo whine 0..1 (the estates; it rises with rpm and load). Default 0. */
  turbo?: number;
  /** The exhaust noise 0..1. Default 0.3. */
  rough?: number;
  /** The tone colour 0 (dull, far) … 1 (bright, a revving hatchback). Default 0.5. */
  bright?: number;
}

/** A feedback echo on the sound effects (`AudioOut.setEcho`): seconds, 0 … 0.9, wet 0 … 1. */
export interface EchoOpts {
  delay: number;
  feedback: number;
  mix: number;
}

export interface AudioOut {
  sfx(id: string, o?: SfxOpts): void;
  /** Start a song by id, or stop music with null. */
  music(id: string | null, o?: MusicOpts): void;
  /**
   * Announcer line: its voice sample when one is loaded (`voiceKey(line)`, samples.ts), else
   * speech synthesis when available and enabled, else a short jingle.
   */
  voice(line: string): void;
  setVolume(kind: VolumeKind, v: number): void;
  stopAll(): void;
  /** Called once per simulation tick; may be a no-op. */
  update?(): void;
  /** Pause / resume the current song, keeping its position (pause menu). */
  pauseMusic?(): void;
  resumeMusic?(): void;
  /**
   * A looping sound under a key (engines, rotors, drones, a held laser). The same key with the
   * same id keeps playing (vol / pitch / pan are updated); a new id replaces it. Stop it with
   * `stopSfx(key)`; owners stop their loops when they die or leave (e.g. in `onRemove`).
   */
  sfxLoop?(key: string, id: string, o?: SfxOpts): void;
  /** Stop the looping sound of a key, fading over `fadeTicks` (default 4). */
  stopSfx?(key: string, fadeTicks?: number): void;
  /** Music level factor on top of the music volume (pause menu 0.5; 1 = normal). */
  duckMusic?(factor: number): void;
  /** Silence everything without losing the volume settings. */
  setMuted?(muted: boolean): void;
  /**
   * A feedback echo on the sound-effect bus (a tunnel), or null to fade it out. Optional and
   * opt-in (ring wave B, the tunnels): nothing else calls it; headless outputs have none.
   */
  setEcho?(o: EchoOpts | null): void;
  /** Suspend / resume all audio output (hidden tab). */
  suspend?(): void;
  resume?(): void;
  /**
   * Fetch and decode a sample group ('boot', 'mission:ams'; samples.ts). Resolves when every
   * file is decoded or has failed (it never rejects); until then the synth plays. Optional:
   * headless outputs (NullAudio, the sim stats) have none.
   */
  loadSamples?(group: string, onProgress?: (done: number, total: number) => void): Promise<void>;
  /**
   * Drop the decoded buffers of a sample group (keys another loaded group lists stay; a song that
   * plays keeps its buffer). Optional: headless outputs have none.
   */
  releaseSamples?(group: string): void;
  /**
   * A speech bubble line, spoken by its voice sample (`voiceKey(text)`) when one is loaded,
   * else nothing (no synth or speech fallback). `speaker` and `o.important` set what the line may
   * cut off (see `SpeechLane`): the same speaker replaces their own line, an important line (a
   * hint or radio bubble) cuts off a gag line, a gag line waits.
   */
  say?(text: string, speaker?: string, o?: SayOpts): void;
  /** True while a voice sample speaks or waits to speak (a scene paces its next line by it). */
  speaking?(): boolean;
  /**
   * True when `say(text)` would play a voice sample now (loaded, audio running, voice not muted).
   * Cosmetic only: a speaker may pick a stand-in sound when false; never use it for game logic.
   */
  hasVoice?(text: string): boolean;
  /**
   * Silence / restore every looping sound (`sfxLoop`) while a scene is on top of gameplay (the
   * pause menu, the continue screen); the loops keep running underneath.
   */
  pauseLoops?(): void;
  resumeLoops?(): void;

  // ---- Rally wave C opt-ins (docs/api/audio-pipeline.md "Mission rally"; headless outputs: no-ops)
  /**
   * The current song (its id, source, position, length, ended / paused), or null when none plays
   * (or the output has no clock: NullAudio, SimAudio). The object may be reused by the next call.
   * Cosmetic only: never use it for game logic (a sim has no songs).
   */
  songState?(): SongState | null;
  /**
   * Listen for the end of the current song: a one-shot (a jingle) or a song played `once` that
   * played to its end. Not called when a song is stopped or replaced. Returns the unsubscribe.
   */
  onSongEnd?(fn: (id: string) => void): () => void;
  /** The car radio's chain (band-pass, tunnel muffle, signal, static), or null for none (neutral). */
  setRadio?(o: RadioOpts | null): void;
  /**
   * Start or update the parametric engine voice of a key (at most ENGINE_VOICES at once: a new key
   * replaces the quietest one when it is louder, else it stays silent). Through the loop bus
   * (`pauseLoops` silences it). Stop it with `stopEngine(key)`.
   */
  engine?(key: string, o: EngineOpts): void;
  /** Stop the engine voice of a key, fading over `fadeTicks` (default 4). */
  stopEngine?(key: string, fadeTicks?: number): void;
}

// ---------------------------------------------------------------------------------------------
// Rally wave C: pure helpers of the opt-ins (node-testable; the Web Audio output applies them)
// ---------------------------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number => (v > lo ? (v < hi ? v : hi) : lo);
const unit = (v: number | undefined, d: number): number => (v === undefined || !Number.isFinite(v) ? d : clamp(v, 0, 1));
/** Exponential interpolation a → b by t (frequencies). */
const expLerp = (a: number, b: number, t: number): number => a * Math.pow(b / a, t);

/** At most this many engine voices sound at once (`AudioOut.engine`). */
export const ENGINE_VOICES = 4;
export const ENGINE_RPM_MIN = 400;
export const ENGINE_RPM_MAX = 9000;

/** The node values of an engine voice (`engineParams`). Frequencies in Hz, gains 0..1. */
export interface EngineParams {
  /** The firing frequency: rpm / 60 × cyl / 2 × pitch (a sawtooth). */
  fire: number;
  /** The firing tone (saw at `fire`), the half-order rumble (triangle at fire / 2), the 2nd order (square at 2 × fire). */
  tone: number;
  rumble: number;
  harm: number;
  /** The low-pass over the three tones. */
  cutoff: number;
  /** Band-passed noise (the exhaust). */
  noiseFreq: number;
  noiseQ: number;
  noise: number;
  /** The turbo whine (a sine). */
  turboFreq: number;
  turbo: number;
  /** The voice's output gain and pan. */
  gain: number;
  pan: number;
}

/** An engine voice's node values from its opts (pure; `out` is reused when given). */
export function engineParams(o: EngineOpts, out: EngineParams = {} as EngineParams): EngineParams {
  const rpm = Number.isFinite(o.rpm) ? clamp(o.rpm, ENGINE_RPM_MIN, ENGINE_RPM_MAX) : ENGINE_RPM_MIN;
  const r = (rpm - ENGINE_RPM_MIN) / (ENGINE_RPM_MAX - ENGINE_RPM_MIN);
  const load = unit(o.load, 0);
  const cyl = clamp(Math.round(Number.isFinite(o.cyl) ? (o.cyl as number) : 4), 1, 12);
  const pitch = o.pitch === undefined || !Number.isFinite(o.pitch) ? 1 : clamp(o.pitch, 0.25, 4);
  const bright = unit(o.bright, 0.5);
  const rough = unit(o.rough, 0.3);
  const turbo = unit(o.turbo, 0);
  const fire = (rpm / 60) * (cyl / 2) * pitch;
  out.fire = fire;
  out.tone = 0.5 + 0.3 * load;
  out.rumble = 0.4 * (1 - 0.6 * r);
  out.harm = 0.1 + 0.3 * bright * load;
  out.cutoff = clamp(fire * (2.5 + 5 * bright + 4 * load), 200, 12000);
  out.noiseFreq = clamp(fire * 3, 300, 8000);
  out.noiseQ = 1.2;
  out.noise = rough * (0.1 + 0.35 * load);
  out.turboFreq = (1800 + 4200 * r) * pitch;
  out.turbo = 0.12 * turbo * load * r;
  out.gain = unit(o.vol, 1) * (0.55 + 0.45 * load) * (0.8 + 0.2 * r);
  out.pan = o.pan === undefined || !Number.isFinite(o.pan) ? 0 : clamp(o.pan, -1, 1);
  return out;
}

/**
 * Which engine voice a new one replaces when all ENGINE_VOICES sound: the index of the quietest of
 * `gains` when `gain` is louder, else −1 (the new one stays silent). Pure.
 */
export function engineSteal(gains: readonly number[], gain: number, max = ENGINE_VOICES): number {
  if (gains.length < max) return gains.length;
  let q = -1;
  for (let i = 0; i < gains.length; i++) if (q < 0 || gains[i] < gains[q]) q = i;
  return q >= 0 && gain > gains[q] ? q : -1;
}

/** The node values of the radio chain (`radioParams`). */
export interface RadioParams {
  /** The speaker's high-pass and low-pass (Hz). */
  hp: number;
  lp: number;
  /** The muffle's low-pass (Hz). */
  muffleHz: number;
  signal: number;
  static: number;
  /** Seconds for the change. */
  ramp: number;
}

/** The neutral radio (`setRadio(null)`): flat filters, full signal, no static. */
export const RADIO_NEUTRAL: Readonly<RadioParams> = { hp: 10, lp: 20000, muffleHz: 20000, signal: 1, static: 0, ramp: 0.2 };

/** The radio chain's node values (pure). Null = neutral. */
export function radioParams(o: RadioOpts | null): RadioParams {
  if (!o) return { ...RADIO_NEUTRAL };
  const sp = unit(o.speaker, 1);
  const m = unit(o.muffle, 0);
  return {
    hp: expLerp(10, 180, sp),
    lp: expLerp(20000, 4500, sp),
    muffleHz: expLerp(20000, 300, m),
    signal: unit(o.signal, 1),
    static: unit(o.static, 0),
    ramp: o.ramp === undefined || !Number.isFinite(o.ramp) ? 0.2 : clamp(o.ramp, 0.005, 5),
  };
}

/** The speed of sound for `dopplerPitch` (m/s). */
export const SOUND_SPEED = 343;

/**
 * The doppler pitch factor of a sound whose source closes in on the listener at `closing` m/s
 * (positive = approaching, negative = moving away; `closingSpeed`): c / (c − closing × scale),
 * clamped to 0.5 … 2. `scale` exaggerates the effect (games: 1 … 2). Pure.
 */
export function dopplerPitch(closing: number, scale = 1): number {
  if (!Number.isFinite(closing) || !Number.isFinite(scale)) return 1;
  const v = clamp(closing * scale, -SOUND_SPEED, SOUND_SPEED / 2);
  return clamp(SOUND_SPEED / (SOUND_SPEED - v), 0.5, 2);
}

/**
 * The closing speed (m/s) of a source at offset (dx, dz) from the listener (source − listener)
 * moving at relative velocity (dvx, dvz) (source − listener): −(d · v) / |d|. 0 when they touch.
 */
export function closingSpeed(dx: number, dz: number, dvx: number, dvz: number): number {
  const d = Math.sqrt(dx * dx + dz * dz);
  return d > 1e-6 ? -(dx * dvx + dz * dvz) / d : 0;
}

/**
 * A stereo pan for a source `right` metres to the right of the listener and `ahead` metres in
 * front (the listener's frame): right / distance, scaled by `width` (default 0.85: never fully
 * one-sided), 0 within 1 m. Pure.
 */
export function stereoPan(right: number, ahead: number, width = 0.85): number {
  const d = Math.sqrt(right * right + ahead * ahead);
  if (!(d > 1) || !Number.isFinite(d)) return 0;
  return clamp((right / d) * width, -1, 1);
}

/**
 * The gain that keeps a panned loop at its unpanned level (`sfxLoop` with a pan, `engine`): a mono
 * source through an equal-power panner is 3 dB down in the centre, so it gets 1 / max(L, R) (1 at
 * the centre … the louder side at 1, never above); a stereo source gets 1. Pure.
 */
export function loopPanGain(pan: number, mono: boolean): number {
  if (!mono) return 1;
  const x = ((clamp(Number.isFinite(pan) ? pan : 0, -1, 1) + 1) / 2) * (Math.PI / 2);
  return 1 / Math.max(Math.cos(x), Math.sin(x));
}

// Registries live next to their implementations; re-exported here for one-stop imports.
export { defineSfx, hasSfx, jitterPitch, listSfx, renderSfx, sfxJitter } from './synth';
export type { SfxLayer, SfxRecipe } from './synth';
export { defineSong, hasSong, listSongs, orderTime } from './music';
export type { ChannelDef, InstrumentDef, InstrumentId, SongDef } from './music';
export { defineSampleGroup, getSampleGroup, listSampleGroups, voiceKey } from './samples';
export type { SampleGroup, SampleSfx, SampleSong, SampleVoice, SayOpts } from './samples';

/**
 * Silent implementation for headless runs. Keeps a short log so tests can assert on calls. It has
 * no `loadSamples` / `say` on purpose: new optional members add no log entries (the log is a
 * 256-entry ring that tests read).
 */
export class NullAudio implements AudioOut {
  readonly log: string[] = [];
  private readonly maxLog = 256;

  private push(entry: string): void {
    this.log.push(entry);
    if (this.log.length > this.maxLog) this.log.shift();
  }

  sfx(id: string): void {
    this.push(`sfx:${id}`);
  }

  /** Logs `music:<id>` (`music:stop` for null), plus `@<from>` when `from` is given. */
  music(id: string | null, o?: MusicOpts): void {
    const from = o?.from !== undefined && id !== null ? `@${o.from}` : '';
    this.push(`music:${id ?? 'stop'}${from}`);
  }

  voice(line: string): void {
    this.push(`voice:${line}`);
  }

  setVolume(): void {}

  stopAll(): void {
    this.push('stopAll');
  }

  pauseMusic(): void {
    this.push('pauseMusic');
  }

  resumeMusic(): void {
    this.push('resumeMusic');
  }

  sfxLoop(key: string, id: string): void {
    this.push(`loop:${key}:${id}`);
  }

  stopSfx(key: string): void {
    this.push(`stopLoop:${key}`);
  }

  duckMusic(factor: number): void {
    this.push(`duck:${factor}`);
  }

  setMuted(): void {}

  // Rally wave C opt-ins: silent no-ops with no log entries (the log is a ring tests read).
  songState(): SongState | null {
    return null;
  }

  onSongEnd(): () => void {
    return () => {};
  }

  setRadio(): void {}
  engine(): void {}
  stopEngine(): void {}
}
