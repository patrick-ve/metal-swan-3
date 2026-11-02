/**
 * The signed ledger of one player slot (docs/design/oat.md §7.1; the contract: ./types.ts
 * `BudgetLedger`). Integer cents only: the balance (`cents`, may go red: rood staan, §7.4), the
 * run's GROSS income (the extends count it; costs never reduce it), the extends already given, and
 * this mission's fixed category tallies for the kassabon (§7.6: count + cents per category, one
 * preallocated record each, so booking never allocates). The courtage skim (§4) accrues in
 * milli-cents and moves whole cents.
 *
 * ```ts
 * const l = new Ledger();            // € 100,00
 * l.book(15, 'deposit');            // +€ 0,15 → 0 extends
 * l.book(-9500, 'boete');           // −€ 95,00 (gross unchanged)
 * l.tally('deposit').count;         // 1
 * l.missionNet;                     // −9.485
 * ```
 */
import { BUDGET_CATEGORIES, EXTEND_CENTS, START_CENTS, type BudgetCategory, type BudgetLedger, type Cents, type CategoryTally } from './types';

/** The index of every category id (fixed order: `BUDGET_CATEGORIES`). */
const CATEGORY_INDEX: Readonly<Record<string, number>> = Object.fromEntries(BUDGET_CATEGORIES.map((id, i) => [id, i]));

/** A whole number of cents (fractions truncate toward zero; NaN / ∞ → 0). */
export function toCents(v: number): Cents {
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

export class Ledger implements BudgetLedger {
  private balance: Cents = START_CENTS;
  private grossIncome: Cents = 0;
  /** Extends given for gross income (index into `thresholds`). */
  extendsGiven = 0;
  /** The gross thresholds of the extends (EXTEND_CENTS; tests may pass their own). */
  readonly thresholds: readonly Cents[];
  /** The balance when the mission started (the kassabon's SALDO line and OVERSCHOT / TEKORT). */
  private startBalance: Cents = START_CENTS;
  private readonly counts = new Int32Array(BUDGET_CATEGORIES.length);
  private readonly sums: number[] = BUDGET_CATEGORIES.map(() => 0);
  private readonly view: CategoryTally = { count: 0, cents: 0 };
  /** Milli-cents of a running skim (the courtage) not yet moved as whole cents. */
  private skimMilli = 0;

  constructor(thresholds: readonly Cents[] = EXTEND_CENTS) {
    this.thresholds = thresholds;
  }

  get cents(): Cents {
    return this.balance;
  }

  get gross(): Cents {
    return this.grossIncome;
  }

  /** The balance at this mission's start. */
  get missionStart(): Cents {
    return this.startBalance;
  }

  get missionNet(): Cents {
    return this.balance - this.startBalance;
  }

  /** Below € 0 (rood staan): the HUD turns red, the shop refuses, the dealer finds nothing. */
  get red(): boolean {
    return this.balance < 0;
  }

  /**
   * Book `cents` (signed; whole cents) in `category`, counting `count` items (default 1; 0 books
   * money without an item, e.g. a merged return). Income raises the gross; returns how many extends
   * the gross crossed (the caller gives the lives).
   */
  book(cents: Cents, category: BudgetCategory, count = 1): number {
    const c = toCents(cents);
    const i = CATEGORY_INDEX[category] ?? CATEGORY_INDEX.other;
    this.counts[i] += count;
    this.sums[i] += c;
    if (c === 0) return 0;
    this.balance += c;
    if (c < 0) return 0;
    this.grossIncome += c;
    let extra = 0;
    while (this.extendsGiven < this.thresholds.length && this.grossIncome >= this.thresholds[this.extendsGiven]) {
      this.extendsGiven++;
      extra++;
    }
    return extra;
  }

  tally(category: BudgetCategory): Readonly<CategoryTally> {
    const i = CATEGORY_INDEX[category] ?? CATEGORY_INDEX.other;
    this.view.count = this.counts[i];
    this.view.cents = this.sums[i];
    return this.view;
  }

  startMission(): void {
    this.counts.fill(0);
    for (let i = 0; i < this.sums.length; i++) this.sums[i] = 0;
    this.startBalance = this.balance;
    this.skimMilli = 0;
  }

  /**
   * A skim of `perTenThousand` / 10.000 of an income (the courtage: 150 = 1,5 %), accrued in
   * milli-cents; returns the whole cents it moves now (0 until a whole cent has built up).
   */
  skim(income: Cents, perTenThousand: number): Cents {
    if (income <= 0 || perTenThousand <= 0) return 0;
    // income × perTenThousand / 10.000 cents = income × perTenThousand / 10 milli-cents.
    this.skimMilli += Math.floor((toCents(income) * Math.floor(perTenThousand)) / 10);
    const whole = Math.floor(this.skimMilli / 1000);
    this.skimMilli -= whole * 1000;
    return whole;
  }

  /**
   * The first-person floor restart (docs/design/fps.md §4.11: "score back"): the income booked
   * since the gross was `grossAt` is taken back (balance and gross); costs stay paid, extends stay
   * given. Category tallies are not rewound (the fps floors have no kassabon).
   */
  rewindIncome(grossAt: Cents): void {
    const d = this.grossIncome - toCents(grossAt);
    if (d <= 0) return;
    this.grossIncome -= d;
    this.balance -= d;
  }

  /** A fresh game: € 100,00, no gross, no extends, empty tallies. */
  reset(): void {
    this.balance = START_CENTS;
    this.grossIncome = 0;
    this.extendsGiven = 0;
    this.startMission();
  }
}
