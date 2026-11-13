/**
 * `sewers-rat-leaper` (docs/design/sewers.md §3): waits in a side pipe or a grate, pounces once,
 * then runs as a runner. 10 HP, € 3.
 *
 * - lurk: only its head shows in the mouth (in the dark: its eyes); it can be shot there.
 *   `entry: 'pipe'`: the mouth of a pipe stub on the walk plane, spawn y = the mouth (sim y 150
 *   *start*, `LEAPER.pipeY`); `entry: 'grate'` (or placed without an entry): a floor grate, spawn y =
 *   the floor. It wakes when a hero is within 150 px (x) and the mouth is in view.
 * - tell 24 (`lurk-tell`): the eyes flash white, hiss (`sewers/rat-hiss`); the target is the hero's x
 *   at the tell's START (step away and it misses).
 * - jump: one arc (peak 48 px above the mouth) to that x, landing on the floor there; contact hurts
 *   while it flies. Then it runs as a runner (bites with the runner's tell) at 2.0 px/tick.
 *
 * Params: `entry` (`pipe`, `grate`; `left`, `right`, `hole`, `drop` skip the lurk and run at once),
 * `delay`, `facing`, + the Enemy params.
 */
import type { Rect } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import { defineEntity, type SpawnParams } from '../../../registry';
import { RunnerRat } from './runner';
import { LEAPER, RAT_ART } from './numbers';

export class LeaperRat extends RunnerRat {
  /** The jump: start, target x, landing y, ticks, vx, vy0. */
  private jx = 0;
  private jy = 0;
  private tx = 0;
  private ty = 0;
  private jt = 0;
  private jvx = 0;
  private jvy = 0;
  private readonly jumpBoxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  /** The arc's ticks (public for the tests). */
  jumpTicks = 0;
  /** The hero x the jump aims at (taken at the tell's start). */
  aimX = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: RAT_ART.leaper, hp: LEAPER.hp, score: LEAPER.score, w: LEAPER.box.w, h: LEAPER.box.h });
    this.runSpeed = LEAPER.speed;
  }

  /** Lurks in a pipe or a grate (placed without an entry: a grate); the other entries run at once. */
  private get lurks(): boolean {
    return this.entry === 'pipe' || this.entry === 'grate' || this.entry === '';
  }

  protected override start(): void {
    if (!this.lurks) return super.start();
    this.floating = true;
    this.setBox(this.entry === 'pipe' ? LEAPER.lurkBox : LEAPER.grateBox);
    this.setMode('lurk');
  }

  private setBox(r: Readonly<Rect>): void {
    this.hitbox.x = r.x;
    this.hitbox.y = r.y;
    this.hitbox.w = r.w;
    this.hitbox.h = r.h;
  }

  protected override thinkRat(): void {
    switch (this.mode) {
      case 'lurk':
        return this.thinkLurk();
      case 'ltell':
        return this.thinkLeapTell();
      case 'jump':
        return this.thinkJump();
      default:
        return super.thinkRat();
    }
  }

  private thinkLurk(): void {
    this.vx = 0;
    this.vy = 0;
    this.play('lurk');
    const t = this.facePlayer();
    if (!t || Math.abs(t.x - this.x) > LEAPER.wake || !this.inView(this.x, this.y - 6, -8)) return;
    if (!this.takeToken()) return;
    this.aimX = t.x;
    this.telegraph = this.tele(LEAPER.tele);
    this.setMode('ltell');
    this.play('lurk-tell', { restart: true });
    this.tellFlash('sewers/rat-hiss');
  }

  private thinkLeapTell(): void {
    this.vx = 0;
    this.vy = 0;
    if (this.modeT < this.telegraph) return;
    if (!this.inView(this.x, this.y - 6, -8)) return this.cancelAttack();
    this.startJump();
  }

  /** One arc from the mouth to the aim x: up 48 px, down to the floor at the aim. */
  private startJump(): void {
    const g = LEAPER.gravity;
    this.jx = this.x;
    this.jy = this.y;
    this.tx = this.aimX;
    const f = this.world.terrain.surfaceY(this.tx, this.y - 4, Infinity);
    this.ty = Number.isFinite(f) ? f : this.y;
    const apex = this.jy - LEAPER.peak;
    const up = Math.sqrt((2 * LEAPER.peak) / g);
    const down = Math.sqrt((2 * Math.max(1, this.ty - apex)) / g);
    this.jumpTicks = Math.max(1, Math.round(up + down));
    this.jvy = -g * up;
    this.jvx = (this.tx - this.jx) / this.jumpTicks;
    this.jt = 0;
    this.facing = this.tx >= this.x ? 1 : -1;
    this.floating = true;
    this.setBox({ x: -LEAPER.box.w / 2, y: -LEAPER.box.h + 6, w: LEAPER.box.w, h: LEAPER.box.h - 6 });
    this.setMode('jump');
    this.play('jump');
    this.world.audio.sfx('sewers/rat-squeak', { pitch: 1.2 });
  }

  private thinkJump(): void {
    this.jt++;
    const t = this.jt;
    const g = LEAPER.gravity;
    if (t >= this.jumpTicks) {
      this.x = this.tx;
      this.y = this.ty;
      this.vx = 0;
      this.vy = 0;
      this.floating = false;
      this.setBox({ x: -LEAPER.box.w / 2, y: -LEAPER.box.h, w: LEAPER.box.w, h: LEAPER.box.h });
      this.releaseToken();
      this.turner.snap(this.facing < 0 ? -1 : 1);
      this.setMode('recover');
      return;
    }
    // A set position each tick (floating: no physics); vx / vy for the sub-pixel draw only.
    this.x = this.jx + this.jvx * t;
    this.y = this.jy + this.jvy * t + 0.5 * g * t * t;
    this.vx = 0;
    this.vy = 0;
    this.strike.dirX = this.facing;
    this.contactDamage = this.strike;
  }

  override contactBoxes(): readonly Rect[] {
    if (this.contactDamage && this.mode === 'jump') {
      const r = this.hitRect(this.jumpBoxes[0]);
      this.jumpBoxes[0] = r;
      return this.jumpBoxes;
    }
    return super.contactBoxes();
  }

  protected override cancelAttack(): void {
    if (this.mode === 'ltell') {
      this.releaseToken();
      this.contactDamage = null;
      this.setMode('lurk');
      return;
    }
    if (this.mode === 'jump') {
      // A reaction mid-air: the arc ends here, it drops (physics), harmless.
      this.releaseToken();
      this.contactDamage = null;
      this.floating = false;
      this.setBox({ x: -LEAPER.box.w / 2, y: -LEAPER.box.h, w: LEAPER.box.w, h: LEAPER.box.h });
      this.setMode('recover');
      return;
    }
    super.cancelAttack();
  }
}

defineEntity('sewers-rat-leaper', (w, x, y, p) => new LeaperRat(w, x, y, p), {
  category: 'enemy',
  score: LEAPER.score,
  description: 'Leaper rat (sewers): lurks in a pipe stub (entry pipe, mouth y 150) or a grate; tell 24 (eyes flash, hiss) → one arc jump to the hero x at the tell start (peak 48); then runs as a runner.',
});
