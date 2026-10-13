/**
 * Mission ams — THE FRYING DUTCHMAN (docs/design/amsterdam.md). Amsterdam, played first:
 *
 * - `a` Grachtengordel → FABEL FRIET and the briefing
 * - `b` Museumplein (the Rijksmuseum passage, the hot-dog stand, the Swan)
 * - `c` Amstel (canals, houseboats, the white bridge, the Blauwbrug)
 * - `d` Stopera: ROBO-HALSEMA (boss `ams-mayor`, bosses/ams)
 *
 * Files: `art.ts` (decor and the shared house painter), `backgrounds.ts` (ams-skyline,
 * ams-canal-houses, ams-elms, ams-plein), `terrain.ts` (terrain and layout numbers),
 * `section-*.ts` (each with its own `script` function).
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './art';
import './backgrounds';
import './entities';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionD } from './section-d';

export const AMS: MissionDef = {
  id: 'ams',
  name: 'THE FRYING DUTCHMAN',
  subtitle: 'MISSION 1',
  music: 'ams',
  bossMusic: 'ams-boss',
  start: 'a',
  bossSection: 'd',
  next: 'm1',
  announce: 'MISSION ONE. FRIES FIRST, CYGNETS!',
  sections: { a: sectionA, b: sectionB, c: sectionC, d: sectionD },
  hostages: { a: 4, b: 3, c: 3 },
};

defineMission(AMS);
