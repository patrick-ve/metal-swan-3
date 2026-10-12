/**
 * Breakable props (GDD §9.5, §4.13, §14.3): `helium-tank`, `statue-head`, `breakable-wall`,
 * `rolling-drum`, `icicle`. All are on team 'enemy' (player shots and blasts hit them) and tagged
 * 'prop', never 'enemy', so they never hold a wave or count as kills. Sprites: `prop/<id>/…`
 * (breakables.art.ts, wall.art.ts).
 */
import type { Damage } from '../../../engine/entity';
import { Entity } from '../../../engine/entity';
import { overlaps, type Rect } from '../../../engine/math';
import { PAL } from '../../../engine/palette';
import type { ParticlePreset } from '../../../engine/particles';
import { Body, jump, moveBody, SolidBox } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { Animator, hasSprite } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { awardScore } from '../../events';
import { debris, dust, FxEntity, type DebrisKind, type FxOpts } from '../../fx';
import type { StatusEffectDef } from '../../player/status';
import { getStatus, NO_PARAMS, paramBool, paramNum, paramStr, toSpawnSpec, type SpawnParams } from '../../registry';
import { crushHit, isFootPlayer, setPiece, sfxNear } from './common';
import { wallSprites, type WallLook, WALL_LOOKS } from './wall.art';

const drawOpts: DrawOpts = {};
const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
const fxOpts: FxOpts = { sprite: '', x: 0, y: 0 };

// ---------------------------------------------------------------------------------------------
// helium-tank (GDD §4.13, §9.5)
// ---------------------------------------------------------------------------------------------

export const HELIUM_TANK = {
  hp: 10,
  score: 100,
  /** The helium cloud: 48×48 around the tank's middle, 120 ticks. */
  cloud: 48,
  cloudTicks: 120,
  /** The cloud fades out over its last ticks. */
  fadeTicks: 30,
  /** Status applied to a player who touches the cloud (defined by the characters module). */
  status: 'helium-head',
} as const;

/** Pastel helium puffs when the tank bursts (cosmetic). */
const HELIUM_PUFF: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 3,
  life: [24, 44],
  drag: 0.9,
  gravity: -0.02,
  colors: [PAL.pink[2], PAL.snow[2], PAL.pink[2]],
  fadeFrom: 0.4,
};

/**
 * A pink-and-white striped gas cylinder (20×28) with a party balloon tied to its valve.
 * 10 HP; shot, knifed ('soft') or blasted, it bursts (100 points) into a pastel helium cloud
 * (48×48, 120 ticks). Every player on foot who touches the cloud gets the `helium-head` status
 * (again = the timer refills). The balloon floats away.
 */
