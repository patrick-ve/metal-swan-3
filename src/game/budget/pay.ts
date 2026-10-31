/**
 * The pay path of the budget (docs/design/oat.md §7.1; the contract: ./types.ts). Owner: BUDGET.
 * WAVE A STUB (CORE): the signature every pay site uses; it does nothing yet. BUDGET implements it
 * beside `awardScore` (events.ts): book the signed cents in the slot's ledger and category, emit
 * the `pay` event (`PayEvent`), raise the HUD pop-up, give the extends.
 *
 * ```ts
 * pay(world, owner, 15, x, y, 'deposit');      // a can: +€ 0,15
 * pay(world, slot, -9500, p.x, p.y, 'boete');   // a BOETE death: -€ 95,00
 * ```
 */
import type { World } from '../../engine/world';
import type { BudgetCategory, Cents } from './types';

/**
 * Pay `cents` (signed; 0 does nothing) to player slot `slot` (0 / 1; anything else is ignored) in
 * `category`, with the pop-up at world (x, y) (undefined: at the HUD's budget line only). Only in a
 * mission with `economy: 'euro'`; elsewhere it does nothing.
 */
export function pay(_world: World, _slot: number | undefined, _cents: Cents, _x: number | undefined, _y: number | undefined, _category: BudgetCategory): void {
  // BUDGET (wave A) implements this.
}
