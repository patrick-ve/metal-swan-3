/**
 * The euro budget's pure parts (docs/design/budget.md §7.1–§7.5, §7.7): the ledger, the notation, the
 * euro table, the costs and the `budgets` table.
 */
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../../src/engine/storage';
import {
  BOSS_CENTS,
  bonusCents,
  BudgetTable,
  BUDGET_CATEGORIES,
  BUDGET_KEY,
  DEFAULT_BUDGETS,
  EXTEND_CENTS,
  euroText,
  fineFor,
  fpsCents,
  inflated,
  killCents,
  Ledger,
  MINI_BOSS_CENTS,
  pickpocketCents,
  pointsToCents,
  refused,
  splitFare,
  START_CENTS,
  touristTax,
  withDifficulty,
} from '../../../src/game/budget/index';

describe('budget: the notation (spec §7.5)', () => {
  it('writes € 1.234,56 with dots for thousands, a comma for cents and a space after €', () => {
    expect(euroText(123456)).toBe('€ 1.234,56');
    expect(euroText(10000)).toBe('€ 100,00');
    expect(euroText(0)).toBe('€ 0,00');
    expect(euroText(5)).toBe('€ 0,05');
    expect(euroText(123456789)).toBe('€ 99.999,99');
  });

  it('writes negatives with the hyphen before €, and clamps at ± € 99.999,99', () => {
    expect(euroText(-1234)).toBe('-€ 12,34');
    expect(euroText(-1234567)).toBe('-€ 12.345,67');
    expect(euroText(-123456789)).toBe('-€ 99.999,99');
    expect(euroText(-123456789, { clamp: false })).toBe('-€ 1.234.567,89');
  });

  it('writes the compact pop-ups: +€0,15, -€95, +€0,45', () => {
    expect(euroText(15, { plus: true, compact: true })).toBe('+€0,15');
    expect(euroText(-9500, { compact: true })).toBe('-€95');
    expect(euroText(45, { plus: true, compact: true })).toBe('+€0,45');
    expect(euroText(150000, { plus: true, compact: true })).toBe('+€1.500');
  });
});

describe('budget: the ledger (spec §7.1)', () => {
  it('starts at € 100,00, books signed cents, keeps the gross for income only', () => {
    const l = new Ledger();
    expect(l.cents).toBe(START_CENTS);
    l.book(15, 'deposit');
    l.book(-9500, 'boete');
    expect(l.cents).toBe(10000 + 15 - 9500);
    expect(l.gross).toBe(15);
    expect(l.missionNet).toBe(15 - 9500);
    expect(l.tally('deposit')).toEqual({ count: 1, cents: 15 });
    expect(l.tally('boete')).toEqual({ count: 1, cents: -9500 });
  });

  it('goes red below € 0 (rood staan) and truncates fractions', () => {
    const l = new Ledger();
    l.book(-20000.9, 'assessment');
    expect(l.cents).toBe(-10000);
    expect(l.red).toBe(true);
    l.book(Number.NaN, 'other');
    expect(l.cents).toBe(-10000);
  });

  it('gives the extends at a gross income, never for costs, each once', () => {
    const l = new Ledger([1000, 3000]);
    expect(l.book(999, 'enemy')).toBe(0);
    expect(l.book(-5000, 'boete')).toBe(0);
    expect(l.book(1, 'enemy')).toBe(1);
    expect(l.book(5000, 'boss')).toBe(1);
    expect(l.book(99999, 'boss')).toBe(0);
    expect(l.extendsGiven).toBe(2);
    // A big income past both thresholds at once gives both.
    expect(new Ledger([1000, 3000]).book(5000, 'boss')).toBe(2);
  });

  it('extends at € 5.000 and € 5.500 of gross income (tuned: docs/api/budget.md)', () => {
    expect(EXTEND_CENTS).toEqual([500_000, 550_000]);
  });

  it('a new mission starts the tallies at zero and carries the balance', () => {
    const l = new Ledger();
    for (let i = 0; i < 37; i++) l.book(15, 'deposit');
    expect(l.tally('deposit')).toEqual({ count: 37, cents: 555 });
    l.startMission();
    expect(l.tally('deposit')).toEqual({ count: 0, cents: 0 });
    expect(l.cents).toBe(10555);
    expect(l.missionNet).toBe(0);
  });

  it('skims the courtage in milli-cents and moves whole cents (1,5 %)', () => {
    const l = new Ledger();
    // 1,5 % of € 0,15 = 0,225 cents: whole cents only after the fifth can.
    const moved = [1, 2, 3, 4, 5].map(() => l.skim(15, 150));
    expect(moved).toEqual([0, 0, 0, 0, 1]);
    expect(l.skim(10000, 150)).toBe(150);
  });

  it('rewinds a floor\'s income (the fps restart) and keeps its costs', () => {
    const l = new Ledger();
    const at = l.gross;
    l.book(2000, 'enemy');
    l.book(-500, 'tax');
    l.rewindIncome(at);
    expect(l.gross).toBe(0);
    expect(l.cents).toBe(10000 - 500);
  });

  it('has at most 32 categories (the kassabon\'s fixed slots)', () => {
    expect(BUDGET_CATEGORIES.length).toBeLessThanOrEqual(32);
  });
});

