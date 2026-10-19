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
// 2× decor of sections c and d and the breakables (art-hi-cd*.ts).
import './art-hi-cd';
import './backgrounds';
// 2× background layers and terrain materials (art-hi-bg.ts, art-hi-terrain.ts).
import './art-hi-bg';
// 2× canal houses, elms, Museumplein, sky and clouds (backgrounds-hi.ts, art-hi-sky.ts).
import './backgrounds-hi';
import './art-hi-sky';
import './art-hi-terrain';
// 2× ambient life: pigeons, ducks, the tour boat, the window cat (npc-hi.art.ts).
import './npc-hi.art';
import './art-hi-boat';
import './entities';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionD } from './section-d';
// After the sections: the 2× decor twins also cover the sized ids the section files registered.
import './art-hi-ab';

export const AMS: MissionDef = {
  id: 'ams',
  name: 'THE FRYING DUTCHMAN',
  subtitle: 'MISSION 1',
  music: 'ams',
  bossMusic: 'ams-boss',
  start: 'a',
  bossSection: 'd',
  next: 'm1',
  // After the boss: the glitch bridge into the first-person mode (docs/design/fps.md §1.1).
  after: 'fps',
  announce: 'MISSION ONE. VLIEG OP, ZWAAN!',
  sections: { a: sectionA, b: sectionB, c: sectionC, d: sectionD },
  hostages: { a: 4, b: 3, c: 3 },
  // Dense art up to 4× (docs/ART_GUIDE.md "2x art (mission ams)", "UHD art"): only this mission
  // draws it; the runner draws at min(4, artTier()).
  artDensity: 4,
  // Footsteps on the cobbles (`player/step`; 2026-10-14, with the sampled ams audio).
  footsteps: true,
  // The mission start drops the players in on a parachute (fx/chute; Player.introDrop).
  introDrop: true,
  // The 2× preload during the intro card: after the players' characters, the Swan and what
  // section a shows first; the boss last. The small explosion goes before the big ones: the first
  // explosion generated pays the JIT warm-up of the 2× explosion code (about 1 ms more for s,
  // while l first costs about 16 ms instead of 8).
  preloadFirst: ['vehicle/swan', 'enemy/delivery-rider', 'enemy/seagull/', 'item/', 'enemy/fatbike-youth', 'npc/ams/', 'decor/ams/', 'fx/explosion-s'],
  preloadLast: ['boss/', 'enemy/handhaver', 'enemy/boete-ticket/'],
  // What this mission draws at 1× (the boot preloads only this; tests/game/boot-art.test.ts
  // checks it against the start screens and a bot run of every section and the boss).
  art: [
    'vehicle/swan',
    'decor/ams/',
    'npc/ams/',
    'boss/ams-mayor/',
    'enemy/fatbike-youth',
    'enemy/delivery-rider',
    'enemy/seagull/',
    'enemy/handhaver',
    'enemy/boete-ticket/',
    'item/',
    'weapon/',
    'fx/',
    'fx/chute',
  ],
  // Sampled music, sounds and dialogue (src/game/content/samples), loaded on the intro card.
  audioGroup: 'mission:ams',
};

defineMission(AMS);
