/**
 * `sewers-dealer` (docs/design/sewers.md §3): hood up, hands in the coat. 10 HP, soft, € 5,00.
 *
 * - Steps out of a doorway or from behind cover (`lurk: true`: he waits there, looking away, until
 *   a hero is within 150 px and he is on screen, then steps out 16 ticks), or walks in from a screen
 *   edge (`enter`), or just stands where the script put him.
 * - Sidles toward the hero at 1.2 px/tick whispering `PSST. VRIEND.` (once).
 * - TELL 20 (inside the view, with an attack token, the hero ≤ 24 px ahead and level): he looks
 *   left and right and opens his coat, the knife comes out (`sewers/knife-jab`, soft), the whisper
 *   `WIL JE IETS?`.
 * - JAB: a short knife jab, the box live 6 ticks, reach 20 px ahead of the body at belly height
 *   (`DEALER.jabBox`); `sewers/knife-jab`. Then he backs off 48 px (still facing the hero) and tries
 *   again after a pause. Dodge: step back out of reach during the tell, jump, or shoot him first.
 * - Killed while lurking: CAUGHT NAPPING. The defeat: the swoon, he drops a bag of mints
 *   (`sewers-mints`, `NEP!`, € 0,50; param `drop` overrides), crawls off.
 * - The gloat: he stands and looks out for customers, left and right (`gloat`). No attacks.
 *
 * Params: `lurk`, `enter` / `entry`, `facing`, `look` (`a` / `b` / `c`), + `hp`, `drop`, `tag`.
 * Modes (traced by the tests): lurk, step, sidle, tell, jab, recover, back.
 */
import type { Damage } from '../../../../engine/entity';
import { rectAt, type Rect } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { gagBubble } from '../../../enemy';
import { defineEntity, paramBool, type SpawnParams } from '../../../registry';
import { SEWERS_VOICE, sewersSayTicks } from '../../samples/sewers';
import { DEALER, DEALER_LOOKS } from './numbers';
import { StreetPerson } from './person';

const SPEAKER = 'sewers-dealer';

export class Dealer extends StreetPerson {
  private readonly jabHit: Damage;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly none: Rect[] = [];
  private telegraph: number = DEALER.tele;
  private cool = 0;
  private psst = false;
  /** Where the back-off ends (x). */
  private backTo = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { id: 'sewers-dealer', looks: DEALER_LOOKS, hp: DEALER.hp, w: 14, h: 32, score: DEALER.score });
    this.jabHit = { amount: 10, kind: 'impact', dirX: 1, source: this };
    if (p.drop === undefined && !this.drop) this.drop = { id: 'sewers-mints' };
    this.cool = world.rng.int(0, 20);
    if (paramBool(p, 'lurk', false)) {
      this.setMode('lurk');
      this.play('lurk');
    } else {
      this.setMode('sidle');
      this.play('idle');
    }
  }

  /** Lurking counts as napping (CAUGHT NAPPING), as a gag does. */
  protected override isNapping(): boolean {
    return this.mode === 'lurk' || super.isNapping();
  }

  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return this.none;
    rectAt(this.x, this.y, DEALER.jabBox, this.facing < 0, this.boxes[0]);
    return this.boxes;
  }

  protected override think(): void {
    this.modeT++;
    this.contactDamage = null;
    if (this.cool > 0) this.cool--;
    switch (this.mode) {
      case 'lurk':
        return this.thinkLurk();
      case 'step':
        this.vx = this.facing * DEALER.stepSpeed;
        this.play('walk');
        if (this.modeT >= DEALER.step || !this.floorAhead(this.facing)) this.setMode('sidle');
        return;
      case 'sidle':
        return this.thinkSidle();
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.visible()) return this.cancelAttack();
        this.setMode('jab');
        this.play('jab', { restart: true, loop: false });
        this.world.audio.sfx('sewers/knife-jab');
        return;
      case 'jab':
        this.vx = this.floorAhead(this.facing) ? this.facing * DEALER.lunge : 0;
        if (this.modeT <= DEALER.jab) {
          this.jabHit.dirX = this.facing;
          this.contactDamage = this.jabHit;
          return;
        }
        this.setMode('recover');
        return;
      case 'recover':
        this.vx = 0;
        if (this.modeT >= DEALER.recover) {
          this.releaseToken();
          this.backTo = this.x - this.facing * DEALER.back;
          this.setMode('back');
        }
        return;
      case 'back':
        return this.thinkBack();
      default:
        this.setMode('sidle');
    }
  }

  private thinkLurk(): void {
    this.vx = 0;
    this.play('lurk');
    const t = this.target();
    if (!t || !this.onScreen(-8) || Math.abs(t.x - this.x) > DEALER.notice || Math.abs(t.y - this.y) > 60) return;
    this.facePlayer();
    this.setMode('step');
  }

  private thinkSidle(): void {
    const t = this.facePlayer();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    if (!this.psst && this.visible()) {
      this.psst = gagBubble(this.world, this, SEWERS_VOICE.dealer.psst, sewersSayTicks(SEWERS_VOICE.dealer.psst), SPEAKER);
    }
    const a = this.ahead();
    if (a > DEALER.tellAt - 2 && this.floorAhead(this.facing)) {
      this.vx = this.facing * DEALER.speed;
      this.play('walk');
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (this.cool > 0 || a > DEALER.tellAt || a < -4 || Math.abs(t.y - this.y) > DEALER.tellDy || !this.visible() || !this.takeToken()) return;
    this.telegraph = this.tele(DEALER.tele);
    this.vx = 0;
    this.setMode('tell');
    this.play('tell', { restart: true, loop: false });
    this.world.audio.sfx('sewers/knife-jab', { vol: 0.45, pitch: 1.4 });
    hudOf(this.world).bubble(this, SEWERS_VOICE.dealer.offer, { ticks: this.telegraph + 24, kind: 'gag', speaker: SPEAKER });
  }

  /** Back off 48 px from where he jabbed, still facing the hero, then a pause. */
  private thinkBack(): void {
    this.facePlayer();
    const dir = this.backTo > this.x ? 1 : -1;
    if (Math.abs(this.backTo - this.x) <= DEALER.backSpeed || !this.floorAhead(dir)) {
      this.vx = 0;
      this.cool = this.fireInterval(DEALER.cool);
      this.setMode('sidle');
      return;
    }
    this.vx = dir * DEALER.backSpeed;
    this.play('walk');
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'jab' || this.mode === 'recover') {
      this.cool = 20;
      this.setMode('sidle');
    }
  }

  protected override onReactionEnd(): void {
    if (this.alive && !this.fleeing && this.mode !== 'lurk') this.setMode('sidle');
  }
}

defineEntity('sewers-dealer', (w, x, y, p) => new Dealer(w, x, y, p), {
  category: 'enemy',
  score: DEALER.score,
  description: 'Street dealer (sewers): lurk or walk in, sidles PSST. VRIEND., tell 20 (looks round, opens coat) → knife jab reach 20, backs off 48; drops mints NEP! (€0.50).',
});
