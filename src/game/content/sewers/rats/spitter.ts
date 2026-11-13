/**
 * `sewers-rat-spitter` (docs/design/sewers.md §3): a fat-cheeked rat on a brick plinth that spits
 * slime. 20 HP, € 4. It sits above the chest line (plinth top y 148): hit it with up or diagonal
 * aim, a jump-shot or a blast.
 *
 * - sit: faces the nearest hero; spits every 150 ticks (× the difficulty's fire interval), the
 *   first one 40 ticks after a hero is in range (240 px) and it is in view.
 * - tell 24 (`tell`): the cheeks puff up, gurgle (`sewers/spit-gurgle`), the eyes flash white.
 * - spit: a slime blob in an arc (about 44 ticks of flight) to where the hero stands at the spit;
 *   on the ground it splashes (16 px, `sewers/spit-splat`, 10 damage once) and leaves a green
 *   puddle for 120 ticks that only looks wet (no damage after the splash).
 * - hop: after every 3rd spit it hops to its other plinth (96 px away; 36 ticks, peak 28 px),
 *   harmless. Placed spitters only: one that came in by an entry sits where it landed.
 *
 * Params: `other` (the x of its second plinth; default x + 96, or x − 96 at the section's right
 * end), `hop` (false: never hops), `entry` / `enter`, `delay`, `facing`, + the Enemy params.
 * Spawn a placed spitter at (plinth centre x, `PLINTH.y`); the plinths are terrain:
 * `spitterPlinths(t, x)` (helpers.ts).
 */
