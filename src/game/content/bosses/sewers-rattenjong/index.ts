/**
 * DE RATTENJONG, the boss of mission sewers (docs/design/sewers.md §4.2; wave P1b E): the king,
 * his trash throne, his throws and the flood of the end. LAZY (manifest id
 * `bosses/sewers-rattenjong`, content/index.ts `isSewersContent`); registers at import time. The
 * art is a code-drawn stand-in (art.ts) until wave P5.
 */
import './art';
import './shots';
import './props';
import './king';

export { Rattenjong, SEWERS_HANG, type KingAttack, type KingAttackRecord } from './king';
export { KingThrone, SewersFlood } from './props';
export { KingBike, KingBikePart, KingCart, KingScooter, KingScrap } from './shots';
export { KING, KING_ART, KING_NAME, KING_RAT_TAG, THRONE_ART, THROW_ART } from './numbers';
