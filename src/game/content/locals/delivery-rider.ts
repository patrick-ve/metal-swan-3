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
 * - The gloat (every player out, docs/design/ams-extras.md §1): in view (rides in from a view
 *   edge), he rings his bell (`ams/bell`) and rides one slow lap round the place he stopped (out
 *   `circle` px, back past it, home; only over his own floor and inside the view), then stops,
 *   faces the spot and checks his phone (`gloat` strip). No attacks.
 *
 * Params: `from` (`behind` / `left` / `right`), `enter` / `entry`, `gag`, `facing`, `skin`
 * (`a` / `b` / `c`), + the Enemy params `hp`, `drop`, `tag`.
 */
import type { Damage, Entity } from '../../../engine/entity';
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
  /** The gloat lap: half its length (px) and the speed. */
  circle: 22,
  circleSpeed: 1.1,
} as const;

const SKINS = ['a', 'b', 'c'] as const;

export class DeliveryRider extends Rider {
  private told = false;
  private chatted = false;
  /** The gloat lap: its three turning points (out, back past the start, home) and the next one (−1: not laid yet). */
  private readonly lap = [0, 0, 0];
  private lapI = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const sk = paramStr(p, 'skin', '');
    const skin = sk === 'a' || sk === 'b' || sk === 'c' ? sk : SKINS[world.rng.int(0, 2)];
    super(world, x, y, p, { art: skin === 'b' ? 'enemy/delivery-rider' : `enemy/delivery-rider-${skin}`, hp: DELIVERY.hp, score: DELIVERY.score });
    if (paramStr(p, 'from', '') === 'behind') {
      this.x = this.prevX = world.camera.left - DELIVERY.behind;
      this.facing = 1;
    }
    if (!this.drop) this.drop = { id: 'pickup-food', params: { kind: 'cheese' } };
    this.speaker = 'rider';
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
      gagBubble(this.world, this, 'SORRY, LATE ORDER!', 70, this.speaker);
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

  // ------------------------------------------------------------------------------- the gloat

  protected override onGloatStart(): void {
    this.lapI = -1;
  }

  /** In view, the bell and one slow lap round the place he stopped, then the phone. */
  protected override thinkGloat(spot: Entity | null, _t: number): void {
    if (this.gloatRideIn()) return;
    if (this.lapI < 0) this.layLap();
    while (this.lapI < this.lap.length) {
      const dx = this.lap[this.lapI] - this.x;
      const dir = dx >= 0 ? 1 : -1;
      // A turning point reached, or no floor / no view ahead: turn early (the next point).
      if (Math.abs(dx) <= DELIVERY.circleSpeed || !this.floorAhead(dir) || !this.inView(this.x + dir * 16, this.y - 20, -8)) {
        this.lapI++;
        continue;
      }
      this.facing = dir;
      this.pedal(DELIVERY.circleSpeed);
      return;
    }
    this.vx = 0;
    this.faceSpot(spot);
    this.play('gloat');
  }

  /** Lay the lap out from here: out along the facing (or the other way when that side is blocked). */
  private layLap(): void {
    const R = DELIVERY.circle;
    const open = (dir: number): boolean => this.floorAhead(dir) && this.inView(this.x + dir * (R + 16), this.y - 20, -8);
    const dir = open(this.facing) ? this.facing : -this.facing;
    this.lap[0] = this.x + dir * R;
    this.lap[1] = this.x - dir * R;
    this.lap[2] = this.x;
    this.lapI = 0;
    if (this.onScreen(0)) this.world.audio.sfx('ams/bell');
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
