/**
 * The `budgets` high-score table (docs/design/oat.md §7.7): signed rows `{ name, cents, mission,
 * character, continues, difficulty }` sorted by cents, ten kept, stored as JSON under the key
 * `budgets` (`metal-swan-3:budgets` in the browser's prefixed store). A run qualifies only by
 * beating the 10th row (the defaults are positive, so a red run does not enter). The old
 * `highscores` key stays for point runs (the dormant ring, m0–m5 by URL) with its own table.
 *
 * ```ts
 * const t = BudgetTable.load(store);       // the defaults when nothing was saved
 * if (t.qualifies(slot.cents)) t.submit({ name: 'VIN', cents: slot.cents, mission: 'oat', character: 'vincent', continues: 0 });
 * t.save(store);
 * ```
 */
import { loadJson, saveJson, type Store } from '../../engine/storage';
import type { Cents } from './types';

export type BudgetDifficulty = 'easy' | 'normal' | 'hard';

export interface BudgetEntry {
  name: string;
  /** The final budget in signed cents. */
  cents: Cents;
  /** Furthest mission id reached ('all' = the whole campaign). */
  mission: string;
  character: string;
  continues: number;
  difficulty?: BudgetDifficulty;
}

/** The store key (spec §7.7). */
export const BUDGET_KEY = 'budgets';
export const BUDGET_COUNT = 10;

/** The defaults (spec §7.7: € 2.500 … € 150 with the existing names of the points table). */
export const DEFAULT_BUDGETS: readonly Readonly<BudgetEntry>[] = [
  { name: 'VIN', cents: 250_000, mission: 'all', character: 'vincent', continues: 0, difficulty: 'normal' },
  { name: 'THO', cents: 200_000, mission: 'all', character: 'thom', continues: 1, difficulty: 'hard' },
  { name: 'DRK', cents: 160_000, mission: 'oldenzaal', character: 'dirk', continues: 0, difficulty: 'normal' },
  { name: 'BOB', cents: 125_000, mission: 'oldenzaal', character: 'bob', continues: 2, difficulty: 'normal' },
  { name: 'PAT', cents: 100_000, mission: 'rally', character: 'patrick', continues: 1, difficulty: 'normal' },
  { name: 'HIS', cents: 80_000, mission: 'rally', character: '', continues: 0, difficulty: 'normal' },
  { name: 'BLR', cents: 60_000, mission: 'oat', character: '', continues: 1, difficulty: 'normal' },
  { name: 'RIM', cents: 40_000, mission: 'oat', character: '', continues: 0, difficulty: 'easy' },
  { name: 'PUF', cents: 25_000, mission: 'ams', character: '', continues: 3, difficulty: 'normal' },
  { name: 'PIZ', cents: 15_000, mission: 'ams', character: '', continues: 0, difficulty: 'normal' },
];

function isBudgetDifficulty(v: unknown): v is BudgetDifficulty {
  return v === 'easy' || v === 'normal' || v === 'hard';
}

/** A stored row, cleaned (bad rows → null). Signed cents are kept (a negative row can be stored). */
export function cleanBudgetEntry(v: unknown): BudgetEntry | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const cents = Number(o.cents);
  if (!Number.isFinite(cents)) return null;
  const str = (x: unknown, max: number): string => (typeof x === 'string' ? x.slice(0, max) : '');
  return {
    name: str(o.name, 8) || '???',
    cents: Math.trunc(cents),
    mission: str(o.mission, 16),
    character: str(o.character, 24),
    continues: Math.max(0, Math.floor(Number(o.continues) || 0)),
    difficulty: isBudgetDifficulty(o.difficulty) ? o.difficulty : undefined,
  };
}

/** A fresh copy of the defaults. */
export function defaultBudgetEntries(): BudgetEntry[] {
  return DEFAULT_BUDGETS.map((e) => ({ ...e }));
}

export class BudgetTable {
  entries: BudgetEntry[];

  constructor(entries: BudgetEntry[] = defaultBudgetEntries()) {
    this.entries = entries.slice(0, BUDGET_COUNT);
    this.sort();
  }

  /** The saved table, or the defaults when nothing (or nothing valid) was saved. */
  static load(store: Store): BudgetTable {
    const list = loadJson<BudgetEntry[] | null>(store, BUDGET_KEY, null, (v) => {
      if (!Array.isArray(v)) return null;
      return v.map(cleanBudgetEntry).filter((e): e is BudgetEntry => e !== null);
    });
    return new BudgetTable(list && list.length ? list : defaultBudgetEntries());
  }

  save(store: Store): boolean {
    return saveJson(store, BUDGET_KEY, this.entries);
  }

  /** Would this budget enter the table (it must beat the 10th row; a short table takes any positive one)? */
  qualifies(cents: Cents): boolean {
    if (!Number.isFinite(cents)) return false;
    if (this.entries.length < BUDGET_COUNT) return cents > 0;
    return cents > this.entries[this.entries.length - 1].cents;
  }

  /** Insert a row; returns its rank (0-based) or -1 when it did not make the table. */
  submit(entry: BudgetEntry): number {
    if (!this.qualifies(entry.cents)) return -1;
    const row = { ...entry, cents: Math.trunc(entry.cents) };
    this.entries.push(row);
    this.sort();
    this.entries.length = Math.min(this.entries.length, BUDGET_COUNT);
    return this.entries.indexOf(row);
  }

  /** The best budget (0 for an empty table). */
  get top(): Cents {
    return this.entries[0]?.cents ?? 0;
  }

  /** The rank a budget would get (0-based; the table's length when it does not enter). */
  rankOf(cents: Cents): number {
    const i = this.entries.findIndex((e) => cents > e.cents);
    return i < 0 ? this.entries.length : i;
  }

  private sort(): void {
    // Stable: an equal budget enters below the older row.
    this.entries.sort((a, b) => b.cents - a.cents);
  }
}
