/**
 * `sewers-pimp` (docs/design/sewers.md §3): a loud suit (purple or white), gold chains, a cane, a wide
 * hat; he struts. 30 HP, soft, € 12,00.
 *
 * - Struts toward the hero (1.0 px/tick) until 120 px away, then stands; shouts `HE! MIJN STRAAT!`
 *   once when he first sees a hero.
 * - THE WHISTLE (once per pimp, his first attack; `whistle: false` turns it off): TELL 30 (two
 *   fingers in the mouth, `sewers/whistle`, `JONGENS!`), then one `sewers-bodyguard` walks in from
 *   the screen edge nearer to the pimp.
 * - THE GOLD PISTOL: TELL 24 (adjusts his hat, the cane under the arm; `enemy/aim`), then 3 shots
 *   10 ticks apart (`sewers/gold-pistol`), straight ahead at chest height (24 px above the feet): a
 *   crouch (20 px hurtbox) dodges them. Then a recovery and a pause (difficulty-scaled).
 * - Attacks only inside the view, with an attack token, the hero within 220 px and 40 px of height.
 * - The defeat: the swoon, the wide hat flies off, he crawls off. The gloat: he counts his money.
 *
 * Params: `whistle` (default true), `enter` / `entry`, `facing`, `look` (`a` purple / `b` white),
 * `hold` (px), + `hp`, `drop`, `tag`. Modes: strut, tell-whistle, whistle, tell, shoot, recover.
 */
import type { Damage } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { gagBubble, spawnOffscreen } from '../../../enemy';
import { tumble } from '../../../fx';
import { defineEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { SEWERS_VOICE, sewersSayTicks } from '../../samples/sewers';
import { PIMP, PIMP_LOOKS } from './numbers';
import { StreetPerson } from './person';

const SPEAKER = 'sewers-pimp';

export class Pimp extends StreetPerson {
  private telegraph: number = PIMP.tele;
  private cool: number;
  private readonly hold: number;
  /** The whistle is still to come (once per pimp). */
  private whistleLeft: boolean;
  private shouted = false;
  /** Shots fired in the running volley. */
  private fired = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { id: 'sewers-pimp', looks: PIMP_LOOKS, hp: PIMP.hp, w: 14, h: 32, score: PIMP.score });
    this.hold = paramNum(p, 'hold', PIMP.hold);
    this.whistleLeft = paramBool(p, 'whistle', true);
    this.cool = world.rng.int(20, 50);
    this.setMode('strut');
    this.play('idle');
  }

  /** Is the hero in reach for an attack (range, height, view, his hand in view)? */
  private canAttack(): boolean {
    const t = this.target();
    if (!t) return false;
    return Math.abs(t.x - this.x) <= PIMP.range && Math.abs(t.y - this.y) <= PIMP.rangeDy && this.visible() && this.inView(this.x + this.facing * 14, this.y - PIMP.chestY, -8);
  }

  protected override think(): void {
    this.modeT++;
    switch (this.mode) {
      case 'strut':
        return this.thinkStrut();
      case 'tell-whistle':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        this.setMode('whistle');
        this.play('whistle', { restart: true });
        this.callBodyguard();
        return;
      case 'whistle':
        this.vx = 0;
        if (this.modeT >= PIMP.whistleHold) this.endAttack(PIMP.cool / 2);
        return;
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!this.canAttack()) return this.cancelAttack();
        this.fired = 0;
        this.setMode('shoot');
        this.fire();
        return;
      case 'shoot':
        this.vx = 0;
        if (this.fired < PIMP.shots && this.modeT >= this.fired * PIMP.gap) this.fire();
        if (this.fired >= PIMP.shots && this.modeT >= (PIMP.shots - 1) * PIMP.gap + 6) this.setMode('recover');
        return;
      case 'recover':
        this.vx = 0;
        this.play('idle');
        if (this.modeT >= PIMP.recover) this.endAttack(PIMP.cool);
        return;
      default:
        this.setMode('strut');
    }
  }

  private thinkStrut(): void {
    const t = this.facePlayer();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    if (!this.shouted && this.visible() && Math.abs(t.x - this.x) <= PIMP.range) {
      this.shouted = gagBubble(this.world, this, SEWERS_VOICE.pimp.street, sewersSayTicks(SEWERS_VOICE.pimp.street), SPEAKER);
    }
    const dist = Math.abs(t.x - this.x);
    if (dist > this.hold && this.floorAhead(this.facing)) {
      this.vx = this.facing * PIMP.speed;
      this.play('walk');
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (--this.cool > 0) return;
    if (!this.canAttack() || !this.takeToken()) {
      this.cool = 10;
      return;
    }
    this.vx = 0;
    if (this.whistleLeft) {
      this.whistleLeft = false;
      this.telegraph = this.tele(PIMP.whistleTele);
      this.setMode('tell-whistle');
      this.play('tell-whistle', { restart: true, loop: false });
      this.world.audio.sfx('sewers/whistle');
      hudOf(this.world).bubble(this, SEWERS_VOICE.pimp.boys, { ticks: Math.max(this.telegraph + 20, 60), kind: 'gag', speaker: SPEAKER });
      return;
    }
    this.telegraph = this.tele(PIMP.tele);
    this.setMode('tell');
    this.play('tell', { restart: true, loop: false });
    this.world.audio.sfx('enemy/aim');
  }

  /** One gold-pistol shot straight ahead at chest height. */
  private fire(): void {
    this.fired++;
    this.play('shoot', { restart: true });
    this.world.audio.sfx('sewers/gold-pistol');
    this.shoot({
      speed: PIMP.shotSpeed,
      damage: 10,
      sprite: 'enemy/sewers-pimp/bullet',
      x: this.x + this.facing * 14,
      y: this.y - PIMP.chestY,
      w: PIMP.shotW,
      h: PIMP.shotH,
      life: PIMP.shotLife,
    });
  }

  /** The whistle: one bodyguard walks in from the screen edge nearer to the pimp. */
  private callBodyguard(): void {
    const cam = this.world.camera;
    const side = this.x - cam.left <= cam.right - this.x ? 'left' : 'right';
    spawnOffscreen(this.world, 'sewers-bodyguard', side, { params: { called: true } });
  }

  private endAttack(cool: number): void {
    this.releaseToken();
    this.cool = this.fireInterval(cool, PIMP.coolJitter);
    this.setMode('strut');
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    if (this.mode === 'tell' || this.mode === 'shoot' || this.mode === 'recover' || this.mode === 'tell-whistle' || this.mode === 'whistle') {
      this.cool = 30;
      this.setMode('strut');
    }
  }

  protected override onReactionEnd(): void {
    if (this.alive && !this.fleeing) this.setMode('strut');
  }

  protected override deathEffects(d: Damage): void {
    super.deathEffects(d);
    tumble(this.world, this.look === 'b' ? 'enemy/sewers-pimp/hat-b' : 'enemy/sewers-pimp/hat', this.x, this.y - 40, -this.facing * 0.7 + d.dirX * 0.5, -2.4, { life: 50 });
  }
}

defineEntity('sewers-pimp', (w, x, y, p) => new Pimp(w, x, y, p), {
  category: 'enemy',
  score: PIMP.score,
  description: 'Pimp (sewers): struts to 120 px, HE! MIJN STRAAT!; once: whistle tell 30 → a bodyguard walks in; gold pistol tell 24 → 3 chest shots 10 apart (crouch dodges).',
});
