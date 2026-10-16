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

/**
 * Music tracks supplied by the user (2026-10-16), kept by hand under public/audio/user/music/ (the
 * audio tool never touches that folder). They replace the generated takes of the same ids: the
 * menu theme (title screen and mode select), the REPORT FOR DUTY theme, mission ams (sections
 * a–d) and the ROBO-HALSEMA fight. Trimmed and set to −16 LUFS integrated with ffmpeg; each track
 * plays to its own fade-out and starts again (loop = the whole track, ending just before the
 * MP3 padding).
 */
function userTrack(name: string, duration: number): NonNullable<SampleGroup['music']>[string] {
  return { file: `user/music/${name}.mp3`, loopStart: 0, loopEnd: Math.round((duration - 0.05) * 1000) / 1000, duration };
}

export const HAND_MUSIC: Readonly<Record<string, NonNullable<SampleGroup['music']>>> = {
  'boot': {
    'title': userTrack('title', 61.135),
    'select': userTrack('select', 38.451),
  },
  'mission:ams': {
    'ams': userTrack('ams', 235.202),
    'ams-boss': userTrack('ams-boss', 141.324),
  },
};

for (const [name, group] of Object.entries(SAMPLE_MANIFEST)) {
  const voice = HAND_VOICES[name];
  const music = HAND_MUSIC[name];
  defineSampleGroup(name, {
    ...group,
    ...(voice ? { voice: { ...group.voice, ...voice } } : {}),
    ...(music ? { music: { ...group.music, ...music } } : {}),
  });
}
