/**
 * The façade grammar of mission `oat` (docs/design/oat.md §8.6, levers L7 + L8; docs/api/oat.md
 * "Grammar"). Owner: GRAMMAR. One-line contract: it registers the strip source `OAT_STRIP_SOURCE`
 * (`defineStripSource`, mission/strips/) that plans a section's façade rows from a street sheet and
 * paints their chunks at 1× / 2× / 4× in either light set, and it exposes the planned lots
 * (`facadeLots`) so LIGHT-WATER's shadow function and the tests read the same heights and
 * protrusions the painters draw.
 *
 * WAVE A STUB (CORE): the types and the lot query (no lots yet); GRAMMAR fills the folder (parts,
 * street sheets, the sequencer with the no-repeat rule, the opposite row, wear and wetness).
 */

/** The street style sheets (spec §8.6 table). */
export type StreetSheetId = '9-straatjes' | 'canal-front' | 'grimburgwal' | 'oudezijds' | 'trompettersteeg' | 'oudekerksplein';

/** The gable types (spec §8.6 "Gables"). */
export type GableType = 'trap' | 'hals' | 'verhoogde-hals' | 'klok' | 'tuit' | 'lijst' | 'plastered' | 'infill' | 'none';

/** One planned lot of a façade row, in world px (the grammar's output; spec §8.2 numbers). */
export interface FacadeLot {
  /** World x of the lot's left edge and its width (Amsterdam feet × 0.6 scale, spec §8.2). */
  u0: number;
  w: number;
  gable: GableType;
  /** Wall material and window type ids of the grammar (the no-repeat triple with `gable`). */
  wall: string;
  window: string;
  /** Height of the ground band above the façade base (true scale, 64–84 px) and of the ridge / gable tip (world px). */
  bandTop: number;
  ridge: number;
  /** Protrusions that cast shadows (spec §8.4): depth in metres and height above the base in world px. */
  protrusions: readonly { readonly kind: string; readonly u0: number; readonly u1: number; readonly y: number; readonly depthM: number }[];
}

/**
 * The planned lots of a section's façade rows (and its unseen opposite row with `opposite`), in
 * world x order. Empty until GRAMMAR plans them (wave A stub).
 */
export function facadeLots(_sectionId: string, _opposite = false): readonly FacadeLot[] {
  return [];
}
