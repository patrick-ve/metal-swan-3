/**
 * The light of mission `oat` (docs/design/oat.md §8.3, §8.4, §8.8, §8.9; docs/api/oat.md "Light").
 * Owner: LIGHT-WATER. One-line contract: the sun of every day section (`defineSectionSun`, read by
 * every painter at paint time and by the stretched contact shadows), the shadow function for the
 * floor, the strips and the opposite row, the night lights of oat-d and oat-e
 * (`defineSectionLight` with the oat flags `glow`, `streaks`, `groups`, `bakes`), the water tiles
 * and the baked reflection strips.
 *
 * WAVE A START (CORE): the spec's sun table as the start values (LIGHT-WATER tunes them); no light
 * pass yet (oat-d and oat-e register theirs here).
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
 * oat-d and oat-e have no sun (lamps only).
 */
export const OAT_SUN = {
  [OAT_SECTION.a]: defineSectionSun(OAT_SECTION.a, sun(32, 40, '#ffd9b6')),
  [OAT_SECTION.b]: defineSectionSun(OAT_SECTION.b, sun(40, 30, '#ffedde')),
  [OAT_SECTION.c]: defineSectionSun(OAT_SECTION.c, sun(18, 45, '#ffc18d')),
  [OAT_SECTION.c1]: defineSectionSun(OAT_SECTION.c1, sun(15, 45, '#ffb16e', 11)),
} as const;