export class HeliumTank extends Entity {
  readonly anim = new Animator();
  /** The tank is gone; only the cloud is left. */
  burst = false;
  /** Ticks of cloud left. */
  cloudLeft = 0;
  readonly cloudRect: Rect = { x: 0, y: 0, w: HELIUM_TANK.cloud, h: HELIUM_TANK.cloud };
  private wobble = 0;
  private statusDef: StatusEffectDef | null | undefined = undefined;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 24;
    this.hp = this.maxHp = paramNum(params, 'hp', HELIUM_TANK.hp);
    this.hitbox = { x: -10, y: -28, w: 20, h: 28 };
    this.body = new Body({ w: 18, h: 26 });
    this.despawnMargin = 200;
    this.addTag('shootable', 'soft', 'prop');
    this.anim.play('prop/helium-tank/idle');
  }

  override onHit(d: Damage): boolean {
    if (this.burst) return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    if (this.hp <= 0) this.die(d);
    else {
      this.wobble = 12;
      sfxNear(this.world, this.x, this.y, 'hit/metal', 0.6);
    }
    return true;
  }

  /** Burst: 100 points, a pop, pink puffs, the balloon floats off, the cloud starts. */
  override die(d?: Damage): void {
    if (this.burst) return;
    this.burst = true;
    this.dead = true;
    this.removeTag('shootable');
    this.removeTag('soft');
    this.cloudLeft = HELIUM_TANK.cloudTicks;
    const cx = this.x;
    const cy = this.y - 14;
    const r = this.cloudRect;
    r.x = cx - r.w / 2;
    r.y = cy - r.h / 2;
    awardScore(this.world, d?.owner, HELIUM_TANK.score, this.x, this.y - 32);
    this.world.audio.sfx('explosion/s');
    debris(this.world, cx, cy, 'metal', 5);
    this.world.particles.burst(HELIUM_PUFF, cx, cy, 16, 0.3, 1.6);
    const o = fxOpts;
    o.sprite = 'prop/helium-tank/balloon';
    o.x = this.x + 2;
    o.y = this.y - 40;
    o.vx = 0.3;
    o.vy = -0.5;
    o.gravity = -0.012;
    o.loop = true;
    o.life = 240;
    o.z = 61;
    FxEntity.spawn(this.world, o);
  }

  override update(): void {
    if (!this.burst) {
      moveBody(this, this.world.terrain, this.world);
      if (this.wobble > 0) this.wobble--;
      this.anim.update();
      return;
    }
    if (--this.cloudLeft <= 0) {
      this.remove();
      return;
    }
    this.gas();
  }

  /** Every player on foot inside the cloud gets (or refreshes) Helium Head. */
  private gas(): void {
    const list = this.world.players;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isFootPlayer(p) || !overlaps(p.hitRect(scratch), this.cloudRect)) continue;
      if (this.statusDef === undefined) this.statusDef = getStatus(HELIUM_TANK.status) ?? null;
      if (this.statusDef) p.status.add(this.statusDef);
    }
  }

  override draw(r: Renderer): void {
    if (!this.burst) {
      // A hit makes the tank rock for a moment (1 px left-right).
      const jiggle = this.wobble > 0 ? (this.wobble >> 2) % 2 === 0 ? 1 : -1 : 0;
      drawOpts.alpha = 1;
      drawOpts.flash = this.flashTicks > 0;
      r.sprite(this.anim.id, this.anim.index, Math.round(this.x) + jiggle, Math.round(this.y), drawOpts);
      drawOpts.flash = false;
      return;
    }
    const id = hasSprite('fx/helium-cloud') ? 'fx/helium-cloud' : 'prop/helium-tank/cloud';
    const age = HELIUM_TANK.cloudTicks - this.cloudLeft;
    drawOpts.flash = false;
    drawOpts.alpha = Math.min(1, this.cloudLeft / HELIUM_TANK.fadeTicks) * 0.85;
    const r0 = this.cloudRect;
    r.sprite(id, age >> 3, Math.round(r0.x + r0.w / 2), Math.round(r0.y + r0.h / 2), drawOpts);
    drawOpts.alpha = 1;
  }

  override onOutOfWorld(): void {
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// statue-head (GDD §9.5, §14.2)
// ---------------------------------------------------------------------------------------------

export const STATUE_HEAD = {
  hp: 50,
  /** VANDALISM bonus: the head scores only this (GDD §14.3). */
  vandalism: 500,
  /** Rolls this far on the floor at this speed once it is down. */
  roll: 64,
  speed: 1.5,
  /** Roll frames per full turn and the head's circumference (24 px across). */
  frames: 8,
  circumference: Math.PI * 24,
} as const;

/**
 * The gold head of a Fanfaroni statue (24×24) on a plinth. 50 HP. Knocked off (shot or blasted),
 * it hops off the plinth away from the hit, rolls 64 px at 1.5 px/tick and comes to rest. VANDALISM
 * +500 to the player who knocked it off; every infantryman ('soft' enemy) it rolls over is crushed
 * (SET PIECE +200 each, plus his kill score, to the same player). Players are never hurt.
 */
export class StatueHead extends Entity {
  state: 'perch' | 'topple' | 'roll' | 'rest' = 'perch';
  dir: 1 | -1 = 1;
  /** Who knocked it off (credited for crushes). */
  owner: number | undefined = undefined;
  /** Distance rolled on the floor. */
  rolled = 0;
  /** Roll frame position (STATUE_HEAD.frames per turn). */
  spin = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 26;
    this.hp = this.maxHp = paramNum(params, 'hp', STATUE_HEAD.hp);
    this.hitbox = { x: -11, y: -23, w: 22, h: 23 };
    this.body = new Body({ w: 18, h: 22 });
    this.despawnMargin = 200;
    this.addTag('shootable', 'prop');
  }

  override onHit(d: Damage): boolean {
    if (this.state !== 'perch') return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    sfxNear(this.world, this.x, this.y, 'hit/metal', 0.7);
    if (this.hp <= 0) this.knockOff(d);
    return true;
  }

  override die(d?: Damage): void {
    if (this.state === 'perch') this.knockOff(d ?? { amount: this.hp, kind: 'impact', dirX: 0 });
  }

  /** Off it goes: away from the hit, with a hop. */
  private knockOff(d: Damage): void {
    this.state = 'topple';
    this.dead = true;
    this.removeTag('shootable');
    const p = this.world.nearestPlayer(this.x, this.y);
    this.dir = d.dirX > 0 ? 1 : d.dirX < 0 ? -1 : p && p.x > this.x ? -1 : 1;
    this.facing = this.dir;
    this.owner = d.owner;
    if (d.owner === 0 || d.owner === 1) {
      awardScore(this.world, d.owner, STATUE_HEAD.vandalism, this.x, this.y - 28);
      hudOf(this.world).callout(`VANDALISM! +${STATUE_HEAD.vandalism}`);
    }
    this.vx = this.dir * STATUE_HEAD.speed;
    jump(this, -1.6);
  }

  override update(): void {
    const s = this.state;
    if (s === 'perch' || s === 'rest') {
      moveBody(this, this.world.terrain, this.world);
      return;
    }
    this.vx = this.dir * STATUE_HEAD.speed;
    const c = moveBody(this, this.world.terrain, this.world);
    const moved = Math.abs(this.x - this.prevX);
    if (s === 'topple') {
      // Tumbling through the air off the plinth.
      this.spin += 0.3;
      if (c.landed) {
        this.state = 'roll';
        sfxNear(this.world, this.x, this.y, 'hit/shield', 0.9);
        dust(this.world, this.x, this.y, 4);
      }
    } else {
      if (c.onGround) this.rolled += moved;
      this.spin += (moved * STATUE_HEAD.frames) / STATUE_HEAD.circumference;
      if (this.rolled >= STATUE_HEAD.roll || c.hitWall) this.rest();
    }
    this.crush();
  }

  /** Come to rest on the nearest quarter turn (crisp frames), with a clonk. */
  private rest(): void {
    this.state = 'rest';
    this.vx = 0;
    const q = STATUE_HEAD.frames / 4;
    this.spin = Math.round(this.spin / q) * q;
    sfxNear(this.world, this.x, this.y, 'hit/shield', 0.7);
    dust(this.world, this.x, this.y, 3);
  }

  /** Infantry under the rolling head are flattened (SET PIECE!). */
  private crush(): void {
    const list = this.world.snapshotTag('soft');
    let n = 0;
    try {
      const me = this.hitRect(scratch);
      const mx = me.x;
      const my = me.y;
      const mw = me.w;
      const mh = me.h;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !e.hasTag('enemy') || e.hasTag('boss')) continue;
        const b = e.hitRect(scratch);
        if (!(b.x < mx + mw && b.x + b.w > mx && b.y < my + mh && b.y + b.h > my)) continue;
        this.world.damage(e, crushHit(this, this.owner, this.dir));
        if (e.dead) n++;
      }
    } finally {
      this.world.releaseSnapshot();
    }
    setPiece(this.world, this.owner, n, this.x, this.y - 30);
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flash = this.flashTicks > 0;
    drawOpts.flipX = this.dir < 0;
    if (this.state === 'perch') {
      drawOpts.flipX = false;
      r.sprite('prop/statue-head/idle', 0, Math.round(this.x), Math.round(this.y), drawOpts);
    } else {
      const f = ((Math.floor(this.spin) % STATUE_HEAD.frames) + STATUE_HEAD.frames) % STATUE_HEAD.frames;
      r.sprite('prop/statue-head/roll', f, Math.round(this.x), Math.round(this.y), drawOpts);
    }
    drawOpts.flash = false;
    drawOpts.flipX = false;
  }
}

