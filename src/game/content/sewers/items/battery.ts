/**
 * `pickup-battery` (docs/design/sewers.md §5.1; owner: wave P1b C): the flashlight battery. Sewer
 * worker 1 in sewers-c drops it (`HIER, EEN BATTERIJ!`). For the hero who takes it: 1,200 ticks of
 * the long, wide cone (length 280, half-angle 28°: mission/light/cone.ts `FLASHLIGHT.battery`); a
 * second battery refreshes the time. The status carries into the next section (`carry`), and ends
 * on a death as every status does. The HUD status slot shows the battery icon with its timer bar;
 * the icon blinks in the last 120 ticks (`iconFrame`: frame 1 is the dim icon). Sound
 * `sewers/battery`. No score (it is a tool, not a treasure).
 *
 * STAND-IN art (Phase 4, grey; P5 replaces it, same ids and anchors): `item/sewers-battery` (a
 * 7 × 11 cell with a yellow band, feet anchor) and `ui/sewers-battery` (the 9 × 6 HUD icon: frame 0
 * lit, frame 1 dim). The `sewers-` segment loads both with the lazy chunk.
 */
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { BATTERY_STATUS, FLASHLIGHT } from '../../../mission/light/cone';
import { Pickup } from '../../../pickup';
import type { StatusEffectDef } from '../../../player/status';
import { defineEntity, type SpawnParams } from '../../../registry';

/** The entity id (spec §3 "New pickup"; ids.ts `SEWERS_PIECE.battery`). */
export const BATTERY_ID = 'pickup-battery';
export const BATTERY_SPRITE = 'item/sewers-battery';
export const BATTERY_ICON = 'ui/sewers-battery';
export const BATTERY_SFX = 'sewers/battery';

/** The battery's effect on its hero: the long cone for `FLASHLIGHT.battery.ticks` ticks. */
export const BATTERY_EFFECT: StatusEffectDef = {
  id: BATTERY_STATUS,
  ticks: FLASHLIGHT.battery.ticks,
  icon: BATTERY_ICON,
  carry: true,
  // The last 120 ticks: the icon blinks (8 ticks lit, 8 dim).
  iconFrame: (p, left) => (left <= FLASHLIGHT.battery.warn && Math.floor(p.world.tick / 8) % 2 === 1 ? 1 : 0),
};

export function makeBattery(world: World, x: number, y: number, p: SpawnParams): Pickup {
  return new Pickup(
    world,
    x,
    y,
    {
      sprite: BATTERY_SPRITE,
      sfx: BATTERY_SFX,
      message: 'BATTERIJ!',
      w: 10,
      h: 12,
      effect(player) {
        // A second battery refreshes the time (StatusEffects.add keeps the longer of the two).
        player.status.add(BATTERY_EFFECT, FLASHLIGHT.battery.ticks);
      },
    },
    p,
  );
}

defineEntity(BATTERY_ID, makeBattery, {
  category: 'item',
  description: 'Flashlight battery (sewers): 1,200 ticks of the long cone (280 px, 28°) for its hero; a second one refreshes it.',
});

// ---------------------------------------------------------------------------------------------
// Stand-in art
// ---------------------------------------------------------------------------------------------

function cell(): Frame {
  const w = 7;
  const h = 11;
  const b = new PixelBuffer(w, h);
  b.rect(2, 0, 3, 1, PAL.stone[2]);
  b.rect(0, 1, w, h - 1, PAL.ink[0]);
  b.rect(1, 2, w - 2, h - 3, PAL.steel[1]);
  b.rect(1, 4, w - 2, 3, PAL.gold[2]);
  b.rect(1, 2, 1, h - 3, PAL.steel[2]);
  return { buf: b, ox: Math.floor(w / 2), oy: h };
}

function icon(dim: boolean): Frame {
  const w = 9;
  const h = 6;
  const b = new PixelBuffer(w, h);
  b.rect(0, 0, w - 1, h, PAL.ink[0]);
  b.rect(w - 1, 2, 1, 2, PAL.ink[0]);
  b.rect(1, 1, w - 3, h - 2, dim ? PAL.stone[0] : PAL.gold[2]);
  if (!dim) b.rect(1, 1, 2, h - 2, PAL.gold[3]);
  return { buf: b, ox: 0, oy: 0 };
}

defineSprite(BATTERY_SPRITE, () => [cell()], { loop: false });
defineSprite(BATTERY_ICON, () => [icon(false), icon(true)], { loop: false });
