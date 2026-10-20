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
import type { MissionDef, SectionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './art';
// HD (2× and 4×) decor of sections c and d, the boats and the breakables (art-hd-cd*.ts).
import './art-hd-cd';
import './backgrounds';
// HD background layers: canal houses, elms, Museumplein, skyline (art-hd-bg*.ts); sky and clouds.
import './art-hd-bg';
import './art-hd-sky';
// HD terrain materials and canal water (art-hd-terrain*.ts).
import './art-hd-terrain';
import './art-hd-terrain-water';
// HD ambient life: pigeons, ducks, the tour boat, the window cat (npc-hi.art.ts).
import './npc-hi.art';
import './entities';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionD } from './section-d';
// After the sections: the 2× decor twins also cover the sized ids the section files registered.
import './art-hi-ab';

/**
 * A section with more tier-4 working-set `art` (gameplay.ts `denseWorkingSet`): the big
 * explosions where the bot runs draw them (c: grenades and barrels; d: the boss), measured
 * 2026-10-20 (tmp/uhd-polish-perf). Preload lists only: the section itself is unchanged.
 */
function withArt(def: SectionDef, art: readonly string[]): SectionDef {
  return { ...def, art: [...(def.art ?? []), ...art] };
}

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
  sections: { a: sectionA, b: sectionB, c: withArt(sectionC, ['fx/explosion-l']), d: withArt(sectionD, ['fx/explosion-l', 'fx/explosion-xl']) },
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
  // The solo fatbike sets only (`fatbike-youth`, `fatbike-youth-<look><skin>`): the pair sets
  // ride in sections b and c, which declare them as section `art` (the tier-4 working set).
  // The decor (`decor/ams/`) is section `art` too: each section lists what it draws.
  // The small fx, the shots and the HUD icons are drawn in every section (tier 4: in the working
  // set, else they show 2× until the pump builds them; about 4 MB at 4×). The big explosions
  // (l, xl: 15 MB at 4×) are section art of c and d only.
  preloadFirst: [
    'vehicle/swan',
    'enemy/delivery-rider',
    'enemy/seagull/',
    // ams frees tourists only: other hostage kinds (the campaign ending's cast) stay out of the
    // tier-4 working set even when they get 4× art.
    'item/hostage/tourist/',
    'item/hostage/flash',
    'item/pickup-',
    'item/bind',
    'item/crate',
    'enemy/fatbike-youth/',
    'enemy/fatbike-youth-0',
    'enemy/fatbike-youth-1',
    'enemy/fatbike-youth-2',
    'enemy/fatbike-youth-3',
    'npc/ams/',
    'fx/explosion-s',
    'fx/explosion-m',
    'fx/chute',
    'fx/muzzle',
    'fx/hit',
    'fx/impact',
    'fx/dust',
    'fx/debris-',
    'fx/poof',
    'fx/splash',
    'fx/tin-feather',
    'fx/confetti',
    'weapon/',
    'ui/icon-',
    'ui/onward',
    'ui/swan-marker',
    'ui/ride',
  ],
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
