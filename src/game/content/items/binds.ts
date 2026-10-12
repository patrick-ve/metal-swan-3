/**
 * Hostage binds (GDD §7.2 `params.bind`): how a hostage is held and how it gets free. Each bind
 * has its own release ("free") animation. Sprites: binds.art.ts (`item/bind/…`) and the kind
 * strips of hostage.art.ts (`tied`, `caged`, `sack`, `mast`, `dangle`, `chute`).
 *
 * | bind | frees | params |
 * |---|---|---|
 * | `chair` (default) | a touch, any player shot, blast or knife; the chair falls apart | — |
 * | `cage` | shoot the rope (10 HP): the cage drops, lands, breaks open. `rope: 0` = a cage standing on the floor: shoot its lock (10 HP) | `ropeTop` (rope anchor y; default 40 px of rope above the cage), `rope` (rope length instead) |
 * | `sack` | a touch (or the knife); it hops about blindly at 0.3 px/tick inside a 48 px band | `band` (48) |
 * | `float` | shoot both ropes (10 HP each; the knife cuts both); rides the parade float it stands on | — |
 * | `balloon` | shoot the rope (10 HP); the balloon drifts left at 0.5 px/tick; the hostage parachutes down and throws the gift up to the nearest player (a weapon becomes +10 bombs / shells for a rider) | `drift` (0.5) |
 */
import { Entity } from '../../../engine/entity';
import { Body, moveBody } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { hasSprite } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { FxEntity } from '../../fx';
import { BindTarget, type Hostage, type HostageBind } from '../../hostage';
import type { Player } from '../../player/player';
import { paramNum, type SpawnParams, type SpawnSpec } from '../../registry';
import { BALLOON_ROPE, CAGE_H, CAGE_W, DANGLE_HANDS } from './ids';

/** Default rope length above a hanging cage. */
const CAGE_ROPE = 40;
/** The sack's hop speed and band (GDD §7.2). */
const SACK_SPEED = 0.3;
const SACK_BAND = 48;
/** The balloon drifts left at this speed; the parachute sinks at this speed. */
const BALLOON_DRIFT = 0.5;
const CHUTE_SINK = 0.45;
/** Ticks after the rope is cut until the parachuting hostage throws its gift. */
const TOSS_AFTER = 24;

const fxOpts: DrawOpts = {};

/** Draw a vertical rope from y0 down to y1 at x (8-px sprite segments, 4 px wide with ink). */
export function drawRope(r: Renderer, x: number, y0: number, y1: number): void {
  const top = Math.round(y0);
  const len = Math.round(y1) - top;
  if (len <= 0) return;
  fxOpts.flipX = false;
  for (let y = 0; y < len; y += 8) {
    const seg = Math.min(8, len - y);
    r.sprite('item/bind/rope', seg - 1, Math.round(x), top + y, fxOpts);
  }
}

/** A one-shot bind effect at the hostage (the chair falling apart, the cage breaking …). */
function bindFx(h: Hostage, sprite: string, dy = 0, z = h.z - 1): void {
  if (!hasSprite(sprite)) return;
  FxEntity.spawn(h.world, { sprite, x: h.x, y: h.y + dy, flipX: h.facing < 0, z });
}

/** A loose bit of rope that drops away from a cut. */
function ropeBit(world: World, x: number, y: number): void {
  if (!hasSprite('item/bind/rope-bit')) return;
  FxEntity.spawn(world, { sprite: 'item/bind/rope-bit', x, y, vx: (world.fxRng.next() - 0.5) * 0.8, vy: -0.6, gravity: 0.12, loop: true, life: 40, z: 26 });
}

// ---------------------------------------------------------------------------------------------
// chair
// ---------------------------------------------------------------------------------------------

/** Tied to a folding chair: a touch, any player shot, blast or knife frees; the chair falls apart. */
class ChairBind implements HostageBind {
  readonly id = 'chair';
  readonly anim = 'tied';
  readonly struggle = true;
  readonly frees = { touch: true, shot: true, blast: true, knife: true };

