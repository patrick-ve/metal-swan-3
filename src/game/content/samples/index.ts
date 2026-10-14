/**
 * Sampled audio of the start screens and mission ams (docs/ARCHITECTURE.md §5.7, exception of
 * 2026-10-14): registers the sample groups of `manifest.ts` (written by the audio tool). The
 * groups only describe files under public/audio/; the Web Audio output fetches and decodes them
 * on `loadSamples(group)` (boot: 'boot'; the ams intro card: 'mission:ams'). The synth stays the
 * fallback for every id.
 */
import { defineSampleGroup, type SampleGroup } from '../../../engine/samples';
import { mayorVoiceSamples } from '../bosses/ams/voice';
import { SAMPLE_MANIFEST } from './manifest';

/**
 * ROBO-HALSEMA's clips (public/audio/mayor/, bosses/ams/voice.ts) are kept by hand, not by the
 * audio tool, so they join the 'mission:ams' group here instead of in the generated manifest.
 */
const HAND_VOICES: Readonly<Record<string, NonNullable<SampleGroup['voice']>>> = {
  'mission:ams': mayorVoiceSamples(),
};

for (const [name, group] of Object.entries(SAMPLE_MANIFEST)) {
  const extra = HAND_VOICES[name];
  defineSampleGroup(name, extra ? { ...group, voice: { ...group.voice, ...extra } } : group);
}
