/**
 * The euro table (docs/design/oat.md §7.2): what a kill, an item or a bonus pays in cents. Pure.
 *
 * - Every payer without a row: legacy points ÷ 50, rounded to € 0,50, capped at € 25,00
 *   (`pointsToCents`).
 * - The rows by entity id (`EURO_BY_ID`): the ams locals, the stag party, the oat cast, the
 *   oldenzaal dead, the mini-bosses (€ 150,00) and the bosses (€ 250,00), the breakables and
 *   `VERKOCHT` signs (€ 1,00).
 * - A knife kill of a soft enemy pays ×2 (`CONTANT`; it was ×5 in points).
 * - The tally and final bonuses: legacy points ÷ 500, × the difficulty factor at the total
 *   (`bonusCents`).
 * - The first-person floors (§7.9): kills € 2–€ 10 by type (legacy ÷ 50), treasure € 5–€ 50, the
 *   golden record € 50, the bosses € 250 (`fpsCents`).
 */
import type { Cents } from './types';

/** The cap of a payer without a row (§7.2). */
export const EURO_CAP: Cents = 2500;

/** Legacy points per euro of a payer without a row (§7.2: ÷ 50). */
export const POINTS_PER_EURO = 50;

/** Legacy points per euro of the tally and final bonuses (§7.2: ÷ 500). */
export const BONUS_POINTS_PER_EURO = 500;

/** The knife multiplier of a soft kill in euros (§7.2: ×2, was ×5). */
export const KNIFE_EURO_MULTIPLIER = 2;

/** The legacy rule: points ÷ 50, rounded to € 0,50, capped at € 25,00; ≤ 0 pays nothing. */
export function pointsToCents(points: number): Cents {
  if (!Number.isFinite(points) || points <= 0) return 0;
  // points / 50 euros = points × 2 cents; to the nearest 50 cents: round(points / 25) × 50.
  return Math.min(EURO_CAP, Math.round(points / 25) * 50);
}

/** A tally or final bonus: legacy points ÷ 500 (points / 5 cents), before the difficulty factor. */
export function bonusCents(points: number): Cents {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.floor(points / 5);
}

/** The difficulty factor on a bonus total (0.5 / 1 / 1.5): whole cents, rounded. */
export function withDifficulty(cents: Cents, factor: number): Cents {
  return Math.round(cents * (Number.isFinite(factor) ? factor : 1));
}

/** Mini-bosses (§7.2: the ams scan car, the statue, De Makelaar). */
export const MINI_BOSS_CENTS: Cents = 15_000;
/** Bosses (§7.2: the ams mayor, De Huisjesmelker). */
export const BOSS_CENTS: Cents = 25_000;

/**
 * The rows of §7.2 by entity id (cents). An id that is not listed pays by `pointsToCents`. The
 * fatbike pair pays its own row through its own (pair) points: 500 → € 10,00; the groom 1,000 →
 * € 20,00 by the legacy rule (the stag partier's row is € 6,00).
 */
export const EURO_BY_ID: Readonly<Record<string, Cents>> = {
  // ams (the level stays as it is: only the score changes)
  handhaver: 600,
  'delivery-rider': 400,
  seagull: 300,
  'stag-beer-bike': 2500,
  // oat (docs/design/oat.md §3)
  'oat-brammobiel': 1500,
  'oat-bakfiets': 1200,
  'oat-taxi': 2500,
  'oat-dealer': 500,
  'oat-handhaver-scooter': 800,
  // oldenzaal: grunt / rifleman / gunner / crawler
  'oz-grunt': 300,
  'oz-rifleman': 400,
  'oz-mg': 1200,
  'oz-crawler': 200,
  // mini-bosses and bosses
  'ams-scan-car': MINI_BOSS_CENTS,
  'oz-plechelmus': MINI_BOSS_CENTS,
  'oat-makelaar': MINI_BOSS_CENTS,
  'ams-mayor': BOSS_CENTS,
  'oat-huisjesmelker': BOSS_CENTS,
  // breakables and signs (€ 1,00 each)
  'ams-herring-cart': 100,
  'ams-tulip-stall': 100,
  'ams-market-stall': 100,
  'ams-bike-rack': 100,
  'oat-verkocht-sign': 100,
};

/**
 * Ids whose row applies whatever their legacy points (a pair or a groom has its own points: those
 * ids pay by the legacy rule on THEIR points, so they stay out of `EURO_BY_ID`).
 */
export function hasEuroRow(id: string): boolean {
  return Object.hasOwn(EURO_BY_ID, id);
}

/**
 * What a kill of entity `id` pays: its row, else the legacy rule on `points` (the points the kill
 * scored WITHOUT a knife multiplier: `base`); ×2 for a knife kill of a soft enemy.
 */
export function killCents(id: string, base: number, knifeSoft: boolean): Cents {
  const c = hasEuroRow(id) ? EURO_BY_ID[id] : pointsToCents(base);
  return knifeSoft ? c * KNIFE_EURO_MULTIPLIER : c;
}

/** The golden record of a 2D mission (§7.2: € 50,00). */
export const RECORD_CENTS: Cents = 5000;

/** CAUGHT NAPPING (§7.2: € 1,00). */
export const NAPPING_CENTS: Cents = 100;

// ------------------------------------------------------------------------------ first person

/** The fps treasure (§7.9: € 5–€ 50; the golden record € 50). */
export const FPS_TREASURE_CENTS: Readonly<Record<string, Cents>> = {
  'pocket-watch': 500,
  'tuning-fork': 1000,
  'gold-bars': 2000,
  'music-box': 5000,
  'golden-record': RECORD_CENTS,
};

/** An fps payer's cents: the bosses € 250, a treasure by its row, else the legacy rule (kills € 2–€ 10). */
export function fpsCents(points: number, kind: 'kill' | 'boss' | 'treasure' | 'other', id = ''): Cents {
  if (kind === 'boss') return BOSS_CENTS;
  if (kind === 'treasure') return FPS_TREASURE_CENTS[id] ?? pointsToCents(points);
  return pointsToCents(points);
}
