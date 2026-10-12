/**
 * Machines sub-area "transport" (GDD §9.2, §9.5): the Legion's vehicles, aircraft and the
 * support entities that carry soldiers or crush things. Art in ./art.ts (`machine/<id>/…`).
 * Registers at import time:
 *
 * | id | category | what (GDD numbers, NORMAL) | params |
 * |---|---|---|---|
 * | `band-truck` | enemy | 88×48, 500 HP, 2,000. Drives in at 2.0 → `stopX` (brake), unloads `cargo` one per 20 ticks (`entry: 'truck'`), honks, reverses out at 1.5 after 300 ticks. Spawn armour until the stop / 240 ticks. Contact while moving kills. Drop table `truck`. | `stopX`, `cargo`, `from`, `speed`, `ram`, `outfit`, `tag` |
 * | `piano-bomber` | enemy | 96×36, 400 HP, 4,000. Crosses at 1 px/tick (hull centre y 20–64), up to 3 pianos per pass near the player: bay telegraph 50 + growing shadow + whistle. | `dir`, `mode` (`ground` \| `air`), `pianos` |
 * | `baton-copter` | enemy | 48×36, 200 HP, 1,500. Hovers 60–90 px up, new spot every 120 ticks at 1.2; note spread T 24 → 60°/90°/120° at 2 px/tick → R 60. `air`: level flight, aimed ±15°. | `mode`, `dir` |
 * | `rowboat` | prop | 48×12, 40 HP, 200. Carries 2 riflemen (`entry: 'rowboat'`) on water; rows to `stopX` at 0.8; sinks when empty or destroyed. | `stopX`, `crew`, `outfit`, `tag` |
 * | `tank-barge` | prop | 96×12 log raft, drifts at 0.3 on water carrying an `oompah-tank`; halts when the tank is gone. | `dir`, `speed`, `cargo` |
 * | `subway-train` | hazard | 400×40 moving kill zone at 6 px/tick after a 120-tick telegraph (bell, sparks, headlight). | `from`, `telegraph`, `speed`, `cars` |
 * | `parade-float` | prop | 96×40, 300 HP, 1,500. Solid moving platform at 0.5 px/tick with 2 riders (`entry: 'float'`) and an optional mast hostage. | `variant` (`tuba` \| `drum`), `riders`, `hostage`, `outfit`, `tag` |
 * | `piano` | projectile | the bomber's grand piano: falls, crushes (SET PIECE +200), stands as cover 600 ticks or floats on deep water. | `mode`, `vx`, `vy`, `harmless` |
 * | `note-bullet` | projectile | the copter's note (10 damage). | `vx`, `vy` |
 *
 * Spawning (mission scripts; positions are the feet unless noted):
 * ```ts
 * ctx.enter('band-truck', 'right', { margin: 48, params: { stopX: 2250, cargo: ['rifleman', 'rifleman', 'rifleman', 'cymbalist'] } });
 * ctx.enter('band-truck', 'left', { margin: 48, params: { stopX: 1200, speed: 3 } });           // m2-b overtake
 * ctx.enter('band-truck', 'right', { margin: 48, params: { ram: true } });                      // m4-b battle of the bands
 * ctx.enter('piano-bomber', 'right', { y: 32 });                                                // y = hull centre
 * ctx.enter('piano-bomber', 'right', { y: 20, params: { mode: 'air' } });                       // m5-a
 * ctx.enter('baton-copter', 'right', { margin: 32 });                                           // climbs to its hover height
 * ctx.enter('baton-copter', 'right', { margin: 16, y: 40, params: { mode: 'air' } });           // m3-a level crossing
 * ctx.enter('rowboat', 'right', { margin: 48, params: { stopX: 960, outfit: 'deck' } });        // y = the water under it
 * ctx.spawn('rowboat', 2000, 180, { outfit: 'deck' });                                          // waits where placed
 * ctx.enter('tank-barge', 'right', { margin: 48 });                                             // floats left at 0.3
 * ctx.spawn('subway-train', 0, 192, { from: 'right' });                                         // x ignored; telegraph first
 * ctx.enter('parade-float', 'right', { margin: 48, params: { variant: 'drum', outfit: 'night',
 *   hostage: { id: 'hostage', params: { kind: 'critic', bind: 'float', drop: 'M' } } } });
 * ```
 * Flyers anchor at their hull centre (their spawn y is the flight line). Carriers spawn their
 * riders on their first tick (after themselves, so they update first and keep them aboard);
 * `outfit` and the wave `tag(s)` pass on to every rider. Riders are spawned by id with
 * `{ entry, gag: false, facing }` — an infantry type that does not know the entry yet still
 * works (it stands on the deck and fights). `cargo` / `crew` / `riders`: `'none'` or `[]` = nobody
 * (a missing param = the GDD default).
 * Sounds (GDD §15.7): `machine/truck-horn`, `machine/brake`, `machine/piano-whistle`,
 * `machine/piano-crash`, `machine/copter` (loop; also the bomber's prop drone at pitch 0.55),
 * `env/train-bell`, `env/train-pass`, `env/water-splash`, `enemy/triangle`, `hit/metal`,
 * `hit/drum`, `explosion/*`.
 */
import './band-truck';
import './piano';
import './piano-bomber';
import './baton-copter';
import './rowboat';
import './tank-barge';
import './subway-train';
import './parade-float';

export { BandTruck, TRUCK } from './band-truck';
export { Piano, PIANO } from './piano';
export { PianoBomber, BOMBER } from './piano-bomber';
export { BatonCopter, COPTER, fireNote } from './baton-copter';
export { Rowboat, ROWBOAT } from './rowboat';
export { TankBarge, BARGE } from './tank-barge';
export { SubwayTrain, TRAIN } from './subway-train';
export { ParadeFloat, FLOAT } from './parade-float';
export { Deck, TransportMachine, parseSpecs, travelDir } from './machine';
