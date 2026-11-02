/**
 * The façade rows of every oat section and the planned lots (docs/design/oat.md §8.6 "The lot
 * sequencer", §8.4 "The unseen opposite row"; docs/api/oat.md "Grammar"). One source of truth for
 * the painters, LIGHT-WATER's shade model and the tests:
 *
 * - `OAT_STRIPS[id]`: THE `SectionStripsDef` of each section (the rows along spec §2's layout: the
 *   house stretches between the bridges of oat-a, the Huidenstraat of oat-b, the far Grimburgwal
 *   row of c / c1, the Oudezijds night rows of oat-d). The section files set exactly this object
 *   (`strips: OAT_STRIPS[OAT_SECTION.a]`), so the painters, the shade model and `facadeLots` read
 *   ONE table (INTEGRATE-A, wave A). oat-a's rows and the d proof strip's row are STREET-A's
 *   (art/place-a.ts `A_STRIP_ROWS`, art/place-d.ts `D_STRIP_ROWS`): their shop and hoist slots fit
 *   the shop sprites to the pixel and the d row carries the lantern x's (`lamps`). A section that
 *   sets other rows registers them by planning (the strip source calls `defineFacadeRows`).
 * - `planSection(id, opposite?)`: the planned rows (cached); `opposite` = the unseen row across the
 *   street behind the camera (another seed, the section's sheet, the whole section width).
 * - `facadeLots(id, opposite?)` (re-exported by index.ts): the public lot list.
 *
 * Pure and deterministic: a row plans from its seed (a hash of the section id and the row's u0).
 */
import type { SectionStripsDef, StripRowDef } from '../../../../mission/strips/types';
import { OAT_SECTION, OAT_STRIP_SOURCE, OAT_WIDTH } from '../ids';
import { A_STRIP_ROWS } from '../art/place-a';
import { D_STRIP, D_STRIP_ROWS } from '../art/place-d';
import { OAT_B, OAT_D } from '../terrain';
import { planRow, type FacadeRowParams, type RowPlan } from './grammar';
import type { LotPlan, StreetSheetId } from './types';

/** The façade plane: 16 px behind the feet (spec §2.1: the back edge at y 160, s 0.862). */
export const FACADE_DEPTH = 16;
/**
 * Strip height (strip px over the façade base): the base sits at y 160 and the camera never rises
 * (the bridges' humps move the heroes, not the view), so 168 reaches 8 px over the screen top; a
 * taller house (a 22 m house is 195 strip px) is cut by the screen top as in a close street view
 * (spec §8.2). INTEGRATE-A: one height for every section (STREET-A's 168; GRAMMAR started at 176).
 */
export const FACADE_HEIGHT = 168;

function row(u0: number, u1: number, sheet: StreetSheetId, params?: FacadeRowParams): StripRowDef {
  return params ? { u0, u1, sheet, params: params as Readonly<Record<string, unknown>> } : { u0, u1, sheet };
}

/**
 * The start strips of each section (wave A: oat-a complete, oat-b / c / c1 from their sheets, oat-d
 * the night rows with the 03:00 dark set over the arena; the builders of waves B and C tune them).
 */
export const OAT_STRIPS: Readonly<Record<string, SectionStripsDef>> = {
  // oat-a: STREET-A's rows (the Berenstraat, the Wolvenstraat with the conceptstore slot and the
  // hijsbalk's warehouse, the Oude Spiegelstraat, the Singel after the TE KOOP house; shop slots that
  // fit the shop sprites of art/shops.ts).
  [OAT_SECTION.a]: { source: OAT_STRIP_SOURCE, depth: FACADE_DEPTH, height: FACADE_HEIGHT, rows: A_STRIP_ROWS },
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
  // oat-d: the proof strip's row 0–1,280 (STREET-A: the Achterburgwal, lit by its lanterns), then the
  // start rows of the rest (the bridge head, the Trompettersteeg, the Voorburgwal, the square; NIGHT
  // tunes them in wave C), and the 03:00 dark set over the arena view (spec §8.9: the same range as
  // the light pass's bake, from the checkpoint at 3,500).
  [OAT_SECTION.d]: {
    source: OAT_STRIP_SOURCE,
    depth: FACADE_DEPTH,
    height: FACADE_HEIGHT,
    rows: [
      ...D_STRIP_ROWS,
      row(D_STRIP[1], OAT_D.bridgeLock[1], 'oudezijds', { name: 'achter-brug', night: true, wet: 1 }),
      row(OAT_D.alley[0], OAT_D.alley[1], 'trompettersteeg', { name: 'steeg', night: true, wet: 1 }),
      row(OAT_D.voorburgwal[0], OAT_D.voorburgwal[1], 'oudezijds', { name: 'voor', night: true, wet: 1 }),
      row(OAT_D.square[0], OAT_D.w, 'oudekerksplein', { name: 'plein', night: true, wet: 1 }),
    ],
    dark: [OAT_D.arena[0], OAT_D.arena[1] + 128],
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
