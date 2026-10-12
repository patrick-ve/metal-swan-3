/**
 * `bandwagon` — THE BANDWAGON, a captured Legion parade truck (GDD §8.4, §6.3).
 *
 * - Drive: accelerate 0.06, max 1.8, hydraulic bounce vy −2.4; it faces its direction of travel
 *   (brake chosen 0.1: the GDD gives none). 4 cells, 10 shells. Hurtboxes: cab 32×36 + flatbed
 *   64×24.
 * - The sousaphone bell (main gun) has 5 angles, 0° … −120°: holding up raises it one step per 6
 *   ticks up to −90°, up + back reaches −120° (backwards-up), nothing held lowers it to 0°.
 * - `bandwagon-brass-cannon` (fire): a `brass-ring` every 12 ticks that grows from 10 to 24 px,
 *   speed 4, 30 damage, pierces and erases the enemy bullets it touches.
 * - `bandwagon-drum-boom` (bomb): two `drum-wave`s run along the ground both ways, 96 px each,
 *   12 px tall, 3 px/tick: 100 to every grounded enemy they cross. Cooldown 45.
 * - `bandwagon-cymbal-wall` (fire + bomb): two giant cymbals swing up in front of the cab for 60
 *   ticks: they block every projectile from the front and deal 100 to anything the truck touches
 *   (once per target). Cooldown 300.
 * - Contact: at 1.0 px/tick or more it squashes soft enemies. Co-op: the stage is a moving one-way
 *   platform a partner can stand on.
 * - Ram (fire + jump): the driverless truck careens at 2.4 px/tick for up to 240 px while its band
 *   plays double time, then bursts into a shower of instruments (500 in r 48).
 */
import { Entity, hostile, type Damage } from '../../../../engine/entity';
import type { VirtualPad } from '../../../../engine/input';
import { overlaps, rectAt, type Rect } from '../../../../engine/math';
import type { ParticlePreset } from '../../../../engine/particles';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { FxEntity, hitSpark } from '../../../fx';
import { Projectile, eraseEnemyShots, type ProjectileOpts } from '../../../projectile';
import { defineEntity, defineWeapon, type SpawnParams } from '../../../registry';
import { acquire, release } from '../../../pool';
import { aimAngle, aimDirOf } from '../../../weapons';
import { drawDriver, GroundVehicle } from './common';
import { ART, BANDWAGON, BRASS, bellAngle, bellMuzzle, CYMBAL, DRUM } from './numbers';

const A = ART.bandwagon;
const ID = {
  body: `${A}/body`,
  front: `${A}/front`,
  wheels: `${A}/wheels`,
  bell: `${A}/bell`,
  drum: `${A}/drum`,
  special: `${A}/special`,
  wreck: `${A}/wreck`,
  gag: `${A}/empty-gag`,
  bits: `${A}/bits`,
  note: `${A}/note`,
} as const;

const pt: [number, number] = [0, 0];
const mz: [number, number] = [0, 0];
const opts: DrawOpts = {};
const tint: DrawOpts = { tint: 0xff3020ff, alpha: 0.45 };
const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Instruments flying out of the ram blast (random frames of `bits`: horns, sticks, a cymbal …). */
const INSTRUMENTS: ParticlePreset = {
  kind: 'sprite',
  sprite: ID.bits,
  randomFrames: 6,
  ticksPerFrame: 0,
  life: [40, 64],
  gravity: 0.12,
  drag: 0.985,
  ground: 'bounce',
  bounce: 0.35,
  randomFlip: true,
};

// ---------------------------------------------------------------------------------------------
// BRASS CANNON: a growing sonic ring
// ---------------------------------------------------------------------------------------------

/** A sonic ring: pierces, grows from 10 to 24 px and erases the enemy bullets it touches. */
export class BrassRing extends Projectile {
  /** Current ring size (px). */
  size: number = BRASS.sizeFrom;

  constructor(world: World) {
    super(world);
  }

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.size = BRASS.sizeFrom;
    this.resize();
  }

  override update(): void {
    super.update();
    if (this.removed) return;
    const grow = (BRASS.sizeTo - BRASS.sizeFrom) / BRASS.growTicks;
    this.size = Math.min(BRASS.sizeTo, BRASS.sizeFrom + this.t * grow);
    this.resize();
    eraseEnemyShots(this.world, this.hitRect(scratch));
  }

  private resize(): void {
    const s = Math.round(this.size);
    this.hitbox.x = -s / 2;
    this.hitbox.y = -s / 2;
    this.hitbox.w = s;
    this.hitbox.h = s;
  }

  override draw(r: Renderer): void {
    // Frames: sizes 10, 12 … 24; a 2-frame shimmer inside each size.
    const i = Math.max(0, Math.min(7, Math.round((this.size - BRASS.sizeFrom) / 2)));
    r.sprite(ART.brassRing, i * 2 + ((this.t >> 2) & 1), Math.round(this.x), Math.round(this.y), ringOpts);
  }
}
const ringOpts: DrawOpts = {};
const SONIC: readonly string[] = ['sonic'];

