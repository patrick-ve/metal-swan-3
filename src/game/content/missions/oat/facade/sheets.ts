/**
 * The street style sheets of the façade grammar (docs/design/oat.md §8.6 table; the numbers from
 * tmp/oat/scenery-research.md §2.2, §5: lot widths in Amsterdam feet, the 3D BAG ridge deciles,
 * the gable mix of the canal belt). Start values, tuned at the look stop (spec §12.1).
 *
 * A sheet gives the sequencer its weights (gables, walls, windows, widths, ground floors), the
 * ridge distribution and the rates of the details (awnings, signs, flower boxes ≤ 1 lot in 6,
 * tilt, hoists, lit windows at night). The pairings of gable, wall and window follow the history
 * (`GABLE_WALLS`, `GABLE_WINDOWS`): step gables have early brick and cross frames, plastered
 * fronts big panes, infills modern windows.
 */
import type { GableType, GroundKind, StreetSheetId, WallId, WindowId } from './types';

export type Weights<K extends string | number> = readonly (readonly [K, number])[];

export interface StreetSheet {
  readonly id: StreetSheetId;
  readonly gables: Weights<GableType>;
  readonly walls: Weights<WallId>;
  readonly windows: Weights<WindowId>;
  /** Ridge height above the street, metres: p0, p10 … p90, p100 (research §5, 3D BAG). */
  readonly ridge: readonly number[];
  /** Lot widths in Amsterdam feet (spec §8.2: 18–26 ft; 30 ft on the canal fronts). */
  readonly feet: Weights<number>;
  /** Share of double lots (144–204 px) and of narrow infills (24–48 px). */
  readonly doubles: number;
  readonly infills: number;
  readonly ground: Weights<GroundKind>;
  readonly awnings: number;
  readonly signs: number;
  /** Flower boxes on at most 1 lot in 6 (spec §8.6; `ams` had them everywhere). */
  readonly flowers: number;
  /** Subsidence tilt (spec §8.2): 1 lot in 8 in a and b, 1 in 5 in d. */
  readonly tilt: number;
  readonly hoists: number;
  readonly gableStones: number;
  /** Night: the share of lit upper windows (spec §8.6 d: ~30 %). */
  readonly litWindows: number;
  /** Façade-to-façade street width, metres (the unseen opposite row's distance; spec §8.4). */
  readonly streetM: number;
  /** Words on the shop fasciae (generic product words, never a real shop's name). */
  readonly shopWords: readonly string[];
}

const DAY_WORDS = ['BRILLEN', 'ANTIEK', 'ZEEP', 'VINTAGE', 'HOEDEN', 'KAARSEN', 'PAPIER', 'THEE', 'SIERADEN', 'LAMPEN', 'TASSEN', 'GALERIE', 'KAPPER', 'WOL', 'PLATEN', 'DROP'];

