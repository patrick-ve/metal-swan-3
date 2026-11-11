/**
 * `enemy/delivery-rider…` — the meal-delivery courier on his city bike (docs/design/amsterdam.md
 * §2): a baked 40 px set (docs/design/ams40.md wave 4; drawn offline by
 * tools/art40/chars/delivery-rider/, `npm run art40 -- delivery-rider`). The black bike helmet, the
 * slate jacket with the green collar and cuffs, the big green cube backpack with a plain burger,
 * the stone-grey city bike with a chrome bell. Facing right, anchored at the ground under the
 * bottom bracket (the tyres stand on the anchor line).
 *
 * - `enemy/delivery-rider` (skin b) and its palette variants `enemy/delivery-rider-a` and
 *   `enemy/delivery-rider-c` (skins a, c). The tumbling `food-cube` prop is the base id's only.
 * - On the bike: ride 12 (20 ticks a crank turn, the cube bag lags the torso), idle 4 (stopped,
 *   the near foot down), turn 3 (the Turner's squeeze, drawn by `Rider`), alert 1, tell 12 (he
 *   pedals on and rings the bell twice a turn), gag 12 (one-handed, eyes on his phone), kick 6
 *   (anticipation, chamber and whip smears, the impact on frame KICK_HIT = 3 at tick 3, recoil,
 *   retract: [1, 1, 1, 2, 2, 29] = 36 ticks), photo-pose 6, the deferred gloat 6 (stopped, the
 *   phone) and cower 4.
 * - On foot (the bike leaves as the `bike` FX): die 10, die-knife 10, die-blast 10, die-burn 8,
 *   die-crush 6 (the same total ticks as before), flee 12 (16 ticks, 2 px a tick).
 * - Props: `bike` 6 (the wreck rears, falls on its side, skids in sparks and dust: 38 ticks) and
 *   `food-cube` 4 (the popped bag tumbling).
 */
import { defineBakedSet } from '../../../engine/baked';
import { SET } from '../art40/delivery-rider.gen';

export { KICK_HIT } from '../art40/delivery-rider.gen';

/** The strips every skin registers (the food-cube prop only under the base prefix). */
const SHARED = Object.keys(SET.strips).filter((n) => n !== 'food-cube');

defineBakedSet(SET, { only: [...SHARED, `${SET.prefix}/food-cube`] });
