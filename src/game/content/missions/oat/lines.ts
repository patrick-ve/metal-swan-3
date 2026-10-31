/**
 * Mission `oat`: every game text of the mission, verbatim (docs/design/oat.md §1, §9.2; docs/api/
 * oat.md "Lines"). Owner: CORE (wave A: the section banners and the empty voiced list); each wave
 * adds its speakers' lines here (bubbles ≤ 24 characters × 2 lines, `\n` breaks, no diacritics:
 * the font has none; `€` is one glyph) and lists them in `voicedLines()` for the audio spec (AUDIO,
 * SOUND). Pure data: no imports beyond the ids.
 */
import { OAT_SECTION, type OatSectionId } from './ids';

/**
 * The section start banner: the place and the clock (spec §1). `oat-a` shows it after the
 * mission's own `MISSION 2` / `START!` banner.
 */
export const SECTION_BANNERS: Readonly<Record<OatSectionId, string>> = {
  [OAT_SECTION.a]: 'DE 9 STRAATJES - 09:30',
  [OAT_SECTION.b]: 'FORT NEGEN & ZESTIG - 12:30',
  [OAT_SECTION.c]: 'DE KADEMUUR - 17:15',
  // The chase opens with its own banner (spec §2.4).
  [OAT_SECTION.c1]: 'DE KADE BEZWIJKT!',
  [OAT_SECTION.d]: 'DE WALLEN - 22:30',
  [OAT_SECTION.e]: 'NAAR DE RING - 03:20',
};

/** A voiced line: the bubble text (verbatim) and its speaker (ids.ts `OAT_SPEAKER`). */
export interface OatLine {
  readonly speaker: string;
  readonly text: string;
}

/**
 * Every voiced line of the mission (the audio spec's source; spec §9.2). Empty in wave A: the
 * builders of waves B and C add their speakers' lines.
 */
export function voicedLines(): readonly OatLine[] {
  return [];
}
