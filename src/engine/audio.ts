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
}
