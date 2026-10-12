/**
 * Platform props (GDD §9.5): `spring-awning`, `duck-float`, `lily-pad`, `cable-car`,
 * `bellows-platform`. Each owns one dynamic solid (`SolidBox`, removed with the entity); moving
 * ones go through `world.moveSolid`, which carries riders, pushes bodies and catches them from
 * below. Spawn positions: x = the centre, y = the standing surface (the duck: the water line).
 * All are tagged 'prop' and 'platform' (moving ones also 'moving-platform', so a section's
 * respawn rule can find them). Sprites: `prop/<id>/…` (platforms.art.ts).
 */
import { Entity } from '../../../engine/entity';
import { jump, SolidBox } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { hash2 } from '../../art/paint';
import type { World } from '../../../engine/world';
import { splash } from '../../fx';
import { isPlayer } from '../../player/player';
import { NO_PARAMS, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';
import { waterSurfaceAt } from '../../water';
import { playerOn, ridersOf, sfxNear } from './common';
import { awningSprite } from './platforms.art';
import { INK, PAL } from '../../../engine/palette';

const drawOpts: DrawOpts = {};
const riders: Entity[] = [];
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// spring-awning
// ---------------------------------------------------------------------------------------------

export const SPRING_AWNING = {
  w: 48,
  /** Landing on it launches at vy −6.0 (apex ≈ 136 px for a player). */
  power: 6,
  /** Thickness of the solid (no drop-through: it is a safety net). */
  thick: 4,
  /** Ticks of the sag-and-rebound animation after a bounce. */
  sag: 14,
} as const;

/**
 * A striped shop awning (`variant: 'net'`: a Legion training net) across a pit: whatever lands on
 * it is launched at vy −6.0, so a fall bounces back up to roof height. It is a solid (not one-way)
 * strip, so down + jump never drops through it; the bounce also removes the coyote window so a
 * late jump press cannot cut it short. Params: `w` (the gap width, default 48), `variant`
 * (`awning` | `net`), `power`. y = the bounce surface.
 */
export class SpringAwning extends Entity {
  readonly w: number;
  readonly variant: 'awning' | 'net';
  readonly power: number;
  readonly box: SolidBox;
  readonly sprite: string;
  /** Ticks left of the sag animation. */
  sag = 0;
  /** Bounces so far (tests, stats). */
  bounces = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.w = Math.max(16, Math.min(640, Math.round(paramNum(params, 'w', SPRING_AWNING.w))));
    this.variant = paramStr(params, 'variant', 'awning') === 'net' ? 'net' : 'awning';
    this.power = paramNum(params, 'power', SPRING_AWNING.power);
    this.hitbox = { x: -this.w / 2, y: -6, w: this.w, h: 12 };
    this.z = 14;
    this.despawnMargin = 200;
    this.addTag('prop', 'platform');
    this.box = world.addSolid(new SolidBox(x - this.w / 2, y, this.w, SPRING_AWNING.thick, false, this));
    this.sprite = awningSprite(this.variant, this.w);
  }

  override update(): void {
    if (this.sag > 0) this.sag--;
    ridersOf(this.world, this.box, riders);
    let springy = false;
    for (let i = 0; i < riders.length; i++) {
      const e = riders[i];
      // A dead player lies where he fell; everything else bounces.
      if (isPlayer(e) && e.state !== 'play') continue;
      jump(e, -this.power);
      const b = e.body;
      if (b) b.ticksSinceGrounded = 99;
      this.bounces++;
      if (isPlayer(e) || e.hasTag('vehicle') || e.hasTag('enemy')) springy = true;
    }
    if (springy) {
      this.sag = SPRING_AWNING.sag;
      sfxNear(this.world, this.x, this.y, 'weapon/mine-bounce', 0.9, 0.55);
    }
  }

  /** Sag frame: 0 rest, 1 pressed down, 2 rebounding up. */
  get frame(): number {
    return this.sag > 9 ? 1 : this.sag > 4 ? 2 : 0;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.alpha = 1;
    r.sprite(this.sprite, this.frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// duck-float
// ---------------------------------------------------------------------------------------------

export const DUCK_FLOAT = {
  /** Drift half-range (px) and speed (px/tick). */
  drift: 32,
  speed: 0.5,
  /** Bob amplitude (px) and period (ticks). */
  bob: 3,
  period: 96,
  /** Its back (the standing surface) rides this far above the water line: 15–21 px with the bob. */
  top: 18,
  /** Half width of the standing surface. */
  half: 14,
} as const;

/**
 * A giant rubber regatta duck (32×20) floating on the water: a one-way platform on its back that
 * drifts ±`drift` px around its spawn x at 0.5 px/tick and bobs ±3 px. It snaps to the water
 * surface under its spawn point (else it floats at the spawn y). It faces where it drifts and
 * squeaks when a player lands on it. Params: `drift` (px), `speed`, `bob`, `period`, `dir`
 * (1 / −1: first drift direction).
 */
export class DuckFloat extends Entity {
  readonly box: SolidBox;
  readonly baseX: number;
  /** The water surface it floats on. */
  readonly waterline: number;
  readonly drift: number;
  readonly speed: number;
  readonly bobAmp: number;
  readonly period: number;
  /** Current drift offset from baseX and direction. */
  offset = 0;
  dir: 1 | -1;
  bob = 0;
  private t = 0;
  private ridden = false;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    const surface = waterSurfaceAt(this, x, y, 64);
    this.waterline = Number.isFinite(surface) ? surface : y;
    this.y = this.prevY = this.waterline;
    this.baseX = x;
    this.drift = Math.max(0, paramNum(params, 'drift', DUCK_FLOAT.drift));
    this.speed = Math.max(0, paramNum(params, 'speed', DUCK_FLOAT.speed));
    this.bobAmp = paramNum(params, 'bob', DUCK_FLOAT.bob);
    this.period = Math.max(8, paramNum(params, 'period', DUCK_FLOAT.period));
    const d = params.dir;
    this.dir = d === -1 || d === 'left' ? -1 : 1;
    this.facing = this.dir;
    this.hitbox = { x: -16, y: -30, w: 32, h: 32 };
    this.z = 26;
    this.despawnMargin = 200;
    this.addTag('prop', 'platform', 'moving-platform');
    this.box = world.addSolid(new SolidBox(x - DUCK_FLOAT.half, this.waterline - DUCK_FLOAT.top, DUCK_FLOAT.half * 2, 4, true, this));
  }

  /** The standing surface y right now (respawn rules). */
  get top(): number {
    return this.box.y;
  }

  override update(): void {
    this.t++;
    let nx = this.offset + this.dir * this.speed;
    if (nx > this.drift) {
      nx = this.drift;
      this.dir = -1;
    } else if (nx < -this.drift) {
      nx = -this.drift;
      this.dir = 1;
    }
    const dx = nx - this.offset;
    this.offset = nx;
    this.bob = this.bobAmp * Math.sin((this.t / this.period) * TAU);
    const ty = this.waterline - DUCK_FLOAT.top + this.bob;
    this.world.moveSolid(this.box, dx, ty - this.box.y);
    this.x = this.baseX + this.offset;
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
    const p = playerOn(this.world, this.box);
    if (p && !this.ridden) sfxNear(this.world, this.x, this.y, 'swan/squeak', 0.8);
    this.ridden = p !== null;
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flipX = this.facing < 0;
    const x = Math.round(this.x);
    const y = Math.round(this.waterline + this.bob);
    r.sprite('prop/duck-float/idle', this.ridden ? 1 : 0, x, y, drawOpts);
    // Ripples ride the water line itself (they do not bob).
    drawOpts.flipX = false;
    drawOpts.alpha = 0.8;
    r.sprite('prop/duck-float/ripple', (this.t >> 3) % 3, x, Math.round(this.waterline) + 1, drawOpts);
    drawOpts.alpha = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// lily-pad
// ---------------------------------------------------------------------------------------------

export const LILY_PAD = { w: 24 } as const;

/**
 * A lily pad (24×6) at water level: a static one-way platform. It dips 1 px and splashes a little
 * when something lands on it. y = its top (m1-c: y 178, 2 px above the river). Param `flower`
 * (true / false; default: every few pads by position).
 */
export class LilyPad extends Entity {
  readonly box: SolidBox;
  /** 0 plain, 1 with a flower, 2 curled edge. */
  readonly variant: number;
  private dip = 0;
  private ridden = false;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    const flower = params.flower;
    const h = hash2(Math.round(x), Math.round(y), 31);
    this.variant = flower === true ? 1 : flower === false ? (h < 0.5 ? 0 : 2) : h < 0.34 ? 1 : h < 0.67 ? 0 : 2;
    this.hitbox = { x: -LILY_PAD.w / 2, y: -2, w: LILY_PAD.w, h: 8 };
    this.z = 18;
    this.despawnMargin = 200;
    this.addTag('prop', 'platform');
    this.box = world.addSolid(new SolidBox(x - LILY_PAD.w / 2, y, LILY_PAD.w, 4, true, this));
  }

  override update(): void {
    if (this.dip > 0) this.dip--;
    // Cosmetic only: skip the rider scan far from the view.
    if (!this.onScreen(32)) {
      this.ridden = false;
      return;
    }
    const n = ridersOf(this.world, this.box, riders).length;
    if (n > 0 && !this.ridden) {
      this.dip = 8;
      splash(this.world, this.x, this.y + 3, 4);
    }
    this.ridden = n > 0;
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flipX = this.variant === 2 && (Math.round(this.x) & 1) === 1;
    r.sprite('prop/lily-pad/idle', this.variant, Math.round(this.x), Math.round(this.y) + (this.dip > 0 || this.ridden ? 1 : 0), drawOpts);
    drawOpts.flipX = false;
  }
}

// ---------------------------------------------------------------------------------------------
// cable-car
// ---------------------------------------------------------------------------------------------

export const CABLE_CAR = {
  w: 64,
  /** px/tick along the path. */
  speed: 0.5,
  /** The grip on the cable sits this far above the floor (a standing player fits under it). */
  hanger: 50,
  /** Default path when none is given: straight up this far. */
  rise: 96,
} as const;

/**
 * A cable-car cabin floor (64×8), a one-way platform hanging from a cable. It waits until a player
 * stands on it, rings its bell and moves along its path at 0.5 px/tick — with `hold` (default) only
 * while a player stands on it — and stays at the end (bell again). Params: `toX` / `toY` (end
 * point; default straight up 96 px) or `path` (a list of `[x, y]` or `{ x, y }` points after the
 * start, absolute), `speed`, `hold`. m3-b1: spawn (282, 1400) with `toY: 900`.
 */
export class CableCar extends Entity {
  readonly box: SolidBox;
  /** Path points (floor-top centre), flat [x0, y0, x1, y1, …]; the first is the spawn point. */
  readonly path: number[];
  readonly speed: number;
  readonly hold: boolean;
  state: 'wait' | 'move' | 'done' = 'wait';
  /** Index of the path point the car last passed. */
  seg = 0;
  /** The cable: flat points (with the hanger offset), extended past both ends. */
  private readonly cable: number[];
  private sway = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.speed = Math.max(0.05, paramNum(params, 'speed', CABLE_CAR.speed));
    this.hold = paramBool(params, 'hold', true);
    this.path = [x, y];
    const raw = params.path;
    if (Array.isArray(raw)) {
      for (const p of raw as unknown[]) {
        const px = Array.isArray(p) ? p[0] : p && typeof p === 'object' ? (p as { x?: unknown }).x : undefined;
        const py = Array.isArray(p) ? p[1] : p && typeof p === 'object' ? (p as { y?: unknown }).y : undefined;
        if (typeof px === 'number' && typeof py === 'number' && Number.isFinite(px) && Number.isFinite(py)) this.path.push(px, py);
      }
    }
    if (this.path.length < 4) this.path.push(paramNum(params, 'toX', x), paramNum(params, 'toY', y - CABLE_CAR.rise));
    this.cable = cableLine(this.path);
    this.hitbox = { x: -CABLE_CAR.w / 2, y: -CABLE_CAR.hanger - 6, w: CABLE_CAR.w, h: CABLE_CAR.hanger + 14 };
    this.z = 15;
    this.despawnMargin = 240;
    this.addTag('prop', 'platform', 'moving-platform');
    this.box = world.addSolid(new SolidBox(x - CABLE_CAR.w / 2, y, CABLE_CAR.w, 8, true, this));
  }

  /** The standing surface y right now (respawn rules). */
  get top(): number {
    return this.box.y;
  }

  override update(): void {
    if (this.sway > 0) this.sway--;
    if (this.state === 'done') return;
    const rider = playerOn(this.world, this.box);
    if (this.state === 'wait') {
      if (!rider) return;
      this.state = 'move';
      this.sway = 30;
      sfxNear(this.world, this.x, this.y, 'env/train-bell', 0.8);
    }
    if (this.hold && !rider) return;
    let left = this.speed;
    const n = this.path.length / 2;
    while (left > 1e-9 && this.seg < n - 1) {
      const tx = this.path[(this.seg + 1) * 2];
      const ty = this.path[(this.seg + 1) * 2 + 1];
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= left) {
        this.moveBy(dx, dy);
        left -= dist;
        this.seg++;
      } else {
        this.moveBy((dx / dist) * left, (dy / dist) * left);
        left = 0;
      }
    }
    if (this.seg >= n - 1) {
      this.state = 'done';
      this.sway = 30;
      sfxNear(this.world, this.x, this.y, 'env/train-bell', 0.8);
    }
  }

  private moveBy(dx: number, dy: number): void {
    this.world.moveSolid(this.box, dx, dy);
    this.x += dx;
    this.y += dy;
  }

  override draw(r: Renderer): void {
    const c = this.cable;
    for (let i = 0; i + 3 < c.length; i += 2) {
      const x0 = Math.round(c[i]);
      const y0 = Math.round(c[i + 1]);
      const x1 = Math.round(c[i + 2]);
      const y1 = Math.round(c[i + 3]);
      r.line(x0, y0, x1, y1, PAL.steel[1]);
      r.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, INK);
    }
    // A start or stop sets the cabin swinging for a moment (cosmetic, ±1 px).
    const swing = this.sway > 0 ? Math.round(Math.sin(this.sway * 0.45)) : 0;
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    r.sprite('prop/cable-car/car', 0, Math.round(this.x) + swing, Math.round(this.y), drawOpts);
  }
}

