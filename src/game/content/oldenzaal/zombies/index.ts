/**
 * Mission oldenzaal — the dead soldiers (revision 2, docs/design/oldenzaal.md §3; docs/api/oldenzaal.md
 * "ZOMBIES"). Owner: ZOMBIES. Manifest id 'oldenzaal/zombies'; art in ./art.ts
 * ('oldenzaal/zombies/art'). The contract the sections code against is ./api.ts.
 *
 * | id | category | spawn params (+ the Enemy params `hp`, `drop`, `tag`, `facing`) |
 * |---|---|---|
 * | `oz-grunt` | enemy (tag `oz-zombie`) | `entrance` ('walk' / 'rise' / 'burst' / 'manhole' / 'march'), `target` (a `ZombieOpening` entity), `surface` ('pavers' / 'earth' / 'slab' / 'tomb'), `delay`, `slot`, `breakAt`; the look: `set` ('tunic': the trench shovel / 'coat': the rifle swung as a club), `head` ('helm-a' / 'helm-b' / 'cap-a' / 'bare-a' / 'bare-b'; default: picked from the entity id) |
 * | `oz-rifleman` | enemy | as the grunt + `hold` (px it stands from the target) |
 * | `oz-mg` | enemy (big) | as the rifleman (the MG zombie) |
 * | `oz-crawler` | enemy | as the grunt |
 * | `oz-bones`, `oz-helmet`, `oz-rise` | fx | see ./fx.ts |
 *
 * Scripts use `spawnZombie` / `marchColumn` (api.ts) rather than these params directly.
 */
import { defineEntity } from '../../../registry';
import { OZ_ZOMBIES } from '../../missions/oldenzaal/ids';
import { CRAWLER, GRUNT, GUNNER, RIFLEMAN } from './numbers';
import { DeadSoldier } from './soldier';
import './fx';
import './grab';

export * from './api';
export * from './numbers';
export { DeadSoldier, drawOverlays, frameInfo, ZSFX } from './soldier';
export { OZ_STATUS_GRABBED, isGrabbed } from './grab';
export { OzBones, OzHelmet, OzRise } from './fx';

defineEntity(OZ_ZOMBIES.grunt, (w, x, y, p) => new DeadSoldier(w, x, y, p, 'grunt'), {
  category: 'enemy',
  score: GRUNT.score,
  description: 'Dead soldier (oldenzaal): a slow tank; shambles in, winds a trench shovel (or a rifle swung by its barrel) back over the shoulder and swings (tell >= 18, box live only in the swing). Bloodless: collapses into bones and dust.',
});
defineEntity(OZ_ZOMBIES.rifleman, (w, x, y, p) => new DeadSoldier(w, x, y, p, 'rifleman'), {
  category: 'enemy',
  score: RIFLEMAN.score,
  description: 'Dead rifleman (oldenzaal): stops at range on screen, raises a rusty rifle (a long tell), one slow glowing shot at chest height (duck or jump it), a slow reload.',
});
defineEntity(OZ_ZOMBIES.gunner, (w, x, y, p) => new DeadSoldier(w, x, y, p, 'gunner'), {
  category: 'enemy',
  score: GUNNER.score,
  description: 'Dead MG gunner (oldenzaal): a big slow tank; walks to a spot on screen, kneels and plants the bipod, lowers the barrel (a clear tell), a short sweep from the chest to the knees, a cool-down. The helmet and the barrel jacket can be shot off.',
});
defineEntity(OZ_ZOMBIES.crawler, (w, x, y, p) => new DeadSoldier(w, x, y, p, 'crawler'), {
  category: 'enemy',
  score: CRAWLER.score,
  description: "Dead crawler (oldenzaal): legless, drags itself along the floor, rears up and grabs a hero's feet (tap JUMP or shoot it to break free; at the end of the hold it bites). Low: aim down or jump over.",
});
