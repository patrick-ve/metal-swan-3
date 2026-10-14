/**
 * Sampled audio of the start screens and mission ams (docs/ARCHITECTURE.md §5.7, exception of
 * 2026-10-14): registers the sample groups of `manifest.ts` (written by the audio tool). The
 * groups only describe files under public/audio/; the Web Audio output fetches and decodes them
 * on `loadSamples(group)` (boot: 'boot'; the ams intro card: 'mission:ams'). The synth stays the
 * fallback for every id.
 */
import { defineSampleGroup } from '../../../engine/samples';
import { SAMPLE_MANIFEST } from './manifest';

for (const [name, group] of Object.entries(SAMPLE_MANIFEST)) defineSampleGroup(name, group);