import type { Entity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import { blast, FxEntity } from '../../../fx';
import type { ImpactFn } from '../../../projectile';
import { defineEntity, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { once } from '../../creatures/common';
import { SLIME_COLORS } from './art';
import { Rat } from './base';
import { PLINTH, RAT_ART, SPITTER } from './numbers';

/** A lob from (x0, y0) that lands at (tx, ty) after `ticks` ticks under gravity g: [speed, angle]. */
export function lobAim(x0: number, y0: number, tx: number, ty: number, ticks: number, g: number): [number, number] {
  const T = Math.max(12, ticks);
  const vx = (tx - x0) / T;
  const vy = (ty - y0 - 0.5 * g * T * T) / T;
  return [Math.hypot(vx, vy), Math.atan2(vy, vx)];
}

/** The blob lands: a 16-px splash (once), the splat, a puddle that only looks wet. */
const slimeImpact: ImpactFn = (p, _target, x, y) => {
  const w = p.world;
  const f = w.terrain.surfaceY(x, y - 8, y + 40);
  const fy = Number.isFinite(f) ? f : y;
  blast(w, x, fy - 4, SPITTER.splash, SPITTER.damage, 'enemy', { kind: 'impact', falloff: 0, source: p });
  w.audio.sfx('sewers/spit-splat');
  w.particles.debris(x, fy - 2, 5, SLIME_COLORS);
  FxEntity.spawn(w, { sprite: `${RAT_ART.slime}/splat`, x, y: fy, z: 25 });
  FxEntity.spawn(w, { sprite: `${RAT_ART.slime}/puddle`, x, y: fy, z: 20, loop: true, life: SPITTER.puddle });
};

export class SpitterRat extends Rat {
  private telegraph: number = SPITTER.tele;
  private cool: number = SPITTER.first;
  private spits = 0;
  /** The two plinth centres and the one it sits on (0 / 1). */
  readonly plinths: [number, number];
  private at = 0;
  private readonly hops: boolean;
  /** The hop: from, to, the plinth y. */
  private hx0 = 0;
  private hx1 = 0;
  private hy = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: RAT_ART.spitter, hp: SPITTER.hp, score: SPITTER.score, w: SPITTER.box.w, h: SPITTER.box.h });
    const b = world.terrain.bounds;
    const def = x + PLINTH.gap > b.x + b.w - 16 ? x - PLINTH.gap : x + PLINTH.gap;
    this.plinths = [x, paramNum(p, 'other', def)];
    this.hops = this.entry === '' && paramBool(p, 'hop', true) && this.plinths[1] !== x;
    // On the floor (an entry, no plinth) the 16-px box sat under the standing shot line: a runner's height.
    if (this.entry !== '') {
      this.hitbox.y -= SPITTER.floorBoxH - this.hitbox.h;
      this.hitbox.h = SPITTER.floorBoxH;
    }
  }

  protected start(): void {
    this.cool = SPITTER.first;
    this.setMode('sit');
  }

  protected thinkRat(): void {
    switch (this.mode) {
      case 'tell':
        return this.thinkTell();
      case 'spit':
        this.vx = 0;
        if (this.modeT < 14) return;
        this.releaseToken();
        this.spits++;
        this.cool = this.fireInterval(SPITTER.every);
        if (this.hops && this.spits % SPITTER.hopEvery === 0) this.startHop();
        else this.setMode('sit');
        return;
      case 'hop':
        return this.thinkHop();
      default:
        return this.thinkSit();
    }
  }

  private thinkSit(): void {
    this.vx = 0;
    this.play('idle');
    const t = this.facePlayer();
    if (!t || Math.abs(t.x - this.x) > SPITTER.range) return;
    if (this.cool > 0) {
      if (this.visible()) this.cool--;
      return;
    }
    if (!this.visible() || !this.takeToken()) return;
    this.telegraph = this.tele(SPITTER.tele);
    this.setMode('tell');
    this.play('tell', once(0, Math.max(1, Math.floor(this.telegraph / 3))));
    this.tellFlash('sewers/spit-gurgle');
  }

  private thinkTell(): void {
    this.vx = 0;
    this.facePlayer();
    if (this.modeT < this.telegraph) return;
    if (!this.visible()) {
      this.cancelAttack();
      return;
    }
    this.spit(this.target());
  }

  /** The blob: from the mouth, in an arc to the hero's feet now. */
  private spit(t: Entity | null): void {
    const m = this.point('mouth', 8, -10);
    const tx = t ? t.x : this.x + this.facing * 80;
    const f = this.world.terrain.surfaceY(tx, (t ? t.y : this.y) - 8, Infinity);
    const ty = Number.isFinite(f) ? f - 3 : (t ? t.y : this.y);
    const [s, a] = lobAim(m[0], m[1], tx, ty, SPITTER.blobTicks, SPITTER.blobGravity);
    this.shoot({
      speed: s / this.mods.enemyBulletSpeed,
      angle: a,
      damage: SPITTER.damage,
      kind: 'impact',
      sprite: `${RAT_ART.slime}/blob`,
      look: 'anim',
      gravity: SPITTER.blobGravity,
      x: m[0],
      y: m[1],
      w: 6,
      h: 6,
      life: 200,
      impact: slimeImpact,
      offscreen: 64,
    });
    this.setMode('spit');
    this.play('spit', once(0, 7));
  }

  private startHop(): void {
    this.at = 1 - this.at;
    this.hx0 = this.x;
    this.hx1 = this.plinths[this.at];
    this.hy = this.y;
    this.floating = true;
    this.facing = this.hx1 > this.x ? 1 : -1;
    this.setMode('hop');
    this.play('hop');
  }

  private thinkHop(): void {
    const s = Math.min(1, this.modeT / SPITTER.hopTicks);
    this.x = this.hx0 + (this.hx1 - this.hx0) * s;
    this.y = this.hy - 4 * SPITTER.hopPeak * s * (1 - s);
    this.vx = 0;
    this.vy = 0;
    if (s >= 1) {
      this.y = this.hy;
      this.floating = false;
      this.world.audio.sfx('sewers/rat-squeak', { vol: 0.4 });
      this.setMode('sit');
    }
  }

  protected override cancelAttack(): void {
    super.cancelAttack();
    if (this.mode === 'hop') {
      // A reaction mid-hop: it lands on the other plinth at once.
      this.x = this.hx1;
      this.y = this.hy;
      this.floating = false;
      this.setMode('sit');
    } else if (this.mode === 'tell' || this.mode === 'spit') {
      this.cool = this.fireInterval(SPITTER.every) >> 1;
      this.setMode('sit');
    }
  }
}

defineEntity('sewers-rat-spitter', (w, x, y, p) => new SpitterRat(w, x, y, p), {
  category: 'enemy',
  score: SPITTER.score,
  description: 'Spitter rat (sewers): sits on a plinth (y 148), tell 24 (cheeks puff, gurgle) → a slime lob to the hero (splash 16, puddle 120 looks only); hops between two plinths every 3rd spit.',
});
