/**
 * THE SUN PER SECTION of mission `oat` (docs/design/oat.md §8.3, decisions 37 and 57; docs/api/oat.md
 * "Light"). Owner: LIGHT-WATER. One record per day section, read by every painter at paint time (the
 * façade strips, the floor, the backdrops: `sectionSun(id)` / `OAT_SUN`), by the shade model
 * (section-shade.ts) and by the actors' sun tails (day.ts). The sun is a game convention: always LEFT
 * and in front of the façades (the camera side), so every shadow agrees with the heroes' key light.
 * oat-d and oat-e have no sun (lamps only: night.ts).
 */
import { hex } from '../../../../../engine/color';
import { sunFrom } from '../../../../art/hd/light';
import { defineSectionSun, type SectionSun } from '../../../../mission/light/api';
import { OAT_SECTION } from '../ids';

/** A day section's sun from the spec's elevation and yaw (degrees) and its colour. */
function sun(elevation: number, yaw: number, color: string, elevationEnd?: number): SectionSun {
  return { elevation, yaw, color: hex(color), key: sunFrom(elevation, yaw), ...(elevationEnd !== undefined ? { elevationEnd } : {}) };
}

/**
 * The sun per day section (spec §8.3 table; the sun stays LEFT, decision 37): a 09:30 high-left,
 * b 12:30 highest-left, c 17:15 low-left (compass-true), c1 sinking 15° → 11° during the chase.
 * The colours are the table's Kelvin guides (a cool white morning, a neutral noon, a warm and then
 * golden late afternoon). oat-d and oat-e have no sun (lamps only).
 */
export const OAT_SUN = {
  [OAT_SECTION.a]: defineSectionSun(OAT_SECTION.a, sun(32, 40, '#ffd9b6')),
  [OAT_SECTION.b]: defineSectionSun(OAT_SECTION.b, sun(40, 30, '#ffedde')),
  [OAT_SECTION.c]: defineSectionSun(OAT_SECTION.c, sun(18, 45, '#ffc18d')),
  [OAT_SECTION.c1]: defineSectionSun(OAT_SECTION.c1, sun(15, 45, '#ffb16e', 11)),
} as const;
