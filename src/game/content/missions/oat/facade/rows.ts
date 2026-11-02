/**
 * The façade rows of every oat section and the planned lots (docs/design/oat.md §8.6 "The lot
 * sequencer", §8.4 "The unseen opposite row"; docs/api/oat.md "Grammar"). One source of truth for
 * the painters, LIGHT-WATER's shade model and the tests:
 *
 * - `OAT_STRIPS[id]`: the start `SectionStripsDef` of each section (the rows along spec §2's
 *   layout: the house stretches between the bridges of oat-a, the Huidenstraat of oat-b, the far
 *   Grimburgwal row of c / c1, the Oudezijds night rows of oat-d). INTEGRATE-A sets it on the
 *   section (`strips: OAT_STRIPS['oat-a']`); a section that sets its own rows registers them by
 *   planning (the strip source calls `defineFacadeRows`), or a builder calls it at import time.
 * - `planSection(id, opposite?)`: the planned rows (cached); `opposite` = the unseen row across the
 *   street behind the camera (another seed, the section's sheet, the whole section width).
 * - `facadeLots(id, opposite?)` (re-exported by index.ts): the public lot list.
 *
 * Pure and deterministic: a row plans from its seed (a hash of the section id and the row's u0).
 */
import type { SectionStripsDef, StripRowDef } from '../../../../mission/strips/types';
import { OAT_SECTION, OAT_STRIP_SOURCE, OAT_WIDTH } from '../ids';
import { OAT_A, OAT_B, OAT_D } from '../terrain';
import { planRow, type FacadeRowParams, type RowPlan } from './grammar';
import type { LotPlan, StreetSheetId } from './types';

/** The façade plane: 16 px behind the feet (spec §2.1: the back edge at y 160, s 0.862). */
export const FACADE_DEPTH = 16;
/**
 * Strip height (strip px over the façade base): a 22 m house is 226 world px = 195 strip px; the
 * base sits at y 160, so 176 covers the screen top with a margin for the bridges' humps.
 */
export const FACADE_HEIGHT = 176;

function row(u0: number, u1: number, sheet: StreetSheetId, params?: FacadeRowParams): StripRowDef {
  return params ? { u0, u1, sheet, params: params as Readonly<Record<string, unknown>> } : { u0, u1, sheet };
}

const A = OAT_A.streets;
/** The hijsbalk's warehouse (spec §6.4: LOCK 1, the beam at x 2,240). */
const HOIST_LOT: readonly [number, number] = [OAT_A.hoistX - 41, OAT_A.hoistX + 41];

/**
 * The start strips of each section (wave A: oat-a complete, oat-b / c / c1 from their sheets, oat-d
 * the night rows with the 03:00 dark set over the arena; the builders of waves B and C tune them).
 */