// ---------------------------------------------------------------------------------------------
// breakable-wall (GDD §9.5, §11.0 "Secrets behind walls")
// ---------------------------------------------------------------------------------------------

export const BREAKABLE_WALL = { w: 24, h: 48, hp: 200, score: 100 } as const;

const WALL_DEBRIS: Readonly<Record<WallLook, DebrisKind>> = {
  brick: 'rock',
  door: 'wood',
  rock: 'rock',
  crystal: 'glass',
  panel: 'wood',
};

/**
 * A cracked wall or door (default 24×48; params `w`, `h`). 200 HP, 100 points. Cracks show after
 * the first hit and grow as it weakens. `solid` (default true) makes it a dynamic solid that blocks
 * bodies until it breaks; `solid: false` is a secret wall drawn behind the actors. Params: `look`
 * (`brick` | `door` | `rock` | `crystal` | `panel`), `hp`, and `reveal` — what it hid: a spawn spec
 * or a list, ALL spawned when it breaks; each item may carry `x`, `y` (absolute) or `dx`, `dy`
 * (from the wall's feet). A script can also wait for `wall.broken`.
 */
export class BreakableWall extends Entity {
  readonly w: number;
  readonly h: number;
  readonly look: WallLook;
  readonly solid: boolean;
  readonly sprite: string;
  readonly rubble: string;
  box: SolidBox | null = null;
  broken = false;
  private readonly reveal: unknown;
  private hitSfx = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.w = Math.max(8, Math.min(256, Math.round(paramNum(params, 'w', BREAKABLE_WALL.w))));
    this.h = Math.max(8, Math.min(256, Math.round(paramNum(params, 'h', BREAKABLE_WALL.h))));
    const look = paramStr(params, 'look', 'brick');
    this.look = (WALL_LOOKS as readonly string[]).includes(look) ? (look as WallLook) : 'brick';
    this.solid = paramBool(params, 'solid', true);
    this.reveal = params.reveal;
    this.team = 'enemy';
    this.z = this.solid ? 16 : 12;
    this.hp = this.maxHp = paramNum(params, 'hp', BREAKABLE_WALL.hp);
    this.hitbox = { x: -this.w / 2, y: -this.h, w: this.w, h: this.h };
    this.despawnMargin = 200;
    this.addTag('shootable', 'prop', 'wall');
    const ids = wallSprites(this.look, this.w, this.h);
    this.sprite = ids.wall;
    // A broken secret wall leaves a dark opening (the hidden niche); a solid one a rubble pile.
    this.rubble = this.solid ? ids.rubble : ids.niche;
    if (this.solid) this.box = world.addSolid(new SolidBox(x - this.w / 2, y - this.h, this.w, this.h, false, this));
  }

  /** 0 intact, 1 cracked (after the first hit), 2 badly cracked, 3 about to give. */
  get stage(): number {
    if (this.hp >= this.maxHp) return 0;
    if (this.hp > this.maxHp * 0.6) return 1;
    if (this.hp > this.maxHp * 0.3) return 2;
    return 3;
  }

  override onHit(d: Damage): boolean {
    if (this.broken) return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    if (this.hp <= 0) this.shatter(d);
    else if (this.hitSfx <= 0) {
      this.hitSfx = 6;
      sfxNear(this.world, this.x, this.y, this.look === 'crystal' || this.look === 'panel' ? 'hit/metal' : 'hit/shield', 0.5);
    }
    return true;
  }

  override die(d?: Damage): void {
    this.shatter(d);
  }

  /** Breaks apart: rubble, 100 points, the passage opens and the secrets come out. */
  private shatter(d?: Damage): void {
    if (this.broken) return;
    this.broken = true;
    this.dead = true;
    this.removeTag('shootable');
    if (this.box) {
      this.world.removeSolid(this.box);
      this.box = null;
    }
    const kind = WALL_DEBRIS[this.look];
    const n = Math.max(6, Math.round((this.w * this.h) / 90));
    for (let i = 0; i < 3; i++) debris(this.world, this.x, this.y - (this.h * (i + 1)) / 4, kind, Math.ceil(n / 3));
    dust(this.world, this.x, this.y, 6);
    this.world.audio.sfx(this.look === 'door' || this.look === 'panel' ? 'item/crate-break' : 'explosion/s');
    awardScore(this.world, d?.owner, BREAKABLE_WALL.score, this.x, this.y - this.h - 4);
    spawnReveal(this.world, this.reveal, this.x, this.y);
  }

  override update(): void {
    if (this.hitSfx > 0) this.hitSfx--;
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    if (this.broken) {
      drawOpts.flash = false;
      r.sprite(this.rubble, 0, Math.round(this.x), Math.round(this.y), drawOpts);
      return;
    }
    drawOpts.flash = this.flashTicks > 0;
    r.sprite(this.sprite, this.stage, Math.round(this.x), Math.round(this.y), drawOpts);
    drawOpts.flash = false;
  }
}

