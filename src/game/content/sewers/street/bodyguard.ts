/**
 * `sewers-bodyguard` (docs/design/sewers.md §3): big, black suit, sunglasses, an earpiece; he walks
 * in and never runs. 40 HP, soft, € 8,00. The pimp's whistle calls one (`called: true`, walking in
 * from a screen edge); GOUDEN GERRIT's limo sends them too (wave A).
 *
 * - Walks toward the hero at 0.9 px/tick. Bumping into him is harmless.
 * - TELL 24 (inside the view, with an attack token, the hero ≤ 84 px ahead and level): he cracks his
 *   knuckles and plants his feet (`sewers/knuckles`).
 * - CHARGE: a shoulder charge 72 px at 2.4 px/tick (30 ticks); the charge box (shoulder and chest,
 *   y −32 … −10 above the feet) kills on contact. Dodge: back off out of the 72 px, or jump over him.
 *   A whiff into a wall knocks him back, stunned 40 ticks (dizzy stars); a whiff in the open: a
 *   recovery, then a pause.
 * - The defeat: the swoon, the sunglasses fly off, he crawls off. The gloat: a word into his earpiece.
 *
 * Params: `called`, `enter` / `entry`, `facing`, `look` (`a` bald / `b` short hair), + `hp`, `drop`,
 * `tag`. Modes: walk, tell, charge, stun, recover.
 */
import type { Damage } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { tumble } from '../../../fx';
import { defineEntity, type SpawnParams } from '../../../registry';
import { drawDizzy } from '../../creatures/common';
import { BODYGUARD, BODYGUARD_LOOKS } from './numbers';
import { StreetPerson } from './person';

export class Bodyguard extends StreetPerson {
  private readonly hit: Damage;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly none: Rect[] = [];
  private telegraph: number = BODYGUARD.tele;
  private cool: number;
  /** Where the charge started (x). */
  private chargeFrom = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { id: 'sewers-bodyguard', looks: BODYGUARD_LOOKS, hp: BODYGUARD.hp, w: 18, h: 36, score: BODYGUARD.score });
    this.hit = { amount: 10, kind: 'impact', dirX: 1, source: this };
    this.cool = world.rng.int(10, 30);
    this.setMode('walk');
    this.play('idle');
  }

  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return this.none;
    rectAt(this.x, this.y, BODYGUARD.chargeBox, this.facing < 0, this.boxes[0]);
    return this.boxes;
  }

  /** A wall (or the end of his floor) right ahead. */
  private blockedAhead(): boolean {
    return !this.floorAhead(this.facing, 12) || this.body?.contact.hitWall === true;
  }

  protected override think(): void {
    this.modeT++;
    this.contactDamage = null;
    switch (this.mode) {
      case 'walk':
        return this.thinkWalk();
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.visible()) return this.cancelAttack();
        this.chargeFrom = this.x;
        this.setMode('charge');
        this.play('charge', { restart: true });
        return;
      case 'charge':
        return this.thinkCharge();
      case 'stun':
        this.vx *= 0.85;
        if (this.modeT >= BODYGUARD.stun) this.endAttack();
        return;
      case 'recover':
        this.vx = 0;
        this.play('idle');
        if (this.modeT >= BODYGUARD.recover) this.endAttack();
        return;
      default:
        this.setMode('walk');
    }
  }

  private thinkWalk(): void {
    const t = this.facePlayer();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    const a = this.ahead();
    if (a > 20 && this.floorAhead(this.facing)) {
      this.vx = this.facing * BODYGUARD.speed;
      this.play('walk');
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (this.cool > 0) {
      this.cool--;
      return;
    }
    if (a > BODYGUARD.range || a < 0 || Math.abs(t.y - this.y) > BODYGUARD.rangeDy || !this.visible() || !this.takeToken()) return;
    this.telegraph = this.tele(BODYGUARD.tele);
    this.vx = 0;
    this.setMode('tell');
    this.play('tell', { restart: true, loop: false });
    this.world.audio.sfx('sewers/knuckles');
  }

  private thinkCharge(): void {
    if (this.blockedAhead()) {
      // A whiff into a wall: knocked back, stunned.
      this.vx = -this.facing * BODYGUARD.knock;
      this.setMode('stun');
      this.play('stun', { restart: true });
      this.world.audio.sfx('hit/metal', { vol: 0.5 });
      this.world.camera.shake(1, 6);
      return;
    }
    this.vx = this.facing * BODYGUARD.chargeSpeed;
    this.hit.dirX = this.facing;
    this.contactDamage = this.hit;
    if (Math.abs(this.x - this.chargeFrom) >= BODYGUARD.charge) {
      this.contactDamage = null;
      this.setMode('recover');
    }
  }

  private endAttack(): void {
    this.releaseToken();
    this.cool = this.fireInterval(BODYGUARD.cool);
    this.setMode('walk');
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'charge' || this.mode === 'recover' || this.mode === 'stun') {
      this.cool = 30;
      this.setMode('walk');
    }
  }

  protected override onReactionEnd(): void {
    if (this.alive && !this.fleeing) this.setMode('walk');
  }

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.alive && this.mode === 'stun') drawDizzy(r, this.x, this.y - 44, this.modeT);
  }

  protected override deathEffects(d: Damage): void {
    super.deathEffects(d);
    tumble(this.world, 'enemy/sewers-bodyguard/shades', this.x + this.facing * 3, this.y - 38, -this.facing * 0.6 + d.dirX * 0.4, -2.2, { life: 45 });
  }
}

defineEntity('sewers-bodyguard', (w, x, y, p) => new Bodyguard(w, x, y, p), {
  category: 'enemy',
  score: BODYGUARD.score,
  description: 'Bodyguard (sewers): walks 0.9, tell 24 (knuckles, plants feet) → shoulder charge 72 px at 2.4 (contact kills; jump or back off); whiff into a wall: stunned 40.',
});
