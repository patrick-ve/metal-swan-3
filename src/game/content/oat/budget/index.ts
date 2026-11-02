/**
 * The budget pieces of mission oat (docs/design/oat.md §6.1, §6.2; spec §11 "Content"): the
 * statiegeld bin `oat-bin` (bin.ts), its cans and bottles `oat-can`, `oat-bottle-s`,
 * `oat-bottle-l` (cans.ts), DE HAVERBAR `oat-haverbar` (shop.ts) with its goods and the statuses
 * `oat-flat-white`, `oat-matcha`, `oat-zuurdesem` (goods.ts), and their art (art.ts). First
 * versions by BUDGET (wave A); PIECES (wave B) adds the envelope and the conceptstore here and
 * polishes the art.
 *
 * Manifest id `oat/budget` (lazy with the oat chunk: content/index.ts `isOatContent`).
 */
import './art';
import './cans';
import './bin';
import './goods';
import './shop';

export { BIN, binRng, OatBin, type BinSize } from './bin';
export { collectDeposit, DEPOSIT_CAP, DEPOSIT_CENTS, DEPOSIT_IDS, depositsAlive, OatDeposit, spawnDeposit, type DepositId } from './cans';
export { buyGood, goodOf, HAVERBAR, HAVERBAR_GOODS, haverbarPrice, KRUIM_POP, MATCHA_CALLOUT, type BuyResult, type GoodDef, type GoodKey } from './goods';
export { OatHaverbar, SHOP } from './shop';
export { OAT_BUDGET_OUTLINED, OAT_BUDGET_SPRITES } from './art';
