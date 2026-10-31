/**
 * The MISSION 2 card of mission `oat` (docs/design/oat.md §1.1): the toeristenfolder. Owner: CORE
 * (wave A: the text, the `look` flag, a plain line map); INTEGRATE-C draws the folder (wave C,
 * `MissionCard.look: 'folder'`; until then MissionIntroScene shows the default card with this map).
 *
 * NOT lazy: content/ui/cards.ts lists `OAT_CARD` in `MISSION_CARDS`, so the card is registered at
 * boot (the ams tally opens it by id while the oat chunk loads behind it, like the rally's card).
 * Pure data: a type-only import, no art, no registry call.
 */
import type { MapLine, MissionCard } from '../../../scenes/flow-data';
import { OAT_ID } from './ids';

/** A polyline arc round (cx, cy) from angle a0 to a1 (degrees, 0 = east, 90 = south). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, step = 15): MapLine {
  const out: number[] = [];
  for (let a = a0; a <= a1 + 0.01; a += step) {
    const t = (a * Math.PI) / 180;
    out.push(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r * 0.8));
  }
  return out;
}

/** The old city: the IJ in the north, the Singel and the three canals of the belt, the Amstel. */
const CX = 192;
const CY = 66;
const LINES: readonly MapLine[] = [
  [104, 66, 148, 64, 192, 66, 236, 64, 280, 66],
  arc(CX, CY, 18, 0, 180),
  arc(CX, CY, 30, 0, 180),
  arc(CX, CY, 42, 0, 180),
  arc(CX, CY, 54, 0, 180),
  [214, 116, 210, 104, 206, 94, 202, 84],
];
const LABELS: readonly (readonly [string, number, number])[] = [
  ['DE BINNENSTAD', 266, 100],
  ['IJ', 110, 70],
];

/** The card (English like every card; Gusto voices the two briefing lines by their exact text). */
export const OAT_CARD: MissionCard = {
  id: OAT_ID,
  label: 'MISSION 2',
  name: 'OAT OF CONTROL',
  place: 'AMSTERDAM, DE BINNENSTAD - 0930 HOURS',
  briefing: ['SHORE LEAVE, DAY TWO: A DAY OUT IN THE OLD CITY.', 'EVERY CYGNET GETS 100 EURO. AMSTERDAM IS NOT CHEAP. GO!'],
  // Required by the card type; unused in oat (its tally is the kassabon, spec §7.6).
  headline: 'SQUAD SURVIVES A DAY OUT! THE BANK ACCOUNT DOES NOT.',
  announce: 'MISSIE TWEE. HOU JE PORTEMONNEE VAST!',
  startSub: 'START!',
  look: 'folder',
  // The dot on the 9 Straatjes (the west side of the belt, between the Prinsengracht and the Herengracht).
  map: { lines: LINES, dot: [148, 88], labels: LABELS },
};
