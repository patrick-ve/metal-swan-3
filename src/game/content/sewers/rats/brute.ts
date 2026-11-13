/**
 * `sewers-rat-brute` (docs/design/sewers.md §3): a horse-sized, scarred rat. 120 HP, 0.8 px/tick,
 * € 15. Two attacks, each with an attack token:
 *
 * - the charge: tell 30 (`tell`: paws the ground, snorts steam, `sewers/brute-snort`, the eyes flash)
 *   → it charges 96 px at 3.0 px/tick (`charge`); the whole low body hurts (box 56 × 30: its back at
 *   30 px, a jump clears it). Picked with a hero 56–120 px ahead.
 * - the stomp: tell 24 (`stell`: it rears up, a higher snort, the eyes flash) → `stomp`
 *   (`sewers/brute-stomp`, a camera shake): a ground wave runs 48 px each way in 8 ticks, 6 px high
 *   (a jump clears it). Picked with a hero within 44 px.
 * - after each: `recover` 40 ticks (it shakes its head), then 50 ticks before the next tell.
 *
 * Params: `entry` / `enter` (`left`, `right`, `hole`, `drop`), `delay`, `facing`, + the Enemy params.
 */
import type { Rect } from '../../../../engine/math';
import { rectAt } from '../../../../engine/math';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { dust, steamPuff } from '../../../fx';
import { defineEntity, type SpawnParams } from '../../../registry';
import { drawDizzy, looping, once, Turner } from '../../creatures/common';
import { Rat } from './base';
import { BRUTE, RAT_ART } from './numbers';

const NO_BOXES: readonly Rect[] = [];

