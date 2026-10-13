/**
 * Content category "locals": the Amsterdam enemies of mission `ams` (docs/design/amsterdam.md §2;
 * gameplay — the sprites are in art.ts). Registers at import time. See docs/api/locals.md.
 *
 * | id | params |
 * |---|---|
 * | `fatbike-youth` | `pair`, `gag` (`circles`), `enter` (`left` \| `right`), `facing`, `look` (0–3), `skin`, `turn` |
 * | `delivery-rider` | `from` (`behind` \| `left` \| `right`), `gag` (`phone`), `enter`, `facing`, `skin` |
 * | `seagull` | `perch`, `gag` (`sleep` \| `fries`), `flock` (2–5), `enter` (`left` \| `right` \| `top`), `facing` |
 * | `handhaver` | `enter` (`left` \| `right`), `hold` (px), `facing`, `skin` |
 * | `boete-ticket` | projectile: `facing`, `speed` (y = the thrower's feet) |
 */
import './fatbike-youth';
import './delivery-rider';
import './seagull';
import './handhaver';

export { KICK_BOX, RIDER_BOX, Rider } from './rider';
export { FATBIKE, FatbikeYouth } from './fatbike-youth';
export { DELIVERY, DeliveryRider } from './delivery-rider';
export { SEAGULL, Seagull, SeagullFlock } from './seagull';
export { BoeteTicket, HANDHAVER, Handhaver, throwTicket } from './handhaver';
