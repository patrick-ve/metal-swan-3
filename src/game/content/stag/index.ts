/**
 * Content category "stag": the stag party of mission ams (docs/design/ams-extras.md §2; gameplay —
 * the sprites are in art.ts, the beer bike's in vehicles/beer-bike/art.ts). Registers at import
 * time. See docs/api/stag.md.
 *
 * | id | params |
 * |---|---|
 * | `stag-partier` | `groom`, `look` (0–3), `gag` (`toast` \| `selfie` \| true \| false), `facing`, `enter` / `from` (`left` \| `right`) |
 * | `stag-beer-bike` | `riders` (2–4), `groom`, `looks`, `facing`, `enter` / `from`, `stop` (px) |
 * | `cork` | projectile: `facing`, `speed`, `vy` (y = the thrower's feet) |
 *
 * The rideable `beer-bike` (the vehicle the enemy bike turns into) is `vehicles/beer-bike`.
 */
import './partier';
import './beer-bike';

export { fireCork, STAG, StagPartier, type PartyBike } from './partier';
export { PARTY_BIKE, StagBeerBike } from './beer-bike';