describe('budget: the euro table (spec §7.2)', () => {
  it('pays legacy points ÷ 50, rounded to € 0,50, capped at € 25,00', () => {
    expect(pointsToCents(100)).toBe(200);
    expect(pointsToCents(150)).toBe(300);
    expect(pointsToCents(130)).toBe(250);
    expect(pointsToCents(10000)).toBe(2500);
    expect(pointsToCents(0)).toBe(0);
    expect(pointsToCents(-5)).toBe(0);
  });

  it('pays the rows by id, the mini-bosses € 150 and the bosses € 250', () => {
    expect(killCents('handhaver', 300, false)).toBe(600);
    expect(killCents('delivery-rider', 200, false)).toBe(400);
    expect(killCents('seagull', 150, false)).toBe(300);
    expect(killCents('fatbike-youth', 300, false)).toBe(600);
    expect(killCents('fatbike-youth', 500, false)).toBe(1000);
    expect(killCents('stag-partier', 300, false)).toBe(600);
    expect(killCents('stag-partier', 1000, false)).toBe(2000);
    expect(killCents('stag-beer-bike', 99, false)).toBe(2500);
    expect(killCents('oz-grunt', 300, false)).toBe(300);
    expect(killCents('oz-mg', 1000, false)).toBe(1200);
    expect(killCents('ams-scan-car', 0, false)).toBe(MINI_BOSS_CENTS);
    expect(killCents('ams-mayor', 0, false)).toBe(BOSS_CENTS);
    expect(killCents('sewers-rattenjong', 0, false)).toBe(25000);
  });

  it('a knife kill of a soft enemy pays ×2 (CONTANT)', () => {
    expect(killCents('handhaver', 300, true)).toBe(1200);
  });

  it('pays the bonuses at points ÷ 500 and the difficulty factor at the total', () => {
    expect(bonusCents(10000)).toBe(2000);
    expect(bonusCents(18000)).toBe(3600);
    expect(withDifficulty(3600, 1.5)).toBe(5400);
    expect(withDifficulty(3601, 0.5)).toBe(1801);
  });

  it('pays the fps floors: kills by the legacy rule, treasure € 5–€ 50, the boss € 250', () => {
    expect(fpsCents(100, 'kill')).toBe(200);
    expect(fpsCents(500, 'kill')).toBe(1000);
    expect(fpsCents(100, 'treasure', 'pocket-watch')).toBe(500);
    expect(fpsCents(5000, 'treasure', 'music-box')).toBe(5000);
    expect(fpsCents(10000, 'treasure', 'golden-record')).toBe(5000);
    expect(fpsCents(5000, 'boss')).toBe(25000);
  });
});