/**
 * Spawn everything a broken wall hid: a spawn spec (`'hostage'`, `{ id, params }`) or a list of
 * them (all of them, unlike crate contents). Items may give `x` / `y` or `dx` / `dy`.
 */
export function spawnReveal(world: World, v: unknown, x: number, y: number): void {
  if (v === undefined || v === null || v === false) return;
  const list = Array.isArray(v) ? (v as unknown[]) : [v];
  for (const item of list) {
    const spec = toSpawnSpec(item);
    if (!spec) continue;
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const px = typeof o.x === 'number' ? o.x : x + (typeof o.dx === 'number' ? o.dx : 0);
    const py = typeof o.y === 'number' ? o.y : y + (typeof o.dy === 'number' ? o.dy : 0);
    world.spawn(spec.id, px, py, spec.params);
  }
}

// ---------------------------------------------------------------------------------------------
// rolling-drum (GDD §9.5)
// ---------------------------------------------------------------------------------------------

export const ROLLING_DRUM = {
  hp: 40,
  score: 100,
  /** px/tick, downhill or along the floor. */
  speed: 2,
  /** One turn of the 24-px drum: a thump on the floor (the sound telegraph). */
  circumference: Math.PI * 24,
  frames: 8,
} as const;

/**
 * A Legion bass drum rolling on its rim (24×24) at 2 px/tick along the floor and down slopes; it
 * falls off ledges. Contact kills a player on foot (a ridden vehicle loses a cell and the drum
 * smashes on it). 40 HP, 100 points. It thumps once per turn so it is heard before it is seen,
 * and smashes when it hits a wall. Params: `dir` / `facing` (default: toward the nearest player),
 * `speed`.
 */
