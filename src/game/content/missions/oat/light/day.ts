/**
 * THE DAY SECTIONS' GROUND OVERLAYS of mission `oat` (docs/design/oat.md §8.1 steps 6–7, §8.4
 * "Actors", §8.8; docs/api/oat.md "LIGHT-WATER"). Owner: LIGHT-WATER.
 *
 * oat-a, oat-b, oat-c and oat-c1 register a DAY light config (`SectionLight.day`: no darkness, no
 * light map) so the light pass draws, on a floor, under the entities:
 * - the actors' cast shadows stretched along the section's sun (`sunShadows`: a tail to the right
 *   and a little up, h · cot e · cos yaw long; none where the feet stand in the shade model's shade);
 * - the dynamic reflections on the water in front (`water`: a's canals under the three bridges,
 *   c1's canal; start values until KADE lays out c and c1).
 * The floor's own contact ovals stay (the ambient contact under the feet). Nothing here draws
 * without a floor (the placeholder stubs): the pass's ground hook is a floor hook.
 */
import { dvdy } from '../../../../../engine/floor/cam';
import { defineSectionLight, type SectionLight, type SunShadowConfig } from '../../../../mission/light/api';
import type { ReflectConfig } from '../../../../mission/floor/reflect';
import { OAT_SECTION } from '../ids';
import { OAT_STREETS, sectionShade, shadeCamera, shadeSpan } from './section-shade';
import { OPEN_DEPTH_M, PX_PER_M, sunGeom } from './shadow';
import { OAT_SUN } from './sun';

/** The walk line (spec §2: G = 176). */
const G = 176;

/**
 * The tail numbers of a day section: `along` = cot e · cos yaw (world px right per px of height,
 * both at true scale); `up` = the back part cot e · sin yaw (metres per metre) through the shade
 * model's depth scale (v per metre of the section's main street) and the floor camera's rows at the
 * walk line. `lit` asks the shade model at the feet (the floor's v is 0 on the walk line).
 */
export function sunTail(sectionId: keyof typeof OAT_SUN, strength = 0.4): SunShadowConfig {
  const sun = OAT_SUN[sectionId];
  const g = sunGeom(sun.elevation, sun.yaw);
  const cam = shadeCamera(sectionId);
  const span = shadeSpan(cam);
  const w = OAT_STREETS[sectionId]?.[0]?.w ?? OPEN_DEPTH_M;
  const vPerM = (span.vOpposite - span.vFacade) / w;
  const pxPerV = 1 / dvdy({ yh: cam.yh, yw: G, f: cam.f }, G);
  return {
    along: g.right,
    up: (g.back / PX_PER_M) * vPerM * pxPerV,
    strength,
    lit: (x) => 1 - sectionShade(sectionId).floor(x, 0, 4),
  };
}

/** oat-a's water in front of the bridge decks (STREET-A's layout: the decks' near railing at depth −13.6 → y 190). */
export const OAT_A_WATER: ReflectConfig = {
  bands: [
    { u0: 340, u1: 524, y0: 190, y1: 216 },
    { u0: 1586, u1: 1774, y0: 190, y1: 216 },
    { u0: 2838, u1: 3018, y0: 190, y1: 216 },
  ],
  alpha: [0.5, 0.35],
  ripple: 1.5,
};

/** oat-c1's canal (CORE's water hazard 96–3,904; KADE sets the rows with its floor in wave B). */
export const OAT_C1_WATER: ReflectConfig = {
  bands: [{ u0: 96, u1: 3904, y0: 160, y1: 216, level: 176 }],
  alpha: [0.5, 0.35],
  ripple: 2.5,
};

function day(sectionId: keyof typeof OAT_SUN, water?: ReflectConfig): SectionLight {
  return defineSectionLight(sectionId, {
    darkness: 0,
    tint: 0,
    day: true,
    sunShadows: sunTail(sectionId),
    ...(water ? { water } : {}),
  });
}

/** The day configs (registered at import). */
export const OAT_DAY_LIGHT = {
  [OAT_SECTION.a]: day(OAT_SECTION.a, OAT_A_WATER),
  [OAT_SECTION.b]: day(OAT_SECTION.b),
  [OAT_SECTION.c]: day(OAT_SECTION.c),
  [OAT_SECTION.c1]: day(OAT_SECTION.c1, OAT_C1_WATER),
} as const;
