/**
 * DE HAVERBAR's goods and their effects (docs/design/oat.md §6.2, §7.3, §7.4): the price rule, the
 * buy and the three player statuses. The shop entity (shop.ts) calls `buyGood`; the c kiosk is the
 * same entity, so both show the same prices (one source of truth: the slot's ledger).
 *
 * - **FLAT WHITE** € 4,45: status `oat-flat-white` (speed ×1.2, fire rate ×1.3, 1,200 ticks = 20 s).
 * - **MATCHA** € 5,20: `slowWorld(world, 360)` (the MATCHA-MOMENT: 6 s of every non-player entity
 *   and enemy shot on even ticks only; budget/slow.ts), the callout `MATCHA-MOMENT` and the HUD
 *   marker status `oat-matcha` (360 ticks, no effect of its own).
 * - **ZUURDESEM** € 9,00: status `oat-zuurdesem` (the "full heal" of a one-hit game: one hit
 *   absorbed with `KRUIM!`, no time limit, never stacked: not sold to a player who still has it).
 * - **INFLATIE**: the price after n buys of that item by that player in this mission is
 *   `inflated(base, n)` (+10 % per buy, to € 0,05: 4,45 → 4,90 → 5,40), n = the slot ledger's
 *   `tally(category).count` (no extra state).
 * - **GEWEIGERD** when `refused(budget, price)` (the price above the budget, or the budget ≤ € 0):
 *   the red beep `ui/cancel`; it serves again once the budget covers the price.
 * - Only in a euro play: in a point play the shop is CLOSED (`buyGood` → 'closed'; no goods drawn).
 *
 * ```ts
 * haverbarPrice(slot, 'flatWhite');                 // 445, then 490, 540 …
 * buyGood(world, player, 'matcha', x, y);           // 'bought' | 'refused' | 'have' | 'closed'
 * ```
 */
import { euroOn, inflated, pay, refused, type BudgetCategory, type Cents } from '../../../budget/index';
import { slowWorld } from '../../../budget/slow';
import { hudOf } from '../../../context';
import type { Damage } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { ParticlePreset } from '../../../../engine/particles';
import type { World } from '../../../../engine/world';
import type { Player } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { defineStatus } from '../../../registry';
import type { PlayerSlot } from '../../../session';
import { OAT_STATUS } from '../../missions/oat/ids';
import { GOOD_SPRITE } from './art';

export type GoodKey = 'flatWhite' | 'matcha' | 'zuurdesem';

export interface GoodDef {
  readonly key: GoodKey;
  /** The kassabon category (spec §7.6) and the INFLATIE counter. */
  readonly category: BudgetCategory;
  /** The start price (spec §6.2). */
  readonly base: Cents;
  readonly name: string;
  readonly sprite: string;
}

/** The three goods on the counter, left to right. */
export const HAVERBAR_GOODS: readonly GoodDef[] = [
  { key: 'flatWhite', category: 'flatWhite', base: 445, name: 'FLAT WHITE', sprite: GOOD_SPRITE.flatWhite },
  { key: 'matcha', category: 'matcha', base: 520, name: 'MATCHA', sprite: GOOD_SPRITE.matcha },
  { key: 'zuurdesem', category: 'zuurdesem', base: 900, name: 'ZUURDESEM', sprite: GOOD_SPRITE.zuurdesem },
];

const GOOD_BY_KEY: Readonly<Record<GoodKey, GoodDef>> = {
  flatWhite: HAVERBAR_GOODS[0],
  matcha: HAVERBAR_GOODS[1],
  zuurdesem: HAVERBAR_GOODS[2],
};

/** The start values of spec §6.2 (ticks). */
export const HAVERBAR = {
  flatWhiteTicks: 1200,
  flatWhiteSpeed: 1.2,
  flatWhiteFireRate: 1.3,
  matchaTicks: 360,
  /** Invulnerable ticks after the zuurdesem took a hit. */
  kruimInvuln: 60,
  /** The red beep of GEWEIGERD and the sounds of a buy. */
  refusedSfx: 'ui/cancel',
  paidSfx: 'ui/coin',
} as const;

