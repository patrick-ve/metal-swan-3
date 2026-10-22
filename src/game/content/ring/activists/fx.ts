/**
 * The blockade's thrown things and what they leave on the road (wave B; docs/design/ring.md §R.6).
 * BLOODLESS: paint is bright (pink, yellow, sky blue, green), the tomato soup is ORANGE, the glue is
 * pale and glossy; never a red pool.
 *
 * - `balloonImpact(colour)`: a paint balloon bursts — a bright splat on the road (`Splat`, fades)
 *   and droplets. The balloon itself is the hit (an enemy shot, 10).
 * - `potImpact`: the glue pot cracks on the road and leaves a `GluePuddle` (tag `GLUE_PUDDLE_TAG`):
 *   a hero standing in it on the ground is glued (`glueHero`, 40 ticks; then a grace so the hero
 *   can walk out). A pot that hits a hero is just a hit (no puddle).
 * - `canImpact`: the soup can clanks and splashes an ORANGE soup puddle (`Splat`, cosmetic).
 * - `ShoutRing`: the megaphone's sound ring rolls along the ground; a hero on the ground it reaches
 *   is pushed back (`pushHero`, no damage; once per ring per hero). A jump clears it.
 *
 * Deterministic; no per-tick allocations.
 */
import type { Color } from '../../../../engine/color';
import { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { isPlayer, type Player } from '../../../player/player';
import type { ImpactFn } from '../../../projectile';
import { ACTIVIST_TUNE } from './api';
import { ACT_ART, PAINT_COLOURS, type PaintColour } from './looks';
import { glueHero, pushHero } from './status';

/** Tag of a glue puddle (the 2D bot steps over them: keyed to this tag only). */
export const GLUE_PUDDLE_TAG = 'ring-glue-puddle';

/** Tuning (NORMAL; ticks, px, px/tick). */
export const ACT_FX = {
  /** A glue puddle lasts this long (then dries in 30 ticks) and is this wide. */
  glueLife: 300,
  glueW: 26,
  /** After the glue lets go the hero has this long to walk out before it sticks again. */
  glueGrace: 50,
  /** A splat (paint / soup) stays this long, then fades out. */
  splatLife: 200,
  /** The shout ring: speed, life, height (it rolls along the ground). */
  ringSpeed: 2.2,
  ringLife: 66,
  ringH: 14,
} as const;

/** The ground's y under (x, y) (the road), else y. */
function groundAt(world: World, x: number, y: number): number {
  const g = world.terrain.surfaceY(x, y - 12, y + 40);
  return Number.isFinite(g) ? g : y;
}

const drawOpts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// Splats (paint, soup): decals on the road
// ---------------------------------------------------------------------------------------------

/** A splat on the road: `sprite` frame `frame`, fading out at the end of its life. */
export class Splat extends Entity {
  private t = 0;
  readonly sprite: string;
  readonly frame: number;
  readonly life: number;
  constructor(world: World, x: number, y: number, sprite: string, frame: number, life: number = ACT_FX.splatLife) {
    super(world, x, y);
    this.sprite = sprite;
    this.frame = frame;
    this.life = life;
    this.team = 'neutral';
    this.z = 4;
    this.hitbox = { x: -10, y: -3, w: 20, h: 4 };
    this.despawnMargin = 200;
  }

  override update(): void {
    if (++this.t >= this.life) this.remove();
  }

  override draw(r: Renderer): void {
    // The last 24 ticks: it blinks out (drying).
    const left = this.life - this.t;
    if (left < 24 && left % 4 < 2) return;
    drawOpts.flipX = false;
    drawOpts.alpha = undefined;
    r.sprite(this.sprite, this.frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

const balloonImpacts = new Map<PaintColour, ImpactFn>();

/** The impact of a paint balloon of `colour`: a bright splat (on the road or the hero), droplets. */
export function balloonImpact(colour: PaintColour): ImpactFn {
  let fn = balloonImpacts.get(colour);
  if (!fn) {
    const k = PAINT_COLOURS.indexOf(colour);
    const ramp = PAL[colour] as readonly Color[];
    const drops: readonly Color[] = [ramp[1], ramp[2], ramp[ramp.length - 1]];
    fn = (p, target, x, y) => {
      const w = p.world;
      w.audio.sfx('ring/act/splat');
      w.particles.debris(x, y - 2, 6, drops);
      const gy = groundAt(w, x, target ? target.y : y);
      w.add(new Splat(w, Math.round(x), gy, ACT_ART.splat, k));
    };
    balloonImpacts.set(colour, fn);
  }
  return fn;
}

/** The soup can: a clank and an ORANGE splash of tomato soup (never red). */
export const canImpact: ImpactFn = (p, target, x, y) => {
  const w = p.world;
  w.audio.sfx(target ? 'ring/act/can-hit' : 'ring/act/can');
  w.particles.debris(x, y - 2, 5, [PAL.orange[1], PAL.orange[2], PAL.gold[2]]);
  const gy = groundAt(w, x, target ? target.y : y);
  w.add(new Splat(w, Math.round(x), gy, ACT_ART.soup, 0));
};

/** The glue pot: cracks on the road and leaves a glue puddle (a pot on a hero is just the hit). */
export const potImpact: ImpactFn = (p, target, x, y) => {
  const w = p.world;
  w.audio.sfx('ring/act/pot');
  w.particles.debris(x, y - 2, 4, [PAL.snow[1], PAL.snow[2], PAL.sand[3]]);
  if (target) return;
  w.add(new GluePuddle(w, Math.round(x), groundAt(w, x, y)));
};

// ---------------------------------------------------------------------------------------------
// The glue puddle
// ---------------------------------------------------------------------------------------------

/** Per hero: the glue sticks again only after this tick (the grace after it let go). */
const graceUntil = new WeakMap<Entity, number>();

export class GluePuddle extends Entity {
  t = 0;
  readonly life: number;
  constructor(world: World, x: number, y: number, life: number = ACT_FX.glueLife) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 5;
    this.life = life;
    this.hitbox = { x: -ACT_FX.glueW / 2, y: -3, w: ACT_FX.glueW, h: 4 };
    this.despawnMargin = 200;
    this.addTag(GLUE_PUDDLE_TAG);
  }

  /** Still sticky (not drying)? */
  get sticky(): boolean {
    return this.t >= 6 && this.t < this.life;
  }

  /** Is a hero's feet in the puddle (on the ground)? */
  holds(p: Player): boolean {
    return p.body.onGround && Math.abs(p.y - this.y) <= 3 && Math.abs(p.x - this.x) <= ACT_FX.glueW / 2 - 2;
  }

  override update(): void {
    this.t++;
    if (this.t >= this.life + 30) {
      this.remove();
      return;
    }
    if (!this.sticky) return;
    const list = this.world.alivePlayers();
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p) || p.state !== 'play' || !this.holds(p)) continue;
      const now = this.world.tick;
      if ((graceUntil.get(p) ?? -1) > now) continue;
      glueHero(p);
      graceUntil.set(p, now + ACTIVIST_TUNE.glueTicks + ACT_FX.glueGrace);
      this.world.audio.sfx('ring/act/glue-stick');
    }
  }

  override draw(r: Renderer): void {
    // 0 spreading, 1 wet and glossy (the shine moves), 2 … drying.
    const f = this.t < 6 ? 0 : this.t >= this.life ? 3 : (this.t >> 4) % 2 === 0 ? 1 : 2;
    drawOpts.flipX = false;
    r.sprite(ACT_ART.glue, f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The shout ring
// ---------------------------------------------------------------------------------------------

export class ShoutRing extends Entity {
  t = 0;
  private readonly hit = new Set<Entity>();
  private readonly dir: 1 | -1;
  constructor(world: World, x: number, y: number, dir: 1 | -1) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 34;
    this.dir = dir;
    this.facing = dir;
    this.hitbox = { x: -5, y: -ACT_FX.ringH, w: 10, h: ACT_FX.ringH };
    this.despawnMargin = 32;
  }

  override update(): void {
    this.t++;
    this.x += this.dir * ACT_FX.ringSpeed;
    if (this.t >= ACT_FX.ringLife) {
      this.remove();
      return;
    }
    const list = this.world.alivePlayers();
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p) || p.state !== 'play' || this.hit.has(p)) continue;
      // Feet inside the ring's height (a jump clears it), the body across its front.
      if (p.y < this.y - ACT_FX.ringH || p.y > this.y + 4) continue;
      if (Math.abs(p.x - this.x) > 6 + p.body.w / 2) continue;
      this.hit.add(p);
      pushHero(p, this.dir);
      this.world.audio.sfx('ring/act/push');
    }
  }

  override draw(r: Renderer): void {
    // Three arcs that grow as it rolls; fading the last 12 ticks.
    const left = ACT_FX.ringLife - this.t;
    if (left < 12 && left % 3 === 0) return;
    drawOpts.flipX = this.dir < 0;
    r.sprite(ACT_ART.shout, (this.t >> 2) % 3, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}
