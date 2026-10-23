/**
 * The rally's sample group 'mission:rally' (docs/design/rally.md §8, §12.6; docs/api/rally.md "C. Wave
 * C contracts"; docs/api/audio-pipeline.md "Mission rally"): FILE FM — the DJ FREEK FLITS's Dutch
 * lines (content/rally/radio/lines.ts), the jingles and the three songs, under public/audio/rally/.
 *
 * The group is the manifest's own (`SAMPLE_MANIFEST['mission:rally']`, written by the audio tool once
 * something of it is picked) with its LONG songs streamed: every song of `STREAM_MIN_SECONDS` or more
 * gets `stream: true` (samples.ts `SampleSong.stream`), so the sample bank never decodes it (three
 * songs of 2:30 would decode to about 160 MB); the Web Audio output plays it through a media element
 * on the music bus. The jingles (3–6 s) and the lines decode as usual.
 *
 * Loaded by the card's preload (`preloadRally`) and by `RallyScene` (a direct `?mission=rally`); the
 * race's end (`RallyScene.exit`) releases it. Registered by content/samples/index.ts. Pure.
 */
import type { SampleGroup, SampleSong } from '../../../engine/samples';

export const RALLY_SAMPLE_GROUP = 'mission:rally';

/** A song this long (seconds) or longer streams instead of decoding. */
export const STREAM_MIN_SECONDS = 20;

/** The 'mission:rally' group with its long songs streamed, or null when the manifest has none. */
export function rallySampleGroup(manifest: Readonly<Record<string, SampleGroup>>): SampleGroup | null {
  const g = manifest[RALLY_SAMPLE_GROUP];
  if (!g) return null;
  const out: SampleGroup = { ...g };
  if (g.music) {
    const music: Record<string, SampleSong> = {};
    for (const [id, s] of Object.entries(g.music)) music[id] = s.duration >= STREAM_MIN_SECONDS ? { ...s, stream: true } : s;
    out.music = music;
  }
  return out;
}
