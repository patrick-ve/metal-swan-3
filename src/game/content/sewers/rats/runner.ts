/**
 * `sewers-rat-runner` (docs/design/sewers.md §3): a dog-sized rat that runs along the walkway in
 * packs of 3–6. 10 HP, 2.4 px/tick, € 2.
 *
 * - run: chases the nearest hero, overshoots and turns (hysteresis: 20 px behind for 10 ticks), so
 *   a pack swirls round the heroes instead of stacking on one spot.
 * - tell 18 (`tell`): it stops and rears up, squeak (`sewers/rat-squeak`), the eyes flash white;
 *   starts only with an attack token, the target ≤ 30 px ahead and the rat in view.
 * - bite (`bite`, 8 ticks): a lunge at 2.0 px/tick; the bite box reaches 14 px past the snout, low
 *   (y −14 … −2): a jump clears it. `sewers/rat-bite`. Then `recover`: it runs on past for 26 ticks.
 *
 * Params: `entry` / `enter` (`left`, `right`, `hole`, `drop`), `delay`, `facing`, `gag` (true: it
 * sniffs about until it notices a hero), + the Enemy params `hp`, `drop`, `tag`.
 */
import type { Rect } from '../../../../engine/math';
import { rectAt } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import { defineEntity, type SpawnParams } from '../../../registry';
import { gagParam, looping, once, Turner } from '../../creatures/common';
import { Rat, type RatOpts } from './base';
import { RAT_ART, RUNNER } from './numbers';

const NO_BOXES: readonly Rect[] = [];

export class RunnerRat extends Rat {
  protected readonly turner: Turner;
  protected telegraph: number = RUNNER.tele;
  /** Run speed (the leaper runs a little slower). */
  protected runSpeed: number = RUNNER.speed;
  private stuck = 0;
  private readonly biteBoxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams, o: RatOpts = { art: RAT_ART.runner, hp: RUNNER.hp, score: RUNNER.score, w: RUNNER.box.w, h: RUNNER.box.h }) {
    super(world, x, y, p, o);
    this.turner = new Turner(this.facing < 0 ? -1 : 1, 2, 2, RUNNER.turnDist, RUNNER.turnHold);
  }

  protected start(): void {
    this.turner.snap(this.facing < 0 ? -1 : 1);
    if (this.entry === '' && gagParam(this.params, this.world, 0) !== null) {
      this.alerted = false;
      this.startGag('');
      return;
    }
    this.setMode('run');
  }

  protected thinkRat(): void {
    switch (this.mode) {
      case 'gag':
        this.vx = 0;
        this.play('idle');
        if (this.heardShout()) this.startNotice(12);
        else this.gagNotices();
        return;
      case 'notice':
        if (this.thinkNotice()) this.setMode('run');
        return;
      case 'tell':
        return this.thinkTell();
      case 'bite':
        return this.thinkBite();
      case 'recover':
        this.vx = this.runSpeed * this.facing;
        this.play('recover', looping(3));
        this.blockedTurn();
        if (this.modeT >= RUNNER.recover) {
          this.turner.snap(this.facing < 0 ? -1 : 1);
          this.setMode('run');
        }
        return;
      default:
        return this.thinkRun();
    }
  }

  protected thinkRun(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    this.turner.update(t.x - this.x);
    this.facing = this.turner.facing;
    this.vx = this.turner.turning ? this.runSpeed * 0.4 * this.facing : this.runSpeed * this.facing;
    this.play('run', looping(3));
    this.blockedTurn();
    const a = (t.x - this.x) * this.facing;
    if (a > 0 && a <= RUNNER.start && Math.abs(t.y - this.y) < 24 && !this.turner.turning && this.visible() && this.takeToken()) this.startTell();
  }

  /** Turn at walls (a closed end of the walkway). */
  private blockedTurn(): void {
    if (this.world.terrain.isSolid(this.x + this.facing * 12, this.y - 6)) {
      if (++this.stuck > 4) {
        this.facing = this.facing > 0 ? -1 : 1;
        this.turner.snap(this.facing);
        this.stuck = 0;
      }
    } else this.stuck = 0;
  }

  protected startTell(): void {
    this.vx = 0;
    this.telegraph = this.tele(RUNNER.tele);
    this.setMode('tell');
    this.play('tell', { restart: true });
    this.tellFlash('sewers/rat-squeak');
  }

  private thinkTell(): void {
    this.vx = 0;
    this.play('tell');
    if (this.modeT < this.telegraph) return;
    if (!this.visible()) return this.cancelAttack();
    this.setMode('bite');
    this.play('bite', once(0, 4));
    this.world.audio.sfx('sewers/rat-bite');
  }

  private thinkBite(): void {
    this.vx = RUNNER.biteSpeed * this.facing;
    if (this.modeT <= RUNNER.biteTicks) {
      this.strike.dirX = this.facing;
      this.contactDamage = this.strike;
      return;
    }
    this.releaseToken();
    this.setMode('recover');
  }

  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return NO_BOXES;
    if (this.mode === 'bite') {
      rectAt(this.x, this.y, RUNNER.bite, this.facing < 0, this.biteBoxes[0]);
      return this.biteBoxes;
    }
    return super.contactBoxes();
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    if (this.mode === 'tell' || this.mode === 'bite') this.setMode('recover');
  }
}

defineEntity('sewers-rat-runner', (w, x, y, p) => new RunnerRat(w, x, y, p), {
  category: 'enemy',
  score: RUNNER.score,
  description: 'Runner rat (sewers): packs, 2.4 px/tick, tell 18 (rears, squeak) → a low bite lunge (jump it); entries left/right/hole/drop; eyes only in the dark.',
});
