/**
 * `delivery-rider` — a food-delivery rider (docs/design/amsterdam.md §2). 10 HP, soft, 200 points.
 *
 * - A fast pass at 2.2 px/tick; he never stops.
 * - TELL 20 starts as soon as he is inside the view (8 px margin) with an attack token:
 *   `ams/bell`, bubble `TRING TRING!`. He keeps ringing until the player is in kick reach, then
 *   ATTACK 6: a kick while passing (box ahead, y −22 … −6; a jump clears it). Then he rides off.
 * - `from: 'behind'` enters from the LEFT edge of the view (behind a player heading right); the
 *   tell still plays inside the view before the kick can hit.
 * - Gag `phone` (`gag: true`): he checks his phone (`SORRY, LATE ORDER!`) and rides past
 *   without kicking, unless a player shoots near him (then he rings and kicks if he still can).
 * - Death: he falls; the cube backpack pops open and drops a food pickup (`pickup-food`,
 *   kind `cheese`; param `drop` overrides).
 *
 * Params: `from` (`behind` / `left` / `right`), `enter` / `entry`, `gag`, `facing`, `skin`
 * (`a` / `b` / `c`), + the Enemy params `hp`, `drop`, `tag`.
 */
import type { Damage } from '../../../engine/entity';
import type { World } from '../../../engine/world';
import { playerNoiseNear } from '../../enemy';
import { tumble } from '../../fx';
import { defineEntity, paramStr, type SpawnParams } from '../../registry';
import { gagParam } from '../creatures/common';
import { gagBubble, Rider } from './rider';

/** Delivery rider numbers (NORMAL). */
export const DELIVERY = {
  hp: 10,
  score: 200,
  speed: 2.2,
  tele: 20,
  kick: 6,
  /** The kick starts with the player this far ahead (or nearer, but not yet passed). */
  reach: 22,
  /** The phone gag bubble when a player is this near. */
  chat: 120,
  /** Spawn distance outside the view edge for `from: 'behind'`. */
  behind: 20,
} as const;

const SKINS = ['a', 'b', 'c'] as const;

export class DeliveryRider extends Rider {
  private told = false;
  private chatted = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const sk = paramStr(p, 'skin', '');
    const skin = sk === 'a' || sk === 'b' || sk === 'c' ? sk : SKINS[world.rng.int(0, 2)];
    super(world, x, y, p, { art: skin === 'b' ? 'enemy/delivery-rider' : `enemy/delivery-rider-${skin}`, hp: DELIVERY.hp, score: DELIVERY.score });
    if (paramStr(p, 'from', '') === 'behind') {
      this.x = this.prevX = world.camera.left - DELIVERY.behind;
      this.facing = 1;
    }
    if (!this.drop) this.drop = { id: 'pickup-food', params: { kind: 'cheese' } };
    this.alerted = true;
    const gag = gagParam(p, world, 0);
    if (gag !== null) this.startGag(gag === 'phone' ? '' : gag);
    else this.setMode('ride');
  }

  protected override think(): void {
    this.modeT++;
    this.contactDamage = null;
    if (this.bumpVehicles()) return;
    switch (this.mode) {
      case 'gag':
        return this.thinkGag();
      case 'ride':
        return this.thinkRide();
      case 'tell':
        return this.thinkTell();
      case 'kick':
        if (this.thinkKick(DELIVERY.kick, DELIVERY.speed)) {
          this.releaseToken();
          this.setMode('away');
        }
        return;
      default:
        // away (and anything else): just ride on.
        this.pedal(DELIVERY.speed);
    }
  }

  private thinkGag(): void {
    this.pedal(DELIVERY.speed, 'gag');
    const a = this.ahead();
    if (!this.chatted && Number.isFinite(a) && Math.abs(a) < DELIVERY.chat && this.onScreen(0)) {
      this.chatted = true;
      gagBubble(this.world, this, 'SORRY, LATE ORDER!', 70);
    }
    if (playerNoiseNear(this, 48)) this.setMode('ride');
  }

  private thinkRide(): void {
    this.pedal(DELIVERY.speed);
    if (this.told) return;
    const a = this.ahead();
    if (!Number.isFinite(a) || a < -4) return;
    if (this.visible() && this.takeToken()) {
      this.told = true;
      this.startTell(DELIVERY.tele, 'ams/bell', 'TRING TRING!');
    }
  }

  private thinkTell(): void {
    this.pedal(DELIVERY.speed, 'tell');
    const a = this.ahead();
    if (!Number.isFinite(a) || a < -4) {
      // Passed (the player jumped over or dodged): no kick, ride off.
      this.releaseToken();
      this.setMode('away');
      return;
    }
    if (this.modeT < this.telegraph) return;
    if (!this.visible()) return this.cancelAttack();
    if (a <= DELIVERY.reach) this.startKick();
  }

  protected override deathEffects(d: Damage): void {
    this.wreckBike();
    tumble(this.world, 'enemy/delivery-rider/food-cube', this.x - this.facing * 8, this.y - 30, -this.facing * 0.6 + d.dirX * 0.5, -2.6, { life: 40 });
  }
}

defineEntity('delivery-rider', (w, x, y, p) => new DeliveryRider(w, x, y, p), {
  category: 'enemy',
  score: DELIVERY.score,
  description: 'Food-delivery rider: fast pass (2.2), bell tell TRING TRING!, a kick while passing (jump it); from: behind; drops food (ams).',
});