/**
 * The cable through the grip points (the path lifted by the hanger height), extended 480 px past
 * the end. A path that starts mostly vertical only shows the cable above the grip; any other
 * path also shows it 480 px back before the start.
 */
function cableLine(path: readonly number[]): number[] {
  const n = path.length / 2;
  const out: number[] = [];
  const hy = CABLE_CAR.hanger;
  const ux0 = path[2] - path[0];
  const uy0 = path[3] - path[1];
  const l0 = Math.hypot(ux0, uy0) || 1;
  const vertical = Math.abs(uy0) > Math.abs(ux0) * 2;
  if (!vertical) out.push(path[0] - (ux0 / l0) * 480, path[1] - hy - (uy0 / l0) * 480);
  for (let i = 0; i < n; i++) out.push(path[i * 2], path[i * 2 + 1] - hy);
  const ux1 = path[(n - 1) * 2] - path[(n - 2) * 2];
  const uy1 = path[(n - 1) * 2 + 1] - path[(n - 2) * 2 + 1];
  const l1 = Math.hypot(ux1, uy1) || 1;
  out.push(path[(n - 1) * 2] + (ux1 / l1) * 480, path[(n - 1) * 2 + 1] - hy + (uy1 / l1) * 480);
  return out;
}

// ---------------------------------------------------------------------------------------------
// bellows-platform
// ---------------------------------------------------------------------------------------------