export const OAT_STRIPS: Readonly<Record<string, SectionStripsDef>> = {
  [OAT_SECTION.a]: {
    source: OAT_STRIP_SOURCE,
    depth: FACADE_DEPTH,
    height: FACADE_HEIGHT,
    rows: [
      // Berenstraat (the Haverbar's shop front is a slot for STREET-A's decor sprite).
      row(A.berenstraat[0], A.berenstraat[1], '9-straatjes', { name: 'beren', streetM: 8.3, wet: 0.6, slots: [{ u0: OAT_A.haverbar[0] - 8, u1: OAT_A.haverbar[1] + 8, kind: 'slot', id: 'haverbar' }] }),
      // Wolvenstraat: the conceptstore's slot and the hijsbalk's warehouse (LOCK 1).
      row(A.wolvenstraat[0], A.wolvenstraat[1], '9-straatjes', {
        name: 'wolven',
        streetM: 8.2,
        wet: 0.6,
        slots: [
          { u0: OAT_A.conceptstore[0] - 6, u1: OAT_A.conceptstore[1] + 6, kind: 'slot', id: 'conceptstore' },
          { u0: HOIST_LOT[0], u1: HOIST_LOT[1], kind: 'hoist', x: OAT_A.hoistX, id: 'hijsbalk' },
        ],
      }),
      row(A.oudeSpiegelstraat[0], A.oudeSpiegelstraat[1], '9-straatjes', { name: 'spiegel', streetM: 6.6, wet: 0.7 }),
      // The Singel row after the quay: the TE KOOP house is STREET-A's decor (a slot).
      row(4352, OAT_A.w, 'canal-front', { name: 'singel', wet: 0.4, slots: [{ u0: OAT_A.teKoop[0], u1: OAT_A.teKoop[1], kind: 'slot', id: 'te-koop' }] }),
    ],
  },
  [OAT_SECTION.b]: {
    source: OAT_STRIP_SOURCE,
    depth: FACADE_DEPTH,
    height: FACADE_HEIGHT,
    rows: [row(OAT_B.quay[1], OAT_B.w, '9-straatjes', { name: 'huiden', streetM: 8, wet: 0.1, slots: [{ u0: OAT_B.bakery[0], u1: OAT_B.bakery[1], kind: 'slot', id: 'bakery' }] })],
  },
  [OAT_SECTION.c]: { source: OAT_STRIP_SOURCE, depth: FACADE_DEPTH, height: FACADE_HEIGHT, rows: [row(0, OAT_WIDTH['oat-c'], 'grimburgwal', { name: 'grimburg', wet: 0.2 })] },
  [OAT_SECTION.c1]: {
    source: OAT_STRIP_SOURCE,
    depth: FACADE_DEPTH,
    height: FACADE_HEIGHT,
    prefetch: 2,
    rows: [row(0, OAT_WIDTH['oat-c1'], 'grimburgwal', { name: 'grimburg', wet: 0.2 })],
  },
  [OAT_SECTION.d]: {
    source: OAT_STRIP_SOURCE,
    depth: FACADE_DEPTH,
    height: FACADE_HEIGHT,
    rows: [
      row(OAT_D.achterburgwal[0], OAT_D.bridgeLock[1], 'oudezijds', { name: 'achter', night: true }),
      row(OAT_D.alley[0], OAT_D.alley[1], 'trompettersteeg', { name: 'steeg', night: true }),
      row(OAT_D.voorburgwal[0], OAT_D.voorburgwal[1], 'oudezijds', { name: 'voor', night: true }),
      row(OAT_D.square[0], OAT_D.w, 'oudekerksplein', { name: 'plein', night: true }),
    ],
    dark: [OAT_D.arena[0] - 128, OAT_D.w],
    darkFrom: OAT_D.checkpoints[2],
  },
};

/** The sheet of each section's unseen opposite row (spec §8.4: the same grammar, another seed). */
const OPPOSITE_SHEET: Readonly<Record<string, StreetSheetId>> = {
  [OAT_SECTION.a]: '9-straatjes',
  [OAT_SECTION.b]: '9-straatjes',
  [OAT_SECTION.c]: 'grimburgwal',
  [OAT_SECTION.c1]: 'grimburgwal',
  [OAT_SECTION.d]: 'oudezijds',
};

const rowsOf = new Map<string, readonly StripRowDef[]>();
const plans = new Map<string, readonly RowPlan[]>();

/**
 * Register the rows a section draws (the strip source does it when it plans a section's def, so a
 * section with its own rows gets the same lots in the shadows and the tests). Drops the cache.
 */
export function defineFacadeRows(sectionId: string, rows: readonly StripRowDef[]): void {
  const have = rowsOf.get(sectionId) ?? OAT_STRIPS[sectionId]?.rows;
  if (have === rows) return;
  rowsOf.set(sectionId, rows);
  plans.delete(sectionId);
}

/** The rows of a section (registered, else the start table, else none). */
export function facadeRows(sectionId: string): readonly StripRowDef[] {
  return rowsOf.get(sectionId) ?? OAT_STRIPS[sectionId]?.rows ?? [];
}

/** The unseen opposite row of a section (one row over the whole width, 600 px of margin each side). */
export function oppositeRow(sectionId: string): StripRowDef | null {
  const sheet = OPPOSITE_SHEET[sectionId];
  if (!sheet) return null;
  const w = OAT_WIDTH[sectionId as keyof typeof OAT_WIDTH] ?? 4096;
  return { u0: -600, u1: w + 600, sheet };
}

/** The planned rows of a section (cached), or with `opposite` its unseen opposite row. */
export function planSection(sectionId: string, opposite = false): readonly RowPlan[] {
  const key = opposite ? `${sectionId}|opp` : sectionId;
  let p = plans.get(key);
  if (p) return p;
  if (opposite) {
    const r = oppositeRow(sectionId);
    p = r ? [planRow(sectionId, r, 0, true)] : [];
  } else {
    p = facadeRows(sectionId).map((r, i) => planRow(sectionId, r, i));
  }
  plans.set(key, p);
  return p;
}

/** Every planned lot of a section, in world x order. */
export function sectionLots(sectionId: string, opposite = false): readonly LotPlan[] {
  const out: LotPlan[] = [];
  for (const r of planSection(sectionId, opposite)) for (const l of r.lots) out.push(l);
  return out;
}
