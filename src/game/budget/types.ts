/**
 * THE BUDGET CONTRACT (the game-wide euro budget; docs/design/oat.md §7; docs/api/oat.md "Budget",
 * docs/api/budget.md). CORE wrote it (oat wave A); BUDGET implements the folder behind it
 * (ledger.ts, pay.ts, euro-table.ts, tax.ts, scores.ts, the receipt) and the hooks in the shared
 * files (session.ts `PlayerSlot.cents`, events.ts, runner.ts, hud.ts, the screens). Types only.
 *
 * The rules every implementation keeps:
 * - Money is SIGNED INTEGER CENTS per player slot (`Cents`), next to the old points (`score`), which
 *   keep counting for the point missions and the sims. Every player starts with +10.000 (€ 100,00).
 * - Integer maths only: `floor(cents × permille / 1000)`; the 1.5 % courtage accrues in milli-cents
 *   and moves whole cents. No float ever reaches a ledger.
 * - The pay path is ONE call (`pay`, pay.ts) beside `awardScore` (which refuses ≤ 0): it accepts
 *   negatives, emits a `pay` event, raises HUD pop-ups (never entities: entity ids stay as they
 *   were) and counts into a fixed set of categories (≤ 32 per slot per mission, no allocation per
 *   tick) for the kassabon.
 * - A mission opts in with `MissionDef.economy: 'euro'` (ams, oat, oldenzaal); without it nothing
 *   changes (the dormant ring, m0–m5). No `world.rng` call is added on a shared path.
 */

/** Signed integer euro cents (+10.000 = € 100,00). Never a fraction. */
export type Cents = number;

/** Every player's start budget (spec decision 18): € 100,00. */
export const START_CENTS: Cents = 10_000;

/** The HUD and the screens clamp the shown amount at ± € 99.999,99 (spec §7.5). */
export const DISPLAY_MAX_CENTS: Cents = 9_999_999;

/**
 * The extends (`ONE MORE TRY!`) at a GROSS income of the whole run (never reduced by costs; spec
 * §7.1). The spec's start values were € 1.000 and € 3.000; spec §7.10 says they must not fire in the
 * identity sims, but one `ams` god run alone earns € 2.158 gross (kills pay points ÷ 50, not ÷ 500),
 * and at € 1.000 the extend changed `ams-normal-1`. BUDGET tuned them to € 5.000 and € 15.000;
 * FIX-A measured a strong run (god sims + the flawless tallies + a won race) and set the second to
 * € 5.500, so a strong run reaches it by the fps floors once oat is full (€ 15.000 was never
 * reached; docs/api/budget.md "Extends", spec §7.1). No extend fires inside one `ams` run (€ 2.066).
 */
export const EXTEND_CENTS: readonly Cents[] = [500_000, 550_000];

/**
 * The kassabon's categories (spec §7.6): a fixed list (≤ 32), so a slot counts into fixed slots
 * (count + cents) with no allocation. The value is the receipt label (start values; BUDGET may
 * tune the wording, never the ids).
 */
export const BUDGET_CATEGORY = {
  /** Kills (enemies; the bosses have their own line). */
  enemy: 'VIJANDEN',
  /** Knife kills of soft enemies (×2, spec §7.2; BUDGET added it, 2026-11-01). */
  cash: 'CONTANT',
  boss: 'BAAS',
  /** Pickups and items with a value (food, gems, weapon crates' worth). */
  item: 'BUIT',
  record: 'GOUDEN PLAAT',
  /** Breakables, `VERKOCHT` signs, CAUGHT NAPPING. */
  prop: 'SLOOP',
  deposit: 'STATIEGELD',
  sponsor: 'SPONSORDEAL',
  flatWhite: 'FLAT WHITE',
  matcha: 'MATCHA',
  zuurdesem: 'ZUURDESEM',
  brioche: 'KAASBRIOCHE',
  lakschade: 'LAKSCHADE',
  boete: 'BOETE',
  blowverbod: 'BLOWVERBOD',
  pickpocket: 'ZAKKENROLLER',
  wallet: 'PORTEMONNEE',
  refund: 'TERUGGAAF',
  assessment: 'AANSLAG',
  courtage: 'COURTAGE',
  courtageBack: 'COURTAGE TERUG',
  rent: 'HUURVERHOGING',
  tax: 'TOERISTENBELASTING',
  taxiEscaped: 'TAXI (NIET GEREDEN)',
  deposit250: 'BORG TERUG',
  fare: 'RIT NAAR DE RING',
  /** The tally and final bonuses (hostages, flawless, boss speed, …; legacy points ÷ 500). */
  bonus: 'BONUS',
  /** The rally's prize money (place, time, best lap, …; spec §7.8). */
  prize: 'PRIJZENGELD',
  /** The fps floors' treasure (spec §7.9). */
  treasure: 'SCHAT',
  other: 'OVERIG',
} as const;

/** A category id (the key of `BUDGET_CATEGORY`). */
export type BudgetCategory = keyof typeof BUDGET_CATEGORY;

/** The category ids in receipt order. */
export const BUDGET_CATEGORIES: readonly BudgetCategory[] = Object.keys(BUDGET_CATEGORY) as BudgetCategory[];

/** One category's tally in a slot's mission ledger. */
export interface CategoryTally {
  count: number;
  cents: Cents;
}

/**
 * A player slot's ledger as BUDGET implements it (ledger.ts; `PlayerSlot.cents` is its balance).
 * The method names are the contract the screens, the tallies and the content call.
 */
export interface BudgetLedger {
  /** The balance (may be below 0: rood staan, spec §7.4). */
  readonly cents: Cents;
  /** Gross income of the whole run (the extends count it; costs never reduce it). */
  readonly gross: Cents;
  /** Book `cents` (signed) in a category; returns the number of extends it earned (0, 1 or 2). */
  book(cents: Cents, category: BudgetCategory): number;
  /** This mission's tally of a category (a reused record: read it, never keep it). */
  tally(category: BudgetCategory): Readonly<CategoryTally>;
  /** The mission's net (income − costs) since `startMission` (the kassabon's OVERSCHOT / TEKORT). */
  readonly missionNet: Cents;
  /** A new mission: the category tallies start at zero (the balance carries over). */
  startMission(): void;
}

/** The `pay` event (world.events, beside 'score'): what the HUD's pop-ups and the kassabon read. */
export interface PayEvent {
  player: 0 | 1;
  /** Signed cents. */
  cents: Cents;
  category: BudgetCategory;
  /** World px of the pop-up (undefined: the HUD shows it at the budget line only). */
  x?: number;
  y?: number;
}

/** Options of `euroText` (format.ts). */
export interface EuroTextOpts {
  /** '+' before a positive amount (the pop-ups: `+€0,15`). Default false. */
  plus?: boolean;
  /** No space after `€` and no `,00` on whole euros (the pop-ups: `−€95` is written `-€95`). Default false. */
  compact?: boolean;
  /** Clamp at ± DISPLAY_MAX_CENTS (default true). */
  clamp?: boolean;
}
