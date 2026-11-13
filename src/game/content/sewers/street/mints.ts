/**
 * `sewers-mints` (docs/design/sewers.md §3, card row 9 "no drug use shown"): the dealer's drop, a bag
 * of mints — the gag pickup `NEP!` ("fake!"). It pays 25 points, € 0,50 in a euro play (the legacy rule
 * ÷ 50, rounded to € 0,50: budget/euro-table.ts `pointsToCents`), and the hero who takes it says
 * `NEP!` (a gag bubble). A normal dropped item: it pops up, lands, blinks out after 720 ticks.
 */
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { Pickup } from '../../../pickup';
import { defineEntity, type SpawnParams } from '../../../registry';
import { MINTS } from './numbers';

export const NEP = 'NEP!';

export function makeMints(world: World, x: number, y: number, p: SpawnParams): Pickup {
  return new Pickup(
    world,
    x,
    y,
    {
      sprite: 'item/sewers-mints',
      score: MINTS.score,
      message: NEP,
      w: 10,
      h: 10,
      effect(player) {
        hudOf(player.world).bubble(player, NEP, { ticks: MINTS.bubble, kind: 'gag' });
      },
    },
    p,
  );
}

defineEntity('sewers-mints', makeMints, {
  category: 'item',
  description: 'A bag of mints (the sewers dealer drop): the gag pickup NEP!, 25 points (€ 0.50).',
});