export class BruteRat extends Rat {
  private readonly turner: Turner;
  /** The running tell's length (difficulty-scaled; read by the tests). */
  telegraph: number = BRUTE.tele;
  private cool = 30;
  private chargeFrom = 0;
  private readonly boxes: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly one: Rect[] = [this.boxes[0]];
  /** The wave's reach now (px each way; 0 = none). */
  waveR = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: RAT_ART.brute, hp: BRUTE.hp, score: BRUTE.score, w: BRUTE.box.w, h: BRUTE.box.h });
    this.turner = new Turner(this.facing < 0 ? -1 : 1, 2, 3, 24, 16);
    if (this.body) this.body.stepUp = 6;
  }

  protected start(): void {
    this.turner.snap(this.facing < 0 ? -1 : 1);
    this.setMode('walk');
  }

  protected thinkRat(): void {
    switch (this.mode) {
      case 'tell':
        return this.thinkTell();
      case 'charge':
        return this.thinkCharge();
      case 'stell':
        return this.thinkStompTell();
      case 'stomp':
        return this.thinkStomp();
      case 'recover':
        this.vx = 0;
        this.play('idle');
        if (this.modeT >= BRUTE.recover) {
          this.releaseToken();
          this.cool = BRUTE.cool;
          this.turner.snap(this.facing < 0 ? -1 : 1);
          this.setMode('walk');
        }
        return;
      default:
        return this.thinkWalk();
    }
  }

  private thinkWalk(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    this.turner.update(t.x - this.x);
    this.facing = this.turner.facing;
    this.vx = this.turner.turning ? 0 : BRUTE.speed * this.facing;
    this.play('walk');
    if (this.cool > 0) {
      this.cool--;
      return;
    }
    if (this.turner.turning || !this.visible() || Math.abs(t.y - this.y) > 30) return;
    const a = (t.x - this.x) * this.facing;
    const d = Math.abs(t.x - this.x);
    if (d <= BRUTE.stompNear) {
      if (this.takeToken()) this.startStompTell();
    } else if (a >= BRUTE.chargeNear && a <= BRUTE.chargeFar && this.takeToken()) this.startTell();
  }

  private startTell(): void {
    this.vx = 0;
    this.telegraph = this.tele(BRUTE.tele);
    this.setMode('tell');
    this.play('tell', looping(7));
    this.tellFlash('sewers/brute-snort');
  }

  private thinkTell(): void {
    this.vx = 0;
    if (this.modeT % 10 === 1) {
      this.point('eye', 30, -20, nose);
      steamPuff(this.world, nose[0] + this.facing * 10, nose[1] + 4, this.facing * 0.4, -0.3);
      dust(this.world, this.x + this.facing * 18, this.y, 2);
    }
    if (this.modeT < this.telegraph) return;
    if (!this.visible()) return this.cancelAttack();
    this.chargeFrom = this.x;
    this.setMode('charge');
    this.play('charge', looping(3));
    this.world.audio.sfx('sewers/rat-squeak', { pitch: 0.5, vol: 0.8 });
  }

  private thinkCharge(): void {
    const blocked = this.body?.contact.hitWall && this.body.contact.wallDir === this.facing;
    if (Math.abs(this.x - this.chargeFrom) >= BRUTE.chargeDist || blocked || this.modeT > 60) {
      this.vx = 0;
      dust(this.world, this.x + this.facing * 24, this.y, 4);
      this.setMode('recover');
      return;
    }
    this.vx = BRUTE.chargeSpeed * this.facing;
    if (this.modeT % 6 === 0) dust(this.world, this.x - this.facing * 20, this.y, 2);
    this.strike.dirX = this.facing;
    this.contactDamage = this.strike;
  }

  private startStompTell(): void {
    this.vx = 0;
    this.facePlayer();
    this.turner.snap(this.facing < 0 ? -1 : 1);
    this.telegraph = this.tele(BRUTE.stompTele);
    this.setMode('stell');
    this.play('rear', looping(8));
    this.tellFlash('sewers/brute-snort');
  }

  private thinkStompTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    if (!this.visible()) return this.cancelAttack();
    this.setMode('stomp');
    this.play('stomp', once(0, 8));
    this.world.audio.sfx('sewers/brute-stomp');
    this.world.camera.shake(2, 10);
    dust(this.world, this.x, this.y, 6);
  }

  private thinkStomp(): void {
    this.vx = 0;
    if (this.modeT <= BRUTE.waveTicks) {
      this.waveR = (BRUTE.wave * this.modeT) / BRUTE.waveTicks;
      this.contactDamage = this.strike;
      if (this.modeT % 2 === 0) {
        dust(this.world, this.x - this.waveR, this.y, 1);
        dust(this.world, this.x + this.waveR, this.y, 1);
      }
      return;
    }
    this.waveR = 0;
    if (this.modeT >= 16) this.setMode('recover');
  }

  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return NO_BOXES;
    if (this.mode === 'charge') {
      rectAt(this.x, this.y, BRUTE.chargeBox, this.facing < 0, this.boxes[0]);
      return this.one;
    }
    if (this.mode === 'stomp' && this.waveR > 0) {
      // Two bands along the floor, from the feet out to the wave front, 6 px high.
      const r = this.waveR;
      const a = this.boxes[0];
      a.x = this.x - r;
      a.y = this.y - BRUTE.waveH;
      a.w = r;
      a.h = BRUTE.waveH;
      const b = this.boxes[1];
      b.x = this.x;
      b.y = this.y - BRUTE.waveH;
      b.w = r;
      b.h = BRUTE.waveH;
      return this.boxes;
    }
    return NO_BOXES;
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    this.waveR = 0;
    if (this.mode === 'tell' || this.mode === 'charge' || this.mode === 'stell' || this.mode === 'stomp') {
      this.vx = 0;
      this.setMode('recover');
    }
  }

  override draw(r: Renderer): void {
    super.draw(r);
    if (!this.dead && this.lit && this.mode === 'recover' && this.modeT < 30) {
      drawDizzy(r, Math.round(this.x + this.facing * 16), Math.round(this.y - BRUTE.box.h - 4), this.modeT);
    }
  }
}

const nose: [number, number] = [0, 0];

defineEntity('sewers-rat-brute', (w, x, y, p) => new BruteRat(w, x, y, p), {
  category: 'enemy',
  score: BRUTE.score,
  description: 'Brute rat (sewers): 120 HP, 0.8 px/tick; tell 30 (paws, snorts steam) → a 96-px charge at 3.0 (jump its back at 30 px); tell 24 (rears) → a stomp, ground wave 48 px each way (jump it).',
});