describe('budget: the costs (spec §7.3, §6.2, §3)', () => {
  it('fines a ticket death € 95,00 BOETE in every section (the section rule went with the former level 2)', () => {
    expect(fineFor('a')).toEqual({ cents: 9500, category: 'boete' });
    expect(fineFor('oz-a')).toEqual({ cents: 9500, category: 'boete' });
    expect(fineFor('sewers-a')).toEqual({ cents: 9500, category: 'boete' });
  });

  it('taxes a continue 12,5 → 15 → 17,5 → 20 % of a positive budget, at least € 5,00; € 12,50 flat at ≤ € 0', () => {
    expect(touristTax(100000, 1)).toBe(12500);
    expect(touristTax(100000, 2)).toBe(15000);
    expect(touristTax(100000, 3)).toBe(17500);
    expect(touristTax(100000, 4)).toBe(20000);
    expect(touristTax(100000, 9)).toBe(20000);
    expect(touristTax(1000, 1)).toBe(500);
    expect(touristTax(0, 1)).toBe(1250);
    expect(touristTax(-5000, 3)).toBe(1250);
    expect(touristTax(12345, 1)).toBe(1543);
  });

  it('raises a Haverbar price 10 % per buy to € 0,05 (INFLATIE), and refuses at ≤ € 0 or below the price (GEWEIGERD)', () => {
    expect(inflated(445, 0)).toBe(445);
    expect(inflated(445, 1)).toBe(490);
    expect(inflated(445, 2)).toBe(540);
    expect(inflated(900, 1)).toBe(990);
    expect(refused(1000, 445)).toBe(false);
    expect(refused(400, 445)).toBe(true);
    expect(refused(0, 0)).toBe(true);
    expect(refused(-1, 445)).toBe(true);
  });

  it('the dealer takes 10 % (€ 5,00 … € 50,00) and finds nothing at ≤ € 0', () => {
    expect(pickpocketCents(10000)).toBe(1000);
    expect(pickpocketCents(1000)).toBe(500);
    expect(pickpocketCents(900000)).toBe(5000);
    expect(pickpocketCents(0)).toBe(0);
  });

  it('splits a fare in 2P (half each; P1 pays the odd cent)', () => {
    expect(splitFare(8750, 1)).toEqual([8750, 0]);
    expect(splitFare(8751, 2)).toEqual([4376, 4375]);
  });
});

describe('budget: the budgets table (spec §7.7)', () => {
  it('has the ten positive defaults € 2.500 … € 150, sorted', () => {
    const t = new BudgetTable();
    expect(t.entries.map((e) => e.cents)).toEqual([250000, 200000, 160000, 125000, 100000, 80000, 60000, 40000, 25000, 15000]);
    expect(t.top).toBe(250000);
    expect(DEFAULT_BUDGETS.every((e) => e.cents > 0)).toBe(true);
  });

  it('a run qualifies only by beating the 10th row: a red run never enters', () => {
    const t = new BudgetTable();
    expect(t.qualifies(15000)).toBe(false);
    expect(t.qualifies(15001)).toBe(true);
    expect(t.qualifies(-500)).toBe(false);
    expect(t.submit({ name: 'RED', cents: -500, mission: 'sewers', character: 'bob', continues: 3 })).toBe(-1);
    expect(t.submit({ name: 'NEW', cents: 170000, mission: 'sewers', character: 'bob', continues: 0, difficulty: 'hard' })).toBe(2);
    expect(t.entries.length).toBe(10);
    expect(t.entries[9].cents).toBe(25000);
    expect(t.rankOf(300000)).toBe(0);
  });

  it('saves under the key `budgets` and loads it back (bad rows dropped, signed rows kept)', () => {
    const store = new MemoryStore();
    const t = new BudgetTable();
    t.submit({ name: 'ABC', cents: 123456, mission: 'all', character: 'vincent', continues: 1, difficulty: 'easy' });
    expect(t.save(store)).toBe(true);
    expect(store.get(BUDGET_KEY)).not.toBeNull();
    const back = BudgetTable.load(store);
    expect(back.entries).toEqual(t.entries);
    store.set(BUDGET_KEY, JSON.stringify([{ name: 'X', cents: 'nope' }, { name: 'NEG', cents: -100, mission: 'ams', character: '', continues: 0 }]));
    const odd = BudgetTable.load(store);
    expect(odd.entries.map((e) => e.name)).toEqual(['NEG']);
    expect(BudgetTable.load(new MemoryStore()).entries.length).toBe(10);
  });
});
