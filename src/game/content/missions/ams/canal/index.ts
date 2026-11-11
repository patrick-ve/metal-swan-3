/**
 * The canal scenes of mission `ams` (docs/api/canal.md): the kit's baked layer stacks
 * (tmp/l1/kit/bake_game.py → public/art/ams/*.png and ./<section>.gen.ts, joined by the generated
 * ./manifest.gen.ts), registered as scenes 'ams/<section id>'. A section opts in with
 * `canal: amsCanal('<section id>')`.
 */
import type { Entity } from '../../../../../engine/entity';
import { defineCanalManifest } from '../../../../mission/canal/registry';
import type { CanalDef } from '../../../../mission/canal/types';
import { G } from '../art';
import { CANAL_MANIFEST } from './manifest.gen';

defineCanalManifest('ams', CANAL_MANIFEST);

/**
 * The opt-in of section `id` (`skip`: layer ids of the stack an entity draws instead; `extra`: the
 * other `CanalDef` fields, e.g. `{ depth: LAMP_GULLS }`).
 */
export function amsCanal(id: string, skip?: readonly string[], extra?: Omit<CanalDef, 'scene' | 'skip'>): CanalDef {
  const def: CanalDef = skip && skip.length ? { scene: `ams/${id}`, skip } : { scene: `ams/${id}` };
  return extra ? { ...def, ...extra } : def;
}

/** The floor depth of the kit's kerbside lamps (tmp/l1/kit/street.py `LAMP_D`). */
export const KIT_LAMP_DEPTH = 7.5;
/** The feet y of a gull on a kerbside lamp in the section scripts (`LAMP_TOP = G - 70`). */
export const LAMP_PERCH_Y = G - 70;

/**
 * The user's decision (2026-11-11): "gull perches follow their lamp by a render-only shift". A depth
 * rule (`CanalDef.depth`, docs/api/canal.md §9) for `seagull`: a gull spawned perched at feet y
 * `perchY` is DRAWN at the lamp's depth while it sits there (alive or dead), easing back to depth 0
 * over its take-off strip; every other gull, and every gull once it has taken off, draws at depth
 * 0. Render only: its hitbox, logic and every sim result stay the same; the rule applies only while
 * the section draws its canal scene (`ams2`, which reuses the scripts, has none).
 */
export function gullOnLamp(perchY = LAMP_PERCH_Y, depth = KIT_LAMP_DEPTH): (e: Entity) => number {
  return (e) => {
    const g = e as Entity & { spawnPerch?: number; spawnPerchY?: number };
    if (e.type !== 'seagull' || g.spawnPerchY === undefined || Math.abs(g.spawnPerchY - perchY) > 0.5) return 0;
    return depth * (g.spawnPerch ?? 0);
  };
}

/** `CanalDef.depth` of a section whose scripts perch gulls on kerbside lamps (`LAMP_TOP`). */
export const LAMP_GULLS: NonNullable<CanalDef['depth']> = { seagull: gullOnLamp() };