  release(h: Hostage): void {
    bindFx(h, 'item/bind/chair-break');
  }
}

// ---------------------------------------------------------------------------------------------
// cage
// ---------------------------------------------------------------------------------------------

/**
 * A cage (20×30) hanging from a rope (10 HP). The hostage's feet = the cage floor (spawn y).
 * Cutting the rope drops the cage; it breaks open where it lands and the hostage is free.
 */
class CageBind implements HostageBind {
  readonly id = 'cage';
  readonly anim = 'caged';
  readonly struggle = true;
  readonly frees = { touch: false, shot: false, blast: false, knife: false };
  /** Rope anchor y (world); NaN = a standing cage. */
  private ropeTop: number;
  private target: BindTarget | null = null;
  private fallT = 0;

  constructor(p: SpawnParams, y: number) {
    const top = paramNum(p, 'ropeTop', NaN);
    const len = paramNum(p, 'rope', CAGE_ROPE);
    this.ropeTop = Number.isFinite(top) ? top : y - CAGE_H - len;
  }

  /** Hangs from its rope (false: stands on the floor, a locked cage). */
  get hanging(): boolean {
    return Number.isFinite(this.ropeTop);
  }

  attach(h: Hostage): void {
    const cageTop = h.y - CAGE_H;
    // No room for a rope (`rope: 0`): a standing cage with a lock to shoot.
    if (!(this.ropeTop < cageTop - 2)) this.ropeTop = NaN;
    if (this.hanging) {
      h.floating = true;
      this.target = h.world.add(new BindTarget(h, 'rope', { x: -3, y: this.ropeTop - h.y, w: 6, h: cageTop - this.ropeTop }));
    } else {
      this.target = h.world.add(new BindTarget(h, 'lock', { x: -CAGE_W / 2, y: -CAGE_H, w: CAGE_W, h: CAGE_H }));
    }
  }

  tick(h: Hostage): void {
    // A slow swing on the rope.
    if (this.hanging) h.offX = Math.round(Math.sin(h.stateT / 45) * 1.2);
  }

  partBroken(h: Hostage, part: string, slot: number): void {
    if (part === 'rope') ropeBit(h.world, h.x, h.y - CAGE_H - 4);
    h.free(slot);
  }

  release(h: Hostage): 'release' | void {
    this.target = null;
    if (!this.hanging) {
      this.breakOpen(h);
      return;
    }
    // The rope is cut: the cage drops (physics on).
    h.floating = false;
    h.offX = 0;
    h.vy = 0;
    this.fallT = 0;
    this.ropeTop = NaN;
    return 'release';
  }

  releasing(h: Hostage): void {
    this.fallT++;
    if ((h.body?.onGround && this.fallT > 1) || this.fallT > 300) {
      this.breakOpen(h);
      h.released();
    }
  }

  private breakOpen(h: Hostage): void {
    bindFx(h, 'item/bind/cage-break', 0, h.z + 1);
    h.world.audio.sfx('hit/metal');
    h.world.camera.shake(1, 6);
  }

  drawBack(h: Hostage, r: Renderer): void {
    if (h.state === 'tied' && this.hanging) drawRope(r, h.x + h.offX, this.ropeTop, h.y - CAGE_H + 1);
    else if (h.state === 'release') drawRope(r, h.x, h.y - CAGE_H - 7, h.y - CAGE_H + 1);
  }

  detach(): void {
    this.target?.remove();
    this.target = null;
  }
}

// ---------------------------------------------------------------------------------------------
// sack
// ---------------------------------------------------------------------------------------------

/** Inside a sack that hops about blindly (0.3 px/tick inside a 48 px band). A touch frees. */
class SackBind implements HostageBind {
  readonly id = 'sack';
  readonly anim = 'sack';
  readonly frees = { touch: true, shot: false, blast: false, knife: true };
  private readonly band: number;
  private dir: 1 | -1 = -1;
  private startle = 0;

  constructor(p: SpawnParams) {
    this.band = Math.max(8, paramNum(p, 'band', SACK_BAND));
  }

  attach(h: Hostage): void {
    this.dir = h.world.rng.chance(0.5) ? 1 : -1;
  }