export const BELLOWS = {
  w: 64,
  /** Rises and falls this far every `period` ticks. */
  rise: 24,
  period: 120,
  /** The compressed bellows (top plate, pleats, base plate). */
  h: 12,
} as const;

/**
 * Brass-and-leather organ bellows (64×12): a one-way platform that rises 24 px and falls back
 * every 120 ticks (a smooth breath). The phase follows `world.tick`, so every bellows of a
 * section breathes together, in time with a 120-bpm bar when the section music starts at its
 * first tick. y = the top at its lowest. Params: `rise`, `period`, `phase` (ticks).
 */
export class BellowsPlatform extends Entity {
  readonly box: SolidBox;
  /** The top at its lowest. */
  readonly baseY: number;
  readonly rise: number;
  readonly period: number;
  readonly phase: number;
  /** Current lift above baseY (0 … rise). */
  lift = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.baseY = y;
    this.rise = Math.max(0, paramNum(params, 'rise', BELLOWS.rise));
    this.period = Math.max(2, paramNum(params, 'period', BELLOWS.period));
    this.phase = paramNum(params, 'phase', 0);
    this.lift = this.liftAt(world.tick);
    this.hitbox = { x: -BELLOWS.w / 2, y: -this.rise, w: BELLOWS.w, h: this.rise + BELLOWS.h };
    this.z = 16;
    this.despawnMargin = 200;
    this.addTag('prop', 'platform', 'moving-platform');
    this.box = world.addSolid(new SolidBox(x - BELLOWS.w / 2, y - this.lift, BELLOWS.w, 6, true, this));
  }

  private liftAt(tick: number): number {
    return (this.rise * (1 - Math.cos(((tick + this.phase) / this.period) * TAU))) / 2;
  }

  /** The standing surface y right now (respawn rules). */
  get top(): number {
    return this.box.y;
  }

  override update(): void {
    this.lift = this.liftAt(this.world.tick + 1);
    this.world.moveSolid(this.box, 0, this.baseY - this.lift - this.box.y);
  }

  override draw(r: Renderer): void {
    // One frame per px of stretch (rise 24 → 25 frames), anchored under the base plate.
    const f = this.rise > 0 ? Math.round((this.lift / this.rise) * BELLOWS.rise) : 0;
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    r.sprite('prop/bellows-platform/body', f, Math.round(this.x), Math.round(this.baseY) + BELLOWS.h, drawOpts);
  }
}