/** Reused ring options (Projectile.init copies what it needs). */
const ringSpec: ProjectileOpts = {
  team: 'player',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  damage: BRASS.damage,
  kind: 'impact',
  tags: SONIC,
  life: BRASS.life,
  pierce: Infinity,
  w: BRASS.sizeFrom,
  h: BRASS.sizeFrom,
  sprite: ART.brassRing,
  impact: 'none',
  offscreen: 32,
  type: 'brass-ring',
  weapon: 'bandwagon-brass-cannon',
};

function ringOptsFor(team: ProjectileOpts['team'], x: number, y: number, vx: number, vy: number, owner: number, shooter: Entity | null): ProjectileOpts {
  ringSpec.team = team;
  ringSpec.x = x;
  ringSpec.y = y;
  ringSpec.vx = vx;
  ringSpec.vy = vy;
  ringSpec.owner = owner;
  ringSpec.shooter = shooter;
  return ringSpec;
}

defineWeapon({
  id: 'bandwagon-brass-cannon',
  name: 'BRASS CANNON',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: BRASS.cooldown,
  auto: true,
  maxShotsOnScreen: BRASS.maxOnScreen,
  sfx: 'bandwagon/brass',
  fire(ctx) {
    const p = BrassRing.spawn(ctx.world, ringOptsFor(ctx.team, ctx.x, ctx.y, ctx.dirX * BRASS.speed, ctx.dirY * BRASS.speed, ctx.owner, ctx.shooter));
    ringSpec.shooter = null;
    ctx.gun.track(p);
  },
});

defineEntity('brass-ring', (w, x, y, p) => BrassRing.spawn(w, ringOptsFor('player', x, y, (p.facing === -1 || p.facing === 'left' ? -1 : 1) * BRASS.speed, 0, -1, null)), {
  category: 'projectile',
  description: 'BANDWAGON brass ring (grows 10 → 24 px, 30 damage, pierces, erases bullets).',
});

// ---------------------------------------------------------------------------------------------
// DRUM BOOM: ground shockwaves
// ---------------------------------------------------------------------------------------------

/**
 * One ground shockwave of the DRUM BOOM: it hugs the ground for 96 px at 3 px/tick and hits every
 * grounded enemy it crosses once (100). It ends at a wall, a pit or a drop of more than 12 px.
 * Not a 'shot' (the world's shot pass would also hit flyers): it does its own hits. Pooled.
 */
export class DrumWave extends Entity {
  dir: 1 | -1 = 1;
  owner = -1;
  ran = 0;
  private readonly hit: Entity[] = [];
  private readonly box: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(world: World) {
    super(world);
    this.type = 'drum-wave';
    this.z = 50;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -DRUM.w / 2, y: -DRUM.height, w: DRUM.w, h: DRUM.height };
  }

  /** Start a wave at (x, groundY) running `dir`. */
  static spawn(world: World, x: number, y: number, dir: 1 | -1, owner: number): DrumWave {
    const w = acquire(world, DrumWave);
    w.x = w.prevX = x;
    w.y = w.prevY = y;
    w.dir = dir;
    w.facing = dir;
    w.owner = owner;
    w.ran = 0;
    w.team = 'player';
    w.hit.length = 0;
    return world.add(w);
  }

  override update(): void {
    const t = this.world.terrain;
    const nx = this.x + this.dir * DRUM.speed;
    // Follow the ground: the next surface within ±12 px, else the wave breaks up.
    const gy = t.surfaceY(nx, this.y - DRUM.maxStep, this.y + DRUM.maxStep);
    if (!Number.isFinite(gy) || t.isSolid(nx, gy - 2)) {
      this.remove();
      return;
    }
    this.x = nx;
    this.y = gy;
    this.ran += DRUM.speed;
    this.strike();
    if (this.ran >= DRUM.reach) this.remove();
  }

  /** Hit every grounded hostile target the wave overlaps (each once). */
  private strike(): void {
    const box = this.hitRect(this.box);
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !hostile(this.team, e.team) || this.hit.includes(e)) continue;
        // Grounded: a body on the floor, or a bodiless target (turret, prop) resting on it.
        if (e.body ? !e.body.onGround : e.hitRect(scratch).y + scratch.h < this.y - 4) continue;
        const hb = e.hurtboxes();
        let part = -1;
        for (let k = 0; k < hb.length && part < 0; k++) if (overlaps(hb[k], box)) part = k;
        if (part < 0) continue;
        this.hit.push(e);
        const d: Damage = { amount: DRUM.damage, kind: 'impact', dirX: this.dir, owner: this.owner, source: this, weapon: 'bandwagon-drum-boom', tags: SHOCK };
        this.world.damage(e, d, part);
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  override draw(r: Renderer): void {
    waveOpts.flipX = this.dir < 0;
    r.sprite(ART.drumWave, this.ran / DRUM.speed >> 2, Math.round(this.x), Math.round(this.y), waveOpts);
  }

  override onRemove(): void {
    this.hit.length = 0;
    release(this);
  }
}
const waveOpts: DrawOpts = {};
const SHOCK: readonly string[] = ['shockwave'];

