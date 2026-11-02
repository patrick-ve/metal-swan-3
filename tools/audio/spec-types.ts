// Generation spec types for the ElevenLabs audio pipeline (tools only, never
// imported by src/). The spec itself lives in tools/audio/spec.ts.
import type { SampleGroupId } from '../../src/engine/samples';

/**
 * A sample group of the game: 'boot', 'mission:ams', 'mode:fps', 'mission:oldenzaal',
 * 'mission:ring', 'mission:rally', 'mission:oat' (the list is `SAMPLE_GROUPS` in
 * src/engine/samples.ts, the one place that names them).
 */
export type SampleGroupName = SampleGroupId;

/** One sound effect recipe (POST /v1/sound-generation). */
export interface SfxSpec {
  id: string;
  group: SampleGroupName;
  prompt: string;
  /** Requested length in seconds, 0.5..30. */
  seconds: number;
  /** Final max length in seconds after processing. */
  trimTo?: number;
  loop?: boolean;
  takes: number;
  keep: number;
  influence?: number;
  /** Hard timing note, e.g. 'slam at 0.50 s'. */
  timing?: string;
  isNew?: boolean;
}

/** One music cue (POST /v1/music). */
export interface MusicSpec {
  id: string;
  group: SampleGroupName;
  prompt: string;
  seconds: number;
  bpm: number;
  beatsPerBar: number;
  introBars?: number;
  loop: boolean;
  takes: number;
  /**
   * The beat (from the file start) where each order slot of the synth song begins, one per slot
   * (`ctx.music(id, fade, { from: slot })` enters a part; mission oat's songs). audio:ship writes
   * them as the manifest's `marks` in seconds (`SampleSong.marks`), so a take enters the same part.
   */
  slotBeats?: readonly number[];
}

/** One designed voice (POST /v1/text-to-voice/design). */
export interface VoiceSpec {
  speaker: string;
  name: string;
  /** Voice Design prompt; never names or imitates a real person. */
  description: string;
  previewText: string;
  radio?: boolean;
  /** Robot voice filter (monotone vocoder + metal comb) for lines of a robot speaker. */
  robot?: boolean;
}

/** One spoken line (POST /v1/text-to-speech/{voice_id}). */
export interface LineSpec {
  speaker: string;
  /** Exact game text including \n. */
  text: string;
  /** TTS input; may use audio tags like [excited]. */
  say: string;
  /** Pronunciation language: English, Dutch, or German (the first-person mode's shouts). */
  lang: 'en' | 'nl' | 'de';
  group: SampleGroupName;
  maxSeconds?: number;
  takes: number;
}
