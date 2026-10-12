/**
 * Content category "props": shared mission props (GDD §9.5, §15.4 'Shared props'). Registers at
 * import time; art lives in ./art.ts under `prop/<id>/…`. Spawn x is the centre, y the feet /
 * standing surface unless noted. None of them is tagged 'enemy': they never hold a wave.
 *
 * | id | params | what it does |
 * |---|---|---|
 * | `helium-tank` | `hp` | 20×28, 10 HP, 100 pts, knifeable; bursts into a 48×48 helium cloud for 120 ticks: players on foot who touch it get `helium-head` |
 * | `statue-head` | `hp` | gold Fanfaroni head 24×24 on a plinth, 50 HP; knocked off: VANDALISM +500, rolls 64 px at 1.5 px/tick, crushes infantry (SET PIECE +200) |
 * | `breakable-wall` | `w` 24, `h` 48, `solid` (true), `look` (brick door rock crystal panel), `hp` 200, `reveal` | 100 pts; cracks after the first hit; solid until broken; `solid: false` = secret wall behind the actors (broken: a dark niche); `reveal` items spawn when it breaks |
 * | `rolling-drum` | `dir` / `facing`, `speed` (2), `hp` | 24×24, 40 HP, 100 pts; rolls 2 px/tick on the floor and down slopes; contact kills; smashes on walls |
 * | `spring-awning` | `w` (48), `variant` (`awning` \| `net`), `power` (6) | across a pit: landing on it launches vy −6.0; y = the bounce surface |
 * | `duck-float` | `drift` (32), `speed` (0.5), `bob` (3), `period` (96), `dir` | rubber duck 32×20 on the water under it: one-way platform drifting ±drift, bobbing ±3 px |
 * | `lily-pad` | `flower` | 24×6 static one-way platform; y = its top |
 * | `card-table` | — | 20×12 decor for the `cards` gag; the cards fly up when the players at it notice a player |
 * | `air-jet` | `h` (96), `w` (24), `push` (1.5) | warm air column above the pipe (y = its bottom): airborne players inside rise 1.5 px/tick against their fall |
 * | `cable-car` | `toX`, `toY` (default 96 px up) or `path`, `speed` (0.5), `hold` (true) | 64×8 one-way floor; starts when a player stands on it, moves (while ridden) and stays at the end |
 * | `bellows-platform` | `rise` (24), `period` (120), `phase` | 64×12 one-way platform; rises and falls 24 px every 120 ticks (world.tick) |
 * | `icicle` | `organ` ('organ' \| false), `note`, `reward` | 8×24 hanging (TOP anchor), 10 HP, 50 pts; one note when shot; left-to-right organ prize |
 * | `willow-tree` | `dir` (1), `bridgeY` (y + 2), `length` (160), `hp` (200) | trunk 200 HP, 1,000 pts; SHOOT! hint after 180 ticks; falls in 40 ticks into a solid bridge 160×12; crushes enemies, pushes players / Swans out |
 * | `avalanche` | `speed` 1, `maxSpeed` 3, `holdX` 40, `gap` 104, `stopX`, `startX`, `respawn` 160 | the m3-a pursuit wall (set-pieces.ts) |
 * | `rising-water` | `startY`, `speed` 0.3, `lag` 48, `cap`, `delay`, `kind` | the m3-b2 meltwater kill surface; `setSpeed(v, cap)` |
 */
import { defineEntity } from '../../registry';
import { BreakableWall, HeliumTank, Icicle, RollingDrum, StatueHead } from './breakables';
import { BellowsPlatform, CableCar, DuckFloat, LilyPad, SpringAwning } from './platforms';
import { AirJet, CardTable } from './scenery';
import { Avalanche, RisingWater, WillowTree } from './set-pieces';

