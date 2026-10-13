/**
 * Mission m1 — BRASS ON THE RIVERBANK (GDD §11.1). Puddlewick, a brick river town on the Wend:
 *
 * - `a` Puddlewick Quay → route choice: ROOFTOPS ↑ (`b1`) or DRAIN ↓ (`b2`)
 * - `b1` Chimney Chase (upper route) → `c`
 * - `b2` Storm Drain (lower route) → `c`
 * - `c` River Run: the ridden SWAN-3 showcase and THE ENCORE (boss `encore`, built in bosses/m1)
 *
 * Files: `backgrounds.ts` (custom generators town-rooftops, sewer-brick, far-bank, reeds),
 * `art.ts` (decor and mission-local strips), `entities.ts` (m1-hatch, m1-sign, mk1-head,
 * drum-mine, m1-float-crate, m1-duck-rush), `helpers.ts` (wave notation), `section-*.ts`.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './backgrounds';
import './art';
import './entities';
import { sectionA } from './section-a';
import { sectionB1 } from './section-b1';
import { sectionB2 } from './section-b2';
import { sectionC } from './section-c';

export const M1: MissionDef = {
  id: 'm1',
  name: 'BRASS ON THE RIVERBANK',
  subtitle: 'MISSION 2',
  music: 'm1',
  bossMusic: 'boss',
  start: 'a',
  bossSection: 'c',
  next: 'm2',
  announce: 'MISSION TWO. LOOK SHARP, CYGNETS!',
  sections: { a: sectionA, b1: sectionB1, b2: sectionB2, c: sectionC },
  // Hostages per section (GDD §11.1: 10 per route — a 4 incl. the composer, b1 / b2 3, c 3).
  hostages: { a: 4, b1: 3, b2: 3, c: 3 },
};

defineMission(M1);