export const MATCHA_CALLOUT = 'MATCHA-MOMENT';
export const KRUIM_POP = 'KRUIM!';

/** The good of a key. */
export function goodOf(key: GoodKey): GoodDef {
  return GOOD_BY_KEY[key];
}

/** The price of a good for a slot now (INFLATIE over this mission's buys of it). */
export function haverbarPrice(slot: PlayerSlot, key: GoodKey): Cents {
  const g = GOOD_BY_KEY[key];
  return inflated(g.base, slot.ledger.tally(g.category).count);
}

export type BuyResult = 'bought' | 'refused' | 'have' | 'closed';

/**
 * Buy a good for a player (the PIN went through): GEWEIGERD (the red beep) when the budget does
 * not cover the price; a player who still has a zuurdesem gets none ('have', nothing charged). The
 * pay pop-up rises at (x, y).
 */
export function buyGood(world: World, p: Player, key: GoodKey, x: number, y: number): BuyResult {
  if (!euroOn(world)) return 'closed';
  if (key === 'zuurdesem' && p.status.has(OAT_STATUS.zuurdesem)) return 'have';
  const g = GOOD_BY_KEY[key];
  const price = haverbarPrice(p.slot, key);
  if (refused(p.slot.cents, price)) {
    world.audio.sfx(HAVERBAR.refusedSfx);
    return 'refused';
  }
  pay(world, p.index, -price, x, y, g.category);
  world.audio.sfx(HAVERBAR.paidSfx);
  if (key === 'flatWhite') p.status.add(FLAT_WHITE);
  else if (key === 'matcha') {
    slowWorld(world, HAVERBAR.matchaTicks);
    hudOf(world).callout(MATCHA_CALLOUT);
    p.status.add(MATCHA);
  } else p.status.add(ZUURDESEM);
  return 'bought';
}

// ---------------------------------------------------------------------------------------------
// The statuses
// ---------------------------------------------------------------------------------------------

/** FLAT WHITE: faster legs and a faster trigger for 20 s (carried over a section change). */
export const FLAT_WHITE: StatusEffectDef = defineStatus({
  id: OAT_STATUS.flatWhite,
  ticks: HAVERBAR.flatWhiteTicks,
  speed: HAVERBAR.flatWhiteSpeed,
  fireRate: HAVERBAR.flatWhiteFireRate,
  icon: GOOD_SPRITE.flatWhite,
  carry: true,
});

/** MATCHA: the HUD marker of the MATCHA-MOMENT (the slow world itself is the runner's). */
export const MATCHA: StatusEffectDef = defineStatus({
  id: OAT_STATUS.matcha,
  ticks: HAVERBAR.matchaTicks,
  icon: GOOD_SPRITE.matcha,
});

/** Crumbs of the absorbed hit (cosmetic). */
const CRUMBS: ParticlePreset = {
  kind: 'rect',
  w: 1,
  h: 1,
  life: [14, 24],
  gravity: 0.12,
  drag: 0.95,
  colors: [PAL.sand[2], PAL.sand[3], PAL.brown[3]],
  ground: 'stop',
};

/** ZUURDESEM: one hit absorbed (`KRUIM!`), no time limit, never stacked; carried over a section change. */
export const ZUURDESEM: StatusEffectDef = defineStatus({
  id: OAT_STATUS.zuurdesem,
  ticks: Infinity,
  icon: GOOD_SPRITE.zuurdesem,
  hudBar: false,
  carry: true,
  onHit(p: Player, d: Damage): boolean {
    if (d.kind === 'crush') return false;
    p.status.remove(OAT_STATUS.zuurdesem);
    p.invulnTicks = Math.max(p.invulnTicks, HAVERBAR.kruimInvuln);
    const w = p.world;
    w.particles.burst(CRUMBS, p.x, p.y - 16, 10, 0.8, 2.4);
    w.audio.sfx('item/food');
    hudOf(w).bubble(p, KRUIM_POP, { kind: 'gag', ticks: 40, dy: 4, voice: false });
    return true;
  },
});
