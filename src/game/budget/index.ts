/**
 * The game-wide euro budget (docs/design/oat.md §7; docs/api/oat.md "Budget", docs/api/budget.md):
 * the contract (types.ts), the notation (format.ts) and the pay path (pay.ts). Owner: BUDGET; CORE
 * wrote the contract and the stubs (oat wave A). Pure and node-tested; integer cents only.
 */
export * from './types';
export { euroText } from './format';
export { pay } from './pay';