export class RollingDrum extends Entity {
  dir: 1 | -1 = -1;
  readonly speed: number;
  /** Distance rolled (drives the frame and the thump). */
  rolled = 0;
  private started = false;
  private readonly dirParam: 1 | -1 | 0;
  private readonly hasFacing: boolean;
  private nextThump = 0;
  private readonly hit: Damage;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 31;
    this.hp = this.maxHp = paramNum(params, 'hp', ROLLING_DRUM.hp);
    this.speed = paramNum(params, 'speed', ROLLING_DRUM.speed);
    this.hitbox = { x: -10, y: -21, w: 20, h: 20 };
    this.body = new Body({ w: 20, h: 22 });
    this.despawnMargin = 96;
    const d = params.dir;
    this.dirParam = d === 1 || d === 'right' ? 1 : d === -1 || d === 'left' ? -1 : 0;
    this.hasFacing = 'facing' in params;
    this.hit = { amount: 1e6, kind: 'impact', dirX: 0, source: this };
    this.contactDamage = this.hit;
    this.addTag('shootable', 'prop');
  }

  override onHit(d: Damage): boolean {
    if (this.dead) return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    if (this.hp <= 0) this.smash(d);
    else sfxNear(this.world, this.x, this.y, 'hit/drum', 0.5);
    return true;
  }

  override die(d?: Damage): void {
    this.smash(d ?? null);
  }

  /** Burst: drumhead and hoops fly. Points only when a player broke it. */
  smash(d: Damage | null): void {
    if (this.dead) return;
    this.dead = true;
    this.contactDamage = null;
    this.removeTag('shootable');
    sfxNear(this.world, this.x, this.y, 'hit/drum', 1);
    debris(this.world, this.x, this.y - 12, 'wood', 6);
    debris(this.world, this.x, this.y - 12, 'cloth', 4);
    if (d) awardScore(this.world, d.owner, ROLLING_DRUM.score, this.x, this.y - 28);
    this.remove();
  }

  override update(): void {
    if (!this.started) {
      this.started = true;
      if (this.dirParam !== 0) this.dir = this.dirParam;
      else if (this.hasFacing) this.dir = this.facing;
      else {
        const p = this.world.nearestPlayer(this.x, this.y);
        this.dir = p && p.x > this.x ? 1 : -1;
      }
      this.facing = this.dir;
    }
    this.vx = this.dir * this.speed;
    const c = moveBody(this, this.world.terrain, this.world);
    if (c.hitWall) {
      this.smash(null);
      return;
    }
    this.rolled += Math.abs(this.x - this.prevX);
    if (this.rolled >= this.nextThump) {
      this.nextThump += ROLLING_DRUM.circumference / 2;
      if (c.onGround) sfxNear(this.world, this.x, this.y, 'hit/drum', 0.3, 0.8);
    }
    this.hit.dirX = this.dir;
    this.rammedVehicle();
  }

  /** A player's vehicle takes the drum like a ram: one cell, and the drum smashes on it. */
  private rammedVehicle(): void {
    const list = this.world.byTag('vehicle');
    if (list.length === 0) return;
    const me = this.hitRect(scratch);
    const mx = me.x;
    const my = me.y;
    const mw = me.w;
    const mh = me.h;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v.alive || v.team !== 'player') continue;
      const b = v.hitRect(scratch);
      if (!(b.x < mx + mw && b.x + b.w > mx && b.y < my + mh && b.y + b.h > my)) continue;
      this.world.damage(v, { amount: 10, kind: 'impact', dirX: this.dir, source: this });
      this.smash(null);
      return;
    }
  }

  override draw(r: Renderer): void {
    const f = Math.floor((this.rolled * ROLLING_DRUM.frames) / ROLLING_DRUM.circumference) % ROLLING_DRUM.frames;
    drawOpts.alpha = 1;
    drawOpts.flipX = this.dir < 0;
    drawOpts.flash = this.flashTicks > 0;
    r.sprite('prop/rolling-drum/roll', f, Math.round(this.x), Math.round(this.y), drawOpts);
    drawOpts.flash = false;
    drawOpts.flipX = false;
  }

  override onOutOfWorld(): void {
    this.dead = true;
    this.remove();
  }
}

