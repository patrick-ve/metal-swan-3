/**
 * Mission oldenzaal — the church interior's art (the nave and the crypt; revision 2, spec §7).
 * Owner: CHURCH. Manifest id 'oldenzaal/church/art' (the sprites tool loads it). Every id has 1×
 * art (the 64-colour PAL) and 2× / 4× art from one density-generic drawer (kit.ts `regC`):
 *
 * - art-nave-arch.ts: `oz-nave-far` (background), `decor/oz-nave/pillar`, `west`, `apse`, `chapel`.
 * - art-nave-furn.ts: `decor/oz-nave/pews`, `confessional`, `font`, `pulpit`, `saint`, `mary`,
 *   `votive`, `station`, `altar`, `crucifix`, `candlestick`, `lamp`, `chandelier`, `shaft`,
 *   `hymn-board`, `stand`, `cobweb`, `doors`, `grille`.
 * - art-crypt.ts: `oz-crypt-far` (background), `decor/oz-crypt/vault`, `coffin`, `candles`,
 *   `lantern`, `stair-down`, `stair-up`, `gate`; the openings `prop/oz-tomb/tomb`, `prop/oz-slab/slab`.
 * - art-terrain.ts: the HD terrain materials `oz-nave-floor`, `oz-crypt-floor`, `oz-pew`, `oz-nave-step`.
 */
import './art-nave-arch';
import './art-nave-furn';
import './art-crypt';
import './art-terrain';

export { OZ_CHURCH_BGS, OZ_CHURCH_SPRITES } from './kit';
