// Generation spec types for the ElevenLabs audio pipeline (tools only, never
// imported by src/). The spec itself lives in tools/audio/spec.ts.

export type SampleGroupName = 'boot' | 'mission:ams';

/** One sound effect recipe (POST /v1/sound-generation). */
export interface SfxSpec {
  id: string;
  group: 'boot' | 'mission:ams';
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
  group: 'boot' | 'mission:ams';
  prompt: string;
  seconds: number;
  bpm: number;
  beatsPerBar: number;
  introBars?: number;
  loop: boolean;
  takes: number;
}

/** One designed voice (POST /v1/text-to-voice/design). */
export interface VoiceSpec {
  speaker: string;
  name: string;
  /** Voice Design prompt; never names or imitates a real person. */
  description: string;
  previewText: string;
  radio?: boolean;
}

/** One spoken line (POST /v1/text-to-speech/{voice_id}). */
export interface LineSpec {
  speaker: string;
  /** Exact game text including \n. */
  text: string;
  /** TTS input; may use audio tags like [excited]. */
  say: string;
  lang: 'en' | 'nl';
  group: 'boot' | 'mission:ams';
  maxSeconds?: number;
  takes: number;
}
