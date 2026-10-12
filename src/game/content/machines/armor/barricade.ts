/**
 * `drum-barricade` — a wall of drums (GDD §9.5; m4-b at 3496–3528, y 112–176: spawn it at
 * x 3512 on the floor). 32×64, a full dynamic solid (it blocks players, vehicles and shots:
 * everything that hits it hurts it), 600 HP (×difficulty, ×1.25 with 2 players), 2,000 points.
 * Not knifeable. Hits boom (`hit/drum`); the skins tear as it weakens. A Bandwagon rammed into it
 * explodes against it. Destroyed: drums tumble and roll away, the solid is gone, a low pile of
 * broken drums stays as decor.
 *
 * It holds `ctx.waitClear()` like any enemy (the m4-b row waits for the guards AND the
 * barricade); pass `holdsWave: false` to drop its 'enemy' tag. It never despawns while standing.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { FxEntity, FX_SMOKE, debris } from '../../../fx';
import { defineEntity, paramBool, type SpawnParams } from '../../../registry';
import { BARRICADE } from './geom';
import { Machine } from './machine';

/** Drum barricade numbers (GDD §9.5). */
export const DRUM_BARRICADE = {
  hp: 600,
  score: 2000,
} as const;

const ART = 'machine/drum-barricade';
const drawOpts: DrawOpts = {};

export class DrumBarricade extends Machine {
  private box: SolidBox | null = null;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: DRUM_BARRICADE.hp, w: 32, h: 64, body: false });
    const b = BARRICADE.box;
    this.hitbox = { ...b };
    this.facing = 1;
    this.hitSfx = 'hit/drum';
    this.despawnMargin = Infinity;
    if (!paramBool(p, 'holdsWave', true)) this.removeTag('enemy');
    // The wall stands from the start (World.cleanup drops it with the entity).
    this.box = world.addSolid(new SolidBox(x + b.x, y + b.y, b.w, b.h, false, this));
  }

  override update(): void {
    super.update();
    if (this.alive) this.emitDamage(this.x, this.y - 40);
  }

  /** One px wider than the solid on every side, so shots that stop at the wall still hit it. */
  override hurtboxes(): readonly Rect[] {
    const b = BARRICADE.box;
    const r = this.boxes[0];
    r.x = this.x + b.x - 1;
    r.y = this.y + b.y - 1;
    r.w = b.w + 2;
    r.h = b.h + 2;
    return this.boxes;
  }

  protected override onDeath(_d: Damage): void {
    if (this.box) {
      this.world.removeSolid(this.box);
      this.box = null;
    }
    this.despawnMargin = 96;
    this.boom(this.x, this.y - 32, 'l', 'wood');
    debris(this.world, this.x, this.y - 48, 'cloth', 6);
    this.world.audio.sfx('drum/crash');
    // Three drums tumble out and roll away like wheels.
    for (let i = 0; i < 3; i++) {
      const dir = i === 1 ? -1 : 1;
      FxEntity.spawn(this.world, {
        sprite: `${ART}/drum`,
        x: this.x + dir * 6,
        y: this.y - 50 + i * 16,
        vx: dir * (1 + i * 0.4),
        vy: -2 - i * 0.5,
        gravity: 0.18,
        loop: true,
        life: 70,
        ticksPerFrame: 3,
        z: 31,
      });
    }
  }

  protected override updateDeath(): void {
    this.deathTicks++;
    if (this.deathTicks < 180 && this.deathTicks % 10 === 0) this.world.particles.emit(FX_SMOKE, this.x + this.world.fxRng.range(-10, 10), this.y - 8, 0, -0.3);
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    if (this.dead) {
      drawOpts.flash = false;
      r.sprite(`${ART}/wreck`, 0, x, y, drawOpts);
      return;
    }
    drawOpts.flash = this.flashTicks > 0;
    r.sprite(`${ART}/body`, this.damageState, x, y, drawOpts);
  }
}

defineEntity('drum-barricade', (w, x, y, p) => new DrumBarricade(w, x, y, p), {
  category: 'prop',
  score: DRUM_BARRICADE.score,
  description: 'Drum barricade: a solid 32×64 wall of drums (600 HP) that blocks the m4-b exit.',
});
