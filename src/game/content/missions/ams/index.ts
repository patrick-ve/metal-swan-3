/**
 * Mission ams — THE FRYING DUTCHMAN (docs/design/amsterdam.md). Amsterdam, played first:
 *
 * - `a` Grachtengordel → FABEL FRIET and the briefing
 * - `b` Museumplein (the Rijksmuseum passage, the hot-dog stand, the Swan)
 * - `c` Amstel (canals, houseboats, the shop quay, the scan car; the route choice)
 * - `c1` Brug (the white bridge, the Blauwbrug) or `c2` Rondvaart (the canal cruise)
 * - `d` Stopera: ROBO-HALSEMA (boss `ams-mayor`, bosses/ams)
 *
 * Files: `art.ts` (decor and the shared house painter), `backgrounds.ts` (ams-skyline,
 * ams-canal-houses, ams-elms, ams-plein, ams-amstel), `terrain.ts` (terrain and layout numbers),
 * `section-*.ts` (each with its own `script` function), `cruise.ts` (the canal cruise's boat and
 * bridges), `art-route.ts` / `art-hd-route.ts` (the route and cruise art at 1× and 2× / 4×).
 */
import type { MissionDef, SectionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './art';
// HD (2× and 4×) decor of sections c and d, the boats and the breakables (art-hd-cd*.ts).
import './art-hd-cd';
import './backgrounds';
// HD background layers: canal houses, elms, Museumplein, skyline (art-hd-bg*.ts); sky and clouds.
import './art-hd-bg';
// The far bank of the Amstel seen from the water (section c2): its UHD layer.
import './art-hd-bg-amstel';
import './art-hd-sky';
// HD terrain materials and canal water (art-hd-terrain*.ts).
import './art-hd-terrain';
import './art-hd-terrain-water';
// HD ambient life: pigeons, ducks, the tour boat, the window cat (npc-hi.art.ts).
import './npc-hi.art';
import './entities';
// The route choice and the canal cruise (docs/design/ams-extras.md §4): entities, art.
import './cruise';
import './art-route';
import './art-hd-route';
// Secrets: hidden captives, the hidden 1UP, shoot-to-reveal items (docs/design/ams-extras.md §5).
import './secrets';
import './secrets.art';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionC1 } from './section-c1';
import { sectionC2 } from './section-c2';
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
  sections: {
    a: sectionA,
    b: sectionB,
    c: withArt(sectionC, ['fx/explosion-l']),
    c1: withArt(sectionC1, ['fx/explosion-l']),
    c2: withArt(sectionC2, ['fx/explosion-l']),
    d: withArt(sectionD, ['fx/explosion-l', 'fx/explosion-xl']),
  },
  // Per section id: c → c1 (the bridge sack) or c2 (the houseboat tourist), the same total on
  // both routes (the tally counts the route a slot took). The hidden tourists of the secrets
  // count too (secrets.ts HIDDEN_TOURISTS: a's houseboat hatch, b's museum crate).
  hostages: { a: 5, b: 4, c: 2, c1: 1, c2: 1 },
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
    // The gloat's music note (the fatbike speaker; docs/design/ams-extras.md §1).
    'fx/music-note',
    'weapon/',
    'ui/icon-',
    'ui/onward',
    'ui/swan-marker',
    'ui/ride',
  ],
  // The boss (ROBO-HALSEMA) last; the scan car (boss/ams-scan, the mid-boss of c) is section art
  // of c: with `boss/` here the boss section's tier-4 set would hold it too.
  preloadLast: ['boss/ams-mayor/', 'enemy/handhaver', 'enemy/boete-ticket/'],
  // What this mission draws at 1× (the boot preloads only this; tests/game/boot-art.test.ts
  // checks it against the start screens and a bot run of every section and the boss).
  art: [
    'vehicle/swan',
    'decor/ams/',
    'npc/ams/',
    'boss/ams-mayor/',
    // The parking scan car of c (docs/design/ams-extras.md §3).
    'boss/ams-scan/',
    'enemy/fatbike-youth',
    'enemy/delivery-rider',
    'enemy/seagull/',
    'enemy/handhaver',
    'enemy/boete-ticket/',
    // The stag party, its corks and the beer bike (enemy and rideable; §2).
    'enemy/stag-',
    'enemy/cork/',
    'vehicle/beer-bike/',
    'item/',
    'weapon/',
    'fx/',
    'fx/chute',
  ],
  // Sampled music, sounds and dialogue (src/game/content/samples), loaded on the intro card.
  audioGroup: 'mission:ams',
};

defineMission(AMS);
