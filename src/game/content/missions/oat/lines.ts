/**
 * Mission `oat`: every game text of the mission, verbatim (docs/design/oat.md §1, §9.2; docs/api/
 * oat.md "Lines"). Owner: CORE (wave A: the section banners); the voiced lines live with the sample
 * group (content/samples/oat.ts `OAT_VOICE`, `OAT_QUEUE_CALLS`: AUDIO, wave A) so the runner and the
 * audio spec read one table; `voicedLines()` returns them (bubbles ≤ 24 characters × 2 lines, `\n`
 * breaks, no diacritics: the font has none; `€` is one glyph). Pure data.
 */
import { oatVoiceLines } from '../../samples/oat';
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
 * Every voiced line of the mission (the audio spec's source; spec §9.2): the sample group's table
 * (content/samples/oat.ts `oatVoiceLines()`), by speaker; the builders of waves B and C add their
 * lines there.
 */
export function voicedLines(): readonly OatLine[] {
  return oatVoiceLines();
}
