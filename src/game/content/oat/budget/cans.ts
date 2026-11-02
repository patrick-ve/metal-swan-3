/**
 * The statiegeld pickups of mission oat (docs/design/oat.md §6.1, §7.2): `oat-can` (+€ 0,15),
 * `oat-bottle-s` (+€ 0,15), `oat-bottle-l` (+€ 0,25). A bin spills them (bin.ts); they bounce and
 * settle, blink from 120 ticks before the end and vanish after 720 (the dropped-pickup rule,
 * pickup.ts `ITEM_RULES`). Collected, they pay the player in category 'deposit' through the one pay
 * path (`pay`; the pop-ups of 30 ticks merge to `+€0,45`); NO points (never `awardScore`). In a
 * point play they pay nothing (`pay` only acts in a euro play).
 *
 * At most `DEPOSIT_CAP` (24) of them are alive in a world: a new one removes the oldest. The list
 * is per world and only changes when one spawns (no per-tick work beyond the Pickup's own).
 *
 * ```ts
 * spawnDeposit(world, 'oat-can', x, y, vx, vy);    // a can flying out of a bin
 * collectDeposit(can, player);                      // what a touch does (tests, scripts)
 * ```
 */
import type { Cents } from '../../../budget/index';
import { pay } from '../../../budget/index';
import type { World } from '../../../../engine/world';
import { ITEM_RULES, Pickup, type PickupSpec } from '../../../pickup';
import type { Player } from '../../../player/player';
import { defineEntity, NO_PARAMS, type SpawnParams } from '../../../registry';
import { OAT_PIECE } from '../../missions/oat/ids';
import { DEPOSIT_SPRITE } from './art';

/** The deposit pickup ids (spec §6.1). */
export type DepositId = typeof OAT_PIECE.can | typeof OAT_PIECE.bottleS | typeof OAT_PIECE.bottleL;
export const DEPOSIT_IDS: readonly DepositId[] = [OAT_PIECE.can, OAT_PIECE.bottleS, OAT_PIECE.bottleL];

/** Their deposit in cents (spec §7.2: € 0,15 / € 0,15 / € 0,25). */
export const DEPOSIT_CENTS: Readonly<Record<DepositId, Cents>> = {
  [OAT_PIECE.can]: 15,
  [OAT_PIECE.bottleS]: 15,
  [OAT_PIECE.bottleL]: 25,
};

/** At most this many deposit pickups alive in a world (spec §6.1: the oldest goes). */
export const DEPOSIT_CAP = 24;

const SPRITE: Readonly<Record<DepositId, string>> = {
  [OAT_PIECE.can]: DEPOSIT_SPRITE.can,
  [OAT_PIECE.bottleS]: DEPOSIT_SPRITE.bottleS,
  [OAT_PIECE.bottleL]: DEPOSIT_SPRITE.bottleL,
};
/** The clink of each (a can rings higher, a big bottle lower). */
const PITCH: Readonly<Record<DepositId, number>> = {
  [OAT_PIECE.can]: 1.3,
  [OAT_PIECE.bottleS]: 1,
  [OAT_PIECE.bottleL]: 0.8,
};

function specOf(id: DepositId): PickupSpec {
  const cents = DEPOSIT_CENTS[id];
  return {
    sprite: SPRITE[id],
    effect: (p, item) => {
      pay(p.world, p.index, cents, item.x, item.y - 12, 'deposit');
    },
    sfx: 'ams/clink',
    sfxPitch: PITCH[id],
    lifetime: ITEM_RULES.dropLifetime,
    bounce: 0.45,
    bob: 0,
    w: 8,
    h: 8,
  };
}

const SPECS: Readonly<Record<DepositId, PickupSpec>> = {
  [OAT_PIECE.can]: specOf(OAT_PIECE.can),
  [OAT_PIECE.bottleS]: specOf(OAT_PIECE.bottleS),
  [OAT_PIECE.bottleL]: specOf(OAT_PIECE.bottleL),
};

/** A can or a bottle on the street (a Pickup that pays its deposit). */
export class OatDeposit extends Pickup {
  readonly kind: DepositId;
  readonly cents: Cents;

  constructor(world: World, x: number, y: number, kind: DepositId, params: SpawnParams = NO_PARAMS) {
    super(world, x, y, SPECS[kind], params);
    this.kind = kind;
    this.cents = DEPOSIT_CENTS[kind];
    this.addTag('oat-deposit');
  }
}

// ---------------------------------------------------------------------------------------------
// The cap (per world; changes only when one spawns)
// ---------------------------------------------------------------------------------------------

const alive = new WeakMap<World, OatDeposit[]>();

function listOf(world: World): OatDeposit[] {
  let l = alive.get(world);
  if (!l) {
    l = [];
    alive.set(world, l);
  }
  return l;
}

/** Drop the gone ones (picked up, vanished) in place, oldest first kept. */
function prune(l: OatDeposit[]): void {
  let n = 0;
  for (let i = 0; i < l.length; i++) if (!l[i].removed) l[n++] = l[i];
  l.length = n;
}

/** Deposit pickups alive in this world (tests, the bot). */
export function depositsAlive(world: World): number {
  const l = alive.get(world);
  if (!l) return 0;
  prune(l);
  return l.length;
}

/** Keep the cap: count a new deposit pickup, removing the oldest above `DEPOSIT_CAP`. */
function track(world: World, e: OatDeposit): void {
  const l = listOf(world);
  prune(l);
  while (l.length >= DEPOSIT_CAP) {
    const old = l.shift();
    old?.remove();
  }
  l.push(e);
}

/**
 * Spawn a deposit pickup at (x, y) flying with (vx, vy) (the cap applies). Returns it (null if the
 * id is unknown).
 */
export function spawnDeposit(world: World, id: DepositId, x: number, y: number, vx = 0, vy: number = ITEM_RULES.popVy): OatDeposit | null {
  const e = world.spawn(id, x, y);
  if (!(e instanceof OatDeposit)) return null;
  e.vx = vx;
  e.vy = vy;
  return e;
}

/** Collect a deposit pickup for a player (what a touch does). */
export function collectDeposit(e: OatDeposit, p: Player): boolean {
  return e.collect(p);
}

for (const id of DEPOSIT_IDS) {
  defineEntity(
    id,
    (w, x, y, p) => {
      const e = new OatDeposit(w, x, y, id, p);
      track(w, e);
      return e;
    },
    { category: 'item', description: `oat statiegeld pickup (+${DEPOSIT_CENTS[id]} cents, category deposit; no points).` },
  );
}