export const SHEETS: Readonly<Record<StreetSheetId, StreetSheet>> = {
  // The 9 Straatjes (a, b): 4–5 storeys + attic, ridge 12.4–20.7 m (median 16.2), 3 bays (some 2),
  // shops in most ground floors; lijst 35 %, klok 20 %, hals 20 %, tuit 8 %, trap 7 %, 19th / 20th 10 %.
  '9-straatjes': {
    id: '9-straatjes',
    gables: [
      ['lijst', 35],
      ['klok', 20],
      ['hals', 14],
      ['verhoogde-hals', 6],
      ['tuit', 8],
      ['trap', 7],
      ['plastered', 6],
      ['infill', 4],
    ],
    walls: [
      ['brick-red', 30],
      ['brick-purple', 16],
      ['brick-black', 14],
      ['brick-orange', 10],
      ['brick-yellow', 5],
      ['painted-red', 5],
      ['painted-grey', 8],
      ['plaster-cream', 7],
      ['plaster-white', 5],
    ],
    windows: [
      ['sash-12', 30],
      ['sash-2-2', 24],
      ['sash-1-1', 14],
      ['casement', 14],
      ['kruis', 8],
      ['loading', 6],
      ['modern', 4],
    ],
    ridge: [10.5, 12.4, 13.6, 14.5, 15.4, 16.2, 17.1, 17.9, 18.8, 20.7, 22],
    feet: [
      [18, 14],
      [20, 26],
      [22, 26],
      [24, 20],
      [26, 14],
    ],
    doubles: 0.05,
    infills: 0.05,
    ground: [
      ['shop', 62],
      ['stoep', 14],
      ['flat', 16],
      ['warehouse', 8],
    ],
    awnings: 0.45,
    signs: 0.3,
    flowers: 1 / 7,
    tilt: 1 / 8,
    hoists: 0.6,
    gableStones: 0.15,
    litWindows: 0,
    streetM: 8.2,
    shopWords: DAY_WORDS,
  },
  // Canal fronts (the a / b vistas, the Singel): more lijst and wider lots (24–30 ft), doubles, stoeps.
  'canal-front': {
    id: 'canal-front',
    gables: [
      ['lijst', 45],
      ['klok', 14],
      ['hals', 12],
      ['verhoogde-hals', 3],
      ['tuit', 6],
      ['trap', 5],
      ['plastered', 12],
      ['infill', 3],
    ],
    walls: [
      ['brick-red', 26],
      ['brick-purple', 16],
      ['brick-black', 16],
      ['brick-orange', 6],
      ['painted-grey', 10],
      ['painted-red', 4],
      ['plaster-cream', 12],
      ['plaster-white', 10],
    ],
    windows: [
      ['sash-12', 34],
      ['sash-2-2', 20],
      ['sash-1-1', 18],
      ['casement', 12],
      ['kruis', 6],
      ['loading', 6],
      ['modern', 4],
    ],
    ridge: [12, 14, 15, 15.8, 16.6, 17.4, 18.2, 19, 20, 21.5, 23],
    feet: [
      [22, 14],
      [24, 26],
      [26, 30],
      [30, 30],
    ],
    doubles: 0.12,
    infills: 0.02,
    ground: [
      ['stoep', 56],
      ['flat', 24],
      ['shop', 10],
      ['warehouse', 10],
    ],
    awnings: 0.2,
    signs: 0.1,
    flowers: 1 / 7,
    tilt: 1 / 10,
    hoists: 0.55,
    gableStones: 0.2,
    litWindows: 0,
    streetM: 44,
    shopWords: DAY_WORDS,
  },
  // The Grimburgwal north bank (c, c1): 3–5 storeys; lijst 35 %, trap 15 %, hals 15 %, tuit 15 %, plastered 20 %.
  grimburgwal: {
    id: 'grimburgwal',
    gables: [
      ['lijst', 35],
      ['trap', 15],
      ['hals', 12],
      ['verhoogde-hals', 3],
      ['tuit', 15],
      ['klok', 5],
      ['plastered', 20],
    ],
    walls: [
      ['brick-red', 26],
      ['brick-purple', 18],
      ['brick-black', 12],
      ['brick-orange', 12],
      ['painted-grey', 8],
      ['painted-red', 4],
      ['plaster-cream', 12],
      ['plaster-white', 8],
    ],
    windows: [
      ['sash-12', 26],
      ['sash-2-2', 22],
      ['sash-1-1', 16],
      ['casement', 12],
      ['kruis', 12],
      ['loading', 12],
    ],
    ridge: [10, 11.2, 12.2, 13, 13.8, 14.6, 15.4, 16.2, 17.2, 18.4, 20],
    feet: [
      [18, 18],
      [20, 24],
      [22, 24],
      [24, 20],
      [26, 14],
    ],
    doubles: 0.06,
    infills: 0.04,
    ground: [
      ['flat', 40],
      ['stoep', 24],
      ['shop', 16],
      ['warehouse', 20],
    ],
    awnings: 0.2,
    signs: 0.15,
    flowers: 1 / 8,
    tilt: 1 / 6,
    hoists: 0.6,
    gableStones: 0.15,
    litWindows: 0,
    streetM: 23,
    shopWords: DAY_WORDS,
  },
  // Oudezijds Achterburgwal / Voorburgwal (d): 3–5 storeys, ridge 11.0–18.3 m (median 14.7); narrow
  // lots, more lean and tilt, bar fronts, red-lit frames, lit upper windows at random (~30 %).
  oudezijds: {
    id: 'oudezijds',
    gables: [
      ['lijst', 30],
      ['tuit', 15],
      ['trap', 15],
      ['hals', 12],
      ['verhoogde-hals', 3],
      ['klok', 10],
      ['plastered', 10],
      ['infill', 5],
    ],
    walls: [
      ['brick-red', 22],
      ['brick-purple', 20],
      ['brick-black', 18],
      ['brick-orange', 10],
      ['brick-yellow', 4],
      ['painted-grey', 10],
      ['painted-red', 4],
      ['plaster-cream', 7],
      ['plaster-white', 5],
    ],
    windows: [
      ['sash-12', 26],
      ['sash-2-2', 22],
      ['sash-1-1', 14],
      ['casement', 14],
      ['kruis', 12],
      ['loading', 8],
      ['modern', 4],
    ],
    ridge: [9.5, 11.0, 12.3, 13.1, 14.0, 14.7, 15.4, 16.1, 17.2, 18.3, 19.5],
    feet: [
      [18, 30],
      [20, 30],
      [22, 22],
      [24, 12],
      [26, 6],
    ],
    doubles: 0.03,
    infills: 0.06,
    ground: [
      ['bar', 30],
      ['frames', 26],
      ['flat', 22],
      ['stoep', 12],
      ['warehouse', 10],
    ],
    awnings: 0.1,
    signs: 0.2,
    flowers: 1 / 10,
    tilt: 1 / 5,
    hoists: 0.55,
    gableStones: 0.12,
    litWindows: 0.3,
    streetM: 21.5,
    shopWords: ['BAR', 'SNACKS', 'KOFFIE'],
  },
  // Wave C (NIGHT) builds these two; until then they use the Oudezijds numbers.
  trompettersteeg: undefined as unknown as StreetSheet,
  oudekerksplein: undefined as unknown as StreetSheet,
};

