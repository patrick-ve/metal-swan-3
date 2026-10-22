/**
 * The ring's sample group 'mission:ring' (docs/design/ring.md §R.8; docs/api/ring.md "R.B Wave B
 * contracts"): the ams group's sound effects and voices WITHOUT its two songs (the ams songs decode to
 * about 60 MB; the ring plays its own songs), merged with the ring's own takes from the manifest
 * (`SAMPLE_MANIFEST['mission:ring']`: the Dutch voices, the ring sfx, the songs `ring-foot` /
 * `ring-boot`). The ring's entries win on a shared id. The entries are the manifest's own objects, so
 * the sample bank decodes each file once for both groups (samples.browser.ts shares an entry whose
 * `def` is the same object).
 *
 * Both registrations use this one function (scenes/ring-route.ts at import; content/samples/index.ts
 * after it registers the manifest), so the group is the same whichever module runs last. Pure.
 */
import type { SampleGroup } from '../../../engine/samples';

export const RING_SAMPLE_GROUP = 'mission:ring';
const AMS_SAMPLE_GROUP = 'mission:ams';

/** The merged 'mission:ring' group, or null when the manifest has neither group. */
export function ringSampleGroup(manifest: Readonly<Record<string, SampleGroup>>): SampleGroup | null {
  const ams = manifest[AMS_SAMPLE_GROUP];
  const ring = manifest[RING_SAMPLE_GROUP];
  if (!ams && !ring) return null;
  const g: SampleGroup = {
    sfx: { ...ams?.sfx, ...ring?.sfx },
    voice: { ...ams?.voice, ...ring?.voice },
  };
  if (ring?.music) g.music = { ...ring.music };
  return g;
}
