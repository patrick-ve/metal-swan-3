/**
 * The shared base of the four rats of mission `sewers` (docs/design/sewers.md §3, §5.1).
 *
 * - **Spawn entries** (param `entry`, or `enter` from `ctx.enter`): `left` / `right` (from a screen
 *   edge, running in), `hole` (rising out of a hole whose rim is at the spawn (x, y): a grate in the
 *   paving, a rat hole in a fatberg; a hole above the floor: it rises, then drops to the floor),
 *   `drop` (falls from the spawn y onto the floor below: the trash pile), or none (placed). The
 *   leaper adds `pipe` and `grate`. Param `delay` (ticks, ≤ 600): hidden, harmless and untargetable
 *   that long before the entry starts (packs out of one hole).
 * - **The light** (§5.1): every tick the rat asks `isLit` (light-test.ts) once and keeps the answer
 *   in `lit`, read ONLY by `draw`: lit = the whole body, dark = the eyes only (`<art>/eyes` at the
 *   frame's `eye` point; it can still be shot). On every tell the eyes flash white for the tell's
 *   first `RAT.eyeFlash` ticks, lit and dark. `lit` never changes a hit, a speed, a timing or an rng
 *   draw (tests/content/sewers-cast-rats.test.ts runs the sims with it forced both ways).
 * - **Defeats** (bloodless, comedy): a squeak (`sewers/rat-flip`), the rat flips on its back, green
 *   slime chunks; a blast throws it, a crush flattens it. Dead rats draw lit and dark (the kill reads).
 * - **The gloat**: the default (stand, face the spot, the `gloat` strip: it sits up and grooms);
 *   no attacks. The cower: the `cower` strip.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import type { ReactionKind } from '../../../enemy';
import { dust } from '../../../fx';
import { paramNum, paramStr, type SpawnParams } from '../../../registry';
import { Creature, contactHit, entryParam } from '../../creatures/common';
import { isLit } from '../light-test';
import { SLIME_COLORS } from './art';
import { RAT } from './numbers';

export interface RatOpts {
  art: string;
  hp: number;
  score: number;
  w: number;
  h: number;
}

/** How a rat comes in (spawn param `entry` / `enter`). */
export type RatEntry = 'left' | 'right' | 'hole' | 'drop' | 'pipe' | 'grate' | '';

const NO_BOXES: readonly Rect[] = [];
const eyeOpts: DrawOpts = {};
const eyeAt: [number, number] = [0, 0];

