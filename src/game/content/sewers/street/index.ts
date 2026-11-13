/**
 * Mission sewers' street cast (docs/design/sewers.md §3; owner P1a STREET; manifest id
 * `sewers/street`, lazy with the sewers chunk). Registers at import:
 *
 * | id | params |
 * |---|---|
 * | `sewers-dealer` | `lurk` (waits behind cover, steps out), `enter` / `entry` (`left` \| `right`), `facing`, `look` (`a`–`c`), `drop` (default `sewers-mints`) |
 * | `sewers-pimp` | `whistle` (default true: calls one bodyguard once), `hold` (px, default 120), `enter`, `facing`, `look` (`a` purple, `b` white) |
 * | `sewers-bodyguard` | `called`, `enter`, `facing`, `look` (`a` bald, `b` short hair) |
 * | `sewers-mints` | item: the dealer's gag drop `NEP!` (25 points, € 0,50) |
 * | `hostage` `{ kind: 'sewers-worker', lines: [l1, l2], bind, drop }` | the sewer worker (c, d) |
 * | `hostage` `{ kind: 'tourist', look: 'banana', bind, drop }` | the banana tourist (a) |
 *
 * `streetFlee(world)`: the rat eruption (wave B) — every living street person screams and runs off
 * the nearer screen edge, untargetable, harmless, no score, no euro, removed outside the view.
 */
import './art';
import './hostages.art';
import './mints';
import './dealer';
import './pimp';
import './bodyguard';
import './hostages';

export { BODYGUARD, CRAWL, DEALER, FLEE, MINTS, PIMP } from './numbers';
export { FLEE_LINES, STREET_TAG, StreetPerson, streetFlee } from './person';
export { Dealer } from './dealer';
export { Pimp } from './pimp';
export { Bodyguard } from './bodyguard';
export { NEP } from './mints';
export { BANANA_ART, BANANA_LOOK, WORKER_ART, WORKER_GAG, WORKER_KIND, workerLines } from './hostages';
