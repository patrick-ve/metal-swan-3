/**
 * Content category "creatures": the non-human enemies of docs/GAME_DESIGN.md §9.3 (gameplay;
 * the sprites are in art.ts). Registers at import time.
 *
 * | id | params |
 * |---|---|
 * | `bullfrog` | `entry` (`hop` \| `top` \| `left` \| `right`), `gag`, `facing` |
 * | `windup-bot` | `variant` (`walk` \| `ski` \| `fly`), `facing` |
 * | `rattler` | `enter` (`left` \| `right`: slithers in, then hides), `facing` |
 * | `echo-bat` | `enter` (`left` \| `right` \| `top` \| `fly` \| `swarm`: flies in awake), `facing`; spawn y = the ledge it hangs under |
 * | `ram-goat` | `enter` (`left` \| `right`: trots in alerted), `gag`, `facing` |
 * | `usher-bot` | `patrol` (px each side, 0 = guard), `gag` (`ticket` \| `polish`), `enter`, `facing` |
 * | `kazoo-drone` | `formation` (`v` \| `sine` \| `loop` \| `dive`: one spawn = 5 drones), `shooter` (true \| count), `count`, `facing` |
 */
import './bullfrog';
import './windup-bot';
import './rattler';
import './echo-bat';
import './ram-goat';
import './usher-bot';
import './kazoo-drone';

export { BULLFROG, Bullfrog, CroakRing, Froglet } from './bullfrog';
export { WINDUP, WindupBot } from './windup-bot';
export { RATTLER, Rattler } from './rattler';
export { ECHO_BAT, EchoBat } from './echo-bat';
export { RAM_GOAT, RamGoat } from './ram-goat';
export { USHER, UsherBot } from './usher-bot';
export { KAZOO, KazooDrone, KazooFormation } from './kazoo-drone';
export { Creature } from './common';