  tick(h: Hostage): void {
    const half = this.band / 2;
    if ((this.dir > 0 && h.x >= h.homeX + half) || (this.dir < 0 && h.x <= h.homeX - half) || !h.canStep(this.dir) || h.body?.contact.hitWall) {
      this.dir = this.dir > 0 ? -1 : 1;
    }
    h.facing = this.dir;
    h.vx = h.canStep(this.dir) ? this.dir * SACK_SPEED : 0;
    // A startled jump after a blast nearby.
    if (this.startle > 0) {
      this.startle--;
      h.offY = -Math.round(Math.sin((this.startle / 12) * Math.PI) * 6);
    } else h.offY = 0;
  }

  blasted(h: Hostage): void {
    if (this.startle > 0) return;
    this.startle = 12;
    hudOf(h.world).bubble(h, 'MMF?!', { ticks: 30, kind: 'gag' });
  }

  release(h: Hostage): void {
    h.offY = 0;
    h.vx = 0;
    bindFx(h, 'item/bind/sack-off');
  }
}

// ---------------------------------------------------------------------------------------------
// float
// ---------------------------------------------------------------------------------------------

/** The mast pole of a parade float (a prop that rides the float; stays when the hostage leaves). */
export class MastPole extends Entity {
  private readonly opts: DrawOpts = {};

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.type = 'hostage-mast';
    this.team = 'neutral';
    this.z = 24;
    this.despawnMargin = 200;
    this.body = new Body({ w: 4, h: 40 });
  }

  override update(): void {
    moveBody(this, this.world.terrain, this.world);
  }

  override draw(r: Renderer): void {
    r.sprite('item/bind/mast', 0, Math.round(this.x), Math.round(this.y), this.opts);
  }

  override onHit(): boolean {
    return false;
  }

  override onCrushed(): void {}
}

/** Tied to the mast of a parade float (m4): shoot both ropes (10 HP each). */
class FloatBind implements HostageBind {
  readonly id = 'float';
  readonly anim = 'mast';
  readonly struggle = true;
  readonly frees = { touch: false, shot: false, blast: false, knife: true };
  private upper: BindTarget | null = null;
  private lower: BindTarget | null = null;
  private cutUpper = false;
  private cutLower = false;

  attach(h: Hostage): void {
    // Stand on the float deck under the feet (a dynamic solid), if there is one.
    const solids = h.world.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (s.enabled && h.x >= s.x && h.x <= s.x + s.w && s.y >= h.y - 12 && s.y <= h.y + 12) h.y = s.y;
    }
    h.world.add(new MastPole(h.world, h.x - h.facing * 4, h.y));
    this.upper = h.world.add(new BindTarget(h, 'upper', { x: -8, y: -25, w: 16, h: 5 }, 10, true));
    this.lower = h.world.add(new BindTarget(h, 'lower', { x: -8, y: -12, w: 16, h: 5 }, 10, true));
  }

  partBroken(h: Hostage, part: string, slot: number): void {
    if (part === 'upper') this.cutUpper = true;
    if (part === 'lower') this.cutLower = true;
    ropeBit(h.world, h.x, h.y + (part === 'upper' ? -22 : -9));
    h.world.audio.sfx('hostage/free', { vol: 0.5 });
    if (this.cutUpper && this.cutLower) h.free(slot);
  }

  release(): void {
    this.cutUpper = this.cutLower = true;
    this.upper?.remove();
    this.lower?.remove();
    this.upper = this.lower = null;
  }

  drawFront(h: Hostage, r: Renderer): void {
    if (h.state !== 'tied') return;
    fxOpts.flipX = h.facing < 0;
    const x = Math.round(h.x);
    if (!this.cutUpper) r.sprite('item/bind/rope-band', 0, x, Math.round(h.y) - 20, fxOpts);
    if (!this.cutLower) r.sprite('item/bind/rope-band', 1, x, Math.round(h.y) - 8, fxOpts);
  }

  detach(): void {
    this.release();
  }
}

