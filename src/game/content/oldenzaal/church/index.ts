/**
 * Mission oldenzaal — the church interior (revision 2, spec §7): the nave (oz-d) and the crypt
 * (oz-e). Owner: CHURCH. Manifest id 'oldenzaal/church'; art in ./art.ts ('oldenzaal/church/art').
 *
 * - entities.ts: the openings `oz-slab` (a grave slab) and `oz-tomb` (a tomb chest) of the zombie
 *   API's opening contract, `oz-chapel-gate` (the side chapel's grille: a reusable door the column
 *   comes out of), `oz-crypt-stairwell` (the dead come up the crypt stair), `oz-nave-doors` (the
 *   red doors that slam), `oz-crypt-gate` (the crypt's iron gate), `oz-church-ambient` (motes, drips).
 * - layout.ts: the numbers of both sections and their terrain (`terrainNave`, `terrainCrypt`).
 * - decor.ts: the decor lists and the light-pass lamps.
 * - The scripts: missions/oldenzaal/script-oz-d.ts, script-oz-e.ts; sfx 'oz/church/' in
 *   content/sfx/oldenzaal-church.ts.
 *
 * RESPECT (spec §7, docs/ORIGINALITY.md): a real Catholic church; nothing mocked, broken or burned
 * on purpose; the altar, the crucifix, the statues and the images are decor (never entities), so
 * shots never damage them; the church's entities are neutral and refuse every hit; no zombie
 * wears a church vestment.
 */
import './entities';

export { OZ_CHURCH_ENTITY, OZ_CHURCH_SFX, OzChapelGate, OzChurchAmbient, OzCryptGate, OzNaveDoors, OzSlab, OzStairwell, OzTomb } from './entities';