// ---------------------------------------------------------------------------------------------
// icicle (GDD §9.5, the m3-b2 Icicle Organ)
// ---------------------------------------------------------------------------------------------

export const ICICLE = {
  hp: 10,
  score: 50,
  /** A rising major scale (semitones), left to right. */
  scale: [0, 2, 4, 5, 7, 9, 11, 12] as readonly number[],
  /** Pitch of the lowest note on the `enemy/triangle` bell (2.5 kHz → 1.25 kHz). */
  basePitch: 0.5,
  /** The organ's prize when all its icicles break left to right. */
  notes: 10,
} as const;

/** One icicle organ: every icicle that shares an `organ` name in a world. */
interface Organ {
  readonly members: Icicle[];
  /** Still in left-to-right order so far. */
  inOrder: boolean;
  done: boolean;
}

const organs = new WeakMap<World, Map<string, Organ>>();

function organOf(world: World, name: string): Organ {
  let m = organs.get(world);
  if (!m) {
    m = new Map();
    organs.set(world, m);
  }
  let o = m.get(name);
  if (!o) {
    o = { members: [], inOrder: true, done: false };
    m.set(name, o);
  }
  return o;
}

/**
 * A hanging icicle (8×24, anchored at its TOP). 10 HP, 50 points; when shot it shatters and
 * plays one note. Icicles that share an `organ` name (default 'organ'; `organ: false` = alone)
 * form the Icicle Organ: their notes rise up a major scale from left to right, and breaking all of
 * them from left to right spawns 10 `golden-note`s and a `gem` below them (BRAVO!); any other
 * order just breaks them. Params: `organ`, `note` (scale step override), `reward` (default true).
 */