defineWeapon({
  id: 'bandwagon-drum-boom',
  name: 'DRUM BOOM',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: DRUM.cooldown,
  auto: false,
  holdRepeat: null,
  sfx: 'bandwagon/drum',
  icon: 'ui/icon-shell',
  fire(ctx) {
    const v = ctx.shooter;
    // The waves start under the truck, on its ground line.
    DrumWave.spawn(ctx.world, v.x, v.y, 1, ctx.owner);
    DrumWave.spawn(ctx.world, v.x, v.y, -1, ctx.owner);
    ctx.world.camera.shake(2, 8);
    if (v instanceof Bandwagon) v.drumHit();
  },
});

defineEntity('drum-wave', (w, x, y, p) => DrumWave.spawn(w, x, y, p.facing === -1 || p.facing === 'left' ? -1 : 1, -1), {
  category: 'projectile',
  description: 'BANDWAGON drum-boom ground wave (96 px at 3 px/tick, 100 to grounded enemies).',
});

// ---------------------------------------------------------------------------------------------
// CYMBAL WALL
// ---------------------------------------------------------------------------------------------

defineWeapon({
  id: 'bandwagon-cymbal-wall',
  name: 'CYMBAL WALL',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: CYMBAL.cooldown,
  auto: false,
  holdRepeat: null,
  sfx: 'bandwagon/cymbals',
  fire(ctx) {
    if (ctx.shooter instanceof Bandwagon) ctx.shooter.raiseCymbals();
  },
});

// ---------------------------------------------------------------------------------------------
// The truck
// ---------------------------------------------------------------------------------------------

