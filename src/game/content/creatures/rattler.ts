/**
 * `rattler` — the Maraca Rattler (docs/GAME_DESIGN.md §9.3; m2). 60 HP, 600 points. Contact kills
 * only while it lunges.
 *
 * - Hides in the sand (two eyes and a twitching mound show; the low mound is hard to hit). Wakes
 *   when a player comes within 96 px, or when it is hit.
 * - Lunge: T 45 (it rises and rattles, "chk-chk", `creature/rattle`) → lunges 72 px forward in 12
 *   ticks (contact kills; it stops at walls and ledges) → R 50 (dizzy, tongue out) → burrows again
 *   for 60 ticks.
 * - Death: ties itself in a knot, rattles one last time, poof.
 *
 * Params: `enter` / `entry` (`left` / `right` = slithers in, then burrows), `facing`, plus the Enemy
 * params `hp`, `drop`, `tag`. Our choices: a risen rattler without an attack token waits coiled
 * (rattling, harmless); after burrowing it stays down at least 30 ticks.
 */
import type { Damage } from '../../../engine/entity';
import type { Rect } from '../../../engine/math';
import type { Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { dust, poof } from '../../fx';
import { defineEntity, paramFacing, type SpawnParams } from '../../registry';
import { Creature, contactHit, drawDizzy, entryParam, once } from './common';

/** Rattler numbers (GDD §9.3; NORMAL). */
export const RATTLER = {
  hp: 60,
  score: 600,
  wake: 96,
  tele: 45,
  /** First part of the telegraph: rising out of the sand. */
  rise: 9,
  lungeDist: 72,
  lungeTicks: 12,
  recover: 50,
  burrow: 60,
  slither: 1.2,
  rewake: 30,
  /** Hurtboxes (relative to the coil centre, facing right). */
  hidden: { x: -11, y: -7, w: 22, h: 7 } as Rect,
  coiled: { x: -12, y: -24, w: 24, h: 24 } as Rect,
  stretched: { x: -30, y: -12, w: 46, h: 12 } as Rect,
} as const;

const A = 'creature/rattler';
const head: [number, number] = [0, 0];

export class Rattler extends Creature {
  private telegraph: number = RATTLER.tele;
  private wakeCool = 0;
  private enterStop = 80;
  private readonly bite: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: A, hp: RATTLER.hp, w: 20, h: 8 });
    this.clampToSection();
    this.bite = contactHit(this, 'impact');
    if (this.body) this.body.stepUp = 6;
    const t = world.nearestPlayer(this.x, this.y);
    this.facing = paramFacing(p, t && t.x < this.x ? -1 : 1);
    const entry = entryParam(p);
    if (entry === 'left' || entry === 'right') {
      this.facing = entry === 'left' ? 1 : -1;
      this.enterStop = world.rng.int(48, 110);
      this.setBox(RATTLER.stretched);
      this.setMode('enter');
    } else {
      this.setBox(RATTLER.hidden);
      this.setMode('hidden');
    }
  }

  private setBox(r: Rect): void {
    this.hitbox.x = r.x;
    this.hitbox.y = r.y;
    this.hitbox.w = r.w;
    this.hitbox.h = r.h;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.wakeCool > 0) this.wakeCool--;
    this.contactDamage = null;
    switch (this.mode) {
      case 'enter':
        return this.thinkEnter();
      case 'hidden':
        this.vx = 0;
        this.setBox(RATTLER.hidden);
        this.play('hidden');
        if (this.wakeCool <= 0 && this.playerWithin(RATTLER.wake) && this.onScreen(-8)) this.wake();
        return;
      case 'coiled':
        return this.thinkCoiled();
      case 'tell':
        return this.thinkTell();
      case 'lunge':
        return this.thinkLunge();
      case 'recover':
        this.vx = 0;
        this.play('dizzy');
        if (this.modeT >= RATTLER.recover) {
          this.releaseToken();
          this.startBurrow();
        }
        return;
      case 'burrow':
        this.vx = 0;
        if (this.modeT === Math.round(RATTLER.burrow / 2)) this.setBox(RATTLER.hidden);
        if (this.modeT % 15 === 1) dust(this.world, this.x + this.world.fxRng.range(-14, 10), this.y, 2);
        if (this.modeT >= RATTLER.burrow) {
          this.setMode('hidden');
          this.wakeCool = RATTLER.rewake;
        }
        return;
    }
  }

  private thinkEnter(): void {
    this.vx = this.facing * RATTLER.slither;
    this.play('walk');
    const cam = this.world.camera;
    const inside = this.facing > 0 ? this.x - cam.left : cam.right - this.x;
    const ahead = this.world.terrain.surfaceY(this.x + this.facing * 14, this.y - 8, this.y + 12);
    if (inside >= this.enterStop || this.body?.contact.hitWall || !Number.isFinite(ahead) || this.modeT > 600) {
      this.vx = 0;
      this.startBurrow();
    }
  }

  private playerWithin(r: number): boolean {
    const t = this.target();
    return !!t && Math.abs(t.y - this.y) <= 48 && Math.hypot(t.x - this.x, t.y - this.y) <= r;
  }

  /** Out of the sand: telegraph at once with a token, else wait coiled. */
  private wake(): void {
    this.alert();
    this.facePlayer();
    this.setBox(RATTLER.coiled);
    if (this.takeToken()) this.startTell();
    else {
      this.setMode('coiled');
      this.play('rise', once());
    }
  }

  private thinkCoiled(): void {
    this.vx = 0;
    this.setBox(RATTLER.coiled);
    if (this.anim.done || !this.playing('rise')) this.play('idle');
    const t = this.target();
    if (this.modeT % 10 === 0 && t) {
      this.facePlayer();
      if (this.playerWithin(140) && this.takeToken()) return this.startTell();
    }
    // Nobody near for a while: back into the sand.
    if (this.modeT > 90 && !this.playerWithin(160)) this.startBurrow();
  }

  private startTell(): void {
    this.vx = 0;
    this.facePlayer();
    this.telegraph = this.tele(RATTLER.tele);
    this.setBox(RATTLER.coiled);
    this.setMode('tell');
    this.play('rise', once());
    this.world.audio.sfx('creature/rattle');
  }

  private thinkTell(): void {
    this.vx = 0;
    if (this.modeT === RATTLER.rise) this.play('tell');
    if (this.modeT === Math.round(this.telegraph / 2)) this.world.audio.sfx('creature/rattle');
    if (this.modeT < this.telegraph) return;
    // Rule 3: the lunge starts only with the head inside the view.
    this.point('mouth', 14, -20, head);
    if (!this.inView(head[0], head[1])) return this.cancelAttack();
    this.setBox(RATTLER.stretched);
    this.setMode('lunge');
    this.play('attack');
  }

  private thinkLunge(): void {
    const speed = RATTLER.lungeDist / RATTLER.lungeTicks;
    const ahead = this.world.terrain.surfaceY(this.x + this.facing * 18, this.y - 8, this.y + 12);
    const blocked = !Number.isFinite(ahead) || (this.body?.contact.hitWall && this.body.contact.wallDir === this.facing);
    if (this.modeT > RATTLER.lungeTicks || blocked) {
      this.vx = 0;
      this.setMode('recover');
      this.play('dizzy');
      return;
    }
    this.vx = this.facing * speed;
    this.bite.dirX = this.facing;
    this.contactDamage = this.bite;
  }

  private startBurrow(): void {
    this.setBox(RATTLER.stretched);
    this.setMode('burrow');
    this.play('burrow', once());
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.vx = 0;
    if (this.mode === 'tell' || this.mode === 'lunge') {
      this.setMode('coiled');
      this.setBox(RATTLER.coiled);
    }
  }

  /** A hit wakes a hidden or burrowing snake. */
  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.alive && (this.mode === 'hidden' || this.mode === 'burrow')) this.wake();
    return hit;
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    this.world.audio.sfx('creature/rattle', { pitch: 0.8 });
    this.corpseTicks = this.playing('die') ? 2 : d.kind === 'crush' ? 8 : 20;
  }

  override onRemove(): void {
    // The knot ends in a poof.
    if (this.dead && this.playing('die')) poof(this.world, this.x, this.y - 10);
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    if (!this.dead && this.mode === 'recover') {
      this.point('head', 12, -10, head);
      drawDizzy(r, Math.round(head[0]), Math.round(head[1]) - 6, this.modeT);
    }
  }
}

defineEntity('rattler', (w, x, y, p) => new Rattler(w, x, y, p), {
  category: 'enemy',
  score: RATTLER.score,
  description: 'Maraca Rattler: hides in the sand, rattles, lunges 72 px (m2).',
});