export class Icicle extends Entity {
  readonly organ: Organ | null;
  private readonly note: number;
  private readonly reward: boolean;
  broken = false;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 22;
    this.hp = this.maxHp = paramNum(params, 'hp', ICICLE.hp);
    this.hitbox = { x: -4, y: 0, w: 8, h: 24 };
    this.despawnMargin = 200;
    this.note = Math.round(paramNum(params, 'note', -1));
    this.reward = paramBool(params, 'reward', true);
    this.organ = params.organ === false ? null : organOf(world, paramStr(params, 'organ', 'organ'));
    this.organ?.members.push(this);
    this.addTag('shootable', 'prop');
  }

  /** Scale step: the `note` param, else the rank from the left among the organ's icicles. */
  get step(): number {
    if (this.note >= 0) return this.note;
    if (!this.organ) return 0;
    let rank = 0;
    for (const m of this.organ.members) if (m !== this && (m.x < this.x || (m.x === this.x && m.id < this.id))) rank++;
    return rank;
  }

  /** Pitch multiplier of this icicle's note. */
  get pitch(): number {
    const s = this.step;
    const sc = ICICLE.scale;
    const semis = sc[s % (sc.length - 1)] + 12 * Math.floor(s / (sc.length - 1));
    return ICICLE.basePitch * Math.pow(2, semis / 12);
  }

  override onHit(d: Damage): boolean {
    if (this.broken) return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    if (this.hp <= 0) this.shatter(d);
    return true;
  }

  override die(d?: Damage): void {
    this.shatter(d);
  }

  /** Ping! The note, ice shards, 50 points, and the organ checks the order. */
  private shatter(d?: Damage): void {
    if (this.broken) return;
    const organ = this.organ;
    // In order = every icicle to the left of this one is already broken.
    if (organ) {
      for (const m of organ.members) if (m !== this && !m.broken && (m.x < this.x || (m.x === this.x && m.id < this.id))) organ.inOrder = false;
    }
    this.broken = true;
    this.dead = true;
    this.removeTag('shootable');
    this.world.audio.sfx('enemy/triangle', { pitch: this.pitch });
    debris(this.world, this.x, this.y + 12, 'glass', 6);
    const o = fxOpts;
    o.sprite = 'prop/icicle/shatter';
    o.x = this.x;
    o.y = this.y + 14;
    o.vx = 0;
    o.vy = 0;
    o.gravity = 0;
    o.loop = false;
    o.life = undefined;
    o.z = 60;
    FxEntity.spawn(this.world, o);
    awardScore(this.world, d?.owner, ICICLE.score, this.x, this.y + 4);
    if (organ && !organ.done && organ.inOrder && organ.members.length >= 2 && organ.members.every((m) => m.broken)) {
      organ.done = true;
      if (this.reward) this.payOrgan(organ);
    }
    this.remove();
  }

  /** All of them, left to right: golden notes and a gem pop out below the organ. */
  private payOrgan(organ: Organ): void {
    let x0 = Infinity;
    let x1 = -Infinity;
    let bottom = -Infinity;
    for (const m of organ.members) {
      x0 = Math.min(x0, m.x);
      x1 = Math.max(x1, m.x);
      bottom = Math.max(bottom, m.y + 24);
    }
    const n = ICICLE.notes;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / (n - 1);
      const e = this.world.spawn('pickup-gem', x, bottom + 6, { kind: 'golden-note' });
      e.vy = -1.5;
    }
    const g = this.world.spawn('pickup-gem', (x0 + x1) / 2, bottom + 6, { kind: 'gem' });
    g.vy = -2;
    this.world.audio.sfx('ui/star');
    hudOf(this.world).callout('BRAVO!');
  }

  override draw(r: Renderer): void {
    // A glint runs down the ice now and then (frame 1), staggered per icicle.
    const f = (this.world.tick + this.id * 37) % 120 < 8 ? 1 : 0;
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    drawOpts.flash = this.flashTicks > 0;
    r.sprite('prop/icicle/idle', f, Math.round(this.x), Math.round(this.y), drawOpts);
    drawOpts.flash = false;
  }
}
