/**
 * The canal scenes of mission `sewers` (docs/api/canal.md; the level kit's
 * tools/levelkit/missions/sewers/, `lk.py sewers bake` → public/art/sewers/*.png and
 * ./<section id>.gen.ts, joined by the generated ./manifest.gen.ts), registered as scenes
 * 'sewers/<section id>' (the section ids are the game's: 'sewers-d'). A section opts in with
 * `canal: sewersCanal('sewers-d')`.
 *
 * The sewer sections c, d and e are baked twice (docs/design/sewers.md §5.1 "Art (L5)"): the
 * ambient stack '<id>' and the lit stack '<id>-lit' (its manifest names the ambient one: `litOf`).
 * A section opts in its AMBIENT scene only; the view finds the lit stack itself and shows it inside
 * the heroes' cones (docs/api/canal.md "A lit section"). Lazy: this module is part of the sewers
 * chunk (the section files import it).
 */
import { defineCanalManifest } from '../../../../mission/canal/registry';
import type { CanalDef } from '../../../../mission/canal/types';
import { CANAL_MANIFEST } from './manifest.gen';

defineCanalManifest('sewers', CANAL_MANIFEST);

/**
 * The opt-in of section `id` (the game's section id, e.g. 'sewers-d'); `extra`: the other
 * `CanalDef` fields (`skip`, `hideFaces`, `depth`, `show`, `art`).
 */
export function sewersCanal(id: string, extra?: Omit<CanalDef, 'scene'>): CanalDef {
  return extra ? { scene: `sewers/${id}`, ...extra } : { scene: `sewers/${id}` };
}