// ---------------------------------------------------------------------------------------------
// balloon
// ---------------------------------------------------------------------------------------------

/**
 * Tied under a weather balloon drifting left (m5 shoot-em-up). Shoot the rope (10 HP): the
 * balloon flies off, the hostage parachutes down and throws the gift up to the nearest player
 * (a weapon becomes +10 bombs, i.e. +10 dive bombs for a Trumpeter rider), then sinks away.
 */
class BalloonBind implements HostageBind {
  readonly id = 'balloon';
  readonly anim = 'dangle';
  readonly releaseAnim = 'chute';
  readonly frees = { touch: false, shot: false, blast: false, knife: false };
  private readonly drift: number;
  private target: BindTarget | null = null;
  private t = 0;

  constructor(p: SpawnParams) {
    this.drift = paramNum(p, 'drift', BALLOON_DRIFT);
  }

  attach(h: Hostage): void {
    h.floating = true;
    h.facing = -1;
    this.target = h.world.add(new BindTarget(h, 'rope', { x: -3, y: DANGLE_HANDS - BALLOON_ROPE, w: 6, h: BALLOON_ROPE }));
  }

  tick(h: Hostage): void {
    h.x -= this.drift;
    h.offY = Math.round(Math.sin(h.stateT / 28) * 1.5);
  }

  partBroken(h: Hostage, _part: string, slot: number): void {
    h.free(slot);
  }

  release(h: Hostage): 'release' {
    this.target = null;
    this.t = 0;
    h.offY = 0;
    // The balloon floats away.
    if (hasSprite('item/bind/balloon')) {
      FxEntity.spawn(h.world, { sprite: 'item/bind/balloon', x: h.x, y: h.y + DANGLE_HANDS - BALLOON_ROPE, vx: -0.3, vy: -0.6, gravity: -0.03, loop: true, life: 150, z: h.z - 1 });
    }
    ropeBit(h.world, h.x, h.y + DANGLE_HANDS - 6);
    return 'release';
  }

  releasing(h: Hostage): void {
    this.t++;
    h.x -= this.drift * 0.5;
    h.y += CHUTE_SINK;
    h.offX = Math.round(Math.sin(this.t / 20) * 2);
    if (this.t === TOSS_AFTER) h.handOver({ x: h.x, y: h.y - 46 }, h.walkTarget());
    if (h.y - 60 > h.world.camera.bottom || this.t > 900) h.remove();
  }

  /** A weapon gift becomes +10 bombs for a rider (+10 dive bombs on the Trumpeter, GDD §11.5). */
  gift(_h: Hostage, spec: SpawnSpec, to: Player | null): SpawnSpec | null {
    // A rider cannot take a weapon: it becomes +10 bombs / shells, unless the ship converts
    // medallions itself (the Trumpeter: +10 dive bombs, see pickups.ts).
    if (spec.id === 'pickup-weapon' && to?.state === 'mounted') {
      const v = to.vehicle as { weaponPickup?: unknown } | null;
      if (typeof v?.weaponPickup !== 'function') return { id: 'pickup-bombs' };
    }
    return spec;
  }

  drawBack(h: Hostage, r: Renderer): void {
    if (h.state !== 'tied') return;
    const x = Math.round(h.x);
    const hands = Math.round(h.y + h.offY) + DANGLE_HANDS;
    drawRope(r, x, hands - BALLOON_ROPE, hands + 2);
    fxOpts.flipX = false;
    r.sprite('item/bind/balloon', Math.floor(h.stateT / 16) % 2, x, hands - BALLOON_ROPE, fxOpts);
  }

  detach(): void {
    this.target?.remove();
    this.target = null;
  }
}

// ---------------------------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------------------------

/** A new bind object for one hostage (unknown ids → the chair). */
export function makeBind(id: string, p: SpawnParams, y: number): HostageBind {
  switch (id) {
    case 'cage':
      return new CageBind(p, y);
    case 'sack':
      return new SackBind(p);
    case 'float':
      return new FloatBind();
    case 'balloon':
      return new BalloonBind(p);
    default:
      return new ChairBind();
  }
}