export abstract class Rat extends Creature {
  /** The light test's last answer (draw only: the whole body or the eyes only). */
  lit = true;
  /** How it came in. */
  readonly entry: RatEntry;
  /** True while it moves itself (rising, waiting in a mouth, a scripted arc): no physics. */
  protected floating = false;
  /** The world tick of the last tell start (the white eye flash). */
  private flashTick = -1000;
  private readonly delay: number;
  protected readonly touch: Damage;
  /** The rat's attack (a bite, a pounce, a charge): set as `contactDamage` only while it is live. */
  protected readonly strike: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams, o: RatOpts) {
    super(world, x, y, p, { art: o.art, hp: o.hp, w: o.w, h: o.h, score: o.score });
    this.corpseTicks = 40;
    this.touch = contactHit(this, 'bullet');
    this.strike = contactHit(this, 'impact');
    const e = entryParam(p) || paramStr(p, 'entry', '');
    this.entry = e === 'left' || e === 'right' || e === 'hole' || e === 'drop' || e === 'pipe' || e === 'grate' ? e : '';
    const t = world.nearestPlayer(x, y);
    if (this.entry === 'left') this.facing = 1;
    else if (this.entry === 'right') this.facing = -1;
    else if (p.facing === 1 || p.facing === 'right') this.facing = 1;
    else if (p.facing === -1 || p.facing === 'left') this.facing = -1;
    else this.facing = t && t.x < x ? -1 : 1;
    this.delay = Math.max(0, Math.min(RAT.maxDelay, Math.round(paramNum(p, 'delay', 0))));
    this.alerted = true;
    // Every entry starts hidden for one tick (or `delay` ticks): the subclass's fields are ready then.
    this.floating = this.entry === 'hole' || this.entry === 'pipe' || this.entry === 'drop';
    this.setMode('wait');
  }

  // ------------------------------------------------------------------------------- the tick

  override update(): void {
    super.update();
    if (this.removed) return;
    // The light: read once per tick, kept for draw only.
    this.lit = isLit(this.world, this.x, this.y + this.hitbox.y / 2);
  }

  protected override think(): void {
    this.modeT++;
    this.contactDamage = null;
    this.touch.dirX = this.facing;
    if (this.mode !== 'wait' && this.breakOnVehicle(this.touch)) return;
    switch (this.mode) {
      case 'wait':
        this.vx = 0;
        if (this.modeT > this.delay) this.beginEntry();
        return;
      case 'rise':
        return this.thinkRise();
      case 'fall':
        return this.thinkFall();
      default:
        return this.thinkRat();
    }
  }

  /** The rat's own behaviour (every mode but wait, rise and fall). */
  protected abstract thinkRat(): void;

  /** The first mode after the entry (subclass). */
  protected abstract start(): void;

  private beginEntry(): void {
    if (this.entry === 'hole') {
      this.floating = true;
      this.setMode('rise');
      this.play('rise', { restart: true, loop: false, ticksPerFrame: Math.max(1, Math.round(RAT.rise / 4)) });
      this.world.audio.sfx('sewers/rat-squeak', { vol: 0.6 });
      return;
    }
    if (this.entry === 'drop') {
      this.floating = false;
      this.setMode('fall');
      this.play('fall');
      return;
    }
    this.start();
  }

  private thinkRise(): void {
    this.vx = 0;
    if (this.modeT < RAT.rise) return;
    this.floating = false;
    const f = this.world.terrain.surfaceY(this.x, this.y - 2, this.y + 2);
    if (Number.isFinite(f)) {
      this.y = this.prevY = f;
      this.start();
    } else {
      // A hole above the floor (a fatberg's rat hole): out with a little hop, then down.
      this.vy = -1.2;
      this.vx = this.facing * 0.6;
      this.setMode('fall');
      this.play('fall');
    }
  }

  private thinkFall(): void {
    this.play('fall');
    if (this.modeT > 1 && this.body?.onGround) {
      this.vx = 0;
      dust(this.world, this.x, this.y, 3);
      this.world.audio.sfx('sewers/rat-squeak', { vol: 0.5 });
      this.start();
    }
    if (this.modeT > 600) this.start();
  }

  protected override physics() {
    return this.floating ? null : super.physics();
  }

  /** Hidden while it waits: nothing to shoot. */
  override hurtboxes(): readonly Rect[] {
    return this.mode === 'wait' ? NO_BOXES : super.hurtboxes();
  }

  /** A hidden rat takes no reaction (it is not there yet). */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    return this.mode !== 'wait' && super.acceptsReaction(kind);
  }

  // ------------------------------------------------------------------------------- tells

  /** Start a tell: the eyes flash white for its first ticks (lit and dark), the sound. */
  protected tellFlash(sfx: string): void {
    // The world tick counts on after this update: the flash covers the next RAT.eyeFlash drawn frames.
    this.flashTick = this.world.tick + 1;
    this.world.audio.sfx(sfx);
  }

  /** Are the eyes flashing white now (the first `RAT.eyeFlash` ticks of a tell)? */
  flashing(): boolean {
    return !this.dead && this.world.tick - this.flashTick < RAT.eyeFlash;
  }

  /** Is the rat (its body) inside the view, 8 px in (rule 3)? */
  protected visible(): boolean {
    return this.inView(this.x, this.y + this.hitbox.y / 2, -8);
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    this.floating = false;
    super.onDeath(d);
  }

  protected override deathEffects(d: Damage): void {
    this.world.audio.sfx('sewers/rat-flip');
    this.world.particles.debris(this.x, this.y + this.hitbox.y / 2, RAT.slime, SLIME_COLORS);
    if (d.kind !== 'explosion' && this.body) this.vy = -1.4;
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.mode === 'wait' || this.removed) return;
    const flash = this.flashing();
    if (this.dead || this.lit) {
      super.draw(r);
      if (flash) this.drawEyes(r, 1);
      return;
    }
    this.drawEyes(r, flash ? 1 : 0);
  }

  /** The eye pair at the current frame's `eye` point (frame 0 red, 1 white). */
  protected drawEyes(r: Renderer, frame: number): void {
    if (!this.anim.id) return;
    this.point('eye', 6, -8, eyeAt);
    eyeOpts.flipX = this.facing < 0;
    r.sprite(this.spriteId('eyes'), frame, Math.round(eyeAt[0]), Math.round(eyeAt[1]), eyeOpts);
  }
}