export { BREAKABLE_WALL, BreakableWall, HELIUM_TANK, HeliumTank, ICICLE, Icicle, ROLLING_DRUM, RollingDrum, spawnReveal, STATUE_HEAD, StatueHead } from './breakables';
export { BELLOWS, BellowsPlatform, CABLE_CAR, CableCar, DUCK_FLOAT, DuckFloat, LILY_PAD, LilyPad, SPRING_AWNING, SpringAwning } from './platforms';
export { AIR_JET, AirJet, CARD_TABLE, CardTable } from './scenery';
export { AVALANCHE, Avalanche, RISING_WATER, RisingWater, WILLOW, WillowTree } from './set-pieces';
export { addHazard, removeHazard, SET_PIECE_SCORE, setPiece } from './common';

defineEntity('helium-tank', (w, x, y, p) => new HeliumTank(w, x, y, p), {
  category: 'prop',
  score: 100,
  description: 'Striped helium cylinder: bursts into a cloud that gives Helium Head (GDD §4.13).',
});
defineEntity('statue-head', (w, x, y, p) => new StatueHead(w, x, y, p), {
  category: 'prop',
  score: 500,
  description: 'Gold statue head on a plinth: VANDALISM +500, rolls and crushes infantry.',
});
defineEntity('breakable-wall', (w, x, y, p) => new BreakableWall(w, x, y, p), {
  category: 'prop',
  score: 100,
  description: 'Cracked wall or door (params w, h, solid, look, reveal).',
});
defineEntity('rolling-drum', (w, x, y, p) => new RollingDrum(w, x, y, p), {
  category: 'prop',
  score: 100,
  description: 'Bass drum rolling at 2 px/tick; contact kills.',
});
defineEntity('spring-awning', (w, x, y, p) => new SpringAwning(w, x, y, p), {
  category: 'prop',
  description: 'Bounce awning or Legion net across a pit (params w, variant): launches at vy −6.0.',
});
defineEntity('duck-float', (w, x, y, p) => new DuckFloat(w, x, y, p), {
  category: 'prop',
  description: 'Giant rubber duck: drifting, bobbing one-way platform on the water (params drift, speed).',
});
defineEntity('lily-pad', (w, x, y, p) => new LilyPad(w, x, y, p), {
  category: 'prop',
  description: 'Static one-way platform at water level (24×6).',
});
defineEntity('card-table', (w, x, y, p) => new CardTable(w, x, y, p), {
  category: 'prop',
  description: 'Folding card table: decor for the cards gag.',
});
defineEntity('air-jet', (w, x, y, p) => new AirJet(w, x, y, p), {
  category: 'prop',
  description: 'Warm air column (param h): airborne players inside are pushed up 1.5 px/tick.',
});
defineEntity('cable-car', (w, x, y, p) => new CableCar(w, x, y, p), {
  category: 'prop',
  description: 'Cable-car floor: one-way platform that moves along its path while a player rides it.',
});
defineEntity('bellows-platform', (w, x, y, p) => new BellowsPlatform(w, x, y, p), {
  category: 'prop',
  description: 'Organ bellows: one-way platform that rises and falls 24 px every 120 ticks.',
});
defineEntity('icicle', (w, x, y, p) => new Icicle(w, x, y, p), {
  category: 'prop',
  score: 50,
  description: 'Hanging icicle (top anchor): one note when shot; the Icicle Organ.',
});
defineEntity('willow-tree', (w, x, y, p) => new WillowTree(w, x, y, p), {
  category: 'prop',
  score: 1000,
  description: 'Giant willow: shoot the trunk, it falls into a solid bridge 160×12 and crushes enemies.',
});
defineEntity('avalanche', (w, x, y, p) => new Avalanche(w, x, y, p), {
  category: 'hazard',
  description: 'The m3-a pursuit wall (params speed, maxSpeed, holdX, gap, stopX).',
});
defineEntity('rising-water', (w, x, y, p) => new RisingWater(w, x, y, p), {
  category: 'hazard',
  description: 'Rising meltwater kill surface (params startY, speed).',
});
