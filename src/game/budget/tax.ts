/**
 * The costs of the budget (docs/design/budget.md §7.3, §7.4): pure integer rules.
 *
 * - The `BOETE` fine on a death by a ticket: − € 95,00.
 * - The toeristenbelasting on a continue: 12,5 % → 15 → 17,5 → 20 % of a positive budget (at least
 *   € 5,00); a flat € 12,50 at ≤ € 0.
 * - INFLATIE (the Haverbar): +10 % per buy, rounded to € 0,05; GEWEIGERD when the price is above
 *   the budget or the budget is ≤ € 0.
 * - The dealer's pickpocket: 10 % of a positive budget (€ 5,00 … € 50,00; nothing at ≤ € 0).
 * - The taxi fare in 2P: half each, P1 pays the odd cent.
 */
import type { BudgetCategory, Cents } from './types';

/** The `BOETE` fine (§7.3). */
export const BOETE_CENTS: Cents = 9500;
/**
 * The fine of a ticket death in `sectionId`: the cents (positive: the cost) and the category. Every
 * section fines the same `BOETE` (the section rule of the former level 2 went with it on 2026-11-12).
 */
export function fineFor(_sectionId: string): { cents: Cents; category: BudgetCategory } {
  return { cents: BOETE_CENTS, category: 'boete' };
}

/** The toeristenbelasting rates in ‰ by continue (the 1st, 2nd, 3rd, 4th and later). */
export const TOURIST_TAX_PERMILLE: readonly number[] = [125, 150, 175, 200];
/** The least tax on a positive budget (€ 5,00) and the flat tax at ≤ € 0 (€ 12,50). */
export const TOURIST_TAX_MIN: Cents = 500;
export const TOURIST_TAX_FLAT: Cents = 1250;

/** The rate (‰) of continue number `n` (1 = the first continue). */
export function touristRate(n: number): number {
  const i = Math.max(0, Math.min(TOURIST_TAX_PERMILLE.length - 1, Math.floor(n) - 1));
  return TOURIST_TAX_PERMILLE[i];
}

/** The toeristenbelasting (a positive cost) of continue number `n` on a budget of `cents`. */
export function touristTax(cents: Cents, n: number): Cents {
  if (cents <= 0) return TOURIST_TAX_FLAT;
  return Math.max(TOURIST_TAX_MIN, Math.floor((cents * touristRate(n)) / 1000));
}

/** INFLATIE (§6.2): the price after `buys` buys of an item that started at `base` (+10 % each, to € 0,05). */
export function inflated(base: Cents, buys: number): Cents {
  let p = Math.max(0, Math.floor(base));
  for (let i = 0; i < buys; i++) p = Math.round((p * 11) / 10 / 5) * 5;
  return p;
}

/** GEWEIGERD (§6.2, §7.4): refused when the budget is ≤ € 0 or below the price. */
export function refused(budget: Cents, price: Cents): boolean {
  return budget <= 0 || budget < price;
}

/** The dealer's take (§3: 10 % of a positive budget, € 5,00 … € 50,00; 0 at ≤ € 0: NIKS TE HALEN). */
export function pickpocketCents(budget: Cents): Cents {
  if (budget <= 0) return 0;
  return Math.min(5000, Math.max(500, Math.floor(budget / 10)));
}

/** A fare split over `players` (2P: half each, P1 pays the odd cent): [p1, p2]. */
export function splitFare(cents: Cents, players: number): [Cents, Cents] {
  const c = Math.max(0, Math.floor(cents));
  if (players < 2) return [c, 0];
  const half = Math.floor(c / 2);
  return [c - half, half];
}
