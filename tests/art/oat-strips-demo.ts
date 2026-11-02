/**
 * The façade strips on oat (docs/design/oat.md §8.6; STRIPS, wave A): a module for the tools'
 * `--import` that gives the oat sections without strips the PLACEHOLDER strip source (coloured canal
 * houses with gables: mission/strips/placeholder.ts), so the store and the view can be looked at
 * before GRAMMAR's `oat-facade` source and INTEGRATE-A's section wiring land:
 *
 *   npm run shot -- --mission oat --section oat-a --x 600 --res 4 --art 4 --import tests/art/oat-strips-demo.ts
 *   (add --floor-debug: the debug floor's camera, so the strips stand at the façade depth with its scale)
 *
 * A section that already declares `strips` keeps its own. Row bounds: every street stretch of the
 * section (the bridges and the quay stay open); the oat-d arena's dark bake (3,968–4,480, darkFrom
 * 3,500); oat-c1 prefetches two chunks (auto-scroll). Markers (a tick every 64 world px) on.
 */
import { definePlaceholderStrips, PLACEHOLDER_STRIP_SOURCE, type SectionStripsDef } from '../../src/game/mission/strips/index';
import type { SectionDef } from '../../src/game/mission/types';
import { sectionA } from '../../src/game/content/missions/oat/section-a';
import { sectionB } from '../../src/game/content/missions/oat/section-b';
import { sectionC } from '../../src/game/content/missions/oat/section-c';
import { sectionC1 } from '../../src/game/content/missions/oat/section-c1';
import { sectionD } from '../../src/game/content/missions/oat/section-d';
import { sectionE } from '../../src/game/content/missions/oat/section-e';

definePlaceholderStrips();

const params = { markers: true };

/** The demo strips of each oat section (world x rows; spec §2). */
export const OAT_DEMO_STRIPS: Readonly<Record<string, SectionStripsDef>> = {
  'oat-a': {
    source: PLACEHOLDER_STRIP_SOURCE,
    depth: 16,
    height: 168,
    rows: [
      { u0: 544, u1: 1568, sheet: '9-straatjes', params },
      { u0: 1792, u1: 2816, sheet: '9-straatjes', params },
      { u0: 3040, u1: 4096, sheet: '9-straatjes', params },
    ],
  },
  'oat-b': { source: PLACEHOLDER_STRIP_SOURCE, depth: 16, height: 168, rows: [{ u0: 0, u1: 2816, sheet: '9-straatjes', params }] },
  'oat-c': { source: PLACEHOLDER_STRIP_SOURCE, depth: 16, height: 168, rows: [{ u0: 0, u1: 2048, sheet: 'grimburgwal', params }] },
  'oat-c1': { source: PLACEHOLDER_STRIP_SOURCE, depth: 16, height: 168, prefetch: 2, rows: [{ u0: 0, u1: 4096, sheet: 'grimburgwal', params }] },
  'oat-d': {
    source: PLACEHOLDER_STRIP_SOURCE,
    depth: 16,
    height: 176,
    rows: [{ u0: 0, u1: 4352, sheet: 'oudezijds', params }],
    dark: [3968, 4480],
    darkFrom: 3500,
  },
  'oat-e': { source: PLACEHOLDER_STRIP_SOURCE, depth: 16, height: 168, prefetch: 2, rows: [{ u0: 0, u1: 6144, sheet: 'oudezijds', params }] },
};

for (const s of [sectionA, sectionB, sectionC, sectionC1, sectionD, sectionE] as SectionDef[]) {
  if (!s.strips && OAT_DEMO_STRIPS[s.id]) s.strips = OAT_DEMO_STRIPS[s.id];
}
