/**
 * A section that is not built yet: the sky, the far city, a painted floor, water where the terrain has
 * water, and the `ams` decor on top. It runs and it reads; a section builder replaces it.
 */
import type { LightName } from '../../../art/herokit/palette';
import type { SectionDef } from '../../../mission/index';
import { birdsDecor, cloudsDecor, defineFarBand, farDecor, quayEdge } from './scene';
import { bandTiles, defineFloor, type FloorSpec, kerbPosts, postRow, skyBackground, stageSection, waterCut } from './stage';

export interface ScaffoldOpts {
  light: LightName;
  key: string;
  seed: number;
  floor: Omit<FloorSpec, 'light' | 'name' | 'seed'>;
  /** Spacing of the post rows (0 = none). */
  posts?: readonly [far: number, near: number];
}

/** The scaffold of a section from its `ams` section. */
export function scaffold(base: SectionDef, o: ScaffoldOpts): SectionDef {
  const { light: L, key, seed } = o;
  const W = base.width;
  const plan = defineFloor({ light: L, name: key, seed, farExtra: quayEdge, ...o.floor });
  const cuts = base.terrain.hazards.filter((h) => h.kind === 'water').map((h, i) => waterCut(plan, L, `w${i}`, h.x, h.x + h.w));
  const far = defineFarBand(L, `${key}/far`, seed + 7, 100, [[92, 60]]);
  const [pf, pn] = o.posts ?? [66, 130];
  return stageSection(base, {
    background: skyBackground(L, seed + 1),
    paintedFloor: true,
    decor: [
      ...cloudsDecor(L, seed + 1),
      ...birdsDecor(L, 100, 26, 0.12, W),
      ...farDecor(far, W),
      ...bandTiles(plan.far, W),
      ...bandTiles(plan.walk, W),
      ...bandTiles(plan.near, W),
      ...cuts.flatMap((c) => c.back),
      ...(pf && plan.spec.far !== 'none' ? kerbPosts(plan, L, 'far', postRow(plan, 'far', 30, pf, W)) : []),
      ...cuts.flatMap((c) => c.front),
      ...(pn && plan.spec.near !== 'water' ? kerbPosts(plan, L, 'near', postRow(plan, 'near', 70, pn, W)) : []),
      ...(base.decor ?? []),
    ],
  });
}
