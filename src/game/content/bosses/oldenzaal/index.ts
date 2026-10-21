/**
 * Mission oldenzaal — the mini-boss St. Plechelmus (revision 2, spec §5, §6). Owner: STATUE.
 * Manifest entry 'bosses/oldenzaal' (the sprites tool loads every 'bosses/…' entry, so the art
 * registered by the imports below is listed by `npm run sprites -- boss/oz-plechelmus/`).
 *
 * - geometry.ts: every number of the fight and its art (pure data);
 * - art.ts: the statue, the crozier, the plinth, the shots and the effects (1×, 2×, 4× from one drawer);
 * - tbc-art.ts: the TO BE CONTINUED card's ghost face and the jet Swan (`ui/oz-tbc/…`);
 * - shots.ts: `oz-plechelmus-stone`, `oz-plechelmus-bit`, `oz-plechelmus-wave`;
 * - statue.ts: `oz-plechelmus` (the Boss: the wake, 2 phases, the freed end);
 * - sfx.ts: the synth recipes 'oz/statue/…' (spread into SFX by content/sfx/index.ts).
 *
 * The saint is a victim of the curse and is freed: he sits back on his plinth, whole.
 */
import './art';
import './tbc-art';
import './shots';
import './statue';
export { Plechelmus, type AttackRecord, type StatueAttack } from './statue';
export { STATUE, PLINTH } from './geometry';
