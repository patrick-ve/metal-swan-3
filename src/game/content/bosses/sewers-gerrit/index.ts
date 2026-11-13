// GOUDEN GERRIT, the mini-boss of mission sewers (docs/design/sewers.md §4.1; wave P1b A): the white
// stretch limo with Gerrit in the sunroof, its stand-in art. LAZY (manifest id
// `bosses/sewers-gerrit`, content/index.ts `isSewersContent`). Registers at import time.
import './art';
import './limo';

export { GerritLimo, type GerritAttackTrace } from './limo';
export { GERRIT, GERRIT_ART, GERRIT_ID, GERRIT_NAME, GERRIT_TAG, GUARD_TAG } from './numbers';
export { GERRIT_SPRITE } from './art';
