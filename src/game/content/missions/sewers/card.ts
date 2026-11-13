/**
 * The MISSION 2 card of mission `sewers` (docs/design/sewers.md §1): the normal line-map card (the
 * ams card's structure). The map: the night's way as five dots on one line, from the street down to
 * the trash hall (`WALLEN`, `STEEGJES`, `PUT`, `RIOOL`, `AFVALHAL`); the blinking dot on the first.
 *
 * NOT lazy: content/ui/cards.ts lists `SEWERS_CARD` in `MISSION_CARDS`, so the card is registered at
 * boot (the ams tally opens it by id while the sewers chunk loads behind it, scenes/sewers-route.ts).
 * Pure data: a type-only import, no art, no registry call.
 */
import type { MapLine, MissionCard } from '../../../scenes/flow-data';
import { SEWERS_ID, SEWERS_NAME } from './ids';

/** The line (screen px) and the five stops on it: the street (two) and the sewer (three), stepping down. */
const STOPS: readonly (readonly [string, number, number])[] = [
  ['WALLEN', 104, 66],
  ['STEEGJES', 148, 72],
  ['PUT', 192, 82],
  ['RIOOL', 236, 92],
  ['AFVALHAL', 280, 100],
];

/** The way through the night, and a small tick (a dot) at every stop. */
const LINES: readonly MapLine[] = [
  STOPS.flatMap(([, x, y]) => [x, y]),
  ...STOPS.map(([, x, y]): MapLine => [x - 2, y - 2, x + 2, y - 2, x + 2, y + 2, x - 2, y + 2, x - 2, y - 2]),
];

/** The labels under the dots, clear of the line that runs down to the next stop (the card centres each label on its x). */
export const SEWERS_LABEL_DY = 10;
const LABELS: readonly (readonly [string, number, number])[] = STOPS.map(([t, x, y]) => [t, x, y + SEWERS_LABEL_DY] as const);

/** The card (English like every card; Gusto voices the two briefing lines by their exact text). */
export const SEWERS_CARD: MissionCard = {
  id: SEWERS_ID,
  label: 'MISSION 2',
  name: SEWERS_NAME,
  place: 'AMSTERDAM, DE WALLEN - 2300 HOURS',
  briefing: ['SHORE LEAVE, NIGHT TWO: DE WALLEN IS FULL OF CROOKS.', 'CLEAR THE STREETS. MIND THE DRAINS. GO!'],
  headline: 'SQUAD CLEANS UP DE WALLEN! THE SEWER IS ANOTHER STORY.',
  announce: 'MISSIE TWEE. HOU JE NEUS DICHT!',
  startSub: 'START!',
  map: { lines: LINES, dot: [STOPS[0][1], STOPS[0][2]], labels: LABELS },
};