export class Bandwagon extends GroundVehicle {
  /** Bell step 0..4: 0°, −30°, −60°, −90°, −120° (relative to the facing). */
  bellStep = 0;
  /** Ticks left of the CYMBAL WALL (including its swing up and down). */
  cymbalT = 0;
  /** The drum beater's hit animation. */
  drumT = 0;
  /** The co-op stage: a one-way platform carried with the truck (GDD §8.4 Co-op). */
  readonly stage: SolidBox;
  private bellT = 0;
  private readonly cymbalHits: Entity[] = [];
  private readonly boxes: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly wall: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y, params, {
      art: A,
      name: 'BANDWAGON',
      w: BANDWAGON.body.w,
      h: BANDWAGON.body.h,
      hurt: BANDWAGON.hurt,
      seat: BANDWAGON.seat,
      seatPoint: BANDWAGON.driverDraw,
      cells: BANDWAGON.cells,
      shells: BANDWAGON.shells,
      mainGun: 'bandwagon-brass-cannon',
      cannon: 'bandwagon-drum-boom',
      special: 'bandwagon-cymbal-wall',
      speed: BANDWAGON.speed,
      accel: BANDWAGON.accel,
      jump: BANDWAGON.jump,
      brake: BANDWAGON.brake,
      ramSpeed: BANDWAGON.ramSpeed,
      ramDistance: BANDWAGON.ramDistance,
      ramDamage: BANDWAGON.ramDamage,
      ramRadius: BANDWAGON.ramRadius,
      squashSpeed: BANDWAGON.squashSpeed,
      squashInclusive: BANDWAGON.squashInclusive,
      halfWidth: BANDWAGON.width / 2,
      hatch: BANDWAGON.hatch,
      driverAnchor: BANDWAGON.driverAnchor,
    });
    const s = this.stageRect(scratch);
    this.stage = world.addSolid(new SolidBox(s.x, s.y, s.w, s.h, true, this));
  }

  /** Cab + flatbed (GDD §8.4), mirrored with the facing. */
  override hurtboxes(): readonly Rect[] {
    const flip = this.facing < 0;
    rectAt(this.x, this.y, BANDWAGON.cab, flip, this.boxes[0]);
    rectAt(this.x, this.y, BANDWAGON.bed, flip, this.boxes[1]);
    return this.boxes;
  }

  private stageRect(out: Rect): Rect {
    return rectAt(this.x, this.y, BANDWAGON.stage, this.facing < 0, out);
  }

  override update(): void {
    super.update();
    if (this.removed) return;
    // Carry the stage platform (moveSolid carries a partner standing on it).
    const s = this.stageRect(scratch);
    this.world.moveSolid(this.stage, s.x - this.stage.x, s.y - this.stage.y);
    this.stage.enabled = this.state === 'idle' || this.state === 'driven';
    if (this.drumT > 0) this.drumT--;
    if (this.cymbalT > 0) {
      this.cymbalT--;
      if (this.state === 'driven' && this.cymbalsUp) {
        this.blockShots();
        this.cymbalContact();
      }
    }
    // The ram: the band plays double time while the empty truck careens.
    if (this.state === 'ram' && this.ramT % 8 === 0) this.world.audio.sfx(this.ramT % 16 === 0 ? 'bandwagon/drum' : 'bandwagon/brass');
  }

  /** The bell steps toward the held aim every 6 ticks (GDD §8.4). */
  protected override updateAim(pad: VirtualPad): void {
    const ax = pad.axisX();
    let target = 0;
    if (pad.held('up')) target = ax !== 0 && ax !== this.facing ? 4 : 3;
    if (target !== this.bellStep) {
      if (++this.bellT >= BANDWAGON.bellTicks) {
        this.bellT = 0;
        this.bellStep += target > this.bellStep ? 1 : -1;
      }
    } else this.bellT = 0;
    this.aimElev = bellAngle(this.bellStep);
  }

  /** World position of the bell's mouth. */
  bellMuzzleWorld(out: [number, number]): [number, number] {
    bellMuzzle(this.bellStep, mz);
    out[0] = this.x + (BANDWAGON.pivot[0] + mz[0]) * this.facing;
    out[1] = this.y + BANDWAGON.pivot[1] + mz[1];
    return out;
  }

  protected override fireMain(): void {
    const m = this.bellMuzzleWorld(pt);
    this.mainGun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, this.aimElev), aimDirOf(this.aimElev)));
  }

  /** The drum boom starts under the truck (the weapon reads the shooter's position). */
  protected override fireCannon(): void {
    this.cannonGun.fire(this.fireArgs(this.x, this.y, this.facing > 0 ? 0 : Math.PI, 'forward'));
  }

  drumHit(): void {
    this.drumT = 12;
  }

  // ------------------------------------------------------------------------------- CYMBAL WALL

  raiseCymbals(): void {
    this.cymbalT = CYMBAL.ticks + CYMBAL.swing;
    this.cymbalHits.length = 0;
  }

  /** The 60 ticks between the swing up and the end. */
  get cymbalsUp(): boolean {
    return this.cymbalT > 0 && this.cymbalT <= CYMBAL.ticks;
  }

  /** The wall in front of the cab (world space). */
  cymbalRect(out: Rect): Rect {
    return rectAt(this.x, this.y, BANDWAGON.cymbals, this.facing < 0, out);
  }

  /** Enemy projectiles that reach the cymbals clang off them (GDD §8.4). */
  private blockShots(): void {
    const wall = this.cymbalRect(this.wall);
    const list = this.world.snapshotTag('shot');
    try {
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s.alive || s.team !== 'enemy' || !(s instanceof Projectile)) continue;
        if (!overlaps(s.hitRect(scratch), wall)) continue;
        hitSpark(this.world, s.x, s.y, this.facing);
        s.dead = true;
        s.remove();
        this.world.audio.sfx('hit/shield');
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  /** 100 to anything the truck (or its cymbals) touches, once per target. */
  private cymbalContact(): void {
    const boxes = this.hurtboxes();
    const wall = this.cymbalRect(this.wall);
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !hostile(this.team, e.team) || this.cymbalHits.includes(e)) continue;
        const hb = e.hurtboxes();
        let part = -1;
        for (let k = 0; k < hb.length && part < 0; k++) {
          if (overlaps(hb[k], wall) || overlaps(hb[k], boxes[0]) || overlaps(hb[k], boxes[1])) part = k;
        }
        if (part < 0) continue;
        this.cymbalHits.push(e);
        const d: Damage = { amount: CYMBAL.damage, kind: 'impact', dirX: this.facing, owner: this.lastDriver, source: this, weapon: 'bandwagon-cymbal-wall' };
        this.world.damage(e, d, part);
        this.world.audio.sfx('bandwagon/cymbals');
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  /** While the cymbals are up, hits from the front clang off them (no cell lost). */
  override onHit(d: Damage): boolean {
    if (this.state === 'driven' && this.cymbalsUp && d.kind !== 'crush' && d.dirX * this.facing < 0) {
      this.world.audio.sfx('hit/shield');
      return true;
    }
    return super.onHit(d);
  }

  /** A shower of instruments on top of the blast. */
  override explode(damage = this.wreckDamage, radius = this.wreckRadius): void {
    if (this.removed) return;
    const w = this.world;
    w.particles.burst(INSTRUMENTS, this.x, this.y - 28, 18, 1.2, 3.6, -Math.PI / 2, 2.6);
    super.explode(damage, radius);
  }

  /** The empty gag: the bell droops and the drum thumps by itself; a note puffs out. */
  protected override onGag(): void {
    this.drumT = 12;
    FxEntity.spawn(this.world, {
      sprite: ID.note,
      x: this.x + (BANDWAGON.pivot[0] + 12) * this.facing,
      y: this.y + BANDWAGON.pivot[1] - 6,
      vy: -0.5,
      life: 44,
      ticksPerFrame: 11,
      loop: true,
      wobble: 2,
      z: 60,
    });
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const f = this.facing;
    const flip = f < 0;
    opts.flipX = flip;
    tint.flipX = flip;
    if (this.state === 'wreck') {
      opts.flash = this.world.tick % 4 < 2;
      r.sprite(ID.wreck, 0, x, y, opts);
      return;
    }
    const t = this.world.tick;
    const moving = this.state === 'driven' && Math.abs(this.vx) > 0.2;
    const bob = this.state === 'ram' ? ((t >> 2) & 1) * 2 - 1 : moving ? (t >> 3) & 1 : 0;
    const by = y - bob;
    const flash = this.flashOn();
    opts.flash = flash;
    const damaged = this.cells <= 1 ? 1 : 0;
    // 1. The truck (cab, flatbed, stage, poles, bunting), 2. the drum, 3. the pilot,
    // 4. the podium front (hides his legs), 5. the bell, 6. wheels, 7. cymbals.
    r.sprite(ID.body, damaged, x, by, opts);
    r.sprite(ID.drum, this.drumT > 0 ? 1 + ((12 - this.drumT) >> 2) : 0, x, by, opts);
    if (this.driver) drawDriver(r, this.driver, x + BANDWAGON.driverDraw[0] * f, by + BANDWAGON.driverDraw[1], flip);
    opts.flash = flash;
    r.sprite(ID.front, 0, x, by, opts);
    const gag = this.gagT > 0;
    // Left empty, the bell droops (the `empty-gag` strip) while the drum thumps by itself.
    if (gag) r.sprite(ID.gag, (t >> 5) & 1, x + BANDWAGON.pivot[0] * f, by + BANDWAGON.pivot[1], opts);
    else r.sprite(ID.bell, this.bellStep, x + BANDWAGON.pivot[0] * f, by + BANDWAGON.pivot[1], opts);
    const turn = Math.floor(this.roll / 3) * f;
    const frame = ((turn % 4) + 4) % 4;
    for (let i = 0; i < BANDWAGON.wheels.length; i++) r.sprite(ID.wheels, frame, x + BANDWAGON.wheels[i] * f, y + BANDWAGON.wheelY, opts);
    if (this.cymbalT > 0) r.sprite(ID.special, this.cymbalFrame(), x, by, opts);
    if (this.redTint()) {
      r.sprite(ID.body, damaged, x, by, tint);
      r.sprite(ID.front, 0, x, by, tint);
    }
  }

  /** Special strip: 0–2 swing up, 3–4 shimmer, then the swing down. */
  private cymbalFrame(): number {
    const t = this.cymbalT;
    const total = CYMBAL.ticks + CYMBAL.swing;
    const since = total - t;
    if (since < CYMBAL.swing) return Math.min(2, Math.floor((since * 3) / CYMBAL.swing));
    if (t < CYMBAL.swing) return Math.min(2, Math.floor((t * 3) / CYMBAL.swing));
    return 3 + ((this.world.tick >> 2) & 1);
  }
}

defineEntity('bandwagon', (w, x, y, p) => new Bandwagon(w, x, y, p), {
  category: 'vehicle',
  description: 'THE BANDWAGON: captured Legion parade truck (4 cells; brass cannon, drum boom, CYMBAL WALL).',
});
