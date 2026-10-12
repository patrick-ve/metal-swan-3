/**
 * Mission m3 — THE HIGH NOTE (GDD §11.3). Mount Murmur, an alpine ski resort taken by the
 * Woodwinds:
 *
 * - `a` Yodel Valley (the Swan section: pond, piste, avalanche, ski jump) → route choice at the
 *   base camp: NORTH FACE ↑ (`b1`) or CAVES → (`b2`)
 * - `b1` North Face (vertical, scroll up) → `c`
 * - `b2` Echo Caves (vertical, scroll up) → `c`
 * - `c` Summit Station: SHE TOOK THE LIFT and THE WINDBAG (boss `windbag`, built in bosses/m3)
 *
 * Files: `bg.ts` (custom generators chalets, ice-cave, cable-cars), `backgrounds.ts` (the layer
 * stacks), `art.ts` (decor), `entities.ts` (m3-sign, m3-cargo-chute), `helpers.ts` (wave
 * notation, the lift record), `section-*.ts`.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './bg';
import './art';
import './entities';
import { sectionA } from './section-a';
import { sectionB1 } from './section-b1';
import { sectionB2 } from './section-b2';
import { sectionC } from './section-c';

export const M3: MissionDef = {
  id: 'm3',
  name: 'THE HIGH NOTE',
  subtitle: 'MISSION 3',
  music: 'm3',
  bossMusic: 'boss',
  start: 'a',
  bossSection: 'c',
  next: 'm4',
  startBanner: { text: 'MISSION 3', sub: 'START!' },
  announce: 'MISSION THREE. WRAP UP WARM, CYGNETS!',
  sections: { a: sectionA, b1: sectionB1, b2: sectionB2, c: sectionC },
  // GDD §11.3: 8 per route (a 4 incl. the composer, b1 / b2 3, c 1).
  hostages: { a: 4, b1: 3, b2: 3, c: 1 },
};

defineMission(M3);
