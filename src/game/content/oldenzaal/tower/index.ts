/**
 * Mission oldenzaal — the tower (revision 2, spec §8, §9): the climb (oz-f), the horde tide, the
 * bells and the jet Swan finale. Owner: TOWER. Manifest id 'oldenzaal/tower'; art in ./art.ts
 * ('oldenzaal/tower/art').
 *
 * | id | category | spawn params |
 * |---|---|---|
 * | `oz-tide` | other (a 'kill' hazard under its line) | `startY`, `speed`, `lag`, `stopY` |
 * | `oz-bell` | prop | `size` ('small' / 'big'), `rest`, `phase`, `mode` ('auto' / 'script') |
 * | `oz-swan-jet` | other (a cosmetic `Mountable`) | — (spawn it at its start point; it eases to `SWAN_JET.hover…`) |
 *
 * Layout: ./layout.ts (`TOWER`, `ledgeY`, `TIDE`, `BELLS`, `SWAN_JET`); the script: missions/oldenzaal/
 * script-oz-f.ts; sfx 'oz/tower/', 'oz/swan/' (content/sfx/oldenzaal-tower.ts).
 */
import { defineEntity } from '../../../registry';
import { OZ_TOWER } from '../../missions/oldenzaal/ids';
import { Bell } from './bell';
import { SwanJet } from './swan-jet';
import { Tide } from './tide';

export * from './layout';
export { Bell, BELL, BELL_ART, BELL_FRAMES } from './bell';
export { boardSwan, SwanJet, SWAN_JET_ART, SWAN_JET_RIDE } from './swan-jet';
export { Tide, TIDE_ART, TIDE_TILE } from './tide';

defineEntity(OZ_TOWER.tide, (w, x, y, p) => new Tide(w, x, y, p), {
  category: 'other',
  description: 'oz-f horde tide: a mass of the dead climbing the tower at a steady rate; kills on contact (a kill hazard under its line); holds at checkpoints and after a death; lastToll() stops it.',
});
defineEntity(OZ_TOWER.bell, (w, x, y, p) => new Bell(w, x, y, p), {
  category: 'prop',
  description: 'oz-f bell: still = a platform (small bells), swinging = a hazard toward a hero (tell >= 18); each toll stuns the dead nearby. Params size, rest, phase, mode.',
});
defineEntity(OZ_TOWER.swanJet, (w, x, y, p) => new SwanJet(w, x, y, p), {
  category: 'other',
  description: 'oz-f finale: the Metal Swan with two rocket units; flies in, hovers beside the roof, the heroes jump on (2P: the tail perch), leave() flies her off with a jet trail.',
});