// The two night sheets of wave C start from the Oudezijds one (spec §8.6; NIGHT tunes them).
(SHEETS as Record<StreetSheetId, StreetSheet>).trompettersteeg = { ...SHEETS.oudezijds, id: 'trompettersteeg' };
(SHEETS as Record<StreetSheetId, StreetSheet>).oudekerksplein = { ...SHEETS.oudezijds, id: 'oudekerksplein' };

/** The sheets this wave builds and tests (spec §12.1 GRAMMAR: the 9 Straatjes and the Oudezijds; plus two cheap ones). */
export const BUILT_SHEETS: readonly StreetSheetId[] = ['9-straatjes', 'canal-front', 'grimburgwal', 'oudezijds'];

/** The walls each gable type may have (history: step gables early brick, plastered fronts plaster). */
export const GABLE_WALLS: Readonly<Record<GableType, readonly WallId[]>> = {
  trap: ['brick-orange', 'brick-red', 'brick-purple', 'brick-black', 'painted-red'],
  hals: ['brick-red', 'brick-purple', 'brick-black', 'brick-orange', 'painted-red', 'painted-grey'],
  'verhoogde-hals': ['brick-red', 'brick-purple', 'brick-black', 'brick-orange', 'painted-red'],
  klok: ['brick-red', 'brick-purple', 'brick-black', 'painted-red', 'painted-grey', 'brick-orange'],
  tuit: ['brick-red', 'brick-purple', 'brick-black', 'brick-orange', 'painted-grey'],
  lijst: ['brick-red', 'brick-purple', 'brick-black', 'brick-yellow', 'painted-grey', 'painted-red', 'plaster-cream', 'plaster-white'],
  plastered: ['plaster-cream', 'plaster-white', 'painted-grey'],
  infill: ['brick-yellow', 'brick-purple', 'brick-red', 'painted-grey'],
  none: ['brick-red', 'brick-purple'],
};

/** The windows each gable type may have. */
export const GABLE_WINDOWS: Readonly<Record<GableType, readonly WindowId[]>> = {
  trap: ['kruis', 'sash-12', 'casement'],
  hals: ['sash-12', 'sash-2-2', 'casement', 'kruis'],
  'verhoogde-hals': ['sash-12', 'kruis', 'casement'],
  klok: ['sash-12', 'sash-2-2', 'sash-1-1', 'casement'],
  tuit: ['loading', 'sash-2-2', 'kruis', 'casement'],
  lijst: ['sash-12', 'sash-2-2', 'sash-1-1', 'casement'],
  plastered: ['sash-1-1', 'sash-2-2', 'casement'],
  infill: ['modern'],
  none: ['sash-2-2'],
};

/** The street sheet of an id (unknown ids: the 9 Straatjes, so a typo still draws a street). */
export function sheetOf(id: string): StreetSheet {
  return (SHEETS as Record<string, StreetSheet | undefined>)[id] ?? SHEETS['9-straatjes'];
}
